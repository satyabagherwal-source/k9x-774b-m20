# Forensic Learning Record (Deep Inspection): genkit-ai/genkit

> **Canonical Artifact**: `07_PROJECT_LEARNING/genkit-ai-genkit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/genkit-ai/genkit](https://github.com/genkit-ai/genkit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:51:46.006Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `genkit-ai/genkit`
- **Description**: Open-source framework for building agentic apps in JavaScript, Go, Dart, and Python, built and used in production by Google
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 6472 stars

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

  async getManager(projectRoot: string) {
    if (this.manager && this.currentProjectRoot === projectRoot) {
      return this.manager;
    }
    if (this.manager) {
      await this.manager.stop();
    }
    this.manager = await startManager({
      projectRoot,
      manageHealth: true,
    });
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
  ProcessManager,
  RuntimeEvent,
  RuntimeManager,
  type GenkitToolsError,
} from '@genkit-ai/tools-common/manager';
import { logger } from '@genkit-ai/tools-common/utils';
import getPort, { makeRange } from 'get-port';

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
 * Starts the runtime manager and its dependencies.
 */
export async function startManager(options: {
  projectRoot: string;
  manageHealth?: boolean;
  corsOrigin?: string;
  experimentalReflectionV2?: boolean;
  reflectionV2Port?: number;
  telemetryServerUrl?: string;
}): Promise<BaseRuntimeManager> {
  const telemetryServerUrl =
    options.telemetryServerUrl ?? (await resolveTelemetryServer(options));
  const manager = RuntimeManager.create({
    telemetryServerUrl,
    manageHealth: options.manageHealth,
    projectRoot: options.projectRoot,
    experimentalReflectionV2: options.experimentalReflectionV2,
    reflectionV2Port: options.reflectionV2Port,
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
  telemetryServerUrl?: string;
}

export async function getDevEnvVars(
  projectRoot: string,
  options?: DevProcessManagerOptions
): Promise<{
  envVars: Record<string, string>;
  reflectionV2Port?: number;
  telemetryServerUrl: string;
}> {
  const telemetryServerUrl = await resolveTelemetryServer({
    projectRoot,
    corsOrigin: options?.corsOrigin,
  });
  const disableRealtimeTelemetry = options?.disableRealtimeTelemetry ?? false;
  const experimentalReflectionV2 = options?.experimentalReflectionV2 ?? false;

  let reflectionV2Port: number | undefined;
  const envVars: Record<string, string> = {
    GENKIT_TELEMETRY_SERVER: telemetryServerUrl,
    GENKIT_ENV: 'dev',
  };

  if (experimentalReflectionV2) {
    reflectionV2Port = await getPort({ port: makeRange(3200, 3400) });
    envVars.GENKIT_REFLECTION_V2_SERVER = `ws://localhost:${reflectionV2Port}`;
  }

  if (!disableRealtimeTelemetry) {
    envVars.GENKIT_ENABLE_REALTIME_TELEMETRY = 'true';
  }

  return { envVars, reflectionV2Port, telemetryServerUrl };
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

  const processManager = new ProcessManager(command, args, envVars);
  const manager = await RuntimeManager.create({
    telemetryServerUrl,
    manageHealth: true,
    projectRoot,
    processManager,
    disableRealtimeTelemetry,
    experimentalReflectionV2,
    reflectionV2Port,
  });
  const processPromise = processManager.start({ ...options });

  if (options?.healthCheck) {
    await waitForRuntime(manager, processPromise, options?.timeout);
  }

  return { manager, processPromise };
}

/**
 * Waits for a new runtime to register itself.
 * Rejects if the process exits or if the timeout is reached.
 */
export async function waitForRuntime(
  manager: BaseRuntimeManager,
  processPromise: Promise<void>,
  timeoutMs: number = 30000
): Promise<void> {
  let unsubscribe: (() => void) | undefined;
  let timeoutId: NodeJS.Timeout | undefined;

  if (manager.listRuntimes().length > 0) {
    return;
  }

  try {
    const runtimeAddedPromise = new Promise<void>((resolve) => {
      unsubscribe = manager.onRuntimeEvent((event) => {
        // Just listen for a new runtime, not for a specific ID.
        if (event === RuntimeEvent.ADD) {
          resolve();
        }
      });
      if (manager.listRuntimes().length > 0) {
        resolve();
      }
    });

    const timeoutPromise = new Promise<void>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error('Timeout waiting for runtime to be ready')),
        timeoutMs
      );
    });

    const processExitedPromise = processPromise.then(
      () =>
        Promise.reject(new Error('Process exited before runtime was ready')),
      (err) => Promise.reject(err)
    );

    await Promise.race([
      runtimeAddedPromise,
      timeoutPromise,
      processExitedPromise,
    ]);
  } finally {
    if (unsubscribe) unsubscribe();
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export interface WaitForActionKeysOptions {
  /** How often to poll the runtime for its action list. */
  pollIntervalMs?: number;
  /**
   * If the set of registered actions stops changing for this long and the
   * target action(s) still haven't appeared, stop waiting. This keeps a
   * mistyped action name from blocking for the full timeout.
   */
  stableForMs?: number;
  /** Hard upper bound as a safety net. */
  timeoutMs?: number;
}

/**
 * Waits until all of the given action keys are registered with the runtime.
 *
 * Ephemeral runtimes (used by the `-- <cmd>` commands) register their actions
 * asynchronously after startup. Some SDKs (notably Go) register the runtime
 * with the CLI during initialization but define their actions slightly later.
 * If we dispatch a runAction before the target action is registered, the
 * runtime returns an "action not found" error. Polling until the actions
 * appear closes that race.
 *
 * To avoid making a mistyped action name block for the full timeout, we watch
 * the number of registered actions: while it keeps changing, registration is
 * still in progress; once it settles (stops changing for `stableForMs`) without
 * the target appearing, we stop waiting and let the subsequent runAction
 * surface the real "not found" error.
 */
export async function waitForActionKeys(
  manager: BaseRuntimeManager,
  keys: string[],
  {
    pollIntervalMs = 500,
    stableForMs = 5000,
    timeoutMs = 30000,
  }: WaitForActionKeysOptions = {}
): Promise<void> {
  const requiredKeys = keys.filter((k) => !!k);
  if (requiredKeys.length === 0) return;

  const deadline = Date.now() + timeoutMs;

  let hasSeenRuntime = manager.listRuntimes().length > 0;
  let lastCount = -1;
  let lastChange = Date.now();

  while (true) {
    // If the runtime process crashed or exited after registering but before
    // registering its actions, stop waiting instead of hanging. A subsequent
    // runAction will surface the real error.
    if (manager.listRuntimes().length > 0) {
      hasSeenRuntime = true;
    } else if (hasSeenRuntime) {
      logger.debug(
        'Runtime disconnected while waiting for actions. Stopping wait.'
      );
      return;
    }

    try {
      const actions = await manager.listActions();
      const registered = Object.keys(actions);
      const missing = requiredKeys.filter((k) => !registered.includes(k));
      if (missing.length === 0) return;

      if (registered.length !== lastCount) {
        // Still registering actions; reset the stability window.
        lastCount = registered.length;
        lastChange = Date.now();
      } else if (Date.now() - lastChange >= stableForMs) {
        logger.debug(
          `Action list stabilized without registering: ${missing.join(
            ', '
          )}. Stopping wait.`
        );
        return;
      }
    } catch (e) {
      // The actions endpoint may not be ready yet; keep polling.
      logger.debug(`Polling for actions failed, will retry: ${e}`);
    }

    if (Date.now() >= deadline) {
      logger.debug('Timed out waiting for actions to register. Proceeding.');
      return;
    }
    await new Promise((r) => setTimeout(r, pollIntervalMs));
  }
}

/**
 * Runs the given function with a runtime manager.
 */
export interface RunWithManagerOptions {
  /*
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

### Core Architecture Module: `genkit-tools/common/src/utils/errors.ts`
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

// Connection error codes for different runtimes
const CONNECTION_ERROR_CODES = {
  NODE_ECONNREFUSED: 'ECONNREFUSED',
  BUN_CONNECTION_REFUSED: 'ConnectionRefused',
  ECONNRESET: 'ECONNRESET',
} as const;

const CONNECTION_ERROR_PATTERNS = [
  'ECONNREFUSED',
  'Connection refused',
  'ConnectionRefused',
  'connect ECONNREFUSED',
] as const;

type ErrorWithCode = {
  code?: string;
  message?: string;
  cause?: ErrorWithCode;
};

/**
 * Checks if an error is a connection refused error across Node.js and Bun runtimes.
 *
 * Node.js structure: error.cause.code === 'ECONNREFUSED'
 * Bun structure: error.code === 'ConnectionRefused' or error.code === 'ECONNRESET'
 */
export function isConnectionRefusedError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  const errorCode = getErrorCode(error);
  if (errorCode && isConnectionErrorCode(errorCode)) {
    return true;
  }

  // Fallback: check error message
  if (isErrorWithMessage(error)) {
    return CONNECTION_ERROR_PATTERNS.some((pattern) =>
      error.message.includes(pattern)
    );
  }

  return false;
}

/**
 * Helper function to check if a code is a connection error code.
 */
function isConnectionErrorCode(code: string): boolean {
  return Object.values(CONNECTION_ERROR_CODES).includes(
    code as (typeof CONNECTION_ERROR_CODES)[keyof typeof CONNECTION_ERROR_CODES]
  );
}

/**
 * Type guard to check if an error has a message property.
 */
function isErrorWithMessage(error: unknown): error is { message: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as any).message === 'string'
  );
}

/**
 * Extracts error code from an object, handling nested structures.
 */
function extractErrorCode(obj: unknown): string | undefined {
  if (
    typeof obj === 'object' &&
    obj !== null &&
    'code' in obj &&
    typeof (obj as ErrorWithCode).code === 'string'
  ) {
    return (obj as ErrorWithCode).code;
  }
  return undefined;
}

/**
 * Gets the error code from an error object, handling both Node.js and Bun styles.
 */
export function getErrorCode(error: unknown): string | undefined {
  if (!error) {
    return undefined;
  }

  // Direct error code
  const directCode = extractErrorCode(error);
  if (directCode) {
    return directCode;
  }

  // Node.js style with cause
  if (typeof error === 'object' && error !== null && 'cause' in error) {
    const causeCode = extractErrorCode((error as ErrorWithCode).cause);
    if (causeCode) {
      return causeCode;
    }
  }

  return undefined;
}

/**
 * Extracts error message from various error formats.
 */
function extractErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }

  if (isErrorWithMessage(error)) {
    return error.message;
  }

  return undefined;
}

/**
 * Safely extracts error details for logging.
 */
export function getErrorDetails(error: unknown): string {
  if (error === null || error === undefined) {
    return 'Unknown error';
  }

  const code = getErrorCode(error);
  const message = extractErrorMessage(error);

  if (message) {
    return code ? `${message} (${code})` : message;
  }

  return String(error);
}

```

### Core Architecture Module: `genkit-tools/common/src/utils/eval.ts`
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

import { confirm } from '@inquirer/prompts';
import { randomUUID } from 'crypto';
import { createReadStream } from 'fs';
import { readFile } from 'fs/promises';
import { createInterface } from 'readline';
import type { BaseRuntimeManager } from '../manager';
import {
  findToolsConfig,
  isEvalField,
  type EvalField,
  type EvaluationExtractor,
  type InputStepSelector,
  type OutputStepSelector,
  type StepSelector,
} from '../plugin';
import {
  DatasetSchema,
  EvalInputDatasetSchema,
  EvaluationDatasetSchema,
  EvaluationSampleSchema,
  GenerateRequestSchema,
  InferenceDatasetSchema,
  InferenceSampleSchema,
  type Action,
  type Dataset,
  type DocumentData,
  type EvalInputDataset,
  type EvaluationSample,
  type GenerateRequest,
  type InferenceSample,
  type MessageData,
  type NestedSpanData,
  type RetrieverResponse,
  type TraceData,
} from '../types';
import { logger } from './logger';
import { stackTraceSpans } from './trace';

export type EvalExtractorFn = (t: TraceData) => any;

export const EVALUATOR_ACTION_PREFIX = '/evaluator';

// Update js/ai/src/evaluators.ts if you change this value
export const EVALUATOR_METADATA_KEY_DISPLAY_NAME = 'evaluatorDisplayName';
export const EVALUATOR_METADATA_KEY_DEFINITION = 'evaluatorDefinition';
export const EVALUATOR_METADATA_KEY_IS_BILLED = 'evaluatorIsBilled';

export function evaluatorName(action: Action) {
  return `${EVALUATOR_ACTION_PREFIX}/${action.name}`;
}

export function isEvaluator(key: string) {
  return key.startsWith(EVALUATOR_ACTION_PREFIX);
}

export async function confirmLlmUse(
  evaluatorActions: Action[]
): Promise<boolean> {
  const isBilled = evaluatorActions.some(
    (action) =>
      action.metadata && action.metadata[EVALUATOR_METADATA_KEY_IS_BILLED]
  );

  if (!isBilled) {
    return true;
  }

  const confirmed = await confirm({
    message:
      'For each example, the evaluation makes calls to APIs that may result in being charged. Do you wish to proceed?',
    default: false,
  });

  return confirmed;
}

function getRootSpan(trace: TraceData): NestedSpanData | undefined {
  return stackTraceSpans(trace);
}

function safeParse(value?: string) {
  if (value) {
    try {
      return JSON.parse(value);
    } catch (e) {
      return '';
    }
  }
  return '';
}

const DEFAULT_INPUT_EXTRACTOR: EvalExtractorFn = (trace: TraceData) => {
  const rootSpan = getRootSpan(trace);
  return safeParse(rootSpan?.attributes['genkit:input'] as string);
};
const DEFAULT_OUTPUT_EXTRACTOR: EvalExtractorFn = (trace: TraceData) => {
  const rootSpan = getRootSpan(trace);
  return safeParse(rootSpan?.attributes['genkit:output'] as string);
};
const DEFAULT_CONTEXT_EXTRACTOR: EvalExtractorFn = (trace: TraceData) => {
  return Object.values(trace.spans)
    .filter((s) => s.attributes['genkit:metadata:subtype'] === 'retriever')
    .flatMap((s) => {
      const output: RetrieverResponse = safeParse(
        s.attributes['genkit:output'] as string
      );
      if (!output) {
        return [];
      }
      return output.documents.flatMap((d: DocumentData) =>
        d.content.map((c) => c.text).filter((text): text is string => !!text)
      );
    });
};

const DEFAULT_FLOW_EXTRACTORS: Record<EvalField, EvalExtractorFn> = {
  input: DEFAULT_INPUT_EXTRACTOR,
  output: DEFAULT_OUTPUT_EXTRACTOR,
  context: DEFAULT_CONTEXT_EXTRACTOR,
};

const DEFAULT_MODEL_EXTRACTORS: Record<EvalField, EvalExtractorFn> = {
  input: DEFAULT_INPUT_EXTRACTOR,
  output: DEFAULT_OUTPUT_EXTRACTOR,
  context: () => [],
};

function getStepAttribute(
  trace: TraceData,
  stepName: string,
  attributeName?: string
) {
  // Default to output
  const attr = attributeName ?? 'genkit:output';
  const values = Object.values(trace.spans)
    .filter((step) => step.displayName === stepName)
    .flatMap((step) => {
      return safeParse(step.attributes[attr] as string);
    });
  if (values.length === 0) {
    return '';
  }
  if (values.length === 1) {
    return values[0];
  }
  // Return array if multiple steps have the same name
  return values;
}

function getExtractorFromStepName(stepName: string): EvalExtractorFn {
  return (trace: TraceData) => {
    return getStepAttribute(trace, stepName);
  };
}

function getExtractorFromStepSelector(
  stepSelector: StepSelector
): EvalExtractorFn {
  return (trace: TraceData) => {
    let stepName: string | undefined = undefined;
    let selectedAttribute = 'genkit:output'; // default

    if (Object.hasOwn(stepSelector, 'inputOf')) {
      stepName = (stepSelector as InputStepSelector).inputOf;
      selectedAttribute = 'genkit:input';
    } else {
      stepName = (stepSelector as OutputStepSelector).outputOf;
      selectedAttribute = 'genkit:output';
    }
    if (!stepName) {
      return '';
    } else {
      return getStepAttribute(trace, stepName, selectedAttribute);
    }
  };
}

function getExtractorMap(extractor: EvaluationExtractor) {
  const extractorMap: Record<EvalField, EvalExtractorFn> = {} as Record<
    EvalField,
    EvalExtractorFn
  >;
  for (const [key, value] of Object.entries(extractor)) {
    if (isEvalField(key)) {
      if (typeof value === 'string') {
        extractorMap[key] = getExtractorFromStepName(value);
      } else if (typeof value === 'object') {
        extractorMap[key] = getExtractorFromStepSelector(value);
      } else if (typeof value === 'function') {
        extractorMap[key] = value;
      }
    }
  }
  return extractorMap;
}

export async function getEvalExtractors(
  actionRef: string
): Promise<Record<string, EvalExtractorFn>> {
  if (actionRef.startsWith('/model')) {
    // Always use defaults for model extraction.
    logger.debug(
      'getEvalExtractors - modelRef provided, using default extractors'
    );
    return Promise.resolve(DEFAULT_MODEL_EXTRACTORS);
  }
  const config = await findToolsConfig();
  const extractors = config?.evaluators
    ?.filter((e) => e.actionRef === actionRef)
    .map((e) => e.extractors);
  if (!extractors) {
    return Promise.resolve(DEFAULT_FLOW_EXTRACTORS);
  }
  let composedExtractors = DEFAULT_FLOW_EXTRACTORS;
  for (const extractor of extractors) {
    const extractorFunction = getExtractorMap(extractor);
    composedExtractors = { ...composedExtractors, ...extractorFunction };
  }
  return Promise.resolve(composedExtractors);
}

/**Global function to generate testCaseId */
export function generateTestCaseId() {
  return randomUUID();
}

/** Load a {@link Dataset} file. Supports JSON / JSONL */
export async function loadInferenceDatasetFile(
  fileName: string
): Promise<Dataset> {
  const isJsonl = fileName.endsWith('.jsonl');

  if (isJsonl) {
    return await readJsonlForInference(fileName);
  } else {
    const parsedData = JSON.parse(await readFile(fileName, 'utf8'));
    let dataset = InferenceDatasetSchema.parse(parsedData);
    dataset = dataset.map((sample: InferenceSample) => ({
      ...sample,
      testCaseId: sample.testCaseId ?? generateTestCaseId(),
    }));
    return DatasetSchema.parse(dataset);
  }
}

/** Load a {@link EvalInputDataset} file. Supports JSON / JSONL */
export async function loadEvaluationDatasetFile(
  fileName: string
): Promise<EvalInputDataset> {
  const isJsonl = fileName.endsWith('.jsonl');

  if (isJsonl) {
    return await readJsonlForEvaluation(fileName);
  } else {
    const parsedData = JSON.parse(await readFile(fileName, 'utf8'));
    let evaluationInput = EvaluationDatasetSchema.parse(parsedData);
    evaluationInput = evaluationInput.map((evalSample: EvaluationSample) => ({
      ...evalSample,
      testCaseId: evalSample.testCaseId ?? generateTestCaseId(),
      traceIds: evalSample.traceIds ?? [],
    }));
    return EvalInputDatasetSchema.parse(evaluationInput);
  }
}

async function readJsonlForInference(fileName: string): Promise<Dataset> {
  const lines = await readLines(fileName);
  const samples: Dataset = [];
  for (const line of lines) {
    const parsedSample = InferenceSampleSchema.parse(JSON.parse(line));
    samples.push({
      ...parsedSample,
      testCaseId: parsedSample.testCaseId ?? generateTestCaseId(),
    });
  }
  return samples;
}

async function readJsonlForEvaluation(
  fileName: string
): Promise<EvalInputDataset> {
  const lines = await readLines(fileName);
  const inputs: EvalInputDataset = [];
  for (const line of lines) {
    const parsedSample = EvaluationSampleSchema.parse(JSON.parse(line));
    inputs.push({
      ...parsedSample,
      testCaseId: parsedSample.testCaseId ?? generateTestCaseId(),
      traceIds: parsedSample.traceIds ?? [],
    });
  }
  return inputs;
}

async function readLines(fileName: string): Promise<string[]> {
  const lines: string[] = [];
  const fileStream = createReadStream(fileName);
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Number.POSITIVE_INFINITY,
  });

  for await (const line of rl) {
    lines.push(line);
  }
  return lines;
}

export async function hasAction(params: {
  manager: BaseRuntimeManager;
  actionRef: string;
}): Promise<boolean> {
  const { manager, actionRef } = { ...params };
  const actionsRecord = await manager.listActions();

  return actionsRecord.hasOwnProperty(actionRef);
}

export async function getAction(params: {
  manager: BaseRuntimeManager;
  actionRef: string;
}): Promise<Action | undefined> {
  const { manager, actionRef } = { ...params };
  const allActions = await manager.listA
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6392** (2026-09-23): **[Go] Flaky TestAgentConformance: aborted snapshot reaches status 'completed' instead of 'aborted'**
  *Symptoms*: **Describe the bug**  `TestAgentConformance/an_aborted_snapshot_keeps_the_finished_turns_and_drops_the_one_in_flight` in `go/ai/exp` fails intermittently on CI. An aborted snapshot reaches a terminal status of `completed` instead of `aborted`:  ``` === RUN   TestAgentConformance/an_aborted_snapshot_keeps_the_finished_turns_and_drops_the_one_in_flight     agents_conformance_test.go:449: step[2] (waitUntilCompleted): snapshot.status: want aborted, got completed     agents_conformance_test.go:449: step[2] (waitUntilCompleted): snapshot.finishReason: want aborted, got <nil> --- FAIL: TestAgentConformance (10.58s) FAIL	github.com/firebase/genkit/go/ai/exp	18.582s ```  Observed on `tests (1.26.x)`, while `tests (1.25.x)` passed on the identical commit: https://github.com/genkit-ai/genkit/actions/runs/35612375025/job/106391562891  Surfaced on an unrelated PR (#6339, an MCP transport fix). Nothing on that branch touches or is imported by `go/ai/exp`.  **To Reproduce**  The case is `an aborted snapshot keeps the finished turns and drops the one in flight` in `tests/specs/agent.yaml:1768`, run by `go/ai/exp/agents_conformance_test.go`:  ``` go test -run 'TestAgentConformance/an_aborted_snapshot_keeps_the_finished_turns' ./ai/exp/ ```  It does not reproduce reliably — 20/20 passes locally on go1.25.0 darwin/arm64. The observed failure is on linux/amd64 go1.26.8 (CI).  **Expected behavior**  Aborting a snapshot whose status is still `pending` should leave it terminal as `aborted` with `f

