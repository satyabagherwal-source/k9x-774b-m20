> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/genkit-ai-genkit-learnings.md`  
> **Source**: github ([https://github.com/genkit-ai/genkit](https://github.com/genkit-ai/genkit))  
> **Source Version**: `c0c89086`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-22T17:45:05.983Z  
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
> **Harvest Timestamp**: 2026-10-22T17:45:05.976Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `genkit-ai/genkit`
- **Description**: Open-source framework for building agentic apps in JavaScript, Go, Dart, and Python, built and used in production by Google
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6542 stars

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

import { BaseRuntimeManager } from '@genkit-ai/tools-common/manager';
import { z } from 'zod';
import { startDevProcessManager, startManager } from '../utils/manager-utils';

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
- **Issue #6864** (2026-10-22): **fix(cli): add MCP server instructions and descriptive tool metadata for deferred tool search**
  *Symptoms*: ## Description  Coding agents that defer MCP tool schemas behind dynamic tool search (such as Claude Code's `ToolSearch`) list connected MCP tools **by name only** in the initial context (`<available-deferred-tools>`) and omit individual tool `description`s and `inputSchema`s until the model explicitly queries `ToolSearch`.  In recent evaluations of `genkit mcp` under Claude Code, Sonnet discovered the Genkit MCP server in only 2 of 4 attempts and Haiku in only 6 of 75 attempts.  ### Root Cause  1. **Missing server-level `instructions` (and `description`) in [`genkit-tools/cli/src/mcp/server.ts`](https://github.com/firebase/genkit/blob/main/genkit-tools/cli/src/mcp/server.ts):**    ```ts    const server = new McpServer({      name: 'Genkit MCP',      version: '0.0.2',    });    ```    When `ToolSearch` defers individual tool schemas, the **only** text from an MCP server that Claude Code injects upfront into the system prompt (`# MCP Server Instructions`) is the `instructions` field returned in the `initialize` result (`new McpServer(serverInfo, { instructions })`). Because `server.ts` omits `instructions` (and `description` on `serverInfo`), agents see only bare tool names with zero upfront context on what the Genkit MCP server provides or when to search for its tools. 2. **Generic descriptions on `run_flow` and `get_trace`:**    - [`genkit-tools/cli/src/mcp/flows.ts`](https://github.com/firebase/genkit/blob/main/genkit-tools/cli/src/mcp/flows.ts): `run_flow` uses `descriptio

