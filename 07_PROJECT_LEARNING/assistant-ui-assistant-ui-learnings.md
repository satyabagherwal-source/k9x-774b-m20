> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/assistant-ui-assistant-ui-learnings.md`  
> **Source**: github ([https://github.com/assistant-ui/assistant-ui](https://github.com/assistant-ui/assistant-ui))  
> **Source Version**: `c015c32a`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-23T11:11:43.420Z  
> **Learning ID**: `learn-github-assistant-ui-assistant-ui`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): assistant-ui/assistant-ui

> **Canonical Artifact**: `07_PROJECT_LEARNING/assistant-ui-assistant-ui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/assistant-ui/assistant-ui](https://github.com/assistant-ui/assistant-ui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-23T11:11:41.995Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `assistant-ui/assistant-ui`
- **Description**: Typescript/React Library for AI Chat 💬🚀
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 12691 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `api-surface/assistant-ui__core.ts`
```
import { StandardSchemaV1 } from "@standard-schema/spec";

import { JSONSchema7 } from "json-schema";

import { ComponentType, FC, PropsWithChildren, ReactNode, RefObject } from "react";

interface ScopeRegistry {
    threads: ThreadsClientSchema;
    threadListItem: ThreadListItemClientSchema;
    thread: ThreadClientSchema;
    message: MessageClientSchema;
    part: PartClientSchema;
    composer: ComposerClientSchema;
    attachment: AttachmentClientSchema;
    modelContext: ModelContextClientSchema;
    suggestions: SuggestionsClientSchema;
    suggestion: SuggestionClientSchema;
    chainOfThought: ChainOfThoughtClientSchema;
    queueItem: QueueItemClientSchema;
    task: TaskClientSchema;
}

interface ScopeRegistry {
    tools: ToolsClientSchema;
    dataRenderers: DataRenderersClientSchema;
    interactables: InteractablesClientSchema;
    unstable_interactables: Unstable_InteractablesClientSchema;
}

type AbortableThreadLoadOptions = {
  purpose?: AbortableThreadLoadPurpose;
  load: (signal: AbortSignal) => Promise<void>;
  onSettled: () => void;
  onInitialError: (error: unknown) => void;
};

type AbortableThreadLoadPurpose = "initial" | "reload";

type AddMessageCommand = {
  readonly type: "add-message";
  readonly message: UserMessage | AssistantMessage;
  readonly parentId: string | null;
  readonly sourceId: string | null;
};

type AddToolResultCommand = {
  readonly type: "add-tool-result";
  readonly toolCallId: string;
  readonly toolName: string;
  readonly result: ReadonlyJSONValue;
  readonly isError: boolean;
  readonly artifact?: ReadonlyJSONValue;
  readonly modelContent?: readonly ToolModelContentPart[];
};

type AddToolResultCommand$1 = {
  readonly type: "add-tool-result";
  readonly toolCallId: string;
  readonly toolName: string;
  readonly result: ReadonlyJSONValue;
  readonly isError: boolean;
  readonly artifact?: ReadonlyJSONValue;
  readonly modelContent?: readonly ToolModelContentPart[];
};

type AddToolResultOptions = {
  messageId: string;
  toolName: string;
  toolCallId: string;
  result: ReadonlyJSONValue;
  isError: boolean;
  artifact?: ReadonlyJSONValue | undefined;
  modelContent?: readonly ToolModelContentPart[] | undefined;
};

type AncestorsOf<K extends ClientNames, Seen extends ClientNames = never> = K extends Seen ? never : ParentOf<K> extends never ? never : ParentOf<K> | AncestorsOf<ParentOf<K>, Seen | K>;

type AppendMessage = Omit<ThreadMessage, "id"> & {
  parentId: string | null;
  sourceId: string | null;
  runConfig: RunConfig | undefined;
  startRun?: boolean | undefined;
  steer?: boolean | undefined;
};

type AsNumber<K> = K extends `${infer N extends number}` ? N | K : never;

declare namespace Assistant {
  interface Commands {
  }
  interface ExternalState {
  }
}

type AssistantClient = ClientScopes & {
  readonly optional: {
    readonly [K in keyof ClientScopes]: ClientScopes[K] | undefined;
  };
  subscribe(listener: () => void): Unsubscribe;
  on<TEvent extends AssistantEventName>(selector: AssistantEventSelector<TEvent>, callback: AssistantEventCallback<TEvent>): Unsubscribe;
};

type AssistantClientAccessor<K extends ClientNames> = ClientSchemas[K]["methods"] & {
  (): ClientSchemas[K]["methods"];
} & (ClientMeta<K> | {
  source: "root";
  query: Record<string, never>;
} | {
  source: null;
  query: null;
}) & {
  name: K;
};

declare class AssistantCloud {
  readonly threads: AssistantCloudThreads;
  readonly projects: AssistantCloudProjects;
  readonly auth: {
    tokens: AssistantCloudAuthTokens;
    invalidate: () => void;
  };
  readonly runs: AssistantCloudRuns;
  readonly files: AssistantCloudFiles;
  readonly events: AssistantCloudEvents;
  readonly scores: AssistantCloudScores;
  readonly telemetry: AssistantCloudTelemetryConfig;
  readonly registerSdk: (sdk: SdkIdentity) => void;
  constructor(config: AssistantCloudConfig);
}

declare class AssistantCloudAPI {
  _auth: AssistantCloudAuthStrategy;
  _baseUrl: string;
  readonly registerSdk: (sdk: SdkIdentity) => void;
  readonly sdkHeader: () => string;
  constructor(config: AssistantCloudConfig);
  initializeAuth(): Promise<boolean>;
  invalidateAuth(): void;
  makeRawRequest(endpoint: string, options?: MakeRequestOptions): Promise<Response>;
  makeRequest(endpoint: string, options?: MakeRequestOptions): Promise<any>;
}

type AssistantCloudAuthStrategy = {
  readonly strategy: "anon" | "api-key" | "jwt";
  getAuthHeaders(): Promise<Record<string, string> | false>;
  readAuthHeaders(headers: Headers): void;
  invalidate(): void;
};

declare class AssistantCloudAuthTokens {
  #private;
  constructor(cloud: AssistantCloudAPI);
  create(): Promise<AssistantCloudAuthTokensCreateResponse>;
}

type AssistantCloudAuthTokensCreateResponse = {
  token: string;
};

type AssistantCloudConfig = ({
  baseUrl: string;
  authToken: () => Promise<string | null>;
} | {
  baseUrl?: string;
  apiKey: string;
  userId: string;
  workspaceId: string;
} | {
  baseUrl: string;
  anonymous: true;
}) & {
  telemetry?: boolean | AssistantCloudTelemetryConfig;
};

type AssistantCloudEvent = {
  kind: AssistantCloudEventKind;
  thread_id?: string | undefined;
  message_id?: string | undefined;
  run_id?: string | undefined;
  value?: number | undefined;
  props?: Readonly<Record<string, string | number | boolean>> | undefined;
};

type AssistantCloudEventKind = "attachment_added" | "attachment_failed" | "branch_switched" | "error_shown" | "message_copied" | "message_edited" | "message_regenerated" | "message_sent" | "run_stopped" | "speech_started" | "suggestion_clicked" | "suggestions_shown" | "thread_switched" | "tool_approved" | "tool_rejected" | "voice_started";

declare class AssistantCloudEvents {
  #private;
  constructor(cloud: AssistantCloudAPI, isEnabled: () => boolean);
  track(event: AssistantCloudEvent): void;
  dispose(): void;
}

declare class AssistantCloudFiles {
  #private;
  constructor(cloud: AssistantCloudAPI);
  pdfToImages(body: PdfToImagesRequestBody): Promise<PdfToImagesResponse>;
  generatePresignedUploadUrl(body: GeneratePresignedUploadUrlRequestBody): Promise<GeneratePresignedUploadUrlResponse>;
  generatePresignedDownloadUrl(body: {
    key: string;
  } | {
    url: string;
  }): Promise<GeneratePresignedDownloadUrlResponse>;
}

type AssistantCloudMessageCreateResponse = {
  message_id: string;
};

type AssistantCloudProjectThreadMessageListQuery = {
  format?: string;
  limit?: number;
  after?: string;
};

type AssistantCloudProjectThreadMessageListResponse = {
  messages: CloudMessage[];
};

declare class AssistantCloudProjectThreadMessages {
  #private;
  constructor(cloud: AssistantCloudAPI);
  list(threadId: string, query?: AssistantCloudProjectThreadMessageListQuery): Promise<AssistantCloudProjectThreadMessageListResponse>;
}

declare class AssistantCloudProjectThreads {
  #private;
  readonly messages: AssistantCloudProjectThreadMessages;
  constructor(cloud: AssistantCloudAPI);
  list(query?: AssistantCloudProjectThreadsListQuery): Promise<AssistantCloudProjectThreadsListResponse>;
}

type AssistantCloudProjectThreadsListQuery = {
  is_archived?: boolean;
  limit?: number;
  after?: string;
};

type AssistantCloudProjectThreadsListResponse = {
  threads: CloudThread[];
};

declare class AssistantCloudProjects {
  readonly threads: AssistantCloudProjectThreads;
  constructor(cloud: AssistantCloudAPI);
}

type AssistantCloudRunReport = {
  thread_id: string;
  status: "completed" | "error" | "incomplete";
  outcome_type?: "aborted" | "budget_denied" | "content_filter" | "disconnected" | "length" | "persistence_error" | "provider_error" | "rate_limited" | "server_error" | "timeout" | "validation_failed";
  message_id?: string;
  user_message_id?: string;
  first_token_ms?: number;
  release?: string;
  environment?: string;
  tags?: string[];
  provider?: string;
  trace_id?: string;
  root_span_id?: string;
  error_code?: string;
  error?: string;
  total_steps?: number;
  tool_calls?: AssistantCloudRunReportToolCall[];
  steps?: {
    input_tokens?: number;
    output_tokens?: number;
    reasoning_tokens?: number;
    cached_input_tokens?: number;
    tool_calls?: AssistantCloudRunReportToolCall[];
    start_ms?: number;
    end_ms?: number;
    finish_reason?: string;
    input?: string;
  }[];
  input_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  cached_input_tokens?: number;
  cost_usd?: number;
  cost_details?: {
    input?: number;
    input_cached_tokens?: number;
    output?: number;
    total?: number;
  };
  model_id?: string;
  provider_type?: string;
  duration_ms?: number;
  output_text?: string;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

type AssistantCloudRunReportToolCall = {
  tool_name: string;
  tool_call_id: string;
  tool_args?: string;
  tool_result?: string;
  tool_source?: "backend" | "frontend" | "mcp";
  start_ms?: number;
  end_ms?: number;
  sampling_calls?: SamplingCallData[];
};

declare class AssistantCloudRuns {
  #private;
  constructor(cloud: AssistantCloudAPI);
  __internal_getAssistantOptions(assistantId: string): {
    api: string;
    protocol: "ui-message-stream";
    headers: () => Promise<{
      Accept: string;
      "Aui-Sdk": string;
    }>;
    body: (options?: {
      threadId?: string;
    }) => Promise<{
      assistant_id: string;
      response_format: string;
      thread_id: string;
    }>;
  };
  stream(body: AssistantCloudRunsStreamBody): Promise<AssistantStream>;
  report(body: AssistantCloudRunReport): Promise<{
    run_id: string;
  }>;
}

type AssistantCloudRunsStreamBody = {
  thread_id: string;
  assistant_id: "system/thread_title";
  messages: readonly unknown[];
};

type AssistantCloudScoreBody = {
  name: string;
  data_type: "boolean" | "categorical" | "numeric";
  value?: number | boolean;
  string_value?: string;
  comment?: string;
  thread_id?: string;
  message_id?: string;
  run_id?: string;
};

type AssistantCloudScoreResponse = {
  sco
```

### Core Architecture Module: `api-surface/assistant-ui__react-hook-form.ts`
```
import "@standard-schema/spec";

import "json-schema";

import { ComponentType } from "react";

import { FieldPath, FieldValues, UseFormProps, UseFormReturn } from "react-hook-form";

import { z } from "zod";

type BaseAttachment = {
  id: string;
  type: "image" | "document" | "file" | (string & {});
  name: string;
  contentType?: string | undefined;
  file?: File;
  content?: ThreadUserMessagePart[];
};

type BaseThreadMessage = {
  readonly status?: ThreadAssistantMessage["status"];
  readonly metadata: {
    readonly unstable_state?: ReadonlyJSONValue | undefined;
    readonly unstable_annotations?: readonly ReadonlyJSONValue[] | undefined;
    readonly unstable_data?: readonly ReadonlyJSONValue[] | undefined;
    readonly steps?: readonly ThreadStep[] | undefined;
    readonly submittedFeedback?: {
      readonly type: "negative" | "positive";
      readonly comment?: string;
    } | undefined;
    readonly timing?: MessageTiming | undefined;
    readonly isOptimistic?: boolean;
    readonly modality?: MessageModality | undefined;
    readonly custom: Record<string, unknown>;
  };
  readonly attachments?: ThreadUserMessage["attachments"];
};

type CompleteAttachment = BaseAttachment & {
  status: CompleteAttachmentStatus;
  content: ThreadUserMessagePart[];
};

type CompleteAttachmentStatus = {
  type: "complete";
};

type DataMessagePart<T = any> = {
  readonly type: "data";
  readonly id?: string;
  readonly name: string;
  readonly data: T;
};

type FileMessagePart = {
  readonly type: "file";
  readonly id?: string;
  readonly filename?: string;
  readonly data: string;
  readonly mimeType: string;
  readonly sourceType?: "id" | "url";
  readonly providerMetadata?: PartProviderMetadata;
  readonly parentId?: string;
};

type GenerativeUIMessagePart = {
  readonly type: "generative-ui";
  readonly spec: GenerativeUISpec;
  readonly id?: string;
  readonly parentId?: string;
};

type GenerativeUINode = string | number | readonly GenerativeUINode[] | {
  readonly component: string;
  readonly props?: Record<string, unknown>;
  readonly children?: readonly GenerativeUINode[];
  readonly key?: string;
};

type GenerativeUISpec = {
  readonly root: GenerativeUINode | readonly GenerativeUINode[];
};

type ImageMessagePart = {
  readonly type: "image";
  readonly id?: string;
  readonly image: string;
  readonly filename?: string;
  readonly providerMetadata?: PartProviderMetadata;
};

type McpAppMetadata = {
  readonly resourceUri: string;
  readonly mimeType?: string;
  readonly visibility?: readonly ("app" | "model")[];
  readonly serverId?: string;
};

type MessageCommonProps = {
  readonly id: string;
  readonly createdAt: Date;
};

type MessageModality = "voice";

type MessagePartState = (ThreadUserMessagePart | ThreadAssistantMessagePart) & {
  readonly status: MessagePartStatus | ToolCallMessagePartStatus;
};

type MessagePartStatus = {
  readonly type: "running";
} | {
  readonly type: "complete";
} | {
  readonly type: "incomplete";
  readonly reason: "cancelled" | "content-filter" | "error" | "length" | "other";
  readonly error?: unknown;
};

type MessagePartStreamStatus = {
  readonly type: "running";
} | {
  readonly type: "complete";
} | {
  readonly type: "incomplete";
  readonly reason: "cancelled" | "content-filter" | "error" | "length" | "other";
};

type MessagePartTiming = {
  readonly startedAt: number;
  readonly completedAt?: number;
};

type MessageStatus = {
  readonly type: "running";
} | {
  readonly type: "requires-action";
  readonly reason: "interrupt" | "tool-calls";
} | {
  readonly type: "complete";
  readonly reason: "stop" | "unknown";
} | {
  readonly type: "incomplete";
  readonly reason: "cancelled" | "content-filter" | "error" | "length" | "other" | "tool-calls";
  readonly error?: ReadonlyJSONValue;
};

type MessageTiming = {
  readonly streamStartTime: number;
  readonly firstTokenTime?: number;
  readonly totalStreamTime?: number;
  readonly tokenCount?: number;
  readonly tokensPerSecond?: number;
  readonly totalChunks: number;
  readonly toolCallCount: number;
};

type PartProviderMetadata = {
  readonly [providerName: string]: ReadonlyJSONObject;
};

type ReadonlyJSONArray = readonly ReadonlyJSONValue[];

type ReadonlyJSONObject = {
  readonly [key: string]: ReadonlyJSONValue;
};

type ReadonlyJSONValue = null | string | number | boolean | ReadonlyJSONObject | ReadonlyJSONArray;

type ReasoningMessagePart = {
  readonly type: "reasoning";
  readonly id?: string;
  readonly text: string;
  readonly status?: MessagePartStreamStatus;
  readonly unstable_summary?: string;
  readonly timing?: MessagePartTiming;
  readonly providerMetadata?: PartProviderMetadata;
  readonly parentId?: string;
};

type SourceMessagePart = {
  readonly type: "source";
  readonly sourceType: "url";
  readonly id: string;
  readonly url: string;
  readonly title?: string;
  readonly providerMetadata?: SourceProviderMetadata;
  readonly parentId?: string;
} | {
  readonly type: "source";
  readonly sourceType: "document";
  readonly id: string;
  readonly url?: undefined;
  readonly title: string;
  readonly mediaType: string;
  readonly filename?: string;
  readonly providerMetadata?: SourceProviderMetadata;
  readonly parentId?: string;
};

type SourceProviderMetadata = PartProviderMetadata;

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
}

declare const TOOL_RESPONSE_SYMBOL: unique symbol;

type TextMessagePart = {
  readonly type: "text";
  readonly id?: string;
  readonly text: string;
  readonly status?: MessagePartStreamStatus;
  readonly providerMetadata?: PartProviderMetadata;
  readonly parentId?: string;
};

type ThreadAssistantMessage = MessageCommonProps & {
  readonly role: "assistant";
  readonly content: readonly ThreadAssistantMessagePart[];
  readonly status: MessageStatus;
  readonly metadata: {
    readonly runId?: string | undefined;
    readonly unstable_state: ReadonlyJSONValue;
    readonly unstable_annotations: readonly ReadonlyJSONValue[];
    readonly unstable_data: readonly ReadonlyJSONValue[];
    readonly steps: readonly ThreadStep[];
    readonly submittedFeedback?: {
      readonly type: "negative" | "positive";
      readonly comment?: string;
    };
    readonly timing?: MessageTiming;
    readonly isOptimistic?: boolean;
    readonly modality?: MessageModality;
    readonly custom: Record<string, unknown>;
  };
};

type ThreadAssistantMessagePart = TextMessagePart | ReasoningMessagePart | ToolCallMessagePart | SourceMessagePart | FileMessagePart | ImageMessagePart | DataMessagePart | GenerativeUIMessagePart;

type ThreadMessage = BaseThreadMessage & (ThreadSystemMessage | ThreadUserMessage | ThreadAssistantMessage);

type ThreadStep = {
  readonly messageId?: string;
  readonly usage?: {
    readonly inputTokens: number;
    readonly outputTokens: number;
  } | undefined;
};

type ThreadSystemMessage = MessageCommonProps & {
  readonly role: "system";
  readonly content: readonly [
    TextMessagePart
  ];
  readonly metadata: {
    readonly unstable_state?: undefined;
    readonly unstable_annotations?: undefined;
    readonly unstable_data?: undefined;
    readonly steps?: undefined;
    readonly submittedFeedback?: undefined;
    readonly timing?: undefined;
    readonly modality?: undefined;
    readonly custom: Record<string, unknown>;
  };
};

type ThreadUserMessage = MessageCommonProps & {
  readonly role: "user";
  readonly content: readonly ThreadUserMessagePart[];
  readonly attachments: readonly CompleteAttachment[];
  readonly metadata: {
    readonly unstable_state?: undefined;
    readonly unstable_annotations?: undefined;
    readonly unstable_data?: undefined;
    readonly steps?: undefined;
    readonly submittedFeedback?: undefined;
    readonly timing?: undefined;
    readonly isOptimistic?: boolean;
    readonly modality?: MessageModality;
    readonly custom: Record<string, unknown>;
  };
};

type ThreadUserMessagePart = TextMessagePart | ImageMessagePart | FileMessagePart | DataMessagePart | Unstable_AudioMessagePart;

type ToolApprovalAnswer = {
  readonly optionIds?: readonly string[];
  readonly text?: string;
};

type ToolApprovalDisplay = "decision" | "questions" | "select" | "text";

type ToolApprovalOption = {
  readonly id: string;
  readonly kind: ToolApprovalOptionKind | (string & {});
  readonly label?: string;
  readonly description?: string;
  readonly grants?: readonly string[];
  readonly confirm?: boolean | {
    title?: string;
    description?: string;
  };
};

type ToolApprovalOptionKind = "allow-always" | "allow-once" | "reject-always" | "reject-once";

type ToolApprovalQuestion = {
  readonly id: string;
  readonly prompt: string;
  readonly header?: string;
  readonly options?: readonly ToolApprovalQuestionOption[];
  readonly multiple?: boolean;
  readonly allowFreeform?: boolean;
};

type ToolApprovalQuestionOption = {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
};

type ToolApprovalResponse = {
  readonly approved: boolean;
  readonly text?: string;
  readonly reason?: string;
} | {
  readonly optionId: string;
  readonly text?: string;
  readonly reason?: string;
} | {
  readonly approved: boolean;
  readonly optionId: string;
  readonly text?: string;
  readonly reason?: string;
} | {
  readonly text: string;
  readonly reason?: string;
} | {
  readonly answers: Readonly<Record<string, ToolApprovalAnswer>>;
  readonly reason?: string;
};

type ToolCallMessagePart<TArgs = ReadonlyJSONObject, TResult = unknown> = {
  readonly type: "tool-call";
  readonly toolCallId: string;
  readonly toolName: string;
  readonly args: TArgs;
  readonly result?: TResult | undefined;
  readonly responseDeliveryStatus?: "queued" | undefined;
  readonly isError?: boolean | undefined;

```

### Core Architecture Module: `apps/checkout-worker/src/index.ts`
```
import { CheckoutHost } from "setup-agent/host";
import { isClosed, isValidModelAnswer, type Checkout } from "setup-agent";
import { resource, useResource } from "@assistant-ui/tap";
import {
  StatewireDurableObject,
  statewireHandlers,
  routeStatewireRequest,
} from "@statewire/cloudflare";

type Env = { CHECKOUT: StatewireDurableObject.Namespace };

type SecretDeposit = {
  setupId: string;
  setupCreatedAt: number;
  inputId: string;
  inputCreatedAt: number;
  answer: string;
  secret: string;
  expiresAt: number;
};

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Statewire-Client-Id, Statewire-Lease",
  "Access-Control-Expose-Headers": "Statewire-Lease",
};

const withCors = (response: Response) => {
  if (response.status === 101) return response;
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    headers.set(name, value);
  }
  return new Response(response.body, { status: response.status, headers });
};

const SECRET_PATH = /\/secret\/([^/]+)$/;
const SECRET_TTL_MS = 60 * 60 * 1000;
const MAX_SECRET_BYTES = 16 * 1024;

/** The body as text, or `undefined` once it passes `max` bytes, without reading further. */
const readCapped = async (request: Request, max: number) => {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      reader.cancel().catch(() => {});
      return undefined;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
};

export class CheckoutDO extends StatewireDurableObject<Env>() {
  #state: Checkout.State | undefined;
  #cleanupScope = "";

  override statewire = statewireHandlers(this.ctx, (restored) => {
    const instance = this;
    return resource(function useCheckoutTransport() {
      const host = useResource(CheckoutHost(restored));
      instance.#state = host.state;
      instance.#scheduleCleanup();
      return {
        ...host,
        subscribe: (listener: () => void) =>
          host.subscribe(() => {
            instance.#scheduleCleanup();
            listener();
          }),
      };
    })();
  });

  #currentInput(setupId: string, inputId: string) {
    const state = this.#state;
    if (
      !state ||
      state.createdAt === null ||
      state.id !== setupId ||
      isClosed(state)
    )
      return undefined;
    return state.inputs.find(
      (input) => input.id === inputId && input.kind === "model",
    );
  }

  #isCurrentDeposit(value: unknown): value is SecretDeposit {
    if (typeof value !== "object" || value === null) return false;
    const deposit = value as Partial<SecretDeposit>;
    if (
      typeof deposit.setupId !== "string" ||
      typeof deposit.inputId !== "string" ||
      typeof deposit.answer !== "string" ||
      typeof deposit.secret !== "string" ||
      typeof deposit.expiresAt !== "number"
    )
      return false;
    const input = this.#currentInput(deposit.setupId, deposit.inputId);
    return (
      input !== undefined &&
      deposit.setupCreatedAt === this.#state?.createdAt &&
      deposit.inputCreatedAt === input.createdAt &&
      deposit.expiresAt > Date.now() &&
      isValidModelAnswer(input, deposit.answer) &&
      (input.status === "open" ||
        (input.status === "answered" && input.answer === deposit.answer))
    );
  }

  #scheduleCleanup() {
    const state = this.#state;
    if (!state) return;
    const scope = JSON.stringify([
      state.id,
      state.createdAt,
      state.status,
      state.inputs.map((input) => [input.id, input.status, input.answer]),
    ]);
    if (scope === this.#cleanupScope) return;
    this.#cleanupScope = scope;
    this.ctx.waitUntil(
      this.ctx.blockConcurrencyWhile(async () => {
        const secrets = await this.ctx.storage.list({ prefix: "secret:" });
        for (const [key, value] of secrets) {
          if (!this.#isCurrentDeposit(value))
            await this.ctx.storage.delete(key);
        }
      }),
    );
  }

  async alarm() {
    await this.ctx.blockConcurrencyWhile(async () => {
      const now = Date.now();
      let next: number | undefined;
      const secrets = await this.ctx.storage.list({ prefix: "secret:" });
      for (const [key, value] of secrets) {
        const expiresAt = (value as Partial<SecretDeposit> | undefined)
          ?.expiresAt;
        if (typeof expiresAt !== "number" || expiresAt <= now) {
          await this.ctx.storage.delete(key);
        } else if (next === undefined || expiresAt < next) {
          next = expiresAt;
        }
      }
      if (next !== undefined) await this.ctx.storage.setAlarm(next);
    });
  }

  override async onRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const match = SECRET_PATH.exec(url.pathname);
    if (match === null) return super.onRequest(request);
    if (request.method !== "PUT" && request.method !== "GET") {
      return new Response(null, {
        status: 405,
        headers: { Allow: "GET, PUT" },
      });
    }
    const setupId = url.searchParams.get("setup");
    if (!setupId) return new Response("setup ID required", { status: 400 });
    let inputId: string;
    try {
      inputId = decodeURIComponent(match[1]!);
    } catch {
      return new Response("invalid input ID", { status: 400 });
    }
    const secret =
      request.method === "PUT"
        ? await readCapped(request, MAX_SECRET_BYTES)
        : "";
    if (secret === undefined) {
      return new Response("secret too large", { status: 413 });
    }
    return this.ctx.blockConcurrencyWhile(async () => {
      const input = this.#currentInput(setupId, inputId);
      if (!input) return new Response("no model input", { status: 404 });
      const key = `secret:${JSON.stringify([setupId, inputId])}`;
      if (request.method === "PUT") {
        if (input.status !== "open")
          return new Response("input closed", { status: 409 });
        const answer = url.searchParams.get("answer");
        if (answer === null || !isValidModelAnswer(input, answer)) {
          return new Response("invalid deposit", { status: 400 });
        }
        if (secret === "") return new Response("empty secret", { status: 400 });
        const expiresAt = Date.now() + SECRET_TTL_MS;
        await this.ctx.storage.put(key, {
          setupId,
          setupCreatedAt: this.#state!.createdAt!,
          inputId,
          inputCreatedAt: input.createdAt,
          secret,
          answer,
          expiresAt,
        } satisfies SecretDeposit);
        const alarm = await this.ctx.storage.getAlarm();
        if (alarm === null || alarm > expiresAt) {
          await this.ctx.storage.setAlarm(expiresAt);
        }
        return new Response(null, { status: 204 });
      }
      if (
        input.status !== "answered" ||
        !isValidModelAnswer(input, input.answer ?? "")
      )
        return new Response("no secret", { status: 404 });
      const value = await this.ctx.storage.get(key);
      if (!this.#isCurrentDeposit(value)) {
        await this.ctx.storage.delete(key);
        return new Response("no secret", { status: 404 });
      }
      if (input.redeemKeyHash !== undefined) {
        const redeemKey = request.headers.get("Setup-Agent-Redeem-Key");
        const digest = new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(redeemKey ?? ""),
          ),
        );
        let difference = 0;
        for (let i = 0; i < digest.length; i++) {
          difference |=
            digest[i]! ^
            Number.parseInt(input.redeemKeyHash.slice(i * 2, i * 2 + 2), 16);
        }
        if (redeemKey === null || difference !== 0) {
          return new Response("invalid redeem key", { status: 403 });
        }
      }
      await this.ctx.storage.delete(key);
      return new Response(value.secret, {
        headers: { "content-type": "text/plain" },
      });
    });
  }
}

export default {
  fetch: async (request: Request, env: Env) => {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    const url = new URL(request.url);
    url.pathname = `/checkout${url.pathname}`;
    const response = await routeStatewireRequest(
      new Request(url, request),
      env,
    );
    return withCors(response ?? new Response("Not found", { status: 404 }));
  },
};

```

### Core Architecture Module: `apps/social-media/src/render.tsx`
```
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

// X/Twitter recommended image: 16:9 ratio
// Using 1600x900 for high quality
const WIDTH = 1600;
const HEIGHT = 900;

const OUTPUT_DIR = fileURLToPath(new URL("../dist", import.meta.url));

async function loadFont(): Promise<ArrayBuffer> {
  const res = await fetch(
    "https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-700-normal.woff",
  );
  return res.arrayBuffer();
}

let fontCache: ArrayBuffer | null = null;

export async function renderCard(
  name: string,
  element: React.ReactElement,
): Promise<void> {
  if (!fontCache) {
    fontCache = await loadFont();
  }

  const svg = await satori(element, {
    width: WIDTH,
    height: HEIGHT,
    fonts: [
      {
        name: "Inter",
        data: fontCache,
        weight: 700,
        style: "normal",
      },
    ],
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: WIDTH },
  });
  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  await mkdir(OUTPUT_DIR, { recursive: true });

  const svgPath = `${OUTPUT_DIR}/${name}.svg`;
  const pngPath = `${OUTPUT_DIR}/${name}.png`;

  await writeFile(svgPath, svg);
  await writeFile(pngPath, pngBuffer);

  console.log(`✔ ${name} → ${pngPath}`);
}

```

### Core Architecture Module: `evals/src/suites/generative-ui/render.ts`
```
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { fileURLToPath } from "node:url";
import { openChromePage } from "./chrome.ts";
import type { Answer, Format, Rendered } from "./types.ts";

/** The chat column answers render in, the width generative-frame previews widgets at. */
export const RENDER_WIDTH = 680;
// Vision models shrink an image whose long side passes about 1,500 px, which would leave a tall answer's text unreadable, so an answer is captured in slices of this height.
const SLICE_HEIGHT = 1_000;
/** An answer taller than this many slices is cut off. */
export const MAX_SLICES = 8;

const page = (styles: string) => `<!doctype html>
<html>
  <head><meta charset="utf-8"><title>answer</title><style>${styles}</style></head>
  <body><div id="answer"></div><script type="module" src="/harness.js"></script></body>
</html>`;

// The kit element draws Diagram and Map with Tailwind classes, which an app that installs it compiles, so the page compiles the same classes over the kit's element sources.
const TAILWIND = `@import "tailwindcss";
@source "../../../../packages/ui/src/components/react/assistant-ui/elements";
@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}`;

async function kitStyles(): Promise<string> {
  const [{ default: postcss }, { default: tailwind }] = await Promise.all([
    import("postcss"),
    import("@tailwindcss/postcss"),
  ]);
  const { css } = await postcss([tailwind()]).process(TAILWIND, {
    from: fileURLToPath(new URL("./harness.css", import.meta.url)),
  });
  return css;
}

/** Bundles the harness page script; a stylesheet a component imports, such as Leaflet's, goes into the page instead. */
async function bundleHarness(): Promise<{ script: string; styles: string }> {
  const { rolldown } = await import("rolldown");
  const styles: string[] = [];
  const bundle = await rolldown({
    input: fileURLToPath(new URL("./harness.tsx", import.meta.url)),
    platform: "browser",
    transform: {
      define: { "process.env.NODE_ENV": JSON.stringify("production") },
    },
    logLevel: "silent",
    plugins: [
      {
        name: "collect-css",
        load(id) {
          if (!id.endsWith(".css")) return null;
          styles.push(readFileSync(id, "utf8"));
          return { code: "", moduleType: "js" };
        },
      },
    ],
  });
  try {
    const { output } = await bundle.generate({
      format: "esm",
      codeSplitting: false,
    });
    return { script: output[0].code, styles: styles.join("\n") };
  } finally {
    await bundle.close();
  }
}

export interface Renderer {
  render(
    format: Format,
    artifact: string,
    prose: Answer["prose"],
  ): Promise<Rendered>;
  close(): Promise<void>;
}

/** Renders answers one at a time in a headless Chrome, the way a chat app shows them. */
export async function createRenderer(): Promise<Renderer> {
  const [{ script, styles }, kit] = await Promise.all([
    bundleHarness(),
    kitStyles(),
  ]);
  const html = page(`${kit}\n${styles}`);
  const server = createServer((request, response) => {
    const isScript = request.url === "/harness.js";
    response.writeHead(200, {
      "content-type": isScript ? "text/javascript" : "text/html",
    });
    response.end(isScript ? script : html);
  });
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve()),
  );
  const { port } = server.address() as AddressInfo;
  const stopServer = () =>
    new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });

  try {
    const page = await openChromePage(
      `http://127.0.0.1:${port}/`,
      RENDER_WIDTH,
    );
    const renderOne = async (
      format: Format,
      artifact: string,
      prose: Answer["prose"],
    ) => {
      const { height, errors } = await page.evaluate<{
        height: number;
        errors: string[];
      }>(
        `window.renderAnswer(${JSON.stringify(format)}, ${JSON.stringify(artifact)}, ${JSON.stringify(prose)})`,
        60_000,
      );
      const captured = Math.min(Math.max(height, 1), MAX_SLICES * SLICE_HEIGHT);
      const screenshots: string[] = [];
      for (let y = 0; y < captured; y += SLICE_HEIGHT) {
        screenshots.push(
          await page.screenshot(
            y,
            RENDER_WIDTH,
            Math.min(SLICE_HEIGHT, captured - y),
          ),
        );
      }
      return {
        screenshots,
        cutOff: height > captured,
        runtimeErrors: errors,
      };
    };
    // The page renders one answer at a time, so concurrent trials queue for it.
    let last: Promise<unknown> = Promise.resolve();
    return {
      render(format, artifact, prose) {
        const next = last.then(() => renderOne(format, artifact, prose));
        last = next.catch(() => {});
        return next;
      },
      async close() {
        await page.close();
        await stopServer();
      },
    };
  } catch (error) {
    await stopServer();
    throw error;
  }
}