- **Issue #6329** (2026-09-21): **[Go] `StreamableHTTPConfig.HTTPClient` is silently ignored by the Streamable HTTP transport**
  *Symptoms*: # Summary `StreamableHTTPConfig.HTTPClient` (`go/plugins/mcp/client.go`) is a dead field: Genkit pins `mcp-go v0.29.0`, whose Streamable HTTP transport exposes no option to inject a custom `http.Client`, so the field is silently ignored.  The SSE transport already honors its `HTTPClient` field via `WithHTTPClient`; Streamable HTTP does not, even though it's the newer, recommended transport.  **Why a custom `http.Client` matters**  A custom client is the only way to set the transport-level behavior that a remote MCP server often requires:  - **mTLS / client certificates** (`TLSClientConfig.Certificates`) - **Private CA / custom trust** (`TLSClientConfig.RootCAs`) - **Corporate proxies** (`http.Transport.Proxy`) - **Connection pooling / keep-alive tuning** (`MaxIdleConns`,   `MaxIdleConnsPerHost`, `IdleConnTimeout`) - **Dial and TLS handshake timeouts** (`DialContext`, `TLSHandshakeTimeout`) - **Custom `RoundTripper`** (tracing, retries, rate limiting)  # Reproducing the Issue Pass a custom `http.Client` to the Streamable HTTP transport and observe that it is never used:  ```go package main  import (     "net/http"      "github.com/firebase/genkit/go/plugins/mcp" )  // A round tripper that records whether it is ever called. It isn't. type recordingTransport struct{ called bool } func (t *recordingTransport) RoundTrip(*http.Request) (*http.Response, error) {     t.called = true     return nil, nil }  func main() {     recorder := &recordingTransport{}     customClient := &http.C
  **Post-Mortem & Fix Analysis**:
  > I will take this issue. Please assign it to me.  The problem is that `StreamableHTTPConfig.HTTPClient` in `go/plugins/mcp/client.go` is ignored. The code does not allow injecting a custom `http.Client`. I will first inspect the `mcp-go` package version being used. Then, I will add a mechanism similar to `WithHTTPClient` in the SSE transport to use the provided `HTTPClient`. I will test by passing a custom client and checking if it is used. 
  > @modelpath-dev btw, how can one become a contributor? I have deep interest in the project, for both personal and professional use and I would love to contribute.
  > Hey @vllst-io, that's awesome to hear! You can start by checking out the contribution guidelines in the repo. It's usually a good idea to begin with small issues or bug fixes to get familiar with the codebase. Looking forward to your contributions! 

- **Issue #6009** (2026-08-19): **[Dev UI] Numeric model config fields are sent to the runtime as strings**
  *Symptoms*: Every numeric field in the model config panel reaches the runtime as a string. Setting `temperature` to `0.5` sends `{"config":{"temperature":"0.5"}}`.  Against a Go runtime the request fails outright, because the typed-config constructors fold a model's config schema into the action's input schema and validate it:  ``` invalid input to action "/model/anthropic/claude-opus-4-8": data did not match expected schema: - config: Must validate at least one schema (anyOf) - config.temperature: Invalid type. Expected: number, given: string ```  JS runtimes publish the config schema as `metadata.model.customOptions` and don't validate against it, so there the string is handed to the plugin rather than rejected. The payload on the wire is the same either way.  ## Cause  `text-input.component.html` binds the input type:  ```html <input   [type]="     customOption().type === 'number' || customOption().type === 'integer'       ? 'number'       : 'text'   "   matInput   [formControl]="control()" /> ```  Angular declares `NumberValueAccessor` with the selector `input[type=number][formControlName],input[type=number][formControl],input[type=number][ngModel]`. That is a static attribute selector, resolved against the template at compile time, so a bound `[type]` never matches it however it evaluates. `DefaultValueAccessor` binds instead, and it writes `$event.target.value`, which is always a string.  The rendered DOM genuinely is `<input type="number">`, so the spinner, the numeric keyboard, a

- **Issue #5776** (2026-07-29): **[Dev UI] Manual tool calls incorrectly sent as resume**
  *Symptoms*: ### What Currently Happens vs. The Distinction for Manual Tool Calls                                                                                                                                                                                                                                                                    1. How resume is currently used:                                                                                                                                        - When `buildPrompt(messages)` runs, it filters out all entries where `item.type !== 'message'`, stripping `tool_action` cards from messages.                             - It then calls `buildResumePayloadFromChatLog(messages)` on the last `tool_action` card and attaches it output to `GenerateActionOptions.resume` (`resume: { respond: [...] }`).                                                                                                                                              2. Why manual tool calls should append to messages instead:                                                                                                             - resume is designed for Genkit's interrupt/resumption loop (`source === 'interrupt'`), where the runner resumes an interrupted execution using resume.restart or resume.respond.                                                                                                                                                     - manual tool calling

- **Issue #5734** (2026-08-03): **[JS] Vertex AI JS plugin does not support multi-region endpoints (eu, us) for Gemini models**
  *Symptoms*: **Describe the bug**  The Vertex AI JavaScript plugin currently does not appear to support the new Vertex AI multi-region endpoints (`eu` and `us`).  Google now recommends using the multi-region locations to access Gemini models, including newer models that may not be available in regional endpoints.  When configuring Genkit to use the `eu` location, requests fail with:  ``` GenkitError: UNKNOWN: Error fetching from https://eu-aiplatform.googleapis.com/v1beta1/projects/<project>/locations/eu/publishers/google/models/gemini-3.5-flash:generateContent  [404 Not Found] ```  The same code works correctly when using `global`.  The `eu` multi-region is valid and available in Vertex AI Studio, so this appears to be a client library limitation rather than a service issue.  **To Reproduce**  ```ts import { genkit } from "genkit"; import { vertexAI } from "@genkit-ai/google-genai";  const ai = genkit({   plugins: [     vertexAI({       location: "eu",     }),   ], }); ```  Then call any Gemini model, for example:  ```ts await ai.generate({   model: vertexAI.model("gemini-3.5-flash"),   prompt: "Hello", }); ```  The request fails with:  ``` 404 Not Found https://eu-aiplatform.googleapis.com/v1beta1/projects/<project>/locations/eu/publishers/google/models/gemini-3.5-flash:generateContent ```  Changing only the location to:  ```ts location: "global" ```  makes the same request succeed.  **Expected behavior**  The SDK should support the Vertex AI multi-region locations (`eu` and `us`) in th
  **Post-Mortem & Fix Analysis**:
  > Multi-region locations are supported as of #5753: `vertexAI({ location: 'eu' })` now resolves to `aiplatform.eu.rep.googleapis.com` instead of the invalid `eu-aiplatform.googleapis.com`. Python got the same in #5763.  Upgrading `@genkit-ai/google-genai` should sort it. Closing this, and #5457 is superseded by #5753 so that can go alongside. If you still get a 404, I'll happily reopen. 

- **Issue #5711** (2026-10-02): **[Dev UI] Unable to retry failed interrupt responses**
  *Symptoms*: 

- **Issue #5710** (2026-07-09): **[Tooling] Switching to append mode is causing pending tool calls to turn into resumed**
  *Symptoms*: Once there is a pending tool call card on the model runner, if we switch to append mode, the tool call card turns into resumed state with whatever inputs were present.

- **Issue #5700** (2026-07-17): **[Ollama][Python] Streaming responses return empty `response.text` (final ModelResponse content is discarded)**
  *Symptoms*: ### Describe the bug  In the Python Ollama plugin, streaming a generation sends text deltas via `ctx.send_chunk()` but discards the aggregated content from the final `ModelResponse`. As a result, `(await response).text` (and `response.message`) is empty even on a fully successful stream.  The offending code is in `OllamaModel.generate()` in `py/plugins/ollama/src/genkit/plugins/ollama/models.py`. After the streaming branch has emitted all chunks, the method explicitly resets the accumulated content to an empty list before building the final response:  ```python if self.is_streaming_request(ctx=ctx):     content = []  response_message = Message(role=Role.MODEL, content=content) # ... return ModelResponse(     message=Message(role=Role.MODEL, content=content),  # content == []     usage=..., ) ```  The streaming helpers (`_chat_with_ollama` / `_generate_ollama_response`) send each chunk via `ctx.send_chunk(...)` and then return `None`, so nothing is ever accumulated into the final response.  ### Impact  Any consumer using the documented streaming pattern gets an empty string for the final text:  ```python stream, response = ai.generate_stream(model='ollama/...', prompt='...') async for chunk in stream:     ...  # chunks arrive fine final = await response print(final.text)  # '' — even though the stream succeeded ```  Callers are forced to buffer the streamed chunks themselves to reconstruct the full text, which defeats the purpose of awaiting the final response.  ### To Reprodu

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

