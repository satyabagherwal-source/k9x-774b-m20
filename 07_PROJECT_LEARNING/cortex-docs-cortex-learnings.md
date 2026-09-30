# Forensic Learning Record (Deep Inspection): cortex-docs/cortex

> **Canonical Artifact**: `07_PROJECT_LEARNING/cortex-docs-cortex-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cortex-docs/cortex](https://github.com/cortex-docs/cortex))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:36:56.070Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cortex-docs/cortex`
- **Description**: Cortex - Generates interactive API documentation, typed SDKs, and MCP servers from OpenAPI, AsyncAPI, GraphQL, gRPC, OpenRPC, and Markdown.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 3237 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `e2e/docker/mock-server.js`
```
const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { WebSocketServer } = require('ws');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { ApolloServer } = require('@apollo/server');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { useServer } = require('graphql-ws/use/ws');

// === Shared data ===
const pets = [
  { id: 'pet-1', name: 'Rex', species: 'DOG', breed: null, age: 3, status: 'AVAILABLE', ownerId: null, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
  { id: 'pet-2', name: 'Whiskers', species: 'CAT', breed: null, age: 2, status: 'ADOPTED', ownerId: null, createdAt: '2025-01-01T00:00:00Z', updatedAt: '2025-01-01T00:00:00Z' },
];
const owners = [
  { id: 'owner-1', name: 'Alice', email: 'alice@example.com', phone: null, pets: [], createdAt: '2025-01-01T00:00:00Z' },
];
const transportStats = {
  wsConnections: 0,
  wsForcedDisconnects: 0,
  wsDisconnectCommands: 0,
  clientHeartbeats: 0,
  serverHeartbeatAcks: 0,
  gqlConnections: 0,
  gqlForcedDisconnects: 0,
  gqlDisconnects: 0,
  slowRequests: 0,
  chunkStreams: 0,
  grpcStreams: 0,
};
let forceNextWsDisconnect = false;
let forceNextGqlDisconnect = false;

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Allow-Headers': '*' });
  res.end(JSON.stringify(data));
}
function readBody(req) {
  return new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(b ? JSON.parse(b) : {})); });
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function readMultipart(req) {
  const contentType = req.headers['content-type'] || '';
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!boundaryMatch) throw new Error('Missing multipart boundary');
  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const raw = (await readRawBody(req)).toString('latin1');
  const fields = {};
  const files = {};
  for (const rawPart of raw.split(`--${boundary}`)) {
    let part = rawPart;
    if (part.startsWith('\r\n')) part = part.slice(2);
    if (part.endsWith('\r\n')) part = part.slice(0, -2);
    if (!part || part === '--') continue;
    if (part.endsWith('--')) part = part.slice(0, -2);
    const separator = part.indexOf('\r\n\r\n');
    if (separator < 0) continue;
    const headers = part.slice(0, separator);
    let content = part.slice(separator + 4);
    if (content.endsWith('\r\n')) content = content.slice(0, -2);
    const disposition = /content-disposition:\s*form-data;([^\r\n]+)/i.exec(headers)?.[1] || '';
    const nameMatch = /(?:^|;)\s*name=(?:"([^"]+)"|([^;\s]+))/i.exec(disposition);
    const name = nameMatch?.[1] || nameMatch?.[2];
    if (!name) continue;
    const filenameMatch = /(?:^|;)\s*filename=(?:"([^"]*)"|([^;\s]+))/i.exec(disposition);
    const filename = filenameMatch ? (filenameMatch[1] ?? filenameMatch[2] ?? '') : undefined;
    if (filename !== undefined) {
      const file = {
        filename,
        contentType: /content-type:\s*([^\r\n]+)/i.exec(headers)?.[1]?.trim() || 'application/octet-stream',
        data: Buffer.from(content, 'latin1'),
      };
      if (!files[name]) files[name] = [];
      files[name].push(file);
    } else {
      fields[name] = Buffer.from(content, 'latin1').toString('utf8');
    }
  }
  return { fields, files };
}

// === GraphQL Schema + Resolvers (Apollo Server) ===
const typeDefs = fs.readFileSync(
  path.join(__dirname, '../../packages/core/__fixtures__/petstore.graphql'), 'utf-8'
);

const resolvers = {
  Query: {
    pets: (_p, args) => ({ data: pets.slice(0, args.limit || pets.length), nextCursor: null }),
    pet: (_p, args) => pets.find(p => p.id === args.id) || null,
    owners: (_p, args) => ({ data: owners.slice(0, args.limit || owners.length) }),
    owner: (_p, args) => owners.find(o => o.id === args.id) || null,
  },
  Mutation: {
    createPet: (_p, args) => ({ id: `pet-${Date.now()}`, ...args.input, status: 'AVAILABLE', ownerId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }),
    updatePet: (_p, args) => ({ ...pets[0], ...args.input, id: args.id }),
    deletePet: () => true,
    createOwner: (_p, args) => ({ id: `owner-${Date.now()}`, ...args.input, pets: [], createdAt: new Date().toISOString() }),
  },
  Subscription: {
    petAdopted: {
      subscribe: async function* (_p, args) {
        const filtered = args.species ? pets.filter(p => p.species === args.species) : pets;
        const items = filtered.length ? filtered : pets;
        let index = 0;
        while (true) {
          yield { petAdopted: items[index % items.length] };
          index++;
          await new Promise(r => setTimeout(r, 1000));
        }
      },
    },
    ownerActivity: {
      subscribe: async function* (_p, args) {
        const owner = owners.find(o => o.id === args.ownerId) || owners[0];
        let update = 0;
        while (true) {
          const name = update === 0 ? owner.name : `${owner.name} (update ${update})`;
          yield { ownerActivity: { ...owner, name } };
          update++;
          await new Promise(r => setTimeout(r, 1000));
        }
      },
    },
  },
  Owner: {
    pets: (owner) => owner.pets?.length ? owner.pets : pets.filter(p => p.ownerId === owner.id),
  },
};

const schema = makeExecutableSchema({ typeDefs, resolvers });
const apollo = new ApolloServer({ schema });

async function startServer() {
  await apollo.start();

  // === 1. HTTP Server (REST + GraphQL via Apollo) ===
  let wsGql;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const p = url.pathname, m = req.method;
    if (m === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Allow-Headers': '*' }); return res.end(); }

    // GraphQL via Apollo Server
    if (p === '/graphql' && m === 'POST') {
      const body = await readBody(req);
      const headers = new Map(Object.entries(req.headers));
      const httpGraphQLResponse = await apollo.executeHTTPGraphQLRequest({
        httpGraphQLRequest: {
          method: m,
          headers,
          body,
          search: url.search || '',
        },
        context: async () => ({}),
      });
      res.writeHead(httpGraphQLResponse.status || 200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Headers': '*',
      });
      if (httpGraphQLResponse.body.kind === 'complete') {
        res.end(httpGraphQLResponse.body.string);
      } else {
        res.end(JSON.stringify({ data: null }));
      }
      return;
    }

    // Transport controls used by the generated SDK resilience tests.
    if (m === 'GET' && p === '/transport/status') return json(res, 200, transportStats);
    if (m === 'POST' && p === '/transport/reset') {
      for (const key of Object.keys(transportStats)) transportStats[key] = 0;
      forceNextWsDisconnect = true;
      forceNextGqlDisconnect = true;
      return json(res, 200, { armed: true });
    }
    if (m === 'POST' && p === '/transport/graphql/disconnect') {
      const clients = wsGql ? [...wsGql.clients] : [];
      transportStats.gqlDisconnects += clients.length;
      for (const client of clients) client.close(4205, 'E2E reconnect test');
      return json(res, 200, { disconnected: clients.length });
    }
    if (m === 'GET' && p === '/transport/slow') {
      transportStats.slowRequests++;
      const requestedDelay = 
```

### Core Architecture Module: `e2e/publish/mock-cargo-registry.js`
```
const http = require('node:http');
const crypto = require('node:crypto');

const crates = new Map();
const index = new Map();

function indexPath(name) {
  const normalized = name.toLowerCase();
  if (normalized.length === 1) return `1/${normalized}`;
  if (normalized.length === 2) return `2/${normalized}`;
  if (normalized.length === 3) return `3/${normalized[0]}/${normalized}`;
  return `${normalized.slice(0, 2)}/${normalized.slice(2, 4)}/${normalized}`;
}

function sendJson(response, status, value) {
  const body = Buffer.from(JSON.stringify(value));
  response.writeHead(status, {
    'content-type': 'application/json',
    'content-length': body.length,
  });
  response.end(body);
}

function parsePublishBody(body) {
  const metadataLength = body.readUInt32LE(0);
  const metadataStart = 4;
  const metadataEnd = metadataStart + metadataLength;
  const metadata = JSON.parse(body.subarray(metadataStart, metadataEnd).toString('utf8'));
  const crateLength = body.readUInt32LE(metadataEnd);
  const crate = body.subarray(metadataEnd + 4, metadataEnd + 4 + crateLength);
  return { metadata, crate };
}

function toIndexEntry(metadata, checksum) {
  const entry = {
    name: metadata.name,
    vers: metadata.vers,
    deps: (metadata.deps || []).map((dependency) => ({
      name: dependency.explicit_name_in_toml || dependency.name,
      req: dependency.version_req,
      features: dependency.features || [],
      optional: Boolean(dependency.optional),
      default_features: dependency.default_features !== false,
      target: dependency.target || null,
      kind: dependency.kind || 'normal',
      registry: dependency.registry || null,
      package: dependency.explicit_name_in_toml ? dependency.name : undefined,
    })),
    cksum: checksum,
    features: metadata.features || {},
    yanked: false,
    links: metadata.links || null,
  };
  if (metadata.rust_version) entry.rust_version = metadata.rust_version;
  return entry;
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://cargo-registry:8000');

  if (request.method === 'GET' && url.pathname === '/health') {
    return sendJson(response, 200, { ok: true });
  }

  if (request.method === 'GET' && url.pathname === '/index/config.json') {
    return sendJson(response, 200, {
      dl: 'http://cargo-registry:8000/api/v1/crates',
      api: 'http://cargo-registry:8000',
    });
  }

  if (request.method === 'GET' && url.pathname.startsWith('/index/')) {
    const key = url.pathname.slice('/index/'.length);
    const entries = index.get(key);
    if (!entries) return sendJson(response, 404, { errors: [{ detail: 'crate not found' }] });
    const body = Buffer.from(`${entries.map((entry) => JSON.stringify(entry)).join('\n')}\n`);
    response.writeHead(200, {
      'content-type': 'text/plain',
      'content-length': body.length,
      etag: `"${crypto.createHash('sha256').update(body).digest('hex')}"`,
    });
    return response.end(body);
  }

  const downloadMatch = url.pathname.match(/^\/api\/v1\/crates\/([^/]+)\/([^/]+)\/download$/);
  if (request.method === 'GET' && downloadMatch) {
    const crate = crates.get(`${downloadMatch[1]}@${downloadMatch[2]}`);
    if (!crate) return sendJson(response, 404, { errors: [{ detail: 'crate archive not found' }] });
    response.writeHead(200, {
      'content-type': 'application/octet-stream',
      'content-length': crate.length,
    });
    return response.end(crate);
  }

  if (request.method === 'PUT' && url.pathname === '/api/v1/crates/new') {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => {
      try {
        const { metadata, crate } = parsePublishBody(Buffer.concat(chunks));
        const checksum = crypto.createHash('sha256').update(crate).digest('hex');
        crates.set(`${metadata.name}@${metadata.vers}`, crate);
        const key = indexPath(metadata.name);
        const entries = index.get(key) || [];
        entries.push(toIndexEntry(metadata, checksum));
        index.set(key, entries);
        sendJson(response, 200, { ok: true });
      } catch (error) {
        sendJson(response, 400, { errors: [{ detail: error.message }] });
      }
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/v1/crates') {
    return sendJson(response, 200, { crates: [], meta: { total: 0 } });
  }

  sendJson(response, 404, { errors: [{ detail: 'not found' }] });
});

server.listen(8000, '0.0.0.0', () => {
  console.log('Cargo registry mock listening on port 8000');
});

```

### Core Architecture Module: `eslint.config.mjs`
```
import eslint from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.next*/**',
      '**/.open-next/**',
      '**/.wrangler/**',
      '**/.cortex/**',
      '**/.cortex-dev-*/**',
      '**/.cortex-build-*/**',
      '**/coverage/**',
      '**/generated/**',
      '**/templates/**',
      '**/__fixtures__/**',
      'packages/docs-ui/public/**',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-empty': ['error', { allowEmptyCatch: true }],
      'no-useless-escape': 'off',
    },
  },
);

```

### Core Architecture Module: `packages/cli/src/app.module.ts`
```
import { Module } from '@nestjs/common';
import { InitCommand } from './commands/init/init.command';
import { GenerateCommand } from './commands/generate/generate.command';
import { ValidateCommand } from './commands/validate/validate.command';
import { DocsCommand } from './commands/docs/docs.command';
import { DocsServeCommand } from './commands/docs/serve.command';
import { DocsBuildCommand } from './commands/docs/build.command';
import { McpCommand } from './commands/mcp/mcp.command';
import { McpGenerateCommand } from './commands/mcp/mcp-generate.command';
import { PublishCommand } from './commands/publish/publish.command';
import { GeneratorsCommand } from './commands/generators/generators.command';
import { GeneratorsExportCommand } from './commands/generators/export.command';
import { ProjectService } from './services/project.service';
import { LoggerService } from './services/logger.service';
import { DeployCommand } from './commands/deploy/deploy.command';
import { McpServeCommand } from './commands/mcp/mcp-serve.command';

@Module({
  providers: [
    InitCommand,
    DeployCommand,
    McpServeCommand,
    GenerateCommand,
    ValidateCommand,
    DocsCommand,
    DocsServeCommand,
    DocsBuildCommand,
    McpCommand,
    McpGenerateCommand,
    PublishCommand,
    GeneratorsCommand,
    GeneratorsExportCommand,
    ProjectService,
    LoggerService,
  ],
})
export class AppModule {}

```

