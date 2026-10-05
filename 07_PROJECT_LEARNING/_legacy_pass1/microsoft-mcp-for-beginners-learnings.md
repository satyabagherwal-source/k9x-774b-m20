# Forensic Learning Record (Deep Inspection): microsoft/mcp-for-beginners

> **Canonical Artifact**: `07_PROJECT_LEARNING/microsoft-mcp-for-beginners-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/microsoft/mcp-for-beginners](https://github.com/microsoft/mcp-for-beginners))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:31:25.277Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/mcp-for-beginners`
- **Description**: This open-source curriculum introduces the fundamentals of Model Context Protocol (MCP) through real-world, cross-language examples in .NET, Java, TypeScript, JavaScript, Rust and Python. Designed for developers, it focuses on practical techniques for building modular, scalable, and secure AI workflows from session setup to service orchestration.
- **Primary Language / Ecosystem**: Jupyter Notebook
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 17368 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `02-Security/samples/cimd-dcr-auth/src/config.ts`
```
export interface SampleConfig {
  host: string;
  port: number;
  mcpServerUrl: URL;
  authorizationServerIssuer: string;
  authorizationServerMetadataUrl: URL;
  jwtAlgorithm: string;
  clientMetadataUrl: URL;
  redirectUris: string[];
  dcrClientIdPrefix?: string;
}

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
const ALLOWED_JWT_ALGORITHMS = new Set(["RS256", "PS256", "ES256"]);

export function requireSecureUrl(url: URL, name: string): URL {
  if (url.protocol === "https:") {
    return url;
  }
  if (url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname)) {
    return url;
  }
  throw new Error(`${name} must use HTTPS except for loopback development`);
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function parsePort(value: string): number {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  const port = Number(normalized);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }
  return port;
}

export function mcpRoutePath(serverUrl: URL): string {
  return serverUrl.pathname;
}

export function loadConfig(): SampleConfig {
  const port = parsePort(process.env.PORT ?? "3001");

  const jwtAlgorithm = process.env.JWT_ALGORITHM?.trim() || "RS256";
  if (!ALLOWED_JWT_ALGORITHMS.has(jwtAlgorithm)) {
    throw new Error("JWT_ALGORITHM must be RS256, PS256, or ES256");
  }

  const redirectUris = required("OAUTH_REDIRECT_URIS")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  for (const redirectUri of redirectUris) {
    const parsed = requireSecureUrl(new URL(redirectUri), "OAuth redirect URI");
    if (parsed.hash) {
      throw new Error("OAuth redirect URIs must not contain fragments");
    }
  }

  const authorizationServerIssuer = required("AUTHORIZATION_SERVER_ISSUER");
  requireSecureUrl(new URL(authorizationServerIssuer), "AUTHORIZATION_SERVER_ISSUER");

  return {
    host: process.env.HOST?.trim() || "127.0.0.1",
    port,
    mcpServerUrl: requireSecureUrl(
      new URL(process.env.MCP_SERVER_URL ?? `http://127.0.0.1:${port}/mcp`),
      "MCP_SERVER_URL"
    ),
    authorizationServerIssuer,
    authorizationServerMetadataUrl: requireSecureUrl(
      new URL(required("AUTHORIZATION_SERVER_METADATA_URL")),
      "AUTHORIZATION_SERVER_METADATA_URL"
    ),
    jwtAlgorithm,
    clientMetadataUrl: requireSecureUrl(
      new URL(required("CLIENT_METADATA_URL")),
      "CLIENT_METADATA_URL"
    ),
    redirectUris,
    dcrClientIdPrefix: process.env.DCR_CLIENT_ID_PREFIX?.trim() || undefined
  };
}
```

### Core Architecture Module: `02-Security/samples/cimd-dcr-auth/src/dcr.ts`
```
import { requireSecureUrl } from "./config.js";

export interface DynamicClientRequest {
  client_name: string;
  application_type: "native";
  grant_types: ["authorization_code", "refresh_token"];
  response_types: ["code"];
  redirect_uris: string[];
  token_endpoint_auth_method: "none";
}

export interface DynamicClientResult {
  client_id: string;
  client_secret?: string;
  [key: string]: unknown;
}

export function createDynamicClientRequest(redirectUris: string[]): DynamicClientRequest {
  if (redirectUris.length === 0) {
    throw new Error("At least one OAuth redirect URI is required");
  }
  return {
    client_name: "MCP DCR compatibility client",
    application_type: "native",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    redirect_uris: redirectUris,
    token_endpoint_auth_method: "none"
  };
}

export async function registerDynamicClient(
  registrationEndpoint: URL,
  request: DynamicClientRequest
): Promise<DynamicClientResult> {
  const secureEndpoint = requireSecureUrl(registrationEndpoint, "registration_endpoint");
  const response = await fetch(secureEndpoint, {
    method: "POST",
    redirect: "error",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(request)
  });
  if (!response.ok) {
    throw new Error(`Dynamic client registration failed: ${response.status}`);
  }

  const result = (await response.json()) as Record<string, unknown>;
  if (typeof result.client_id !== "string" || result.client_id.length === 0) {
    throw new Error("Dynamic client registration response has no client_id");
  }
  if (result.client_secret !== undefined && typeof result.client_secret !== "string") {
    throw new Error("Dynamic client registration client_secret must be a string");
  }
  return result as DynamicClientResult;
}
```

### Core Architecture Module: `02-Security/samples/cimd-dcr-auth/src/mcp.ts`
```
import { McpServer, type AuthInfo } from "@modelcontextprotocol/server";
import * as z from "zod/v4";

import { classifyRegistration } from "./registration.js";