### Incident Patch 1: `4788c34d` (2026-10-06)
**Commit Message**: fix(py)!: actions take one input; context arrives by its ActionRunContext annotation (#6538)

**File**: `py/packages/genkit-google-genai/src/genkit_google_genai/_google.py` (modified, +7/-19)
```diff
@@ -369,14 +369,6 @@ async def _check(op: Operation, ctx: ActionRunContext) -> Operation:
     )
 
 
-def _background_actions(bg: BackgroundAction) -> list[Action]:
-    """Unpack a BackgroundAction into its constituent Action objects."""
-    actions = [bg.start_action, bg.check_action]
-    if bg.cancel_action is not None:
-        actions.append(bg.cancel_action)
-    return actions
-
-
 class GoogleFamilyRefs:
     """Typed ref constructors shared by GoogleAI and VertexAI.
 
@@ -685,19 +677,17 @@ async def init(self) -> list[Action]:
 
         # Veo Models (background models)
         for name in genai_models.veo:
-            actions.extend(_background_actions(self._resolve_veo_model(googleai_name(name))))
+            actions.extend(self._resolve_veo_model(googleai_name(name)).actions)
 
         client_options = self._interactions_client_options()
         plugin_api_key = self._plugin_api_key()
         for name in list_known_deep_research_models():
             actions.extend(
-                _background_actions(
-                    create_deep_research_background_action(
-                        googleai_name(name),
-                        plugin_api_key=plugin_api_key,
-                        client_options=client_options,
-                    )
-                )
+                create_deep_research_background_action(
+                    googleai_name(name),
+                    plugin_api_key=plugin_api_key,
+                    client_options=client_options,
+                ).actions
             )
         for name in list_known_antigravity_models():
             actions.append(
@@ -1071,9 +1061,7 @@ async def init(self) -> list[Action]:
 
         # Veo Models (background models)
         for name in genai_models.veo:
-            bg_action = self._resolve_veo_model(vertexai_name(name))
-            actions.append(bg_action.start_action)
-            actions.append(bg_action.check_action)
+            actions.extend(self._resolve_veo_model(vertexai_name(name)).actions)
 
         for name in VERTEX_KNOWN_EMBEDDERS:
             actions.append(self._resolve_embedder(vertexai_name(name)))
```

**File**: `py/packages/genkit/src/genkit/_ai/_aio.py` (modified, +26/-3)
```diff
@@ -276,6 +276,10 @@ def flow(
     ) -> _FlowDecorator | _FlowDecoratorWithChunk[Any]:
         """Decorator to register an async function as a flow.
 
+        A flow takes at most one input. To read the request context or stream
+        chunks, add a parameter annotated ``ActionRunContext``, in any position.
+        Any other second parameter raises ``TypeError`` when the flow is defined.
+
         Args:
             name: Optional name for the flow. Defaults to the function name.
             description: Optional description for the flow.
@@ -350,12 +354,27 @@ def tool(
 
         The return annotation is what the model binds as ``outputSchema``.
 
+        A tool takes at most one input, and that input's type is the schema the
+        model fills in. For several fields, use one Pydantic model. To read the
+        request context or interrupt, add a parameter annotated
+        ``ToolRunContext``, in any position. Any other second parameter raises
+        ``TypeError`` when the tool is defined.
+
         Example:
             @ai.tool()
             async def current_weather(city: str) -> str:
                 return f'Sunny in {city}'
 
-            res = await ai.generate(prompt='Weather in Paris?', tools=['current_weather'])
+            class Forecast(BaseModel):
+                city: str
+                days: int = 3
+
+            @ai.tool()
+            async def forecast(input: Forecast, ctx: ToolRunContext) -> str:
+                user = ctx.context.get('user_id')
+                return f'{input.days}-day forecast for {input.city} ({user})'
+
+            res = await ai.generate(prompt='Weather in Paris?', tools=['current_weather', 'forecast'])
         """
 
         def wrapper(func: Callable[..., Any]) -> Tool:
@@ -460,13 +479,17 @@ def define_batch_evaluator(
         name: str,
         display_name: str,
         definition: str,
-        fn: BatchEvaluatorFn[Any],
+        fn: BatchEvaluatorFn,
         is_billed: bool = False,
         config_schema: type[BaseModel] | dict[str, object] | None = None,
         metadata: dict[str, object] | None = None,
         description: str | None = None,
     ) -> Action:
-        """Register a batch evaluator action."""
+        """Register a batch evaluator.
+
+        The function is an action: one ``EvalRequest``. Read options from
+        ``req.options``. A second parameter raises ``TypeError`` when defined.
+        """
         return define_batch_evaluator(
             self.registry,
             name=name,
```

**File**: `py/packages/genkit/src/genkit/_ai/_decorators.py` (modified, +8/-0)
```diff
@@ -47,6 +47,9 @@ def __init__(self, registry: Registry, name: str | None, description: str | None
     @overload
     def __call__(self, func: Callable[[InputT, ActionRunContext], Awaitable[OutputT]]) -> Action[InputT, OutputT]: ...
 
+    @overload
+    def __call__(self, func: Callable[[ActionRunContext, InputT], Awaitable[OutputT]]) -> Action[InputT, OutputT]: ...
+
     @overload
     def __call__(self, func: Callable[[InputT], Awaitable[OutputT]]) -> Action[InputT, OutputT]: ...
 
@@ -71,6 +74,11 @@ def __call__(
         self, func: Callable[[InputT, ActionRunContext], Awaitable[OutputT]]
     ) -> Action[InputT, OutputT, ChunkT]: ...
 
+    @overload
+    def __call__(
+        self, func: Callable[[ActionRunContext, InputT], Awaitable[OutputT]]
+    ) -> Action[InputT, OutputT, ChunkT]: ...
+
     @overload
     def __call__(self, func: Callable[[InputT], Awaitable[OutputT]]) -> Action[InputT, OutputT, ChunkT]: ...
 
```

**File**: `py/packages/genkit/src/genkit/_ai/_evaluator.py` (modified, +5/-4)
```diff
@@ -52,8 +52,8 @@
 # Must be async (coroutine function).
 EvaluatorFn = Callable[[BaseDataPoint, T], Coroutine[Any, Any, EvalFnResponse]]
 
-# User-provided batch evaluator function that evaluates an EvaluationRequest
-BatchEvaluatorFn = Callable[[EvalRequest, T], Coroutine[Any, Any, list[EvalFnResponse]]]
+# User-provided batch evaluator: one EvalRequest.
+BatchEvaluatorFn = Callable[[EvalRequest], Coroutine[Any, Any, list[EvalFnResponse]]]
 
 
 class EvaluatorRef(BaseModel):
@@ -184,13 +184,13 @@ def define_batch_evaluator(
     name: str,
     display_name: str,
     definition: str,
-    fn: BatchEvaluatorFn[Any],
+    fn: BatchEvaluatorFn,
     is_billed: bool = False,
     config_schema: type[BaseModel] | dict[str, object] | None = None,
     metadata: dict[str, object] | None = None,
     description: str | None = None,
 ) -> Action:
-    """Register a batch evaluator that runs the callback on the entire dataset."""
+    """Register a batch evaluator. ``fn`` is the action: one ``EvalRequest``."""
     evaluator_meta: dict[str, object] = metadata.copy() if metadata else {}
     if 'evaluator' not in evaluator_meta:
         evaluator_meta['evaluator'] = {}
@@ -205,6 +205,7 @@ def define_batch_evaluator(
         evaluator_dict['customOptions'] = to_json_schema(config_schema)
 
     evaluator_description = _get_func_description(fn, description)
+
     return registry.register_action(
         name=name,
         kind=ActionKind.EVALUATOR,
```

**File**: `py/packages/genkit/src/genkit/_ai/_tools.py` (modified, +16/-31)
```diff
@@ -21,11 +21,11 @@
 from collections.abc import Callable, Sequence
 from contextvars import ContextVar
 from types import UnionType
-from typing import Any, Union, cast, get_args, get_origin, get_type_hints
+from typing import Any, Union, cast, get_args, get_origin
 
 from pydantic import BaseModel, TypeAdapter, ValidationError
 
-from genkit._core._action import Action, ActionKind, ActionRunContext
+from genkit._core._action import Action, ActionKind, ActionRunContext, resolve_type_hints
 from genkit._core._error import GenkitError, Interrupt, RuntimeErrorReason
 from genkit._core._logger import get_logger
 from genkit._core._middleware import GenerateMiddlewareContext
@@ -565,11 +565,7 @@ def model_schema_from_return_annotation(
     inferred: dict[str, object] | None,
 ) -> dict[str, object] | None:
     """JSON Schema the model should bind, from the handler's return annotation."""
-    try:
-        hints = get_type_hints(func)
-    except Exception:
-        hints = dict(getattr(func, '__annotations__', {}))
-    inner = envelope_output_type(hints.get('return'))
+    inner = envelope_output_type(resolve_type_hints(func).get('return'))
     if inner is NOT_ENVELOPE:
         return inferred
     if inner is Any or inner is object:
@@ -608,32 +604,15 @@ def _define_tool(
         raise ValueError(f'Cannot infer a tool name from {func!r}; pass name= explicitly.')
     tool_description = _get_func_description(func, description)
 
-    input_spec = inspect.getfullargspec(func)
-
-    async def tool_fn_wrapper(*args: Any) -> Any:  # noqa: ANN401 - arity dispatch; args/return follow registered tool
+    async def tool_fn_wrapper(input: object, ctx: ActionRunContext) -> MultipartToolResponse[Any]:  # noqa: A002
         # Record resumed metadata on the current span for observability.
         resumed_meta = _tool_resumed_metadata.get()
         if resumed_meta:
             set_custom_metadata_attributes({'resumed': resumed_meta})
 
-        # Dynamic dispatch by arity; payload types follow the registered tool (not expressible here).
-        match len(input_spec.args):
-            case 0:
-                raw = await func()
-            case 1:
-                raw = await func(args[0])
-            case 2:
-                original_input = _tool_original_input.get()
-                raw = await func(
-                    args[0],
-                    ToolRunContext(
-                        cast(ActionRunContext, args[1]),
-                        resumed_metadata=resumed_meta,
-                        original_input=original_input,
-                    ),
-                )
-            case _:
-                raise ValueError('tool must have 0-2 args...')
+        # A ctx annotated ActionRunContext gets the ToolRunContext too.
+        tool_ctx = ToolRunContext(ctx, resumed_metadata=resumed_meta, original_input=_tool_original_input.get())
+        raw = await action.params.call(func, input, tool_ctx)
         return as_multipart_tool_response(raw, tool_name=tool_name)
 
     action = registry.register_action(
@@ -672,12 +651,17 @@ def define_tool(
     Args:
         registry: The registry to register the tool in.
         func: The async function to register as a tool. Must be a coroutine function.
+            It takes at most one input, annotated with a type that has a JSON
+            schema (``Any`` accepts anything), plus an optional parameter
+            annotated ``ToolRunContext`` in any position.
         name: Optional name for the tool. Defaults to the function name.
         description: Optional description. Defaults to the function's docstring.
         input_schema: Optional input schema override (Pydantic model or JSON-schema dict).
 
     Raises:
-        TypeError: If func is not an async function.
+        TypeError: If func is not an async function, has more than one input,
+            has an input with no annotation or no JSON schema, or has more than
+            one ``ToolRunContext`` parameter.
     """
     return _define_tool(registry, func, name, description, input_schema=input_schema)
 
@@ -696,13 +680,14 @@ def tool(
     for one call.
 
     Args:
-        func: Async tool implementation (same 0–2 argument rules as :func:`define_tool`).
+        func: Async tool implementation (same one-input rule as :func:`define_tool`).
         name: Tool name for the model. Defaults to ``func.__name__``.
         description: Sent to the model. Defaults to the function docstring.
         input_schema: Optional input schema override (Pydantic model or JSON-schema dict).
 
     Raises:
-        TypeError: If ``func`` is not a coroutine function.
+        TypeError: If ``func`` is not a coroutine function, takes more than one input,
+            or its input has no annotation or no JSON schema.
         ValueError: If no ``name`` is given and ``func`` has no ``__name__``.
 
     Example:
```

**File**: `py/packages/genkit/src/genkit/_core/_action.py` (modified, +321/-86)
```diff
@@ -20,13 +20,27 @@
 import inspect
 import json
 import re
+import sys
 import time
+import types
 from collections.abc import AsyncIterator, Awaitable, Callable, Mapping, Sequence
 from contextvars import ContextVar
-from typing import Any, ClassVar, Generic, NamedTuple, cast, get_type_hints
+from dataclasses import dataclass
+from typing import (
+    Any,
+    ClassVar,
+    Generic,
+    NamedTuple,
+    Union,
+    cast,
+    get_args,
+    get_origin,
+    get_type_hints,
+)
 
 from pydantic import BaseModel, ConfigDict, TypeAdapter, ValidationError
 from pydantic.alias_generators import to_camel
+from pydantic.errors import PydanticInvalidForJsonSchema, PydanticSchemaGenerationError, PydanticUserError
 from typing_extensions import TypeVar
 
 from genkit._core._channel import Channel, CloseableQueue
@@ -225,41 +239,284 @@ def parse_plugin_name_from_action_name(name: str) -> str | None:
     return None
 
 
-def extract_action_args_and_types(
-    input_spec: inspect.FullArgSpec,
-    annotations: Mapping[str, Any] | None = None,
-) -> tuple[list[str], list[Any]]:
-    """Extract argument names and types from a function spec."""
-    arg_types = []
-    action_args = input_spec.args.copy()
-    resolved_annotations = annotations or input_spec.annotations
+# =============================================================================
+# Reading an action's signature
+#
+# An action function takes at most one input and at most one run context, in
+# either order:
+#
+#   async def lookup(order: Order, ctx: ActionRunContext) -> Receipt: ...
+#   async def lookup(ctx: ActionRunContext, order: Order) -> Receipt: ...  # same
+#   async def ping(ctx: ActionRunContext) -> str: ...                      # no input
+#
+# Rules for the function:
+#   - The context is the parameter annotated ActionRunContext or a subclass
+#     (ToolRunContext, ...).
+#   - Any other parameter is the input, so there's only one. Put more fields
+#     on one input model.
+#   - Input and return types need a JSON schema: a Pydantic model, dataclass,
+#     TypedDict, or a basic type like str, int, list or dict.
+#   - A default on the input lets the action run with no input.
+#
+# Breaking a rule raises TypeError when the action is defined.
+# =============================================================================
+
+_CallT = TypeVar('_CallT')
+
+
+@dataclass(frozen=True, slots=True)
+class ActionParams:
+    """An action function's input and run-context parameters, either may be absent."""
+
+    input: inspect.Parameter | None
+    context: inspect.Parameter | None
+
+    @property
+    def input_optional(self) -> bool:
+        """True if the input has a default, so the action can run without one."""
+        return self.input is not None and self.input.default is not inspect.Parameter.empty
+
+    def call(self, fn: Callable[..., _CallT], input: object, ctx: 'ActionRunContext') -> _CallT:  # noqa: A002
+        """Call ``fn`` with ``input`` and ``ctx`` passed by parameter name.
+
+        A missing input is left out when the parameter has a default, so the
+        default applies.
+        """
+        kwargs: dict[str, object] = {}
+        if self.input is not None and not (input is None and self.input_optional):
+            kwargs[self.input.name] = input
+        if self.context is not None:
+            kwargs[self.context.name] = ctx
+        return fn(**kwargs)
+
 
-    # Special case when using a method as an action, we ignore first "self"
-    # arg. (Note: The original condition `len(action_args) <= 3` is preserved
-    # from the source snippet).
-    if len(action_args) > 0 and len(action_args) <= 3 and action_args[0] == 'self':
-        del action_args[0]
+def _kind_label(kind: ActionKind) -> str:
+    """The action kind as error messages say it."""
+    # ActionKind.TOOL is 'tool.v2' (the catalog key); people call it a tool.
+    return 'tool' if kind == ActionKind.TOOL else str(kind)
 
-    for arg in action_args:
-        arg_types.append(resolved_annotations.get(arg, Any))
 
-    return action_args, arg_types
+def describe_action(kind: ActionKind, name: str) -> str:
+    """How error messages name an action, e.g. ``"tool 'weather'"``."""
+    return f"{_kind_label(kind)} '{name}'"
 
 
-def _first_action_arg_has_default(input_spec: inspect.FullArgSpec, n_action_args: int) -> bool:
-    """Return True if the action's first user-facing arg has a Python default.
+def find_input_and_context(
+    fn: Callable[..., object],
+    hints: Mapping[str, Any],
+    *,
+    kind: ActionKind,
+    name: str,
+) -> ActionParams:
+    """Find ``fn``'s input and run-context parameters, or raise a TypeError saying how to fix it.
 
-    Lets `@ai.flow() async def f(name: str = 'world')` be called as `await f()`
-    without forcing the caller to pass `None` explicitly. The default makes the
-    input semantically optional from the function's perspective; we honour that
-    when dispatching.
+    ``hints`` is ``resolve
```

**File**: `py/packages/genkit/src/genkit/_core/_background.py` (modified, +65/-39)
```diff
@@ -58,6 +58,44 @@ def stamp_operation_action(*, operation: Operation, name: str) -> None:
     operation.action = _make_action_key(ActionKind.BACKGROUND_MODEL, name)
 
 
+def _operation_action(
+    *,
+    kind: ActionKind,
+    name: str,
+    fn: Callable[..., Awaitable[Operation]],
+    model_name: str,
+    description: str,
+    metadata: dict[str, object],
+    config_schema: type[BaseModel] | dict[str, Any] | None = None,
+) -> Action:
+    """An Action for start/check/cancel that stamps the returned Operation.
+
+    ``fn``'s signature is still the Action's (``metadata_fn``), so
+    ``(ctx, request)`` and ``(request, ctx)`` both work: the wrapper forwards
+    through ``params.call``. The stamp is the start action key, so a caller
+    who passes the Operation back reaches the right check/cancel.
+    """
+
+    # wraps keeps fn's annotations on the wrapper, e.g. ModelRequest[VeoConfig].
+    @wraps(fn)
+    async def run_and_stamp(input: object, ctx: ActionRunContext) -> Operation:  # noqa: A002
+        op = await action.params.call(fn, input, ctx)
+        if isinstance(op, Operation):
+            stamp_operation_action(operation=op, name=model_name)
+        return op
+
+    action = Action(
+        kind=kind,
+        name=name,
+        fn=run_and_stamp,
+        metadata_fn=fn,
+        metadata=metadata,
+        description=description,
+        config_schema=config_schema,
+    )
+    return action
+
+
 StartModelOpFn = Callable[[ModelRequest, ActionRunContext], Awaitable[Operation]]
 CheckModelOpFn = Callable[[Operation, ActionRunContext], Awaitable[Operation]]
 CancelModelOpFn = Callable[[Operation, ActionRunContext], Awaitable[Operation]]
@@ -88,10 +126,11 @@ def operation_context(
 
 
 class BackgroundAction(Generic[OutputT]):
-    """A background action that can run for a long time.
+    """A handle over a background model's start, check and cancel actions.
 
-    Unlike regular actions, background actions can run for extended periods.
-    The returned operation can be used to check status and retrieve the response.
+    Built on registered actions but isn't itself an ``Action``: each of
+    start, check and cancel has its own registry key.
+    ``start`` returns an Operation; pass it to ``check`` until it's done.
 
     Attributes:
         __action: Action metadata.
@@ -136,6 +175,18 @@ def supports_cancel(self) -> bool:
         """Whether this background action supports cancellation."""
         return self.cancel_action is not None
 
+    @property
+    def actions(self) -> list[Action]:
+        """The start, check and (if any) cancel actions, for registering or listing.
+
+        A background model is three registered actions, not one. Register all
+        of them, or a poll fails later with the check action not found.
+        """
+        actions = [self.start_action, self.check_action]
+        if self.cancel_action is not None:
+            actions.append(self.cancel_action)
+        return actions
+
     async def start(
         self,
         input: ModelRequest | None = None,
@@ -249,8 +300,6 @@ def background_model(
     Plugin ``init`` / ``resolve`` return this. ``define_background_model``
     registers the start / check / cancel actions.
     """
-    action_key = _make_action_key(ActionKind.BACKGROUND_MODEL, name)
-
     # Build model metadata
     model_meta: dict[str, Any] = metadata.copy() if metadata else {}
     model_options: dict[str, Any] = {}
@@ -281,53 +330,32 @@ def background_model(
     output_schema_meta = to_json_schema(ModelResponse)
     model_meta['outputSchema'] = output_schema_meta
 
-    # Wrap the start function to add the action key and timing.
-    # Keep the caller's request annotation (ModelRequest[FamilyConfig]) so
-    # Action still types the config bag as that family.
-    @wraps(start)
-    async def wrapped_start(request: ModelRequest, ctx: ActionRunContext) -> Operation:
-        op = await start(request, ctx)
-        # The handle needs this key so check/cancel can find the job later.
-        op.action = action_key
-        return op
-
-    async def wrapped_check(op: Operation, ctx: ActionRunContext) -> Operation:
-        updated = await check(op, ctx)
-        # Preserve action key
-        updated.action = action_key
-        return updated
-
-    start_action = Action(
+    start_action = _operation_action(
         kind=ActionKind.BACKGROUND_MODEL,
         name=name,
-        fn=wrapped_start,
-        metadata_fn=start,
+        fn=start,
+        model_name=name,
         metadata=model_meta,
         description=description or f'Background model: {label}',
         config_schema=config_schema,
     )
 
-    check_action = Action(
+    check_action = _operation_action(
         kind=ActionKind.CHECK_OPERATION,
         name=f'{name}/check',
-        fn=wrapped_check,
+        fn=check,
+        model_name=name,
         metadata={'outputSchema': output_schema_meta},
         description=f'Check operation status f
```

**File**: `py/packages/genkit/src/genkit/_core/_flow.py` (modified, +9/-0)
```diff
@@ -58,6 +58,15 @@ def define_flow(
 ) -> Action[InputT, OutputT]: ...
 
 
+@overload
+def define_flow(
+    registry: Registry,
+    func: Callable[[ActionRunContext, InputT], Awaitable[OutputT]],
+    name: str | None = None,
+    description: str | None = None,
+) -> Action[InputT, OutputT]: ...
+
+
 def define_flow(
     registry: Registry,
     func: Callable[..., Awaitable[Any]],
```

---

### Incident Patch 2: `de593e57` (2026-10-06)
**Commit Message**: feat(py)!: require keyword arguments in Genkit constructor (#6536)

**File**: `py/packages/genkit/src/genkit/_ai/_aio.py` (modified, +84/-38)
```diff
@@ -28,7 +28,7 @@
 import uuid
 from collections.abc import Awaitable, Callable, Coroutine, Mapping, Sequence
 from pathlib import Path
-from typing import Any, TypeVar, cast, overload
+from typing import TYPE_CHECKING, Any, TypeVar, cast, overload
 
 import anyio
 import uvicorn
@@ -137,6 +137,18 @@
 MiddlewareT = TypeVar('MiddlewareT', bound=BaseMiddleware)
 
 
+def init_keyword_example(value: object) -> str:
+    # Suggest model= only for a provider/name id or a ModelRef. A path like
+    # './prompts' is not a model, so don't put it on model=.
+    if isinstance(value, ModelRef):
+        return f'Genkit(model={value!r})'
+    if isinstance(value, str) and '/' in value and not value.startswith(('.', '/', '\\', '~')) and '\\' not in value:
+        parts = value.split('/')
+        if all(part and part not in ('.', '..') for part in parts):
+            return f'Genkit(model={value!r})'
+    return 'Genkit(plugins=[...], model="...")'
+
+
 class Genkit:
     """The main entry point for building AI-powered applications.
 
@@ -161,43 +173,77 @@ async def my_flow(prompt: str) -> str:
             ai.run_main(my_flow('Weather in Paris?'))
     """
 
-    def __init__(
-        self,
-        plugins: list[Plugin] | None = None,
-        model: ModelArg | None = None,
-        prompt_dir: str | Path | None = None,
-        reflection_server_spec: ServerSpec | None = None,
-    ) -> None:
-        # Before anything that logs, so plugin initialization is covered too.
-        configure_logging()
-        self.registry: Registry = Registry()
-        self._reflection_server_spec: ServerSpec | None = reflection_server_spec
-        self._reflection_ready = threading.Event()
-        self._initialize_registry(model, plugins)
-        # Ensure the default generate action is registered for async usage.
-        define_generate_action(self.registry)
-        self._register_plugin_middleware(plugins)
-        maybe_inject_dev_instrumentation()
-        # In dev mode, start the reflection server immediately in a background
-        # daemon thread so it's available regardless of which web framework (or
-        # none) the user chooses.
-        if is_dev_environment():
-            # SIGINT (Ctrl+C) always hits handle_signal. SIGTERM inside the
-            # run_main wait loop is stolen by anyio (clean exit → atexit);
-            # elsewhere SIGTERM also goes through handle_signal. Both paths
-            # remove the runtime discovery files.
-            setup_signal_handlers()
-            self._start_reflection_background()
-
-        # Load prompts
-        load_path = prompt_dir
-        if load_path is None:
-            default_prompts_path = Path('./prompts')
-            if default_prompts_path.is_dir():
-                load_path = default_prompts_path
-
-        if load_path:
-            load_prompt_folder(self.registry, dir_path=load_path)
+    registry: Registry
+    _reflection_server_spec: ServerSpec | None
+    _reflection_ready: threading.Event
+
+    if TYPE_CHECKING:
+
+        def __init__(
+            self,
+            *,
+            plugins: list[Plugin] | None = None,
+            model: ModelArg | None = None,
+            prompt_dir: str | Path | None = None,
+            reflection_server_spec: ServerSpec | None = None,
+        ) -> None: ...
+
+    else:
+        # Type checkers see the keyword-only signature above. Runtime still
+        # accepts *args so we can raise a TypeError that names the keyword they
+        # probably meant, instead of silently binding a model id as plugins.
+        def __init__(
+            self,
+            *args: object,
+            plugins: list[Plugin] | None = None,
+            model: ModelArg | None = None,
+            prompt_dir: str | Path | None = None,
+            reflection_server_spec: ServerSpec | None = None,
+        ) -> None:
+            if args:
+                raise TypeError(
+                    f'Genkit() takes no positional arguments, got {len(args)}. '
+                    f'Pass keyword arguments instead, e.g. {init_keyword_example(args[0])}.'
+                )
+            # Before anything that logs, so plugin initialization is covered too.
+            configure_logging()
+            self.registry = Registry()
+            self._reflection_server_spec = reflection_server_spec
+            self._reflection_ready = threading.Event()
+            self._initialize_registry(model, plugins)
+            # Ensure the default generate action is registered for async usage.
+            define_generate_action(self.registry)
+            self._register_plugin_middleware(plugins)
+            maybe_inject_dev_instrumentation()
+            # In dev mode, start the reflection server immediately in a background
+            # daemon thread so it's available regardless of which web framework (or
+            # none) the user chooses.
+            if is_dev_environment():
+                # SIGINT (Ctrl+C) always hits handle_signal. 
```

**File**: `py/packages/genkit/tests/genkit/ai/genkit_api_test.py` (modified, +37/-0)
```diff
@@ -340,3 +340,40 @@ async def test_current_context() -> None:
         _action_context.reset(token)
 
     assert Genkit.current_context() is None
+
+
+def test_genkit_positional_argument_raises_type_error() -> None:
+    with pytest.raises(
+        TypeError,
+        match=(
+            r'Genkit\(\) takes no positional arguments, got 1\. '
+            r'Pass keyword arguments instead, e\.g\. '
+            r"Genkit\(model='googleai/gemini-flash-latest'\)\."
+        ),
+    ):
+        Genkit('googleai/gemini-flash-latest')  # type: ignore[reportCallIssue,too-many-positional-arguments]
+    with pytest.raises(
+        TypeError,
+        match=(
+            r'Genkit\(\) takes no positional arguments, got 1\. '
+            r'Pass keyword arguments instead, e\.g\. '
+            r'Genkit\(plugins=\[...\], model="..."\)\.'
+        ),
+    ):
+        Genkit([])  # type: ignore[reportCallIssue,too-many-positional-arguments]
+
+
+def test_genkit_path_string_does_not_suggest_model_kwarg() -> None:
+    with pytest.raises(TypeError) as exc_info:
+        Genkit('./prompts')  # type: ignore[reportCallIssue,too-many-positional-arguments]
+    message = str(exc_info.value)
+    assert "model='./prompts'" not in message
+    assert 'Genkit(plugins=[...], model="...")' in message
+
+
+def test_genkit_two_positional_args_says_got_2() -> None:
+    with pytest.raises(
+        TypeError,
+        match=r'Genkit\(\) takes no positional arguments, got 2\.',
+    ):
+        Genkit('googleai/gemini-flash-latest', [])  # type: ignore[reportCallIssue,too-many-positional-arguments]
```

---

### Incident Patch 3: `f94971bc` (2026-10-06)
**Commit Message**: fix(py)!: response.output is typed OutputT | None (#6537)

**File**: `py/packages/genkit/README.md` (modified, +6/-1)
```diff
@@ -24,7 +24,7 @@ uv add genkit genkit-google-genai
 
 ```python
 from pydantic import BaseModel, Field
-from genkit import Genkit
+from genkit import Genkit, PublicError
 from genkit_google_genai import GoogleAI
 
 ai = Genkit(plugins=[GoogleAI()], model=GoogleAI.gemini_model('gemini-flash-latest'))
@@ -42,6 +42,11 @@ async def review(code: str) -> Issue:
         prompt=f'Review this code:\n{code}',
         output_schema=Issue,
     )
+    if result.output is None:
+        raise PublicError(
+            'INTERNAL',
+            f'Model did not return an Issue (finish_reason={result.finish_reason}, error={result.error})',
+        )
     return result.output
 
 
```

**File**: `py/packages/genkit/pyproject.toml` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ dependencies = [
   "sse-starlette>=2.2.1",
   "websockets>=13.0.0",
   "pillow>=12.1.1",
-  "typing_extensions>=4.0",
+  "typing_extensions>=4.2",
   "strenum>=0.4.15; python_version < '3.11'",
 
   "dotpromptz>=0.1.5",
```

**File**: `py/packages/genkit/src/genkit/_ai/_aio.py` (modified, +8/-1)
```diff
@@ -1310,7 +1310,14 @@ def generate_stream(
         With ``output_schema=Recipe``, each ``chunk.output`` is a partial of
         that type: same attributes, any field may still be ``None`` or a
         prefix. Guard the field you are about to use. The finished
-        ``Recipe`` is only ``(await sr.response).output``.
+        ``Recipe`` is only ``(await stream.response).output``, and it's ``None``
+        when the reply isn't a ``Recipe``.
+
+        If the model fails partway through, the ``async for`` still ends
+        normally. The final response has ``finish_reason == FAILED``,
+        ``error`` set, ``text == ''``, ``message is None``, and ``messages``
+        ending at the last complete turn, so it's safe to send back. The
+        chunks you already received are the record of what was shown.
 
         Example:
             stream = ai.generate_stream(prompt='Write a haiku about rain.')
```

**File**: `py/packages/genkit/src/genkit/_ai/_prompt.py` (modified, +6/-1)
```diff
@@ -156,11 +156,16 @@ def response(self) -> Awaitable[ModelResponse[OutputT]]:
         Returns:
             An awaitable that resolves to a ModelResponse containing:
             - text: The complete generated text
-            - output: The typed output (when using Output[T])
+            - output: The typed output, or None when the reply isn't that shape
             - messages: The full message history
             - usage: Token usage statistics
             - finish_reason: Why generation stopped (e.g., 'stop', 'length')
             - Any tool calls or interrupts from the response
+
+        If the model fails partway through, this still resolves rather than
+        raising: ``finish_reason`` is FAILED, ``error`` is set, ``text`` is
+        empty, ``message`` is None, and ``messages`` ends at the last complete
+        turn. The chunks already streamed are the record of what was shown.
         """
         return self._response_future
 
```

**File**: `py/packages/genkit/src/genkit/_core/_model.py` (modified, +6/-6)
```diff
@@ -1192,7 +1192,7 @@ def text(self) -> str:
         return self.message.text
 
     @property
-    def output(self) -> OutputT:
+    def output(self) -> OutputT | None:
         """Parsed structured output, or None when the reply is not that shape.
 
         generate() does not throw when the text is not the schema. If you
@@ -1203,9 +1203,9 @@ def output(self) -> OutputT:
         # The rest of ABNORMAL_FINISH_REASONS can still hold usable parts (an
         # interrupt carries tool requests), so they only gate the schema path.
         if self.finish_reason in (FinishReason.BLOCKED, FinishReason.FAILED):
-            return cast(OutputT, None)
+            return None
         if self._wants_structure and self.finish_reason in ABNORMAL_FINISH_REASONS:
-            return cast(OutputT, None)
+            return None
 
         schema = self.request.output_schema if self.request is not None else None
 
@@ -1216,13 +1216,13 @@ def output(self) -> OutputT:
             # it back is never worth an exception: `.text` holds the raw reply
             # and `error` carries INVALID_OUTPUT when structure was requested.
             # Matches JS, where `extractJson` is called without the throw flag.
-            return cast(OutputT, None)
+            return None
 
         if schema is not None:
             try:
                 parse_schema(data=parsed, json_schema=schema)
             except GenkitError:
-                return cast(OutputT, None)
+                return None
 
         # A custom format's parser can return a scalar (e.g. enum string).
         # Skip Pydantic model validation for scalars.
@@ -1233,7 +1233,7 @@ def output(self) -> OutputT:
         try:
             return cast(OutputT, self._schema_type.model_validate(parsed))
         except ValidationError:
-            return cast(OutputT, None)
+            return None
 
     @property
     def messages(self) -> list[Message]:
```

**File**: `py/packages/genkit/tests/genkit/ai/generate_test.py` (modified, +117/-45)
```diff
@@ -16,6 +16,7 @@
 import pytest
 import yaml
 from pydantic import BaseModel, TypeAdapter, ValidationError
+from typing_extensions import assert_type
 
 from genkit import Document, Genkit, Message, ModelResponse, ModelResponseChunk, MultipartToolResponse, Part, Tool, tool
 from genkit._ai._formats._types import FormatDef, Formatter, FormatterConfig
@@ -4336,20 +4337,95 @@ async def stream_limit_model(_request: ModelRequest, ctx: ActionRunContext) -> M
     assert tool_calls == 0
 
 
+def _model_dies_after_hello_wor(ai: Genkit, name: str) -> None:
+    async def model(_request: ModelRequest, ctx: ActionRunContext) -> ModelResponse:
+        ctx.send_chunk(ModelResponseChunk(role=Role.MODEL, content=[Part.from_text('Hello, ')]))
+        ctx.send_chunk(ModelResponseChunk(role=Role.MODEL, content=[Part.from_text('wor')]))
+        raise RuntimeError('stream died')
+
+    ai.define_model(name=name, fn=model)
+
+
+async def _run_dies_midway(surface: str) -> tuple[list[str] | None, ModelResponse[Any]]:
+    """Run the dies-after-'Hello, wor' model through one generate surface."""
+    ai = Genkit(model='diesMidway')
+    _model_dies_after_hello_wor(ai, 'diesMidway')
+    if surface == 'generate':
+        return None, await ai.generate(prompt='start')
+    if surface == 'generate_stream':
+        stream = ai.generate_stream(prompt='start')
+    else:
+        stream = ai.define_prompt(name='greet', prompt='start').stream()
+    chunks = [chunk.text async for chunk in stream]
+    return chunks, await stream.response
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize('surface', ['generate_stream', 'prompt.stream', 'generate'])
+async def test_model_dies_midway_ends_failed_with_empty_reply(surface: str) -> None:
+    """The model dies after two chunks; each surface ends FAILED/INTERNAL with no half answer in history."""
+    chunks, response = await _run_dies_midway(surface)
+
+    if chunks is not None:
+        assert chunks == ['Hello, ', 'wor']
+    assert response.finish_reason == FinishReason.FAILED
+    assert response.finish_message == 'internal error'
+    assert response.error is not None
+    assert response.error.status == 'INTERNAL'
+    assert response.error.reason is None
+    assert response.error.message == response.finish_message
+    assert response.text == ''
+    assert response.message is None
+    assert response.output is None
+    assert [message.role for message in response.messages] == [Role.USER]
+    assert response.messages[0].text == 'start'
+
+
 @pytest.mark.asyncio
-async def test_midstream_model_failure_keeps_chunks_and_prior_closed_history() -> None:
-    ai = Genkit(model='midstreamFailureModel')
+async def test_generate_stream_fails_midway_with_schema_output_is_none() -> None:
+    """With output_schema, a stream that dies partway leaves final.output as None."""
+
+    class City(BaseModel):
+        name: str
+        population: int
+
+    ai = Genkit(model='diesMidJson')
+
+    async def model(_request: ModelRequest, ctx: ActionRunContext) -> ModelResponse:
+        ctx.send_chunk(ModelResponseChunk(role=Role.MODEL, content=[Part.from_text('{"name": "Pa')]))
+        ctx.send_chunk(ModelResponseChunk(role=Role.MODEL, content=[Part.from_text('ris", "population": 21')]))
+        raise RuntimeError('stream died')
+
+    ai.define_model(name='diesMidJson', fn=model)
+
+    stream = ai.generate_stream(prompt='a city', output_schema=City)
+    chunks = [chunk async for chunk in stream]
+    response = await stream.response
+
+    assert len(chunks) == 2
+    assert response.finish_reason == FinishReason.FAILED
+    assert response.error is not None
+    assert response.error.status == 'INTERNAL'
+    assert response.text == ''
+    assert response.message is None
+    assert response.output is None
+    assert [message.role for message in response.messages] == [Role.USER]
+
+
+@pytest.mark.asyncio
+async def test_generate_stream_fails_after_tool_turn_keeps_closed_round() -> None:
+    """The model dies on its second turn; history keeps the finished tool round and drops the half answer."""
+    ai = Genkit(model='diesAfterTool')
     model_calls = 0
     tool_calls = 0
-    chunks: list[ModelResponseChunk] = []
 
     @ai.tool(name='lookup')
     async def lookup() -> str:
         nonlocal tool_calls
         tool_calls += 1
         return '72F'
 
-    async def midstream_failure_model(_request: ModelRequest, ctx: ActionRunContext) -> ModelResponse:
+    async def model(_request: ModelRequest, ctx: ActionRunContext) -> ModelResponse:
         nonlocal model_calls
         model_calls += 1
         if model_calls == 1:
@@ -4358,61 +4434,30 @@ async def midstream_failure_model(_request: ModelRequest, ctx: ActionRunContext)
         ctx.send_chunk(ModelResponseChunk(role=Role.MODEL, content=[Part.from_text('partial-2')]))
         raise RuntimeError('stream broke')
 
-    ai.define_model(name='midstreamFailureModel', fn=midstream_failure_model)
-    response = await generate_act
```

**File**: `py/uv.lock` (modified, +1/-1)
```diff
@@ -1698,7 +1698,7 @@ requires-dist = [
     { name = "starlette", specifier = ">=0.46.1" },
     { name = "strenum", marker = "python_full_version < '3.11'", specifier = ">=0.4.15" },
     { name = "structlog", specifier = ">=25.2.0" },
-    { name = "typing-extensions", specifier = ">=4.0" },
+    { name = "typing-extensions", specifier = ">=4.2" },
     { name = "uvicorn", specifier = ">=0.34.0" },
     { name = "uvloop", marker = "sys_platform != 'win32'", specifier = ">=0.21.0" },
     { name = "websockets", specifier = ">=13.0.0" },
```

---

### Incident Patch 4: `c54d4527` (2026-10-06)
**Commit Message**: fix(py): long generate tool loops return at max_turns (#6501)

**File**: `py/packages/genkit/src/genkit/_ai/_generate.py` (modified, +55/-17)
```diff
@@ -107,6 +107,7 @@
 
 logger = get_logger(__name__)
 
+T = TypeVar('T')
 HookParamsT = TypeVar('HookParamsT')
 HookResultT = TypeVar('HookResultT')
 HookWrap = Callable[
@@ -380,6 +381,31 @@ def hook_wrap(mw: MiddlewareDef, hook: str) -> HookWrap[HookParamsT, HookResultT
     return cast(HookWrap[HookParamsT, HookResultT], wrap)
 
 
+async def hop(*, body: Awaitable[T]) -> T:
+    """Run ``body`` on a child task so a long use= list or tool loop can return.
+
+    The child yields once before ``body`` so an eager task factory does not
+    keep stacking hops on this call.
+
+    asyncio re-raises KeyboardInterrupt and SystemExit out of the event loop
+    instead of into the awaiting task. The child returns them as a value and
+    the parent raises them here, so outer turn and middleware frames unwind
+    in order, the same as before the hop.
+    """
+
+    async def child() -> tuple[T | None, KeyboardInterrupt | SystemExit | None]:
+        await asyncio.sleep(0)
+        try:
+            return await body, None
+        except (KeyboardInterrupt, SystemExit) as exc:
+            return None, exc
+
+    result, exc = await asyncio.create_task(child())
+    if exc is not None:
+        raise exc
+    return cast(T, result)
+
+
 async def dispatch_hooks(
     *,
     middleware: list[MiddlewareDef],
@@ -410,7 +436,15 @@ async def stamped(p: HookParamsT, c: GenerateMiddlewareContext) -> HookResultT:
 
         return stamped
 
-    runner = with_after_result(next_fn)
+    async def leaf(
+        p: HookParamsT,
+        c: GenerateMiddlewareContext,
+    ) -> HookResultT:
+        # Hop even when use=[] so a logging middleware cannot change whether
+        # a ContextVar the model set is still set after generate.
+        return await hop(body=next_fn(p, c))
+
+    runner = with_after_result(leaf)
     for mw in reversed(middleware):
         wrap = hook_wrap(mw, hook)
 
@@ -421,14 +455,16 @@ async def run_next(
             _inner: Callable[[HookParamsT, GenerateMiddlewareContext], Awaitable[HookResultT]] = runner,
             _wrap: HookWrap[HookParamsT, HookResultT] = wrap,
         ) -> HookResultT:
-            return await run_logged_hook(
-                mw=_mw,
-                hook=hook,
-                params=p,
-                ctx=c,
-                wrap=_wrap,
-                inner=_inner,
-                extra=extra(p) if extra is not None else None,
+            return await hop(
+                body=run_logged_hook(
+                    mw=_mw,
+                    hook=hook,
+                    params=p,
+                    ctx=c,
+                    wrap=_wrap,
+                    inner=_inner,
+                    extra=extra(p) if extra is not None else None,
+                )
             )
 
         runner = with_after_result(run_next)
@@ -1471,14 +1507,16 @@ async def generate_turn(
         return after_tools
     # Tools already ran. This is the conversation if a later pipe fails.
     call.set_messages(after_tools.messages)
-    return await run_wrap_generate(
-        registry=registry,
-        options=after_tools.options,
-        mw_pipeline=mw_pipeline,
-        current_turn=current_turn + 1,
-        message_index=after_tools.message_index,
-        call=call,
-        resolved=resolved,
+    return await hop(
+        body=run_wrap_generate(
+            registry=registry,
+            options=after_tools.options,
+            mw_pipeline=mw_pipeline,
+            current_turn=current_turn + 1,
+            message_index=after_tools.message_index,
+            call=call,
+            resolved=resolved,
+        )
     )
 
 
```

**File**: `py/packages/genkit/tests/genkit/ai/generate_test.py` (modified, +1321/-0)
```diff
@@ -6,8 +6,10 @@
 """Tests for the action module."""
 
 import asyncio
+import contextvars
 import json
 import pathlib
+import time
 from collections.abc import Awaitable, Callable, Sequence
 from typing import Any, cast
 
@@ -4610,6 +4612,1325 @@ async def cancel_after_tool(_request: ModelRequest, _ctx: ActionRunContext) -> M
     assert model_calls == 2
 
 
+class _NoopGenerateMiddleware(BaseMiddleware):
+    async def wrap_generate(
+        self,
+        params: GenerateHookParams,
+        ctx: GenerateMiddlewareContext,
+        next_fn: Callable[[GenerateHookParams, GenerateMiddlewareContext], Awaitable[ModelResponse]],
+    ) -> ModelResponse:
+        return await next_fn(params, ctx)
+
+
+def _five_noop_middleware() -> list[BaseMiddleware]:
+    return [_NoopGenerateMiddleware() for _ in range(5)]
+
+
+def _four_hundred_noop_middleware() -> list[BaseMiddleware]:
+    return [_NoopGenerateMiddleware() for _ in range(400)]
+
+
+async def _assert_no_extra_tasks(before: set[int]) -> None:
+    await asyncio.sleep(0.05)
+    still_running = [
+        task
+        for task in asyncio.all_tasks()
+        if id(task) not in before and task is not asyncio.current_task() and not task.done()
+    ]
+    assert still_running == []
+
+
+def _always_requests_tool(pm: ProgrammableModel, *, name: str = 'step') -> None:
+    def always_tool(_request: ModelRequest) -> ModelResponse:
+        return _model_calls_tool(name=name, ref=str(pm.request_count + 1))
+
+    pm.response_cb = always_tool
+
+
+@pytest.mark.asyncio
+async def test_generate_with_five_middleware_and_max_turns_50_returns_aborted_after_51_model_calls() -> None:
+    """ai.generate with five no-op middleware and max_turns=50 aborts after 51 model calls."""
+    ai = Genkit(model='programmableModel')
+    pm, _ = define_programmable_model(ai)
+
+    @ai.tool(name='step')
+    async def step() -> str:
+        return 'ok'
+
+    _always_requests_tool(pm)
+    response = await ai.generate(
+        prompt='keep going',
+        tools=['step'],
+        max_turns=50,
+        use=_five_noop_middleware(),
+    )
+
+    assert response.finish_reason == FinishReason.ABORTED
+    assert response.finish_message == 'Exceeded maximum tool call iterations (50)'
+    assert response.error is not None
+    assert response.error.status == 'ABORTED'
+    assert response.error.reason is RuntimeErrorReason.MAX_TURNS_EXCEEDED
+    assert pm.request_count == 51
+
+
+@pytest.mark.asyncio
+async def test_generate_stream_with_five_middleware_and_max_turns_50_returns_aborted_after_51_model_calls() -> None:
+    """ai.generate_stream with five no-op middleware and max_turns=50 closes aborted after 51 model calls."""
+    ai = Genkit(model='programmableModel')
+    pm, _ = define_programmable_model(ai)
+
+    @ai.tool(name='step')
+    async def step() -> str:
+        return 'ok'
+
+    _always_requests_tool(pm)
+    stream = ai.generate_stream(
+        prompt='keep going',
+        tools=['step'],
+        max_turns=50,
+        use=_five_noop_middleware(),
+    )
+    _ = [chunk async for chunk in stream]
+    response = await stream.response
+
+    assert response.finish_reason == FinishReason.ABORTED
+    assert response.finish_message == 'Exceeded maximum tool call iterations (50)'
+    assert response.error is not None
+    assert response.error.status == 'ABORTED'
+    assert response.error.reason is RuntimeErrorReason.MAX_TURNS_EXCEEDED
+    assert pm.request_count == 51
+
+
+@pytest.mark.asyncio
+async def test_generate_with_five_middleware_and_max_turns_200_returns_aborted() -> None:
+    """ai.generate with five middleware and max_turns=200 aborts at 200; no RecursionError."""
+    ai = Genkit(model='programmableModel')
+    pm, _ = define_programmable_model(ai)
+
+    @ai.tool(name='step')
+    async def step() -> str:
+        return 'ok'
+
+    _always_requests_tool(pm)
+    response = await ai.generate(
+        prompt='keep going',
+        tools=['step'],
+        max_turns=200,
+        use=_five_noop_middleware(),
+    )
+
+    assert response.finish_reason == FinishReason.ABORTED
+    assert response.finish_message == 'Exceeded maximum tool call iterations (200)'
+    assert response.error is not None
+    assert response.error.status == 'ABORTED'
+    assert response.error.reason is RuntimeErrorReason.MAX_TURNS_EXCEEDED
+    assert pm.request_count == 201
+
+
+@pytest.mark.asyncio
+async def test_generate_stream_with_five_middleware_and_max_turns_200_returns_aborted() -> None:
+    """ai.generate_stream with five middleware and max_turns=200 closes aborted at 200."""
+    ai = Genkit(model='programmableModel')
+    pm, _ = define_programmable_model(ai)
+
+    @ai.tool(name='step')
+    async def step() -> str:
+        return 'ok'
+
+    _always_requests_tool(pm)
+    stream = ai.generate_stream(
+        prompt='keep going',
+        tools=['step'],
+        max_turns=200,
+        use=_five_noop_middleware(),
+    )
+    _ = [chunk async for chun
```

---

### Incident Patch 5: `1a3413f3` (2026-10-05)
**Commit Message**: fix(py): evaluators can return one score or a list; embed_many applies ref config (#6498)

**File**: `py/packages/genkit-evaluators/tests/evaluators_test.py` (modified, +40/-10)
```diff
@@ -20,7 +20,13 @@
 from genkit_evaluators import register_genkit_evaluators
 
 from genkit import BaseDataPoint, Genkit
-from genkit.evaluator import EvalRequest
+from genkit.evaluator import EvalRequest, Score
+
+
+def _one_score(evaluation: Score | list[Score]) -> Score:
+    """Built-in evaluators return one Score for the row."""
+    assert isinstance(evaluation, Score)
+    return evaluation
 
 
 @pytest.fixture
@@ -47,9 +53,9 @@ async def test_deep_equal(ai: Genkit) -> None:
     resp = await eval_action.run(input=req)
     results = resp.response.root
     assert len(results) == 3
-    assert results[0].evaluation.score is True
-    assert results[1].evaluation.score is False
-    assert results[2].evaluation.error is not None
+    assert _one_score(results[0].evaluation).score is True
+    assert _one_score(results[1].evaluation).score is False
+    assert _one_score(results[2].evaluation).error is not None
 
 
 @pytest.mark.asyncio
@@ -69,9 +75,9 @@ async def test_regex(ai: Genkit) -> None:
     resp = await eval_action.run(input=req)
     results = resp.response.root
     assert len(results) == 3
-    assert results[0].evaluation.score is True
-    assert results[1].evaluation.score is False
-    assert results[2].evaluation.error is not None
+    assert _one_score(results[0].evaluation).score is True
+    assert _one_score(results[1].evaluation).score is False
+    assert _one_score(results[2].evaluation).error is not None
 
 
 @pytest.mark.asyncio
@@ -91,7 +97,31 @@ async def test_jsonata(ai: Genkit) -> None:
     resp = await eval_action.run(input=req)
     results = resp.response.root
     assert len(results) == 3
-    assert results[0].evaluation.score is not False and results[0].evaluation.score != ''
+    first = _one_score(results[0].evaluation)
+    assert first.score is not False and first.score != ''
     # age=31 with age 33 -> false or empty result -> FAIL
-    assert results[1].evaluation.score is False or results[1].evaluation.status == 'FAIL'
-    assert results[2].evaluation.error is not None
+    second = _one_score(results[1].evaluation)
+    assert second.score is False or second.status == 'FAIL'
+    assert _one_score(results[2].evaluation).error is not None
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    ('evaluator', 'datapoint'),
+    [
+        ('genkitEval/regex', {'input': 'sample', 'reference': 'ba?a?a', 'output': 'banana'}),
+        ('genkitEval/deep_equal', {'input': 'sample', 'reference': 'hello', 'output': 'hello'}),
+        ('genkitEval/jsonata', {'input': 'sample', 'reference': 'age=33', 'output': {'age': 33}}),
+    ],
+)
+async def test_built_in_evaluators_return_one_score(ai: Genkit, evaluator: str, datapoint: dict[str, object]) -> None:
+    """ai.evaluate with a built-in evaluator gives that row's evaluation as one Score."""
+    response = await ai.evaluate(
+        evaluator=evaluator,
+        dataset=[BaseDataPoint.model_validate({**datapoint, 'test_case_id': 'case1'})],
+    )
+
+    assert len(response.root) == 1
+    assert response.root[0].test_case_id == 'case1'
+    evaluation = _one_score(response.root[0].evaluation)
+    assert evaluation.status == 'PASS'
```

**File**: `py/packages/genkit/src/genkit/_ai/_aio.py` (modified, +27/-12)
```diff
@@ -974,6 +974,28 @@ def _resolve_embedder_name(self, embedder: str | EmbedderRef | None) -> str:
         else:
             raise ValueError('Embedder must be specified as a string name or an EmbedderRef.')
 
+    def _embedder_options(
+        self,
+        *,
+        embedder: str | EmbedderRef | None,
+        options: dict[str, object] | None,
+    ) -> dict[str, object]:
+        """Copy ref config plus version, then overlay call-site options.
+
+        The caller's EmbedderRef.config dict is left unchanged so they can
+        reuse the same ref on later embed / embed_many calls.
+        """
+        merged: dict[str, object] = {}
+        if isinstance(embedder, EmbedderRef):
+            config = embedder.config
+            if isinstance(config, dict):
+                merged.update(config)
+            if embedder.version:
+                merged['version'] = embedder.version
+        if options:
+            merged.update(options)
+        return merged
+
     # Overload: config=ModelConfigDict, output_schema=type[T] -> ModelResponse[T]
     @overload
     async def generate(
@@ -1413,16 +1435,7 @@ async def embed(
             vector = embeddings[0].embedding
         """
         embedder_name = self._resolve_embedder_name(embedder)
-        embedder_config: dict[str, object] = {}
-
-        # Extract config and version from EmbedderRef (not done for embed_many per JS behavior)
-        if isinstance(embedder, EmbedderRef):
-            embedder_config = embedder.config or {}
-            if embedder.version:
-                embedder_config['version'] = embedder.version  # Handle version from ref
-
-        # Merge options passed to embed() with config from EmbedderRef
-        final_options = {**(embedder_config or {}), **(options or {})}
+        final_options = self._embedder_options(embedder=embedder, options=options)
 
         embed_action = await self.registry.resolve_embedder(embedder_name)
         if embed_action is None:
@@ -1460,14 +1473,16 @@ async def embed_many(
             Document.from_text(item, metadata) if isinstance(item, str) else item for item in content
         ]
 
-        # Resolve embedder name (JS embedMany does not extract config/version from ref)
         embedder_name = self._resolve_embedder_name(embedder)
+        final_options = self._embedder_options(embedder=embedder, options=options)
 
         embed_action = await self.registry.resolve_embedder(embedder_name)
         if embed_action is None:
             raise ValueError(f'Embedder "{embedder_name}" not found')
 
-        response = (await embed_action.run(EmbedRequest(input=documents, options=options))).response  # type: ignore[arg-type]
+        response = (
+            await embed_action.run(EmbedRequest(input=documents, options=final_options))  # type: ignore[arg-type]
+        ).response
         return response.embeddings
 
     async def evaluate(
```

**File**: `py/packages/genkit/src/genkit/_core/_typing.py` (modified, +1/-1)
```diff
@@ -310,7 +310,7 @@ class EvalFnResponse(GenkitModel):
     test_case_id: str = Field(...)
     trace_id: str | None = None
     span_id: str | None = None
-    evaluation: Score = Field(...)
+    evaluation: Score | list[Score] = Field(...)
 
 
 class EvalRequest(GenkitModel):
```

**File**: `py/packages/genkit/tests/genkit/ai/embedding_test.py` (modified, +92/-0)
```diff
@@ -324,6 +324,98 @@ async def fake_embedder_fn(request: EmbedRequest) -> EmbedResponse:
     assert called_request.input == [Document.from_text('text1'), Document.from_text('text2')]
 
 
+@pytest.mark.asyncio
+async def test_embed_many_with_embedder_ref_merges_config_the_same_as_embed(
+    mock_genkit_instance: tuple[Genkit, MockGenkitRegistry],
+) -> None:
+    """embed_many with an EmbedderRef merges ref config, version, and options like embed."""
+    genkit_instance, registry = mock_genkit_instance
+
+    async def fake_embedder_fn(request: EmbedRequest) -> EmbedResponse:
+        return EmbedResponse(embeddings=[Embedding(embedding=[1.0]), Embedding(embedding=[2.0])])
+
+    registry.register_action(
+        name='my-plugin/my-embedder',
+        kind='embedder',
+        fn=fake_embedder_fn,
+        metadata=embedder_action_metadata('my-plugin/my-embedder').metadata,
+        description='A fake embedder for testing',
+    )
+    embedder_ref = create_embedder_ref('my-plugin/my-embedder', config={'param': 'value'}, version='v1')
+    content = [Document.from_text('one'), Document.from_text('two')]
+
+    response = await genkit_instance.embed_many(embedder=embedder_ref, content=content, options={'extra': True})
+
+    assert [item.embedding for item in response] == [[1.0], [2.0]]
+    embed_action = await registry.resolve_action('embedder', 'my-plugin/my-embedder')
+    called_request = embed_action.run.call_args[0][0]
+    assert isinstance(called_request, EmbedRequest)
+    assert called_request.input == content
+    assert called_request.options == {'param': 'value', 'version': 'v1', 'extra': True}
+
+
+@pytest.mark.asyncio
+async def test_embed_many_options_override_embedder_ref_config(
+    mock_genkit_instance: tuple[Genkit, MockGenkitRegistry],
+) -> None:
+    """embed_many options win over the same key on the EmbedderRef."""
+    genkit_instance, registry = mock_genkit_instance
+
+    async def fake_embedder_fn(request: EmbedRequest) -> EmbedResponse:
+        return EmbedResponse(embeddings=[Embedding(embedding=[1.0])])
+
+    registry.register_action(
+        name='override-embedder',
+        kind='embedder',
+        fn=fake_embedder_fn,
+        metadata=embedder_action_metadata('override-embedder').metadata,
+        description='A fake embedder for testing',
+    )
+    embedder_ref = create_embedder_ref('override-embedder', config={'param': 'from_ref'})
+
+    response = await genkit_instance.embed_many(
+        embedder=embedder_ref,
+        content=['hello'],
+        options={'param': 'override'},
+    )
+
+    assert response[0].embedding == [1.0]
+    embed_action = await registry.resolve_action('embedder', 'override-embedder')
+    called_request = embed_action.run.call_args[0][0]
+    assert called_request.options == {'param': 'override'}
+
+
+@pytest.mark.asyncio
+async def test_embed_many_does_not_change_the_embedder_ref_config(
+    mock_genkit_instance: tuple[Genkit, MockGenkitRegistry],
+) -> None:
+    """embed_many leaves the EmbedderRef config dict unchanged."""
+    genkit_instance, registry = mock_genkit_instance
+
+    async def fake_embedder_fn(request: EmbedRequest) -> EmbedResponse:
+        return EmbedResponse(embeddings=[Embedding(embedding=[1.0])])
+
+    registry.register_action(
+        name='stable-embedder',
+        kind='embedder',
+        fn=fake_embedder_fn,
+        metadata=embedder_action_metadata('stable-embedder').metadata,
+        description='A fake embedder for testing',
+    )
+    config = {'param': 'value'}
+    embedder_ref = create_embedder_ref('stable-embedder', config=config, version='v1')
+
+    await genkit_instance.embed_many(
+        embedder=embedder_ref,
+        content=['hello'],
+        options={'extra': True},
+    )
+
+    assert embedder_ref.config == {'param': 'value'}
+    assert embedder_ref.config is config
+    assert 'version' not in embedder_ref.config
+
+
 # --- Tests for _resolve_embedder_name helper ---
 
 
```

**File**: `py/packages/genkit/tests/genkit/veneer/veneer_test.py` (modified, +135/-11)
```diff
@@ -1754,7 +1754,7 @@ async def my_flow(input: str, ctx: ActionRunContext) -> str:
 
 @pytest.mark.asyncio
 async def test_evaluate(setup_test: SetupFixture) -> None:
-    """Test that the evaluate function works."""
+    """ai.evaluate reports a one-score evaluator's evaluation as that Score."""
     ai, _, _, *_ = setup_test
 
     async def my_eval_fn(datapoint: BaseDataPoint, options: object | None) -> EvalFnResponse:
@@ -1780,11 +1780,13 @@ async def my_eval_fn(datapoint: BaseDataPoint, options: object | None) -> EvalFn
     assert isinstance(response, EvalResponse)
     assert len(response.root) == 2
     assert response.root[0].test_case_id == 'case1'
-    assert isinstance(response.root[0].evaluation, Score)
-    assert response.root[0].evaluation.score is True
+    first = response.root[0].evaluation
+    assert isinstance(first, Score)
+    assert first.score is True
     assert response.root[1].test_case_id == 'case2'
-    assert isinstance(response.root[1].evaluation, Score)
-    assert response.root[1].evaluation.score is True
+    second = response.root[1].evaluation
+    assert isinstance(second, Score)
+    assert second.score is True
 
 
 @pytest.mark.asyncio
@@ -1819,13 +1821,135 @@ async def my_eval_fn(datapoint: BaseDataPoint, options: object | None) -> EvalFn
 
     assert isinstance(response, EvalResponse)
     assert len(response.root) == 2
-    first = response.root[0].evaluation
-    assert isinstance(first, Score)
-    assert first.status == EvalStatusEnum.FAIL
-    assert first.error is not None
+    failed = response.root[0].evaluation
+    assert isinstance(failed, Score)
+    assert failed.status == EvalStatusEnum.FAIL
+    assert failed.error is not None
     assert response.root[1].test_case_id == 'case2'
-    assert isinstance(response.root[1].evaluation, Score)
-    assert response.root[1].evaluation.score is True
+    passed = response.root[1].evaluation
+    assert isinstance(passed, Score)
+    assert passed.score is True
+
+
+@pytest.mark.asyncio
+async def test_evaluate_score_list_returns_those_scores(setup_test: SetupFixture) -> None:
+    """ai.evaluate reports an evaluator's list of scores as that list."""
+    ai, _, _, *_ = setup_test
+
+    async def my_eval_fn(datapoint: BaseDataPoint, options: object | None) -> EvalFnResponse:
+        return EvalFnResponse(
+            test_case_id=datapoint.test_case_id or '',
+            evaluation=[
+                Score(id='accuracy', score=0.9),
+                Score(id='fluency', score=0.8),
+            ],
+        )
+
+    ai.define_evaluator(
+        name='list_eval',
+        display_name='List evaluator',
+        definition='Returns two scores per sample',
+        fn=my_eval_fn,
+    )
+
+    response = await ai.evaluate(
+        evaluator='list_eval',
+        dataset=[BaseDataPoint(input='hi', output='hi', test_case_id='case1')],
+    )
+
+    assert isinstance(response, EvalResponse)
+    assert len(response.root) == 1
+    assert response.root[0].test_case_id == 'case1'
+    evaluation = response.root[0].evaluation
+    assert isinstance(evaluation, list)
+    assert [score.id for score in evaluation] == ['accuracy', 'fluency']
+    assert [score.score for score in evaluation] == [0.9, 0.8]
+
+
+@pytest.mark.asyncio
+async def test_evaluate_mixed_rows_keep_score_and_list(setup_test: SetupFixture) -> None:
+    """One row's Score and the next row's score list each come back in the shape the evaluator returned."""
+    ai, *_ = setup_test
+
+    async def my_eval_fn(datapoint: BaseDataPoint, options: object | None) -> EvalFnResponse:
+        if datapoint.test_case_id == 'case1':
+            return EvalFnResponse(test_case_id='case1', evaluation=Score(id='accuracy', score=0.9))
+        return EvalFnResponse(
+            test_case_id=datapoint.test_case_id or '',
+            evaluation=[Score(id='accuracy', score=0.9), Score(id='fluency', score=0.8)],
+        )
+
+    ai.define_evaluator(
+        name='mixed_eval',
+        display_name='Mixed evaluator',
+        definition='Returns a Score or a list depending on the row',
+        fn=my_eval_fn,
+    )
+
+    response = await ai.evaluate(
+        evaluator='mixed_eval',
+        dataset=[
+            BaseDataPoint(input='hi', output='hi', test_case_id='case1'),
+            BaseDataPoint(input='bye', output='bye', test_case_id='case2'),
+        ],
+    )
+
+    assert len(response.root) == 2
+    assert response.root[0].test_case_id == 'case1'
+    one = response.root[0].evaluation
+    assert isinstance(one, Score)
+    assert one.id == 'accuracy'
+    assert one.score == 0.9
+    assert response.root[1].test_case_id == 'case2'
+    many = response.root[1].evaluation
+    assert isinstance(many, list)
+    assert [score.id for score in many] == ['accuracy', 'fluency']
+    assert [score.score for score in many] == [0.9, 0.8]
+
+
+def test_eval_response_score_object_on_load_stays_score() -> None:
+    """A saved row whose evaluation is one score 
```

**File**: `py/scripts/schema_to_typing.py` (modified, +17/-3)
```diff
@@ -239,9 +239,23 @@ def _py_type(prop: dict, schema: dict, defs: dict, class_name: str, field_name:
     for key in ('anyOf', 'oneOf'):
         if key in prop:
             opts = prop[key]
-            refs = [o.get('$ref', '').split('/')[-1] for o in opts if o.get('$ref')]
-            if refs:
-                return ' | '.join(_output_name(r) for r in refs)
+            ref_names = [o.get('$ref', '').split('/')[-1] for o in opts if o.get('$ref')]
+            other = [o for o in opts if not o.get('$ref')]
+            if ref_names and not other:
+                return ' | '.join(_output_name(r) for r in ref_names)
+            if ref_names and other:
+                # One object or a list of them is a real value. Keeping only
+                # the ref branch would drop the list, so two scores could not come back.
+                parts: list[str] = []
+                for opt in opts:
+                    ref = opt.get('$ref')
+                    if ref:
+                        parts.append(_output_name(str(ref).split('/')[-1]))
+                        continue
+                    resolved = _py_type(opt, schema, defs, class_name, field_name)
+                    if resolved:
+                        parts.append(resolved)
+                return ' | '.join(parts) if parts else 'Any'
             types = sorted({_py_type(o, schema, defs, class_name, field_name) for o in opts} - {''})
             return ' | '.join(types) if types else 'Any'
     if prop.get('type') == 'array':
```

---

### Incident Patch 6: `8d02ddf4` (2026-10-02)
**Commit Message**: ci(workflows): gate the JS build and DevUI tests on changed areas (#6450)

**File**: `.github/workflows/builder.yml` (modified, +22/-3)
```diff
@@ -18,19 +18,38 @@ name: Build Check (Run npm run build everywhere locally if this fails)
 
 on: pull_request
 
+permissions:
+  contents: read
+
 env:
   GITHUB_PULL_REQUEST_HEAD_SHA: ${{ github.event.pull_request.head.sha }}
   GITHUB_PULL_REQUEST_BASE_SHA: ${{ github.event.pull_request.base.sha }}
 
 jobs:
+  changes:
+    uses: ./.github/workflows/changes.yml
+    permissions:
+      pull-requests: read
+
   build:
     name: Run build tasks
+    needs: changes
+    # Builds js/ and genkit-tools/, then runs the JS tests (which read tests/specs).
+    # A failed detection still runs the build; see changes.yml.
+    if: >-
+      ${{ !cancelled() && (needs.changes.result != 'success' ||
+      needs.changes.outputs.js == 'true' ||
+      needs.changes.outputs.tools == 'true' ||
+      needs.changes.outputs.specs == 'true' ||
+      needs.changes.outputs.other == 'true') }}
     runs-on: ubuntu-latest
     steps:
-    - uses: actions/checkout@v5
-    - uses: pnpm/action-setup@v4
+    - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5.1.0
+      with:
+        persist-credentials: false
+    - uses: pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v4.4.0
     - name: Set up node v20
-      uses: actions/setup-node@v6
+      uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6.5.0
       with:
         node-version: 20.x
         cache: pnpm
```

**File**: `.github/workflows/changes.yml` (added, +113/-0)
```diff
@@ -0,0 +1,113 @@
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
+# Reports which areas of the repo a pull request touches, one boolean output
+# per area. Any path outside the named areas sets `other`, so root config,
+# workflows, and new top-level directories run everything.
+#
+# Use this for jobs that back required status checks. A workflow skipped by
+# `on.<event>.paths` leaves its required checks pending forever, while a job
+# skipped by `if:` reports success. Workflows without required checks should
+# keep using `on.<event>.paths`.
+#
+# Usage:
+#
+#   jobs:
+#     changes:
+#       uses: ./.github/workflows/changes.yml
+#       permissions:
+#         pull-requests: read
+#     build:
+#       needs: changes
+#       if: >-
+#         ${{ !cancelled() && (needs.changes.result != 'success' ||
+#         needs.changes.outputs.js == 'true' ||
+#         needs.changes.outputs.other == 'true') }}
+#
+# The caller grants `pull-requests: read` because the repo's default token has
+# none, and a called workflow cannot raise its own permissions.
+#
+# Checking `needs.changes.result` makes a detection failure run the job
+# instead of skipping it, which would otherwise pass the required check.
+
+name: Changed areas
+
+on:
+  workflow_call:
+    outputs:
+      go:
+        description: "go/**"
+        value: ${{ jobs.detect.outputs.go }}
+      js:
+        description: "js/**"
+        value: ${{ jobs.detect.outputs.js }}
+      python:
+        description: "py/**"
+        value: ${{ jobs.detect.outputs.python }}
+      tools:
+        description: "genkit-tools/** (CLI, Dev UI server, telemetry server)"
+        value: ${{ jobs.detect.outputs.tools }}
+      samples:
+        description: "samples/**"
+        value: ${{ jobs.detect.outputs.samples }}
+      specs:
+        description: "tests/specs/** (cross-runtime conformance specs)"
+        value: ${{ jobs.detect.outputs.specs }}
+      other:
+        description: "Any path outside the areas above."
+        value: ${{ jobs.detect.outputs.other }}
+
+jobs:
+  detect:
+    name: Detect changed areas
+    runs-on: ubuntu-latest
+    permissions:
+      pull-requests: read
+    outputs:
+      go: ${{ steps.areas.outputs.go }}
+      js: ${{ steps.areas.outputs.js }}
+      python: ${{ steps.areas.outputs.python }}
+      tools: ${{ steps.areas.outputs.tools }}
+      samples: ${{ steps.areas.outputs.samples }}
+      specs: ${{ steps.areas.outputs.specs }}
+      other: ${{ steps.other.outputs.other }}
+    steps:
+      - id: areas
+        uses: dorny/paths-filter@ceb8a2b8f2d89434be7ff52d3de7ec3738c5cc9d # v4.0.3
+        with:
+          filters: |
+            go: go/**
+            js: js/**
+            python: py/**
+            tools: genkit-tools/**
+            samples: samples/**
+            specs: tests/specs/**
+
+      # Keep the exclusions in sync with the areas above. `every` means a file
+      # counts only if it matches `**` and none of the exclusions.
+      - id: other
+        uses: dorny/paths-filter@ceb8a2b8f2d89434be7ff52d3de7ec3738c5cc9d # v4.0.3
+        with:
+          predicate-quantifier: every
+          filters: |
+            other:
+              - "**"
+              - "!go/**"
+              - "!js/**"
+              - "!py/**"
+              - "!genkit-tools/**"
+              - "!samples/**"
+              - "!tests/specs/**"
```

**File**: `.github/workflows/go.yml` (modified, +9/-4)
```diff
@@ -21,8 +21,11 @@ on:
     paths:
       - "go/**"
       - "genkit-tools/**"
+      - "tests/specs/**"
       - ".github/workflows/go.yml"
 
+permissions:
+  contents: read
 
 jobs:
   tests:
@@ -32,12 +35,14 @@ jobs:
         go-version: ['1.25.x', '1.26.x']
     steps:
       - name: Checkout Repo
-        uses: actions/checkout@main
+        uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6.1.0
+        with:
+          persist-credentials: false
 
-      - uses: pnpm/action-setup@v4
+      - uses: pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v4.4.0
 
       - name: Set up Node
-        uses: actions/setup-node@v6
+        uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6.5.0
         with:
           node-version: 20.x
           cache: 'pnpm'
@@ -54,7 +59,7 @@ jobs:
         run: npm --prefix genkit-tools run export:schemas
 
       - name: Set up Go
-        uses: actions/setup-go@main
+        uses: actions/setup-go@924ae3a1cded613372ab5595356fb5720e22ba16 # v6.5.0
         with:
           go-version: ${{ matrix.go-version }}
 
```

**File**: `.github/workflows/tests.yml` (modified, +20/-3)
```diff
@@ -18,19 +18,36 @@ name: Run Tests
 
 on: pull_request
 
+permissions:
+  contents: read
+
 env:
   GITHUB_PULL_REQUEST_HEAD_SHA: ${{ github.event.pull_request.head.sha }}
   GITHUB_PULL_REQUEST_BASE_SHA: ${{ github.event.pull_request.base.sha }}
 
 jobs:
+  changes:
+    uses: ./.github/workflows/changes.yml
+    permissions:
+      pull-requests: read
+
   build:
     name: Run Tests (just DevUI tests for now)
+    needs: changes
+    # Builds and tests genkit-tools/ only.
+    # A failed detection still runs the tests; see changes.yml.
+    if: >-
+      ${{ !cancelled() && (needs.changes.result != 'success' ||
+      needs.changes.outputs.tools == 'true' ||
+      needs.changes.outputs.other == 'true') }}
     runs-on: ubuntu-latest
     steps:
-    - uses: actions/checkout@v5
-    - uses: pnpm/action-setup@v4
+    - uses: actions/checkout@fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09 # v5.1.0
+      with:
+        persist-credentials: false
+    - uses: pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v4.4.0
     - name: Set up node v20
-      uses: actions/setup-node@v6
+      uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6.5.0
       with:
         node-version: 20.x
         cache: pnpm
```

---

### Incident Patch 7: `99876fef` (2026-10-01)
**Commit Message**: fix(cli): set non-zero exit codes on command failures (#6482)

**File**: `genkit-tools/cli/src/cli.ts` (modified, +3/-2)
```diff
@@ -162,8 +162,9 @@ export async function startCLI(): Promise<void> {
   }
   // Handle unknown commands.
   program.on('command:*', (operands) => {
-    logger.error(`error: unknown command '${operands[0]}'`);
-    logger.info(program.help());
+    logger.error(`unknown command '${operands[0]}'`);
+    // helpInformation() returns the help text. help() would exit with code 0.
+    logger.info(program.helpInformation());
     process.exit(1);
   });
 
```

**File**: `genkit-tools/cli/src/commands/config.ts` (modified, +3/-0)
```diff
@@ -64,6 +64,7 @@ config
       logger.error(
         `Unknown config tag "${clc.bold(tag)}".\nValid options: ${readableTagsHint()}`
       );
+      process.exitCode = 1;
       return;
     }
 
@@ -85,6 +86,7 @@ config
       logger.error(
         `Unknown config tag "${clc.bold(tag)}".\nValid options: ${readableTagsHint()}`
       );
+      process.exitCode = 1;
       return;
     }
 
@@ -93,6 +95,7 @@ config
       parsedValue = CONFIG_TAGS[tag](value);
     } catch (e: any) {
       logger.error(`Invalid type for "${clc.bold(tag)}".\n${e.message}`);
+      process.exitCode = 1;
       return;
     }
 
```

**File**: `genkit-tools/cli/src/commands/docs.ts` (modified, +4/-0)
```diff
@@ -54,6 +54,7 @@ export const docsList = new Command('docs:list')
       logger.error(
         `Failed to load documentation: ${e instanceof Error ? e.message : String(e)}`
       );
+      process.exitCode = 1;
     }
   });
 
@@ -94,6 +95,7 @@ export const docsSearch = new Command('docs:search')
       logger.error(
         `Failed to load documentation: ${e instanceof Error ? e.message : String(e)}`
       );
+      process.exitCode = 1;
     }
   });
 
@@ -106,6 +108,7 @@ export const docsRead = new Command('docs:read')
       const doc = documents[filePath];
       if (!doc) {
         logger.error(`Document not found: ${filePath}`);
+        process.exitCode = 1;
         return;
       }
 
@@ -117,5 +120,6 @@ export const docsRead = new Command('docs:read')
       logger.error(
         `Failed to load documentation: ${e instanceof Error ? e.message : String(e)}`
       );
+      process.exitCode = 1;
     }
   });
```

**File**: `genkit-tools/cli/src/commands/log-list.ts` (modified, +1/-0)
```diff
@@ -159,6 +159,7 @@ export const logList = new Command('log:list')
         }
       } catch (e) {
         logger.error(`Error listing logs: ${e}`);
+        process.exitCode = 1;
       }
     };
 
```

**File**: `genkit-tools/cli/src/commands/plugins.ts` (modified, +1/-0)
```diff
@@ -85,6 +85,7 @@ function pluginToCommander(p: ToolPlugin): Command {
   // Default action to catch unknown commands.
   cmd.action((_, { args }: { args: string[] }) => {
     logger.error(`"${clc.bold(args[0])}" is not a known ${p.name} command.`);
+    process.exitCode = 1;
   });
   return cmd;
 }
```

**File**: `genkit-tools/cli/src/commands/trace-get.ts` (modified, +2/-0)
```diff
@@ -55,6 +55,7 @@ export const traceGet = new Command('trace:get')
         const response = await manager.getTrace({ traceId });
         if (!response) {
           logger.error(`Trace with ID '${traceId}' not found.`);
+          process.exitCode = 1;
           return;
         }
 
@@ -73,6 +74,7 @@ export const traceGet = new Command('trace:get')
         }
       } catch (e) {
         logger.error(`Error retrieving trace: ${e}`);
+        process.exitCode = 1;
       }
     };
 
```

**File**: `genkit-tools/cli/src/commands/trace-list.ts` (modified, +1/-0)
```diff
@@ -150,6 +150,7 @@ export const traceList = new Command('trace:list')
         );
       } catch (e) {
         logger.error(`Error listing traces: ${e}`);
+        process.exitCode = 1;
       }
     };
 
```

**File**: `genkit-tools/cli/src/utils/manager-utils.ts` (modified, +12/-4)
```diff
@@ -379,9 +379,15 @@ export async function runWithManager(
     }
     await fn(manager);
   } catch (err) {
+    process.exitCode = 1;
     logger.error('Command exited with an Error:');
     const error = err as GenkitToolsError;
-    if (typeof error.data === 'object') {
+    if (
+      error &&
+      typeof error === 'object' &&
+      typeof error.data === 'object' &&
+      error.data !== null
+    ) {
       const errorStatus = error.data as Status;
       const { code, details, message } = errorStatus;
       logger.error(`\tCode: ${code}`);
@@ -390,10 +396,12 @@ export async function runWithManager(
         logger.error(`\tTrace ID: ${details.traceId}\n`);
       }
     } else {
-      logger.error(`\tMessage: ${error.data}\n`);
+      logger.error(
+        `\tMessage: ${error?.data ?? error?.message ?? String(err)}\n`
+      );
     }
-    logger.error('Stack trace:');
-    logger.error(`${error.stack}`);
+    logger.debug('Stack trace:');
+    logger.debug(`${error?.stack ?? ''}`);
   } finally {
     if (manager) {
       await manager.stop();
```

---

### Incident Patch 8: `dc15034b` (2026-10-01)
**Commit Message**: fix(cli): require option values and validate flag inputs (#6481)

**File**: `genkit-tools/cli/src/commands/eval-extract-data.ts` (modified, +14/-7)
```diff
@@ -30,10 +30,11 @@ import * as clc from 'colorette';
 import { Command } from 'commander';
 import { writeFile } from 'fs/promises';
 import { runWithManager } from '../utils/manager-utils';
+import { parsePositiveInt } from '../utils/option-parsers';
 
 interface EvalDatasetOptions {
   output?: string;
-  maxRows: string;
+  maxRows: number;
   label?: string;
 }
 
@@ -45,9 +46,15 @@ export const evalExtractData = new Command('eval:extractData')
     '--output <filename>',
     'name of the output file to store the extracted data'
   )
-  .option('--maxRows <maxRows>', 'maximum number of rows', '100')
-  .option('--label [label]', 'only extract traces with this batchRun label')
+  .option(
+    '--maxRows <maxRows>',
+    'maximum number of rows',
+    parsePositiveInt,
+    100
+  )
+  .option('--label <label>', 'only extract traces with this batchRun label')
   .action(async (flowName: string, options: EvalDatasetOptions) => {
+    const { maxRows } = options;
     const dashDashIndex = process.argv.indexOf('--');
     let runtimeCommand: string[] | undefined;
     if (dashDashIndex !== -1) {
@@ -62,9 +69,9 @@ export const evalExtractData = new Command('eval:extractData')
       logger.debug(`Extracting trace data '/flow/${flowName}'...`);
       let dataset: EvalInputDataset = [];
       let continuationToken = undefined;
-      while (dataset.length < Number.parseInt(options.maxRows)) {
+      while (dataset.length < maxRows) {
         const response = await manager.listTraces({
-          limit: Number.parseInt(options.maxRows),
+          limit: maxRows,
           continuationToken,
         });
         continuationToken = response.continuationToken;
@@ -99,8 +106,8 @@ export const evalExtractData = new Command('eval:extractData')
           })
           .filter((result): result is EvalInput => !!result);
         batch.forEach((d) => dataset.push(d));
-        if (dataset.length > Number.parseInt(options.maxRows)) {
-          dataset = dataset.splice(0, Number.parseInt(options.maxRows));
+        if (dataset.length > maxRows) {
+          dataset = dataset.splice(0, maxRows);
           break;
         }
         if (!continuationToken) {
```

**File**: `genkit-tools/cli/src/commands/eval-flow.ts` (modified, +11/-9)
```diff
@@ -38,8 +38,9 @@ import {
   logger,
 } from '@genkit-ai/tools-common/utils';
 import * as clc from 'colorette';
-import { Command } from 'commander';
+import { Command, Option } from 'commander';
 import { runWithManager } from '../utils/manager-utils';
+import { parseJson, parsePositiveInt } from '../utils/option-parsers';
 
 interface EvalFlowRunCliOptions {
   input?: string;
@@ -70,25 +71,26 @@ export const evalFlow = new Command('eval:flow')
     '--input <input>',
     'Input dataset ID or JSON file to be used for evaluation'
   )
-  .option('-c, --context <JSON>', 'JSON object passed to context', '')
+  .option('-c, --context <JSON>', 'JSON object passed to context', (val) =>
+    JSON.stringify(parseJson(val))
+  )
   .option(
     '-o, --output <filename>',
     'Name of the output file to write evaluation results'
   )
-  // TODO: Figure out why passing a new Option with choices doesn't work
-  .option(
-    '--output-format <format>',
-    'The output file format (csv, json)',
-    'json'
+  .addOption(
+    new Option('--output-format <format>', 'The output file format')
+      .choices(['json', 'csv'])
+      .default('json')
   )
   .option(
     '-e, --evaluators <evaluators>',
     'comma separated list of evaluators to use (by default uses all)'
   )
   .option(
     '--batchSize <batchSize>',
-    'batch size to use for parallel evals (default to 1, no parallelization)',
-    Number.parseInt
+    'batch size to use for parallel evals (defaults to 1, no parallelization)',
+    parsePositiveInt
   )
   .option('-f, --force', 'Automatically accept all interactive prompts')
   .action(
```

**File**: `genkit-tools/cli/src/commands/eval-run.ts` (modified, +8/-7)
```diff
@@ -30,8 +30,9 @@ import {
   logger,
 } from '@genkit-ai/tools-common/utils';
 import * as clc from 'colorette';
-import { Command } from 'commander';
+import { Command, Option } from 'commander';
 import { runWithManager } from '../utils/manager-utils';
+import { parsePositiveInt } from '../utils/option-parsers';
 
 interface EvalRunCliOptions {
   output?: string;
@@ -53,19 +54,19 @@ export const evalRun = new Command('eval:run')
     '--output <filename>',
     'name of the output file to write evaluation results'
   )
-  .option(
-    '--output-format <format>',
-    'The output file format (csv, json)',
-    'json'
+  .addOption(
+    new Option('--output-format <format>', 'The output file format')
+      .choices(['json', 'csv'])
+      .default('json')
   )
   .option(
     '--evaluators <evaluators>',
     'comma separated list of evaluators to use (by default uses all)'
   )
   .option(
     '--batchSize <batchSize>',
-    'batch size to use for parallel evals (default to 1, no parallelization)',
-    Number.parseInt
+    'batch size to use for parallel evals (defaults to 1, no parallelization)',
+    parsePositiveInt
   )
   .option('--force', 'Automatically accept all interactive prompts')
   .action(async (dataset: string, options: EvalRunCliOptions) => {
```

**File**: `genkit-tools/cli/src/commands/flow-batch-run.ts` (modified, +5/-4)
```diff
@@ -20,11 +20,12 @@ import * as clc from 'colorette';
 import { Command, Option } from 'commander';
 import { readFile, writeFile } from 'fs/promises';
 import { runWithManager } from '../utils/manager-utils';
+import { parseJson } from '../utils/option-parsers';
 
 interface FlowBatchRunOptions {
   output?: string;
   label?: string;
-  context?: string;
+  context?: any;
 }
 
 /** Command to run flows with batch input. */
@@ -44,9 +45,9 @@ export const flowBatchRun = new Command('flow:batchRun')
       .default(false)
       .hideHelp()
   )
-  .option('-c, --context <JSON>', 'JSON object passed to context', '')
+  .option('-c, --context <JSON>', 'JSON object passed to context', parseJson)
   .option('--output <filename>', 'name of the output file to store the output')
-  .option('--label [label]', 'label flow run in this batch')
+  .option('--label <label>', 'label flow run in this batch')
   .action(
     async (
       flowName: string,
@@ -93,7 +94,7 @@ export const flowBatchRun = new Command('flow:batchRun')
           const response = await manager.runAction({
             key: `/flow/${flowName}`,
             input: data,
-            context: options.context ? JSON.parse(options.context) : undefined,
+            context: options.context,
             telemetryLabels: options.label
               ? { batchRun: options.label }
               : undefined,
```

**File**: `genkit-tools/cli/src/commands/flow-run.ts` (modified, +17/-5)
```diff
@@ -20,11 +20,12 @@ import * as clc from 'colorette';
 import { Command, Option } from 'commander';
 import { writeFile } from 'fs/promises';
 import { runWithManager } from '../utils/manager-utils';
+import { parseJson } from '../utils/option-parsers';
 
 interface FlowRunOptions {
   output?: string;
   stream?: boolean;
-  context?: string;
+  context?: any;
 }
 
 /** Command to run a flow. */
@@ -43,7 +44,7 @@ export const flowRun = new Command('flow:run')
       .hideHelp()
   )
   .option('-s, --stream', 'Stream output', false)
-  .option('-c, --context <JSON>', 'JSON object passed to context', '')
+  .option('-c, --context <JSON>', 'JSON object passed to context', parseJson)
   .option(
     '--output <filename>',
     'name of the output file to write the flow result'
@@ -70,15 +71,26 @@ export const flowRun = new Command('flow:run')
       }
     }
 
+    let parsedInput: any;
+    if (actualData) {
+      try {
+        parsedInput = parseJson(actualData);
+      } catch (e: any) {
+        logger.error(`Invalid JSON in [data]: ${e?.message ?? String(e)}`);
+        process.exitCode = 1;
+        return;
+      }
+    }
+
     const projectRoot = await findProjectRoot();
 
     const runAction = async (manager: BaseRuntimeManager) => {
       let traceId: string | undefined;
       const response = await manager.runAction(
         {
           key: `/flow/${flowName}`,
-          input: actualData ? JSON.parse(actualData) : undefined,
-          context: options.context ? JSON.parse(options.context) : undefined,
+          input: parsedInput,
+          context: options.context,
         },
         options.stream
           ? (chunk) => console.log(JSON.stringify(chunk, undefined, '  '))
@@ -100,7 +112,7 @@ export const flowRun = new Command('flow:run')
         logger.info(`${clc.cyan('Trace ID:')} ${traceId}`);
       }
 
-      if (options.output && result) {
+      if (options.output && result !== undefined) {
         await writeFile(options.output, JSON.stringify(result, undefined, ' '));
       }
     };
```

**File**: `genkit-tools/cli/src/commands/log-list.ts` (modified, +9/-11)
```diff
@@ -23,9 +23,10 @@ import {
 } from '@genkit-ai/tools-common/utils';
 import { Command, Option } from 'commander';
 import { runWithManager } from '../utils/manager-utils';
+import { parsePositiveInt } from '../utils/option-parsers';
 
 export interface LogListOptions {
-  limit: string;
+  limit: number;
   traceId?: string;
   spanId?: string;
   severity?: string;
@@ -41,7 +42,12 @@ export const logList = new Command('log:list')
   .description(
     'list logs, in reverse chronological order. Filtering by trace-id is highly recommended.'
   )
-  .option('-l, --limit <number>', 'limit the number of returned logs', '15')
+  .option(
+    '-l, --limit <number>',
+    'limit the number of returned logs',
+    parsePositiveInt,
+    15
+  )
   .option('--trace-id <id>', 'filter by trace ID')
   .option('--span-id <id>', 'filter by span ID')
   .option(
@@ -85,16 +91,8 @@ export const logList = new Command('log:list')
           }
         }
 
-        const limit = Number.parseInt(options.limit, 10);
-        if (Number.isNaN(limit) || limit <= 0) {
-          logger.error(
-            `Invalid limit: "${options.limit}". It must be a positive integer.`
-          );
-          return;
-        }
-
         const listRequest = {
-          limit,
+          limit: options.limit,
           continuationToken: options.continuationToken,
           filter: Object.keys(filter).length > 0 ? filter : undefined,
         };
```

**File**: `genkit-tools/cli/src/commands/mcp.ts` (modified, +7/-5)
```diff
@@ -21,21 +21,23 @@ import {
 } from '@genkit-ai/tools-common/utils';
 import { Command } from 'commander';
 import { startMcpServer } from '../mcp/server';
+import { parseNonNegativeInt } from '../utils/option-parsers';
 
 interface McpOptions {
   projectRoot?: string;
   debug?: boolean | string;
   explicitProjectRoot?: boolean;
-  timeout?: string;
+  timeout?: number;
 }
 
 /** Command to run MCP server. */
 export const mcp = new Command('mcp')
-  .option('--project-root [projectRoot]', 'Project root')
+  .option('--project-root <projectRoot>', 'Project root')
   .option('-d, --debug [path]', 'debug to file')
   .option(
-    '--timeout [timeout]',
-    'Timeout for runtime to start (ms). Default 30000.'
+    '--timeout <timeout>',
+    'Timeout for runtime to start (ms). Default 30000.',
+    parseNonNegativeInt
   )
   .option(
     '--explicitProjectRoot',
@@ -53,6 +55,6 @@ export const mcp = new Command('mcp')
     await startMcpServer({
       projectRoot: options.projectRoot ?? (await findProjectRoot()),
       explicitProjectRoot: options.explicitProjectRoot ?? false,
-      timeout: options.timeout ? parseInt(options.timeout, 10) : undefined,
+      timeout: options.timeout,
     });
   });
```

**File**: `genkit-tools/cli/src/commands/start-flutter.ts` (modified, +6/-12)
```diff
@@ -20,19 +20,21 @@ import { Command } from 'commander';
 import getPort, { makeRange } from 'get-port';
 import open from 'open';
 import { getDevEnvVars, startDevProcessManager } from '../utils/manager-utils';
+import { parsePort } from '../utils/option-parsers';
 
 interface FlutterRunOptions {
-  port?: string;
+  port?: number;
   open?: boolean;
   corsOrigin?: string;
   noui?: boolean;
+  disableRealtimeTelemetry?: boolean;
 }
 
 /** Command to run a Flutter app in dev mode and/or the Dev UI. */
 export const startFlutter = new Command('start:flutter')
   .description('runs a flutter app in Genkit dev mode')
   .option('-n, --noui', 'do not start the Dev UI', false)
-  .option('-p, --port <port>', 'port for the Dev UI')
+  .option('-p, --port <port>', 'port for the Dev UI', parsePort)
   .option('-o, --open', 'Open the browser on UI start up')
   .option(
     '--disable-realtime-telemetry',
@@ -77,16 +79,8 @@ export const startFlutter = new Command('start:flutter')
     );
 
     if (!options.noui) {
-      let port: number;
-      if (options.port) {
-        port = Number(options.port);
-        if (isNaN(port) || port < 0) {
-          logger.error(`"${options.port}" is not a valid port number`);
-          return;
-        }
-      } else {
-        port = await getPort({ port: makeRange(4000, 4099) });
-      }
+      const port =
+        options.port ?? (await getPort({ port: makeRange(4000, 4099) }));
       startServer(manager, port);
       if (options.open) {
         open(`http://localhost:${port}`);
```

---

### Incident Patch 9: `41b8dc5b` (2026-10-01)
**Commit Message**: fix(cli): clean up help text, docs languages, and deprecate ui:start and ui:stop (#6480)

**File**: `genkit-tools/cli/README.md` (modified, +39/-15)
```diff
@@ -20,42 +20,66 @@ To install the CLI:
 npm install -g genkit-cli
 ```
 
-Available commands:
+Available commands (run `genkit help <command>` for the options of each command):
 
-- `init [options]`
+- `start [options] [-- <command...>]`
 
-  initialize a project directory with Genkit
+  run a command in Genkit dev mode and start the Developer UI
 
-- `start [options]`
+- `start:flutter [options]`
 
-  run the app in dev mode and start a Developer UI
+  run a Flutter app in Genkit dev mode
 
-- `flow:run [options] <flowName> [data]`
+- `flow:run [options] <flowName> [data] [-- <command...>]`
 
   run a flow using provided data as input
 
-- `flow:batchRun [options] <flowName> <inputFileName>`
+- `flow:batchRun [options] <flowName> <inputFileName> [-- <command...>]`
 
   batch run a flow using provided set of data from a file as input
 
-- `flow:resume <flowName> <flowId> <data>`
-
-  resume an interrupted flow (experimental)
-
 - `eval:extractData [options] <flowName>`
 
-  extract evaludation data for a given flow from the trace store
+  extract evaluation data for a given flow from the trace store
 
-- `eval:run [options] <dataset>`
+- `eval:run [options] <dataset> [-- <command...>]`
 
   evaluate provided dataset against configured evaluators
 
-- `eval:flow [options] <flowName> [data]`
+- `eval:flow [options] <flowName> [data] [-- <command...>]`
 
   evaluate a flow against configured evaluators using provided data as input
 
+- `trace:list [options]`
+
+  list traces
+
+- `trace:get [options] <traceId>`
+
+  get a trace by id
+
+- `log:list [options]`
+
+  list logs, in reverse chronological order
+
+- `docs:list [language]`, `docs:search <query> [language]`, `docs:read <filePath>`
+
+  list, search, and read Genkit documentation
+
+- `init:ai-tools [options]`
+
+  initialize AI tools in a workspace with context about Genkit (experimental)
+
+- `mcp [options]`
+
+  run the Genkit MCP stdio server (experimental)
+
+- `dev:test-model [options] [modelOrCmd] [args...]`
+
+  test a model against the Genkit model specification
+
 - `config`
 
   set development environment configuration
 
-- `help`
+- `help [command]`
```

**File**: `genkit-tools/cli/src/cli.ts` (modified, +6/-6)
```diff
@@ -146,7 +146,12 @@ export async function startCLI(): Promise<void> {
     program.addCommand(serverHarness);
   }
 
-  for (const command of commands) program.addCommand(command);
+  const deprecatedCommands = new Set([uiStart, uiStop]);
+  for (const command of commands) {
+    program.addCommand(command, {
+      hidden: deprecatedCommands.has(command),
+    });
+  }
   for (const command of await getPluginCommands()) program.addCommand(command);
 
   for (const cmd of ToolPluginSubCommandsSchema.keyof().options) {
@@ -155,11 +160,6 @@ export async function startCLI(): Promise<void> {
       program.addCommand(command);
     }
   }
-  program.addCommand(
-    new Command('help').action(() => {
-      logger.info(program.help());
-    })
-  );
   // Handle unknown commands.
   program.on('command:*', (operands) => {
     logger.error(`error: unknown command '${operands[0]}'`);
```

**File**: `genkit-tools/cli/src/commands/config.ts` (modified, +8/-6)
```diff
@@ -57,11 +57,12 @@ export const config = new Command('config');
 config
   .description('set development environment configuration')
   .command('get')
+  .description('get a development environment configuration value')
   .argument('<tag>', `The config tag to get. One of [${readableTagsHint()}]`)
   .action((tag) => {
-    if (!CONFIG_TAGS[tag]) {
+    if (!Object.prototype.hasOwnProperty.call(CONFIG_TAGS, tag)) {
       logger.error(
-        `Unknown config tag "${clc.bold(tag)}.\nValid options: ${readableTagsHint()}`
+        `Unknown config tag "${clc.bold(tag)}".\nValid options: ${readableTagsHint()}`
       );
       return;
     }
@@ -76,12 +77,13 @@ config
 
 config
   .command('set')
-  .argument('<tag>', `The config tag to get. One of [${readableTagsHint()}]`)
+  .description('set a development environment configuration value')
+  .argument('<tag>', `The config tag to set. One of [${readableTagsHint()}]`)
   .argument('<value>', 'The value to set tag to')
   .action(async (tag, value) => {
-    if (!CONFIG_TAGS[tag]) {
+    if (!Object.prototype.hasOwnProperty.call(CONFIG_TAGS, tag)) {
       logger.error(
-        `Unknown config tag "${clc.bold(tag)}.\nValid options: ${readableTagsHint()}`
+        `Unknown config tag "${clc.bold(tag)}".\nValid options: ${readableTagsHint()}`
       );
       return;
     }
@@ -90,7 +92,7 @@ config
     try {
       parsedValue = CONFIG_TAGS[tag](value);
     } catch (e: any) {
-      logger.error(`Invalid type for "${clc.bold(tag)}.\n${e.message}`);
+      logger.error(`Invalid type for "${clc.bold(tag)}".\n${e.message}`);
       return;
     }
 
```

**File**: `genkit-tools/cli/src/commands/dev-test-model.ts` (modified, +1/-1)
```diff
@@ -637,7 +637,7 @@ export const devTestModel = new Command('dev:test-model')
   .argument('[args...]', 'Command arguments')
   .option(
     '--supports <list>',
-    'Comma-separated list of supported capabilities (tool-request, structured-output, multiturn, system-role, input-image-base64, input-image-url, input-video-youtube, output-audio, output-image, streaming-multiturn, reasoning)',
+    `Comma-separated list of supported capabilities (${Object.keys(TEST_CASES).join(', ')})`,
     'tool-request,structured-output,multiturn,system-role,input-image-base64,input-image-url,streaming-multiturn,streaming-tool-request,streaming-structured-output'
   )
   .option('--from-file <file>', 'Path to a file containing test payloads')
```

**File**: `genkit-tools/cli/src/commands/docs.ts` (modified, +10/-2)
```diff
@@ -21,7 +21,11 @@ import { loadDocs, searchDocs } from '../utils/docs';
 
 export const docsList = new Command('docs:list')
   .description('list available Genkit documentation files')
-  .argument('[language]', 'language to list docs for (js, go, python)', 'js')
+  .argument(
+    '[language]',
+    'language to list docs for (js, go, python, dart)',
+    'js'
+  )
   .action(async (language) => {
     try {
       const documents = await loadDocs();
@@ -59,7 +63,11 @@ export const docsSearch = new Command('docs:search')
     '<query>',
     'keywords to search for. For multiple keywords, enclose in quotes. E.g. "stream flows"'
   )
-  .argument('[language]', 'language to search docs for (js, go, python)', 'js')
+  .argument(
+    '[language]',
+    'language to search docs for (js, go, python, dart)',
+    'js'
+  )
   .action(async (query, language) => {
     try {
       const documents = await loadDocs();
```

**File**: `genkit-tools/cli/src/commands/eval-extract-data.ts` (modified, +3/-3)
```diff
@@ -39,14 +39,14 @@ interface EvalDatasetOptions {
 
 /** Command to extract evaluation data. */
 export const evalExtractData = new Command('eval:extractData')
-  .description('extract evaludation data for a given flow from the trace store')
-  .argument('<flowName>', 'name of the flow to run')
+  .description('extract evaluation data for a given flow from the trace store')
+  .argument('<flowName>', 'name of the flow to extract data for')
   .option(
     '--output <filename>',
     'name of the output file to store the extracted data'
   )
   .option('--maxRows <maxRows>', 'maximum number of rows', '100')
-  .option('--label [label]', 'label flow run in this batch')
+  .option('--label [label]', 'only extract traces with this batchRun label')
   .action(async (flowName: string, options: EvalDatasetOptions) => {
     const dashDashIndex = process.argv.indexOf('--');
     let runtimeCommand: string[] | undefined;
```

**File**: `genkit-tools/cli/src/commands/eval-flow.ts` (modified, +3/-2)
```diff
@@ -60,6 +60,7 @@ enum SourceType {
 
 /** Command to run a flow and evaluate the output */
 export const evalFlow = new Command('eval:flow')
+  .usage('[options] <flowName> [data] [-- <command...>]')
   .description(
     'evaluate a flow against configured evaluators using provided data as input'
   )
@@ -72,7 +73,7 @@ export const evalFlow = new Command('eval:flow')
   .option('-c, --context <JSON>', 'JSON object passed to context', '')
   .option(
     '-o, --output <filename>',
-    'Name of the output file to write evaluation results. Defaults to json output.'
+    'Name of the output file to write evaluation results'
   )
   // TODO: Figure out why passing a new Option with choices doesn't work
   .option(
@@ -147,7 +148,7 @@ export const evalFlow = new Command('eval:flow')
               : `No evaluators found in your app`
           );
         }
-        logger.debug(
+        logger.info(
           `Using evaluators: ${evaluatorActions.map((action) => action.name).join(',')}`
         );
 
```

**File**: `genkit-tools/cli/src/commands/eval-run.ts` (modified, +2/-1)
```diff
@@ -43,14 +43,15 @@ interface EvalRunCliOptions {
 
 /** Command to run evaluation on a dataset. */
 export const evalRun = new Command('eval:run')
+  .usage('[options] <dataset> [-- <command...>]')
   .description('evaluate provided dataset against configured evaluators')
   .argument(
     '<dataset>',
     'Dataset to evaluate on (currently only supports JSON)'
   )
   .option(
     '--output <filename>',
-    'name of the output file to write evaluation results. Defaults to json output.'
+    'name of the output file to write evaluation results'
   )
   .option(
     '--output-format <format>',
```

---

### Incident Patch 10: `684a9885` (2026-10-01)
**Commit Message**: feat(py)!: Developer UI traces over HTTP; hook for your own Instrumentation (#6132)

**File**: `py/README.md` (modified, +3/-3)
```diff
@@ -1,6 +1,6 @@
 # Genkit Python SDK
 
-Build production-ready AI applications in Python with type-safe flows, structured outputs, and integrated observability.
+Build production-ready AI applications in Python with type-safe flows, structured outputs, and pluggable observability.
 
 > **Building with a coding agent? Install the Genkit Python skill first.**
 >
@@ -39,7 +39,7 @@ ai = Genkit(plugins=[GoogleAI()])
 def get_weather(city: str) -> str:
     return f"Sunny, 72°F in {city}"
 
-# 3. Define an observable flow
+# 3. Define a flow
 @ai.flow()
 async def plan_trip(destination: str) -> str:
     response = await ai.generate(
@@ -54,7 +54,7 @@ async def plan_trip(destination: str) -> str:
 
 - **Type-Safe by Design:** Leverage Python type annotations and Pydantic models for structured inputs, outputs, and tool definitions.
 - **Multi-Model Provider API:** Switch effortlessly between Google Gemini, Anthropic Claude, OpenAI, Ollama, Vertex AI, and Amazon Bedrock with a unified API.
-- **Integrated Observability:** Built-in OpenTelemetry tracing and evaluation metrics. Inspect spans and debug flows in real-time using the Genkit Developer UI (`genkit start`).
+- **Pluggable Observability:** Under `genkit start`, `Genkit()` fills the Developer UI Traces tab over HTTP. If you start the app yourself after `genkit start`, the collector URL arrives on the reflection handshake.
 - **Deploy Anywhere:** Expose flows as standard ASGI/WSGI applications compatible with FastAPI, Flask, Django, Cloud Run, or any serverless platform.
 
 ---
```

**File**: `py/docs/index.md` (modified, +0/-8)
```diff
@@ -181,14 +181,6 @@
 
 ::: genkit.plugin_api.loop_local_client
 
-::: genkit.plugin_api.tracer
-
-::: genkit.plugin_api.add_custom_exporter
-
-::: genkit.plugin_api.AdjustingTraceExporter
-
-::: genkit.plugin_api.RedactedSpan
-
 ::: genkit.plugin_api.to_display_path
 
 ::: genkit.plugin_api.to_json_schema
```

**File**: `py/docs/types.md` (modified, +0/-4)
```diff
@@ -156,10 +156,6 @@ Types exported from genkit, genkit.model, genkit.embedder, genkit.plugin_api, an
 
 ::: genkit.plugin_api.GenkitError
 
-::: genkit.plugin_api.AdjustingTraceExporter
-
-::: genkit.plugin_api.RedactedSpan
-
 ::: genkit.plugin_api.ModelConfig
 
 ::: genkit.plugin_api.ModelRef
```

**File**: `py/packages/genkit-google-cloud/pyproject.toml` (modified, +2/-0)
```diff
@@ -47,6 +47,8 @@ dependencies = [
   "genkit",
   "google-cloud-firestore>=2.14.0",
   "google-cloud-logging>=3.10.0",
+  "opentelemetry-api>=1.20.0",
+  "opentelemetry-sdk>=1.20.0",
   "opentelemetry-exporter-gcp-trace>=1.9.0",
   "opentelemetry-exporter-gcp-monitoring>=1.9.0",
   "strenum>=0.4.15; python_version < '3.11'",
```

**File**: `py/packages/genkit-google-cloud/src/genkit_google_cloud/__init__.py` (modified, +1/-2)
```diff
@@ -47,7 +47,7 @@
     - Cloud Monitoring: https://cloud.google.com/monitoring
 """
 
-from .telemetry import add_gcp_telemetry, enable_google_cloud_telemetry
+from .telemetry import enable_google_cloud_telemetry
 
 
 def package_name() -> str:
@@ -60,7 +60,6 @@ def package_name() -> str:
 
 
 __all__ = [
-    'add_gcp_telemetry',
     'enable_google_cloud_telemetry',
     'package_name',
 ]
```

**File**: `py/packages/genkit-google-cloud/src/genkit_google_cloud/telemetry/__init__.py` (modified, +2/-5)
```diff
@@ -26,20 +26,17 @@
     from genkit_google_genai import GoogleAI
     from genkit_google_cloud import enable_google_cloud_telemetry
 
-    # 1. Enable Google Cloud Trace and Monitoring export
     enable_google_cloud_telemetry(project_id='my-project')
 
-    # 2. All subsequent Genkit actions automatically export telemetry
     ai = Genkit(plugins=[GoogleAI()], model=GoogleAI.gemini_model('gemini-flash-latest'))
     await ai.generate(prompt='Hello, world!')
-    # => Traces exported asynchronously to Cloud Trace (latency, tokens, status)
     ```
 
 See Also:
     - Cloud Trace: https://cloud.google.com/trace/docs
     - Cloud Monitoring: https://cloud.google.com/monitoring/docs
 """
 
-from .tracing import add_gcp_telemetry, enable_google_cloud_telemetry
+from .tracing import enable_google_cloud_telemetry
 
-__all__ = ['add_gcp_telemetry', 'enable_google_cloud_telemetry']
+__all__ = ['enable_google_cloud_telemetry']
```

**File**: `py/packages/genkit-google-cloud/src/genkit_google_cloud/telemetry/_adjusting_exporter.py` (renamed, +6/-7)
```diff
@@ -24,13 +24,13 @@
 from opentelemetry.sdk.trace import ReadableSpan
 from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult
 from opentelemetry.trace import StatusCode
+from opentelemetry.util.types import Attributes, AttributeValue
 
 from genkit._core._compat import override
+from genkit._core._telemetry._attrs import Attr, Subtype
 
-from ._attrs import Attr, Subtype
 
-
-def _copy_attrs(span: ReadableSpan) -> dict[str, Any]:
+def _copy_attrs(span: ReadableSpan) -> dict[str, AttributeValue]:
     """Return a mutable copy of span attributes."""
     return dict(span.attributes) if span.attributes else {}
 
@@ -39,19 +39,18 @@ class RedactedSpan(ReadableSpan):
     """A span wrapper that overrides attributes while delegating everything else."""
 
     # pyrefly:ignore[bad-override]
-    _attributes: dict[str, Any]
+    _attributes: dict[str, AttributeValue]
 
-    def __init__(self, span: ReadableSpan, attributes: dict[str, Any]) -> None:
+    def __init__(self, span: ReadableSpan, attributes: dict[str, AttributeValue]) -> None:
         self._span = span
         self._attributes = attributes
 
     def __getattr__(self, name: str) -> Any:  # noqa: ANN401
         return getattr(self._span, name)
 
     @property
-    def attributes(self) -> dict[str, Any]:
+    def attributes(self) -> Attributes:
         """The modified attributes."""
-        # pyrefly: ignore[bad-return] - dict[str, Any] is compatible with Mapping at runtime
         return self._attributes
 
 
```

**File**: `py/packages/genkit-google-cloud/src/genkit_google_cloud/telemetry/config.py` (modified, +20/-3)
```diff
@@ -27,16 +27,18 @@
 from typing import Any
 
 import structlog
-from opentelemetry import metrics
+from opentelemetry import metrics, trace as trace_api
 from opentelemetry.exporter.cloud_monitoring import CloudMonitoringMetricsExporter
 from opentelemetry.resourcedetector.gcp_resource_detector import GoogleCloudResourceDetector
 from opentelemetry.sdk.metrics import MeterProvider
 from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
 from opentelemetry.sdk.resources import SERVICE_INSTANCE_ID, SERVICE_NAME, Resource
+from opentelemetry.sdk.trace import TracerProvider
+from opentelemetry.sdk.trace.export import BatchSpanProcessor, SimpleSpanProcessor, SpanExporter
 from opentelemetry.sdk.trace.sampling import Sampler
 from opentelemetry.trace import get_current_span, span as trace_span
 
-from genkit.plugin_api import add_custom_exporter, is_dev_environment
+from genkit.plugin_api import is_dev_environment
 
 from .constants import (
     DEFAULT_METRIC_EXPORT_INTERVAL_MS,
@@ -51,6 +53,21 @@
 logger = structlog.get_logger(__name__)
 
 
+def _hang_exporter_on_process_tracer(*, exporter: SpanExporter) -> None:
+    """Attach Cloud Trace to the process tracer they already registered, if any.
+
+    This does not mint Genkit spans. ``configure_instrumentation`` does that.
+    Local export happens on span end so a short ``genkit start`` run still
+    shows up; prod batches.
+    """
+    provider = trace_api.get_tracer_provider()
+    if not isinstance(provider, TracerProvider):
+        provider = TracerProvider()
+        trace_api.set_tracer_provider(provider)
+    processor = SimpleSpanProcessor(exporter) if is_dev_environment() else BatchSpanProcessor(exporter)
+    provider.add_span_processor(processor)
+
+
 def resolve_project_id(
     project_id: str | None = None,
     credentials: dict[str, Any] | None = None,
@@ -246,7 +263,7 @@ def _configure_tracing(self) -> None:
                 error_handler=handle_tracing_error,
             )
 
-            add_custom_exporter(trace_exporter, 'gcp_telemetry_server')
+            _hang_exporter_on_process_tracer(exporter=trace_exporter)
         except Exception as e:
             handle_tracing_error(e)
 
```

---

### Incident Patch 11: `b1a3fb31` (2026-09-30)
**Commit Message**: fix(google-genai): correct Vertex multimodal embedding dimensions (#6484)

**File**: `js/plugins/google-genai/src/vertexai/embedder.ts` (modified, +3/-3)
```diff
@@ -49,7 +49,7 @@ export const EmbeddingConfigSchema = z
     version: z.string().optional(),
     /**
      * The `outputDimensionality` parameter allows you to specify the dimensionality of the embedding output.
-     * By default, the model generates embeddings with 768 dimensions.
+     * The default dimensions depend on the model (1408 for multimodalembedding@001).
      * By selecting a smaller output dimensionality, users can save memory and storage space, leading to more efficient computations.
      **/
     outputDimensionality: z.number().min(1).optional(),
@@ -91,7 +91,7 @@ const GENERIC_TEXT_MODEL = commonRef('text', {
   supports: { input: ['text'] },
 });
 const GENERIC_MULTIMODAL_MODEL = commonRef('multimodal', {
-  dimensions: 768,
+  dimensions: 1408,
   supports: { input: ['text', 'image', 'video'] },
 });
 
@@ -101,7 +101,7 @@ export const KNOWN_MODELS = {
     'text-multilingual-embedding-002'
   ),
   'multimodalembedding@001': commonRef('multimodalembedding@001', {
-    dimensions: 768,
+    dimensions: 1408,
     supports: { input: ['text', 'image', 'video'] },
   }),
   'gemini-embedding-001': commonRef('gemini-embedding-001', {
```

**File**: `js/plugins/google-genai/tests/vertexai/embedder_test.ts` (modified, +9/-0)
```diff
@@ -24,13 +24,22 @@ import { getVertexAIUrl } from '../../src/vertexai/client.js';
 import {
   EmbeddingConfig,
   defineEmbedder,
+  model,
 } from '../../src/vertexai/embedder.js';
 import {
   ClientOptions,
   EmbedContentResponse,
   EmbeddingInstance,
 } from '../../src/vertexai/types.js';
 
+it('reports the default dimensions for multimodal embedders', () => {
+  assert.strictEqual(model('multimodalembedding@001').info?.dimensions, 1408);
+  assert.strictEqual(
+    model('custom-multimodalembedding', { multimodal: true }).info?.dimensions,
+    1408
+  );
+});
+
 describe('defineEmbedder', () => {
   let fetchStub: sinon.SinonStub;
   let authMock: sinon.SinonStubbedInstance<GoogleAuth>;
```

---

### Incident Patch 12: `228015f1` (2026-09-25)
**Commit Message**: fix(py/plugins/openai): set raw to the full completion on the non-streaming path (#6423)

**File**: `py/packages/genkit-openai/src/genkit_openai/models/model.py` (modified, +1/-1)
```diff
@@ -515,7 +515,7 @@ async def _generate(self, request: ModelRequest) -> ModelResponse:
             finish_message=finish_message,
             usage=_usage_from_completion(response.usage),
             custom=metadata or None,
-            raw=metadata or None,
+            raw=response.to_dict(),
         )
         return self._clean_json_response(result, request)
 
```

**File**: `py/packages/genkit-openai/tests/openai_model_test.py` (modified, +70/-72)
```diff
@@ -204,21 +204,9 @@ async def test_get_openai_config_model_field_overrides_version() -> None:
 
 
 @pytest.mark.asyncio
-async def test__generate(sample_request: ModelRequest) -> None:
+async def test__generate(sample_request: ModelRequest, make_completion: Callable[..., ChatCompletion]) -> None:
     """Test generate method calls OpenAI API and returns ModelResponse."""
-    mock_message = MagicMock()
-    mock_message.content = 'Hello, user!'
-    mock_message.role = 'model'
-    mock_message.tool_calls = None
-    mock_message.reasoning_content = None
-    mock_message.refusal = None
-
-    mock_response = MagicMock()
-    mock_response.choices = [MagicMock(message=mock_message)]
-    mock_response.usage = None
-
-    mock_client = MagicMock()
-    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
+    mock_client = _mock_completion(make_completion())
 
     model = OpenAIModel(model='gpt-4', client=mock_client)
     response = await model._generate(sample_request)
@@ -434,21 +422,11 @@ async def iterator() -> AsyncIterator[ChatCompletionChunk]:
 
 
 @pytest.mark.asyncio
-async def test__generate_reports_usage(sample_request: ModelRequest) -> None:
+async def test__generate_reports_usage(
+    sample_request: ModelRequest, make_completion: Callable[..., ChatCompletion]
+) -> None:
     """A non-streaming response's token usage reaches the ModelResponse."""
-    mock_message = MagicMock()
-    mock_message.content = 'Hello, user!'
-    mock_message.role = 'model'
-    mock_message.tool_calls = None
-    mock_message.reasoning_content = None
-    mock_message.refusal = None
-
-    mock_response = MagicMock()
-    mock_response.choices = [MagicMock(message=mock_message)]
-    mock_response.usage = CompletionUsage.model_validate(_USAGE_PAYLOAD)
-
-    mock_client = MagicMock()
-    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
+    mock_client = _mock_completion(make_completion(usage=_USAGE_PAYLOAD))
 
     model = OpenAIModel(model='gpt-4', client=mock_client)
     sample_request.config = OpenAIConfig(stream_options={'include_usage': False})
@@ -460,35 +438,26 @@ async def test__generate_reports_usage(sample_request: ModelRequest) -> None:
 
 
 @pytest.mark.asyncio
-async def test__generate_reports_extra_token_counts() -> None:
+async def test__generate_reports_extra_token_counts(make_completion: Callable[..., ChatCompletion]) -> None:
     """Counts Genkit has no field for land in usage.custom; zeroes are dropped."""
-    mock_message = MagicMock()
-    mock_message.content = 'hi'
-    mock_message.role = 'model'
-    mock_message.tool_calls = None
-    mock_message.reasoning_content = None
-    mock_message.refusal = None
-
-    mock_response = MagicMock()
-    mock_response.choices = [MagicMock(message=mock_message)]
-    mock_response.usage = CompletionUsage.model_validate({
-        'prompt_tokens': 3,
-        'completion_tokens': 2,
-        'total_tokens': 5,
-        'prompt_tokens_details': {'cached_tokens': 0, 'image_tokens': 9},
-        'completion_tokens_details': {
-            'audio_tokens': 4,
-            'accepted_prediction_tokens': 0,
-            'rejected_prediction_tokens': 2,
-            'reasoning_tokens': 0,
+    completion = make_completion(
+        content='hi',
+        usage={
+            'prompt_tokens': 3,
+            'completion_tokens': 2,
+            'total_tokens': 5,
+            'prompt_tokens_details': {'cached_tokens': 0, 'image_tokens': 9},
+            'completion_tokens_details': {
+                'audio_tokens': 4,
+                'accepted_prediction_tokens': 0,
+                'rejected_prediction_tokens': 2,
+                'reasoning_tokens': 0,
+            },
+            'num_sources_used': 8,
         },
-        'num_sources_used': 8,
-    })
-
-    mock_client = MagicMock()
-    mock_client.chat.completions.create = AsyncMock(return_value=mock_response)
+    )
 
-    model = OpenAIModel(model='gpt-4', client=mock_client)
+    model = OpenAIModel(model='gpt-4', client=_mock_completion(completion))
     request = ModelRequest(messages=[Message(role=Role.USER, content=[Part.from_text('hi')])])
     response = await model._generate(request)
 
@@ -1620,17 +1589,15 @@ class TestResponseMetadata:
     async def test_generate_reports_ids_and_fingerprint(
         self, sample_request: ModelRequest, make_completion: Callable[..., ChatCompletion]
     ) -> None:
-        """The fingerprint, model and id reach both custom and raw."""
+        """The fingerprint, model and id reach custom."""
         model = OpenAIModel(model='gpt-4o', client=_client(make_completion(system_fingerprint='fp_44709d6fcb')))
         response = await model._generate(sample_request)
 
-        expected = {
+        assert response.custom == {
             'systemFingerprint': 'fp_44709d6fcb',
             'model': 'gpt-4o-2024-08-06',
             'id': 'chatcmpl-abc',
         }
-        assert response.custom == expect
```

**File**: `py/packages/genkit-openai/tests/tool_calling_test.py` (modified, +22/-26)
```diff
@@ -17,46 +17,42 @@
 """Test tool calling."""
 
 import json
+from collections.abc import Callable
 from functools import reduce
 from unittest.mock import AsyncMock, MagicMock
 
 import pytest
 from genkit_openai.models import OpenAIModel
+from openai.types.chat import ChatCompletion
 
 from genkit import ModelRequest, ModelResponseChunk
 
 
 @pytest.mark.asyncio
-async def test_generate_with_tool_calls_executes_tools(sample_request: ModelRequest) -> None:
+async def test_generate_with_tool_calls_executes_tools(
+    sample_request: ModelRequest, make_completion: Callable[..., ChatCompletion]
+) -> None:
     """Test generate with tool calls executes tools."""
-    mock_tool_call = MagicMock()
-    mock_tool_call.id = 'tool123'
-    mock_tool_call.function.name = 'tool_fn'
-    mock_tool_call.function.arguments = '{"a": 1}'
-
     # First call triggers tool execution
-    first_message = MagicMock()
-    first_message.role = 'assistant'
-    first_message.tool_calls = [mock_tool_call]
-    first_message.content = None
-    first_message.reasoning_content = None
-    first_message.refusal = None
-
-    first_response = MagicMock()
-    first_response.choices = [MagicMock(finish_reason='tool_calls', message=first_message)]
-    first_response.usage = None
+    first_response = make_completion(
+        choice={
+            'finish_reason': 'tool_calls',
+            'message': {
+                'role': 'assistant',
+                'content': None,
+                'tool_calls': [
+                    {
+                        'id': 'tool123',
+                        'type': 'function',
+                        'function': {'name': 'tool_fn', 'arguments': '{"a": 1}'},
+                    }
+                ],
+            },
+        }
+    )
 
     # Second call is the model response
-    second_message = MagicMock()
-    second_message.role = 'model'
-    second_message.tool_calls = None
-    second_message.content = 'final response'
-    second_message.reasoning_content = None
-    second_message.refusal = None
-
-    second_response = MagicMock()
-    second_response.choices = [MagicMock(finish_reason='stop', message=second_message)]
-    second_response.usage = None
+    second_response = make_completion(content='final response')
 
     mock_client = MagicMock()
     mock_client.chat.completions.create = AsyncMock(
```

---

### Incident Patch 13: `96647ebd` (2026-09-24)
**Commit Message**: chore(dev-ui-gallery): update models to latest and add test middleware (#6427)

**File**: `js/pnpm-lock.yaml` (modified, +5/-3)
```diff
@@ -1505,9 +1505,6 @@ importers:
       '@genkit-ai/evaluator':
         specifier: workspace:*
         version: link:../../plugins/evaluators
-      '@genkit-ai/firebase':
-        specifier: workspace:*
-        version: link:../../plugins/firebase
       '@genkit-ai/google-cloud':
         specifier: workspace:*
         version: link:../../plugins/google-cloud
@@ -4110,6 +4107,7 @@ packages:
   '@google-cloud/opentelemetry-cloud-monitoring-exporter@0.19.0':
     resolution: {integrity: sha512-5SOPXwC6RET4ZvXxw5D97dp8fWpqWEunHrzrUUGXhG4UAeedQe1KvYV8CK+fnaAbN2l2ha6QDYspT6z40TVY0g==}
     engines: {node: '>=14'}
+    deprecated: Google Cloud Platform now supports native OpenTelemetry Protocol (OTLP) endpoints via the Telemetry API. Please follow https://github.com/GoogleCloudPlatform/opentelemetry-operations-js/blob/main/MIGRATION.md
     peerDependencies:
       '@opentelemetry/api': ^1.0.0
       '@opentelemetry/core': ^1.0.0
@@ -4119,6 +4117,7 @@ packages:
   '@google-cloud/opentelemetry-cloud-trace-exporter@2.4.1':
     resolution: {integrity: sha512-Dq2IyAyA9PCjbjLOn86i2byjkYPC59b5ic8k/L4q5bBWH0Jro8lzMs8C0G5pJfqh2druj8HF+oAIAlSdWQ+Z9Q==}
     engines: {node: '>=14'}
+    deprecated: Google Cloud Platform now supports native OpenTelemetry Protocol (OTLP) endpoints via the Telemetry API. Please follow https://github.com/GoogleCloudPlatform/opentelemetry-operations-js/blob/main/MIGRATION.md
     peerDependencies:
       '@opentelemetry/api': ^1.0.0
       '@opentelemetry/core': ^1.0.0
@@ -4128,6 +4127,7 @@ packages:
   '@google-cloud/opentelemetry-resource-util@2.4.0':
     resolution: {integrity: sha512-/7ujlMoKtDtrbQlJihCjQnm31n2s2RTlvJqcSbt2jV3OkCzPAdo3u31Q13HNugqtIRUSk7bUoLx6AzhURkhW4w==}
     engines: {node: '>=14'}
+    deprecated: Google Cloud Platform now supports native OpenTelemetry Protocol (OTLP) endpoints via the Telemetry API. Please follow https://github.com/GoogleCloudPlatform/opentelemetry-operations-js/blob/main/MIGRATION.md
     peerDependencies:
       '@opentelemetry/resources': ^1.0.0
 
@@ -5712,6 +5712,7 @@ packages:
   '@opentelemetry/propagation-utils@0.30.16':
     resolution: {integrity: sha512-ZVQ3Z/PQ+2GQlrBfbMMMT0U7MzvYZLCPP800+ooyaBqm4hMvuQHfP028gB9/db0mwkmyEAMad9houukUVxhwcw==}
     engines: {node: '>=14'}
+    deprecated: The use of process spans has been removed from Messaging Semantic Conventions. It is now recommended to connect pub/sub spans via Span Links. See https://opentelemetry.io/docs/specs/semconv/messaging/messaging-spans/ for details.
     peerDependencies:
       '@opentelemetry/api': ^1.0.0
 
@@ -9378,6 +9379,7 @@ packages:
   eslint@9.39.4:
     resolution: {integrity: sha512-XoMjdBOwe/esVgEvLmNsD3IRHkm7fbKIUGvrleloJXUZgDHig2IPWNniv+GwjyJXzuNqVjlr5+4yVUZjycJwfQ==}
     engines: {node: ^18.18.0 || ^20.9.0 || >=21.1.0}
+    deprecated: This version is no longer supported. Please see https://eslint.org/version-support for other options.
     hasBin: true
     peerDependencies:
       jiti: '*'
```

**File**: `js/testapps/dev-ui-gallery/package.json` (modified, +0/-1)
```diff
@@ -27,7 +27,6 @@
   "dependencies": {
     "@genkit-ai/dev-local-vectorstore": "workspace:*",
     "@genkit-ai/evaluator": "workspace:*",
-    "@genkit-ai/firebase": "workspace:*",
     "@genkit-ai/google-cloud": "workspace:*",
     "@genkit-ai/google-genai": "workspace:*",
     "@genkit-ai/middleware": "workspace:*",
```

**File**: `js/testapps/dev-ui-gallery/prompts/agent.prompt` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 ---
-model: googleai/gemini-3-flash-preview
+model: googleai/gemini-flash-latest
 config:
   maxOutputTokens: 2048
   temperature: 1.0
```

**File**: `js/testapps/dev-ui-gallery/prompts/code.prompt` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 ---
-model: googleai/gemini-2.5-flash
+model: googleai/gemini-flash-latest
 config:
   temperature: 0.4
   safetySettings:
```

**File**: `js/testapps/dev-ui-gallery/prompts/hello.first-last-name.prompt` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 ---
-model: googleai/gemini-2.5-flash
+model: googleai/gemini-flash-latest
 input:
   schema:
     firstName: string
```

**File**: `js/testapps/dev-ui-gallery/prompts/hello.history.prompt` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 ---
-model: googleai/gemini-2.5-flash
+model: googleai/gemini-flash-latest
 config:
   maxOutputTokens: 2048
   temperature: 0.6
```

**File**: `js/testapps/dev-ui-gallery/prompts/hello.json-output.prompt` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 ---
-model: googleai/gemini-2.5-flash
+model: googleai/gemini-flash-latest
 input:
   schema:
     name: string
```

**File**: `js/testapps/dev-ui-gallery/prompts/hello.prompt` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 ---
-model: googleai/gemini-2.5-flash
+model: googleai/gemini-flash-latest
 config:
   maxOutputTokens: 2048
   temperature: 0.6
```

---

### Incident Patch 14: `f4e32773` (2026-09-23)
**Commit Message**: fix(go/ai/exp): honor abort in conformance fixture (#6415)

**File**: `go/ai/exp/agents_conformance_test.go` (modified, +6/-0)
```diff
@@ -276,6 +276,12 @@ func setupHarness(t *testing.T) *harness {
 			}); err != nil {
 				return nil, err
 			}
+			// An abort can land after the first turn but before Run starts the
+			// queued "block" turn. Run then returns nil; propagate the stop so
+			// this abortable fixture does not report a successful invocation.
+			if err := ctx.Err(); err != nil {
+				return nil, err
+			}
 			return &exp.AgentResult{Message: ai.NewModelTextMessage("done")}, nil
 		}, newStore("customAgentAbortable"))
 
```

---

### Incident Patch 15: `ff058716` (2026-09-23)
**Commit Message**: fix(py/core): list dynamic action provider children in the registry (#6378)

**File**: `py/packages/genkit/src/genkit/_ai/_aio.py` (modified, +2/-6)
```diff
@@ -86,11 +86,7 @@
     missing_operation_error,
 )
 from genkit._core._channel import Channel, run_loop
-from genkit._core._dap import (
-    DapFn,
-    DynamicActionProvider,
-    define_dynamic_action_provider as define_dap_block,
-)
+from genkit._core._dap import DapFn, DynamicActionProvider
 from genkit._core._environment import is_dev_environment
 from genkit._core._error import GenkitError, RuntimeErrorReason, StatusName
 from genkit._core._logger import configure_logging, get_logger, resolve_level
@@ -104,7 +100,7 @@
 from genkit._core._protocols import SessionLike
 from genkit._core._reflection import ReflectionServer, ServerSpec, create_reflection_asgi_app
 from genkit._core._reflection_v2 import ReflectionServerV2
-from genkit._core._registry import Registry
+from genkit._core._registry import Registry, define_dynamic_action_provider as define_dap_block
 from genkit._core._tracing import SpanMetadata, run_in_new_span
 from genkit._core._typing import (
     BaseDataPoint,
```

**File**: `py/packages/genkit/src/genkit/_core/_dap.py` (modified, +0/-33)
```diff
@@ -23,12 +23,10 @@
 from typing import Any
 
 from genkit._core._action import (
-    GENKIT_DYNAMIC_ACTION_PROVIDER_ATTR,
     Action,
     ActionKind,
     create_action_key,
 )
-from genkit._core._registry import Registry
 from genkit._core._typing import ActionMetadata
 
 ActionMetadataLike = Mapping[str, object]
@@ -186,34 +184,3 @@ def is_dynamic_action_provider(obj: object) -> bool:
         return True
     metadata = getattr(obj, 'metadata', None)
     return isinstance(metadata, dict) and metadata.get('type') == 'dynamic-action-provider'
-
-
-def define_dynamic_action_provider(
-    registry: Registry,
-    name: str,
-    fn: DapFn,
-    *,
-    description: str | None = None,
-    cache_ttl_millis: int | None = None,
-    metadata: dict[str, Any] | None = None,
-) -> DynamicActionProvider:
-    """Define and register a Dynamic Action Provider for lazy action resolution."""
-
-    async def dap_action(input: DapMetadata) -> DapMetadata:
-        return input
-
-    action = registry.register_action(
-        name=name,
-        kind=ActionKind.DYNAMIC_ACTION_PROVIDER,
-        description=description,
-        fn=dap_action,
-        metadata={**(metadata or {}), 'type': 'dynamic-action-provider'},
-    )
-
-    dap = DynamicActionProvider(action, fn, cache_ttl_millis)
-    # Attach the provider to the registered Action so anyone holding the
-    # Action (e.g. ``Registry.resolve_action_by_key`` for a DAP-qualified key,
-    # or ``Registry.list_actions`` expanding children for reflection) can
-    # recover the cache and helpers via ``getattr(action, ATTR, None)``.
-    setattr(action, GENKIT_DYNAMIC_ACTION_PROVIDER_ATTR, dap)
-    return dap
```

**File**: `py/packages/genkit/src/genkit/_core/_registry.py` (modified, +140/-9)
```diff
@@ -22,7 +22,7 @@
 import threading
 import weakref
 from collections.abc import Awaitable, Callable
-from typing import cast
+from typing import Any, cast
 
 from dotpromptz.dotprompt import Dotprompt
 from pydantic import BaseModel
@@ -40,6 +40,7 @@
     parse_dap_qualified_name,
     set_action_name,
 )
+from genkit._core._dap import DapFn, DapMetadata, DynamicActionProvider
 from genkit._core._error import GenkitError, RuntimeErrorReason
 from genkit._core._logger import get_logger
 from genkit._core._model import (
@@ -59,6 +60,10 @@
 
 logger = get_logger(__name__)
 
+# A provider backed by a remote or subprocess transport can stall indefinitely,
+# and the reflection server it is listed for must still answer.
+DEFAULT_DAP_LIST_TIMEOUT_SECONDS = 10.0
+
 # An action store is a nested dictionary mapping ActionKind to a dictionary of
 # action names and their corresponding Action instances.
 #
@@ -98,6 +103,77 @@ def _action_metadata_for_registered_action(action: Action) -> ActionMetadata:
     )
 
 
+# The event loop holds only a weak reference to a running task.
+_dap_listing_tasks: set[asyncio.Task[dict[str, ActionMetadata]]] = set()
+
+
+def _release_listing_task(task: asyncio.Task[dict[str, ActionMetadata]]) -> None:
+    """Drop a finished listing and take its outcome so asyncio does not report it as never retrieved."""
+    _dap_listing_tasks.discard(task)
+    if not task.cancelled():
+        task.exception()
+
+
+def _is_runnable_dap_key(key: str) -> bool:
+    """Report whether ``resolve_action_by_key`` can resolve this DAP child key."""
+    try:
+        kind, name = parse_action_key(key)
+    except ValueError:
+        return False
+    return kind == ActionKind.DYNAMIC_ACTION_PROVIDER and parse_dap_qualified_name(name) is not None
+
+
+async def _list_dap_children(
+    provider_name: str,
+    provider: DynamicActionProvider,
+    timeout_seconds: float | None,
+) -> dict[str, ActionMetadata]:
+    """List one provider's children for the catalog, degrading to no rows on failure.
+
+    Children whose key ``resolve_action_by_key`` cannot parse are dropped, so the
+    catalog never offers a row that fails when it is run.
+
+    Args:
+        provider_name: Registered name of the provider action.
+        provider: The provider whose children to list.
+        timeout_seconds: How long to wait for the listing, or None to wait
+            indefinitely.
+
+    Returns:
+        Map of qualified child key to metadata, empty if the provider timed out,
+        failed, or had its listing cancelled.
+    """
+    task = asyncio.create_task(provider.list_action_metadata_by_key(provider_name))
+    _dap_listing_tasks.add(task)
+    task.add_done_callback(_release_listing_task)
+
+    # asyncio.wait rather than wait_for: cancelling would abort a fetch that
+    # concurrent callers share through the provider cache.
+    done, _pending = await asyncio.wait({task}, timeout=timeout_seconds)
+    if not done:
+        logger.warning('Timed out listing actions for dynamic action provider %s', provider_name)
+        return {}
+    if task.cancelled():
+        # Only a third party can have cancelled it: this coroutine's own
+        # cancellation surfaces at the await above and propagates from there.
+        logger.warning('Listing actions for dynamic action provider %s was cancelled', provider_name)
+        return {}
+    try:
+        children = task.result()
+    except Exception:
+        logger.exception('Error listing actions for dynamic action provider %s', provider_name)
+        return {}
+
+    runnable = {key: meta for key, meta in children.items() if _is_runnable_dap_key(key)}
+    if len(runnable) != len(children):
+        logger.warning(
+            'Skipped %d action(s) from dynamic action provider %s: their keys cannot be resolved',
+            len(children) - len(runnable),
+            provider_name,
+        )
+    return runnable
+
+
 class Registry:
     """Central repository for Genkit resources.
 
@@ -303,14 +379,27 @@ async def resolve_actions_by_kind(self, kind: ActionKind) -> dict[str, Action]:
             await self._trigger_lazy_loading(action)
         return actions
 
-    async def list_actions(self) -> dict[str, ActionMetadata]:
-        """Return reflection metadata for plugins and registered actions.
+    async def list_actions(
+        self,
+        *,
+        dap_timeout_seconds: float | None = DEFAULT_DAP_LIST_TIMEOUT_SECONDS,
+    ) -> dict[str, ActionMetadata]:
+        """Return reflection metadata for plugins, registered actions and DAP children.
 
         Initializes plugins, advertises plugin rows from each plugin's ``list_actions()``,
-        then fills registered :class:`Action` rows. DAP children are not catalog rows;
-        they become ``/tool.v2/<name>`` when generate binds them on a child registry.
-        Merges with the parent registry's catalog; entries from this registry win
-        on duplicate keys.
+        then fills registered :
```

**File**: `py/packages/genkit/tests/genkit/ai/dap_test.py` (modified, +1/-2)
```diff
@@ -34,10 +34,9 @@
     DapMetadata,
     DapValue,
     DynamicActionProvider,
-    define_dynamic_action_provider,
     is_dynamic_action_provider,
 )
-from genkit._core._registry import Registry
+from genkit._core._registry import Registry, define_dynamic_action_provider
 from genkit._core._typing import ActionMetadata
 
 
```

**File**: `py/packages/genkit/tests/genkit/ai/dynamic_tools_generate_test.py` (modified, +11/-11)
```diff
@@ -23,9 +23,9 @@
 from genkit._ai._generate import expand_wildcard_tools, resolve_tool
 from genkit._ai._testing import define_programmable_model
 from genkit._core._action import Action, ActionKind
-from genkit._core._dap import DapValue, define_dynamic_action_provider
+from genkit._core._dap import DapValue
 from genkit._core._error import GenkitError, RuntimeErrorReason
-from genkit._core._registry import Registry
+from genkit._core._registry import Registry, define_dynamic_action_provider
 from genkit._core._typing import (
     FinishReason,
     Role,
@@ -98,19 +98,19 @@ async def dap_fn() -> DapValue:
 
     define_dynamic_action_provider(registry, 'mcp', dap_fn)
 
-    # The provider is a catalog row. Its tools are not — people pick them
-    # with a selector, and generate binds them on the child it passes in.
+    # The provider and its tools are catalog rows, but only under the DAP-qualified
+    # key: generate binds ``/tool.v2/echo`` on the child registry it passes in.
     before = await registry.list_actions()
     assert '/dynamic-action-provider/mcp' in before
-    assert '/dynamic-action-provider/mcp:tool/echo' not in before
+    assert '/dynamic-action-provider/mcp:tool/echo' in before
     assert '/tool.v2/echo' not in before
 
     expanded = await expand_wildcard_tools(registry, ['mcp:tool/echo'])
     assert expanded == ['/tool.v2/echo']
     assert registry._entries.get(ActionKind.TOOL, {}).get('echo') is echo
     catalog = await registry.list_actions()
     assert catalog['/tool.v2/echo'].name == 'echo'
-    assert '/dynamic-action-provider/mcp:tool/echo' not in catalog
+    assert '/dynamic-action-provider/mcp:tool/echo' in catalog
     assert '/dynamic-action-provider/mcp' in catalog
 
 
@@ -143,8 +143,8 @@ async def dap_fn() -> DapValue:
 
 
 @pytest.mark.asyncio
-async def test_mcp_tool_echo_does_not_appear_on_the_app_catalog() -> None:
-    """mcp:tool/echo is not a row on the app catalog. /tool.v2/echo lives on the generate child."""
+async def test_mcp_tool_echo_is_not_a_tool_v2_row_on_the_app_catalog() -> None:
+    """mcp:tool/echo is a DAP-qualified row. /tool.v2/echo lives on the generate child."""
     parent = Registry()
 
     async def tool_fn(x: str) -> str:
@@ -165,7 +165,7 @@ async def dap_fn() -> DapValue:
 
     parent_catalog = await parent.list_actions()
     assert '/dynamic-action-provider/mcp' in parent_catalog
-    assert '/dynamic-action-provider/mcp:tool/echo' not in parent_catalog
+    assert '/dynamic-action-provider/mcp:tool/echo' in parent_catalog
     assert '/tool.v2/echo' not in parent_catalog
 
     child_catalog = await child.list_actions()
@@ -356,7 +356,7 @@ async def dap_fn() -> DapValue:
     assert 'echo' not in ai.registry._entries.get(ActionKind.TOOL, {})
     root_catalog = await ai.registry.list_actions()
     assert '/dynamic-action-provider/mcp' in root_catalog
-    assert '/dynamic-action-provider/mcp:tool/echo' not in root_catalog
+    assert '/dynamic-action-provider/mcp:tool/echo' in root_catalog
     assert '/tool.v2/echo' not in root_catalog
 
 
@@ -393,7 +393,7 @@ async def dap_fn() -> DapValue:
     assert 'dap_only_tool' not in root_tools
     root_catalog = await ai.registry.list_actions()
     assert '/dynamic-action-provider/mcp' in root_catalog
-    assert '/dynamic-action-provider/mcp:tool/dap_only_tool' not in root_catalog
+    assert '/dynamic-action-provider/mcp:tool/dap_only_tool' in root_catalog
     assert '/tool.v2/dap_only_tool' not in root_catalog
 
 
```

**File**: `py/packages/genkit/tests/genkit/ai/prompt_test.py` (modified, +2/-1)
```diff
@@ -36,9 +36,10 @@
     define_programmable_model,
 )
 from genkit._core._action import Action, ActionKind
-from genkit._core._dap import DapValue, define_dynamic_action_provider
+from genkit._core._dap import DapValue
 from genkit._core._error import GenkitError, RuntimeErrorReason
 from genkit._core._model import GenerateActionOptions, ModelConfig
+from genkit._core._registry import define_dynamic_action_provider
 from genkit._core._typing import Role, ToolChoice
 from genkit.middleware import BaseMiddleware, GenerateMiddlewareContext, ModelHookParams
 from genkit.plugin_api import MiddlewarePlugin, new_middleware
```

**File**: `py/packages/genkit/tests/genkit/core/registry_test.py` (modified, +298/-9)
```diff
@@ -9,13 +9,16 @@
 functionality, ensuring proper registration and management of Genkit resources.
 """
 
+import asyncio
+
 import pytest
+from structlog.testing import capture_logs
 
 from genkit import Genkit, Plugin
 from genkit._core._action import Action, ActionKind, ActionRunContext, create_action_key
-from genkit._core._dap import DapValue, define_dynamic_action_provider
+from genkit._core._dap import DapValue
 from genkit._core._model import ModelRequest, ModelResponse
-from genkit._core._registry import Registry
+from genkit._core._registry import Registry, define_dynamic_action_provider
 from genkit._core._typing import ActionMetadata, Operation
 
 
@@ -111,7 +114,7 @@ async def dap_fn() -> DapValue:
 
 @pytest.mark.asyncio
 async def test_resolve_action_by_key_dap_qualified() -> None:
-    """Qualified DAP key returns the child Action. It does not bind or catalog it."""
+    """Qualified DAP key returns the child Action without binding it as a canonical tool."""
     registry = Registry()
 
     async def tool_fn(x: str) -> str:
@@ -135,7 +138,7 @@ async def dap_fn() -> DapValue:
 
     catalog = await registry.list_actions()
     assert '/dynamic-action-provider/my-dap' in catalog
-    assert '/dynamic-action-provider/my-dap:tool/inner-tool' not in catalog
+    assert '/dynamic-action-provider/my-dap:tool/inner-tool' in catalog
     assert '/tool.v2/inner-tool' not in catalog
 
 
@@ -374,8 +377,8 @@ async def local_tool(_: str) -> str:
 
 
 @pytest.mark.asyncio
-async def test_child_resolvable_dap_tool_shadows_parent_plugin_metadata() -> None:
-    """DAP children are not catalog rows; plugin-advertised ``/tool.v2/`` stays until generate binds."""
+async def test_child_dap_child_row_does_not_shadow_parent_plugin_metadata() -> None:
+    """A DAP child is its own catalog row; the plugin-advertised ``/tool.v2/`` row is untouched."""
 
     class ParentPlugin(Plugin):
         name = 'parentplugin'
@@ -416,13 +419,13 @@ async def dap_fn() -> DapValue:
 
     catalog = await child.list_actions()
     qualified = create_action_key(ActionKind.DYNAMIC_ACTION_PROVIDER, 'mcp:tool/parentplugin/mcp-tool')
-    assert qualified not in catalog
+    assert catalog[qualified].description == 'from mcp'
     assert catalog['/tool.v2/parentplugin/mcp-tool'].description == 'stale parent schema'
 
 
 @pytest.mark.asyncio
 async def test_list_actions_registered_canonical_coexists_with_qualified_dap_rows() -> None:
-    """Registered ``/tool.v2/...`` row is the catalog key; DAP children are not listed."""
+    """A DAP child sharing a registered tool's name gets its own row, it does not replace it."""
     tool_name = 'suite/same-canonical'
 
     async def registered_fn(_: str) -> str:
@@ -461,7 +464,7 @@ async def dap_fn() -> DapValue:
     assert canonical in catalog
     assert catalog[canonical].description == 'from registry registration'
 
-    assert qualified not in catalog
+    assert catalog[qualified].description == 'from dap nested'
     assert provider_key in catalog
 
 
@@ -543,3 +546,289 @@ async def resolve(self, action_type: ActionKind, name: str) -> Action | None:
     assert got is not None
     assert got.kind == ActionKind.BACKGROUND_MODEL
     assert got.name == 'plug/veo-2.0-generate-001'
+
+
+def _dap_child(name: str, description: str) -> Action:
+    async def child_fn(x: str) -> str:
+        return x
+
+    return Action(kind=ActionKind.TOOL, name=name, fn=child_fn, description=description)
+
+
+@pytest.mark.asyncio
+async def test_list_actions_expands_dap_children() -> None:
+    """Every child gets a catalog row under the key resolve_action_by_key accepts."""
+    registry = Registry()
+    registry.register_action(kind=ActionKind.TOOL, name='local-tool', fn=_identity)
+
+    async def dap_fn() -> DapValue:
+        return {'tool': [_dap_child('echo', 'echoes'), _dap_child('add', 'adds')]}
+
+    define_dynamic_action_provider(registry, 'mcp', dap_fn)
+
+    catalog = await registry.list_actions()
+
+    assert '/tool.v2/local-tool' in catalog
+    assert '/dynamic-action-provider/mcp' in catalog
+    echo = catalog['/dynamic-action-provider/mcp:tool/echo']
+    assert echo.key == '/dynamic-action-provider/mcp:tool/echo'
+    assert echo.name == 'echo'
+    assert echo.action_type == 'tool'
+    assert echo.description == 'echoes'
+    assert '/dynamic-action-provider/mcp:tool/add' in catalog
+    assert await registry.resolve_action_by_key(echo.key) is not None
+
+
+@pytest.mark.asyncio
+async def test_list_actions_without_dap_is_unaffected() -> None:
+    """A registry with no provider lists exactly its registered actions."""
+    registry = Registry()
+    registry.register_action(kind=ActionKind.TOOL, name='local-tool', fn=_identity)
+    registry.register_action(kind=ActionKind.CUSTOM, name='local-custom', fn=_identity)
+
+    catalog = await registry.list_actions()
+
+    assert sorted(catalog) == ['/custom/local-custom', '/tool.v2/local-tool']
+
+
+@pytest.mark.asyncio
+async def 
```

#### Recent Merged Pull Requests:
- **PR #6567** (2026-10-06): feat(py): export get_logger from genkit (@huangjeff5)
- **PR #6566** (closed): test(py): alias genkit.exp.Genkit as GenkitExp, matching JS GenkitBeta (@huangjeff5)
- **PR #6561** (closed): fix(py)!: unknown part keys and resource parts raise (@huangjeff5)
- **PR #6550** (2026-10-06): feat(py)!: remove Document.data, Document.data_type, and Document.from_data (@huangjeff5)
- **PR #6538** (2026-10-06): fix(py)!: actions take one input; context arrives by its ActionRunContext annotation (@huangjeff5)
- **PR #6537** (2026-10-06): fix(py)!: response.output is typed OutputT | None (@huangjeff5)
- **PR #6536** (2026-10-06): feat(py)!: require keyword arguments in Genkit constructor (@huangjeff5)
- **PR #6512** (2026-10-06): feat(py)!: stop exporting KnownGpt and KnownClaude (@huangjeff5)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
