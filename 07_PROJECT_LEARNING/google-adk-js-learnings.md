# Forensic Learning Record (Deep Inspection): google/adk-js

> **Canonical Artifact**: `07_PROJECT_LEARNING/google-adk-js-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/google/adk-js](https://github.com/google/adk-js))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:22:06.532Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `google/adk-js`
- **Description**: An open-source, code-first Typescript toolkit for building, evaluating, and deploying sophisticated AI agents with flexibility and control.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1426 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.prettierrc.js`
```
/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export default {
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "quoteProps": "preserve",
  "bracketSpacing": false,
  "trailingComma": "all",
  "arrowParens": "always",
  "bracketSameLine": true,
  "endOfLine": "auto",
  "plugins": ["prettier-plugin-organize-imports"],
};

```

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
  | Task
  | Message
  | TaskStatusUpdateEvent
  | TaskArtifactUpdateEvent;

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
import {resolveAgentCard} from './agent_card.js';
import {toAdkEvent} from './event_converter_utils.js';
import {getA2ASessionMetadata} from './metadata_converter_utils.js';

export {AGENT_CARD_PATH};

/**
 * Type alias for A2A stream event data.
 */
export type A2AStreamEventData =
  | Message
  | Task
  | TaskStatusUpdateEvent
  | TaskArtifactUpdateEvent;

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
      this.card = await resolveAgentCard(this.a2aConfig.agentCard);

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
 * `author: msg.role === 'user' ? 'user
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
  isHttpUrl,
  isLinkLocalAddress,
  normalizeHost,
  resolveHostAddresses,
} from '../utils/ssrf_guard.js';
import {RunnableRoot} from '../workflow/run_node_as_invocation.js';
import {isWorkflow} from '../workflow/workflow.js';

/**
 * A single-letter URL protocol, which is a Windows drive letter rather than a
 * scheme: `new URL('C:\\cards\\card.json')` parses with `protocol === 'c:'`.
 */
const WINDOWS_DRIVE_PROTOCOL = /^[a-z]:$/i;

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
): Promise<AgentCard> {
  if (typeof agentCard === 'object') {
    return agentCard;
  }

  const url = parseCardUrl(agentCard);
  if (url && isHttpUrl(url)) {
    await assertHostAllowed(url);
    const resolver = new DefaultAgentCardResolver({
      fetchImpl: noRedirectFetch(agentCard),
    });
    return resolver.resolve(agentCard);
  }
  if (url && url.protocol !== 'file:') {
    throw new Error(
      `Unsupported agent card URL scheme "${url.protocol}": ${agentCard}. ` +
        'Use http://, https:// or file://, or pass a filesystem path with no scheme.',
    );
  }
  return readAgentCardFile(agentCard, url);
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
 * Builds the `fetch` the card resolver uses, which refuses a redirect instead
 * of following it. A redirect is the only way the card host, rather than the
 * developer, picks where the request lands.
 */
function noRedirectFetch(source: string): typeof fetch {
  return async (input, init) => {
    const response = await fetch(input, {...init, redirect: 'manual'});
    if (isRedirect(response.status)) {
      throw new Error(
        `Refusing to follow a redirect while fetching the agent card from ${source} ` +
          `(status ${response.status}, location ${response.headers.get('location')}). ` +
          'Configure the final URL instead.',
      );
    }
    return response;
  };
}

/**
 * Returns `true` for a redirect response, including the opaque one a `manual`
 * redirect produces on platforms that hide the status.
 */
function isRedirect(status: number): boolean {
  return status === 0 || (status >= 300 && status < 400);
}

/**
 * Throws when the URL's host is, or resolves to, a link-local address.
 *
 * Checking the configured URL covers the whole fetch: the resolver appends a
 * relative well-known path, which cannot change the origin, and a redirect is
 * refused rather than followed.
 */
async function assertHostAllowed(url: URL): Promise<void> {
  const host = normalizeHost(url.hostname);
  const addresses = await resolveHostAddresses(host);
  if (addresses.some(isLinkLocalAddress)) {
    throw new Error(
      `Refusing to fetch agent card from a link-local address: ${host}`,
    );
  }
}

/**
 * Converts an ADK agent to an A2A AgentCard.
 */
export async function getA2AAgentCard(
  agent: RunnableRoot,
  transports: AgentInterface[],
): Promise<AgentCard> {
  return {
    name: agent.name,
    description: agent.description || '',
    protocolVersion: '0.3.0',
    version: '1.0.0',
    skills: await buildAgentSkills(agent),
    url: transports[0].url,
    preferredTransport: transports[0].transport,
    capabilities: {
      extensions: [],
      stateTransitionHistory: false,
      pushNotifications: false,
      streaming: true,
    },
    defaultInputModes: ['text'],
    defaultOutputModes: ['text'],
    additionalInterfaces: transports,
  };
}

/**
 * Builds a list of AgentSkills based on agent descriptions and types.
 * This information can be used in AgentCard to help clients understand agent capabilities.
 *
 * @param agent The agent to build skills for.
 * @returns A promise resolving to a list of AgentSkills.
 */
export async function buildAgentSkills(
  agent: RunnableRoot,
): Promise<AgentSkill[]> {
  const [primarySkills, subAgentSkills] = await Promise.all([
    buildPrimarySkills(agent),
    buildSubAgentSkills(agent),
  ]);

  return [...primarySkills, ...subAgentSkills];
}

async function buildPrimarySkills(agent: RunnableRoot): Promise<AgentSkill[]> {
  if (isWorkflow(agent)) {
    // A workflow advertises itself as one skill. It has no sub-agents to
    // enumerate, and its internals are a graph rather than a roster.
    return [
      {
        id: agent.name,
        name: 'workflow',
        description: agent.description || `Workflow ${agent.name}`,
        tags: ['workflow'],
      },
    ];
  }
  if (isLlmAgent(agent)) {
    return buildLLMAgentSkills(agent);
  }

  return buildNonLLMAgentSkills(agent);
}

async function buildSubAgentSkills(agent: RunnableRoot): Promise<AgentSkill[]> {
  // A workflow has nodes, not sub-agents: its shape is described by the single
  // `workflow` skill rather than one skill per child.
  const subAgents = isWorkflow(agent) ? [] : agent.subAgents;
  const result: AgentSkill[] = [];

  for (const sub of subAgents) {
    const skills = await buildPrimarySkills(sub);
    for (const subSkill of skills) {
      const skill: AgentSkill = {
        id: `${sub.name}_${subSkill.id}`,
        name: `${sub.name}: ${subSkill.name}`,
        description: subSkill.description,
        tags: [`sub_agent:${sub.name}`, ...subSkill.tags],
      };
      result.push(skill);
    }
  }

  return result;
}

async function buildLLMAgentSkills(agent: LlmAgent): Promise<AgentSkill[]> {
  const skills: AgentSkill[] = [
    {
      id: agent.name,
      name: 'model',
      description: await buildDescriptionFromInstructions(agent),
      tags: ['llm'],
    },
  ];

  if (agent.tools && agent.tools.length > 0) {
    for (const toolUnion of agent.tools) {
      if (isBaseTool(toolUnion)) {
        skills.push(toolToSkill(agent.name, toolUnion));
      } else if (isBaseToolset(toolUnion)) {
        const tools = await toolUnion.getTools
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
import {getA2AAgentCard, resolveAgentCard} from './agent_card.js';
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
    ? await resolveAgentCard(options.agentCard)
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

  const 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
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

- **Issue #772** (2026-08-20): **fix(auth): a credential response's AuthConfig is adopted wholesale apart from credentialKey**
  *Symptoms*: Follow-up from the security review of #771, which @AmaadMartin's approval names as one of two items left open. #771 closed the *provenance* half of this path — a credential request is now honoured only if this agent raised it — but the *contents* of the response are still trusted.  ### Describe the bug  On the credential resume path, the `AuthConfig` is taken from the client's function response and adopted wholesale. Only `credentialKey` is pinned back from the request the agent raised:  ```ts // core/src/auth/auth_preprocessor.ts:94-98 const authConfig = authResponses[fcId] as AuthConfig; if (request.config.credentialKey) {   authConfig.credentialKey = request.config.credentialKey; } await new AuthHandler(authConfig).parseAndStoreAuthResponse(state); ```  `AuthConfig` also carries `authScheme`, `rawAuthCredential` and `exchangedAuthCredential` (`core/src/auth/auth_tool.ts:14`). None of those are reconciled against the request. The result is that the *destination* is trusted and the *credential* is not: whatever the response supplies gets stored under the key the waiting tool will read, and the tool then authenticates with it.  Three concrete consequences, all in `AuthHandler.parseAndStoreAuthResponse` (`core/src/auth/auth_handler.ts:28`):  **1. The scheme can be downgraded.** The branch is chosen by `this.authConfig.authScheme.type`, which comes from the response. A tool that requested `oauth2` gets the non-OAuth branch if the response says so, and the supplied credential is
  **Post-Mortem & Fix Analysis**:
  > Fix up in #775.  Two notes from doing the work that change this issue's contents:  1. **The SSRF claim above was overstated and is now corrected inline.** `fetchOAuth2Tokens` already blocklists via `validateDiscoveryUrl` and refuses redirects, so the caller-chosen token endpoint reaches public HTTPS hosts only — not the metadata server. It still belongs in the fix; it is not the severity I first wrote.  2. **A fourth consequence I missed when filing:** the CSRF check in `exchangeAuthorizationCode` is vacuous for the same root cause. It compares the `state` in `authResponseUri` against the `state` on the credential, and both arrive in the same client message — so it compares the sender against itself, and a response that simply omits `state` skips the check. Pinning `state` from the request is what makes it a real check, and it is the change in #775 most likely to surprise an existing client.  The same three-line shape turned out to exist in `processAuthResume` on the workflow path, so 
  > Are you satisfied with the resolution of your issue? <a href="https://docs.google.com/forms/d/e/1FAIpQLSeuqIP8vcNJv0Gv84ruyxmvrMQElhB2L0saRtuapK7c28QMWQ/viewform?entry.2064764942=Yes&entry.666097176=https%3A%2F%2Fgithub.com%2Fgoogle%2Fadk-js%2Fissues%2F772"> Yes</a> <a href="https://docs.google.com/forms/d/e/1FAIpQLSeuqIP8vcNJv0Gv84ruyxmvrMQElhB2L0saRtuapK7c28QMWQ/viewform?entry.2064764942=No&entry.666097176=https%3A%2F%2Fgithub.com%2Fgoogle%2Fadk-js%2Fissues%2F772"> No</a> 

