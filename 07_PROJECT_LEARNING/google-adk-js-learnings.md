# Forensic Learning Record (Deep Inspection): google/adk-js

> **Canonical Artifact**: `07_PROJECT_LEARNING/google-adk-js-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/google/adk-js](https://github.com/google/adk-js))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:59:38.420Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `google/adk-js`
- **Description**: An open-source, code-first Typescript toolkit for building, evaluating, and deploying sophisticated AI agents with flexibility and control.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1431 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `core/src/a2a/a2a_event.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Part as A2APart,
  Message,
  Task,
  TaskArtifactUpdateEvent,
  TaskStatusUpdateEvent,
} from '@a2a-js/sdk';
import {randomUUID} from '../utils/env_aware_utils.js';

/**
 * Message roles.
 */
export enum MessageRole {
  USER = 'user',
  AGENT = 'agent',
}

/**
 * Task states.
 */
export enum TaskState {
  SUBMITTED = 'submitted',
  WORKING = 'working',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELED = 'canceled',
  REJECTED = 'rejected',
  INPUT_REQUIRED = 'input-required',
}

/**
 * A2A event.
 */
export type A2AEvent =
  Task | Message | TaskStatusUpdateEvent | TaskArtifactUpdateEvent;

/**
 * Checks if the event is an A2A TaskStatusUpdateEvent.
 */
export function isTaskStatusUpdateEvent(
  event: unknown,
): event is TaskStatusUpdateEvent {
  return (event as TaskStatusUpdateEvent)?.kind === 'status-update';
}

/**
 * Checks if the event is an A2A TaskArtifactUpdateEvent.
 */
export function isTaskArtifactUpdateEvent(
  event: unknown,
): event is TaskArtifactUpdateEvent {
  return (event as TaskArtifactUpdateEvent)?.kind === 'artifact-update';
}

/**
 * Checks if the event is an A2A Message.
 */
export function isMessage(event: unknown): event is Message {
  return (event as Message)?.kind === 'message';
}

/**
 * Checks if the event is an A2A Task.
 */
export function isTask(event: unknown): event is Task {
  return (event as Task)?.kind === 'task';
}

/**
 * Gets the metadata from an A2A event.
 */
export function getEventMetadata(event: A2AEvent): Record<string, unknown> {
  if (isTaskArtifactUpdateEvent(event)) {
    return event.artifact.metadata || {};
  }

  if (isTaskStatusUpdateEvent(event) || isTask(event) || isMessage(event)) {
    return event.metadata || {};
  }

  return {};
}

/**
 * Checks if the event is a failed task status update event.
 */
export function isFailedTaskStatusUpdateEvent(event: unknown): boolean {
  return (
    (isTaskStatusUpdateEvent(event) || isTask(event)) &&
    event.status.state === TaskState.FAILED
  );
}

/**
 * Checks if the event is a terminal task status update event.
 */
export function isTerminalTaskStatusUpdateEvent(event: unknown): boolean {
  return (
    (isTaskStatusUpdateEvent(event) || isTask(event)) &&
    [
      TaskState.COMPLETED,
      TaskState.FAILED,
      TaskState.CANCELED,
      TaskState.REJECTED,
    ].includes(event.status.state as TaskState)
  );
}

/**
 * Checks if the event is an input required task status update event.
 */
export function isInputRequiredTaskStatusUpdateEvent(event: unknown): boolean {
  return (
    (isTaskStatusUpdateEvent(event) || isTask(event)) &&
    event.status.state === TaskState.INPUT_REQUIRED
  );
}

/**
 * Gets the error message from a failed task status update event.
 */
export function getFailedTaskStatusUpdateEventError(
  event: TaskStatusUpdateEvent | Task,
): string | undefined {
  if (!isFailedTaskStatusUpdateEvent(event)) {
    return undefined;
  }

  const parts = event.status.message?.parts || [];
  if (parts.length === 0) {
    return undefined;
  }

  if (parts[0].kind !== 'text') {
    return undefined;
  }

  return parts[0].text;
}

/**
 * Creates a task submitted event.
 */
export function createTaskSubmittedEvent({
  taskId,
  contextId,
  message,
  metadata,
}: {
  taskId: string;
  contextId: string;
  message: Message;
  metadata?: Record<string, unknown>;
}): TaskStatusUpdateEvent {
  return {
    kind: 'status-update',
    taskId,
    contextId,
    final: false,
    status: {
      state: TaskState.SUBMITTED,
      message,
      timestamp: new Date().toISOString(),
    },
    metadata,
  };
}

/**
 * Creates a task with submitted status.
 */
export function createTask({
  contextId,
  message,
  taskId,
  metadata,
}: {
  taskId: string;
  contextId: string;
  message: Message;
  metadata?: Record<string, unknown>;
}): Task {
  return {
    kind: 'task',
    id: taskId || randomUUID(),
    contextId,
    history: [message],
    status: {
      state: TaskState.SUBMITTED,
      timestamp: new Date().toISOString(),
    },
    metadata,
  };
}

/**
 * Creates a task working event.
 */
export function createTaskWorkingEvent({
  taskId,
  contextId,
  message,
  metadata,
}: {
  taskId: string;
  contextId: string;
  message?: Message;
  metadata?: Record<string, unknown>;
}): TaskStatusUpdateEvent {
  return {
    kind: 'status-update',
    taskId,
    contextId,
    final: false,
    status: {
      state: TaskState.WORKING,
      message,
      timestamp: new Date().toISOString(),
    },
    metadata,
  };
}

/**
 * Creates a task completed event.
 */
export function createTaskCompletedEvent({
  taskId,
  contextId,
  metadata,
}: {
  taskId: string;
  contextId: string;
  metadata?: Record<string, unknown>;
}): TaskStatusUpdateEvent {
  return {
    kind: 'status-update',
    taskId,
    contextId,
    final: true,
    status: {
      state: TaskState.COMPLETED,
      timestamp: new Date().toISOString(),
    },
    metadata,
  };
}

/**
 * Creates an artifact update event.
 */
export function createTaskArtifactUpdateEvent({
  taskId,
  contextId,
  artifactId,
  parts = [],
  metadata,
  append,
  lastChunk,
}: {
  taskId: string;
  contextId: string;
  artifactId?: string;
  parts?: A2APart[];
  metadata?: Record<string, unknown>;
  append?: boolean;
  lastChunk?: boolean;
}): TaskArtifactUpdateEvent {
  return {
    kind: 'artifact-update',
    taskId,
    contextId,
    append,
    lastChunk,
    artifact: {
      artifactId: artifactId || randomUUID(),
      parts,
    },
    metadata,
  };
}

/**
 * Creates an error message for task execution failure.
 */
export function createTaskFailedEvent({
  taskId,
  contextId,
  error,
  metadata,
}: {
  taskId: string;
  contextId: string;
  error: Error;
  metadata?: Record<string, unknown>;
}): TaskStatusUpdateEvent {
  return {
    kind: 'status-update',
    taskId,
    contextId,
    final: true,
    status: {
      state: TaskState.FAILED,
      message: {
        kind: 'message',
        messageId: randomUUID(),
        role: 'agent',
        taskId,
        contextId,
        parts: [
          {
            kind: 'text',
            text: error.message,
          },
        ],
      },
      timestamp: new Date().toISOString(),
    },
    metadata,
  };
}

/**
 * Creates an input-required status update.
 *
 * A2A has one `input-required` state, so every reason an agent can pause for a
 * human produces the same status update: a long-running tool asking for input,
 * and a client message that left an earlier request unanswered. What separates
 * them travels in `parts` — a validation failure carries a text part marked
 * `validation_error` — not in the shape of the event, so both go through here.
 */
export function createTaskInputRequiredEvent({
  taskId,
  contextId,
  parts,
  metadata,
}: {
  taskId: string;
  contextId: string;
  parts: A2APart[];
  metadata?: Record<string, unknown>;
}): TaskStatusUpdateEvent {
  return {
    kind: 'status-update',
    taskId,
    contextId,
    final: true,
    status: {
      state: TaskState.INPUT_REQUIRED,
      message: {
        kind: 'message',
        messageId: randomUUID(),
        role: 'agent',
        taskId,
        contextId,
        parts,
      },
      timestamp: new Date().toISOString(),
    },
    metadata,
  };
}

```

### Core Architecture Module: `core/src/a2a/a2a_remote_agent.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Part as A2APart,
  AGENT_CARD_PATH,
  AgentCard,
  Message,
  MessageSendConfiguration,
  MessageSendParams,
  Task,
  TaskArtifactUpdateEvent,
  TaskStatusUpdateEvent,
} from '@a2a-js/sdk';
import {Client, ClientFactory} from '@a2a-js/sdk/client';
import {BaseAgent, BaseAgentConfig} from '../agents/base_agent.js';
import {InvocationContext} from '../agents/invocation_context.js';
import {Event as AdkEvent, createEvent} from '../events/event.js';
import {randomUUID} from '../utils/env_aware_utils.js';
import {logger} from '../utils/logger.js';
import {MessageRole} from './a2a_event.js';
import {A2ARemoteAgentRunProcessor} from './a2a_remote_agent_run_processor.js';
import {
  getUserFunctionCallAt,
  peerRequestedCallIds,
  toForwardableA2AParts,
  toMissingRemoteSessionParts,
} from './a2a_remote_agent_utils.js';
import {resolveAgentCard, ResolveAgentCardOptions} from './agent_card.js';
import {toAdkEvent} from './event_converter_utils.js';
import {getA2ASessionMetadata} from './metadata_converter_utils.js';

export {AGENT_CARD_PATH};

/**
 * Type alias for A2A stream event data.
 */
export type A2AStreamEventData =
  Message | Task | TaskStatusUpdateEvent | TaskArtifactUpdateEvent;

/**
 * Callback called before sending a request to the remote agent.
 * Allows modifying the request parameters.
 *
 * @param ctx - The current invocation context, providing access to session
 *   state, agent metadata, and services.
 * @param params - The A2A message send parameters that will be sent to the
 *   remote agent. Mutations to this object are reflected in the outgoing
 *   request.
 * @returns A Promise or void. Returning a rejected Promise aborts the request.
 */
export type BeforeA2ARequestCallback = (
  ctx: InvocationContext,
  params: MessageSendParams,
) => Promise<void> | void;

/**
 * Callback called after receiving a response from the remote agent.
 * Allows inspecting or modifying the response.
 *
 * @param ctx - The current invocation context, providing access to session
 *   state, agent metadata, and services.
 * @param resp - The raw A2A stream event data received from the remote agent,
 *   before conversion to an ADK event.
 * @returns A Promise or void. Returning a rejected Promise stops further
 *   processing of the response.
 */
export type AfterA2ARequestCallback = (
  ctx: InvocationContext,
  resp: A2AStreamEventData,
) => Promise<void> | void;

/**
 * Configuration for the A2ARemoteAgent.
 */
export interface RemoteA2AAgentConfig extends BaseAgentConfig {
  /**
   * Loaded AgentCard or URL to AgentCard.
   */
  agentCard?: AgentCard | string;

  /**
   * Controls how a fetched agent card's RPC URL(s) are validated against
   * the location the card was fetched from. Only relevant when
   * {@link RemoteA2AAgentConfig.agentCard} is a URL rather than an
   * already-loaded card object; see {@link ResolveAgentCardOptions} for
   * what each option relaxes and why both default to failing closed.
   */
  resolveAgentCardOptions?: ResolveAgentCardOptions;

  /**
   * Optional pre-initialized Client for connection pooling.
   */
  client?: Client;

  /**
   * Optional ClientFactory for creating the A2A Client.
   */
  clientFactory?: ClientFactory;
  /**
   * Optional default configuration for sending messages.
   */
  messageSendConfig?: MessageSendConfiguration;
  /**
   * Callbacks run before the remote request is sent.
   */
  beforeRequestCallbacks?: BeforeA2ARequestCallback[];
  /**
   * Callbacks run after receiving a response chunk or event, before conversion.
   */
  afterRequestCallbacks?: AfterA2ARequestCallback[];
  /**
   * Optional request-level metadata to include in the A2A message send request.
   * If omitted, defaults to `context.a2aMetadata` from the current invocation context.
   */
  metadata?: Record<string, unknown>;
}

/**
 * RemoteA2AAgent delegates execution to a remote agent using the A2A protocol.
 *
 * @remarks
 * A cloned `RemoteA2AAgent` (via {@link BaseAgent.clone}) is a fresh,
 * uninitialized instance that re-resolves its client and card on first use.
 */
export class RemoteA2AAgent extends BaseAgent<RemoteA2AAgentConfig> {
  private client?: Client;
  private card?: AgentCard;
  private isInitialized = false;

  constructor(private readonly a2aConfig: RemoteA2AAgentConfig) {
    super(a2aConfig);
    if (!a2aConfig.agentCard && !a2aConfig.client) {
      throw new Error('Either AgentCard or Client must be provided');
    }
  }

  private async init() {
    if (this.isInitialized) {
      return;
    }

    if (this.a2aConfig.client) {
      this.client = this.a2aConfig.client;
    }

    if (this.a2aConfig.agentCard) {
      this.card = await resolveAgentCard(
        this.a2aConfig.agentCard,
        this.a2aConfig.resolveAgentCardOptions,
      );

      if (!this.client) {
        const factory = this.a2aConfig.clientFactory || new ClientFactory();
        this.client = await factory.createFromAgentCard(this.card);
      }
    }

    this.isInitialized = true;
  }

  protected async *runAsyncImpl(
    context: InvocationContext,
  ): AsyncGenerator<AdkEvent, void, void> {
    await this.init();

    try {
      // 1. Convert current ADK state to A2A Message
      const events = context.session.events;
      if (events.length === 0) {
        throw new Error('No events in session to send');
      }

      const userFnCall = getUserFunctionCallAt(
        context.session,
        events.length - 1,
      );
      let parts: A2APart[];
      let taskId: string | undefined = undefined;
      let contextId: string | undefined = undefined;

      if (userFnCall) {
        const event = userFnCall.response;
        // Route through the shared scrub: this credential response must not
        // cross the trust boundary unless its id is one the peer itself
        // exclusively requested. Computed over the full session, not just
        // this one response event: an id counts as peer-requested only if
        // EVERY event that issued a call for it was authored by the peer,
        // so the check needs the whole history to catch a local request
        // whose id the peer's own event reuses.
        const peerRequestedIds = peerRequestedCallIds(events, this.name);
        parts = toForwardableA2AParts(
          event.content,
          event.longRunningToolIds,
          peerRequestedIds,
        );
        taskId = userFnCall.taskId;
        contextId = userFnCall.contextId;
      } else {
        const missing = toMissingRemoteSessionParts(context, context.session);
        parts = missing.parts;
        contextId = missing.contextId;
      }

      const message: Message = {
        kind: 'message',
        messageId: randomUUID(),
        role: MessageRole.USER,
        parts,
        metadata: getA2ASessionMetadata({
          appName: context.session.appName,
          userId: context.session.userId,
          sessionId: context.session.id,
        }),
      };
      if (taskId) message.taskId = taskId;
      if (contextId) message.contextId = contextId;

      const metadata = this.a2aConfig.metadata ?? context.a2aMetadata;
      const params: MessageSendParams = {
        message,
        configuration: this.a2aConfig.messageSendConfig,
        ...(metadata ? {metadata} : {}),
      };

      const processor = new A2ARemoteAgentRunProcessor(params);

      if (this.a2aConfig.beforeRequestCallbacks) {
        for (const callback of this.a2aConfig.beforeRequestCallbacks) {
          await callback(context, params);
        }
      }

      const useStreaming = this.card
        ? this.card.capabilities?.streaming !== false
        : true;
      if (useStreaming) {
        for await (const chunk of this.client!.sendMessageStream(params)) {
          if (this.a2aConfig.afterRequestCallbacks) {
            for (const callback of this.a2aConfig.afterRequestCallbacks) {
              await callback(context, chunk);
            }
          }

          const adkEvent = toAdkEvent(
            chunk,
            context.invocationId,
            this.name,
            context.branch,
          );
          if (!adkEvent) {
            continue;
          }

          processor.updateCustomMetadata(adkEvent, chunk);

          const eventsToEmit = processor.aggregatePartial(
            context,
            chunk,
            adkEvent,
          );
          for (const ev of eventsToEmit) {
            yield ev;
          }
        }
      } else {
        const result = await this.client!.sendMessage(params);
        if (this.a2aConfig.afterRequestCallbacks) {
          for (const callback of this.a2aConfig.afterRequestCallbacks) {
            await callback(context, result);
          }
        }
        const adkEvent = toAdkEvent(
          result,
          context.invocationId,
          this.name,
          context.branch,
        );
        if (adkEvent) {
          processor.updateCustomMetadata(adkEvent, result);
          yield adkEvent;
        }
      }
    } catch (e: unknown) {
      const error = e as Error;
      logger.error(`A2ARemoteAgent ${this.name} failed:`, error);

      yield createEvent({
        author: this.name,
        invocationId: context.invocationId,
        errorMessage: error.message,
        turnComplete: true,
      });
    }
  }

  protected runLiveImpl(
    _context: InvocationContext,
  ): AsyncGenerator<AdkEvent, void, void> {
    throw new Error('Live mode is not supported in A2ARemoteAgent yet.');
  }
}

```

### Core Architecture Module: `core/src/a2a/a2a_remote_agent_run_processor.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {MessageSendParams} from '@a2a-js/sdk';
import {
  CitationMetadata,
  createModelContent,
  Part as GenAIPart,
  GenerateContentResponseUsageMetadata,
  GroundingMetadata,
} from '@google/genai';
import {InvocationContext, requireAgent} from '../agents/invocation_context.js';
import {Event as AdkEvent, createEvent} from '../events/event.js';
import {
  A2AEvent,
  getEventMetadata,
  isTask,
  isTaskArtifactUpdateEvent,
  isTaskStatusUpdateEvent,
} from './a2a_event.js';
import {A2AMetadataKeys} from './metadata_converter_utils.js';

/**
 * Aggregated state for a specific artifact.
 */
interface ArtifactAggregation {
  aggregatedText: string;
  aggregatedThoughts: string;
  parts: GenAIPart[];
  citations?: CitationMetadata;
  grounding?: GroundingMetadata;
  customMeta?: Record<string, unknown>;
  usage?: GenerateContentResponseUsageMetadata;
}

/**
 * Processes streams of A2A events and aggregates partials for emissions.
 */
export class A2ARemoteAgentRunProcessor {
  private aggregations = new Map<string, ArtifactAggregation>();
  private aggregationOrder: string[] = [];

  constructor(private readonly request?: MessageSendParams) {}

  /**
   * aggregatePartial stores contents of partial events to emit them with the terminal event.
   * It can return multiple events to emit instead of just the provided one.
   */
  aggregatePartial(
    context: InvocationContext,
    a2aEvent: A2AEvent,
    adkEvent: AdkEvent,
  ): AdkEvent[] {
    const metadata = getEventMetadata(a2aEvent);
    if (metadata[A2AMetadataKeys.PARTIAL]) {
      return [adkEvent];
    }

    if (isTaskStatusUpdateEvent(a2aEvent) && a2aEvent.final) {
      const events: AdkEvent[] = [];
      for (const aid of this.aggregationOrder) {
        const agg = this.aggregations.get(aid);
        if (agg) {
          events.push(this.buildNonPartialAggregation(context, agg));
        }
      }
      this.aggregations.clear();
      this.aggregationOrder = [];
      return [...events, adkEvent];
    }

    if (isTask(a2aEvent)) {
      this.aggregations.clear();
      this.aggregationOrder = [];
      return [adkEvent];
    }

    if (!isTaskArtifactUpdateEvent(a2aEvent)) {
      return [adkEvent];
    }

    const artifactId = a2aEvent.artifact.artifactId;

    if (!a2aEvent.append) {
      this.removeAggregation(artifactId);
      if (a2aEvent.lastChunk) {
        adkEvent.partial = false;
        return [adkEvent];
      }
    }

    let aggregation = this.aggregations.get(artifactId);
    if (!aggregation) {
      aggregation = {
        aggregatedText: '',
        aggregatedThoughts: '',
        parts: [],
      };
      this.aggregations.set(artifactId, aggregation);
      this.aggregationOrder.push(artifactId);
    } else {
      // Move to end of order as it was updated
      this.aggregationOrder = this.aggregationOrder.filter(
        (id) => id !== artifactId,
      );
      this.aggregationOrder.push(artifactId);
    }

    this.updateAggregation(aggregation, adkEvent);

    if (!a2aEvent.lastChunk) {
      return [adkEvent];
    }

    this.removeAggregation(artifactId);
    return [adkEvent, this.buildNonPartialAggregation(context, aggregation)];
  }

  private removeAggregation(artifactId: string) {
    this.aggregations.delete(artifactId);
    this.aggregationOrder = this.aggregationOrder.filter(
      (id) => id !== artifactId,
    );
  }

  private updateAggregation(agg: ArtifactAggregation, event: AdkEvent) {
    const parts = event.content?.parts || [];
    for (const part of parts) {
      if (part.text && part.text !== '') {
        if (part.thought) {
          agg.aggregatedThoughts += part.text;
        } else {
          agg.aggregatedText += part.text;
        }
      } else {
        this.promoteTextBlocksToParts(agg);
        agg.parts.push(part);
      }
    }

    if (event.citationMetadata) {
      if (!agg.citations) {
        agg.citations = {citations: []};
      }
      if (!agg.citations.citations) {
        agg.citations.citations = [];
      }
      agg.citations.citations.push(...(event.citationMetadata.citations || []));
    }

    if (event.customMetadata) {
      if (!agg.customMeta) {
        agg.customMeta = {};
      }
      Object.assign(agg.customMeta, event.customMetadata);
    }

    if (event.groundingMetadata) {
      agg.grounding = event.groundingMetadata;
    }

    if (event.usageMetadata) {
      agg.usage = event.usageMetadata;
    }
  }

  private buildNonPartialAggregation(
    context: InvocationContext,
    agg: ArtifactAggregation,
  ): AdkEvent {
    this.promoteTextBlocksToParts(agg);

    const result = createEvent({
      author: requireAgent(context).name,
      invocationId: context.invocationId,
      content:
        agg.parts.length > 0 ? createModelContent([...agg.parts]) : undefined,
      customMetadata: agg.customMeta,
      groundingMetadata: agg.grounding,
      citationMetadata: agg.citations,
      usageMetadata: agg.usage,
      turnComplete: false,
      partial: false,
    });
    return result;
  }

  private promoteTextBlocksToParts(agg: ArtifactAggregation) {
    if (agg.aggregatedThoughts !== '') {
      agg.parts.push({thought: true, text: agg.aggregatedThoughts});
      agg.aggregatedThoughts = '';
    }
    if (agg.aggregatedText !== '') {
      agg.parts.push({text: agg.aggregatedText});
      agg.aggregatedText = '';
    }
  }

  /**
   * Adds request and response metadata to the event.
   */
  updateCustomMetadata(event: AdkEvent, response?: A2AEvent) {
    const toAdd: Record<string, unknown> = {};
    if (this.request && event.turnComplete) {
      toAdd['request'] = this.request;
    }
    if (response) {
      toAdd['response'] = response;

      if (isTask(response)) {
        if (response.id) toAdd['task_id'] = response.id;
        if (response.contextId) toAdd['context_id'] = response.contextId;
      } else if (response.taskId) {
        toAdd['task_id'] = response.taskId;
        if (response.contextId) toAdd['context_id'] = response.contextId;
      }
    }
    if (Object.keys(toAdd).length === 0) {
      return;
    }
    if (!event.customMetadata) {
      event.customMetadata = {};
    }
    for (const [k, v] of Object.entries(toAdd)) {
      if (v === undefined || v === null) continue;
      // Use prefixed keys to avoid collisions
      event.customMetadata[`a2a:${k}`] = v;
    }
  }
}

```

### Core Architecture Module: `core/src/a2a/a2a_remote_agent_utils.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {Part as A2APart} from '@a2a-js/sdk';
import {Content, Part as GenAIPart} from '@google/genai';
import {REQUEST_CREDENTIAL_FUNCTION_CALL_NAME} from '../agents/functions.js';
import {InvocationContext, requireAgent} from '../agents/invocation_context.js';
import {Event as AdkEvent, createEvent} from '../events/event.js';
import {Session} from '../sessions/session.js';
import {camelCaseKeys} from '../utils/case_utils.js';
import {logger} from '../utils/logger.js';
import {AdkMetadataKeys} from './metadata_converter_utils.js';
import {toA2AParts} from './part_converter_utils.js';

export interface UserFunctionCall {
  response: AdkEvent;
  taskId: string;
  contextId: string;
}

/**
 * Returns a UserFunctionCall when the event at `index` contains a
 * FunctionResponse that can be traced back to a preceding FunctionCall event.
 *
 * @param session - The session whose event history to inspect.
 * @param index - Index of the candidate event to examine.
 * @returns The matching `UserFunctionCall`, or `undefined` if the event at
 *   `index` is not a user function-response event or has no preceding call.
 */
export function getUserFunctionCallAt(
  session: Session,
  index: number,
): UserFunctionCall | undefined {
  const events = session.events;
  if (index < 0 || index >= events.length) {
    return undefined;
  }

  const candidate = events[index];
  if (candidate.author !== 'user') {
    return undefined;
  }

  const fnCallId = getFunctionResponseCallId(candidate);
  if (!fnCallId) {
    return undefined;
  }

  for (let i = index - 1; i >= 0; i--) {
    const request = events[i];
    if (!isFunctionCallEvent(request, fnCallId)) {
      continue;
    }

    const metadata = request.customMetadata || {};
    const taskId = (metadata[AdkMetadataKeys.TASK_ID] as string) || '';
    const contextId = (metadata[AdkMetadataKeys.CONTEXT_ID] as string) || '';

    return {
      response: candidate,
      taskId,
      contextId,
    };
  }

  return undefined;
}

/**
 * Checks if an event contains a function call with the given ID.
 *
 * @param event - The event to inspect.
 * @param callId - The function call ID to look for.
 * @returns `true` if a part in the event has a matching `functionCall.id`.
 */
export function isFunctionCallEvent(event: AdkEvent, callId: string): boolean {
  if (!event || !event.content || !event.content.parts) {
    return false;
  }

  return event.content.parts.some(
    (part: GenAIPart) => part.functionCall && part.functionCall.id === callId,
  );
}

/**
 * Finds the first part with a FunctionResponse and returns the call ID.
 *
 * @param event - The event to inspect.
 * @returns The `id` of the first FunctionResponse part, or `undefined` if
 *   none is found.
 */
export function getFunctionResponseCallId(event: AdkEvent): string | undefined {
  if (!event || !event.content || !event.content.parts) {
    return undefined;
  }

  const responsePart = event.content.parts.find(
    (part: GenAIPart) => part.functionResponse,
  );

  return responsePart?.functionResponse?.id;
}

// Top-level keys of a serialized AuthConfig that indicate credential
// material, the shape an adk_request_credential call's arguments (one level
// down, under `authConfig`) and its response (flat) both carry.
const AUTH_CONFIG_SCHEME_KEY = 'authScheme';
const AUTH_CONFIG_CREDENTIAL_KEYS: ReadonlyArray<string> = [
  // camelCase only by design: callers normalise the payload with
  // camelCaseKeys() before these keys are looked up, so the snake_case
  // spellings (raw_auth_credential, exchanged_auth_credential) are covered.
  'rawAuthCredential',
  'exchangedAuthCredential',
];

/**
 * Whether `payload` looks like a serialized AuthConfig carrying credential
 * material. Requires `authScheme` plus at least one credential-bearing
 * field, rather than requiring every field AuthConfig's type declares --
 * a config read back off a function call's args can arrive missing fields
 * its type promises (see credential_response_binding.ts), so requiring all
 * of them would leave a gap for an incomplete-but-still-credential-bearing
 * envelope.
 *
 * NOTE: this check is fail-OPEN, not fail-closed: a payload that doesn't
 * match is forwarded unredacted, not dropped. Ambiguous input is treated as
 * safe to forward, which is the direction that risks a leak, not the
 * direction that risks over-dropping legitimate content.
 */
function payloadIsAuthConfig(payload: unknown): boolean {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return false;
  }
  const keys = new Set(Object.keys(payload as Record<string, unknown>));
  if (!keys.has(AUTH_CONFIG_SCHEME_KEY)) {
    return false;
  }
  return AUTH_CONFIG_CREDENTIAL_KEYS.some((key) => keys.has(key));
}

/**
 * Whether a function_call carries credential material.
 *
 * NOTE: fail-open, as above -- an ambiguous call is left unscrubbed.
 */
function isCredentialFunctionCall(functionCall: {
  name?: string;
  args?: unknown;
}): boolean {
  if (functionCall.name === REQUEST_CREDENTIAL_FUNCTION_CALL_NAME) {
    return true;
  }
  // A request wraps the AuthConfig in an AuthToolArguments envelope, so the
  // shape has to be read one level down, under `authConfig`. Args are
  // normalised with camelCaseKeys first: generateAuthEvent (the primary,
  // in-tree producer) emits this envelope in snake_case
  // (function_call_id/auth_config), and reading it raw would silently never
  // match that shape.
  const args = camelCaseKeys(functionCall.args);
  if (!args || typeof args !== 'object') {
    return false;
  }
  const authConfig = (args as Record<string, unknown>)['authConfig'];
  return payloadIsAuthConfig(authConfig);
}

/**
 * Whether a function_response carries credential material.
 *
 * NOTE: fail-open, as above -- an ambiguous response is left unscrubbed.
 */
function isCredentialFunctionResponse(functionResponse: {
  name?: string;
  response?: unknown;
}): boolean {
  if (functionResponse.name === REQUEST_CREDENTIAL_FUNCTION_CALL_NAME) {
    return true;
  }
  return payloadIsAuthConfig(camelCaseKeys(functionResponse.response));
}

/**
 * Ids of credential requests the remote peer raised itself. An id that ANY
 * non-peer event also issued a call for is excluded: the peer authors its
 * own session events under its own name (`toAdkEvent` forces
 * `author = this.name`) and controls `functionCall.id` verbatim, so a bare
 * id match -- without checking whether some OTHER event also issued a call
 * for that same id -- would let a peer re-label this agent's own pending
 * credential request as one the peer had asked for, by sending an
 * unrelated reply that happens to carry a function_call part whose id
 * collides with it.
 */
export function peerRequestedCallIds(
  events: readonly AdkEvent[],
  peerName: string,
): ReadonlySet<string> {
  const peer = new Set<string>();
  const local = new Set<string>();
  for (const event of events) {
    for (const part of event.content?.parts ?? []) {
      const id = part.functionCall?.id;
      if (!id) {
        continue;
      }
      (event.author === peerName ? peer : local).add(id);
    }
  }
  return new Set([...peer].filter((id) => !local.has(id)));
}