```

### Core Architecture Module: `examples/with-artifacts/app/artifact-state.ts`
```
import { z } from "zod";

export const artifactSchema = z.object({
  title: z.string().describe("A short title for the artifact."),
  code: z
    .string()
    .describe(
      "A complete HTML document with inline CSS and JavaScript when needed.",
    ),
});

export type ArtifactState = z.infer<typeof artifactSchema>;

export const emptyArtifact: ArtifactState = {
  title: "Untitled artifact",
  code: "",
};

export const artifactDescription =
  "Create an interactive HTML artifact when the user asks for a webpage, interface, visualization, or other visual content. Provide a short title and a complete HTML document.";

```

### Core Architecture Module: `examples/with-cloud/app/renderer/page.tsx`
```
"use client";

import { CloudRendererHost } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/elements/thread.aui";

export default function RendererPage() {
  return (
    <CloudRendererHost
      allowedOrigins={[
        "https://cloud.assistant-ui.com",
        ...(process.env.NODE_ENV === "development"
          ? ["http://localhost:3001"]
          : []),
      ]}
    >
      <Thread />
    </CloudRendererHost>
  );
}

```

### Core Architecture Module: `examples/with-expo/app/showcase/error-state.tsx`
```
import { ShowcaseScreen } from "@/components/showcase/screen";