export function buildServer(
  authInfo: AuthInfo | undefined,
  dcrClientIdPrefix?: string
): McpServer {
  const server = new McpServer({ name: "cimd-dcr-auth-sample", version: "1.0.0" });

  server.registerTool(
    "registration-info",
    {
      title: "Registration information",
      description: "Explain whether the verified OAuth client used CIMD or a configured DCR identifier.",
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async () => {
      if (!authInfo) {
        return { content: [{ type: "text", text: "No authenticated caller" }], isError: true };
      }
      const details = classifyRegistration(authInfo.clientId, dcrClientIdPrefix);
      return {
        content: [{ type: "text", text: JSON.stringify(details, null, 2) }],
        structuredContent: details
      };
    }
  );

  server.registerTool(
    "greet",
    {
      title: "Greet caller",
      description: "Greet a name when the caller has the tool:greet scope.",
      inputSchema: z.object({ name: z.string().min(1) }),
      annotations: { readOnlyHint: true, openWorldHint: false }
    },
    async ({ name }) => {
      if (!authInfo?.scopes.includes("tool:greet")) {
        return {
          content: [{ type: "text", text: "insufficient_scope: greet requires tool:greet" }],
          isError: true
        };
      }
      return { content: [{ type: "text", text: `Hello, ${name}.` }] };
    }
  );

  return server;
}
```

### Core Architecture Module: `02-Security/samples/cimd-dcr-auth/src/oauth.ts`
```
import type { OAuthTokenVerifier } from "@modelcontextprotocol/express";
import {
  OAuthError,
  OAuthErrorCode,
  type AuthInfo,
  type OAuthMetadata
} from "@modelcontextprotocol/server";
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

import { requireSecureUrl } from "./config.js";

export type ValidatedOAuthMetadata = OAuthMetadata & {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  registration_endpoint?: string;
};

function stringClaim(payload: JWTPayload, name: string): string | undefined {
  const value = payload[name];
  return typeof value === "string" ? value : undefined;
}

function scopesFrom(payload: JWTPayload): string[] {
  const scope = payload.scope;
  if (typeof scope === "string") {
    return scope.split(" ").filter(Boolean);
  }
  const permissions = payload.permissions;
  return Array.isArray(permissions)
    ? permissions.filter((value): value is string => typeof value === "string")
    : [];
}

export async function loadAuthorizationServerMetadata(
  metadataUrl: URL,
  expectedIssuer: string
): Promise<ValidatedOAuthMetadata> {
  const response = await fetch(metadataUrl, { redirect: "error" });
  if (!response.ok) {
    throw new Error(`Authorization server metadata request failed: ${response.status}`);
  }

  const metadata = (await response.json()) as Record<string, unknown>;
  if (metadata.issuer !== expectedIssuer) {
    throw new Error("Authorization server metadata issuer does not match AUTHORIZATION_SERVER_ISSUER");
  }
  if (
    typeof metadata.authorization_endpoint !== "string" ||
    typeof metadata.token_endpoint !== "string" ||
    typeof metadata.jwks_uri !== "string"
  ) {
    throw new Error("Authorization server metadata is missing required endpoints");
  }
  requireSecureUrl(new URL(metadata.authorization_endpoint), "authorization_endpoint");
  requireSecureUrl(new URL(metadata.token_endpoint), "token_endpoint");
  requireSecureUrl(new URL(metadata.jwks_uri), "jwks_uri");
  if (
    metadata.registration_endpoint !== undefined &&
    typeof metadata.registration_endpoint !== "string"
  ) {
    throw new Error("Authorization server registration_endpoint must be a string");
  }
  return metadata as ValidatedOAuthMetadata;
}

export function createTokenVerifier(options: {
  issuer: string;
  audience: string;
  jwksUri: string;
  algorithm: string;
}): OAuthTokenVerifier {
  const jwks = createRemoteJWKSet(new URL(options.jwksUri));

  return {
    async verifyAccessToken(token: string): Promise<AuthInfo> {
      try {
        const { payload } = await jwtVerify(token, jwks, {
          issuer: options.issuer,
          audience: options.audience,
          algorithms: [options.algorithm]
        });
        const clientId = stringClaim(payload, "client_id") ?? stringClaim(payload, "azp");
        if (!clientId || !payload.exp) {
          throw new Error("Token must contain client_id (or azp) and exp claims");
        }

        return {
          token,
          clientId,
          scopes: scopesFrom(payload),
          expiresAt: payload.exp
        };
      } catch {
        throw new OAuthError(OAuthErrorCode.InvalidToken, "Access token is invalid or expired");
      }
    }
  };
}
```

### Core Architecture Module: `02-Security/samples/cimd-dcr-auth/src/register-dcr.ts`
```
import { loadConfig } from "./config.js";
import { createDynamicClientRequest, registerDynamicClient } from "./dcr.js";
import { loadAuthorizationServerMetadata } from "./oauth.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const metadata = await loadAuthorizationServerMetadata(
    config.authorizationServerMetadataUrl,
    config.authorizationServerIssuer
  );
  if (!metadata.registration_endpoint) {
    throw new Error("Authorization server does not advertise registration_endpoint");
  }

  const registration = await registerDynamicClient(
    new URL(metadata.registration_endpoint),
    createDynamicClientRequest(config.redirectUris)
  );
  console.log(`Registered legacy DCR client: ${registration.client_id}`);
  if (registration.client_secret) {
    console.log("The authorization server returned a client secret; store it securely.");
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
```

### Core Architecture Module: `02-Security/samples/cimd-dcr-auth/src/registration.ts`
```
export type RegistrationMechanism = "cimd" | "dcr" | "opaque-client-id";

export interface RegistrationDetails {
  mechanism: RegistrationMechanism;
  clientId: string;
  explanation: string;
}

function hasCimdUrlShape(url: URL): boolean {
  return (
    url.protocol === "https:" &&
    url.pathname !== "/" &&
    !url.username &&
    !url.password &&
    !url.search &&
    !url.hash
  );
}

export function classifyRegistration(
  clientId: string,
  dcrClientIdPrefix?: string
): RegistrationDetails {
  try {
    const url = new URL(clientId);
    if (hasCimdUrlShape(url)) {
      return {
        mechanism: "cimd",
        clientId,
        explanation: "The client_id is an HTTPS URL with a path, matching the CIMD identifier shape."
      };
    }
  } catch {
    // Opaque client IDs are handled below.
  }

  if (dcrClientIdPrefix && clientId.startsWith(dcrClientIdPrefix)) {
    return {
      mechanism: "dcr",
      clientId,
      explanation: `The opaque client_id matches the configured DCR prefix '${dcrClientIdPrefix}'.`
    };
  }

  return {
    mechanism: "opaque-client-id",
    clientId,
    explanation:
      "The token contains an opaque client_id. Standard token claims alone cannot distinguish DCR from pre-registration."
  };
}

export interface ClientMetadataDocument {
  client_id: string;
  client_name: string;
  client_uri: string;
  application_type: "native";
  grant_types: ["authorization_code", "refresh_token"];
  response_types: ["code"];
  redirect_uris: string[];
  token_endpoint_auth_method: "none";
}

export function createClientMetadata(
  clientMetadataUrl: URL,
  redirectUris: string[]
): ClientMetadataDocument {
  if (clientMetadataUrl.protocol !== "https:" || clientMetadataUrl.pathname === "/") {
    throw new Error("CLIENT_METADATA_URL must be an HTTPS URL with a non-root path");
  }
  if (clientMetadataUrl.username || clientMetadataUrl.password) {
    throw new Error("CLIENT_METADATA_URL must not contain user information");
  }
  if (clientMetadataUrl.search || clientMetadataUrl.hash) {
    throw new Error("CLIENT_METADATA_URL must not contain a query string or fragment");
  }
  if (redirectUris.length === 0) {
    throw new Error("At least one OAuth redirect URI is required");
  }

  return {
    client_id: clientMetadataUrl.href,
    client_name: "MCP CIMD and DCR course sample",
    client_uri: clientMetadataUrl.origin,
    application_type: "native",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    redirect_uris: redirectUris,
    token_endpoint_auth_method: "none"
  };
}
```

### Core Architecture Module: `02-Security/samples/cimd-dcr-auth/src/server.ts`
```
import {
  createMcpExpressApp,
  getOAuthProtectedResourceMetadataUrl,
  mcpAuthMetadataRouter,
  requireBearerAuth
} from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";

import { loadConfig, mcpRoutePath } from "./config.js";
import { buildServer } from "./mcp.js";
import { createTokenVerifier, loadAuthorizationServerMetadata } from "./oauth.js";
import { createClientMetadata } from "./registration.js";

async function main(): Promise<void> {
  const config = loadConfig();
  const oauthMetadata = await loadAuthorizationServerMetadata(
    config.authorizationServerMetadataUrl,
    config.authorizationServerIssuer
  );
  const verifier = createTokenVerifier({
    issuer: config.authorizationServerIssuer,
    audience: config.mcpServerUrl.href,
    jwksUri: oauthMetadata.jwks_uri,
    algorithm: config.jwtAlgorithm
  });

  const handler = createMcpHandler(({ authInfo }) =>
    buildServer(authInfo, config.dcrClientIdPrefix)
  );
  const nodeHandler = toNodeHandler(handler);
  const app = createMcpExpressApp({ host: config.host });

  app.get("/health", (_request, response) => response.json({ status: "ok" }));
  app.get(config.clientMetadataUrl.pathname, (_request, response) =>
    response.json(createClientMetadata(config.clientMetadataUrl, config.redirectUris))
  );
  app.use(
    mcpAuthMetadataRouter({
      oauthMetadata,
      resourceServerUrl: config.mcpServerUrl,
      scopesSupported: ["tool:greet"]
    })
  );

  const auth = requireBearerAuth({
    verifier,
    requiredScopes: [],
    resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(config.mcpServerUrl)
  });
  app.all(mcpRoutePath(config.mcpServerUrl), auth, (request, response) =>
    void nodeHandler(request, response, request.body)
  );

  const httpServer = app.listen(config.port, config.host, () => {
    console.log(`MCP server: ${config.mcpServerUrl.href}`);
    console.log(`Client metadata: ${config.clientMetadataUrl.href}`);
  });

  process.on("SIGINT", async () => {
    await handler.close();
    httpServer.close(() => process.exit(0));
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
```

### Core Architecture Module: `03-GettingStarted/01-first-server/solution/python/server.py`
```
# server.py
from mcp.server.fastmcp import FastMCP

# Create an MCP server
mcp = FastMCP("Demo")


# Add an addition tool
@mcp.tool()
def add(a: int, b: int) -> int:
    """Add two numbers"""
    return a + b
@mcp.tool()
def subtract(a: int, b: int) -> int:
    """Subtract two numbers"""
    return a - b

# Add a dynamic greeting resource
@mcp.resource("greeting://{name}")
def get_greeting(name: str) -> str:
    """Get a personalized greeting"""
    return f"Hello, {name}!"


# Main execution block - this is required to run the server
if __name__ == "__main__":
    mcp.run()
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1124** (2026-09-22): **[Samples] Fix tool-call ordering and MarkItDown attribution**
  *Symptoms*: # Purpose  Address two confirmed review findings from merged PR #1123.  - Append the assistant tool-call message once before iterating over tool calls in the lab 2 agent. This keeps all corresponding tool results together before the next model request. - Replace the altered MarkItDown quotation with a clearly labeled, model-neutral paraphrase that retains the source link.  Review references: - https://github.com/microsoft/mcp-for-beginners/pull/1123#discussion_r4070556134 - https://github.com/microsoft/mcp-for-beginners/pull/1123#discussion_r4070556185  The reported missing `os` import in the sampling client is a false positive: the committed file retains `import os` at line 7. Its import and `call_llm` function were executed in isolation with a mocked OpenAI client to verify environment lookups; no sampling-client source change is needed.  ## Does this introduce a breaking change?  When developers merge from main and run the server, azd up, or azd deploy, will this produce an error? If you're not sure, try it out on an old environment.  ``` [ ] Yes [x] No ```  ## Does this require changes to learn.microsoft.com docs or modules?  which includes deployment, settings and usage instructions.  ``` [ ] Yes [x] No ```  ## Type of change  ``` [x] Bugfix [ ] Feature [ ] Code style update (formatting, local variables) [ ] Refactoring (no functional changes, no api changes) [x] Documentation content changes [ ] Other... Please describe: ```  ## Validation  - Used the repository `.venv`

- **Issue #1123** (2026-09-22): **[Docs] Update model guidance and Entra authentication flow**
  *Symptoms*: # Purpose  Update deprecated `gpt-4o` examples to the recommended `gpt-5.1` model, link to the Microsoft Foundry model retirement schedule, and refresh Microsoft Foundry Toolkit naming.  Correct the Entra authentication diagram so it shows the MCP server validating JWT signatures and claims locally with cached public signing keys instead of calling Entra ID for every request. The documentation also explains that OpenID metadata and signing keys are fetched and periodically refreshed for key rotation.  Fixes #1099  ## Does this introduce a breaking change?  When developers merge from main and run the server, azd up, or azd deploy, will this produce an error? If you're not sure, try it out on an old environment.  ``` [ ] Yes [x] No ```  ## Does this require changes to learn.microsoft.com docs or modules?  which includes deployment, settings and usage instructions.  ``` [x] Yes [ ] No ```  ## Type of change  ``` [x] Bugfix [ ] Feature [x] Code style update (formatting, local variables) [ ] Refactoring (no functional changes, no api changes) [x] Documentation content changes [ ] Other... Please describe: ```  ## Validation  - `python -m py_compile 03-GettingStarted/03-llm-client/solution/python/client.py 10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab2/code/agent.py` - `npx --yes markdownlint-cli2 10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab2/README.md` - `git diff --check` 

- **Issue #1122** (2026-09-22): **chore(deps): bump anyio from 4.9.0 to 4.14.2 in /10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server**
  *Symptoms*: Bumps [anyio](https://github.com/agronholm/anyio) from 4.9.0 to 4.14.2. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/agronholm/anyio/releases">anyio's releases</a>.</em></p> <blockquote> <h2>4.14.2</h2> <ul> <li>Changed <code>ByteReceiveStream.receive()</code> implementations to raise a <code>ValueError</code> when <code>max_bytes</code> is not a positive integer (<a href="https://redirect.github.com/agronholm/anyio/pull/1191">#1191</a>)</li> <li>Fixed <code>CapacityLimiter.total_tokens</code> rejecting <code>float(&quot;inf&quot;)</code> when the limiter was instantiated outside of an event loop. The adapter setter checked for infinity by identity (<code>value is math.inf</code>), so only the exact <code>math.inf</code> singleton was accepted, while every backend setter (using <code>math.isinf()</code>) accepts any positive infinity (<a href="https://redirect.github.com/agronholm/anyio/pull/1189">#1189</a>; PR by <a href="https://github.com/greymoth-jp"><code>@​greymoth-jp</code></a>).</li> <li>Fixed <code>to_process.run_sync()</code> deadlocking when the worker function writes enough data to <code>sys.stderr</code> to fill the (undrained) pipe buffer. The worker process now redirects <code>sys.stderr</code> to <code>os.devnull</code> as well, matching the documented behavior</li> <li>Fixed <code>TLSStream.wrap()</code> matching an internationalized (unicode) host name against the peer certificate using IDNA 2003 (via the standar

- **Issue #1121** (2026-09-22): **chore(deps): bump rmcp from 1.4.0 to 2.1.0 in /03-GettingStarted/02-client/solution/rust**
  *Symptoms*: Bumps [rmcp](https://github.com/modelcontextprotocol/rust-sdk) from 1.4.0 to 2.1.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/modelcontextprotocol/rust-sdk/releases">rmcp's releases</a>.</em></p> <blockquote> <h2>rmcp-macros-v2.1.0</h2> <h3>Added</h3> <ul> <li>[<strong>breaking</strong>] align model types with MCP 2025-11-25 spec (<a href="https://redirect.github.com/modelcontextprotocol/rust-sdk/pull/927">#927</a>)</li> </ul> <h3>Fixed</h3> <ul> <li>fill missing fully qualified syntax in prompt_handler macros (<a href="https://redirect.github.com/modelcontextprotocol/rust-sdk/pull/866">#866</a>)</li> </ul> <h3>Other</h3> <ul> <li>align README examples with v2 model API (<a href="https://redirect.github.com/modelcontextprotocol/rust-sdk/pull/928">#928</a>)</li> </ul> <h2>rmcp-v2.1.0</h2> <h3>Added</h3> <ul> <li>add SEP-414 trace context meta accessors (<a href="https://redirect.github.com/modelcontextprotocol/rust-sdk/pull/910">#910</a>)</li> <li>add SEP-2575 meta helpers (<a href="https://redirect.github.com/modelcontextprotocol/rust-sdk/pull/942">#942</a>)</li> </ul> <h3>Fixed</h3> <ul> <li><em>(transport)</em> make AsyncRwTransport::receive cancel-safe (<a href="https://redirect.github.com/modelcontextprotocol/rust-sdk/pull/941">#941</a>) (<a href="https://redirect.github.com/modelcontextprotocol/rust-sdk/pull/947">#947</a>)</li> <li><em>(auth)</em> preserve refresh_token when refresh response omits it (<a href="https://redi

- **Issue #1120** (2026-09-22): **Update Japanese translation for MCP Servers link**
  *Symptoms*: https://github.com/microsoft/mcp-for-beginners/blob/main/translations/ja/07-LessonsfromEarlyAdoption/README.md  <img width="1183" height="54" alt="image" src="https://github.com/user-attachments/assets/37799f00-5b08-4df9-afbc-b684e4a4a405" />  related https://github.com/Azure/co-op-translator/issues/502  #PingMSFTDocs

- **Issue #1119** (2026-09-22): **Revise Japanese README translations and links**
  *Symptoms*: Updated Japanese translations for various sections and links in the README.  https://github.com/microsoft/mcp-for-beginners/blob/main/translations/ja/05-AdvancedTopics/README.md   <img width="1187" height="1174" alt="image" src="https://github.com/user-attachments/assets/22287717-f3e9-43f4-ba22-4018b3115158" />  <img width="1172" height="109" alt="image" src="https://github.com/user-attachments/assets/6ad3c8a0-b884-479c-ae89-e4bf4d2c068d" />  related https://github.com/Azure/co-op-translator/issues/502  #PingMSFTDocs

- **Issue #1118** (2026-09-22): **Translate 'Community Contributions' section to Japanese**
  *Symptoms*: https://github.com/microsoft/mcp-for-beginners/blob/main/translations/ja/05-AdvancedTopics/mcp-transport/README.md   <img width="1180" height="52" alt="image" src="https://github.com/user-attachments/assets/43f0b88e-26c9-47bd-a49c-a567b30f012c" />  related https://github.com/Azure/co-op-translator/issues/502  #PingMSFTDocs

- **Issue #1117** (2026-09-22): **Translate MCP security section to Japanese**
  *Symptoms*: https://github.com/microsoft/mcp-for-beginners/blob/main/translations/ja/05-AdvancedTopics/mcp-foundry-agent-integration/README.md   <img width="1184" height="54" alt="image" src="https://github.com/user-attachments/assets/8ef7b1c9-a90f-4a76-8c7a-1ab30ee32558" />  related https://github.com/Azure/co-op-translator/issues/502  #PingMSFTDocs

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

### Incident Patch 1: `5b9b963b` (2026-09-22)
**Commit Message**: Merge pull request #1124 from microsoft/fix/post-1123-review-feedback

[Samples] Fix tool-call ordering and MarkItDown attribution

**File**: `07-LessonsfromEarlyAdoption/microsoft-mcp-servers.md` (modified, +5/-3)
```diff
@@ -294,9 +294,11 @@ The GitHub MCP Server will:
 
 **Real-world use**: "Convert this PowerPoint presentation to Markdown for our documentation site", "Extract text from this PDF with proper heading structure", or "Transform this Excel spreadsheet into a readable table format"
 
-**Featured example**: To quote the [MarkItDown docs](https://github.com/microsoft/markitdown#why-markdown):
-
-> Markdown is extremely close to plain text, with minimal markup or formatting, but still provides a way to represent important document structure. Mainstream LLMs, such as OpenAI's GPT-5.1, natively "speak" Markdown, and often incorporate Markdown into their responses unprompted. This suggests that they have been trained on vast amounts of Markdown-formatted text, and understand it well. As a side benefit, Markdown conventions are also highly token-efficient.
+**Featured example (paraphrased)**: The
+[MarkItDown docs](https://github.com/microsoft/markitdown#why-markdown) explain
+that Markdown preserves document structure with little formatting overhead.
+Language models commonly produce Markdown, making it a useful, token-efficient
+format for document-processing workflows.
 
 MarkItDown is really good at preserving document structure, which is important for AI workflows. For instance, when converting a PowerPoint presentation, it keeps slide organization with the right headings, extracts tables as Markdown tables, includes alt text for images, and even processes the speaker notes. Charts get converted to readable data tables, and the resulting Markdown maintains the logical flow of the original presentation. This makes it perfect for feeding presentation content into AI systems or creating documentation from existing slides.
 ### 6. 🗃️ SQL Server MCP Server
```

**File**: `10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab2/code/agent.py` (modified, +1/-1)
```diff
@@ -121,11 +121,11 @@ async def chatWithTools(self, messages: list[Any]) -> None:
             hasToolCall = False
 
             if response.choices[0].message.tool_calls:
+                messages.append(response.choices[0].message.model_dump(exclude_none=True))
                 for tool in response.choices[0].message.tool_calls:
                     hasToolCall = True
                     tool_name = tool.function.name
                     tool_args = json.loads(tool.function.arguments)
-                    messages.append(response.choices[0].message.model_dump(exclude_none=True))
                 
                 
                     # Find the appropriate server for this tool
```

---

### Incident Patch 2: `07af4fc5` (2026-09-22)
**Commit Message**: Fix agent tool-call ordering and MarkItDown attribution

**File**: `07-LessonsfromEarlyAdoption/microsoft-mcp-servers.md` (modified, +5/-3)
```diff
@@ -294,9 +294,11 @@ The GitHub MCP Server will:
 
 **Real-world use**: "Convert this PowerPoint presentation to Markdown for our documentation site", "Extract text from this PDF with proper heading structure", or "Transform this Excel spreadsheet into a readable table format"
 
-**Featured example**: To quote the [MarkItDown docs](https://github.com/microsoft/markitdown#why-markdown):
-
-> Markdown is extremely close to plain text, with minimal markup or formatting, but still provides a way to represent important document structure. Mainstream LLMs, such as OpenAI's GPT-5.1, natively "speak" Markdown, and often incorporate Markdown into their responses unprompted. This suggests that they have been trained on vast amounts of Markdown-formatted text, and understand it well. As a side benefit, Markdown conventions are also highly token-efficient.
+**Featured example (paraphrased)**: The
+[MarkItDown docs](https://github.com/microsoft/markitdown#why-markdown) explain
+that Markdown preserves document structure with little formatting overhead.
+Language models commonly produce Markdown, making it a useful, token-efficient
+format for document-processing workflows.
 
 MarkItDown is really good at preserving document structure, which is important for AI workflows. For instance, when converting a PowerPoint presentation, it keeps slide organization with the right headings, extracts tables as Markdown tables, includes alt text for images, and even processes the speaker notes. Charts get converted to readable data tables, and the resulting Markdown maintains the logical flow of the original presentation. This makes it perfect for feeding presentation content into AI systems or creating documentation from existing slides.
 ### 6. 🗃️ SQL Server MCP Server
```

**File**: `10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab2/code/agent.py` (modified, +1/-1)
```diff
@@ -121,11 +121,11 @@ async def chatWithTools(self, messages: list[Any]) -> None:
             hasToolCall = False
 
             if response.choices[0].message.tool_calls:
+                messages.append(response.choices[0].message.model_dump(exclude_none=True))
                 for tool in response.choices[0].message.tool_calls:
                     hasToolCall = True
                     tool_name = tool.function.name
                     tool_args = json.loads(tool.function.arguments)
-                    messages.append(response.choices[0].message.model_dump(exclude_none=True))
                 
                 
                     # Find the appropriate server for this tool
```

---

### Incident Patch 3: `b8a0f225` (2026-09-22)
**Commit Message**: Merge pull request #1123 from microsoft/fix/model-retirement-entra-flow-1099

[Docs] Update model guidance and Entra authentication flow

**File**: `03-GettingStarted/03-llm-client/README.md` (modified, +142/-143)
```diff
@@ -39,15 +39,21 @@ Great, now we understand how we can do this at high level, let's try this out in
 
 In this exercise, we will learn to add an LLM to our client.
 
-### Authentication using GitHub Personal Access Token
+### Configure Microsoft Foundry
 
-Creating a GitHub token is a straightforward process. Here’s how you can do it:
+GitHub Models was retired on July 30, 2026. Create a Microsoft Foundry resource,
+deploy an active model such as `gpt-5.1`, and set these environment variables:
 
-- Go to GitHub Settings – Click on your profile picture in the top right corner and select Settings.
-- Navigate to Developer Settings – Scroll down and click on Developer Settings.
-- Select Personal Access Tokens – Click on Fine-grained tokens and then Generate new token.
-- Configure Your Token – Add a note for reference, set an expiration date, and select the necessary scopes (permissions). In this case be sure to add the Models permission.
-- Generate and Copy the Token – Click Generate token, and make sure to copy it immediately, as you won’t be able to see it again.
+```bash
+export AZURE_OPENAI_ENDPOINT="https://<resource-name>.openai.azure.com"
+export AZURE_OPENAI_API_KEY="<api-key>"
+export AZURE_OPENAI_DEPLOYMENT="gpt-5.1"
+```
+
+Use the deployment name in API calls. It may differ from the underlying model
+name. Review the
+[Microsoft Foundry model retirement schedule](https://learn.microsoft.com/azure/foundry/openai/concepts/model-retirement-schedule)
+before choosing a model.
 
 ### -1- Connect to server
 
@@ -66,9 +72,15 @@ class MCPClient {
     private openai: OpenAI;
     private client: Client;
     constructor(){
+        const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
+        const apiKey = process.env.AZURE_OPENAI_API_KEY;
+        if (!endpoint || !apiKey) {
+            throw new Error("AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY must be set");
+        }
+
         this.openai = new OpenAI({
-            baseURL: "https://models.inference.ai.azure.com", 
-            apiKey: process.env.GITHUB_TOKEN,
+            baseURL: `${endpoint.replace(/\/$/, "")}/openai/v1/`,
+            apiKey,
         });
 
         this.client = new Client(
@@ -77,11 +89,7 @@ class MCPClient {
                 version: "1.0.0"
             },
             {
-                capabilities: {
-                prompts: {},
-                resources: {},
-                tools: {}
-                }
+                capabilities: {}
             }
             );    
     }
@@ -92,7 +100,7 @@ In the preceding code we've:
 
 - Imported the needed libraries
 - Create a class with two members, `client` and `openai` that will help us manage a client and interact with an LLM respectively.
-- Configured our LLM instance to use GitHub Models by setting `baseUrl` to point to the inference API.
+- Configured the OpenAI client to use the Microsoft Foundry v1 endpoint and API key.
 
 #### Python
 
@@ -132,17 +140,27 @@ In the preceding code we've:
 #### .NET
 
 ```csharp
-using Azure;
-using Azure.AI.Inference;
-using Azure.Identity;
-using System.Text.Json;
 using ModelContextProtocol.Client;
+using OpenAI;
+using OpenAI.Chat;
+using System.ClientModel;
 using System.Text.Json;
 
+var endpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT");
+var apiKey = Environment.GetEnvironmentVariable("AZURE_OPENAI_API_KEY");
+var deployment = Environment.GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT") ?? "gpt-5.1";
+var client = new ChatClient(
+    deployment,
+    new ApiKeyCredential(apiKey),
+    new OpenAIClientOptions
+    {
+        Endpoint = new Uri($"{endpoint.TrimEnd('/')}/openai/v1/")
+    });
+
 var clientTransport = new StdioClientTransport(new()
 {
     Name = "Demo Server",
-    Command = "/workspaces/mcp-for-beginners/03-GettingStarted/02-client/solution/server/bin/Debug/net8.0/server",
+    Command = "/workspaces/mcp-for-beginners/03-GettingStarted/02-client/solution/server/bin/Debug/net9.0/server",
     Argumen
```

**File**: `03-GettingStarted/03-llm-client/solution/dotnet/Program.cs` (modified, +35/-48)
```diff
@@ -1,21 +1,29 @@
-﻿using Azure;
-using Azure.AI.Inference;
 using ModelContextProtocol.Client;
 using ModelContextProtocol.Protocol;
+using OpenAI;
+using OpenAI.Chat;
+using System.ClientModel;
 using System.Text.Json;
 
-var endpoint = "https://models.inference.ai.azure.com";
-var token = Environment.GetEnvironmentVariable("GITHUB_TOKEN"); // Your GitHub Access Token
-if (string.IsNullOrWhiteSpace(token))
+var endpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT");
+var apiKey = Environment.GetEnvironmentVariable("AZURE_OPENAI_API_KEY");
+var deployment = Environment.GetEnvironmentVariable("AZURE_OPENAI_DEPLOYMENT") ?? "gpt-5.1";
+if (string.IsNullOrWhiteSpace(endpoint) || string.IsNullOrWhiteSpace(apiKey))
 {
-    Console.WriteLine("Please set the GITHUB_TOKEN environment variable to your GitHub Access Token.");
+    Console.WriteLine("Please set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY.");
     return;
 }
 
-var client = new ChatCompletionsClient(new Uri(endpoint), new AzureKeyCredential(token));
-var chatHistory = new List<ChatRequestMessage>
+var client = new ChatClient(
+    model: deployment,
+    credential: new ApiKeyCredential(apiKey),
+    options: new OpenAIClientOptions
+    {
+        Endpoint = new Uri($"{endpoint.TrimEnd('/')}/openai/v1/")
+    });
+var chatHistory = new List<ChatMessage>
 {
-    new ChatRequestSystemMessage("You are a helpful assistant that knows about AI")
+    new SystemChatMessage("You are a helpful assistant that knows about AI")
 };
 
 var clientTransport = new StdioClientTransport(new()
@@ -29,45 +37,30 @@
 
 await using var mcpClient = await McpClient.CreateAsync(clientTransport);
 
-ChatCompletionsToolDefinition ConvertFrom(string name, string description, JsonElement jsonElement)
-{ 
-    // convert the tool to a function definition
-    FunctionDefinition functionDefinition = new(name)
-    {
-        Description = description,
-        Parameters = BinaryData.FromObjectAsJson(new
-        {
-            Type = "object",
-            Properties = jsonElement
-        },
-        new JsonSerializerOptions() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase })
-    };
-
-    // create a tool definition
-    ChatCompletionsToolDefinition toolDefinition = new(functionDefinition);
-    return toolDefinition;
+ChatTool ConvertFrom(string name, string description, JsonElement jsonElement)
+{
+    return ChatTool.CreateFunctionTool(
+        functionName: name,
+        functionDescription: description,
+        functionParameters: BinaryData.FromString(jsonElement.GetRawText()));
 }
 
-async Task<List<ChatCompletionsToolDefinition>> GetMcpTools()
+async Task<List<ChatTool>> GetMcpTools()
 {
     Console.WriteLine("Listing tools");
     var tools = await mcpClient.ListToolsAsync();
 
-    List<ChatCompletionsToolDefinition> toolDefinitions = [];
+    List<ChatTool> toolDefinitions = [];
 
     foreach (var tool in tools)
     {
         Console.WriteLine($"Connected to server with tools: {tool.Name}");
         Console.WriteLine($"Tool description: {tool.Description}");
         Console.WriteLine($"Tool parameters: {tool.JsonSchema}");
 
-        tool.JsonSchema.TryGetProperty("properties", out JsonElement propertiesElement);
-
-        var def = ConvertFrom(tool.Name, tool.Description, propertiesElement);
+        var def = ConvertFrom(tool.Name, tool.Description, tool.JsonSchema);
         Console.WriteLine($"Tool definition: {def}");
-        toolDefinitions.Add(def); 
-
-        Console.WriteLine($"Properties: {propertiesElement}");        
+        toolDefinitions.Add(def);
     }
 
     return toolDefinitions;
@@ -85,31 +78,29 @@ async Task<List<ChatCompletionsToolDefinition>> GetMcpTools()
 // 2. Define the chat history and the user message
 var userMessage = "add 2 and 4";
 
-chatHistory.Add(new ChatRequestUserMessage(userMessage));
+chatHistory.Add(new UserChatM
```

**File**: `03-GettingStarted/03-llm-client/solution/dotnet/README.md` (modified, +11/-7)
```diff
@@ -1,16 +1,21 @@
 # Run this sample
 
 > [!NOTE]
-> This sample assumes you're using a GitHub Codespaces instance. If you want to run this locally, you need to set up a personal access token (PAT) on GitHub.
+> Deploy an active model such as `gpt-5.1` in Microsoft Foundry and configure
+> its endpoint, API key, and deployment name.
 >
 > ```bash
 > # zsh/bash
-> export GITHUB_TOKEN="{{YOUR_GITHUB_PAT}}"
+> export AZURE_OPENAI_ENDPOINT="https://<resource-name>.openai.azure.com"
+> export AZURE_OPENAI_API_KEY="<api-key>"
+> export AZURE_OPENAI_DEPLOYMENT="gpt-5.1"
 > ```
 >
 > ```powershell
 > # PowerShell
-> $env:GITHUB_TOKEN = "{{YOUR_GITHUB_PAT}}"
+> $env:AZURE_OPENAI_ENDPOINT = "https://<resource-name>.openai.azure.com"
+> $env:AZURE_OPENAI_API_KEY = "<api-key>"
+> $env:AZURE_OPENAI_DEPLOYMENT = "gpt-5.1"
 > ```
 
 ## Install libraries
@@ -19,7 +24,7 @@
 dotnet restore
 ```
 
-Should install the following libraries: Azure AI Inference, Azure Identity, Microsoft.Extension, Model.Hosting, ModelContextProtcol 
+This installs the OpenAI .NET client and the Model Context Protocol SDK.
 
 ## Run
 
@@ -35,9 +40,8 @@ Listing tools
 Connected to server with tools: Add
 Tool description: Adds two numbers
 Tool parameters: {"title":"Add","description":"Adds two numbers","type":"object","properties":{"a":{"type":"integer"},"b":{"type":"integer"}},"required":["a","b"]}
-Tool definition: Azure.AI.Inference.ChatCompletionsToolDefinition
-Properties: {"a":{"type":"integer"},"b":{"type":"integer"}}
-MCP Tools def: 0: Azure.AI.Inference.ChatCompletionsToolDefinition
+Tool definition: OpenAI.Chat.ChatTool
+MCP Tools def: 0: OpenAI.Chat.ChatTool
 Tool call 0: Add with arguments {"a":2,"b":4}
 Sum 6
 ```
```

**File**: `03-GettingStarted/03-llm-client/solution/dotnet/dotnet.csproj` (modified, +4/-5)
```diff
@@ -1,17 +1,16 @@
-﻿<Project Sdk="Microsoft.NET.Sdk">
+<Project Sdk="Microsoft.NET.Sdk">
 
   <PropertyGroup>
     <OutputType>Exe</OutputType>
     <TargetFramework>net9.0</TargetFramework>
     <ImplicitUsings>enable</ImplicitUsings>
     <Nullable>enable</Nullable>
-  </PropertyGroup> 
+  </PropertyGroup>
 
   <ItemGroup>
-    <PackageReference Include="Azure.AI.Inference" Version="1.*-*" />
-    <PackageReference Include="Azure.Identity" Version="1.*-*" />
     <PackageReference Include="Microsoft.Extensions.Hosting" Version="9.*-*" />
     <PackageReference Include="ModelContextProtocol" Version="0.*-*" />
+    <PackageReference Include="OpenAI" Version="2.10.0" />
   </ItemGroup>
 
-</Project>
+</Project>
\ No newline at end of file
```

**File**: `03-GettingStarted/03-llm-client/solution/java/pom.xml` (modified, +0/-5)
```diff
@@ -59,11 +59,6 @@
             <groupId>dev.langchain4j</groupId>
             <artifactId>langchain4j-open-ai-official</artifactId>
             <version>${langchain4j.version}</version>
-          </dependency>
-          <dependency>
-            <groupId>dev.langchain4j</groupId>
-            <artifactId>langchain4j-github-models</artifactId>
-            <version>${langchain4j.version}</version>
         </dependency>
         <!-- JUnit dependencies for testing -->
         <dependency>
```

---

### Incident Patch 4: `cb3b3448` (2026-09-21)
**Commit Message**: Fix link formatting in Japanese README

Co-authored-by: Copilot Autofix powered by AI <175728472+Copilot@users.noreply.github.com>

**File**: `translations/ja/05-AdvancedTopics/README.md` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ _(このレッスンのビデオを見るには上の画像をクリックして
 
 | リンク | タイトル | 説明 |
 |------|-------|-------------|
-| [5.1 Azure との統合e](./mcp-integration/README.md) | Azureとの統合 | Azure上のMCPサーバーとの統合方法を学ぶ |
+| [5.1 Azure との統合](./mcp-integration/README.md) | Azureとの統合 | Azure上のMCPサーバーとの統合方法を学ぶ |
 | [5.2 マルチモーダル・サンプル](./mcp-multi-modality/README.md) | MCPマルチモーダルサンプル | 音声、画像、マルチモーダル応答のサンプル |
 | [5.3 MCP OAuth2 サンプル](../../../05-AdvancedTopics/mcp-oauth2-demo) | MCP OAuth2 デモ | OAuth2を利用した最小限のSpring Bootアプリ。Authorization ServerとResource Server両方の役割を示し、安全なトークン発行、保護されたエンドポイント、Azure Container Appsへの展開、API管理統合を実演。 |
 | [5.4 ルートコンテキスト](./mcp-root-contexts/README.md) | ルートコンテキスト | ルートコンテキストについて学び、その実装方法を習得（`2026-07-28`リリース候補で非推奨; `2025-11-25`までは有効） |
```

---

### Incident Patch 5: `92f7b64a` (2026-09-21)
**Commit Message**: Translate MCP security section to Japanese

https://github.com/microsoft/mcp-for-beginners/blob/main/translations/ja/05-AdvancedTopics/mcp-foundry-agent-integration/README.md
#PingMSFTDocs

**File**: `translations/ja/05-AdvancedTopics/mcp-security-entra/README.md` (modified, +2/-2)
```diff
@@ -410,11 +410,11 @@ MCPサーバー用の新しいアプリケーションを登録します。
 
 ## 次のステップ
 
-- [5.13 Model Context Protocol (MCP) Integration with Microsoft Foundry](../mcp-foundry-agent-integration/README.md)
+- [5.13 Model Context Protocol (MCP) と Microsoft Foundry の統合](../mcp-foundry-agent-integration/README.md)
 
 ---
 
 <!-- CO-OP TRANSLATOR DISCLAIMER START -->
 **免責事項**：
 本書類は AI 翻訳サービス [Co-op Translator](https://github.com/Azure/co-op-translator) を使用して翻訳されています。正確性を期していますが、自動翻訳には誤りや不正確な部分が含まれる可能性があることをご承知おきください。原文の原語版が正式な情報源とみなされるべきです。重要な情報については、専門の人間による翻訳を推奨します。本翻訳の利用により生じたいかなる誤解や解釈違いについても、当方は責任を負いかねます。
-<!-- CO-OP TRANSLATOR DISCLAIMER END -->
\ No newline at end of file
+<!-- CO-OP TRANSLATOR DISCLAIMER END -->
```

---

### Incident Patch 6: `dccaa8ce` (2026-09-20)
**Commit Message**: Fix note formatting in MCP Foundry Agent README

https://github.com/microsoft/mcp-for-beginners/blob/main/translations/ja/05-AdvancedTopics/mcp-foundry-agent-integration/README.md
#PingMSFTDocs

**File**: `translations/ja/05-AdvancedTopics/mcp-foundry-agent-integration/README.md` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@ Model Context Protocol (MCP) は、AI アプリケーションが外部データ
 
 この統合により、MCP のツールエコシステムの柔軟性と Microsoft Foundry の堅牢なエージェントフレームワークが結合され、幅広いカスタマイズ機能を持つエンタープライズグレードの AI ソリューションが提供されます。
 
-**Note:** Microsoft Foundry Agent Service で MCP を使用したい場合、現在サポートされているリージョンは westus、westus2、uaenorth、southindia、および switzerlandnorth のみです。
+> **注意:** Microsoft Foundry Agent Service で MCP を使用したい場合、現在サポートされているリージョンは westus、westus2、uaenorth、southindia、および switzerlandnorth のみです。
 
 ## 学習目標
 
@@ -383,4 +383,4 @@ MCP 統合をさらに強化するには：
 <!-- CO-OP TRANSLATOR DISCLAIMER START -->
 **免責事項**：
 本書類は AI 翻訳サービス [Co-op Translator](https://github.com/Azure/co-op-translator) を使用して翻訳されています。正確性を期していますが、自動翻訳には誤りや不正確な部分が含まれる可能性があることをご承知おきください。原文の原語版が正式な情報源とみなされるべきです。重要な情報については、専門の人間による翻訳を推奨します。本翻訳の利用により生じたいかなる誤解や解釈違いについても、当方は責任を負いかねます。
-<!-- CO-OP TRANSLATOR DISCLAIMER END -->
\ No newline at end of file
+<!-- CO-OP TRANSLATOR DISCLAIMER END -->
```

---

### Incident Patch 7: `f28800b6` (2026-09-20)
**Commit Message**: Fix formatting issues in README.md

**File**: `05-AdvancedTopics/mcp-foundry-agent-integration/README.md` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ Model Context Protocol (MCP) is an open standard that enables AI applications to
 
 This integration combines the flexibility of MCP's tool ecosystem with Microsoft Foundry's robust agent framework, providing enterprise-grade AI solutions with extensive customization capabilities.
 
-> **Note:**  If you want to use MCP in Microsoft Foundry Agent Service, currently only the following regions are supported: westus, westus2, uaenorth, southindia and switzerlandnorth
+> **Note:** If you want to use MCP in Microsoft Foundry Agent Service, currently only the following regions are supported: westus, westus2, uaenorth, southindia and switzerlandnorth
 
 ## Learning Objectives
 
```

---

### Incident Patch 8: `bdb95f9a` (2026-09-20)
**Commit Message**: Fix formatting of note on MCP region support

Updated note about supported regions for MCP in Microsoft Foundry Agent Service.

https://github.com/microsoft/mcp-for-beginners/blob/main/05-AdvancedTopics/mcp-foundry-agent-integration/README.md
#PingMSFTDocs

**File**: `05-AdvancedTopics/mcp-foundry-agent-integration/README.md` (modified, +2/-2)
```diff
@@ -8,7 +8,7 @@ Model Context Protocol (MCP) is an open standard that enables AI applications to
 
 This integration combines the flexibility of MCP's tool ecosystem with Microsoft Foundry's robust agent framework, providing enterprise-grade AI solutions with extensive customization capabilities.
 
-**Note:** If you want to use MCP in Microsoft Foundry Agent Service, currently only the following regions are supported: westus, westus2, uaenorth, southindia and switzerlandnorth
+> **Note:**  If you want to use MCP in Microsoft Foundry Agent Service, currently only the following regions are supported: westus, westus2, uaenorth, southindia and switzerlandnorth
 
 ## Learning Objectives
 
@@ -376,4 +376,4 @@ For additional support and questions:
 
 ## What's next 
 
-- [5.14 MCP Context Engineering](../mcp-contextengineering/README.md)
\ No newline at end of file
+- [5.14 MCP Context Engineering](../mcp-contextengineering/README.md)
```

---

### Incident Patch 9: `b2009db1` (2026-09-19)
**Commit Message**: fix(i18n): repair historical Markdown table boundaries

**File**: `translations/ar/README.md` (modified, +0/-1)
```diff
@@ -225,7 +225,6 @@ MCP هو بروتوكول - مجموعة من القواعد المتفق علي
 
 | اللغة | الوصف | الرابط |
 |----------|-------------|------|
-
 | C# | مثال لخادم MCP | [عرض الكود](./03-GettingStarted/samples/csharp/README.md) |
 | Java | آلة حاسبة MCP | [عرض الكود](./03-GettingStarted/samples/java/calculator/README.md) |
 | JavaScript | عرض MCP | [عرض الكود](./03-GettingStarted/samples/javascript/README.md) |
```

**File**: `translations/bg/08-BestPractices/reliability-sidecars/README.md` (modified, +0/-1)
```diff
@@ -235,7 +235,6 @@ sidecar да запише завършването.
 | Път | Резултат след повторен опит | Брой билети |
 | --- | --- | --- |
 | Сляп повторен опит | Създава `T-0002` след загуба на отговор за `T-0001` | 2 |
-
 | Защитено повторение | Намира и връща `T-0001` | 1 |
 
 Стартирайте:
```

**File**: `translations/bn/02-Security/README.md` (modified, +0/-1)
```diff
@@ -81,7 +81,6 @@ _(এই পাঠের ভিডিও দেখতে উপরের ছব
 | **MCP04** | সফটওয়্যার সরবরাহ শৃঙ্খল আক্রমণ ও নির্ভরতায় ছলনা | গিটহাব উন্নত নিরাপত্তা, নির্ভরতা স্ক্যানিং |
 | **MCP05** | কমান্ড ইনজেকশন ও নির্বাহ | ইনপুট যাচাই, স্যান্ডবক্সিং |
 | **MCP06** | ইন্টারনেট প্রবাহের বিপর্যয় | আজুর AI কন্টেন্ট সেফটি, প্রম্পট শিল্ডস |
-
 | **MCP07** | অপর্যাপ্ত যাচাইকরণ ও অনুমোদন | Azure Entra ID, OAuth 2.1 উইথ PKCE |
 | **MCP08** | নিরীক্ষণ ও টেলিমেট্রির অভাব | Azure Monitor, Application Insights |
 | **MCP09** | ছায়া MCP সার্ভার | API Center গভর্নেন্স, নেটওয়ার্ক বিচ্ছিন্নতা |
```

**File**: `translations/cs/README.md` (modified, +0/-1)
```diff
@@ -225,7 +225,6 @@ Jednou z nejzajímavějších částí učení MCP je vidět, jak se vaše schop
 
 | Jazyk | Popis | Odkaz |
 |----------|-------------|------|
-
 | C# | MCP Server Příklad | [Zobrazit kód](./03-GettingStarted/samples/csharp/README.md) |
 | Java | MCP Kalkulačka | [Zobrazit kód](./03-GettingStarted/samples/java/calculator/README.md) |
 | JavaScript | MCP Demo | [Zobrazit kód](./03-GettingStarted/samples/javascript/README.md) |
```

**File**: `translations/de/08-BestPractices/reliability-sidecars/README.md` (modified, +0/-1)
```diff
@@ -236,7 +236,6 @@ Prognostizieren Sie das Ergebnis, bevor Sie die Tests ausführen:
 | Pfad | Ergebnis nach erneutem Versuch | Anzahl der Tickets |
 | --- | --- | --- |
 | Blinder erneuter Versuch | Erstellt `T-0002` nach Verlust der Antwort für `T-0001` | 2 |
-
 | Geschützter Retry | Findet und liefert `T-0001` | 1 |
 
 Ausführen:
```

---

### Incident Patch 10: `567e7d9f` (2026-09-18)
**Commit Message**: Fix Docker command configuration in README

Updated Docker configuration in README for mcp-calculator.

**File**: `translations/ja/03-GettingStarted/samples/csharp/README.md` (modified, +12/-14)
```diff
@@ -89,21 +89,19 @@
 
 1. `.vscode/mcp.json` ファイル内のサーバー設定を以下の内容に置き換えます：
    ```json
-   {
-     "mcp-calculator": {
-       "command": "docker",
-       "args": [
-         "run",
-         "--rm",
-         "-i",
-         "<YOUR-DOCKER-USERNAME>/mcp-calculator"
-       ],
-       "envFile": "",
-       "env": {}
-     }
-   }
+    "mcp-calculator": {
+      "command": "docker",
+      "args": [
+        "run",
+        "--rm",
+        "-i",
+        "<YOUR-DOCKER-USERNAME>/mcp-calculator"
+      ],
+      "envFile": "",
+      "env": {}
+    }
    ```
-   設定を見ると、コマンドは `docker`、引数は `run --rm -i <YOUR-DOCKER-USERNAME>/mcp-calc` となっています。`--rm` フラグはコンテナ停止後に削除することを保証し、`-i` フラグはコンテナの標準入力と対話できるようにします。最後の引数は先ほどビルドしてDocker Hubにプッシュしたイメージ名です。
+   設定を見ると、コマンドは `docker`、引数は `run --rm -i <YOUR-DOCKER-USERNAME>/mcp-calculator` となっています。`--rm` フラグはコンテナ停止後に削除することを保証し、`-i` フラグはコンテナの標準入力と対話できるようにします。最後の引数は先ほどビルドしてDocker Hubにプッシュしたイメージ名です。
 
 ## Docker化したバージョンをテストする
 
```

#### Recent Merged Pull Requests:
- **PR #1124** (2026-09-22): [Samples] Fix tool-call ordering and MarkItDown attribution (@leestott)
- **PR #1123** (2026-09-22): [Docs] Update model guidance and Entra authentication flow (@leestott)
- **PR #1122** (2026-09-22): chore(deps): bump anyio from 4.9.0 to 4.14.2 in /10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server (@dependabot[bot])
- **PR #1121** (2026-09-22): chore(deps): bump rmcp from 1.4.0 to 2.1.0 in /03-GettingStarted/02-client/solution/rust (@dependabot[bot])
- **PR #1120** (2026-09-22): Update Japanese translation for MCP Servers link (@hyoshioka0128)
- **PR #1119** (2026-09-22): Revise Japanese README translations and links (@hyoshioka0128)
- **PR #1118** (2026-09-22): Translate 'Community Contributions' section to Japanese (@hyoshioka0128)
- **PR #1117** (2026-09-22): Translate MCP security section to Japanese (@hyoshioka0128)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