/**
 * Returns `content` with any credential-bearing function_call or
 * function_response part removed, except a function_response whose id is
 * in `peerRequestedIds` -- that credential was requested BY the remote
 * peer, so withholding it would silently strand the peer's pending request
 * forever with nothing logged to explain why. Every other credential-
 * bearing part is a request this local agent raised for its own tools, or
 * an answer to one, and must never cross the trust boundary to the peer.
 *
 * The peer-requested exception only applies when the peer's own request
 * event was authored under a non-'user' role: `messageToAdkEvent` sets
 * `author: msg.role === 'user' ? 'user' : agentName`, so a peer that sends
 * its own `adk_request_credential` inside a `role: 'user'` message is
 * classified the same as a local request, and its answer is withheld --
 * the handshake stalls (logged via the drop warning below, not silent),
 * rather than leaking. Nothing in the A2A spec obliges a peer to use a
 * non-user role.
 *
 * An adk_request_credential call carries a serialized AuthConfig in its
 * arguments -- including rawAuthCredential, an OAuth2 client secret or a
 * service account key -- and its response carries the exchanged credential
 * back (an API key, bearer token, or exchanged OAuth token). Forwarding
 * either to a remote A2A peer would leak that credential material outside
 * the trust boundary it was issued within.
 */
function withoutCredentialParts(
  content: Content | undefined,
  peerRequestedIds: ReadonlySet<string>,
): Content | undefined {
  if (!content || !content.parts) {
    return content;
  }

  const isDroppedCredentialPart = (part: GenAIPart): boolean => {
    if (part.functionCall && isCredentialFunctionCall(part.functionCall)) {
      return true;
    }
    if (
      part.functionResponse &&
      isCredentialFunctionResponse(part.functionResponse)
    ) {
      const id = part.functionResponse.id;
      return !(id && peerRequestedIds.has(id));
    }
    return false;
  };

  const parts = content.parts.filter((part) => !isDroppedCredentialPart(part));
  if (parts.length === content.parts.length) {
    return content;
  }
  logger.warn(
    `Dropped ${content.parts.length - parts.length} credential-bearing ` +
      'part(s) before forwarding to the remote peer -- it did not request them.',
  );
  return {...content, parts};
}

/**
 * Converts genai parts to A2A parts for forwarding to the remote peer,
 * scrubbing credential material the peer did not itself request.
 *
 * NOT the single point both session-forwarding paths converge on:
 * `toMissingRemoteSessionParts` calls `withoutCredentialParts` directly,
 
```

### Core Architecture Module: `core/src/a2a/agent_card.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {AgentCard, AgentInterface, AgentSkill} from '@a2a-js/sdk';
import {DefaultAgentCardResolver} from '@a2a-js/sdk/client';
import * as fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {BaseAgent} from '../agents/base_agent.js';
import {
  InvocationContext,
  InvocationContextParams,
} from '../agents/invocation_context.js';
import {isLlmAgent, LlmAgent} from '../agents/llm_agent.js';
import {isLoopAgent, LoopAgent} from '../agents/loop_agent.js';
import {isParallelAgent} from '../agents/parallel_agent.js';
import {ReadonlyContext} from '../agents/readonly_context.js';
import {isSequentialAgent} from '../agents/sequential_agent.js';
import {BaseTool, isBaseTool} from '../tools/base_tool.js';
import {isBaseToolset} from '../tools/base_toolset.js';
import {logger} from '../utils/logger.js';
import {
  isLinkLocalAddress,
  isLocalhostHostname,
  normalizeHost,
  resolveHostAddresses,
} from '../utils/ssrf_guard.js';
import {RunnableRoot} from '../workflow/run_node_as_invocation.js';
import {isWorkflow} from '../workflow/workflow.js';

/**
 * Options controlling how a fetched agent card's RPC URL(s) are validated
 * against the location the card was fetched from. See `validateCardRpcTargets`
 * for what each check defends against and why
 * both default to failing closed.
 */
export interface ResolveAgentCardOptions {
  /**
   * Explicit escape hatch to accept a plaintext http:// RPC URL on a
   * non-loopback host.
   *
   * This is intentionally insecure: an RPC URL that isn't https and isn't
   * on this machine can be intercepted or altered by anything on the
   * network path, even when its origin matches the card's own. Only set
   * this for a card source you know serves plain http on a host you
   * trust (e.g. a private, internal service reached over a channel
   * that's secured some other way). When set to `true`, a loud warning is
   * logged for each RPC URL this affects.
   *
   * Defaults to `false`: RPC URLs must be https, or http on a loopback
   * host (localhost, 127.0.0.0/8, ::1, 0.0.0.0, or ::).
   */
  allowInsecureRpc?: boolean;
  /**
   * Explicit escape hatch to accept an RPC URL whose origin differs from
   * the location the card was fetched from.
   *
   * This is intentionally permissive: it is what lets a compromised or
   * misconfigured card-hosting endpoint redirect all subsequent A2A
   * traffic for this agent, including whatever credential material the
   * request-forwarding path carries, to a different origin than the one
   * that was actually configured and fetched. The A2A spec allows a card
   * to point RPC at a different origin than where the card itself is
   * served from (e.g. static card hosting separate from the API
   * backend), which is the legitimate case this exists for -- only set
   * this when that's a shape you actually expect. When set to `true`, a
   * loud warning is logged for each RPC URL this affects.
   *
   * Defaults to `false`: every RPC URL must share the origin the card
   * was fetched from.
   */
  allowCrossOriginRpc?: boolean;
}

/**
 * Resolves the AgentCard from the provided source.
 *
 * A source is either an {@link AgentCard}, an `http(s)://` URL to fetch it
 * from, a `file://` URL, or a filesystem path. Any other URL scheme throws: a
 * source that looks like a URL is never read off the local filesystem.
 *
 * The card host must not be, or resolve to, a link-local address, and a
 * redirect from the card endpoint is refused rather than followed. Loopback and
 * private addresses stay allowed: they are where a locally served or
 * VPC-internal peer agent lives.
 */
export async function resolveAgentCard(
  agentCard: AgentCard | string,
  options: ResolveAgentCardOptions = {},
): Promise<AgentCard> {
  if (typeof agentCard === 'object') {
    return agentCard;
  }

  const source = agentCard as string;
  if (source.startsWith('http://') || source.startsWith('https://')) {
    await refuseLinkLocalHost(source);
    const resolver = new DefaultAgentCardResolver({
      fetchImpl: refuseRedirectFetch,
    });
    const card = await resolver.resolve(source);
    validateCardRpcTargets(card, source, options);
    return card;
  }
  const url = parseCardUrl(source);
  if (url && url.protocol !== 'file:') {
    throw new Error(
      `Unsupported agent card URL scheme "${url.protocol}": ${agentCard}. ` +
        'Use http://, https:// or file://, or pass a filesystem path with no scheme.',
    );
  }
  return readAgentCardFile(agentCard, url);
}

/**
 * Matches the single-letter "protocol" Node's URL parser produces for a
 * Windows drive-letter path (e.g. `C:\foo` or `C:/foo` parses with
 * `protocol === 'c:'`), so such a path is treated as a filesystem path
 * rather than rejected as an unsupported URL scheme.
 */
const WINDOWS_DRIVE_PROTOCOL = /^[a-z]:$/i;

/**
 * Rejects `source` if its host is, or resolves to, a link-local address --
 * before any fetch happens, so the request itself never reaches the
 * metadata endpoint a link-local address can expose.
 *
 * Checks every address a hostname resolves to, not only the first: DNS can
 * return several, and `fetch`'s own connection may pick any of them, so one
 * link-local address among otherwise-global ones is still refused.
 */
async function refuseLinkLocalHost(source: string): Promise<void> {
  const hostname = normalizeHost(new URL(source).hostname);
  if (isLocalhostHostname(hostname)) {
    return;
  }
  const addresses = await resolveHostAddresses(hostname);
  if (addresses.some((address) => isLinkLocalAddress(address))) {
    throw new Error(
      `Refusing to fetch agent card from a link-local address: ${hostname}`,
    );
  }
}

/**
 * Fetches `url` with redirects disabled, refusing instead of following one.
 *
 * `DefaultAgentCardResolver`'s own fetch follows redirects by default, which
 * would make the request itself reach wherever a compromised or
 * misconfigured card endpoint points it -- before this module's own
 * same-origin check on the card's declared RPC URLs ever runs. A redirect
 * to an internal or metadata address is a real request either way,
 * regardless of whether the resulting content later fails that check.
 *
 * A response whose `status` is 0 covers both an opaque redirect
 * (`type: 'opaqueredirect'`, from `redirect: 'manual'` crossing an
 * actually-followed-elsewhere boundary) and a network error
 * (`type: 'error'`): neither carries a usable `location`, so both are
 * refused the same way, with `location` reported as `null`.
 */
async function refuseRedirectFetch(
  url: string | URL | Request,
  init?: Parameters<typeof fetch>[1],
): Promise<Response> {
  const response = await fetch(url, {...init, redirect: 'manual'});
  if (
    response.status === 0 ||
    (response.status >= 300 && response.status < 400)
  ) {
    const location = response.headers.get('location');
    throw new Error(
      `Refusing to follow a redirect from the agent card endpoint ` +
        `(status ${response.status}, location ${location}): ${url}`,
    );
  }
  return response;
}

/**
 * Parses an absolute URL out of a card source, or returns `null` when the
 * source names a filesystem path.
 */
function parseCardUrl(source: string): URL | null {
  let url: URL;
  try {
    url = new URL(source);
  } catch {
    return null;
  }
  return WINDOWS_DRIVE_PROTOCOL.test(url.protocol) ? null : url;
}

/** Reads and parses a card from `url` when it is a `file:` URL, else from `source`. */
async function readAgentCardFile(
  source: string,
  url: URL | null,
): Promise<AgentCard> {
  try {
    const path = url ? fileURLToPath(url) : source;
    const content = await fs.readFile(path, 'utf-8');
    return JSON.parse(content) as AgentCard;
  } catch (err: unknown) {
    throw new Error(
      `Failed to read agent card from file ${source}: ${(err as Error).message}`,
    );
  }
}

/**
 * Constrains where a card fetched over the network may aim RPC traffic.
 *
 * A card served from a trusted, configured source URL is not itself
 * trusted content: the response is JSON from whatever answered that
 * request, which could be a compromised or misconfigured server, a MITM
 * on the fetch, or a domain that has since changed hands. Without this
 * check, that response's declared RPC url(s) are followed with no
 * verification at all -- every subsequent A2A request for this agent,
 * including whatever credential material the request-forwarding path
 * carries, would go to wherever the card says, not wherever it was
 * actually fetched from.
 *
 * Every URL the card offers is checked (the primary `url` and each of
 * `additionalInterfaces`), not only whichever one a given transport
 * negotiation would select, since any of them could end up being used.
 * This applies two independent checks, each with its own escape hatch
 * (see {@link ResolveAgentCardOptions}), since they defend against
 * different things and a legitimate deployment may need to relax one
 * without the other:
 *
 * - https, or http on a loopback host: defends against network-path
 *   interception of the RPC connection itself, independent of whether
 *   its origin matches the card's.
 * - same origin as the card's source: defends against the card
 *   redirecting RPC traffic to a different origin than the one actually
 *   configured and fetched.
 *
 * Only applies when the card was fetched over http(s); a card provided
 * directly as an object, or read from a local file, did not come off the
 * network here, and its target is left to the caller.
 */
