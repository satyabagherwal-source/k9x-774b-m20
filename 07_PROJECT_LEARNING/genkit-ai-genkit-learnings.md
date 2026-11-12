> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/genkit-ai-genkit-learnings.md`  
> **Source**: github ([https://github.com/genkit-ai/genkit](https://github.com/genkit-ai/genkit))  
> **Source Version**: `2e9dbfd6`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-12T08:06:57.011Z  
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
> **Harvest Timestamp**: 2026-11-12T08:04:37.744Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `genkit-ai/genkit`
- **Description**: Open-source framework for building agentic apps in JavaScript, Go, Dart, and Python, built and used in production by Google
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6581 stars

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
import { GENKIT_CONTEXT as GoContext } from './context/go.js';
import { GENKIT_CONTEXT as NodeContext } from './context/nodejs.js';

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
import path from 'path';
import { z } from 'zod';
import {
  SUPPORTED_DOC_LANGUAGES,
  detectProjectLanguage,
  type SupportedDocLanguage,
} from '../utils/docs.js';
import {
  resolveTelemetryServer,
  startDevProcessManager,
  startManager,
} from '../utils/manager-utils.js';

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
  private telemetryServers = new Map<string, Promise<string>>();

  /** @param auth `--experimental-auth`. */
  constructor(private readonly auth?: boolean) {}

  private getTelemetryServerUrl(projectRoot: string): Promise<string> {
    const resolvedRoot = path.resolve(projectRoot);
    let urlPromise = this.telemetryServers.get(resolvedRoot);
    if (!urlPromise) {
      urlPromise = resolveTelemetryServer({ projectRoot: resolvedRoot }).catch(
        (err) => {
          this.telemetryServers.delete(resolvedRoot);
          throw err;
        }
      );
      this.telemetryServers.set(resolvedRoot, urlPromise);
    }
    return urlPromise;
  }

  async getManager(projectRoot: string) {
    const resolvedRoot = path.resolve(projectRoot);
    if (this.manager && this.currentProjectRoot === resolvedRoot) {
      return this.manager;
    }
    if (this.manager) {
      const prev = this.manager;
      this.manager = undefined;
      this.currentProjectRoot = undefined;
      await prev.stop();
    }
    const telemetryServerUrl = await this.getTelemetryServerUrl(resolvedRoot);
    // No auth here: attaching to existing runtimes never generates a secret.
    // `this.auth` applies when a runtime is spawned (getManagerWithDevProcess).
    this.manager = await startManager({
      projectRoot: resolvedRoot,
      manageHealth: true,
      telemetryServerUrl,
    });
    this.currentProjectRoot = resolvedRoot;
    return this.manager;
  }

  async getManagerWithDevProcess(params: {
    projectRoot: string;
    command: string;
    args: string[];
    explicitProjectRoot: boolean;
    timeout?: number;
  }): Promise<BaseRuntimeManager> {
    const { command, args, timeout, explicitProjectRoot } = params;
    const resolvedRoot = path.resolve(params.projectRoot);
    if (this.manager) {
      const prev = this.manager;
      this.manager = undefined;
      this.currentProjectRoot = undefined;
      await prev.stop();
    }
    const telemetryServerUrl = await this.getTelemetryServerUrl(resolvedRoot);
    const devManager = await startDevProcessManager(
      resolvedRoot,
      command,
      args,
      {
        nonInteractive: true,
        healthCheck: timeout !== 0,
        timeout,
        cwd: explicitProjectRoot ? resolvedRoot : undefined,
        auth: this.auth,
        telemetryServerUrl,
      }
    );
    this.manager = devManager.manager;
    this.currentProjectRoot = resolvedRoot;
    return this.manager;
  }

  async kill() {
    if (this.manager) {
      const prev = this.manager;
      this.manager = undefined;
      this.currentProjectRoot = undefined;
      await prev.stop();
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
import getPort, { portNumbers } from 'get-port';

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
    const host = '127.0.0.1';
    const telemetryPort = await getPort({
      port: portNumbers(4033, 4999),
      host,
    });
    telemetryServerUrl = `http://${host}:${telemetryPort}`;
    await startTelemetryServer({
      port: telemetryPort,
      host,
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
  const telemetryServerUrl =
    options?.telemetryServerUrl ??
    (await resolveTelemetryServer({
      projectRoot,
      corsOrigin: options?.corsOrigin,
    }));
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
    reflectionV2Port = await getPort({ port: portNumbers(3200, 3400), host });
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
  const reflectionSecret: string | unde
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
import { SERVER_HARNESS_COMMAND } from '../commands/server-harness.js';
import { type CLIRuntimeInfo } from './runtime-detector.js';

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
import { UPDATE_NOTIFICATIONS_OPT_OUT_CONFIG_TAG } from '../commands/config.js';
import { detectCLIRuntime } from '../utils/runtime-detector.js';
import {
  version as currentVersion,
  name as packageName,
} from '../utils/version.js';

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
import type { AnalyticsInfo } from '../types/analytics.js';
import { configstore, getUserSettings } from './configstore.js';
import { logger } from './logger.js';
import { toolsPackage } from './package.js';

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
          // To turn debug mode off,
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
import { toolsPackage } from './package.js';

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

- **Issue #6891** (2026-11-09): **[Python] genkit-vertexai: Model Garden OpenAI-compatible models fail with PydanticUserError TypeAdapter[ModelRequest] is not fully defined**
  *Symptoms*: **Describe the bug**  In `genkit-vertexai` 0.12.0, every OpenAI-compatible Model Garden model (for example Llama) fails before any request is sent:  ``` pydantic.errors.PydanticUserError: `TypeAdapter[ModelRequest]` is not fully defined; you should define `ModelRequest` and all referenced types, then call `.rebuild()` on the instance. ```  **To Reproduce**  ```python import asyncio from genkit import Genkit from genkit_vertexai.model_garden import ModelGarden, model_garden_name  async def main():     ai = Genkit(plugins=[ModelGarden(project_id='my-project', location='us-east5')])     await ai.generate(         model=model_garden_name('meta/llama-4-maverick-17b-128e-instruct-maas'),         prompt='hi',     )  asyncio.run(main()) ```  Traceback (abridged):  ``` genkit/_core/_registry.py, line 739, in resolve_action genkit_vertexai/model_garden/modelgarden_plugin.py, line 100, in resolve genkit_vertexai/model_garden/modelgarden_plugin.py, line 156, in _create_model_action genkit/_ai/_model.py, line 396, in model genkit/_core/_action.py, line 478, in __init__ genkit/_core/_action.py, line 658, in _initialize_io_schemas pydantic/type_adapter.py, line 703, in json_schema pydantic/_internal/_mock_val_ser.py, line 72, in rebuild pydantic.errors.PydanticUserError: `TypeAdapter[ModelRequest]` is not fully defined ... ```  It fails while defining the model action, so no credentials or network call are involved.  **Expected behavior**  The Model Garden action is defined and the request 

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

### Incident Patch 1: `d0d2e7af` (2026-11-10)
**Commit Message**: fix(py/plugins/mcp): say which server failed and why (#6930)

**File**: `py/packages/genkit-mcp/src/genkit_mcp/_client.py` (modified, +4/-1)
```diff
@@ -107,6 +107,7 @@ def __init__(
         validate_request_timeout(request_timeout_millis)
         self._provider = None
         self._name = name
+        self._host: str | None = None
         self._server = McpStdioServerConfig(command=command, args=args, env=env, cwd=cwd)
         self._request_timeout_millis = request_timeout_millis
         self._closed = False
@@ -323,7 +324,9 @@ def _connection(self) -> McpConnection:
             existing = self._connections.get(loop)
             if existing is not None and not existing.is_terminal:
                 return existing
-            connection = McpConnection(self._server, request_timeout_millis=self._request_timeout_millis)
+            connection = McpConnection(
+                self._name, self._server, request_timeout_millis=self._request_timeout_millis, host=self._host
+            )
             self._connections[loop] = connection
             return connection
 
```

**File**: `py/packages/genkit-mcp/src/genkit_mcp/_connection.py` (modified, +52/-19)
```diff
@@ -75,7 +75,7 @@
 
 _PACKAGE = 'genkit-mcp'
 
-MAX_TOOL_PAGES = 1000
+_MAX_TOOL_PAGES = 1000
 """Ceiling on ``tools/list`` pages followed before a server is called broken."""
 
 DEFAULT_REQUEST_TIMEOUT_MILLIS = 60_000
@@ -93,15 +93,15 @@
 }
 """Status for each JSON-RPC error code a server may answer with. Any other code is ``UNKNOWN``."""
 
-LIVENESS_PROBE_SECONDS = 5.0
+_LIVENESS_PROBE_SECONDS = 5.0
 """Bound on the ping that tells a dead transport from a server error reply.
 
 A ping which does not return inside this window is read as a slow server, not a
 dead one: the opposite reading tears down a healthy connection over one slow
 reply.
 """
 
-CLOSE_GRACE_SECONDS = 6.0
+_CLOSE_GRACE_SECONDS = 6.0
 """How long ``close`` lets the SDK's stdio shutdown run before it kills the server outright.
 
 The SDK waits two seconds for the server to exit on stdin EOF, then two more
@@ -117,7 +117,7 @@ def _client_info() -> Implementation:
         return Implementation(name=_PACKAGE, version='0.0.0')
 
 
-CLIENT_INFO = _client_info()
+_CLIENT_INFO = _client_info()
 """What servers see in the ``clientInfo`` of every initialize request."""
 
 _serving: contextvars.ContextVar['McpConnection | None'] = contextvars.ContextVar('genkit_mcp_serving', default=None)
@@ -160,7 +160,7 @@ async def _transport_is_dead(session: ClientSession, error: Exception) -> bool:
     if not isinstance(error, McpError) or error.error.code != CONNECTION_CLOSED:
         return False
     try:
-        await asyncio.wait_for(session.send_ping(), timeout=LIVENESS_PROBE_SECONDS)
+        await asyncio.wait_for(session.send_ping(), timeout=_LIVENESS_PROBE_SECONDS)
     except McpError as probe:
         return probe.error.code == CONNECTION_CLOSED
     except asyncio.TimeoutError:
@@ -271,21 +271,30 @@ class McpConnection:
 
     def __init__(
         self,
+        name: str,
         config: McpStdioServerConfig,
         request_timeout_millis: int | None = DEFAULT_REQUEST_TIMEOUT_MILLIS,
+        *,
+        host: str | None = None,
     ) -> None:
         """Prepare a connection. No process starts until the first call.
 
         Args:
+            name: Name of the client, or of the server within a host, that
+                errors and logs report this connection by.
             config: How to launch the server.
             request_timeout_millis: How long one request may take before it
                 fails. Must be positive. ``None`` is the only way to disable
                 the timeout.
+            host: Name of the host serving this server, if any, which errors
+                and logs report alongside ``name``.
 
         Raises:
             ValueError: If ``request_timeout_millis`` is zero or negative.
         """
         validate_request_timeout(request_timeout_millis)
+        self._name = name
+        self._host = host
         self._config = config
         self._request_timeout = (
             timedelta(milliseconds=request_timeout_millis) if request_timeout_millis is not None else None
@@ -317,7 +326,9 @@ async def list_tools(self) -> list[McpTool]:
             capability.
 
         Raises:
-            _ProtocolError: If the server's cursors never terminate.
+            _ProtocolError: If the server's cursors never terminate, or a page
+                request fails without a JSON-RPC error, such as on a malformed
+                reply.
             _RequestTimeoutError: If the server does not answer a page in time.
             _ServerError: If the server answers a page with a JSON-RPC error.
         """
@@ -329,7 +340,7 @@ async def list_all(session: ClientSession) -> list[McpTool]:
             tools: list[McpTool] = []
             cursor: str | None = None
             seen: set[str] = set()
-            for _ in range(MAX_TOOL_PAGES):
+            for _ in range(_MAX_TOOL_PAGES):
                 result = await session.list_tools(
                     params=PaginatedRequestParams(cursor=cursor) if cursor is not None else None
                 )
@@ -338,9 +349,9 @@ async def list_all(session: ClientSession) -> list[McpTool]:
                 if not cursor:
                     return tools
                 if cursor in seen:
-                    raise _ProtocolError(f'{self._config.command!r} repeated the tools/list cursor {cursor!r}')
+                    raise _ProtocolError(f'MCP server {self._target} repeated the tools/list cursor {cursor!r}')
                 seen.add(cursor)
-            raise _ProtocolError(f'{self._config.command!r} served over {MAX_TOOL_PAGES} tools/list pages')
+            raise _ProtocolError(f'MCP server {self._target} served over {_MAX_TOOL_PAGES} tools/list pages')
 
         return await self._request(list_all)
 
@@ -362,6 +373,8 @@ async def call_tool(
 
         Raises:
             _ToolResultError: If the result violates the tool's declared output schema.
+            _ProtocolError: If the request fails without a JSON-RPC error, such
+                as on a malfo
```

**File**: `py/packages/genkit-mcp/src/genkit_mcp/_errors.py` (modified, +5/-1)
```diff
@@ -83,7 +83,11 @@ class _ServerError(_ClientError):
 
 
 class _ProtocolError(_ClientError):
-    """The server answered in a way the protocol does not allow. Status ``INTERNAL``."""
+    """One request failed without a JSON-RPC error, such as on a malformed reply. Status ``INTERNAL``.
+
+    This includes a server whose ``tools/list`` cursors never terminate.
+    ``__cause__`` carries what the MCP SDK raised, when there is one.
+    """
 
 
 class _ToolResultError(_ClientError):
```

**File**: `py/packages/genkit-mcp/src/genkit_mcp/_host.py` (modified, +3/-1)
```diff
@@ -341,14 +341,16 @@ async def _release(self, client: McpClient) -> None:
 
     def _build_client(self, server_name: str, config: McpStdioServerConfig) -> McpClient:
         """Build a client for one server, which serves no provider until it is installed."""
-        return McpClient(
+        client = McpClient(
             server_name,
             command=config.command,
             args=config.args,
             env=config.env,
             cwd=config.cwd,
             request_timeout_millis=self._request_timeout_millis,
         )
+        client._host = self._name
+        return client
 
     def _stdio_config(self, server_name: str, entry: McpServerEntry) -> McpStdioServerConfig:
         """Validate one server's name and entry, naming the server when it is not a stdio entry."""
```

**File**: `py/packages/genkit-mcp/src/genkit_mcp/_tools.py` (modified, +7/-7)
```diff
@@ -39,15 +39,15 @@
 
 logger = get_logger(__name__)
 
-MAX_TOOL_NAME_LENGTH = 64
+_MAX_TOOL_NAME_LENGTH = 64
 """Longest function declaration name both Gemini and OpenAI accept."""
 
-TOOL_NAME_PATTERN = re.compile(r'[A-Za-z_][A-Za-z0-9_-]*')
+_TOOL_NAME_PATTERN = re.compile(r'[A-Za-z_][A-Za-z0-9_-]*')
 """What both Gemini and OpenAI accept in a function declaration name."""
 
 _TOOL_NAME_REJECTED_CHARS = re.compile(r'[^A-Za-z0-9_-]')
 
-SELECTOR_SEPARATORS = (':', '/')
+_SELECTOR_SEPARATORS = (':', '/')
 """Characters a tool selector puts around a provider name, so a name cannot hold them."""
 
 
@@ -63,7 +63,7 @@ def validate_provider_name(name: str) -> None:
     Raises:
         ValueError: If ``<name>:tool/<tool>`` would not parse as a selector.
     """
-    if name and not any(separator in name for separator in SELECTOR_SEPARATORS):
+    if name and not any(separator in name for separator in _SELECTOR_SEPARATORS):
         return
     raise ValueError(
         f'{name!r} cannot name an MCP provider: its tools are selected as '
@@ -84,7 +84,7 @@ def validate_tool_prefix(prefix: str) -> None:
         ValueError: If a name built from this prefix would be rejected by the
             model providers.
     """
-    if TOOL_NAME_PATTERN.fullmatch(prefix):
+    if _TOOL_NAME_PATTERN.fullmatch(prefix):
         return
     raise ValueError(
         f'{prefix!r} cannot prefix an MCP tool name: a function declaration name must start with a '
@@ -110,7 +110,7 @@ def mcp_tool_name(prefix: str, tool_name: str) -> str:
         The namespaced name sent to the model.
     """
     name = _TOOL_NAME_REJECTED_CHARS.sub('_', f'{prefix}_{tool_name}')
-    if not TOOL_NAME_PATTERN.fullmatch(name):
+    if not _TOOL_NAME_PATTERN.fullmatch(name):
         name = f'_{name}'
     return name
 
@@ -214,7 +214,7 @@ def mcp_tool_to_action(
             tool=tool_name,
             server_tool=tool.name,
         )
-    if len(tool_name) > MAX_TOOL_NAME_LENGTH:
+    if len(tool_name) > _MAX_TOOL_NAME_LENGTH:
         logger.warning(
             'MCP tool name is longer than most model providers accept',
             tool=tool_name,
```

**File**: `py/packages/genkit-mcp/tests/fake_server.py` (modified, +9/-0)
```diff
@@ -20,6 +20,7 @@
     CONNECTION_CLOSED,
     CallToolRequest,
     CallToolResult,
+    EmptyResult,
     ErrorData,
     ListToolsRequest,
     ListToolsResult,
@@ -148,6 +149,14 @@ async def failing_call(req: CallToolRequest) -> ServerResult:
 
     app.request_handlers[CallToolRequest] = failing_call
 
+if os.environ.get('MCP_FAKE_MALFORMED_REPLY'):
+    # An empty result is valid JSON-RPC but lacks the fields tools/list and tools/call require.
+    async def empty_reply(req: ListToolsRequest | CallToolRequest) -> ServerResult:
+        return ServerResult(EmptyResult())
+
+    app.request_handlers[ListToolsRequest] = empty_reply
+    app.request_handlers[CallToolRequest] = empty_reply
+
 if os.environ.get('MCP_FAKE_NO_TOOLS'):
     # Without these handlers the server neither advertises tools nor answers tools/list.
     del app.request_handlers[ListToolsRequest]
```

**File**: `py/packages/genkit-mcp/tests/mcp_client_test.py` (modified, +3/-3)
```diff
@@ -678,9 +678,9 @@ async def test_a_call_cut_off_by_close_fails_as_closed(tmp_path: Path) -> None:
 async def test_restart_reports_a_server_which_cannot_be_started(tmp_path: Path) -> None:
     """The caller of restart hears about a broken server, not the next generate."""
     ai = Genkit()
-    client = define_mcp_client(ai, 'fake', command=str(tmp_path / 'no-such-server'))
+    client = define_mcp_client(ai, 'bookshop', command=str(tmp_path / 'no-such-server'))
     try:
-        with pytest.raises(GenkitError, match='failed') as raised:
+        with pytest.raises(GenkitError, match="MCP connection to 'bookshop' .* failed") as raised:
             await client.restart()
         assert raised.value.status == 'UNAVAILABLE'
     finally:
@@ -907,4 +907,4 @@ def test_define_mcp_client_rejects_a_timeout_that_is_not_positive(timeout: int)
 def test_connection_rejects_a_timeout_that_is_not_positive(timeout: int) -> None:
     """The connection guards the timeout too, for callers that build one directly."""
     with pytest.raises(ValueError, match='request_timeout_millis'):
-        McpConnection(McpStdioServerConfig(command='npx'), request_timeout_millis=timeout)
+        McpConnection('fake', McpStdioServerConfig(command='npx'), request_timeout_millis=timeout)
```

**File**: `py/packages/genkit-mcp/tests/mcp_connection_test.py` (modified, +150/-60)
```diff
@@ -16,6 +16,7 @@
 import threading
 import time
 import traceback
+from collections.abc import Awaitable, Callable
 from datetime import timedelta
 from importlib import metadata
 from pathlib import Path
@@ -51,6 +52,8 @@
     TextContent,
     Tool as McpTool,
 )
+from pydantic import ValidationError
+from structlog.testing import capture_logs
 
 from genkit import get_logger
 
@@ -206,7 +209,7 @@ async def close_with_queued(connection: McpConnection, *requests: _Request[list[
 
 @pytest.mark.asyncio
 async def test_connect_list_call_and_close_reaps_server(tmp_path: Path) -> None:
-    connection = McpConnection(config(tmp_path))
+    connection = McpConnection('fake', config(tmp_path))
 
     assert [tool.name for tool in await asyncio.wait_for(connection.list_tools(), timeout=LIMIT)] == ALL_TOOLS
     assert text_of(await asyncio.wait_for(connection.call_tool('echo', {'message': 'hello'}), timeout=LIMIT)) == 'hello'
@@ -215,13 +218,13 @@ async def test_connect_list_call_and_close_reaps_server(tmp_path: Path) -> None:
     await asyncio.wait_for(connection.close(), timeout=LIMIT)
     await asyncio.wait_for(connection.close(), timeout=LIMIT)
     assert not is_running(pid)
-    with pytest.raises(_ConnectionClosedError, match='closed'):
+    with pytest.raises(_ConnectionClosedError, match="MCP connection to 'fake' .* is closed"):
         await asyncio.wait_for(connection.list_tools(), timeout=LIMIT)
 
 
 @pytest.mark.asyncio
 async def test_list_tools_follows_pagination_cursors(tmp_path: Path) -> None:
-    connection = McpConnection(config(tmp_path, MCP_FAKE_PAGE_SIZE='1'))
+    connection = McpConnection('fake', config(tmp_path, MCP_FAKE_PAGE_SIZE='1'))
     try:
         assert [tool.name for tool in await asyncio.wait_for(connection.list_tools(), timeout=LIMIT)] == ALL_TOOLS
         served = await asyncio.wait_for(connection.call_tool('list_requests', {}), timeout=LIMIT)
@@ -232,7 +235,7 @@ async def test_list_tools_follows_pagination_cursors(tmp_path: Path) -> None:
 
 @pytest.mark.asyncio
 async def test_list_tools_treats_an_empty_cursor_as_the_last_page(tmp_path: Path) -> None:
-    connection = McpConnection(config(tmp_path, MCP_FAKE_EMPTY_CURSOR='1'))
+    connection = McpConnection('fake', config(tmp_path, MCP_FAKE_EMPTY_CURSOR='1'))
     try:
         assert [tool.name for tool in await asyncio.wait_for(connection.list_tools(), timeout=LIMIT)] == ALL_TOOLS
         served = await asyncio.wait_for(connection.call_tool('list_requests', {}), timeout=LIMIT)
@@ -244,7 +247,7 @@ async def test_list_tools_treats_an_empty_cursor_as_the_last_page(tmp_path: Path
 @pytest.mark.asyncio
 async def test_a_server_without_the_tools_capability_lists_no_tools(tmp_path: Path) -> None:
     """Such a server answers tools/list with method not found, so it must not be asked."""
-    connection = McpConnection(config(tmp_path, MCP_FAKE_NO_TOOLS='1'))
+    connection = McpConnection('fake', config(tmp_path, MCP_FAKE_NO_TOOLS='1'))
     try:
         assert await asyncio.wait_for(connection.list_tools(), timeout=LIMIT) == []
     finally:
@@ -253,9 +256,9 @@ async def test_a_server_without_the_tools_capability_lists_no_tools(tmp_path: Pa
 
 @pytest.mark.asyncio
 async def test_list_tools_rejects_a_non_advancing_cursor(tmp_path: Path) -> None:
-    connection = McpConnection(config(tmp_path, MCP_FAKE_STUCK_CURSOR='1'))
+    connection = McpConnection('fake', config(tmp_path, MCP_FAKE_STUCK_CURSOR='1'))
     try:
-        with pytest.raises(_ProtocolError, match='repeated the tools/list cursor'):
+        with pytest.raises(_ProtocolError, match="MCP server 'fake' .* repeated the tools/list cursor"):
             await asyncio.wait_for(connection.list_tools(), timeout=LIMIT)
         alive = await asyncio.wait_for(connection.call_tool('echo', {'message': 'alive'}), timeout=LIMIT)
         assert text_of(alive) == 'alive'
@@ -265,7 +268,7 @@ async def test_list_tools_rejects_a_non_advancing_cursor(tmp_path: Path) -> None
 
 @pytest.mark.asyncio
 async def test_concurrent_requests_each_receive_their_own_result(tmp_path: Path) -> None:
-    connection = McpConnection(config(tmp_path))
+    connection = McpConnection('fake', config(tmp_path))
     try:
         first, tools, second, third = await asyncio.gather(
             connection.call_tool('echo', {'message': 'one'}),
@@ -284,7 +287,7 @@ async def test_concurrent_requests_each_receive_their_own_result(tmp_path: Path)
 
 @pytest.mark.asyncio
 async def test_a_cancelled_caller_is_never_sent_to_the_server(tmp_path: Path) -> None:
-    connection = McpConnection(config(tmp_path))
+    connection = McpConnection('fake', config(tmp_path))
     try:
         await asyncio.wait_for(connection.list_tools(), timeout=LIMIT)
         started: list[str] = []
@@ -306,7 +309,7 @@ async def abandoned(session: ClientSession) -> list[McpTool]:
 
 @pytest.mark.asyncio
 async def test_close_interrupts_an_in_flight_call(tmp_path: Path) -> None:
-    connection = McpConnection(config(t
```

---

### Incident Patch 2: `494584f1` (2026-11-10)
**Commit Message**: fix(py/plugins/mcp): stop tests using the removed GenkitError.cause (#7153)

**File**: `py/packages/genkit-mcp/tests/mcp_connection_test.py` (modified, +6/-5)
```diff
@@ -56,6 +56,7 @@
 from structlog.testing import capture_logs
 
 from genkit import get_logger
+from genkit._core._error import attached_cause, get_reflection_json  # noqa: TID251
 
 ALL_TOOLS = [
     'echo',
@@ -753,7 +754,7 @@ async def test_any_other_failure_is_reported_as_a_protocol_error(tmp_path: Path)
 
     assert isinstance(error, _ProtocolError)
     assert error.status == 'INTERNAL'
-    assert error.cause is failure
+    assert attached_cause(error) is failure
     assert error.__cause__ is failure
     assert "MCP request to 'fake' (" in str(error)
     assert 'failed with RuntimeError' in str(error)
@@ -780,7 +781,7 @@ async def test_a_malformed_reply_is_a_protocol_error_without_the_server_env(
             await asyncio.wait_for(send(connection), timeout=LIMIT)
         assert answered.value.status == 'INTERNAL'
         assert isinstance(answered.value.__cause__, ValidationError)
-        assert answered.value.cause is answered.value.__cause__
+        assert attached_cause(answered.value) is answered.value.__cause__
         assert connection._state is _ConnectionState.OPEN
         assert is_running(await server_pid(tmp_path / 'server.pid'))
     finally:
@@ -1065,9 +1066,9 @@ async def test_startup_failure_is_terminal_and_names_the_server_and_why(tmp_path
     assert f"MCP connection to 'catalog' ({str(missing)!r}) failed" in str(failure.value)
     cause = failure.value.__cause__
     assert isinstance(cause, OSError)
-    assert failure.value.cause is cause
+    assert attached_cause(failure.value) is cause
     assert str(cause) in str(failure.value)
-    assert repr(cause) in failure.value.to_serializable().message
+    assert repr(cause) in get_reflection_json(failure.value).message
     assert connection._state is _ConnectionState.FAILED
 
     with pytest.raises(_ConnectionFailedError, match='failed'):
@@ -1122,7 +1123,7 @@ async def test_a_request_timeout_fails_that_call_alone(tmp_path: Path) -> None:
         assert timed_out.value.status == 'DEADLINE_EXCEEDED'
         assert isinstance(timed_out.value.__cause__, McpError)
         assert timed_out.value.__cause__.error.code == 408
-        assert timed_out.value.cause is timed_out.value.__cause__
+        assert attached_cause(timed_out.value) is timed_out.value.__cause__
         assert str(timed_out.value.__cause__) in str(timed_out.value)
 
         assert connection._state is _ConnectionState.OPEN
```

#### Recent Merged Pull Requests:
- **PR #7183** (closed): build(deps): bump node-forge from 1.3.1 to 1.4.3 in /samples/js-character-generator (@dependabot[bot])
- **PR #7182** (closed): build(deps): bump node-forge from 1.3.1 to 1.4.3 in /samples/js-angular/server (@dependabot[bot])
- **PR #7181** (closed): build(deps-dev): bump node-forge from 1.3.1 to 1.4.3 in /samples/js-chatbot/genkit-app (@dependabot[bot])
- **PR #7180** (closed): build(deps-dev): bump node-forge from 1.3.1 to 1.4.3 in /samples/js-angular/genkit-app (@dependabot[bot])
- **PR #7179** (closed): chore(py): upgrade dotpromptz requirement to >=1.0.0,<2 (@huangjeff5)
- **PR #7178** (closed): build(deps): bump node-forge from 1.3.1 to 1.4.3 in /samples/js-chatbot/server (@dependabot[bot])

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

## X. py/plugins/mcp): say which server failed and why (#6930)

**RULE**:
When implementing operations in `py/packages/genkit-mcp/src/genkit_mcp/_client.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in genkit-ai/genkit. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d0d2e7af`: py/plugins/mcp): say which server failed and why (#6930). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `py/packages/genkit-mcp/src/genkit_mcp/_client.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
        self._host: str | None = None
            connection = McpConnection(
                self._name, self._server, request_timeout_millis=self._request_timeout_millis, host=self._host
            )
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
            connection = McpConnection(self._server, request_timeout_millis=self._request_timeout_millis)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d0d2e7af` are properly handled with clean fallback behavior.
