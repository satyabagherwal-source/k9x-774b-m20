# Forensic Learning Record (Deep Inspection): google-gemini/gemini-cli

> **Canonical Artifact**: `07_PROJECT_LEARNING/google-gemini-gemini-cli-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/google-gemini/gemini-cli](https://github.com/google-gemini/gemini-cli))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:25:10.943Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `google-gemini/gemini-cli`
- **Description**: An open-source AI agent that brings the power of Gemini directly into your terminal.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 107236 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `evals/concurrency-safety.eval.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { expect } from 'vitest';
import { evalTest } from './test-helper.js';

const MUTATION_AGENT_DEFINITION = `---
name: mutation-agent
description: An agent that modifies the workspace (writes, deletes, git operations, etc).
max_turns: 1
tools:
  - write_file
---

You are the mutation agent. Do the mutation requested.
`;

describe('concurrency safety eval test cases', () => {
  evalTest('USUALLY_PASSES', {
    suiteName: 'default',
    suiteType: 'behavioral',
    name: 'mutation agents are run in parallel when explicitly requested',
    params: {
      settings: {
        experimental: {
          enableAgents: true,
        },
      },
    },
    prompt:
      'Update A.txt to say "A" and update B.txt to say "B". Delegate these tasks to two separate mutation-agent subagents. You MUST run these subagents in parallel at the same time.',
    files: {
      '.gemini/agents/mutation-agent.md': MUTATION_AGENT_DEFINITION,
    },
    assert: async (rig) => {
      const logs = rig.readToolLogs();
      const mutationCalls = logs.filter(
        (log) => log.toolRequest?.name === 'mutation-agent',
      );

      expect(
        mutationCalls.length,
        'Agent should have called the mutation-agent at least twice',
      ).toBeGreaterThanOrEqual(2);

      const firstPromptId = mutationCalls[0].toolRequest.prompt_id;
      const secondPromptId = mutationCalls[1].toolRequest.prompt_id;

      expect(
        firstPromptId,
        'mutation agents should be called in parallel (same turn / prompt_ids) when explicitly requested',
      ).toEqual(secondPromptId);
    },
  });
});

```

### Core Architecture Module: `packages/a2a-server/src/utils/executor_utils.ts`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Message } from '@a2a-js/sdk';
import type { ExecutionEventBus } from '@a2a-js/sdk/server';
import { v4 as uuidv4 } from 'uuid';

import { CoderAgentEvent, type StateChange } from '../types.js';

export async function pushTaskStateFailed(
  error: unknown,
  eventBus: ExecutionEventBus,
  taskId: string,
  contextId: string,
) {
  const errorMessage =
    error instanceof Error ? error.message : 'Agent execution error';
  const stateChange: StateChange = {
    kind: CoderAgentEvent.StateChangeEvent,
  };
  eventBus.publish({
    kind: 'status-update',
    taskId,
    contextId,
    status: {
      state: 'failed',
      message: {
        kind: 'message',
        role: 'agent',
        parts: [
          {
            kind: 'text',
            text: errorMessage,
          },
        ],
        messageId: uuidv4(),
        taskId,
        contextId,
      } as Message,
    },
    final: true,
    metadata: {
      coderAgent: stateChange,
      model: 'unknown',
      error: errorMessage,
    },
  });
}

```

### Core Architecture Module: `packages/a2a-server/src/utils/logger.ts`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    // First, add a timestamp to the log info object
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss.SSS A', // Custom timestamp format
    }),
    // Here we define the custom output format
    winston.format.printf((info) => {
      const { level, timestamp, message, ...rest } = info;
      return (
        `[${level.toUpperCase()}] ${timestamp} -- ${message}` +
        `${Object.keys(rest).length > 0 ? `\n${JSON.stringify(rest, null, 2)}` : ''}`
      ); // Only print ...rest if present
    }),
  ),
  transports: [new winston.transports.Console()],
});

export { logger };

```

### Core Architecture Module: `packages/a2a-server/src/utils/path_utils.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { resolveToRealPath, isSubpath } from '@google/gemini-cli-core';

/**
 * Validates a workspace path to prevent path traversal attacks.
 *
 * @param workspacePath The path to validate.
 * @param allowedRoot The root directory the path must be within. Defaults to CWD.
 * @returns The resolved, safe path.
 * @throws An error if the path is invalid or outside the allowed root.
 */
export async function validateWorkspacePath(
  workspacePath?: string,
  allowedRoot: string = process.cwd(),
): Promise<string> {
  const trimmedPath = workspacePath?.trim();
  if (!trimmedPath) {
    return resolveToRealPath(allowedRoot);
  }

  if (trimmedPath.includes('\0')) {
    throw new Error('Security violation: Null byte detected in path.');
  }

  try {
    const canonicalAllowedRoot = resolveToRealPath(allowedRoot);
    const resolvedWorkspacePath = path.resolve(
      canonicalAllowedRoot,
      trimmedPath,
    );
    const canonicalWorkspacePath = resolveToRealPath(resolvedWorkspacePath);

    // Check if the resolved path is within the allowed root directory
    if (
      canonicalWorkspacePath !== canonicalAllowedRoot &&
      !isSubpath(canonicalAllowedRoot, canonicalWorkspacePath)
    ) {
      throw new Error(
        `Security violation: The path "${trimmedPath}" is outside the allowed root directory.`,
      );
    }

    const stats = await fs.promises.stat(canonicalWorkspacePath);
    if (!stats.isDirectory()) {
      throw new Error(`The path "${trimmedPath}" is not a directory.`);
    }

    return canonicalWorkspacePath;
  } catch (e) {
    if (e instanceof Error && 'code' in e && e.code === 'ENOENT') {
      throw new Error(`The path "${trimmedPath}" does not exist.`);
    }
    throw e; // Re-throw other errors
  }
}

```

### Core Architecture Module: `packages/cli/src/acp/acpUtils.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type Config,
  type ToolResult,
  type ToolCallConfirmationDetails,
  Kind,
  ApprovalMode,
  GEMINI_MODEL_ALIAS_AUTO,
  DEFAULT_GEMINI_MODEL,
  DEFAULT_GEMINI_FLASH_MODEL,
  DEFAULT_GEMINI_FLASH_LITE_MODEL,
  PREVIEW_GEMINI_3_1_MODEL,
  PREVIEW_GEMINI_MODEL,
  PREVIEW_GEMINI_3_1_CUSTOM_TOOLS_MODEL,
  PREVIEW_GEMINI_FLASH_MODEL,
  PREVIEW_GEMINI_FLASH_LITE_MODEL,
  getDisplayString,
  AuthType,
  ToolConfirmationOutcome,
  getAutoModelDescription,
} from '@google/gemini-cli-core';
import type * as acp from '@agentclientprotocol/sdk';
import { z } from 'zod';
import type { LoadedSettings } from '../config/settings.js';

export function hasMeta(
  obj: unknown,
): obj is { _meta?: Record<string, unknown> } {
  return typeof obj === 'object' && obj !== null && '_meta' in obj;
}

export const RequestPermissionResponseSchema = z.object({
  outcome: z.discriminatedUnion('outcome', [
    z.object({ outcome: z.literal('cancelled') }),
    z.object({
      outcome: z.literal('selected'),
      optionId: z.string(),
    }),
  ]),
});

export function toToolCallContent(
  toolResult: ToolResult,
): acp.ToolCallContent | null {
  if (toolResult.error?.message) {
    throw new Error(toolResult.error.message);
  }

  if (toolResult.returnDisplay) {
    if (typeof toolResult.returnDisplay === 'string') {
      return {
        type: 'content',
        content: { type: 'text', text: toolResult.returnDisplay },
      };
    } else {
      if ('fileName' in toolResult.returnDisplay) {
        return {
          type: 'diff',
          path:
            toolResult.returnDisplay.filePath ??
            toolResult.returnDisplay.fileName,
          oldText: toolResult.returnDisplay.originalContent,
          newText: toolResult.returnDisplay.newContent,
          _meta: {
            kind: !toolResult.returnDisplay.originalContent
              ? 'add'
              : toolResult.returnDisplay.newContent === ''
                ? 'delete'
                : 'modify',
          },
        };
      }
      return null;
    }
  } else {
    return null;
  }
}

const basicPermissionOptions = [
  {
    optionId: ToolConfirmationOutcome.ProceedOnce,
    name: 'Allow',
    kind: 'allow_once',
  },
  {
    optionId: ToolConfirmationOutcome.Cancel,
    name: 'Reject',
    kind: 'reject_once',
  },
] as const;

export function toPermissionOptions(
  confirmation: ToolCallConfirmationDetails,
  config: Config,
  enablePermanentToolApproval: boolean = false,
): acp.PermissionOption[] {
  const disableAlwaysAllow = config.getDisableAlwaysAllow();
  const options: acp.PermissionOption[] = [];

  if (!disableAlwaysAllow) {
    switch (confirmation.type) {
      case 'edit':
        options.push({
          optionId: ToolConfirmationOutcome.ProceedAlways,
          name: 'Allow for this session',
          kind: 'allow_always',
        });
        if (enablePermanentToolApproval) {
          options.push({
            optionId: ToolConfirmationOutcome.ProceedAlwaysAndSave,
            name: 'Allow for this file in all future sessions',
            kind: 'allow_always',
          });
        }
        break;
      case 'exec':
        options.push({
          optionId: ToolConfirmationOutcome.ProceedAlways,
          name: 'Allow for this session',
          kind: 'allow_always',
        });
        if (enablePermanentToolApproval) {
          options.push({
            optionId: ToolConfirmationOutcome.ProceedAlwaysAndSave,
            name: 'Allow this command for all future sessions',
            kind: 'allow_always',
          });
        }
        break;
      case 'mcp':
        options.push(
          {
            optionId: ToolConfirmationOutcome.ProceedAlwaysServer,
            name: 'Allow all server tools for this session',
            kind: 'allow_always',
          },
          {
            optionId: ToolConfirmationOutcome.ProceedAlwaysTool,
            name: 'Allow tool for this session',
            kind: 'allow_always',
          },
        );
        if (enablePermanentToolApproval) {
          options.push({
            optionId: ToolConfirmationOutcome.ProceedAlwaysAndSave,
            name: 'Allow tool for all future sessions',
            kind: 'allow_always',
          });
        }
        break;
      case 'info':
        options.push({
          optionId: ToolConfirmationOutcome.ProceedAlways,
          name: 'Allow for this session',
          kind: 'allow_always',
        });
        if (enablePermanentToolApproval) {
          options.push({
            optionId: ToolConfirmationOutcome.ProceedAlwaysAndSave,
            name: 'Allow for all future sessions',
            kind: 'allow_always',
          });
        }
        break;
      case 'ask_user':
      case 'exit_plan_mode':
        // askuser and exit_plan_mode don't need "always allow" options
        break;
      default:
        // No "always allow" options for other types
        break;
    }
  }

  options.push(...basicPermissionOptions);

  // Exhaustive check
  switch (confirmation.type) {
    case 'edit':
    case 'exec':
    case 'mcp':
    case 'info':
    case 'ask_user':
    case 'exit_plan_mode':
    case 'sandbox_expansion':
      break;
    default: {
      const unreachable: never = confirmation;
      throw new Error(`Unexpected: ${unreachable}`);
    }
  }

  return options;
}

export function toAcpToolKind(kind: Kind): acp.ToolKind {
  switch (kind) {
    case Kind.Read:
    case Kind.Edit:
    case Kind.Execute:
    case Kind.Search:
    case Kind.Delete:
    case Kind.Move:
    case Kind.Think:
    case Kind.Fetch:
    case Kind.SwitchMode:
    case Kind.Other:
      return kind as acp.ToolKind;
    case Kind.Agent:
      return 'think';
    case Kind.Plan:
    case Kind.Communicate:
    default:
      return 'other';
  }
}

export function buildAvailableModes(isPlanEnabled: boolean): acp.SessionMode[] {
  const modes: acp.SessionMode[] = [
    {
      id: ApprovalMode.DEFAULT,
      name: 'Default',
      description: 'Prompts for approval',
    },
    {
      id: ApprovalMode.AUTO_EDIT,
      name: 'Auto Edit',
      description: 'Auto-approves edit tools',
    },
    {
      id: ApprovalMode.YOLO,
      name: 'YOLO',
      description: 'Auto-approves all tools',
    },
  ];

  if (isPlanEnabled) {
    modes.push({
      id: ApprovalMode.PLAN,
      name: 'Plan',
      description: 'Read-only mode',
    });
  }

  return modes;
}

export function buildAvailableModels(
  config: Config,
  settings: LoadedSettings,
): {
  availableModels: Array<{
    modelId: string;
    name: string;
    description?: string;
  }>;
  currentModelId: string;
} {
  const preferredModel = config.getModel() || GEMINI_MODEL_ALIAS_AUTO;
  const shouldShowPreviewModels = config.getHasAccessToPreviewModel();
  const useGemini31 = config.getGemini31LaunchedSync?.() ?? false;
  const useLatestFlash = config.hasLatestFlashGAAccess?.() ?? false;
  const useLatestFlashLite = config.hasLatestFlashLiteGAAccess?.() ?? false;
  const selectedAuthType = settings.merged.security.auth.selectedType;
  const useCustomToolModel =
    useGemini31 && selectedAuthType === AuthType.USE_GEMINI;

  // --- DYNAMIC PATH ---
  if (
    config.getExperimentalDynamicModelConfiguration?.() === true &&
    config.getModelConfigService
  ) {
    const options = config.getModelConfigService().getAvailableModelOptions({
      useGemini3_1: useGemini31,
      useLatestFlash,
      useLatestFlashLite,
      useCustomTools: useCustomToolModel,
      hasAccessToPreview: shouldShowPreviewModels,
    });

    return {
      availableModels: options,
      currentModelId: preferredModel,
    };
  }

  // --- LEGACY PATH ---
  const mainOptions = [
    {
      value: GEMINI_MODEL_ALIAS_AUTO,
      title: getDisplayString(GEMINI_MODEL_ALIAS_AUTO),
      description: getAutoModelDescription(
        shouldShowPreviewModels,
        useGemini31,
        useLatestFlash,
      ),
    },
  ];

  const manualOptions = [
    {
      value: DEFAULT_GEMINI_MODEL,
      title: getDisplayString(DEFAULT_GEMINI_MODEL),
    },
    {
      value: DEFAULT_GEMINI_FLASH_MODEL,
      title: getDisplayString(DEFAULT_GEMINI_FLASH_MODEL),
    },
    {
      value: DEFAULT_GEMINI_FLASH_LITE_MODEL,
      title: getDisplayString(DEFAULT_GEMINI_FLASH_LITE_MODEL),
    },
  ];

  if (shouldShowPreviewModels) {
    const previewProModel = useGemini31
      ? PREVIEW_GEMINI_3_1_MODEL
      : PREVIEW_GEMINI_MODEL;

    const previewProValue = useCustomToolModel
      ? PREVIEW_GEMINI_3_1_CUSTOM_TOOLS_MODEL
      : previewProModel;

    const previewOptions = [
      {
        value: previewProValue,
        title: getDisplayString(previewProModel),
      },
      {
        value: PREVIEW_GEMINI_FLASH_MODEL,
        title: getDisplayString(PREVIEW_GEMINI_FLASH_MODEL),
      },
    ];

    if (PREVIEW_GEMINI_FLASH_LITE_MODEL !== 'none') {
      previewOptions.push({
        value: PREVIEW_GEMINI_FLASH_LITE_MODEL,
        title: getDisplayString(PREVIEW_GEMINI_FLASH_LITE_MODEL),
      });
    }

    manualOptions.unshift(...previewOptions);
  }

  const scaleOptions = (
    options: Array<{ value: string; title: string; description?: string }>,
  ) =>
    options.map((o) => ({
      modelId: o.value,
      name: o.title,
      description: o.description,
    }));

  return {
    availableModels: [
      ...scaleOptions(mainOptions),
      ...scaleOptions(manualOptions),
    ],
    currentModelId: preferredModel,
  };
}

```

### Core Architecture Module: `packages/cli/src/commands/extensions/examples/hooks/scripts/on-start.js`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
console.log(
  'Session Started! This is running from a script in the hooks-example extension.',
);

```

### Core Architecture Module: `packages/cli/src/commands/extensions/utils.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */
import { ExtensionManager } from '../../config/extension-manager.js';
import { loadSettings } from '../../config/settings.js';
import { requestConsentNonInteractive } from '../../config/extensions/consent.js';
import {
  debugLogger,
  type ResolvedExtensionSetting,
} from '@google/gemini-cli-core';
import type { ExtensionConfig } from '../../config/extension.js';
import prompts from 'prompts';
import {
  promptForSetting,
  updateSetting,
  type ExtensionSetting,
  getScopedEnvContents,
  ExtensionSettingScope,
} from '../../config/extensions/extensionSettings.js';

export interface ConfigLogger {
  log(message: string): void;
  error(message: string): void;
}

export type RequestSettingCallback = (
  setting: ExtensionSetting,
) => Promise<string | undefined>;
export type RequestConfirmationCallback = (message: string) => Promise<boolean>;

const defaultLogger: ConfigLogger = {
  log: (message: string) => debugLogger.log(message),
  error: (message: string) => debugLogger.error(message),
};

const defaultRequestSetting: RequestSettingCallback = async (setting) =>
  promptForSetting(setting);

const defaultRequestConfirmation: RequestConfirmationCallback = async (
  message,
) => {
  const response = await prompts({
    type: 'confirm',
    name: 'confirm',
    message,
    initial: false,
  });
  return typeof response.confirm === 'boolean' ? response.confirm : false;
};

export async function getExtensionManager() {
  const workspaceDir = process.cwd();
  const extensionManager = new ExtensionManager({
    workspaceDir,
    requestConsent: requestConsentNonInteractive,
    requestSetting: promptForSetting,
    settings: loadSettings(workspaceDir).merged,
  });
  await extensionManager.loadExtensions();
  return extensionManager;
}

export async function getExtensionAndManager(
  extensionManager: ExtensionManager,
  name: string,
  logger: ConfigLogger = defaultLogger,
) {
  const extension = extensionManager
    .getExtensions()
    .find((ext) => ext.name === name);

  if (!extension) {
    logger.error(`Extension "${name}" is not installed.`);
    return { extension: null };
  }

  return { extension };
}

export async function configureSpecificSetting(
  extensionManager: ExtensionManager,
  extensionName: string,
  settingKey: string,
  scope: ExtensionSettingScope,
  logger: ConfigLogger = defaultLogger,
  requestSetting: RequestSettingCallback = defaultRequestSetting,
) {
  const { extension } = await getExtensionAndManager(
    extensionManager,
    extensionName,
    logger,
  );
  if (!extension) {
    return;
  }
  const extensionConfig = await extensionManager.loadExtensionConfig(
    extension.path,
  );
  if (!extensionConfig) {
    logger.error(
      `Could not find configuration for extension "${extensionName}".`,
    );
    return;
  }

  await updateSetting(
    extensionConfig,
    extension.id,
    settingKey,
    requestSetting,
    scope,
    process.cwd(),
  );

  logger.log(`Setting "${settingKey}" updated.`);
}

export async function configureExtension(
  extensionManager: ExtensionManager,
  extensionName: string,
  scope: ExtensionSettingScope,
  logger: ConfigLogger = defaultLogger,
  requestSetting: RequestSettingCallback = defaultRequestSetting,
  requestConfirmation: RequestConfirmationCallback = defaultRequestConfirmation,
) {
  const { extension } = await getExtensionAndManager(
    extensionManager,
    extensionName,
    logger,
  );
  if (!extension) {
    return;
  }
  const extensionConfig = await extensionManager.loadExtensionConfig(
    extension.path,
  );
  if (
    !extensionConfig ||
    !extensionConfig.settings ||
    extensionConfig.settings.length === 0
  ) {
    logger.log(`Extension "${extensionName}" has no settings to configure.`);
    return;
  }

  logger.log(`Configuring settings for "${extensionName}"...`);
  await configureExtensionSettings(
    extensionConfig,
    extension.id,
    scope,
    logger,
    requestSetting,
    requestConfirmation,
  );
}

export async function configureAllExtensions(
  extensionManager: ExtensionManager,
  scope: ExtensionSettingScope,
  logger: ConfigLogger = defaultLogger,
  requestSetting: RequestSettingCallback = defaultRequestSetting,
  requestConfirmation: RequestConfirmationCallback = defaultRequestConfirmation,
) {
  const extensions = extensionManager.getExtensions();

  if (extensions.length === 0) {
    logger.log('No extensions installed.');
    return;
  }

  for (const extension of extensions) {
    const extensionConfig = await extensionManager.loadExtensionConfig(
      extension.path,
    );
    if (
      extensionConfig &&
      extensionConfig.settings &&
      extensionConfig.settings.length > 0
    ) {
      logger.log(`\nConfiguring settings for "${extension.name}"...`);
      await configureExtensionSettings(
        extensionConfig,
        extension.id,
        scope,
        logger,
        requestSetting,
        requestConfirmation,
      );
    }
  }
}

export async function configureExtensionSettings(
  extensionConfig: ExtensionConfig,
  extensionId: string,
  scope: ExtensionSettingScope,
  logger: ConfigLogger = defaultLogger,
  requestSetting: RequestSettingCallback = defaultRequestSetting,
  requestConfirmation: RequestConfirmationCallback = defaultRequestConfirmation,
) {
  const currentScopedSettings = await getScopedEnvContents(
    extensionConfig,
    extensionId,
    scope,
    process.cwd(),
  );

  let workspaceSettings: Record<string, string> = {};
  if (scope === ExtensionSettingScope.USER) {
    workspaceSettings = await getScopedEnvContents(
      extensionConfig,
      extensionId,
      ExtensionSettingScope.WORKSPACE,
      process.cwd(),
    );
  }

  if (!extensionConfig.settings) return;

  for (const setting of extensionConfig.settings) {
    const currentValue = currentScopedSettings[setting.envVar];
    const workspaceValue = workspaceSettings[setting.envVar];

    if (workspaceValue !== undefined) {
      logger.log(
        `Note: Setting "${setting.name}" is already configured in the workspace scope.`,
      );
    }

    if (currentValue !== undefined) {
      const confirmed = await requestConfirmation(
        `Setting "${setting.name}" (${setting.envVar}) is already set. Overwrite?`,
      );

      if (!confirmed) {
        continue;
      }
    }

    await updateSetting(
      extensionConfig,
      extensionId,
      setting.envVar,
      requestSetting,
      scope,
      process.cwd(),
    );
  }
}

export function getFormattedSettingValue(
  setting: ResolvedExtensionSetting,
): string {
  if (!setting.value) {
    return '[not set]';
  }
  if (setting.sensitive) {
    return '***';
  }
  return setting.value;
}

```

### Core Architecture Module: `packages/cli/src/commands/hooks.tsx`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { migrateCommand } from './hooks/migrate.js';
import { initializeOutputListenersAndFlush } from '../gemini.js';

export const hooksCommand: CommandModule = {
  command: 'hooks <command>',
  aliases: ['hook'],
  describe: 'Manage Gemini CLI hooks.',
  builder: (yargs) =>
    yargs
      .middleware((argv) => {
        initializeOutputListenersAndFlush();
        argv['isCommand'] = true;
      })
      .command(migrateCommand)
      .demandCommand(1, 'You need at least one command before continuing.')
      .version(false),
  handler: () => {
    // This handler is not called when a subcommand is provided.
    // Yargs will show the help menu.
  },
};

```

### Core Architecture Module: `packages/cli/src/commands/hooks/migrate.ts`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { debugLogger, getErrorMessage } from '@google/gemini-cli-core';
import { loadSettings, SettingScope } from '../../config/settings.js';
import { exitCli } from '../utils.js';
import stripJsonComments from 'strip-json-comments';

interface MigrateArgs {
  fromClaude: boolean;
}

/**
 * Mapping from Claude Code event names to Gemini event names
 */
const EVENT_MAPPING: Record<string, string> = {
  PreToolUse: 'BeforeTool',
  PostToolUse: 'AfterTool',
  UserPromptSubmit: 'BeforeAgent',
  Stop: 'AfterAgent',
  SubAgentStop: 'AfterAgent', // Gemini doesn't have sub-agents, map to AfterAgent
  SessionStart: 'SessionStart',
  SessionEnd: 'SessionEnd',
  PreCompact: 'PreCompress',
  Notification: 'Notification',
};

/**
 * Mapping from Claude Code tool names to Gemini tool names
 */
const TOOL_NAME_MAPPING: Record<string, string> = {
  Edit: 'replace',
  Bash: 'run_shell_command',
  Read: 'read_file',
  Write: 'write_file',
  Glob: 'glob',
  Grep: 'grep',
  LS: 'ls',
};

/**
 * Transform a matcher regex to update tool names from Claude to Gemini
 */
function transformMatcher(matcher: string | undefined): string | undefined {
  if (!matcher) return matcher;

  let transformed = matcher;
  for (const [claudeName, geminiName] of Object.entries(TOOL_NAME_MAPPING)) {
    // Replace exact matches and matches within regex alternations
    transformed = transformed.replace(
      new RegExp(`\\b${claudeName}\\b`, 'g'),
      geminiName,
    );
  }

  return transformed;
}

/**
 * Migrate a Claude Code hook configuration to Gemini format
 */
function migrateClaudeHook(claudeHook: unknown): unknown {
  if (!claudeHook || typeof claudeHook !== 'object') {
    return claudeHook;
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  const hook = claudeHook as Record<string, unknown>;
  const migrated: Record<string, unknown> = {};

  // Map command field
  if ('command' in hook) {
    migrated['command'] = hook['command'];

    // Replace CLAUDE_PROJECT_DIR with GEMINI_PROJECT_DIR in command
    // eslint-disable-next-line no-restricted-syntax
    if (typeof migrated['command'] === 'string') {
      migrated['command'] = migrated['command'].replace(
        /\$CLAUDE_PROJECT_DIR/g,
        '$GEMINI_PROJECT_DIR',
      );
    }
  }

  // Map type field
  if ('type' in hook && hook['type'] === 'command') {
    migrated['type'] = 'command';
  }

  // Map timeout field (Claude uses seconds, Gemini uses seconds)
  // eslint-disable-next-line no-restricted-syntax
  if ('timeout' in hook && typeof hook['timeout'] === 'number') {
    migrated['timeout'] = hook['timeout'];
  }

  return migrated;
}

/**
 * Migrate Claude Code hooks configuration to Gemini format
 */
function migrateClaudeHooks(claudeConfig: unknown): Record<string, unknown> {
  if (!claudeConfig || typeof claudeConfig !== 'object') {
    return {};
  }

  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  const config = claudeConfig as Record<string, unknown>;
  const geminiHooks: Record<string, unknown> = {};

  // Check if there's a hooks section
  // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
  const hooksSection = config['hooks'] as Record<string, unknown> | undefined;
  if (!hooksSection || typeof hooksSection !== 'object') {
    return {};
  }

  for (const [eventName, eventConfig] of Object.entries(hooksSection)) {
    // Map event name
    const geminiEventName = EVENT_MAPPING[eventName] || eventName;

    if (!Array.isArray(eventConfig)) {
      continue;
    }

    // Migrate each hook definition
    const migratedDefinitions = eventConfig.map((def: unknown) => {
      if (!def || typeof def !== 'object') {
        return def;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      const definition = def as Record<string, unknown>;
      const migratedDef: Record<string, unknown> = {};

      // Transform matcher
      if (
        'matcher' in definition &&
        // eslint-disable-next-line no-restricted-syntax
        typeof definition['matcher'] === 'string'
      ) {
        migratedDef['matcher'] = transformMatcher(definition['matcher']);
      }

      // Copy sequential flag
      if ('sequential' in definition) {
        migratedDef['sequential'] = definition['sequential'];
      }

      // Migrate hooks array
      if ('hooks' in definition && Array.isArray(definition['hooks'])) {
        migratedDef['hooks'] = definition['hooks'].map(migrateClaudeHook);
      }

      return migratedDef;
    });

    geminiHooks[geminiEventName] = migratedDefinitions;
  }

  return geminiHooks;
}

/**
 * Handle migration from Claude Code
 */
export async function handleMigrateFromClaude() {
  const workingDir = process.cwd();

  // Look for Claude settings in .claude directory
  const claudeDir = path.join(workingDir, '.claude');
  const claudeSettingsPath = path.join(claudeDir, 'settings.json');
  const claudeLocalSettingsPath = path.join(claudeDir, 'settings.local.json');

  let claudeSettings: Record<string, unknown> | null = null;
  let sourceFile = '';

  // Try to read settings.local.json first, then settings.json
  if (fs.existsSync(claudeLocalSettingsPath)) {
    sourceFile = claudeLocalSettingsPath;
    try {
      const content = fs.readFileSync(claudeLocalSettingsPath, 'utf-8');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      claudeSettings = JSON.parse(stripJsonComments(content)) as Record<
        string,
        unknown
      >;
    } catch (error) {
      debugLogger.error(
        `Error reading ${claudeLocalSettingsPath}: ${getErrorMessage(error)}`,
      );
    }
  } else if (fs.existsSync(claudeSettingsPath)) {
    sourceFile = claudeSettingsPath;
    try {
      const content = fs.readFileSync(claudeSettingsPath, 'utf-8');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
      claudeSettings = JSON.parse(stripJsonComments(content)) as Record<
        string,
        unknown
      >;
    } catch (error) {
      debugLogger.error(
        `Error reading ${claudeSettingsPath}: ${getErrorMessage(error)}`,
      );
    }
  } else {
    debugLogger.error(
      'No Claude Code settings found in .claude directory. Expected settings.json or settings.local.json',
    );
    return;
  }

  if (!claudeSettings) {
    return;
  }

  debugLogger.log(`Found Claude Code settings in: ${sourceFile}`);

  // Migrate hooks
  const migratedHooks = migrateClaudeHooks(claudeSettings);

  if (Object.keys(migratedHooks).length === 0) {
    debugLogger.log('No hooks found in Claude Code settings to migrate.');
    return;
  }

  debugLogger.log(
    `Migrating ${Object.keys(migratedHooks).length} hook event(s)...`,
  );

  // Load current Gemini settings
  const settings = loadSettings(workingDir);

  // Merge migrated hooks with existing hooks
  const existingHooks = (settings.merged?.hooks || {}) as Record<
    string,
    unknown
  >;
  const mergedHooks = { ...existingHooks, ...migratedHooks };

  // Update settings (setValue automatically saves)
  try {
    settings.setValue(SettingScope.Workspace, 'hooks', mergedHooks);

    debugLogger.log('✓ Hooks successfully migrated to .gemini/settings.json');
    debugLogger.log(
      '\nMigration complete! Please review the migrated hooks in .gemini/settings.json',
    );
  } catch (error) {
    debugLogger.error(`Error saving migrated hooks: ${getErrorMessage(error)}`);
  }
}

export const migrateCommand: CommandModule = {
  command: 'migrate',
  describe: 'Migrate hooks from Claude Code to Gemini CLI',
  builder: (yargs) =>
    yargs.option('from-claude', {
      describe: 'Migrate from Claude Code hooks',
      type: 'boolean',
      default: false,
    }),
  handler: async (argv) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    const args = argv as unknown as MigrateArgs;
    if (args.fromClaude) {
      await handleMigrateFromClaude();
    } else {
      debugLogger.log(
        'Usage: gemini hooks migrate --from-claude\n\nMigrate hooks from Claude Code to Gemini CLI format.',
      );
    }
    await exitCli();
  },
};

```

### Core Architecture Module: `packages/cli/src/commands/utils.ts`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { runExitCleanup } from '../utils/cleanup.js';

export async function exitCli(exitCode = 0) {
  await runExitCleanup();
  process.exit(exitCode);
}

```

### Core Architecture Module: `packages/cli/src/core/auth.ts`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  type AuthType,
  type Config,
  getErrorMessage,
  ValidationRequiredError,
  isAccountSuspendedError,
  ProjectIdRequiredError,
} from '@google/gemini-cli-core';

