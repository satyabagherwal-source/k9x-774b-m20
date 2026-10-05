# Forensic Learning Record (Deep Inspection): ChromeDevTools/chrome-devtools-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/chromedevtools-chrome-devtools-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ChromeDevTools/chrome-devtools-mcp](https://github.com/ChromeDevTools/chrome-devtools-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:49:54.279Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ChromeDevTools/chrome-devtools-mcp`
- **Description**: Chrome DevTools for coding agents
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 52999 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `scripts/profile/utils.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {ProfileScenario} from './types.ts';

export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

export function parseNonNegativeInteger(
  value: string | undefined,
  name: string,
): number {
  if (value === undefined || !/^\d+$/.test(value)) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return parsed;
}

export function selectedPageIdFromToolResult(result: unknown): number {
  if (isObject(result) && isObject(result.structuredContent)) {
    const pages = result.structuredContent.pages;
    if (Array.isArray(pages)) {
      for (const page of pages) {
        if (
          isObject(page) &&
          page.selected === true &&
          typeof page.id === 'number'
        ) {
          return page.id;
        }
      }
    }
  }

  if (isObject(result) && Array.isArray(result.content)) {
    for (const content of result.content) {
      if (!isObject(content) || typeof content.text !== 'string') {
        continue;
      }
      const match = /^(\d+): .*\[selected\](?:\s|$)/m.exec(content.text);
      const pageId = match?.[1];
      if (pageId !== undefined) {
        return Number(pageId);
      }
    }
  }

  throw new Error(
    'new_page did not identify the selected page in its response',
  );
}

export function isScenarioModule(value: unknown): value is ProfileScenario {
  return isObject(value) && typeof value.get === 'function';
}

export function uidsFromSnapshotResult(result: unknown): string[] {
  if (isObject(result) && isObject(result.structuredContent)) {
    const snapshot = result.structuredContent.snapshot;
    if (isObject(snapshot)) {
      const uids: string[] = [];
      const collectUids = (node: Record<string, unknown>): void => {
        if (
          typeof node.id === 'string' &&
          node.id.length > 0 &&
          node.role !== 'RootWebArea' &&
          node.role !== 'StaticText'
        ) {
          uids.push(node.id);
        }
        if (Array.isArray(node.children)) {
          for (const child of node.children) {
            if (isObject(child)) {
              collectUids(child);
            }
          }
        }
      };
      collectUids(snapshot);
      if (uids.length > 0) {
        return uids;
      }
    }
  }

  if (isObject(result) && Array.isArray(result.content)) {
    const uids: string[] = [];
    for (const item of result.content) {
      if (isObject(item) && typeof item.text === 'string') {
        for (const line of item.text.split('\n')) {
          if (line.includes('RootWebArea') || line.includes('StaticText')) {
            continue;
          }
          const match = /\buid=([^\s]+)/.exec(line);
          const uid = match?.[1];
          if (uid !== undefined && uid.length > 0) {
            uids.push(uid);
          }
        }
      }
    }
    if (uids.length > 0) {
      return uids;
    }
  }

  throw new Error(
    'take_snapshot did not return any inspectable element UIDs in its response',
  );
}

```

### Core Architecture Module: `src/McpWorker.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {Target, WebWorker} from './third_party/index.js';

/**
 * The kinds of worker target the browser exposes. Only `service_worker` is
 * surfaced today; the others let the abstraction cover dedicated and shared
 * workers without changing shape.
 */
export type WorkerType =
  'service_worker' | 'dedicated_worker' | 'shared_worker';

/**
 * Short id prefix that labels a worker's type in its id, e.g. `sw-1` for a
 * service worker. The numeric part comes from a single shared counter, so the
 * prefix is a readable type tag rather than a per-type sequence.
 */
const WORKER_ID_PREFIX: Record<WorkerType, string> = {
  service_worker: 'sw',
  dedicated_worker: 'dw',
  shared_worker: 'shw',
};

export function workerIdPrefix(type: WorkerType): string {
  return WORKER_ID_PREFIX[type];
}

// Single shared counter across worker types. Ids are not reused across
// reconnects, mirroring the page id counter in McpContext; the type prefix is
// what distinguishes the kinds, not a per-type sequence.
let nextWorkerId = 1;

/**
 * Wraps a Puppeteer worker {@link Target}, mirroring {@link McpPage}: it owns the
 * target and the stable id assigned to it and lazily resolves the underlying
 * {@link WebWorker}. Generalizes the former plain `ExtensionServiceWorker` type so
 * dedicated and service workers share a single representation.
 */
export class McpWorker {
  readonly id: string;
  readonly type: WorkerType;
  #target: Target;

  constructor(id: string, type: WorkerType, target: Target) {
    this.id = id;
    this.type = type;
    this.#target = target;
  }

  /**
   * Creates a worker with a freshly minted id derived from its type (e.g.
   * `sw-1`). Keeps id composition in one place so callers only supply the type.
   */
  static create(type: WorkerType, target: Target): McpWorker {
    return new McpWorker(
      `${workerIdPrefix(type)}-${nextWorkerId++}`,
      type,
      target,
    );
  }

  /**
   * Resets the shared id counter. For tests only, mirroring
   * McpContext.resetPageIdsForTesting().
   */
  static resetIdsForTesting(): void {
    nextWorkerId = 1;
  }

  get target(): Target {
    return this.#target;
  }

  get url(): string {
    return this.#target.url();
  }

