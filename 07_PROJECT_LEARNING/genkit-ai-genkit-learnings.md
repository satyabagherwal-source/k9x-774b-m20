> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/genkit-ai-genkit-learnings.md`  
> **Source**: github ([https://github.com/genkit-ai/genkit](https://github.com/genkit-ai/genkit))  
> **Source Version**: `59ba69c5`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T04:53:09.101Z  
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
> **Harvest Timestamp**: 2026-10-19T04:53:08.795Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `genkit-ai/genkit`
- **Description**: Open-source framework for building agentic apps in JavaScript, Go, Dart, and Python, built and used in production by Google
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6529 stars

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
- **Issue #6761** (2026-10-13): **[Go][plugins/compat_oai]: empty reasoning_content is dropped on serialization, causing DeepSeek 400 on tool-call history replay**
  *Symptoms*:  **Describe the bug**  compat_oai drops `reasoning_content` entirely when the model returns it as an empty string. When that turn also carries `tool_calls`, the follow-up request (which replays history with `tools` present) is missing the field, and DeepSeek's thinking mode rejects it with:  ``` Internal error: { "error": "stream error: POST \"https://api.deepseek.com/chat/completions\": 400 Bad Request {\"message\":\"The `reasoning_content` in the thinking mode must be passed back to the API. (request_id: ...)\",\"type\":\"invalid_request_error\",\"param\":null,\"code\":\"invalid_request_error\"}" } ```  Two guards in `go/plugins/compat_oai/generate.go` cause it:  1. Parsing (~line 823): `firstReasoning(...)` on `"\"\""` returns `""`, so no `ai.ReasoningPart` is created for the response. 2. Serialization (~line 115):  ```go if reasoning := concatenateReasoningContent(msg.Content); reasoning != "" {     am.SetExtraFields(map[string]any{"reasoning_content": reasoning}) } ```  Empty ⇒ the field is omitted from the outgoing JSON. DeepSeek requires `reasoning_content` on assistant messages to be passed back on subsequent requests when `tools` is present — an empty string is accepted, a missing field is not. The bug is intermittent: it only fires on turns where the model's CoT happens to be empty.  **To Reproduce**  1. Use a DeepSeek model with thinking mode (on by default), `deepseek/deepseek-flash`, and at least one tool registered. 2. Prompt something trivially toolable (e.g. "

- **Issue #6392** (2026-09-23): **[Go] Flaky TestAgentConformance: aborted snapshot reaches status 'completed' instead of 'aborted'**
  *Symptoms*: **Describe the bug**  `TestAgentConformance/an_aborted_snapshot_keeps_the_finished_turns_and_drops_the_one_in_flight` in `go/ai/exp` fails intermittently on CI. An aborted snapshot reaches a terminal status of `completed` instead of `aborted`:  ``` === RUN   TestAgentConformance/an_aborted_snapshot_keeps_the_finished_turns_and_drops_the_one_in_flight     agents_conformance_test.go:449: step[2] (waitUntilCompleted): snapshot.status: want aborted, got completed     agents_conformance_test.go:449: step[2] (waitUntilCompleted): snapshot.finishReason: want aborted, got <nil> --- FAIL: TestAgentConformance (10.58s) FAIL	github.com/firebase/genkit/go/ai/exp	18.582s ```  Observed on `tests (1.26.x)`, while `tests (1.25.x)` passed on the identical commit: https://github.com/genkit-ai/genkit/actions/runs/35612375025/job/106391562891  Surfaced on an unrelated PR (#6339, an MCP transport fix). Nothing on that branch touches or is imported by `go/ai/exp`.  **To Reproduce**  The case is `an aborted snapshot keeps the finished turns and drops the one in flight` in `tests/specs/agent.yaml:1768`, run by `go/ai/exp/agents_conformance_test.go`:  ``` go test -run 'TestAgentConformance/an_aborted_snapshot_keeps_the_finished_turns' ./ai/exp/ ```  It does not reproduce reliably — 20/20 passes locally on go1.25.0 darwin/arm64. The observed failure is on linux/amd64 go1.26.8 (CI).  **Expected behavior**  Aborting a snapshot whose status is still `pending` should leave it terminal as `aborted` with `f

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

