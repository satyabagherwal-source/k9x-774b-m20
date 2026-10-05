# Forensic Learning Record (Deep Inspection): IvanMurzak/Unity-MCP

> **Canonical Artifact**: `07_PROJECT_LEARNING/ivanmurzak-unity-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/IvanMurzak/Unity-MCP](https://github.com/IvanMurzak/Unity-MCP))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:51:00.188Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `IvanMurzak/Unity-MCP`
- **Description**: AI Skills, MCP Tools, and CLI for Unity Engine. Full AI develop and test loop. Use cli for quick setup. Efficient token usage, advanced tools. Any C# method may be turned into a tool by a single line. Works with Claude Code, Gemini, Copilot, Cursor and any other absolutely for free.
- **Primary Language / Ecosystem**: C#
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 4368 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/bin/unity-mcp-cli.js`
```
#!/usr/bin/env node
import '../dist/index.js';

```

### Core Architecture Module: `cli/src/cli.ts`
```
// CLI entry for `unity-mcp-cli`, exported at the `./cli` subpath.
//
// Importing this file runs the Commander-based CLI exactly as the
// `unity-mcp-cli` binary does — it parses argv, dispatches subcommands,
// and exits the process.
//
// Consumers that want the programmatic, side-effect-free surface
// should import the package root (`import { installPlugin } from
// "unity-mcp-cli"`) — NOT this file.

import './index.js';

```

### Core Architecture Module: `cli/src/commands/bootstrap-local.ts`
```
// Copyright (c) 2025 Ivan Murzak. All rights reserved.
// Licensed under the Apache License, Version 2.0.

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import * as ui from '../utils/ui.js';
import { verbose } from '../utils/ui.js';
import { resolveAndValidateProjectPath } from '../utils/connection.js';
import {
  readConfig,
  writeConfig,
  type UnityConnectionConfig,
} from '../utils/config.js';

interface BootstrapLocalOptions {
  path?: string;
  url?: string;
  token?: string;
  dryRun?: boolean;
}

/**
 * Produce a new config object with local-mode fields pinned to `url` / `token`.
 * Preserves all other keys from `current` (immutable update — does not mutate `current`).
 *
 * The plugin-side ConnectionMode enum only accepts "Custom" (local) or "Cloud".
 * We intentionally normalize any integer (0 → Custom, 1 → Cloud) representation
 * to the canonical string "Custom" so the on-disk file is explicit.
 */
export function pinLocalModeConfig(
  current: Readonly<UnityConnectionConfig>,
  url: string,
  token: string,
): UnityConnectionConfig {
  return {
    ...current,
    connectionMode: 'Custom',
    host: url,
    token,
  };
}

/**
 * Returns true iff `current` already reflects local mode with matching url + token.
 * Used to make bootstrap-local a no-op when nothing would change on disk.
 */
export function isAlreadyPinned(
  current: Readonly<UnityConnectionConfig>,
  url: string,
  token: string,
): boolean {
  // Accept both "Custom" (string) and 0 (legacy int) as already-local.
  // Anything else (including "Cloud", 1, or unset) means we still need to pin.
  const mode = current.connectionMode;
  if (mode !== 'Custom' && mode !== 0) return false;
  return current.host === url && current.token === token;
}

export const bootstrapLocalCommand = new Command('bootstrap-local')
  .description(
    'Pin a Unity project\'s MCP config to local mode with the given URL/token. Idempotent.',
  )
  .argument('[path]', 'Unity project path (defaults to cwd)')
  .option('--path <path>', 'Unity project path (defaults to cwd)')
  .requiredOption('--url <url>', 'Local MCP server URL to pin (e.g. http://localhost:5140/)')
  .requiredOption('--token <token>', 'Local MCP bearer token to pin')
  .option('--dry-run', 'Report what would change without writing to disk')
  .action(async (positionalPath: string | undefined, options: BootstrapLocalOptions) => {
    const projectPath = resolveAndValidateProjectPath(positionalPath, options);

    // commander's requiredOption guarantees url/token are defined before the action runs.
    const url = options.url!.replace(/\/$/, '');
    const token = options.token!;

    verbose(`Project path: ${projectPath}`);
    verbose(`Target URL: ${url}`);
    verbose(`Target token: ${'*'.repeat(Math.min(token.length, 8))}... (length ${token.length})`);

    const configPath = path.join(projectPath, 'UserSettings', 'AI-Game-Developer-Config.json');
    const existedBefore = fs.existsSync(configPath);

    // Use readConfig (not getOrCreateConfig) so --dry-run truly has no side effects.
    // When the file doesn't exist we pin onto an empty base; this mirrors a fresh
    // worktree where the plugin has not yet written its default Cloud config.
    const current: UnityConnectionConfig = readConfig(projectPath) ?? {};

    if (isAlreadyPinned(current, url, token)) {
      ui.success(
        `MCP config already pinned to local mode (${url}). No changes written.`,
      );
      return;
    }

    const next = pinLocalModeConfig(current, url, token);

    if (options.dryRun) {
      ui.heading('bootstrap-local (dry run)');
      ui.label('Config file', configPath);
      ui.label('connectionMode', `${String(current.connectionMode ?? 'unset')} → Custom`);
      ui.label('host', `${String(current.host ?? 'unset')} → ${url}`);
      ui.label('token', `${current.token ? '<previous>' : '<unset>'} → <supplied>`);
      ui.info('No changes written (--dry-run).');
      return;
    }

    writeConfig(projectPath, next);

    ui.heading('bootstrap-local');
    ui.label('Config file', configPath);
    ui.label('connectionMode', 'Custom');
    ui.label('host', url);
    ui.label('token', '<supplied>');
    ui.success(
      existedBefore
        ? 'Config updated to pin local mode.'
        : 'Config created and pinned to local mode.',
    );
  });

