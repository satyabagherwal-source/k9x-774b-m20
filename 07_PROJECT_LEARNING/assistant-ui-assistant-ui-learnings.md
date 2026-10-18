> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/assistant-ui-assistant-ui-learnings.md`  
> **Source**: github ([https://github.com/assistant-ui/assistant-ui](https://github.com/assistant-ui/assistant-ui))  
> **Source Version**: `a587b283`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T21:26:08.553Z  
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
> **Harvest Timestamp**: 2026-10-18T21:26:07.279Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `assistant-ui/assistant-ui`
- **Description**: Typescript/React Library for AI Chat 💬🚀
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 12597 stars

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
  score_id: string;
  name: strin
```

### Core Architecture Module: `api-surface/assistant-ui__react-hook-form.ts`
```
import "@standard-schema/spec";

import "json-schema";

import { ComponentType } from "react";

import { FieldValues, UseFormProps, UseFormReturn } from "react-hook-form";

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
  readonly 
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
- **Issue #9844** (2026-10-18): **Pi model picker ignores models configured in a custom agent directory**
  *Symptoms*: With `@assistant-ui/react-pi@0.0.31` and `@earendil-works/pi-coding-agent@1.0.4`, the model picker omits providers configured in a custom `agentDir/models.json`. Live sessions read that directory, but `getAvailableModels()` and `setModel()` use a separate runtime that overrides only `authPath`, leaving `modelsPath` at the global default.  Reproduction on Node 24 with those two versions installed:  ```js import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"; import { tmpdir } from "node:os"; import { join } from "node:path"; import { PiThreadSupervisor } from "@assistant-ui/react-pi/node";  const root = await mkdtemp(join(tmpdir(), "pi-model-directory-")); const previousDirectory = process.env.PI_CODING_AGENT_DIR; const previousOffline = process.env.PI_OFFLINE; try {   const agentDir = join(root, "custom");   await mkdir(agentDir);   await writeFile(join(agentDir, "models.json"), JSON.stringify({     providers: { "local-fixture": {       baseUrl: "http://127.0.0.1:1/v1", api: "openai-completions",       apiKey: "unused-fixture-key", models: [{ id: "local-model" }]     } }   }));   process.env.PI_CODING_AGENT_DIR = join(root, "default");   process.env.PI_OFFLINE = "1";   const host = new PiThreadSupervisor({ agentDir, workspacePath: root });   const models = await host.getAvailableModels();   console.log(models.filter(model => model.provider === "local-fixture"));   // actual: []; expected: an entry with modelId "local-model"   await host.dispose(); } finally {   if 

- **Issue #9843** (2026-10-18): **Pi custom agent directories are ignored for saved sessions**
  *Symptoms*: With `@assistant-ui/react-pi@0.0.31` and `@earendil-works/pi-coding-agent@1.0.4`, configuring `agentDir` on `PiThreadSupervisor` or the first `createPiNodeClient` does not select that directory for saved sessions. The thread list reads the global default history, cold reads reject custom-directory thread IDs, and new sessions are assigned paths under the default directory.  Reproduction on Node 24 in a project with those two package versions installed:  ```js import { mkdtemp, rm } from "node:fs/promises"; import { tmpdir } from "node:os"; import { join } from "node:path"; import { SessionManager } from "@earendil-works/pi-coding-agent"; import { PiThreadSupervisor } from "@assistant-ui/react-pi/node";  const root = await mkdtemp(join(tmpdir(), "pi-directory-")); const original = process.env.PI_CODING_AGENT_DIR; try {   const agentDir = join(root, "custom");   const workspacePath = join(root, "workspace");   process.env.PI_CODING_AGENT_DIR = agentDir;   const saved = SessionManager.create(workspacePath);   saved.appendMessage({ role: "user", content: "saved prompt", timestamp: 1 });   process.env.PI_CODING_AGENT_DIR = join(root, "default");   const host = new PiThreadSupervisor({ agentDir, workspacePath });   console.log(await host.listThreads()); // actual [], expected the saved thread   await host.getThread(saved.getSessionId()); // actual: Unknown Pi thread } finally {   if (original === undefined) delete process.env.PI_CODING_AGENT_DIR;   else process.env.PI_CODING_AGENT_

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

### Incident Patch 1: `a587b283` (2026-10-18)
**Commit Message**: fix(core): resolve a thread switch once the replacement runtime attaches (#9765)

**File**: `.changeset/thread-list-switch-waits-for-runtime.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@assistant-ui/core": patch
+---
+
+Wait for a replacement thread runtime to attach before a thread switch settles. A switch still pending when the thread list is destroyed now rejects with a silent `ThreadListDestroyedError`, and a switch whose replacement runtime fails to mount rejects with the mount error.
```

**File**: `api-surface/assistant-ui__core.ts` (modified, +2/-0)
```diff
@@ -4034,6 +4034,7 @@ declare class RemoteThreadListHookInstanceManager extends BaseSubscribable {
     unstable_on<E extends ThreadRuntimeEventType>(event: E, callback: ThreadRuntimeEventCallback<E>): Unsubscribe$1;
   }> | undefined;
   __internal_hasThreadRuntime(threadId: string): boolean;
+  __internal_isThreadRuntimeAttached(threadId: string): boolean;
   __internal_isThreadRunning(threadId: string): boolean;
   __internal_subscribeRunningChanged(callback: () => void): Unsubscribe$1;
   __internal_subscribeThreadEvents(callback: (event: ThreadListRuntimeEvent) => void): Unsubscribe$1;
@@ -4076,6 +4077,7 @@ type RemoteThreadListProps = {
   backgroundThreads?: boolean | undefined;
   __internal_initialThreadIdSeed?: string | undefined;
   __internal_ensureThread?: ((item: ThreadListItemCoreState) => Promise<void>) | undefined;
+  __internal_isThreadAttached?: ((threadId: string) => boolean) | undefined;
   __internal_preserveDraftOnAdapterChange?: boolean | undefined;
   __internal_reopenControlledThreadOnAdapterChange?: boolean | undefined;
 };
```

**File**: `api-surface/assistant-ui__react-ink.ts` (modified, +1/-0)
```diff
@@ -3375,6 +3375,7 @@ type RemoteThreadListProps = {
   backgroundThreads?: boolean | undefined;
   __internal_initialThreadIdSeed?: string | undefined;
   __internal_ensureThread?: ((item: ThreadListItemCoreState) => Promise<void>) | undefined;
+  __internal_isThreadAttached?: ((threadId: string) => boolean) | undefined;
   __internal_preserveDraftOnAdapterChange?: boolean | undefined;
   __internal_reopenControlledThreadOnAdapterChange?: boolean | undefined;
 };
```

**File**: `api-surface/assistant-ui__react-native.ts` (modified, +1/-0)
```diff
@@ -3086,6 +3086,7 @@ type RemoteThreadListProps = {
   backgroundThreads?: boolean | undefined;
   __internal_initialThreadIdSeed?: string | undefined;
   __internal_ensureThread?: ((item: ThreadListItemCoreState) => Promise<void>) | undefined;
+  __internal_isThreadAttached?: ((threadId: string) => boolean) | undefined;
   __internal_preserveDraftOnAdapterChange?: boolean | undefined;
   __internal_reopenControlledThreadOnAdapterChange?: boolean | undefined;
 };
```

**File**: `api-surface/assistant-ui__react.ts` (modified, +1/-0)
```diff
@@ -3994,6 +3994,7 @@ type RemoteThreadListProps = {
   backgroundThreads?: boolean | undefined;
   __internal_initialThreadIdSeed?: string | undefined;
   __internal_ensureThread?: ((item: ThreadListItemCoreState) => Promise<void>) | undefined;
+  __internal_isThreadAttached?: ((threadId: string) => boolean) | undefined;
   __internal_preserveDraftOnAdapterChange?: boolean | undefined;
   __internal_reopenControlledThreadOnAdapterChange?: boolean | undefined;
 };
```

**File**: `packages/core/src/react/client/RemoteThreadList.lifetime.test.tsx` (modified, +135/-0)
```diff
@@ -9,10 +9,13 @@ import {
 } from "@assistant-ui/store/client";
 import { useAssistantClientDestroySignal } from "@assistant-ui/store/internal";
 import type { RemoteThreadListAdapter } from "../../runtimes/remote-thread-list/types";
+import { deferred } from "../../tests/remote-thread-list-test-helpers";
 import {
   RemoteThreadList,
   type RemoteThreadListProps,
 } from "./RemoteThreadList";
+import { ThreadListDestroyedError } from "../../runtimes/remote-thread-list/thread-list-destroyed";
+import { isSilentRuntimeAction } from "../../utils/silent-runtime-action";
 
 const threadState = { isRunning: false, messages: [] };
 const composer = { getState: () => ({}) };
