> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/genkit-ai-genkit-learnings.md`  
> **Source**: github ([https://github.com/genkit-ai/genkit](https://github.com/genkit-ai/genkit))  
> **Source Version**: `1eb9489f`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-31T20:23:17.253Z  
> **Learning ID**: `learn-github-genkit-ai-genkit`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): genkit-ai/genkit

> **Canonical Artifact**: `07_PROJECT_LEARNING/genkit-ai-genkit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/genkit-ai/genkit](https://github.com/genkit-ai/genkit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-31T20:23:17.246Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `genkit-ai/genkit`
- **Description**: Open-source framework for building agentic apps in JavaScript, Go, Dart, and Python, built and used in production by Google
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6561 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `genkit-tools/cli/src/commands/init-ai-tools/utils.ts`
```
/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { existsSync, readFileSync } from 'fs';

import { Runtime } from '@genkit-ai/tools-common/manager';
import * as crypto from 'crypto';
import { writeFile } from 'fs/promises';
import { GENKIT_CONTEXT as GoContext } from './context/go';
import { GENKIT_CONTEXT as NodeContext } from './context/nodejs';

/** Shared location for the GENKIT.md context file */
export const GENKIT_PROMPT_PATH = 'GENKIT.md';

const GENKIT_TAG_REGEX =
  /<genkit_prompts(?:\s+hash="([^"]+)")?>([\s\S]*?)<\/genkit_prompts>/;
/*
 * Deeply compares two JSON-serializable objects. It's a simplified version of a
 * deep equal function, sufficient for comparing the structure of the
 * gemini-extension.json file. It doesn't handle special cases like RegExp,
 * Date, or functions.
 */
export function deepEqual(a: any, b: any): boolean {
  if (a === b) {
    return true;
  }

  if (
    typeof a !== 'object' ||
    a === null ||
    typeof b !== 'object' ||
    b === null
  ) {
    return false;
  }

  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) {
    return false;
  }

  for (const key of keysA) {
    if (!keysB.includes(key) || !deepEqual(a[key], b[key])) {
      return false;
    }
  }

  return true;
}

/**
 * Replace an entire prompt file (no user content to preserve). Used for files
 * we fully own like GENKIT.md.
 */
export async function initOrReplaceFile(
  filePath: string,
  content: string
): Promise<{ updated: boolean }> {
  const fileExists = existsSync(filePath);
  if (fileExists) {
    const currentConfig = readFileSync(filePath, 'utf-8');
    if (!deepEqual(currentConfig, content)) {
      await writeFile(filePath, content);
      return { updated: true };
    }
  } else {
    await writeFile(filePath, content);
    return { updated: true };
  }
  return { updated: false };
}

/**
 * Update a file with Genkit prompts section, preserving user content
 * Used for files like CLAUDE.md.
 */
export async function updateContentInPlace(
  filePath: string,
  content: string,
  options?: { hash: string }
): Promise<{ updated: boolean }> {
  const newHash = options?.hash ?? calculateHash(content);
  const newSection = `<genkit_prompts hash="${newHash}">
<!-- Genkit Context - Auto-generated, do not edit -->
${content}
</genkit_prompts>`;

  let currentContent = '';
  const fileExists = existsSync(filePath);
  if (fileExists) {
    currentContent = readFileSync(filePath, 'utf-8');
  }

  // Check if section exists and has same hash
  const match = currentContent.match(GENKIT_TAG_REGEX);
  if (match && match[1] === newHash) {
    return { updated: false };
  }

  // Generate final content
  let finalContent: string;
  if (!currentContent) {
    // New file
    finalContent = newSection;
  } else if (match) {
    // Replace existing section
    finalContent =
      currentContent.substring(0, match.index!) +
      newSection +
      currentContent.substring(match.index! + match[0].length);
  } else {
    // Append to existing file
    const separator = currentContent.endsWith('\n') ? '\n' : '\n\n';
    finalContent = currentContent + separator + newSection;
  }

  await writeFile(filePath, finalContent);
  return { updated: true };
}

/**
 * Generate hash for embedded content.
 */
export function calculateHash(content: string): string {
  return crypto
    .createHash('sha256')
    .update(content.trim())
    .digest('hex')
    .substring(0, 8);
}

/**
 * Get raw prompt content for Genkit
 */
export function getGenkitContext(runtime: Runtime): string {
  switch (runtime) {
    case 'nodejs':
      return NodeContext;
    case 'go':
      return GoContext;
    default:
      throw new Error(`Unexpected runtime provided: ${runtime}`);
  }
}

/**
 * Initializes the GENKIT.md file
 */
export async function initGenkitFile(runtime: Runtime) {
  const genkitContext = getGenkitContext(runtime);
  const result = await initOrReplaceFile(GENKIT_PROMPT_PATH, genkitContext);
  return { updated: result.updated, hash: calculateHash(genkitContext) };
}

```

### Core Architecture Module: `genkit-tools/cli/src/mcp/utils.ts`
```
/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  BaseRuntimeManager,
  GenkitToolsError,
} from '@genkit-ai/tools-common/manager';
import { z } from 'zod';
import { startDevProcessManager, startManager } from '../utils/manager-utils';

export function formatMcpError(err: unknown): string {
  if (err instanceof GenkitToolsError) {
    return err.formatError();
  }
  if (err instanceof Error) {
    return err.message;
  }
  return typeof err === 'string' ? err : (JSON.stringify(err) ?? String(err));
}

export interface McpToolOptions {
  projectRoot: string;
  explicitProjectRoot: boolean;
  timeout?: number;
  manager: McpRuntimeManager;
}

export function getCommonSchema(
  explicitProjectRoot: boolean,
  shape: z.ZodRawShape = {}
): z.ZodRawShape {
  return !explicitProjectRoot
    ? shape
    : {
        projectRoot: z
          .string()
          .describe(
            'The path to the current project root (a.k.a workspace directory or project directory); type: string'
          ),
        ...shape,
      };
}

export function resolveProjectRoot(
  explicitProjectRoot: boolean,
  opts: {
    [x: string]: any;
  },
  fallback: string
): string | { content: any[]; isError: boolean } {
  if (explicitProjectRoot && !opts?.projectRoot) {
    return {
      content: [
        { type: 'text', text: 'Project root is required for this tool.' },
      ],
      isError: true,
    };
  }
  return opts?.projectRoot ?? fallback;
}

/** Genkit Runtime manager specifically for the MCP server. Allows lazy
 * initialization and dev process manangement. */
export class McpRuntimeManager {
  private manager: BaseRuntimeManager | undefined;
  private currentProjectRoot: string | undefined;

  /** @param auth `--experimental-auth`. */
  constructor(private readonly auth?: boolean) {}

  async getManager(projectRoot: string) {
    if (this.manager && this.currentProjectRoot === projectRoot) {
      return this.manager;
    }
    if (this.manager) {
      await this.manager.stop();
    }
    // No auth here: attaching to existing runtimes never generates a secret.
    // `this.auth` applies when a runtime is spawned (getManagerWithDevProcess).
    this.manager = await startManager({ projectRoot, manageHealth: true });
    this.currentProjectRoot = projectRoot;
    return this.manager;
  }

  async getManagerWithDevProcess(params: {
    projectRoot: string;
    command: string;
    args: string[];
    explicitProjectRoot: boolean;
    timeout?: number;
  }): Promise<BaseRuntimeManager> {
    const { projectRoot, command, args, timeout, explicitProjectRoot } = params;
    if (this.manager) {
      await this.manager.stop();
    }
    const devManager = await startDevProcessManager(
      projectRoot,
      command,
      args,
      {
        nonInteractive: true,
        healthCheck: timeout !== 0,
        timeout,
        cwd: explicitProjectRoot ? projectRoot : undefined,
        auth: this.auth,
      }
    );
    this.manager = devManager.manager;
    this.currentProjectRoot = projectRoot;
    return this.manager;
  }

  async kill() {
    if (this.manager) {
      await this.manager.stop();
    }
  }
}

```

### Core Architecture Module: `genkit-tools/cli/src/utils/manager-utils.ts`
```
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  LocalFileLogStore,
  LocalFileTraceStore,
  startTelemetryServer,
} from '@genkit-ai/telemetry-server';
import type { Status } from '@genkit-ai/tools-common';
import {
  BaseRuntimeManager,
  DEFAULT_REFLECTION_V2_HOST,
  ProcessManager,
  REFLECTION_SECRET_ENV,
  RuntimeEvent,
  RuntimeManager,
  generateReflectionSecret,
  reflectionV2Url,
  type GenkitToolsError,
} from '@genkit-ai/tools-common/manager';
import { logger } from '@genkit-ai/tools-common/utils';
import getPort, { makeRange } from 'get-port';

/** Shared help text for `--experimental-auth` on every command that spawns or hosts runtimes. */
export const EXPERIMENTAL_AUTH_OPTION_HELP =
  'generate a reflection API secret and require it from runtimes (experimental; ' +
  'runtimes on older Genkit versions are rejected over the WebSocket protocol)';

/** Shared help text for `--reflection-v2-host`. */
export const REFLECTION_V2_HOST_OPTION_HELP =
  'host/interface to bind the reflection v2 (WebSocket) server to (defaults to ' +
  '127.0.0.1). Use 0.0.0.0 when the runtime runs elsewhere, e.g. in a container ' +
  'or on a device; pair it with --experimental-auth.';

/**
 * Returns the telemetry server address either based on environment setup or starts one.
 *
 * This function is not idempotent. Typically you want to make sure it's called only once per cli instance.
 */
export async function resolveTelemetryServer(options: {
  projectRoot: string;
  corsOrigin?: string;
}): Promise<string> {
  let telemetryServerUrl = process.env.GENKIT_TELEMETRY_SERVER;
  if (!telemetryServerUrl) {
    const telemetryPort = await getPort({ port: makeRange(4033, 4999) });
    telemetryServerUrl = `http://localhost:${telemetryPort}`;
    await startTelemetryServer({
      port: telemetryPort,
      traceStore: new LocalFileTraceStore({
        storeRoot: options.projectRoot,
        indexRoot: options.projectRoot,
      }),
      logStore: new LocalFileLogStore({
        storeRoot: options.projectRoot,
        indexRoot: options.projectRoot,
      }),
      corsOrigin: options.corsOrigin,
    });
  }
  return telemetryServerUrl;
}

/**
 * Resolves the reflection secret this CLI run uses.
 *
 * An operator-set `GENKIT_REFLECTION_SECRET_TOKEN` is always used, flag or
 * not: nobody sets it by accident, and it is how a CLI shares a secret with a
 * runtime it did not spawn. Otherwise a fresh secret is minted only when
 * `auth` is on (`--experimental-auth`) and `generate` is set: commands that
 * spawn a runtime or host the v2 server generate, commands that only attach
 * to existing v1 runtimes do not (they read each runtime's secret from its
 * discovery file).
 */