- **Issue #6798** (2026-10-20): **[JS] @genkit-ai/anthropic: empty reasoning part with signature throws "Unsupported genkit part fields"**
  *Symptoms*: **Describe the bug** Claude can return a `thinking` block with an empty `thinking` string and a valid `signature`. @genkit-ai/anthropic converts it to:  `{ "reasoning": "", "metadata": { "thoughtSignature": "CAQS..." } }`  Any later request that includes this message in its history throws before the API is called. In a persisted chat/agent session, every later turn then fails, because the part stays in history.  ``` Error: Unsupported genkit part fields encountered for current message role: {"reasoning":"","metadata":{"thoughtSignature":"CAQS..."}}.     at BetaRunner.toAnthropicMessageContent (@genkit-ai/anthropic/src/runner/beta.ts:280:11)     at Array.map (<anonymous>)     at BetaRunner.toAnthropicMessages (@genkit-ai/anthropic/src/runner/base.ts:398:35)     at BetaRunner.toAnthropicStreamingRequestBody (@genkit-ai/anthropic/src/runner/beta.ts:367:39)     at BetaRunner.run (@genkit-ai/anthropic/src/runner/base.ts:480:25)     at @genkit-ai/anthropic/src/models.ts:181:27     at @genkit-ai/ai/src/model.ts:172:12 ```  The cause is the truthiness check in `toAnthropicMessageContent`, in both runner/beta.ts and runner/stable.ts:  ```ts if (part.reasoning) {   const signature = this.getThinkingSignature(part);   ...   return { type: 'thinking', thinking: part.reasoning, signature }; } ``` "" is falsy. The part has no text, media, toolRequest or toolResponse either, so it reaches the final throw.  **To Reproduce** ```ts import { genkit } from 'genkit'; import { anthropic } from '@g

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

### Incident Patch 1: `c0c89086` (2026-10-22)
**Commit Message**: chore(js): remove outdated .guides directories (#6870)

**File**: `js/genkit/.guides/config.json` (removed, +0/-39)
```diff
@@ -1,39 +0,0 @@
-{
-  "mcpServers": {
-    "genkit": {
-      "command": "genkit",
-      "args": ["mcp"]
-    }
-  },
-  "docs": [
-    {
-      "url": "https://genkit.dev/docs/models.md",
-      "name": "generate-content",
-      "title": "Generate Content",
-      "description": "read before generating content (text, structured data, images, videos) with Genkit."
-    },
-    {
-      "url": "https://genkit.dev/docs/flows.md",
-      "name": "flows",
-      "title": "Using Flows to build GenAI Workflows",
-      "description": "read before building API endpoints or repeatable, strongly-typed workflows with Genkit"
-    },
-    {
-      "url": "https://genkit.dev/docs/tool-calling.md",
-      "name": "tool-calling",
-      "title": "Tool Calling",
-      "description": "read before adding tools/function calls to Genkit for GenAI"
-    },
-    {
-      "url": "https://genkit.dev/docs/interrupts.md",
-      "name": "tool-calling/interrupts",
-      "title": "Interrupts (Tool Calling with Human-in-the-Loop)",
-      "description": "read to understand how to use interrupts to provide human-in-the-loop capabilities to Genkit agents"
-    },
-    {
-      "url": "https://genkit.dev/docs/context.md",
-      "name": "context",
-      "description": "read to understand how to pass context to tools and flows without exposing sensitive data to the LLM"
-    }
-  ]
-}
```

**File**: `js/genkit/.guides/setup.md` (removed, +0/-31)
```diff
@@ -1,31 +0,0 @@
-Follow these instructions to set up Genkit in the current codebase. These instructions are general-purpose and have not been written with specific codebase knowledge, so use your best judgement when following them.
-
-0. Tell the user "I'm going to check out your workspace and set you up to use Genkit for GenAI workflows."
-1. If the current workspace is empty or is a starter template, your goal will be to create a simple image generation flow that allows someone to generate an image based on a prompt and selectable style. If the current workspace is not empty, you will create a simple example flow to help get the user started.
-2. Check to see if any Genkit provider plugin (such as `@genkit-ai/google-genai` or `@genkit-ai/oai-compat` or others, may start with `genkitx-*`) is installed. If not, install `@genkit-ai/google-genai`. If this is a Next.js app, install `@genkit-ai/next` as well.
-3. Search the codebase for the exact string `genkit(` (remember to escape regexes properly) which would indicate that the user has already set up Genkit in the codebase. If found, no need to set it up again, tell the user "Genkit is already configured in this app." and exit this workflow.
-4. Create an `ai` directory in the primary source directory of the project (this may be e.g. `src` but is project-dependent).
-5. Create `{sourceDir}/ai/genkit.ts` and populate it using the example below. DO NOT add a `next` plugin to the file, ONLY add a model provider plugin to the plugins array:
-
-```ts
-import { genkit, z } from 'genkit';
-import { googleAI } from '@genkit-ai/google-genai';
-
-export const ai = genkit({
-  plugins: [googleAI()],
-  model: googleAI.model('gemini-2.5-flash'),
-});
-
-export { z };
-```
-
-6. Create `{sourceDir}/ai/tools` and `{sourceDir}/ai/flows` directories, but leave them empty for now.
-7. Create `{sourceDir}/ai/index.ts` and populate it with the following (change the import to match import aliases in `tsconfig.json` as needed):
-
-```ts
-import './genkit.js';
-// import each created flow, tool, etc. here for use in the Genkit Dev UI
-```
-
-8. Add a `genkit:ui` script to `package.json` that runs `npx genkit-cli start -- npx tsx --watch {sourceDir}/ai/index.ts` (or `pnpm dlx` or `yarn dlx` for those package managers). DO NOT try to run the script now.
-9. Tell the user "Genkit is now configured and ready for use." as setup is now complete. Also remind them to set appropriate env variables (e.g. `GEMINI_API_KEY` for Google providers). Wait for the user to prompt further before creating any specific flows.
```

**File**: `js/genkit/.guides/style.md` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-- Prefer destructuring generate calls e.g. `const {text} = await ai.generate(...)`
```

