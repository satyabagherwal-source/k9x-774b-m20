# Forensic Learning Record (Deep Inspection): pipeshub-ai/pipeshub-ai

> **Canonical Artifact**: `07_PROJECT_LEARNING/pipeshub-ai-pipeshub-ai-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/pipeshub-ai/pipeshub-ai](https://github.com/pipeshub-ai/pipeshub-ai))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:03:34.177Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `pipeshub-ai/pipeshub-ai`
- **Description**: PipesHub is an open-source platform for securely connecting enterprise knowledge to AI. Give AI agents trusted context and your team permission-aware search with verified citations across your business systems.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 3791 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/nodejs/apps/eslint.config.mjs`
```
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
  // Base recommended rules
  eslint.configs.recommended,

  // Strict type-checked rules (compiled-language strictness)
  ...tseslint.configs.strictTypeChecked,

  // Prettier (must be last to override formatting rules)
  eslintPluginPrettier,

  // Global settings
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Rules for all TypeScript files
  {
    files: ['src/**/*.ts'],
    rules: {
      'prettier/prettier': 'error',

      // --- Return type enforcement (like compiled languages) ---
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
          allowDirectConstAssertionInArrowFunctions: true,
        },
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'error',

      // --- Exhaustiveness (like Rust match) ---
      '@typescript-eslint/switch-exhaustiveness-check': 'error',

      // --- Type assertion control (no unsafe object literal casts) ---
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        {
          assertionStyle: 'as',
          objectLiteralTypeAssertions: 'never',
        },
      ],

      // --- Boolean strictness (like Go — no truthy/falsy implicit coercion) ---
      '@typescript-eslint/strict-boolean-expressions': [
        'warn',
        {
          allowString: false,
          allowNumber: false,
          allowNullableObject: true,
          allowNullableBoolean: true,
          allowNullableString: false,
          allowNullableNumber: false,
          allowAny: false,
        },
      ],

      // --- Gradual adoption (warn, not error) ---
      '@typescript-eslint/restrict-template-expressions': 'warn',
      '@typescript-eslint/restrict-plus-operands': 'warn',
      '@typescript-eslint/no-confusing-void-expression': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'warn',

      // --- Keep explicit types — we WANT them (compiled-language style) ---
      '@typescript-eslint/no-inferrable-types': 'off',

      // --- inversify DI requires classes decorated with @injectable() ---
      '@typescript-eslint/no-extraneous-class': 'off',

      // --- Dead code & unused symbols ---
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'after-used',
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      'no-unreachable': 'error',
    },
  },

  // Ignore patterns
  {
    ignores: ['dist/**', 'node_modules/**', '**/*.js', '**/*.mjs'],
  },
);

```

### Core Architecture Module: `backend/nodejs/apps/src/app.ts`
```
import express, { Express, Response } from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { IncomingMessage } from 'http';
import { redactSensitiveQueryParams } from './libs/utils/log-redaction.utils';
import http from 'http';
import { HttpMethod } from './libs/enums/http-methods.enum';
import { Container } from 'inversify';
import { Logger } from './libs/services/logger.service';
import { createHealthRouter } from './modules/tokens_manager/routes/health.routes';
import { ErrorMiddleware } from './libs/middlewares/error.middleware';
import { OAuthTokenService } from './modules/oauth_provider/services/oauth_token.service';
import { registerOAuthTokenService } from './libs/services/oauth-token-service.provider';
import { requestContextMiddleware } from './libs/middlewares/request.context';
import {
  runWithRequestContext,
  newSystemRoot,
} from './libs/context/request-context';
import { metricsMiddleware } from './libs/middlewares/telemetry.middleware';
import { startOrgMetricsRefresh } from './modules/user_management/services/metrics.refresh.service';
import { OutboxDispatcher } from './libs/services/outbox/outbox.dispatcher';
import { IMessageProducer } from './libs/types/messaging.types';
import { xssSanitizationMiddleware } from './libs/middlewares/xss-sanitization.middleware';

import { loadConfigurationManagerConfig } from './modules/configuration_manager/config/config';
import { MigrationService } from './modules/configuration_manager/services/migration.service';
import { createOAuthRouter } from './modules/tokens_manager/routes/oauth.routes';
import { startTelemetry } from './libs/services/telemetry/telemetry.service';
import { KeyValueStoreService } from './libs/services/keyValueStore.service';
// Import shared symbols from `./config` rather than `./modules/*` directly.
import {
  createStorageRouter,
  StorageContainer,
  createConnectorRouter,
  TokenManagerContainer,
  createUserRouter,
  createUserGroupRouter,
  createOrgRouter,
  UserManagerContainer,
  AuthServiceContainer,
  createUserAccountRouter,
  createSamlRouter,
  createOrgAuthConfigRouter,
  SamlController,
  MailServiceContainer,
  createMailServiceRouter,
  EnterpriseSearchAgentContainer,
  createConversationalRouter,
  createSemanticSearchRouter,
  createAgentConversationalRouter,
  createChatSpeechRouter,
  KnowledgeBaseContainer,
  createKnowledgeBaseRouter,
  ConfigurationManagerContainer,
  createConfigurationManagerRouter,
  createWorkspaceAuthRouter,
  createFeatureFlagRouter,
  createOrgConfigRouter,
  createRequestRouter,
  OAuthAppsContainer,
  createOAuthAppsRouter,
} from './config';
import { NotificationContainer } from './modules/notification/container/notification.container';
import { NotificationConsumer } from './modules/notification/service/notification.consumer';
import { createNotificationRouter } from './modules/notification/routes/notification.routes';
import {
  loadAppConfig,
  AppConfig,
} from './modules/tokens_manager/config/config';
import { NotificationService } from './modules/notification/service/notification.service';
import { DesktopProxySocketGateway } from './modules/desktop_proxy/socket/desktop-proxy.gateway';
import { DesktopProxyContainer } from './modules/desktop_proxy/container/desktop-proxy.container';
import { createDesktopProxyRouter } from './modules/desktop_proxy/routes/desktop-proxy.routes';
import { registerDesktopPresence } from './libs/services/desktop-presence.provider';
import { createGlobalRateLimiter } from './libs/middlewares/rate-limit.middleware';
import { ApiDocsContainer } from './modules/api-docs/docs.container';
import { createApiDocsRouter } from './modules/api-docs/docs.routes';
import { CrawlingManagerContainer } from './modules/crawling_manager/container/cm_container';
import createCrawlingManagerRouter from './modules/crawling_manager/routes/cm_routes';
import { CrawlingSchedulerService } from './modules/crawling_manager/services/crawling_service';
import { checkAndMigrateIfNeeded } from './libs/keyValueStore/migration/kvStoreMigration.service';
import { StoreType } from './libs/keyValueStore/constants/KeyValueStoreType';
import { createTeamsRouter } from './modules/user_management/routes/teams.routes';
import { OAuthProviderContainer } from './modules/oauth_provider/container/oauth.provider.container';
import { createOAuthProviderRouter } from './modules/oauth_provider/routes/oauth.provider.routes';
import { createOAuthClientsRouter } from './modules/oauth_provider/routes/oauth.clients.routes';
import { createServiceAccountsRouter } from './modules/user_management/routes/service-accounts.routes';
import { createServiceTokenRouter } from './modules/oauth_provider/routes/service-token.routes';
import { ServiceAccountsService } from './modules/user_management/services/service-accounts.service';
import { ServiceTokenService } from './modules/oauth_provider/services/service-token.service';
import { createPatRouter } from './modules/oauth_provider/routes/pat.routes';
import { createOIDCDiscoveryRouter } from './modules/oauth_provider/routes/oid.provider.routes';
import {
  resolveMessageBrokerConfig,
  ensureMessageTopicsExist,
  REQUIRED_TOPICS,
} from './libs/services/message-broker.factory';
import { ToolsetsContainer } from './modules/toolsets/container/toolsets.container';
import { createToolsetsRouter } from './modules/toolsets/routes/toolsets_routes';
import { SkillsContainer } from './modules/skills/container/skills.container';
import { createSkillsRouter } from './modules/skills/routes/skills.routes';
import { McpServersContainer } from './modules/mcp_servers/container/mcp_servers.container';
import { createMcpServersRouter } from './modules/mcp_servers/routes/mcp_servers.routes';
import { ProjectsContainer } from './modules/projects/container/project.container';
import { createProjectsRouter } from './modules/projects/routes/project.routes';
import { createMCPRouter } from './modules/mcp/routes/mcp.routes';
// Side-effect import: registers edition-specific Redis providers for this process.
import './redisProviders';
import {
  RedisConnectionProviderFactory,
  closeAllRedisProviders,
  getPreparedRedisProvider,
} from './libs/services/redis/connectionProviderFactory';

const SERVER_KEEP_ALIVE_TIMEOUT_MS = 65_000;

const loggerConfig = {
  service: 'Application',
};

export class Application {
  private app: Express;
  private server: http.Server;
  private tokenManagerContainer!: Container;
  private storageServiceContainer!: Container;
  private esAgentContainer!: Container;
  private logger!: Logger;
  private authServiceContainer!: Container;
  private entityManagerContainer!: Container;
  private knowledgeBaseContainer!: Container;
  private configurationManagerContainer!: Container;
  private mailServiceContainer!: Container;
  private notificationContainer!: Container;
  private desktopProxyContainer!: Container;
  private outboxDispatcher: OutboxDispatcher | null = null;
  private crawlingManagerContainer!: Container;
  private apiDocsContainer!: Container;
  private oauthProviderContainer!: Container;
  private toolsetsContainer!: Container;
  private skillsContainer!: Container;
  private oauthAppsContainer!: Container;
  private mcpServersContainer!: Container;
  private projectsContainer!: Container;
  private desktopProxySocketGateway: DesktopProxySocketGateway | null = null;
  private port: number;

  constructor() {
    this.app = express();
    this.port = parseInt(process.env.PORT || '3000', 10);
    this.server = http.createServer(this.app);
    // Python services reuse pooled connections to this server for up to 4s
    // after they *process* a response, and a busy event loop can get there
    // seconds late. Node's 5s default closed sockets they were about to reuse
    // ("Can not write request body" on record uploads).
    this.server.keepAliveTimeout = SERVER_KEEP_ALIVE_TIMEOUT_MS;
    this.server.header
```

### Core Architecture Module: `backend/nodejs/apps/src/config.ts`
```
// --- Global singletons (Mongoose models) ---
export { Users, User } from './modules/user_management/schema/users.schema';
export { Org } from './modules/user_management/schema/org.schema';

// --- Shared cross-cutting middleware ---
export { AuthMiddleware } from './libs/middlewares/auth.middleware';

// --- Storage & connectors ---
export { StorageContainer } from './modules/storage/container/storage.container';
export { createStorageRouter } from './modules/storage/routes/storage.routes';
export { createConnectorRouter } from './modules/tokens_manager/routes/connectors.routes';

// --- User management ---
export { createUserRouter } from './modules/user_management/routes/users.routes';
export { createUserGroupRouter } from './modules/user_management/routes/userGroups.routes';
export { createOrgRouter } from './modules/user_management/routes/org.routes';
export { UserManagerContainer } from './modules/user_management/container/userManager.container';

// --- Auth ---
export { AuthServiceContainer } from './modules/auth/container/authService.container';
export { createUserAccountRouter } from './modules/auth/routes/userAccount.routes';
export { createSamlRouter } from './modules/auth/routes/saml.routes';
export { createOrgAuthConfigRouter } from './modules/auth/routes/orgAuthConfig.routes';
export { SamlController } from './modules/auth/controller/saml.controller';

// --- Mail ---
export { MailServiceContainer } from './modules/mail/container/mailService.container';
export { createMailServiceRouter } from './modules/mail/routes/mail.routes';

// --- Enterprise search ---
export { EnterpriseSearchAgentContainer } from './modules/enterprise_search/container/es.container';
export {
  createConversationalRouter,
  createSemanticSearchRouter,
  createAgentConversationalRouter,
  createChatSpeechRouter,
} from './modules/enterprise_search/routes/es.routes';

// --- Knowledge base ---
export { KnowledgeBaseContainer } from './modules/knowledge_base/container/kb_container';
export { createKnowledgeBaseRouter } from './modules/knowledge_base/routes/kb.routes';

// --- Configuration manager ---
export { ConfigurationManagerContainer } from './modules/configuration_manager/container/cm_container';
export { createConfigurationManagerRouter } from './modules/configuration_manager/routes/cm_routes';
export { MigrationService } from './modules/configuration_manager/services/migration.service';

// --- Tokens manager ---
export { TokenManagerContainer } from './modules/tokens_manager/container/token-manager.container';

// --- Auth (workspace auth routes) ---
export { createWorkspaceAuthRouter } from './modules/auth/routes/workspaceAuth.routes';

// --- User management (feature flags stub, org config stub) ---
export { createFeatureFlagRouter } from './modules/user_management/routes/featureFlag.routes';
export { createOrgConfigRouter } from './modules/user_management/routes/orgConfig.routes';
export { createRequestRouter } from './modules/user_management/routes/request.routes';

// --- OAuth Apps ---
export { OAuthAppsContainer } from './modules/oauth_apps/container/oauth_apps.container';
export { createOAuthAppsRouter } from './modules/oauth_apps/routes/oauth_apps.routes';

```

### Core Architecture Module: `backend/nodejs/apps/src/index.ts`
```
import 'reflect-metadata';
import { config } from 'dotenv';
import { Logger } from './libs/services/logger.service';

// Loads environment variables
config();
import { Application } from './app';

const app = new Application();
const logger = Logger.getInstance();

const gracefulShutdown = async (signal: string) => {
  logger.info(`Received ${signal}. Starting graceful shutdown...`);
  try {
    await app.stop();
    process.exit(0);
  } catch (error) {
    Logger.getInstance().error('Error during shutdown:', error);
    process.exit(1);
  }
};

// Global error handlers to prevent app crashes
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', {
    error: {
      name: error.name,
      message: error.message,
    }
  });
  // let the app try to recover for now until we have a better solution: to restart the app in a new process
  gracefulShutdown('uncaughtException'); // TODO: add this once we have a better solution
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', {
    reason: reason instanceof Error ? {
      name: reason.name,
      message: reason.message,
    } : String(reason),
    promise: promise.toString()
  });
  // let the app try to recover for now until we have a better solution: to restart the app in a new process
  // gracefulShutdown('unhandledRejection'); TODO: add this once we have a better solution
});

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

(async () => {
  try {
    await app.preInitMigration();
    await app.initialize();
    await app.start();
    await app.runMigration();
  } catch (error) {
    logger.error('Failed to start application:', error);
    process.exit(1);
  }
})();

```

### Core Architecture Module: `backend/nodejs/apps/src/integrations/slack-bot/src/authorizeFn.ts`
```
import {
  type SlackBotConfig,
  findSlackBotByIdentity,
  getCachedSlackBots,
  getCurrentMatchedSlackBot,
  refreshSlackBotRegistry,
} from "./botRegistry";

interface AuthorizeParams {
  teamId?: string;
  enterpriseId?: string;
  userId?: string;
  conversationId?: string;
  isEnterpriseInstall?: boolean;
}

interface AuthorizationResult {
  botToken: string;
  botId?: string;
  botUserId?: string;
}

export interface BotRegistryDeps {
  getCurrentMatchedSlackBot: () => SlackBotConfig | null;
  getCachedSlackBots: () => SlackBotConfig[];
  refreshSlackBotRegistry: (options?: { force?: boolean }) => Promise<SlackBotConfig[]>;
  findSlackBotByIdentity: (
    bots: SlackBotConfig[],
    identity: { teamId?: string; botId?: string; botUserId?: string },
  ) => SlackBotConfig | null;
}

function getStringField(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getBodyIdentifiers(body: unknown): {
  teamId?: string;
  botId?: string;
  botUserId?: string;
} {
  if (!body || typeof body !== "object") {
    return {};
  }

  const payload = body as Record<string, unknown>;
  const eventPayload =
    payload.event && typeof payload.event === "object"
      ? (payload.event as Record<string, unknown>)
      : null;

  let authorizationsPayload: Record<string, unknown> | null = null;
  if (Array.isArray(payload.authorizations) && payload.authorizations[0]) {
    const firstAuth = payload.authorizations[0];
    if (firstAuth && typeof firstAuth === "object") {
      authorizationsPayload = firstAuth as Record<string, unknown>;
    }
  }

  const teamId =
    getStringField(payload.team_id) ||
    getStringField((payload.team as Record<string, unknown> | undefined)?.id) ||
    getStringField(eventPayload?.team) ||
    getStringField(authorizationsPayload?.team_id);

  const botId =
    getStringField(eventPayload?.bot_id) ||
    getStringField(authorizationsPayload?.bot_id);

  const botUserId = getStringField(authorizationsPayload?.user_id);

  return { teamId, botId, botUserId };
}

export function createAuthorizeFn(deps: BotRegistryDeps) {
  return async (
    params: AuthorizeParams,
    body?: unknown,
  ): Promise<AuthorizationResult> => {
    const matchedFromRequestContext = deps.getCurrentMatchedSlackBot();
    if (matchedFromRequestContext?.botToken) {
      return { botToken: matchedFromRequestContext.botToken };
    }

    let bots = deps.getCachedSlackBots();
    if (bots.length === 0) {
      bots = await deps.refreshSlackBotRegistry({ force: true });
    }

    const bodyIdentifiers = getBodyIdentifiers(body);
    const matchedFromPayload = deps.findSlackBotByIdentity(bots, {
      teamId: params.teamId || bodyIdentifiers.teamId,
      botId: bodyIdentifiers.botId,
      botUserId: bodyIdentifiers.botUserId,
    });

    if (matchedFromPayload?.botToken) {
      return {
        botToken: matchedFromPayload.botToken,
        botId: matchedFromPayload.botId,
        botUserId: matchedFromPayload.botUserId,
      };
    }

    const fallbackBotToken = process.env.BOT_TOKEN;
    if (!fallbackBotToken) {
      throw new Error("Unable to resolve Slack bot token for authorization.");
    }

    return {
      botToken: fallbackBotToken,
      botId: process.env.SLACK_BOT_ID,
      botUserId: process.env.SLACK_BOT_USER_ID,
    };
  };
}

const authorizeFn = createAuthorizeFn({
  getCurrentMatchedSlackBot,
  getCachedSlackBots,
  refreshSlackBotRegistry,
  findSlackBotByIdentity,
});

export default authorizeFn;

```

### Core Architecture Module: `backend/nodejs/apps/src/integrations/slack-bot/src/botRegistry.ts`
```
import { AsyncLocalStorage } from "node:async_hooks";
// import axios from "axios";

import { slackJwtGenerator } from "../../../libs/utils/createJwt";
import { ConfigService } from "../../../modules/tokens_manager/services/cm.service";
import axios from "axios";
import { TokenScopes } from "../../../libs/enums/token-scopes.enum";


export interface SlackBotConfig {
  botToken: string;
  signingSecret: string;
  teamId?: string;
  botId?: string;
  botUserId?: string;
  agentId?: string | null;
}

interface SlackBotIdentity {
  teamId?: string;
  botId?: string;
  botUserId?: string;
}

interface SlackRequestContext {
  matchedBot: SlackBotConfig | null;
}

const slackRequestContext = new AsyncLocalStorage<SlackRequestContext>();
let slackBotsCache: SlackBotConfig[] = [];
let inFlightRefresh: Promise<SlackBotConfig[]> | null = null;

const SLACK_BOTS_API_URL = "/api/v1/configurationManager/internal/slack-bot"


function getStringField(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function normalizeBotEntry(entry: unknown): SlackBotConfig | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const botToken =
    getStringField(record.botToken) ||
    getStringField(record.bot_token) ||
    getStringField(record.token);
  const signingSecret =
    getStringField(record.signingSecret) ||
    getStringField(record.signing_secret);

  if (!botToken || !signingSecret) {
    return null;
  }

  const botId = getStringField(record.id) ;
  const agentId =
    getStringField(record.agentId) ||
    null;

  return {
    botToken,
    signingSecret,
    botId,
    agentId,
  };
}

function extractBotList(payload: unknown): unknown[] {
  if (!payload || typeof payload !== "object") {
    return [];
  }

  const record = payload as Record<string, unknown>;
  if (!record.configs) {
    throw new Error("Failed to get configured slack bots");
  }
  if (Array.isArray(record.configs)) {
    return record.configs;
  }

  return [];
}


const backendUrl = process.env.BACKEND_URL || "http://localhost:3000";


async function fetchAvailableSlackBots(): Promise<SlackBotConfig[]> {
  
  const configService = ConfigService.getInstance();
  const staticToken = slackJwtGenerator("", await configService.getScopedJwtSecret(),[TokenScopes.FETCH_CONFIG]);

  const headers: Record<string, string> = {};
  headers.Authorization = `Bearer ${staticToken}`;

  const response = await axios.get(`${backendUrl}${SLACK_BOTS_API_URL}`, {
    headers,
    timeout: 5000,
  });
  
  const bots = extractBotList(response.data)
    .map(normalizeBotEntry)
    .filter((bot): bot is SlackBotConfig => Boolean(bot));
  
  return bots;
}

export async function refreshSlackBotRegistry(
  options?: { force?: boolean },
): Promise<SlackBotConfig[]> {
  if (!options?.force && slackBotsCache.length > 0) {
    return slackBotsCache;
  }

  if (inFlightRefresh) {
    return inFlightRefresh;
  }

  inFlightRefresh = (async () => {
    try {
      const bots = await fetchAvailableSlackBots();
      slackBotsCache = bots;
      return slackBotsCache;
    } catch (error) {
      throw error;
    } finally {
      inFlightRefresh = null;
    }
  })();

  return inFlightRefresh;
}

export function getCachedSlackBots(): SlackBotConfig[] {
  return [...slackBotsCache];
}

export function findSlackBotByIdentity(
  bots: SlackBotConfig[],
  identity: SlackBotIdentity,
): SlackBotConfig | null {
  const botId = getStringField(identity.botId);


  for (const bot of bots) {
    if (bot.botId && bot.botId === botId) {
      return bot;
    }
  }
  return null;
}

export function runWithSlackRequestContext<T>(
  matchedBot: SlackBotConfig | null,
  callback: () => T,
): T {
  return slackRequestContext.run({ matchedBot }, callback);
}

export function getCurrentMatchedSlackBot(): SlackBotConfig | null {
  return slackRequestContext.getStore()?.matchedBot || null;
}

```

### Core Architecture Module: `backend/nodejs/apps/src/integrations/slack-bot/src/helpers.ts`
```
import axios from "axios";
import FormData from "form-data";
import { markdownToSlackMrkdwn, markdownToText } from "./utils/md_to_mrkdwn";
import {
  type SlackBotConfig,
  getCurrentMatchedSlackBot,
} from "./botRegistry";

// ---------------------------------------------------------------------------
// Interfaces & Types
// ---------------------------------------------------------------------------

export interface CitationData {
  citationId: string;
  citationData: {
    content: string;
    metadata: {
      recordId: string;
      recordName: string;
      recordType: string;
      createdAt: string;
      departments: string[];
      categories: string[];
      webUrl?: string;
      connector?: string;
    };
    chunkIndex?: string | number;
  }
}

export interface BotResponse {
  content: string;
  citations?: CitationData[];
  messageType: string;
}

export interface ConversationData {
  conversation: {
    _id: string;
    messages: BotResponse[];
  };
  [key: string]: unknown;
}

export interface StreamEvent {
  event: string;
  data: unknown;
}

export interface StreamStartResult {
  ts?: string;
}

export type SlackBlock = Record<string, unknown>;

export interface SlackMessagePayload {
  subtype?: string;
  bot_id?: string;
  user?: string;
  files?: unknown[];
  text?: string;
  thread_ts?: string;
  ts: string;
  channel?: string;
}

export interface SlackConversationsRepliesResponse {
  messages?: SlackMessagePayload[];
  response_metadata?: {
    next_cursor?: string;
  };
}

export interface SlackUserProfile {
  email?: string;
  display_name?: string;
  real_name?: string;
}

export interface SlackUserRecord {
  id?: string;
  name?: string;
  real_name?: string;
  profile?: SlackUserProfile;
  tz?: string;
}

export interface TypedSlackClient {
  botUserId?: string;
  users: {
    info: (params: { user: string }) => Promise<{
      user?: SlackUserRecord;
    }>;
  };
  chat: {
    postMessage: (params: {
      channel: string;
      thread_ts?: string;
      text: string;
      blocks?: SlackBlock[];
      unfurl_links?: boolean;
      unfurl_media?: boolean;
    }) => Promise<{ ts?: string }>;
    update: (params: {
      channel: string;
      ts: string;
      text: string;
      blocks?: SlackBlock[];
      unfurl_links?: boolean;
      unfurl_media?: boolean;
    }) => Promise<{ ts?: string }>;
  };
  apiCall: (
    apiMethod: string,
    options?: Record<string, unknown>,
  ) => Promise<Record<string, unknown>>;
}

export interface SlackFile {
  id: string;
  name?: string;
  mimetype?: string;
  filetype?: string;
  size?: number;
  url_private_download?: string;
  url_private?: string;
}

export interface AttachmentRef {
  recordId: string;
  recordName: string;
  mimeType: string;
  extension: string;
  virtualRecordId: string;
}

export interface SlackFileClassification {
  supported: SlackFile[];
  unsupported: SlackFile[];
  oversized: SlackFile[];
}

export interface CachedUserInfo {
  userRecord: SlackUserRecord | undefined;
  timestamp: number;
}

export type MarkdownTableSegment =
  | { type: "markdown"; content: string }
  | { type: "table"; header: string[]; rows: string[][] };

export type FenceMarker = "`" | "~";

interface ParsedMarkdownTable {
  header: string[];
  rows: string[][];
  nextLineIndex: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const FAILED_RESPONSE_GENERATION_MESSAGE = 'Something went wrong while generating the response. Please try again later.';
/** Batch answer tokens briefly, then flush — long gaps feel like a stuck stream. */
export const STREAM_UPDATE_THROTTLE_MS = 400;
/** Flush immediately once this much answer text is buffered (avoid huge appends). */
export const STREAM_UPDATE_MAX_CHARS = 400;
/** Activity message updates can be slower; they must not block answer appends. */
export const ACTIVITY_UPDATE_THROTTLE_MS = 900;
export const SLACK_MAX_TEXT_LENGTH = 39000;
export const SLACK_STREAM_MARKDOWN_LIMIT = 11500;
export const SLACK_STREAM_MESSAGE_CHAR_LIMIT = 11500;
export const MAX_SLACK_ERROR_BODY_LENGTH = 64000;
export const SLACK_BLOCKS_PER_MESSAGE_LIMIT = 50;
/** Slack cumulative block text limit per message (~13,200 chars in practice); use 10k to stay safe. */
export const SLACK_BLOCKS_TOTAL_TEXT_LIMIT = 10000;
/** Maximum rows (including header) per table block to prevent msg_blocks_too_long. */
export const MAX_TABLE_ROWS = 100;
/** Maximum columns per table block; extra columns are silently dropped. */
export const MAX_TABLE_COLS = 20;
/** Maximum character count per table block; Slack enforces a hard limit of 10,000. */
export const MAX_TABLE_CHARS = 9500;
export const SLACK_SECTION_TEXT_LIMIT = 3000;
export const SLACK_SECTION_FIELD_TEXT_LIMIT = 2000;
export const SLACK_SECTION_FIELDS_PER_BLOCK_LIMIT = 10;
export const NO_UNFURL_OPTIONS = {
  unfurl_links: false,
  unfurl_media: false,
} as const;
export const DEFAULT_SLACK_ERROR_MESSAGE = "Something went wrong! Please try again later.";
export const MAX_USER_VISIBLE_ERROR_LENGTH = 320;
export const STREAM_FAILURE_MESSAGE =
  "I ran into an issue while streaming the response. Please try again.";