export function resolveReflectionSecret(options: {
  /** `--experimental-auth`: mint a secret when none is configured. */
  auth?: boolean;
  generate: boolean;
}): string | undefined {
  const fromEnv = process.env[REFLECTION_SECRET_ENV];
  if (fromEnv) {
    return fromEnv;
  }
  return options.auth && options.generate
    ? generateReflectionSecret()
    : undefined;
}

/**
 * Starts the runtime manager and its dependencies.
 */
export async function startManager(options: {
  projectRoot: string;
  manageHealth?: boolean;
  corsOrigin?: string;
  experimentalReflectionV2?: boolean;
  reflectionV2Port?: number;
  /** `--reflection-v2-host`. */
  reflectionV2Host?: string;
  telemetryServerUrl?: string;
  /**
   * Secret to use. When omitted, falls back to `GENKIT_REFLECTION_SECRET_TOKEN`.
   * Never generated here: a manager without a spawned runtime has nobody to
   * hand a fresh secret to.
   * v1 runtimes that wrote their own secret into their discovery file are
   * reached with that one regardless.
   */
  reflectionSecret?: string;
  experimentalUseOtel?: boolean;
}): Promise<BaseRuntimeManager> {
  const telemetryServerUrl =
    options.telemetryServerUrl ?? (await resolveTelemetryServer(options));
  const manager = RuntimeManager.create({
    telemetryServerUrl,
    manageHealth: options.manageHealth,
    projectRoot: options.projectRoot,
    experimentalReflectionV2: options.experimentalReflectionV2,
    reflectionV2Port: options.reflectionV2Port,
    reflectionV2Host: options.reflectionV2Host,
    reflectionSecret:
      options.reflectionSecret ?? resolveReflectionSecret({ generate: false }),
    suppressRuntimeTelemetry: options.experimentalUseOtel,
  });
  return manager;
}

export interface DevProcessManagerOptions {
  disableRealtimeTelemetry?: boolean;
  nonInteractive?: boolean;
  healthCheck?: boolean;
  timeout?: number;
  cwd?: string;
  corsOrigin?: string;
  experimentalReflectionV2?: boolean;
  envVars?: Record<string, string>;
  reflectionV2Port?: number;
  /** `--reflection-v2-host`: interface the v2 server binds. */
  reflectionV2Host?: string;
  telemetryServerUrl?: string;
  /** `--experimental-auth`: generate a secret and require it from runtimes. */
  auth?: boolean;
  /** Secret already resolved by {@link getDevEnvVars}; reused as-is. */
  reflectionSecret?: string;
  /**
   * Point the app's own OpenTelemetry SDK at the dev telemetry server (via
   * standard OTLP env vars) instead of enabling Genkit's native direct export.
   * Renders only what the app's OTel instrumentation emits in the Dev UI.
   */
  experimentalUseOtel?: boolean;
}

export interface DevEnv {
  envVars: Record<string, string>;
  reflectionV2Port?: number;
  telemetryServerUrl: string;
  /** Set with `--experimental-auth` or an operator-set token. */
  reflectionSecret?: string;
}

export async function getDevEnvVars(
  projectRoot: string,
  options?: DevProcessManagerOptions
): Promise<DevEnv> {
  const telemetryServerUrl = await resolveTelemetryServer({
    projectRoot,
    corsOrigin: options?.corsOrigin,
  });
  const disableRealtimeTelemetry = options?.disableRealtimeTelemetry ?? false;
  const experimentalReflectionV2 = options?.experimentalReflectionV2 ?? false;
  const reflectionSecret = resolveReflectionSecret({
    auth: options?.auth,
    generate: true,
  });
  const useOtel = options?.experimentalUseOtel ?? false;

  let reflectionV2Port: number | undefined;
  const envVars: Record<string, string> = {
    GENKIT_ENV: 'dev',
  };

  if (reflectionSecret) {
    envVars[REFLECTION_SECRET_ENV] = reflectionSecret;
  }

  if (useOtel) {
    // Drive the app's own OTel SDK to the dev telemetry server's OTLP endpoints.
    // The server only parses JSON bodies (express.json), so http/json is
    // required; per-signal endpoints are used verbatim (no /v1/* appended), so
    // the full path is spelled out. Metrics are deliberately not redirected:
    // the server doesn't ingest them, so they go wherever the app's own OTel
    // config sends them.
    //
    // GENKIT_TELEMETRY_SERVER is blanked rather than omitted: the child
    // inherits process.env, so a value exported in the shell (the
    // reuse-a-server path) would otherwise re-enable native direct export.
    // All runtimes treat '' as unset. The reflection handshake withholds the
    // URL too (suppressRuntimeTelemetry), so only OTel-instrumented spans show
    // up.
    envVars.GENKIT_TELEMETRY_SERVER = '';
    // Strip trailing slashes: a user-supplied GENKIT_TELEMETRY_SERVER may end
    // with one, and naive concatenation would yield a double slash.
    const baseUrl = telemetryServerUrl.replace(/\/+$/, '');
    envVars.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT = `${baseUrl}/api/otlp/v1/traces`;
    envVars.OTEL_EXPORTER_OTLP_TRACES_PROTOCOL = 'http/json';
    envVars.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT = `${baseUrl}/api/otlp/v1/logs`;
    envVars.OTEL_EXPORTER_OTLP_LOGS_PROTOCOL = 'http/json';
  } else {
    envVars.GENKIT_TELEMETRY_SERVER = telemetryServerUrl;
    if (!disableRealtimeTelemetry) {
      envVars.GENKIT_ENABLE_REALTIME_TELEMETRY = 'true';
    }
  }

  if (experimentalReflectionV2) {
    // Probe and URL must both match the interface the v2 server binds;
    // `localhost` may resolve to ::1 first and miss an IPv4-only listener.
    const host = options?.reflectionV2Host ?? DEFAULT_REFLECTION_V2_HOST;
    reflectionV2Port = await getPort({ port: makeRange(3200, 3400), host });
    envVars.GENKIT_REFLECTION_V2_SERVER = reflectionV2Url(
      host,
      reflectionV2Port
    );
  }

  return { envVars, reflectionV2Port, telemetryServerUrl, reflectionSecret };
}