- **Issue #752** (2026-08-22): **MessageSendParams.metadata (the recommended place for A2A extension data) is not propagated to agent execution**
  *Symptoms*: **Describe the bug**  The [A2A extensions guide](https://a2a-protocol.org/latest/topics/extensions/)'s own example places extension-specific data on the request-level `params.metadata` (sibling to `message`, keyed by extension URI) — that's the documented, recommended location for an extension to attach its data to a `message/send` call. Implementing an extension against ADK this way doesn't work: `params.metadata` never reaches the agent.  **Technical detail.** `@google/adk` depends on `@a2a-js/sdk@^0.3.10`, which resolves to `0.3.14` today (the latest version satisfying that range). Every `0.3.x` release up to and including `0.3.14` never reads `MessageSendParams.metadata` in `DefaultRequestHandler`:  ```js async sendMessage(params, context) {   const incomingMessage = params.message;   ...   const requestContext = await this._createRequestContext(incomingMessage, context); ```  `_createRequestContext` is passed only the `Message`, not `params` — so `params.metadata` is parsed off the wire and then silently dropped before `RequestContext`/ `A2AAgentExecutor.execute()` ever sees it. Same story in `sendMessageStream`.  This is fixed starting in **`@a2a-js/sdk@1.0.0`** (confirmed still broken in the `1.0.0-alpha.0` and `1.0.0-beta.0` prereleases, fixed by the `1.0.0` stable release, and still fixed in the current `1.0.1`) — `_createRequestContext` there takes the whole `params` object and preserves `metadata` into `RequestContext`. `@google/adk` hasn't picked up that dependenc
  **Post-Mortem & Fix Analysis**:
  > Hi @nbrahms, Thank you for bringing this to our attention. We have reproduced the issue. We truly appreciate you flagging this issue, we will file a bug internally.  
  > Hi @nbrahms, we have raised a PR to resolve this issue. It will be reviewed. Thank you for your patience and understanding. 
  > > Hi @nbrahms, we have raised a PR to resolve this issue. It will be reviewed. Thank you for your patience and understanding.   Awesome, thank you!

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

### Incident Patch 1: `6251a906` (2026-09-30)
**Commit Message**: fix(models): close the Chrome reply envelope, and never show it (#902)

A return-policy answer rendered as raw JSON in front of a user, on a
real on-device model:

  {"kind":"final","text":"You can return unworn items within 60
  days ... free in the UK and the US.","

The prose finished. The object did not. Two defects lined up.

buildToolChoiceSchema set `required` but not `additionalProperties`,
and JSON Schema reads that as "extra keys allowed". So once `text`
was written, `,"` was as legal a continuation as `}`: the object
never had to close, and the model wrote until the output ran out.
Whether it closed in time was left to sampling, which is why one
session answers a question cleanly and mangles the next. Every
branch now forbids undeclared keys. The tools' own argument schemas
are deliberately left open -- they belong to the caller, and some
accept keys they do not list.

Recovery then made the failure visible rather than survivable. The
salvage path is a regex needing a closing brace, a truncated reply
has none, so it fell through to returning the raw string and the
envelope reached the caller. It now scans the text value out by
hand, handling escapes and truncation mid-es

**File**: `core/src/models/chrome_prompt_llm.ts` (modified, +24/-2)
```diff
@@ -20,7 +20,10 @@ import {
   finalText,
   isAbortError,
   isRecord,
+  looksLikeEnvelope,
   renderToolInstructions,
+  salvageFinalText,
+  TRUNCATED_REPLY,
 } from './chrome_prompt_utils.js';
 import type {LlmRequest} from './llm_request.js';
 import type {LlmResponse} from './llm_response.js';
@@ -536,11 +539,24 @@ export class ChromeBuiltInLlm extends BaseLlm {
     }
 
     if (!isRecord(parsed)) {
+      // A reply cut off mid-object has no closing brace, so the salvage above
+      // cannot match it, and returning `raw` would show the caller the
+      // envelope. The answer is usually still in there, whole.
+      const salvaged = salvageFinalText(raw);
+      if (salvaged !== undefined) {
+        this.diagnostic({
+          phase: 'parse-fallback',
+          note: 'truncated envelope; recovered the text',
+        });
+        return finalText(salvaged);
+      }
       this.diagnostic({
         phase: 'parse-fallback',
         note: 'unparseable JSON; treated as text',
       });
-      return finalText(raw);
+      // Prose that was never JSON is the useful fallback here. A broken
+      // envelope is not: it puts braces and key names in front of the caller.
+      return finalText(looksLikeEnvelope(raw) ? TRUNCATED_REPLY : raw);
     }
 
     if (parsed['kind'] === 'tool' && typeof parsed['name'] === 'string') {
@@ -560,7 +576,13 @@ export class ChromeBuiltInLlm extends BaseLlm {
       };
     }
 
-    return finalText(typeof parsed['text'] === 'string' ? parsed['text'] : raw);
+    if (typeof parsed['text'] === 'string') return finalText(parsed['text']);
+    if (parsed['text'] !== undefined) return finalText(String(parsed['text']));
+    this.diagnostic({
+      phase: 'parse-fallback',
+      note: 'envelope carried no text',
+    });
+    return finalText(looksLikeEnvelope(raw) ? TRUNCATED_REPLY : raw);
   }
 
   override async connect(_llmRequest: LlmRequest): Promise<BaseLlmConnection> {
```

**File**: `core/src/models/chrome_prompt_utils.ts` (modified, +76/-0)
```diff
@@ -54,6 +54,20 @@ export function collectFunctionDeclarations(
  *
  * A single-value `enum` is used rather than `const`, because it is semantically
  * identical and more widely supported across constraint engines.
+ *
+ * Every branch sets `additionalProperties: false`, and that is load-bearing
+ * rather than tidy. Omitted, JSON Schema permits extra keys, so a decoder may
+ * emit `,"` after the last required key instead of `}`. The object then never
+ * has to close: the model keeps writing until the output runs out, and the
+ * reply arrives as truncated JSON. Whether it closes in time is left to
+ * sampling, which is why one session can answer a question cleanly and mangle
+ * the next. Closing the branch makes `}` the only legal token once `text` is
+ * written.
+ *
+ * It is set on the envelope only, never pushed into a tool's own argument
+ * schema. Those belong to the caller; some describe objects that legitimately
+ * accept keys they do not list, and forbidding those here would make a valid
+ * call impossible to express.
  */
 export function buildToolChoiceSchema(
   declarations: FunctionDeclaration[],
@@ -66,6 +80,7 @@ export function buildToolChoiceSchema(
         text: {type: 'string'},
       },
       required: ['kind', 'text'],
+      additionalProperties: false,
     },
   ];
 
@@ -79,6 +94,7 @@ export function buildToolChoiceSchema(
         args: argumentSchema(declaration),
       },
       required: ['kind', 'name', 'args'],
+      additionalProperties: false,
     });
   }
 
@@ -268,3 +284,63 @@ export function errorResponse(error: unknown): LlmResponse {
   }
   return {errorCode: name, errorMessage: message, turnComplete: true};
 }
+
+/** Shown when a reply is JSON, is broken, and holds no readable answer. */
+export const TRUNCATED_REPLY =
+  'The model started an answer and did not finish it. Ask again.';
+
+/** True when a reply is the JSON envelope rather than plain prose. */
+export function looksLikeEnvelope(raw: string): boolean {
+  return /^\s*[[{]/.test(raw) || /"kind"\s*:/.test(raw);
+}
+
+/**
+ * Reads the answer out of a truncated `{"kind":"final","text":"…` envelope.
+ *
+ * A constrained reply that stops early is usually still readable: the answer
+ * sits in `text` and only the closing quote and brace are missing. Scanning it
+ * out by hand beats `JSON.parse`, which needs the whole document, and beats
+ * showing the envelope to the caller.
+ *
+ * Returns undefined when there is no `text` key to read.
+ */
+export function salvageFinalText(raw: string): string | undefined {
+  const key = raw.match(/"text"\s*:\s*"/);
+  if (key?.index === undefined) return undefined;
+
+  const escapes: Record<string, string> = {
+    n: '\n',
+    t: '\t',
+    r: '\r',
+    b: '\b',
+    f: '\f',
+    '"': '"',
+    '\\': '\\',
+    '/': '/',
+  };
+
+  let out = '';
+  for (let i = key.index + key[0].length; i < raw.length; i++) {
+    const char = raw[i]!;
+    if (char === '"') break; // the string closed normally
+    if (char !== '\\') {
+      out += char;
+      continue;
+    }
+    const next = raw[i + 1];
+    if (next === undefined) break; // truncated mid-escape
+    if (next === 'u') {
+      const hex = raw.slice(i + 2, i + 6);
+      if (/^[0-9a-fA-F]{4}$/.test(hex)) {
+        out += String.fromCharCode(parseInt(hex, 16));
+        i += 5;
+        continue;
+      }
+    }
+    out += escapes[next] ?? next;
+    i++;
+  }
+
+  const text = out.trim();
+  return text.length ? text : undefined;
+}
```

**File**: `core/test/models/chrome_prompt_llm_test.ts` (modified, +105/-0)
```diff
@@ -491,3 +491,108 @@ describe('stripAdkIdentityPreamble', () => {
     );
   });
 });
