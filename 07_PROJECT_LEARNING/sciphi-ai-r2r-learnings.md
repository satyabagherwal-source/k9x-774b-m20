# Forensic Learning Record (Deep Inspection): SciPhi-AI/R2R

> **Canonical Artifact**: `07_PROJECT_LEARNING/sciphi-ai-r2r-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/SciPhi-AI/R2R](https://github.com/SciPhi-AI/R2R))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:50:22.541Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `SciPhi-AI/R2R`
- **Description**: SoTA production-ready AI retrieval system. Agentic Retrieval-Augmented Generation (RAG) with a RESTful API.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 8013 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `js/sdk/examples/hello_r2r.js`
```
const path = require('path');
const { r2rClient } = require("r2r-js");

// Create an account at SciPhi Cloud https://app.sciphi.ai and set an R2R_API_KEY environment variable
// or set the base URL to your instance. E.g. r2rClient("http://localhost:7272")
const client = new r2rClient();

async function main() {
  const filePath = path.resolve(__dirname, "data/raskolnikov.txt");


  console.log("Ingesting file...");
  const ingestResult = await client.documents.create({
    file: {
      path: filePath,
      name: "raskolnikov.txt"
    },
    metadata: { author: "Dostoevsky" },
  });
  console.log("Ingest result:", JSON.stringify(ingestResult, null, 2));

  console.log("Waiting for the file to be ingested...");
  await new Promise((resolve) => setTimeout(resolve, 10000));

  console.log("Performing RAG...");
  const ragResponse = await client.retrieval.rag({
    query: "To whom was Raskolnikov desperately in debt to?",
  });

  console.log("Search Results:");
  ragResponse.results.searchResults.chunkSearchResults.forEach(
    (result, index) => {
      console.log(`\nResult ${index + 1}:`);
      console.log(`Text: ${result.text.substring(0, 100)}...`);
      console.log(`Score: ${result.score}`);
    },
  );

  console.log("\nCompletion:");
  console.log(ragResponse.results.completion);
}

main();

```

### Core Architecture Module: `js/sdk/jest.config.js`
```
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: [
    "**/__tests__/**/*.ts?(x)",
    "**/__tests__/**/?(*.)+(spec|test).ts?(x)",
  ],
  maxWorkers: 1,
};

```

### Core Architecture Module: `js/sdk/src/baseClient.ts`
```
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  Method,
} from "axios";
import FormData from "form-data";
import { ensureCamelCase } from "./utils";

let fs: any;
if (typeof window === "undefined") {
  fs = require("fs");
}

function handleRequestError(response: AxiosResponse): void {
  if (response.status < 400) {
    return;
  }

  let message: string;
  const errorContent = ensureCamelCase(response.data);

  if (typeof errorContent === "object" && errorContent !== null) {
    message =
      errorContent.message ||
      (errorContent.detail && errorContent.detail.message) ||
      (typeof errorContent.detail === "string" && errorContent.detail) ||
      JSON.stringify(errorContent);
  } else {
    message = String(errorContent);
  }

  throw new Error(`Status ${response.status}: ${message}`);
}

export abstract class BaseClient {
  protected axiosInstance: AxiosInstance;
  protected baseUrl: string;
  protected accessToken?: string | null;
  protected apiKey?: string | null;
  protected projectName?: string | null;
  protected refreshToken: string | null;
  protected anonymousTelemetry: boolean;
  protected enableAutoRefresh: boolean;

  constructor(
    baseURL: string = "http://localhost:7272",
    prefix: string = "",
    anonymousTelemetry = true,
    enableAutoRefresh = false,
  ) {
    this.baseUrl = `${baseURL}${prefix}`;
    this.accessToken = null;
    this.apiKey = process.env.R2R_API_KEY || null;
    this.projectName = null;
    this.refreshToken = null;
    this.anonymousTelemetry = anonymousTelemetry;

    this.enableAutoRefresh = enableAutoRefresh;

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  protected async _makeRequest<T = any>(
    method: Method,
    endpoint: string,
    options: any = {},
    version: "v3" = "v3",
  ): Promise<T> {
    const url = `/${version}/${endpoint}`;
    const config: AxiosRequestConfig = {
      method,
      url,
      headers: { ...options.headers },
      params: options.params,
      ...options,
      responseType: options.responseType || "json",
    };

    config.headers = config.headers || {};

    if (options.params) {
      config.paramsSerializer = (params) => {
        return Object.entries(params)
          .map(([key, value]) => {
            if (Array.isArray(value)) {
              return value
                .map(
                  (v) => `${encodeURIComponent(key)}=${encodeURIComponent(v)}`,
                )
                .join("&");
            }
            return `${encodeURIComponent(key)}=${encodeURIComponent(
              String(value),
            )}`;
          })
          .join("&");
      };
    }

    if (options.data) {
      if (typeof FormData !== "undefined" && options.data instanceof FormData) {
        config.data = options.data;
        delete config.headers["Content-Type"];
      } else if (typeof options.data === "object") {
        if (
          config.headers["Content-Type"] === "application/x-www-form-urlencoded"
        ) {
          config.data = Object.keys(options.data)
            .map(
              (key) =>
                `${encodeURIComponent(key)}=${encodeURIComponent(
                  options.data[key],
                )}`,
            )
            .join("&");
        } else {
          config.data = JSON.stringify(options.data);
          if (method !== "DELETE") {
            config.headers["Content-Type"] = "application/json";
          } else {
            config.headers["Content-Type"] = "application/json";
            config.data = JSON.stringify(options.data);
          }
        }
      } else {
        config.data = options.data;
      }
    }

    if (this.accessToken && this.apiKey) {
      throw new Error("Cannot have both access token and api key.");
    }

    if (
      this.apiKey &&
      !["register", "login", "verify_email", "health"].includes(endpoint)
    ) {
      config.headers["x-api-key"] = this.apiKey;
    } else if (
      this.accessToken &&
      !["register", "login", "verify_email", "health"].includes(endpoint)
    ) {
      config.headers.Authorization = `Bearer ${this.accessToken}`;
    }

    if (this.projectName) {
      config.headers["x-project-name"] = this.projectName;
    }

    if (options.responseType === "stream") {
      return this.handleStreamingRequest<T>(method, version, endpoint, config);
    }

    try {
      const response = await this.axiosInstance.request(config);

      if (options.responseType === "blob") {
        return response.data as T;
      } else if (options.responseType === "arraybuffer") {
        if (options.returnFullResponse) {
          return response as unknown as T;
        }
        return response.data as T;
      }

      const responseData = options.returnFullResponse
        ? { ...response, data: ensureCamelCase(response.data) }
        : ensureCamelCase(response.data);

      return responseData as T;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        handleRequestError(error.response);
      }
      throw error;
    }
  }

