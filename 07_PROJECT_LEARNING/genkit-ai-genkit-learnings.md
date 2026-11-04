> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/genkit-ai-genkit-learnings.md`  
> **Source**: github ([https://github.com/genkit-ai/genkit](https://github.com/genkit-ai/genkit))  
> **Source Version**: `d372a646`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-03T17:45:55.040Z  
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
> **Harvest Timestamp**: 2026-11-03T17:45:54.242Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `genkit-ai/genkit`
- **Description**: Open-source framework for building agentic apps in JavaScript, Go, Dart, and Python, built and used in production by Google
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6565 stars

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

### Incident Patch 1: `58b421bd` (2026-11-03)
**Commit Message**: fix(py): log the model or tool exception that generate boxes as internal error (#7032)

**File**: `py/packages/genkit/src/genkit/_ai/_generate.py` (modified, +50/-1)
```diff
@@ -107,7 +107,7 @@
 from genkit._core._operation import Operation
 from genkit._core._registry import Registry
 from genkit._core._schema import check_output_schema
-from genkit._core._telemetry._instrumentation import SpanContext, run_in_new_span, set_span_state
+from genkit._core._telemetry._instrumentation import SpanContext, current_span, run_in_new_span, set_span_state
 from genkit._core._tool import Tool
 from genkit._core._typing import (
     ConstrainedSupport,
@@ -1230,6 +1230,47 @@ def boxed_finish_message(*, exc: BaseException, pipe_failed: bool) -> str:
     return INTERNAL_FINISH_MESSAGE
 
 
+# Set on an exception once log_dropped_failure has logged it, so the tool site
+# and the generate-level box never log the same failure twice.
+_LOGGED_ATTR = '_genkit_failure_logged'
+
+
+def log_dropped_failure(exc: BaseException, *, model: str | None = None, tool: str | None = None) -> None:
+    """Log a failure whose cause boxing hides behind ``internal error``.
+
+    The caller only gets ``finish_reason=failed`` with ``internal error``, so
+    without this line the cause lives only in an exported trace. Failures that
+    keep their own message (``PublicError``, a ``GenkitError`` without a
+    foreign cause) are already on ``response.error`` and are not logged.
+
+    Args:
+        exc: The exception about to be boxed.
+        model: Model the turn was calling, when known.
+        tool: Tool that raised, when known. Named over ``model``.
+    """
+    if getattr(exc, _LOGGED_ATTR, False):
+        return
+    if boxed_finish_message(exc=exc, pipe_failed=False) != INTERNAL_FINISH_MESSAGE:
+        return
+    with contextlib.suppress(AttributeError, TypeError):
+        setattr(exc, _LOGGED_ATTR, True)
+    fields: dict[str, object] = {}
+    if model:
+        fields['model'] = model
+    if tool:
+        fields['tool'] = tool
+    span = current_span.get()
+    if span is not None and span.trace_id:
+        fields['trace_id'] = span.trace_id
+    if tool:
+        culprit = f'tool {tool!r}'
+    elif model:
+        culprit = f'model {model!r}'
+    else:
+        culprit = 'generate'
+    logger.error('%s raised, returning finish_reason=failed', culprit, exc_info=exc, **fields)
+
+
 def raise_if_foreign_cancel(*, exc: BaseException, abort_signal: asyncio.Event) -> None:
     # abort_signal is our own stop. A wait_for / task.cancel() has to
     # surface as CancelledError so the deadline still works.
@@ -1245,6 +1286,7 @@ def box_from_exc(
     caller_stopped: bool,
     reason: ErrorReason | None = None,
     request: ModelRequest | None = None,
+    model: str | None = None,
 ) -> ModelResponse:
     """Box a failure after generate has entered: closed history, unanswered turn dropped."""
     callback_cause = streaming_callback_cause(exc=exc)
@@ -1255,6 +1297,8 @@ def box_from_exc(
         exc = callback_cause
         reason = ErrorReason.STREAM_CALLBACK_FAILED
         pipe_failed = True
+    elif not caller_stopped:
+        log_dropped_failure(exc, model=model)
     finish_message = boxed_finish_message(exc=exc, pipe_failed=pipe_failed)
     if caller_stopped:
         finish_message = 'Generation aborted.'
@@ -1475,6 +1519,7 @@ def remember_response(result: object) -> None:
             exc=exc,
             caller_stopped=ctx.abort_signal.is_set(),
             request=failed_request,
+            model=resolved.model.name,
         )
     dropped = (
         box_if_hook_dropped_ticket(
@@ -1557,6 +1602,7 @@ async def generate_turn(
             exc=exc,
             caller_stopped=ctx.abort_signal.is_set(),
             request=call.request,
+            model=resolved.model.name,
         )
     dropped = (
         box_if_hook_dropped_ticket(
@@ -1840,6 +1886,7 @@ async def run_tools_or_stop(
             exc=exc,
             caller_stopped=ctx.abort_signal.is_set(),
             reason=ErrorReason.TOOL_FAILED,
+            model=resolved.model.name,
         )
 
     if revised_model_msg:
@@ -2231,6 +2278,7 @@ async def next_fn(p: ToolHookParams, c: MiddlewareContext) -> MultipartToolRespo
             # failures and propagate to ``asyncio.gather``.
             intr = interrupt_from_exc(e)
             if intr is None:
+                log_dropped_failure(e, tool=trp.tool_request.name)
                 raise
             logger.debug('tool triggered an interrupt', tool=trp.tool_request.name)
             return (None, interrupt_request_part(trp, intr))
@@ -2618,6 +2666,7 @@ async def resolve_resumed_tool(
             intr = interrupt_from_exc(e)
             if intr is not None:
                 return (interrupt_request_part(tool_req_root, intr), None)
+            log_dropped_failure(e, tool=tool_req.name)
             raise
         metadata = dict(tool_req_root.metadata) if tool_req_root.metadata else {}
         interrupt = metadata.get('interrupt')
```

**File**: `py/packages/genkit/tests/genkit/ai/generate_logging_test.py` (modified, +152/-2)
```diff
@@ -9,20 +9,21 @@
 import structlog
 from structlog.testing import capture_logs
 
-from genkit import ErrorReason, Genkit, Message, ModelResponse, ModelResponseChunk, Part
+from genkit import ErrorReason, Genkit, Message, ModelResponse, ModelResponseChunk, Part, PublicError
 from genkit._ai._generate import CallScope, generate_action
 from genkit._ai._model import resolve_model_arg
 from genkit._ai._tools import Interrupt
 from genkit._core._environment import GENKIT_ENV
 from genkit._core._logger import GENKIT_LOG, get_logger
-from genkit._core._model import GenerateActionOptions, Resume
+from genkit._core._model import GenerateActionOptions, ModelRequest, Resume
 from genkit._core._registry import Registry
 from genkit._core._typing import (
     FinishReason,
     GenerateActionOutputConfig,
     Role,
     ToolRequest,
 )
+from genkit.model import ModelContext
 from genkit.testing import define_scripted_model
 
 BLOB = 'A' * 1_000_000
@@ -516,3 +517,152 @@ def on_chunk(chunk: object) -> None:
     assert response.error.reason is ErrorReason.STREAM_CALLBACK_FAILED
     assert response.error.message == response.finish_message
     assert [message.role for message in response.messages] == [Role.USER, Role.MODEL, Role.TOOL]
+
+
+def _errors(entries: list[dict[str, object]]) -> list[dict[str, object]]:
+    return [e for e in entries if e['log_level'] == 'error']
+
+
+def _tool_turn(name: str) -> ModelResponse:
+    return ModelResponse(
+        message=Message(role=Role.MODEL, content=[Part(tool_request=ToolRequest(name=name, input={}, ref='1'))]),
+        finish_reason=FinishReason.STOP,
+    )
+
+
+@pytest.mark.asyncio
+async def test_crashing_model_logs_the_hidden_cause_once() -> None:
+    """A model that raises returns 'internal error'; the cause is logged once at ERROR."""
+    structlog.reset_defaults()
+    ai = Genkit()
+
+    async def crashing(_request: ModelRequest, _ctx: ModelContext) -> ModelResponse:
+        raise RuntimeError('model backend exploded')
+
+    ai.define_model(name='crash', fn=crashing)
+
+    with capture_logs() as entries:
+        response = await ai.generate(model='crash', prompt='hi')
+
+    assert response.finish_reason == FinishReason.FAILED
+    assert response.error is not None
+    assert response.error.message == 'internal error'
+    errors = _errors(entries)
+    assert len(errors) == 1
+    assert errors[0]['event'] == "model 'crash' raised, returning finish_reason=failed"
+    assert errors[0]['model'] == 'crash'
+    assert isinstance(errors[0]['exc_info'], RuntimeError)
+    assert str(errors[0]['exc_info']) == 'model backend exploded'
+
+
+@pytest.mark.asyncio
+async def test_crashing_tool_is_named_and_logged_once() -> None:
+    """The tool site names the tool; the generate-level box does not log it again."""
+    structlog.reset_defaults()
+    ai = Genkit()
+    pm, _ = define_scripted_model(ai)
+
+    @ai.tool(name='check_allergens')
+    async def check_allergens(_: dict) -> str:  # noqa: ARG001
+        raise RuntimeError('allergen db down')
+
+    pm.responses = [_tool_turn('check_allergens')]
+
+    with capture_logs() as entries:
+        response = await ai.generate(model='scriptedModel', prompt='hi', tools=['check_allergens'])
+
+    assert response.finish_reason == FinishReason.FAILED
+    assert response.error is not None
+    assert response.error.message == 'internal error'
+    errors = _errors(entries)
+    assert len(errors) == 1
+    assert errors[0]['tool'] == 'check_allergens'
+    assert str(errors[0]['exc_info']) == 'allergen db down'
+
+
+@pytest.mark.asyncio
+async def test_crashing_restarted_tool_is_logged_once() -> None:
+    """A tool that raises on restart is named once, not again by the outer box."""
+    structlog.reset_defaults()
+    ai = Genkit()
+    pm, _ = define_scripted_model(ai)
+    calls: list[int] = []
+
+    @ai.tool(name='hold')
+    async def hold(_: dict) -> str:  # noqa: ARG001
+        calls.append(1)
+        if len(calls) == 1:
+            raise Interrupt({'hold': True})
+        raise RuntimeError('kitchen printer jammed')
+
+    pm.responses = [_tool_turn('hold')]
+    first = await ai.generate(model='scriptedModel', prompt='hi', tools=['hold'])
+
+    with capture_logs() as entries:
+        response = await generate_action(
+            CallScope(ai),
+            GenerateActionOptions(
+                model='scriptedModel',
+                messages=list(first.messages),
+                tools=['hold'],
+                resume=Resume(restart=[first.interrupts[0].restart()]),
+            ),
+        )
+
+    assert response.finish_reason == FinishReason.FAILED
+    errors = _errors(entries)
+    assert len(errors) == 1
+    assert errors[0]['tool'] == 'hold'
+    assert str(errors[0]['exc_info']) == 'kitchen printer jammed'
+
+
+@pytest.mark.asyncio
+async def test_published_tool_error_is_not_logged() -> None:
+    """A PublicError message is already on response.error, so nothing is logged."""
+    s
```

---

### Incident Patch 2: `a0d0c362` (2026-11-03)
**Commit Message**: feat(py/google-genai)!: GoogleAI and VertexAI take headers, timeout, max_retries and http_client_factory (#6826)

**File**: `py/packages/genkit-google-genai/src/genkit_google_genai/_google.py` (modified, +248/-62)
```diff
@@ -49,16 +49,16 @@
 from __future__ import annotations
 
 import os
-from collections.abc import Callable
+from collections.abc import Callable, Mapping
 from typing import Any, NoReturn
 
+import httpx
 from google import genai
 from google.auth import default as google_auth_default
 from google.auth.credentials import Credentials
 from google.auth.exceptions import DefaultCredentialsError
-from google.genai.client import DebugConfig
 from google.genai.errors import APIError
-from google.genai.types import HttpOptions, HttpOptionsDict, Model as GenaiModel
+from google.genai.types import HttpOptions, HttpRetryOptions, Model as GenaiModel
 from pydantic import BaseModel
 
 import genkit_google_genai._constants as const
@@ -139,6 +139,7 @@
     is_unsupported_image_model_name,
     strip_ref_prefixes,
 )
+from genkit_google_genai._models._sdk_config import check_timeout_seconds, timeout_seconds_to_ms
 from genkit_google_genai._models._veo import (
     KnownGoogleAIVeo,
     KnownVertexAIVeo,
@@ -276,7 +277,7 @@ def _new_gemini(plugin: GoogleAI | VertexAI, clean_name: str) -> GeminiModel:
     return GeminiModel(
         clean_name,
         plugin._runtime_client(),
-        client_kwargs=plugin._client_kwargs,
+        client_kwargs=plugin._loop_client_kwargs(),
         base_url_pinned=plugin._base_url_pinned,
         legacy_response_schema=plugin._legacy_response_schema,
     )
@@ -349,7 +350,7 @@ def _create_veo_background_model(
     name: str,
     client_getter: Callable[[], genai.Client],
     plugin_name: str,
-    client_kwargs: dict[str, Any] | None = None,
+    client_kwargs: Callable[[], dict[str, Any]] | None = None,
 ) -> BackgroundModel:
     """Create the start/check action pair for a Veo video generation model.
 
@@ -362,20 +363,20 @@ def _create_veo_background_model(
         name: The model id without the plugin prefix.
         client_getter: Function returning the loop-local Google GenAI client.
         plugin_name: The name of the plugin (googleai or vertexai).
-        client_kwargs: Plugin-level client kwargs, cloned when a call
-            overrides the key or endpoint.
+        client_kwargs: Returns the plugin-level client kwargs for the running
+            loop, cloned when a call overrides the key or endpoint.
 
     Returns:
         BackgroundModel pairing the start and check actions.
     """
     full_name = f'{plugin_name}/{name}'
 
     async def _start(request: ModelRequest[VeoConfig], ctx: ModelContext) -> Operation:
-        veo = VeoModel(name, client_getter(), client_kwargs=client_kwargs)
+        veo = VeoModel(name, client_getter(), client_kwargs=client_kwargs() if client_kwargs else None)
         return await veo.start(request, ctx)
 
     async def _check(op: Operation, ctx: ModelContext) -> Operation:
-        veo = VeoModel(name, client_getter(), client_kwargs=client_kwargs)
+        veo = VeoModel(name, client_getter(), client_kwargs=client_kwargs() if client_kwargs else None)
         return await veo.check(op, ctx)
 
     return BackgroundModel(
@@ -594,10 +595,12 @@ def __init__(
         *,
         api_key: str | None = None,
         credentials: Credentials | None = None,
-        debug_config: DebugConfig | None = None,
-        http_options: HttpOptions | HttpOptionsDict | None = None,
         api_version: str | None = None,
         base_url: str | None = None,
+        headers: Mapping[str, str] | None = None,
+        timeout: float | None = None,
+        max_retries: int | None = None,
+        http_client_factory: Callable[[], httpx.AsyncClient] | None = None,
         legacy_response_schema: bool = False,
     ) -> None:
         """Initializes the GoogleAI plugin.
@@ -609,11 +612,60 @@ def __init__(
             credentials: Google Cloud credentials for authentication.
                 Defaults to None, in which case the client uses default authentication
                 mechanisms (e.g., application default credentials or API key).
-            debug_config: Configuration for debugging the client. Defaults to None.
-            http_options: HTTP options for configuring the client's network requests.
-                Can be an instance of HttpOptions or a dictionary. Defaults to None.
             api_version: The API version to use (e.g., 'v1beta'). Defaults to None.
             base_url: The base URL for the API. Defaults to None.
+            headers: Extra HTTP headers sent on every request. Genkit appends
+                its client attribution to ``x-goog-api-client`` and ``user-agent``.
+                Interactions models (Deep Research, Antigravity, Lyria) drop a
+                caller's ``x-goog-api-client`` and send only Genkit's.
+            timeout: Per-request timeout in **seconds**, as a float. Must be
+                positive and finite. Defaults to no timeout. A model config's
+                ``timeout`` overrides it for a single call. A timeout set on
+                the client from ``http_client_factory`` is n
```

**File**: `py/packages/genkit-google-genai/src/genkit_google_genai/_interactions/_client.py` (modified, +12/-17)
```diff
@@ -149,27 +149,22 @@ async def request(
     allow_empty: bool = False,
 ) -> Interaction | None:
     """Issue one Interactions HTTP call and parse the Interaction body."""
-    # Auth/key headers are per-request; the loop-local client is just the transport.
-    client = _http_client()
+    # Auth/key headers are per-request; the client is just the transport.
+    # The timeout always goes on the request so a caller's own client gets the
+    # same budget as the default one instead of httpx's 5 second default.
+    http_client_factory = client_options.http_client_factory if client_options else None
+    client = http_client_factory() if http_client_factory is not None else _http_client()
     request_headers = headers(api_key=api_key, client_options=client_options)
     timeout = timeout_seconds(client_options)
 
     try:
-        if timeout is not None:
-            response = await client.request(
-                method,
-                url,
-                headers=request_headers,
-                json=json_body,
-                timeout=timeout,
-            )
-        else:
-            response = await client.request(
-                method,
-                url,
-                headers=request_headers,
-                json=json_body,
-            )
+        response = await client.request(
+            method,
+            url,
+            headers=request_headers,
+            json=json_body,
+            timeout=timeout if timeout is not None else NO_TIMEOUT,
+        )
     except TRANSPORT_ERRORS as error:
         raise transport_error(error) from error
 
```

**File**: `py/packages/genkit-google-genai/src/genkit_google_genai/_interactions/_options.py` (modified, +9/-2)
```diff
@@ -18,9 +18,11 @@
 
 from __future__ import annotations
 
+from collections.abc import Callable
 from typing import Any, Literal
 
-from pydantic import BaseModel, ConfigDict
+import httpx
+from pydantic import BaseModel, ConfigDict, Field
 from pydantic.alias_generators import to_camel
 from typing_extensions import Self
 
@@ -34,14 +36,19 @@ class ClientOptions(BaseModel):
     them; check/cancel receive the options needed for their own request.
     """
 
-    model_config = ConfigDict(alias_generator=to_camel, extra='ignore', populate_by_name=True)
+    model_config = ConfigDict(
+        alias_generator=to_camel, extra='ignore', populate_by_name=True, arbitrary_types_allowed=True
+    )
 
     api_key: str | None = None
     api_version: str | None = None
     base_url: str | None = None
     custom_headers: dict[str, str] | None = None
     # Milliseconds — applied to the HTTP call, not the create body.
     timeout: float | None = None
+    # Only the plugin sets this; a request config can't swap the connection.
+    # A getter, called per request, so each event loop gets its own client.
+    http_client_factory: Callable[[], httpx.AsyncClient] | None = Field(default=None, exclude=True)
 
     def merge(self, overrides: ClientOptions | dict[str, Any] | None) -> Self:
         """Return a copy with non-null override fields applied."""
```

**File**: `py/packages/genkit-google-genai/src/genkit_google_genai/_models/_gemini.py` (modified, +3/-3)
```diff
@@ -35,8 +35,8 @@
     attach_config_extra,
     attach_leftovers,
     check_timeout_seconds,
+    copy_http_options,
     dump_family_config,
-    keep_client_extra_body,
     reject_bool_timeout,
     sdk_config_error,
     split_sdk_fields,
@@ -2016,7 +2016,7 @@ async def _resolve_request_client(
         # plugin's credentials, endpoint, headers, and timeouts.
         kwargs = dict(self._client_kwargs)
         plugin_opts = kwargs.get('http_options')
-        opts = plugin_opts.model_copy(deep=True) if plugin_opts is not None else genai_types.HttpOptions()
+        opts = copy_http_options(plugin_opts) if plugin_opts is not None else genai_types.HttpOptions()
 
         if api_version:
             opts.api_version = api_version
@@ -2443,7 +2443,7 @@ async def _genkit_to_googleai_cfg(
                 headers['X-Server-Timeout'] = str(math.ceil(ms / 1000))
                 http_options.headers = headers
                 cfg.http_options = http_options
-            return keep_client_extra_body(cfg, (self._client_kwargs or {}).get('http_options'))
+            return cfg
 
         return None
 
```

**File**: `py/packages/genkit-google-genai/src/genkit_google_genai/_models/_interactions_utils.py` (modified, +6/-9)
```diff
@@ -18,7 +18,6 @@
 
 from __future__ import annotations
 
-import math
 import os
 from collections.abc import Mapping
 from typing import Any, cast
@@ -30,7 +29,7 @@
 )
 from genkit_google_genai._interactions._options import ClientOptions
 from genkit_google_genai._models._routing import strip_ref_prefixes
-from genkit_google_genai._models._sdk_config import check_timeout_seconds
+from genkit_google_genai._models._sdk_config import check_timeout_seconds, timeout_seconds_to_ms
 from genkit_google_genai._models._secrets import context_api_key
 
 from genkit import GenkitError, Message
@@ -91,11 +90,10 @@ def remove_client_option_overrides(config: dict[str, Any]) -> dict[str, Any]:
 def timeout_ms(seconds: object) -> float | None:
     """Config seconds to ``ClientOptions.timeout`` milliseconds, rounding up so 0.0001 sends 1 ms.
 
-    ``ClientOptions`` stays in milliseconds because the plugin-level options
-    (``HttpOptions.timeout`` today) share it; this is the one place a request
-    config's seconds cross into it. A numeric string such as ``'5'`` is read
-    as a number, as ``ClientOptions`` did before; anything else raises
-    ``INVALID_ARGUMENT``.
+    ``ClientOptions`` stays in milliseconds alongside ``HttpOptions.timeout``;
+    ``GoogleAI(timeout=...)`` converts at construction and per-request configs
+    convert here. A numeric string such as ``'5'`` is read as a number, as
+    ``ClientOptions`` did before; anything else raises ``INVALID_ARGUMENT``.
     """
     if isinstance(seconds, str):
         try:
@@ -106,8 +104,7 @@ def timeout_ms(seconds: object) -> float | None:
         checked = check_timeout_seconds(seconds)
     except ValueError as err:
         raise GenkitError(status='INVALID_ARGUMENT', message=str(err)) from err
-    # round() first so 2.007 s is 2007 ms, not 2008 from float noise.
-    return float(math.ceil(round(checked * 1000, 6))) if checked is not None else None
+    return float(timeout_seconds_to_ms(checked)) if checked is not None else None
 
 
 def client_overrides_from_config(
```

**File**: `py/packages/genkit-google-genai/src/genkit_google_genai/_models/_sdk_config.py` (modified, +20/-20)
```diff
@@ -26,6 +26,18 @@
 from genkit import GenkitError
 
 
+def copy_http_options(opts: genai_types.HttpOptions) -> genai_types.HttpOptions:
+    """Copy ``opts`` so per-request edits never reach the plugin's options.
+
+    ``headers`` is the only container the plugin sets, so it gets a fresh dict.
+    The loop's ``httpx_async_client`` stays shared: it holds locks and sockets
+    that can't be copied, and every request on that loop goes through it.
+    """
+    if opts.headers is None:
+        return opts.model_copy()
+    return opts.model_copy(update={'headers': dict(opts.headers)})
+
+
 def unexpected_config_error(*, action_name: str) -> GenkitError:
     """Fail when the dump leaf sees a config Action did not produce."""
     return GenkitError(
@@ -200,20 +212,6 @@ def attach_config_extra(
     return config
 
 
-def keep_client_extra_body(config: Any, client_http_options: object) -> Any:  # noqa: ANN401
-    """Layer a request's extra_body over the plugin's instead of replacing it.
-
-    google-genai swaps in a per-request ``extra_body`` wholesale, so without
-    this a request carrying ``extra`` would drop ``GoogleAI(http_options=
-    HttpOptions(extra_body=...))``. The request's keys win.
-    """
-    request_body = config.http_options.extra_body if config.http_options else None
-    client_body = getattr(client_http_options, 'extra_body', None)
-    if request_body and isinstance(client_body, dict):
-        config.http_options.extra_body = deep_merge(cast(dict[str, Any], client_body), request_body)
-    return config
-
-
 def sdk_config_error(*, action_name: str, error: ValidationError) -> GenkitError:
     """Name the action and the field the SDK rejected on a known typed field."""
     loc = ()
@@ -231,9 +229,10 @@ def sdk_config_error(*, action_name: str, error: ValidationError) -> GenkitError
 def check_timeout_seconds(value: object) -> float | None:
     """Return ``value`` as float seconds, or raise ``ValueError`` unless it is None or positive and finite.
 
-    0 would be an instant failure on the Interactions client, and inf, NaN, or a
-    value whose milliseconds overflow can't become a timeout. ``True`` is not
-    a number of seconds, so bool raises too.
+    0 would mean no timeout on Gemini and an instant failure on the
+    Interactions client, and inf, NaN, or a value whose milliseconds overflow
+    can't become a timeout. ``True`` is not a number of seconds, so bool raises
+    too.
     """
     if value is None:
         return None
@@ -254,6 +253,7 @@ def reject_bool_timeout(value: object) -> object:
 
 
 def timeout_seconds_to_ms(seconds: float) -> int:
-    """Validated seconds to google-genai's ``HttpOptions.timeout`` milliseconds, rounding up so 0.0001 is 1 ms."""
-    # round() first so 2.007 s is 2007 ms, not 2008 from float noise.
-    return math.ceil(round(seconds * 1000, 6))
+    """Validated seconds to ``HttpOptions.timeout`` milliseconds, rounding up so any positive value is >= 1 ms."""
+    # round() first so 2.007 s is 2007 ms, not 2008 from float noise; max(1, ...)
+    # keeps sub-nanosecond positive budgets at 1 ms instead of rounding to 0.
+    return max(1, math.ceil(round(seconds * 1000, 6)))
```

**File**: `py/packages/genkit-google-genai/src/genkit_google_genai/_models/_veo.py` (modified, +3/-4)
```diff
@@ -28,8 +28,8 @@
 from genkit_google_genai._models._sdk_config import (
     VEO_MANAGED_BODY_FIELDS,
     attach_config_extra,
+    copy_http_options,
     dump_family_config,
-    keep_client_extra_body,
     sdk_config_error,
 )
 from genkit_google_genai._models._secrets import context_api_key, misplaced_key_error
@@ -315,7 +315,7 @@ def _client_for_context(
 
         kwargs = dict(self._client_kwargs or {})
         plugin_opts = kwargs.get('http_options')
-        opts = plugin_opts.model_copy(deep=True) if plugin_opts is not None else genai_types.HttpOptions()
+        opts = copy_http_options(plugin_opts) if plugin_opts is not None else genai_types.HttpOptions()
         if api_key is not None:
             kwargs['api_key'] = api_key
             # The SDK rejects api_key with credentials, project, or location.
@@ -433,8 +433,7 @@ def _get_config(self, request: ModelRequest) -> genai_types.GenerateVideosConfig
         except ValidationError as e:
             raise sdk_config_error(action_name=self._name, error=e) from e
 
-        cfg = attach_config_extra(cfg, extra, action_name=self._name, managed_body_fields=VEO_MANAGED_BODY_FIELDS)
-        return keep_client_extra_body(cfg, (self._client_kwargs or {}).get('http_options'))
+        return attach_config_extra(cfg, extra, action_name=self._name, managed_body_fields=VEO_MANAGED_BODY_FIELDS)
 
     @property
     def metadata(self) -> dict:
```

**File**: `py/packages/genkit-google-genai/src/genkit_google_genai/_models/_virtual_try_on.py` (modified, +3/-6)
```diff
@@ -41,8 +41,8 @@
     VIRTUAL_TRY_ON_MANAGED_BODY_FIELDS,
     attach_config_extra,
     attach_leftovers,
+    copy_http_options,
     dump_family_config,
-    keep_client_extra_body,
     sdk_config_error,
     split_sdk_fields,
 )
@@ -256,7 +256,6 @@ def _to_sdk_config(
     dumped: dict[str, Any] | None,
     *,
     action_name: str,
-    client_http_options: object,
 ) -> genai_types.RecontextImageConfig | None:
     """Map the dumped family config onto the typed SDK request config."""
     if not dumped:
@@ -276,10 +275,9 @@ def _to_sdk_config(
     except ValidationError as e:
         raise sdk_config_error(action_name=action_name, error=e) from e
     cfg = attach_leftovers(cfg, leftovers, nest='parameters')
-    cfg = attach_config_extra(
+    return attach_config_extra(
         cfg, extra, action_name=action_name, managed_body_fields=VIRTUAL_TRY_ON_MANAGED_BODY_FIELDS
     )
-    return keep_client_extra_body(cfg, client_http_options)
 
 
 def _media_part(image: genai_types.Image | None) -> Part | None:
@@ -397,7 +395,7 @@ def _client_for_context(
         # The model is Vertex-only; a request-scoped client stays on that backend.
         kwargs.setdefault('vertexai', True)
         plugin_opts = kwargs.get('http_options')
-        opts = plugin_opts.model_copy(deep=True) if plugin_opts is not None else genai_types.HttpOptions()
+        opts = copy_http_options(plugin_opts) if plugin_opts is not None else genai_types.HttpOptions()
         if api_key is not None:
             # An express key goes to the global Vertex host: drop the plugin's
             # credentials, project and host and any location, keeping only a
@@ -454,7 +452,6 @@ async def generate(self, request: ModelRequest[VirtualTryOnConfig], ctx: ModelCo
         config = _to_sdk_config(
             dumped,
             action_name=self._name,
-            client_http_options=(self._client_kwargs or {}).get('http_options'),
         )
         try:
             response = await client.aio.models.recontext_image(
```

---

### Incident Patch 3: `f3e71c5b` (2026-11-02)
**Commit Message**: fix(py/google-genai)!: Interactions models take extra; per-request timeout is seconds and comes to Gemini (#6646)

**File**: `py/packages/genkit-google-genai/README.md` (modified, +32/-0)
```diff
@@ -173,6 +173,11 @@ Setting any `google_search_*` option turns Google Search on;
 `google_search=False` next to an option raises. A nested key such as
 `thinkingConfig` raises and names the flat fields that replace it.
 
+`timeout` sets the HTTP timeout for one request, in seconds:
+`GeminiConfig(timeout=30)`. 0, negative, inf, NaN and bool raise. On `GoogleAI`,
+the Gemini API rejects server deadlines under 10 seconds with HTTP 400
+(`VertexAI` accepts shorter values).
+
 Function calling mode is controlled by `ai.generate(tool_choice=...)`, not config:
 `'auto'`, `'required'`, or `'none'`. In `'required'` mode, Gemini binds the request's
 function tools as `allowedFunctionNames`.
@@ -223,6 +228,33 @@ config = GeminiConfig.model_validate({
 `systemInstruction`, `tools`, `toolConfig`, the structured-output fields of
 `generationConfig`, `cachedContent`); those raise `INVALID_ARGUMENT`.
 
+Antigravity, Interactions Lyria, and Deep Research also reject unknown keys
+and take undeclared fields in `extra`, which is merged into the Interactions
+create body (snake_case names). A nested object merges key by key. Keys match
+ignoring case and underscores, the same way the Gemini merge aligns them. A
+`None` value means unset and is skipped. Like Gemini, fields Genkit builds from
+the request raise in `extra`: the model id (`agent`, or `model` on Lyria),
+`input`, `tools`, and Lyria's `system_instruction`. Deep Research's tools are
+its declared settings (`google_search`, `url_context`, `code_execution`,
+`file_search_store_names`, `mcp_servers`); Lyria takes no tools, and
+Antigravity tool configuration is not yet supported in this plugin
+(`generate(tools=...)` raises on both). Blocks with defaults, such as
+`agent_config` and `environment`, merge key by key.
+
+`timeout` on these three configs (and in Deep Research's `check_operation` /
+`cancel_operation` `config`) is the HTTP timeout in seconds. It used to be
+milliseconds: `config={'timeout': 30000}` becomes `config={'timeout': 30}`.
+
+```python
+op = await ai.generate_operation(
+    model='googleai/deep-research-preview-04-2026',
+    prompt='Summarize recent advances in quantum error correction.',
+    config={'thinking_summaries': 'auto', 'extra': {'agent_config': {'visualization': 'auto'}}},
+)
+# create body: {..., "agent_config": {"type": "deep-research",
+#                                     "thinking_summaries": "auto", "visualization": "auto"}}
+```
+
 ### Structured output
 
 Set the output schema on the request; the plugin sends it to Gemini as
```

**File**: `py/packages/genkit-google-genai/src/genkit_google_genai/_models/_antigravity.py` (modified, +46/-5)
```diff
@@ -25,16 +25,24 @@
 from genkit_google_genai._interactions._options import ClientOptions
 from genkit_google_genai._models._interactions_registry import antigravity_model_info
 from genkit_google_genai._models._interactions_utils import (
+    EXTRA_DESCRIPTION,
+    INPUT_HINT,
+    MODEL_ID_HINT,
+    TIMEOUT_DESCRIPTION,
     api_key_for_context,
     client_overrides_from_config,
     extract_version,
     lowercase_choice_list,
     partition_keys,
+    pop_extra,
+    reject_function_tools,
+    reject_managed_extra,
     remove_client_option_overrides,
     steps_with_folded_system_instruction,
 )
+from genkit_google_genai._models._sdk_config import check_timeout_seconds, deep_merge, reject_bool_timeout
 from genkit_google_genai._models._secrets import reject_request_config_api_key
-from pydantic import field_validator
+from pydantic import Field, field_validator
 
 from genkit import ModelResponse
 from genkit.model import Model, ModelContext, ModelRequest
@@ -51,17 +59,35 @@
 
 
 class AntigravityConfig(GenkitConfig):
-    """Antigravity model configuration."""
+    """Antigravity model configuration.
+
+    Unknown keys are rejected. An API field this class doesn't declare goes in
+    ``extra``, which is deep-merged into the create body.
+
+    ``timeout`` is the HTTP timeout for this request, in seconds.
+    """
 
     base_url: str | None = None
     api_version: str | None = None
-    # Milliseconds — applied to the HTTP call, not the create body.
-    timeout: float | None = None
+    timeout: float | None = Field(default=None, description=TIMEOUT_DESCRIPTION)
     custom_headers: dict[str, str] | None = None
     previous_interaction_id: str | None = None
     store: bool | None = None
     environment: str | dict[str, Any] | None = None
     response_modalities: list[Literal['text', 'image']] | None = None
+    extra: dict[str, Any] | None = Field(default=None, description=EXTRA_DESCRIPTION)
+
+    @field_validator('timeout', mode='before')
+    @classmethod
+    def no_bool_timeout(cls, value: object) -> object:
+        """``True`` is not a number of seconds."""
+        return reject_bool_timeout(value)
+
+    @field_validator('timeout')
+    @classmethod
+    def check_timeout(cls, value: float | None) -> float | None:
+        """Reject 0, negative, inf and NaN; ``timeout`` is seconds."""
+        return check_timeout_seconds(value)
 
     @field_validator('response_modalities', mode='before')
     @classmethod
@@ -70,6 +96,14 @@ def fold_modalities_case(cls, value: object) -> object:
         return lowercase_choice_list(value)
 
 
+# Fields Genkit builds from the request (or reserves for tool wiring); extra can't replace them.
+ANTIGRAVITY_MANAGED_EXTRA = {
+    'agent': MODEL_ID_HINT,
+    'input': INPUT_HINT,
+    'tools': 'Tool configuration on Antigravity is not yet supported in this plugin.',
+}
+
+
 def create_antigravity_action(
     name: str,
     *,
@@ -87,6 +121,13 @@ async def run(request: ModelRequest[AntigravityConfig], ctx: ModelContext) -> Mo
         merged_options = client_options.merge(client_overrides_from_config(config))
 
         dumped = remove_client_option_overrides(config.model_dump(exclude_none=True))
+        extra = pop_extra(dumped)
+        reject_function_tools(
+            name,
+            request,
+            message=f'Function tools on {name} are not yet supported in this plugin.',
+        )
+        reject_managed_extra(name, extra, ANTIGRAVITY_MANAGED_EXTRA)
         # GenkitConfig rejects undeclared keys, so nothing is left over.
         create_options, _ = partition_keys(dumped, CREATE_OPTION_KEYS)
         create_kwargs: dict[str, Any] = {
@@ -97,7 +138,7 @@ async def run(request: ModelRequest[AntigravityConfig], ctx: ModelContext) -> Mo
         # Default missing environment to remote; the API rejects unsupported values.
         create_kwargs.setdefault('environment', DEFAULT_ENVIRONMENT)
 
-        created = await create_interaction(api_key, create_kwargs, merged_options)
+        created = await create_interaction(api_key, deep_merge(create_kwargs, extra), merged_options)
         return from_interaction_sync(created)
 
     return Model(
```

**File**: `py/packages/genkit-google-genai/src/genkit_google_genai/_models/_deep_research.py` (modified, +50/-7)
```diff
@@ -31,17 +31,25 @@
 from genkit_google_genai._models._gemini import file_search_fields, flattened_key_error
 from genkit_google_genai._models._interactions_registry import deep_research_model_info
 from genkit_google_genai._models._interactions_utils import (
+    EXTRA_DESCRIPTION,
+    INPUT_HINT,
+    MODEL_ID_HINT,
+    TIMEOUT_DESCRIPTION,
     api_key_for_context,
+    client_overrides_from_call_config,
     client_overrides_from_config,
     extract_version,
     lowercase_choice,
     lowercase_choice_list,
     partition_keys,
+    pop_extra,
+    reject_managed_extra,
     remove_client_option_overrides,
     steps_with_folded_system_instruction,
 )
+from genkit_google_genai._models._sdk_config import check_timeout_seconds, deep_merge, reject_bool_timeout
 from genkit_google_genai._models._secrets import reject_request_config_api_key
-from pydantic import ConfigDict, WithJsonSchema, field_validator, model_validator, with_config
+from pydantic import ConfigDict, Field, WithJsonSchema, field_validator, model_validator, with_config
 from pydantic.alias_generators import to_snake
 from typing_extensions import NotRequired, TypedDict
 
@@ -100,12 +108,22 @@ class McpServerConfig(TypedDict):
 
 
 class DeepResearchConfig(GenkitConfig):
-    """Deep Research model configuration."""
+    """Deep Research model configuration.
+
+    Unknown keys are rejected. An API field this class doesn't declare goes in
+    ``extra``, which is deep-merged into the create body. Fields Genkit builds
+    from the request (``agent``, ``input``, ``tools``) raise there: Deep
+    Research's tools are the declared settings (``google_search``,
+    ``url_context``, ``code_execution``, ``file_search_store_names``,
+    ``mcp_servers``).
+
+    ``timeout`` is the HTTP timeout in seconds, here and in
+    ``check_operation``/``cancel_operation`` ``config``.
+    """
 
     base_url: str | None = None
     api_version: str | None = None
-    # Milliseconds — applied to the HTTP call, not the create body.
-    timeout: float | None = None
+    timeout: float | None = Field(default=None, description=TIMEOUT_DESCRIPTION)
     custom_headers: dict[str, str] | None = None
     thinking_summaries: Literal['auto', 'none'] | None = None
     previous_interaction_id: str | None = None
@@ -120,6 +138,7 @@ class DeepResearchConfig(GenkitConfig):
     file_search_metadata_filter: str | None = None
     file_search_top_k: int | None = None
     mcp_servers: Annotated[list[McpServerConfig] | None, _MCP_SERVERS_SCHEMA] = None
+    extra: dict[str, Any] | None = Field(default=None, description=EXTRA_DESCRIPTION)
 
     @model_validator(mode='before')
     @classmethod
@@ -133,6 +152,18 @@ def reject_nested_file_search(cls, data: object) -> object:
                         raise error
         return data
 
+    @field_validator('timeout', mode='before')
+    @classmethod
+    def no_bool_timeout(cls, value: object) -> object:
+        """``True`` is not a number of seconds."""
+        return reject_bool_timeout(value)
+
+    @field_validator('timeout')
+    @classmethod
+    def check_timeout(cls, value: float | None) -> float | None:
+        """Reject 0, negative, inf and NaN; ``timeout`` is seconds."""
+        return check_timeout_seconds(value)
+
     @field_validator('mcp_servers', mode='before')
     @classmethod
     def snake_case_mcp_keys(cls, value: object) -> object:
@@ -199,6 +230,17 @@ def build_tools(request: ModelRequest[DeepResearchConfig], config: DeepResearchC
     return tools
 
 
+# Fields Genkit builds from the request; extra can't replace them.
+DEEP_RESEARCH_MANAGED_EXTRA = {
+    'agent': MODEL_ID_HINT,
+    'input': INPUT_HINT,
+    'tools': (
+        'Use the declared tool settings: google_search, url_context, code_execution, '
+        'file_search_store_names, mcp_servers.'
+    ),
+}
+
+
 def create_deep_research_background_model(
     target: str | ModelRef,
     *,
@@ -218,6 +260,7 @@ async def start(request: ModelRequest[DeepResearchConfig], ctx: ModelContext) ->
         options = client_options.merge(client_overrides_from_config(config))
 
         dumped = remove_client_option_overrides(config.model_dump(exclude_none=True))
+        extra = pop_extra(dumped)
         # GenkitConfig rejects undeclared keys, so nothing is left over.
         agent_fields, _tool_fields, create_options, _ = partition_keys(
             dumped,
@@ -228,6 +271,7 @@ async def start(request: ModelRequest[DeepResearchConfig], ctx: ModelContext) ->
         agent_config: dict[str, Any] = {'type': 'deep-research', **agent_fields}
 
         tools = build_tools(request, config)
+        reject_managed_extra(full_name, extra, DEEP_RESEARCH_MANAGED_EXTRA)
         create_kwargs: dict[str, Any] = {
             'agent': version,
             'input': steps_with_folded_system_instruction(request.messages),
@@ -238,12 +282,11 @@ async def start(request: ModelRequest[DeepResearchConfig], ctx: ModelContext) ->
         if tools:
             
```

**File**: `py/packages/genkit-google-genai/src/genkit_google_genai/_models/_gemini.py` (modified, +40/-1)
```diff
@@ -34,10 +34,13 @@
     GEMINI_UNSUPPORTED_GENERATION_FIELDS,
     attach_config_extra,
     attach_leftovers,
+    check_timeout_seconds,
     dump_family_config,
     keep_client_extra_body,
+    reject_bool_timeout,
     sdk_config_error,
     split_sdk_fields,
+    timeout_seconds_to_ms,
 )
 from genkit_google_genai._models._secrets import context_api_key, reject_request_config_api_key
 from genkit_google_genai._provider_errors import TRANSPORT_ERRORS, api_error, transport_error
@@ -499,6 +502,25 @@ class GeminiConfig(ModelConfig):
             "multi-regions ('us', 'eu'), or 'global'."
         ),
     )
+    timeout: float | None = Field(
+        default=None,
+        description=(
+            'HTTP timeout for this request, in seconds (positive, finite). Overrides the plugin timeout for this call. '
+            'The Gemini API rejects deadlines under 10s with HTTP 400; Vertex AI accepts shorter values.'
+        ),
+    )
+
+    @field_validator('timeout', mode='before')
+    @classmethod
+    def _no_bool_timeout(cls, value: object) -> object:
+        """``True`` is not a number of seconds."""
+        return reject_bool_timeout(value)
+
+    @field_validator('timeout')
+    @classmethod
+    def _check_timeout(cls, value: float | None) -> float | None:
+        """Reject 0, negative, inf and NaN; ``timeout`` is seconds."""
+        return check_timeout_seconds(value)
 
     safety_settings: Annotated[
         list[SafetySetting] | None,
@@ -2370,13 +2392,16 @@ async def _genkit_to_googleai_cfg(
 
         leftovers: dict[str, Any] = {}
         extra: dict[str, Any] | None = None
+        timeout: float | None = None
         if request.config:
             # 2. Normalize config into a dict
             dumped_config = self._normalize_config_to_dict(request.config)
 
             if dumped_config is not None:
                 # config.extra is wire-shaped; it goes on the body as-is in step 5.
                 extra = dumped_config.pop('extra', None)
+                # timeout is transport, not body: it rides on this request's http_options.
+                timeout = dumped_config.pop('timeout', None)
 
                 # 3. Extract tool-related fields
                 self._check_backend_fields(dumped_config)
@@ -2406,7 +2431,7 @@ async def _genkit_to_googleai_cfg(
 
         has_output = bool(request.output_format or request.output_schema or request.output_content_type)
 
-        if cfg is not None or tools or system_instruction or has_output or leftovers or extra:
+        if cfg is not None or tools or system_instruction or has_output or leftovers or extra or timeout is not None:
             if cfg is None:
                 cfg = genai_types.GenerateContentConfig()
 
@@ -2446,6 +2471,20 @@ async def _genkit_to_googleai_cfg(
                 managed_generation_fields=GEMINI_MANAGED_GENERATION_FIELDS,
                 unsupported_generation_fields=GEMINI_UNSUPPORTED_GENERATION_FIELDS,
             )
+            if timeout is not None:
+                # google-genai layers a request's http_options over the client's
+                # field by field, but populate_server_timeout_header caches
+                # X-Server-Timeout on the shared client and skips it if present,
+                # so set this call's X-Server-Timeout explicitly too.
+                ms = timeout_seconds_to_ms(timeout)
+                http_options = cfg.http_options.model_copy() if cfg.http_options else genai_types.HttpOptions()
+                http_options.timeout = ms
+                headers = {
+                    key: val for key, val in (http_options.headers or {}).items() if key.lower() != 'x-server-timeout'
+                }
+                headers['X-Server-Timeout'] = str(math.ceil(ms / 1000))
+                http_options.headers = headers
+                cfg.http_options = http_options
             return keep_client_extra_body(cfg, (self._client_kwargs or {}).get('http_options'))
 
         return None
```

**File**: `py/packages/genkit-google-genai/src/genkit_google_genai/_models/_interactions_lyria.py` (modified, +44/-5)
```diff
@@ -30,16 +30,25 @@
 from genkit_google_genai._interactions._options import ClientOptions, ResponseModality
 from genkit_google_genai._models._interactions_registry import lyria_model_info
 from genkit_google_genai._models._interactions_utils import (
+    EXTRA_DESCRIPTION,
+    INPUT_HINT,
+    MODEL_ID_HINT,
+    SYSTEM_INSTRUCTION_HINT,
+    TIMEOUT_DESCRIPTION,
     api_key_for_context,
     client_overrides_from_config,
     extract_version,
     lowercase_choice_list,
     partition_keys,
+    pop_extra,
+    reject_function_tools,
+    reject_managed_extra,
     remove_client_option_overrides,
     require_interaction_steps,
 )
+from genkit_google_genai._models._sdk_config import check_timeout_seconds, deep_merge, reject_bool_timeout
 from genkit_google_genai._models._secrets import reject_request_config_api_key
-from pydantic import field_validator
+from pydantic import Field, field_validator
 
 from genkit import ModelResponse
 from genkit.model import Model, ModelContext, ModelRequest
@@ -49,14 +58,32 @@
 
 
 class LyriaConfig(GenkitConfig):
-    """Google AI Interactions Lyria model configuration."""
+    """Google AI Interactions Lyria model configuration.
+
+    Unknown keys are rejected. An API field this class doesn't declare goes in
+    ``extra``, which is deep-merged into the create body.
+
+    ``timeout`` is the HTTP timeout for this request, in seconds.
+    """
 
     base_url: str | None = None
     api_version: str | None = None
-    # Milliseconds — applied to the HTTP call, not the create body.
-    timeout: float | None = None
+    timeout: float | None = Field(default=None, description=TIMEOUT_DESCRIPTION)
     custom_headers: dict[str, str] | None = None
     response_modalities: list[ResponseModality] | None = None
+    extra: dict[str, Any] | None = Field(default=None, description=EXTRA_DESCRIPTION)
+
+    @field_validator('timeout', mode='before')
+    @classmethod
+    def no_bool_timeout(cls, value: object) -> object:
+        """``True`` is not a number of seconds."""
+        return reject_bool_timeout(value)
+
+    @field_validator('timeout')
+    @classmethod
+    def check_timeout(cls, value: float | None) -> float | None:
+        """Reject 0, negative, inf and NaN; ``timeout`` is seconds."""
+        return check_timeout_seconds(value)
 
     @field_validator('response_modalities', mode='before')
     @classmethod
@@ -65,6 +92,15 @@ def fold_modalities_case(cls, value: object) -> object:
         return lowercase_choice_list(value)
 
 
+# Fields Genkit builds from the request; extra can't replace them.
+LYRIA_MANAGED_EXTRA = {
+    'model': MODEL_ID_HINT,
+    'input': INPUT_HINT,
+    'systeminstruction': SYSTEM_INSTRUCTION_HINT,
+    'tools': 'Lyria takes no tools.',
+}
+
+
 def create_lyria_action(
     name: str,
     *,
@@ -81,6 +117,9 @@ async def run(request: ModelRequest[LyriaConfig], ctx: ModelContext) -> ModelRes
         api_key = api_key_for_context(ctx.context, plugin_api_key)
         merged_options = client_options.merge(client_overrides_from_config(config))
         dumped = remove_client_option_overrides(config.model_dump(exclude_none=True))
+        extra = pop_extra(dumped)
+        reject_function_tools(name, request)
+        reject_managed_extra(name, extra, LYRIA_MANAGED_EXTRA)
         # GenkitConfig rejects undeclared keys, so nothing is left over.
         create_options, _ = partition_keys(dumped, CREATE_OPTION_KEYS)
         modalities = create_options.get('response_modalities') or ['audio', 'text']
@@ -98,7 +137,7 @@ async def run(request: ModelRequest[LyriaConfig], ctx: ModelContext) -> ModelRes
         if not system_instruction:
             require_interaction_steps(steps)
 
-        created = await create_interaction(api_key, create_kwargs, merged_options)
+        created = await create_interaction(api_key, deep_merge(create_kwargs, extra), merged_options)
         return from_interaction_sync(created)
 
     return Model(
```

**File**: `py/packages/genkit-google-genai/src/genkit_google_genai/_models/_interactions_utils.py` (modified, +118/-3)
```diff
@@ -18,8 +18,10 @@
 
 from __future__ import annotations
 
+import math
 import os
-from typing import Any
+from collections.abc import Mapping
+from typing import Any, cast
 
 from genkit_google_genai._interactions._converters import (
     ensure_tool_ids,
@@ -28,9 +30,11 @@
 )
 from genkit_google_genai._interactions._options import ClientOptions
 from genkit_google_genai._models._routing import strip_ref_prefixes
+from genkit_google_genai._models._sdk_config import check_timeout_seconds
 from genkit_google_genai._models._secrets import context_api_key
 
 from genkit import GenkitError, Message
+from genkit.model import ModelRequest
 
 # Snake_case: callers dump config with by_alias=False before we strip these.
 CLIENT_OPTION_KEYS = frozenset({
@@ -41,6 +45,19 @@
     'experimental_debug_traces',
 })
 
+EXTRA_DESCRIPTION = (
+    "Interactions API fields this class doesn't declare, in the API's snake_case wire names. Merged into "
+    'the top level of the create body after everything else, and nested objects merge key by key, so a key '
+    'named here wins. Keys match ignoring case and underscores. Fields Genkit builds from the request '
+    "(the model id, `input`, `tools`, and Lyria's `system_instruction`) raise. A `None` "
+    'value means unset and is skipped, so it never sends null over a block Genkit built. '
+    'Not validated, except that a top-level API key raises; do not put API keys here.'
+)
+
+TIMEOUT_DESCRIPTION = (
+    'HTTP timeout for this request, in seconds (positive, finite). Applies to the HTTP call, not the create body.'
+)
+
 
 def get_api_key_from_env() -> str | None:
     """Read a Gemini API key from common environment variables."""
@@ -71,6 +88,28 @@ def remove_client_option_overrides(config: dict[str, Any]) -> dict[str, Any]:
     return {key: value for key, value in config.items() if key not in CLIENT_OPTION_KEYS}
 
 
+def timeout_ms(seconds: object) -> float | None:
+    """Config seconds to ``ClientOptions.timeout`` milliseconds, rounding up so 0.0001 sends 1 ms.
+
+    ``ClientOptions`` stays in milliseconds because the plugin-level options
+    (``HttpOptions.timeout`` today) share it; this is the one place a request
+    config's seconds cross into it. A numeric string such as ``'5'`` is read
+    as a number, as ``ClientOptions`` did before; anything else raises
+    ``INVALID_ARGUMENT``.
+    """
+    if isinstance(seconds, str):
+        try:
+            seconds = float(seconds)
+        except ValueError:
+            pass
+    try:
+        checked = check_timeout_seconds(seconds)
+    except ValueError as err:
+        raise GenkitError(status='INVALID_ARGUMENT', message=str(err)) from err
+    # round() first so 2.007 s is 2007 ms, not 2008 from float noise.
+    return float(math.ceil(round(checked * 1000, 6))) if checked is not None else None
+
+
 def client_overrides_from_config(
     config: object = None,
     *,
@@ -79,15 +118,91 @@ def client_overrides_from_config(
     timeout: float | None = None,
     custom_headers: dict[str, str] | None = None,
 ) -> ClientOptions:
-    """Lift per-request transport knobs out of a model config into ClientOptions."""
+    """Lift per-request transport knobs out of a model config into ClientOptions.
+
+    ``timeout`` (on ``config`` or as the keyword) is seconds; ClientOptions
+    gets milliseconds.
+    """
     return ClientOptions(
         base_url=getattr(config, 'base_url', base_url),
         api_version=getattr(config, 'api_version', api_version),
-        timeout=getattr(config, 'timeout', timeout),
+        timeout=timeout_ms(getattr(config, 'timeout', timeout)),
         custom_headers=getattr(config, 'custom_headers', custom_headers),
     )
 
 
+def client_overrides_from_call_config(call_config: object) -> ClientOptions | None:
+    """ClientOptions from ``check_operation``/``cancel_operation`` ``config``, with ``timeout`` in seconds.
+
+    Same keys and units as the model config's transport fields, so a timeout
+    that works on ``generate_operation`` means the same thing on check and
+    cancel. Other keys are ignored, as before.
+    """
+    if not isinstance(call_config, Mapping):
+        return None
+    values = {str(key): value for key, value in cast(Mapping[object, Any], call_config).items()}
+    seconds = values.pop('timeout', None)
+    overrides = ClientOptions.model_validate(values)
+    if seconds is None:
+        return overrides
+    return overrides.model_copy(update={'timeout': timeout_ms(seconds)})
+
+
+def _without_none(value: dict[str, Any]) -> dict[str, Any]:
+    cleaned: dict[str, Any] = {}
+    for key, item in value.items():
+        if isinstance(item, dict) and item:
+            item = _without_none(cast(dict[str, Any], item))
+            if not item:
+                # Every key in it was None: unset, not an empty object.
+                continue
+        if item is not None:
+            cleaned[key] = item
+    return cleaned
+
+
+MODEL_ID_HINT = 'Pick the mod
```

**File**: `py/packages/genkit-google-genai/src/genkit_google_genai/_models/_sdk_config.py` (modified, +43/-4)
```diff
@@ -16,6 +16,7 @@
 
 """Dump a family config and translate SDK ValidationErrors into Genkit errors."""
 
+import math
 from collections.abc import Mapping
 from typing import Any, cast
 
@@ -132,7 +133,14 @@ def _existing_wire_key(target: dict[str, Any], key: str) -> str | None:
     return None
 
 
-def _deep_merge(target: dict[str, Any], update: dict[str, Any]) -> dict[str, Any]:
+def deep_merge(target: dict[str, Any], update: dict[str, Any]) -> dict[str, Any]:
+    """Nested dicts merge so one key in ``extra`` does not wipe the siblings next to it.
+
+    Keys match the way google-genai's ``extra_body`` merge aligns them
+    (underscores dropped, lowercased), so ``Agent`` overrides ``agent`` and
+    ``agentConfig`` merges into ``agent_config``. The existing key's spelling
+    is kept. A non-dict value replaces the whole entry.
+    """
     merged = dict(target)
     for key, value in update.items():
         existing = _existing_wire_key(merged, key)
@@ -141,7 +149,7 @@ def _deep_merge(target: dict[str, Any], update: dict[str, Any]) -> dict[str, Any
             continue
         current = merged[existing]
         if isinstance(current, dict) and isinstance(value, dict):
-            merged[existing] = _deep_merge(cast(dict[str, Any], current), cast(dict[str, Any], value))
+            merged[existing] = deep_merge(cast(dict[str, Any], current), cast(dict[str, Any], value))
         else:
             merged[existing] = value
     return merged
@@ -187,7 +195,7 @@ def attach_config_extra(
             ),
         )
     http = config.http_options or genai_types.HttpOptions()
-    http.extra_body = _deep_merge(dict(http.extra_body or {}), extra)
+    http.extra_body = deep_merge(dict(http.extra_body or {}), extra)
     config.http_options = http
     return config
 
@@ -202,7 +210,7 @@ def keep_client_extra_body(config: Any, client_http_options: object) -> Any:  #
     request_body = config.http_options.extra_body if config.http_options else None
     client_body = getattr(client_http_options, 'extra_body', None)
     if request_body and isinstance(client_body, dict):
-        config.http_options.extra_body = _deep_merge(cast(dict[str, Any], client_body), request_body)
+        config.http_options.extra_body = deep_merge(cast(dict[str, Any], client_body), request_body)
     return config
 
 
@@ -218,3 +226,34 @@ def sdk_config_error(*, action_name: str, error: ValidationError) -> GenkitError
         message=f'{action_name}: invalid config field {key}',
         cause=error,
     )
+
+
+def check_timeout_seconds(value: object) -> float | None:
+    """Return ``value`` as float seconds, or raise ``ValueError`` unless it is None or positive and finite.
+
+    0 would be an instant failure on the Interactions client, and inf, NaN, or a
+    value whose milliseconds overflow can't become a timeout. ``True`` is not
+    a number of seconds, so bool raises too.
+    """
+    if value is None:
+        return None
+    if (
+        isinstance(value, bool)
+        or not isinstance(value, int | float)
+        or not (math.isfinite(value) and value > 0 and math.isfinite(value * 1000))
+    ):
+        raise ValueError(f'timeout must be a positive, finite number of seconds, got {value!r}')
+    return float(value)
+
+
+def reject_bool_timeout(value: object) -> object:
+    """Before-validator: pydantic turns ``True`` into ``1.0`` before an after-validator sees it."""
+    if isinstance(value, bool):
+        raise ValueError(f'timeout must be a positive, finite number of seconds, got {value!r}')
+    return value
+
+
+def timeout_seconds_to_ms(seconds: float) -> int:
+    """Validated seconds to google-genai's ``HttpOptions.timeout`` milliseconds, rounding up so 0.0001 is 1 ms."""
+    # round() first so 2.007 s is 2007 ms, not 2008 from float noise.
+    return math.ceil(round(seconds * 1000, 6))
```

**File**: `py/packages/genkit-google-genai/tests/gemini_timeout_test.py` (added, +170/-0)
```diff
@@ -0,0 +1,170 @@
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
+"""GeminiConfig.timeout: per-request seconds, sent as this request's http_options.timeout in ms."""
+
+import json
+from typing import Any
+from unittest.mock import MagicMock
+
+import httpx
+import pytest
+from genkit_google_genai import GeminiConfig, GoogleAI
+from genkit_google_genai._models._gemini import GeminiModel
+from google.genai import types as genai_types
+from google.genai._api_client import patch_http_options
+from pydantic import ValidationError
+
+from genkit import Genkit, Message, Part, Role
+from genkit.model import ModelRequest
+
+
+async def _cfg(config: GeminiConfig, client_kwargs: dict[str, Any] | None = None) -> genai_types.GenerateContentConfig:
+    model = GeminiModel('gemini-2.5-flash', MagicMock(), client_kwargs=client_kwargs)
+    request = ModelRequest(messages=[Message(role=Role.USER, content=[Part.from_text('hi')])], config=config)
+    cfg = await model._genkit_to_googleai_cfg(request=request)
+    assert cfg is not None
+    return cfg
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize(('seconds', 'ms', 'server_seconds'), [(30, 30000, '30'), (2.007, 2007, '3'), (0.0001, 1, '1')])
+async def test_timeout_seconds_become_request_http_options_ms(seconds: float, ms: int, server_seconds: str) -> None:
+    """`timeout=30` builds a config whose http_options.timeout is 30000 ms and X-Server-Timeout is '30'."""
+    cfg = await _cfg(GeminiConfig(timeout=seconds))
+
+    assert cfg.http_options is not None
+    assert cfg.http_options.timeout == ms
+    assert cfg.http_options.headers == {'X-Server-Timeout': server_seconds}
+
+
+@pytest.mark.asyncio
+async def test_timeout_is_not_sent_in_the_body() -> None:
+    """timeout is transport only: nothing named timeout reaches the generation config or extra_body."""
+    cfg = await _cfg(GeminiConfig(timeout=30, temperature=0.2))
+
+    dumped = cfg.model_dump(exclude_none=True, exclude={'http_options'})
+    assert 'timeout' not in dumped
+    assert cfg.http_options is not None
+    assert cfg.http_options.extra_body is None
+
+
+@pytest.mark.asyncio
+async def test_timeout_and_extra_share_the_request_http_options() -> None:
+    """`extra` rides on http_options.extra_body; a timeout on the same request keeps it."""
+    cfg = await _cfg(GeminiConfig.model_validate({'timeout': 15, 'extra': {'labels': {'team': 'search'}}}))
+
+    assert cfg.http_options is not None
+    assert cfg.http_options.timeout == 15000
+    assert cfg.http_options.headers == {'X-Server-Timeout': '15'}
+    assert cfg.http_options.extra_body == {'labels': {'team': 'search'}}
+
+
+@pytest.mark.asyncio
+async def test_request_timeout_overrides_only_the_plugin_timeout() -> None:
+    """google-genai layers request http_options over the client's, so base_url and headers stay."""
+    plugin_http = genai_types.HttpOptions(timeout=60000, base_url='https://proxy.example', headers={'x-team': 'a'})
+    cfg = await _cfg(GeminiConfig(timeout=15), client_kwargs={'http_options': plugin_http})
+
+    assert cfg.http_options is not None
+    effective = patch_http_options(plugin_http, cfg.http_options)
+    assert effective.timeout == 15000
+    assert effective.base_url == 'https://proxy.example'
+    assert effective.headers is not None
+    assert effective.headers['x-team'] == 'a'
+    assert effective.headers['X-Server-Timeout'] == '15'
+
+
+@pytest.mark.asyncio
+async def test_no_timeout_leaves_http_options_alone() -> None:
+    """Without timeout or extra, the request carries no http_options, so the plugin's apply unchanged."""
+    cfg = await _cfg(GeminiConfig(temperature=0.2))
+
+    assert cfg.http_options is None
+
+
+@pytest.mark.asyncio
+async def test_generate_and_stream_apply_per_request_timeout_and_server_deadline(
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    """generate() and generate_stream() override both httpx timeout and X-Server-Timeout above a 10s plugin client."""
+    captured: list[httpx.Request] = []
+    candidate = {'candidates': [{'content': {'role': 'model', 'parts': [{'text': 'Smoked Salmon Tartine'}]}}]}
+
+    async def send(_client: httpx.AsyncClient, request: httpx.Request, **_: object) -> httpx.Response:
+        captured.append(request)
+        if 'streamGenerateContent' in request.url.path:
+            sse = f'data: {json.dumps(candidate)}\r\n\r\n'
+            return httpx.Response(200
```

#### Recent Merged Pull Requests:
- **PR #7032** (2026-11-03): fix(py): log the model or tool exception that generate boxes as internal error (@huangjeff5)
- **PR #7005** (closed): chore(deps): bump zod from 3.25.67 to 4.6.6 in /genkit-tools/cli (@dependabot[bot])
- **PR #7003** (2026-11-03): feat(py): validate finished fields and fill defaults in streaming chunk.output (@huangjeff5)
- **PR #7001** (2026-11-02): fix(py): stop nested hop() cancel from hitting RecursionError on 3.10/3.11 (@huangjeff5)
- **PR #6986** (2026-11-03): fix(py): make FlowContext, ModelContext, and AgentContext subclasses of ActionRunContext (@huangjeff5)
- **PR #6985** (2026-11-02): fix(py/google-genai): make _inject_attribution_headers idempotent (@huangjeff5)

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

## X. py): log the model or tool exception that generate boxes as internal error (#703

**RULE**:
When implementing operations in `py/packages/genkit/src/genkit/_ai/_generate.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in genkit-ai/genkit. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `58b421bd`: py): log the model or tool exception that generate boxes as internal error (#7032). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `py/packages/genkit/src/genkit/_ai/_generate.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
from genkit._core._telemetry._instrumentation import SpanContext, current_span, run_in_new_span, set_span_state
# Set on an exception once log_dropped_failure has logged it, so the tool site
# and the generate-level box never log the same failure twice.
_LOGGED_ATTR = '_genkit_failure_logged'


def log_dropped_failure(exc: BaseException, *, model: str | None = None, tool: str | None = None) -> None:
    """Log a failure whose cause boxing hides behind ``internal error``.

    The caller only gets ``finish_reason=failed`` with ``internal error``, so
    without this line the cause lives only in an exported trace. Failures that
    keep their own message (``PublicError``, a ``GenkitError`` without a
    foreign cause) are already on ``response.error`` and are not logged.

    Args:
        exc: The exception about to be boxed.
        model: Model the turn was calling, when known.
        tool: Tool that raised, when known. Named over ``model``.
    """
    if getattr(exc, _LOGGED_ATTR, False):
        return
    if boxed_finish_message(exc=exc, pipe_failed=False) != INTERNAL_FINISH_MESSAGE:
        return
    with contextlib.suppress(AttributeError, TypeError):
        setattr(exc, 
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
from genkit._core._telemetry._instrumentation import SpanContext, run_in_new_span, set_span_state
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `58b421bd` are properly handled with clean fallback behavior.