+
+/**
+ * A reply that stops before its closing brace.
+ *
+ * Every string here was produced by Gemini Nano during a demo run, or is a
+ * one-character variation on one that was. The first is verbatim: the prose
+ * finished, the object did not, and the panel printed the envelope.
+ */
+describe('ChromeBuiltInLlm and a reply that does not close', () => {
+  const TRUNCATED =
+    '{"kind":"final","text":"You can return unworn items within 60 days for ' +
+    'a full refund. Return shipping is free in the UK and the US.","';
+
+  it('closes every branch of the tool-choice schema', async () => {
+    const fake = fakeLanguageModel(JSON.stringify({kind: 'final', text: 'x'}));
+    const llm = new ChromeBuiltInLlm({languageModel: fake.factory});
+    await collect(
+      llm.generateContentAsync(request({config: {tools: [searchTool]}})),
+    );
+
+    const constraint = fake.promptCalls[0]!.options?.responseConstraint as {
+      anyOf: Array<Record<string, unknown>>;
+    };
+    // Without this, `,"` is as legal as `}` once the last required key is
+    // written, so the object never has to close and the reply truncates.
+    for (const branch of constraint.anyOf) {
+      expect(branch['additionalProperties']).toBe(false);
+    }
+  });
+
+  it("leaves a tool's own argument schema open", async () => {
+    // Those schemas belong to the caller. Some accept keys they do not list,
+    // and forbidding them here would make a valid call impossible to express.
+    const fake = fakeLanguageModel(JSON.stringify({kind: 'final', text: 'x'}));
+    const llm = new ChromeBuiltInLlm({languageModel: fake.factory});
+    await collect(
+      llm.generateContentAsync(request({config: {tools: [searchTool]}})),
+    );
+
+    const constraint = fake.promptCalls[0]!.options?.responseConstraint as {
+      anyOf: Array<{properties?: {args?: Record<string, unknown>}}>;
+    };
+    const toolBranch = constraint.anyOf.find((b) => b.properties?.args);
+    expect(
+      toolBranch?.properties?.args?.['additionalProperties'],
+    ).toBeUndefined();
+  });
+
+  it('recovers the answer instead of showing the envelope', async () => {
+    const fake = fakeLanguageModel(TRUNCATED);
+    const llm = new ChromeBuiltInLlm({languageModel: fake.factory});
+
+    const responses = await collect(
+      llm.generateContentAsync(request({config: {tools: [searchTool]}})),
+    );
+
+    const text = responses[0]!.content?.parts?.[0]?.text ?? '';
+    expect(text).toBe(
+      'You can return unworn items within 60 days for a full refund. ' +
+        'Return shipping is free in the UK and the US.',
+    );
+    expect(text).not.toContain('"kind"');
+    expect(text).not.toContain('{');
+  });
+
+  it('keeps escapes that the truncation cut short', async () => {
+    const fake = fakeLanguageModel(
+      '{"kind":"final","text":"caf\\u00e9 is \\"open\\"',
+    );
+    const llm = new ChromeBuiltInLlm({languageModel: fake.factory});
+
+    const responses = await collect(
+      llm.generateContentAsync(request({config: {tools: [searchTool]}})),
+    );
+
+    expect(responses[0]!.content?.parts?.[0]?.text).toBe('café is "open"');
+  });
+
+  it('says so plainly when a broken envelope holds no answer', async () => {
+    const fake = fakeLanguageModel('{"kind":"fin');
+    const llm = new ChromeBuiltInLlm({languageModel: fake.factory});
+
+    const responses = await collect(
+      llm.generateContentAsync(request({config: {tools: [searchTool]}})),
+    );
+
+    const text = responses[0]!.content?.parts?.[0]?.text ?? '';
+    expect(text).toBe(
+      'The model started an answer and did not finish it. Ask again.',
+    );
+  });
+
+  it('still passes through prose that was never JSON', async () => {
+    const fake = fakeLanguageModel('We have two waterproof jackets.');
+    const llm = new ChromeBuiltInLlm({languageModel: fake.factory});
+
+    const responses = 
```

---

### Incident Patch 2: `2d2d014a` (2026-09-25)
**Commit Message**: feat(memory): forward MemoryEntry.id as the Vertex memoryId and declare customMetadata (#947)

* feat(memory): declare MemoryEntry.id and customMetadata, forward the id on create

MemoryEntry carried only content, author and timestamp, so a caller could not
pick a stable memory id and had to cast to attach per-entry metadata. The
create path now forwards MemoryEntry.id as the Vertex memoryId, and an explicit
customMetadata memoryId still wins, matching adk-python's precedence.

Hoisting customMetadata onto the public interface removes the local
MemoryEntryWithMetadata shim and its cast.

* test(memory): cover memoryId forwarding and precedence on the create path

Adds four cases: entry id forwarded, request-level memoryId wins, entry
customMetadata wins on a key collision, and no memoryId key when the entry sets
no id. The existing entry-metadata case loses its cast, which the public
customMetadata field makes unnecessary; its assertions are unchanged.

* docs(memory): note the Vertex memoryId format and cover entry-metadata precedence

The id reaches the API unvalidated, so an id outside the accepted format turns
a create that used to succeed into a request error. The addMemory do

**File**: `core/src/memory/memory_entry.ts` (modified, +17/-0)
```diff
@@ -18,6 +18,23 @@ export interface MemoryEntry {
    */
   content: Content;
 
+  /**
+   * The unique identifier of the memory.
+   *
+   * When set on an entry passed to `addMemory`, a service that supports
+   * caller-chosen identifiers uses it as the last component of the created
+   * memory's resource name instead of generating one.
+   */
+  id?: string;
+
+  /**
+   * Optional custom metadata associated with the memory.
+   *
+   * A service that also accepts request-level metadata merges this on top of
+   * it, so a key declared here wins over the same key on the request.
+   */
+  customMetadata?: Record<string, unknown>;
+
   /**
    * The author of the memory. Common values are `'user'` and `'model'`, but
    * this can also be the name of an agent when the content was produced by a
```

**File**: `core/src/memory/vertex_ai_memory_bank_service.ts` (modified, +19/-10)
```diff
@@ -27,10 +27,6 @@ import {
 } from './base_memory_service.js';
 import {MemoryEntry} from './memory_entry.js';
 
-interface MemoryEntryWithMetadata extends MemoryEntry {
-  customMetadata?: Record<string, unknown>;
-}
-
 const GENERATE_MEMORIES_KNOWN_FIELDS = [
   'disableConsolidation',
   'waitForCompletion',
@@ -199,6 +195,15 @@ export class VertexAiMemoryBankService implements BaseMemoryService {
 
   /**
    * Adds explicit memory items using Vertex Memory Bank.
+   *
+   * When a `MemoryEntry.id` is set, it is forwarded as the `memoryId` of the
+   * created memory, so the caller picks the last component of the memory
+   * resource name instead of letting the service generate one. An explicit
+   * `customMetadata['memoryId']` takes precedence over `MemoryEntry.id`.
+   *
+   * The id is forwarded unvalidated, so an id the API rejects fails the create
+   * call. Vertex accepts up to 63 characters from `[a-z0-9-]`, starting with a
+   * letter and ending with a letter or number.
    */
   async addMemory(request: {
     appName: string;
@@ -298,8 +303,6 @@ export class VertexAiMemoryBankService implements BaseMemoryService {
       const memory = validatedMemories[index];
       const memoryFact = memoryEntryToFact(memory, index);
 
-      // We don't have customMetadata on MemoryEntry in JS yet, so we pass undefined or handle it if we extend it.
-      // For now, we assume it's not there as per the current interface.
       const memoryMetadata = mergeCustomMetadataForMemory({
         customMetadata: request.customMetadata,
         memory: memory,
@@ -309,6 +312,7 @@ export class VertexAiMemoryBankService implements BaseMemoryService {
       const config = buildCreateMemoryConfig({
         customMetadata: memoryMetadata,
         memoryRevisionLabels,
+        memoryId: memory.id,
       });
 
       const params = {
@@ -366,6 +370,7 @@ export class VertexAiMemoryBankService implements BaseMemoryService {
 function buildCreateMemoryConfig(params: {
   customMetadata?: Record<string, unknown>;
   memoryRevisionLabels?: Record<string, string>;
+  memoryId?: string;
 }): AgentEngineMemoryConfig {
   const config: Record<string, unknown> = {waitForCompletion: false};
 
@@ -428,6 +433,12 @@ function buildCreateMemoryConfig(params: {
     }
   }
 
+  // A memoryId supplied through customMetadata was copied into config above and
+  // takes precedence over the entry's id.
+  if (params.memoryId !== undefined && config['memoryId'] === undefined) {
+    config['memoryId'] = params.memoryId;
+  }
+
   const revisionLabels = {
     ...customRevisionLabels,
     ...params.memoryRevisionLabels,
@@ -585,10 +596,8 @@ function mergeCustomMetadataForMemory(params: {
     Object.assign(mergedMetadata, params.customMetadata);
   }
 
-  // Check if memory has customMetadata (it might if passed by user, even if not in interface)
-  const memoryWithMetadata = params.memory as MemoryEntryWithMetadata;
-  if (memoryWithMetadata.customMetadata) {
-    Object.assign(mergedMetadata, memoryWithMetadata.customMetadata);
+  if (params.memory.customMetadata) {
+    Object.assign(mergedMetadata, params.memory.customMetadata);
   }
 
   if (Object.keys(mergedMetadata).length === 0) {
```

**File**: `core/test/memory/vertex_ai_memory_bank_service_test.ts` (modified, +101/-1)
```diff
@@ -381,6 +381,106 @@ describe('VertexAiMemoryBankService', () => {
       );
     });
 
+    it('forwards the entry id as memoryId', async () => {
+      const memories: MemoryEntry[] = [
+        {id: 'mem-123', content: {parts: [{text: 'fact one'}]}},
+      ];
+
+      await service.addMemory({
+        appName: 'test-app',
+        userId: 'test-user',
+        memories,
+      });
+
+      expect(mockMemories.createInternal).toHaveBeenCalledWith(
+        expect.objectContaining({
+          config: expect.objectContaining({memoryId: 'mem-123'}),
+        }),
+      );
+    });
+
+    it('prefers a request-level memoryId over the entry id', async () => {
+      const memories: MemoryEntry[] = [
+        {id: 'from-entry', content: {parts: [{text: 'fact one'}]}},
+      ];
+
+      await service.addMemory({
+        appName: 'test-app',
+        userId: 'test-user',
+        memories,
+        customMetadata: {memoryId: 'explicit'},
+      });
+
+      expect(mockMemories.createInternal).toHaveBeenCalledWith(
+        expect.objectContaining({
+          config: expect.objectContaining({memoryId: 'explicit'}),
+        }),
+      );
+    });
+
+    it('prefers an entry customMetadata memoryId over the entry id', async () => {
+      const memories: MemoryEntry[] = [
+        {
+          id: 'from-entry-id',
+          content: {parts: [{text: 'fact one'}]},
+          customMetadata: {memoryId: 'from-entry-metadata'},
+        },
+      ];
+
+      await service.addMemory({
+        appName: 'test-app',
+        userId: 'test-user',
+        memories,
+        customMetadata: {memoryId: 'from-request'},
+      });
+
+      expect(mockMemories.createInternal).toHaveBeenCalledWith(
+        expect.objectContaining({
+          config: expect.objectContaining({memoryId: 'from-entry-metadata'}),
+        }),
+      );
+    });
+
+    it('prefers entry customMetadata over the request-level value', async () => {
+      const memories: MemoryEntry[] = [
+        {
+          content: {parts: [{text: 'fact one'}]},
+          customMetadata: {sharedKey: 'from-entry'},
+        },
+      ];
+
+      await service.addMemory({
+        appName: 'test-app',
+        userId: 'test-user',
+        memories,
+        customMetadata: {sharedKey: 'from-request'},
+      });
+
+      expect(mockMemories.createInternal).toHaveBeenCalledWith(
+        expect.objectContaining({
+          config: expect.objectContaining({
+            metadata: {sharedKey: {stringValue: 'from-entry'}},
+          }),
+        }),
+      );
+    });
+
+    it('omits memoryId when the entry sets no id', async () => {
+      const memories: MemoryEntry[] = [
+        {content: {parts: [{text: 'fact one'}]}},
+      ];
+
+      await service.addMemory({
+        appName: 'test-app',
+        userId: 'test-user',
+        memories,
+      });
+
+      const config = mockMemories.createInternal.mock.calls[0][0].config;
+      expect(config).not.toHaveProperty('memoryId');
+      expect(config).toEqual({waitForCompletion: false});
+    });
+
     it('throws error if memories list is empty', async () => {
       await expect(
         service.addMemory({
@@ -707,7 +807,7 @@ describe('VertexAiMemoryBankService', () => {
         {
           content: {parts: [{text: 'fact 1'}]} as Content,
           customMetadata: {entryKey: 'entryValue'},
-        } as unknown as MemoryEntry, // cast to pass customMetadata
+        },
       ];
 
       await service.addMemory({
```

---

### Incident Patch 3: `99269f67` (2026-09-25)
**Commit Message**: fix(models): emit one input transcription on Gemini 3.x Live (#943)

* fix(live): emit one input transcription on Gemini 3.x Live

Gemini 3.x Live sends a single final input transcription, so the
accumulate-then-flush path in LiveResponseAggregator turned one server
message into a partial response and a final response with the same text.
Consumers that append both showed the utterance twice.

Mirror adk-python gemini_llm_connection.py: on a 3.x Flash Live model,
yield one final response and never write the buffer, so the
interrupted/turnComplete flush has nothing to re-emit. Non-3.x models
keep the existing behaviour.

* refactor(live): branch the input transcription values, not the block

Hoist the predicate and vary finished, partial and the buffer write,
instead of forking the whole block and re-indenting the existing path.

**File**: `core/src/utils/live_connection_utils.ts` (modified, +11/-8)
```diff
@@ -102,18 +102,21 @@ export class LiveResponseAggregator {
       }
 
       if (serverContent.inputTranscription) {
-        if (serverContent.inputTranscription.text) {
-          this.inputTranscriptionText += serverContent.inputTranscription.text;
+        // Gemini 3.x Live sends one final input transcription instead of a
+        // stream of partials, so emit it directly rather than buffering.
+        const isGemini3x = isGemini3xLive(this.modelVersion);
+        const {text, finished} = serverContent.inputTranscription;
+        if (text) {
+          if (!isGemini3x) {
+            this.inputTranscriptionText += text;
+          }
           yield {
-            inputTranscription: {
-              text: serverContent.inputTranscription.text,
-              finished: false,
-            },
-            partial: true,
+            inputTranscription: {text, finished: isGemini3x},
+            partial: !isGemini3x,
             ...(this.modelVersion ? {modelVersion: this.modelVersion} : {}),
           };
         }
-        if (serverContent.inputTranscription.finished) {
+        if (finished && !isGemini3x) {
           yield {
             inputTranscription: {
               text: this.inputTranscriptionText,
```

**File**: `core/test/utils/live_connection_utils_test.ts` (modified, +124/-0)
```diff
@@ -376,4 +376,128 @@ describe('LiveResponseAggregator', () => {
       },
     ]);
   });
+
+  it('should yield a single final input transcription for Gemini 3.x', () => {
+    const aggregator = new LiveResponseAggregator(
+      'gemini-3.0-flash-live-preview',
+    );
+
+    const res = Array.from(
+      aggregator.processMessage(
+        liveServerMessage({
+          serverContent: {
+            inputTranscription: {text: 'hello world', finished: true},
+          },
+        }),
+      ),
+    );
+
+    expect(res).toEqual([
+      {
+        inputTranscription: {text: 'hello world', finished: true},
+        partial: false,
+        modelVersion: 'gemini-3.0-flash-live-preview',
+      },
+    ]);
+  });
+
+  it('should mark a Gemini 3.x input transcription final without the finished flag', () => {
+    const aggregator = new LiveResponseAggregator(
+      'gemini-3.0-flash-live-preview',
+    );
+
+    const res = Array.from(
+      aggregator.processMessage(
+        liveServerMessage({
+          serverContent: {inputTranscription: {text: 'hello world'}},
+        }),
+      ),
+    );
+
+    expect(res).toEqual([
+      {
+        inputTranscription: {text: 'hello world', finished: true},
+        partial: false,
+        modelVersion: 'gemini-3.0-flash-live-preview',
+      },
+    ]);
+  });
+
+  it('should yield nothing for a text-less input transcription on Gemini 3.x', () => {
+    const aggregator = new LiveResponseAggregator(
+      'gemini-3.0-flash-live-preview',
+    );
+
+    const res = Array.from(
+      aggregator.processMessage(
+        liveServerMessage({
+          serverContent: {inputTranscription: {finished: true}},
+        }),
+      ),
+    );
+
+    expect(res).toEqual([]);
+  });
+
+  it('should not re-emit input transcription on turnComplete for Gemini 3.x', () => {
+    const aggregator = new LiveResponseAggregator(
+      'gemini-3.0-flash-live-preview',
+    );
+
+    const res1 = Array.from(
+      aggregator.processMessage(
+        liveServerMessage({
+          serverContent: {
+            inputTranscription: {text: 'hello world', finished: true},
+          },
+        }),
+      ),
+    );
+    expect(res1).toEqual([
+      {
+        inputTranscription: {text: 'hello world', finished: true},
+        partial: false,
+        modelVersion: 'gemini-3.0-flash-live-preview',
+      },
+    ]);
+
+    const res2 = Array.from(
+      aggregator.processMessage(
+        liveServerMessage({serverContent: {turnComplete: true}}),
+      ),
+    );
+    expect(res2).toEqual([
+      {
+        turnComplete: true,
+        modelVersion: 'gemini-3.0-flash-live-preview',
+      },
+    ]);
+  });
+
+  it('should still yield partial and final input transcription for non-Gemini 3.x', () => {
+    const aggregator = new LiveResponseAggregator('gemini-2.5-flash');
+
+    const res = Array.from(
+      aggregator.processMessage(
+        liveServerMessage({
+          serverContent: {
+            inputTranscription: {text: 'hello world', finished: true},
+          },
+        }),
+      ),
+    );
+
+    expect(res).toEqual([
+      {
+        inputTranscription: {text: 'hello world', finished: false},
+        partial: true,
+        modelVersion: 'gemini-2.5-flash',
+      },
+      {
+        inputTranscription: {text: 'hello world', finished: true},
+        partial: false,
+        modelVersion: 'gemini-2.5-flash',
+      },
+    ]);
+  });
 });
```

---

### Incident Patch 4: `61f946af` (2026-09-24)
**Commit Message**: fix(core): convert boolean branches in anyOf and type arrays to object schemas (#936)

A JSON Schema boolean (`true` or `false`) is a valid schema wherever a schema
object is valid, so an MCP tool may advertise one as an `anyOf` branch or as a
member of a `type` array. toGeminiSchema treated such a branch as a type name
and crashed with "mcpType.toLowerCase is not a function".

recursiveConvert now normalises every boolean element of the array to an
unconstrained object schema before the collapse logic runs, matching
_sanitize_schema_formats_for_gemini in adk-python.

**File**: `core/src/utils/gemini_schema_util.ts` (modified, +16/-2)
```diff
@@ -58,10 +58,24 @@ export function toGeminiSchema(mcpSchema?: MCPToolSchema): Schema | undefined {
     let isNullable = false;
     let nonNullTypes;
     if (Array.isArray(sourceType)) {
-      nonNullTypes = sourceType.filter(
+      // JSON Schema allows a boolean where a schema is expected: `true` accepts
+      // any value and `false` accepts none. Gemini has no equivalent for
+      // either, so both become an unconstrained object, as adk-python does.
+      // `anyOf` holds schemas while `type` holds type names, hence the two
+      // replacement shapes.
+      const fromAnyOf = Boolean(mcp.anyOf);
+      const branches: MCPTypeArrayItem[] = sourceType.map(
+        (branch: MCPTypeArrayItem | boolean) => {
+          if (typeof branch !== 'boolean') return branch;
+          return fromAnyOf ? {type: 'object'} : 'object';
+        },
+      );
+      mcp = fromAnyOf ? {...mcp, anyOf: branches} : {...mcp, type: branches};
+
+      nonNullTypes = branches.filter(
         (t: MCPTypeArrayItem) => getTypeFromArrayItem(t) !== 'null',
       );
-      isNullable = sourceType.some(
+      isNullable = branches.some(
         (t: MCPTypeArrayItem) => getTypeFromArrayItem(t) === 'null',
       );
 
```

**File**: `core/test/utils/gemini_schema_util_test.ts` (modified, +109/-0)
```diff
@@ -550,6 +550,115 @@ describe('toGeminiSchema', () => {
       ],
     });
   });
+
+  it('converts a boolean true branch inside anyOf to an object schema', () => {
+    const input = {anyOf: [true]} as unknown as MCPToolSchema;
+
+    expect(() => toGeminiSchema(input)).not.toThrow();
+
+    const schema = toGeminiSchema(input);
+
+    expect(schema).toEqual({type: Type.OBJECT, properties: {}});
+  });
+
+  it('converts a boolean false branch inside anyOf to an object schema', () => {
+    const input = {anyOf: [false]} as unknown as MCPToolSchema;
+
+    const schema = toGeminiSchema(input);
+
+    expect(schema).toEqual({type: Type.OBJECT, properties: {}});
+  });
+
+  it('keeps an anyOf with a boolean branch nullable', () => {
+    const input = {anyOf: [true, {type: 'null'}]} as unknown as MCPToolSchema;
+
+    expect(() => toGeminiSchema(input)).not.toThrow();
+
+    const schema = toGeminiSchema(input);
+
+    expect(schema).toEqual({
+      type: Type.OBJECT,
+      nullable: true,
+      properties: {},
+    });
+  });
+
+  it('converts a boolean branch alongside a typed branch', () => {
+    const input = {anyOf: [true, {type: 'string'}]} as unknown as MCPToolSchema;
+
+    const schema = toGeminiSchema(input);
+
+    expect(schema).toEqual({
+      anyOf: [{type: Type.OBJECT, properties: {}}, {type: Type.STRING}],
+    });
+  });
+
+  it('converts every boolean branch of an all-boolean anyOf', () => {
+    const input = {anyOf: [true, false]} as unknown as MCPToolSchema;
+
+    const schema = toGeminiSchema(input);
+
+    expect(schema).toEqual({
+      anyOf: [
+        {type: Type.OBJECT, properties: {}},
+        {type: Type.OBJECT, properties: {}},
+      ],
+    });
+  });
+
+  it('converts a boolean member of a type array', () => {
+    const input = {type: [true]} as unknown as MCPToolSchema;
+
+    expect(() => toGeminiSchema(input)).not.toThrow();
+
+    const schema = toGeminiSchema(input);
+
+    expect(schema).toEqual({type: Type.OBJECT, properties: {}});
+  });
+
+  it('converts a boolean member alongside a named type', () => {
+    const input = {type: [true, 'string']} as unknown as MCPToolSchema;
+
+    expect(() => toGeminiSchema(input)).not.toThrow();
+
+    const schema = toGeminiSchema(input);
+
+    expect(schema).toEqual({
+      anyOf: [{type: Type.OBJECT, properties: {}}, {type: Type.STRING}],
+    });
+  });
+
+  it('converts a boolean branch on a nested property', () => {
+    const input: MCPToolSchema = {
+      type: 'object',
+      properties: {a: {anyOf: [true]}},
+    };
+
+    expect(() => toGeminiSchema(input)).not.toThrow();
+
+    const schema = toGeminiSchema(input);
+
+    expect(schema).toEqual({
+      type: Type.OBJECT,
+      properties: {a: {type: Type.OBJECT, properties: {}}},
+    });
+  });
+
+  it('converts a boolean branch inside array items', () => {
+    const input = {
+      type: 'array',
+      items: {anyOf: [true]},
+    } as unknown as MCPToolSchema;
+
+    expect(() => toGeminiSchema(input)).not.toThrow();
+
+    const schema = toGeminiSchema(input);
+
+    expect(schema).toEqual({
+      type: Type.ARRAY,
+      items: {type: Type.OBJECT, properties: {}},
+    });
+  });
 });
 
 describe('openApiSchemaToGeminiSchema', () => {
```

---

### Incident Patch 5: `e758e3f3` (2026-09-24)
**Commit Message**: fix(artifacts): stringify GcsArtifactService customMetadata values (#935)

* fix(artifacts): stringify GcsArtifactService customMetadata values

Google Cloud Storage object custom metadata is a map<string, string>, so a
number or a boolean value is not storable. adk-python coerces every value
with str() before the upload; adk-js passed the caller's map through
verbatim.

The GCS test double stored any value, so the shared suite passed on a
permissive fake. The fake now rejects a non-string value the way real GCS
does, and the shared suite expects stringified values for that backend.

* test(artifacts): fold the metadata expectation into a boolean parameter

The options interface and its module-level helper were 33 lines of
scaffolding for one boolean. A boolean parameter and a local closure keep
the identity-when-false semantics and return the assertion sites to one
line.

**File**: `core/src/artifacts/gcs_artifact_service.ts` (modified, +17/-3)
```diff
@@ -67,9 +67,7 @@ export class GcsArtifactService implements BaseArtifactService {
       }),
     );
 
-    const customMetadata: Record<string, unknown> = {
-      ...request.customMetadata,
-    };
+    const customMetadata = stringifyMetadataValues(request.customMetadata);
 
     if (request.artifact.inlineData) {
       if (request.artifact.inlineData.displayName) {
@@ -310,6 +308,22 @@ function getFileName({
   return version !== undefined ? `${prefix}/${version}` : prefix;
 }
 
+/**
+ * Coerces every custom metadata value to a string, mirroring
+ * `adk-python`'s GCS artifact service. GCS object custom metadata is a
+ * `map<string, string>`, so a number or a boolean is not a storable value.
+ */
+function stringifyMetadataValues(
+  customMetadata: Record<string, unknown> | undefined,
+): Record<string, string> {
+  return Object.fromEntries(
+    Object.entries(customMetadata ?? {}).map(([key, value]) => [
+      key,
+      String(value),
+    ]),
+  );
+}
+
 function extractArtifactKeys(
   files: File[],
   fileNamePrefix: string,
```

**File**: `core/test/artifacts/artifact_service_test_utils.ts` (modified, +14/-7)
```diff
@@ -13,16 +13,21 @@ import {afterEach, beforeEach, describe, expect, it} from 'vitest';
  *
  * @param createService A function that returns a promise that resolves to the artifact service.
  * @param cleanup A function that returns a promise that cleans up the artifact service.
- * @param suiteName The name of the test suite.
+ * @param stringifiesCustomMetadata Set for backends whose storage accepts only string metadata values (e.g. GCS).
  */
 export function runArtifactServiceTests(
   createService: () => Promise<BaseArtifactService>,
   cleanup: () => Promise<void>,
+  stringifiesCustomMetadata = false,
 ) {
   let service: BaseArtifactService;
   const appName = 'test-app';
   const userId = 'test-user';
   const sessionId = 'test-session';
+  const expectMeta = (m: Record<string, unknown>) =>
+    stringifiesCustomMetadata
+      ? Object.fromEntries(Object.entries(m).map(([k, v]) => [k, String(v)]))
+      : m;
 
   beforeEach(async () => {
     service = await createService();
@@ -356,7 +361,9 @@ export function runArtifactServiceTests(
       });
 
       expect(versionMetadata).toBeDefined();
-      expect(versionMetadata?.customMetadata).toMatchObject(customMetadata);
+      expect(versionMetadata?.customMetadata).toMatchObject(
+        expectMeta(customMetadata),
+      );
     });
   });
 
@@ -389,9 +396,9 @@ export function runArtifactServiceTests(
 
       expect(versions).toHaveLength(2);
       expect(versions[0].version).toBe(0);
-      expect(versions[0].customMetadata).toMatchObject({v: 1});
+      expect(versions[0].customMetadata).toMatchObject(expectMeta({v: 1}));
       expect(versions[1].version).toBe(1);
-      expect(versions[1].customMetadata).toMatchObject({v: 2});
+      expect(versions[1].customMetadata).toMatchObject(expectMeta({v: 2}));
     });
 
     it('returns empty list for non-existent artifact', async () => {
@@ -432,7 +439,7 @@ export function runArtifactServiceTests(
         filename,
         version: 0,
       });
-      expect(v0?.customMetadata).toMatchObject({v: 1});
+      expect(v0?.customMetadata).toMatchObject(expectMeta({v: 1}));
 
       const v1 = await service.getArtifactVersion({
         appName,
@@ -441,15 +448,15 @@ export function runArtifactServiceTests(
         filename,
         version: 1,
       });
-      expect(v1?.customMetadata).toMatchObject({v: 2});
+      expect(v1?.customMetadata).toMatchObject(expectMeta({v: 2}));
 
       const latest = await service.getArtifactVersion({
         appName,
         userId,
         sessionId,
         filename,
       });
-      expect(latest?.customMetadata).toMatchObject({v: 2});
+      expect(latest?.customMetadata).toMatchObject(expectMeta({v: 2}));
     });
 
     it('returns undefined for non-existent version', async () => {
```

**File**: `core/test/artifacts/gcs_artifact_service_test.ts` (modified, +84/-1)
```diff
@@ -22,9 +22,17 @@ const {StorageMock, storageMock} = vi.hoisted(() => {
         metadata?: {contentType?: string; metadata?: Record<string, unknown>};
       },
     ): Promise<void> {
+      const metadata = options?.metadata?.metadata ?? {};
+      for (const [key, value] of Object.entries(metadata)) {
+        if (typeof value !== 'string') {
+          throw new TypeError(
+            `GCS custom metadata values must be strings; got ${typeof value} for key "${key}"`,
+          );
+        }
+      }
       this.bucket.files.set(this.name, {
         data: Buffer.isBuffer(data) ? data : Buffer.from(data),
-        metadata: options?.metadata?.metadata || {},
+        metadata,
         contentType: options?.metadata?.contentType ?? options?.contentType,
       });
     }
@@ -118,6 +126,7 @@ describe('GcsArtifactService', () => {
     async () => {
       storageMock.buckets.clear();
     },
+    true,
   );
 
   describe('customMetadata GCS shape', () => {
@@ -176,6 +185,80 @@ describe('GcsArtifactService', () => {
       expect(loaded?.fileData).toBeUndefined();
       expect(loaded?.text).toBe('actual note content');
     });
+
+    it('stringifies non-string customMetadata values, matching adk-python', async () => {
+      storageMock.buckets.clear();
+      const service = new GcsArtifactService(bucketName);
+
+      const version = await service.saveArtifact({
+        appName: 'test-app',
+        userId: 'test-user',
+        sessionId: 'test-session',
+        filename: 'counted.txt',
+        artifact: {text: 'hello'},
+        customMetadata: {count: 123, enabled: true, label: 'x'},
+      });
+
+      const entry = storageMock
+        .bucket(bucketName)
+        .files.get('test-app/test-user/test-session/counted.txt/0');
+      expect(entry?.metadata).toEqual({
+        count: '123',
+        enabled: 'true',
+        label: 'x',
+        adkIsText: 'true',
+      });
+
+      const versionMetadata = await service.getArtifactVersion({
+        appName: 'test-app',
+        userId: 'test-user',
+        sessionId: 'test-session',
+        filename: 'counted.txt',
+        version,
+      });
+      expect(versionMetadata?.customMetadata).toMatchObject({
+        count: '123',
+        enabled: 'true',
+        label: 'x',
+      });
+    });
+
+    it('stringifies customMetadata on the fileData path', async () => {
+      storageMock.buckets.clear();
+      const service = new GcsArtifactService(bucketName);
+
+      await service.saveArtifact({
+        appName: 'test-app',
+        userId: 'test-user',
+        sessionId: 'test-session',
+        filename: 'report.pdf',
+        artifact: {
+          fileData: {
+            fileUri: 'gs://my-bucket/report.pdf',
+            mimeType: 'application/pdf',
+          },
+        },
+        customMetadata: {retries: 0},
+      });
+
+      const entry = storageMock
+        .bucket(bucketName)
+        .files.get('test-app/test-user/test-session/report.pdf/0');
+      expect(entry?.metadata['retries']).toBe('0');
+      expect(entry?.metadata['adkFileUri']).toBe('gs://my-bucket/report.pdf');
+      expect(entry?.metadata['adkFileMimeType']).toBe('application/pdf');
+    });
+
+    it('the fake bucket rejects non-string metadata values, as real GCS does', async () => {
+      storageMock.buckets.clear();
+
+      await expect(
+        storageMock
+          .bucket(bucketName)
+          .file('x')
+          .save('data', {metadata: {metadata: {n: 123}}}),
+      ).rejects.toThrow(TypeError);
+    });
   });
 
   describe('fileData GCS metadata', () => {
```

---

### Incident Patch 6: `f3155709` (2026-09-24)
**Commit Message**: fix(core): make safeStringify total in content_processor_utils (#934)

* fix(core): make safeStringify total

safeStringify renders foreign-agent tool payloads into LLM-facing text, so
it must always produce a string. It did neither reliably.

JSON.stringify is declared to return string but returns undefined when a
value's toJSON returns nothing, so the literal text "undefined" reached the
model. The String fallback also throws on a null-prototype object or a
hostile toString, and that TypeError escaped getContents.

Guard the JSON.stringify result with a typeof check and wrap the String
fallback, returning '<unstringifiable value>' when both conversions fail.
A plain circular object still renders [object Object], unchanged.

* docs(core): attribute each failure mode to its own conversion

JSON.stringify and String fail on disjoint inputs. The doc comment
grouped all four inputs under both functions, which the null-prototype
test contradicts: JSON.stringify serializes that object fine.

**File**: `core/src/agents/processors/content_processor_utils.ts` (modified, +19/-3)
```diff
@@ -26,6 +26,9 @@ import {
   REQUEST_INPUT_FUNCTION_CALL_NAME,
 } from '../functions.js';
 
+/** Returned by {@link safeStringify} when a value defeats every conversion. */
+const UNSTRINGIFIABLE_VALUE = '<unstringifiable value>';
+
 /**
  * Removes the client-generated function call IDs from a given content object.
  *
@@ -613,16 +616,29 @@ function rearrangeEventsForAsyncFunctionResponsesInHistory(
 }
 
 /**
- * Safely stringifies an object, handling circular references.
+ * Safely stringifies a value for inclusion in LLM-facing text.
+ *
+ * Always returns a string and never throws. `JSON.stringify` is typed as
+ * returning `string` but yields `undefined` when `toJSON` yields nothing, and
+ * it throws on a cycle or a BigInt. `String` throws on a null-prototype object
+ * or a throwing `toString`.
  */
 function safeStringify(obj: unknown): string {
   if (typeof obj === 'string') {
     return obj;
   }
   try {
-    return JSON.stringify(obj);
-  } catch (_e: unknown) {
+    const json = JSON.stringify(obj);
+    if (typeof json === 'string') {
+      return json;
+    }
+  } catch {
+    // Falls through to `String`, which renders a cycle as `[object Object]`.
+  }
+  try {
     return String(obj);
+  } catch {
+    return UNSTRINGIFIABLE_VALUE;
   }
 }
 
```

**File**: `core/test/agents/processors/content_processor_utils_test.ts` (modified, +95/-0)
```diff
@@ -105,6 +105,101 @@ describe('getContents', () => {
     expect(textPart?.text).toContain('[object Object]');
   });
 
+  it('should not render the text "undefined" when toJSON returns nothing', () => {
+    const args: Record<string, unknown> = {toJSON: () => undefined};
+
+    const event = createEvent({
+      author: 'other_agent',
+      content: {
+        role: 'model',
+        parts: [{functionCall: {name: 'to_json_nothing_tool', args}}],
+      },
+    });
+
+    const contents = getContents([event], 'current_agent');
+
+    const textPart = contents[0].parts?.find((p) =>
+      p.text?.includes('to_json_nothing_tool'),
+    );
+    expect(textPart?.text).toBe(
+      '[other_agent] called tool `to_json_nothing_tool` with parameters: [object Object]',
+    );
+  });
+
+  it('should serialize a null-prototype argument object', () => {
+    const args: Record<string, unknown> = Object.create(null);
+    args['a'] = 1;
+
+    const event = createEvent({
+      author: 'other_agent',
+      content: {
+        role: 'model',
+        parts: [{functionCall: {name: 'null_proto_tool', args}}],
+      },
+    });
+
+    const contents = getContents([event], 'current_agent');
+
+    const textPart = contents[0].parts?.find((p) =>
+      p.text?.includes('null_proto_tool'),
+    );
+    expect(textPart?.text).toBe(
+      '[other_agent] called tool `null_proto_tool` with parameters: {"a":1}',
+    );
+  });
+
+  it('should not throw on a circular null-prototype argument object', () => {
+    const args: Record<string, unknown> = Object.create(null);
+    args['self'] = args;
+
+    const event = createEvent({
+      author: 'other_agent',
+      content: {
+        role: 'model',
+        parts: [{functionCall: {name: 'null_proto_circular_tool', args}}],
+      },
+    });
+
+    expect(() => getContents([event], 'current_agent')).not.toThrow();
+
+    const contents = getContents([event], 'current_agent');
+    const textPart = contents[0].parts?.find((p) =>
+      p.text?.includes('null_proto_circular_tool'),
+    );
+    expect(textPart?.text).toBe(
+      '[other_agent] called tool `null_proto_circular_tool` with parameters: <unstringifiable value>',
+    );
+  });
+
+  it('should not throw when both toJSON and toString throw', () => {
+    const response: Record<string, unknown> = {
+      toJSON: () => {
+        throw new Error('toJSON failed');
+      },
+      toString: () => {
+        throw new Error('toString failed');
+      },
+    };
+
+    const event = createEvent({
+      author: 'other_agent',
+      content: {
+        role: 'model',
+        parts: [{functionResponse: {name: 'hostile_tool', response}}],
+      },
+    });
+
+    expect(() => getContents([event], 'current_agent')).not.toThrow();
+
+    const contents = getContents([event], 'current_agent');
+    const textPart = contents[0].parts?.find((p) =>
+      p.text?.includes('hostile_tool'),
+    );
+    expect(textPart?.text).toBe(
+      '[other_agent] tool `hostile_tool` returned result: <unstringifiable value>',
+    );
+  });
+
   it('should rearrange basic function call and response events correctly', () => {
     const e0 = createEvent({
       author: 'user',
```

---

### Incident Patch 7: `78fdaf46` (2026-09-23)
**Commit Message**: fix(memory): keep tool and code execution events in Memory Bank writes (#930)

An event whose parts carry only a functionCall, functionResponse,
executableCode, codeExecutionResult, toolCall or toolResponse was treated
as empty and dropped before reaching memories.generateInternal. The write
path now accepts the same nine part fields as _should_filter_out_event in
adk-python, so what the agent did reaches memory alongside what it said.

**File**: `core/src/memory/vertex_ai_memory_bank_service.ts` (modified, +15/-1)
```diff
@@ -58,9 +58,23 @@ const CREATE_MEMORY_KNOWN_FIELDS = [
 const ENABLE_CONSOLIDATION_KEY = 'enable_consolidation';
 const MAX_DIRECT_MEMORIES_PER_GENERATE_CALL = 5;
 
+/**
+ * Reports whether an event carries nothing worth writing to memory. The part
+ * fields below mirror `_should_filter_out_event` in adk-python's
+ * `memory/vertex_ai_memory_bank_service.py`.
+ */
 function shouldFilterOutEvent(content?: Content): boolean {
   return !(content?.parts || []).some(
-    (p) => p.text || p.inlineData || p.fileData,
+    (p) =>
+      p.text ||
+      p.inlineData ||
+      p.fileData ||
+      p.functionCall ||
+      p.functionResponse ||
+      p.executableCode ||
+      p.codeExecutionResult ||
+      p.toolCall ||
+      p.toolResponse,
   );
 }
 
```

**File**: `core/test/memory/vertex_ai_memory_bank_service_test.ts` (modified, +107/-1)
```diff
@@ -11,10 +11,11 @@ import {
   Event,
   getLogger,
   MemoryEntry,
+  Session,
   VertexAiMemoryBankService,
   VertexAiMemoryBankServiceOptions,
 } from '@google/adk';
-import {Content, Part} from '@google/genai';
+import {Content, Language, Outcome, Part, ToolType} from '@google/genai';
 import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
 
 const clientConstructor = vi.hoisted(() => vi.fn());
@@ -35,6 +36,16 @@ afterEach(() => {
   clientConstructor.mockClear();
 });
 
+function sessionWithEvents(events: Event[]): Session {
+  return createSession({
+    id: 'test-session-id',
+    appName: 'test-app',
+    userId: 'test-user',
+    events,
+    lastUpdateTime: Date.now(),
+  });
+}
+
 describe('VertexAiMemoryBankService', () => {
   let service: VertexAiMemoryBankService;
   let mockMemories: {
@@ -203,6 +214,101 @@ describe('VertexAiMemoryBankService', () => {
 
       expect(mockMemories.generateInternal).not.toHaveBeenCalled();
     });
+
+    it.each<[string, Part]>([
+      ['functionCall', {functionCall: {name: 'test_function', args: {}}}],
+      [
+        'functionResponse',
+        {functionResponse: {name: 'test_function', response: {result: 'ok'}}},
+      ],
+      [
+        'executableCode',
+        {executableCode: {code: 'print(1)', language: Language.PYTHON}},
+      ],
+      [
+        'codeExecutionResult',
+        {codeExecutionResult: {outcome: Outcome.OUTCOME_OK, output: '1'}},
+      ],
+      [
+        'toolCall',
+        {
+          toolCall: {
+            id: 'tool-call-id',
+            toolType: ToolType.GOOGLE_SEARCH_WEB,
+            args: {query: 'adk'},
+          },
+        },
+      ],
+      [
+        'toolResponse',
+        {
+          toolResponse: {
+            id: 'tool-call-id',
+            toolType: ToolType.GOOGLE_SEARCH_WEB,
+            response: {result: 'ok'},
+          },
+        },
+      ],
+    ])('forwards an event whose only part is a %s', async (_, part) => {
+      const session = sessionWithEvents([
+        createEvent({
+          author: 'agent',
+          content: {parts: [part]},
+          timestamp: Date.now(),
+        }),
+      ]);
+
+      await service.addSessionToMemory(session);
+
+      expect(mockMemories.generateInternal).toHaveBeenCalledWith(
+        expect.objectContaining({
+          directContentsSource: {events: [{content: {parts: [part]}}]},
+        }),
+      );
+    });
+
+    it('keeps a text event and a function call event, and drops the event without content', async () => {
+      const session = sessionWithEvents([
+        createEvent({
+          author: 'user',
+          content: {parts: [{text: 'test_content'}]},
+          timestamp: Date.now(),
+        }),
+        createEvent({author: 'user', timestamp: Date.now()}),
+        createEvent({
+          author: 'agent',
+          content: {parts: [{functionCall: {name: 'test_function'}}]},
+          timestamp: Date.now(),
+        }),
+      ]);
+
+      await service.addSessionToMemory(session);
+
+      expect(mockMemories.generateInternal).toHaveBeenCalledWith(
+        expect.objectContaining({
+          directContentsSource: {
+            events: [
+              {content: {parts: [{text: 'test_content'}]}},
+              {content: {parts: [{functionCall: {name: 'test_function'}}]}},
+            ],
+          },
+        }),
+      );
+    });
+
+    it('still filters out an event whose only part is a thought', async () => {
+      const session = sessionWithEvents([
+        createEvent({
+          author: 'agent',
+          content: {parts: [{thought: true}]},
+          timestamp: Date.now(),
+        }),
+      ]);
+
+      await service.addSessionToMemory(session);
+
+      expect(mockMemories.generateInternal).not.toHaveBeenCalled();
+    });
   });
 
   describe('addEventsToMemory', () => {
```

---

### Incident Patch 8: `8162dbc2` (2026-09-23)
**Commit Message**: fix(cli): await the command promise in the adk entrypoint (#929)

Every action handler in cli.ts is async, so parse() dropped the promise
it built and the entrypoint's try/catch could never see a rejection. A
failing command reached Node's unhandled-rejection path instead of the
intended console.error. parseAsync() returns that promise, so a chained
.catch() reports the error the way the entrypoint always meant to.

A top-level await is not an option here: dev/build.js runs an esbuild cjs
pass, which rejects top-level await.

**File**: `dev/src/cli_entrypoint.ts` (modified, +6/-6)
```diff
@@ -6,9 +6,9 @@
  */
 import {createProgram} from './cli/cli.js';
 
-try {
-  createProgram().parse(process.argv);
-} catch (e) {
-  console.error(e);
-  process.exitCode = 1;
-}
+createProgram()
+  .parseAsync(process.argv)
+  .catch((e: unknown) => {
+    console.error(e);
+    process.exitCode = 1;
+  });
```

**File**: `dev/test/cli_entrypoint_test.ts` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+/**
+ * @license
+ * Copyright 2026 Google LLC
+ * SPDX-License-Identifier: Apache-2.0
+ */
+
+import {Command} from 'commander';
+import {
+  afterEach,
+  beforeEach,
+  describe,
+  expect,
+  it,
+  MockInstance,
+  vi,
+} from 'vitest';
+
+const {createProgramMock} = vi.hoisted(() => ({
+  createProgramMock: vi.fn<() => Command>(),
+}));
+
+vi.mock('../src/cli/cli', () => ({createProgram: createProgramMock}));
+
+/**
+ * Runs the entrypoint module for its import side effect.
+ *
+ * The extra `setImmediate` hop lets the `.catch()` microtask settle and lets
+ * Node report an `unhandledRejection` if the entrypoint dropped the promise.
+ */
+async function runEntrypoint(args: string[]): Promise<void> {
+  process.argv = ['node', 'adk', ...args];
+  vi.resetModules();
+  await import('../src/cli_entrypoint.js');
+  await new Promise((resolve) => setImmediate(resolve));
+}
+
+describe('cli_entrypoint', () => {
+  let errorSpy: MockInstance<typeof console.error>;
+  let unhandled: unknown[];
+  let originalArgv: string[];
+  let originalExitCode: typeof process.exitCode;
+
+  const onUnhandled = (reason: unknown) => {
+    unhandled.push(reason);
+  };
+
+  beforeEach(() => {
+    originalArgv = process.argv;
+    originalExitCode = process.exitCode;
+    process.exitCode = undefined;
+    unhandled = [];
+    process.on('unhandledRejection', onUnhandled);
+    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
+  });
+
+  afterEach(() => {
+    process.off('unhandledRejection', onUnhandled);
+    process.argv = originalArgv;
+    process.exitCode = originalExitCode;
+    vi.restoreAllMocks();
+    vi.resetModules();
+  });
+
+  it('reports a rejecting action through the catch handler', async () => {
+    const failure = new Error('web command failed');
+    const program = new Command('adk');
+    program.command('web').action(async () => {
+      throw failure;
+    });
+    createProgramMock.mockReturnValue(program);
+
+    await runEntrypoint(['web']);
+
+    expect(errorSpy).toHaveBeenCalledWith(failure);
+    expect(process.exitCode).toBe(1);
+    expect(unhandled).toEqual([]);
+  });
+
+  it('does not report anything when the action resolves', async () => {
+    const action = vi.fn(async () => {});
+    const program = new Command('adk');
+    program.command('web').action(action);
+    createProgramMock.mockReturnValue(program);
+
+    await runEntrypoint(['web']);
+
+    expect(action).toHaveBeenCalledOnce();
+    expect(errorSpy).not.toHaveBeenCalled();
+  });
+
+  it('reports a synchronous parse failure through the catch handler', async () => {
+    const program = new Command('adk');
+    program.exitOverride().configureOutput({writeErr: () => {}});
+    program.command('web').action(async () => {});
+    createProgramMock.mockReturnValue(program);
+
+    await runEntrypoint(['web', '--nope']);
+
+    expect(errorSpy).toHaveBeenCalledWith(
+      expect.objectContaining({code: 'commander.unknownOption'}),
+    );
+  });
+
+  it('does not report an error when commander exits for --help', async () => {
+    const program = new Command('adk');
+    program.configureOutput({writeOut: () => {}, writeErr: () => {}});
+    program.command('web').action(async () => {});
+    createProgramMock.mockReturnValue(program);
+    const exitSpy = vi
+      .spyOn(process, 'exit')
+      .mockImplementation(vi.fn<typeof process.exit>());
+
+    await runEntrypoint(['--help']);
+
+    expect(exitSpy).toHaveBeenCalledWith(0);
+    expect(errorSpy).not.toHaveBeenCalled();
+  });
+});
```

---

### Incident Patch 9: `96e7df68` (2026-09-23)
**Commit Message**: fix(core): drop no-unused-vars suppressions from BasePlugin default callbacks (#928)

* fix(core): drop no-unused-vars suppressions from BasePlugin default callbacks

The 15 default lifecycle callbacks each carried an
`// eslint-disable-next-line @typescript-eslint/no-unused-vars` directive
above the method, because the deliberate no-op body never reads its `params`
argument. The repo's ESLint config already sanctions the real fix through
`argsIgnorePattern: "^_"`, so the parameter is now named `_params` and every
directive is gone.

TypeDoc validates dotted `@param` names against the actual parameter, and
`docs:check` treats a warning as an error, so the 34 `@param params.<field>`
tags are retagged in the same hunks. Runtime behaviour, exported symbols and
method arity are unchanged.

* docs(core): keep the onEventCallback guidance free of the base-class parameter name

An override binds its own argument name, so the `@returns` prose now points at
the incoming `event` instead of the base class's ignored `_params`.

**File**: `core/src/plugins/base_plugin.ts` (modified, +52/-67)
```diff
@@ -130,14 +130,13 @@ export abstract class BasePlugin {
    * This callback helps logging and modifying the user message before the
    * runner starts the invocation.
    *
-   * @param params.invocationContext The context for the entire invocation.
-   * @param params.userMessage The message content input by user.
+   * @param _params.invocationContext The context for the entire invocation.
+   * @param _params.userMessage The message content input by user.
    * @returns An optional `Content` to be returned to the ADK. Returning a
    *     value to replace the user message. Returning `undefined` to proceed
    *     normally.
    */
-  // eslint-disable-next-line @typescript-eslint/no-unused-vars
-  async onUserMessageCallback(params: {
+  async onUserMessageCallback(_params: {
     invocationContext: InvocationContext;
     userMessage: Content;
   }): Promise<Content | undefined> {
@@ -150,14 +149,13 @@ export abstract class BasePlugin {
    * This is the first callback to be called in the lifecycle, ideal for global
    * setup or initialization tasks.
    *
-   * @param params.invocationContext The context for the entire invocation, containing
+   * @param _params.invocationContext The context for the entire invocation, containing
    *     session information, the root agent, etc.
    * @returns An optional `Event` to be returned to the ADK. Returning a value
    *     to halt execution of the runner and ends the runner with that event.
    *     Return `undefined` to proceed normally.
    */
-  // eslint-disable-next-line @typescript-eslint/no-unused-vars
-  async beforeRunCallback(params: {
+  async beforeRunCallback(_params: {
     invocationContext: InvocationContext;
   }): Promise<Content | undefined> {
     return;
@@ -169,16 +167,15 @@ export abstract class BasePlugin {
    * This is the ideal place to make modification to the event before the event
    * is handled by the underlying agent app.
    *
-   * @param params.invocationContext The context for the entire invocation.
-   * @param params.event The event raised by the runner.
+   * @param _params.invocationContext The context for the entire invocation.
+   * @param _params.event The event raised by the runner.
    * @returns An optional value. A non-`undefined` return may be used by the
-   *     framework to modify or replace the response. Copy `params.event` when
-   *     constructing a replacement to preserve fields that are not being
-   *     modified, such as event actions. Returning `undefined` allows the
+   *     framework to modify or replace the response. Copy the incoming
+   *     `event` when constructing a replacement to preserve fields that are not
+   *     being modified, such as event actions. Returning `undefined` allows the
    *     original response to be used.
    */
-  // eslint-disable-next-line @typescript-eslint/no-unused-vars
-  async onEventCallback(params: {
+  async onEventCallback(_params: {
     invocationContext: InvocationContext;
     event: Event;
   }): Promise<Event | undefined> {
@@ -191,11 +188,10 @@ export abstract class BasePlugin {
    * This is the final callback in the ADK lifecycle, suitable for cleanup,
    * final logging, or reporting tasks.
    *
-   * @param params.invocationContext The context for the entire invocation.
+   * @param _params.invocationContext The context for the entire invocation.
    * @returns undefined
    */
-  // eslint-disable-next-line @typescript-eslint/no-unused-vars
-  async afterRunCallback(params: {
+  async afterRunCallback(_params: {
     invocationContext: InvocationContext;
   }): Promise<void> {
     return;
@@ -207,14 +203,13 @@ export abstract class BasePlugin {
    * This callback can be used for logging, setup, or to short-circuit the
    * agent's execution by returning a value.
    *
-   * @param params.agent The agent that is about to run.
-   * @param params.callbackContext The context for the agent invocation.
+   * @param _params.agent The agent that is ab
```

---

### Incident Patch 10: `cbd2f1c0` (2026-09-23)
**Commit Message**: fix(cli): seed the interactive Vertex region prompt from --region in adk create (#926)

**File**: `dev/src/cli/cli_create.ts` (modified, +1/-1)
```diff
@@ -259,7 +259,7 @@ export async function createAgent(options: AgentCreationOptions) {
 
     if (backend === 'vertex') {
       const defaultProject = await getGcpProject();
-      const defaultRegion = await getGcpRegion();
+      const defaultRegion = options.region || (await getGcpRegion());
 
       const projectResponse: symbol | string = options.forceYes
         ? defaultProject
```

**File**: `dev/test/cli/cli_create_test.ts` (modified, +31/-0)
```diff
@@ -283,6 +283,37 @@ describe('createAgent', () => {
 
       expect(saveToFile).not.toHaveBeenCalled();
     });
+
+    it('should seed the region prompt with the --region value', async () => {
+      (select as Mock).mockResolvedValueOnce('gemini-2.5-flash'); // Model
+      (select as Mock).mockResolvedValueOnce('ts'); // Language
+      (select as Mock).mockResolvedValueOnce('vertex'); // Backend
+
+      // gcloud and the environment offer a different region, so the assertion
+      // below can only pass if the flag wins.
+      vi.stubEnv('GOOGLE_CLOUD_LOCATION', '');
+      (execSync as Mock).mockImplementation((cmd: string) => {
+        if (cmd.includes('project')) return 'gcloud-project\n';
+        if (cmd.includes('region')) return 'gcloud-region\n';
+        return '';
+      });
+
+      (text as Mock).mockResolvedValueOnce('gcloud-project'); // Project
+      (text as Mock).mockResolvedValueOnce('europe-west4'); // Region
+
+      await createAgent({...getFreshOptions(), region: 'europe-west4'});
+
+      expect(text).toHaveBeenCalledWith(
+        expect.objectContaining({
+          message: 'Enter the Google Cloud Region',
+          initialValue: 'europe-west4',
+        }),
+      );
+      expect(execSync).not.toHaveBeenCalledWith(
+        'gcloud config get-value compute/region',
+        expect.anything(),
+      );
+    });
   });
 
   describe('Folder Handling', () => {
```

#### Recent Merged Pull Requests:
- **PR #962** (2026-09-29): feat(mcp): send ADK tracking headers on MCP HTTP requests (@ScottMansfield)
- **PR #949** (2026-09-25): docs(planners): add a planners guide and a runnable sample (@ScottMansfield)
- **PR #948** (2026-09-25): feat(agents): add planner support to LlmAgent (@ScottMansfield)
- **PR #947** (2026-09-25): feat(memory): forward MemoryEntry.id as the Vertex memoryId and declare customMetadata (@adk-foundry-bot)
- **PR #946** (2026-09-25): test(cli): fail loudly when two agent_loader tests compile to the same fixture path (@adk-foundry-bot)
- **PR #945** (2026-09-25): feat(tools): add tool_context module aliasing ToolContext to Context (@adk-foundry-bot)
- **PR #944** (2026-09-25): feat(core): export the logger facade from the @google/adk public API (@adk-foundry-bot)
- **PR #943** (2026-09-25): fix(models): emit one input transcription on Gemini 3.x Live (@adk-foundry-bot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