  /**
   * Resolves the worker's execution context, or `undefined` when the target
   * does not expose one (e.g. it closed before the session attached).
   */
  async worker(): Promise<WebWorker | undefined> {
    return (await this.#target.worker()) ?? undefined;
  }
}

```

### Core Architecture Module: `src/collectors/ServiceWorkerCollector.ts`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {UncaughtError} from './PageCollector.js';
import type {
  ConsoleMessage,
  WebWorker,
  Target,
  CDPSession,
  Protocol,
  Browser,
} from '../third_party/index.js';
import type {McpWorker} from '../McpWorker.js';
import type {WithSymbolId} from '../utils/id.js';
import {createIdGenerator, stableIdSymbol} from '../utils/id.js';

const CHROME_EXTENSION_PREFIX = 'chrome-extension://';

export class ServiceWorkerSubscriber {
  #target: Target;
  #callback: (item: ConsoleMessage | UncaughtError) => void;
  #session?: CDPSession;
  #worker?: WebWorker;

  constructor(
    target: Target,
    callback: (item: ConsoleMessage | UncaughtError) => void,
  ) {
    this.#target = target;
    this.#callback = callback;
  }

  async subscribe() {
    this.#session = await this.#target.createCDPSession();
    await this.#session.send('Runtime.enable');
    this.#session.on('Runtime.exceptionThrown', this.#onExceptionThrown);

    this.#worker = (await this.#target.worker()) ?? undefined;
    if (this.#worker) {
      this.#worker.on('console', this.#onConsole);
    }
  }

  async unsubscribe() {
    if (this.#worker) {
      this.#worker.off('console', this.#onConsole);
    }
    await this.#session?.detach();
  }

  #onConsole = (message: ConsoleMessage) => {
    this.#callback(message);
  };

  #onExceptionThrown = (event: Protocol.Runtime.ExceptionThrownEvent) => {
    const url = this.#target.url();

    const extensionId = extractExtensionId(url);

    if (extensionId) {
      this.#callback(new UncaughtError(event.exceptionDetails, extensionId));
    }
  };
}

export class ServiceWorkerConsoleCollector {
  #storage = new Map<
    string,
    Array<WithSymbolId<ConsoleMessage | UncaughtError>>
  >();
  #maxLogs: number;
  #browser?: Browser;
  #serviceWorkerSubscribers = new Map<Target, ServiceWorkerSubscriber>();
  #idGenerator = createIdGenerator();

  constructor(browser?: Browser, maxLogs = 1000) {
    this.#browser = browser;
    this.#maxLogs = maxLogs;
  }

  async init(workers: McpWorker[]) {
    if (!this.#browser) {
      return;
    }
    this.#browser.on('targetcreated', this.#onTargetCreated);
    this.#browser.on('targetdestroyed', this.#onTargetDestroyed);

    for (const worker of workers) {
      void this.#onTargetCreated(worker.target);
    }
  }

  dispose() {
    if (!this.#browser) {
      return;
    }
    this.#browser.off('targetcreated', this.#onTargetCreated);
    this.#browser.off('targetdestroyed', this.#onTargetDestroyed);
    for (const subscriber of this.#serviceWorkerSubscribers.values()) {
      subscriber.unsubscribe().catch(err => {
        if (!isIgnoredTargetError(err)) {
          // Swallow error as we are tearing down the system
        }
      });
    }
    this.#serviceWorkerSubscribers.clear();
  }

  #onTargetCreated = async (target: Target) => {
    if (this.#serviceWorkerSubscribers.has(target)) {
      return;
    }
    const origin = target.url();
    if (target.type() === 'service_worker' && isExtensionOrigin(origin)) {
      const extensionId = extractExtensionId(origin);

      if (!extensionId) {
        return;
      }

      const subscriber = new ServiceWorkerSubscriber(target, item => {
        this.addLog(extensionId, item);
      });
      this.#serviceWorkerSubscribers.set(target, subscriber);
      try {
        await subscriber.subscribe();
        if (this.#serviceWorkerSubscribers.get(target) !== subscriber) {
          await subscriber.unsubscribe();
        }
      } catch (err) {
        if (this.#serviceWorkerSubscribers.get(target) === subscriber) {
          this.#serviceWorkerSubscribers.delete(target);
        }
        if (!isIgnoredTargetError(err)) {
          throw err;
        }
      }
    }
  };

  #onTargetDestroyed = async (target: Target) => {
    const subscriber = this.#serviceWorkerSubscribers.get(target);
    if (subscriber) {
      this.#serviceWorkerSubscribers.delete(target);
      try {
        await subscriber.unsubscribe();
      } catch (err) {
        if (!isIgnoredTargetError(err)) {
          throw err;
        }
      }
    }
  };

  addLog(extensionId: string, log: ConsoleMessage | UncaughtError) {
    const logs = this.#storage.get(extensionId) ?? [];
    const withId = log as WithSymbolId<ConsoleMessage | UncaughtError>;
    withId[stableIdSymbol] = this.#idGenerator();
    logs.push(withId);
    if (logs.length > this.#maxLogs) {
      logs.shift();
    }
    this.#storage.set(extensionId, logs);
  }

  getData(
    extensionId: string,
  ): Array<WithSymbolId<ConsoleMessage | UncaughtError>> {
    return this.#storage.get(extensionId) ?? [];
  }

  getById(
    extensionId: string,
    stableId: number,
  ): WithSymbolId<ConsoleMessage | UncaughtError> {
    const logs = this.#storage.get(extensionId);
    if (!logs) {
      throw new Error('No logs found for selected extension');
    }
    const item = logs.find(item => item[stableIdSymbol] === stableId);
    if (item) {
      return item;
    }
    throw new Error('Log not found for selected extension');
  }

  find(
    extensionId: string,
    filter: (item: WithSymbolId<ConsoleMessage | UncaughtError>) => boolean,
  ): WithSymbolId<ConsoleMessage | UncaughtError> | undefined {
    const logs = this.#storage.get(extensionId);
    if (!logs) {
      return;
    }
    return logs.find(filter);
  }

  clearLogs(extensionId: string) {
    this.#storage.delete(extensionId);
  }
}

function extractExtensionId(origin: string): string | null {
  if (!origin || !isExtensionOrigin(origin)) {
    return null;
  }

  const pathPart = origin.substring(CHROME_EXTENSION_PREFIX.length);
  const slashIndex = pathPart.indexOf('/');

  // if there's no / it means that pathPart is now the extensionId, otherwise
  // we take everything until the first /
  return slashIndex === -1 ? pathPart : pathPart.substring(0, slashIndex);
}

function isExtensionOrigin(origin: string) {
  return origin.startsWith(CHROME_EXTENSION_PREFIX);
}

function isIgnoredTargetError(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err.message.includes('Target closed') ||
      err.message.includes('Session closed') ||
      err.message.includes('No target with given id found') ||
      err.message.includes('No session with given id'))
  );
}

```

### Core Architecture Module: `src/daemon/utils.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import type {YargsOptions} from '../third_party/index.js';
import {logger} from '../utils/logger.js';

export const DAEMON_SCRIPT_PATH = path.join(import.meta.dirname, 'daemon.js');

const APP_NAME = 'chrome-devtools-mcp';
export const DAEMON_CLIENT_NAME = 'chrome-devtools-cli-daemon';

export function assertValidSessionId(sessionId: string): void {
  if (!sessionId) {
    return;
  }
  if (!/^[a-fA-F0-9-]+$/.test(sessionId)) {
    throw new Error(`Invalid sessionId: ${sessionId}`);
  }
}

// Using these paths due to strict limits on the POSIX socket path length.
export function getSocketPath(sessionId: string): string {
  assertValidSessionId(sessionId);
  const username = os.userInfo().username;
  const suffix = sessionId ? `-${sessionId}` : '';
  const appName = APP_NAME + suffix;

  if (IS_WINDOWS) {
    // Windows uses Named Pipes, not file paths.
    // This format is required for server.listen()
    // Append username to prevent cross-user named pipe squatting
    return path.join('\\\\.\\pipe', `${appName}-${username}`, 'server.sock');
  }

  return path.join(getRuntimeHome(sessionId), 'server.sock');
}

export function getRuntimeHome(sessionId: string): string {
  assertValidSessionId(sessionId);
  const platform = os.platform();
  const uid = os.userInfo().uid;
  const suffix = sessionId ? `-${sessionId}` : '';
  const appName = APP_NAME + suffix;

  // 1. Check for the modern Unix standard
  if (process.env.XDG_RUNTIME_DIR) {
    return path.join(process.env.XDG_RUNTIME_DIR, appName);
  }

  // 2. Fallback for macOS and older Linux
  if (platform === 'darwin' || platform === 'linux') {
    // /tmp is cleared on boot, making it perfect for PIDs
    return path.join('/tmp', `${appName}-${uid}`);
  }

  // 3. Windows Fallback
  return path.join(os.tmpdir(), appName);
}

export const IS_WINDOWS = os.platform() === 'win32';

export function getPidFilePath(sessionId: string) {
  assertValidSessionId(sessionId);
  const runtimeDir = getRuntimeHome(sessionId);
  return path.join(runtimeDir, 'daemon.pid');
}

export function getDaemonPid(sessionId: string) {
  assertValidSessionId(sessionId);
  try {
    const pidFile = getPidFilePath(sessionId);
    logger?.(`Daemon pid file ${pidFile} sessionId=${sessionId}`);
    if (!fs.existsSync(pidFile)) {
      return null;
    }
    const pidContent = fs.readFileSync(pidFile, 'utf-8');
    const pid = parseInt(pidContent.trim(), 10);
    logger?.(`Daemon pid: ${pid}`);
    if (isNaN(pid)) {
      return null;
    }
    return pid;
  } catch {
    return null;
  }
}

export function isDaemonRunning(sessionId: string): boolean {
  assertValidSessionId(sessionId);
  const pid = getDaemonPid(sessionId);
  if (pid) {
    try {
      process.kill(pid, 0); // Throws if process doesn't exist
      return true;
    } catch {
      // Process is dead, stale PID file. Proceed with startup.
    }
  }
  return false;
}

export function serializeArgs(
  options: Record<string, YargsOptions>,
  argv: Record<string, unknown>,
): string[] {
  const args: string[] = [];
  for (const key of Object.keys(options)) {
    if (argv[key] === undefined || argv[key] === null) {
      continue;
    }
    const value = argv[key];
    const option = options[key];
    // Yargs reuses the option `default` object; skip it so the daemon parser
    // still sees the original default (needed for filesystemRoot identity).
    if (option !== undefined && value === option.default) {
      continue;
    }
    const kebabKey = key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`);

    if (typeof value === 'boolean') {
      if (value) {
        args.push(`--${kebabKey}`);
      } else {
        args.push(`--no-${kebabKey}`);
      }
    } else if (Array.isArray(value)) {
      for (const item of value) {
        args.push(`--${kebabKey}=${String(item)}`);
      }
    } else {
      args.push(`--${kebabKey}=${String(value)}`);
    }
  }
  return args;
}

```

### Core Architecture Module: `src/devtools/DevtoolsUtils.ts`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {DevTools} from '../third_party/index.js';
import type {
  CDPSession,
  ConsoleMessage,
  Protocol,
} from '../third_party/index.js';

import {McpHostBindingAdapter} from './McpHostBindingAdapter.js';

/**
 * A mock implementation of an issues manager that only implements the methods
 * that are actually used by the IssuesAggregator
 */
export class FakeIssuesManager extends DevTools.Common.ObjectWrapper
  .ObjectWrapper<DevTools.IssuesManagerEventTypes> {
  issues(): DevTools.Issue[] {
    return [];
  }
}

export function overrideDevToolsGlobals({
  loadResource,
}: {
  loadResource: (url: string) => Promise<string>;
}): void {
  DevTools.Host.InspectorFrontendHost.installInspectorFrontendHost(
    new McpHostBindingAdapter(loadResource),
  );

  // DevTools CDP errors can get noisy.
  DevTools.ProtocolClient.InspectorBackend.test.suppressRequestErrors = true;

  const noopAgentCommand = () => {
    return Promise.resolve({
      getError: () => undefined,
    });
  };

  // Stub out Network emulation commands on the DevTools Agent prototype globally.
  // This prevents the DevTools Frontend from ever resetting/clearing Puppeteer's
  // active network blocking/throttling rules during target setup or session lifetime.
  const networkAgentPrototype =
    DevTools.ProtocolClient.InspectorBackend.inspectorBackend.agentPrototypes.get(
      'Network',
    );
  if (networkAgentPrototype) {
    Object.defineProperty(
      networkAgentPrototype,
      'invoke_emulateNetworkConditionsByRule',
      {
        value: () => {
          return Promise.resolve({
            ruleIds: [],
            getError: () => undefined,
          });
        },
        writable: true,
        configurable: true,
        enumerable: true,
      },
    );
    Object.defineProperty(
      networkAgentPrototype,
      'invoke_overrideNetworkState',
      {
        value: noopAgentCommand,
        writable: true,
        configurable: true,
        enumerable: true,
      },
    );
    Object.defineProperty(networkAgentPrototype, 'invoke_enable', {
      value: noopAgentCommand,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    Object.defineProperty(networkAgentPrototype, 'invoke_disable', {
      value: noopAgentCommand,
      writable: true,
      configurable: true,
      enumerable: true,
    });
    Object.defineProperty(networkAgentPrototype, 'invoke_setBlockedURLs', {
      value: noopAgentCommand,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }

  // Puppeteer already collects issues from its own Audits subscription. Avoid
  // enabling the DevTools Frontend's redundant subscription, which can replay
  // a large retained issue backlog and delay unrelated page work.
  const auditsAgentPrototype =
    DevTools.ProtocolClient.InspectorBackend.inspectorBackend.agentPrototypes.get(
      'Audits',
    );
  if (auditsAgentPrototype) {
    Object.defineProperty(auditsAgentPrototype, 'invoke_enable', {
      value: noopAgentCommand,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }

  DevTools.I18n.DevToolsLocale.DevToolsLocale.instance({
    create: true,
    data: {
      navigatorLanguage: 'en-US',
      settingLanguage: 'en-US',
      lookupClosestDevToolsLocale: l => l,
    },
  });

  DevTools.I18n.i18n.registerLocaleDataForTest('en-US', {});

  DevTools.Formatter.FormatterWorkerPool.FormatterWorkerPool.instance({
    forceNew: true,
    entrypointURL: import.meta
      .resolve('../third_party/devtools-formatter-worker.js'),
  });
}

export interface TargetUniverse {
  /** The DevTools target corresponding to the puppeteer Page */
  target: DevTools.Target;
  universe: DevTools.Foundation.Universe.Universe;
  /** The secondary session created for this page */
  session: CDPSession;
}

export interface CreateTargetUniverseOptions {
  sourceMaps?: boolean;
}

export async function createTargetUniverse(
  session: CDPSession,
  options?: CreateTargetUniverseOptions,
): Promise<TargetUniverse> {
  const settingStorage = new DevTools.Common.Settings.SettingsStorage({});
  const universe = new DevTools.Foundation.Universe.Universe({
    settingsCreationOptions: {
      syncedStorage: settingStorage,
      globalStorage: settingStorage,
      localStorage: settingStorage,
      settingRegistrations:
        DevTools.Common.SettingRegistration.getRegisteredSettings(),
    },
    overrideAutoStartModels: new Set([DevTools.DebuggerModel]),
    hostConfig: {},
    inspectorFrontendHost:
      DevTools.Host.InspectorFrontendHost.InspectorFrontendHostInstance,
    supportsEmulation: false,
  });

  const sourceMaps = options?.sourceMaps ?? true;
  const jsSourceMapsSetting = universe.settings.resolve(
    DevTools.SDKSettings.jsSourceMapsEnabledSettingDescriptor,
  );
  jsSourceMapsSetting.set(sourceMaps);

  const cssSourceMapsSetting = universe.settings.resolve(
    DevTools.SDKSettings.cssSourceMapsEnabledSettingDescriptor,
  );
  cssSourceMapsSetting.set(sourceMaps);

  const setting = universe.settings.resolve(
    DevTools.SourceMapManager.lazyLoadingSettingDescriptor,
  );
  setting.set(true);

  const skipAllPausesSetting = universe.settings.resolve(
    DevTools.skipAllPausesSettingDescriptor,
  );
  skipAllPausesSetting.set(true);

  // @ts-expect-error devtools-frontend has diffrent types.
  const connection = new DevTools.PuppeteerDevToolsConnection(session);

  const targetManager = universe.context.get(DevTools.TargetManager);

  targetManager.observeModels(
    DevTools.NetworkManager.NetworkManager,
    DISABLE_NETWORK,
  );

  const target = targetManager.createTarget(
    'main',
    '',
    'frame' as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    /* parentTarget */ null,
    session.id(),
    undefined,
    connection,
  );

  return {target, universe, session};
}

// Not recording network requests in the DevTools universe.
//
// The network requests are collected through pptr and there isn't a use case for
// enabling devtools SDK's network domain.
const DISABLE_NETWORK = {
  modelAdded(model: DevTools.NetworkManager.NetworkManager): void {
    void model.target().networkAgent().invoke_disable();
  },

  modelRemoved(): void {
    // Do nothing.
  },
};

export type RemoteObjectLike =
  Protocol.Runtime.RemoteObject | DevTools.Protocol.Runtime.RemoteObject;

export type ExceptionDetailsLike =
  | Protocol.Runtime.ExceptionDetails
  | DevTools.Protocol.Runtime.ExceptionDetails;

export type StackTraceLike =
  Protocol.Runtime.StackTrace | DevTools.Protocol.Runtime.StackTrace;

/**
 * Constructed from Runtime.ExceptionDetails of an uncaught error.
 *
 * TODO: Also construct from a RemoteObject of subtype 'error'.
 *
 * Consists of the message, a fully resolved stack trace and a fully resolved 'cause' chain.
 */
export class SymbolizedError {
  readonly message: string;
  readonly stackTrace?: DevTools.StackTrace.StackTrace.StackTrace;
  readonly cause?: SymbolizedError;

  private constructor(
    message: string,
    stackTrace?: DevTools.StackTrace.StackTrace.StackTrace,
    cause?: SymbolizedError,
  ) {
    this.message = message;
    this.stackTrace = stackTrace;
    this.cause = cause;
  }

  static async fromDetails(opts: {
    devTools?: TargetUniverse;
    details: ExceptionDetailsLike;
    targetId: string;
    includeStackAndCause?: boolean;
    resolvedStackTraceForTesting?: DevTools.StackTrace.StackTrace.StackTrace;
    resolvedCauseForTesting?: SymbolizedError;
  }): Promise<SymbolizedError> {
    const message = SymbolizedError.#getMessage(opts.details);
    if (!opts.includeStackAndCause || !opts.devTools) {
      return new SymbolizedError(
        message,
        opts.resolvedStackTraceForTesting,
        opts.resolvedCauseForTesting,
      );
    }

    let stackTrace: DevTools.StackTrace.StackTrace.StackTrace | undefined;
    if (opts.resolvedStackTraceForTesting) {
      stackTrace = opts.resolvedStackTraceForTesting;
    } else if (opts.details.stackTrace) {
      try {
        stackTrace = await createStackTrace(
          opts.devTools,
          opts.details.stackTrace,
          opts.targetId,
        );
      } catch {
        // ignore
      }
    }

    // TODO: Turn opts.details.exception into a JSHandle and retrieve the 'cause' property.
    //       If its an Error, recursively create a SymbolizedError.
    let cause: SymbolizedError | undefined;
    if (opts.resolvedCauseForTesting) {
      cause = opts.resolvedCauseForTesting;
    } else if (opts.details.exception) {
      try {
        const causeRemoteObj = await SymbolizedError.#lookupCause(
          opts.devTools,
          opts.details.exception,
          opts.targetId,
        );
        if (causeRemoteObj) {
          cause = await SymbolizedError.fromError({
            devTools: opts.devTools,
            error: causeRemoteObj,
            targetId: opts.targetId,
          });
        }
      } catch {
        // Ignore
      }
    }
    return new SymbolizedError(message, stackTrace, cause);
  }

  static async fromError(opts: {
    devTools?: TargetUniverse;
    error: RemoteObjectLike;
    targetId: string;
  }): Promise<SymbolizedError> {
    const details = await SymbolizedError.#getExceptionDetails(
      opts.devTools,
      opts.error,
      opts.targetId,
    );
    if (details) {
      return SymbolizedError.fromDetails({
        details,
        devTools: opts.devTools,
        targetId: opts.targetId,
        includeStackAndCause: true,
      });
    }

    return new SymbolizedError(
      SymbolizedError.#getMessageFromException(opts.error),
    );
  }

  static #getMessage(details: ExceptionDetailsLike): string {
    // For Runtime.exceptionThrown with a present exception object, `details.text` will be "Uncaught" and
    // we have to manually parse out the error text from the exception descript
```

### Core Architecture Module: `src/telemetry/flagUtils.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {mcpOptions} from '../config/mcp-options.js';
import {DevTools} from '../third_party/index.js';

import {stripUnderscoreBeforeNumber} from './transformation.js';
import type {FlagUsage} from './types.js';

const {StringUtilities} = DevTools.Platform;

type CliOptions = typeof mcpOptions;

/**
 * For enums, log the value as uppercase.
 * We're going to have an enum for such flags with choices represented
 * as an `enum` where the keys of the enum will map to the uppercase `choice`.
 */
function formatEnumChoice(snakeCaseName: string, choice: string): string {
  return stripUnderscoreBeforeNumber(
    `${snakeCaseName}_${choice}`,
  ).toUpperCase();
}

/**
 * Computes telemetry flag usage from parsed arguments and CLI options.
 *
 * Iterates over the defined CLI options to construct a payload:
 * - Flag names are converted to snake_case (e.g. `browserUrl` -> `browser_url`).
 * - A flag is logged as `{flag_name}_present` if:
 *    - It has no default value, OR
 *    - The provided value differs from the default value.
 * - Boolean flags are logged with their literal value.
 * - String flags with defined `choices` (Enums) are logged as their uppercase value.
 *
 * IMPORTANT: keep getPossibleFlagMetrics() in sync with this function.
 */
export function computeFlagUsage(
  args: Record<string, unknown>,
  options: CliOptions,
): FlagUsage {
  const usage: FlagUsage = {};

  for (const [flagName, config] of Object.entries(options)) {
    const value = args[flagName];
    const snakeCaseName = stripUnderscoreBeforeNumber(
      StringUtilities.toSnakeCase(flagName),
    );

    // If there isn't a default value provided for the flag,
    // we're going to log whether it's present on the args user
    // provided or not. If there is a default value, we only log presence
    // if the value differs from the default, implying explicit user intent.
    if (!('default' in config) || value !== config.default) {
      usage[`${snakeCaseName}_present`] = value !== undefined && value !== null;
    }

    if (config.type === 'boolean' && typeof value === 'boolean') {
      // For boolean options, we're going to log the value directly.
      usage[snakeCaseName] = value;
    } else if (
      config.type === 'string' &&
      typeof value === 'string' &&
      'choices' in config &&
      config.choices
    ) {
      usage[snakeCaseName] = formatEnumChoice(snakeCaseName, value);
    }
  }

  return usage;
}

export interface FlagMetric {
  name: string;
  flagType: 'boolean' | 'enum';
  choices?: string[];
}

/**
 * Computes the list of possible flag metrics based on the CLI options.
 *
 * IMPORTANT: keep this function in sync with computeFlagUsage().
 */
export function getPossibleFlagMetrics(options: CliOptions): FlagMetric[] {
  const metrics: FlagMetric[] = [];

  for (const [flagName, config] of Object.entries(options)) {
    const snakeCaseName = stripUnderscoreBeforeNumber(
      StringUtilities.toSnakeCase(flagName),
    );

    // _present is always a possible metric
    metrics.push({
      name: `${snakeCaseName}_present`,
      flagType: 'boolean',
    });

    if (config.type === 'boolean') {
      metrics.push({
        name: snakeCaseName,
        flagType: 'boolean',
      });
    } else if (
      config.type === 'string' &&
      'choices' in config &&
      config.choices
    ) {
      metrics.push({
        name: snakeCaseName,
        flagType: 'enum',
        choices: [
          `${snakeCaseName.toUpperCase()}_UNSPECIFIED`,
          ...config.choices.map(choice =>
            formatEnumChoice(snakeCaseName, choice),
          ),
        ],
      });
    }
  }

  return metrics;
}

```

### Core Architecture Module: `src/third_party/devtools-formatter-worker.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// eslint-disable-next-line no-restricted-imports
import '../../third_party/devtools-frontend/front_end/entrypoints/formatter_worker/formatter_worker-entrypoint.js';

```

### Core Architecture Module: `src/third_party/devtools-heap-snapshot-worker.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

// eslint-disable-next-line no-restricted-imports
import '../../third_party/devtools-frontend/front_end/entrypoints/heap_snapshot_worker/heap_snapshot_worker-entrypoint.js';

```

### Core Architecture Module: `src/utils/WaitForHelper.ts`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type {Page, Protocol, CdpPage, Dialog} from '../third_party/index.js';
import type {PredefinedNetworkConditions} from '../third_party/index.js';
import {logger} from './logger.js';

export type DialogAction = 'accept' | 'dismiss' | string;

export class WaitForHelper {
  #abortController = new AbortController();
  #page: CdpPage;
  #stableDomTimeout: number;
  #stableDomFor: number;
  #expectNavigationIn: number;
  #navigationTimeout: number;

  #dialogHandled = false;
  /** Track all dialogs as they pause the renderer. */
  #dialogDetected = false;
  #initialUrl: string;

  constructor(
    page: Page,
    cpuTimeoutMultiplier: number,
    networkTimeoutMultiplier: number,
  ) {
    this.#stableDomTimeout = 3000 * cpuTimeoutMultiplier;
    this.#stableDomFor = 100 * cpuTimeoutMultiplier;
    this.#expectNavigationIn = 100 * cpuTimeoutMultiplier;
    this.#navigationTimeout = 3000 * networkTimeoutMultiplier;
    this.#page = page as unknown as CdpPage;
    this.#initialUrl = page.url();
  }

  /**
   * A wrapper that executes a action and waits for
   * a potential navigation, after which it waits
   * for the DOM to be stable before returning.
   */
  async waitForStableDom(): Promise<void> {
    // Bound the setup evaluation against the stable-DOM timeout. Without this
    // cap a paused renderer (e.g. an open dialog) would make evaluateHandle
    // hang until protocolTimeout (default 180s) while the tool mutex is held.
    using stableDomObserver = await Promise.race([
      this.#page.evaluateHandle(timeout => {
        let timeoutId: ReturnType<typeof setTimeout>;
        function callback() {
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            domObserver.resolver.resolve();
            domObserver.observer.disconnect();
          }, timeout);
        }
        const domObserver = {
          resolver: Promise.withResolvers<void>(),
          observer: new MutationObserver(callback),
        };
        // It's possible that the DOM is not gonna change so we
        // need to start the timeout initially.
        callback();

        domObserver.observer.observe(document.body, {
          childList: true,
          subtree: true,
          attributes: true,
        });

        return domObserver;
      }, this.#stableDomFor),
      this.timeout(this.#stableDomTimeout) as Promise<undefined>,
    ]).catch(() => undefined);

    if (!stableDomObserver) {
      return;
    }

    this.#abortController.signal.addEventListener('abort', async () => {
      try {
        await stableDomObserver.evaluate(observer => {
          observer.observer.disconnect();
          observer.resolver.resolve();
        });
      } catch {
        // Ignored cleanup errors
      }
    });

    return Promise.race([
      stableDomObserver.evaluate(async observer => {
        return await observer.resolver.promise;
      }),
      this.timeout(this.#stableDomTimeout).then(() => {
        throw new Error('Timeout');
      }),
    ]);
  }

  timeout(time: number): Promise<void> {
    if (this.#abortController.signal.aborted) {
      return Promise.resolve();
    }
    return new Promise<void>(res => {
      const id = setTimeout(res, time);
      this.#abortController.signal.addEventListener('abort', () => {
        res();
        clearTimeout(id);
      });
    });
  }

  async waitForEventsAfterAction(
    action: (signal: AbortSignal) => Promise<unknown>,
    options?: {
      timeout?: number;
      waitForStableDom?: boolean;
      expectNavigationIn?: number;
      handleDialog?:
        DialogAction | Partial<Record<Protocol.Page.DialogType, DialogAction>>;
    },
  ): Promise<WaitForEventsResult> {
    if (this.#abortController.signal.aborted) {
      throw new Error("Can't re-use a WaitForHelper");
    }
    const dialogHandler = (
      dialog: Pick<Dialog, 'accept' | 'dismiss' | 'type'>,
    ) => {
      this.#dialogDetected = true;

      let actionToTake: DialogAction | undefined;

      if (typeof options?.handleDialog === 'object') {
        actionToTake = options.handleDialog[dialog.type()];
      } else {
        actionToTake = options?.handleDialog;
      }

      if (actionToTake) {
        this.#dialogHandled = true;
        if (actionToTake === 'dismiss') {
          void dialog.dismiss();
        } else if (actionToTake === 'accept') {
          void dialog.accept();
        } else {
          void dialog.accept(actionToTake);
        }
      } else {
        this.#abortController.abort(
          new Error('Action interrupted by a dialog'),
        );
      }
    };
    this.#page.on('dialog', dialogHandler);
    this.#abortController.signal.addEventListener('abort', () => {
      this.#page.off('dialog', dialogHandler);
    });

    // A scoped AbortController used to clean up navigation probe listeners.
    // When aborted (either after navigation detection finishes or if this.#abortController
    // aborts), it removes CDP navigation probe listeners and automatically
    // detaches the abort listener from this.#abortController.signal.
    const navigationAbortController = new AbortController();
    const navigationStartedResolvers = Promise.withResolvers<boolean>();

    const navigationListener = (
      event: Protocol.Page.FrameStartedNavigatingEvent,
    ) => {
      if (event.frameId !== this.#page.mainFrame()._id) {
        return;
      }
      if (
        event.navigationType === 'sameDocument' ||
        event.navigationType === 'historySameDocument'
      ) {
        return;
      }

      navigationStartedResolvers.resolve(true);
    };
    const requestedNavigationListener = (
      event: Protocol.Page.FrameRequestedNavigationEvent,
    ) => {
      if (event.frameId === this.#page.mainFrame()._id) {
        navigationStartedResolvers.resolve(true);
      }
    };

    this.#page._client().on('Page.frameStartedNavigating', navigationListener);
    this.#page
      ._client()
      .on('Page.frameRequestedNavigation', requestedNavigationListener);
    navigationAbortController.signal.addEventListener('abort', () => {
      this.#page
        ._client()
        .off('Page.frameStartedNavigating', navigationListener);
      this.#page
        ._client()
        .off('Page.frameRequestedNavigation', requestedNavigationListener);
    });
    this.#abortController.signal.addEventListener(
      'abort',
      () => {
        navigationStartedResolvers.resolve(false);
        navigationAbortController.abort();
      },
      {signal: navigationAbortController.signal},
    );

    // Puppeteer's waitForNavigation must be started before the action runs so that
    // it captures the pre-action loader ID. If started after the action triggers navigation,
    // it risks recording the new loader ID and hanging until timeout.
    // If no navigation occurs, this.#abortController will cancel it in the finally block.
    const navigationFinished = this.#page
      .waitForNavigation({
        timeout: 0,
        signal: this.#abortController.signal,
        ignoreSameDocumentNavigation: true,
      })
      .then(result => {
        navigationStartedResolvers.resolve(true);
        return result;
      })
      .catch(error => {
        if (
          this.#abortController.signal.aborted ||
          (error instanceof Error && error.name === 'AbortError')
        ) {
          return;
        }
        logger?.(error);
      });

    try {
      await action(this.#abortController.signal);
    } catch (error) {
      // Clear up pending promises
      this.#abortController.abort();
      throw error;
    }

    const expectNavigationIn =
      options?.expectNavigationIn ?? this.#expectNavigationIn;
    const navigationStarted = await Promise.race([
      navigationStartedResolvers.promise,
      this.timeout(expectNavigationIn).then(() => {
        navigationStartedResolvers.resolve(false);
        return false;
      }),
    ]);
    navigationAbortController.abort();

    try {
      // Only await navigation if one was actually initiated; otherwise, the
      // pending waitForNavigation promise will be cancelled when this.#abortController aborts.
      if (navigationStarted) {
        await Promise.race([
          navigationFinished,
          this.timeout(options?.timeout ?? this.#navigationTimeout),
        ]);
      }

      if (this.#dialogDetected) {
        return this.#getResult();
      }

      // Wait for stable dom after navigation so we execute in
      // the correct context
      if (options?.waitForStableDom !== false) {
        await this.waitForStableDom();
      }
    } catch (error) {
      logger?.(error);
    } finally {
      this.#abortController.abort();
    }

    return this.#getResult();
  }

  #getResult(): WaitForEventsResult {
    const urlAfterAction = this.#page.url();
    return {
      ...(urlAfterAction !== this.#initialUrl
        ? {navigatedToUrl: urlAfterAction}
        : {}),
      dialogHandled: this.#dialogHandled,
    };
  }
}

export interface WaitForEventsResult {
  /**
   * The URL the page navigated to during the action, if a navigation
   * occurred.
   */
  navigatedToUrl?: string;
  /**
   * Whether a dialog was automatically handled during the action.
   */
  dialogHandled?: boolean;
}

export function getNetworkMultiplierFromString(
  condition: string | null,
): number {
  const puppeteerCondition =
    condition as keyof typeof PredefinedNetworkConditions;

  switch (puppeteerCondition) {
    case 'Fast 4G':
      return 1;
    case 'Slow 4G':
      return 2.5;
    case 'Fast 3G':
      return 5;
    case 'Slow 3G':
      return 10;
  }
  return 1;
}

```

### Core Architecture Module: `src/utils/bytes.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {zod} from '../third_party/index.js';

const BYTE_UNITS: Readonly<Record<string, number>> = {
  b: 1,
  byte: 1,
  bytes: 1,
  k: 1000,
  kb: 1000,
  kib: 1024,
  m: 1000 * 1000,
  mb: 1000 * 1000,
  mib: 1024 * 1024,
  g: 1000 * 1000 * 1000,
  gb: 1000 * 1000 * 1000,
  gib: 1024 * 1024 * 1024,
  t: 1000 * 1000 * 1000 * 1000,
  tb: 1000 * 1000 * 1000 * 1000,
  tib: 1024 * 1024 * 1024 * 1024,
};

/**
 * Parses a byte size string (e.g. "1M", "1MB", "500KB", "1.5GB", "1024") into bytes.
 */
export function parseByteSize(value: string): number {
  const trimmed = value.trim();
  if (trimmed === '') {
    throw new Error(`Invalid byte size: "${value}"`);
  }

  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?$/);
  if (!match) {
    throw new Error(
      `Invalid byte size format: "${value}". Expected a number or format like "1024", "1M", "1MB", "1G", "1GB".`,
    );
  }

  const numMatch = match[1];
  if (numMatch === undefined) {
    throw new Error(`Invalid byte size: "${value}"`);
  }
  const num = Number(numMatch);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`Invalid byte size: "${value}"`);
  }

  const unitMatch = match[2];
  if (unitMatch === undefined) {
    return Math.round(num);
  }

  const unit = unitMatch.toLowerCase();
  const multiplier = BYTE_UNITS[unit];
  if (multiplier === undefined) {
    throw new Error(
      `Unknown unit "${unitMatch}" in "${value}". Supported units: B, KB, KiB, MB, MiB, GB, GiB, TB, TiB.`,
    );
  }

  const bytes = Math.round(num * multiplier);
  if (!Number.isFinite(bytes)) {
    throw new Error(`Invalid byte size: "${value}"`);
  }
  return bytes;
}

export interface ByteSizeRange {
  min: number;
  max?: number;
}

/**
 * Parses an inclusive byte-size range (e.g. "1MB", "1MB-2MB", "-1MB", "1MB-").
 */
export function parseByteSizeRange(value: string): ByteSizeRange {
  const trimmed = value.trim();
  if (!trimmed.includes('-')) {
    return {min: parseByteSize(trimmed), max: undefined};
  }

  const parts = trimmed.split('-');
  if (parts.length !== 2) {
    throw new Error(
      `Invalid byte size range: "${value}". Expected a size or range like "1MB", "1MB-2MB", "-1MB", or "1MB-".`,
    );
  }

  const minValue = parts[0];
  const maxValue = parts[1];
  if (minValue === undefined || maxValue === undefined) {
    throw new Error(`Invalid byte size range: "${value}"`);
  }

  const minText = minValue.trim();
  const maxText = maxValue.trim();
  if (minText === '' && maxText === '') {
    throw new Error(
      `Invalid byte size range: "${value}". At least one bound is required.`,
    );
  }

  const min = minText === '' ? 0 : parseByteSize(minText);
  const max = maxText === '' ? undefined : parseByteSize(maxText);
  if (max !== undefined && min > max) {
    throw new Error(
      `Invalid byte size range: "${value}". The lower bound must not exceed the upper bound.`,
    );
  }

  return {min, max};
}

export function byteSizeRangeSchema(description: string) {
  return zod
    .string()
    .transform((value, context) => {
      try {
        return parseByteSizeRange(value);
      } catch (error) {
        context.addIssue({
          code: zod.ZodIssueCode.custom,
          message:
            error instanceof Error ? error.message : 'Invalid byte size range',
        });
        return zod.NEVER;
      }
    })
    .describe(description);
}

```

### Core Architecture Module: `src/utils/check-for-updates.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import child_process from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';

import {semver} from '../third_party/index.js';
import {VERSION} from '../version.js';

/**
 * Notifies the user if an update is available.
 * @param message The message to display in the update notification.
 */
let isChecking = false;

/** @internal Reset flag for tests only. */
export function resetUpdateCheckFlagForTesting() {
  isChecking = false;
}

export async function checkForUpdates(message: string) {
  if (isChecking || process.env['CHROME_DEVTOOLS_MCP_NO_UPDATE_CHECKS']) {
    return;
  }
  isChecking = true;

  const cachePath = path.join(
    os.homedir(),
    '.cache',
    'chrome-devtools-mcp',
    'latest.json',
  );

  let cachedVersion: string | undefined;
  let stats: {mtimeMs: number} | undefined;
  try {
    stats = await fs.stat(cachePath);
    const data = await fs.readFile(cachePath, 'utf8');
    cachedVersion = JSON.parse(data).version;
  } catch {
    // Ignore errors reading cache.
  }

  if (cachedVersion && semver.lt(VERSION, cachedVersion)) {
    console.warn(
      `\nUpdate available: ${VERSION} -> ${cachedVersion}\n${message}\n`,
    );
  }

  const now = Date.now();
  if (stats && now - stats.mtimeMs < 24 * 60 * 60 * 1000) {
    return;
  }

  // Update mtime immediately to prevent multiple subprocesses.
  try {
    const parentDir = path.dirname(cachePath);
    await fs.mkdir(parentDir, {recursive: true});
    const nowTime = new Date();
    if (stats) {
      await fs.utimes(cachePath, nowTime, nowTime);
    } else {
      await fs.writeFile(cachePath, JSON.stringify({version: VERSION}));
    }
  } catch {
    // Ignore errors.
  }

  // In a separate process, check the latest available version number
  // and update the local snapshot accordingly.
  const scriptPath = path.join(
    import.meta.dirname,
    '..',
    'bin',
    'check-latest-version.js',
  );

  try {
    const child = child_process.spawn(
      process.execPath,
      [scriptPath, cachePath],
      {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      },
    );
    child.unref();
  } catch {
    // Fail silently in case of any errors.
  }
}

```

### Core Architecture Module: `src/utils/errorHandling.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import process from 'node:process';
import {logger} from './logger.js';

export function setupUnhandledRejectionHandler(onCrash: () => void) {
  process.on('unhandledRejection', (reason, promise) => {
    logger?.('Unhandled promise rejection:', promise, reason);
    console.error('Unhandled promise rejection:', reason);

    if (process.env['CHROME_DEVTOOLS_MCP_CRASH_ON_UNCAUGHT'] === 'true') {
      onCrash();
    }
  });
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #322** (2025-10-13): **Chrome.exe proble,**
  *Symptoms*: ### Description of the bug  . Working on it for the past two days and it is not working with cursor, the new version will not integrate and the previous 0.1.0 works but then the chrome.exe is the problem...  My chrome is in: \AppData\Local\Google\Chrome\Application and also in : Program Files\Google\Chrome\Application  but still the "Unknown SPAWN" error when cursor calls the tools  ### Reproduction  _No response_  ### Expectation  _No response_  ### MCP configuration  _No response_  ### Node version  _No response_  ### Chrome version  _No response_  ### Coding agent version  _No response_  ### Model version  _No response_  ### Chat log  _No response_  ### Operating system  None
  **Post-Mortem & Fix Analysis**:
  > Can you please try setting the following environment variable?   ``` {   "mcpServers": {     "chrome-devtools": {       "env": {         "PROGRAMFILES": "C:\\Program Files"        },       "command": "npx",       "args": ["-y", "chrome-devtools-mcp@latest"]     }   } }  ```
  > <img width="352" height="186" alt="Image" src="https://github.com/user-attachments/assets/a2d02fa5-1205-48d9-b38d-c6f8d80bd521" />  not working
  > `{   "mcpServers": {     "chrome-devtools": {       "env": {         "PROGRAMFILES": "C:\\Program Files"        },       "command": "npx",       "args": ["-y", "chrome-devtools-mcp@0.1.0"]     }   } } `  This works but when I ask Cursor to let's say go to google.com, then the tool call give this: "spawn UNKNOWN"

- **Issue #304** (2025-10-08): **Publishing to the MCP registry fails with validation errors**
  *Symptoms*: See https://github.com/ChromeDevTools/chrome-devtools-mcp/actions/runs/18336260242/job/52221040509  Started failing without changes on our side. cc @natorion @sebastianbenz @Lightning00Blade 

- **Issue #300** (2025-10-08): **Unable to resolve resource extension:mcp.config.usrlocal.chromedevtools/chrome-devtools-mcp/mcpServer**
  *Symptoms*: **Describe the bug** Unable to resolve resource extension:mcp.config.usrlocal.chromedevtools/chrome-devtools-mcp/mcpServer  **To Reproduce** Steps to reproduce the behavior:  1. I've installed the Chrome Devtools MCP 2. I've tried to add the tool as context in the Agent chat  **Expected behavior** I should be able to chat in agent mode using the Devrools MCP  **Chrome version:** Version 141.0.7390.54 (Official Build) (arm64) **Coding agent version:** Visual Studio Code 1.104.2 **Model version:** Claude Sonnet 3.5  **Screenshots**  <img width="1909" height="1042" alt="Image" src="https://github.com/user-attachments/assets/c683a756-ed5e-44af-ae03-bd48d073061c" />  <img width="466" height="141" alt="Image" src="https://github.com/user-attachments/assets/eefd3535-cd96-442e-b76c-ea308c64e9c3" />   **Chat log** ``` [error] [Janela] Ocorreu um erro desconhecido. Verifique o log para obter detalhes. 2025-10-07 12:02:35.295 [error] [Janela] Error: Unable to resolve resource extension:mcp.config.usrlocal.chromedevtools/chrome-devtools-mcp/mcpServer     at YKe.r (vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js:1226:21649)     at YKe.r (vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/workbench/workbench.desktop.main.js:1226:21635)     at async pTt.acquire (vscode-file://vscode-app/Applications/Visual%20Studio%20Code.app/Contents/Resources/app/out/vs/workbench/
  **Post-Mortem & Fix Analysis**:
  > How did you install the MCP server? Can you show your JSON MCP config?
  > Hey @sebastianbenz I've installed from https://github.com/mcp this is my JSON config: ``` "chromedevtools/chrome-devtools-mcp": { 			"type": "stdio", 			"command": "npx", 			"args": [ 				"chrome-devtools-mcp@latest", 				"--browserUrl", 				"${input:browser_url}", 				"--headless", 				"${input:headless}", 				"--isolated", 				"${input:isolated}", 				"--channel", 				"${input:chrome_channel}" 			], 			"gallery": "https://api.mcp.github.com/v0/servers/13749964-2447-4c31-bcab-32731cced504", 			"version": "0.0.1-seed" 		} ```
  > Thanks! That helps! If you remove the following it should work:  ``` "--browserUrl", 				"${input:browser_url}", 				"--headless", 				"${input:headless}", 				"--isolated", 				"${input:isolated}", 				"--channel", 				"${input:chrome_channel}" ```

- **Issue #294** (2025-10-07): **Bug: --viewport option and resize_page tool fail in headless mode with Browser.setContentsSize error**
  *Symptoms*: ## Bug Report: `--viewport` option and `resize_page` tool fail in headless mode  ### Environment - **chrome-devtools-mcp version**: 0.5.1 (latest) - **Chrome version**: 139.0.7258.138 - **OS**: Ubuntu 22.04.5 LTS - **Configuration**: `--headless=true --isolated=true --viewport=1280x720`  ### Description The `--viewport` option causes all MCP tools to fail with a protocol error in headless mode. The `resize_page` tool also fails with the same error.  ### Steps to Reproduce 1. Configure `.mcp.json` with `--viewport=1280x720`: ```json {   "chrome-devtools": {     "command": "npx",     "args": [       "chrome-devtools-mcp@latest",       "--channel=stable",       "--headless=true",       "--isolated=true",       "--viewport=1280x720"     ]   } } ```  2. Restart MCP server 3. Try to use any tool (e.g., `list_pages`, `navigate_page`, or `resize_page`)  ### Expected Behavior - `--viewport` option should set the initial viewport size - `resize_page` tool should resize the page viewport - All other tools should work normally  ### Actual Behavior All tools fail with the error: ``` Protocol error (Browser.setContentsSize): 'Browser.setContentsSize' wasn't found ```  ### Root Cause Analysis After investigating the source code, I found:  1. Both `--viewport` initialization and `resize_page` tool use `page.resize()` (marked as `@ts-expect-error internal API for now`) 2. This internal API calls `Browser.setContentsSize` from Chrome DevTools Protocol 3. `Browser.setContentsSize` is marked as 
  **Post-Mortem & Fix Analysis**:
  > Chrome 139 is not a current stable version. Could you please try with the current stable version which 141+?
  > Able to reproduce it with the latest version but somehow it was not caught in tests.
  > Thank you for confirming the bug @OrKoN. I've upgraded Chrome from 139 to 141.0.7390.54 and can confirm the issue persists, though with different behavior.  **Environment:** - Chrome version: 141.0.7390.54 - chrome-devtools-mcp: latest (npx chrome-devtools-mcp@latest) - OS: Ubuntu 22.04.5 LTS - Mode: `--headless=true --viewport=1280x720`  **Test Results:**  1. **`resize_page` tool fails silently**    - Called `resize_page({width: 1920, height: 1080})`    - Expected: viewport resized to 1920x1080    - Actual: viewport remains 800x513 (no error thrown)    - Verification: `window.innerWidth=800, window.innerHeight=513`  2. **`--viewport` startup option also ignored**    - MCP server started with `--viewport=1280x720`    - Expected: viewport initialized to 1280x720    - Actual: viewport defaults to 800x600 (screen.width=800, screen.height=600)  **Observation:** Unlike Chrome 139 which threw `'Browser.setContentsSize' wasn't found` error, Chrome 141 fails silently - the tool returns success

- **Issue #292** (2025-10-13): **Misleading error message in headless environment**
  *Symptoms*: **Describe the bug** When running the MCP server in a headless container (e.g. cloudtop), the error message is:  ```  MCP tool 'new_page' reported tool error for function call: {"name":"new_page","args":{"url":"https://example.com"}} with response: [{"functionResponse":{"name":"new_page","response":{"error":{"content":[{"type":"text","text":"The browser is already running for                                                                 │  │    ...... Use --isolated to run multiple browser instances."}],"isError":true}}}}] ```  Using `--isolated` is the wrong suggestion here. We should have a better   **To Reproduce** Use default config with Gemini CLI in a headless container (e.g. cloudtop for googlers) and run a simple prompt like: "Check performance of example.com"  **Expected behavior** There should be an error message that explains that the MCP server is running in a headless environment and needs the `headless` flag. 
  **Post-Mortem & Fix Analysis**:
  > Interesting. I started using this MCP on 10/8 and I did get it working in WSL.    Now today on 10/10, no matter what I do, I get  ``` Error: The browser is already running for /home/user/.cache/chrome-devtools-mcp/chrome-profile. Use --isolated to run      multiple browser instances. ```  **Edit: I was able to resolve the error by rolling back to `0.6.1`**

- **Issue #269** (2025-10-06): **"Not connected"in vscode cline**
  *Symptoms*: # Chrome DevTools MCP 修复报告  ## 问题诊断结果  ### ✅ 已确认正常的组件 1. **Chrome安装**：Chrome已正确安装在 `C:\Program Files\Google\Chrome\Application\chrome.exe` 2. **环境变量**：`CHROME_PATH` 环境变量已正确设置为 `C:\Program Files\Google\Chrome\Application\chrome.exe` 3. **Chrome调试端口**：端口9222正常响应，返回Chrome版本信息 4. **MCP服务器启动**：服务器可以正常启动并显示启动消息  ### ❌ 识别的问题 **MCP客户端连接问题**：尽管MCP服务器运行正常，但客户端显示"Not connected"错误  ## 修复步骤执行  ### 1. 环境检查 ✅ - Chrome路径：`C:\Program Files\Google\Chrome\Application\chrome.exe` ✓ - 环境变量：`CHROME_PATH=C:\Program Files\Google\Chrome\Application\chrome.exe` ✓  ### 2. 进程管理 ✅ - 终止所有旧的Node.js进程 ✓ - 清理可能冲突的MCP实例 ✓  ### 3. 服务器启动 ✅ - 方法1：使用`--executablePath`参数启动 ✓ - 方法2：使用`--browserUrl`参数启动 ✓ - Chrome远程调试端口9222正常响应 ✓  ### 4. 连接测试 ❌ - MCP客户端仍显示"Not connected"错误 - 服务器端运行正常，问题在客户端连接配置  ## 根本原因分析  **问题定位**：这是一个MCP客户端配置问题，而非服务器端功能问题。  **技术分析**： 1. MCP服务器启动正常，显示正确的启动消息 2. Chrome调试端口响应正常 3. MCP客户端无法连接到运行中的服务器实例 4. 可能的原因：    - MCP客户端缓存了旧的连接配置    - 客户端连接协议不匹配    - 客户端需要重新启动以刷新连接  ## 当前状态  ### 服务器端状态 ✅ - Chrome进程：运行正常，调试端口9222响应 - MCP服务器：已启动，显示正常启动消息 - 环境配置：所有路径和变量正确设置  ### 客户端状态 ❌ - 连接状态：显示"Not connected" - 错误类型：MCP协议连接错误 - 影响范围：无法使用chrome-devtools MCP工具  ## 解决方案  ### 立即解决方案 1. **重启MCP客户端**：完全关闭当前MCP客户端并重新打开 2. **清理配置缓存**：清除MCP客户端的连接配置缓存 3. **等待初始化**：给服务器30秒完全启动时间  ### 备用解决方案 1. **使用备用启动脚本**：创建新的启动脚本文件 2. **检查防火墙设置**：确保本地连接不受限制 3. **验证MCP协议版本**：确保客户端和服务器协议版本兼容  ## 验证命令  ### 检查Chrome调试端口 ```bash curl -s http://127.0.0.1:9222/json/version ```  ### 启动MCP服务器（方法1） ```bash npx chrome-devtools-mcp@latest --executablePa
  **Post-Mortem & Fix Analysis**:
  > This seems this is resolved (if google translate got it right)

- **Issue #262** (2025-10-07): **SyntaxError when running npx chrome-devtools-mcp@latest - UserMetric.js file**
  *Symptoms*: **Describe the bug**  The published npm package chrome-devtools-mcp@latest contains a truncated JavaScript file (UserMetrics.js) that causes an immediate syntax error when attempting to run the package. This prevents users from adding the MCP server to the coding agent.  Note: Building from source works correctly - this issue is specific to the published npm package.  **To Reproduce**  Steps to reproduce the behavior: 1. Run npx chrome-devtools-mcp@latest --help ( from Troubleshooting guide )  2. See error  **Expected behavior**  The command should execute successfully without any error. Instead, Node.js fails with a SyntaxError  **Error Output**  ```   file:///Users/username/.npm/_npx/.../node_modules/chrome-devtools-mcp/build/node_modules/chrome-devtools-frontend/front_end/core/host/UserMetrics.js:774       IssueCreated[IssueCreated["CookieIssue::ExcludeContextDowngrade::SetCookie::Secure"] = 28] =   "CookieIssue::ExcludeContextDowngrade::SetCookie::S    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^    SyntaxError: Invalid or unexpected token       at compileSourceTextModule (node:internal/modules/esm/utils:338:16)       at ModuleLoader.moduleStrategy (node:internal/modules/esm/translators:102:18)       at #translate (node:internal/modules/esm/loader:468:12)       at ModuleLoader.loadAndTranslate (node:internal/modules/esm/loader:515:27) ```  **Node.Js version:** v22.14.0 **Chrome version:** N/A **Coding agent version:** N/A **Model version:** N/A  
  **Post-Mortem & Fix Analysis**:
  > Hello,  Thanks for reporting. Unfortunately I am unable to reproduce, using Node v22.14, and **v0.6.0** of this package:  ``` [scratch/mcp-bug] $ node -v v22.14.0 [scratch/mcp-bug] $ npx chrome-devtools-mcp@latest --help Options:    [removed, but they output as expected here] [scratch/mcp-bug] $ npx chrome-devtools-mcp@latest --version 0.6.0 ```  Is it possible that something went wrong for you in the npx install step (bad internet connection?) that caused a file to be truncated?  Please could you try again and let us know if it works? Thanks 
  > <img width="888" height="295" alt="Image" src="https://github.com/user-attachments/assets/cf93fbfd-65e7-4810-8ac2-91f9f2770fb9" />  <img width="888" height="516" alt="Image" src="https://github.com/user-attachments/assets/78f5e37a-69ff-4a9d-91aa-a040919b4d3d" />  yeah I think something wrong with my npx setup, I tried running with `pnpm dlx chrome-devtools-mcp@latest --help` and it worked fine. False alarm. You can close it, thanks !
  > You are spot on ! I believe it is a corrupted download and the cache was serving that truncated version. I removed the npx cache and tried it again with npx command, it worked. Thanks !

- **Issue #261** (2025-10-10): **Headless isolated launch fails as root without --no-sandbox**
  *Symptoms*:   ## Summary   Running `chrome-devtools-mcp` as the root user causes Chrome to exit immediately with `Running as root without --no-sandbox is not supported`, so the MCP client receives `Target closed / Connection closed`   errors.    ## Environment   - chrome-devtools-mcp 0.6.0   - Node.js 22.20.0   - OS: Linux container (root user)   - Command: `node build/src/index.js --headless --isolated`    ## Steps to Reproduce   1. Checkout v0.6.0   2. Run `npm install && npm run build`   3. Execute `node build/src/index.js --headless --isolated` as root   4. Observe Chrome crashing with the log above and the MCP server exiting    ## Expected Behavior   The bundled Chrome should launch successfully even when the server runs as root (typical for containers/CI), without requiring extra flags from the user.    ## Suggested Fix   Automatically add sandbox flags when running as root. For example in `src/browser.ts`:    ```ts   const args = [     ...(options.args ?? []),     '--hide-crash-restore-bubble',   ];    if (process.getuid?.() === 0 && !args.some(arg => arg.startsWith('--no-sandbox'))) {     args.push('--no-sandbox', '--disable-setuid-sandbox');   }    Then rebuild (npm run build) so the generated build/src/browser.js picks up the same logic.
  **Post-Mortem & Fix Analysis**:
  > Encountering the same issue, can confirm the proposed solution works. it'll be nice to just allow passing additional args to chrome as launch args. e.g `--launch-arg="--no-sandbox --disable-setuid-sandbox"'
  > Generally we cannot recommend running without Chrome sandboxes or turn them off automatically but we can allow passing additional args to Chrome. Started a PR here https://github.com/ChromeDevTools/chrome-devtools-mcp/issues/261

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

### Incident Patch 1: `2e77c59c` (2026-10-01)
**Commit Message**: chore(deps): fix up deps (#2894)

Result of running npm audit fix.

**File**: `package-lock.json` (modified, +10/-57)
```diff
@@ -8,9 +8,6 @@
       "name": "chrome-devtools-mcp",
       "version": "1.10.1",
       "license": "Apache-2.0",
-      "dependencies": {
-        "third-party-web": "^0.30.0"
-      },
       "bin": {
         "chrome-devtools": "build/src/bin/chrome-devtools.js",
         "chrome-devtools-mcp": "build/src/bin/chrome-devtools-mcp.js"
@@ -477,9 +474,6 @@
         "x64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -894,9 +888,6 @@
         "arm"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -911,9 +902,6 @@
         "arm"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -928,9 +916,6 @@
         "arm64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -945,9 +930,6 @@
         "arm64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -962,9 +944,6 @@
         "loong64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -979,9 +958,6 @@
         "loong64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -996,9 +972,6 @@
         "ppc64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1013,9 +986,6 @@
         "ppc64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1030,9 +1000,6 @@
         "riscv64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1047,9 +1014,6 @@
         "riscv64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1064,9 +1028,6 @@
         "s390x"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1081,9 +1042,6 @@
         "x64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1098,9 +1056,6 @@
         "x64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -2291,8 +2246,9 @@
       }
     },
     "node_modules/brace-expansion": {
-      "version": "5.0.9",
-      "integrity": "sha512-ScQ4IuvIEF1TMlP7Zt+vjJ//9zlPb2SDcxWxM3bk8s6t6GGdJ7KO1dCcTidOPJKePW30LE/2cT7wCyPho9/Wxg==",
+      "version": "5.0.12",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz",
+      "integrity": "sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -3118,8 +3074,9 @@
       }
     },
     "node_modules/eslint-plugin-import/node_modules/brace-expansion": {
-      "version": "1.1.18",
-      "integrity": "sha512-Edep/X9fGqVNmzKBVsDYIOtD+z1tuezV70LBjdCst9Tqu76lsnvRiZ6oTic1n+/BIwX6QDGAO94PN4N2SADvtw==",
+      "version": "1.1.21",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.21.tgz",
+      "integrity": "sha512-9zeA+KLZNNzglF2TPKRQEDyx6Yby7daAkuy8MiPzpXPsYDWi/DRM8jmwUDxokQjYqBpv5DgPiwD4h4ZZSy1Ujw==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
@@ -4467,6 +4424,7 @@
     },
     "node_modules/legacy-javascript": {
       "version": "0.0.1",
+      "resolved": "https://registry.npmjs.org/legacy-javascript/-/legacy-javascript-0.0.1.tgz",
       "integrity": "sha512-lPyntS4/aS7jpuvOlitZDFifBCb4W8L/3QU0PLbUTUj+zYah8rfVjYic88yG7ZKTxhS5h9iz7duT8oUXKszLhg==",
       "dev": true,
       "license": "Apache-2.0"
@@ -4624,12 +4582,6 @@
         "node": ">=8"
       }
     },
-    "node_modules/lighthouse/node_modules/third-party-web": {
-      "version": "0.29.2",
-      "integrity": "sha512-fegtha91tq2DHphyoiBXVHjVi2YG9zFaRnboT9C28tO1en9Y3wJsfspuy40F+u5wl3hHVbw7cnd1b67kEGHb8g==",
-      "dev": true,
-      "license": "MIT"
-    },
     "node_modules/lighthouse/node_modules/wrap-ansi": {
       "version": "7.0.0",
       "integrity": "sha512-YVGIj2kamLSTxw6NsZjoBxfSwsn0ycdesmc4p+Q21c5zPuZ1pl+NfxVdxPtdHvmNVOQ6XSYG4AUtyt/Fi7D16Q==",
@@ -4825,8 +4777,9 @@
       "license": "MIT"
     },
     "node_modules/moment": {
-      "version": "2.30.1",
-      "integrity": "sha512-uEmtNhbDOrWPFS+hdjFCBfy9f2YoyzRpwcl+DqpC6taX21FzsTLQVbMV/
```

---

### Incident Patch 2: `4418a7b3` (2026-10-01)
**Commit Message**: fix: harden third-party tool result serialization (#2892)

## Summary

Hardens `McpPage.executeThirdPartyDeveloperTool` against CDP
`returnByValue` serialization failures and edge-case values returned by
third-party developer tools.

Previously, if a tool returned values that CDP `Runtime.evaluate`
(`returnByValue: true`) could not serialize (such as `Symbol`, `BigInt`,
circular arrays, deeply nested objects, or `Object.create(null)`),
`pptrPage.evaluate` either threw or resolved to `undefined`, resulting
in `TypeError: Cannot read properties of undefined (reading 'stashed')`
and leaving `window.__dtmcp.stashedElements` uncleaned.

## Changes

- **In-page JSON serialization**: Stringify the processed tool result
inside `pptrPage.evaluate` and `JSON.parse` it in Node so CDP only
transfers a flat `{result?: string, stashed: number}` object by value.
  - **Improved `processToolResult` handling**:
- Track active ancestors using a `Set` with `try ... finally` cleanup
across both arrays and plain objects, fixing circular array recursion
while preserving shared (non-circular DAG) references.
- Treat `Object.create(null)` (`proto === null`) as a plain object and
fall back to `<Object insta

**File**: `src/McpPage.ts` (modified, +77/-49)
```diff
@@ -631,75 +631,90 @@ export class McpPage implements ContextPage {
 
         const toolResult = await window.__dtmcp.executeTool(name, args);
 
+        const stashedElements: Element[] = [];
+
         const stashDOMElement = (el: Element) => {
-          if (!window.__dtmcp) {
-            window.__dtmcp = {};
-          }
-          if (window.__dtmcp.stashedElements === undefined) {
-            window.__dtmcp.stashedElements = [];
-          }
-          window.__dtmcp.stashedElements.push(el);
+          stashedElements.push(el);
           return {
-            stashedId: `stashed-${window.__dtmcp.stashedElements.length - 1}`,
+            stashedId: `stashed-${stashedElements.length - 1}`,
           };
         };
 
-        const ancestors: unknown[] = [];
+        const ancestors = new Set<unknown>();
         // Recursively walks the tool result:
         // - Replaces DOM elements with an ID and stashes the DOM element on the window object
         // - Replaces non-plain objects with a string representation of the object
         // - Replaces circular references with the string '<Circular reference>'
         // - Replaces functions with the string '<Function object>'
-        const processToolResult = (
-          data: unknown,
-          parentEl?: unknown,
-        ): unknown => {
+        // - Replaces symbols and bigints with their string representation
+        const processToolResult = (data: unknown): unknown => {
           // 1. Handle DOM Elements
           if (data instanceof Element) {
             return stashDOMElement(data);
           }
 
           // 2. Handle Arrays
           if (Array.isArray(data)) {
-            return data.map((item: unknown) =>
-              processToolResult(item, parentEl),
-            );
+            if (ancestors.has(data)) {
+              return '<Circular reference>';
+            }
+            ancestors.add(data);
+            try {
+              return data.map((item: unknown) => processToolResult(item));
+            } finally {
+              ancestors.delete(data);
+            }
           }
 
           // 3. Handle Objects
           if (data !== null && typeof data === 'object') {
-            while (ancestors.length > 0 && ancestors.at(-1) !== parentEl) {
-              ancestors.pop();
-            }
-            if (ancestors.includes(data)) {
-              return '<Circular reference>';
-            }
-            ancestors.push(data);
-
+            const proto = Object.getPrototypeOf(data);
             // If not a plain object, return a string representation of the object
-            if (Object.getPrototypeOf(data) !== Object.prototype) {
-              return `<${data.constructor.name} instance>`;
+            if (proto !== null && proto !== Object.prototype) {
+              return `<${data.constructor?.name || 'Object'} instance>`;
             }
 
-            const processedObj: Record<string, unknown> = {};
-            for (const [key, value] of Object.entries(data)) {
-              processedObj[key] = processToolResult(value, data);
+            if (ancestors.has(data)) {
+              return '<Circular reference>';
+            }
+            ancestors.add(data);
+            try {
+              const processedObj: Record<string, unknown> = {};
+              for (const [key, value] of Object.entries(data)) {
+                processedObj[key] = processToolResult(value);
+              }
+              return processedObj;
+            } finally {
+              ancestors.delete(data);
             }
-            return processedObj;
           }
 
           // 4. Handle Functions
           if (typeof data === 'function') {
             return '<Function object>';
           }
 
-          // 5. Return primitives (strings, numbers, booleans) as-is
+          // 5. Handle Symbols and BigInts (not JSON/CDP-by-value serializable)
+          if (typeof data === 'symbol') {
+            return data.toString();
+          }
+          if (typeof data === 'bigint') {
+            return `${data.toString()}n`;
+          }
+
+          // 6. Return primitives (strings, numbers, booleans, undefined, null) as-is
           return data;
         };
 
+        const processed = processToolResult(toolResult);
+        const serialized =
+          processed !== undefined ? JSON.stringify(processed) : undefined;
+        if (stashedElements.length > 0) {
+          window.__dtmcp.stashedElements = stashedElements;
+        }
         return {
-          result: processToolResult(toolResult),
-          stashed: window.__dtmcp?.stashedElements?.length ?? 0,
+          result: serialized,
+          stashed: stashedElements.length,
         };
       },
       toolName,
@@ -708,22 +723,30 @@ export class McpPage implements ContextPage {
     );
 
     const elementHandles: ElementHandle[] = [];
-    for (let i = 0; i < (result.stashed ?? 0); i++) {
-      const elementHandle = await this.pptrPage.evaluateHandle(index =>
```

**File**: `tests/McpPage.test.ts` (modified, +45/-1)
```diff
@@ -16,7 +16,11 @@ import {DevTools, Locator} from '../src/third_party/index.js';
 import type {JSONSchema7Definition} from '../src/third_party/index.js';
 import {TextSnapshot} from '../src/TextSnapshot.js';
 import type {TextSnapshotNode} from '../src/types.js';
-import {createMockPuppeteerPage, createMockPuppeteerTarget} from './mocks.js';
+import {
+  createMockMcpResponse,
+  createMockPuppeteerPage,
+  createMockPuppeteerTarget,
+} from './mocks.js';
 import {serverHooks} from './server.js';
 import {getMockRequest, html, withMcpContext} from './utils.js';
 
@@ -1211,4 +1215,44 @@ describe('McpPage', () => {
       });
     });
   });
+
+  describe('executeThirdPartyDeveloperTool()', () => {
+    afterEach(() => {
+      sinon.restore();
+    });
+
+    it('appends "Tool returned no result." and skips cleanup evaluate when the tool returns undefined and stashed is 0', async () => {
+      const {mcpPage, pptrPage} = await createMcpPage();
+      const response = createMockMcpResponse();
+      pptrPage.evaluate.resolves({result: undefined, stashed: 0});
+
+      await mcpPage.executeThirdPartyDeveloperTool('my-tool', {}, response);
+
+      sinon.assert.calledOnce(pptrPage.evaluate);
+      sinon.assert.calledOnceWithExactly(
+        response.appendResponseLine,
+        'Tool returned no result.',
+      );
+    });
+
+    it('preserves the original evaluateHandle error when stashedElements cleanup fails', async () => {
+      const {mcpPage, pptrPage} = await createMcpPage();
+      const response = createMockMcpResponse();
+      pptrPage.evaluate
+        .onFirstCall()
+        .resolves({result: '{"stashedId":"stashed-0"}', stashed: 1});
+      pptrPage.evaluateHandle.rejects(
+        new Error('Execution context was destroyed'),
+      );
+      pptrPage.evaluate.onSecondCall().rejects(new Error('Target closed'));
+
+      await assert.rejects(
+        () => mcpPage.executeThirdPartyDeveloperTool('my-tool', {}, response),
+        /Execution context was destroyed/,
+      );
+
+      sinon.assert.calledTwice(pptrPage.evaluate);
+      sinon.assert.notCalled(response.appendResponseLine);
+    });
+  });
 });
```

**File**: `tests/tools/thirdPartyDeveloper.test.ts` (modified, +76/-0)
```diff
@@ -734,6 +734,82 @@ describe('thirdPartyDeveloperTools', () => {
       );
     });
 
+    it('processToolResult handles symbols, bigints, circular arrays, shared references, and null-prototype objects', async () => {
+      await withMcpContext(
+        async (response, context, args) => {
+          const page = await context.newPage();
+          response.setPage(page);
+
+          page.thirdPartyDeveloperTools = [
+            {
+              name: 'test-group',
+              description: 'test description',
+              tools: [
+                {
+                  name: 'test-tool',
+                  description: 'test tool description',
+                  inputSchema: {},
+                },
+              ],
+            },
+          ];
+
+          await page.pptrPage.evaluate(() => {
+            window.__dtmcp = {
+              executeTool: async () => {
+                const circularArr: unknown[] = ['item'];
+                circularArr.push(circularArr);
+                const sharedObj = {sharedKey: 'sharedVal'};
+                const nullProtoObj: Record<string, unknown> =
+                  Object.create(null);
+                nullProtoObj.key = 'val';
+                const AnonymousClass = (() => class {})();
+                return {
+                  sym: Symbol('test-sym'),
+                  big: BigInt(42),
+                  circularArr,
+                  shared1: sharedObj,
+                  shared2: sharedObj,
+                  nullProtoObj,
+                  anonInstance: new AnonymousClass(),
+                };
+              },
+            };
+          });
+
+          await executeThirdPartyDeveloperTool(args).handler(
+            {
+              params: {
+                toolName: 'test-tool',
+                params: JSON.stringify({}),
+              },
+              page,
+            },
+            response,
+            context,
+          );
+          assert.strictEqual(
+            response.responseLines[0],
+            JSON.stringify(
+              {
+                sym: 'Symbol(test-sym)',
+                big: '42n',
+                circularArr: ['item', '<Circular reference>'],
+                shared1: {sharedKey: 'sharedVal'},
+                shared2: {sharedKey: 'sharedVal'},
+                nullProtoObj: {key: 'val'},
+                anonInstance: '<Object instance>',
+              },
+              null,
+              2,
+            ),
+          );
+        },
+        undefined,
+        {categoryExperimentalThirdParty: true},
+      );
+    });
+
     it('stashDOMElement stashes elements and returns UID', async () => {
       await withMcpContext(
         async (response, context, args) => {
```

---

### Incident Patch 3: `63010cb3` (2026-10-01)
**Commit Message**: fix(pwa): wait for initial navigation on launch and retry transient install error (#2889)

Fixes CI flakiness in `tests/tools/pwa.test.ts`:

- Wait for initial navigation in `McpContext.launchPWA` when the newly
created app window's `page.url()` is still empty or `about:blank`.
- Retry `browser.installPWA` once in `McpContext.installPWA` when
Chromium's background `WebAppUrlLoader` fails with `Couldn't fetch
install info` on cold start.

**File**: `src/McpContext.ts` (modified, +24/-4)
```diff
@@ -357,16 +357,36 @@ export class McpContext implements Context {
     return !!(this.#options.allowlist || this.#options.blocklist);
   }
 
-  installPWA(options: InstallPWAOptions): Promise<string> {
-    return this.browser.installPWA(options);
+  async installPWA(options: InstallPWAOptions): Promise<string> {
+    try {
+      return await this.browser.installPWA(options);
+    } catch (error) {
+      if (
+        error instanceof Error &&
+        error.message.includes("Couldn't fetch install info")
+      ) {
+        return await this.browser.installPWA(options);
+      }
+      throw error;
+    }
   }
 
   uninstallPWA(options: UninstallPWAOptions): Promise<void> {
     return this.browser.uninstallPWA(options);
   }
 
-  launchPWA(options: LaunchPWAOptions): Promise<Page> {
-    return this.browser.launchPWA(options);
+  async launchPWA(options: LaunchPWAOptions): Promise<Page> {
+    const page = await this.browser.launchPWA(options);
+    if (!page.url() || page.url() === 'about:blank') {
+      await page
+        .waitForNavigation({
+          timeout: this.#options.navigationTimeout ?? 10_000,
+        })
+        .catch(() => {
+          // Ignore timeout if navigation already completed or failed.
+        });
+    }
+    return page;
   }
 
   getPWAState(options: GetPWAStateOptions): Promise<PWAState> {
```

---

### Incident Patch 4: `551dd6ca` (2026-10-01)
**Commit Message**: fix(collectors): ignore transient target errors when subscribing to service workers (#2888)

Fixes CI flakiness in `tests/McpContext.test.ts` (`unhandledRejection:
ProtocolError: Protocol error (Target.attachToTarget): No target with
given id found`).

- Ignore `No target with given id found` and `No session with given id`
in `ServiceWorkerConsoleCollector`, track subscribers before awaiting
`subscribe()`, and clean up if destroyed/disposed mid-subscription.
- Dispose `McpContext` inside a `try ... finally` block in
`withMcpContext` so target listeners do not outlive the test callback.
- Add unit test in `tests/collectors/ServiceWorkerCollector.test.ts`.

**File**: `src/collectors/ServiceWorkerCollector.ts` (modified, +21/-17)
```diff
@@ -101,11 +101,7 @@ export class ServiceWorkerConsoleCollector {
     this.#browser.off('targetdestroyed', this.#onTargetDestroyed);
     for (const subscriber of this.#serviceWorkerSubscribers.values()) {
       subscriber.unsubscribe().catch(err => {
-        if (
-          err instanceof Error &&
-          !err.message.includes('Target closed') &&
-          !err.message.includes('Session closed')
-        ) {
+        if (!isIgnoredTargetError(err)) {
           // Swallow error as we are tearing down the system
         }
       });
@@ -128,36 +124,34 @@ export class ServiceWorkerConsoleCollector {
       const subscriber = new ServiceWorkerSubscriber(target, item => {
         this.addLog(extensionId, item);
       });
+      this.#serviceWorkerSubscribers.set(target, subscriber);
       try {
         await subscriber.subscribe();
+        if (this.#serviceWorkerSubscribers.get(target) !== subscriber) {
+          await subscriber.unsubscribe();
+        }
       } catch (err) {
-        if (
-          err instanceof Error &&
-          !err.message.includes('Target closed') &&
-          !err.message.includes('Session closed')
-        ) {
+        if (this.#serviceWorkerSubscribers.get(target) === subscriber) {
+          this.#serviceWorkerSubscribers.delete(target);
+        }
+        if (!isIgnoredTargetError(err)) {
           throw err;
         }
       }
-      this.#serviceWorkerSubscribers.set(target, subscriber);
     }
   };
 
   #onTargetDestroyed = async (target: Target) => {
     const subscriber = this.#serviceWorkerSubscribers.get(target);
     if (subscriber) {
+      this.#serviceWorkerSubscribers.delete(target);
       try {
         await subscriber.unsubscribe();
       } catch (err) {
-        if (
-          err instanceof Error &&
-          !err.message.includes('Target closed') &&
-          !err.message.includes('Session closed')
-        ) {
+        if (!isIgnoredTargetError(err)) {
           throw err;
         }
       }
-      this.#serviceWorkerSubscribers.delete(target);
     }
   };
 
@@ -225,3 +219,13 @@ function extractExtensionId(origin: string): string | null {
 function isExtensionOrigin(origin: string) {
   return origin.startsWith(CHROME_EXTENSION_PREFIX);
 }
+
+function isIgnoredTargetError(err: unknown): boolean {
+  return (
+    err instanceof Error &&
+    (err.message.includes('Target closed') ||
+      err.message.includes('Session closed') ||
+      err.message.includes('No target with given id found') ||
+      err.message.includes('No session with given id'))
+  );
+}
```

**File**: `tests/collectors/ServiceWorkerCollector.test.ts` (modified, +32/-2)
```diff
@@ -5,14 +5,25 @@
  */
 
 import assert from 'node:assert';
-import {describe, it} from 'node:test';
+import {afterEach, describe, it} from 'node:test';
+
+import sinon from 'sinon';
 
 import {UncaughtError} from '../../src/collectors/PageCollector.js';
 import {ServiceWorkerConsoleCollector} from '../../src/collectors/ServiceWorkerCollector.js';
-import type {Protocol} from '../../src/third_party/index.js';
+import {McpWorker} from '../../src/McpWorker.js';
+import {TargetType, type Protocol} from '../../src/third_party/index.js';
 import {stableIdSymbol} from '../../src/utils/id.js';
+import {
+  createMockPuppeteerBrowser,
+  createMockPuppeteerTarget,
+} from '../mocks.js';
 
 describe('ServiceWorkerConsoleCollector', () => {
+  afterEach(() => {
+    sinon.restore();
+  });
+
   it('limits logs to 1000 per extension', () => {
     const collector = new ServiceWorkerConsoleCollector(undefined, 10);
     const extensionId = 'test-extension';
@@ -72,4 +83,23 @@ describe('ServiceWorkerConsoleCollector', () => {
       'find should return correct log',
     );
   });
+
+  it('ignores "No target with given id found" when service worker target disappears during subscribe', async () => {
+    const browser = createMockPuppeteerBrowser();
+    const target = createMockPuppeteerTarget({
+      url: 'chrome-extension://ext-id/sw.js',
+    });
+    target.type.returns(TargetType.SERVICE_WORKER);
+    target.createCDPSession.rejects(
+      new Error(
+        'Protocol error (Target.attachToTarget): No target with given id found',
+      ),
+    );
+
+    const collector = new ServiceWorkerConsoleCollector(browser);
+    await collector.init([new McpWorker('sw-1', 'service_worker', target)]);
+    await new Promise(resolve => setTimeout(resolve, 0));
+    sinon.assert.calledOnce(target.createCDPSession);
+    collector.dispose();
+  });
 });
```

**File**: `tests/mocks.ts` (modified, +8/-0)
```diff
@@ -144,6 +144,14 @@ export function createMockPuppeteerBrowser(): sinon.SinonStubbedInstance<Browser
   browser.process.returns(null);
 
   const browserListener = mockListener();
+  browser.on.callsFake((eventName, handler) => {
+    browserListener.on(eventName, handler);
+    return browser;
+  });
+  browser.off.callsFake((eventName, handler) => {
+    browserListener.off(eventName, handler);
+    return browser;
+  });
   browser.once.callsFake((eventName, handler) => {
     const onceHandler = (data: unknown) => {
       browserListener.off(eventName, onceHandler);
```

**File**: `tests/utils.ts` (modified, +6/-1)
```diff
@@ -212,7 +212,12 @@ export async function withMcpContext(
 
     response.setPage(context.getSelectedMcpPage());
 
-    await cb(response, context, parsedArgs);
+    try {
+      await cb(response, context, parsedArgs);
+    } finally {
+      context.dispose();
+      context = undefined;
+    }
   }, options);
 }
 
```

---

### Incident Patch 5: `ed82e418` (2026-10-01)
**Commit Message**: test: retry transient navigation and dialog setup timeouts (#2890)

Fixes Windows CI flakiness in `tests/index.test.ts`,
`tests/network_blocking.test.ts`, and
`tests/utils/WaitForHelper.test.ts`:

- Throw on `isError` in `createNewPageAndTriggerDialog`
(`tests/index.test.ts`) so `withClient` retries when `new_page`,
`take_snapshot`, or `click` times out instead of continuing without an
open dialog.
- Treat uncaught `Navigation timeout` and `Couldn't fetch install info`
errors as retryable in `withBrowser` (`tests/utils.ts`) after killing
and evicting the browser.

Co-authored-by: Natasha Gorshunova <[REDACTED_EMAIL]>

**File**: `tests/index.test.ts` (modified, +22/-2)
```diff
@@ -436,23 +436,40 @@ describe('e2e', () => {
   });
 
   describe('Dialogs', () => {
+    function getFirstText(
+      result: Awaited<ReturnType<Client['callTool']>>,
+    ): string {
+      const first = Array.isArray(result.content)
+        ? result.content[0]
+        : undefined;
+      return first && 'text' in first && typeof first.text === 'string'
+        ? first.text
+        : '';
+    }
+
     async function createNewPageAndTriggerDialog(client: Client) {
       // Navigate to a page with a button that triggers a dialog on click
-      await client.callTool({
+      const newPageResult = await client.callTool({
         name: 'new_page',
         arguments: {
           url: `data:text/html,<button id="test" onclick="alert('test dialog')">Click me</button>`,
         },
       });
+      if (newPageResult.isError) {
+        throw new Error(getFirstText(newPageResult));
+      }
 
       const snapshotResult = await client.callTool({
         name: 'take_snapshot',
         arguments: {
           pageId: 2,
         },
       });
+      if (snapshotResult.isError) {
+        throw new Error(getFirstText(snapshotResult));
+      }
 
-      const snapshotText = (snapshotResult.content as TextContent[])[0].text;
+      const snapshotText = getFirstText(snapshotResult);
       const match = snapshotText.match(/uid=(\d+_\d+)\s+button "Click me"/);
       const uid = match ? match[1] : '1_1';
 
@@ -464,6 +481,9 @@ describe('e2e', () => {
           uid,
         },
       });
+      if (result.isError) {
+        throw new Error(getFirstText(result));
+      }
 
       return result;
     }
```

**File**: `tests/utils.ts` (modified, +2/-0)
```diff
@@ -148,6 +148,8 @@ export async function withBrowser(
       const isRetryable =
         error instanceof Error &&
         (error.message === 'withBrowser timeout exceeded' ||
+          error.message.includes('Navigation timeout') ||
+          error.message.includes("Couldn't fetch install info") ||
           error.message.includes('closed') ||
           error.message.includes('crash') ||
           error.message.includes('hang'));
```

---

### Incident Patch 6: `f3db5e72` (2026-10-01)
**Commit Message**: fix(daemon): bound browser shutdown and avoid watchFile timeout on stop (#2887)

Fixes CI flakiness in `tests/e2e/chrome-devtools-commands.test.ts`
(`Timeout: file .../daemon.pid not removed within 10000ms` during
`stopDaemon`).

- Bound `browser.close()` in `BrowserManager.#closeLaunchedBrowser()`
with a 5s timeout and fall back to `SIGKILL` so slow/hung Chrome
shutdowns on macOS/Windows do not block `mcpServer.close()` and
`daemon.pid` removal.
- Replace `fs.watchFile` in `waitForFile` with 100ms polling, close the
client socket on response in `sendCommand`, and fall back to `SIGKILL` +
unlinking `daemon.pid` in `stopDaemon` if shutdown still times out.
- Make `cleanup()` in `src/daemon/daemon.ts` idempotent.

**File**: `src/BrowserManager.ts` (modified, +23/-6)
```diff
@@ -445,9 +445,7 @@ export class BrowserManager {
     this.#browser = undefined;
     this.#browserMode = undefined;
     if (mode === 'launched') {
-      void candidate.close().catch(err => {
-        logger?.('Failed to close forgotten browser', err);
-      });
+      void this.#closeLaunchedBrowser(candidate);
     } else {
       void candidate.disconnect().catch(err => {
         logger?.('Failed to disconnect forgotten browser', err);
@@ -473,6 +471,27 @@ export class BrowserManager {
     this.#browserMode = undefined;
   }
 
+  async #closeLaunchedBrowser(browser: Browser): Promise<void> {
+    let timer: ReturnType<typeof setTimeout> | undefined;
+    try {
+      await Promise.race([
+        browser.close(),
+        new Promise<never>((_, reject) => {
+          timer = setTimeout(
+            () => reject(new Error('Timed out closing browser')),
+            5_000,
+          );
+          timer.unref?.();
+        }),
+      ]);
+    } catch (err) {
+      logger?.('Failed to close browser', err);
+      browser.process()?.kill('SIGKILL');
+    } finally {
+      clearTimeout(timer);
+    }
+  }
+
   async #closeBrowser(): Promise<void> {
     const browser = this.#browser;
     const mode = this.#browserMode;
@@ -482,9 +501,7 @@ export class BrowserManager {
       return;
     }
     if (mode === 'launched') {
-      await browser.close().catch(err => {
-        logger?.('Failed to close browser', err);
-      });
+      await this.#closeLaunchedBrowser(browser);
       return;
     }
     await browser.disconnect().catch(err => {
```

**File**: `src/daemon/client.ts` (modified, +56/-40)
```diff
@@ -21,6 +21,7 @@ import type {
 } from './types.js';
 import {
   DAEMON_SCRIPT_PATH,
+  getDaemonPid,
   getSocketPath,
   getPidFilePath,
   isDaemonRunning,
@@ -30,54 +31,49 @@ const FILE_TIMEOUT = 10_000;
 const READY_CHECK_INTERVAL = 100;
 const READY_CHECK_COMMAND_TIMEOUT = 1_000;
 
+function delay(ms: number) {
+  return new Promise<void>(resolve => {
+    setTimeout(resolve, ms);
+  });
+}
+
 /**
  * Waits for a file to be created and populated (removed = false) or removed (removed = true).
  */
-function waitForFile(filePath: string, removed = false) {
-  return new Promise<void>((resolve, reject) => {
-    const check = () => {
-      const exists = fs.existsSync(filePath);
-      if (removed) {
-        return !exists;
-      }
-      if (!exists) {
-        return false;
-      }
-      try {
-        return fs.statSync(filePath).size > 0;
-      } catch {
-        return false;
-      }
-    };
+async function waitForFile(filePath: string, removed = false) {
+  const check = () => {
+    const exists = fs.existsSync(filePath);
+    if (removed) {
+      return !exists;
+    }
+    if (!exists) {
+      return false;
+    }
+    try {
+      return fs.statSync(filePath).size > 0;
+    } catch {
+      return false;
+    }
+  };
 
+  const deadline = Date.now() + FILE_TIMEOUT;
+  while (Date.now() < deadline) {
     if (check()) {
-      resolve();
       return;
     }
+    const timeLeft = deadline - Date.now();
+    if (timeLeft > 0) {
+      await delay(Math.min(READY_CHECK_INTERVAL, timeLeft));
+    }
+  }
 
-    const timer = setTimeout(() => {
-      fs.unwatchFile(filePath);
-      reject(
-        new Error(
-          `Timeout: file ${filePath} ${removed ? 'not removed' : 'not found'} within ${FILE_TIMEOUT}ms`,
-        ),
-      );
-    }, FILE_TIMEOUT);
-
-    fs.watchFile(filePath, {interval: 500}, () => {
-      if (check()) {
-        clearTimeout(timer);
-        fs.unwatchFile(filePath);
-        resolve();
-      }
-    });
-  });
-}
+  if (check()) {
+    return;
+  }
 
-function delay(ms: number) {
-  return new Promise<void>(resolve => {
-    setTimeout(resolve, ms);
-  });
+  throw new Error(
+    `Timeout: file ${filePath} ${removed ? 'not removed' : 'not found'} within ${FILE_TIMEOUT}ms`,
+  );
 }
 
 async function waitForDaemonReady(sessionId: string) {
@@ -180,6 +176,7 @@ export async function sendCommand(
     transport.onmessage = async (message: string) => {
       clearTimeout(timer);
       logger?.('onmessage', message);
+      socket.end();
       resolve(JSON.parse(message));
     };
     socket.on('error', error => {
@@ -203,11 +200,30 @@ export async function stopDaemon(sessionId: string) {
     return;
   }
 
+  const pid = getDaemonPid(sessionId);
   const pidFilePath = getPidFilePath(sessionId);
 
   await sendCommand({method: 'stop'}, sessionId);
 
-  await waitForFile(pidFilePath, /*removed=*/ true);
+  try {
+    await waitForFile(pidFilePath, /*removed=*/ true);
+  } catch (error) {
+    if (pid) {
+      try {
+        process.kill(pid, 'SIGKILL');
+      } catch {
+        // Ignore if process already exited.
+      }
+    }
+    try {
+      fs.unlinkSync(pidFilePath);
+    } catch {
+      // Ignore if file already removed.
+    }
+    if (isDaemonRunning(sessionId)) {
+      throw error;
+    }
+  }
 }
 
 export async function verifyDaemonVersion(
```

**File**: `src/daemon/daemon.ts` (modified, +11/-2)
```diff
@@ -259,7 +259,13 @@ async function startSocketServer() {
   });
 }
 
+let isCleaningUp = false;
+
 async function cleanup(exitCode = 0) {
+  if (isCleaningUp) {
+    return;
+  }
+  isCleaningUp = true;
   console.log('Cleaning up daemon...');
 
   try {
@@ -268,8 +274,9 @@ async function cleanup(exitCode = 0) {
     logger?.('Error closing MCP server:', error);
   }
   if (server) {
+    const activeServer = server;
     await new Promise<void>(resolve => {
-      server!.close(() => resolve());
+      activeServer.close(() => resolve());
     });
   }
   if (!IS_WINDOWS) {
@@ -280,8 +287,10 @@ async function cleanup(exitCode = 0) {
     }
   }
   logger?.(`unlinking ${pidFilePath}`);
-  if (fs.existsSync(pidFilePath)) {
+  try {
     fs.unlinkSync(pidFilePath);
+  } catch {
+    // ignore errors
   }
   process.exit(exitCode);
 }
```

---

### Incident Patch 7: `952268f8` (2026-10-01)
**Commit Message**: build: pass --init to git submodule update in prepare script (#2891)

On a fresh `git clone`, the `devtools-frontend` submodule is not yet
registered in `.git/config`. Running `git submodule update --force
--checkout third_party/devtools-frontend` without `--init` in
`scripts/prepare.ts` printed:

```
Submodule path 'third_party/devtools-frontend' not initialized
Maybe you want to use 'update --init'?
```

and exited with code 0 without checking out any files, causing `npm run
build` to fail right after `npm ci`.

This change:
- Adds `--init` to `git submodule update` in `scripts/prepare.ts` so
fresh clones initialize and check out the submodule out of the box.
- Adds `--no-tags` to the initial shallow `git clone` of
`devtools-frontend` in `scripts/prepare.ts` to avoid fetching hundreds
of release tags during `git submodule update`.
- Runs `git submodule deinit --force` in `scripts/clean-submodules.ts`
so `npm run clean:submodules` resets `.git/config` to the same state as
a fresh clone.

**File**: `scripts/clean-submodules.ts` (modified, +10/-0)
```diff
@@ -4,13 +4,23 @@
  * SPDX-License-Identifier: Apache-2.0
  */
 
+import {execSync} from 'node:child_process';
 import {rmSync, existsSync} from 'node:fs';
 import {resolve} from 'node:path';
 
 const projectRoot = process.cwd();
 
 console.log('Cleaning submodules...');
 
+try {
+  execSync('git submodule deinit --force third_party/devtools-frontend', {
+    cwd: projectRoot,
+    stdio: 'inherit',
+  });
+} catch {
+  // Ignore errors if the submodule was not initialized.
+}
+
 const directoriesToRemove = [
   resolve(projectRoot, 'third_party', 'devtools-frontend'),
   resolve(projectRoot, '.git', 'modules', 'devtools-frontend'),
```

**File**: `scripts/prepare.ts` (modified, +2/-2)
```diff
@@ -73,7 +73,7 @@ function ensureSubmodule(): void {
 
     // 1. Clone only the tree structure of the default branch (no blobs)
     execSync(
-      'git clone --no-checkout --depth 1 --filter=blob:none https://github.com/ChromeDevTools/devtools-frontend.git third_party/devtools-frontend',
+      'git clone --no-checkout --depth 1 --no-tags --filter=blob:none https://github.com/ChromeDevTools/devtools-frontend.git third_party/devtools-frontend',
       {
         cwd: projectRoot,
         stdio: 'inherit',
@@ -97,7 +97,7 @@ function ensureSubmodule(): void {
 
     // 4. Update the submodule to the correct commit (this fetches the commit and only downloads the blobs for the sparse checkout)
     execSync(
-      'git submodule update --force --checkout third_party/devtools-frontend',
+      'git submodule update --init --force --checkout third_party/devtools-frontend',
       {
         cwd: projectRoot,
         stdio: 'inherit',
```

---

### Incident Patch 8: `5b2c6f97` (2026-10-01)
**Commit Message**: fix: reject named groups in URL patterns (#2857)

Reject `--blockedUrlPattern` and `--allowedUrlPattern` values that
contain `:name` named groups in any URL component (e.g.,
`*://127.0.0.1::port/*`, `*://:sub.example.com/*`,
`*://example.com/:path`). Previously, only regexp groups like
`(foo|bar)` were rejected, allowing named groups to pass CLI validation
even though Chrome cannot enforce them on redirects or subresources.

**File**: `docs/configuration.md` (modified, +2/-2)
```diff
@@ -122,11 +122,11 @@ The Chrome DevTools MCP server supports the following configuration option:
   - **Default:** `false`
 
 - **`--blockedUrlPattern`/ `--blocked-url-pattern`**
-  Restricts browser's network access by blocking specified URL patterns (uses https://urlpattern.spec.whatwg.org/). Silently detaches from targets with blocked URLs upon connection, and blocks runtime requests (including navigations and subresources). Accepts an array of patterns. A pattern that uses a regexp group in any component (for example `(127\.\d+\.\d+\.\d+)` in the hostname) is rejected, because it is not enforced on redirects or subresources; use an exact value or a `*`/`:name` wildcard instead.
+  Restricts browser's network access by blocking specified URL patterns (uses https://urlpattern.spec.whatwg.org/). Silently detaches from targets with blocked URLs upon connection, and blocks runtime requests (including navigations and subresources). Accepts an array of patterns. A pattern that uses a regexp group or a named group (`:name`) in any component (for example `(127\.\d+\.\d+\.\d+)` in the hostname or `*://127.0.0.1::port/*`) is rejected, because it is not enforced on redirects or subresources; use an exact value or a `*` wildcard instead.
   - **Type:** array
 
 - **`--allowedUrlPattern`/ `--allowed-url-pattern`**
-  Restricts browser's network access by allowing only specified URL patterns (uses https://urlpattern.spec.whatwg.org/). Requires Chrome 149+. Silently detaches from targets with unallowed URLs upon connection, and blocks runtime requests (including navigations and subresources). Accepts an array of patterns. A pattern that uses a regexp group in any component (for example `(127\.\d+\.\d+\.\d+)` in the hostname) is rejected, because it is not enforced on redirects or subresources; use an exact value or a `*`/`:name` wildcard instead.
+  Restricts browser's network access by allowing only specified URL patterns (uses https://urlpattern.spec.whatwg.org/). Requires Chrome 149+. Silently detaches from targets with unallowed URLs upon connection, and blocks runtime requests (including navigations and subresources). Accepts an array of patterns. A pattern that uses a regexp group or a named group (`:name`) in any component (for example `(127\.\d+\.\d+\.\d+)` in the hostname or `*://127.0.0.1::port/*`) is rejected, because it is not enforced on redirects or subresources; use an exact value or a `*` wildcard instead.
   - **Type:** array
 
 - **`--screenshotFormat`/ `--screenshot-format`**
```

**File**: `src/config/puppeteer-options.ts` (modified, +4/-4)
```diff
@@ -39,15 +39,15 @@ export const puppeteerOptions = {
     type: 'array',
     string: true,
     describe:
-      "Restricts browser's network access by blocking specified URL patterns (uses https://urlpattern.spec.whatwg.org/). Silently detaches from targets with blocked URLs upon connection, and blocks runtime requests (including navigations and subresources). Accepts an array of patterns. A pattern that uses a regexp group in any component (for example `(127\\.\\d+\\.\\d+\\.\\d+)` in the hostname) is rejected, because it is not enforced on redirects or subresources; use an exact value or a `*`/`:name` wildcard instead.",
+      "Restricts browser's network access by blocking specified URL patterns (uses https://urlpattern.spec.whatwg.org/). Silently detaches from targets with blocked URLs upon connection, and blocks runtime requests (including navigations and subresources). Accepts an array of patterns. A pattern that uses a regexp group or a named group (`:name`) in any component (for example `(127\\.\\d+\\.\\d+\\.\\d+)` in the hostname or `*://127.0.0.1::port/*`) is rejected, because it is not enforced on redirects or subresources; use an exact value or a `*` wildcard instead.",
     coerce: (arg: string[] | undefined) => {
       if (arg === undefined || arg.length === 0) {
         return undefined;
       }
       const pattern = findUnenforceablePattern(arg);
       if (pattern) {
         throw new Error(
-          `Invalid --blockedUrlPattern "${pattern}": a regexp group is not enforced on redirects or subresources. Use an exact value or a "*"/":name" wildcard instead.`,
+          `Invalid --blockedUrlPattern "${pattern}": a regexp group or a ":name" named group is not enforced on redirects or subresources. Use an exact value or a "*" wildcard instead.`,
         );
       }
       return arg;
@@ -57,7 +57,7 @@ export const puppeteerOptions = {
     type: 'array',
     string: true,
     describe:
-      "Restricts browser's network access by allowing only specified URL patterns (uses https://urlpattern.spec.whatwg.org/). Requires Chrome 149+. Silently detaches from targets with unallowed URLs upon connection, and blocks runtime requests (including navigations and subresources). Accepts an array of patterns. A pattern that uses a regexp group in any component (for example `(127\\.\\d+\\.\\d+\\.\\d+)` in the hostname) is rejected, because it is not enforced on redirects or subresources; use an exact value or a `*`/`:name` wildcard instead.",
+      "Restricts browser's network access by allowing only specified URL patterns (uses https://urlpattern.spec.whatwg.org/). Requires Chrome 149+. Silently detaches from targets with unallowed URLs upon connection, and blocks runtime requests (including navigations and subresources). Accepts an array of patterns. A pattern that uses a regexp group or a named group (`:name`) in any component (for example `(127\\.\\d+\\.\\d+\\.\\d+)` in the hostname or `*://127.0.0.1::port/*`) is rejected, because it is not enforced on redirects or subresources; use an exact value or a `*` wildcard instead.",
     coerce: (arg: string[] | undefined) => {
       if (arg === undefined) {
         return undefined;
@@ -70,7 +70,7 @@ export const puppeteerOptions = {
       const pattern = findUnenforceablePattern(arg);
       if (pattern) {
         throw new Error(
-          `Invalid --allowedUrlPattern "${pattern}": a regexp group is not enforced on redirects or subresources. Use an exact value or a "*"/":name" wildcard instead.`,
+          `Invalid --allowedUrlPattern "${pattern}": a regexp group or a ":name" named group is not enforced on redirects or subresources. Use an exact value or a "*" wildcard instead.`,
         );
       }
       return arg;
```

**File**: `src/utils/url.ts` (modified, +25/-10)
```diff
@@ -114,18 +114,20 @@ export function isAllowedUrl(
 const DISALLOWED_PROTOCOLS = new Set(['javascript:', 'data:', 'vbscript:']);
 
 /**
- * Finds the first pattern that uses a URLPattern regexp group (for example
- * `(127\.\d+\.\d+\.\d+)`) in any component -- protocol, username, password,
- * hostname, port, pathname, search, or hash. Chromium's
- * `SimpleUrlPatternMatcher::Component::Create` rejects any component whose
- * `HasRegexGroups()` is true and silently drops the rule, so
- * `Network.emulateNetworkConditionsByRule` does not enforce these patterns
- * on redirects or subresources, unlike the initial navigation check. A plain
- * wildcard (`*`) or named group (`:name`) has no regexp group and is
- * unaffected.
+ * Checks whether a compiled URLPattern component contains an unescaped `:`
+ * (which always represents a `:name` group in URLPattern syntax).
+ */
+function hasNamedGroup(component: string): boolean {
+  return component.replaceAll('\\\\', '').replaceAll('\\:', '').includes(':');
+}
+
+/**
+ * Finds the first pattern that Chrome can't enforce on redirects or subresources:
+ * - Any pattern containing a regexp group (for example `(foo|bar)`).
+ * - Any pattern containing a named group (`:name`, for example `*://127.0.0.1::port/*`).
  *
  * @param patterns The `--blockedUrlPattern`/`--allowedUrlPattern` values to check.
- * @returns The first unenforceable pattern, or undefined if all are safe.
+ * @returns The first unenforceable pattern, or undefined if all are valid.
  * @throws Error if a pattern's syntax is invalid (via `new URLPattern`).
  */
 export function findUnenforceablePattern(
@@ -136,6 +138,19 @@ export function findUnenforceablePattern(
     if (parsed.hasRegExpGroups) {
       return raw;
     }
+    const components = [
+      parsed.protocol,
+      parsed.username,
+      parsed.password,
+      parsed.hostname,
+      parsed.port,
+      parsed.pathname,
+      parsed.search,
+      parsed.hash,
+    ];
+    if (components.some(hasNamedGroup)) {
+      return raw;
+    }
   }
   return undefined;
 }
```

**File**: `tests/cli.test.ts` (modified, +25/-13)
```diff
@@ -499,48 +499,60 @@ describe('cli args parsing', () => {
     ]);
   });
 
-  it('rejects a blocked-url-pattern with a regexp group', async () => {
+  it('rejects url-pattern with a regexp group or named group', async () => {
     assert.throws(
       () =>
         parseConfig([
-          String.raw`--blocked-url-pattern=*://(127\.\d+\.\d+\.\d+):*/*`,
+          String.raw`--blockedUrlPattern=*://(127\.\d+\.\d+\.\d+):*/*`,
         ]),
-      /Invalid --blockedUrlPattern .*a regexp group is not enforced/,
+      /Invalid --blockedUrlPattern .*is not enforced/,
     );
 
     assert.throws(
       () =>
         parseConfig([
-          '--blocked-url-pattern=https://a.com/*',
-          String.raw`--blocked-url-pattern=*://example.com/(foo|bar)`,
+          String.raw`--allowedUrlPattern=*://(127\.\d+\.\d+\.\d+):*/*`,
         ]),
-      /Invalid --blockedUrlPattern .*a regexp group is not enforced/,
+      /Invalid --allowedUrlPattern .*is not enforced/,
+    );
+
+    assert.throws(
+      () => parseConfig(['--blockedUrlPattern=*://127.0.0.1::port/secret']),
+      /Invalid --blockedUrlPattern .*is not enforced/,
+    );
+
+    assert.throws(
+      () => parseConfig(['--allowedUrlPattern=*://127.0.0.1::port/secret']),
+      /Invalid --allowedUrlPattern .*is not enforced/,
     );
   });
 
-  it('rejects an allowed-url-pattern with a regexp group', async () => {
+  it('rejects when any pattern in multiple url patterns is unenforceable', async () => {
     assert.throws(
       () =>
         parseConfig([
-          String.raw`--allowed-url-pattern=*://(127\.\d+\.\d+\.\d+):*/*`,
+          '--blocked-url-pattern=https://a.com/*',
+          String.raw`--blocked-url-pattern=*://example.com/(foo|bar)`,
         ]),
-      /Invalid --allowedUrlPattern .*a regexp group is not enforced/,
+      /Invalid --blockedUrlPattern .*is not enforced/,
     );
-
     assert.throws(
       () =>
         parseConfig([
           '--allowed-url-pattern=https://a.com/*',
-          String.raw`--allowed-url-pattern=(http|https)://example.com/*`,
+          String.raw`--allowed-url-pattern=*://example.com/(foo|bar)`,
         ]),
-      /Invalid --allowedUrlPattern .*a regexp group is not enforced/,
+      /Invalid --allowedUrlPattern .*is not enforced/,
     );
   });
 
-  it('rejects a blocked-url-pattern with invalid syntax', async () => {
+  it('rejects url-pattern with invalid syntax', async () => {
     assert.throws(() =>
       parseConfig(['--blocked-url-pattern=*://example.com/(unterminated']),
     );
+    assert.throws(() =>
+      parseConfig(['--allowed-url-pattern=*://example.com/(unterminated']),
+    );
   });
 
   it('strips an empty blocked-url-pattern', async () => {
```

**File**: `tests/utils/url.test.ts` (modified, +43/-41)
```diff
@@ -566,11 +566,14 @@ describe('isAllowedUrl', () => {
 });
 
 describe('findUnenforceablePattern', () => {
-  it('flags a hostname regexp group', () => {
-    assert.strictEqual(
-      findUnenforceablePattern([String.raw`*://(127\.\d+\.\d+\.\d+):*/*`]),
+  it('flags a regexp group', () => {
+    for (const pattern of [
       String.raw`*://(127\.\d+\.\d+\.\d+):*/*`,
-    );
+      '*://example.com/(foo|bar)',
+      '(http|https)://example.com/*',
+    ]) {
+      assert.strictEqual(findUnenforceablePattern([pattern]), pattern);
+    }
   });
 
   it('returns the first offending pattern among several', () => {
@@ -584,56 +587,55 @@ describe('findUnenforceablePattern', () => {
     );
   });
 
-  it('allows an exact hostname', () => {
+  it('allows plain wildcard patterns', () => {
     assert.strictEqual(
-      findUnenforceablePattern(['*://127.0.0.1:*/*']),
+      findUnenforceablePattern([
+        '*://127.0.0.1:*/*',
+        '*://*.example.com/*',
+        'https://127.0.0.1:8080/secret',
+      ]),
       undefined,
     );
   });
 
-  it('allows a wildcard hostname', () => {
-    assert.strictEqual(
-      findUnenforceablePattern(['*://*.example.com/*']),
-      undefined,
-    );
+  it('flags a named group in any component', () => {
+    for (const pattern of [
+      '*://127.0.0.1::port/secret',
+      '*://127.0.0.1:{:port}/secret',
+      ':proto://example.com/*',
+      '*://:user@example.com/*',
+      '*://user::pass@example.com/*',
+      '*://:sub.example.com/*',
+      '*://{:sub}.example.com/*',
+      '*://127.0.0.:oct:*/blocked/:page',
+      '*://example.com/:path',
+      '*://example.com/{:path}',
+      '*://example.com/path?:query',
+      '*://example.com/path?token=:secret',
+      '*://example.com/*#:hash',
+    ]) {
+      assert.strictEqual(findUnenforceablePattern([pattern]), pattern);
+    }
   });
 
-  it('allows a named group hostname', () => {
+  it('allows escaped colons unless an unescaped named group is also present', () => {
     assert.strictEqual(
-      findUnenforceablePattern(['*://:sub.example.com/*']),
+      findUnenforceablePattern([
+        String.raw`http://[\:\:1]:8080/*`,
+        String.raw`*://example.com/path?foo=a\:b#bar\:c`,
+        String.raw`*://example.com/path?foo=a\\\:b#bar\\\:c`,
+      ]),
       undefined,
     );
-  });
-
-  it('flags a regexp group in the pathname', () => {
     assert.strictEqual(
-      findUnenforceablePattern(['*://example.com/(foo|bar)']),
-      '*://example.com/(foo|bar)',
-    );
-  });
-
-  it('flags a regexp group in the protocol', () => {
-    assert.strictEqual(
-      findUnenforceablePattern(['(http|https)://example.com/*']),
-      '(http|https)://example.com/*',
-    );
-  });
-
-  it('flags a regexp group in the port', () => {
-    assert.strictEqual(
-      findUnenforceablePattern(['*://example.com:(80|443)/*']),
-      '*://example.com:(80|443)/*',
-    );
-  });
-
-  it('flags a regexp group in the search or hash', () => {
-    assert.strictEqual(
-      findUnenforceablePattern(['*://example.com/*?(foo|bar)']),
-      '*://example.com/*?(foo|bar)',
+      findUnenforceablePattern([
+        String.raw`*://example.com/path?foo=a\:b&bar=:baz`,
+      ]),
+      String.raw`*://example.com/path?foo=a\:b&bar=:baz`,
     );
     assert.strictEqual(
-      findUnenforceablePattern(['*://example.com/*#(foo|bar)']),
-      '*://example.com/*#(foo|bar)',
+      findUnenforceablePattern([String.raw`*://example.com/path?foo\\:bar`]),
+      String.raw`*://example.com/path?foo\\:bar`,
     );
   });
 
```

---

### Incident Patch 9: `04195d1d` (2026-09-30)
**Commit Message**: fix: avoid runtime title fetches (#2883)

Closes https://github.com/ChromeDevTools/chrome-devtools-mcp/pull/2775

I think runtime fetches are not worth the complication. Instead we
should be able to rely on the CDP title state to differentiate targets.

**File**: `src/McpPage.ts` (modified, +4/-23)
```diff
@@ -215,29 +215,10 @@ export class McpPage implements ContextPage {
     return this.#pptrPage ? this.#pptrPage.url() : this.target.url();
   }
 
-  async getTitle(): Promise<string> {
-    if (this.#pptrPage) {
-      return Promise.race([
-        this.#pptrPage.title().catch(() => ''),
-        new Promise<string>(resolve => setTimeout(() => resolve(''), 1000)),
-      ]);
-    }
-    if (
-      '_getTargetInfo' in this.target &&
-      typeof this.target._getTargetInfo === 'function'
-    ) {
-      const info = this.target._getTargetInfo();
-      if (
-        info &&
-        typeof info === 'object' &&
-        'title' in info &&
-        typeof info.title === 'string' &&
-        info.title !== this.target.url()
-      ) {
-        return info.title;
-      }
-    }
-    return '';
+  getTitle(): string {
+    // @ts-expect-error internal types
+    const info = this.target._getTargetInfo();
+    return info.title !== this.target.url() ? info.title : '';
   }
 
   isClosed(): boolean {
```

**File**: `src/McpResponse.ts` (modified, +2/-2)
```diff
@@ -1029,7 +1029,7 @@ Call ${handleDialog(this.#args).name} to handle it before continuing.`);
           const contextLabel = isolatedContextName
             ? ` isolatedContext=${isolatedContextName}`
             : '';
-          const title = await mcpPage.getTitle();
+          const title = mcpPage.getTitle();
           const pageLabel = title
             ? `${truncateTitle(title)} (${mcpPage.url()})`
             : mcpPage.url();
@@ -1051,7 +1051,7 @@ Call ${handleDialog(this.#args).name} to handle it before continuing.`);
             const contextLabel = isolatedContextName
               ? ` isolatedContext=${isolatedContextName}`
               : '';
-            const title = await mcpPage.getTitle();
+            const title = mcpPage.getTitle();
             const pageLabel = title
               ? `${truncateTitle(title)} (${mcpPage.url()})`
               : mcpPage.url();
```

**File**: `tests/McpPage.test.ts` (modified, +3/-1)
```diff
@@ -324,12 +324,14 @@ describe('McpPage', () => {
       sinon.assert.notCalled(target.asPage);
       assert.throws(() => mcpPage.pptrPage, /not initialized/);
       assert.strictEqual(mcpPage.url(), 'https://target-only.example.com');
-      assert.strictEqual(await mcpPage.getTitle(), 'Target Title');
+      assert.strictEqual(mcpPage.getTitle(), 'Target Title');
 
       await mcpPage.init();
 
       sinon.assert.calledOnce(target.page);
       assert.strictEqual(mcpPage.pptrPage, pptrPage);
+      assert.strictEqual(mcpPage.getTitle(), 'Target Title');
+      sinon.assert.notCalled(pptrPage.title);
     });
 
     it('falls back to target.asPage() when target.page() returns null', async () => {
```

**File**: `tests/McpResponse.test.js.snapshot` (modified, +8/-8)
```diff
@@ -1401,7 +1401,7 @@ exports[`third-party developer tools > lists third-party developer tools 2`] = `
 
 exports[`webmcp > includes webmcp tools in list_pages response 1`] = `
 ## Pages
-1: My test page (about:blank) [selected]
+1: about:blank [selected]
 ## WebMCP tools
 name="test_tool", description="A test tool", inputSchema={"type":"object","properties":{},"required":[]}, annotations=undefined
 `;
@@ -1412,7 +1412,7 @@ exports[`webmcp > includes webmcp tools in list_pages response 2`] = `
     {
       "id": 1,
       "url": "about:blank",
-      "title": "My test page",
+      "title": "",
       "selected": true
     }
   ],
@@ -1433,7 +1433,7 @@ exports[`webmcp > includes webmcp tools in list_pages response 2`] = `
 exports[`webmcp > includes webmcp tools in navigate_page response 1`] = `
 Successfully navigated to about:blank.
 ## Pages
-1: My test page (about:blank) [selected]
+1: about:blank [selected]
 ## WebMCP tools
 name="test_tool", description="A test tool", inputSchema={"type":"object","properties":{},"required":[]}, annotations=undefined
 `;
@@ -1445,7 +1445,7 @@ exports[`webmcp > includes webmcp tools in navigate_page response 2`] = `
     {
       "id": 1,
       "url": "about:blank",
-      "title": "My test page",
+      "title": "",
       "selected": true
     }
   ],
@@ -1465,7 +1465,7 @@ exports[`webmcp > includes webmcp tools in navigate_page response 2`] = `
 
 exports[`webmcp > includes webmcp tools in select_page response 1`] = `
 ## Pages
-1: My test page (about:blank) [selected]
+1: about:blank [selected]
 ## WebMCP tools
 name="test_tool", description="A test tool", inputSchema={"type":"object","properties":{},"required":[]}, annotations=undefined
 `;
@@ -1476,7 +1476,7 @@ exports[`webmcp > includes webmcp tools in select_page response 2`] = `
     {
       "id": 1,
       "url": "about:blank",
-      "title": "My test page",
+      "title": "",
       "selected": true
     }
   ],
@@ -1497,7 +1497,7 @@ exports[`webmcp > includes webmcp tools in select_page response 2`] = `
 exports[`webmcp > list no webmcp tools if experimentalWebmcp is false 1`] = `
 Successfully navigated to about:blank.
 ## Pages
-1: My test page (about:blank) [selected]
+1: about:blank [selected]
 `;
 
 exports[`webmcp > list no webmcp tools if experimentalWebmcp is false 2`] = `
@@ -1507,7 +1507,7 @@ exports[`webmcp > list no webmcp tools if experimentalWebmcp is false 2`] = `
     {
       "id": 1,
       "url": "about:blank",
-      "title": "My test page",
+      "title": "",
       "selected": true
     }
   ]
```

**File**: `tests/mocks.ts` (modified, +1/-1)
```diff
@@ -280,7 +280,7 @@ export function createMockMcpPage(
     await pptrPage.close({runBeforeUnload: false});
   });
   page.url.callsFake(() => pptrPage.url());
-  page.getTitle.callsFake(async () => (await pptrPage.title()) ?? '');
+  page.getTitle.returns('');
   page.isClosed.callsFake(() => Boolean(pptrPage.isClosed()));
   page.waitForEventsAfterAction.callsFake(async action => {
     await action(new AbortController().signal);
```

**File**: `tests/tools/pages.test.js.snapshot` (modified, +1/-1)
```diff
@@ -25,7 +25,7 @@ exports[`pages > list_pages > list pages for side panels with --category-extensi
 ## Pages
 1: about:blank
 ## Extension Pages
-2: Side Panel (chrome-extension://<extension-id>/sidepanel.html) [selected]
+2: chrome-extension://<extension-id>/sidepanel.html [selected]
 ## Extension Service Workers
 sw-1: chrome-extension://<extension-id>/sw.js
 `;
```

---

### Incident Patch 10: `871a37e4` (2026-09-30)
**Commit Message**: fix(daemon): keep fallback socket in private runtime dir (#2766)

## Summary

- keep the non-XDG Unix daemon socket inside the daemon's existing
private runtime directory
- reject symlinked runtime directories before trusting ownership or
permissions
- preserve the current XDG and Windows paths
- add regression coverage for both fallback placement and
runtime-directory symlink tampering

## Why

The daemon already creates and validates getRuntimeHome(sessionId) as a
user-owned, non-group/world-writable directory. However, when
XDG_RUNTIME_DIR is unset, getSocketPath() currently binds the Unix
socket directly in /tmp.

Node's readableAll: false / writableAll: false do not force an
owner-only Unix socket. The socket mode follows the daemon's umask. In
testing:

- 0022 -> 0755
- 0002 -> 0775
- 0000 -> 0777

Because the daemon protocol does not perform a separate
peer-authentication handshake, a socket writable by another local
account becomes a cross-user IPC boundary.

Putting server.sock under the already-validated private runtime
directory makes the parent directory the access-control boundary and
avoids relying on socket mode.

The runtime directory itself is predictable in the /t

**File**: `src/daemon/client.ts` (modified, +12/-0)
```diff
@@ -7,6 +7,7 @@
 import {spawn} from 'node:child_process';
 import fs from 'node:fs';
 import net from 'node:net';
+import path from 'node:path';
 
 import type {CallToolResult} from '../third_party/index.js';
 import {PipeTransport} from '../third_party/index.js';
@@ -120,6 +121,17 @@ export async function startDaemon(mcpArgs: string[] = [], sessionId: string) {
   const pidFilePath = getPidFilePath(sessionId);
 
   if (fs.existsSync(pidFilePath)) {
+    if (process.platform !== 'win32') {
+      const pidDir = path.dirname(pidFilePath);
+      if (
+        fs.lstatSync(pidDir).isSymbolicLink() ||
+        fs.lstatSync(pidFilePath).isSymbolicLink()
+      ) {
+        throw new Error(
+          `Refusing to remove daemon PID file through a symbolic link: ${pidFilePath}`,
+        );
+      }
+    }
     fs.unlinkSync(pidFilePath);
   }
 
```

**File**: `src/daemon/daemon.ts` (modified, +11/-3)
```diff
@@ -51,17 +51,25 @@ try {
   if (os.platform() !== 'win32') {
     // POSIX specific checks
     try {
-      const stats = fs.statSync(pidDir);
+      const stats = fs.lstatSync(pidDir);
 
-      // 1. Check Ownership: Ensure the directory is owned by the current user.
+      // 1. Reject symlinked runtime directories before checking ownership.
+      if (stats.isSymbolicLink()) {
+        console.error(
+          `[MCP Daemon] Critical error: PID directory ${pidDir} must not be a symbolic link. Possible tampering.`,
+        );
+        process.exit(1);
+      }
+
+      // 2. Check Ownership: Ensure the directory is owned by the current user.
       if (stats.uid !== currentUserUid) {
         console.error(
           `[MCP Daemon] Critical error: PID directory ${pidDir} is not owned by the current user (Expected: ${currentUserUid}, Found: ${stats.uid}). Possible tampering.`,
         );
         process.exit(1);
       }
 
-      // 2. Check Permissions: Ensure the directory is not group or world-writable.
+      // 3. Check Permissions: Ensure the directory is not group or world-writable.
       // Mode is a number, e.g., 0o700. We check if bits for group/world write are set.
       const mode = stats.mode;
       if (mode & constants.S_IWGRP || mode & constants.S_IWOTH) {
```

**File**: `src/daemon/utils.ts` (modified, +1/-10)
```diff
@@ -29,7 +29,6 @@ export function assertValidSessionId(sessionId: string): void {
 // Using these paths due to strict limits on the POSIX socket path length.
 export function getSocketPath(sessionId: string): string {
   assertValidSessionId(sessionId);
-  const uid = os.userInfo().uid;
   const username = os.userInfo().username;
   const suffix = sessionId ? `-${sessionId}` : '';
   const appName = APP_NAME + suffix;
@@ -41,15 +40,7 @@ export function getSocketPath(sessionId: string): string {
     return path.join('\\\\.\\pipe', `${appName}-${username}`, 'server.sock');
   }
 
-  // 1. Try XDG_RUNTIME_DIR (Linux standard, sometimes macOS)
-  if (process.env.XDG_RUNTIME_DIR) {
-    return path.join(process.env.XDG_RUNTIME_DIR, appName, 'server.sock');
-  }
-
-  // 2. macOS/Unix Fallback: Use /tmp/
-  // We use /tmp/ because it is much shorter than ~/Library/Application Support/
-  // and keeps us well under the 104-character limit.
-  return path.join('/tmp', `${appName}-${uid}.sock`);
+  return path.join(getRuntimeHome(sessionId), 'server.sock');
 }
 
 export function getRuntimeHome(sessionId: string): string {
```

**File**: `tests/daemon/symlink.test.ts` (modified, +96/-0)
```diff
@@ -12,6 +12,7 @@ import path from 'node:path';
 import process from 'node:process';
 import {describe, it, afterEach, beforeEach} from 'node:test';
 
+import {startDaemon} from '../../src/daemon/client.js';
 import {
   DAEMON_SCRIPT_PATH,
   getPidFilePath,
@@ -89,6 +90,101 @@ describe('daemon security checks', () => {
     }
   });
 
+  it('startDaemon should reject a symlinked runtime directory before unlinking a stale PID file', async () => {
+    if (IS_WINDOWS) {
+      return;
+    }
+    const pidFilePath = getPidFilePath(sessionId);
+    const pidDir = path.dirname(pidFilePath);
+    const targetDir = path.join(
+      path.dirname(pidDir),
+      `chrome-devtools-mcp-client-symlink-target-${sessionId}`,
+    );
+    const targetPidFile = path.join(targetDir, 'daemon.pid');
+
+    try {
+      fs.mkdirSync(targetDir, {recursive: true, mode: 0o700});
+      fs.writeFileSync(targetPidFile, 'original content', 'utf-8');
+      fs.symlinkSync(targetDir, pidDir);
+
+      await assert.rejects(startDaemon([], sessionId), /symbolic link/);
+      assert.strictEqual(
+        fs.readFileSync(targetPidFile, 'utf-8'),
+        'original content',
+      );
+    } finally {
+      try {
+        fs.unlinkSync(pidDir);
+      } catch {
+        // ignore
+      }
+      try {
+        fs.unlinkSync(targetPidFile);
+      } catch {
+        // ignore
+      }
+      try {
+        fs.rmdirSync(targetDir);
+      } catch {
+        // ignore
+      }
+    }
+  });
+
+  it('should reject a symlinked runtime directory', async () => {
+    if (IS_WINDOWS) {
+      return;
+    }
+    const pidFilePath = getPidFilePath(sessionId);
+    const pidDir = path.dirname(pidFilePath);
+    const targetDir = path.join(
+      path.dirname(pidDir),
+      `chrome-devtools-mcp-symlink-target-${sessionId}`,
+    );
+    const targetPidFile = path.join(targetDir, 'daemon.pid');
+
+    try {
+      fs.mkdirSync(targetDir, {recursive: true, mode: 0o700});
+      fs.writeFileSync(targetPidFile, 'original content', 'utf-8');
+      fs.symlinkSync(targetDir, pidDir);
+
+      const child = spawn(process.execPath, [DAEMON_SCRIPT_PATH], {
+        env: {
+          ...process.env,
+          CHROME_DEVTOOLS_MCP_SESSION_ID: sessionId,
+        },
+      });
+
+      const exitCode = await new Promise<number | null>(resolve => {
+        child.on('exit', code => {
+          resolve(code);
+        });
+      });
+
+      assert.strictEqual(exitCode, 1);
+      assert.strictEqual(
+        fs.readFileSync(targetPidFile, 'utf-8'),
+        'original content',
+      );
+    } finally {
+      try {
+        fs.unlinkSync(pidDir);
+      } catch {
+        // ignore
+      }
+      try {
+        fs.unlinkSync(targetPidFile);
+      } catch {
+        // ignore
+      }
+      try {
+        fs.rmdirSync(targetDir);
+      } catch {
+        // ignore
+      }
+    }
+  });
+
   it('should fail if directory has insecure permissions (group/world writable)', async () => {
     if (IS_WINDOWS) {
       return;
```

**File**: `tests/daemon/utils.test.ts` (modified, +6/-4)
```diff
@@ -223,15 +223,17 @@ describe('getSocketPath', () => {
   });
 
   it(
-    'falls back to a /tmp socket with the uid when XDG_RUNTIME_DIR is unset',
+    'falls back to the private runtime directory when XDG_RUNTIME_DIR is unset',
     {skip: IS_WINDOWS},
     () => {
       delete process.env['XDG_RUNTIME_DIR'];
-      const uid = os.userInfo().uid;
-      assert.strictEqual(getSocketPath(''), `/tmp/${APP_NAME}-${uid}.sock`);
+      assert.strictEqual(
+        getSocketPath(''),
+        path.join(getRuntimeHome(''), 'server.sock'),
+      );
       assert.strictEqual(
         getSocketPath(SESSION_ID),
-        `/tmp/${APP_NAME}-${SESSION_ID}-${uid}.sock`,
+        path.join(getRuntimeHome(SESSION_ID), 'server.sock'),
       );
     },
   );
```

---

### Incident Patch 11: `d55bb9fe` (2026-09-30)
**Commit Message**: chore: resolve DevTools comment nodes to snapshot uids (#2860)

DevTools reports comment targets as node: {backendNodeId, targetId}, but
the hand-rolled bridge types expected a top-level backendNodeId, so
comments never received a uid.

- Use DevTools.CD4ABridge types for comment threads, reveal targets and
the bridge (events stay local until mcp.ts exports them as values).
- Read node.backendNodeId in CommentFormatter and send node targets in
reveal_in_devtools.
- Regenerate the text snapshot in resolveBackendNodeId when the node is
missing, falling back to a verbose snapshot for generic elements.

**File**: `src/McpPage.ts` (modified, +11/-5)
```diff
@@ -841,12 +841,18 @@ export class McpPage implements ContextPage {
   async resolveBackendNodeId(
     backendNodeId: number,
   ): Promise<string | undefined> {
-    if (!this.textSnapshot) {
-      this.textSnapshot = await TextSnapshot.create(this);
+    let id = this.textSnapshot?.resolveCdpElementId(backendNodeId);
+    if (id) {
+      return id;
     }
-    let id = this.textSnapshot.resolveCdpElementId(backendNodeId);
-    if (!id) {
-      this.textSnapshot = await TextSnapshot.create(this);
+    this.textSnapshot = await TextSnapshot.create(this, {
+      verbose: this.textSnapshot?.verbose ?? false,
+    });
+    id = this.textSnapshot.resolveCdpElementId(backendNodeId);
+    if (!id && !this.textSnapshot.verbose) {
+      this.textSnapshot = await TextSnapshot.create(this, {
+        verbose: true,
+      });
       id = this.textSnapshot.resolveCdpElementId(backendNodeId);
     }
     return id;
```

**File**: `src/devtools/DevToolsCommentBridge.ts` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ export class DevToolsCommentBridge {
       try {
         const result = page.evaluate(() => {
           if (window.__onDevToolsCommentListener) {
-            window.universe?.cd4aBridge?.removeEventListener?.(
+            window.universe?.cd4aBridge?.removeEventListener(
               'CommentThreadsChanged',
               window.__onDevToolsCommentListener,
             );
```

**File**: `src/formatters/CommentFormatter.ts` (modified, +2/-2)
```diff
@@ -60,8 +60,8 @@ export class CommentFormatter {
     for (const thread of threads) {
       let elementUid: string | undefined;
       const resolveBackendNodeId = options?.resolveBackendNodeId;
-      if (thread.backendNodeId !== undefined && resolveBackendNodeId) {
-        elementUid = await resolveBackendNodeId(thread.backendNodeId);
+      if (thread.node?.backendNodeId !== undefined && resolveBackendNodeId) {
+        elementUid = await resolveBackendNodeId(thread.node.backendNodeId);
       }
 
       let reqid: number | undefined;
```

**File**: `src/tools/comments.ts` (modified, +11/-9)
```diff
@@ -6,17 +6,12 @@
 
 import {zod} from '../third_party/index.js';
 
-import type {
-  CD4ACommentThread,
-  CD4AEditorAnchorSignature,
-  CD4ARevealTarget,
-} from '../types.js';
+import type {CD4ACommentThread, CD4ARevealTarget} from '../types.js';
 
 import {ToolCategory} from './categories.js';
 import {definePageTool} from './ToolDefinition.js';
 
 export type CommentThreadPayload = CD4ACommentThread;
-export type CommentEditorPayload = CD4AEditorAnchorSignature;
 export type RevealTargetPayload = CD4ARevealTarget;
 
 export const openDevtools = definePageTool(() => ({
@@ -198,12 +193,19 @@ export const revealInDevtools = definePageTool(() => ({
       }
     }
 
+    const revealTarget: CD4ARevealTarget = {
+      networkRequestId,
+      ...(backendNodeId !== undefined
+        ? {node: {backendNodeId, targetId: targetId ?? ''}}
+        : {}),
+    };
+
     await devtoolsPage.evaluate(
-      async (panel: string | undefined, target: CD4ARevealTarget) => {
+      async (panel: string, target: CD4ARevealTarget) => {
         await window.universe?.cd4aBridge?.reveal(panel, target);
       },
-      panelName,
-      {backendNodeId, targetId, networkRequestId},
+      panelName ?? '',
+      revealTarget,
     );
 
     let targetDesc = '';
```

**File**: `src/types.ts` (modified, +21/-38)
```diff
@@ -4,7 +4,12 @@
  * SPDX-License-Identifier: Apache-2.0
  */
 
-import type {SerializedAXNode, Viewport, Target} from './third_party/index.js';
+import type {
+  SerializedAXNode,
+  Viewport,
+  Target,
+  DevTools,
+} from './third_party/index.js';
 
 export interface ExtensionServiceWorker {
   url: string;
@@ -41,51 +46,29 @@ export interface PaginationOptions {
   pageIdx?: number;
 }
 
-export interface CD4AEditorAnchorSignature {
-  /** 1-based line number for CodeMirror text editor anchors */
-  lineNumber: number;
-  /** File path associated with the editor */
-  filePath?: string;
-}
-
-export interface CD4ACommentThread {
-  id: string;
-  text: string;
-  networkRequestId?: string;
-  backendNodeId?: number;
-  editor?: CD4AEditorAnchorSignature;
-}
-
-export interface CD4ARevealTarget {
-  networkRequestId?: string;
-  backendNodeId?: number;
-  targetId?: string;
-}
+export type CD4ACommentThread = DevTools.CD4ABridge.CommentThread;
+export type CD4ARevealTarget = DevTools.CD4ABridge.RevealTarget;
 
 export enum CD4ABridgeEvents {
   COMMENT_THREADS_CHANGED = 'CommentThreadsChanged',
 }
 
-export interface CD4ABridge {
-  dispose?(): void;
-  setAgentAttached(value: boolean): void;
-  getCommentThreads(): CD4ACommentThread[];
-  takeComments(): CD4ACommentThread[];
-  resolveCommentThread(threadId: string, replyText?: string): boolean;
-  reveal(panelName?: string, target?: CD4ARevealTarget): Promise<void>;
-  addEventListener(
-    event: CD4ABridgeEvents | 'CommentThreadsChanged' | string,
-    listener: () => void,
-  ): void;
-  removeEventListener?(
-    event: CD4ABridgeEvents | 'CommentThreadsChanged' | string,
-    listener: () => void,
-  ): void;
-}
+/**
+ * Functions evaluated in the DevTools page cannot reference `CD4ABridgeEvents`
+ * at runtime, so they pass the string value instead.
+ */
+export type CD4ABridgeEventName = `${CD4ABridgeEvents}`;
+
+export type CD4ABridge = Omit<
+  DevTools.CD4ABridge.CD4ABridge,
+  'addEventListener' | 'removeEventListener'
+> & {
+  addEventListener(event: CD4ABridgeEventName, listener: () => void): void;
+  removeEventListener(event: CD4ABridgeEventName, listener: () => void): void;
+};
 
 export type CommentThread = CD4ACommentThread;
 export type RevealTarget = CD4ARevealTarget;
-export type EditorAnchorSignature = CD4AEditorAnchorSignature;
 
 declare global {
   interface Window {
```

**File**: `tests/McpPage.test.ts` (modified, +111/-0)
```diff
@@ -898,6 +898,117 @@ describe('McpPage', () => {
     });
   });
 
+  describe('resolveBackendNodeId()', () => {
+    afterEach(() => {
+      sinon.restore();
+    });
+
+    function createSnapshotWithNodes(
+      nodes: Array<{id: string; backendNodeId?: number}>,
+      verbose = false,
+    ): TextSnapshot {
+      const idToNode = new Map<string, TextSnapshotNode>();
+      const children: TextSnapshotNode[] = [];
+      for (const n of nodes) {
+        const node: TextSnapshotNode = {
+          id: n.id,
+          role: 'generic',
+          backendNodeId: n.backendNodeId,
+          children: [],
+          elementHandle: async () => null,
+        };
+        idToNode.set(n.id, node);
+        children.push(node);
+      }
+      const rootNode: TextSnapshotNode = {
+        id: '1_0',
+        role: 'root',
+        children,
+        elementHandle: async () => null,
+      };
+      return new TextSnapshot({
+        root: rootNode,
+        idToNode,
+        snapshotId: '1',
+        hasSelectedElement: false,
+        verbose,
+      });
+    }
+
+    it('returns uid from existing textSnapshot without regenerating', async () => {
+      const {mcpPage} = await createMcpPage();
+      mcpPage.textSnapshot = createSnapshotWithNodes([
+        {id: '1_1', backendNodeId: 42},
+      ]);
+      const createStub = sinon.stub(TextSnapshot, 'create');
+
+      const uid = await mcpPage.resolveBackendNodeId(42);
+
+      assert.strictEqual(uid, '1_1');
+      sinon.assert.notCalled(createStub);
+    });
+
+    it('creates textSnapshot when textSnapshot is null', async () => {
+      const {mcpPage} = await createMcpPage();
+      const snapshot = createSnapshotWithNodes([
+        {id: '1_1', backendNodeId: 42},
+      ]);
+      const createStub = sinon.stub(TextSnapshot, 'create').resolves(snapshot);
+
+      const uid = await mcpPage.resolveBackendNodeId(42);
+
+      assert.strictEqual(uid, '1_1');
+      sinon.assert.calledOnceWithExactly(createStub, mcpPage, {verbose: false});
+      assert.strictEqual(mcpPage.textSnapshot, snapshot);
+    });
+
+    it('regenerates textSnapshot when backendNodeId is not in existing snapshot', async () => {
+      const {mcpPage} = await createMcpPage();
+      mcpPage.textSnapshot = createSnapshotWithNodes([
+        {id: '1_1', backendNodeId: 10},
+      ]);
+      const updatedSnapshot = createSnapshotWithNodes([
+        {id: '2_1', backendNodeId: 42},
+      ]);
+      const createStub = sinon
+        .stub(TextSnapshot, 'create')
+        .resolves(updatedSnapshot);
+
+      const uid = await mcpPage.resolveBackendNodeId(42);
+
+      assert.strictEqual(uid, '2_1');
+      sinon.assert.calledOnceWithExactly(createStub, mcpPage, {verbose: false});
+      assert.strictEqual(mcpPage.textSnapshot, updatedSnapshot);
+    });
+
+    it('falls back to verbose textSnapshot when backendNodeId is not in non-verbose snapshot', async () => {
+      const {mcpPage} = await createMcpPage();
+      const nonVerboseSnapshot = createSnapshotWithNodes(
+        [{id: '1_1', backendNodeId: 10}],
+        false,
+      );
+      const verboseSnapshot = createSnapshotWithNodes(
+        [{id: '2_5', backendNodeId: 30}],
+        true,
+      );
+      const createStub = sinon.stub(TextSnapshot, 'create');
+      createStub.onFirstCall().resolves(nonVerboseSnapshot);
+      createStub.onSecondCall().resolves(verboseSnapshot);
+
+      const uid = await mcpPage.resolveBackendNodeId(30);
+
+      assert.strictEqual(uid, '2_5');
+      sinon.assert.calledTwice(createStub);
+      sinon.assert.calledWithExactly(createStub.firstCall, mcpPage, {
+        verbose: false,
+      });
+      sinon.assert.calledWithExactly(createStub.secondCall, mcpPage, {
+        verbose: true,
+      });
+      assert.strictEqual(mcpPage.textSnapshot, verboseSnapshot);
+    });
+  });
+
   describe('getMatchedStylesForUid()', () => {
     const server = serverHooks();
 
```

**File**: `tests/formatters/CommentFormatter.test.ts` (modified, +8/-6)
```diff
@@ -60,12 +60,11 @@ describe('CommentFormatter', () => {
     const rawThread: CD4ACommentThread = {
       id: 'comment-1',
       text: 'Fix the color contrast here',
-      backendNodeId: 42,
-      networkRequestId: 'req-99',
-      editor: {
-        filePath: 'src/style.css',
-        lineNumber: 10,
+      node: {
+        backendNodeId: 42,
+        targetId: 'target-1',
       },
+      networkRequestId: 'req-99',
     };
 
     const resolveBackendNodeId = sinon.stub().resolves('element-uid-42');
@@ -88,7 +87,10 @@ describe('CommentFormatter', () => {
       const rawThread: CD4ACommentThread = {
         id: 'comment-2',
         text: 'Fix heading font size',
-        backendNodeId: 42,
+        node: {
+          backendNodeId: 42,
+          targetId: 'target-1',
+        },
         networkRequestId: 'req-99',
       };
 
```

**File**: `tests/tools/comments.test.ts` (modified, +4/-5)
```diff
@@ -64,12 +64,11 @@ describe('comments tools', () => {
       const mockThread: CommentThreadPayload = {
         id: 'comment-1',
         text: 'Fix the color contrast here',
-        backendNodeId: 42,
-        networkRequestId: 'req-99',
-        editor: {
-          filePath: 'src/style.css',
-          lineNumber: 10,
+        node: {
+          backendNodeId: 42,
+          targetId: 'target-1',
         },
+        networkRequestId: 'req-99',
       };
 
       bridge.getComments.resolves([mockThread]);
```

---

### Incident Patch 12: `45c1c6cc` (2026-09-29)
**Commit Message**: fix: reject unrestricted paths with an explicit workspace (#2858)

The CLI documents `--allow-unrestricted-paths` and `--workspace` as
incompatible, but currently accepts both. Reject the explicit
combination while preserving standalone flags and the CLI default.

Validation: `npm run test` (1243 passed, 2 skipped); `npm run
check-format`.

**File**: `src/config/mcp-options.ts` (modified, +1/-0)
```diff
@@ -459,6 +459,7 @@ const CONFLICTING_ARGS: Array<Array<keyof typeof mcpOptions>> = [
   ['autoConnect', 'isolated'],
   ['autoConnect', 'executablePath'],
   ['blockedUrlPattern', 'allowedUrlPattern'],
+  ['allowUnrestrictedPaths', 'filesystemRoot'],
   ['categoryPwa', 'autoConnect'],
   ['categoryPwa', 'browserUrl', 'wsEndpoint'],
   ['categoryExtensions', 'autoConnect'],
```

**File**: `tests/cli.test.ts` (modified, +77/-0)
```diff
@@ -180,6 +180,83 @@ describe('cli args parsing', () => {
       assert.strictEqual(args.allowUnrestrictedPaths, true);
     });
 
+    it('accepts an explicit unrestricted flag in CLI mode', async () => {
+      const args = parseArguments(['--viaCli', '--allow-unrestricted-paths']);
+      assert.strictEqual(args.allowUnrestrictedPaths, true);
+      assert.strictEqual(args.filesystemRoot, undefined);
+    });
+
+    it('rejects unrestricted paths with a CLI workspace', async () => {
+      assert.throws(
+        () =>
+          parseArguments([
+            '--viaCli',
+            '--allow-unrestricted-paths',
+            '--workspace=/tmp/one',
+          ]),
+        /Arguments allowUnrestrictedPaths and filesystemRoot are mutually exclusive/,
+      );
+    });
+
+    it('rejects unrestricted paths with a direct filesystem root', async () => {
+      assert.throws(
+        () =>
+          parseArguments([
+            '--allow-unrestricted-paths',
+            '--filesystem-root=/tmp/one',
+          ]),
+        /Arguments allowUnrestrictedPaths and filesystemRoot are mutually exclusive/,
+      );
+    });
+
+    it('rejects a config unrestricted flag with a CLI workspace', async () => {
+      using testConfig = createTempFile(
+        JSON.stringify({allowUnrestrictedPaths: true}),
+        'cd4a.test.config.unrestricted-workspace.json',
+      );
+      assert.throws(
+        () =>
+          parseArguments([
+            '--viaCli',
+            '--config',
+            testConfig.path,
+            '--workspace=/tmp/one',
+          ]),
+        /Arguments allowUnrestrictedPaths and filesystemRoot are mutually exclusive/,
+      );
+    });
+
+    it('rejects a config filesystem root with a CLI unrestricted flag', async () => {
+      using testConfig = createTempFile(
+        JSON.stringify({filesystemRoot: ['/tmp/one']}),
+        'cd4a.test.config.root-unrestricted.json',
+      );
+      assert.throws(
+        () =>
+          parseArguments([
+            '--config',
+            testConfig.path,
+            '--allow-unrestricted-paths',
+          ]),
+        /Arguments allowUnrestrictedPaths and filesystemRoot are mutually exclusive/,
+      );
+    });
+
+    it('lets an explicit false override config unrestricted with a workspace', async () => {
+      using testConfig = createTempFile(
+        JSON.stringify({allowUnrestrictedPaths: true}),
+        'cd4a.test.config.unrestricted-false.json',
+      );
+      const args = parseArguments([
+        '--config',
+        testConfig.path,
+        '--no-allow-unrestricted-paths',
+        '--workspace=/tmp/one',
+      ]);
+      assert.strictEqual(args.allowUnrestrictedPaths, false);
+      assert.deepStrictEqual(args.filesystemRoot, ['/tmp/one']);
+    });
+
     it('lets an explicit workspace override the CLI unrestricted default', async () => {
       const args = parseArguments(['--viaCli', '--workspace=/tmp/one']);
       assert.strictEqual(args.allowUnrestrictedPaths, false);
```

---

### Incident Patch 13: `2a7ef504` (2026-09-29)
**Commit Message**: fix: fail fast on tool calls stuck after a dead browser connection (#2699)

Root cause: when the debugged browser's CDP transport dies mid-call —
silently, without ever firing a `close`/`error`/`disconnected` event (as
opposed to a clean disconnect) — the in-flight tool call just hangs
forever waiting on a response that will never come. Because
`ToolHandler` serializes every tool call behind a single shared `Mutex`,
that one stuck call blocks all subsequent tool calls too, effectively
taking the whole MCP server down until someone manually reconnects via
`/mcp`.

Observed when an Android app being debugged over `chrome-devtools-mcp`
was reinstalled/relaunched mid-session, the MCP server's tools went
completely unavailable, even though the underlying CDP endpoint
(http://127.0.0.1:9222/json) stayed reachable the whole time. This
wasn't a startup/connection-time failure, which the existing "next-call
self-heal" logic already handles fine — it was a hang mid-call, so there
was never a clean "next call" for that self-heal to run on.

- `browser.ts`: export `forgetBrowser()` and attach a `disconnected`
listener after every successful connect/launch, so a browser Puppeteer
does detect as

**File**: `src/BrowserManager.ts` (modified, +110/-3)
```diff
@@ -23,6 +23,13 @@ export interface BrowserManagerOptions {
   logFile?: fs.WriteStream;
 }
 
+/**
+ * Identity token for an in-flight connect/launch attempt. Instances carry no
+ * data and are never inspected structurally — only ever compared by
+ * reference (`!==`) — see BrowserManager#abandonPendingAttempt().
+ */
+class BrowserAttempt {}
+
 export class BrowserManager {
   #browser?: Browser;
   #browserMode?: 'launched' | 'connected';
@@ -32,6 +39,8 @@ export class BrowserManager {
   #serverArgs: ParsedArguments;
   #options: BrowserManagerOptions;
 
+  #browserAttempt: BrowserAttempt = new BrowserAttempt();
+
   constructor(
     serverArgs: ParsedArguments,
     options: BrowserManagerOptions = {},
@@ -126,20 +135,64 @@ export class BrowserManager {
     if (this.#closingCount > 0) {
       throw new Error('Browser was closed while initializing.');
     }
+    // Captured before acquiring #mutex, not after: a caller queued here can
+    // have its own timeout fire (abandonPendingAttempt()) while it's still
+    // waiting for the lock. Capturing only after acquiring it would let such
+    // a call silently adopt the freshly-rotated token as its own baseline
+    // once the lock frees up, defeating the abandonment check entirely.
+    const attempt = this.#browserAttempt;
     using _guard = await this.#mutex.acquire();
     if (this.#closingCount > 0) {
       throw new Error('Browser was closed while initializing.');
     }
+    if (this.#browserAttempt !== attempt) {
+      // Abandoned while queued for the lock — #browser was never touched by
+      // this call, so bail immediately without #closeBrowser(), which could
+      // otherwise tear down a different, still-current attempt's browser.
+      throw new Error('Connection attempt was abandoned before it completed.');
+    }
     if (!this.#browser?.connected) {
       await this.#initBrowser();
     }
-    if (this.#closingCount > 0 || !this.#browser) {
+    if (
+      this.#closingCount > 0 ||
+      this.#browserAttempt !== attempt ||
+      !this.#browser
+    ) {
+      const reason =
+        this.#closingCount > 0
+          ? 'Browser was closed while initializing.'
+          : 'Connection attempt was abandoned before it completed.';
       await this.#closeBrowser();
-      throw new Error('Browser was closed while initializing.');
+      throw new Error(reason);
     }
     return this.#browser;
   }
 
+  /**
+   * Signals that whoever was waiting on the in-flight ensureBrowser() call
+   * has given up (e.g. a tool-call timeout). There's no way to cancel a
+   * pending connect()/launch(), so this doesn't stop it — it rotates the
+   * token to a fresh value and clears #initPromise, so a late-resolving
+   * attempt gets discarded by #ensureBrowserLocked() instead of silently
+   * installed for a caller who already walked away.
+   *
+   * Also forgets the cached #browser, if any. This only ever fires from a
+   * getContext()-level timeout, which covers both ensureBrowser() and the
+   * McpContext initialization built on it — if ensureBrowser() already
+   * resolved and it's that later step hanging (e.g. a dead CDP transport),
+   * the token rotation alone does nothing, since #browser is already
+   * cached. Safe to forget unconditionally here: the tool mutex serializes
+   * every call, so there's no concurrent caller to disrupt.
+   */
+  abandonPendingAttempt(): void {
+    this.#browserAttempt = new BrowserAttempt();
+    this.#initPromise = undefined;
+    if (this.#browser) {
+      this.forget(this.#browser);
+    }
+  }
+
   async #initBrowser(): Promise<Browser> {
     if (
       this.#serverArgs.browserUrl ||
@@ -245,7 +298,9 @@ export class BrowserManager {
       }
       this.#browserMode = 'launched';
       this.#browser = browser;
-      return browser;
+      const launched = browser;
+      launched.once('disconnected', () => this.#evictIfCurrent(launched));
+      return launched;
     } catch (error) {
       await browser?.close().catch(() => {
         // Best-effort cleanup if post-launch setup failed.
@@ -355,6 +410,7 @@ export class BrowserManager {
       logger?.('Connected Puppeteer');
       this.#browserMode = 'connected';
       this.#browser = connected;
+      connected.once('disconnected', () => this.#evictIfCurrent(connected));
       return connected;
     } catch (err) {
       throw new Error(
@@ -366,6 +422,57 @@ export class BrowserManager {
     }
   }
 
+  /**
+   * Clears the cached browser handle if it still matches `candidate`, so the
+   * next ensureBrowser() call establishes a fresh connection instead of
+   * reusing a handle that looks connected but is actually dead (e.g. its CDP
+   * transport died without ever emitting a `close`/`disconnected` event — as
+   * happens when an adb port-forward is torn down mid-call rather than
+   * closed cleanly).
+   *
+   * Also actively tears `candidate` down in the background: closes it if it
+   * was launched (so the Chrome 
```

**File**: `src/ToolHandler.ts` (modified, +111/-48)
```diff
@@ -10,7 +10,7 @@ import type {McpPage} from './McpPage.js';
 import {McpResponse} from './McpResponse.js';
 import {SlimMcpResponse} from './SlimMcpResponse.js';
 import {ClearcutLogger} from './telemetry/ClearcutLogger.js';
-import type {CallToolResult} from './third_party/index.js';
+import type {Browser, CallToolResult} from './third_party/index.js';
 import {zod} from './third_party/index.js';
 import {labels} from './tools/categories.js';
 import {categoryToFlagName} from './config/category-options.js';
@@ -25,6 +25,21 @@ import type {Mutex} from './third_party/index.js';
 import {fileURLToPath, pathToFileURL} from 'node:url';
 import {isLocalhost} from './utils/url.js';
 
+/**
+ * Upper bound on how long a single tool call may wait on the browser
+ * connection. Puppeteer normally rejects in-flight CDP calls when the
+ * underlying transport closes, but a transport that dies silently (e.g. an
+ * adb port-forward torn down mid-call, rather than closed cleanly) never
+ * fires `close`/`error`/`disconnected`, so the call would otherwise hang
+ * until an external (client-side) timeout gives up on the whole server. This
+ * bound turns that into a fast, clear error instead, and forgets the cached
+ * browser handle so the next call reconnects rather than reusing a handle
+ * that still looks connected.
+ */
+export const TOOL_CALL_TIMEOUT_MS = 60_000;
+
+class ToolCallTimeoutError extends Error {}
+
 function buildDisabledMessage(
   toolName: string,
   flag: string,
@@ -162,6 +177,8 @@ export class ToolHandler {
     private readonly serverArgs: ParsedArguments,
     private readonly getContext: () => Promise<McpContext>,
     private readonly toolMutex: Mutex,
+    private readonly forgetBrowserOnTimeout: (browser: Browser) => void,
+    private readonly abandonPendingBrowserAttemptOnTimeout: () => void,
   ) {
     const {disabled, reason} = getToolStatusInfo(tool, serverArgs);
     this.disabledReason = reason;
@@ -171,6 +188,36 @@ export class ToolHandler {
     this.registeredInputSchema = zod.object(this.inputSchema).strict();
   }
 
+  /**
+   * Races a promise against TOOL_CALL_TIMEOUT_MS, calling onTimeout() if the
+   * timer wins. The loser of the race is left running — there is no way to
+   * cancel a pending Puppeteer call — but since nothing is left awaiting it,
+   * it cannot block subsequent tool calls.
+   */
+  async #raceWithTimeout<T>(
+    promise: Promise<T>,
+    onTimeout: () => void,
+  ): Promise<T> {
+    const timeoutError = new ToolCallTimeoutError(
+      `Tool "${this.tool.name}" timed out after ${TOOL_CALL_TIMEOUT_MS}ms waiting on the browser connection. The connection may have been lost (for example, the debugged browser or app restarted). It will be re-established automatically on the next tool call.`,
+    );
+    let timer: ReturnType<typeof setTimeout> | undefined;
+    const timeout = new Promise<never>((_, reject) => {
+      timer = setTimeout(() => reject(timeoutError), TOOL_CALL_TIMEOUT_MS);
+      timer.unref?.();
+    });
+    try {
+      return await Promise.race([promise, timeout]);
+    } catch (err) {
+      if (err === timeoutError) {
+        onTimeout();
+      }
+      throw err;
+    } finally {
+      clearTimeout(timer);
+    }
+  }
+
   handle = async (params: Record<string, unknown>): Promise<CallToolResult> => {
     using _guard = await this.toolMutex.acquire();
 
@@ -194,7 +241,15 @@ export class ToolHandler {
       logger?.(
         `${this.tool.name} request: ${JSON.stringify(params, null, '  ')}`,
       );
-      const context = await this.getContext();
+      // ensureBrowser() has no cancellation mechanism, so this timeout only
+      // stops us from waiting — the attempt itself keeps running abandoned.
+      // abandonPendingBrowserAttemptOnTimeout() tells BrowserManager to
+      // discard that attempt if it succeeds later instead of handing it to a
+      // subsequent caller — see BrowserManager#abandonPendingAttempt()'s doc
+      // comment for the full mechanism.
+      const context = await this.#raceWithTimeout(this.getContext(), () =>
+        this.abandonPendingBrowserAttemptOnTimeout(),
+      );
       logger?.(`${this.tool.name} context: resolved`);
       const response = this.serverArgs.slim
         ? new SlimMcpResponse(this.serverArgs)
@@ -204,53 +259,61 @@ export class ToolHandler {
       if (context.consumeReconnectNotice()) {
         response.setReconnectNotice();
       }
-      let page: McpPage | undefined;
-      try {
-        await validateToolFiles(this.tool, params, context);
-        if (isPageScopedTool(this.tool)) {
-          const pageId =
-            typeof params.pageId === 'number' ? params.pageId : undefined;
-          page =
-            this.serverArgs.pageIdRouting &&
-            pageId !== undefined &&
-            !this.serverArgs.slim
-              ? context.getPageById(pageId)
-              : context.getSelectedMcpPage();
-          await page?.init();
-          response.setP
```

**File**: `src/index.ts` (modified, +2/-0)
```diff
@@ -289,6 +289,8 @@ export class McpServer {
       this.#serverArgs,
       () => this.#getContext(),
       this.#toolMutex,
+      browser => this.#browserManager.forget(browser),
+      () => this.#browserManager.abandonPendingAttempt(),
     );
 
     this.#tools.set(tool.name, toolHandler);
```

**File**: `tests/ToolHandler.test.ts` (modified, +225/-1)
```diff
@@ -18,7 +18,7 @@ import {McpPage} from '../src/McpPage.js';
 import {McpResponse, type DataFormat} from '../src/McpResponse.js';
 import {ClearcutLogger} from '../src/telemetry/ClearcutLogger.js';
 import {zod} from '../src/third_party/index.js';
-import {ToolHandler} from '../src/ToolHandler.js';
+import {TOOL_CALL_TIMEOUT_MS, ToolHandler} from '../src/ToolHandler.js';
 import {ToolCategory} from '../src/tools/categories.js';
 import {
   definePageTool,
@@ -70,6 +70,8 @@ describe('ToolHandler', () => {
       serverArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
 
     assert.strictEqual(toolHandler.disabled, false);
@@ -115,6 +117,8 @@ describe('ToolHandler', () => {
       serverArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
 
     assert.strictEqual(toolHandler.disabled, false);
@@ -156,6 +160,8 @@ describe('ToolHandler', () => {
       serverArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
 
     assert.strictEqual(toolHandler.disabled, false);
@@ -213,6 +219,8 @@ describe('ToolHandler', () => {
         serverArgs,
         async () => mockContext,
         new Mutex(),
+        sinon.spy(),
+        sinon.spy(),
       ).handle({});
 
       sinon.assert.calledOnceWithExactly(handleStub, mockContext, expected);
@@ -288,6 +296,8 @@ describe('ToolHandler', () => {
         serverArgs,
         async () => mockContext,
         toolMutex,
+        sinon.spy(),
+        sinon.spy(),
       );
 
       await toolHandler.handle({});
@@ -335,6 +345,8 @@ describe('ToolHandler', () => {
       serverArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
 
     const params = {
@@ -389,6 +401,8 @@ describe('ToolHandler', () => {
       serverArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
 
     assert.strictEqual(toolHandler.disabled, true);
@@ -420,6 +434,8 @@ describe('ToolHandler', () => {
       defaultServerArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
     assert.strictEqual(defaultHandler.disabled, false);
 
@@ -439,6 +455,8 @@ describe('ToolHandler', () => {
       disabledServerArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
     assert.strictEqual(disabledHandler.disabled, true);
 
@@ -467,6 +485,8 @@ describe('ToolHandler', () => {
       cliServerArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
     assert.strictEqual(cliHandler.disabled, false);
     const cliResult = await cliHandler.handle({function: '() => 1'});
@@ -497,6 +517,8 @@ describe('ToolHandler', () => {
       defaultServerArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
     assert.strictEqual(defaultHandler.disabled, false);
 
@@ -516,6 +538,8 @@ describe('ToolHandler', () => {
       disabledServerArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
     assert.strictEqual(disabledHandler.disabled, true);
   });
@@ -568,6 +592,8 @@ describe('ToolHandler', () => {
       serverArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
 
     const testFile = path.resolve('/workspace/url-file.txt');
@@ -644,6 +670,8 @@ describe('ToolHandler', () => {
       serverArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
 
     const result = await toolHandler.handle({
@@ -700,6 +728,8 @@ describe('ToolHandler', () => {
       serverArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
 
     const testPath = path.resolve('/workspace/upload.png');
@@ -757,6 +787,8 @@ describe('ToolHandler', () => {
       serverArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
 
     const bundlePath = path.resolve('/workspace/app.swbn');
@@ -817,6 +849,8 @@ describe('ToolHandler', () => {
       serverArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
 
     const result = await toolHandler.handle({
@@ -867,6 +901,8 @@ describe('ToolHandler', () => {
       serverArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
 
     const result = await toolHandler.handle({
@@ -915,6 +951,8 @@ describe('ToolHandler', () => {
       serverArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),
+      sinon.spy(),
     );
 
     const result = await toolHandler.handle({
@@ -971,6 +1009,8 @@ describe('ToolHandler', () => {
       serverArgs,
       async () => mockContext,
       toolMutex,
+      sinon.spy(),

```

**File**: `tests/browser.test.ts` (modified, +268/-0)
```diff
@@ -302,6 +302,274 @@ describe('browser', () => {
       sinon.assert.calledOnce(launchStub);
       sinon.assert.calledOnceWithExactly(pptrBrowser.close);
     });
+
+    describe('forget', () => {
+      it('does nothing when the candidate is not the current browser', async () => {
+        const pptrBrowser = createMockPuppeteerBrowser();
+        const other = createMockPuppeteerBrowser();
+        sinon.stub(puppeteer, 'launch').resolves(pptrBrowser);
+
+        const manager = new BrowserManager(
+          createMockParsedArguments({headless: true, isolated: true}),
+        );
+        await manager.ensureBrowser();
+
+        manager.forget(other);
+
+        sinon.assert.notCalled(other.close);
+        sinon.assert.notCalled(other.disconnect);
+        sinon.assert.notCalled(pptrBrowser.close);
+        sinon.assert.notCalled(pptrBrowser.disconnect);
+      });
+
+      it('disconnects the current browser when it was connected', async () => {
+        const pptrBrowser = createMockPuppeteerBrowser();
+        sinon.stub(puppeteer, 'connect').resolves(pptrBrowser);
+
+        const manager = new BrowserManager(
+          createMockParsedArguments({browserUrl: 'http://127.0.0.1:9222'}),
+        );
+        const browser = await manager.ensureBrowser();
+
+        manager.forget(browser);
+
+        sinon.assert.calledOnceWithExactly(pptrBrowser.disconnect);
+        sinon.assert.notCalled(pptrBrowser.close);
+      });
+
+      it('closes the current browser when it was launched', async () => {
+        const pptrBrowser = createMockPuppeteerBrowser();
+        sinon.stub(puppeteer, 'launch').resolves(pptrBrowser);
+
+        const manager = new BrowserManager(
+          createMockParsedArguments({headless: true, isolated: true}),
+        );
+        const browser = await manager.ensureBrowser();
+
+        manager.forget(browser);
+
+        sinon.assert.calledOnceWithExactly(pptrBrowser.close);
+        sinon.assert.notCalled(pptrBrowser.disconnect);
+      });
+    });
+
+    describe('push-based disconnect eviction', () => {
+      it('proactively evicts a disconnected browser without waiting for a lazy connected check', async () => {
+        const firstBrowser = createMockPuppeteerBrowser();
+        const secondBrowser = createMockPuppeteerBrowser();
+        const launchStub = sinon
+          .stub(puppeteer, 'launch')
+          .onFirstCall()
+          .resolves(firstBrowser)
+          .onSecondCall()
+          .resolves(secondBrowser);
+
+        const manager = new BrowserManager(
+          createMockParsedArguments({headless: true, isolated: true}),
+        );
+
+        const first = await manager.ensureBrowser();
+        assert.strictEqual(first, firstBrowser);
+
+        firstBrowser.emit('disconnected', undefined);
+
+        // The mock's `connected` getter still reports true — proves the next
+        // ensureBrowser() reconnected because of the push-based eviction,
+        // not because a lazy `!browser.connected` check caught it.
+        assert.strictEqual(firstBrowser.connected, true);
+
+        const second = await manager.ensureBrowser();
+        assert.strictEqual(second, secondBrowser);
+        sinon.assert.calledTwice(launchStub);
+      });
+
+      it('does not evict the current browser when disconnected fires on an already-superseded one', async () => {
+        const oldBrowser = createMockPuppeteerBrowser();
+        const newBrowser = createMockPuppeteerBrowser();
+        let oldConnected = true;
+        sinon.stub(oldBrowser, 'connected').get(() => oldConnected);
+        const launchStub = sinon
+          .stub(puppeteer, 'launch')
+          .onFirstCall()
+          .resolves(oldBrowser)
+          .onSecondCall()
+          .resolves(newBrowser);
+
+        const manager = new BrowserManager(
+          createMockParsedArguments({headless: true, isolated: true}),
+        );
+
+        const first = await manager.ensureBrowser();
+        assert.strictEqual(first, oldBrowser);
+
+        oldConnected = false;
+        const second = await manager.ensureBrowser();
+        assert.strictEqual(second, newBrowser);
+
+        oldBrowser.emit('disconnected', undefined);
+
+        const third = await manager.ensureBrowser();
+        assert.strictEqual(third, newBrowser);
+        sinon.assert.calledTwice(launchStub);
+      });
+    });
+
+    describe('abandonPendingAttempt', () => {
+      it('discards a connect() resolution that arrives after being abandoned, and a fresh call still succeeds', async () => {
+        const abandonedBrowser = createMockPuppeteerBrowser();
+        const freshBrowser = createMockPuppeteerBrowser();
+        const connectStarted = Promise.withResolvers<void>();
+        const connectDeferred = Promise.withResolvers<Browser>();
+        const connectStub = sinon
+          .stub(puppeteer, 'connect')
+          .onFirstCall()
+          .callsFake(() => {
+            connectStarted.resolve();
+            return 
```

**File**: `tests/mocks.ts` (modified, +15/-0)
```diff
@@ -136,6 +136,21 @@ export function createMockPuppeteerBrowser(): sinon.SinonStubbedInstance<Browser
   browser.disconnect.resolves();
   browser.pages.resolves([]);
   browser.process.returns(null);
+
+  const browserListener = mockListener();
+  browser.once.callsFake((eventName, handler) => {
+    const onceHandler = (data: unknown) => {
+      browserListener.off(eventName, onceHandler);
+      handler(data);
+    };
+    browserListener.on(eventName, onceHandler);
+    return browser;
+  });
+  browser.emit.callsFake((eventName, data) => {
+    browserListener.emit(eventName, data);
+    return true;
+  });
+
   return browser;
 }
 
```

---

### Incident Patch 14: `efb0d028` (2026-09-29)
**Commit Message**: fix: escape client-supplied values in McpContext logs and errors (#2832)

## Summary

`McpContext.validatePath` wrote two diagnostic lines to stderr that
interpolate client-supplied values verbatim: the tool's `filePath`, and
a `root.uri` from the client's `roots/list` response. A newline in
either value split one log record into several and let the client write
whole lines into the server's stderr (reproduced in #2831).

This PR encodes both values, plus the `realpath` error text that repeats
them, with a small helper, `escapeForLog()`. Each log call now stays on
one line, and quoted client input is always distinguishable from server
text. Following review, the client's path is also encoded in the three
errors `McpContext` throws with it: the two `Access denied` errors from
`validatePath`, and `Could not write …` when saving a file fails.

Behaviour is otherwise unchanged. The same paths are still refused; only
the stderr lines and the path inside those three error messages change
(it is now quoted and escaped).

## Why not just `JSON.stringify`

`JSON.stringify` alone (the fix suggested in #2831, and the first commit
here) escapes C0 controls and `"`, but it leaves these characte

**File**: `src/McpContext.ts` (modified, +8/-5)
```diff
@@ -49,6 +49,7 @@ import type {TraceResult} from './processors/PerformanceTrace.js';
 import type {Logger} from './types.js';
 import type {ExtensionServiceWorker} from './types.js';
 import {getTempFilePath, resolveCanonicalPath} from './utils/files.js';
+import {escapeForLog} from './utils/logger.js';
 import {isAllowedUrl} from './utils/url.js';
 interface McpContextOptions {
   // Whether the DevTools windows are exposed as pages for debugging of DevTools.
@@ -241,10 +242,10 @@ export class McpContext implements Context {
     } catch (err) {
       const errMsg = err instanceof Error ? err.message : String(err);
       console.error(
-        `[MCP Context] Error resolving real path for ${filePath}: ${errMsg}`,
+        `[MCP Context] Error resolving real path for ${escapeForLog(filePath)}: ${escapeForLog(errMsg)}`,
       );
       throw new Error(
-        `Access denied: Cannot resolve base path for ${filePath}.`,
+        `Access denied: Cannot resolve base path for ${escapeForLog(filePath)}.`,
       );
     }
 
@@ -289,15 +290,15 @@ export class McpContext implements Context {
         const errMsg =
           rootErr instanceof Error ? rootErr.message : String(rootErr);
         console.warn(
-          `[MCP Context] Could not resolve configured root ${root.uri}: ${errMsg}`,
+          `[MCP Context] Could not resolve configured root ${escapeForLog(root.uri)}: ${escapeForLog(errMsg)}`,
         );
         // Skip this root if it cannot be resolved.
       }
     }
 
     if (!allowed) {
       throw new Error(
-        `Access denied: path ${filePath} (canonical: ${canonicalPath}) is not within any of the configured workspace roots.`,
+        `Access denied: path ${escapeForLog(filePath)} (canonical: ${escapeForLog(canonicalPath)}) is not within any of the configured workspace roots.`,
       );
     }
 
@@ -681,7 +682,9 @@ export class McpContext implements Context {
         mode: 0o600,
       });
     } catch (err) {
-      throw new Error(`Could not write ${filepath}`, {cause: err});
+      throw new Error(`Could not write ${escapeForLog(filepath)}`, {
+        cause: err,
+      });
     }
   }
 
```

**File**: `src/utils/logger.ts` (modified, +13/-0)
```diff
@@ -39,6 +39,19 @@ export function flushLogs(
   });
 }
 
+/**
+ * Encodes a value for interpolation into a one-line log or error message. The
+ * result is a JSON string literal that also escapes DEL, C1 controls and
+ * U+2028/U+2029, which JSON.stringify leaves raw but terminals and line
+ * readers act on.
+ */
+export function escapeForLog(value: string): string {
+  return JSON.stringify(value).replace(
+    /[\u007f-\u009f\u2028\u2029]/g,
+    char => `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`,
+  );
+}
+
 export const logger: Logger = (...args: unknown[]) => {
   if (logFileStream) {
     logFileStream.write(
```

**File**: `tests/roots.test.ts` (modified, +111/-1)
```diff
@@ -5,13 +5,19 @@
  */
 
 import assert from 'node:assert';
+import fs from 'node:fs/promises';
 import os from 'node:os';
 import path from 'node:path';
-import {describe, it} from 'node:test';
+import {afterEach, describe, it} from 'node:test';
 import {pathToFileURL} from 'node:url';
 
+import sinon from 'sinon';
+
+import {McpContext} from '../src/McpContext.js';
 import {resolveCanonicalPath} from '../src/utils/files.js';
+import {escapeForLog} from '../src/utils/logger.js';
 
+import {createMockPuppeteerBrowser} from './mocks.js';
 import {createTempDir, withMcpContext} from './utils.js';
 
 describe('McpContext Roots', () => {
@@ -139,3 +145,107 @@ describe('McpContext Roots', () => {
     });
   });
 });
+
+const UNESCAPED_LINE_BREAK = /[\n\r\u2028\u2029]/;
+const INJECTED = 'x\n\u2028[MCP Context] injected line';
+
+function enoent(filePath: string): Error {
+  return Object.assign(new Error(`ENOENT: ${filePath}`), {code: 'ENOENT'});
+}
+
+// Payload paths hold characters some file systems reject; report them missing
+// so every OS takes the same branch.
+function stubMissingPaths(...missingPaths: string[]) {
+  const realpath = sinon.stub(fs, 'realpath').callThrough();
+  for (const missingPath of missingPaths) {
+    realpath.withArgs(missingPath).rejects(enoent(missingPath));
+  }
+  return realpath;
+}
+
+describe('McpContext path validation escaping', () => {
+  afterEach(() => sinon.restore());
+
+  async function createContext(): Promise<McpContext> {
+    const browser = createMockPuppeteerBrowser();
+    browser.targets.returns([]);
+    return await McpContext.from(browser, undefined, {
+      experimentalDevToolsDebugging: false,
+      performanceCrux: false,
+    });
+  }
+
+  it('escapes the file path when it cannot be resolved', async () => {
+    const context = await createContext();
+    const filePath = path.join(os.tmpdir(), 'file.txt', INJECTED);
+    const errMsg = `ENOTDIR: not a directory, realpath '${filePath}'`;
+    sinon
+      .stub(fs, 'realpath')
+      .rejects(Object.assign(new Error(errMsg), {code: 'ENOTDIR'}));
+    const errorStub = sinon.stub(console, 'error');
+
+    await assert.rejects(context.validatePath(filePath), {
+      message: `Access denied: Cannot resolve base path for ${escapeForLog(filePath)}.`,
+    });
+
+    sinon.assert.calledWithMatch(
+      errorStub,
+      sinon.match((message: string) => !UNESCAPED_LINE_BREAK.test(message)),
+    );
+    sinon.assert.calledOnceWithExactly(
+      errorStub,
+      `[MCP Context] Error resolving real path for ${escapeForLog(filePath)}: ${escapeForLog(errMsg)}`,
+    );
+  });
+
+  it('escapes the path when it is outside the configured roots', async () => {
+    const context = await createContext();
+    const unlikelyDir = 'a_very_unlikely_path_name_12345';
+    const filePath = path.resolve(
+      path.parse(os.tmpdir()).root,
+      unlikelyDir,
+      INJECTED,
+    );
+    stubMissingPaths(filePath, path.dirname(filePath));
+    const canonicalPath = await resolveCanonicalPath(filePath);
+
+    await assert.rejects(context.validatePath(filePath), {
+      message: `Access denied: path ${escapeForLog(filePath)} (canonical: ${escapeForLog(canonicalPath)}) is not within any of the configured workspace roots.`,
+    });
+  });
+
+  it('escapes the path when the file cannot be written', async () => {
+    const context = await createContext();
+    const clientPath = path.join(os.tmpdir(), `${INJECTED}.png`);
+    const realpath = stubMissingPaths(clientPath);
+    const filePath = await context.ensureExtension(clientPath, '.png');
+    realpath.withArgs(filePath).rejects(enoent(filePath));
+    sinon
+      .stub(fs, 'mkdir')
+      .rejects(Object.assign(new Error('EACCES'), {code: 'EACCES'}));
+
+    await assert.rejects(
+      context.saveFile(new Uint8Array([0]), clientPath, '.png'),
+      {message: `Could not write ${escapeForLog(filePath)}`},
+    );
+  });
+
+  it('escapes the root URI when a root cannot be resolved', async () => {
+    const context = await createContext();
+    const uri = 'file:///nonexistent-root\n\u2028[MCP Context] injected line';
+    context.setRoots([{uri, name: 'unresolvable'}]);
+    const warnStub = sinon.stub(console, 'warn');
+
+    await context.validatePath(path.join(os.tmpdir(), 'test-file.txt'));
+
+    sinon.assert.calledOnceWithMatch(
+      warnStub,
+      sinon.match(
+        (message: string) =>
+          message.startsWith(
+            `[MCP Context] Could not resolve configured root ${escapeForLog(uri)}: "`,
+          ) && !UNESCAPED_LINE_BREAK.test(message),
+      ),
+    );
+  });
+});
```

**File**: `tests/utils/logger.test.ts` (modified, +28/-1)
```diff
@@ -9,7 +9,11 @@ import fs from 'node:fs';
 import {afterEach, describe, it, mock} from 'node:test';
 import util from 'node:util';
 
-import {puppeteerLogger, saveLogsToFile} from '../../src/utils/logger.js';
+import {
+  escapeForLog,
+  puppeteerLogger,
+  saveLogsToFile,
+} from '../../src/utils/logger.js';
 
 describe('puppeteerLogger', () => {
   afterEach(() => {
@@ -66,3 +70,26 @@ describe('puppeteerLogger', () => {
     assert.ok(writeArg.includes('hello world\n'));
   });
 });
+
+describe('escapeForLog', () => {
+  it('returns a JSON string literal', () => {
+    assert.strictEqual(escapeForLog('a"b\\c'), '"a\\"b\\\\c"');
+  });
+
+  it('escapes characters that break a log line or control a terminal', () => {
+    const cases: Array<[string, string]> = [
+      ['\n', '\\n'],
+      ['\r', '\\r'],
+      ['\u001b', '\\u001b'],
+      ['\u007f', '\\u007f'],
+      ['\u0085', '\\u0085'],
+      ['\u009b', '\\u009b'],
+      ['\u2028', '\\u2028'],
+      ['\u2029', '\\u2029'],
+    ];
+    for (const [char, escaped] of cases) {
+      assert.strictEqual(escapeForLog(`a${char}b`), `"a${escaped}b"`);
+      assert.strictEqual(JSON.parse(escapeForLog(`a${char}b`)), `a${char}b`);
+    }
+  });
+});
```

---

### Incident Patch 15: `c14e616d` (2026-09-28)
**Commit Message**: fix: reject JSON arrays as 3p and WebMCP tool params (#2785)

## Summary
`execute_3p_developer_tool` and `execute_webmcp_tool` parse a JSON
string as params. Arrays pass `typeof parsed === 'object' && parsed !==
null`, so `[]` skipped the object check and failed later with a
misleading error (`Tool not found` or a Puppeteer private-field
TypeError).

Reject arrays the same way `wsHeaders` already does.

## Testing
- `npm run test tests/tools/thirdPartyDeveloper.test.ts
tests/tools/webmcp.test.ts`
- `npm run typecheck`
- `npm run check-format`

AI-assisted (Grok)

Co-authored-by: Wolfgang Beyer <[REDACTED_EMAIL]>

**File**: `src/tools/thirdPartyDeveloper.ts` (modified, +5/-1)
```diff
@@ -85,7 +85,11 @@ export const executeThirdPartyDeveloperTool = definePageTool(() => ({
     if (request.params.params) {
       try {
         const parsed = JSON.parse(request.params.params);
-        if (typeof parsed === 'object' && parsed !== null) {
+        if (
+          typeof parsed === 'object' &&
+          parsed !== null &&
+          !Array.isArray(parsed)
+        ) {
           params = parsed;
         } else {
           throw new Error('Parsed params is not an object');
```

**File**: `src/tools/webmcp.ts` (modified, +5/-1)
```diff
@@ -47,7 +47,11 @@ export const executeWebMcpTool = definePageTool(() => ({
     if (request.params.input) {
       try {
         const parsed = JSON.parse(request.params.input);
-        if (typeof parsed === 'object' && parsed !== null) {
+        if (
+          typeof parsed === 'object' &&
+          parsed !== null &&
+          !Array.isArray(parsed)
+        ) {
           input = parsed;
         } else {
           throw new Error('Parsed input is not an object');
```

**File**: `tests/tools/thirdPartyDeveloper.test.ts` (modified, +24/-1)
```diff
@@ -5,7 +5,7 @@
  */
 
 import assert from 'node:assert';
-import {describe, it} from 'node:test';
+import {afterEach, describe, it} from 'node:test';
 
 import sinon from 'sinon';
 
@@ -18,9 +18,14 @@ import {
   listThirdPartyDeveloperTools,
 } from '../../src/tools/thirdPartyDeveloper.js';
 import type {ToolGroups} from '../../src/tools/thirdPartyDeveloper.js';
+import {createHandlerMocks} from '../mocks.js';
 import {withMcpContext} from '../utils.js';
 
 describe('thirdPartyDeveloperTools', () => {
+  afterEach(() => {
+    sinon.restore();
+  });
+
   describe('list_3p_developer_tools', () => {
     it('lists tools', async () => {
       await withMcpContext(
@@ -391,6 +396,24 @@ describe('thirdPartyDeveloperTools', () => {
       });
     });
 
+    it('rejects JSON array params', async () => {
+      const {page, context, response, args} = createHandlerMocks();
+      await assert.rejects(
+        executeThirdPartyDeveloperTool(args).handler(
+          {
+            params: {
+              toolName: 'test-tool',
+              params: '[]',
+            },
+            page,
+          },
+          response,
+          context,
+        ),
+        {message: /Parsed params is not an object/},
+      );
+    });
+
     it('throws if parameters are invalid', async () => {
       await withMcpContext(
         async (response, context, args) => {
```

**File**: `tests/tools/webmcp.test.ts` (modified, +23/-1)
```diff
@@ -5,14 +5,21 @@
  */
 
 import assert from 'node:assert';
-import {describe, it} from 'node:test';
+import {afterEach, describe, it} from 'node:test';
+
+import sinon from 'sinon';
 
 import type {McpPage} from '../../src/McpPage.js';
 import {listPages, navigatePage, selectPage} from '../../src/tools/pages.js';
 import {executeWebMcpTool} from '../../src/tools/webmcp.js';
+import {createHandlerMocks} from '../mocks.js';
 import {html, withMcpContext} from '../utils.js';
 
 describe('webmcp', () => {
+  afterEach(() => {
+    sinon.restore();
+  });
+
   describe('list_webmcp_tools', () => {
     it('list webmcp tools in navigate_page response', async () => {
       await withMcpContext(async (response, context, args) => {
@@ -110,6 +117,21 @@ describe('webmcp', () => {
       );
     });
 
+    it('rejects JSON array input', async () => {
+      const {page, context, response, args} = createHandlerMocks();
+      await assert.rejects(
+        executeWebMcpTool(args).handler(
+          {
+            params: {toolName: 'test_tool', input: '[]'},
+            page,
+          },
+          response,
+          context,
+        ),
+        {message: /Parsed input is not an object/},
+      );
+    });
+
     it('throws if input is invalid', async () => {
       await withMcpContext(
         async (response, context, args) => {
```

#### Recent Merged Pull Requests:
- **PR #2904** (2026-10-05): chore(deps-dev): bump yargs from 18.1.0 to 18.2.0 in the bundled group (@dependabot[bot])
- **PR #2903** (2026-10-05): chore(deps-dev): bump the dev-dependencies group with 9 updates (@dependabot[bot])
- **PR #2899** (closed): chore(deps): bump third_party/devtools-frontend from `1e16983` to `9d17ded` (@dependabot[bot])
- **PR #2896** (2026-10-02): feat: skip more redundant data in text snapshots (@OrKoN)
- **PR #2895** (2026-10-01): feat: reduce StaticText noise in text snapshots (@OrKoN)
- **PR #2894** (2026-10-01): chore(deps): fix up deps (@OrKoN)
- **PR #2892** (2026-10-01): fix: harden third-party tool result serialization (@wolfib)
- **PR #2891** (2026-10-01): build: pass --init to git submodule update in prepare script (@OrKoN)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