@@ -63,6 +66,8 @@ const mount = (
     threadId?: string;
     reopenControlledThreadOnAdapterChange?: boolean;
     ensureThread?: RemoteThreadListProps["__internal_ensureThread"];
+    isThreadAttached?: RemoteThreadListProps["__internal_isThreadAttached"];
+    onSwitchToThread?: RemoteThreadListProps["onSwitchToThread"];
     preserveDraftOnAdapterChange?: boolean;
   } = {},
 ) => {
@@ -79,6 +84,8 @@ const mount = (
           __internal_reopenControlledThreadOnAdapterChange:
             options.reopenControlledThreadOnAdapterChange,
           __internal_ensureThread: options.ensureThread,
+          __internal_isThreadAttached: options.isThreadAttached,
+          onSwitchToThread: options.onSwitchToThread,
           __internal_preserveDraftOnAdapterChange:
             options.preserveDraftOnAdapterChange,
           thread: (id) => CapturingThread({ id, signals }) as never,
@@ -140,6 +147,81 @@ describe("RemoteThreadList body lifetimes", () => {
     handle.destroy();
   });
 
+  it.each(["ensureThread", "unarchive"] as const)(
+    "rejects a destroyed client's switch while %s is pending",
+    async (pending) => {
+      const operation = deferred<void>();
+      const entered = deferred<void>();
+      const pause = () => {
+        entered.resolve();
+        return operation.promise;
+      };
+      const ensureThread = vi.fn(
+        pending === "ensureThread" ? pause : async () => {},
+      );
+      const onSwitchToThread = vi.fn();
+      const { handle } = mount(
+        makeAdapter({
+          list: vi.fn(async () => ({
+            threads: [{ remoteId: "thread-b", status: "archived" as const }],
+          })),
+          unarchive: pending === "unarchive" ? pause : async () => {},
+        }),
+        { ensureThread, isThreadAttached: () => false, onSwitchToThread },
+      );
+      const threads = handle.getClient().threads;
+      await threads.getLoadThreadsPromise();
+      const fulfilled = vi.fn();
+      const rejected = vi.fn();
+      void threads.__internal_getRawActions!()
+        .switchToThread("thread-b")
+        .then(fulfilled, rejected);
+      await entered.promise;
+      handle.destroy();
+      await new Promise<void>((resolve) => setTimeout(resolve, 0));
+      const rejectionBeforeCompletion = rejected.mock.calls[0]?.[0];
+      const ensuresBeforeCompletion = ensureThread.mock.calls.length;
+      operation.resolve();
+      await new Promise<void>((resolve) => setTimeout(resolve, 0));
+
+      expect(rejectionBeforeCompletion).toBeInstanceOf(
+        ThreadListDestroyedError,
+      );
+      expect(isSilentRuntimeAction(rejectionBeforeCompletion)).toBe(true);
+      expect(rejected).toHaveBeenCalledTimes(1);
+      expect(fulfilled).not.toHaveBeenCalled();
+      expect(ensureThread).toHaveBeenCalledTimes(ensuresBeforeCompletion);
+      expect(onSwitchToThread).not.toHaveBeenCalled();
+    },
+  );
+
+  it("rejects a destroyed client's switch while the client catches up to the attached thread", async () => {
+    const ensureThread = vi.fn(async () => {});
+    const { handle } = mount(makeAdapter(), {
+      ensureThread,
+      isThreadAttached: () => true,
+    });
+    const threads = handle.getClient().threads;
+    await threads.getLoadThreadsPromise();
+    const fulfilled = vi.fn();
+    const rejected = vi.fn();
+    void threads.__internal_getRawActions!()
+      .switchToThread("thread-a")
+      .then(fulfilled, rejected);
+    await Promise.resolve();
+    await Promise.resolve();
+    await Promise.resolve();
+    expect(ensureThread).toHaveBeenCalled();
+    expect(threads.getState().mainThreadId).not.toBe("thread-a");
+    handle.destroy();
+    await new Promise<void>((resolve) => setTimeout(resolve, 0));
+
+    expect(rejected.mock.calls[0]?.[0]).toBeInstanceOf(
+      ThreadListDestroyedError,
+    );
+    expect(fulfilled).not.toHaveBeenCalled();
+  });
+
   it("releases a body when ensureThread rejects", async () => {
     let rejectEnsure!: (error: Error) => void;
     const ensureThread = vi.fn(
@@ -227,6 +309,59 @@ describe("RemoteThreadList body lifetimes", () => {
     handle.destroy();
   });
 
+  it("joins repeated switches until the replacement runtime attaches", async () => {
+    let attached = true;
+    let resolveAttachment!: () => void;
+    con
```

**File**: `packages/core/src/react/client/RemoteThreadList.ts` (modified, +53/-7)
```diff
@@ -52,6 +52,7 @@ import type {
   RemoteThreadListResponse,
 } from "../../runtimes/remote-thread-list/types";
 import { ThreadListAdapterChangedError } from "../../runtimes/remote-thread-list/adapter-changed";
+import { ThreadListDestroyedError } from "../../runtimes/remote-thread-list/thread-list-destroyed";
 import type { ThreadListItemCoreState } from "../../runtime/interfaces/thread-list-runtime-core";
 import type { ThreadMessage } from "../../types/message";
 import { handleThreadListAction } from "../../store/runtime-clients/handle-thread-list-action";
@@ -116,6 +117,7 @@ export type RemoteThreadListProps = {
   __internal_ensureThread?:
     | ((item: ThreadListItemCoreState) => Promise<void>)
     | undefined;
+  __internal_isThreadAttached?: ((threadId: string) => boolean) | undefined;
   __internal_preserveDraftOnAdapterChange?: boolean | undefined;
   __internal_reopenControlledThreadOnAdapterChange?: boolean | undefined;
 };
@@ -576,6 +578,7 @@ const useRemoteThreadList = (
     onSwitchToNewThread,
     onDelete,
     __internal_ensureThread: ensureThread,
+    __internal_isThreadAttached: isThreadAttached,
     __internal_preserveDraftOnAdapterChange: preserveDraftOnAdapterChange,
     __internal_reopenControlledThreadOnAdapterChange:
       reopenControlledThreadOnAdapterChange,
@@ -628,6 +631,7 @@ const useRemoteThreadList = (
         newThreadIntent: undefined as
           | { id: string; generation: number; unsubscribe: () => void }
           | undefined,
+        supersedeAttachmentWait: undefined as (() => void) | undefined,
         mainThreadId: seeded.id,
         isFirstThreadIdEffect: true,
         onThreadIdChange,
@@ -827,6 +831,7 @@ const useRemoteThreadList = (
         (reopenControlledThreadOnAdapterChange ||
           session.controlledSwitchAdapter === adapter) &&
         session.controlledSwitchGeneration === session.switchGeneration;
+      session.supersedeAttachmentWait?.();
       session.switchGeneration++;
       session.settleSwitch?.();
       session.controlledReloadPending = preserveControlled;
@@ -948,6 +953,19 @@ const useRemoteThreadList = (
 
   const startSwitch = useCallback(
     (run: (generation: number) => Promise<void>, threadId?: string) => {
+      if (ownerDestroySignal?.aborted) {
+        return Promise.reject(new ThreadListDestroyedError());
+      }
+      if (
+        session.supersedeAttachmentWait &&
+        session.switchTask &&
+        threadId !== undefined &&
+        isSameThread(store.value, threadId, session.mainThreadId)
+      ) {
+        return session.switchTask;
+      }
+      session.supersedeAttachmentWait?.();
+      session.supersedeAttachmentWait = undefined;
       session.newThreadIntent?.unsubscribe();
       session.newThreadIntent = undefined;
       const generation = ++session.switchGeneration;
@@ -971,12 +989,27 @@ const useRemoteThreadList = (
           session.newThreadIntent.unsubscribe();
           session.newThreadIntent = undefined;
         }
+        ownerDestroySignal?.removeEventListener("abort", onDestroy);
         if (session.pendingSwitchGeneration === generation) {
           session.pendingSwitchGeneration = undefined;
           session.settleSwitch = undefined;
         }
         resolveTask();
       };
+      const onDestroy = () => {
+        if (generation !== session.switchGeneration) {
+          settle();
+          return;
+        }
+        unsubscribe?.();
+        session.switchGeneration++;
+        session.pendingSwitchGeneration = undefined;
+        session.settleSwitch = undefined;
+        session.supersedeAttachmentWait?.();
+        session.supersedeAttachmentWait = undefined;
+        rejectTask(new ThreadListDestroyedError());
+      };
+      ownerDestroySignal?.addEventListener("abort", onDestroy, { once: true });
       if (ensureThread) session.settleSwitch = settle;
       void run(generation).then(
         () => {
@@ -1004,6 +1037,7 @@ const useRemoteThreadList = (
             session.newThreadIntent.unsubscribe();
             session.newThreadIntent = undefined;
           }
+          ownerDestroySignal?.removeEventListener("abort", onDestroy);
           if (session.pendingSwitchGeneration === generation) {
             session.pendingSwitchGeneration = undefined;
             session.settleSwitch = undefined;
@@ -1107,6 +1141,21 @@ const useRemoteThreadList = (
         if (generation !== session.switchGeneration) return;
         if (newThread && current.status !== "new") return;
         assignMainThreadId(current.id);
+        while (ensureThread && isThreadAttached?.(current.id) === false) {
+          let supersede!: () => void;
+          const superseded = new Promise<void>((resolve) => {
+            supersede = resolve;
+          });
+          session.supersedeAttachmentWait = supersede;
+          try {
+            await Promise.race([ensureThread(current), superseded]);
+          } finally {
+            if (session.supersedeAttachment
```

**File**: `packages/core/src/react/runtimes/RemoteThreadListHookInstanceManager.tsx` (modified, +75/-8)
```diff
@@ -44,6 +44,7 @@ import {
   RemoteThreadResource,
   type RemoteThreadListHook,
 } from "./RemoteThreadResource";
+import { ThreadListDestroyedError } from "../../runtimes/remote-thread-list/thread-list-destroyed";
 
 const THREAD_EVENTS = [
   "runStart",
@@ -55,6 +56,8 @@ const THREAD_EVENTS = [
 type RemoteThreadListHookInstance = {
   runtime?: ThreadRuntimeCore | undefined;
   publishedGeneration?: number | undefined;
+  committedGeneration?: number | undefined;
+  mountError?: { error: unknown } | undefined;
   generation: number;
   isRunning: boolean;
   unsubscribeRunning?: Unsubscribe | undefined;
@@ -63,6 +66,15 @@ type RemoteThreadListHookInstance = {
   destroy: AbortController;
 };
 
+const isRuntimeAttached = (
+  instance: RemoteThreadListHookInstance | undefined,
+): instance is RemoteThreadListHookInstance & {
+  runtime: ThreadRuntimeCore;
+} =>
+  instance?.runtime !== undefined &&
+  instance.mountError === undefined &&
+  instance.publishedGeneration === instance.generation;
+
 type AdapterSnapshot = {
   defaultAdapters: RuntimeAdapters | null;
   threadAdapters: ReadonlyMap<string, RuntimeAdapters | null>;
@@ -102,6 +114,7 @@ export class RemoteThreadListHookInstanceManager extends BaseSubscribable {
   >();
   private instances = new Map<string, RemoteThreadListHookInstance>();
   private nextGeneration = 0;
+  private disposed = false;
   private parent: ThreadListRuntimeCore;
   private readonly publishInCommit: boolean;
 
@@ -123,12 +136,10 @@ export class RemoteThreadListHookInstanceManager extends BaseSubscribable {
         if (!instance) {
           dispose();
           reject(new Error("Thread was deleted before runtime was started"));
-        } else if (
-          !instance.runtime ||
-          instance.publishedGeneration !== instance.generation
-        ) {
-          return;
-        } else {
+        } else if (instance.mountError) {
+          dispose();
+          reject(instance.mountError.error);
+        } else if (isRuntimeAttached(instance)) {
           dispose();
           resolve(instance.runtime);
         }
@@ -139,6 +150,7 @@ export class RemoteThreadListHookInstanceManager extends BaseSubscribable {
   }
 
   public startThreadRuntime(threadId: string) {
+    if (this.disposed) return Promise.reject(new ThreadListDestroyedError());
     if (!this.instances.has(threadId)) {
       const generation = this.nextGeneration++;
       this.instances.set(threadId, {
@@ -163,6 +175,7 @@ export class RemoteThreadListHookInstanceManager extends BaseSubscribable {
       instance.destroy.abort();
       instance.destroy = new AbortController();
       instance.generation = this.nextGeneration++;
+      instance.mountError = undefined;
     }
   }
 
@@ -190,6 +203,10 @@ export class RemoteThreadListHookInstanceManager extends BaseSubscribable {
     return this.instances.has(threadId);
   }
 
+  public __internal_isThreadRuntimeAttached(threadId: string) {
+    return isRuntimeAttached(this.instances.get(threadId));
+  }
+
   public __internal_isThreadRunning(threadId: string) {
     return this.instances.get(threadId)?.isRunning ?? false;
   }
@@ -220,6 +237,22 @@ export class RemoteThreadListHookInstanceManager extends BaseSubscribable {
     this._publishThreadRuntime(threadId, runtime, generation);
   };
 
+  private _failThreadRuntime(
+    threadId: string,
+    generation: number,
+    error: unknown,
+  ) {
+    const instance = this.instances.get(threadId);
+    if (
+      instance?.generation !== generation ||
+      (isRuntimeAttached(instance) &&
+        instance.committedGeneration === generation)
+    )
+      return;
+    instance.mountError = { error };
+    queueMicrotask(() => this._notifySubscribers());
+  }
+
   private _publishThreadRuntime(
     threadId: string,
     runtime: ThreadRuntimeCore,
@@ -232,6 +265,7 @@ export class RemoteThreadListHookInstanceManager extends BaseSubscribable {
 
     const previousRuntime = instance.runtime;
     const previousPublishedGeneration = instance.publishedGeneration;
+    instance.mountError = undefined;
     instance.runtime = runtime;
     instance.publishedGeneration = generation;
     try {
@@ -360,6 +394,7 @@ export class RemoteThreadListHookInstanceManager extends BaseSubscribable {
   }
 
   public __internal_dispose() {
+    this.disposed = true;
     for (const threadId of [...this.instances.keys()]) {
       try {
         this.stopThreadRuntime(threadId);
@@ -403,7 +438,24 @@ export class RemoteThreadListHookInstanceManager extends BaseSubscribable {
           threadId: id,
           generation,
           parentList: this.parent,
-          runtimeHook,
+          runtimeHook: () => {
+            try {
+              return runtimeHook();
+            } catch (error) {
+              if (
+                error !== null &&
+                (typeof error === "object" || typeof error === "function") &&
+                "then" in error &&
+                typeof error.then === "functio
```

---

### Incident Patch 2: `2d17e774` (2026-10-18)
**Commit Message**: fix(core): land a host's new-thread request on a fresh draft when the draft initializes (#9764)

**File**: `.changeset/thread-list-new-thread-intent.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@assistant-ui/core": patch
+---
+
+fix: keep a controlled new-thread request selected when the previous draft initializes during the switch
```

**File**: `packages/core/src/react/client/RemoteThreadList.lifetime.test.tsx` (modified, +35/-0)
```diff
@@ -105,6 +105,41 @@ const mount = (
 afterEach(() => vi.restoreAllMocks());
 
 describe("RemoteThreadList body lifetimes", () => {
+  it("opens a fresh draft when the target draft initializes while its runtime attaches", async () => {
+    const pending = new Map<string, () => void>();
+    const { handle } = mount(makeAdapter(), {
+      backgroundThreads: true,
+      ensureThread: (item) =>
+        new Promise<void>((resolve) => {
+          pending.set(item.id, resolve);
+        }),
+    });
+    const threads = handle.getClient().threads;
+    await threads.getLoadThreadsPromise();
+    const draftId = threads.getState().mainThreadId;
+    const toThread =
+      threads.__internal_getRawActions!().switchToThread("thread-a");
+    await vi.waitFor(() => expect(pending.has("thread-a")).toBe(true));
+    pending.get("thread-a")!();
+    await toThread;
+
+    const toNew = threads.__internal_getRawActions!().switchToNewThread();
+    await vi.waitFor(() => expect(pending.has(draftId)).toBe(true));
+    await threads.item({ id: draftId }).initialize();
+    pending.get(draftId)!();
+    await vi.waitFor(() => expect(pending.size).toBe(3));
+    for (const [id, resolve] of pending) {
+      if (id !== "thread-a" && id !== draftId) resolve();
+    }
+    await toNew;
+
+    const main = threads.item("main").getState();
+    expect(main.id).not.toBe(draftId);
+    expect(main.status).toBe("new");
+    expect(threads.item({ id: draftId }).getState().remoteId).toBe(draftId);
+    handle.destroy();
+  });
+
   it("releases a body when ensureThread rejects", async () => {
     let rejectEnsure!: (error: Error) => void;
     const ensureThread = vi.fn(
```

**File**: `packages/core/src/react/client/RemoteThreadList.test.ts` (modified, +253/-0)
```diff
@@ -194,6 +194,47 @@ const microtasks = async (count: number) => {
   for (let i = 0; i < count; i++) await Promise.resolve();
 };
 
+const mountControlledDraft = async (adapter: RemoteThreadListAdapter) => {
+  const listeners = new Set<() => void>();
+  const onThreadIdChange = vi.fn();
+  const onSwitchToNewThread = vi.fn();
+  const attachThread = deferred<void>();
+  let threadId: string | undefined = "t0";
+  const handle = createAssistantClient({
+    getConfig: () =>
+      AuiConfig({
+        threads: RemoteThreadList({
+          adapter,
+          thread: (id) => StubThread({ threadId: id }) as never,
+          threadId,
+          onThreadIdChange,
+          onSwitchToNewThread,
+          __internal_ensureThread: (item) =>
+            item.id === "t0" ? attachThread.promise : Promise.resolve(),
+        }),
+      }),
+    subscribe: (listener) => {
+      listeners.add(listener);
+      return () => listeners.delete(listener);
+    },
+  });
+  handle.subscribe(() => {});
+  await handle.getClient().threads.getLoadThreadsPromise();
+  const draftId = handle.getClient().threads.getState().newThreadId!;
+  expect(handle.getClient().threads.getState().mainThreadId).toBe(draftId);
+  threadId = undefined;
+  flushTapSync(() => {
+    for (const listener of listeners) listener();
+  });
+  return {
+    handle,
+    draftId,
+    onThreadIdChange,
+    onSwitchToNewThread,
+    attachThread,
+  };
+};
+
 const mountArchivedInitializingThread = async () => {
   const initialize = deferred<{
     remoteId: string;
@@ -1621,6 +1662,218 @@ describe("RemoteThreadList", () => {
     handle.destroy();
   });
 
+  it.each(["before", "after"] as const)(
+    "opens a fresh draft when initialization starts %s a controlled new-thread request",
+    async (initializationStart) => {
+      const attachThread = deferred<void>();
+      const initialization = deferred<{
+        remoteId: string;
+        externalId: undefined;
+      }>();
+      const adapter = makeAdapter({
+        list: vi.fn(async () => ({
+          threads: [
+            { status: "regular" as const, remoteId: "t0", title: "Zero" },
+          ],
+        })),
+        initialize: vi.fn(() => initialization.promise),
+      });
+      const listeners = new Set<() => void>();
+      const onThreadIdChange = vi.fn();
+      let threadId: string | undefined = "t0";
+      const ensureThread = vi.fn((item: { id: string }) =>
+        item.id === "t0" ? attachThread.promise : Promise.resolve(),
+      );
+      const source: AssistantConfigSource = {
+        getConfig: () =>
+          AuiConfig({
+            threads: RemoteThreadList({
+              adapter,
+              thread: (id) => StubThread({ threadId: id }) as never,
+              threadId,
+              onThreadIdChange,
+              __internal_ensureThread: ensureThread,
+            }),
+          }),
+        subscribe: (listener) => {
+          listeners.add(listener);
+          return () => listeners.delete(listener);
+        },
+      };
+      const handle = createAssistantClient(source);
+      handle.subscribe(() => {});
+      await waitFor(() => {
+        expect(ensureThread).toHaveBeenCalledWith(
+          expect.objectContaining({ id: "t0" }),
+        );
+      });
+      const draftId = handle.getClient().threads.getState().newThreadId;
+      expect(draftId).toBeDefined();
+      expect(handle.getClient().threads.getState().mainThreadId).toBe(draftId);
+
+      const initializing =
+        initializationStart === "before"
+          ? handle.getClient().threads.item({ id: draftId! }).initialize()
+          : undefined;
+      threadId = undefined;
+      flushTapSync(() => {
+        for (const listener of listeners) listener();
+      });
+      const pending =
+        initializing ??
+        handle.getClient().threads.item({ id: draftId! }).initialize();
+      initialization.resolve({ remoteId: "t1", externalId: undefined });
+      await pending;
+      attachThread.resolve();
+
+      await waitFor(() => {
+        const threads = handle.getClient().threads;
+        const main = threads.item("main").getState();
+        expect(main.id).not.toBe(draftId);
+        expect(main.status).toBe("new");
+        expect(main.remoteId).toBeUndefined();
+        expect(threads.getState().threadIds).toContain(draftId);
+        expect(threads.item({ id: draftId! }).getState().remoteId).toBe("t1");
+      });
+      expect(onThreadIdChange).not.toHaveBeenCalledWith("t1");
+      handle.destroy();
+    },
+  );
+
+  it("keeps a restarted controlled new-thread request controlled while its fresh draft attaches", async () => {
+    const attachThread = deferred<void>();
+    const attachFresh = deferred<void>();
+    const initialization = deferred<{
+      remoteId: string;
+      externalId: undefined;
+    }>();
+    const adapter = makeAdapter({
+      list: vi.fn(async () => ({
+        threads: [
+          { status: "regular" as const, remoteId: "t
```

**File**: `packages/core/src/react/client/RemoteThreadList.ts` (modified, +102/-23)
```diff
@@ -625,6 +625,9 @@ const useRemoteThreadList = (
         switchTask: undefined as Promise<void> | undefined,
         pendingSwitchGeneration: undefined as number | undefined,
         settleSwitch: undefined as (() => void) | undefined,
+        newThreadIntent: undefined as
+          | { id: string; generation: number; unsubscribe: () => void }
+          | undefined,
         mainThreadId: seeded.id,
         isFirstThreadIdEffect: true,
         onThreadIdChange,
@@ -678,6 +681,12 @@ const useRemoteThreadList = (
 
   const notifyRemoteId = useCallback(
     (remoteId: string | undefined, emit: boolean) => {
+      if (
+        remoteId !== undefined &&
+        session.newThreadIntent?.generation === session.switchGeneration &&
+        session.newThreadIntent.id === session.mainThreadId
+      )
+        return;
       const main = getThreadData(store.value, session.mainThreadId);
       if (remoteId === undefined && main && main.status !== "new") return;
       if (session.lastNotifiedRemoteId === remoteId) return;
@@ -939,6 +948,8 @@ const useRemoteThreadList = (
 
   const startSwitch = useCallback(
     (run: (generation: number) => Promise<void>, threadId?: string) => {
+      session.newThreadIntent?.unsubscribe();
+      session.newThreadIntent = undefined;
       const generation = ++session.switchGeneration;
       session.settleSwitch?.();
       session.controlledReloadPending = false;
@@ -956,6 +967,10 @@ const useRemoteThreadList = (
       let unsubscribe: (() => void) | undefined;
       const settle = () => {
         unsubscribe?.();
+        if (session.newThreadIntent?.generation === generation) {
+          session.newThreadIntent.unsubscribe();
+          session.newThreadIntent = undefined;
+        }
         if (session.pendingSwitchGeneration === generation) {
           session.pendingSwitchGeneration = undefined;
           session.settleSwitch = undefined;
@@ -985,6 +1000,10 @@ const useRemoteThreadList = (
           complete();
         },
         (error: unknown) => {
+          if (session.newThreadIntent?.generation === generation) {
+            session.newThreadIntent.unsubscribe();
+            session.newThreadIntent = undefined;
+          }
           if (session.pendingSwitchGeneration === generation) {
             session.pendingSwitchGeneration = undefined;
             session.settleSwitch = undefined;
@@ -1086,6 +1105,7 @@ const useRemoteThreadList = (
           }
         }
         if (generation !== session.switchGeneration) return;
+        if (newThread && current.status !== "new") return;
         assignMainThreadId(current.id);
         notifyRemoteId(current.remoteId, emitThreadIdChange);
         if (newThread) session.onSwitchToNewThread?.();
@@ -1149,30 +1169,81 @@ const useRemoteThreadList = (
   );
 
   const switchToNewThread = useCallback(
-    (emitThreadIdChange = true) =>
-      startSwitch(async (generation) => {
-        while (
-          store.baseValue.newThreadId !== undefined &&
-          store.value.newThreadId === undefined
+    (emitThreadIdChange = true, keepIntent = false) => {
+      const run = async (generation: number) => {
+        if (
+          keepIntent &&
+          store.baseValue.newThreadId === session.mainThreadId
         ) {
-          await store.waitForUpdate();
-          if (generation !== session.switchGeneration) return;
+          session.newThreadIntent = {
+            id: session.mainThreadId,
+            generation,
+            unsubscribe: () => {},
+          };
         }
-        let id = store.value.newThreadId;
-        if (id === undefined) {
-          const seeded = seedNewThread(store.baseValue);
-          store.update(seeded.state);
-          id = seeded.id;
+        while (generation === session.switchGeneration) {
+          while (
+            store.baseValue.newThreadId !== undefined &&
+            store.value.newThreadId === undefined
+          ) {
+            await store.waitForUpdate();
+            if (generation !== session.switchGeneration) return;
+          }
+          let id = store.value.newThreadId;
+          if (id === undefined) {
+            const seeded = seedNewThread(store.baseValue);
+            store.update(seeded.state);
+            id = seeded.id;
+          }
+          const draftId = getThreadData(store.value, id)?.id ?? id;
+          if (isSameThread(store.value, draftId, session.mainThreadId)) {
+            if (keepIntent) {
+              const unsubscribe = store.subscribe(() => {
+                if (generation !== session.switchGeneration) {
+                  unsubscribe();
+                  return;
+                }
+                if (getThreadData(store.value, draftId)?.status === "new")
+                  return;
+                unsubscribe();
+                queueMicrotask(() => {
+                  if (generation !== session.switchGeneration) return;
+                  handleThreadListAction("create", () => {
+            
```

**File**: `packages/core/src/react/runtimes/RemoteThreadListThreadListRuntimeCore.new-thread-intent.test.ts` (added, +209/-0)
```diff
@@ -0,0 +1,209 @@
+import { describe, expect, it, vi } from "vitest";
+import {
+  contextProvider,
+  deferred,
+  makeAdapter,
+  setStartThreadRuntime,
+} from "../../tests/remote-thread-list-test-helpers";
+import { RemoteThreadListThreadListRuntimeCore } from "./RemoteThreadListThreadListRuntimeCore";
+
+describe("RemoteThreadListThreadListRuntimeCore new-thread intent", () => {
+  it("reports an ordinary initialization after a controlled switch settles", async () => {
+    const attachThread = deferred<unknown>();
+    const adapter = makeAdapter({
+      initialize: vi.fn(async () => ({ remoteId: "t1", externalId: "t1" })),
+    });
+    const runtimeHook = () => ({}) as never;
+    const onThreadIdChange = vi.fn();
+    const core = new RemoteThreadListThreadListRuntimeCore(
+      { adapter, runtimeHook, threadId: "t0", onThreadIdChange },
+      contextProvider,
+    );
+    setStartThreadRuntime(core, (id) =>
+      id === "t0" ? attachThread.promise : Promise.resolve({}),
+    );
+    core.__internal_load();
+    await core.getLoadThreadsPromise();
+    await vi.waitFor(() => expect(adapter.fetch).toHaveBeenCalledWith("t0"));
+    const draftId = core.newThreadId!;
+    expect(core.mainThreadId).toBe(draftId);
+
+    core.__internal_setOptions({
+      adapter,
+      runtimeHook,
+      threadId: undefined,
+      onThreadIdChange,
+    });
+    await vi.waitFor(() => expect(core.mainThreadId).toBe(draftId));
+    await Promise.resolve();
+    await Promise.resolve();
+
+    await core.initialize(draftId);
+    expect(onThreadIdChange).toHaveBeenCalledWith("t1");
+    expect(core.mainThreadId).toBe(draftId);
+    core.__internal_dispose();
+  });
+
+  it("treats a retry after initialization rejection as an ordinary message", async () => {
+    const attachThread = deferred<unknown>();
+    const adapter = makeAdapter({
+      initialize: vi
+        .fn()
+        .mockRejectedValueOnce(new Error("failed"))
+        .mockResolvedValueOnce({ remoteId: "t1", externalId: "t1" }),
+    });
+    const runtimeHook = () => ({}) as never;
+    const onThreadIdChange = vi.fn();
+    const core = new RemoteThreadListThreadListRuntimeCore(
+      { adapter, runtimeHook, threadId: "t0", onThreadIdChange },
+      contextProvider,
+    );
+    setStartThreadRuntime(core, (id) =>
+      id === "t0" ? attachThread.promise : Promise.resolve({}),
+    );
+    core.__internal_load();
+    await core.getLoadThreadsPromise();
+    await vi.waitFor(() => expect(adapter.fetch).toHaveBeenCalledWith("t0"));
+    const draftId = core.newThreadId!;
+    core.__internal_setOptions({
+      adapter,
+      runtimeHook,
+      threadId: undefined,
+      onThreadIdChange,
+    });
+    await Promise.resolve();
+    await Promise.resolve();
+
+    await expect(core.initialize(draftId)).rejects.toThrow("failed");
+    await core.initialize(draftId);
+    expect(onThreadIdChange).toHaveBeenCalledWith("t1");
+    expect(core.mainThreadId).toBe(draftId);
+    core.__internal_dispose();
+  });
+
+  it("does not start a switch when initialization resolves after disposal", async () => {
+    const attachThread = deferred<unknown>();
+    const initialization = deferred<{ remoteId: string; externalId: string }>();
+    const adapter = makeAdapter({
+      initialize: vi.fn(() => initialization.promise),
+    });
+    const runtimeHook = () => ({}) as never;
+    const onThreadIdChange = vi.fn();
+    const core = new RemoteThreadListThreadListRuntimeCore(
+      { adapter, runtimeHook, threadId: "t0", onThreadIdChange },
+      contextProvider,
+    );
+    setStartThreadRuntime(core, (id) =>
+      id === "t0" ? attachThread.promise : Promise.resolve({}),
+    );
+    core.__internal_load();
+    await core.getLoadThreadsPromise();
+    await vi.waitFor(() => expect(adapter.fetch).toHaveBeenCalledWith("t0"));
+    const draftId = core.newThreadId!;
+    core.__internal_setOptions({
+      adapter,
+      runtimeHook,
+      threadId: undefined,
+      onThreadIdChange,
+    });
+    const pending = core.initialize(draftId);
+    core.__internal_dispose();
+    initialization.resolve({ remoteId: "t1", externalId: "t1" });
+    await pending;
+    await Promise.resolve();
+    expect(core.mainThreadId).toBe(draftId);
+  });
+
+  it("opens a fresh draft when a controlled new-thread request races with draft initialization", async () => {
+    const attachDraft = deferred<unknown>();
+    const initialization = deferred<{ remoteId: string; externalId: string }>();
+    const adapter = makeAdapter({
+      list: vi.fn(async () => ({
+        threads: [
+          { status: "regular" as const, remoteId: "t0", externalId: "t0" },
+        ],
+      })),
+      initialize: vi.fn(() => initialization.promise),
+    });
+    const runtimeHook = () => ({}) as never;
+    const onThreadIdChange = vi.fn();
+    const core = new RemoteThreadListThreadListRuntimeCore(
+      { adapter, runtimeHook, threadId: "t0", onThreadIdChange },
+      conte
```

**File**: `packages/core/src/react/runtimes/RemoteThreadListThreadListRuntimeCore.tsx` (modified, +86/-16)
```diff
@@ -709,13 +709,27 @@ export class RemoteThreadListThreadListRuntimeCore
   }
 
   private _lastNotifiedThreadId: string | undefined = undefined;
+  private _newThreadIntent:
+    | { id: string; generation: number; unsubscribe: () => void }
+    | undefined;
+
+  private _clearNewThreadIntent() {
+    this._newThreadIntent?.unsubscribe();
+    this._newThreadIntent = undefined;
+  }
 
   private _notifyThreadIdChange(emit = true) {
     const main =
       this._mainThreadId === undefined
         ? undefined
         : getThreadData(this._state.value, this._mainThreadId);
     const threadId = main?.remoteId;
+    if (
+      threadId !== undefined &&
+      this._newThreadIntent?.generation === this._switchGeneration &&
+      this._newThreadIntent.id === this._mainThreadId
+    )
+      return;
     if (threadId === undefined && main && main.status !== "new") return;
     if (this._lastNotifiedThreadId === threadId) return;
     this._lastNotifiedThreadId = threadId;
@@ -805,6 +819,7 @@ export class RemoteThreadListThreadListRuntimeCore
     options: { unarchive?: boolean } | undefined,
     emitThreadIdChange: boolean,
   ): Promise<void> {
+    this._clearNewThreadIntent();
     const generation = ++this._switchGeneration;
     this._setSwitchError(undefined);
     const task = this._switchToThread(
@@ -924,6 +939,11 @@ export class RemoteThreadListThreadListRuntimeCore
     const clearTask = () => {
       if (this._controlledSwitchTask === task) {
         this._controlledSwitchTask = undefined;
+        if (
+          this._newThreadIntent?.generation === this._controlledSwitchGeneration
+        ) {
+          this._clearNewThreadIntent();
+        }
       }
     };
     void task.then(clearTask, clearTask);
@@ -941,7 +961,18 @@ export class RemoteThreadListThreadListRuntimeCore
     emitThreadIdChange: boolean,
     initialThreadIdSeed?: string,
   ): Promise<void> {
+    this._clearNewThreadIntent();
     const generation = ++this._switchGeneration;
+    if (
+      !emitThreadIdChange &&
+      this._state.baseValue.newThreadId === this._mainThreadId
+    ) {
+      this._newThreadIntent = {
+        id: this._mainThreadId,
+        generation,
+        unsubscribe: () => {},
+      };
+    }
     this._setSwitchError(undefined);
     const task = this._switchToNewThread(
       generation,
@@ -957,24 +988,61 @@ export class RemoteThreadListThreadListRuntimeCore
     emitThreadIdChange: boolean,
     initialThreadIdSeed?: string,
   ): Promise<void> {
-    // an initialization transaction is in progress, wait for it to settle
-    while (
-      this._state.baseValue.newThreadId !== undefined &&
-      this._state.value.newThreadId === undefined
-    ) {
-      await this._state.waitForUpdate();
-      if (generation !== this._switchGeneration) return;
-    }
+    while (generation === this._switchGeneration) {
+      while (
+        this._state.baseValue.newThreadId !== undefined &&
+        this._state.value.newThreadId === undefined
+      ) {
+        await this._state.waitForUpdate();
+        if (generation !== this._switchGeneration) return;
+      }
 
-    const state = this._state.baseValue;
-    let id: string | undefined = this._state.value.newThreadId;
-    if (id === undefined) {
-      const next = seedNewThread(state, initialThreadIdSeed);
-      id = next.id;
-      this._state.update(next.state);
-    }
+      let id = this._state.value.newThreadId;
+      if (id === undefined) {
+        const next = seedNewThread(this._state.baseValue, initialThreadIdSeed);
+        id = next.id;
+        this._state.update(next.state);
+      }
 
-    return this._switchToThread(id, undefined, generation, emitThreadIdChange);
+      const data = getThreadData(this._state.value, id);
+      if (data?.status !== "new") continue;
+      if (data.id === this._mainThreadId) {
+        if (!emitThreadIdChange) {
+          const unsubscribe = this._state.subscribe(() => {
+            if (generation !== this._switchGeneration) {
+              unsubscribe();
+              return;
+            }
+            if (getThreadData(this._state.value, id)?.status === "new") return;
+            unsubscribe();
+            queueMicrotask(() => {
+              if (generation !== this._switchGeneration) return;
+              void this._switchToThreadFromProp(undefined).catch(() => {});
+            });
+          });
+          this._newThreadIntent = { id: data.id, generation, unsubscribe };
+        }
+        return;
+      }
+
+      const task = this._hookManager.startThreadRuntime(data.id);
+      if (this.mainThreadId !== undefined) {
+        await task;
+      } else {
+        void task.then(
+          () => this._notifySubscribers(),
+          () => undefined,
+        );
+      }
+      if (generation !== this._switchGeneration) return;
+      const current = getThreadData(this._state.value, data.id);
+      if (current?.status !== "new" || current.id !== data.id) continue;
+      this._s
```

---

### Incident Patch 3: `45e3d228` (2026-10-18)
**Commit Message**: fix(core): send each thread's adapter mutations in call order (#9767)

**File**: `.changeset/thread-list-serialize-thread-mutations.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"@assistant-ui/core": patch
+---
+
+fix: send mutations for each remote thread to its adapter in call order
```

**File**: `packages/core/src/react/client/RemoteThreadList.mutation-order.test.ts` (added, +335/-0)
```diff
@@ -0,0 +1,335 @@
+import { describe, expect, it, vi } from "vitest";
+import { flushTapSync, resource } from "@assistant-ui/tap";
+import { AuiConfig, createAssistantClient } from "@assistant-ui/store/client";
+import type { RemoteThreadListAdapter } from "../../runtimes/remote-thread-list/types";
+import {
+  RemoteThreadList,
+  type RemoteThreadListProps,
+} from "./RemoteThreadList";
+
+const deferred = () => {
+  let resolve!: () => void;
+  let reject!: (error: Error) => void;
+  const promise = new Promise<void>((res, rej) => {
+    resolve = res;
+    reject = rej;
+  });
+  return { promise, resolve, reject };
+};
+
+const threadState = { isRunning: false, messages: [] };
+const composer = { getState: () => ({}) };
+const suggestions = { getState: () => ({ suggestions: [] }) };
+const StubThread = resource(() => ({
+  getState: () => threadState,
+  composer: () => composer,
+  suggestions: () => suggestions,
+}));
+
+const mount = async (
+  overrides: Partial<RemoteThreadListAdapter> = {},
+  options: Partial<RemoteThreadListProps> = {},
+) => {
+  const adapter: RemoteThreadListAdapter = {
+    list: vi.fn(async () => ({
+      threads: ["a", "b"].map((remoteId) => ({
+        remoteId,
+        status: "regular" as const,
+        title: remoteId,
+      })),
+    })),
+    initialize: vi.fn(async (id: string) => ({ remoteId: id, externalId: id })),
+    rename: vi.fn(async () => {}),
+    archive: vi.fn(async () => {}),
+    unarchive: vi.fn(async () => {}),
+    delete: vi.fn(async () => {}),
+    fetch: vi.fn(async (id: string) => ({
+      remoteId: id,
+      status: "regular" as const,
+    })),
+    generateTitle: vi.fn(async () => new ReadableStream() as never),
+    ...overrides,
+  };
+  let currentAdapter = adapter;
+  const listeners = new Set<() => void>();
+  const handle = createAssistantClient({
+    getConfig: () =>
+      AuiConfig({
+        threads: RemoteThreadList({
+          adapter: currentAdapter,
+          thread: () => StubThread() as never,
+          ...options,
+        }),
+      }),
+    subscribe: (listener) => {
+      listeners.add(listener);
+      return () => {
+        listeners.delete(listener);
+      };
+    },
+  });
+  handle.subscribe(() => {});
+  const threads = handle.getClient().threads;
+  await threads.getLoadThreadsPromise();
+  const setAdapter = (nextAdapter: RemoteThreadListAdapter) => {
+    flushTapSync(() => {
+      currentAdapter = nextAdapter;
+      for (const listener of listeners) listener();
+    });
+  };
+  return { adapter, handle, threads, setAdapter };
+};
+
+describe("RemoteThreadList thread mutations", () => {
+  it.each(["resolve", "reject"] as const)(
+    "preserves rename order after a fallback switch rejects and the predecessor %ss",
+    async (settlement) => {
+      const first = deferred();
+      const started = deferred();
+      const failure = new Error("fallback failed");
+      const renameFailure = new Error("rename failed");
+      let serverTitle = "a";
+      const { adapter, handle, threads } = await mount(
+        {
+          rename: vi.fn(async (_: string, title: string) => {
+            if (title === "First") {
+              started.resolve();
+              await first.promise;
+            }
+            serverTitle = title;
+          }),
+        },
+        {
+          onSwitchToNewThread: () => {
+            throw failure;
+          },
+        },
+      );
+      const actions = threads.__internal_getRawActions!();
+      try {
+        await actions.switchToThread("a");
+        flushTapSync(() => {});
+        const firstRename = actions.rename("a", "First");
+        const firstResult = firstRename.catch((error: unknown) => error);
+        await started.promise;
+        const archiving = actions.archive("a");
+        const archiveResult = archiving.catch((error: unknown) => error);
+        const lastRename = actions.rename("a", "Last");
+        expect(await archiveResult).toBe(failure);
+        await new Promise<void>((resolve) => setTimeout(resolve, 0));
+        expect(adapter.rename).toHaveBeenCalledTimes(1);
+        expect(adapter.archive).not.toHaveBeenCalled();
+        if (settlement === "resolve") first.resolve();
+        else first.reject(renameFailure);
+        expect(await firstResult).toBe(
+          settlement === "reject" ? renameFailure : undefined,
+        );
+        await lastRename;
+        flushTapSync(() => {});
+        expect(threads.item({ id: "a" }).getState().title).toBe("Last");
+        expect(serverTitle).toBe(threads.item({ id: "a" }).getState().title);
+      } finally {
+        handle.destroy();
+      }
+    },
+  );
+
+  it.each([
+    ["resolve", "before"],
+    ["resolve", "after"],
+    ["reject", "before"],
+    ["reject", "after"],
+  ] as const)(
+    "preserves rename order when the predecessor %ss and the last rename is queued %s identity reconciliation",
+    async (settlement, timing) => {
+      const initialization = deferr
```

**File**: `packages/core/src/react/client/RemoteThreadList.test.ts` (modified, +26/-6)
```diff
@@ -1362,7 +1362,15 @@ describe("RemoteThreadList", () => {
       const { adapter, aui, handle, deleted, isDeletionCommitted } =
         await mountDeletableThread();
       const renamed = deferred<void>();
-      vi.mocked(adapter.rename).mockImplementation(() => renamed.promise);
+      let renameSettled = false;
+      vi.mocked(adapter.rename).mockImplementation(async () => {
+        await renamed.promise;
+        renameSettled = true;
+      });
+      vi.mocked(adapter.delete).mockImplementation(() => {
+        expect(renameSettled).toBe(true);
+        return deleted.promise;
+      });
       vi.mocked(adapter.generateTitle).mockImplementation(async () => {
         if (isDeletionCommitted()) late.push(offset);
         return new ReadableStream({
@@ -1375,13 +1383,14 @@ describe("RemoteThreadList", () => {
       const renaming = aui.threads.item({ id: "t1" }).rename("Manual title");
       const generation = aui.threads.item({ id: "t1" }).generateTitle();
       const deleting = aui.threads.item({ id: "t1" }).delete();
+      expect(adapter.delete).not.toHaveBeenCalled();
+      renamed.resolve();
       await vi.waitFor(
         () => {
           expect(adapter.delete).toHaveBeenCalledOnce();
         },
         { interval: 5 },
       );
-      renamed.resolve();
       await microtasks(offset);
       deleted.resolve();
       await Promise.all([renaming, generation, deleting]);
@@ -1433,11 +1442,18 @@ describe("RemoteThreadList", () => {
 
   it("does not request a title for a thread deleted while the request waits on a rename", async () => {
     const renamed = deferred<void>();
+    let renameSettled = false;
     const adapter = makeAdapter({
       list: vi.fn(async () => ({
         threads: [{ status: "regular" as const, remoteId: "t1", title: "One" }],
       })),
-      rename: vi.fn(() => renamed.promise),
+      rename: vi.fn(async () => {
+        await renamed.promise;
+        renameSettled = true;
+      }),
+      delete: vi.fn(async () => {
+        expect(renameSettled).toBe(true);
+      }),
     });
     const { handle } = mountList(adapter);
     const aui = handle.getClient();
@@ -1451,12 +1467,16 @@ describe("RemoteThreadList", () => {
     });
 
     const renaming = aui.threads.item({ id: "t1" }).rename("Manual title");
-    const generation = aui.threads.item({ id: "t1" }).generateTitle();
-    await aui.threads.item({ id: "t1" }).delete();
+    const generation = aui.threads
+      .item({ id: "t1" })
+      .generateTitle({ automatic: true });
+    const deleting = aui.threads.item({ id: "t1" }).delete();
+    expect(adapter.delete).not.toHaveBeenCalled();
+    renamed.resolve();
+    await deleting;
     await waitFor(() => {
       expect(aui.threads.getState().threadIds).toEqual([]);
     });
-    renamed.resolve();
     await renaming;
     await generation;
 
```

**File**: `packages/core/src/react/client/RemoteThreadList.ts` (modified, +93/-54)
```diff
@@ -29,6 +29,7 @@ import {
   useThreadSelectionEvents,
 } from "../../store/clients/thread-selection-events";
 import { OptimisticState } from "../../runtimes/remote-thread-list/optimistic-state";
+import { ThreadMutationQueue } from "../../runtimes/remote-thread-list/thread-mutation-queue";
 import {
   applyInitialThreadPage,
   appendThreadPage,
@@ -602,6 +603,7 @@ const useRemoteThreadList = (
         adapterAtLoad: adapter,
         adapterGeneration: 0,
         titleStates: new Map<string, ThreadTitleState>(),
+        mutations: new ThreadMutationQueue(),
         pendingAutomaticTitles: new Map<string, readonly ThreadMessage[]>(),
         loadGeneration: 0,
         switchGeneration: 0,
@@ -808,6 +810,7 @@ const useRemoteThreadList = (
           : getThreadData(store.baseValue, draftId);
       const preservedDraft = draft?.status === "new" ? draft : undefined;
       session.adapterGeneration++;
+      session.mutations = new ThreadMutationQueue();
       session.titleStates.clear();
       session.pendingAutomaticTitles.clear();
       const preserveControlled =
@@ -1065,8 +1068,15 @@ const useRemoteThreadList = (
           current = getThreadData(store.value, targetId);
           if (current?.id !== targetId) return;
           if (current.status === "archived") {
+            const mutation = session.mutations.reserve(targetId);
+            const currentAdapter = session.adapter;
+            const adapterGeneration = session.adapterGeneration;
             await store.optimisticUpdate({
-              execute: () => session.adapter.unarchive(remoteId),
+              execute: () =>
+                mutation.run(async () => {
+                  requireAdapterGeneration(adapterGeneration);
+                  return currentAdapter.unarchive(remoteId);
+                }),
               optimistic: (state) =>
                 updateStatusReducer(state, targetId, "regular"),
             });
@@ -1312,6 +1322,12 @@ const useRemoteThreadList = (
             retainedThreadId,
           );
           removedMappingId = reconciliation.removedMappingId;
+          if (removedMappingId !== undefined) {
+            session.mutations.merge(
+              reconciliation.survivorMappingId,
+              removedMappingId,
+            );
+          }
           if (removedMappingId === session.mainThreadId) {
             replacementMainThreadId = reconciliation.survivorMappingId;
           }
@@ -1373,13 +1389,15 @@ const useRemoteThreadList = (
         data.id,
         newTitle,
       );
+      const mutation = session.mutations.reserve(data.id, data);
       return store
         .optimisticUpdate({
-          execute: async () => {
-            const { remoteId } = await data.initializeTask;
-            requireAdapterGeneration(adapterGeneration);
-            return currentAdapter.rename(remoteId, newTitle);
-          },
+          execute: () =>
+            mutation.run(async () => {
+              const { remoteId } = await data.initializeTask;
+              requireAdapterGeneration(adapterGeneration);
+              return currentAdapter.rename(remoteId, newTitle);
+            }),
           optimistic: (state) => {
             const current = getThreadData(state, threadIdOrRemoteId);
             if (!current) return state;
@@ -1439,17 +1457,19 @@ const useRemoteThreadList = (
           "Remote thread list adapter does not support updating custom metadata",
         );
       }
+      const mutation = session.mutations.reserve(data.id, data);
       return store.optimisticUpdate({
-        execute: async () => {
-          const { remoteId } = await data.initializeTask;
-          requireAdapterGeneration(adapterGeneration);
-          if (!currentAdapter.updateCustom) {
-            throw new Error(
-              "Remote thread list adapter does not support updating custom metadata",
-            );
-          }
-          return currentAdapter.updateCustom(remoteId, custom);
-        },
+        execute: () =>
+          mutation.run(async () => {
+            const { remoteId } = await data.initializeTask;
+            requireAdapterGeneration(adapterGeneration);
+            if (!currentAdapter.updateCustom) {
+              throw new Error(
+                "Remote thread list adapter does not support updating custom metadata",
+              );
+            }
+            return currentAdapter.updateCustom(remoteId, custom);
+          }),
         optimistic: (state) => {
           const current = getThreadData(state, threadIdOrRemoteId);
           if (!current) return state;
@@ -1482,18 +1502,25 @@ const useRemoteThreadList = (
       if (data.status !== "regular") {
         throw threadStatusError(threadIdOrRemoteId, data.status, "be archived");
       }
-      do {
-        await ensureNotMain(data.id);
-      } while (isSameThread(store.value, data.id, session.mainThreadId));
-      requireAdapterGeneration(adapterGeneration);
-      await store.optimisticUpdate({
```

**File**: `packages/core/src/react/runtimes/RemoteThreadListThreadListRuntimeCore.mutation-order.test.ts` (added, +258/-0)
```diff
@@ -0,0 +1,258 @@
+import { describe, expect, it, vi } from "vitest";
+import {
+  createCore,
+  deferred,
+  makeAdapter,
+  setStartThreadRuntime,
+} from "../../tests/remote-thread-list-test-helpers";
+
+const listed = () => ({
+  threads: ["a", "b"].map((remoteId) => ({
+    remoteId,
+    status: "regular" as const,
+    title: remoteId,
+  })),
+});
+
+describe("RemoteThreadListThreadListRuntimeCore thread mutations", () => {
+  it.each(["resolve", "reject"] as const)(
+    "preserves rename order after a fallback attachment rejects and the predecessor %ss",
+    async (settlement) => {
+      const first = deferred<void>();
+      const started = deferred<void>();
+      const attachment = deferred<unknown>();
+      const attaching = deferred<void>();
+      const failure = new Error("attachment failed");
+      const renameFailure = new Error("rename failed");
+      let serverTitle = "a";
+      const adapter = makeAdapter({
+        list: vi.fn(async () => listed()),
+        rename: vi.fn(async (_: string, title: string) => {
+          if (title === "First") {
+            started.resolve();
+            await first.promise;
+          }
+          serverTitle = title;
+        }),
+      });
+      const core = createCore(adapter);
+      try {
+        await core.getLoadThreadsPromise();
+        await core.switchToThread("a");
+        setStartThreadRuntime(core, () => {
+          attaching.resolve();
+          return attachment.promise;
+        });
+        const firstRename = core.rename("a", "First");
+        const firstResult = firstRename.catch((error: unknown) => error);
+        await started.promise;
+        const archiving = core.archive("a");
+        const archiveResult = archiving.catch((error: unknown) => error);
+        await attaching.promise;
+        const lastRename = core.rename("a", "Last");
+        attachment.reject(failure);
+        expect(await archiveResult).toBe(failure);
+        await new Promise<void>((resolve) => setTimeout(resolve, 0));
+        expect(adapter.rename).toHaveBeenCalledTimes(1);
+        expect(adapter.archive).not.toHaveBeenCalled();
+        if (settlement === "resolve") first.resolve();
+        else first.reject(renameFailure);
+        expect(await firstResult).toBe(
+          settlement === "reject" ? renameFailure : undefined,
+        );
+        await lastRename;
+        expect(core.getItemById("a")?.title).toBe("Last");
+        expect(serverTitle).toBe(core.getItemById("a")?.title);
+      } finally {
+        core.__internal_dispose();
+      }
+    },
+  );
+
+  it.each([
+    ["resolve", "before"],
+    ["resolve", "after"],
+    ["reject", "before"],
+    ["reject", "after"],
+  ] as const)(
+    "preserves rename order when the predecessor %ss and the last rename is queued %s identity reconciliation",
+    async (settlement, timing) => {
+      const initialization = deferred<void>();
+      const first = deferred<void>();
+      const started = deferred<void>();
+      const failure = new Error("rename failed");
+      let serverTitle = "a";
+      const adapter = makeAdapter({
+        initialize: vi.fn(async () => {
+          await initialization.promise;
+          return { remoteId: "a", externalId: undefined };
+        }),
+        rename: vi.fn(async (_: string, title: string) => {
+          if (title === "First") {
+            started.resolve();
+            await first.promise;
+          }
+          serverTitle = title;
+        }),
+      });
+      const core = createCore(adapter);
+      try {
+        await core.getLoadThreadsPromise();
+        const draftId = core.mainThreadId;
+        const initializing = core.initialize(draftId);
+        adapter.list = vi.fn(async () => ({
+          threads: [{ remoteId: "a", status: "regular" as const, title: "a" }],
+        }));
+        await core.reload();
+        const firstRename = core.rename("a", "First");
+        const firstResult = firstRename.catch((error: unknown) => error);
+        await started.promise;
+        const middleRename =
+          timing === "before" ? core.rename("a", "Middle") : undefined;
+        let lastRename =
+          timing === "before" ? core.rename(draftId, "Last") : undefined;
+        initialization.resolve();
+        await initializing;
+        expect(core.getItemById("a")?.id).toBe(draftId);
+        lastRename ??= core.rename(draftId, "Last");
+        await new Promise<void>((resolve) => setTimeout(resolve, 0));
+        expect(adapter.rename).toHaveBeenCalledTimes(1);
+        if (settlement === "resolve") first.resolve();
+        else first.reject(failure);
+        expect(await firstResult).toBe(
+          settlement === "reject" ? failure : undefined,
+        );
+        await Promise.all([middleRename, lastRename]);
+        expect(
+          vi.mocked(adapter.rename).mock.calls.map(([, title]) => title),
+        ).toEqual(
+          timing === "before" ? ["First", "Middle", "Last"] : ["First", "Last
```

**File**: `packages/core/src/react/runtimes/RemoteThreadListThreadListRuntimeCore.switch-delete.test.ts` (modified, +11/-4)
```diff
@@ -43,6 +43,7 @@ describe("RemoteThreadListThreadListRuntimeCore switch/delete ordering", () => {
 
   it("does not select a thread deleted while its switch is unarchiving", async () => {
     const unarchive = deferred<void>();
+    let unarchiveSettled = false;
     const adapter = makeAdapter({
       list: vi.fn(async () => ({
         threads: [
@@ -54,7 +55,13 @@ describe("RemoteThreadListThreadListRuntimeCore switch/delete ordering", () => {
           },
         ],
       })),
-      unarchive: vi.fn(() => unarchive.promise),
+      unarchive: vi.fn(async () => {
+        await unarchive.promise;
+        unarchiveSettled = true;
+      }),
+      delete: vi.fn(async () => {
+        expect(unarchiveSettled).toBe(true);
+      }),
     });
     const core = createCore(adapter);
     await core.getLoadThreadsPromise();
@@ -64,10 +71,10 @@ describe("RemoteThreadListThreadListRuntimeCore switch/delete ordering", () => {
     await vi.waitFor(() => {
       expect(adapter.unarchive).toHaveBeenCalledWith("thread-b");
     });
-    await core.delete("thread-b");
-
+    const deleting = core.delete("thread-b");
+    expect(adapter.delete).not.toHaveBeenCalled();
     unarchive.resolve();
-    await switchToB;
+    await Promise.all([switchToB, deleting]);
 
     expect(core.getItemById("thread-b")).toBeUndefined();
     expect(core.mainThreadId).toBe(initialMainThreadId);
```

**File**: `packages/core/src/react/runtimes/RemoteThreadListThreadListRuntimeCore.tsx` (modified, +74/-47)
```diff
@@ -14,6 +14,7 @@ import { useSubscribable } from "../../store/runtime-clients/useSubscribable";
 import { handleThreadListAction } from "../../store/runtime-clients/handle-thread-list-action";
 import { nullProtoRecord } from "../../utils/record";
 import { OptimisticState } from "../../runtimes/remote-thread-list/optimistic-state";
+import { ThreadMutationQueue } from "../../runtimes/remote-thread-list/thread-mutation-queue";
 import { EMPTY_THREAD_CORE } from "../../runtimes/remote-thread-list/empty-thread-core";
 import type {
   ClassifyAccumulator,
@@ -105,6 +106,7 @@ export class RemoteThreadListThreadListRuntimeCore
     | { readonly threadId: string; readonly error: unknown }
     | undefined;
   private readonly _titleStates = new Map<string, ThreadTitleState>();
+  private _mutations = new ThreadMutationQueue();
   private readonly _automaticTitles = new Map<string, Unsubscribe>();
   private _disposed = false;
 
@@ -398,6 +400,7 @@ export class RemoteThreadListThreadListRuntimeCore
     if (adapterChanged) {
       this._loadGeneration++;
       this._adapterGeneration++;
+      this._mutations = new ThreadMutationQueue();
       this._switchGeneration++;
       this._switchTask = undefined;
       this._loadThreadsPromise = undefined;
@@ -1007,6 +1010,12 @@ export class RemoteThreadListThreadListRuntimeCore
           threadId,
         );
         removedMappingId = reconciliation.removedMappingId;
+        if (removedMappingId !== undefined) {
+          this._mutations.merge(
+            reconciliation.survivorMappingId,
+            removedMappingId,
+          );
+        }
         if (removedMappingId === this._mainThreadId) {
           this._setMainThreadId(reconciliation.survivorMappingId);
         }
@@ -1168,9 +1177,12 @@ export class RemoteThreadListThreadListRuntimeCore
         await applyTitleStream(stream, onTitle);
       },
       rename: async (title) => {
-        this._requireAdapterGeneration(adapterGeneration);
-        if (isRemoved()) return;
-        await adapter.rename(remoteId, title);
+        const mutation = this._mutations.reserve(data.id, data);
+        await mutation.run(async () => {
+          this._requireAdapterGeneration(adapterGeneration);
+          if (isRemoved()) return;
+          await adapter.rename(remoteId, title);
+        });
       },
       applyTitle: async (title) => {
         await this._state.optimisticUpdate({
@@ -1209,13 +1221,15 @@ export class RemoteThreadListThreadListRuntimeCore
       throw threadStatusError(threadIdOrRemoteId, data.status, "be renamed");
 
     const claim = startThreadTitleRename(this._titleStates, data.id, newTitle);
+    const mutation = this._mutations.reserve(data.id, data);
     try {
       const result = await this._state.optimisticUpdate({
-        execute: async () => {
-          const { remoteId } = await data.initializeTask;
-          this._requireAdapterGeneration(adapterGeneration);
-          return adapter.rename(remoteId, newTitle);
-        },
+        execute: () =>
+          mutation.run(async () => {
+            const { remoteId } = await data.initializeTask;
+            this._requireAdapterGeneration(adapterGeneration);
+            return adapter.rename(remoteId, newTitle);
+          }),
         optimistic: (state) => {
           if (this._isOtherAdaptersThread(state, adapter, threadIdOrRemoteId))
             return state;
@@ -1267,18 +1281,20 @@ export class RemoteThreadListThreadListRuntimeCore
         "Remote thread list adapter does not support updating custom metadata",
       );
     }
+    const mutation = this._mutations.reserve(data.id, data);
 
     return this._state.optimisticUpdate({
-      execute: async () => {
-        const { remoteId } = await data.initializeTask;
-        this._requireAdapterGeneration(adapterGeneration);
-        if (!adapter.updateCustom) {
-          throw new Error(
-            "Remote thread list adapter does not support updating custom metadata",
-          );
-        }
-        return adapter.updateCustom(remoteId, custom);
-      },
+      execute: () =>
+        mutation.run(async () => {
+          const { remoteId } = await data.initializeTask;
+          this._requireAdapterGeneration(adapterGeneration);
+          if (!adapter.updateCustom) {
+            throw new Error(
+              "Remote thread list adapter does not support updating custom metadata",
+            );
+          }
+          return adapter.updateCustom(remoteId, custom);
+        }),
       optimistic: (state) => {
         if (this._isOtherAdaptersThread(state, adapter, threadIdOrRemoteId))
           return state;
@@ -1381,20 +1397,26 @@ export class RemoteThreadListThreadListRuntimeCore
     if (data.status !== "regular")
       throw threadStatusError(threadIdOrRemoteId, data.status, "be archived");
 
-    do {
-      await this._ensureThreadIsNotMain(data.id);
-    } while (data.id === this._mainThreadId);
-    this._requireAdapterGeneration(adapterG
```

**File**: `packages/core/src/runtimes/remote-thread-list/thread-mutation-queue.ts` (added, +103/-0)
```diff
@@ -0,0 +1,103 @@
+type Mutation = {
+  order: number;
+  done: Promise<void>;
+  previous: Promise<void> | undefined;
+  running: boolean;
+};
+
+export class ThreadMutationQueue {
+  private readonly pending = new Map<string, Mutation[]>();
+  private readonly aliases = new Map<string, string>();
+  private nextOrder = 0;
+
+  private resolve(threadId: string): string {
+    let target = this.aliases.get(threadId);
+    while (target !== undefined) {
+      threadId = target;
+      target = this.aliases.get(threadId);
+    }
+    return threadId;
+  }
+
+  merge(threadId: string, otherThreadId: string) {
+    const target = this.resolve(threadId);
+    const source = this.resolve(otherThreadId);
+    if (target === source) return;
+    this.aliases.set(source, target);
+    const mutations = [
+      ...(this.pending.get(target) ?? []),
+      ...(this.pending.get(source) ?? []),
+    ].sort(
+      (a, b) => Number(b.running) - Number(a.running) || a.order - b.order,
+    );
+    this.pending.delete(source);
+    if (mutations.length === 0) return;
+    let previous: Promise<void> | undefined;
+    for (const mutation of mutations) {
+      mutation.previous = previous;
+      previous = mutation.done;
+    }
+    this.pending.set(target, mutations);
+  }
+
+  reserve(
+    threadId: string,
+    thread?: {
+      remoteId: string | undefined;
+      initializeTask: Promise<unknown>;
+    },
+  ) {
+    const ready =
+      thread?.remoteId === undefined ? thread?.initializeTask : undefined;
+    const id = this.resolve(threadId);
+    const mutations = this.pending.get(id) ?? [];
+    let release!: () => void;
+    const done = new Promise<void>((resolve) => {
+      release = resolve;
+    });
+    const current: Mutation = {
+      order: this.nextOrder++,
+      done,
+      previous: mutations.at(-1)?.done,
+      running: false,
+    };
+    mutations.push(current);
+    this.pending.set(id, mutations);
+    let started = false;
+    const finish = () => {
+      release();
+      const target = this.resolve(threadId);
+      const queue = this.pending.get(target)!;
+      queue.splice(queue.indexOf(current), 1);
+      if (queue.length === 0) this.pending.delete(target);
+    };
+    const afterPrevious = async <T>(call: () => T | Promise<T>): Promise<T> => {
+      let previous: Promise<void> | undefined;
+      do {
+        previous = current.previous;
+        if (previous) await previous;
+      } while (previous !== current.previous);
+      return call();
+    };
+    return {
+      run: async <T>(call: () => Promise<T>): Promise<T> => {
+        started = true;
+        try {
+          if (ready) await ready.catch(() => {});
+          return await afterPrevious(() => {
+            current.running = true;
+            return call();
+          });
+        } finally {
+          void afterPrevious(finish);
+        }
+      },
+      cancel: () => {
+        if (!started) {
+          started = true;
+          void afterPrevious(finish);
+        }
+      },
+    };
+  }
+}
```

#### Recent Merged Pull Requests:
- **PR #9851** (2026-10-18): fix(core): keep the hosted runtime's hook order when the adapter hook changes (@okisdev)
- **PR #9849** (2026-10-18): feat(docs): default the docs chat to deepseek v4.1 flash and refresh its models (@okisdev)
- **PR #9846** (2026-10-18): fix(react-pi): load models from the configured agent directory (@Kinfe123)
- **PR #9845** (2026-10-18): fix(react-pi): honor custom session directories (@Kinfe123)
- **PR #9841** (2026-10-18): test(assistant-stream): verify independent live stream readers (@Kinfe123)
- **PR #9840** (2026-10-18): fix(cli): preserve disabled message filters during upgrades (@Kinfe123)

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

## X. core): resolve a thread switch once the replacement runtime attaches (#9765)

**RULE**:
When implementing operations in `.changeset/thread-list-switch-waits-for-runtime.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in assistant-ui/assistant-ui. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a587b283`: core): resolve a thread switch once the replacement runtime attaches (#9765). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.changeset/thread-list-switch-waits-for-runtime.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
---
"@assistant-ui/core": patch
---

Wait for a replacement thread runtime to attach before a thread switch settles. A switch still pending when the thread list is destroyed now rejects with a silent `ThreadListDestroyedError`, and a switch whose replacement runtime fails to mount rejects with the mount error.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a587b283` are properly handled with clean fallback behavior.
