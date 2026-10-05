# Forensic Learning Record (Deep Inspection): metatool-ai/metamcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/metatool-ai-metamcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/metatool-ai/metamcp](https://github.com/metatool-ai/metamcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:44:03.640Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `metatool-ai/metamcp`
- **Description**: MCP Aggregator, Orchestrator, Middleware, Gateway in one docker
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 2695 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/backend/drizzle.config.ts`
```
/* eslint-disable @typescript-eslint/no-non-null-assertion */

import { defineConfig } from "drizzle-kit";
export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    // @ts-expect-error outside dir
    url: process.env.DATABASE_URL!,
  },
});

```

### Core Architecture Module: `apps/backend/eslint.config.js`
```
import { expressConfig } from "@repo/eslint-config/express";

export default expressConfig;

```

### Core Architecture Module: `apps/backend/src/auth.ts`
```
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth, GenericOAuthConfig } from "better-auth/plugins";

import { db } from "./db/index";
import * as schema from "./db/schema";
import { configService } from "./lib/config.service";
import logger from "./utils/logger";

// Provide default values for development
if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error("BETTER_AUTH_SECRET environment variable is required");
}
if (!process.env.APP_URL) {
  throw new Error("APP_URL environment variable is required");
}

const BETTER_AUTH_SECRET = process.env.BETTER_AUTH_SECRET;
const BETTER_AUTH_URL = process.env.APP_URL;

// Helper function to create basic auth middleware
const createBasicAuthCheckMiddleware = () => {
  return async (request: unknown) => {
    const isBasicAuthDisabled = await configService.isBasicAuthDisabled();
    if (isBasicAuthDisabled) {
      throw new Error(
        "Basic email/password authentication is currently disabled. Please use SSO/OIDC authentication instead.",
      );
    }
    return { request };
  };
};

// OIDC Provider configuration - optional, only if environment variables are provided
const oidcProviders: GenericOAuthConfig[] = [];

// Add OIDC provider if configured
if (process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET) {
  const oidcConfig: GenericOAuthConfig = {
    providerId: process.env.OIDC_PROVIDER_ID || "oidc",
    clientId: process.env.OIDC_CLIENT_ID,
    clientSecret: process.env.OIDC_CLIENT_SECRET,
    scopes: (process.env.OIDC_SCOPES || "openid email profile").split(" "),
    pkce: process.env.OIDC_PKCE !== "false", // Enable PKCE by default for security
    discoveryUrl: process.env.OIDC_DISCOVERY_URL,
    authorizationUrl: process.env.OIDC_AUTHORIZATION_URL, //this is required due to a bug in better-auth: https://github.com/better-auth/better-auth/issues/3278
  };

  oidcProviders.push(oidcConfig);
  logger.info(`✓ OIDC Provider configured: ${oidcConfig.providerId}`);
}

// Default trusted origins for development
const DEFAULT_TRUSTED_ORIGINS = [
  "http://localhost",
  "http://localhost:3000",
  "http://localhost:12008",
  "http://127.0.0.1",
  "http://127.0.0.1:12008",
  "http://127.0.0.1:3000",
  "http://0.0.0.0",
  "http://0.0.0.0:3000",
  "http://0.0.0.0:12008",
];

// Parse extra trusted origins from environment variable (comma-separated)
const extraTrustedOrigins = process.env.EXTRA_TRUSTED_ORIGINS
  ? process.env.EXTRA_TRUSTED_ORIGINS.split(",")
      .map((origin: string) => origin.trim())
      .filter(Boolean)
  : [];

const trustedOrigins = [...DEFAULT_TRUSTED_ORIGINS, ...extraTrustedOrigins];

export const auth = betterAuth({
  secret: BETTER_AUTH_SECRET,
  baseURL: BETTER_AUTH_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.usersTable,
      session: schema.sessionsTable,
      account: schema.accountsTable,
      verification: schema.verificationsTable,
    },
  }),
  trustedOrigins,
  plugins: [
    // Add generic OAuth plugin for OIDC support
    ...(oidcProviders.length > 0
      ? [genericOAuth({ config: oidcProviders })]
      : []),
  ],
  emailAndPassword: {
    enabled: true, // This will be dynamically controlled by middleware
    requireEmailVerification: false, // Set to true if you want email verification
  },
  account: {
    accountLinking: {
      enabled: true,
      // Allow linking accounts with the same email address
      allowDifferentEmails: false,
      // Trusted providers for automatic linking (add your OIDC provider here)
      trustedProviders: oidcProviders.map((p) => p.providerId),
      // Allow automatic linking for same email addresses
      allowSameEmail: true,
      // Require email verification for account linking
      requireEmailVerification: false,
    },
  },
  session: {
    // Session lifetimes are env-var configurable so deployers can tune
    // how often users re-touch the gateway via SSO without rebuilding
    // the image. Defaults match the previous hardcoded values exactly,
    // so this is a strict superset — no behavior change for existing
    // installs that don't set the env vars.
    expiresIn: (() => {
      const raw = process.env.BETTER_AUTH_SESSION_EXPIRES_IN_SECONDS;
      const parsed = raw ? Number.parseInt(raw, 10) : NaN;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 60 * 60 * 24 * 7; // 7 days (default)
    })(),
    updateAge: (() => {
      const raw = process.env.BETTER_AUTH_SESSION_UPDATE_AGE_SECONDS;
      const parsed = raw ? Number.parseInt(raw, 10) : NaN;
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 60 * 60 * 24; // 1 day (default — how often the session expiry is bumped on access)
    })(),
  },
  user: {
    additionalFields: {
      emailVerified: {
        type: "boolean",
        defaultValue: false,
      },
    },
  },
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
    },
  },
  logger: {
    level: "debug", // Enable debug logging
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, context) => {
          // Check if signup is disabled based on the registration method
          const isSignupDisabled = await configService.isSignupDisabled();
          const isSsoSignupDisabled = await configService.isSsoSignupDisabled();

          // Determine if this is an SSO/OAuth registration by checking the request path
          // OAuth/SSO registrations typically come through callback endpoints
          const isSsoRegistration =
            context?.path?.includes("/callback/") ||
            context?.path?.includes("/oauth/") ||
            context?.path?.includes("/oidc/");

          if (isSsoRegistration) {
            if (isSsoSignupDisabled) {
              throw new Error(
                "New user registration via SSO/OAuth is currently disabled.",
              );
            }
          } else {
            if (isSignupDisabled) {
              throw new Error("New user registration is currently disabled.");
            }
          }

          return { data: user };
        },
      },
    },
  },
  // Add middleware to check basic auth setting
  middleware: [
    {
      path: "/sign-in/email",
      middleware: createBasicAuthCheckMiddleware(),
    },
    {
      path: "/sign-up/email",
      middleware: createBasicAuthCheckMiddleware(),
    },
    {
      path: "/forgot-password",
      middleware: createBasicAuthCheckMiddleware(),
    },
    {
      path: "/reset-password",
      middleware: createBasicAuthCheckMiddleware(),
    },
  ],
});

console.log("✓ Better Auth instance created successfully");
console.log(`✓ OIDC Providers configured: ${oidcProviders.length}`);

export type Session = typeof auth.$Infer.Session;
// Note: User type needs to be inferred from Session.user
export type User = typeof auth.$Infer.Session.user;

```

### Core Architecture Module: `apps/backend/src/db/index.ts`
```
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import logger from "@/utils/logger";

import * as schema from "./schema";

const { DATABASE_URL, POSTGRES_CA_CERT } = process.env;

if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

// Use an explicit pg Pool so we can attach a global error handler.
// This prevents unhandled 'error' events from bringing down the Node process
// when the database terminates idle connections (e.g., during maintenance).
export const pool = new Pool({
  connectionString: DATABASE_URL,
  ...(POSTGRES_CA_CERT && {
    ssl: {
      ca: POSTGRES_CA_CERT,
      rejectUnauthorized: true,
    },
  }),
});

pool.on("error", (err) => {
  // Log and continue so the process doesn't crash on idle client errors.
  // pg-pool will create a new client on the next checkout automatically.
  logger.error("PostgreSQL pool error (ignored):", err);
});

export const db = drizzle(pool, { schema });

```

### Core Architecture Module: `apps/backend/src/db/repositories/api-keys.repo.ts`
```
import { ApiKeyCreateInput, ApiKeyUpdateInput } from "@repo/zod-types";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { customAlphabet } from "nanoid";

import { db } from "../index";
import { apiKeysTable } from "../schema";

const nanoid = customAlphabet(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz",
  64,
);

export class ApiKeysRepository {
  /**
   * Generate a new API key with the specified format: sk_mt_{64-char-nanoid}
   */
  private generateApiKey(): string {
    const keyPart = nanoid();
    const key = `sk_mt_${keyPart}`;

    return key;
  }

  async create(input: ApiKeyCreateInput): Promise<{
    uuid: string;
    name: string;
    key: string;
    user_id: string | null;
    created_at: Date;
  }> {
    const key = this.generateApiKey();

    const [createdApiKey] = await db
      .insert(apiKeysTable)
      .values({
        name: input.name,
        key: key,
        user_id: input.user_id,
        is_active: input.is_active ?? true,
      })
      .returning({
        uuid: apiKeysTable.uuid,
        name: apiKeysTable.name,
        user_id: apiKeysTable.user_id,
        created_at: apiKeysTable.created_at,
      });

    if (!createdApiKey) {
      throw new Error("Failed to create API key");
    }

    return {
      ...createdApiKey,
      key, // Return the actual key
    };
  }

  async findByUserId(userId: string) {
    return await db
      .select({
        uuid: apiKeysTable.uuid,
        name: apiKeysTable.name,
        key: apiKeysTable.key,
        created_at: apiKeysTable.created_at,
        is_active: apiKeysTable.is_active,
      })
      .from(apiKeysTable)
      .where(eq(apiKeysTable.user_id, userId))
      .orderBy(desc(apiKeysTable.created_at));
  }

  // Find all API keys (both public and user-owned)
  async findAll() {
    return await db
      .select({
        uuid: apiKeysTable.uuid,
        name: apiKeysTable.name,
        key: apiKeysTable.key,
        created_at: apiKeysTable.created_at,
        is_active: apiKeysTable.is_active,
        user_id: apiKeysTable.user_id,
      })
      .from(apiKeysTable)
      .orderBy(desc(apiKeysTable.created_at));
  }

  // Find public API keys (no user ownership)
  async findPublicApiKeys() {
    return await db
      .select({
        uuid: apiKeysTable.uuid,
        name: apiKeysTable.name,
        key: apiKeysTable.key,
        created_at: apiKeysTable.created_at,
        is_active: apiKeysTable.is_active,
        user_id: apiKeysTable.user_id,
      })
      .from(apiKeysTable)
      .where(isNull(apiKeysTable.user_id))
      .orderBy(desc(apiKeysTable.created_at));
  }

  // Find API keys accessible to a specific user (public + user's own keys)
  async findAccessibleToUser(userId: string) {
    return await db
      .select({
        uuid: apiKeysTable.uuid,
        name: apiKeysTable.name,
        key: apiKeysTable.key,
        created_at: apiKeysTable.created_at,
        is_active: apiKeysTable.is_active,
        user_id: apiKeysTable.user_id,
      })
      .from(apiKeysTable)
      .where(
        or(
          isNull(apiKeysTable.user_id), // Public API keys
          eq(apiKeysTable.user_id, userId), // User's own API keys
        ),
      )
      .orderBy(desc(apiKeysTable.created_at));
  }

  async findByUuid(uuid: string, userId: string) {
    const [apiKey] = await db
      .select({
        uuid: apiKeysTable.uuid,
        name: apiKeysTable.name,
        key: apiKeysTable.key,
        created_at: apiKeysTable.created_at,
        is_active: apiKeysTable.is_active,
        user_id: apiKeysTable.user_id,
      })
      .from(apiKeysTable)
      .where(
        and(eq(apiKeysTable.uuid, uuid), eq(apiKeysTable.user_id, userId)),
      );

    return apiKey;
  }

  // Find API key by UUID with access control (user can access their own keys + public keys)
  async findByUuidWithAccess(uuid: string, userId?: string) {
    const [apiKey] = await db
      .select({
        uuid: apiKeysTable.uuid,
        name: apiKeysTable.name,
        key: apiKeysTable.key,
        created_at: apiKeysTable.created_at,
        is_active: apiKeysTable.is_active,
        user_id: apiKeysTable.user_id,
      })
      .from(apiKeysTable)
      .where(
        and(
          eq(apiKeysTable.uuid, uuid),
          userId
            ? or(
                isNull(apiKeysTable.user_id), // Public API keys
                eq(apiKeysTable.user_id, userId), // User's own API keys
              )
            : isNull(apiKeysTable.user_id), // Only public if no user context
        ),
      );

    return apiKey;
  }

  async validateApiKey(key: string): Promise<{
    valid: boolean;
    user_id?: string | null;
    key_uuid?: string;
  }> {
    const [apiKey] = await db
      .select({
        uuid: apiKeysTable.uuid,
        user_id: apiKeysTable.user_id,
        is_active: apiKeysTable.is_active,
      })
      .from(apiKeysTable)
      .where(eq(apiKeysTable.key, key));

    if (!apiKey) {
      return { valid: false };
    }

    // Check if key is active
    if (!apiKey.is_active) {
      return { valid: false };
    }

    return {
      valid: true,
      user_id: apiKey.user_id,
      key_uuid: apiKey.uuid,
    };
  }

  async update(uuid: string, userId: string, input: ApiKeyUpdateInput) {
    const [updatedApiKey] = await db
      .update(apiKeysTable)
      .set({
        ...(input.name && { name: input.name }),
        ...(input.is_active !== undefined && { is_active: input.is_active }),
      })
      .where(
        and(
          eq(apiKeysTable.uuid, uuid),
          or(eq(apiKeysTable.user_id, userId), isNull(apiKeysTable.user_id)),
        ),
      )
      .returning({
        uuid: apiKeysTable.uuid,
        name: apiKeysTable.name,
        key: apiKeysTable.key,
        created_at: apiKeysTable.created_at,
        is_active: apiKeysTable.is_active,
      });

    if (!updatedApiKey) {
      throw new Error("Failed to update API key or API key not found");
    }

    return updatedApiKey;
  }