```

### Core Architecture Module: `cli/src/commands/close.ts`
```
import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { platform as nodePlatform } from 'os';
import * as ui from '../utils/ui.js';
import { verbose } from '../utils/ui.js';
import { findUnityProcess } from '../utils/unity-process.js';
import {
  readLockfilePid,
  isProcessAlive,
  sendGracefulShutdown,
  sendForceKill,
  waitForExit,
  type SupportedPlatform,
} from '../utils/unity-shutdown.js';

export interface CloseOptions {
  timeout?: string;
  force?: boolean;
}

const DEFAULT_TIMEOUT_SECONDS = 30;

/**
 * Resolve the project path argument to an absolute, canonical path.
 *
 * Mirrors the convention used by `open` / `wait-for-ready` — accepts a
 * positional argument or `process.cwd()` fallback, normalises symlinks where
 * possible, and trims any trailing path separator. Exported for unit tests.
 */
export function resolveCloseProjectPath(positionalPath: string | undefined, cwd: string): string {
  const explicit = positionalPath ?? cwd;
  let resolved = path.resolve(explicit);

  // realpathSync collapses symlinks, ".." segments, and trailing separators
  // when the path exists. When it does not, fall through to the resolved
  // form so the caller can produce a "path does not exist" error.
  try {
    resolved = fs.realpathSync(resolved);
  } catch {
    // Path may not exist — let the caller decide what to do.
  }

  return resolved;
}

/**
 * Returns true when `<projectPath>/ProjectSettings/ProjectVersion.txt` exists.
 *
 * The issue's acceptance criteria require refusing to act on any path that
 * does not look like a Unity project root (`ProjectVersion.txt` is the
 * canonical marker). This is intentionally narrower than the `open`
 * subcommand's check — the goal here is to defend against accidental
 * "kill all Unity processes on host" invocations, so a positive ID of
 * "this is a Unity project" is required.
 *
 * Exported for unit tests.
 */
export function isUnityProjectRoot(projectPath: string): boolean {
  return fs.existsSync(path.join(projectPath, 'ProjectSettings', 'ProjectVersion.txt'));
}

/**
 * Parse a positive-integer `--timeout` value (seconds). Returns the parsed
 * value, or `null` when the input is not a valid positive integer.
 *
 * The `undefined` branch falls back to the default for ergonomic
 * direct-call use (e.g., unit tests). The action handler never reaches it
 * because commander always materialises the configured default string.
 *
 * Exported for unit tests.
 */