  private async handleStreamingRequest<T>(
    method: Method,
    version: string,
    endpoint: string,
    config: AxiosRequestConfig,
  ): Promise<T> {
    const fetchHeaders: Record<string, string> = {};

    // Convert Axios headers to Fetch headers
    Object.entries(config.headers || {}).forEach(([key, value]) => {
      if (typeof value === "string") {
        fetchHeaders[key] = value;
      }
    });

    try {
      const response = await fetch(`${this.baseUrl}/${version}/${endpoint}`, {
        method,
        headers: fetchHeaders,
        body: config.data,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `HTTP error! status: ${response.status}: ${
            ensureCamelCase(errorData).message || "Unknown error"
          }`,
        );
      }

      // Create a TransformStream to process the response
      const transformStream = new TransformStream({
        transform(chunk, controller) {
          // Process each chunk here if needed
          controller.enqueue(chunk);
        },
      });

      // Pipe the response through the transform stream
      const streamedResponse = response.body?.pipeThrough(transformStream);

      if (!streamedResponse) {
        throw new Error("No response body received from stream");
      }

      return streamedResponse as unknown as T;
    } catch (error) {
      console.error("Streaming request failed:", error);
      throw error;
    }
  }

  protected _ensureAuthenticated(): void {
    if (!this.accessToken) {
      throw new Error("Not authenticated. Please login first.");
    }
  }

  setTokens(accessToken: string, refreshToken: string): void {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  setApiKey(apiKey: string): void {
    if (!apiKey) {
      throw new Error("API key is required");
    }
    this.apiKey = apiKey;
  }

  setProjectName(projectName: string): void {
    if (!projectName) {
      throw new Error("Project name is required");
    }
    this.projectName = projectName;
  }

  unsetProjectName(): void {
    this.projectName = null;
  }
}

```

### Core Architecture Module: `js/sdk/src/index.ts`
```
export { r2rClient } from "./r2rClient";
export * from "./types";

```

### Core Architecture Module: `js/sdk/src/r2rClient.ts`
```
import axios, { AxiosError, Method } from "axios";
import { BaseClient } from "./baseClient";

import { ChunksClient } from "./v3/clients/chunks";
import { CollectionsClient } from "./v3/clients/collections";
import { ConversationsClient } from "./v3/clients/conversations";
import { DocumentsClient } from "./v3/clients/documents";
import { GraphsClient } from "./v3/clients/graphs";
import { IndiciesClient } from "./v3/clients/indices";
import { PromptsClient } from "./v3/clients/prompts";
import { RetrievalClient } from "./v3/clients/retrieval";
import { SystemClient } from "./v3/clients/system";
import { UsersClient } from "./v3/clients/users";

let fs: any;
if (typeof window === "undefined") {
  fs = require("fs");
}

type RefreshTokenResponse = {
  results: {
    accessToken: { token: string };
    refreshToken: { token: string };
  };
};

interface R2RClientOptions {
  enableAutoRefresh?: boolean;
  getTokensCallback?: () => {
    accessToken: string | null;
    refreshToken: string | null;
  };
  setTokensCallback?: (
    accessToken: string | null,
    refreshToken: string | null,
  ) => void;
  onRefreshFailedCallback?: () => void;
}

export class r2rClient extends BaseClient {
  public readonly chunks: ChunksClient;
  public readonly collections: CollectionsClient;
  public readonly conversations: ConversationsClient;
  public readonly documents: DocumentsClient;
  public readonly graphs: GraphsClient;
  public readonly indices: IndiciesClient;
  public readonly prompts: PromptsClient;
  public readonly retrieval: RetrievalClient;
  public readonly system: SystemClient;
  public readonly users: UsersClient;

  private getTokensCallback?: R2RClientOptions["getTokensCallback"];
  private setTokensCallback?: R2RClientOptions["setTokensCallback"];
  private onRefreshFailedCallback?: R2RClientOptions["onRefreshFailedCallback"];