**File**: `js/genkit/.guides/usage.md` (removed, +0/-63)
```diff
@@ -1,63 +0,0 @@
-## Basic Example
-
-```ts
-import { genkit, z } from "genkit";
-// this example uses Gemini, but Genkit supports other provider plugins
-import { googleAI } from "@genkit-ai/google-genai";
-
-const ai = genkit({
-  plugins: [googleAI()],
-  // optional: assign a default model
-  model: googleAI.model('gemini-2.5-flash'),
-});
-
-const myTool = ai.defineTool({name, description, inputSchema: z.object(...)}, (input) => {...});
-
-const {text} = await ai.generate({
-  model: googleAI.model('gemini-2.5-flash'), // optional if default model is configured
-  system: "the system instructions", // optional
-  prompt: "the content of the prompt",
-  // OR, for multi-modal content
-  prompt: [{text: "what is this image?"}, {media: {url: "data:image/png;base64,..."}}],
-  tools: [myTool],
-});
-
-// structured output
-const CharacterSchema = z.object({...}); // make sure to use .describe() on fields
-const {output} = await ai.generate({
-  prompt: "generate an RPG character",
-  output: {schema: CharacterSchema},
-});
-```
-
-## Important API Clarifications
-
-**IMPORTANT:** This app uses Genkit v1.x which has changed significantly from pre-1.0 versions. Important changes include:
-
-```ts
-const response = await ai.generate(...);
-
-response.text // CORRECT 1.x syntax
-response.text() // INCORRECT pre-1.0 syntax
-
-response.output // CORRECT 1.x syntax
-response.output() // INCORRECT pre-1.0 syntax
-
-const {stream, response} = ai.generateStream(...); // IMPORTANT: no `await` needed
-for await (const chunk of stream) { } // CORRECT 1.x syntax
-for await (const chunk of stream()) { } // INCORRECT pre-1.0 syntax
-await response; // CORRECT 1.x syntax
-await response(); // INCORRECT pre-1.0 syntax
-await ai.generate({..., model: googleAI.model('gemini-2.5-flash')}); // CORRECT 1.x syntax
-await ai.generate({..., model: gemini15Pro}); // INCORRECT pre-1.0 syntax
-
-const ai = genkit({...}); // CORRECT 1.x syntax
-configureGenkit({...}); // INCORRECT pre-1.0 syntax
-
-ai.defineFlow({...}, (input) => {...}); // CORRECT 1.x syntax
-import { defineFlow } from "..."; // INCORRECT pre-1.0 syntax
-```
-
-- Use `import {z} from "genkit"` when you need Zod to get an implementation consistent with Genkit.
-- When defining Zod schemas, ONLY use basic scalar, object, and array types. Use `.optional()` when needed and `.describe('...')` to add descriptions for output schemas.
-- Genkit has many capabilities, make sure to read docs when you need to use them.
```

