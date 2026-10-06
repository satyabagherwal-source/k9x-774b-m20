# Forensic Learning Record (Deep Inspection): microsoft/mcp-for-beginners

> **Canonical Artifact**: `07_PROJECT_LEARNING/microsoft-mcp-for-beginners-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/microsoft/mcp-for-beginners](https://github.com/microsoft/mcp-for-beginners))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:15:57.313Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `microsoft/mcp-for-beginners`
- **Description**: This open-source curriculum introduces the fundamentals of Model Context Protocol (MCP) through real-world, cross-language examples in .NET, Java, TypeScript, JavaScript, Rust and Python. Designed for developers, it focuses on practical techniques for building modular, scalable, and secure AI workflows from session setup to service orchestration.
- **Primary Language / Ecosystem**: Jupyter Notebook
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 17399 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `03-GettingStarted/11-simple-auth/solution/python/util.py`
```
# pip install PyJWT

# create a token
import jwt
from jwt.exceptions import ExpiredSignatureError, InvalidTokenError
import datetime

# Secret key used to sign the JWT
secret_key = 'your-secret-key'

def generate_token():
    header = {
        "alg": "HS256",
        "typ": "JWT"
    }
    # the user info andits claims and expiry time
    payload = {
        "sub": "1234567890",               # Subject (user ID)
        "name": "User Userson",                # Custom claim
        "admin": True,                     # Custom claim
        "iat": datetime.datetime.utcnow(),# Issued at
        "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1),  # Expiry
        "scopes": ["Admin.Write", "User.Read"]  # Custom claim for scopes/permissions
    }

    # encode it
    encoded_jwt = jwt.encode(payload, secret_key, algorithm="HS256", headers=header)
    print("Encoded JWT:", encoded_jwt)
    return encoded_jwt   

def validate_token(token: str) -> str | None:
    try:
        decoded = jwt.decode(token, secret_key, algorithms=["HS256"])
        # print("✅ Token is valid.")
        # print("Decoded claims:")
        # for key, value in decoded.items():
        #     print(f"  {key}: {value}")
        return decoded
    except ExpiredSignatureError:
        print("❌ Token has expired.")
    except InvalidTokenError as e:
        print(f"❌ Invalid token: {e}")
    return None

if __name__ == "__main__":
    token = generate_token()
    # write to .env file
    with open(".env", "w") as f:
        f.write(f"TOKEN={token}")
    print(token)
    # validate_token(token)
```

### Core Architecture Module: `03-GettingStarted/11-simple-auth/solution/typescript/src/util.ts`
```
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const secretKey = 'your-secret-key'; // Use env vars in production

export function createToken() {
    // Define the payload
    const payload = {
        sub: '1234567890',
        name: 'User usersson',
        admin: true,
        iat: Math.floor(Date.now() / 1000), // Issued at
        exp: Math.floor(Date.now() / 1000) + 60 * 60, // Expires in 1 hour
        scopes: ["Admin.Write", "User.Read"]
    };

    // Define the header (optional, jsonwebtoken sets defaults)
    const header = {
        alg: 'HS256',
        typ: 'JWT'
    };

    // Create the token
    const token = jwt.sign(payload, secretKey, {
        algorithm: 'HS256',
        header: header
    });

    console.log('JWT:', token);
    fs.writeFileSync(path.join(process.cwd(), '.env'), `token=${token}\n`);
    // store to file .env as token=generated token
    console.log('Token stored to .env file');
}

export function verifyToken(token: string) {
    try {
        const decoded = jwt.verify(token, secretKey);
        return decoded;
    } catch (err) {
        console.error('Token verification failed:', err);
        return null;
    }
}

// if run as script, create a token
if (import.meta.url === `file://${process.argv[1]}`) {
    createToken();
}
```

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

### Core Architecture Module: `03-GettingStarted/01-first-server/solution/rust/src/main.rs`
```
use rmcp::{
    ServerHandler, ServiceExt,
    handler::server::{router::tool::ToolRouter, tool::Parameters},
    model::{ServerCapabilities, ServerInfo},
    schemars, tool, tool_handler, tool_router,
    transport::stdio,
};
use std::error::Error;

#[derive(Debug, Clone)]
pub struct Calculator {
    tool_router: ToolRouter<Self>,
}

#[derive(Debug, serde::Deserialize, schemars::JsonSchema)]
pub struct CalculatorRequest {
    pub a: f64,
    pub b: f64,
}

#[tool_router]
impl Calculator {
    pub fn new() -> Self {
        Self {
            tool_router: Self::tool_router(),
        }
    }

    #[tool(description = "Adds a and b")]
    async fn add(
        &self,
        Parameters(CalculatorRequest { a, b }): Parameters<CalculatorRequest>,
    ) -> String {
        (a + b).to_string()
    }
}