### Core Architecture Module: `packages/cli/src/commands/deploy/deploy.command.ts`
```
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { execFileSync } from 'node:child_process';
import { Command, CommandRunner } from 'nest-commander';
import {
  assertProjectName,
  HOSTING_API,
  parseRepository,
  readRepositorySnapshot,
  sha256,
  validateManifest,
  type UploadFile,
} from '@cortex-docs/core/hosting';
import { DocsBuildCommand } from '../docs/build.command';
import { LoggerService } from '../../services/logger.service';
import {
  materializeRepository,
  assertLocalSpecReferences,
  rewriteRepositoryMarkdown,
  mapConcurrent,
} from '../../services/repository-docs';

export function githubToken(): string | undefined {
  const fromEnvironment = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (fromEnvironment) return fromEnvironment;
  try {
    return (
      execFileSync('gh', ['auth', 'token', '--hostname', 'github.com'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 5000,
      }).trim() || undefined
    );
  } catch {
    return undefined;
  }
}

export function hostingApi(): string {
  const url = new URL(process.env.CORTEX_HOSTING_API ?? HOSTING_API);
  if (
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
  )
    throw new Error(
      'CORTEX_HOSTING_API must be an HTTPS origin (HTTP is allowed only on localhost).',
    );
  return url.origin;
}

export async function deploymentRequest(
  api: string,
  route: string,
  token: string,
  init: RequestInit = {},
): Promise<Record<string, any>> {
  const response = await fetch(`${api}${route}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
    redirect: 'error',
    signal: AbortSignal.timeout(route.endsWith('/finalize') ? 300_000 : 60_000),
  });
  let data: Record<string, any>;
  try {
    data = (await response.json()) as Record<string, any>;
  } catch {
    throw new Error(`Hosting service returned HTTP ${response.status}.`);
  }
  if (!response.ok)
    throw new Error(
      typeof data.error === 'string' ? data.error : `Hosting request failed (${response.status}).`,
    );
  return data;
}

export async function buildManifest(directory: string): Promise<UploadFile[]> {
  const files: UploadFile[] = [];
  async function walk(relative: string): Promise<void> {
    for (const entry of fs.readdirSync(path.join(directory, relative), { withFileTypes: true })) {
      const filename = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isSymbolicLink()) throw new Error(`Static output contains a symlink: ${filename}`);
      if (entry.isDirectory()) await walk(filename);
      else {
        const bytes = fs.readFileSync(path.join(directory, filename));
        files.push({ path: filename, size: bytes.byteLength, sha256: await sha256(bytes) });
      }
    }
  }
  await walk('');
  return validateManifest(files.sort((a, b) => a.path.localeCompare(b.path)));
}

@Command({
  name: 'deploy',
  arguments: '[repository]',
  description:
    'Deploy default-branch documentation from a public GitHub repository to cortexdocs.dev',
})
export class DeployCommand extends CommandRunner {
  constructor(
    private readonly logger: LoggerService,
    private readonly build: DocsBuildCommand,
  ) {
    super();
  }

  async run(params: string[]): Promise<void> {
    this.logger.header('Cortex Open Source Hosting');
    const input =
      params[0] ??
      execFileSync('git', ['remote', 'get-url', 'origin'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim();
    const repository = parseRepository(input).url;
    const token = githubToken();
    if (!token)
      throw new Error(
        'Sign in with gh auth login, or set GITHUB_TOKEN with write access to this public repository.',
      );
    const api = hostingApi();
    const snapshot = await readRepositorySnapshot(repository, { token, requirePush: true });
    assertProjectName(snapshot.config.project);
    this.logger.info(
      `Repository: ${repository} (${snapshot.branch} @ ${snapshot.commit.slice(0, 8)})`,
    );
    const request = { repository, fingerprint: snapshot.fingerprint };
    let result = await deploymentRequest(api, '/v1/deployments', token, {
      method: 'POST',
      body: JSON.stringify(request),
    });
    if (result.status !== 'unchanged') {
      const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-deploy-'));
      let pending: { id: string; token: string } | undefined;
      try {
        await materializeRepository(snapshot, directory);
        assertLocalSpecReferences(snapshot, directory);
        rewriteRepositoryMarkdown(snapshot, directory);
        const output = path.join(directory, '.site');
        await this.build.run([], {
          output,
          config: path.join(directory, 'cortex.config.yml'),
          repository,
        });
        const files = await buildManifest(output);
        result = await deploymentRequest(api, '/v1/deployments', token, {
          method: 'POST',
          body: JSON.stringify({ ...request, files }),
        });
        if (result.status !== 'unchanged') {
          if (typeof result.deploymentId !== 'string' || typeof result.uploadToken !== 'string')
            throw new Error('Hosting service returned an invalid upload session.');
          pending = { id: result.deploymentId, token: result.uploadToken };
          const session = pending;
          this.logger.info(`Uploading ${files.length} files...`);
          await mapConcurrent(files, 4, async (file) => {
            await deploymentRequest(
              api,
              `/v1/deployments/${session.id}/files/${encodeURIComponent(file.path)}`,
              session.token,
              {
                method: 'PUT',
                headers: { 'Content-Type': 'application/octet-stream' },
                body: fs.readFileSync(path.join(output, file.path)),
              },
            );
          });
          result = await deploymentRequest(api, `/v1/deployments/${session.id}/finalize`, token, {
            method: 'POST',
          });
          pending = undefined;
        }
      } finally {
        if (pending)
          await deploymentRequest(api, `/v1/deployments/${pending.id}`, pending.token, {
            method: 'DELETE',
          }).catch(() => {});
        fs.rmSync(directory, { recursive: true, force: true });
      }
    }
    this.logger.success(
      `${result.status === 'unchanged' ? 'Unchanged — skipped build and upload' : 'Deployed'}: ${result.url}`,
    );
    const domain = await deploymentRequest(
      api,
      `/v1/projects/${snapshot.config.project}/domain`,
      token,
      { method: 'POST' },
    );
    if (domain.status !== 'not_configured') {
      this.logger.info(`Custom domain: ${domain.hostname} (${domain.status})`);
      if (domain.status !== 'active') {
        for (const record of domain.records ?? [])
          this.logger.info(`${record.type} ${record.name} → ${record.value}`);
        if (domain.validationRecords)
          this.logger.info(`Certificate validation: ${JSON.stringify(domain.validationRecords)}`);
        if (domain.ownershipVerification)
          this.logger.info(`Hostname validation: ${JSON.stringify(domain.ownershipVerification)}`);
        this.logger.info('Add the DNS records, then rerun cortex deploy to check activation.');
      }
    }
    this.logger.info(`Local MCP: npx -y @cortex-docs/cli mcp-serve ${repository}`);
  }
}

```

### Core Architecture Module: `packages/cli/src/commands/generate/generate.command.ts`
```
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Worker } from 'node:worker_threads';
import { Command, CommandRunner, Option } from 'nest-commander';
import {
  CodegenEngine,
  FileEmitter,
  assertTemplateRoot,
  createDefaultRegistry,
} from '@cortex-docs/codegen';
import { McpGenerator } from '@cortex-docs/mcp-gen';
import type { AsyncApiSpec, LanguageConfig, SourceConfig } from '@cortex-docs/core';
import {
  AsyncAPIParser,
  GraphQLParser,
  GrpcParser,
  OpenRpcParser,
  getAllLanguageTemplateDirs,
  getSourcesByType,
  resolveGeneratorTemplateRoot,
  resolveLanguageTemplateDir,
  sourceHasLanguage,
} from '@cortex-docs/core';
import { LoggerService } from '../../services/logger.service';
import { ProjectService } from '../../services/project.service';
import {
  emptyParsedSpec,
  mergeAsyncApiSpecs,
  mergeGraphQLSpecs,
  mergeGrpcSpecs,
  mergeOpenRpcSpecs,
  mergeParsedSpecs,
  sourceTitle,
} from './spec-merge';

interface ParsedSource<T> {
  source: SourceConfig;
  spec: T;
}

@Command({
  name: 'generate',
  description: 'Regenerate SDKs, MCP server, and WebSocket clients from cortex.config.yml',
})
export class GenerateCommand extends CommandRunner {
  constructor(
    private readonly logger: LoggerService,
    private readonly project: ProjectService,
  ) {
    super();
  }