export default function ErrorStateShowcase() {
  return <ShowcaseScreen slug="error-state" />;
}

```

### Core Architecture Module: `examples/with-expo/app/showcase/message-queue.tsx`
```
import { ShowcaseScreen } from "@/components/showcase/screen";

export default function MessageQueueShowcase() {
  return <ShowcaseScreen slug="message-queue" />;
}

```

### Core Architecture Module: `examples/with-expo/hooks/anonymous-session-fetch.ts`
```
// Mirrored inline in examples/with-react-ink-web/app/ink-app.tsx; keep in sync.
const ANONYMOUS_SESSION_HEADER = "x-assistant-ui-anonymous-session";

export function shouldUseAnonymousSessionFetch(
  chatApi: string,
  platform: string,
): boolean {
  return platform === "web" && chatApi.startsWith("http");
}

export function createAnonymousSessionFetch(
  chatApi: string,
  fetchImplementation: typeof fetch = fetch,
): typeof fetch {
  let tokenPromise: Promise<string | null> | null = null;

  const getToken = () => {
    tokenPromise ??= (async () => {
      const endpoint = new URL("/api/anonymous-session", chatApi);
      const response = await fetchImplementation(endpoint, {
        credentials: "same-origin",
      });
      if (!response.ok) {
        throw new Error("Unable to start an anonymous session");
      }
      if (response.status === 204) return null;
      const payload = (await response.json()) as { token?: unknown };
      if (typeof payload.token !== "string" || !payload.token) {
        throw new Error("Anonymous session token is missing");
      }
      return payload.token;
    })().catch(() => {
      tokenPromise = null;
      return null;
    });
    return tokenPromise;
  };

  return async (input, init) => {
    const requestTemplate =
      input instanceof Request ? new Request(input, init) : null;

    const send = async () => {
      const headers = new Headers(requestTemplate?.headers ?? init?.headers);
      const token = await getToken();
      if (token) headers.set(ANONYMOUS_SESSION_HEADER, token);
      if (requestTemplate) {
        return fetchImplementation(requestTemplate.clone(), { headers });
      }
      return fetchImplementation(input, { ...init, headers });
    };

    const response = await send();
    if (response.status !== 401) return response;
    tokenPromise = null;
    return send();
  };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #10045** (2026-10-23): **test(registry): chat route cancellation case times out on a cold route import under coverage**
  *Symptoms*: the merge group run for #10037 (run 39899304391, base `a24d074aa`) failed Test Coverage in `apps/registry/app/api/chat/route.test.ts`, while the `main` push on the same commit passed. the change itself only touches `packages/react-mcp`, which `apps/registry` does not depend on.  - `registry chat route > forwards cancellation to the provider after the response starts` hit the 5000ms test timeout (5017ms). it is the first case, so it pays the dynamic `import()` of the route module (`loadRoute`, line 95) under coverage instrumentation. - `uses the same frontend tools for message conversion and streaming` then failed at line 147 after 204ms, reading `mocks.streamText.mock.calls[0]` while the timed out case was still running: a cascade, not a second bug.  none of the 25 previous failed Test Coverage runs show it, so it is rare. the fix is to take the cold import out of the first case (load the routes in a `beforeAll`) so no case measures module load time.  <!-- rupic:badge:start --> <a href="https://rupic.dev/s/s2.lhYZt-p72L_idwUTuDOwyKycsK2OZ73JdaCFi7dJ5BEnuqwbQYlG__Syso0?ref=github" target="_blank" rel="noopener noreferrer"><picture><source media="(prefers-color-scheme: dark)" srcset="https://rupic.dev/badges/track-dark-v1.svg"><img alt="Track in Rupic" src="https://rupic.dev/badges/track-light-v1.svg"></picture></a> <!-- rupic:badge:end -->

- **Issue #10021** (2026-10-22): **cloud never reports persistence_error for a turn whose history write failed**
  *Symptoms*: follows #4826.  `persistence_error` is in the run outcome vocabulary but nothing produces it. when an append or update to cloud history fails, `useExternalHistory` logs `Failed to persist message history` and the turn's run report either still goes out as a normal run or never goes out, depending on where the chain failed; `CloudRunReporter` also swallows send failures by design. a reviewer cannot tell a missing reply caused by storage from one caused by the model.  needs a decision on who reports the failure of a write (the history adapter after a failed append, with `outcome_type: "persistence_error"`) and how that interacts with the reporter's swallow and 429 retry rules.  <!-- rupic:badge:start --> <a href="https://rupic.dev/s/s2.rtGE7yifIUfskQC4_lMwRfOhKrxZC3Vq9QtICAckivH1kFYmETeNHazThmQ?ref=github" target="_blank" rel="noopener noreferrer"><picture><source media="(prefers-color-scheme: dark)" srcset="https://rupic.dev/badges/track-dark-v1.svg"><img alt="Track in Rupic" src="https://rupic.dev/badges/track-light-v1.svg"></picture></a> <!-- rupic:badge:end -->

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

### Incident Patch 1: `6a0c7920` (2026-10-23)
**Commit Message**: fix(react-mcp): preserve disconnect during failed cleanup (#10037)

**File**: `.changeset/mcp-disconnect-cleanup.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@assistant-ui/react-mcp": patch
+---
+
+fix: preserve a later disconnect while a failed connection or OAuth completion is cleaning up its transport.
```

**File**: `packages/react-mcp/src/resources/McpServerResource.test.ts` (modified, +69/-0)
```diff
@@ -203,6 +203,75 @@ const getOAuthProvider = (index: number) => {
   };
 };
 
+describe("McpServerResource failed connection cleanup", () => {
+  beforeEach(resetMocks);
+
+  it.each(["connect", "completeAuth"] as const)(
+    "preserves a later disconnect while cleaning up a failed %s",
+    async (operation) => {
+      let finishClose!: () => void;
+      const close = new Promise<void>((resolve) => {
+        finishClose = resolve;
+      });
+      mocks.closeResults.push(() => close);
+      const failure = new Error("connection failed");
+      const results =
+        operation === "connect"
+          ? mocks.connectResults
+          : mocks.finishAuthResults;
+      results.push(() => Promise.reject(failure));
+      const storage = createStorage();
+      vi.mocked(storage.loadAuthState).mockResolvedValue({
+        serverUrl: "https://example.com/mcp",
+        state: "expected",
+      });
+      const root = mount({
+        auth: { type: operation === "connect" ? "none" : "oauth" },
+        storage,
+      });
+      const attempt = (
+        operation === "connect"
+          ? root.getValue().connect()
+          : root
+              .getValue()
+              .completeAuth(
+                "https://example.com/callback?code=abc&state=expected",
+              )
+      ).catch((error: unknown) => error);
+
+      try {
+        await waitFor(() => mocks.transports[0]?.close.mock.calls.length === 1);
+        const disconnect = root.getValue().disconnect();
+        await waitForResourceUpdate(
+          () => root.getValue().getState().connectionState === "disconnected",
+        );
+
+        finishClose();
+        await Promise.all([attempt, disconnect]);
+        await flushMacrotask();
+
+        expect(root.getValue().getState()).toMatchObject({
+          connectionState: "disconnected",
+          lastError: null,
+        });
+        if (operation === "completeAuth") {
+          await expect(attempt).resolves.toMatchObject({
+            message:
+              'MCP server "docs" authorization was interrupted before completion.',
+            cause: failure,
+          });
+        } else {
+          await expect(attempt).resolves.toBeUndefined();
+        }
+      } finally {
+        finishClose();
+        await attempt;
+        root.unmount();
+      }
+    },
+  );
+});
+
 describe("McpServerResource automatic authentication", () => {
   beforeEach(resetMocks);
 
```

**File**: `packages/react-mcp/src/resources/McpServerResource.ts` (modified, +3/-0)
```diff
@@ -413,6 +413,7 @@ const useMcpServerResourceInstance = (
           pendingTransportRef.current = null;
           await closeQueuedTransports([transport]);
         }
+        if (!isCurrentConnection(generation)) return;
         setLastError({
           message: err instanceof Error ? err.message : String(err),
         });
@@ -502,6 +503,8 @@ const useMcpServerResourceInstance = (
         throw createInterruptedAuthError(error);
 
       await closeTransports();
+      if (!isCurrentConnection(generation))
+        throw createInterruptedAuthError(error);
       setLastError({
         message: error.message,
       });
```

---

### Incident Patch 2: `c015c32a` (2026-10-23)
**Commit Message**: fix(diagrammatic): honor height on micro charts without a width (#10071)

**File**: `packages/diagrammatic/src/react/charts/sparkline.height.test.tsx` (added, +42/-0)
```diff
@@ -0,0 +1,42 @@
+import { renderToStaticMarkup } from "react-dom/server";
+import { describe, expect, it } from "vitest";
+import { Sparkbar } from "./sparkbar";
+import { Sparkline } from "./sparkline";
+
+const rootStyle = (html: string) => html.match(/<svg[^>]*style="([^"]*)"/)![1]!;
+
+describe("micro chart height", () => {
+  it("draws a block row at the height it is given", () => {
+    const style = rootStyle(
+      renderToStaticMarkup(<Sparkline block height={40} data={[1, 3, 2]} />),
+    );
+    expect(style).toContain("width:100%");
+    expect(style).toContain("height:40px");
+  });
+
+  it("draws an inline chart at the height it is given without a width", () => {
+    const style = rootStyle(
+      renderToStaticMarkup(<Sparkbar height={24} data={[1, 3, 2]} />),
+    );
+    expect(style).toContain("height:24px");
+  });
+
+  it("keeps the 1em default for a height that is not a positive number", () => {
+    for (const height of [0, -4, Number.NaN]) {
+      const html = renderToStaticMarkup(
+        <Sparkline block height={height} data={[1, 3, 2]} />,
+      );
+      expect(rootStyle(html)).toContain("height:1em");
+      expect(html).not.toMatch(/<svg[^>]* height="/);
+    }
+  });
+
+  it("keeps the 1em default when no height is given", () => {
+    expect(
+      rootStyle(renderToStaticMarkup(<Sparkline block data={[1, 3, 2]} />)),
+    ).toContain("height:1em");
+    expect(
+      rootStyle(renderToStaticMarkup(<Sparkline data={[1, 3, 2]} />)),
+    ).toContain("height:1em");
+  });
+});
```

**File**: `packages/diagrammatic/src/react/svg.tsx` (modified, +4/-3)
```diff
@@ -382,6 +382,7 @@ export const MicroSvg = forwardRef<
   ) => {
     const label = title ?? rest["aria-label"];
     const px = sized(width);
+    const h = sized(height);
     return (
       <svg
         ref={ref}
@@ -394,7 +395,7 @@ export const MicroSvg = forwardRef<
         {...rest}
         width={px}
         height={
-          height ??
+          h ??
           (px === undefined
             ? undefined
             : Math.round(((px * vh) / vw) * 100) / 100)
@@ -404,14 +405,14 @@ export const MicroSvg = forwardRef<
             ? {
                 display: "block",
                 width: "100%",
-                height: `${em}em`,
+                height: h === undefined ? `${em}em` : `${h}px`,
                 fontFamily: FONT,
                 ...style,
               }
             : px === undefined
               ? {
                   display: "inline-block",
-                  height: `${em}em`,
+                  height: h === undefined ? `${em}em` : `${h}px`,
                   width: "auto",
                   verticalAlign: "-0.125em",
                   fontFamily: FONT,
```

---

### Incident Patch 3: `bfd98a80` (2026-10-23)
**Commit Message**: fix: bind setup-agent key redemption to the asking CLI (#10066)

**File**: `.changeset/setup-agent-redeem-key.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"setup-agent": patch
+---
+
+fix: bind model key redemption to the asking CLI.
```

**File**: `api-surface/setup-agent.ts` (modified, +2/-0)
```diff
@@ -69,6 +69,7 @@ declare namespace Checkout {
     product?: string;
     default?: string;
     help?: InputHelp;
+    redeemKeyHash?: string;
     optional: boolean;
     status: InputStatus;
     answer?: string;
@@ -135,6 +136,7 @@ declare namespace Checkout {
     product?: string;
     default?: string;
     help?: InputHelp;
+    redeemKeyHash?: string;
     optional?: boolean;
   };
   type PlanDecision = {
```

**File**: `apps/checkout-worker/src/index.test.ts` (modified, +40/-0)
```diff
@@ -151,6 +151,46 @@ describe("secret lifecycle", () => {
 });
 
 describe("CheckoutDO", () => {
+  it("requires the model input's redeem key without consuming a deposit on failure", async () => {
+    const snapshot = modelState();
+    snapshot.inputs[0]!.redeemKeyHash =
+      "3389fd9e8dac282ba9df440375f67fbe84dcd70f157d4adabbdd2fd56c7a8f08";
+    const fixture = createInstance(snapshot);
+    const client = await connect(fixture);
+    expect(
+      (
+        await fixture.instance.fetch(
+          secretRequest("setup-a", "PUT", "provider-key"),
+        )
+      ).status,
+    ).toBe(204);
+    await client.commands["checkout/answer"]({
+      inputId: "q1",
+      answer: modelAnswer,
+    });
+    expect((await fixture.instance.fetch(secretRequest())).status).toBe(403);
+    expect(
+      (
+        await fixture.instance.fetch(
+          new Request(secretRequest(), {
+            headers: { "Setup-Agent-Redeem-Key": "wrong" },
+          }),
+        )
+      ).status,
+    ).toBe(403);
+    expect(fixture.stored.get('secret:["setup-a","q1"]')).toEqual(
+      expect.objectContaining({ secret: "provider-key" }),
+    );
+    const response = await fixture.instance.fetch(
+      new Request(secretRequest(), {
+        headers: { "Setup-Agent-Redeem-Key": "redeem-key" },
+      }),
+    );
+    expect(response.status).toBe(200);
+    expect(await response.text()).toBe("provider-key");
+    expect(fixture.stored.has('secret:["setup-a","q1"]')).toBe(false);
+  });
+
   it("keeps a key outside state and consumes it once only after its matching answer", async () => {
     const fixture = createInstance(modelState());
     const client = await connect(fixture);
```

**File**: `apps/checkout-worker/src/index.ts` (modified, +18/-0)
```diff
@@ -226,6 +226,24 @@ export class CheckoutDO extends StatewireDurableObject<Env>() {
         await this.ctx.storage.delete(key);
         return new Response("no secret", { status: 404 });
       }
+      if (input.redeemKeyHash !== undefined) {
+        const redeemKey = request.headers.get("Setup-Agent-Redeem-Key");
+        const digest = new Uint8Array(
+          await crypto.subtle.digest(
+            "SHA-256",
+            new TextEncoder().encode(redeemKey ?? ""),
+          ),
+        );
+        let difference = 0;
+        for (let i = 0; i < digest.length; i++) {
+          difference |=
+            digest[i]! ^
+            Number.parseInt(input.redeemKeyHash.slice(i * 2, i * 2 + 2), 16);
+        }
+        if (redeemKey === null || difference !== 0) {
+          return new Response("invalid redeem key", { status: 403 });
+        }
+      }
       await this.ctx.storage.delete(key);
       return new Response(value.secret, {
         headers: { "content-type": "text/plain" },
```

**File**: `packages/setup-agent/README.md` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ The URL is the browser's link to its agent, not one setup. A finished or cancell
 
 ## Inputs
 
-Inputs include `text`, `choice`, `model` and `entry-point`, plus the legacy `product` kind. A choice carries `options` (`id`, `label`, `description`, `icon`, `variants`), an optional `default` and a `help` note the browser renders as a "help me choose" disclosure. Option ids are unique, and neither option nor variant ids may contain `:`. The answer is the option id, `<option>:<variant>` when the option has variants (`langgraph:python`), or the user's own text when none of the options fit (including any text with more than one `:`); the stream marks that answer `custom`. An agent's own choice is multi-select unless asked with `--single`: the user checks any number of options (none may have variants), and the answer is a JSON array of those entries, which `wait` and the stream print as an array and `status` holds as text. `--single` is for options that exclude each other (one framework, one model, yes or no) and answers one id. Every one of the agent's own options must carry an `icon` from the pack `OPTION_ICONS` exports (`--icons "slack=message,email=mail"`); the CLI refuses the question otherwise. A preset option carries a brand mark instead. Every answer may carry a `note` from the user. A model input lists providers as its options; the browser collects the provider, its API key, the model and an optional reasoning effort, and the answer is that object as JSON (`{"provider","model","reasoningEffort"?}`); the API key is deposited separately and only ever reaches the env file the agent names through `env`.
+Inputs include `text`, `choice`, `model` and `entry-point`, plus the legacy `product` kind. A choice carries `options` (`id`, `label`, `description`, `icon`, `variants`), an optional `default` and a `help` note the browser renders as a "help me choose" disclosure. Option ids are unique, and neither option nor variant ids may contain `:`. The answer is the option id, `<option>:<variant>` when the option has variants (`langgraph:python`), or the user's own text when none of the options fit (including any text with more than one `:`); the stream marks that answer `custom`. An agent's own choice is multi-select unless asked with `--single`: the user checks any number of options (none may have variants), and the answer is a JSON array of those entries, which `wait` and the stream print as an array and `status` holds as text. `--single` is for options that exclude each other (one framework, one model, yes or no) and answers one id. Every one of the agent's own options must carry an `icon` from the pack `OPTION_ICONS` exports (`--icons "slack=message,email=mail"`); the CLI refuses the question otherwise. A preset option carries a brand mark instead. Every answer may carry a `note` from the user. A model input lists providers as its options; the browser collects the provider, its API key, the model and an optional reasoning effort, and the answer is that object as JSON (`{"provider","model","reasoningEffort"?}`); the API key is deposited separately and only ever reaches the env file the agent names through `env`. Only the CLI that asked can take it: `ask` keeps a redeem key in a private file under the user's state directory, or a per-user directory under the temp directory, and refuses a model question when neither can hold it, so `env` runs as the same user on the same machine.
 
 When the setup puts an assistant in the app, the agent asks for its entry point after discovering the app, with `ask "<prompt>" --entry-points '<JSON array>' [--default <id>]`. Each of 1–3 options includes a stable `id`, `label`, contextual `description`, and `entryPoint: { formFactor: "modal" | "sidebar" | "full-page", placement, trigger, recommended? }`. At most one option is recommended, and the agent marks it with `recommended` rather than `--default`, which would preselect it. Two alternatives can share a form factor when their placements differ. Entry-point questions accept exactly one option id, with an optional user note; variants, custom ids, a help note and multi-selection are refused. The agent describes the actual app's workflow, placement and opening action, then incorporates the user's selection into the approved plan.
 
```

**File**: `packages/setup-agent/src/cli.test.ts` (modified, +370/-0)
```diff
@@ -1,19 +1,26 @@
+import { createHash } from "node:crypto";
+import type { connectCheckout } from "./client";
 import { initialCheckoutState, type Checkout } from "./protocol";
 import { describe, expect, it, onTestFinished, vi } from "vitest";
 import {
   chmod,
   mkdtemp,
+  mkdir,
+  readdir,
   readFile,
+  realpath,
   rm,
   stat,
   symlink,
+  unlink,
   writeFile,
 } from "node:fs/promises";
 import { tmpdir } from "node:os";
 import { join } from "node:path";
 import {
   HELP,
   INSTRUCTIONS,
+  main,
   askSeed,
   agentInstructions,
   diffEvents,
@@ -24,6 +31,15 @@ import {
   writeEnvSecret,
 } from "./cli";
 
+const { connectCheckoutMock } = vi.hoisted(() => ({
+  connectCheckoutMock: vi.fn<typeof connectCheckout>(),
+}));
+
+vi.mock("./client", async (importOriginal) => ({
+  ...(await importOriginal<typeof import("./client")>()),
+  connectCheckout: connectCheckoutMock,
+}));
+
 describe("the agent's briefing", () => {
   it("preserves the published instructions export and setup-created event wording", () => {
     expect(INSTRUCTIONS).toBe(agentInstructions);
@@ -646,3 +662,357 @@ describe("writeEnvSecret", () => {
     );
   });
 });
+
+describe("model key handoff", () => {
+  const fixture = async (stateHomePath?: (root: string) => Promise<string>) => {
+    const root = await mkdtemp(join(tmpdir(), "setup-agent-state-"));
+    const stateHome = stateHomePath
+      ? await stateHomePath(root)
+      : await realpath(root);
+    const stateHomeVariable =
+      process.platform === "win32" ? "LOCALAPPDATA" : "XDG_STATE_HOME";
+    const prior = process.env[stateHomeVariable];
+    process.env[stateHomeVariable] = stateHome;
+    const state: Checkout.State = {
+      ...initialCheckoutState(),
+      id: "setup-a",
+      createdAt: 1,
+      status: "planning",
+    };
+    const ask = vi.fn(async (seed: Checkout.InputSeed) => {
+      state.inputs.push({
+        ...seed,
+        id: "q1",
+        phase: "planning",
+        kind: "model",
+        optional: false,
+        status: "open",
+        createdAt: 2,
+      });
+      return { inputId: "q1" };
+    });
+    const client = { state, commands: { "agent/ask": ask }, dispose: vi.fn() };
+    connectCheckoutMock.mockResolvedValue(
+      client as unknown as Awaited<ReturnType<typeof connectCheckout>>,
+    );
+    const stdout = vi.spyOn(process.stdout, "write").mockReturnValue(true);
+    onTestFinished(async () => {
+      stdout.mockRestore();
+      connectCheckoutMock.mockReset();
+      vi.unstubAllGlobals();
+      vi.unstubAllEnvs();
+      if (prior === undefined) delete process.env[stateHomeVariable];
+      else process.env[stateHomeVariable] = prior;
+      await rm(root, { recursive: true, force: true });
+    });
+    return { state, ask, stateHome, root };
+  };
+
+  const setup = async (stateHomePath?: (root: string) => Promise<string>) => {
+    const context = await fixture(stateHomePath);
+    await main([
+      "https://checkout.test/session",
+      "ask",
+      "--preset",
+      "llm-provider",
+    ]);
+    const directory = join(context.stateHome, "setup-agent");
+    const files = await readdir(directory);
+    const keyFile = join(directory, files[0]!);
+    const redeemKey = await readFile(keyFile, "utf8");
+    return { ...context, directory, files, keyFile, redeemKey };
+  };
+
+  const answerModel = (state: Checkout.State) => {
+    state.inputs[0]!.status = "answered";
+    state.inputs[0]!.answer = JSON.stringify({
+      provider: "openai",
+      model: "gpt-test",
+    });
+  };
+
+  const fallbackDirectory = async () => {
+    const root = await mkdtemp(join(tmpdir(), "setup-agent-fallback-"));
+    for (const variable of ["TMPDIR", "TMP", "TEMP"])
+      vi.stubEnv(variable, root);
+    onTestFinished(() => rm(root, { recursive: true, force: true }));
+    return join(
+      root,
+      `setup-agent-${process.platform === "win32" ? (await import("node:os")).userInfo().username : process.getuid!()}`,
+    );
+  };
+
+  const redeem = async (state: Checkout.State, url: string) => {
+    answerModel(state);
+    const fetch = vi.fn(
+      async (_input: string, _init?: RequestInit) =>
+        new Response("provider-key"),
+    );
+    vi.stubGlobal("fetch", fetch);
+    const directory = await mkdtemp(join(tmpdir(), "setup-agent-env-"));
+    onTestFinished(() => rm(directory, { recursive: true, force: true }));
+    const file = join(directory, ".env.local");
+    await main([url, "env", "q1", "OPENAI_API_KEY", "--file", file]);
+    expect(await readFile(file, "utf8")).toBe("OPENAI_API_KEY=provider-key\n");
+    return fetch;
+  };
+
+  it.skipIf(process.platform === "win32")(
+    "stores the model redeem key privately under the user state home",
+    async () => {
+      const { ask, directory, files, keyFile, redeemKey } = await setup();
+      expect(files).toHaveLength(1);
+      expect((await stat(directory)).mode & 0o777).toBe(0o700);
+      expect((await stat(keyFile)).mo
```

**File**: `packages/setup-agent/src/cli.ts` (modified, +163/-3)
```diff
@@ -2,10 +2,20 @@ import { connectCheckout } from "./client";
 import type { CheckoutClient } from "./client";
 import { INPUT_PRESETS, isPresetId, presetInput } from "./presets";
 import { spawn } from "node:child_process";
+import { createHash, randomBytes } from "node:crypto";
 import { constants } from "node:fs";
-import { lstat, open, readFile, realpath } from "node:fs/promises";
+import {
+  chmod,
+  lstat,
+  mkdir,
+  open,
+  readFile,
+  realpath,
+  unlink,
+} from "node:fs/promises";
+import { homedir, tmpdir, userInfo } from "node:os";
 import { createInterface } from "node:readline/promises";
-import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
+import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
 import {
   AGENT_HEARTBEAT_MS,
   OPTION_ICONS,
@@ -719,6 +729,109 @@ export const writeEnvSecret = async (
   }
 };
 
+const redeemKeyDirectories = () => {
+  const stateHome =
+    process.platform === "win32"
+      ? process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local")
+      : process.env.XDG_STATE_HOME || join(homedir(), ".local", "state");
+  return [
+    join(stateHome, "setup-agent"),
+    join(
+      tmpdir(),
+      `setup-agent-${process.platform === "win32" ? userInfo().username : process.getuid!()}`,
+    ),
+  ];
+};
+
+const checkRedeemKeyDirectory = async (directory: string) => {
+  if (!isAbsolute(directory)) {
+    throw new Error("state home must be an absolute path");
+  }
+  const info = await lstat(directory);
+  if (!info.isDirectory() || info.isSymbolicLink()) {
+    throw new Error(
+      `redeem key directory must not be a symbolic link: ${directory}`,
+    );
+  }
+  if (process.platform !== "win32") {
+    if (info.uid !== process.getuid!()) {
+      throw new Error(
+        `redeem key directory must be owned by the user: ${directory}`,
+      );
+    }
+    if ((info.mode & 0o077) !== 0) await chmod(directory, 0o700);
+  }
+};
+
+const prepareRedeemKeyDirectory = async (directory: string) => {
+  if (isAbsolute(directory)) {
+    await mkdir(directory, { recursive: true, mode: 0o700 });
+  }
+  await checkRedeemKeyDirectory(directory);
+};
+
+const saveRedeemKey = async (hash: string, key: string) => {
+  let lastError: unknown;
+  for (const directory of redeemKeyDirectories()) {
+    const file = join(directory, `${hash}.key`);
+    let created = false;
+    try {
+      await prepareRedeemKeyDirectory(directory);
+      const handle = await open(
+        file,
+        constants.O_WRONLY |
+          constants.O_CREAT |
+          constants.O_EXCL |
+          constants.O_NOFOLLOW,
+        0o600,
+      );
+      created = true;
+      try {
+        await handle.writeFile(key);
+      } finally {
+        await handle.close();
+      }
+      return file;
+    } catch (error) {
+      if (created) await unlink(file).catch(() => {});
+      lastError = error;
+    }
+  }
+  throw lastError;
+};
+
+const readRedeemKey = async (hash: string) => {
+  if (!/^[0-9a-f]{64}$/.test(hash)) return undefined;
+  for (const directory of redeemKeyDirectories()) {
+    try {
+      await checkRedeemKeyDirectory(directory);
+      const file = join(directory, `${hash}.key`);
+      const handle = await open(
+        file,
+        constants.O_RDONLY | constants.O_NOFOLLOW,
+      );
+      try {
+        const info = await handle.stat();
+        if (
+          !info.isFile() ||
+          (process.platform !== "win32" && (info.mode & 0o077) !== 0)
+        ) {
+          throw new Error("redeem key file must be private and regular");
+        }
+        const key = await handle.readFile("utf8");
+        if (createHash("sha256").update(key).digest("hex") === hash) {
+          return { key, file };
+        }
+      } finally {
+        await handle.close();
+      }
+    } catch {
+      continue;
+    }
+  }
+  return undefined;
+};
+
 const answerFields = (input: Checkout.Input, answer: string) => ({
   answer: (input.multiple && parseMultipleAnswer(answer)) || answer,
   ...(input.note !== undefined && { note: input.note }),
@@ -816,7 +929,32 @@ export const main = async (argv: readonly string[]) => {
         break;
       }
       case "ask": {
-        const { inputId } = await commands["agent/ask"](askSeed(rest, flags));
+        const seed = askSeed(rest, flags);
+        const redeemKey =
+          seed.kind === "model" ? randomBytes(32).toString("hex") : undefined;
+        const redeemKeyHash =
+          redeemKey === undefined
+            ? undefined
+            : createHash("sha256").update(redeemKey).digest("hex");
+        const keyFile =
+          redeemKey === undefined || redeemKeyHash === undefined
+            ? undefined
+            : await saveRedeemKey(redeemKeyHash, redeemKey).catch(
+                (error: unknown) =>
+                  fail(
+                    `could not store the model redeem key: ${error instanceof Error ? error.message : String(error)}`,
+                  )
```

**File**: `packages/setup-agent/src/host.test.ts` (modified, +40/-0)
```diff
@@ -606,6 +606,46 @@ describe("inputs", () => {
 describe("model inputs", () => {
   const answer = { provider: "openai", model: "gpt-test" };
 
+  it("stores a valid redeem hash only on model inputs", async () => {
+    const host = mount();
+    await host.commands["checkout/create"](seed);
+    await host.commands["checkout/begin-plan"]();
+    const hash = "a".repeat(64);
+    const { inputId } = await host.commands["agent/ask"]({
+      ...presetInput("llm-provider"),
+      redeemKeyHash: hash,
+    });
+    expect(
+      host.state.inputs.find((input) => input.id === inputId)?.redeemKeyHash,
+    ).toBe(hash);
+    await host.commands["checkout/answer"]({
+      inputId,
+      answer: JSON.stringify(answer),
+    });
+    expect(
+      host.state.inputs.find((input) => input.id === inputId)?.redeemKeyHash,
+    ).toBe(hash);
+    for (const redeemKeyHash of [
+      "A".repeat(64),
+      "a".repeat(63),
+      "not-a-hash",
+    ]) {
+      expect(
+        await reason(
+          host.commands["agent/ask"]({
+            ...presetInput("llm-provider"),
+            redeemKeyHash,
+          }),
+        ),
+      ).toEqual({ reason: "invalid-input" });
+    }
+    expect(
+      await reason(
+        host.commands["agent/ask"]({ prompt: "Name?", redeemKeyHash: hash }),
+      ),
+    ).toEqual({ reason: "invalid-input" });
+  });
+
   it("parses a model answer and rejects malformed ones", () => {
     expect(parseModelAnswer(JSON.stringify(answer))).toEqual(answer);
     expect(
```

#### Recent Merged Pull Requests:
- **PR #10071** (2026-10-23): fix(diagrammatic): honor height on micro charts without a width (@okisdev)
- **PR #10066** (2026-10-23): fix: bind setup-agent key redemption to the asking CLI (@okisdev)
- **PR #10065** (2026-10-23): fix(docs): cap MCP tool input and key demo budgets on the client IP (@okisdev)
- **PR #10064** (2026-10-23): fix: narrow starter proxies and guard local agent routes (@okisdev)
- **PR #10063** (2026-10-23): fix: refuse symlinked destinations for project config and secrets (@okisdev)
- **PR #10062** (2026-10-23): fix(variants): refuse non-loopback Vite clients by default (@okisdev)

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

## X. react-mcp): preserve disconnect during failed cleanup (#10037)

**RULE**:
When implementing operations in `.changeset/mcp-disconnect-cleanup.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in assistant-ui/assistant-ui. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6a0c7920`: react-mcp): preserve disconnect during failed cleanup (#10037). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.changeset/mcp-disconnect-cleanup.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
---
"@assistant-ui/react-mcp": patch
---

fix: preserve a later disconnect while a failed connection or OAuth completion is cleaning up its transport.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6a0c7920` are properly handled with clean fallback behavior.