#[tool_handler]
impl ServerHandler for Calculator {
    fn get_info(&self) -> ServerInfo {
        ServerInfo {
            instructions: Some("A simple calculator tool".into()),
            capabilities: ServerCapabilities::builder().enable_tools().build(),
            ..Default::default()
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn Error>> {
    let service = Calculator::new().serve(stdio()).await?;
    service.waiting().await?;
    Ok(())
}

```

### Core Architecture Module: `03-GettingStarted/01-first-server/solution/typescript/src/index.ts`
```
import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Create an MCP server
const server = new McpServer({
  name: "Demo",
  version: "1.0.0"
});

// Add an addition tool
server.tool("add",
  { a: z.number(), b: z.number() },
  async ({ a, b }) => ({
    content: [{ type: "text", text: String(a + b) }]
  })
);

// Add a dynamic greeting resource
server.resource(
  "file",
  new ResourceTemplate("file://{path}", { list: undefined }),
  async (uri, { path }) => ({
    contents: [{
      uri: uri.href,
      text: `File, ${path}!`
    }]
  })
);

server.prompt(
  "review-code",
  { code: z.string() },
  ({ code }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Please review this code:\n\n${code}`
      }
    }]
  })
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1154** (2026-10-01): **chore(deps-dev): bump hono from 4.13.1 to 4.13.12 in /10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/inspector**
  *Symptoms*: Bumps [hono](https://github.com/honojs/hono) from 4.13.1 to 4.13.12. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/honojs/hono/releases">hono's releases</a>.</em></p> <blockquote> <h2>v4.13.12</h2> <h2>What's Changed</h2> <ul> <li>fix(build): keep internal types private in bundled d.ts and avoid a self-referencing JSX.IntrinsicElements in <a href="https://redirect.github.com/honojs/hono/pull/5485">honojs/hono#5485</a></li> <li>test(build): type-check the bundled declarations from a consumer project in <a href="https://redirect.github.com/honojs/hono/pull/5486">honojs/hono#5486</a></li> <li>fix(etag): correctly match mixed-case header name in retainedHeader option in <a href="https://redirect.github.com/honojs/hono/pull/5475">honojs/hono#5475</a></li> <li>fix(jsx): add px to numeric gridGap, gridRowGap and gridColumnGap in <a href="https://redirect.github.com/honojs/hono/pull/5487">honojs/hono#5487</a></li> <li>fix(combine): return a Response from a short-circuiting middleware in some() in <a href="https://redirect.github.com/honojs/hono/pull/5391">honojs/hono#5391</a></li> <li>chore(deps): upgrade vite-plus to 1.0.0 in <a href="https://redirect.github.com/honojs/hono/pull/5464">honojs/hono#5464</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/honojs/hono/compare/v4.13.11...v4.13.12">https://github.com/honojs/hono/compare/v4.13.11...v4.13.12</a></p> <h2>v4.13.11</h2> <h2>Security fixes</h2> <h3><code>se

- **Issue #1153** (2026-10-01): **chore(deps): bump ip-address from 10.4.0 to 10.7.2 in /04-PracticalImplementation/samples/typescript**
  *Symptoms*: Bumps [ip-address](https://github.com/beaugunderson/ip-address) from 10.4.0 to 10.7.2. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/beaugunderson/ip-address/releases">ip-address's releases</a>.</em></p> <blockquote> <h2>v10.7.2</h2> <h2>What's Changed</h2> <ul> <li>Accept an arpa suffix in any case and without the root dot in fromArpa by <a href="https://github.com/beaugunderson"><code>@​beaugunderson</code></a> in <a href="https://redirect.github.com/beaugunderson/ip-address/pull/227">beaugunderson/ip-address#227</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/beaugunderson/ip-address/compare/v10.7.1...v10.7.2">https://github.com/beaugunderson/ip-address/compare/v10.7.1...v10.7.2</a></p> <h2>v10.7.1</h2> <h2>What's Changed</h2> <ul> <li>Bump js-yaml and brace-expansion in the lockfile by <a href="https://github.com/beaugunderson"><code>@​beaugunderson</code></a> in <a href="https://redirect.github.com/beaugunderson/ip-address/pull/226">beaugunderson/ip-address#226</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/beaugunderson/ip-address/compare/v10.7.0...v10.7.1">https://github.com/beaugunderson/ip-address/compare/v10.7.0...v10.7.1</a></p> <h2>v10.7.0</h2> <h2>What's Changed</h2> <ul> <li>Add offset() and nextNetwork(), accept prefix-length ip6.arpa names, correct the IPv6 end-address docs by <a href="https://github.com/beaugunderson"><code>@​beaugunderson</code></a> in

- **Issue #1152** (2026-10-01): **chore(deps-dev): bump fast-uri from 3.1.5 to 3.1.8 in /10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab3/code/weather_mcp/inspector**
  *Symptoms*: Bumps [fast-uri](https://github.com/fastify/fast-uri) from 3.1.5 to 3.1.8. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/fastify/fast-uri/releases">fast-uri's releases</a>.</em></p> <blockquote> <h2>v3.1.8</h2> <h2>⚠️ Security Warning</h2> <p>This security release fixes the following medium-severity security advisory:</p> <ul> <li><a href="https://github.com/fastify/fast-uri/security/advisories/GHSA-hrr3-gc8f-f4qj">GHSA-hrr3-gc8f-f4qj</a> — inconsistent host case normalization via percent-encoded octets</li> </ul> <p>Users of the v3.x release line should upgrade to v3.1.8.</p> <p><strong>Full Changelog</strong>: <a href="https://github.com/fastify/fast-uri/compare/v3.1.7...v3.1.8">https://github.com/fastify/fast-uri/compare/v3.1.7...v3.1.8</a></p> <h2>v3.1.7</h2> <h2>⚠️ Security Warning</h2> <p>This is a security release that fixes the following high-severity security advisories:</p> <ul> <li><a href="https://github.com/fastify/fast-uri/security/advisories/GHSA-qw65-cvwx-89v3">GHSA-qw65-cvwx-89v3</a> — authority injection via an unvalidated port in <code>serialize()</code></li> <li><a href="https://github.com/fastify/fast-uri/security/advisories/GHSA-58mr-gqgx-xq4g">GHSA-58mr-gqgx-xq4g</a> — host confusion via unbalanced or misplaced IP-literal brackets</li> </ul> <p>Users of the v3.x release line should upgrade to v3.1.7.</p> <p><strong>Full Changelog</strong>: <a href="https://github.com/fastify/fast-uri/compare/v3.1.6...v3.1.7">

- **Issue #1151** (2026-10-01): **chore(deps): bump pyjwt from 2.13.0 to 2.15.0 in /10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server**
  *Symptoms*: Bumps [pyjwt](https://github.com/jpadilla/pyjwt) from 2.13.0 to 2.15.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/jpadilla/pyjwt/releases">pyjwt's releases</a>.</em></p> <blockquote> <h2>2.15.0</h2> <p>See the <a href="https://github.com/jpadilla/pyjwt/blob/2.15.0/CHANGELOG.rst">2.15.0 changelog</a> for complete release details.</p> <h2>2.14.0</h2> <p>See the <a href="https://github.com/jpadilla/pyjwt/blob/2.14.0/CHANGELOG.rst">2.14.0 changelog</a> for the complete release details and related security advisories.</p> </blockquote> </details> <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/jpadilla/pyjwt/blob/master/CHANGELOG.rst">pyjwt's changelog</a>.</em></p> <blockquote> <h2><code>v2.15.0 &lt;https://github.com/jpadilla/pyjwt/compare/2.14.0...2.15.0&gt;</code>__</h2> <p>Security</p> <pre><code> - Wrap recursion errors from deeply nested JWT payloads in ``DecodeError``   instead of exposing a raw ``RecursionError``. <p>Added</p> <pre><code> - Support Python 3.15 by @kytta in `[#1202](https://github.com/jpadilla/pyjwt/issues/1202) &amp;lt;https://github.com/jpadilla/pyjwt/pull/1202&amp;gt;`__  Changed </code></pre> <ul> <li><code>JWKSetCache</code> now stores the parsed <code>PyJWKSet</code> rather than the raw JWKS payload, so a cache hit no longer re-parses every key. <code>JWKSetCache.put()</code> accepts either form and raises <code>PyJWKSetError</code> for anything else. As a result,

- **Issue #1150** (2026-10-01): **chore(deps): bump pyjwt from 2.13.0 to 2.15.0 in /10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab3/code/weather_mcp**
  *Symptoms*: Bumps [pyjwt](https://github.com/jpadilla/pyjwt) from 2.13.0 to 2.15.0. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/jpadilla/pyjwt/releases">pyjwt's releases</a>.</em></p> <blockquote> <h2>2.15.0</h2> <p>See the <a href="https://github.com/jpadilla/pyjwt/blob/2.15.0/CHANGELOG.rst">2.15.0 changelog</a> for complete release details.</p> <h2>2.14.0</h2> <p>See the <a href="https://github.com/jpadilla/pyjwt/blob/2.14.0/CHANGELOG.rst">2.14.0 changelog</a> for the complete release details and related security advisories.</p> </blockquote> </details> <details> <summary>Changelog</summary> <p><em>Sourced from <a href="https://github.com/jpadilla/pyjwt/blob/master/CHANGELOG.rst">pyjwt's changelog</a>.</em></p> <blockquote> <h2><code>v2.15.0 &lt;https://github.com/jpadilla/pyjwt/compare/2.14.0...2.15.0&gt;</code>__</h2> <p>Security</p> <pre><code> - Wrap recursion errors from deeply nested JWT payloads in ``DecodeError``   instead of exposing a raw ``RecursionError``. <p>Added</p> <pre><code> - Support Python 3.15 by @kytta in `[#1202](https://github.com/jpadilla/pyjwt/issues/1202) &amp;lt;https://github.com/jpadilla/pyjwt/pull/1202&amp;gt;`__  Changed </code></pre> <ul> <li><code>JWKSetCache</code> now stores the parsed <code>PyJWKSet</code> rather than the raw JWKS payload, so a cache hit no longer re-parses every key. <code>JWKSetCache.put()</code> accepts either form and raises <code>PyJWKSetError</code> for anything else. As a result,

- **Issue #1149** (2026-10-01): **Update Japanese README for Module 00 title**
  *Symptoms*: https://github.com/microsoft/mcp-for-beginners/blob/main/translations/ja/README.md   <img width="1206" height="78" alt="image" src="https://github.com/user-attachments/assets/2fbca890-c941-4f7f-8d07-1bfdf26c95f8" />  related https://github.com/Azure/co-op-translator/issues/502  #PingMSFTDocs

- **Issue #1148** (2026-10-01): **Update Japanese README for monitoring terminology**
  *Symptoms*: https://github.com/microsoft/mcp-for-beginners/blob/main/translations/ja/11-MCPServerHandsOnLabs/10-Deployment/README.md   <img width="1189" height="239" alt="image" src="https://github.com/user-attachments/assets/51c23b53-822d-4ea9-8aa0-355589e3f998" />  related https://github.com/Azure/co-op-translator/issues/502  #PingMSFTDocs

- **Issue #1147** (2026-10-01): **chore(deps-dev): bump undici from 8.9.0 to 8.11.2 in /10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab3/code/weather_mcp/inspector**
  *Symptoms*: Bumps [undici](https://github.com/nodejs/undici) from 8.9.0 to 8.11.2. <details> <summary>Release notes</summary> <p><em>Sourced from <a href="https://github.com/nodejs/undici/releases">undici's releases</a>.</em></p> <blockquote> <h2>v8.11.2</h2> <h2>What's Changed</h2> <ul> <li>fix: close rejected HTTP/2 WebSocket handshake streams by <a href="https://github.com/mcollina"><code>@​mcollina</code></a> in <a href="https://redirect.github.com/nodejs/undici/pull/5873">nodejs/undici#5873</a></li> <li>fix: avoid reconnecting aborted requests by <a href="https://github.com/Junaid-PK"><code>@​Junaid-PK</code></a> in <a href="https://redirect.github.com/nodejs/undici/pull/5846">nodejs/undici#5846</a></li> </ul> <h2>New Contributors</h2> <ul> <li><a href="https://github.com/Junaid-PK"><code>@​Junaid-PK</code></a> made their first contribution in <a href="https://redirect.github.com/nodejs/undici/pull/5846">nodejs/undici#5846</a></li> </ul> <p><strong>Full Changelog</strong>: <a href="https://github.com/nodejs/undici/compare/v8.11.1...v8.11.2">https://github.com/nodejs/undici/compare/v8.11.1...v8.11.2</a></p> <h2>v8.11.1</h2> <h2>What's Changed</h2> <ul> <li>deslopify websocket test by <a href="https://github.com/KhafraDev"><code>@​KhafraDev</code></a> in <a href="https://redirect.github.com/nodejs/undici/pull/5851">nodejs/undici#5851</a></li> <li>Revert &quot;fix: preserve HTTP/2 for legacy fetch consumers&quot; by <a href="https://github.com/mcollina"><code>@​mcollina</code></a> in <

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

### Incident Patch 1: `f97a80a6` (2026-10-01)
**Commit Message**: Merge pull request #1154 from microsoft/dependabot/npm_and_yarn/10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/inspector/hono-4.13.12

chore(deps-dev): bump hono from 4.13.1 to 4.13.12 in /10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/inspector

**File**: `10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/inspector/package-lock.json` (modified, +3/-3)
```diff
@@ -2182,9 +2182,9 @@
       }
     },
     "node_modules/hono": {
-      "version": "4.13.1",
-      "resolved": "https://registry.npmjs.org/hono/-/hono-4.13.1.tgz",
-      "integrity": "sha512-kdJoFVv2xmayw6cY09H7AbMJMt8Jn5jdlEdXsP7AGBdF2DIptVlKlOLKXP41yPip4/a3yQPv9gVcJYI8YY04dw==",
+      "version": "4.13.12",
+      "resolved": "https://registry.npmjs.org/hono/-/hono-4.13.12.tgz",
+      "integrity": "sha512-6E2QDAc9Ick9Sq77ZrGS/dk2WUYni91aufTw6LJKpV7w8kW5/GxVUc650FOADOmlwg3K+f7Pun6XlV+pYmW6gw==",
       "dev": true,
       "license": "MIT",
       "engines": {
```

---

### Incident Patch 2: `a80f1861` (2026-10-01)
**Commit Message**: Merge pull request #1152 from microsoft/dependabot/npm_and_yarn/10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab3/code/weather_mcp/inspector/fast-uri-3.1.8

chore(deps-dev): bump fast-uri from 3.1.5 to 3.1.8 in /10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab3/code/weather_mcp/inspector

**File**: `10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab3/code/weather_mcp/inspector/package-lock.json` (modified, +3/-3)
```diff
@@ -1950,9 +1950,9 @@
       "license": "MIT"
     },
     "node_modules/fast-uri": {
-      "version": "3.1.5",
-      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.5.tgz",
-      "integrity": "sha512-gHwA1O9LDIcKunMKhObS/HimwtehO1nPUECKAu5TpKgaO19fcWEl4bliWe1jWxVFvIXztJjjQ4L8XQ1EU9f7Jw==",
+      "version": "3.1.8",
+      "resolved": "https://registry.npmjs.org/fast-uri/-/fast-uri-3.1.8.tgz",
+      "integrity": "sha512-GZMtZUTNRpOVIECoXwLNZS5xUGE+mVNbTB8h/7Rwh2TFWcBQiPzTgyZi05BF9UMZKkLJv8XBRJTlU7zg8+ZfMg==",
       "dev": true,
       "funding": [
         {
```

---

### Incident Patch 3: `3f68a6b3` (2026-10-01)
**Commit Message**: Merge pull request #1151 from microsoft/dependabot/uv/10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/pyjwt-2.15.0

chore(deps): bump pyjwt from 2.13.0 to 2.15.0 in /10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server

**File**: `10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/uv.lock` (modified, +3/-3)
```diff
@@ -652,14 +652,14 @@ wheels = [
 
 [[package]]
 name = "pyjwt"
-version = "2.13.0"
+version = "2.15.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "typing-extensions", version = "4.14.0", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version < '3.11'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/3b/81/58d0ac84e1ef3a3843791d6954d94c0b33d526c75eeb1efbce9d0a4c4077/pyjwt-2.13.0.tar.gz", hash = "sha256:41571c89ca91598c79e8ef18a2d07367d4810fbbd6f637794879baf1b7703423", size = 107515, upload-time = "2026-05-21T19:54:36.618Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/02/a5/5197bfd06417837ac079921c66fa6393f1dea3557272a263cebfef69e432/pyjwt-2.15.0.tar.gz", hash = "sha256:b11c5f9791d7bf51c2b39a81ed669f6b2dbbd669df2942f6c60167e9e3d1abe4", size = 120513, upload-time = "2026-09-23T16:56:00.689Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/a3/5e/ecf12fdb62546d64385c158514e9b2b671f7832108ef2ecd2020ce0af2d1/pyjwt-2.13.0-py3-none-any.whl", hash = "sha256:66adcc2aff09b3f1bbd95fc1e1577df8ac8723c978552fd43304c8a290ac5728", size = 31274, upload-time = "2026-05-21T19:54:35.362Z" },
+    { url = "https://files.pythonhosted.org/packages/e8/55/40e45bf052ee8ee12a4dfd785519660f8effa7b065442b91646ec6828619/pyjwt-2.15.0-py3-none-any.whl", hash = "sha256:7a3742debf6b879e912dbb9819ceec1594be812452b78c5f2e2dfc56564954f8", size = 33680, upload-time = "2026-09-23T16:55:59.241Z" },
 ]
 
 [package.optional-dependencies]
```

---

### Incident Patch 4: `be5eb91d` (2026-10-01)
**Commit Message**: Merge pull request #1150 from microsoft/dependabot/uv/10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab3/code/weather_mcp/pyjwt-2.15.0

chore(deps): bump pyjwt from 2.13.0 to 2.15.0 in /10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab3/code/weather_mcp

**File**: `10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab3/code/weather_mcp/uv.lock` (modified, +3/-3)
```diff
@@ -632,14 +632,14 @@ wheels = [
 
 [[package]]
 name = "pyjwt"
-version = "2.13.0"
+version = "2.15.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "typing-extensions", version = "4.14.0", source = { registry = "https://pypi.org/simple" }, marker = "python_full_version < '3.11'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/3b/81/58d0ac84e1ef3a3843791d6954d94c0b33d526c75eeb1efbce9d0a4c4077/pyjwt-2.13.0.tar.gz", hash = "sha256:41571c89ca91598c79e8ef18a2d07367d4810fbbd6f637794879baf1b7703423", size = 107515, upload-time = "2026-05-21T19:54:36.618Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/02/a5/5197bfd06417837ac079921c66fa6393f1dea3557272a263cebfef69e432/pyjwt-2.15.0.tar.gz", hash = "sha256:b11c5f9791d7bf51c2b39a81ed669f6b2dbbd669df2942f6c60167e9e3d1abe4", size = 120513, upload-time = "2026-09-23T16:56:00.689Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/a3/5e/ecf12fdb62546d64385c158514e9b2b671f7832108ef2ecd2020ce0af2d1/pyjwt-2.13.0-py3-none-any.whl", hash = "sha256:66adcc2aff09b3f1bbd95fc1e1577df8ac8723c978552fd43304c8a290ac5728", size = 31274, upload-time = "2026-05-21T19:54:35.362Z" },
+    { url = "https://files.pythonhosted.org/packages/e8/55/40e45bf052ee8ee12a4dfd785519660f8effa7b065442b91646ec6828619/pyjwt-2.15.0-py3-none-any.whl", hash = "sha256:7a3742debf6b879e912dbb9819ceec1594be812452b78c5f2e2dfc56564954f8", size = 33680, upload-time = "2026-09-23T16:55:59.241Z" },
 ]
 
 [package.optional-dependencies]
```

---

### Incident Patch 5: `cee5d481` (2026-10-01)
**Commit Message**: Merge pull request #1147 from microsoft/dependabot/npm_and_yarn/10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab3/code/weather_mcp/inspector/undici-8.11.2

chore(deps-dev): bump undici from 8.9.0 to 8.11.2 in /10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab3/code/weather_mcp/inspector

**File**: `10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab3/code/weather_mcp/inspector/package-lock.json` (modified, +3/-3)
```diff
@@ -3892,9 +3892,9 @@
       }
     },
     "node_modules/undici": {
-      "version": "8.9.0",
-      "resolved": "https://registry.npmjs.org/undici/-/undici-8.9.0.tgz",
-      "integrity": "sha512-aWZpUj7XoGonMClx4gdDRfgBjqeA+F473aDmROQQbM9n6PRfK/u1q/a0X4wMTgcHfT8H6fpbt98PFuDUwFg2YA==",
+      "version": "8.11.2",
+      "resolved": "https://registry.npmjs.org/undici/-/undici-8.11.2.tgz",
+      "integrity": "sha512-u4UB2/IrKdU6lFxumHmmo1a3fCQO5tzQllRorfoRS63txhrB7xTpSn1PftwC4qEHkOaqP95fCWW4lJzwErwzhQ==",
       "dev": true,
       "license": "MIT",
       "engines": {
```

---

### Incident Patch 6: `ea092bf3` (2026-10-01)
**Commit Message**: Merge pull request #1146 from microsoft/dependabot/npm_and_yarn/10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/inspector/undici-8.11.2

chore(deps-dev): bump undici from 8.9.0 to 8.11.2 in /10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/inspector

**File**: `10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/inspector/package-lock.json` (modified, +3/-3)
```diff
@@ -3892,9 +3892,9 @@
       }
     },
     "node_modules/undici": {
-      "version": "8.9.0",
-      "resolved": "https://registry.npmjs.org/undici/-/undici-8.9.0.tgz",
-      "integrity": "sha512-aWZpUj7XoGonMClx4gdDRfgBjqeA+F473aDmROQQbM9n6PRfK/u1q/a0X4wMTgcHfT8H6fpbt98PFuDUwFg2YA==",
+      "version": "8.11.2",
+      "resolved": "https://registry.npmjs.org/undici/-/undici-8.11.2.tgz",
+      "integrity": "sha512-u4UB2/IrKdU6lFxumHmmo1a3fCQO5tzQllRorfoRS63txhrB7xTpSn1PftwC4qEHkOaqP95fCWW4lJzwErwzhQ==",
       "dev": true,
       "license": "MIT",
       "engines": {
```

---

### Incident Patch 7: `449aa128` (2026-10-01)
**Commit Message**: Merge pull request #1141 from microsoft/dependabot/npm_and_yarn/10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab3/code/weather_mcp/inspector/ip-address-10.7.2

chore(deps-dev): bump ip-address from 10.3.1 to 10.7.2 in /10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab3/code/weather_mcp/inspector

**File**: `10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab3/code/weather_mcp/inspector/package-lock.json` (modified, +3/-3)
```diff
@@ -2366,9 +2366,9 @@
       }
     },
     "node_modules/ip-address": {
-      "version": "10.3.1",
-      "resolved": "https://registry.npmjs.org/ip-address/-/ip-address-10.3.1.tgz",
-      "integrity": "sha512-1e9d3kb97NHJTIJDZW9rKqW2h6+dFa50Dy0fpPSMQp2ADje5gvKsXmdiK6dwY5t76TaTt5+P5N1Y/LoToIxP6g==",
+      "version": "10.7.2",
+      "resolved": "https://registry.npmjs.org/ip-address/-/ip-address-10.7.2.tgz",
+      "integrity": "sha512-7H/2gFSIitxc0hG3nOI1glS8QLo/EHBFFLk8vEUjXY/xu0AdL8jZ9U1IzO2PUm0d2D/ofQcAifb0g6OBkt8U7w==",
       "dev": true,
       "license": "MIT",
       "engines": {
```

---

### Incident Patch 8: `f6893ce5` (2026-10-01)
**Commit Message**: Merge pull request #1140 from microsoft/dependabot/npm_and_yarn/10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/inspector/ip-address-10.7.2

chore(deps-dev): bump ip-address from 10.3.1 to 10.7.2 in /10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/inspector

**File**: `10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/inspector/package-lock.json` (modified, +3/-3)
```diff
@@ -2366,9 +2366,9 @@
       }
     },
     "node_modules/ip-address": {
-      "version": "10.3.1",
-      "resolved": "https://registry.npmjs.org/ip-address/-/ip-address-10.3.1.tgz",
-      "integrity": "sha512-1e9d3kb97NHJTIJDZW9rKqW2h6+dFa50Dy0fpPSMQp2ADje5gvKsXmdiK6dwY5t76TaTt5+P5N1Y/LoToIxP6g==",
+      "version": "10.7.2",
+      "resolved": "https://registry.npmjs.org/ip-address/-/ip-address-10.7.2.tgz",
+      "integrity": "sha512-7H/2gFSIitxc0hG3nOI1glS8QLo/EHBFFLk8vEUjXY/xu0AdL8jZ9U1IzO2PUm0d2D/ofQcAifb0g6OBkt8U7w==",
       "dev": true,
       "license": "MIT",
       "engines": {
```

---

### Incident Patch 9: `35949663` (2026-09-28)
**Commit Message**: Fix translation of 'Lab 06' to 'ラボ06'

https://github.com/microsoft/mcp-for-beginners/blob/main/translations/ja/11-MCPServerHandsOnLabs/05-MCP-Server/README.md
#PingMSFTDocs

**File**: `translations/ja/11-MCPServerHandsOnLabs/05-MCP-Server/README.md` (modified, +3/-3)
```diff
@@ -1017,7 +1017,7 @@ async def test_query_execution():
 
 ## 🚀 次のステップ
 
-**[Lab 06: ツール開発](../06-Tools/README.md)** に進んで以下を学びましょう：
+**[ラボ06: ツール開発](../06-Tools/README.md)** に進んで以下を学びましょう：
 
 - MCPツールコレクションの拡張
 - 高度なクエリパターンの実装
@@ -1043,9 +1043,9 @@ async def test_query_execution():
 
 ---
 
-**次へ**: ツールを拡張する準備はできましたか？ [Lab 06: ツール開発](../06-Tools/README.md) に進みましょう
+**次へ**: ツールを拡張する準備はできましたか？ [ラボ06: ツール開発](../06-Tools/README.md) に進みましょう
 
 ---
 
 **免責事項**:  
-この文書は、AI翻訳サービス[Co-op Translator](https://github.com/Azure/co-op-translator)を使用して翻訳されています。正確性を追求しておりますが、自動翻訳には誤りや不正確な部分が含まれる可能性があることをご承知ください。元の言語で記載された文書が正式な情報源とみなされるべきです。重要な情報については、専門の人間による翻訳を推奨します。この翻訳の使用に起因する誤解や誤解釈について、当方は責任を負いません。
\ No newline at end of file
+この文書は、AI翻訳サービス[Co-op Translator](https://github.com/Azure/co-op-translator)を使用して翻訳されています。正確性を追求しておりますが、自動翻訳には誤りや不正確な部分が含まれる可能性があることをご承知ください。元の言語で記載された文書が正式な情報源とみなされるべきです。重要な情報については、専門の人間による翻訳を推奨します。この翻訳の使用に起因する誤解や誤解釈について、当方は責任を負いません。
```

---

### Incident Patch 10: `98a731d0` (2026-09-26)
**Commit Message**: Fix formatting of lab title in Japanese README

https://github.com/microsoft/mcp-for-beginners/blob/main/translations/ja/11-MCPServerHandsOnLabs/README.md
#PingMSFTDocs

**File**: `translations/ja/11-MCPServerHandsOnLabs/README.md` (modified, +2/-2)
```diff
@@ -150,7 +150,7 @@
 
 ## 🚀 学習を始める準備はできましたか？
 
-**[ラボ 00: MCPデータベース統合入門](./00-Introduction/README.md)** から旅を始めましょう
+**[ラボ00: MCPデータベース統合入門](./00-Introduction/README.md)** から旅を始めましょう
 
 ---
 
@@ -161,4 +161,4 @@
 <!-- CO-OP TRANSLATOR DISCLAIMER START -->
 **免責事項**：
 本書類は AI 翻訳サービス [Co-op Translator](https://github.com/Azure/co-op-translator) を使用して翻訳されています。正確性を期していますが、自動翻訳には誤りや不正確な部分が含まれる可能性があることをご承知おきください。原文の原語版が正式な情報源とみなされるべきです。重要な情報については、専門の人間による翻訳を推奨します。本翻訳の利用により生じたいかなる誤解や解釈違いについても、当方は責任を負いかねます。
-<!-- CO-OP TRANSLATOR DISCLAIMER END -->
\ No newline at end of file
+<!-- CO-OP TRANSLATOR DISCLAIMER END -->
```

---

### Incident Patch 11: `e3333127` (2026-09-25)
**Commit Message**: Update README.md for Agent Builder instructions

https://github.com/microsoft/mcp-for-beginners/blob/main/translations/ja/10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/README.md
#PingMSFTDocs

**File**: `translations/ja/10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/README.md` (modified, +6/-6)
```diff
@@ -33,7 +33,7 @@
 
 環境設定後は、Agent BuilderをMCPクライアントとしてローカル開発マシンでサーバーを起動して始めましょう：
 1. VS Codeのデバッグパネルを開きます。`Debug in Agent Builder` を選択するか、`F5`キーを押してMCPサーバーのデバッグを開始します。
-2. AI ToolkitのAgent Builderを使い、[こちらのプロンプト](../../../../../../../../../../../open_prompt_builder)でサーバーをテストします。サーバーは自動的にAgent Builderに接続されます。
+2. Microsoft Foundry Toolkit for Visual Studio Code Agent Builder で、`gpt-5.1` などのアクティブな Foundry デプロイメントを選択し、「What is the weather in Shanghai?」と入力します。サーバーへの接続が自動的に行われます。
 3. `Run` をクリックしてプロンプトでサーバーをテストします。
 
 **おめでとうございます！** Agent BuilderをMCPクライアントとして使用し、ローカル開発マシンでWeather MCP Serverを正常に実行できました。
@@ -88,15 +88,15 @@
 
 | デバッグモード | 説明 | デバッグ手順 |
 | -------------- | ---- | ----------- |
-| Agent Builder | AI ToolkitのAgent Builder内でMCPサーバーをデバッグする。 | 1. VS Codeのデバッグパネルを開き、`Debug in Agent Builder` を選択し `F5` を押してMCPサーバーのデバッグを開始。<br>2. AI ToolkitのAgent Builderを使い[こちらのプロンプト](../../../../../../../../../../../open_prompt_builder)でサーバーをテスト。サーバーは自動的にAgent Builderに接続される。<br>3. `Run` をクリックしてプロンプトでテスト。 |
+| Agent Builder | AI ToolkitのAgent Builder内でMCPサーバーをデバッグする。 | 1. VS Codeのデバッグパネルを開き、`Debug in Agent Builder` を選択し `F5` を押してMCPサーバーのデバッグを開始。<br>2. Select an active Foundry deployment such as `gpt-5.1`, then enter `What is the weather in Shanghai?`. The server will be connected automatically.<br>3. `Run` をクリックしてプロンプトでテスト。 |
 | MCP Inspector | MCP Inspectorを使ってMCPサーバーをデバッグする。 | 1. [Node.js](https://nodejs.org/) をインストール<br>2. Inspectorをセットアップ：`cd inspector` && `npm install`<br>3. VS Codeのデバッグパネルを開き、`Debug SSE in Inspector (Edge)` または `Debug SSE in Inspector (Chrome)` を選択し、`F5`キーでデバッグ開始。<br>4. MCP Inspectorがブラウザで起動したら、`Connect`ボタンをクリックしてMCPサーバーに接続。<br>5. その後、`List Tools` でツールを選択し、パラメーターを入力し、`Run Tool` でサーバーコードをデバッグ。 |
 
 ## デフォルトポートとカスタマイズ
 
 | デバッグモード | ポート | 定義ファイル | カスタマイズ方法 | 備考 |
 | -------------- | ------ | ----------- | ---------------- | ---- |
-| Agent Builder  | 3001   | [tasks.json](../../../../../../10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/.vscode/tasks.json) | [launch.json](../../../../../../10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/.vscode/launch.json)、[tasks.json](../../../../../../10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/.vscode/tasks.json)、[__init__.py](../../../../../../10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/src/__init__.py)、[mcp.json](../../../../../../10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/.aitk/mcp.json) を編集してポートを変更可能 | N/A |
-| MCP Inspector  | 3001（サーバー）；5173 と 3000（Inspector） | [tasks.json](../../../../../../10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/.vscode/tasks.json) | [launch.json](../../../../../../10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/.vscode/launch.json)、[tasks.json](../../../../../../10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/.vscode/tasks.json)、[__init__.py](../../../../../../10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/src/__init__.py)、[mcp.json](../../../../../../10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/.aitk/mcp.json) を編集してポートを変更可能 | N/A |
+| Agent Builder  | 3001   | [tasks.json](../../../../../../10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/.vscode/tasks.json) | [launch.json](../../../../../../10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/.vscode/launch.json)、[tasks.json](../../../../../../10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/.vscode/tasks.json)、[\_\_init\_\_.py](../../../../../../10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/src/__init__.py)、[mcp.json](../../../../../../10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/.aitk/mcp.json) を編集してポートを変更可能 | N/A |
+| MCP Inspector  | 3001（サーバー）；5173 と 3000（Inspector） | [tasks.json](../../../../../../10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/.vscode/tasks.json) | [launch.json](../../../../../../10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/.vscode/launch.json)、[tasks.json](../../../../../../10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/.vscode/tasks.json)、[\_\_init\_\_.py](../../../../../../10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/src/__init__.py)、[mcp.json](../../../../../../10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/.aitk/mcp.json) を編集してポートを変更可能 | N/A |
 
 ## フィードバック
 
@@ -106,5 +106,5 @@
 
 <!-- CO-OP TRANSLATOR DISCLAIMER START -->
 **免責事項**：  
-本書類はAI翻訳サービス「Co-op Translat
```

---

### Incident Patch 12: `e68302ec` (2026-09-25)
**Commit Message**: Revise debugging instructions for Agent Builder

Updated the debugging instructions for the Agent Builder in the README.md file, including details on selecting active Foundry deployments and testing the server with a specific prompt.
https://github.com/microsoft/mcp-for-beginners/blob/main/translations/ja/10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab3/code/weather_mcp/README.md
#PingMSFTDocs

**File**: `translations/ja/10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab3/code/weather_mcp/README.md` (modified, +2/-2)
```diff
@@ -51,7 +51,7 @@
 
 | デバッグモード | 説明 | デバッグ手順 |
 | ---------- | ----------- | --------------- |
-| Agent Builder | Microsoft Foundry Toolkit経由でAgent Builder内のMCPサーバーをデバッグします。 | 1. VS Codeのデバッグパネルを開きます。`Debug in Agent Builder`を選択し、`F5`キーを押してMCPサーバーのデバッグを開始します。<br>2. Microsoft Foundry Toolkit Agent Builderを使用し、[このプロンプト](../../../../../../../../../../../open_prompt_builder)でサーバーをテストします。サーバーは自動的にAgent Builderに接続されます。<br>3. `Run`をクリックしてプロンプトでサーバーをテストします。 |
+| Agent Builder | Microsoft Foundry Toolkit経由でAgent Builder内のMCPサーバーをデバッグします。 | 1. VS Codeのデバッグパネルを開きます。`Debug in Agent Builder`を選択し、`F5`キーを押してMCPサーバーのデバッグを開始します。<br>2. `gpt-5.1`などのアクティブなFoundryデプロイメントを選択し、「What is the weather in Shanghai?」と入力します。サーバーへの接続が自動的に行われます。<br>3. `Run`をクリックしてプロンプトでサーバーをテストします。 |
 | MCP Inspector | MCP Inspectorを使ってMCPサーバーをデバッグします。 | 1. [Node.js](https://nodejs.org/)をインストール<br>2. Inspectorをセットアップ：`cd inspector` && `npm install` <br>3. VS Codeのデバッグパネルを開き、`Debug SSE in Inspector (Edge)`または`Debug SSE in Inspector (Chrome)`を選択。F5を押してデバッグを開始。<br>4. MCP Inspectorがブラウザで起動したら、`Connect`ボタンをクリックしてこのMCPサーバーに接続。<br>5. その後、`List Tools`でツールを選択し、パラメーターを入力して`Run Tool`でサーバーコードのデバッグが可能です。<br> |
 
 ## デフォルトポートとカスタマイズ
@@ -70,4 +70,4 @@
 <!-- CO-OP TRANSLATOR DISCLAIMER START -->
 **免責事項**：
 本書類は AI 翻訳サービス [Co-op Translator](https://github.com/Azure/co-op-translator) を使用して翻訳されています。正確性を期していますが、自動翻訳には誤りや不正確な部分が含まれる可能性があることをご承知おきください。原文の原語版が正式な情報源とみなされるべきです。重要な情報については、専門の人間による翻訳を推奨します。本翻訳の利用により生じたいかなる誤解や解釈違いについても、当方は責任を負いかねます。
-<!-- CO-OP TRANSLATOR DISCLAIMER END -->
\ No newline at end of file
+<!-- CO-OP TRANSLATOR DISCLAIMER END -->
```

---

### Incident Patch 13: `c080d0d7` (2026-09-23)
**Commit Message**: Fix formatting and translation in apimsample.md

https://github.com/microsoft/mcp-for-beginners/blob/main/translations/ja/09-CaseStudy/travelagentsample.md
#PingMSFTDocs

**File**: `translations/ja/09-CaseStudy/apimsample.md` (modified, +14/-14)
```diff
@@ -101,20 +101,20 @@ Visual Studio CodeでMCPサーバーを追加する方法を見てみましょ
 
 1. 設定をワークスペース設定かユーザー設定のどちらに保存するか選択します。
 
-  - <strong>ワークスペース設定</strong> - 設定は現在のワークスペース内でのみ利用可能な.vscode/mcp.jsonファイルに保存されます。
+    - <strong>ワークスペース設定</strong> - 設定は現在のワークスペース内でのみ利用可能な.vscode/mcp.jsonファイルに保存されます。
 
-    *mcp.json*
+      *mcp.json*
 
-    ```json
-    "servers": {
-        "APIM petstore" : {
-            "type": "http",
-            "url": "url-to-mcp-server/mcp"
-        }
-    }
-    ```
+      ```json
+      "servers": {
+          "APIM petstore" : {
+              "type": "http",
+              "url": "url-to-mcp-server/mcp"
+          }
+      }
+      ```
 
-  - <strong>ユーザー設定</strong> - 設定はグローバルな<em>settings.json</em>ファイルに追加され、全ワークスペースで利用可能です。構成は概ね以下のようになります：
+    - <strong>ユーザー設定</strong> - 設定はグローバルな<em>settings.json</em>ファイルに追加され、全ワークスペースで利用可能です。構成は概ね以下のようになります：
 
     ![ユーザー設定](https://learn.microsoft.com/en-us/azure/api-management/media/export-rest-mcp-server/mcp-servers-visual-studio-code.png)
 
@@ -183,17 +183,17 @@ Visual Studio CodeでMCPサーバーを追加する方法を見てみましょ
 - [VS Code用Azure API Management拡張機能でAPIをインポート・管理](https://learn.microsoft.com/en-us/azure/api-management/visual-studio-code-tutorial)
 
 - [Azure API CenterでリモートMCPサーバーを登録・検出](https://learn.microsoft.com/en-us/azure/api-center/register-discover-mcp-server)
-- [AI Gateway](https://github.com/Azure-Samples/AI-Gateway)！Azure API Managementを用いた多くのAI機能を示す優れたリポジトリ
+- [AI Gateway](https://github.com/Azure-Samples/AI-Gateway) Azure API Managementを用いた多くのAI機能を示す優れたリポジトリ
 - [AI Gateway ワークショップ](https://azure-samples.github.io/AI-Gateway/) Azure Portalを使ったワークショップが含まれており、AI機能の評価を始めるには最適です。
 
 ## 次にやること
 
 - 前に戻る: [ケーススタディの概要](./README.md)
-- 次へ: [Azure AI Travel Agents](./travelagentsample.md)
+- 次へ: [Azure AI トラベルエージェント](./travelagentsample.md)
 
 ---
 
 <!-- CO-OP TRANSLATOR DISCLAIMER START -->
 **免責事項**：
 本書類は AI 翻訳サービス [Co-op Translator](https://github.com/Azure/co-op-translator) を使用して翻訳されています。正確性を期していますが、自動翻訳には誤りや不正確な部分が含まれる可能性があることをご承知おきください。原文の原語版が正式な情報源とみなされるべきです。重要な情報については、専門の人間による翻訳を推奨します。本翻訳の利用により生じたいかなる誤解や解釈違いについても、当方は責任を負いかねます。
-<!-- CO-OP TRANSLATOR DISCLAIMER END -->
\ No newline at end of file
+<!-- CO-OP TRANSLATOR DISCLAIMER END -->
```

---

### Incident Patch 14: `c62ad0d6` (2026-09-22)
**Commit Message**: Fix formatting and duplicate lines in README.md

**File**: `translations/ja/08-BestPractices/reliability-sidecars/README.md` (modified, +2/-1)
```diff
@@ -233,7 +233,8 @@ python -m unittest discover -p "test_*.py" -v
 - [ ] 最初の外部への試行を行う前に、オペレーションキーを作成・保存する。
 - [ ] キーを、呼び出し元、ツールバージョン、および正規化された入力ハッシュに紐付ける。
 - [ ] 既存のキーに対して入力内容が変更されている場合は拒否する。
-- [ ] アトミックな共有ストア操作により、単一の所有者のみを許可する。 - [ ] 冪等性（idempotency）がサポートされている場合は、キーを下流のプロバイダーに転送する。
+- [ ] アトミックな共有ストア操作により、単一の所有者のみを許可する。 
+- [ ] 冪等性（idempotency）がサポートされている場合は、キーを下流のプロバイダーに転送する。
 - [ ] 次の書き込みを行う前に、結果が不確かな処理の整合性を確認（リコンサイル）する。
 - [ ] 検証済みの結果と証拠を、リトライ可能な期間全体にわたって保持する。
 - [ ] 外部での処理結果を安全に確定できない場合は、処理を中断して確認を行う。
```

---

### Incident Patch 15: `5b9b963b` (2026-09-22)
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

#### Recent Merged Pull Requests:
- **PR #1154** (2026-10-01): chore(deps-dev): bump hono from 4.13.1 to 4.13.12 in /10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server/inspector (@dependabot[bot])
- **PR #1153** (2026-10-01): chore(deps): bump ip-address from 10.4.0 to 10.7.2 in /04-PracticalImplementation/samples/typescript (@dependabot[bot])
- **PR #1152** (2026-10-01): chore(deps-dev): bump fast-uri from 3.1.5 to 3.1.8 in /10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab3/code/weather_mcp/inspector (@dependabot[bot])
- **PR #1151** (2026-10-01): chore(deps): bump pyjwt from 2.13.0 to 2.15.0 in /10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab4/code/github_mcp_server (@dependabot[bot])
- **PR #1150** (2026-10-01): chore(deps): bump pyjwt from 2.13.0 to 2.15.0 in /10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab3/code/weather_mcp (@dependabot[bot])
- **PR #1149** (2026-10-01): Update Japanese README for Module 00 title (@hyoshioka0128)
- **PR #1148** (2026-10-01): Update Japanese README for monitoring terminology (@hyoshioka0128)
- **PR #1147** (2026-10-01): chore(deps-dev): bump undici from 8.9.0 to 8.11.2 in /10-StreamliningAIWorkflowsBuildingAnMCPServerWithAIToolkit/lab3/code/weather_mcp/inspector (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