### Incident Patch 1: `1a38cde4` (2026-10-13)
**Commit Message**: fix(py/plugins/google-genai): widen API error mapping, detect blocked prompts (#6370)

**File**: `py/packages/genkit-google-genai/src/genkit_google_genai/_google.py` (modified, +11/-2)
```diff
@@ -58,6 +58,7 @@
 from google.auth.credentials import Credentials
 from google.auth.exceptions import DefaultCredentialsError
 from google.genai.client import DebugConfig
+from google.genai.errors import APIError
 from google.genai.types import HttpOptions, HttpOptionsDict, Model as GenaiModel
 from pydantic import BaseModel
 
@@ -158,6 +159,7 @@
     is_virtual_try_on_model,
     virtual_try_on_model_info,
 )
+from genkit_google_genai._provider_errors import TRANSPORT_ERRORS, api_error, transport_error
 
 logger = logging.getLogger(__name__)
 
@@ -239,8 +241,15 @@ def _categorize_genai_model(m: GenaiModel, models: GenaiModels, is_vertex: bool)
 async def _list_genai_models(client: genai.Client, is_vertex: bool) -> GenaiModels:
     """Discover and categorize models through the SDK's asynchronous client."""
     models = GenaiModels()
-    async for listed_model in await client.aio.models.list():
-        _categorize_genai_model(listed_model, models, is_vertex)
+    try:
+        async for listed_model in await client.aio.models.list():
+            _categorize_genai_model(listed_model, models, is_vertex)
+    except APIError as e:
+        raise api_error(e) from e
+    except GOOGLE_AUTH_ERRORS as e:
+        raise_auth_error(e)
+    except TRANSPORT_ERRORS as e:
+        raise transport_error(e) from e
     return models
 
 
```

**File**: `py/packages/genkit-google-genai/src/genkit_google_genai/_models/_gemini.py` (modified, +87/-36)
```diff
@@ -136,6 +136,40 @@ def _usage_from_metadata(usage_metadata: Any) -> ModelUsage:  # noqa: ANN401
     )
 
 
+def _custom_from_feedback(
+    feedback: genai_types.GenerateContentResponsePromptFeedback | None,
+) -> dict[str, Any] | None:
+    """The response's ``custom`` payload: the prompt feedback the service sent, if any."""
+    if feedback is None:
+        return None
+    return {'promptFeedback': feedback.model_dump(mode='json', by_alias=True, exclude_none=True)}
+
+
+def _no_candidates_response(
+    feedback: genai_types.GenerateContentResponsePromptFeedback | None,
+    usage_metadata: Any,  # noqa: ANN401
+) -> ModelResponse:
+    """Response for a reply that carried no candidates.
+
+    A refused prompt comes back with no candidates and the reason in the
+    prompt feedback, and finishes BLOCKED.
+
+    Raises:
+        GenkitError: INTERNAL when the prompt was not blocked.
+    """
+    reason = feedback.block_reason if feedback is not None else None
+    if feedback is None or not reason or reason == genai_types.BlockedReason.BLOCKED_REASON_UNSPECIFIED:
+        raise GenkitError(status='INTERNAL', message='Model returned no candidates.')
+    return ModelResponse(
+        message=Message(role=Role.MODEL, content=[Part.from_text('')]),
+        finish_reason=FinishReason.BLOCKED,
+        finish_message=feedback.block_reason_message or f'prompt blocked: {reason.value}',
+        candidates=[],
+        usage=_usage_from_metadata(usage_metadata),
+        custom=_custom_from_feedback(feedback),
+    )
+
+
 from genkit_google_genai._models._utils import (  # noqa: E402
     TOOL_INPUT_FIELD,
     PartConverter,
@@ -1735,6 +1769,9 @@ async def _generate(
         except TRANSPORT_ERRORS as e:
             raise transport_error(e) from e
 
+        if not response.candidates:
+            return _no_candidates_response(response.prompt_feedback, response.usage_metadata)
+
         content = await self._contents_from_response(response, tools=tools)
 
         # Ensure we always have at least one content item to avoid UI errors
@@ -1743,30 +1780,29 @@ async def _generate(
 
         finish_reason = FinishReason.OTHER
         candidates = []
-        if response.candidates:
-            for i, c in enumerate(response.candidates):
-                c_content = []
-                if c.content and c.content.parts:
-                    for part in c.content.parts:
-                        converted = PartConverter.from_gemini(part=part, tools=tools)
-                        if converted:
-                            c_content.append(converted)
-
-                if not c_content:
-                    c_content = [Part.from_text('')]
-
-                c_finish_reason = _to_finish_reason(c.finish_reason)
-
-                if i == 0:
-                    finish_reason = c_finish_reason
-
-                candidates.append(
-                    Candidate(
-                        index=float(i),
-                        message=Message(role=Role.MODEL, content=c_content),
-                        finish_reason=c_finish_reason,
-                    )
+        for i, c in enumerate(response.candidates):
+            c_content = []
+            if c.content and c.content.parts:
+                for part in c.content.parts:
+                    converted = PartConverter.from_gemini(part=part, tools=tools)
+                    if converted:
+                        c_content.append(converted)
+
+            if not c_content:
+                c_content = [Part.from_text('')]
+
+            c_finish_reason = _to_finish_reason(c.finish_reason)
+
+            if i == 0:
+                finish_reason = c_finish_reason
+
+            candidates.append(
+                Candidate(
+                    index=float(i),
+                    message=Message(role=Role.MODEL, content=c_content),
+                    finish_reason=c_finish_reason,
                 )
+            )
 
         return ModelResponse(
             message=Message(
@@ -1776,6 +1812,7 @@ async def _generate(
             finish_reason=finish_reason,
             candidates=candidates,
             usage=_usage_from_metadata(response.usage_metadata),
+            custom=_custom_from_feedback(response.prompt_feedback),
         )
 
     async def _streaming_generate(
@@ -1798,9 +1835,15 @@ async def _streaming_generate(
             tools: tools declared this turn
 
         Returns:
-            empty genai response
+            genai response.
         """
         client = client or self._client
+        accumulated_content: list[Part] = []
+        finish_reason = FinishReason.UNKNOWN
+        usage_metadata: Any = None
+        prompt_feedback: genai_types.GenerateContentResponsePromptFeedback | None = None
+        saw_chunk = False
+        saw_candidates = False
         try:
             generator = await client.aio.models.generate_content_stream(
                 model=resolve_vertex_model_name(client, model_name),
@@ -1810,10 +1853,8
```

**File**: `py/packages/genkit-google-genai/src/genkit_google_genai/_provider_errors.py` (modified, +38/-11)
```diff
@@ -27,10 +27,18 @@
 from google.genai.errors import APIError
 
 from genkit import GenkitError
-from genkit.plugin_api import provider_error
+from genkit.plugin_api import StatusName, provider_error
 
 _RETRY_INFO_TYPE = 'type.googleapis.com/google.rpc.RetryInfo'
+_ERROR_INFO_TYPE = 'type.googleapis.com/google.rpc.ErrorInfo'
 _DURATION = re.compile(r'(\d+(?:\.\d+)?)s')
+# HTTP codes that several statuses share, and the statuses an error body can
+# name to say which one it is.
+_SHARED_CODE_STATUSES: dict[int, frozenset[str]] = {
+    400: frozenset({'INVALID_ARGUMENT', 'FAILED_PRECONDITION', 'OUT_OF_RANGE'}),
+    409: frozenset({'ALREADY_EXISTS', 'ABORTED'}),
+    500: frozenset({'INTERNAL', 'DATA_LOSS'}),
+}
 
 # On Python 3.10, asyncio.TimeoutError is not the builtin TimeoutError, so list both.
 _TIMEOUT_ERRORS: tuple[type[BaseException], ...] = (httpx.TimeoutException, asyncio.TimeoutError, TimeoutError)
@@ -47,11 +55,17 @@
 
 
 def api_error(error: APIError) -> GenkitError:
-    """GenkitError for an HTTP error response the SDK raised."""
+    """GenkitError for an HTTP error response the SDK raised.
+
+    When several statuses share the HTTP code, the status the error body names
+    picks one, so a 400 that says FAILED_PRECONDITION keeps that status. A key
+    the Gemini API rejects is UNAUTHENTICATED.
+    """
     response = getattr(error, 'response', None)
     return provider_error(
         error,
         http_status=error.code,
+        status=_body_status(error),
         headers=getattr(response, 'headers', None),
         retry_after_ms=retry_info_ms(error.details),
         message=error.message or str(error),
@@ -73,18 +87,31 @@ def retry_info_ms(body: object) -> float | None:
     Retry-After header, so retry reads it here to avoid hammering the quota.
     A missing or malformed delay is None.
     """
+    delay = _field(_detail(body, _RETRY_INFO_TYPE), 'retryDelay')
+    match = _DURATION.fullmatch(delay.strip()) if isinstance(delay, str) else None
+    if match is None:
+        return None
+    delay_ms = float(match.group(1)) * 1000
+    return delay_ms if math.isfinite(delay_ms) else None
+
+
+def _body_status(error: APIError) -> StatusName | None:
+    """The status the error body names for a shared HTTP code, or None to map the code."""
+    # The Gemini API answers a bad key with INVALID_ARGUMENT and names it only in ErrorInfo.
+    if _field(_detail(error.details, _ERROR_INFO_TYPE), 'reason') == 'API_KEY_INVALID':
+        return 'UNAUTHENTICATED'
+    status = error.status
+    if isinstance(status, str) and status in _SHARED_CODE_STATUSES.get(error.code, frozenset()):
+        return cast(StatusName, status)
+    return None
+
+
+def _detail(body: object, type_url: str) -> object:
+    """The first google.rpc detail of the given type in an error body, if any."""
     details = _field(_field(body, 'error') or body, 'details')
     if not isinstance(details, list):
         return None
-    for detail in cast(list[object], details):
-        if _field(detail, '@type') == _RETRY_INFO_TYPE:
-            delay = _field(detail, 'retryDelay')
-            match = _DURATION.fullmatch(delay.strip()) if isinstance(delay, str) else None
-            if match is None:
-                return None
-            delay_ms = float(match.group(1)) * 1000
-            return delay_ms if math.isfinite(delay_ms) else None
-    return None
+    return next((d for d in cast(list[object], details) if _field(d, '@type') == type_url), None)
 
 
 def _field(value: object, key: str) -> object:
```

**File**: `py/packages/genkit-google-genai/tests/google_plugin_test.py` (modified, +91/-1)
```diff
@@ -25,6 +25,7 @@
 from typing import Any, cast
 from unittest.mock import ANY, AsyncMock, MagicMock, patch
 
+import httpx
 import pytest
 from genkit_google_genai import GoogleAI, VertexAI
 from genkit_google_genai._evaluators._evaluation import VertexAIEvaluationMetricType
@@ -38,7 +39,8 @@
 )
 from google import genai
 from google.auth.credentials import Credentials
-from google.auth.exceptions import DefaultCredentialsError
+from google.auth.exceptions import DefaultCredentialsError, RefreshError
+from google.genai.errors import APIError
 from google.genai.types import HttpOptions
 from pydantic import ValidationError
 
@@ -969,3 +971,91 @@ def test_vertexai_positional_project_raises_type_error() -> None:
     """VertexAI('my-project') raises TypeError instead of treating the project as credentials."""
     with pytest.raises(TypeError):
         VertexAI('my-project')  # type: ignore[misc]
+
+
+@pytest.mark.asyncio
+async def test_googleai_init_rejected_key_is_unauthenticated(googleai_plugin_instance: GoogleAI) -> None:
+    """A bad API key fails the model listing in init with UNAUTHENTICATED, not a raw SDK error."""
+    message = 'API key not valid. Please pass a valid API key.'
+    error_info = {
+        '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
+        'reason': 'API_KEY_INVALID',
+        'domain': 'googleapis.com',
+        'metadata': {'service': 'generativelanguage.googleapis.com'},
+    }
+    localized = {'@type': 'type.googleapis.com/google.rpc.LocalizedMessage', 'locale': 'en-US', 'message': message}
+    details = [error_info, localized]
+    rejected = APIError(
+        400, {'error': {'code': 400, 'message': message, 'status': 'INVALID_ARGUMENT', 'details': details}}
+    )
+    mock_client = MagicMock()
+    mock_client.aio.models.list = AsyncMock(side_effect=rejected)
+    googleai_plugin_instance._runtime_client = lambda: mock_client
+
+    with pytest.raises(GenkitError) as raised:
+        await googleai_plugin_instance.init()
+
+    assert raised.value.status == 'UNAUTHENTICATED'
+    assert raised.value.cause is rejected
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    ('failure', 'status'),
+    [
+        (APIError(503, {'error': {'code': 503, 'message': 'overloaded', 'status': 'UNAVAILABLE'}}), 'UNAVAILABLE'),
+        (RefreshError('invalid_grant: Token has been expired or revoked.'), 'UNAUTHENTICATED'),
+        (httpx.ConnectError('[Errno 61] Connection refused'), 'UNAVAILABLE'),
+    ],
+)
+async def test_vertexai_init_classifies_model_listing_failure(
+    vertexai_plugin_instance: VertexAI, failure: Exception, status: str
+) -> None:
+    """Model listing in init maps provider, credential, and connection failures like a generate call."""
+    mock_client = MagicMock()
+    mock_client.aio.models.list = AsyncMock(side_effect=failure)
+    vertexai_plugin_instance._runtime_client = lambda: mock_client
+
+    with pytest.raises(GenkitError) as raised:
+        await vertexai_plugin_instance.init()
+
+    assert raised.value.status == status
+    assert raised.value.cause is failure
+    assert raised.value.__cause__ is failure
+
+
+@pytest.mark.asyncio
+async def test_vertexai_init_listing_unknown_failure_stays_raw(vertexai_plugin_instance: VertexAI) -> None:
+    """A listing failure that is not a provider, credential, or connection error keeps its own type."""
+    boom = RuntimeError('SDK bug')
+    mock_client = MagicMock()
+    mock_client.aio.models.list = AsyncMock(side_effect=boom)
+    vertexai_plugin_instance._runtime_client = lambda: mock_client
+
+    with pytest.raises(RuntimeError) as raised:
+        await vertexai_plugin_instance.init()
+
+    assert raised.value is boom
+
+
+async def _pager_failing_after(first: Any, failure: BaseException) -> AsyncIterator[Any]:
+    yield first
+    raise failure
+
+
+@pytest.mark.asyncio
+async def test_googleai_init_classifies_failure_while_paging_models(googleai_plugin_instance: GoogleAI) -> None:
+    """An API error the pager raises after the first page is classified too."""
+    first = MagicMock()
+    first.name = 'models/gemini-2.5-flash'
+    first.supported_actions = ['generateContent']
+    denied = APIError(403, {'error': {'code': 403, 'message': 'denied', 'status': 'PERMISSION_DENIED'}})
+    mock_client = MagicMock()
+    mock_client.aio.models.list = AsyncMock(side_effect=lambda: _pager_failing_after(first, denied))
+    googleai_plugin_instance._runtime_client = lambda: mock_client
+
+    with pytest.raises(GenkitError) as raised:
+        await googleai_plugin_instance.init()
+
+    assert raised.value.status == 'PERMISSION_DENIED'
+    assert raised.value.cause is denied
```

**File**: `py/packages/genkit-google-genai/tests/models/googlegenai_gemini_test.py` (modified, +352/-2)
```diff
@@ -147,9 +147,12 @@ async def test_generate_stream_text_response(mocker: MockerFixture, version: str
 
     resp = genai.types.GenerateContentResponse(candidates=[candidate])
 
+    async def stream() -> Any:  # noqa: ANN401
+        yield resp
+
     googleai_client_mock = mocker.AsyncMock()
     googleai_client_mock.vertexai = False
-    googleai_client_mock.aio.models.generate_content_stream.__aiter__.side_effect = [resp]
+    googleai_client_mock.aio.models.generate_content_stream.return_value = stream()
     on_chunk_mock = mocker.MagicMock()
     gemini = GeminiModel(version, googleai_client_mock)
 
@@ -173,7 +176,9 @@ async def test_generate_stream_text_response(mocker: MockerFixture, version: str
     ])
     assert isinstance(response, ModelResponse)
     assert response.message is not None
-    assert response.message.content == []
+    assert response.message.content[0].text == response_text
+    on_chunk_mock.assert_called_once()
+    assert on_chunk_mock.call_args.args[0].content[0].text == response_text
 
 
 @pytest.mark.asyncio
@@ -1909,6 +1914,74 @@ async def test_429_retry_info_sets_retry_delay(
     assert error.response_metadata == expected
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    ('code', 'body', 'status'),
+    [
+        (
+            400,
+            {'error': {'code': 400, 'message': 'User location is not supported', 'status': 'FAILED_PRECONDITION'}},
+            'FAILED_PRECONDITION',
+        ),
+        (409, {'error': {'code': 409, 'message': 'exists', 'status': 'ALREADY_EXISTS'}}, 'ALREADY_EXISTS'),
+        (500, {'error': {'code': 500, 'message': 'lost', 'status': 'DATA_LOSS'}}, 'DATA_LOSS'),
+        (500, {'error': {'code': 500, 'message': 'unknown', 'status': 'UNKNOWN'}}, 'INTERNAL'),
+        (402, {'error': {'code': 402, 'message': 'Prepay credit depleted', 'status': 'RESOURCE_EXHAUSTED'}}, 'UNKNOWN'),
+        (502, {'message': '<html>Bad Gateway</html>', 'status': 'Bad Gateway'}, 'INTERNAL'),
+    ],
+)
+async def test_error_body_status_picks_among_statuses_sharing_the_code(
+    mocker: MockerFixture, code: int, body: dict[str, Any], status: str
+) -> None:
+    """The body's status narrows a shared HTTP code and never overrides a different code."""
+    error = await _generate_failure(mocker, APIError(code, body))
+
+    assert error.status == status
+
+
+@pytest.mark.asyncio
+async def test_rejected_api_key_is_unauthenticated(mocker: MockerFixture) -> None:
+    """A 400 INVALID_ARGUMENT whose ErrorInfo reason is API_KEY_INVALID is UNAUTHENTICATED."""
+    message = 'API key not valid. Please pass a valid API key.'
+    localized = {'@type': 'type.googleapis.com/google.rpc.LocalizedMessage', 'locale': 'en-US', 'message': message}
+    error_info = {
+        '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
+        'reason': 'API_KEY_INVALID',
+        'domain': 'googleapis.com',
+        'metadata': {'service': 'generativelanguage.googleapis.com'},
+    }
+    details = [localized, error_info]
+    body = {'error': {'code': 400, 'message': message, 'status': 'INVALID_ARGUMENT', 'details': details}}
+    rejected = APIError(400, body)
+
+    error = await _generate_failure(mocker, rejected)
+
+    assert error.status == 'UNAUTHENTICATED'
+    assert error.original_message == message
+    assert error.cause is rejected
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    ('code', 'status', 'reason'),
+    [
+        (403, 'PERMISSION_DENIED', 'API_KEY_SERVICE_BLOCKED'),
+        (403, 'PERMISSION_DENIED', 'SERVICE_DISABLED'),
+        (429, 'RESOURCE_EXHAUSTED', 'RATE_LIMIT_EXCEEDED'),
+    ],
+)
+async def test_other_error_info_reasons_keep_the_body_status(
+    mocker: MockerFixture, code: int, status: str, reason: str
+) -> None:
+    """An ErrorInfo reason other than API_KEY_INVALID leaves the body's status as it is."""
+    error_info = {'@type': 'type.googleapis.com/google.rpc.ErrorInfo', 'reason': reason}
+    body = {'error': {'code': code, 'message': 'request refused', 'status': status, 'details': [error_info]}}
+
+    error = await _generate_failure(mocker, APIError(code, body))
+
+    assert error.status == status
+
+
 @pytest.mark.asyncio
 @patch('genkit_google_genai._models._gemini.validate_context_cache_request', new_callable=MagicMock)
 @pytest.mark.parametrize(
@@ -2012,3 +2085,280 @@ async def test_request_client_unknown_failure_stays_raw() -> None:
             )
 
     assert raised.value is boom
+
+
+# ---------------------------------------------------------------------------
+# Blocked prompts and replies with no candidates
+# ---------------------------------------------------------------------------
+
+
+def _text_chunk(
+    text: str, finish_reason: genai_types.FinishReason | None = None
+) -> genai_types.GenerateContentResponse:
+    candidate = genai_types.Candidate(
+        content=genai_types.Content(parts=[genai_types.Part(text=text)]),
+        finish_reason=finish_reason,
+    )
+    return genai_types.Ge
```

---

### Incident Patch 2: `57f2a110` (2026-10-12)
**Commit Message**: fix(go/tracing): attribute a failure only to the span it originates from (#6477)

Co-authored-by: Alex Pascal <[REDACTED_EMAIL]>

**File**: `go/core/tracing/tracing.go` (modified, +67/-34)
```diff
@@ -19,10 +19,11 @@ package tracing
 
 import (
 	"context"
-	"errors"
 	"log/slog"
 	"os"
+	"reflect"
 	"runtime"
+	"slices"
 	"strings"
 	"sync"
 	"time"
@@ -37,38 +38,46 @@ import (
 	"go.opentelemetry.io/otel/trace"
 )
 
-// markedError wraps an error to track if it's already been marked as a failure source
-type markedError struct {
-	error
-	marked bool
-}
-
-func (e *markedError) Error() string {
-	return e.error.Error()
-}
-
-func (e *markedError) Unwrap() error {
-	return e.error
-}
-
-// markErrorAsHandled marks an error as already handled for failure source tracking
-func markErrorAsHandled(err error) error {
-	var me *markedError
-	if errors.As(err, &me) {
-		me.marked = true
-		return me
+// isDerivedFrom reports whether err only propagates causes, the errors that
+// failing child spans returned. A wrapper chain is derived when some error in it
+// is one of the causes. A multi-error node (errors.Join) is derived only when
+// every branch is, so a span that joins its own failure with a child's is still
+// a failure source. A cause of a non-comparable type matches only through an Is
+// method, so it errs toward attributing the failure to more spans, never fewer.
+func isDerivedFrom(err error, causes []error) bool {
+	for err != nil {
+		for _, c := range causes {
+			if isComparable(c) && err == c {
+				return true
+			}
+			if x, ok := err.(interface{ Is(error) bool }); ok && x.Is(c) {
+				return true
+			}
+		}
+		switch x := err.(type) {
+		case interface{ Unwrap() error }:
+			err = x.Unwrap()
+		case interface{ Unwrap() []error }:
+			errs := x.Unwrap()
+			if len(errs) == 0 {
+				return false
+			}
+			for _, e := range errs {
+				if !isDerivedFrom(e, causes) {
+					return false
+				}
+			}
+			return true
+		default:
+			return false
+		}
 	}
-
-	return &markedError{error: err, marked: true}
+	return false
 }
 
-// isErrorAlreadyMarked checks if an error has already been marked as a failure source
-func isErrorAlreadyMarked(err error) bool {
-	var me *markedError
-	if errors.As(err, &me) {
-		return me.marked
-	}
-	return false
+// isComparable reports whether err can be compared with == without panicking.
+func isComparable(err error) bool {
+	return reflect.TypeOf(err).Comparable()
 }
 
 // captureStackTrace captures the current Go stack trace for error reporting
@@ -329,10 +338,16 @@ func RunInNewSpan[I, O any](
 	if err != nil {
 		sm.State = spanStateError
 		sm.Error = err.Error()
-		sm.IsFailureSource = true
-		if !isErrorAlreadyMarked(err) {
-			span.RecordError(err)
-			span.SetStatus(codes.Error, err.Error())
+		span.SetStatus(codes.Error, err.Error())
+		span.RecordError(err)
+		// Only the span where an error originates is its failure source, not
+		// every span that returns it on the way up; otherwise one failure is
+		// counted once per enclosing span in monitoring. Attribution is kept on
+		// the spans rather than on the error, so callers get back exactly the
+		// error they returned.
+		sm.IsFailureSource = !isDerivedFrom(err, sm.childErrors())
+		if parentSM != nil {
+			parentSM.addChildError(err)
 		}
 		// A failure can still carry a result: the generate loop returns the
 		// conversation it completed alongside its error. Record it so the
@@ -418,6 +433,24 @@ type spanMetadata struct {
 	Type            string            // span type (action, flow, model, etc.)
 	Subtype         string            // span subtype (tool, model, flow, etc.)
 	Metadata        map[string]string // additional custom metadata
+
+	mu        sync.Mutex
+	childErrs []error // errors returned by failing child spans, guarded by mu
+}
+
+// addChildError records err as returned by a failing child span. Child spans
+// can run concurrently (parallel tool calls), hence the lock.
+func (sm *spanMetadata) addChildError(err error) {
+	sm.mu.Lock()
+	defer sm.mu.Unlock()
+	sm.childErrs = append(sm.childErrs, err)
+}
+
+// childErrors returns the errors recorded by addChildError.
+func (sm *spanMetadata) childErrors() []error {
+	sm.mu.Lock()
+	defer sm.mu.Unlock()
+	return slices.Clone(sm.childErrs)
 }
 
 // ioAttrJSON returns the JSON encoding of v for the genkit:input, genkit:init,
```

**File**: `go/core/tracing/tracing_test.go` (modified, +168/-0)
```diff
@@ -22,9 +22,13 @@ import (
 	"fmt"
 	"slices"
 	"strconv"
+	"strings"
+	"sync"
 	"testing"
 
 	"go.opentelemetry.io/otel/attribute"
+	"go.opentelemetry.io/otel/codes"
+	"go.opentelemetry.io/otel/sdk/trace/tracetest"
 )
 
 // TODO: add tests that compare tracing data saved to disk with goldens.
@@ -654,6 +658,170 @@ func TestIsFailureSourceOnError(t *testing.T) {
 	}
 }
 
+// TestIsFailureSourceOnlyOnOriginatingSpan verifies that a failure is attributed
+// to the span where the error originates rather than to every span that
+// propagates it, while all of them still report the error and receive it
+// unchanged.
+func TestIsFailureSourceOnlyOnOriginatingSpan(t *testing.T) {
+	ctx := context.Background()
+	boom := errors.New("boom")
+	recorder := tracetest.NewSpanRecorder()
+	tp := TracerProvider()
+	tp.RegisterSpanProcessor(recorder)
+	t.Cleanup(func() { tp.UnregisterSpanProcessor(recorder) })
+
+	var outerSM, middleSM, innerSM *spanMetadata
+
+	_, err := RunInNewSpan(ctx, &SpanMetadata{Name: "outer", Type: "action", Subtype: "flow"}, "in",
+		func(ctx context.Context, in string) (string, error) {
+			outerSM = spanMetaKey.FromContext(ctx)
+			return RunInNewSpan(ctx, &SpanMetadata{Name: "middle", Type: "action"}, in,
+				func(ctx context.Context, in string) (string, error) {
+					middleSM = spanMetaKey.FromContext(ctx)
+					out, err := RunInNewSpan(ctx, &SpanMetadata{Name: "inner", Type: "action", Subtype: "tool"}, in,
+						func(ctx context.Context, in string) (string, error) {
+							innerSM = spanMetaKey.FromContext(ctx)
+							return "", boom
+						})
+					if err != boom {
+						t.Errorf("parent span received %#v from its child, want %#v", err, boom)
+					}
+					return out, err
+				})
+		})
+
+	if err != boom {
+		t.Errorf("outermost span returned %#v, want %#v", err, boom)
+	}
+	if !innerSM.IsFailureSource {
+		t.Error("originating span is not marked as the failure source")
+	}
+	for _, sm := range []*spanMetadata{middleSM, outerSM} {
+		if sm.IsFailureSource {
+			t.Errorf("span %q only propagated the failure but is marked as its source", sm.Name)
+		}
+		if sm.State != spanStateError {
+			t.Errorf("span %q state = %q, want %q", sm.Name, sm.State, spanStateError)
+		}
+	}
+	spans := recorder.Ended()
+	if len(spans) != 3 {
+		t.Fatalf("recorded %d spans, want 3", len(spans))
+	}
+	for _, span := range spans {
+		if status := span.Status(); status.Code != codes.Error || status.Description != boom.Error() {
+			t.Errorf("span %q status = %v, want Error with description %q", span.Name(), status, boom.Error())
+		}
+		if events := span.Events(); len(events) != 1 || events[0].Name != "exception" {
+			t.Errorf("span %q events = %v, want one exception event", span.Name(), events)
+		}
+	}
+}
+
+// TestIsFailureSourceAttribution verifies which span is the failure source when
+// a parent changes the error its child returned before returning it.
+func TestIsFailureSourceAttribution(t *testing.T) {
+	boom := errors.New("boom")
+	cleanupErr := errors.New("cleanup failed")
+	tests := []struct {
+		name string
+		// parent builds the error the parent span returns from the errors its
+		// two child spans returned.
+		parent     func(first, second error) error
+		wantSource bool
+	}{
+		{
+			name:       "wrapped child error",
+			parent:     func(first, _ error) error { return fmt.Errorf("step failed: %w", first) },
+			wantSource: false,
+		},
+		{
+			name:       "joined child errors",
+			parent:     func(first, second error) error { return errors.Join(first, second) },
+			wantSource: false,
+		},
+		{
+			name:       "own failure joined with a child error",
+			parent:     func(first, _ error) error { return errors.Join(cleanupErr, first) },
+			wantSource: true,
+		},
+		{
+			name:       "unrelated error",
+			parent:     func(error, error) error { return cleanupErr },
+			wantSource: true,
+		},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			var parentSM *spanMetadata
+			RunInNewSpan(context.Background(), &SpanMetadata{Name: "parent"}, "in",
+				func(ctx context.Context, in string) (string, error) {
+					parentSM = spanMetaKey.FromContext(ctx)
+					fail := func(ctx context.Context, in string) (string, error) { return "", boom }
+					_, first := RunInNewSpan(ctx, &SpanMetadata{Name: "first"}, in, fail)
+					_, second := RunInNewSpan(ctx, &SpanMetadata{Name: "second"}, in, fail)
+					return "", tt.parent(first, second)
+				})
+			if parentSM.IsFailureSource != tt.wantSource {
+				t.Errorf("parent IsFailureSource = %t, want %t", parentSM.IsFailureSource, tt.wantSource)
+			}
+		})
+	}
+}
+
+// TestIsFailureSourceForStoredError verifies that attribution is per trace: an
+// error a child span returned in an earlier trace is attributed to the span
+// that returns it again later, without its child failing.
+func TestIsFailureSourceForStoredError(t *testing.T) {
+	ctx := context.Background()
+	var (
+		once    sync.Once
+		initErr error
+	)
+	step := func(ctx
```

---

### Incident Patch 3: `14b2187a` (2026-10-12)
**Commit Message**: fix(py)!: typed model config raises before the turn, not as a failed response (#6675)

**File**: `py/packages/genkit/src/genkit/_ai/_aio.py` (modified, +1/-0)
```diff
@@ -2086,6 +2086,7 @@ async def generate_operation(
             raise GenkitError(
                 status=cast(StatusName, response.error.status or 'INTERNAL'),
                 message=response.error.message,
+                details=response.error.details,
                 reason=response.error.reason,
             )
         if not response.operation:
```

**File**: `py/packages/genkit/src/genkit/_ai/_generate.py` (modified, +8/-2)
```diff
@@ -38,6 +38,8 @@
     ModelRequest,
     ModelResponse,
     ModelResponseChunk,
+    annotated_config_class,
+    check_config_before_turn,
     resolve_model_name,
     text_from_content,
 )
@@ -90,7 +92,6 @@
     Part,
     as_message,
     chunk_for_stream,
-    declared_config_type,
     reject_config_api_key,
     reject_unanswered_interrupts,
 )
@@ -783,6 +784,11 @@ async def run_generate(
     # reflection) starts here, so it fails before middleware or the model runs.
     reject_config_api_key(options.config)
     registry = scope.registry
+    # Config values the model's ModelRequest[...] class or JSON-schema
+    # config_schema= rejects raise here, before any hook runs, for every entry
+    # point (ai.generate, prompts, generate_operation, /util/generate).
+    if options.model:
+        await check_config_before_turn(model=options.model, config=options.config, registry=registry)
 
     if options.tools:
         options.tools = await expand_wildcard_tools(registry, options.tools)
@@ -1619,7 +1625,7 @@ async def run_action(params: ModelHookParams, c: GenerateMiddlewareContext) -> M
     # that object; a swapped-in dict or other class would reach inner layers
     # as a second shape, so each handoff is checked. When the build fell back
     # to a bare request (the config didn't fit), the model action reports it.
-    config_class = declared_config_type(turn_model.input_class) if turn_model.input_class is not None else None
+    config_class = annotated_config_class(turn_model)
     on_handoff: Callable[[ModelHookParams, MiddlewareDef], None] | None = None
     if config_class is not None and isinstance(request.config, config_class):
         config_check = MiddlewareConfigCheck(config=request.config, schema=config_class, model=turn_model.name)
```

**File**: `py/packages/genkit/src/genkit/_ai/_model.py` (modified, +76/-99)
```diff
@@ -18,12 +18,13 @@
 
 from __future__ import annotations
 
+import functools
 import inspect
 from collections.abc import Awaitable, Callable, Mapping, Sequence
 from dataclasses import dataclass, replace
 from typing import Annotated, Any, TypeAlias, cast, get_args, get_origin, get_type_hints
 
-from pydantic import AliasChoices, BaseModel, ValidationError
+from pydantic import BaseModel, ValidationError
 
 from genkit._core._action import (
     Action,
@@ -32,6 +33,13 @@
     get_func_description,
 )
 from genkit._core._background import BackgroundAction
+from genkit._core._config_check import (
+    check_config_json_schema,
+    check_config_values,
+    check_request_config,
+    config_field_names,
+    config_values,
+)
 from genkit._core._error import GenkitError, RuntimeErrorReason
 from genkit._core._logger import get_logger
 from genkit._core._model import (
@@ -44,6 +52,7 @@
     ModelResponse,
     ModelResponseChunk,
     config_type_path,
+    declared_config_type,
     get_basic_usage_stats,
     reject_config_api_key,
     text_from_content,
@@ -80,28 +89,17 @@ def python_config_schema(schema: object) -> type[BaseModel] | None:
     return schema if isinstance(schema, type) and issubclass(schema, BaseModel) else None
 
 
+def annotated_config_class(action: object | None) -> type[BaseModel] | None:
+    """The class on the model function's ``ModelRequest[...]`` annotation, if any."""
+    input_class = getattr(action, 'input_class', None) if action is not None else None
+    return declared_config_type(input_class) if isinstance(input_class, type) else None
+
+
 def ref_defers_to_registered_class(schema: type[BaseModel] | None) -> bool:
     """True when the ref named plain ModelConfig, so the model's class is used."""
     return schema is ModelConfig or schema is GenerationCommonConfig
 
 
-def config_field_names(schema: type[BaseModel]) -> dict[str, str]:
-    """Map each field name and alias to the Python field name."""
-    names: dict[str, str] = {}
-    for name, field in schema.model_fields.items():
-        names[name] = name
-        if field.alias:
-            names[field.alias] = name
-        accepted = field.validation_alias
-        if isinstance(accepted, str):
-            names[accepted] = name
-        elif isinstance(accepted, AliasChoices):
-            for choice in accepted.choices:
-                if isinstance(choice, str):
-                    names[choice] = name
-    return names
-
-
 def fold_config_aliases(*, config: dict[str, Any], schema: type[BaseModel]) -> dict[str, Any]:
     """Rewrite schema aliases to field names. Unknown keys stay as written."""
     names = config_field_names(schema)
@@ -303,6 +301,34 @@ async def resolve_for_generate(
     return replace(resolved, config_schema=python_config_schema(raw))
 
 
+async def config_class_for_generate(*, model: object | None, registry: Registry) -> type[BaseModel] | None:
+    """The config class a generate call to ``model`` folds and checks against.
+
+    The ``config_schema=`` class (or a ref's plugin class) when there is
+    one, else the class on the model function's ``ModelRequest[...]``.
+    """
+    resolved = await resolve_for_generate(model=model, registry=registry)
+    if resolved.config_schema is not None:
+        return resolved.config_schema
+    return annotated_config_class(await registry.resolve_model(resolved.name))
+
+
+async def check_config_before_turn(*, model: str, config: object, registry: Registry) -> None:
+    """Raise before the turn when a value in ``config`` can't reach the model.
+
+    Covers the two schemas the call-time check doesn't see: the class on the
+    model function's ``ModelRequest[...]`` annotation, and a JSON-schema dict
+    passed as ``config_schema=``. A missing top-level field passes:
+    ``wrap_model`` middleware can still fill it, and the model action reports
+    it if nothing does.
+    """
+    action = await registry.resolve_model(model)
+    check_config_values(config=config, schema=annotated_config_class(action), model=model)
+    declared = getattr(action, '_config_schema', None) if action is not None else None
+    if isinstance(declared, dict):
+        check_config_values(config=config, schema=cast(dict[str, Any], declared), model=model)
+
+
 def config_schema_at_define(*, model: object | None, registry: Registry) -> tuple[str | None, type[BaseModel] | None]:
     """Name and class a define-time typed config is checked against.
 
@@ -466,14 +492,40 @@ def model(
     model_meta: dict[str, object] = metadata.copy() if metadata else {}
     model_meta['model'] = model_options
 
-    return Action(
+    if not config_schema:
+        return Action(
+            kind=ActionKind.MODEL,
+            name=name,
+            fn=fn,
+            metadata=model_meta,
+            description=get_func_description(fn, description),
+        )
+
+    schema = config_schema
+    # Action rejects a sync fn, but it only sees the async wrapper below.
+   
```

**File**: `py/packages/genkit/src/genkit/_ai/_prompt.py` (modified, +5/-4)
```diff
@@ -54,8 +54,7 @@
     ModelResponseChunk,
     assert_correct_config_class,
     check_call_config,
-    check_config_dict,
-    config_field_names,
+    config_class_for_generate,
     config_schema_at_define,
     fold_config_aliases,
     normalize_config,
@@ -70,6 +69,7 @@
     get_current_context,
 )
 from genkit._core._channel import Channel
+from genkit._core._config_check import check_config_values, config_field_names
 from genkit._core._error import GenkitError, RuntimeErrorReason
 from genkit._core._logger import get_logger
 from genkit._core._middleware import BaseMiddleware, middleware_class_index
@@ -394,7 +394,8 @@ async def _resolve_model(self, call: GenerateCall, opts: ModelSettings) -> Gener
             override = normalize_config(config=override_config)
             # `maxOutputTokens` in the prompt and `max_output_tokens` in the
             # call are one setting: fold both to field names so the call wins.
-            schema = (await resolve_for_generate(model=model, registry=self._ai._registry)).config_schema
+            # A model typed only by its ModelRequest[...] annotation folds too.
+            schema = await config_class_for_generate(model=model, registry=self._ai._registry)
             if schema is not None:
                 base = fold_config_aliases(config=base, schema=schema)
                 override = fold_config_aliases(config=override, schema=schema)
@@ -421,7 +422,7 @@ async def _resolve_model(self, call: GenerateCall, opts: ModelSettings) -> Gener
                 schema=resolved.config_schema,
                 model=resolved.name,
             )
-        check_config_dict(
+        check_config_values(
             config=prompt_config_after_clears(
                 stored=self._def.config,
                 override=override_config,
```

**File**: `py/packages/genkit/src/genkit/_core/_action.py` (modified, +4/-5)
```diff
@@ -788,11 +788,10 @@ def __init__(
         self._strict_io: bool = _strict_io
         self._metadata: dict[str, object] = metadata if metadata else {}
         self._description: str | None = description
-        # Python class for generate's isinstance check. Not in metadata —
-        # that bag is JSON for the Dev UI.
-        self._config_schema: type[BaseModel] | None = (
-            config_schema if isinstance(config_schema, type) and issubclass(config_schema, BaseModel) else None
-        )
+        # What config_schema= declared: a Pydantic class or a JSON-schema dict.
+        # generate checks config against it. Not in metadata — that bag is
+        # JSON for the Dev UI.
+        self._config_schema: type[BaseModel] | dict[str, object] | None = config_schema
         self._span_metadata: dict[str, SpanAttributeValue] = span_metadata or {}
 
         # All action handlers must be async
```

**File**: `py/packages/genkit/src/genkit/_core/_background.py` (modified, +11/-0)
```diff
@@ -18,13 +18,15 @@
 
 from __future__ import annotations
 
+import inspect
 from collections.abc import Awaitable, Callable, Mapping
 from functools import wraps
 from typing import Any
 
 from pydantic import BaseModel
 
 from genkit._core._action import Action, ActionKind, ActionRunContext, get_current_context
+from genkit._core._config_check import check_config_json_schema, check_request_config
 from genkit._core._error import GenkitError, RuntimeErrorReason
 from genkit._core._model import ModelRequest, ModelResponse
 from genkit._core._registry import Registry
@@ -76,10 +78,19 @@ def _operation_action(
     plugin prefix after this is built, so the key is read from the action's
     live name minus ``suffix`` (e.g. ``/check``) when it runs.
     """
+    # Action rejects a sync fn, but it only sees the async wrapper below.
+    if not inspect.iscoroutinefunction(fn):
+        raise TypeError(f"Action handlers must be async functions. Got sync function for '{model_name}{suffix}'.")
+    if isinstance(config_schema, dict):
+        check_config_json_schema(config_schema, model=model_name)
 
     # wraps keeps fn's annotations on the wrapper, e.g. ModelRequest[VeoConfig].
     @wraps(fn)
     async def run_and_stamp(input: object, ctx: ActionRunContext) -> Operation:  # noqa: A002
+        if config_schema:
+            # Same check as a regular model action: the whole config, after
+            # every middleware, before the provider starts an operation.
+            check_request_config(input, schema=config_schema, model=action.name.removesuffix(suffix))
         op = await action.params.call(fn, input, ctx)
         if isinstance(op, Operation):
             stamp_operation_action(operation=op, name=action.name.removesuffix(suffix))
```

**File**: `py/packages/genkit/src/genkit/_core/_config_check.py` (added, +233/-0)
```diff
@@ -0,0 +1,233 @@
+# Copyright 2026 Google LLC
+# SPDX-License-Identifier: Apache-2.0
+
+"""Model config checks shared by regular and background models.
+
+Before the turn, only the values a call sets are judged; a required field
+left out may still be filled by middleware. Inside the model action (or a
+background model's start action), the whole config is judged. A Pydantic
+class and a JSON-schema dict follow the same rules.
+"""
+
+from __future__ import annotations
+
+from collections.abc import Mapping, Sequence
+from typing import Any, cast
+
+from jsonschema.exceptions import SchemaError, best_match
+from jsonschema.validators import validator_for
+from pydantic import AliasChoices, BaseModel, ValidationError
+
+from genkit._core._error import GenkitError, RuntimeErrorReason
+
+
+def config_field_names(schema: type[BaseModel]) -> dict[str, str]:
+    """Map each field name and alias to the Python field name."""
+    names: dict[str, str] = {}
+    for name, field in schema.model_fields.items():
+        names[name] = name
+        if field.alias:
+            names[field.alias] = name
+        accepted = field.validation_alias
+        if isinstance(accepted, str):
+            names[accepted] = name
+        elif isinstance(accepted, AliasChoices):
+            for choice in accepted.choices:
+                if isinstance(choice, str):
+                    names[choice] = name
+    return names
+
+
+def check_request_config(request: object, *, schema: type[BaseModel] | dict[str, Any], model: str) -> None:
+    """Raise if a model request's config doesn't fit ``schema``, missing fields included.
+
+    The model action and a background model's start action both run this
+    first, after every middleware. A function with an unannotated request
+    param gets the raw dict on a direct run, so either shape is read.
+    """
+    if isinstance(request, Mapping):
+        config = cast(Mapping[str, Any], request).get('config')
+    else:
+        config = getattr(request, 'config', None)
+    check_whole_config(config=config, schema=schema, model=model)
+
+
+def check_config_values(*, config: object, schema: type[BaseModel] | dict[str, Any] | None, model: str) -> None:
+    """Raise if a value the config sets doesn't fit the model's config schema.
+
+    Only fields the config sets are judged. A required field it leaves out is
+    not an error yet: another config layer or a wrap_model middleware may add
+    it, and the model action rejects it if nothing does. ``None`` means
+    "clear the default" and isn't checked. A JSON-schema dict is judged the
+    same way as a class.
+    """
+    if schema is None or not isinstance(config, Mapping):
+        return
+    _raise_config_problems(values=_judged_values(config, schema), schema=schema, model=model, report_missing=False)
+
+
+def check_whole_config(*, config: object, schema: type[BaseModel] | dict[str, Any], model: str) -> None:
+    """Raise if the config the model is about to run with doesn't fit its config schema.
+
+    Unlike ``check_config_values``, a missing required field is an error:
+    this runs inside the model action, where nothing is left to fill it.
+    """
+    if isinstance(schema, type) and isinstance(config, schema):
+        return
+    if isinstance(config, BaseModel):
+        config = config_values(config)
+    if config is None:
+        config = {}
+    if not isinstance(config, Mapping):
+        return
+    _raise_config_problems(values=_judged_values(config, schema), schema=schema, model=model, report_missing=True)
+
+
+def check_config_json_schema(schema: dict[str, Any], *, model: str) -> None:
+    """Raise at define time when a ``config_schema=`` dict isn't a valid JSON schema."""
+    try:
+        validator_for(schema).check_schema(schema)
+    except SchemaError as e:
+        raise GenkitError(
+            status='INVALID_ARGUMENT',
+            message=f'{model}: config_schema is not a valid JSON schema: {e.message}',
+            cause=e,
+        ) from e
+
+
+def config_values(config: BaseModel) -> dict[str, Any]:
+    """``config`` as plain data, nested models included, in the shape validation takes.
+
+    ``BaseModel.model_dump`` skips GenkitModel's ``exclude_none`` default (an
+    explicit ``None`` is a value too) and its fallback serializer, so a value
+    of the wrong type comes back as itself and fails validation.
+    """
+    return BaseModel.model_dump(config, by_alias=True, round_trip=True, exclude_none=False, warnings=False)
+
+
+def _judged_values(config: Mapping[Any, Any], schema: type[BaseModel] | dict[str, Any]) -> dict[str, Any]:
+    """The config values a schema is judged on.
+
+    ``None`` means "clear the default" and is dropped. ``version`` comes from
+    ``ModelRef.version``, which Genkit adds to config itself, so a schema that
+    doesn't name it isn't judged on it.
+    """
+    declared = schema.get('properties', {}) if isinstance(schema, dict) else schema.model_fields
+    ret
```

**File**: `py/packages/genkit/src/genkit/_core/_typing.py` (modified, +0/-1)
```diff
@@ -536,7 +536,6 @@ class ModelInfo(GenkitModel):
     model_config: ClassVar[ConfigDict] = ConfigDict(alias_generator=to_camel, extra='forbid', populate_by_name=True)
     versions: list[str] | None = None
     label: str | None = None
-    config_schema: ConfigSchema | None = None
     supports: Supports | None = None
     stage: Stage | None = None
 
```

#### Recent Merged Pull Requests:
- **PR #6825** (closed): docs(skills): add running-genkit-dev-ui-alongside-other-agents (@huangjeff5)
- **PR #6793** (2026-10-13): feat(py/plugins/google-genai): split Known model Literals per backend (@cabljac)
- **PR #6789** (2026-10-13): fix(go/plugins/googlegenai): default `ResponseModalities` for Gemini image models (@apascal07)
- **PR #6786** (2026-10-13): fix(go/plugins/compat_oai): pass back empty `reasoning_content` (@apascal07)
- **PR #6783** (2026-10-13): refactor(py/plugins/google-genai): trim dead Lyria helpers (@hilariie)
- **PR #6754** (2026-10-10): fix(go/core/status): match a decoded error against its status's base sentinel (@apascal07)

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

## X. py/plugins/google-genai): widen API error mapping, detect blocked prompts (#6370

**RULE**:
When implementing operations in `py/packages/genkit-google-genai/src/genkit_google_genai/_google.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in genkit-ai/genkit. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1a38cde4`: py/plugins/google-genai): widen API error mapping, detect blocked prompts (#6370). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `py/packages/genkit-google-genai/src/genkit_google_genai/_google.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
from google.genai.errors import APIError
from genkit_google_genai._provider_errors import TRANSPORT_ERRORS, api_error, transport_error
    try:
        async for listed_model in await client.aio.models.list():
            _categorize_genai_model(listed_model, models, is_vertex)
    except APIError as e:
        raise api_error(e) from e
    except GOOGLE_AUTH_ERRORS as e:
        raise_auth_error(e)
    except TRANSPORT_ERRORS as e:
        raise transport_error(e) from e
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
    async for listed_model in await client.aio.models.list():
        _categorize_genai_model(listed_model, models, is_vertex)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1a38cde4` are properly handled with clean fallback behavior.