import type { AccountSuspensionInfo } from '../ui/contexts/UIStateContext.js';

export interface InitialAuthResult {
  authError: string | null;
  accountSuspensionInfo: AccountSuspensionInfo | null;
}

/**
 * Handles the initial authentication flow.
 * @param config The application config.
 * @param authType The selected auth type.
 * @returns The auth result with error message and account suspension status.
 */
export async function performInitialAuth(
  config: Config,
  authType: AuthType | undefined,
): Promise<InitialAuthResult> {
  if (!authType) {
    return { authError: null, accountSuspensionInfo: null };
  }

  try {
    await config.refreshAuth(authType);
    // The console.log is intentionally left out here.
    // We can add a dedicated startup message later if needed.
  } catch (e) {
    if (e instanceof ValidationRequiredError) {
      // Don't treat validation required as a fatal auth error during startup.
      // This allows the React UI to load and show the ValidationDialog.
      return { authError: null, accountSuspensionInfo: null };
    }
    const suspendedError = isAccountSuspendedError(e);
    if (suspendedError) {
      return {
        authError: null,
        accountSuspensionInfo: {
          message: suspendedError.message,
          appealUrl: suspendedError.appealUrl,
          appealLinkText: suspendedError.appealLinkText,
        },
      };
    }
    if (e instanceof ProjectIdRequiredError) {
      // OAuth succeeded but account setup requires project ID
      // Show the error message directly without "Failed to login" prefix
      return {
        authError: getErrorMessage(e),
        accountSuspensionInfo: null,
      };
    }
    return {
      authError: `Failed to sign in. Message: ${getErrorMessage(e)}`,
      accountSuspensionInfo: null,
    };
  }

  return { authError: null, accountSuspensionInfo: null };
}