  constructor(
    baseURL: string,
    anonymousTelemetry = true,
    options: R2RClientOptions = {},
  ) {
    super(baseURL, "", anonymousTelemetry, options.enableAutoRefresh);

    this.chunks = new ChunksClient(this);
    this.collections = new CollectionsClient(this);
    this.conversations = new ConversationsClient(this);
    this.documents = new DocumentsClient(this);
    this.graphs = new GraphsClient(this);
    this.indices = new IndiciesClient(this);
    this.prompts = new PromptsClient(this);
    this.retrieval = new RetrievalClient(this);
    this.system = new SystemClient(this);
    this.users = new UsersClient(this);

    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "Content-Type": "application/json",
      },
    });

    this.getTokensCallback = options.getTokensCallback;
    this.setTokensCallback = options.setTokensCallback;
    this.onRefreshFailedCallback = options.onRefreshFailedCallback;

    // 1) Request interceptor: attach current access token (if any)
    this.axiosInstance.interceptors.request.use(
      (config) => {
        const tokenData = this.getTokensCallback?.();
        const accessToken = tokenData?.accessToken || null;
        if (accessToken) {
          config.headers["Authorization"] = `Bearer ${accessToken}`;
        }
        return config;
      },
      (error) => {
        console.error("[r2rClient] Request interceptor error:", error);
        return Promise.reject(error);
      },
    );

    // 2) Response interceptor: see if we got 401/403 => attempt to refresh
    this.setupResponseInterceptor();
  }

  private setupResponseInterceptor() {
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const status = error.response?.status;
        const failingUrl = error.config?.url;
        const errorData = error.response?.data as {
          message?: string;
          error_code?: string;
        };

        // 1) If the refresh endpoint itself fails => don't try again
        if (failingUrl?.includes("/v3/users/refresh-token")) {
          console.error(
            "[r2rClient] Refresh call itself returned 401/403 => logging out",
          );
          this.onRefreshFailedCallback?.();
          return Promise.reject(error);
        }

        // 2) If normal request => attempt refresh IF it's really an invalid/expired token
        // We'll check either an explicit "error_code" or text in "message"
        // Adjust to match your server's structure!
        const isTokenError =
          !!errorData?.error_code &&
          errorData.error_code.toUpperCase() === "TOKEN_EXPIRED";

        // Or fallback to matching common phrases if no error_code is set:
        const msg = (errorData?.message || "").toLowerCase();
        const looksLikeTokenIssue =
          msg.includes("invalid token") ||
          msg.includes("token expired") ||
          msg.includes("credentials");

        // If either of those checks is true, we consider it an auth token error:
        const isAuthError = isTokenError || looksLikeTokenIssue;

        if (
          (status === 401 || status === 403) &&
          this.getTokensCallback &&
          isAuthError
        ) {
          // Check if we have a refresh token
          const { refreshToken } = this.getTokensCallback();
          if (!refreshToken) {
            console.error("[r2rClient] No refresh token found => logout");
            this.onRefreshFailedCallback?.();
            return Promise.reject(error);
          }

          // Attempt refresh
          try {
            const refreshResponse = await this.users.refreshAccessToken();
            const newAccessToken = refreshResponse.results.accessToken.token;
            const newRefreshToken = refreshResponse.results.refreshToken.token;

            // set new tokens
            this.setTokens(newAccessToken, newRefreshToken);

            // Re-try the original request
            if (error.config) {
              error.config.headers["Authorization"] =
                `Bearer ${newAccessToken}`;
              return this.axiosInstance.request(error.config);
            } else {
              console.warn(
                "[r2rClient] No request config found to retry. Possibly manual re-fetch needed",
              );
            }
          } catch (refreshError) {
            console.error(
              "[r2rClient] Refresh attempt failed => logging out. Error was:",
              refreshError,
            );
            this.onRefreshFailedCallback?.();
            return Promise.reject(refreshError);
          }
        }

        // 3) If not a 401/403 or it's a 401/403 that isn't token-related => just reject
        return Promise.reject(error);
      },
    );
  }

  public makeRequest<T = any>(
    method: Method,
    endpoint: string,
    options: any = {},
  ): Promise<T> {
    return this._makeRequest(method, endpoint, options, "v3");
  }

  public getRefreshToken(): string | null {
    return this.refreshToken;
  }

  public setTokens(
    accessToken: string | null,
    refreshToken: string | null,
  ): void {
    super.setTokens(accessToken || "", refreshToken || "");
    this.setTokensCallback?.(accessToken, refreshToken);
  }
}

export default r2rClient;

```

### Core Architecture Module: `js/sdk/src/types.ts`
```
export interface UnprocessedChunk {
  id: string;
  documentId?: string;
  collectionIds: string[];
  metadata: Record<string, any>;
  text: string;
}

// Response wrappers
export interface ResultsWrapper<T> {
  results: T;
}

export interface PaginatedResultsWrapper<T> extends ResultsWrapper<T> {
  totalEntries: number;
}

// Generic response types
export interface GenericBooleanResponse {
  success: boolean;
}

export interface GenericMessageResponse {
  message: string;
}

// Chunk types
export interface ChunkResponse {
  id: string;
  documentId: string;
  userId: string;
  collectionIds: string[];
  text: string;
  metadata: Record<string, any>;
  vector?: any;
}

// Collection types
export interface CollectionResponse {
  id: string;
  ownerId?: string;
  name: string;
  description?: string;
  graphClusterStatus: string;
  graphSyncStatus: string;
  createdAt: string;
  updatedAt: string;
  userCount: number;
  documentCount: number;
}

// Community types
export interface CommunityResponse {
  id: string;
  name: string;
  summary: string;
  findings: string[];
  communityId?: string;
  graphId?: string;
  collectionId?: string;
  rating?: number;
  ratingExplanation?: string;
  descriptionEmbedding?: string;
}

// Conversation types
export interface ConversationResponse {
  id: string;
  createdAt: string;
  userId?: string;
  name?: string;
}

export interface Message {
  role: string;
  content: any;
  name?: string;
  functionCall?: Record<string, any>;
  toolCalls?: Array<Record<string, any>>;
  toolCallId?: string;
  metadata?: Record<string, any>;
}

export interface MessageResponse {
  id: string;
  message: any;
  metadata: Record<string, any>;
}
// Document types
export interface DocumentResponse {
  id: string;
  collectionIds: string[];
  ownerId: string;
  documentType: string;
  metadata: Record<string, any>;
  title?: string;
  version: string;
  sizeInBytes?: number;
  ingestionStatus: string;
  extractionStatus: string;
  createdAt: string;
  updatedAt: string;
  ingestionAttemptNumber?: number;
  summary?: string;
  summaryEmbedding?: string;
}

// Entity types
export interface EntityResponse {
  id: string;
  name: string;
  description?: string;
  category?: string;
  metadata: Record<string, any>;
  parentId?: string;
  chunkIds?: string[];
  descriptionEmbedding?: string;
}