**File**: `js/plugins/express/.guides/usage.md` (removed, +0/-110)
```diff
@@ -1,110 +0,0 @@
-Genkit's Express integration makes it easy to expose Genkit flows as Express API endpoints:
-
-```ts
-import express from 'express';
-import { expressHandler } from '@genkit-ai/express';
-import { simpleFlow } from './flows/simple-flow.js';
-
-const app = express();
-app.use(express.json());
-
-app.post('/simpleFlow', expressHandler(simpleFlow));
-
-app.listen(8080);
-```
-
-You can also handle auth using context providers:
-
-```ts
-import { UserFacingError } from 'genkit';
-import { ContextProvider, RequestData } from 'genkit/context';
-
-const context: ContextProvider<Context> = (req: RequestData) => {
-  if (req.headers['authorization'] !== 'open sesame') {
-    throw new UserFacingError('PERMISSION_DENIED', 'not authorized');
-  }
-  return {
-    auth: {
-      user: 'Ali Baba',
-    },
-  };
-};
-
-app.post(
-  '/simpleFlow',
-  authMiddleware,
-  expressHandler(simpleFlow, { context })
-);
-```
-
-Flows and actions exposed using the `expressHandler` function can be accessed using `genkit/beta/client` library:
-
-```ts
-import { runFlow, streamFlow } from 'genkit/beta/client';
-
-const result = await runFlow({
-  url: `http://localhost:${port}/simpleFlow`,
-  input: 'say hello',
-});
-
-console.log(result); // hello
-```
-
-```ts
-// set auth headers (when using auth policies)
-const result = await runFlow({
-  url: `http://localhost:${port}/simpleFlow`,
-  headers: {
-    Authorization: 'open sesame',
-  },
-  input: 'say hello',
-});
-
-console.log(result); // hello
-```
-
-```ts
-// and streamed
-const result = streamFlow({
-  url: `http://localhost:${port}/simpleFlow`,
-  input: 'say hello',
-});
-for await (const chunk of result.stream) {
-  console.log(chunk);
-}
-console.log(await result.output);
-```
-
-You can use `startFlowServer` to quickly expose multiple flows and actions:
-
-```ts
-import { startFlowServer } from '@genkit-ai/express';
-import { genkit } from 'genkit';
-
-const ai = genkit({});
-
-export const menuSuggestionFlow = ai.defineFlow(
-  {
-    name: 'menuSuggestionFlow',
-  },
-  async (restaurantTheme) => {
-    // ...
-  }
-);
-
-startFlowServer({
-  flows: [menuSuggestionFlow],
-});
-```
-
-You can also configure the server:
-
-```ts
-startFlowServer({
-  flows: [menuSuggestionFlow],
-  port: 4567,
-  cors: {
-    origin: '*',
-  },
-});
-```
```