  async delete(uuid: string, userId: string) {
    const [deletedApiKey] = await db
      .delete(apiKeysTable)
      .where(
        and(
          eq(apiKeysTable.uuid, uuid),
          or(eq(apiKeysTable.user_id, userId), isNull(apiKeysTable.user_id)),
        ),
      )
      .returning({
        uuid: apiKeysTable.uuid,
        name: apiKeysTable.name,
      });

    if (!deletedApiKey) {
      throw new Error("Failed to delete API key or API key not found");
    }

    return deletedApiKey;
  }
}

```

### Core Architecture Module: `apps/backend/src/db/repositories/config.repo.ts`
```
import { eq } from "drizzle-orm";

import { db } from "../index";
import { configTable } from "../schema";

export const configRepo = {
  async getConfig(
    id: string,
  ): Promise<
    { id: string; value: string; description?: string | null } | undefined
  > {
    const result = await db
      .select()
      .from(configTable)
      .where(eq(configTable.id, id));
    return result[0];
  },

  async setConfig(
    id: string,
    value: string,
    description?: string,
  ): Promise<void> {
    await db
      .insert(configTable)
      .values({
        id,
        value,
        description,
      })
      .onConflictDoUpdate({
        target: configTable.id,
        set: {
          value,
          description,
          updated_at: new Date(),
        },
      });
  },

  async getAllConfigs(): Promise<
    Array<{ id: string; value: string; description?: string | null }>
  > {
    return await db.select().from(configTable);
  },

  async deleteConfig(id: string): Promise<void> {
    await db.delete(configTable).where(eq(configTable.id, id));
  },
};

```

### Core Architecture Module: `apps/backend/src/db/repositories/endpoints.repo.ts`
```
import {
  DatabaseEndpoint,
  DatabaseEndpointWithNamespace,
  EndpointCreateInput,
  EndpointUpdateInput,
} from "@repo/zod-types";
import { and, desc, eq, isNull, or } from "drizzle-orm";

import { db } from "../index";
import { endpointsTable, namespacesTable } from "../schema";

export class EndpointsRepository {
  async create(input: EndpointCreateInput): Promise<DatabaseEndpoint> {
    const [createdEndpoint] = await db
      .insert(endpointsTable)
      .values({
        name: input.name,
        description: input.description,
        namespace_uuid: input.namespace_uuid,
        enable_api_key_auth: input.enable_api_key_auth ?? true,
        enable_max_rate: input.enable_max_rate ?? false,
        enable_client_max_rate: input.enable_client_max_rate ?? false,
        max_rate: input.max_rate,
        client_max_rate: input.client_max_rate,
        max_rate_seconds: input.max_rate_seconds,
        client_max_rate_seconds: input.client_max_rate_seconds,
        client_max_rate_strategy: input.client_max_rate_strategy,
        client_max_rate_strategy_key: input.client_max_rate_strategy_key,
        enable_oauth: input.enable_oauth ?? false,
        use_query_param_auth: input.use_query_param_auth ?? false,
        enable_metamcp_admin_tools: input.enable_metamcp_admin_tools ?? false,
        user_id: input.user_id,
      })
      .returning();

    if (!createdEndpoint) {
      throw new Error("Failed to create endpoint");
    }

    return createdEndpoint;
  }

  async findAll(): Promise<DatabaseEndpoint[]> {
    return await db
      .select({
        uuid: endpointsTable.uuid,
        name: endpointsTable.name,
        description: endpointsTable.description,
        namespace_uuid: endpointsTable.namespace_uuid,
        enable_api_key_auth: endpointsTable.enable_api_key_auth,
        enable_oauth: endpointsTable.enable_oauth,
        enable_max_rate: endpointsTable.enable_max_rate,
        enable_client_max_rate: endpointsTable.enable_client_max_rate,
        max_rate: endpointsTable.max_rate,
        client_max_rate: endpointsTable.client_max_rate,
        max_rate_seconds: endpointsTable.max_rate_seconds,
        client_max_rate_seconds: endpointsTable.client_max_rate_seconds,
        client_max_rate_strategy: endpointsTable.client_max_rate_strategy,
        client_max_rate_strategy_key:
          endpointsTable.client_max_rate_strategy_key,
        use_query_param_auth: endpointsTable.use_query_param_auth,
        enable_metamcp_admin_tools: endpointsTable.enable_metamcp_admin_tools,
        created_at: endpointsTable.created_at,
        updated_at: endpointsTable.updated_at,
        user_id: endpointsTable.user_id,
      })
      .from(endpointsTable)
      .orderBy(desc(endpointsTable.created_at));
  }

  // Find endpoints accessible to a specific user (public + user's own endpoints)
  async findAllAccessibleToUser(userId: string): Promise<DatabaseEndpoint[]> {
    return await db
      .select({
        uuid: endpointsTable.uuid,
        name: endpointsTable.name,
        description: endpointsTable.description,
        namespace_uuid: endpointsTable.namespace_uuid,
        enable_api_key_auth: endpointsTable.enable_api_key_auth,
        enable_oauth: endpointsTable.enable_oauth,
        enable_max_rate: endpointsTable.enable_max_rate,
        enable_client_max_rate: endpointsTable.enable_client_max_rate,
        max_rate: endpointsTable.max_rate,
        client_max_rate: endpointsTable.client_max_rate,
        max_rate_seconds: endpointsTable.max_rate_seconds,
        client_max_rate_seconds: endpointsTable.client_max_rate_seconds,
        client_max_rate_strategy: endpointsTable.client_max_rate_strategy,
        client_max_rate_strategy_key:
          endpointsTable.client_max_rate_strategy_key,
        use_query_param_auth: endpointsTable.use_query_param_auth,
        enable_metamcp_admin_tools: endpointsTable.enable_metamcp_admin_tools,
        created_at: endpointsTable.created_at,
        updated_at: endpointsTable.updated_at,
        user_id: endpointsTable.user_id,
      })
      .from(endpointsTable)
      .where(
        or(
          isNull(endpointsTable.user_id), // Public endpoints
          eq(endpointsTable.user_id, userId), // User's own endpoints
        ),
      )
      .orderBy(desc(endpointsTable.created_at));
  }

  // Find endpoints accessible to a specific user with namespace data (public + user's own endpoints)
  async findAllAccessibleToUserWithNamespaces(
    userId: string,
  ): Promise<DatabaseEndpointWithNamespace[]> {
    const endpointsData = await db
      .select({
        // Endpoint fields
        uuid: endpointsTable.uuid,
        name: endpointsTable.name,
        description: endpointsTable.description,
        namespace_uuid: endpointsTable.namespace_uuid,
        enable_api_key_auth: endpointsTable.enable_api_key_auth,
        enable_oauth: endpointsTable.enable_oauth,
        enable_max_rate: endpointsTable.enable_max_rate,
        enable_client_max_rate: endpointsTable.enable_client_max_rate,
        max_rate: endpointsTable.max_rate,
        client_max_rate: endpointsTable.client_max_rate,
        max_rate_seconds: endpointsTable.max_rate_seconds,
        client_max_rate_seconds: endpointsTable.client_max_rate_seconds,
        client_max_rate_strategy: endpointsTable.client_max_rate_strategy,
        client_max_rate_strategy_key:
          endpointsTable.client_max_rate_strategy_key,
        use_query_param_auth: endpointsTable.use_query_param_auth,
        enable_metamcp_admin_tools: endpointsTable.enable_metamcp_admin_tools,
        created_at: endpointsTable.created_at,
        updated_at: endpointsTable.updated_at,
        user_id: endpointsTable.user_id,
        // Namespace fields
        namespace: {
          uuid: namespacesTable.uuid,
          name: namespacesTable.name,
          description: namespacesTable.description,
          created_at: namespacesTable.created_at,
          updated_at: namespacesTable.updated_at,
          user_id: namespacesTable.user_id,
        },
      })
      .from(endpointsTable)
      .innerJoin(
        namespacesTable,
        eq(endpointsTable.namespace_uuid, namespacesTable.uuid),
      )
      .where(
        or(
          isNull(endpointsTable.user_id), // Public endpoints
          eq(endpointsTable.user_id, userId), // User's own endpoints
        ),
      )
      .orderBy(desc(endpointsTable.created_at));

    return endpointsData;
  }

  // Find only public endpoints (no user ownership)
  async findPublicEndpoints(): Promise<DatabaseEndpoint[]> {
    return await db
      .select({
        uuid: endpointsTable.uuid,
        name: endpointsTable.name,
        description: endpointsTable.description,
        namespace_uuid: endpointsTable.namespace_uuid,
        enable_api_key_auth: endpointsTable.enable_api_key_auth,
        enable_oauth: endpointsTable.enable_oauth,
        enable_max_rate: endpointsTable.enable_max_rate,
        enable_client_max_rate: endpointsTable.enable_client_max_rate,
        max_rate: endpointsTable.max_rate,
        client_max_rate: endpointsTable.client_max_rate,
        max_rate_seconds: endpointsTable.max_rate_seconds,
        client_max_rate_seconds: endpointsTable.client_max_rate_seconds,
        client_max_rate_strategy: endpointsTable.client_max_rate_strategy,
        client_max_rate_strategy_key:
          endpointsTable.client_max_rate_strategy_key,
        use_query_param_auth: endpointsTable.use_query_param_auth,
        enable_metamcp_admin_tools: endpointsTable.enable_metamcp_admin_tools,
        created_at: endpointsTable.created_at,
        updated_at: endpointsTable.updated_at,
        user_id: endpointsTable.user_id,
      })
      .from(endpointsTable)
      .where(isNull(endpointsTable.user_id))
      .orderBy(desc(endpointsTable.created_at));
  }