```

### Core Architecture Module: `packages/cli/src/core/initializer.ts`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  IdeClient,
  IdeConnectionEvent,
  IdeConnectionType,
  logIdeConnection,
  type Config,
  StartSessionEvent,
  logCliConfiguration,
  startupProfiler,
  debugLogger,
} from '@google/gemini-cli-core';
import { type LoadedSettings } from '../config/settings.js';
import { performInitialAuth } from './auth.js';
import { validateTheme } from './theme.js';
import type { AccountSuspensionInfo } from '../ui/contexts/UIStateContext.js';

export interface InitializationResult {
  authError: string | null;
  accountSuspensionInfo: AccountSuspensionInfo | null;
  themeError: string | null;
  shouldOpenAuthDialog: boolean;
  geminiMdFileCount: number;
}

/**
 * Orchestrates the application's startup initialization.
 * This runs BEFORE the React UI is rendered.
 * @param config The application config.
 * @param settings The loaded application settings.
 * @returns The results of the initialization.
 */
export async function initializeApp(
  config: Config,
  settings: LoadedSettings,
): Promise<InitializationResult> {
  const authHandle = startupProfiler.start('authenticate');
  const { authError, accountSuspensionInfo } = await performInitialAuth(
    config,
    settings.merged.security.auth.selectedType,
  );
  authHandle?.end();
  const themeError = validateTheme(settings);

  const shouldOpenAuthDialog =
    settings.merged.security.auth.selectedType === undefined || !!authError;

  logCliConfiguration(
    config,
    new StartSessionEvent(config, config.getToolRegistry()),
  );

  if (config.getIdeMode()) {
    IdeClient.getInstance()
      .then(async (ideClient) => {
        await ideClient.connect();
        logIdeConnection(
          config,
          new IdeConnectionEvent(IdeConnectionType.START),
        );
      })
      .catch((e) => {
        // We log locally if IDE connection setup fails in the background.
        debugLogger.error('Failed to initialize IDE client:', e);
      });
  }

  return {
    authError,
    accountSuspensionInfo,
    themeError,
    shouldOpenAuthDialog,
    geminiMdFileCount: config.getGeminiMdFileCount(),
  };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #29637** (2026-10-05): **chore(deps): bump @grpc/grpc-js from 1.14.4 to 1.14.5 in /tools/caretaker-agent/cloudrun/ingestion-service**
  *Symptoms*: Bumps [@grpc/grpc-js](https://github.com/grpc/grpc-node) from 1.14.4 to 1.14.5. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/grpc/grpc-node/releases">@​grpc/grpc-js's releases</a>.</em></p> <blockquote> <h2><code>@​grpc/grpc-js</code> 1.14.5</h2> <ul> <li>Fix a bug that caused clients to automatically transmit excessive error details to clients by default (<a href="https://github.com/grpc/grpc-node/security/advisories/GHSA-f596-whhp-79r4">advisory GHSA-f596-whhp-79r4</a>)</li> <li>Fix a bug that caused <code>getAuthContext</code> to return unverified certificates as though they were verified in some configurations (<a href="https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j">advisory GHSA-m9gg-hp2v-232j</a>)</li> <li>Fix a bug that could cause stale call data to accumulate if a channel failed to connect for a long period of time (<a href="https://redirect.github.com/grpc/grpc-node/issues/3078">#3078</a>)</li> <li>Fix a bug that could cause call status to be reported with expected fields missing (<a href="https://redirect.github.com/grpc/grpc-node/issues/3079">#3079</a>)</li> <li>Avoid redundant end() calls on completed HTTP/2 streams (<a href="https://redirect.github.com/grpc/grpc-node/issues/3082">#3082</a> contributed by <a href="https://github.com/olavloite"><code>@​olavloite</code></a>)</li> <li>Unify call numbers and avoid disabled trace allocations (<a href="https://redirect.github.com/grpc/grpc-node/i
  **Post-Mortem & Fix Analysis**:
  > You already have 7 pull requests open. Please work on getting existing PRs merged before opening more.
  > 📊 PR Size: **size/XS** - Lines changed: **4** - Additions: +3 - Deletions: -1 - Files changed: 1
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`. You can also ignore all major, minor, or patch releases for a dependency by adding an [`ignore` condition](https://docs.github.com/en/code-security/supply-chain-security/configuration-options-for-dependency-updates#ignore) with the desired `update_types` to your config file.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #29636** (2026-10-05): **chore(deps): bump ip-address from 10.2.0 to 10.7.3**
  *Symptoms*: Bumps [ip-address](https://github.com/beaugunderson/ip-address) from 10.2.0 to 10.7.3. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/beaugunderson/ip-address/releases">ip-address's releases</a>.</em></p> <blockquote> <h2>v10.7.3</h2> <h2>What's Changed</h2> <ul> <li>Reject an in-addr.arpa name longer than 32 characters before splitting it by <a href="https://github.com/beaugunderson"><code>@​beaugunderson</code></a> in <a href="https://redirect.github.com/beaugunderson/ip-address/pull/228">beaugunderson/ip-address#228</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/beaugunderson/ip-address/compare/v10.7.2...v10.7.3">https://github.com/beaugunderson/ip-address/compare/v10.7.2...v10.7.3</a></p> <h2>v10.7.2</h2> <h2>What's Changed</h2> <ul> <li>Accept an arpa suffix in any case and without the root dot in fromArpa by <a href="https://github.com/beaugunderson"><code>@​beaugunderson</code></a> in <a href="https://redirect.github.com/beaugunderson/ip-address/pull/227">beaugunderson/ip-address#227</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/beaugunderson/ip-address/compare/v10.7.1...v10.7.2">https://github.com/beaugunderson/ip-address/compare/v10.7.1...v10.7.2</a></p> <h2>v10.7.1</h2> <h2>What's Changed</h2> <ul> <li>Bump js-yaml and brace-expansion in the lockfile by <a href="https://github.com/beaugunderson"><code>@​beaugunderson</code></a> in <a href="https://redirect.gi
  **Post-Mortem & Fix Analysis**:
  > 📊 PR Size: **size/L** - Lines changed: **650** - Additions: +3 - Deletions: -647 - Files changed: 1
  > You already have 7 pull requests open. Please work on getting existing PRs merged before opening more.
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`. You can also ignore all major, minor, or patch releases for a dependency by adding an [`ignore` condition](https://docs.github.com/en/code-security/supply-chain-security/configuration-options-for-dependency-updates#ignore) with the desired `update_types` to your config file.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #29631** (2026-10-04): **chore(deps): bump @grpc/grpc-js from 1.14.3 to 1.14.5**
  *Symptoms*: Bumps [@grpc/grpc-js](https://github.com/grpc/grpc-node) from 1.14.3 to 1.14.5. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/grpc/grpc-node/releases">@​grpc/grpc-js's releases</a>.</em></p> <blockquote> <h2><code>@​grpc/grpc-js</code> 1.14.5</h2> <ul> <li>Fix a bug that caused clients to automatically transmit excessive error details to clients by default (<a href="https://github.com/grpc/grpc-node/security/advisories/GHSA-f596-whhp-79r4">advisory GHSA-f596-whhp-79r4</a>)</li> <li>Fix a bug that caused <code>getAuthContext</code> to return unverified certificates as though they were verified in some configurations (<a href="https://github.com/grpc/grpc-node/security/advisories/GHSA-m9gg-hp2v-232j">advisory GHSA-m9gg-hp2v-232j</a>)</li> <li>Fix a bug that could cause stale call data to accumulate if a channel failed to connect for a long period of time (<a href="https://redirect.github.com/grpc/grpc-node/issues/3078">#3078</a>)</li> <li>Fix a bug that could cause call status to be reported with expected fields missing (<a href="https://redirect.github.com/grpc/grpc-node/issues/3079">#3079</a>)</li> <li>Avoid redundant end() calls on completed HTTP/2 streams (<a href="https://redirect.github.com/grpc/grpc-node/issues/3082">#3082</a> contributed by <a href="https://github.com/olavloite"><code>@​olavloite</code></a>)</li> <li>Unify call numbers and avoid disabled trace allocations (<a href="https://redirect.github.com/grpc/grpc-node/i
  **Post-Mortem & Fix Analysis**:
  > 📊 PR Size: **size/L** - Lines changed: **654** - Additions: +5 - Deletions: -649 - Files changed: 2
  > You already have 7 pull requests open. Please work on getting existing PRs merged before opening more.
  > OK, I won't notify you again about this release, but will get in touch when a new version is available. If you'd rather skip all updates until the next major or minor version, let me know by commenting `@dependabot ignore this major version` or `@dependabot ignore this minor version`. You can also ignore all major, minor, or patch releases for a dependency by adding an [`ignore` condition](https://docs.github.com/en/code-security/supply-chain-security/configuration-options-for-dependency-updates#ignore) with the desired `update_types` to your config file.  If you change your mind, just re-open this PR and I'll resolve any conflicts on it.

- **Issue #29604** (2026-10-02): **fix(core): split custom headers only before a valid RFC 9110 token**
  *Symptoms*: ## Summary  `parseCustomHeaders` split `GEMINI_CLI_CUSTOM_HEADERS` on any comma followed by `<text>:` where `<text>` only had to exclude `,` and `:`. Header values that legitimately contain `,"name":` (JSON metadata, e.g. `x-portkey-metadata: {"_user":"alice","env":"prod"}`) or `, <url>` (multi-URL `Link` headers) were cut into a second "header" with an invalid name, and Node's `Headers` constructor then rejects the whole map (`TypeError: Headers.append: ""env"" is an invalid header name.`).  The split lookahead now requires an RFC 9110 token before the colon (`/,(?=\s*[\w!#$%&'*+.^`|~-]+\s*:)/`), so commas inside values are preserved while comma-separated header lists still parse exactly as before.  ## Details  - All 10 pre-existing `customHeaderUtils` test cases keep their expected results under the new regex (multi-header lists, values containing commas/colons, entries without a colon, whitespace trimming, empty entries). - The token character class covers exactly the RFC 9110 `tchar` set (ALPHA/DIGIT via `\w`, plus `!#$%&'*+.^_\`|~-`), so names like `Content-Type` still start a new header while `"env"`, `<https` and similar value fragments do not.  ## Related Issues  Fixes #29602  ## How to Validate  1. `npx vitest run packages/core/src/utils/customHeaderUtils.test.ts` — 14 tests pass (10 existing + 4 new regression tests: JSON metadata value with commas, multi-URL `Link` header, and a mixed case that must still split before a following real header). 2. The repro from the
  **Post-Mortem & Fix Analysis**:
  > Thanks for your pull request! It looks like this may be your first contribution to a Google open source project. Before we can look at your pull request, you'll need to sign a Contributor License Agreement (CLA).  View this [failed invocation](https://github.com/google-gemini/gemini-cli/pull/29604/checks?check_run_id=110721144680) of the CLA check for more information.  For the most up to date status, view the checks section at the bottom of the pull request.
  > ## Summary of Changes  Hello, I'm Gemini Code Assist[^1]! I'm currently reviewing this pull request and will post my feedback shortly. In the meantime, here's a summary to help you and other reviewers quickly get up to speed!  This pull request improves the robustness of custom header parsing by refining the logic used to split header strings. By enforcing stricter token validation before a colon, the utility now correctly handles complex header values containing commas, such as JSON metadata or multi-part Link headers, which previously caused parsing errors.  ### Highlights  * **Regex Update**: Updated the regex used in `parseCustomHeaders` to strictly require an RFC 9110 token before a colon when splitting headers, preventing incorrect splits on commas within JSON metadata or Link headers. * **Regression Testing**: Added four new test cases to `customHeaderUtils.test.ts` to ensure that JSON values and multi-URL Link headers are parsed correctly without being prematurely split.  <deta
  > 📊 PR Size: **size/S** - Lines changed: **30** - Additions: +28 - Deletions: -2 - Files changed: 2

- **Issue #29601** (2026-10-02): **Security research: workflow_run artifact chain PoC**
  *Symptoms*: ## Security Research  This is a benign proof-of-concept for a responsible disclosure. The only change is 3 `console.log` lines in `scripts/build.js` that print whether `GEMINI_API_KEY` and `GITHUB_TOKEN` are present in the process environment.  **No secrets are exfiltrated, logged, or transmitted.** The marker lines only print `YES` or `NO`.  ### What this tests  The `trigger_e2e.yml` → `chained_e2e.yml` workflow chain downloads a fork's repo name and SHA via artifacts, then checks out and executes the fork's code with secrets in the environment. This PR tests whether that chain fires for external fork PRs without manual approval gating.  ### Expected result if vulnerable  The `chained_e2e.yml` workflow runs, checks out this fork's code, and the build logs show: ``` [SECURITY-RESEARCH-POC] Fork code executed via workflow_run artifact chain [SECURITY-RESEARCH-POC] GEMINI_API_KEY in env: YES ```  I will close this PR promptly after verifying the workflow behavior and will file a report through Google's OSS VRP.
  **Post-Mortem & Fix Analysis**:
  > ## Summary of Changes  Hello, I'm Gemini Code Assist[^1]! I'm currently reviewing this pull request and will post my feedback shortly. In the meantime, here's a summary to help you and other reviewers quickly get up to speed!  This pull request serves as a proof-of-concept for security research regarding workflow_run artifact chains. The changes are intended to confirm whether external fork code can execute in a privileged CI environment by logging specific markers during the build process, facilitating a responsible disclosure report.  ### Highlights  * **Security Research PoC**: Added benign console logs to scripts/build.js to verify if fork code executes within a privileged CI environment. * **Environment Variable Check**: Implemented checks to report the presence of GEMINI_API_KEY and GITHUB_TOKEN in the process environment without exposing their values.  <details> <summary><b>Using Gemini Code Assist</b></summary> <br>  The full guide for Gemini Code Assist can be found on our [do
  > Thanks for your pull request! It looks like this may be your first contribution to a Google open source project. Before we can look at your pull request, you'll need to sign a Contributor License Agreement (CLA).  View this [failed invocation](https://github.com/google-gemini/gemini-cli/pull/29601/checks?check_run_id=110703309824) of the CLA check for more information.  For the most up to date status, view the checks section at the bottom of the pull request.
  > 📊 PR Size: **size/XS** - Lines changed: **5** - Additions: +5 - Deletions: -0 - Files changed: 1

- **Issue #29586** (2026-10-01): **fix(cli): ensure Ctrl+C emergency abort reaches cancellation handler during active operations**
  *Symptoms*: ## Summary  Fixes critical input handling flaws where emergency stop (`Ctrl+C`) could be swallowed or corrupted during active operations, denying users the ability to interrupt running agents or streams (b/561556027).  ## Details  1. **`Ctrl+C` Propagation During Active Operations:** In `InputPrompt.tsx`, `buffer.handleInput(key)` was matching `Command.CLEAR_INPUT` and returning `true` when text was present in the prompt buffer, prematurely terminating keypress broadcasting before `AppContainer.tsx` could call `cancelOngoingRequest()`. We now allow `Command.QUIT` (`Ctrl+C`) to propagate when `isGenerating` is true so that ongoing requests are immediately cancelled. 2. **SGR Mouse Parser Timeout & Interrupt Safety:** In `KeypressContext.tsx`, `while (ch === '' || ch === ';' || ...)` unconditionally appended incoming characters to the mouse sequence. During timeouts or broken sequences, incoming control keys like `\x03` (`Ctrl+C`) were appended to `sequence` (`\x1b[<0;10;\x03`) and emitted as `{ name: 'undefined', ctrl: false }`. We now avoid appending non-mouse characters to the sequence and immediately dispatch `\x03` as a clean `{ name: 'c', ctrl: true }` keypress event. 3. **Comprehensive Test Coverage:**    - Added `packages/cli/src/ui/emergency-stop.test.tsx` verifying Ctrl+C propagation during generation and SGR mouse timeout interrupt handling.    - Added unit test in `packages/cli/src/ui/components/InputPrompt.test.tsx` verifying Ctrl+C reaches global cancell
  **Post-Mortem & Fix Analysis**:
  > 📊 PR Size: **size/M** - Lines changed: **249** - Additions: +248 - Deletions: -1 - Files changed: 5
  > ## Summary of Changes  Hello, I'm Gemini Code Assist[^1]! I'm currently reviewing this pull request and will post my feedback shortly. In the meantime, here's a summary to help you and other reviewers quickly get up to speed!  This pull request addresses critical input handling issues where emergency stop commands (Ctrl+C) were occasionally ignored or corrupted during active operations. By refining the key propagation logic in the input prompt and improving the robustness of the SGR mouse sequence parser, the changes ensure that users can reliably interrupt ongoing requests or streams regardless of the current UI state.  ### Highlights  * **Ctrl+C Propagation**: Modified InputPrompt to allow Ctrl+C (QUIT) to propagate to global cancellation handlers during active generation, preventing it from being swallowed by the input buffer. * **SGR Mouse Parser Robustness**: Updated the SGR mouse sequence parser to avoid appending non-mouse characters and to explicitly handle Ctrl+C interrupts, e
  > /Gemini review

- **Issue #29585** (2026-09-30): **[VRP PoC - do not merge] benign CI runner identity check (whoami only)**
  *Symptoms*: ⚠️ **Security research proof-of-concept — please do NOT merge.**  This PR is part of a Google VRP (OSS VRP) report. The added postinstall script only prints the CI runner identity (`whoami`/`hostname`) and whether `GEMINI_API_KEY` is present (never its value). No data is exfiltrated, no artifacts or secrets are modified.  If a maintainer could approve the pending workflow runs (Trigger E2E / Testing: CI), the E2E (Chained) run will show the `[POC] whoami => ...` lines in the `Install dependencies` step log — that is the evidence we need. The PR will be closed immediately afterwards. Thanks!
  **Post-Mortem & Fix Analysis**:
  > Thanks for your pull request! It looks like this may be your first contribution to a Google open source project. Before we can look at your pull request, you'll need to sign a Contributor License Agreement (CLA).  View this [failed invocation](https://github.com/google-gemini/gemini-cli/pull/29585/checks?check_run_id=110113827215) of the CLA check for more information.  For the most up to date status, view the checks section at the bottom of the pull request.
  > ## Summary of Changes  Hello, I'm Gemini Code Assist[^1]! I'm currently reviewing this pull request and will post my feedback shortly. In the meantime, here's a summary to help you and other reviewers quickly get up to speed!  This pull request introduces a diagnostic utility designed to improve observability for self-hosted CI runners. By logging environment details such as the current user and hostname upon package installation, it provides essential context for troubleshooting environment-specific configuration issues.  ### Highlights  * **CI Debugging Utility**: Added a new diagnostic script to capture and log the identity and hostname of the CI runner. * **Lifecycle Hook Integration**: Updated package.json to trigger the diagnostic script automatically during the postinstall phase.  <details> <summary><b>Using Gemini Code Assist</b></summary> <br>  The full guide for Gemini Code Assist can be found on our [documentation page](https://developers.google.com/gemini-code-assist/docs/r
  > 📊 PR Size: **size/XS** - Lines changed: **7** - Additions: +6 - Deletions: -1 - Files changed: 2

- **Issue #29581** (2026-10-01): **fix(cli): resolve @file:line references and prevent ghost text wrap hang**
  *Symptoms*:  ## Summary  Fixes CLI hangs and resolution failures when referencing files with trailing line numbers or line ranges (e.g., `@file:10`, `@file:10-20`, `@file#L10-L25`), and prevents an infinite loop in `InputPrompt` ghost text wrapping when terminal width is narrow or contains wide characters.  ## Details  - **Line & Range Suffix Stripping (`@google/gemini-cli-core`)**:   - Added and exported `stripLineNumberSuffix` in `packages/core/src/utils/atCommandUtils.ts` to strip trailing `:line`, `:start-end`, `:line:col`, `:line:col-line:col`, `#L10`, `#L10-L25`, `#L10-25`, and `#L10-#L25` suffixes when the literal path does not exist on disk.   - Updated `resolveAtCommandPath` (for both relative and absolute paths) and `tryExtractPath` to resolve the base file path when `fs.stat` fails with `ENOENT` on a suffixed `@file` token. - **Ignore & Glob Fallback Handling (`@google/gemini-cli`)**:   - Updated `checkPermissions`, `.gitignore`/`.geminiignore` filtering (`shouldIgnoreFile`), and the fallback `glob` pattern in `packages/cli/src/ui/hooks/atCommandProcessor.ts` to use `stripLineNumberSuffix(pathName) ?? pathName`. This ensures `@file:line` respects ignore rules and avoids triggering an expensive recursive `**/*file:line*` glob scan across workspace directories. - **Ghost Text Wrapping Safeguard (`@google/gemini-cli`)**:   - Guarded `getGhostTextLines` in `packages/cli/src/ui/components/InputPrompt.tsx` against `inputWidth <= 0` and ensured the hard-wrap loop (`while
  **Post-Mortem & Fix Analysis**:
  > 📊 PR Size: **size/L** - Lines changed: **250** - Additions: +231 - Deletions: -19 - Files changed: 6
  > ## Summary of Changes  Hello, I'm Gemini Code Assist[^1]! I'm currently reviewing this pull request and will post my feedback shortly. In the meantime, here's a summary to help you and other reviewers quickly get up to speed!  This pull request improves the robustness of the CLI's file resolution logic and UI rendering. It addresses issues where file references with line or range suffixes failed to resolve correctly, and it fixes a potential hang in the input prompt's ghost text wrapping logic under constrained terminal conditions.  ### Highlights  * **File Reference Resolution**: Implemented `stripLineNumberSuffix` to correctly resolve file paths containing line numbers, ranges, or GitHub-style line references (e.g., @file:10, @file#L10-L25) when the direct path does not exist on disk. * **Glob Search Optimization**: Updated path processing to use the base file path for ignore-rule filtering and glob pattern generation, preventing expensive recursive scans when referencing specific li

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

### Incident Patch 1: `fb972b2f` (2026-10-02)
**Commit Message**: fix(cli): ensure Enter and Spacebar reliably confirm selection list options (#29502)

Co-authored-by: David Pierce <[REDACTED_EMAIL]>

**File**: `packages/cli/src/ui/components/AskUserDialog.test.tsx` (modified, +33/-0)
```diff
@@ -70,6 +70,14 @@ describe('AskUserDialog', () => {
       },
       expectedSubmit: { '0': 'OAuth 2.0' },
     },
+    {
+      name: 'Single Select with Spacebar',
+      questions: authQuestion,
+      actions: (stdin: { write: (data: string) => void }) => {
+        writeKey(stdin, ' ');
+      },
+      expectedSubmit: { '0': 'OAuth 2.0' },
+    },
     {
       name: 'Multi-select',
       questions: [
@@ -95,6 +103,31 @@ describe('AskUserDialog', () => {
       },
       expectedSubmit: { '0': 'TypeScript, ESLint' },
     },
+    {
+      name: 'Multi-select with Spacebar',
+      questions: [
+        {
+          question: 'Which features?',
+          header: 'Features',
+          type: QuestionType.CHOICE,
+          options: [
+            { label: 'TypeScript', description: '' },
+            { label: 'ESLint', description: '' },
+          ],
+          multiSelect: true,
+        },
+      ] as Question[],
+      actions: (stdin: { write: (data: string) => void }) => {
+        writeKey(stdin, ' '); // Toggle TS with Spacebar
+        writeKey(stdin, '\x1b[B'); // Down
+        writeKey(stdin, ' '); // Toggle ESLint with Spacebar
+        writeKey(stdin, '\x1b[B'); // Down to All of the above
+        writeKey(stdin, '\x1b[B'); // Down to Other
+        writeKey(stdin, '\x1b[B'); // Down to Done
+        writeKey(stdin, ' '); // Done with Spacebar
+      },
+      expectedSubmit: { '0': 'TypeScript, ESLint' },
+    },
     {
       name: 'All of the above',
       questions: [
```

**File**: `packages/cli/src/ui/components/AskUserDialog.tsx` (modified, +7/-1)
```diff
@@ -690,7 +690,12 @@ const ChoiceQuestionView: React.FC<ChoiceQuestionViewProps> = ({
         keyMatchers[Command.MOVE_RIGHT](key) ||
         keyMatchers[Command.RETURN](key) ||
         keyMatchers[Command.ESCAPE](key) ||
-        keyMatchers[Command.QUIT](key)
+        keyMatchers[Command.QUIT](key) ||
+        ((key.name === 'space' || key.sequence === ' ') &&
+          !key.ctrl &&
+          !key.alt &&
+          !key.shift &&
+          !key.cmd)
       ) {
         return false;
       }
@@ -916,6 +921,7 @@ const ChoiceQuestionView: React.FC<ChoiceQuestionViewProps> = ({
         onSelect={handleSelect}
         onHighlight={handleHighlight}
         focusKey={isCustomOptionFocused ? 'other' : undefined}
+        priority={!isCustomOptionFocused}
         maxItemsToShow={maxItemsToShow}
         showScrollArrows={true}
         renderItem={(item, context) => {
```

**File**: `packages/cli/src/ui/components/Composer.test.tsx` (modified, +24/-0)
```diff
@@ -51,6 +51,7 @@ vi.mock('../hooks/useTerminalSize.js', () => ({
 const composerTestControls = vi.hoisted(() => ({
   suggestionsVisible: false,
   isAlternateBuffer: false,
+  lastInputPromptFocus: undefined as boolean | undefined,
 }));
 
 // Mock child components
@@ -104,11 +105,14 @@ vi.mock('./DetailedMessagesDisplay.js', () => ({
 vi.mock('./InputPrompt.js', () => ({
   InputPrompt: ({
     placeholder,
+    focus,
     onSuggestionsVisibilityChange,
   }: {
     placeholder?: string;
+    focus?: boolean;
     onSuggestionsVisibilityChange?: (visible: boolean) => void;
   }) => {
+    composerTestControls.lastInputPromptFocus = focus;
     useEffect(() => {
       onSuggestionsVisibilityChange?.(composerTestControls.suggestionsVisible);
     }, [onSuggestionsVisibilityChange]);
@@ -680,6 +684,26 @@ describe('Composer', () => {
       const { lastFrame } = await renderComposer(uiState);
 
       expect(lastFrame()).toContain('InputPrompt');
+      expect(composerTestControls.lastInputPromptFocus).toBe(true);
+    });
+
+    it('unfocuses InputPrompt when an action is required and collapseDrawerDuringApproval is false', async () => {
+      const uiState = createMockUIState({
+        isInputActive: true,
+        customDialog: (
+          <Box>
+            <Text>Test Dialog</Text>
+          </Box>
+        ),
+      });
+      const settings = createMockSettings({
+        ui: { collapseDrawerDuringApproval: false },
+      });
+
+      const { lastFrame } = await renderComposer(uiState, settings);
+
+      expect(lastFrame()).toContain('InputPrompt');
+      expect(composerTestControls.lastInputPromptFocus).toBe(false);
     });
 
     it('does not render InputPrompt when input is inactive', async () => {
```

**File**: `packages/cli/src/ui/components/Composer.tsx` (modified, +1/-1)
```diff
@@ -155,7 +155,7 @@ export const Composer = ({ isFocused = true }: { isFocused?: boolean }) => {
           setShellModeActive={uiActions.setShellModeActive}
           approvalMode={uiState.showApprovalModeIndicator}
           onEscapePromptChange={uiActions.onEscapePromptChange}
-          focus={isFocused}
+          focus={isFocused && !hasPendingActionRequired}
           vimHandleInput={uiActions.vimHandleInput}
           vimEnabled={vimEnabled}
           vimMode={vimMode}
```

**File**: `packages/cli/src/ui/components/InputPrompt.test.tsx` (modified, +4/-9)
```diff
@@ -2108,7 +2108,7 @@ describe('InputPrompt', () => {
   });
 
   describe('unfocused paste', () => {
-    it('should handle bracketed paste when not focused', async () => {
+    it('should ignore bracketed paste when not focused', async () => {
       props.focus = false;
       const { stdin, unmount } = await renderWithProviders(
         <TestInputPrompt {...props} />,
@@ -2117,14 +2117,9 @@ describe('InputPrompt', () => {
       await act(async () => {
         stdin.write('\x1B[200~pasted text\x1B[201~');
       });
-      await waitFor(() => {
-        expect(mockBuffer.handleInput).toHaveBeenCalledWith(
-          expect.objectContaining({
-            name: 'paste',
-            sequence: 'pasted text',
-          }),
-        );
-      });
+      await waitFor(() => {});
+
+      expect(mockBuffer.handleInput).not.toHaveBeenCalled();
       unmount();
     });
 
```

**File**: `packages/cli/src/ui/components/InputPrompt.tsx` (modified, +5/-9)
```diff
@@ -684,6 +684,10 @@ export const InputPrompt: React.FC<InputPromptProps> = ({
 
   const handleInput = useCallback(
     (key: Key) => {
+      if (!focus) {
+        return false;
+      }
+
       if (handleVoiceInput(key)) return true;
 
       // Determine if this keypress is a history navigation command
@@ -733,14 +737,6 @@ export const InputPrompt: React.FC<InputPromptProps> = ({
         }
       }
 
-      // TODO(jacobr): this special case is likely not needed anymore.
-      // We should probably stop supporting paste if the InputPrompt is not
-      // focused.
-      /// We want to handle paste even when not focused to support drag and drop.
-      if (!focus && key.name !== 'paste') {
-        return false;
-      }
-
       // Handle escape to close shortcuts panel first, before letting it bubble
       // up for cancellation. This ensures pressing Escape once closes the panel,
       // and pressing again cancels the operation.
@@ -1426,7 +1422,7 @@ export const InputPrompt: React.FC<InputPromptProps> = ({
     ],
   );
   useKeypress(handleInput, {
-    isActive: !isEmbeddedShellFocused && !copyModeEnabled,
+    isActive: focus && !isEmbeddedShellFocused && !copyModeEnabled,
     priority: true,
   });
 
```

**File**: `packages/cli/src/ui/components/messages/ToolConfirmationMessage.tsx` (modified, +1/-0)
```diff
@@ -1097,6 +1097,7 @@ export const ToolConfirmationMessage: React.FC<
               onSelect={handleSelect}
               isFocused={isFocused}
               initialIndex={initialIndex}
+              priority={isFocused}
               renderItem={renderRadioItem}
             />
           </Box>
```

**File**: `packages/cli/src/ui/components/shared/SearchableList.test.tsx` (modified, +16/-0)
```diff
@@ -162,6 +162,22 @@ describe('SearchableList', () => {
     });
   });
 
+  it('should allow typing spaces in search query without triggering selection', async () => {
+    const { lastFrame, stdin } = await renderList();
+
+    await React.act(async () => {
+      stdin.write('Item Two');
+    });
+
+    await waitFor(() => {
+      const frame = lastFrame();
+      expect(frame).toContain('Item Two');
+      expect(frame).not.toContain('Item One');
+      expect(frame).not.toContain('Item Three');
+    });
+    expect(mockOnSelect).not.toHaveBeenCalled();
+  });
+
   it('should show "No items found." when no items match', async () => {
     const { lastFrame, stdin } = await renderList();
 
```

---

### Incident Patch 2: `c9096a84` (2026-10-01)
**Commit Message**: fix(cli): preserve scroll position and partition pending height budget (#29520)

**File**: `packages/cli/src/ui/AppContainer.test.tsx` (modified, +41/-0)
```diff
@@ -3545,6 +3545,47 @@ describe('AppContainer State Management', () => {
 
       unmount();
     });
+
+    it('does not collapse unconstrained height on navigation keys, but collapses on Escape', async () => {
+      const { stdin, unmount } = await act(async () => renderAppContainer());
+      await waitFor(() => expect(capturedOverflowActions).toBeTruthy());
+
+      expect(capturedUIState.constrainHeight).toBe(true);
+
+      // Expand via Ctrl+O
+      act(() => {
+        stdin.write('\x0f');
+      });
+      expect(capturedUIState.constrainHeight).toBe(false);
+
+      mocks.mockStdout.write.mockClear();
+
+      // Simulate PageUp and Up Arrow navigation keys
+      act(() => {
+        stdin.write('\x1b[5~');
+        stdin.write('\x1b[A');
+      });
+
+      // Should remain expanded and not clear terminal
+      expect(capturedUIState.constrainHeight).toBe(false);
+      expect(mocks.mockStdout.write).not.toHaveBeenCalledWith(
+        ansiEscapes.clearTerminal,
+      );
+
+      // Simulate Escape key to exit expanded view
+      act(() => {
+        stdin.write('\x1b');
+      });
+      act(() => {
+        vi.advanceTimersByTime(100);
+      });
+
+      await waitFor(() => {
+        expect(capturedUIState.constrainHeight).toBe(true);
+      });
+
+      unmount();
+    });
   });
 
   describe('Permission Handling', () => {
```

**File**: `packages/cli/src/ui/AppContainer.tsx` (modified, +45/-44)
```diff
@@ -1786,6 +1786,43 @@ Logging in with Google... Restarting Gemini CLI to continue.
     [handleSlashCommand, settings],
   );
 
+  const isAwaitingLoginRestart = authState === AuthState.AwaitingLoginRestart;
+  const loginRestartMessage =
+    settings.merged.security.auth.selectedType === AuthType.USE_VERTEX_AI
+      ? 'Authenticating to Vertex AI in Cloud Shell requires a restart to apply project settings.'
+      : undefined;
+
+  const dialogsVisible =
+    shouldShowIdePrompt ||
+    isFolderTrustDialogOpen ||
+    isPolicyUpdateDialogOpen ||
+    adminSettingsChanged ||
+    !!commandConfirmationRequest ||
+    !!authConsentRequest ||
+    !!permissionConfirmationRequest ||
+    !!customDialog ||
+    confirmUpdateExtensionRequests.length > 0 ||
+    !!loopDetectionConfirmationRequest ||
+    isThemeDialogOpen ||
+    isSettingsDialogOpen ||
+    isModelDialogOpen ||
+    isVoiceModelDialogOpen ||
+    isAgentConfigDialogOpen ||
+    isPermissionsDialogOpen ||
+    isAuthenticating ||
+    isAuthDialogOpen ||
+    isEditorDialogOpen ||
+    showPrivacyNotice ||
+    showIdeRestartPrompt ||
+    !!proQuotaRequest ||
+    !!validationRequest ||
+    !!overageMenuRequest ||
+    !!emptyWalletRequest ||
+    isSessionBrowserOpen ||
+    authState === AuthState.AwaitingApiKeyInput ||
+    isAwaitingLoginRestart ||
+    !!newAgents;
+
   const handleGlobalKeypress = useCallback(
     (key: Key): boolean => {
       // Debug log keystrokes if enabled
@@ -1877,16 +1914,19 @@ Logging in with Google... Restarting Gemini CLI to continue.
         }
       };
 
-      let enteringConstrainHeightMode = false;
-      if (!constrainHeight) {
-        enteringConstrainHeightMode = true;
+      if (
+        !constrainHeight &&
+        (keyMatchers[Command.SHOW_MORE_LINES](key) ||
+          (keyMatchers[Command.ESCAPE](key) && !dialogsVisible))
+      ) {
         setConstrainHeight(true);
         if (keyMatchers[Command.SHOW_MORE_LINES](key)) {
           toggleLastTurnTools();
         }
         if (!isAlternateBuffer) {
           refreshStatic();
         }
+        return true;
       }
 
       if (keyMatchers[Command.SHOW_ERROR_DETAILS](key)) {
@@ -1925,10 +1965,7 @@ Logging in with Google... Restarting Gemini CLI to continue.
         // eslint-disable-next-line @typescript-eslint/no-floating-promises
         handleSlashCommand('/ide status');
         return true;
-      } else if (
-        keyMatchers[Command.SHOW_MORE_LINES](key) &&
-        !enteringConstrainHeightMode
-      ) {
+      } else if (keyMatchers[Command.SHOW_MORE_LINES](key)) {
         setConstrainHeight(false);
         toggleLastTurnTools();
         refreshStatic();
@@ -2043,6 +2080,7 @@ Logging in with Google... Restarting Gemini CLI to continue.
       startRecording,
       stopRecording,
       mouseMode,
+      dialogsVisible,
     ],
   );
 
@@ -2171,43 +2209,6 @@ Logging in with Google... Restarting Gemini CLI to continue.
 
   const nightly = props.version.includes('nightly');
 
-  const isAwaitingLoginRestart = authState === AuthState.AwaitingLoginRestart;
-  const loginRestartMessage =
-    settings.merged.security.auth.selectedType === AuthType.USE_VERTEX_AI
-      ? 'Authenticating to Vertex AI in Cloud Shell requires a restart to apply project settings.'
-      : undefined;
-
-  const dialogsVisible =
-    shouldShowIdePrompt ||
-    isFolderTrustDialogOpen ||
-    isPolicyUpdateDialogOpen ||
-    adminSettingsChanged ||
-    !!commandConfirmationRequest ||
-    !!authConsentRequest ||
-    !!permissionConfirmationRequest ||
-    !!customDialog ||
-    confirmUpdateExtensionRequests.length > 0 ||
-    !!loopDetectionConfirmationRequest ||
-    isThemeDialogOpen ||
-    isSettingsDialogOpen ||
-    isModelDialogOpen ||
-    isVoiceModelDialogOpen ||
-    isAgentConfigDialogOpen ||
-    isPermissionsDialogOpen ||
-    isAuthenticating ||
-    isAuthDialogOpen ||
-    isEditorDialogOpen ||
-    showPrivacyNotice ||
-    showIdeRestartPrompt ||
-    !!proQuotaRequest ||
-    !!validationRequest ||
-    !!overageMenuRequest ||
-    !!emptyWalletRequest ||
-    isSessionBrowserOpen ||
-    authState === AuthState.AwaitingApiKeyInput ||
-    isAwaitingLoginRestart ||
-    !!newAgents;
-
   const hasPendingToolConfirmation = useMemo(
     () => isToolAwaitingConfirmation(pendingHistoryItems),
     [pendingHistoryItems],
```

**File**: `packages/cli/src/ui/components/Composer.test.tsx` (modified, +48/-1)
```diff
@@ -24,7 +24,11 @@ import {
 } from '@google/gemini-cli-core';
 import type { Config } from '@google/gemini-cli-core';
 import { StreamingState } from '../types.js';
-import { TransientMessageType } from '../../utils/events.js';
+import {
+  appEvents,
+  AppEvent,
+  TransientMessageType,
+} from '../../utils/events.js';
 import type { LoadedSettings } from '../../config/settings.js';
 import type { SessionMetrics } from '../contexts/SessionContext.js';
 import type { TextBuffer } from './shared/text-buffer.js';
@@ -485,6 +489,49 @@ describe('Composer', () => {
       expect(output).toBe('');
     });
 
+    it('does not emit AppEvent.ScrollToBottom when a tool confirmation is pending', async () => {
+      const emitSpy = vi.spyOn(appEvents, 'emit');
+      const uiState = createMockUIState({
+        streamingState: StreamingState.Responding,
+        pendingHistoryItems: [
+          {
+            type: 'tool_group',
+            tools: [
+              {
+                callId: 'call-scroll-1',
+                name: 'edit',
+                description: 'edit file',
+                status: CoreToolCallStatus.AwaitingApproval,
+                resultDisplay: undefined,
+                confirmationDetails: undefined,
+              },
+            ],
+          },
+        ],
+      });
+
+      const { unmount } = await renderComposer(uiState);
+
+      expect(emitSpy).not.toHaveBeenCalledWith(AppEvent.ScrollToBottom);
+      unmount();
+    });
+
+    it('emits AppEvent.ScrollToBottom when a non-tool action is required', async () => {
+      const emitSpy = vi.spyOn(appEvents, 'emit');
+      const uiState = createMockUIState({
+        customDialog: (
+          <Box>
+            <Text>Action Dialog</Text>
+          </Box>
+        ),
+      });
+
+      const { unmount } = await renderComposer(uiState);
+
+      expect(emitSpy).toHaveBeenCalledWith(AppEvent.ScrollToBottom);
+      unmount();
+    });
+
     it('renders LoadingIndicator when embedded shell is focused but background shell is visible', async () => {
       const uiState = createMockUIState({
         streamingState: StreamingState.Responding,
```

**File**: `packages/cli/src/ui/components/Composer.tsx` (modified, +7/-4)
```diff
@@ -48,8 +48,11 @@ export const Composer = ({ isFocused = true }: { isFocused?: boolean }) => {
   const hideContextSummary =
     suggestionsVisible && suggestionsPosition === 'above';
 
-  const { hasPendingActionRequired, shouldCollapseDuringApproval } =
-    useComposerStatus();
+  const {
+    hasPendingActionRequired,
+    hasPendingToolConfirmation,
+    shouldCollapseDuringApproval,
+  } = useComposerStatus();
 
   const isPassiveShortcutsHelpState =
     uiState.isInputActive &&
@@ -59,10 +62,10 @@ export const Composer = ({ isFocused = true }: { isFocused?: boolean }) => {
   const { setShortcutsHelpVisible } = uiActions;
 
   useEffect(() => {
-    if (hasPendingActionRequired) {
+    if (hasPendingActionRequired && !hasPendingToolConfirmation) {
       appEvents.emit(AppEvent.ScrollToBottom);
     }
-  }, [hasPendingActionRequired]);
+  }, [hasPendingActionRequired, hasPendingToolConfirmation]);
 
   useEffect(() => {
     if (uiState.shortcutsHelpVisible && !isPassiveShortcutsHelpState) {
```

**File**: `packages/cli/src/ui/components/MainContent.test.tsx` (modified, +279/-17)
```diff
@@ -9,13 +9,23 @@ import { createMockSettings } from '../../test-utils/settings.js';
 import { makeFakeConfig, CoreToolCallStatus } from '@google/gemini-cli-core';
 import { waitFor } from '../../test-utils/async.js';
 import { MainContent } from './MainContent.js';
+import { Composer } from './Composer.js';
 import { getToolGroupBorderAppearance } from '../utils/borderStyles.js';
 import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
 import { Box, Text } from 'ink';
 import { act, useState, type JSX } from 'react';
 import { useAlternateBuffer } from '../hooks/useAlternateBuffer.js';
 import { SHELL_COMMAND_NAME } from '../constants.js';
 
+const scrollableListMocks = vi.hoisted(() => ({
+  scrollToEnd: vi.fn(),
+  getScrollState: vi.fn(() => ({
+    scrollTop: 80,
+    scrollHeight: 100,
+    innerHeight: 20,
+  })),
+}));
+
 vi.mock('@google/gemini-cli-core', async (importOriginal) => {
   const actual =
     await importOriginal<typeof import('@google/gemini-cli-core')>();
@@ -85,23 +95,40 @@ vi.mock('./AppHeader.js', () => ({
   ),
 }));
 
-vi.mock('./shared/ScrollableList.js', () => ({
-  ScrollableList: ({
-    data,
-    renderItem,
-  }: {
-    data: unknown[];
-    renderItem: (props: { item: unknown }) => JSX.Element;
-  }) => (
-    <Box flexDirection="column">
-      <Text>ScrollableList</Text>
-      {data.map((item: unknown, index: number) => (
-        <Box key={index}>{renderItem({ item })}</Box>
-      ))}
-    </Box>
-  ),
-  SCROLL_TO_ITEM_END: 0,
-}));
+vi.mock('./shared/ScrollableList.js', async () => {
+  const { forwardRef, useImperativeHandle } =
+    await vi.importActual<typeof import('react')>('react');
+  const ScrollableList = forwardRef(
+    (
+      {
+        data,
+        renderItem,
+      }: {
+        data: unknown[];
+        renderItem: (props: { item: unknown }) => JSX.Element;
+      },
+      ref,
+    ) => {
+      useImperativeHandle(ref, () => ({
+        scrollToEnd: scrollableListMocks.scrollToEnd,
+        getScrollState: scrollableListMocks.getScrollState,
+      }));
+      return (
+        <Box flexDirection="column">
+          <Text>ScrollableList</Text>
+          {data.map((item: unknown, index: number) => (
+            <Box key={index}>{renderItem({ item })}</Box>
+          ))}
+        </Box>
+      );
+    },
+  );
+  ScrollableList.displayName = 'ScrollableList';
+  return {
+    ScrollableList,
+    SCROLL_TO_ITEM_END: 0,
+  };
+});
 
 import { theme } from '../semantic-colors.js';
 import { type BackgroundTask } from '../hooks/shellReducer.js';
@@ -929,4 +956,239 @@ describe('MainContent', () => {
       },
     );
   });
+
+  describe('Scroll position preservation and dynamic height partitioning', () => {
+    beforeEach(() => {
+      scrollableListMocks.scrollToEnd.mockClear();
+      scrollableListMocks.getScrollState.mockReset();
+      vi.mocked(useConfirmingTool).mockReturnValue(null);
+      mockUseSettings.mockReturnValue(
+        createMockSettings({
+          security: { enablePermanentToolApproval: true },
+          ui: { errorVerbosity: 'full' },
+        }),
+      );
+    });
+
+    it('calls scrollToEnd when tool confirmation arrives and user is at the bottom', async () => {
+      vi.mocked(useAlternateBuffer).mockReturnValue(true);
+      scrollableListMocks.getScrollState.mockReturnValue({
+        scrollTop: 80,
+        scrollHeight: 100,
+        innerHeight: 20,
+      });
+
+      const confirmingTool = {
+        tool: {
+          callId: 'call-bottom',
+          name: SHELL_COMMAND_NAME,
+          description: 'echo test',
+          status: CoreToolCallStatus.AwaitingApproval,
+          confirmationDetails: {
+            type: 'exec' as const,
+            title: 'Confirm Shell',
+            command: 'echo test',
+            rootCommand: 'echo',
+            rootCommands: ['echo'],
+          },
+        },
+        index: 1,
+        total: 1,
+      };
+      vi.mocked(useConfirmingTool).mockReturnValue(
+        confirmingTool as unknown as ConfirmingToolState,
+      );
+
+      const { unmount } = await renderWithProviders(<MainContent />, {
+        uiState: defaultMockUiState as Partial<UIState>,
+        config: makeFakeConfig({ useAlternateBuffer: true }),
+        settings: createMockSettings({ ui: { useAlternateBuffer: true } }),
+      });
+
+      expect(scrollableListMocks.getScrollState).toHaveBeenCalled();
+      expect(scrollableListMocks.scrollToEnd).toHaveBeenCalledTimes(1);
+      unmount();
+    });
+
+    it('preserves scroll position and does not call scrollToEnd when user has scrolled up', async () => {
+      vi.mocked(useAlternateBuffer).mockReturnValue(true);
+      scrollableListMocks.getScrollState.mockReturnValue({
+        scrollTop: 30,
+        scrollHeight: 100,
+        innerHeight: 20,
+      });
+
+      const confirmingTool = {
+        tool: {
+          callId: 'call-scrolled-up',
+          name: SHELL_COMMAND_NAME,
+          description: 'echo
```

**File**: `packages/cli/src/ui/components/MainContent.tsx` (modified, +121/-20)
```diff
@@ -5,8 +5,9 @@
  */
 
 import { Box, Static } from 'ink';
+import { CoreToolCallStatus } from '@google/gemini-cli-core';
 import { HistoryItemDisplay } from './HistoryItemDisplay.js';
-import { useUIState } from '../contexts/UIStateContext.js';
+import { UIStateContext, useUIState } from '../contexts/UIStateContext.js';
 import { useAppContext } from '../contexts/AppContext.js';
 import { AppHeader } from './AppHeader.js';
 
@@ -26,6 +27,32 @@ import { appEvents, AppEvent } from '../../utils/events.js';
 const MemoizedHistoryItemDisplay = memo(HistoryItemDisplay);
 const MemoizedAppHeader = memo(AppHeader);
 
+const ToolConfirmationQueueWithBudget = ({
+  confirmingTool,
+  budget,
+}: {
+  confirmingTool: Parameters<typeof ToolConfirmationQueue>[0]['confirmingTool'];
+  budget: number | undefined;
+}) => {
+  const uiState = useUIState();
+  const overriddenUiState = useMemo(
+    () => ({
+      ...uiState,
+      availableTerminalHeight: budget,
+    }),
+    [uiState, budget],
+  );
+
+  return (
+    <UIStateContext.Provider value={overriddenUiState}>
+      <ToolConfirmationQueue
+        key="confirmation-queue"
+        confirmingTool={confirmingTool}
+      />
+    </UIStateContext.Provider>
+  );
+};
+
 // Limit Gemini messages to a very high number of lines to mitigate performance
 // issues in the worst case if we somehow get an enormous response from Gemini.
 // This threshold is arbitrary but should be high enough to never impact normal
@@ -39,14 +66,23 @@ export const MainContent = () => {
   const isAlternateBuffer = config.getUseAlternateBuffer();
 
   const confirmingTool = useConfirmingTool();
-  const showConfirmationQueue = confirmingTool !== null;
+  const showConfirmationQueue = Boolean(confirmingTool);
   const confirmingToolCallId = confirmingTool?.tool.callId;
 
   const scrollableListRef = useRef<VirtualizedListRef<unknown>>(null);
 
   useEffect(() => {
-    if (showConfirmationQueue) {
-      scrollableListRef.current?.scrollToEnd();
+    if (showConfirmationQueue && scrollableListRef.current) {
+      const scrollState = scrollableListRef.current.getScrollState?.();
+      const isAtBottom = scrollState
+        ? scrollState.scrollHeight -
+            scrollState.innerHeight -
+            scrollState.scrollTop <=
+          1
+        : true;
+      if (isAtBottom) {
+        scrollableListRef.current.scrollToEnd();
+      }
     }
   }, [showConfirmationQueue, confirmingToolCallId]);
 
@@ -151,10 +187,75 @@ export const MainContent = () => {
     [historyItems, lastUserPromptIndex],
   );
 
-  const pendingItems = useMemo(
-    () => (
+  const pendingItems = useMemo(() => {
+    const hasConfirmationQueue = Boolean(
+      showConfirmationQueue && confirmingTool,
+    );
+    const isVisiblePendingItem = (item: (typeof pendingHistoryItems)[number]) =>
+      item.type !== 'tool_group' ||
+      item.tools.some((t) => t.status !== CoreToolCallStatus.AwaitingApproval);
+    const visiblePendingCount =
+      pendingHistoryItems.filter(isVisiblePendingItem).length;
+    const shouldPartitionHeight =
+      !isAlternateBufferOrTerminalBuffer &&
+      hasConfirmationQueue &&
+      visiblePendingCount > 0;
+    const pendingCount = Math.max(1, visiblePendingCount);
+
+    const rawPendingBudget =
+      availableTerminalHeight !== undefined
+        ? shouldPartitionHeight
+          ? Math.floor(availableTerminalHeight * 0.4)
+          : availableTerminalHeight
+        : undefined;
+
+    // In alternate buffer mode, we bypass partitioning the height because the list is
+    // scrollable and virtualized, allowing each item to use the full budget.
+    // Otherwise, we distribute the height budget among pending items using the
+    // Largest Remainder Method so all available space is utilized without overflowing.
+    const basePendingItemHeight =
+      rawPendingBudget !== undefined
+        ? Math.floor(rawPendingBudget / pendingCount)
+        : undefined;
+    const pendingHeightRemainder =
+      rawPendingBudget !== undefined ? rawPendingBudget % pendingCount : 0;
+    const perPendingItemHeights =
+      rawPendingBudget !== undefined && basePendingItemHeight !== undefined
+        ? Array.from({ length: pendingCount }, (_, index) =>
+            isAlternateBufferOrTerminalBuffer
+              ? rawPendingBudget
+              : Math.max(
+                  basePendingItemHeight +
+                    (index < pendingHeightRemainder ? 1 : 0),
+                  1,
+                ),
+          )
+        : undefined;
+    const totalAllocatedPendingHeight =
+      perPendingItemHeights !== undefined
+        ? perPendingItemHeights.reduce((sum, height) => sum + height, 0)
+        : 0;
+
+    // Calculate confirmationQueueBudget by subtracting the actual allocated pending height
+    // from availableTerminalHeight to prevent terminal overflows.
+    // We enforce a minimum height of 1 when partitioning to prevent overflows on small terminals.
+    const confirm
```

**File**: `packages/cli/src/ui/hooks/useComposerStatus.ts` (modified, +1/-0)
```diff
@@ -101,6 +101,7 @@ export const useComposerStatus = () => {
 
   return {
     hasPendingActionRequired,
+    hasPendingToolConfirmation,
     shouldCollapseDuringApproval,
     isInteractiveShellWaiting,
     showLoadingIndicator,
```

---

### Incident Patch 3: `a5cdfab7` (2026-10-01)
**Commit Message**: fix(acp): resolve session by exact id and handle listener cleanup on session failure (#29580)

Co-authored-by: gemini-code-assist[bot] <176961590+gemini-code-assist[bot]@users.noreply.github.com>

**File**: `packages/cli/src/acp/acpRpcDispatcher.test.ts` (modified, +12/-0)
```diff
@@ -336,4 +336,16 @@ describe('GeminiAgent - RPC Dispatcher', () => {
       }),
     ).rejects.toThrow('Session not found: unknown');
   });
+
+  it('should delegate dispose to sessionManager', async () => {
+    const disposeMock = vi.fn().mockResolvedValue(undefined);
+    (agent as unknown as { sessionManager: { dispose: Mock } }).sessionManager =
+      {
+        dispose: disposeMock,
+      };
+
+    await agent.dispose();
+
+    expect(disposeMock).toHaveBeenCalledTimes(1);
+  });
 });
```

**File**: `packages/cli/src/acp/acpRpcDispatcher.ts` (modified, +2/-2)
```diff
@@ -33,8 +33,8 @@ export class GeminiAgent {
     this.sessionManager = new AcpSessionManager(settings, argv, connection);
   }
 
-  dispose(): void {
-    this.sessionManager.dispose();
+  async dispose(): Promise<void> {
+    await this.sessionManager.dispose();
   }
 
   async initialize(
```

**File**: `packages/cli/src/acp/acpSession.test.ts` (modified, +14/-0)
```diff
@@ -1366,4 +1366,18 @@ describe('Session', () => {
       );
     });
   });
+
+  describe('dispose', () => {
+    it('should safely dispose without throwing when config.dispose is undefined', async () => {
+      delete (mockConfig as { dispose?: unknown }).dispose;
+      await expect(session.dispose()).resolves.toBeUndefined();
+    });
+
+    it('should catch rejection when config.dispose rejects', async () => {
+      mockConfig.dispose = vi
+        .fn()
+        .mockRejectedValue(new Error('Disposal failed'));
+      await expect(session.dispose()).resolves.toBeUndefined();
+    });
+  });
 });
```

**File**: `packages/cli/src/acp/acpSession.ts` (modified, +8/-1)
```diff
@@ -188,12 +188,19 @@ export class Session {
     }
   };
 
-  dispose(): void {
+  async dispose(): Promise<void> {
     coreEvents.off(
       CoreEvent.ApprovalModeChanged,
       this.handleApprovalModeChanged,
     );
     this.disposeController.abort();
+    if (this.context.config?.dispose) {
+      try {
+        await this.context.config.dispose();
+      } catch (err) {
+        debugLogger.error(`Error disposing config: ${err}`);
+      }
+    }
   }
 
   async cancelPendingPrompt(): Promise<void> {
```

**File**: `packages/cli/src/acp/acpSessionManager.test.ts` (modified, +319/-2)
```diff
@@ -15,13 +15,18 @@ import {
   type Mocked,
 } from 'vitest';
 import { AcpSessionManager } from './acpSessionManager.js';
-import type * as acp from '@agentclientprotocol/sdk';
+import * as fs from 'node:fs/promises';
+import * as path from 'node:path';
+import * as os from 'node:os';
+import * as acp from '@agentclientprotocol/sdk';
 import {
   AuthType,
   type Config,
+  CoreEvent,
+  coreEvents,
   GEMINI_MODEL_ALIAS_AUTO,
   type MessageBus,
-  type Storage,
+  Storage,
 } from '@google/gemini-cli-core';
 import type { LoadedSettings } from '../config/settings.js';
 import { loadCliConfig, type CliArgs } from '../config/config.js';
@@ -56,6 +61,7 @@ describe('AcpSessionManager', () => {
     mockConfig = {
       refreshAuth: vi.fn(),
       initialize: vi.fn(),
+      dispose: vi.fn(),
       waitForMcpInit: vi.fn(),
       getFileSystemService: vi.fn(),
       setFileSystemService: vi.fn(),
@@ -64,6 +70,8 @@ describe('AcpSessionManager', () => {
       getModel: vi.fn().mockReturnValue('gemini-pro'),
       getGeminiClient: vi.fn().mockReturnValue({
         startChat: vi.fn().mockResolvedValue({}),
+        resumeChat: vi.fn().mockResolvedValue(undefined),
+        getChat: vi.fn().mockReturnValue({}),
       }),
       getMessageBus: vi.fn().mockReturnValue({
         publish: vi.fn(),
@@ -379,4 +387,313 @@ describe('AcpSessionManager', () => {
 
     expect(startAutoMemoryIfEnabledMock).toHaveBeenCalledWith(mockConfig);
   });
+
+  it('should successfully load an ACP session created by newSession without resumable content filters', async () => {
+    const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'acp-load-test-'));
+    const sessionId = 'test-session-uuid-123';
+    const storage = new Storage(testDir, sessionId);
+    await storage.initialize();
+    const chatsDir = path.join(storage.getProjectTempDir(), 'chats');
+    await fs.mkdir(chatsDir, { recursive: true });
+
+    // Initial header written by ChatRecordingService on newSession (hasResumableContent is false)
+    const initialRecord = {
+      sessionId,
+      projectHash: 'test-hash',
+      startTime: new Date().toISOString(),
+      lastUpdated: new Date().toISOString(),
+      kind: 'main',
+      messages: [],
+    };
+    await fs.writeFile(
+      path.join(chatsDir, `session-2026-09-30-${sessionId.slice(0, 8)}.jsonl`),
+      JSON.stringify(initialRecord) + '\n',
+    );
+
+    const response = await manager.loadSession(
+      {
+        sessionId,
+        cwd: testDir,
+        mcpServers: [],
+      },
+      {},
+    );
+
+    expect(response).toBeDefined();
+    expect(response.modes).toBeDefined();
+    expect(response.models).toBeDefined();
+    expect(mockConfig.getGeminiClient().resumeChat).toHaveBeenCalledWith(
+      [],
+      expect.objectContaining({
+        conversation: expect.objectContaining({ sessionId }),
+      }),
+    );
+  });
+
+  it('should successfully load an ACP session with conversational content', async () => {
+    const testDir = await fs.mkdtemp(path.join(os.tmpdir(), 'acp-load-chat-'));
+    const sessionId = 'test-session-with-chat';
+    const storage = new Storage(testDir, sessionId);
+    await storage.initialize();
+    const chatsDir = path.join(storage.getProjectTempDir(), 'chats');
+    await fs.mkdir(chatsDir, { recursive: true });
+
+    const sessionRecord = {
+      sessionId,
+      projectHash: 'test-hash',
+      startTime: new Date().toISOString(),
+      lastUpdated: new Date().toISOString(),
+      kind: 'main',
+      messages: [
+        { type: 'user', content: 'hello' },
+        { type: 'gemini', content: 'world' },
+      ],
+    };
+    await fs.writeFile(
+      path.join(chatsDir, `session-2026-09-30-${sessionId.slice(0, 8)}.jsonl`),
+      JSON.stringify(sessionRecord) + '\n',
+    );
+
+    const response = await manager.loadSession(
+      {
+        sessionId,
+        cwd: testDir,
+        mcpServers: [],
+      },
+      {},
+    );
+
+    expect(response).toBeDefined();
+    expect(mockConfig.getGeminiClient().resumeChat).toHaveBeenCalled();
+  });
+
+  it('should reject loading an invalid session identifier without leaking event listeners', async () => {
+    const testDir = await fs.mkdtemp(
+      path.join(os.tmpdir(), 'acp-load-invalid-'),
+    );
+    const initialListenerCount = coreEvents.listenerCount(
+      CoreEvent.ModelChanged,
+    );
+
+    // Call loadSession with an invalid/non-existent session ID 15 times
+    for (let i = 0; i < 15; i++) {
+      await expect(
+        manager.loadSession(
+          {
+            sessionId: `non-existent-id-${i}`,
+            cwd: testDir,
+            mcpServers: [],
+          },
+          {},
+        ),
+      ).rejects.toThrow('Invalid session identifier');
+    }
+
+    // Verify no listeners were leaked
+    expect(coreEvents.listenerCount(CoreEvent.ModelChanged)).toBe(
+      initialListenerCount,
+    );
+  });
+
+  it('should reject loading a session identifier containing path t
```

**File**: `packages/cli/src/acp/acpSessionManager.ts` (modified, +204/-111)
```diff
@@ -12,6 +12,7 @@ import {
   startupProfiler,
   convertSessionToClientHistory,
   createPolicyUpdater,
+  Storage,
 } from '@google/gemini-cli-core';
 import * as acp from '@agentclientprotocol/sdk';
 import { randomUUID } from 'node:crypto';
@@ -48,10 +49,17 @@ export class AcpSessionManager {
     return this.sessions.get(sessionId);
   }
 
-  dispose(): void {
-    for (const session of this.sessions.values()) {
-      session.dispose();
-    }
+  async dispose(): Promise<void> {
+    const disposePromises = Array.from(this.sessions.entries()).map(
+      async ([sessionId, session]) => {
+        try {
+          await session.dispose();
+        } catch (err) {
+          debugLogger.error(`Error disposing session ${sessionId}: ${err}`);
+        }
+      },
+    );
+    await Promise.all(disposePromises);
     this.sessions.clear();
   }
 
@@ -103,135 +111,206 @@ export class AcpSessionManager {
     }
 
     if (!isAuthenticated) {
+      try {
+        await config?.dispose?.();
+      } catch (disposeError) {
+        debugLogger.error(`Error disposing config: ${disposeError}`);
+      }
       throw new acp.RequestError(
         -32000,
         authErrorMessage || 'Authentication required.',
       );
     }
 
-    if (this.clientCapabilities?.fs) {
-      const acpFileSystemService = new AcpFileSystemService(
-        this.connection,
-        sessionId,
-        this.clientCapabilities.fs,
-        config.getFileSystemService(),
-        cwd,
-      );
-      config.setFileSystemService(acpFileSystemService);
-    }
+    let session: Session | undefined;
+    try {
+      if (this.clientCapabilities?.fs) {
+        const acpFileSystemService = new AcpFileSystemService(
+          this.connection,
+          sessionId,
+          this.clientCapabilities.fs,
+          config.getFileSystemService(),
+          cwd,
+        );
+        config.setFileSystemService(acpFileSystemService);
+      }
 
-    await config.initialize();
-    startupProfiler.flush(config);
-    startAutoMemoryIfEnabled(config);
+      await config.initialize();
+      startupProfiler.flush(config);
+      startAutoMemoryIfEnabled(config);
 
-    const geminiClient = config.getGeminiClient();
+      const geminiClient = config.getGeminiClient();
 
-    const chat = geminiClient.isInitialized?.()
-      ? geminiClient.getChat()
-      : await geminiClient.startChat();
+      const chat = geminiClient.isInitialized?.()
+        ? geminiClient.getChat()
+        : await geminiClient.startChat();
 
-    const session = new Session(
-      sessionId,
-      chat,
-      config,
-      this.connection,
-      this.settings,
-    );
-    this.sessions.set(sessionId, session);
-
-    setTimeout(() => {
-      // eslint-disable-next-line @typescript-eslint/no-floating-promises
-      session.sendAvailableCommands();
-    }, 0);
+      session = new Session(
+        sessionId,
+        chat,
+        config,
+        this.connection,
+        this.settings,
+      );
+      this.sessions.set(sessionId, session);
 
-    const { availableModels, currentModelId } = buildAvailableModels(
-      config,
-      loadedSettings,
-    );
+      const { availableModels, currentModelId } = buildAvailableModels(
+        config,
+        loadedSettings,
+      );
 
-    const response = {
-      sessionId,
-      modes: {
-        availableModes: buildAvailableModes(config.isPlanEnabled()),
-        currentModeId: config.getApprovalMode(),
-      },
-      models: {
-        availableModels,
-        currentModelId,
-      },
-    };
-    return response;
+      const response = {
+        sessionId,
+        modes: {
+          availableModes: buildAvailableModes(config.isPlanEnabled()),
+          currentModeId: config.getApprovalMode(),
+        },
+        models: {
+          availableModels,
+          currentModelId,
+        },
+      };
+
+      setTimeout(() => {
+        session?.sendAvailableCommands().catch((err) => {
+          debugLogger.error(`Error sending available commands: ${err}`);
+        });
+      }, 0);
+
+      return response;
+    } catch (error) {
+      if (session) {
+        this.sessions.delete(sessionId);
+        try {
+          await session.dispose();
+        } catch (disposeError) {
+          debugLogger.error(
+            `Error disposing session in newSession: ${disposeError}`,
+          );
+        }
+      } else if (config) {
+        try {
+          await config.dispose?.();
+        } catch (disposeError) {
+          debugLogger.error(
+            `Error disposing config in newSession: ${disposeError}`,
+          );
+        }
+      }
+      throw error;
+    }
   }
 
   async loadSession(
     { sessionId, cwd, mcpServers }: acp.LoadSessionRequest,
     authDetails: AuthDetails,
   ): Promise<acp.LoadSessionResponse> {
-    const config = await this.prepareSessionConfig(
-      sessionId,
-      cwd,
-      mcpServers,
-      authDetails,
-    );
-
-    await config.storage?.initializ
```

**File**: `packages/cli/src/utils/sessionUtils.test.ts` (modified, +220/-0)
```diff
@@ -803,6 +803,226 @@ describe('SessionSelector', () => {
       },
     );
   });
+
+  describe('resolveSessionById', () => {
+    it('should resolve session with no messages / no resumable content', async () => {
+      const sessionId = randomUUID();
+      const chatsDir = path.join(tmpDir, 'chats');
+      await fs.mkdir(chatsDir, { recursive: true });
+
+      const session = {
+        sessionId,
+        projectHash: 'test-hash',
+        startTime: '2024-01-01T10:00:00.000Z',
+        lastUpdated: '2024-01-01T10:00:00.000Z',
+        kind: 'main',
+        messages: [],
+      };
+
+      await fs.writeFile(
+        path.join(
+          chatsDir,
+          `${SESSION_FILE_PREFIX}2024-01-01T10-00-${sessionId.slice(0, 8)}.jsonl`,
+        ),
+        JSON.stringify(session) + '\n',
+      );
+
+      const sessionSelector = new SessionSelector(storage);
+      const result = await sessionSelector.resolveSessionById(sessionId);
+
+      expect(result.sessionData.sessionId).toBe(sessionId);
+      expect(result.sessionData.messages).toEqual([]);
+      expect(result.displayInfo).toContain('Empty conversation');
+    });
+
+    it('should resolve session with messages', async () => {
+      const sessionId = randomUUID();
+      const chatsDir = path.join(tmpDir, 'chats');
+      await fs.mkdir(chatsDir, { recursive: true });
+
+      const session = {
+        sessionId,
+        projectHash: 'test-hash',
+        startTime: '2024-01-01T10:00:00.000Z',
+        lastUpdated: '2024-01-01T10:30:00.000Z',
+        kind: 'main',
+        messages: [
+          {
+            type: 'user',
+            content: 'Hello ACP',
+            id: 'msg1',
+            timestamp: '2024-01-01T10:00:00.000Z',
+          },
+        ],
+      };
+
+      await fs.writeFile(
+        path.join(
+          chatsDir,
+          `${SESSION_FILE_PREFIX}2024-01-01T10-00-${sessionId.slice(0, 8)}.jsonl`,
+        ),
+        JSON.stringify(session) + '\n',
+      );
+
+      const sessionSelector = new SessionSelector(storage);
+      const result = await sessionSelector.resolveSessionById(sessionId);
+
+      expect(result.sessionData.sessionId).toBe(sessionId);
+      expect(result.sessionData.messages).toHaveLength(1);
+    });
+
+    it('should format displayInfo using startTime fallback when lastUpdated is missing', async () => {
+      const sessionId = randomUUID();
+      const chatsDir = path.join(tmpDir, 'chats');
+      await fs.mkdir(chatsDir, { recursive: true });
+
+      const session = {
+        sessionId,
+        projectHash: 'test-hash',
+        startTime: '2024-01-01T10:00:00.000Z',
+        messages: [
+          {
+            type: 'user',
+            content: 'Hello without lastUpdated',
+            id: 'msg1',
+            timestamp: '2024-01-01T10:00:00.000Z',
+          },
+        ],
+      };
+
+      await fs.writeFile(
+        path.join(
+          chatsDir,
+          `${SESSION_FILE_PREFIX}2024-01-01T10-00-${sessionId.slice(0, 8)}.jsonl`,
+        ),
+        JSON.stringify(session) + '\n',
+      );
+
+      const sessionSelector = new SessionSelector(storage);
+      const result = await sessionSelector.resolveSessionById(sessionId);
+
+      expect(result.sessionData.sessionId).toBe(sessionId);
+      expect(result.displayInfo).toContain(
+        `Session ${sessionId}: Hello without lastUpdated`,
+      );
+      expect(result.displayInfo).not.toContain('Invalid Date');
+    });
+
+    it('should throw INVALID_SESSION_IDENTIFIER if session does not exist on disk', async () => {
+      const nonExistentId = randomUUID();
+      const sessionSelector = new SessionSelector(storage);
+
+      await expect(
+        sessionSelector.resolveSessionById(nonExistentId),
+      ).rejects.toSatisfy((error) => {
+        expect(error).toBeInstanceOf(SessionError);
+        expect((error as SessionError).code).toBe('INVALID_SESSION_IDENTIFIER');
+        return true;
+      });
+    });
+
+    it('should not resolve subagent sessions via resolveSessionById', async () => {
+      const subagentId = randomUUID();
+      const chatsDir = path.join(tmpDir, 'chats');
+      await fs.mkdir(chatsDir, { recursive: true });
+
+      const session = {
+        sessionId: subagentId,
+        projectHash: 'test-hash',
+        startTime: '2024-01-01T10:00:00.000Z',
+        lastUpdated: '2024-01-01T10:00:00.000Z',
+        kind: 'subagent',
+        messages: [],
+      };
+
+      await fs.writeFile(
+        path.join(
+          chatsDir,
+          `${SESSION_FILE_PREFIX}2024-01-01T10-00-${subagentId.slice(0, 8)}.jsonl`,
+        ),
+        JSON.stringify(session) + '\n',
+      );
+
+      const sessionSelector = new SessionSelector(storage);
+      await expect(
+        sessionSelector.resolveSessionById(subagentId),
+      ).rejects.toThrow(SessionError);
+    });
+
+    it('should allow resolving empty session via resolveSession with allowEmpty: true', async () => {
+      const sessionId = rando
```

**File**: `packages/cli/src/utils/sessionUtils.ts` (modified, +101/-2)
```diff
@@ -230,6 +230,17 @@ export interface GetSessionOptions {
   includeFullContent?: boolean;
 }
 
+/**
+ * Options for resolving sessions.
+ */
+export interface ResolveSessionOptions {
+  /**
+   * Whether to allow resolving sessions that have no resumable content yet
+   * (e.g., newly established ACP sessions).
+   */
+  allowEmpty?: boolean;
+}
+
 /**
  * Loads all session files (including corrupted ones) from the chats directory.
  * @returns Array of session file entries, with sessionInfo null for corrupted files
@@ -491,16 +502,104 @@ export class SessionSelector {
     throw SessionError.invalidSessionIdentifier(trimmedIdentifier, chatsDir);
   }
 
+  /**
+   * Resolves a session directly by its full UUID, bypassing interactive terminal list
+   * filtering (such as `hasResumableContent: false`).
+   *
+   * @param id - Full session UUID
+   * @returns Promise resolving to session selection result
+   * @throws SessionError if the session file does not exist or is invalid
+   */
+  async resolveSessionById(id: string): Promise<SessionSelectionResult> {
+    const trimmedId = id.trim();
+    const chatsDir = path.join(this.storage.getProjectTempDir(), 'chats');
+    const files = await fs.readdir(chatsDir).catch(() => []);
+
+    const shortId = trimmedId.slice(0, 8);
+    const candidateFiles = files.filter(
+      (f) =>
+        f.startsWith(SESSION_FILE_PREFIX) &&
+        (f.endsWith(`-${shortId}.json`) || f.endsWith(`-${shortId}.jsonl`)),
+    );
+
+    const matches: Array<{
+      filePath: string;
+      sessionData: ConversationRecord;
+    }> = [];
+
+    for (const fileName of candidateFiles) {
+      try {
+        const sessionPath = path.join(chatsDir, fileName);
+        const sessionData = await loadConversationRecord(sessionPath);
+        if (
+          sessionData &&
+          sessionData.sessionId === trimmedId &&
+          sessionData.kind !== 'subagent'
+        ) {
+          matches.push({ filePath: sessionPath, sessionData });
+        }
+      } catch {
+        // Ignore unparseable files
+      }
+    }
+
+    if (matches.length === 0) {
+      throw SessionError.invalidSessionIdentifier(trimmedId, chatsDir);
+    }
+
+    // If duplicate records exist, choose the most recently updated one
+    matches.sort((a, b) => {
+      const getTime = (dateStr: string | undefined) => {
+        if (!dateStr) return 0;
+        const t = new Date(dateStr).getTime();
+        return isNaN(t) ? 0 : t;
+      };
+      const timeA = getTime(
+        a.sessionData.lastUpdated?.trim() || a.sessionData.startTime,
+      );
+      const timeB = getTime(
+        b.sessionData.lastUpdated?.trim() || b.sessionData.startTime,
+      );
+      return timeB - timeA;
+    });
+
+    const { filePath, sessionData } = matches[0];
+    const messages = sessionData.messages ?? [];
+    const firstUserMsg = extractFirstUserMessage(messages);
+    const messageCount = messages.length;
+    const timestamp =
+      sessionData.lastUpdated?.trim() ||
+      sessionData.startTime?.trim() ||
+      new Date().toISOString();
+    const displayInfo = `Session ${sessionData.sessionId}: ${firstUserMsg} (${messageCount} messages, ${formatRelativeTime(timestamp)})`;
+
+    return {
+      sessionPath: filePath,
+      sessionData,
+      displayInfo,
+    };
+  }
+
   /**
    * Resolves a resume argument to a specific session.
    *
    * @param resumeArg - Can be "latest", a full UUID, or an index number (1-based)
+   * @param options - Optional resolution options (e.g. allowEmpty to bypass resumable content filtering for exact UUIDs)
    * @returns Promise resolving to session selection result
    */
-  async resolveSession(resumeArg: string): Promise<SessionSelectionResult> {
-    let selectedSession: SessionInfo;
+  async resolveSession(
+    resumeArg: string,
+    options?: ResolveSessionOptions,
+  ): Promise<SessionSelectionResult> {
     const trimmedResumeArg = resumeArg.trim();
 
+    const isIndex = /^\d+$/.test(trimmedResumeArg);
+    if (options?.allowEmpty && trimmedResumeArg !== RESUME_LATEST && !isIndex) {
+      return this.resolveSessionById(trimmedResumeArg);
+    }
+
+    let selectedSession: SessionInfo;
+
     if (trimmedResumeArg === RESUME_LATEST) {
       const sessions = await this.listSessions();
 
```

---

### Incident Patch 4: `2d1f92ab` (2026-10-01)
**Commit Message**: fix(cli): retry directory removal on Windows locking errors during extension updates (#29540)

Co-authored-by: David Pierce <[REDACTED_EMAIL]>

**File**: `packages/cli/src/config/extension-manager.test.ts` (modified, +55/-0)
```diff
@@ -34,6 +34,19 @@ const mockIntegrityManager = vi.hoisted(() => ({
   store: vi.fn().mockResolvedValue(undefined),
 }));
 
+vi.mock('node:fs', async (importOriginal) => {
+  const actual = await importOriginal<typeof import('node:fs')>();
+  return {
+    ...actual,
+    promises: {
+      ...actual.promises,
+      rm: vi.fn((...args: Parameters<typeof actual.promises.rm>) =>
+        actual.promises.rm(...args),
+      ),
+    },
+  };
+});
+
 vi.mock('os', async (importOriginal) => {
   const mockedOs = await importOriginal<typeof os>();
   return {
@@ -1004,4 +1017,46 @@ describe('ExtensionManager', () => {
       });
     });
   });
+
+  describe('Windows directory removal retry during update and uninstall', () => {
+    it('retries removing old extension directory on transient EBUSY during update', async () => {
+      const extName = 'google-workspace';
+      const extDir = path.join(userExtensionsDir, extName);
+      fs.mkdirSync(extDir, { recursive: true });
+      fs.writeFileSync(
+        path.join(extDir, 'gemini-extension.json'),
+        JSON.stringify({ name: extName, version: '1.0.0' }),
+      );
+      fs.writeFileSync(
+        path.join(extDir, 'metadata.json'),
+        JSON.stringify({ type: 'local', source: extDir }),
+      );
+
+      await extensionManager.loadExtensions();
+
+      const newSourceDir = fs.mkdtempSync(
+        path.join(tempHomeDir, 'new-source-'),
+      );
+      fs.writeFileSync(
+        path.join(newSourceDir, 'gemini-extension.json'),
+        JSON.stringify({ name: extName, version: '1.1.0' }),
+      );
+
+      const ebusyError = Object.assign(
+        new Error(`EBUSY: resource busy or locked, rmdir '${extDir}'`),
+        { code: 'EBUSY' },
+      );
+      vi.mocked(fs.promises.rm).mockRejectedValueOnce(ebusyError);
+
+      const updated = await extensionManager.installOrUpdateExtension(
+        { type: 'local', source: newSourceDir },
+        { name: extName, version: '1.0.0' },
+      );
+
+      expect(updated.version).toBe('1.1.0');
+      expect(
+        vi.mocked(fs.promises.rm).mock.calls.length,
+      ).toBeGreaterThanOrEqual(2);
+    });
+  });
 });
```

**File**: `packages/cli/src/config/extension-manager.ts` (modified, +9/-5)
```diff
@@ -83,6 +83,7 @@ import {
 import type { EventEmitter } from 'node:stream';
 import { themeManager } from '../ui/themes/theme-manager.js';
 import { getFormattedSettingValue } from '../commands/extensions/utils.js';
+import { removeDirectoryWithRetry } from '../utils/retry.js';
 
 interface ExtensionManagerParams {
   enabledExtensionOverrides?: string[];
@@ -497,7 +498,13 @@ Would you like to attempt to install via "git clone" instead?`,
         }
       } finally {
         if (tempDir) {
-          await fs.promises.rm(tempDir, { recursive: true, force: true });
+          try {
+            await removeDirectoryWithRetry(tempDir);
+          } catch (cleanupError) {
+            debugLogger.warn(
+              `Failed to clean up temp directory ${tempDir}: ${getErrorMessage(cleanupError)}`,
+            );
+          }
         }
       }
       return extension;
@@ -566,10 +573,7 @@ Would you like to attempt to install via "git clone" instead?`,
         : path.basename(extension.path),
     );
 
-    await fs.promises.rm(storage.getExtensionDir(), {
-      recursive: true,
-      force: true,
-    });
+    await removeDirectoryWithRetry(storage.getExtensionDir());
 
     // The rest of the cleanup below here is only for true uninstalls, not
     // uninstalls related to updates.
```

**File**: `packages/cli/src/config/extensions/update.test.ts` (modified, +46/-0)
```diff
@@ -196,6 +196,30 @@ describe('Extension Update Logic', () => {
       });
     });
 
+    it('should succeed when tempDir removal transiently fails with EBUSY on Windows', async () => {
+      const ebusyError = Object.assign(
+        new Error("EBUSY: resource busy or locked, rmdir '/tmp/mock-dir'"),
+        { code: 'EBUSY' },
+      );
+      vi.mocked(fs.promises.rm)
+        .mockRejectedValueOnce(ebusyError)
+        .mockResolvedValueOnce(undefined);
+
+      const result = await updateExtension(
+        mockExtension,
+        mockExtensionManager,
+        ExtensionUpdateState.UPDATE_AVAILABLE,
+        mockDispatch,
+      );
+
+      expect(result).toEqual({
+        name: 'test-extension',
+        originalVersion: '1.0.0',
+        updatedVersion: '1.1.0',
+      });
+      expect(fs.promises.rm).toHaveBeenCalledTimes(2);
+    });
+
     it('should migrate source if migratedTo is set and an update is available', async () => {
       vi.mocked(mockExtensionManager.loadExtensionConfig).mockReturnValue(
         Promise.resolve({
@@ -309,6 +333,28 @@ describe('Extension Update Logic', () => {
       expect(fs.promises.rm).toHaveBeenCalled();
     });
 
+    it('should not mask primary update error if tempDir cleanup fails in finally', async () => {
+      vi.mocked(
+        mockExtensionManager.installOrUpdateExtension,
+      ).mockRejectedValueOnce(new Error('Install failed'));
+      const cleanupError = Object.assign(
+        new Error('EACCES: permission denied'),
+        {
+          code: 'EACCES',
+        },
+      );
+      vi.mocked(fs.promises.rm).mockRejectedValueOnce(cleanupError);
+
+      await expect(
+        updateExtension(
+          mockExtension,
+          mockExtensionManager,
+          ExtensionUpdateState.UPDATE_AVAILABLE,
+          mockDispatch,
+        ),
+      ).rejects.toThrow('Updated extension not found after installation');
+    });
+
     describe('Integrity Verification', () => {
       it('should fail update with security alert if integrity is invalid', async () => {
         vi.mocked(
```

**File**: `packages/cli/src/config/extensions/update.ts` (modified, +8/-2)
```diff
@@ -17,9 +17,9 @@ import {
   type GeminiCLIExtension,
   IntegrityDataStatus,
 } from '@google/gemini-cli-core';
-import * as fs from 'node:fs';
 import { copyExtension, type ExtensionManager } from '../extension-manager.js';
 import { ExtensionStorage } from './storage.js';
+import { removeDirectoryWithRetry } from '../../utils/retry.js';
 
 export interface ExtensionUpdateInfo {
   name: string;
@@ -145,7 +145,13 @@ export async function updateExtension(
     await copyExtension(tempDir, extension.path);
     throw e;
   } finally {
-    await fs.promises.rm(tempDir, { recursive: true, force: true });
+    try {
+      await removeDirectoryWithRetry(tempDir);
+    } catch (cleanupError) {
+      debugLogger.warn(
+        `Failed to clean up temp directory ${tempDir}: ${getErrorMessage(cleanupError)}`,
+      );
+    }
   }
 }
 
```

**File**: `packages/cli/src/utils/retry.test.ts` (added, +176/-0)
```diff
@@ -0,0 +1,176 @@
+/**
+ * @license
+ * Copyright 2026 Google LLC
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
+import * as fs from 'node:fs';
+import { retryWithBackoff, removeDirectoryWithRetry } from './retry.js';
+
+vi.mock('node:fs', async (importOriginal) => {
+  const actual = await importOriginal<typeof import('node:fs')>();
+  return {
+    ...actual,
+    promises: {
+      ...actual.promises,
+      rm: vi.fn(),
+    },
+  };
+});
+
+vi.mock('@google/gemini-cli-core', async (importOriginal) => {
+  const actual =
+    await importOriginal<typeof import('@google/gemini-cli-core')>();
+  return {
+    ...actual,
+    debugLogger: {
+      debug: vi.fn(),
+      error: vi.fn(),
+      warn: vi.fn(),
+      info: vi.fn(),
+    },
+  };
+});
+
+describe('retry utils', () => {
+  beforeEach(() => {
+    vi.clearAllMocks();
+    vi.useFakeTimers();
+  });
+
+  afterEach(() => {
+    vi.useRealTimers();
+  });
+
+  describe('retryWithBackoff', () => {
+    it('should succeed on the first attempt', async () => {
+      const fn = vi.fn().mockResolvedValue('success');
+      const result = await retryWithBackoff(fn);
+      expect(result).toBe('success');
+      expect(fn).toHaveBeenCalledTimes(1);
+    });
+
+    it('should retry and succeed on a subsequent attempt', async () => {
+      const fn = vi
+        .fn()
+        .mockRejectedValueOnce(new Error('fail 1'))
+        .mockRejectedValueOnce(new Error('fail 2'))
+        .mockResolvedValue('success');
+
+      const promise = retryWithBackoff(fn, { initialDelay: 100 });
+
+      await vi.advanceTimersByTimeAsync(100);
+      await vi.advanceTimersByTimeAsync(200);
+
+      const result = await promise;
+      expect(result).toBe('success');
+      expect(fn).toHaveBeenCalledTimes(3);
+    });
+
+    it('should fail after maxRetries', async () => {
+      const fn = vi.fn().mockRejectedValue(new Error('persistent fail'));
+
+      const promise = retryWithBackoff(fn, {
+        maxRetries: 3,
+        initialDelay: 100,
+      });
+
+      await Promise.all([
+        expect(promise).rejects.toThrow('persistent fail'),
+        (async () => {
+          await vi.advanceTimersByTimeAsync(100);
+          await vi.advanceTimersByTimeAsync(200);
+        })(),
+      ]);
+      expect(fn).toHaveBeenCalledTimes(3);
+    });
+
+    it('should not retry if shouldRetry returns false', async () => {
+      const fn = vi.fn().mockRejectedValue(new Error('fatal fail'));
+      const shouldRetry = vi.fn().mockReturnValue(false);
+
+      await expect(retryWithBackoff(fn, { shouldRetry })).rejects.toThrow(
+        'fatal fail',
+      );
+      expect(fn).toHaveBeenCalledTimes(1);
+      expect(shouldRetry).toHaveBeenCalledWith(expect.any(Error));
+    });
+
+    it('should throw an error if maxRetries is zero or negative', async () => {
+      const fn = vi.fn();
+      await expect(retryWithBackoff(fn, { maxRetries: 0 })).rejects.toThrow(
+        'maxRetries must be a positive number.',
+      );
+      await expect(retryWithBackoff(fn, { maxRetries: -1 })).rejects.toThrow(
+        'maxRetries must be a positive number.',
+      );
+      expect(fn).not.toHaveBeenCalled();
+    });
+  });
+
+  describe('removeDirectoryWithRetry', () => {
+    it('should retry on EBUSY, ENOTEMPTY, and EPERM', async () => {
+      const ebusyError = Object.assign(new Error('EBUSY'), { code: 'EBUSY' });
+      const enotemptyError = Object.assign(new Error('ENOTEMPTY'), {
+        code: 'ENOTEMPTY',
+      });
+      const epermError = Object.assign(new Error('EPERM'), { code: 'EPERM' });
+
+      vi.mocked(fs.promises.rm)
+        .mockRejectedValueOnce(ebusyError)
+        .mockRejectedValueOnce(enotemptyError)
+        .mockRejectedValueOnce(epermError)
+        .mockResolvedValue(undefined);
+
+      const promise = removeDirectoryWithRetry('/some/path');
+
+      await vi.advanceTimersByTimeAsync(100);
+      await vi.advanceTimersByTimeAsync(200);
+      await vi.advanceTimersByTimeAsync(400);
+
+      await promise;
+      expect(fs.promises.rm).toHaveBeenCalledTimes(4);
+      expect(fs.promises.rm).toHaveBeenCalledWith('/some/path', {
+        recursive: true,
+        force: true,
+      });
+    });
+
+    it('should not retry on other errors like EACCES', async () => {
+      const eaccesError = Object.assign(new Error('EACCES'), {
+        code: 'EACCES',
+      });
+      vi.mocked(fs.promises.rm).mockRejectedValue(eaccesError);
+
+      await expect(removeDirectoryWithRetry('/some/path')).rejects.toThrow(
+        'EACCES',
+      );
+      expect(fs.promises.rm).toHaveBeenCalledTimes(1);
+    });
+
+    it('should respect caller-supplied options while keeping defaults', async () => {
+      const ebusyError = Object.assign(new Error('EBUSY'), { code: 'EBUSY' });
+      vi.mocked(fs.promises.rm)
+        .mockRejectedValueOnce(ebusyError)
+        .mockRejectedValueOnce(ebusyError);
+
```

**File**: `packages/cli/src/utils/retry.ts` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+/**
+ * @license
+ * Copyright 2026 Google LLC
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+import * as fs from 'node:fs';
+import { debugLogger, isNodeError } from '@google/gemini-cli-core';
+
+export interface RetryOptions {
+  maxRetries?: number;
+  initialDelay?: number;
+  shouldRetry?: (error: unknown) => boolean;
+}
+
+/**
+ * Retries an asynchronous operation with exponential backoff.
+ */
+export async function retryWithBackoff<T>(
+  fn: () => Promise<T>,
+  options: RetryOptions = {},
+): Promise<T> {
+  const {
+    maxRetries = 5,
+    initialDelay = 100,
+    shouldRetry = () => true,
+  } = options;
+
+  if (maxRetries <= 0) {
+    throw new Error('maxRetries must be a positive number.');
+  }
+
+  let attempt = 0;
+  let delay = initialDelay;
+
+  while (attempt < maxRetries) {
+    try {
+      return await fn();
+    } catch (error) {
+      attempt++;
+      if (attempt >= maxRetries || !shouldRetry(error)) {
+        throw error;
+      }
+      debugLogger.debug(
+        `Operation failed, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})... Error: ${error}`,
+      );
+      await new Promise((resolve) => setTimeout(resolve, delay));
+      delay *= 2;
+    }
+  }
+  throw new Error('Unreachable');
+}
+
+export interface RemoveDirectoryOptions extends RetryOptions {
+  recursive?: boolean;
+  force?: boolean;
+}
+
+/**
+ * Removes a directory or file with retries for common Windows locking errors.
+ */
+export async function removeDirectoryWithRetry(
+  path: string,
+  options: RemoveDirectoryOptions = {},
+): Promise<void> {
+  const { recursive = true, force = true, ...retryOptions } = options;
+
+  const isRetryableError = (error: unknown): boolean => {
+    if (isNodeError(error)) {
+      return (
+        error.code === 'EBUSY' ||
+        error.code === 'ENOTEMPTY' ||
+        error.code === 'EPERM'
+      );
+    }
+    return false;
+  };
+
+  await retryWithBackoff(() => fs.promises.rm(path, { recursive, force }), {
+    maxRetries: 5,
+    initialDelay: 100,
+    shouldRetry: isRetryableError,
+    ...retryOptions,
+  });
+}
```

---

### Incident Patch 5: `984f123c` (2026-10-01)
**Commit Message**: fix(ui): ensure Windows ConPTY forwards IME cursor position (#29560)

Co-authored-by: David Pierce <[REDACTED_EMAIL]>

**File**: `packages/cli/src/ui/components/InputPrompt.test.tsx` (modified, +49/-0)
```diff
@@ -4389,6 +4389,55 @@ describe('InputPrompt', () => {
       expect(cursorLineCall![0].terminalCursorPosition).toBe(0);
       unmount();
     });
+
+    it('should report cursor position 0 when input is empty and placeholder is empty', async () => {
+      mockBuffer.text = '';
+      mockBuffer.lines = [''];
+      mockBuffer.allVisualLines = [''];
+      mockBuffer.viewportVisualLines = [''];
+      mockBuffer.visualToLogicalMap = [[0, 0]];
+      mockBuffer.visualCursor = [0, 0];
+      mockBuffer.visualScrollRow = 0;
+
+      const { unmount } = await renderWithProviders(
+        <TestInputPrompt {...props} placeholder="" />,
+        { uiActions },
+      );
+
+      const textCalls = vi.mocked(Text).mock.calls;
+      const cursorLineCall = [...textCalls]
+        .reverse()
+        .find((call) => call[0].terminalCursorFocus === true);
+
+      expect(cursorLineCall).toBeDefined();
+      expect(cursorLineCall![0].terminalCursorPosition).toBe(0);
+      unmount();
+    });
+
+    it('should report correct cursor position for CJK characters', async () => {
+      const text = '中文测试';
+      mockBuffer.setText(text);
+      mockBuffer.visualCursor = [0, 2]; // Cursor after '中文'
+      mockBuffer.visualScrollRow = 0;
+
+      const { stdout, unmount } = await renderWithProviders(
+        <TestInputPrompt {...props} />,
+        { uiActions },
+      );
+
+      await waitFor(() => {
+        expect(stdout.lastFrame()).toContain('中文测试');
+      });
+
+      const textCalls = vi.mocked(Text).mock.calls;
+      const cursorLineCall = [...textCalls]
+        .reverse()
+        .find((call) => call[0].terminalCursorFocus === true);
+
+      expect(cursorLineCall).toBeDefined();
+      expect(cursorLineCall![0].terminalCursorPosition).toBe(2);
+      unmount();
+    });
   });
 
   describe('image path transformation snapshots', () => {
```

**File**: `packages/cli/src/ui/components/InputPrompt.tsx` (modified, +12/-16)
```diff
@@ -1856,24 +1856,20 @@ export const InputPrompt: React.FC<InputPromptProps> = ({
             )}{' '}
           </Text>
           <Box flexGrow={1} flexDirection="column" ref={innerBoxRef}>
-            {buffer.text.length === 0 ? (
-              effectivePlaceholder ? (
-                showCursor ? (
-                  <Text
-                    terminalCursorFocus={showCursor}
-                    terminalCursorPosition={0}
-                  >
-                    {chalk.inverse(effectivePlaceholder.slice(0, 1))}
-                    <Text color={theme.text.secondary}>
-                      {effectivePlaceholder.slice(1)}
-                    </Text>
-                  </Text>
-                ) : (
+            {buffer.text.length === 0 && effectivePlaceholder ? (
+              showCursor ? (
+                <Text
+                  terminalCursorFocus={showCursor}
+                  terminalCursorPosition={0}
+                >
+                  {chalk.inverse(cpSlice(effectivePlaceholder, 0, 1))}
                   <Text color={theme.text.secondary}>
-                    {effectivePlaceholder}
+                    {cpSlice(effectivePlaceholder, 1)}
                   </Text>
-                )
-              ) : null
+                </Text>
+              ) : (
+                <Text color={theme.text.secondary}>{effectivePlaceholder}</Text>
+              )
             ) : (
               <Box
                 flexDirection="column"
```

**File**: `packages/cli/src/ui/components/shared/TextInput.tsx` (modified, +2/-2)
```diff
@@ -81,8 +81,8 @@ export function TextInput({
       <Box ref={containerRef}>
         {focus ? (
           <Text terminalCursorFocus={focus} terminalCursorPosition={0}>
-            {chalk.inverse(placeholder[0] || ' ')}
-            <Text color={theme.text.secondary}>{placeholder.slice(1)}</Text>
+            {chalk.inverse(cpSlice(placeholder, 0, 1) || ' ')}
+            <Text color={theme.text.secondary}>{cpSlice(placeholder, 1)}</Text>
           </Text>
         ) : (
           <Text color={theme.text.secondary}>{placeholder}</Text>
```

**File**: `packages/core/src/utils/stdio.test.ts` (modified, +52/-0)
```diff
@@ -65,4 +65,56 @@ describe('stdio utils', () => {
 
     cleanup();
   });
+
+  it('shows cursor on Windows when Ink positions the IME cursor and hides it when unfocused', async () => {
+    const originalPlatform = process.platform;
+    Object.defineProperty(process, 'platform', {
+      value: 'win32',
+      configurable: true,
+    });
+
+    try {
+      vi.resetModules();
+      const writeSpy = vi
+        .spyOn(process.stdout, 'write')
+        .mockImplementation(() => true);
+      const { createWorkingStdio: createWinWorkingStdio } = await import(
+        './stdio.js'
+      );
+      const { stdout } = createWinWorkingStdio();
+
+      // Plain writes should not be modified when cursor has not been shown for IME
+      stdout.write('plain output');
+      expect(writeSpy).toHaveBeenLastCalledWith('plain output');
+
+      // Frame ending with Ink's positionImeCursor (\x1b[2A\x1b[5G) should append \x1b[?25h
+      stdout.write('prompt line\nfooter line\n\x1b[2A\x1b[5G');
+      expect(writeSpy).toHaveBeenLastCalledWith(
+        'prompt line\nfooter line\n\x1b[2A\x1b[5G\x1b[?25h',
+      );
+
+      // Subsequent frame without cursor positioning should append \x1b[?25l to hide cursor
+      stdout.write('streaming output\nfooter line\n');
+      expect(writeSpy).toHaveBeenLastCalledWith(
+        'streaming output\nfooter line\n\x1b[?25l',
+      );
+
+      // Synchronized output frame with cursor positioning should insert \x1b[?25h before \x1b[?2026l
+      stdout.write('\x1b[?2026hframe content\x1b[10;4H\x1b[?2026l');
+      expect(writeSpy).toHaveBeenLastCalledWith(
+        '\x1b[?2026hframe content\x1b[10;4H\x1b[?25h\x1b[?2026l',
+      );
+
+      // Synchronized output frame without cursor positioning should insert \x1b[?25l before \x1b[?2026l
+      stdout.write('\x1b[?2026hstreaming content\x1b[?2026l');
+      expect(writeSpy).toHaveBeenLastCalledWith(
+        '\x1b[?2026hstreaming content\x1b[?25l\x1b[?2026l',
+      );
+    } finally {
+      Object.defineProperty(process, 'platform', {
+        value: originalPlatform,
+        configurable: true,
+      });
+    }
+  });
 });
```

**File**: `packages/core/src/utils/stdio.ts` (modified, +50/-1)
```diff
@@ -87,16 +87,65 @@ function isKey<T extends object>(
   return key in obj;
 }
 
+// Matches ANSI cursor positioning sequences emitted by Ink at the end of a frame
+// (e.g. cursorTo `\x1b[<col>G` or `\x1b[<row>;<col>H`, or cursorLeft `\x1b[D`),
+// optionally followed by the synchronized output exit sequence (`\x1b[?2026l`).
+const INK_CURSOR_POSITION_END_REGEX =
+  // eslint-disable-next-line no-control-regex
+  /\x1b\[(?:\d+G|\d+;\d+H|D)(\x1b\[\?2026l)?$/;
+const SHOW_CURSOR_SEQ = '\x1b[?25h';
+const HIDE_CURSOR_SEQ = '\x1b[?25l';
+const EXIT_SYNCHRONIZED_OUTPUT_SEQ = '\x1b[?2026l';
+
 /**
  * Creates proxies for process.stdout and process.stderr that use the real write methods
  * (writeToStdout and writeToStderr) bypassing any monkey patching.
  * This is used to write to the real output even when stdio is patched.
  */
 export function createWorkingStdio() {
+  let cursorShownForIme = false;
+
+  const workingStdoutWrite = (
+    ...args: Parameters<typeof process.stdout.write>
+  ): boolean => {
+    const [chunk] = args;
+    if (process.platform === 'win32' && typeof chunk === 'string') {
+      // On Windows, ConPTY (conhost.exe) skips VtEngine::PaintCursor when the
+      // cursor is hidden (\x1b[?25l), which prevents Ink's IME cursor movement
+      // sequences from being forwarded to the terminal emulator and leaves the
+      // IME candidate window anchored at the end of the footer. Keep the cursor
+      // visible when Ink positions it for a focused input and hide it again
+      // when rendering frames without a focused cursor position.
+      if (chunk === HIDE_CURSOR_SEQ) {
+        cursorShownForIme = false;
+      } else if (chunk === SHOW_CURSOR_SEQ) {
+        cursorShownForIme = true;
+      } else if (INK_CURSOR_POSITION_END_REGEX.test(chunk)) {
+        args[0] = chunk.replace(
+          INK_CURSOR_POSITION_END_REGEX,
+          (match, syncExit?: string) =>
+            syncExit
+              ? `${match.slice(0, -syncExit.length)}${SHOW_CURSOR_SEQ}${syncExit}`
+              : `${match}${SHOW_CURSOR_SEQ}`,
+        );
+        cursorShownForIme = true;
+      } else if (cursorShownForIme) {
+        if (chunk.endsWith(EXIT_SYNCHRONIZED_OUTPUT_SEQ)) {
+          args[0] = `${chunk.slice(0, -EXIT_SYNCHRONIZED_OUTPUT_SEQ.length)}${HIDE_CURSOR_SEQ}${EXIT_SYNCHRONIZED_OUTPUT_SEQ}`;
+        } else {
+          args[0] = `${chunk}${HIDE_CURSOR_SEQ}`;
+        }
+        cursorShownForIme = false;
+      }
+    }
+
+    return writeToStdout(...args);
+  };
+
   const stdoutHandler: ProxyHandler<typeof process.stdout> = {
     get(target, prop) {
       if (prop === 'write') {
-        return writeToStdout;
+        return workingStdoutWrite;
       }
       if (isKey(prop, target)) {
         const value = target[prop];
```

---

### Incident Patch 6: `7336b08d` (2026-10-01)
**Commit Message**: fix(cli): resolve @file:line references and prevent ghost text wrap hang (#29581)

Co-authored-by: David Pierce <[REDACTED_EMAIL]>

**File**: `packages/cli/src/ui/components/InputPrompt.test.tsx` (modified, +55/-0)
```diff
@@ -5459,6 +5459,61 @@ describe('InputPrompt', () => {
       unmount();
     });
   });
+
+  describe('ghost text wrapping edge cases', () => {
+    it('does not hang when wrapping wide characters with inputWidth = 1', async () => {
+      props.inputWidth = 1;
+      props.suggestionsWidth = 1;
+      mockBuffer.setText('a');
+
+      mockedUseCommandCompletion.mockReturnValue({
+        ...mockCommandCompletion,
+        promptCompletion: {
+          text: 'a' + '好'.repeat(5),
+          accept: vi.fn(),
+          clear: vi.fn(),
+          isLoading: false,
+          isActive: true,
+          markSelected: vi.fn(),
+        },
+      });
+
+      const { lastFrame, unmount } = await renderWithProviders(
+        <TestInputPrompt {...props} />,
+        { uiActions },
+      );
+
+      await waitFor(() => {
+        expect(clean(lastFrame())).toContain('a');
+      });
+      unmount();
+    });
+
+    it('does not hang when inputWidth is 0 and ghost text is active', async () => {
+      props.inputWidth = 0;
+      props.suggestionsWidth = 0;
+      mockBuffer.setText('@app.js');
+
+      mockedUseCommandCompletion.mockReturnValue({
+        ...mockCommandCompletion,
+        promptCompletion: {
+          text: '@app.js:10-20',
+          accept: vi.fn(),
+          clear: vi.fn(),
+          isLoading: false,
+          isActive: true,
+          markSelected: vi.fn(),
+        },
+      });
+
+      const { unmount } = await renderWithProviders(
+        <TestInputPrompt {...props} />,
+        { uiActions },
+      );
+
+      unmount();
+    });
+  });
 });
 
 function clean(str: string | undefined): string {
```

**File**: `packages/cli/src/ui/components/InputPrompt.tsx` (modified, +5/-0)
```diff
@@ -1435,6 +1435,7 @@ export const InputPrompt: React.FC<InputPromptProps> = ({
 
   const getGhostTextLines = useCallback(() => {
     if (
+      inputWidth <= 0 ||
       !completion.promptCompletion.text ||
       !buffer.text ||
       !completion.promptCompletion.text.startsWith(buffer.text)
@@ -1521,6 +1522,10 @@ export const InputPrompt: React.FC<InputPromptProps> = ({
                 partWidth += charWidth;
                 splitIndex = i + 1;
               }
+              if (splitIndex === 0) {
+                part = wordCP[0];
+                splitIndex = 1;
+              }
               additionalLines.push(part);
               wordToProcess = cpSlice(wordToProcess, splitIndex);
             }
```

**File**: `packages/cli/src/ui/hooks/atCommandProcessor.test.ts` (modified, +34/-0)
```diff
@@ -1772,6 +1772,40 @@ describe('handleAtCommand', () => {
 
     expect(globSpy).not.toHaveBeenCalled();
   });
+
+  it.each([
+    '@src/app.js:10',
+    '@src/app.js:10-20',
+    '@src/app.js:10:5',
+    '@src/app.js#L10',
+    '@src/app.js#L10-L25',
+    '@src/app.js#L10-#L25',
+  ])(
+    'should resolve file references with line numbers or ranges (%s) without falling back to glob',
+    async (atRef) => {
+      const fileContent = 'const x = 42;';
+      await createTestFile(
+        path.join(testRootDir, 'src', 'app.js'),
+        fileContent,
+      );
+
+      const result = await handleAtCommand({
+        query: `Explain ${atRef}`,
+        config: mockConfig,
+        addItem: mockAddItem,
+        onDebugMessage: mockOnDebugMessage,
+        messageId: 712,
+        signal: abortController.signal,
+      });
+
+      expect(result.processedQuery).toContainEqual(
+        expect.objectContaining({ text: fileContent }),
+      );
+      expect(mockOnDebugMessage).not.toHaveBeenCalledWith(
+        expect.stringContaining('not found directly, attempting glob search.'),
+      );
+    },
+  );
 });
 
 describe('escapeAtSymbols', () => {
```

**File**: `packages/cli/src/ui/hooks/atCommandProcessor.ts` (modified, +31/-9)
```diff
@@ -18,6 +18,7 @@ import {
   REFERENCE_CONTENT_END,
   CoreToolCallStatus,
   resolveAtCommandPath,
+  stripLineNumberSuffix,
 } from '@google/gemini-cli-core';
 import { Buffer } from 'node:buffer';
 import type {
@@ -196,8 +197,18 @@ export async function checkPermissions(
         path.resolve(config.getTargetDir(), pathName),
       );
     } catch {
-      // skip if resolveToRealPath errors out
-      continue;
+      const strippedPath = stripLineNumberSuffix(pathName);
+      if (!strippedPath) {
+        continue;
+      }
+      try {
+        resolvedPathName = resolveToRealPath(
+          path.resolve(config.getTargetDir(), strippedPath),
+        );
+      } catch {
+        // skip if resolveToRealPath errors out
+        continue;
+      }
     }
 
     if (config.validatePathAccess(resolvedPathName, 'read')) {
@@ -246,18 +257,29 @@ async function resolveFilePaths(
       continue;
     }
 
+    const basePathName = stripLineNumberSuffix(pathName) ?? pathName;
     const gitIgnored =
       respectFileIgnore.respectGitIgnore &&
-      fileDiscovery.shouldIgnoreFile(pathName, {
+      (fileDiscovery.shouldIgnoreFile(pathName, {
         respectGitIgnore: true,
         respectGeminiIgnore: false,
-      });
+      }) ||
+        (basePathName !== pathName &&
+          fileDiscovery.shouldIgnoreFile(basePathName, {
+            respectGitIgnore: true,
+            respectGeminiIgnore: false,
+          })));
     const geminiIgnored =
       respectFileIgnore.respectGeminiIgnore &&
-      fileDiscovery.shouldIgnoreFile(pathName, {
+      (fileDiscovery.shouldIgnoreFile(pathName, {
         respectGitIgnore: false,
         respectGeminiIgnore: true,
-      });
+      }) ||
+        (basePathName !== pathName &&
+          fileDiscovery.shouldIgnoreFile(basePathName, {
+            respectGitIgnore: false,
+            respectGeminiIgnore: true,
+          })));
 
     if (gitIgnored || geminiIgnored) {
       const reason =
@@ -328,7 +350,7 @@ async function resolveFilePaths(
           try {
             const globResult = await globTool.buildAndExecute(
               {
-                pattern: `**/*${pathName}*`,
+                pattern: `**/*${basePathName}*`,
                 path: dir,
               },
               signal,
@@ -361,12 +383,12 @@ async function resolveFilePaths(
                 break;
               } else {
                 onDebugMessage(
-                  `Glob search for '**/*${pathName}*' did not return a usable path. Path ${pathName} will be skipped.`,
+                  `Glob search for '**/*${basePathName}*' did not return a usable path. Path ${pathName} will be skipped.`,
                 );
               }
             } else {
               onDebugMessage(
-                `Glob search for '**/*${pathName}*' found no files or an error. Path ${pathName} will be skipped.`,
+                `Glob search for '**/*${basePathName}*' found no files or an error. Path ${pathName} will be skipped.`,
               );
             }
           } catch (globError) {
```

**File**: `packages/core/src/utils/atCommandUtils.test.ts` (modified, +64/-1)
```diff
@@ -8,7 +8,10 @@ import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
 import * as path from 'node:path';
 import * as fsPromises from 'node:fs/promises';
 import type { Stats } from 'node:fs';
-import { resolveAtCommandPath } from './atCommandUtils.js';
+import {
+  resolveAtCommandPath,
+  stripLineNumberSuffix,
+} from './atCommandUtils.js';
 import { type Config } from '../config/config.js';
 
 vi.mock('node:fs/promises');
@@ -275,6 +278,66 @@ describe('atCommandUtils', () => {
     }
   });
 
+  describe('Line and range suffix handling', () => {
+    const mockFile = 'src/app.js';
+    const absMockFile = path.resolve('/mock/root', mockFile);
+    const mockStats = { isDirectory: () => false, isFile: () => true };
+
+    beforeEach(() => {
+      vi.mocked(fsPromises.stat).mockImplementation(async (p) => {
+        if (p === absMockFile) return mockStats as unknown as Stats;
+        throw new Error('ENOENT');
+      });
+    });
+
+    it.each([
+      ['src/app.js:10', 'src/app.js'],
+      ['src/app.js:10-20', 'src/app.js'],
+      ['src/app.js:10:5', 'src/app.js'],
+      ['src/app.js:10:5-20:10', 'src/app.js'],
+      ['src/app.js#L10', 'src/app.js'],
+      ['src/app.js#L10-L25', 'src/app.js'],
+      ['src/app.js#L10-25', 'src/app.js'],
+      ['src/app.js#L10-#L25', 'src/app.js'],
+    ])('stripLineNumberSuffix(%s) returns %s', (input, expected) => {
+      expect(stripLineNumberSuffix(input)).toBe(expected);
+    });
+
+    it.each([
+      'src/app.js:10',
+      'src/app.js:10-20',
+      'src/app.js:10:5',
+      'src/app.js#L10',
+      'src/app.js#L10-L25',
+      'src/app.js#L10-#L25',
+    ])(
+      'should resolve relative path with line/range suffix: %s',
+      async (pathWithSuffix) => {
+        const result = await resolveAtCommandPath(
+          pathWithSuffix,
+          mockConfig as unknown as Config,
+        );
+        expect(result.status).toBe('resolved');
+        if (result.status === 'resolved') {
+          expect(result.resolved.absolutePath).toBe(absMockFile);
+          expect(result.resolved.relativePath).toBe(mockFile);
+        }
+      },
+    );
+
+    it('should resolve absolute path with line/range suffix', async () => {
+      const result = await resolveAtCommandPath(
+        `${absMockFile}:15-25`,
+        mockConfig as unknown as Config,
+      );
+      expect(result.status).toBe('resolved');
+      if (result.status === 'resolved') {
+        expect(result.resolved.absolutePath).toBe(absMockFile);
+        expect(result.resolved.relativePath).toBe(path.join('src', 'app.js'));
+      }
+    });
+  });
+
   describe('Best-Effort Path Extraction (tryExtractPath)', () => {
     const mockFile = 'src/index.ts';
     const absMockFile = path.resolve('/mock/root', mockFile);
```

**File**: `packages/core/src/utils/atCommandUtils.ts` (modified, +42/-9)
```diff
@@ -28,9 +28,26 @@ export type ResolveAtCommandPathResult =
   | { status: 'invalid'; error: string }
   | { status: 'not_found' };
 
+const LINE_NUMBER_SUFFIX_REGEX =
+  /^(.+?)(?::\d+(?::\d+)?(?:-\d+(?::\d+)?)?:?|#L?\d+(?:-(?:#?L)?\d+)?)$/i;
+
+/**
+ * Strips a trailing line/column/range reference (e.g. `:10`, `:10-20`, `:10:5`,
+ * `#L10`, `#L10-L25`, `#L10-#L25`) from a path string if present.
+ * Returns the base path without the suffix, or null if no suffix was present.
+ */
+export function stripLineNumberSuffix(pathStr: string): string | null {
+  const match = pathStr.match(LINE_NUMBER_SUFFIX_REGEX);
+  if (match && match[1]) {
+    return match[1];
+  }
+  return null;
+}
+
 /**
  * Resolves a path from an @-command, ensuring it is valid and within workspace boundaries.
- * Performs best-effort extraction if the input appears to be a misinterpreted log fragment.
+ * Performs best-effort extraction if the input appears to be a misinterpreted log fragment
+ * or includes a trailing line/range reference (e.g., `file.ts:10` or `file.ts:10-20`).
  */
 export async function resolveAtCommandPath(
   pathName: string,
@@ -92,12 +109,18 @@ export async function resolveAtCommandPath(
         },
       };
     } catch (error) {
-      if (isNodeError(error) && error.code === 'ENOENT') {
-        return { status: 'not_found' };
+      if (!isNodeError(error) || error.code !== 'ENOENT') {
+        onDebugMessage(
+          `Unexpected error stating path ${pathName}: ${getErrorMessage(error)}`,
+        );
+      }
+      const strippedPath = stripLineNumberSuffix(pathName);
+      if (strippedPath && strippedPath !== pathName) {
+        onDebugMessage(
+          `Path "${pathName}" not found directly, attempting to resolve without line suffix: "${strippedPath}"`,
+        );
+        return resolveAtCommandPath(strippedPath, config, onDebugMessage);
       }
-      onDebugMessage(
-        `Unexpected error stating path ${pathName}: ${getErrorMessage(error)}`,
-      );
       return { status: 'not_found' };
     }
   }
@@ -144,6 +167,14 @@ export async function resolveAtCommandPath(
     return { status: 'unauthorized', ...lastUnauthorized };
   }
 
+  const strippedPath = stripLineNumberSuffix(pathName);
+  if (strippedPath && strippedPath !== pathName) {
+    onDebugMessage(
+      `Path "${pathName}" not found directly, attempting to resolve without line suffix: "${strippedPath}"`,
+    );
+    return resolveAtCommandPath(strippedPath, config, onDebugMessage);
+  }
+
   return { status: 'not_found' };
 }
 
@@ -191,10 +222,12 @@ function tryExtractPath(noisyString: string): string | null {
 
     if (segmentToClean.length === 0) continue;
 
-    // 2. Strip trailing line/column numbers (e.g. src/main.ts:10:5)
+    // 2. Strip trailing line/column/range numbers (e.g. src/main.ts:10:5, src/main.ts:10-20, src/main.ts#L10-#L25)
     // We handle the case where it might be wrapped in more text, e.g. at (src/index.ts:123)
-    const lineMatch = segmentToClean.match(/^(.+?):(\d+)(?::\d+)?/);
-    const pathOnly = lineMatch ? lineMatch[1] : segmentToClean;
+    const strippedLineSuffix = stripLineNumberSuffix(segmentToClean);
+    const lineMatch =
+      strippedLineSuffix ?? segmentToClean.match(/^(.+?):(\d+)(?::\d+)?/)?.[1];
+    const pathOnly = lineMatch ?? segmentToClean;
 
     // 3. Validate the extracted segment using centralized heuristics.
     // We rely on validatePath and Config.validatePathAccess for robust checking
```

---

### Incident Patch 7: `5b71659d` (2026-10-01)
**Commit Message**: fix(cli): ensure Ctrl+C emergency abort reaches cancellation handler during active operations (#29586)

**File**: `packages/cli/src/ui/components/InputPrompt.test.tsx` (modified, +38/-0)
```diff
@@ -244,6 +244,20 @@ describe('InputPrompt', () => {
     return null;
   };
 
+  const GlobalQuitHandler = ({ onQuit }: { onQuit: () => void }) => {
+    useKeypress(
+      (key) => {
+        if (key.ctrl && key.name === 'c') {
+          onQuit();
+          return true;
+        }
+        return false;
+      },
+      { isActive: true, priority: false },
+    );
+    return null;
+  };
+
   const mockedUseShellHistory = vi.mocked(useShellHistory);
   const mockedUseCommandCompletion = vi.mocked(useCommandCompletion);
   const mockedUseInputHistory = vi.mocked(useInputHistory);
@@ -2879,6 +2893,30 @@ describe('InputPrompt', () => {
       unmount();
     });
 
+    it('should allow Ctrl+C to reach global cancellation handler when responding even if buffer has text', async () => {
+      props.shellModeActive = false;
+      props.streamingState = StreamingState.Responding;
+      props.buffer.text = 'some text typed during generation';
+      const onGlobalQuit = vi.fn();
+
+      const { stdin, unmount } = await renderWithProviders(
+        <>
+          <GlobalQuitHandler onQuit={onGlobalQuit} />
+          <TestInputPrompt {...props} />
+        </>,
+      );
+
+      await act(async () => {
+        stdin.write('\x03');
+        vi.advanceTimersByTime(100);
+      });
+
+      await waitFor(() => {
+        expect(onGlobalQuit).toHaveBeenCalledTimes(1);
+      });
+      unmount();
+    });
+
     it('should handle ESC when completion suggestions are showing', async () => {
       mockedUseCommandCompletion.mockReturnValue({
         ...mockCommandCompletion,
```

**File**: `packages/cli/src/ui/components/InputPrompt.tsx` (modified, +6/-0)
```diff
@@ -1345,6 +1345,12 @@ export const InputPrompt: React.FC<InputPromptProps> = ({
         return false;
       }
 
+      // If we're generating and user presses Ctrl+C (QUIT), do not swallow it as
+      // CLEAR_INPUT in the text buffer; let it propagate to cancel ongoing operations.
+      if (isGenerating && keyMatchers[Command.QUIT](key)) {
+        return false;
+      }
+
       // Fall back to the text buffer's default input handling for all other keys
       const handled = buffer.handleInput(key);
 
```

**File**: `packages/cli/src/ui/contexts/KeypressContext.test.tsx` (modified, +34/-0)
```diff
@@ -1545,4 +1545,38 @@ describe('KeypressContext', () => {
       },
     );
   });
+
+  describe('SGR mouse sequence handling', () => {
+    it('should not trap subsequent keypresses when an incomplete SGR sequence times out', async () => {
+      const { keyHandler } = await setupKeypressTest();
+
+      // Send incomplete SGR sequence
+      act(() => stdin.write('\x1b[<0;10;'));
+
+      // Timeout expires
+      await act(async () => {
+        await vi.advanceTimersByTimeAsync(ESC_TIMEOUT);
+      });
+
+      // Subsequent Ctrl+C should be received cleanly
+      act(() => stdin.write('\x03'));
+
+      expect(keyHandler).toHaveBeenCalledWith(
+        expect.objectContaining({
+          name: 'c',
+          ctrl: true,
+        }),
+      );
+    });
+
+    it('should filter out complete SGR mouse events from regular keypress handler', async () => {
+      const { keyHandler } = await setupKeypressTest();
+
+      // Complete SGR mouse press event
+      act(() => stdin.write('\x1b[<0;10;20M'));
+
+      // Filtered out by nonKeyboardEventFilter
+      expect(keyHandler).not.toHaveBeenCalled();
+    });
+  });
 });
```

**File**: `packages/cli/src/ui/contexts/KeypressContext.tsx` (modified, +14/-1)
```diff
@@ -538,11 +538,24 @@ function* emitKeys(
         } else if (ch === '<') {
           // SGR mouse mode
           ch = yield;
-          sequence += ch;
           // Don't skip on empty string here to avoid timeouts on slow events.
           while (ch === '' || ch === ';' || (ch >= '0' && ch <= '9')) {
+            sequence += ch;
             ch = yield;
+          }
+          if (ch === 'm' || ch === 'M') {
             sequence += ch;
+          } else if (ch === '\x03') {
+            keypressHandler({
+              name: 'c',
+              ctrl: true,
+              shift: false,
+              alt: false,
+              cmd: false,
+              insertable: false,
+              sequence: '\x03',
+            });
+            continue;
           }
         } else if (ch === 'M') {
           // X11 mouse mode
```

**File**: `packages/cli/src/ui/emergency-stop.test.tsx` (added, +156/-0)
```diff
@@ -0,0 +1,156 @@
+/**
+ * @license
+ * Copyright 2026 Google LLC
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+import {
+  describe,
+  it,
+  expect,
+  vi,
+  beforeEach,
+  afterEach,
+  type Mock,
+} from 'vitest';
+import { act } from 'react';
+import { EventEmitter } from 'node:events';
+import { useStdin } from 'ink';
+import { renderHookWithProviders } from '../test-utils/render.js';
+import {
+  useKeypressContext,
+  ESC_TIMEOUT,
+  KeypressPriority,
+  type Key,
+} from './contexts/KeypressContext.js';
+
+// Mock ink's useStdin to feed custom stdin bytes
+vi.mock('ink', async (importOriginal) => {
+  const original = await importOriginal<typeof import('ink')>();
+  return {
+    ...original,
+    useStdin: vi.fn(),
+  };
+});
+
+class MockStdin extends EventEmitter {
+  isTTY = true;
+  setRawMode = vi.fn();
+  override on = this.addListener;
+  override removeListener = super.removeListener;
+  resume = vi.fn();
+  pause = vi.fn();
+
+  write(text: string) {
+    this.emit('data', text);
+  }
+}
+
+describe('Emergency Stop & Input Handling Fixes (b/561556027)', () => {
+  let stdin: MockStdin;
+  const mockSetRawMode = vi.fn();
+
+  beforeEach(() => {
+    vi.clearAllMocks();
+    stdin = new MockStdin();
+    (useStdin as Mock).mockReturnValue({
+      stdin,
+      setRawMode: mockSetRawMode,
+    });
+  });
+
+  describe('Fix 1: SGR Mouse Hijack & Stdin Race Condition Traps Emergency Ctrl+C', () => {
+    beforeEach(() => {
+      vi.useFakeTimers();
+    });
+
+    afterEach(() => {
+      vi.useRealTimers();
+    });
+
+    it('reliably emits Ctrl+C when an incomplete SGR mouse sequence was received prior to timeout', async () => {
+      const keyHandler = vi.fn();
+      const { result } = await renderHookWithProviders(() =>
+        useKeypressContext(),
+      );
+      act(() => result.current.subscribe(keyHandler, KeypressPriority.High));
+
+      // 1. Terminal or touch event sends a fragmented SGR mouse sequence:
+      // \x1b[<0;10; (missing the row coordinate and terminator 'M' or 'm')
+      act(() => {
+        stdin.write('\x1b[<0;10;');
+      });
+
+      // 2. Timeout expires (ESC_TIMEOUT = 50ms)
+      await act(async () => {
+        await vi.advanceTimersByTimeAsync(ESC_TIMEOUT);
+      });
+
+      // 3. User attempts Emergency Stop by pressing Ctrl+C (\x03)
+      act(() => {
+        stdin.write('\x03');
+      });
+
+      // The application MUST receive a valid Ctrl+C key event to abort the agent.
+      expect(keyHandler).toHaveBeenCalledWith(
+        expect.objectContaining({
+          name: 'c',
+          ctrl: true,
+        }),
+      );
+    });
+  });
+
+  describe('Fix 2: Runaway Agent "No Brakes" - Ctrl+C propagation during generation', () => {
+    it('allows Ctrl+C to propagate to cancellation handlers when generating even if text buffer has input', async () => {
+      const { result: contextResult } = await renderHookWithProviders(() =>
+        useKeypressContext(),
+      );
+
+      const cancelOngoingRequestMock = vi.fn();
+      let isGenerating = true;
+
+      // Outer handler (simulating AppContainer or stream cancellation hook)
+      act(() => {
+        contextResult.current.subscribe((key: Key) => {
+          if (key.ctrl && key.name === 'c') {
+            cancelOngoingRequestMock();
+            return true;
+          }
+          return false;
+        }, KeypressPriority.High);
+      });
+
+      // Inner handler (simulating InputPrompt mounted after AppContainer)
+      act(() => {
+        contextResult.current.subscribe((key: Key) => {
+          // If generating, do not swallow Ctrl+C into local input buffer
+          if (isGenerating && key.ctrl && key.name === 'c') {
+            return false;
+          }
+          // Otherwise consume locally (simulating CLEAR_INPUT)
+          return true;
+        }, KeypressPriority.High);
+      });
+
+      // Press Ctrl+C while generating
+      act(() => {
+        stdin.write('\x03');
+      });
+
+      // cancelOngoingRequestMock MUST be called!
+      expect(cancelOngoingRequestMock).toHaveBeenCalledTimes(1);
+
+      // Now simulate generation finished (idle)
+      isGenerating = false;
+      cancelOngoingRequestMock.mockClear();
+
+      // Press Ctrl+C when idle: consumed locally by buffer handler
+      act(() => {
+        stdin.write('\x03');
+      });
+
+      expect(cancelOngoingRequestMock).not.toHaveBeenCalled();
+    });
+  });
+});
```

---

### Incident Patch 8: `5e6915c9` (2026-10-01)
**Commit Message**: fix(cli): persist state atomically and recover from backup on corruption (#29558)

**File**: `packages/cli/src/utils/persistentState.test.ts` (modified, +110/-9)
```diff
@@ -47,37 +47,138 @@ describe('PersistentState', () => {
     expect(value).toBeUndefined();
   });
 
-  it('should save state to file', () => {
+  it('should save state atomically to file', () => {
+    const mockFd = 42;
     vi.mocked(fs.existsSync).mockReturnValue(false);
+    vi.mocked(fs.openSync).mockReturnValue(mockFd);
+
     persistentState.set('defaultBannerShownCount', { banner1: 1 });
 
     expect(fs.mkdirSync).toHaveBeenCalledWith(path.normalize(mockDir), {
       recursive: true,
     });
+    expect(fs.openSync).toHaveBeenCalledWith(
+      expect.stringMatching(/\.state\.json\..*\.tmp$/),
+      'w',
+      0o600,
+    );
     expect(fs.writeFileSync).toHaveBeenCalledWith(
-      mockFilePath,
+      mockFd,
       JSON.stringify({ defaultBannerShownCount: { banner1: 1 } }, null, 2),
+      'utf-8',
+    );
+    expect(fs.fsyncSync).toHaveBeenCalledWith(mockFd);
+    expect(fs.closeSync).toHaveBeenCalledWith(mockFd);
+    expect(fs.renameSync).toHaveBeenCalledWith(
+      expect.stringMatching(/\.state\.json\..*\.tmp$/),
+      mockFilePath,
     );
   });
 
-  it('should handle load errors and start fresh', () => {
-    vi.mocked(fs.existsSync).mockReturnValue(true);
+  it('should create a backup file when saving over an existing state file', () => {
+    const mockFd = 42;
+    vi.mocked(fs.existsSync).mockImplementation((p) => p === mockFilePath);
+    vi.mocked(fs.openSync).mockReturnValue(mockFd);
+
+    persistentState.set('defaultBannerShownCount', { banner1: 1 });
+
+    expect(fs.copyFileSync).toHaveBeenCalledWith(
+      mockFilePath,
+      `${mockFilePath}.bak`,
+    );
+    expect(fs.renameSync).toHaveBeenCalledWith(
+      expect.stringMatching(/\.state\.json\..*\.tmp$/),
+      mockFilePath,
+    );
+  });
+
+  it('should handle load errors, preserve corrupt file, and start fresh if no backup', () => {
+    vi.mocked(fs.existsSync).mockImplementation((p) => p === mockFilePath);
     vi.mocked(fs.readFileSync).mockImplementation(() => {
       throw new Error('Read error');
     });
 
     const value = persistentState.get('defaultBannerShownCount');
     expect(value).toBeUndefined();
     expect(debugLogger.warn).toHaveBeenCalled();
+    expect(fs.renameSync).toHaveBeenCalledWith(
+      mockFilePath,
+      `${mockFilePath}.corrupt`,
+    );
   });
 
-  it('should handle save errors', () => {
-    vi.mocked(fs.existsSync).mockReturnValue(false);
-    vi.mocked(fs.writeFileSync).mockImplementation(() => {
-      throw new Error('Write error');
+  it('should unlink existing corrupt file before renaming on load error', () => {
+    vi.mocked(fs.existsSync).mockImplementation(
+      (p) => p === mockFilePath || p === `${mockFilePath}.corrupt`,
+    );
+    vi.mocked(fs.readFileSync).mockImplementation(() => {
+      throw new Error('Read error');
+    });
+
+    const value = persistentState.get('defaultBannerShownCount');
+    expect(value).toBeUndefined();
+    expect(fs.unlinkSync).toHaveBeenCalledWith(`${mockFilePath}.corrupt`);
+    expect(fs.renameSync).toHaveBeenCalledWith(
+      mockFilePath,
+      `${mockFilePath}.corrupt`,
+    );
+  });
+
+  it('should unlink corrupt file if rename fails', () => {
+    vi.mocked(fs.existsSync).mockImplementation((p) => p === mockFilePath);
+    vi.mocked(fs.readFileSync).mockImplementation(() => {
+      throw new Error('Read error');
+    });
+    vi.mocked(fs.renameSync).mockImplementation(() => {
+      throw new Error('Rename error');
     });
 
+    const value = persistentState.get('defaultBannerShownCount');
+    expect(value).toBeUndefined();
+    expect(fs.unlinkSync).toHaveBeenCalledWith(mockFilePath);
+  });
+
+  it('should recover state from backup if primary file fails to load', () => {
+    const backupData = { defaultBannerShownCount: { banner1: 5 } };
+    vi.mocked(fs.existsSync).mockImplementation(
+      (p) => p === mockFilePath || p === `${mockFilePath}.bak`,
+    );
+    vi.mocked(fs.readFileSync).mockImplementation((p) => {
+      if (p === mockFilePath) {
+        throw new Error('Corrupt state');
+      }
+      if (p === `${mockFilePath}.bak`) {
+        return JSON.stringify(backupData);
+      }
+      throw new Error('File not found');
+    });
+
+    const value = persistentState.get('defaultBannerShownCount');
+    expect(value).toEqual(backupData.defaultBannerShownCount);
+    expect(debugLogger.warn).toHaveBeenCalledWith(
+      'Recovered persistent state from backup',
+    );
+    expect(fs.copyFileSync).not.toHaveBeenCalled();
+  });
+
+  it('should handle save errors and clean up temporary file', () => {
+    const mockFd = 42;
+    vi.mocked(fs.openSync).mockReturnValue(mockFd);
+    vi.mocked(fs.renameSync).mockImplementation(() => {
+      throw new Error('Rename error');
+    });
+    vi.mocked(fs.existsSync).mockImplementation(
+      (p) => typeof p === 'string' && p.endsWith('.tmp'),
+    );
+
     persistentState.set('defaultBannerShownCount', { banner1: 1 });
-    expect(debugLogger.w
```

**File**: `packages/cli/src/utils/persistentState.ts` (modified, +94/-16)
```diff
@@ -20,6 +20,12 @@ interface PersistentStateData {
   // Add other persistent state keys here as needed
 }
 
+function isPersistentStateData(obj: unknown): obj is PersistentStateData {
+  return typeof obj === 'object' && obj !== null && !Array.isArray(obj);
+}
+
+let tempCounter = 0;
+
 export class PersistentState {
   private cache: PersistentStateData | null = null;
   private filePath: string | null = null;
@@ -35,34 +41,106 @@ export class PersistentState {
     if (this.cache) {
       return this.cache;
     }
-    try {
-      const filePath = this.getPath();
-      if (fs.existsSync(filePath)) {
+    const filePath = this.getPath();
+    const backupPath = `${filePath}.bak`;
+    const corruptPath = `${filePath}.corrupt`;
+
+    if (fs.existsSync(filePath)) {
+      try {
         const content = fs.readFileSync(filePath, 'utf-8');
-        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
-        this.cache = JSON.parse(content);
-      } else {
-        this.cache = {};
+        const parsed: unknown = JSON.parse(content);
+        if (isPersistentStateData(parsed)) {
+          this.cache = parsed;
+          return this.cache;
+        }
+        throw new Error('Persistent state is not a valid JSON object');
+      } catch (error) {
+        debugLogger.warn('Failed to load persistent state:', error);
+        try {
+          if (fs.existsSync(filePath)) {
+            if (fs.existsSync(corruptPath)) {
+              fs.unlinkSync(corruptPath);
+            }
+            fs.renameSync(filePath, corruptPath);
+          }
+        } catch {
+          try {
+            fs.unlinkSync(filePath);
+          } catch {
+            // Ignore failure to remove corrupt file
+          }
+        }
+      }
+    }
+
+    if (fs.existsSync(backupPath)) {
+      try {
+        const bakContent = fs.readFileSync(backupPath, 'utf-8');
+        const bakParsed: unknown = JSON.parse(bakContent);
+        if (isPersistentStateData(bakParsed)) {
+          debugLogger.warn('Recovered persistent state from backup');
+          this.cache = bakParsed;
+          this.save(true);
+          return this.cache;
+        }
+      } catch (bakError) {
+        debugLogger.warn(
+          'Failed to load persistent state from backup:',
+          bakError,
+        );
       }
-    } catch (error) {
-      debugLogger.warn('Failed to load persistent state:', error);
-      // If error reading (e.g. corrupt JSON), start fresh
-      this.cache = {};
     }
-    return this.cache!;
+
+    this.cache = {};
+    return this.cache;
   }
 
-  private save() {
+  private save(skipBackup = false) {
     if (!this.cache) return;
+    const filePath = this.getPath();
+    const dir = path.dirname(filePath);
+    const tempPath = path.join(
+      dir,
+      `.${STATE_FILENAME}.${process.pid}.${Date.now()}.${tempCounter++}.tmp`,
+    );
+
     try {
-      const filePath = this.getPath();
-      const dir = path.dirname(filePath);
       if (!fs.existsSync(dir)) {
         fs.mkdirSync(dir, { recursive: true });
       }
-      fs.writeFileSync(filePath, JSON.stringify(this.cache, null, 2));
+
+      const content = JSON.stringify(this.cache, null, 2);
+      const fd = fs.openSync(tempPath, 'w', 0o600);
+      try {
+        fs.writeFileSync(fd, content, 'utf-8');
+        try {
+          fs.fsyncSync(fd);
+        } catch {
+          // fsync can fail on unsupported or virtualized filesystems
+        }
+      } finally {
+        fs.closeSync(fd);
+      }
+
+      const backupPath = `${filePath}.bak`;
+      if (!skipBackup && fs.existsSync(filePath)) {
+        try {
+          fs.copyFileSync(filePath, backupPath);
+        } catch (err) {
+          debugLogger.warn('Failed to update persistent state backup:', err);
+        }
+      }
+
+      fs.renameSync(tempPath, filePath);
     } catch (error) {
       debugLogger.warn('Failed to save persistent state:', error);
+      try {
+        if (fs.existsSync(tempPath)) {
+          fs.unlinkSync(tempPath);
+        }
+      } catch {
+        // Ignore cleanup error
+      }
     }
   }
 
```

**File**: `packages/cli/src/utils/persistentStateRecovery.test.ts` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
+/**
+ * @license
+ * Copyright 2026 Google LLC
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
+import * as fs from 'node:fs';
+import * as path from 'node:path';
+import * as os from 'node:os';
+import { Storage } from '@google/gemini-cli-core';
+import { PersistentState } from './persistentState.js';
+
+describe('PersistentState Recovery & Atomic Persist', () => {
+  let tempDir: string;
+  let stateFilePath: string;
+  let backupFilePath: string;
+  let corruptFilePath: string;
+
+  beforeEach(() => {
+    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gemini-state-test-'));
+    stateFilePath = path.join(tempDir, 'state.json');
+    backupFilePath = path.join(tempDir, 'state.json.bak');
+    corruptFilePath = path.join(tempDir, 'state.json.corrupt');
+
+    vi.spyOn(Storage, 'getGlobalGeminiDir').mockReturnValue(tempDir);
+  });
+
+  afterEach(() => {
+    vi.restoreAllMocks();
+    if (fs.existsSync(tempDir)) {
+      fs.rmSync(tempDir, { recursive: true, force: true });
+    }
+  });
+
+  it('recovers state from .bak file when state.json is truncated mid-write', () => {
+    const backupData = {
+      terminalSetupPromptShown: true,
+      tipsShown: 8,
+      startupWarningCounts: { 'home-directory': 2 },
+    };
+    fs.writeFileSync(
+      backupFilePath,
+      JSON.stringify(backupData, null, 2),
+      'utf-8',
+    );
+
+    // Simulate truncated file from interrupted/crash write
+    fs.writeFileSync(
+      stateFilePath,
+      '{\n  "terminalSetupPromptShown": true,\n  "tips',
+      'utf-8',
+    );
+
+    const persistentState = new PersistentState();
+
+    // Must recover terminalSetupPromptShown: true from backup instead of returning undefined
+    expect(persistentState.get('terminalSetupPromptShown')).toBe(true);
+    expect(persistentState.get('tipsShown')).toBe(8);
+  });
+
+  it('preserves corrupt state.json as .corrupt when JSON parsing fails', () => {
+    fs.writeFileSync(
+      stateFilePath,
+      '{\n  "corruptedJson": true,\n  "unterminated',
+      'utf-8',
+    );
+
+    const persistentState = new PersistentState();
+    persistentState.get('tipsShown');
+
+    // Corrupt copy must be preserved for debugging/recovery rather than silently dropped
+    expect(fs.existsSync(corruptFilePath)).toBe(true);
+  });
+
+  it('does not wipe prior state on subsequent set() after recovering from backup', () => {
+    const backupData = {
+      terminalSetupPromptShown: true,
+      defaultBannerShownCount: { 'banner-v1': 3 },
+    };
+    fs.writeFileSync(
+      backupFilePath,
+      JSON.stringify(backupData, null, 2),
+      'utf-8',
+    );
+    fs.writeFileSync(stateFilePath, '{\n  "corrupt', 'utf-8');
+
+    const persistentState = new PersistentState();
+    persistentState.set('tipsShown', 1);
+
+    // Prior values from backup should be preserved in state.json, not obliterated
+    const savedContent = JSON.parse(fs.readFileSync(stateFilePath, 'utf-8'));
+    expect(savedContent).toMatchObject({
+      terminalSetupPromptShown: true,
+      defaultBannerShownCount: { 'banner-v1': 3 },
+      tipsShown: 1,
+    });
+  });
+
+  it('handles pre-existing .corrupt file when preserving a newly corrupted state.json', () => {
+    // Pre-existing .corrupt file from a previous event
+    fs.writeFileSync(corruptFilePath, 'old-corrupt-data', 'utf-8');
+
+    const backupData = {
+      tipsShown: 7,
+      terminalSetupPromptShown: true,
+    };
+    fs.writeFileSync(
+      backupFilePath,
+      JSON.stringify(backupData, null, 2),
+      'utf-8',
+    );
+
+    // Newly corrupted state.json
+    fs.writeFileSync(stateFilePath, '{"tipsShown": 8, "invalid', 'utf-8');
+
+    const persistentState = new PersistentState();
+    const tips = persistentState.get('tipsShown');
+
+    expect(tips).toBe(7);
+    expect(fs.readFileSync(corruptFilePath, 'utf-8')).toBe(
+      '{"tipsShown": 8, "invalid',
+    );
+  });
+});
```

---

### Incident Patch 9: `d1cc08a8` (2026-10-01)
**Commit Message**: fix(core): implement append-only delta patching and bounded history windowing in ChatRecordingService (#29568)

Co-authored-by: David Pierce <[REDACTED_EMAIL]>

**File**: `packages/core/src/services/chatRecordingService.test.ts` (modified, +472/-0)
```diff
@@ -43,6 +43,7 @@ import {
   hasResumableConversationContent,
   isResumableMessageRecord,
   loadConversationRecord,
+  MAX_HISTORY_MESSAGES,
   type ConversationRecord,
   type ToolCallRecord,
   type MessageRecord,
@@ -1684,4 +1685,475 @@ describe('ChatRecordingService', () => {
       expect(record2!.messages[1].id).toBe('h2');
     });
   });
+
+  describe('append-only delta patching and memory bounding', () => {
+    it('should append atomic delta patches instead of $set: { messages } when updating tool results or turns', async () => {
+      await chatRecordingService.initialize();
+
+      const userMsgId = chatRecordingService.recordMessage({
+        type: 'user',
+        content: 'Run tool',
+        model: 'gemini-pro',
+      });
+      const modelMsgId = chatRecordingService.recordMessage({
+        type: 'gemini',
+        content: 'Running tool...',
+        model: 'gemini-pro',
+      });
+
+      const callId = 'tool-call-delta-1';
+      chatRecordingService.recordToolCalls('gemini-pro', [
+        {
+          id: callId,
+          name: 'read_file',
+          args: { path: 'large.txt' },
+          result: [{ text: 'x'.repeat(10000) }],
+          status: CoreToolCallStatus.Success,
+          timestamp: new Date().toISOString(),
+        },
+      ]);
+
+      const maskedOutput = '<tool_output_masked>masked</tool_output_masked>';
+      const history: HistoryTurn[] = [
+        {
+          id: userMsgId,
+          content: { role: 'user', parts: [{ text: 'Run tool' }] },
+        },
+        {
+          id: modelMsgId,
+          content: {
+            role: 'model',
+            parts: [
+              {
+                functionCall: {
+                  id: callId,
+                  name: 'read_file',
+                  args: { path: 'large.txt' },
+                },
+              },
+            ],
+          },
+        },
+        {
+          id: 'tool-resp-turn-1',
+          content: {
+            role: 'user',
+            parts: [
+              {
+                functionResponse: {
+                  id: callId,
+                  name: 'read_file',
+                  response: { output: maskedOutput },
+                },
+              },
+            ],
+          },
+        },
+      ];
+
+      chatRecordingService.updateMessagesFromHistory(history);
+
+      const sessionFile = chatRecordingService.getConversationFilePath()!;
+      const rawLines = fs
+        .readFileSync(sessionFile, 'utf8')
+        .trim()
+        .split('\n')
+        .map((line) => JSON.parse(line));
+
+      // Verify NO line contains { $set: { messages: [...] } }
+      for (const record of rawLines) {
+        if (record && typeof record === 'object' && '$set' in record) {
+          expect(record.$set).not.toHaveProperty('messages');
+        }
+      }
+
+      const loaded = await loadConversationRecord(sessionFile);
+      expect(loaded).not.toBeNull();
+      const loadedGemini = loaded!.messages.find((m) => m.id === modelMsgId);
+      expect(loadedGemini?.type).toBe('gemini');
+      if (loadedGemini?.type === 'gemini') {
+        expect(loadedGemini.toolCalls?.[0].result).toEqual([
+          {
+            functionResponse: {
+              id: callId,
+              name: 'read_file',
+              response: { output: maskedOutput },
+            },
+          },
+        ]);
+      }
+    });
+
+    it('should scale file size linearly O(n) and bound in-memory cached messages over 100+ turns with large tool outputs', async () => {
+      await chatRecordingService.initialize();
+
+      const totalTurns = 100;
+      const payloadSize = 50 * 1024; // 50 KB per turn
+      const largePayload = 'A'.repeat(payloadSize);
+      const history: HistoryTurn[] = [];
+      let firstTurnUserMsgId = '';
+
+      for (let i = 0; i < totalTurns; i++) {
+        const userId = chatRecordingService.recordMessage({
+          type: 'user',
+          content: `User prompt ${i}`,
+          model: 'gemini-pro',
+        });
+        if (i === 0) {
+          firstTurnUserMsgId = userId;
+        }
+        const modelId = chatRecordingService.recordMessage({
+          type: 'gemini',
+          content: `Model response ${i}`,
+          model: 'gemini-pro',
+        });
+        const callId = `call-${i}`;
+        const toolResultParts: Part[] = [
+          {
+            functionResponse: {
+              id: callId,
+              name: 'read_file',
+              response: { output: largePayload },
+            },
+          },
+        ];
+        chatRecordingService.recordToolCalls('gemini-pro', [
+          {
+            id: callId,
+            name: 'read_file',
+            args: { index: i },
+            result: toolResultParts,
+            status: CoreToolCallStatus.Success,
+            timestamp: new Date().toISOString(),
+          },
+        ]);
+
+        history.push(
+          {
+            id: userId,
+            content: { role: 'user', parts: [{ te
```

**File**: `packages/core/src/services/chatRecordingService.ts` (modified, +785/-259)
```diff
@@ -27,6 +27,7 @@ import { partListUnionToString } from '../core/geminiRequest.js';
 import { isIgnoredUserContent } from '../utils/sessionUtils.js';
 import {
   SESSION_FILE_PREFIX,
+  MAX_HISTORY_MESSAGES,
   type TokensSummary,
   type ToolCallRecord,
   type ConversationRecordExtra,
@@ -35,6 +36,8 @@ import {
   type ResumedSessionData,
   type LoadConversationOptions,
   type RewindRecord,
+  type MessagePatch,
+  type MessagePatchRecord,
   type MetadataUpdateRecord,
   type PartialMetadataRecord,
 } from './chatRecordingTypes.js';
@@ -77,8 +80,12 @@ function isRewindRecord(record: unknown): record is RewindRecord {
   return isStringProperty(record, '$rewindTo');
 }
 
+function isMessagePatchRecord(record: unknown): record is MessagePatchRecord {
+  return isObjectProperty(record, '$patch');
+}
+
 function isMessageRecord(record: unknown): record is MessageRecord {
-  return isStringProperty(record, 'id');
+  return isStringProperty(record, 'id') && !hasProperty(record, '$patch');
 }
 
 function isMetadataUpdateRecord(
@@ -100,6 +107,112 @@ function isTextPart(part: unknown): part is { text: string } {
   return isStringProperty(part, 'text');
 }
 
+function isRecordObject(value: unknown): value is Record<string, unknown> {
+  return value !== null && typeof value === 'object' && !Array.isArray(value);
+}
+
+interface ContentFingerprint {
+  digest: string;
+}
+
+interface MessageMeta {
+  id: string;
+  type: MessageRecord['type'];
+  isResumable: boolean;
+  contentFp: ContentFingerprint;
+}
+
+interface ToolCallMeta {
+  id: string;
+  messageId: string;
+  resultFp: ContentFingerprint;
+}
+
+function computeContentDigest(value: PartListUnion | null | undefined): string {
+  let h1 = 0xdeadbeef;
+  let h2 = 0x41c6ce57;
+  let totalLen = 0;
+
+  const mix = (code: number): void => {
+    h1 = Math.imul(h1 ^ code, 2654435761);
+    h2 = Math.imul(h2 ^ code, 1597334677);
+    totalLen++;
+  };
+
+  const mixString = (str: string): void => {
+    const len = str.length;
+    mix(len);
+    totalLen += len;
+    for (let i = 0; i < len; i++) {
+      const ch = str.charCodeAt(i);
+      h1 = Math.imul(h1 ^ ch, 2654435761);
+      h2 = Math.imul(h2 ^ ch, 1597334677);
+    }
+  };
+
+  const visit = (val: unknown): void => {
+    if (val === null || val === undefined) {
+      mix(0);
+      return;
+    }
+    if (typeof val === 'string') {
+      mix(1);
+      mixString(val);
+    } else if (typeof val === 'number') {
+      mix(2);
+      mixString(String(val));
+    } else if (typeof val === 'boolean') {
+      mix(3);
+      mix(val ? 1 : 0);
+    } else if (Array.isArray(val)) {
+      mix(4);
+      mix(val.length);
+      for (let i = 0; i < val.length; i++) {
+        visit(val[i]);
+      }
+    } else if (isRecordObject(val)) {
+      mix(5);
+      const keys = Object.keys(val).sort();
+      mix(keys.length);
+      for (let i = 0; i < keys.length; i++) {
+        const k = keys[i];
+        mixString(k);
+        visit(val[k]);
+      }
+    }
+  };
+
+  visit(value ?? []);
+
+  h1 =
+    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
+    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
+  h2 =
+    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
+    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
+  return `${totalLen}:${h1 >>> 0}:${h2 >>> 0}`;
+}
+
+function createFingerprint(
+  value: PartListUnion | null | undefined,
+): ContentFingerprint {
+  return {
+    digest: computeContentDigest(value),
+  };
+}
+
+function updateFingerprintIfChanged(
+  fp: ContentFingerprint,
+  nextValue: PartListUnion | null | undefined,
+): boolean {
+  const nextDigest = computeContentDigest(nextValue);
+  if (nextDigest === fp.digest) {
+    return false;
+  }
+  fp.digest = nextDigest;
+  return true;
+}
+
 /**
  * Returns true when a stored message represents conversation content worth
  * surfacing in resume flows.
@@ -130,223 +243,312 @@ export function hasResumableConversationContent(
   return messages.some((message) => isResumableMessageRecord(message));
 }
 
-export async function loadConversationRecord(
-  filePath: string,
-  options?: LoadConversationOptions,
-): Promise<
-  | (ConversationRecord & {
-      messageCount?: number;
-      userMessageCount?: number;
-      firstUserMessage?: string;
-      hasResumableContent?: boolean;
-      memoryScratchpadIsStale?: boolean;
-    })
-  | null
-> {
-  if (!fs.existsSync(filePath)) {
-    return null;
-  }
+type LoadedConversationResult = ConversationRecord & {
+  messageCount?: number;
+  userMessageCount?: number;
+  firstUserMessage?: string;
+  hasResumableContent?: boolean;
+  memoryScratchpadIsStale?: boolean;
+};
+
+function createJsonlRecordAccumulator(options?: LoadConversationOptions) {
+  let metadata: Partial<ConversationRecord> = {};
+  const messagesMap = new Map<string, MessageRecord>();
+  const messageIds: string[] = [];
+  const messageKinds = new Map<
+    string,
+    { isUser: boolean; isResumable: boolean }
+  >();
+  let isTrackingMemoryScratch
```

**File**: `packages/core/src/services/chatRecordingTypes.ts` (modified, +26/-1)
```diff
@@ -124,8 +124,33 @@ export interface RewindRecord {
   $rewindTo: string;
 }
 
+export interface ToolCallPatch {
+  id: string;
+  result?: PartListUnion | null;
+}
+
+export interface MessagePatch {
+  id: string;
+  content?: PartListUnion;
+  toolCalls?: ToolCallPatch[];
+}
+
+export interface MessagePatchRecord {
+  $patch: {
+    id?: string;
+    content?: PartListUnion;
+    toolCalls?: ToolCallPatch[];
+    updates?: MessagePatch[];
+    removeIds?: string[];
+    orderIds?: string[];
+  };
+}
+
 export interface MetadataUpdateRecord {
-  $set: Partial<ConversationRecord>;
+  $set: Partial<Omit<ConversationRecord, 'messages'>> & {
+    /** @deprecated Legacy full-history checkpoint; use append-only MessageRecord and MessagePatchRecord instead. */
+    messages?: MessageRecord[];
+  };
 }
 
 export interface PartialMetadataRecord {
```

---

### Incident Patch 10: `c6bccb7e` (2026-09-30)
**Commit Message**: fix(core): serialize file tool operations and make writes atomic (#29078) (#29499)

Co-authored-by: David Pierce <[REDACTED_EMAIL]>

**File**: `packages/core/src/services/fileSystemService.atomic.test.ts` (added, +116/-0)
```diff
@@ -0,0 +1,116 @@
+/**
+ * @license
+ * Copyright 2026 Google LLC
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+import { describe, it, expect, beforeEach, afterEach } from 'vitest';
+import fs from 'node:fs';
+import fsp from 'node:fs/promises';
+import os from 'node:os';
+import path from 'node:path';
+import { StandardFileSystemService } from './fileSystemService.js';
+
+/**
+ * These tests exercise the real filesystem on purpose: the behaviour under
+ * test is what a concurrent observer can see on disk while a write is in
+ * flight, which a mocked `fs` cannot express.
+ */
+describe('StandardFileSystemService atomicity', () => {
+  let dir: string;
+  let service: StandardFileSystemService;
+
+  beforeEach(async () => {
+    dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'gemini-atomic-write-'));
+    service = new StandardFileSystemService();
+  });
+
+  afterEach(async () => {
+    await fsp.rm(dir, { recursive: true, force: true });
+  });
+
+  it('never exposes a partially written file to a concurrent observer', async () => {
+    // Large enough that the underlying write is split into several chunks;
+    // old and new are the same length so any other size is a partial state.
+    const SIZE = 16 * 1024 * 1024;
+    const filePath = path.join(dir, 'large.txt');
+    await fsp.writeFile(filePath, 'o'.repeat(SIZE), 'utf-8');
+
+    // The write runs on the libuv threadpool, so a *synchronous* loop on the
+    // main thread is what actually catches the destination mid-write. An
+    // async reader tends to be scheduled only before or after it.
+    const sizes = new Set<number>();
+    let settled = false;
+    const write = service
+      .writeTextFile(filePath, 'n'.repeat(SIZE))
+      .finally(() => {
+        settled = true;
+      });
+
+    let spins = 0;
+    while (!settled && spins < 2_000_000) {
+      try {
+        sizes.add(fs.statSync(filePath).size);
+      } catch {
+        // The destination may briefly not exist while being replaced.
+        sizes.add(-1);
+      }
+      spins++;
+      if (spins % 200 === 0) {
+        await new Promise((resolve) => setImmediate(resolve));
+      }
+    }
+    await write;
+
+    // Guard against a vacuous pass where the observer never ran.
+    expect(sizes.size).toBeGreaterThan(0);
+
+    const partialStates = [...sizes].filter(
+      (size) => size !== SIZE && size !== -1,
+    );
+    expect(partialStates).toEqual([]);
+  });
+
+  it('writes the requested content', async () => {
+    const filePath = path.join(dir, 'content.txt');
+
+    await service.writeTextFile(filePath, 'hello');
+
+    await expect(fsp.readFile(filePath, 'utf-8')).resolves.toBe('hello');
+  });
+
+  it.skipIf(process.platform === 'win32')(
+    'preserves the permissions of an existing file',
+    async () => {
+      const filePath = path.join(dir, 'secret.txt');
+      await fsp.writeFile(filePath, 'before', { mode: 0o600 });
+      await fsp.chmod(filePath, 0o600);
+
+      await service.writeTextFile(filePath, 'after');
+
+      const stats = await fsp.stat(filePath);
+      expect(stats.mode & 0o777).toBe(0o600);
+    },
+  );
+
+  it('leaves no temporary files behind on success', async () => {
+    const filePath = path.join(dir, 'clean.txt');
+
+    await service.writeTextFile(filePath, 'done');
+
+    await expect(fsp.readdir(dir)).resolves.toEqual(['clean.txt']);
+  });
+
+  it('updates the target of a symlink without replacing the symlink itself', async () => {
+    const targetPath = path.join(dir, 'target.txt');
+    const symlinkPath = path.join(dir, 'link.txt');
+    await fsp.writeFile(targetPath, 'original');
+    await fsp.symlink(targetPath, symlinkPath);
+
+    await service.writeTextFile(symlinkPath, 'updated');
+
+    await expect(fsp.readFile(targetPath, 'utf-8')).resolves.toBe('updated');
+    const lstat = await fsp.lstat(symlinkPath);
+    expect(lstat.isSymbolicLink()).toBe(true);
+  });
+});
```

**File**: `packages/core/src/services/fileSystemService.test.ts` (modified, +98/-9)
```diff
@@ -6,12 +6,19 @@
 
 import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
 import fs from 'node:fs/promises';
+import path from 'node:path';
 import { StandardFileSystemService } from './fileSystemService.js';
 
 vi.mock('fs/promises');
 
+function escapeRegex(str: string): string {
+  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
+}
+
 describe('StandardFileSystemService', () => {
   let fileSystem: StandardFileSystemService;
+  const targetFile = path.resolve('/test/file.txt');
+  const tmpPattern = new RegExp(`^${escapeRegex(targetFile)}\\..*\\.tmp$`);
 
   beforeEach(() => {
     vi.resetAllMocks();
@@ -27,33 +34,115 @@ describe('StandardFileSystemService', () => {
       const testContent = 'Hello, World!';
       vi.mocked(fs.readFile).mockResolvedValue(testContent);
 
-      const result = await fileSystem.readTextFile('/test/file.txt');
+      const result = await fileSystem.readTextFile(targetFile);
 
-      expect(fs.readFile).toHaveBeenCalledWith('/test/file.txt', 'utf-8');
+      expect(fs.readFile).toHaveBeenCalledWith(targetFile, 'utf-8');
       expect(result).toBe(testContent);
     });
 
     it('should propagate fs.readFile errors', async () => {
       const error = new Error('ENOENT: File not found');
       vi.mocked(fs.readFile).mockRejectedValue(error);
 
-      await expect(fileSystem.readTextFile('/test/file.txt')).rejects.toThrow(
+      await expect(fileSystem.readTextFile(targetFile)).rejects.toThrow(
         'ENOENT: File not found',
       );
     });
   });
 
   describe('writeTextFile', () => {
-    it('should write file content using fs', async () => {
+    it('should write to a sibling temp file and rename it into place', async () => {
+      vi.mocked(fs.writeFile).mockResolvedValue();
+      vi.mocked(fs.rename).mockResolvedValue();
+      vi.mocked(fs.stat).mockRejectedValue(new Error('ENOENT'));
+
+      await fileSystem.writeTextFile(targetFile, 'Hello, World!');
+
+      const [tmpPath, content, options] = vi.mocked(fs.writeFile).mock
+        .calls[0] as [string, string, { encoding: string }];
+      expect(content).toBe('Hello, World!');
+      expect(options.encoding).toBe('utf-8');
+      expect(tmpPath).toMatch(tmpPattern);
+      expect(fs.rename).toHaveBeenCalledWith(tmpPath, targetFile);
+    });
+
+    it('should match temp file patterns with Windows-style backslash paths', () => {
+      const winTarget = 'C:\\test\\folder\\file.txt';
+      const winTmpPattern = new RegExp(
+        `^${escapeRegex(winTarget)}\\..*\\.tmp$`,
+      );
+      const sampleWinTmp =
+        'C:\\test\\folder\\file.txt.12345678-1234-1234-1234-123456789abc.tmp';
+      expect(sampleWinTmp).toMatch(winTmpPattern);
+    });
+
+    it('should create the temp file with the destination permissions', async () => {
       vi.mocked(fs.writeFile).mockResolvedValue();
+      vi.mocked(fs.rename).mockResolvedValue();
+      vi.mocked(fs.chmod).mockResolvedValue();
+      vi.mocked(fs.stat).mockResolvedValue({
+        mode: 0o600,
+      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
 
-      await fileSystem.writeTextFile('/test/file.txt', 'Hello, World!');
+      const secretFile = path.resolve('/test/secret.txt');
+      await fileSystem.writeTextFile(secretFile, 'Hello, World!');
 
-      expect(fs.writeFile).toHaveBeenCalledWith(
-        '/test/file.txt',
-        'Hello, World!',
-        'utf-8',
+      // Creating the temp file already restricted means the content is never
+      // briefly readable through a wider default mode.
+      const [, , options] = vi.mocked(fs.writeFile).mock.calls[0];
+      expect(options).toEqual({ encoding: 'utf-8', mode: 0o600 });
+    });
+
+    it('should still write the file when chmod is not permitted', async () => {
+      vi.mocked(fs.writeFile).mockResolvedValue();
+      vi.mocked(fs.rename).mockResolvedValue();
+      vi.mocked(fs.rm).mockResolvedValue();
+      vi.mocked(fs.stat).mockResolvedValue({
+        mode: 0o600,
+      } as unknown as Awaited<ReturnType<typeof fs.stat>>);
+      // FAT32/exFAT, some NFS/CIFS mounts and restricted sandboxes reject chmod.
+      vi.mocked(fs.chmod).mockRejectedValue(
+        Object.assign(new Error('operation not supported'), {
+          code: 'ENOTSUP',
+        }),
       );
+
+      await expect(
+        fileSystem.writeTextFile(targetFile, 'Hello, World!'),
+      ).resolves.toBeUndefined();
+
+      expect(fs.rename).toHaveBeenCalled();
+      expect(fs.rm).not.toHaveBeenCalled();
+    });
+
+    it('should remove the temp file when the write fails', async () => {
+      vi.mocked(fs.writeFile).mockRejectedValue(new Error('ENOSPC'));
+      vi.mocked(fs.rm).mockResolvedValue();
+
+      await expect(
+        fileSystem.writeTextFile(targetFile, 'Hello, World!'),
+      ).rejects.toThrow('ENOSPC');
+
+      expect(fs.rename).not.toHaveBeenCalled();
+      const [removed] = vi.mocked(fs.rm).mock.calls[0] as [string];
+      expect(removed).toMatch(tmpPattern
```

**File**: `packages/core/src/services/fileSystemService.ts` (modified, +99/-1)
```diff
@@ -4,7 +4,11 @@
  * SPDX-License-Identifier: Apache-2.0
  */
 
+import { randomUUID } from 'node:crypto';
 import fs from 'node:fs/promises';
+import path from 'node:path';
+import { isNodeError } from '../utils/errors.js';
+import { resolveToRealPath } from '../utils/paths.js';
 
 /**
  * Interface for file system operations that may be delegated to different implementations
@@ -27,6 +31,9 @@ export interface FileSystemService {
   writeTextFile(filePath: string, content: string): Promise<void>;
 }
 
+/** Rename retries, for transient Windows lock errors. */
+const RENAME_MAX_RETRIES = 5;
+
 /**
  * Standard file system implementation
  */
@@ -35,7 +42,98 @@ export class StandardFileSystemService implements FileSystemService {
     return fs.readFile(filePath, 'utf-8');
   }
 
+  /**
+   * Writes `content` to `filePath` atomically.
+   *
+   * A plain `fs.writeFile` truncates the destination and then streams the
+   * content in chunks, so anything reading the file concurrently can observe
+   * a truncated prefix. Writing to a sibling temp file and renaming it into
+   * place means an observer sees either the old file or the new one.
+   */
   async writeTextFile(filePath: string, content: string): Promise<void> {
-    await fs.writeFile(filePath, content, 'utf-8');
+    // When filePath is a symlink, resolve to its real target path so that the
+    // rename updates the underlying target file rather than replacing the
+    // symlink itself with a regular file.
+    let realPath = filePath;
+    try {
+      realPath = resolveToRealPath(filePath);
+    } catch {
+      try {
+        const dir = path.dirname(filePath);
+        const base = path.basename(filePath);
+        realPath = path.join(resolveToRealPath(dir), base);
+      } catch {
+        realPath = filePath;
+      }
+    }
+
+    // The temp file must share a directory with the destination so that the
+    // rename stays within one filesystem, and must be uniquely named so that
+    // concurrent writers do not clobber each other's temp file.
+    const tmpPath = `${realPath}.${randomUUID()}.tmp`;
+
+    // A fresh temp file does not inherit the destination's permissions, so
+    // without this, replacing a 0600 file would silently widen it to the
+    // default mode.
+    const existingMode = await this.getFileMode(realPath);
+
+    try {
+      // Create the temp file already carrying the destination's mode, so the
+      // content is never briefly readable through a wider default mode. The
+      // mode is masked by umask, so this can only be more restrictive.
+      await fs.writeFile(tmpPath, content, {
+        encoding: 'utf-8',
+        ...(existingMode !== undefined ? { mode: existingMode } : {}),
+      });
+
+      if (existingMode !== undefined) {
+        try {
+          // Correct any narrowing that umask applied above. Best effort: some
+          // filesystems (FAT32, exFAT, a few NFS/CIFS mounts) and restricted
+          // sandboxes reject chmod with EPERM/ENOTSUP, and permissions must
+          // not be the reason a write fails.
+          await fs.chmod(tmpPath, existingMode);
+        } catch {
+          // Keep whatever mode the temp file was created with.
+        }
+      }
+
+      await this.renameWithRetry(tmpPath, realPath);
+    } catch (error) {
+      await fs.rm(tmpPath, { force: true }).catch(() => {
+        // Best effort: the original error is the one worth reporting.
+      });
+      throw error;
+    }
+  }
+
+  private async getFileMode(filePath: string): Promise<number | undefined> {
+    try {
+      const stats = await fs.stat(filePath);
+      return stats.mode & 0o777;
+    } catch {
+      // New file, or a destination we cannot stat; keep the default mode.
+      return undefined;
+    }
+  }
+
+  private async renameWithRetry(from: string, to: string): Promise<void> {
+    for (let attempt = 0; attempt < RENAME_MAX_RETRIES; attempt++) {
+      try {
+        await fs.rename(from, to);
+        return;
+      } catch (error: unknown) {
+        // Windows can transiently refuse a rename while another process has
+        // the destination open (antivirus, editors, watchers).
+        const code = isNodeError(error) ? error.code : '';
+        const isRetryable =
+          code === 'EBUSY' || code === 'EPERM' || code === 'EACCES';
+        if (!isRetryable || attempt === RENAME_MAX_RETRIES - 1) {
+          throw error;
+        }
+        const delayMs = Math.pow(2, attempt) * 50;
+        await new Promise((resolve) => setTimeout(resolve, delayMs));
+      }
+    }
   }
 }
```

**File**: `packages/core/src/services/gitService.test.ts` (modified, +32/-0)
```diff
@@ -490,5 +490,37 @@ describe('GitService', () => {
       expect(hoistedMockRaw).toHaveBeenCalledWith('rev-parse', 'HEAD');
       expect(commitHash).toBe('current-head-hash');
     });
+
+    it('does not interleave staging and committing across concurrent snapshots', async () => {
+      const events: string[] = [];
+      hoistedMockAdd.mockImplementation(async () => {
+        events.push('add:start');
+        await new Promise((resolve) => setTimeout(resolve, 10));
+        events.push('add:end');
+      });
+      hoistedMockStatus.mockResolvedValue({ isClean: () => false });
+      hoistedMockCommit.mockImplementation(async (message: string) => {
+        events.push(`commit:${message}`);
+        return { commit: `hash-${message}` };
+      });
+
+      const service = new GitService(projectRoot, storage);
+      await Promise.all([
+        service.createFileSnapshot('A'),
+        service.createFileSnapshot('B'),
+      ]);
+
+      // `add('.')` stages the whole working tree, so a second snapshot that
+      // stages while the first has not committed yet folds the first
+      // snapshot's files into its own commit.
+      expect(events).toEqual([
+        'add:start',
+        'add:end',
+        'commit:A',
+        'add:start',
+        'add:end',
+        'commit:B',
+      ]);
+    });
   });
 });
```

**File**: `packages/core/src/services/gitService.ts` (modified, +28/-15)
```diff
@@ -7,6 +7,8 @@
 import * as fs from 'node:fs/promises';
 import * as path from 'node:path';
 import { isNodeError } from '../utils/errors.js';
+import { withPathLock } from '../utils/pathMutex.js';
+import { resolveToRealPath } from '../utils/paths.js';
 import { spawnAsync } from '../utils/shell-utils.js';
 import {
   simpleGit,
@@ -194,23 +196,34 @@ export class GitService {
   }
 
   async createFileSnapshot(message: string): Promise<string> {
+    // `add('.')` stages the entire working tree, so two snapshots running at
+    // once fold each other's files into whichever commit lands first. Serialize
+    // stage -> status -> commit per shadow repository.
+    let realProjectRoot = this.projectRoot;
     try {
-      const repo = this.shadowGitRepository;
-      await repo.add('.');
-      const status = await repo.status();
-      if (status.isClean()) {
-        // If no changes are staged, return the current HEAD commit hash
-        return await this.getCurrentCommitHash();
-      }
-      const commitResult = await repo.commit(message, {
-        '--no-verify': null,
-      });
-      return commitResult.commit;
-    } catch (error) {
-      throw new Error(
-        `Failed to create checkpoint snapshot: ${error instanceof Error ? error.message : 'Unknown error'}. Checkpointing may not be working properly.`,
-      );
+      realProjectRoot = resolveToRealPath(this.projectRoot);
+    } catch {
+      // Keep unresolved
     }
+    return withPathLock(`git-snapshot:${realProjectRoot}`, async () => {
+      try {
+        const repo = this.shadowGitRepository;
+        await repo.add('.');
+        const status = await repo.status();
+        if (status.isClean()) {
+          // If no changes are staged, return the current HEAD commit hash
+          return await this.getCurrentCommitHash();
+        }
+        const commitResult = await repo.commit(message, {
+          '--no-verify': null,
+        });
+        return commitResult.commit;
+      } catch (error) {
+        throw new Error(
+          `Failed to create checkpoint snapshot: ${error instanceof Error ? error.message : 'Unknown error'}. Checkpointing may not be working properly.`,
+        );
+      }
+    });
   }
 
   async restoreProjectFromSnapshot(commitHash: string): Promise<void> {
```

**File**: `packages/core/src/tools/edit.test.ts` (modified, +96/-0)
```diff
@@ -1496,4 +1496,100 @@ function doIt() {
       fs.rmSync(plansDir, { recursive: true, force: true });
     });
   });
+
+  describe('concurrent edits to the same file', () => {
+    it('applies both edits rather than losing one', async () => {
+      const filePath = path.join(rootDir, 'shared.txt');
+      fs.writeFileSync(filePath, 'alpha\nbeta\n', 'utf8');
+
+      const first = tool.build({
+        file_path: filePath,
+        instruction: 'Uppercase alpha',
+        old_string: 'alpha',
+        new_string: 'ALPHA',
+      });
+      const second = tool.build({
+        file_path: filePath,
+        instruction: 'Uppercase beta',
+        old_string: 'beta',
+        new_string: 'BETA',
+      });
+
+      const signal = new AbortController().signal;
+      const results = await Promise.all([
+        first.execute({ abortSignal: signal }),
+        second.execute({ abortSignal: signal }),
+      ]);
+
+      for (const result of results) {
+        expect(result.error).toBeUndefined();
+      }
+
+      // Both tool calls reported success, so neither edit may be missing.
+      const finalContent = fs.readFileSync(filePath, 'utf8');
+      expect(finalContent).toContain('ALPHA');
+      expect(finalContent).toContain('BETA');
+    });
+
+    it('serializes concurrent edits with different path spellings (relative vs absolute)', async () => {
+      const fileName = 'spelling.txt';
+      const absolutePath = path.join(rootDir, fileName);
+      const relativePath = `./${fileName}`;
+      fs.writeFileSync(absolutePath, 'line1\nline2\n', 'utf8');
+
+      const first = tool.build({
+        file_path: absolutePath,
+        instruction: 'Uppercase line1',
+        old_string: 'line1',
+        new_string: 'LINE1',
+      });
+      const second = tool.build({
+        file_path: relativePath,
+        instruction: 'Uppercase line2',
+        old_string: 'line2',
+        new_string: 'LINE2',
+      });
+
+      const signal = new AbortController().signal;
+      const results = await Promise.all([
+        first.execute({ abortSignal: signal }),
+        second.execute({ abortSignal: signal }),
+      ]);
+
+      for (const result of results) {
+        expect(result.error).toBeUndefined();
+      }
+
+      const finalContent = fs.readFileSync(absolutePath, 'utf8');
+      expect(finalContent).toContain('LINE1');
+      expect(finalContent).toContain('LINE2');
+    });
+
+    it('aborts immediately if signal is aborted while waiting for path lock', async () => {
+      const filePath = path.join(rootDir, 'abort_test.txt');
+      fs.writeFileSync(filePath, 'original content', 'utf8');
+
+      const first = tool.build({
+        file_path: filePath,
+        instruction: 'Change to first',
+        old_string: 'original',
+        new_string: 'FIRST',
+      });
+      const second = tool.build({
+        file_path: filePath,
+        instruction: 'Change to second',
+        old_string: 'original',
+        new_string: 'SECOND',
+      });
+
+      const controller = new AbortController();
+
+      const p1 = first.execute({ abortSignal: new AbortController().signal });
+      controller.abort();
+      const p2 = second.execute({ abortSignal: controller.signal });
+
+      await expect(p2).rejects.toThrow('Edit aborted');
+      await p1;
+    });
+  });
 });
```

**File**: `packages/core/src/tools/edit.ts` (modified, +38/-0)
```diff
@@ -34,6 +34,7 @@ import {
   resolveToRealPath,
 } from '../utils/paths.js';
 import { isNodeError } from '../utils/errors.js';
+import { withPathLock } from '../utils/pathMutex.js';
 import { correctPath } from '../utils/pathCorrector.js';
 import type { Config } from '../config/config.js';
 import { CoreToolCallStatus } from '../scheduler/types.js';
@@ -914,6 +915,43 @@ class EditToolInvocation
       };
     }
 
+    // Serialize the whole read-modify-write against other writers of this
+    // path. Two edits scheduled in parallel (common with sub-agents) would
+    // otherwise both read the original content, and whichever wrote second
+    // would silently discard the other's edit while still reporting success.
+    let lockKey = path.resolve(this.config.getTargetDir(), this.resolvedPath);
+    try {
+      lockKey = resolveToRealPath(lockKey);
+    } catch {
+      try {
+        const dir = path.dirname(lockKey);
+        const base = path.basename(lockKey);
+        lockKey = path.join(resolveToRealPath(dir), base);
+      } catch {
+        // Keep unresolved lockKey
+      }
+    }
+    try {
+      return await withPathLock(lockKey, () => this.applyEdit(signal), signal);
+    } catch (err) {
+      if (err instanceof Error && err.message === 'Aborted') {
+        throw new Error('Edit aborted');
+      }
+      throw err;
+    }
+  }
+
+  /**
+   * Computes and applies the edit.
+   *
+   * Must be called while holding the path lock for `this.resolvedPath`, so
+   * that the read in `calculateEdit` and the subsequent write cannot be
+   * interleaved with another writer of the same file.
+   */
+  private async applyEdit(signal: AbortSignal): Promise<ToolResult> {
+    if (signal.aborted) {
+      throw new Error('Edit aborted');
+    }
     let editData: CalculatedEdit;
     try {
       editData = await this.calculateEdit(this.params, signal);
```

**File**: `packages/core/src/tools/write-file.test.ts` (modified, +49/-0)
```diff
@@ -133,6 +133,7 @@ describe('WriteFileTool', () => {
 
   beforeEach(() => {
     vi.clearAllMocks();
+    vi.mocked(mockConfigInternal.isPlanMode).mockReturnValue(false);
     // Create a unique temporary directory for files created outside the root
     const rawTempDir = fs.mkdtempSync(
       path.join(os.tmpdir(), 'write-file-test-external-'),
@@ -1186,4 +1187,52 @@ describe('WriteFileTool', () => {
       expect(fs.readFileSync(expectedWritePath, 'utf8')).toBe('nested content');
     });
   });
+
+  describe('concurrent writes to the same file', () => {
+    it('does not report two creations of the same new file', async () => {
+      const abortSignal = new AbortController().signal;
+      const filePath = path.join(rootDir, 'concurrent_new_file.txt');
+      mockEnsureCorrectFileContent.mockImplementation(
+        async (content: string) => content,
+      );
+
+      const first = tool.build({ file_path: filePath, content: 'first' });
+      const second = tool.build({ file_path: filePath, content: 'second' });
+
+      const results = await Promise.all([
+        first.execute({ abortSignal }),
+        second.execute({ abortSignal }),
+      ]);
+
+      // Whichever call lands second must observe the file the other created,
+      // otherwise both report a creation and the second one's diff claims the
+      // file was empty beforehand.
+      const messages = results.map((r) =>
+        typeof r.llmContent === 'string' ? r.llmContent : '',
+      );
+      expect(
+        messages.filter((m) =>
+          m.startsWith('Successfully created and wrote to new file'),
+        ),
+      ).toHaveLength(1);
+      expect(
+        messages.filter((m) => m.startsWith('Successfully overwrote file')),
+      ).toHaveLength(1);
+    });
+
+    it('aborts immediately if signal is aborted while waiting for path lock', async () => {
+      const filePath = path.join(rootDir, 'abort_test.txt');
+      const first = tool.build({ file_path: filePath, content: 'first' });
+      const second = tool.build({ file_path: filePath, content: 'second' });
+
+      const controller = new AbortController();
+
+      const p1 = first.execute({ abortSignal: new AbortController().signal });
+      controller.abort();
+      const p2 = second.execute({ abortSignal: controller.signal });
+
+      await expect(p2).rejects.toThrow('Write aborted');
+      await p1;
+    });
+  });
 });
```

---

### Incident Patch 11: `2044ea3c` (2026-09-30)
**Commit Message**: fix(cli): prevent CPU hang and quote swallowing on @ within code (#29434) (#29557)

**File**: `packages/cli/src/ui/hooks/atCommandProcessor.test.ts` (modified, +182/-0)
```diff
@@ -1590,6 +1590,188 @@ describe('handleAtCommand', () => {
       ),
     );
   });
+
+  // Regression tests for #29434: code with @ inside quotes should not trigger runaway glob searches or hangs
+  it('does not greedily consume code across quotes when @ is inside quotes (#29434)', async () => {
+    const query =
+      'import { x } from "@scope/pkg";\nconst a = "foo";\nconsole.log("hello");';
+
+    const result = await handleAtCommand({
+      query,
+      config: mockConfig,
+      addItem: mockAddItem,
+      onDebugMessage: mockOnDebugMessage,
+      messageId: 704,
+      signal: abortController.signal,
+    });
+
+    // The query should be processed without hanging or throwing
+    expect(result.processedQuery).not.toBeNull();
+    expect(result.error).toBeUndefined();
+  });
+
+  it('does not hang when input contains @scope/pkg followed by many imports (#29434)', async () => {
+    let query = 'import { useThing } from "@scope/pkg";\n';
+    for (let i = 1; i <= 60; i++) {
+      query += `import { alpha${i}, beta${i}, gamma${i} } from "~/modules/feature${i}/index";\n`;
+    }
+
+    const result = await handleAtCommand({
+      query,
+      config: mockConfig,
+      addItem: mockAddItem,
+      onDebugMessage: mockOnDebugMessage,
+      messageId: 705,
+      signal: abortController.signal,
+    });
+
+    expect(result.processedQuery).not.toBeNull();
+    expect(result.error).toBeUndefined();
+  });
+
+  it('does not invoke recursive glob search on paths exceeding MAX_GLOB_SEARCH_PATH_LENGTH (#29434)', async () => {
+    const globSpy = vi.fn();
+    const mockGlobTool = {
+      buildAndExecute: globSpy,
+    };
+    vi.spyOn(mockConfig.getToolRegistry(), 'getTool').mockReturnValue(
+      mockGlobTool as never,
+    );
+
+    // Path with individual components < 255 but total length > 255
+    const excessivelyLongNonexistent = 'sub/'.repeat(65) + 'file.ts';
+    const query = `@${excessivelyLongNonexistent}`;
+
+    await handleAtCommand({
+      query,
+      config: mockConfig,
+      addItem: mockAddItem,
+      onDebugMessage: mockOnDebugMessage,
+      messageId: 706,
+      signal: abortController.signal,
+    });
+
+    // Glob search should be skipped for excessively long path names
+    expect(globSpy).not.toHaveBeenCalled();
+  });
+
+  it('does not invoke recursive glob search on paths containing newlines (#29434)', async () => {
+    const globSpy = vi.fn();
+    const mockGlobTool = {
+      buildAndExecute: globSpy,
+    };
+    vi.spyOn(mockConfig.getToolRegistry(), 'getTool').mockReturnValue(
+      mockGlobTool as never,
+    );
+
+    // Path containing newline characters should never trigger glob fallback
+    const query = '@"invalid\npath"';
+
+    await handleAtCommand({
+      query,
+      config: mockConfig,
+      addItem: mockAddItem,
+      onDebugMessage: mockOnDebugMessage,
+      messageId: 707,
+      signal: abortController.signal,
+    });
+
+    expect(globSpy).not.toHaveBeenCalled();
+  });
+
+  it('does not invoke recursive glob search on paths containing curly braces (#29434)', async () => {
+    const globSpy = vi.fn();
+    const mockGlobTool = {
+      buildAndExecute: globSpy,
+    };
+    vi.spyOn(mockConfig.getToolRegistry(), 'getTool').mockReturnValue(
+      mockGlobTool as never,
+    );
+
+    // Paths containing curly braces can cause catastrophic brace expansion in minimatch
+    const query = '@"foo{a,b}{c,d}"';
+
+    await handleAtCommand({
+      query,
+      config: mockConfig,
+      addItem: mockAddItem,
+      onDebugMessage: mockOnDebugMessage,
+      messageId: 708,
+      signal: abortController.signal,
+    });
+
+    expect(globSpy).not.toHaveBeenCalled();
+  });
+
+  it('does not invoke recursive glob search on paths containing directory traversal sequences (#29434)', async () => {
+    const globSpy = vi.fn();
+    const mockGlobTool = {
+      buildAndExecute: globSpy,
+    };
+    vi.spyOn(mockConfig.getToolRegistry(), 'getTool').mockReturnValue(
+      mockGlobTool as never,
+    );
+
+    // Paths containing directory traversal sequences should never trigger glob fallback
+    const query = '@../sibling/nonexistent.txt';
+
+    await handleAtCommand({
+      query,
+      config: mockConfig,
+      addItem: mockAddItem,
+      onDebugMessage: mockOnDebugMessage,
+      messageId: 709,
+      signal: abortController.signal,
+    });
+
+    expect(globSpy).not.toHaveBeenCalled();
+  });
+
+  it('does not invoke recursive glob search on absolute paths that do not exist (#29434)', async () => {
+    const globSpy = vi.fn();
+    const mockGlobTool = {
+      buildAndExecute: globSpy,
+    };
+    vi.spyOn(mockConfig.getToolRegistry(), 'getTool').mockReturnValue(
+      mockGlobTool as never,
+    );
+
+    const query = '@/usr/bin/nonexistent-binary-path-xyz';
+
+    await handleAtCommand({
+      query,
+      config: mockConfig,
+      addItem: mockAddItem,
+      onDebugMessage: mockOnDebugMessage,
+      messageId: 71
```

**File**: `packages/cli/src/ui/hooks/atCommandProcessor.ts` (modified, +21/-6)
```diff
@@ -53,13 +53,16 @@ export function unescapeLiteralAt(text: string): string {
  * Regex source for the path/command part of an @ reference.
  * It uses strict ASCII whitespace delimiters to allow Unicode characters like NNBSP in filenames.
  *
- * 1. "(?:[^"]*)" matches a double-quoted string (for Windows paths with spaces).
- * 2. \\. matches any escaped character (e.g., \ ).
- * 3. [^ \t\n\r,;!?()\[\]{}.] matches any character that is NOT a delimiter and NOT a period.
- * 4. \.(?!$|[ \t\n\r]) matches a period ONLY if it is NOT followed by whitespace or end-of-string.
+ * Either:
+ * 1. "(?:[^"\n\r]*)" - a double-quoted string (for paths with spaces, e.g. on Windows) without internal newlines.
+ * 2. An unquoted path consisting of escaped characters or non-delimiter characters (excluding quotes).
+ * 3. \.(?!$|[ \t\n\r]) matches a period ONLY if it is NOT followed by whitespace or end-of-string.
+ *
+ * Notably, a quoted string cannot be extended by unquoted characters, and unquoted paths cannot contain unescaped quotes.
+ * This prevents catastrophic multi-line matches when code like `import { x } from "@scope/pkg";` is processed (#29434).
  */
 export const AT_COMMAND_PATH_REGEX_SOURCE =
-  '(?:(?:"(?:[^"]*)")|(?:\\\\.|[^ \\t\\n\\r,;!?()\\[\\]{}.]|\\.(?!$|[ \\t\\n\\r])))+';
+  '(?:(?:"[^"\\n\\r]*")|(?:\\\\.|[^ \\t\\n\\r,;!?()\\[\\]{}."\'`]|\\.(?!$|[ \\t\\n\\r]))+)';
 
 interface HandleAtCommandParams {
   query: string;
@@ -304,7 +307,19 @@ async function resolveFilePaths(
       // We also allow glob fallback for "unauthorized" results from resolveAtCommandPath,
       // as they might represent a relative path that matched an unauthorized file in one directory
       // but might have a valid match (via glob) in another.
-      if (config.getEnableRecursiveFileSearch() && globTool) {
+      const MAX_GLOB_SEARCH_PATH_LENGTH = 255;
+      const isPathSuitableForGlob =
+        pathName.length > 0 &&
+        pathName.length <= MAX_GLOB_SEARCH_PATH_LENGTH &&
+        !path.isAbsolute(pathName) &&
+        !pathName.includes('..') &&
+        !/[\r\n\t\0{}*?[\]]/.test(pathName);
+
+      if (
+        config.getEnableRecursiveFileSearch() &&
+        globTool &&
+        isPathSuitableForGlob
+      ) {
         onDebugMessage(
           `Path ${pathName} not found directly, attempting glob search.`,
         );
```

---

### Incident Patch 12: `478f771f` (2026-09-29)
**Commit Message**: fix(cli): propagate resolved folder trust state in headless mode (#29031) (#29528)

**File**: `packages/cli/src/ui/hooks/useFolderTrust.test.ts` (modified, +259/-3)
```diff
@@ -25,7 +25,12 @@ import {
   type LoadedTrustedFolders,
 } from '../../config/trustedFolders.js';
 import * as trustedFolders from '../../config/trustedFolders.js';
-import { coreEvents, ExitCodes, isHeadlessMode } from '@google/gemini-cli-core';
+import {
+  coreEvents,
+  ExitCodes,
+  isHeadlessMode,
+  FolderTrustDiscoveryService,
+} from '@google/gemini-cli-core';
 import { MessageType } from '../types.js';
 
 const mockedCwd = vi.hoisted(() => vi.fn().mockReturnValue('/mock/cwd'));
@@ -366,7 +371,7 @@ describe('useFolderTrust', () => {
   });
 
   describe('headless mode', () => {
-    it('should force trust and hide dialog in headless mode', async () => {
+    it('should propagate false to onTrustChange, hide dialog, and show warning when folder is untrusted', async () => {
       vi.mocked(isHeadlessMode).mockReturnValue(true);
       isWorkspaceTrustedSpy.mockReturnValue({
         isTrusted: false,
@@ -378,7 +383,8 @@ describe('useFolderTrust', () => {
       );
 
       expect(result.current.isFolderTrustDialogOpen).toBe(false);
-      expect(onTrustChange).toHaveBeenCalledWith(true);
+      expect(result.current.isTrusted).toBe(false);
+      expect(onTrustChange).toHaveBeenCalledWith(false);
       expect(addItem).toHaveBeenCalledWith(
         expect.objectContaining({
           type: MessageType.INFO,
@@ -387,5 +393,255 @@ describe('useFolderTrust', () => {
         expect.any(Number),
       );
     });
+
+    it('should propagate true to onTrustChange, hide dialog, and not show warning when folder is trusted', async () => {
+      vi.mocked(isHeadlessMode).mockReturnValue(true);
+      isWorkspaceTrustedSpy.mockReturnValue({
+        isTrusted: true,
+        source: 'file',
+      });
+
+      const { result } = await renderHook(() =>
+        useFolderTrust(mockSettings, onTrustChange, addItem),
+      );
+
+      expect(result.current.isFolderTrustDialogOpen).toBe(false);
+      expect(result.current.isTrusted).toBe(true);
+      expect(onTrustChange).toHaveBeenCalledWith(true);
+      expect(addItem).not.toHaveBeenCalled();
+    });
+
+    it('should propagate undefined to onTrustChange and hide dialog when folder trust is undefined', async () => {
+      vi.mocked(isHeadlessMode).mockReturnValue(true);
+      isWorkspaceTrustedSpy.mockReturnValue({
+        isTrusted: undefined,
+        source: undefined,
+      });
+
+      const { result } = await renderHook(() =>
+        useFolderTrust(mockSettings, onTrustChange, addItem),
+      );
+
+      expect(result.current.isFolderTrustDialogOpen).toBe(false);
+      expect(result.current.isTrusted).toBeUndefined();
+      expect(onTrustChange).toHaveBeenCalledWith(undefined);
+      expect(addItem).not.toHaveBeenCalled();
+    });
+  });
+
+  describe('callback stability', () => {
+    it('should not re-run effect or trigger onTrustChange again when callback references change', async () => {
+      isWorkspaceTrustedSpy.mockReturnValue({
+        isTrusted: true,
+        source: 'file',
+      });
+
+      const initialOnTrustChange = vi.fn();
+      const initialAddItem = vi.fn();
+
+      const { rerender } = await renderHook(
+        ({ onTrustChangeCb, addItemCb }) =>
+          useFolderTrust(mockSettings, onTrustChangeCb, addItemCb),
+        {
+          initialProps: {
+            onTrustChangeCb: initialOnTrustChange,
+            addItemCb: initialAddItem,
+          },
+        },
+      );
+
+      expect(initialOnTrustChange).toHaveBeenCalledTimes(1);
+      expect(initialOnTrustChange).toHaveBeenCalledWith(true);
+
+      const newOnTrustChange = vi.fn();
+      const newAddItem = vi.fn();
+
+      rerender({
+        onTrustChangeCb: newOnTrustChange,
+        addItemCb: newAddItem,
+      });
+
+      expect(newOnTrustChange).not.toHaveBeenCalled();
+      expect(initialOnTrustChange).toHaveBeenCalledTimes(1);
+    });
+
+    it('should not re-trigger FolderTrustDiscoveryService.discover when callback references change', async () => {
+      isWorkspaceTrustedSpy.mockReturnValue({
+        isTrusted: false,
+        source: 'file',
+      });
+      const discoverSpy = vi.spyOn(FolderTrustDiscoveryService, 'discover');
+      discoverSpy.mockClear();
+
+      const initialOnTrustChange = vi.fn();
+      const initialAddItem = vi.fn();
+
+      const { rerender } = await renderHook(
+        ({ onTrustChangeCb, addItemCb }) =>
+          useFolderTrust(mockSettings, onTrustChangeCb, addItemCb),
+        {
+          initialProps: {
+            onTrustChangeCb: initialOnTrustChange,
+            addItemCb: initialAddItem,
+          },
+        },
+      );
+
+      expect(discoverSpy).toHaveBeenCalledTimes(1);
+
+      const newOnTrustChange = vi.fn();
+      const newAddItem = vi.fn();
+
+      rerender({
+        onTrustChangeCb: newOnTrustChange,
+        addItemCb: newAddItem,
+      });
+
+      expect(discoverSpy).toHaveBeenCalledTimes(1);
+    });
+
+    it('should use updated onTrustChange callback in handleF
```

**File**: `packages/cli/src/ui/hooks/useFolderTrust.ts` (modified, +20/-15)
```diff
@@ -35,11 +35,23 @@ export const useFolderTrust = (
   const [isRestarting, setIsRestarting] = useState(false);
   const startupMessageSent = useRef(false);
 
+  const onTrustChangeRef = useRef(onTrustChange);
+  const addItemRef = useRef(addItem);
+  const settingsRef = useRef(settings);
+
+  useEffect(() => {
+    onTrustChangeRef.current = onTrustChange;
+    addItemRef.current = addItem;
+    settingsRef.current = settings;
+  }, [onTrustChange, addItem, settings]);
+
   const folderTrust = settings.merged.security.folderTrust.enabled ?? true;
 
   useEffect(() => {
     let isMounted = true;
-    const { isTrusted: trusted } = isWorkspaceTrusted(settings.merged);
+    const { isTrusted: trusted } = isWorkspaceTrusted(
+      settingsRef.current.merged,
+    );
 
     if (trusted === undefined || trusted === false) {
       void FolderTrustDiscoveryService.discover(process.cwd())
@@ -56,7 +68,7 @@ export const useFolderTrust = (
 
     const showUntrustedMessage = () => {
       if (trusted === false && !startupMessageSent.current) {
-        addItem(
+        addItemRef.current(
           {
             type: MessageType.INFO,
             text: 'This folder is untrusted, project settings, hooks, MCPs, and GEMINI.md files will not be applied for this folder.\nUse the `/permissions` command to change the trust level.',
@@ -67,24 +79,17 @@ export const useFolderTrust = (
       }
     };
 
-    if (isHeadlessMode()) {
-      if (isMounted) {
-        setIsTrusted(trusted);
-        setIsFolderTrustDialogOpen(false);
-        onTrustChange(true);
-        showUntrustedMessage();
-      }
-    } else if (isMounted) {
+    if (isMounted) {
       setIsTrusted(trusted);
-      setIsFolderTrustDialogOpen(trusted === undefined);
-      onTrustChange(trusted);
+      setIsFolderTrustDialogOpen(!isHeadlessMode() && trusted === undefined);
+      onTrustChangeRef.current(trusted);
       showUntrustedMessage();
     }
 
     return () => {
       isMounted = false;
     };
-  }, [folderTrust, onTrustChange, settings.merged, addItem]);
+  }, [folderTrust]);
 
   const handleFolderTrustSelect = useCallback(
     async (choice: FolderTrustChoice) => {
@@ -118,7 +123,7 @@ export const useFolderTrust = (
         trustLevel === TrustLevel.TRUST_FOLDER ||
         trustLevel === TrustLevel.TRUST_PARENT;
 
-      onTrustChange(currentIsTrusted);
+      onTrustChangeRef.current(currentIsTrusted);
       setIsTrusted(currentIsTrusted);
 
       const wasTrusted = isTrusted ?? false;
@@ -130,7 +135,7 @@ export const useFolderTrust = (
         setIsFolderTrustDialogOpen(false);
       }
     },
-    [onTrustChange, isTrusted],
+    [isTrusted],
   );
 
   return {
```

---

### Incident Patch 13: `e6550609` (2026-09-29)
**Commit Message**: fix(acp): bridge PromptResponse.usage and emit usage_update notifications (#29389) (#29549)

**File**: `packages/cli/src/acp/acpSession.test.ts` (modified, +90/-2)
```diff
@@ -249,6 +249,66 @@ describe('Session', () => {
     expect(result).toMatchObject({ stopReason: 'end_turn' });
   });
 
+  it('should include standard ACP token usage in PromptResponse.usage and emit usage_update', async () => {
+    async function* mockStreamWithUsage(): AsyncGenerator<ServerGeminiStreamEvent> {
+      yield {
+        type: GeminiEventType.Content,
+        value: 'Hello',
+      };
+      yield {
+        type: GeminiEventType.Finished,
+        value: {
+          reason: FinishReason.STOP,
+          usageMetadata: {
+            promptTokenCount: 120,
+            candidatesTokenCount: 45,
+            cachedContentTokenCount: 80,
+            thoughtsTokenCount: 15,
+          },
+        },
+      };
+    }
+    mockSendMessageStream.mockReturnValue(mockStreamWithUsage());
+
+    const result = await session.prompt({
+      sessionId: 'session-1',
+      prompt: [{ type: 'text', text: 'Hi' }],
+    });
+
+    expect(result.usage).toEqual({
+      inputTokens: 120,
+      outputTokens: 45,
+      cachedReadTokens: 80,
+      thoughtTokens: 15,
+      totalTokens: 165,
+    });
+    expect(result._meta).toEqual({
+      quota: {
+        token_count: {
+          input_tokens: 120,
+          output_tokens: 45,
+        },
+        model_usage: [
+          {
+            model: 'gemini-pro',
+            token_count: {
+              input_tokens: 120,
+              output_tokens: 45,
+            },
+          },
+        ],
+      },
+    });
+    expect(mockConnection.sessionUpdate).toHaveBeenCalledWith({
+      sessionId: 'session-1',
+      update: {
+        sessionUpdate: 'usage_update',
+        used: 165,
+        size: expect.any(Number),
+      },
+    });
+  });
+
   it('should pass current session information directly onto geminiClient.sendMessageStream', async () => {
     const stream = createMockStream([
       {
@@ -368,7 +428,20 @@ describe('Session', () => {
       prompt: [{ type: 'text', text: '/memory view' }],
     });
 
-    expect(result).toMatchObject({ stopReason: 'end_turn' });
+    expect(result).toMatchObject({
+      stopReason: 'end_turn',
+      usage: {
+        inputTokens: 0,
+        outputTokens: 0,
+        totalTokens: 0,
+      },
+      _meta: {
+        quota: {
+          token_count: { input_tokens: 0, output_tokens: 0 },
+          model_usage: [],
+        },
+      },
+    });
     expect(handleCommandSpy).toHaveBeenCalledWith(
       '/memory view',
       expect.any(Object),
@@ -405,7 +478,22 @@ describe('Session', () => {
     });
 
     expect(mockToolRegistry.getTool).toHaveBeenCalledWith('test_tool');
-    expect(result).toMatchObject({ stopReason: 'end_turn' });
+    expect(result).toMatchObject({
+      stopReason: 'end_turn',
+      usage: {
+        inputTokens: 10,
+        outputTokens: 20,
+        totalTokens: 30,
+      },
+      _meta: {
+        quota: {
+          token_count: {
+            input_tokens: 10,
+            output_tokens: 20,
+          },
+        },
+      },
+    });
   });
 
   it('should handle tool call permission request', async () => {
```

**File**: `packages/cli/src/acp/acpSession.ts` (modified, +58/-82)
```diff
@@ -39,6 +39,7 @@ import {
   type ToolConfirmationRequest,
   resolveAtCommandPath,
   type ResolvedAtCommandPath,
+  tokenLimit,
 } from '@google/gemini-cli-core';
 import * as acp from '@agentclientprotocol/sdk';
 import type { Part, FunctionCall } from '@google/genai';
@@ -349,6 +350,11 @@ export class Session {
       if (handled) {
         return {
           stopReason: 'end_turn',
+          usage: {
+            inputTokens: 0,
+            outputTokens: 0,
+            totalTokens: 0,
+          },
           _meta: {
             quota: {
               token_count: { input_tokens: 0, output_tokens: 0 },
@@ -361,35 +367,48 @@ export class Session {
 
     let totalInputTokens = 0;
     let totalOutputTokens = 0;
+    let totalCachedTokens = 0;
+    let totalThoughtTokens = 0;
     const modelUsageMap = new Map<string, { input: number; output: number }>();
 
+    const buildPromptResponse = (
+      stopReason: acp.StopReason,
+    ): acp.PromptResponse => ({
+      stopReason,
+      usage: {
+        inputTokens: totalInputTokens,
+        outputTokens: totalOutputTokens,
+        cachedReadTokens: totalCachedTokens || undefined,
+        thoughtTokens: totalThoughtTokens || undefined,
+        totalTokens: totalInputTokens + totalOutputTokens,
+      },
+      _meta: {
+        quota: {
+          token_count: {
+            input_tokens: totalInputTokens,
+            output_tokens: totalOutputTokens,
+          },
+          model_usage: Array.from(modelUsageMap.entries()).map(
+            ([modelName, counts]) => ({
+              model: modelName,
+              token_count: {
+                input_tokens: counts.input,
+                output_tokens: counts.output,
+              },
+            }),
+          ),
+        },
+      },
+    });
+
     let currentParts: Part[] = parts;
     let turnCount = 0;
     const maxTurns = this.context.config.getMaxSessionTurns();
 
     while (true) {
       turnCount++;
       if (maxTurns >= 0 && turnCount > maxTurns) {
-        return {
-          stopReason: 'max_turn_requests',
-          _meta: {
-            quota: {
-              token_count: {
-                input_tokens: totalInputTokens,
-                output_tokens: totalOutputTokens,
-              },
-              model_usage: Array.from(modelUsageMap.entries()).map(
-                ([modelName, counts]) => ({
-                  model: modelName,
-                  token_count: {
-                    input_tokens: counts.input,
-                    output_tokens: counts.output,
-                  },
-                }),
-              ),
-            },
-          },
-        };
+        return buildPromptResponse('max_turn_requests');
       }
 
       if (pendingSend.signal.aborted) {
@@ -401,6 +420,8 @@ export class Session {
       let turnModelId = this.context.config.getModel();
       let turnInputTokens = 0;
       let turnOutputTokens = 0;
+      let turnCachedTokens = 0;
+      let turnThoughtTokens = 0;
 
       try {
         const responseStream = this.context.geminiClient.sendMessageStream(
@@ -447,6 +468,18 @@ export class Session {
                 turnInputTokens = usage.promptTokenCount ?? turnInputTokens;
                 turnOutputTokens =
                   usage.candidatesTokenCount ?? turnOutputTokens;
+                turnCachedTokens =
+                  usage.cachedContentTokenCount ?? turnCachedTokens;
+                turnThoughtTokens =
+                  usage.thoughtsTokenCount ?? turnThoughtTokens;
+
+                await this.sendUpdate({
+                  sessionUpdate: 'usage_update',
+                  used: turnInputTokens + turnOutputTokens,
+                  size: tokenLimit(
+                    turnModelId || this.context.config.getModel(),
+                  ),
+                });
               }
               break;
             }
@@ -519,26 +552,7 @@ export class Session {
         ) {
           // The stream ended with an empty response or malformed tool call.
           // Treat this as a graceful end to the model's turn rather than a crash.
-          return {
-            stopReason: 'end_turn',
-            _meta: {
-              quota: {
-                token_count: {
-                  input_tokens: totalInputTokens,
-                  output_tokens: totalOutputTokens,
-                },
-                model_usage: Array.from(modelUsageMap.entries()).map(
-                  ([modelName, counts]) => ({
-                    model: modelName,
-                    token_count: {
-                      input_tokens: counts.input,
-                      output_tokens: counts.output,
-                    },
-                  }),
-                ),
-              },
-            },
-          };
+          return buildPromptResponse('end_turn');
         }
 
         throw new acp.RequestError(
@@ -549,6 +563,8 @@ export class Session {
 
       totalInputTokens += turnInputTokens;
       totalOutputTokens += turnOutput
```

---

### Incident Patch 14: `d75234ca` (2026-09-29)
**Commit Message**: fix(core): disable truncation when maxChars <= 0 in formatTruncatedToolOutput (#29542)

**File**: `packages/core/src/utils/fileUtils.test.ts` (modified, +42/-2)
```diff
@@ -1353,7 +1353,7 @@ describe('fileUtils', () => {
     });
   });
 
-  describe('saveTruncatedToolOutput & formatTruncatedToolOutput', () => {
+  describe('saveTruncatedToolOutput', () => {
     it('should save content to a file with safe name', async () => {
       const content = 'some content';
       const toolName = 'shell';
@@ -1465,14 +1465,46 @@ describe('fileUtils', () => {
       );
       expect(result.outputFile).toBe(expectedOutputFile);
     });
+  });
+
+  describe('formatTruncatedToolOutput', () => {
+    it('returns the string unchanged without the "Output too large" wrapper when maxChars = 0', () => {
+      const content = 'abcdefghijklmnopqrstuvwxyz';
+      const outputFile = '/tmp/out.txt';
+
+      const result = formatTruncatedToolOutput(content, outputFile, 0);
+
+      expect(result).toBe(content);
+      expect(result).not.toContain('Output too large');
+    });
+
+    it('returns the string unchanged when maxChars < 0 (-1, -1000), verifying output length equals input length', () => {
+      const content = 'abcdefghijklmnopqrstuvwxyz'.repeat(10);
+      const outputFile = '/tmp/out.txt';
+
+      const resultNeg1 = formatTruncatedToolOutput(content, outputFile, -1);
+      expect(resultNeg1).toBe(content);
+      expect(resultNeg1.length).toBe(content.length);
+      expect(resultNeg1).not.toContain('Output too large');
 
-    it('should truncate showing first 20% and last 80%', () => {
+      const resultNeg1000 = formatTruncatedToolOutput(
+        content,
+        outputFile,
+        -1000,
+      );
+      expect(resultNeg1000).toBe(content);
+      expect(resultNeg1000.length).toBe(content.length);
+      expect(resultNeg1000).not.toContain('Output too large');
+    });
+
+    it('correctly truncates when input exceeds maxChars (maxChars > 0)', () => {
       const content = 'abcdefghijklmnopqrstuvwxyz'; // 26 chars
       const outputFile = '/tmp/out.txt';
 
       // maxChars=10 -> head=2 (20%), tail=8 (80%)
       const formatted = formatTruncatedToolOutput(content, outputFile, 10);
 
+      expect(formatted).toContain('Output too large');
       expect(formatted).toContain('Showing first 2 and last 8 characters');
       expect(formatted).toContain('For full output see: /tmp/out.txt');
       expect(formatted).toContain('ab'); // first 2 chars
@@ -1493,5 +1525,13 @@ describe('fileUtils', () => {
       expect(formatted).toContain('For full output see: /tmp/out.txt');
       expect(formatted).toContain('[46,000 characters omitted]'); // 50000 - 800 - 3200
     });
+
+    it('returns content untouched when content length <= maxChars', () => {
+      const content = 'short content';
+      const outputFile = '/tmp/out.txt';
+
+      const formatted = formatTruncatedToolOutput(content, outputFile, 100);
+      expect(formatted).toBe(content);
+    });
   });
 });
```

**File**: `packages/core/src/utils/fileUtils.ts` (modified, +1/-1)
```diff
@@ -776,7 +776,7 @@ export function formatTruncatedToolOutput(
   outputFile: string,
   maxChars: number,
 ): string {
-  if (contentStr.length <= maxChars) return contentStr;
+  if (maxChars <= 0 || contentStr.length <= maxChars) return contentStr;
 
   const headChars = Math.floor(maxChars * 0.2);
   const tailChars = maxChars - headChars;
```

---

### Incident Patch 15: `f5dc904d` (2026-09-29)
**Commit Message**: fix(core): enable autonomous plan execution in non-interactive mode (#29539)

Co-authored-by: David Pierce <[REDACTED_EMAIL]>

**File**: `evals/plan_mode.eval.ts` (modified, +42/-0)
```diff
@@ -470,4 +470,46 @@ describe('plan_mode', () => {
       ).toBeDefined();
     },
   });
+
+  evalTest('USUALLY_PASSES', {
+    suiteName: 'plan_mode',
+    suiteType: 'behavioral',
+    name: 'should autonomously draft plan and exit plan mode in non-interactive mode',
+    approvalMode: ApprovalMode.PLAN,
+    params: {
+      settings,
+    },
+    prompt:
+      'Create an implementation plan for adding a greet function in src/greeter.ts and finalize the plan with exit_plan_mode to begin implementation.',
+    assert: async (rig, result) => {
+      const exitPlanCalled = await rig.waitForToolCall('exit_plan_mode');
+      expect(
+        exitPlanCalled,
+        'Expected exit_plan_mode tool to be called autonomously',
+      ).toBe(true);
+
+      await rig.waitForTelemetryReady();
+      const toolLogs = rig.readToolLogs();
+
+      const exitPlanCall = toolLogs.find(
+        (log) => log.toolRequest.name === 'exit_plan_mode',
+      );
+      expect(
+        exitPlanCall,
+        'Expected to find exit_plan_mode in tool logs',
+      ).toBeDefined();
+
+      const planWrite = toolLogs.find(
+        (log) =>
+          log.toolRequest.name === 'write_file' &&
+          log.toolRequest.args.includes('/plans/'),
+      );
+      expect(
+        planWrite,
+        'Expected a plan file to be written in the plans directory',
+      ).toBeDefined();
+
+      assertModelHasOutput(result);
+    },
+  });
 });
```

**File**: `packages/core/src/prompts/planModeNonInteractive.test.ts` (added, +193/-0)
```diff
@@ -0,0 +1,193 @@
+/**
+ * @license
+ * Copyright 2026 Google LLC
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+import { describe, it, expect, vi, beforeEach } from 'vitest';
+import { renderPlanningWorkflow } from './snippets.js';
+import { PromptProvider } from './promptProvider.js';
+import { ApprovalMode } from '../policy/types.js';
+import type { Config } from '../config/config.js';
+import type { ToolRegistry } from '../tools/tool-registry.js';
+import { TopicState } from '../config/topicState.js';
+
+vi.mock('../tools/memoryTool.js', async (importOriginal) => {
+  const actual =
+    await importOriginal<typeof import('../tools/memoryTool.js')>();
+  return {
+    ...actual,
+    getAllGeminiMdFilenames: vi.fn().mockReturnValue([]),
+  };
+});
+
+vi.mock('../utils/gitUtils.js', () => ({
+  isGitRepository: vi.fn().mockReturnValue(false),
+}));
+
+describe('Plan Mode Non-Interactive Workflow', () => {
+  describe('renderPlanningWorkflow', () => {
+    it('should return empty string when options is undefined', () => {
+      expect(renderPlanningWorkflow(undefined)).toBe('');
+    });
+
+    it('should include consultation, alignment check, and wait directives in interactive mode', () => {
+      const prompt = renderPlanningWorkflow({
+        interactive: true,
+        plansDir: 'plans',
+        planModeToolsList: '- read_file\n- grep_search',
+      });
+
+      // Goal
+      expect(prompt).toContain('get user approval before editing source code.');
+
+      // Rule 3
+      expect(prompt).toContain(
+        'If the request is ambiguous, use `ask_user` to clarify.',
+      );
+
+      // Step 2: Consult
+      expect(prompt).toContain('### 2. Consult');
+      expect(prompt).toContain('STOP and wait');
+      expect(prompt).toContain(
+        'You MUST NOT proceed to Step 3 (Draft) or Step 4',
+      );
+      expect(prompt).toContain('`ask_user`');
+
+      // Step 3: Alignment Check
+      expect(prompt).toContain('Alignment Check:');
+
+      // Step 4: Review & Approval
+      expect(prompt).toContain('AFTER you have reached an informal agreement');
+      expect(prompt).toContain('formally request approval.');
+    });
+
+    it('should NOT halt or wait for user agreement in non-interactive mode', () => {
+      const prompt = renderPlanningWorkflow({
+        interactive: false,
+        plansDir: 'plans',
+        planModeToolsList: '- read_file\n- grep_search',
+      });
+
+      // Goal
+      expect(prompt).toContain(
+        'create a design document before proceeding autonomously.',
+      );
+      expect(prompt).not.toContain(
+        'get user approval before editing source code.',
+      );
+
+      // Rule 3 should not reference ask_user
+      expect(prompt).toContain(
+        'Autonomously combine discovery and drafting phases to minimize conversational turns.',
+      );
+      expect(prompt).not.toContain('`ask_user`');
+
+      // Step 2 should be Determine Strategy, not Consult
+      expect(prompt).toContain('### 2. Determine Strategy');
+      expect(prompt).not.toContain('### 2. Consult');
+      expect(prompt).not.toContain('STOP and wait');
+      expect(prompt).not.toContain(
+        'You MUST NOT proceed to Step 3 (Draft) or Step 4',
+      );
+      expect(prompt).not.toContain('You MUST wait for user feedback');
+
+      // Step 3 should not require Alignment Check with human
+      expect(prompt).not.toContain('Alignment Check:');
+
+      // Step 4 should begin implementation without informal agreement
+      expect(prompt).not.toContain(
+        'AFTER you have reached an informal agreement',
+      );
+      expect(prompt).toContain('begin implementation.');
+    });
+  });
+
+  describe('PromptProvider in non-interactive Plan Mode', () => {
+    let mockConfig: Config;
+
+    beforeEach(() => {
+      const mockToolRegistry = {
+        getAllToolNames: vi
+          .fn()
+          .mockReturnValue(['read_file', 'exit_plan_mode']),
+        getAllTools: vi.fn().mockReturnValue([]),
+      } as unknown as ToolRegistry;
+
+      mockConfig = {
+        get config() {
+          return this as unknown as Config;
+        },
+        get toolRegistry() {
+          return mockToolRegistry;
+        },
+        getToolRegistry: vi.fn().mockReturnValue(mockToolRegistry),
+        getProjectRoot: vi.fn().mockReturnValue('/tmp/test-project'),
+        topicState: new TopicState(),
+        getEnableShellOutputEfficiency: vi.fn().mockReturnValue(true),
+        getSandboxEnabled: vi.fn().mockReturnValue(false),
+        storage: {
+          getPlansDir: vi.fn().mockReturnValue('/tmp/test-project/plans'),
+          getProjectMemoryDir: vi
+            .fn()
+            .mockReturnValue('/tmp/test-project/memory'),
+          getProjectTempTrackerDir: vi
+            .fn()
+            .mockReturnValue('/tmp/test-project/tracker'),
+        },
+        isInteractive: vi.fn().mockReturnValue(false),
+        isInteractiveShellEnabled: vi.fn().mockReturnValu
```

**File**: `packages/core/src/prompts/snippets.ts` (modified, +22/-9)
```diff
@@ -599,6 +599,21 @@ export function renderPlanningWorkflow(
   options?: PlanningWorkflowOptions,
 ): string {
   if (!options) return '';
+  const consultSection = options.interactive
+    ? `### 2. Consult
+The depth of your consultation should be proportional to the task's complexity. Before proceeding to Step 3 (Draft), you MUST discuss your findings and proposed strategy with the user to reach an informal agreement.
+- **Simple Tasks:** Briefly describe your proposed strategy in the chat to ensure alignment, then **STOP and wait** for the user to confirm agreement before drafting the plan.
+- **Standard Tasks:** If multiple viable approaches exist, present a concise summary (including pros/cons and your recommendation) via ${formatToolName(ASK_USER_TOOL_NAME)} and wait for a decision.
+- **Complex Tasks:** You MUST present at least two viable approaches with detailed trade-offs via ${formatToolName(ASK_USER_TOOL_NAME)} and obtain approval before drafting the plan.
+
+**CRITICAL:** You MUST NOT proceed to Step 3 (Draft) or Step 4 (Review & Approval) in the same turn as your initial strategy proposal. You MUST wait for user feedback and reach a clear agreement before drafting or submitting the plan.`
+    : `### 2. Determine Strategy
+Synthesize your exploration findings to select the best approach and implementation strategy. Because you are running non-interactively, proceed directly to Step 3 (Draft) autonomously without halting or waiting for user confirmation.`;
+
+  const reviewAndApprovalSection = options.interactive
+    ? `ONLY use the built-in ${formatToolName(EXIT_PLAN_MODE_TOOL_NAME)} tool to present the plan for formal approval AFTER you have reached an informal agreement with the user in the chat regarding the proposed strategy. **CRITICAL: NEVER attempt to call this tool via ${formatToolName(SHELL_TOOL_NAME)}.** When called, this tool will present the plan and formally request approval.`
+    : `Use the built-in ${formatToolName(EXIT_PLAN_MODE_TOOL_NAME)} tool to finalize the plan. **CRITICAL: NEVER attempt to call this tool via ${formatToolName(SHELL_TOOL_NAME)}.** When called, this tool will present the plan and begin implementation.`;
+
   return `
 # Active Approval Mode: Plan
 
@@ -613,7 +628,11 @@ ${options.planModeToolsList}
 ## Rules
 1. **Read-Only:** You cannot modify source code. You may ONLY use read-only tools to explore, and you can only write to \`${options.plansDir}/\`. If the user asks you to modify source code directly, you MUST explain that you are in Plan Mode and must first create a plan and get approval.
 2. **Write Constraint:** ${formatToolName(WRITE_FILE_TOOL_NAME)} and ${formatToolName(EDIT_TOOL_NAME)} may ONLY be used to write .md plan files to \`${options.plansDir}/\`. They cannot modify source code.
-3. **Efficiency:** Autonomously combine discovery and drafting phases to minimize conversational turns. If the request is ambiguous, use ${formatToolName(ASK_USER_TOOL_NAME)} to clarify. Use multi-select to offer flexibility and include detailed descriptions for each option to help the user understand the implications of their choice.
+3. **Efficiency:** Autonomously combine discovery and drafting phases to minimize conversational turns.${
+    options.interactive
+      ? ` If the request is ambiguous, use ${formatToolName(ASK_USER_TOOL_NAME)} to clarify. Use multi-select to offer flexibility and include detailed descriptions for each option to help the user understand the implications of their choice.`
+      : ''
+  }
 4. **Inquiries and Directives:** Distinguish between Inquiries and Directives to minimize unnecessary planning.
    - **Inquiries:** If the request is an **Inquiry** (e.g., "How does X work?"), answer directly. DO NOT create a plan.
    - **Directives:** If the request is a **Directive** (e.g., "Fix bug Y"), follow the workflow below.
@@ -627,13 +646,7 @@ Plan Mode uses an adaptive planning workflow where the research depth, plan stru
 ### 1. Explore & Analyze
 Analyze requirements and use search/read tools to explore the codebase. Systematically map affected modules, trace data flow, and identify dependencies.
 
-### 2. Consult
-The depth of your consultation should be proportional to the task's complexity. Before proceeding to Step 3 (Draft), you MUST discuss your findings and proposed strategy with the user to reach an informal agreement.
-- **Simple Tasks:** Briefly describe your proposed strategy in the chat to ensure alignment, then **STOP and wait** for the user to confirm agreement before drafting the plan.
-- **Standard Tasks:** If multiple viable approaches exist, present a concise summary (including pros/cons and your recommendation) via ${formatToolName(ASK_USER_TOOL_NAME)} and wait for a decision.
-- **Complex Tasks:** You MUST present at least two viable approaches with detailed trade-offs via ${formatToolName(ASK_USER_TOOL_NAME)} and obtain approval before drafting the plan.
-
-**CRITICAL:** You MUST NOT proceed to Step 3 (Draft) o
```

#### Recent Merged Pull Requests:
- **PR #29637** (closed): chore(deps): bump @grpc/grpc-js from 1.14.4 to 1.14.5 in /tools/caretaker-agent/cloudrun/ingestion-service (@dependabot[bot])
- **PR #29636** (closed): chore(deps): bump ip-address from 10.2.0 to 10.7.3 (@dependabot[bot])
- **PR #29631** (closed): chore(deps): bump @grpc/grpc-js from 1.14.3 to 1.14.5 (@dependabot[bot])
- **PR #29604** (closed): fix(core): split custom headers only before a valid RFC 9110 token (@ump45nose)
- **PR #29601** (closed): Security research: workflow_run artifact chain PoC (@jortles)
- **PR #29586** (2026-10-01): fix(cli): ensure Ctrl+C emergency abort reaches cancellation handler during active operations (@urielefrenvirtusa)
- **PR #29585** (closed): [VRP PoC - do not merge] benign CI runner identity check (whoami only) (@MathCarv)
- **PR #29581** (2026-10-01): fix(cli): resolve @file:line references and prevent ghost text wrap hang (@jesussamuel-byte)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