**File**: `js/plugins/fastify/.guides/usage.md` (removed, +0/-107)
```diff
@@ -1,107 +0,0 @@
-Genkit's Fastify integration makes it easy to expose Genkit flows as Fastify API endpoints:
-
-```ts
-import Fastify from 'fastify';
-import { fastifyHandler } from '@genkit-ai/fastify';
-import { simpleFlow } from './flows/simple-flow.js';
-
-const app = Fastify();
-
-app.post('/simpleFlow', fastifyHandler(simpleFlow));
-
-await app.listen({ port: 8080 });
-```
-
-You can also handle auth using context providers:
-
-```ts
-import { UserFacingError } from 'genkit';
-import { ContextProvider, RequestData } from 'genkit/context';
-
-const contextProvider: ContextProvider<Context> = (req: RequestData) => {
-  if (req.headers['authorization'] !== 'open sesame') {
-    throw new UserFacingError('PERMISSION_DENIED', 'not authorized');
-  }
-  return {
-    auth: {
-      user: 'Ali Baba',
-    },
-  };
-};
-
-app.post('/simpleFlow', fastifyHandler(simpleFlow, { contextProvider }));
-```
-
-Flows and actions exposed using the `fastifyHandler` function can be accessed using the `genkit/beta/client` library:
-
-```ts
-import { runFlow, streamFlow } from 'genkit/beta/client';
-
-const result = await runFlow({
-  url: `http://localhost:${port}/simpleFlow`,
-  input: 'say hello',
-});
-
-console.log(result); // hello
-```
-
-```ts
-// set auth headers (when using auth policies)
-const result = await runFlow({
-  url: `http://localhost:${port}/simpleFlow`,
-  headers: {
-    Authorization: 'open sesame',
-  },
-  input: 'say hello',
-});
-
-console.log(result); // hello
-```
-
-```ts
-// and streamed
-const result = streamFlow({
-  url: `http://localhost:${port}/simpleFlow`,
-  input: 'say hello',
-});
-for await (const chunk of result.stream) {
-  console.log(chunk);
-}
-console.log(await result.output);
-```
-
-You can register the `genkitFastify` plugin to quickly expose multiple flows and actions:
-
-```ts
-import Fastify from 'fastify';
-import { genkitFastify } from '@genkit-ai/fastify';
-import { genkit } from 'genkit';
-
-const ai = genkit({});
-
-export const menuSuggestionFlow = ai.defineFlow(
-  {
-    name: 'menuSuggestionFlow',
-  },
-  async (restaurantTheme) => {
-    // ...
-  }
-);
-
-const app = Fastify();
-await app.register(genkitFastify, {
-  flows: [menuSuggestionFlow],
-});
-await app.listen({ port: 8080 });
-```
-
-You can prefix the exposed routes and attach per-flow options:
-
-```ts
-import { genkitFastify, withFlowOptions } from '@genkit-ai/fastify';
-
-await app.register(genkitFastify, {
-  pathPrefix: '/api',
-  flows: [withFlowOptions(menuSuggestionFlow, { contextProvider })],
-});
-```
```