// Graph types
export interface GraphResponse {
  id: string;
  userId: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

// Index types
export enum IndexMeasure {
  COSINE_DISTANCE = "cosine_distance",
  L2_DISTANCE = "l2_distance",
  MAX_INNER_PRODUCT = "max_inner_product",
}

// Ingestion types
export interface IngestionResponse {
  message: string;
  taskId?: string;
  documentId: string;
}

export interface UpdateResponse {
  message: string;
  taskId?: string;
  documentId: string;
}

export interface IndexConfig {
  name?: string;
  tableName?: string;
  indexMethod?: string;
  indexMeasure?: string;
  indexArguments?: string;
  indexName?: string;
  indexColumn?: string;
  concurrently?: boolean;
}

// Prompt types
export interface PromptResponse {
  id: string;
  name: string;
  template: string;
  createdAt: string;
  updatedAt: string;
  inputTypes: string[];
}

// Relationship types
export interface RelationshipResponse {
  id: string;
  subject: string;
  predicate: string;
  object: string;
  description?: string;
  subjectId: string;
  objectId: string;
  weight: number;
  chunkIds: string[];
  parentId: string;
  metadata: Record<string, any>;
}

// Retrieval types
export interface ChunkSearchSettings {
  indexMeasure?: IndexMeasure;
  probes?: number;
  efSearch?: number;
  enabled?: boolean;
}

export interface GenerationConfig {
  model?: string;
  temperature?: number;
  topP?: number;
  maxTokensToSample?: number;
  stream?: boolean;
  functions?: Array<Record<string, any>>;
  tools?: Array<Record<string, any>>;
  addGenerationKwargs?: Record<string, any>;
  apiBase?: string;
  responseFormat?: Record<string, any> | object;
  extendedThinking?: boolean;
  thinkingBudget?: number;
  reasoningEffort?: string;
}

export interface HybridSearchSettings {
  fulltextWeight?: number;
  semanticWeight?: number;
  fulltextLimit?: number;
  rrfK?: number;
}

export interface GraphSearchSettings {
  generationConfig?: GenerationConfig;
  graphragMapSystem?: string;
  graphragReduceSystem?: string;
  maxCommunityDescriptionLength?: number;
  maxLlmQueriesForGlobalSearch?: number;
  limits?: Record<string, any>;
  enabled?: boolean;
}

export interface SearchSettings {
  useHybridSearch?: boolean;
  useSemanticSearch?: boolean;
  useFulltextSearch?: boolean;
  filters?: Record<string, any>;
  limit?: number;
  offset?: number;
  includeMetadata?: boolean;
  includeScores?: boolean;
  searchStrategy?: string;
  hybridSettings?: HybridSearchSettings;
  chunkSettings?: ChunkSearchSettings;
  graphSettings?: GraphSearchSettings;
}

export interface VectorSearchResult {
  id: string;
  documentId: string;
  userId: string;
  collectionIds: string[];
  score: number;
  text: string;
  metadata?: Record<string, any>;
}

export type KGSearchResultType =
  | "entity"
  | "relationship"
  | "community"
  | "global";

export interface GraphSearchResult {
  content: any;
  resultType?: KGSearchResultType;
  chunkIds?: string[];
  metadata: Record<string, any>;
  score?: number;
}

export interface CombinedSearchResponse {
  chunkSearchResults: VectorSearchResult[];
  graphSearchResults?: GraphSearchResult[];
  documentSearchResults: null | any[];
  webSearchResults: null | any[];
}

// System types

export interface ServerStats {
  startTime: string;
  uptimeSeconds: number;
  cpuUsage: number;
  memoryUsage: number;
}

export interface SettingsResponse {
  config: Record<string, any>;
  prompts: Record<string, any>;
  r2rProjectName: string;
}

// User types

export type TokenType = "access" | "refresh";

export interface Token {
  token: string;
  tokenType: TokenType;
}

export interface TokenResponse {
  accessToken: Token;
  refreshToken: Token;
}

export interface User {
  id: string;
  email: string;
  isActive: boolean;
  isSuperuser: boolean;
  createdAt: string;
  updatedAt: string;
  isVerified: boolean;
  collectionIds: string[];
  hashedPassword?: string;
  verificationCodeExpiry?: string;
  name?: string;
  bio?: string;
  profilePicture?: string;
  metadata?: Record<string, any>;
  limitOverrides?: Record<string, any>;
  documentIds?: string[];
}

interface LoginResponse {
  accessToken: Token;
  refreshToken: Token;
}

interface StorageTypeLimit {
  limit: number;
  used: number;
  remaining: number;
}

interface StorageLimits {
  chunks: StorageTypeLimit;
  documents: StorageTypeLimit;
  collections: StorageTypeLimit;
}

interface UsageLimit {
  used: number;
  limit: number;
  remaining: number;
}

interface RouteUsage {
  routePerMin: UsageLimit;
  monthlyLimit: UsageLimit;
}

interface Usage {
  globalPerMin: UsageLimit;
  monthlyLimit: UsageLimit;
  routes: Record<string, RouteUsage>;
}

interface SystemDefaults {
  globalPerMin: number;
  routePerMin?: number;
  monthlyLimit: number;
}

interface LimitsResponse {
  storageLimits: StorageLimits;
  systemDefaults: SystemDefaults;
  userOverrides: Record<string, any>;
  effectiveLimits: SystemDefaults;
  usage: Usage;
}

// Generic Responses
export type WrappedBooleanResponse = ResultsWrapper<GenericBooleanResponse>;
export type WrappedGenericMessageResponse =
  ResultsWrapper<GenericMessageResponse>;

// Chunk Responses
export type WrappedChunkResponse = ResultsWrapper<ChunkResponse>;
export type WrappedChunksResponse = PaginatedResultsWrapper<ChunkResponse[]>;

// Collection Responses
export type WrappedCollectionResponse = ResultsWrapper<CollectionResponse>;
export type WrappedCollectionsResponse = PaginatedResultsWrapper<
  CollectionResponse[]
>;

// Community Responses
export type WrappedCommunityResponse = ResultsWrappe
```

### Core Architecture Module: `js/sdk/src/utils/index.ts`
```
export * from "./typeTransformer";
export * from "./utils";

```

### Core Architecture Module: `js/sdk/src/utils/typeTransformer.ts`
```
/**
 * Utility type to convert string to camelCase
 */
type CamelCase<S extends string> = S extends `${infer P}_${infer Q}`
  ? `${P}${Capitalize<CamelCase<Q>>}`
  : S;

/**
 * Recursively transforms object keys to camelCase
 */
type CamelCaseKeys<T> = {
  [K in keyof T as K extends string ? CamelCase<K> : K]: T[K] extends Record<
    string,
    any
  >
    ? CamelCaseKeys<T[K]>
    : T[K] extends Array<any>
      ? Array<CamelCaseKeys<T[K][number]>>
      : T[K];
};

/**
 * Utility type to convert string to snake_case
 */
type SnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? T extends Uppercase<T>
    ? `${T extends Lowercase<T> ? "" : "_"}${Lowercase<T>}${SnakeCase<U>}`
    : `${T}${SnakeCase<U>}`
  : S;

/**
 * Recursively transforms object keys to snake_case
 */
type SnakeCaseKeys<T> = {
  [K in keyof T as K extends string ? SnakeCase<K> : K]: T[K] extends Record<
    string,
    any
  >
    ? SnakeCaseKeys<T[K]>
    : T[K] extends Array<any>
      ? Array<SnakeCaseKeys<T[K][number]>>
      : T[K];
};

const isObject = (value: unknown): value is Record<string | symbol, unknown> =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date) &&
  !(value instanceof Map) &&
  !(value instanceof Set) &&
  !(value instanceof Error) &&
  !(value instanceof RegExp);