export async function startDevProcessManager(
  projectRoot: string,
  command: string,
  args: string[],
  options?: DevProcessManagerOptions
): Promise<{ manager: BaseRuntimeManager; processPromise: Promise<void> }> {
  const { envVars, reflectionV2Port, telemetryServerUrl } =
    options?.envVars &&
    options?.telemetryServerUrl &&
    (!options?.experimentalReflectionV2 || options?.reflectionV2Port)
      ? {
          envVars: options.envVars,
          reflectionV2Port: options.reflectionV2Port,
          telemetryServerUrl: options.telemetryServerUrl,
        }
      : await getDevEnvVars(projectRoot, options);

  const disableRealtimeTelemetry = options?.disableRealtimeTelemetry ?? false;
  const experimentalReflectionV2 = options?.experimentalReflectionV2 ?? false;
  // Derived from the env the child actually receives, so the manager and the
  // runtime can never disagree, whichever path produced envVars.
  const reflectionSecret: string | undefined = envVars[REFLECTION_SECRET_ENV];

  const processManager = new ProcessManager(command, args, envVars);
  cons
```

### Core Architecture Module: `genkit-tools/cli/src/utils/option-parsers.ts`
```
/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { InvalidArgumentError } from 'commander';

/**
 * Argument parsers for Commander options.
 *
 * Commander calls a parser with `(value, previousValue)`, so these parsers
 * ignore the second argument. Throwing `InvalidArgumentError` makes Commander
 * print `error: option '<flag>' argument '<value>' is invalid. <message>` and
 * exit with code 1 before the command action runs.
 */

function parseInteger(value: string): number {
  // Reject partial matches such as "10abc" or "1.5" that parseInt would accept.
  if (!/^-?\d+$/.test(value.trim())) {
    return Number.NaN;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

/** Parses an integer greater than 0. */
export function parsePositiveInt(value: string): number {
  const parsed = parseInteger(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw new InvalidArgumentError('Must be a positive integer.');
  }
  return parsed;
}

/** Parses an integer greater than or equal to 0. */
export function parseNonNegativeInt(value: string): number {
  const parsed = parseInteger(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new InvalidArgumentError('Must be a non-negative integer.');
  }
  return parsed;
}

/** Parses a TCP port number between 1 and 65535. */
export function parsePort(value: string): number {
  const parsed = parseInteger(value);
  if (Number.isNaN(parsed) || parsed < 1 || parsed > 65535) {
    throw new InvalidArgumentError('Must be an integer between 1 and 65535.');
  }
  return parsed;
}

/**
 * Parses a trace status filter ("success", "error", or a non-negative integer
 * status code). Maps "success" to 0 and "error" to 2 to match the Dev UI enum.
 */
export function parseTraceStatus(value: string): number {
  const normalized = value.toLowerCase();
  if (normalized === 'success') {
    return 0;
  }
  if (normalized === 'error') {
    return 2;
  }
  const parsed = parseInteger(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    throw new InvalidArgumentError(
      'Expected "success", "error", or a non-negative integer status code.'
    );
  }
  return parsed;
}

/** Parses a JSON string. */
export function parseJson(value: string): any {
  try {
    return JSON.parse(value);
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    throw new InvalidArgumentError(`Must be valid JSON (${detail}).`);
  }
}

```

### Core Architecture Module: `genkit-tools/cli/src/utils/runtime-detector.ts`
```
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { existsSync } from 'fs';
import { basename, extname } from 'path';

const RUNTIME_NODE = 'node';
const RUNTIME_BUN = 'bun';
const RUNTIME_COMPILED = 'compiled-binary';

const NODE_PATTERNS = ['node', 'nodejs'];
const BUN_PATTERNS = ['bun'];

const SCRIPT_EXTENSIONS = ['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx'];

/**
 * CLI runtime types supported by the detector
 */
export type CLIRuntimeType = 'node' | 'bun' | 'compiled-binary';

/**
 * Information about the CLI runtime environment
 */
export interface CLIRuntimeInfo {
  /** Type of CLI runtime or execution mode */
  type: CLIRuntimeType;
  /** Path to the executable (node, bun, or the compiled binary itself) */
  execPath: string;
  /** Path to the script being executed (undefined for compiled binaries) */
  scriptPath?: string;
  /** Whether this is a compiled binary (e.g., Bun-compiled) */
  isCompiledBinary: boolean;
  /** Platform information */
  platform: NodeJS.Platform;
}

/**
 * Safely checks if a file exists without throwing errors
 * @param path - File path to check
 * @returns true if the file exists, false otherwise
 */
function safeExistsSync(path: string | undefined): boolean {
  if (!path) return false;
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}

/**
 * Checks if the given path has a recognized script file extension
 * @param path - File path to check
 * @returns true if the path ends with a known script extension
 * @internal Kept for potential future use, though not currently used in detection logic
 */
function isLikelyScriptFile(path: string | undefined): boolean {
  if (!path) return false;
  const ext = extname(path).toLowerCase();
  return SCRIPT_EXTENSIONS.includes(ext);
}

/**
 * Checks if executable name contains any of the given patterns
 * @param execName - Name of the executable
 * @param patterns - Array of patterns to match against
 * @returns true if any pattern is found in the executable name
 */
function matchesPatterns(execName: string, patterns: string[]): boolean {
  const lowerExecName = execName.toLowerCase();
  return patterns.some((pattern) => lowerExecName.includes(pattern));
}

/**
 * Detects the current CLI runtime environment and execution context.
 * This helps determine how to properly spawn child processes.
 *
 * @returns CLI runtime information including type, paths, and platform
 * @throws Error if unable to determine CLI runtime executable path
 */
export function detectCLIRuntime(): CLIRuntimeInfo {
  const platform = process.platform;
  const execPath = process.execPath;

  if (!execPath || execPath.trim() === '') {
    throw new Error('Unable to determine CLI runtime executable path');
  }

  const argv0 = process.argv[0];
  const argv1 = process.argv[1];

  const execBasename = basename(execPath);
  const argv0Basename = argv0 ? basename(argv0) : '';

  const hasBunVersion = 'bun' in (process.versions || {});
  const hasNodeVersion = 'node' in (process.versions || {});

  const execMatchesBun = matchesPatterns(execBasename, BUN_PATTERNS);
  const execMatchesNode = matchesPatterns(execBasename, NODE_PATTERNS);
  const argv0MatchesBun = matchesPatterns(argv0Basename, BUN_PATTERNS);
  const argv0MatchesNode = matchesPatterns(argv0Basename, NODE_PATTERNS);

  const hasScriptArg = !!argv1;
  const scriptExists = hasScriptArg && safeExistsSync(argv1);

  let type: CLIRuntimeType;
  let scriptPath: string | undefined;
  let isCompiledBinary: boolean;

  // Determine runtime type based on most reliable indicators
  if (hasBunVersion || execMatchesBun || argv0MatchesBun) {
    // Check if this is a Bun-compiled binary
    // Bun compiled binaries have virtual paths like /$bunfs/root/...
    if (
      argv1 &&
      (argv1.startsWith('/$bunfs/') || /^[A-Za-z]:[\\/]+~BUN[\\/]+/.test(argv1))
    ) {
      // This is a Bun-compiled binary
      type = RUNTIME_COMPILED;
      scriptPath = undefined;
      isCompiledBinary = true;
    } else {
      // Regular Bun runtime
      type = RUNTIME_BUN;
      scriptPath = argv1;
      isCompiledBinary = false;
    }
  } else if (hasNodeVersion || execMatchesNode || argv0MatchesNode) {
    // Definitely Node.js
    type = RUNTIME_NODE;
    scriptPath = argv1;
    isCompiledBinary = false;
  } else if (!hasScriptArg || !scriptExists) {
    // No script argument or script doesn't exist - likely compiled binary
    type = RUNTIME_COMPILED;
    scriptPath = undefined;
    isCompiledBinary = true;
  } else {
    // Have a script argument that exists but unknown runtime
    // This handles cases like custom Node.js builds with unusual names
    type = RUNTIME_NODE;
    scriptPath = argv1;
    isCompiledBinary = false;
  }

  return {
    type,
    execPath,
    scriptPath,
    isCompiledBinary,
    platform,
  };
}

```

### Core Architecture Module: `genkit-tools/cli/src/utils/spawn-config.ts`
```
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { type SpawnOptions } from 'child_process';
import { access, constants } from 'fs/promises';
import { SERVER_HARNESS_COMMAND } from '../commands/server-harness';
import { type CLIRuntimeInfo } from './runtime-detector';

/**
 * Configuration for spawning a child process
 */
export interface SpawnConfig {
  /** Executable to run */
  command: string;
  /** Arguments array */
  args: string[];
  /** Spawn options */
  options: SpawnOptions;
}

/**
 * Validates that a path exists and is executable
 * @param path - Path to validate
 * @returns true if the path exists and is executable
 */
export async function validateExecutablePath(path: string): Promise<boolean> {
  try {
    // Remove surrounding quotes if present (handle quotation)
    const normalizedPath =
      path.startsWith('"') && path.endsWith('"') ? path.slice(1, -1) : path;
    await access(normalizedPath, constants.F_OK | constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validates that a port number is valid (integer between 0 and 65535)
 * @param port - Port number to validate
 * @returns true if the port is valid
 */
function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= 0 && port <= 65535;
}

/**
 * Builds spawn configuration for the server harness based on runtime info
 *
 * @param cliRuntime - CLI runtime information from detector
 * @param port - Port number for the server (must be valid port 0-65535)
 * @param logPath - Path to the log file
 * @returns Spawn configuration for child_process.spawn
 * @throws Error if port is invalid or runtime info is missing required fields
 *
 * @example
 * ```typescript
 * const cliRuntime = detectRuntime();
 * const config = buildServerHarnessSpawnConfig(cliRuntime, 4000, '/path/to/log');
 * const child = spawn(config.command, config.args, config.options);
 * ```
 */
export function buildServerHarnessSpawnConfig(
  cliRuntime: CLIRuntimeInfo,
  port: number,
  logPath: string
): SpawnConfig {
  // Validate inputs
  if (!cliRuntime) {
    throw new Error('CLI runtime info is required');
  }
  if (!cliRuntime.execPath) {
    throw new Error('CLI runtime execPath is required');
  }
  if (!isValidPort(port)) {
    throw new Error(
      `Invalid port number: ${port}. Must be between 0 and 65535`
    );
  }
  if (!logPath) {
    throw new Error('Log path is required');
  }

  let command = cliRuntime.execPath;
  let args: string[];

  if (cliRuntime.type === 'compiled-binary') {
    // For compiled binaries, execute directly with arguments
    args = [SERVER_HARNESS_COMMAND, port.toString(), logPath];
  } else {
    // For interpreted runtimes (Node.js, Bun), include script path if available
    args = cliRuntime.scriptPath
      ? [
          cliRuntime.scriptPath,
          SERVER_HARNESS_COMMAND,
          port.toString(),
          logPath,
        ]
      : [SERVER_HARNESS_COMMAND, port.toString(), logPath];
  }

  // Build spawn options with platform-specific settings
  const options: SpawnOptions = {
    stdio: ['ignore', 'ignore', 'ignore'] as const,
    detached: false,
    // Use shell on Windows for better compatibility with paths containing spaces
    shell: cliRuntime.platform === 'win32',
  };

  // Handles spaces in the command and arguments on Windows
  if (cliRuntime.platform === 'win32') {
    command = `"${command}"`;
    args = args.map((arg) => `"${arg}"`);
  }

  return {
    command,
    args,
    options,
  };
}

```

### Core Architecture Module: `genkit-tools/cli/src/utils/trace-formatter.ts`
```
/**
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import type { NestedSpanData, Part, TraceData } from '@genkit-ai/tools-common';
import { MessageSchema } from '@genkit-ai/tools-common';
import {
  formatDuration,
  getSpanStatus,
  getSpanType,
  parseAndSanitizeJson,
  stackTraceSpans,
} from '@genkit-ai/tools-common/utils';
import YAML from 'yaml';
import { z } from 'zod';

type FormattedPart = {
  type: 'toolCall' | 'toolResponse' | 'text' | 'media' | 'other';
  text: string;
};

/**
 * Formats a single Part object into a human-readable FormattedPart.
 */
function formatPart(part: Part): FormattedPart | null {
  if (part.toolRequest) {
    const tr = part.toolRequest;
    const argsStr = JSON.stringify(tr.input || {});
    return { type: 'toolCall', text: `Tool Call: ${tr.name}(${argsStr})` };
  }
  if (part.toolResponse) {
    const tr = part.toolResponse;
    const outStr =
      typeof tr.output === 'string'
        ? tr.output
        : JSON.stringify(tr.output || {});
    return {
      type: 'toolResponse',
      text: `Tool Output [${tr.name}]: ${outStr}`,
    };
  }
  if (part.text !== undefined && part.text !== null) {
    return { type: 'text', text: part.text };
  }
  if (part.media) {
    return {
      type: 'media',
      text: `[Media: ${part.media.contentType || 'file'} ${part.media.url}]`,
    };
  }
  if (part.reasoning) {
    return { type: 'text', text: `Reasoning: ${part.reasoning}` };
  }
  if (part.resource) {
    return { type: 'other', text: `[Resource: ${part.resource.uri}]` };
  }
  return null;
}

/**
 * Formats an entire message's content array into an array of strings,
 * including its role (User, System, Tool, Model).
 */
function formatMessageContent(
  msg: z.infer<typeof MessageSchema>
): string[] | null {
  const role = msg.role;

  const formattedParts = msg.content
    .map(formatPart)
    .filter((p): p is FormattedPart => p !== null);

  const rolePrefix =
    role === 'user'
      ? 'User: '
      : role === 'system'
        ? 'System: '
        : role === 'tool'
          ? 'Tool: '
          : 'Model: ';

  if (formattedParts.length === 0) {
    return [`${rolePrefix}(empty)`];
  }

  // Check for tool call first
  const toolCall = formattedParts.find((p) => p.type === 'toolCall');
  if (toolCall) {
    return [toolCall.text];
  }

  // Check for tool response next
  const toolResp = formattedParts.find((p) => p.type === 'toolResponse');
  if (toolResp) {
    return [toolResp.text];
  }

  // Text / media content
  const texts = formattedParts.map((p) => p.text);
  const fullText = texts.join('\n');

  const lines = fullText.split(/\r?\n/);
  if (lines.length === 1) {
    return [`${rolePrefix}"${lines[0]}"`];
  } else {
    const res = [`${rolePrefix}`];
    lines.forEach((l: string) => res.push(`  ${l}`));
    return res;
  }
}

function hasMessages(val: unknown): boolean {
  if (!val || typeof val !== 'object') return false;

  // Try to parse array elements directly
  if (Array.isArray(val)) {
    if (val.some((item) => MessageSchema.safeParse(item).success)) {
      return true;
    }
  }

  if (MessageSchema.safeParse(val).success) {
    return true;
  }
  return Object.values(val).some(hasMessages);
}

/**
 * Recursively formats unknown nested values (arrays, objects, primitives)
 * into an array of compact text lines for tree rendering.
 */
function formatCompactValue(
  val: unknown,
  childPrefix: string = '',
  keyName?: string
): string[] {
  if (val === undefined || val === null) return [];

  // 1. Matches MessageSchema -> format as Message
  const msgRes = MessageSchema.safeParse(val);
  if (msgRes.success) {
    const msgLines = formatMessageContent(msgRes.data);
    if (msgLines) {
      if (keyName) {
        return [
          `${childPrefix}${keyName}:`,
          ...msgLines.map((l) => `${childPrefix}  ${l}`),
        ];
      }
      return msgLines.map((l) => `${childPrefix}${l}`);
    }
  }

  // 2. Primitive (string, number, boolean)
  if (typeof val !== 'object') {
    const formatted = typeof val === 'string' ? val : String(val);
    if (keyName) {
      return [`${childPrefix}${keyName}: ${formatted}`];
    }
    return [`${childPrefix}${formatted}`];
  }

  // 4. Array -> Recurse on items
  if (Array.isArray(val)) {
    if (val.length === 0) {
      if (keyName) return [`${childPrefix}${keyName}: []`];
      return [];
    }
    const lines: string[] = [];
    if (keyName) {
      lines.push(`${childPrefix}${keyName}:`);
    }
    const itemPrefix = keyName ? `${childPrefix}  ` : childPrefix;

    const isAllMessages = val.every(
      (item) => MessageSchema.safeParse(item).success
    );
    if (isAllMessages) {
      val.forEach((item) => {
        lines.push(...formatCompactValue(item, itemPrefix));
      });
      return lines;
    }

    if (!hasMessages(val)) {
      const yamlStr = YAML.stringify(val, {
        indent: 2,
        lineWidth: 0,
      }).trimEnd();
      yamlStr.split(/\r?\n/).forEach((l) => lines.push(`${itemPrefix}${l}`));
      return lines;
    }

    val.forEach((item) => {
      const itemLines = formatCompactValue(item, itemPrefix + '  ');
      if (itemLines.length > 0) {
        itemLines[0] =
          itemPrefix + '- ' + itemLines[0].slice(itemPrefix.length + 2);
        lines.push(...itemLines);
      }
    });
    return lines;
  }

  // 4. Object -> Recurse on properties if it contains messages
  const obj = val as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) {
    if (keyName) return [`${childPrefix}${keyName}: {}`];
    return [];
  }

  const containsSpecial = hasMessages(obj);

  const lines: string[] = [];
  if (keyName) {
    lines.push(`${childPrefix}${keyName}:`);
  }
  const propPrefix = keyName ? `${childPrefix}  ` : childPrefix;

  if (containsSpecial) {
    for (const [k, v] of Object.entries(obj)) {
      if (v === undefined || v === null) continue;
      lines.push(...formatCompactValue(v, propPrefix, k));
    }
  } else {
    const yamlStr = YAML.stringify(val, { indent: 2, lineWidth: 0 }).trimEnd();
    yamlStr.split(/\r?\n/).forEach((l) => lines.push(`${propPrefix}${l}`));
  }

  return lines;
}

/**
 * Recursively renders a span and its nested children into a hierarchical string
 * array, dynamically appending the span's Input and Output payloads alongside
 * its child spans, drawing appropriate box-drawing tree connectors.
 */
function renderSpanTree(
  span: NestedSpanData,
  prefix: string = '',
  isLast: boolean = true
): string[] {
  const lines: string[] = [];
  const connector = isLast ? '└─ ' : '├─ ';
  const childPrefix = prefix + (isLast ? '   ' : '│  ');

  const type = getSpanType(span);
  const duration = formatDuration(span.startTime, span.endTime);
  const status = getSpanStatus(span);
  const name =
    span.displayName ||
    (span.attributes?.['genkit:name'] as string) ||
    span.spanId;

  let header = `${prefix}${connector}${name}`;
  if (type) header += ` (${type})`;
  if (duration) header += ` [${duration}]`;
  if (status) header += ` ${status}`;

  lines.push(header);

  const attrs = span.attributes || {};
  const rawInput = attrs['genkit:input'];
  const rawOutput = attrs['genkit:output'];
  const children = span.spans || [];

  const items: { type: 'input' | 'output' | 'child'; data: any }[] = [];
  if (rawInput !== undefined) items.push({ type: 'input', data: rawInput });
  if (rawOutput !== undefined) items.push({ type: 'output', data: rawOutput });
  children.forEach((c) => items.push({ type: 'child', data: c }));

  items.forEach((item, index) => {
    const itemIsLast = index === items.length - 1;
    const itemConnector = itemIsLast ? '└─ ' : '├─ ';
    const itemPrefix = childPrefix + (itemIsLast ? '   ' : '│  ');

    if (item.type === 'input') {
      const sanitizedInput = parseAndSanitizeJson(
        item.data,
        true /* keepBase64 */
      );
      const compactInput = formatCompactValue(sanitizedInput, '', 'Input');
      if (compactInput.length > 0) {
        lines.push(`${childPrefix}${itemConnector}${compactInput[0]}`);
        for (let i = 1; i < compactInput.length; i++) {
          lines.push(`${itemPrefix}${compactInput[i]}`);
        }
      }
    } else if (item.type === 'output') {
      const sanitizedOutput = parseAndSanitizeJson(
        item.data,
        true /* keepBase64 */
      );
      const compactOutput = formatCompactValue(sanitizedOutput, '', 'Output');
      if (compactOutput.length > 0) {
        lines.push(`${childPrefix}${itemConnector}${compactOutput[0]}`);
        for (let i = 1; i < compactOutput.length; i++) {
          lines.push(`${itemPrefix}${compactOutput[i]}`);
        }
      }
    } else if (item.type === 'child') {
      lines.push(...renderSpanTree(item.data, childPrefix, itemIsLast));
    }
  });

  return lines;
}

/**
 * Formats a complete TraceData payload into a full execution tree string.
 * This sets up the trace metadata header and orchestrates rendering the root span tree.
 */
export function formatTraceTree(trace: TraceData): string {
  const lines: string[] = [];
  lines.push(`Trace ID: ${trace.traceId}`);
  if (trace.displayName) lines.push(`Name:     ${trace.displayName}`);
  if (trace.startTime) {
    lines.push(`Time:     ${new Date(trace.startTime).toLocaleString()}`);
    if (trace.endTime) {
      lines.push(`Duration: ${formatDuration(trace.startTime, trace.endTime)}`);
    }
  }

  const rootSpan = sta
```

### Core Architecture Module: `genkit-tools/cli/src/utils/updates.ts`
```
/**
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { GenkitToolsError } from '@genkit-ai/tools-common/manager';
import { getUserSettings, logger } from '@genkit-ai/tools-common/utils';
import axios, { AxiosInstance } from 'axios';
import * as clc from 'colorette';
import { arch, platform } from 'os';
import semver from 'semver';
import { UPDATE_NOTIFICATIONS_OPT_OUT_CONFIG_TAG } from '../commands/config';
import { detectCLIRuntime } from '../utils/runtime-detector';
import {
  version as currentVersion,
  name as packageName,
} from '../utils/version';

const GCS_BUCKET_URL = 'https://storage.googleapis.com/genkit-assets-cli';
const CLI_DOCS_URL = 'https://genkit.dev/docs/devtools/';
const AXIOS_INSTANCE: AxiosInstance = axios.create({
  timeout: 3000,
});

/**
 * Interface for update check result
 */
export interface UpdateCheckResult {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
}

/**
 * Returns the current CLI version, normalized.
 */
export function getCurrentVersion(): string {
  return normalizeVersion(currentVersion);
}

/**
 * Normalizes a version string by removing a leading 'v' if present.
 * @param version - The version string to normalize
 * @returns The normalized version string
 */
function normalizeVersion(version: string): string {
  return version.replace(/^v/, '');
}

/**
 * Interface for the Google Cloud Storage latest.json response
 */
interface GCSLatestResponse {
  channel: string;
  latestVersion: string;
  lastUpdated: string;
  platforms: Record<
    string,
    {
      url: string;
      version: string;
      versionedUrl: string;
    }
  >;
}

/**
 * Interface for npm registry response
 */
interface NpmRegistryResponse {
  'dist-tags': {
    latest: string;
    [key: string]: string;
  };
  versions: Record<string, unknown>;
}

/**
 * Fetches the latest release data from GCS.
 */
async function getGCSLatestData(): Promise<GCSLatestResponse> {
  const response = await AXIOS_INSTANCE.get(`${GCS_BUCKET_URL}/latest.json`);

  if (response.status !== 200) {
    throw new GenkitToolsError(
      `Failed to fetch GCS latest.json: ${response.statusText}`
    );
  }

  return response.data as GCSLatestResponse;
}

/**
 * Gets the latest CLI version from npm registry for non-binary installations.
 * @param ignoreRC - If true, ignore prerelease versions (default: true)
 */
export async function getLatestVersionFromNpm(
  ignoreRC: boolean = true
): Promise<string | null> {
  try {
    const response = await AXIOS_INSTANCE.get(
      `https://registry.npmjs.org/${packageName}`
    );

    if (response.status !== 200) {
      throw new GenkitToolsError(
        `Failed to fetch npm versions: ${response.statusText}`
      );
    }

    const data: NpmRegistryResponse = response.data;

    // Prefer dist-tags.latest if valid and not a prerelease (if ignoreRC)
    const latest = data['dist-tags']?.latest;
    if (latest) {
      const clean = normalizeVersion(latest);
      if (semver.valid(clean) && (!ignoreRC || !semver.prerelease(clean))) {
        return clean;
      }
    }

    // Fallback: find the highest valid version in versions
    const versions = Object.keys(data.versions)
      .map(normalizeVersion)
      .filter((v) => semver.valid(v) && (!ignoreRC || !semver.prerelease(v)));

    if (versions.length === 0) {
      return null;
    }

    // Sort by semver descending (newest first)
    versions.sort(semver.rcompare);
    return versions[0];
  } catch (error: unknown) {
    if (error instanceof GenkitToolsError) {
      throw error;
    }

    throw new GenkitToolsError(
      `Failed to fetch npm versions: ${(error as Error)?.message ?? String(error)}`
    );
  }
}

/**
 * Checks if update notifications are disabled via environment variable or user config.
 */
function isUpdateNotificationsDisabled(): boolean {
  if (process.env.GENKIT_CLI_DISABLE_UPDATE_NOTIFICATIONS === 'true') {
    return true;
  }
  const userSettings = getUserSettings();
  return Boolean(userSettings[UPDATE_NOTIFICATIONS_OPT_OUT_CONFIG_TAG]);
}

/**
 * Gets the latest version and update message for compiled binary installations.
 */
async function getBinaryUpdateInfo(): Promise<string | null> {
  const gcsLatestData = await getGCSLatestData();
  const machine = `${platform}-${arch}`;
  const platformData = gcsLatestData.platforms[machine];

  if (!platformData) {
    logger.debug(`No update information for platform: ${machine}`);
    return null;
  }

  const latestVersion = normalizeVersion(gcsLatestData.latestVersion);
  return latestVersion;
}

/**
 * Gets the latest version and update message for npm installations.
 */
async function getNpmUpdateInfo(): Promise<string | null> {
  const latestVersion = await getLatestVersionFromNpm();
  if (!latestVersion) {
    logger.debug('No available versions found from npm.');
    return null;
  }
  return latestVersion;
}

/**
 * Shows an update notification if a new version is available.
 * This function is designed to be called from the CLI entry point.
 * It can be disabled by the user's configuration or environment variable.
 */
export async function showUpdateNotification(): Promise<void> {
  try {
    if (isUpdateNotificationsDisabled()) {
      return;
    }

    const { isCompiledBinary } = detectCLIRuntime();
    const updateInfo = isCompiledBinary
      ? await getBinaryUpdateInfo()
      : await getNpmUpdateInfo();

    if (!updateInfo) {
      return;
    }

    const latestVersion = updateInfo;
    const current = normalizeVersion(currentVersion);

    if (!semver.valid(latestVersion) || !semver.valid(current)) {
      logger.debug(
        `Invalid semver: current=${current}, latest=${latestVersion}`
      );
      return;
    }

    if (!semver.gt(latestVersion, current)) {
      return;
    }

    // Determine install method and update command for message
    const installMethod = isCompiledBinary
      ? 'installer script'
      : 'your package manager';
    const updateCommand = isCompiledBinary
      ? 'curl -sL cli.genkit.dev | upgrade=true bash'
      : 'npm install -g genkit-cli';

    const updateNotificationMessage =
      `Update available ${clc.gray(`v${current}`)} → ${clc.green(`v${latestVersion}`)}\n` +
      `To update to the latest version using ${installMethod}, run\n${clc.cyan(updateCommand)}\n` +
      `For other CLI management options, visit ${CLI_DOCS_URL}\n` +
      `${clc.dim('Run')} ${clc.bold('genkit config set updateNotificationsOptOut true')} ${clc.dim('to disable these notifications')}\n`;

    logger.info(`\n${updateNotificationMessage}`);
  } catch (e) {
    // Silently fail - update notifications shouldn't break the CLI
    logger.debug('Failed to show update notification', e);
  }
}

```

### Core Architecture Module: `genkit-tools/common/src/utils/analytics.ts`
```
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createInterface } from 'readline/promises';
import { v4 as uuidV4 } from 'uuid';
import type { AnalyticsInfo } from '../types/analytics';
import { configstore, getUserSettings } from './configstore';
import { logger } from './logger';
import { toolsPackage } from './package';

// This code is largely adapted from
// https://github.com/firebase/firebase-tools/blob/master/src/track.ts

export const ANALYTICS_OPT_OUT_CONFIG_TAG = 'analyticsOptOut';

/**
 * The track function accepts this abstract class, but callers should use
 * one of the pre-defined events listed below this class. If you need to add a
 * new event type, add it with the others below.
 */
export abstract class GAEvent {
  // The event name as it will appear in GA.
  // This must be less than 40 characters
  abstract name: string;
  // Additional parameters.
  // ABSOLUTELY NO FREE-FORM OR PII FIELDS
  parameters?: Record<string, string | number | undefined>;
  // Sticky parameters that should be maintained for the duration of the
  // session.
  stickyParameters?: Record<string, string | number | undefined>;
  // Duration in milliseconds. Make sure this is always at least 1 so that the
  // metrics appear in realtime view.
  abstract duration: number;
}

// Add new events here; this way everything's centralized and auditable.

export class PageViewEvent extends GAEvent {
  name = 'page_view';
  duration = 1;

  constructor(page_title: string) {
    super();
    this.parameters = { page_title };
  }
}

export class SelectContentEvent extends GAEvent {
  name = 'select_content';
  duration = 1;

  constructor(content_type: string, content_id: string, page_title: string) {
    super();
    this.parameters = {
      content_type,
      content_id,
      page_title,
    };
  }
}

export class FirstUsageEvent extends GAEvent {
  name = 'first_visit';
  duration = 1;

  constructor() {
    super();
  }
}

export class ToolsRequestEvent extends GAEvent {
  name = 'tools_request';
  duration = 1;

  constructor(route: string) {
    super();
    this.parameters = { route };
  }
}

export class RunCommandEvent extends GAEvent {
  name = 'run_command';
  duration = 1; // Should we actually track command duration?

  constructor(command: string, runtime_type: string, project_runtime?: string) {
    super();
    this.stickyParameters = {
      command,
      runtime_type,
      project_runtime: project_runtime || 'unknown',
    };
  }
}

export class InitEvent extends GAEvent {
  name = 'init';
  duration = 1;

  constructor(
    platform: 'firebase' | 'googlecloud' | 'nodejs' | 'nextjs' | 'go'
  ) {
    super();
    this.parameters = { platform };
  }
}

export class ConfigEvent extends GAEvent {
  name = 'config_set';
  duration = 1;

  constructor(key: 'analyticsOptOut') {
    super();
    this.parameters = { key };
  }
}

/**
 * Main function for recording analytics. This is a no-op if analyitcs are
 * disabled.
 */
export async function record(event: GAEvent): Promise<void> {
  if (!isAnalyticsEnabled()) return;
  await recordInternal(event, getSession());
}

/**
 * Creates a ToolsRequestEvent with validated duration and optional action parameter.
 */
export function createToolsRequestEvent(
  route: string,
  durationMs: number,
  status: string,
  options?: { action?: string; project_runtime?: string }
): ToolsRequestEvent {
  const event = new ToolsRequestEvent(route);
  event.duration = Math.max(1, durationMs);
  event.parameters = {
    ...event.parameters,
    status,
    ...(options?.action && { action: options.action }),
    ...(options?.project_runtime && {
      project_runtime: options.project_runtime,
    }),
  };
  return event;
}

/**
 * Fire-and-forget helper to record a request analytics event with error logging.
 */
export function recordRequestEvent(event: GAEvent): void {
  record(event).catch((err) => {
    logger.error(`Failed to send analytics ${err}`);
  });
}

/**
 * Extracts action type from a request action key.
 */
export function extractActionType(key?: unknown): string {
  const keyStr = typeof key === 'string' ? key : '';
  if (keyStr === '/util/generate' || keyStr === 'util/generate') {
    return keyStr;
  }
  const splits = keyStr.split('/');
  return splits.length > 1 ? splits[1] : 'unknown';
}

/** Displays a notification that analytics are in use. */
export async function notifyAnalyticsIfFirstRun(): Promise<void> {
  if (isAnalyticsOptedOut()) return;

  if (configstore.get(NOTIFICATION_ACKED)) {
    return;
  }

  console.log(ANALYTICS_NOTIFICATION);

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  await readline.question('Press "Enter" to acknowledge and continue');
  readline.close();

  configstore.set(NOTIFICATION_ACKED, true);

  await record(new FirstUsageEvent());
}

/** Gets session information for the UI. */
export function getAnalyticsSettings(): AnalyticsInfo {
  if (!isAnalyticsEnabled()) {
    return { enabled: false };
  }

  const session = getSession();

  return {
    enabled: true,
    property: GA_INFO.property,
    measurementId: GA_INFO.measurementId,
    apiSecret: GA_INFO.apiSecret,
    clientId: session.clientId,
    sessionId: session.sessionId,
    debug: {
      debugMode: isDebugMode(),
      validateOnly: isValidateOnly(),
    },
  };
}

// ===============================================================
// Start internal implementation

const ANALYTICS_NOTIFICATION =
  'Genkit CLI and Developer UI use cookies and ' +
  'similar technologies from Google\nto deliver and enhance the quality of its ' +
  'services and to analyze usage.\n' +
  'Learn more at https://policies.google.com/technologies/cookies\n' +
  '\n' +
  'If running in non-interactive environments set --non-interactive flag. Ex:\n' +
  '  genkit start --non-interactive -- <cmd>\n' +
  'To opt out of analytics run:\n' +
  '  genkit config set analyticsOptOut true\n';
const NOTIFICATION_ACKED = 'analytics_notification';
const CONFIGSTORE_CLIENT_KEY = 'genkit-tools-ga-id';

const GA_INFO = {
  property: 'genkit-tools',
  measurementId: 'G-2K1MPK763J',
  apiSecret: 'UccV7rIoTF6II6E9zYX5Ow',
};
const GA_USER_PROPS = {
  node_platform: {
    value: process.platform,
  },
  node_version: {
    value: process.version,
  },
  tools_version: {
    value: toolsPackage.version,
  },
};

interface AnalyticsSession {
  clientId: string;

  // https://support.google.com/analytics/answer/9191807
  // We treat each CLI invocation as a different session, including any CLI
  // events.
  sessionId: string;
  totalEngagementSeconds: number;
  stickyParameters: Record<string, string | number | undefined>;
}

// Whether the events sent should be tagged so that they are shown in GA Debug
// View in real time (for Googler to debug) and excluded from reports. To
// enable, set the env var GENKIT_GA_DEBUG.
function isDebugMode(): boolean {
  return !!process.env['GENKIT_GA_DEBUG'];
}

// Whether to validate events format instead of collecting them. Should only
// be used to debug the Firebase CLI / Emulator UI itself regarding issues
// with Analytics. To enable, set the env var GENKIT_GA_VALIDATE.
// In the CLI, this is implemented by sending events to the GA4 measurement
// validation API (which does not persist events) and printing the response.
function isValidateOnly(): boolean {
  return !!process.env['GENKIT_GA_VALIDATE'];
}

function isAnalyticsAcknowledged(): boolean {
  return configstore.get(NOTIFICATION_ACKED) === true;
}

function isAnalyticsOptedOut(): boolean {
  return getUserSettings()[ANALYTICS_OPT_OUT_CONFIG_TAG] === true;
}

function isAnalyticsEnabled(): boolean {
  return isAnalyticsAcknowledged() && !isAnalyticsOptedOut();
}

async function recordInternal(
  event: GAEvent,
  session: AnalyticsSession
): Promise<void> {
  Object.assign(session.stickyParameters, event.stickyParameters);
  const joinedParams = { ...session.stickyParameters, ...event.parameters };

  const validate = isValidateOnly();
  const search = `?api_secret=${GA_INFO.apiSecret}&measurement_id=${GA_INFO.measurementId}`;
  const validatePath = isValidateOnly() ? 'debug/' : '';
  const url = `https://www.google-analytics.com/${validatePath}mp/collect${search}`;
  const body = {
    // Get timestamp in millis and append '000' to get micros as string.
    // Not using multiplication due to JS number precision limit.
    timestamp_micros: `${Date.now()}000`,
    client_id: session.clientId,
    user_properties: {
      ...GA_USER_PROPS,
    },
    validationBehavior: validate ? 'ENFORCE_RECOMMENDATIONS' : undefined,
    events: [
      {
        name: event.name,
        params: {
          session_id: session.sessionId,

          // engagement_time_msec and session_id must be set for the activity
          // to display in standard reports like Realtime.
          // https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events?client_type=gtag#optional_parameters_for_reports

          // https://support.google.com/analytics/answer/11109416?hl=en
          // Additional engagement time since last event, in microseconds.
          engagement_time_msec: event.duration
            .toFixed(3)
            .replace('.', '')
            .replace(/^0+/, ''), // trim leading zeros

          // https://support.google.com/analytics/answer/7201382?hl=en
          // To turn debug mode off, `debug_mode
```

### Core Architecture Module: `genkit-tools/common/src/utils/configstore.ts`
```
/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import Configstore from 'configstore';
import { toolsPackage } from './package';

const USER_SETTINGS_TAG = 'userSettings';

export const configstore = new Configstore(toolsPackage.name);

export function getUserSettings(): Record<string, string | boolean | number> {
  return configstore.get(USER_SETTINGS_TAG) || {};
}

export function setUserSettings(s: Record<string, string | boolean | number>) {
  configstore.set(USER_SETTINGS_TAG, s);
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6867** (2026-10-27): **fix(cli): search_genkit_docs crashes on localized description objects and list_genkit_docs exceeds host runtime token limits**
  *Symptoms*: ## Description  1. **`search_genkit_docs` (MCP) and `genkit docs:search` (CLI) crash on every query:**    In `docs-bundle-experimental.json`, 28 `app-frameworks/*.md` entries (7 framework pages across `js`, `go`, `dart`, and `python`) store `doc.description` as a localized language-keyed object rather than a string:    ```json    {      "default": "Build an Angular app powered by Genkit, with streaming structured output and tool calling.",      "js": "Add Genkit to an Angular app with SSR server routes, streaming structured output and tool calling in one project.",      "go": "Connect an Angular UI to your Genkit Go backend and stream the recipe into your UI incrementally.",      "dart": "Connect an Angular UI to your Genkit Dart backend and stream the recipe into your UI incrementally.",      "python": "Connect an Angular UI to your Genkit Python backend and stream the recipe into your UI incrementally."    }    ```    Because `searchDocs()` in [`genkit-tools/cli/src/utils/docs.ts`](https://github.com/firebase/genkit/blob/main/genkit-tools/cli/src/utils/docs.ts) unconditionally calls `(doc.description || '').toLowerCase()` across every document in the target language, every call to `search_genkit_docs` or `genkit docs:search` throws `TypeError: (doc.description || "").toLowerCase is not a function`. Additionally, `list_genkit_docs` and `genkit docs:list` render `Description: [object Object]` for those 28 pages.  2. **`list_genkit_docs` returns a ~135 KB payload that exceeds 

- **Issue #6864** (2026-10-22): **fix(cli): add MCP server instructions and descriptive tool metadata for deferred tool search**
  *Symptoms*: ## Description  Coding agents that defer MCP tool schemas behind dynamic tool search (such as Claude Code's `ToolSearch`) list connected MCP tools **by name only** in the initial context (`<available-deferred-tools>`) and omit individual tool `description`s and `inputSchema`s until the model explicitly queries `ToolSearch`.  In recent evaluations of `genkit mcp` under Claude Code, Sonnet discovered the Genkit MCP server in only 2 of 4 attempts and Haiku in only 6 of 75 attempts.  ### Root Cause  1. **Missing server-level `instructions` (and `description`) in [`genkit-tools/cli/src/mcp/server.ts`](https://github.com/firebase/genkit/blob/main/genkit-tools/cli/src/mcp/server.ts):**    ```ts    const server = new McpServer({      name: 'Genkit MCP',      version: '0.0.2',    });    ```    When `ToolSearch` defers individual tool schemas, the **only** text from an MCP server that Claude Code injects upfront into the system prompt (`# MCP Server Instructions`) is the `instructions` field returned in the `initialize` result (`new McpServer(serverInfo, { instructions })`). Because `server.ts` omits `instructions` (and `description` on `serverInfo`), agents see only bare tool names with zero upfront context on what the Genkit MCP server provides or when to search for its tools. 2. **Generic descriptions on `run_flow` and `get_trace`:**    - [`genkit-tools/cli/src/mcp/flows.ts`](https://github.com/firebase/genkit/blob/main/genkit-tools/cli/src/mcp/flows.ts): `run_flow` uses `descriptio

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

### Incident Patch 1: `1eb9489f` (2026-10-31)
**Commit Message**: chore(py): enforce linked TODOs with Ruff (#6949)

**File**: `.github/workflows/todo-lint.yml` (removed, +0/-83)
```diff
@@ -1,83 +0,0 @@
-# Copyright 2026 Google LLC
-#
-# Licensed under the Apache License, Version 2.0 (the "License");
-# you may not use this file except in compliance with the License.
-# You may obtain a copy of the License at
-#
-#     http://www.apache.org/licenses/LICENSE-2.0
-#
-# Unless required by applicable law or agreed to in writing, software
-# distributed under the License is distributed on an "AS IS" BASIS,
-# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-# See the License for the specific language governing permissions and
-# limitations under the License.
-#
-# SPDX-License-Identifier: Apache-2.0
-
-name: TODO Lint
-
-on:
-  pull_request:
-    branches: [main, next]
-  push:
-    branches: [main, next]
-
-jobs:
-  todo-lint:
-    name: Check TODO Format
-    runs-on: ubuntu-latest
-    steps:
-      - name: Checkout
-        uses: actions/checkout@v4
-
-      - name: Check for plain TODOs without issue links
-        run: |
-          #!/usr/bin/env bash
-          set -euo pipefail
-
-          echo "Checking for TODO comments without issue links..."
-          echo "=============================================="
-
-          # Find all TODOs without proper issue references
-          # Proper formats:
-          #   # TODO(https://github.com/genkit-ai/genkit/issues/1234): Description
-          #   # TODO(#1234): Description
-          # Invalid format:
-          #   # TODO: Description
-          
-          # First, find all TODOs
-          ALL_TODOS=$(grep -rn '#[[:space:]]*TODO' \
-            --include="*.py" \
-            --exclude-dir=".venv" \
-            --exclude-dir=".tox" \
-            --exclude-dir="node_modules" \
-            --exclude-dir=".mypy_cache" \
-            --exclude-dir="__pycache__" \
-            --exclude-dir="dist" \
-            --exclude-dir="build" \
-            py/ 2>/dev/null || true)
-
-          # Filter out valid TODOs (those with issue references)
-          # Valid: TODO(#NNN) or TODO(https://...)
-          BAD_TODOS=$(echo "$ALL_TODOS" | grep -v 'TODO(#[0-9]\+)' | grep -v 'TODO(https://' || true)
-
-          if [ -n "$BAD_TODOS" ]; then
-            echo "❌ Found TODO comments without issue links:"
-            echo ""
-            echo "$BAD_TODOS"
-            echo ""
-            echo "=============================================="
-            echo "TODOs must include a GitHub issue reference for tracking."
-            echo ""
-            echo "Correct formats:"
-            echo "  # TODO(#1234): Description"
-            echo "  # TODO(https://github.com/genkit-ai/genkit/issues/1234): Description"
-            echo ""
-            echo "Wrong format:"
-            echo "  # TODO: Description"
-            echo ""
-            echo "Please create GitHub issues for each TODO and update the format."
-            exit 1
-          fi
-
-          echo "✅ All TODOs have proper issue links!"
```

**File**: `py/pyproject.toml` (modified, +1/-0)
```diff
@@ -236,6 +236,7 @@ select = [
   "S",     # flake8-bandit (security)
   "ASYNC", # flake8-async (async best practices)
   "T20",   # flake8-print (no print statements)
+  "TD",    # flake8-todos (TODO comment formatting and issue links)
   "TID251", # banned-api (see flake8-tidy-imports.banned-api below)
 ]
 
```

---

### Incident Patch 2: `3121f326` (2026-10-31)
**Commit Message**: feat(py)!: Interrupt is a BaseException so tool catch-alls can't skip approval (#6763)

**File**: `py/packages/genkit-fastapi/tests/fastapi_test.py` (modified, +29/-3)
```diff
@@ -28,7 +28,7 @@
 from pydantic import BaseModel, field_validator
 from starlette.exceptions import HTTPException as StarletteHTTPException
 
-from genkit import FlowContext, Genkit, GenkitError, PublicError
+from genkit import FlowContext, Genkit, GenkitError, Interrupt, PublicError
 from genkit.plugin_api import provider_error
 from genkit.web import RequestData
 
@@ -386,6 +386,32 @@ async def boom(_: str) -> None:
     assert 'stack' not in error
 
 
+def test_fastapi_flow_raising_interrupt_returns_500_and_sse_internal_error() -> None:
+    """A flow raising Interrupt (a BaseException) still gets the Genkit 500 body and SSE error frame.
+
+    The action boundary turns it into GenkitError INTERNAL, so the adapter's
+    `except Exception` sees it; without that the run is a bare 500 and the
+    stream a 200 with no error event.
+    """
+    ai = Genkit()
+
+    @ai.flow()
+    async def refund(order_id: str) -> str:
+        raise Interrupt({'reason': 'needs approval', 'order_id': order_id})
+
+    app = FastAPI()
+    app.include_router(serve_flow(refund, base_path='/refund'))
+    client = TestClient(app, raise_server_exceptions=False)
+
+    response = client.post('/refund', json={'data': 'A-17'})
+    assert response.status_code == 500
+    assert response.json() == {'message': 'Internal Error', 'status': 'INTERNAL'}
+
+    response = client.post('/refund', json={'data': 'A-17'}, headers={'Accept': 'text/event-stream'})
+    assert sse_error_event(response.text) == {'message': 'Internal Error', 'status': 'INTERNAL'}
+    assert 'A-17' not in response.text
+
+
 def test_fastapi_context_provider_sees_method_lowercase_headers_and_input() -> None:
     """FastAPI context_provider sees method, lowercase headers, and input."""
     ai = Genkit()
@@ -731,7 +757,7 @@ async def chat(_: str) -> str:
     app = FastAPI()
 
     @app.post('/chat', response_model=None)
-    @genkit_fastapi_handler(ai)
+    @genkit_fastapi_handler(ai)  # pyright: ignore[reportArgumentType]
     def chat_route():
         return chat
 
@@ -747,7 +773,7 @@ def test_fastapi_handler_wrapper_returning_non_action_returns_json_internal_erro
     app = FastAPI()
 
     @app.post('/chat', response_model=None)
-    @genkit_fastapi_handler(ai)
+    @genkit_fastapi_handler(ai)  # pyright: ignore[reportArgumentType]
     async def chat_route():
         return 'not an action'
 
```

**File**: `py/packages/genkit-middleware/src/genkit_middleware/_filesystem.py` (modified, +0/-3)
```diff
@@ -41,7 +41,6 @@
 from pydantic import AliasChoices, BaseModel as PydanticBaseModel, Field
 
 from genkit import (
-    Interrupt,
     Message,
     ModelResponse,
     ModelResponseChunk,
@@ -370,8 +369,6 @@ async def wrap_tool(
 
         try:
             return await next_fn(params, ctx)
-        except Interrupt:
-            raise
         except Exception as exc:
             error_msg = f'Tool "{params.tool.name}" failed: {exc}'
             self._enqueue_parts([Part.from_text(error_msg)])
```

**File**: `py/packages/genkit-middleware/tests/filesystem_test.py` (modified, +25/-0)
```diff
@@ -22,6 +22,10 @@
 import pytest
 from genkit_middleware import Filesystem
 
+from genkit import Interrupt, MultipartToolResponse, Part
+from genkit.middleware import MiddlewareContext, ToolHookParams
+from genkit.model import ToolRequest
+
 # ---------------------------------------------------------------------------
 # Construction / validation
 # ---------------------------------------------------------------------------
@@ -190,3 +194,24 @@ async def test_tools_have_nonempty_descriptions(ctx) -> None:
         fs = Filesystem(root_dir=tmpdir, allow_write_access=True)
         for t in fs.tools(ctx):
             assert t.description, f'{t.name} has empty description'
+
+
+@pytest.mark.asyncio
+async def test_wrap_tool_lets_interrupt_through_without_queueing_an_error(ctx) -> None:
+    """A filesystem tool that pauses still pauses; the error catch-all can't turn it into a message."""
+    with tempfile.TemporaryDirectory() as tmpdir:
+        fs = Filesystem(root_dir=tmpdir, allow_write_access=True)
+        write_file = next(t for t in fs.tools(ctx) if t.name == 'write_file')
+        params = ToolHookParams(
+            tool_request_part=Part(tool_request=ToolRequest(name='write_file', input={'path': 'menu.md'})),
+            tool=write_file.action(),
+        )
+
+        async def needs_approval(_params: ToolHookParams, _ctx: MiddlewareContext) -> MultipartToolResponse:
+            raise Interrupt({'reason': 'confirm overwrite', 'path': 'menu.md'})
+
+        with pytest.raises(Interrupt) as raised:
+            await fs.wrap_tool(params, ctx, needs_approval)
+
+        assert raised.value.metadata == {'reason': 'confirm overwrite', 'path': 'menu.md'}
+        assert fs._message_queue == []  # noqa: SLF001
```

**File**: `py/packages/genkit/src/genkit/_ai/_agents/_runtime.py` (modified, +38/-6)
```diff
@@ -44,7 +44,16 @@
 from genkit._ai._json_patch import diff_json
 from genkit._core._action import ActionRunContext, get_current_context
 from genkit._core._channel import CloseableQueue, QueueShutDown
-from genkit._core._error import GenkitError, GenkitRuntimeError, PublicError, RuntimeErrorReason, StatusName
+from genkit._core._error import (
+    GenkitError,
+    GenkitRuntimeError,
+    Interrupt,
+    PublicError,
+    RuntimeErrorReason,
+    StatusName,
+    TaskGroupError,
+    interrupt_escape_error,
+)
 from genkit._core._logger import get_logger
 from genkit._core._model import (
     AgentInit,
@@ -163,7 +172,15 @@ async def run(
             try:
 
                 async def body(span: SpanContext, turn_input: AgentInput = inp, ctx: TurnContext = turn_ctx) -> object:
-                    turn_result = await fn(turn_input, ctx)
+                    try:
+                        turn_result = await fn(turn_input, ctx)
+                    except (Interrupt, TaskGroupError) as exc:
+                        # No generate loop here to pause. Convert inside the
+                        # span so runTurn-N records the failure.
+                        failure = interrupt_escape_error(exc)
+                        if failure is None:
+                            raise
+                        raise failure from exc
                     finish_reason = turn_result.finish_reason if turn_result else None
                     self.last_turn_finish_reason = finish_reason
                     self.last_turn_error = None
@@ -191,9 +208,18 @@ async def body(span: SpanContext, turn_input: AgentInput = inp, ctx: TurnContext
                 self.last_good_state_version = self.session.version
                 self.last_good_finish_reason = self.last_turn_finish_reason
                 self.turn_index += 1
-            except Exception as exc:
+            except (Exception, Interrupt, TaskGroupError) as exc:
+                # body converts the turn's own Interrupt; this covers one
+                # raised from a hook outside it.
+                failure = interrupt_escape_error(exc)
+                if failure is not None:
+                    turn_error: Exception = failure
+                elif isinstance(exc, Exception):
+                    turn_error = exc
+                else:
+                    raise
                 self.last_turn_finish_reason = AgentFinishReason.FAILED
-                self.last_turn_error = to_error_details(exc)
+                self.last_turn_error = to_error_details(turn_error)
 
                 if self.on_end_turn is not None:
                     await self.on_end_turn(AgentFinishReason.FAILED)
@@ -878,8 +904,14 @@ async def run_agent_loop() -> None:
                     coro=fn(self.session_runner, action_ctx),
                 )
                 result_holder.append(result)
-            except Exception as e:  # noqa: BLE001
-                err_holder.append(e)
+            except (Exception, Interrupt, TaskGroupError) as e:  # noqa: BLE001
+                failure = interrupt_escape_error(e)
+                if failure is not None:
+                    err_holder.append(failure)
+                elif isinstance(e, Exception):
+                    err_holder.append(e)
+                else:
+                    raise
             finally:
                 # Synchronously close self.turn_inputs to signal turn completion,
                 # letting SessionRunner stop waiting for more inputs.
```

**File**: `py/packages/genkit/src/genkit/_ai/_generate.py` (modified, +24/-17)
```diff
@@ -53,6 +53,7 @@
     normalize_pending_content,
     parts_to_wire,
     restart_interrupt_error,
+    run_restarted_tool,
     run_tool_after_restart,
     run_tool_request,
 )
@@ -112,6 +113,13 @@
 
 DEFAULT_MAX_TURNS = 50
 
+# Interrupt is a BaseException so a tool's `except Exception` can't swallow it.
+# The engine still catches it wherever a raise becomes a result.
+TOOL_RAISES = (Exception, Interrupt)
+# What a hook or model can raise that becomes a FAILED turn (#6255). A
+# foreign CancelledError is re-raised by raise_if_foreign_cancel.
+TURN_FAILURES = (Exception, Interrupt, asyncio.CancelledError)
+
 logger = get_logger(__name__)
 
 T = TypeVar('T')
@@ -1415,7 +1423,7 @@ def remember_response(result: object) -> None:
             ),
             name=resolved.model.name,
         )
-    except (Exception, asyncio.CancelledError) as exc:
+    except TURN_FAILURES as exc:
         raise_if_foreign_cancel(exc=exc, abort_signal=ctx.abort_signal)
         # A hook can raise before the model ever built a request. Build it here
         # so the caller still gets back what they asked for; the cost is only
@@ -1503,7 +1511,7 @@ async def generate_turn(
             mw_pipeline=mw_pipeline,
             current_turn=current_turn,
         )
-    except (Exception, asyncio.CancelledError) as exc:
+    except TURN_FAILURES as exc:
         raise_if_foreign_cancel(exc=exc, abort_signal=ctx.abort_signal)
         return box_from_exc(
             response=call.earned(),
@@ -1785,7 +1793,7 @@ async def run_tools_or_stop(
             mw_pipeline=mw_pipeline,
             tools=resolved.tools,
         )
-    except (Exception, asyncio.CancelledError) as exc:
+    except TURN_FAILURES as exc:
         raise_if_foreign_cancel(exc=exc, abort_signal=ctx.abort_signal)
         return box_from_exc(
             response=response,
@@ -2174,7 +2182,7 @@ async def next_fn(p: ToolHookParams, c: MiddlewareContext) -> MultipartToolRespo
             else:
                 multipart = as_multipart_tool_response(await next_fn(params, ctx), tool_name=trp.tool_request.name)
             return (multipart, None)
-        except Exception as e:
+        except TOOL_RAISES as e:
             # Interrupts (raised by the tool body or by middleware) become a
             # tool-request Part with interrupt metadata.  Any tracing span is the
             # middleware's responsibility (e.g. ToolApproval wraps its raise in
@@ -2239,7 +2247,7 @@ def to_pending_response(request: Part, response: Part) -> Part:
     )
 
 
-def interrupt_from_exc(exc: Exception) -> Interrupt | None:
+def interrupt_from_exc(exc: BaseException) -> Interrupt | None:
     """If ``exc`` is an Interrupt, or was raised from one, return it.
 
     A tool that pauses again on restart is still an interrupt the caller
@@ -2545,7 +2553,7 @@ async def resolve_resumed_tool(
                 restart_trp=restart_trp,
                 mw_pipeline=mw_pipeline,
             )
-        except Exception as e:
+        except TOOL_RAISES as e:
             intr = interrupt_from_exc(e)
             if intr is not None:
                 return (interrupt_request_part(tool_req_root, intr), None)
@@ -2605,7 +2613,9 @@ async def run_restart(
     )
 
     async def next_fn(p: ToolHookParams, ctx: MiddlewareContext) -> MultipartToolResponse:
-        executed = await run_tool_after_restart(tool=p.tool, restart_trp=p.tool_request_part, ctx=ctx)
+        # A second Interrupt stays raw through the chain so a middleware
+        # `except Exception` can't swallow it; converted below.
+        executed = await run_restarted_tool(tool=p.tool, restart_trp=p.tool_request_part, ctx=ctx)
         if executed.tool_response is None:
             raise GenkitError(status='INTERNAL', message='Expected a tool response part')
         raw_content = executed.tool_response.content or []
@@ -2625,18 +2635,15 @@ async def next_fn(p: ToolHookParams, ctx: MiddlewareContext) -> MultipartToolRes
             ),
             tool_name=tool_req.name,
         )
-    except Exception as e:
+    except TOOL_RAISES as e:
         intr = interrupt_from_exc(e)
         if intr is not None:
-            # run_tool_after_restart already logged when the tool body interrupted.
-            # wrap_tool can raise Interrupt itself; that's the only interrupt path.
-            if not isinstance(e, GenkitError):
-                logger.debug(
-                    'restarted tool triggered an interrupt',
-                    tool=tool_req.name,
-                )
-            # wrap_tool paused again. generate turns this into the same
-            # INTERRUPTED they already know how to answer.
+            # The tool body or wrap_tool paused again. generate turns this
+            # into the same INTERRUPTED they already know how to answer.
+            logger.debug(
+                'restarted tool triggered an interrupt',
+                tool=tool_req.name,
+            )
             raise restart_interrupt_error(intr) 
```

**File**: `py/packages/genkit/src/genkit/_ai/_tools.py` (modified, +19/-5)
```diff
@@ -364,18 +364,32 @@ async def run_tool_after_restart(
     Sets the same context variables as the tool wrapper so ToolContext reflects
     a resumed run. A tool cannot raise another interrupt while it is being restarted.
     """
-    tool_req = restart_trp.tool_request
-    if tool_req is None:
-        raise ValueError('run_tool_after_restart needs a tool request part')
     try:
-        raw = await run_tool_request(tool=tool, tool_request_part=restart_trp, ctx=ctx)
+        return await run_restarted_tool(tool=tool, restart_trp=restart_trp, ctx=ctx)
     except Interrupt as e:
         logger.debug(
             'restarted tool triggered an interrupt',
-            tool=tool_req.name,
+            tool=restart_trp.tool_request.name if restart_trp.tool_request else tool.name,
         )
         raise restart_interrupt_error(e) from e
 
+
+async def run_restarted_tool(
+    *,
+    tool: Action,
+    restart_trp: Part,
+    ctx: MiddlewareContext | None = None,
+) -> Part:
+    """Like ``run_tool_after_restart``, but a second Interrupt propagates as is.
+
+    run_restart calls this inside the wrap_tool chain. Converting the Interrupt
+    there would hand middleware an Exception its catch-all could swallow,
+    skipping the approval the restart is asking for.
+    """
+    tool_req = restart_trp.tool_request
+    if tool_req is None:
+        raise ValueError('run_tool_after_restart needs a tool request part')
+    raw = await run_tool_request(tool=tool, tool_request_part=restart_trp, ctx=ctx)
     envelope = as_multipart_tool_response(raw, tool_name=tool_req.name)
     return Part(
         tool_response=ToolResponse(
```

**File**: `py/packages/genkit/src/genkit/_core/_action.py` (modified, +33/-1)
```diff
@@ -46,7 +46,15 @@
 
 from genkit._core._channel import CloseableQueue, mirror_result, start_stream
 from genkit._core._compat import StrEnum
-from genkit._core._error import GenkitError, Interrupt, RuntimeErrorReason, mark_request_error
+from genkit._core._error import (
+    GenkitError,
+    Interrupt,
+    RuntimeErrorReason,
+    TaskGroupError,
+    interrupt_escape_error,
+    interrupt_outside_tool_error,
+    mark_request_error,
+)
 from genkit._core._model import (
     EmbedRequest,
     ModelRequest,
@@ -804,6 +812,11 @@ def create_action_key(kind: ActionKind | str, name: str) -> str:
 # server calling a nested action wrong, not the HTTP caller's request.
 _inside_action: ContextVar[bool] = ContextVar('inside_action', default=False)
 
+# True while a tool body runs, including actions it calls. An Interrupt from a
+# flow the tool calls has to reach generate's tool loop as an Interrupt, so only
+# an action with no tool above it turns one into an error.
+_inside_tool: ContextVar[bool] = ContextVar('inside_tool', default=False)
+
 
 def _request_error(error: GenkitError) -> GenkitError:
     """Mark an input/init failure as the caller's request only on the outermost action."""
@@ -1401,6 +1414,7 @@ async def body(span: SpanContext) -> OutputT:
             if on_trace_start:
                 await on_trace_start(trace_id, span_id)
 
+            tool_token = _inside_tool.set(True) if self._kind == ActionKind.TOOL else None
             try:
                 if execute is not None:
                     output = await execute()
@@ -1409,7 +1423,25 @@ async def body(span: SpanContext) -> OutputT:
             except Interrupt as e:
                 if e.metadata:
                     span.set_metadata({'interrupt': e.metadata})
+                # Only generate's tool loop turns an Interrupt into a pause.
+                # With no tool above, it is a BaseException that `except
+                # Exception` handlers (web adapters, agent transports) would
+                # miss, so it becomes an error. Under a tool (a flow the tool
+                # calls) it stays raw, so the tool's own catch-all can't
+                # swallow the approval.
+                if self._kind != ActionKind.TOOL and not _inside_tool.get():
+                    raise interrupt_outside_tool_error(e) from e
                 raise
+            except TaskGroupError as e:
+                # asyncio.TaskGroup / anyio wrap a child's Interrupt in a
+                # BaseExceptionGroup, which every `except Exception` misses.
+                failure = interrupt_escape_error(e)
+                if failure is None:
+                    raise
+                raise failure from e
+            finally:
+                if tool_token is not None:
+                    _inside_tool.reset(tool_token)
             if self._strict_io:
                 output = self._validate_output(output)
             latency_ms = (time.perf_counter() - start_time) * 1000
```

**File**: `py/packages/genkit/src/genkit/_core/_error.py` (modified, +79/-5)
```diff
@@ -16,6 +16,8 @@
 
 """Error classes and utilities for the Genkit framework."""
 
+import builtins
+import importlib
 import math
 import reprlib
 import time
@@ -349,15 +351,24 @@ class ErrorResponseMetadata(TypedDict, total=False):
     headers: dict[str, str]
 
 
-class Interrupt(Exception):  # noqa: N818 - public Genkit name; not renamed *Error for style
-    """Pause a tool or generate so the caller can approve, reply, or restart.
+class Interrupt(BaseException):
+    """Pause a tool so the caller can approve, reply, or restart.
 
     Raise ``Interrupt(metadata)`` from a tool or from tool middleware.
-    Tracing treats this as control flow, not a failed span.
+    It is a control-flow signal like ``asyncio.CancelledError``, so it
+    subclasses ``BaseException``: an ``except Exception`` in tool code can't
+    swallow it and skip the approval. Catch ``Interrupt`` by name if a tool
+    needs to clean up, then re-raise. Raised anywhere else (a flow, an
+    agent turn body), the action fails with ``GenkitError`` INTERNAL.
+    Tracing treats it as control flow, not a failed span.
     """
 
     def __init__(self, metadata: dict[str, Any] | None = None) -> None:
-        super().__init__()
+        # Metadata goes in args so str(interrupt) and tracebacks show it.
+        if metadata is None:
+            super().__init__()
+        else:
+            super().__init__(metadata)
         self.metadata: dict[str, Any] = {} if metadata is None else metadata
 
 
@@ -604,6 +615,69 @@ def provider_error(
     return mark_provider_error(error=result)
 
 
+def interrupt_outside_tool_error(interrupt: Interrupt) -> GenkitError:
+    """The error an Interrupt becomes when it escapes something that isn't a tool.
+
+    Only generate's tool loop can turn an Interrupt into a pause. Anywhere
+    else it would escape ``except Exception`` handlers as a bare
+    BaseException, so the action boundary and the agent turn loop report it
+    as a failed run instead. ``cause`` keeps the metadata for debugging.
+    """
+    error = GenkitError(status='INTERNAL', message='Interrupt raised outside a tool', cause=interrupt)
+    error.__cause__ = interrupt
+    return error
+
+
+class _NoTaskGroupError(BaseException):
+    """Never raised; stands in when no task-group exception type exists."""
+
+
+def _task_group_error() -> type[BaseException]:
+    builtin = getattr(builtins, 'BaseExceptionGroup', None)  # 3.11+
+    if builtin is not None:
+        return builtin
+    # 3.10 has no asyncio.TaskGroup; anyio task groups raise the
+    # `exceptiongroup` backport, which anyio installs there.
+    try:
+        backport = importlib.import_module('exceptiongroup')
+    except ImportError:
+        return _NoTaskGroupError
+    return backport.BaseExceptionGroup
+
+
+# What asyncio.TaskGroup / anyio raise when a child task raises a
+# BaseException. An Interrupt in a child task arrives wrapped in one of these.
+TaskGroupError: type[BaseException] = _task_group_error()
+
+
+def _group_has_interrupt(exc: BaseException) -> bool:
+    if isinstance(exc, Interrupt):
+        return True
+    children = getattr(exc, 'exceptions', None) if isinstance(exc, TaskGroupError) else None
+    return any(_group_has_interrupt(child) for child in children or ())
+
+
+def interrupt_escape_error(exc: BaseException) -> GenkitError | None:
+    """The failure for an Interrupt that reached a boundary that can't pause on it.
+
+    Returns None when ``exc`` carries no Interrupt, so the caller re-raises it
+    as is. An Interrupt inside a task group can't pause generate: the group may
+    also hold other failures, and there's no single interrupt to answer. It
+    fails the run, as it did when Interrupt was an Exception.
+    """
+    if isinstance(exc, Interrupt):
+        return interrupt_outside_tool_error(exc)
+    if isinstance(exc, TaskGroupError) and _group_has_interrupt(exc):
+        error = GenkitError(
+            status='INTERNAL',
+            message='Interrupt raised inside a task group',
+            cause=exc,
+        )
+        error.__cause__ = exc
+        return error
+    return None
+
+
 class PublicError(GenkitError):
     """Error class for issues to be returned to users.
 
@@ -799,7 +873,7 @@ def get_error_stack(error: object) -> str | None:
     Returns:
         The stack trace string if available, None otherwise.
     """
-    if isinstance(error, Exception):
+    if isinstance(error, BaseException):
         # Stack traces are valuable for debugging; consider making this configurable
         # to enable them in development/staging and suppress in production.
         # For now, return an empty string to keep Dev UI clean as per requirements.
```

#### Recent Merged Pull Requests:
- **PR #6963** (2026-10-30): fix(js/plugins/google-genai): JSON output, usage and store on Interactions (@ifielker)
- **PR #6962** (2026-10-29): docs(py): clarify dynamic model resolution in genkit and genkit-google-genai docstrings (@MichaelDoyle)
- **PR #6960** (2026-10-30): ci(py): run deptry on genkit-mcp (@hilariie)
- **PR #6959** (2026-10-30): feat(py/plugins/mcp): accept disabled in mcpServers entries (@hilariie)
- **PR #6955** (closed): chore(deps): bump @hono/node-server from 1.19.11 to 2.1.3 in /js (@dependabot[bot])
- **PR #6950** (2026-10-29): ci(global): cancel superseded PR workflow runs (@FOWEPJF255)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