**File**: `js/plugins/google-genai/.guides/docs/editing-images.prompt` (removed, +0/-106)
```diff
@@ -1,106 +0,0 @@
----
-title: Edit images with `gemini-2.5-flash-image-preview` (aka "Nano Banana")
-description: read this if you need to perform sophisticated image edits such as background removal, post matching, character replacement, relighting, on an existing image
----
-
-The `gemini-2.5-flash-image-preview` model (also known as "Nano Banana") can perform sophisticated image edits.
-
-- You must ALWAYS add `{config: {responseModalities: ['TEXT', 'IMAGE']}}` to your `ai.generate` calls when using this model.
-
-<example>
-```ts
-// generate an image from a prompt
-
-import { ai } from "@/ai/genkit"; // or wherever genkit is initialized
-import { googleAI } from "@genkit-ai/google-genai";
-
-const {media} = await ai.generate({
-  model: googleAI.model('gemini-2.5-flash-image-preview'),
-  config: {responseModalities: ['TEXT', 'IMAGE']}},
-  prompt: "generate a picture of a unicorn wearing a space suit on the moon",
-});
-
-return media.url; // --> "data:image/png;base64,..."
-```
-</example>
-
-<example>
-```ts
-// edit an image with a text prompt
-
-import { ai } from "@/ai/genkit"; // or wherever genkit is initialized
-import { googleAI } from "@genkit-ai/google-genai";
-
-const {media} = await ai.generate({
-  model: googleAI.model('gemini-2.5-flash-image-preview'),
-  config: {responseModalities: ['TEXT', 'IMAGE']}},
-  prompt: [
-    {text: "change the person's outfit to a banana costume"},
-    {media: {url: "https://..." /* or 'data:...' */}},
-  ],
-});
-
-return media.url; // --> "data:image/png;base64,..."
-```
-</example>
-
-<example>
-```ts
-// combine multiple images together
-
-import { ai } from "@/ai/genkit"; // or wherever genkit is initialized
-import { googleAI } from "@genkit-ai/google-genai";
-
-const {personImageUri, animalImageUri, sceneryImageUri} = await loadImages(...);
-
-const {media} = await ai.generate({
-  model: googleAI.model('gemini-2.5-flash-image-preview'),
-  config: {responseModalities: ['TEXT', 'IMAGE']}},
-  prompt: [
-    // the model tends to match aspect ratio of the *last* image provided
-    {text: "[PERSON]:\n"},
-    {media: {url: personImageUri}},
-    {text: "\n[ANIMAL]:\n"},
-    {media: {url: animalImageUri}},
-    {text; "\n[SCENERY]:\n"},
-    // IMPORTANT: the model tends to match aspect ratio of the *last* image provided
-    {media: {url: sceneryImageUri}},
-    {text: "make an image of [PERSON] riding a giant version of [ANIMAL] with a background of [SCENERY]"},
-  ],
-});
-
-return media.url; // --> "data:image/png;base64,..."
-```
-</example>
-
-<example>
-```ts
-// use an annotated image to guide generation
-
-import { ai } from "@/ai/genkit"; // or wherever genkit is initialized
-import { googleAI } from "@genkit-ai/google-genai";
-
-const originalImageUri = "data:..."; // the original image
-const annotatedImageUri = "data:..."; // the image with annotations on top of it
-
-const {media} = await ai.generate({
-  model: googleAI.model('gemini-2.5-flash-image-preview'),
-  config: {responseModalities: ['TEXT', 'IMAGE']}},
-  prompt: [
-    
-    {text: "follow the instructions in the following annotated image:"},
-    {media: {url: annotatedImageUri}},
-    {text: "\n\napply the annotated instructions to the original image, making sure to follow the instructions of the annotations.\n\noriginal image:\n"},
-    {media: {url: originalImageUri}},
-  ],
-});
-
-return media.url; // --> "data:image/png;base64,..."
-```
-</example>
-
-## Prompting tips for image editing
-
-- For complex edits prefer a chain of small edits to a single complex edit. Feed the output of one generation as input to the next.
-- Be specific and detailed about the edits you want to make.
-- Be clear whether added images are meant as style or subject references.
\ No newline at end of file
```

