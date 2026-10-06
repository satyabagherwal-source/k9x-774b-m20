# Forensic Learning Record (Deep Inspection): preset-io/agor

> **Canonical Artifact**: `07_PROJECT_LEARNING/preset-io-agor-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/preset-io/agor](https://github.com/preset-io/agor))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:20:09.847Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `preset-io/agor`
- **Description**: Multiplayer AI: Bring your team and agents together
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1426 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/agor-cli/src/hooks/command-not-found.ts`
```
/**
 * Hook for handling command not found errors gracefully
 */
import type { Hook } from '@oclif/core';
import chalk from 'chalk';

const hook: Hook<'command_not_found'> = async ({ id }) => {
  console.log('');
  console.log(chalk.red('✗ Command not found:'), chalk.cyan(id));
  console.log('');
  console.log(`Run ${chalk.cyan('agor --help')} to see available commands.`);
  console.log('');
  process.exit(1);
};

export default hook;

```

### Core Architecture Module: `apps/agor-cli/src/hooks/prerun.ts`
```
import { loadConfig } from '@agor/core/config';
import type { Hook } from '@oclif/core';
import { executionPolicyFor } from '../lib/execution-policy.js';
import { assertLocalContextUnlocked } from '../lib/local-context.js';

const hook: Hook<'prerun'> = async ({ Command }) => {
  const id = Command.id;
  // Daemon lifecycle commands resolve their persisted custom config path before
  // applying the same guard; a generic ~/.agor/config.yaml check would drift.
  if (!id || executionPolicyFor(id) !== 'local' || id.startsWith('daemon:')) return;
  await assertLocalContextUnlocked(await loadConfig());
};

export default hook;

```

### Core Architecture Module: `apps/agor-cli/src/lib/knowledge/transfer-lifecycle.ts`
```
import { KnowledgeProgress } from './progress';

/** Scope process listeners and progress to one transfer; always release its client. */
export async function withKnowledgeTransfer<T>(
  options: { failureNote: string; cleanup: () => Promise<void> },
  operation: (context: { signal: AbortSignal; progress: KnowledgeProgress }) => Promise<T>
): Promise<T> {
  const progress = new KnowledgeProgress();
  const controller = new AbortController();
  const cancel = () => controller.abort();
  process.once('SIGINT', cancel);
  process.once('SIGTERM', cancel);
  try {
    return await operation({ signal: controller.signal, progress });
  } catch (error) {
    progress.failure(options.failureNote);
    throw error;
  } finally {
    process.off('SIGINT', cancel);
    process.off('SIGTERM', cancel);
    try {
      progress.close();
    } finally {
      await options.cleanup();
    }
  }
}

```

### Core Architecture Module: `apps/agor-cli/src/utils/shell.ts`
```
/**
 * Shell utilities for spawning interactive shells
 */

import { type ChildProcess, spawn } from 'node:child_process';

export interface SpawnShellOptions {
  /**
   * Working directory for the shell
   */
  cwd: string;

  /**
   * Additional environment variables to set
   */
  env?: Record<string, string>;

  /**
   * Callback when shell exits
   */
  onExit?: (code: number | null) => void;

  /**
   * Callback on error
   */
  onError?: (error: Error) => void;
}

/**
 * Spawn an interactive shell in the specified directory.
 *
 * This will:
 * - Use the user's preferred shell ($SHELL)
 * - Run in interactive mode (loads .zshrc, .bashrc, etc.)
 * - Inherit stdio for full interactivity
 * - Preserve all environment variables
 *
 * @param options - Shell spawn options
 * @returns The spawned child process
 */
export function spawnInteractiveShell(options: SpawnShellOptions): ChildProcess {
  const { cwd, env = {}, onExit, onError } = options;

  // Get user's preferred shell
  const shell = process.env.SHELL || '/bin/bash';

  // Spawn shell in interactive mode (-i flag)
  // This ensures it loads the user's config files (.zshrc, .bashrc, etc.)
  const shellProcess = spawn(shell, ['-i'], {
    cwd,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...env,
    },
  });

  // Handle exit
  if (onExit) {
    shellProcess.on('exit', onExit);
  }

  // Handle errors
  if (onError) {
    shellProcess.on('error', onError);
  }

  return shellProcess;
}

```

### Core Architecture Module: `apps/agor-daemon/src/auth/issue-browser-tokens-hook.ts`
```
import type { SignOptions } from 'jsonwebtoken';
import { issueRuntimeTokenPair, runtimeTenantClaims } from './runtime-tokens.js';
import { authCredentialGenerationClaim, authTokenIssuedAtClaim } from './token-invalidation.js';
import { redactUserAuthMetadata } from './user-redaction.js';

/**
 * JWT payload types that identify machine credentials (executor sockets,
 * service-to-service calls) rather than an interactive browser client.
 */
const MACHINE_TOKEN_TYPES = new Set(['executor-session', 'service']);

export interface IssueBrowserTokensHookOptions {
  jwtSecret: string;
  accessTokenTtl: SignOptions['expiresIn'];
  refreshTokenTtl: SignOptions['expiresIn'];
  tenantClaim: string;
  now?: () => number;
  debug?: (...args: unknown[]) => void;
}

/**
 * After-create hook for the authentication service: replace the strategy's
 * access token with a browser access token and attach a refresh token.
 *
 * Machine-token logins (executor-session / service JWTs) are exempt from the
 * swap. Replacing a machine credential with a browser token would erase its
 * task/terminal scope and shorten the authority represented by the result.
 * Machine logins also must not receive long-lived refresh tokens meant for
 * interactive clients. The Socket.IO namespace normally invokes the strategy
 * directly. The provider guard below is defense in depth: an alternate socket
 * login path must never mint and discard a browser token pair.
 *
 * User redaction applies on every path that returns a user.
 */
export function createIssueBrowserTokensHook(options: IssueBrowserTokensHookOptions) {
  const {
    jwtSecret,
    accessTokenTtl,
    refreshTokenTtl,
    tenantClaim,
    now = Date.now,
    debug,
  } = options;

  // biome-ignore lint/suspicious/noExplicitAny: FeathersJS context type not fully typed
  return async (context: any) => {
    debug?.('✅ Authentication succeeded:', {
      strategy: context.result?.authentication?.strategy,
      hasUser: !!context.result?.user,
      user_id: context.result?.user?.user_id,
      hasAccessToken: !!context.result?.accessToken,
    });

    if (!context.result?.user) {
      return context;
    }

    if (context.params?.provider === 'socketio') {
      context.result.user = redactUserAuthMetadata(context.result.user);
      return context;
    }

    const payloadType = context.result.authentication?.payload?.type;
    if (typeof payloadType === 'string' && MACHINE_TOKEN_TYPES.has(payloadType)) {
      context.result.user = redactUserAuthMetadata(context.result.user);
      return context;
    }

    const tenantId =
      context.params?.tenant?.tenant_id ??
      (context.result.user as { tenant_id?: string }).tenant_id;
    const tokens = issueRuntimeTokenPair(
      context.result.user,
      jwtSecret,
      accessTokenTtl,
      refreshTokenTtl,
      {
        ...authCredentialGenerationClaim(context.result.user),
        ...authTokenIssuedAtClaim(now(), context.result.user),
        ...runtimeTenantClaims(tenantId, tenantClaim),
      }
    );
    context.result.accessToken = tokens.accessToken;
    context.result.refreshToken = tokens.refreshToken;
    context.result.user = redactUserAuthMetadata(context.result.user);
    return context;
  };
}

```

### Core Architecture Module: `apps/agor-daemon/src/hooks/board-artifact-visibility.ts`
```
import { type ArtifactRepository, attachHiddenTenant } from '@agor/core/db';
import type { Board, HookContext } from '@agor/core/types';

/** Filter only artifact references; board authorization and tenant scope are upstream. */
export function filterBoardArtifactObjects(
  artifacts: Pick<ArtifactRepository, 'findBoardReferenceVisibleIds'>
) {
  return async (context: HookContext<Board>) => {
    const result = context.result;
    if (!result) return context;
    const boards: Board[] =
      context.method === 'get'
        ? [result]
        : Array.isArray(result)
          ? result
          : (result as unknown as { data: Board[] }).data;
    if (!boards?.length) return context;

    const references = new Set<string>();
    for (const board of boards) {
      for (const object of Object.values(board.objects ?? {})) {
        if (
          object?.type === 'artifact' &&
          typeof object.artifact_id === 'string' &&
          object.artifact_id
        ) {
          references.add(object.artifact_id);
        }
      }
    }
    const userId = (context.params as { user?: { user_id: string } }).user?.user_id;
    let visible = new Set<string>();
    if (references.size) {
      try {
        visible = await artifacts.findBoardReferenceVisibleIds([...references], userId);
      } catch {
        // Ordinary query failures are denied per bounded repository chunk,
        // retaining other verified successes. A boundary/unexpected failure
        // here denies all references; it must never expose private/stale data.
      }
    }
    for (const board of boards) {
      if (!board.objects) continue;
      let filtered: Board['objects'];
      for (const [key, object] of Object.entries(board.objects)) {
        // Preserve legacy placeholders with no artifact_id, and all non-artifact
        // objects. Do not rewrite keys, positions, or other board metadata.
        if (object?.type === 'artifact' && object.artifact_id && !visible.has(object.artifact_id)) {
          filtered ??= { ...board.objects };
          delete filtered[key];
        }
      }
      // No-op reads preserve identity and nonenumerable metadata. Changed get
      // responses retain the trusted tenant marker for downstream assertions.
      if (!filtered) continue;
      if (context.method === 'get') {
        context.result = attachHiddenTenant({ ...board, objects: filtered }, board);
      } else board.objects = filtered;
    }
    return context;
  };
}

```

### Core Architecture Module: `apps/agor-daemon/src/hooks/classify-missing-credential.ts`
```
/**
 * Before-create hook that reclassifies executor-scoped provider failures
 * without matching arbitrary provider stderr. It handles explicit credential
 * preflight failures and provider-result messages whose credential state can
 * be resolved authoritatively. Arbitrary provider prose is never classified.
 */

import { TOOL_API_KEY_NAMES } from '@agor/agentic-tools';
import { SAFE_ZERO_TURN_PROVIDER_RESULT_MESSAGE } from '@agor/core';
import { resolveApiKey } from '@agor/core/config';
import type { SessionRepository, TaskRepository, TenantScopeAwareDatabase } from '@agor/core/db';
import { Forbidden } from '@agor/core/feathers';
import type {
  AgenticToolName,
  HookContext,
  Message,
  MessageID,
  TaskID,
  UserID,
} from '@agor/core/types';
import {
  canonicalTenantAgenticTool,
  isAgenticToolName,
  MessageRole,
  PROVIDER_CREDENTIAL_FIELDS,
} from '@agor/core/types';
import {
  authenticatedTaskExecutorRuntimeScope,
  matchesTaskExecutorRuntimeScope,
} from '../auth/executor-runtime-scope.js';

/** Fallback for consumers that render `content` raw (mobile, gateway, CLI).
 * The web UI renders its own copy from MissingCredentialPanel instead. */
function fallbackContent(toolDisplayName: string): string {
  return `This session needs to be connected to ${toolDisplayName} before it can run.`;
}

type ProviderFailureKind = 'missing_credential';

export type ProviderFailureMessageLoader = (messageId: MessageID) => Promise<Message | null>;

function declaresProviderFailure(data: unknown): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const metadata = (data as { metadata?: unknown }).metadata;
  return (
    !!metadata &&
    typeof metadata === 'object' &&
    !Array.isArray(metadata) &&
    'error_kind' in metadata
  );
}

/** Reject public single/bulk DTOs that attempt to mint daemon-owned recovery states. */
export function assertExternalProviderFailureMetadataAllowed(data: unknown): void {
  const writes = Array.isArray(data) ? data : [data];
  if (writes.some(declaresProviderFailure)) {
    throw new Forbidden('Provider failure metadata can only be classified by the daemon');
  }
}

function changesProviderFailureOwnedFields(data: unknown): boolean {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const record = data as Record<string, unknown>;
  return (
    'metadata' in record ||
    'type' in record ||
    'role' in record ||
    'content' in record ||
    'content_preview' in record
  );
}

/**
 * Keep the recovery-panel discriminator and its render gate owned by daemon
 * classification. Public patching uses a shallow repository merge, so an
 * otherwise harmless-looking metadata/type/role patch could erase or hide a
 * trusted classification unless the existing record is checked first.
 */
export function protectExternalProviderFailureMetadata(loadMessage: ProviderFailureMessageLoader) {
  return async (context: HookContext): Promise<HookContext> => {
    if (!context.params.provider) return context;
    assertExternalProviderFailureMetadataAllowed(context.data);

    if (context.method !== 'patch' || context.id === null || context.id === undefined) {
      return context;
    }
    if (!changesProviderFailureOwnedFields(context.data)) return context;

    const existing = await loadMessage(String(context.id) as MessageID);
    if (existing && declaresProviderFailure(existing)) {
      throw new Forbidden('Provider failure classification is daemon-owned');
    }
    return context;
  };
}

function classifyProviderFailure(
  data: Partial<Message>,
  tool: AgenticToolName,
  toolDisplayName: string,
  errorKind: ProviderFailureKind
): Partial<Message> {
  const content = fallbackContent(toolDisplayName);

  return {
    ...data,
    type: 'system',
    role: MessageRole.SYSTEM,
    content,
    content_preview: content.substring(0, 200),
    metadata: {
      ...data.metadata,
      error_kind: errorKind,
      tool,
    },
  };
}

function hasResolvedCredential(
  tool: AgenticToolName,
  connection: Record<string, string | undefined> | undefined
): boolean {
  const canonicalTool = canonicalTenantAgenticTool(tool);
  if (!(canonicalTool in PROVIDER_CREDENTIAL_FIELDS)) return false;
  return PROVIDER_CREDENTIAL_FIELDS[canonicalTool as keyof typeof PROVIDER_CREDENTIAL_FIELDS].some(
    (field) => connection?.[field]?.trim()
  );
}

export function classifyMissingCredentialFailure(
  db: TenantScopeAwareDatabase,
  taskRepository: Pick<TaskRepository, 'findById'>,
  sessionsRepository: Pick<SessionRepository, 'findById'>,
  toolDisplayNames: Record<string, string>
) {
  return async (context: HookContext): Promise<HookContext> => {
    let data = context.data as Partial<Message> | undefined;
    if (!data?.task_id || !data.session_id) return context;
    const taskId = data.task_id as TaskID;
    const sessionId = data.session_id;
    const executorScope = authenticatedTaskExecutorRuntimeScope(context.params);
    if (!executorScope) return context;

    const isMissingCredentialFailure = data.metadata?.is_missing_credential_failure === true;
    const isZeroTurnResult = data.metadata?.is_zero_turn_result === true;
    const isProviderFailureResult = data.metadata?.is_provider_failure_result === true;

    if (!isMissingCredentialFailure && !isZeroTurnResult && !isProviderFailureResult) {
      return context;
    }
    if (!matchesTaskExecutorRuntimeScope(executorScope, data)) {
      throw new Forbidden('Provider failure classification requires this task executor');
    }

    // Provider result bodies are untrusted and this hook runs immediately
    // before persistence/realtime publication. Close the body before any DB or
    // credential lookup which can fail. Missing-credential classification may
    // replace this fixed fallback below; no other provider prose is retained.
    if (isZeroTurnResult || isProviderFailureResult) {
      data = {
        ...data,
        content: SAFE_ZERO_TURN_PROVIDER_RESULT_MESSAGE,
        content_preview: SAFE_ZERO_TURN_PROVIDER_RESULT_MESSAGE.substring(0, 200),
      };
      context.data = data;
    }

    try {
      const [task, session] = await Promise.all([
        taskRepository.findById(taskId),
        sessionsRepository.findById(sessionId),
      ]);
      if (!task || !session) return context;
      if (task.session_id !== sessionId || session.session_id !== sessionId) {
        return context;
      }

      const tool = session.agentic_tool;
      if (!isAgenticToolName(tool)) return context;
      const keyName = TOOL_API_KEY_NAMES[tool];
      // Tools with no mapped key (e.g. opencode) aren't credential-gated.
      if (!keyName) return context;

      if ((isZeroTurnResult || isProviderFailureResult) && !isMissingCredentialFailure) {
        const resolution = await resolveApiKey(keyName, {
          userId: task.created_by as UserID,
          db,
          tool,
        });

        const hasCredential =
          resolution.apiKey ||
          resolution.useNativeAuth ||
          hasResolvedCredential(tool, resolution.connection);
        if (!hasCredential) {
          // Missing credential wins over any provider text in the synthesized
          // result: the scoped resolver is the source of truth here.
          context.data = classifyProviderFailure(
            data,
            tool,
            toolDisplayNames[tool] ?? tool,
            'missing_credential'
          );
          return context;
        }

        // Claude/Codex provider result strings have no typed billing/auth
        // discriminator. Parsing arbitrary prose here would both reintroduce a
        // secret-reflection boundary and claim recovery state we cannot prove.
        // Keep the fixed generic provider-result fallback.
        return context;
      }

      // Normalize both pathways onto system/SYSTEM so the UI has one render branch.
      context.data = classifyProviderFailure(
        data,
        tool,
        toolDisplayNames[tool] ?? tool,
        'missing_credential'
      );
    } catch {
      console.error('[classifyMissingCredentialFailure] classification failed');
    }

    return context;
  };
}

```

### Core Architecture Module: `apps/agor-daemon/src/hooks/gateway-route.ts`
```
/**
 * Gateway Route Hook
 *
 * FeathersJS `after` hook for the messages service `create` method.
 * Routes assistant messages to connected platforms via the gateway service.
 * Fire-and-forget — never blocks message creation.
 */

import type { ContentBlock, HookContext, Message } from '@agor/core/types';
import type { GatewayService } from '../services/gateway';

interface GatewayToolUse {
  name: string;
  input: Record<string, unknown>;
}

/**
 * Extract readable text from message content.
 * Handles string content, ContentBlock[] arrays, and other shapes gracefully.
 */
function extractText(content: Message['content']): string {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return (content as ContentBlock[])
      .filter((b) => b.type === 'text')
      .map((b) => (b as Record<string, unknown>).text as string)
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function isGatewayThinkingPlaceholder(text: string): boolean {
  return /^thinking\s*\.{3}$/i.test(text.trim());
}

function extractLatestToolUse(content: Message['content']): GatewayToolUse | null {
  if (!Array.isArray(content)) return null;

  for (let i = content.length - 1; i >= 0; i--) {
    const block = content[i] as Record<string, unknown>;
    if (block.type !== 'tool_use') continue;
    if (typeof block.name !== 'string') continue;
    const input =
      block.input && typeof block.input === 'object' && !Array.isArray(block.input)
        ? (block.input as Record<string, unknown>)
        : {};
    return { name: block.name, input };
  }

  return null;
}

function extractLatestToolUseFromMessage(message: Message): GatewayToolUse | null {
  const fromContent = extractLatestToolUse(message.content);
  if (fromContent) return fromContent;

  const toolUses = message.tool_uses;
  if (!Array.isArray(toolUses) || toolUses.length === 0) return null;

  const latest = toolUses[toolUses.length - 1];
  if (!latest || typeof latest.name !== 'string') return null;
  return {
    name: latest.name,
    input:
      latest.input && typeof latest.input === 'object' && !Array.isArray(latest.input)
        ? latest.input
        : {},
  };
}

/**
 * After hook that routes messages through the gateway.
 * Routes:
 * - All assistant messages
 * - User messages that originated from Agor UI (not from gateway)
 *
 * Errors are caught and logged, never propagated to avoid slowing down message creation.
 */
export const gatewayRouteHook = async (context: HookContext) => {
  const message = context.result as Message;
  const gatewayService = context.app.service('gateway') as unknown as GatewayService;

  // Determine if message should be routed to gateway
  let shouldRoute = false;
  let messageText = extractText(message.content);
  const latestToolUse = extractLatestToolUseFromMessage(message);

  // Tool calls are valuable for Slack's native assistant status/stream: current
  // tool + TodoWrite plan. Some agent SDKs include text and tool_use blocks in the
  // same assistant message, so update progress whenever we see a tool call,
  // not only for tool-only rows.
  if (latestToolUse) {
    try {
      gatewayService.updateProgressAfterCommit(
        {
          session_id: message.session_id,
          state: 'working',
          task_id: message.task_id,
          tool_name: latestToolUse.name,
          tool_input: latestToolUse.input,
        },
        context.params
      );
    } catch (error) {
      console.warn('[gateway-route] Failed to route tool progress:', error);
    }
    // Tool-only rows should not be posted as normal chat messages.
    if (!messageText) {
      return context;
    }
  }

  if (!messageText && message.role === 'assistant' && typeof message.content_preview === 'string') {
    messageText = message.content_preview;
  }

  if (message.role === 'assistant' && messageText && isGatewayThinkingPlaceholder(messageText)) {
    return context;
  }

  if (message.role === 'assistant') {
    if (
      gatewayService.wasMessageStreamedToSlack?.(message.message_id) ||
      gatewayService.wasTaskStreamedToSlack?.(message.task_id)
    ) {
      return context;
    }
    // Always route assistant messages
    shouldRoute = true;
  } else if (message.role === 'system') {
    // Route low-volume structured system messages to gateway surfaces when the
    // producer explicitly marks them for external context-style rendering.
    const systemMeta = message.metadata?.system as Record<string, unknown> | undefined;
    if (systemMeta?.render_hint === 'context' || /^\[system\]/i.test(messageText.trim())) {
      shouldRoute = true;
    }
  } else if (message.role === 'user') {
    // Route user messages that originated from Agor (not from gateway)
    const source = message.metadata?.source;

    if (source === 'agor') {
      // User message from Agor UI - route to Slack with username prefix
      shouldRoute = true;

      // Attribute the message to the immutable Task actor. A shared prompt
      // keeps the Session owner's conversation/home, but it must never be
      // published externally as though that owner authored another user's
      // prompt.
      let actorName = 'Agor user';
      try {
        if (!message.task_id) {
          throw new Error('Message has no Task attribution');
        }
        const tasksService = context.app.service('tasks');
        const usersService = context.app.service('users');
        const task = await tasksService.get(message.task_id);
        if (task?.session_id !== message.session_id) {
          throw new Error('Message Task does not belong to its Session');
        }
        const user = await usersService.get(task.created_by);
        if (user?.name) actorName = user.name;
      } catch (error) {
        console.warn('[gateway-route] Failed to resolve prompt actor for message prefix:', error);
      }
      messageText = `[${actorName}]: ${messageText}`;
    } else if (source === 'gateway') {
      // User message from gateway (Slack) - don't route (prevents echo)
      shouldRoute = false;
    } else {
      // Legacy message without source tracking - treat as gateway to be safe
      shouldRoute = false;
    }
  }

  if (!shouldRoute) {
    return context;
  }

  if (!messageText) {
    return context; // No text to route (tool-only messages, etc.)
  }

  // Fire-and-forget: route message through gateway
  try {
    // Don't await — fire and forget
    gatewayService.routeMessageAfterCommit(
      {
        session_id: message.session_id,
        message_id: message.message_id,
        message: messageText,
        metadata: message.metadata,
      },
      context.params
    );
  } catch (error) {
    console.warn('[gateway-route] Failed to invoke gateway service:', error);
  }

  return context;
};

```

### Core Architecture Module: `apps/agor-daemon/src/hooks/validate-message-create.ts`
```
import { BadRequest } from '@agor/core/feathers';
import {
  type HookContext,
  isCanonicalFullUuid,
  MESSAGE_TYPE_VALUES,
  type MessageCreate,
  MessageRole,
} from '@agor/core/types';

const MESSAGE_CREATE_FIELDS = new Set<keyof MessageCreate>([
  'message_id',
  'session_id',
  'task_id',
  'type',
  'role',
  'index',
  'timestamp',
  'content_preview',
  'content',
  'tool_uses',
  'parent_tool_use_id',
  'metadata',
]);
const MESSAGE_TYPES = new Set<string>(MESSAGE_TYPE_VALUES);
const MESSAGE_ROLES = new Set<string>(Object.values(MessageRole));

/** Runtime counterpart to the public MessageCreate DTO. */
export function assertMessageCreatePayload(data: unknown): asserts data is MessageCreate {
  if (Array.isArray(data)) throw new BadRequest('Bulk Message create is not supported');
  if (data === null || typeof data !== 'object') {
    throw new BadRequest('Message create payload must be an object');
  }

  const input = data as Record<string, unknown>;
  const unsupported = Object.keys(input).filter(
    (field) => !MESSAGE_CREATE_FIELDS.has(field as keyof MessageCreate)
  );
  if (unsupported.length > 0) {
    throw new BadRequest(`Unsupported Message create fields: ${unsupported.join(', ')}`);
  }

  if (input.message_id !== undefined && !isCanonicalFullUuid(input.message_id)) {
    throw new BadRequest('message_id must be a canonical full UUID when provided');
  }
  if (!isCanonicalFullUuid(input.session_id)) {
    throw new BadRequest('session_id must be a canonical full UUID');
  }
  if (input.task_id !== undefined && !isCanonicalFullUuid(input.task_id)) {
    throw new BadRequest('task_id must be a canonical full UUID when provided');
  }
  if (!MESSAGE_TYPES.has(String(input.type))) {
    throw new BadRequest('Unsupported Message type');
  }
  if (!MESSAGE_ROLES.has(String(input.role))) {
    throw new BadRequest('Unsupported Message role');
  }
  if (!Number.isSafeInteger(input.index) || (input.index as number) < 0) {
    throw new BadRequest('index must be a non-negative integer');
  }
  if (
    typeof input.timestamp !== 'string' ||
    input.timestamp.length === 0 ||
    !Number.isFinite(Date.parse(input.timestamp))
  ) {
    throw new BadRequest('timestamp must be a valid date string');
  }
  if (typeof input.content_preview !== 'string') {
    throw new BadRequest('content_preview must be a string');
  }
  if (
    !Object.hasOwn(input, 'content') ||
    input.content === null ||
    !['string', 'object'].includes(typeof input.content)
  ) {
    throw new BadRequest('content must be a string, content-block array, or request object');
  }
  if (input.tool_uses !== undefined && !Array.isArray(input.tool_uses)) {
    throw new BadRequest('tool_uses must be an array when provided');
  }
  if (
    input.parent_tool_use_id !== undefined &&
    input.parent_tool_use_id !== null &&
    typeof input.parent_tool_use_id !== 'string'
  ) {
    throw new BadRequest('parent_tool_use_id must be a string or null when provided');
  }
  if (
    input.metadata !== undefined &&
    (input.metadata === null || typeof input.metadata !== 'object' || Array.isArray(input.metadata))
  ) {
    throw new BadRequest('metadata must be an object when provided');
  }
}

/** Validate before RBAC/widget hooks inspect fields on an external payload. */
export function validateMessageCreate(context: HookContext): HookContext {
  assertMessageCreatePayload(context.data);
  return context;
}

```

### Core Architecture Module: `apps/agor-daemon/src/integrations/opencode/native-state-coordinator.ts`
```
import { BadRequest } from '@agor/core/feathers';
import {
  releaseExecutorContainmentFenceIntent,
  reserveExecutorContainmentFence,
  verifyExecutorContainmentFence,
} from '../../executor-tracking.js';
import type { ContainedExecutorCommandHandle } from '../../utils/spawn-executor.js';

const mutationSlots = new Map<string, Promise<void>>();
const blockedNamespaces = new Map<string, Set<() => Promise<boolean>>>();
const CLEANUP_UNVERIFIED_MESSAGE =
  'OpenCode provider cleanup could not be verified. Later mutations remain blocked.';

type CleanupFenceHandle = Pick<
  ContainedExecutorCommandHandle,
  'retainContainmentFence' | 'verifyAbsence'
>;

function containmentFenceKey(namespaceKey: string): string {
  return `opencode-native-state:${namespaceKey}`;
}

export async function blockOpenCodeNativeStateNamespace(
  key: string,
  handle: CleanupFenceHandle
): Promise<void> {
  const verifiers = blockedNamespaces.get(key) ?? new Set();
  verifiers.add(handle.verifyAbsence);
  blockedNamespaces.set(key, verifiers);
  try {
    await handle.retainContainmentFence(containmentFenceKey(key));
  } catch {
    throw new BadRequest(CLEANUP_UNVERIFIED_MESSAGE);
  }
}

async function verifyBlockedNamespace(key: string): Promise<void> {
  const verifiers = blockedNamespaces.get(key);
  if (verifiers) {
    await Promise.all(
      [...verifiers].map(async (verifyAbsence) => {
        try {
          if (await verifyAbsence()) verifiers.delete(verifyAbsence);
        } catch {
          // Existing containment owns details; the public service stays secret-safe.
        }
      })
    );
  }
  if (blockedNamespaces.get(key)?.size) {
    throw new BadRequest(CLEANUP_UNVERIFIED_MESSAGE);
  }
  const durableFenceVerified = await verifyExecutorContainmentFence(containmentFenceKey(key)).catch(
    () => false
  );
  const activeVerifiers = blockedNamespaces.get(key);
  if (!durableFenceVerified || activeVerifiers?.size) {
    throw new BadRequest(CLEANUP_UNVERIFIED_MESSAGE);
  }
  if (activeVerifiers === verifiers) blockedNamespaces.delete(key);
}

export interface OpenCodeNativeStateMutationFence {
  /** Replace the pre-spawn intent only after this writer's process identity is durable. */
  attach(handle: CleanupFenceHandle): Promise<void>;
  /** Release an intent only when the integration proves no writer was started. */
  releaseWithoutWriter(): Promise<void>;
}

/**
 * Serializes native-state mutation and persists a fail-closed intent before the
 * writer can start. Restart can never erase the only evidence of an active or
 * ambiguously-started writer.
 */
export async function inOpenCodeNativeStateMutationSlot<T>(
  key: string,
  work: (fence: OpenCodeNativeStateMutationFence) => Promise<T>
): Promise<T> {
  const previous = mutationSlots.get(key) ?? Promise.resolve();
  const current = previous
    .catch(() => undefined)
    .then(async () => {
      await verifyBlockedNamespace(key);
      const fenceKey = containmentFenceKey(key);
      const intentId = await reserveExecutorContainmentFence(fenceKey);
      let attached = false;
      let releasedWithoutWriter = false;

      const fence: OpenCodeNativeStateMutationFence = {
        async attach(handle) {
          if (attached || releasedWithoutWriter) {
            throw new Error('OpenCode native-state mutation fence is already settled');
          }
          try {
            await handle.retainContainmentFence(fenceKey);
            await releaseExecutorContainmentFenceIntent(fenceKey, intentId);
            attached = true;
          } catch {
            // The durable intent remains. A restart therefore fails closed even
            // if the child started before its process identity was persisted.
            throw new BadRequest(CLEANUP_UNVERIFIED_MESSAGE);
          }
        },
        async releaseWithoutWriter() {
          if (attached || releasedWithoutWriter) {
            throw new Error('OpenCode native-state mutation fence is already settled');
          }
          await releaseExecutorContainmentFenceIntent(fenceKey, intentId);
          releasedWithoutWriter = true;
        },
      };

      const result = await work(fence);
      if (releasedWithoutWriter) return result;
      if (!attached) throw new BadRequest(CLEANUP_UNVERIFIED_MESSAGE);
      if (!(await verifyExecutorContainmentFence(fenceKey).catch(() => false))) {
        throw new BadRequest(CLEANUP_UNVERIFIED_MESSAGE);
      }
      return result;
    });
  const settled = current.then(
    () => undefined,
    () => undefined
  );
  mutationSlots.set(key, settled);
  try {
    return await current;
  } finally {
    if (mutationSlots.get(key) === settled) mutationSlots.delete(key);
  }
}

```

### Core Architecture Module: `apps/agor-daemon/src/metrics/task-lifecycle.ts`
```
import type { TaskDispatchClaimResult } from '@agor/core/db';
import type { Task } from '@agor/core/types';
import type { DaemonMetrics } from './types.js';

function executorMode(task: Task): 'local' | 'templated' {
  return task.executor_mode === 'templated' ? 'templated' : 'local';
}

function durationBetween(start: string | undefined, end: string | undefined): number | undefined {
  const startMs = Date.parse(start ?? '');
  const endMs = Date.parse(end ?? '');
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return undefined;
  return Math.max(0, endMs - startMs);
}

export function recordDispatchClaim(metrics: DaemonMetrics, result: TaskDispatchClaimResult): void {
  const tags = { outcome: result.outcome, mode: executorMode(result.task) } as const;
  metrics.increment('executor.dispatches', 1, tags);
  if (result.outcome !== 'claimed') return;
  const duration = durationBetween(result.task.created_at, result.task.started_at);
  if (duration !== undefined) {
    metrics.distribution('executor.request_to_dispatch.duration_ms', duration, tags);
  }
}

export function recordExecutorConnected(metrics: DaemonMetrics, task: Task): void {
  const tags = { outcome: 'connected', mode: executorMode(task) } as const;
  metrics.increment('executor.connections', 1, tags);

  const dispatchToConnected = durationBetween(task.started_at, task.executor_connected_at);
  if (dispatchToConnected !== undefined) {
    metrics.distribution('executor.dispatch_to_connected.duration_ms', dispatchToConnected, tags);
  }
  const requestToConnected = durationBetween(task.created_at, task.executor_connected_at);
  if (requestToConnected !== undefined) {
    metrics.distribution('executor.request_to_connected.duration_ms', requestToConnected, tags);
  }
}

export function recordTaskSettlement(metrics: DaemonMetrics, task: Task): void {
  const tags = { status: task.status, mode: executorMode(task) } as const;
  metrics.increment('task.settlements', 1, tags);

  const executionDuration = durationBetween(task.started_at, task.completed_at);
  if (executionDuration !== undefined) {
    metrics.distribution('task.dispatch_to_settlement.duration_ms', executionDuration, tags);
  }
  const connectedDuration = durationBetween(task.executor_connected_at, task.completed_at);
  if (connectedDuration !== undefined) {
    metrics.distribution('task.connected_to_settlement.duration_ms', connectedDuration, tags);
  }
}

```

### Core Architecture Module: `apps/agor-daemon/src/register-hooks.ts`
```
import { KNOWLEDGE_TRANSFER, OWNERSHIP_TRANSFER_SERVICES } from '@agor/core/types';
/**
 * Service Hooks Registration
 *
 * Registers all FeathersJS service hooks (before/after/error)
 * for authentication, authorization, RBAC, and business logic.
 * Extracted from index.ts for maintainability.
 */

import { resolveOpenCodeCapabilities } from '@agor/agentic-tool-opencode/daemon';
import { AGENTIC_TOOL_DISPLAY_NAMES } from '@agor/agentic-tools';
import { projectClaudeResultResponse, projectNormalizedSdkResponse } from '@agor/core';
import { analyticsLogger } from '@agor/core/analytics';
import {
  type AgorConfig,
  type ResolvedDeploymentConfig,
  resolveExecutionSecurityMode,
  resolveMultiTenancyConfig,
  resolveMultiTenancyDatabaseDialect,
  resolveTenantContext,
  TenantResolutionError,
  type UnknownJson,
  validateRepoEnvironment,
  wrapV1AsV2,
} from '@agor/core/config';
import {
  ArtifactRepository,
  assertTenantWritable,
  attachHiddenTenant,
  BoardCommentsRepository,
  BoardObjectRepository,
  BoardRepository,
  type BranchRepository,
  CapabilityPolicyRepository,
  CardRepository,
  getMCPEgressGatewayMode,
  requireCurrentTenantId,
  runWithTenantDatabaseScope,
  ScheduleRepository,
  SessionMCPServerRepository,
  type SessionRepository,
  shortId,
  TaskRepository,
  type TenantScopeAwareDatabase,
  TenantWriteGateActiveError,
  type UsersRepository,
} from '@agor/core/db';
import {
  MANAGED_ENV_EXECUTION_MODE_DEFAULT,
  validateManagedEnvLifecyclePolicy,
  validateRenderedManagedEnvUrlFields,
  validateRepoEnvironmentLifecyclePolicy,
} from '@agor/core/environment/webhook';
import type { Application, FeathersService } from '@agor/core/feathers';
import {
  BadRequest,
  Forbidden,
  NotAuthenticated,
  NotFound,
  Unavailable,
} from '@agor/core/feathers';
import { redactGatewayChannelSecrets } from '@agor/core/gateway';
import {
  boardCommentQueryValidator,
  boardObjectQueryValidator,
  boardQueryValidator,
  branchQueryValidator,
  knowledgeDocumentQueryValidator,
  mcpCatalogQueryValidator,
  mcpServerQueryValidator,
  messageQueryValidator,
  repoQueryValidator,
  sessionQueryValidator,
  taskQueryValidator,
  typedValidateQuery,
  userQueryValidator,
} from '@agor/core/lib/feathers-validation';
import {
  assertValidMCPServerWrite,
  isMCPServerUsableBy,
  isMCPServerUsableInSession,
} from '@agor/core/mcp';
import type {
  AuthenticatedParams,
  Board,
  BoardID,
  BoardImportResult,
  Branch,
  DeepReadonly,
  GatewayChannel,
  HookContext,
  MCPServer,
  Message,
  MessageID,
  Paginated,
  Params,
  Session,
  Task,
  TaskID,
  User,
  UserID,
  UUID,
} from '@agor/core/types';
import {
  assertPublicMCPOAuthCompatibilityMode,
  BRANCH_CLEANUP_REPORT_SERVICE,
  BRANCH_DELETION_REPORT_SERVICE,
  ENVIRONMENT_COMMAND_REPORT_SERVICE,
  GATEWAY_CHANNEL_WRITE_FIELDS,
  GATEWAY_REDACTED_SENTINEL,
  hasMinimumRole,
  ROLES,
  SCHEDULE_CREATE_WRITE_FIELDS,
  SCHEDULE_PATCH_WRITE_FIELDS,
  TaskStatus,
} from '@agor/core/types';
import {
  isTaskScopedExecutorRequest,
  requireTaskScopedExecutorRuntimeToken,
} from './auth/executor-runtime-scope.js';
import type {
  BoardsServiceImpl,
  MessagesServiceImpl,
  SessionsServiceImpl,
  TasksServiceImpl,
} from './declarations.js';
import { rejectInConstrainedHa } from './ha-support.js';
import { filterBoardArtifactObjects } from './hooks/board-artifact-visibility.js';
import {
  classifyMissingCredentialFailure,
  protectExternalProviderFailureMetadata,
} from './hooks/classify-missing-credential.js';
import { gatewayRouteHook } from './hooks/gateway-route.js';
import { validateMessageCreate } from './hooks/validate-message-create.js';
import { coordinateMCPServerMutationAfterWrite } from './mcp-egress/coordination.js';
import { protectExternalPermissionMessageWrites } from './permissions/permission-message-boundary.js';
import type { RedisRealtimeRuntime } from './realtime/redis-realtime.js';
import type { ArtifactsService } from './services/artifacts.js';
import {
  publicBoardCommentCreateInput,
  publicBoardCommentPatchInput,
  rejectPublicBoardCommentUpdate,
} from './services/board-comments.js';
import { CODEX_AUTH_DEFER_USER_REALTIME } from './services/codex-auth-shared.js';
import type { GatewayService } from './services/gateway.js';
import { groupMembershipsHooks, groupsHooks } from './services/groups.js';
import { presentMCPServerOAuthPolicies } from './services/mcp-server-presentation.js';
import {
  assertSessionArchiveStateUsesDedicatedOperation,
  isRemoteRelationshipsEnrichedResult,
  markRemoteRelationshipsEnrichedResult,
} from './services/sessions.js';
import { isAuthenticationUserLookup, isLocalAuthenticationLookup } from './services/users.js';
import { resolveWebTerminalCapability } from './terminal-capability.js';
import { buildSessionCreatedAnalyticsProperties } from './utils/analytics-payloads.js';
import {
  ensureMinimumRole,
  requireAdminForEnvConfig,
  requireMinimumRole,
} from './utils/authorization.js';
import {
  cacheBranchAccess,
  ensureBranchPermission,
  ensureCanCreateSession,
  ensureCanModifySchedule,
  ensureCanPromptInSession,
  ensureCanPromptTargetSession,
  ensureCanView,
  ensureSessionImmutability,
  loadBranch,
  loadBranchFromSession,
  loadScheduleAndBranch,
  loadSession,
  loadSessionBranch,
  protectGatewaySourceMetadata,
  resolveSessionContext,
  scopeFindToAccessibleBoardsSql,
  scopeFindToAccessibleBranchesSql,
  scopeFindToAccessibleSessionsSql,
  scopeReadToAccessibleBoardsSql,
  scopeScheduleQuery,
  setSessionUnixUsername,
  validateSessionUnixUsername,
} from './utils/branch-authorization.js';
import { captureBranchRemovalRealtimeVisibility as captureBranchRemovalVisibility } from './utils/branch-removal-realtime.js';
import { emitServiceEvent, publishCommittedServiceEvent } from './utils/emit-service-event.js';
import { bindPrimaryOwnerToCreatedBy, injectCreatedBy } from './utils/inject-created-by.js';
import {
  captureMarketplaceInvalidationTargets as captureMarketplaceTargets,
  publishCapturedMarketplaceInvalidation,
} from './utils/marketplace-invalidation.js';
import {
  redactMCPServerSecrets,
  shouldExposeMCPServerSecrets,
} from './utils/mcp-header-secrets.js';
import {
  redactMcpRecoveryTopology,
  stripMcpSlackRecoveryNotice,
  stripWidgetSlackConnectDelivery,
} from './utils/mcp-recovery-redaction.js';
import {
  didMcpPrincipalRoleChange,
  isMcpRuntimeRecoveryEnabled,
  scheduleMcpRuntimeHint,
} from './utils/mcp-runtime-hints.js';
import {
  createMcpServerWriteAuthorizationHook,
  resolveMcpCaller,
} from './utils/mcp-server-authorization.js';
import { realignRepoOriginAfterPatchHook } from './utils/realign-repo-origin.js';
import {
  bindRealtimeAccessCacheInvalidation,
  type RealtimeAccessBranchRepository,
  RealtimeAccessCache,
  type RealtimeAccessSessionRepository,
} from './utils/realtime-access-cache.js';
import {
  configureRealtimePublish,
  type RealtimeAccessBoardRepository,
  setBoardRemovalRealtimeVisibility,
} from './utils/realtime-publish.js';
import {
  resolveSandboxProtectedDataRoots,
  validateFilesystemHomeOverride,
} from './utils/sandbox-context.js';
import {
  ensureCurrentScheduleLoaded,
  ensureScheduleRunsAsCaller,
  recomputeNextRunAt,
  validateScheduleConfig,
} from './utils/schedule-hooks.js';
import { createSessionMcpTokenAfterHooks } from './utils/session-mcp-token-hook.js';
import { deferWithSessionQueueTenantScope } from './utils/session-queue-tenant-scope.js';
import {
  isTerminalQueueProcessingSuppressed,
  sessionCanStartTask,
} from './utils/session-task-state.js';
import { createTenantScopedAuthenticatedRouteRegistrar } from './utils/tenant-authenticated-route.js';
import {
  createTenantDatabaseScopeAroundHook,
  createTenantWriteAdmissionAroundHook,
  deferWithTenantContext,
  enforceTenantWriteGateForHook,
} from './utils/tenant-db-scope.js';
import { enforcePublicWriteFields, markWriteDataPrepared } from './utils/write-data-boundary.js';
import { protectExternalWidgetMessageWrites } from './widgets/message-boundary.js';

const DEBUG_MCP_TOKENS =
  process.env.AGOR_DEBUG_MCP_TOKENS === '1' || process.env.DEBUG?.includes('mcp-tokens');

function mcpTokenDebug(...args: unknown[]): void {
  if (DEBUG_MCP_TOKENS) {
    console.debug(...args);
  }
}

const BRANCH_ENV_FIELDS = [
  'start_command',
  'stop_command',
  'nuke_command',
  'logs_command',
  'health_check_url',
  'app_url',
] as const;

function itemHasAnyField(item: Record<string, unknown>, fields: readonly string[]): boolean {
  return fields.some((field) => Object.hasOwn(item, field));
}

export function shouldValidateRepoEnvironmentPayload(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function getManagedEnvExecutionMode(config: DeepReadonly<AgorConfig>) {
  return config.execution?.managed_envs_execution_mode ?? MANAGED_ENV_EXECUTION_MODE_DEFAULT;
}

function validateRepoEnvPolicyHook(config: DeepReadonly<AgorConfig>) {
  return async (context: HookContext) => {
    const mode = getManagedEnvExecutionMode(config);
    const items = Array.isArray(context.data) ? context.data : [context.data];

    for (const item of items as Array<Record<string, unknown>>) {
      if (
        Object.hasOwn(item, 'environment') &&
        shouldValidateRepoEnvironmentPayload(item.environment)
      ) {
        try {
          const env = validateRepoEnvironment(item.environment);
          validateRepoEnvironmentLifecyclePolicy(env, mode);
        } catch (error) {
          throw new BadRequest(error instanceof Error ? error.message : 'Invalid repo environment');
        }
      }

      if (
        Object.hasOwn(item, 'environment_config') &&
        shouldValidateRepoEnvironmentPayload(item.environment_config)
      ) {
        try {
          const env = wrapV1AsV2(item.environment_config as Parameters<typeof wrapV1AsV2>[0]);
          if (env) validateRepoEnvironmentLifecyclePolicy(env, mode, 'legacy repo environment');
        } catch (error)
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2941** (2026-10-01): **Onboarding completes without creating a teammate; board left with no primary teammate to assign**
  *Symptoms*: ## Problem  A user (Richard) completed the Agor Cloud onboarding wizard end-to-end, but no teammate was created as a result. Afterward, the board's **Teammate** sidebar tab shows:  > This board does not have a primary teammate yet. > Assign an existing teammate > Select a teammate > No existing teammates are available to assign.  So the board has no primary teammate, and there's nothing existing to assign either — onboarding silently produced no usable teammate, with no error surfaced to the user during the wizard.  ## Expected behavior  Completing onboarding should always leave the user with a working primary teammate on their board (either created successfully during the wizard, or a clear, actionable error during onboarding if creation failed) — not a silent gap discovered later in the Teammate tab.  ## Actual behavior  - Onboarding wizard ran through to completion with no visible error. - Board has no primary teammate assigned. - The "assign existing teammate" picker is empty, so the user has no self-serve way to recover — onboarding needs to be re-run or a teammate created manually (if even possible from this state).  ## Notes / related context  This looks like a distinct silent-failure path in the same "onboarding → first teammate creation" area as two related, already-closed issues: - #2916 — provisioning hard-fails with an unrecoverable "ambiguous git ref" error when the wizard doesn't expose a repo/ref picker - #2348 — onboarding starts teammate creation before the r

- **Issue #2939** (2026-10-01): **fix(ui): release detached tooltip target and popup owners**
  *Symptoms*: ## Narrow owner cleanup (related to #2757; does not close it)  This PR addresses confirmed **last detached-panel retention**, independently of the **default-OFF offscreen-folding prototype**. It does not modify reader folding/toggles, remove tooltips/accessibility, patch React internals, dispatch fake input, sweep DOM, or use production GC.  ### Evidence and scope  - Reproduced first against this branch's actual base `67c8e714e4cb6b21298ac85985358771184d2446`, not assumed unchanged from research base `122fe057`. Relevant tooltip dependency versions were unchanged; source/lock drift was recorded before implementation. Exact production stack: React/React DOM **19.3.0**, AntD **6.6.4**, Tooltip **1.5.2**, Trigger **3.10.1**, util **1.13.0** (existing util delay cleanup patch retained). - A tiny one-panel real AntD Button/Tooltip production fixture reproduces retention after **native keyboard Close-only**, with no later input before WeakRefs/fixture-only GC/postheap inspection. **Native mouse Close naturally collects on this current base**; the research mouse-positive observation was not reproduced here. - Prior research's raw retaining graph showed a 37,005-node subtree / 200 task blocks behind React's event scratch slot (`return_targetInst`, minified `xh`) -> deleted Fiber.ref -> util composition/useEvent -> Trigger render context/targetEle -> old Close button -> detached panel. Cutting that sole ingress in the offline graph, plus small-fixture event-replacement controls, suppl
  **Post-Mortem & Fix Analysis**:
  > ### Narrow CI compatibility repair: `0b117c30ba7ab87e959bc6fa8dd772ee1d08fc52`  Investigated failed [Build image run 36783770704 / job 110120144659](https://github.com/preset-io/agor/actions/runs/36783770704/job/110120144659), rather than rerunning blindly. The workflow executed from merge SHA `912550d2` (which includes [merged PR #2927](https://github.com/preset-io/agor/pull/2927)) but explicitly checked out frozen PR head `9c141ecb`. Production-source built and its daemon smoke was healthy; the new workflow's next `--target railway-preview` failed because that older head's Dockerfile lacked the stage. Base `67c8e714` and reviewed head's Dockerfile were identical: this was not a tooltip regression.  Imported **only the exact already-merged upstream Dockerfile**, also identical to current main's Dockerfile at inspected `ce9d64fc`. No checks/targets removed or weakened, no unrelated main integration. The full dependency-only preview stage preserves cold builds, warm-base reuse, manifest
  > Closing as this introduces very little memory savings at a high price of maintaining a patch file

- **Issue #2874** (2026-09-26): **Cross-branch (remote_create) session archive cascade still leaves subsessions behind**
  *Symptoms*: ### Summary  Archiving a session still doesn't reliably cascade-archive all of its subsessions in every case. This is a known, explicitly-documented gap in the current cascade implementation, not a new bug.  ### Background  This is the third report of the same underlying complaint: - #1747 (closed via #1842, 2026-07-09) — added cascade for the dedicated archive/unarchive route, covering same-branch `parent_session_id`/`forked_from_session_id` descendants only. - #2661 (closed via #2678, 2026-09-08) — extended cascade to bulk archive, branch archive, and BTW-completion cleanup, still scoped to **branch-local** genealogy only. - A broader alternative, #2671 ("route every archive path through one cascade engine"), would have additionally cascaded cross-branch `remote_create` relationships (i.e. sessions spawned/forked into a *different* branch/worktree) by default. That PR was closed unmerged in favor of the narrower #2678, and cross-branch cascade was explicitly punted:    > Out of scope / follow-ups: Cross-branch `remote_create` lifecycle ownership  ### Steps to reproduce  1. Create a session that spawns/forks a child session into a **different branch/worktree** (a `remote_create` relationship), or a gateway-linked child session. 2. Archive the parent session (or its branch). 3. Observe the cross-branch/gateway-linked child session(s) remain active — user has to manually archive each one.  ### Expected  Archiving a parent cascades to cross-branch/gateway-linked descendants too
  **Post-Mortem & Fix Analysis**:
  > I think I fixed that recently, problem seemed limited to foreign-branch child. Should be fixed. Reopen if not.

- **Issue #2810** (2026-09-23): **UI crash: unknown component — Cannot read properties of undefined (reading 'trim')**
  *Symptoms*: ## UI crash report  - **When:** 2026-09-22T11:33:08.542Z - **Where:** https://agor.sandbox.preset.zone/ui/s/01a0226137a67389bb7bde56/ - **Component:** unknown component - **User:** amin@preset.io - **Build:** 49e3d3da3 - **Browser:** Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 - **Error:** Cannot read properties of undefined (reading 'trim')  ### Component stack ``` at https://agor.sandbox.preset.zone/ui/assets/BoardObjectNodes-BePii1rI.js:10:2161     at div (<anonymous>)     at div (<anonymous>)     at div (<anonymous>)     at https://agor.sandbox.preset.zone/ui/assets/BoardObjectNodes-BePii1rI.js:29:15889     at div (<anonymous>)     at div (<anonymous>)     at https://agor.sandbox.preset.zone/ui/assets/SessionPanel-B9VcABg2.js:3:8833     at div (<anonymous>)     at f (https://agor.sandbox.preset.zone/ui/assets/react-resizable-panels-sTPFrjF4.js:1:851)     at div (<anonymous>)     at Be (https://agor.sandbox.preset.zone/ui/assets/react-resizable-panels-sTPFrjF4.js:1:16480)     at div (<anonymous>)     at Cn (https://agor.sandbox.preset.zone/ui/assets/SessionPanel-B9VcABg2.js:3:14197)     at https://agor.sandbox.preset.zone/ui/assets/SessionPanel-B9VcABg2.js:3:16540     at div (<anonymous>)     at div (<anonymous>)     at div (<anonymous>)     at https://agor.sandbox.preset.zone/ui/assets/SessionPanel-B9VcABg2.js:3:24237     at div (<anonymous>)     at div (<anonymous>)     at https://agor.sandbox.pres

- **Issue #2809** (2026-09-23): **UI crash: unknown component — Cannot read properties of undefined (reading 'trim')**
  *Symptoms*: ## UI crash report  - **When:** 2026-09-22T10:52:17.896Z - **Where:** https://agor.sandbox.preset.zone/ui/s/01a0c8bd320074779c69e888/ - **Component:** unknown component - **User:** amin@preset.io - **Build:** 49e3d3da3 - **Browser:** Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36 - **Error:** Cannot read properties of undefined (reading 'trim')  ### Component stack ``` at https://agor.sandbox.preset.zone/ui/assets/BoardObjectNodes-BePii1rI.js:10:2161     at div (<anonymous>)     at div (<anonymous>)     at div (<anonymous>)     at https://agor.sandbox.preset.zone/ui/assets/BoardObjectNodes-BePii1rI.js:29:15889     at div (<anonymous>)     at div (<anonymous>)     at https://agor.sandbox.preset.zone/ui/assets/SessionPanel-B9VcABg2.js:3:8833     at div (<anonymous>)     at f (https://agor.sandbox.preset.zone/ui/assets/react-resizable-panels-sTPFrjF4.js:1:851)     at div (<anonymous>)     at Be (https://agor.sandbox.preset.zone/ui/assets/react-resizable-panels-sTPFrjF4.js:1:16480)     at div (<anonymous>)     at Cn (https://agor.sandbox.preset.zone/ui/assets/SessionPanel-B9VcABg2.js:3:14197)     at https://agor.sandbox.preset.zone/ui/assets/SessionPanel-B9VcABg2.js:3:16540     at div (<anonymous>)     at div (<anonymous>)     at div (<anonymous>)     at https://agor.sandbox.preset.zone/ui/assets/SessionPanel-B9VcABg2.js:3:24237     at div (<anonymous>)     at div (<anonymous>)     at https://agor.sandbox.pres

- **Issue #2738** (2026-09-14): **Stop on a remote task whose executor has not connected fails instantly with a misleading 15 s quiescence timeout**
  *Symptoms*: ## Summary  On Agor Cloud (templated/remote executors), pressing Stop while the target task's executor pod has not connected yet immediately fails with:  > Remote executor did not acknowledge quiescence for this termination request within 15000ms. Agor could not verify that this executor stopped. It may still be running and writing to the branch. A branch owner or administrator may force-fail Task …  No wait actually happens, and the wording claims a 15 s timeout elapsed. The session is left guarded in `stopping` with a force-fail prompt for a pod that has not even started. Reliably reproducible when queued messages exist. Never seen in local mode.  ## Steps to reproduce  1. On an Agor Cloud workspace, start a prompt and queue one or more messages while it runs. 2. Press Stop. The active task stops and, because Stop preserves the queue, the next queued message is dispatched immediately as a new executor pod. 3. Press Stop again while that pod is still starting (task status `dispatching`). 4. Observe the immediate "did not acknowledge quiescence within 15000ms" notice and the force-fail offer.  Variant: queue messages while the very first pod is still starting, then press Stop once.  ## Root cause  - `waitForExecutorQuiescence` in the termination coordinator returns immediately when the task has no `executor_connected_at`. - The remote branch of `runContainment` then reports "within N ms" using the configured cooperative grace (15 s for templated executors) instead of the meas

- **Issue #2699** (2026-09-08): **Teammate session tree capped at 400px regardless of container height (regression from #2687)**
  *Symptoms*: ## Summary The session tree/list in the teammate panel (`BoardTeammatePanel`, rendered via `BranchSessionSections.tsx`, also shared by `BranchCard`) used to size to its container's full height. It now renders at a fixed **400px** regardless of the container's actual height or how many sessions there are — so on a taller viewport/panel, the list only fills part of the available space instead of the full height.  ## Regression source Introduced by [#2687](https://github.com/preset-io/agor/pull/2687) `fix: bound worktree session lists and correct MCP pagination` (merged 2026-09-07), which added:  ```ts // apps/agor-ui/src/components/BranchCard/branchCardLayout.ts export const BRANCH_SESSION_VIEWPORT_HEIGHT = 400; ```  used as a fixed `height` prop on the AntD `Tree` in `BranchSessionSections.tsx` (line ~986). Before this PR, the tree had no explicit `height`, so it sized naturally to its container. The 400px value was intentionally chosen as a shared viewport constant to bound virtualization/rendering cost (see the PR's investigation notes) — but it's a hardcoded pixel value, not derived from the actual available container height, so it under-fills taller panels.  Two follow-up PRs merged since ([#2692](https://github.com/preset-io/agor/pull/2692), [#2693](https://github.com/preset-io/agor/pull/2693)) adjusted zoom/wheel behavior around the same component but did not touch this constant.  ## Steps to reproduce 1. Open a teammate's panel/drawer (`BoardTeammatePanel`) on a board, 

- **Issue #2672** (2026-09-05): **Discord gateway channel save fails: "Missing tenant context for multi_tenancy.required_from_auth"**
  *Symptoms*: ## Summary  Creating/saving a Discord gateway bot channel on hosted Agor Cloud fails with:  ``` Save failed: Missing tenant context for multi_tenancy.required_from_auth ```  Reported by Richard (richard.fogaca@preset.io) via Slack #agor-cloud, 2026-09-04. Richard flagged that this might not be Discord-specific — worth checking Slack/Teams gateway channel creation too.  ## Source of the error  `resolveTenantContext` in [`packages/core/src/config/multitenancy.ts`](https://github.com/preset-io/agor/blob/main/packages/core/src/config/multitenancy.ts#L257) throws this exact string when it can't find a tenant candidate from the auth claim, trusted header, or `params`, in `required_from_auth` mode (hosted Cloud only — never reproducible locally in static single-tenant mode).  It's normally invoked as a before-hook (`ensureTenantContext`/`scopeTenantBefore` in `apps/agor-daemon/src/register-hooks.ts`) for services on `TENANT_OWNED_SERVICE_PATHS`. The gateway-channels write path (`apps/agor-daemon/src/services/gateway-channels.ts`) has its own `withTenantDatabase` helper that falls back to `getCurrentTenantId()` when `params.tenant.tenant_id` isn't set — so this looks like a code path where neither the hook nor the AsyncLocalStorage-based fallback has tenant context by the time a DB touch happens during Discord channel save (possibly the provider-probe/installation-verification step in `patchWithVerifiedDiscordInstallation`, which explicitly documents deferring provider calls to *afte

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

### Incident Patch 1: `ba19f73b` (2026-10-05)
**Commit Message**: fix(onboarding): recover repository bootstrap without deleting existing work (#2979)

* fix(onboarding): retry repository bootstrap without deleting existing work

* test(onboarding): align CI fixtures with in-place clone recovery

* fix(onboarding): preserve retry metadata and require workspace readiness

* fix(onboarding): preserve early progress and defer unconfigured AI turns

* fix(onboarding): clear stale template validation when skipping teammate

---------

Co-authored-by: Maxime Beauchemin <[REDACTED_EMAIL]>

**File**: `apps/agor-daemon/src/mcp/tools/repos.clone-retry.tenant-scope.test.ts` (modified, +34/-17)
```diff
@@ -24,10 +24,13 @@ vi.mock('../../services/session-token-service.js', () => ({
   issueExecutorCommandToken: vi.fn(async () => 'test-command-token'),
 }));
 
-dbTest('MCP replaces failed clones under a real guarded DB scope (#2643)', async ({ db }) => {
+dbTest('MCP retries failed clones in the guarded DB scope (#2643)', async ({ db }) => {
   executor.spawn.mockClear();
   executor.request.mockClear();
-  const guardedDb = createTenantScopedDatabaseProxy(db, { label: 'daemon database' });
+  const guardedDb = createTenantScopedDatabaseProxy(db, {
+    label: 'daemon database',
+    requireScope: true,
+  });
   const app = {
     get: () => ({ execution: { unix_user_mode: 'simple' } }),
     service: (name: string) => {
@@ -59,9 +62,10 @@ dbTest('MCP replaces failed clones under a real guarded DB scope (#2643)', async
     })
   );
 
-  // Same real custom service call as pre-#2612: identity alone is insufficient.
+  // The guarded repository still requires a DB scope; the service now opens it
+  // for direct callers as well as joining the MCP transport's unit of work.
   await expect(
-    runWithTenantContext('tenant-a', () => service.cloneRepository(args, params))
+    runWithTenantContext('tenant-a', () => repository.findBySlug(args.slug))
   ).rejects.toThrow(
     'Failed to find repo by slug: Missing tenant database scope for daemon database access'
   );
@@ -80,37 +84,50 @@ dbTest('MCP replaces failed clones under a real guarded DB scope (#2643)', async
   if (!handler) throw new Error('Missing create-remote tool');
   const invoke = handler;
 
-  // Conflicting trusted identity cannot switch to tenant A and remove its tombstone.
+  // Neither entry point may switch from conflicting trusted identity to tenant A.
+  await expect(
+    runWithTenantContext('tenant-b', () => service.cloneRepository(args, params))
+  ).rejects.toThrow();
   await expect(runWithTenantContext('tenant-b', () => invoke(args))).rejects.toThrow();
   expect(await inScope(() => repository.findById(failed.repo_id))).toEqual(failed);
   expect(executor.spawn).not.toHaveBeenCalled();
 
-  let previousId = failed.repo_id;
-  for (let attempt = 0; attempt < 2; attempt++) {
+  for (let attempt = 1; attempt <= 2; attempt++) {
     const result = await runWithTenantContext('tenant-a', () => invoke(args));
     const pending = JSON.parse(result.content[0].text) as { status: string; repo_id: string };
     expect(pending.status).toBe('pending');
     expect(getCurrentTenantDatabaseScope()).toBeUndefined();
-    expect(pending.repo_id).not.toBe(previousId);
-    expect(await inScope(() => repository.findById(previousId))).toBeNull();
-    const replacement = await inScope(() => repository.findBySlug(args.slug));
-    expect(replacement).toMatchObject({ repo_id: pending.repo_id, clone_status: 'cloning' });
-    expect(replacement?.clone_error).toBeUndefined();
+    expect(pending.repo_id).toBe(failed.repo_id);
+    const retried = await inScope(() => repository.findBySlug(args.slug));
+    expect(retried).toMatchObject({
+      repo_id: failed.repo_id,
+      local_path: failed.local_path,
+      clone_status: 'cloning',
+      clone_generation: attempt,
+    });
+    expect(retried?.clone_error).toBeUndefined();
     // An in-flight clone must not be removed or launched a second time.
     const existing = await invoke(args);
     expect(JSON.parse(existing.content[0].text)).toMatchObject({
       status: 'exists',
       repo_id: pending.repo_id,
     });
-    if (!replacement) throw new Error('Missing replacement clone');
-    previousId = replacement.repo_id;
-    await inScope(() => repository.update(previousId, { clone_status: 'failed' }));
+    await expect(service.cloneRepository(args, params)).resolves.toMatchObject({
+      status: 'exists',
+      repo_id: failed.repo_id,
+    });
+    expect(executor.spawn).toHaveBeenCalledTimes(attempt);
+    await inScope(() =>
+      repository.update(failed.repo_id, {
+        clone_status: attempt === 1 ? 'failed' : 'ready',
+        clone_generation: attempt,
+      })
+    );
   }
-  await inScope(() => repository.update(previousId, { clone_status: 'ready' }));
   const ready = await invoke(args);
   expect(JSON.parse(ready.content[0].text)).toMatchObject({
     status: 'exists',
-    repo_id: previousId,
+    repo_id: failed.repo_id,
   });
   expect(executor.spawn).toHaveBeenCalledTimes(2);
   // Even a caller's cleanup=true must not turn retry into filesystem deletion.
```

**File**: `apps/agor-daemon/src/mcp/tools/repos.ts` (modified, +4/-6)
```diff
@@ -95,7 +95,7 @@ export function registerRepoTools(server: McpServer, ctx: McpContext): void {
         'clone will fail with `clone_error.category: "auth_failed"`. If it is missing, PREFER calling ' +
         "`agor_widgets_request_env_vars({ names: ['GITHUB_TOKEN'], reason: ... })` to collect it inline " +
         'over pointing the user at Settings → Env Vars, then retry. Retrying after a failed clone is ' +
-        'supported — the previous failed row is replaced.',
+        'supported in place — the repository ID, configuration, and existing branches are preserved.',
       inputSchema: z.object({
         url: mcpRequiredString(
           'url',
@@ -135,11 +135,9 @@ export function registerRepoTools(server: McpServer, ctx: McpContext): void {
       const name = coerceString(args.name);
       const defaultBranch = coerceString(args.default_branch);
       const reposService = ctx.app.service('repos') as unknown as ReposServiceImpl;
-      // `cloneRepository` is a custom (non-transport) service method, so this
-      // direct call bypasses the around hooks that enter the tenant database
-      // scope for HTTP callers. Re-enter it here so its `this.db` reads/writes
-      // join one short tenant unit — the executor clone itself is fire-and-forget
-      // and runs outside this scope. See mcp/tenant-scope.ts.
+      // Keep MCP's trusted identity/write gate at the transport boundary. The
+      // service joins this short tenant unit (or opens its own for direct
+      // callers); the executor is dispatched only after it commits.
       const result = await runWithMcpTenantDatabaseWrite(ctx, () =>
         reposService.cloneRepository(
           { url, slug, name, ...(defaultBranch ? { default_branch: defaultBranch } : {}) },
```

**File**: `apps/agor-daemon/src/services/hosted-repo-policy.test.ts` (modified, +34/-8)
```diff
@@ -1,9 +1,14 @@
 import { BoardRepository, BranchRepository } from '@agor/core/db';
-import type { Application, Branch, Repo } from '@agor/core/types';
+import type { Application } from '@agor/core/feathers';
+import type { BoardID, Branch, Repo, TenantID, UserID } from '@agor/core/types';
 import { beforeEach, describe, expect, it, vi } from 'vitest';
 import { DrizzleService } from '../adapters/drizzle';
+import {
+  EXECUTOR_COMMAND_TOKEN_PURPOSE,
+  EXECUTOR_SESSION_TOKEN_TYPE,
+} from '../auth/executor-session-token';
 import { BranchesService } from './branches';
-import { ReposService } from './repos';
+import { type RepoParams, ReposService } from './repos';
 
 vi.mock('@agor/core/config', async (importOriginal) => {
   const actual = await importOriginal<typeof import('@agor/core/config')>();
@@ -26,7 +31,7 @@ describe('hosted repository storage policy canonical boundaries', () => {
 
     await expect(
       service.create({
-        board_id: '550e8400-e29b-41d4-a716-446655440000',
+        board_id: '550e8400-e29b-41d4-a716-446655440000' as BoardID,
         storage_mode: 'worktree',
       } as Partial<Branch>)
     ).rejects.toThrow(/worktree.*unavailable in hosted multi-tenant mode/);
@@ -62,7 +67,7 @@ describe('hosted repository storage policy canonical boundaries', () => {
 
     await expect(
       service.create({
-        board_id: '550e8400-e29b-41d4-a716-446655440000',
+        board_id: '550e8400-e29b-41d4-a716-446655440000' as BoardID,
         name: 'onboarding-teammate',
       })
     ).resolves.toMatchObject({ storage_mode: 'clone' });
@@ -130,11 +135,15 @@ describe('hosted repository storage policy canonical boundaries', () => {
   });
 
   describe('tenant filesystem confinement', () => {
-    const attackerParams = {
+    const attackerParams: RepoParams = {
       provider: 'rest',
-      user: { user_id: '550e8400-e29b-41d4-a716-446655440004', role: 'member' },
-      tenant: { tenant_id: 'attacker' },
-    } as never;
+      user: {
+        user_id: '550e8400-e29b-41d4-a716-446655440004' as UserID,
+        role: 'member',
+        email: 'synthetic@example.invalid',
+      },
+      tenant: { tenant_id: 'attacker' as TenantID, source: 'auth_claim' },
+    };
     const victimRepo = '/home/agor/.agor/tenants/victim/repos/acme/private-source';
     const victimCheckout = '/home/agor/.agor/tenants/victim/worktrees/acme/private-source/main';
 
@@ -239,6 +248,23 @@ describe('hosted repository storage policy canonical boundaries', () => {
 
       await expect(
         service.patch('repo-1', { local_path: localPath, clone_status: 'cloning' }, attackerParams)
+      ).rejects.toThrow(/setup status is managed by the Git executor/);
+      await expect(
+        service.patch(
+          'repo-1',
+          { local_path: localPath, clone_status: 'cloning' },
+          {
+            ...attackerParams,
+            authentication: {
+              strategy: 'jwt',
+              payload: {
+                type: EXECUTOR_SESSION_TOKEN_TYPE,
+                purpose: EXECUTOR_COMMAND_TOKEN_PURPOSE,
+                session_id: 'git.clone',
+              },
+            },
+          }
+        )
       ).resolves.toBe(patched);
     });
   });
```

**File**: `apps/agor-daemon/src/services/repos-bootstrap.integration.test.ts` (added, +169/-0)
```diff
@@ -0,0 +1,169 @@
+import {
+  BranchRepository,
+  createTenantScopedDatabaseProxy,
+  generateId,
+  RepoRepository,
+  runWithTenantContext,
+  runWithTenantDatabaseScope,
+  runWithTenantDatabaseTransaction,
+} from '@agor/core/db';
+import type { Application } from '@agor/core/feathers';
+import type { AuthenticatedParams, UUID } from '@agor/core/types';
+import { beforeEach, describe, expect, vi } from 'vitest';
+import { ownedDbTest as dbTest } from '../../../../packages/core/src/db/test-helpers';
+import { type RepoParams, ReposService } from './repos';
+
+const mocks = vi.hoisted(() => ({ spawn: vi.fn() }));
+vi.mock('../utils/spawn-executor.js', async (original) => ({
+  ...(await original<typeof import('../utils/spawn-executor.js')>()),
+  spawnExecutorFireAndForget: mocks.spawn,
+}));
+const request = {
+  url: 'https://example.invalid/synthetic/framework.git',
+  slug: 'synthetic/framework',
+  default_branch: 'main',
+};
+const params = {
+  tenant: { tenant_id: 'tenant-a', source: 'explicit' },
+  user: { user_id: '550e8400-e29b-41d4-a716-446655440004', role: 'member' },
+} as AuthenticatedParams as RepoParams;
+
+function setup(db: Parameters<typeof createTenantScopedDatabaseProxy>[0]) {
+  const scoped = createTenantScopedDatabaseProxy(db, { requireScope: true });
+  const generateCommandToken = vi.fn(async () => 'synthetic-command-token');
+  const emit = vi.fn();
+  const app = {
+    get: () => ({ execution: { unix_user_mode: 'simple' } }),
+    sessionTokenService: { generateCommandToken },
+    settings: { authentication: { secret: 'synthetic-only' } },
+    service: (name: string) => {
+      if (name === 'repos') return service;
+      throw new Error(`Unexpected service ${name}`);
+    },
+  } as unknown as Application;
+  const service = new ReposService(scoped, app);
+  service.emit = emit;
+  return { service, scoped, emit, generateCommandToken };
+}
+
+beforeEach(() => mocks.spawn.mockReset());
+describe('repository bootstrap (real SQLite, guarded tenant scope)', () => {
+  dbTest(
+    'fresh concurrent onboarding launches once; another user joins shared metadata',
+    async ({ db }) => {
+      const { service, emit } = setup(db);
+      const calls = await Promise.all([
+        service.cloneRepository(request, params),
+        service.cloneRepository(request, params),
+      ]);
+      expect(calls.map((r) => r.status).sort()).toEqual(['exists', 'pending']);
+      expect(calls[0].repo_id).toBe(calls[1].repo_id);
+      expect(mocks.spawn).toHaveBeenCalledTimes(1);
+      expect(emit.mock.calls.map((c) => c[0])).toEqual(['created']);
+      const otherUser = {
+        ...params,
+        user: { ...params.user!, user_id: generateId() },
+      } as RepoParams;
+      await expect(service.cloneRepository(request, otherUser)).resolves.toMatchObject({
+        status: 'exists',
+        repo_id: calls[0].repo_id,
+      });
+      expect(mocks.spawn).toHaveBeenCalledTimes(1);
+      expect(mocks.spawn.mock.calls[0][0].params).toMatchObject({
+        userId: params.user!.user_id,
+        cloneGeneration: 1,
+        importEnvironmentConfig: false,
+      });
+    }
+  );
+
+  dbTest(
+    'failed clone with existing branches retries same row; stale exit cannot fail retry',
+    async ({ db }) => {
+      const { service, scoped } = setup(db);
+      const admin = { ...params, user: { ...params.user!, role: 'admin' } } as RepoParams;
+      const first = await service.cloneRepository(request, admin);
+      expect(mocks.spawn.mock.calls[0][0].params.importEnvironmentConfig).toBe(true);
+      const oldExit = mocks.spawn.mock.calls[0][1].onExit;
+      await runWithTenantDatabaseScope(scoped, 'tenant-a', async () => {
+        await service.patch(first.repo_id!, { clone_status: 'failed', clone_generation: 1 });
+        await new BranchRepository(scoped).create({
+          repo_id: first.repo_id as UUID,
+          created_by: 'test-user' as UUID,
+          name: 'existing-work',
+          ref: 'main',
+          path: '/tmp/synthetic/work',
+          branch_unique_id: 4567,
+        });
+      });
+      const retry = await service.cloneRepository(request, { ...admin, query: { cleanup: true } });
+      expect(retry).toEqual(first);
+      expect(mocks.spawn).toHaveBeenCalledTimes(2);
+      expect(mocks.spawn.mock.calls[1][0].params.cloneGeneration).toBe(2);
+      expect(mocks.spawn.mock.calls[1][0].params.importEnvironmentConfig).toBe(false);
+      await oldExit(1);
+      await runWithTenantDatabaseScope(scoped, 'tenant-a', async () => {
+        expect(await service.get(first.repo_id!)).toMatchObject({
+          clone_status: 'cloning',
+          clone_generation: 2,
+        });
+        expect(
+          await new BranchRepository(scoped).findAllByRepoId(first.repo_id as UUID)
+        ).toHaveLength(1);
+        expect(await new RepoRepository(scoped).count()).toBe(1);
+      });
+    }
+  );
+
+  dbTest(
+    'dispatch happens after commit, never on rollback
```

**File**: `apps/agor-daemon/src/services/repos-bootstrap.postgres.test.ts` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+import {
+  createDatabase,
+  createTenantScopedDatabaseProxy,
+  type Database,
+  generateId,
+  initializeDatabase,
+  RepoRepository,
+  runWithTenantDatabaseScope,
+} from '@agor/core/db';
+import type { Repo, TenantID } from '@agor/core/types';
+import { afterAll, beforeAll, describe, expect, it } from 'vitest';
+
+const url = process.env.AGOR_TEST_POSTGRES_URL;
+describe.skipIf(!url || process.env.AGOR_DB_DIALECT !== 'postgresql')(
+  'clone claims across replicas and RLS tenants',
+  () => {
+    let dbA: Database;
+    let dbB: Database;
+    beforeAll(async () => {
+      dbA = createDatabase({ dialect: 'postgresql', url: url! });
+      dbB = createDatabase({ dialect: 'postgresql', url: url! });
+      await initializeDatabase(dbA);
+    });
+    afterAll(async () => {
+      await Promise.all(
+        [dbA, dbB].map((db) =>
+          (db as Database & { $client: { end: () => Promise<void> } }).$client.end()
+        )
+      );
+    });
+    it('one first-run/retry claim wins; tenant B cannot read or complete A even with its ID/generation', async () => {
+      const tenantA = `bootstrap-a-${generateId()}` as TenantID;
+      const tenantB = `bootstrap-b-${generateId()}` as TenantID;
+      const a = createTenantScopedDatabaseProxy(dbA, { requireScope: true });
+      const b = createTenantScopedDatabaseProxy(dbB, { requireScope: true });
+      const data: Partial<Repo> = {
+        slug: 'synthetic/shared-slug',
+        repo_type: 'remote',
+        remote_url: 'https://example.invalid/synthetic/shared.git',
+        local_path: '/tmp/synthetic/a',
+        default_branch: 'main',
+      };
+      const claims = await Promise.all(
+        [a, b].map((db) =>
+          runWithTenantDatabaseScope(db, tenantA, () => new RepoRepository(db).claimClone(data))
+        )
+      );
+      expect(claims.filter((c) => c.acquired)).toHaveLength(1);
+      expect(claims[0].repo.repo_id).toBe(claims[1].repo.repo_id);
+      const first = claims[0].repo;
+      await runWithTenantDatabaseScope(a, tenantA, () =>
+        new RepoRepository(a).update(first.repo_id, {
+          clone_status: 'failed',
+          clone_generation: first.clone_generation,
+        })
+      );
+      const retries = await Promise.all(
+        [a, b].map((db) =>
+          runWithTenantDatabaseScope(db, tenantA, () => new RepoRepository(db).claimClone(data))
+        )
+      );
+      expect(retries.filter((c) => c.acquired)).toHaveLength(1);
+      expect(retries[0].repo).toMatchObject({ repo_id: first.repo_id, clone_generation: 2 });
+      await runWithTenantDatabaseScope(b, tenantB, async () => {
+        const repository = new RepoRepository(b);
+        expect(await repository.findById(first.repo_id)).toBeNull();
+        await expect(
+          repository.update(first.repo_id, { clone_status: 'ready', clone_generation: 2 })
+        ).rejects.toThrow();
+        const own = await repository.claimClone({ ...data, local_path: '/tmp/synthetic/b' });
+        expect(own.acquired).toBe(true);
+        expect(own.repo.repo_id).not.toBe(first.repo_id);
+      });
+      await runWithTenantDatabaseScope(a, tenantA, async () => {
+        expect(await new RepoRepository(a).findById(first.repo_id)).toMatchObject({
+          clone_status: 'cloning',
+          clone_generation: 2,
+          local_path: '/tmp/synthetic/a',
+        });
+      });
+    });
+  }
+);
```

**File**: `apps/agor-daemon/src/services/repos.test.ts` (modified, +21/-13)
```diff
@@ -42,6 +42,7 @@ vi.mock('@agor/core/config', async (importOriginal) => {
 
 const repositoryMocks = vi.hoisted(() => ({
   deleteRepo: vi.fn(),
+  claimClone: vi.fn(),
   findAllBranchesByRepoId: vi.fn(),
   lockRepoForBranchInventory: vi.fn(),
   resolveBranchUserAccess: vi.fn(),
@@ -90,6 +91,7 @@ vi.mock('@agor/core/db', async (importOriginal) => {
     RepoRepository: vi.fn().mockImplementation(function RepoRepository() {
       return {
         create: vi.fn(),
+        claimClone: repositoryMocks.claimClone,
         findById: vi.fn(),
         findAll: vi.fn(async () => []),
         update: vi.fn(),
@@ -668,6 +670,19 @@ describe('ReposService.createBranch Git lifecycle execution', () => {
 });
 
 describe('ReposService.cloneRepository Git lifecycle execution', () => {
+  beforeEach(() => {
+    repositoryMocks.claimClone.mockReset().mockImplementation(async (data) => ({
+      repo: {
+        ...data,
+        repo_id: '550e8400-e29b-41d4-a716-446655440001',
+        clone_status: 'cloning',
+        clone_generation: 1,
+      },
+      acquired: true,
+      created: true,
+    }));
+  });
+
   it('creates managed storage without delegated user routing', async () => {
     executorMocks.spawnExecutorFireAndForget.mockClear();
 
@@ -684,13 +699,9 @@ describe('ReposService.cloneRepository Git lifecycle execution', () => {
       }),
     } as unknown as Application;
     const service = new ReposService({} as never, app);
-    vi.spyOn(service, 'create').mockResolvedValue({
-      repo_id: '550e8400-e29b-41d4-a716-446655440001',
-      slug: 'preset-io/agor-teammate',
-    } as never);
 
     await service.cloneRepository({ url: 'https://github.com/preset-io/agor-teammate.git' }, {
-      user: { user_id: '550e8400-e29b-41d4-a716-446655440004' },
+      user: { user_id: '550e8400-e29b-41d4-a716-446655440004', role: 'member' },
     } as never);
 
     expect(executorMocks.spawnExecutorFireAndForget).toHaveBeenCalledWith(
@@ -716,10 +727,6 @@ describe('ReposService.cloneRepository Git lifecycle execution', () => {
       }),
     } as unknown as Application;
     const service = new ReposService({} as never, app);
-    vi.spyOn(service, 'create').mockResolvedValue({
-      repo_id: '550e8400-e29b-41d4-a716-446655440001',
-      slug: 'preset-io/agor-admin-clone',
-    } as never);
 
     await service.cloneRepository({ url: 'https://github.com/preset-io/agor-admin-clone.git' }, {
       provider: 'rest',
@@ -740,11 +747,12 @@ describe('ReposService.cloneRepository Git lifecycle execution', () => {
 
   it('persists clone-exit failure in a fresh write-gated tenant unit', async () => {
     executorMocks.spawnExecutorFireAndForget.mockClear();
-    const db = { marker: 'base-db' };
+    const db = { marker: 'base-db', run: vi.fn() };
     const current = {
       repo_id: '550e8400-e29b-41d4-a716-446655440001',
       slug: 'preset-io/agor-failed-clone',
       clone_status: 'cloning',
+      clone_generation: 1,
     };
     const repos = {
       get: vi.fn(async () => current),
@@ -762,11 +770,10 @@ describe('ReposService.cloneRepository Git lifecycle execution', () => {
       }),
     } as unknown as Application;
     const service = new ReposService(db as never, app);
-    vi.spyOn(service, 'create').mockResolvedValue(current as never);
 
     await service.cloneRepository({ url: 'https://github.com/preset-io/agor-failed-clone.git' }, {
       tenant: { tenant_id: 'tenant-a', source: 'explicit' },
-      user: { user_id: '550e8400-e29b-41d4-a716-446655440004' },
+      user: { user_id: '550e8400-e29b-41d4-a716-446655440004', role: 'member' },
     } as never);
     const spawnOptions = executorMocks.spawnExecutorFireAndForget.mock.calls.at(-1)?.[1] as
       | { onExit?: (code: number | null) => Promise<void> | void }
@@ -782,10 +789,11 @@ describe('ReposService.cloneRepository Git lifecycle execution', () => {
     expect(repos.get).toHaveBeenCalledWith(current.repo_id);
     expect(repos.patch).toHaveBeenCalledWith(current.repo_id, {
       clone_status: 'failed',
+      clone_generation: 1,
       clone_error: {
         exit_code: 17,
         category: 'unknown',
-        message: 'Clone exited with code 17 before reporting an error.',
+        message: 'Repository setup worker exited (17) before reporting an outcome.',
       },
     });
   });
```

**File**: `apps/agor-daemon/src/services/repos.ts` (modified, +142/-227)
```diff
@@ -75,8 +75,8 @@ import {
   validateRepoCleanupPolicy,
 } from '@agor/core/types';
 import { DrizzleService } from '../adapters/drizzle';
+import { authenticatedExecutorCommandRuntimeScope } from '../auth/executor-runtime-scope.js';
 import type { BranchesServiceImpl } from '../declarations.js';
-import { emitHaNativeSocketEvent, tenantChannelName } from '../realtime/routing.js';
 import { ensureCanControlBranchEnvironment } from '../utils/branch-authorization.js';
 import { resolveBranchExecutorSandboxMounts } from '../utils/branch-executor-sandbox.js';
 import { ensureBranchWorkspaceAccess } from '../utils/branch-workspace-path.js';
@@ -112,9 +112,9 @@ export type RepoParams = QueryParams<{
 function sanitizeProvisioningError(error: unknown): string {
   const raw = error instanceof Error ? error.message : String(error);
   try {
-    return redactGitUrlCredentials(raw);
+    return redactGitUrlCredentials(raw).slice(0, 2000);
   } catch {
-    return raw;
+    return 'Provisioning failed; inspect executor logs.';
   }
 }
 
@@ -203,7 +203,10 @@ export class ReposService extends DrizzleService<Repo, Partial<Repo>, RepoParams
     params?: RepoParams
   ): Promise<Repo | Repo[]> {
     const rows = Array.isArray(data) ? data : [data];
-    for (const row of rows) this.validateCleanupPolicyWrite(row, params);
+    for (const row of rows) {
+      this.validateCleanupPolicyWrite(row, params);
+      this.validateCloneLifecycleWrite(row, params);
+    }
     if (this.isHostedMultiTenancy()) {
       if (rows.some((row) => row.repo_type === 'local')) {
         throw new BadRequest(
@@ -228,12 +231,14 @@ export class ReposService extends DrizzleService<Repo, Partial<Repo>, RepoParams
     params?: RepoParams
   ): Promise<Repo | Repo[]> {
     this.validateCleanupPolicyWrite(data, params);
+    this.validateCloneLifecycleWrite(data, params);
     await this.validateRepoLocationWrite(id, data, params);
     return super.patch(id, data, params);
   }
 
   override async update(id: string, data: Partial<Repo>, params?: RepoParams): Promise<Repo> {
     this.validateCleanupPolicyWrite(data, params);
+    this.validateCloneLifecycleWrite(data, params);
     await this.validateRepoLocationWrite(id, data, params);
     return super.update(id, data, params);
   }
@@ -272,6 +277,19 @@ export class ReposService extends DrizzleService<Repo, Partial<Repo>, RepoParams
     }
   }
 
+  private validateCloneLifecycleWrite(data: Partial<Repo>, params?: RepoParams): void {
+    if (!params?.provider) return; // Trusted claim / exit reconciliation is internal.
+    if (
+      !['clone_status', 'clone_generation', 'clone_error'].some((key) => Object.hasOwn(data, key))
+    )
+      return;
+    if (authenticatedExecutorCommandRuntimeScope(params)?.commandId !== 'git.clone') {
+      throw new Forbidden(
+        'Repository setup status is managed by the Git executor. Use repository setup to retry.'
+      );
+    }
+  }
+
   private isHostedMultiTenancy(): boolean {
     return resolveMultiTenancyConfig(this.app.get('config')).mode === 'required_from_auth';
   }
@@ -323,247 +341,144 @@ export class ReposService extends DrizzleService<Repo, Partial<Repo>, RepoParams
   }
 
   /**
-   * Custom method: Clone repository (fire-and-forget)
-   *
-   * The DB row is created EARLY (here) with `clone_status: 'cloning'` so
-   * MCP / UI callers can discover the outcome via `agor_repos_get(repoId)`
-   * even when the clone fails — fixes #1126's "silent pending forever"
-   * symptom. The executor then handles:
-   * - Git clone
-   * - Parse .agor.yml
-   * - Patch the existing row to `'ready'` (with parsed env, default branch)
-   *   or `'failed'` (with categorized clone_error)
-   *
-   * Returns immediately with `{ status: 'pending', slug, repo_id }`.
-   * Clients see a `repos.created` event for the placeholder row, then a
-   * `repos.patched` event when the clone finishes.
-   *
-   * Slug-collision policy: a previous `clone_status: 'failed'` row is
-   * deleted to allow seamless retry; any other state surfaces `'exists'`.
+   * Register / retry a managed clone. A retry retains the repo and all branches.
+   * Claims are atomic across daemon replicas; executors start only after commit.
+   * `exists` is registration, not proof of caller remote access or filesystem readiness.
    */
   async cloneRepository(
     data: { url: string; slug?: string; name?: string; default_branch?: string },
     params?: RepoParams
   ): Promise<CloneRepositoryResult> {
-    const remoteUrl = stripGitUrlCredentials(data.url);
-    if (remoteUrl !== data.url) {
-      console.warn(
-        `[repos.clone] Stripped credentials from submitted remote URL: ${redactGitUrlCredentials(data.url)}`
-      );
-    }
-
-    // Note: `||` (not `??`) is intentional — we want an empty `data.slug`
-    // to fall through to derivation rather than be treated as "explicit".
-    let slug = data.slug || data.name;
-    if (!slug) {
-      // Normalize URL (strip t
```

**File**: `apps/agor-daemon/src/utils/tenant-service-classification.ts` (modified, +4/-1)
```diff
@@ -158,6 +158,10 @@ export const TENANT_SERVICE_CLASSIFICATIONS: Record<string, TenantServiceClassif
   // --------------------------------------------------------------------------
   // Catalog connect. Probes a remote endpoint before writing anything.
   // --------------------------------------------------------------------------
+  'repos/clone': {
+    scopeClass: 'scoped',
+    why: 'Authenticated tenant-scoped route; atomic clone claim and commit-bound executor dispatch.',
+  },
   'mcp-catalog/connect': {
     scopeClass: 'identity-only',
     why: 'Probes the entry endpoint over the network before installing; every write goes through a service that opens its own unit.',
@@ -304,7 +308,6 @@ export const UNCLASSIFIED_SERVICE_BASELINE: readonly string[] = [
   'board-comments/:id/toggle-reaction', // BASELINE-ENTRY
   'board-comments/:id/reposition', // BASELINE-ENTRY
   'repos/local', // BASELINE-ENTRY
-  'repos/clone', // BASELINE-ENTRY
   'repos/:id/branches', // BASELINE-ENTRY
   'repos/:id/branches/:name', // BASELINE-ENTRY
   'repos/:id/export-agor-yml', // BASELINE-ENTRY
```

---

### Incident Patch 2: `8ef04093` (2026-10-05)
**Commit Message**: fix(gemini): keep task temp on launcher scratch; document MCP timeout (#2960)

* fix(gemini): keep task temp on launcher scratch; document MCP timeout

Gemini pointed TMPDIR at <SDK home>/.gemini/agor-task-tmp. When the home is a
persistent network volume shared by pod-per-turn executors, a killed pod's temp
directory can never be reclaimed because stale cleanup only trusts the same PID
namespace. When a delegated launcher sets AGOR_EXECUTOR_SCRATCH_ROOT, task temp
now lives under <scratch>/gemini-task-tmp; a non-absolute or blank value fails
the task closed, and the variable is deny-listed from prompt payload env.

The SDK's single MCP timeout also bounds every tool call and Agor's own tools
can wait five minutes, so it stays at the default; code and docs now say so.
Also fixes a malformed code fence that rendered part of config-yaml.mdx as code.

* fix(executor): exclude user scratch settings from local launches

**File**: `apps/agor-daemon/src/branch-sdk-home.test.ts` (modified, +6/-1)
```diff
@@ -252,7 +252,12 @@ describe('Gemini execution-home projection', () => {
       await close();
     `,
         ],
-        { cwd: process.cwd(), env: { ...process.env, ...env }, encoding: 'utf8', timeout: 30000 }
+        {
+          cwd: process.cwd(),
+          env: { ...process.env, AGOR_EXECUTOR_SCRATCH_ROOT: undefined, ...env },
+          encoding: 'utf8',
+          timeout: 30000,
+        }
       );
       rmSync(executionHome, { recursive: true, force: true });
       rmSync(branchHome, { recursive: true, force: true });
```

**File**: `apps/agor-daemon/src/utils/spawn-executor.configured.test.ts` (modified, +52/-0)
```diff
@@ -3,7 +3,9 @@ import { lstatSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync }
 import { tmpdir } from 'node:os';
 import path from 'node:path';
 import { Writable } from 'node:stream';
+import { encryptApiKey, eq, UsersRepository, update, users } from '@agor/core/db';
 import { beforeEach, describe, expect, it, vi } from 'vitest';
+import { dbTest } from '../../../../packages/core/src/db/test-helpers';
 
 const {
   buildSandboxWrapMock,
@@ -701,6 +703,56 @@ describe('configured executor spawning', () => {
     expect(vi.mocked(console.error).mock.calls.flat().join(' ')).not.toContain(secret);
   });
 
+  for (const { option, scratch } of [
+    { option: 'preparedEnv', scratch: '/synthetic/user/scratch' },
+    { option: 'env', scratch: 'relative/scratch' },
+  ] as const) {
+    dbTest(
+      `excludes stored user scratch from the local ${option} while preserving other settings`,
+      async ({ db }) => {
+        const user = await new UsersRepository(db).create({
+          email: 'scratch-regression@example.com',
+          name: 'Scratch regression',
+        });
+        await update(db, users)
+          .set({
+            data: {
+              env_vars: {
+                AGOR_EXECUTOR_SCRATCH_ROOT: {
+                  value_encrypted: encryptApiKey(scratch),
+                  scope: 'global',
+                },
+                SYNTHETIC_SESSION_SETTING: {
+                  value_encrypted: encryptApiKey('ordinary-session-value'),
+                  scope: 'global',
+                },
+              },
+            },
+          })
+          .where(eq(users.user_id, user.user_id))
+          .run();
+        const { createUserProcessEnvironment } = await import('@agor/core/config');
+        const sessionEnv = await createUserProcessEnvironment(user.user_id, db);
+        expect(sessionEnv.AGOR_EXECUTOR_SCRATCH_ROOT).toBe(scratch);
+        const installed = installMockExecutor('agor-executor-user-scratch-');
+        try {
+          const { spawnExecutor } = await import('./spawn-executor');
+          spawnExecutor({ command: 'prompt', env: sessionEnv }, { [option]: sessionEnv });
+
+          expect(spawnMock).toHaveBeenCalledOnce();
+          const spawnOptions = spawnMock.mock.calls[0][2] as {
+            env: Record<string, string>;
+          };
+          expect(spawnOptions.env.AGOR_EXECUTOR_SCRATCH_ROOT).toBeUndefined();
+          expect(spawnOptions.env.SYNTHETIC_SESSION_SETTING).toBe('ordinary-session-value');
+          expect(sessionEnv.AGOR_EXECUTOR_SCRATCH_ROOT).toBe(scratch);
+        } finally {
+          installed.restore();
+        }
+      }
+    );
+  }
+
   it('launches a local executor from its operator-owned package directory, not payload cwd', async () => {
     const proc = createMockProcess();
     spawnMock.mockReturnValue(proc);
```

**File**: `apps/agor-daemon/src/utils/spawn-executor.ts` (modified, +6/-1)
```diff
@@ -32,6 +32,7 @@ import {
 import {
   type AgorExecutionSettings,
   buildAllowlistedEnv,
+  EXECUTOR_SCRATCH_ROOT_ENV,
   type ResolvedExecutorResponseConfig,
   resolveExecutorResponseConfig,
   resolveExecutorResponseTimeoutMs,
@@ -825,7 +826,11 @@ function resolveLocalExecutorEnvironment(
   // host runtime, never the daemon's entire credential-bearing process.env.
   const env = options.env ?? buildAllowlistedEnv();
   const source = options.preparedEnv ?? env;
-  return withDaemonExecutorEnv(source, getDaemonUrl());
+  const executorEnv = withDaemonExecutorEnv(source, getDaemonUrl());
+  // Local process env already contains user settings before payload filtering.
+  // Only a delegated launcher may supply Job-local scratch.
+  delete executorEnv[EXECUTOR_SCRATCH_ROOT_ENV];
+  return executorEnv;
 }
 
 function prepareLocalExecutorSpawn(
```

**File**: `apps/agor-docs/content/guide/config-yaml.mdx` (modified, +7/-2)
```diff
@@ -71,8 +71,13 @@ everywhere. To turn hosted OpenCode off:
 ```yaml
 agentic_tools:
   opencode_hosted_native_state: disabled
-``` See
-[OpenCode in hosted workspaces](/guide/sdk-comparison#hosted-workspaces).
+```
+
+See [OpenCode in hosted workspaces](/guide/sdk-comparison#hosted-workspaces).
+
+With `persistent-per-user` homes, the launcher should also set
+`AGOR_EXECUTOR_SCRATCH_ROOT` to Job-local storage so Gemini's per-task temporary
+directory stays off the shared home; see [Gemini Beta](/guide/sdk-comparison#gemini-beta).
 
 For Claude subscription sign-in, two storage modes are supported:
 
```

**File**: `apps/agor-docs/content/guide/sdk-comparison.mdx` (modified, +8/-0)
```diff
@@ -49,6 +49,14 @@ Settings → Gemini. Google-account sign-in and Vertex AI are not supported.
   To preserve both and start fresh, set `AGOR_GEMINI_RESET_HISTORY_FOR` to the Agor
   session ID in your environment variables and retry once. The matching recordings
   move into a quarantine folder in the SDK home; remove the variable afterward.
+- The executor's per-task temporary directory (`TMPDIR`) lives in the SDK home
+  unless a delegated launcher sets `AGOR_EXECUTOR_SCRATCH_ROOT` to an absolute local
+  scratch directory, keeping it off a shared network home. Shell commands inherit
+  it, so builds then share that scratch's size limit. Conversation recordings
+  always stay in the SDK home.
+- MCP servers use the SDK's 10-minute request timeout separately for each
+  connection attempt, tool listing and tool call, so a server that accepts a
+  connection and then stalls can hold up a turn for 10 minutes or more.
 - The default model is `gemini-3.8-flash`. The picker also offers `gemini-3.7-flash`,
   `gemini-3.5-flash-lite` and the paid preview `gemini-3.1-pro-preview`. Stored 2.5
   selections remain usable when the API key has access. Retired Flash selections
```

**File**: `packages/core/src/config/env-inheritance.ts` (modified, +3/-0)
```diff
@@ -1,6 +1,9 @@
 /** Reserved ambient credential namespace for trusted operator launcher helpers only. */
 export const TRUSTED_LAUNCHER_ENV_PREFIX = 'AGOR_CLOUD_';
 
+/** Job-local scratch supplied by a delegated launcher, never by user environment settings. */
+export const EXECUTOR_SCRATCH_ROOT_ENV = 'AGOR_EXECUTOR_SCRATCH_ROOT';
+
 /**
  * SECURITY: Allowlisted environment variable names that are safe to pass
  * to user/agent processes. Any variable NOT in this list (or matching a
```

**File**: `packages/core/src/config/env-resolver.ts` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@ import { normalizeStoredEnvMap, type StoredEnvVar } from './env-vars';
 export {
   ALLOWED_ENV_PREFIXES,
   ALLOWED_ENV_VARS,
+  EXECUTOR_SCRATCH_ROOT_ENV,
   TRUSTED_LAUNCHER_ENV_PREFIX,
 } from './env-inheritance';
 
```

**File**: `packages/executor/scripts/gemini-contract.mts` (modified, +1/-0)
```diff
@@ -22,6 +22,7 @@ process.env.HOME = path.join(root, 'home');
 delete process.env.GITHUB_SHA;
 delete process.env.SURFACE;
 delete process.env.AGOR_MANAGED_AGENTIC_TOOLS;
+delete process.env.AGOR_EXECUTOR_SCRATCH_ROOT;
 globalThis.fetch = async () => {
   throw new Error('Network forbidden in offline contract');
 };
```

---

### Incident Patch 3: `4be67817` (2026-10-05)
**Commit Message**: fix(client): add a byte budget to transcript detail retention (#2963)

* fix(client): add a byte budget to transcript detail retention

Lean transcript detail retention (#2950) bounded full-detail turns by count
only, so one huge tool result or a few large recent turns could still hold
tens of MB. Add approximate per-turn byte accounting and evict unprotected
recent turns oldest first while retained detail exceeds 32 MiB, alongside
the existing 10-turn bound. Latest, executing and pinned turns count toward
the budget but are never evicted by it.

Estimates are string code units, memoized per message and per bucket array,
so a new message is walked once and streaming chunks cost nothing. TaskBlock
pins a turn from a reader's detail load until its expanded activity holds its
own pin, so an over-budget reload is not evicted by the commit that loads it.

Related to #2757 (partial mitigation).

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* fix(ui): hand a reloaded turn's pin to its inline detail disclosures

The load pin assumed the reloaded detail opens an AgentChain that takes the
turn's pin over. A turn whose detail sits inside a text-bearing message
(reasoning o

**File**: `apps/agor-ui/scripts/test-transcript-retention.mjs` (modified, +117/-0)
```diff
@@ -351,3 +351,120 @@ test('a portaled fullscreen viewer keeps its turn open and focused until closed'
     assert.deepEqual(await liveTurns(page, cdp), both([]));
   });
 });
+
+test('a byte budget releases very large turns before the turn count would', {
+  timeout: 180_000,
+}, async () => {
+  await withProductionFixture('ConversationView/TranscriptRetention', async (page, cdp) => {
+    const MiB = 1024 * 1024;
+    await page.waitForFunction(() => !!window.transcriptRetentionFixture);
+    await page.evaluate(() => window.transcriptRetentionFixture.mount());
+    // Eight 6 MiB reads: within the ten-turn count, but only five fit 32 MiB.
+    const ids = [];
+    for (let n = 0; n < 8; n++) {
+      ids.push(
+        await page.evaluate(
+          (bytes) => window.transcriptRetentionFixture.addTurn({ bytes }),
+          6 * MiB
+        )
+      );
+      await page.waitForTimeout(20);
+    }
+    await page.getByText('Answer 7').waitFor();
+    assert.deepEqual(await liveTurns(page, cdp), both(range(3, 7)), 'oldest large turns released');
+
+    // A reader re-expands an evicted large turn: its pin holds it within budget.
+    const zero = page.locator(`[data-task-block="${ids[0]}"]`);
+    const chain = zero.getByRole('button', { name: '1 tool call' });
+    await chain.click();
+    await zero.getByText('Read').first().waitFor();
+    assert.deepEqual(await liveTurns(page, cdp), both([0, ...range(4, 7)]));
+
+    // One read larger than the whole budget is kept only while protected.
+    await chain.click();
+    await disengage(page);
+    const huge = await page.evaluate(
+      (bytes) => window.transcriptRetentionFixture.addTurn({ bytes }),
+      36 * MiB
+    );
+    await page.getByText('Answer 8').waitFor();
+    assert.deepEqual(await liveTurns(page, cdp), both([8]), 'the latest turn is protected');
+    await page.evaluate(() => window.transcriptRetentionFixture.addTurn());
+    await page.getByText('Answer 9').waitFor();
+    assert.deepEqual(await liveTurns(page, cdp), both([9]), 'no longer latest: released');
+    const hugeTurn = page.locator(`[data-task-block="${huge}"]`);
+    const hugeChain = hugeTurn.getByRole('button', { name: '1 tool call' });
+    await hugeChain.click();
+    await hugeTurn.getByText('Read').first().waitFor();
+    assert.deepEqual(await liveTurns(page, cdp), both([8, 9]), 'reloaded and kept while expanded');
+    await hugeChain.click();
+    await disengage(page);
+    assert.deepEqual(await liveTurns(page, cdp), both([9]), 'collapsed: released again');
+
+    await page.evaluate(() => window.transcriptRetentionFixture.unmount());
+    assert.deepEqual(await liveTurns(page, cdp), both([]));
+  });
+});
+
+test('reloaded inline detail stays open and live while protected turns exceed the budget', {
+  timeout: 180_000,
+}, async () => {
+  await withProductionFixture('ConversationView/TranscriptRetention', async (page, cdp) => {
+    await page.waitForFunction(() => !!window.transcriptRetentionFixture);
+    await page.evaluate(() => window.transcriptRetentionFixture.mount());
+    // Detail beside visible text, with no AgentChain: reasoning, a Read, and a
+    // Read after SDK-normalized empty reasoning (which renders nothing).
+    const reasoningId = await page.evaluate(() =>
+      window.transcriptRetentionFixture.addTurn({ inline: 'reasoning' })
+    );
+    const readId = await page.evaluate(() =>
+      window.transcriptRetentionFixture.addTurn({ inline: 'read' })
+    );
+    const emptyId = await page.evaluate(() =>
+      window.transcriptRetentionFixture.addTurn({ inline: 'empty-reasoning-read' })
+    );
+    // The latest turn alone holds more than the budget, so nothing else fits.
+    await page.evaluate(
+      (bytes) => window.transcriptRetentionFixture.addTurn({ bytes }),
+      36 * 1024 * 1024
+    );
+    await page.getByText('Answer 3').waitFor();
+    assert.deepEqual(await liveTurns(page, cdp), both([3]));
+
+    // Reloading opens the detail the reader asked for, which then holds the turn.
+    const reasoningTurn = page.locator(`[data-task-block="${reasoningId}"]`);
+    await reasoningTurn.getByRole('button', { name: '1 tool call' }).click();
+    await reasoningShown(page, reasoningId, 0);
+    const readTurn = page.locator(`[data-task-block="${readId}"]`);
+    await readTurn.getByRole('button', { name: '1 tool call' }).click();
+    const readShown = (id, n) =>
+      page.waitForFunction(
+        ([turnId, marker]) =>
+          !!document.querySelector(`[data-task-block="${turnId}"]`)?.textContent?.includes(marker),
+        [id, `TRANSCRIPT_RETENTION_${n}_`]
+      );
+    await readShown(readId, 1);
+    const emptyTurn = page.locator(`[data-task-block="${emptyId}"]`);
+    await emptyTurn.getByRole('button', { name: '1 tool call' }).click();
+    await readShown(emptyId, 2);
+    await disengage(page);
+    assert.deepEqual(
+      await liveTurns(page, cdp),
+      { tools: [1, 2, 3], thinking: [0, 3] },
+      'ever
```

**File**: `apps/agor-ui/src/components/ConversationView/TranscriptRetention.fixture.tsx` (modified, +40/-3)
```diff
@@ -27,6 +27,15 @@ let mountedHandle = false;
 const editTurns = new Set<number>();
 /** Turns whose answer has a table: Streamdown offers a portaled fullscreen viewer. */
 const tableTurns = new Set<number>();
+/** Tool result sizes of turns that read a very large file. */
+const payloadBytes = new Map<number, number>();
+/**
+ * Turns whose only detail sits inside the answer, beside its text: no
+ * AgentChain. `empty-reasoning-read` precedes the Read with SDK-normalized
+ * empty thinking, which renders nothing.
+ */
+type Inline = 'reasoning' | 'read' | 'empty-reasoning-read';
+const inlineTurns = new Map<number, Inline>();
 
 function task(n: number, status: Task['status']): Task {
   const createdAt = new Date(Date.UTC(2026, 9, 1, 0, n)).toISOString();
@@ -51,7 +60,7 @@ function messages(n: number): Message[] {
   };
   const prefix = `TRANSCRIPT_RETENTION_${n}_`;
   const thinking = `TRANSCRIPT_THINKING_${n}_`;
-  return [
+  const [tool, result, answer] = [
     {
       ...base,
       message_id: `${taskId(n)}-tool` as MessageID,
@@ -75,7 +84,11 @@ function messages(n: number): Message[] {
         {
           type: 'tool_result',
           tool_use_id: `read-${n}`,
-          content: JSON.parse(JSON.stringify(prefix + 'x'.repeat(PAYLOAD_BYTES - prefix.length))),
+          content: JSON.parse(
+            JSON.stringify(
+              prefix + 'x'.repeat((payloadBytes.get(n) ?? PAYLOAD_BYTES) - prefix.length)
+            )
+          ),
         },
       ],
     },
@@ -115,6 +128,18 @@ function messages(n: number): Message[] {
       ],
     },
   ] as Message[];
+  const inline = inlineTurns.get(n);
+  if (!inline) return [tool, result, answer];
+  type Blocks = Extract<Message['content'], unknown[]>;
+  const [reasoning, text] = answer.content as Blocks;
+  const read = [...(tool.content as Blocks), ...(result.content as Blocks)];
+  const detail =
+    inline === 'reasoning'
+      ? [reasoning]
+      : inline === 'read'
+        ? read
+        : [{ type: 'thinking' as const, text: '' }, ...read];
+  return [{ ...answer, content: [...detail, text] }];
 }
 
 const project = (message: Message): Message => ({
@@ -208,10 +233,22 @@ export const fixture = {
     await retainReactiveSession(client, SESSION_ID, { taskHydration: 'lean' }).ready();
   },
   /** One live turn as the daemon publishes it: created, payloads, completed. */
-  addTurn({ edit = false, table = false } = {}) {
+  addTurn({
+    edit = false,
+    table = false,
+    bytes = 0,
+    inline,
+  }: {
+    edit?: boolean;
+    table?: boolean;
+    bytes?: number;
+    inline?: Inline;
+  } = {}) {
     const n = turns++;
+    if (inline) inlineTurns.set(n, inline);
     if (edit) editTurns.add(n);
     if (table) tableTurns.add(n);
+    if (bytes) payloadBytes.set(n, bytes);
     tasks.emit('created', task(n, TaskStatus.RUNNING));
     for (const message of messages(n)) messageService.emit('created', message);
     tasks.emit('patched', task(n, TaskStatus.COMPLETED));
```

**File**: `apps/agor-ui/src/components/MessageBlock/MessageBlock.tsx` (modified, +26/-0)
```diff
@@ -123,6 +123,11 @@ interface MessageBlockProps {
   showAvatar?: boolean;
   /** Stable presentation identity while a confirmed task gains its initial message. */
   textChoiceKey?: string;
+  /**
+   * A reader loaded this turn's detail and it renders inline here: open the
+   * reasoning, or else the first tool, as the reader's expansion (it pins).
+   */
+  revealDetails?: boolean;
 }
 
 /** Get short description for a tool call (file path, pattern, command, etc.) */
@@ -377,6 +382,22 @@ function DaemonRestartNotice({
   );
 }
 
+/**
+ * Whether a reader's reveal can open something here: non-empty reasoning
+ * (empty thinking renders nothing), or a tool rendered as a ToolBlock (Task
+ * calls render as text). Matches what `revealDetails` opens.
+ */
+export function hasRevealableInlineDetail(message: Message): boolean {
+  return (
+    Array.isArray(message.content) &&
+    message.content.some((block) =>
+      block.type === 'thinking'
+        ? !!(block as unknown as ThinkingContentBlock).text?.trim()
+        : block.type === 'tool_use' && (block as unknown as ToolUseBlock).name !== 'Task'
+    )
+  );
+}
+
 // Memoized: every text block / tool block of every message in the conversation
 // re-rendered on every streaming chunk because TaskBlock's `messages` array
 // gets a fresh reference each tick. Default shallow compare is sufficient
@@ -407,6 +428,7 @@ const MessageBlockInner: React.FC<MessageBlockProps> = ({
   defaultTextExpanded = true,
   showAvatar = true,
   textChoiceKey,
+  revealDetails = false,
 }) => {
   const { token } = theme.useToken();
   const [timestampOpen, setTimestampOpen] = useState(false);
@@ -749,6 +771,8 @@ const MessageBlockInner: React.FC<MessageBlockProps> = ({
   const hasTextBefore = textBeforeTools.some((text) => text.trim().length > 0);
   const hasTextAfter = textAfterTools.some((text) => text.trim().length > 0);
   const hasTools = toolBlocks.length > 0;
+  // A reveal opens reasoning only when it renders; otherwise the first tool.
+  const revealReasoning = revealDetails && !!(streamingThinking || thinkingBlocks.join('')).trim();
 
   const hasTaskTruncation = taskTruncations.some((value) => Object.keys(value ?? {}).length > 0);
   if (!hasThinking && !hasTextBefore && !hasTextAfter && !hasTools && !hasTaskTruncation) {
@@ -823,6 +847,7 @@ const MessageBlockInner: React.FC<MessageBlockProps> = ({
           content={streamingThinking || thinkingBlocks.join('\n\n')}
           isStreaming={isThinking}
           defaultExpanded={false}
+          revealRequested={revealReasoning}
         />
       )}
 
@@ -967,6 +992,7 @@ const MessageBlockInner: React.FC<MessageBlockProps> = ({
                   descriptionNode={bashNode}
                   status={status}
                   expandedByDefault={shouldExpandToolByDefault(toolUse.name)}
+                  revealRequested={revealDetails && !revealReasoning && toolIndex === 0}
                 >
                   <ToolUseRenderer toolUse={toolUse} toolResult={toolResult} />
                 </ToolBlock>
```

**File**: `apps/agor-ui/src/components/MessageBlock/index.ts` (modified, +1/-1)
```diff
@@ -1 +1 @@
-export { getMessageSpeaker, MessageBlock } from './MessageBlock';
+export { getMessageSpeaker, hasRevealableInlineDetail, MessageBlock } from './MessageBlock';
```

**File**: `apps/agor-ui/src/components/TaskBlock/TaskBlock.lean.test.tsx` (modified, +98/-1)
```diff
@@ -7,7 +7,7 @@ import {
   TaskStatus,
 } from '@agor-live/client';
 import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
-import { useState } from 'react';
+import { useLayoutEffect, useState } from 'react';
 import { afterEach, describe, expect, it, vi } from 'vitest';
 import { HistoryTextChoices } from '../MessageBlock/HistoryMarkdown';
 import { TaskBlock } from './TaskBlock';
@@ -507,3 +507,100 @@ it('remounts message blocks once when cached detail is evicted, not on live upda
   expect(screen.getByText('Extended Thinking')).toBeVisible();
   expect(block('Visible answer')).toBe(remounted);
 });
+
+it('pins a turn from a reader’s detail load until its expanded activity holds its own pin', async () => {
+  const events: string[] = [];
+  let pins = 0;
+  const retain = vi.fn(() => {
+    const pin = ++pins;
+    events.push(`retain ${pin}`);
+    return () => events.push(`release ${pin}`);
+  });
+  let finishLoad = () => {};
+  const load = vi.fn(() => new Promise<void>((resolve) => (finishLoad = resolve)));
+  const props = { onLoadTaskMessages: load, onRetainTaskDetails: retain };
+  const { rerender } = render(view(props));
+  fireEvent.click(screen.getByRole('button', { name: 'Tool calls', expanded: false }));
+  // Pinned before the read starts, so its commit cannot be evicted for size.
+  expect(events).toEqual(['retain 1']);
+  expect(load).toHaveBeenCalledTimes(1);
+  const full = [
+    messages[0],
+    message(1, MessageRole.ASSISTANT, [
+      { type: 'tool_use', id: 'call-1', name: 'Read', input: {} },
+      { type: 'tool_result', tool_use_id: 'call-1', content: 'Result' },
+    ]),
+  ];
+  // The cache commits the detail before the read settles.
+  rerender(view({ ...props, taskMessages: full, taskMessagesLoaded: true }));
+  expect(screen.getByRole('button', { name: '1 tool call', expanded: true })).toBeVisible();
+  expect(events).toEqual(['retain 1', 'retain 2']);
+  finishLoad();
+  // The opened activity's pin takes over; only the load pin is released.
+  await waitFor(() => expect(events).toEqual(['retain 1', 'retain 2', 'release 1']));
+});
+
+it('does not pin inline detail that arrives without a reader asking for it', () => {
+  const retain = vi.fn(() => () => {});
+  const full = {
+    ...messages[1],
+    content: [
+      { type: 'thinking', text: 'INLINE_DETAIL' },
+      { type: 'tool_use', id: 'read-1', name: 'Read', input: { file_path: '/a.txt' } },
+      { type: 'tool_result', tool_use_id: 'read-1', content: 'TOOL_DETAIL' },
+      { type: 'text', text: 'Visible answer' },
+    ],
+  } as Message;
+  render(
+    view({
+      onRetainTaskDetails: retain,
+      taskMessages: [messages[0], full],
+      taskMessagesLoaded: true,
+    })
+  );
+  expect(screen.getByText('Visible answer')).toBeVisible();
+  expect(screen.queryByText('INLINE_DETAIL')).toBeNull();
+  expect(screen.queryByText('TOOL_DETAIL')).toBeNull();
+  expect(retain).not.toHaveBeenCalled();
+});
+
+it('keeps a load pin taken before the previous commit’s passive effect runs', async () => {
+  const events: string[] = [];
+  let pins = 0;
+  const retain = vi.fn(() => {
+    const pin = ++pins;
+    events.push(`retain ${pin}`);
+    return () => events.push(`release ${pin}`);
+  });
+  const load = vi.fn(() => new Promise<void>(() => {})); // the read stays pending
+  let rerenderOutsideAct = () => {};
+  /**
+   * Re-renders TaskBlock (loading=false) in a non-act, default-priority commit,
+   * whose passive effects run later. Its layout effect clicks the disclosure
+   * header first, as a non-focusing early click would.
+   */
+  function Harness() {
+    const [tick, setTick] = useState(0);
+    rerenderOutsideAct = () => setTimeout(() => setTick(1));
+    useLayoutEffect(() => {
+      if (!tick) return;
+      events.push('click');
+      screen.getByRole('button', { name: '1 tool call' }).click();
+    }, [tick]);
+    return (
+      <TaskBlock
+        task={{ ...task, recorded_tool_count: 1 }}
+        taskMessages={messages}
+        taskMessagesLoaded={false}
+        onLoadTaskMessages={load}
+        onRetainTaskDetails={retain}
+      />
+    );
+  }
+  render(<Harness />);
+  rerenderOutsideAct();
+  await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
+  await new Promise((resolve) => setTimeout(resolve, 50));
+  // The stale effect (from the render before the click) must not release it.
+  expect(events).toEqual(['click', 'retain 1']);
+});
```

**File**: `apps/agor-ui/src/components/TaskBlock/TaskBlock.retention.browser.test.tsx` (added, +112/-0)
```diff
@@ -0,0 +1,112 @@
+import { generateId } from '@agor/core/ids/browser';
+import { type Message, MessageRole, type Task, TaskStatus } from '@agor-live/client';
+import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
+import { afterEach, expect, it, vi } from 'vitest';
+import { TaskBlock } from './TaskBlock';
+
+afterEach(cleanup);
+
+const task: Task = {
+  task_id: generateId(),
+  session_id: generateId(),
+  created_by: '',
+  full_prompt: 'Prompt',
+  status: TaskStatus.COMPLETED,
+  created_at: '2026-09-01T00:00:00.000Z',
+  git_state: { ref_at_start: 'main', sha_at_start: 'synthetic' },
+};
+const message = (index: number, role: MessageRole, content: Message['content']): Message => ({
+  message_id: `${task.task_id}-${index}`,
+  task_id: task.task_id,
+  session_id: task.session_id,
+  index,
+  role,
+  type: role === MessageRole.USER ? 'user' : 'assistant',
+  timestamp: task.created_at,
+  content_preview: '',
+  content,
+});
+const prompt = message(0, MessageRole.USER, 'Prompt');
+
+// Without an AgentChain, loaded detail renders inside the answer's MessageBlock.
+// The disclosure the reader asked for must hold the turn before the load pin
+// is released, or the cache's byte budget returns the turn to lean at once.
+it.each([
+  {
+    shape: 'reasoning beside text',
+    recorded_tool_count: 0,
+    detail: [{ type: 'thinking', text: 'INLINE_DETAIL' }],
+  },
+  {
+    shape: 'a Read result beside text',
+    recorded_tool_count: 1,
+    detail: [
+      { type: 'tool_use', id: 'read-1', name: 'Read', input: { file_path: '/a.txt' } },
+      { type: 'tool_result', tool_use_id: 'read-1', content: 'INLINE_DETAIL' },
+    ],
+  },
+  {
+    // SDK-normalized empty thinking renders nothing, so the Read is revealed.
+    shape: 'a Read result after empty reasoning, beside text',
+    recorded_tool_count: 1,
+    detail: [
+      { type: 'thinking', text: '' },
+      { type: 'tool_use', id: 'read-1', name: 'Read', input: { file_path: '/a.txt' } },
+      { type: 'tool_result', tool_use_id: 'read-1', content: 'INLINE_DETAIL' },
+    ],
+  },
+  {
+    // The turn's first answer has only empty reasoning: reveal the later Read.
+    shape: 'a Read result in a later answer than empty reasoning',
+    recorded_tool_count: 1,
+    earlier: [{ type: 'thinking', text: '' }],
+    detail: [
+      { type: 'tool_use', id: 'read-1', name: 'Read', input: { file_path: '/a.txt' } },
+      { type: 'tool_result', tool_use_id: 'read-1', content: 'INLINE_DETAIL' },
+    ],
+  },
+])(
+  'opens and pins loaded $shape before the load pin is released',
+  async ({ recorded_tool_count, detail, earlier }) => {
+    const events: string[] = [];
+    let pins = 0;
+    const retain = vi.fn(() => {
+      const pin = ++pins;
+      events.push(`retain ${pin}`);
+      return () => events.push(`release ${pin}`);
+    });
+    let finishLoad = () => {};
+    const load = vi.fn(() => new Promise<void>((resolve) => (finishLoad = resolve)));
+    const first = (blocks: unknown[]) =>
+      message(1, MessageRole.ASSISTANT, [
+        ...blocks,
+        { type: 'text', text: 'Earlier answer' },
+      ] as Message['content']);
+    const view = (answer: Message, loaded: boolean) => (
+      <TaskBlock
+        task={{ ...task, recorded_tool_count }}
+        taskMessages={earlier ? [prompt, first(loaded ? earlier : []), answer] : [prompt, answer]}
+        taskMessagesLoaded={loaded}
+        onLoadTaskMessages={load}
+        onRetainTaskDetails={retain}
+      />
+    );
+    const lean = {
+      ...message(2, MessageRole.ASSISTANT, [{ type: 'text', text: 'Visible answer' }]),
+      has_deferred_reasoning: recorded_tool_count === 0,
+    };
+    const { rerender } = render(view(lean, false));
+    fireEvent.click(screen.getByRole('button', { name: /^(1 tool call|Reasoning)$/ }));
+    expect(events).toEqual(['retain 1']);
+    const full = message(2, MessageRole.ASSISTANT, [
+      ...detail,
+      { type: 'text', text: 'Visible answer' },
+    ] as Message['content']);
+    rerender(view(full, true));
+    await waitFor(() => expect(screen.getByText(/INLINE_DETAIL/)).toBeVisible());
+    expect(screen.getByText('Visible answer')).toBeVisible();
+    expect(events).toEqual(['retain 1', 'retain 2']);
+    finishLoad();
+    await waitFor(() => expect(events).toEqual(['retain 1', 'retain 2', 'release 1']));
+  }
+);
```

**File**: `apps/agor-ui/src/components/TaskBlock/TaskBlock.tsx` (modified, +36/-1)
```diff
@@ -31,7 +31,7 @@ import { TaskDetailRetention, useRetainTurnOverlays } from '../../hooks/useTaskD
 import { AgentChain } from '../AgentChain';
 import { AgorAvatar } from '../AgorAvatar';
 import { CompactionBlock } from '../CompactionBlock';
-import { getMessageSpeaker, MessageBlock } from '../MessageBlock';
+import { getMessageSpeaker, hasRevealableInlineDetail, MessageBlock } from '../MessageBlock';
 import { CreatedByTag } from '../metadata/CreatedByTag';
 import {
   ContextWindowPill,
@@ -697,6 +697,31 @@ function useTaskDetailRetainer(
   return useCallback(() => retain?.(taskId), [retain, taskId]);
 }
 
+/**
+ * Pins the turn from a reader's detail load until the commit after it settles,
+ * when the disclosures it opened hold their own pins. Otherwise a turn over the
+ * cache's byte budget would be evicted by the very commit that loads it. Built
+ * outside TaskBlock's render scope for the same reason as the retainer.
+ */
+function useLoadPin(loading: boolean, retain: () => (() => void) | undefined): () => void {
+  const pin = useRef<{ request: number; release?: () => void }>({ request: 0 });
+  // A click can land between a commit and its passive effect. Fence by the
+  // request this render saw, so that older effect never releases a newer pin.
+  const seen = pin.current.request;
+  // Every commit, so a batched loading true → false cannot strand the pin.
+  useEffect(() => {
+    const held = pin.current;
+    if (loading || held.request > seen) return;
+    held.release?.();
+    held.release = undefined;
+  });
+  useEffect(() => () => pin.current.release?.(), []);
+  return useCallback(() => {
+    pin.current.request += 1;
+    pin.current.release ??= retain();
+  }, [retain]);
+}
+
 /**
  * Bumped once each time the cache releases this turn's detail. React keeps a
  * fiber's previous props on its alternate, and descendants of a memoized child
@@ -965,7 +990,15 @@ export const TaskBlock = React.memo<TaskBlockProps>(
     const [revealLoadedActivity, setRevealLoadedActivity] = useState(false);
     const [emptyActivityExpanded, setEmptyActivityExpanded] = useState(false);
     const firstAgentChainIndex = blocks.findIndex((block) => block.type === 'agent-chain');
+    // Without a chain, loaded detail renders inside a text-bearing message.
+    const inlineRevealId =
+      revealLoadedActivity && firstAgentChainIndex === -1
+        ? blocks
+            .flatMap((block) => (block.type === 'message' ? [block.message] : []))
+            .find(hasRevealableInlineDetail)?.message_id
+        : undefined;
     const loadActivity = async () => {
+      pinLoad();
       setDetailsLoading(true);
       setDetailsError(null);
       setRevealLoadedActivity(true);
@@ -1022,6 +1055,7 @@ export const TaskBlock = React.memo<TaskBlockProps>(
         Array.isArray(message.content) && message.content.some((block) => block.type === 'thinking')
     );
     const retainDetails = useTaskDetailRetainer(task.task_id, onRetainTaskDetails);
+    const pinLoad = useLoadPin(detailsLoading, retainDetails);
     const overlays = useRetainTurnOverlays(retainDetails);
     const evictionEpoch = useDetailEvictionEpoch(hasTools || hasReasoning);
     const keySuffix = evictionEpoch ? `:evicted-${evictionEpoch}` : '';
@@ -1158,6 +1192,7 @@ export const TaskBlock = React.memo<TaskBlockProps>(
                 compact={compact}
                 defaultTextExpanded={defaultTextExpanded}
                 showAvatar={!groupedAvatarMessageIds.has(block.message.message_id)}
+                revealDetails={block.message.message_id === inlineRevealId}
               />
             );
             return (
```

**File**: `apps/agor-ui/src/components/ThinkingBlock/ThinkingBlock.tsx` (modified, +4/-1)
```diff
@@ -25,6 +25,8 @@ interface ThinkingBlockProps {
   isStreaming?: boolean;
   /** Whether to default to expanded state */
   defaultExpanded?: boolean;
+  /** A reader asked for this turn's detail: open on mount (and keep the turn). */
+  revealRequested?: boolean;
 }
 
 /**
@@ -38,9 +40,10 @@ export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
   content,
   isStreaming = false,
   defaultExpanded = false,
+  revealRequested = false,
 }) => {
   const { token } = theme.useToken();
-  const [expanded, setExpanded] = useState(defaultExpanded);
+  const [expanded, setExpanded] = useState(defaultExpanded || revealRequested);
   useRetainTaskDetailsWhile(expanded && (!!content || isStreaming));
 
   // Don't render if no content
```

---

### Incident Patch 4: `36c07bcb` (2026-10-05)
**Commit Message**: fix(executor): bound Codex rollout usage reads and drop duplicate tool payloads (#2962)

* fix(executor): bound Codex rollout usage reads and drop duplicate tool payloads

- Replace the whole-file read of the Codex rollout log in the token-usage
  fallback with a newest-first, fixed-chunk tail reader (64 KiB reads,
  1 MiB max line, 16 MiB max scan). Results match the old full read for
  files within those bounds; beyond them the reader returns unknown.
- Let the streaming consumer opt out of retaining completed tool_use /
  tool_result blocks and toolUses for the final complete event. It already
  persists each tool_complete and filters tool blocks from the final event,
  so persisted messages are unchanged. Non-streaming callers keep the copies.

Split from #2856. Related to preset-io/agor-cloud#713 and #701.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* docs(executor): clarify how rollout tail bounds change the result

Oversized lines are skipped and scanning continues, so an older record can
be returned; only exhausting the scan budget (or a shrinking file) yields
undefined. Comment-only change.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAI

**File**: `packages/executor/src/sdk-handlers/codex/codex-tool.ts` (modified, +4/-1)
```diff
@@ -247,7 +247,10 @@ export class CodexTool implements ITool {
         taskId,
         permissionMode,
         abortController,
-        streamingCallbacks?.onPulse
+        streamingCallbacks?.onPulse,
+        // Tool rows are persisted from tool_complete below and tool blocks are
+        // filtered out of the final complete event, so skip the turn-end copies.
+        { retainCompletedTools: false }
       )) {
         // Detect if execution was stopped early
         if (event.type === 'stopped') {
```

**File**: `packages/executor/src/sdk-handlers/codex/prompt-service.test.ts` (modified, +200/-1)
```diff
@@ -48,7 +48,7 @@ const configMocks = vi.hoisted(() => ({
 }));
 
 import { CodexTool } from './codex-tool.js';
-import { CodexPromptService } from './prompt-service.js';
+import { CodexPromptService, type CodexStreamEvent } from './prompt-service.js';
 
 // Track how many Codex instances were created (module-level state)
 let mockInstanceCount = 0;
@@ -2088,6 +2088,205 @@ describe('CodexPromptService - event_msg terminal handling (issue #1749)', () =>
     });
   });
 
+  describe('completed tool payload retention', () => {
+    const TOOL_COUNT = 20;
+    const payload = (label: string) => `PAYLOAD-${label}:${'tool output line\n'.repeat(10_000)}`;
+
+    function toolHeavyTurn(): Array<Record<string, unknown>> {
+      const events: Array<Record<string, unknown>> = [{ type: 'turn.started' }];
+      for (let i = 0; i < TOOL_COUNT; i++) {
+        const item = {
+          id: `cmd-${i}`,
+          type: 'command_execution',
+          command: `cat INPUT-${i}.log`,
+          aggregated_output: payload(`cmd-${i}`),
+          exit_code: 0,
+          status: 'completed',
+        };
+        events.push({
+          type: 'item.started',
+          item: { ...item, aggregated_output: '', status: 'in_progress' },
+        });
+        events.push({ type: 'item.completed', item });
+        if (i === TOOL_COUNT / 2) {
+          events.push({
+            type: 'event_msg',
+            payload: { type: 'agent_message', message: 'Halfway through the logs.' },
+          });
+        }
+      }
+      const todo = {
+        id: 'todo-1',
+        type: 'todo_list',
+        items: [{ text: 'Summarize logs', completed: true }],
+      };
+      events.push(
+        {
+          type: 'item.completed',
+          item: {
+            id: 'mcp-1',
+            type: 'mcp_tool_call',
+            server: 'agor',
+            tool: 'agor_execute_tool',
+            arguments: { tool_name: 'INPUT-mcp' },
+            result: { content: [{ type: 'text', text: payload('mcp') }] },
+            status: 'completed',
+          },
+        },
+        { type: 'item.updated', item: todo },
+        { type: 'item.completed', item: todo },
+        {
+          type: 'item.completed',
+          item: { id: 'reasoning-1', type: 'reasoning', text: 'Thinking' },
+        },
+        { type: 'item.completed', item: { id: 'answer', type: 'agent_message', text: 'Done.' } },
+        {
+          type: 'turn.completed',
+          usage: { input_tokens: 10, output_tokens: 5, cached_input_tokens: 0 },
+        }
+      );
+      return events;
+    }
+
+    const isToolBlock = (block: { type: string }) =>
+      block.type === 'tool_use' || block.type === 'tool_result';
+
+    async function collect(retainCompletedTools?: boolean) {
+      const { service } = await makeInitializedStreamingService(null);
+      mockStreamEvents = toolHeavyTurn();
+      const events: CodexStreamEvent[] = [];
+      for await (const event of service.promptSessionStreaming(
+        testSessionId,
+        'go',
+        undefined,
+        undefined,
+        undefined,
+        undefined,
+        retainCompletedTools === undefined ? undefined : { retainCompletedTools }
+      )) {
+        events.push(event);
+      }
+      return events;
+    }
+
+    it('drops turn-end tool copies when asked, emitting identical tool events', async () => {
+      const retained = await collect();
+      const dropped = await collect(false);
+      expect(await collect(true)).toEqual(retained);
+
+      // Every streamed event other than the final complete is unchanged.
+      expect(dropped.slice(0, -1)).toEqual(retained.slice(0, -1));
+      const toolCompletes = dropped.filter((event) => event.type === 'tool_complete');
+      expect(toolCompletes).toHaveLength(TOOL_COUNT + 2); // + MCP + one TodoWrite
+      expect(toolCompletes[0]).toMatchObject({ toolUse: { output: payload('cmd-0') } });
+
+      const retainedFinal = retained.at(-1);
+      const droppedFinal = dropped.at(-1);
+      if (retainedFinal?.type !== 'complete' || droppedFinal?.type !== 'complete') {
+        throw new Error('expected a final complete event');
+      }
+
+      // Legacy/default mode keeps the full copies for the final message.
+      expect(retainedFinal.toolUses).toHaveLength(TOOL_COUNT + 2);
+      const retainedBlocks = retainedFinal.content.filter(isToolBlock);
+      // The todo list has no output/status, so it has no tool_result block.
+      expect(retainedBlocks.filter((block) => block.type === 'tool_use')).toHaveLength(
+        TOOL_COUNT + 2
+      );
+      expect(retainedBlocks.filter((block) => block.type === 'tool_result')).toHaveLength(
+        TOOL_COUNT + 1
+      );
+      for (let i = 0; i < TOOL_COUNT; i++) {
+        expect(JSON.stringify(retainedFinal)).toContain(`PAYLOAD-cmd-${i}:`);
+      }
+
+      // Without retention the final event carries only the non-tool blocks, in order,
+      // and nothing held until turn end references a tool payload 
```

**File**: `packages/executor/src/sdk-handlers/codex/prompt-service.ts` (modified, +52/-49)
```diff
@@ -72,6 +72,7 @@ import { resolveContextUserId } from '../base/context-user.js';
 import type { TasksService } from '../base/index.js';
 import { forkCodexThreadViaAppServer } from './app-server-client.js';
 import { applyAgorCodexLaunchPolicy } from './launch-policy.js';
+import { findLatestRolloutRecord } from './rollout-tail.js';
 import {
   CODEX_MCP_UNKNOWN_FAILURE,
   CodexRuntimeDiagnostics,
@@ -260,25 +261,8 @@ async function extractLatestContextUsageFromRollout(
   const rolloutPath = await findCodexRolloutFile(threadId);
   if (!rolloutPath) return undefined;
 
-  let contents: string;
-  try {
-    contents = await fs.readFile(rolloutPath, 'utf8');
-  } catch {
-    return undefined;
-  }
-
-  let latest: ContextUsageSnapshot | undefined;
-  for (const line of contents.split('\n')) {
-    if (!line.includes('token_count')) continue;
-    try {
-      const parsed = JSON.parse(line) as unknown;
-      latest = extractCodexContextSnapshotFromEvent(parsed) ?? latest;
-    } catch {
-      // Ignore malformed / partially-written JSONL lines.
-    }
-  }
-
-  return latest;
+  // Newest-first bounded scan: rollout logs grow with the whole conversation.
+  return findLatestRolloutRecord(rolloutPath, 'token_count', extractCodexContextSnapshotFromEvent);
 }
 
 export interface CodexPromptResult {
@@ -364,6 +348,16 @@ export type CodexStreamEvent =
       rawContextUsage?: ContextUsageSnapshot;
     };
 
+export interface CodexStreamingOptions {
+  /**
+   * Keep completed tool_use/tool_result blocks (and `toolUses`) for the final
+   * `complete` event. Defaults to true. Consumers that persist every
+   * `tool_complete` event as it arrives pass false so tool payloads are not
+   * held a second time until the turn ends.
+   */
+  retainCompletedTools?: boolean;
+}
+
 export class CodexPromptService {
   private codex?: InstanceType<typeof CodexSdk.Codex>;
   private lastApiKey: string | null = null;
@@ -1122,6 +1116,8 @@ export class CodexPromptService {
    * @param taskId - Optional task ID
    * @param permissionMode - Permission mode for tool execution ('ask' | 'auto' | 'allow-all')
    * @param abortController - Optional AbortController for cancellation support
+   * @param onActivity - Optional SDK activity callback (liveness pulse)
+   * @param options - See CodexStreamingOptions
    * @returns Async generator of streaming events
    */
   async *promptSessionStreaming(
@@ -1130,8 +1126,10 @@ export class CodexPromptService {
     taskId?: TaskID,
     permissionMode?: PermissionMode,
     abortController?: AbortController,
-    onActivity?: SdkActivityCallback
+    onActivity?: SdkActivityCallback,
+    options: CodexStreamingOptions = {}
   ): AsyncGenerator<CodexStreamEvent> {
+    const retainCompletedTools = options.retainCompletedTools ?? true;
     // Get session to check for existing thread ID and working directory
     const session = await this.sessionsRepo.findById(sessionId);
     if (!session) {
@@ -1619,38 +1617,43 @@ export class CodexPromptService {
                   event.item.type === 'todo_list' &&
                   todoIdsEmittedViaUpdate.has(toolUseComplete.id);
 
-                // Add to allToolUses for backward compatibility (tool_uses field)
-                allToolUses.push({
-                  id: toolUseComplete.id,
-                  name: toolUseComplete.name,
-                  input: toolUseComplete.input,
-                });
-
-                // Add tool_use block to content array (for UI rendering)
-                currentMessage.push({
-                  type: 'tool_use',
-                  id: toolUseComplete.id,
-                  name: toolUseComplete.name,
-                  input: toolUseComplete.input,
-                });
-
-                // Add tool_result block if we have output OR status (for UI rendering)
-                if (toolUseComplete.output !== undefined || toolUseComplete.status) {
-                  const isError =
-                    toolUseComplete.status === 'failed' || toolUseComplete.status === 'error';
-
-                  // Build content: prefer output, fall back to status message
-                  let content = toolUseComplete.output || '';
-                  if (!content && toolUseComplete.status) {
-                    content = `[${toolUseComplete.status}]`;
-                  }
+                // Only consumers that persist the final `complete` event as one
+                // message need these copies; streaming consumers have already
+                // persisted the tool_complete event and drop tool blocks there.
+                if (retainCompletedTools) {
+                  // Add to allToolUses for backward compatibility (tool_uses field)
+                  allToolUses.push({
+                    id: toolUseComplete.id,
+                    name: toolUseComplete.name,
+                    input: toolUseComplete.input,
+                  });
 
+                  // Add tool_use block to content array (for UI ren
```

**File**: `packages/executor/src/sdk-handlers/codex/rollout-tail.test.ts` (added, +308/-0)
```diff
@@ -0,0 +1,308 @@
+import * as fs from 'node:fs/promises';
+import os from 'node:os';
+import path from 'node:path';
+import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
+import {
+  DEFAULT_ROLLOUT_TAIL_LIMITS,
+  findLatestRolloutRecord,
+  type RolloutTailLimits,
+} from './rollout-tail.js';
+import { extractCodexContextSnapshotFromEvent } from './usage.js';
+
+// Wrap `open` so individual tests can observe or perturb the file handle.
+vi.mock('node:fs/promises', async (importOriginal) => {
+  const actual = await importOriginal<typeof import('node:fs/promises')>();
+  return { ...actual, open: vi.fn(actual.open) };
+});
+
+const MARKER = 'token_count';
+const project = extractCodexContextSnapshotFromEvent;
+
+/** The previous whole-file implementation, kept verbatim as the reference. */
+async function legacyFullRead(filePath: string) {
+  let contents: string;
+  try {
+    contents = await fs.readFile(filePath, 'utf8');
+  } catch {
+    return undefined;
+  }
+  let latest: ReturnType<typeof project>;
+  for (const line of contents.split('\n')) {
+    if (!line.includes(MARKER)) continue;
+    try {
+      latest = project(JSON.parse(line) as unknown) ?? latest;
+    } catch {
+      // Ignore malformed / partially-written JSONL lines.
+    }
+  }
+  return latest;
+}
+
+function tokenCount(totalTokens: number, extra: Record<string, unknown> = {}) {
+  return JSON.stringify({
+    timestamp: '2026-10-02T00:00:00.000Z',
+    type: 'event_msg',
+    payload: {
+      type: 'token_count',
+      info: {
+        last_token_usage: { total_tokens: totalTokens },
+        model_context_window: 258_400,
+      },
+      ...extra,
+    },
+  });
+}
+
+function responseItem(text: string) {
+  return JSON.stringify({
+    timestamp: '2026-10-02T00:00:00.000Z',
+    type: 'response_item',
+    payload: { type: 'function_call_output', output: text },
+  });
+}
+
+const tinyLimits = (chunkBytes: number): RolloutTailLimits => ({
+  chunkBytes,
+  maxLineBytes: DEFAULT_ROLLOUT_TAIL_LIMITS.maxLineBytes,
+  maxScanBytes: DEFAULT_ROLLOUT_TAIL_LIMITS.maxScanBytes,
+});
+
+let dir: string;
+let fileCounter = 0;
+
+async function writeFixture(contents: string | Buffer): Promise<string> {
+  const file = path.join(dir, `rollout-${fileCounter++}.jsonl`);
+  await fs.writeFile(file, contents);
+  return file;
+}
+
+beforeAll(async () => {
+  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'agor-rollout-tail-'));
+});
+
+afterAll(async () => {
+  await fs.rm(dir, { recursive: true, force: true });
+});
+
+describe('findLatestRolloutRecord', () => {
+  it('returns the newest usable record at the end of the file', async () => {
+    const file = await writeFixture(
+      [tokenCount(100), responseItem('hello'), tokenCount(200), ''].join('\n')
+    );
+    const result = await findLatestRolloutRecord(file, MARKER, project);
+    expect(result?.totalTokens).toBe(200);
+    expect(result).toEqual(await legacyFullRead(file));
+  });
+
+  it('skips newer lines that mention the marker but are not usable records', async () => {
+    const file = await writeFixture(
+      [
+        tokenCount(100),
+        responseItem('grep token_count prompt-service.ts'),
+        JSON.stringify({ type: 'event_msg', payload: { type: 'token_count', info: null } }),
+        '{"type":"event_msg","payload":{"type":"token_count"', // malformed
+        '',
+      ].join('\n')
+    );
+    const result = await findLatestRolloutRecord(file, MARKER, project);
+    expect(result?.totalTokens).toBe(100);
+    expect(result).toEqual(await legacyFullRead(file));
+  });
+
+  it('handles CRLF, a partially-written final line, and multi-byte UTF-8 at every chunk boundary', async () => {
+    const fixtures = [
+      // CRLF line endings; CR is JSON whitespace.
+      [tokenCount(1), responseItem('a'), tokenCount(2), ''].join('\r\n'),
+      // Writer is mid-append: final record is truncated and must be ignored.
+      `${[tokenCount(3), responseItem('b')].join('\n')}\n${tokenCount(4).slice(0, 40)}`,
+      // No trailing newline on a complete final record.
+      [responseItem('c'), tokenCount(5)].join('\n'),
+      // Multi-byte characters (2-, 3-, and 4-byte sequences) on usable lines
+      // so that some chunk size splits each of them.
+      [
+        tokenCount(6, { note: 'ä猫🙂'.repeat(7) }),
+        responseItem('猫🙂ä'.repeat(11)),
+        tokenCount(7, { note: '🙂猫ä'.repeat(5) }),
+        responseItem('ü'),
+      ].join('\n'),
+    ];
+    for (const contents of fixtures) {
+      const file = await writeFixture(contents);
+      const expected = await legacyFullRead(file);
+      expect(expected).toBeDefined();
+      for (let chunkBytes = 1; chunkBytes <= 64; chunkBytes++) {
+        expect(
+          await findLatestRolloutRecord(file, MARKER, project, tinyLimits(chunkBytes))
+        ).toEqual(expected);
+      }
+      expect(await findLatestRolloutRecord(file, MARKER, project)).toEqual(expected);
+    }
+  });
+
+  it('d
```

**File**: `packages/executor/src/sdk-handlers/codex/rollout-tail.ts` (added, +132/-0)
```diff
@@ -0,0 +1,132 @@
+/**
+ * Bounded newest-first reader for Codex rollout JSONL files.
+ *
+ * Rollout logs grow with the whole conversation history, so reading one into
+ * memory to find the latest `token_count` record costs a history-sized
+ * allocation (plus a second copy from splitting it into lines) on every turn
+ * that needs the fallback. This reader walks the file backwards in fixed-size
+ * chunks and stops at the newest line whose projection yields a value, so
+ * memory is bounded by `maxLineBytes` + `chunkBytes` regardless of file size.
+ *
+ * For any file that fits within the limits, the result is the same as parsing
+ * every line oldest-first and keeping the last non-undefined projection:
+ * - lines are split on LF only (a CR before it is JSON whitespace),
+ * - bytes are decoded as UTF-8 only once a whole line is assembled, so
+ *   multi-byte characters split across chunk boundaries decode correctly,
+ * - lines that lack `marker`, fail to parse, or project to undefined are skipped.
+ *
+ * Bounded deviations:
+ * - lines longer than `maxLineBytes` are skipped without being buffered and
+ *   the scan continues, so if the newest usable record were oversized an
+ *   OLDER record would be returned instead. Genuine `token_count` records are
+ *   a few hundred bytes, so this does not occur for real rollout files,
+ * - nothing older than the last `maxScanBytes` of the file is examined; when
+ *   that budget runs out without a usable record the result is undefined,
+ * - if the file shrinks while it is being read, the read is abandoned
+ *   (undefined) rather than joining non-contiguous bytes. Bytes appended after
+ *   the initial size snapshot are ignored.
+ */
+import { type FileHandle, open } from 'node:fs/promises';
+
+export interface RolloutTailLimits {
+  /** Bytes per backwards read. */
+  chunkBytes: number;
+  /** Lines longer than this are skipped without being buffered. */
+  maxLineBytes: number;
+  /** Total bytes examined from the end of the file before giving up. */
+  maxScanBytes: number;
+}
+
+export const DEFAULT_ROLLOUT_TAIL_LIMITS: Readonly<RolloutTailLimits> = {
+  chunkBytes: 64 * 1024,
+  maxLineBytes: 1024 * 1024,
+  maxScanBytes: 16 * 1024 * 1024,
+};
+
+const LF = 0x0a;
+
+export async function findLatestRolloutRecord<T>(
+  filePath: string,
+  marker: string,
+  project: (record: unknown) => T | undefined,
+  limits: Readonly<RolloutTailLimits> = DEFAULT_ROLLOUT_TAIL_LIMITS
+): Promise<T | undefined> {
+  let handle: FileHandle;
+  try {
+    handle = await open(filePath, 'r');
+  } catch {
+    return undefined;
+  }
+
+  try {
+    const size = (await handle.stat()).size;
+    const floor = Math.max(0, size - limits.maxScanBytes);
+    const chunk = Buffer.alloc(Math.min(limits.chunkBytes, size - floor));
+
+    // Pieces of the line currently being assembled, newest (rightmost) first.
+    let pieces: Buffer[] = [];
+    let lineBytes = 0;
+    let oversized = false;
+
+    const take = (bytes: Buffer, copy: boolean) => {
+      if (oversized) return;
+      lineBytes += bytes.length;
+      if (lineBytes > limits.maxLineBytes) {
+        // Skip this line and keep scanning older ones (see header).
+        oversized = true;
+        pieces = [];
+        return;
+      }
+      // `chunk` is reused by the next read, so pieces that outlive it are copied.
+      if (bytes.length > 0) pieces.push(copy ? Buffer.from(bytes) : bytes);
+    };
+
+    const finishLine = (): T | undefined => {
+      const line =
+        oversized || lineBytes === 0
+          ? undefined
+          : pieces.length === 1
+            ? pieces[0]
+            : Buffer.concat(pieces.reverse(), lineBytes);
+      pieces = [];
+      lineBytes = 0;
+      oversized = false;
+      if (!line?.includes(marker)) return undefined;
+      try {
+        return project(JSON.parse(line.toString('utf8')));
+      } catch {
+        // Ignore malformed / partially-written JSONL lines.
+        return undefined;
+      }
+    };
+
+    let position = size;
+    while (position > floor) {
+      const length = Math.min(chunk.length, position - floor);
+      position -= length;
+      const { bytesRead } = await handle.read(chunk, 0, length, position);
+      // The file shrank under us; never join non-contiguous bytes.
+      if (bytesRead !== length) return undefined;
+
+      const view = chunk.subarray(0, length);
+      let end = length;
+      while (end > 0) {
+        const newline = view.lastIndexOf(LF, end - 1);
+        if (newline === -1) break;
+        take(view.subarray(newline + 1, end), false);
+        const found = finishLine();
+        if (found !== undefined) return found;
+        end = newline;
+      }
+      take(view.subarray(0, end), true);
+    }
+
+    // Only the first line of the file is known to be complete here; a line cut
+    // by the scan budget is not.
+    return position === 0 ? finishLine() : undefined;
+  } catch {
+    return undefined;
+  } finally
```

---

### Incident Patch 5: `07935c63` (2026-10-03)
**Commit Message**: fix: clarify environment logs and make Railway cleanup resumable (#2971)

* fix(ui): clarify environment failures and command logs

* fix(railway): wait for deletion and resume interrupted cleanup

* fix: keep environment logs accessible and selected

* fix: keep environment pill configuration subscription passive

**File**: `apps/agor-docs/content/guide/environment-configuration.mdx` (modified, +15/-0)
```diff
@@ -493,6 +493,14 @@ The reason members **cannot** hand-edit rendered commands: admins curate the set
 
 Start, Stop, Restart, Nuke, Logs, and Render controls require branch `all` permission or admin access. Health/status reads can remain available to users who can view the branch because they do not run the configured shell/log commands.
 
+### Environment logs
+
+**View Logs** separates **Commands** (Start/Stop/Nuke output and recent attempts)
+from **Runtime** (output of the configured `logs` command). Failed or in-flight
+commands open the Commands tab first. Their output remains available even when
+no runtime service exists or runtime logs are unavailable. Older attempts are
+collapsed; general remote-environment guidance is under **About remote environments**.
+
 ### Health-check lifecycle
 
 Automatic health monitoring is active only while a non-archived environment is
@@ -1013,6 +1021,13 @@ if needed. Storage charges continue. **Nuke permanently removes the owned
 service, volume and environment**, never the project. Missing recorded volumes
 are not silently recreated. Partial cleanup can require manual Railway recovery.
 
+Nuke saves a non-secret cleanup receipt in the owned environment before removing
+the service and waits for Railway's asynchronous deletion to become visible.
+If it stops partway through, repeat Nuke to resume from that receipt; Start will
+not reuse a preview being deleted. Unknown deletion outcomes are observed rather
+than blindly retried. Older failures without a receipt, manually deleted services,
+or changed resource ownership still require manual inspection in Railway.
+
 **Serialize actions through one lifecycle controller per project.** This simple
 launcher does not promise HA-safe concurrent starts or exactly-once creation.
 No mutation is automatically retried within an invocation. Inspect ambiguous
```

**File**: `apps/agor-ui/src/components/BranchModal/tabs/EnvironmentTab.test.tsx` (added, +136/-0)
```diff
@@ -0,0 +1,136 @@
+import type { BranchEnvironmentInstance } from '@agor/core/types';
+import type { AgorClient, Branch, Repo } from '@agor-live/client';
+import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
+import { App, ConfigProvider, theme } from 'antd';
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
+import { __setAuthConfigForTests } from '../../../hooks/useAuthConfig';
+import { EnvironmentTab } from './EnvironmentTab';
+
+vi.mock('../../../hooks/usePermissions', () => ({ usePermissions: () => ({ isAdmin: true }) }));
+vi.mock('../../CodeEditor', () => ({ CodeEditor: () => null }));
+
+const failure: BranchEnvironmentInstance = {
+  status: 'error',
+  last_error: 'start command exited with code 1',
+  last_health_check: {
+    status: 'unknown',
+    timestamp: '2026-10-02T21:48:00Z',
+    message: 'No health check configured',
+  },
+  last_command: {
+    action: 'start',
+    status: 'failed',
+    timestamp: '2026-10-02T21:47:30Z',
+    message: 'start command exited with code 1',
+    output: 'Cannot resolve the pushed public GitHub branch. Push it before Start.',
+  },
+};
+const branch = {
+  branch_id: 'branch-a',
+  name: 'preview',
+  environment_variant: 'railway-sqlite',
+  start_command: 'preview start',
+  environment_instance: failure,
+} as Branch;
+const repo: Repo = {
+  repo_id: 'repo-a' as Repo['repo_id'],
+  slug: 'test-repo',
+  name: 'Test repo',
+  repo_type: 'local',
+  local_path: '/test-repo',
+  created_at: '2026-10-02T21:47:00Z',
+  last_updated: '2026-10-02T21:47:00Z',
+  environment: {
+    version: 2,
+    default: 'railway-sqlite',
+    variants: { 'railway-sqlite': { start: 'preview start', stop: 'preview stop' } },
+  },
+};
+
+describe('EnvironmentTab diagnostics', () => {
+  afterEach(cleanup);
+
+  beforeEach(() => {
+    __setAuthConfigForTests(
+      { requireAuth: true },
+      {
+        environmentCommands: {
+          asynchronous: true,
+          shellLogs: false,
+          shellLogsReason: 'Runtime logs unavailable on this instance.',
+        },
+      }
+    );
+  });
+
+  function setup(canControlEnvironment = true) {
+    const on = vi.fn();
+    const client = { service: () => ({ on, removeListener: vi.fn() }) } as unknown as AgorClient;
+    render(
+      <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { motion: false } }}>
+        <App>
+          <EnvironmentTab
+            branch={branch}
+            repo={repo}
+            client={client}
+            canControlEnvironment={canControlEnvironment}
+          />
+        </App>
+      </ConfigProvider>
+    );
+    return on;
+  }
+
+  it('shows one compact failure, collapses guidance, and opens the actionable output in Logs', async () => {
+    setup();
+    expect(screen.getAllByRole('alert')).toHaveLength(1);
+    expect(screen.getByRole('alert')).toHaveTextContent(/^Start failed$/);
+    expect(screen.queryByText(/Cannot resolve the pushed/)).not.toBeInTheDocument();
+    expect(screen.queryByText(/Retry Stop to request cleanup/)).not.toBeInTheDocument();
+    expect(screen.queryByText(/No health check configured/)).not.toBeInTheDocument();
+    const guidance = screen.getByRole('button', { name: 'About remote environments' });
+    expect(guidance).toHaveAttribute('aria-expanded', 'false');
+    fireEvent.click(guidance);
+    await waitFor(() => expect(screen.getByText(/Commands run remotely/)).toBeVisible());
+    expect(screen.getByText('Restart').closest('button')!).toBeDisabled();
+    // No runtime logs command: persisted launcher output must still be reachable.
+    fireEvent.click(screen.getByText('View Logs').closest('button')!);
+    const dialog = screen.getByRole('dialog');
+    await waitFor(() =>
+      expect(within(dialog).getByText(/Cannot resolve the pushed/)).toBeVisible()
+    );
+  });
+
+  it('does not weaken environment control permissions to expose the logs button', async () => {
+    setup(false);
+    expect(screen.getByText('View Logs').closest('button')!).toBeDisabled();
+    expect(screen.getByText('Start').closest('button')!).toBeDisabled();
+  });
+
+  it('keeps status and command logs synchronized with same-branch patches only', async () => {
+    const on = setup();
+    const update = on.mock.calls.find(([event]) => event === 'patched')?.[1];
+    const patched: Branch = {
+      ...branch,
+      environment_instance: {
+        ...failure,
+        last_command: {
+          ...failure.last_command!,
+          action: 'stop',
+          status: 'unknown',
+          output: 'Cleanup result unavailable',
+        },
+      },
+    };
+    act(() => update({ ...patched, branch_id: 'branch-b' }));
+    expect(screen.getByRole('alert')).toHaveTextContent('Start failed');
+    act(() => update(patched));
+    expect(screen.getByRole('alert')).toHaveTextContent('Stop outcome unknown');
+    fireEvent.click(screen.getByText('View Logs').closest('button')!);
+    
```

**File**: `apps/agor-ui/src/components/BranchModal/tabs/EnvironmentTab.tsx` (modified, +87/-128)
```diff
@@ -44,14 +44,26 @@ import {
   SaveOutlined,
   ThunderboltOutlined,
   UploadOutlined,
-  WarningOutlined,
 } from '@ant-design/icons';
-import { Alert, Button, Card, Select, Space, Spin, Tag, Tooltip, Typography, theme } from 'antd';
+import {
+  Alert,
+  Button,
+  Card,
+  Collapse,
+  Select,
+  Space,
+  Spin,
+  Tag,
+  Tooltip,
+  Typography,
+  theme,
+} from 'antd';
 import { useEffect, useMemo, useRef, useState } from 'react';
 import { useAuthConfig } from '../../../hooks/useAuthConfig';
 import { useConfirmNukeEnvironment } from '../../../hooks/useConfirmNukeEnvironment';
 import { useEnvironmentStart } from '../../../hooks/useEnvironmentStart';
 import { usePermissions } from '../../../hooks/usePermissions';
+import { getEnvironmentCommandStatus, hasEnvironmentLogs } from '../../../utils/environmentCommand';
 import {
   getEnvironmentState,
   getEnvironmentStateDescription,
@@ -139,8 +151,8 @@ export const EnvironmentTab: React.FC<EnvironmentTabProps> = ({
     ? undefined
     : "Requires branch 'all' permission or admin access";
   const lifecycleFieldHelp = isWebhookMode
-    ? 'This instance uses webhook-managed environments. Use public http(s) URLs for start, stop, nuke, and logs.'
-    : 'This instance supports shell commands and URL webhooks for start, stop, nuke, and logs.';
+    ? 'Use public HTTP(S) URLs for start, stop, nuke, and logs.'
+    : 'Commands accept shell scripts or HTTP(S) webhooks.';
   const repoPlaceholder = isWebhookMode
     ? 'version: 2\ndefault: remote\nvariants:\n  remote:\n    start: https://env.example.com/start?branch={{branch.name}}\n    stop: https://env.example.com/stop?branch={{branch.name}}\n    health: https://apps.example.com/{{branch.name}}/health\n    app: https://apps.example.com/{{branch.name}}\n'
     : 'version: 2\ndefault: lean\nvariants:\n  lean:\n    start: docker compose up -d\n    stop: docker compose down\n';
@@ -173,7 +185,6 @@ export const EnvironmentTab: React.FC<EnvironmentTabProps> = ({
   const [lastHealthCheck, setLastHealthCheck] = useState(
     branch.environment_instance?.last_health_check
   );
-  const [lastError, setLastError] = useState(branch.environment_instance?.last_error);
   const [isStarting, setIsStarting] = useState(false);
   const [isStopping, setIsStopping] = useState(false);
   const [isRestarting, setIsRestarting] = useState(false);
@@ -189,7 +200,6 @@ export const EnvironmentTab: React.FC<EnvironmentTabProps> = ({
     setEnvStatus(branch.environment_instance?.status || 'stopped');
     setEnvironment(branch.environment_instance);
     setLastHealthCheck(branch.environment_instance?.last_health_check);
-    setLastError(branch.environment_instance?.last_error);
 
     const branchChanged = prevBranchRef.current !== branch;
     prevBranchRef.current = branch;
@@ -226,7 +236,6 @@ export const EnvironmentTab: React.FC<EnvironmentTabProps> = ({
         setEnvironment(updated.environment_instance);
         setEnvStatus(updated.environment_instance?.status || 'stopped');
         setLastHealthCheck(updated.environment_instance?.last_health_check);
-        setLastError(updated.environment_instance?.last_error);
       }
     };
     client.service('branches').on('patched', handleBranchUpdate);
@@ -545,7 +554,13 @@ export const EnvironmentTab: React.FC<EnvironmentTabProps> = ({
   };
 
   // ----- Derived UI state -----
-  const inferredState = getEnvironmentState(branch.environment_instance);
+  const inferredState = getEnvironmentState(environment);
+  const commandStatus = getEnvironmentCommandStatus(environment);
+  const canViewLogs = hasEnvironmentLogs(
+    environment,
+    branch.logs_command,
+    featuresConfig?.environmentCommands?.shellLogs
+  );
   const hasEnvironmentConfig = !!repo.environment;
   const noVariantsConfigured = !hasEnvironmentConfig;
 
@@ -596,15 +611,14 @@ export const EnvironmentTab: React.FC<EnvironmentTabProps> = ({
     }
   }, [inferredState, token]);
 
-  const healthIcon = lastHealthCheck ? (
-    lastHealthCheck.status === 'healthy' ? (
-      <CheckCircleOutlined style={{ color: token.colorSuccess }} />
-    ) : lastHealthCheck.status === 'unhealthy' ? (
-      <CloseCircleOutlined style={{ color: token.colorError }} />
-    ) : (
-      <WarningOutlined style={{ color: token.colorWarning }} />
-    )
-  ) : null;
+  const healthIcon =
+    envStatus === 'running' && lastHealthCheck ? (
+      lastHealthCheck.status === 'healthy' ? (
+        <CheckCircleOutlined style={{ color: token.colorSuccess }} />
+      ) : lastHealthCheck.status === 'unhealthy' ? (
+        <CloseCircleOutlined style={{ color: token.colorError }} />
+      ) : null
+    ) : null;
 
   const variantSelectOptions = availableVariants.map((name) => {
     const variant = repo.environment?.variants[name];
@@ -635,85 +649,6 @@ export const EnvironmentTab: React.FC<EnvironmentTabProps> = ({
     <div style={{ width: '100%', maxHeight: '70vh', overflowY: 'auto' }}>
       <Space orientation="vertical" si
```

**File**: `apps/agor-ui/src/components/EnvironmentLogsModal/EnvironmentCommandLogs.tsx` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+import { type BranchEnvironmentInstance, hasActiveEnvironmentCommand } from '@agor/core/types';
+import { Alert, Collapse, Space, Typography, theme } from 'antd';
+import { getEnvironmentCommandStatus } from '../../utils/environmentCommand';
+import { Ansi } from '../AnsiText';
+
+function CommandOutput({ environment }: { environment: BranchEnvironmentInstance }) {
+  const { token } = theme.useToken();
+  const attempt = environment.command_attempt;
+  const active = hasActiveEnvironmentCommand(environment);
+  // A previous result can remain while a new command is in flight.
+  const result = active ? undefined : environment.last_command;
+  const output = attempt?.output || result?.output || (!attempt && environment.last_error);
+  const timestamp = attempt?.requested_at ?? result?.timestamp;
+  return (
+    <Space orientation="vertical" style={{ width: '100%', minWidth: 0 }}>
+      {timestamp && (
+        <Typography.Text type="secondary">{new Date(timestamp).toLocaleString()}</Typography.Text>
+      )}
+      {active && attempt && (
+        <Typography.Text type="secondary">
+          Result deadline: {new Date(attempt.result_deadline).toLocaleString()}
+        </Typography.Text>
+      )}
+      {result?.message && <Typography.Text>{result.message}</Typography.Text>}
+      {(attempt?.output_truncated || result?.output_truncated) && (
+        <Typography.Text type="warning">Command output truncated.</Typography.Text>
+      )}
+      <pre
+        style={{
+          margin: 0,
+          padding: token.paddingSM,
+          background: token.colorFillAlter,
+          borderRadius: token.borderRadius,
+          maxHeight: '45vh',
+          overflow: 'auto',
+          whiteSpace: 'pre-wrap',
+          overflowWrap: 'anywhere',
+          fontSize: token.fontSizeSM,
+        }}
+      >
+        {output ? <Ansi>{output}</Ansi> : 'No command output received.'}
+      </pre>
+    </Space>
+  );
+}
+
+export function EnvironmentCommandLogs({
+  environment,
+}: {
+  environment?: BranchEnvironmentInstance;
+}) {
+  const status = getEnvironmentCommandStatus(environment);
+  if (!environment) return <Typography.Text type="secondary">No command history.</Typography.Text>;
+  return (
+    <Space orientation="vertical" style={{ width: '100%', minWidth: 0 }}>
+      {status && (
+        <>
+          <Typography.Text strong>{status.text}</Typography.Text>
+          {status.type === 'warning' && (
+            <Alert
+              type="warning"
+              showIcon
+              title="Output may be incomplete. Check provider state before retrying."
+            />
+          )}
+          <CommandOutput environment={environment} />
+        </>
+      )}
+      {!!environment.command_history?.length && (
+        <Collapse
+          size="small"
+          items={environment.command_history.map(({ attempt, result }) => {
+            const previous: BranchEnvironmentInstance = {
+              status: 'stopped',
+              command_attempt: attempt,
+              last_command: result,
+            };
+            return {
+              key: attempt.id,
+              label: `Previous ${getEnvironmentCommandStatus(previous)?.text.toLowerCase()} · ${new Date(attempt.requested_at).toLocaleString()}`,
+              children: <CommandOutput environment={previous} />,
+            };
+          })}
+        />
+      )}
+      {!status && !environment.command_history?.length && (
+        <Typography.Text type="secondary">No command history.</Typography.Text>
+      )}
+    </Space>
+  );
+}
```

**File**: `apps/agor-ui/src/components/EnvironmentLogsModal/EnvironmentLogsModal.test.tsx` (modified, +295/-5)
```diff
@@ -12,15 +12,36 @@
  * the modal alive on a fresh branch.
  */
 
+import type { BranchEnvironmentInstance } from '@agor/core/types';
 import type { AgorClient, Branch } from '@agor-live/client';
-import { render, waitFor, within } from '@testing-library/react';
-import { describe, expect, it, vi } from 'vitest';
+import {
+  act,
+  cleanup,
+  fireEvent,
+  render as rtlRender,
+  screen,
+  waitFor,
+  within,
+} from '@testing-library/react';
+import { ConfigProvider } from 'antd';
+import type { ReactNode } from 'react';
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
+import { __setAuthConfigForTests } from '../../hooks/useAuthConfig';
 import { Ansi } from '../AnsiText';
 import { EnvironmentLogsModal } from './EnvironmentLogsModal';
 
+function render(ui: ReactNode) {
+  return rtlRender(ui, {
+    wrapper: ({ children }) => (
+      <ConfigProvider theme={{ token: { motion: false } }}>{children}</ConfigProvider>
+    ),
+  });
+}
+
 const mockBranch: Partial<Branch> = {
   branch_id: 'wt-test' as Branch['branch_id'],
   name: 'test-branch',
+  logs_command: 'preview logs',
 };
 
 function makeClient(response: unknown): AgorClient {
@@ -32,7 +53,16 @@ function makeClient(response: unknown): AgorClient {
 }
 
 describe('EnvironmentLogsModal', () => {
-  it('safe Ansi import resolves to a callable component (defends against CJS double-default)', () => {
+  afterEach(cleanup);
+
+  beforeEach(() => {
+    __setAuthConfigForTests({ requireAuth: true });
+    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
+      configurable: true,
+      value: vi.fn(),
+    });
+  });
+  it('safe Ansi import resolves to a callable component (defends against CJS double-default)', async () => {
     // Direct unit assertion: even if ansi-to-react ever ships a double-wrapped
     // default again, the wrapper unwraps it. If this fails, every <Ansi>
     // render in the app is a React #130 timebomb.
@@ -108,7 +138,267 @@ describe('EnvironmentLogsModal', () => {
     // Assert the antd Alert is rendered with the message (regression on the
     // earlier `title` typo, which made the alert empty).
     const alert = await findByRole('alert');
-    expect(within(alert).getByText('Error fetching logs')).toBeInTheDocument();
-    expect(within(alert).getByText(/No logs command configured/)).toBeInTheDocument();
+    expect(
+      within(alert).getByText('Runtime logs unavailable: No logs command configured')
+    ).toBeInTheDocument();
+  });
+
+  const failed: BranchEnvironmentInstance = {
+    status: 'error',
+    command_attempt: {
+      id: 'attempt-a',
+      action: 'start',
+      requested_by: 'user-a' as NonNullable<
+        BranchEnvironmentInstance['command_attempt']
+      >['requested_by'],
+      requested_at: '2026-10-02T21:47:26Z',
+      claimed_at: '2026-10-02T21:47:28Z',
+      finished_at: '2026-10-02T21:47:30Z',
+      claim_deadline: '2026-10-02T21:50:26Z',
+      command_deadline: '2026-10-02T21:52:28Z',
+      result_deadline: '2026-10-02T21:56:01Z',
+      output: 'Cannot resolve the pushed public GitHub branch. Push it before Start.',
+      output_truncated: true,
+    },
+    last_command: {
+      action: 'start',
+      status: 'failed',
+      timestamp: '2026-10-02T21:47:30Z',
+      message: 'start command exited with code 1',
+    },
+  };
+
+  it('opens failed launch output first and keeps it separate from runtime logs', async () => {
+    const find = vi.fn().mockResolvedValue({
+      logs: 'No owned service exists for this branch. Nothing was changed.',
+      timestamp: '2026-10-02T21:48:00Z',
+    });
+    const client = { service: () => ({ find }) } as unknown as AgorClient;
+    render(
+      <EnvironmentLogsModal
+        open
+        onClose={() => {}}
+        branch={{ ...mockBranch, environment_instance: failed } as Branch}
+        client={client}
+      />
+    );
+    expect(screen.getByRole('tab', { name: 'Commands' })).toHaveAttribute('aria-selected', 'true');
+    await waitFor(() => expect(screen.getByText(/Cannot resolve the pushed/)).toBeVisible());
+    await waitFor(() => expect(screen.getByText('Command output truncated.')).toBeVisible());
+    expect(find).not.toHaveBeenCalled();
+    fireEvent.click(screen.getByRole('tab', { name: 'Runtime' }));
+    await waitFor(() => expect(screen.getByText(/No owned service exists/)).toBeVisible());
+    expect(find).toHaveBeenCalledWith({ query: { branch_id: mockBranch.branch_id } });
+    fireEvent.click(screen.getByRole('tab', { name: 'Commands' }));
+    await waitFor(() => expect(screen.getByText(/Cannot resolve the pushed/)).toBeVisible());
+  });
+
+  it('keeps command output available without a runtime logs command', async () => {
+    const find = vi.fn();
+    render(
+      <EnvironmentLogsModal
+        open
+        onClose={() => {}}
+        branch={{ ...mockBranch, logs_command: undefined, environment_instance: failed } as Branch}
+        client={{ service: () => ({ fi
```

**File**: `apps/agor-ui/src/components/EnvironmentLogsModal/EnvironmentLogsModal.tsx` (modified, +161/-106)
```diff
@@ -1,10 +1,16 @@
 // biome-ignore-all lint/plugin/noHardcodedColorProperty: log output intentionally uses a fixed terminal-like surface
 import type { AgorClient, Branch } from '@agor-live/client';
 import { ReloadOutlined } from '@ant-design/icons';
-import { Alert, Button, Checkbox, Modal, Space, Typography, theme } from 'antd';
+import { Alert, Button, Checkbox, Modal, Space, Tabs, Typography, theme } from 'antd';
 import { useCallback, useEffect, useRef, useState } from 'react';
+import { useAuthConfig } from '../../hooks/useAuthConfig';
+import {
+  getEnvironmentCommandStatus,
+  hasEnvironmentCommandLogs,
+} from '../../utils/environmentCommand';
 import { Ansi } from '../AnsiText';
 import { ErrorBoundary } from '../ErrorBoundary';
+import { EnvironmentCommandLogs } from './EnvironmentCommandLogs';
 
 const { Text } = Typography;
 
@@ -24,25 +30,57 @@ interface LogsResponse {
   truncated?: boolean;
 }
 
-export const EnvironmentLogsModal: React.FC<EnvironmentLogsModalProps> = ({
+// Keep retained output and in-flight requests scoped to the displayed branch.
+export const EnvironmentLogsModal: React.FC<EnvironmentLogsModalProps> = (props) => (
+  <EnvironmentLogsContent key={props.branch.branch_id} {...props} />
+);
+
+const EnvironmentLogsContent: React.FC<EnvironmentLogsModalProps> = ({
   open,
   onClose,
   branch,
   client,
 }) => {
   const { token } = theme.useToken();
+  const { featuresConfig } = useAuthConfig();
+  const shellLogsUnavailable =
+    featuresConfig?.environmentCommands?.shellLogs === false &&
+    !!branch.logs_command &&
+    !/^https?:\/\//i.test(branch.logs_command.trim());
+  const runtimeUnavailableReason = !branch.logs_command
+    ? 'No runtime logs command configured.'
+    : shellLogsUnavailable
+      ? (featuresConfig?.environmentCommands?.shellLogsReason ?? 'Runtime shell logs unavailable.')
+      : undefined;
+  const commandStatus = getEnvironmentCommandStatus(branch.environment_instance);
+  const preferCommands =
+    hasEnvironmentCommandLogs(branch.environment_instance) &&
+    (runtimeUnavailableReason ||
+      commandStatus?.type !== 'info' ||
+      branch.environment_instance?.status === 'error' ||
+      (branch.environment_instance?.command_attempt &&
+        !branch.environment_instance.command_attempt.finished_at));
+  const [selectedTab, setSelectedTab] = useState<string>();
+  const activeTab = selectedTab ?? (preferCommands ? 'commands' : 'runtime');
+  // Choose a default once per opening, not whenever a command finishes.
+  useEffect(() => {
+    if (open) setSelectedTab((selected) => selected ?? activeTab);
+  }, [open, activeTab]);
+  const showRuntime = activeTab === 'runtime';
   const [logs, setLogs] = useState<LogsResponse | null>(null);
   const [loading, setLoading] = useState(false);
   const [autoRefresh, setAutoRefresh] = useState(true);
   const logsContainerRef = useRef<HTMLDivElement>(null);
   const logsRef = useRef<LogsResponse | null>(null);
   const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
   const fetchInFlightRef = useRef(false);
+  const requestGenerationRef = useRef(0);
 
   const fetchLogs = useCallback(
     async (shouldAutoScroll = false, isManualRefresh = false) => {
-      if (!client || fetchInFlightRef.current) return;
+      if (!client || runtimeUnavailableReason || fetchInFlightRef.current) return;
       fetchInFlightRef.current = true;
+      const generation = requestGenerationRef.current;
 
       // Check if user is scrolled to bottom before fetching
       const container = logsContainerRef.current;
@@ -62,17 +100,22 @@ export const EnvironmentLogsModal: React.FC<EnvironmentLogsModalProps> = ({
             branch_id: branch.branch_id,
           },
         })) as unknown as LogsResponse;
+        if (generation !== requestGenerationRef.current) return;
+        const hadLogs = !!logsRef.current;
         setLogs(data);
         logsRef.current = data;
 
         // Auto-scroll to bottom if shouldAutoScroll is true AND (user was already at bottom OR first load)
-        const hadLogs = !!logsRef.current;
         if (shouldAutoScroll && (isAtBottom || !hadLogs)) {
           setTimeout(() => {
-            container?.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
+            if (generation === requestGenerationRef.current) {
+              const current = logsContainerRef.current;
+              current?.scrollTo({ top: current.scrollHeight, behavior: 'smooth' });
+            }
           }, 100);
         }
       } catch (error: unknown) {
+        if (generation !== requestGenerationRef.current) return;
         const errorData = {
           logs: '',
           timestamp: new Date().toISOString(),
@@ -81,24 +124,29 @@ export const EnvironmentLogsModal: React.FC<EnvironmentLogsModalProps> = ({
         setLogs(errorData);
         logsRef.current = errorData;
       } finally {
-        fetchInFlightRef.current = false;
-        if (isManualRefresh) {

```

**File**: `apps/agor-ui/src/components/EnvironmentPill/EnvironmentPill.test.tsx` (modified, +60/-2)
```diff
@@ -1,6 +1,7 @@
 import type { Branch, Repo } from '@agor-live/client';
-import { render, screen } from '@testing-library/react';
-import { describe, expect, it, vi } from 'vitest';
+import { fireEvent, render, screen } from '@testing-library/react';
+import { beforeEach, describe, expect, it, vi } from 'vitest';
+import { __setAuthConfigForTests } from '../../hooks/useAuthConfig';
 
 vi.mock('antd', async () => {
   const React = await import('react');
@@ -76,6 +77,63 @@ const defaultProps = {
 };
 
 describe('EnvironmentPill', () => {
+  beforeEach(() => {
+    __setAuthConfigForTests({ requireAuth: true });
+  });
+
+  it('opens command-only logs while retaining the branch permission gate', () => {
+    const onViewLogs = vi.fn();
+    const commandOnly = {
+      ...branch,
+      environment_instance: { status: 'error', last_error: 'Launch failed' },
+    } as Branch;
+    const props = { ...defaultProps, branch: commandOnly, onViewLogs };
+    const { rerender } = render(<EnvironmentPill {...props} />);
+    fireEvent.click(screen.getByRole('button', { name: 'View environment logs' }));
+    expect(onViewLogs).toHaveBeenCalledWith(branch.branch_id);
+    onViewLogs.mockClear();
+    rerender(<EnvironmentPill {...props} canControlEnvironment={false} />);
+    const button = screen.getByRole('button', { name: 'View environment logs' });
+    expect(button).toBeDisabled();
+    fireEvent.click(button);
+    expect(onViewLogs).not.toHaveBeenCalled();
+  });
+
+  it('uses the rendered branch logs command and respects shell-log availability', () => {
+    __setAuthConfigForTests(
+      { requireAuth: true },
+      { environmentCommands: { asynchronous: true, shellLogs: false } }
+    );
+    const { rerender } = render(<EnvironmentPill {...defaultProps} />);
+    // A repo default is not evidence that this branch variant has runtime logs.
+    expect(screen.getByRole('button', { name: 'View environment logs' })).toBeDisabled();
+    rerender(
+      <EnvironmentPill {...defaultProps} branch={{ ...branch, logs_command: 'preview logs' }} />
+    );
+    expect(screen.getByRole('button', { name: 'View environment logs' })).toBeDisabled();
+    rerender(
+      <EnvironmentPill
+        {...defaultProps}
+        branch={{ ...branch, logs_command: 'https://example.test/logs' }}
+      />
+    );
+    expect(screen.getByRole('button', { name: 'View environment logs' })).not.toBeDisabled();
+    rerender(
+      <EnvironmentPill
+        {...defaultProps}
+        branch={{
+          ...branch,
+          logs_command: 'preview logs',
+          environment_instance: {
+            status: 'error',
+            last_error: 'Launch failed',
+          },
+        }}
+      />
+    );
+    expect(screen.getByRole('button', { name: 'View environment logs' })).not.toBeDisabled();
+  });
+
   it('opens the reported URL and permits Stop retry only after an attempt settles', () => {
     const running = {
       ...branch,
```

**File**: `apps/agor-ui/src/components/EnvironmentPill/EnvironmentPill.tsx` (modified, +11/-5)
```diff
@@ -9,8 +9,10 @@ import {
   StopOutlined,
 } from '@ant-design/icons';
 import { Button, Space, Tooltip, theme } from 'antd';
+import { useAuthConfigSnapshot } from '../../hooks/useAuthConfig';
 import { useConfirmNukeEnvironment } from '../../hooks/useConfirmNukeEnvironment';
 import { getEnvironmentAccessUrls } from '../../utils/environmentAccessUrls';
+import { hasEnvironmentLogs } from '../../utils/environmentCommand';
 import { getEffectiveEnv } from '../../utils/environmentConfig';
 import { getEnvironmentState } from '../../utils/environmentState';
 import { Tag } from '../Tag';
@@ -47,6 +49,12 @@ export function EnvironmentPill({
   const effectiveEnv = getEffectiveEnv(repo);
   const hasConfig = effectiveEnv.hasConfig;
   const env = branch.environment_instance;
+  const { featuresConfig } = useAuthConfigSnapshot();
+  const canViewLogs = hasEnvironmentLogs(
+    env,
+    branch.logs_command,
+    featuresConfig?.environmentCommands?.shellLogs
+  );
   // If a parent has loaded effective branch access (e.g. BranchModal), honor
   // that explicit decision. Otherwise do not try to infer from direct owners or
   // `others_can`: group grants are not present on the branch payload, and the
@@ -326,9 +334,7 @@ export function EnvironmentPill({
               <Tooltip
                 title={
                   controlDisabledTooltip ??
-                  (!effectiveEnv.logs
-                    ? 'Configure logs command to enable'
-                    : 'View environment logs')
+                  (canViewLogs ? 'View environment logs' : 'No environment logs available')
                 }
               >
                 <Button
@@ -338,11 +344,11 @@ export function EnvironmentPill({
                   icon={<FileTextOutlined />}
                   onClick={(event) => {
                     event.stopPropagation();
-                    if (resolvedCanControlEnvironment && effectiveEnv.logs) {
+                    if (resolvedCanControlEnvironment && canViewLogs) {
                       onViewLogs(branch.branch_id);
                     }
                   }}
-                  disabled={!resolvedCanControlEnvironment || !effectiveEnv.logs}
+                  disabled={!resolvedCanControlEnvironment || !canViewLogs}
                   style={{
                     height: 22,
                     width: 22,
```

---

### Incident Patch 6: `346eaeea` (2026-10-02)
**Commit Message**: fix(branches): publish board creation events after commit (#2972)

* fix(branches): publish board creation events after commit

* fix(realtime): preserve explicit null dispatch on committed events

**File**: `apps/agor-daemon/src/mcp/tools/branches.realtime.test.ts` (added, +381/-0)
```diff
@@ -0,0 +1,381 @@
+import {
+  BoardObjectRepository,
+  BranchRepository,
+  getCurrentTenantId,
+  runWithoutTenantDatabaseScope,
+} from '@agor/core/db';
+import { type Application, feathers, socketio } from '@agor/core/feathers';
+import type { RealtimeRelayEnvelope } from '@agor/core/realtime';
+import type { BoardEntityObject, Branch, HookContext } from '@agor/core/types';
+import type { McpServer } from '@modelcontextprotocol/server';
+import { afterEach, describe, expect, it, vi } from 'vitest';
+import { tenantChannelName } from '../../realtime/routing';
+import { type RegisterHooksContext, registerHooks } from '../../register-hooks';
+import { BoardObjectsService } from '../../services/board-objects';
+import { ReposService } from '../../services/repos';
+import { configureRealtimePublish } from '../../utils/realtime-publish';
+import { createTenantDatabaseScopeAroundHook } from '../../utils/tenant-db-scope';
+import { registerBranchTools } from './branches';
+
+// Actual MCP -> ReposService -> wrapped CRUD -> publisher -> receiving publisher.
+// Only persistence/commit visibility, executor work, and the Redis wire are fakes.
+// No production files, branches, sockets, or credentials are used.
+const tenantId = 'tenant-a';
+const branchId = 'fixture-branch' as Branch['branch_id'];
+const boardId = 'fixture-board' as Branch['board_id'];
+const userId = 'fixture-reader';
+const zoneId = 'fixture-zone';
+const params = {
+  tenant: { tenant_id: tenantId, source: 'explicit' },
+  user: { user_id: userId, role: 'member' },
+} as HookContext['params'];
+
+type AfterHook = (context: HookContext) => HookContext | Promise<HookContext>;
+function creationHooks() {
+  const captured = new Map<string, AfterHook[]>();
+  registerHooks({
+    app: {
+      service(path: string) {
+        return {
+          hooks(hooks: { after?: { create?: AfterHook[] } }) {
+            if (hooks.after?.create) captured.set(path, hooks.after.create);
+          },
+        };
+      },
+      use() {},
+      publish() {},
+    },
+    db: {},
+    config: { multi_tenancy: { mode: 'static', static_tenant_id: tenantId } },
+    jwtSecret: 'fixture-only',
+    requireAuth: async (context: HookContext) => context,
+    superadminOpts: { allowSuperadmin: false },
+    sessionsService: {},
+    messagesService: {},
+    branchRepository: {},
+    usersRepository: {},
+    sessionsRepository: {},
+    deployment: { mode: 'standalone' },
+  } as unknown as RegisterHooksContext);
+  return captured;
+}
+
+async function fixture(options: { rollback?: boolean; storageMode?: 'clone' | 'worktree' } = {}) {
+  let committed = false;
+  let branch: Branch;
+  let placement: BoardEntityObject;
+  const trace: string[] = [];
+  const tx = { execute: vi.fn(async () => []) };
+  const db = {
+    execute: vi.fn(async () => []),
+    transaction: async (work: (scoped: typeof tx) => Promise<unknown>) => {
+      const result = await work(tx);
+      if (!committed) {
+        // Give automatic events a deterministic opportunity to reach daemon B
+        // BEFORE commit. This is exactly what nested Feathers CRUD used to do.
+        await new Promise((resolve) => setTimeout(resolve, 0));
+        if (options.rollback) throw new Error('fixture rollback');
+        committed = true;
+        trace.push('commit');
+      }
+      return result;
+    },
+  };
+  vi.spyOn(BranchRepository.prototype, 'findByRepoAndName').mockResolvedValue(null);
+  vi.spyOn(BranchRepository.prototype, 'getAllUsedUniqueIds').mockResolvedValue([]);
+  vi.spyOn(BoardObjectRepository.prototype, 'create').mockImplementation(async (data) => {
+    placement = {
+      ...data,
+      object_id: 'fixture-placement',
+      entity_type: 'branch',
+    } as BoardEntityObject;
+    return placement;
+  });
+
+  const source = feathers() as Application;
+  const remote = feathers() as Application;
+  for (const app of [source, remote]) app.configure(socketio());
+  source.set('config', { multi_tenancy: { mode: 'static', static_tenant_id: tenantId } });
+  const hooks = creationHooks();
+  source.use('branches', {
+    async create(data: Partial<Branch>) {
+      branch = { ...data, branch_id: branchId, archived: false } as Branch;
+      trace.push('insert:branch');
+      return branch;
+    },
+    async get() {
+      // The MCP readiness/ref-resolution read happens after the create scope.
+      expect(committed).toBe(true);
+      if (branch.filesystem_status === 'creating') {
+        await source.service('branches').patch(
+          branchId,
+          {
+            filesystem_status: 'ready',
+            base_ref: 'main',
+            base_sha: 'a'.repeat(40),
+          },
+          params
+        );
+      }
+      return branch;
+    },
+    async patch(_id: string, data: Partial<Branch>) {
+      branch = { ...branch, ...data };
+      return branch;
+    },
+  });
+  source.use('board-objects', new BoardObjectsService(db as never, source));
+  source.use('b
```

**File**: `apps/agor-daemon/src/register-hooks.ts` (modified, +8/-13)
```diff
@@ -183,7 +183,7 @@ import {
   validateSessionUnixUsername,
 } from './utils/branch-authorization.js';
 import { captureBranchRemovalRealtimeVisibility as captureBranchRemovalVisibility } from './utils/branch-removal-realtime.js';
-import { emitServiceEvent } from './utils/emit-service-event.js';
+import { emitServiceEvent, publishCommittedServiceEvent } from './utils/emit-service-event.js';
 import { bindPrimaryOwnerToCreatedBy, injectCreatedBy } from './utils/inject-created-by.js';
 import {
   captureMarketplaceInvalidationTargets as captureMarketplaceTargets,
@@ -2003,6 +2003,11 @@ export function registerHooks(ctx: RegisterHooksContext): void {
         boardObjectAccess('delete board objects'),
       ],
     },
+    after: {
+      // Repos/MCP creation inserts placement in the same outer transaction as
+      // the branch. Remote publishers must not authorize it before commit.
+      create: [publishCommittedServiceEvent],
+    },
   });
 
   // ============================================================================
@@ -2410,17 +2415,7 @@ export function registerHooks(ctx: RegisterHooksContext): void {
     // Feathers' automatic event fires when this nested method returns, not when
     // that transaction commits. Replace only this event with the existing queue;
     // rollback drops it, and successful commit emits it exactly once.
-    const event = context.event;
-    context.event = null;
-    emitServiceEvent(app, {
-      path: 'branches',
-      event,
-      method: context.method,
-      id: context.id,
-      data: context.dispatch ?? context.result,
-      params: context.params,
-    });
-    return context;
+    return publishCommittedServiceEvent(context);
   };
 
   app.service('branches').hooks({
@@ -2450,7 +2445,7 @@ export function registerHooks(ctx: RegisterHooksContext): void {
       ],
     },
     after: {
-      create: [invalidateRealtimeBranchFromResult],
+      create: [invalidateRealtimeBranchFromResult, publishCommittedServiceEvent],
       update: [
         invalidateRealtimeBranchFromResult,
         publishMarketplaceInvalidation,
```

**File**: `apps/agor-daemon/src/utils/emit-service-event.test.ts` (modified, +102/-2)
```diff
@@ -1,8 +1,9 @@
 import { readFileSync } from 'node:fs';
 import { runWithTenantDatabaseScope } from '@agor/core/db';
-import type { Application } from '@agor/core/feathers';
+import { type Application, feathers } from '@agor/core/feathers';
+import type { HookContext } from '@agor/core/types';
 import { describe, expect, it, vi } from 'vitest';
-import { emitServiceEvent } from './emit-service-event';
+import { emitServiceEvent, publishCommittedServiceEvent } from './emit-service-event';
 
 function makeApp(emit: (name: string, data: unknown, hook: unknown) => void) {
   const service = { emit };
@@ -96,6 +97,105 @@ describe('emitServiceEvent', () => {
   });
 });
 
+describe('publishCommittedServiceEvent', () => {
+  it('keeps bulk dispatch redaction, one event per row, and the original CRUD response', async () => {
+    const app = feathers();
+    const rows = [
+      { branch_id: 'a', private: true },
+      { branch_id: 'b', private: true },
+    ];
+    app.use('branches', {
+      async create() {
+        return rows;
+      },
+    });
+    app.service('branches').hooks({
+      after: {
+        create: [
+          (context: HookContext) => {
+            context.dispatch = rows.map(({ branch_id }) => ({ branch_id }));
+            return context;
+          },
+          publishCommittedServiceEvent,
+        ],
+      },
+    });
+    const received = vi.fn();
+    app.service('branches').on('created', received);
+    await runWithTenantDatabaseScope({ run() {} } as never, 'tenant-a', async () => {
+      expect(await app.service('branches').create({})).toBe(rows);
+      expect(received).not.toHaveBeenCalled();
+    });
+    expect(received).toHaveBeenCalledTimes(2);
+    expect(received.mock.calls.map(([row]) => row)).toEqual([
+      { branch_id: 'a' },
+      { branch_id: 'b' },
+    ]);
+    for (const [, hook] of received.mock.calls) {
+      expect(hook).toMatchObject({
+        path: 'branches',
+        event: 'created',
+        method: 'create',
+        params: { tenant: { tenant_id: 'tenant-a' } },
+      });
+    }
+  });
+
+  it('preserves explicit null dispatch without publishing the private result', async () => {
+    const app = feathers();
+    const row = { branch_id: 'a', private: true };
+    app.use('branches', {
+      async create() {
+        return row;
+      },
+    });
+    app.service('branches').hooks({
+      after: {
+        create: [
+          (context: HookContext) => {
+            context.dispatch = null;
+            return context;
+          },
+          publishCommittedServiceEvent,
+        ],
+      },
+    });
+    const received = vi.fn();
+    app.service('branches').on('created', received);
+    await runWithTenantDatabaseScope({ run() {} } as never, 'tenant-a', async () => {
+      expect(await app.service('branches').create({})).toBe(row);
+      expect(received).not.toHaveBeenCalled();
+    });
+    expect(received).toHaveBeenCalledOnce();
+    const [payload, hook] = received.mock.calls[0];
+    expect(payload).toBeNull();
+    expect(hook).toMatchObject({
+      result: null,
+      params: { tenant: { tenant_id: 'tenant-a' } },
+    });
+  });
+
+  it('does not re-enable a suppressed event', () => {
+    const context = { event: null, result: { branch_id: 'a' } } as HookContext;
+    expect(publishCommittedServiceEvent(context)).toBe(context);
+    expect(context.event).toBeNull();
+  });
+
+  it('emits once without an outer tenant transaction too', async () => {
+    const app = feathers();
+    app.use('board-objects', {
+      async create() {
+        return { object_id: 'placement' };
+      },
+    });
+    app.service('board-objects').hooks({ after: { create: [publishCommittedServiceEvent] } });
+    const received = vi.fn();
+    app.service('board-objects').on('created', received);
+    await app.service('board-objects').create({});
+    expect(received).toHaveBeenCalledOnce();
+  });
+});
+
 describe('board patch custom actions', () => {
   it('preserves the original hook params for every manually emitted patched event', () => {
     const source = readFileSync(new URL('../register-hooks.ts', import.meta.url), 'utf8');
```

**File**: `apps/agor-daemon/src/utils/emit-service-event.ts` (modified, +25/-0)
```diff
@@ -99,3 +99,28 @@ export function emitServiceEvent(app: Application, event: ManualServiceEvent): v
 
   if (!enqueueAfterTenantDatabaseCommit(emit)) emit();
 }
+
+/**
+ * Replace a CRUD after-hook's automatic event with commit-bound publication.
+ * A nested Feathers method returns before its caller's transaction commits;
+ * publishing then lets another daemon authorize against not-yet-visible rows.
+ * Keep the canonical event (including bulk results and dispatch redaction), not
+ * an extra patched event. Rollback discards the queued publication entirely.
+ */
+export function publishCommittedServiceEvent(context: HookContext): HookContext {
+  const event = context.event;
+  if (!event) return context;
+  context.event = null;
+  const data = context.dispatch !== undefined ? context.dispatch : context.result;
+  for (const row of Array.isArray(data) ? data : [data]) {
+    emitServiceEvent(context.app, {
+      path: context.path,
+      event,
+      method: context.method,
+      id: context.id,
+      data: row,
+      params: context.params,
+    });
+  }
+  return context;
+}
```

**File**: `apps/agor-ui/src/components/SessionCanvas/SessionCanvas.creation.browser.test.tsx` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
+import type { AgorClient, Board, BoardEntityObject, Branch, Repo } from '@agor-live/client';
+import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
+import { App } from 'antd';
+import 'reactflow/dist/style.css';
+import { afterEach, expect, it, vi } from 'vitest';
+import { shallow } from 'zustand/shallow';
+import { useStoreWithEqualityFn } from 'zustand/traditional';
+import { ConnectionProvider } from '../../contexts/ConnectionContext';
+import { EMPTY_MAPS } from '../../store/agorMaps';
+import { boardObjectCreated, branchCreated, branchPatched } from '../../store/agorRealtimeActions';
+import { agorStore } from '../../store/agorStore';
+import { makeBranchesForBoardSelector } from '../../store/selectors';
+import SessionCanvas from './SessionCanvas';
+
+afterEach(cleanup);
+
+it('renders an asynchronously created branch in its zone without remounting the open board', async () => {
+  const board = {
+    board_id: 'creation-board',
+    name: 'Creation fixture',
+    archived: false,
+    objects: {
+      'zone-tasks': {
+        type: 'zone',
+        x: 100,
+        y: 100,
+        width: 1400,
+        height: 700,
+        label: 'Coding Tasks',
+      },
+    },
+  } as unknown as Board;
+  const branch = {
+    branch_id: 'creation-branch',
+    board_id: board.board_id,
+    repo_id: 'creation-repo',
+    name: 'MCP-created fixture',
+    filesystem_status: 'creating',
+    archived: false,
+  } as Branch;
+  const placement = {
+    object_id: 'creation-placement',
+    board_id: board.board_id,
+    branch_id: branch.branch_id,
+    entity_type: 'branch',
+    zone_id: 'zone-tasks',
+    position: { x: 80, y: 120 },
+  } as BoardEntityObject;
+  const repo = { repo_id: branch.repo_id, slug: 'fixture/realtime' } as Repo;
+  agorStore.setState({ ...EMPTY_MAPS, repoById: new Map([[repo.repo_id, repo]]) });
+  const client = {
+    service: () => ({
+      find: async () => ({ data: [], capabilities: [] }),
+      get: async () => ({ capabilities: [] }),
+      on: vi.fn(),
+      off: vi.fn(),
+    }),
+  } as unknown as AgorClient;
+  const select = makeBranchesForBoardSelector(board.board_id);
+  function OpenBoard() {
+    const branches = useStoreWithEqualityFn(agorStore, select, shallow);
+    return <SessionCanvas board={board} branches={branches} client={client} height={700} />;
+  }
+  const view = render(
+    <App>
+      <ConnectionProvider
+        value={{
+          connected: true,
+          connecting: false,
+          authGeneration: 1,
+          outOfSync: false,
+          capturedSha: null,
+          currentSha: null,
+        }}
+      >
+        <div style={{ width: '100%', height: 700 }}>
+          <OpenBoard />
+        </div>
+      </ConnectionProvider>
+    </App>
+  );
+  expect(screen.queryByText(branch.name)).toBeNull();
+  await act(async () => branchCreated(branch));
+  expect(screen.queryByText(branch.name)).toBeNull(); // branch_id/board_id alone is not placement
+  await act(async () => boardObjectCreated(placement));
+  await screen.findByText(branch.name);
+  const ready = { ...branch, filesystem_status: 'ready' as const };
+  await act(async () => {
+    branchPatched(ready);
+    branchCreated(branch); // delayed duplicate cannot regress readiness
+    boardObjectCreated(placement);
+  });
+  await waitFor(() => {
+    const nodes = view.container.querySelectorAll<HTMLElement>(`[data-id="${branch.branch_id}"]`);
+    expect(nodes).toHaveLength(1);
+    expect(nodes[0].getBoundingClientRect().width).toBeGreaterThan(0);
+    // React Flow child coordinates include the zone origin, not a fallback
+    // near (0,0): zone (100,100) + relative placement (80,120).
+    expect(nodes[0].style.transform.replaceAll(' ', '')).toBe('translate(180px,220px)');
+  });
+  expect(agorStore.getState().branchById.get(branch.branch_id)?.filesystem_status).toBe('ready');
+  expect(agorStore.getState().boardObjectByBranchId.get(branch.branch_id)?.zone_id).toBe(
+    'zone-tasks'
+  );
+});
```

**File**: `apps/agor-ui/src/hooks/useAgorData.test.tsx` (modified, +49/-0)
```diff
@@ -23,6 +23,7 @@ import { agorStore } from '../store/agorStore';
 // Session `patched`/`updated` writes are coalesced to one flush per frame (see
 // realtimeBatch); flush synchronously in tests that assert the post-patch store.
 import { flushRealtimeNow } from '../store/realtimeBatch';
+import { makeBranchesForBoardSelector } from '../store/selectors';
 import { useAgorData } from './useAgorData';
 
 // The opened-transcript prefetch retains a real reactive session; the mock
@@ -1582,3 +1583,51 @@ describe('useAgorData — opened session transcript priority', () => {
     await waitFor(() => expect(fetchCount('sessions', 'findAll')).toBe(1));
   });
 });
+
+describe('branch creation on an already-open board', () => {
+  // The services are independently authorized/published, so readiness and
+  // placement may overtake the branch create. No order needs a refresh.
+  it.each([
+    ['branch', 'placement', 'ready'],
+    ['branch', 'ready', 'placement'],
+    ['placement', 'branch', 'ready'],
+    ['placement', 'ready', 'branch'],
+    ['ready', 'branch', 'placement'],
+    ['ready', 'placement', 'branch'],
+  ])('keeps one placed, ready card for %s -> %s -> %s', async (...order) => {
+    const { client, emit, fetchCount } = makeMockClient();
+    const { result, unmount } = renderHook(() => useAgorData(client));
+    try {
+      await waitForInitialLoad(result);
+      const select = makeBranchesForBoardSelector('board-1');
+      expect(select(agorStore.getState())).toEqual([]);
+      const beforeBranches = fetchCount('branches', 'findAll');
+      const beforePlacements = fetchCount('board-objects', 'findAll');
+      const branch = makeBranch({ board_id: 'board-1', filesystem_status: 'creating' });
+      const ready = { ...branch, filesystem_status: 'ready' };
+      const placement = makeBoardObject({ zone_id: 'zone-tasks' });
+      const events: Record<string, () => void> = {
+        branch: () => emit('branches', 'created', branch),
+        placement: () => emit('board-objects', 'created', placement),
+        ready: () => emit('branches', 'patched', ready),
+      };
+      for (const event of order) act(events[event]);
+      // Delayed/replayed creates must not roll back ready state or duplicate
+      // a placement. Branch updates do not carry the board-object record.
+      act(events.branch);
+      act(events.placement);
+      expect(select(agorStore.getState())).toEqual([ready]);
+      expect(agorStore.getState().boardObjectsByBoardId.get('board-1')).toEqual([placement]);
+      const moved = { ...placement, position: { x: 80, y: 120 }, zone_id: 'zone-review' };
+      act(() => emit('board-objects', 'patched', moved));
+      act(events.placement); // old create cannot undo newer placement
+      act(events.ready); // readiness never replaces placement
+      expect(agorStore.getState().boardObjectByBranchId.get(branch.branch_id)).toEqual(moved);
+      expect(select(agorStore.getState())).toHaveLength(1);
+      expect(fetchCount('branches', 'findAll')).toBe(beforeBranches);
+      expect(fetchCount('board-objects', 'findAll')).toBe(beforePlacements);
+    } finally {
+      unmount();
+    }
+  });
+});
```

**File**: `scripts/check-multitenancy-boundaries.mjs` (modified, +3/-0)
```diff
@@ -48,6 +48,9 @@ const checks = [
       // channel proves executor control events are registered by Feathers and
       // cross Socket.IO rather than only exercising the publisher directly.
       'apps/agor-daemon/src/register-services.tasks-events.test.ts': 4,
+      // MCP creation regression: two in-memory Feathers daemons with explicit
+      // tenant memberships prove post-commit relay and cross-tenant exclusion.
+      'apps/agor-daemon/src/mcp/tools/branches.realtime.test.ts': 3,
       'apps/agor-daemon/src/startup.ts': 1,
       'apps/agor-daemon/src/services/artifacts.test.ts': 1,
       'apps/agor-daemon/src/services/artifacts.ts': 1,
```

---

### Incident Patch 7: `dd5b80cf` (2026-10-02)
**Commit Message**: fix(branches): support safe archive cleanup on Cloud executors (#2968)

* fix(branches): support safe archive cleanup on Cloud executors

* docs(branches): clarify clone history loss on checkout removal

**File**: `apps/agor-daemon/src/mcp/branch-archive.test.ts` (modified, +5/-1)
```diff
@@ -55,7 +55,10 @@ for (const facade of [false, true]) {
         });
         const fixture = await archiveMcpFixture(db);
         try {
-          vi.mocked(requestExecutor).mockResolvedValue({ success: true, data: { exists: true } });
+          vi.mocked(requestExecutor).mockResolvedValue({
+            success: true,
+            data: { branchId: branch.branch_id, exists: true, kind: 'directory' },
+          });
           // No command token is used against a daemon: both executor boundaries are stubbed.
           Object.assign(fixture.app, {
             sessionTokenService: {
@@ -103,6 +106,7 @@ for (const facade of [false, true]) {
             workspace_operation: { status: files ? 'accepted' : 'succeeded' },
           });
           expect(spawnExecutor).toHaveBeenCalledTimes(files ? 1 : 0);
+          expect(requestExecutor).toHaveBeenCalledTimes(effectiveAction === 'cleaned' ? 1 : 0);
           if (files)
             expect(spawnExecutor).toHaveBeenCalledWith(
               expect.objectContaining({
```

**File**: `apps/agor-daemon/src/services/branches.clean.test.ts` (modified, +236/-13)
```diff
@@ -1,7 +1,10 @@
+import { getBranchesDir, getTenantDataRoot } from '@agor/core/config';
 import {
   BoardRepository,
   BranchRepository,
   CapabilityPolicyRepository,
+  createTenantScopedDatabaseProxy,
+  type Database,
   GroupRepository,
   generateId,
   RepoRepository,
@@ -11,7 +14,7 @@ import {
   UsersRepository,
 } from '@agor/core/db';
 import type { Application } from '@agor/core/feathers';
-import type { BranchID, EffectiveBranchAccess, Params, TenantID } from '@agor/core/types';
+import type { BranchID, EffectiveBranchAccess, Params, TenantID, UserID } from '@agor/core/types';
 import { capabilityPolicyPresetCapabilities } from '@agor/core/types';
 import { beforeEach, expect, vi } from 'vitest';
 import { seedEnvironmentCommandBranch } from '../../../../packages/core/src/db/repositories/environment-commands.test-support';
@@ -32,9 +35,16 @@ vi.mock('../utils/spawn-executor', () => ({
 const tenant = { tenant_id: 'default' as TenantID, source: 'explicit' as const };
 beforeEach(() => {
   vi.clearAllMocks();
-  vi.mocked(requestExecutor).mockResolvedValue({ success: true, data: { exists: true } });
+  vi.mocked(requestExecutor).mockImplementation(async (payload) => ({
+    success: true,
+    data: {
+      branchId: (payload.params as { branchId: BranchID }).branchId,
+      exists: true,
+      kind: 'directory',
+    },
+  }));
 });
-function setup(db: ConstructorParameters<typeof BranchesService>[0], allowSuperadmin = false) {
+function setup(db: Database, allowSuperadmin = false) {
   const archiveBranchSessions = vi.fn().mockResolvedValue({ count: 0 });
   const emit = vi.fn();
   const app = {
@@ -43,14 +53,24 @@ function setup(db: ConstructorParameters<typeof BranchesService>[0], allowSupera
     sessionTokenService: { generateCommandToken: vi.fn().mockResolvedValue('fixture-token') },
     service: () => ({ emit, archiveBranchSessions }),
   } as unknown as Application;
-  const service = new BranchesService(db, app);
-  vi.spyOn(service as never, 'resolveEnvironmentExecutorContext').mockResolvedValue({
-    env: {},
-    executionUserId: 'fixture',
-    branchFsAccess: 'write',
-    sandboxMounts: {},
-  } as never);
-  return { service, emit, archiveBranchSessions };
+  const service = new BranchesService(
+    createTenantScopedDatabaseProxy(db, { requireScope: true }),
+    app
+  );
+  const context = vi
+    .spyOn(
+      service as unknown as {
+        resolveEnvironmentExecutorContext: (typeof service)['resolveEnvironmentExecutorContext'];
+      },
+      'resolveEnvironmentExecutorContext'
+    )
+    .mockResolvedValue({
+      env: {},
+      executionUserId: 'fixture' as UserID,
+      branchFsAccess: 'write',
+      sandboxMounts: {},
+    });
+  return { service, app, emit, archiveBranchSessions, context };
 }
 
 test('clean rejects policy, protection, public overrides, and busy activity before dispatch; accepts only one worker', async ({
@@ -83,8 +103,13 @@ test('clean rejects policy, protection, public overrides, and busy activity befo
   await expect(service.clean(input, { user, tenant })).rejects.toThrow('environment is active');
   expect(spawnExecutor).not.toHaveBeenCalled();
   await branches.update(branch.branch_id, { environment_instance: { status: 'stopped' } });
-  vi.mocked(requestExecutor).mockResolvedValueOnce({ success: true, data: { exists: false } });
-  await expect(service.clean(input, { user, tenant })).rejects.toThrow('unavailable');
+  vi.mocked(requestExecutor).mockResolvedValueOnce({
+    success: true,
+    data: { branchId: branch.branch_id, exists: false, kind: 'missing' },
+  });
+  await expect(service.clean(input, { user, tenant })).rejects.toThrow(
+    'not visible to the executor'
+  );
   const result = await service.clean(input, { user, tenant });
   expect(result.status).toBe('accepted');
   expect(spawnExecutor).toHaveBeenCalledOnce();
@@ -101,6 +126,18 @@ test('clean rejects policy, protection, public overrides, and busy activity befo
   expect((await branches.findById(branch.branch_id))?.archived).toBe(false);
   expect((await branches.findById(branch.branch_id))?.filesystem_status).toBe('ready');
   await expect(service.clean(input, { user, tenant })).rejects.toThrow('already active');
+  const archiveParams = { user, tenant };
+  markBranchArchiveDeleteAuthorized(archiveParams, branch.branch_id, 'archive');
+  await expect(
+    service.archiveOrDelete(
+      branch.branch_id,
+      {
+        metadataAction: 'archive',
+        filesystemAction: 'preserved',
+      },
+      archiveParams
+    )
+  ).rejects.toThrow('already active');
   expect(spawnExecutor).toHaveBeenCalledOnce();
 });
 
@@ -195,6 +232,7 @@ test('archive removal uses the shared workspace worker and does not claim filesy
     expect.anything()
   );
   const sent = vi.mocked(spawnExecutor).mock.calls[0]![0] as { params: Record<string, unknown> };
+  expect(requestExecutor).not.toHaveBeenCalled();
   expect(sent.params).not.toHaveProperty('cwd');
   expect
```

**File**: `apps/agor-daemon/src/services/branches.ts` (modified, +55/-31)
```diff
@@ -130,6 +130,7 @@ import {
   withoutPrefetchedRecord,
 } from '../utils/branch-authorization.js';
 import { ensureBranchWorkspaceAccess } from '../utils/branch-workspace-path.js';
+import { verifyBranchWorkspacePreflight } from '../utils/branch-workspace-preflight.js';
 import { emitServiceEvent } from '../utils/emit-service-event.js';
 import { dispatchEnvironmentCommand } from '../utils/environment-command-dispatch.js';
 import { resolveDelegatedExecutionHomeKey } from '../utils/executor-delegated-home.js';
@@ -1867,16 +1868,10 @@ export class BranchesService extends DrizzleService<Branch, Partial<Branch>, Bra
       );
     const config = this.app.get('config');
     const needsFiles = filesystemAction !== 'preserved';
-    if (
-      needsFiles &&
-      (config.execution?.unix_user_mode === 'delegated' ||
-        config.execution?.executor_command_template ||
-        (config.deployment?.mode === 'ha' &&
-          config.deployment.ha?.execution_topology === 'external'))
-    )
-      throw new Conflict(
-        'Workspace maintenance requires supported local executor containment; delegated execution is not supported'
-      );
+    const externalExecutor =
+      config.execution?.unix_user_mode === 'delegated' ||
+      Boolean(config.execution?.executor_command_template) ||
+      (config.deployment?.mode === 'ha' && config.deployment.ha?.execution_topology === 'external');
     const branch = await this.withTenantDatabase(params, () => this.get(id, params));
     const authorize = async (repository: BranchRepository, current: Branch) => {
       if (needsFiles)
@@ -1905,6 +1900,10 @@ export class BranchesService extends DrizzleService<Branch, Partial<Branch>, Bra
     };
     id = branch.branch_id;
     await this.withTenantDatabase(params, () => authorize(this.branchRepo, branch));
+    if (needsFiles && externalExecutor && branch.storage_mode !== 'clone')
+      throw new Conflict(
+        'External workspace cleanup/removal requires a self-contained clone. Use Leave untouched for a legacy linked worktree.'
+      );
     const repo = await this.withTenantDatabase(params, () =>
       new RepoRepository(this.db).findById(branch.repo_id)
     );
@@ -1915,7 +1914,12 @@ export class BranchesService extends DrizzleService<Branch, Partial<Branch>, Bra
     const validate = async (tx: import('@agor/core/db').Database) => {
       const repository = new BranchRepository(tx);
       const current = await repository.findById(id);
-      if (!current || current.path !== branch.path || current.repo_id !== branch.repo_id)
+      if (
+        !current ||
+        current.path !== branch.path ||
+        current.repo_id !== branch.repo_id ||
+        current.storage_mode !== branch.storage_mode
+      )
         throw new Conflict('Branch location changed; refresh before maintenance');
       await authorize(repository, current);
       if (policy) {
@@ -1974,36 +1978,44 @@ export class BranchesService extends DrizzleService<Branch, Partial<Branch>, Bra
               now.getTime() + BRANCH_WORKSPACE_OPERATION_BUDGET_MS
             ).toISOString(),
           },
-          { repo_id: branch.repo_id, path: branch.path, repo_path: repo.local_path ?? '', policy }
+          {
+            repo_id: branch.repo_id,
+            path: branch.path,
+            repo_path: repo.local_path ?? '',
+            storage_mode: branch.storage_mode,
+            policy,
+          }
         )
       );
       const context = needsFiles
         ? await this.resolveEnvironmentExecutorContext(branch, params)
         : undefined;
-      if (needsFiles) {
+      if (filesystemAction === 'cleaned') {
         // Read-only executor preflight. No daemon filesystem access or fallback mkdir.
+        // Removal deliberately skips this probe: its storage owner verifies the
+        // managed root and absence, including an already-absent checkout on retry.
         const statusToken = await this.withTenantDatabase(params, () =>
           issueExecutorCommandToken(this.app, 'branch-filesystem-status', user.user_id, id)
         );
-        const status = await requestExecutor(
-          {
-            command: 'branch.filesystem.status',
-            sessionToken: statusToken,
-            daemonUrl: getDaemonUrl(),
-            params: { branchId: id },
-          },
-          {
-            preparedEnv: context!.env,
-            templateVariables: { branch_id: id, user_id: user.user_id, branch_fs_access: 'write' },
-          }
+        await verifyBranchWorkspacePreflight(id, () =>
+          requestExecutor(
+            {
+              command: 'branch.filesystem.status',
+              sessionToken: statusToken,
+              daemonUrl: getDaemonUrl(),
+              params: { branchId: id },
+            },
+            {
+              preparedEnv: context!.env,
+              delegatedHomeKey: context!.delegatedHomeKey,
+              templateVariables: {
+                branch_id: id,
+                user_
```

**File**: `apps/agor-daemon/src/utils/branch-workspace-preflight.test.ts` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+import type { ExecutorCommandResult } from '@agor/core/executor-protocol';
+import type { BranchID } from '@agor/core/types';
+import { expect, it } from 'vitest';
+import { verifyBranchWorkspacePreflight } from './branch-workspace-preflight';
+
+const branchId = '01900000-0000-7000-8000-000000000001' as BranchID;
+const directory = { branchId, exists: true, kind: 'directory' };
+
+it('accepts the single-branch executor status envelope', async () => {
+  await expect(
+    verifyBranchWorkspacePreflight(branchId, async () => ({
+      success: true,
+      data: directory,
+    }))
+  ).resolves.toBeUndefined();
+});
+
+it.each([
+  [undefined, 'invalid filesystem status'],
+  [{ statuses: [directory] }, 'invalid filesystem status'],
+  [{ ...directory, branchId: 'another-branch' }, 'invalid filesystem status'],
+  [{ exists: true }, 'invalid filesystem status'],
+  [{ ...directory, exists: 'true' }, 'invalid filesystem status'],
+  [{ ...directory, exists: false }, 'invalid filesystem status'],
+  [{ branchId, exists: false, kind: 'missing' }, 'not visible to the executor'],
+  [{ ...directory, kind: 'file' }, 'not a directory'],
+  [{ ...directory, kind: 'other' }, 'not a directory'],
+])('rejects unavailable or invalid data %j without claiming cleanup', async (data, reason) => {
+  await expect(
+    verifyBranchWorkspacePreflight(branchId, async () => ({ success: true, data }))
+  ).rejects.toThrow(reason);
+});
+
+it.each([
+  ['EXECUTOR_TIMEOUT', 'did not respond in time'],
+  ['EXECUTOR_SPAWN_ERROR', 'could not start'],
+  ['EXECUTOR_RESPONSE_UNSUPPORTED', 'does not support filesystem status responses'],
+  ['UNKNOWN_COMMAND', 'does not support filesystem status'],
+  ['BRANCH_FILESYSTEM_STATUS_FAILED', 'could not inspect'],
+  ['UNREVIEWED_SECRET_CODE', 'failed to return a usable status'],
+  ['__proto__', 'failed to return a usable status'],
+])('classifies %s without leaking executor diagnostics', async (code, reason) => {
+  const result: ExecutorCommandResult = {
+    success: false,
+    data: directory, // Failure wins even if there is data.
+    error: { code, message: 'SECRET raw launcher output', details: { token: 'SECRET' } },
+  };
+  const outcome = verifyBranchWorkspacePreflight(branchId, async () => result);
+  await expect(outcome).rejects.toThrow(reason);
+  await expect(outcome).rejects.toThrow('No archive or file changes were made');
+  await expect(outcome).rejects.toThrow('filesystemAction: preserved');
+  await expect(outcome).rejects.not.toThrow('SECRET');
+});
+
+it('sanitizes a rejected transport promise and offers explicit metadata-only archival', async () => {
+  const outcome = verifyBranchWorkspacePreflight(branchId, async () => {
+    throw new Error('SECRET connection URL');
+  });
+  await expect(outcome).rejects.toThrow('could not be reached');
+  await expect(outcome).rejects.not.toThrow('SECRET');
+});
+
+it.each([undefined, null, { success: 'true' }])(
+  'rejects a malformed response envelope %j',
+  async (response) => {
+    await expect(
+      verifyBranchWorkspacePreflight(
+        branchId,
+        async () => response as unknown as ExecutorCommandResult
+      )
+    ).rejects.toThrow('invalid status response');
+  }
+);
```

**File**: `apps/agor-daemon/src/utils/branch-workspace-preflight.ts` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+import type { ExecutorCommandResult } from '@agor/core/executor-protocol';
+import { Conflict } from '@agor/core/feathers';
+import type { BranchID } from '@agor/core/types';
+
+// Only reviewed categories reach the caller: launcher/OS error text can contain
+// credentials, commands or paths. A failed probe is never proof of absent files.
+const failureReasons: Readonly<Record<string, string>> = {
+  EXECUTOR_TIMEOUT: 'The filesystem executor did not respond in time. Check executor connectivity.',
+  EXECUTOR_SPAWN_ERROR:
+    'The filesystem executor could not start. Check launcher configuration and execution identity.',
+  EXECUTOR_RESPONSE_UNSUPPORTED:
+    'The launcher does not support filesystem status responses. Check the executor response configuration.',
+  UNKNOWN_COMMAND:
+    'The executor does not support filesystem status. Check daemon/executor version compatibility.',
+  BRANCH_FILESYSTEM_STATUS_FAILED:
+    'The executor could not inspect the branch checkout. Check execution identity, file access and storage mounts.',
+};
+
+/** Read-only admission check, before archive metadata or destructive dispatch. */
+export async function verifyBranchWorkspacePreflight(
+  branchId: BranchID,
+  probe: () => Promise<ExecutorCommandResult>
+): Promise<void> {
+  function fail(reason: string): never {
+    throw new Conflict(
+      `${reason} No archive or file changes were made by this request. ` +
+        'To archive without touching files, choose Archive → Leave untouched (filesystemAction: preserved).'
+    );
+  }
+  let status: ExecutorCommandResult;
+  try {
+    status = await probe();
+  } catch {
+    fail(
+      'The filesystem executor could not be reached. Check executor connectivity and launcher configuration.'
+    );
+  }
+  if (!status || typeof status !== 'object' || typeof status.success !== 'boolean') {
+    fail(
+      'The executor returned an invalid status response. Check daemon/executor version compatibility.'
+    );
+  }
+  if (!status.success) {
+    fail(
+      (status.error?.code &&
+        Object.hasOwn(failureReasons, status.error.code) &&
+        failureReasons[status.error.code]) ||
+        'The filesystem executor failed to return a usable status. Check executor connectivity, identity and storage mounts.'
+    );
+  }
+  const data = status.data;
+  if (
+    !data ||
+    typeof data !== 'object' ||
+    Array.isArray(data) ||
+    !('branchId' in data) ||
+    data.branchId !== branchId ||
+    !('exists' in data) ||
+    typeof data.exists !== 'boolean' ||
+    !('kind' in data) ||
+    typeof data.kind !== 'string' ||
+    (data.exists ? !['directory', 'file', 'other'].includes(data.kind) : data.kind !== 'missing')
+  ) {
+    fail(
+      'The executor returned an invalid filesystem status. Check daemon/executor version compatibility.'
+    );
+  }
+  if (!data.exists) {
+    fail(
+      'The branch checkout directory is not visible to the executor. It may be missing or its storage may not be mounted.'
+    );
+  }
+  if (data.kind !== 'directory') {
+    fail('The branch checkout path is not a directory. Check the branch storage location.');
+  }
+}
```

**File**: `apps/agor-docs/content/guide/branches.mdx` (modified, +20/-3)
```diff
@@ -291,6 +291,8 @@ When a feature ships and the PR merges, you usually want to clean up disk withou
   style={{ maxWidth: '400px' }}
 />
 
+**Workspace** here means the branch’s on-disk Git checkout, not your Cloud tenant.
+
 **Filesystem options:**
 
 - **Leave untouched**: Metadata-only archival. Files stay on disk.
@@ -354,12 +356,27 @@ retried. After six minutes without a final report, reads display an unknown outc
 Archive Clean uses the same executor cycle and policy. Archive metadata may already
 be saved when a filesystem command fails; filesystem status changes only after
 verified success. Preserve and explicit workspace deletion retain conversation data
-and SDK homes. Workspace removal retains Git refs; it is not branch-history deletion.
+and SDK homes. Workspace removal does not delete refs in a separate shared repository
+or on a remote. However, deleting a clone removes its entire checkout, including
+`.git`: clone-local refs, stashes, and unpushed history can be lost. Push any history
+you need to retain before deleting the checkout.
 Permanent deletion remains the separate full-resource workflow.
 
 Agor checks known task, upload and environment activity. Terminal closure is best-effort;
-detached/unmanaged processes are **not proven stopped**. Archive Clean and explicit
-workspace removal reject delegated/external executors when they would change files.
+detached/unmanaged processes are **not proven stopped**. Delegated/external executors
+support the fixed cleanup command and explicit checkout removal for self-contained
+clones, with verified tenant worktrees/repositories mounts. Missing or inconsistent
+mounts fail closed; an empty executor image directory is not proof of deletion.
+Legacy linked worktrees remain unsupported on external executors. This requires
+matching daemon/executor support; the separate delegated permanent-deletion flag
+does not enable or disable archive cleanup.
+
+Cleanup checks that the checkout is visible before archiving. Executor connectivity,
+unsupported responses, and inaccessible storage are errors, not proof that files
+are absent. Explicit checkout removal instead verifies its managed storage root
+and the checkout's final absence in the removal worker, so an already-absent checkout
+can complete successfully. Leave untouched needs no filesystem executor and never
+claims to free disk space.
 Branch `updated_at` is metadata activity, not evidence of filesystem inactivity.
 There is no scheduler or age cutoff.
 
```

**File**: `packages/core/src/db/repositories/branch-workspace-operations.test.ts` (modified, +30/-0)
```diff
@@ -184,3 +184,33 @@ test('pre-dispatch failures settle visibly, but cannot release an invocation', a
   await expect(cleanup.failBeforeExecution(next.claim)).rejects.toThrow('must settle');
   await expect(maintenance.release(next.claim)).rejects.toThrow('containment');
 });
+
+test('launch rejects a storage-mode mismatch in the admitted snapshot', async ({ db }) => {
+  const { branch, user } = await seedEnvironmentCommandBranch(db);
+  const maintenance = new BranchMaintenanceRepository(db);
+  const operations = new BranchWorkspaceOperationRepository(db);
+  const { claim } = await maintenance.claim(branch.branch_id, 'cleanup', user.user_id);
+  await operations.prepare(
+    claim,
+    {
+      operation_id: claim.operation_id,
+      action: 'archive',
+      filesystem_action: 'deleted',
+      status: 'accepted',
+      requested_by: user.user_id,
+      requested_at: new Date().toISOString(),
+      deadline_at: new Date(Date.now() + 60_000).toISOString(),
+    },
+    {
+      repo_id: branch.repo_id,
+      path: branch.path,
+      repo_path: '/tmp/environment-test',
+      storage_mode: 'clone',
+    }
+  );
+  await expect(
+    maintenance.withClaim(claim, (tx) => operations.validateLaunch(tx, claim))
+  ).rejects.toThrow('location changed');
+  await operations.failBeforeExecution(claim);
+  await expect(maintenance.claim(branch.branch_id, 'cleanup', user.user_id)).resolves.toBeDefined();
+});
```

**File**: `packages/core/src/db/repositories/branch-workspace-operations.ts` (modified, +2/-1)
```diff
@@ -79,6 +79,7 @@ export class BranchWorkspaceOperationRepository {
       !repo ||
       row.repo_id !== snapshot.repo_id ||
       row.data.path !== snapshot.path ||
+      (snapshot.storage_mode !== undefined && row.storage_mode !== snapshot.storage_mode) ||
       repo.local_path !== snapshot.repo_path
     )
       throw new RepositoryError('Workspace location changed before execution');
@@ -176,7 +177,7 @@ export class BranchWorkspaceOperationRepository {
             ? undefined
             : outcome === 'unknown'
               ? 'Workspace command outcome is unknown. The branch remains fenced pending reconciliation.'
-              : 'Workspace command failed. Files may already have changed; there is no undo.';
+              : 'Workspace command failed. Check executor storage mounts, checkout type and cleanup policy before retrying. Files may already have changed; there is no undo.';
         const cleanup = operation.filesystem_action === 'cleaned';
         await update(tx, branches)
           .set({
```

---

### Incident Patch 8: `84473162` (2026-10-02)
**Commit Message**: fix(daemon): let branch members render environments (#2933)

renderEnvironment checks the caller's branch permission, then saves the rendered commands through this.patch with the caller's params. With provider still set, the branches patch hooks treat that save as a direct env command edit and require admin, so a member with all permission always got the admin error and could never get a start command. Save the rendered snapshot as an internal write instead. The env policy hook still validates it.

Fixes #2803

**File**: `apps/agor-daemon/src/services/branches.test.ts` (modified, +24/-0)
```diff
@@ -27,6 +27,7 @@ import {
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
 import { dbTest } from '../../../../packages/core/src/db/test-helpers';
 import { DrizzleService } from '../adapters/drizzle';
+import { requireAdminForEnvConfig } from '../utils/authorization.js';
 import { markBranchArchiveDeleteAuthorized } from '../utils/branch-archive-delete-authorization.js';
 import { requestExecutor, spawnExecutor } from '../utils/spawn-executor.js';
 import { BRANCH_MATERIALIZATION_INTENT, BranchesService } from './branches';
@@ -1778,6 +1779,29 @@ describe('BranchesService.find SQL pushdown', () => {
   });
 });
 
+describe('BranchesService.renderEnvironment through the registered service', () => {
+  it('lets a member who passed the control gate persist the rendered commands', async () => {
+    const { service, patchSpy } = createRenderEnvHarness({ current: null, status: 'stopped' });
+    const app = feathers() as Application;
+    app.use('branches', service);
+    const branches = app.service('branches') as unknown as BranchesService;
+    // The same admin-only guard the real branches patch chain runs.
+    branches.hooks({ before: { patch: [requireAdminForEnvConfig()] } });
+
+    await expect(
+      branches.renderEnvironment('wt-1' as BranchID, { variant: 'dev' }, {
+        provider: 'rest',
+        user: { user_id: 'user-member', role: 'member' },
+      } as never)
+    ).resolves.toBeDefined();
+    expect(patchSpy).toHaveBeenCalledWith(
+      'wt-1',
+      expect.objectContaining({ environment_variant: 'dev', start_command: 'echo dev' }),
+      expect.anything()
+    );
+  });
+});
+
 describe('BranchesService.renderEnvironment running-guard', () => {
   it('rejects conflicting tenant identity before rendering or clearing a snapshot', async () => {
     const { service, patchSpy } = createRenderEnvHarness({ current: 'dev', status: 'stopped' });
```

**File**: `apps/agor-daemon/src/services/branches.ts` (modified, +5/-1)
```diff
@@ -3025,6 +3025,10 @@ export class BranchesService extends DrizzleService<Branch, Partial<Branch>, Bra
       app: snapshot.app,
     });
 
+    // Persist as an internal write. The caller already passed the control gate
+    // above and the values come from the repo's admin-managed templates, so the
+    // patch hooks must not re-check them as a direct env command edit, which
+    // is admin-only (#2803). The env policy hook still runs on internal calls.
     return await this.withTenantDatabase(params, () =>
       this.patch(
         id,
@@ -3038,7 +3042,7 @@ export class BranchesService extends DrizzleService<Branch, Partial<Branch>, Bra
           app_url: snapshot.app,
           updated_at: new Date().toISOString(),
         },
-        params
+        { ...params, provider: undefined }
       )
     );
   }
```

---

### Incident Patch 9: `d0f67bbe` (2026-10-02)
**Commit Message**: feat(ui): move the external app link from the logo to the settings menu (#2961)

The navbar logo goes Home again. The deployment-configured link becomes an
entry with an external-link icon that opens in a new tab: last item of the
desktop settings menu, a row in the mobile More sheet, and an avatar-menu
entry on Knowledge and full-screen artifact pages (which have no settings
menu). Rename daemon.navbarLogoLink/navbarLogoTooltip (env NAVBAR_LOGO_*)
to daemon.externalAppLink/externalAppLabel (env EXTERNAL_APP_*); nothing
sets the old names yet.

Refs preset-io/agor-cloud#797

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `apps/agor-daemon/src/health/instance.test.ts` (modified, +10/-1)
```diff
@@ -17,7 +17,12 @@ import { afterEach, beforeEach, describe, expect, it } from 'vitest';
 import { authenticatedHealthInstance, publicHealthInstance } from './instance';
 
 const config: AgorConfig = {
-  daemon: { instanceLabel: 'config-label', instanceDescription: 'Shared **description**' },
+  daemon: {
+    instanceLabel: 'config-label',
+    instanceDescription: 'Shared **description**',
+    externalAppLink: 'https://console.example.test/',
+    externalAppLabel: 'Open Agor Cloud',
+  },
 };
 
 describe('/health instance', () => {
@@ -46,11 +51,15 @@ describe('/health instance', () => {
     await expect(authenticatedHealthInstance(config, readTenant)).resolves.toEqual({
       label: 'Tenant label',
       description: 'Shared **description**',
+      externalAppLink: 'https://console.example.test/',
+      externalAppLabel: 'Open Agor Cloud',
     });
     expect(JSON.stringify(publicHealthInstance(config))).not.toContain('Tenant label');
     expect(publicHealthInstance(config)).toEqual({
       label: 'config-label',
       description: 'Shared **description**',
+      externalAppLink: 'https://console.example.test/',
+      externalAppLabel: 'Open Agor Cloud',
     });
   });
 
```

**File**: `apps/agor-daemon/src/health/instance.ts` (modified, +4/-4)
```diff
@@ -11,17 +11,17 @@ import type { TenantDisplay } from '@agor/core/types';
 export interface HealthInstance {
   label?: string;
   description?: string;
-  navbarLogoLink?: string;
-  navbarLogoTooltip?: string;
+  externalAppLink?: string;
+  externalAppLabel?: string;
 }
 
 /** Pre-login instance identity: deployment config, never tenant data. */
 export function publicHealthInstance(config: AgorConfig): HealthInstance {
   return {
     label: config.daemon?.instanceLabel,
     description: config.daemon?.instanceDescription,
-    navbarLogoLink: config.daemon?.navbarLogoLink,
-    navbarLogoTooltip: config.daemon?.navbarLogoTooltip,
+    externalAppLink: config.daemon?.externalAppLink,
+    externalAppLabel: config.daemon?.externalAppLabel,
   };
 }
 
```

**File**: `apps/agor-ui/src/App.tsx` (modified, +8/-2)
```diff
@@ -2051,6 +2051,8 @@ function AppContent() {
       currentUser={currentUser}
       onUserSettingsClick={() => setOpenUserSettings(true)}
       onLogout={logout}
+      externalAppLink={headerInstanceConfig?.externalAppLink}
+      externalAppLabel={headerInstanceConfig?.externalAppLabel}
     />
   );
 
@@ -2060,6 +2062,8 @@ function AppContent() {
       currentUser={currentUser}
       onUserSettingsClick={() => setOpenUserSettings(true)}
       onLogout={logout}
+      externalAppLink={headerInstanceConfig?.externalAppLink}
+      externalAppLabel={headerInstanceConfig?.externalAppLabel}
     />
   );
 
@@ -2168,8 +2172,8 @@ function AppContent() {
       onRetryConnection={retryConnection}
       instanceLabel={headerInstanceConfig?.label}
       instanceDescription={headerInstanceConfig?.description}
-      navbarLogoLink={headerInstanceConfig?.navbarLogoLink}
-      navbarLogoTooltip={headerInstanceConfig?.navbarLogoTooltip}
+      externalAppLink={headerInstanceConfig?.externalAppLink}
+      externalAppLabel={headerInstanceConfig?.externalAppLabel}
       webTerminalEnabled={featuresConfig?.webTerminal === true}
       branchStorageConfig={featuresConfig?.branchStorage}
       uploadPolicy={featuresConfig?.uploadPolicy}
@@ -2376,6 +2380,8 @@ function AppContent() {
                   onToggleReaction={handleToggleReaction}
                   onDeleteComment={handleDeleteComment}
                   onLogout={logout}
+                  externalAppLink={headerInstanceConfig?.externalAppLink}
+                  externalAppLabel={headerInstanceConfig?.externalAppLabel}
                   onOpenWorkspaceSettings={setSettingsTabToOpen}
                   onOpenUserSettings={() => setOpenUserSettings(true)}
                   onOpenAgenticToolSettings={(tool) => {
```

**File**: `apps/agor-ui/src/components/App/App.tsx` (modified, +7/-7)
```diff
@@ -274,9 +274,9 @@ export interface AppProps {
   instanceLabel?: string;
   /** Instance description (markdown) shown in popover around the instance label */
   instanceDescription?: string;
-  /** Navbar logo destination; the logo goes Home when unset */
-  navbarLogoLink?: string;
-  navbarLogoTooltip?: string;
+  /** Settings-menu link to an external app, opened in a new tab */
+  externalAppLink?: string;
+  externalAppLabel?: string;
   /** Whether the web terminal is enabled on this instance (execution.allow_web_terminal) */
   webTerminalEnabled?: boolean;
   branchStorageConfig?: BranchStorageConfig;
@@ -391,8 +391,8 @@ export const App: React.FC<AppProps> = ({
   onReopenOnboarding,
   instanceLabel,
   instanceDescription,
-  navbarLogoLink,
-  navbarLogoTooltip,
+  externalAppLink,
+  externalAppLabel,
   webTerminalEnabled = false,
   branchStorageConfig,
   uploadPolicy,
@@ -1462,8 +1462,8 @@ export const App: React.FC<AppProps> = ({
           onUserClick={handleHeaderUserClick}
           instanceLabel={instanceLabel}
           instanceDescription={instanceDescription}
-          navbarLogoLink={navbarLogoLink}
-          navbarLogoTooltip={navbarLogoTooltip}
+          externalAppLink={externalAppLink}
+          externalAppLabel={externalAppLabel}
           onCreateSession={stableOnCreateSession}
         />
         {topBanner}
```

**File**: `apps/agor-ui/src/components/AppHeader/AppHeader.test.tsx` (modified, +36/-15)
```diff
@@ -35,8 +35,12 @@ vi.mock('../ConnectionStatus', () => ({
 vi.mock('../GlobalSearch', () => ({
   GlobalSearch: () => <div data-testid="global-search" />,
 }));
+const globalUserMenuProps = vi.hoisted(() => [] as Array<{ externalAppLink?: string }>);
 vi.mock('../GlobalUserMenu', () => ({
-  GlobalUserMenu: () => <div data-testid="global-user-menu" />,
+  GlobalUserMenu: (props: { externalAppLink?: string }) => {
+    globalUserMenuProps.push(props);
+    return <div data-testid="global-user-menu" />;
+  },
 }));
 vi.mock('../MarkdownRenderer', () => ({
   MarkdownRenderer: () => <div data-testid="markdown-renderer" />,
@@ -253,31 +257,48 @@ describe('AppHeader instance label', () => {
   });
 });
 
-describe('AppHeader navbar logo', () => {
-  it('goes Home by default', () => {
+describe('AppHeader external app link', () => {
+  function openSettingsMenu(props?: Partial<React.ComponentProps<typeof AppHeader>>) {
+    renderHeader(props);
+    fireEvent.click(screen.getByRole('button', { name: 'Settings menu' }));
+  }
+
+  it('keeps the logo going Home when a link is configured', () => {
     const onHomeClick = vi.fn();
-    renderHeader({ onHomeClick });
+    renderHeader({ onHomeClick, externalAppLink: 'https://console.example.test' });
 
     fireEvent.click(screen.getByRole('button', { name: 'Go to Home' }));
     expect(onHomeClick).toHaveBeenCalledOnce();
   });
 
-  it('links to the configured destination with its tooltip as the name', () => {
+  it('adds the labeled link to the settings menu, opening in a new tab', async () => {
+    openSettingsMenu({
+      externalAppLink: 'https://console.example.test',
+      externalAppLabel: 'Open Agor Cloud',
+    });
+
+    const link = await screen.findByRole('link', { name: 'Open Agor Cloud' });
+    expect(link).toHaveAttribute('href', 'https://console.example.test');
+    expect(link).toHaveAttribute('target', '_blank');
+  });
+
+  it('does not repeat the entry in the avatar menu', () => {
     renderHeader({
-      navbarLogoLink: 'https://console.example.test',
-      navbarLogoTooltip: 'Back to Agor Cloud console',
+      externalAppLink: 'https://console.example.test',
+      externalAppLabel: 'Open Agor Cloud',
     });
 
-    expect(screen.getByRole('link', { name: 'Back to Agor Cloud console' })).toHaveAttribute(
-      'href',
-      'https://console.example.test'
-    );
-    expect(screen.queryByRole('button', { name: 'Go to Home' })).not.toBeInTheDocument();
+    expect(screen.getByTestId('global-user-menu')).toBeInTheDocument();
+    expect(globalUserMenuProps.at(-1)?.externalAppLink).toBeUndefined();
   });
 
-  it('ignores a non-http(s) destination', () => {
-    renderHeader({ navbarLogoLink: 'javascript:alert(1)' });
+  it('omits the entry for a non-http(s) link', async () => {
+    openSettingsMenu({
+      externalAppLink: 'javascript:alert(1)',
+      externalAppLabel: 'Open Agor Cloud',
+    });
 
-    expect(screen.getByRole('button', { name: 'Go to Home' })).toBeInTheDocument();
+    expect(await screen.findByText('Settings')).toBeInTheDocument();
+    expect(screen.queryByText('Open Agor Cloud')).not.toBeInTheDocument();
   });
 });
```

**File**: `apps/agor-ui/src/components/AppHeader/AppHeader.tsx` (modified, +39/-37)
```diff
@@ -1,10 +1,11 @@
 import type { ActiveUser, AgorClient, Board, BoardID, Branch, User } from '@agor-live/client';
 import { hasMinimumRole, ROLES } from '@agor-live/client';
-import { BulbOutlined, ShopOutlined } from '@ant-design/icons';
+import { BulbOutlined, ExportOutlined, ShopOutlined } from '@ant-design/icons';
 import type { MenuProps } from 'antd';
 import { Button, Divider, Layout, Popover, Space, Tag, Tooltip, theme } from 'antd';
 import { type CSSProperties, memo, useMemo } from 'react';
 import { useHref, useNavigate } from 'react-router-dom';
+import { resolveExternalAppLink } from '@/utils/externalAppLink';
 import { mapToArray } from '@/utils/mapHelpers';
 import { useConnectionDisabled } from '../../contexts/ConnectionContext';
 import { useMCPCatalogModal } from '../../contexts/MCPCatalogModalContext';
@@ -37,17 +38,6 @@ const INSTANCE_LABEL_STYLE: CSSProperties = {
   verticalAlign: 'middle',
 };
 
-const logoStyle: CSSProperties = {
-  height: 54,
-  padding: 0,
-  display: 'flex',
-  alignItems: 'center',
-  gap: 10,
-  background: 'transparent',
-  border: 0,
-  cursor: 'pointer',
-};
-
 export interface AppHeaderProps {
   user?: User | null;
   authenticationGeneration?: number;
@@ -81,9 +71,9 @@ export interface AppHeaderProps {
   instanceLabel?: string;
   /** Instance description (markdown) shown in popover around the instance label */
   instanceDescription?: string;
-  /** Navbar logo destination (e.g. a hosting console); the logo goes Home when unset */
-  navbarLogoLink?: string;
-  navbarLogoTooltip?: string;
+  /** Settings-menu link to an external app (e.g. a hosting console), opened in a new tab */
+  externalAppLink?: string;
+  externalAppLabel?: string;
   /** Session-creation seam behind the navbar compose affordance. */
   onCreateSession?: (
     config: NewSessionConfig,
@@ -167,8 +157,8 @@ const AppHeaderInner: React.FC<AppHeaderProps> = ({
   onUserClick,
   instanceLabel,
   instanceDescription,
-  navbarLogoLink,
-  navbarLogoTooltip,
+  externalAppLink,
+  externalAppLabel,
   onCreateSession,
 }) => {
   const { token } = theme.useToken();
@@ -198,15 +188,7 @@ const AppHeaderInner: React.FC<AppHeaderProps> = ({
   // gate off raw `connected` — it stays true through the grace window.
   const mutationDisabled = useConnectionDisabled();
 
-  // Deployment-configured logo destination; only absolute http(s) URLs are honored.
-  const logoLink =
-    navbarLogoLink && /^https?:\/\//i.test(navbarLogoLink) ? navbarLogoLink : undefined;
-  const logo = (
-    <>
-      <BrandMark size={50} />
-      <BrandLogo level={3} style={{ marginTop: -6 }} />
-    </>
-  );
+  const externalApp = resolveExternalAppLink(externalAppLink, externalAppLabel);
 
   const settingsItems: MenuProps['items'] = [
     ...(eventStreamEnabled
@@ -240,6 +222,19 @@ const AppHeaderInner: React.FC<AppHeaderProps> = ({
       disabled: mutationDisabled,
       onClick: onSettingsClick,
     },
+    ...(externalApp
+      ? [
+          {
+            key: 'external-app',
+            extra: <ExportOutlined />,
+            label: (
+              <a href={externalApp.href} target="_blank" rel="noopener noreferrer">
+                {externalApp.label}
+              </a>
+            ),
+          },
+        ]
+      : []),
   ];
 
   return (
@@ -254,17 +249,24 @@ const AppHeaderInner: React.FC<AppHeaderProps> = ({
       }}
     >
       <Space size={16} align="center">
-        {logoLink ? (
-          <Tooltip title={navbarLogoTooltip} placement="bottomLeft">
-            <a href={logoLink} aria-label={navbarLogoTooltip || 'Agor'} style={logoStyle}>
-              {logo}
-            </a>
-          </Tooltip>
-        ) : (
-          <button type="button" aria-label="Go to Home" onClick={onHomeClick} style={logoStyle}>
-            {logo}
-          </button>
-        )}
+        <button
+          type="button"
+          aria-label="Go to Home"
+          onClick={onHomeClick}
+          style={{
+            height: 54,
+            padding: 0,
+            display: 'flex',
+            alignItems: 'center',
+            gap: 10,
+            background: 'transparent',
+            border: 0,
+            cursor: 'pointer',
+          }}
+        >
+          <BrandMark size={50} />
+          <BrandLogo level={3} style={{ marginTop: -6 }} />
+        </button>
         {instanceLabel &&
           (instanceDescription ? (
             <Popover
```

**File**: `apps/agor-ui/src/components/GlobalUserMenu.test.tsx` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+import { fireEvent, render, screen } from '@testing-library/react';
+import { describe, expect, it } from 'vitest';
+import { GlobalUserMenu } from './GlobalUserMenu';
+
+describe('GlobalUserMenu external app entry', () => {
+  function openMenu(externalAppLink?: string) {
+    render(<GlobalUserMenu externalAppLink={externalAppLink} externalAppLabel="Open Agor Cloud" />);
+    fireEvent.click(screen.getByRole('button'));
+  }
+
+  it('links to the external app in a new tab when provided', async () => {
+    openMenu('https://console.example.test/');
+
+    const link = await screen.findByRole('link', { name: 'Open Agor Cloud' });
+    expect(link).toHaveAttribute('href', 'https://console.example.test/');
+    expect(link).toHaveAttribute('target', '_blank');
+  });
+
+  it('has no external app entry without an http(s) link', async () => {
+    openMenu('javascript:alert(1)');
+
+    expect(await screen.findByText('Logout')).toBeInTheDocument();
+    expect(screen.queryByRole('link')).not.toBeInTheDocument();
+  });
+});
```

**File**: `apps/agor-ui/src/components/GlobalUserMenu.tsx` (modified, +21/-1)
```diff
@@ -1,16 +1,20 @@
 import type { User } from '@agor-live/client';
-import { LogoutOutlined, SoundOutlined, UserOutlined } from '@ant-design/icons';
+import { ExportOutlined, LogoutOutlined, SoundOutlined, UserOutlined } from '@ant-design/icons';
 import type { MenuProps } from 'antd';
 import { Button, Dropdown, Space, Tooltip, theme } from 'antd';
 import type React from 'react';
 import { useState } from 'react';
+import { resolveExternalAppLink } from '../utils/externalAppLink';
 import { UserIdentityAvatar } from './UserIdentityAvatar';
 
 export interface GlobalUserMenuProps {
   user?: User | null;
   disabled?: boolean;
   onUserSettingsClick?: () => void;
   onLogout?: () => void;
+  /** External app link for surfaces without the settings menu (e.g. Knowledge), opened in a new tab */
+  externalAppLink?: string;
+  externalAppLabel?: string;
 }
 
 /**
@@ -26,7 +30,10 @@ export const GlobalUserMenu: React.FC<GlobalUserMenuProps> = ({
   disabled = false,
   onUserSettingsClick,
   onLogout,
+  externalAppLink,
+  externalAppLabel,
 }) => {
+  const externalApp = resolveExternalAppLink(externalAppLink, externalAppLabel);
   const { token } = theme.useToken();
   const [open, setOpen] = useState(false);
   const audioEnabled = user?.preferences?.audio?.enabled ?? false;
@@ -64,6 +71,19 @@ export const GlobalUserMenu: React.FC<GlobalUserMenuProps> = ({
         onUserSettingsClick?.();
       },
     },
+    ...(externalApp
+      ? [
+          {
+            key: 'external-app',
+            icon: <ExportOutlined />,
+            label: (
+              <a href={externalApp.href} target="_blank" rel="noopener noreferrer">
+                {externalApp.label}
+              </a>
+            ),
+          },
+        ]
+      : []),
     {
       key: 'logout',
       label: 'Logout',
```

---

### Incident Patch 10: `a78a9843` (2026-10-02)
**Commit Message**: fix(client): bound lean transcript detail retention to recent turns (#2950)

* fix(client): bound lean transcript detail retention to recent turns

In lean task hydration a turn's full detail (tool output, reasoning, full
message metadata) stayed in ReactiveSessionHandle for the life of the open
conversation, so a reader left open while an agent worked kept every turn's
payloads. Related to #2757 (partial mitigation; not a byte bound).

- Keep full detail for the ten most recently loaded/live turns plus the
  latest, executing and reader-pinned turns. Project every other cached
  bucket to the lean transcript shape on each update (browser-side
  leanMessage, pinned to the SQL projection by a repository test) and drop
  it from loadedTaskIds, so the UI reloads persisted detail on demand.
- retainTaskDetails(taskId) pins a turn while an AgentChain, ToolBlock or
  ThinkingBlock disclosure is expanded by the reader; default-open edit
  bodies do not pin. Streams are left to terminal settlement (#2930), and
  disconnect/abandon (#2932) behaviour is unchanged.
- Make evicted payloads collectable in production React: build TaskBlock's
  stable retain callback outside its render scope, add

**File**: `.github/workflows/ci.yml` (modified, +5/-0)
```diff
@@ -227,6 +227,11 @@ jobs:
           if [[ "${{ matrix.shard }}" == "1" ]]; then
             pnpm --filter agor-ui test:search-retention
           fi
+      - name: Test production transcript retention
+        run: |
+          if [[ "${{ matrix.shard }}" == "2" ]]; then
+            pnpm --filter agor-ui test:transcript-retention
+          fi
       - run: pnpm --filter agor-ui test:browser --shard=${{ matrix.shard }}/2
 
   # Do not rename this job: branch protection currently requires the generated
```

**File**: `apps/agor-docs/content/guide/sessions.mdx` (modified, +7/-0)
```diff
@@ -39,6 +39,13 @@ Collapsed messages show a shortened preview. Expand the message to use code or
 table export controls. The message copy action still copies the full source;
 collapsing is a display preference, not a reduction in saved content.
 
+An open conversation keeps tool output and reasoning in memory for the ten most
+recently loaded or live turns, plus the latest turn, running turns, any tool or
+reasoning section you have expanded, and any turn holding keyboard focus, part of a text
+selection, or an open fullscreen table or diagram. Older turns keep their text; opening their tool
+calls again reloads the details from saved history. The limit counts turns, not
+bytes, so one very large turn can still use a lot of memory.
+
 ---
 
 ## Three ways to branch
```

**File**: `apps/agor-ui/package.json` (modified, +2/-1)
```diff
@@ -15,7 +15,8 @@
     "test:ui": "vitest --ui",
     "gen:streamdown-css": "node scripts/gen-streamdown-css.mjs",
     "test:browser": "vitest run --config vitest.browser.config.ts",
-    "test:search-retention": "node --test scripts/test-global-search-retention.mjs"
+    "test:search-retention": "node --test scripts/test-global-search-retention.mjs",
+    "test:transcript-retention": "node --test scripts/test-transcript-retention.mjs"
   },
   "dependencies": {
     "@agor-live/client": "workspace:*",
```

**File**: `apps/agor-ui/scripts/production-retention-harness.mjs` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+// Shared by the production retention tests. Requires repository Playwright
+// Chromium. Builds real production React, serves real loopback HTTP, and lets
+// tests observe collection (not merely absence from a store).
+import { once } from 'node:events';
+import { mkdtemp, readFile, rm } from 'node:fs/promises';
+import { createServer } from 'node:http';
+import { tmpdir } from 'node:os';
+import path from 'node:path';
+import { chromium } from 'playwright';
+import { build } from 'vite';
+
+/**
+ * Labels of live strings of at least `minBytes` whose content matches `pattern`
+ * (first capture group, or the whole match). Raw snapshots remain in this
+ * process only; no heap files are published.
+ */
+export async function livePayloads(cdp, pattern, minBytes = 256 * 1024) {
+  const chunks = [];
+  const onChunk = ({ chunk }) => chunks.push(chunk);
+  cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
+  try {
+    await cdp.send('HeapProfiler.takeHeapSnapshot');
+  } finally {
+    cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk);
+  }
+  const { snapshot, nodes, strings } = JSON.parse(chunks.join(''));
+  const fields = snapshot.meta.node_fields;
+  const labels = [];
+  for (let i = 0; i < nodes.length; i += fields.length) {
+    const match =
+      nodes[i + fields.indexOf('self_size')] >= minBytes &&
+      pattern.exec(strings[nodes[i + fields.indexOf('name')]]);
+    if (match) labels.push(match[1] ?? match[0]);
+  }
+  return labels;
+}
+
+/** Build `src/components/<fixture>.fixture.tsx` as production React and drive it in Chromium. */
+export async function withProductionFixture(fixture, run) {
+  const outDir = await mkdtemp(path.join(tmpdir(), 'agor-retention-'));
+  let browser;
+  let server;
+  try {
+    await build({
+      configFile: false,
+      root: path.resolve(import.meta.dirname, '..'),
+      logLevel: 'warn',
+      resolve: { conditions: ['source'] },
+      define: { 'process.env.NODE_ENV': '"production"', global: 'globalThis' },
+      build: {
+        outDir,
+        minify: true,
+        rolldownOptions: {
+          input: path.resolve(import.meta.dirname, `../src/components/${fixture}.fixture.tsx`),
+          output: { entryFileNames: 'fixture.js' },
+        },
+      },
+    });
+    server = createServer(async (req, res) => {
+      if (req.url === '/') {
+        res.setHeader('Content-Type', 'text/html');
+        res.end('<div id="root"></div><script type="module" src="/fixture.js"></script>');
+        return;
+      }
+      const file = path.resolve(outDir, `.${req.url}`);
+      if (!file.startsWith(`${outDir}/`)) return res.writeHead(403).end();
+      try {
+        res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'text/javascript');
+        res.end(await readFile(file));
+      } catch {
+        res.writeHead(404).end();
+      }
+    });
+    server.listen(0, '127.0.0.1');
+    await once(server, 'listening');
+    const origin = `http://127.0.0.1:${server.address().port}`;
+    browser = await chromium.launch({ headless: true });
+    const page = await browser.newPage();
+    // No fabricated document or external application requests.
+    await page.route('**/*', (route) =>
+      new URL(route.request().url()).origin === origin ? route.continue() : route.abort()
+    );
+    await page.goto(origin);
+    const cdp = await page.context().newCDPSession(page);
+    await run(page, cdp);
+  } finally {
+    await browser?.close();
+    server?.closeAllConnections();
+    if (server?.listening) await new Promise((resolve) => server.close(resolve));
+    await rm(outDir, { recursive: true, force: true });
+  }
+}
```

**File**: `apps/agor-ui/scripts/test-global-search-retention.mjs` (modified, +4/-89)
```diff
@@ -2,103 +2,18 @@
 // Requires repository Playwright Chromium. Builds real production React, serves
 // real loopback HTTP, and tests collection (not merely absence from a store).
 import assert from 'node:assert/strict';
-import { once } from 'node:events';
-import { mkdtemp, readFile, rm } from 'node:fs/promises';
-import { createServer } from 'node:http';
-import { tmpdir } from 'node:os';
-import path from 'node:path';
 import { test } from 'node:test';
-import { chromium } from 'playwright';
-import { build } from 'vite';
+import { livePayloads, withProductionFixture } from './production-retention-harness.mjs';
 
-async function payloadCount(cdp) {
-  // Raw snapshots remain in this process only; no heap files are published.
-  const chunks = [];
-  const onChunk = ({ chunk }) => chunks.push(chunk);
-  cdp.on('HeapProfiler.addHeapSnapshotChunk', onChunk);
-  try {
-    await cdp.send('HeapProfiler.takeHeapSnapshot');
-  } finally {
-    cdp.off('HeapProfiler.addHeapSnapshotChunk', onChunk);
-  }
-  const { snapshot, nodes, strings } = JSON.parse(chunks.join(''));
-  const fields = snapshot.meta.node_fields;
-  let count = 0;
-  for (let i = 0; i < nodes.length; i += fields.length) {
-    if (
-      nodes[i + fields.indexOf('self_size')] >= 256 * 1024 &&
-      /^RETENTION_\d+_\d+_/.test(strings[nodes[i + fields.indexOf('name')]])
-    )
-      count++;
-  }
-  return count;
-}
-
-async function withFixture(fixtureName, run) {
-  const outDir = await mkdtemp(path.join(tmpdir(), 'agor-search-retention-'));
-  let browser;
-  let server;
-  try {
-    await build({
-      configFile: false,
-      root: path.resolve(import.meta.dirname, '..'),
-      logLevel: 'warn',
-      resolve: { conditions: ['source'] },
-      define: { 'process.env.NODE_ENV': '"production"', global: 'globalThis' },
-      build: {
-        outDir,
-        minify: true,
-        rolldownOptions: {
-          input: path.resolve(
-            import.meta.dirname,
-            `../src/components/GlobalSearch/${fixtureName}.fixture.tsx`
-          ),
-          output: { entryFileNames: 'fixture.js' },
-        },
-      },
-    });
-    server = createServer(async (req, res) => {
-      if (req.url === '/') {
-        res.setHeader('Content-Type', 'text/html');
-        res.end('<div id="root"></div><script type="module" src="/fixture.js"></script>');
-        return;
-      }
-      const file = path.resolve(outDir, `.${req.url}`);
-      if (!file.startsWith(`${outDir}/`)) return res.writeHead(403).end();
-      try {
-        res.setHeader('Content-Type', file.endsWith('.css') ? 'text/css' : 'text/javascript');
-        res.end(await readFile(file));
-      } catch {
-        res.writeHead(404).end();
-      }
-    });
-    server.listen(0, '127.0.0.1');
-    await once(server, 'listening');
-    const origin = `http://127.0.0.1:${server.address().port}`;
-    browser = await chromium.launch({ headless: true });
-    const page = await browser.newPage();
-    // No fabricated document or external application requests.
-    await page.route('**/*', (route) =>
-      new URL(route.request().url()).origin === origin ? route.continue() : route.abort()
-    );
-    await page.goto(origin);
-    const cdp = await page.context().newCDPSession(page);
-    await run(page, cdp);
-  } finally {
-    await browser?.close();
-    server?.closeAllConnections();
-    if (server?.listening) await new Promise((resolve) => server.close(resolve));
-    await rm(outDir, { recursive: true, force: true });
-  }
-}
+const payloadCount = async (cdp) => (await livePayloads(cdp, /^RETENTION_\d+_\d+_/)).length;
 
 // The first callback is born with the payload-bearing map. An inline stable
 // wrapper sharing the publication effect's scope would retain that callback,
 // even after ref.current is replaced. Both payload and object collection count.
 test('GlobalSearch releases obsolete payloads across two mounted cycles', {
   timeout: 120_000,
 }, async () => {
-  await withFixture('GlobalSearch.retention', async (page, cdp) => {
+  await withProductionFixture('GlobalSearch/GlobalSearch.retention', async (page, cdp) => {
     await page.waitForFunction(() => !!window.searchRetentionFixture);
     for (let cycle = 1; cycle <= 2; cycle++) {
       await page.evaluate((n) => window.searchRetentionFixture.populate(n), cycle);
@@ -137,7 +52,7 @@ test('GlobalSearch releases obsolete payloads across two mounted cycles', {
 test('GlobalSearch Enter uses committed callbacks across a suspended transition', {
   timeout: 120_000,
 }, async () => {
-  await withFixture('GlobalSearch.concurrent', async (page) => {
+  await withProductionFixture('GlobalSearch/GlobalSearch.concurrent', async (page) => {
     await page.getByRole('button', { name: 'Open search' }).click();
     const input = page.getByRole('combobox', { name: 'Global search' });
     await input.fill('deploy');
```

**File**: `apps/agor-ui/scripts/test-transcript-retention.mjs` (added, +353/-0)
```diff
@@ -0,0 +1,353 @@
+// Run: node --test apps/agor-ui/scripts/test-transcript-retention.mjs
+// Production React + real lean ReactiveSessionHandle: old turns' tool payloads
+// and reasoning must become collectable while the transcript stays mounted, not
+// just leave the cache. Synthetic 256 KiB tool results and 64 KiB reasoning per
+// turn; not a production memory measurement.
+import assert from 'node:assert/strict';
+import { test } from 'node:test';
+import { livePayloads, withProductionFixture } from './production-retention-harness.mjs';
+
+/** Turns whose tool result (`tools`) and reasoning (`thinking`) strings are live. */
+async function liveTurns(page, cdp) {
+  // Let deferred pin releases and the eviction commit settle first.
+  await page.waitForTimeout(300);
+  await cdp.send('HeapProfiler.collectGarbage');
+  // No size floor: Blink externalizes strings it renders (an expanded result is
+  // a chain row), leaving a small V8 node. Snapshot names hold the content.
+  const labels = await livePayloads(cdp, /^TRANSCRIPT_((?:RETENTION|THINKING)_\d+)_[xy]{512}/, 0);
+  const of = (kind) =>
+    [...new Set(labels.filter((label) => label.startsWith(`${kind}_`)))]
+      .map((label) => Number(label.slice(kind.length + 1)))
+      .sort((a, b) => a - b);
+  return { tools: of('RETENTION'), thinking: of('THINKING') };
+}
+
+/**
+ * Wait until a turn's expanded reasoning shows its payload. Deliberately not a
+ * regex locator: the engine's last regex match is a GC root of its world.
+ */
+const reasoningShown = (page, taskId, n) =>
+  page.waitForFunction(
+    ([id, marker]) =>
+      !!document.querySelector(`[data-task-block="${id}"]`)?.textContent?.includes(marker),
+    [taskId, `TRANSCRIPT_THINKING_${n}_`]
+  );
+
+/** A reader moving on: focus and selection leave the transcript. */
+const disengage = (page) =>
+  page.evaluate(() => {
+    document.activeElement?.blur();
+    document.getSelection()?.removeAllRanges();
+  });
+
+const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
+const both = (turns) => ({ tools: turns, thinking: turns });
+
+test('lean transcript releases old turn payloads beyond the recent-turn budget', {
+  timeout: 120_000,
+}, async () => {
+  await withProductionFixture('ConversationView/TranscriptRetention', async (page, cdp) => {
+    await page.waitForFunction(() => !!window.transcriptRetentionFixture);
+    await page.evaluate(() => window.transcriptRetentionFixture.mount());
+    const first = await page.evaluate(() => window.transcriptRetentionFixture.addTurn());
+    const turn = page.locator(`[data-task-block="${first}"]`);
+    // A reader opens the first turn's tool calls and reasoning; those pins
+    // outlive the budget.
+    const chain = turn.getByRole('button', { name: '1 tool call' });
+    await chain.click();
+    await turn.getByText('Read').first().waitFor();
+    const reasoning = turn.getByRole('button', { name: /Extended Thinking/ });
+    await reasoning.click();
+    await reasoningShown(page, first, 0);
+    for (let n = 1; n < 30; n++) {
+      await page.evaluate(() => window.transcriptRetentionFixture.addTurn());
+      await page.waitForTimeout(20);
+    }
+    await page.getByText('Answer 29').waitFor();
+    assert.deepEqual(
+      await liveTurns(page, cdp),
+      both([0, ...range(20, 29)]),
+      'ten recent turns plus the expanded turn keep payloads; older payloads are collected'
+    );
+
+    await chain.click(); // collapse tools: the reasoning pin still holds the turn
+    assert.deepEqual(await liveTurns(page, cdp), both([0, ...range(20, 29)]));
+    await reasoning.click(); // collapse reasoning: the last pin is released
+    await disengage(page); // the collapsed trigger keeps its turn while focused
+    assert.deepEqual(await liveTurns(page, cdp), both(range(20, 29)), 'collapsed turn is released');
+    assert.equal(await page.getByText('Answer 0').count(), 1, 'lean history stays visible');
+
+    // Re-expanding an evicted turn reloads its detail from persisted history.
+    await page.evaluate(() => window.transcriptRetentionFixture.delayDetailReads(500));
+    await turn.getByRole('button', { name: '1 tool call' }).click();
+    await turn.getByRole('button', { name: 'Loading tool activity…' }).waitFor();
+    await turn.getByText('Read').first().waitFor();
+    await turn.getByRole('button', { name: /Extended Thinking/ }).click();
+    await reasoningShown(page, first, 0);
+    assert.deepEqual(await liveTurns(page, cdp), both([0, ...range(21, 29)]));
+
+    await page.evaluate(() => window.transcriptRetentionFixture.unmount());
+    assert.deepEqual(
+      await liveTurns(page, cdp),
+      both([]),
+      'closing the reader releases everything'
+    );
+  });
+});
+
+test('lean transcript releases turns that were already full when the reader opened', {
+  timeout: 120_000,
+}, async () => {
+  await withProductionFixture('ConversationView/TranscriptRetention', async (page, cdp) 
```

**File**: `apps/agor-ui/src/components/AgentChain/AgentChain.tsx` (modified, +2/-0)
```diff
@@ -23,6 +23,7 @@ import type {
 import { BulbOutlined } from '@ant-design/icons';
 import { ConfigProvider, Typography, theme } from 'antd';
 import React, { useEffect, useMemo, useState } from 'react';
+import { useRetainTaskDetailsWhile } from '../../hooks/useTaskDetailRetention';
 import { getToolDisplayName } from '../../utils/toolDisplayName';
 import { toolResultToDisplayText } from '../../utils/toolResultToDisplayText';
 import { CollapsibleText } from '../CollapsibleText';
@@ -92,6 +93,7 @@ export const AgentChain = React.memo<AgentChainProps>(
     useEffect(() => {
       if (revealRequested) setExpanded(true);
     }, [revealRequested]);
+    useRetainTaskDetailsWhile(expanded);
 
     // Extract chain items (thoughts and tools) from messages
     const chainItems = useMemo(() => {
```

**File**: `apps/agor-ui/src/components/ConversationView/ConversationView.rerender.test.tsx` (modified, +1/-0)
```diff
@@ -49,6 +49,7 @@ let initialReactiveState: unknown = null;
 const mockReactiveHandle = {
   loadTaskMessages: async () => {},
   unloadTaskMessages: () => {},
+  retainTaskDetails: () => () => {},
   resync: async () => {},
 };
 
```

---

### Incident Patch 11: `d979b93d` (2026-10-02)
**Commit Message**: fix(daemon): bound realtime access cache and reclaim expired entries (#2949)

* fix(daemon): bound realtime access cache and reclaim expired entries

RealtimeAccessCache checked TTLs on read but never reclaimed expired keys
and had no capacity bound, so in a long-running multi-tenant daemon its
three maps grew with every distinct branch/session ever published.

- Sweep expired entries from the head of every map on each lookup. Each
  map has one fixed TTL and hits never refresh, so insertion order is
  expiry order; the sweep is amortized O(1) and needs no timer.
- Bound each map, evicting oldest first on fill (10k session entries,
  2k branch-visibility entries, which hold materialized viewer sets).
- Eviction only causes a cache miss and an authorized repository reread;
  the generation fence for in-flight fills is unchanged.

Extracted from #2856. Related: preset-io/agor-cloud#713.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* test(daemon): cover realtime access cache overwrite order and pending-read eviction

- Concurrent misses for one key, with another key filled between them:
  the second fill must move the key to the tail so prefix expiry and
  oldest-

**File**: `apps/agor-daemon/src/utils/realtime-access-cache.test.ts` (modified, +210/-0)
```diff
@@ -11,6 +11,16 @@ function branch(id: string, others_can: Branch['others_can'] = 'none'): Branch {
   return { branch_id: id, others_can } as Branch;
 }
 
+function cacheSizes(cache: RealtimeAccessCache): number[] {
+  return ['branchVisibility', 'sessionBranches', 'sessionOwners'].map(
+    (key) => (Reflect.get(cache, key) as Map<string, unknown>).size
+  );
+}
+
+function cacheKeys(cache: RealtimeAccessCache, key: string): string[] {
+  return [...(Reflect.get(cache, key) as Map<string, unknown>).keys()];
+}
+
 function deferred<T>() {
   let resolve!: (value: T) => void;
   const promise = new Promise<T>((resolvePromise) => {
@@ -248,4 +258,204 @@ describe('RealtimeAccessCache', () => {
     await expect(pending).resolves.toBeNull();
     expect(sessionsRepository.findBranchIdBySessionId).toHaveBeenCalledTimes(2);
   });
+
+  it('reclaims expired entries in every map on the next lookup without a timer', async () => {
+    let now = 1_000;
+    const cache = new RealtimeAccessCache({
+      branchRepository: {
+        findRealtimeVisibilityBranch: vi.fn(async (id: string) => branch(id)),
+        findRealtimeViewUserIds: vi.fn(async () => []),
+      },
+      sessionsRepository: {
+        findBranchIdBySessionId: vi.fn(async () => null),
+        findCreatedByBySessionId: vi.fn(async () => null),
+      },
+      branchVisibilityTtlMs: 10,
+      sessionBranchTtlMs: 100,
+      now: () => now,
+    });
+
+    for (let i = 0; i < 500; i++) {
+      await cache.getBranchVisibility(`b${i}` as BranchID);
+      await cache.getBranchIdForSession(`s${i}`);
+      await cache.getSessionOwnerId(`s${i}`);
+    }
+    expect(cacheSizes(cache)).toEqual([500, 500, 500]);
+
+    // Only branch visibility has expired; the session maps keep their entries.
+    now += 11;
+    await cache.getSessionOwnerId('s0');
+    expect(cacheSizes(cache)).toEqual([0, 500, 500]);
+
+    now += 100;
+    await cache.getBranchVisibility('fresh' as BranchID);
+    expect(cacheSizes(cache)).toEqual([1, 0, 0]);
+  });
+
+  it('bounds every map under many distinct keys, evicting oldest first', async () => {
+    const branchRepository = {
+      findRealtimeVisibilityBranch: vi.fn(async (id: string) => branch(id)),
+      findRealtimeViewUserIds: vi.fn(async () => []),
+    } as unknown as RealtimeAccessBranchRepository;
+    const sessionsRepository = {
+      findBranchIdBySessionId: vi.fn(async () => 'b1'),
+      findCreatedByBySessionId: vi.fn(async () => 'u1'),
+    } as unknown as RealtimeAccessSessionRepository;
+    const cache = new RealtimeAccessCache({ branchRepository, sessionsRepository, maxEntries: 32 });
+
+    for (let i = 0; i < 10_000; i++) {
+      await cache.getBranchVisibility(`b${i}` as BranchID);
+      await cache.getBranchIdForSession(`s${i}`);
+      await cache.getSessionOwnerId(`s${i}`);
+    }
+    expect(cacheSizes(cache)).toEqual([32, 32, 32]);
+
+    // The newest 32 keys are still hits; the oldest was evicted and is reread.
+    await cache.getBranchIdForSession('s9968');
+    expect(sessionsRepository.findBranchIdBySessionId).toHaveBeenCalledTimes(10_000);
+    await cache.getBranchIdForSession('s0');
+    expect(sessionsRepository.findBranchIdBySessionId).toHaveBeenCalledTimes(10_001);
+    expect(cacheSizes(cache)).toEqual([32, 32, 32]);
+  });
+
+  it('moves a concurrently overwritten key to the tail for expiry and eviction', async () => {
+    let now = 1_000;
+    const firstRead = deferred<BranchID | null>();
+    const secondRead = deferred<BranchID | null>();
+    const findBranchIdBySessionId = vi
+      .fn()
+      .mockImplementationOnce(() => firstRead.promise)
+      .mockImplementationOnce(() => secondRead.promise)
+      .mockResolvedValue('b1');
+    const cache = new RealtimeAccessCache({
+      branchRepository: {
+        findRealtimeVisibilityBranch: vi.fn(),
+        findRealtimeViewUserIds: vi.fn(),
+      },
+      sessionsRepository: { findBranchIdBySessionId, findCreatedByBySessionId: vi.fn() },
+      sessionBranchTtlMs: 100,
+      maxEntries: 3,
+      now: () => now,
+    });
+
+    // Two concurrent misses for `a`; another key lands between their fills.
+    const first = cache.getBranchIdForSession('a');
+    const second = cache.getBranchIdForSession('a');
+    firstRead.resolve('b1' as BranchID);
+    await first;
+    now = 1_010;
+    await cache.getBranchIdForSession('b');
+    now = 1_020;
+    secondRead.resolve('b1' as BranchID);
+    await second;
+    expect(cacheKeys(cache, 'sessionBranches')).toEqual(['b', 'a']);
+
+    // Capacity evicts `b`, the oldest fill, not the refreshed `a`.
+    now = 1_030;
+    await cache.getBranchIdForSession('c');
+    now = 1_040;
+    await cache.getBranchIdForSession('d');
+    expect(cacheKeys(cache, 'sessionBranches')).toEqual(['a', 'c', 'd']);
+    await cache.getBranchIdForSession('a');
+    expect(findBranchIdBySessionId).toHaveBeenCalledTimes(5);
+
+    // `a` now expires first (1_120), so the prefix sweep reclaims o
```

**File**: `apps/agor-daemon/src/utils/realtime-access-cache.ts` (modified, +56/-3)
```diff
@@ -40,11 +40,23 @@ export interface RealtimeAccessCacheOptions {
   branchVisibilityTtlMs?: number;
   sessionBranchTtlMs?: number;
   ttlMs?: number;
+  /** Per-map entry bound; overrides both defaults below. */
+  maxEntries?: number;
   now?: () => number;
 }
 
 const DEFAULT_BRANCH_VISIBILITY_TTL_MS = 5 * 60_000;
 const DEFAULT_SESSION_BRANCH_TTL_MS = 60 * 60_000;
+/**
+ * Capacity backstops for a long-running, multi-tenant daemon. TTLs already
+ * bound how long an entry is useful; these bound how many can exist at once.
+ * Session entries are a couple of ids (~200 B), so 10k per map is ~2 MB.
+ * Branch visibility entries hold the materialized viewer set, which can be a
+ * whole tenant's membership, so that map gets a smaller bound. Eviction only
+ * ever forces an authorized repository reread on the next lookup.
+ */
+const DEFAULT_BRANCH_VISIBILITY_MAX_ENTRIES = 2_000;
+const DEFAULT_SESSION_MAX_ENTRIES = 10_000;
 
 /** Resolve current branch visibility without consulting daemon-local cache state. */
 export async function resolveBranchRealtimeVisibility(
@@ -73,6 +85,8 @@ export class RealtimeAccessCache {
   private readonly sessionOwners = new Map<string, SessionOwnerCacheEntry>();
   private readonly branchVisibilityTtlMs: number;
   private readonly sessionBranchTtlMs: number;
+  private readonly branchVisibilityMaxEntries: number;
+  private readonly sessionMaxEntries: number;
   private readonly now: () => number;
   /**
    * Monotonic fence for asynchronous cache fills.
@@ -89,10 +103,16 @@ export class RealtimeAccessCache {
       options.branchVisibilityTtlMs ?? options.ttlMs ?? DEFAULT_BRANCH_VISIBILITY_TTL_MS;
     this.sessionBranchTtlMs =
       options.sessionBranchTtlMs ?? options.ttlMs ?? DEFAULT_SESSION_BRANCH_TTL_MS;
+    this.branchVisibilityMaxEntries = Math.max(
+      1,
+      options.maxEntries ?? DEFAULT_BRANCH_VISIBILITY_MAX_ENTRIES
+    );
+    this.sessionMaxEntries = Math.max(1, options.maxEntries ?? DEFAULT_SESSION_MAX_ENTRIES);
     this.now = options.now ?? Date.now;
   }
 
   async getBranchIdForSession(sessionId: string): Promise<BranchID | null> {
+    this.pruneExpired();
     const cached = this.sessionBranches.get(sessionId);
     const now = this.now();
     if (cached && cached.expiresAt > now) {
@@ -102,7 +122,7 @@ export class RealtimeAccessCache {
     const generation = this.generation;
     const branchId = await this.options.sessionsRepository.findBranchIdBySessionId(sessionId);
     if (generation !== this.generation) return this.getBranchIdForSession(sessionId);
-    this.sessionBranches.set(sessionId, {
+    this.store(this.sessionBranches, sessionId, this.sessionMaxEntries, {
       branchId,
       expiresAt: this.now() + this.sessionBranchTtlMs,
     });
@@ -116,6 +136,7 @@ export class RealtimeAccessCache {
    * the per-session stream channel yet.
    */
   async getSessionOwnerId(sessionId: string): Promise<UserID | null> {
+    this.pruneExpired();
     const cached = this.sessionOwners.get(sessionId);
     const now = this.now();
     if (cached && cached.expiresAt > now) {
@@ -128,14 +149,15 @@ export class RealtimeAccessCache {
         sessionId
       )) as UserID | null) ?? null;
     if (generation !== this.generation) return this.getSessionOwnerId(sessionId);
-    this.sessionOwners.set(sessionId, {
+    this.store(this.sessionOwners, sessionId, this.sessionMaxEntries, {
       ownerId,
       expiresAt: this.now() + this.sessionBranchTtlMs,
     });
     return ownerId;
   }
 
   async getBranchVisibility(branchId: BranchID): Promise<BranchRealtimeVisibility | null> {
+    this.pruneExpired();
     const cached = this.branchVisibility.get(branchId);
     const now = this.now();
     if (cached && cached.expiresAt > now) {
@@ -153,7 +175,7 @@ export class RealtimeAccessCache {
       return null;
     }
 
-    this.branchVisibility.set(branchId, {
+    this.store(this.branchVisibility, branchId, this.branchVisibilityMaxEntries, {
       ...visibility,
       expiresAt: this.now() + this.branchVisibilityTtlMs,
     });
@@ -188,6 +210,37 @@ export class RealtimeAccessCache {
     this.sessionOwners.clear();
   }
 
+  /**
+   * Each map has one fixed TTL and hits never refresh an entry, so insertion
+   * order is expiry order: expired keys are always at the head. Sweeping every
+   * map on each lookup reclaims them without a timer, in amortized O(1).
+   * A backwards clock step only delays reclamation; reads still check expiry.
+   */
+  private pruneExpired(): void {
+    const now = this.now();
+    const caches: Map<string, { expiresAt: number }>[] = [
+      this.branchVisibility,
+      this.sessionBranches,
+      this.sessionOwners,
+    ];
+    for (const cache of caches) {
+      for (const [key, entry] of cache) {
+        if (entry.expiresAt > now) break;
+        cache.delete(key);
+      }
+    }
+  }
+
+  /** Re-insert at the tail (keeps expiry order) and evict oldest-first past the bound. */
+  private store<K, V>(ca
```

---

### Incident Patch 12: `8e37a347` (2026-10-02)
**Commit Message**: feat(ui): lead the teammate gallery with Start blank (#2959)

Start blank sat below the fold at the end of the gallery, so picking a
template read as required. It now leads the All view. The onboarding
teammate step also drops its intro paragraph, and the wizard content
height grows from 460px to 620px (still capped by the viewport), so
more templates are visible before scrolling.

**File**: `apps/agor-ui/src/components/OnboardingWizard/OnboardingTeammateGalleryStep.tsx` (modified, +9/-18)
```diff
@@ -5,7 +5,7 @@ import type { GalleryFilter, TeammateGalleryCardId } from '../../utils/teammateT
 import { EmojiPickerInput } from '../EmojiPickerInput/EmojiPickerInput';
 import { TeammateGalleryCards, TeammateGalleryFilters } from '../TeammateGallery/TeammateGallery';
 
-const { Paragraph, Text, Title } = Typography;
+const { Text, Title } = Typography;
 
 interface OnboardingTeammateGalleryStepProps {
   goals: readonly string[];
@@ -51,24 +51,15 @@ export const OnboardingTeammateGalleryStep: React.FC<OnboardingTeammateGallerySt
             transition: 'max-height 0.25s ease, opacity 0.2s ease, margin-bottom 0.25s ease',
           }}
         >
-          <div style={{ marginBottom: 12 }}>
-            <Title
-              ref={headingRef}
-              data-step="workspace"
-              level={3}
-              tabIndex={-1}
-              style={{ color: token.colorText, margin: 0, outline: 'none' }}
-            >
-              Build your teammate
-            </Title>
-          </div>
-          <Paragraph
-            className="onb-workspace-intro-copy"
-            style={{ color: token.colorTextSecondary, margin: 0 }}
+          <Title
+            ref={headingRef}
+            data-step="workspace"
+            level={3}
+            tabIndex={-1}
+            style={{ color: token.colorText, margin: 0, outline: 'none' }}
           >
-            Name your teammate and pick a starter template to shape what they do, or start blank.
-            Change anything later.
-          </Paragraph>
+            Build your teammate
+          </Title>
         </div>
 
         <Flex vertical gap={token.marginSM}>
```

**File**: `apps/agor-ui/src/components/OnboardingWizard/OnboardingWizard.layout.browser.test.tsx` (modified, +4/-1)
```diff
@@ -236,7 +236,10 @@ describe('OnboardingWizard layout (real browser)', () => {
     // Chromium can preserve `repeat(auto-fit, minmax(...))` in computed style
     // at narrow viewports. Count the cards sharing the first rendered row
     // instead; this observes the layout result rather than its CSS spelling.
-    const cardRects = Array.from(grid.children, (card) => card.getBoundingClientRect());
+    // Skip the full-width Start blank header row so the first template row is measured.
+    const cardRects = Array.from(grid.children)
+      .filter((card) => card.getAttribute('aria-label') !== 'Start blank')
+      .map((card) => card.getBoundingClientRect());
     const firstTop = cardRects[0]?.top;
     const renderedColumns = cardRects.filter((rect) => Math.abs(rect.top - firstTop) < 1).length;
     const expectedColumns = window.innerWidth <= 480 ? 1 : 3;
```

**File**: `apps/agor-ui/src/components/OnboardingWizard/OnboardingWizard.tsx` (modified, +1/-2)
```diff
@@ -341,7 +341,6 @@ const ONB_ANIM_CSS = `
   }
 
   @media (max-height: 600px) {
-    .onb-workspace-intro-copy,
     .onb-workspace-helper { display: none !important; }
   }
 
@@ -2314,7 +2313,7 @@ export function OnboardingWizard({
               // high enough that the fixed height is honored on typical laptop
               // viewports so the goals grid + footer are never clipped.
               boxSizing: 'border-box',
-              height: 'min(460px, calc(100dvh - 192px))',
+              height: 'min(620px, calc(100dvh - 192px))',
               position: 'relative',
               zIndex: 1,
               // Step 2 owns its scrolling via an inner two-region layout (fixed
```

**File**: `apps/agor-ui/src/components/TeammateGallery/TeammateGallery.test.tsx` (modified, +7/-8)
```diff
@@ -213,11 +213,10 @@ describe('TeammateGallery', () => {
     expect(screen.queryByText('Start blank')).not.toBeInTheDocument();
   });
 
-  it('sorts recommended cards to the front in the All view, blank last', () => {
+  it('leads the All view with blank, then sorts recommended cards to the front', () => {
     render(<TeammateGallery goals={['dig-into-anything']} value={null} onChange={vi.fn()} />);
     const order = cardOrder();
-    expect(order.slice(0, 2)).toEqual(['Competitive Analyst', 'Financial Analyst']);
-    expect(order.at(-1)).toBe('Start blank');
+    expect(order.slice(0, 3)).toEqual(['Start blank', 'Competitive Analyst', 'Financial Analyst']);
   });
 
   it('shows a category pill per card in the category color (no icon tile); blank has none', () => {
@@ -268,15 +267,15 @@ describe('TeammateGallery', () => {
     }
   );
 
-  it('renders Start blank as a full-width dashed footer card, last in the All view', () => {
+  it('renders Start blank as a full-width dashed header card, first in the All view', () => {
     render(<TeammateGallery value={null} onChange={vi.fn()} />);
     const blankStyle = cardFor('Start blank').getAttribute('style') ?? '';
-    // Spans both columns of the auto-fit grid → full-width footer.
+    // Spans every column of the auto-fit grid → full-width header.
     expect(blankStyle).toContain('grid-column: 1 / -1');
     // Understated "build your own" affordance: dashed border.
     expect(blankStyle).toContain('border-style: dashed');
-    // Stays last; the eight templates keep their normal (non-spanning) cells.
-    expect(cardOrder().at(-1)).toBe('Start blank');
+    // Leads the grid; the eight templates keep their normal (non-spanning) cells.
+    expect(cardOrder()[0]).toBe('Start blank');
     expect(cardFor('Competitive Analyst').getAttribute('style') ?? '').not.toContain('grid-column');
   });
 
@@ -300,7 +299,7 @@ describe('TeammateGallery', () => {
     expect(screen.queryByText('Start blank')).not.toBeInTheDocument();
 
     fireEvent.click(clear as HTMLButtonElement);
-    // Reset to All: every card back (blank last) and the button is gone.
+    // Reset to All: every card back (blank first) and the button is gone.
     expect(screen.getByText('Start blank')).toBeInTheDocument();
     expect(screen.queryByText('Clear filters')).toBeNull();
   });
```

**File**: `apps/agor-ui/src/components/TeammateGallery/TeammateGallery.tsx` (modified, +4/-3)
```diff
@@ -143,8 +143,9 @@ const GalleryCard: React.FC<GalleryCardProps> = ({
 };
 
 /**
- * The blank starter, rendered as a full-width footer card spanning both grid
- * columns (so the eight templates stay a clean 4×2 grid with no orphan). It's a
+ * The blank starter, rendered as a full-width header card spanning every grid
+ * column (so the eight templates stay a clean grid with no orphan). It leads
+ * the All view so picking a template never reads as required. It's a
  * deliberately understated "build your own" affordance — dashed neutral border,
  * no category color/pill, no Recommended badge — laid out horizontally (icon +
  * copy) since it's wide. Still single-selectable with the same softened,
@@ -174,7 +175,7 @@ const BlankCard: React.FC<{
       tabIndex={0}
       {...toggleHandlers}
       style={{
-        // Span every column of the auto-fit grid → full-width footer card.
+        // Span every column of the auto-fit grid → full-width header card.
         gridColumn: '1 / -1',
         // Constant 1px dashed border in both states — only the color changes on
         // select, so no layout shift. Dashed + neutral reads as "build your own".
```

**File**: `apps/agor-ui/src/utils/teammateTemplates.test.ts` (modified, +9/-6)
```diff
@@ -107,19 +107,22 @@ describe('categories', () => {
 });
 
 describe('galleryCardsForFilter', () => {
-  it('All view sorts recommended cards to the front (in rec order), blank last', () => {
+  it('All view leads with blank, then recommended cards (in rec order)', () => {
     const ids = galleryCardsForFilter(['dig-into-anything'], 'all').map((t) => t.id);
-    // dig-into-anything → competitive-analyst, financial-analyst first, blank last.
-    expect(ids.slice(0, 2)).toEqual(['competitive-analyst', 'financial-analyst']);
-    expect(ids.at(-1)).toBe(BLANK_TEMPLATE_ID);
+    // dig-into-anything → blank, then competitive-analyst, financial-analyst.
+    expect(ids.slice(0, 3)).toEqual([
+      BLANK_TEMPLATE_ID,
+      'competitive-analyst',
+      'financial-analyst',
+    ]);
     // All nine cards present, no dupes.
     expect(ids).toHaveLength(9);
     expect(new Set(ids).size).toBe(9);
   });
 
-  it('All view keeps default order (blank last) when there are no recommendations', () => {
+  it('All view keeps default order (blank first) when there are no recommendations', () => {
     const ids = galleryCardsForFilter([], 'all').map((t) => t.id);
-    expect(ids).toEqual([...TEAMMATE_TEMPLATES.map((t) => t.id), BLANK_TEMPLATE_ID]);
+    expect(ids).toEqual([BLANK_TEMPLATE_ID, ...TEAMMATE_TEMPLATES.map((t) => t.id)]);
   });
 
   it('a category filter returns only that category in default order, no blank', () => {
```

**File**: `apps/agor-ui/src/utils/teammateTemplates.ts` (modified, +3/-3)
```diff
@@ -177,7 +177,7 @@ export type TeammateTemplateId = (typeof TEAMMATE_TEMPLATES)[number]['id'];
 
 /**
  * The blank starter card. Kept separate from TEAMMATE_TEMPLATES so callers can
- * render "Start blank" last and never accidentally recommend it. Its
+ * render "Start blank" first and never accidentally recommend it. Its
  * `sourceBranch` is the framework repo default; the wiring resolves it to the
  * repo's own default branch rather than forcing a literal.
  */
@@ -331,11 +331,11 @@ export function galleryCardsForFilter(
     return TEAMMATE_TEMPLATES.filter((template) => template.category === filter);
   }
 
-  // All: recommended first, then the remaining templates in default order, then blank.
+  // All: blank first (so templates never read as required), then recommended, then the rest.
   const recommendedCards = recommendedTemplateIds(goals)
     .map((id) => getTeammateTemplate(id))
     .filter((template): template is TeammateGalleryCard => Boolean(template));
   const recommendedIds = new Set(recommendedCards.map((template) => template.id));
   const rest = TEAMMATE_TEMPLATES.filter((template) => !recommendedIds.has(template.id));
-  return [...recommendedCards, ...rest, BLANK_TEMPLATE];
+  return [BLANK_TEMPLATE, ...recommendedCards, ...rest];
 }
```

---

### Incident Patch 13: `d885d465` (2026-10-02)
**Commit Message**: perf(ui): share antd cssVar scope across branch cards (#2953)

* perf(ui): share antd cssVar scope across branch cards

Each branch card wrapped its session list in two nested antd themes (card
no-motion + compact Tree), and antd 6 gives every nested theme its own
useId-based cssVar scope. A 90-branch board therefore injected 182 scopes /
1,078 <style> tags / ~3.5 MB of CSS.

Key both card themes by the parent's computed-token hash, so cards rendered
under identical tokens share one scope while light/dark, custom themes, and
panel vs card mode still get distinct scopes. If the hash is unavailable,
antd falls back to its per-instance scope.

On the 90-branch board (dev build, fit view): 182 -> 4 scopes,
1,078 -> 99 <style> tags, 3.5 MB -> 0.48 MB style text, ~17 MB less JS heap
after GC.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

* fix(ui): key shared card cssVar scopes by parent theme recipe

The parent's computed-token hash (`_tokenKey`) does not identify the nested
card theme: two parents whose global/component algorithms agree on the
parent tokens can diverge once the card recomputes with `motion: false`,
and would then write conflicting component variable

**File**: `apps/agor-ui/src/components/BranchCard/BranchSessionSections.cssvar.browser.test.tsx` (added, +229/-0)
```diff
@@ -0,0 +1,229 @@
+// biome-ignore-all lint/plugin/noHardcodedColorLiteral: distinctive theme seeds verify each card scope resolves its own parent tokens
+import type { Branch, Session } from '@agor-live/client';
+import { cleanup, render, screen } from '@testing-library/react';
+import { ConfigProvider, type MappingAlgorithm, type ThemeConfig, theme } from 'antd';
+import { afterEach, expect, it } from 'vitest';
+import { BranchSessionSections } from './BranchSessionSections';
+
+const DARK: ThemeConfig = { algorithm: theme.darkAlgorithm };
+const LIGHT: ThemeConfig = { algorithm: theme.defaultAlgorithm };
+const CUSTOM: ThemeConfig = {
+  algorithm: theme.darkAlgorithm,
+  token: { colorTextBase: '#c0ffee', colorBgBase: '#102030' },
+};
+
+// Two Tree algorithms that agree on the parent's tokens (motion on) and only diverge
+// under the card's `motion: false`, so the parents' computed-token hashes are identical.
+const HOVER_ON_NO_MOTION = '#ff0000';
+const hoverOnNoMotion: MappingAlgorithm = (seed) => ({
+  ...theme.defaultAlgorithm(seed),
+  ...(seed.motion === false ? { nodeHoverBg: HOVER_ON_NO_MOTION } : {}),
+});
+const TREE_DEFAULT: ThemeConfig = { components: { Tree: { algorithm: theme.defaultAlgorithm } } };
+const TREE_HOVER: ThemeConfig = { components: { Tree: { algorithm: hoverOnNoMotion } } };
+
+function makeBranch(index: number): { branch: Branch; sessions: Session[] } {
+  const branch = {
+    branch_id: `cssvar-branch-${index}`,
+    name: `Branch ${index}`,
+    filesystem_status: 'ready',
+  } as Branch;
+  const sessions = [
+    {
+      session_id: `cssvar-session-${index}` as Session['session_id'],
+      branch_id: branch.branch_id,
+      title: `Session ${index}`,
+      agentic_tool: 'codex',
+      status: 'idle',
+      archived: false,
+      created_by: 'user-1',
+      tasks: [],
+      ready_for_prompt: false,
+      created_at: '2026-09-01T00:00:00.000Z',
+      last_updated: '2026-09-01T00:00:00.000Z',
+      genealogy: { children: [] },
+    } as unknown as Session,
+  ];
+  return { branch, sessions };
+}
+
+const Cards = ({ count, testId }: { count: number; testId: string }) => (
+  <div data-testid={testId}>
+    {Array.from({ length: count }, (_, index) => {
+      const { branch, sessions } = makeBranch(index);
+      return (
+        <BranchSessionSections
+          key={branch.branch_id}
+          branch={branch}
+          sessions={sessions}
+          userById={new Map()}
+          client={null}
+        />
+      );
+    })}
+  </div>
+);
+
+const Board = ({
+  count,
+  swap = false,
+  dark = swap ? LIGHT : DARK,
+  light = swap ? DARK : LIGHT,
+}: {
+  count: number;
+  swap?: boolean;
+  dark?: ThemeConfig;
+  light?: ThemeConfig;
+}) => (
+  <>
+    <ConfigProvider theme={dark}>
+      <Cards count={count} testId="dark" />
+    </ConfigProvider>
+    <ConfigProvider theme={light}>
+      <Cards count={count} testId="light" />
+    </ConfigProvider>
+  </>
+);
+
+const ParentTokenKey = ({ testId }: { testId: string }) => {
+  const { token } = theme.useToken();
+  return <span data-testid={testId}>{(token as { _tokenKey?: string })._tokenKey}</span>;
+};
+
+/** Each card tree renders its parent theme's tokens, with the card motion override. */
+function expectTreeTokens(testId: string, config: ThemeConfig) {
+  const expected = theme.getDesignToken({ ...config, token: { ...config.token, motion: false } });
+  const trees = screen.getByTestId(testId).querySelectorAll<HTMLElement>('.ant-tree');
+  expect(trees.length).toBeGreaterThan(0);
+  for (const tree of trees) {
+    const vars = getComputedStyle(tree);
+    expect(vars.getPropertyValue('--ant-color-text')).toBe(expected.colorText);
+    expect(vars.getPropertyValue('--ant-color-bg-container')).toBe(expected.colorBgContainer);
+    expect(vars.getPropertyValue('--ant-motion-duration-mid')).toBe(expected.motionDurationMid);
+  }
+}
+
+/** Resolved `--ant-tree-node-hover-bg` of every card tree in one board container. */
+const treeHoverBgs = (testId: string) =>
+  Array.from(screen.getByTestId(testId).querySelectorAll<HTMLElement>('.ant-tree'), (tree) =>
+    getComputedStyle(tree).getPropertyValue('--ant-tree-node-hover-bg')
+  );
+
+/** `<style>` tags whose CSS targets a card-owned cssVar scope. */
+const cardScopeStyles = () =>
+  Array.from(document.querySelectorAll('style')).filter((style) =>
+    /\.agor-card(-session-tree)?-/.test(style.textContent ?? '')
+  );
+
+/** Distinct antd cssVar scopes that have style tags in the document. */
+const styleScopes = () =>
+  new Set(
+    Array.from(document.querySelectorAll('style[data-token-hash]'), (style) =>
+      style.getAttribute('data-token-hash')
+    )
+  );
+
+/** Card-owned cssVar scope classes used inside one board container. */
+const cardScopes = (testId: string) =>
+  new Set(
+    Array.from(screen.getByTestId(testId).querySelectorAll('[class*="agor-"]')).flatMap((el) =>
+      Array.from(el.classList).filter((cls) => /^agor-(card|ca
```

**File**: `apps/agor-ui/src/components/BranchCard/BranchSessionSections.tsx` (modified, +25/-9)
```diff
@@ -26,7 +26,7 @@ import {
   theme,
 } from 'antd';
 import type React from 'react';
-import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
+import { memo, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
 import { useConnectionDisabled } from '../../contexts/ConnectionContext';
 import { useConfirmArchiveSession } from '../../hooks/useConfirmArchiveSession';
 import { useIdleReady } from '../../hooks/useIdleReady';
@@ -82,9 +82,7 @@ import {
   type SessionTreeNode,
 } from './buildSessionTree';
 import { PagedSessions } from './PagedSessions';
-
-// Stable theme object so the ConfigProvider context value doesn't churn.
-const NO_MOTION_THEME = { token: { motion: false } };
+import { parentCssVarScopeId, sharedCssVarScope } from './sharedCssVarScope';
 
 const SECTION_KEYS: BranchSectionKey[] = ['sessions', 'scheduled-runs', 'gateway-sessions'];
 /** Revealed rows animate in with a short stagger; later rows share the last delay. */
@@ -396,14 +394,35 @@ export const BranchSessionSections: React.FC<BranchSessionSectionsProps> = ({
   const isMobileViewport = useIsMobileViewport();
   // One idle flag per list mounts every row's hover toolbar in a single commit.
   const rowActionsReady = useIdleReady();
+  const isPanel = mode === 'panel';
+  // A nested theme otherwise gets its own useId cssVar scope, so every card on a board
+  // re-injects the full token and component style set. Keying by the parent's token
+  // hash plus its theme recipe (see sharedCssVarScope) makes cards under the same parent
+  // theme share one scope, while light/dark, custom themes, or different algorithms get
+  // their own. If either is unknown, antd falls back to a per-instance scope.
+  const parentThemeConfig = useContext(ConfigProvider.ConfigContext).theme;
+  const parentScopeId = parentCssVarScopeId(
+    (token as { _tokenKey?: string })._tokenKey,
+    parentThemeConfig
+  );
+  // Card mode disables antd motion: 30 cards animating their collapse/tree
+  // mounts multiplies board-mount commits (#1768). Panel mode keeps motion.
+  const noMotionTheme = useMemo(
+    () =>
+      isPanel
+        ? undefined
+        : { token: { motion: false }, ...sharedCssVarScope('card', parentScopeId) },
+    [isPanel, parentScopeId]
+  );
   // Compact chevron column and nesting step for Tree (its defaults are controlHeightSM).
   const compactTreeTheme = useMemo(
     () => ({
       components: {
         Tree: { switcherSize: token.controlHeightXS, indentSize: token.controlHeightXS },
       },
+      ...sharedCssVarScope(isPanel ? 'session-tree' : 'card-session-tree', parentScopeId),
     }),
-    [token.controlHeightXS]
+    [token.controlHeightXS, isPanel, parentScopeId]
   );
   const prefersReducedMotion = usePrefersReducedMotion();
   const [enteringRows, setEnteringRows] = useState(EMPTY_ENTERING_ROWS);
@@ -438,7 +457,6 @@ export const BranchSessionSections: React.FC<BranchSessionSectionsProps> = ({
   const [searchQuery, setSearchQuery] = useState('');
   const [sort, setSort] = useLocalStorage<SessionSort>(SESSION_SORT_STORAGE_KEY, 'recent');
 
-  const isPanel = mode === 'panel';
   const animatePanel = isPanel && token.motion !== false && !prefersReducedMotion;
   const fillPanel = isPanel && fillAvailableHeight;
   const manualTreeSection = useTreeSectionHeight();
@@ -1547,9 +1565,7 @@ export const BranchSessionSections: React.FC<BranchSessionSectionsProps> = ({
   }
 
   return (
-    // Card mode disables antd motion: 30 cards animating their collapse/tree
-    // mounts multiplies board-mount commits (#1768). Panel mode keeps motion.
-    <ConfigProvider theme={isPanel ? undefined : NO_MOTION_THEME}>
+    <ConfigProvider theme={noMotionTheme}>
       {sessionSearchBar}
       {activeSessions.length === 0 ? (
         <div
```

**File**: `apps/agor-ui/src/components/BranchCard/sharedCssVarScope.test.ts` (added, +44/-0)
```diff
@@ -0,0 +1,44 @@
+import { type MappingAlgorithm, type ThemeConfig, theme } from 'antd';
+import { describe, expect, it } from 'vitest';
+import { RECIPE_ID_CACHE_LIMIT, recipeIdCacheSize, themeRecipeId } from './sharedCssVarScope';
+
+/** A fresh algorithm identity that computes the same tokens as the default one. */
+const freshAlgorithm = (): MappingAlgorithm => (seed) => theme.defaultAlgorithm(seed);
+
+describe('themeRecipeId', () => {
+  it('shares an id for equal recipes and separates different algorithms', () => {
+    const algorithm = freshAlgorithm();
+    const a = themeRecipeId({ algorithm, token: { borderRadius: 8 } });
+    expect(a).not.toBeNull();
+    expect(themeRecipeId({ token: { borderRadius: 8 }, algorithm })).toBe(a);
+    expect(themeRecipeId({ algorithm: freshAlgorithm(), token: { borderRadius: 8 } })).not.toBe(a);
+    expect(
+      themeRecipeId({ components: { Tree: { algorithm: freshAlgorithm() } } } as ThemeConfig)
+    ).not.toBe(a);
+  });
+
+  it('stays bounded under fresh algorithm identities and never reuses an id', () => {
+    const count = RECIPE_ID_CACHE_LIMIT * 16;
+    const ids = Array.from({ length: count }, () => themeRecipeId({ algorithm: freshAlgorithm() }));
+    expect(ids).not.toContain(null);
+    expect(new Set(ids).size).toBe(count);
+    expect(recipeIdCacheSize()).toBeLessThanOrEqual(RECIPE_ID_CACHE_LIMIT);
+  });
+
+  it('gives an evicted recipe a new id instead of another recipe’s', () => {
+    const algorithm = freshAlgorithm();
+    const first = themeRecipeId({ algorithm });
+    // A fresh config object bypasses the per-config cache; the recipe is still interned.
+    expect(themeRecipeId({ algorithm })).toBe(first);
+    const seen = new Set([first]);
+    for (let i = 0; i < RECIPE_ID_CACHE_LIMIT; i++) {
+      seen.add(themeRecipeId({ algorithm: freshAlgorithm() }));
+    }
+    const again = themeRecipeId({ algorithm });
+    expect(seen.has(again)).toBe(false);
+  });
+
+  it('returns null for recipes it cannot identify', () => {
+    expect(themeRecipeId({ token: { colorPrimary: new Date() as never } })).toBeNull();
+  });
+});
```

**File**: `apps/agor-ui/src/components/BranchCard/sharedCssVarScope.ts` (added, +112/-0)
```diff
@@ -0,0 +1,112 @@
+import type { ThemeConfig } from 'antd';
+
+/**
+ * Shared antd cssVar scopes for nested themes rendered many times (one per board card).
+ *
+ * antd 6 gives every nested `ConfigProvider` theme its own `useId` cssVar scope, so N cards
+ * inject N copies of the token and component CSS variables. A fixed `cssVar.key` lets
+ * cards share one scope, but cssinjs writes one `<style>` per key: two parents whose
+ * nested themes compute different values must never get the same key.
+ *
+ * The parent's computed-token hash (`_tokenKey`) is not enough on its own. A nested
+ * theme recomputes tokens from the parent's *recipe* (algorithms, seed tokens, component
+ * config) with its own overrides, and two recipes can agree on the parent's tokens yet
+ * diverge under the override. So the key also carries an id for the parent's merged
+ * theme config, in which every function (global and component algorithms) is identified
+ * by reference. Identical recipes share; any difference gets a new scope.
+ */
+
+// biome-ignore lint/complexity/noBannedTypes: algorithms are identified by reference only.
+const functionIds = new WeakMap<Function, number>();
+let nextFunctionId = 0;
+/**
+ * Recipe text -> id, capped so fresh algorithm identities can't grow it forever. Ids come
+ * from a monotonic counter and are never reused: evicting a recipe only means a later
+ * identical recipe gets a new id (a separate scope), never another recipe's scope.
+ */
+export const RECIPE_ID_CACHE_LIMIT = 64;
+const recipeIds = new Map<string, number>();
+let nextRecipeId = 0;
+/** Theme configs from ConfigContext are memoized per provider, so cache by identity. */
+const configRecipeIds = new WeakMap<object, number | null>();
+
+const isPlainObject = (value: object): value is Record<string, unknown> => {
+  const proto = Object.getPrototypeOf(value);
+  return proto === Object.prototype || proto === null;
+};
+
+/** Stable text for a theme config value, or undefined when it can't be identified safely. */
+function serializeRecipe(value: unknown, depth: number): string | undefined {
+  if (value === undefined) return 'u';
+  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
+    return JSON.stringify(value);
+  }
+  if (typeof value === 'number') return Number.isNaN(value) ? 'NaN' : String(value);
+  if (typeof value === 'function') {
+    let id = functionIds.get(value);
+    if (id === undefined) {
+      id = ++nextFunctionId;
+      functionIds.set(value, id);
+    }
+    return `f${id}`;
+  }
+  if (typeof value !== 'object' || depth > 8) return undefined;
+  if (Array.isArray(value)) {
+    const items = value.map((item) => serializeRecipe(item, depth + 1));
+    return items.includes(undefined) ? undefined : `[${items.join(',')}]`;
+  }
+  if (!isPlainObject(value)) return undefined;
+  const entries: string[] = [];
+  for (const key of Object.keys(value).sort()) {
+    // The parent's own scope key never changes a computed value.
+    if (depth === 0 && key === 'cssVar') {
+      const prefix = (value.cssVar as ThemeConfig['cssVar'] & { prefix?: string })?.prefix;
+      entries.push(`cssVar:${JSON.stringify(prefix ?? null)}`);
+      continue;
+    }
+    const serialized = serializeRecipe(value[key], depth + 1);
+    if (serialized === undefined) return undefined;
+    entries.push(`${JSON.stringify(key)}:${serialized}`);
+  }
+  return `{${entries.join(',')}}`;
+}
+
+/** Interned id for a parent theme recipe, or null when the recipe can't be identified. */
+export function themeRecipeId(config: ThemeConfig | undefined): number | null {
+  if (config === undefined) return 0;
+  const cached = configRecipeIds.get(config);
+  if (cached !== undefined) return cached;
+  const recipe = serializeRecipe(config, 0);
+  let id: number | null = null;
+  if (recipe !== undefined) {
+    id = recipeIds.get(recipe) ?? ++nextRecipeId;
+    // Re-insert so the map's insertion order is least-recently-used first.
+    recipeIds.delete(recipe);
+    recipeIds.set(recipe, id);
+    if (recipeIds.size > RECIPE_ID_CACHE_LIMIT) {
+      recipeIds.delete(recipeIds.keys().next().value as string);
+    }
+  }
+  configRecipeIds.set(config, id);
+  return id;
+}
+
+/** Number of interned recipe strings (for tests). */
+export const recipeIdCacheSize = () => recipeIds.size;
+
+/**
+ * Scope identity for nested themes under one parent: its computed-token hash plus its
+ * recipe id. Undefined (antd falls back to a per-instance scope) when either is unknown.
+ */
+export function parentCssVarScopeId(
+  parentTokenKey: string | undefined,
+  parentConfig: ThemeConfig | undefined
+): string | undefined {
+  if (!parentTokenKey) return undefined;
+  const recipeId = themeRecipeId(parentConfig);
+  return recipeId === null ? undefined : `${parentTokenKey}-r${recipeId}`;
+}
+
+/** A cssVar scope shared by every nested theme `name` under the same parent scope id. */
+export const sharedCssVarScope = (name: string,
```

---

### Incident Patch 14: `21faa26b` (2026-10-02)
**Commit Message**: fix(db): repair upgrade guards and add same-tenant owner recovery (#2955)

* fix(db): repair upgrade guards and add same-tenant owner recovery

* test(db): pin the shipped 0.25.2 migration prefix

* docs: remove migration details from execution isolation guide

* fix(docs): isolate Vitest from host configuration

**File**: `.github/workflows/postgres-integration.yml` (modified, +6/-2)
```diff
@@ -64,13 +64,17 @@ env:
 
 jobs:
   postgres-integration:
-    name: PostgreSQL integration (non-superuser RLS)
+    name: PostgreSQL ${{ matrix.pg }} integration (non-superuser RLS)
+    strategy:
+      fail-fast: false
+      matrix:
+        pg: [16, 18]
     runs-on: ubuntu-latest
     timeout-minutes: 15
 
     services:
       postgres:
-        image: pgvector/pgvector:0.8.2-pg16-trixie
+        image: pgvector/pgvector:0.8.2-pg${{ matrix.pg }}-trixie
         env:
           POSTGRES_DB: agor
           POSTGRES_USER: agor_bootstrap
```

**File**: `apps/agor-cli/src/lib/db-migrate-presentation.test.ts` (modified, +20/-1)
```diff
@@ -1,4 +1,8 @@
-import { MigrationError, OfflineMigrationCutoverRequiredError } from '@agor/core/db';
+import {
+  MigrationError,
+  OfflineMigrationCutoverRequiredError,
+  OWNER_ATTRIBUTION_SQLSTATE,
+} from '@agor/core/db';
 import { describe, expect, it } from 'vitest';
 import {
   databaseBackupGuidance,
@@ -98,6 +102,21 @@ describe('db migrate presentation', () => {
     }
   });
 
+  it('gives bounded ownership recovery guidance without printing driver IDs, hints, or SQL', () => {
+    const message = migrationFailureMessage(
+      new MigrationError('Migration failed', {
+        code: OWNER_ATTRIBUTION_SQLSTATE,
+        message: databaseUrl,
+        hint: databaseUrl,
+        query: databaseUrl,
+      })
+    );
+    expect(message).toContain('same-tenant Admin/Superadmin');
+    expect(message).toContain('board_owners/branch_owners');
+    expect(message).toContain('zero-user tenant');
+    expectSecretSafe(message);
+  });
+
   it('retains only explicitly recognized actionable migration failures', () => {
     expect(
       migrationFailureMessage(new OfflineMigrationCutoverRequiredError(['0074_safe']))
```

**File**: `apps/agor-cli/src/lib/db-migrate-presentation.ts` (modified, +8/-1)
```diff
@@ -2,6 +2,7 @@ import {
   type DatabaseDialect,
   formatSanitizedDbError,
   OfflineMigrationCutoverRequiredError,
+  OWNER_ATTRIBUTION_SQLSTATE,
   sanitizeDbError,
 } from '@agor/core/db';
 import { extractDbFilePath } from '@agor/core/utils/path';
@@ -95,5 +96,11 @@ export function migrationFailureMessage(error: unknown): string {
   ) {
     return `Failed to run migrations: ${error.message}`;
   }
-  return `Failed to run migrations: ${formatSanitizedDbError(sanitizeDbError(error))}`;
+  const diagnostic = sanitizeDbError(error);
+  if (diagnostic.code === OWNER_ATTRIBUTION_SQLSTATE) {
+    // Static guidance only: driver messages, hints and resource names are not
+    // safe to print. The SQL exception retains IDs for offline DBA inspection.
+    return 'Failed to run migrations: ownership backfill has no existing owner, creator, or same-tenant Admin/Superadmin. Preserve the data and keep daemons stopped. Explicitly attribute affected boards/branches to a real user in their own tenant through board_owners/branch_owners, then retry. A zero-user tenant needs an operator identity/ownership decision, not deletion or another tenant’s admin. See https://agor.live/guide/multiplayer-unix-isolation#capability-policy-upgrade';
+  }
+  return `Failed to run migrations: ${formatSanitizedDbError(diagnostic)}`;
 }
```

**File**: `apps/agor-docs/content/guide/multiplayer-unix-isolation.mdx` (modified, +0/-27)
```diff
@@ -145,33 +145,6 @@ For roles, file access, ownership transfers, and shared-session gates, see
 Application permissions remain separate from execution isolation: assigning a
 role does not make trusted local `simple` execution a filesystem sandbox.
 
-## Capability-policy upgrade
-
-The normalized board/branch permission migration is a coordinated offline cutover. Stop every daemon, take and test a complete database backup, then run the migration with only the new version installed.
-
-The migration maps legacy access conservatively. Personal sharing grants are
-not broadened into branch-wide access: the new workspace and branch switches
-start off. Some users may therefore have less access after the upgrade. Review
-important board and branch permission screens before resuming normal work.
-
-If a board or branch cannot be attributed to a primary owner, migration stops and lists the affected IDs. Resolve those resources manually rather than assigning an arbitrary owner. Old daemon versions cannot run against the migrated authority model. Rollback requires restoring the complete pre-migration database backup.
-
-## Migrating from 0.24
-
-There is no published 0.24 bridge release for this conversion. Treat the 0.25.1 upgrade as an offline cutover:
-
-1. While still on 0.24.7, drain work, stop **every** daemon connected to the database, and take tested database, configuration, and storage backups.
-2. Install the 0.25.1 software without starting its daemon, then run `agor db migrate --offline-cutover` from 0.25.1.
-3. Obtain the 0.25.1 [`sandbox-home-migration-preflight.sh`](https://github.com/preset-io/agor/blob/v0.25.1/scripts/sandbox-home-migration-preflight.sh) and [`strict-to-sandbox-migration.sh`](https://github.com/preset-io/agor/blob/v0.25.1/scripts/strict-to-sandbox-migration.sh). Review the [full operator runbook](https://github.com/preset-io/agor/blob/v0.25.1/context/guides/migrate-strict-to-sandbox.md).
-4. Run both scripts' read-only checks, then use `--prepare-only` to create and inspect the ownership manifest, config backup, ownership plan, and progress journal. Apply with `--apply --resume` only after that checkpoint is preserved.
-5. Start only 0.25.1 daemons, then verify one real task for every configured agentic tool.
-
-The migration scripts are Linux/GNU-specific reference tooling. They only detect the configured systemd service, so independently verify that foreground and alternate-service daemons are stopped. They do not cross nested mount points, and the ownership manifest is not an automatic rollback tool. Keep host users, groups, sudoers, and all recovery artifacts through a production soak. The safest full rollback is to stop 0.25.1 and restore the complete pre-upgrade backup.
-
-Version 0.25 refuses `strict`, `insulated`, and `opportunistic` configuration values; it does not downgrade them to `simple`. For migration help, bring the dry-run output and deployment layout to [Discord](https://discord.gg/Qh4TrFQZpd) before applying filesystem changes.
-
-Historical `unix_group` database values remain nullable for rollback and audit but are no longer written or interpreted. `unix_username` remains temporarily as the delegated home key and immutable session stamp.
-
 ## Related
 
 - [Security](/security)
```

**File**: `apps/agor-docs/vitest.config.ts` (modified, +1/-0)
```diff
@@ -3,6 +3,7 @@ import { defineConfig } from 'vitest/config';
 export default defineConfig({
   test: {
     environment: 'node',
+    setupFiles: ['../../test/isolate-host-env.ts'],
     include: ['lib/**/*.test.ts'],
   },
 });
```

**File**: `context/guides/creating-database-migrations.md` (modified, +19/-0)
```diff
@@ -193,6 +193,25 @@ grant/refresh fences and never changes attribution. Keep this ordering when
 adding writers; taking a user lock after a token-row lock reverses the cascade
 order. No provider round-trip is held inside the persistence transaction.
 
+### Repairs to blocked historical migrations
+
+The owner fallback in PostgreSQL `0095` / SQLite `0098` and the PostgreSQL `0103`
+NOT NULL fingerprint repair intentionally edit the blocked migration, not a new
+suffix which the blocked database could never reach. Journal watermarks are
+unchanged. Drizzle records SQL hashes but selects pending work by timestamp;
+it does not re-run or checksum-reject an already-applied migration. Release
+packaging copies these SQL files into the packaged migrations directory.
+Do not rewrite an operator's ledger. The authenticated archived-head hash used
+by `0103` to authorize destructive reconciliation is a separate provenance
+check and remains unchanged.
+
+PostgreSQL 18 catalogs NOT NULL constraints with table-derived names. `0103`
+compares their column identity instead of the real/reference table name, while
+retaining their definition, validation, enforcement, and inheritance metadata.
+Other constraint names, indexes, policies, columns, FKs and the destructive
+legacy-shape/ledger protections remain validated. Both the fresh and historical
+migration paths exercise this guard; a fresh install is not exempt.
+
 ### Schemas drifting
 
 If you only update one schema, generation succeeds for that dialect and silently leaves the other one stale. Catch it before merge:
```

**File**: `packages/core/drizzle/postgres/0095_board_branch_capability_policies.sql` (modified, +17/-6)
```diff
@@ -29,24 +29,35 @@ UPDATE "boards" b SET "primary_owner_user_id" = COALESCE(
   (SELECT bo.user_id FROM board_owners bo JOIN users u ON u.tenant_id=bo.tenant_id AND u.user_id=bo.user_id
    WHERE bo.tenant_id=b.tenant_id AND bo.board_id=b.board_id
    ORDER BY bo.created_at NULLS LAST,bo.user_id LIMIT 1),
-  (SELECT u.user_id FROM users u WHERE u.tenant_id=b.tenant_id AND u.user_id=b.created_by)
+  (SELECT u.user_id FROM users u WHERE u.tenant_id=b.tenant_id AND u.user_id=b.created_by),
+  -- Last resort only: an existing administrator in THIS tenant. Row existence
+  -- is the persisted active-user contract; there is no user soft-delete flag.
+  (SELECT u.user_id FROM users u WHERE u.tenant_id=b.tenant_id AND u.role IN ('admin','superadmin')
+   ORDER BY u.created_at NULLS LAST,u.user_id COLLATE "C" LIMIT 1)
 );
 --> statement-breakpoint
 UPDATE "branches" br SET "primary_owner_user_id" = COALESCE(
   (SELECT bo.user_id FROM branch_owners bo JOIN users u ON u.tenant_id=bo.tenant_id AND u.user_id=bo.user_id
    WHERE bo.tenant_id=br.tenant_id AND bo.branch_id=br.branch_id
    ORDER BY bo.created_at NULLS LAST,bo.user_id LIMIT 1),
-  (SELECT u.user_id FROM users u WHERE u.tenant_id=br.tenant_id AND u.user_id=br.created_by)
+  (SELECT u.user_id FROM users u WHERE u.tenant_id=br.tenant_id AND u.user_id=br.created_by),
+  -- Last resort only: an existing administrator in THIS tenant. Row existence
+  -- is the persisted active-user contract; there is no user soft-delete flag.
+  (SELECT u.user_id FROM users u WHERE u.tenant_id=br.tenant_id AND u.role IN ('admin','superadmin')
+   ORDER BY u.created_at NULLS LAST,u.user_id COLLATE "C" LIMIT 1)
 );
 --> statement-breakpoint
 DO $$
 DECLARE failures text;
 BEGIN
-  SELECT string_agg(kind||':'||id, ', ' ORDER BY kind,id) INTO failures FROM (
-    SELECT 'board' kind, board_id id FROM boards WHERE primary_owner_user_id IS NULL
-    UNION ALL SELECT 'branch', branch_id FROM branches WHERE primary_owner_user_id IS NULL
+  SELECT string_agg('tenant='||tenant_id||' '||kind||':'||id, ', ' ORDER BY tenant_id,kind,id) INTO failures FROM (
+    SELECT tenant_id, 'board' kind, board_id id FROM boards WHERE primary_owner_user_id IS NULL
+    UNION ALL SELECT tenant_id, 'branch', branch_id FROM branches WHERE primary_owner_user_id IS NULL
   ) missing;
-  IF failures IS NOT NULL THEN RAISE EXCEPTION 'RBAC migration cannot attribute primary owners: %', failures; END IF;
+  IF failures IS NOT NULL THEN
+    RAISE EXCEPTION 'RBAC migration cannot attribute primary owners: %', failures
+      USING ERRCODE = 'P0095', HINT = 'No existing owner, creator, or same-tenant admin/superadmin is available. Preserve the data: explicitly attribute each resource to a real user in its tenant using board_owners/branch_owners, then retry the offline migration. A zero-user tenant requires an operator identity/ownership decision; do not borrow another tenant''s user or delete data to bypass this check.';
+  END IF;
 END $$;
 --> statement-breakpoint
 ALTER TABLE "boards" ALTER COLUMN "primary_owner_user_id" SET NOT NULL;
```

**File**: `packages/core/drizzle/postgres/0103_oauth_authority_watermark_reconciliation.sql` (modified, +7/-2)
```diff
@@ -37,10 +37,15 @@ LANGUAGE sql STABLE PARALLEL SAFE AS $$
     ),
     'constraints', (
       SELECT COALESCE(jsonb_agg(jsonb_build_array(
-        con.conname, con.contype, con.condeferrable, con.condeferred,
+        -- PostgreSQL 18 catalogs NOT NULL constraints with table-derived names.
+        -- Compare their column identity, not the real/temp relation's name;
+        -- retain validation/inheritance flags and the complete definition.
+        CASE WHEN con.contype = 'n' THEN 'not_null:' || con.conkey::text ELSE con.conname END,
+        con.contype, con.condeferrable, con.condeferred,
         con.convalidated, con.conislocal, con.coninhcount, con.connoinherit,
+        COALESCE((to_jsonb(con)->>'conenforced')::boolean, true),
         pg_temp.agor_0102_norm(pg_get_constraintdef(con.oid, false))
-      ) ORDER BY con.conname), '[]'::jsonb)
+      ) ORDER BY CASE WHEN con.contype = 'n' THEN 'not_null:' || con.conkey::text ELSE con.conname END), '[]'::jsonb)
       FROM pg_constraint con
       WHERE con.conrelid = relation AND con.contype <> 'f'
     ),
```

---

### Incident Patch 15: `bdd9d57b` (2026-10-02)
**Commit Message**: fix(ui): pad conversation footer and show persistent activity spinner (#2944)

* fix(ui): pad conversation footer and show persistent activity spinner

* fix(ui): tighten conversation footer bottom spacing

* fix(ui): vertically center footer activity with action buttons

**File**: `apps/agor-ui/src/components/SessionPanel/SessionFooter.layout.browser.test.tsx` (added, +176/-0)
```diff
@@ -0,0 +1,176 @@
+import { type Session, SessionStatus } from '@agor-live/client';
+import { cleanup, render, screen, waitFor } from '@testing-library/react';
+import type {} from '@vitest/browser-playwright';
+import { App, ConfigProvider, theme } from 'antd';
+import { afterEach, beforeEach, expect, it, vi } from 'vitest';
+import { cdp, page } from 'vitest/browser';
+import { AppActionsProvider } from '../../contexts/AppActionsContext';
+import { ConnectionProvider } from '../../contexts/ConnectionContext';
+import globalCss from '../../index.css?raw';
+import SessionPanel from './SessionPanel';
+
+// Keep the actual panel and composer layout; substitute only transcript data
+// with a long scrollable history so the test needs no daemon or live agent.
+vi.mock('./SessionPanelContent', () => ({
+  SessionPanelContent: () => (
+    <div data-testid="history" style={{ flex: 1, overflow: 'auto' }}>
+      {Array.from({ length: 100 }, (_, i) => `Conversation message ${i + 1}`).map((message) => (
+        <p key={message}>{message}</p>
+      ))}
+    </div>
+  ),
+}));
+vi.mock('../ForkSpawnModal/ForkSpawnModal', () => ({ ForkSpawnModal: () => null }));
+
+const session = {
+  session_id: 'footer-layout-session',
+  branch_id: 'footer-layout-branch',
+  agentic_tool: 'codex',
+  title: 'Conversation controls',
+  status: SessionStatus.RUNNING,
+} as Session;
+const noop = () => {};
+const originalViewport = { width: window.innerWidth, height: window.innerHeight };
+const bottomInset = theme.getDesignToken().sizeUnit * 2;
+
+beforeEach(async () => {
+  localStorage.clear();
+  document.body.style.margin = '0';
+  // The browser suite's 1000px desktop fixture is below the mobile-shell
+  // breakpoint. Also exercise the actual desktop composer, including embeds.
+  if (originalViewport.width === 1000) await page.viewport(1280, 900);
+});
+afterEach(async () => {
+  cleanup();
+  await cdp().send('Emulation.setEmulatedMedia', { features: [] });
+  await page.viewport(originalViewport.width, originalViewport.height);
+});
+
+function panel(status: Session['status'], embedded: boolean) {
+  return (
+    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm }}>
+      {/* Apply the app's actual reduced-motion rules without fetching web fonts. */}
+      <style>{globalCss.replace(/@import[^;]+;/g, '')}</style>
+      <App>
+        <ConnectionProvider
+          value={{
+            connected: true,
+            connecting: false,
+            authGeneration: 1,
+            outOfSync: false,
+            capturedSha: null,
+            currentSha: null,
+          }}
+        >
+          <AppActionsProvider value={{}}>
+            <div
+              data-testid="panel"
+              style={{
+                width: embedded ? Math.min(420, window.innerWidth) : '100%',
+                height: window.innerHeight,
+                overflow: 'hidden',
+                borderRadius: 12,
+              }}
+            >
+              <SessionPanel client={null} session={{ ...session, status }} open onClose={noop} />
+            </div>
+          </AppActionsProvider>
+        </ConnectionProvider>
+      </App>
+    </ConfigProvider>
+  );
+}
+
+it.each([false, true])(
+  'keeps padded controls and activity visible while reading older messages (embedded=%s)',
+  async (embedded) => {
+    const view = render(panel(SessionStatus.RUNNING, embedded));
+    const history = screen.getByTestId('history');
+    const stop = screen.getByRole('button', { name: 'Stop' });
+    const send = screen.getByRole('button', { name: 'Send' });
+    const activity = screen.getByRole('status', { name: 'Agent is working' });
+    const bounds = screen.getByTestId('panel').getBoundingClientRect();
+    await waitFor(() => expect(history.scrollHeight).toBeGreaterThan(history.clientHeight));
+
+    const buttonBounds = send.getBoundingClientRect();
+    for (const control of [stop, send, activity]) {
+      const rect = control.getBoundingClientRect();
+      expect(rect.left).toBeGreaterThanOrEqual(bounds.left);
+      expect(rect.right).toBeLessThanOrEqual(bounds.right);
+      expect(rect.bottom).toBeLessThanOrEqual(bounds.bottom - bottomInset);
+      expect(rect.top).toBeGreaterThanOrEqual(bounds.top);
+      expect(
+        document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)
+      ).toSatisfy((element: Element | null) => !!element && control.contains(element));
+    }
+    expect(activity.getBoundingClientRect().right).toBeLessThan(stop.getBoundingClientRect().left);
+    const expectCenteredActivity = () => {
+      // Measure the visible indicator, not its status wrapper's line box.
+      const indicator = activity.querySelector('.ant-spin-dot-holder')!.getBoundingClientRect();
+      const center = indicator.top + indicator.height / 2;
+      for (const button of [stop, send]) {
+        const rect = button.getBoundingClientRect();
+        expect(Math.abs(center - (rect.top + rect.height / 2))).t
```

**File**: `apps/agor-ui/src/components/SessionPanel/SessionFooter.test.tsx` (modified, +51/-15)
```diff
@@ -8,6 +8,7 @@ import type {
   PermissionMode,
   Session,
 } from '@agor-live/client';
+import { SessionStatus } from '@agor-live/client';
 import {
   act,
   fireEvent,
@@ -22,7 +23,7 @@ import type React from 'react';
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
 import { ConnectionProvider } from '../../contexts/ConnectionContext';
 import { useFooterPreferences } from '../../hooks/useFooterPreferences';
-import { SessionFooter } from './SessionFooter';
+import { SessionFooter, type SessionFooterProps } from './SessionFooter';
 
 vi.mock('../../hooks/useAuth', () => ({
   useAuth: () => ({ user: { user_id: 'footer-user', role: 'member' } }),
@@ -50,14 +51,14 @@ const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
   </ConfigProvider>
 );
 
-const baseSession: Session = {
+const baseSession: SessionFooterProps['session'] = {
   session_id: 'test-session-123',
   status: 'idle' as Session['status'],
   agentic_tool: 'claude-code',
   model_config: undefined,
-} as unknown as Session;
+} as unknown as SessionFooterProps['session'];
 
-const baseProps = {
+const baseProps: SessionFooterProps = {
   session: baseSession,
   footerTimerTask: null,
   latestContextWindow: null,
@@ -73,8 +74,8 @@ const baseProps = {
   connectionDisabled: false,
   effortLevel: 'high' as EffortLevel,
   permissionMode: 'default' as PermissionMode,
-  codexSandboxMode: 'on' as CodexSandboxMode,
-  codexApprovalPolicy: 'auto' as CodexApprovalPolicy,
+  codexSandboxMode: 'workspace-write' as CodexSandboxMode,
+  codexApprovalPolicy: 'on-request' as CodexApprovalPolicy,
   queuedTasks: [],
   client: null,
   modelLabel: undefined,
@@ -136,6 +137,41 @@ describe('SessionFooter', () => {
     expect(screen.getByRole('button', { name: /stop/i })).toBeInTheDocument();
   });
 
+  it('shows named activity only while working and clears it on every non-running state', () => {
+    const session = { ...baseSession, status: SessionStatus.RUNNING };
+    const view = render(<SessionFooter {...baseProps} session={session} isRunning />, {
+      wrapper: Wrapper,
+    });
+    expect(screen.getByRole('status', { name: 'Agent is working' })).toBeVisible();
+
+    for (const status of Object.values(SessionStatus).filter((s) => s !== SessionStatus.RUNNING)) {
+      view.rerender(<SessionFooter {...baseProps} session={{ ...session, status }} />);
+      expect(screen.queryByRole('status', { name: 'Agent is working' })).not.toBeInTheDocument();
+    }
+    view.rerender(<SessionFooter {...baseProps} session={session} isRunning />);
+    expect(screen.getByRole('status', { name: 'Agent is working' })).toBeVisible();
+    view.rerender(<SessionFooter {...baseProps} session={session} isRunning stopRequestInFlight />);
+    expect(screen.queryByRole('status', { name: 'Agent is working' })).not.toBeInTheDocument();
+    expect(screen.getByRole('button', { name: 'Stop' })).toHaveAttribute('aria-busy', 'true');
+    view.rerender(<SessionFooter {...baseProps} session={session} isRunning connectionDisabled />);
+    expect(screen.queryByRole('status', { name: 'Agent is working' })).not.toBeInTheDocument();
+  });
+
+  it('preserves the themed desktop bottom inset on the owning footer', () => {
+    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1280);
+    try {
+      render(
+        <ConfigProvider theme={{ token: { sizeUnit: 6 } }}>
+          <SessionFooter {...baseProps} />
+        </ConfigProvider>
+      );
+      const footer = screen.getByTestId('prompt-input').parentElement!.parentElement!;
+      expect(footer).toHaveStyle({ paddingBottom: '12px', flexShrink: '0' });
+    } finally {
+      vi.restoreAllMocks();
+    }
+  });
+
   it('disables Stop while the daemon connection is unavailable', () => {
     const { container } = render(
       <SessionFooter {...baseProps} isRunning={true} connectionDisabled={true} />,
@@ -165,7 +201,7 @@ describe('SessionFooter', () => {
             ...baseSession,
             agentic_tool: 'opencode',
             model_config: undefined,
-          } as unknown as Session
+          } as unknown as SessionFooterProps['session']
         }
       />,
       { wrapper: Wrapper }
@@ -188,7 +224,7 @@ describe('SessionFooter', () => {
             ...baseSession,
             agentic_tool: 'claude-code',
             model_config: undefined,
-          } as unknown as Session
+          } as unknown as SessionFooterProps['session']
         }
       />,
       { wrapper: Wrapper }
@@ -212,7 +248,7 @@ describe('SessionFooter', () => {
     );
     const chip = screen.getByText('85%');
     expect(chip.querySelector('.anticon-percentage')).toBeNull();
-    expect(chip).toHaveTextContent(/^85%$/);
+    expect(chip.textContent).toMatch(/^85%$/);
     expect(chip).toBeInTheDocument();
     expect(chip.closest('.ant-tag')).toHaveClass('ant-tag-red');
   });
@@ -225,7 +261,7 @@ describe('SessionFooter', () => {
           {
             ...baseSession,
  
```

**File**: `apps/agor-ui/src/components/SessionPanel/SessionFooter.tsx` (modified, +75/-49)
```diff
@@ -10,7 +10,7 @@ import type {
   Session,
   Task,
 } from '@agor-live/client';
-import { getDefaultModelForTool } from '@agor-live/client';
+import { getDefaultModelForTool, SessionStatus } from '@agor-live/client';
 import {
   BranchesOutlined,
   ClockCircleOutlined,
@@ -1331,6 +1331,10 @@ const SessionFooterInner: React.FC<SessionFooterProps> = ({
         : 'Stop Execution';
 
   const showStop = isRunning || stopRequestInFlight;
+  // isRunning also includes stopping for the action controls. Only advertise
+  // active work here, not permission/input waits or a stale offline state.
+  const showActivity =
+    session.status === SessionStatus.RUNNING && !stopRequestInFlight && !connectionDisabled;
 
   const sendLabel = isRunning && hasInput ? 'Queue' : 'Send';
   const sendTooltip = connectionDisabled
@@ -1348,10 +1352,13 @@ const SessionFooterInner: React.FC<SessionFooterProps> = ({
         flexShrink: 0,
         background: token.colorBgContainer,
         borderTop: `1px solid ${token.colorBorder}`,
-        padding: `${token.sizeUnit * 2}px ${isMobile ? token.padding : token.sizeUnit * 6}px ${token.sizeUnit * 3}px`,
+        // Keep all padding longhand: an undefined desktop paddingBottom clears
+        // the bottom inset supplied by a padding shorthand in React.
+        paddingTop: token.paddingXS,
+        paddingInline: isMobile ? token.padding : token.paddingLG,
         paddingBottom: isMobile
-          ? `max(${token.sizeUnit * 3}px, env(safe-area-inset-bottom))`
-          : undefined,
+          ? `max(${token.sizeUnit * 2}px, env(safe-area-inset-bottom))`
+          : token.sizeUnit * 2,
         marginLeft: -token.sizeUnit * 6,
         marginRight: -token.sizeUnit * 6,
       }}
@@ -1620,6 +1627,7 @@ const SessionFooterInner: React.FC<SessionFooterProps> = ({
         <div
           style={{
             display: 'flex',
+            flexWrap: 'wrap',
             alignItems: 'center',
             gap: token.sizeUnit,
             marginTop: token.sizeUnit * 2,
@@ -1730,54 +1738,72 @@ const SessionFooterInner: React.FC<SessionFooterProps> = ({
             )}
           </Space>
 
-          {/* Spacer */}
-          <div style={{ flex: 1 }} />
-
           {/* Right group */}
-          <Space size={4}>
-            {showStop && (
-              <Tooltip title={stopTooltip}>
-                <Button
-                  danger
-                  aria-label="Stop"
-                  aria-busy={stopRequestInFlight || isStopping}
-                  size={actionSize}
-                  style={touchActionStyle}
-                  icon={
-                    stopRequestInFlight || isStopping ? <Spin size="small" /> : <StopOutlined />
-                  }
-                  onClick={onStop}
-                  disabled={connectionDisabled || !isRunning || stopRequestInFlight}
+          <Flex
+            align="center"
+            gap={token.marginXS}
+            style={{ marginInlineStart: 'auto', flexShrink: 0 }}
+          >
+            {/* Reserve the compact slot so activity changes never move controls.
+                Spin inherits the shared reduced-motion rule in index.css. */}
+            <Flex
+              align="center"
+              justify="center"
+              style={{ width: token.controlHeightXS, flexShrink: 0 }}
+            >
+              {showActivity && (
+                <span role="status" aria-label="Agent is working" style={{ display: 'flex' }}>
+                  <Spin size="small" aria-hidden="true" />
+                </span>
+              )}
+            </Flex>
+            {/* Flex avoids inline baseline/descender space around the controls. */}
+            <Flex align="center" gap={token.sizeUnit}>
+              {showStop && (
+                <Tooltip title={stopTooltip}>
+                  <Button
+                    danger
+                    aria-label="Stop"
+                    aria-busy={stopRequestInFlight || isStopping}
+                    size={actionSize}
+                    style={touchActionStyle}
+                    icon={
+                      stopRequestInFlight || isStopping ? <Spin size="small" /> : <StopOutlined />
+                    }
+                    onClick={onStop}
+                    disabled={connectionDisabled || !isRunning || stopRequestInFlight}
+                  >
+                    Stop
+                  </Button>
+                </Tooltip>
+              )}
+              <Tooltip title={sendTooltip}>
+                <Badge
+                  count={queuedTasks.length > 0 ? queuedTasks.length : 0}
+                  size="small"
+                  offset={[-2, 2]}
+                  styles={{ root: { display: 'inline-flex' } }}
+                  style={{
+                    boxShadow: 'none',
+                    backgroundColor: token.colorTextTertiary,
+                    fontSize: 10,
+                  }}
                 >
-                  Stop
-                </Button>
+       
```

#### Recent Merged Pull Requests:
- **PR #2980** (2026-10-05): docs(readme): align README with Multiplayer AI messaging and npm-first install (@annalytics16)
- **PR #2979** (2026-10-05): fix(onboarding): recover repository bootstrap without deleting existing work (@mistercrunch)
- **PR #2972** (2026-10-02): fix(branches): publish board creation events after commit (@mistercrunch)
- **PR #2971** (2026-10-03): fix: clarify environment logs and make Railway cleanup resumable (@mistercrunch)
- **PR #2969** (2026-10-02): feat(opencode): share hosted OpenCode sessions through the branch SDK home (@richardfogaca)
- **PR #2968** (2026-10-02): fix(branches): support safe archive cleanup on Cloud executors (@mistercrunch)
- **PR #2967** (2026-10-02): chore(release): prepare agor-live 0.26.9 (@mistercrunch)
- **PR #2966** (2026-10-02): Make native Codex plugins an opt-in session configuration (@mistercrunch)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
