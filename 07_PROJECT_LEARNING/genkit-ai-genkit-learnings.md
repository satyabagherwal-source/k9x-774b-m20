> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/genkit-ai-genkit-learnings.md`  
> **Source**: github ([https://github.com/genkit-ai/genkit](https://github.com/genkit-ai/genkit))  
> **Source Version**: `6aab26ea`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-05T08:42:43.169Z  
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
> **Harvest Timestamp**: 2026-11-05T08:40:20.069Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `genkit-ai/genkit`
- **Description**: Open-source framework for building agentic apps in JavaScript, Go, Dart, and Python, built and used in production by Google
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6566 stars

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
import {
  SUPPORTED_DOC_LANGUAGES,
  detectProjectLanguage,
  type SupportedDocLanguage,
} from '../utils/docs';
import { startDevProcessManager, startManager } from '../utils/manager-utils';

export {
  SUPPORTED_DOC_LANGUAGES,
  detectProjectLanguage,
  type SupportedDocLanguage,
};

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

import { randomUUID } from 'crypto';
import { createInterface } from 'readline/promises';
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
- **Issue #6994** (2026-11-01): **[Go] Filesystem middleware: queued read_file injection breaks interrupt resume — "cannot resume generation unless the last message is by a model"**
  *Symptoms*: **Describe the bug**  The `Filesystem` middleware queues `read_file`'s file contents and appends them to `params.Request.Messages` as a user message at the **entry of the next Generate**. When a Generate ends with an interrupt (e.g. a `ToolApproval` hold) while an injection is still queued, the resume Generate injects that user message at its entry — **after** the model message carrying the tool requests. The turn-0 resume validation in `handleResumeOption` then fails, because it validates against the hook-revised message list (`turnOpts.Messages = req.Messages`):  ``` FAILED_PRECONDITION: handleResumeOption: cannot resume generation unless the last message is by a model with at least one tool request ```  The injected message already carries the `filesystemMiddlewareTool` metadata, but the resume validation does not skip it (unlike the `ToolApproval` judge, which deliberately does).  **To Reproduce**  Self-contained program below — no API key, no network: a stub OpenAI-compatible server scripts the model to answer one response with two parallel tool calls (`read_file go.mod`, pre-approved, runs and queues its contents; `edit_file go.mod`, held by `ToolApproval`). The caller then approves and resumes the edit.  ``` go mod tidy && go run . ```  Observed on genkit v1.14.0:  ``` handleResumeOption: cannot resume generation unless the last message is by a model with at least one tool request exit status 1 ```  Setting `applyWorkaround = true` in the same program (strip the messag

- **Issue #6867** (2026-10-27): **fix(cli): search_genkit_docs crashes on localized description objects and list_genkit_docs exceeds host runtime token limits**
  *Symptoms*: ## Description  1. **`search_genkit_docs` (MCP) and `genkit docs:search` (CLI) crash on every query:**    In `docs-bundle-experimental.json`, 28 `app-frameworks/*.md` entries (7 framework pages across `js`, `go`, `dart`, and `python`) store `doc.description` as a localized language-keyed object rather than a string:    ```json    {      "default": "Build an Angular app powered by Genkit, with streaming structured output and tool calling.",      "js": "Add Genkit to an Angular app with SSR server routes, streaming structured output and tool calling in one project.",      "go": "Connect an Angular UI to your Genkit Go backend and stream the recipe into your UI incrementally.",      "dart": "Connect an Angular UI to your Genkit Dart backend and stream the recipe into your UI incrementally.",      "python": "Connect an Angular UI to your Genkit Python backend and stream the recipe into your UI incrementally."    }    ```    Because `searchDocs()` in [`genkit-tools/cli/src/utils/docs.ts`](https://github.com/firebase/genkit/blob/main/genkit-tools/cli/src/utils/docs.ts) unconditionally calls `(doc.description || '').toLowerCase()` across every document in the target language, every call to `search_genkit_docs` or `genkit docs:search` throws `TypeError: (doc.description || "").toLowerCase is not a function`. Additionally, `list_genkit_docs` and `genkit docs:list` render `Description: [object Object]` for those 28 pages.  2. **`list_genkit_docs` returns a ~135 KB payload that exceeds 

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

### Incident Patch 1: `b1aff696` (2026-11-05)
**Commit Message**: fix(py): a failing tool cancels and awaits the other tools in its turn (#6952)

**File**: `py/packages/genkit/src/genkit/_ai/_generate.py` (modified, +169/-26)
```diff
@@ -680,7 +680,7 @@ def augment_with_context(
 
 def raise_if_aborted(abort_signal: asyncio.Event) -> None:
     if abort_signal.is_set():
-        raise GenkitError(status='ABORTED', message='Generation aborted.')
+        raise GenkitError(status='CANCELLED', message='Generation aborted.')
 
 
 def define_generate_action(ai: _aio.Genkit) -> None:
@@ -852,6 +852,9 @@ async def run_generate(
             current_turn=current_turn,
             call=call,
         )
+    except asyncio.CancelledError as exc:
+        stamp_cancelled_error(exc=exc, messages=call.messages)
+        raise
     except (Exception, _StreamingCallbackError) as exc:
         if streaming_callback_cause(exc=exc) is None:
             raise
@@ -1271,10 +1274,34 @@ def log_dropped_failure(exc: BaseException, *, model: str | None = None, tool: s
     logger.error('%s raised, returning finish_reason=failed', culprit, exc_info=exc, **fields)
 
 
-def raise_if_foreign_cancel(*, exc: BaseException, abort_signal: asyncio.Event) -> None:
+def stamp_cancelled_error(
+    *,
+    exc: asyncio.CancelledError,
+    messages: list[Message],
+) -> None:
+    """Attach the closed history onto a foreign CancelledError as ``messages``.
+
+    The history ends at the last completed round. The unfinished turn is
+    dropped, as on a failed or aborted response. Only the exception is
+    stamped, never the current task: a long-lived caller task would carry
+    stale history into later calls. Read it back with
+    ``genkit._core._compat.cancelled_history``, which handles 3.10 re-raising
+    a fresh ``CancelledError`` on await.
+    """
+    exc.__dict__['messages'] = [as_message(m) for m in messages]
+
+
+def raise_if_foreign_cancel(
+    *,
+    exc: BaseException,
+    abort_signal: asyncio.Event,
+    messages: list[Message] | None = None,
+) -> None:
     # abort_signal is our own stop. A wait_for / task.cancel() has to
     # surface as CancelledError so the deadline still works.
     if isinstance(exc, asyncio.CancelledError) and not abort_signal.is_set():
+        if messages is not None:
+            stamp_cancelled_error(exc=exc, messages=messages)
         raise
 
 
@@ -1506,7 +1533,11 @@ def remember_response(result: object) -> None:
             name=resolved.model.name,
         )
     except TURN_FAILURES as exc:
-        raise_if_foreign_cancel(exc=exc, abort_signal=ctx.abort_signal)
+        raise_if_foreign_cancel(
+            exc=exc,
+            abort_signal=ctx.abort_signal,
+            messages=call.messages,
+        )
         # A hook can raise before the model ever built a request. Build it here
         # so the caller still gets back what they asked for; the cost is only
         # paid on the failure path.
@@ -1595,7 +1626,11 @@ async def generate_turn(
             current_turn=current_turn,
         )
     except TURN_FAILURES as exc:
-        raise_if_foreign_cancel(exc=exc, abort_signal=ctx.abort_signal)
+        raise_if_foreign_cancel(
+            exc=exc,
+            abort_signal=ctx.abort_signal,
+            messages=call.messages,
+        )
         return box_from_exc(
             response=call.earned(),
             messages=call.messages,
@@ -1879,7 +1914,11 @@ async def run_tools_or_stop(
             on_tool_chunk=make_tool_chunk_streamer(chunks=chunks, ctx=ctx),
         )
     except TURN_FAILURES as exc:
-        raise_if_foreign_cancel(exc=exc, abort_signal=ctx.abort_signal)
+        raise_if_foreign_cancel(
+            exc=exc,
+            abort_signal=ctx.abort_signal,
+            messages=list(options.messages),
+        )
         return box_from_exc(
             response=response,
             messages=list(options.messages),
@@ -2283,7 +2322,10 @@ async def next_fn(p: ToolHookParams, c: MiddlewareContext) -> MultipartToolRespo
             logger.debug('tool triggered an interrupt', tool=trp.tool_request.name)
             return (None, interrupt_request_part(trp, intr))
 
-    outs = await asyncio.gather(*[run_one_tool(tool, trp) for _, tool, trp in work])
+    outs = await gather_turn(
+        [run_one_tool(tool, trp) for _, tool, trp in work],
+        watched_abort=mw_pipeline.ctx.abort_signal,
+    )
 
     has_interrupts = False
     response_parts: list[Part] = []
@@ -2314,6 +2356,70 @@ async def next_fn(p: ToolHookParams, c: MiddlewareContext) -> MultipartToolRespo
     return (None, Message(role=Role.TOOL, content=response_parts))
 
 
+async def gather_turn(
+    coros: Sequence[Awaitable[T]],
+    *,
+    watched_abort: asyncio.Event | None,
+) -> list[T]:
+    """Run one turn's tools concurrently. If one fails or cancels, cancel and await the rest.
+
+    ``asyncio.gather`` raises the first failure but leaves the other tools
+    running, so they would keep committing side effects after generate
+    returned. It also cancels all children directly on outer cancellation
+    before ``except`` runs, which would deliver a second cancel during
+    ``finally`` cleanup. ``asyncio.w
```

**File**: `py/packages/genkit/src/genkit/_core/_compat.py` (modified, +33/-1)
```diff
@@ -19,7 +19,7 @@
 import asyncio
 import functools
 import sys
-from typing import Any, TypeVar, overload as overload
+from typing import TYPE_CHECKING, Any, TypeVar, overload as overload
 
 # StrEnum - use strenum package for cross-version compatibility
 # Note: StrEnum was added to stdlib in Python 3.11, but we use strenum for 3.10 compat
@@ -31,9 +31,41 @@
     from strenum import StrEnum as StrEnum  # noqa: E402
 from typing_extensions import override as override  # noqa: E402
 
+if TYPE_CHECKING:
+    from genkit._core._model import Message
+
 _T = TypeVar('_T')
 
 
+def cancelled_history(exc: BaseException) -> 'list[Message] | None':
+    """Return the history that generate attached to a cancel, or None.
+
+    On a foreign cancel, generate sets ``messages`` on the ``CancelledError``
+    it re-raises: the history up to the last completed round, with no
+    partial turn.
+
+    - Direct ``task.cancel()`` on 3.11+ re-raises that same ``CancelledError``.
+    - ``asyncio.wait_for`` and ``asyncio.timeout`` raise ``TimeoutError``
+      (``asyncio.TimeoutError`` on 3.10) with the ``CancelledError`` on
+      ``__cause__``.
+    - On 3.10, each task hop raises a fresh ``CancelledError`` with the
+      previous one on ``__context__``.
+    """
+    cur: BaseException | None = exc
+    seen: set[int] = set()
+    while cur is not None and id(cur) not in seen:
+        seen.add(id(cur))
+        if isinstance(cur, (TimeoutError, asyncio.TimeoutError)):
+            cur = cur.__cause__
+            continue
+        if isinstance(cur, asyncio.CancelledError) and 'messages' in cur.__dict__:
+            return cur.__dict__['messages']
+        if sys.version_info >= (3, 11):
+            return None
+        cur = cur.__context__
+    return None
+
+
 def _wake_waiter(waiter: asyncio.Future[None], _task: object) -> None:
     """Resolve ``waiter`` once when the watched task finishes."""
     if not waiter.done():
```

**File**: `py/packages/genkit/tests/genkit/ai/generate_test.py` (modified, +694/-0)
```diff
@@ -33,6 +33,7 @@
 )
 from genkit._ai._model import text_from_content, text_from_message
 from genkit._ai._tools import Interrupt, ToolContext, define_tool
+from genkit._core._compat import cancelled_history
 from genkit._core._error import ErrorReason, GenkitError, PublicError, _StreamingCallbackError
 from genkit._core._middleware import _MiddlewareMetadata
 from genkit._core._model import GenerateActionOptions, ModelRequest, Resume
@@ -2485,6 +2486,303 @@ async def tool_c() -> str:
     ]
 
 
+def _model_calls_tools(*names: str) -> ModelResponse:
+    return ModelResponse(
+        finish_reason=FinishReason.STOP,
+        message=Message(
+            role=Role.MODEL,
+            content=[Part(tool_request=ToolRequest(name=n, ref=f'ref-{n}', input={})) for n in names],
+        ),
+    )
+
+
+@pytest.mark.asyncio
+async def test_failing_tool_cancels_and_awaits_other_tools_in_turn() -> None:
+    """One tool fails: the other is cancelled before generate returns and never commits."""
+    ai = Genkit()
+    pm, _ = define_scripted_model(ai)
+    charges: list[str] = []
+    charge_started = asyncio.Event()
+    charge_cancelled = asyncio.Event()
+
+    @ai.tool(name='check_allergens')
+    async def check_allergens() -> str:
+        await charge_started.wait()
+        raise GenkitError(status='UNAVAILABLE', message='allergen db down')
+
+    @ai.tool(name='charge_card')
+    async def charge_card() -> str:
+        charge_started.set()
+        try:
+            await asyncio.sleep(0.05)
+        except asyncio.CancelledError:
+            charge_cancelled.set()
+            raise
+        charges.append('order-42')
+        return 'charged'
+
+    pm.responses.append(_model_calls_tools('check_allergens', 'charge_card'))
+
+    response = await generate_action(
+        CallScope(ai),
+        GenerateActionOptions(
+            model='scriptedModel',
+            messages=[Message(role=Role.USER, content=[Part.from_text('order')])],
+            tools=['check_allergens', 'charge_card'],
+        ),
+    )
+
+    assert response.error is not None
+    assert response.error.message == 'allergen db down'
+    assert charge_cancelled.is_set()
+    await asyncio.sleep(0.1)
+    assert charges == []
+
+
+@pytest.mark.asyncio
+async def test_abort_during_parallel_tools_lets_each_cleanup_finish() -> None:
+    """Abort while two tools run: each finally completes before generate returns (no second cancel)."""
+    ai = Genkit(model='scriptedModel')
+    pm, _ = define_scripted_model(ai)
+    abort_signal = asyncio.Event()
+    started: list[str] = []
+    both_started = asyncio.Event()
+    released: list[str] = []
+
+    async def hold(name: str, cleanup_s: float) -> str:
+        started.append(name)
+        if len(started) == 2:
+            both_started.set()
+        try:
+            # Ignores abort_signal; execute_tool_request's watcher cancels it.
+            await asyncio.sleep(10)
+        finally:
+            await asyncio.sleep(cleanup_s)
+            released.append(name)
+        return 'held'
+
+    @ai.tool(name='hold_table')
+    async def hold_table() -> str:
+        return await hold('table', 0)
+
+    @ai.tool(name='hold_inventory')
+    async def hold_inventory() -> str:
+        return await hold('inventory', 0.05)
+
+    pm.responses = [_model_calls_tools('hold_table', 'hold_inventory')]
+
+    task = asyncio.create_task(
+        generate_action(
+            CallScope(ai),
+            GenerateActionOptions(
+                model='scriptedModel',
+                messages=[Message(role=Role.USER, content=[Part.from_text('book')])],
+                tools=['hold_table', 'hold_inventory'],
+            ),
+            abort_signal=abort_signal,
+        )
+    )
+    await asyncio.wait_for(both_started.wait(), timeout=2.0)
+    abort_signal.set()
+    response = await asyncio.wait_for(task, timeout=2.0)
+
+    assert response.finish_reason == FinishReason.ABORTED
+    assert sorted(released) == ['inventory', 'table']
+
+
+@pytest.mark.asyncio
+async def test_failed_tool_turn_leaves_no_unretrieved_task_exceptions() -> None:
+    """A sibling that fails during teardown is retrieved; the first failure is the one raised."""
+    loop = asyncio.get_running_loop()
+    reported: list[dict[str, Any]] = []
+    previous = loop.get_exception_handler()
+    loop.set_exception_handler(lambda _loop, context: reported.append(context))
+    try:
+        ai = Genkit()
+        pm, _ = define_scripted_model(ai)
+        void_started = asyncio.Event()
+
+        @ai.tool(name='check_allergens')
+        async def check_allergens() -> str:
+            await void_started.wait()
+            raise GenkitError(status='UNAVAILABLE', message='allergen db down')
+
+        void_cleaned_up = asyncio.Event()
+
+        @ai.tool(name='void_order')
+        async def void_order() -> str:
+            void_started.set()
+            try:
+                await asyncio.sleep(10)
+            except asyncio.Can
```

**File**: `py/packages/genkit/tests/genkit/ai/tool_cancel_cleanup_test.py` (added, +356/-0)
```diff
@@ -0,0 +1,356 @@
+# Copyright 2026 Google LLC
+#
+# Licensed under the Apache License, Version 2.0 (the "License");
+# you may not use this file except in compliance with the License.
+# You may obtain a copy of the License at
+#
+#     http://www.apache.org/licenses/LICENSE-2.0
+#
+# Unless required by applicable law or agreed to in writing, software
+# distributed under the License is distributed on an "AS IS" BASIS,
+# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+# See the License for the specific language governing permissions and
+# limitations under the License.
+#
+# SPDX-License-Identifier: Apache-2.0
+
+"""Tests for async cleanup and exception retrieval when tool execution is cancelled."""
+
+from __future__ import annotations
+
+import asyncio
+import contextlib
+import gc
+from collections.abc import AsyncIterator
+from typing import Any
+
+import pytest
+
+from genkit import FinishReason, Genkit, GenkitError, Message, ModelResponse, Part, Role
+from genkit._ai._generate import execute_tool_request, resolve_tool
+from genkit._ai._tools import Interrupt
+from genkit._core._middleware import MiddlewareContext
+from genkit.model import ToolRequest
+from genkit.testing import define_scripted_model
+
+
+def _model_calls_tool(*, name: str, ref: str) -> ModelResponse:
+    return ModelResponse(
+        finish_reason=FinishReason.STOP,
+        message=Message(
+            role=Role.MODEL,
+            content=[Part(tool_request=ToolRequest(name=name, input={}, ref=ref))],
+        ),
+    )
+
+
+@pytest.mark.asyncio
+async def test_execute_tool_request_cancel_awaits_async_context_manager_cleanup() -> None:
+    """Cancelling execute_tool_request awaits the tool's async context manager teardown before unwinding."""
+    ai = Genkit()
+    lease_events: list[str] = []
+    acquired = asyncio.Event()
+
+    @contextlib.asynccontextmanager
+    async def inventory_lease() -> AsyncIterator[None]:
+        lease_events.append('acquired')
+        acquired.set()
+        try:
+            yield
+        finally:
+            await asyncio.sleep(0)
+            await asyncio.sleep(0)
+            lease_events.append('released')
+
+    @ai.tool(name='hold_inventory')
+    async def hold_inventory() -> str:
+        async with inventory_lease():
+            await asyncio.sleep(10)
+        return 'held'
+
+    action = await resolve_tool(ai._registry, 'hold_inventory')
+    trp = Part.from_tool_request(name='hold_inventory', ref='r1', input={})
+    ctx = MiddlewareContext(ai)
+
+    task = asyncio.create_task(execute_tool_request(tool=action, tool_request_part=trp, ctx=ctx))
+    await acquired.wait()
+    task.cancel()
+
+    with pytest.raises(asyncio.CancelledError):
+        await task
+
+    assert lease_events == ['acquired', 'released']
+    assert asyncio.all_tasks() == {asyncio.current_task()}
+
+
+@pytest.mark.asyncio
+async def test_generate_cancel_awaits_tool_async_finally_cleanup_before_unwinding() -> None:
+    """Cancelling ai.generate mid-tool waits for the tool's async finally block to complete before returning."""
+    ai = Genkit(model='scriptedModel')
+    pm, _ = define_scripted_model(ai)
+    seat_locked = asyncio.Event()
+    seat_released = False
+
+    @contextlib.asynccontextmanager
+    async def seat_hold() -> AsyncIterator[None]:
+        nonlocal seat_released
+        seat_locked.set()
+        try:
+            yield
+        finally:
+            await asyncio.sleep(0)
+            await asyncio.sleep(0)
+            seat_released = True
+
+    @ai.tool(name='lock_seat')
+    async def lock_seat() -> str:
+        async with seat_hold():
+            await asyncio.sleep(10)
+        return '12A'
+
+    pm.responses = [_model_calls_tool(name='lock_seat', ref='r1')]
+
+    gen_task = asyncio.create_task(ai.generate(prompt='Reserve seat 12A', tools=['lock_seat']))
+    await seat_locked.wait()
+    gen_task.cancel()
+
+    with pytest.raises(asyncio.CancelledError):
+        await gen_task
+
+    assert seat_released is True
+
+
+@pytest.mark.asyncio
+async def test_generate_cancel_with_multiple_tools_awaits_every_tool_async_finally_cleanup() -> None:
+    """With 2+ parallel tools, a single task.cancel() cancels each tool once and lets finally blocks finish."""
+    ai = Genkit(model='scriptedModel')
+    pm, _ = define_scripted_model(ai)
+    seat_locked = asyncio.Event()
+    baggage_locked = asyncio.Event()
+    cleaned: list[str] = []
+
+    @contextlib.asynccontextmanager
+    async def hold_resource(label: str, ready: asyncio.Event) -> AsyncIterator[None]:
+        ready.set()
+        try:
+            yield
+        finally:
+            await asyncio.sleep(0)
+            await asyncio.sleep(0)
+            cleaned.append(label)
+
+    @ai.tool(name='lock_seat')
+    async def lock_seat() -> str:
+        async with hold_resource('seat', seat_locked):
+            await asyncio.sleep(10)
+        return '12A'
+
+    @ai.tool(name='hold_bagg
```

**File**: `py/packages/genkit/tests/genkit/core/compat_test.py` (modified, +100/-1)
```diff
@@ -9,7 +9,9 @@
 
 import pytest
 
-from genkit._core._compat import await_unchained
+from genkit import Message, Part, Role
+from genkit._ai._generate import stamp_cancelled_error
+from genkit._core._compat import await_unchained, cancelled_history
 
 
 @pytest.mark.asyncio
@@ -139,3 +141,100 @@ async def nested(depth: int) -> None:
             await outer
     finally:
         sys.setrecursionlimit(previous_limit)
+
+
+def _order_history() -> list[Message]:
+    return [Message(role=Role.USER, content=[Part.from_text('book dinner for 2')])]
+
+
+@pytest.mark.asyncio
+async def test_cancelled_history_reads_stamp_across_task_hops() -> None:
+    """History stamped inside a cancelled task is found after awaiting through two task hops."""
+    history = _order_history()
+    started = asyncio.Event()
+
+    async def reserve() -> None:
+        try:
+            started.set()
+            await asyncio.sleep(10)
+        except asyncio.CancelledError as exc:
+            stamp_cancelled_error(exc=exc, messages=history)
+            raise
+
+    async def book() -> None:
+        await asyncio.create_task(reserve())
+
+    task = asyncio.create_task(book())
+    await started.wait()
+    task.cancel()
+    with pytest.raises(asyncio.CancelledError) as exc_info:
+        await task
+
+    found = cancelled_history(exc_info.value)
+    assert found is not None
+    assert [m.text for m in found] == ['book dinner for 2']
+    assert 'message' not in exc_info.value.__dict__
+    # 3.10 hands back a fresh CancelledError; 3.11+ returns the stamped one.
+    assert (exc_info.value.__dict__.get('messages') is None) == (sys.version_info < (3, 11))
+
+
+def test_cancelled_history_returns_none_without_stamp() -> None:
+    """Unstamped cancels and unrelated errors have no history."""
+    assert cancelled_history(asyncio.CancelledError()) is None
+    assert cancelled_history(ValueError('kitchen closed')) is None
+
+
+def test_cancelled_history_walks_context_only_on_310() -> None:
+    """A stamp on __context__ is read on 3.10 only; 3.11+ reads the exception itself."""
+    history = _order_history()
+    stamped = asyncio.CancelledError()
+    stamp_cancelled_error(exc=stamped, messages=history)
+    fresh = asyncio.CancelledError()
+    fresh.__context__ = stamped
+
+    found = cancelled_history(fresh)
+    if sys.version_info < (3, 11):
+        assert found is not None
+        assert [m.text for m in found] == ['book dinner for 2']
+    else:
+        assert found is None
+
+
+def test_cancelled_history_stops_on_context_cycle() -> None:
+    """A self-referencing __context__ chain terminates."""
+    a = asyncio.CancelledError()
+    b = asyncio.CancelledError()
+    a.__context__ = b
+    b.__context__ = a
+    assert cancelled_history(a) is None
+
+
+@pytest.mark.asyncio
+async def test_cancelled_history_reads_stamp_from_wait_for_and_timeout() -> None:
+    """wait_for and asyncio.timeout raise TimeoutError with the stamped CancelledError on __cause__."""
+    history = _order_history()
+
+    async def reserve() -> None:
+        try:
+            await asyncio.sleep(10)
+        except asyncio.CancelledError as exc:
+            stamp_cancelled_error(exc=exc, messages=history)
+            raise
+
+    with pytest.raises((TimeoutError, asyncio.TimeoutError)) as wait_for_exc:
+        await asyncio.wait_for(reserve(), timeout=0.01)
+
+    found = cancelled_history(wait_for_exc.value)
+    assert found is not None
+    assert [m.text for m in found] == ['book dinner for 2']
+
+    if sys.version_info >= (3, 11):
+        with pytest.raises(TimeoutError) as timeout_exc:
+            async with asyncio.timeout(0.01):
+                await reserve()
+
+        found_timeout = cancelled_history(timeout_exc.value)
+        assert found_timeout is not None
+        assert [m.text for m in found_timeout] == ['book dinner for 2']
+
+    assert cancelled_history(TimeoutError('unrelated socket timeout')) is None
```

---

### Incident Patch 2: `6aab26ea` (2026-11-05)
**Commit Message**: fix(py): cancel streamed actions on HTTP SSE client disconnect (#7056)

**File**: `py/packages/genkit-django/README.md` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ urlpatterns = [
 ]
 ```
 
-The view requires Django's ASGI server (Django 4.1+):
+The view requires Django's ASGI server (Django 5.0+):
 
 ```bash
 uvicorn myproject.asgi:application
```

**File**: `py/packages/genkit-django/pyproject.toml` (modified, +1/-3)
```diff
@@ -20,10 +20,8 @@ classifiers = [
   "Development Status :: 4 - Beta",
   "Environment :: Console",
   "Environment :: Web Environment",
-  "Framework :: Django",
   "Framework :: AsyncIO",
   "Framework :: Django",
-  "Framework :: Django :: 4.2",
   "Framework :: Django :: 5.0",
   "Framework :: Django :: 5.1",
   "Framework :: Pydantic",
@@ -46,7 +44,7 @@ classifiers = [
 dependencies = [
   "genkit>=0.12.0,<2",
   "pydantic>=2.11",
-  "django>=4.2",
+  "django>=5.0",
 ]
 description = "A Genkit flow as a Django view"
 keywords = [
```

**File**: `py/packages/genkit-django/src/genkit_django/_handler.py` (modified, +7/-3)
```diff
@@ -17,6 +17,7 @@
 """Genkit Django handler for serving flows as HTTP endpoints."""
 
 import asyncio
+import contextlib
 import json
 import logging
 from collections.abc import AsyncIterator, Awaitable, Callable, Mapping
@@ -118,7 +119,7 @@ async def say_hi(name: str, ctx: FlowContext) -> str:
     ]
     ```
 
-    Requires Django ASGI (Django 4.1+). The returned view is `csrf_exempt`
+    Requires Django ASGI (Django 5.0+). The returned view is `csrf_exempt`
     because this is a JSON API.
 
     Args:
@@ -182,8 +183,11 @@ async def event_stream() -> AsyncIterator[str]:
                         _log_failure(error=e, flow=flow.name, where='stream')
                         yield error_sse(e)
                         return
-                    async for line in to_sse(stream_response):
-                        yield line
+                    # a client that hangs up closes this generator; aclosing makes
+                    # that cancel the flow right away instead of whenever it's collected.
+                    async with contextlib.aclosing(to_sse(stream_response)) as lines:
+                        async for line in lines:
+                            yield line
 
                 return StreamingHttpResponse(event_stream(), content_type='text/event-stream; charset=utf-8')
 
```

**File**: `py/packages/genkit-django/tests/django_test.py` (modified, +61/-0)
```diff
@@ -17,6 +17,7 @@
 
 """Tests for the Django plugin."""
 
+import asyncio
 import json
 import logging
 import sys
@@ -26,6 +27,7 @@
 
 import pytest
 from django.core.exceptions import PermissionDenied
+from django.core.handlers.asgi import ASGIHandler
 from django.http import HttpRequest
 from django.test import AsyncClient
 from django.test.utils import override_settings
@@ -506,6 +508,65 @@ async def test_context_provider_reads_raw_django_request(urlconf: None) -> None:
     assert json.loads(response.content) == {'result': 'table T7'}
 
 
+@pytest.mark.asyncio
+async def test_django_streaming_client_disconnect_cancels_flow(monkeypatch: pytest.MonkeyPatch) -> None:
+    """A client that hangs up after the first SSE chunk of a streamed flow view cancels the flow."""
+    ai = Genkit()
+    flow_cancelled = asyncio.Event()
+
+    @genkit_django_handler(ai)
+    @ai.flow()
+    async def slow(_: str, ctx: FlowContext) -> str:
+        ctx.send_chunk(1)
+        try:
+            await asyncio.Event().wait()
+        except asyncio.CancelledError:
+            flow_cancelled.set()
+            raise
+        return 'never'
+
+    module = types.ModuleType('genkit_django_disconnect_urls')
+    module.urlpatterns = [path('slow', slow)]  # type: ignore[attr-defined]  # pyrefly: ignore[missing-attribute]
+    monkeypatch.setitem(sys.modules, 'genkit_django_disconnect_urls', module)
+
+    first_chunk = asyncio.Event()
+    request_read = False
+    bodies: list[bytes] = []
+
+    async def receive() -> dict[str, Any]:
+        nonlocal request_read
+        if not request_read:
+            request_read = True
+            return {'type': 'http.request', 'body': json.dumps({'data': 'x'}).encode(), 'more_body': False}
+        await first_chunk.wait()
+        return {'type': 'http.disconnect'}
+
+    async def send(message: dict[str, Any]) -> None:
+        if message['type'] == 'http.response.body' and message.get('body'):
+            bodies.append(message['body'])
+            first_chunk.set()
+
+    scope = {
+        'type': 'http',
+        'asgi': {'version': '3.0'},
+        'http_version': '1.1',
+        'method': 'POST',
+        'scheme': 'http',
+        'path': '/slow',
+        'raw_path': b'/slow',
+        'root_path': '',
+        'query_string': b'',
+        'headers': [(b'content-type', b'application/json'), (b'accept', b'text/event-stream')],
+        'client': ('testclient', 50000),
+        'server': ('testserver', 80),
+    }
+    with override_settings(ROOT_URLCONF='genkit_django_disconnect_urls'):
+        await asyncio.wait_for(ASGIHandler()(scope, receive, send), timeout=5)
+
+    assert bodies == [b'data: {"message":1}\n\n']
+    assert flow_cancelled.is_set()
+
+
 @pytest.mark.asyncio
 async def test_django_failure_logs_name_the_flow(
     urlconf: None,  # noqa: ARG001
```

**File**: `py/packages/genkit-fastapi/src/genkit_fastapi/_handler.py` (modified, +6/-2)
```diff
@@ -19,6 +19,7 @@
 from __future__ import annotations
 
 import asyncio
+import contextlib
 import json
 import logging
 from collections.abc import AsyncIterator, Awaitable, Callable, Mapping
@@ -173,8 +174,11 @@ async def event_stream() -> AsyncIterator[str]:
                 _log_failure(error=e, flow=action_obj.name, where='stream')
                 yield error_sse(e)
                 return
-            async for line in to_sse(stream_handle):
-                yield line
+            # a client that hangs up closes this generator; aclosing makes
+            # that cancel the flow right away instead of whenever it's collected.
+            async with contextlib.aclosing(to_sse(stream_handle)) as lines:
+                async for line in lines:
+                    yield line
 
         return StreamingResponse(event_stream(), media_type='text/event-stream')
 
```

**File**: `py/packages/genkit-fastapi/tests/fastapi_test.py` (modified, +68/-0)
```diff
@@ -22,6 +22,7 @@
 import functools
 import json
 import logging
+from collections.abc import MutableMapping
 from typing import Any, cast
 
 import pytest
@@ -1249,3 +1250,70 @@ async def custom_ack(request: Request) -> Response:
     assert err.status_code == 404
     assert err.headers['x-trace-id'] == 'trace-42'
     assert err.content == b'{"message":"order missing","status":"NOT_FOUND"}'
+
+
+async def post_sse_then_hang_up(app: FastAPI, path: str) -> list[bytes]:
+    """POST `{"data": "x"}` asking for SSE, then disconnect right after the first body chunk arrives."""
+    first_chunk = asyncio.Event()
+    request_read = False
+    bodies: list[bytes] = []
+
+    async def receive() -> dict[str, Any]:
+        nonlocal request_read
+        if not request_read:
+            request_read = True
+            return {'type': 'http.request', 'body': json.dumps({'data': 'x'}).encode(), 'more_body': False}
+        await first_chunk.wait()
+        return {'type': 'http.disconnect'}
+
+    async def send(message: MutableMapping[str, Any]) -> None:
+        if message['type'] == 'http.response.body' and message.get('body'):
+            bodies.append(message['body'])
+            first_chunk.set()
+
+    scope = {
+        'type': 'http',
+        'asgi': {'version': '3.0', 'spec_version': '2.3'},
+        'http_version': '1.1',
+        'method': 'POST',
+        'scheme': 'http',
+        'path': path,
+        'raw_path': path.encode(),
+        'root_path': '',
+        'query_string': b'',
+        'headers': [(b'content-type', b'application/json'), (b'accept', b'text/event-stream')],
+        'client': ('testclient', 50000),
+        'server': ('testserver', 80),
+    }
+    await asyncio.wait_for(app(scope, receive, send), timeout=5)
+    return bodies
+
+
+@pytest.mark.asyncio
+async def test_fastapi_streaming_client_disconnect_cancels_flow() -> None:
+    """A client that hangs up after the first SSE chunk cancels the flow and lets awaiting `finally:` finish."""
+    ai = Genkit()
+    flow_cancelled = asyncio.Event()
+    cleanup_finished = asyncio.Event()
+
+    @ai.flow()
+    async def slow(_: str, ctx: FlowContext) -> str:
+        ctx.send_chunk(1)
+        try:
+            await asyncio.Event().wait()
+        except asyncio.CancelledError:
+            flow_cancelled.set()
+            raise
+        finally:
+            await asyncio.sleep(0.02)
+            cleanup_finished.set()
+        return 'never'
+
+    app = FastAPI()
+    app.include_router(serve_flow(slow, base_path='/slow'))
+
+    bodies = await post_sse_then_hang_up(app, '/slow')
+
+    assert bodies == [b'data: {"message":1}\n\n']
+    assert flow_cancelled.is_set()
+    await asyncio.wait_for(cleanup_finished.wait(), timeout=1.0)
```

**File**: `py/packages/genkit-flask/src/genkit_flask/_handler.py` (modified, +22/-10)
```diff
@@ -17,10 +17,11 @@
 """Genkit Flask plugin."""
 
 import asyncio
+import contextlib
 import json
 import logging
 from asyncio import AbstractEventLoop
-from collections.abc import AsyncIterable, AsyncIterator, Awaitable, Callable, Iterable
+from collections.abc import AsyncIterable, AsyncIterator, Awaitable, Callable, Generator
 from typing import Any, TypeVar, cast
 
 from flask import Response, request
@@ -86,7 +87,7 @@ def _create_loop() -> AbstractEventLoop:
         return asyncio.new_event_loop()
 
 
-def _iter_over_async(ait: AsyncIterable[T], loop: AbstractEventLoop) -> Iterable[T]:
+def _iter_over_async(ait: AsyncIterable[T], loop: AbstractEventLoop) -> Generator[T, None, None]:
     """Synchronously iterates over an AsyncIterable using a specified event loop."""
     ait_iter = ait.__aiter__()
 
@@ -97,12 +98,20 @@ async def get_next() -> tuple[bool, T | None]:
         except StopAsyncIteration:
             return True, None
 
-    while True:
-        done, obj = loop.run_until_complete(get_next())
-        if done:
-            break
-        assert obj is not None
-        yield obj
+    try:
+        while True:
+            done, obj = loop.run_until_complete(get_next())
+            if done:
+                break
+            assert obj is not None
+            yield obj
+    finally:
+        # Werkzeug closes this iterator when the client hangs up. The async side
+        # only runs while we drive the loop, so close it here or the flow never
+        # hears about it.
+        aclose = getattr(ait_iter, 'aclose', None)
+        if aclose is not None and not loop.is_closed() and not loop.is_running():
+            loop.run_until_complete(aclose())
 
 
 class _FlaskRequestData(RequestData):
@@ -190,8 +199,11 @@ async def async_gen() -> AsyncIterator[str]:
                         _log_failure(error=e, flow=flow.name, where='stream')
                         yield error_sse(e)
                         return
-                    async for line in to_sse(stream_response):
-                        yield line
+                    # closing this generator has to cancel the flow before the
+                    # loop stops; nothing runs the loop afterwards to collect it.
+                    async with contextlib.aclosing(to_sse(stream_response)) as lines:
+                        async for line in lines:
+                            yield line
 
                 return Response(_iter_over_async(async_gen(), loop), mimetype='text/event-stream')
             try:
```

**File**: `py/packages/genkit-flask/tests/flask_test.py` (modified, +80/-0)
```diff
@@ -17,13 +17,18 @@
 
 """Tests for the Flask plugin."""
 
+import asyncio
 import json
 import logging
+import threading
+import warnings
+from collections.abc import AsyncIterator
 from typing import Any
 
 import pytest
 from flask import Flask, abort
 from genkit_flask import genkit_flask_handler
+from genkit_flask._handler import _iter_over_async
 from pydantic import BaseModel
 
 from genkit import FlowContext, Genkit, GenkitError, PublicError
@@ -458,6 +463,81 @@ async def chat(_: str) -> str:
     assert response.status_code == 401
 
 
+def test_flask_streaming_client_disconnect_cancels_flow() -> None:
+    """A client that hangs up after the first SSE chunk cancels the flow and lets awaiting `finally:` finish."""
+    ai = Genkit()
+    flow_cancelled = threading.Event()
+    cleanup_finished = threading.Event()
+    app = Flask(__name__)
+    app.config.update({'TESTING': True})
+
+    @app.post('/slow')
+    @genkit_flask_handler(ai)
+    @ai.flow()
+    async def slow(_: str, ctx: FlowContext) -> str:
+        ctx.send_chunk(1)
+        try:
+            await asyncio.Event().wait()
+        except asyncio.CancelledError:
+            flow_cancelled.set()
+            raise
+        finally:
+            await asyncio.sleep(0.02)
+            cleanup_finished.set()
+        return 'never'
+
+    response = app.test_client().post(
+        '/slow', json={'data': 'x'}, headers={'accept': 'text/event-stream'}, buffered=False
+    )
+    first = next(iter(response.response))
+    # Werkzeug closes the response iterator when the client goes away.
+    response.close()
+
+    assert first == b'data: {"message":1}\n\n'
+    assert flow_cancelled.is_set()
+    assert cleanup_finished.is_set()
+
+
+def test_flask_iter_over_async_skips_aclose_when_loop_closed() -> None:
+    """Closing `_iter_over_async` after `loop.close()` does not raise `RuntimeError` or leak an unawaited coroutine."""
+    loop = asyncio.new_event_loop()
+
+    async def source() -> AsyncIterator[str]:
+        yield 'first'
+        yield 'second'
+
+    sync_iter = _iter_over_async(source(), loop)
+    assert next(sync_iter) == 'first'
+    loop.close()
+
+    with warnings.catch_warnings():
+        warnings.simplefilter('error', RuntimeWarning)
+        sync_iter.close()
+
+
+def test_flask_iter_over_async_skips_aclose_when_loop_running() -> None:
+    """Closing `_iter_over_async` while `loop` is busy does not raise `RuntimeError` or leak a coroutine."""
+    loop = asyncio.new_event_loop()
+
+    async def source() -> AsyncIterator[str]:
+        yield 'first'
+        yield 'second'
+
+    sync_iter = _iter_over_async(source(), loop)
+    assert next(sync_iter) == 'first'
+
+    async def close_while_busy() -> None:
+        assert loop.is_running()
+        with warnings.catch_warnings():
+            warnings.simplefilter('error', RuntimeWarning)
+            sync_iter.close()
+
+    try:
+        loop.run_until_complete(close_while_busy())
+    finally:
+        loop.close()
+
+
 def test_flask_failure_logs_name_the_flow(caplog: pytest.LogCaptureFixture) -> None:
     """Failure lines say which flow failed: 5xx with traceback, 4xx without."""
     ai = Genkit()
```

---

### Incident Patch 3: `71011247` (2026-11-05)
**Commit Message**: fix(py)!: web adapters return Response and serialize outputs uniformly (#7038)

**File**: `py/packages/genkit-django/src/genkit_django/_handler.py` (modified, +22/-34)
```diff
@@ -23,19 +23,25 @@
 from typing import Any, cast
 
 from django.core.exceptions import PermissionDenied, SuspiciousOperation
-from django.http import Http404, HttpRequest, HttpResponse, HttpResponseBase, JsonResponse, StreamingHttpResponse
+from django.http import Http404, HttpRequest, HttpResponse, HttpResponseBase, StreamingHttpResponse
 from django.views.decorators.csrf import csrf_exempt
-from pydantic import BaseModel
 
 from genkit import Genkit, GenkitError, PublicError
 from genkit.plugin_api import Action
-from genkit.web import ContextProvider, RequestData, error_body, error_status, read_body, wants_stream
+from genkit.web import (
+    ContextProvider,
+    RequestData,
+    error_json,
+    error_sse,
+    error_status,
+    read_body,
+    result_json,
+    to_sse,
+    wants_stream,
+)
 
 logger = logging.getLogger(__name__)  # noqa: TID251
 
-# Compact JSON (no spaces) for smaller wire payload.
-_JSON_SEPARATORS = (',', ':')
-
 
 def _log_failure(*, error: Exception, flow: str, where: str) -> None:
     """Log a served-action failure to the host web server's stdlib logger, naming the action.
@@ -53,30 +59,11 @@ def _log_failure(*, error: Exception, flow: str, where: str) -> None:
         logger.warning('served action %r %s failed: %s', flow, where, error, extra=extra)
 
 
-def _to_dict(obj: Any) -> Any:  # noqa: ANN401
-    """Recursively convert Pydantic models inside ``obj`` to plain JSON-friendly types.
-
-    Flows can return a Pydantic model, a list of Pydantic models, or a dict whose
-    values are Pydantic models. Django's ``JsonResponse`` and ``json.dumps`` don't
-    know how to serialize ``BaseModel`` instances natively, so descend into lists,
-    tuples, and dicts to convert every model we find.
-    """
-    if isinstance(obj, BaseModel):
-        return obj.model_dump()
-    if isinstance(obj, list):
-        return [_to_dict(item) for item in obj]
-    if isinstance(obj, tuple):
-        return [_to_dict(item) for item in obj]
-    if isinstance(obj, dict):
-        return {k: _to_dict(v) for k, v in obj.items()}
-    return obj
-
-
 def _error_response(err: Exception, status: int | None = None) -> HttpResponse:
     """Return a JSON error body; status comes from the error unless overridden."""
     return HttpResponse(
         status=error_status(err) if status is None else status,
-        content=json.dumps(error_body(err), separators=_JSON_SEPARATORS).encode('utf-8'),
+        content=error_json(err).encode('utf-8'),
         content_type='application/json',
     )
 
@@ -191,20 +178,21 @@ async def handler(request: HttpRequest) -> HttpResponseBase:
                 async def event_stream() -> AsyncIterator[str]:
                     try:
                         stream_response = flow.stream(input=action_input, context=action_context, init=init)
-                        async for chunk in stream_response.stream:
-                            yield f'data: {json.dumps({"message": _to_dict(chunk)}, separators=_JSON_SEPARATORS)}\n\n'
-
-                        result = await stream_response.response
-                        yield f'data: {json.dumps({"result": _to_dict(result)}, separators=_JSON_SEPARATORS)}\n\n'
                     except Exception as e:
                         _log_failure(error=e, flow=flow.name, where='stream')
-                        yield f'data: {json.dumps({"error": error_body(e)}, separators=_JSON_SEPARATORS)}\n\n'
+                        yield error_sse(e)
+                        return
+                    async for line in to_sse(stream_response):
+                        yield line
 
-                return StreamingHttpResponse(event_stream(), content_type='text/event-stream')
+                return StreamingHttpResponse(event_stream(), content_type='text/event-stream; charset=utf-8')
 
             try:
                 response = await flow.run(input=action_input, context=action_context, init=init)
-                return JsonResponse({'result': _to_dict(response.response)})
+                return HttpResponse(
+                    content=result_json(response.response).encode('utf-8'),
+                    content_type='application/json',
+                )
             except Exception as e:
                 _log_failure(error=e, flow=flow.name, where='run')
                 return _error_response(e)
```

**File**: `py/packages/genkit-django/tests/django_test.py` (modified, +4/-4)
```diff
@@ -148,7 +148,7 @@ async def void_flow() -> dict[str, str]:
     @genkit_django_handler(ai)
     @ai.flow()
     async def close_tab(table: int) -> Receipt:
-        return {'table': table}  # type: ignore[return-value]
+        return {'table': table, 'note': None}  # type: ignore[return-value]
 
     @genkit_django_handler(ai)
     @ai.flow()
@@ -440,13 +440,13 @@ async def test_django_flow_with_default_and_null_data_uses_python_default(urlcon
 
 
 @pytest.mark.asyncio
-async def test_django_flow_returning_partial_dict_for_model_sends_defaults(urlconf: None) -> None:  # noqa: ARG001
-    """POST to a `-> Receipt` flow that returns `{'table': 4}` includes `note: null`."""
+async def test_django_flow_returning_dict_for_model_omits_none_fields(urlconf: None) -> None:  # noqa: ARG001
+    """POST to a `-> Receipt` flow that returns `{'table': 4, 'note': None}` omits `note` on the wire."""
     client = AsyncClient()
     response = await client.post('/close_tab', data=json.dumps({'data': 4}), content_type='application/json')
 
     assert response.status_code == 200
-    assert json.loads(response.content) == {'result': {'table': 4, 'note': None}}
+    assert json.loads(response.content) == {'result': {'table': 4}}
 
 
 @pytest.mark.asyncio
```

**File**: `py/packages/genkit-fastapi/README.md` (modified, +2/-2)
```diff
@@ -153,7 +153,7 @@ from fastapi import Depends, Request
 from genkit_fastapi import handle_genkit_request
 
 
-@app.post('/api/deploy', response_model=None)
+@app.post('/api/deploy')
 async def deploy_endpoint(request: Request, user: User = Depends(current_user)):
     return await handle_genkit_request(
         request,
@@ -170,7 +170,7 @@ For custom route definitions, you can also use `@genkit_fastapi_handler`:
 from genkit_fastapi import genkit_fastapi_handler
 
 
-@app.post('/custom-chat', response_model=None)
+@app.post('/custom-chat')
 @genkit_fastapi_handler(ai)
 @ai.flow()
 async def custom_chat(prompt: str) -> str:
```

**File**: `py/packages/genkit-fastapi/src/genkit_fastapi/_handler.py` (modified, +27/-32)
```diff
@@ -26,29 +26,30 @@
 
 from fastapi import APIRouter, Depends, Request, Response
 from fastapi.responses import StreamingResponse
-from pydantic import BaseModel
 from starlette.exceptions import HTTPException as StarletteHTTPException
 
 from genkit import Genkit, GenkitError, PublicError
 from genkit.plugin_api import Action
-from genkit.web import ContextProvider, RequestData, error_body, error_status, read_body, to_sse, wants_stream
+from genkit.web import (
+    ContextProvider,
+    RequestData,
+    error_json,
+    error_sse,
+    error_status,
+    read_body,
+    result_json,
+    to_sse,
+    wants_stream,
+)
 
 logger = logging.getLogger(__name__)  # noqa: TID251
 
-# Compact JSON (no spaces) for smaller wire payload.
-JSON_SEPARATORS = (',', ':')
-
 InputT = TypeVar('InputT')
 OutputT = TypeVar('OutputT')
 ChunkT = TypeVar('ChunkT')
 InitT = TypeVar('InitT')
 
 
-def to_dict(obj: Any) -> Any:  # noqa: ANN401
-    """Convert object to dict if it's a Pydantic model, otherwise return as-is."""
-    return obj.model_dump(by_alias=True, exclude_none=True) if isinstance(obj, BaseModel) else obj
-
-
 class FastAPIRequestData(RequestData):
     """Wraps FastAPI request data for Genkit context."""
 
@@ -66,7 +67,7 @@ def json_error_response(error: Exception, status_code: int | None = None) -> Res
     """Build a compact JSON error response from an exception."""
     return Response(
         status_code=error_status(error) if status_code is None else status_code,
-        content=json.dumps(error_body(error), separators=JSON_SEPARATORS),
+        content=error_json(error),
         media_type='application/json',
     )
 
@@ -94,25 +95,19 @@ def _log_failure(*, error: Exception, flow: str, where: str) -> None:
         logger.warning('served action %r %s failed: %s', flow, where, error, extra=extra)
 
 
-def format_stream_error(error: Exception) -> str:
-    """Format a stream failure as a canonical SSE data event."""
-    err_json = json.dumps({'error': error_body(error)}, separators=JSON_SEPARATORS)
-    return f'data: {err_json}\n\n'
-
-
 async def handle_genkit_request(
     request: Request,
     *,
     action: Action[InputT, OutputT, ChunkT, InitT],
     context: dict[str, object] | None = None,
     init: InitT | dict[str, Any] | None = None,
-) -> Response | dict[str, Any]:
+) -> Response:
     """Run one Genkit action request and return its FastAPI response.
 
     This is the wire contract every stable route sits on. It reads ``{"data": ...}``
     or ``{}`` plus body ``init``, then either streams SSE frames —
     ``data: {"message": ...}`` chunks followed by a final ``data: {"result": ...}``
-    — or returns a one-shot ``{"result": ...}``.
+    — or returns a one-shot ``{"result": ...}`` JSON ``Response``.
 
     ``context`` and ``init`` are handed straight to the action, so you can resolve
     auth and per-request state however you like and pass them in. That makes this
@@ -127,7 +122,7 @@ async def handle_genkit_request(
         init: Optional init payload passed through to the action.
 
     Returns:
-        A streaming SSE response, a ``{"result": ...}`` dict, or an error Response.
+        A FastAPI ``Response`` carrying the JSON result, SSE stream, or error body.
     """
     return await _handle_action_request(
         request=request,
@@ -146,7 +141,7 @@ async def _handle_action_request(
     extract_input: Callable[[dict[str, Any]], object] | None = None,
     resolve_init: Callable[[dict[str, Any], Mapping[str, str]], object] | None = None,
     empty_status: int | None = None,
-) -> Response | dict[str, Any]:
+) -> Response:
     try:
         body = await _read_json_request_body(request=request)
     except PublicError as err:
@@ -176,7 +171,7 @@ async def event_stream() -> AsyncIterator[str]:
                 stream_handle = action_obj.stream(input=action_input, context=context, init=resolved_init)
             except Exception as e:
                 _log_failure(error=e, flow=action_obj.name, where='stream')
-                yield format_stream_error(e)
+                yield error_sse(e)
                 return
             async for line in to_sse(stream_handle):
                 yield line
@@ -187,7 +182,7 @@ async def event_stream() -> AsyncIterator[str]:
         response = await action_obj.run(input=action_input, context=context, init=resolved_init)
         if response.response is None and empty_status is not None:
             return Response(status_code=empty_status)
-        return {'result': to_dict(response.response)}
+        return Response(content=result_json(response.response), media_type='application/json')
     except Exception as e:
         _log_failure(error=e, flow=action_obj.name, where='run')
         return json_error_response(e)
@@ -198,13 +193,13 @@ def genkit_fastapi_handler(
     context_provider: ContextProvider | None = None,
 ) -> Callable[
     [Callable[[], Awaitable[Action[InputT, OutputT, ChunkT, InitT]]] | Action[InputT, OutputT, Chunk
```

**File**: `py/packages/genkit-fastapi/tests/agent_handler_test.py` (modified, +5/-5)
```diff
@@ -11,7 +11,7 @@
 from typing import Any
 
 import pytest
-from fastapi import FastAPI, HTTPException, Request
+from fastapi import FastAPI, HTTPException, Request, Response
 from fastapi.responses import StreamingResponse
 from fastapi.testclient import TestClient
 from genkit_fastapi import handle_genkit_request
@@ -197,8 +197,8 @@ def test_handle_genkit_request_agent_route_with_data_envelope_runs_turn() -> Non
     agent = build_agent('handRolledAgent')
     app = FastAPI()
 
-    @app.post('/custom', response_model=None)
-    async def custom(request: Request) -> object:
+    @app.post('/custom')
+    async def custom(request: Request) -> Response:
         # A real app would build this context and init from its own Depends params.
         return await handle_genkit_request(
             request,
@@ -320,8 +320,8 @@ def test_hand_rolled_routes_send_the_same_frames_as_serve_agent() -> None:
     via_to_sse = build_agent('toSseFrames')
     app = FastAPI()
 
-    @app.post('/request', response_model=None)
-    async def request_route(request: Request) -> object:
+    @app.post('/request')
+    async def request_route(request: Request) -> Response:
         return await handle_genkit_request(request, action=via_request)
 
     @app.post('/to_sse')
```

**File**: `py/packages/genkit-fastapi/tests/fastapi_nested_types_test.py` (modified, +1/-1)
```diff
@@ -34,7 +34,7 @@ def test_fastapi_flow_returning_model_with_nested_message_unchanged() -> None:
     ai = Genkit()
     app = FastAPI()
 
-    @app.post('/turn', response_model=None)
+    @app.post('/turn')
     @genkit_fastapi_handler(ai)
     @ai.flow()
     async def turn(_: str) -> Turn:
```

**File**: `py/packages/genkit-fastapi/tests/fastapi_test.py` (modified, +101/-18)
```diff
@@ -25,11 +25,12 @@
 from typing import Any, cast
 
 import pytest
-from fastapi import Depends, FastAPI, HTTPException, Request
+from fastapi import Depends, FastAPI, HTTPException, Request, Response
 from fastapi.responses import StreamingResponse
 from fastapi.testclient import TestClient
 from genkit_fastapi import genkit_fastapi_handler, handle_genkit_request, serve_flow
-from pydantic import BaseModel, field_validator
+from pydantic import BaseModel, ConfigDict, field_validator
+from pydantic.alias_generators import to_camel
 from starlette.exceptions import HTTPException as StarletteHTTPException
 
 from genkit import (
@@ -72,7 +73,7 @@ def create_app() -> FastAPI:
     ai = Genkit()
     app = FastAPI()
 
-    @app.post('/chat', response_model=None)
+    @app.post('/chat')
     @genkit_fastapi_handler(ai)
     @ai.flow()
     async def say_hi(name: str, ctx: FlowContext) -> dict[str, str]:
@@ -441,7 +442,7 @@ async def provider(request_data: RequestData) -> dict[str, object]:
             'input': request_data.input,
         }
 
-    @app.post('/echo', response_model=None)
+    @app.post('/echo')
     @genkit_fastapi_handler(ai, context_provider=provider)
     @ai.flow()
     async def echo(_: str, ctx: FlowContext) -> dict[str, object]:
@@ -473,7 +474,7 @@ def test_request_data_duplicate_authorization_is_comma_joined() -> None:
     async def provider(request_data: RequestData) -> dict[str, object]:
         return {'authorization': request_data.headers.get('authorization')}
 
-    @app.post('/echo', response_model=None)
+    @app.post('/echo')
     @genkit_fastapi_handler(ai, context_provider=provider)
     @ai.flow()
     async def echo(_: str, ctx: FlowContext) -> dict[str, object]:
@@ -497,7 +498,7 @@ def test_request_data_duplicate_x_forwarded_for_is_comma_joined() -> None:
     async def provider(request_data: RequestData) -> dict[str, object]:
         return {'xff': request_data.headers.get('x-forwarded-for')}
 
-    @app.post('/echo', response_model=None)
+    @app.post('/echo')
     @genkit_fastapi_handler(ai, context_provider=provider)
     @ai.flow()
     async def echo(_: str, ctx: FlowContext) -> dict[str, object]:
@@ -526,7 +527,7 @@ async def chat(_: str) -> str:
 
     app = FastAPI()
 
-    @app.post('/chat', response_model=None)
+    @app.post('/chat')
     @genkit_fastapi_handler(ai, context_provider=deny)
     async def chat_route():
         return chat
@@ -601,7 +602,7 @@ def test_fastapi_flow_returning_dict_for_model_sends_model_dump() -> None:
     async def close_tab(table: int) -> Receipt:
         return {'table': table, 'note': None}  # type: ignore[return-value]
 
-    @app.post('/close_tab', response_model=None)
+    @app.post('/close_tab')
     @genkit_fastapi_handler(ai)
     async def close_tab_route():
         return close_tab
@@ -760,7 +761,7 @@ async def chat(_: str) -> str:
 
     app = FastAPI()
 
-    @app.post('/chat', response_model=None)
+    @app.post('/chat')
     @genkit_fastapi_handler(ai, context_provider=deny)
     async def chat_route():
         return chat
@@ -789,7 +790,7 @@ async def chat(_: str) -> str:
 
     app = FastAPI()
 
-    @app.post('/chat', response_model=None)
+    @app.post('/chat')
     @genkit_fastapi_handler(ai)  # pyright: ignore[reportArgumentType]
     def chat_route():
         return chat
@@ -805,7 +806,7 @@ def test_fastapi_handler_wrapper_returning_non_action_returns_json_internal_erro
     ai = Genkit()
     app = FastAPI()
 
-    @app.post('/chat', response_model=None)
+    @app.post('/chat')
     @genkit_fastapi_handler(ai)  # pyright: ignore[reportArgumentType]
     async def chat_route():
         return 'not an action'
@@ -821,15 +822,15 @@ def test_fastapi_handler_wrapper_failure_logs_wrapper_name_or_unknown(caplog: py
     ai = Genkit()
     app = FastAPI()
 
-    @app.post('/named', response_model=None)
+    @app.post('/named')
     @genkit_fastapi_handler(ai)
     async def wrapped_route() -> Any:
         raise RuntimeError('db pool closed')
 
     async def load_route(_name: str) -> Any:
         raise RuntimeError('db pool closed')
 
-    app.post('/partial', response_model=None)(genkit_fastapi_handler(ai)(functools.partial(load_route, 'orders')))
+    app.post('/partial')(genkit_fastapi_handler(ai)(functools.partial(load_route, 'orders')))
 
     client = TestClient(app)
     with caplog.at_level(logging.DEBUG, logger='genkit_fastapi._handler'):
@@ -863,7 +864,7 @@ async def chat(_: str) -> str:
 
     app = FastAPI()
 
-    @app.post('/chat', response_model=None)
+    @app.post('/chat')
     @genkit_fastapi_handler(ai, context_provider=require_token)
     async def chat_route():
         return chat
@@ -905,7 +906,7 @@ async def chat(_: str) -> str:
 
     app = FastAPI()
 
-    @app.post('/chat', response_model=None)
+    @app.post('/chat')
     @genkit_fastapi_handler(ai, context_provider=require_token)
     async def chat_route():
         return chat
@@ -922,7 +923,7 @@ def test_fastapi_wrapper_http_
```

**File**: `py/packages/genkit-flask/src/genkit_flask/_handler.py` (modified, +27/-34)
```diff
@@ -21,21 +21,27 @@
 import logging
 from asyncio import AbstractEventLoop
 from collections.abc import AsyncIterable, AsyncIterator, Awaitable, Callable, Iterable
-from typing import Any, TypeAlias, TypeVar, cast
+from typing import Any, TypeVar, cast
 
 from flask import Response, request
-from pydantic import BaseModel
 from werkzeug.exceptions import HTTPException
 
 from genkit import Genkit, GenkitError, PublicError
 from genkit.plugin_api import Action
-from genkit.web import ContextProvider, RequestData, error_body, error_status, read_body, wants_stream
+from genkit.web import (
+    ContextProvider,
+    RequestData,
+    error_json,
+    error_sse,
+    error_status,
+    read_body,
+    result_json,
+    to_sse,
+    wants_stream,
+)
 
 logger = logging.getLogger(__name__)  # noqa: TID251
 
-# Compact JSON (no spaces) for smaller wire payload.
-_JSON_SEPARATORS = (',', ':')
-
 
 def _log_failure(*, error: Exception, flow: str, where: str) -> None:
     """Log a served-action failure to the host web server's stdlib logger, naming the action.
@@ -55,7 +61,7 @@ def _log_failure(*, error: Exception, flow: str, where: str) -> None:
 def _error_response(error: Exception, status: int | None = None) -> Response:
     return Response(
         status=error_status(error) if status is None else status,
-        response=json.dumps(error_body(error), separators=_JSON_SEPARATORS),
+        response=error_json(error),
         mimetype='application/json',
     )
 
@@ -69,11 +75,6 @@ def _parse_request_json() -> object:
         raise PublicError('INVALID_ARGUMENT', 'request body must be valid JSON') from err
 
 
-def _to_dict(obj: Any) -> Any:  # noqa: ANN401
-    """Convert object to dict if it's a Pydantic model, otherwise return as-is."""
-    return obj.model_dump() if isinstance(obj, BaseModel) else obj
-
-
 T = TypeVar('T')
 
 
@@ -104,10 +105,6 @@ async def get_next() -> tuple[bool, T | None]:
         yield obj
 
 
-# Type alias for Flask-compatible route handler return type
-FlaskRouteReturn: TypeAlias = Response | dict[str, object] | Iterable[Any]
-
-
 class _FlaskRequestData(RequestData):
     def __init__(self, input_data: dict[str, Any]) -> None:
         super().__init__(
@@ -121,7 +118,7 @@ def __init__(self, input_data: dict[str, Any]) -> None:
 def genkit_flask_handler(
     ai: Genkit,
     context_provider: ContextProvider | None = None,
-) -> Callable[[Action], Callable[..., Awaitable[FlaskRouteReturn]]]:
+) -> Callable[[Action], Callable[..., Awaitable[Response]]]:
     """A decorator for serving Genkit flows via a Flask server.
 
     The returned view function is named after the flow (dots replaced with
@@ -151,11 +148,11 @@ async def say_hi(name: str, ctx: FlowContext) -> str:
     """
     loop = _create_loop()
 
-    def decorator(flow: Action) -> Callable[..., Awaitable[FlaskRouteReturn]]:
+    def decorator(flow: Action) -> Callable[..., Awaitable[Response]]:
         if not isinstance(flow, Action):
             raise GenkitError(status='INVALID_ARGUMENT', message='must apply @genkit_flask_handler on a @flow')
 
-        async def handler() -> FlaskRouteReturn:
+        async def handler() -> Response:
             try:
                 input_data = _parse_request_json()
             except PublicError as e:
@@ -189,24 +186,20 @@ async def handler() -> FlaskRouteReturn:
                 async def async_gen() -> AsyncIterator[str]:
                     try:
                         stream_response = flow.stream(input=action_input, context=action_context, init=init)
-                        async for chunk in stream_response.stream:
-                            yield f'data: {json.dumps({"message": _to_dict(chunk)}, separators=_JSON_SEPARATORS)}\n\n'
-
-                        result = await stream_response.response
-                        yield f'data: {json.dumps({"result": _to_dict(result)}, separators=_JSON_SEPARATORS)}\n\n'
                     except Exception as e:
                         _log_failure(error=e, flow=flow.name, where='stream')
-                        yield f'data: {json.dumps({"error": error_body(e)}, separators=_JSON_SEPARATORS)}\n\n'
+                        yield error_sse(e)
+                        return
+                    async for line in to_sse(stream_response):
+                        yield line
 
-                iter = _iter_over_async(async_gen(), loop)
-                return iter
-            else:
-                try:
-                    response = await flow.run(input=action_input, context=action_context, init=init)
-                    return {'result': _to_dict(response.response)}
-                except Exception as e:
-                    _log_failure(error=e, flow=flow.name, where='run')
-                    return _error_response(e)
+                return Response(_iter_over_async(async_gen(), loop), mimetype='text/event-stream')
+            try:
+                response = await flow.run(input=action_input, context=action_contex
```

#### Recent Merged Pull Requests:
- **PR #7089** (closed): build(deps): bump minimatch, genkit-cli and rimraf in /samples/js-menu (@dependabot[bot])
- **PR #7088** (closed): build(deps): bump protobufjs from 7.4.0 to 7.6.6 in /samples/js-menu (@dependabot[bot])
- **PR #7077** (2026-11-04): fix(cli): reuse telemetry server URL across MCP runtime starts (@MichaelDoyle)
- **PR #7069** (closed): build(deps): bump the tools-dependencies group in /genkit-tools with 19 updates (@dependabot[bot])
- **PR #7068** (closed): build(deps-dev): bump the root-dependencies group with 10 updates (@dependabot[bot])
- **PR #7067** (closed): build(deps): bump the go-dependencies group in /go with 30 updates (@dependabot[bot])

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

## X. py): a failing tool cancels and awaits the other tools in its turn (#6952)

**RULE**:
When implementing operations in `py/packages/genkit/src/genkit/_ai/_generate.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in genkit-ai/genkit. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b1aff696`: py): a failing tool cancels and awaits the other tools in its turn (#6952). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `py/packages/genkit/src/genkit/_ai/_generate.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
        raise GenkitError(status='CANCELLED', message='Generation aborted.')
    except asyncio.CancelledError as exc:
        stamp_cancelled_error(exc=exc, messages=call.messages)
        raise
def stamp_cancelled_error(
    *,
    exc: asyncio.CancelledError,
    messages: list[Message],
) -> None:
    """Attach the closed history onto a foreign CancelledError as ``messages``.

    The history ends at the last completed round. The unfinished turn is
    dropped, as on a failed or aborted response. Only the exception is
    stamped, never the current task: a long-lived caller task would carry
    stale history into later calls. Read it back with
    ``genkit._core._compat.cancelled_history``, which handles 3.10 re-raising
    a fresh ``CancelledError`` on await.
    """
    exc.__dict__['messages'] = [as_message(m) for m in messages]


def raise_if_foreign_cancel(
    *,
    exc: BaseException,
    abort_signal: asyncio.Event,
    messages: list[Message] | None = None,
) -> None:
        if messages is not None:
            stamp_cancelled_error(exc=exc, messages=messages)
        raise_if_foreign_cancel(
            exc=exc,
            abort_signal=ctx.abort_signal,
           
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
        raise GenkitError(status='ABORTED', message='Generation aborted.')
def raise_if_foreign_cancel(*, exc: BaseException, abort_signal: asyncio.Event) -> None:
        raise_if_foreign_cancel(exc=exc, abort_signal=ctx.abort_signal)
        raise_if_foreign_cancel(exc=exc, abort_signal=ctx.abort_signal)
        raise_if_foreign_cancel(exc=exc, abort_signal=ctx.abort_signal)
    outs = await asyncio.gather(*[run_one_tool(tool, trp) for _, tool, trp in work])
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b1aff696` are properly handled with clean fallback behavior.