**File**: `js/plugins/google-genai/.guides/docs/generating-speech.prompt` (removed, +0/-192)
```diff
@@ -1,192 +0,0 @@
----
-title: Generating Speech with Gemini
-description: read this to understand how to generate realistic speech audio from a text script
----
-
-The Google Genai plugin provides access to text-to-speech capabilities through Gemini TTS models. These models can convert text into natural-sounding speech for various applications.
-
-#### Basic Usage
-
-To generate audio using a TTS model:
-
-```ts
-import { googleAI } from '@genkit-ai/google-genai';
-import { writeFile } from 'node:fs/promises';
-import wav from 'wav'; // npm install wav && npm install -D @types/wav
-
-const ai = genkit({
-  plugins: [googleAI()],
-});
-
-const { media } = await ai.generate({
-  model: googleAI.model('gemini-2.5-flash-preview-tts'),
-  config: {
-    responseModalities: ['AUDIO'],
-    speechConfig: {
-      voiceConfig: {
-        prebuiltVoiceConfig: { voiceName: 'Algenib' },
-      },
-    },
-  },
-  prompt: 'Say that Genkit is an amazing Gen AI library',
-});
-
-if (!media) {
-  throw new Error('no media returned');
-}
-const audioBuffer = Buffer.from(media.url.substring(media.url.indexOf(',') + 1), 'base64');
-// The googleAI plugin returns raw PCM data, which we convert to WAV format.
-await writeFile('output.wav', await toWav(audioBuffer));
-
-async function toWav(pcmData: Buffer, channels = 1, rate = 24000, sampleWidth = 2): Promise<string> {
-  return new Promise((resolve, reject) => {
-    // This code depends on `wav` npm library.
-    const writer = new wav.Writer({
-      channels,
-      sampleRate: rate,
-      bitDepth: sampleWidth * 8,
-    });
-
-    let bufs = [] as any[];
-    writer.on('error', reject);
-    writer.on('data', function (d) {
-      bufs.push(d);
-    });
-    writer.on('end', function () {
-      resolve(Buffer.concat(bufs).toString('base64'));
-    });
-
-    writer.write(pcmData);
-    writer.end();
-  });
-}
-```
-
-#### Multi-speaker Audio Generation
-
-You can generate audio with multiple speakers, each with their own voice:
-
-```ts
-const response = await ai.generate({
-  model: googleAI.model('gemini-2.5-flash-preview-tts'),
-  config: {
-    responseModalities: ['AUDIO'],
-    speechConfig: {
-      multiSpeakerVoiceConfig: {
-        speakerVoiceConfigs: [
-          {
-            speaker: 'Speaker1',
-            voiceConfig: {
-              prebuiltVoiceConfig: { voiceName: 'Algenib' },
-            },
-          },
-          {
-            speaker: 'Speaker2',
-            voiceConfig: {
-              prebuiltVoiceConfig: { voiceName: 'Achernar' },
-            },
-          },
-        ],
-      },
-    },
-  },
-  prompt: `Here's the dialog:
-    Speaker1: "Genkit is an amazing Gen AI library!"
-    Speaker2: "I thought it was a framework."`,
-});
-```
-
-When using multi-speaker configuration, the model automatically detects speaker labels in the text (like "Speaker1:" and "Speaker2:") and applies the corresponding voice to each speaker's lines.
-
-#### Configuration Options
-
-The Gemini TTS models support various configuration options:
-
-##### Voice Selection
-
-You can choose from different pre-built voices with unique characteristics:
-
-```ts
-speechConfig: {
-  voiceConfig: {
-    prebuiltVoiceConfig: {
-      voiceName: 'Algenib' // Other options: 'Achernar', 'Ankaa', etc.
-    },
-  },
-}
-```
-
-Full list of available voices:
-
-- `Zephyr`: Bright
-- `Puck`: Upbeat
-- `Charon`: Informative
-- `Kore`: Firm
-- `Fenrir`: Excitable
-- `Leda`: Youthful
-- `Orus`: Firm
-- `Aoede`: Breezy
-- `Callirrhoe`: Easy-going
-- `Autonoe`: Bright
-- `Enceladus`: Breathy
-- `Iapetus`: Clear
-- `Umbriel`: Easy-going
-- `Algieba`: Smooth
-- `Despina`: Smooth
-- `Erinome`: Clear
-- `Algenib`: Gravelly
-- `Rasalgethi`: Informative
-- `Laomedeia`: Upbeat
-- `Achernar`: Soft
-- `Alnilam`: Firm
-- `Schedar`: Even
-- `Gacrux`: Mature
-- `Pulcherrima`: Forward
-- `Achird`: Friendly
-- `Zubenelgenubi`: Casual
-- `Vindemiatrix`: Gentle
-- `Sadachbia`: Lively
-- `Sadaltager`: Knowledgeable
-- `Sulafat`: Warm
-
-##### Speech Emphasis
-
-You can use markdown-style formatting in your prompt to add emphasis:
-
-- Bold text (`**like this**`) for stronger emphasis
-- Italic text (`*like this*`) for moderate emphasis
-
-Example:
-
-```ts
-prompt: 'Genkit is an **amazing** Gen AI *library*!';
-```
-
-##### Advanced Speech Parameters
-
-For more control over the generated speech:
-
-```ts
-speechConfig: {
-  voiceConfig: {
-    prebuiltVoiceConfig: {
-      voiceName: 'Algenib',
-      speakingRate: 1.0,  // Range: 0.25 to 4.0, default is 1.0
-      pitch: 0.0,         // Range: -20.0 to 20.0, default is 0.0
-      volumeGainDb: 0.0,  // Range: -96.0 to 16.0, default is 0.0
-    },
-  },
-}
-```
-
-- `speakingRate`: Controls the speed of speech (higher values = faster speech)
-- `pitch`: Adjusts the pitch of the voice (higher values = higher pitch)
-- `volumeGainDb`: Controls the volume (higher values = louder)
-
-For more detailed information about the Gemini TTS models and thei
```