  async run(
    params: string[],
    options: { config?: string; language?: string; noMcp?: boolean; dryRun?: boolean },
  ): Promise<void> {
    this.logger.header('Cortex Generate');

    const configFile = await this.project.findConfig();
    if (!configFile && !options.config) {
      this.logger.error('No cortex.config.yml found.');
      this.logger.info(
        'Run `cortex init <project-name> --open-api <spec>` first to set up your project.',
      );
      process.exitCode = 1;
      return;
    }

    const config = await this.project.loadConfig(options.config);
    const resolvedConfigPath = path.resolve(options.config ?? configFile!);
    const templateRoot = resolveGeneratorTemplateRoot(config, resolvedConfigPath);
    assertTemplateRoot(templateRoot);
    const languageTemplateDirs = getAllLanguageTemplateDirs(config, resolvedConfigPath);
    for (const templateDir of languageTemplateDirs) assertTemplateRoot(templateDir);
    this.logger.info(`Config: ${resolvedConfigPath}`);
    if (templateRoot) this.logger.info(`Templates: ${templateRoot}`);
    if (languageTemplateDirs.length > 0) {
      this.logger.info(`Source templates: ${languageTemplateDirs.length}`);
    }

    if (options.language) {
      config.languages = config.languages.filter((l) => l.language === options.language);
      if (config.languages.length === 0) {
        this.logger.error(`Language "${options.language}" not found in config.`);
        process.exitCode = 1;
        return;
      }
    }

    const openapiSources = getSourcesByType(config, 'openapi-spec');
    const asyncapiSources = getSourcesByType(config, 'asyncapi-spec');
    const gqlSources = getSourcesByType(config, 'graphql-spec');
    const grpcSources = getSourcesByType(config, 'grpc-spec');
    const openRpcSources = getSourcesByType(config, 'openrpc-spec');

    const [restSources, asyncSources, graphQLSources, grpcParsedSources, openRpcParsedSources] =
      await Promise.all([
        this.parseSources(openapiSources, 'OpenAPI', (source) =>
          this.project.parseSpec(source.spec),
        ),
        this.parseSources(asyncapiSources, 'AsyncAPI', (source) =>
          new AsyncAPIParser().parse(source.spec),
        ),
        this.parseSources(gqlSources, 'GraphQL', (source) =>
          new GraphQLParser().parse(source.spec, source.endpoint),
        ),
        this.parseSources(grpcSources, 'gRPC', (source) => new GrpcParser().parse(source.spec)),
        this.parseSources(openRpcSources, 'OpenRPC', (source) =>
          new OpenRpcParser().parse(source.spec),
        ),
      ]);

    const projectTitle = config.title ?? config.project;
    const restSpec = mergeParsedSpecs(
      restSources.map(({ spec }) => spec),
      projectTitle,
    );
    const asyncSpec = mergeAsyncApiSpecs(
      asyncSources.map(({ spec }) => spec),
      sourceTitle(config, 'WebSocket API'),
    );
    const gqlSpec = mergeGraphQLSpecs(
      graphQLSources.map(({ spec }) => spec),
      sourceTitle(config, 'GraphQL API'),
    );
    mergeGrpcSpecs(
      grpcParsedSources.map(({ spec }) => spec),
      sourceTitle(config, 'gRPC API'),
    );
    const openRpcSpec = mergeOpenRpcSpecs(
      openRpcParsedSources.map(({ spec }) => spec),
      sourceTitle(config, 'OpenRPC API'),
    );

    this.logger.info(`Languages: ${config.languages.map((l) => l.language).join(', ')}`);
    this.logger.info('');

    if (options.dryRun) {
      this.logger.info('Dry run — no files will be written.');
      for (const langConfig of config.languages) {
        const protocols = this.protocolsForLanguage(config.sources, langConfig);
        this.logger.info(
          `  ${langConfig.language} [${protocols.join(' + ')}] → ${langConfig.output_dir}`,
        );
      }
      if (!options.noMcp && this.canGenerateMcp(config)) {
        this.logger.info(`  mcp-server → ${config.output.base_dir}/mcp-server`);
      }
      return;
    }

    // --- Generate unified SDK per language ---
    const emitter = new FileEmitter();
    if (config.languages.length > 0) {
      const workerPath = path.resolve(__dirname, 'lang-worker.js');
      const mapReplacer = (_key: string, value: unknown) => {
        if (value instanceof Map) return { __type: 'Map', entries: Array.from(value.entries()) };
        return value;
      };

      const workerPromises = config.languages.map(async (langConfig) => {
        const relevant = <T>(items: ParsedSource<T>[]) =>
          items.filter(({ source }) =>
            sourceHasLanguage(source, langConfig.language, langConfig.package_name),
          );
        const languageRestSources = relevant(restSources);
        const languageAsyncSources = relevant(asyncSources);
        const languageGraphQLSources = relevant(graphQLSources);
        const languageGrpcSources = relevant(grpcParsedSources);
        const languageOpenRpcSources = relevant(openRpcParsedSources);
        const languageRestSpec =
          mergeParsedSpecs(
            languageRestSources.map(({ spec }) => spec),
            projectTitle,
          ) ?? emptyParsedSpec(projectTitle);
        const languageAsyncSpec = mergeAsyncApiSpecs(
          languageAsyncSources.map(({ spec }) => spec),
          sourceTitle(config, 'WebSocket API'),
        );
        const languageGraphQLSpec = mergeGraphQLSpecs(
          languageGraphQLSources.map(({ spec }) => spec),
          sourceTitle(config, 'GraphQL API'),
        );
        const languageGrpcSpec = mergeGrpcSpecs(
          languageGrpcSources.map(({ spec }) => spec),
          sourceTitle(config, 'gRPC API'),
        );
        const languageOpenRpcSpec = mergeOpenRpcSpecs(
          languageOpenRpcSources.map(({ spec }) => spec),
          sourceTitle(config, 'OpenRPC API'),
        );
        const languageConfig = {
          ...config,
          sources: config.sources.filter((source) =>
            sourceHasLanguage(source, langConfig.language, langConfig.package_name),
          ),
          languages: [langConfig],
        };
        const engine = new CodegenEngine(createDefaultRegistry(), emitter);
        const result = await engine.generate(languageRestSpec, languageConfig, {
          gqlSpec: languageGraphQLSpec ?? undefined,
          asyncSpec: languageAsyncSpec ?? undefined,
          grpcSpec: languageGrpcSpec ?? undefined,
          openRpcSpec: languageOpenRpcSpec ?? undefined,
          templateRoot,
          configPath: resolvedConfigPath,
        });
        if (result.errors.length > 0) {
          return {
            language: langConfig.language,
            totalFiles: 0,
            protocols: [],
            langDir: langConfig.ou
```

### Core Architecture Module: `packages/cli/src/commands/generate/lang-worker.ts`
```
import { parentPort, workerData } from 'node:worker_threads';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface WorkerInput {
  language: string;
  packageName: string;
  outputDir: string;
  githubRepository?: string;
  hasRest: boolean;
  restResultJson: string;
  asyncSpecJson: string | null;
  gqlSpecJson: string | null;
  grpcSpecJson: string | null;
  openRpcSpecJson: string | null;
  version: string;
  asyncapiSourceTitle?: string;
  asyncapiHeartbeat?: import('@cortex-docs/core').WebSocketHeartbeatConfig;
  graphqlSourceTitle?: string;
  grpcSourceTitle?: string;
  openRpcSourceTitle?: string;
  templateRoot?: string;
  restTemplateDir?: string;
  asyncapiTemplateDir?: string;
  graphqlTemplateDir?: string;
  grpcTemplateDir?: string;
  openRpcTemplateDir?: string;
}

function mapReviver(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && (value as Record<string, unknown>).__type === 'Map') {
    return new Map((value as { entries: Array<[string, unknown]> }).entries);
  }
  return value;
}

async function run() {
  const input = workerData as WorkerInput;
  const {
    FileEmitter,
    WsTemplateEngine,
    createWsPluginForLanguage,
    GqlTemplateEngine,
    createGqlPluginForLanguage,
    GrpcTemplateEngine,
    createGrpcPluginForLanguage,
    OpenRpcTemplateEngine,
    createOpenRpcPluginForLanguage,
  } = await import('@cortex-docs/codegen');

  const emitter = new FileEmitter();
  const langDir = input.outputDir;
  const restResult = JSON.parse(input.restResultJson, mapReviver);
  const langResult = restResult.languages.find(
    (l: { language: string }) => l.language === input.language,
  );
  let totalFiles = langResult?.emit?.written?.length ?? 0;
  const protocols = input.hasRest ? ['REST'] : [];

  if (input.asyncSpecJson) {
    const asyncSpec = JSON.parse(input.asyncSpecJson, mapReviver);
    const wsEngine = new WsTemplateEngine();
    const wsLangConfig = createWsPluginForLanguage(input.language);
    if (wsLangConfig) {
      const wsFiles = (
        await wsEngine.generate(
          asyncSpec,
          input.packageName,
          input.version,
          wsLangConfig,
          input.asyncapiSourceTitle,
          input.asyncapiHeartbeat,
          { templateRoot: input.templateRoot, templateDir: input.asyncapiTemplateDir },
        )
      ).filter((f) => f.path.startsWith('src/'));
      totalFiles += (await emitter.writeFiles(wsFiles, langDir)).written.length;
      protocols.push('WS');
    }
  }

  if (input.gqlSpecJson) {
    const gqlSpec = JSON.parse(input.gqlSpecJson, mapReviver);
    const gqlEngine = new GqlTemplateEngine();
    const gqlLangConfig = createGqlPluginForLanguage(input.language);
    if (gqlLangConfig) {
      const gqlFiles = (
        await gqlEngine.generate(
          gqlSpec,
          input.packageName,
          input.version,
          gqlLangConfig,
          input.graphqlSourceTitle,
          { templateRoot: input.templateRoot, templateDir: input.graphqlTemplateDir },
        )
      ).filter((f) => f.path.startsWith('src/'));
      totalFiles += (await emitter.writeFiles(gqlFiles, langDir)).written.length;
      protocols.push('GraphQL');
    }
  }

  if (input.grpcSpecJson) {
    const grpcSpec = JSON.parse(input.grpcSpecJson, mapReviver);
    const grpcEngine = new GrpcTemplateEngine();
    const grpcLangConfig = createGrpcPluginForLanguage(input.language);
    if (grpcLangConfig) {
      const grpcFiles = (
        await grpcEngine.generate(
          grpcSpec,
          input.packageName,
          input.version,
          grpcLangConfig,
          input.grpcSourceTitle,
          { templateRoot: input.templateRoot, templateDir: input.grpcTemplateDir },
        )
      ).filter((file) => file.path.startsWith('src/'));
      totalFiles += (await emitter.writeFiles(grpcFiles, langDir)).written.length;
      protocols.push('gRPC');
    }
  }

  if (input.openRpcSpecJson) {
    const openRpcSpec = JSON.parse(input.openRpcSpecJson, mapReviver);
    const openRpcEngine = new OpenRpcTemplateEngine();
    const openRpcLangConfig = createOpenRpcPluginForLanguage(input.language);
    if (openRpcLangConfig) {
      const allOpenRpcFiles = await openRpcEngine.generate(
        openRpcSpec,
        input.packageName,
        input.version,
        openRpcLangConfig,
        input.openRpcSourceTitle,
        { templateRoot: input.templateRoot, templateDir: input.openRpcTemplateDir },
      );
      const openRpcFiles = allOpenRpcFiles.filter((f) => f.path.startsWith('src/'));
      totalFiles += (await emitter.writeFiles(openRpcFiles, langDir)).written.length;
      protocols.push('OpenRPC');

      const openRpcPkgFile = allOpenRpcFiles.find((f) => f.path === 'package.json');
      if (openRpcPkgFile) {
        const mainPkgPath = path.resolve(langDir, 'package.json');
        if (fs.existsSync(mainPkgPath)) {
          const mainPkg = JSON.parse(fs.readFileSync(mainPkgPath, 'utf-8'));
          const rpcPkg = JSON.parse(openRpcPkgFile.content);
          if (rpcPkg.dependencies) {
            mainPkg.dependencies = { ...mainPkg.dependencies, ...rpcPkg.dependencies };
          }
          fs.writeFileSync(mainPkgPath, JSON.stringify(mainPkg, null, 2) + '\n');
        }
      }
    }
  }

  if ((input.restTemplateDir || input.templateRoot) && langResult?.files) {
    const customFilesDirs = [
      input.restTemplateDir ? path.join(input.restTemplateDir, 'files') : undefined,
      input.templateRoot
        ? path.join(input.templateRoot, 'languages', input.language, 'files')
        : undefined,
    ].filter((directory): directory is string => !!directory);
    const finalOverrides = langResult.files.filter((file: { path: string }) =>
      customFilesDirs.some((directory) => fs.existsSync(path.join(directory, `${file.path}.ejs`))),
    );
    if (finalOverrides.length > 0) await emitter.writeFiles(finalOverrides, langDir);
  }

  parentPort?.postMessage({ language: input.language, totalFiles, protocols, langDir });
}

run().catch((err) => {
  parentPort?.postMessage({ language: workerData.language, error: err.message });
});

```

### Core Architecture Module: `packages/cli/src/commands/generators/export.command.ts`
```
import * as fs from 'node:fs';
import * as path from 'node:path';
import { SubCommand, CommandRunner, Option } from 'nest-commander';
import { createDefaultRegistry, findLanguageTemplateDir } from '@cortex-docs/codegen';
import {
  resolveGeneratorTemplateRoot,
  resolveLanguageTemplateDir,
  type CortexConfig,
} from '@cortex-docs/core';
import { findMcpTemplateDir } from '@cortex-docs/mcp-gen';
import { LoggerService } from '../../services/logger.service';
import { ProjectService } from '../../services/project.service';

export const GENERATOR_PROTOCOLS = ['rest', 'graphql', 'websocket', 'grpc', 'openrpc'] as const;

export type GeneratorProtocol = (typeof GENERATOR_PROTOCOLS)[number];

export interface GeneratorExportRequest {
  templateRoot: string;
  languages?: string[];
  includeMcp?: boolean;
  protocol?: string;
  force?: boolean;
  /** Copy one language directly into this directory instead of languages/<language>. */
  directLanguageRoot?: boolean;
}

export interface GeneratorExportResult {
  templateRoot: string;
  created: string[];
  overwritten: string[];
  skipped: string[];
}

interface ExportCommandOptions {
  language?: string;
  mcp?: boolean;
  all?: boolean;
  output?: string;
  protocol?: string;
  force?: boolean;
  config?: string;
}

function portablePath(value: string): string {
  return value.split(path.sep).join('/');
}

function collectTemplates(root: string, options?: { ignoreTopLevel?: Set<string> }): string[] {
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
    throw new Error(`Built-in template directory not found: ${root}`);
  }

  const files: string[] = [];
  const visit = (directory: string, relativeDirectory = ''): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!relativeDirectory && options?.ignoreTopLevel?.has(entry.name)) continue;
      const relativePath = path.join(relativeDirectory, entry.name);
      const sourcePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(sourcePath, relativePath);
      if (entry.isFile() && entry.name.endsWith('.ejs')) files.push(relativePath);
    }
  };
  visit(root);
  return files.sort();
}

function copyTemplates(
  sourceRoot: string,
  destinationRoot: string,
  reportPrefix: string,
  result: GeneratorExportResult,
  force: boolean,
  options?: { ignoreTopLevel?: Set<string> },
): void {
  for (const relativePath of collectTemplates(sourceRoot, options)) {
    const sourcePath = path.join(sourceRoot, relativePath);
    const destinationPath = path.join(destinationRoot, relativePath);
    const reportPath = portablePath(path.join(reportPrefix, relativePath));

    if (fs.existsSync(destinationPath) && !force) {
      result.skipped.push(reportPath);
      continue;
    }

    fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
    const existed = fs.existsSync(destinationPath);
    fs.copyFileSync(sourcePath, destinationPath);
    (existed ? result.overwritten : result.created).push(reportPath);
  }
}

export function exportGeneratorTemplates(request: GeneratorExportRequest): GeneratorExportResult {
  const availableLanguages = createDefaultRegistry().getAvailableLanguages();
  const languages = request.languages ?? [];
  const protocol = request.protocol;

  for (const language of languages) {
    if (!availableLanguages.includes(language)) {
      throw new Error(
        `Unsupported language "${language}". Available languages: ${availableLanguages.join(', ')}`,
      );
    }
  }
  if (protocol && !GENERATOR_PROTOCOLS.includes(protocol as GeneratorProtocol)) {
    throw new Error(
      `Unsupported protocol "${protocol}". Available protocols: ${GENERATOR_PROTOCOLS.join(', ')}`,
    );
  }
  if (protocol && (languages.length !== 1 || request.includeMcp)) {
    throw new Error('Use --protocol with one language export only.');
  }
  if (request.directLanguageRoot && (languages.length !== 1 || request.includeMcp)) {
    throw new Error('A direct language export requires one language only.');
  }
  if (languages.length === 0 && !request.includeMcp) {
    throw new Error('Select a language, MCP templates, or all templates.');
  }

  const templateRoot = path.resolve(request.templateRoot);
  if (fs.existsSync(templateRoot) && !fs.statSync(templateRoot).isDirectory()) {
    throw new Error(`Template output path is not a directory: ${templateRoot}`);
  }
  fs.mkdirSync(templateRoot, { recursive: true });

  const result: GeneratorExportResult = {
    templateRoot,
    created: [],
    overwritten: [],
    skipped: [],
  };

  for (const language of languages) {
    const languageRoot = findLanguageTemplateDir(language);
    const sourceRoot = protocol ? path.join(languageRoot, protocol) : languageRoot;
    const relativeRoot = request.directLanguageRoot
      ? (protocol ?? '')
      : path.join('languages', language, ...(protocol ? [protocol] : []));
    copyTemplates(
      sourceRoot,
      path.join(templateRoot, relativeRoot),
      relativeRoot,
      result,
      request.force === true,
    );
  }

  if (request.includeMcp) {
    copyTemplates(
      findMcpTemplateDir(),
      path.join(templateRoot, 'mcp'),
      'mcp',
      result,
      request.force === true,
      { ignoreTopLevel: new Set(['templates']) },
    );
  }

  return result;
}

export function resolveGeneratorExportRoot(
  output: string | undefined,
  config: CortexConfig | undefined,
  configPath?: string,
): string | undefined {
  if (output) return path.resolve(output);
  return config ? resolveGeneratorTemplateRoot(config, configPath) : undefined;
}

@SubCommand({
  name: 'export',
  description: 'Export installed generator templates for customization',
})
export class GeneratorsExportCommand extends CommandRunner {
  constructor(
    private readonly logger: LoggerService,
    private readonly project: ProjectService,
  ) {
    super();
  }

  async run(_params: string[], options: ExportCommandOptions): Promise<void> {
    this.logger.header('Cortex Generator Export');

    try {
      if (options.all && (options.language || options.mcp)) {
        throw new Error('Do not combine --all with --language or --mcp.');
      }

      const configPath = options.config
        ? path.resolve(options.config)
        : ((await this.project.findConfig()) ?? undefined);
      const config =
        !options.output && configPath ? await this.project.loadConfig(configPath) : undefined;

      const availableLanguages = createDefaultRegistry().getAvailableLanguages();
      const languages = options.all
        ? availableLanguages
        : options.language
          ? [options.language]
          : [];

      const requests: GeneratorExportRequest[] = [];
      if (options.language && !options.output && config) {
        const directRoots = new Set<string>();
        const protocolSourceType = options.protocol
          ? (
              {
                rest: 'openapi-spec',
                websocket: 'asyncapi-spec',
                graphql: 'graphql-spec',
                grpc: 'grpc-spec',
                openrpc: 'openrpc-spec',
              } as const
            )[options.protocol as GeneratorProtocol]
          : undefined;
        for (const source of config.sources) {
          if (protocolSourceType && source.type !== protocolSourceType) continue;
          for (const languageConfig of source.languages) {
            if (languageConfig.language !== options.language || !languageConfig.template) continue;
            const resolved = resolveLanguageTemplateDir(languageConfig, configPath);
            if (resolved) directRoots.add(resolved);
          }
        }
        for (const directRoot of directRoots) {
          requests.push({
            templateRoot: directRoot,
            languages,
            protocol: options.protocol,
            force: options.force,
            directLanguageRoot: true,
          });
        }
      }

      if (requests.length === 0 || options.output
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #109** (2026-09-28): **Release hosted documentation and live repository MCP**
  *Symptoms*: ## Summary  - Add `cortex deploy` for public GitHub repositories and direct Cloudflare Static Assets hosting. - Add `cortex mcp-serve REPO_URL` with live documentation refresh and hosted client setup instructions. - Add project name validation, source fingerprinting, custom domain setup, and open-source hosting documentation. - Preserve the existing npm MCP publishing option.  ## Verification  - Format and lint checks pass locally. - CLI build and repository hosting tests run locally. - Hosting service CI passed 36 tests and full CLI integration against local Cloudflare services. - Production deployment, unchanged deployment skipping, and browser navigation verified at https://test-project.cortexdocs.dev.  ## Release  Promote through pre-release to main using the existing CI and npm release workflow. 

- **Issue #108** (2026-09-28): **feat: release hosted documentation and live repository MCP**
  *Symptoms*: ## Summary  - Add `cortex deploy` for public GitHub repositories and direct Cloudflare Static Assets hosting. - Add `cortex mcp-serve REPO_URL` with live documentation refresh and hosted client setup instructions. - Add project name validation, source fingerprinting, custom domain setup, and open-source hosting documentation. - Preserve the existing npm MCP publishing option.  ## Verification  - Format and lint checks pass locally. - CLI build and repository hosting tests run locally. - Hosting service CI passed 36 tests and full CLI integration against local Cloudflare services. - Production deployment, unchanged deployment skipping, and browser navigation verified at https://test-project.cortexdocs.dev.  ## Release  Promote through pre-release to main using the existing CI and npm release workflow. 

- **Issue #107** (2026-09-22): **docs: promote primary color configuration example**
  *Symptoms*: Promote the README configuration update from `pre-release` to `main`. The example now includes `primaryColor` and explains its six-digit hex format.  Validation: PR #106 passed the quality and browser checks. This promotion also runs SDK and publishing integration checks before the release workflow. 

- **Issue #106** (2026-09-22): **docs: show primaryColor in README configuration**
  *Symptoms*: The README configuration example omitted `primaryColor`. Add the existing option and explain its six-digit hex format.  Validation: - README YAML parses and the color matches the config schema. - Prettier passes for README.md. - `git diff --check` passes. 

- **Issue #100** (2026-09-22): **Add Ethereum address to FUNDING.yml**
  *Symptoms*: I'd like to see an Ethereum address added to the `custom` property of the `FUNDING.yml` file for GitHub Sponsors. This would allow a canonical address to send funds to. For example, I'm building a project that allows developers to setup one recurring donation that is split between all of their dependencies with an Ethereum address: https://sustainus.io

- **Issue #99** (2019-05-08): **added new doc #1**
  *Symptoms*: 

- **Issue #98** (2019-05-08): **added doc roadmap**
  *Symptoms*: 

- **Issue #97** (2026-09-22): **update**
  *Symptoms*: Bug Report Template -----------------------------------------------  ##### Squeezer Framework Version information ( `squeezer-cli version` ) :  * Squeezer CLI version: x.x.x * Node version: x.x.x * Operating system: x.x.x  ##### Expected Behavior:  ##### Actual Behavior:  Feature Request Template ------------------------------------------  ##### Feature Request:  ##### Acceptance Criteria:  ##### Benefits:  * Benefit 1... * Benefit 2... 

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

### Incident Patch 1: `6dd49327` (2026-09-28)
**Commit Message**: fix: follow Markdown heading links in static docs

**File**: `e2e/docs-ui-static.spec.ts` (modified, +11/-0)
```diff
@@ -55,6 +55,17 @@ test.describe('Cloudflare Static Assets export', () => {
     await expect(page.getByText('TypeScript').first()).toBeVisible();
   });
 
+  test('follows Markdown fragments after static content loads', async ({ page }) => {
+    await page.setViewportSize({ width: 1000, height: 400 });
+    await page.goto('/docs/quickstart#mcp-server');
+    await expect(page.locator('article #user-content-mcp-server')).toBeInViewport({ ratio: 1 });
+
+    await page.goto('/docs/quickstart');
+    await page.getByRole('link', { name: 'next steps', exact: true }).click();
+    await expect(page).toHaveURL(/#next-steps$/);
+    await expect(page.locator('article #user-content-next-steps')).toBeInViewport({ ratio: 1 });
+  });
+
   for (const width of [320, 390]) {
     test(`keeps documentation readable and navigation usable at ${width}px`, async ({ page }) => {
       await page.setViewportSize({ width, height: 844 });
```

**File**: `packages/docs-ui/app/docs/[slug]/page.tsx` (modified, +47/-0)
```diff
@@ -134,6 +134,53 @@ export default function DocSlugPage({ params }: { params: Promise<{ slug: string
 
   const tocItems = useMemo(() => (activeDoc ? extractToc(activeDoc.content) : []), [activeDoc]);
 
+  useEffect(() => {
+    const article = articleRef.current;
+    if (!article || !activeDoc) return;
+
+    // Sanitization prefixes heading IDs. Keep the original Markdown fragments usable,
+    // including links opened before the client has fetched the document content.
+    const scrollToFragment = (hash: string) => {
+      if (!hash) return false;
+      let id: string;
+      try {
+        id = decodeURIComponent(hash.slice(1));
+      } catch {
+        return false;
+      }
+      const target =
+        article.querySelector(`#${CSS.escape(id)}`) ??
+        article.querySelector(`#${CSS.escape(`user-content-${id}`)}`);
+      if (!target) return false;
+      target.scrollIntoView({ block: 'start' });
+      return true;
+    };
+    const onHashChange = () => scrollToFragment(window.location.hash);
+    const onClick = (event: MouseEvent) => {
+      if (event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
+      const anchor =
+        event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
+      if (!anchor || anchor.target || anchor.hasAttribute('download')) return;
+      const url = new URL(anchor.href);
+      if (
+        url.origin !== window.location.origin ||
+        url.pathname !== window.location.pathname ||
+        url.search !== window.location.search ||
+        !scrollToFragment(url.hash)
+      )
+        return;
+      event.preventDefault();
+      if (window.location.hash !== url.hash) window.history.pushState(null, '', url.hash);
+    };
+    onHashChange();
+    article.addEventListener('click', onClick);
+    window.addEventListener('hashchange', onHashChange);
+    return () => {
+      article.removeEventListener('click', onClick);
+      window.removeEventListener('hashchange', onHashChange);
+    };
+  }, [activeDoc]);
+
   useEffect(() => {
     const container = mainRef.current;
     if (!container || tocItems.length === 0) return;
```

**File**: `packages/docs-ui/scripts/prepare-demo.mjs` (modified, +2/-0)
```diff
@@ -16,6 +16,8 @@ const quickstart = `# Quickstart
 
 Welcome to your API documentation! This guide will help you get started.
 
+Read about the [MCP server](#mcp-server) or skip to [next steps](#next-steps).
+
 ## API Reference
 
 Browse the full API reference to see all available endpoints, request/response schemas, and authentication details.
```

---

### Incident Patch 2: `f4b5a8d7` (2026-09-26)
**Commit Message**: fix: avoid conflicting static asset cache headers

**File**: `packages/cli/src/commands/deploy/deploy.command.ts` (modified, +0/-1)
```diff
@@ -191,7 +191,6 @@ export class DeployCommand extends CommandRunner {
     this.logger.success(
       `${result.status === 'unchanged' ? 'Unchanged — skipped build and upload' : 'Deployed'}: ${result.url}`,
     );
-    this.logger.info('Cloudflare serves the documentation directly from Static Assets.');
     const domain = await deploymentRequest(
       api,
       `/v1/projects/${snapshot.config.project}/domain`,
```

**File**: `packages/docs-ui/public/_headers` (modified, +0/-1)
```diff
@@ -1,5 +1,4 @@
 /*
-  Cache-Control: public,max-age=0,must-revalidate
   X-Cortex-Hosting: cloudflare-static-assets
 
 /_next/static/*
```

---

### Incident Patch 3: `f4d7a6ed` (2026-09-12)
**Commit Message**: Merge pull request #65 from cortex-docs/fix/prod-build

feat(docs): export static HTML and fix documentation navigation

**File**: `.github/workflows/release.yml` (modified, +18/-1)
```diff
@@ -78,7 +78,7 @@ jobs:
     timeout-minutes: 45
     environment: npm
     permissions:
-      contents: read
+      contents: write
       id-token: write
     steps:
       - uses: actions/checkout@v7
@@ -120,3 +120,20 @@ jobs:
         run: >-
           node scripts/check-static-site.mjs https://docs.cortexdocs.dev
           / /docs/quickstart /api/config /api/docs /api/mcp
+      - name: Create or update the GitHub release
+        env:
+          GH_TOKEN: ${{ github.token }}
+          RELEASE_TAG: v${{ needs.prepare.outputs.version }}
+          RELEASE_VERSION: ${{ needs.prepare.outputs.version }}
+        run: |
+          node scripts/extract-release-notes.mjs "$RELEASE_VERSION" > .github-release-notes.md
+          if gh release view "$RELEASE_TAG" >/dev/null 2>&1; then
+            gh release edit "$RELEASE_TAG" \
+              --title "Cortex Docs $RELEASE_TAG" \
+              --notes-file .github-release-notes.md
+          else
+            gh release create "$RELEASE_TAG" \
+              --verify-tag \
+              --title "Cortex Docs $RELEASE_TAG" \
+              --notes-file .github-release-notes.md
+          fi
```

**File**: `CHANGELOG.md` (modified, +73/-0)
```diff
@@ -8,6 +8,79 @@ The project uses Semantic Versioning. Each release contains the same three chang
 
 ### New Features
 
+- `cortex docs build` now exports static HTML, CSS, JavaScript, and documentation data for deployment to a static web host.
+
+### Bug Fixes
+
+- Fixed the documentation layout and navigation on mobile screens.
+- Fixed MCP tool links that scrolled to the wrong position after the setup guide loaded.
+- Excluded workspace test dependencies from the CLI release package to prevent dependency conflicts during CI packaging.
+
+### Improvements
+
+- Removed `cortex docs start`. Use `cortex docs serve` for a local preview with file watching. Host production output as static files without a Node.js server.
+
+## [0.1.30] - 2026-08-31
+
+### New Features
+
+- None.
+
+### Bug Fixes
+
+- Fixed generated Go GraphQL clients failing to reconnect and resubscribe WebSocket subscriptions after a connection was dropped or a subscribe write failed.
+
+### Improvements
+
+- None.
+
+## [0.1.29] - 2026-08-31
+
+### New Features
+
+- None.
+
+### Bug Fixes
+
+- None.
+
+### Improvements
+
+- Improved the README heading hierarchy for better structure and readability.
+
+## [0.1.28] - 2026-08-31
+
+### New Features
+
+- None.
+
+### Bug Fixes
+
+- Disabled analytics and cookie controls unless the current hostname is explicitly listed in `enabled_hosts`, instead of enabling tracking by default when the list was empty.
+
+### Improvements
+
+- Simplified the README header presentation.
+
+## [0.1.27] - 2026-08-31
+
+### New Features
+
+- None.
+
+### Bug Fixes
+
+- None.
+
+### Improvements
+
+- Added a visual product overview, a 60-second tour, a workflow comparison, and clearer project links to the README.
+- Added automatic GitHub Releases with notes from the generated changelog.
+
+## [0.1.26] - 2026-08-28
+
+### New Features
+
 - None.
 
 ### Bug Fixes
```

**File**: `CONTRIBUTING.md` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@ Do not open a feature pull request to `main`. Maintainers promote `pre-release`
 
 The promotion pull request runs all Docker integration tests. A merge to `main` publishes a new patch version.
 
-The release publishes `@cortex-docs/cli` and the generated `@cortex-docs/mcp` package. It also deploys `docs.cortexdocs.dev`.
+The release publishes `@cortex-docs/cli` and the generated `@cortex-docs/mcp` package. It deploys `docs.cortexdocs.dev` and creates a GitHub Release.
 
 The release does not publish the other workspaces. The CLI package includes the internal workspaces that it uses.
 
```

**File**: `DEVELOPMENT.md` (modified, +16/-5)
```diff
@@ -129,24 +129,24 @@ npm run --workspace=@cortex-docs/docs-ui dev:next
 
 ### Cloudflare demo
 
-The public demo uses two Cloudflare Workers:
+The public demo uses a Worker for the API and static hosting for the documentation:
 
 - `api.demo.cortexdocs.dev` serves the REST, GraphQL, WebSocket, OpenRPC, and HTTP bridge endpoints.
-- `demo.cortexdocs.dev` serves the Next.js documentation UI through OpenNext.
+- `demo.cortexdocs.dev` serves the exported documentation through Cloudflare Static Assets.
 
 Run the API Worker without the docs UI:
 
 ```bash
 npm run --workspace=@cortex-docs/demo-api dev
 ```
 
-Build the docs UI for the Cloudflare runtime:
+Build the static documentation for Cloudflare:
 
 ```bash
 npm run --workspace=@cortex-docs/docs-ui demo:build
 ```
 
-Preview the complete docs UI Worker locally:
+Preview the static documentation locally:
 
 ```bash
 npm run --workspace=@cortex-docs/docs-ui demo:preview
@@ -344,7 +344,18 @@ The spec is served via the `/api/spec` route, which reads the file path from the
 npm run --workspace=@cortex-docs/docs-site dev
 ```
 
-Starts the product documentation site locally on `:3200` with hot reload. Edit a Markdown file in `packages/docs-site/docs/` to update a page.
+The command starts the product documentation site locally on `:3200` with hot reload. Edit a Markdown file in `packages/docs-site/docs/` to update a page.
+
+Build the product documentation as static files:
+
+```bash
+npm run --workspace=@cortex-docs/docs-site build
+```
+
+This command runs `cortex docs build --output .cortex/docs` in the product docs workspace. The output directory is `packages/docs-site/.cortex/docs`.
+
+Deploy the output directory to a static web host. Configure page URLs such as `/docs/quickstart` to resolve to `/docs/quickstart.html`.
+The deployed site needs no Node.js server or access to the original configuration and specifications. Rebuild the site after source changes.
 
 ## Modifying the Docs Site
 
```

**File**: `README.md` (modified, +96/-32)
```diff
@@ -1,30 +1,105 @@
-# Cortex Docs
+<p align="center">
+  <picture>
+    <source media="(prefers-color-scheme: dark)" srcset="packages/docs-site/assets/logo_dark.svg">
+    <source media="(prefers-color-scheme: light)" srcset="packages/docs-site/assets/logo_light.svg">
+    <img alt="Cortex" src="packages/docs-site/assets/logo_light.svg" width="246">
+  </picture>
+</p>
 
-[![CI](https://github.com/cortex-docs/cortex/actions/workflows/ci.yml/badge.svg)](https://github.com/cortex-docs/cortex/actions/workflows/ci.yml)
-[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
+<h2 align="center">Every developer. Every agent.</h2>
 
-Cortex turns API specifications and Markdown into typed SDKs, interactive documentation, and MCP servers for developers and AI agents.
+<p align="center">
+  Cortex turns API specifications and Markdown into typed SDKs, interactive documentation, and an MCP server from one project configuration.
+</p>
 
-One project can combine OpenAPI, AsyncAPI, GraphQL, Protocol Buffer, and OpenRPC sources. Cortex Docs generates one package for each configured language.
+<p align="center">
+  OpenAPI · AsyncAPI · GraphQL · gRPC · OpenRPC · Markdown
+</p>
 
-## Live sites
+<p align="center">
+  <a href="https://github.com/cortex-docs/cortex/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/cortex-docs/cortex/actions/workflows/ci.yml/badge.svg"></a>
+  <a href="https://www.npmjs.com/package/@cortex-docs/cli"><img alt="npm version" src="https://img.shields.io/npm/v/@cortex-docs/cli.svg"></a>
+  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
+  <a href="https://github.com/cortex-docs/cortex/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/cortex-docs/cortex?style=flat&logo=github"></a>
+</p>
 
-**[Read the Cortex Docs documentation →](https://docs.cortexdocs.dev)**
+<h3 align="center">
+  <a href="https://docs.cortexdocs.dev"><strong>Documentation</strong></a> ·
+  <a href="https://demo.cortexdocs.dev"><strong>Live demo</strong></a> ·
+  <a href="https://cortexdocs.dev"><strong>Website</strong></a>
+</h3>
 
-**[Open the Cortex Docs demo →](https://demo.cortexdocs.dev)**
+</br>
 
-**[Official Website →](https://cortexdocs.dev)**
+![Cortex turns API sources into interactive documentation, typed SDKs, and an MCP server for developers, applications, and AI agents.](assets/cortex-overview.svg)
+
+Cortex combines OpenAPI, AsyncAPI, GraphQL, Protocol Buffer, OpenRPC, and Markdown sources. Developers get interactive documentation, applications get typed SDKs, and AI agents get an MCP server with project context.
+
+If Cortex helps your team, [star this repository](https://github.com/cortex-docs/cortex) to support its development.
+
+## Try Cortex in 60 seconds
+
+Create a sample project and inspect the generation plan:
+
+```bash
+mkdir petstore
+cd petstore
+npm install --global @cortex-docs/cli
+cortex init petstore
+cortex validate
+cortex generate --dry-run
+```
+
+Cortex validates each source and shows every planned output:
+
+```text
+✓ Config is valid
+✓ Parsed AsyncAPI: WebSocket API
+✓ Parsed GraphQL: GraphQL
+✓ Parsed OpenRPC: OpenRPC
+✓ Parsed OpenAPI: REST API V1
+Languages: typescript, python, go, java, kotlin, ruby, php, csharp, rust, cpp, c
+
+typescript [REST + WS + GraphQL + OpenRPC] → generated/typescript/petstore-typescript-client-sdk
+python [REST + WS + GraphQL + OpenRPC] → generated/python/petstore-python-sdk
+...
+mcp-server → generated/mcp-server
+```
+
+The generated MCP server gives AI agents typed tools, specifications, SDK guides, and project documentation.
+
+Generate the files. Then start the local documentation preview:
+
+```bash
+cortex generate
+cortex docs serve
+```
+
+Open `http://localhost:3012`. Press `Ctrl+C` to stop the server.
 
 ## Features
 
 - Generate SDKs for TypeScript, Python, Go, Java, Kotlin, Ruby, PHP, C#, Rust, C++, and C.
 - Combine multiple specification file
```

---

### Incident Patch 4: `978dc72c` (2026-09-12)
**Commit Message**: fix(ci): update vulnerable URI and Cloudflare dependencies

**File**: `package-lock.json` (modified, +68/-603)
```diff
@@ -1755,9 +1755,9 @@
       }
     },
     "node_modules/@cloudflare/workerd-darwin-64": {
-      "version": "1.20260826.1",
-      "resolved": "https://registry.npmjs.org/@cloudflare/workerd-darwin-64/-/workerd-darwin-64-1.20260826.1.tgz",
-      "integrity": "sha512-8UsGGY8ZUiYHOWdsxBlNsGmaHBGArVwJ3CM4nWpfBhthjjYe4M/OqrTpqKF7NNWb63qQiv1d8Z+Z6/hmUqNKIQ==",
+      "version": "1.20260911.1",
+      "resolved": "https://registry.npmjs.org/@cloudflare/workerd-darwin-64/-/workerd-darwin-64-1.20260911.1.tgz",
+      "integrity": "sha512-785eaY1bkR1cm4Z/PCUeteZYmTMe6lre2zz63/GdGGimsoMsKxgl4brFPRukim8iv28EyD1XoCB/VPYF20BERA==",
       "cpu": [
         "x64"
       ],
@@ -1772,9 +1772,9 @@
       }
     },
     "node_modules/@cloudflare/workerd-darwin-arm64": {
-      "version": "1.20260826.1",
-      "resolved": "https://registry.npmjs.org/@cloudflare/workerd-darwin-arm64/-/workerd-darwin-arm64-1.20260826.1.tgz",
-      "integrity": "sha512-0bLqVQYsQ3v3FdYGmzh23vi9fJeYTBx19o4LUySIsRcgBggGSlR39ml162vTXvZzUISOjVW2qfL7Y+SMrrfXmQ==",
+      "version": "1.20260911.1",
+      "resolved": "https://registry.npmjs.org/@cloudflare/workerd-darwin-arm64/-/workerd-darwin-arm64-1.20260911.1.tgz",
+      "integrity": "sha512-WU4bFqEN0H7ndGWxoedegv95DmNVBtv0ncXcHG9nYFTUI78sxEb0qoT3U6Ga4hyBkzsJFBX/zvVBIGX3qKldGA==",
       "cpu": [
         "arm64"
       ],
@@ -1789,9 +1789,9 @@
       }
     },
     "node_modules/@cloudflare/workerd-linux-64": {
-      "version": "1.20260826.1",
-      "resolved": "https://registry.npmjs.org/@cloudflare/workerd-linux-64/-/workerd-linux-64-1.20260826.1.tgz",
-      "integrity": "sha512-DTC0yWzybX4gUH5Q1pJo3UwEQjp0Gmz0Q71I+39xT9SXBesX5QndOIQv45yHQ86Z84EzK2WwaENdlpmDSvJKmw==",
+      "version": "1.20260911.1",
+      "resolved": "https://registry.npmjs.org/@cloudflare/workerd-linux-64/-/workerd-linux-64-1.20260911.1.tgz",
+      "integrity": "sha512-0Y2gy62oxQxWa38qinSPE6zNL5+JmumJtDY9AWW1HB8KHuATxN71o5MGzmVFfB8PwZsiHfUd2Sv7O22krCOrhw==",
       "cpu": [
         "x64"
       ],
@@ -1806,9 +1806,9 @@
       }
     },
     "node_modules/@cloudflare/workerd-linux-arm64": {
-      "version": "1.20260826.1",
-      "resolved": "https://registry.npmjs.org/@cloudflare/workerd-linux-arm64/-/workerd-linux-arm64-1.20260826.1.tgz",
-      "integrity": "sha512-PFerWi+DP2Ckc6eATAS4dhotBt8IeXJjTzIgy18H+uqsswlXc7A8HsnAunHL9v/7/BjCgq46iMo2g4iUAsEpDw==",
+      "version": "1.20260911.1",
+      "resolved": "https://registry.npmjs.org/@cloudflare/workerd-linux-arm64/-/workerd-linux-arm64-1.20260911.1.tgz",
+      "integrity": "sha512-kttNPnx1r2lCqFUoMH62z7CqGV+j4QBbw5fdtaz4pzOrzBv0AWkNATt7onFUe+SwP8zhcepMtbm2F4kKzTf6VA==",
       "cpu": [
         "arm64"
       ],
@@ -1823,9 +1823,9 @@
       }
     },
     "node_modules/@cloudflare/workerd-windows-64": {
-      "version": "1.20260826.1",
-      "resolved": "https://registry.npmjs.org/@cloudflare/workerd-windows-64/-/workerd-windows-64-1.20260826.1.tgz",
-      "integrity": "sha512-X26hulrG2MSSfpRmjZbCq98LNaZnrRqbmGcgo7g1U/U0nJ5npYruPm3fAyZ2y6VDr5CmQo9BLCahxP8VB/QR6A==",
+      "version": "1.20260911.1",
+      "resolved": "https://registry.npmjs.org/@cloudflare/workerd-windows-64/-/workerd-windows-64-1.20260911.1.tgz",
+      "integrity": "sha512-5iO/YfoBDOgO3CrHdkiiVP8SL3O2jC+c6Ux3d378TSPKLhU5+CgHjtE/ZSodWQrzr4FzFRqdW8S7n5nbyD1MHQ==",
       "cpu": [
         "x64"
       ],
@@ -1840,9 +1840,9 @@
       }
     },
     "node_modules/@cloudflare/workers-types": {
-      "version": "5.20260828.1",
-      "resolved": "https://registry.npmjs.org/@cloudflare/workers-types/-/workers-types-5.20260828.1.tgz",
-      "integrity": "sha512-Ce0QfghuAK9v821gER8rFPR3rMeC+5puTgTzCu4UrG1Zg967Z5Aa+2uZVciIyfCAdGssyh+sLEC6rMjN/YBQwA==",
+      "version": "5.20260911.1",
+      "resolved": "https://registry.npmjs.org/@cloudflare/workers-types/-/workers-types-5.20260911.1.tgz",
+      "integrity": "sha512-yiAvknjulcU85B3yB4aKOn9+l+garWP+AbHgsdCFckeRYDdhZ1rPULi64BDf52R3VTaKqxi47kF+o9ZbjsCt5g==",
      
```

---

### Incident Patch 5: `b5dfc0f5` (2026-09-12)
**Commit Message**: Merge remote-tracking branch 'origin/main' into fix/prod-build

**File**: `CHANGELOG.md` (modified, +14/-0)
```diff
@@ -20,6 +20,20 @@ The project uses Semantic Versioning. Each release contains the same three chang
 
 - Removed `cortex docs start`. Use `cortex docs serve` for a local preview with file watching. Host production output as static files without a Node.js server.
 
+## [0.1.30] - 2026-08-31
+
+### New Features
+
+- None.
+
+### Bug Fixes
+
+- Fixed generated Go GraphQL clients failing to reconnect and resubscribe WebSocket subscriptions after a connection was dropped or a subscribe write failed.
+
+### Improvements
+
+- None.
+
 ## [0.1.29] - 2026-08-31
 
 ### New Features
```

**File**: `package-lock.json` (modified, +3/-3)
```diff
@@ -18890,7 +18890,7 @@
     },
     "packages/cli": {
       "name": "@cortex-docs/cli",
-      "version": "0.1.29",
+      "version": "0.1.30",
       "bundleDependencies": [
         "@cortex-docs/core",
         "@cortex-docs/codegen",
@@ -19084,9 +19084,9 @@
     },
     "packages/docs-site": {
       "name": "@cortex-docs/docs-site",
-      "version": "0.1.29",
+      "version": "0.1.30",
       "dependencies": {
-        "@cortex-docs/cli": "0.1.29"
+        "@cortex-docs/cli": "0.1.30"
       }
     },
     "packages/docs-ui": {
```

**File**: `packages/cli/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@cortex-docs/cli",
-  "version": "0.1.29",
+  "version": "0.1.30",
   "description": "Cortex Docs CLI for SDKs, API documentation, and MCP servers",
   "license": "MIT",
   "repository": {
```

**File**: `packages/docs-site/package.json` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@cortex-docs/docs-site",
-  "version": "0.1.29",
+  "version": "0.1.30",
   "private": true,
   "description": "Product documentation for Cortex Docs",
   "scripts": {
@@ -9,6 +9,6 @@
     "clean": "rm -rf .cortex"
   },
   "dependencies": {
-    "@cortex-docs/cli": "0.1.29"
+    "@cortex-docs/cli": "0.1.30"
   }
 }
```

---

### Incident Patch 6: `b5571433` (2026-08-31)
**Commit Message**: fix(codegen): reconnect Go GraphQL subscriptions (#63)

Co-authored-by: Nick Chisiu <8492343+nickchisiu@users.noreply.github.com>

**File**: `packages/codegen/__tests__/gql-codegen.test.ts` (modified, +12/-0)
```diff
@@ -234,6 +234,18 @@ describe('GraphQL Codegen — All Languages', () => {
           expect(client.content).not.toContain('func (c *Gql) Pets(');
         });
 
+        it('retries subscriptions when the shared WebSocket closes during a write', async () => {
+          const files = await generateForLanguage(language);
+          const client = getFile(files, 'gql-client')!;
+          expect(client.content).toContain('wasCurrent := c.wsConn == conn');
+          expect(client.content).toContain(
+            'shouldReconnect := wasCurrent && c.reconnect && !c.disposed',
+          );
+          expect(client.content).toContain('subscribeErr = conn.WriteJSON(');
+          expect(client.content).toContain('if c.wsConn == conn {');
+          expect(client.content).toContain('c.wsConn = nil');
+        });
+
         it('generates unified result types instead of per-operation types', async () => {
           const files = await generateForLanguage(language);
           const types = getFile(files, 'gql-types')!;
```

**File**: `packages/codegen/src/languages/go/templates/graphql/client.ejs` (modified, +29/-25)
```diff
@@ -290,8 +290,9 @@ func (c *<%= it.clientClass %>) readWsMessages(conn *websocket.Conn) {
 		_, message, err := conn.ReadMessage()
 		if err != nil {
 			c.mu.Lock()
-			if c.wsConn == conn { c.wsConn = nil }
-			shouldReconnect := c.reconnect && !c.disposed && len(c.subs) > 0
+			wasCurrent := c.wsConn == conn
+			if wasCurrent { c.wsConn = nil }
+			shouldReconnect := wasCurrent && c.reconnect && !c.disposed && len(c.subs) > 0
 			c.mu.Unlock()
 			if shouldReconnect { go c.reconnectSubscriptions() }
 			return
@@ -372,16 +373,6 @@ func (c *<%= it.clientClass %>) Subscribe(fn func(*SubscriptionBuilder) *Subscri
 	c.mu.Lock()
 	defer c.mu.Unlock()
 
-	var connectErr error
-	for attempt := 0; ; attempt++ {
-		connectErr = c.ensureWsConn()
-		if connectErr == nil { break }
-		if !c.reconnect || attempt >= c.maxReconnectAttempts {
-			return nil, connectErr
-		}
-		time.Sleep(c.reconnectInterval)
-	}
-
 	id := fmt.Sprintf("%d", c.nextSubID)
 	c.nextSubID++
 
@@ -395,19 +386,32 @@ func (c *<%= it.clientClass %>) Subscribe(fn func(*SubscriptionBuilder) *Subscri
 		handler(&envelope.Data)
 	}}
 
-	c.writeMu.Lock()
-	err := c.wsConn.WriteJSON(map[string]interface{}{
-		"type": "subscribe",
-		"id":   id,
-		"payload": map[string]interface{}{
-			"query":     query,
-			"variables": variables,
-		},
-	})
-	c.writeMu.Unlock()
-	if err != nil {
-		delete(c.subs, id)
-		return nil, fmt.Errorf("ws subscribe: %w", err)
+	var subscribeErr error
+	for attempt := 0; ; attempt++ {
+		subscribeErr = c.ensureWsConn()
+		if subscribeErr == nil {
+			conn := c.wsConn
+			c.writeMu.Lock()
+			subscribeErr = conn.WriteJSON(map[string]interface{}{
+				"type": "subscribe",
+				"id":   id,
+				"payload": map[string]interface{}{
+					"query":     query,
+					"variables": variables,
+				},
+			})
+			c.writeMu.Unlock()
+			if subscribeErr == nil { break }
+			if c.wsConn == conn {
+				_ = conn.Close()
+				c.wsConn = nil
+			}
+		}
+		if !c.reconnect || attempt >= c.maxReconnectAttempts {
+			delete(c.subs, id)
+			return nil, fmt.Errorf("ws subscribe: %w", subscribeErr)
+		}
+		time.Sleep(c.reconnectInterval)
 	}
 
 	return func() {
```

---

### Incident Patch 7: `29581d88` (2026-08-31)
**Commit Message**: fix: require explicit analytics hosts

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ The project uses Semantic Versioning. Each release contains the same three chang
 
 ### Bug Fixes
 
-- None.
+- Disabled analytics and cookie controls unless the current hostname is explicitly listed in `enabled_hosts`.
 
 ### Improvements
 
```

**File**: `README.md` (modified, +1/-5)
```diff
@@ -6,11 +6,7 @@
   </picture>
 </p>
 
-<h1 align="center">Cortex</h1>
-
-<p align="center">
-  <strong>Every developer. Every agent.</strong>
-</p>
+<h3 align="center">Every developer. Every agent.</h3>
 
 <p align="center">
   Cortex turns API specifications and Markdown into typed SDKs, interactive documentation, and an MCP server from one project configuration.
```

**File**: `packages/docs-site/docs/configuration.md` (modified, +3/-1)
```diff
@@ -178,7 +178,9 @@ analytics:
   privacy_url: https://example.com/privacy#cookies-and-analytics
 ```
 
-`google_analytics_id` is the Google Analytics measurement ID. `enabled_hosts` prevents tracking on local and preview sites.
+`google_analytics_id` is the Google Analytics measurement ID. The integration stays disabled unless the current hostname is in `enabled_hosts`.
+
+This host list prevents tracking and cookie controls on local and preview sites.
 
 `privacy_url` opens from the cookie banner. Cortex asks for consent where required and stores the choice in local browser storage.
 
```

**File**: `packages/docs-ui/__tests__/analytics-consent.test.ts` (modified, +2/-1)
```diff
@@ -7,7 +7,8 @@ describe('analytics consent', () => {
     expect(isAnalyticsHost('docs.cortexdocs.dev', hosts)).toBe(true);
     expect(isAnalyticsHost('DOCS.CORTEXDOCS.DEV', hosts)).toBe(true);
     expect(isAnalyticsHost('localhost', hosts)).toBe(false);
-    expect(isAnalyticsHost('preview.example.com', [])).toBe(true);
+    expect(isAnalyticsHost('preview.example.com', [])).toBe(false);
+    expect(isAnalyticsHost('demo.cortexdocs.dev', ['DEMO.CORTEXDOCS.DEV'])).toBe(true);
   });
 
   it('requires an explicit choice in consent regions', () => {
```

**File**: `packages/docs-ui/lib/analytics-consent.ts` (modified, +2/-1)
```diff
@@ -48,7 +48,8 @@ const CONSENT_REQUIRED = new Set([
 ]);
 
 export function isAnalyticsHost(hostname: string, enabledHosts: string[]): boolean {
-  return enabledHosts.length === 0 || enabledHosts.includes(hostname.toLowerCase());
+  const normalizedHostname = hostname.toLowerCase();
+  return enabledHosts.some((host) => host.toLowerCase() === normalizedHostname);
 }
 
 export function analyticsAllowed(state: ConsentState): boolean {
```

---

### Incident Patch 8: `d5ab952f` (2026-08-27)
**Commit Message**: fix(demo): match local docs and generate SDK MCP tools

Promote the fully verified pre-release build to production.

**File**: `e2e/docs-ui-static.spec.ts` (modified, +28/-7)
```diff
@@ -24,20 +24,41 @@ test.describe('Cloudflare Static Assets export', () => {
 
   test('supports client navigation between generated documentation pages', async ({ page }) => {
     await page.goto('/docs/quickstart');
-    await expect(page.getByText('Getting Started').first()).toBeVisible();
-    await page
-      .getByRole('link', { name: /Configuration/ })
-      .last()
-      .click();
-    await expect(page).toHaveURL(/\/docs\/configuration/);
-    await expect(page.getByRole('heading', { name: 'Configuration' }).first()).toBeVisible();
+    await expect(page).toHaveTitle('Petstore Docs');
+    await expect(page.getByRole('heading', { name: 'Quickstart' })).toBeVisible();
+    await expect(page.getByRole('link', { name: 'Configuration' })).toHaveCount(0);
   });
 
   test('serves generated MCP and SDK deep links', async ({ page }) => {
     await page.goto('/mcp/docs_quickstart');
     await expect(page.getByText('docs_quickstart').first()).toBeVisible();
 
+    await page.goto('/mcp/sdk_typescript_petstore_typescript_client_sdk');
+    await expect(
+      page.getByText('sdk_typescript_petstore_typescript_client_sdk').first(),
+    ).toBeVisible();
+
     await page.goto('/sdks/typescript');
     await expect(page.getByText('TypeScript').first()).toBeVisible();
   });
+
+  test('matches the local demo documentation and MCP SDK tools', async ({ request }) => {
+    const docsResponse = await request.get('/api/docs');
+    const docs = await docsResponse.json();
+    expect(docs.sections).toEqual([
+      expect.objectContaining({
+        section: 'Get started',
+        documents: [expect.objectContaining({ title: 'Quickstart', slug: 'quickstart' })],
+      }),
+    ]);
+
+    const mcpResponse = await request.get('/api/mcp');
+    const mcp = await mcpResponse.json();
+    const toolNames = mcp.tools.map((tool: { name: string }) => tool.name);
+    expect(toolNames.filter((name: string) => name.startsWith('docs_'))).toEqual([
+      'docs_quickstart',
+    ]);
+    expect(toolNames.filter((name: string) => name.startsWith('sdk_'))).toHaveLength(11);
+    expect(toolNames).toContain('sdk_typescript_petstore_typescript_client_sdk');
+  });
 });
```

**File**: `packages/docs-ui/scripts/cloudflare.mjs` (modified, +11/-2)
```diff
@@ -22,6 +22,8 @@ if (!['demo', 'docs'].includes(target)) {
 const require = createRequire(import.meta.url);
 const scriptDir = dirname(fileURLToPath(import.meta.url));
 const docsUiDir = resolve(scriptDir, '..');
+const workspaceRoot = resolve(docsUiDir, '..', '..');
+const cliMain = join(workspaceRoot, 'packages', 'cli', 'dist', 'main.js');
 const outputDir = join(docsUiDir, '.next-cloudflare');
 const nextCli = require.resolve('next/dist/bin/next');
 const wranglerPackagePath = require.resolve('wrangler/package.json');
@@ -61,10 +63,10 @@ const env = {
     : {}),
 };
 
-function run(executable, args) {
+function run(executable, args, cwd = docsUiDir) {
   return new Promise((resolveCommand, rejectCommand) => {
     const child = spawn(executable, args, {
-      cwd: docsUiDir,
+      cwd,
       env,
       stdio: 'inherit',
     });
@@ -102,6 +104,13 @@ function validateStaticOutput() {
 
 try {
   rmSync(outputDir, { recursive: true, force: true });
+  if (target === 'demo') {
+    if (!existsSync(cliMain)) {
+      const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
+      await run(npm, ['run', 'build:cli'], workspaceRoot);
+    }
+    await run(process.execPath, [cliMain, 'generate'], prepared.demoDir);
+  }
   await run(process.execPath, [nextCli, 'build', '--webpack']);
   validateStaticOutput();
 
```

**File**: `packages/docs-ui/scripts/prepare-demo.mjs` (modified, +80/-26)
```diff
@@ -12,6 +12,51 @@ const demoDir = join(docsUiDir, '.cortex-demo');
 const fixturesDir = join(workspaceRoot, 'packages', 'core', '__fixtures__');
 const docsSiteDir = join(workspaceRoot, 'packages', 'docs-site');
 
+const quickstart = `# Quickstart
+
+Welcome to your API documentation! This guide will help you get started.
+
+## API Reference
+
+Browse the full API reference to see all available endpoints, request/response schemas, and authentication details.
+
+## SDKs
+
+Cortex generates type-safe SDKs for your API in multiple languages. Install the SDK for your language of choice and start making API calls in minutes.
+
+## MCP Server
+
+An MCP (Model Context Protocol) server is generated alongside your SDKs, enabling AI assistants to interact with your API using structured tool calls.
+
+## Next Steps
+
+- Explore the **API Reference** tab for endpoint details
+- Visit the **SDKs** tab to download generated clients
+- Check the **MCP** tab for AI integration setup
+`;
+
+const apiReferenceIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
+  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
+  <polyline points="14 2 14 8 20 8"/>
+  <line x1="16" y1="13" x2="8" y2="13"/>
+  <line x1="16" y1="17" x2="8" y2="17"/>
+  <polyline points="10 9 9 9 8 9"/>
+</svg>`;
+
+function buildLogo(textColor) {
+  const name = 'Petstore';
+  const totalWidth = Math.ceil(22 + 4 + name.length * 8.5);
+  const fillOpacity = textColor === '#ffffff' ? '0.1' : '0.08';
+  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} 21">
+  <g stroke="${textColor}" fill="none" stroke-linecap="round" stroke-linejoin="round">
+    <path d="M9,2.5 Q11,1 13,2.5 L18,5 Q20,6 18,7 L13,9.5 Q11,11 9,9.5 L4,7 Q2,6 4,5 Z" stroke-width="1.5" fill="${textColor}" fill-opacity="${fillOpacity}"/>
+    <path d="M3,10 L9,13.5 Q11,14.8 13,13.5 L19,10" stroke-width="1.5"/>
+    <path d="M3,13.5 L9,17 Q11,18.3 13,17 L19,13.5" stroke-width="1.5" stroke-opacity="0.5"/>
+  </g>
+  <text x="26" y="15" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="600" fill="${textColor}">${name}</text>
+</svg>`;
+}
+
 function copyFixture(sourceName, targetName, transform = (content) => content) {
   const content = readFileSync(join(fixturesDir, sourceName), 'utf8');
   writeFileSync(join(demoDir, 'specs', targetName), transform(content), 'utf8');
@@ -61,7 +106,26 @@ export function prepareDemo(apiUrl = process.env.CORTEX_DEMO_API_URL || 'http://
   });
 
   cpSync(join(docsSiteDir, 'assets'), join(demoDir, 'assets'), { recursive: true });
-  cpSync(join(docsSiteDir, 'docs'), join(demoDir, 'docs'), { recursive: true });
+  writeFileSync(join(demoDir, 'docs', 'quickstart.md'), quickstart, 'utf8');
+  writeFileSync(
+    join(demoDir, 'docs', 'REST_INTRO.md'),
+    `Welcome to the Petstore API. This API provides endpoints for managing resources.
+
+## Base URL
+
+\`\`\`
+${apiUrl}
+\`\`\`
+
+## Rate Limiting
+
+API requests are rate-limited to **1000 requests per minute** per API key. When you exceed the limit, requests return a \`429 Too Many Requests\` response. The \`Retry-After\` header indicates how long to wait before retrying.
+`,
+    'utf8',
+  );
+  writeFileSync(join(demoDir, 'assets', 'logo_dark.svg'), buildLogo('#ffffff'), 'utf8');
+  writeFileSync(join(demoDir, 'assets', 'logo_light.svg'), buildLogo('#0a0a0a'), 'utf8');
+  writeFileSync(join(demoDir, 'assets', 'api-reference-icon.svg'), apiReferenceIcon, 'utf8');
   writeFileSync(
     join(demoDir, 'assets', 'custom.css'),
     ':root { --cortex-custom-head-loaded: yes; }\n',
@@ -70,8 +134,8 @@ export function prepareDemo(apiUrl = process.env.CORTEX_DEMO_API_URL || 'http://
 
   const languages = sourceLanguages();
   const config = {
-    project: 'cortex-demo',
-    title: 'Cortex Docs Demo',
+    project: 'Petstore',
+    
```

**File**: `scripts/check-demo.mjs` (modified, +31/-0)
```diff
@@ -34,6 +34,15 @@ async function check(path, round, cacheBust = false) {
   await response.arrayBuffer();
 }
 
+async function readJson(path) {
+  const response = await fetch(`${baseUrl}${path}?check=${Date.now()}`, {
+    headers: { 'user-agent': 'cortex-demo-health-check/1.0' },
+    signal: AbortSignal.timeout(30_000),
+  });
+  if (!response.ok) throw new Error(`${path} returned ${response.status}.`);
+  return response.json();
+}
+
 let propagationFailures = [];
 for (let attempt = 1; attempt <= maximumPropagationAttempts; attempt += 1) {
   const results = await Promise.allSettled(
@@ -53,6 +62,28 @@ if (propagationFailures.length > 0) {
   throw propagationFailures[0].reason;
 }
 
+const [config, docs, mcp] = await Promise.all([
+  readJson('/api/config'),
+  readJson('/api/docs'),
+  readJson('/api/mcp'),
+]);
+if (config.project !== 'Petstore' || config.title !== 'Petstore Docs') {
+  throw new Error('The deployed demo does not use the local Petstore project configuration.');
+}
+const documents = docs.sections?.flatMap((section) => section.documents ?? []) ?? [];
+if (documents.length !== 1 || documents[0]?.title !== 'Quickstart') {
+  throw new Error('The deployed demo must contain only the Quickstart documentation page.');
+}
+const toolNames = mcp.tools?.map((tool) => tool.name) ?? [];
+const sdkTools = toolNames.filter((name) => name.startsWith('sdk_'));
+const docsTools = toolNames.filter((name) => name.startsWith('docs_'));
+if (sdkTools.length !== 11 || !sdkTools.includes('sdk_typescript_petstore_typescript_client_sdk')) {
+  throw new Error(`The deployed demo exposed ${sdkTools.length} sdk_* MCP tools instead of 11.`);
+}
+if (docsTools.length !== 1 || docsTools[0] !== 'docs_quickstart') {
+  throw new Error(`The deployed demo exposed unexpected documentation MCP tools: ${docsTools}.`);
+}
+
 for (let round = 1; round <= rounds; round += 1) {
   await Promise.all(paths.map((path) => check(path, round)));
 }
```

**File**: `scripts/smoke-cli-package.mjs` (modified, +8/-0)
```diff
@@ -188,6 +188,14 @@ async function verifyGeneratedMcp() {
     if (result.tools.length === 0) {
       throw new Error('The MCP server generated by the packaged CLI exposed no tools.');
     }
+    const sdkTools = result.tools.filter((tool) => tool.name.startsWith('sdk_'));
+    if (
+      !sdkTools.some((tool) => tool.name === 'sdk_typescript_registry_smoke_typescript_client_sdk')
+    ) {
+      throw new Error(
+        'The MCP server generated by the packaged CLI exposed no TypeScript SDK tool.',
+      );
+    }
   } finally {
     await client.close();
   }
```

---

### Incident Patch 9: `65468a96` (2026-08-27)
**Commit Message**: fix(demo): match local docs and generate SDK MCP tools

Promote the verified static demo parity and SDK MCP tooling changes to pre-release.

**File**: `e2e/docs-ui-static.spec.ts` (modified, +28/-7)
```diff
@@ -24,20 +24,41 @@ test.describe('Cloudflare Static Assets export', () => {
 
   test('supports client navigation between generated documentation pages', async ({ page }) => {
     await page.goto('/docs/quickstart');
-    await expect(page.getByText('Getting Started').first()).toBeVisible();
-    await page
-      .getByRole('link', { name: /Configuration/ })
-      .last()
-      .click();
-    await expect(page).toHaveURL(/\/docs\/configuration/);
-    await expect(page.getByRole('heading', { name: 'Configuration' }).first()).toBeVisible();
+    await expect(page).toHaveTitle('Petstore Docs');
+    await expect(page.getByRole('heading', { name: 'Quickstart' })).toBeVisible();
+    await expect(page.getByRole('link', { name: 'Configuration' })).toHaveCount(0);
   });
 
   test('serves generated MCP and SDK deep links', async ({ page }) => {
     await page.goto('/mcp/docs_quickstart');
     await expect(page.getByText('docs_quickstart').first()).toBeVisible();
 
+    await page.goto('/mcp/sdk_typescript_petstore_typescript_client_sdk');
+    await expect(
+      page.getByText('sdk_typescript_petstore_typescript_client_sdk').first(),
+    ).toBeVisible();
+
     await page.goto('/sdks/typescript');
     await expect(page.getByText('TypeScript').first()).toBeVisible();
   });
+
+  test('matches the local demo documentation and MCP SDK tools', async ({ request }) => {
+    const docsResponse = await request.get('/api/docs');
+    const docs = await docsResponse.json();
+    expect(docs.sections).toEqual([
+      expect.objectContaining({
+        section: 'Get started',
+        documents: [expect.objectContaining({ title: 'Quickstart', slug: 'quickstart' })],
+      }),
+    ]);
+
+    const mcpResponse = await request.get('/api/mcp');
+    const mcp = await mcpResponse.json();
+    const toolNames = mcp.tools.map((tool: { name: string }) => tool.name);
+    expect(toolNames.filter((name: string) => name.startsWith('docs_'))).toEqual([
+      'docs_quickstart',
+    ]);
+    expect(toolNames.filter((name: string) => name.startsWith('sdk_'))).toHaveLength(11);
+    expect(toolNames).toContain('sdk_typescript_petstore_typescript_client_sdk');
+  });
 });
```

**File**: `packages/docs-ui/scripts/cloudflare.mjs` (modified, +11/-2)
```diff
@@ -22,6 +22,8 @@ if (!['demo', 'docs'].includes(target)) {
 const require = createRequire(import.meta.url);
 const scriptDir = dirname(fileURLToPath(import.meta.url));
 const docsUiDir = resolve(scriptDir, '..');
+const workspaceRoot = resolve(docsUiDir, '..', '..');
+const cliMain = join(workspaceRoot, 'packages', 'cli', 'dist', 'main.js');
 const outputDir = join(docsUiDir, '.next-cloudflare');
 const nextCli = require.resolve('next/dist/bin/next');
 const wranglerPackagePath = require.resolve('wrangler/package.json');
@@ -61,10 +63,10 @@ const env = {
     : {}),
 };
 
-function run(executable, args) {
+function run(executable, args, cwd = docsUiDir) {
   return new Promise((resolveCommand, rejectCommand) => {
     const child = spawn(executable, args, {
-      cwd: docsUiDir,
+      cwd,
       env,
       stdio: 'inherit',
     });
@@ -102,6 +104,13 @@ function validateStaticOutput() {
 
 try {
   rmSync(outputDir, { recursive: true, force: true });
+  if (target === 'demo') {
+    if (!existsSync(cliMain)) {
+      const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
+      await run(npm, ['run', 'build:cli'], workspaceRoot);
+    }
+    await run(process.execPath, [cliMain, 'generate'], prepared.demoDir);
+  }
   await run(process.execPath, [nextCli, 'build', '--webpack']);
   validateStaticOutput();
 
```

**File**: `packages/docs-ui/scripts/prepare-demo.mjs` (modified, +80/-26)
```diff
@@ -12,6 +12,51 @@ const demoDir = join(docsUiDir, '.cortex-demo');
 const fixturesDir = join(workspaceRoot, 'packages', 'core', '__fixtures__');
 const docsSiteDir = join(workspaceRoot, 'packages', 'docs-site');
 
+const quickstart = `# Quickstart
+
+Welcome to your API documentation! This guide will help you get started.
+
+## API Reference
+
+Browse the full API reference to see all available endpoints, request/response schemas, and authentication details.
+
+## SDKs
+
+Cortex generates type-safe SDKs for your API in multiple languages. Install the SDK for your language of choice and start making API calls in minutes.
+
+## MCP Server
+
+An MCP (Model Context Protocol) server is generated alongside your SDKs, enabling AI assistants to interact with your API using structured tool calls.
+
+## Next Steps
+
+- Explore the **API Reference** tab for endpoint details
+- Visit the **SDKs** tab to download generated clients
+- Check the **MCP** tab for AI integration setup
+`;
+
+const apiReferenceIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
+  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
+  <polyline points="14 2 14 8 20 8"/>
+  <line x1="16" y1="13" x2="8" y2="13"/>
+  <line x1="16" y1="17" x2="8" y2="17"/>
+  <polyline points="10 9 9 9 8 9"/>
+</svg>`;
+
+function buildLogo(textColor) {
+  const name = 'Petstore';
+  const totalWidth = Math.ceil(22 + 4 + name.length * 8.5);
+  const fillOpacity = textColor === '#ffffff' ? '0.1' : '0.08';
+  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} 21">
+  <g stroke="${textColor}" fill="none" stroke-linecap="round" stroke-linejoin="round">
+    <path d="M9,2.5 Q11,1 13,2.5 L18,5 Q20,6 18,7 L13,9.5 Q11,11 9,9.5 L4,7 Q2,6 4,5 Z" stroke-width="1.5" fill="${textColor}" fill-opacity="${fillOpacity}"/>
+    <path d="M3,10 L9,13.5 Q11,14.8 13,13.5 L19,10" stroke-width="1.5"/>
+    <path d="M3,13.5 L9,17 Q11,18.3 13,17 L19,13.5" stroke-width="1.5" stroke-opacity="0.5"/>
+  </g>
+  <text x="26" y="15" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="600" fill="${textColor}">${name}</text>
+</svg>`;
+}
+
 function copyFixture(sourceName, targetName, transform = (content) => content) {
   const content = readFileSync(join(fixturesDir, sourceName), 'utf8');
   writeFileSync(join(demoDir, 'specs', targetName), transform(content), 'utf8');
@@ -61,7 +106,26 @@ export function prepareDemo(apiUrl = process.env.CORTEX_DEMO_API_URL || 'http://
   });
 
   cpSync(join(docsSiteDir, 'assets'), join(demoDir, 'assets'), { recursive: true });
-  cpSync(join(docsSiteDir, 'docs'), join(demoDir, 'docs'), { recursive: true });
+  writeFileSync(join(demoDir, 'docs', 'quickstart.md'), quickstart, 'utf8');
+  writeFileSync(
+    join(demoDir, 'docs', 'REST_INTRO.md'),
+    `Welcome to the Petstore API. This API provides endpoints for managing resources.
+
+## Base URL
+
+\`\`\`
+${apiUrl}
+\`\`\`
+
+## Rate Limiting
+
+API requests are rate-limited to **1000 requests per minute** per API key. When you exceed the limit, requests return a \`429 Too Many Requests\` response. The \`Retry-After\` header indicates how long to wait before retrying.
+`,
+    'utf8',
+  );
+  writeFileSync(join(demoDir, 'assets', 'logo_dark.svg'), buildLogo('#ffffff'), 'utf8');
+  writeFileSync(join(demoDir, 'assets', 'logo_light.svg'), buildLogo('#0a0a0a'), 'utf8');
+  writeFileSync(join(demoDir, 'assets', 'api-reference-icon.svg'), apiReferenceIcon, 'utf8');
   writeFileSync(
     join(demoDir, 'assets', 'custom.css'),
     ':root { --cortex-custom-head-loaded: yes; }\n',
@@ -70,8 +134,8 @@ export function prepareDemo(apiUrl = process.env.CORTEX_DEMO_API_URL || 'http://
 
   const languages = sourceLanguages();
   const config = {
-    project: 'cortex-demo',
-    title: 'Cortex Docs Demo',
+    project: 'Petstore',
+    
```

**File**: `scripts/check-demo.mjs` (modified, +31/-0)
```diff
@@ -34,6 +34,15 @@ async function check(path, round, cacheBust = false) {
   await response.arrayBuffer();
 }
 
+async function readJson(path) {
+  const response = await fetch(`${baseUrl}${path}?check=${Date.now()}`, {
+    headers: { 'user-agent': 'cortex-demo-health-check/1.0' },
+    signal: AbortSignal.timeout(30_000),
+  });
+  if (!response.ok) throw new Error(`${path} returned ${response.status}.`);
+  return response.json();
+}
+
 let propagationFailures = [];
 for (let attempt = 1; attempt <= maximumPropagationAttempts; attempt += 1) {
   const results = await Promise.allSettled(
@@ -53,6 +62,28 @@ if (propagationFailures.length > 0) {
   throw propagationFailures[0].reason;
 }
 
+const [config, docs, mcp] = await Promise.all([
+  readJson('/api/config'),
+  readJson('/api/docs'),
+  readJson('/api/mcp'),
+]);
+if (config.project !== 'Petstore' || config.title !== 'Petstore Docs') {
+  throw new Error('The deployed demo does not use the local Petstore project configuration.');
+}
+const documents = docs.sections?.flatMap((section) => section.documents ?? []) ?? [];
+if (documents.length !== 1 || documents[0]?.title !== 'Quickstart') {
+  throw new Error('The deployed demo must contain only the Quickstart documentation page.');
+}
+const toolNames = mcp.tools?.map((tool) => tool.name) ?? [];
+const sdkTools = toolNames.filter((name) => name.startsWith('sdk_'));
+const docsTools = toolNames.filter((name) => name.startsWith('docs_'));
+if (sdkTools.length !== 11 || !sdkTools.includes('sdk_typescript_petstore_typescript_client_sdk')) {
+  throw new Error(`The deployed demo exposed ${sdkTools.length} sdk_* MCP tools instead of 11.`);
+}
+if (docsTools.length !== 1 || docsTools[0] !== 'docs_quickstart') {
+  throw new Error(`The deployed demo exposed unexpected documentation MCP tools: ${docsTools}.`);
+}
+
 for (let round = 1; round <= rounds; round += 1) {
   await Promise.all(paths.map((path) => check(path, round)));
 }
```

**File**: `scripts/smoke-cli-package.mjs` (modified, +8/-0)
```diff
@@ -188,6 +188,14 @@ async function verifyGeneratedMcp() {
     if (result.tools.length === 0) {
       throw new Error('The MCP server generated by the packaged CLI exposed no tools.');
     }
+    const sdkTools = result.tools.filter((tool) => tool.name.startsWith('sdk_'));
+    if (
+      !sdkTools.some((tool) => tool.name === 'sdk_typescript_registry_smoke_typescript_client_sdk')
+    ) {
+      throw new Error(
+        'The MCP server generated by the packaged CLI exposed no TypeScript SDK tool.',
+      );
+    }
   } finally {
     await client.close();
   }
```

---

### Incident Patch 10: `acbe280d` (2026-08-27)
**Commit Message**: fix(demo): match local docs and generate SDK MCP tools

**File**: `e2e/docs-ui-static.spec.ts` (modified, +28/-7)
```diff
@@ -24,20 +24,41 @@ test.describe('Cloudflare Static Assets export', () => {
 
   test('supports client navigation between generated documentation pages', async ({ page }) => {
     await page.goto('/docs/quickstart');
-    await expect(page.getByText('Getting Started').first()).toBeVisible();
-    await page
-      .getByRole('link', { name: /Configuration/ })
-      .last()
-      .click();
-    await expect(page).toHaveURL(/\/docs\/configuration/);
-    await expect(page.getByRole('heading', { name: 'Configuration' }).first()).toBeVisible();
+    await expect(page).toHaveTitle('Petstore Docs');
+    await expect(page.getByRole('heading', { name: 'Quickstart' })).toBeVisible();
+    await expect(page.getByRole('link', { name: 'Configuration' })).toHaveCount(0);
   });
 
   test('serves generated MCP and SDK deep links', async ({ page }) => {
     await page.goto('/mcp/docs_quickstart');
     await expect(page.getByText('docs_quickstart').first()).toBeVisible();
 
+    await page.goto('/mcp/sdk_typescript_petstore_typescript_client_sdk');
+    await expect(
+      page.getByText('sdk_typescript_petstore_typescript_client_sdk').first(),
+    ).toBeVisible();
+
     await page.goto('/sdks/typescript');
     await expect(page.getByText('TypeScript').first()).toBeVisible();
   });
+
+  test('matches the local demo documentation and MCP SDK tools', async ({ request }) => {
+    const docsResponse = await request.get('/api/docs');
+    const docs = await docsResponse.json();
+    expect(docs.sections).toEqual([
+      expect.objectContaining({
+        section: 'Get started',
+        documents: [expect.objectContaining({ title: 'Quickstart', slug: 'quickstart' })],
+      }),
+    ]);
+
+    const mcpResponse = await request.get('/api/mcp');
+    const mcp = await mcpResponse.json();
+    const toolNames = mcp.tools.map((tool: { name: string }) => tool.name);
+    expect(toolNames.filter((name: string) => name.startsWith('docs_'))).toEqual([
+      'docs_quickstart',
+    ]);
+    expect(toolNames.filter((name: string) => name.startsWith('sdk_'))).toHaveLength(11);
+    expect(toolNames).toContain('sdk_typescript_petstore_typescript_client_sdk');
+  });
 });
```

**File**: `packages/docs-ui/scripts/cloudflare.mjs` (modified, +11/-2)
```diff
@@ -22,6 +22,8 @@ if (!['demo', 'docs'].includes(target)) {
 const require = createRequire(import.meta.url);
 const scriptDir = dirname(fileURLToPath(import.meta.url));
 const docsUiDir = resolve(scriptDir, '..');
+const workspaceRoot = resolve(docsUiDir, '..', '..');
+const cliMain = join(workspaceRoot, 'packages', 'cli', 'dist', 'main.js');
 const outputDir = join(docsUiDir, '.next-cloudflare');
 const nextCli = require.resolve('next/dist/bin/next');
 const wranglerPackagePath = require.resolve('wrangler/package.json');
@@ -61,10 +63,10 @@ const env = {
     : {}),
 };
 
-function run(executable, args) {
+function run(executable, args, cwd = docsUiDir) {
   return new Promise((resolveCommand, rejectCommand) => {
     const child = spawn(executable, args, {
-      cwd: docsUiDir,
+      cwd,
       env,
       stdio: 'inherit',
     });
@@ -102,6 +104,13 @@ function validateStaticOutput() {
 
 try {
   rmSync(outputDir, { recursive: true, force: true });
+  if (target === 'demo') {
+    if (!existsSync(cliMain)) {
+      const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
+      await run(npm, ['run', 'build:cli'], workspaceRoot);
+    }
+    await run(process.execPath, [cliMain, 'generate'], prepared.demoDir);
+  }
   await run(process.execPath, [nextCli, 'build', '--webpack']);
   validateStaticOutput();
 
```

**File**: `packages/docs-ui/scripts/prepare-demo.mjs` (modified, +80/-26)
```diff
@@ -12,6 +12,51 @@ const demoDir = join(docsUiDir, '.cortex-demo');
 const fixturesDir = join(workspaceRoot, 'packages', 'core', '__fixtures__');
 const docsSiteDir = join(workspaceRoot, 'packages', 'docs-site');
 
+const quickstart = `# Quickstart
+
+Welcome to your API documentation! This guide will help you get started.
+
+## API Reference
+
+Browse the full API reference to see all available endpoints, request/response schemas, and authentication details.
+
+## SDKs
+
+Cortex generates type-safe SDKs for your API in multiple languages. Install the SDK for your language of choice and start making API calls in minutes.
+
+## MCP Server
+
+An MCP (Model Context Protocol) server is generated alongside your SDKs, enabling AI assistants to interact with your API using structured tool calls.
+
+## Next Steps
+
+- Explore the **API Reference** tab for endpoint details
+- Visit the **SDKs** tab to download generated clients
+- Check the **MCP** tab for AI integration setup
+`;
+
+const apiReferenceIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
+  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
+  <polyline points="14 2 14 8 20 8"/>
+  <line x1="16" y1="13" x2="8" y2="13"/>
+  <line x1="16" y1="17" x2="8" y2="17"/>
+  <polyline points="10 9 9 9 8 9"/>
+</svg>`;
+
+function buildLogo(textColor) {
+  const name = 'Petstore';
+  const totalWidth = Math.ceil(22 + 4 + name.length * 8.5);
+  const fillOpacity = textColor === '#ffffff' ? '0.1' : '0.08';
+  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} 21">
+  <g stroke="${textColor}" fill="none" stroke-linecap="round" stroke-linejoin="round">
+    <path d="M9,2.5 Q11,1 13,2.5 L18,5 Q20,6 18,7 L13,9.5 Q11,11 9,9.5 L4,7 Q2,6 4,5 Z" stroke-width="1.5" fill="${textColor}" fill-opacity="${fillOpacity}"/>
+    <path d="M3,10 L9,13.5 Q11,14.8 13,13.5 L19,10" stroke-width="1.5"/>
+    <path d="M3,13.5 L9,17 Q11,18.3 13,17 L19,13.5" stroke-width="1.5" stroke-opacity="0.5"/>
+  </g>
+  <text x="26" y="15" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="16" font-weight="600" fill="${textColor}">${name}</text>
+</svg>`;
+}
+
 function copyFixture(sourceName, targetName, transform = (content) => content) {
   const content = readFileSync(join(fixturesDir, sourceName), 'utf8');
   writeFileSync(join(demoDir, 'specs', targetName), transform(content), 'utf8');
@@ -61,7 +106,26 @@ export function prepareDemo(apiUrl = process.env.CORTEX_DEMO_API_URL || 'http://
   });
 
   cpSync(join(docsSiteDir, 'assets'), join(demoDir, 'assets'), { recursive: true });
-  cpSync(join(docsSiteDir, 'docs'), join(demoDir, 'docs'), { recursive: true });
+  writeFileSync(join(demoDir, 'docs', 'quickstart.md'), quickstart, 'utf8');
+  writeFileSync(
+    join(demoDir, 'docs', 'REST_INTRO.md'),
+    `Welcome to the Petstore API. This API provides endpoints for managing resources.
+
+## Base URL
+
+\`\`\`
+${apiUrl}
+\`\`\`
+
+## Rate Limiting
+
+API requests are rate-limited to **1000 requests per minute** per API key. When you exceed the limit, requests return a \`429 Too Many Requests\` response. The \`Retry-After\` header indicates how long to wait before retrying.
+`,
+    'utf8',
+  );
+  writeFileSync(join(demoDir, 'assets', 'logo_dark.svg'), buildLogo('#ffffff'), 'utf8');
+  writeFileSync(join(demoDir, 'assets', 'logo_light.svg'), buildLogo('#0a0a0a'), 'utf8');
+  writeFileSync(join(demoDir, 'assets', 'api-reference-icon.svg'), apiReferenceIcon, 'utf8');
   writeFileSync(
     join(demoDir, 'assets', 'custom.css'),
     ':root { --cortex-custom-head-loaded: yes; }\n',
@@ -70,8 +134,8 @@ export function prepareDemo(apiUrl = process.env.CORTEX_DEMO_API_URL || 'http://
 
   const languages = sourceLanguages();
   const config = {
-    project: 'cortex-demo',
-    title: 'Cortex Docs Demo',
+    project: 'Petstore',
+    
```

**File**: `scripts/check-demo.mjs` (modified, +31/-0)
```diff
@@ -34,6 +34,15 @@ async function check(path, round, cacheBust = false) {
   await response.arrayBuffer();
 }
 
+async function readJson(path) {
+  const response = await fetch(`${baseUrl}${path}?check=${Date.now()}`, {
+    headers: { 'user-agent': 'cortex-demo-health-check/1.0' },
+    signal: AbortSignal.timeout(30_000),
+  });
+  if (!response.ok) throw new Error(`${path} returned ${response.status}.`);
+  return response.json();
+}
+
 let propagationFailures = [];
 for (let attempt = 1; attempt <= maximumPropagationAttempts; attempt += 1) {
   const results = await Promise.allSettled(
@@ -53,6 +62,28 @@ if (propagationFailures.length > 0) {
   throw propagationFailures[0].reason;
 }
 
+const [config, docs, mcp] = await Promise.all([
+  readJson('/api/config'),
+  readJson('/api/docs'),
+  readJson('/api/mcp'),
+]);
+if (config.project !== 'Petstore' || config.title !== 'Petstore Docs') {
+  throw new Error('The deployed demo does not use the local Petstore project configuration.');
+}
+const documents = docs.sections?.flatMap((section) => section.documents ?? []) ?? [];
+if (documents.length !== 1 || documents[0]?.title !== 'Quickstart') {
+  throw new Error('The deployed demo must contain only the Quickstart documentation page.');
+}
+const toolNames = mcp.tools?.map((tool) => tool.name) ?? [];
+const sdkTools = toolNames.filter((name) => name.startsWith('sdk_'));
+const docsTools = toolNames.filter((name) => name.startsWith('docs_'));
+if (sdkTools.length !== 11 || !sdkTools.includes('sdk_typescript_petstore_typescript_client_sdk')) {
+  throw new Error(`The deployed demo exposed ${sdkTools.length} sdk_* MCP tools instead of 11.`);
+}
+if (docsTools.length !== 1 || docsTools[0] !== 'docs_quickstart') {
+  throw new Error(`The deployed demo exposed unexpected documentation MCP tools: ${docsTools}.`);
+}
+
 for (let round = 1; round <= rounds; round += 1) {
   await Promise.all(paths.map((path) => check(path, round)));
 }
```

**File**: `scripts/smoke-cli-package.mjs` (modified, +6/-0)
```diff
@@ -188,6 +188,12 @@ async function verifyGeneratedMcp() {
     if (result.tools.length === 0) {
       throw new Error('The MCP server generated by the packaged CLI exposed no tools.');
     }
+    const sdkTools = result.tools.filter((tool) => tool.name.startsWith('sdk_'));
+    if (!sdkTools.some((tool) => tool.name === 'sdk_typescript_petstore_typescript_client_sdk')) {
+      throw new Error(
+        'The MCP server generated by the packaged CLI exposed no TypeScript SDK tool.',
+      );
+    }
   } finally {
     await client.close();
   }
```

#### Recent Merged Pull Requests:
- **PR #109** (2026-09-28): Release hosted documentation and live repository MCP (@nick-csu)
- **PR #108** (2026-09-28): feat: release hosted documentation and live repository MCP (@nick-csu)
- **PR #107** (2026-09-22): docs: promote primary color configuration example (@nick-csu)
- **PR #106** (2026-09-22): docs: show primaryColor in README configuration (@nick-csu)
- **PR #99** (2019-05-08): added new doc #1 (@nick-csu)
- **PR #98** (2019-05-08): added doc roadmap (@nick-csu)
- **PR #96** (2019-04-18): added 2way payment tutorial (@nick-csu)
- **PR #95** (2019-04-17): fixed readme gif intro (@nick-csu)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