function validateCardRpcTargets(
  card: AgentCard,
  source: string,
  options: ResolveAgentCardOptions,
): void {
  let parsedSource: URL;
  try {
    parsedSource = new URL(source);
  } catch (err: unknown) {
    throw new Error(
      `Invalid agent card source URL: ${source}: ${(err as Error).message}`,
    );
  }

  const rpcUrls: string[] = [
    c
```

### Core Architecture Module: `core/src/a2a/agent_executor.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {TaskArtifactUpdateEvent, TaskStatusUpdateEvent} from '@a2a-js/sdk';
import {
  AgentExecutor,
  ExecutionEventBus,
  RequestContext,
} from '@a2a-js/sdk/server';
import {RunConfig} from '../agents/run_config.js';
import {Event as AdkEvent} from '../events/event.js';
import {isRunner, Runner, RunnerConfig} from '../runner/runner.js';
import {BaseSessionService} from '../sessions/base_session_service.js';
import {Session} from '../sessions/session.js';
import {randomUUID} from '../utils/env_aware_utils.js';
import {logger} from '../utils/logger.js';
import {
  createTask,
  createTaskArtifactUpdateEvent,
  createTaskFailedEvent,
  createTaskWorkingEvent,
} from './a2a_event.js';
import {
  getFinalTaskStatusUpdate,
  getUnansweredRequestEvent,
} from './event_processor_utils.js';
import {createExecutorContext, ExecutorContext} from './executor_context.js';
import {
  getA2AEventMetadata,
  getA2ASessionMetadata,
} from './metadata_converter_utils.js';
import {toA2AParts, toGenAIContent} from './part_converter_utils.js';
import {getA2aRequestMetadata} from './request_metadata.js';

/**
 * Represents a runner or a configuration for a runner.
 */
export type RunnerOrRunnerConfig =
  | Runner
  | RunnerConfig
  | (() => Runner | RunnerConfig)
  | (() => Promise<Runner | RunnerConfig>);

/**
 * Callback called before execution starts.
 */
export type BeforeExecuteCallback = (
  reqCtx: RequestContext,
  a2aMetadata?: Record<string, unknown>,
) => Promise<void>;

/**
 * Callback called after an ADK event is converted to an A2A event.
 */
export type AfterEventCallback = (
  ctx: ExecutorContext,
  adkEvent: AdkEvent,
  a2aEvent?: TaskArtifactUpdateEvent,
) => Promise<void>;

/**
 * Callback called after execution resolved into a completed or failed task.
 */
export type AfterExecuteCallback = (
  ctx: ExecutorContext,
  finalA2aEvent: TaskStatusUpdateEvent,
  err?: Error,
) => Promise<void>;

/**
 * Configuration for the Executor.
 */
export interface AgentExecutorConfig {
  runner: RunnerOrRunnerConfig;
  runConfig?: RunConfig;
  beforeExecuteCallback?: BeforeExecuteCallback;
  afterEventCallback?: AfterEventCallback;
  afterExecuteCallback?: AfterExecuteCallback;
}

/**
 * AgentExecutor invokes an ADK agent and translates session events to A2A events.
 */
export class A2AAgentExecutor implements AgentExecutor {
  private agentPartialArtifactIdsMap: Record<string, string> = {};

  constructor(private readonly config: AgentExecutorConfig) {}

  async execute(
    ctx: RequestContext,
    eventBus: ExecutionEventBus,
  ): Promise<void> {
    const a2aUserMessage = ctx.userMessage;
    if (!a2aUserMessage) {
      throw new Error('message not provided');
    }

    const userId = `A2A_USER_${ctx.contextId}`;
    const sessionId = ctx.contextId;
    const genAIUserMessage = toGenAIContent(a2aUserMessage);
    const adkRunner = await getAdkRunner(this.config.runner);
    const session = await getAdkSession(
      userId,
      sessionId,
      adkRunner.sessionService,
      adkRunner.appName,
    );
    const a2aMetadata = getA2aRequestMetadata(ctx);
    const executorContext = createExecutorContext({
      session,
      userContent: genAIUserMessage,
      requestContext: ctx,
      a2aMetadata,
    });

    try {
      if (this.config.beforeExecuteCallback) {
        await this.config.beforeExecuteCallback(ctx, a2aMetadata);
      }

      const unansweredRequestEvent = getUnansweredRequestEvent({
        taskId: ctx.taskId,
        contextId: ctx.contextId,
        task: ctx.task,
        sessionEvents: session.events,
        genAIContent: genAIUserMessage,
      });
      if (unansweredRequestEvent) {
        await this.publishFinalTaskStatus({
          executorContext,
          eventBus,
          event: {
            ...unansweredRequestEvent,
            metadata: getA2ASessionMetadata(executorContext),
          },
        });

        return;
      }

      if (!ctx.task) {
        eventBus.publish(
          createTask({
            taskId: ctx.taskId,
            contextId: ctx.contextId,
            message: a2aUserMessage,
            metadata: getA2ASessionMetadata(executorContext),
          }),
        );
      }

      eventBus.publish(
        createTaskWorkingEvent({
          taskId: ctx.taskId,
          contextId: ctx.contextId,
          metadata: getA2ASessionMetadata(executorContext),
        }),
      );

      const adkEvents: AdkEvent[] = [];
      for await (const adkEvent of adkRunner.runAsync({
        userId,
        sessionId,
        newMessage: genAIUserMessage,
        // Marked remote so the run knows this message came from a peer rather
        // than from the operator: a human-in-the-loop gate is not answerable
        // over A2A unless the deployment opts in.
        runConfig: {
          ...this.config.runConfig,
          remoteDelivered: true,
          ...(a2aMetadata ? {a2aMetadata} : {}),
        },
      })) {
        adkEvents.push(adkEvent);

        const a2aEvent = this.convertAdkEventToA2AEvent(
          adkEvent,
          executorContext,
        );
        if (!a2aEvent) {
          continue;
        }

        await this.config.afterEventCallback?.(
          executorContext,
          adkEvent,
          a2aEvent,
        );

        eventBus.publish(a2aEvent);
      }

      await this.publishFinalTaskStatus({
        executorContext,
        eventBus,
        event: getFinalTaskStatusUpdate(adkEvents, executorContext),
      });
    } catch (e: unknown) {
      const error = e as Error;

      await this.publishFinalTaskStatus({
        executorContext,
        eventBus,
        error,
        event: createTaskFailedEvent({
          taskId: ctx.taskId,
          contextId: ctx.contextId,
          error: new Error(`Agent run failed: ${error.message}`),
          metadata: getA2ASessionMetadata(executorContext),
        }),
      });
    }
  }

  // Task cancellation is not supported in this implementation yet.
  async cancelTask(_taskId: string): Promise<void> {
    throw new Error('Task cancellation is not supported yet.');
  }

  private convertAdkEventToA2AEvent(
    adkEvent: AdkEvent,
    executorContext: ExecutorContext,
  ): TaskArtifactUpdateEvent | undefined {
    const a2aParts = toA2AParts(
      adkEvent.content?.parts,
      adkEvent.longRunningToolIds,
    );
    if (a2aParts.length === 0) {
      return undefined;
    }

    const artifactId =
      this.agentPartialArtifactIdsMap[adkEvent.author!] || randomUUID();

    const a2aEvent = createTaskArtifactUpdateEvent({
      taskId: executorContext.requestContext.taskId,
      contextId: executorContext.requestContext.contextId,
      artifactId,
      parts: a2aParts,
      metadata: getA2AEventMetadata(adkEvent, executorContext),
      append: adkEvent.partial,
      lastChunk: !adkEvent.partial,
    });

    if (adkEvent.partial) {
      this.agentPartialArtifactIdsMap[adkEvent.author!] = artifactId;
    } else {
      delete this.agentPartialArtifactIdsMap[adkEvent.author!];
    }

    return a2aEvent;
  }

  /**
   * Writes the final status event to the queue.
   */
  private async publishFinalTaskStatus({
    executorContext,
    eventBus,
    event,
    error,
  }: {
    executorContext: ExecutorContext;
    eventBus: ExecutionEventBus;
    event: TaskStatusUpdateEvent;
    error?: Error;
  }): Promise<void> {
    try {
      await this.config.afterExecuteCallback?.(executorContext, event, error);
    } catch (e: unknown) {
      logger.error('Error in afterExecuteCallback:', e);
    }

    eventBus.publish(event);
  }
}

/**
 * Gets or creates new ADK session.
 */
async function getAdkSession(
  userId: string,
  sessionId: string,
  sessionService: BaseSessionService,
  appName: string,
): Promise<Session> {
  const session = await sessionService.getSession({
    appName,
    userId,
    sessionId,
  });
  if (session) {
    return session;
  }

  return sessionService.createSession({
    appName,
    userId,
    sessionId,
  });
}

/**
 * Resolves the runner from the provided runner or runner config.
 */
async function getAdkRunner(
  runnerOrConfig: RunnerOrRunnerConfig,
): Promise<Runner> {
  if (typeof runnerOrConfig === 'function') {
    const result = await runnerOrConfig();

    return getAdkRunner(result);
  }

  if (isRunner(runnerOrConfig)) {
    return runnerOrConfig;
  }

  return new Runner(runnerOrConfig);
}

```

### Core Architecture Module: `core/src/a2a/agent_to_a2a.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {AGENT_CARD_PATH, AgentCard} from '@a2a-js/sdk';
import {InMemoryTaskStore} from '@a2a-js/sdk/server';
import type {UserBuilder} from '@a2a-js/sdk/server/express';
import type express from 'express';
import {StreamingMode} from '../agents/run_config.js';
import {BaseArtifactService} from '../artifacts/base_artifact_service.js';
import {BaseMemoryService} from '../memory/base_memory_service.js';
import {Runner} from '../runner/runner.js';
import {BaseSessionService} from '../sessions/base_session_service.js';
import {InMemorySessionService} from '../sessions/in_memory_session_service.js';
import {logger} from '../utils/logger.js';
import {loadOptionalPeer} from '../utils/optional_peer.js';
import {RunnableRoot} from '../workflow/run_node_as_invocation.js';
import {
  getA2AAgentCard,
  resolveAgentCard,
  ResolveAgentCardOptions,
} from './agent_card.js';
import {A2AAgentExecutor} from './agent_executor.js';
import {
  AdkDefaultRequestHandler,
  getA2aRequestMetadata,
} from './request_metadata.js';

export {AdkDefaultRequestHandler, getA2aRequestMetadata};

/**
 * Loads Express and the Express bindings of `@a2a-js/sdk`, which are only
 * needed by {@link toA2a}.
 *
 * `@a2a-js/sdk` itself already declares `express` as an optional peer, and ADK
 * follows suit: an agent that is never mounted as an HTTP service should not
 * have to download a web framework. Both modules are imported here rather
 * than at the top of the file, because `@a2a-js/sdk/server/express` imports
 * `express` eagerly and would otherwise make the whole ADK entry point
 * unloadable without it.
 */
async function loadExpressBindings(): Promise<{
  express: typeof express;
  a2aExpress: typeof import('@a2a-js/sdk/server/express');
}> {
  const expressModule = await loadOptionalPeer(
    {packageName: 'express', feature: 'toA2a'},
    () => import('express'),
  );
  // `@a2a-js/sdk` is itself a hard dependency, so with Express resolved above
  // this import can no longer fail for a missing package.
  const a2aExpress = await import('@a2a-js/sdk/server/express');
  return {express: expressModule.default, a2aExpress};
}

/**
 * A request authenticator for the A2A surface.
 *
 * This is the `UserBuilder` hook from `@a2a-js/sdk`: an async function that
 * receives the incoming Express request, validates its credentials (for
 * example a bearer token or an OIDC ID token) and resolves to the
 * authenticated `User`. Implementations should reject unauthenticated
 * requests by throwing (or by resolving to a user whose `isAuthenticated` is
 * `false`), which prevents the underlying agent and its tools from being
 * invoked by anonymous callers.
 */
export type A2aUserBuilder = UserBuilder;

/**
 * Options for the `toA2a` function.
 */
export interface ToA2aOptions {
  /** The host for the A2A RPC URL (default: "localhost") */
  host?: string;
  /** The port for the A2A RPC URL (default: 8000) */
  port?: number;
  /** The protocol for the A2A RPC URL (default: "http") */
  protocol?: string;
  /** The base path for the A2A RPC URL (default: "a2a") */
  basePath?: string;
  /** Optional pre-built AgentCard object or path to agent card JSON */
  agentCard?: AgentCard | string;
  /**
   * Controls how a fetched agent card's RPC URL(s) are validated against
   * the location the card was fetched from. Only relevant when
   * {@link ToA2aOptions.agentCard} is a URL rather than an already-loaded
   * card object or file path; see {@link ResolveAgentCardOptions} for
   * what each option relaxes and why both default to failing closed.
   */
  resolveAgentCardOptions?: ResolveAgentCardOptions;
  /** Optional pre-built Runner object */
  runner?: Runner;
  /** Optional session service */
  sessionService?: BaseSessionService;
  /** Optional memory service */
  memoryService?: BaseMemoryService;
  /** Optional artifact service */
  artifactService?: BaseArtifactService;
  /** Optional existing express application */
  app?: express.Application;
  /**
   * Authenticator used to validate incoming A2A requests.
   *
   * A2A is the production-intended inter-agent surface: any network-reachable
   * caller that can reach it can invoke the agent and its tools with arbitrary
   * input and read the output. Provide a `UserBuilder` (from
   * `@a2a-js/sdk/server/express`) that validates the request's credentials —
   * for example a bearer token or an OIDC ID token — and it will be wired into
   * both the REST and JSON-RPC handlers.
   *
   * When omitted, `toA2a` fails closed and throws unless
   * {@link ToA2aOptions.allowUnauthenticated} is explicitly set to `true`.
   */
  authentication?: A2aUserBuilder;
  /**
   * Explicit escape hatch to mount the A2A surface WITHOUT authentication.
   *
   * This is intentionally insecure and must only be used for local, trusted
   * development where the surface is not network reachable. When set to
   * `true` (and no {@link ToA2aOptions.authentication} is provided), a loud
   * warning is logged and the handlers are mounted with no authentication.
   *
   * Defaults to `false`, which makes `toA2a` fail closed.
   */
  allowUnauthenticated?: boolean;
}

/**
 * Resolves the `UserBuilder` used to authenticate the A2A surface, failing
 * closed by default.
 *
 * - If an {@link ToA2aOptions.authentication} authenticator is provided, it is
 *   used for both the REST and JSON-RPC handlers.
 * - Otherwise, if {@link ToA2aOptions.allowUnauthenticated} is explicitly
 *   `true`, a loud warning is logged and the surface is mounted with no
 *   authentication.
 * - Otherwise, an error is thrown: the A2A surface must not be exposed without
 *   authentication.
 */
function resolveA2aUserBuilder(
  options: ToA2aOptions,
  a2aExpress: typeof import('@a2a-js/sdk/server/express'),
): UserBuilder {
  if (options.authentication) {
    return options.authentication;
  }

  if (options.allowUnauthenticated === true) {
    logger.warn(
      'SECURITY WARNING: Mounting the A2A server WITHOUT authentication ' +
        'because `allowUnauthenticated: true` was set. The agent and all of ' +
        'its tools are exposed to any network-reachable caller, which can ' +
        'invoke them with arbitrary input and read the output. Do NOT use ' +
        'this outside of local, trusted development.',
    );
    return a2aExpress.UserBuilder.noAuthentication;
  }

  throw new Error(
    'toA2a: refusing to mount the A2A server without authentication. The A2A ' +
      'surface lets any network-reachable caller invoke this agent and its ' +
      'tools with arbitrary input and read the output, so it must be ' +
      'authenticated. Provide `authentication` (a UserBuilder that validates ' +
      'the request, e.g. a bearer token or OIDC credential) or, only for ' +
      'local/trusted development, explicitly set `allowUnauthenticated: ' +
      'true`.',
  );
}

/**
 * Converts an ADK agent to an Express application with A2A handlers.
 *
 * @param agent The ADK agent to convert
 * @param options Configuration options
 * @returns An Express application
 */
export async function toA2a(
  agent: RunnableRoot,
  options: ToA2aOptions = {},
): Promise<express.Application> {
  const {express: expressFactory, a2aExpress} = await loadExpressBindings();

  // Fail closed before doing any work: the A2A surface must be authenticated
  // unless the caller explicitly opts out.
  const userBuilder = resolveA2aUserBuilder(options, a2aExpress);

  const host = options.host ?? 'localhost';
  const port = options.port ?? 8000;
  const protocol = options.protocol ?? 'http';
  const basePath = options.basePath || '';
  const rpcUrl = `${protocol}://${host}:${port}${basePath}`;
  const agentCard = options.agentCard
    ? await resolveAgentCard(options.agentCard, options.resolveAgentCardOptions)
    : await getA2AAgentCard(agent, [
        {
          url: `${rpcUrl}/jsonrpc`,
          transport: 'JSONRPC',
        },
        {
          url: `${rpcUrl}/rest`,
          transport: 'HTTP+JSON',
        },
      ]);

  const agentExecutor = new A2AAgentExecutor({
    runner: options.runner || {
      agent,
      appName: agent.name,
      sessionService: options.sessionService || new InMemorySessionService(),
      memoryService: options.memoryService,
      artifactService: options.artifactService,
    },
    runConfig: {
      streamingMode: StreamingMode.SSE,
    },
  });

  const requestHandler = new AdkDefaultRequestHandler(
    agentCard,
    new InMemoryTaskStore(),
    agentExecutor,
  );

  const app = options.app ?? expressFactory();
  if (!options.app) {
    // Parse JSON bodies only. `application/x-www-form-urlencoded` is a
    // CORS-safelisted content type, so a browser sends it cross-origin as a
    // simple request with no preflight; parsing it would let any web page
    // drive these endpoints with a drive-by form POST. Requiring JSON forces
    // a preflight, which this app does not answer.
    app.use(expressFactory.json({limit: '50mb'}));
  }

  app.use(
    `${basePath}/${AGENT_CARD_PATH}`,
    a2aExpress.agentCardHandler({agentCardProvider: requestHandler}),
  );
  app.use(
    `${basePath}/rest`,
    a2aExpress.restHandler({
      requestHandler,
      userBuilder,
    }),
  );
  app.use(
    `${basePath}/jsonrpc`,
    a2aExpress.jsonRpcHandler({
      requestHandler,
      userBuilder,
    }),
  );

  return app;
}

```

### Core Architecture Module: `core/src/a2a/auth.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {timingSafeEqual} from 'node:crypto';
import {A2aUserBuilder} from './agent_to_a2a.js';

/** A shared secret identifies a deployment, not an individual principal. */
const AUTHENTICATED_USER_NAME = 'a2a-bearer-token';

const BEARER_SCHEME_PREFIX = 'bearer ';

/** Compares two secrets without leaking their contents through timing. */
function timingSafeEqualStrings(a: string, b: string): boolean {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  // `timingSafeEqual` throws on a length mismatch, so the lengths must be
  // compared first. The length of a rejected credential is not a secret.
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Builds an {@link A2aUserBuilder} that authenticates A2A requests against a
 * shared bearer token.
 *
 * Callers must send `Authorization: Bearer <token>`; the credential is
 * compared against `token` in constant time, and a request with a missing,
 * malformed or incorrect one is rejected before the agent or any of its tools
 * is invoked. Serve the surface over HTTPS, or the secret travels in clear
 * text on every call.
 *
 * ```ts
 * const token = process.env.MY_TOKEN;
 * if (!token) {
 *   throw new Error('MY_TOKEN is not set');
 * }
 * toA2a(agent, {authentication: bearerTokenUserBuilder(token)});
 * ```
 *
 * A rejected request surfaces as whatever the `@a2a-js/sdk` handler produces
 * for a failing `UserBuilder`, which is an HTTP 500 rather than a 401. The
 * guarantee here is that the agent is never reached, not that the caller gets
 * a particular status code.
 *
 * @param token The shared secret callers must present; surrounding whitespace
 *   is trimmed, because HTTP strips it from header values anyway.
 * @throws If `token` is empty or contains only whitespace.
 */
export function bearerTokenUserBuilder(token: string): A2aUserBuilder {
  const expected = token.trim();
  if (!expected) {
    throw new Error(
      'bearerTokenUserBuilder: an empty A2A bearer token is not a valid ' +
        'authenticator. Supply a real shared secret, or configure no token ' +
        'at all to run the A2A surface unauthenticated.',
    );
  }

  return async (req) => {
    const header = req.headers.authorization ?? '';
    // RFC 6750 makes the bearer scheme case-insensitive.
    const credential = header.toLowerCase().startsWith(BEARER_SCHEME_PREFIX)
      ? header.slice(BEARER_SCHEME_PREFIX.length)
      : '';
    if (!timingSafeEqualStrings(credential, expected)) {
      throw new Error(
        'A2A request rejected: missing or invalid `Authorization: Bearer` ' +
          'credential.',
      );
    }
    return {isAuthenticated: true, userName: AUTHENTICATED_USER_NAME};
  };
}

```

### Core Architecture Module: `core/src/a2a/event_converter_utils.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  Part as A2APart,
  Message,
  Task,
  TaskArtifactUpdateEvent,
  TaskStatusUpdateEvent,
} from '@a2a-js/sdk';
import {
  CitationMetadata,
  createModelContent,
  createUserContent,
  Part as GenAIPart,
  GroundingMetadata,
  UsageMetadata,
} from '@google/genai';
import {Event as AdkEvent, createEvent} from '../events/event.js';
import {createEventActions} from '../events/event_actions.js';
import {withoutInternalMetadata} from '../events/internal_metadata.js';
import {randomUUID} from '../utils/env_aware_utils.js';
import {
  A2AEvent,
  getEventMetadata,
  getFailedTaskStatusUpdateEventError,
  isFailedTaskStatusUpdateEvent,
  isInputRequiredTaskStatusUpdateEvent,
  isMessage,
  isTask,
  isTaskArtifactUpdateEvent,
  isTaskStatusUpdateEvent,
  isTerminalTaskStatusUpdateEvent,
  MessageRole,
} from './a2a_event.js';
import {
  A2AMetadataKeys,
  getA2AEventMetadata,
} from './metadata_converter_utils.js';
import {toA2AParts, toGenAIPart, toGenAIParts} from './part_converter_utils.js';

/**
 * Converts a session Event to an A2A Message.
 *
 * @param event - The ADK event to convert.
 * @param appName - The name of the ADK application.
 * @param userId - The ID of the current user.
 * @param sessionId - The ID of the current session.
 * @returns An A2A message with the event's parts and metadata.
 */
export function toA2AMessage(
  event: AdkEvent,
  {
    appName,
    userId,
    sessionId,
  }: {appName: string; userId: string; sessionId: string},
): Message {
  return {
    kind: 'message',
    messageId: randomUUID(),
    role:
      event.author === MessageRole.USER ? MessageRole.USER : MessageRole.AGENT,
    parts: toA2AParts(event.content?.parts || [], event.longRunningToolIds),
    metadata: getA2AEventMetadata(event, {appName, userId, sessionId}),
  };
}

/**
 * Converts an A2A Event to an ADK Session Event.
 *
 * @param event - The A2A event to convert (message, task, artifact update, or
 *   status update).
 * @param invocationId - The ADK invocation ID to attach to the resulting event.
 * @param agentName - The name of the agent to use as the event author.
 * @param branch - The local invocation's branch to attach to the resulting
 *   event. Must come from the caller's own `InvocationContext`, never from
 *   the A2A peer: see the comment on `createAdkEventFromMetadata` for why.
 * @returns The converted ADK event, or `undefined` if the A2A event type
 *   produces no content.
 */
export function toAdkEvent(
  event: A2AEvent,
  invocationId: string,
  agentName: string,
  branch?: string,
): AdkEvent | undefined {
  if (isMessage(event)) {
    return messageToAdkEvent(event, invocationId, agentName, branch);
  }

  if (isTask(event)) {
    return taskToAdkEvent(event, invocationId, agentName, branch);
  }

  if (isTaskArtifactUpdateEvent(event)) {
    return artifactUpdateToAdkEvent(event, invocationId, agentName, branch);
  }

  if (isTaskStatusUpdateEvent(event)) {
    return event.final
      ? finalTaskStatusUpdateToAdkEvent(event, invocationId, agentName, branch)
      : taskStatusUpdateToAdkEvent(event, invocationId, agentName, branch);
  }

  return undefined;
}

function messageToAdkEvent(
  msg: Message,
  invocationId: string,
  agentName: string,
  branch?: string,
): AdkEvent {
  const parts = toGenAIParts(msg.parts);
  const content =
    parts.length === 0
      ? undefined
      : msg.role === MessageRole.USER
        ? createUserContent(parts)
        : createModelContent(parts);

  return {
    ...createAdkEventFromMetadata(msg),
    invocationId,
    author: msg.role === MessageRole.USER ? MessageRole.USER : agentName,
    branch,
    content,
    turnComplete: true,
    partial: false,
  };
}

function artifactUpdateToAdkEvent(
  a2aEvent: TaskArtifactUpdateEvent,
  invocationId: string,
  agentName: string,
  branch?: string,
): AdkEvent | undefined {
  const partsToConvert = a2aEvent.artifact?.parts || [];
  if (partsToConvert.length === 0) {
    return undefined;
  }

  const partial =
    !!getEventMetadata(a2aEvent)[A2AMetadataKeys.PARTIAL] ||
    a2aEvent.append ||
    !a2aEvent.lastChunk;

  return {
    ...createAdkEventFromMetadata(a2aEvent),
    invocationId,
    author: agentName,
    branch,
    content: createModelContent(toGenAIParts(partsToConvert)),
    longRunningToolIds: getLongRunningToolIDs(partsToConvert),
    partial,
  };
}

function finalTaskStatusUpdateToAdkEvent(
  a2aEvent: TaskStatusUpdateEvent,
  invocationId: string,
  agentName: string,
  branch?: string,
): AdkEvent | undefined {
  const partsToConvert = a2aEvent.status.message?.parts || [];
  if (partsToConvert.length === 0) {
    return undefined;
  }

  const parts = toGenAIParts(partsToConvert);
  const isFailedTask = isFailedTaskStatusUpdateEvent(a2aEvent);
  const hasContent = !isFailedTask && parts.length > 0;

  return {
    ...createAdkEventFromMetadata(a2aEvent),
    invocationId,
    author: agentName,
    branch,
    errorMessage: isFailedTask
      ? getFailedTaskStatusUpdateEventError(a2aEvent)
      : undefined,
    content: hasContent ? createModelContent(parts) : undefined,
    longRunningToolIds: getLongRunningToolIDs(partsToConvert),
    turnComplete: true,
  };
}

function taskStatusUpdateToAdkEvent(
  a2aEvent: TaskStatusUpdateEvent,
  invocationId: string,
  agentName: string,
  branch?: string,
): AdkEvent | undefined {
  const msg = a2aEvent.status.message;
  if (!msg) {
    return undefined;
  }

  const parts = toGenAIParts(msg.parts);
  if (parts.length === 0) {
    return undefined;
  }

  return {
    ...createAdkEventFromMetadata(a2aEvent),
    invocationId,
    author: agentName,
    branch,
    content: createModelContent(parts),
    turnComplete: false,
    partial: true,
  };
}

function taskToAdkEvent(
  a2aTask: Task,
  invocationId: string,
  agentName: string,
  branch?: string,
): AdkEvent | undefined {
  const parts: GenAIPart[] = [];
  const longRunningToolIds: string[] = [];

  if (a2aTask.artifacts) {
    for (const artifact of a2aTask.artifacts) {
      if (artifact.parts?.length > 0) {
        const artifactParts = toGenAIParts(artifact.parts);
        parts.push(...artifactParts);
        longRunningToolIds.push(...getLongRunningToolIDs(artifact.parts));
      }
    }
  }

  if (a2aTask.status?.message) {
    const a2aParts = a2aTask.status.message.parts;
    const genAIParts = toGenAIParts(a2aParts);

    parts.push(...genAIParts);
    longRunningToolIds.push(...getLongRunningToolIDs(a2aParts));
  }

  const isTerminal =
    isTerminalTaskStatusUpdateEvent(a2aTask) ||
    isInputRequiredTaskStatusUpdateEvent(a2aTask);
  const isFailed = isFailedTaskStatusUpdateEvent(a2aTask);

  if (parts.length === 0 && !isFailed) {
    return undefined;
  }

  return {
    ...createAdkEventFromMetadata(a2aTask),
    invocationId,
    author: agentName,
    branch,
    content: isFailed ? undefined : createModelContent(parts),
    errorMessage: isFailed
      ? getFailedTaskStatusUpdateEventError(a2aTask)
      : undefined,
    longRunningToolIds,
    turnComplete: isTerminal,
  };
}

// EventActions fields a remote A2A peer may set on the event we emit
// for it. Every other field is dropped: see the comment at the call
// site in createAdkEventFromMetadata for why.
const PEER_SETTABLE_ACTION_FIELDS: ReadonlySet<string> = new Set(['escalate']);

function createAdkEventFromMetadata(a2aEvent: A2AEvent): AdkEvent {
  const metadata = a2aEvent.metadata || {};

  return createEvent({
    // `branch` is intentionally NOT restored from peer metadata here (unlike
    // the other fields below): it is the mechanism getContents() (see
    // content_processor_utils.ts) uses to keep sibling sub-agent branches'
    // conversation contexts isolated from each other. A remote A2A peer that
    // controls its own outgoing metadata could otherwise forge `adk_branch`
    // (set it to a shared ancestor branch, or omit it) to leak its content
    // into an unrelated sibling agent's LLM context. Every caller of the
    // `*ToAdkEvent` functions in this file force-sets `branch` from its own
    // local `InvocationContext` instead, the same way `author` is handled.
    author: metadata[A2AMetadataKeys.AUTHOR] as string,
    partial: metadata[A2AMetadataKeys.PARTIAL] as boolean,
    errorCode: metadata[A2AMetadataKeys.ERROR_CODE] as string,
    errorMessage: metadata[A2AMetadataKeys.ERROR_MESSAGE] as string,
    citationMetadata: metadata[
      A2AMetadataKeys.CITATION_METADATA
    ] as CitationMetadata,
    groundingMetadata: metadata[
      A2AMetadataKeys.GROUNDING_METADATA
    ] as GroundingMetadata,
    usageMetadata: metadata[A2AMetadataKeys.USAGE_METADATA] as UsageMetadata,
    // A remote peer cannot set ADK-internal keys on the events we emit for it.
    customMetadata: withoutInternalMetadata(
      metadata[A2AMetadataKeys.CUSTOM_METADATA] as Record<string, unknown>,
    ),
    // Only fields in PEER_SETTABLE_ACTION_FIELDS may be restored from
    // metadata a remote A2A peer controls. Every other action field either
    // mutates the caller's own session or drives the caller's own control
    // flow (e.g. `transferToAgent`, see llm_agent.ts), so it must never be
    // rebuilt from peer-supplied data. Filtering through an allowlist here
    // (rather than just omitting the unsafe field) means a future action
    // field is unsafe-by-default: adding it to `candidateActions` alone
    // does nothing until it's also added to the allowlist.
    actions: createEventActions(
      Object.fromEntries(
        Object.entries({
          escalate: !!metadata[A2AMetadataKeys.ESCALATE],
        }).filter(([key]) => PEER_SETTABLE_ACTION_FIELDS.has(key)),
      ),
    ),
  });
}

function getLongRunningToolIDs(parts: A2APart[]): string[] {
  const ids: string[] = [];

  for (const a2aPart of parts) {
    if (a2aPart.metadata && a2aPart.metadata[A2AMetadataKeys.IS_LONG_RUNNING])
```

### Core Architecture Module: `core/src/a2a/event_processor_utils.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {Task, TaskStatusUpdateEvent} from '@a2a-js/sdk';
import {Content as GenAIContent, Part as GenAIPart} from '@google/genai';
import {
  getPendingUserInputRequests,
  getUserInputRequests,
} from '../agents/user_input_request.js';
import {Event as AdkEvent} from '../events/event.js';
import {createEventActions} from '../events/event_actions.js';
import {
  createTaskCompletedEvent,
  createTaskFailedEvent,
  createTaskInputRequiredEvent,
  isInputRequiredTaskStatusUpdateEvent,
} from './a2a_event.js';
import {ExecutorContext} from './executor_context.js';
import {
  getA2AEventMetadata,
  getA2AEventMetadataFromActions,
  getA2ASessionMetadata,
} from './metadata_converter_utils.js';
import {toA2AParts, toGenAIParts} from './part_converter_utils.js';

/**
 * Processes a list of ADK events and determines the final task status update event.
 * If any of the ADK events contain an error, a TaskFailedEvent is returned immediately.
 * If there are no errors, it checks for any input required events. If found, it returns a TaskInputRequiredEvent.
 * If there are no input required events, it returns a TaskCompletedEvent.
 *
 * @param adkEvents - The list of ADK events to process.
 * @param context - The executor context containing relevant information for processing the events.
 * @returns A TaskStatusUpdateEvent representing the final status of the task after processing the ADK events.
 */
export function getFinalTaskStatusUpdate(
  adkEvents: AdkEvent[],
  context: ExecutorContext,
): TaskStatusUpdateEvent {
  const finalEventActions = createEventActions();

  for (const adkEvent of adkEvents) {
    if (adkEvent.errorCode || adkEvent.errorMessage) {
      return createTaskFailedEvent({
        taskId: context.requestContext.taskId,
        contextId: context.requestContext.contextId,
        error: new Error(adkEvent.errorMessage || adkEvent.errorCode),
        metadata: {
          ...getA2AEventMetadata(adkEvent, context),
          ...getA2AEventMetadataFromActions(finalEventActions),
        },
      });
    }

    finalEventActions.escalate =
      finalEventActions.escalate || adkEvent.actions?.escalate;

    if (adkEvent.actions?.transferToAgent) {
      finalEventActions.transferToAgent = adkEvent.actions.transferToAgent;
    }
  }

  const inputRequiredEvent = scanForInputRequiredEvents(adkEvents, context);
  if (inputRequiredEvent) {
    return {
      ...inputRequiredEvent,
      metadata: {
        ...inputRequiredEvent.metadata,
        ...getA2AEventMetadataFromActions(finalEventActions),
      },
    };
  }

  return createTaskCompletedEvent({
    taskId: context.requestContext.taskId,
    contextId: context.requestContext.contextId,
    metadata: {
      ...getA2ASessionMetadata(context),
      ...getA2AEventMetadataFromActions(finalEventActions),
    },
  });
}

function scanForInputRequiredEvents(
  adkEvents: AdkEvent[],
  context: ExecutorContext,
): TaskStatusUpdateEvent | undefined {
  const inputRequiredParts: GenAIPart[] = [];
  const inputRequiredFunctionCallIds = new Set<string>();

  for (const adkEvent of adkEvents) {
    if (!adkEvent.content?.parts?.length) {
      continue;
    }

    for (const genAIPart of adkEvent.content.parts) {
      const longRunningFunctionCallId = getLongRunnningFunctionCallId(
        genAIPart,
        adkEvent.longRunningToolIds,
        inputRequiredParts,
      );
      if (!longRunningFunctionCallId) {
        continue;
      }

      const isAlreadyAdded = inputRequiredFunctionCallIds.has(
        longRunningFunctionCallId,
      );
      if (isAlreadyAdded) {
        continue;
      }

      inputRequiredParts.push(genAIPart);
      inputRequiredFunctionCallIds.add(longRunningFunctionCallId);
    }
  }

  if (inputRequiredParts.length > 0) {
    return createTaskInputRequiredEvent({
      taskId: context.requestContext.taskId,
      contextId: context.requestContext.contextId,
      parts: toA2AParts(inputRequiredParts, [...inputRequiredFunctionCallIds]),
      metadata: getA2ASessionMetadata(context),
    });
  }

  return undefined;
}

function getLongRunnningFunctionCallId(
  genAIPart: GenAIPart,
  longRunningToolIds: string[] = [],
  inputRequiredParts: GenAIPart[] = [],
): string | undefined {
  const functionCallId = genAIPart.functionCall?.id;
  const functionResponseId = genAIPart.functionResponse?.id;
  if (!functionCallId && !functionResponseId) {
    return;
  }

  if (functionCallId && longRunningToolIds.includes(functionCallId)) {
    return functionCallId;
  }

  if (functionResponseId && longRunningToolIds.includes(functionResponseId)) {
    return functionResponseId;
  }

  for (const part of inputRequiredParts) {
    if (part.functionCall?.id === functionResponseId) {
      return functionResponseId;
    }
  }

  return;
}

/**
 * Returns an input-required status update when the incoming message leaves a
 * pending request unanswered.
 *
 * A pause belongs to the conversation, not to the task that happened to raise
 * it: the ADK session is keyed by `contextId`, and a client picks its own task
 * ids. Scoping this to `ctx.task` alone let a caller step around an open gate
 * by starting a new task in the same context and going on talking to an agent
 * that is supposed to be waiting on a human. Pending requests are therefore
 * read from the session as well as from the task, and each one has to be
 * answered before the agent runs again.
 */
export function getUnansweredRequestEvent(options: {
  taskId: string;
  contextId: string;
  task?: Task;
  sessionEvents: AdkEvent[];
  genAIContent: GenAIContent;
}): TaskStatusUpdateEvent | undefined {
  const {taskId, contextId, task, sessionEvents, genAIContent} = options;
  const pending = pendingRequestParts(task, sessionEvents);

  const answered = new Set(
    (genAIContent?.parts ?? [])
      .map((part) => part.functionResponse?.id)
      .filter((id): id is string => !!id),
  );
  const missingId = [...pending.keys()].find((id) => !answered.has(id));
  if (!missingId) {
    return undefined;
  }

  return createTaskInputRequiredEvent({
    taskId: task?.id ?? taskId,
    contextId: task?.contextId ?? contextId,
    parts: [
      ...toA2AParts([...pending.values()]),
      {
        kind: 'text',
        text: `No input provided for function call id ${missingId}`,
        metadata: {
          validation_error: true,
        },
      },
    ],
  });
}

/**
 * The requests still awaiting an answer, by the id that answers them: the ones
 * the task is showing, plus every unanswered `adk_request_*` call in the
 * session.
 *
 * Deliberately not `longRunningToolIds`, which marks any tool declared
 * `isLongRunning` — a run that merely used one is not waiting on a person, and
 * a long-running tool that returns nothing leaves its call unanswered forever,
 * which would wedge the conversation shut. Same rule the workflow rehydration
 * path states at `workflow/utils/rehydration_utils.ts`.
 */
function pendingRequestParts(
  task: Task | undefined,
  sessionEvents: AdkEvent[],
): Map<string, GenAIPart> {
  const pending = new Map<string, GenAIPart>();

  if (
    task &&
    isInputRequiredTaskStatusUpdateEvent(task) &&
    task.status.message
  ) {
    for (const part of toGenAIParts(task.status.message.parts)) {
      if (part.functionCall?.id) {
        pending.set(part.functionCall.id, part);
      }
    }
  }

  const pendingIds = new Set(
    getPendingUserInputRequests(sessionEvents).map(
      (request) => request.interruptId,
    ),
  );
  for (const event of sessionEvents) {
    for (const part of event.content?.parts ?? []) {
      const id = interruptIdOfPart(event, part);
      if (id && pendingIds.has(id)) {
        pending.set(id, part);
      }
    }
  }

  // The task's own parts are not filtered by the scan above, so sweep anything
  // the session has since answered.
  for (const event of sessionEvents) {
    for (const part of event.content?.parts ?? []) {
      if (part.functionResponse?.id) {
        pending.delete(part.functionResponse.id);
      }
    }
  }
  return pending;
}

/**
 * The id that answers this part, when the part is a request for user input.
 *
 * Defers to {@link getUserInputRequests} rather than reading `functionCall.id`:
 * the three request kinds do not agree on where the answering id lives (the
 * agent auth flow puts it in `args.function_call_id`), and that helper is where
 * the framework settles it.
 */
function interruptIdOfPart(
  event: AdkEvent,
  part: GenAIPart,
): string | undefined {
  if (!part.functionCall) {
    return undefined;
  }
  const [request] = getUserInputRequests({...event, content: {parts: [part]}});
  return request?.interruptId;
}

```

### Core Architecture Module: `core/src/a2a/executor_context.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {RequestContext} from '@a2a-js/sdk/server';
import {Content} from '@google/genai';
import {Event} from '../events/event.js';
import {Session} from '../sessions/session.js';

/**
 * The A2A Agent Executor context.
 */
export interface ExecutorContext {
  userId: string;
  sessionId: string;
  appName: string;
  readonlyState: Record<string, unknown>;
  events: Event[];
  userContent: Content;
  requestContext: RequestContext;
  /**
   * Request-level metadata passed from an incoming A2A request.
   */
  a2aMetadata?: Record<string, unknown>;
}

/**
 * Creates an A2A Agent Executor context from the given parameters.
 * @param session The session.
 * @param userContent The content of the user.
 * @param requestContext The request context.
 * @param a2aMetadata Optional request-level metadata.
 * @returns The A2A Agent Executor context.
 */
export function createExecutorContext({
  session,
  userContent,
  requestContext,
  a2aMetadata,
}: {
  session: Session;
  userContent: Content;
  requestContext: RequestContext;
  a2aMetadata?: Record<string, unknown>;
}): ExecutorContext {
  return {
    userId: session.userId,
    sessionId: session.id,
    appName: session.appName,
    readonlyState: session.state,
    events: session.events,
    userContent,
    requestContext,
    a2aMetadata,
  };
}

```

### Core Architecture Module: `core/src/a2a/index.ts`
```
/**
 * @license
 * Copyright 2026 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * `@google/adk/a2a` subpath: the A2A surface only, without the full ADK barrel.
 * Also re-exported from `@google/adk`.
 */

export {AGENT_CARD_PATH, RemoteA2AAgent} from './a2a_remote_agent.js';
export type {
  A2AStreamEventData,
  AfterA2ARequestCallback,
  BeforeA2ARequestCallback,
  RemoteA2AAgentConfig,
} from './a2a_remote_agent.js';
export {getA2AAgentCard} from './agent_card.js';
export type {ResolveAgentCardOptions} from './agent_card.js';
export {A2AAgentExecutor} from './agent_executor.js';
export type {
  AfterEventCallback,
  AfterExecuteCallback,
  AgentExecutorConfig,
  BeforeExecuteCallback,
  RunnerOrRunnerConfig,
} from './agent_executor.js';
export {
  AdkDefaultRequestHandler,
  getA2aRequestMetadata,
  toA2a,
} from './agent_to_a2a.js';
export type {A2aUserBuilder, ToA2aOptions} from './agent_to_a2a.js';
export {bearerTokenUserBuilder} from './auth.js';
export type {ExecutorContext} from './executor_context.js';

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #951** (2026-10-06): **sawitrisaengchan0@gmail.com**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > Hi @saengchansawitri9-maker , Thank you for reporting this issue. To proceed, could you please provide a clear title, description, reproduction steps along with error logs? This information will help us investigate further. Please use the latest version of @google/adk and let us know if you face any issues. Thank you.
  > Are you satisfied with the resolution of your issue? <a href="https://docs.google.com/forms/d/e/1FAIpQLSeuqIP8vcNJv0Gv84ruyxmvrMQElhB2L0saRtuapK7c28QMWQ/viewform?entry.2064764942=Yes&entry.666097176=https%3A%2F%2Fgithub.com%2Fgoogle%2Fadk-js%2Fissues%2F951"> Yes</a> <a href="https://docs.google.com/forms/d/e/1FAIpQLSeuqIP8vcNJv0Gv84ruyxmvrMQElhB2L0saRtuapK7c28QMWQ/viewform?entry.2064764942=No&entry.666097176=https%3A%2F%2Fgithub.com%2Fgoogle%2Fadk-js%2Fissues%2F951"> No</a> 

- **Issue #950** (2026-10-06): **sawitrisaengchan0@gmail.com**
  *Symptoms*: https://google.com
  **Post-Mortem & Fix Analysis**:
  > Hi @saengchansawitri9-maker , Thank you for reporting this issue. To proceed, could you please provide a clear title, description, reproduction steps along with error logs? This information will help us investigate further. please use the latest version of @google/adk and let us know if you face any issues. Thank you.
  > Are you satisfied with the resolution of your issue? <a href="https://docs.google.com/forms/d/e/1FAIpQLSeuqIP8vcNJv0Gv84ruyxmvrMQElhB2L0saRtuapK7c28QMWQ/viewform?entry.2064764942=Yes&entry.666097176=https%3A%2F%2Fgithub.com%2Fgoogle%2Fadk-js%2Fissues%2F950"> Yes</a> <a href="https://docs.google.com/forms/d/e/1FAIpQLSeuqIP8vcNJv0Gv84ruyxmvrMQElhB2L0saRtuapK7c28QMWQ/viewform?entry.2064764942=No&entry.666097176=https%3A%2F%2Fgithub.com%2Fgoogle%2Fadk-js%2Fissues%2F950"> No</a> 

- **Issue #900** (2026-09-17): **ChromeBuiltInLlm rewrites schema-valid null tool args to {} before execution**
  *Symptoms*: ## Describe the bug  `ChromeBuiltInLlm` can generate a `responseConstraint` that explicitly permits `null` for a tool's top-level `args`, but `parseToolChoice()` silently rewrites that valid model output to `{}` before creating the ADK `functionCall`.  That means the value constrained and returned by Chrome is not the value the Runner executes.  The relevant parser logic is currently:  ```ts const args = isRecord(parsed['args']) ? parsed['args'] : {}; ```  For a declaration whose argument schema is nullable, schema conversion can produce:  ```json {"type":["object","null"],"properties":{"mode":{"type":"string"}}} ```  Chrome is therefore allowed to return:  ```json {"kind":"tool","name":"sensitive_action","args":null} ```  but ADK emits and executes the equivalent of:  ```text sensitive_action({}) ```  ## Reproduction  Verified against `google/adk-js` commit `77b08030479611c75dd559a68d18185b609f6e28` with the real Chrome Prompt API / on-device model, not only a mock.  Environment used for the real-browser reproduction:  - Chrome `153.0.8010.36` - Windows x64 - `LanguageModel.availability() === "available"`  Minimal tool shape:  ```ts new FunctionTool({   name: 'sensitive_action',   description: 'Test action',   parameters: {     type: 'OBJECT',     nullable: true,     properties: {mode: {type: 'STRING'}},   },   execute: (args) => {     console.log(args);     return {ok: true};   }, }); ```  Observed real Chrome output:  ```json {"kind":"tool","name":"sensitive_action","args"
  **Post-Mortem & Fix Analysis**:
  > Hi @ITSMERNB, Thank you for raising this issue. We reproduced it on our end. Since ADK function calls always expect an object for args, you can resolve this by removing `nullable: true` from the top-level parameters object and only setting `nullable: true `on the individual fields inside properties. Could you please try this and let me know if it works for you? 
  > Thanks, Varun. I tried that exact change against `77b0803`.  Removing `nullable: true` from the top-level parameters object does what you described: the generated `responseConstraint` keeps `args` as `type: "object"`, while a nullable field inside `properties` becomes e.g. `type: ["string", "null"]`. So a schema-compliant Chrome response can no longer emit `args: null`. That works as a workaround and matches ADK's object-only function-call contract.  I also checked the parser side separately. `parseToolChoice()` still turns any non-object `args` into `{}`, so if `null` reaches that boundary for any reason, the silent coercion is still there. In other words, the schema change prevents the original reproduction path, but it does not change the parser behavior itself.  For verification, the focused ChromeBuiltInLlm test file is green with the two added checks: 23/23 tests passing. I also tried Chrome 153.0.8010.36 in an automated headless profile; the Prompt API exists there but reports `
  > Hi @ITSMERNB, thank you for confirming and sharing your verification details. Since this workaround resolves the issue, could you please let us know if you are still facing any issues, or if we can go ahead and close this ticket?

- **Issue #870** (2026-09-10): **`getConnectionOptionsFromUri` fails for Cloud SQL Unix-socket URIs on mysql:// and mariadb://**
  *Symptoms*: ** Please make sure you read the contribution guide and file the issues in the right place. ** Contribution guide.  **Describe the bug** `getConnectionOptionsFromUri` (`core/src/sessions/db/operations.ts`) forwards `mysql://` and `mariadb://` URIs straight through as `clientUrl` with no Unix-socket handling. #799 / #869 fixed this for `postgres://`/`postgresql://`, but the identical bug is still live on `mysql://` and `mariadb://`, since Cloud SQL for MySQL uses the same `/cloudsql/PROJECT:REGION:INSTANCE` socket convention:  ​```ts if (uri.startsWith('mysql://')) {   ...   return { entities: ENTITIES, clientUrl: uri, driver: MySqlDriver }; } if (uri.startsWith('mariadb://')) {   ...   return { entities: ENTITIES, clientUrl: uri, driver: MariaDbDriver }; } ​```  Per the root-cause clarification added to #799, the failure isn't a percent-decoding gap — it's: 1. Unescaped colons in the Cloud SQL instance name (`project:region:instance`) causing `new URL()` to throw `Invalid URL`. 2. The `?host=/cloudsql/...` query-param convention, which `URL` has no concept of.  Additionally, unlike Postgres, `mysql2` and `mariadb` don't treat a `/`-prefixed `host` as a domain socket — they use a separate `socketPath` option (`mysql2/lib/connection_config.js:52`, `mariadb/lib/config/connection-options.js:104`), so a straight port of the Postgres fix won't work; the parsed socket path needs to map to `socketPath`, not `host`, at the call site.  **To Reproduce** Steps to reproduce the behavior: 
  **Post-Mortem & Fix Analysis**:
  > Hi @AnupamKumar-1, Thank you for reporting the issue and submitting a PR to fix it. We have reproduced the issue, and the PR will be reviewed. Thank you for your patience and understanding. 
  > Are you satisfied with the resolution of your issue? <a href="https://docs.google.com/forms/d/e/1FAIpQLSeuqIP8vcNJv0Gv84ruyxmvrMQElhB2L0saRtuapK7c28QMWQ/viewform?entry.2064764942=Yes&entry.666097176=https%3A%2F%2Fgithub.com%2Fgoogle%2Fadk-js%2Fissues%2F870"> Yes</a> <a href="https://docs.google.com/forms/d/e/1FAIpQLSeuqIP8vcNJv0Gv84ruyxmvrMQElhB2L0saRtuapK7c28QMWQ/viewform?entry.2064764942=No&entry.666097176=https%3A%2F%2Fgithub.com%2Fgoogle%2Fadk-js%2Fissues%2F870"> No</a> 

- **Issue #824** (2026-09-14): **TokenBasedContextCompactor includes events from other isolation scopes**
  *Symptoms*: **Describe the bug**  In `@google/adk` 2.0.0 and current `main`, enabling `TokenBasedContextCompactor` changes event visibility between workflow nodes that use `isolationScope: true`.  Without compaction, the current node's model does not receive an event from a peer node. When compaction runs, it starts from all active events in the session without applying the current node's `isolationScope`. The summarizer receives the peer event, and its summary is then included in the current node's model request.  [PR #656](https://github.com/google/adk-js/pull/656) describes the expected isolation behavior: peer nodes should not receive one another's turns. Compaction currently breaks that rule.  **To Reproduce**  1. Download and extract the attached `adk-js-compaction-isolation-poc.zip`. 2. In that directory, install the released package:     ```bash    npm init -y    npm install @google/adk@2.0.0    ```  3. Run:     ```bash    node poc.mjs    ```  The PoC uses the real `Runner`, `Workflow`, `LlmAgent`, `TokenBasedContextCompactor`, and `LlmSummarizer`. A loopback HTTP server records model requests and returns deterministic responses.  It runs the same two-node workflow twice. The control has no compactor. The second run enables the compactor on the current node. The token threshold is `1` so compaction happens during the short test.  The key result is:  ```text control.peerRecordReachedCurrentModel: false compactionRun.peerRecordReachedSummarizer: true compactionRun.peerRecordReached
  **Post-Mortem & Fix Analysis**:
  > Hi @Civitasmass, thank you for raising this issue. We have reproduced the issue. Hi @mikemikimike, thank you for your contribution with PR to fix this. The PR will be reviewed. Thank you both for your patience and understanding.
  > Are you satisfied with the resolution of your issue? <a href="https://docs.google.com/forms/d/e/1FAIpQLSeuqIP8vcNJv0Gv84ruyxmvrMQElhB2L0saRtuapK7c28QMWQ/viewform?entry.2064764942=Yes&entry.666097176=https%3A%2F%2Fgithub.com%2Fgoogle%2Fadk-js%2Fissues%2F824"> Yes</a> <a href="https://docs.google.com/forms/d/e/1FAIpQLSeuqIP8vcNJv0Gv84ruyxmvrMQElhB2L0saRtuapK7c28QMWQ/viewform?entry.2064764942=No&entry.666097176=https%3A%2F%2Fgithub.com%2Fgoogle%2Fadk-js%2Fissues%2F824"> No</a> 

- **Issue #804** (2026-09-10): **Bump @mikro-orm to 7.x: the 6.x chain carries a critical `tar` advisory and 7 more nodes**
  *Symptoms*: ### Describe the bug  `@google/adk` and `@google/adk-devtools` declare every `@mikro-orm/*` package at `^6.6.x`, which resolves to `6.6.14`. That version's transitive chain carries **8 advisory nodes, including the only `critical` in the production dependency tree**.  Measured on `main` (`bb2dd8f`) with `npm audit` against the committed lockfile.  ### The chain  ``` @mikro-orm/sqlite@6.6.14   └─ sqlite3@5.1.7        └─ node-gyp             ├─ make-fetch-happen ─ cacache ─ tar             └─ tar ```  `tar` alone has **12 advisories** at the resolved version (range `<=7.5.20`):  | Severity | Advisory | Summary | |---|---|---| | **critical** | GHSA-23hp-3jrh-7fpw | Decompression/parse DoS via unlimited input | | high | GHSA-34x7-hfp2-rc4v | Arbitrary file creation/overwrite via hardlink path traversal | | high | GHSA-8qq5-rm4j-mr97 | Arbitrary file overwrite and symlink poisoning | | high | GHSA-83g3-92jg-28cx | Arbitrary file read/write via hardlink target escape | | high | GHSA-qffp-2rhf-9h96 | Hardlink path traversal via drive-relative linkpath | | high | GHSA-9ppj-qmqm-q256 | Symlink path traversal via drive-relative linkpath | | high | GHSA-r6q2-hw4h-h46w | Race condition in path reservations (Unicode ligature collisions) | | high | GHSA-8x88-c5mf-7j5w | Negative entry size causes infinite loop in archive replace | | high | GHSA-r292-9mhp-454m | Uncontrolled recursion allows uncatchable stack overflow | | moderate | GHSA-vmf3-w455-68vh | PAX size override applied to interme
  **Post-Mortem & Fix Analysis**:
  > Are you satisfied with the resolution of your issue? <a href="https://docs.google.com/forms/d/e/1FAIpQLSeuqIP8vcNJv0Gv84ruyxmvrMQElhB2L0saRtuapK7c28QMWQ/viewform?entry.2064764942=Yes&entry.666097176=https%3A%2F%2Fgithub.com%2Fgoogle%2Fadk-js%2Fissues%2F804"> Yes</a> <a href="https://docs.google.com/forms/d/e/1FAIpQLSeuqIP8vcNJv0Gv84ruyxmvrMQElhB2L0saRtuapK7c28QMWQ/viewform?entry.2064764942=No&entry.666097176=https%3A%2F%2Fgithub.com%2Fgoogle%2Fadk-js%2Fissues%2F804"> No</a> 

- **Issue #799** (2026-09-10): **`getConnectionOptionsFromUri` fails for Cloud SQL Unix-socket connection URIs (percent-encoded host)**
  *Symptoms*: ### Summary When deploying an ADK agent to Cloud Run with a `DatabaseSessionService` backed by Cloud SQL over a Unix socket, `--session_service_uri` fails to connect. The URI's percent-encoded socket host (`%2Fcloudsql%2F<INSTANCE>`) is passed straight to MikroORM as `clientUrl` without decoding, so the pg driver treats it as a DNS hostname and every `createSession` / session read fails with a lookup error instead of connecting to the socket.  ### Environment - `@google/adk`: 1.6.0 (also present in earlier 1.x) - Deploy target: Cloud Run, Cloud SQL (PostgreSQL) via Unix socket - Session store: `DatabaseSessionService` via `--session_service_uri`  ### Reproduction 1. Provision a Cloud SQL Postgres instance and connect a Cloud Run service to it    over the standard Unix socket (`/cloudsql/<PROJECT>:<REGION>:<INSTANCE>`). 2. Deploy an agent with a socket-form session URI, e.g.: `postgresql://USER:PASS@%2Fcloudsql%2FPROJECT:REGION:INSTANCE/DB` (or the `?host=/cloudsql/...` variant — same result). 3. Start a session. Connection fails; the driver attempts a DNS/TCP lookup of the encoded host rather than using the socket.  ### Expected The socket-form URI resolves to the Unix socket path and connects, matching how `pg` / `gcloud` treat Cloud SQL socket connections.  ### Actual The percent-encoded host is never decoded, so `/cloudsql/...` is interpreted as a hostname and the connection fails.  ### Root cause `core/src/sessions/db/operations.ts` → `getConnectionOptionsFromUri()` forwa
  **Post-Mortem & Fix Analysis**:
  > Hi @ujvk, thank you for raising this issue. We have reproduced the issue. Hi @AnupamKumar-1, thank you for your contribution with PR to fix this. The PR will be reviewed. Thank you both for your patience and understanding.
  > One clarification about the original report: the statement that the “percent-encoded host is never decoded” does not appear to be fully correct. MikroORM already handles this case using decodeURIComponent(url.hostname).  The actual problem is with the reproduction URI: it percent-encodes the slashes but leaves the colons in the Cloud SQL instance connection name unescaped, causing new URL() to throw an Invalid URL error.  #802 fixes this case and also supports the ?host=/cloudsql/... form, so the reported issue is addressed. I’m adding this clarification to avoid the already-working percent-encoded form being changed later based on a misunderstanding of the underlying issue.  Thanks to @kalenkevich and @ScottMansfield for catching this during the review.
  > Are you satisfied with the resolution of your issue? <a href="https://docs.google.com/forms/d/e/1FAIpQLSeuqIP8vcNJv0Gv84ruyxmvrMQElhB2L0saRtuapK7c28QMWQ/viewform?entry.2064764942=Yes&entry.666097176=https%3A%2F%2Fgithub.com%2Fgoogle%2Fadk-js%2Fissues%2F799"> Yes</a> <a href="https://docs.google.com/forms/d/e/1FAIpQLSeuqIP8vcNJv0Gv84ruyxmvrMQElhB2L0saRtuapK7c28QMWQ/viewform?entry.2064764942=No&entry.666097176=https%3A%2F%2Fgithub.com%2Fgoogle%2Fadk-js%2Fissues%2F799"> No</a> 

- **Issue #773** (2026-09-02): **fix(agents): request-input resume fabricates a ToolConfirmation to carry resume inputs**
  *Symptoms*: Follow-up from the security review of #771, which @AmaadMartin's approval names as one of two items left open. There is no reachable bypass today — both the reviewer and the author went looking and did not find one — so this is a type-safety and future-proofing issue rather than a live vulnerability.  ### Describe the bug  `ToolConfirmation` means one thing everywhere in the tree: a human looked at an action and approved it. The request-input resume path uses it for something else — as a transport for resume inputs — and to do that it constructs an approval that no human gave:  ```ts // core/src/agents/processors/request_input_llm_request_processor.ts:107-113 const toolConfirmationDict: Record<string, ToolConfirmation> = {}; for (const id of Object.keys(pending)) {   toolConfirmationDict[id] = new ToolConfirmation({     confirmed: true,     payload: resumeInputs,   }); } ```  The dict is handed to `handleFunctionCallList`, which installs each entry as `toolContext.toolConfirmation` (`core/src/agents/functions.ts:346-347`). That is the same field the confirmation gate reads:  - `core/src/tools/function_tool.ts:269,282` — present and `confirmed` means the   gate is satisfied, so the tool runs. - `core/src/plugins/security_plugin.ts:134,139` — same test, same conclusion.  So this is the one `ToolConfirmation` in the codebase that is fabricated rather than approved, and it is indistinguishable at the point of use from one a person actually granted.  ### Why it is not currently ex
  **Post-Mortem & Fix Analysis**:
  > Are you satisfied with the resolution of your issue? <a href="https://docs.google.com/forms/d/e/1FAIpQLSeuqIP8vcNJv0Gv84ruyxmvrMQElhB2L0saRtuapK7c28QMWQ/viewform?entry.2064764942=Yes&entry.666097176=https%3A%2F%2Fgithub.com%2Fgoogle%2Fadk-js%2Fissues%2F773"> Yes</a> <a href="https://docs.google.com/forms/d/e/1FAIpQLSeuqIP8vcNJv0Gv84ruyxmvrMQElhB2L0saRtuapK7c28QMWQ/viewform?entry.2064764942=No&entry.666097176=https%3A%2F%2Fgithub.com%2Fgoogle%2Fadk-js%2Fissues%2F773"> No</a> 

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

### Incident Patch 1: `f49cc1b9` (2026-10-05)
**Commit Message**: docs(memory): add memory guide and sample (#982)

**File**: `docs/guides/README.md` (modified, +6/-0)
```diff
@@ -20,6 +20,12 @@ The record of everything that happens during an invocation, and the side effects
 
 - [Event](events/event/index.md) - The `Event` and `EventActions` shapes, `isFinalResponse`, and the fields that diverge from adk-python.
 
+### Memory
+
+Cross-session memory ingestion (`addSessionToMemory`) and retrieval (`searchMemory`) across in-memory keyword stores, Vertex AI RAG Engine corpora, and Vertex AI Agent Engine Memory Bank.
+
+- [Memory](memory/index.md) - `BaseMemoryService`, `InMemoryMemoryService`, `VertexAiRagMemoryService`, `VertexAiMemoryBankService`, and the `LOAD_MEMORY` / `PRELOAD_MEMORY` tools.
+
 ### Planners
 
 Planning for an `LlmAgent` through its `planner` option: the model's built-in thinking, or a Plan-ReAct instruction for a model without it.
```

**File**: `docs/guides/memory/index.md` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
+# Memory (`BaseMemoryService`, `InMemoryMemoryService`, `VertexAiRagMemoryService`, and `VertexAiMemoryBankService`)
+
+Memory services in the Agent Development Kit store completed conversation sessions and retrieve relevant turns across sessions for the same application and user.
+
+Every backend implements `BaseMemoryService` so agents and tools can search historical sessions without coupling to a storage engine:
+
+- `InMemoryMemoryService` - Stores session events in process memory and matches queries by case-insensitive keyword overlap for local development and unit tests.
+- `VertexAiRagMemoryService` - Uploads session transcripts into a Vertex AI RAG Engine corpus and retrieves matching chunks with tenant isolation across shared corpora.
+- `VertexAiMemoryBankService` - Generates, stores, and retrieves structured user facts in Vertex AI Agent Engine Memory Bank.
+
+## Introduction
+
+A `Session` holds the turn-by-turn history of one conversation, whereas `BaseMemoryService` indexes completed sessions so an agent can recall facts from earlier conversations with the same user. Calling `addSessionToMemory(session)` ingests a `Session` into the configured backend, and calling `searchMemory({appName, userId, query})` returns a `SearchMemoryResponse` containing `MemoryEntry` items whose `content`, `author`, and ISO 8601 `timestamp` come from matching session events.
+
+During an agent run, `Runner` attaches the configured `BaseMemoryService` to `InvocationContext.memoryService` (`InMemoryRunner` defaults to an `InMemoryMemoryService` instance). Agents reach memory either on demand by registering `LOAD_MEMORY` (`LoadMemoryTool`), which exposes the `load_memory` function declaration to the model, or automatically on every turn by registering `PRELOAD_MEMORY` (`PreloadMemoryTool`), which injects `<PAST_CONVERSATIONS>` into the outgoing `LlmRequest` instructions. Custom tools and callbacks call `toolContext.searchMemory(query)` on `Context`, which automatically forwards the active `appName` and `userId`.
+
+## Get started
+
+Create an `InMemoryMemoryService`, ingest a completed `Session` containing user preferences, and query those memories from a later turn for the same `appName` and `userId`.
+
+```ts
+import {
+  createEvent,
+  InMemoryMemoryService,
+  InMemorySessionService,
+} from '@google/adk';
+
+const sessionService = new InMemorySessionService();
+const memoryService = new InMemoryMemoryService();
+
+const pastSession = await sessionService.createSession({
+  appName: 'travel_assistant',
+  userId: 'user-42',
+});
+
+await sessionService.appendEvent({
+  session: pastSession,
+  event: createEvent({
+    author: 'user',
+    timestamp: Date.parse('2025-02-10T09:15:00.000Z'),
+    content: {
+      role: 'user',
+      parts: [{text: 'I prefer aisle seats and vegetarian meals on flights.'}],
+    },
+  }),
+});
+
+await memoryService.addSessionToMemory(pastSession);
+
+const searchResult = await memoryService.searchMemory({
+  appName: 'travel_assistant',
+  userId: 'user-42',
+  query: 'aisle vegetarian flights',
+});
+
+for (const entry of searchResult.memories) {
+  const text = entry.content.parts?.map((part) => part.text ?? '').join(' ');
+  console.log(`[${entry.timestamp}] ${entry.author}: ${text}`);
+}
+```
+
+## How it works
+
+1. **Session ingestion (`addSessionToMemory`)**: When a session completes or reaches a checkpoint, application code passes the `Session` object to `memoryService.addSessionToMemory(session)`. `InMemoryMemoryService` filters `session.events` to retain events where `(event.content?.parts?.length ?? 0) > 0` and stores them in a two-level null-prototype map (`Object.create(null)`) keyed by `${session.appName}/${session.userId}` and `session.id`.
+2. **Tenant-scoped retrieval (`searchMemory`)**: `searchMemory` accepts a `SearchMemoryRequest` (`{appName, userId, query}`) and resolves to a `SearchMemoryResponse` (`{memories: MemoryEntry[]}`). Unlike `adk-python` v0.1.0, which groups events inside `MemoryResult` objects by `session_id`, `adk-js` returns a flat `MemoryEntry[]` array where each entry carries `content` (`@google/genai` `Content`), `author` (`string | undefined`), and `timestamp` (`string | undefined`, formatted via `new Date(event.timestamp).toISOString()`).
+3. **Keyword matching in `InMemoryMemoryService`**: `InMemoryMemoryService` splits `req.query.toLowerCase()` on whitespace (`/\s+/`) and extracts lowercase alphabetic words (`/[A-Za-z]+/g`) from the joined `part.text` strings of each stored event. Any event whose word set contains at least one query word is returned as a `MemoryEntry`. Matching is whole-word, so `flight` does not match `flights`. This diverges from `adk-python` v0.1.0, which matched each keyword as a substring of the raw event text; `adk-js` follows the later whole-word behavior, so queries must use whole words that appear in the stored events.
+4. **Transcript upload and chunk deduplication in `VertexAiRagMemoryService`*
```

**File**: `samples/memory/README.md` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+# Memory Sample (`BaseMemoryService`, `InMemoryMemoryService`, and `MemoryEntry`)
+
+This sample demonstrates how ADK agents ingest completed sessions into `ctx.memoryService` (`BaseMemoryService`) via `addSessionToMemory(session)`, retrieve matching `MemoryEntry` items across sessions via `searchMemory({appName, userId, query})`, and persist a JSON digest of the recalled memories through `ctx.artifactService` with `EventActions.artifactDelta`.
+
+## Overview
+
+`MemoryShowcaseAgent` is a deterministic `BaseAgent` subclass that seeds two completed sessions into `ctx.memoryService` (`InMemoryMemoryService`): one belonging to the active `{appName, userId}` with Lisbon flight, companion, meal, and hotel details, and a second belonging to `'other-user'` to verify tenant isolation. On each turn it calls `searchMemory({appName: ctx.appName, userId: ctx.userId, query})`, saves `memory_digest.json` via `ctx.artifactService.saveArtifact`, and returns the recalled `MemoryEntry` items (`author`, ISO 8601 `timestamp`, and `content`).
+
+## Sample Inputs
+
+- `Who am I traveling to Lisbon with and what meal did I request?`
+
+  _Searches the active user's indexed sessions in `ctx.memoryService`, saves `memory_digest.json` via `ctx.artifactService`, and returns the matching Lisbon flight and hotel memories while excluding `'other-user'`._
+
+- `Which Lisbon hotel did we confirm and what check-in note was saved?`
+
+  _Exercises `searchMemory` for the hotel and check-in terms in `adk web` and surfaces both the `recallUserMemories` tool chip and the `memory_digest.json` artifact chip._
+
+## Running the Sample
+
+Run the self-contained `InMemoryRunner` script directly to inspect each emitted `Event` and confirm that an unindexed user sees zero memories:
+
+```bash
+npx tsx samples/memory/agent.ts
+```
+
+Or run the exported `rootAgent` interactively through the ADK CLI after building the workspace:
+
+```bash
+npm run build
+npm run sample -- samples/memory/agent.ts
+```
+
+`samples/` is not an npm workspace, so it is type-checked separately:
+
+```bash
+npm run ts:check:samples
+```
+
+## Related Guides
+
+- [Memory](../../docs/guides/memory/index.md) - `BaseMemoryService`, `InMemoryMemoryService`, `VertexAiRagMemoryService`, `VertexAiMemoryBankService`, and the `LOAD_MEMORY` / `PRELOAD_MEMORY` tools.
```

**File**: `samples/memory/agent.ts` (added, +302/-0)
```diff
@@ -0,0 +1,302 @@
+/**
+ * @license
+ * Copyright 2026 Google LLC
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+/**
+ * Memory (`BaseMemoryService`, `InMemoryMemoryService`, and `MemoryEntry`)
+ * ../../docs/guides/memory/index.md
+ *
+ * A deterministic `BaseAgent` that ingests completed prior sessions into
+ * `ctx.memoryService` (`InMemoryMemoryService`), queries tenant-scoped
+ * `MemoryEntry` items via `searchMemory({appName, userId, query})`, and
+ * persists the matched memory digest to `ctx.artifactService` while recording
+ * the revision in `EventActions.artifactDelta`.
+ *
+ * This sample exports `rootAgent` for `adk web` and `npm run sample`, and also
+ * includes a direct `InMemoryRunner` driver (`main()`) because the CLI only
+ * prints conversational text — running directly lets `main()` inspect the
+ * structured `MemoryEntry` fields (`author`, ISO 8601 `timestamp`, and
+ * `content`) and verify that searching under a second `userId` returns zero
+ * memories from the first user's sessions.
+ *
+ * Run (offline, no API key):
+ *   npx tsx samples/memory/agent.ts
+ *   npm run sample -- samples/memory/agent.ts
+ */
+
+import {
+  BaseAgent,
+  createEvent,
+  createEventActions,
+  createSession,
+  Event,
+  getFunctionCalls,
+  getFunctionResponses,
+  InMemoryMemoryService,
+  InMemoryRunner,
+  InvocationContext,
+  isFinalResponse,
+  MemoryEntry,
+  stringifyContent,
+} from '@google/adk';
+import {fileURLToPath} from 'node:url';
+
+const MEMORY_DIGEST_FILENAME = 'memory_digest.json';
+
+function extractEntryText(entry: MemoryEntry): string {
+  return (
+    entry.content.parts
+      ?.map((part) => part.text ?? '')
+      .filter((text) => text.length > 0)
+      .join(' ') ?? ''
+  );
+}
+
+class MemoryShowcaseAgent extends BaseAgent {
+  private readonly fallbackMemoryService = new InMemoryMemoryService();
+
+  constructor() {
+    super({
+      name: 'memory_showcase_agent',
+      description:
+        'Demonstrates cross-session memory ingestion and tenant-scoped search via BaseMemoryService.',
+    });
+  }
+
+  protected override async *runAsyncImpl(
+    ctx: InvocationContext,
+  ): AsyncGenerator<Event, void, void> {
+    const memoryService = ctx.memoryService ?? this.fallbackMemoryService;
+    const userQuery =
+      ctx.userContent?.parts
+        ?.map((part) => part.text ?? '')
+        .join(' ')
+        .trim() || 'Lisbon vegetarian hotel';
+
+    const priorTripSession = createSession({
+      id: 'prior-session-lisbon',
+      appName: ctx.appName,
+      userId: ctx.userId,
+      events: [
+        createEvent({
+          author: 'user',
+          timestamp: Date.parse('2025-02-10T09:15:00.000Z'),
+          content: {
+            role: 'user',
+            parts: [
+              {
+                text: 'We booked flights to Lisbon with Nadia for October 14 and requested vegetarian meals.',
+              },
+            ],
+          },
+        }),
+        createEvent({
+          author: 'model',
+          timestamp: Date.parse('2025-02-10T09:16:00.000Z'),
+          content: {
+            role: 'model',
+            parts: [
+              {
+                text: 'Confirmed Lisbon hotel near Rossio Square with late check-in.',
+              },
+            ],
+          },
+        }),
+      ],
+    });
+
+    const otherTenantSession = createSession({
+      id: 'prior-session-other-user',
+      appName: ctx.appName,
+      userId: 'other-user',
+      events: [
+        createEvent({
+          author: 'user',
+          timestamp: Date.parse('2025-02-11T14:00:00.000Z'),
+          content: {
+            role: 'user',
+            parts: [
+              {
+                text: 'Secret Lisbon itinerary belonging to another user.',
+              },
+            ],
+          },
+        }),
+      ],
+    });
+
+    await memoryService.addSessionToMemory(priorTripSession);
+    await memoryService.addSessionToMemory(otherTenantSession);
+
+    yield createEvent({
+      invocationId: ctx.invocationId,
+      author: this.name,
+      branch: ctx.branch,
+      content: {
+        role: 'model',
+        parts: [
+          {
+            functionCall: {
+              id: 'call-memory-1',
+              name: 'recallUserMemories',
+              args: {
+                appName: ctx.appName,
+                userId: ctx.userId,
+                query: userQuery,
+              },
+            },
+          },
+        ],
+      },
+    });
+
+    const searchResult = await memoryService.searchMemory({
+      appName: ctx.appName,
+      userId: ctx.userId,
+      query: userQuery,
+    });
+
+    const matchedSummaries = searchResult.memories.map((entry) => ({
+      author: entry.author ?? 'unknown',
+      timestamp: entry.timestamp ?? '',
+      text: extractEntryText(entry),
+    }));
+
+    const artifactDelta: Record<string, number> = {};
+    if (ctx.artifactService) {
+      const rev = await ctx.artifactService.saveArtifact({
+ 
```

---

### Incident Patch 2: `4f21d6f6` (2026-10-02)
**Commit Message**: fix: preserve falsy tool errors (#957)

**File**: `core/src/agents/functions.ts` (modified, +4/-1)
```diff
@@ -526,6 +526,7 @@ export async function handleFunctionCallList({
     // response.
     let functionResponse = null;
     let functionResponseError: unknown;
+    let functionResponseErrorOccurred = false;
     functionResponse =
       await invocationContext.pluginManager.runBeforeToolCallback({
         tool: tool,
@@ -576,11 +577,13 @@ export async function handleFunctionCallList({
             // If the error callback returns undefined, use the error message
             // as the function response error.
             functionResponseError = e.message;
+            functionResponseErrorOccurred = true;
           }
         } else {
           // If the error is not an Error, use the error object as the function
           // response error.
           functionResponseError = e;
+          functionResponseErrorOccurred = true;
         }
       }
     }
@@ -640,7 +643,7 @@ export async function handleFunctionCallList({
       continue;
     }
 
-    if (functionResponseError) {
+    if (functionResponseErrorOccurred) {
       functionResponse = {error: functionResponseError};
     } else if (functionResponse == null) {
       functionResponse = {result: functionResponse};
```

**File**: `core/test/agents/functions_test.ts` (modified, +37/-0)
```diff
@@ -62,6 +62,18 @@ const errorTool = new FunctionTool({
   },
 });
 
+class ThrowingTool extends BaseTool {
+  constructor(private readonly thrownValue: unknown) {
+    super({name: 'throwingTool', description: 'throws a test value'});
+  }
+
+  override async runAsync(
+    _request: Parameters<BaseTool['runAsync']>[0],
+  ): Promise<unknown> {
+    throw this.thrownValue;
+  }
+}
+
 // Plugin for testing
 class TestPlugin extends BasePlugin {
   beforeToolCallbackResponse?: Record<string, unknown>;
@@ -182,6 +194,31 @@ describe('handleFunctionCallList', () => {
     });
   });
 
+  it.each([
+    ['empty Error message', new Error('')],
+    ['empty string', ''],
+    ['zero', 0],
+    ['false', false],
+    ['null', null],
+    ['undefined', undefined],
+  ])('preserves a thrown %s as an error response', async (_label, thrown) => {
+    const tool = new ThrowingTool(thrown);
+    const event = await handleFunctionCallList({
+      invocationContext,
+      functionCalls: [callFor(tool)],
+      toolsDict: {[tool.name]: tool},
+      beforeToolCallbacks: [],
+      afterToolCallbacks: [],
+    });
+
+    expect(event).not.toBeNull();
+    const response = (event as Event).content!.parts![0].functionResponse!
+      .response;
+    const expectedError = thrown instanceof Error ? thrown.message : thrown;
+    expect(response).toHaveProperty('error', expectedError);
+    expect(response).not.toHaveProperty('result');
+  });
+
   it('should wrap array responses into a {results: array} object', async () => {
     const arrayTool = new FunctionTool({
       name: 'arrayTool',
```

---

### Incident Patch 3: `8429fce6` (2026-10-02)
**Commit Message**: fix: pin a fetched agent card's RPC url(s) to the origin it was fetched from (#829)

* fix: pin a fetched agent card's RPC url(s) to the origin it was fetched from

Independent finding, found while auditing a same-day adk-python fix
(commit 2685acd3, "fix: stop caching a remote agent card that failed
validation") during a routine commit-batch audit. That fix closed a
caching bug around adk-python's pre-existing
_validate_card_rpc_targets check -- a card fetched from a configured
source must declare RPC url(s) sharing that source's origin, https
(or http on loopback), preventing a compromised/misconfigured/MITM'd
card-hosting endpoint from redirecting all future A2A traffic for
that agent to an attacker-chosen origin.

adk-js has no equivalent check anywhere. resolveAgentCard() fetches a
card via the external @a2a-js/sdk package's DefaultAgentCardResolver
and returns it with zero validation. Inspected that SDK package
directly (npm pack @a2a-js/sdk) -- its resolver performs no such
check either. This is not a caching bug around an existing
protection; the protection itself does not exist anywhere in adk-js's
own code or the SDK it delegates to.

Dynamically confirmed with a real loc

**File**: `core/src/a2a/a2a_remote_agent.ts` (modified, +14/-2)
```diff
@@ -29,7 +29,7 @@ import {
   toForwardableA2AParts,
   toMissingRemoteSessionParts,
 } from './a2a_remote_agent_utils.js';
-import {resolveAgentCard} from './agent_card.js';
+import {resolveAgentCard, ResolveAgentCardOptions} from './agent_card.js';
 import {toAdkEvent} from './event_converter_utils.js';
 import {getA2ASessionMetadata} from './metadata_converter_utils.js';
 
@@ -85,6 +85,15 @@ export interface RemoteA2AAgentConfig extends BaseAgentConfig {
    */
   agentCard?: AgentCard | string;
 
+  /**
+   * Controls how a fetched agent card's RPC URL(s) are validated against
+   * the location the card was fetched from. Only relevant when
+   * {@link RemoteA2AAgentConfig.agentCard} is a URL rather than an
+   * already-loaded card object; see {@link ResolveAgentCardOptions} for
+   * what each option relaxes and why both default to failing closed.
+   */
+  resolveAgentCardOptions?: ResolveAgentCardOptions;
+
   /**
    * Optional pre-initialized Client for connection pooling.
    */
@@ -142,7 +151,10 @@ export class RemoteA2AAgent extends BaseAgent<RemoteA2AAgentConfig> {
     }
 
     if (this.a2aConfig.agentCard) {
-      this.card = await resolveAgentCard(this.a2aConfig.agentCard);
+      this.card = await resolveAgentCard(
+        this.a2aConfig.agentCard,
+        this.a2aConfig.resolveAgentCardOptions,
+      );
 
       if (!this.client) {
         const factory = this.a2aConfig.clientFactory || new ClientFactory();
```

**File**: `core/src/a2a/agent_card.ts` (modified, +252/-37)
```diff
@@ -22,19 +22,57 @@ import {BaseTool, isBaseTool} from '../tools/base_tool.js';
 import {isBaseToolset} from '../tools/base_toolset.js';
 import {logger} from '../utils/logger.js';
 import {
-  isHttpUrl,
   isLinkLocalAddress,
+  isLocalhostHostname,
   normalizeHost,
   resolveHostAddresses,
 } from '../utils/ssrf_guard.js';
 import {RunnableRoot} from '../workflow/run_node_as_invocation.js';
 import {isWorkflow} from '../workflow/workflow.js';
 
 /**
- * A single-letter URL protocol, which is a Windows drive letter rather than a
- * scheme: `new URL('C:\\cards\\card.json')` parses with `protocol === 'c:'`.
+ * Options controlling how a fetched agent card's RPC URL(s) are validated
+ * against the location the card was fetched from. See `validateCardRpcTargets`
+ * for what each check defends against and why
+ * both default to failing closed.
  */
-const WINDOWS_DRIVE_PROTOCOL = /^[a-z]:$/i;
+export interface ResolveAgentCardOptions {
+  /**
+   * Explicit escape hatch to accept a plaintext http:// RPC URL on a
+   * non-loopback host.
+   *
+   * This is intentionally insecure: an RPC URL that isn't https and isn't
+   * on this machine can be intercepted or altered by anything on the
+   * network path, even when its origin matches the card's own. Only set
+   * this for a card source you know serves plain http on a host you
+   * trust (e.g. a private, internal service reached over a channel
+   * that's secured some other way). When set to `true`, a loud warning is
+   * logged for each RPC URL this affects.
+   *
+   * Defaults to `false`: RPC URLs must be https, or http on a loopback
+   * host (localhost, 127.0.0.0/8, ::1, 0.0.0.0, or ::).
+   */
+  allowInsecureRpc?: boolean;
+  /**
+   * Explicit escape hatch to accept an RPC URL whose origin differs from
+   * the location the card was fetched from.
+   *
+   * This is intentionally permissive: it is what lets a compromised or
+   * misconfigured card-hosting endpoint redirect all subsequent A2A
+   * traffic for this agent, including whatever credential material the
+   * request-forwarding path carries, to a different origin than the one
+   * that was actually configured and fetched. The A2A spec allows a card
+   * to point RPC at a different origin than where the card itself is
+   * served from (e.g. static card hosting separate from the API
+   * backend), which is the legitimate case this exists for -- only set
+   * this when that's a shape you actually expect. When set to `true`, a
+   * loud warning is logged for each RPC URL this affects.
+   *
+   * Defaults to `false`: every RPC URL must share the origin the card
+   * was fetched from.
+   */
+  allowCrossOriginRpc?: boolean;
+}
 
 /**
  * Resolves the AgentCard from the provided source.
@@ -50,19 +88,23 @@ const WINDOWS_DRIVE_PROTOCOL = /^[a-z]:$/i;
  */
 export async function resolveAgentCard(
   agentCard: AgentCard | string,
+  options: ResolveAgentCardOptions = {},
 ): Promise<AgentCard> {
   if (typeof agentCard === 'object') {
     return agentCard;
   }
 
-  const url = parseCardUrl(agentCard);
-  if (url && isHttpUrl(url)) {
-    await assertHostAllowed(url);
+  const source = agentCard as string;
+  if (source.startsWith('http://') || source.startsWith('https://')) {
+    await refuseLinkLocalHost(source);
     const resolver = new DefaultAgentCardResolver({
-      fetchImpl: noRedirectFetch(agentCard),
+      fetchImpl: refuseRedirectFetch,
     });
-    return resolver.resolve(agentCard);
+    const card = await resolver.resolve(source);
+    validateCardRpcTargets(card, source, options);
+    return card;
   }
+  const url = parseCardUrl(source);
   if (url && url.protocol !== 'file:') {
     throw new Error(
       `Unsupported agent card URL scheme "${url.protocol}": ${agentCard}. ` +
@@ -72,6 +114,70 @@ export async function resolveAgentCard(
   return readAgentCardFile(agentCard, url);
 }
 
+/**
+ * Matches the single-letter "protocol" Node's URL parser produces for a
+ * Windows drive-letter path (e.g. `C:\foo` or `C:/foo` parses with
+ * `protocol === 'c:'`), so such a path is treated as a filesystem path
+ * rather than rejected as an unsupported URL scheme.
+ */
+const WINDOWS_DRIVE_PROTOCOL = /^[a-z]:$/i;
+
+/**
+ * Rejects `source` if its host is, or resolves to, a link-local address --
+ * before any fetch happens, so the request itself never reaches the
+ * metadata endpoint a link-local address can expose.
+ *
+ * Checks every address a hostname resolves to, not only the first: DNS can
+ * return several, and `fetch`'s own connection may pick any of them, so one
+ * link-local address among otherwise-global ones is still refused.
+ */
+async function refuseLinkLocalHost(source: string): Promise<void> {
+  const hostname = normalizeHost(new URL(source).hostname);
+  if (isLocalhostHostname(hostname)) {
+    return;
+  }
+  const addresses = await resolveHostAddresses(hostname);
+  if (addresses.some((address) => isLinkLocalAddress(address))) {
+    throw 
```

**File**: `core/src/a2a/agent_to_a2a.ts` (modified, +14/-2)
```diff
@@ -17,7 +17,11 @@ import {InMemorySessionService} from '../sessions/in_memory_session_service.js';
 import {logger} from '../utils/logger.js';
 import {loadOptionalPeer} from '../utils/optional_peer.js';
 import {RunnableRoot} from '../workflow/run_node_as_invocation.js';
-import {getA2AAgentCard, resolveAgentCard} from './agent_card.js';
+import {
+  getA2AAgentCard,
+  resolveAgentCard,
+  ResolveAgentCardOptions,
+} from './agent_card.js';
 import {A2AAgentExecutor} from './agent_executor.js';
 import {
   AdkDefaultRequestHandler,
@@ -78,6 +82,14 @@ export interface ToA2aOptions {
   basePath?: string;
   /** Optional pre-built AgentCard object or path to agent card JSON */
   agentCard?: AgentCard | string;
+  /**
+   * Controls how a fetched agent card's RPC URL(s) are validated against
+   * the location the card was fetched from. Only relevant when
+   * {@link ToA2aOptions.agentCard} is a URL rather than an already-loaded
+   * card object or file path; see {@link ResolveAgentCardOptions} for
+   * what each option relaxes and why both default to failing closed.
+   */
+  resolveAgentCardOptions?: ResolveAgentCardOptions;
   /** Optional pre-built Runner object */
   runner?: Runner;
   /** Optional session service */
@@ -180,7 +192,7 @@ export async function toA2a(
   const basePath = options.basePath || '';
   const rpcUrl = `${protocol}://${host}:${port}${basePath}`;
   const agentCard = options.agentCard
-    ? await resolveAgentCard(options.agentCard)
+    ? await resolveAgentCard(options.agentCard, options.resolveAgentCardOptions)
     : await getA2AAgentCard(agent, [
         {
           url: `${rpcUrl}/jsonrpc`,
```

**File**: `core/src/a2a/index.ts` (modified, +1/-0)
```diff
@@ -17,6 +17,7 @@ export type {
   RemoteA2AAgentConfig,
 } from './a2a_remote_agent.js';
 export {getA2AAgentCard} from './agent_card.js';
+export type {ResolveAgentCardOptions} from './agent_card.js';
 export {A2AAgentExecutor} from './agent_executor.js';
 export type {
   AfterEventCallback,
```

**File**: `core/test/a2a/agent_card_test.ts` (modified, +321/-4)
```diff
@@ -5,15 +5,23 @@
  */
 
 import {mkdtemp, rm, writeFile} from 'node:fs/promises';
+import * as http from 'node:http';
+import type {AddressInfo} from 'node:net';
+import * as os from 'node:os';
 import {tmpdir} from 'node:os';
 import {join} from 'node:path';
 import {pathToFileURL} from 'node:url';
-
 import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
-import {buildAgentSkills, resolveAgentCard} from '../../src/a2a/agent_card.js';
+import {
+  buildAgentSkills,
+  resolveAgentCard,
+  ResolveAgentCardOptions,
+} from '../../src/a2a/agent_card.js';
+import {logger} from '../../src/utils/logger.js';
 import {node} from '../../src/workflow/node.js';
 import {Workflow} from '../../src/workflow/workflow.js';
 
+import type {AgentCard} from '@a2a-js/sdk';
 import {
   BaseAgent,
   BaseTool,
@@ -188,6 +196,307 @@ describe('Agent Card', () => {
     });
   });
 
+  describe('resolveAgentCard', () => {
+    // Card responses in this suite are served by a real local http server so
+    // resolveAgentCard's actual network fetch path is exercised, not a mock
+    // of the SDK's resolver -- the vulnerability this suite pins was in how
+    // a genuinely-fetched card's contents were (not) checked.
+
+    function baseCard(url: string, extra: Partial<AgentCard> = {}) {
+      return {
+        name: 'test-agent',
+        description: '',
+        protocolVersion: '0.3.0',
+        version: '1.0.0',
+        url,
+        preferredTransport: 'JSONRPC',
+        capabilities: {},
+        skills: [],
+        defaultInputModes: ['text/plain'],
+        defaultOutputModes: ['text/plain'],
+        ...extra,
+      };
+    }
+
+    async function withCardServer<T>(
+      cardFactory: (port: number) => object,
+      fn: (source: string) => Promise<T>,
+      bindHost = '127.0.0.1',
+    ): Promise<T> {
+      const server = http.createServer((req, res) => {
+        const port = (server.address() as AddressInfo).port;
+        res.writeHead(200, {'Content-Type': 'application/json'});
+        res.end(JSON.stringify(cardFactory(port)));
+      });
+      await new Promise<void>((resolve) => server.listen(0, bindHost, resolve));
+      try {
+        const port = (server.address() as AddressInfo).port;
+        return await fn(`http://${bindHost}:${port}`);
+      } finally {
+        server.close();
+      }
+    }
+
+    /**
+     * Returns the address of a non-loopback IPv4 interface on this machine,
+     * or `undefined` if none is configured (e.g. a fully network-isolated
+     * CI sandbox with only a loopback interface). Used to exercise the
+     * scheme check's non-loopback branch against a real, locally-bindable
+     * address rather than an external domain this environment can't
+     * actually route a request to and get back.
+     */
+    function findNonLoopbackIPv4(): string | undefined {
+      const interfaces = os.networkInterfaces();
+      for (const addrs of Object.values(interfaces)) {
+        for (const addr of addrs ?? []) {
+          if (addr.family === 'IPv4' && !addr.internal) {
+            return addr.address;
+          }
+        }
+      }
+      return undefined;
+    }
+
+    it('accepts a card whose RPC url shares the fetch origin', async () => {
+      await withCardServer(
+        (port) => baseCard(`http://127.0.0.1:${port}/rpc`),
+        async (source) => {
+          const card = await resolveAgentCard(source);
+          expect(card.url).toBe(`${source}/rpc`);
+        },
+      );
+    });
+
+    it('accepts a same-origin additionalInterfaces entry', async () => {
+      await withCardServer(
+        (port) =>
+          baseCard(`http://127.0.0.1:${port}/rpc`, {
+            additionalInterfaces: [
+              {transport: 'JSONRPC', url: `http://127.0.0.1:${port}/rpc2`},
+            ],
+          }),
+        async (source) => {
+          const card = await resolveAgentCard(source);
+          expect(card.url).toBe(`${source}/rpc`);
+        },
+      );
+    });
+
+    it('rejects an off-origin RPC url on a fetched card', async () => {
+      // The reported vulnerability: a card fetched from a trusted,
+      // configured source can declare an RPC url pointing anywhere at
+      // all, and it was followed with no check that it matched where the
+      // card actually came from.
+      await withCardServer(
+        () => baseCard('https://attacker.example.net/rpc'),
+        async (source) => {
+          await expect(resolveAgentCard(source)).rejects.toThrow(/same origin/);
+        },
+      );
+    });
+
+    it('rejects an off-origin additionalInterfaces entry even when the primary url is same-origin', async () => {
+      // Every url the card offers must be checked, not only the one a
+      // particular transport negotiation would pick.
+      await withCardServer(
+        (port) =>
+          baseCard(`http://127.0.0.1:${port}/rpc`, {
+            additionalInterfaces: [
+              {transport: 'JSONRPC', url: 'https://attack
```

**File**: `core/test/a2a/agent_to_a2a_test.ts` (modified, +19/-2)
```diff
@@ -174,7 +174,12 @@ describe('toA2a', () => {
       allowUnauthenticated: true,
     });
 
-    expect(resolveAgentCard).toHaveBeenCalledWith('path/to/card.json');
+    // Second argument is resolveAgentCardOptions, forwarded from
+    // ToA2aOptions and undefined here since this call doesn't set it.
+    expect(resolveAgentCard).toHaveBeenCalledWith(
+      'path/to/card.json',
+      undefined,
+    );
     expect(getA2AAgentCard).not.toHaveBeenCalled();
   });
 
@@ -185,10 +190,22 @@ describe('toA2a', () => {
       allowUnauthenticated: true,
     });
 
-    expect(resolveAgentCard).toHaveBeenCalledWith(card);
+    expect(resolveAgentCard).toHaveBeenCalledWith(card, undefined);
     expect(getA2AAgentCard).not.toHaveBeenCalled();
   });
 
+  it('forwards resolveAgentCardOptions to resolveAgentCard when provided', async () => {
+    await toA2a(agent, {
+      agentCard: 'path/to/card.json',
+      allowUnauthenticated: true,
+      resolveAgentCardOptions: {allowCrossOriginRpc: true},
+    });
+
+    expect(resolveAgentCard).toHaveBeenCalledWith('path/to/card.json', {
+      allowCrossOriginRpc: true,
+    });
+  });
+
   describe('authentication', () => {
     it('fails closed when no authentication is provided and access is not explicitly opened', async () => {
       await expect(toA2a(agent)).rejects.toThrow(/authenticat/i);
```

---

### Incident Patch 4: `d77bbb16` (2026-10-01)
**Commit Message**: fix(runner): seal aborted invocations in session history (#976)

* fix(runner): seal aborted invocations in session history

An aborted run left the function calls it had issued without a response,
so request building silently dropped them and the model never learned
the call was cancelled. The runner now answers each dangling call with a
synthetic error response, or records a single root-authored abort event
when nothing is pending. The events carry errorCode INVOCATION_ABORTED,
go through onEventCallback and are persisted; a caller that aborts and
stops reading still gets the invocation sealed on a best-effort basis.
Agent routing skips these events so an abort does not pin the next turn
to the cancelled agent or the root.

Port of google/adk-python@da65851a9e25005480db8164f8f0fff92ba31922.

* test(runner): type RecordingLlm.requests as Content[][]

The field stores request.contents, not an LlmRequest, so the wrong type
forced as-never and as-unknown-as casts.

**File**: `core/src/events/abort_events.ts` (added, +180/-0)
```diff
@@ -0,0 +1,180 @@
+/**
+ * @license
+ * Copyright 2026 Google LLC
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+/**
+ * Helpers for sealing an aborted invocation in session history.
+ *
+ * When an invocation is cancelled mid-flight, the function calls it issued
+ * without a matching response are answered with synthetic error responses
+ * built here, and a plain abort event is recorded when there is nothing to
+ * answer. Request building would drop such orphaned calls anyway; sealing them
+ * instead lets the model see that the call was aborted, and gives agent
+ * routing and compaction a consistent history.
+ *
+ * The sealing events are persisted and visible to callers: they carry
+ * `errorCode: 'INVOCATION_ABORTED'`, and every one is authored by an agent,
+ * either the agent that issued the sealed call or, when nothing is dangling,
+ * the root agent. Readers of session history (agent routing) use
+ * {@link isAbortEvent} to recognize them rather than their author.
+ *
+ * Mirrors adk-python's `google.adk.events._abort_events`.
+ */
+
+import {FunctionCall} from '@google/genai';
+
+import {
+  createEvent,
+  Event,
+  getFunctionCalls,
+  getFunctionResponses,
+  isFinalResponse,
+} from './event.js';
+
+export const INVOCATION_ABORTED = 'INVOCATION_ABORTED';
+export const ABORT_MESSAGE = 'Invocation was aborted by client.';
+
+/**
+ * Returns whether `event` was synthesized to seal an aborted invocation.
+ */
+export function isAbortEvent(event: Event): boolean {
+  return event.errorCode === INVOCATION_ABORTED;
+}
+
+/**
+ * Whether a task agent already paused on this event to wait for the user.
+ */
+function isPausedTaskReply(event: Event): boolean {
+  return (
+    Boolean(event.isolationScope) &&
+    event.author !== 'user' &&
+    isFinalResponse(event)
+  );
+}
+
+/** Parameters for {@link buildAbortEvents}. */
+export interface BuildAbortEventsParams {
+  /** The session history, in chronological order. */
+  events: Event[];
+  /** The aborted invocation; only its events are considered. */
+  invocationId: string;
+  /** Author of the abort event returned when nothing is dangling. */
+  rootAgentName: string;
+  /**
+   * Branch for calls whose event has no branch, and for the abort event
+   * returned when nothing is dangling.
+   */
+  branch?: string;
+}
+
+/**
+ * Returns the events that seal an aborted invocation.
+ *
+ * Each dangling function call gets a synthetic error response carrying the
+ * author, branch and isolation scope of the event that issued it, so the
+ * response pairs with its call in the issuing agent's own view. Calls sharing
+ * those three values are grouped into one event. If nothing is dangling, a
+ * single content-less abort event authored by the root agent is returned
+ * instead.
+ *
+ * Long-running calls (including confirmation and credential requests) are
+ * sealed too: the invocation that issued them is gone, so they are not left
+ * pending for a later turn.
+ *
+ * @returns The synthetic events, in the order they should be appended.
+ */
+export function buildAbortEvents({
+  events,
+  invocationId,
+  rootAgentName,
+  branch,
+}: BuildAbortEventsParams): Event[] {
+  const invocationEvents = events.filter(
+    (e) => e.invocationId === invocationId,
+  );
+  if (
+    invocationEvents.length > 0 &&
+    isPausedTaskReply(invocationEvents[invocationEvents.length - 1])
+  ) {
+    return [];
+  }
+
+  const answeredCallIds = new Set<string>();
+  for (const event of invocationEvents) {
+    for (const fr of getFunctionResponses(event)) {
+      if (fr.id) {
+        answeredCallIds.add(fr.id);
+      }
+    }
+  }
+
+  // Keyed by author, branch and isolation scope; a Map keeps insertion order.
+  const groupedCalls = new Map<
+    string,
+    {
+      author?: string;
+      branch?: string;
+      isolationScope?: string;
+      calls: FunctionCall[];
+    }
+  >();
+  for (const event of invocationEvents) {
+    for (const fc of getFunctionCalls(event)) {
+      if (!fc.id || answeredCallIds.has(fc.id)) {
+        continue;
+      }
+      const callBranch = event.branch || branch;
+      const key = JSON.stringify([
+        event.author ?? null,
+        callBranch ?? null,
+        event.isolationScope ?? null,
+      ]);
+      let group = groupedCalls.get(key);
+      if (!group) {
+        group = {
+          author: event.author,
+          branch: callBranch,
+          isolationScope: event.isolationScope,
+          calls: [],
+        };
+        groupedCalls.set(key, group);
+      }
+      group.calls.push(fc);
+    }
+  }
+
+  if (groupedCalls.size === 0) {
+    return [
+      createEvent({
+        invocationId,
+        author: rootAgentName,
+        branch,
+        errorCode: INVOCATION_ABORTED,
+        errorMessage: ABORT_MESSAGE,
+      }),
+    ];
+  }
+
+  return [...groupedCalls.values()].map((group) =>
+    createEvent({
+      invocationId,
+      author: group.author,
+      branch: group.branch,
+      isol
```

**File**: `core/src/runner/runner.ts` (modified, +106/-29)
```diff
@@ -35,6 +35,7 @@ import {
   BuiltInCodeExecutor,
   isBuiltInCodeExecutor,
 } from '../code_executors/built_in_code_executor.js';
+import {buildAbortEvents, isAbortEvent} from '../events/abort_events.js';
 import {createEvent, Event} from '../events/event.js';
 import {createEventActions} from '../events/event_actions.js';
 import {BaseMemoryService} from '../memory/base_memory_service.js';
@@ -468,39 +469,49 @@ export class Runner {
               yield earlyExitEvent;
             } else {
               // Step 2: Otherwise continue with normal execution
-              for await (const event of this.runRoot(invocationContext)) {
-                if (params.abortSignal?.aborted) {
-                  return;
-                }
-
-                // Step 3: Run the on_event callbacks before persisting so callback
-                // changes are stored in the session and match the streamed event.
-                const modifiedEvent =
-                  await this.pluginManager.runOnEventCallback({
+              let abortSealed = false;
+              const sealAbortedInvocation = () => {
+                abortSealed = true;
+                return this.synthesizeAbortEvents(invocationContext);
+              };
+              try {
+                for await (const event of this.runRoot(invocationContext)) {
+                  if (params.abortSignal?.aborted) {
+                    break;
+                  }
+
+                  // Step 3: Run the on_event callbacks before persisting so
+                  // callback changes are stored in the session and match the
+                  // streamed event.
+                  const outputEvent = await this.processAndAppendEvent(
                     invocationContext,
                     event,
-                  });
-                const outputEvent = modifiedEvent
-                  ? {
-                      ...modifiedEvent,
-                      id: event.id,
-                      invocationId: event.invocationId,
-                      timestamp: event.timestamp,
-                      author: modifiedEvent.author || event.author,
-                      branch: modifiedEvent.branch ?? event.branch,
-                    }
-                  : event;
-                if (!event.partial) {
-                  await this.sessionService.appendEvent({
-                    session,
-                    event: outputEvent,
-                  });
+                  );
+                  if (params.abortSignal?.aborted) {
+                    break;
+                  }
+
+                  yield outputEvent;
                 }
                 if (params.abortSignal?.aborted) {
+                  for (const abortEvent of await sealAbortedInvocation()) {
+                    yield abortEvent;
+                  }
                   return;
                 }
-
-                yield outputEvent;
+              } finally {
+                if (params.abortSignal?.aborted && !abortSealed) {
+                  // Best-effort: only reached on early close or error, where
+                  // throwing would mask the in-flight exception.
+                  try {
+                    await sealAbortedInvocation();
+                  } catch (e) {
+                    logger.error(
+                      `Failed to seal aborted invocation ${invocationContext.invocationId}.`,
+                      e,
+                    );
+                  }
+                }
               }
               // Step 4: Run the after_run callbacks to optionally modify the context.
               await this.pluginManager.runAfterRunCallback({invocationContext});
@@ -542,6 +553,64 @@ export class Runner {
     yield* runNodeAsInvocation(this.agent, invocationContext);
   }
 
+  /**
+   * Runs the on_event plugin callbacks on an event and appends the result to
+   * the session unless it is partial.
+   *
+   * @returns The event as streamed to the caller.
+   */
+  private async processAndAppendEvent(
+    invocationContext: InvocationContext,
+    event: Event,
+  ): Promise<Event> {
+    const modifiedEvent = await this.pluginManager.runOnEventCallback({
+      invocationContext,
+      event,
+    });
+    const outputEvent = modifiedEvent
+      ? {
+          ...modifiedEvent,
+          id: event.id,
+          invocationId: event.invocationId,
+          timestamp: event.timestamp,
+          author: modifiedEvent.author || event.author,
+          branch: modifiedEvent.branch ?? event.branch,
+        }
+      : event;
+    if (!event.partial) {
+      await this.sessionService.appendEvent({
+        session: invocationContext.session,
+        event: outputEvent,
+      });
+    }
+    return outputEvent;
+  }
+
+  /**
+   * Seals an aborted invocation in session history: answers its dangling
+   * function calls with error responses, or records a plain abort event when
+   * there is nothing to answer.
+   *
+   * @returns The synthetic events after plugin processing and per
```

**File**: `core/test/events/abort_events_test.ts` (added, +184/-0)
```diff
@@ -0,0 +1,184 @@
+/**
+ * @license
+ * Copyright 2026 Google LLC
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+import {
+  createEvent,
+  CreateEventParams,
+  Event,
+  getFunctionResponses,
+} from '@google/adk';
+import {describe, expect, it} from 'vitest';
+
+import {buildAbortEvents, isAbortEvent} from '../../src/events/abort_events.js';
+
+const INVOCATION_ID = 'inv_1';
+const ABORT_MESSAGE = 'Invocation was aborted by client.';
+
+function fcEvent(
+  author: string,
+  callIds: Array<string | undefined>,
+  params: CreateEventParams = {},
+): Event {
+  return createEvent({
+    invocationId: INVOCATION_ID,
+    author,
+    content: {
+      role: 'model',
+      parts: callIds.map((id) => ({
+        functionCall: {id, name: `tool_${id}`, args: {}},
+      })),
+    },
+    ...params,
+  });
+}
+
+function frEvent(callId: string): Event {
+  return createEvent({
+    invocationId: INVOCATION_ID,
+    author: 'agent',
+    content: {
+      role: 'user',
+      parts: [
+        {functionResponse: {id: callId, name: `tool_${callId}`, response: {}}},
+      ],
+    },
+  });
+}
+
+function build(events: Event[], branch?: string): Event[] {
+  return buildAbortEvents({
+    events,
+    invocationId: INVOCATION_ID,
+    rootAgentName: 'root_agent',
+    branch,
+  });
+}
+
+function responseIds(events: Event[]): Array<Array<string | undefined>> {
+  return events.map((e) => getFunctionResponses(e).map((fr) => fr.id));
+}
+
+describe('buildAbortEvents', () => {
+  it('seals a dangling call with an error response from its author', () => {
+    const [event, ...rest] = build([fcEvent('agent', ['call_1'])]);
+
+    expect(rest).toEqual([]);
+    expect(event.invocationId).toBe(INVOCATION_ID);
+    expect(event.author).toBe('agent');
+    expect(event.content?.role).toBe('user');
+    expect(event.errorCode).toBe('INVOCATION_ABORTED');
+    expect(event.errorMessage).toBe(ABORT_MESSAGE);
+    expect(getFunctionResponses(event)).toEqual([
+      {id: 'call_1', name: 'tool_call_1', response: {error: ABORT_MESSAGE}},
+    ]);
+  });
+
+  it('skips answered calls and calls without an id', () => {
+    const events = [
+      fcEvent('agent', ['call_1', 'call_2', undefined]),
+      frEvent('call_1'),
+    ];
+
+    expect(responseIds(build(events))).toEqual([['call_2']]);
+  });
+
+  it('seals long-running calls too', () => {
+    const events = [
+      fcEvent('agent', ['call_1'], {longRunningToolIds: ['call_1']}),
+    ];
+
+    expect(responseIds(build(events))).toEqual([['call_1']]);
+  });
+
+  it('only considers events of the aborted invocation', () => {
+    const events = [
+      fcEvent('agent', ['old_call'], {invocationId: 'inv_0'}),
+      fcEvent('agent', ['call_1']),
+    ];
+
+    expect(responseIds(build(events))).toEqual([['call_1']]);
+  });
+
+  it('groups calls by author, branch and isolation scope', () => {
+    const events = [
+      fcEvent('researcher', ['call_a'], {branch: 'root.researcher'}),
+      fcEvent('researcher', ['call_b'], {branch: 'root.researcher'}),
+      fcEvent('coder', ['call_c'], {branch: 'root.coder'}),
+      fcEvent('coder', ['call_d'], {
+        branch: 'root.coder',
+        isolationScope: 'task_1',
+      }),
+    ];
+
+    const result = build(events);
+
+    expect(result.map((e) => [e.author, e.branch, e.isolationScope])).toEqual([
+      ['researcher', 'root.researcher', undefined],
+      ['coder', 'root.coder', undefined],
+      ['coder', 'root.coder', 'task_1'],
+    ]);
+    expect(responseIds(result)).toEqual([
+      ['call_a', 'call_b'],
+      ['call_c'],
+      ['call_d'],
+    ]);
+  });
+
+  it('falls back to the invocation branch for a call event without one', () => {
+    const [event] = build([fcEvent('agent', ['call_1'])], 'root');
+
+    expect([event.author, event.branch]).toEqual(['agent', 'root']);
+  });
+
+  it('returns a single root-agent event when nothing is dangling', () => {
+    const events = [fcEvent('agent', ['call_1']), frEvent('call_1')];
+
+    const result = build(events, 'root');
+
+    expect(result).toHaveLength(1);
+    expect(result[0].author).toBe('root_agent');
+    expect(result[0].branch).toBe('root');
+    expect(result[0].content).toBeUndefined();
+    expect(result[0].errorCode).toBe('INVOCATION_ABORTED');
+    expect(result[0].errorMessage).toBe(ABORT_MESSAGE);
+  });
+
+  it('does not seal a task agent that already paused for the user', () => {
+    const events = [
+      fcEvent('coordinator', ['call_1']),
+      createEvent({
+        invocationId: INVOCATION_ID,
+        author: 'task_worker',
+        isolationScope: 'call_1',
+        content: {role: 'model', parts: [{text: 'Which city?'}]},
+      }),
+    ];
+
+    expect(build(events)).toEqual([]);
+  });
+});
+
+describe('isAbortEvent', () => {
+  it('recognizes both kinds of built events', () => {
+    const built = [...build([]), ...build([fcEvent('agent', ['call_1'])])];
+
+    expect(built).toHaveLength(2);
+    expect(built.every(isAbo
```

**File**: `core/test/runner/runner_abort_test.ts` (added, +394/-0)
```diff
@@ -0,0 +1,394 @@
+/**
+ * @license
+ * Copyright 2026 Google LLC
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+import {
+  BaseAgent,
+  BaseLlm,
+  BaseLlmConnection,
+  BaseNode,
+  BasePlugin,
+  createEvent,
+  Event,
+  FunctionTool,
+  getFunctionCalls,
+  getFunctionResponses,
+  InMemorySessionService,
+  InvocationContext,
+  LlmAgent,
+  LlmRequest,
+  LlmResponse,
+  Runner,
+  Session,
+  Workflow,
+} from '@google/adk';
+import {Content, Part} from '@google/genai';
+import {describe, expect, it, vi} from 'vitest';
+
+import {logger} from '../../src/utils/logger.js';
+import {NodeContext} from '../../src/workflow/node_context.js';
+
+const APP = 'test_app';
+const USER = 'test_user';
+const ABORT_MESSAGE = 'Invocation was aborted by client.';
+
+/** Resolves once `signal` aborts, or after a timeout as a safety net. */
+function waitForAbort(signal?: AbortSignal, timeoutMs = 5000): Promise<void> {
+  return new Promise((resolve) => {
+    if (signal?.aborted) return resolve();
+    const timer = setTimeout(resolve, timeoutMs);
+    signal?.addEventListener('abort', () => {
+      clearTimeout(timer);
+      resolve();
+    });
+  });
+}
+
+/** Yields `script`, then waits for the abort; later turns reply with text. */
+class AbortableAgent extends BaseAgent {
+  private runs = 0;
+
+  constructor(
+    name: string,
+    private readonly script: Part[][],
+  ) {
+    super({name});
+  }
+
+  protected override async *runAsyncImpl(
+    ctx: InvocationContext,
+  ): AsyncGenerator<Event, void, void> {
+    this.runs++;
+    if (this.runs > 1) {
+      yield createEvent({
+        invocationId: ctx.invocationId,
+        author: this.name,
+        content: {role: 'model', parts: [{text: 'Follow-up complete'}]},
+      });
+      return;
+    }
+    for (const parts of this.script) {
+      yield createEvent({
+        invocationId: ctx.invocationId,
+        author: this.name,
+        content: {role: 'model', parts},
+      });
+    }
+    await waitForAbort(ctx.abortSignal);
+  }
+
+  // eslint-disable-next-line require-yield
+  protected override async *runLiveImpl(): AsyncGenerator<Event, void, void> {
+    return;
+  }
+}
+
+/** Replays one response per call and records every request. */
+class RecordingLlm extends BaseLlm {
+  readonly requests: Content[][] = [];
+
+  constructor(private readonly replies: Array<string | Part>) {
+    super({model: 'recording-llm'});
+  }
+
+  async *generateContentAsync(
+    request: LlmRequest,
+  ): AsyncGenerator<LlmResponse, void, void> {
+    this.requests.push(structuredClone(request.contents));
+    const reply =
+      this.replies[Math.min(this.requests.length - 1, this.replies.length - 1)];
+    const part: Part = typeof reply === 'string' ? {text: reply} : reply;
+    yield {content: {role: 'model', parts: [part]}};
+  }
+
+  async connect(): Promise<BaseLlmConnection> {
+    throw new Error('not supported');
+  }
+}
+
+function slowTool(): FunctionTool {
+  return new FunctionTool({
+    name: 'slow_tool',
+    description: 'Blocks until the invocation is aborted.',
+    execute: async (_args, toolContext) => {
+      await waitForAbort(toolContext?.abortSignal);
+      return {};
+    },
+  });
+}
+
+function llmToolAgent(): {agent: LlmAgent; model: RecordingLlm} {
+  const model = new RecordingLlm([
+    {functionCall: {name: 'slow_tool', args: {}}},
+    'Recovered',
+  ]);
+  return {
+    agent: new LlmAgent({name: 'tool_agent', model, tools: [slowTool()]}),
+    model,
+  };
+}
+
+function legacyToolAgent(): BaseAgent {
+  return new AbortableAgent('tool_agent', [
+    [{functionCall: {id: 'call_1', name: 'slow_tool', args: {}}}],
+  ]);
+}
+
+function makeRunner(
+  agent: BaseAgent | Workflow,
+  options: {
+    plugins?: BasePlugin[];
+    sessionService?: InMemorySessionService;
+  } = {},
+): Runner {
+  return new Runner({
+    appName: APP,
+    agent,
+    plugins: options.plugins,
+    sessionService: options.sessionService ?? new InMemorySessionService(),
+  });
+}
+
+async function runTurn(
+  runner: Runner,
+  sessionId: string,
+  text: string,
+  options: {
+    abortWhen?: (event: Event) => boolean;
+    closeOnAbort?: boolean;
+  } = {},
+): Promise<{events: Event[]; session: Session}> {
+  const existing = await runner.sessionService.getSession({
+    appName: APP,
+    userId: USER,
+    sessionId,
+  });
+  if (!existing) {
+    await runner.sessionService.createSession({
+      appName: APP,
+      userId: USER,
+      sessionId,
+    });
+  }
+  const controller = new AbortController();
+  const events: Event[] = [];
+  for await (const event of runner.runAsync({
+    userId: USER,
+    sessionId,
+    newMessage: {role: 'user', parts: [{text}]},
+    abortSignal: controller.signal,
+  })) {
+    events.push(event);
+    if (options.abortWhen?.(event)) {
+      controller.abort();
+      if (options.closeOnAbort) break;
+    }
+  }
+  const session = (await runner.sessionService.getSession({
+    appName: APP,
+    
```

**File**: `core/test/runner/runner_test.ts` (modified, +63/-3)
```diff
@@ -23,6 +23,7 @@ import {
 } from '@google/adk';
 import {Content, FunctionCall, FunctionResponse} from '@google/genai';
 import {beforeEach, describe, expect, it, vi} from 'vitest';
+import {buildAbortEvents} from '../../src/events/abort_events.js';
 import {logger} from '../../src/utils/logger.js';
 
 const TEST_APP_ID = 'test_app_id';
@@ -104,7 +105,7 @@ class MockPlugin extends BasePlugin {
             text: MockPlugin.ON_EVENT_CALLBACK_MSG,
           },
         ],
-        role: event.content!.role,
+        role: event.content?.role,
       },
     });
   }
@@ -507,6 +508,61 @@ describe('Runner.determineAgentForResumption', () => {
     expect(result.name).toBe('sub_agent1');
   });
 
+  it('does not route to a non-transferable agent through a synthetic abort response', async () => {
+    const session = await sessionService.createSession({
+      appName: TEST_APP_ID,
+      userId: TEST_USER_ID,
+      sessionId: 'session_abort_response',
+    });
+    const callEvent = createEvent({
+      invocationId: 'inv1',
+      author: 'non_transferable',
+      content: {
+        role: 'model',
+        parts: [{functionCall: {id: 'func_456', name: 'test_func', args: {}}}],
+      },
+    });
+    const abortEvents = buildAbortEvents({
+      events: [callEvent],
+      invocationId: 'inv1',
+      rootAgentName: 'root_agent',
+    });
+    for (const event of [callEvent, ...abortEvents]) {
+      await sessionService.appendEvent({session, event});
+    }
+
+    const result = determineAgentForResumption(
+      session,
+      rootAgent,
+      createResumabilityConfig({isResumable: true}),
+    );
+    expect(result).toBe(rootAgent);
+  });
+
+  it('does not route back to the root through a root-authored abort event', async () => {
+    const session = await sessionService.createSession({
+      appName: TEST_APP_ID,
+      userId: TEST_USER_ID,
+      sessionId: 'session_abort_event',
+    });
+    const replyEvent = createEvent({
+      invocationId: 'inv1',
+      author: 'sub_agent1',
+      content: {role: 'model', parts: [{text: 'Sub response'}]},
+    });
+    const abortEvents = buildAbortEvents({
+      events: [replyEvent],
+      invocationId: 'inv1',
+      rootAgentName: 'root_agent',
+    });
+    expect(abortEvents[0].author).toBe('root_agent');
+    for (const event of [replyEvent, ...abortEvents]) {
+      await sessionService.appendEvent({session, event});
+    }
+
+    expect(determineAgentForResumption(session, rootAgent)).toBe(subAgent1);
+  });
+
   it('does not write an inline attachment payload to the debug log', async () => {
     const payload = 'QUJDREVGR0hJSktMTU5PUFFSU1RVVldYWVphYmNk';
     const debugSpy = vi.spyOn(logger, 'debug').mockImplementation(() => {});
@@ -1052,15 +1108,19 @@ describe('Runner with plugins', () => {
       events.push(event);
     }
 
-    expect(events.length).toBe(0);
+    // The agent event is persisted but not streamed; only the abort event that
+    // seals the invocation is.
+    expect(events.length).toBe(1);
+    expect(events[0].errorCode).toBe('INVOCATION_ABORTED');
 
     const session = await sessionService.getSession({
       appName: TEST_APP_ID,
       userId: TEST_USER_ID,
       sessionId: TEST_SESSION_ID,
     });
-    expect(session!.events.length).toBe(2);
+    expect(session!.events.length).toBe(3);
     expect(session!.events[1].author).toBe('test_agent');
+    expect(session!.events[2].errorCode).toBe('INVOCATION_ABORTED');
   });
 });
 
```

**File**: `core/test/runner/streaming_runner_test.ts` (modified, +12/-5)
```diff
@@ -269,7 +269,11 @@ describe('Runner Streaming and Ephemeral', () => {
         abortController.abort();
       }
 
-      expect(events.length).toBe(1);
+      // The first model event, then the event sealing the aborted invocation.
+      expect(events.length).toBe(2);
+      expect(events[1].errorCode).toBe('INVOCATION_ABORTED');
+      expect(events[1].author).toBe('abort_agent');
+      expect(events[1].content).toBeUndefined();
     });
 
     it('should respect abort signal during tool execution', async () => {
@@ -323,13 +327,16 @@ describe('Runner Streaming and Ephemeral', () => {
       // the signal off its context, and bailed instead of returning.
       expect(sleepyTool.sawAbort).toBe(true);
       expect(sleepyTool.finished).toBe(false);
-      // The runner stops at the functionCall; the tool's error response never
-      // reaches the caller.
+      // The runner stops at the functionCall; the tool's own error response
+      // never reaches the caller. The call is instead sealed with a synthetic
+      // abort response.
       expect(
         events.flatMap((e) =>
-          (e.content?.parts ?? []).filter((p) => p.functionResponse),
+          (e.content?.parts ?? [])
+            .filter((p) => p.functionResponse)
+            .map((p) => p.functionResponse!.response),
         ),
-      ).toHaveLength(0);
+      ).toEqual([{error: 'Invocation was aborted by client.'}]);
     });
   });
 
```

---

### Incident Patch 5: `937f2dac` (2026-10-01)
**Commit Message**: fix(dev): match adk-python's agent-graph cluster label, outline and edge color (#974)

* fix(dev): match adk-python's cluster label, outline and edge color

A workflow-agent cluster carried the graphviz `cluster_` id prefix in its
label, painted its interior white instead of its border, and drew every
internal edge in the highlight color. The dev UI therefore showed light-gray
text on a white slab, and could not tell an executed hop from an idle one.

adk-python sets label=name, color=white and color=light_gray on the same three
attributes (src/google/adk/cli/agent_graph.py, build_cluster and draw_edge).

* test(dev): retire the assertions that pinned the cluster_ label prefix

Four assertions encoded the old label. They pinned wrong behavior, so they
move here in their own commit. The assertions on the cluster id keep the
cluster_ prefix and are untouched.

* test(dev): cover the highlighted cluster branch and the reversed highlight pair

* refactor(dev): draw a cluster once, before the highlight loop

The highlighted and fall-through cluster branches built the same Subgraph
with the same four attributes, so the label and color fix had to be written
twice. A cluster ignores highli

**File**: `dev/src/server/agent_graph.ts` (modified, +39/-52)
```diff
@@ -123,41 +123,13 @@ export async function buildGraph(
     const caption = getNodeCaption(toolOrAgent);
     const asCluster = shouldBuildAgentCluster(toolOrAgent);
 
-    if (highlightsPairs) {
-      for (const highlightsPair of highlightsPairs) {
-        if (highlightsPair.includes(name)) {
-          if (asCluster) {
-            const cluster = new Subgraph(`cluster_${name}`, {
-              label: `cluster_${name}`,
-              style: 'rounded',
-              bgcolor: WHITE,
-              fontcolor: LIGHT_GRAY,
-            });
-            graph.addSubgraph(cluster);
-
-            await buildCluster(cluster, rootAgent);
-          } else {
-            graph.addNode(
-              new Node(name, {
-                label: caption,
-                style: 'filled,rounded',
-                fillcolor: DARK_GREEN,
-                color: DARK_GREEN,
-                shape,
-                fontcolor: LIGHT_GRAY,
-              }),
-            );
-          }
-          return;
-        }
-      }
-    }
-
+    // A cluster is drawn the same way whether or not it is highlighted; the
+    // highlight shows on the sub-agents and edges inside it.
     if (asCluster) {
       const cluster = new Subgraph(`cluster_${name}`, {
-        label: `cluster_${name}`,
+        label: name,
         style: 'rounded',
-        bgcolor: WHITE,
+        color: WHITE,
         fontcolor: LIGHT_GRAY,
       });
       graph.addSubgraph(cluster);
@@ -167,6 +139,23 @@ export async function buildGraph(
       return;
     }
 
+    for (const highlightsPair of highlightsPairs) {
+      if (highlightsPair.includes(name)) {
+        graph.addNode(
+          new Node(name, {
+            label: caption,
+            style: 'filled,rounded',
+            fillcolor: DARK_GREEN,
+            color: DARK_GREEN,
+            shape,
+            fontcolor: LIGHT_GRAY,
+          }),
+        );
+
+        return;
+      }
+    }
+
     graph.addNode(
       new Node(name, {
         label: caption,
@@ -180,33 +169,31 @@ export async function buildGraph(
   }
 
   function drawEdge(fromName: string, toName: string) {
-    if (highlightsPairs) {
-      for (const [highlightFrom, highlightTo] of highlightsPairs) {
-        if (fromName === highlightFrom && toName === highlightTo) {
-          graph.addEdge(
-            new Edge([graph.node(fromName), graph.node(toName)], {
-              color: LIGHT_GREEN,
-            }),
-          );
-          return;
-        }
+    for (const [highlightFrom, highlightTo] of highlightsPairs) {
+      if (fromName === highlightFrom && toName === highlightTo) {
+        graph.addEdge(
+          new Edge([graph.node(fromName), graph.node(toName)], {
+            color: LIGHT_GREEN,
+          }),
+        );
+        return;
+      }
 
-        if (fromName === highlightTo && toName === highlightFrom) {
-          graph.addEdge(
-            new Edge([graph.node(fromName), graph.node(toName)], {
-              color: LIGHT_GREEN,
-              dir: 'back',
-            }),
-          );
-          return;
-        }
+      if (fromName === highlightTo && toName === highlightFrom) {
+        graph.addEdge(
+          new Edge([graph.node(fromName), graph.node(toName)], {
+            color: LIGHT_GREEN,
+            dir: 'back',
+          }),
+        );
+        return;
       }
     }
 
     if (shouldBuildAgentCluster(rootAgent)) {
       graph.addEdge(
         new Edge([new Node(fromName), new Node(toName)], {
-          color: LIGHT_GREEN,
+          color: LIGHT_GRAY,
         }),
       );
 
```

**File**: `dev/test/server/agent_graph_test.ts` (modified, +97/-11)
```diff
@@ -15,6 +15,7 @@ import {
   LoopAgent,
   node,
   ParallelAgent,
+  RunnableRoot,
   SequentialAgent,
   Workflow,
 } from '@google/adk';
@@ -112,9 +113,7 @@ describe('AgentGraph', () => {
     expect(dotGraph).toContain(
       'subgraph "cluster_sequentialAgent (Sequential Agent)"',
     );
-    expect(dotGraph).toContain(
-      'label = "cluster_sequentialAgent (Sequential Agent)"',
-    );
+    expect(dotGraph).toContain('label = "sequentialAgent (Sequential Agent)"');
   });
 
   it('generates a DOT graph with highlighted nodes', async () => {
@@ -136,9 +135,7 @@ describe('AgentGraph', () => {
     expect(dotGraph).toContain('label = "🤖 agent2";');
     expect(dotGraph).toContain('"agent1" -> "agent2"');
     expect(dotGraph).toContain('cluster_sequentialAgent (Sequential Agent)"');
-    expect(dotGraph).toContain(
-      'label = "cluster_sequentialAgent (Sequential Agent)"',
-    );
+    expect(dotGraph).toContain('label = "sequentialAgent (Sequential Agent)"');
   });
 
   it('generates a DOT graph for a LoopAgent', async () => {
@@ -181,7 +178,7 @@ describe('AgentGraph', () => {
     expect(dotGraph).toContain('"agent1" -> "tool1"');
     expect(dotGraph).toContain('"agent2" -> "tool2"');
     expect(dotGraph).toContain('subgraph "cluster_loopAgent (Loop Agent)"');
-    expect(dotGraph).toContain('label = "cluster_loopAgent (Loop Agent)"');
+    expect(dotGraph).toContain('label = "loopAgent (Loop Agent)"');
   });
 
   it('generates a DOT graph for a ParallelAgent', async () => {
@@ -224,16 +221,94 @@ describe('AgentGraph', () => {
     expect(dotGraph).toContain(
       'subgraph "cluster_parallelAgent (Parallel Agent)"',
     );
-    expect(dotGraph).toContain(
-      'label = "cluster_parallelAgent (Parallel Agent)"',
-    );
+    expect(dotGraph).toContain('label = "parallelAgent (Parallel Agent)"');
+  });
+
+  it('labels a Sequential cluster with the agent name, not the graphviz cluster id', async () => {
+    const dot = await renderDot(sequentialPipeline());
+
+    expect(dot).toContain('subgraph "cluster_pipeline (Sequential Agent)"');
+    expect(dot).toContain('label = "pipeline (Sequential Agent)"');
+    expect(dot).not.toContain('label = "cluster_pipeline (Sequential Agent)"');
+  });
+
+  it('outlines a cluster instead of filling it', async () => {
+    const dot = await renderDot(sequentialPipeline());
+
+    const cluster = clusterBlock(dot, 'pipeline (Sequential Agent)');
+    expect(cluster).toContain('color = "#ffffff"');
+    expect(cluster).not.toContain('bgcolor');
+    expect(dot).toContain('bgcolor = "#333537"');
+  });
+
+  it('labels and outlines a highlighted Sequential cluster the same way', async () => {
+    const dot = await renderDot(sequentialPipeline(), [
+      ['pipeline (Sequential Agent)', 'caller'],
+    ]);
+
+    const cluster = clusterBlock(dot, 'pipeline (Sequential Agent)');
+    expect(cluster).toContain('label = "pipeline (Sequential Agent)"');
+    expect(cluster).toContain('color = "#ffffff"');
+    expect(cluster).not.toContain('bgcolor');
+  });
+
+  it('fills a highlighted node inside a cluster in dark green', async () => {
+    const dot = await renderDot(sequentialPipeline(), [['first', 'other']]);
+
+    expect(nodeBlock(dot, 'first')).toContain('fillcolor = "#0F5223"');
+    expect(nodeBlock(dot, 'second')).toContain('fillcolor = "#ffffff"');
+  });
+
+  it('draws an unhighlighted edge inside a Sequential cluster in gray', async () => {
+    const dot = await renderDot(sequentialPipeline());
+
+    const edge = edgeBlock(dot, 'first', 'second');
+    expect(edge).toContain('color = "#cccccc"');
+    expect(edge).not.toContain('#69CB87');
+  });
+
+  it('keeps a highlighted edge inside a Sequential cluster green', async () => {
+    const dot = await renderDot(sequentialPipeline(), [['first', 'second']]);
+
+    expect(edgeBlock(dot, 'first', 'second')).toContain('color = "#69CB87"');
+  });
+
+  it('keeps a reversed highlight pair inside a cluster green and back-facing', async () => {
+    const dot = await renderDot(sequentialPipeline(), [['second', 'first']]);
+
+    const edge = edgeBlock(dot, 'first', 'second');
+    expect(edge).toContain('color = "#69CB87"');
+    expect(edge).toContain('dir = "back"');
+  });
+
+  it('draws an unhighlighted edge inside a Loop cluster in gray', async () => {
+    const loop = new LoopAgent({
+      name: 'pipeline',
+      subAgents: [
+        new LlmAgent({name: 'first'}),
+        new LlmAgent({name: 'second'}),
+      ],
+    });
+
+    const dot = await renderDot(loop);
+
+    const wrapAround = edgeBlock(dot, 'second', 'first');
+    expect(wrapAround).toContain('color = "#cccccc"');
+    expect(wrapAround).not.toContain('#69CB87');
   });
 });
 
+function sequentialPipeline(): SequentialAgent {
+  return new SequentialAgent({
+    name: 'pipeline',
+    subAgents: [new LlmAgent({name: 'first'}), new LlmAgent({name: 'second'})],
+  });
+}
+
 const noopHandler = async () => 'ok';
 
 async func
```

---

### Incident Patch 6: `6c52d294` (2026-10-01)
**Commit Message**: fix(core): consolidate the two extension to MIME type tables (#972)

* Fix: consolidate the two extension -> MIME tables into one

core carried two hand-maintained extension -> MIME tables that disagreed, so
the same file got two different MIME types depending on the code path. The
worse half is getMimeTypeAndEncoding, which also picks the content encoding: a
skill resource or executor output file named helper.ts or deploy.sh was
base64-encoded as application/octet-stream.

MIME_TYPE_MAP now holds the union of both tables and guessMimeType delegates to
it. guessMimeType also derives the extension with path.extname instead of
split('.').pop(), which returned the whole name for a name with no dot.

* Test: pin the consolidated MIME table and the guessMimeType delegation

Adds rows for the eight merged-in extensions to the existing parametrized
tables, a guessMimeType block that covers the newly resolvable extensions and
guards the ones the merge must not lose, and a RunSkillScriptTool case proving
a .ts script resource now travels as UTF-8 text/javascript.

**File**: `core/src/utils/file_extension_utils.ts` (modified, +15/-0)
```diff
@@ -9,12 +9,26 @@ import {
   FileContentEncoding,
 } from '../code_executors/code_execution_utils.js';
 
+/**
+ * The one extension -> MIME type table for the package. Keys are dotted and
+ * lowercase, so they match `path.extname()` output directly.
+ */
 const MIME_TYPE_MAP: Record<
   string,
   {mimeType: string; encoding: FileContentEncoding}
 > = {
   '.js': {mimeType: 'text/javascript', encoding: FileContentEncoding.UTF8},
+  '.cjs': {mimeType: 'text/javascript', encoding: FileContentEncoding.UTF8},
+  '.mjs': {mimeType: 'text/javascript', encoding: FileContentEncoding.UTF8},
+  '.ts': {mimeType: 'text/javascript', encoding: FileContentEncoding.UTF8},
+  '.cts': {mimeType: 'text/javascript', encoding: FileContentEncoding.UTF8},
+  '.mts': {mimeType: 'text/javascript', encoding: FileContentEncoding.UTF8},
   '.py': {mimeType: 'text/x-python', encoding: FileContentEncoding.UTF8},
+  '.sh': {mimeType: 'text/x-shellscript', encoding: FileContentEncoding.UTF8},
+  '.bash': {
+    mimeType: 'text/x-shellscript',
+    encoding: FileContentEncoding.UTF8,
+  },
   '.md': {mimeType: 'text/markdown', encoding: FileContentEncoding.UTF8},
   '.txt': {mimeType: 'text/plain', encoding: FileContentEncoding.UTF8},
   '.html': {mimeType: 'text/html', encoding: FileContentEncoding.UTF8},
@@ -28,6 +42,7 @@ const MIME_TYPE_MAP: Record<
   '.png': {mimeType: 'image/png', encoding: FileContentEncoding.BASE64},
   '.jpg': {mimeType: 'image/jpeg', encoding: FileContentEncoding.BASE64},
   '.jpeg': {mimeType: 'image/jpeg', encoding: FileContentEncoding.BASE64},
+  '.gif': {mimeType: 'image/gif', encoding: FileContentEncoding.BASE64},
   '.pdf': {mimeType: 'application/pdf', encoding: FileContentEncoding.BASE64},
 };
 
```

**File**: `core/src/utils/file_utils.ts` (modified, +8/-23)
```diff
@@ -7,6 +7,7 @@
 import * as fs from 'node:fs/promises';
 import * as path from 'node:path';
 import {File} from '../code_executors/code_execution_utils.js';
+import {getMimeTypeAndEncoding} from './file_extension_utils.js';
 
 /**
  * Reports whether resolvedPath is resolvedBaseDir itself, or a path nested
@@ -107,28 +108,12 @@ export async function materializeFiles(
   return createdFiles;
 }
 
-export const EXTENSION_TO_MIME_TYPE: Record<string, string> = {
-  'pdf': 'application/pdf',
-  'jpg': 'image/jpeg',
-  'jpeg': 'image/jpeg',
-  'png': 'image/png',
-  'gif': 'image/gif',
-  'csv': 'text/csv',
-  'json': 'application/json',
-  'xml': 'application/xml',
-  'sh': 'text/x-shellscript',
-  'bash': 'text/x-shellscript',
-  'py': 'text/x-python',
-  'js': 'text/javascript',
-  'cjs': 'text/javascript',
-  'mjs': 'text/javascript',
-  'ts': 'text/javascript',
-  'cts': 'text/javascript',
-  'mts': 'text/javascript',
-};
-
+/**
+ * Guesses the MIME type of a file from its extension.
+ * @param filePath A file name or path.
+ * @returns The MIME type, or 'application/octet-stream' if the extension is
+ *     unknown or absent.
+ */
 export function guessMimeType(filePath: string): string {
-  const ext = filePath.split('.').pop()?.toLowerCase() || '';
-
-  return EXTENSION_TO_MIME_TYPE[ext] || 'application/octet-stream';
+  return getMimeTypeAndEncoding(path.extname(filePath)).mimeType;
 }
```

**File**: `core/test/tools/skills/run_skill_script_tool_test.ts` (modified, +34/-0)
```diff
@@ -228,6 +228,40 @@ describe('RunSkillScriptTool', () => {
     expect(binaryFile?.contentEncoding).toBe('base64');
   });
 
+  it('sends a TypeScript script resource as UTF-8 text', async () => {
+    const typescriptSkill: Skill = {
+      frontmatter: {
+        name: 'typescript-skill',
+        description: 'A skill with a TypeScript script',
+      },
+      instructions: 'Test instructions',
+      resources: {
+        scripts: {'helper.ts': {src: 'export const x = 1;'}},
+      },
+    };
+    const mockExecutor = new MockCodeExecutor();
+    const toolset = new SkillToolset([typescriptSkill], {
+      codeExecutor: mockExecutor,
+    });
+    const tool = new RunSkillScriptTool(toolset);
+
+    await tool.runAsync({
+      args: {
+        skill_name: 'typescript-skill',
+        script_path: 'scripts/helper.ts',
+      },
+      toolContext: createMockContext(),
+    });
+
+    const helper =
+      mockExecutor.executeCodeParams?.codeExecutionInput.inputFiles?.find(
+        (f) => f.name === 'scripts/helper.ts',
+      );
+    expect(helper?.contentEncoding).toBe(FileContentEncoding.UTF8);
+    expect(helper?.mimeType).toBe('text/javascript');
+    expect(helper?.content).toBe('export const x = 1;');
+  });
+
   it('calls materializeFiles with output files from executor', async () => {
     const mockExecutor = new MockCodeExecutor();
     const testFile: File = {
```

**File**: `core/test/utils/file_extension_utils_test.ts` (modified, +8/-0)
```diff
@@ -29,6 +29,13 @@ describe('getMimeTypeAndEncoding', () => {
       ['.xml', 'application/xml'],
       ['.yaml', 'text/yaml'],
       ['.yml', 'text/yaml'],
+      ['.cjs', 'text/javascript'],
+      ['.mjs', 'text/javascript'],
+      ['.ts', 'text/javascript'],
+      ['.cts', 'text/javascript'],
+      ['.mts', 'text/javascript'],
+      ['.sh', 'text/x-shellscript'],
+      ['.bash', 'text/x-shellscript'],
     ])('returns correct MIME type for %s', (ext, expectedMime) => {
       const result = getMimeTypeAndEncoding(ext);
       expect(result.mimeType).toBe(expectedMime);
@@ -42,6 +49,7 @@ describe('getMimeTypeAndEncoding', () => {
       ['.jpg', 'image/jpeg'],
       ['.jpeg', 'image/jpeg'],
       ['.pdf', 'application/pdf'],
+      ['.gif', 'image/gif'],
     ])('returns correct MIME type for %s', (ext, expectedMime) => {
       const result = getMimeTypeAndEncoding(ext);
       expect(result.mimeType).toBe(expectedMime);
```

**File**: `core/test/utils/file_utils_test.ts` (modified, +107/-1)
```diff
@@ -9,7 +9,8 @@ import * as fs from 'node:fs/promises';
 import * as os from 'node:os';
 import * as path from 'node:path';
 import {afterEach, beforeEach, describe, expect, it} from 'vitest';
-import {materializeFiles} from '../../src/utils/file_utils.js';
+import {getMimeTypeAndEncoding} from '../../src/utils/file_extension_utils.js';
+import {guessMimeType, materializeFiles} from '../../src/utils/file_utils.js';
 
 describe('file_utils', () => {
   let tempDir: string;
@@ -214,3 +215,108 @@ describe('file_utils', () => {
     });
   });
 });
+
+/** Every extension the consolidated MIME table knows. */
+const ALL_MIME_TABLE_EXTENSIONS = [
+  '.js',
+  '.cjs',
+  '.mjs',
+  '.ts',
+  '.cts',
+  '.mts',
+  '.py',
+  '.sh',
+  '.bash',
+  '.md',
+  '.txt',
+  '.html',
+  '.css',
+  '.json',
+  '.csv',
+  '.svg',
+  '.xml',
+  '.yaml',
+  '.yml',
+  '.png',
+  '.jpg',
+  '.jpeg',
+  '.gif',
+  '.pdf',
+];
+
+describe('guessMimeType', () => {
+  describe('extensions gained from the consolidated table', () => {
+    it.each([
+      ['README.md', 'text/markdown'],
+      ['notes.txt', 'text/plain'],
+      ['page.html', 'text/html'],
+      ['style.css', 'text/css'],
+      ['icon.svg', 'image/svg+xml'],
+      ['config.yaml', 'text/yaml'],
+      ['config.yml', 'text/yaml'],
+    ])('resolves %s', (filePath, expectedMime) => {
+      expect(guessMimeType(filePath)).toBe(expectedMime);
+    });
+  });
+
+  describe('extensions the consolidation must not lose', () => {
+    it.each([
+      ['doc.pdf', 'application/pdf'],
+      ['photo.jpg', 'image/jpeg'],
+      ['photo.jpeg', 'image/jpeg'],
+      ['photo.png', 'image/png'],
+      ['anim.gif', 'image/gif'],
+      ['data.csv', 'text/csv'],
+      ['data.json', 'application/json'],
+      ['data.xml', 'application/xml'],
+      ['deploy.sh', 'text/x-shellscript'],
+      ['deploy.bash', 'text/x-shellscript'],
+      ['main.py', 'text/x-python'],
+      ['main.js', 'text/javascript'],
+      ['main.cjs', 'text/javascript'],
+      ['main.mjs', 'text/javascript'],
+      ['main.ts', 'text/javascript'],
+      ['main.cts', 'text/javascript'],
+      ['main.mts', 'text/javascript'],
+    ])('still resolves %s', (filePath, expectedMime) => {
+      expect(guessMimeType(filePath)).toBe(expectedMime);
+    });
+  });
+
+  describe('path and case handling', () => {
+    it('reads the extension of a nested path', () => {
+      expect(guessMimeType('a/b/c/helper.py')).toBe('text/x-python');
+    });
+
+    it('ignores extension case', () => {
+      expect(guessMimeType('IMG.PNG')).toBe('image/png');
+    });
+
+    it('uses only the last extension of a double extension', () => {
+      expect(guessMimeType('archive.tar.gz')).toBe('application/octet-stream');
+    });
+  });
+
+  describe('names without an extension', () => {
+    it('falls back for a bare name', () => {
+      expect(guessMimeType('output_file')).toBe('application/octet-stream');
+    });
+
+    it('falls back for a dotfile', () => {
+      expect(guessMimeType('.gitignore')).toBe('application/octet-stream');
+    });
+
+    it('falls back for a bare name that spells an extension', () => {
+      // 'png' is the whole file name here, so the file has no extension.
+      expect(guessMimeType('png')).toBe('application/octet-stream');
+    });
+  });
+
+  it('agrees with getMimeTypeAndEncoding on every known extension', () => {
+    for (const ext of ALL_MIME_TABLE_EXTENSIONS) {
+      expect(guessMimeType(`file${ext}`)).toBe(
+        getMimeTypeAndEncoding(ext).mimeType,
+      );
+    }
+  });
+});
```

---

### Incident Patch 7: `31dc0679` (2026-10-01)
**Commit Message**: fix(core): give VertexAiSessionService a null-prototype Session.state (#971)

* fix(sessions): give VertexAiSessionService null-prototype state

Session state is read with the `in` operator, so a state map that
inherits from Object.prototype resolves `{toString}` against the
prototype chain and injects the native function into the prompt instead
of raising "Context variable not found". State on an Agent Engine API
response is plain JSON.parse output, so the three session sites and the
event state delta re-home it onto a null-prototype map, matching what
trimTempState already gives the other session services.

* test(sessions): pin the null-prototype contract on Vertex AI sessions

Covers the three session read paths, the event state delta, and the
missing-state fallbacks. The `in` assertions pin the exact predicate
instruction placeholder resolution uses.

**File**: `core/src/sessions/vertex_ai_session_service.ts` (modified, +27/-4)
```diff
@@ -83,6 +83,27 @@ export function quoteFilterLiteral(value: string): string {
   return `"${escaped}"`;
 }
 
+/**
+ * Copies an API-returned state map into a null-prototype map.
+ *
+ * Session state is read with the `in` operator — `State.get`/`State.has`, and
+ * instruction placeholder resolution in `agents/instructions.ts` — so on a map
+ * that inherits from `Object.prototype`, `{toString}` resolves to the inherited
+ * member and lands in the prompt instead of raising "Context variable not
+ * found". The other session services get this from `trimTempState`; state on an
+ * API response is plain `JSON.parse` output and has to be re-homed here.
+ *
+ * Copying onto a null-prototype target also keeps an own `__proto__` key as an
+ * own data property instead of invoking the inherited `__proto__` setter.
+ *
+ * Shallow, like `trimTempState`: only the top level is read with `in`.
+ */
+function toStateMap(
+  state: Record<string, unknown> | undefined,
+): Record<string, unknown> {
+  return Object.assign(Object.create(null), state);
+}
+
 export interface VertexAiSessionServiceOptions {
   projectId?: string;
   location?: string;
@@ -224,7 +245,7 @@ export class VertexAiSessionService extends BaseSessionService {
       id,
       appName,
       userId,
-      state: getSessionResponse.sessionState,
+      state: toStateMap(getSessionResponse.sessionState),
       events: [],
       lastUpdateTime: getSessionResponse.updateTime
         ? Date.parse(getSessionResponse.updateTime)
@@ -282,7 +303,7 @@ export class VertexAiSessionService extends BaseSessionService {
         id: sessionId,
         appName,
         userId,
-        state: sessionObj.sessionState,
+        state: toStateMap(sessionObj.sessionState),
         events: [],
         lastUpdateTime: sessionObj.updateTime
           ? Date.parse(sessionObj.updateTime)
@@ -347,7 +368,7 @@ export class VertexAiSessionService extends BaseSessionService {
             id,
             appName,
             userId: sessionObj.userId,
-            state: sessionObj.sessionState,
+            state: toStateMap(sessionObj.sessionState),
             events: [],
             lastUpdateTime: sessionObj.updateTime
               ? new Date(sessionObj.updateTime).getTime()
@@ -697,7 +718,9 @@ function _fromApiEvent(apiEventObj: VertexAiSessionEvent): Event {
   }
 
   const eventActions: ExtendedEventActions = {
-    stateDelta: (actions['stateDelta'] as {[key: string]: unknown}) || {},
+    stateDelta: toStateMap(
+      actions['stateDelta'] as Record<string, unknown> | undefined,
+    ),
     artifactDelta: (actions['artifactDelta'] as {[key: string]: number}) || {},
     requestedAuthConfigs:
       (actions.requestedAuthConfigs as Record<string, AuthConfig>) || {},
```

**File**: `core/test/sessions/vertex_ai_session_service_test.ts` (modified, +168/-0)
```diff
@@ -1725,4 +1725,172 @@ describe('VertexAiSessionService', () => {
       );
     });
   });
+
+  describe('null-prototype state', () => {
+    // Reverting the fix lets a `__proto__` state key land on `Object.prototype`
+    // and leak into the ~1500 lines of tests that run afterwards. Clearing the
+    // keys around every test makes a revert fail here instead.
+    const POLLUTED_KEYS = ['isAdmin'];
+
+    const clearPollution = () => {
+      for (const key of POLLUTED_KEYS) {
+        delete (Object.prototype as Record<string, unknown>)[key];
+      }
+    };
+
+    beforeEach(clearPollution);
+    afterEach(clearPollution);
+
+    // A `'__proto__': value` pair in an object literal invokes the prototype
+    // setter instead of creating an own key, so it cannot express what the API
+    // actually returns. `JSON.parse` is what the transport does to the response
+    // body, and it does produce an own `__proto__` key.
+    const parseBody = (json: string): Record<string, unknown> =>
+      JSON.parse(json) as Record<string, unknown>;
+
+    const getTestSession = () =>
+      service.getSession({
+        appName: '12345',
+        userId: 'testUser',
+        sessionId: 'my-session-id',
+      });
+
+    it('createSession returns state with a null prototype', async () => {
+      mockClient.getSessionOperationInternal.mockResolvedValue({
+        done: true,
+        response: {
+          name: 'projects/p/locations/l/sessions/test-id',
+          sessionState: parseBody('{"persona":"pirate"}'),
+        },
+      });
+
+      const session = await service.createSession({
+        appName: '12345',
+        userId: 'testUser',
+      });
+
+      expect(Object.getPrototypeOf(session.state)).toBeNull();
+      expect(session.state['persona']).toBe('pirate');
+    });
+
+    it('createSession returns a null-prototype state when the API returns none', async () => {
+      mockClient.getSessionOperationInternal.mockResolvedValue({
+        done: true,
+        response: {name: 'projects/p/locations/l/sessions/test-id'},
+      });
+
+      const session = await service.createSession({
+        appName: '12345',
+        userId: 'testUser',
+      });
+
+      // Pins the `state: params.state || {}` fallback in `createSession`, which
+      // would otherwise hand back a prototype-rooted map.
+      expect(Object.getPrototypeOf(session.state)).toBeNull();
+      expect(Object.keys(session.state)).toEqual([]);
+    });
+
+    it('getSession returns state with a null prototype', async () => {
+      mockClient.get.mockResolvedValue({
+        name: 'reasoningEngines/12345/sessions/my-session-id',
+        userId: 'testUser',
+        sessionState: parseBody('{"persona":"pirate"}'),
+      });
+
+      const session = await getTestSession();
+
+      expect(Object.getPrototypeOf(session!.state)).toBeNull();
+      expect(session!.state['persona']).toBe('pirate');
+    });
+
+    it('getSession state does not resolve inherited members', async () => {
+      mockClient.get.mockResolvedValue({
+        name: 'reasoningEngines/12345/sessions/my-session-id',
+        userId: 'testUser',
+        sessionState: parseBody('{"persona":"pirate"}'),
+      });
+
+      const session = await getTestSession();
+
+      // `in` is the exact predicate instruction resolution uses to decide
+      // whether to inject a `{placeholder}`, so an inherited hit renders
+      // `function toString() { [native code] }` into the prompt.
+      expect('toString' in session!.state).toBe(false);
+      expect('constructor' in session!.state).toBe(false);
+      expect('persona' in session!.state).toBe(true);
+    });
+
+    it('getSession keeps a __proto__ state key as an own property', async () => {
+      mockClient.get.mockResolvedValue({
+        name: 'reasoningEngines/12345/sessions/my-session-id',
+        userId: 'testUser',
+        sessionState: parseBody('{"__proto__": {"isAdmin": true}}'),
+      });
+
+      const session = await getTestSession();
+
+      expect(Object.getPrototypeOf(session!.state)).toBeNull();
+      expect(session!.state['__proto__']).toEqual({isAdmin: true});
+      expect(({} as Record<string, unknown>)['isAdmin']).toBeUndefined();
+    });
+
+    it('listSessions returns state with a null prototype for every session', async () => {
+      mockClient.listInternal.mockResolvedValue({
+        sessions: [
+          {
+            name: 'projects/p/locations/l/sessions/s1',
+            userId: 'testUser',
+            sessionState: parseBody('{"a":1}'),
+          },
+          {name: 'projects/p/locations/l/sessions/s2', userId: 'testUser'},
+        ],
+      });
+
+      const response = await service.listSessions({
+        appName: '12345',
+        userId: 'testUser',
+      });
+
+      expect(Object.getPrototypeOf(response.sessions[0].state)).toBeNull();
+      expect(response.sessions[0].state['a']).toBe(1);
+      expect(Object.getPrototypeOf(response.sessions[1].state)).toBeNull();
+  
```

---

### Incident Patch 8: `98cb5428` (2026-10-01)
**Commit Message**: fix(core): require HTTPS for implicit Google API auth (#952)

**File**: `core/src/integrations/agent_registry/helpers.ts` (modified, +3/-2)
```diff
@@ -8,8 +8,9 @@ export function isGoogleApi(url: string): boolean {
   try {
     const parsed = new URL(url);
     return (
-      parsed.hostname === 'googleapis.com' ||
-      parsed.hostname.endsWith('.googleapis.com')
+      parsed.protocol === 'https:' &&
+      (parsed.hostname === 'googleapis.com' ||
+        parsed.hostname.endsWith('.googleapis.com'))
     );
   } catch {
     return false;
```

**File**: `core/test/integrations/agent_registry_test.ts` (modified, +52/-2)
```diff
@@ -67,6 +67,10 @@ vi.mock('@modelcontextprotocol/sdk/client/index.js', () => {
   };
 });
 
+vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
+  StreamableHTTPClientTransport: vi.fn().mockImplementation(() => ({})),
+}));
+
 describe('AgentRegistry Helpers', () => {
   describe('isGoogleApi', () => {
     it('should return true for Google APIs', () => {
@@ -78,6 +82,11 @@ describe('AgentRegistry Helpers', () => {
       expect(isGoogleApi('https://example.com')).toBe(false);
       expect(isGoogleApi('invalid-url')).toBe(false);
     });
+
+    it('should return false for Google API hosts over unencrypted HTTP', () => {
+      expect(isGoogleApi('http://googleapis.com')).toBe(false);
+      expect(isGoogleApi('http://bigquery-mcp.googleapis.com/v1')).toBe(false);
+    });
   });
 
   describe('cleanName', () => {
@@ -820,14 +829,13 @@ describe('AgentRegistry', () => {
       expect(tools.length).toBe(2);
     });
 
-    it('should support getMcpToolset with empty options and verify auth headers added for Google API', async () => {
+    it('should add ADC auth headers to Google API endpoints over HTTPS', async () => {
       const customHeaderRegistry = new AgentRegistry({
         projectId: 'test-project',
         location: 'global',
       });
 
       const serverDetails = {
-        mcpServerId: 'urn:mcp:1234:bigquery',
         interfaces: [
           {
             url: 'https://bigquery-mcp.googleapis.com/v1',
@@ -845,6 +853,48 @@ describe('AgentRegistry', () => {
       );
       const tools = await toolset.getTools({} as ReadonlyContext);
       expect(tools.length).toBe(2);
+
+      const Transport = (
+        await import('@modelcontextprotocol/sdk/client/streamableHttp.js')
+      ).StreamableHTTPClientTransport as unknown as ReturnType<typeof vi.fn>;
+      const [url, options] = Transport.mock.calls.at(-1) ?? [];
+      expect(url.href).toBe('https://bigquery-mcp.googleapis.com/v1');
+      expect(options.requestInit.headers).toMatchObject({
+        'Authorization': 'Bearer fake-token',
+        'x-goog-user-project': 'quota-project-123',
+      });
+    });
+
+    it('should not add ADC auth headers to Google API endpoints over HTTP', async () => {
+      const customHeaderRegistry = new AgentRegistry({
+        projectId: 'test-project',
+        location: 'global',
+      });
+
+      vi.spyOn(customHeaderRegistry, 'getMcpServer').mockResolvedValue({
+        interfaces: [
+          {
+            url: 'http://bigquery-mcp.googleapis.com/v1',
+            protocolBinding: 'JSONRPC',
+          },
+        ],
+      });
+
+      const toolset = await customHeaderRegistry.getMcpToolset(
+        'mcpServers/bq',
+        {},
+      );
+      await toolset.getTools({} as ReadonlyContext);
+
+      const Transport = (
+        await import('@modelcontextprotocol/sdk/client/streamableHttp.js')
+      ).StreamableHTTPClientTransport as unknown as ReturnType<typeof vi.fn>;
+      const [url, options] = Transport.mock.calls.at(-1) ?? [];
+      expect(url.href).toBe('http://bigquery-mcp.googleapis.com/v1');
+      expect(options.requestInit.headers).not.toHaveProperty('Authorization');
+      expect(options.requestInit.headers).not.toHaveProperty(
+        'x-goog-user-project',
+      );
     });
 
     it('should filter tools if toolFilter option is provided', async () => {
```

---

### Incident Patch 9: `64829176` (2026-10-01)
**Commit Message**: feat(plugins): add DebugLoggingPlugin with full Python parity (#920)

* feat(plugins): add DebugLoggingPlugin with full Python parity

* fix(plugins): address review comments on DebugLoggingPlugin

* refactor(plugins): reuse object_notation_utils and @google/adk import in DebugLoggingPlugin

**File**: `core/src/common.ts` (modified, +5/-0)
```diff
@@ -258,6 +258,11 @@ export {
   type ToolFailureResponse,
 } from './plugins/_reflect_retry_utils.js';
 export {BasePlugin, ContextCompactionTrigger} from './plugins/base_plugin.js';
+export type {
+  DebugEntry,
+  DebugLoggingPluginOptions,
+  InvocationDebugState,
+} from './plugins/debug_logging_plugin.js';
 export {GlobalInstructionPlugin} from './plugins/global_instruction_plugin.js';
 export {LoggingPlugin} from './plugins/logging_plugin.js';
 export {PluginManager} from './plugins/plugin_manager.js';
```

**File**: `core/src/index.ts` (modified, +4/-0)
```diff
@@ -42,6 +42,10 @@ export {VertexAiMemoryBankService} from './memory/vertex_ai_memory_bank_service.
 export type {VertexAiMemoryBankServiceOptions} from './memory/vertex_ai_memory_bank_service.js';
 export {VertexAiRagMemoryService} from './memory/vertex_ai_rag_memory_service.js';
 export type {VertexAiRagMemoryServiceOptions} from './memory/vertex_ai_rag_memory_service.js';
+export {
+  DebugLoggingPlugin,
+  isDebugLoggingPlugin,
+} from './plugins/debug_logging_plugin.js';
 export {DatabaseSessionService} from './sessions/database_session_service.js';
 export {getSessionServiceFromUri} from './sessions/registry.js';
 export {VertexAiSessionService} from './sessions/vertex_ai_session_service.js';
```

**File**: `core/src/plugins/debug_logging_plugin.ts` (added, +860/-0)
```diff
@@ -0,0 +1,860 @@
+/**
+ * @license
+ * Copyright 2026 Google LLC
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+import {Content} from '@google/genai';
+import * as yaml from 'js-yaml';
+import * as fs from 'node:fs';
+
+import {BaseAgent} from '../agents/base_agent.js';
+import {Context} from '../agents/context.js';
+import {InvocationContext} from '../agents/invocation_context.js';
+import {AuthCredentialTypes} from '../auth/auth_credential.js';
+import {Event, isFinalResponse} from '../events/event.js';
+import {LlmRequest} from '../models/llm_request.js';
+import {LlmResponse} from '../models/llm_response.js';
+import {State} from '../sessions/state.js';
+import {BaseTool} from '../tools/base_tool.js';
+import {logger} from '../utils/logger.js';
+import {toSnakeCaseKey} from '../utils/object_notation_utils.js';
+
+import {BasePlugin} from './base_plugin.js';
+
+const DEBUG_LOGGING_PLUGIN_SYMBOL = Symbol.for('google.adk.debugLoggingPlugin');
+
+const REDACTED = '[REDACTED]';
+
+const AUTH_CREDENTIAL_TYPES = new Set<string>([
+  AuthCredentialTypes.API_KEY,
+  AuthCredentialTypes.HTTP,
+  AuthCredentialTypes.OAUTH2,
+  AuthCredentialTypes.OPEN_ID_CONNECT,
+  AuthCredentialTypes.SERVICE_ACCOUNT,
+]);
+
+/**
+ * Mapping keys whose value is a secret, for credentials that reach the plugin
+ * as plain objects rather than as credential models.
+ */
+const SENSITIVE_KEYS = new Set([
+  'access_token',
+  'api_key',
+  'auth_code',
+  'auth_response_uri',
+  'authorization',
+  'client_secret',
+  'code_verifier',
+  'google_access_id',
+  'id_token',
+  'password',
+  'private_key',
+  'private_key_id',
+  'proxy_authorization',
+  'refresh_token',
+  'secret',
+  'sig',
+  'signature',
+  'token',
+  'x_amz_credential',
+  'x_amz_signature',
+  'x_api_key',
+  'x_goog_credential',
+  'x_goog_security_token',
+  'x_goog_signature',
+]);
+
+/**
+ * Substrings that name a secret wherever they sit in a key.
+ */
+const SENSITIVE_SUBSTRINGS = [
+  'api_key',
+  'credentials',
+  'passwd',
+  'password',
+  'private_key',
+  'secret',
+] as const;
+
+/**
+ * A key ending in one of these names a secret (e.g., `bearer_token`,
+ * `session_token`), while preserving usage counters like `prompt_token_count`.
+ */
+const SENSITIVE_SUFFIXES = ['_token'] as const;
+
+/**
+ * Session state keys are namespaced by scope. The scope is stripped before
+ * matching so that `user:api_key` and `app:client_secret` are redacted.
+ */
+const STATE_PREFIXES = [State.APP_PREFIX, State.USER_PREFIX] as const;
+
+/**
+ * Matches armored private key blocks inside any string.
+ */
+const PRIVATE_KEY_BLOCK =
+  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----|$)/g;
+
+/**
+ * File mode restricting access to owner read/write only.
+ */
+const OUTPUT_FILE_MODE = 0o600;
+
+/**
+ * Bounds recursive object walking to avoid infinite loops on cyclic structures.
+ */
+const MAX_WALK_DEPTH = 20;
+
+/**
+ * Whether a mapping key names a credential-bearing value.
+ */
+function isSensitiveKey(key: unknown): boolean {
+  if (typeof key !== 'string') {
+    return false;
+  }
+  let normalized = toSnakeCaseKey(key);
+
+  if (normalized.startsWith(State.TEMP_PREFIX)) {
+    return true;
+  }
+  for (const prefix of STATE_PREFIXES) {
+    if (normalized.startsWith(prefix)) {
+      normalized = normalized.slice(prefix.length);
+      break;
+    }
+  }
+  if (
+    SENSITIVE_KEYS.has(normalized) ||
+    SENSITIVE_SUFFIXES.some((suffix) => normalized.endsWith(suffix))
+  ) {
+    return true;
+  }
+  return SENSITIVE_SUBSTRINGS.some((marker) => normalized.includes(marker));
+}
+
+/**
+ * Blanks any armored private key block, leaving the rest of the string.
+ */
+function redactPrivateKeys(value: string): string {
+  return String(value).replace(PRIVATE_KEY_BLOCK, REDACTED);
+}
+
+/**
+ * Whether `obj` is a structural ADK credential object.
+ */
+function isCredentialObject(obj: unknown): boolean {
+  if (typeof obj !== 'object' || obj === null) {
+    return false;
+  }
+  const record = obj as Record<string, unknown>;
+  const authType = record['authType'] ?? record['auth_type'];
+  return typeof authType === 'string' && AUTH_CREDENTIAL_TYPES.has(authType);
+}
+
+/**
+ * Options for configuring {@link DebugLoggingPlugin}.
+ */
+export interface DebugLoggingPluginOptions {
+  /**
+   * The name of the plugin instance.
+   * @defaultValue 'debug_logging_plugin'
+   */
+  name?: string;
+
+  /**
+   * Path to the output YAML debug file.
+   * @defaultValue 'adk_debug.yaml'
+   */
+  outputPath?: string;
+
+  /**
+   * Whether to include a session state snapshot at the end of each invocation.
+   * @defaultValue true
+   */
+  includeSessionState?: boolean;
+
+  /**
+   * Whether to include full system instructions in LLM request logs.
+   * @defaultValue true
+   */
+  includeSystemInstruction?: boolean;
+}
+
+/**
+ * A single debug log entry recorded during an invocation.
+ */
+export interface DebugE
```

**File**: `core/src/utils/object_notation_utils.ts` (modified, +10/-2)
```diff
@@ -37,8 +37,16 @@ const toCamelCaseKey = (key: string) =>
     letter.toUpperCase(),
   );
 
-const toSnakeCaseKey = (key: string) =>
-  key.replace(/[A-Z]/g, (g) => '_' + g.toLowerCase());
+const CAMEL_BOUNDARY = /(?<=[a-z0-9])(?=[A-Z])|(?<=[A-Z])(?=[A-Z][a-z])/g;
+
+/**
+ * Converts a camelCase, PascalCase, or hyphenated key to snake_case.
+ *
+ * @param key The key to convert.
+ * @returns The snake_case key.
+ */
+export const toSnakeCaseKey = (key: string): string =>
+  key.replace(CAMEL_BOUNDARY, '_').toLowerCase().replace(/-/g, '_');
 
 function toNotation(
   obj: unknown,
```

**File**: `core/test/plugins/debug_logging_plugin_test.ts` (added, +839/-0)
```diff
@@ -0,0 +1,839 @@
+/**
+ * @license
+ * Copyright 2026 Google LLC
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+import {
+  AuthCredential,
+  AuthCredentialTypes,
+  BaseAgent,
+  BaseTool,
+  Context,
+  createEvent,
+  createEventActions,
+  DebugLoggingPlugin,
+  getLogger,
+  InvocationContext,
+  isDebugLoggingPlugin,
+  LlmRequest,
+  LlmResponse,
+  PluginManager,
+  Session,
+  State,
+} from '@google/adk';
+import {Content} from '@google/genai';
+import * as yaml from 'js-yaml';
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
+
+const SENTINEL_ACCESS_TOKEN = 'sentinel-access-token-4f7a21';
+const SENTINEL_REFRESH_TOKEN = 'sentinel-refresh-token-91cc03';
+const SENTINEL_CLIENT_SECRET = 'sentinel-client-secret-b58d6e';
+const SENTINEL_AUTH_CODE = 'sentinel-auth-code-2ad914';
+const SENTINEL_CODE_VERIFIER = 'sentinel-code-verifier-7be055';
+const SENTINEL_PRIVATE_KEY =
+  '-----BEGIN PRIVATE KEY-----\nsentinel-key-body\n-----END PRIVATE KEY-----';
+
+function createOAuthCredential(): AuthCredential {
+  return {
+    authType: AuthCredentialTypes.OAUTH2,
+    oauth2: {
+      clientId: 'test-client-id',
+      clientSecret: SENTINEL_CLIENT_SECRET,
+      accessToken: SENTINEL_ACCESS_TOKEN,
+      refreshToken: SENTINEL_REFRESH_TOKEN,
+    },
+  };
+}
+
+describe('DebugLoggingPlugin', () => {
+  let tempDir: string;
+  let debugOutputFile: string;
+  let mockSession: Session;
+  let mockInvocationContext: InvocationContext;
+  let mockCallbackContext: Context;
+  let mockToolContext: Context;
+
+  beforeEach(() => {
+    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'adk-debug-plugin-test-'));
+    debugOutputFile = path.join(tempDir, 'debug_output.yaml');
+
+    mockSession = {
+      id: 'test-session-id',
+      appName: 'test-app',
+      userId: 'test-user',
+      state: {key1: 'value1', key2: 123},
+      events: [],
+      lastUpdateTime: Date.now(),
+    };
+
+    mockInvocationContext = {
+      invocationId: 'test-invocation-id',
+      session: mockSession,
+      userId: 'test-user',
+      appName: 'test-app',
+      branch: undefined,
+      agent: {name: 'test-agent'} as unknown as BaseAgent,
+    } as unknown as InvocationContext;
+
+    mockCallbackContext = {
+      invocationId: 'test-invocation-id',
+      agentName: 'test-agent',
+      invocationContext: mockInvocationContext,
+      state: new State(),
+    } as unknown as Context;
+
+    mockToolContext = {
+      invocationId: 'test-invocation-id',
+      agentName: 'test-agent',
+      functionCallId: 'test-function-call-id',
+      invocationContext: mockInvocationContext,
+      state: new State(),
+    } as unknown as Context;
+  });
+
+  afterEach(() => {
+    fs.rmSync(tempDir, {recursive: true, force: true});
+    vi.restoreAllMocks();
+  });
+
+  describe('Initialization and Identification', () => {
+    it('initializes with default values', () => {
+      const plugin = new DebugLoggingPlugin();
+      expect(plugin.name).toBe('debug_logging_plugin');
+      expect(plugin.outputPath).toBe('adk_debug.yaml');
+      expect(plugin.includeSessionState).toBe(true);
+      expect(plugin.includeSystemInstruction).toBe(true);
+      expect(isDebugLoggingPlugin(plugin)).toBe(true);
+      expect(isDebugLoggingPlugin({})).toBe(false);
+    });
+
+    it('initializes with custom values', () => {
+      const plugin = new DebugLoggingPlugin({
+        name: 'custom_debug',
+        outputPath: debugOutputFile,
+        includeSessionState: false,
+        includeSystemInstruction: false,
+      });
+      expect(plugin.name).toBe('custom_debug');
+      expect(plugin.outputPath).toBe(debugOutputFile);
+      expect(plugin.includeSessionState).toBe(false);
+      expect(plugin.includeSystemInstruction).toBe(false);
+    });
+  });
+
+  describe('Callbacks', () => {
+    it('beforeRunCallback initializes debug state', async () => {
+      const plugin = new DebugLoggingPlugin({outputPath: debugOutputFile});
+
+      const result = await plugin.beforeRunCallback({
+        invocationContext: mockInvocationContext,
+      });
+
+      expect(result).toBeUndefined();
+      const state = plugin.getInvocationState(
+        mockInvocationContext.invocationId,
+      );
+      expect(state).toBeDefined();
+      expect(state!.invocation_id).toBe('test-invocation-id');
+      expect(state!.session_id).toBe('test-session-id');
+      expect(state!.entries).toHaveLength(1);
+      expect(state!.entries[0].entry_type).toBe('invocation_start');
+    });
+
+    it('onUserMessageCallback logs user messages', async () => {
+      const plugin = new DebugLoggingPlugin({outputPath: debugOutputFile});
+      await plugin.beforeRunCallback({
+        invocationContext: mockInvocationContext,
+      });
+
+      const userMessage: Content = {
+        role: 'user',
+        parts: [{text: 'Hello, world!'}],
+      };
+
+ 
```

**File**: `core/test/utils/object_notation_utils_test.ts` (modified, +11/-0)
```diff
@@ -8,6 +8,7 @@ import {describe, expect, it} from 'vitest';
 import {
   toCamelCase,
   toSnakeCase,
+  toSnakeCaseKey,
 } from '../../src/utils/object_notation_utils.js';
 
 describe('toCamelCase', () => {
@@ -151,3 +152,13 @@ describe('toSnakeCase', () => {
     expect(toSnakeCase(undefined)).toBe(undefined);
   });
 });
+
+describe('toSnakeCaseKey', () => {
+  it('converts camelCase, PascalCase, acronyms, and hyphenated keys to snake_case', () => {
+    expect(toSnakeCaseKey('apiKey')).toBe('api_key');
+    expect(toSnakeCaseKey('XApiKey')).toBe('x_api_key');
+    expect(toSnakeCaseKey('X-Api-Key')).toBe('x_api_key');
+    expect(toSnakeCaseKey('Proxy-Authorization')).toBe('proxy_authorization');
+    expect(toSnakeCaseKey('user:apiKey')).toBe('user:api_key');
+  });
+});
```

---

### Incident Patch 10: `ebf94c67` (2026-10-01)
**Commit Message**: fix(core): keep ${...} and escaped braces in instructions as literal text (#959)

injectSessionState treated the {name} inside ${name}, ${{name}} and
\{name} as a state placeholder, so an instruction that documents such
syntax failed with "Context variable not found", or had a state value
spliced into it.

Skip matches that follow `$` or `\`, which selects the same placeholders
as adk-python's _TEMPLATE_VAR_PATTERN (google/adk-python#5706) without a
regex lookbehind, which the web build targets do not support.

**File**: `core/src/agents/instructions.ts` (modified, +7/-1)
```diff
@@ -166,7 +166,13 @@ export async function injectSessionState(
     : [];
 
   const pattern = /\{+[^{}]*}+/g;
-  const matches = Array.from(template.matchAll(pattern));
+  // Braces right after `$` or `\` are literal text such as `${expr}`,
+  // `${{expr}}` or `\{expr}`, not a placeholder (as in adk-python). Checked
+  // here rather than with a lookbehind, which the web build targets lack.
+  const matches = Array.from(template.matchAll(pattern)).filter((match) => {
+    const previous = template[match.index! - 1];
+    return previous !== '$' && previous !== '\\';
+  });
 
   if (matches.length === 0 && sourceMatches.length === 0) {
     return template;
```

**File**: `core/test/agents/instructions_test.ts` (modified, +36/-0)
```diff
@@ -97,6 +97,42 @@ describe('injectSessionState', () => {
     );
   });
 
+  it('leaves a literal ${expression} untouched when the key is absent', async () => {
+    const ctx = makeContext({});
+    const template = 'formatString supports ${expression} interpolation.';
+    expect(await injectSessionState(template, ctx)).toBe(template);
+  });
+
+  it('leaves ${expression} untouched when the key is in state', async () => {
+    const ctx = makeContext({user_name: 'Foo', expression: 'bar'});
+    expect(
+      await injectSessionState('Hello {user_name}! Uses ${expression}.', ctx),
+    ).toBe('Hello Foo! Uses ${expression}.');
+  });
+
+  it('leaves ${{expression}} untouched', async () => {
+    expect(
+      await injectSessionState(
+        'Workflow syntax: ${{expression}}.',
+        makeContext(),
+      ),
+    ).toBe('Workflow syntax: ${{expression}}.');
+    const ctx = makeContext({expression: 'foo', user_name: 'bar'});
+    expect(
+      await injectSessionState(
+        'Workflow syntax: ${{expression}} and {user_name}.',
+        ctx,
+      ),
+    ).toBe('Workflow syntax: ${{expression}} and bar.');
+  });
+
+  it('leaves a backslash-escaped \\{expression} untouched', async () => {
+    const ctx = makeContext({expression: 'foo'});
+    expect(await injectSessionState('Literal \\{expression}.', ctx)).toBe(
+      'Literal \\{expression}.',
+    );
+  });
+
   it('passes through keys containing spaces (not valid identifiers)', async () => {
     const ctx = makeContext({});
     expect(await injectSessionState('value={invalid key}', ctx)).toBe(
```

---

### Incident Patch 11: `e894d35d` (2026-10-01)
**Commit Message**: fix(logger): map numeric levels to Winston names (#960)

**File**: `core/src/utils/logger_node.ts` (modified, +8/-1)
```diff
@@ -17,6 +17,13 @@
 import * as winston from 'winston';
 import {Logger, LogLevel, setLogger} from './logger.js';
 
+const WINSTON_LEVEL_NAMES: Record<LogLevel, string> = {
+  [LogLevel.DEBUG]: 'debug',
+  [LogLevel.INFO]: 'info',
+  [LogLevel.WARN]: 'warn',
+  [LogLevel.ERROR]: 'error',
+};
+
 /** The default logger on Node. Writes through winston. */
 export class WinstonLogger implements Logger {
   private readonly logger: winston.Logger;
@@ -56,7 +63,7 @@ export class WinstonLogger implements Logger {
       return;
     }
 
-    this.logger.log(level.toString(), messages.join(' '));
+    this.logger.log(WINSTON_LEVEL_NAMES[level], messages.join(' '));
   }
 
   debug(...messages: unknown[]): void {
```

**File**: `core/test/utils/logger_node_test.ts` (modified, +20/-6)
```diff
@@ -141,12 +141,26 @@ describe('WinstonLogger', () => {
     expect(lines).toHaveLength(0);
   });
 
-  it('throws from log() because winston rejects the numeric level name', () => {
-    setLogLevel(LogLevel.ERROR);
+  it('maps numeric log levels to winston level names', async () => {
+    setLogLevel(LogLevel.DEBUG);
+
+    const records: Array<[LogLevel, string]> = [
+      [LogLevel.DEBUG, 'DEBUG'],
+      [LogLevel.INFO, 'INFO'],
+      [LogLevel.WARN, 'WARN'],
+      [LogLevel.ERROR, 'ERROR'],
+    ];
+    for (const [level, message] of records) {
+      getLogger().log(level, `msg-${message.toLowerCase()}`);
+    }
+    await flush();
 
-    // Pre-existing behaviour, preserved by this change: `log()` passes the
-    // numeric enum value to winston, which knows only the 'debug'..'error'
-    // names. A separate change fixes it.
-    expect(() => getLogger().log(LogLevel.ERROR, 'boom')).toThrow();
+    expect(lines.map((line) => stripAnsi(line).trimEnd())).toEqual(
+      records.map(([, level]) =>
+        expect.stringMatching(
+          new RegExp(`^${level}: \\[ADK\\] .* msg-${level.toLowerCase()}$`),
+        ),
+      ),
+    );
   });
 });
```

**File**: `dev/src/utils/logger.ts` (modified, +8/-1)
```diff
@@ -7,6 +7,13 @@
 import {LogLevel, Logger} from '@google/adk';
 import * as winston from 'winston';
 
+const WINSTON_LEVEL_NAMES: Record<LogLevel, string> = {
+  [LogLevel.DEBUG]: 'debug',
+  [LogLevel.INFO]: 'info',
+  [LogLevel.WARN]: 'warn',
+  [LogLevel.ERROR]: 'error',
+};
+
 /**
  * Options for the ADK CLI logger.
  */
@@ -82,7 +89,7 @@ export class AdkLogger implements Logger {
       return;
     }
 
-    this.logger.log(level.toString(), messages.join(' '));
+    this.logger.log(WINSTON_LEVEL_NAMES[level], messages.join(' '));
   }
 
   debug(...messages: unknown[]): void {
```

**File**: `dev/test/utils/logger_log_test.ts` (added, +70/-0)
```diff
@@ -0,0 +1,70 @@
+/**
+ * @license
+ * Copyright 2026 Google LLC
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+import {LogLevel} from '@google/adk';
+import {Console} from 'node:console';
+import {Writable} from 'node:stream';
+import {stripVTControlCharacters} from 'node:util';
+import {afterEach, beforeEach, describe, expect, it} from 'vitest';
+import {AdkLogger} from '../../src/utils/logger.js';
+
+class CaptureStream extends Writable {
+  text = '';
+
+  override _write(
+    chunk: Buffer,
+    _encoding: string,
+    done: (error?: Error | null) => void,
+  ): void {
+    this.text += chunk.toString();
+    done();
+  }
+}
+
+describe('AdkLogger.log', () => {
+  let stdout: CaptureStream;
+  let stderr: CaptureStream;
+  let realConsole: typeof globalThis.console;
+
+  beforeEach(() => {
+    stdout = new CaptureStream();
+    stderr = new CaptureStream();
+    realConsole = globalThis.console;
+    globalThis.console = new Console(stdout, stderr);
+  });
+
+  afterEach(() => {
+    globalThis.console = realConsole;
+  });
+
+  it('maps numeric log levels to winston level names', async () => {
+    const logger = new AdkLogger({
+      label: 'test',
+      printFormat: (info) => `${info.level}: ${info.message}`,
+    });
+    logger.setLogLevel(LogLevel.DEBUG);
+
+    const records: Array<[LogLevel, string]> = [
+      [LogLevel.DEBUG, 'DEBUG'],
+      [LogLevel.INFO, 'INFO'],
+      [LogLevel.WARN, 'WARN'],
+      [LogLevel.ERROR, 'ERROR'],
+    ];
+    for (const [level, message] of records) {
+      logger.log(level, `msg-${message.toLowerCase()}`);
+    }
+    await new Promise<void>((resolve) => setImmediate(resolve));
+
+    const output = stripVTControlCharacters(stdout.text + stderr.text)
+      .replace(/\r\n/g, '\n')
+      .trim();
+    expect(output).toBe(
+      records
+        .map(([, level]) => `${level}: msg-${level.toLowerCase()}`)
+        .join('\n'),
+    );
+  });
+});
```

---

### Incident Patch 12: `d5ab177d` (2026-10-01)
**Commit Message**: fix(dev): validate replay input before running agent (#954)

**File**: `dev/src/cli/cli_run.ts` (modified, +36/-6)
```diff
@@ -153,6 +153,34 @@ interface InputFile {
   queries: string[];
 }
 
+function isRecord(value: unknown): value is Record<string, unknown> {
+  return typeof value === 'object' && value !== null && !Array.isArray(value);
+}
+
+async function loadInputFile(filePath: string): Promise<InputFile | undefined> {
+  const absolutePath = getAbsolutePath(filePath);
+  const contents = await loadFileData<unknown>(absolutePath);
+  if (contents === undefined) {
+    return;
+  }
+
+  if (
+    !isRecord(contents) ||
+    !isRecord(contents.state) ||
+    !Array.isArray(contents.queries) ||
+    !contents.queries.every((query) => typeof query === 'string')
+  ) {
+    throw new Error(
+      `Invalid replay file ${absolutePath}: expected an object with an object "state" and an array of string "queries".`,
+    );
+  }
+
+  return {
+    state: contents.state,
+    queries: contents.queries,
+  };
+}
+
 /**
  * The one readline interface for the run, created on first prompt. A fresh
  * interface per prompt discards the lines readline had already read ahead from
@@ -193,15 +221,13 @@ interface RunFromInputFileOptions {
   artifactService: BaseArtifactService;
   sessionService: BaseSessionService;
   memoryService?: BaseMemoryService;
-  filePath: string;
+  fileContent: InputFile | undefined;
 }
 async function runFromInputFile(
   options: RunFromInputFileOptions,
 ): Promise<Session | undefined> {
-  const fileContent = await loadFileData<InputFile>(
-    getAbsolutePath(options.filePath),
-  );
-  if (!fileContent) {
+  const {fileContent} = options;
+  if (fileContent === undefined) {
     return;
   }
 
@@ -346,6 +372,10 @@ export async function runAgent(options: RunAgentOptions): Promise<void> {
   // as failed, rather than being swallowed or printed to stdout with exit 0.
   let watcher: fs.FSWatcher | undefined;
   try {
+    const inputFileContent = options.inputFile
+      ? await loadInputFile(options.inputFile)
+      : undefined;
+
     await using agentFile = new AgentFile(
       getAbsolutePath(options.agentPath),
       options.agentFileLoadOptions,
@@ -393,7 +423,7 @@ export async function runAgent(options: RunAgentOptions): Promise<void> {
           artifactService,
           sessionService,
           memoryService,
-          filePath: options.inputFile,
+          fileContent: inputFileContent,
         })) || session;
     } else if (options.savedSessionFile) {
       const loadedSession = await loadFileData<Session>(
```

**File**: `dev/test/cli/cli_run_test.ts` (modified, +32/-1)
```diff
@@ -375,7 +375,7 @@ describe('cli_run', () => {
   });
 
   it('should handle missing input file', async () => {
-    (loadFileData as Mock).mockResolvedValue(null);
+    (loadFileData as Mock).mockResolvedValue(undefined);
     const mockSessionService = createMockSessionService();
 
     await runAgent({
@@ -386,6 +386,37 @@ describe('cli_run', () => {
     expect(loadFileData).toHaveBeenCalled();
   });
 
+  it.each([
+    ['a missing state object', {queries: ['go']}],
+    ['a missing queries array', {state: {}}],
+    ['queries provided as a string', {state: {}, queries: 'hi'}],
+    ['a non-string query', {state: {}, queries: ['go', 1]}],
+    ['a non-object state', {state: [], queries: ['go']}],
+    ['a null JSON document', null],
+  ])(
+    'rejects replay input with %s before creating a session or running the agent',
+    async (_description, content) => {
+      (loadFileData as Mock).mockResolvedValue(content);
+      const mockSessionService = createMockSessionService();
+
+      await runAgent({
+        agentPath: 'agent.ts',
+        inputFile: 'input.json',
+        sessionService: mockSessionService,
+      });
+
+      expect(errorSpy).toHaveBeenCalledWith(
+        expect.objectContaining({
+          message: expect.stringContaining('Invalid replay file'),
+        }),
+      );
+      expect(process.exitCode).toBe(1);
+      expect(mockSessionService.createSession).not.toHaveBeenCalled();
+      expect(AgentFile).not.toHaveBeenCalled();
+      expect(Runner).not.toHaveBeenCalled();
+    },
+  );
+
   it('honours an absolute --replay path instead of rebasing it on cwd', async () => {
     // `path.join(cwd, '/abs/input.json')` silently strips the leading
     // separator and looks for `<cwd>/abs/input.json`, which does not exist.
```

---

### Incident Patch 13: `86579095` (2026-09-30)
**Commit Message**: fix(artifacts): populate canonicalUri on in-memory artifact versions (#966)

InMemoryArtifactService never set canonicalUri, so a caller that reads it
got undefined from the default service and a URI from the file and GCS
services. Code written against the default service then behaved
differently against real storage.

saveArtifact now records the memory:// URI that adk-python builds, so
getArtifactVersion and listArtifactVersions return it. The storage key
stays URL-encoded and unchanged.

**File**: `core/src/artifacts/in_memory_artifact_service.ts` (modified, +35/-0)
```diff
@@ -54,6 +54,13 @@ export class InMemoryArtifactService implements BaseArtifactService {
     const version = this.artifacts[path].length;
     const metadata: ArtifactVersion = {
       version,
+      canonicalUri: getCanonicalUri(
+        appName,
+        userId,
+        sessionId,
+        filename,
+        version,
+      ),
       customMetadata,
     };
 
@@ -220,6 +227,34 @@ function artifactPrefix(scope: string, ...parts: string[]): string {
   return `${[scope, ...parts].map(encodeURIComponent).join('/')}/`;
 }
 
+/**
+ * Builds the canonical URI for an artifact version.
+ *
+ * Segments are interpolated raw, which matches the `memory://` URIs the other
+ * ADK language implementations produce. The URI is metadata only; the storage
+ * key from `artifactPath()` stays URL-encoded and remains the lookup key.
+ *
+ * @param appName The app name.
+ * @param userId The user ID.
+ * @param sessionId The session ID.
+ * @param filename The filename.
+ * @param version The zero-based version number.
+ * @return The canonical URI for the artifact version.
+ */
+function getCanonicalUri(
+  appName: string,
+  userId: string,
+  sessionId: string,
+  filename: string,
+  version: number,
+): string {
+  if (fileHasUserNamespace(filename)) {
+    return `memory://apps/${appName}/users/${userId}/artifacts/${filename}/versions/${version}`;
+  }
+
+  return `memory://apps/${appName}/users/${userId}/sessions/${sessionId}/artifacts/${filename}/versions/${version}`;
+}
+
 /**
  * Checks if the filename has a user namespace prefix.
  *
```

**File**: `core/test/artifacts/artifact_service_test_utils.ts` (modified, +34/-0)
```diff
@@ -490,6 +490,40 @@ export function runArtifactServiceTests(
     });
   });
 
+  describe('canonicalUri', () => {
+    it('records a canonical URI on every saved version', async () => {
+      // The scheme differs per implementation, so only presence is asserted.
+      for (const filename of ['canonical.txt', 'user:canonical.txt']) {
+        const version = await service.saveArtifact({
+          appName,
+          userId,
+          sessionId,
+          filename,
+          artifact: {text: '.'},
+        });
+
+        const fetched = await service.getArtifactVersion({
+          appName,
+          userId,
+          sessionId,
+          filename,
+          version,
+        });
+        expect(fetched?.canonicalUri).toEqual(expect.any(String));
+        expect(fetched?.canonicalUri).not.toBe('');
+
+        const versions = await service.listArtifactVersions({
+          appName,
+          userId,
+          sessionId,
+          filename,
+        });
+        expect(versions).toHaveLength(1);
+        expect(versions[0].canonicalUri).toBe(fetched?.canonicalUri);
+      }
+    });
+  });
+
   describe('fileData artifacts', () => {
     it('saves and loads an external gs:// URI reference', async () => {
       const filename = 'report.pdf';
```

**File**: `core/test/artifacts/in_memory_artifact_service_test.ts` (modified, +112/-0)
```diff
@@ -84,6 +84,118 @@ describe('InMemoryArtifactService', () => {
     expect(artifactB?.text).toBe('artifact-b');
   });
 
+  describe('canonicalUri', () => {
+    const key = {appName: 'app0', userId: 'user0', sessionId: '123'};
+
+    async function saveVersions(
+      service: InMemoryArtifactService,
+      filename: string,
+      count: number,
+    ): Promise<void> {
+      for (let i = 0; i < count; i++) {
+        await service.saveArtifact({
+          ...key,
+          filename,
+          artifact: {text: `v${i}`},
+        });
+      }
+    }
+
+    it('builds a session-scoped memory:// URI for each version', async () => {
+      const service = new InMemoryArtifactService();
+      await saveVersions(service, 'filename', 4);
+
+      const versions = await service.listArtifactVersions({
+        ...key,
+        filename: 'filename',
+      });
+
+      expect(versions.map((v) => v.canonicalUri)).toEqual([
+        'memory://apps/app0/users/user0/sessions/123/artifacts/filename/versions/0',
+        'memory://apps/app0/users/user0/sessions/123/artifacts/filename/versions/1',
+        'memory://apps/app0/users/user0/sessions/123/artifacts/filename/versions/2',
+        'memory://apps/app0/users/user0/sessions/123/artifacts/filename/versions/3',
+      ]);
+    });
+
+    it('omits the session segment for user-scoped artifacts', async () => {
+      const service = new InMemoryArtifactService();
+      await saveVersions(service, 'user:document.pdf', 4);
+
+      const versions = await service.listArtifactVersions({
+        ...key,
+        filename: 'user:document.pdf',
+      });
+
+      expect(versions.map((v) => v.canonicalUri)).toEqual([
+        'memory://apps/app0/users/user0/artifacts/user:document.pdf/versions/0',
+        'memory://apps/app0/users/user0/artifacts/user:document.pdf/versions/1',
+        'memory://apps/app0/users/user0/artifacts/user:document.pdf/versions/2',
+        'memory://apps/app0/users/user0/artifacts/user:document.pdf/versions/3',
+      ]);
+    });
+
+    it('returns the canonical URI from getArtifactVersion', async () => {
+      const service = new InMemoryArtifactService();
+      await saveVersions(service, 'filename', 3);
+
+      const second = await service.getArtifactVersion({
+        ...key,
+        filename: 'filename',
+        version: 1,
+      });
+      const latest = await service.getArtifactVersion({
+        ...key,
+        filename: 'filename',
+      });
+
+      expect(second?.canonicalUri).toBe(
+        'memory://apps/app0/users/user0/sessions/123/artifacts/filename/versions/1',
+      );
+      expect(latest?.canonicalUri).toBe(
+        'memory://apps/app0/users/user0/sessions/123/artifacts/filename/versions/2',
+      );
+    });
+
+    it('interpolates path segments verbatim', async () => {
+      const service = new InMemoryArtifactService();
+      await saveVersions(service, 'nested/report.txt', 1);
+
+      const version = await service.getArtifactVersion({
+        ...key,
+        filename: 'nested/report.txt',
+      });
+
+      expect(version?.canonicalUri).toBe(
+        'memory://apps/app0/users/user0/sessions/123/artifacts/nested/report.txt/versions/0',
+      );
+    });
+
+    it('sets a canonical URI for fileData artifacts', async () => {
+      const service = new InMemoryArtifactService();
+      await service.saveArtifact({
+        ...key,
+        filename: 'report.pdf',
+        artifact: {
+          fileData: {
+            fileUri: 'gs://bucket/report.pdf',
+            mimeType: 'application/pdf',
+          },
+        },
+      });
+
+      const version = await service.getArtifactVersion({
+        ...key,
+        filename: 'report.pdf',
+      });
+
+      expect(version?.canonicalUri).toBe(
+        'memory://apps/app0/users/user0/sessions/123/artifacts/report.pdf/versions/0',
+      );
+      expect(version?.mimeType).toBe('application/pdf');
+    });
+  });
+
   it('does not leak a session named user into other sessions', async () => {
     const service = new InMemoryArtifactService();
 
```

---

### Incident Patch 14: `0550cb0d` (2026-09-30)
**Commit Message**: fix(utils): decode base64 as UTF-8 in the browser (#965)

* fix(utils): decode base64 as UTF-8 in the browser branch

window.atob returns a latin1 binary string with one code unit per byte,
while the Node branch decodes the same bytes as UTF-8. The two branches
of base64Decode therefore returned different strings for any non-ASCII
payload, so a CSV attachment reached the code executor mojibake'd under
the browser build.

The browser branch now recovers the bytes from atob and decodes them
with TextDecoder in its default non-fatal mode, matching Buffer's
U+FFFD substitution. Node behaviour is unchanged.

* fix(utils): keep the byte order mark in the browser base64 decode

TextDecoder strips a leading UTF-8 BOM unless ignoreBOM is set, while
Buffer keeps it as U+FEFF. Spreadsheets export UTF-8 CSV with a BOM, so
the two branches still disagreed for the common shape of the one mime
type that reaches base64Decode.

The browser test now also asserts that the window stub engaged, so it
cannot pass by silently falling through to the Node branch.

* fix(utils): encode a string as UTF-8 bytes in the browser base64 encode

base64Encode and base64Decode are a pair, and the decode fix left the

**File**: `core/src/utils/env_aware_utils.ts` (modified, +25/-10)
```diff
@@ -70,19 +70,21 @@ export function randomUUID(): string {
 /**
  * Encodes the given string or Uint8Array to base64.
  *
+ * `window.btoa` is byte-oriented and throws on any code unit above `U+00FF`,
+ * so a string is first encoded to UTF-8 bytes. Node's `Buffer` encodes a
+ * string as UTF-8 too, which keeps both environments on one contract and lets
+ * `base64Decode` round-trip its output.
+ *
  * @param data The data to encode.
  * @return The base64-encoded string.
  */
 export function base64Encode(data: string | Uint8Array): string {
   if (isBrowser()) {
+    const bytes =
+      typeof data === 'string' ? new TextEncoder().encode(data) : data;
     let strData = '';
-    if (typeof data === 'string') {
-      strData = data;
-    } else {
-      const len = data.byteLength;
-      for (let i = 0; i < len; i++) {
-        strData += String.fromCharCode(data[i]);
-      }
+    for (let i = 0; i < bytes.length; i++) {
+      strData += String.fromCharCode(bytes[i]);
     }
     // eslint-disable-next-line no-undef
     return window.btoa(strData);
@@ -92,15 +94,28 @@ export function base64Encode(data: string | Uint8Array): string {
 }
 
 /**
- * Decodes the given base64 string to a string.
+ * Decodes the given base64 string to UTF-8 text.
+ *
+ * `window.atob` is byte-oriented: it returns a latin1 "binary string" with one
+ * code unit per decoded byte, so a multi-byte UTF-8 sequence surfaces as
+ * mojibake. Node's `Buffer` decodes the same bytes as UTF-8, so the browser
+ * branch recovers the bytes from `atob` and decodes them explicitly. That keeps
+ * both environments on the single contract `File.content` and
+ * `materializeFiles` already assume.
+ *
+ * `ignoreBOM` keeps a leading byte order mark as `U+FEFF`, which is what
+ * `Buffer` does. `TextDecoder` strips it by default, so a spreadsheet CSV
+ * exported as UTF-8 with a BOM would otherwise lose a character.
  *
  * @param data The base64-encoded string.
- * @return The decoded string.
+ * @return The decoded UTF-8 string.
  */
 export function base64Decode(data: string): string {
   if (isBrowser()) {
     // eslint-disable-next-line no-undef
-    return window.atob(data);
+    const binary = window.atob(data);
+    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
+    return new TextDecoder('utf-8', {ignoreBOM: true}).decode(bytes);
   }
 
   return Buffer.from(data, 'base64').toString();
```

**File**: `core/test/utils/env_aware_utils_test.ts` (modified, +126/-0)
```diff
@@ -18,11 +18,27 @@ import {
   base64Decode,
   base64Encode,
   getBooleanEnvVar,
+  isBase64Encoded,
   randomUUID,
 } from '../../src/utils/env_aware_utils.js';
 import type {Logger} from '../../src/utils/logger.js';
 
 describe('env_aware_utils', () => {
+  afterEach(() => {
+    vi.unstubAllGlobals();
+  });
+
+  // isBrowser() only checks for a `window` global, and atob and btoa are the
+  // only members the browser branches touch. The spies are returned so a test
+  // can prove the browser branch ran, rather than the stub silently missing
+  // and the Node branch answering instead.
+  const stubBrowser = () => {
+    const atob = vi.fn(globalThis.atob.bind(globalThis));
+    const btoa = vi.fn(globalThis.btoa.bind(globalThis));
+    vi.stubGlobal('window', {atob, btoa});
+    return {atob, btoa};
+  };
+
   describe('getBooleanEnvVar', () => {
     const originalEnv = process.env;
 
@@ -256,4 +272,114 @@ describe('env_aware_utils', () => {
       expect(base64Decode(base64Encode('hello world'))).toBe('hello world');
     });
   });
+
+  describe('base64Decode', () => {
+    it('decodes UTF-8 text in Node', () => {
+      const decoded = base64Decode('Y2Fmw6kg4pyT');
+
+      expect(decoded).toBe('café ✓');
+      expect(decoded.length).toBe(6);
+    });
+
+    // window.atob yields one code unit per byte, so this input decoded to
+    // 'cafÃ© â' (9 code units) before the browser branch decoded UTF-8.
+    it('decodes UTF-8 text in the browser', () => {
+      const {atob} = stubBrowser();
+
+      const decoded = base64Decode('Y2Fmw6kg4pyT');
+
+      expect(atob).toHaveBeenCalledOnce();
+      expect(decoded).toBe('café ✓');
+      expect(decoded.length).toBe(6);
+    });
+
+    it('returns the same text in both environments', () => {
+      const nodeResult = base64Decode('5pel5pys6KqeIOKCrDEwMA==');
+      stubBrowser();
+      const browserResult = base64Decode('5pel5pys6KqeIOKCrDEwMA==');
+
+      expect(browserResult).toBe(nodeResult);
+      expect(browserResult).toBe('日本語 €100');
+    });
+
+    it('leaves ASCII text unchanged in the browser', () => {
+      stubBrowser();
+
+      expect(base64Decode('aGVsbG8gd29ybGQ=')).toBe('hello world');
+    });
+
+    it('decodes the empty string in both environments', () => {
+      expect(base64Decode('')).toBe('');
+
+      stubBrowser();
+
+      expect(base64Decode('')).toBe('');
+    });
+
+    // Buffer.toString() substitutes U+FFFD instead of throwing, so the browser
+    // branch must decode in TextDecoder's default non-fatal mode to match.
+    it('substitutes U+FFFD for invalid UTF-8 in both environments', () => {
+      expect(base64Decode('//4=')).toBe('\uFFFD\uFFFD');
+
+      stubBrowser();
+
+      expect(base64Decode('//4=')).toBe('\uFFFD\uFFFD');
+    });
+
+    // Buffer keeps a leading byte order mark, and TextDecoder drops it unless
+    // ignoreBOM is set. Spreadsheets export UTF-8 CSV with a BOM, so this is
+    // the common shape of the one mime type that reaches this function.
+    it('keeps a leading byte order mark in both environments', () => {
+      const nodeResult = base64Decode('77u/Y2Fmw6k=');
+      stubBrowser();
+      const browserResult = base64Decode('77u/Y2Fmw6k=');
+
+      expect(browserResult).toBe(nodeResult);
+      expect(browserResult).toBe('\uFEFFcafé');
+      expect(browserResult.length).toBe(5);
+    });
+  });
+
+  describe('base64Encode', () => {
+    // window.btoa throws on any code unit above U+00FF, so a string has to
+    // reach it as UTF-8 bytes for the browser to agree with Buffer.
+    it('encodes UTF-8 text in the browser', () => {
+      const nodeResult = base64Encode('café ✓');
+      const {btoa} = stubBrowser();
+      const browserResult = base64Encode('café ✓');
+
+      expect(btoa).toHaveBeenCalledOnce();
+      expect(browserResult).toBe(nodeResult);
+      expect(browserResult).toBe('Y2Fmw6kg4pyT');
+    });
+
+    it('encodes a Uint8Array in the browser', () => {
+      const bytes = new Uint8Array([104, 105]);
+      const nodeResult = base64Encode(bytes);
+      stubBrowser();
+
+      expect(base64Encode(bytes)).toBe(nodeResult);
+      expect(nodeResult).toBe('aGk=');
+    });
+
+    it('encodes the empty string in both environments', () => {
+      expect(base64Encode('')).toBe('');
+
+      stubBrowser();
+
+      expect(base64Encode('')).toBe('');
+    });
+  });
+
+  describe('isBase64Encoded', () => {
+    // The round trip only holds while base64Encode and base64Decode share one
+    // contract; a byte-oriented btoa would throw here and report false.
+    it('recognises a non-ASCII payload in both environments', () => {
+      expect(isBase64Encoded('Y2Fmw6kg4pyT')).toBe(true);
+
+      stubBrowser();
+
+      expect(isBase64Encoded('Y2Fmw6kg4pyT')).toBe(true);
+    });
+  });
 });
```

---

### Incident Patch 15: `5d13f15b` (2026-09-30)
**Commit Message**: fix(core): convert JSON Schema boolean nodes to object schemas in toGeminiSchema (#937)

* fix(core): convert a JSON Schema boolean node to an object schema

JSON Schema allows a node to be the literal `true` or `false`. MCP servers
send `true` for an unconstrained field. recursiveConvert assumed an object
node, so a boolean reached toGeminiType(undefined) and the model was told
the property has TYPE_UNSPECIFIED.

Normalise a boolean node to `{type: 'object'}` at the entry point of the
recursion, so every nested position is covered by one branch. This matches
adk-python's _sanitize_schema_formats_for_gemini.

* fix(core): convert JSON Schema boolean nodes to object schemas in toGeminiSchema

**File**: `core/src/utils/gemini_schema_util.ts` (modified, +10/-1)
```diff
@@ -54,6 +54,13 @@ export function toGeminiSchema(mcpSchema?: MCPToolSchema): Schema | undefined {
 
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   function recursiveConvert(mcp: any): Schema {
+    // JSON Schema allows boolean schemas: `true` accepts any value and `false`
+    // rejects all values. Gemini has no equivalent for either, so both are
+    // approximated as an unconstrained object schema, matching adk-python.
+    if (typeof mcp === 'boolean') {
+      mcp = {type: 'object'};
+    }
+
     const sourceType = mcp.anyOf ?? mcp.type;
     let isNullable = false;
     let nonNullTypes;
@@ -167,7 +174,9 @@ export function toGeminiSchema(mcpSchema?: MCPToolSchema): Schema | undefined {
         geminiSchema.required = mcp.required;
       }
     } else if (geminiType === Type.ARRAY) {
-      if (mcp.items) {
+      // `items: false` is a schema node, so a bare truthiness test would drop
+      // it. Other falsy values are not schemas and stay skipped.
+      if (mcp.items || mcp.items === false) {
         geminiSchema.items = recursiveConvert(mcp.items);
       }
     }
```

**File**: `core/test/utils/gemini_schema_util_test.ts` (modified, +122/-0)
```diff
@@ -659,6 +659,128 @@ describe('toGeminiSchema', () => {
       items: {type: Type.OBJECT, properties: {}},
     });
   });
+
+  it('converts a boolean true property schema to an object schema', () => {
+    const input: MCPToolSchema = {
+      type: 'object',
+      properties: {
+        model: true,
+      },
+    };
+
+    const schema = toGeminiSchema(input);
+
+    expect(schema).toEqual({
+      type: Type.OBJECT,
+      properties: {
+        model: {type: Type.OBJECT, properties: {}},
+      },
+    });
+  });
+
+  it('converts a boolean false property schema to an object schema without throwing', () => {
+    const input: MCPToolSchema = {
+      type: 'object',
+      properties: {
+        anything: false,
+      },
+    };
+
+    expect(() => toGeminiSchema(input)).not.toThrow();
+
+    const schema = toGeminiSchema(input);
+
+    expect(schema).toEqual({
+      type: Type.OBJECT,
+      properties: {
+        anything: {type: Type.OBJECT, properties: {}},
+      },
+    });
+  });
+
+  it('converts a boolean true schema nested in array item properties', () => {
+    const input: MCPToolSchema = {
+      type: 'object',
+      properties: {
+        title: {type: 'string'},
+        data: {
+          type: 'array',
+          items: {
+            type: 'object',
+            properties: {
+              datasourceUid: {type: 'string'},
+              model: true,
+              queryType: {type: 'string'},
+              refId: {type: 'string'},
+            },
+          },
+        },
+      },
+      required: ['title', 'data'],
+    };
+
+    const schema = toGeminiSchema(input);
+
+    expect(schema).toEqual({
+      type: Type.OBJECT,
+      properties: {
+        title: {type: Type.STRING},
+        data: {
+          type: Type.ARRAY,
+          items: {
+            type: Type.OBJECT,
+            properties: {
+              datasourceUid: {type: Type.STRING},
+              model: {type: Type.OBJECT, properties: {}},
+              queryType: {type: Type.STRING},
+              refId: {type: Type.STRING},
+            },
+          },
+        },
+      },
+      required: ['title', 'data'],
+    });
+  });
+
+  it('converts a boolean array items schema to an object schema', () => {
+    const input = {
+      type: 'array',
+      items: true,
+    };
+
+    const schema = toGeminiSchema(input as unknown as MCPToolSchema);
+
+    expect(schema).toEqual({
+      type: Type.ARRAY,
+      items: {type: Type.OBJECT, properties: {}},
+    });
+  });
+
+  it('converts a boolean false array items schema to an object schema', () => {
+    const input = {
+      type: 'array',
+      items: false,
+    };
+
+    const schema = toGeminiSchema(input as unknown as MCPToolSchema);
+
+    expect(schema).toEqual({
+      type: Type.ARRAY,
+      items: {type: Type.OBJECT, properties: {}},
+    });
+  });
+
+  it('converts a boolean schema in an anyOf branch to an object schema', () => {
+    const input = {
+      anyOf: [true, {type: 'string'}],
+    };
+
+    const schema = toGeminiSchema(input as unknown as MCPToolSchema);
+
+    expect(schema).toEqual({
+      anyOf: [{type: Type.OBJECT, properties: {}}, {type: Type.STRING}],
+    });
+  });
 });
 
 describe('openApiSchemaToGeminiSchema', () => {
```

#### Recent Merged Pull Requests:
- **PR #986** (2026-10-05): chore: bump @google/genai to ^2.27 and reformat with prettier 3.9.9 (@kalenkevich)
- **PR #985** (2026-10-06): feat(models): resume Gemini generations paused with a continuation token (@kalenkevich)
- **PR #982** (2026-10-05): docs(memory): add memory guide and sample (@adk-foundry-bot)
- **PR #981** (2026-10-05): feat(models): bring models to parity with adk-python v0.1.0 (@adk-foundry-bot)
- **PR #979** (2026-10-02): feat(plugins): add ToolCallIntegrityPlugin (adk-python parity) (@kalenkevich)
- **PR #977** (2026-10-01): feat(events): reserve __adk_internal_ customMetadata keys for ADK (adk-python parity) (@kalenkevich)
- **PR #976** (2026-10-01): fix(runner): seal aborted invocations in session history (@kalenkevich)
- **PR #974** (2026-10-01): fix(dev): match adk-python's agent-graph cluster label, outline and edge color (@adk-foundry-bot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