---

### Incident Patch 2: `a7b514e9` (2026-10-22)
**Commit Message**: fix(genkit-tools/cli): add MCP server instructions and descriptive tool metadata (#6866)

**File**: `genkit-tools/cli/src/mcp/flows.ts` (modified, +1/-1)
```diff
@@ -68,7 +68,7 @@ export function defineFlowTools(server: McpServer, options: McpToolOptions) {
     'run_flow',
     {
       title: 'Run Flow',
-      description: 'Runs the flow with the provided input',
+      description: 'Executes a Genkit flow with the provided JSON input.',
       inputSchema: getCommonSchema(options.explicitProjectRoot, {
         flowName: z.string().describe('name of the flow; type: string'),
         input: z
```

**File**: `genkit-tools/cli/src/mcp/server.ts` (modified, +13/-4)
```diff
@@ -35,10 +35,19 @@ export async function startMcpServer(params: {
   const { projectRoot, explicitProjectRoot, timeout, auth } = params;
   logger.info(`Starting MCP server in: ${projectRoot}`);
 
-  const server = new McpServer({
-    name: 'Genkit MCP',
-    version: '0.0.2',
-  });
+  const server = new McpServer(
+    {
+      name: 'Genkit MCP',
+      version: '0.0.2',
+      title: 'Genkit MCP Server',
+      description:
+        'Provides Genkit documentation, usage guides, runtime process management, flow discovery/execution, and execution trace inspection.',
+    },
+    {
+      instructions:
+        'Use this server to look up Genkit documentation and API guides (`get_usage_guide`, `search_genkit_docs`, `list_genkit_docs`, `read_genkit_docs`), manage the local Genkit runtime (`start_runtime`, `restart_runtime`, `kill_runtime`), discover and run Genkit flows (`list_flows`, `run_flow`), and inspect execution traces (`get_trace`). Always check `get_usage_guide` or search Genkit docs before implementing Genkit features.',
+    }
+  );
 
   await defineDocsTool(server);
   await defineUsageGuideTool(server);
```

**File**: `genkit-tools/cli/src/mcp/trace.ts` (modified, +2/-1)
```diff
@@ -30,7 +30,8 @@ export function defineTraceTools(server: McpServer, options: McpToolOptions) {
     'get_trace',
     {
       title: 'Get Genkit Trace',
-      description: 'Returns the trace details.',
+      description:
+        'Retrieves the detailed Genkit execution trace (spans, inputs, outputs, and errors) for a flow or action run by its `traceId`.',
       inputSchema: getCommonSchema(options.explicitProjectRoot, {
         traceId: z
           .string()
```

#### Recent Merged Pull Requests:
- **PR #6870** (2026-10-22): chore(js): remove outdated .guides directories (@MichaelDoyle)
- **PR #6866** (2026-10-22): fix(genkit-tools/cli): add MCP server instructions and descriptive tool metadata (@ssbushi)
- **PR #6859** (2026-10-21): feat(js/plugins/google-genai): vertexAI model updates, TTS, Omni... (@ifielker)
- **PR #6855** (2026-10-21): test(js/plugins/google-cloud): stop slow test output and unawaited rejects stalling CI (@pavelgj)
- **PR #6851** (2026-10-21): feat(js/plugins/google-genai): route newer vertexAI Gemini models to Interactions (@ifielker)
- **PR #6838** (2026-10-20): fix(js/plugins/anthropic): send back empty signed thinking blocks (@hkarmoush)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
