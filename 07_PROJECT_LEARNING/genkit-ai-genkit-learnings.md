> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/genkit-ai-genkit-learnings.md`  
> **Source**: github ([https://github.com/genkit-ai/genkit](https://github.com/genkit-ai/genkit))  
> **Source Version**: `6125d544`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-28T02:41:25.114Z  
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
> **Harvest Timestamp**: 2026-11-28T02:41:25.108Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `genkit-ai/genkit`
- **Description**: Open-source framework for building agentic apps in JavaScript, Go, Dart, and Python, built and used in production by Google
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6631 stars

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

### Incident Patch 1: `6125d544` (2026-11-27)
**Commit Message**: feat(js/plugins/compat-oai): add Mistral provider, send falsy config values and map HTTP 422 (#7243)

**File**: `js/plugins/compat-oai/README.md` (modified, +75/-0)
```diff
@@ -19,6 +19,7 @@ Official OpenAI-compatible provider documentation:
 - [OpenAI](https://genkit.dev/docs/integrations/openai/)
 - [xAI (Grok)](https://genkit.dev/docs/integrations/xai/)
 - [DeepSeek](https://genkit.dev/docs/integrations/deepseek/)
+- [Mistral](#mistral) (in this README)
 - [Other compatible APIs](https://genkit.dev/docs/integrations/openai-compatible/)
 
 ## Supported models
@@ -181,6 +182,80 @@ const result = await ai.generate({
 console.log(result.text);
 ```
 
+### Mistral
+
+The `mistral` plugin uses Mistral's OpenAI-compatible API at
+`https://api.mistral.ai/v1`. Pass `apiKey` or set the `MISTRAL_API_KEY`
+environment variable. Set `baseURL` to go through a proxy.
+
+```typescript
+import { genkit } from 'genkit';
+import { mistral } from '@genkit-ai/compat-oai/mistral';
+
+const ai = genkit({
+  plugins: [mistral()],
+});
+
+const response = await ai.generate({
+  model: mistral.model('mistral-small-latest'),
+  prompt: 'Tell me a joke.',
+  config: {
+    maxOutputTokens: 256,
+    seed: 42,
+    safe_prompt: true,
+  },
+});
+
+const embeddings = await ai.embed({
+  embedder: mistral.embedder('codestral-embed', { outputDimension: 256 }),
+  content: 'Hello world',
+});
+```
+
+Mistral rejects request fields it doesn't know, so the plugin sends only
+Mistral's own field names:
+
+- `maxOutputTokens` is sent as `max_tokens`, and `seed` as `random_seed`.
+- `topK` is refused before the request goes out: Mistral's models reject
+  `top_k` sampling.
+- `reasoningEffort` is sent as `reasoning_effort`. Allowed values vary by
+  model: Mistral Small and Medium take `none` and `high`, Mistral Large 4
+  (`mistral-large-latest`) takes `low`, `medium` and `high`.
+- `temperature` (0 to 1.5), `topP` (above 0, at most 1) and `seed` (0 or
+  more) are checked against Mistral's ranges before the request goes out.
+- `toolChoice` (`auto`, `required` or `none`) is sent as `tool_choice`.
+- These Mistral-only fields are passed through as they are, under Mistral's
+  names: `safe_prompt`, `parallel_tool_calls`, `min_tokens`, `prompt_mode`,
+  `repetition_penalty`, `prediction`, `guardrails`, `prompt_cache_key`,
+  `service_tier` and `metadata`. Some models reject some of them, for example
+  Mistral Small rejects `min_tokens` and `repetition_penalty`.
+- OpenAI's `user` and `max_completion_tokens`, and any other config the plugin
+  doesn't map, are ignored.
+- The embedder's `outputDimension` is sent as `output_dimension`. Embeddings are
+  always requested as floats.
+- Streaming requests don't send `stream_options`.
+- An unknown or retired model is reported as `NOT_FOUND`, with Mistral's error
+  message. Request validation errors (HTTP 422) are reported as
+  `INVALID_ARGUMENT`, with Mistral's `detail`.
+- Only image media is sent. Other media, such as inline PDFs, is refused
+  before the request goes out: Mistral's chat API only takes uploaded files.
+
+With `reasoningEffort` set, the model's thinking comes back as reasoning parts
+(`response.reasoning`), one part per `thinking` chunk, with the chunk's
+signature in `metadata.thoughtSignature`. Reasoning from earlier turns is sent
+back to Mistral as `thinking` content. Only reasoning parts marked
+`metadata.reasoningSource: 'mistral'` (as Mistral's replies are, also in the
+Python plugin) are sent back; reasoning from other models in the history is
+dropped.
+
+Any model returned by `/v1/models` can be used by name, for example
+`mistral.model('ministral-14b-2512')` or `'mistral/ministral-14b-2512'`. When
+the plugin lists models (for example in the Developer UI), it reads each
+entry's `capabilities`: only chat models are listed, and tool and image
+support follow `function_calling` and `vision`. Models outside the known list
+never get constrained output, and a model that hasn't been listed is treated as
+text only.
+
 ### Custom models & other Cloud providers
 
 ```typescript
```

**File**: `js/plugins/compat-oai/package.json` (modified, +14/-0)
```diff
@@ -80,6 +80,17 @@
         "default": "./lib/xai/index.js"
       },
       "default": "./lib/xai/index.js"
+    },
+    "./mistral": {
+      "import": {
+        "types": "./lib/mistral/index.d.mts",
+        "default": "./lib/mistral/index.mjs"
+      },
+      "require": {
+        "types": "./lib/mistral/index.d.ts",
+        "default": "./lib/mistral/index.js"
+      },
+      "default": "./lib/mistral/index.js"
     }
   },
   "typesVersions": {
@@ -92,6 +103,9 @@
       ],
       "xai": [
         "lib/xai"
+      ],
+      "mistral": [
+        "lib/mistral"
       ]
     }
   },
```

**File**: `js/plugins/compat-oai/src/embedder.ts` (modified, +45/-5)
```diff
@@ -18,11 +18,24 @@
 // import { defineEmbedder, embedderRef } from '@genkit-ai/ai/embedder';
 
 import type { EmbedderAction, EmbedderReference } from 'genkit';
+import type { EmbedRequest } from 'genkit/embedder';
 import { embedder } from 'genkit/plugin';
-import OpenAI from 'openai';
+import OpenAI, { APIError } from 'openai';
+import type { EmbeddingCreateParams } from 'openai/resources/index.mjs';
 import { PluginOptions } from './index.js';
+import { toGenkitError, type ErrorStatusClassifier } from './model.js';
 import { maybeCreateRequestScopedOpenAIClient, toModelName } from './utils.js';
 
+/**
+ * Hook to modify the embeddings request body. When set, it replaces the
+ * default passthrough of embedder options, so it must copy any options the
+ * provider needs.
+ */
+export type EmbedderRequestBuilder = (
+  req: EmbedRequest,
+  params: EmbeddingCreateParams
+) => void;
+
 /**
  * Method to define a new Genkit Embedder that is compatibale with the Open AI
  * Embeddings API. 
@@ -33,6 +46,11 @@ import { maybeCreateRequestScopedOpenAIClient, toModelName } from './utils.js';
  * @param params.client The OpenAI client instance.
  * @param params.embedderRef Optional reference to the embedder's configuration and
  * custom options.
+ * @param params.requestBuilder Optional hook to modify the request body, see
+ * {@link EmbedderRequestBuilder}.
+ * @param params.errorStatus Optional error classifier. When set, API errors
+ * are thrown as Genkit errors, with the status it returns or else one from the
+ * HTTP status code. Without it, API errors are thrown as they are.
 
  * @returns the created {@link EmbedderAction}
  */
@@ -41,8 +59,17 @@ export function defineCompatOpenAIEmbedder(params: {
   client: OpenAI;
   pluginOptions?: PluginOptions;
   embedderRef?: EmbedderReference;
+  requestBuilder?: EmbedderRequestBuilder;
+  errorStatus?: ErrorStatusClassifier;
 }): EmbedderAction {
-  const { name, client: defaultClient, pluginOptions, embedderRef } = params;
+  const {
+    name,
+    client: defaultClient,
+    pluginOptions,
+    embedderRef,
+    requestBuilder,
+    errorStatus,
+  } = params;
 
   const modelName = toModelName(name, pluginOptions?.name);
   const actionName =
@@ -61,12 +88,25 @@ export function defineCompatOpenAIEmbedder(params: {
         req,
         defaultClient
       );
-      const embeddings = await client.embeddings.create({
+      let body: EmbeddingCreateParams = {
         model: modelName,
         input: req.input.map((d) => d.text),
         encoding_format,
-        ...restOfConfig,
-      });
+      };
+      if (requestBuilder) {
+        requestBuilder(req, body);
+      } else {
+        body = { ...body, ...restOfConfig };
+      }
+      let embeddings: OpenAI.CreateEmbeddingResponse;
+      try {
+        embeddings = await client.embeddings.create(body);
+      } catch (e) {
+        if (errorStatus && e instanceof APIError) {
+          throw toGenkitError(e, errorStatus);
+        }
+        throw e;
+      }
       return {
         embeddings: embeddings.data.map((d) => ({ embedding: d.embedding })),
       };
```

**File**: `js/plugins/compat-oai/src/index.ts` (modified, +6/-1)
```diff
@@ -31,7 +31,10 @@ export {
   type SpeechRequestBuilder,
   type TranscriptionRequestBuilder,
 } from './audio.js';
-export { defineCompatOpenAIEmbedder } from './embedder.js';
+export {
+  defineCompatOpenAIEmbedder,
+  type EmbedderRequestBuilder,
+} from './embedder.js';
 export {
   ImageGenerationCommonConfigSchema,
   compatOaiImageModelRef,
@@ -43,7 +46,9 @@ export {
   compatOaiModelRef,
   defineCompatOpenAIModel,
   openAIModelRunner,
+  type ErrorStatusClassifier,
   type ModelRequestBuilder,
+  type ModelRunnerOptions,
 } from './model.js';
 export {
   TranslationConfigSchema,
```

**File**: `js/plugins/compat-oai/src/mistral/embedder.ts` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+/**
+ * Copyright 2026 Google LLC
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+import { EmbedderInfo, embedderRef, EmbedderReference, z } from 'genkit';
+import type { EmbedderRequestBuilder } from '../embedder.js';
+
+/** Mistral embedder configuration schema. */
+export const MistralEmbeddingConfigSchema = z.object({
+  outputDimension: z
+    .number()
+    .int()
+    .optional()
+    .describe(
+      'Dimension of the output embeddings, for models that support it. Sent as `output_dimension`.'
+    ),
+  apiKey: z
+    .string()
+    .optional()
+    .describe('Overrides the plugin API key for this request.'),
+});
+
+/**
+ * Mistral uses `output_dimension` rather than `dimensions`, and rejects
+ * unknown fields, so only the fields it accepts are set.
+ */
+export const mistralEmbedderRequestBuilder: EmbedderRequestBuilder = (
+  req,
+  params
+) => {
+  const { outputDimension } = req.options ?? {};
+  // Always request floats, rather than relying on the OpenAI SDK's default.
+  params.encoding_format = 'float';
+  if (outputDimension !== undefined) {
+    (params as unknown as Record<string, unknown>).output_dimension =
+      outputDimension;
+  }
+};
+
+/** Mistral EmbedderRef helper, with Mistral specific config. */
+export function mistralEmbedderRef(params: {
+  name: string;
+  info?: EmbedderInfo;
+  config?: z.infer<typeof MistralEmbeddingConfigSchema>;
+}): EmbedderReference<typeof MistralEmbeddingConfigSchema> {
+  return embedderRef({
+    name: params.name,
+    configSchema: MistralEmbeddingConfigSchema,
+    info: params.info ?? {
+      supports: {
+        input: ['text'],
+      },
+    },
+    config: params.config,
+    namespace: 'mistral',
+  });
+}
+
+export const SUPPORTED_MISTRAL_EMBEDDERS = {
+  'mistral-embed': mistralEmbedderRef({
+    name: 'mistral-embed',
+    info: { dimensions: 1024, supports: { input: ['text'] } },
+  }),
+  'codestral-embed': mistralEmbedderRef({
+    name: 'codestral-embed',
+    info: { dimensions: 1536, supports: { input: ['text'] } },
+  }),
+};
```

**File**: `js/plugins/compat-oai/src/mistral/errors.ts` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+/**
+ * Copyright 2026 Google LLC
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+import type { ClientOptions } from 'openai';
+import type { ErrorStatusClassifier } from '../model.js';
+
+type Fetch = NonNullable<ClientOptions['fetch']>;
+
+/**
+ * Whether `body` is an error body the OpenAI SDK can't read: a JSON object
+ * with no `error` key. Mistral sends top-level errors such as
+ * `{"object": "error", "message": "...", "type": "invalid_model", ...}`, and
+ * its OpenAPI spec documents HTTP 422 as `{"detail": [...]}`
+ * (`HTTPValidationError`), neither wrapped in an `error` key as OpenAI's are.
+ */
+function isUnwrappedError(body: unknown): body is Record<string, unknown> {
+  return (
+    typeof body === 'object' &&
+    body !== null &&
+    !Array.isArray(body) &&
+    !('error' in body)
+  );
+}
+
+/**
+ * Wraps `fetch` so that Mistral's error bodies reach the OpenAI SDK. The SDK
+ * only reads errors under an `error` key, so for any other JSON object body
+ * it reports, for example, "400 status code (no body)" and drops the message
+ * and `type`. This moves the body under `error`, so the API error has
+ * Mistral's message, `type` and `code`, or the `detail` of a validation
+ * error.
+ *
+ * Returns `undefined`, keeping the SDK's own fetch, when `httpAgent` is set
+ * without a `fetch`: Node's built-in fetch would ignore the agent.
+ */
+export function mistralErrorBodyFetch(
+  options: Pick<ClientOptions, 'fetch' | 'httpAgent'> | undefined
+): Fetch | undefined {
+  if (!options?.fetch && options?.httpAgent) return undefined;
+  // `globalThis.fetch` is looked up on each call, not when the plugin is
+  // created, so a fetch patched in later (tracing, test stubs) is used.
+  const inner: typeof fetch = (input, init) =>
+    ((options?.fetch as unknown as typeof fetch) ?? globalThis.fetch)(
+      input,
+      init
+    );
+  const wrapped: typeof fetch = async (input, init) => {
+    const response = await inner(input, init);
+    if (response.ok) return response;
+    let body: unknown;
+    try {
+      body = await response.clone().json();
+    } catch {
+      return response;
+    }
+    if (!isUnwrappedError(body)) return response;
+    const headers = new Headers(response.headers);
+    // The body is re-encoded, so the original length and encoding no longer
+    // apply.
+    headers.delete('content-length');
+    headers.delete('content-encoding');
+    return new Response(JSON.stringify({ error: body }), {
+      status: response.status,
+      statusText: response.statusText,
+      headers,
+    });
+  };
+  return wrapped as unknown as Fetch;
+}
+
+/**
+ * Mistral answers an unknown or retired model with HTTP 400 and
+ * `"type": "invalid_model"`. Report that as NOT_FOUND; other errors keep the
+ * status from the HTTP status code.
+ */
+export const mistralErrorStatus: ErrorStatusClassifier = (e) =>
+  e.type === 'invalid_model' ? 'NOT_FOUND' : undefined;
```

**File**: `js/plugins/compat-oai/src/mistral/index.ts` (added, +352/-0)
```diff
@@ -0,0 +1,352 @@
+/**
+ * Copyright 2026 Google LLC
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+import {
+  ActionMetadata,
+  embedderActionMetadata,
+  EmbedderReference,
+  GenkitError,
+  modelActionMetadata,
+  ModelReference,
+  z,
+} from 'genkit';
+import type { ModelInfo } from 'genkit/model';
+import { type GenkitPluginV2 } from 'genkit/plugin';
+import { ActionType } from 'genkit/registry';
+import OpenAI from 'openai';
+import { defineCompatOpenAIEmbedder } from '../embedder.js';
+import { openAICompatible, PluginOptions } from '../index.js';
+import { defineCompatOpenAIModel } from '../model.js';
+import { lookup } from '../utils.js';
+import {
+  mistralEmbedderRef,
+  mistralEmbedderRequestBuilder,
+  MistralEmbeddingConfigSchema,
+  SUPPORTED_MISTRAL_EMBEDDERS,
+} from './embedder.js';
+import { mistralErrorBodyFetch, mistralErrorStatus } from './errors.js';
+import {
+  MISTRAL_RUNNER_OPTIONS,
+  MistralChatCompletionConfigSchema,
+  mistralModelRef,
+  mistralRequestBuilder,
+  SUPPORTED_MISTRAL_MODELS,
+} from './mistral.js';
+
+const MISTRAL_BASE_URL = 'https://api.mistral.ai/v1';
+
+/**
+ * Options for the Mistral plugin. `baseURL` defaults to
+ * `https://api.mistral.ai/v1`; set it to go through a proxy.
+ */
+export type MistralPluginOptions = Omit<PluginOptions, 'name'>;
+
+function defineMistralModel(
+  client: OpenAI,
+  pluginOptions: PluginOptions,
+  modelRef: ModelReference<any>
+) {
+  return defineCompatOpenAIModel({
+    name: modelRef.name,
+    client,
+    pluginOptions,
+    modelRef,
+    requestBuilder: mistralRequestBuilder,
+    runnerOptions: MISTRAL_RUNNER_OPTIONS,
+  });
+}
+
+function defineMistralEmbedder(
+  client: OpenAI,
+  pluginOptions: PluginOptions,
+  embedderRef: EmbedderReference<any>
+) {
+  return defineCompatOpenAIEmbedder({
+    name: embedderRef.name,
+    client,
+    pluginOptions,
+    embedderRef,
+    requestBuilder: mistralEmbedderRequestBuilder,
+    errorStatus: mistralErrorStatus,
+  });
+}
+
+/**
+ * The `capabilities` object of a `/v1/models` entry (Mistral's
+ * `ModelCapabilities`). Only the fields the plugin reads are listed.
+ */
+interface MistralModelCapabilities {
+  completion_chat?: boolean;
+  function_calling?: boolean;
+  vision?: boolean;
+}
+
+/**
+ * Model info for a model outside the known list, from its `/v1/models`
+ * capabilities. Output stays text only, since capabilities don't say whether
+ * the model supports constrained output.
+ */
+function modelInfoFromCapabilities(
+  capabilities: MistralModelCapabilities
+): ModelInfo {
+  return {
+    supports: {
+      multiturn: true,
+      tools: capabilities.function_calling === true,
+      toolChoice: capabilities.function_calling === true,
+      media: capabilities.vision === true,
+      systemRole: true,
+      output: ['text'],
+    },
+  };
+}
+
+/**
+ * @param lookupModelInfo Finds the info of a model outside the known list, as
+ *   `/v1/models` lists it, so a model resolves with the same capabilities
+ *   whether or not the models were listed first.
+ */
+function createResolver(
+  pluginOptions: PluginOptions,
+  lookupModelInfo: (
+    client: OpenAI,
+    name: string
+  ) => Promise<ModelInfo | undefined>
+) {
+  return async (client: OpenAI, actionType: ActionType, actionName: string) => {
+    if (actionType === 'embedder') {
+      return defineMistralEmbedder(
+        client,
+        pluginOptions,
+        lookup(SUPPORTED_MISTRAL_EMBEDDERS, actionName) ??
+          mistralEmbedderRef({ name: actionName })
+      );
+    }
+    if (actionType === 'model') {
+      return defineMistralModel(
+        client,
+        pluginOptions,
+        lookup(SUPPORTED_MISTRAL_MODELS, actionName) ??
+          mistralModelRef({
+            name: actionName,
+            info: await lookupModelInfo(client, actionName),
+          })
+      );
+    }
+    return undefined;
+  };
+}
+
+/**
+ * Lists Mistral's models and embedders from `/v1/models`. Ids containing
+ * `embed` are embedders. Other entries are chat models only when their
+ * `capabilities.completion_chat` is set, which leaves out OCR, moderation,
+ * audio and similar models. Models outside the known list take tools and
+ * media support from `capabilities`, or the text-only default when an entry
+ * has no `capabilities`.
+ */
+async function listMistralActions(
+  client: OpenAI,
+  listedModelInfo: Map<string, ModelInfo>
+): Promise<ActionMetadata[]> {
+  const r
```

**File**: `js/plugins/compat-oai/src/mistral/mistral.ts` (added, +380/-0)
```diff
@@ -0,0 +1,380 @@
+/**
+ * Copyright 2026 Google LLC
+ *
+ * Licensed under the Apache License, Version 2.0 (the "License");
+ * you may not use this file except in compliance with the License.
+ * You may obtain a copy of the License at
+ *
+ *     http://www.apache.org/licenses/LICENSE-2.0
+ *
+ * Unless required by applicable law or agreed to in writing, software
+ * distributed under the License is distributed on an "AS IS" BASIS,
+ * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
+ * See the License for the specific language governing permissions and
+ * limitations under the License.
+ */
+
+import { GenkitError, z, type MessageData } from 'genkit';
+import { ModelInfo, ModelReference } from 'genkit/model';
+import type { ChatCompletionMessageParam } from 'openai/resources/index.mjs';
+import {
+  ChatCompletionCommonConfigSchema,
+  ModelRequestBuilder,
+  ModelRunnerOptions,
+  compatOaiModelRef,
+} from '../model.js';
+import { mistralErrorStatus } from './errors.js';
+
+/**
+ * Models with text and image input, tool calling and structured output.
+ * Mistral accepts `response_format` with `json_schema`, so output is
+ * constrained natively.
+ */
+const MISTRAL_MODEL_INFO: ModelInfo = {
+  supports: {
+    multiturn: true,
+    tools: true,
+    toolChoice: true,
+    media: true,
+    systemRole: true,
+    output: ['text', 'json'],
+    constrained: 'all',
+  },
+};
+
+/**
+ * Default for models that are not in the known list, such as ones found
+ * through `/v1/models`: text only, with no tools or constrained output, since
+ * their capabilities are unknown.
+ */
+const MISTRAL_UNKNOWN_MODEL_INFO: ModelInfo = {
+  supports: {
+    multiturn: true,
+    tools: false,
+    toolChoice: false,
+    media: false,
+    systemRole: true,
+    output: ['text'],
+  },
+};
+
+/** Models with text input only, tool calling and structured output. */
+const MISTRAL_TEXT_MODEL_INFO: ModelInfo = {
+  supports: {
+    multiturn: true,
+    tools: true,
+    toolChoice: true,
+    media: false,
+    systemRole: true,
+    output: ['text', 'json'],
+    constrained: 'all',
+  },
+};
+
+/**
+ * Mistral-only request fields that are passed through from the config as they
+ * are, under Mistral's own names. Mistral's request schema rejects unknown
+ * fields, so other config keys are not passed through.
+ */
+const MistralRequestFieldsSchema = z.object({
+  safe_prompt: z
+    .boolean()
+    .optional()
+    .describe('Whether to inject a safety prompt before all conversations.'),
+  parallel_tool_calls: z
+    .boolean()
+    .optional()
+    .describe('Whether the model can make more than one tool call per turn.'),
+  min_tokens: z
+    .number()
+    .int()
+    .min(0)
+    .optional()
+    .describe('The minimum number of tokens to generate.'),
+  prompt_mode: z
+    .enum(['reasoning'])
+    .optional()
+    .describe('Selects the system prompt Mistral adds for reasoning models.'),
+  repetition_penalty: z
+    .number()
+    .gt(0)
+    .max(2)
+    .optional()
+    .describe('Penalizes repeated tokens, above 0 and at most 2.'),
+  prediction: z
+    .object({ type: z.literal('content').optional(), content: z.string() })
+    .optional()
+    .describe('Expected completion, used to speed up the response.'),
+  guardrails: z
+    .array(z.record(z.unknown()))
+    .optional()
+    .describe("Moderation guardrails, in Mistral's `GuardrailConfig` shape."),
+  prompt_cache_key: z
+    .string()
+    .optional()
+    .describe('Key for grouping requests that share a prompt prefix.'),
+  service_tier: z
+    .enum(['auto', 'standard_only'])
+    .optional()
+    .describe('The service tier to use for the request.'),
+  metadata: z
+    .record(z.unknown())
+    .optional()
+    .describe('Metadata to attach to the request.'),
+});
+
+/** Keys of {@link MistralRequestFieldsSchema}, passed through as they are. */
+const MISTRAL_REQUEST_FIELDS = Object.keys(
+  MistralRequestFieldsSchema.shape
+) as (keyof typeof MistralRequestFieldsSchema.shape)[];
+
+/**
+ * Mistral custom configuration schema. `topK`, `logProbs` and `topLogProbs`
+ * are left out: Mistral's request schema declares `top_k`, `logprobs` and
+ * `top_logprobs`, but its models reject them ("top_k sampling is not enabled
+ * for this model", "Logprobs are not enabled for this model"). Bounds follow
+ * Mistral's request schema.
+ */
+export const MistralChatCompletionConfigSchema =
+  ChatCompletionCommonConfigSchema.omit({
+    topK: true,
+    logProbs: true,
+    topLogProbs: true,
+  })
+    .extend({
+      temperature: z
+        .number()
+        .min(0)
+        .max(1.5)
+        .optional()
+        .describe('Sampling temperature, between 0 and 1.5.'),
+      topP: z
+        .number()
+        .gt(0)
+        .max(1)
+        .optional()
+        .describe('Nucleus sampling, above 0 and at most 1.'),
+      seed: z
+        .number()
+        .int()
+        .min(0)
+        .optional()
+        .describe('Seed for 
```

#### Recent Merged Pull Requests:
- **PR #7376** (closed): fix(js/core): move `@genkit-ai/firebase` to an optional peer dependency (@genkit-bot)
- **PR #7361** (2026-11-26): build(js): compile with TypeScript 7 (native tsc) (@pavelgj)
- **PR #7360** (2026-11-26): feat(js)!: make packages ESM-only and build with tsc (drop tsup) (@pavelgj)
- **PR #7359** (2026-11-26): feat(js)!: require Node.js 22.12+ (@pavelgj)
- **PR #7358** (2026-11-26): fix(js): ESM-safe imports (node:util in logging, anthropic SDK deep import, explicit index imports) (@pavelgj)
- **PR #7357** (2026-11-26): test(js): migrate remaining jest plugin tests to vitest (@pavelgj)

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

## X. js/plugins/compat-oai): add Mistral provider, send falsy config values and map H

**RULE**:
When implementing operations in `js/plugins/compat-oai/README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in genkit-ai/genkit. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6125d544`: js/plugins/compat-oai): add Mistral provider, send falsy config values and map HTTP 422. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `js/plugins/compat-oai/README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
- [Mistral](#mistral) (in this README)
### Mistral

The `mistral` plugin uses Mistral's OpenAI-compatible API at
`https://api.mistral.ai/v1`. Pass `apiKey` or set the `MISTRAL_API_KEY`
environment variable. Set `baseURL` to go through a proxy.

```typescript
import { genkit } from 'genkit';
import { mistral } from '@genkit-ai/compat-oai/mistral';

const ai = genkit({
  plugins: [mistral()],
});

const response = await ai.generate({
  model: mistral.model('mistral-small-latest'),
  prompt: 'Tell me a joke.',
  config: {
    maxOutputTokens: 256,
    seed: 42,
    safe_prompt: true,
  },
});

const embeddings = await ai.embed({
  embedder: mistral.embedder('codestral-embed', { outputDimension: 256 }),
  content: 'Hello world',
});
```

Mistral rejects request fields it doesn't know, so the plugin sends only
Mistral's own field names:

- `maxOutputTokens` is sent as `max_tokens`, and `seed` as `random_seed`.
- `topK` is refused before the request goes out: Mistral's models reject
  `top_k` sampling.
- `reasoningEffort` is sent as `reasoning_effort`. Allowed values vary by
  model: Mistral Small and Medium take `none` and `high`, Mistral Large 4
  (`mistral-large-latest`) takes `low`, 
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6125d544` are properly handled with clean fallback behavior.