export const BACKEND_STREAM_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
export const TABLE_STREAMING_PAUSED_HINT =
  "\n\n:hourglass_flowing_sand:";

export const SUPPORTED_ATTACHMENT_MIMETYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/pdf",
]);

export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENT_MB = Math.floor(MAX_ATTACHMENT_BYTES / (1024 * 1024));

export const USER_INFO_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day

// ---------------------------------------------------------------------------
// User info cache
// ---------------------------------------------------------------------------

export const userInfoCache = new Map<string, CachedUserInfo>();

export function getCachedUserInfo(userId: string): SlackUserRecord | undefined | null {
  const cached = userInfoCache.get(userId);
  if (!cached) {
    return null; // Not in cache
  }

  const now = Date.now();
  if (now - cached.timestamp > USER_INFO_CACHE_TTL_MS) {
    userInfoCache.delete(userId); // Expired
    return null;
  }

  return cached.userRecord;
}

export function setCachedUserInfo(userId: string, userRecord: SlackUserRecord | undefined): void {
  userInfoCache.set(userId, {
    userRecord,
    timestamp: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Attachment helpers
// ---------------------------------------------------------------------------

export function isSlackSupportedAttachment(file: SlackFile): boolean {
  const mime = (file.mimetype || "").toLowerCase();
  return SUPPORTED_ATTACHMENT_MIMETYPES.has(mime);
}

export function isSlackOversizedAttachment(file: SlackFile): boolean {
  return typeof file.size === "number" && file.size > MAX_ATTACHMENT_BYTES;
}

export function classifySlackFiles(files: unknown[] | undefined): SlackFileClassification {
  if (!files || !Array.isArray(files)) return { supported: [], unsupported: [], oversized: [] };
  const supported: SlackFile[] = [];
  const unsupported: SlackFile[] = [];
  const oversized: SlackFile[] = [];
  for (const f of files) {
    if (typeof f !== "object" || f === null) continue;
    const file = f as SlackFile;
    const downloadable = Boolean(file.url_private_download || file.url_private);
    if (isSlackOversizedAttachment(file)) {
      oversized.push(file);
    } else if (isSlackSupportedAttachment(file) && downloadable) {
      supported.push(file);
    } else {
      unsupported.push(file);
    }
  }
  return { supported, unsupported, oversized };
}

export function extractSupportedAttachments(files: unknown[] | undefined): SlackFile[] {
  return classifySlackFiles(files).supported;
}

export async function downloadSlackFile
```

### Core Architecture Module: `backend/nodejs/apps/src/integrations/slack-bot/src/index.ts`
```
import { config } from "dotenv";
config(); // Load environment variables first

import { json, urlencoded, Request, Response } from "express";
import { connect, dropLegacyThreadBotIndex } from "./utils/db";
import { getFromDatabase, saveToDatabase } from "./utils/conversation";
import axios from "axios";
import { marked } from "marked";
// Disable marked's email mangling to prevent HTML entity encoding of email addresses.
marked.setOptions({ mangle: false } as any);
import app from "./slackApp";
import receiver from "./receiver";
// Side-effect import: registers edition-specific Redis providers for this process.
import "../../../redisProviders";
import {
  RedisConnectionProviderFactory,
  getPreparedRedisProvider,
} from "../../../libs/services/redis/connectionProviderFactory";
import { ConfigService } from "../../../modules/tokens_manager/services/cm.service";
import { slackJwtGenerator } from "../../../libs/utils/createJwt";
import { markdownToSlackMrkdwn } from "./utils/md_to_mrkdwn";
import { createSlackAGUIEventHandler } from "./utils/agui-stream";
import {
  SlackActivityBuilder,
  stripSlackActivityTimeline,
} from "./utils/activity-ui";
import {
  formatAskUserQuestionMrkdwn,
  type AskUserQuestionEvent,
} from "./utils/ask-user-format";
import {
  toolActivityLabel,
  toolStatusLabel,
} from "./utils/tool-display";
import { parseArtifactMarkers } from "./utils/parse-artifact-markers";
import { rewriteCitationsForSlack, stripTinyRefCitationLinks } from "./utils/citations";

import {
  type SlackBotConfig,
} from "./botRegistry";

import {
  type CitationData,
  type ConversationData,
  type StreamStartResult,
  type SlackMessagePayload,
  type TypedSlackClient,
  type AttachmentRef,
  FAILED_RESPONSE_GENERATION_MESSAGE,
  STREAM_UPDATE_THROTTLE_MS,
  STREAM_UPDATE_MAX_CHARS,
  ACTIVITY_UPDATE_THROTTLE_MS,
  SLACK_STREAM_MARKDOWN_LIMIT,
  SLACK_STREAM_MESSAGE_CHAR_LIMIT,
  NO_UNFURL_OPTIONS,
  STREAM_FAILURE_MESSAGE,
  BACKEND_STREAM_TIMEOUT_MS,
  TABLE_STREAMING_PAUSED_HINT,
  truncateForSlack,
  truncateForSlackStreamMarkdown,
  splitByLengthPreferringNewlines,
  hasMarkdownTableStartOutsideCodeFences,
  buildFinalSlackChunks,
  splitSlackBlocksByLimit,
  classifySlackFiles,
  extractSupportedAttachments,
  uploadSlackAttachments,
  postUnsupportedAttachmentsNotice,
  resolveMentionsInText,
  resolveSlackErrorMessage,
  resolveSlackErrorMessageAsync,
  parseSSEEvents,
  buildChatStreamUrl,
  resolveSlackBotForEvent,
  resolveThreadId,
  sendUserFacingSlackErrorMessage,
  slackCallerDisplayName,
  isIgnoredSlackMessage,
  isThreadFollowUpMessage,
  fetchPriorThreadMessages,
  resolveThreadUserLabels,
  inferThreadMessageSpeaker,
  removeContinuousDuplicateMarkdownLinks,
  addSpaceBetweenMarkdownLinks,
  resolveSlackArtifactLink,
  getFrontendBaseUrl,
  buildFrontendRecordUrl,
} from "./helpers";

interface TypedSlackContext {
  botUserId?: string;
  teamId?: string;
  matchedBotId?: string;
  matchedBotUserId?: string;
  matchedBotTeamId?: string;
  matchedBotAgentId?: string | null;
}

/** Mid-stream: hide normalized record citation links (final message rewrites them). */
const INLINE_RECORD_CITATION_LINK_PATTERN =
  /\[(\d+)\]\(([^)]*?\/record\/[^)]*?)\)/g;

async function buildThreadContextualQuery(
  query: string,
  priorMessages: SlackMessagePayload[],
  userLabelsById: Map<string, string>,
  typedClient: TypedSlackClient,
): Promise<string> {
  const contextLines = await Promise.all(
    priorMessages.map(async (message) => {
      const withoutActivity = stripSlackActivityTimeline(message.text || "");
      const normalizedText = await resolveMentionsInText(
        withoutActivity,
        typedClient,
      );
      if (!normalizedText) {
        return null;
      }
      const speaker = inferThreadMessageSpeaker(message, userLabelsById);
      return `${speaker}: ${normalizedText}`;
    })
  ).then(lines => lines.filter((line): line is string => Boolean(line)));

  if (contextLines.length === 0) {
    return query;
  }

  return `Slack thread context:\n${contextLines.join("\n")}\n\nCurrent slack message/query: ${query}`;
}

async function buildQueryWithThreadContext(
  typedClient: TypedSlackClient,
  typedMessage: SlackMessagePayload,
  query: string,
): Promise<string> {
  if (!isThreadFollowUpMessage(typedMessage)) {
    return query;
  }

  try {
    const priorMessages = await fetchPriorThreadMessages(typedClient, typedMessage);
    const userLabelsById = await resolveThreadUserLabels(typedClient, priorMessages);
    return await buildThreadContextualQuery(query, priorMessages, userLabelsById, typedClient);
  } catch (error) {
    console.error("Failed to fetch Slack thread context:", error);
    return query;
  }
}

function getCitationWebUrl(webUrl?: string): string {
  if (!webUrl) {
    return "";
  }
  if (/^https?:\/\//i.test(webUrl)) {
    return webUrl;
  }
  return `${getFrontendBaseUrl()}${webUrl}`;
}

function rewriteInlineRecordCitationsForSlack(
  answerBody: string,
  citations?: CitationData[],
): string {
  return rewriteCitationsForSlack(
    answerBody,
    citations,
    getFrontendBaseUrl(),
  );
}

function buildCitationSources(citations?: CitationData[]): any[]  {

  // Deduplicate by recordId, keeping the first occurrence per unique record
  const seenRecordIds = new Set<string>();
  const uniqueRecords: Array<{ name: string; url: string }> = [];

  for (const citation of citations || []) {
    const recordId = citation.citationData.metadata.recordId;
    if (!recordId) continue;

    let webUrl = getCitationWebUrl(citation.citationData.metadata.webUrl);
    if (!webUrl) {
      webUrl = buildFrontendRecordUrl(recordId);
    }

    if (seenRecordIds.has(recordId)) continue;
    seenRecordIds.add(recordId);

    const recordName = citation.citationData.metadata.recordName || "Source";
    // Strip text fragment directive (#:~:text=...) but preserve other fragments
    const recordUrl = webUrl.replace(/#:~:text=[^#]*/, '');
    uniqueRecords.push({ name: recordName, url: recordUrl });
  }

  let blocks: any[] = [];
  let elements: any[] = [];

  for (const record of uniqueRecords) {
    elements.push({
      "type": "link",
      "url": record.url,
      "text": ` ${record.name}`,
    });
    elements.push({
      "type": "text",
      "text": `\n`,
    });

    if (elements.length === 20) {
      blocks.push({
        "type": "rich_text",
        "elements": [
          {
            "type": "rich_text_section",
            "elements": [
              ...elements,
            ]
          }
        ]
      });
      elements = [];
    }
  }

  if (elements.length > 0) {
    blocks.push({
      "type": "rich_text",
      "elements": [
        {
          "type": "rich_text_section",
          "elements": [
            ...elements,
          ]
        }
      ]
    });
  }

  if (blocks.length > 0) {
    blocks = [ {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*Sources:*",
      },
    }, ...blocks];
  }
  return blocks;
}

// Middleware setup
receiver.router.use(json());
receiver.router.use(urlencoded());

// Routes
receiver.router.get("/", (req: Request, res: Response) => {
  console.log(req);
  res.send("Running");
});


receiver.router.post("slack/command", (req: Request, res: Response) => {
  if (req.body.type === "url_verification") {
    res.send({ challenge: req.body.challenge });
  } else {
    res.status(200).send();
  }
});

export { removeContinuousDuplicateMarkdownLinks };

async function processSlackMessage(
  typedMessage: SlackMessagePayload,
  typedClient: TypedSlackClient,
  typedContext: TypedSlackContext,
  query: string,
  resolvedSlackBot: SlackBotConfig | null,
): Promise<void> {

  if (!typedMessage.user || !typedMessage.channel) {
    return;
  }

  const threadId = resolveThreadId(typedMessage);

  const lookupResult = await typedClient.users.info({
    user: typedMessage.user,
  });



  if (!lookupResult.user?.profile?.email) {
    console.error
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3516** (2026-09-26): **[BUG] Gemini 429 and 503 embedding errors are never retried, so searches fail with HTTP 500**
  *Symptoms*: **Describe the bug** A Gemini rate limit (429) or outage (502, 503, 504) on an embedding call is never retried. OpenAI-compatible providers get up to 3 attempts for the same errors.  The shared retry policy, `is_retriable_embedding_error` in `app/utils/embedding_retry.py`, only recognises OpenAI SDK exceptions. The Gemini embedder is LangChain's `GoogleGenerativeAIEmbeddings`, and it raises `GoogleGenerativeAIError` chained from the google-genai `APIError` that carries the HTTP code. The policy doesn't recognise that, so the first failure is final.  Both embedding paths use this policy, so both are affected:  - Search. The query embedding is wrapped in `await_with_retry` (`retrieval_service.py`), but a Gemini 429 is re-raised on the first attempt. It ends up in the catch-all "Filtered search failed" handler, and the user gets HTTP 500 "Something went wrong while PipesHub tried to search". A second search a few seconds later works. - Indexing. `_embed_documents_with_retry` (`vectorstore.py`) gives up on the batch at once, so a throttled bulk sync fails documents instead of slowing down.  Gemini returns 429 well under the published quota. I saw it at 564 of 3,000 requests per minute, with a generic "Resource exhausted. Please try again later" and no quota named. So this can hit any Gemini deployment under load.  **To Reproduce** With the live stack: 1. Configure Gemini as the embedding provider, for example `gemini-embedding-2`. 2. Run many searches and uploads in the same minu

- **Issue #3491** (2026-09-26): **[BUG] Arango HTTP client closes its session when called from a second event loop, failing in-flight indexing queries**
  *Symptoms*: **Describe the bug** `ArangoHTTPClient` keeps one aiohttp session. When it gets a call from a different event loop, it closes that session and opens a new one (`app/services/graph_db/arango/arango_http_client.py`, `_get_session`).  The indexing service calls the same client from two loops at the same time. Record processing runs on the consumer's worker loop (thread `indexing-worker_0`). Stale-record recovery (every 60 s) and the vector membership backfill (every 30 s) run on the main loop, because `indexing_main.py` moves them to the worker loop only for Neo4j. So a recovery or backfill tick can close the session under queries that are still running on the worker loop.  Those queries fail with `ServerDisconnectedError: Server disconnected` or `RuntimeError: Session is closed`. It only happens when a query is in flight during a tick, so it shows up under bulk ingest and almost never on a quiet instance.  Valid files then fail. It shows up in two ways.  - A record that gets `Session is closed` fails for good. `Session is closed` is a plain `RuntimeError`, so the error classifier doesn't see a network error. It sees the `DocumentProcessingError` wrapper and marks the message terminal. The record is dead-lettered after one attempt and the user is told "We couldn't read this file. It may be damaged or in a format we can't open." - A record that gets `Server disconnected` is retried 15 s later, but the retry does nothing. The error hit the enrichment step, after `indexingStatus` w

- **Issue #3243** (2026-09-11): **[BUG] Chat cannot read images in collection PDFs, but direct image uploads work**
  *Symptoms*: **Describe the bug**  Chat could not read information from images inside a collection PDF, although uploading the same image directly worked with the same multimodal model.  Tracing confirmed that PipesHub had retrieved image parts internally, but sent no images to the chat endpoint.  **To Reproduce**  Steps to reproduce the behavior:  1. Configure a multimodal model through an OpenAI-compatible Chat Completions endpoint. 2. Index a PDF containing an image with text or numbers. 3. Select its collection in a fresh chat and ask about information in the image. 4. Compare with a fresh chat using the image as a direct attachment.  The failure occurs when duplicate image parts exceed the configured image cap. In the reproduced case, four image parts represented two distinct images, with a cap of two.  **Expected behavior**  Retrieved PDF images should reach the model within the image limit, just as directly attached images do.  **Screenshots**  （none.）  **Environment (please complete the following information):**  - OS: Ubuntu Linux 26.04 - Deployment: Docker Compose - PipesHub version/commit: latest upstream   **Related issues** Please link to any related issues.  **Additional context**  Deduplication keeps the later image copies in tool results and removes their earlier user-message copies. Conversion then strips the tool-result images for endpoint compatibility, leaving no images in the outgoing request. 

- **Issue #3096** (2026-09-17): **[BUG] ServiceNow: an indexed record is never rewritten, so article edits never reach search**
  *Symptoms*: **Describe the bug**  For a record that already exists, the document write happens in exactly one place, `_handle_updated_record`, and it is reached only through this test in `data_source_entities_processor.py`:  ```python if record.external_revision_id != existing_record.external_revision_id:     await self._handle_updated_record(record, existing_record, tx_store) ```  The ServiceNow connector never sets `external_revision_id`. The string does not appear anywhere in `connector.py`, so the field keeps its model default of `None`, `None != None` is false, and for every already-indexed article:  - the stored document is never rewritten, so name, `webUrl` and timestamps all   keep their first-index values; - `indexingStatus` stays `COMPLETED`, so no re-index event is published and   changed content is never re-embedded.  Permissions are unaffected, because `_handle_record_permissions` is called unconditionally. That asymmetry is why a knowledge-base grant does propagate to existing articles while the articles themselves stay frozen.  **To Reproduce**  1. Sync a ServiceNow instance and note an article's title in PipesHub. 2. Edit that article's `short_description` in ServiceNow. 3. Run a delta sync. The log reports `Articles synced: 1`, so the connector did    read the change. 4. The stored record is unchanged, and search still returns the old text.  Note: with knowledge versioning on, a published article cannot be edited through the Table API at all (`403 ACL Exception`), so ste

- **Issue #3095** (2026-09-17): **[BUG] ServiceNow: an API error mid-pagination is swallowed, so a partial sync reports success**
  *Symptoms*: **Describe the bug**  Ten paginated reads in the ServiceNow connector handle a Table API failure the same way, by logging it and leaving the loop:  ```python except ServiceNowAPIError as e:     self.logger.error(f"❌ API error: {e.message} (status: {e.status_code})")     break ```  The sync then continues with whatever arrived before the failure and reports success. Nothing downstream can tell a short list from a complete one.  For five of them the result is data loss rather than staleness, because the caller deletes the permission edges of every entity in the list before rewriting them, so a page that fails partway *removes* access the connector then cannot rebuild. The others go silently incomplete, and the article and category reads additionally write a sync checkpoint across the window they never finished, so those rows are not fetched again until something else changes them.  The record writer has the same silence: `_process_record_updates_batch` drops any record whose permission list resolves to empty and returns nothing, so the sync logs more articles than it wrote.  **To Reproduce**  1. Sync an instance with more than one page (100 rows) of `sys_user_grmember`. 2. Make the second page fail. Throttling, a network blip, or a temporary ACL    change on `sys_user_grmember` will all do it. 3. The sync completes and logs success. 4. Permissions derived from the rows on the failed page are gone, and the next    delta sync does not restore them because the checkpoint moved.  *

- **Issue #3094** (2026-09-17): **[BUG] ServiceNow: a revoked knowledge-base grant is never withdrawn, and one membership insert empties a group**
  *Symptoms*: **Describe the bug**  Two reads in the ServiceNow connector paginate on a `sys_updated_on` watermark and hand the result to a caller that *replaces* what it finds rather than merging. The combination loses permissions in both directions.  `_fetch_all_memberships` reads `sys_user_grmember` as a delta. `on_new_user_groups` then deletes every permission edge pointing at a group before writing the members it was given. Any group whose membership rows did not change inside the delta window is written with no members, which empties it.  `_sync_knowledge_bases` reads `kb_knowledge_base` as a delta. A base holds its read grants in `kb_uc_can_read_mtom`, and adding or removing a grant there does **not** touch `kb_knowledge_base.sys_updated_on`. So a grant change is invisible to the delta: a revoked grant stays live indefinitely, and a new grant is never picked up.  **To Reproduce**  Emptied group: 1. Sync a ServiceNow instance so groups and memberships are indexed, and note    the members of a group nobody is about to touch. 2. In ServiceNow, insert one `sys_user_grmember` row into a *different* group. 3. Run a routine (delta) sync. 4. The untouched group now has no members, and users who reached articles    through it can no longer retrieve them.  Revoked grant not withdrawn: 1. Grant a group read access to a knowledge base via `kb_uc_can_read_mtom`, and    sync. 2. Delete that grant row in ServiceNow. 3. Run any number of delta syncs. 4. The `GROUP` edge on the knowledge base is sti

- **Issue #3032** (2026-08-25): **[BUG] Image-heavy PDF pages may skip OCR and produce incomplete indexed content**
  *Symptoms*: **Describe the bug**  Some PDFs contain tables or text as a large image, with only a small amount of selectable text on the page. PipesHub may treat these pages as normal text PDFs and skip OCR.  When this happens, image information will be missing index, so answers based on the document will be incomplete or incorrect.  I also noticed two related OCR issues:  - OpenAI-compatible VLM requests can take a very long time when output is not limited. - Measurements containing `*` can be incorrectly parsed as Markdown and become truncated. (Maybe more like this will happen, but is only what I found.)  **To Reproduce** Steps to reproduce the behavior:  1. Configure a multimodal model for OCR. 2. Upload a PDF containing an image-based table. 3. Wait for the document to finish indexing. 4. Ask about information shown in the table. 5. Notice that some values are missing or incorrect.  **Expected behavior**  PipesHub should detect that the page is mostly an image and use OCR. The full table content should be indexed, including measurements containing multiplication symbols.  OCR requests should also finish within a reasonable amount of time.  **Screenshots**  Redacted screenshots can be added if needed.  **Environment (please complete the following information):**  - OS: Linux - Version/Commit ID: Latest upstream - Deployment: Docker Compose - LLM provider: OpenAI-compatible endpoint (Qwen3.6:35B-A3B)

- **Issue #3008** (2026-08-22): **[BUG] Folder/record delete commits the graph deletion before publishing the vector-cleanup event — a broker hiccup permanently orphans embeddings and misreports the result**
  *Symptoms*: **Describe the bug** Deleting a KB folder (and, less visibly, a single record) does the graph delete first, then publishes a `deleteRecord` event afterward, unguarded. If the publish step throws, the graph data is already gone but the vector embeddings are never cleaned up — and depending on which delete path was used, the user is told the delete either failed or silently "succeeded" while actually leaving orphaned data.  Folder path — `backend/python/app/connectors/core/base/data_processor/data_source_entities_processor.py`, `on_records_deleted_cascade()` (lines 1429-1465):      async with self.data_store_provider.transaction() as tx_store:         result = await tx_store.delete_records_recursive(record_ids, connector_id)     ...     await self._publish_delete_events((result or {}).get("eventData"))   # line 1465, unguarded  The `async with` block commits on normal exit — the folder and all its descendant records are already hard-deleted from the graph by the time `_publish_delete_events` runs. That method (lines 1399-1417) calls `self.messaging_producer.send_message(...)`, which re-raises on failure for both broker backends (Kafka: `backend/python/app/services/messaging/kafka/producer/producer.py:140-142`). The exception propagates up to `backend/python/app/connectors/sources/localKB/handlers/kb_service.py`'s `delete_folder()` (lines 962-1001), whose `except Exception` (lines 999-1005) catches it and returns `{"success": False, "code": 500, "reason": str(e)}` — i.e. the API
  **Post-Mortem & Fix Analysis**:
  > fix(connectors): bind vector cleanup event to graph db transaction  Resolves #3008  The folder and record deletion flows previously committed the graph  deletion before attempting to publish the cleanup event to the message  broker. If the broker failed, the graph data was permanently lost while  the vector embeddings were orphaned.  This fix moves the message broker publish calls inside the database  transaction blocks (`async with self.data_store_provider.transaction()`).  If the broker publish fails, the exception now correctly triggers a  database rollback, preventing data orphans and ensuring the API  response accurately reflects the system state. Additionally removed  the try/except block in the single-record path that was silently  swallowing publish failures.

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

### Incident Patch 1: `fc59e687` (2026-09-30)
**Commit Message**: fix(kg): follow-up fixes for entity tools and entity indexing (#3729)

* fix(kg): follow-up fixes for entity tools and entity indexing

Follow-up to #3308. Fixes found in two full reviews of that branch and
in runs against real Neo4j, ArangoDB, Qdrant and Redis.

- Entity tools honour strictScope, excluded apps and linked accounts,
  and no longer report dropped or incomplete results as empty.
- Entity resolution keys names consistently, checks every merge winner
  against the graph, and bounds the merge call at 60s.
- The entity store reads and writes membership by point id, so the
  OpenSearch refresh lag no longer loses writes. Redis type guessing is
  undone.
- Neo4j alias writes are locked and indexed through TaxonomyAlias nodes.
  ArangoDB retries write conflicts and accepts extractedName on taxonomy
  edges. The inheritance walk is pruned and candidate scans are bounded.
- Connector cleanup is paged, resumable and embedding-free, and checks
  the graph before deleting a shared entity.
- Duplicate reconciliation retries until it succeeds, tracked by
  duplicateReconcilePending on the primary.
- The indexing service runs ensure_schema.

Co-Authored-By: Claude Opus 5.5 <noreply

**File**: `backend/python/app/agents/actions/knowledge_graph/knowledge_graph.py` (modified, +2/-2)
```diff
@@ -751,7 +751,7 @@ async def lookup_record(
                 name="entity_ids",
                 type=ParameterType.ARRAY,
                 description=(
-                    "Optional entityIds returned by search_entities in this conversation — "
+                    "Optional entityIds returned by search_entities in this turn — "
                     "restricts the search to content connected to those entities. Accepts "
                     "department/category/subcategory/topic/language entities and record_group "
                     "entities (a Drive folder, Jira project, Slack channel, ...; restricts to "
@@ -906,7 +906,7 @@ async def search_entities(
                 description=(
                     "The entity's type: 'department', 'category', 'subcategory', 'topic', "
                     "'language', 'record_group' or 'record'. Optional when the entityId came "
-                    "from search_entities in this conversation."
+                    "from search_entities in this turn."
                 ),
                 required=False,
             ),
```

**File**: `backend/python/app/agents/actions/knowledge_graph/ops/entity_discovery.py` (modified, +5/-11)
```diff
@@ -12,8 +12,10 @@
 import logging
 from typing import TYPE_CHECKING, Any
 
-from app.agents.actions.knowledge_graph.ops.entity_filters import remember_entities
-from app.agents.actions.knowledge_graph.ops.scope import derive_scope
+from app.agents.actions.knowledge_graph.ops.entity_filters import (
+    load_entity_access_context,
+    remember_entities,
+)
 from app.agents.actions.knowledge_graph.views import _compact_date, _short, _trunc
 from app.modules.agents.qna.chat_state import remember_record_ids
 from app.modules.retrieval.entity_permissions import (
@@ -22,7 +24,6 @@
     EntityAccessContext,
     EntityAccessError,
     EntityHit,
-    get_entity_access_context,
     search_entities_for_user,
 )
 from app.utils.chat_helpers import get_record_id_shortener_if_enabled
@@ -70,15 +71,8 @@ async def execute_search_entities(
     bounded_top_k = max(
         1, min(top_k if top_k is not None else _DEFAULT_TOP_K, _MAX_TOP_K)
     )
-    scope = derive_scope(state)
     try:
-        context = await get_entity_access_context(
-            state,
-            graph_provider,
-            org_id=state.get("org_id", ""),
-            user_id=state.get("user_id", ""),
-            source_ids=[*scope.app_ids, *scope.kb_ids],
-        )
+        context = await load_entity_access_context(state)
         hits = await search_entities_for_user(
             entity_vector_store,
             graph_provider,
```

**File**: `backend/python/app/agents/actions/knowledge_graph/ops/entity_filters.py` (modified, +26/-1)
```diff
@@ -16,13 +16,21 @@
 """
 from __future__ import annotations
 
-from typing import Any
+from typing import TYPE_CHECKING, Any
 
+from app.agents.actions.knowledge_graph.ops.scope import derive_scope
+from app.modules.demo_data.chat import excluded_app_ids
 from app.modules.retrieval.entity_permissions import (
     RECORD_GROUP_ENTITY_TYPE,
     SEARCHABLE_ENTITY_TYPES,
     TAXONOMY_ENTITY_TYPES,
+    EntityAccessContext,
+    get_entity_access_context,
 )
+from app.services.graph_db.interface.graph_db_provider import STRICT_SCOPE_FILTER_KEY
+
+if TYPE_CHECKING:
+    from app.modules.agents.qna.chat_state import ChatState
 
 # EntityType value -> get_accessible_virtual_record_ids() filter key. Graph
 # filters match entity *names*, never ids.
@@ -43,6 +51,22 @@
 ENTITY_INDEX_CACHE_KEY = "_kg_entity_index"
 
 
+async def load_entity_access_context(state: "ChatState") -> EntityAccessContext:
+    """The entity access context for this run's scope, honouring
+    ``strictScope`` and switched-off demo apps as content search does."""
+    scope = derive_scope(state)
+    filters = state.get("filters") or {}
+    return await get_entity_access_context(
+        state,
+        state.get("graph_provider"),
+        org_id=state.get("org_id", ""),
+        user_id=state.get("user_id", ""),
+        source_ids=[*scope.app_ids, *scope.kb_ids],
+        strict=bool(filters.get(STRICT_SCOPE_FILTER_KEY)),
+        exclude_app_ids=excluded_app_ids(state),
+    )
+
+
 def is_filterable_entity(entity_type: str | None, entity_name: str | None) -> bool:
     """Whether an entity id can scope ``search(entity_ids=[...])``."""
     if entity_type in RECORD_SCOPED_ENTITY_TYPES:
@@ -101,6 +125,7 @@ def merge_filter_groups(
     "SEARCHABLE_ENTITY_TYPES",
     "TAXONOMY_ENTITY_TYPES",
     "is_filterable_entity",
+    "load_entity_access_context",
     "merge_filter_groups",
     "remember_entities",
 ]
```

**File**: `backend/python/app/agents/actions/knowledge_graph/ops/entity_records.py` (modified, +45/-24)
```diff
@@ -9,10 +9,13 @@
 from __future__ import annotations
 
 import logging
+from dataclasses import dataclass
 from typing import TYPE_CHECKING, Any
 
-from app.agents.actions.knowledge_graph.ops.entity_filters import ENTITY_INDEX_CACHE_KEY
-from app.agents.actions.knowledge_graph.ops.scope import derive_scope
+from app.agents.actions.knowledge_graph.ops.entity_filters import (
+    ENTITY_INDEX_CACHE_KEY,
+    load_entity_access_context,
+)
 from app.agents.actions.knowledge_graph.views import (
     _compact_date,
     _read_hint,
@@ -28,7 +31,6 @@
     SEARCHABLE_ENTITY_TYPES,
     EntityAccessContext,
     EntityAccessError,
-    get_entity_access_context,
     list_accessible_entity_records,
 )
 from app.utils.chat_helpers import get_record_id_shortener_if_enabled
@@ -49,17 +51,6 @@
 LOOKUP_FAILED_MSG = "Lookup failed — try again."
 
 
-async def _access_context(state: "ChatState") -> EntityAccessContext:
-    scope = derive_scope(state)
-    return await get_entity_access_context(
-        state,
-        state.get("graph_provider"),
-        org_id=state.get("org_id", ""),
-        user_id=state.get("user_id", ""),
-        source_ids=[*scope.app_ids, *scope.kb_ids],
-    )
-
-
 async def execute_find_records_by_entity(
     state: "ChatState",
     entity_id: str | None,
@@ -84,15 +75,15 @@ async def execute_find_records_by_entity(
     if not resolved_type:
         return False, (
             "entity_type is required for an entity that search_entities did not return "
-            f"in this conversation — pass one of: {supported}."
+            f"in this turn — pass one of: {supported}."
         )
     if resolved_type not in SEARCHABLE_ENTITY_TYPES:
         return False, f"Unsupported entity_type {resolved_type!r} — pass one of: {supported}."
 
     wanted_types = [str(t).strip().upper() for t in (record_types or []) if str(t).strip()] or None
     bounded_limit = min(max(1, limit or _DEFAULT_LIMIT), _MAX_LIMIT)
     try:
-        context = await _access_context(state)
+        context = await load_entity_access_context(state)
         page = await list_accessible_entity_records(
             state["graph_provider"],
             context,
@@ -109,6 +100,10 @@ async def execute_find_records_by_entity(
         return False, LOOKUP_FAILED_MSG
 
     if not page.records:
+        if page.next_cursor is not None:
+            # The scan budget ran out before anything visible turned up; later
+            # candidates may still be accessible.
+            return True, _empty_window_message(raw_id, resolved_type, page.next_cursor)
         # After a page of results, "none found" reads as "this entity is empty"
         # and contradicts what the caller was just shown.
         return True, NO_FURTHER_RECORDS_MSG if cursor else NO_ACCESSIBLE_RECORDS_MSG
@@ -127,6 +122,20 @@ async def execute_find_records_by_entity(
     )
 
 
+def _continue_call(entity_ref: str, entity_type: str, cursor: str) -> str:
+    return (
+        "knowledgegraph__find_records_by_entity("
+        f'entity_id="{entity_ref}", entity_type="{entity_type}", cursor="{cursor}")'
+    )
+
+
+def _empty_window_message(entity_ref: str, entity_type: str, cursor: str) -> str:
+    return (
+        "No accessible records in this window of candidates, but more remain unchecked. "
+        f"Continue with {_continue_call(entity_ref, entity_type, cursor)}"
+    )
+
+
 def _render_page(
     records: list[dict[str, Any]],
     context: EntityAccessContext,
@@ -159,10 +168,7 @@ def _render_page(
 
     lines.append("")
     if next_cursor is not None:
-        lines.append(
-            "More records may exist: knowledgegraph__find_records_by_entity("
-            f'entity_id="{entity_ref}", entity_type="{entity_type}", cursor="{next_cursor}")'
-        )
+        lines.append(f"More records may exist: {_continue_call(entity_ref, entity_type, next_cursor)}")
     record_ids = [r["_key"] for r in records[:_MAX_READ_HINT_IDS]]
     lines.append(
         f"Next: {_
```

**File**: `backend/python/app/agents/actions/knowledge_graph/ops/search.py` (modified, +103/-12)
```diff
@@ -26,6 +26,7 @@
 from app.agents.actions.knowledge_graph.ops.scope import KnowledgeScope, _clean_kb
 from app.modules.retrieval.entity_permissions import EntityAccessError
 from app.modules.transformers.blob_storage import BlobStorage
+from app.services.graph_db.interface.graph_db_provider import STRICT_SCOPE_FILTER_KEY
 from app.utils.chat_helpers import (
     CitationRefMapper,
     build_message_content_array,
@@ -50,6 +51,21 @@
     "these sources."
 )
 
+UNKNOWN_ENTITY_IDS_MESSAGE = (
+    "None of the entity_ids {ids} came from knowledgegraph__search_entities in this "
+    "turn, so nothing was searched. Entity ids only work in the turn that returned "
+    "them, and record ids cannot scope a search. Call knowledgegraph__search_entities "
+    "again, or search without entity_ids."
+)
+
+# A record-group/subcategory scope that stopped at a cap or scan budget.
+ENTITY_SCOPE_INCOMPLETE_MESSAGE = (
+    "No accessible records turned up among the records checked for the requested "
+    "entities, but the check stopped before covering all of them, so this is not "
+    "conclusive. Search without entity_ids, or page through the entity with "
+    "knowledgegraph__find_records_by_entity."
+)
+
 _RECORD_NAME_RE = re.compile(r"^Name\s*:\s*(.+)$", re.MULTILINE)
 _RETRIEVED_COUNT_RE = re.compile(
     r"^Top (\d+) blocks? from (\d+) records?", re.IGNORECASE | re.MULTILINE
@@ -98,6 +114,48 @@ def resolve_record_scoped_entities(
     return [(entity_id, known[entity_id]) for entity_id in entity_ids if entity_id in known]
 
 
+def unresolved_entity_ids(state: "ChatState", entity_ids: list[str] | None) -> list[str]:
+    """``entity_ids`` that can scope nothing: never returned by
+    ``search_entities`` in this request, or record ids, which have no scope."""
+    name_filtered: dict[str, Any] = state.get(ENTITY_ID_FILTER_KEY_CACHE_KEY) or {}
+    record_scoped: dict[str, str] = state.get(RECORD_SCOPED_ENTITY_CACHE_KEY) or {}
+    return [
+        entity_id
+        for entity_id in dict.fromkeys(entity_ids or [])
+        if entity_id and entity_id not in name_filtered and entity_id not in record_scoped
+    ]
+
+
+def _entity_notes(
+    *,
+    unknown_entity_ids: list[str],
+    filter_dropped: bool,
+    record_scope_applied: bool,
+    scope_truncated: bool,
+) -> str:
+    notes: list[str] = []
+    if unknown_entity_ids:
+        notes.append(
+            f"Note: entity_ids {unknown_entity_ids} were not returned by "
+            "search_entities in this turn and were ignored; the other entity_ids "
+            "still scope these results."
+        )
+    if filter_dropped:
+        scope_left = (
+            " The record group/subcategory scope still applies." if record_scope_applied else ""
+        )
+        notes.append(
+            "Note: nothing matched inside the requested department/category/topic/"
+            f"language, so these results are NOT limited to it.{scope_left}"
+        )
+    if scope_truncated:
+        notes.append(
+            "Note: the requested record group/subcategory has more records than one "
+            "search covers; only its newest accessible records were searched."
+        )
+    return "".join(f"{note}\n\n" for note in notes)
+
+
 def normalize_source_ids(value: Any) -> list[str] | None:
     """Normalize source_ids parameter (a string or list of strings)."""
     if value is None:
@@ -136,10 +194,11 @@ async def execute_search(
     ``entity_ids`` narrows results to records connected to specific
     departments/categories/topics/languages, or to the accessible records of a
     record group or subcategory. IDs must come from a ``search_entities`` call
-    in this request; unknown IDs are dropped. A record group or subcategory
-    that resolves to zero accessible records reports "no results", and a
-    failed permission lookup reports an error — neither silently widens to an
-    unscoped search.
+    in this request: if none is recognised the call fails without search
```

---

### Incident Patch 2: `843eb911` (2026-09-30)
**Commit Message**: fix(security): encode ids where they go into service URLs (GHSA-rfmg-j28j-f635) (#3728)

guardPathParams (8b101e763) rejects unsafe path params at the router, but
the controllers still pasted ids into connector, AI and IAM service URLs
as-is, so the guard was the only protection and any route registered
without it reopened the path injection. Wrap every such id in
encodeURIComponent at the point the URL is built: KB, connectors, OAuth
configs, toolsets, teams, projects, agents, IAM user lookups and the
model health check.

Services decode path params, so ids that pass the guard reach the same
handler with the same value.

Co-authored-by: Rishabh Gupta <rishabh@pipeshub.com>
Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `backend/nodejs/apps/src/modules/auth/services/iam.service.ts` (modified, +3/-3)
```diff
@@ -136,7 +136,7 @@ export class IamService {
     try {
       const config = {
         method: 'get',
-        url: `${this.authConfig.iamBackend}/api/v1/users/internal/${userId}`,
+        url: `${this.authConfig.iamBackend}/api/v1/users/internal/${encodeURIComponent(userId)}`,
         headers: {
           Authorization: `Bearer ${authServiceToken}`,
           'Content-Type': 'application/json',
@@ -172,7 +172,7 @@ export class IamService {
     try {
       const config = {
         method: 'put',
-        url: `${this.authConfig.iamBackend}/api/v1/users/${userId}`,
+        url: `${this.authConfig.iamBackend}/api/v1/users/${encodeURIComponent(userId)}`,
         headers: {
           Authorization: `Bearer ${authServiceToken}`,
           'Content-Type': 'application/json',
@@ -210,7 +210,7 @@ export class IamService {
       const config = {
         method: 'get',
         // Internal S2S path: USER_LOOKUP scoped token (no user-session role claim).
-        url: `${this.authConfig.iamBackend}/api/v1/users/internal/${userId}/adminCheck`,
+        url: `${this.authConfig.iamBackend}/api/v1/users/internal/${encodeURIComponent(userId)}/adminCheck`,
         headers: {
           Authorization: `Bearer ${authServiceToken}`,
           'Content-Type': 'application/json',
```

**File**: `backend/nodejs/apps/src/modules/configuration_manager/controller/cm_controller.ts` (modified, +2/-2)
```diff
@@ -3177,7 +3177,7 @@ export const addAIModelProvider =
       };
 
       const aiCommandOptions: AICommandOptions = {
-        uri: `${appConfig.aiBackend}/api/v1/health-check/${modelType}`,
+        uri: `${appConfig.aiBackend}/api/v1/health-check/${encodeURIComponent(String(modelType))}`,
         method: HttpMethod.POST,
         headers: req.headers as Record<string, string>,
         body: healthCheckPayload,
@@ -3871,7 +3871,7 @@ export const updateDefaultAIModel =
         const aiCommandOptions: AICommandOptions = {
           uri: isEmbedding
             ? `${appConfig.aiBackend}/api/v1/embedding-health-check`
-            : `${appConfig.aiBackend}/api/v1/health-check/${targetModelType}`,
+            : `${appConfig.aiBackend}/api/v1/health-check/${encodeURIComponent(targetModelType)}`,
           method: HttpMethod.POST,
           headers: req.headers as Record<string, string>,
           body: isEmbedding ? [healthCheckPayload] : healthCheckPayload,
```

**File**: `backend/nodejs/apps/src/modules/crawling_manager/controller/cm_controller.ts` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ const validateConnectorAccess = async (req: AuthenticatedUserRequest, connectorI
   const isAdmin = await isUserAdmin(req);
   const headers = buildProxyHeaders(req);
   const connectorResponse = await executeConnectorCommand(
-    `${appConfig.connectorBackend}/api/v1/connectors/${connectorId}`,
+    `${appConfig.connectorBackend}/api/v1/connectors/${encodeURIComponent(connectorId)}`,
     HttpMethod.GET,
     headers,
   );
```

**File**: `backend/nodejs/apps/src/modules/enterprise_search/controller/es_controller.ts` (modified, +10/-10)
```diff
@@ -2676,7 +2676,7 @@ export const shareConversationById =
             }
             try {
               const iamCommand = new IAMServiceCommand({
-                uri: `${appConfig.iamBackend}/api/v1/users/${id}`,
+                uri: `${appConfig.iamBackend}/api/v1/users/${encodeURIComponent(String(id))}`,
                 method: HttpMethod.GET,
                 headers: req.headers as Record<string, string>,
               });
@@ -4837,7 +4837,7 @@ export const shareSearch =
           }
           try {
             const iamCommand = new IAMServiceCommand({
-              uri: `${appConfig.iamBackend}/api/v1/users/${id}`,
+              uri: `${appConfig.iamBackend}/api/v1/users/${encodeURIComponent(id)}`,
               method: HttpMethod.GET,
               headers: req.headers as Record<string, string>,
             });
@@ -4944,7 +4944,7 @@ export const unshareSearch =
           }
           try {
             const iamCommand = new IAMServiceCommand({
-              uri: `${appConfig.iamBackend}/api/v1/users/${id}`,
+              uri: `${appConfig.iamBackend}/api/v1/users/${encodeURIComponent(id)}`,
               method: HttpMethod.GET,
               headers: req.headers as Record<string, string>,
             });
@@ -5266,15 +5266,15 @@ export const getAgent =
     try {
       const orgId = req.user?.orgId;
       const userId = req.user?.userId;
-      const agentKey = req.params.agentKey;
+      const agentKey = req.params.agentKey as string;
       if (!orgId) {
         throw new BadRequestError('Organization ID is required');
       }
       if (!userId) {
         throw new BadRequestError('User ID is required');
       }
       const aiCommandOptions: AICommandOptions = {
-        uri: `${appConfig.aiBackend}/api/v1/agent/${agentKey}`,
+        uri: `${appConfig.aiBackend}/api/v1/agent/${encodeURIComponent(agentKey)}`,
         method: HttpMethod.GET,
         headers: {
           ...(req.headers as Record<string, string>),
@@ -5469,15 +5469,15 @@ export const updateAgent =
     try {
       const orgId = req.user?.orgId;
       const userId = req.user?.userId;
-      const agentKey = req.params.agentKey;
+      const agentKey = req.params.agentKey as string;
       if (!orgId) {
         throw new BadRequestError('Organization ID is required');
       }
       if (!userId) {
         throw new BadRequestError('User ID is required');
       }
       const aiCommandOptions: AICommandOptions = {
-        uri: `${appConfig.aiBackend}/api/v1/agent/${agentKey}`,
+        uri: `${appConfig.aiBackend}/api/v1/agent/${encodeURIComponent(agentKey)}`,
         method: HttpMethod.PUT,
         body: req.body,
         headers: {
@@ -5513,15 +5513,15 @@ export const deleteAgent =
     try {
       const orgId = req.user?.orgId;
       const userId = req.user?.userId;
-      const agentKey = req.params.agentKey;
+      const agentKey = req.params.agentKey as string;
       if (!orgId) {
         throw new BadRequestError('Organization ID is required');
       }
       if (!userId) {
         throw new BadRequestError('User ID is required');
       }
       const aiCommandOptions: AICommandOptions = {
-        uri: `${appConfig.aiBackend}/api/v1/agent/${agentKey}`,
+        uri: `${appConfig.aiBackend}/api/v1/agent/${encodeURIComponent(agentKey)}`,
         method: HttpMethod.DELETE,
         headers: {
           ...(req.headers as Record<string, string>),
@@ -7021,7 +7021,7 @@ export const regenerateAgentAnswers =
         ],
       }),
       buildAIEndpoint: (appConfig, agentKey) =>
-        `${appConfig.aiBackend}/api/v1/agent/${agentKey}/chat/stream`,
+        `${appConfig.aiBackend}/api/v1/agent/${encodeURIComponent(agentKey as string)}/chat/stream`,
     });
   };
 
```

**File**: `backend/nodejs/apps/src/modules/enterprise_search/utils/scoped-request.ts` (modified, +2/-2)
```diff
@@ -136,10 +136,10 @@ export const checkServiceAccountAccess = async (
 ): Promise<boolean> => {
   const requestId = req.context?.requestId;
   try {
-    const agentKey = req.params.agentKey;
+    const agentKey = req.params.agentKey as string;
 
     const aiCommandOptions: AICommandOptions = {
-      uri: `${appConfig.aiBackend}/api/v1/agent/${agentKey}/internal/service-account`,
+      uri: `${appConfig.aiBackend}/api/v1/agent/${encodeURIComponent(agentKey)}/internal/service-account`,
       method: HttpMethod.GET,
       headers: {
         ...(req.headers as Record<string, string>),
```

---

### Incident Patch 3: `85a91460` (2026-09-30)
**Commit Message**: fix(security): fail closed when SANDBOX_MODE is unset or unknown (GHSA-x783-vmqc-7jc9) (#3725)

SANDBOX_MODE defaulted to local and unknown values were coerced to it, so
any deployment that omitted or mistyped the variable ran LLM-generated
code as a subprocess of the query service for every authenticated user.
Unset or unknown now raises SandboxUnavailableError; the agent factory and
tool loader skip the sandbox tools with one warning instead of failing the
chat, and local is an explicit opt-in that warns once per process.

**File**: `backend/env.template` (modified, +10/-0)
```diff
@@ -169,6 +169,16 @@ QDRANT_PORT=6333
 
 OLLAMA_API_URL=http://localhost:11434
 
+# Sandbox for agent-generated code (query service). No default: when unset or
+# not one of the values below, the code-execution tools are left out of every
+# chat and the rest of the service keeps working.
+#   docker  each run in a throwaway container; needs a Docker daemon. This is
+#           what deployment/docker-compose/*.yml and the Helm chart set.
+#   e2b     off-host execution on E2B; needs E2B_API_KEY.
+#   local   a subprocess of the query service with no isolation. Explicit
+#           opt-in for single-user development only; logs a warning on use.
+# SANDBOX_MODE=docker
+
 ACCESS_TOKEN_EXPIRY=24h
 REFRESH_TOKEN_EXPIRY=720h
 
```

**File**: `backend/python/app/agent_loop_lib/sandbox/coding/settings.py` (modified, +73/-55)
```diff
@@ -25,10 +25,12 @@
 
 __all__ = [
     "SandboxSettings",
+    "SandboxUnavailableError",
     "SharedSandboxConfig",
     "SandboxSettingsLoader",
     "EnvSandboxSettingsLoader",
     "ConfigServiceSandboxSettingsLoader",
+    "resolve_sandbox_mode",
 ]
 
 logger = logging.getLogger(__name__)
@@ -40,9 +42,79 @@
 # same as not warning at all.
 _warned_about_host_isolation = False
 
+_ENV_SANDBOX_MODE = "SANDBOX_MODE"
+
 # `SANDBOX_MODE` value -> backend name. The only accepted spellings; anything
 # else is a misconfiguration rather than a hint to guess from.
 _SANDBOX_MODES = {"LOCAL": "local", "DOCKER": "docker", "E2B": "e2b"}
+_SUPPORTED_MODES_TEXT = ", ".join(sorted(_SANDBOX_MODES.values()))
+
+
+class SandboxUnavailableError(ValueError):
+    """No code-execution backend can be built from the current configuration.
+
+    Raised when `SANDBOX_MODE` is unset or not a supported value. Subclasses
+    `ValueError` so callers that already treated a bad mode as a config error
+    keep working; the point of the dedicated type is that tool loaders can
+    catch it and drop the sandbox tools instead of failing the whole chat.
+    """
+
+
+def resolve_sandbox_mode() -> str:
+    """`SANDBOX_MODE` -> backend name (`local`, `docker`, `e2b`), failing closed.
+
+    Unset or blank means no backend: the previous fallback to `local` ran
+    model-generated code as a subprocess of this service whenever an
+    operator forgot the variable, which is the least isolated option chosen
+    by omission. An unknown value is rejected for the same reason, since
+    `SANDBOX_MODE=docekr` would otherwise silently downgrade to host
+    execution while the operator believes it is containerised. `local` is
+    accepted only when typed out, and logs once per process that it runs
+    code in-process.
+
+    Blank reads as unset rather than invalid, matching how shell and
+    Compose `${VAR:-default}` treat an empty value.
+    """
+    configured = os.environ.get(_ENV_SANDBOX_MODE)
+    mode_raw = (configured or "").strip().upper()
+
+    if not mode_raw:
+        raise SandboxUnavailableError(
+            f"{_ENV_SANDBOX_MODE} is not set, so code execution is disabled. "
+            f"Set it to one of: {_SUPPORTED_MODES_TEXT}. 'docker' and 'e2b' "
+            f"isolate generated code; 'local' runs it as a subprocess of this "
+            f"service and must be chosen explicitly."
+        )
+
+    backend = _SANDBOX_MODES.get(mode_raw)
+    if backend is None:
+        logger.error(
+            "%s=%r is not a supported coding sandbox; code execution is disabled "
+            "until it is set to one of: %s",
+            _ENV_SANDBOX_MODE, configured, _SUPPORTED_MODES_TEXT,
+        )
+        raise SandboxUnavailableError(
+            f"{_ENV_SANDBOX_MODE}={configured!r} is not a supported coding "
+            f"sandbox, so code execution is disabled. Use one of: "
+            f"{_SUPPORTED_MODES_TEXT}."
+        )
+
+    if backend == "local":
+        _warn_about_host_isolation()
+    return backend
+
+
+def _warn_about_host_isolation() -> None:
+    global _warned_about_host_isolation
+    if _warned_about_host_isolation:
+        return
+    _warned_about_host_isolation = True
+    logger.warning(
+        "%s=local: model-generated code runs as a subprocess of this service "
+        "(isolation=host: no network namespace, no filesystem boundary beyond "
+        "rlimits). Use %s=docker or e2b for container isolation.",
+        _ENV_SANDBOX_MODE, _ENV_SANDBOX_MODE,
+    )
 
 
 def _env_bool(key: str, default: bool = True) -> bool:
@@ -191,61 +263,7 @@ async def load(self, ctx: SandboxContext) -> SandboxSettings:
 
 
     def _resolve_backend(self) -> str:
-        """`SANDBOX_MODE` -> backend name, rejecting anything unrecognised.
-
-        Mapping an unknown value to `local` is the most permissive possible
-        reading of a value the operator clearly meant to be something else,
-        and it silently downgrades to th
```

**File**: `backend/python/app/agents/agent_loop/factory.py` (modified, +20/-7)
```diff
@@ -92,6 +92,7 @@
 )
 from app.agent_loop_lib.hooks.registry import HookRegistry
 from app.agent_loop_lib.runtime.runtime import AgentRuntime
+from app.agent_loop_lib.sandbox.coding.settings import SandboxUnavailableError
 from app.agent_loop_lib.tools.builtin.data.retrieve_artifact import (
     RetrieveArtifactContentTool,
 )
@@ -471,9 +472,26 @@ def _direct_or_langchain() -> "LLMTransport":
         sandbox_manager = None
         if code_exec_enabled:
             _mark("f:pre_sandbox")
-            sandbox_manager = await build_coding_sandbox_manager(
-                allow_network=network_enabled, ctx=context,
+            try:
+                sandbox_manager = await build_coding_sandbox_manager(
+                    allow_network=network_enabled, ctx=context,
+                )
+            except SandboxUnavailableError as exc:
+                # Fail closed but keep the chat: no SANDBOX_MODE (or a typo)
+                # means no code execution this turn, not an in-process
+                # fallback and not a 500.
+                code_exec_enabled = False
+                logger.warning(
+                    "PipesHubAgentFactory.create: coding-sandbox tools NOT registered "
+                    "(org_id=%s conversation_id=%s): %s",
+                    context.org_id, context.conversation_id, exc,
+                )
+        else:
+            logger.info(
+                "PipesHubAgentFactory.create: code execution disabled — coding-sandbox tools "
+                "(run_code/install_packages/read_sandbox_file) will NOT be available this turn"
             )
+        if sandbox_manager is not None:
             register_coding_sandbox_tools(tool_registry, sandbox_manager, allow_network=network_enabled)
             # Stashed on the context (not returned from create()) so
             # stream_bridge.py's finally block can tear it down without
@@ -484,11 +502,6 @@ def _direct_or_langchain() -> "LLMTransport":
                 [n for n in tool_registry.names() if n in ("run_code", "install_packages", "read_sandbox_file")],
                 network_enabled,
             )
-        else:
-            logger.info(
-                "PipesHubAgentFactory.create: code execution disabled — coding-sandbox tools "
-                "(run_code/install_packages/read_sandbox_file) will NOT be available this turn"
-            )
 
         # Skills subsystem, gated by two layers that must BOTH be true:
         # `skills_enabled()` is the deployment-level env kill-switch
```

**File**: `backend/python/app/agents/agent_loop/tool_loader.py` (modified, +28/-0)
```diff
@@ -55,6 +55,12 @@
 # below, so they need their own gate on `context.has_knowledge` instead.
 _KNOWLEDGE_TOOLSETS = frozenset({"knowledgegraph", "retrieval", "knowledgehub"})
 
+# Group names of the legacy internal toolsets that execute model-generated
+# code through `app.sandbox.manager.get_executor()`. `.as_internal()` exempts
+# them from the "configured on this agent" check, so without this gate they
+# load into every chat even when no sandbox backend is configured.
+_SANDBOX_TOOLSETS = frozenset({"coding_sandbox", "database_sandbox"})
+
 # Same substring heuristic `ToolInstanceCreator._create_with_factory` uses to
 # decide whether to re-raise a `ValueError` as an auth-flavored message
 # (`instance_creator.py`) — duplicated here (not imported) because that
@@ -115,6 +121,25 @@ def _infer_path_prefix(cls: type, *, fallback_name: str) -> str:
     return f"/tools/{fallback_name}"
 
 
+def _sandbox_executor_available(state_logger: logging.Logger | None) -> bool:
+    """Whether `SANDBOX_MODE` names a backend the legacy executor can build.
+
+    Only resolves the mode; nothing is instantiated. A missing or unknown
+    mode is logged once per load and the sandbox toolsets are skipped, so a
+    misconfigured deployment loses code execution rather than running it
+    in-process or failing the chat.
+    """
+    from app.sandbox.manager import SandboxUnavailableError, get_sandbox_mode
+
+    try:
+        get_sandbox_mode()
+    except SandboxUnavailableError as exc:
+        log = state_logger or logger
+        log.warning("Skipping sandbox toolsets: %s", exc)
+        return False
+    return True
+
+
 def _build_dynamic_tools(context: "AgentContext") -> list["Tool"]:
     """Build per-request dynamic tools and wrap them as ``Tool`` instances.
 
@@ -271,6 +296,9 @@ async def load(self, context: "AgentContext", *, skip_apps: set[str] | None = No
                     state_logger.debug("Skipping unconfigured external toolset: %s", ts_name)
                 continue
 
+            if group_name in _SANDBOX_TOOLSETS and not _sandbox_executor_available(state_logger):
+                continue
+
             if ts_name in _KNOWLEDGE_TOOLSETS and not context.has_knowledge:
                 if state_logger:
                     # `info`, not `debug`: this is the condition behind "the agent
```

**File**: `backend/python/app/modules/agents/qna/tool_system.py` (modified, +16/-5)
```diff
@@ -11,6 +11,7 @@
 
 import json
 import logging
+import os
 
 from app.modules.agents.qna.chat_state import ChatState
 
@@ -59,13 +60,23 @@ def code_execution_enabled(state: ChatState) -> bool:
     1. ``state["enable_code_execution"]`` — per-request override
     2. ``PIPESHUB_ENABLE_CODE_EXECUTION`` env var
     3. Default: ``True``
+
+    If the flag cannot be read at all, code execution is treated as
+    disabled: an outage in flag resolution must not switch it on.
     """
-    state_flag = state.get("enable_code_execution")
-    if isinstance(state_flag, bool):
-        return state_flag
+    try:
+        state_flag = state.get("enable_code_execution")
+        if isinstance(state_flag, bool):
+            return state_flag
+
+        env_val = os.environ.get("PIPESHUB_ENABLE_CODE_EXECUTION")
+    except Exception:
+        logger.warning(
+            "code_execution_enabled: could not resolve the flag; treating code execution as disabled",
+            exc_info=True,
+        )
+        return False
 
-    import os as _os
-    env_val = _os.environ.get("PIPESHUB_ENABLE_CODE_EXECUTION")
     if env_val is not None:
         raw = env_val.strip().lower()
         if raw in {"1", "true", "yes", "on"}:
```

---

### Incident Patch 4: `d1a61e58` (2026-09-30)
**Commit Message**: fix(security): bind signed download URLs to the redeeming user (GHSA-cf48-qh3f-g3g9) (#3723)

* fix(security): bind signed download URLs to the redeeming user (GHSA-cf48-qh3f-g3g9)

A signed download URL could be redeemed by any authenticated user in the
record's org and was never re-checked against the record ACL, so a leaked
link handed the file to a colleague under the minting user's identity.

download_file now requires the caller to be the user the URL was minted
for and re-runs check_record_access_with_details; indexing service tokens
keep the org and record checks only. The token's org_id claim is now
required (the legacy no-org branch is gone), the purpose claim is checked
so a service token signed with the same secret can't be redeemed as a
signed URL, and validate_token requires exp.

Same change closes a sibling gap: DELETE /chat/attachments/{id} now only
deletes chat attachments the caller owns, instead of any record in the org.

Logs: the signed-URL handler no longer logs the user id or decoded payload,
and uvicorn's access log redacts sensitive query params such as ?token=,
mirroring the Node redaction list.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

* 

**File**: `backend/python/app/api/routes/chatbot.py` (modified, +7/-1)
```diff
@@ -1182,16 +1182,22 @@ async def delete_chat_attachment(
     """
     user = request.state.user or {}
     org_id = user.get("orgId")
+    user_id = user.get("userId")
     if not org_id:
         raise HTTPException(status_code=400, detail="Missing org context")
 
-    # Verify the record belongs to this org before deleting.
     record = await graph_provider.get_document(record_id, CollectionNames.RECORDS.value)
     if not record:
         # Already gone — treat as success so the client stays consistent.
         return
     if record.get("orgId") != org_id:
         raise HTTPException(status_code=403, detail="Attachment does not belong to this organisation")
+    # record_id comes from the client, so without these checks any member could
+    # delete any record in the org (KB and connector records included).
+    if record.get("connectorName") != Connectors.ATTACHMENTS.value:
+        raise HTTPException(status_code=404, detail="Attachment not found")
+    if not user_id or record_id not in await _records_owned_by(graph_provider, user_id, [record_id]):
+        raise HTTPException(status_code=404, detail="Attachment not found")
 
     # Remove the RECORDS node and all its incident edges
     # (IS_OF_TYPE to FILES, PERMISSION edges to the record).
```

**File**: `backend/python/app/connectors/api/router.py` (modified, +29/-19)
```diff
@@ -118,7 +118,7 @@
     start_vector_store_reindex,
 )
 from app.edition_containers import ConnectorAppContainer
-from app.core.signed_url import SignedUrlHandler
+from app.core.signed_url import SIGNED_URL_PURPOSE, SignedUrlHandler
 from app.models.entities import Record, RecordType
 from app.modules.demo_data.access import is_hidden_demo_record
 from app.services.cache.invalidation_hooks import notify_kb_records_changed
@@ -1115,7 +1115,7 @@ async def get_signed_url(
 
         additional_claims = {
             "connector": connector,
-            "purpose": "file_processing",
+            "purpose": SIGNED_URL_PURPOSE,
             "org_id": caller_org,
         }
 
@@ -1307,21 +1307,24 @@ async def download_file(
         logger.info(f"Downloading file {record_id} with connector {connector}")
         # Verify signed URL using the handler
 
-        payload = signed_url_handler.validate_token(token)
+        payload = signed_url_handler.validate_token(
+            token, required_claims={"purpose": SIGNED_URL_PURPOSE}
+        )
         user_id = payload.user_id
 
-        # Auth middleware already populated request.state.user. Compare JWT
-        # org to the path when present. Tokens minted before org_id was added
-        # to additional_claims still work until expiry (~60m); ACL is not
-        # re-checked here — the signed URL remains valid until it expires.
-        caller = getattr(getattr(request, "state", None), "user", None)
-        if caller is not None:
-            raw_org = caller.get("orgId") if hasattr(caller, "get") else None
-            jwt_org = raw_org.strip() if isinstance(raw_org, str) else ""
-            if jwt_org and jwt_org != str(org_id or "").strip():
-                raise HTTPException(
-                    status_code=HttpStatusCode.NOT_FOUND.value, detail="Record not found"
-                )
+        # The signed URL is not a credential on its own: a session caller must
+        # be the user it was minted for and still pass the record ACL below.
+        # Indexing service tokens carry no user and keep the org checks only.
+        caller_org, caller_user, is_scoped = _caller_org_and_user(request)
+        path_org = str(org_id or "").strip()
+        if caller_org != path_org:
+            raise HTTPException(
+                status_code=HttpStatusCode.NOT_FOUND.value, detail="Record not found"
+            )
+        if not is_scoped and caller_user != str(user_id or "").strip():
+            raise HTTPException(
+                status_code=HttpStatusCode.NOT_FOUND.value, detail="Record not found"
+            )
 
         # Verify file_id matches the token
         if payload.record_id != record_id:
@@ -1350,10 +1353,17 @@ async def download_file(
             raise HTTPException(
                 status_code=HttpStatusCode.NOT_FOUND.value, detail="Record not found"
             )
-        claims = getattr(payload, "additional_claims", None) or {}
-        if isinstance(claims, dict):
-            token_org = str(claims.get("org_id") or "").strip()
-            if token_org and token_org != record_org:
+        token_org = str(payload.additional_claims.get("org_id") or "").strip()
+        if token_org != record_org:
+            raise HTTPException(
+                status_code=HttpStatusCode.NOT_FOUND.value, detail="Record not found"
+            )
+
+        if not is_scoped:
+            access = await graph_provider.check_record_access_with_details(
+                user_id, record_org, record_id
+            )
+            if not access:
                 raise HTTPException(
                     status_code=HttpStatusCode.NOT_FOUND.value, detail="Record not found"
                 )
```

**File**: `backend/python/app/core/signed_url.py` (modified, +8/-4)
```diff
@@ -8,6 +8,10 @@
 from app.config.configuration_service import ConfigurationService
 from app.config.constants.service import DefaultEndpoints, config_node_constants
 
+# Signed-URL tokens share scopedJwtSecret with service tokens; the purpose claim
+# keeps one from being redeemed as the other.
+SIGNED_URL_PURPOSE = "file_processing"
+
 
 class SignedUrlConfig(BaseModel):
     private_key: str | None = None
@@ -91,8 +95,6 @@ async def get_signed_url(
             )
             connector_endpoint = endpoints.get("connectors").get("endpoint", DefaultEndpoints.CONNECTOR_ENDPOINT.value)
 
-            self.logger.info(f"user_id: {user_id}")
-
             payload = TokenPayload(
                 record_id=record_id,
                 user_id=user_id,
@@ -140,6 +142,7 @@ def validate_token(
                 token,
                 self.signed_url_config.private_key,
                 algorithms=[self.signed_url_config.algorithm],
+                options={"require": ["exp"]},
             )
 
             # Convert timestamps back to datetime for validation (ensure UTC timezone)
@@ -149,7 +152,6 @@ def validate_token(
                 payload["iat"] = datetime.fromtimestamp(payload["iat"], tz=timezone.utc)
 
             token_data = TokenPayload(**payload)
-            self.logger.debug(f"Token data: {token_data}")
 
             if required_claims:
                 for key, value in required_claims.items():
@@ -166,7 +168,9 @@ def validate_token(
             self.logger.error("JWT validation error: %s", str(e))
             raise HTTPException(status_code=401, detail="Invalid or expired token") from e
         except ValidationError as e:
-            self.logger.error("Payload validation error: %s", str(e))
+            self.logger.error(
+                "Signed URL payload invalid on fields %s", [err.get("loc") for err in e.errors()]
+            )
             raise HTTPException(status_code=400, detail="Invalid token payload")
         except Exception as e:
             self.logger.error("Unexpected error during token validation: %s", str(e))
```

**File**: `backend/python/app/utils/logger.py` (modified, +18/-1)
```diff
@@ -7,7 +7,7 @@
 from httpx import URL
 
 from app.utils.request_context import NO_CONTEXT, current_display_id, get_context
-from app.utils.url_redaction import redact_url
+from app.utils.url_redaction import redact_sensitive_query_params, redact_url
 
 # ``%(trace)s`` expands to ``[req:<id> thr:<thread> task:<task>] `` only when a
 # context is in flight, so startup/background lines stay clean.
@@ -140,6 +140,22 @@ def filter(self, record: logging.LogRecord) -> bool:
         return not ("/health" in msg and '" 2' in msg)
 
 
+class AccessLogRedactionFilter(logging.Filter):
+    """Redact credentials from the request path uvicorn writes to its access log.
+
+    Signed download URLs carry their JWT in ``?token=``, so logging the raw path
+    would hand a working download link to anyone who can read the logs.
+    """
+
+    def filter(self, record: logging.LogRecord) -> bool:
+        # uvicorn access log args: (client_addr, method, path, http_version, status_code)
+        if isinstance(record.args, tuple) and len(record.args) >= 3:
+            args = list(record.args)
+            args[2] = redact_sensitive_query_params(str(args[2]))
+            record.args = tuple(args)
+        return True
+
+
 # Ensure log directory exists
 log_dir = "logs"
 os.makedirs(log_dir, exist_ok=True)
@@ -172,6 +188,7 @@ def filter(self, record: logging.LogRecord) -> bool:
 
 # Suppress /health* endpoint noise from uvicorn access logs (process_monitor polling)
 logging.getLogger("uvicorn.access").addFilter(HealthCheckFilter())
+logging.getLogger("uvicorn.access").addFilter(AccessLogRedactionFilter())
 
 # httpx logs every outbound request at INFO. Keep the failures, drop the 2xx.
 logging.getLogger("httpx").addFilter(HttpxSuccessFilter())
```

**File**: `backend/python/app/utils/url_redaction.py` (modified, +57/-1)
```diff
@@ -1,6 +1,29 @@
 """Keep credentials in URLs out of logs and error messages."""
 
-from urllib.parse import urlparse, urlunparse
+import re
+from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
+
+# Kept in step with SENSITIVE_QUERY_PARAMS in the Node log-redaction utils.
+SENSITIVE_QUERY_PARAMS = frozenset({
+    "code",
+    "token",
+    "access_token",
+    "refresh_token",
+    "id_token",
+    "client_secret",
+    "api_key",
+    "apikey",
+    "password",
+    "signature",
+    "sig",
+    "x-amz-signature",
+    "x-amz-credential",
+    "x-amz-security-token",
+    "se",
+    "sp",
+})
+
+REDACTED = "[REDACTED]"
 
 
 def redact_url(url: str) -> str:
@@ -14,3 +37,36 @@ def redact_url(url: str) -> str:
     # Drop userinfo (`user:pass@`) while keeping host/port, including bracketed IPv6.
     netloc = parsed.netloc.rsplit("@", 1)[-1]
     return urlunparse((parsed.scheme, netloc, parsed.path or "", "", "", ""))
+
+
+def _redact_pairs(segment: str) -> str:
+    pairs = parse_qsl(segment, keep_blank_values=True)
+    if not any(key.lower() in SENSITIVE_QUERY_PARAMS for key, _ in pairs):
+        return segment
+    return urlencode(
+        [(k, REDACTED if k.lower() in SENSITIVE_QUERY_PARAMS else v) for k, v in pairs],
+        safe="[]",
+    )
+
+
+def redact_sensitive_query_params(url: str) -> str:
+    """Replace the values of credential-bearing query params, keeping the path
+    and the rest of the query so access logs stay useful.
+
+    Every segment after a raw ``?`` or ``#`` is treated as query pairs: uvicorn's
+    h11 protocol splits the request target only at ``?``, so a literal
+    ``#token=...`` sent by a client reaches the access log unparsed.
+    """
+    if not url:
+        return url
+    parts = re.split(r"([?#])", url)
+    if len(parts) == 1:
+        return url
+    try:
+        redacted = [parts[0]] + [
+            part if i % 2 == 0 else _redact_pairs(part)
+            for i, part in enumerate(parts[1:])
+        ]
+    except ValueError:
+        return parts[0]
+    return "".join(redacted)
```

---

### Incident Patch 5: `84614464` (2026-09-30)
**Commit Message**: fix(rate-limit): client side ip forgery issue (#3631)

* clietn side ip forgery issue fix

* fix(rate-limit): clarify auth rate limiter behavior and per-replica limits

* refactor(api-docs): remove redundant 403 and 404 error responses from OpenAPI spec

* test(auth): bind Logger in userAccount authenticate HTTP test

The user account router now resolves Logger from the container for the
auth rate limiter.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

* ci(integration): raise the auth rate limit for the integration stack

The integration tests send all auth requests from one IP. The default
auth limit of 10 per minute would return 429 to them.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

---------

Co-authored-by: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

**File**: `backend/env.template` (modified, +11/-0)
```diff
@@ -204,3 +204,14 @@ REDIS_STREAMS_MAXLEN=500000
 
 # Maximum concurrent blocking connector calls (default: 4)
 CONNECTOR_THREAD_POOL_MAX_WORKERS=
+
+# Rate limiting.
+# MAX_AUTH_REQUESTS_PER_MINUTE caps login, OTP and password requests per client IP.
+# MAX_AUTH_REQUESTS_PER_MINUTE=10
+#
+# TRUST_PROXY tells the app which reverse proxies sit in front of it, so it can
+# read the real client IP from X-Forwarded-For. Leave it unset when clients
+# connect to PORT directly. Behind one proxy (nginx, Caddy, Traefik) use 1,
+# or list the proxy addresses/CIDRs (e.g. 172.16.0.0/12). Never use "true":
+# clients could then pick their own IP and bypass rate limits.
+# TRUST_PROXY=
```

**File**: `backend/nodejs/apps/src/app.ts` (modified, +6/-0)
```diff
@@ -398,6 +398,12 @@ export class Application {
   }
 
   private configureMiddleware(appConfig: AppConfig): void {
+    // Unset means trust no proxy: req.ip is the socket address.
+    if (appConfig.trustProxy.warning) {
+      this.logger.warn(appConfig.trustProxy.warning);
+    }
+    this.app.set('trust proxy', appConfig.trustProxy.value);
+
     const isStrictMode = process.env.STRICT_MODE === 'true';
     if (isStrictMode) {
       // Security middleware - configure helmet once with all options
```

**File**: `backend/nodejs/apps/src/libs/middlewares/rate-limit.middleware.ts` (modified, +32/-26)
```diff
@@ -1,32 +1,22 @@
 import { Request, Response, RequestHandler } from 'express';
-import rateLimit, { Options } from 'express-rate-limit';
+import rateLimit, { Options, ipKeyGenerator } from 'express-rate-limit';
 import { Logger } from '../services/logger.service';
 import { TooManyRequestsError } from '../errors/http.errors';
 import { AuthenticatedUserRequest, AuthenticatedServiceRequest } from './types';
 
 /**
- * Get client IP address from request
+ * Never read X-Forwarded-For / X-Real-IP directly: the client controls them.
+ * req.ip honours the app's `trust proxy` setting (TRUST_PROXY).
  */
 function getClientIp(req: Request): string {
-  const forwarded = req.headers['x-forwarded-for'];
-  if (forwarded) {
-    const forwardedValue = typeof forwarded === 'string' ? forwarded : forwarded[0];
-    if (forwardedValue) {
-      const ips = forwardedValue.split(',');
-      const firstIp = ips[0];
-      if (firstIp) {
-        return firstIp.trim();
-      }
-    }
-  }
-  const realIp = req.headers['x-real-ip'];
-  if (realIp) {
-    const realIpValue = typeof realIp === 'string' ? realIp : realIp[0];
-    if (realIpValue) {
-      return realIpValue;
-    }
-  }
-  return req.ip || req.socket.remoteAddress || 'unknown';
+  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
+}
+
+function getClientIpKey(req: Request): string {
+  // Anonymous requests are counted by IP. An IPv4 address is one per client
+  // and is used as-is. An IPv6 client gets a whole block of addresses, so
+  // those are folded into one key; switching address would reset the limit.
+  return ipKeyGenerator(getClientIp(req));
 }
 
 // Single global rate limiter
@@ -47,8 +37,7 @@ export function createGlobalRateLimiter(logger: Logger, maxRequestsPerMinute: nu
       if (authenticatedServiceReq.tokenPayload?.orgId) {
         return `org:${authenticatedServiceReq.tokenPayload.orgId}`;
       }
-      const ip = getClientIp(req);
-      return `ip:${ip}`;
+      return `ip:${getClientIpKey(req)}`;
     },
 
     skip: (req: Request): boolean => {
@@ -104,7 +93,7 @@ export function createGlobalRateLimiter(logger: Logger, maxRequestsPerMinute: nu
     if (authenticatedServiceReq.tokenPayload?.orgId) {
       return `org:${authenticatedServiceReq.tokenPayload.orgId}`;
     }
-    return `ip:${getClientIp(req)}`;
+    return `ip:${getClientIpKey(req)}`;
   }
 
   return rateLimit(config);
@@ -133,7 +122,7 @@ export function createKeyedRateLimiter(
     if (authenticatedUserReq.user?.userId) {
       return `${prefix}:user:${authenticatedUserReq.user.userId}`;
     }
-    return `${prefix}:ip:${getClientIp(req)}`;
+    return `${prefix}:ip:${getClientIpKey(req)}`;
   };
 
   const config: Partial<Options> = {
@@ -195,4 +184,21 @@ export function createSkillsImportRateLimiter(
     maxRequestsPerMinute,
     message: 'Too many skill import requests. Please try again later.',
   });
-}
\ No newline at end of file
+}
+
+/**
+ * Login/OTP/password endpoints. The global limiter is sized for general API
+ * traffic and is too loose to stop password spraying or OTP/email bombing.
+ * The limit is per replica (in-process store), so N pods admit up to
+ * N × maxRequestsPerMinute per client until a shared store is wired.
+ */
+export function createAuthRateLimiter(
+  logger: Logger,
+  maxRequestsPerMinute = 10,
+): RequestHandler {
+  return createKeyedRateLimiter(logger, {
+    prefix: 'auth',
+    maxRequestsPerMinute,
+    message: 'Too many authentication requests. Please try again later.',
+  });
+}
```

**File**: `backend/nodejs/apps/src/libs/utils/trust-proxy.ts` (added, +33/-0)
```diff
@@ -0,0 +1,33 @@
+// Express `trust proxy`: false (none), a hop count, or addresses/CIDRs.
+export type TrustProxySetting = false | number | string[];
+
+export interface ParsedTrustProxy {
+  value: TrustProxySetting;
+  warning?: string;
+}
+
+// `true` is rejected: Express would then use the leftmost X-Forwarded-For
+// entry, which the client controls.
+export function parseTrustProxy(raw: string | undefined): ParsedTrustProxy {
+  const value = raw?.trim();
+  if (!value || value === 'false' || value === '0') {
+    return { value: false };
+  }
+  if (value === 'true') {
+    return {
+      value: false,
+      warning:
+        'TRUST_PROXY=true is not allowed (it trusts client-supplied X-Forwarded-For). ' +
+        'Set a hop count or a list of proxy CIDRs. Falling back to trusting no proxy.',
+    };
+  }
+  if (/^\d+$/.test(value)) {
+    return { value: parseInt(value, 10) };
+  }
+  return {
+    value: value
+      .split(',')
+      .map((entry) => entry.trim())
+      .filter(Boolean),
+  };
+}
```

**File**: `backend/nodejs/apps/src/modules/api-docs/pipeshub-openapi.yaml` (modified, +30/-0)
```diff
@@ -17463,6 +17463,12 @@ paths:
             application/json:
               schema:
                 $ref: '#/components/schemas/ErrorResponse'
+        '429':
+          description: Rate limit exceeded — per-IP auth endpoint limiter (MAX_AUTH_REQUESTS_PER_MINUTE)
+          content:
+            application/json:
+              schema:
+                $ref: '#/components/schemas/RateLimitErrorResponse'
         '500':
           description: Internal server error
           content:
@@ -17550,6 +17556,12 @@ paths:
             application/json:
               schema:
                 $ref: '#/components/schemas/ErrorResponse'
+        '429':
+          description: Rate limit exceeded — per-IP auth endpoint limiter (MAX_AUTH_REQUESTS_PER_MINUTE)
+          content:
+            application/json:
+              schema:
+                $ref: '#/components/schemas/RateLimitErrorResponse'
         '500':
           description: Internal server error
           content:
@@ -17616,6 +17628,12 @@ paths:
             application/json:
               schema:
                 $ref: '#/components/schemas/ErrorResponse'
+        '429':
+          description: Rate limit exceeded — per-IP auth endpoint limiter (MAX_AUTH_REQUESTS_PER_MINUTE)
+          content:
+            application/json:
+              schema:
+                $ref: '#/components/schemas/RateLimitErrorResponse'
         '500':
           description: The account lookup failed on the server (the same for every email)
           content:
@@ -17665,6 +17683,12 @@ paths:
             application/json:
               schema:
                 $ref: '#/components/schemas/ErrorResponse'
+        '429':
+          description: Rate limit exceeded — per-IP auth endpoint limiter (MAX_AUTH_REQUESTS_PER_MINUTE)
+          content:
+            application/json:
+              schema:
+                $ref: '#/components/schemas/RateLimitErrorResponse'
         '500':
           description: Internal server error
           content:
@@ -18018,6 +18042,12 @@ paths:
             application/json:
               schema:
                 $ref: '#/components/schemas/ErrorResponse'
+        '429':
+          description: Rate limit exceeded — per-IP auth endpoint limiter (MAX_AUTH_REQUESTS_PER_MINUTE)
+          content:
+            application/json:
+              schema:
+                $ref: '#/components/schemas/RateLimitErrorResponse'
         '500':
           description: Internal server error
           content:
```

---

### Incident Patch 6: `c840d16f` (2026-09-29)
**Commit Message**: fix(chat): ask user question  (#3592)

Regenerate left the question only on a side row for agent chats and treated the trailing tool row as the last message. Save the payload on the bot reply for every chat, resume the original goal from the saved selection, and keep the card up with a toast when the submit fails.

The resume settled the card as submitted whenever the turn gained answer text, so a question asked during that resume was merged in but rendered read-only and could never be answered. Treat a card as answered only once every question in it has one, live and after a reload.

- Option ids derive from the label alone on both sides (optionId in the card, opt_<label> in intrim_tools.py), so two questions offering 'All' shared that id and answering one marked the sibling answered. The id/label fallback now skips answers a sibling question owns.
- askQuestionMatchesRow treated every assistant row as the card's while a regenerate streamed. Both id checks already cover the regenerated row, so that slot-wide clause is gone.
- loadHistoricalMessages addressed the card to the reply it had just merged away, an id no row carries, so a resume fell back to the newest assistant row and o

**File**: `backend/nodejs/apps/src/modules/enterprise_search/controller/es_controller.ts` (modified, +58/-23)
```diff
@@ -13,6 +13,7 @@ import {
   sendSSECompleteEvent,
   handleRegenerationStreamData,
   handleRegenerationSuccess,
+  staleAskUserQuestionToolCallIds,
   handleRegenerationError,
 } from './../utils/utils';
 import sharp from 'sharp';
@@ -183,6 +184,8 @@ export function buildSearchResponseForClient(data: AiSearchResponse & Record<str
 }
 
 const AGENT_LIST_PAGE_LIMIT = 200;
+/** Newest-first window scanned to find the answer a regenerate targets. */
+const REGENERATE_TAIL_MESSAGES = 50;
 const AGENT_ARCHIVES_INITIAL_CHAT_LIMIT = 5;
 const AGENT_ARCHIVES_INITIAL_AGENT_LIMIT = 5;
 
@@ -3163,7 +3166,11 @@ async function regenerateAnswersInternal(
   // Helper function to validate and get conversation
   async function performRegenerateAnswersValidation(
     session?: ClientSession | null,
-  ): Promise<{ conversation: IChatSessionDocument; userQuery: IMessage }> {
+  ): Promise<{
+    conversation: IChatSessionDocument;
+    userQuery: IMessage;
+    staleAskToolCallIds: mongoose.Types.ObjectId[];
+  }> {
     if (!conversationId) {
       throw new BadRequestError('Conversation ID is required');
     }
@@ -3186,38 +3193,37 @@ async function regenerateAnswersInternal(
       throw new NotFoundError('Conversation not found or unauthorized');
     }
 
-    // Fetch the last 2 messages (newest first) to validate without positional
-    // addressing into a (now non-existent) embedded array.
-    const lastTwoMessages = (await getMessages(
+    // Newest-first tail (not just the last 2 rows): an ask_user_question turn
+    // ends with `tool_call` rows saved after its answer, so the answer being
+    // regenerated is not necessarily the newest message.
+    const recentMessages = (await getMessages(
       conversation._id as mongoose.Types.ObjectId,
-      { limit: 2, sort: -1 },
+      { limit: REGENERATE_TAIL_MESSAGES, sort: -1 },
       session,
     )) as Array<IMessage & { _id: mongoose.Types.ObjectId }>;
 
-    if (lastTwoMessages.length === 0) {
+    if (recentMessages.length === 0) {
       throw new BadRequestError('No messages found in conversation');
     }
 
-    // Get the last message and validate it
-    const lastMessage = lastTwoMessages[0]!;
-
-    if (lastMessage._id?.toString() !== messageId) {
+    const lastBot = recentMessages.find(
+      (msg) => msg.messageType === 'bot_response',
+    );
+    if (!lastBot || lastBot._id?.toString() !== messageId) {
       throw new BadRequestError(
         'Can only regenerate the last message in the conversation',
       );
     }
-    if (lastMessage.messageType !== 'bot_response') {
-      throw new BadRequestError('Can only regenerate bot response messages');
-    }
 
-    // Get user query from the previous message
-    if (lastTwoMessages.length < 2) {
+    const lastBotIdx = recentMessages.findIndex(
+      (msg) => msg._id?.toString() === lastBot._id?.toString(),
+    );
+    const userQuery = recentMessages
+      .slice(lastBotIdx + 1)
+      .find((msg) => msg.messageType === 'user_query');
+    if (!userQuery) {
       throw new BadRequestError('No user query found to regenerate response');
     }
-    const userQuery = lastTwoMessages[1]!;
-    if (userQuery.messageType !== 'user_query') {
-      throw new BadRequestError('Previous message must be a user query');
-    }
 
     logger.debug('Regenerate answers validation passed', {
       requestId,
@@ -3226,7 +3232,14 @@ async function regenerateAnswersInternal(
       timestamp: new Date().toISOString(),
     });
 
-    return { conversation, userQuery };
+    // Computed here so the replacement answer costs no extra read: this tail is
+    // the turn as it stands before the regeneration overwrites it.
+    const staleAskToolCallIds = staleAskUserQuestionToolCallIds(
+      [...recentMessages].reverse(),
+      lastBot._id,
+    );
+
+    return { conversation, userQuery, staleAskToolCallIds };
   }
 
   try {
@@ -3244,6 +3257,7 @@ async function regenerateAnswersInternal(
     let validationResult: {
   
```

**File**: `backend/nodejs/apps/src/modules/enterprise_search/types/conversation.interfaces.ts` (modified, +3/-2)
```diff
@@ -352,8 +352,9 @@ export interface IAIResponse {
   citations: ICitation[];
   confidence?: ConfidenceLevel;
   /** Set by Python's `AnswerFinalizer` cancelled branch (Phase 3) — `RUN_FINISHED`/
-   * `complete` payload for a cooperatively-stopped run carries the partial answer. */
-  status?: 'stopped';
+   * `complete` payload for a cooperatively-stopped run carries the partial answer.
+   * `waiting_input` is an ask_user_question pause: empty answer is expected. */
+  status?: 'stopped' | 'waiting_input';
   reason: string;
   answerMatchType: AnswerMatchType;
   documentIndexes: string[];
```

**File**: `backend/nodejs/apps/src/modules/enterprise_search/utils/utils.ts` (modified, +221/-106)
```diff
@@ -281,6 +281,59 @@ export const updateMessageById = async (
   );
 };
 
+const hasAskUserQuestionTool = (msg: IMessage | undefined): boolean =>
+  Boolean(msg?.tools?.some((tool) => tool.toolName?.includes('ask_user_question')));
+
+/**
+ * The `ask_user_question` `tool_call` rows sitting either side of one bot turn,
+ * which a regeneration of that turn makes stale.
+ *
+ * `updateMessageById` replaces the answer in place, but those rows are separate
+ * documents and `appendMessages` can only add more (a fresh `seq` each time).
+ * Left alone, every regeneration of a card turn keeps the discarded run's
+ * questions, so `formatPreviousConversations` replays them to the model and a
+ * reload restores a card the current answer never asked. The replacement answer
+ * carries the payload itself — see `attachAskUserQuestionToMessage`.
+ *
+ * @param messages chronological (`seq`-ascending) window containing the turn
+ */
+export const staleAskUserQuestionToolCallIds = (
+  messages: Array<IMessage & { _id?: mongoose.Types.ObjectId }>,
+  botMessageId: mongoose.Types.ObjectId | string,
+): mongoose.Types.ObjectId[] => {
+  const botIndex = messages.findIndex(
+    (msg) => msg._id?.toString() === botMessageId.toString(),
+  );
+  if (botIndex < 0) {
+    return [];
+  }
+  const stale: mongoose.Types.ObjectId[] = [];
+  const collect = (from: number, step: number): void => {
+    for (let i = from; i >= 0 && i < messages.length; i += step) {
+      const row = messages[i];
+      if (row?.messageType !== 'tool_call') break;
+      if (row._id && hasAskUserQuestionTool(row)) stale.push(row._id);
+    }
+  };
+  collect(botIndex - 1, -1);
+  collect(botIndex + 1, 1);
+  return stale;
+};
+
+export const deleteMessagesById = async (
+  messageIds: mongoose.Types.ObjectId[],
+  mongoSession?: ClientSession | null,
+): Promise<number> => {
+  if (messageIds.length === 0) {
+    return 0;
+  }
+  const result = await ChatSessionMessage.deleteMany(
+    { _id: { $in: messageIds } },
+    mongoSession ? { session: mongoSession } : undefined,
+  );
+  return result.deletedCount ?? 0;
+};
+
 /** Append a feedback entry to one message's `feedback` array. */
 export const appendMessageFeedback = async (
   messageId: mongoose.Types.ObjectId | string,
@@ -524,36 +577,40 @@ export const buildAIResponseMessage = (
   citations: ICitation[] = [],
   modelInfo?: IAIModel,
 ): IMessage => {
+  const data = aiResponse?.data;
   // A `stopped` run may have been cancelled before any tokens streamed —
-  // an empty answer is valid there (see AnswerFinalizer's cancelled branch),
-  // unlike a normal completion, which should never legitimately have none.
-  if (!aiResponse?.data?.answer && aiResponse?.data?.status !== 'stopped') {
+  // an empty answer is valid there (see AnswerFinalizer's cancelled branch).
+  // `waiting_input` is the ask_user_question pause: the card is the turn,
+  // not a prose answer.
+  const allowsEmptyAnswer =
+    data?.status === 'stopped' || data?.status === 'waiting_input';
+  if (!data || (!data.answer && !allowsEmptyAnswer)) {
     throw new InternalServerError('AI response must include an answer');
   }
 
   const message: IMessage = {
-    messageType: isClassifiedFailureAnswer(aiResponse.data)
+    messageType: isClassifiedFailureAnswer(data)
       ? 'error'
       : 'bot_response',
     createdAt: new Date(),
     updatedAt: new Date(),
-    content: aiResponse.data?.answer ?? '',
+    content: data.answer ?? '',
     contentFormat: 'MARKDOWN',
     citations: citations.map((citation) => ({
       citationId: citation._id as mongoose.Types.ObjectId,
     })),
-    confidence: aiResponse.data.confidence,
+    confidence: data.confidence,
     followUpQuestions:
-      aiResponse.data.followUpQuestions?.map((q) => ({
+      data.followUpQuestions?.map((q) => ({
         question: q.question,
         confidence: q.confidence,
         reasoning: q.reasoning,
       })) || [],
     metadata: {
-      processingTime
```

**File**: `backend/nodejs/apps/tests/modules/enterprise_search/utils/utils.persistence.test.ts` (modified, +91/-0)
```diff
@@ -14,6 +14,7 @@ import {
   saveCompleteAgentConversation,
   saveCompleteConversation,
   savePartialConversation,
+  staleAskUserQuestionToolCallIds,
 } from '../../../../src/modules/enterprise_search/utils/utils'
 import { InternalServerError, NotFoundError } from '../../../../src/libs/errors/http.errors'
 import { CONVERSATION_STATUS } from '../../../../src/modules/enterprise_search/constants/constants'
@@ -308,6 +309,96 @@ describe('Saving chat answers (enterprise search utils)', () => {
 
       expect(turn).to.not.have.property('tool_results')
     })
+
+    it('replays the questions a regenerated answer carries itself', () => {
+      const payload = { name: 'ask_user_question', questions: [{ question: 'Which region?' }] }
+      const history = formatPreviousConversations([
+        {
+          messageType: 'bot_response',
+          content: '',
+          tools: [{ toolName: 'ask_user_question', toolResult: payload }],
+        } as unknown as IMessage,
+      ])
+
+      expect(at(history, 0).tool_results).to.deep.equal([
+        {
+          tool_id: 'ask_user_question',
+          tool_name: 'internaltools__ask_user_question',
+          result: JSON.stringify(payload),
+          status: 'success',
+        },
+      ])
+    })
+
+    it('replays only the newest questions row when older regenerations left theirs behind', () => {
+      const askRow = (question: string): IMessage => ({
+        messageType: 'tool_call',
+        content: '',
+        tools: [{ toolName: 'ask_user_question', toolResult: { questions: [{ question }] } }],
+      } as unknown as IMessage)
+      const history = formatPreviousConversations([
+        { messageType: 'user_query', content: 'Which region?' } as IMessage,
+        { messageType: 'bot_response', content: '' } as IMessage,
+        askRow('discarded'),
+        askRow('current'),
+      ])
+
+      const results = at(history, 1).tool_results as Array<{ result: string }>
+      expect(results).to.have.length(1)
+      expect(results[0]?.result).to.contain('current')
+      expect(results[0]?.result).to.not.contain('discarded')
+    })
+  })
+
+  describe('staleAskUserQuestionToolCallIds', () => {
+    const row = (
+      messageType: string,
+      tools?: Array<{ toolName: string; toolResult: unknown }>,
+    ): IMessage & { _id: mongoose.Types.ObjectId } => ({
+      _id: new mongoose.Types.ObjectId(),
+      messageType,
+      content: '',
+      ...(tools ? { tools } : {}),
+    } as unknown as IMessage & { _id: mongoose.Types.ObjectId })
+    const askTools = [{ toolName: 'ask_user_question', toolResult: { questions: [] } }]
+
+    it('collects the questions rows on both sides of the turn being regenerated', () => {
+      const before = row('tool_call', askTools)
+      const bot = row('bot_response')
+      const after = row('tool_call', askTools)
+      const messages = [row('user_query'), before, bot, after, row('user_query')]
+
+      const stale = staleAskUserQuestionToolCallIds(messages, bot._id)
+
+      expect(stale.map((id) => id.toString())).to.have.members([
+        before._id.toString(),
+        after._id.toString(),
+      ])
+    })
+
+    it('leaves another turn\'s questions row alone', () => {
+      const otherTurnAsk = row('tool_call', askTools)
+      const bot = row('bot_response')
+      const messages = [otherTurnAsk, row('bot_response'), row('user_query'), bot]
+
+      expect(staleAskUserQuestionToolCallIds(messages, bot._id)).to.deep.equal([])
+    })
+
+    it('ignores a tool_call row for some other tool', () => {
+      const bot = row('bot_response')
+      const messages = [
+        bot,
+        row('tool_call', [{ toolName: 'jira.search', toolResult: {} }]),
+      ]
+
+      expect(staleAskUserQuestionToolCallIds(messages, bot._id)).to.deep.equal([])
+    })
+
+    it('returns nothing when the turn is outside the window', () => {
+      expect(
+        staleAskUserQuestionToolCallIds([row('bot_response')], new mongoose.Types.Ob
```

**File**: `backend/nodejs/apps/tests/modules/enterprise_search/utils/utils.regeneration.test.ts` (modified, +56/-20)
```diff
@@ -114,8 +114,8 @@ interface StreamCall {
   conversation?: FakeConversation | null
   messageId?: mongoose.Types.ObjectId | string | null
   onComplete?: (data: IAIResponse) => void
-  isAgentSession?: boolean
   accumulator?: StreamedContentAccumulator
+  onAskUserQuestion?: (payload: unknown) => void
 }
 
 const feed = (res: FakeResponse, call: StreamCall): string =>
@@ -128,9 +128,10 @@ const feed = (res: FakeResponse, call: StreamCall): string =>
     'req-regen',
     asRes(res),
     call.onComplete ?? ((): void => undefined),
-    call.isAgentSession ?? false,
     AGUI_PROTOCOL,
     call.accumulator,
+    undefined,
+    call.onAskUserQuestion,
   )
 
 describe('Regenerating an answer (enterprise search utils)', () => {
@@ -271,51 +272,51 @@ describe('Regenerating an answer (enterprise search utils)', () => {
       expect(conversation.save.called).to.equal(false)
     })
 
-    it('records an ask_user_question for an agent regeneration and forwards it', async () => {
+    it('reports an ask_user_question for an agent regeneration and forwards it', async () => {
       const res = makeRes()
       const conversation = makeConversation({ agentKey: 'agent-1' })
-      sinon.stub(ChatSession, 'findOneAndUpdate').resolves({ nextSeq: 9 })
       const insert = sinon.stub(ChatSessionMessage, 'insertMany').resolves([])
       const toolData = { question: 'Which region?', options: ['EMEA', 'APAC'] }
       const frame = frameAGUI('CUSTOM', { name: 'ask_user_question', value: { toolData } })
+      const onAskUserQuestion = sinon.spy()
 
-      feed(res, { chunk: frame, conversation, isAgentSession: true })
+      feed(res, { chunk: frame, conversation, onAskUserQuestion })
       await settle()
 
       expect(written(res)).to.equal(frame)
-      const [docs] = insert.firstCall.args as [Array<{ sessionId: mongoose.Types.ObjectId; orgId: mongoose.Types.ObjectId; seq: number; tools: Array<{ toolResult: unknown }> }>]
-      expect(at(docs).sessionId).to.equal(conversation._id)
-      expect(at(docs).orgId).to.equal(conversation.orgId)
-      expect(at(docs).seq).to.equal(9)
-      expect(at(at(docs).tools).toolResult).to.deep.equal(toolData)
+      expect(onAskUserQuestion.firstCall.args[0]).to.deep.equal(toolData)
+      // The payload rides on the regenerated answer itself (see
+      // attachAskUserQuestionToMessage) — a second row would outlive the next
+      // regeneration and restore a card that answer never asked.
+      expect(insert.called).to.equal(false)
     })
 
-    it('forwards ask_user_question without saving it for a plain chat regeneration', async () => {
+    it('reports an ask_user_question for a plain chat regeneration too, so a reload can restore the card', async () => {
       const res = makeRes()
       const conversation = makeConversation()
-      const allocate = sinon.stub(ChatSession, 'findOneAndUpdate').resolves({ nextSeq: 1 })
       const insert = sinon.stub(ChatSessionMessage, 'insertMany').resolves([])
-      const frame = frameAGUI('CUSTOM', { name: 'ask_user_question', value: { toolData: { q: 1 } } })
+      const toolData = { q: 1 }
+      const frame = frameAGUI('CUSTOM', { name: 'ask_user_question', value: { toolData } })
+      const onAskUserQuestion = sinon.spy()
 
-      feed(res, { chunk: frame, conversation, isAgentSession: false })
+      feed(res, { chunk: frame, conversation, onAskUserQuestion })
       await settle()
 
       expect(written(res)).to.equal(frame)
-      expect(allocate.called).to.equal(false)
+      expect(onAskUserQuestion.firstCall.args[0]).to.deep.equal(toolData)
       expect(insert.called).to.equal(false)
     })
 
-    it('keeps streaming when saving an ask_user_question fails', async () => {
+    it('keeps streaming when an ask_user_question frame has no payload', async () => {
       const res = makeRes()
       const conversation = makeConversation({ agentKey: 'agent-1' })
-      sinon.stub(ChatSession, 'findOneAndUpdate').resolves(null)
       cons
```

---

### Incident Patch 7: `6d10d960` (2026-09-29)
**Commit Message**: fix(connectors): keep Web and RSS fetches off non-public addresses (#3674)

* fix(connectors): keep Web and RSS fetches off non-public addresses

The Web and RSS connectors fetched any URL a user gave, and followed
redirects and links to loopback, private and cloud metadata addresses.
The answer was indexed, so any org user could read internal services.

Every fetch now walks redirects one hop at a time. Each hop is checked
with url_fetcher's blocked-address policy and pinned to the checked
address. The aiohttp session refuses blocked addresses in its resolver,
and the headless browser aborts requests to them.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

* fix(web): check every browser connection through a local proxy

Playwright's route handler never saw a redirect's later hops, so a page's
script, image or fetch() could follow a redirect to an internal address.
Chromium now sends every request through a loopback proxy that checks the
target and connects only to the checked address.

The storage signed-URL session gets the 30-second timeout the crawl
session gave it before.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>

* fix(web):

**File**: `backend/python/app/connectors/sources/rss/connector.py` (modified, +2/-1)
```diff
@@ -25,6 +25,7 @@
     OriginTypes,
 )
 from app.connectors.core.constants import IconPaths
+from app.connectors.sources.web.address_guard import create_guarded_session
 from app.connectors.sources.web.fetch_strategy import (
     FetchResponse,
     fetch_url_with_fallback,
@@ -209,7 +210,7 @@ async def init(self) -> bool:
 
             # Initialize aiohttp session with realistic browser headers
             timeout = aiohttp.ClientTimeout(total=30)
-            self.session = aiohttp.ClientSession(
+            self.session = create_guarded_session(
                 timeout=timeout,
                 headers={
                     "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
```

**File**: `backend/python/app/connectors/sources/web/address_guard.py` (added, +243/-0)
```diff
@@ -0,0 +1,243 @@
+"""Keeps the Web and RSS connectors' requests off loopback, private, link-local and cloud
+metadata addresses, redirects included, using the blocked-address policy in ``app.utils.url_fetcher``.
+Each check resolves the host once and the request is sent to that answer, so a second DNS answer
+(rebinding) can't move it somewhere the check never saw.
+
+Operators list internal hosts the connectors may crawl in ``WEB_CONNECTOR_ALLOWED_HOSTS``
+(comma-separated host names). Link-local and cloud metadata addresses stay blocked for them.
+"""
+
+from __future__ import annotations
+
+import asyncio
+import contextlib
+import functools
+import ipaddress
+import os
+import socket
+from typing import TYPE_CHECKING
+from urllib.parse import urlsplit
+
+import aiohttp
+from aiohttp.abc import AbstractResolver, ResolveResult
+from aiohttp.resolver import DefaultResolver
+
+from app.utils.url_fetcher import (
+    _CLOUD_METADATA_ADDRESSES,
+    FetchError,
+    IPAddress,
+    PublicTarget,
+    _hostname_is_blocked,
+    _ip_is_blocked,
+    resolve_public_http_target,
+)
+
+if TYPE_CHECKING:
+    from aiohttp import ClientHandlerType, ClientRequest, ClientResponse
+
+
+ALLOWED_HOSTS_ENV = "WEB_CONNECTOR_ALLOWED_HOSTS"
+_DEFAULT_PORTS = {"http": 80, "https": 443}
+# AWS's IPv6 metadata endpoint is a private (ULA) address, so only this list keeps it closed to an allowed host.
+_NEVER_ALLOWED = _CLOUD_METADATA_ADDRESSES | {ipaddress.ip_address("fd00:ec2::254")}
+
+
+class UnsafeAddressError(aiohttp.ClientConnectionError):
+    """The URL isn't http(s), or its host is or resolves to an address the connectors may not reach."""
+
+
+@functools.cache
+def _allowed_hosts() -> frozenset[str]:
+    return frozenset(
+        host.strip().lower().removesuffix(".") for host in os.getenv(ALLOWED_HOSTS_ENV, "").split(",") if host.strip()
+    )
+
+
+def _host_allowed(host: str | None) -> bool:
+    return bool(host) and host.lower().removesuffix(".") in _allowed_hosts()
+
+
+def _refuse_never_allowed(host: str, ip: IPAddress) -> None:
+    if isinstance(ip, ipaddress.IPv6Address) and ip.ipv4_mapped:
+        ip = ip.ipv4_mapped  # ::ffff:169.254.169.254 reaches the IPv4 metadata address
+    if ip.is_link_local or ip in _NEVER_ALLOWED:
+        raise UnsafeAddressError(f"{host!r} resolves to a link-local or cloud metadata address")
+
+
+def _resolve_allowed_host(url: str) -> PublicTarget:
+    parts = urlsplit(url)
+    host = parts.hostname or ""
+    port = parts.port or _DEFAULT_PORTS[parts.scheme]
+    infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
+    addresses = tuple(dict.fromkeys(ipaddress.ip_address(info[4][0]) for info in infos))
+    for ip in addresses:
+        _refuse_never_allowed(host, ip)
+    return PublicTarget(parts.scheme, host, port, addresses)
+
+
+async def resolve_target(url: str) -> PublicTarget | None:
+    """The checked address to send a request for ``url`` to; None when its host doesn't resolve.
+
+    Raises:
+        UnsafeAddressError: if the URL can't be fetched or any address it resolves to is blocked.
+    """
+    try:
+        parts = urlsplit(url)
+        allowed = parts.scheme in _DEFAULT_PORTS and _host_allowed(parts.hostname)
+    except ValueError as e:
+        raise UnsafeAddressError(f"{url!r} is not a valid URL") from e
+    if allowed:
+        try:
+            return await asyncio.to_thread(_resolve_allowed_host, url)
+        except socket.gaierror:
+            return None
+        except ValueError as e:
+            raise UnsafeAddressError(f"{url!r} has an invalid port or address") from e
+    try:
+        return await asyncio.to_thread(resolve_public_http_target, url)
+    except FetchError as e:
+        if isinstance(e.__cause__, socket.gaierror):
+            return None
+        raise UnsafeAddressError(str(e)) from e
+
+
+async def is_unsafe_url(url: str) -> bool:
+    """Whether ``url`` must not be requested; a host that doesn't resolve is left to the f
```

**File**: `backend/python/app/connectors/sources/web/connector.py` (modified, +13/-6)
```diff
@@ -72,12 +72,14 @@
     RecordType,
     User,
 )
+from app.connectors.sources.web.address_guard import create_guarded_session, is_unsafe_url
 from app.connectors.sources.web.fetch_strategy import (
     MAX_RATE_LIMIT_BACKOFF,
     FetchResponse,
     build_stealth_headers,
     fetch_url_with_fallback,
     too_many_redirects_response,
+    unsafe_address_response,
 )
 from app.connectors.sources.web.crawl4ai_fetcher import Crawl4AIFetcher, FetchResult, get_shared_fetcher, release_shared_fetcher, resolve_fetch_status_code
 from app.connectors.sources.web.robots import RobotsRules
@@ -177,6 +179,7 @@ class Status(Enum):
     "This page redirects too many times, so it couldn't be fetched. "
     "Check the address in a browser, then sync again."
 )
+UNSAFE_ADDRESS_REASON = "This address is on a private or internal network, so it wasn't fetched."
 ROBOTS_MAX_BYTES = 512 * 1024
 
 DOCUMENT_MIME_TYPES = {
@@ -484,7 +487,7 @@ async def init(self) -> bool:
 
             # Initialize aiohttp session with realistic browser headers
             timeout = aiohttp.ClientTimeout(total=30)
-            self.session = aiohttp.ClientSession(
+            self.session = create_guarded_session(
                 timeout=timeout,
                 headers={
                     "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
@@ -1406,7 +1409,7 @@ def _should_try_crawl4ai_fallback(self, result: FetchResponse | None, url: str |
         # headless won't change the answer.
         if result.status_code in {404, 405, 410, 413}:
             return False
-        if result.headers.get("X-Fetch-Skip-Reason") == "too_many_redirects":
+        if result.headers.get("X-Fetch-Skip-Reason") in {"too_many_redirects", "unsafe_address"}:
             return False  # the browser would follow the same chain, without checking each hop
         return True  # Bot-block, rate-limit, or server error — try headless
 
@@ -1769,6 +1772,8 @@ async def _landing_refused_before_browser(self, url: str) -> FetchResponse | Non
         if probed[1] == PROBE_UNENDING:
             return too_many_redirects_response(url)
         landing = probed[0]
+        if await is_unsafe_url(landing):
+            return unsafe_address_response(landing)
         return self._out_of_scope_response(landing) if self._outside_crawl(landing) else self._robots_skip_response(landing)
 
     @staticmethod
@@ -1913,6 +1918,8 @@ async def _probe_landing(self, url: str) -> tuple[str, int, str | None] | None:
         if self.session is None:
             return None
         for _ in range(MAX_PROBE_REDIRECTS + 1):
+            if await is_unsafe_url(url):
+                return url, 0, None  # never requested: not a public address
             try:
                 status, location, content_type = await self._probe_hop("HEAD", url)
             except (asyncio.TimeoutError, aiohttp.ClientError, OSError):
@@ -2004,6 +2011,7 @@ async def _validate_fetch_result(
                 reason = (
                     self._too_large_reason() if skip == "max_size_exceeded"
                     else TOO_MANY_REDIRECTS_REASON if skip == "too_many_redirects"
+                    else UNSAFE_ADDRESS_REASON if skip == "unsafe_address"
                     else None
                 )
                 self._record_final_failure(
@@ -3111,8 +3119,8 @@ async def get_signed_url(self, record: Record) -> Optional[str]:  # type: ignore
                 token = await self._get_storage_token()
                 download_endpoint = f"{storage_url}/api/v1/document/internal/{record.storage_document_id}/download"
 
-                owned_session = self.session is None
-                session = self.session or aiohttp.ClientSession()
+                # Not self.session: the storage service is internal, which the crawl's session refuses.
+                session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=30))
            
```

**File**: `backend/python/app/connectors/sources/web/crawl4ai_fetcher.py` (modified, +20/-1)
```diff
@@ -11,11 +11,13 @@
 
 _HTTP_STATUS_RE = re.compile(r"HTTP\s+(\d{3})")
 
-from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
+from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode, ProxyConfig
 from crawl4ai.async_dispatcher import SemaphoreDispatcher
 from crawl4ai.async_crawler_strategy import AsyncPlaywrightCrawlerStrategy
 from crawl4ai.browser_adapter import UndetectedAdapter
 
+from app.connectors.sources.web.address_guard import start_guard_proxy
+
 
 class _SharedSemaphoreDispatcher(SemaphoreDispatcher):
     """SemaphoreDispatcher that uses an externally-owned semaphore.
@@ -301,6 +303,7 @@ def __init__(
         self._concurrency = concurrency
         self._semaphore: Optional[asyncio.Semaphore] = None
         self._crawler: Optional[AsyncWebCrawler] = None
+        self._proxy: Optional[asyncio.Server] = None
         self._loop: Optional[asyncio.AbstractEventLoop] = None
         self._thread: Optional[threading.Thread] = None
 
@@ -328,6 +331,10 @@ async def _create_semaphore(self) -> asyncio.Semaphore:
         return asyncio.Semaphore(self._concurrency)
 
     async def _create_and_start_crawler(self) -> AsyncWebCrawler:
+        self._proxy = await start_guard_proxy()
+        proxy_port = self._proxy.sockets[0].getsockname()[1]
+        # Playwright also sends loopback through the proxy (<-loopback>), so the proxy refuses it.
+        self._browser_config.proxy_config = ProxyConfig(server=f"http://127.0.0.1:{proxy_port}")
         strategy = AsyncPlaywrightCrawlerStrategy(
             browser_config=self._browser_config,
             browser_adapter=UndetectedAdapter(),
@@ -336,6 +343,16 @@ async def _create_and_start_crawler(self) -> AsyncWebCrawler:
         await crawler.start()
         return crawler
 
+    async def _close_proxy(self) -> None:
+        """Stop the proxy and the browser connections it still relays, before the loop stops."""
+        assert self._proxy is not None
+        self._proxy.close()
+        self._proxy = None
+        relays = [t for t in asyncio.all_tasks() if t is not asyncio.current_task()]
+        for relay in relays:
+            relay.cancel()
+        await asyncio.gather(*relays, return_exceptions=True)
+
     async def _run_in_browser_thread(self, coro: Coroutine[Any, Any, T]) -> T:
         """Schedule a coroutine on the browser thread's loop and await the result."""
         future = asyncio.run_coroutine_threadsafe(coro, self._loop)
@@ -345,6 +362,8 @@ async def close(self):
         if self._crawler and self._loop:
             await self._run_in_browser_thread(self._crawler.close())
             self._crawler = None
+        if self._proxy and self._loop:
+            await self._run_in_browser_thread(self._close_proxy())
         if self._loop:
             self._loop.call_soon_threadsafe(self._loop.stop)
             self._loop = None
```

**File**: `backend/python/app/connectors/sources/web/fetch_strategy.py` (modified, +86/-207)
```diff
@@ -20,7 +20,7 @@
 import contextlib
 import logging
 import random
-from dataclasses import dataclass
+from dataclasses import dataclass, replace
 from typing import (
     TYPE_CHECKING,
     Any,
@@ -38,7 +38,14 @@
 import aiohttp
 
 from app.config.constants.http_status_code import HttpStatusCode
+from app.connectors.sources.web.address_guard import UnsafeAddressError, resolve_target
 from app.services.base_client import parse_retry_after
+from app.utils.url_fetcher import (
+    PublicTarget,
+    _curl_pinned_request,
+    _pinned_requests_adapter,
+    _require_pinned_peer,
+)
 
 if TYPE_CHECKING:
     from collections.abc import Iterable, Mapping
@@ -137,171 +144,6 @@ def _get_supported_profiles() -> list[str]:
 _BOT_DETECTION_CODES = {403, 999, 520, 521, 522, 523, 524, 525, 526, 527, 528, 529, 530}
 
 
-# ---------------------------------------------------------------------------
-# Strategy implementations
-# ---------------------------------------------------------------------------
-
-
-async def _try_aiohttp(
-    session: aiohttp.ClientSession,
-    url: str,
-    headers: dict,
-    timeout: int,
-    logger: logging.Logger,
-) -> Optional[FetchResponse]:
-    """Strategy 1: aiohttp — lightweight, already async."""
-    try:
-        async with session.get(
-            url, headers=headers, allow_redirects=True, timeout=aiohttp.ClientTimeout(total=timeout)
-        ) as response:
-            content_bytes = await response.read()
-            return FetchResponse(
-                status_code=response.status,
-                content_bytes=content_bytes,
-                headers=dict(response.headers),
-                final_url=str(response.url),
-                strategy="aiohttp",
-            )
-    except asyncio.TimeoutError:
-        logger.warning("⚠️ [aiohttp] Timeout fetching %s", url)
-        return None
-    except (aiohttp.ClientError, OSError) as e:
-        logger.warning(f"⚠️ [aiohttp] Connection error for {url}: {e}")
-        return None
-    except Exception as e:
-        logger.error(f"❌ [aiohttp] Unexpected error for {url}: {e}", exc_info=True)
-        return None
-
-
-def _sync_curl_cffi_fetch(
-    url: str,
-    headers: dict,
-    timeout: int,
-    use_http2: bool,
-    profiles: Optional[list] = None,
-    logger: Optional[logging.Logger] = None,
-) -> Optional[FetchResponse]:
-    """
-    Synchronous curl_cffi fetch with profile rotation.
-    Meant to be called via run_in_executor.
-    """
-    try:
-        from curl_cffi import CurlOpt
-        from curl_cffi.requests import Session
-    except ImportError:
-        if logger:
-            logger.error("❌ [curl_cffi] Not installed")
-        return None
-
-    pool = profiles or _CURL_PROFILES
-    if not pool:
-        return None
-
-    profiles_to_try = random.sample(pool, min(3, len(pool)))
-
-    for profile in profiles_to_try:
-        try:
-            with Session(impersonate=profile, timeout=timeout) as sess:
-                if not use_http2:
-                    with contextlib.suppress(Exception):
-                        _ = sess.curl.setopt(CurlOpt.HTTP_VERSION, 2)  # CURL_HTTP_VERSION_1_1
-                resp = sess.get(url, headers=headers, allow_redirects=True)
-                return FetchResponse(
-                    status_code=resp.status_code,
-                    content_bytes=resp.content,
-                    headers=dict(resp.headers),
-                    final_url=str(resp.url),
-                    strategy=f"curl_cffi({profile}, h2={use_http2})",
-                )
-        except Exception:
-            continue  # TLS error, connection reset -> try next profile
-
-    return None
-
-
-async def _try_curl_cffi(
-    url: str,
-    headers: dict,
-    timeout: int,
-    use_http2: bool,
-    logger: logging.Logger,
-) -> Optional[FetchResponse]:
-    """Strategy 2/3: curl_cffi with browser impersonation (run in executor to avoid blocking)."""
-    label = f"curl_cffi(h2={use_http2})"
-    try:

```

---

### Incident Patch 8: `94e728d3` (2026-09-29)
**Commit Message**: fix(agents): restrict execute_sql_query to allowed connectors (#3677)

The SQL tool passed the model-supplied connector_id straight to the client
builder, which loads that connector's stored credentials. Once the tool was
enabled, a prompt injection or a curious user could query any SQL connector
in the org and bypass per-record permissions on indexed tables. An empty
connector_id fell back to default config resolution, a second bypass.
create_execute_query_tool now requires an allowed_connector_ids allowlist.
The tool rejects a missing or unlisted connector_id before any client is
built.
- Agent stream: the SQL connectors in the agent's knowledge, intersected
  with the user's connector instances.
- Chat modes: the user's own SQL connector instances; empty when the mode
  disables internal knowledge.
- Instances whose orgId differs from the caller's org are excluded, since
  get_user_connector_instances does not filter on org.
- The tool is not registered when the allowlist is empty.
- The rejection message does not list the allowed IDs.

**File**: `backend/python/app/agents/agent_loop/stream_bridge.py` (modified, +9/-1)
```diff
@@ -279,7 +279,11 @@ async def run_agent_loop_stream(
     """
     from app.modules.agents.qna.chat_state import build_initial_state
     from app.utils.connector_instances import fetch_user_connector_instances
-    from app.utils.execute_query import connector_instances_have_sql
+    from app.utils.execute_query import (
+        agent_knowledge_sql_connector_ids,
+        connector_instances_have_sql,
+        sql_connector_instance_ids,
+    )
     from app.utils.fetch_slack_thread import connector_instances_have_slack
 
     # Stop Generation (Phase 3a): registered BEFORE `build_initial_state()`
@@ -324,6 +328,10 @@ async def run_agent_loop_stream(
         )
         exclude_from_state(chat_state, demo_excluded)
         await note_org_real_data(chat_state, graph_provider, user_info.get("orgId", ""), log)
+        chat_state["allowed_sql_connector_ids"] = (
+            sql_connector_instance_ids(connector_instances, user_info["orgId"])
+            & agent_knowledge_sql_connector_ids(chat_state.get("agent_knowledge"))
+        )
     except Exception as exc:
         log.error("agent-loop stream: failed to build initial state: %s", exc, exc_info=True)
         error_code, user_message = classify_exception(exc)
```

**File**: `backend/python/app/agents/agent_loop/tool_loader.py` (modified, +8/-1)
```diff
@@ -127,7 +127,13 @@ def _build_dynamic_tools(context: "AgentContext") -> list["Tool"]:
 
     config_service = state.get("config_service")
 
-    if config_service and state.get("has_sql_connector") and state.get("has_sql_knowledge"):
+    allowed_sql_connector_ids = state.get("allowed_sql_connector_ids") or frozenset()
+    if (
+        config_service
+        and state.get("has_sql_connector")
+        and state.get("has_sql_knowledge")
+        and allowed_sql_connector_ids
+    ):
         try:
             from app.utils.execute_query import create_execute_query_tool
             execute_query_tool = create_execute_query_tool(
@@ -137,6 +143,7 @@ def _build_dynamic_tools(context: "AgentContext") -> list["Tool"]:
                 conversation_id=state.get("conversation_id"),
                 blob_store=state.get("blob_store"),
                 user_id=state.get("user_id"),
+                allowed_connector_ids=allowed_sql_connector_ids,
             )
             setattr(execute_query_tool, "_original_name", "sql.execute_sql_query")
             app_name, tool_name = split_original_tool_name(execute_query_tool)
```

**File**: `backend/python/app/agents/chat_modes/bridge.py` (modified, +12/-3)
```diff
@@ -202,15 +202,21 @@ async def _fetch_available_connectors(
 
 def _apply_policy_to_chat_state(
     chat_state: dict[str, Any], policy: ChatModePolicy, web_search_config: dict[str, Any] | None,
+    sql_connector_ids: frozenset[str] = frozenset(),
 ) -> None:
     """Forces the tool-availability flags `PipesHubToolLoader`/`AgentContext.
     from_chat_state` read, per `policy.py`'s module docstring. Chat modes
     have no per-agent "knowledge scope" the way agents do, so SQL/Slack
     tool availability mirrors connector PRESENCE (`has_sql_connector`/
     `has_slack_connector`, already resolved by the caller), not a
-    knowledge-attachment concept that doesn't exist here."""
+    knowledge-attachment concept that doesn't exist here. For the same
+    reason the SQL tool's connector allowlist is the user's own SQL
+    connector instances (`sql_connector_ids`)."""
     chat_state["has_knowledge"] = policy.has_knowledge
     chat_state["has_sql_knowledge"] = policy.has_knowledge and bool(chat_state.get("has_sql_connector"))
+    chat_state["allowed_sql_connector_ids"] = (
+        sql_connector_ids if chat_state["has_sql_knowledge"] else frozenset()
+    )
     chat_state["has_slack_knowledge"] = policy.has_knowledge and bool(chat_state.get("has_slack_connector"))
     chat_state["web_search_config"] = web_search_config if policy.include_web_search else None
     chat_state["chat_mode"] = policy.name
@@ -333,7 +339,7 @@ async def run_chat_stream(  # noqa: PLR0913 - mirrors run_agent_loop_stream's ca
     """Entry point `chatbot.py::askAIStream()` calls for every `/chat/stream`
     request, regardless of mode. See module docstring."""
     from app.modules.agents.qna.chat_state import build_initial_state
-    from app.utils.execute_query import connector_instances_have_sql
+    from app.utils.execute_query import connector_instances_have_sql, sql_connector_instance_ids
     from app.utils.fetch_slack_thread import connector_instances_have_slack
     from app.modules.transformers.blob_storage import BlobStorage
 
@@ -423,7 +429,10 @@ async def run_chat_stream(  # noqa: PLR0913 - mirrors run_agent_loop_stream's ca
             "react", has_sql_connector=has_sql_connector, is_multimodal_llm=is_multimodal_llm,
             has_slack_connector=has_slack_connector, client_name=client_name,
         )
-        _apply_policy_to_chat_state(chat_state, policy, web_search_config)
+        _apply_policy_to_chat_state(
+            chat_state, policy, web_search_config,
+            sql_connector_ids=sql_connector_instance_ids(connector_instances, user_info["orgId"]),
+        )
         chat_state["instructions"] = _with_mode_instructions(chat_state.get("instructions"), policy)
         chat_state["custom_instructions"] = _resolve_custom_instructions(system_prompts_config, policy)
         chat_state["citation_ref_mapper"] = ref_mapper
```

**File**: `backend/python/app/utils/execute_query.py` (modified, +56/-3)
```diff
@@ -9,7 +9,7 @@
 
 import asyncio
 import time
-from typing import Any, Callable, Dict, List, Optional, TYPE_CHECKING
+from typing import Any, Callable, Collection, Dict, List, Optional, TYPE_CHECKING
 
 from langchain_core.tools import tool
 from pydantic import BaseModel, Field
@@ -79,6 +79,39 @@ def agent_knowledge_has_sql_connector(agent_knowledge: Optional[List[Dict[str, A
     )
 
 
+def sql_connector_instance_ids(instances: list[dict] | None, org_id: str) -> frozenset[str]:
+    """IDs of the configured SQL connector instances in *instances* that belong to *org_id*."""
+    ids: set[str] = set()
+    for instance in instances or []:
+        if not isinstance(instance, dict):
+            continue
+        if str(instance.get("type", "")).upper() not in _SQL_CONNECTOR_TYPES:
+            continue
+        if not instance.get("isConfigured"):
+            continue
+        # `get_user_connector_instances` does not filter on org, so apply the tenant check here.
+        instance_org_id = instance.get("orgId")
+        if instance_org_id and instance_org_id != org_id:
+            continue
+        instance_id = instance.get("_key") or instance.get("id")
+        if instance_id:
+            ids.add(str(instance_id))
+    return frozenset(ids)
+
+
+def agent_knowledge_sql_connector_ids(agent_knowledge: list[dict[str, Any]] | None) -> frozenset[str]:
+
+    """Connector IDs of the SQL connectors attached to the agent as knowledge."""
+    ids: set[str] = set()
+    for k in agent_knowledge or []:
+        if not isinstance(k, dict) or str(k.get("type", "")).upper() not in _SQL_CONNECTOR_TYPES:
+            continue
+        connector_id = str(k.get("connectorId") or "").strip()
+        if connector_id:
+            ids.add(connector_id)
+    return frozenset(ids)
+
+
 class ExecuteQueryArgs(BaseModel):
     """Required tool args for executing SQL queries."""
     
@@ -647,6 +680,8 @@ def create_execute_query_tool(
     conversation_id: Optional[str] = None,
     blob_store: Optional["BlobStorage"] = None,
     user_id: Optional[str] = None,
+    *,
+    allowed_connector_ids: Collection[str],
 ) -> Callable:
     """Factory function to create the execute_query tool with runtime dependencies.
     
@@ -658,10 +693,14 @@ def create_execute_query_tool(
         blob_store: Optional blob storage for saving full result CSVs
         user_id: Optional owner of the CSV export; without it the export has
             no artifact record and so no download link on local storage
+        allowed_connector_ids: The only connector instance IDs the tool may
+            query. The query runs with the connector's stored credentials, so
+            any other ID (or none) is rejected before a client is built.
         
     Returns:
         A langchain tool for executing SQL queries
     """
+    allowed = frozenset(allowed_connector_ids)
     
     @tool("execute_sql_query", args_schema=ExecuteQueryArgs)
     async def execute_sql_query_tool(
@@ -712,13 +751,27 @@ async def execute_sql_query_tool(
             connector_id,
         )
         logger.debug(f"🔍 [execute_sql_query_tool] Query: {query}")
-        
+
+        connector_id = (connector_id or "").strip()
+        if connector_id not in allowed:
+            logger.warning(
+                "🔍 [execute_sql_query_tool] Rejected connector_id=%r: not attached to this agent",
+                connector_id,
+            )
+            return {
+                "ok": False,
+                "error": (
+                    f"connector_id {connector_id!r} is not one of the SQL connectors available "
+                    "to this agent. Use the 'Connector Id' shown on the table record you are querying."
+                ),
+            }
+
         try:
             result = await _execute_query_impl(
                 query=query,
                 source_name=source_name,
                 config_service=config_service,
-                connector_instance_id=(connector_id or "").strip(
```

**File**: `backend/python/tests/unit/agents/adapter/test_sse_bridge.py` (modified, +47/-0)
```diff
@@ -586,6 +586,53 @@ async def _fake_finalizer_run(self, *, agent_success, agent_error, event_sink, a
         assert events[1].startswith("event: complete\n")
         assert json.loads(events[1].split("data: ", 1)[1].strip()) == {"answer": "42"}
 
+    async def test_sql_allowlist_is_agent_knowledge_intersected_with_user_connectors(self) -> None:
+        """Only a SQL connector that is both attached to the agent AND visible
+        to this user (in this org) may be queried by `execute_sql_query`."""
+        captured: dict[str, Any] = {}
+
+        async def _fake_create(self, context, llm, chat_mode, *, query, model_name="", session_id=None, model_key=None):
+            captured["allowed"] = context.tool_state.get("allowed_sql_connector_ids")
+            return _stream_agent(MagicMock(success=True, error=None)), MagicMock(), MagicMock(), []
+
+        async def _fake_finalizer_run(self, **kwargs):
+            return {"answer": "ok"}
+
+        user_instances = [
+            {"_key": "pg-attached", "type": "POSTGRESQL", "isConfigured": True, "orgId": "org-1"},
+            {"_key": "pg-not-attached", "type": "POSTGRESQL", "isConfigured": True, "orgId": "org-1"},
+            {"_key": "pg-other-org", "type": "POSTGRESQL", "isConfigured": True, "orgId": "org-2"},
+        ]
+        agent_knowledge = [
+            {"connectorId": "pg-attached", "type": "POSTGRESQL"},
+            {"connectorId": "pg-other-org", "type": "POSTGRESQL"},
+            {"connectorId": "pg-user-cannot-see", "type": "POSTGRESQL"},
+        ]
+        with (
+            patch(
+                "app.utils.connector_instances.fetch_user_connector_instances",
+                new=AsyncMock(return_value=user_instances),
+            ),
+            patch(
+                "app.modules.agents.qna.chat_state.build_initial_state",
+                return_value={
+                    "org_id": "org-1", "user_id": "user-1", "query": "hello",
+                    "agent_knowledge": agent_knowledge,
+                },
+            ),
+            patch(
+                "app.agents.agent_loop.stream_bridge.PipesHubAgentFactory.create",
+                new=_fake_create,
+            ),
+            patch(
+                "app.agents.agent_loop.stream_bridge.AnswerFinalizer.run",
+                new=_fake_finalizer_run,
+            ),
+        ):
+            [chunk async for chunk in run_agent_loop_stream(**self._base_kwargs())]
+
+        assert captured["allowed"] == {"pg-attached"}
+
     async def test_terminal_answer_streamed_live_before_finalizer_runs(self) -> None:
         """`_produce()` must drive the agent via `agent.stream(goal)` and
         feed every yielded event through `TerminalAnswerStreamer` — a
```

---

### Incident Patch 9: `a7f653e4` (2026-09-29)
**Commit Message**: fix(records): scope DELETE /api/v1/records/{id} to the caller's org (#3667)

* fix(records): scope DELETE /api/v1/records/{id} to the caller's org
The delete route passed only user_id to the graph provider, and both
providers looked the record up by ID alone. Any authenticated user could
hard-delete another org's connector records (graph node plus vectors via
the deleteRecord event) by guessing or leaking a record ID.
Read orgId from the auth state, reject the request if it is missing, and
pass it through IGraphDBProvider.delete_record. Neo4j and Arango now return
404 for a record whose orgId differs from the caller's, the same response
as a missing record. Internal deletes by external id pass the record's own
org.

* fix : require record access before DELETE /api/v1/records/{id}
Same-org users could delete connector records they had no access to,
since only KB records were role-checked and refuse record deletion with an empty org id

**File**: `backend/python/app/connectors/api/router.py` (modified, +19/-1)
```diff
@@ -2244,11 +2244,29 @@ async def delete_record(
         container = request.app.container
         logger = container.logger()
         user_id = request.state.user.get("userId")
+        org_id = request.state.user.get("orgId")
+        if not user_id or not org_id:
+            raise HTTPException(
+                status_code=HttpStatusCode.UNAUTHORIZED.value,
+                detail="User not authenticated",
+            )
         logger.info(f"🗑️ Attempting to delete record {record_id}")
 
+        has_access = await graph_provider.check_record_access_with_details(
+            user_id=user_id,
+            org_id=org_id,
+            record_id=record_id,
+        )
+        if not has_access:
+            raise HTTPException(
+                status_code=HttpStatusCode.NOT_FOUND.value,
+                detail="You do not have access to this record",
+            )
+
         result = await graph_provider.delete_record(
             record_id=record_id,
-            user_id=user_id
+            user_id=user_id,
+            org_id=org_id,
         )
 
         if result["success"]:
```

**File**: `backend/python/app/services/graph_db/arango/arango_http_provider.py` (modified, +6/-2)
```diff
@@ -7873,6 +7873,7 @@ async def delete_record(
         self,
         record_id: str,
         user_id: str,
+        org_id: str,
         transaction: str | None = None
     ) -> dict:
         """
@@ -7881,6 +7882,7 @@ async def delete_record(
         Args:
             record_id: Record ID to delete
             user_id: User ID performing the deletion
+            org_id: Caller's organization; records outside it are reported as not found
             transaction: Optional transaction ID
 
         Returns:
@@ -7895,7 +7897,9 @@ async def delete_record(
                 key=record_id,
                 txn_id=transaction
             )
-            if not record:
+            # The per-connector role checks below are not org-scoped (Drive domain/anyone
+            # grants, Gmail address match), so tenancy has to be enforced here.
+            if not org_id or not record or record.get("orgId") != org_id:
                 return {
                     "success": False,
                     "code": 404,
@@ -7961,7 +7965,7 @@ async def delete_record_by_external_id(
                 return
 
             # Delete record using the record's internal ID and user_id
-            deletion_result = await self.delete_record(record.id, user_id, transaction=transaction)
+            deletion_result = await self.delete_record(record.id, user_id, record.org_id, transaction=transaction)
 
             # Check if deletion was successful
             if deletion_result.get("success"):
```

**File**: `backend/python/app/services/graph_db/interface/graph_db_provider.py` (modified, +2/-0)
```diff
@@ -3639,6 +3639,7 @@ async def delete_record(
         self,
         record_id: str,
         user_id: str,
+        org_id: str,
         transaction: str | None = None
     ) -> dict:
         """
@@ -3647,6 +3648,7 @@ async def delete_record(
         Args:
             record_id (str): Record ID to delete
             user_id (str): User ID performing the deletion
+            org_id (str): Caller's organization; records outside it are reported as not found
             transaction (Optional[str]): Optional transaction context
 
         Returns:
```

**File**: `backend/python/app/services/graph_db/neo4j/neo4j_provider.py` (modified, +4/-2)
```diff
@@ -7206,13 +7206,15 @@ async def delete_record(
         self,
         record_id: str,
         user_id: str,
+        org_id: str,
         transaction: str | None = None
     ) -> dict:
         """Main entry point for record deletion. KB records require OWNER, WRITER, or FILEORGANIZER."""
         try:
             # Get record to determine connector type
             record = await self.get_document(record_id, CollectionNames.RECORDS.value, transaction)
-            if not record:
+            # A record in another org is reported exactly like a missing one so IDs can't be probed.
+            if not org_id or not record or record.get("orgId") != org_id:
                 return {
                     "success": False,
                     "code": 404,
@@ -7320,7 +7322,7 @@ async def delete_record_by_external_id(
                 self.logger.warning(f"⚠️ Record {external_id} not found for connector {connector_id}")
                 return
 
-            await self.delete_record(record.id, user_id, transaction)
+            await self.delete_record(record.id, user_id, record.org_id, transaction)
 
         except Exception as e:
             self.logger.error(f"❌ Delete record by external ID failed: {str(e)}")
```

**File**: `backend/python/tests/unit/connectors/api/test_router_delete_record_authz.py` (added, +138/-0)
```diff
@@ -0,0 +1,138 @@
+"""DELETE /api/v1/records/{record_id} must be scoped to the caller's org and to
+records the caller can access, and KB records additionally to the caller's
+role on the KB.
+
+The route is driven end to end against a real Neo4jProvider whose I/O is
+mocked, so the tests exercise the actual authorization decision rather than a
+stubbed provider result.
+"""
+
+from unittest.mock import AsyncMock, MagicMock
+
+import pytest
+from fastapi import HTTPException
+
+from app.config.constants.arangodb import CollectionNames
+from app.connectors.api.router import delete_record
+from app.services.graph_db.neo4j.neo4j_provider import Neo4jProvider
+
+ORG_A = "org-A"
+ORG_B = "org-B"
+RECORD_ID = "rec-1"
+
+CONNECTOR = {"connectorName": "DRIVE", "origin": "CONNECTOR"}
+KB = {"connectorName": "KB", "origin": "UPLOAD"}
+
+
+def _request(user_id: str = "user-a", org_id: str | None = ORG_A) -> MagicMock:
+    user = {"userId": user_id, "orgId": org_id}
+    req = MagicMock()
+    req.state.user.get = lambda k, default=None: user.get(k, default)
+    req.app.container.logger.return_value = MagicMock()
+    return req
+
+
+def _provider(
+    record_org: str, kind: dict, kb_role: str | None = "OWNER", has_access: bool = True
+) -> Neo4jProvider:
+    record = {
+        "id": RECORD_ID,
+        "orgId": record_org,
+        "connectorId": "conn-1",
+        "virtualRecordId": "vr-1",
+        **kind,
+    }
+
+    async def get_document(key: str, collection: str, transaction: str | None = None) -> dict | None:
+        return dict(record) if collection == CollectionNames.RECORDS.value else None
+
+    provider = Neo4jProvider(MagicMock(), MagicMock())
+    provider.client = AsyncMock()
+    provider.get_document = AsyncMock(side_effect=get_document)
+    provider.check_record_access_with_details = AsyncMock(
+        return_value={"record": {"id": RECORD_ID}} if has_access else None
+    )
+    provider._get_kb_context_for_record = AsyncMock(return_value={"kb_id": "kb-1"})
+    provider.get_user_by_user_id = AsyncMock(return_value={"id": "ukey-a"})
+    provider.get_user_kb_permission = AsyncMock(return_value=kb_role)
+    provider.delete_records_and_relations = AsyncMock()
+    provider._create_deleted_record_event_payload = AsyncMock(
+        return_value={"recordId": RECORD_ID, "virtualRecordId": "vr-1"}
+    )
+    return provider
+
+
+def _assert_untouched(provider: Neo4jProvider, kafka: AsyncMock) -> None:
+    provider.delete_records_and_relations.assert_not_awaited()
+    kafka.publish_event.assert_not_awaited()
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("kind", [CONNECTOR, KB], ids=["connector", "kb"])
+async def test_cross_org_delete_is_404_and_leaves_graph_and_vectors(kind: dict) -> None:
+    provider = _provider(record_org=ORG_B, kind=kind, kb_role="OWNER")
+    kafka = AsyncMock()
+
+    with pytest.raises(HTTPException) as exc:
+        await delete_record(RECORD_ID, _request(org_id=ORG_A), provider, kafka)
+
+    assert exc.value.status_code == 404
+    _assert_untouched(provider, kafka)
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("kind", [CONNECTOR, KB], ids=["connector", "kb"])
+async def test_same_org_user_without_access_gets_404(kind: dict) -> None:
+    provider = _provider(record_org=ORG_A, kind=kind, kb_role="OWNER", has_access=False)
+    kafka = AsyncMock()
+
+    with pytest.raises(HTTPException) as exc:
+        await delete_record(RECORD_ID, _request(user_id="user-a", org_id=ORG_A), provider, kafka)
+
+    assert exc.value.status_code == 404
+    _assert_untouched(provider, kafka)
+    provider.check_record_access_with_details.assert_awaited_once_with(
+        user_id="user-a", org_id=ORG_A, record_id=RECORD_ID
+    )
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("kb_role", ["READER", "COMMENTER", None])
+async def test_kb_record_without_write_role_gets_403(kb_role: str | None) -> None:
+    provider = _provider(record_org=ORG_A, kind=KB, kb_role=kb_role)
+    kafka = Asyn
```

---

### Incident Patch 10: `d32bb7bf` (2026-09-29)
**Commit Message**: fix(connectors): reject cross-org records in stream_record instead of widening to the record's org (#3675)

**File**: `backend/python/app/connectors/api/router.py` (modified, +12/-11)
```diff
@@ -601,10 +601,11 @@ async def get_record_content_internal(
         if not record:
             raise HTTPException(status_code=HttpStatusCode.NOT_FOUND.value, detail="Record not found")
 
-        # Org mismatch: reject rather than widen (unlike the admin path).
-        if record.org_id and record.org_id != org_id:
+        # Org mismatch: reject rather than widen. A record with no org cannot be
+        # confined to one, so it is refused as well.
+        if not record.org_id or record.org_id != org_id:
             logger.warning(
-                "get_record_content_internal: org mismatch record=%s record_org=%s token_org=%s",
+                "get_record_content_internal: org mismatch record=%s record_org=%r token_org=%s",
                 record_id, record.org_id, org_id,
             )
             raise HTTPException(
@@ -1422,14 +1423,14 @@ async def stream_record(
         if not record:
             raise HTTPException(status_code=HttpStatusCode.NOT_FOUND.value, detail="Record not found")
 
-        # Validate that the org_id matches the record's org_id
-        if record and record.org_id and record.org_id != org_id:
-            logger.warning(f"OrgId mismatch: JWT has {org_id}, but record has {record.org_id}. Using record's org_id.")
-            org_id = record.org_id
-            org = await graph_provider.get_document(org_id, CollectionNames.ORGS.value)
-            if not org:
-                raise HTTPException(status_code=HttpStatusCode.NOT_FOUND.value, detail="Organization not found")
-
+        # Same response as a missing record, so a caller cannot probe another org's record IDs.
+        # A record with no org cannot be confined to one, so it is refused as well.
+        if not record.org_id or record.org_id != org_id:
+            logger.warning(
+                "stream_record: org mismatch record=%s record_org=%r token_org=%s",
+                record_id, record.org_id, org_id,
+            )
+            raise HTTPException(status_code=HttpStatusCode.NOT_FOUND.value, detail="Record not found")
 
         # Permission check: Verify user has access to this record
         # This handles both KB-level and direct record permissions
```

**File**: `backend/python/tests/unit/connectors/api/test_router_deep1.py` (modified, +23/-12)
```diff
@@ -1438,24 +1438,35 @@ async def test_record_not_found_raises_404(self):
         assert exc.value.status_code == HttpStatusCode.NOT_FOUND.value
 
     @pytest.mark.asyncio
-    async def test_org_mismatch_retries_with_record_org(self):
-        """JWT org_id differs from record org_id -> retry with record's org."""
+    async def test_org_mismatch_is_404_without_widening(self):
+        """JWT org_id differs from record org_id -> 404; the record's org is never used."""
         req, record, gp, cs, conn_obj = self._setup(is_google=False)
         record.org_id = "org-2"
+        gp.check_record_access_with_details = AsyncMock(return_value={"id": "rec-1"})
 
-        call_count = [0]
-        async def get_doc(doc_id, collection):
-            call_count[0] += 1
-            if collection == CollectionNames.ORGS.value:
-                return {"_key": doc_id}
-            return {"_key": "conn-1", "name": "Drive", "type": "GD", "isActive": True}
+        from app.connectors.api.router import stream_record
+        with pytest.raises(HTTPException) as exc:
+            await stream_record(req, "rec-1", convertTo=None, version=None, graph_provider=gp, config_service=cs)
+        assert exc.value.status_code == HttpStatusCode.NOT_FOUND.value
+        gp.check_record_access_with_details.assert_not_awaited()
+        org_lookups = [
+            c for c in gp.get_document.await_args_list
+            if CollectionNames.ORGS.value in c.args
+        ]
+        assert all("org-2" not in c.args for c in org_lookups)
 
-        gp.get_document = AsyncMock(side_effect=get_doc)
+    @pytest.mark.asyncio
+    async def test_record_without_org_is_404(self):
+        """A record with no org_id cannot be confined to the caller's org -> 404."""
+        req, record, gp, cs, conn_obj = self._setup(is_google=False)
+        record.org_id = ""
+        gp.check_record_access_with_details = AsyncMock(return_value={"id": "rec-1"})
 
         from app.connectors.api.router import stream_record
-        result = await stream_record(req, "rec-1", convertTo=None, version=None, graph_provider=gp, config_service=cs)
-        # Should have fetched org-2 after mismatch
-        assert call_count[0] >= 2
+        with pytest.raises(HTTPException) as exc:
+            await stream_record(req, "rec-1", convertTo=None, version=None, graph_provider=gp, config_service=cs)
+        assert exc.value.status_code == HttpStatusCode.NOT_FOUND.value
+        gp.check_record_access_with_details.assert_not_awaited()
 
     @pytest.mark.asyncio
     async def test_access_denied_raises_403(self):
```

**File**: `backend/python/tests/unit/connectors/api/test_router_service_token_routes.py` (modified, +7/-0)
```diff
@@ -70,6 +70,13 @@ async def test_other_org_record_raises_403(self):
             await _get_content(_RECORD_CONTENT_CLAIMS, _graph_provider(_record(org_id="org-2")))
         assert exc.value.status_code == HttpStatusCode.FORBIDDEN.value
 
+    async def test_record_without_org_raises_403(self):
+        graph_provider = _graph_provider(_record(org_id=""))
+        with pytest.raises(HTTPException) as exc:
+            await _get_content(_RECORD_CONTENT_CLAIMS, graph_provider)
+        assert exc.value.status_code == HttpStatusCode.FORBIDDEN.value
+        graph_provider.check_record_access_with_details.assert_not_awaited()
+
     async def test_acl_denied_raises_403(self):
         graph_provider = _graph_provider(_record(), access=False)
         with pytest.raises(HTTPException) as exc:
```

#### Recent Merged Pull Requests:
- **PR #3729** (2026-09-30): fix(kg): follow-up fixes for entity tools and entity indexing (@tushar1245)
- **PR #3728** (2026-09-30): fix(security): encode ids where they go into service URLs (GHSA-rfmg-j28j-f635) (@rish231294)
- **PR #3725** (2026-09-30): fix(security): fail closed when SANDBOX_MODE is unset or unknown (GHSA-x783-vmqc-7jc9) (@rish231294)
- **PR #3723** (2026-09-30): fix(security): bind signed download URLs to the redeeming user (GHSA-cf48-qh3f-g3g9) (@rish231294)
- **PR #3722** (2026-09-30): add permission to the slack tools (@jatingaur18)
- **PR #3677** (2026-09-29): fix(agents): restrict execute_sql_query to allowed connectors (@tushar1245)
- **PR #3675** (2026-09-29): fix(connectors): reject cross-org records in stream_record instead of… (@tushar1245)
- **PR #3674** (2026-09-29): fix(connectors): keep Web and RSS fetches off non-public addresses (@siddhantota)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