const isValidInput = (value: unknown): boolean =>
  value !== null && value !== undefined;

const convertToCamelCase = (str: string): string => {
  // Preserve leading underscores
  const matches = str.match(/^(_+)/);
  const leadingUnderscores = matches ? matches[1] : "";
  const withoutLeadingUnderscores = str.slice(leadingUnderscores.length);

  if (!withoutLeadingUnderscores) {
    return str;
  }

  // Split by underscore and capitalize
  const converted = withoutLeadingUnderscores
    .split("_")
    .map((word, index) => {
      if (index === 0) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join("");

  return leadingUnderscores + converted;
};

const convertToSnakeCase = (str: string): string => {
  // Preserve leading underscores
  const matches = str.match(/^(_+)/);
  const leadingUnderscores = matches ? matches[1] : "";
  const withoutLeadingUnderscores = str.slice(leadingUnderscores.length);

  if (!withoutLeadingUnderscores) {
    return str;
  }

  // Handle acronyms and regular camelCase
  const withAcronyms = withoutLeadingUnderscores
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z\d])([A-Z])/g, "$1_$2")
    .toLowerCase();

  return leadingUnderscores + withAcronyms;
};

export function ensureCamelCase<T>(input: T): CamelCaseKeys<T> {
  if (!isValidInput(input)) {
    return input as CamelCaseKeys<T>;
  }

  if (Array.isArray(input)) {
    return input.map((item) => ensureCamelCase(item)) as CamelCaseKeys<T>;
  }

  if (!isObject(input)) {
    return input as CamelCaseKeys<T>;
  }

  try {
    const result = {} as Record<string | symbol, unknown>;

    // Handle all properties including symbols
    const allKeys = [
      ...Object.getOwnPropertyNames(input),
      ...Object.getOwnPropertySymbols(input),
    ];

    for (const key of allKeys) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key)!;

      if (typeof key === "symbol") {
        Object.defineProperty(result, key, descriptor);
      } else {
        const newKey = convertToCamelCase(key.toString());
        const value = (input as any)[key];

        if (isObject(value)) {
          // Transform nested object and preserve its symbol properties
          const transformed = ensureCamelCase(value);
          result[newKey] = transformed;

          // Copy all symbol properties from the original nested object
          Object.getOwnPropertySymbols(value).forEach((symKey) => {
            const symDesc = Object.getOwnPropertyDescriptor(value, symKey)!;
            Object.defineProperty(transformed, symKey, symDesc);
          });
        } else if (Array.isArray(value)) {
          result[newKey] = value.map((item) => ensureCamelCase(item));
        } else {
          result[newKey] = value;
        }
      }
    }

    return result as CamelCaseKeys<T>;
  } catch (error) {
    throw new Error(
      `Failed to transform to camelCase: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

export function ensureSnakeCase<T>(input: T): SnakeCaseKeys<T> {
  if (!isValidInput(input)) {
    return input as SnakeCaseKeys<T>;
  }

  if (Array.isArray(input)) {
    return input.map((item) => ensureSnakeCase(item)) as SnakeCaseKeys<T>;
  }

  if (!isObject(input)) {
    return input as SnakeCaseKeys<T>;
  }

  try {
    const result = {} as Record<string | symbol, unknown>;
    const descriptors = Object.getOwnPropertyDescriptors(input);

    for (const key of [
      ...Object.getOwnPropertyNames(input),
      ...Object.getOwnPropertySymbols(input),
    ]) {
      const desc = descriptors[key as any];
      const { value } = desc;

      if (typeof key === "symbol") {
        if (isObject(value)) {
          const transformed = ensureSnakeCase(value);
          Object.defineProperty(result, key, {
            enumerable: true,
            configurable: true,
            writable: true,
            value: transformed,
          });
        } else {
          result[key] = value;
        }
      } else {
        const newKey = convertToSnakeCase(key.toString());
        if (isObject(value)) {
          const transformed = ensureSnakeCase(value) as Record<
            string | symbol,
            unknown
          >;
          result[newKey] = transformed;

          // Copy symbol properties
          Object.getOwnPropertySymbols(value).forEach((symKey) => {
            Object.defineProperty(transformed, symKey, {
              ...Object.getOwnPropertyDescriptor(value, symKey)!,
              value: value[symKey],
            });
          });
        } else if (Array.isArray(value)) {
          result[newKey] = value.map((item) => ensureSnakeCase(item));
        } else {
          result[newKey] = value;
        }
      }
    }

    return result as SnakeCaseKeys<T>;
  } catch (error) {
    throw new Error(
      `Failed to transform to snake_case: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #209** (2024-03-29): **Synthetic Query Generation Pipeline**
  *Symptoms*: 1. Revive the synthetic query generation pipeline 2. Add documentation around synthetic query generation (e.g. clearer example use)

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

### Incident Patch 1: `95affa55` (2025-11-07)
**Commit Message**: Fix multiple issues (limit inconsistency, invisible documents (#2260)

* fix multiple issues

* revert counter changes

* revert document list changes

**File**: `llms.txt` (modified, +2/-2)
```diff
@@ -4180,7 +4180,7 @@ Returns a paginated list of documents accessible to the authenticated user. Regu
 | :-------------------------- | :------- | :------ | :-------------------------------------------------------------------------- |
 | `ids`                       | `string` | No      | A comma-separated list of document IDs to retrieve.                         |
 | `offset`                    | `integer`| No      | Number of objects to skip. Defaults to `0`.                                 |
-| `limit`                     | `integer`| No      | Max number of objects to return, `1–100`. Defaults to `100`.               |
+| `limit`                     | `integer`| No      | Max number of objects to return, `1–1000`. Defaults to `100`.               |
 | `include_summary_embeddings`| `integer`| No      | Whether to include embeddings of each document summary (`1` for true, `0` for false). |
 
 **Successful Response:**
@@ -4434,7 +4434,7 @@ Retrieves the text chunks generated from a document during ingestion. Chunks rep
 | Parameter         | Type      | Required | Description                                       |
 | :---------------- | :-------- | :------ | :------------------------------------------------ |
 | `offset`          | `integer` | No      | Number of chunks to skip. Defaults to `0`.        |
-| `limit`           | `integer` | No      | Number of chunks to return (`1–100`). Defaults to `100`. |
+| `limit`           | `integer` | No      | Number of chunks to return (`1–1000`). Defaults to `100`. |
 | `include_vectors` | `boolean` | No      | Whether to include vector embeddings in the response (`true` or `false`). |
 
 **Successful Response:**
```

**File**: `py/core/main/api/v3/chunks_router.py` (modified, +1/-1)
```diff
@@ -374,7 +374,7 @@ async def list_chunks(
                 100,
                 ge=1,
                 le=1000,
-                description="Specifies a limit on the number of objects to return, ranging between 1 and 100. Defaults to 100.",
+                description="Specifies a limit on the number of objects to return, ranging between 1 and 1000. Defaults to 100.",
             ),
             auth_user=Depends(self.providers.auth.auth_wrapper()),
         ) -> WrappedChunksResponse:
```

**File**: `py/core/main/api/v3/collections_router.py` (modified, +4/-4)
```diff
@@ -336,7 +336,7 @@ async def list_collections(
                 100,
                 ge=1,
                 le=1000,
-                description="Specifies a limit on the number of objects to return, ranging between 1 and 100. Defaults to 100.",
+                description="Specifies a limit on the number of objects to return, ranging between 1 and 1000. Defaults to 100.",
             ),
             owner_only: bool = Query(
                 False,
@@ -359,7 +359,7 @@ async def list_collections(
             else:
                 requesting_user_id = [auth_user.id]
 
-            collection_uuids = [UUID(collection_id) for collection_id in ids]
+            collection_uuids = [UUID(collection_id) for collection_id in ids] if ids else None
 
             collections_overview_response = (
                 await self.services.management.collections_overview(
@@ -738,7 +738,7 @@ async def get_collection_documents(
                 100,
                 ge=1,
                 le=1000,
-                description="Specifies a limit on the number of objects to return, ranging between 1 and 100. Defaults to 100.",
+                description="Specifies a limit on the number of objects to return, ranging between 1 and 1000. Defaults to 100.",
             ),
             auth_user=Depends(self.providers.auth.auth_wrapper()),
         ) -> WrappedDocumentsResponse:
@@ -898,7 +898,7 @@ async def get_collection_users(
                 100,
                 ge=1,
                 le=1000,
-                description="Specifies a limit on the number of objects to return, ranging between 1 and 100. Defaults to 100.",
+                description="Specifies a limit on the number of objects to return, ranging between 1 and 1000. Defaults to 100.",
             ),
             auth_user=Depends(self.providers.auth.auth_wrapper()),
         ) -> WrappedUsersResponse:
```

**File**: `py/core/main/api/v3/documents_router.py` (modified, +15/-7)
```diff
@@ -532,14 +532,22 @@ async def create_document(
                 file_data["content_type"],
             )
 
-            await self.services.ingestion.ingest_file_ingress(
+            ingest_result = await self.services.ingestion.ingest_file_ingress(
                 file_data=workflow_input["file_data"],
                 user=auth_user,
                 document_id=workflow_input["document_id"],
                 size_in_bytes=workflow_input["size_in_bytes"],
                 metadata=workflow_input["metadata"],
                 version=workflow_input["version"],
             )
+            
+            # Update workflow input with the document's collection_ids
+            document_info = ingest_result["info"]
+            workflow_input["collection_ids"] = (
+                [str(cid) for cid in document_info.collection_ids]
+                if document_info.collection_ids
+                else None
+            )
 
             if run_with_orchestration:
                 try:
@@ -980,7 +988,7 @@ async def get_documents(
                 100,
                 ge=1,
                 le=1000,
-                description="Specifies a limit on the number of objects to return, ranging between 1 and 100. Defaults to 100.",
+                description="Specifies a limit on the number of objects to return, ranging between 1 and 1000. Defaults to 100.",
             ),
             include_summary_embeddings: bool = Query(
                 False,
@@ -1010,7 +1018,7 @@ async def get_documents(
                 requesting_user_id = [auth_user.id]
                 filter_collection_ids = auth_user.collection_ids
 
-            document_uuids = [UUID(document_id) for document_id in ids]
+            document_uuids = [UUID(document_id) for document_id in ids] if ids else None
             documents_overview_response = (
                 await self.services.management.documents_overview(
                     user_ids=requesting_user_id,
@@ -1176,7 +1184,7 @@ async def list_chunks(
                 100,
                 ge=1,
                 le=1000,
-                description="Specifies a limit on the number of objects to return, ranging between 1 and 100. Defaults to 100.",
+                description="Specifies a limit on the number of objects to return, ranging between 1 and 1000. Defaults to 100.",
             ),
             include_vectors: Optional[bool] = Query(
                 False,
@@ -1562,7 +1570,7 @@ async def get_document_collections(
                 100,
                 ge=1,
                 le=1000,
-                description="Specifies a limit on the number of objects to return, ranging between 1 and 100. Defaults to 100.",
+                description="Specifies a limit on the number of objects to return, ranging between 1 and 1000. Defaults to 100.",
             ),
             auth_user=Depends(self.providers.auth.auth_wrapper()),
         ) -> WrappedCollectionsResponse:
@@ -1890,7 +1898,7 @@ async def get_entities(
                 100,
                 ge=1,
                 le=1000,
-                description="Specifies a limit on the number of objects to return, ranging between 1 and 100. Defaults to 100.",
+                description="Specifies a limit on the number of objects to return, ranging between 1 and 1000. Defaults to 100.",
             ),
             include_embeddings: Optional[bool] = Query(
                 False,
@@ -2117,7 +2125,7 @@ async def get_relationships(
                 100,
                 ge=1,
                 le=1000,
-                description="Specifies a limit on the number of objects to return, ranging between 1 and 100. Defaults to 100.",
+                description="Specifies a limit on the number of objects to return, ranging between 1 and 1000. Defaults to 100.",
             ),
             entity_names: Optional[list[str]] = Query(
                 None,
```

**File**: `py/core/main/api/v3/users_router.py` (modified, +2/-2)
```diff
@@ -756,7 +756,7 @@ async def list_users(
                 100,
                 ge=1,
                 le=1000,
-                description="Specifies a limit on the number of objects to return, ranging between 1 and 100. Defaults to 100.",
+                description="Specifies a limit on the number of objects to return, ranging between 1 and 1000. Defaults to 100.",
             ),
             auth_user=Depends(self.providers.auth.auth_wrapper()),
         ) -> WrappedUsersResponse:
@@ -1040,7 +1040,7 @@ async def get_user_collections(
                 100,
                 ge=1,
                 le=1000,
-                description="Specifies a limit on the number of objects to return, ranging between 1 and 100. Defaults to 100.",
+                description="Specifies a limit on the number of objects to return, ranging between 1 and 1000. Defaults to 100.",
             ),
             auth_user=Depends(self.providers.auth.auth_wrapper()),
         ) -> WrappedCollectionsResponse:
```

---

### Incident Patch 2: `e7ada714` (2025-11-07)
**Commit Message**: Fix #2257 (#2259)

* Fix: Update collection_ids assignment in DocumentResponse creation

* Fix: Include collection_ids in document selection query

**File**: `py/core/providers/database/collections.py` (modified, +2/-1)
```diff
@@ -310,6 +310,7 @@ async def documents_in_collection(
         query = f"""
             SELECT d.id, d.owner_id, d.type, d.metadata, d.title, d.version,
                 d.size_in_bytes, d.ingestion_status, d.extraction_status, d.created_at, d.updated_at, d.summary,
+                d.collection_ids,
                 COUNT(*) OVER() AS total_entries
             FROM {self._get_table_name("documents")} d
             WHERE $1 = ANY(d.collection_ids)
@@ -326,7 +327,7 @@ async def documents_in_collection(
         documents = [
             DocumentResponse(
                 id=row["id"],
-                collection_ids=[collection_id],
+                collection_ids=row["collection_ids"],
                 owner_id=row["owner_id"],
                 document_type=DocumentType(row["type"]),
                 metadata=json.loads(row["metadata"]),
```

---

### Incident Patch 3: `b9319b75` (2025-08-17)
**Commit Message**: Fix invalid syntax in README.md (#2231)

**File**: `py/README.md` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ response = client.retrieval.rag(query="What is DeepSeek R1?")
 response = client.retrieval.agent(
   message={"role":"user", "content": "What does deepseek r1 imply? Think about market, societal implications, and more."},
   rag_generation_config={
-    "model"="anthropic/claude-3-7-sonnet-20250219",
+    "model": "anthropic/claude-3-7-sonnet-20250219",
     "extended_thinking": True,
     "thinking_budget": 4096,
     "temperature": 1,
```

---

### Incident Patch 4: `19150119` (2025-06-06)
**Commit Message**: Hotfix: Lint community K8s PR and bump package

**File**: `.pre-commit-config.yaml` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@ repos:
       - id: check-ast
         exclude: ^.venv/
       - id: check-yaml
-        exclude: ^.venv/
+        exclude: ^(.venv/|deployment/)
 
   - repo: local
     hooks:
```

**File**: `deployment/k8s/kustomizations/helm-values_hatchet.yaml` (modified, +1/-1)
```diff
@@ -215,4 +215,4 @@ rabbitmq:
       amqp: 5672
 
 caddy:
-  enabled: false
\ No newline at end of file
+  enabled: false
```

**File**: `deployment/k8s/kustomizations/helm-values_postgresql.yaml` (modified, +1/-1)
```diff
@@ -10,4 +10,4 @@ global:
   storageClass: csi-sc
   postgresql:
     auth:
-      database: hatchet
\ No newline at end of file
+      database: hatchet
```

**File**: `deployment/k8s/kustomizations/include/cm-hatchet.yaml` (modified, +1/-1)
```diff
@@ -17,4 +17,4 @@ data:
   HATCHET_ADMIN_INIT_ALLOW_OVERRIDE_APIKEY: "false"
   HATCHET_TENANT_ID: "707d0855-80ab-4e1f-a156-f1c4546cbf52"
   RABBITMQ_URL: "http://hatchet-rabbitmq"
-  RABBITMQ_MGMT_PORT: "15672"
\ No newline at end of file
+  RABBITMQ_MGMT_PORT: "15672"
```

**File**: `deployment/k8s/kustomizations/include/cm-hatchet_OLD.yaml` (modified, +1/-1)
```diff
@@ -37,4 +37,4 @@ data:
   #New
   HATCHET_CLIENT_TLS_STRATEGY: "none"
   HATCHET_CLIENT_GRPC_MAX_RECV_MESSAGE_LENGTH: "134217728"
-  HATCHET_CLIENT_GRPC_MAX_SEND_MESSAGE_LENGTH: "134217728"
\ No newline at end of file
+  HATCHET_CLIENT_GRPC_MAX_SEND_MESSAGE_LENGTH: "134217728"
```

---

### Incident Patch 5: `b00bcbd2` (2025-05-30)
**Commit Message**: Fix incorrect project name (#2206)

**File**: `py/core/main/app_entry.py` (modified, +1/-1)
```diff
@@ -78,7 +78,7 @@ async def create_r2r_app(
 config = R2RConfig.load(config_name=config_name, config_path=config_path)
 
 project_name = (
-    os.getenv("R2R_PROJECT_NAME") or config.app.project_name or "default"
+    os.getenv("R2R_PROJECT_NAME") or config.app.project_name or "r2r_default"
 )
 
 logging.info(
```

---

### Incident Patch 6: `5f043c2c` (2025-05-27)
**Commit Message**: Fix setting non-default project name (#2201)

**File**: `py/core/main/app.py` (modified, +6/-2)
```diff
@@ -10,7 +10,7 @@
 )
 from core.utils.sentry import init_sentry
 
-from .abstractions import R2RServices
+from .abstractions import R2RProviders, R2RServices
 from .api.v3.chunks_router import ChunksRouter
 from .api.v3.collections_router import CollectionsRouter
 from .api.v3.conversations_router import ConversationsRouter
@@ -33,6 +33,7 @@ def __init__(
             HatchetOrchestrationProvider | SimpleOrchestrationProvider
         ),
         services: R2RServices,
+        providers: R2RProviders,
         chunks_router: ChunksRouter,
         collections_router: CollectionsRouter,
         conversations_router: ConversationsRouter,
@@ -48,6 +49,7 @@ def __init__(
 
         self.config = config
         self.services = services
+        self.providers = providers
         self.chunks_router = chunks_router
         self.collections_router = collections_router
         self.conversations_router = conversations_router
@@ -97,6 +99,8 @@ async def openapi_spec():
 
     def _apply_middleware(self):
         origins = ["*", "http://localhost:3000", "http://localhost:7272"]
+        project_name = self.providers.database.project_name
+
         self.app.add_middleware(
             CORSMiddleware,
             allow_origins=origins,
@@ -107,7 +111,7 @@ def _apply_middleware(self):
 
         self.app.add_middleware(
             ProjectSchemaMiddleware,
-            default_schema="r2r_default",
+            default_schema=project_name,
         )
 
     async def serve(self, host: str = "0.0.0.0", port: int = 7272):
```

**File**: `py/core/main/app_entry.py` (modified, +11/-3)
```diff
@@ -11,6 +11,7 @@
 from core.base import R2RException
 from core.utils.logging_config import configure_logging
 
+from .app import R2RApp
 from .assembly import R2RBuilder, R2RConfig
 from .middleware.project_schema import ProjectSchemaMiddleware
 
@@ -50,7 +51,7 @@ async def lifespan(app: FastAPI):
 async def create_r2r_app(
     config_name: Optional[str] = "default",
     config_path: Optional[str] = None,
-):
+) -> R2RApp:
     config = R2RConfig.load(config_name=config_name, config_path=config_path)
 
     if (
@@ -74,6 +75,12 @@ async def create_r2r_app(
 host = os.getenv("R2R_HOST", os.getenv("HOST", "0.0.0.0"))
 port = int(os.getenv("R2R_PORT", "7272"))
 
+config = R2RConfig.load(config_name=config_name, config_path=config_path)
+
+project_name = (
+    os.getenv("R2R_PROJECT_NAME") or config.app.project_name or "default"
+)
+
 logging.info(
     f"Environment R2R_IMAGE: {os.getenv('R2R_IMAGE')}",
 )
@@ -84,7 +91,7 @@ async def create_r2r_app(
     f"Environment R2R_CONFIG_PATH: {'None' if config_path is None else config_path}"
 )
 logging.info(f"Environment R2R_PROJECT_NAME: {os.getenv('R2R_PROJECT_NAME')}")
-
+logging.info(f"Using project name: {project_name}")
 logging.info(
     f"Environment R2R_POSTGRES_HOST: {os.getenv('R2R_POSTGRES_HOST')}"
 )
@@ -125,7 +132,8 @@ async def r2r_exception_handler(request: Request, exc: R2RException):
     allow_headers=["*"],
 )
 
+
 app.add_middleware(
     ProjectSchemaMiddleware,
-    default_schema="r2r_default",
+    default_schema=project_name,
 )
```

**File**: `py/core/main/assembly/builder.py` (modified, +1/-0)
```diff
@@ -135,6 +135,7 @@ async def build(self, *args, **kwargs) -> R2RApp:
             config=self.config,
             orchestration_provider=providers.orchestration,
             services=services,
+            providers=providers,
             **routers,
         )
 
```

---

### Incident Patch 7: `c53e75b9` (2025-05-22)
**Commit Message**: Hotfix: Change example PDF



---

### Incident Patch 8: `6726c110` (2025-05-22)
**Commit Message**: Fix middleware for containers (#2197)

**File**: `py/core/main/app_entry.py` (modified, +6/-0)
```diff
@@ -12,6 +12,7 @@
 from core.utils.logging_config import configure_logging
 
 from .assembly import R2RBuilder, R2RConfig
+from .middleware.project_schema import ProjectSchemaMiddleware
 
 log_file = configure_logging()
 
@@ -123,3 +124,8 @@ async def r2r_exception_handler(request: Request, exc: R2RException):
     allow_methods=["*"],
     allow_headers=["*"],
 )
+
+app.add_middleware(
+    ProjectSchemaMiddleware,
+    default_schema="r2r_default",
+)
```

**File**: `py/pyproject.toml` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ build-backend = "setuptools.build_meta"
 
 [project]
 name = "r2r"
-version = "3.6.2"
+version = "3.6.3"
 description = "SciPhi R2R"
 readme = "README.md"
 license = {text = "MIT"}
```

---

### Incident Patch 9: `28870a65` (2025-05-21)
**Commit Message**: Fix community summary errors where openai returns non xml entity strings (#2196)

**File**: `py/core/main/services/graph_service.py` (modified, +3/-1)
```diff
@@ -813,7 +813,9 @@ async def _process_community_summary(
                         "No <community> XML found in LLM response"
                     )
 
-                xml_content = match.group(0)
+                xml_content = re.sub(
+                    r"&(?!amp;|quot;|apos;|lt;|gt;)", "&amp;", match.group(0)
+                ).strip()
                 root = ET.fromstring(xml_content)
 
                 # extract fields
```

---

### Incident Patch 10: `388fb3ae` (2025-05-20)
**Commit Message**: Update search_file_knowledge.py to fix filtering issue (#2192)

**File**: `py/core/base/agent/tools/built_in/search_file_knowledge.py` (modified, +1/-1)
```diff
@@ -56,7 +56,7 @@ async def execute(self, query: str, *args, **kwargs):
             """
             results = await knowledge_search_method(
                 query=query,
-                settings=context.search_settings,
+                search_settings=context.search_settings,
             )
 
             # FIXME: This is slop
```

#### Recent Merged Pull Requests:
- **PR #2303** (closed): chunk prefix (@LeoHelfferich)
- **PR #2302** (closed): Fix typo in R2R (#2297) (@bglglzd)
- **PR #2283** (closed): Delete arm build (@lgcorzo)
- **PR #2282** (closed): R2r stream solve (@lgcorzo)
- **PR #2281** (closed): KAIG-996-html base64 fix (@nithingovindugari)
- **PR #2278** (closed): collection count fix (@nithingovindugari)
- **PR #2277** (closed): Claude/add gcloud mcp config 014 pubm8ibpx yr rhjstcph8 l (@evgenygurin)
- **PR #2275** (closed): Claude: presidio pii pseudonymization (@Aconradty)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