  // Find endpoints owned by a specific user
  async findByUserId(userId: string): Promise<DatabaseEndpoint[]> {
    return await db
      .sele
```

### Core Architecture Module: `apps/backend/src/db/repositories/index.ts`
```
export * from "./namespaces.repo";
export * from "./namespace-mappings.repo";
export * from "./endpoints.repo";
export * from "./mcp-servers.repo";
export * from "./tools.repo";
export * from "./oauth-sessions.repo";
export * from "./oauth.repo";
export * from "./api-keys.repo";
export { configRepo } from "./config.repo";

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #366** (2026-09-08): **fix(frontend): clear rate limit fields when disabled**
  *Symptoms*: ## Summary  - clear rate-limit values when endpoint rate limiting is disabled - clear hidden validation errors for both global and per-client limits - apply the fix to create and edit endpoint forms  ## Why  React Hook Form stores empty number inputs as NaN. After rate limiting is turned off, those inputs are hidden but their NaN values remain in form state, so the Zod resolver rejects the form before the tRPC mutation runs.  ## Validation  - Prettier check - frontend TypeScript check - frontend ESLint

- **Issue #358** (2026-08-30): **Optional Tool Outcome Attestation (TOA) verify gate for MCP CI / promote / register**
  *Symptoms*: ### Summary  [Tool Outcome Attestation](https://github.com/Carmel-Labs-Inc/toa) (`toa/0.1`) is an Apache-2.0 signed JSON evidence format for MCP tool delivery (reach, invoke, functional, shape, and related layers). It is not a wire protocol. It is not meant to run on every live `tools/call`.  Typical use: a CI step or promote/register gate verifies a recent attestation with offline `toa-verify` and a pinned emitter public key. Any party can emit if they sign the schema. AgentStatus is one optional emitter. No AgentStatus account is required to verify.  ### Why it might fit this project  MetaMCP aggregates and gates MCP servers. An optional verify of a recent TOA at add/promote time fits the control-plane role without per-call attestation.  ### Proposed contribution (optional, off by default)  1. Docs and/or example: run `toa-verify` after existing checks, or before promote/register. 2. Config: path to attestation JSON, required layers (for example `functional=pass`), pinned public key, max age. 3. No hard dependency on any commercial emit API.  If this direction is welcome, we can open a small PR shaped to your plugin or policy model. If not, closing this is fine.  ### Links  - Spec and verify: https://github.com/Carmel-Labs-Inc/toa - Pre-prod complementarity note: https://github.com/Carmel-Labs-Inc/toa/blob/main/docs/complementarity-preprod.md  ### Out of scope  - Replacing Inspector, OAuth, protocol conformance, or gateway ACL - Signing every production `tools/call` - Requi
  **Post-Mortem & Fix Analysis**:
  > Closing this issue.  It was filed from the wrong GitHub account by mistake. Sorry for the noise. We may open a replacement later from the correct account if the topic is still useful.

- **Issue #356** (2026-08-26): **test(w2): synthetic conflict with #355**
  *Symptoms*: Synthetic W2 gate test: edits metamcp-proxy.ts differently than #355 — should roll back in the fold.

- **Issue #355** (2026-09-13): **fix: consolidated perf-live + adversarial audit fixes (Dockerfile build crash, leaks, DB tools path)**
  *Symptoms*: ## Goals  Trying to make metamcp reliably support **40+ MCP servers in memory** — fixing a build crash, several memory/connection leaks, and the DB-backed tools hot path.  It's currently a **draft / work-in-progress**: we're validating the fold + image end-to-end before requesting review.  ## Highlights  - **Docker build is reproducible and no longer crashes**   - `ENV CI=true` so pnpm stops aborting the modules-dir removal in non-TTY builds.   - `drizzle-kit` installed as an explicit `--prod` dep at runtime — fixes the `ERR_PNPM_INCLUDED_DEPS_CONFLICT` crash-loop.   - Next.js proxy-request timeout raised 30s → 600s via a **find-based sed** (in both builder and runner stages) instead of a hardcoded `node_modules/.pnpm/...` path, so it survives lockfile bumps.  - **Boot no longer crash-loops on cold start**   - The entrypoint now waits for the backend's own `[startup] backend serving on port 12009` marker (install-aware) before starting the bounded `/health` wait — removes the fixed 90s gate that killed slow-but-healthy boots.  - **Connection-pool hardening (leaks + memory)** — the big one for 40+ servers:   - Bounded spawns, LRU eviction, finite session lifetime, per-server connection cap, default idle timeout 30m → 10m.   - Reuse a live cross-session connection on re-list instead of double-spawning.   - Clean up leaked fresh spawns when a recovery retry fails; bound `getSession`/`stdioCommandCooldowns` fan-out.   - Don't treat `-32601` (optional ping unsu

- **Issue #354** (2026-08-26): **fix(docker): make the Next.js proxy-request sed path-agnostic + fail-open**
  *Symptoms*: The proxy-request timeout bump hardcodes the pnpm store path for `next@15.5.12` with `react-dom@19.1.2`, but the lockfile can resolve a different react-dom (19.2.4) after a bump — the sed then targets a nonexistent file and exits 2, aborting the entire image build and failing :latest for every repo folded through the fork. Glob the store dir with `find` and fail-open so the timeout patch survives any dependency bump and a missing file can never brick the build.
  **Post-Mortem & Fix Analysis**:
  > Closing — stale static-path sed approach, superseded by the find-based sed in #355. Skipped by the fold anyway on conflict; consolidating to the single working PR.

- **Issue #353** (2026-08-26): **perf(proxy): consolidated prewarm + never-spawn-unused + recovery + leak cleanup (backend-only)**
  *Symptoms*: Backend-only consolidation (no Dockerfile/workflow/lockfile changes — the fold's mirror-main owns those, so this folds cleanly):  - runtime package prewarm (npm/uvx/bun) + cache self-heal - never spawn MCPs when unused (health-loop rewrite, Fix 1) - recovery cooldown + circuit-breaker bound on session-lost (Fix 2) - CallToolResult normalize before SDK validation (Fix 3, -32602) - clean up leaked fresh spawn when a recovery retry fails (memory leak) - DB tools/list serving + circuit-open surfacing + quiet DEBUG logging  Typecheck clean, 218 tests pass. Folds cleanly vs ai-dev.
  **Post-Mortem & Fix Analysis**:
  > Closing — this is an older lineage superseded by #355 (fix/consolidated-layer0-clean), which contains all of these fixes PLUS the dedup (cross-session reuse) and bounded-cooldown fixes. Folding both PRs caused #353's -X theirs version of mcp-server-pool.ts/server.ts to revert the dedup+cooldown bodies in :latest. Consolidating to the single working PR per Justin.

- **Issue #352** (2026-08-25): **perf(proxy): consolidated prewarm + never-spawn-unused + leak cleanup (Sindri x Layer0)**
  *Symptoms*: Consolidates the two working PR tracks into one foldable branch.  **From deploy/layer0-all (other bot):** - canonical `build.yml` (fork fold trigger) + reproducible Dockerfile (fail-open sed) - connect-timeout bound (`client.connect` under MCP_STDIO_CONNECT_TIMEOUT_MS) - per-namespace isolation + circuit breaker + quiet DEGRADED logging - tools-sync reap of obsolete tools  **From fix/consolidated-layer0-clean (this bot):** - runtime package prewarm (npm/uvx/bun) + cache self-heal (rule 3/13) - never spawn unused MCPs (health-loop rewrite, Fix 1) - recovery cooldown + circuit breaker bound on session-lost (Fix 2) - CallToolResult normalize before SDK validation (Fix 3, pocket-id -32602) - **leak cleanup**: a recovery retry that times out now kills its fresh spawn   (was leaking a process per failure under pid 47 → 8.45GB/8GB pileup)  Infra files take deploy/layer0-all's canonical versions; backend code takes the superset. Typecheck clean, 218 tests pass. Folds cleanly vs ai-dev.
  **Post-Mortem & Fix Analysis**:
  > Superseded by clean backend-only fold branch clean-fold-pr (no workflow/Dockerfile diff to conflict with the overlay). Reopened as fresh PR.

- **Issue #351** (2026-08-25): **perf(proxy): Layer-0 DB tools, prewarm, pool bounds + reproducible Docker build**
  *Symptoms*: Consolidated fork PR folding all upstream PR #349 + intarweb fork PR #1 work into one change set.  ## What this fixes - **Cold-start storm** — bounded spawn concurrency (`MCP_SPAWN_CONCURRENCY`, default 4) stops ~22 simultaneous spawns blowing past the connect timeout (-32001/-32000 cascade). - **Connect timeout** — `connectWithTimeout` races `client.connect()` against `MCP_STDIO_CONNECT_TIMEOUT_MS` (stdio, 120s) / `MCP_CONNECT_TIMEOUT_MS` (HTTP, 90s); releases the transport on timeout so a slow-booting server doesn't hang the fan-out. - **Connection leak / runaway spawns** — per-server cap (`MAX_CONNECTIONS_PER_SERVER`), per-namespace cap (`MAX_CONNECTIONS_PER_NAMESPACE`), LRU eviction + finite session lifetime (`SESSION_LIFETIME`, `MCP_IDLE_TIMEOUT_MS`). - **`tools/list` fan-out stall** — served from DB (`tools` table) via background sync loop (Layer-0), deadline-bounded `getSession` (`MCP_TOOLS_LIST_TIMEOUT_MS`), circuit breaker (`MCP_BREAKER_*`) so a cold backend can't hang the hot path. Obsolete tools reaped each pass. - **Reproducible Docker build** — IPv4 apt + `curl -4`, `CI=true pnpm install --frozen-lockfile`, `pnpm-lock.yaml` into runner, path-agnostic `find`-based proxy-request sed (survives pnpm store drift), Node 24 + Bun base.  ## Runtime knobs (all opt-in / overridable) `MCP_PREWARM_NPM` / `_UVX` / `_BUN`, `MCP_CACHE_HEAL`, `MCP_SPAWN_CONCURRENCY`, `MCP_STDIO_CONNECT_TIMEOUT_MS`, `MCP_CONNECT_TIMEOUT_MS`, `MAX_CONNECTIONS_PER_SERVER`, `MAX_CONNECTIONS_PER_NAME
  **Post-Mortem & Fix Analysis**:
  > Superseded by PR #352 (consolidated branch joining this + deploy/layer0-all). Content folded into #352.

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

### Incident Patch 1: `e29ce8f9` (2026-06-16)
**Commit Message**: bug fixes

**File**: `apps/backend/src/auth.ts` (modified, +2/-6)
```diff
@@ -117,16 +117,12 @@ export const auth = betterAuth({
     expiresIn: (() => {
       const raw = process.env.BETTER_AUTH_SESSION_EXPIRES_IN_SECONDS;
       const parsed = raw ? Number.parseInt(raw, 10) : NaN;
-      return Number.isFinite(parsed) && parsed > 0
-        ? parsed
-        : 60 * 60 * 24 * 7; // 7 days (default)
+      return Number.isFinite(parsed) && parsed > 0 ? parsed : 60 * 60 * 24 * 7; // 7 days (default)
     })(),
     updateAge: (() => {
       const raw = process.env.BETTER_AUTH_SESSION_UPDATE_AGE_SECONDS;
       const parsed = raw ? Number.parseInt(raw, 10) : NaN;
-      return Number.isFinite(parsed) && parsed > 0
-        ? parsed
-        : 60 * 60 * 24; // 1 day (default — how often the session expiry is bumped on access)
+      return Number.isFinite(parsed) && parsed > 0 ? parsed : 60 * 60 * 24; // 1 day (default — how often the session expiry is bumped on access)
     })(),
   },
   user: {
```

**File**: `apps/backend/src/db/repositories/__tests__/oauth.repo.test.ts` (added, +43/-0)
```diff
@@ -0,0 +1,43 @@
+import { beforeEach, describe, expect, it, vi } from "vitest";
+
+// Capture the WHERE conditions handed to each delete so we can assert the
+// cleanup issues all of its statements. The db connection is faked; the real
+// drizzle condition builders (lt/and/isNull) run against the real table
+// schemas, which is exactly the code path the regression below exercises.
+const whereCalls: unknown[] = [];
+
+vi.mock("../../index", () => {
+  return {
+    db: {
+      delete: () => ({
+        where: (condition: unknown) => {
+          whereCalls.push(condition);
+          return Promise.resolve(undefined);
+        },
+      }),
+    },
+  };
+});
+
+// Import AFTER vi.mock so the repo binds to the fake db.
+const { oauthRepository } = await import("../oauth.repo");
+
+describe("OAuthRepository.cleanupExpired", () => {
+  beforeEach(() => {
+    whereCalls.length = 0;
+  });
+
+  it("builds and runs every cleanup delete without throwing", async () => {
+    // Regression: the "refresh token is null" branch used
+    // `isNotNull(...).not()`, which throws a TypeError at query-build time
+    // because drizzle's SQL has no `.not()`. It must build via `isNull(...)`.
+    await expect(oauthRepository.cleanupExpired()).resolves.toBeUndefined();
+
+    // Three deletes: expired auth codes, fully-expired tokens, null-refresh
+    // tokens. Each must have built a WHERE condition.
+    expect(whereCalls).toHaveLength(3);
+    for (const condition of whereCalls) {
+      expect(condition).toBeDefined();
+    }
+  });
+});
```

**File**: `apps/backend/src/db/repositories/oauth.repo.ts` (modified, +2/-2)
```diff
@@ -6,7 +6,7 @@ import {
   OAuthClient,
   OAuthClientCreateInput,
 } from "@repo/zod-types";
-import { eq, lt, and, isNotNull } from "drizzle-orm";
+import { and, eq, isNull, lt } from "drizzle-orm";
 
 import { db } from "../index";
 import {
@@ -144,7 +144,7 @@ export class OAuthRepository {
         .where(
           and(
             lt(oauthAccessTokensTable.expires_at, now),
-            isNotNull(oauthAccessTokensTable.refresh_token).not(),
+            isNull(oauthAccessTokensTable.refresh_token),
           ),
         ),
     ]);
```

**File**: `apps/backend/src/index.ts` (modified, +3/-3)
```diff
@@ -120,9 +120,8 @@ const gracefulShutdown = async (signal: string) => {
   console.log(`${signal} received, cleaning up MCP server pools...`);
   try {
     const { mcpServerPool } = await import("./lib/metamcp");
-    const { metaMcpServerPool } = await import(
-      "./lib/metamcp/metamcp-server-pool"
-    );
+    const { metaMcpServerPool } =
+      await import("./lib/metamcp/metamcp-server-pool");
     await Promise.allSettled([
       mcpServerPool.cleanupAll(),
       metaMcpServerPool.cleanupAll(),
@@ -131,6 +130,7 @@ const gracefulShutdown = async (signal: string) => {
   } catch (error) {
     console.error("Error during graceful shutdown:", error);
   }
+  // eslint-disable-next-line no-process-exit -- intentional: terminate the process after async cleanup in the shutdown signal handler
   process.exit(0);
 };
 
```

**File**: `apps/backend/src/lib/admin-mcp/resolve-user.ts` (modified, +1/-2)
```diff
@@ -1,7 +1,6 @@
 import { db } from "../../db/index";
-import { usersTable } from "../../db/schema";
-
 import { ApiKeysRepository } from "../../db/repositories/api-keys.repo";
+import { usersTable } from "../../db/schema";
 
 const apiKeysRepository = new ApiKeysRepository();
 
```

---

### Incident Patch 2: `e52821ed` (2026-06-16)
**Commit Message**: upgrades and fixes

**File**: `apps/backend/package.json` (modified, +2/-3)
```diff
@@ -22,7 +22,7 @@
     "db:migrate:dev": "dotenv -e ../../.env.local -- drizzle-kit migrate"
   },
   "dependencies": {
-    "@modelcontextprotocol/sdk": "1.16.0",
+    "@modelcontextprotocol/sdk": "1.29.0",
     "@repo/trpc": "workspace:*",
     "@repo/zod-types": "workspace:*",
     "@trpc/server": "^11.4.1",
@@ -39,8 +39,7 @@
     "pg": "^8.16.0",
     "shell-quote": "^1.8.3",
     "spawn-rx": "^5.1.2",
-    "zod": "^3.25.64",
-    "zod-to-json-schema": "^3.25.0"
+    "zod": "^4.4.3"
   },
   "devDependencies": {
     "@repo/eslint-config": "workspace:*",
```

**File**: `apps/backend/src/db/repositories/mcp-servers.repo.ts` (modified, +4/-2)
```diff
@@ -257,9 +257,11 @@ export class McpServersRepository {
     const updated = await db
       .update(mcpServersTable)
       .set({
-        error_status: McpServerErrorStatusEnum.Enum.NONE,
+        error_status: McpServerErrorStatusEnum.enum.NONE,
       })
-      .where(eq(mcpServersTable.error_status, McpServerErrorStatusEnum.Enum.ERROR))
+      .where(
+        eq(mcpServersTable.error_status, McpServerErrorStatusEnum.enum.ERROR),
+      )
       .returning();
 
     return updated.length;
```

**File**: `apps/backend/src/db/schema.ts` (modified, +14/-7)
```diff
@@ -19,17 +19,24 @@ import {
   uuid,
 } from "drizzle-orm/pg-core";
 
+// zod v4 types `ZodEnum.options` as a plain array, but drizzle's pgEnum requires
+// a non-empty tuple. Re-assert the shape while preserving the literal union so
+// the generated columns keep their narrow enum types.
+function toEnumTuple<T extends string>(options: readonly T[]): [T, ...T[]] {
+  return options as unknown as [T, ...T[]];
+}
+
 export const mcpServerTypeEnum = pgEnum(
   "mcp_server_type",
-  McpServerTypeEnum.options,
+  toEnumTuple(McpServerTypeEnum.options),
 );
 export const mcpServerStatusEnum = pgEnum(
   "mcp_server_status",
-  McpServerStatusEnum.options,
+  toEnumTuple(McpServerStatusEnum.options),
 );
 export const mcpServerErrorStatusEnum = pgEnum(
   "mcp_server_error_status",
-  McpServerErrorStatusEnum.options,
+  toEnumTuple(McpServerErrorStatusEnum.options),
 );
 export const mcpRequestAuditStatusEnum = pgEnum("mcp_request_audit_status", [
   "SUCCESS",
@@ -44,7 +51,7 @@ export const mcpServersTable = pgTable(
     description: text("description"),
     type: mcpServerTypeEnum("type")
       .notNull()
-      .default(McpServerTypeEnum.Enum.STDIO),
+      .default(McpServerTypeEnum.enum.STDIO),
     command: text("command"),
     args: text("args")
       .array()
@@ -57,7 +64,7 @@ export const mcpServersTable = pgTable(
     url: text("url"),
     error_status: mcpServerErrorStatusEnum("error_status")
       .notNull()
-      .default(McpServerErrorStatusEnum.Enum.NONE),
+      .default(McpServerErrorStatusEnum.enum.NONE),
     created_at: timestamp("created_at", { withTimezone: true })
       .notNull()
       .defaultNow(),
@@ -321,7 +328,7 @@ export const namespaceServerMappingsTable = pgTable(
       .references(() => mcpServersTable.uuid, { onDelete: "cascade" }),
     status: mcpServerStatusEnum("status")
       .notNull()
-      .default(McpServerStatusEnum.Enum.ACTIVE),
+      .default(McpServerStatusEnum.enum.ACTIVE),
     created_at: timestamp("created_at", { withTimezone: true })
       .notNull()
       .defaultNow(),
@@ -357,7 +364,7 @@ export const namespaceToolMappingsTable = pgTable(
       .references(() => mcpServersTable.uuid, { onDelete: "cascade" }),
     status: mcpServerStatusEnum("status")
       .notNull()
-      .default(McpServerStatusEnum.Enum.ACTIVE),
+      .default(McpServerStatusEnum.enum.ACTIVE),
     override_name: text("override_name"),
     override_title: text("override_title"),
     override_description: text("override_description"),
```

**File**: `apps/backend/src/lib/admin-mcp/zod-to-mcp-schema.ts` (modified, +13/-15)
```diff
@@ -1,19 +1,17 @@
-import type { ZodTypeAny } from "zod";
-import { zodToJsonSchema } from "zod-to-json-schema";
+import { z, type ZodType } from "zod";
 
-export function zodToMcpInputSchema(schema: ZodTypeAny): Record<string, unknown> {
-  // zod-to-json-schema's return-type inference recurses too deeply on some zod
-  // 3.25 schemas (TS2589); the runtime result is unaffected, so call through a
-  // narrowed function signature to stop the deep instantiation.
-  const toJsonSchema = zodToJsonSchema as unknown as (
-    s: ZodTypeAny,
-    opts?: Record<string, unknown>,
-  ) => Record<string, unknown>;
-  const jsonSchema = toJsonSchema(schema, {
-    $refStrategy: "none",
-    target: "openApi3",
-  });
+export function zodToMcpInputSchema(schema: ZodType): Record<string, unknown> {
+  // zod v4 ships native JSON Schema conversion, replacing the external
+  // zod-to-json-schema package. Inline reused subschemas (no $ref/$defs) and
+  // tolerate unrepresentable nodes (e.g. z.any(), z.date()) so the MCP tool
+  // inputSchema stays a single self-contained object.
+  const jsonSchema = z.toJSONSchema(schema, {
+    target: "draft-7",
+    io: "input",
+    reused: "inline",
+    unrepresentable: "any",
+  }) as Record<string, unknown>;
 
-  const { $schema: _, ...rest } = jsonSchema as Record<string, unknown>;
+  const { $schema: _schema, ...rest } = jsonSchema;
   return rest;
 }
```

**File**: `apps/backend/src/lib/bootstrap.service.ts` (modified, +2/-2)
```diff
@@ -989,7 +989,7 @@ export async function initializeEnvironmentConfiguration(): Promise<void> {
   console.log("🔧 Setting registration controls...");
   try {
     await upsertConfig(
-      ConfigKeyEnum.Enum.DISABLE_SIGNUP,
+      ConfigKeyEnum.enum.DISABLE_SIGNUP,
       config.disableUiRegistration.toString(),
       "Whether new user signup is disabled",
     );
@@ -999,7 +999,7 @@ export async function initializeEnvironmentConfiguration(): Promise<void> {
 
   try {
     await upsertConfig(
-      ConfigKeyEnum.Enum.DISABLE_SSO_SIGNUP,
+      ConfigKeyEnum.enum.DISABLE_SSO_SIGNUP,
       config.disableSsoRegistration.toString(),
       "Whether new user signup via SSO/OAuth is disabled",
     );
```

---

### Incident Patch 3: `7559e1c8` (2026-06-15)
**Commit Message**: Merge pull request #301 from raphaelbarreiros/fix/oauth-post-auth-retry-csrf

fix(oauth): post-auth retry + state CSRF validation (closes #298, #299)

Stacked on #295. Adds: retry of the initial tools/list after token exchange to
ride out the upstream session-establishment race (recoverFromPostAuthRace +
attemptConnect refactor in client.ts), per-OAuth-session expected_state
persistence, and server-side state validation at exchangeToken (CSRF defence).

Conflict resolution:
- client.ts: kept #301's attemptConnect / post-auth-race refactor, and grafted
  ai-dev's #311 self-heal (wasInErrorState + resetServerErrorState on success,
  no ERROR-state early-return) and #288 crash logging (metamcpLogStore) into it.
  Updated attemptConnect's doc comment to reflect the self-heal behavior.
- oauth.zod.ts (UpsertOAuthSessionRequestSchema): kept ai-dev's non-nullable
  tokens/code_verifier (#300 atomic-upsert contract) and added #301's
  expected_state; merged both comment notes.

Migration: dropped #301's colliding 0014_same_the_hunter and regenerated
0018_oauth_expected_state from the merged schema.

Verified: backend builds, 186 tests pass (incl. #301's new suites), 0 new type
errors; fron

**File**: `apps/backend/drizzle/0018_oauth_expected_state.sql` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+ALTER TABLE "oauth_sessions" ADD COLUMN "expected_state" text;
\ No newline at end of file
```

**File**: `apps/backend/drizzle/meta/0018_snapshot.json` (added, +2379/-0)
```diff
@@ -0,0 +1,2379 @@
+{
+  "id": "8f3ca21c-c98c-4b39-9596-349b04f52b49",
+  "prevId": "ca103932-8877-40cb-a923-e1aab028cfed",
+  "version": "7",
+  "dialect": "postgresql",
+  "tables": {
+    "public.accounts": {
+      "name": "accounts",
+      "schema": "",
+      "columns": {
+        "id": {
+          "name": "id",
+          "type": "text",
+          "primaryKey": true,
+          "notNull": true
+        },
+        "account_id": {
+          "name": "account_id",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "provider_id": {
+          "name": "provider_id",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "user_id": {
+          "name": "user_id",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "access_token": {
+          "name": "access_token",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "refresh_token": {
+          "name": "refresh_token",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "id_token": {
+          "name": "id_token",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "access_token_expires_at": {
+          "name": "access_token_expires_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "refresh_token_expires_at": {
+          "name": "refresh_token_expires_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "scope": {
+          "name": "scope",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "password": {
+          "name": "password",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "created_at": {
+          "name": "created_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        },
+        "updated_at": {
+          "name": "updated_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        }
+      },
+      "indexes": {},
+      "foreignKeys": {
+        "accounts_user_id_users_id_fk": {
+          "name": "accounts_user_id_users_id_fk",
+          "tableFrom": "accounts",
+          "tableTo": "users",
+          "columnsFrom": [
+            "user_id"
+          ],
+          "columnsTo": [
+            "id"
+          ],
+          "onDelete": "cascade",
+          "onUpdate": "no action"
+        }
+      },
+      "compositePrimaryKeys": {},
+      "uniqueConstraints": {},
+      "policies": {},
+      "checkConstraints": {},
+      "isRLSEnabled": false
+    },
+    "public.api_keys": {
+      "name": "api_keys",
+      "schema": "",
+      "columns": {
+        "uuid": {
+          "name": "uuid",
+          "type": "uuid",
+          "primaryKey": true,
+          "notNull": true,
+          "default": "gen_random_uuid()"
+        },
+        "name": {
+          "name": "name",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "key": {
+          "name": "key",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "user_id": {
+          "name": "user_id",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "created_at": {
+          "name": "created_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        },
+      
```

**File**: `apps/backend/drizzle/meta/_journal.json` (modified, +7/-0)
```diff
@@ -127,6 +127,13 @@
       "when": 1781439722147,
       "tag": "0017_audit_public_tool_calls",
       "breakpoints": true
+    },
+    {
+      "idx": 18,
+      "version": "7",
+      "when": 1781531857640,
+      "tag": "0018_oauth_expected_state",
+      "breakpoints": true
     }
   ]
 }
\ No newline at end of file
```

**File**: `apps/backend/src/db/repositories/oauth-sessions.repo.ts` (modified, +26/-0)
```diff
@@ -31,6 +31,9 @@ export class OAuthSessionsRepository {
         }),
         ...(input.tokens && { tokens: input.tokens }),
         ...(input.code_verifier && { code_verifier: input.code_verifier }),
+        ...(input.expected_state && {
+          expected_state: input.expected_state,
+        }),
       })
       .returning();
 
@@ -48,6 +51,9 @@ export class OAuthSessionsRepository {
         }),
         ...(input.tokens && { tokens: input.tokens }),
         ...(input.code_verifier && { code_verifier: input.code_verifier }),
+        ...(input.expected_state && {
+          expected_state: input.expected_state,
+        }),
         updated_at: sql`NOW()`,
       })
       .where(eq(oauthSessionsTable.mcp_server_uuid, input.mcp_server_uuid))
@@ -56,6 +62,26 @@ export class OAuthSessionsRepository {
     return updatedSession;
   }
 
+  // Dedicated clear path for `expected_state`. The truthy-spread upsert
+  // cannot write NULL through `input.expected_state` (a `null` value would
+  // be elided by the `&&` guard), so the one-shot clear after a successful
+  // token exchange goes through this method instead. Returns the updated
+  // row, or undefined if no row exists for the server.
+  async clearExpectedState(
+    mcpServerUuid: string,
+  ): Promise<DatabaseOAuthSession | undefined> {
+    const [updatedSession] = await db
+      .update(oauthSessionsTable)
+      .set({
+        expected_state: null,
+        updated_at: sql`NOW()`,
+      })
+      .where(eq(oauthSessionsTable.mcp_server_uuid, mcpServerUuid))
+      .returning();
+
+    return updatedSession;
+  }
+
   async upsert(input: OAuthSessionUpdateInput): Promise<DatabaseOAuthSession> {
     // Single-statement atomic upsert. Concurrent callers for the same
     // mcp_server_uuid resolve via ON CONFLICT instead of racing a
```

**File**: `apps/backend/src/db/schema.ts` (modified, +6/-0)
```diff
@@ -109,6 +109,12 @@ export const oauthSessionsTable = pgTable(
     // the call sites.
     tokens: jsonb("tokens").$type<UpstreamTokenResponse>(),
     code_verifier: text("code_verifier"),
+    // CSRF defence (RFC 6749 §10.12). Generated server-side at the
+    // authorize-redirect step (`DbOAuthClientProvider.state()`), compared
+    // against the upstream's echoed `state` at token exchange, and cleared
+    // on success (one-shot). NEVER returned to the frontend — the
+    // serializer strips it.
+    expected_state: text("expected_state"),
     created_at: timestamp("created_at", { withTimezone: true })
       .notNull()
       .defaultNow(),
```

---

### Incident Patch 4: `c01d15dc` (2026-06-15)
**Commit Message**: Merge pull request #295 from raphaelbarreiros/fix/oauth-server-side-token-exchange

fix(oauth): server-side token exchange + pre-registered upstream OAuth clients

Adds backend-side upstream OAuth token exchange (oauth-upstream/ module:
token-exchange, refresh-on-401) so CORS-restricted enterprise providers
(Salesforce/Okta/Auth0/...) work, plus a pre-registered upstream OAuth client
UI (AdvancedOAuthSection) for providers without RFC 7591 dynamic registration.

Conflict resolution (13 conflicts):
- vitest.config.ts: kept ai-dev's @/ alias (already added by #310); #295's was a
  duplicate.
- oauth.zod.ts: took #295's side for the 3 regions — its new exchange schemas and
  the wider UpstreamTokenResponseSchema for oauth_sessions.tokens. #300's
  oauth-sessions.repo is token-type-agnostic (spreads input.tokens with an &&
  guard), so the widening is compatible.
- mcp-servers.zod.ts, mcp-servers.json: union — kept #256's forward-headers
  schemas/strings and #295's pre-registered-OAuth schemas/strings.
- edit-mcp-server.tsx, page.tsx: union — both the forward-headers field/parsing
  (#256) and the AdvancedOAuthSection + oauthClientInfo payload (#295) are wired
  into the form and apiP

**File**: `apps/backend/src/db/schema.ts` (modified, +7/-2)
```diff
@@ -1,9 +1,9 @@
 import { OAuthClientInformation } from "@modelcontextprotocol/sdk/shared/auth.js";
-import { OAuthTokens } from "@modelcontextprotocol/sdk/shared/auth.js";
 import {
   McpServerErrorStatusEnum,
   McpServerStatusEnum,
   McpServerTypeEnum,
+  UpstreamTokenResponse,
 } from "@repo/zod-types";
 import { sql } from "drizzle-orm";
 import {
@@ -102,7 +102,12 @@ export const oauthSessionsTable = pgTable(
       .$type<OAuthClientInformation>()
       .notNull()
       .default(sql`'{}'::jsonb`),
-    tokens: jsonb("tokens").$type<OAuthTokens>(),
+    // Typed as UpstreamTokenResponse (RFC 6749 + .passthrough()) rather
+    // than the MCP SDK's narrow OAuthTokens so providers' extra response
+    // fields (Salesforce `instance_url`, OIDC `id_token`, Microsoft
+    // `ext_expires_in`, ...) round-trip without `as unknown as` casts at
+    // the call sites.
+    tokens: jsonb("tokens").$type<UpstreamTokenResponse>(),
     code_verifier: text("code_verifier"),
     created_at: timestamp("created_at", { withTimezone: true })
       .notNull()
```

**File**: `apps/backend/src/db/serializers/oauth-sessions.serializer.ts` (modified, +4/-6)
```diff
@@ -1,13 +1,11 @@
-import {
-  OAuthClientInformation,
-  OAuthTokens,
-} from "@modelcontextprotocol/sdk/shared/auth.js";
+import { OAuthClientInformation } from "@modelcontextprotocol/sdk/shared/auth.js";
+import { UpstreamTokenResponse } from "@repo/zod-types";
 
 type DatabaseOAuthSession = {
   uuid: string;
   mcp_server_uuid: string;
   client_information: OAuthClientInformation | null;
-  tokens: OAuthTokens | null;
+  tokens: UpstreamTokenResponse | null;
   code_verifier: string | null;
   created_at: Date;
   updated_at: Date;
@@ -17,7 +15,7 @@ type SerializedOAuthSession = {
   uuid: string;
   mcp_server_uuid: string;
   client_information: OAuthClientInformation | null;
-  tokens: OAuthTokens | null;
+  tokens: UpstreamTokenResponse | null;
   code_verifier: string | null;
   created_at: string;
   updated_at: string;
```

**File**: `apps/backend/src/lib/metamcp/client.ts` (modified, +54/-0)
```diff
@@ -7,6 +7,8 @@ import { ServerParameters } from "@repo/zod-types";
 
 import logger from "@/utils/logger";
 
+import { tryRefreshUpstreamTokens } from "../oauth-upstream/refresh-on-401";
+import { isUpstreamUnauthorizedError } from "../oauth-upstream/token-exchange";
 import { ProcessManagedStdioTransport } from "../stdio-transport/process-managed-transport";
 import { metamcpLogStore } from "./log-store";
 import { serverErrorTracker } from "./server-error-tracker";
@@ -297,6 +299,58 @@ export const connectMetaMcpClient = async (
         }
       }
 
+      // Refresh-on-401: if the upstream MCP server returned an
+      // unauthorized response and we have a refresh_token on file, try a
+      // server-to-server refresh once before counting this as a retry.
+      // On success the next loop iteration rebuilds the transport using
+      // the freshly-rotated access_token from oauth_sessions; on failure
+      // we fall through to the normal retry/backoff path.
+      const isHttpServer =
+        serverParams.type === "SSE" || serverParams.type === "STREAMABLE_HTTP";
+      if (
+        isHttpServer &&
+        serverParams.oauth_tokens?.refresh_token &&
+        isUpstreamUnauthorizedError(error)
+      ) {
+        try {
+          const refresh = await tryRefreshUpstreamTokens(serverParams);
+          if (refresh.status === "refreshed" && refresh.tokens) {
+            // Update the in-memory serverParams so the next createMetaMcp
+            // call attaches the new bearer token.
+            serverParams.oauth_tokens = {
+              access_token: refresh.tokens.access_token,
+              token_type: refresh.tokens.token_type,
+              expires_in: refresh.tokens.expires_in,
+              scope:
+                typeof refresh.tokens.scope === "string"
+                  ? refresh.tokens.scope
+                  : undefined,
+              refresh_token:
+                typeof refresh.tokens.refresh_token === "string"
+                  ? refresh.tokens.refresh_token
+                  : undefined,
+            };
+            logger.info(
+              `[oauth] upstream 401 refreshed for ${serverParams.name} (${serverParams.uuid}); retrying connect`,
+            );
+            // Loop again immediately — refresh is the recovery, not a
+            // backoff-worthy failure.
+            continue;
+          }
+          logger.warn(
+            `[oauth] upstream 401 refresh did not recover ${serverParams.name} ` +
+              `(${serverParams.uuid}): ${refresh.status}${
+                refresh.error ? ` (${refresh.error})` : ""
+              }`,
+          );
+        } catch (refreshError) {
+          logger.error(
+            `[oauth] upstream 401 refresh threw for ${serverParams.name} (${serverParams.uuid}):`,
+            refreshError,
+          );
+        }
+      }
+
       count++;
       retry = count < maxAttempts;
       if (retry) {
```

**File**: `apps/backend/src/lib/oauth-upstream/refresh-on-401.test.ts` (added, +272/-0)
```diff
@@ -0,0 +1,272 @@
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
+
+vi.mock("../../db/repositories", () => ({
+  oauthSessionsRepository: {
+    findByMcpServerUuid: vi.fn(),
+    upsert: vi.fn(),
+  },
+}));
+
+vi.mock("../../utils/logger", () => ({
+  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
+}));
+
+const jsonResponse = (status: number, body: unknown): Response =>
+  new Response(JSON.stringify(body), {
+    status,
+    headers: { "Content-Type": "application/json" },
+  });
+
+describe("tryRefreshUpstreamTokens", () => {
+  const SERVER = {
+    uuid: "00000000-0000-0000-0000-0000000000aa",
+    name: "test-server",
+    url: "https://api.example.com/mcp",
+  };
+
+  const loadModule = async () => {
+    const repos = await import("../../db/repositories");
+    const mod = await import("./refresh-on-401");
+    return {
+      tryRefreshUpstreamTokens: mod.tryRefreshUpstreamTokens,
+      findByMcpServerUuid: repos.oauthSessionsRepository
+        .findByMcpServerUuid as ReturnType<typeof vi.fn>,
+      upsert: repos.oauthSessionsRepository.upsert as ReturnType<typeof vi.fn>,
+    };
+  };
+
+  beforeEach(() => {
+    vi.clearAllMocks();
+  });
+  afterEach(() => {
+    vi.restoreAllMocks();
+  });
+
+  it("returns refreshed and persists new tokens on upstream 200", async () => {
+    const { tryRefreshUpstreamTokens, findByMcpServerUuid, upsert } =
+      await loadModule();
+
+    findByMcpServerUuid.mockResolvedValue({
+      mcp_server_uuid: SERVER.uuid,
+      client_information: {
+        client_id: "c1",
+        token_endpoint: "https://upstream/token",
+      },
+      tokens: {
+        access_token: "OLD",
+        token_type: "Bearer",
+        refresh_token: "RT_old",
+      },
+      code_verifier: null,
+    });
+    upsert.mockResolvedValue({});
+
+    vi.spyOn(globalThis, "fetch").mockImplementation(async (url) => {
+      const urlStr = typeof url === "string" ? url : (url as URL).toString();
+      if (urlStr.includes("/.well-known/"))
+        return new Response("nope", { status: 404 });
+      return jsonResponse(200, {
+        access_token: "NEW",
+        token_type: "Bearer",
+        expires_in: 3600,
+      });
+    });
+
+    const result = await tryRefreshUpstreamTokens(SERVER);
+    expect(result.status).toBe("refreshed");
+    expect(result.tokens?.access_token).toBe("NEW");
+    // Refresh token preserved per RFC 6749 §6.
+    expect(result.tokens?.refresh_token).toBe("RT_old");
+    expect(upsert).toHaveBeenCalledWith({
+      mcp_server_uuid: SERVER.uuid,
+      tokens: expect.objectContaining({
+        access_token: "NEW",
+        refresh_token: "RT_old",
+      }),
+    });
+  });
+
+  it("returns no_session when no oauth_sessions row exists", async () => {
+    const { tryRefreshUpstreamTokens, findByMcpServerUuid, upsert } =
+      await loadModule();
+    findByMcpServerUuid.mockResolvedValue(undefined);
+    const result = await tryRefreshUpstreamTokens(SERVER);
+    expect(result.status).toBe("no_session");
+    expect(upsert).not.toHaveBeenCalled();
+  });
+
+  it("returns no_refresh_token when session has tokens but no refresh_token", async () => {
+    const { tryRefreshUpstreamTokens, findByMcpServerUuid, upsert } =
+      await loadModule();
+    findByMcpServerUuid.mockResolvedValue({
+      mcp_server_uuid: SERVER.uuid,
+      client_information: { client_id: "c1" },
+      tokens: { access_token: "x", token_type: "Bearer" },
+    });
+    const result = await tryRefreshUpstreamTokens(SERVER);
+    expect(result.status).toBe("no_refresh_token");
+    expect(upsert).not.toHaveBeenCalled();
+  });
+
+  it("collapses concurrent refresh calls into a single upstream POST (mutex)", async () => {
+    const { tryRefreshUpstreamTokens, findByMcpServerUuid, upsert } =
+      await loadModule();
+
+    findByMcpServerUuid.mockResolvedValue({
+      mcp_server_uuid: SERVER.uuid,
+      client_information: {
+        client_id: "c1",
+  
```

**File**: `apps/backend/src/lib/oauth-upstream/refresh-on-401.ts` (added, +188/-0)
```diff
@@ -0,0 +1,188 @@
+// Server-side refresh-on-401 helper for the upstream proxy path.
+//
+// The backend's MCP client (`apps/backend/src/lib/metamcp/client.ts`) does
+// not pass an OAuthClientProvider into the SDK transports, so the SDK has
+// no built-in path to refresh tokens when the upstream returns 401. This
+// helper closes that gap: it reads the persisted oauth_sessions row,
+// POSTs `grant_type=refresh_token` to the upstream's token endpoint, and
+// persists the new tokens back into the DB so the next connection attempt
+// picks them up.
+//
+// Concurrency: an in-process per-server mutex (`inFlightRefreshes`)
+// collapses simultaneous refresh attempts for the same MCP server into
+// one upstream POST. Without this, providers that rotate refresh tokens
+// (Google, Microsoft, Okta with rotation enabled) would consume the
+// refresh_token on the first attempt and reject the second with
+// `invalid_grant`, leaving one of the two connections stranded. The
+// mutex is in-process only; multi-instance deployments still race across
+// processes (acceptable cost for now — a DB-level CAS would be the
+// follow-up).
+//
+// Acceptance criterion #3 from the OAuth-CORS-fix PR.
+
+import { ServerParameters } from "@repo/zod-types";
+
+import { oauthSessionsRepository } from "../../db/repositories";
+import logger from "../../utils/logger";
+import {
+  discoverAuthorizationServerMetadata,
+  OAuthTokens,
+  redactToken,
+  refreshAccessToken,
+  resolveTokenEndpoint,
+  resolveTokenEndpointAuthMethod,
+  UpstreamTokenError,
+} from "./token-exchange";
+
+export interface RefreshResult {
+  status:
+    | "refreshed"
+    | "no_refresh_token"
+    | "no_session"
+    | "no_client_id"
+    | "failed";
+  tokens?: OAuthTokens;
+  error?: string;
+  errorDescription?: string;
+  upstreamStatus?: number;
+}
+
+// Per-server in-flight refresh promises. Concurrent callers for the same
+// MCP server share the same upstream POST instead of racing on rotating
+// refresh tokens. The map is cleared in a `finally` so a refresh failure
+// doesn't permanently pin the server. Exposed for tests; do not depend on
+// it from production code.
+export const inFlightRefreshes = new Map<string, Promise<RefreshResult>>();
+
+// Attempt to refresh upstream OAuth tokens for an MCP server. Returns a
+// status describing what happened. Persists new tokens on success.
+//
+// NOTE: This is intentionally safe to call repeatedly — it short-circuits
+// when there is no refresh_token or no client_id to use.
+export async function tryRefreshUpstreamTokens(
+  serverParams: Pick<ServerParameters, "uuid" | "name" | "url">,
+): Promise<RefreshResult> {
+  const inFlight = inFlightRefreshes.get(serverParams.uuid);
+  if (inFlight) {
+    logger.info(
+      `[oauth] refresh already in flight for ${serverParams.uuid}; joining`,
+    );
+    return inFlight;
+  }
+  const promise = (async () => {
+    try {
+      return await doRefresh(serverParams);
+    } finally {
+      inFlightRefreshes.delete(serverParams.uuid);
+    }
+  })();
+  inFlightRefreshes.set(serverParams.uuid, promise);
+  return promise;
+}
+
+async function doRefresh(
+  serverParams: Pick<ServerParameters, "uuid" | "name" | "url">,
+): Promise<RefreshResult> {
+  if (!serverParams.url) {
+    return { status: "no_session" };
+  }
+
+  const session = await oauthSessionsRepository.findByMcpServerUuid(
+    serverParams.uuid,
+  );
+  if (!session) {
+    return { status: "no_session" };
+  }
+
+  const currentTokens = session.tokens as
+    | (OAuthTokens & { refresh_token?: string })
+    | null;
+  if (!currentTokens?.refresh_token) {
+    return { status: "no_refresh_token" };
+  }
+
+  const clientInformation = session.client_information as Record<
+    string,
+    unknown
+  > | null;
+  const clientId =
+    clientInformation && typeof clientInformation.client_id === "string"
+      ? (clientInformation.client_id as string)
+      : null;
+  if (!clientId) {
+    return { sta
```

---

### Incident Patch 5: `e8e05390` (2026-06-15)
**Commit Message**: Merge pull request #303 from inspicere/fix-max-total-connections-env

fix(mcp-server-pool): read MAX_TOTAL_CONNECTIONS from env in getInstance

getInstance() was passing a hardcoded 100 as maxTotalConnections, which
overrode the constructor's env-based default (added by #273). Since the
constructor is private and only getInstance constructs the pool, the
MAX_TOTAL_CONNECTIONS env var never actually took effect.

Conflict resolution: combined #303's env-reading logic (with NaN / non-positive
guarding) with ai-dev's getInstance signature — passing the resolved maxConn as
maxTotalConnections while keeping the maxConnectionsPerServer argument (#260).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

**File**: `apps/backend/src/lib/metamcp/mcp-server-pool.ts` (modified, +3/-1)
```diff
@@ -85,9 +85,11 @@ export class McpServerPool {
     maxConnectionsPerServer: number = 5,
   ): McpServerPool {
     if (!McpServerPool.instance) {
+      const envMax = parseInt(process.env.MAX_TOTAL_CONNECTIONS || "", 10);
+      const maxConn = Number.isFinite(envMax) && envMax > 0 ? envMax : 100;
       McpServerPool.instance = new McpServerPool(
         defaultIdleCount,
-        100,
+        maxConn,
         maxConnectionsPerServer,
       );
     }
```

---

### Incident Patch 6: `5f868084` (2026-06-14)
**Commit Message**: fix(db): journal the orphaned oauth refresh-token migration from #276

#276 hand-wrote drizzle/0014_oauth_refresh_token.sql but never ran
`drizzle-kit generate`, so there was no meta/0014_snapshot.json and no
_journal.json entry. Because docker-entrypoint.sh applies migrations via
`drizzle-kit migrate` (journal-driven), the un-journaled 0014 was silently
never applied — the refresh_token / refresh_token_expires_at columns would be
missing at runtime and the OAuth refresh-token grant (#276) would fail.

Regenerated 0014 from schema.ts so it now has a proper journal entry (idx 14)
and snapshot. SQL is identical to the hand-written version (drizzle emits
CREATE INDEX without IF NOT EXISTS). This also establishes a correct snapshot
baseline so subsequent migrations can be regenerated cleanly.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

**File**: `apps/backend/drizzle/0014_oauth_refresh_token.sql` (modified, +1/-1)
```diff
@@ -1,3 +1,3 @@
 ALTER TABLE "oauth_access_tokens" ADD COLUMN "refresh_token" text;--> statement-breakpoint
 ALTER TABLE "oauth_access_tokens" ADD COLUMN "refresh_token_expires_at" timestamp with time zone;--> statement-breakpoint
-CREATE INDEX IF NOT EXISTS "oauth_access_tokens_refresh_token_idx" ON "oauth_access_tokens" USING btree ("refresh_token");
+CREATE INDEX "oauth_access_tokens_refresh_token_idx" ON "oauth_access_tokens" USING btree ("refresh_token");
\ No newline at end of file
```

**File**: `apps/backend/drizzle/meta/0014_snapshot.json` (added, +1908/-0)
```diff
@@ -0,0 +1,1908 @@
+{
+  "id": "f8808a0a-e12f-4c80-9666-1b3bfb98308e",
+  "prevId": "06d6c80e-47a8-4720-ba08-ec60b13f1098",
+  "version": "7",
+  "dialect": "postgresql",
+  "tables": {
+    "public.accounts": {
+      "name": "accounts",
+      "schema": "",
+      "columns": {
+        "id": {
+          "name": "id",
+          "type": "text",
+          "primaryKey": true,
+          "notNull": true
+        },
+        "account_id": {
+          "name": "account_id",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "provider_id": {
+          "name": "provider_id",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "user_id": {
+          "name": "user_id",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "access_token": {
+          "name": "access_token",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "refresh_token": {
+          "name": "refresh_token",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "id_token": {
+          "name": "id_token",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "access_token_expires_at": {
+          "name": "access_token_expires_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "refresh_token_expires_at": {
+          "name": "refresh_token_expires_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "scope": {
+          "name": "scope",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "password": {
+          "name": "password",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "created_at": {
+          "name": "created_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        },
+        "updated_at": {
+          "name": "updated_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        }
+      },
+      "indexes": {},
+      "foreignKeys": {
+        "accounts_user_id_users_id_fk": {
+          "name": "accounts_user_id_users_id_fk",
+          "tableFrom": "accounts",
+          "tableTo": "users",
+          "columnsFrom": [
+            "user_id"
+          ],
+          "columnsTo": [
+            "id"
+          ],
+          "onDelete": "cascade",
+          "onUpdate": "no action"
+        }
+      },
+      "compositePrimaryKeys": {},
+      "uniqueConstraints": {},
+      "policies": {},
+      "checkConstraints": {},
+      "isRLSEnabled": false
+    },
+    "public.api_keys": {
+      "name": "api_keys",
+      "schema": "",
+      "columns": {
+        "uuid": {
+          "name": "uuid",
+          "type": "uuid",
+          "primaryKey": true,
+          "notNull": true,
+          "default": "gen_random_uuid()"
+        },
+        "name": {
+          "name": "name",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "key": {
+          "name": "key",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": true
+        },
+        "user_id": {
+          "name": "user_id",
+          "type": "text",
+          "primaryKey": false,
+          "notNull": false
+        },
+        "created_at": {
+          "name": "created_at",
+          "type": "timestamp with time zone",
+          "primaryKey": false,
+          "notNull": true,
+          "default": "now()"
+        },
+      
```

**File**: `apps/backend/drizzle/meta/_journal.json` (modified, +7/-0)
```diff
@@ -99,6 +99,13 @@
       "when": 1766064780578,
       "tag": "0013_late_lilith",
       "breakpoints": true
+    },
+    {
+      "idx": 14,
+      "version": "7",
+      "when": 1781435153166,
+      "tag": "0014_oauth_refresh_token",
+      "breakpoints": true
     }
   ]
 }
\ No newline at end of file
```

---

### Incident Patch 7: `19e6b1ff` (2026-06-14)
**Commit Message**: Merge pull request #310 from Exploitacious/fix/list-handler-recovery

fix(proxy): invalidate-and-retry recovery in the aggregate list handlers

Extends the session-recovery pattern (previously only on the tools/call
handler from #283) to the four aggregate list handlers (tools/list,
prompts/list, resources/list, resources/templates/list) via a new
requestWithSessionRecovery() helper, using #293's isRecoverableBackendError
(session-lost OR transport-lost).

Conflict resolution: git auto-merged without markers but that silently
produced a DUPLICATE invalidateServerConnection() (one from #283 already on
ai-dev, one from #310). Kept #310's version — it cascades invalidation
across every session slot for the serverUuid (not just the triggering
session) and uses logger instead of console — and deleted #283's narrower
duplicate. Signatures are identical so all callers are unaffected. The
tools/call handler keeps its existing inline #283 recovery.

session-error.ts/.test.ts were already current from the #293 merge.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

**File**: `apps/backend/src/lib/metamcp/list-handler-recovery.test.ts` (added, +150/-0)
```diff
@@ -0,0 +1,150 @@
+import { ServerParameters } from "@repo/zod-types";
+import { describe, expect, it, vi } from "vitest";
+
+import { ConnectedClient } from "./client";
+import {
+  RecoverySessionPool,
+  requestWithSessionRecovery,
+} from "./list-handler-recovery";
+
+// The exact envelope shape the backend produces when its session died
+// (matches session-error.test.ts fixtures). isRecoverableBackendError
+// must classify it as recoverable.
+const sessionLostError = () =>
+  new Error(
+    'Error POSTing to endpoint (HTTP 404): {"jsonrpc":"2.0","id":"server-error","error":{"code":-32600,"message":"Session not found"}}',
+  );
+
+const transportLostError = () => new Error("Not connected");
+
+const makeSession = (label: string): ConnectedClient =>
+  ({ label }) as unknown as ConnectedClient;
+
+const params = { uuid: "server-1", name: "test-server" } as ServerParameters;
+
+const makePool = (freshSession: ConnectedClient | undefined) => {
+  const pool: RecoverySessionPool = {
+    invalidateServerConnection: vi.fn().mockResolvedValue(undefined),
+    getSession: vi.fn().mockResolvedValue(freshSession),
+  };
+  return pool;
+};
+
+const baseOpts = (pool: RecoverySessionPool, session: ConnectedClient) => ({
+  pool,
+  sessionId: "session-abc",
+  serverUuid: "server-1",
+  params,
+  namespaceUuid: "ns-1",
+  operation: "tools/list",
+  serverName: "test-server",
+  session,
+});
+
+describe("requestWithSessionRecovery", () => {
+  it("returns the first attempt's result without touching the pool", async () => {
+    const session = makeSession("stale");
+    const pool = makePool(undefined);
+    const attempt = vi.fn().mockResolvedValue(["tool-a"]);
+
+    const result = await requestWithSessionRecovery({
+      ...baseOpts(pool, session),
+      attempt,
+    });
+
+    expect(result).toEqual(["tool-a"]);
+    expect(attempt).toHaveBeenCalledTimes(1);
+    expect(attempt).toHaveBeenCalledWith(session);
+    expect(pool.invalidateServerConnection).not.toHaveBeenCalled();
+    expect(pool.getSession).not.toHaveBeenCalled();
+  });
+
+  it("invalidates, re-acquires, and retries once on a session-lost envelope", async () => {
+    const stale = makeSession("stale");
+    const fresh = makeSession("fresh");
+    const pool = makePool(fresh);
+    const attempt = vi
+      .fn()
+      .mockRejectedValueOnce(sessionLostError())
+      .mockResolvedValueOnce(["tool-b"]);
+    const onFreshSession = vi.fn();
+
+    const result = await requestWithSessionRecovery({
+      ...baseOpts(pool, stale),
+      attempt,
+      onFreshSession,
+    });
+
+    expect(result).toEqual(["tool-b"]);
+    expect(pool.invalidateServerConnection).toHaveBeenCalledWith(
+      "session-abc",
+      "server-1",
+    );
+    expect(pool.getSession).toHaveBeenCalledWith(
+      "session-abc",
+      "server-1",
+      params,
+      "ns-1",
+    );
+    expect(onFreshSession).toHaveBeenCalledWith(fresh);
+    expect(attempt).toHaveBeenNthCalledWith(1, stale);
+    expect(attempt).toHaveBeenNthCalledWith(2, fresh);
+  });
+
+  it("recovers from the SDK transport-lost envelope too", async () => {
+    const stale = makeSession("stale");
+    const fresh = makeSession("fresh");
+    const pool = makePool(fresh);
+    const attempt = vi
+      .fn()
+      .mockRejectedValueOnce(transportLostError())
+      .mockResolvedValueOnce("ok");
+
+    await expect(
+      requestWithSessionRecovery({ ...baseOpts(pool, stale), attempt }),
+    ).resolves.toBe("ok");
+    expect(pool.invalidateServerConnection).toHaveBeenCalledTimes(1);
+  });
+
+  it("rethrows non-recoverable errors without invalidating the pool", async () => {
+    const session = makeSession("stale");
+    const pool = makePool(undefined);
+    const boom = new Error("schema validation failed");
+    const attempt = vi.fn().mockRejectedValue(boom);
+
+    await expect(
+      requestWithSessionRecovery({ ...baseOpts(pool, session), attempt }),
+    ).rejects.toBe(boom);
+    expect(pool.i
```

**File**: `apps/backend/src/lib/metamcp/list-handler-recovery.ts` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+import { ServerParameters } from "@repo/zod-types";
+
+import logger from "@/utils/logger";
+
+import { ConnectedClient } from "./client";
+import { isRecoverableBackendError } from "./session-error";
+
+/**
+ * Minimal slice of McpServerPool the recovery wrapper needs. Structural
+ * so tests can drive the wrapper with a fake pool.
+ */
+export interface RecoverySessionPool {
+  invalidateServerConnection(
+    sessionId: string,
+    serverUuid: string,
+  ): Promise<void>;
+  getSession(
+    sessionId: string,
+    serverUuid: string,
+    params: ServerParameters,
+    namespaceUuid?: string,
+  ): Promise<ConnectedClient | undefined>;
+}
+
+export interface RequestWithSessionRecoveryOptions<T> {
+  pool: RecoverySessionPool;
+  sessionId: string;
+  serverUuid: string;
+  params: ServerParameters;
+  namespaceUuid?: string;
+  /** Operation label for log lines, e.g. "tools/list". */
+  operation: string;
+  /** Human-readable server name for log lines. */
+  serverName: string;
+  /** The (possibly stale) pooled session the caller already holds. */
+  session: ConnectedClient;
+  /**
+   * The actual backend request(s). Re-invoked exactly once on a fresh
+   * session if the first invocation fails with a recoverable backend
+   * error (session-lost / transport-lost envelope).
+   */
+  attempt: (session: ConnectedClient) => Promise<T>;
+  /**
+   * Called when recovery swapped in a fresh session — lets the caller
+   * repoint tool/prompt/resource maps to the new client.
+   */
+  onFreshSession?: (session: ConnectedClient) => void;
+}
+
+/**
+ * Invalidate-and-retry-once recovery cascade for the per-server fetch
+ * inside the aggregate list handlers (tools/list, prompts/list,
+ * resources/list, resources/templates/list).
+ *
+ * The aggregate list handlers previously logged-and-continued in their
+ * catch blocks, so a dead pooled session (e.g. after a restart of the
+ * backend container) made the namespace return a "successful" 0-tool
+ * response on every request, forever — the swallowed error meant the
+ * zombie connection was never invalidated.
+ *
+ * Throws when the error is non-recoverable, when no fresh session could
+ * be established, or when the retry on the fresh session fails — the
+ * caller decides whether that excludes one server from an aggregate
+ * response (and tracks it as degraded) or fails the request.
+ */
+export async function requestWithSessionRecovery<T>(
+  opts: RequestWithSessionRecoveryOptions<T>,
+): Promise<T> {
+  try {
+    return await opts.attempt(opts.session);
+  } catch (error) {
+    if (!isRecoverableBackendError(error)) {
+      throw error;
+    }
+
+    logger.warn(
+      `Backend connection lost for server ${opts.serverUuid} (${opts.serverName}) on ${opts.operation}; invalidating pool and retrying once. (envelope: ${
+        error instanceof Error ? error.message : String(error)
+      })`,
+    );
+
+    await opts.pool.invalidateServerConnection(opts.sessionId, opts.serverUuid);
+
+    const fresh = await opts.pool.getSession(
+      opts.sessionId,
+      opts.serverUuid,
+      opts.params,
+      opts.namespaceUuid,
+    );
+    if (!fresh) {
+      throw new Error(
+        `Failed to re-initialize session for server ${opts.serverUuid} after backend session loss during ${opts.operation}`,
+      );
+    }
+
+    opts.onFreshSession?.(fresh);
+    return await opts.attempt(fresh);
+  }
+}
```

**File**: `apps/backend/src/lib/metamcp/mcp-server-pool.ts` (modified, +85/-50)
```diff
@@ -643,6 +643,91 @@ export class McpServerPool {
     this.backgroundIdleSessionsByNamespace.set(namespaceUuid, options);
   }
 
+  /**
+   * Drop the pooled backend connection(s) for a given serverUuid.
+   *
+   * Used when a backend MCP server reports our Mcp-Session-Id is unknown
+   * or our transport is dead (e.g. after the backend container restarts and
+   * loses its in-memory session registry, or a Watchtower swap kills the
+   * socket). No replacement is created here; the next `getSession` call
+   * establishes a fresh connection (and therefore a fresh backend session)
+   * on demand.
+   *
+   * The invalidation CASCADES across every session's slot for the affected
+   * serverUuid, not just the triggering session's slot, plus the idle slot.
+   * When a backend container restarts, EVERY cached ConnectedClient for that
+   * serverUuid is dead — stale clients left in sibling sessions' slots for
+   * the same backend would defeat a single-slot invalidation: a later
+   * `getSession` for one of those siblings would hand back a dead client and
+   * the retry would fail with the same envelope that triggered recovery. So
+   * we drop them all.
+   */
+  async invalidateServerConnection(
+    sessionId: string,
+    serverUuid: string,
+  ): Promise<void> {
+    // Collect every doomed ConnectedClient across all active sessions plus
+    // the idle slot, dropping the map entries as we go.
+    const cleanupPromises: Promise<void>[] = [];
+
+    for (const [sid, sessionServers] of Object.entries(this.activeSessions)) {
+      const cachedClient = sessionServers[serverUuid];
+      if (!cachedClient) {
+        continue;
+      }
+      // Each cleanup is wrapped so one failure can't strand the rest — we
+      // WANT every stale slot dropped from the map regardless.
+      cleanupPromises.push(
+        (async () => {
+          try {
+            await cachedClient.cleanup();
+          } catch (error) {
+            logger.error(
+              `Error cleaning up invalidated active session ${sid}/${serverUuid}:`,
+              error,
+            );
+          }
+        })(),
+      );
+      delete sessionServers[serverUuid];
+      this.sessionToServers[sid]?.delete(serverUuid);
+    }
+
+    const idleClient = this.idleSessions[serverUuid];
+    if (idleClient) {
+      cleanupPromises.push(
+        (async () => {
+          try {
+            await idleClient.cleanup();
+          } catch (error) {
+            logger.error(
+              `Error cleaning up invalidated idle session for ${serverUuid}:`,
+              error,
+            );
+          }
+        })(),
+      );
+      delete this.idleSessions[serverUuid];
+    }
+
+    // Drop the in-flight idle-creation guard so the recovery's getSession
+    // call isn't blocked from spawning a fresh connection.
+    this.creatingIdleSessions.delete(serverUuid);
+
+    await Promise.all(cleanupPromises);
+
+    if (cleanupPromises.length > 0) {
+      logger.warn(
+        `Invalidated ${cleanupPromises.length} pooled backend connection(s) for server ${serverUuid} ` +
+          `(triggered by session ${sessionId}; cascaded across every active + idle slot for this serverUuid)`,
+      );
+    } else {
+      logger.warn(
+        `Invalidated pooled backend connection for server ${serverUuid} (session ${sessionId}) — no clients were cached`,
+      );
+    }
+  }
+
   /**
    * Invalidate and refresh idle session for a specific server
    * This should be called when a server's parameters (command, args, etc.) change
@@ -757,56 +842,6 @@ export class McpServerPool {
     }
   }
 
-  /**
-   * Drop the pooled backend connection(s) for a given (sessionId, serverUuid).
-   *
-   * Used when the backend MCP server reports our Mcp-Session-Id is unknown
-   * (e.g. after the backend container restarts and loses its in-memory session
-   * registry). Both the active session and the paired idle session share the
-   * backend's session registry, so both are 
```

**File**: `apps/backend/src/lib/metamcp/metamcp-proxy.ts` (modified, +192/-54)
```diff
@@ -28,6 +28,7 @@ import { toolsImplementations } from "../../trpc/tools.impl";
 import { configService } from "../config.service";
 import { ConnectedClient } from "./client";
 import { getMcpServers } from "./fetch-metamcp";
+import { requestWithSessionRecovery } from "./list-handler-recovery";
 import { mcpServerPool } from "./mcp-server-pool";
 import {
   createFilterCallToolMiddleware,
@@ -162,6 +163,12 @@ export const createServer = async (
     );
     const allTools: Tool[] = [];
 
+    // Servers that should have contributed tools but failed even after the
+    // recovery retry (or had no session at all). Drives the degraded-response
+    // tripwire after the fan-out — a swallowed failure returns a "successful"
+    // 0-tool namespace and nobody notices until a manual restart.
+    const failedServers: string[] = [];
+
     // Track visited servers to detect circular references - reset on each call
     const visitedServers = new Set<string>();
 
@@ -213,6 +220,14 @@ export const createServer = async (
         );
         if (!session) {
           console.log(`[DEBUG-TOOLS] ❌ No session for: ${params.name}`);
+          // No pooled session and the pool couldn't create one — server is
+          // ERROR-gated, connection-capped, or unreachable. Error level: this
+          // server is silently missing from the namespace's tool surface
+          // until the pool recovers.
+          logger.error(
+            `tools/list: no session available for server ${params.name || mcpServerUuid} — excluded from namespace response (error state, connection cap, or backend unreachable)`,
+          );
+          failedServers.push(params.name || mcpServerUuid);
           return;
         }
 
@@ -244,32 +259,58 @@ export const createServer = async (
           params.name || session.client.getServerVersion()?.name || "";
 
         try {
-          // Paginated tool discovery - load all pages automatically
-          const allServerTools: Tool[] = [];
-          let cursor: string | undefined = undefined;
-          let hasMore = true;
           const toolFetchStart = performance.now();
 
-          while (hasMore) {
-            const result: z.infer<typeof ListToolsResultSchema> =
-              await session.client.request(
-                {
-                  method: "tools/list",
-                  params: {
-                    cursor: cursor,
-                    _meta: request.params?._meta,
+          // Paginated tool discovery - load all pages automatically
+          const fetchAllToolPages = async (
+            active: ConnectedClient,
+          ): Promise<Tool[]> => {
+            const pages: Tool[] = [];
+            let cursor: string | undefined = undefined;
+            let hasMore = true;
+
+            while (hasMore) {
+              const result: z.infer<typeof ListToolsResultSchema> =
+                await active.client.request(
+                  {
+                    method: "tools/list",
+                    params: {
+                      cursor: cursor,
+                      _meta: request.params?._meta,
+                    },
                   },
-                },
-                ListToolsResultSchema,
-              );
+                  ListToolsResultSchema,
+                );
+
+              if (result.tools && result.tools.length > 0) {
+                pages.push(...result.tools);
+              }
 
-            if (result.tools && result.tools.length > 0) {
-              allServerTools.push(...result.tools);
+              cursor = result.nextCursor;
+              hasMore = !!result.nextCursor;
             }
 
-            cursor = result.nextCursor;
-            hasMore = !!result.nextCursor;
-          }
+            return pages;
+          };
+
+          // Invalidate-and-retry-once on session-lost / transport-lost.
+          // Without it a dead pooled session is never evicted from here and
+          // the namespace serves 0 tools as "success" until a manual r
```

**File**: `apps/backend/vitest.config.ts` (modified, +10/-0)
```diff
@@ -1,6 +1,16 @@
+import path from "node:path";
+
 import { defineConfig } from "vitest/config";
 
 export default defineConfig({
+  resolve: {
+    alias: {
+      // Mirror the tsconfig.json `paths` mapping so unit tests can
+      // import modules that use the `@/` prefix without each test
+      // having to hand-mock every transitive logger / utils import.
+      "@": path.resolve(__dirname, "./src"),
+    },
+  },
   test: {
     globals: true,
     environment: "node",
```

---

### Incident Patch 8: `b73829dd` (2026-06-14)
**Commit Message**: Merge pull request #293 from Exploitacious/fix/session-recovery-detectors

fix(session): hardened session-lost + transport-lost recovery detectors

Resolved add/add conflict in session-error.ts / session-error.test.ts by
adopting #293's hardened implementation wholesale. It is a superset of the
naive isBackendSessionLostError() that #283 added: same 404 / "Session not
found" / -32001 / -32600 matching, plus .cause-chain walking (depth 8),
object/string throwable handling, and numeric/string .code inspection.

Also adds isBackendTransportLostError() (-32603 "Not connected") and the
combined isRecoverableBackendError(). These new detectors are additive and
will be wired into the proxy retry paths by the stacked PR #310.

The existing tools/call callsite in metamcp-proxy.ts keeps using
isBackendSessionLostError() with identical (now hardened) behavior.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

**File**: `apps/backend/src/lib/metamcp/session-error.test.ts` (modified, +195/-3)
```diff
@@ -1,6 +1,10 @@
 import { describe, expect, it } from "vitest";
 
-import { isBackendSessionLostError } from "./session-error";
+import {
+  isBackendSessionLostError,
+  isBackendTransportLostError,
+  isRecoverableBackendError,
+} from "./session-error";
 
 describe("isBackendSessionLostError", () => {
   it("matches the HTTP 404 + JSON-RPC -32600 envelope the SDK produces", () => {
@@ -22,14 +26,202 @@ describe("isBackendSessionLostError", () => {
     expect(isBackendSessionLostError(error)).toBe(false);
   });
 
-  it("does not match transport disconnects", () => {
+  it("does not match transport disconnects (transport-lost detector handles those)", () => {
     const error = new Error("Not connected");
     expect(isBackendSessionLostError(error)).toBe(false);
   });
 
-  it("returns false for non-Error inputs", () => {
+  it("returns false for null / undefined", () => {
     expect(isBackendSessionLostError(undefined)).toBe(false);
     expect(isBackendSessionLostError(null)).toBe(false);
+  });
+
+  it("returns false for unrelated strings", () => {
     expect(isBackendSessionLostError("Session not found")).toBe(false);
+    expect(isBackendSessionLostError("HTTP 404")).toBe(false);
+    expect(isBackendSessionLostError("random text")).toBe(false);
+  });
+
+  it("matches a string throwable carrying the full envelope", () => {
+    const message =
+      'Error POSTing to endpoint (HTTP 404): {"jsonrpc":"2.0","error":{"code":-32600,"message":"Session not found"}}';
+    expect(isBackendSessionLostError(message)).toBe(true);
+  });
+
+  it("matches when the session-lost error is wrapped via .cause", () => {
+    const inner = new Error(
+      'Error POSTing to endpoint (HTTP 404): {"jsonrpc":"2.0","error":{"code":-32600,"message":"Session not found"}}',
+    );
+    const outer = new Error("Failed to dispatch tool call", { cause: inner });
+    expect(isBackendSessionLostError(outer)).toBe(true);
+  });
+
+  it("matches when wrapped two layers deep via .cause", () => {
+    const innermost = new Error(
+      'Error POSTing to endpoint (HTTP 404): {"jsonrpc":"2.0","error":{"code":-32001,"message":"Session not found"}}',
+    );
+    const mid = new Error("Transport rejection", { cause: innermost });
+    const outer = new Error("Outer wrap", { cause: mid });
+    expect(isBackendSessionLostError(outer)).toBe(true);
+  });
+
+  it("matches a JSON-RPC error envelope passed as a plain object", () => {
+    // Some rejection paths surface the parsed RPC error envelope directly
+    // rather than the SDK's wrapped Error. The detector inspects the
+    // structured payload as well as the rendered message.
+    const envelope = {
+      jsonrpc: "2.0",
+      id: "server-error",
+      error: { code: -32600, message: "Session not found" },
+    };
+    expect(isBackendSessionLostError(envelope)).toBe(true);
+  });
+
+  it("matches an Error whose .code carries -32001 even when the message is sparse", () => {
+    const error = Object.assign(new Error("Session not found"), {
+      code: -32001,
+    });
+    expect(isBackendSessionLostError(error)).toBe(true);
+  });
+
+  it("falls back to String(error) for objects with only toString()", () => {
+    class CustomThrowable {
+      toString() {
+        return 'Error POSTing to endpoint (HTTP 404): {"error":{"code":-32600,"message":"Session not found"}}';
+      }
+    }
+    expect(isBackendSessionLostError(new CustomThrowable())).toBe(true);
+  });
+
+  it("does not match objects with unrelated -32600 contexts", () => {
+    // -32600 alone (without 'Session not found') is the JSON-RPC "Invalid
+    // Request" code and means many things. Don't false-positive on it.
+    const error = new Error("MCP error -32600: Invalid Request");
+    expect(isBackendSessionLostError(error)).toBe(false);
+  });
+
+  it("handles circular cause chains without infinite-looping", () => {
+    const a = new Error("Wrapper a") as Error & { cause?: unknown };
+    const b = new Error("Wrapper b
```

**File**: `apps/backend/src/lib/metamcp/session-error.ts` (modified, +270/-12)
```diff
@@ -12,21 +12,279 @@
  *   Error POSTing to endpoint (HTTP 404):
  *   {"jsonrpc":"2.0","id":"server-error","error":{"code":-32600,"message":"Session not found"}}
  *
- * When this happens, the cached backend connection is dead: MetaMCP must drop
+ * Production observation 2026-05-08: in some flows the SDK error reaches us
+ * wrapped (e.g. via `.cause` from a higher-layer handler, or stringified
+ * after passing through a non-Error rejection). The simple
+ * `error.message.includes(...)` check missed all 138 events emitted between
+ * a backend container restart and a manual MetaMCP restart, even though the
+ * rendered string clearly contained all three matched substrings. To prevent
+ * that gap from re-opening on the next backend deploy, this detector now:
+ *
+ *   1. Walks the `.cause` chain on Error inputs (max depth 8).
+ *   2. Falls back to `String(error)` for non-Error throwables (some SDK
+ *      paths reject with plain objects, McpError wrappers, or strings).
+ *   3. Inspects a numeric/string `.code` field on object inputs (some
+ *      RPC layers strip the message but preserve the code).
+ *
+ * When this fires, the cached backend connection is dead: MetaMCP must drop
  * it, send a new `initialize`, and replay the failed request. The MCP spec
- * states the client MUST start a new session in response to HTTP 404, so this
- * is the normative recovery path, not a workaround.
+ * states the client MUST start a new session in response to HTTP 404, so
+ * this is the normative recovery path, not a workaround.
  */
-export function isBackendSessionLostError(error: unknown): boolean {
-  if (!(error instanceof Error) || !error.message) {
-    return false;
-  }
-  const message = error.message;
-  const mentionsSessionNotFound = message.includes("Session not found");
-  const mentionsHttp404 = message.includes("HTTP 404");
-  const mentionsSessionErrorCode =
-    message.includes("-32001") || message.includes("-32600");
+
+const SESSION_NOT_FOUND = "Session not found";
+const HTTP_404 = "HTTP 404";
+const RPC_CODE_PATTERNS = ["-32001", "-32600"];
+const MAX_CAUSE_DEPTH = 8;
+
+// Transport-disconnect signal raised by the MCP TypeScript SDK's Protocol
+// class when a request is dispatched on a transport that has already been
+// torn down. Produced verbatim ("Not connected") whenever the cached
+// ConnectedClient's underlying StreamableHTTPClientTransport has been
+// closed — either because the backend MCP container restarted (Watchtower
+// image pull, manual `docker restart`, OOM kill) or because the SDK's
+// session manager half-closed the stream after an idle / error condition.
+//
+// Distinct from "Session not found": the session-not-found path means the
+// backend rejected the request because its session registry doesn't know
+// our Mcp-Session-Id (recoverable by sending a new `initialize`). The
+// "Not connected" path means our local transport has no live stream to
+// send anything on (recoverable by invalidating the pool entry, opening
+// a fresh transport, and re-initializing). Both end up at the same
+// recovery action — invalidate + reconnect + retry — but the error
+// envelopes are textually disjoint, so they need separate detectors.
+const NOT_CONNECTED = "Not connected";
+// JSON-RPC code -32603 = "Internal error". MetaMCP's tRPC bridge wraps
+// the SDK-thrown "Not connected" rejection into this envelope before it
+// reaches the consumer (Claude.ai connector, n8n httpRequest node, etc.).
+// Production observation 2026-05-14: consumer-side connectors see
+// `-32603 "Not connected"` rather than the raw SDK Error, and the
+// session-lost detector misses it. Pair the code with the
+// "Not connected" message so we don't false-positive on every -32603
+// from unrelated internal-error paths.
+const RPC_CODE_TRANSPORT_LOST = "-32603";
+
+function stringMatchesSessionLost(value: string): boolean {
+  const mentionsSessionNotFound = value.includes(SESSION_NOT_FOUND);
+  const mentionsHttp404 
```

---

### Incident Patch 9: `ecf354a8` (2026-06-14)
**Commit Message**: Merge pull request #300 from raphaelbarreiros/fix/oauth-upsert-race-and-ssr-safe

fix(oauth): atomic upsert + SSR-safe OAuth provider (closes #296, #297)

**File**: `apps/backend/src/db/repositories/__tests__/oauth-sessions.repo.test.ts` (added, +167/-0)
```diff
@@ -0,0 +1,167 @@
+import type {
+  OAuthClientInformation,
+  OAuthTokens,
+} from "@modelcontextprotocol/sdk/shared/auth.js";
+import { beforeEach, describe, expect, it, vi } from "vitest";
+
+const valuesCalls: any[] = [];
+const onConflictSetCalls: any[] = [];
+const onConflictTargetCalls: any[] = [];
+
+// In-memory store keyed by mcp_server_uuid that mimics
+// `INSERT ... ON CONFLICT (mcp_server_uuid) DO UPDATE SET ...` semantics.
+// Tests then assert both the persisted result AND the call shape passed
+// to Drizzle, so we pin the conditional-spread behaviour directly.
+const store = new Map<string, any>();
+
+vi.mock("../../index", () => {
+  return {
+    db: {
+      insert: () => ({
+        values: (values: any) => {
+          valuesCalls.push(values);
+          return {
+            onConflictDoUpdate: ({
+              target,
+              set,
+            }: {
+              target: unknown;
+              set: any;
+            }) => {
+              onConflictTargetCalls.push(target);
+              onConflictSetCalls.push(set);
+              return {
+                returning: async () => {
+                  const key = values.mcp_server_uuid;
+                  const now = new Date();
+                  const existing = store.get(key);
+                  if (existing) {
+                    // ON CONFLICT DO UPDATE: merge only the keys present in `set`.
+                    // Strip the sql`NOW()` updated_at because the fake can't
+                    // execute SQL — overwrite with a Date instead.
+                    const { updated_at: _ignored, ...applicable } = set;
+                    const updated = {
+                      ...existing,
+                      ...applicable,
+                      updated_at: now,
+                    };
+                    store.set(key, updated);
+                    return [updated];
+                  }
+                  // Fresh insert: schema-defaulted columns are filled with
+                  // their declared defaults (client_information => {}).
+                  const row = {
+                    uuid: `uuid-${store.size}`,
+                    mcp_server_uuid: values.mcp_server_uuid,
+                    client_information: values.client_information ?? {},
+                    tokens: values.tokens ?? null,
+                    code_verifier: values.code_verifier ?? null,
+                    created_at: now,
+                    updated_at: now,
+                  };
+                  store.set(key, row);
+                  return [row];
+                },
+              };
+            },
+          };
+        },
+      }),
+    },
+  };
+});
+
+// Import AFTER vi.mock so the repo binds to the fake db.
+const { OAuthSessionsRepository } = await import("../oauth-sessions.repo");
+
+describe("OAuthSessionsRepository.upsert", () => {
+  const repo = new OAuthSessionsRepository();
+  const serverId = "00000000-0000-0000-0000-000000000001";
+
+  beforeEach(() => {
+    store.clear();
+    valuesCalls.length = 0;
+    onConflictSetCalls.length = 0;
+    onConflictTargetCalls.length = 0;
+  });
+
+  it("uses a single ON CONFLICT statement (not check-then-insert)", async () => {
+    await repo.upsert({
+      mcp_server_uuid: serverId,
+      client_information: { client_id: "client-A" } as OAuthClientInformation,
+    });
+
+    // Exactly one insert chain per call: this is what makes the upsert
+    // atomic and removes the SELECT-then-INSERT race window.
+    expect(valuesCalls).toHaveLength(1);
+    expect(onConflictSetCalls).toHaveLength(1);
+    expect(onConflictTargetCalls[0]).toBeDefined();
+  });
+
+  it("two sequential upserts produce a single row whose values reflect the last call", async () => {
+    await repo.upsert({
+      mcp_server_uuid: serverId,
+      client_information: { client_id: "client-A" } as OAuthClientInformation,
+    });
+    const second = await repo.upsert({
+      mcp_server_uuid: serverId,
+      client_inform
```

**File**: `apps/backend/src/db/repositories/oauth-sessions.repo.ts` (modified, +32/-14)
```diff
@@ -57,22 +57,40 @@ export class OAuthSessionsRepository {
   }
 
   async upsert(input: OAuthSessionUpdateInput): Promise<DatabaseOAuthSession> {
-    // Check if session exists
-    const existingSession = await this.findByMcpServerUuid(
-      input.mcp_server_uuid,
-    );
+    // Single-statement atomic upsert. Concurrent callers for the same
+    // mcp_server_uuid resolve via ON CONFLICT instead of racing a
+    // SELECT-then-INSERT, which previously crashed the loser with a
+    // unique-constraint violation. Only fields present on `input` are written
+    // so a partial update (e.g. tokens only) does not clear unrelated columns
+    // such as code_verifier.
+    const [row] = await db
+      .insert(oauthSessionsTable)
+      .values({
+        mcp_server_uuid: input.mcp_server_uuid,
+        ...(input.client_information && {
+          client_information: input.client_information,
+        }),
+        ...(input.tokens && { tokens: input.tokens }),
+        ...(input.code_verifier && { code_verifier: input.code_verifier }),
+      })
+      .onConflictDoUpdate({
+        target: oauthSessionsTable.mcp_server_uuid,
+        set: {
+          ...(input.client_information && {
+            client_information: input.client_information,
+          }),
+          ...(input.tokens && { tokens: input.tokens }),
+          ...(input.code_verifier && { code_verifier: input.code_verifier }),
+          updated_at: sql`NOW()`,
+        },
+      })
+      .returning();
 
-    if (existingSession) {
-      // Update existing session
-      const updatedSession = await this.update(input);
-      if (!updatedSession) {
-        throw new Error("Failed to update OAuth session");
-      }
-      return updatedSession;
-    } else {
-      // Create new session
-      return await this.create(input);
+    if (!row) {
+      throw new Error("Failed to upsert OAuth session");
     }
+
+    return row;
   }
 
   async deleteByMcpServerUuid(
```

**File**: `apps/frontend/app/[locale]/(sidebar)/mcp-servers/[uuid]/page.tsx` (modified, +9/-2)
```diff
@@ -16,7 +16,7 @@ import {
 } from "lucide-react";
 import Link from "next/link";
 import { notFound, useRouter } from "next/navigation";
-import { use, useEffect, useState } from "react";
+import { use, useEffect, useRef, useState } from "react";
 import { toast } from "sonner";
 
 import { EditMcpServer } from "@/components/edit-mcp-server";
@@ -161,15 +161,22 @@ export default function McpServerDetailPage({
     ),
   });
 
-  // Auto-connect when hook is enabled and not already connected
+  // Auto-connect when hook is enabled and not already connected.
+  // Guarded against React Strict Mode's intentional double-invocation of
+  // effects in dev: without the ref, both fires would race two concurrent
+  // OAuth dynamic registrations and the browser/DB would disagree on
+  // client_id, breaking token exchange.
+  const didAutoConnect = useRef(false);
   useEffect(() => {
+    if (didAutoConnect.current) return;
     if (
       connection &&
       server &&
       !isLoading &&
       server.error_status !== McpServerErrorStatusEnum.Enum.ERROR &&
       connection.connectionStatus === "disconnected"
     ) {
+      didAutoConnect.current = true;
       connection.connect();
     }
   }, [server, connection, isLoading]);
```

**File**: `apps/frontend/lib/oauth-provider.ts` (modified, +16/-2)
```diff
@@ -20,8 +20,19 @@ class DbOAuthClientProvider implements OAuthClientProvider {
   constructor(mcpServerUuid: string, serverUrl: string) {
     this.mcpServerUuid = mcpServerUuid;
     this.serverUrl = serverUrl;
-    // Save the server URL to session storage for consistency
-    sessionStorage.setItem(SESSION_KEYS.SERVER_URL, serverUrl);
+    // No sessionStorage access here: the constructor runs during Next.js SSR
+    // for the MCP server detail page, where sessionStorage is undefined.
+    // The SERVER_URL seed is deferred to ensureServerUrlStored(), called by
+    // the OAuth-flow methods below, all of which are invoked client-side.
+  }
+
+  // Seeds SESSION_KEYS.SERVER_URL on first invocation in the browser. The
+  // OAuth callback page reads this key to recover the upstream serverUrl, so
+  // it must be set before redirectToAuthorization sends the user away. Safe
+  // to call repeatedly; a no-op on the server.
+  private ensureServerUrlStored() {
+    if (typeof window === "undefined") return;
+    sessionStorage.setItem(SESSION_KEYS.SERVER_URL, this.serverUrl);
   }
 
   get redirectUrl() {
@@ -91,6 +102,7 @@ class DbOAuthClientProvider implements OAuthClientProvider {
   }
 
   async saveClientInformation(clientInformation: OAuthClientInformation) {
+    this.ensureServerUrlStored();
     // Save to session storage during OAuth flow
     const key = getServerSpecificKey(
       SESSION_KEYS.CLIENT_INFORMATION,
@@ -159,10 +171,12 @@ class DbOAuthClientProvider implements OAuthClientProvider {
   }
 
   redirectToAuthorization(authorizationUrl: URL) {
+    this.ensureServerUrlStored();
     window.location.href = authorizationUrl.href;
   }
 
   async saveCodeVerifier(codeVerifier: string) {
+    this.ensureServerUrlStored();
     // Save to session storage during OAuth flow
     const key = getServerSpecificKey(
       SESSION_KEYS.CODE_VERIFIER,
```

**File**: `packages/zod-types/src/oauth.zod.ts` (modified, +14/-8)
```diff
@@ -130,12 +130,16 @@ export const GetOAuthSessionResponseSchema = z.union([
   }),
 ]);
 
-// Upsert OAuth Session Request - all fields optional for updates
+// Upsert OAuth Session Request - all fields optional for updates.
+// `tokens` and `code_verifier` are NOT nullable: the atomic upsert in
+// `OAuthSessionsRepository.upsert` drops nullish values via the conditional
+// spread (omit = "do not touch"), so allowing `null` here would advertise a
+// "clear this column" contract the implementation does not honour.
 export const UpsertOAuthSessionRequestSchema = z.object({
   mcp_server_uuid: z.string().uuid(),
   client_information: OAuthClientInformationSchema.optional(),
-  tokens: OAuthTokensSchema.nullable().optional(),
-  code_verifier: z.string().nullable().optional(),
+  tokens: OAuthTokensSchema.optional(),
+  code_verifier: z.string().optional(),
 });
 
 // Upsert OAuth Session Response
@@ -151,19 +155,21 @@ export const UpsertOAuthSessionResponseSchema = z.union([
   }),
 ]);
 
-// Repository-specific schemas
+// Repository-specific schemas. `tokens` and `code_verifier` mirror the upsert
+// contract above: omitted means "leave the column alone"; `null` is not
+// accepted because the impl would silently drop it.
 export const OAuthSessionCreateInputSchema = z.object({
   mcp_server_uuid: z.string(),
   client_information: OAuthClientInformationSchema.optional(),
-  tokens: OAuthTokensSchema.nullable().optional(),
-  code_verifier: z.string().nullable().optional(),
+  tokens: OAuthTokensSchema.optional(),
+  code_verifier: z.string().optional(),
 });
 
 export const OAuthSessionUpdateInputSchema = z.object({
   mcp_server_uuid: z.string(),
   client_information: OAuthClientInformationSchema.optional(),
-  tokens: OAuthTokensSchema.nullable().optional(),
-  code_verifier: z.string().nullable().optional(),
+  tokens: OAuthTokensSchema.optional(),
+  code_verifier: z.string().optional(),
 });
 
 // Export repository types
```

---

### Incident Patch 10: `ad686281` (2026-06-14)
**Commit Message**: Merge pull request #312 from bobbyhyam/fix/persist-uv-cache

Persist uv cache across container recreates

**File**: `Dockerfile` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ RUN apt-get update && apt-get install -y curl postgresql-client && apt-get clean
 # Create non-root user with proper home directory
 RUN addgroup --system --gid 1001 nodejs
 RUN adduser --system --uid 1001 --home /home/nextjs nextjs && \
-    mkdir -p /home/nextjs/.cache/node/corepack && \
+    mkdir -p /home/nextjs/.cache/node/corepack /home/nextjs/.cache/uv && \
     chown -R nextjs:nodejs /home/nextjs
 
 # Copy built applications
```

**File**: `docker-compose.yml` (modified, +10/-0)
```diff
@@ -162,6 +162,14 @@ services:
       postgres:
         condition: service_healthy
     restart: "no"
+    volumes:
+      # Persist the uv cache across container recreates. Without this, every
+      # `docker compose up -d`/recreate wipes the writable layer and the next
+      # `uvx <pkg>@latest` spawn for each STDIO server cold-installs from
+      # scratch — slow enough to trip the crash detector and stick the server
+      # in error_status=ERROR. The image ships /home/nextjs/.cache/uv owned by
+      # nextjs (uid 1001) so a fresh named volume inherits correct ownership.
+      - uv_cache:/home/nextjs/.cache/uv
     networks:
       - metamcp-network
 
@@ -191,6 +199,8 @@ services:
 volumes:
   postgres_data:
     driver: local
+  uv_cache:
+    driver: local
 
 networks:
   metamcp-network:
```

#### Recent Merged Pull Requests:
- **PR #366** (closed): fix(frontend): clear rate limit fields when disabled (@Drm1804)
- **PR #356** (closed): test(w2): synthetic conflict with #355 (@terafin)
- **PR #355** (closed): fix: consolidated perf-live + adversarial audit fixes (Dockerfile build crash, leaks, DB tools path) (@terafin)
- **PR #354** (closed): fix(docker): make the Next.js proxy-request sed path-agnostic + fail-open (@terafin)
- **PR #353** (closed): perf(proxy): consolidated prewarm + never-spawn-unused + recovery + leak cleanup (backend-only) (@terafin)
- **PR #352** (closed): perf(proxy): consolidated prewarm + never-spawn-unused + leak cleanup (Sindri x Layer0) (@terafin)
- **PR #351** (closed): perf(proxy): Layer-0 DB tools, prewarm, pool bounds + reproducible Docker build (@terafin)
- **PR #350** (closed): perf(proxy): Layer-0 DB tools, prewarm, pool bounds + reproducible Docker build (@terafin)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
