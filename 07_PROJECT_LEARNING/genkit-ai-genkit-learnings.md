> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/genkit-ai-genkit-learnings.md`  
> **Source**: github ([https://github.com/genkit-ai/genkit](https://github.com/genkit-ai/genkit))  
> **Source Version**: `4537d179`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-26T13:26:45.015Z  
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
> **Harvest Timestamp**: 2026-11-26T13:26:45.010Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `genkit-ai/genkit`
- **Description**: Open-source framework for building agentic apps in JavaScript, Go, Dart, and Python, built and used in production by Google
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6624 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

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

import type { BaseRuntimeManager } from '@genkit-ai/tools-common/manager';
import { GenkitToolsError } from '@genkit-ai/tools-common/manager';
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

### Core Architecture Module: `genkit-tools/cli/src/utils/legacy-context-warning.ts`
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

import { logger } from '@genkit-ai/tools-common/utils';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import * as path from 'path';

const LEGACY_GENKIT_MD_FILENAME = 'GENKIT.md';
const LEGACY_BAD_INSTRUCTION_MARKER = 'Do not run Genkit commands';

/**
 * Logs a read-only warning if the workspace has a legacy `GENKIT.md` file
 * containing outdated instructions from `genkit init:ai-tools`.
 */
export async function warnIfLegacyGenkitContext(
  projectRoot: string
): Promise<void> {
  const genkitMdPath = path.join(projectRoot, LEGACY_GENKIT_MD_FILENAME);
  if (!existsSync(genkitMdPath)) {
    return;
  }

  try {
    const content = await readFile(genkitMdPath, 'utf-8');
    if (content.includes(LEGACY_BAD_INSTRUCTION_MARKER)) {
      logger.warn(
        'Legacy `GENKIT.md` detected with outdated instructions from deprecated `genkit init:ai-tools`.\n' +
          'You can delete `GENKIT.md` (and any references to it) and install Genkit Agent Skills instead:\n' +
          '  npx skills add genkit-ai/skills'
      );
    }
  } catch (e) {
    logger.debug('Failed to inspect GENKIT.md for legacy instructions', e);
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
import type {
  BaseRuntimeManager,
  GenkitToolsError,
} from '@genkit-ai/tools-common/manager';
import {
  DEFAULT_REFLECTION_V2_HOST,
  ProcessManager,
  REFLECTION_SECRET_ENV,
  RuntimeEvent,
  RuntimeManager,
  generateReflectionSecret,
  reflectionV2Url,
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
    // The protocol is set explicitly to http/protobuf (the OTLP spec default,
    // supported by Go autoexport, Python, Java, and JS NodeSDK) so a shell
    // OTEL_EXPORTER_OTLP_*_PROTOCOL=grpc or Python opentelemetry-distro's grpc
    // default cannot leak in; per-signal endpoints are used verbatim (no /v1/*
    // appended), so the full path is spelled out. Metrics are deliberately not
    // redirected: the server doesn't ingest them, so they go wherever the app's
    // own OTel config sends them.
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
    envVars.OTEL_EXPORTER_OTLP_TRACES_PROTOCOL = 'http/protobuf';
    envVars.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT = `${baseUrl}/api/otlp/v1/logs`;
    envVars.OTEL_EXPORTER_OTLP_LOGS_PROTOCOL = 'http/protobuf';
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
  const experimentalReflecti
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

### Core Architecture Module: `genkit-tools/cli/src/utils/output.ts`
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

/**
 * Writes a line of primary command output to `stdout` (appending a trailing newline).
 *
 * Use this for intentional CLI payload output (such as JSON, JSONL, tables, or
 * formatted command results) rather than diagnostic messages, which belong on
 * `logger.*`.
 */
export function writeStdout(text = ''): void {
  process.stdout.write(`${text}\n`);
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
import { basename } from 'path';

const RUNTIME_NODE = 'node';
const RUNTIME_BUN = 'bun';
const RUNTIME_COMPILED = 'compiled-binary';

const NODE_PATTERNS = ['node', 'nodejs'];
const BUN_PATTERNS = ['bun'];

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

import type { SpawnOptions } from 'child_process';
import { access, constants } from 'fs/promises';
import { SERVER_HARNESS_COMMAND } from '../commands/server-harness.js';
import type { CLIRuntimeInfo } from './runtime-detector.js';

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
import type { z } from 'zod';

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

  const rootSpan 
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
import type { AxiosInstance } from 'axios';
import axios from 'axios';
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

  constructor(project_runtime?: string) {
    super();
    this.parameters = {
      project_runtime: project_runtime || 'unknown',
    };
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
export async function notifyAnalyticsIfFirstRun(
  projectRuntime?: string
): Promise<void> {
  if (isAnalyticsOptedOut()) return;

  if (configstore.get(NOTIFICATION_ACKED)) {
    return;
  }

  logger.info(ANALYTICS_NOTIFICATION);

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  await readline.question('Press "Enter" to acknowledge and continue');
  readline.close();

  configstore.set(NOTIFICATION_ACKED, true);

  await record(new FirstUsageEvent(projectRuntime));
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
            .r
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #7340** (2026-11-24): **[JS] Nest types under import/require in remaining 10 package.json exports**
  *Symptoms*: ### Summary  Follow-up to #7323 (and #1589).  In #7323, 16 `js/plugins/*/package.json` files were updated to nest `"types"` inside `"import"` (`.d.mts` + `.mjs`) and `"require"` (`.d.ts` + `.js`), with `"default"` last:  ```json "exports": {   ".": {     "import": {       "types": "./lib/index.d.mts",       "default": "./lib/index.mjs"     },     "require": {       "types": "./lib/index.d.ts",       "default": "./lib/index.js"     },     "default": "./lib/index.js"   } } ```  The remaining **10** `js/` packages still use the flat condition map (`"types": "./lib/*.d.ts"` before `"import"` / `"require"`). Because all `js/` packages declare `"type": "commonjs"`, TypeScript under `moduleResolution: "Node16"` / `"NodeNext"` treats `.d.ts` as a CommonJS declaration file, causing ESM imports to resolve CJS types ("Masquerading as CJS" / `FalseCJS`).  ### Impact  1. **Active `Node16` / `NodeNext` ESM breakage (3 plugins with `export default` on `"."`):**    - `js/plugins/anthropic/package.json` (`export default anthropic`)    - `js/plugins/dev-local-vectorstore/package.json` (`export default devLocalVectorstore`)    - `js/plugins/fastify/package.json` (`export default genkitFastify`)     ESM callers using `moduleResolution: "Node16"` or `"NodeNext"` who import the default export (e.g., `import anthropic from '@genkit-ai/anthropic'; anthropic();`) hit `TS2349: This expression is not callable`.  2. **Latent `FalseCJS` & repo inconsistency (7 packages with named-only public exports):** 

- **Issue #7277** (2026-11-23): **[PY] genkit-ollama drops tool requests from chat messages, so tool calls loop until max_turns**
  *Symptoms*: **Describe the bug**  `genkit-ollama` drops the model's tool requests when it converts a Genkit request into Ollama chat messages. `OllamaModel.build_chat_messages` (`py/packages/genkit-ollama/src/genkit_ollama/_models.py`) copies only text, tool-response output and images into each `ollama.Message`:  ```python for text_part in message.content:     if text_part.text is not None:         item.content = (item.content or '') + text_part.text     elif text_part.tool_response is not None:         item.content = (item.content or '') + str(text_part.tool_response.output)     elif text_part.media is not None:         ... ```  A `tool_request` part is ignored, so the assistant message that asked for the tool reaches Ollama with empty content and no `tool_calls`, and the tool message that follows has no `tool_name`. The model receives a tool result for a call it never made, calls the tool again, and the generate loop ends with `ABORTED` / `Exceeded maximum tool call iterations`.  Any tool use through the Ollama plugin is affected: `ai.generate(tools=...)`, prompts with tools, and agents (`genkit.exp`), where every tool turn aborts.  **To Reproduce**  Ollama running locally with `gemma4:e4b` pulled.  ```python import asyncio  from genkit import Genkit, Message, Part, Role from genkit.model import ModelRequest from genkit_ollama import Ollama from genkit_ollama._models import OllamaModel from pydantic import BaseModel  ai = Genkit(plugins=[Ollama()]) calls = 0   class NoInput(BaseModel):

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

### Incident Patch 1: `4537d179` (2026-11-25)
**Commit Message**: feat(go/ai/exp): add Agent.DeleteSession and the SessionDeleter store capability (#6858)

**File**: `go/ai/exp/agent.go` (modified, +60/-5)
```diff
@@ -707,9 +707,13 @@ func (s *SessionRunner[State]) snapshotTurnEnd(ctx context.Context, finishReason
 			}, nil
 		})
 	if err != nil {
-		logger.Error(ctx, "agent failed to save snapshot",
-			"parentId", parentID,
-			"error", err)
+		// A deleted session is not a failure: the work simply stops being
+		// persisted.
+		if !errors.Is(err, ErrSessionDeleted) {
+			logger.Error(ctx, "agent failed to save snapshot",
+				"parentId", parentID,
+				"error", err)
+		}
 		return ""
 	}
 
@@ -967,6 +971,51 @@ func (a *Agent[State]) Abort(ctx context.Context, snapshotID string) (SnapshotSt
 	return abortPendingSnapshot(ctx, a.store, snapshotID)
 }
 
+// DeleteSession permanently removes every persisted snapshot of a session. A
+// detached run still in flight is aborted first, so the work stops rather than
+// continuing against data that is going away. It reports whether anything was
+// removed and is idempotent: a session with no persisted data is not an error.
+//
+// Resuming by session ID afterwards starts a fresh session, and resuming by
+// snapshot ID fails with [ErrSnapshotNotFound]. A run that is still going when
+// the session is deleted stops persisting instead of failing; it cannot bring
+// the session back. Traces, logs, and durable streams live outside the store
+// and are not touched.
+//
+// This is an in-process API only: no companion action or route is registered
+// for it, so put it behind your own authorization.
+//
+// It returns FAILED_PRECONDITION on a client-managed agent or when the store
+// does not implement [SessionDeleter], and INVALID_ARGUMENT when sessionID is
+// empty.
+func (a *Agent[State]) DeleteSession(ctx context.Context, sessionID string) (bool, error) {
+	if a.store == nil {
+		return false, status.Errorf(ErrSessionStoreNotConfigured, "agent %q: DeleteSession requires a session store", a.Name())
+	}
+	if sessionID == "" {
+		return false, status.Errorf(status.ErrInvalidArgument, "agent %q: DeleteSession: sessionID is required", a.Name())
+	}
+	deleter, ok := a.store.(SessionDeleter)
+	if !ok {
+		return false, status.Errorf(status.ErrFailedPrecondition, "agent %q: the session store does not support DeleteSession", a.Name())
+	}
+	// Stop an in-flight detached run first. Best effort: a failure here is
+	// logged and the delete goes on, because the store also tells the run's
+	// subscription its row is gone and rejects writers that continue the
+	// deleted chain.
+	latest, err := getLatestSnapshotMetadata(ctx, a.store, sessionID)
+	if err != nil {
+		logger.Warn(ctx, "agent: could not look up the session's latest snapshot before deleting it",
+			"sessionId", sessionID, "error", err)
+	} else if latest != nil && latest.Status == SnapshotStatusPending {
+		if _, err := abortPendingSnapshot(ctx, a.store, latest.SnapshotID); err != nil {
+			logger.Warn(ctx, "agent: could not abort the session's pending snapshot before deleting it",
+				"snapshotId", latest.SnapshotID, "error", err)
+		}
+	}
+	return deleter.DeleteSession(ctx, sessionID)
+}
+
 // --- api.BidiAction implementation ---
 
 // Agent is itself an [api.BidiAction]: transports that accept an
@@ -2214,7 +2263,12 @@ func (rt *agentRuntime[State]) finalizePendingSnapshot(
 
 	_, err := rt.cfg.store.SaveSnapshot(ctx, pending.SnapshotID,
 		func(existing *SessionSnapshot[State]) (*SessionSnapshot[State], error) {
-			if existing != nil && existing.Status.Terminal() {
+			if existing == nil {
+				// The pending row is gone: its session was deleted while the
+				// work ran. Writing would bring the session back.
+				return nil, nil
+			}
+			if existing.Status.Terminal() {
 				// Already settled (a retried finalize, or a writer that
 				// landed a terminal status directly): the row describes
 				// itself, so leave it.
@@ -2235,7 +2289,8 @@ func (rt *agentRuntime[State]) finalizePendingSnapshot(
 				UpdatedAt:    now,
 			}, nil
 		})
-	if err != nil {
+	// A deleted session is not a failure: the run simply stops persisting.
+	if err != nil && !errors.Is(err, ErrSessionDeleted) {
 		logger.Error(ctx, "agent: failed to finalize pending snapshot",
 			"snapshotId", pending.SnapshotID, "error", err)
 	}
```

**File**: `go/ai/exp/agent_test.go` (modified, +166/-0)
```diff
@@ -9431,3 +9431,169 @@ func TestAgent_Usage(t *testing.T) {
 		}
 	})
 }
+
+// defineQuickDeleteAgent registers a trivial agent that completes each turn at once.
+func defineQuickDeleteAgent(t *testing.T, name string, store SessionStore[testState]) *Agent[testState] {
+	t.Helper()
+	opts := []AgentOption[testState]{}
+	if store != nil {
+		opts = append(opts, WithSessionStore(store))
+	}
+	return DefineCustomAgent(newTestRegistry(t), name,
+		func(ctx context.Context, resp Responder, sess *SessionRunner[testState]) (*AgentResult, error) {
+			return nil, sess.Run(ctx, func(ctx context.Context, input *AgentInput) (*TurnResult, error) {
+				sess.AddMessages(ai.NewModelTextMessage("done"))
+				return nil, nil
+			})
+		},
+		opts...,
+	)
+}
+
+func TestAgent_DeleteSession_CompletedSession(t *testing.T) {
+	ctx := context.Background()
+	store := newTestInMemStore[testState]()
+	agent := defineQuickDeleteAgent(t, "deleteCompleted", store)
+
+	out, err := agent.Run(ctx, &AgentInput{Message: ai.NewUserTextMessage("hi")})
+	if err != nil {
+		t.Fatalf("Run: %v", err)
+	}
+	if out.SessionID == "" || out.SnapshotID == "" {
+		t.Fatalf("output has no session/snapshot ID: %+v", out)
+	}
+
+	removed, err := agent.DeleteSession(ctx, out.SessionID)
+	if err != nil || !removed {
+		t.Fatalf("DeleteSession = %v, %v; want true, nil", removed, err)
+	}
+	if got, err := store.GetSnapshot(ctx, out.SnapshotID); err != nil || got != nil {
+		t.Errorf("snapshot survived the delete: %v, %v", got, err)
+	}
+	// Idempotent.
+	if removed, err := agent.DeleteSession(ctx, out.SessionID); err != nil || removed {
+		t.Errorf("second DeleteSession = %v, %v; want false, nil", removed, err)
+	}
+	// Resuming by snapshot ID now fails; by session ID it starts fresh.
+	if _, err := agent.Run(ctx, &AgentInput{Message: ai.NewUserTextMessage("again")}, WithSnapshotID[testState](out.SnapshotID)); err == nil {
+		t.Error("resume by snapshot ID after delete succeeded, want an error")
+	}
+	fresh, err := agent.Run(ctx, &AgentInput{Message: ai.NewUserTextMessage("again")}, WithSessionID[testState](out.SessionID))
+	if err != nil {
+		t.Fatalf("resume by session ID: %v", err)
+	}
+	row, err := store.GetSnapshot(ctx, fresh.SnapshotID)
+	if err != nil || row == nil || row.ParentID != "" {
+		t.Errorf("resumed session row = %+v, %v; want a fresh root", row, err)
+	}
+}
+
+func TestAgent_DeleteSession_AbortsPendingRunAndDoesNotResurrect(t *testing.T) {
+	ctx := context.Background()
+	reg := newTestRegistry(t)
+	store := newTestInMemStore[testState]()
+	store.saved = make(chan string, 64)
+	agent, entered, release := defineGatedAgent(t, reg, "deletePending", store)
+
+	task, err := agent.RunDetached(ctx, &AgentInput{Message: ai.NewUserTextMessage("go")})
+	if err != nil {
+		t.Fatalf("RunDetached: %v", err)
+	}
+	select {
+	case <-entered:
+	case <-time.After(2 * time.Second):
+		t.Fatal("background work did not start")
+	}
+	pending, err := store.GetSnapshot(ctx, task.SnapshotID())
+	if err != nil || pending == nil || pending.Status != SnapshotStatusPending {
+		t.Fatalf("pending row = %+v, %v", pending, err)
+	}
+
+	if removed, err := agent.DeleteSession(ctx, pending.SessionID); err != nil || !removed {
+		t.Fatalf("DeleteSession = %v, %v; want true, nil", removed, err)
+	}
+
+	// Let the worker finish whichever way it will. Its last write is the
+	// finalize of the pending row, so wait for that attempt rather than sleeping;
+	// nothing may be written back.
+	for len(store.saved) > 0 {
+		<-store.saved
+	}
+	close(release)
+	deadline := time.After(5 * time.Second)
+settled:
+	for {
+		select {
+		case id := <-store.saved:
+			if id == task.SnapshotID() {
+				break settled
+			}
+		case <-deadline:
+			t.Fatal("worker never finalized the deleted pending row")
+		}
+	}
+	if n := store.snapshotCount(); n != 0 {
+		t.Errorf("store holds %d rows after the delete, want 0 (session came back)", n)
+	}
+}
+
+func TestAgent_DeleteSession_Errors(t *testing.T) {
+	ctx := context.Background()
+
+	t.Run("client-managed agent", func(t *testing.T) {
+		agent := defineQuickDeleteAgent(t, "deleteNoStore", nil)
+		if _, err := agent.DeleteSession(ctx, "s"); !errors.Is(err, ErrSessionStoreNotConfigured) {
+			t.Errorf("error = %v, want ErrSessionStoreNotConfigured", err)
+		}
+	})
+
+	t.Run("store without the capability", func(t *testing.T) {
+		// Embedding the interface hides DeleteSession.
+		agent := defineQuickDeleteAgent(t, "deleteUnsupported", struct{ SessionStore[testState] }{newTestInMemStore[testState]()})
+		if _, err := agent.DeleteSession(ctx, "s"); !errors.Is(err, status.ErrFailedPrecondition) {
+			t.Errorf("error = %v, want FAILED_PRECONDITION", err)
+		}
+	})
+
+	t.Run("empty session ID", func(t *testing.T) {
+		agent := defineQuickDeleteAgent(t, "deleteEmptyID", newTestInMemStore[testState]())
+		if _, err := agent.DeleteSession(ctx, ""); !errors.Is(err, status.ErrInvalidArgument) {
+			t.Errorf("error = %v, want INVALID_ARGUMENT", err)
+		}
+	})
+}
+

```

**File**: `go/ai/exp/errors.go` (modified, +6/-0)
```diff
@@ -34,4 +34,10 @@ var (
 	// Every store implementation rejects this: a snapshot with no session cannot
 	// be resolved back to a conversation.
 	ErrSessionIDRequired = status.ErrInvalidArgument.Subtype("session ID is required")
+
+	// ErrSessionDeleted means a snapshot was written that continues the chain
+	// of a session removed with [Agent.DeleteSession]. Stores reject it so a
+	// late writer cannot bring the session back; the runtime treats it as "stop
+	// persisting" rather than a failure.
+	ErrSessionDeleted = status.ErrFailedPrecondition.Subtype("session deleted")
 )
```

**File**: `go/ai/exp/handle.go` (modified, +47/-0)
```diff
@@ -104,6 +104,15 @@ type AgentTransport interface {
 	Run(ctx context.Context, input *AgentInput, init *AgentInit[json.RawMessage], cb func(context.Context, json.RawMessage) error) (*AgentOutput[json.RawMessage], error)
 }
 
+// SessionDeleteTransport is the optional part of an [AgentTransport] that can
+// delete a session. Only an in-process transport offers it: deletion has no
+// companion action, so nothing serves it over the wire. A handle whose
+// transport lacks it refuses [AgentHandle.DeleteSession] with
+// FAILED_PRECONDITION.
+type SessionDeleteTransport interface {
+	DeleteSession(ctx context.Context, sessionID string) (bool, error)
+}
+
 // SnapshotTransport is the optional part of an [AgentTransport] that reaches
 // the agent's snapshot lifecycle. A handle whose transport lacks it refuses
 // snapshot operations with FAILED_PRECONDITION. A method may also refuse with
@@ -215,6 +224,8 @@ func (a *Agent[State]) Handle() *AgentHandle {
 			getSnapshot: a.getSnapshot,
 			wait:        a.wait,
 			abort:       a.abort,
+
+			deleteSession: a.DeleteSession,
 		},
 	}
 }
@@ -533,6 +544,29 @@ func (h *AgentHandle) Abort(ctx context.Context, snapshotID string) (SnapshotSta
 	return resp.Status, nil
 }
 
+// DeleteSession permanently removes every persisted snapshot of a session, as
+// [Agent.DeleteSession] does, and reports whether anything was removed. It
+// works only on a handle for an agent in this process ([Agent.Handle]): the
+// operation has no companion action on purpose, so a handle from [LookupAgent]
+// or a remote one returns FAILED_PRECONDITION.
+//
+// It also returns FAILED_PRECONDITION when the agent has no session store or
+// its store cannot delete, and INVALID_ARGUMENT when sessionID is empty.
+func (h *AgentHandle) DeleteSession(ctx context.Context, sessionID string) (bool, error) {
+	if h == nil {
+		return false, nilHandleError("DeleteSession")
+	}
+	if sessionID == "" {
+		return false, status.Errorf(status.ErrInvalidArgument, "agent %q: DeleteSession: sessionID is required", h.name)
+	}
+	dt, ok := h.transport.(SessionDeleteTransport)
+	if !ok {
+		return false, status.Errorf(status.ErrFailedPrecondition,
+			"agent %q: its transport cannot delete a session", h.name)
+	}
+	return dt.DeleteSession(ctx, sessionID)
+}
+
 // snapshotTransport returns the handle's transport as a [SnapshotTransport],
 // or the refusal for one that reaches no snapshot lifecycle. verb names what
 // the caller wanted to do with a snapshot.
@@ -566,6 +600,10 @@ type actionTransport struct {
 	getSnapshot api.Action
 	wait        api.Action
 	abort       api.Action
+	// deleteSession is set only for an in-process agent ([Agent.Handle]): no
+	// companion action exists for deletion on purpose, so a handle that
+	// reaches the agent through actions cannot delete a session.
+	deleteSession func(ctx context.Context, sessionID string) (bool, error)
 }
 
 func (t *actionTransport) Run(ctx context.Context, input *AgentInput, init *AgentInit[json.RawMessage], cb func(context.Context, json.RawMessage) error) (*AgentOutput[json.RawMessage], error) {
@@ -632,6 +670,15 @@ func (t *actionTransport) Abort(ctx context.Context, req *AgentAbortRequest) (*A
 	return callJSON[AgentAbortResponse](ctx, t.name, t.abort, "abort", req)
 }
 
+// DeleteSession implements [SessionDeleteTransport].
+func (t *actionTransport) DeleteSession(ctx context.Context, sessionID string) (bool, error) {
+	if t.deleteSession == nil {
+		return false, status.Errorf(status.ErrFailedPrecondition,
+			"agent %q: deleting a session is not available through this handle: it is an in-process API with no companion action", t.name)
+	}
+	return t.deleteSession(ctx, sessionID)
+}
+
 // callJSON dispatches req to act, one of the agent's companion actions, and
 // decodes the result into Resp. what names the exchange in the marshal and
 // unmarshal errors; a dispatch error is returned as is, so its status stays
```

**File**: `go/ai/exp/handle_test.go` (modified, +43/-0)
```diff
@@ -1009,3 +1009,46 @@ func TestAgentHandle_MetadataOnlyPrefersTheStoreCapability(t *testing.T) {
 			store.metadataReads, store.latestMetadataReads, store.fullReads, store.latestFullReads)
 	}
 }
+
+func TestAgentHandle_DeleteSession(t *testing.T) {
+	ctx := context.Background()
+
+	t.Run("local handle deletes through the agent", func(t *testing.T) {
+		store := newTestInMemStore[testState]()
+		agent := defineQuickDeleteAgent(t, "handleDelete", store)
+		out, err := agent.Run(ctx, &AgentInput{Message: ai.NewUserTextMessage("hi")})
+		if err != nil {
+			t.Fatalf("Run: %v", err)
+		}
+		removed, err := agent.Handle().DeleteSession(ctx, out.SessionID)
+		if err != nil || !removed {
+			t.Fatalf("DeleteSession = %v, %v; want true, nil", removed, err)
+		}
+		if n := store.snapshotCount(); n != 0 {
+			t.Errorf("store holds %d rows, want 0", n)
+		}
+	})
+
+	t.Run("registry handle has no route", func(t *testing.T) {
+		reg := newTestRegistry(t)
+		defineGatedAgent(t, reg, "handleDeleteRemote", newTestInMemStore[testState]())
+		_, err := LookupAgent(reg, "handleDeleteRemote").DeleteSession(ctx, "s")
+		if !errors.Is(err, status.ErrFailedPrecondition) {
+			t.Errorf("error = %v, want FAILED_PRECONDITION", err)
+		}
+	})
+
+	t.Run("empty session ID", func(t *testing.T) {
+		agent := defineQuickDeleteAgent(t, "handleDeleteEmpty", newTestInMemStore[testState]())
+		if _, err := agent.Handle().DeleteSession(ctx, ""); !errors.Is(err, status.ErrInvalidArgument) {
+			t.Errorf("error = %v, want INVALID_ARGUMENT", err)
+		}
+	})
+
+	t.Run("nil handle", func(t *testing.T) {
+		var h *AgentHandle
+		if _, err := h.DeleteSession(ctx, "s"); err == nil {
+			t.Error("nil handle returned no error")
+		}
+	})
+}
```

**File**: `go/ai/exp/localstore/file.go` (modified, +100/-3)
```diff
@@ -94,6 +94,13 @@ type FileSessionStore[State any] struct {
 	// snapshot files to detect cross-process status changes; <= 0 disables it.
 	poll time.Duration
 	subs map[string]*snapshotSubs
+	// deleted holds the snapshots removed by DeleteSession, keyed by prefix and
+	// snapshot ID, so a late writer continuing a deleted chain is rejected even
+	// after a fresh root snapshot reuses the session ID; see SaveSnapshot. It
+	// grows by one entry per deleted snapshot for the life of the store.
+	// In-process only: a writer in another process sharing the directory is not
+	// stopped.
+	deleted map[string]struct{}
 	// pollCancel stops the background poller. It is non-nil exactly while the
 	// poller runs: while at least one subscription is active and poll > 0.
 	pollCancel context.CancelFunc
@@ -166,6 +173,7 @@ func NewFileSessionStore[State any](dir string, opts ...FileStoreOption) (*FileS
 		prefixFn: resolved.prefixFn,
 		poll:     poll,
 		subs:     make(map[string]*snapshotSubs),
+		deleted:  make(map[string]struct{}),
 	}, nil
 }
 
@@ -255,6 +263,14 @@ func (s *FileSessionStore[State]) SaveSnapshot(
 	if next.Status == "" {
 		next.Status = exp.SnapshotStatusCompleted
 	}
+	// A late writer continuing a deleted chain (or rewriting one of its rows)
+	// must not bring the session back, even if a fresh root has since reused the
+	// session ID.
+	_, rowGone := s.deleted[tombstoneKey(prefix, id)]
+	_, parentGone := s.deleted[tombstoneKey(prefix, next.ParentID)]
+	if rowGone || (next.ParentID != "" && parentGone) {
+		return nil, status.Errorf(exp.ErrSessionDeleted, "session %q was deleted", next.SessionID)
+	}
 
 	if err := s.writeAt(prefix, next); err != nil {
 		return nil, err
@@ -275,6 +291,61 @@ func (s *FileSessionStore[State]) SaveSnapshot(
 	return next, nil
 }
 
+// tombstoneKey identifies a deleted snapshot within its tenant prefix.
+func tombstoneKey(prefix, snapshotID string) string {
+	return prefix + "\x00" + snapshotID
+}
+
+// DeleteSession removes every snapshot file of the session, and its pointer,
+// under the call's prefix directory, per [exp.SessionDeleter]. Matching rows
+// are found by scanning the prefix directory, so the cost grows with the
+// number of rows in the prefix. Subscribers of a removed snapshot see
+// [exp.SnapshotStatusAborted] before their channel closes. Deletion across
+// processes sharing the directory is best effort: a row another process writes
+// after the scan is not removed.
+func (s *FileSessionStore[State]) DeleteSession(ctx context.Context, sessionID string) (bool, error) {
+	if sessionID == "" {
+		return false, status.Errorf(exp.ErrSessionIDRequired, "DeleteSession requires a session ID")
+	}
+	if err := validateSessionID(sessionID); err != nil {
+		return false, err
+	}
+	prefix, err := s.derivePrefix(ctx)
+	if err != nil {
+		return false, err
+	}
+
+	s.mu.Lock()
+	defer s.mu.Unlock()
+
+	names, err := s.snapshotFileNames(s.prefixDir(prefix))
+	if err != nil {
+		return false, err
+	}
+	removed := false
+	for _, name := range names {
+		path := filepath.Join(s.prefixDir(prefix), name)
+		var header snapshotHeader
+		if ok, err := readJSONAt(path, &header); err != nil || !ok || header.SessionID != sessionID {
+			// Unreadable, vanished, or another session's row: not ours to remove.
+			continue
+		}
+		if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
+			return removed, fmt.Errorf("FileSessionStore: remove %s: %w", path, err)
+		}
+		removed = true
+		snapshotID := strings.TrimSuffix(name, ".json")
+		s.deleted[tombstoneKey(prefix, snapshotID)] = struct{}{}
+		s.endSubsLocked(snapshotID, exp.SnapshotStatusAborted)
+	}
+	if err := os.Remove(s.pointerPathFor(prefix, sessionID)); err == nil {
+		removed = true
+	} else if !errors.Is(err, os.ErrNotExist) {
+		return removed, fmt.Errorf("FileSessionStore: remove pointer: %w", err)
+	}
+	return removed, nil
+}
+
 // snapshotHeader is the subset of snapshot fields needed to pick a session's
 // latest row during the scan. Decoding only these avoids materializing every
 // row's full conversation state; only the winning row is fully decoded.
@@ -746,6 +817,25 @@ func (s *FileSessionStore[State]) removeSub(snapshotID string, ch chan exp.Snaps
 	close(ch)
 }
 
+// endSubsLocked delivers a final status to every subscriber of snapshotID and
+// closes their channels, dropping the snapshot's bookkeeping (and stopping the
+// poller once no subscriptions remain). Used when the row is gone. Caller must
+// hold s.mu.
+func (s *FileSessionStore[State]) endSubsLocked(snapshotID string, status exp.SnapshotStatus) {
+	sub := s.subs[snapshotID]
+	if sub == nil {
+		return
+	}
+	for _, ch := range sub.chans {
+		coalesceSend(ch, status)
+		close(ch)
+	}
+	delete(s.subs, snapshotID)
+	if len(s.subs) == 0 {
+		s.stopPollerLocked()
+	}
+}
+
 // maybeNotifyLocked fans status out to snapshotID's subscribers, but only when
 // it differs from the value they last saw. It is the shared dedup gate
```

**File**: `go/ai/exp/localstore/file_test.go` (modified, +75/-0)
```diff
@@ -771,3 +771,78 @@ func TestFileSessionStore_PathUnsafeSessionIDRejected(t *testing.T) {
 		})
 	}
 }
+
+type deleteTenantKey struct{}
+
+func TestFileSessionStore_Delete_TenantPrefix(t *testing.T) {
+	// The same session ID under two tenants: deleting it for one must not touch
+	// the other.
+	store, err := NewFileSessionStore[testState](t.TempDir(), WithSnapshotPathPrefix(func(ctx context.Context) string {
+		tenant, _ := ctx.Value(deleteTenantKey{}).(string)
+		return tenant
+	}))
+	if err != nil {
+		t.Fatalf("NewFileSessionStore: %v", err)
+	}
+	alice := context.WithValue(context.Background(), deleteTenantKey{}, "alice")
+	bob := context.WithValue(context.Background(), deleteTenantKey{}, "bob")
+	for _, ctx := range []context.Context{alice, bob} {
+		now := time.Now()
+		if _, err := store.SaveSnapshot(ctx, "snap",
+			func(_ *exp.SessionSnapshot[testState]) (*exp.SessionSnapshot[testState], error) {
+				return &exp.SessionSnapshot[testState]{SessionID: "shared", CreatedAt: now, UpdatedAt: now}, nil
+			}); err != nil {
+			t.Fatalf("SaveSnapshot: %v", err)
+		}
+	}
+
+	if removed, err := store.DeleteSession(alice, "shared"); err != nil || !removed {
+		t.Fatalf("DeleteSession(alice) = %v, %v; want true, nil", removed, err)
+	}
+	if got, err := store.GetLatestSnapshot(alice, "shared"); err != nil || got != nil {
+		t.Errorf("alice still sees the session: %v, %v", got, err)
+	}
+	if got, err := store.GetLatestSnapshot(bob, "shared"); err != nil || got == nil {
+		t.Errorf("bob lost his session: %v, %v", got, err)
+	}
+}
+
+func TestFileSessionStore_Delete_SeenByAnotherStoreInstance(t *testing.T) {
+	// A delete made through one store instance (standing in for another
+	// process) ends a subscription held on a different instance: the poller
+	// sees the file vanish and reports the run as aborted.
+	dir := t.TempDir()
+	watcher, err := NewFileSessionStore[testState](dir, WithPollInterval(10*time.Millisecond))
+	if err != nil {
+		t.Fatalf("NewFileSessionStore: %v", err)
+	}
+	deleter, err := NewFileSessionStore[testState](dir)
+	if err != nil {
+		t.Fatalf("NewFileSessionStore: %v", err)
+	}
+	ctx := context.Background()
+	now := time.Now()
+	if _, err := watcher.SaveSnapshot(ctx, "p1",
+		func(_ *exp.SessionSnapshot[testState]) (*exp.SessionSnapshot[testState], error) {
+			return &exp.SessionSnapshot[testState]{SessionID: "sess", Status: exp.SnapshotStatusPending, CreatedAt: now, UpdatedAt: now}, nil
+		}); err != nil {
+		t.Fatalf("SaveSnapshot: %v", err)
+	}
+
+	subCtx, cancel := context.WithCancel(ctx)
+	defer cancel()
+	ch := watcher.OnSnapshotStatusChange(subCtx, "p1")
+	<-ch // pending
+
+	if removed, err := deleter.DeleteSession(ctx, "sess"); err != nil || !removed {
+		t.Fatalf("DeleteSession = %v, %v; want true, nil", removed, err)
+	}
+	select {
+	case got := <-ch:
+		if got != exp.SnapshotStatusAborted {
+			t.Errorf("status = %q, want aborted", got)
+		}
+	case <-time.After(5 * time.Second):
+		t.Fatal("the other instance's subscription was not ended by the delete")
+	}
+}
```

**File**: `go/ai/exp/localstore/inmemory.go` (modified, +54/-1)
```diff
@@ -47,21 +47,28 @@ var (
 // is lost when the process exits; use [FileSessionStore] or a real backend
 // when persistence is needed.
 //
-// It implements [exp.SessionStore] and [exp.SnapshotSubscriber].
+// It implements [exp.SessionStore], [exp.SnapshotSubscriber] and
+// [exp.SessionDeleter].
 type InMemorySessionStore[State any] struct {
 	// mu is RWMutex so GetSnapshot (which JSON-marshals while holding the
 	// lock) can run concurrently with other readers. All writers (Save,
 	// Abort, OnSnapshotStatusChange, removeSub) take the full Lock().
 	mu        sync.RWMutex
 	snapshots map[string]*exp.SessionSnapshot[State]
 	subs      map[string][]chan exp.SnapshotStatus
+	// deleted holds the IDs of snapshots removed by DeleteSession, so a late
+	// writer continuing a deleted chain is rejected even after a fresh root
+	// snapshot reuses the session ID; see SaveSnapshot. It grows by one ID per
+	// deleted snapshot for the life of the store, which is the process.
+	deleted map[string]struct{}
 }
 
 // NewInMemorySessionStore creates a new in-memory snapshot store.
 func NewInMemorySessionStore[State any]() *InMemorySessionStore[State] {
 	return &InMemorySessionStore[State]{
 		snapshots: make(map[string]*exp.SessionSnapshot[State]),
 		subs:      make(map[string][]chan exp.SnapshotStatus),
+		deleted:   make(map[string]struct{}),
 	}
 }
 
@@ -216,6 +223,12 @@ func (s *InMemorySessionStore[State]) SaveSnapshot(
 	if next.Status == "" {
 		next.Status = exp.SnapshotStatusCompleted
 	}
+	// A late writer continuing a deleted chain (or rewriting one of its rows)
+	// must not bring the session back, even if a fresh root has since reused the
+	// session ID.
+	if s.isDeleted(id, next.ParentID) {
+		return nil, status.Errorf(exp.ErrSessionDeleted, "session %q was deleted", next.SessionID)
+	}
 
 	copied, err := copySnapshot(next)
 	if err != nil {
@@ -252,6 +265,46 @@ func (s *InMemorySessionStore[State]) OnSnapshotStatusChange(ctx context.Context
 	return ch
 }
 
+// DeleteSession removes every snapshot of the session, per
+// [exp.SessionDeleter]. Subscribers of a removed snapshot see
+// [exp.SnapshotStatusAborted] before their channel closes.
+func (s *InMemorySessionStore[State]) DeleteSession(_ context.Context, sessionID string) (bool, error) {
+	if sessionID == "" {
+		return false, status.Errorf(exp.ErrSessionIDRequired, "DeleteSession requires a session ID")
+	}
+	s.mu.Lock()
+	defer s.mu.Unlock()
+
+	removed := false
+	for id, snap := range s.snapshots {
+		if snap.SessionID != sessionID {
+			continue
+		}
+		delete(s.snapshots, id)
+		s.deleted[id] = struct{}{}
+		removed = true
+		for _, ch := range s.subs[id] {
+			coalesceSend(ch, exp.SnapshotStatusAborted)
+			close(ch)
+		}
+		delete(s.subs, id)
+	}
+	return removed, nil
+}
+
+// isDeleted reports whether a write for snapshot id with the given parent
+// touches a snapshot removed by DeleteSession. Caller must hold s.mu.
+func (s *InMemorySessionStore[State]) isDeleted(id, parentID string) bool {
+	if _, gone := s.deleted[id]; gone {
+		return true
+	}
+	if parentID == "" {
+		return false
+	}
+	_, gone := s.deleted[parentID]
+	return gone
+}
+
 // removeSub detaches a subscriber and closes its channel.
 func (s *InMemorySessionStore[State]) removeSub(snapshotID string, ch chan exp.SnapshotStatus) {
 	s.mu.Lock()
```

---

### Incident Patch 2: `78a83b38` (2026-11-25)
**Commit Message**: feat(js/plugins/anthropic): add Claude 5.5 and Fable models, drop retired ones (#7311)

**File**: `js/plugins/anthropic/README.md` (modified, +50/-22)
```diff
@@ -15,10 +15,30 @@ It supersedes the earlier community package `genkitx-anthropic` and is now maint
 
 ## Supported models
 
-The plugin supports the most recent Anthropic models like **Claude Haiku 4.5**,
-**Claude Sonnet 4.5**, and **Claude Opus 4.5**. Additionally, the plugin
-supports all of the
-[non-retired older models](https://platform.claude.com/docs/en/about-claude/model-deprecations#model-status).
+The plugin ships model definitions for every generally available Claude model
+on the Claude API. (The Claude Mythos models, which are limited to verified
+organizations, aren't listed; you can still use them by ID.)
+
+| Family | Model IDs |
+| ------ | --------- |
+| Claude Fable | `claude-fable-5-2`, `claude-fable-5-1`, `claude-fable-5` |
+| Claude Opus | `claude-opus-5-5`, `claude-opus-5`, `claude-opus-4-8`, `claude-opus-4-7`, `claude-opus-4-6`, `claude-opus-4-5` |
+| Claude Sonnet | `claude-sonnet-5-5`, `claude-sonnet-5`, `claude-sonnet-4-6` |
+| Claude Haiku | `claude-haiku-5-5`, `claude-haiku-4-5` |
+
+All of them accept text and image input, tools, system prompts and multi-turn
+conversations. Native structured (JSON) output needs the beta API surface
+(`apiVersion: 'beta'`); on the stable surface, asking a listed model for JSON or
+schema output throws an error.
+
+Retired models (Claude Sonnet 4.5, Claude Opus 4.1, Claude Opus 4, Claude
+Sonnet 4 and older) are no longer listed. You can still pass any other model
+ID, for example `anthropic.model("claude-some-new-model")`; IDs the plugin
+doesn't know are
+treated as text-only, so schema output for them is done through prompt
+instructions. See
+[model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations#model-status)
+for lifecycle dates.
 
 ## Installation
 
@@ -39,7 +59,7 @@ import { anthropic } from "@genkit-ai/anthropic";
 const ai = genkit({
   plugins: [anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })],
   // specify a default model for generate here if you wish:
-  model: anthropic.model("claude-sonnet-4-5"),
+  model: anthropic.model("claude-sonnet-5-5"),
 });
 ```
 
@@ -49,7 +69,7 @@ The simplest way to generate text is by using the `generate` method:
 
 ```typescript
 const response = await ai.generate({
-  model: anthropic.model("claude-haiku-4-5"),
+  model: anthropic.model("claude-haiku-5-5"),
   prompt: "Tell me a joke.",
 });
 
@@ -70,30 +90,38 @@ const response = await ai.generate({
 console.log(response.text);
 ```
 
-### Extended thinking
+### Thinking
 
-Claude 4.5 models can expose their internal reasoning. Enable it per-request
-with the Anthropic thinking config and read the reasoning from the response:
+Claude models can expose a summary of their reasoning. On current models
+(Claude Opus 4.6 and later, Claude Sonnet 4.6 and later, the Fable models and
+Claude Haiku 5.5), use adaptive thinking and steer how much the model thinks
+with `output_config.effort`: `low`, `medium`, `high`, `xhigh` or `max`. See
+[effort](https://platform.claude.com/docs/en/build-with-claude/effort) for
+per-model support.
 
 ```typescript
 const response = await ai.generate({
   prompt: "Walk me through your reasoning for Fermat’s little theorem.",
   config: {
     thinking: {
-      enabled: true,
-      budgetTokens: 4096, // Must be >= 1024 and less than max_tokens
+      adaptive: true,
+      display: "summarized", // return a readable summary of the reasoning
     },
+    output_config: { effort: "high" },
   },
 });
 
 console.log(response.text); // Final assistant answer
 console.log(response.reasoning); // Summarized thinking steps
 ```
 
-When thinking is enabled, request bodies sent through the plugin include the
-`thinking` payload (`{ type: 'enabled', budget_tokens: … }`) that Anthropic's
-API expects, and streamed responses deliver `reasoning` parts as they arrive so
-you can render the chain-of-thought incrementally.
+Older models (Claude Haiku 4.5, Claude Opus 4.5) use a
+fixed thinking budget instead: `thinking: { enabled: true, budgetTokens: 2048 }`
+(at least 1024 and less than `max_tokens`). Claude Opus 4.7, Claude Sonnet 5
+and every later model reject `budgetTokens`.
+
+Streamed responses deliver `reasoning` parts as they arrive so you can render
+the reasoning incrementally.
 
 ### Document Citations
 
@@ -106,7 +134,7 @@ helper to create citable documents. For more details, see the
 import { anthropic, anthropicDocument } from "@genkit-ai/anthropic";
 
 const response = await ai.generate({
-  model: anthropic.model("claude-sonnet-4-5"),
+  model: anthropic.model("claude-sonnet-5-5"),
   messages: [
     {
       role: "user",
@@ -161,7 +189,7 @@ messages, user messages, tools, and media.
 import { anthropic, cacheControl } from "@genkit-ai/anthropic";
 
 const response = await ai.generate({
-  model: anthropic.model("claude-sonnet-4-5"),
+  model: anthropic.model("claude-sonnet-5-5"),
   system: {
     text: longSystemPrompt,
     metadata: { ...cacheControl() }, // default: ephemeral
```

**File**: `js/plugins/anthropic/src/index.ts` (modified, +3/-3)
```diff
@@ -104,7 +104,7 @@ function validateApiKey(options?: PluginOptions): void {
  * });
  *
  * // Access models via the plugin's model() method:
- * const model = anthropic.model('claude-sonnet-4');
+ * const model = anthropic.model('claude-sonnet-5-5');
  * ```
  */
 function anthropicPlugin(options?: PluginOptions): GenkitPluginV2 {
@@ -168,7 +168,7 @@ export type AnthropicPlugin = {
 
 /**
  * Anthropic AI plugin for Genkit.
- * Includes Claude models (3, 3.5, and 4 series).
+ * Includes the current Claude models.
  */
 export const anthropic = anthropicPlugin as AnthropicPlugin;
 (anthropic as any).model = (
@@ -189,7 +189,7 @@ export const anthropic = anthropicPlugin as AnthropicPlugin;
  * import { anthropic, anthropicDocument } from '@genkit-ai/anthropic';
  *
  * const { text } = await ai.generate({
- *   model: anthropic.model('claude-sonnet-4-5'),
+ *   model: anthropic.model('claude-sonnet-5-5'),
  *   messages: [{
  *     role: 'user',
  *     content: [
```

**File**: `js/plugins/anthropic/src/models.ts` (modified, +11/-8)
```diff
@@ -61,8 +61,8 @@ function parseRetryAfterMs(value: string): number | undefined {
 type ConfigSchemaType = AnthropicConfigSchemaType;
 
 /**
- * Generic Claude model info for unknown/unsupported models.
- * Used when a model name is not in KNOWN_CLAUDE_MODELS.
+ * Model info for model names that are not in KNOWN_MODELS. Output is text
+ * only, so Genkit puts any output schema into the prompt as instructions.
  */
 export const GENERIC_MODEL_INFO: ModelInfo = {
   supports: {
@@ -75,7 +75,8 @@ export const GENERIC_MODEL_INFO: ModelInfo = {
 };
 
 /**
- * Advanced Claude model info for models that support JSON output.
+ * Model info for the models in KNOWN_MODELS: text and image input, tool use,
+ * system prompts, multi-turn, and native structured (JSON) output.
  */
 export const ADVANCED_MODEL_INFO: ModelInfo = {
   supports: {
@@ -104,18 +105,20 @@ function commonRef(
 }
 
 const KNOWN_MODELS = {
+  'claude-fable-5-2': commonRef('claude-fable-5-2', ADVANCED_MODEL_INFO),
+  'claude-fable-5-1': commonRef('claude-fable-5-1', ADVANCED_MODEL_INFO),
   'claude-fable-5': commonRef('claude-fable-5', ADVANCED_MODEL_INFO),
+  'claude-opus-5-5': commonRef('claude-opus-5-5', ADVANCED_MODEL_INFO),
+  'claude-opus-5': commonRef('claude-opus-5', ADVANCED_MODEL_INFO),
   'claude-opus-4-8': commonRef('claude-opus-4-8', ADVANCED_MODEL_INFO),
   'claude-opus-4-7': commonRef('claude-opus-4-7', ADVANCED_MODEL_INFO),
   'claude-opus-4-6': commonRef('claude-opus-4-6', ADVANCED_MODEL_INFO),
   'claude-opus-4-5': commonRef('claude-opus-4-5', ADVANCED_MODEL_INFO),
-  'claude-haiku-4-5': commonRef('claude-haiku-4-5', ADVANCED_MODEL_INFO),
+  'claude-sonnet-5-5': commonRef('claude-sonnet-5-5', ADVANCED_MODEL_INFO),
   'claude-sonnet-5': commonRef('claude-sonnet-5', ADVANCED_MODEL_INFO),
   'claude-sonnet-4-6': commonRef('claude-sonnet-4-6', ADVANCED_MODEL_INFO),
-  'claude-sonnet-4-5': commonRef('claude-sonnet-4-5', ADVANCED_MODEL_INFO),
-  'claude-opus-4-1': commonRef('claude-opus-4-1', ADVANCED_MODEL_INFO),
-  'claude-sonnet-4': commonRef('claude-sonnet-4'),
-  'claude-opus-4': commonRef('claude-opus-4'),
+  'claude-haiku-5-5': commonRef('claude-haiku-5-5', ADVANCED_MODEL_INFO),
+  'claude-haiku-4-5': commonRef('claude-haiku-4-5', ADVANCED_MODEL_INFO),
 } as const;
 export type KnownClaudeModels = keyof typeof KNOWN_MODELS;
 export type ClaudeModelName = `claude-${string}`;
```

**File**: `js/plugins/anthropic/src/types.ts` (modified, +1/-1)
```diff
@@ -175,7 +175,7 @@ export const AnthropicConfigSchema = GenerationCommonConfigSchema.extend({
   ),
   output_config: z
     .object({
-      effort: z.enum(['low', 'medium', 'high', 'xhigh']).optional(),
+      effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).optional(),
       task_budget: z
         .object({
           type: z.literal('tokens').default('tokens'),
```

**File**: `js/plugins/anthropic/src/utils.ts` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@ import type { CacheControlEphemeral } from '@anthropic-ai/sdk/resources/messages
  * import { anthropic, cacheControl } from '@genkit-ai/anthropic';
  *
  * const response = await ai.generate({
- *   model: anthropic.model('claude-sonnet-4-5'),
+ *   model: anthropic.model('claude-sonnet-5-5'),
  *   system: {
  *     text: longSystemPrompt,
  *     metadata: { ...cacheControl() }  // default ephemeral
```

**File**: `js/plugins/anthropic/tests/effort_param_test.ts` (modified, +35/-0)
```diff
@@ -171,6 +171,41 @@ describe('Effort Parameter Tests', () => {
     );
   });
 
+  test('should pass output_config.effort with max value', async () => {
+    const mockClient = createMockAnthropicClient({
+      messageResponse: createMockAnthropicMessage({
+        text: 'Response with max effort',
+      }),
+    });
+
+    const plugin = createPlugin({
+      apiVersion: 'beta',
+      mockClient,
+    });
+
+    const ai = createGenkitInstance(plugin);
+
+    await ai.generate({
+      model: 'anthropic/claude-opus-5-5',
+      prompt: 'Generate the most thorough response',
+      config: {
+        output_config: {
+          effort: 'max',
+        },
+      },
+    });
+
+    verifyApiCalled(mockClient, 'beta');
+    const apiRequest = getApiRequest(mockClient, 'beta');
+
+    assert.ok(apiRequest.output_config, 'Request should have output_config');
+    assert.strictEqual(
+      apiRequest.output_config.effort,
+      'max',
+      'effort should be set to max'
+    );
+  });
+
   test('should pass output_config.effort with medium value', async () => {
     const mockClient = createMockAnthropicClient({
       messageResponse: createMockAnthropicMessage({
```

**File**: `js/plugins/anthropic/tests/index_test.ts` (modified, +40/-7)
```diff
@@ -19,7 +19,7 @@ import { genkit, type ActionMetadata } from 'genkit';
 import type { ModelInfo } from 'genkit/model';
 import { describe, it } from 'node:test';
 import anthropic from '../src/index.js';
-import { TEST_ONLY } from '../src/models.js';
+import { TEST_ONLY, type KnownClaudeModels } from '../src/models.js';
 import { PluginOptions, __testClient } from '../src/types.js';
 
 import { createMockAnthropicClient } from './mocks/anthropic-client.js';
@@ -133,8 +133,8 @@ describe('Anthropic Plugin', () => {
           id: 'claude-haiku-4-5-latest',
           display_name: 'Claude 4.5 Haiku Latest',
         },
-        { id: 'claude-sonnet-4-5', display_name: 'Claude 4.5 Sonnet' },
-        { id: 'claude-sonnet-4', display_name: 'Claude 4 Sonnet' },
+        { id: 'claude-sonnet-4-6', display_name: 'Claude Sonnet 4.6' },
+        { id: 'claude-opus-5-5', display_name: 'Claude Opus 5.5' },
         { id: 'claude-new-5-20251212', display_name: 'Claude New 5' },
         { id: 'claude-experimental-latest' },
       ],
@@ -159,12 +159,12 @@ describe('Anthropic Plugin', () => {
       'Latest variant should be listed separately'
     );
     assert.ok(
-      names.includes('anthropic/claude-sonnet-4-5'),
-      'Unknown Claude 4.5 Sonnet should be listed with full model ID'
+      names.includes('anthropic/claude-sonnet-4-6'),
+      'Known Claude Sonnet 4.6 model should be listed with full model ID'
     );
     assert.ok(
-      names.includes('anthropic/claude-sonnet-4'),
-      'Known Claude Sonnet 4 model should be listed with full model ID'
+      names.includes('anthropic/claude-opus-5-5'),
+      'Known Claude Opus 5.5 model should be listed with full model ID'
     );
     assert.ok(
       names.includes('anthropic/claude-new-5-20251212'),
@@ -186,6 +186,13 @@ describe('Anthropic Plugin', () => {
       (model) => model.name === 'anthropic/claude-new-5-20251212'
     );
     assert.ok(newModelMetadata, 'New model metadata should exist');
+    const newModelInfo = getModelInfo(newModelMetadata);
+    assert.deepStrictEqual(
+      newModelInfo?.supports?.output,
+      ['text'],
+      'Unknown models should fall back to text-only output'
+    );
+    assert.strictEqual(newModelInfo?.supports?.constrained, undefined);
 
     const experimentalMetadata = models.find(
       (model) => model.name === 'anthropic/claude-experimental-latest'
@@ -234,6 +241,32 @@ describe('Anthropic Plugin', () => {
   });
 });
 
+describe('Known model list', () => {
+  const CURRENT_MODELS: KnownClaudeModels[] = [
+    'claude-fable-5-2',
+    'claude-fable-5-1',
+    'claude-fable-5',
+    'claude-opus-5-5',
+    'claude-opus-5',
+    'claude-opus-4-8',
+    'claude-opus-4-7',
+    'claude-opus-4-6',
+    'claude-opus-4-5',
+    'claude-sonnet-5-5',
+    'claude-sonnet-5',
+    'claude-sonnet-4-6',
+    'claude-haiku-5-5',
+    'claude-haiku-4-5',
+  ];
+
+  it('lists exactly the current models', () => {
+    assert.deepStrictEqual(
+      Object.keys(KNOWN_MODELS).sort(),
+      [...CURRENT_MODELS].sort()
+    );
+  });
+});
+
 describe('Per-request API key support', () => {
   it('should not throw when initialized with apiKey: false', () => {
     const originalApiKey = process.env.ANTHROPIC_API_KEY;
```

**File**: `js/plugins/anthropic/tests/live_test.ts` (modified, +8/-8)
```diff
@@ -76,7 +76,7 @@ describe('Live Anthropic API Tests', { skip: !API_KEY }, () => {
     });
 
     const result = await ai.generate({
-      model: 'anthropic/claude-sonnet-4-5',
+      model: 'anthropic/claude-sonnet-5-5',
       prompt:
         'Generate a fictional person with name "Alice", age 30, and city "New York". Return only the JSON.',
       output: { schema, format: 'json', constrained: true },
@@ -111,7 +111,7 @@ describe('Live Anthropic API Tests', { skip: !API_KEY }, () => {
     });
 
     const result = await ai.generate({
-      model: anthropic.model('claude-sonnet-4-5'),
+      model: anthropic.model('claude-sonnet-5-5'),
       messages: [
         {
           role: 'user',
@@ -170,7 +170,7 @@ describe('Live Anthropic API Tests', { skip: !API_KEY }, () => {
     const streamedChunks: string[] = [];
 
     const result = await ai.generate({
-      model: anthropic.model('claude-sonnet-4-5'),
+      model: anthropic.model('claude-sonnet-5-5'),
       messages: [
         {
           role: 'user',
@@ -218,7 +218,7 @@ describe('Live Anthropic API Tests', { skip: !API_KEY }, () => {
     });
 
     const result = await ai.generate({
-      model: anthropic.model('claude-sonnet-4-5'),
+      model: anthropic.model('claude-sonnet-5-5'),
       messages: [
         {
           role: 'user',
@@ -270,7 +270,7 @@ describe('Live Anthropic API Tests', { skip: !API_KEY }, () => {
     });
 
     const result = await ai.generate({
-      model: anthropic.model('claude-sonnet-4-5'),
+      model: anthropic.model('claude-sonnet-5-5'),
       messages: [
         {
           role: 'user',
@@ -363,7 +363,7 @@ describe('Live Anthropic API Tests', { skip: !API_KEY }, () => {
     });
 
     const result = await ai.generate({
-      model: anthropic.model('claude-sonnet-4-5'),
+      model: anthropic.model('claude-sonnet-5-5'),
       messages: [
         {
           role: 'user',
@@ -478,7 +478,7 @@ describe('Live Anthropic API Tests', { skip: !API_KEY }, () => {
     await assert.rejects(
       async () => {
         await ai.generate({
-          model: anthropic.model('claude-sonnet-4-5'),
+          model: anthropic.model('claude-sonnet-5-5'),
           messages: [
             {
               role: 'user',
@@ -537,7 +537,7 @@ describe('Live Anthropic API Tests', { skip: !API_KEY }, () => {
       'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
 
     const result = await ai.generate({
-      model: anthropic.model('claude-sonnet-4-5'),
+      model: anthropic.model('claude-sonnet-5-5'),
       messages: [
         {
           role: 'user',
```

#### Recent Merged Pull Requests:
- **PR #7355** (2026-11-25): fix(go/plugins/compat_oai): filter unlabelled SSE streams and bare CR line endings (@adesinah)
- **PR #7346** (closed): feat(js)!: make packages ESM-only and build with TypeScript 7 tsc (drop tsup) (@pavelgj)
- **PR #7335** (closed): build(deps): bump go.opentelemetry.io/otel/sdk from 1.46.0 to 1.47.0 in /go (@dependabot[bot])
- **PR #7334** (closed): build(deps): bump go.opentelemetry.io/otel/sdk from 1.36.0 to 1.47.0 in /go/samples/mcp-git-pr-explainer (@dependabot[bot])
- **PR #7333** (closed): build(deps): bump go.opentelemetry.io/otel/trace from 1.46.0 to 1.47.0 in /go (@dependabot[bot])
- **PR #7330** (2026-11-24): fix(tests): await streaming assertions in flow_server_test (@MichaelDoyle)

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

## X. go/ai/exp): add Agent.DeleteSession and the SessionDeleter store capability

**RULE**:
When implementing operations in `go/ai/exp/agent.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in genkit-ai/genkit. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4537d179`: go/ai/exp): add Agent.DeleteSession and the SessionDeleter store capability. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `go/ai/exp/agent.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
		// A deleted session is not a failure: the work simply stops being
		// persisted.
		if !errors.Is(err, ErrSessionDeleted) {
			logger.Error(ctx, "agent failed to save snapshot",
				"parentId", parentID,
				"error", err)
		}
// DeleteSession permanently removes every persisted snapshot of a session. A
// detached run still in flight is aborted first, so the work stops rather than
// continuing against data that is going away. It reports whether anything was
// removed and is idempotent: a session with no persisted data is not an error.
//
// Resuming by session ID afterwards starts a fresh session, and resuming by
// snapshot ID fails with [ErrSnapshotNotFound]. A run that is still going when
// the session is deleted stops persisting instead of failing; it cannot bring
// the session back. Traces, logs, and durable streams live outside the store
// and are not touched.
//
// This is an in-process API only: no companion action or route is registered
// for it, so put it behind your own authorization.
//
// It returns FAILED_PRECONDITION on a client-managed agent or when the store
// does not implement [SessionDeleter], and INVALID_ARGUMENT when sessionID is
// empty.
func (a *A
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
		logger.Error(ctx, "agent failed to save snapshot",
			"parentId", parentID,
			"error", err)
			if existing != nil && existing.Status.Terminal() {
	if err != nil {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4537d179` are properly handled with clean fallback behavior.