export function parseTimeoutSeconds(raw: string | undefined): number | null {
  if (raw === undefined) return DEFAULT_TIMEOUT_SECONDS;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

/**
 * Resolve the editor PID for a given project path.
 *
 * Reads `<project>/Temp/UnityLockfile` (4 bytes LE uint32) and enumerates
 * Unity processes by command line, then prefers the lockfile PID when it
 * is alive and matches the enumerated process for this project (handles
 * stale lockfiles); otherwise uses the enumerated PID.
 *
 * Symlink/realpath handling: `resolveCloseProjectPath` canonicalises via
 * `realpathSync` while `findUnityProcess` only `path.resolve`s the cmdline
 * `-projectPath` argument. If Unity was launched via a symlink, the first
 * lookup misses. We retry against the un-canonicalised form so a symlinked
 * launch path doesn't silently degrade close to a no-op.
 *
 * Returns `null` when no live editor matches the project. Exported for tests.
 */
export function resolveEditorPid(projectPath: string, platform: SupportedPlatform = nodePlatform() as SupportedPlatform): number | null {
  const lockPid = readLockfilePid(projectPath);
  // Enumerate Unity processes once. `findUnityProcess` shells out (3s timeout
  // on Windows via PowerShell+CIM, 5s on POSIX via `ps`), so calling it twice
  // on the stale-lockfile path used to roughly double close latency.
  let proc = findUnityProcess(projectPath);

  // Symlink fallback: if the canonical realpath form found no process, retry
  // with `path.resolve` only (no realpath collapse) — that matches what
  // `findUnityProcess` derives from the cmdline `-projectPath` argument.
  if (!proc) {
    const resolvedNoRealpath = path.resolve(projectPath);
    if (resolvedNoRealpath !== projectPath) {
      proc = findUnityProcess(resolvedNoRealpath);
    }
  }

  if (lockPid !== null && isProcessAlive(lockPid, platform)) {
    if (proc && proc.pid === lockPid) {
      verbose(`Lockfile PID ${lockPid} confirmed via process enumeration`);
      return lockPid;
    }
    // Lockfile alive but no matching enumerated process — the lockfile may
    // still be authoritative if the asymmetry is purely realpath/symlink
    // related (process listed under symlink path while we queried by realpath).
    // Trust the live lockfile PID in that case rather than discarding it.
    if (!proc) {
      verbose(`Lockfile PID ${lockPid} alive but no enumerated match — using lockfile PID (likely symlink/path mismatch)`);
      return lockPid;
    }
    verbose(`Lockfile PID ${lockPid} did not match enumerated Unity process for project — treating as stale`);
  }

  return proc ? proc.pid : null;
}

export const closeCommand = new Command('close')
  .description('Gracefully terminate the Unity Editor instance running for a given project path')
  .argument('[path]', 'Path to the Unity project (defaults to current directory)')
  .option('--timeout <seconds>', `Polite-quit timeout in seconds (default: ${DEFAULT_TIMEOUT_SECONDS})`, String(DEFAULT_TIMEOUT_SECONDS))
  .option('--force', 'Hard-kill the Editor if it does not exit within --timeout')
  .action(async (positionalPath: string | undefined, options: CloseOptions) => {
    const projectPath = resolveCloseProjectPath(positionalPath, process.cwd());
    verbose(`close invoked for project: ${projectPath}`);

    if (!fs.existsSync(projectPath)) {
      ui.error(`Project path does not exist: ${projectPath}`);
      process.exit(1);
    }

    if (!isUnityProjectRoot(projectPath)) {
      ui.error(`Not a Unity project root: ${projectPath}`);
      process.exit(1);
    }

    const timeoutSeconds = parseTimeoutSeconds(options.timeout);
    if (timeoutSeconds === null) {
      ui.error(`Invalid --timeout value: "${options.timeout}". Must be a positive integer (seconds).`);
      process.exit(1);
    }

    const platform = nodePlatform() as SupportedPlatform;
    const pid = resolveEditorPid(projectPath, platform);

    if (pid === null) {
      ui.success(`no running Editor for project at ${projectPath}`);
      process.exit(0);
    }

    ui.heading('Closing Unity Editor');
    ui.label('Project', projectPath);
    ui.label('PID', String(pid));
    ui.label('Timeout', `${timeoutSeconds}s`);
    ui.label('Force', options.force ? 'yes' : 'no');
    ui.divider();

    // TOCTOU window: between resolveEditorPid returning and the signal call
    // below, the original Unity process could exit and the OS could reuse
    // the same numeric PID for an unrelated process (more likely on POSIX,
    // where PIDs cycle aggressively). We accept the residual risk — the
    // lockfile cross-check above already narrows it, holding a lock across
    // a spawned Editor's lifetime is impractical, and the signals we send
    // (SIGTERM / WM_CLOSE) are best-effort, not destructive.
    const spinner = ui.startSpinner(`Sending polite-quit to PID ${pid}...`);
    const sent = sendGracefulShutdown(pid, platform);
    if (!sent) {
      spinner.error(`Failed to deliver polite-quit signal to PID ${pid}`);
      process.exit(1);
    }

    spinner.text = `Waiting up to ${timeoutSeconds}s for PID ${pid} to exit...`;
    const timeoutMs = timeoutSeconds * 1000;
    const exited = await waitForExit(pid, timeoutMs, platform);

    if (exited) {
      spinner.success(`Unity Editor (PID ${pid}) exited cleanly`);
      process.exit(0);
    }

    if (!options.force) {
      spinner.error(
        `Uni
```

### Core Architecture Module: `cli/src/commands/configure.ts`
```
import { Command } from 'commander';
import * as path from 'path';
import * as ui from '../utils/ui.js';
import { verbose } from '../utils/ui.js';
import { configure } from '../lib/configure.js';
import { proxyConfigure } from '../utils/managed-server.js';
import type { FeatureAction } from '../lib/types.js';

function parseCommaSeparated(value: string): string[] {
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

function buildAction(
  enable: string[] | undefined,
  disable: string[] | undefined,
  enableAll: boolean | undefined,
  disableAll: boolean | undefined,
): FeatureAction | undefined {
  if (!enable && !disable && !enableAll && !disableAll) return undefined;
  return {
    enableNames: enable,
    disableNames: disable,
    enableAll,
    disableAll,
  };
}

export const configureCommand = new Command('configure')
  .description('Configure MCP tools/prompts/resources, or (with --agent) write an AI agent config via the managed server')
  .argument('[path]', 'Path to the Unity project')
  .option('--path <path>', 'Path to the Unity project')
  .option('--agent <id>', 'Write an AI agent MCP config by proxying to the managed GameDev-MCP-Server configurator')
  .option('--url <url>', 'Explicit server URL forwarded to the managed configurator (with --agent)')
  .option('--enable-tools <names>', 'Enable specific tools (comma-separated)', parseCommaSeparated)
  .option('--disable-tools <names>', 'Disable specific tools (comma-separated)', parseCommaSeparated)
  .option('--enable-all-tools', 'Enable all tools')
  .option('--disable-all-tools', 'Disable all tools')
  .option('--enable-prompts <names>', 'Enable specific prompts (comma-separated)', parseCommaSeparated)
  .option('--disable-prompts <names>', 'Disable specific prompts (comma-separated)', parseCommaSeparated)
  .option('--enable-all-prompts', 'Enable all prompts')
  .option('--disable-all-prompts', 'Disable all prompts')
  .option('--enable-resources <names>', 'Enable specific resources (comma-separated)', parseCommaSeparated)
  .option('--disable-resources <names>', 'Disable specific resources (comma-separated)', parseCommaSeparated)
  .option('--enable-all-resources', 'Enable all resources')
  .option('--disable-all-resources', 'Disable all resources')
  .option('--list', 'List current configuration')
  .action(async (positionalPath: string | undefined, options: {
    path?: string;
    agent?: string;
    url?: string;
    enableTools?: string[];
    disableTools?: string[];
    enableAllTools?: boolean;
    disableAllTools?: boolean;
    enablePrompts?: string[];
    disablePrompts?: string[];
    enableAllPrompts?: boolean;
    disableAllPrompts?: boolean;
    enableResources?: string[];
    disableResources?: string[];
    enableAllResources?: boolean;
    disableAllResources?: boolean;
    list?: boolean;
  }) => {
    const resolvedPath = positionalPath ?? options.path;
    if (!resolvedPath) {
      ui.error('Path is required. Usage: unity-mcp-cli configure <path> or --path <path>');
      process.exit(1);
    }

    const projectPath = path.resolve(resolvedPath);

    // `--agent` mode: proxy to the managed GameDev-MCP-Server binary's `configure` subcommand
    // (design 06/09 Phase 3) so the shared C# configurator writes the agent config with the
    // derived project pin + port. This is a distinct mode from the tools/prompts/resources
    // toggles below and short-circuits them.
    if (options.agent) {
      verbose(`Proxying configure --agent ${options.agent} to the managed server for: ${projectPath}`);
      try {
        proxyConfigure({ agentId: options.agent, projectPath, url: options.url });
      } catch (err) {
        ui.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
      ui.success(`Configured agent "${options.agent}" via the managed server.`);
      return;
    }

    verbose(`Loading config for project: ${projectPath}`);

    // `--list` must be read-only: previously this command short-
    // circuited before applying any enable/disable flags. Preserve
    // that semantics by suppressing the mutating actions whenever
    // `options.list` is set, regardless of other flags.
    const toolsAction = buildAction(
      options.enableTools,
      options.disableTools,
      options.enableAllTools,
      options.disableAllTools,
    );
    const promptsAction = buildAction(
      options.enablePrompts,
      options.disablePrompts,
      options.enableAllPrompts,
      options.disableAllPrompts,
    );
    const resourcesAction = buildAction(
      options.enableResources,
      options.disableResources,
      options.enableAllResources,
      options.disableAllResources,
    );

    const result = await configure({
      unityProjectPath: projectPath,
      tools: options.list ? undefined : toolsAction,
      prompts: options.list ? undefined : promptsAction,
      resources: options.list ? undefined : resourcesAction,
    });

    if (result.kind === 'failure') {
      ui.error(result.error.message);
      process.exit(1);
    }

    // Narrowed: result.kind === 'success' below — `snapshot` is
    // non-optional.
    if (options.list) {
      ui.heading('Current configuration');
      ui.label('Host', result.snapshot.host ?? 'not set');
      ui.label('Keep Connected', String(result.snapshot.keepConnected ?? false));
      ui.label('Transport', result.snapshot.transportMethod ?? 'streamableHttp');
      ui.label('Auth', result.snapshot.authOption ?? 'none');

      const printFeatures = (featureLabel: string, features: { name: string; enabled: boolean }[]) => {
        ui.heading(featureLabel);
        if (features.length === 0) {
          ui.info('(none configured - all enabled by default)');
          return;
        }
        for (const f of features) {
          ui.featureRow(f.name, f.enabled);
        }
      };

      printFeatures('Tools', result.snapshot.tools);
      printFeatures('Prompts', result.snapshot.prompts);
      printFeatures('Resources', result.snapshot.resources);
      return;
    }

    verbose('Writing updated configuration');
    ui.success('Configuration updated successfully.');
  });

```

### Core Architecture Module: `cli/src/commands/create-project.ts`
```
import { Command } from 'commander';
import { ensureUnityHub } from '../utils/unity-hub.js';
import * as ui from '../utils/ui.js';
import { verbose } from '../utils/ui.js';
import { createProject } from '../lib/create-project.js';

export const createProjectCommand = new Command('create-project')
  .description('Create a new Unity project')
  .argument('[path]', 'Path where the project will be created')
  .option('--path <path>', 'Path where the project will be created')
  .option('--unity <version>', 'Unity Editor version to use')
  .action(async (positionalPath: string | undefined, options: { path?: string; unity?: string }) => {
    const resolvedPath = positionalPath ?? options.path;
    if (!resolvedPath) {
      ui.error('Path is required. Usage: unity-mcp-cli create-project <path> or --path <path>');
      process.exit(1);
    }

    // Hub bootstrap stays on the CLI surface: `ensureUnityHub` may
    // download + install Unity Hub (spinners, possible admin prompt),
    // which the library deliberately never does. The resolved path is
    // handed to the library so discovery is not repeated.
    const hubSpinner = ui.startSpinner('Locating Unity Hub...');
    let hubPath: string;
    try {
      hubPath = await ensureUnityHub();
    } catch (err) {
      hubSpinner.error('Failed to locate Unity Hub');
      throw err;
    }
    hubSpinner.success('Unity Hub located');
    verbose(`Unity Hub path: ${hubPath}`);

    let createSpinner: ReturnType<typeof ui.startSpinner> | undefined;

    // All project-creation logic lives in the shared library function;
    // this command only renders progress and maps the result onto the
    // historical CLI output / exit codes.
    const result = await createProject({
      projectPath: resolvedPath,
      editorVersion: options.unity,
      hubPath,
      onProgress: (event) => {
        switch (event.phase) {
          case 'editors-located': {
            // The Hub query is synchronous (it has already returned by the
            // time this fires), so emit the result line directly to keep
            // parity with the old "Found N installed editors" output rather
            // than leaving the user with no feedback during the query.
            ui.info(event.message);
            break;
          }
          case 'editor-resolved': {
            if (!options.unity && event.version) {
              ui.info(`No Unity version specified, using highest installed: ${event.version}`);
            }
            verbose(`Unity Editor executable: ${event.editorPath}`);
            break;
          }
          case 'creating-project': {
            ui.info(`Creating Unity project at: ${event.projectPath}`);
            ui.label('Unity Editor', `${event.version} (${event.editorPath})`);
            createSpinner = ui.startSpinner('Creating project...');
            break;
          }
          default:
            break;
        }
      },
    });

    if (result.kind === 'failure') {
      if (createSpinner) {
        createSpinner.error('Project creation failed');
        createSpinner = undefined;
      }
      ui.error(result.errorMessage);
      process.exit(1);
    }

    if (createSpinner) {
      createSpinner.stop();
      createSpinner = undefined;
    }
    ui.success('Project created successfully.');
  });

```

### Core Architecture Module: `cli/src/commands/install-extension.ts`
```
import { Command } from 'commander';
import * as ui from '../utils/ui.js';
import { verbose } from '../utils/ui.js';
import { installExtension } from '../lib/install-extension.js';
import { EXTENSIONS_CATALOG } from '../utils/extensions-catalog.js';
import { resolveInstallTarget, unityAdapter } from '@baizor/gamedev-cli-core';

interface InstallExtensionCliOptions {
  path?: string;
  extensionVersion?: string;
  list?: boolean;
}

export const installExtensionCommand = new Command('install-extension')
  .description(
    'Install a Unity-MCP extension into a Unity project: resolve the extension <id> from the shared catalogue, add (or update) its dependency plus the OpenUPM scoped registry in Packages/manifest.json, then let Unity resolve it. Idempotent. The project path defaults to the current directory (like install-plugin).',
  )
  .argument('[id]', 'Extension to install (the OpenUPM package id, or the catalogue name e.g. "Tilemap")')
  .argument('[path]', 'Path to the Unity project (defaults to the current directory)')
  .option('--path <path>', 'Path to the Unity project')
  // NOT `--version`: the root program registers `-V, --version` via `.version()`, which
  // intercepts it before this subcommand sees it — `install-extension X --version 1.2.3`
  // would print the CLI's own version and exit 0 without installing anything. This is the
  // same reason `install-plugin` spells its flag `--plugin-version`.
  .option('--extension-version <version>', 'Extension version to install (default: latest from OpenUPM)')
  .option('--list', 'List the installable extensions and exit')
  .action(async (id: string | undefined, positionalPath: string | undefined, options: InstallExtensionCliOptions) => {
    // `--list` is a pure read: no project needed, no network, exit 0.
    if (options.list) {
      ui.heading('Installable Unity-MCP extensions');
      for (const ext of EXTENSIONS_CATALOG) {
        ui.label(ext.name, ext.packageId);
      }
      ui.info(
        `${EXTENSIONS_CATALOG.length} extensions. Install one with: unity-mcp-cli install-extension <id> [path]`,
      );
      return;
    }

    if (!id || id.trim() === '') {
      ui.error(
        'Missing extension id. Pass one (e.g. `unity-mcp-cli install-extension Tilemap`), or run with --list to see what is installable.',
      );
      process.exit(1);
    }

    // Same path resolution as install-plugin: `path? → --path? → cwd`, then verify the
    // directory really is a Unity project so the error names what was checked.
    const target = resolveInstallTarget({
      adapter: unityAdapter,
      positional: positionalPath,
      path: options.path,
    });
    if (target.kind === 'failure') {
      ui.error(target.error.message);
      process.exit(1);
    }

    const projectPath = target.projectRoot;

    ui.heading('Installing Unity-MCP extension');
    verbose(`Extension id: ${id}`);
    verbose(`Project path: ${projectPath}`);
    if (options.extensionVersion) verbose(`--extension-version: ${options.extensionVersion}`);

    let spinner: ReturnType<typeof ui.startSpinner> | undefined;
    if (!options.extensionVersion) {
      spinner = ui.startSpinner('Resolving latest extension version...');
    }

    const result = await installExtension({
      unityProjectPath: projectPath,
      extensionId: id,
      version: options.extensionVersion,
      onProgress: (event) => {
        if (event.phase === 'dependencies-resolved' && spinner) {
          spinner.success(`Resolved extension version: ${event.version}`);
          spinner = undefined;
          return;
        }
        if (event.phase === 'manifest-patched') {
          verbose(event.message);
        }
      },
    });

    if (result.kind === 'failure') {
      if (spinner) {
        spinner.error('Failed to resolve extension version');
        spinner = undefined;
      }
      ui.error(result.error.message);
      for (const warning of result.warnings) {
        ui.warn(warning);
      }
      process.exit(1);
    }

    switch (result.outcome) {
      case 'added':
        ui.success(`Installed ${result.packageId} ${result.toVersion}`);
        break;
      case 'updated':
        ui.success(`Updated ${result.packageId} ${result.fromVersion} → ${result.toVersion}`);
        break;
      case 'already-up-to-date':
        ui.info(`${result.packageId} is already up to date (${result.toVersion})`);
        break;
    }

    ui.label('Status', result.message);
    ui.label('Manifest', result.manifestPath);

    for (const warning of result.warnings) {
      ui.warn(warning);
    }
    for (const step of result.nextSteps) {
      ui.label('Next step', step);
    }
  });

```

### Core Architecture Module: `cli/src/commands/install-plugin.ts`
```
import { Command } from 'commander';
import * as fs from 'fs';
import * as ui from '../utils/ui.js';
import { verbose } from '../utils/ui.js';
import { installPlugin } from '../lib/install-plugin.js';
import { downloadServerBinary } from '../utils/managed-server.js';
import { DEFAULT_SERVER_VERSION } from '../utils/server-version.js';
import { resolveEnrollCode, runEnroll, EnrollmentError } from '../utils/enroll.js';
import { MachineCredentialStore } from '../utils/machine-credentials.js';
import { resolveInstallTarget, unityAdapter } from '@baizor/gamedev-cli-core';

interface InstallPluginOptions {
  path?: string;
  pluginVersion?: string;
  withServer?: boolean;
  serverVersion?: string;
  serverSource?: string;
  enroll?: string;
  enrollStdin?: boolean;
  yes?: boolean;
}

export const installPluginCommand = new Command('install-plugin')
  .description('Install Unity-MCP plugin into a Unity project (optionally download the server + enroll)')
  .argument('[path]', 'Path to the Unity project')
  .option('--path <path>', 'Path to the Unity project')
  .option('--plugin-version <version>', 'Plugin version to install (default: latest)')
  .option('--with-server', 'Also download the RID-matched GameDev-MCP-Server binary into the CLI managed dir')
  .option('--server-version <version>', `Server version to download with --with-server (default: ${DEFAULT_SERVER_VERSION})`)
  .option('--server-source <path-or-url>', 'Offline/CI override: install the server from a local zip path or URL (skips SHA256SUMS verification)')
  .option('--enroll <code>', 'Redeem an enrollment code for a plugin credential (planted in the shared machine store)')
  .option('--enroll-stdin', 'Read the enrollment code from stdin (never argv/shell history)')
  .option('--yes', 'Assume "yes" for prompts (e.g. confirming an account switch during --enroll)')
  .action(async (positionalPath: string | undefined, options: InstallPluginOptions) => {
    // T5/B1: path is OPTIONAL — resolve `path? → --path? → cwd`, then verify the directory is a real
    // Unity project (marker probe for `Packages/manifest.json`). On a miss the error lists exactly
    // what was checked, so `install-plugin` "just works" from a project folder with no path.
    const target = resolveInstallTarget({
      adapter: unityAdapter,
      positional: positionalPath,
      path: options.path,
    });
    if (target.kind === 'failure') {
      ui.error(target.error.message);
      process.exit(1);
    }

    const projectPath = target.projectRoot;

    // ── Phase 1: install the plugin into the Unity project's manifest ────────
    // Wire the library's progress events back into the CLI's chalk-
    // styled ui so the terminal experience stays identical.
    let spinner: ReturnType<typeof ui.startSpinner> | undefined;
    if (!options.pluginVersion) {
      spinner = ui.startSpinner('Resolving latest plugin version...');
    }

    const result = await installPlugin({
      unityProjectPath: projectPath,
      version: options.pluginVersion,
      onProgress: (event) => {
        if (event.phase === 'dependencies-resolved' && spinner) {
          spinner.success(`Resolved plugin version: ${event.version}`);
          spinner = undefined;
          return;
        }
        if (event.phase === 'manifest-patched') {
          // Preserve the historical `ui.success("Updated …")` vs
          // `ui.info("manifest.json is already up to date.")` split
          // that the shared manifest helpers used to print directly.
          if (event.message.startsWith('Updated ')) {
            ui.success(event.message);
          } else {
            ui.info(event.message);
          }
        }
      },
    });

    if (result.kind === 'failure') {
      if (spinner) {
        spinner.error('Failed to resolve plugin version');
        spinner = undefined;
      }
      ui.error(result.error.message);
      process.exit(1);
    }

    // Narrowed: result.kind === 'success' below — `installedVersion`
    // and `manifestPath` are non-optional.
    verbose(`Plugin version: ${result.installedVersion} (explicit: ${!!options.pluginVersion})`);
    verbose(`Manifest path: ${result.manifestPath}`);
    ui.info(`Installing Unity-MCP plugin v${result.installedVersion} into: ${projectPath}`);

    for (const warning of result.warnings) {
      ui.warn(warning);
    }

    // ── Phase 2: download the RID-matched server binary (--with-server) ──────
    if (options.withServer) {
      const serverSpinner = ui.startSpinner('Downloading GameDev-MCP-Server binary...');
      try {
        const download = await downloadServerBinary({
          version: options.serverVersion ?? DEFAULT_SERVER_VERSION,
          source: options.serverSource,
          onProgress: (msg) => {
            serverSpinner.text = msg;
            verbose(msg);
          },
        });
        serverSpinner.success(
          `Server ${download.rid} v${download.version} installed${download.verified ? ' (checksum verified)' : ''}`,
        );
        ui.label('Server binary', download.binaryPath);
      } catch (err) {
        serverSpinner.error('Server download failed');
        ui.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    }

    // ── Phase 3: redeem an enrollment code (--enroll / --enroll-stdin) ───────
    if (options.enroll || options.enrollStdin) {
      let code: string;
      try {
        code = resolveEnrollCode(
          { enroll: options.enroll, enrollStdin: options.enrollStdin },
          () => fs.readFileSync(0, 'utf-8'),
        );
      } catch (err) {
        ui.error(err instanceof Error ? err.message : String(err));
        process.exit(1);
      }

      const enrollSpinner = ui.startSpinner('Redeeming enrollment code...');
      try {
        const enrolled = await runEnroll({
          code,
          projectPath,
          adapter: unityAdapter,
          store: new MachineCredentialStore(),
          // D6/F7 account-switch guard (`--yes`-gated): enroll is a non-interactive surface, so
          // without --yes a subject mismatch is DECLINED (the just-redeemed family is revoked
          // best-effort by cli-core; the store stays untouched).
          confirmAccountSwitch: async (info) => {
            if (options.yes) return true;
            ui.warn(
              `This machine is signed in as "${info.storedSubject}"; the enrollment code belongs to "${info.newSubject}".`,
            );
            return false;
          },
        });
        if (enrolled.status === 'switch-declined') {
          enrollSpinner.error('Enrollment aborted');
          ui.error(
            'Account switch declined — nothing was changed. Re-run with --yes to switch this machine to the new account.',
          );
          process.exit(1);
        }
        if (enrolled.status === 'aborted') {
          enrollSpinner.error('Enrollment aborted');
          ui.error('The credential store changed while enrolling. Re-run the command.');
          process.exit(1);
        }
        enrollSpinner.success('Enrollment complete');
        ui.label('Credential', enrolled.credentialPath);
        ui.label('Server target', enrolled.serverTarget);
        ui.label('Project marker', enrolled.markerPath);
        ui.label('Project pin', enrolled.pin);
        if (enrolled.pinnedConfigs.length > 0) {
          for (const cfg of enrolled.pinnedConfigs) {
            ui.info(`Pinned project routing in ${cfg}`);
          }
        }
      } catch (err) {
        enrollSpinner.error('Enrollment failed');
        ui.error(err instanceof EnrollmentError || err instanceof Error ? err.message : String(err));
        process.exit(1);
      }
    }

    ui.success('Done! Open the project in Unity Editor to complete installation.');
  });

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

### Incident Patch 1: `ed316782` (2026-09-27)
**Commit Message**: test(chain): commit the Unity 6000.6.3f1 editor tool-contract fixture

Recorded by the 6000.6.3f1 base/editmode leg (run 36286648729). Same 78 tools
as 6000.3.1f1; the only contract differences are the 6.5+ EntityId shape
(instanceID is a $ref to UnityEngine.EntityId instead of an integer).

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_016wRnXX11seX5vLSSodUjf3



---

### Incident Patch 2: `3670b7af` (2026-09-26)
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

### Incident Patch 3: `38447de1` (2026-09-26)
**Commit Message**: fix(cli): print the update command alone on its own line

Move the bare `npm i -g unity-mcp-cli` onto its own line under the
"Update available: X -> Y. To update, run:" header, so nothing can be
copied into the command. The test now pins that the line containing
`npm i -g` is exactly the command and ends with the package name.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
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

### Incident Patch 4: `19c829f3` (2026-09-26)
**Commit Message**: fix(cli): make the update hint safe to copy-paste

The update notice read "Run npm i -g unity-mcp-cli to update". Copying the
whole line ran `npm i -g unity-mcp-cli to update`, which also installs the
unrelated npm packages `to` and `update`; `update@0.7.4` drags in ~630
packages and prints the set-value/glob/rimraf/inflight/lodash.isequal
deprecation warnings. unity-mcp-cli itself installs 6 packages with zero
deprecation warnings.

Reword to "To update, run: npm i -g unity-mcp-cli@latest" so the command
ends the line, and add a regression test that fails on the old wording.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
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

### Incident Patch 5: `81412e91` (2026-09-23)
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
+            // Same button + label styling, and the tooltip is kept
```

---

### Incident Patch 6: `03a6f90f` (2026-09-23)
**Commit Message**: fix(ui): align "Regenerate key" right edge with Configure

The project-key row was appended to the template root, a sibling of the
`.row` wrapper, so it escaped `.row > * { margin-right: 8px }` and its
button sat 8px further right than Configure. Add it to the same
`templateConfigurationStatus` column that holds the Configure row, so one
rule insets both.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
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

### Incident Patch 7: `a5913bb0` (2026-09-23)
**Commit Message**: fix(cli): open — Cloud auto-setup keys on the connection mode, not cloudToken

The App no longer writes cloudToken (the plugin stopped reading it in
b08d6943), so openProject never enabled claude-code skill auto-gen /
keep-connected for a Cloud project. Gate the block on Cloud mode alone.
Test plants: re-adding the cloudToken gate reddens it.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
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

### Incident Patch 8: `176ef22d` (2026-09-23)
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

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
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
+      
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

### Incident Patch 9: `53338d6c` (2026-09-16)
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

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
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
+                var args = item![FieldArgs] is JsonObj
```

---

### Incident Patch 10: `713ca3e2` (2026-09-14)
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
+RE_TI
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
+        if: ${{ alway
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
+            // Unity API values are captured HERE, on the main thread; the recording itself run
```

#### Recent Merged Pull Requests:
- **PR #1003** (2026-09-28): ci: re-enable Library cache for Unity 6000.6 and drop stale burst/ilpp pid files (@IvanMurzak)
- **PR #1000** (2026-09-27): ci: skip the Library cache for Unity 6000.6+ legs (@IvanMurzak)
- **PR #999** (2026-09-27): chore(release): 0.93.2 (@IvanMurzak)
- **PR #998** (2026-09-27): chore(cli): upgrade vitest to 4.1.11 (0 audit findings) (@IvanMurzak)
- **PR #997** (2026-09-27): ci: add Unity 6000.6.3f1 to the test matrix (@IvanMurzak)
- **PR #996** (2026-09-27): chore(chain): vendor chain_feed.py v5 (Unity-Tests/6000.6.3f1 drop) (@IvanMurzak)
- **PR #995** (2026-09-26): feat(tests): Unity 6000.6.3f1 test project + version 0.93.1 (@IvanMurzak)
- **PR #994** (2026-09-26): fix(cli): print the update command alone on its own line (@IvanMurzak)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
