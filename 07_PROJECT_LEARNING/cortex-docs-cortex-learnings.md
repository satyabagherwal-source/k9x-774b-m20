# Forensic Learning Record (Deep Inspection): cortex-docs/cortex

> **Canonical Artifact**: `07_PROJECT_LEARNING/cortex-docs-cortex-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cortex-docs/cortex](https://github.com/cortex-docs/cortex))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:04:13.622Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cortex-docs/cortex`
- **Description**: Cortex - Generates interactive API documentation, typed SDKs, and MCP servers from OpenAPI, AsyncAPI, GraphQL, gRPC, OpenRPC, and Markdown.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 3231 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

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

### Core Architecture Module: `packages/codegen/src/engine.ts`
```
import * as fs from 'node:fs';
import * as path from 'node:path';
import type {
  ParsedSpec,
  CortexConfig,
  GraphQLSpec,
  AsyncApiSpec,
  GrpcSpec,
  OpenRpcSpec,
} from '@cortex-docs/core';
import { getSourceLanguageTemplateDir, resolveGeneratorTemplateRoot } from '@cortex-docs/core';
import { FileEmitter, type EmitResult } from './emitter';
import type { CodegenContext, GeneratedFile } from './plugin';
import { PluginRegistry } from './plugin';
import { getLanguageNaming } from './naming';
import type { TemplateRenderOptions } from './template-renderer';

export interface GenerationResult {
  languages: LanguageResult[];
  errors: string[];
}

export interface LanguageResult {
  language: string;
  files: GeneratedFile[];
  emit: EmitResult;
}

export interface GenerateOptions extends TemplateRenderOptions {
  /** Path to cortex.config.yml. Relative source template paths use this directory. */
  configPath?: string;
  gqlSpec?: GraphQLSpec;
  asyncSpec?: AsyncApiSpec;
  grpcSpec?: GrpcSpec;
  openRpcSpec?: OpenRpcSpec;
}

export class CodegenEngine {
  constructor(
    private registry: PluginRegistry,
    private emitter: FileEmitter,
  ) {}

  async generate(
    spec: ParsedSpec,
    config: CortexConfig,
    options?: GenerateOptions,
  ): Promise<GenerationResult> {
    const result: GenerationResult = { languages: [], errors: [] };
    const templateRoot = options?.templateRoot ?? resolveGeneratorTemplateRoot(config);

    for (const langConfig of config.languages) {
      const plugin = this.registry.get(langConfig.language);
      if (!plugin) {
        result.errors.push(
          `No plugin registered for language: ${langConfig.language}. Available: ${this.registry.getAvailableLanguages().join(', ')}`,
        );
        continue;
      }

      const naming = getLanguageNaming(langConfig.language);
      const context: CodegenContext = {
        spec,
        config,
        languageConfig: langConfig,
        naming,
        gqlSpec: options?.gqlSpec,
        asyncSpec: options?.asyncSpec,
        grpcSpec: options?.grpcSpec,
        openRpcSpec: options?.openRpcSpec,
        templateRoot,
        templateDir:
          options?.templateDir ??
          getSourceLanguageTemplateDir(
            config,
            'openapi-spec',
            langConfig.language,
            langConfig.package_name,
            options?.configPath,
          ),
      };

      try {
        const files = await plugin.generate(context);
        this.removeLegacyBlankResource(langConfig.output_dir, plugin.fileExtension);
        const emit = await this.emitter.writeFiles(files, langConfig.output_dir);

        result.languages.push({
          language: langConfig.language,
          files,
          emit,
        });
      } catch (err) {
        result.errors.push(
          `Failed to generate ${langConfig.language}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    return result;
  }

  private removeLegacyBlankResource(outputDir: string, fileExtension: string): void {
    const legacyPath = path.resolve(outputDir, 'src', 'resources', fileExtension);
    if (fs.existsSync(legacyPath) && fs.statSync(legacyPath).isFile()) {
      fs.unlinkSync(legacyPath);
    }
  }
}

```

### Core Architecture Module: `packages/codegen/src/snippet-renderer.ts`
```
import {
  singularize,
  toPascalCase,
  toCamelCase,
  toSnakeCase,
  toKebabCase,
  toUpperSnakeCase,
} from '@cortex-docs/core';
import { getLanguageNaming } from './naming';
import { createLanguageTemplateRenderer, type TemplateRenderOptions } from './template-renderer';

export interface SnippetData {
  [key: string]: unknown;
}

export function renderLanguageTemplate(
  language: string,
  templateName: string,
  data: SnippetData,
  options?: TemplateRenderOptions,
): string | null {
  return createLanguageTemplateRenderer(language, options).render(templateName, data);
}

export function renderSnippet(
  language: string,
  templateName: string,
  data: SnippetData,
  options?: TemplateRenderOptions,
): string | null {
  const naming = getLanguageNaming(language);

  const enrichedData: Record<string, unknown> = {
    ...data,
    naming,
    utils: {
      singularize,
      toPascalCase,
      toCamelCase,
      toSnakeCase,
      toKebabCase,
      toUpperSnakeCase,
    },
  };

  const resource = enrichedData.resource as Record<string, unknown> | undefined;
  if (resource?.name && !resource.className) {
    enrichedData.resource = {
      ...resource,
      className: naming.className(singularize(resource.name as string)) + 'Resource',
      fileName: naming.fileName(resource.name as string),
    };
  }

  return renderLanguageTemplate(language, templateName, enrichedData, options);
}

export function renderRestSnippet(
  language: string,
  data: {
    op: Record<string, unknown>;
    resource: Record<string, unknown>;
    schemas: Array<Record<string, unknown>>;
    config: { languageConfig: { package_name: string } };
    spec: { info: { servers: Array<{ url: string }> } };
    [key: string]: unknown;
  },
  options?: TemplateRenderOptions,
): string | null {
  return (
    renderSnippet(language, 'rest/snippet', data, options) ??
    renderSnippet(language, 'rest/init', data, options)
  );
}

export function getAvailableSnippetTemplates(
  language: string,
  options?: TemplateRenderOptions,
): string[] {
  const protocols = new Set(['rest', 'graphql', 'websocket', 'grpc', 'openrpc']);
  return createLanguageTemplateRenderer(language, options)
    .list()
    .filter((name) => protocols.has(name.split('/')[0]) && !name.includes('/files/'));
}

```

### Core Architecture Module: `packages/codegen/src/template-renderer.ts`
```
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { Eta } from 'eta';
import type { GeneratedFile } from './plugin';

export interface TemplateRenderOptions {
  /** Absolute path to the configured custom template root. */
  templateRoot?: string;
  /** Absolute path to a source-language template directory. */
  templateDir?: string;
}

export type TemplateGenerator = 'language' | 'websocket' | 'graphql' | 'grpc' | 'openrpc';

function isDirectory(candidate: string): boolean {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

export function assertTemplateRoot(templateRoot?: string): void {
  if (!templateRoot) return;
  if (!isDirectory(templateRoot)) {
    throw new Error(`Custom template root not found: ${templateRoot}`);
  }
}

export function findLanguageTemplateDir(language: string): string {
  let installedPackageDir: string | undefined;
  try {
    const runtimeRequire = createRequire(path.join(process.cwd(), 'package.json'));
    installedPackageDir = path.dirname(runtimeRequire.resolve('@cortex-docs/codegen/package.json'));
  } catch {
    // Source checkouts can use the paths below.
  }
  const candidates = [
    path.resolve(__dirname, 'languages', language, 'templates'),
    ...(installedPackageDir
      ? [path.join(installedPackageDir, 'dist', 'languages', language, 'templates')]
      : []),
    path.resolve(
      process.cwd(),
      'node_modules/@cortex-docs/codegen/dist/languages',
      language,
      'templates',
    ),
    path.resolve(process.cwd(), '../codegen/dist/languages', language, 'templates'),
    path.resolve(process.cwd(), '../codegen/src/languages', language, 'templates'),
  ];
  return candidates.find(isDirectory) ?? candidates[0];
}

function templateFilename(name: string): string {
  const filename = name.endsWith('.ejs') ? name : `${name}.ejs`;
  const normalized = path.normalize(filename);
  if (
    path.isAbsolute(normalized) ||
    normalized === '..' ||
    normalized.startsWith(`..${path.sep}`)
  ) {
    throw new Error(`Template path must stay inside its template directory: ${name}`);
  }
  return normalized;
}

function isWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export class LayeredTemplateRenderer {
  readonly eta: Eta;
  readonly customDirs: string[];

  constructor(
    readonly builtInDir: string,
    readonly customDir?: string,
    fallbackCustomDir?: string,
  ) {
    this.customDirs = Array.from(
      new Set([customDir, fallbackCustomDir].filter((value): value is string => !!value)),
    );
    this.eta = new Eta({
      autoEscape: false,
      autoTrim: false,
      views: builtInDir,
      defaultExtension: '.ejs',
      cacheFilepaths: false,
    });
    this.eta.resolvePath = (templatePath, renderOptions) => {
      let name = templatePath;
      const sourcePath = renderOptions?.filepath;
      if ((name.startsWith('./') || name.startsWith('../')) && sourcePath) {
        const sourceRoot =
          this.customDirs.find((root) => isWithin(root, sourcePath)) ?? this.builtInDir;
        const sourceDir = path.relative(sourceRoot, path.dirname(sourcePath));
        name = path.join(sourceDir, name);
      }

      const resolved = this.resolve(name);
      if (!resolved) throw new Error(`Template not found: ${templateFilename(name)}`);
      return resolved;
    };
  }

  resolve(name: string): string | null {
    const filename = templateFilename(name);
    for (const customDir of this.customDirs) {
      const customPath = path.join(customDir, filename);
      if (fs.existsSync(customPath)) return customPath;
    }

    const builtInPath = path.join(this.builtInDir, filename);
    return fs.existsSync(builtInPath) ? builtInPath : null;
  }

  load(name: string): string | null {
    const templatePath = this.resolve(name);
    return templatePath ? fs.readFileSync(templatePath, 'utf-8') : null;
  }

  render<TData extends object>(name: string, data: TData): string | null {
    const templatePath = this.resolve(name);
    if (!templatePath) return null;
    const template = fs.readFileSync(templatePath, 'utf-8');
    try {
      return this.eta.renderString(template, data);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to render template ${templatePath}: ${message}`, { cause: error });
    }
  }

  list(): string[] {
    const names = new Set<string>();
    for (const root of [this.builtInDir, ...this.customDirs]) {
      if (!root || !isDirectory(root)) continue;
      const visit = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const candidate = path.join(dir, entry.name);
          if (entry.isDirectory()) visit(candidate);
          if (entry.isFile() && entry.name.endsWith('.ejs')) {
            names.add(
              path
                .relative(root, candidate)
                .split(path.sep)
                .join('/')
                .replace(/\.ejs$/, ''),
            );
          }
        }
      };
      visit(root);
    }
    return Array.from(names).sort();
  }
}

export function createLanguageTemplateRenderer(
  language: string,
  options?: TemplateRenderOptions,
): LayeredTemplateRenderer {
  assertTemplateRoot(options?.templateRoot);
  assertTemplateRoot(options?.templateDir);
  const globalCustomDir = options?.templateRoot
    ? path.join(options.templateRoot, 'languages', language)
    : undefined;
  return new LayeredTemplateRenderer(
    findLanguageTemplateDir(language),
    options?.templateDir,
    globalCustomDir,
  );
}

export function applyFileTemplateOverrides<TData extends object>(
  files: GeneratedFile[],
  renderer: LayeredTemplateRenderer,
  data: TData,
  generator: TemplateGenerator,
): GeneratedFile[] {
  return files.map((file) => {
    const outputPath = file.path.split(path.sep).join('/');
    const content = renderer.render(`files/${outputPath}.ejs`, {
      ...data,
      generator,
      file: { ...file },
    });
    return content === null ? file : { ...file, content };
  });
}

```

### Core Architecture Module: `packages/core/src/asyncapi/parser.ts`
```
import * as fs from 'node:fs';
import * as yaml from 'js-yaml';
import type { SchemaObject } from '../openapi/types';
import type { AsyncApiSpec, AsyncApiServer, AsyncApiChannel, AsyncApiOperation } from './types';

/** Raw parsed AsyncAPI document before transformation. */
interface RawAsyncApiDocument {
  asyncapi?: string;
  info?: {
    title?: string;
    version?: string;
    description?: string;
  };
  servers?: Record<string, RawAsyncApiServer>;
  channels?: Record<string, RawAsyncApiChannelV2 | RawAsyncApiChannelV3>;
  operations?: Record<string, RawAsyncApiOperationV3>;
  components?: {
    schemas?: Record<string, RawSchemaObject>;
    messages?: Record<string, RawAsyncApiMessage>;
  };
}

interface RawAsyncApiServer {
  url?: string;
  host?: string;
  pathname?: string;
  protocol?: string;
  description?: string;
}

interface RawAsyncApiChannelV2 {
  description?: string;
  subscribe?: RawAsyncApiOperation;
  publish?: RawAsyncApiOperation;
}

interface RawAsyncApiChannelV3 {
  address?: string;
  description?: string;
  messages?: Record<string, RawAsyncApiMessage>;
}

interface RawAsyncApiOperation {
  operationId?: string;
  summary?: string;
  title?: string;
  description?: string;
  message?: RawAsyncApiMessage;
  messages?: RawAsyncApiMessage[] | Record<string, RawAsyncApiMessage>;
}

interface RawAsyncApiOperationV3 extends RawAsyncApiOperation {
  action?: string;
  channel?: { $ref?: string } | string;
}

interface RawAsyncApiMessage {
  $ref?: string;
  oneOf?: RawAsyncApiMessage[];
  name?: string;
  title?: string;
  summary?: string;
  description?: string;
  contentType?: string;
  payload?: RawSchemaObject;
}

interface RawSchemaObject {
  $ref?: string;
  type?: string;
  const?: string | number;
  format?: string;
  description?: string;
  required?: string[];
  properties?: Record<string, RawSchemaObject>;
  items?: RawSchemaObject;
  enum?: (string | number)[];
  payload?: RawSchemaObject;
  schema?: RawSchemaObject;
  additionalProperties?: boolean | RawSchemaObject;
  oneOf?: RawSchemaObject[];
  anyOf?: RawSchemaObject[];
  allOf?: RawSchemaObject[];
  nullable?: boolean;
}

export class AsyncAPIParser {
  async parse(specPath: string): Promise<AsyncApiSpec> {
    const content = await this.loadContent(specPath);
    const raw = typeof content === 'string' ? this.parseContent(content, specPath) : content;

    const asyncapiVersion = raw.asyncapi ?? '2.0.0';
    const isV3 = asyncapiVersion.startsWith('3.');

    return {
      title: raw.info?.title ?? 'Untitled',
      version: raw.info?.version ?? '0.0.0',
      description: raw.info?.description,
      servers: this.extractServers(raw.servers, isV3),
      channels: isV3
        ? this.extractChannelsV3(
            raw.channels as Record<string, RawAsyncApiChannelV3> | undefined,
            raw.operations,
            raw,
          )
        : this.extractChannelsV2(
            raw.channels as Record<string, RawAsyncApiChannelV2> | undefined,
            raw,
          ),
      schemas: this.extractSchemas(raw.components?.schemas, raw),
    };
  }

  private async loadContent(specPath: string): Promise<string> {
    if (specPath.startsWith('http://') || specPath.startsWith('https://')) {
      const res = await fetch(specPath, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`Failed to fetch ${specPath}: ${res.status}`);
      return res.text();
    }
    return fs.readFileSync(specPath, 'utf-8');
  }

  private parseContent(content: string, specPath: string): RawAsyncApiDocument {
    if (specPath.endsWith('.json') || content.trimStart().startsWith('{')) {
      return JSON.parse(content) as RawAsyncApiDocument;
    }
    return yaml.load(content) as RawAsyncApiDocument;
  }

  private extractServers(
    servers?: Record<string, RawAsyncApiServer>,
    isV3 = false,
  ): AsyncApiServer[] {
    if (!servers) return [];
    return Object.values(servers).map((s) => ({
      url: isV3 ? this.buildV3ServerUrl(s) : this.buildV2ServerUrl(s),
      protocol: s.protocol ?? 'ws',
      description: s.description,
    }));
  }

  private buildV2ServerUrl(server: RawAsyncApiServer): string {
    const url = server.url ?? '';
    if (!url || /^[a-z][a-z\d+.-]*:\/\//i.test(url)) return url;
    if (url.startsWith('//')) return `${server.protocol ?? 'ws'}:${url}`;
    return `${server.protocol ?? 'ws'}://${url}`;
  }

  private buildV3ServerUrl(server: RawAsyncApiServer): string {
    if (server.url) return server.url;
    if (!server.host) return '';
    const host = /^[a-z][a-z\d+.-]*:\/\//i.test(server.host)
      ? server.host
      : `${server.protocol ?? 'ws'}://${server.host}`;
    return `${host.replace(/\/$/, '')}${server.pathname ?? ''}`;
  }

  // AsyncAPI 2.x: channels have inline subscribe/publish
  private extractChannelsV2(
    channels: Record<string, RawAsyncApiChannelV2> | undefined,
    raw: RawAsyncApiDocument,
  ): AsyncApiChannel[] {
    if (!channels) return [];

    return Object.entries(channels).map(([name, ch]) => ({
      name,
      description: ch.description,
      subscribe: ch.subscribe ? this.extractOperation(ch.subscribe, raw) : undefined,
      publish: ch.publish ? this.extractOperation(ch.publish, raw) : undefined,
    }));
  }

  // AsyncAPI 3.x: channels are separate, operations reference channels via $ref or channel key
  private extractChannelsV3(
    channels?: Record<string, RawAsyncApiChannelV3>,
    operations?: Record<string, RawAsyncApiOperationV3>,
    raw?: RawAsyncApiDocument,
  ): AsyncApiChannel[] {
    if (!channels) return [];

    const channelMap = new Map<string, AsyncApiChannel>();

    for (const [name, ch] of Object.entries(channels)) {
      channelMap.set(name, {
        name: ch.address ?? name,
        description: ch.description,
      });
    }

    if (operations) {
      for (const [operationKey, op] of Object.entries(operations)) {
        const action = op.action;
        const channelField = op.channel;
        const channelRef =
          typeof channelField === 'object' && channelField !== null
            ? (channelField.$ref ?? undefined)
            : typeof channelField === 'string'
              ? channelField
              : undefined;
        const channelKey =
          typeof channelRef === 'string' ? channelRef.replace('#/channels/', '') : undefined;

        if (!channelKey || !channelMap.has(channelKey)) continue;

        const channel = channelMap.get(channelKey)!;
        const parsedOp = this.extractOperation(
          { ...op, operationId: op.operationId ?? operationKey },
          raw ?? {},
        );

        if (action === 'receive') {
          channel.subscribe = parsedOp;
        } else if (action === 'send') {
          channel.publish = parsedOp;
        }
      }
    }

    return Array.from(channelMap.values());
  }

  private extractOperation(op: RawAsyncApiOperation, raw: RawAsyncApiDocument): AsyncApiOperation {
    const messageCandidate = this.firstMessage(op);
    const message = this.resolveLocalReference<RawAsyncApiMessage>(messageCandidate, raw);
    const rawPayload = message?.payload;
    const schemaInput = rawPayload?.schema ?? rawPayload?.payload ?? rawPayload;
    return {
      operationId: op.operationId,
      summary: op.summary ?? op.title,
      description: op.description,
      message: {
        name: message?.name ?? this.referenceName(messageCandidate),
        title: message?.title ?? message?.summary,
        description: message?.description ?? message?.summary ?? message?.title,
        contentType: message?.contentType ?? 'application/json',
        schema: this.convertSchema(schemaInput, raw),
      },
    };
  }

  private firstMessage(op: RawAsyncApiOperation): RawAsyncApiMessage | undefined {
    if (op.message) return op.message.oneOf?.[0] ?? op.message;
    if (Array.isArray(op.messages)) return op.messages[0];
    if (op.messages) return Object.values(op.messages)[0];
    return undefined;
  }

  private referenceName(value?: { $ref?: string }): string | undefined {
    return value?.$ref?.split('/').pop();
  }

  private resolveLocalReference<T>(value: T | undefined, raw: RawAsyncApiDocument): T | undefined {
    let current: unknown = value;
    const seen = new Set<string>();

    while (current && typeof current === 'object' && '$ref' in current) {
      const ref = (current as { $ref?: unknown }).$ref;
      if (typeof ref !== 'string' || !ref.startsWith('#/') || seen.has(ref)) break;
      seen.add(ref);

      let resolved: unknown = raw;
      for (const part of ref
        .slice(2)
        .split('/')
        .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))) {
        if (!resolved || typeof resolved !== 'object') return current as T;
        resolved = (resolved as Record<string, unknown>)[part];
      }
      if (resolved === undefined) break;
      current = resolved;
    }

    return current as T | undefined;
  }

  private extractSchemas(
    schemas: Record<string, RawSchemaObject> | undefined,
    raw: RawAsyncApiDocument,
  ): Map<string, SchemaObject> {
    const result = new Map<string, SchemaObject>();
    if (!schemas) return result;

    for (const [name, schema] of Object.entries(schemas)) {
      result.set(name, { name, ...this.convertSchema(schema, raw) });
    }
    return result;
  }

  private convertSchema(
    schema: RawSchemaObject | undefined,
    raw: RawAsyncApiDocument,
    resolving = new Set<string>(),
  ): SchemaObject {
    if (!schema) return { type: 'unknown' };

    if (schema.$ref) {
      if (resolving.has(schema.$ref)) return { ref: schema.$ref, type: 'object' };
      const resolved = this.resolveLocalReference<RawSchemaObject>(schema, raw);
      if (!resolved || resolved === schema) return { ref: schema.$ref, type: 'unknown' };
      const nextResolving = new Set(resolving).add(schema.$ref);
      return { ...this.convertSchema(resolved, raw, nextResolving), ref: schema.$ref };
    }

    co
```

### Core Architecture Module: `packages/core/src/asyncapi/types.ts`
```
import type { SchemaObject } from '../openapi/types';

export interface AsyncApiSpec {
  title: string;
  version: string;
  description?: string;
  servers: AsyncApiServer[];
  channels: AsyncApiChannel[];
  schemas: Map<string, SchemaObject>;
}

export interface AsyncApiServer {
  url: string;
  protocol: string;
  description?: string;
}

export interface AsyncApiChannel {
  name: string;
  description?: string;
  subscribe?: AsyncApiOperation;
  publish?: AsyncApiOperation;
}

export interface AsyncApiOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  message: AsyncApiMessage;
}

export interface AsyncApiMessage {
  name?: string;
  title?: string;
  description?: string;
  contentType?: string;
  schema: SchemaObject;
}

```

### Core Architecture Module: `packages/core/src/config/loader.ts`
```
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as yaml from 'js-yaml';
import { cortexConfigSchema } from './schema';
import type { CortexConfig } from './types';
import { computeEffectiveLanguages } from './utils';
import { resolveConfigPath } from './utils';

const CONFIG_FILENAMES = ['cortex.config.yml', 'cortex.config.yaml', 'cortex.yml'];

export class ConfigLoader {
  async load(configPath?: string): Promise<CortexConfig> {
    const resolvedPath = configPath ?? (await this.findConfigFile());

    if (!resolvedPath) {
      throw new Error(
        'No cortex config file found. Run `cortex init` to create one, or specify --config.',
      );
    }

    const absoluteConfigPath = path.resolve(resolvedPath);
    const content = fs.readFileSync(absoluteConfigPath, 'utf-8');
    const raw = yaml.load(content);

    return this.resolvePaths(this.validate(raw), absoluteConfigPath);
  }

  async findConfigFile(startDir?: string): Promise<string | null> {
    let dir = startDir ?? process.cwd();

    for (let i = 0; i < 10; i++) {
      for (const filename of CONFIG_FILENAMES) {
        const candidate = path.join(dir, filename);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }

      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }

    return null;
  }

  validate(raw: unknown): CortexConfig {
    const result = cortexConfigSchema.safeParse(raw);

    if (!result.success) {
      const issues = result.error.issues
        .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
        .join('\n');
      throw new Error(`Invalid cortex config:\n${issues}`);
    }

    const data = result.data;
    const languages = computeEffectiveLanguages(data as CortexConfig);

    return { ...data, languages } as CortexConfig;
  }

  private resolvePaths(config: CortexConfig, configPath: string): CortexConfig {
    const sources = config.sources.map((source) => ({
      ...source,
      spec: resolveConfigPath(source.spec, configPath),
      intro: source.intro ? resolveConfigPath(source.intro, configPath) : undefined,
      languages: source.languages.map((language) => ({
        ...language,
        template: language.template ? resolveConfigPath(language.template, configPath) : undefined,
      })),
    }));

    const docs = config.docs?.map((section) => ({
      ...section,
      sources: section.sources.map((document) => ({
        ...document,
        document: resolveConfigPath(document.document, configPath),
      })),
    }));

    const home = config.home
      ? {
          ...config.home,
          sections: config.home.sections?.map((section) => ({
            ...section,
            icon: section.icon ? resolveConfigPath(section.icon, configPath) : undefined,
            background: section.background
              ? resolveConfigPath(section.background, configPath)
              : undefined,
          })),
        }
      : undefined;

    const resolved = {
      ...config,
      logo: config.logo ? resolveConfigPath(config.logo, configPath) : undefined,
      logo_dark: config.logo_dark ? resolveConfigPath(config.logo_dark, configPath) : undefined,
      logo_light: config.logo_light ? resolveConfigPath(config.logo_light, configPath) : undefined,
      favicon: config.favicon ? resolveConfigPath(config.favicon, configPath) : undefined,
      generators: config.generators
        ? { templates: resolveConfigPath(config.generators.templates, configPath) }
        : undefined,
      output: {
        base_dir: resolveConfigPath(config.output.base_dir, configPath),
      },
      sources,
      docs,
      home,
    } as CortexConfig;

    return { ...resolved, languages: computeEffectiveLanguages(resolved) };
  }
}

```

### Core Architecture Module: `packages/core/src/config/schema.ts`
```
import { z } from 'zod';

const supportedLanguages = [
  'typescript',
  'python',
  'go',
  'java',
  'kotlin',
  'ruby',
  'php',
  'csharp',
  'rust',
  'cpp',
  'c',
] as const;

const sourceTypes = [
  'openapi-spec',
  'asyncapi-spec',
  'graphql-spec',
  'grpc-spec',
  'openrpc-spec',
] as const;

const environmentVariableSchema = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'Must be a valid environment variable name');

const publishGitHubConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    token_env: environmentVariableSchema.optional(),
    username_env: environmentVariableSchema.optional(),
    auth: z.boolean().optional(),
    branch: z
      .string()
      .regex(/^(?!\/|.*(?:\.\.|\/\/|@\{|\\))[A-Za-z0-9._\/-]+(?<![\/.])$/)
      .optional(),
  })
  .strict();

const publishRegistryConfigSchema = z
  .object({
    enabled: z.boolean().optional(),
    url: z.string().min(1).optional(),
    name: z
      .string()
      .regex(/^[A-Za-z0-9_-]+$/)
      .optional(),
    token_env: environmentVariableSchema.optional(),
    username_env: environmentVariableSchema.optional(),
    auth: z.boolean().optional(),
    access: z.enum(['public', 'restricted']).optional(),
    github: z.union([z.boolean(), publishGitHubConfigSchema]).optional(),
  })
  .strict();

const sourceLanguageConfigSchema = z
  .object({
    language: z.enum(supportedLanguages),
    package_name: z.string().min(1),
    template: z.string().min(1).optional(),
    github_repository: z.string().optional(),
    publish: publishRegistryConfigSchema.optional(),
  })
  .strict();

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(z.string(), jsonValueSchema),
  ]),
);

const heartbeatFlowSchema = z
  .object({
    message: jsonValueSchema,
    response: jsonValueSchema.optional(),
  })
  .strict();

const websocketHeartbeatSchema = z
  .object({
    enabled: z.boolean().default(true),
    format: z.enum(['json', 'text']).default('json'),
    interval_ms: z.number().int().positive().default(30_000),
    timeout_ms: z.number().int().nonnegative().default(10_000),
    client: heartbeatFlowSchema.optional(),
    server: heartbeatFlowSchema.optional(),
  })
  .strict()
  .superRefine((heartbeat, ctx) => {
    if (heartbeat.enabled && !heartbeat.client && !heartbeat.server) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'An enabled heartbeat requires a client or server flow',
      });
    }
    if (heartbeat.server && heartbeat.server.response === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['server', 'response'],
        message: 'A server heartbeat requires the client response',
      });
    }
    if (heartbeat.format === 'text') {
      for (const [flowName, flow] of [
        ['client', heartbeat.client],
        ['server', heartbeat.server],
      ] as const) {
        if (flow && (typeof flow.message !== 'string' || flow.message.length === 0)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [flowName, 'message'],
            message: 'Text heartbeat messages must be non-empty strings',
          });
        }
        if (
          flow?.response !== undefined &&
          (typeof flow.response !== 'string' || flow.response.length === 0)
        ) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [flowName, 'response'],
            message: 'Text heartbeat responses must be non-empty strings',
          });
        }
      }
    }
  });

const websocketSourceConfigSchema = z
  .object({
    heartbeat: websocketHeartbeatSchema.optional(),
  })
  .strict();

const sourceConfigSchema = z
  .object({
    title: z.string().min(1),
    type: z.enum(sourceTypes),
    spec: z.string().min(1),
    endpoint: z.string().url().optional(),
    try_now_url: z.string().url().optional(),
    intro: z.string().min(1).optional(),
    languages: z.array(sourceLanguageConfigSchema).min(1),
    websocket: websocketSourceConfigSchema.optional(),
  })
  .strict()
  .superRefine((source, ctx) => {
    if (source.websocket && source.type !== 'asyncapi-spec') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['websocket'],
        message: 'WebSocket options are only valid for asyncapi-spec sources',
      });
    }
    if (source.endpoint && source.type !== 'graphql-spec') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endpoint'],
        message: 'An endpoint is only valid for a graphql-spec source',
      });
    }
    if (source.try_now_url && source.type !== 'grpc-spec' && source.type !== 'openrpc-spec') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['try_now_url'],
        message: 'A Try now URL is only valid for a grpc-spec or openrpc-spec source',
      });
    }
  });

const outputConfigSchema = z
  .object({
    base_dir: z.string().min(1).default('./generated'),
  })
  .strict();

const generatorConfigSchema = z
  .object({
    templates: z.string().min(1),
  })
  .strict();

const docsDocumentSchema = z
  .object({
    title: z.string().min(1),
    document: z.string().min(1),
  })
  .strict();

const docsSectionSchema = z
  .object({
    section: z.string().min(1),
    sources: z.array(docsDocumentSchema).min(1),
  })
  .strict();

const homeCallToActionSchema = z
  .object({
    label: z.string().min(1),
    href: z.string().min(1),
  })
  .strict();

const homeSectionSchema = z
  .object({
    title: z.string().min(1),
    description: z.string().min(1),
    badge: z.string().min(1),
    href: z.string().min(1),
    icon: z.string().min(1).optional(),
    background: z.string().min(1).optional(),
  })
  .strict();

const homeConfigSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    cta: homeCallToActionSchema.optional(),
    sections: z.array(homeSectionSchema).min(1).optional(),
  })
  .strict();

const mcpConfigSchema = z
  .object({
    package_name: z.string().optional(),
    github_repository: z.string().optional(),
  })
  .strict()
  .optional();

const analyticsConfigSchema = z
  .object({
    google_analytics_id: z.string().regex(/^G-[A-Z0-9]+$/),
    enabled_hosts: z.array(z.string().min(1)).optional(),
    privacy_url: z.string().url().optional(),
  })
  .strict()
  .optional();

const publishConfigSchema = z
  .object({
    registries: z
      .object(
        Object.fromEntries(
          supportedLanguages.map((language) => [language, publishRegistryConfigSchema.optional()]),
        ),
      )
      .strict()
      .optional(),
    mcp: publishRegistryConfigSchema.optional(),
  })
  .strict()
  .optional();

export const cortexConfigSchema = z
  .object({
    project: z.string().min(1),
    title: z.string().optional(),
    logo: z.string().optional(),
    logo_dark: z.string().optional(),
    logo_light: z.string().optional(),
    logoHeight: z.number().positive().optional(),
    showLogoDocsLabel: z.boolean().optional(),
    favicon: z.string().optional(),
    custom_head_html: z.string().optional(),
    theme: z.enum(['light', 'dark', 'system']).default('system'),
    primaryColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .optional(),
    home: homeConfigSchema.optional(),
    sources: z.array(sourceConfigSchema).default([]),
    output: outputConfigSchema.default({ base_dir: './generated' }),
    generators: generatorConfigSchema.optional(),
    docs: z.array(docsSectionSchema).optional(),
    mcp: mcpConfigSchema,
    deploy: z
      .object({ domain: z.string().min(1).optional() })
      .strict()
      .optional(),
    analytics: analyticsConfigSchema,
    publish: publishConfigSchema,
  })
  .strict();

export type CortexConfigInput = z.input<typeof cortexConfigSchema>;

```

### Core Architecture Module: `packages/core/src/config/types.ts`
```
export type SupportedLanguage =
  | 'typescript'
  | 'python'
  | 'go'
  | 'java'
  | 'kotlin'
  | 'ruby'
  | 'php'
  | 'csharp'
  | 'rust'
  | 'cpp'
  | 'c';

export type SourceType =
  'openapi-spec' | 'asyncapi-spec' | 'graphql-spec' | 'grpc-spec' | 'openrpc-spec';

export interface PublishGitHubConfig {
  /** Set to false to disable this GitHub destination. */
  enabled?: boolean;
  /** Environment variable containing a GitHub token. */
  token_env?: string;
  /** Environment variable containing the GitHub username. */
  username_env?: string;
  /** Set to false for a local Git repository used without authentication. */
  auth?: boolean;
  /** Branch that receives the generated package source. */
  branch?: string;
}

export interface PublishRegistryConfig {
  /** Set to false to publish only to the configured GitHub repository. */
  enabled?: boolean;
  /** Registry endpoint, package index, or VCS repository URL. */
  url?: string;
  /** Name used for registries that require a local alias (Cargo and Conan). */
  name?: string;
  /** Environment variable containing the registry token, password, or API key. */
  token_env?: string;
  /** Environment variable containing the registry username. */
  username_env?: string;
  /** Set to false for an anonymous local or internal registry. */
  auth?: boolean;
  /** npm package visibility. */
  access?: 'public' | 'restricted';
  /** Publish the generated package source to github_repository. */
  github?: boolean | PublishGitHubConfig;
}

export interface PublishConfig {
  registries?: Partial<Record<SupportedLanguage, PublishRegistryConfig>>;
  /** npm-compatible registry configuration for the generated MCP server. */
  mcp?: PublishRegistryConfig;
}

export interface SourceLanguageConfig {
  language: SupportedLanguage;
  package_name: string;
  /** Directory with sparse Eta overrides for this source and language. */
  template?: string;
  github_repository?: string;
  publish?: PublishRegistryConfig;
}

export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export interface WebSocketHeartbeatFlowConfig {
  /** Message sent by this side of the connection. */
  message: JsonValue;
  /** Response sent by the other side. */
  response?: JsonValue;
}

export interface WebSocketHeartbeatConfig {
  /** Set to false to disable both heartbeat directions. */
  enabled?: boolean;
  /** Encoding used for all configured heartbeat messages. */
  format?: 'json' | 'text';
  /** Interval for client-initiated heartbeat messages. */
  interval_ms?: number;
  /** Maximum wait after a client heartbeat before the connection closes. */
  timeout_ms?: number;
  /** Client-initiated heartbeat and the optional server response. */
  client?: WebSocketHeartbeatFlowConfig;
  /** Server-initiated heartbeat and the required client response. */
  server?: WebSocketHeartbeatFlowConfig;
}

export interface WebSocketSourceConfig {
  heartbeat?: WebSocketHeartbeatConfig;
}

export interface SourceConfig {
  title: string;
  type: SourceType;
  spec: string;
  /** Runtime URL for a GraphQL schema source. */
  endpoint?: string;
  /** Browser-compatible HTTP bridge used by gRPC and OpenRPC Try now requests. */
  try_now_url?: string;
  intro?: string;
  languages: SourceLanguageConfig[];
  /** AsyncAPI-specific generated client behavior. */
  websocket?: WebSocketSourceConfig;
}

export interface LanguageConfig {
  language: SupportedLanguage;
  package_name: string;
  output_dir: string;
  template?: string;
  github_repository?: string;
  publish?: PublishRegistryConfig;
  options?: Record<string, unknown>;
}

export interface OutputConfig {
  base_dir: string;
}

export interface GeneratorConfig {
  /** Root directory for sparse Eta template overrides. */
  templates: string;
}

export interface DocsDocument {
  title: string;
  document: string;
}

export interface DocsSection {
  section: string;
  sources: DocsDocument[];
}

export interface HomeCallToAction {
  label: string;
  href: string;
}

export interface HomeSection {
  title: string;
  description: string;
  badge: string;
  href: string;
  /** Path to an SVG or image used by the section card. */
  icon?: string;
  /** Deprecated alias for icon. */
  background?: string;
}

export interface HomeConfig {
  title?: string;
  description?: string;
  cta?: HomeCallToAction;
  sections?: HomeSection[];
}

export interface McpConfig {
  package_name?: string;
  github_repository?: string;
}

export interface AnalyticsConfig {
  google_analytics_id: string;
  enabled_hosts?: string[];
  privacy_url?: string;
}

export interface CortexConfig {
  project: string;
  title?: string;
  logo?: string;
  logo_dark?: string;
  logo_light?: string;
  logoHeight?: number;
  showLogoDocsLabel?: boolean;
  favicon?: string;
  custom_head_html?: string;
  theme?: 'light' | 'dark' | 'system';
  primaryColor?: string;
  home?: HomeConfig;
  sources: SourceConfig[];
  output: OutputConfig;
  generators?: GeneratorConfig;
  languages: LanguageConfig[];
  docs?: DocsSection[];
  mcp?: McpConfig;
  deploy?: { domain?: string };
  analytics?: AnalyticsConfig;
  publish?: PublishConfig;
}

```

### Core Architecture Module: `packages/core/src/config/utils.ts`
```
import * as path from 'node:path';
import type {
  CortexConfig,
  SourceConfig,
  SourceLanguageConfig,
  SourceType,
  LanguageConfig,
} from './types';

export function getSourcesByType(config: CortexConfig, type: SourceType): SourceConfig[] {
  return config.sources.filter((s) => s.type === type);
}

export function getFirstSourceByType(
  config: CortexConfig,
  type: SourceType,
): SourceConfig | undefined {
  return config.sources.find((s) => s.type === type);
}

export function getFirstSpecPath(config: CortexConfig, type: SourceType): string | undefined {
  return config.sources.find((s) => s.type === type)?.spec;
}

export function isRemoteLocation(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function resolveConfigPath(value: string, configPath: string): string {
  if (isRemoteLocation(value) || path.isAbsolute(value)) return value;
  return path.resolve(path.dirname(path.resolve(configPath)), value);
}

export function hasSourceType(config: CortexConfig, type: SourceType): boolean {
  return config.sources.some((s) => s.type === type);
}

export function sanitizePackageName(name: string): string {
  return name.replace(/^@/, '').replace(/\//g, '-');
}

export function resolveGeneratorTemplateRoot(
  config: CortexConfig,
  configPath?: string,
): string | undefined {
  const configuredRoot = config.generators?.templates;
  if (!configuredRoot) return undefined;
  if (path.isAbsolute(configuredRoot)) return path.normalize(configuredRoot);

  const configDir = configPath ? path.dirname(path.resolve(configPath)) : process.cwd();
  return path.resolve(configDir, configuredRoot);
}

export function resolveLanguageTemplateDir(
  languageConfig: Pick<SourceLanguageConfig, 'template'>,
  configPath?: string,
): string | undefined {
  const configuredDir = languageConfig.template;
  if (!configuredDir) return undefined;
  if (path.isAbsolute(configuredDir)) return path.normalize(configuredDir);

  const configDir = configPath ? path.dirname(path.resolve(configPath)) : process.cwd();
  return path.resolve(configDir, configuredDir);
}

export function getSourceLanguageTemplateDir(
  config: CortexConfig,
  sourceType: SourceType,
  language: string,
  packageName: string,
  configPath?: string,
): string | undefined {
  const source = getFirstSourceByType(config, sourceType);
  const languageConfig = source?.languages.find(
    (candidate) => candidate.language === language && candidate.package_name === packageName,
  );
  return languageConfig ? resolveLanguageTemplateDir(languageConfig, configPath) : undefined;
}

export function getAllLanguageTemplateDirs(config: CortexConfig, configPath?: string): string[] {
  const directories = new Set<string>();
  for (const source of config.sources) {
    for (const languageConfig of source.languages) {
      const directory = resolveLanguageTemplateDir(languageConfig, configPath);
      if (directory) directories.add(directory);
    }
  }
  return Array.from(directories);
}

export function normalizeRepositoryUrl(repository: string): string {
  const value = repository.trim();
  const sshMatch = value.match(/^git@github\.com:([^/]+\/.+?)(?:\.git)?$/i);
  if (sshMatch) return `https://github.com/${sshMatch[1].replace(/\.git$/i, '')}`;
  if (/^github\.com\//i.test(value)) return `https://${value.replace(/\.git$/i, '')}`;
  if (/^https?:\/\/github\.com\//i.test(value)) return value.replace(/\.git$/i, '');
  return value;
}

export function gitRepositoryUrl(repository: string): string {
  const normalized = normalizeRepositoryUrl(repository);
  return /^https?:\/\/github\.com\//i.test(normalized) && !normalized.endsWith('.git')
    ? `${normalized}.git`
    : normalized;
}

export function computeEffectiveLanguages(config: CortexConfig): LanguageConfig[] {
  const seen = new Map<string, LanguageConfig>();
  for (const source of config.sources) {
    for (const lang of source.languages) {
      const key = `${lang.language}:${lang.package_name}`;
      if (!seen.has(key)) {
        seen.set(key, {
          language: lang.language,
          package_name: lang.package_name,
          output_dir: `${config.output.base_dir}/${lang.language}/${sanitizePackageName(lang.package_name)}`,
          template: lang.template,
          github_repository: lang.github_repository,
          publish: lang.publish ?? config.publish?.registries?.[lang.language],
        });
      }
    }
  }
  return Array.from(seen.values());
}

export function sourceHasLanguage(
  source: SourceConfig,
  language: string,
  packageName: string,
): boolean {
  return source.languages.some((l) => l.language === language && l.package_name === packageName);
}

```

### Core Architecture Module: `packages/core/src/graphql/parser.ts`
```
import * as fs from 'node:fs';
import {
  buildSchema,
  getNamedType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isSpecifiedScalarType,
  isUnionType,
  type GraphQLArgument,
  type GraphQLField as NativeGraphQLField,
  type GraphQLInputField,
  type GraphQLType as NativeGraphQLType,
} from 'graphql';
import type {
  GraphQLSpec,
  GraphQLOperation,
  GraphQLType,
  GraphQLField,
  GraphQLEnum,
  GraphQLInput,
} from './types';

export class GraphQLParser {
  async parse(specPath: string, endpoint?: string): Promise<GraphQLSpec> {
    const content = await this.loadContent(specPath);
    return this.parseSchema(content, endpoint ?? 'http://localhost:4000/graphql');
  }

  private async loadContent(specPath: string): Promise<string> {
    if (specPath.startsWith('http://') || specPath.startsWith('https://')) {
      const res = await fetch(specPath, { signal: AbortSignal.timeout(30_000) });
      if (!res.ok) throw new Error(`Failed to fetch ${specPath}: ${res.status}`);
      return res.text();
    }
    return fs.readFileSync(specPath, 'utf-8');
  }

  private parseSchema(sdl: string, endpoint: string): GraphQLSpec {
    // Use GraphQL's reference SDL parser so directives, descriptions, custom root
    // type names, multiline arguments, extensions, and schema definitions follow
    // the GraphQL specification instead of a source-format-specific regex.
    const schema = buildSchema(sdl);
    const queryType = schema.getQueryType();
    const mutationType = schema.getMutationType();
    const subscriptionType = schema.getSubscriptionType();
    const rootTypeNames = new Set(
      [queryType?.name, mutationType?.name, subscriptionType?.name].filter((name): name is string =>
        Boolean(name),
      ),
    );

    const types: GraphQLType[] = [];
    const enums: GraphQLEnum[] = [];
    const inputs: GraphQLInput[] = [];
    const scalars: string[] = [];

    for (const namedType of Object.values(schema.getTypeMap())) {
      if (namedType.name.startsWith('__')) continue;

      if (isObjectType(namedType) && !rootTypeNames.has(namedType.name)) {
        types.push({
          name: namedType.name,
          description: namedType.description ?? undefined,
          fields: Object.values(namedType.getFields()).map((field) => this.convertField(field)),
        });
      } else if (isInterfaceType(namedType)) {
        types.push({
          name: namedType.name,
          description: namedType.description ?? undefined,
          fields: Object.values(namedType.getFields()).map((field) => this.convertField(field)),
        });
      } else if (isUnionType(namedType)) {
        types.push({
          name: namedType.name,
          description: namedType.description ?? undefined,
          fields: [
            {
              name: '__typename',
              type: 'String',
              typeRaw: 'String!',
              required: true,
              isList: false,
            },
          ],
        });
      } else if (isEnumType(namedType)) {
        enums.push({
          name: namedType.name,
          description: namedType.description ?? undefined,
          values: namedType.getValues().map((value) => value.name),
        });
      } else if (isInputObjectType(namedType)) {
        inputs.push({
          name: namedType.name,
          description: namedType.description ?? undefined,
          fields: Object.values(namedType.getFields()).map((field) => this.convertField(field)),
        });
      } else if (isScalarType(namedType) && !isSpecifiedScalarType(namedType)) {
        scalars.push(namedType.name);
      }
    }

    const schemaDirective = sdl.match(/@title\("([^"]+)"\)/);

    return {
      title: schemaDirective?.[1] ?? 'GraphQL API',
      version: '1.0.0',
      description: schema.astNode?.description?.value,
      endpoint,
      queries: this.convertOperations(queryType),
      mutations: this.convertOperations(mutationType),
      subscriptions: this.convertOperations(subscriptionType),
      types,
      enums,
      inputs,
      scalars,
    };
  }

  private convertOperations(
    rootType: ReturnType<ReturnType<typeof buildSchema>['getQueryType']>,
  ): GraphQLOperation[] {
    if (!rootType) return [];

    return Object.values(rootType.getFields()).map((field) => ({
      name: field.name,
      description: field.description ?? undefined,
      args: field.args.map((arg) => this.convertArgument(arg)),
      returnType: getNamedType(field.type).name,
      returnTypeRaw: String(field.type),
    }));
  }

  private convertArgument(arg: GraphQLArgument): GraphQLField {
    return this.convertTypedValue(arg.name, arg.type, arg.description);
  }

  private convertField(
    field: NativeGraphQLField<unknown, unknown> | GraphQLInputField,
  ): GraphQLField {
    return this.convertTypedValue(field.name, field.type, field.description);
  }

  private convertTypedValue(
    name: string,
    type: NativeGraphQLType,
    description?: string | null,
  ): GraphQLField {
    const required = isNonNullType(type);
    const nullableType = required ? type.ofType : type;

    return {
      name,
      type: getNamedType(type).name,
      typeRaw: String(type),
      required,
      description: description ?? undefined,
      isList: isListType(nullableType),
    };
  }
}

```

### Core Architecture Module: `packages/core/src/graphql/types.ts`
```
export interface GraphQLSpec {
  title: string;
  version: string;
  description?: string;
  endpoint: string;
  queries: GraphQLOperation[];
  mutations: GraphQLOperation[];
  subscriptions: GraphQLOperation[];
  types: GraphQLType[];
  enums: GraphQLEnum[];
  inputs: GraphQLInput[];
  /** Custom scalar names declared by the schema. */
  scalars?: string[];
}

export interface GraphQLOperation {
  name: string;
  description?: string;
  args: GraphQLField[];
  returnType: string;
  returnTypeRaw: string;
}

export interface GraphQLType {
  name: string;
  description?: string;
  fields: GraphQLField[];
}

export interface GraphQLField {
  name: string;
  type: string;
  typeRaw: string;
  required: boolean;
  description?: string;
  isList: boolean;
}

export interface GraphQLEnum {
  name: string;
  description?: string;
  values: string[];
}

export interface GraphQLInput {
  name: string;
  description?: string;
  fields: GraphQLField[];
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #111** (2026-10-01): **fix: adapt primary button text to configured colors **
  *Symptoms*: 

- **Issue #110** (2026-10-01): **fix: improve documentation contrast and site titles**
  *Symptoms*: ## Changes  - Calculate primary button text contrast from sRGB luminance of the configured fill. - Keep the button fill consistent in light and dark themes; adjust standalone accents separately. - Share the CSS generator between server rendering and live homepage configuration updates. - Add regression coverage for dark and light fills, including the three hosted documentation demo colors.  ## Verification  - Docs UI unit tests: 30 passed. - Repository lint: passed. - Static browser regression cases cover orange, blue, purple, and white fills in both appearances. - Redeploying the three documentation examples and checking computed button colors through Playwright MCP.  ## Site titles  The documentation header now uses the configured display title before the hosting project slug, so sites can use a readable name while keeping their reserved subdomains. 

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

### Incident Patch 1: `1204eea4` (2026-10-01)
**Commit Message**: Merge pull request #110 from cortex-docs/fix/primary-button-contrast

fix: improve documentation contrast and site titles

**File**: `CHANGELOG.md` (modified, +17/-0)
```diff
@@ -18,6 +18,23 @@ The project uses Semantic Versioning. Each release contains the same three chang
 
 - None.
 
+## [0.1.36] - 2026-09-28
+
+### New Features
+
+- Deploy free documentation hosting for public GitHub repositories with `cortex deploy`, publishing your existing Markdown to a `*.cortexdocs.dev` subdomain.
+- Serve a live MCP server directly from a public repository with `cortex mcp-serve https://github.com/OWNER/REPO`, without a local checkout.
+- Documentation sites are now published through Cloudflare Static Assets for direct, low-latency delivery of hosted docs.
+
+### Bug Fixes
+
+- Fixed in-page links to Markdown headings so they scroll to the correct section in the hosted documentation site, even before content has fully loaded.
+- Removed a conflicting cache-control header on static hosted assets that could cause stale or inconsistent caching behavior.
+
+### Improvements
+
+- None.
+
 ## [0.1.35] - 2026-09-22
 
 ### New Features
```

**File**: `e2e/docs-ui-static.spec.ts` (modified, +23/-0)
```diff
@@ -30,6 +30,29 @@ test.describe('Cloudflare Static Assets export', () => {
     await expect(page.locator('.cortex-cookie-settings-button')).toHaveCount(0);
   });
 
+  for (const appearance of ['light', 'dark']) {
+    for (const [color, background, foreground] of [
+      ['#c2410c', 'rgb(194, 65, 12)', 'rgb(255, 255, 255)'],
+      ['#2563eb', 'rgb(37, 99, 235)', 'rgb(255, 255, 255)'],
+      ['#7c3aed', 'rgb(124, 58, 237)', 'rgb(255, 255, 255)'],
+      ['#ffffff', 'rgb(255, 255, 255)', 'rgb(10, 10, 10)'],
+    ]) {
+      test(`adapts the homepage button text to ${color} in ${appearance} mode`, async ({
+        page,
+      }) => {
+        await page.route('**/api/config*', async (route) => {
+          const response = await route.fetch();
+          const config = await response.json();
+          await route.fulfill({ json: { ...config, primaryColor: color } });
+        });
+        await page.goto(`/?appearance=${appearance}`);
+        const button = page.getByRole('link', { name: 'Getting Started', exact: true });
+        await expect(button).toHaveCSS('background-color', background);
+        await expect(button).toHaveCSS('color', foreground);
+      });
+    }
+  }
+
   test('supports client navigation between generated documentation pages', async ({ page }) => {
     await page.goto('/docs/quickstart');
     await expect(page).toHaveTitle('Petstore Docs');
```

**File**: `package-lock.json` (modified, +3/-3)
```diff
@@ -18436,7 +18436,7 @@
     },
     "packages/cli": {
       "name": "@cortex-docs/cli",
-      "version": "0.1.35",
+      "version": "0.1.36",
       "bundleDependencies": [
         "@cortex-docs/core",
         "@cortex-docs/codegen",
@@ -18631,9 +18631,9 @@
     },
     "packages/docs-site": {
       "name": "@cortex-docs/docs-site",
-      "version": "0.1.35",
+      "version": "0.1.36",
       "dependencies": {
-        "@cortex-docs/cli": "0.1.35"
+        "@cortex-docs/cli": "0.1.36"
       }
     },
     "packages/docs-ui": {
```

**File**: `packages/cli/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@cortex-docs/cli",
-  "version": "0.1.35",
+  "version": "0.1.36",
   "description": "Cortex Docs CLI for SDKs, API documentation, and MCP servers",
   "license": "MIT",
   "repository": {
```

**File**: `packages/docs-site/package.json` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@cortex-docs/docs-site",
-  "version": "0.1.35",
+  "version": "0.1.36",
   "private": true,
   "description": "Product documentation for Cortex Docs",
   "scripts": {
@@ -9,6 +9,6 @@
     "clean": "rm -rf .cortex"
   },
   "dependencies": {
-    "@cortex-docs/cli": "0.1.35"
+    "@cortex-docs/cli": "0.1.36"
   }
 }
```

**File**: `packages/docs-ui/__tests__/primary-theme.test.ts` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+import { describe, expect, it } from 'vitest';
+import { primaryPalette, primaryThemeCss } from '../lib/primary-theme';
+
+describe('primary button contrast', () => {
+  it.each(['#c2410c', '#2563eb', '#7c3aed', '#000000', '#0000ff'])(
+    'uses white text on %s',
+    (color) => {
+      expect(primaryPalette(color).foreground).toBe('#ffffff');
+    },
+  );
+
+  it.each(['#ffffff', '#ffff00', '#00ff00', '#f97316', '#ff0000'])(
+    'uses dark text on a light fill (%s)',
+    (color) => {
+      expect(primaryPalette(color).foreground).toBe('#0a0a0a');
+    },
+  );
+
+  it('keeps the chosen button fill instead of brightening it in dark mode', () => {
+    expect(primaryPalette('#2563eb').background).toBe('rgb(37,99,235)');
+    expect(primaryThemeCss('#2563eb').match(/--color-primary:rgb\(37,99,235\)/g)).toHaveLength(3);
+  });
+
+  it('ignores invalid colors before producing CSS', () => {
+    expect(primaryThemeCss('red')).toBe('');
+    expect(primaryThemeCss('#fff; color:red')).toBe('');
+  });
+});
```

**File**: `packages/docs-ui/app/layout.tsx` (modified, +2/-34)
```diff
@@ -13,6 +13,7 @@ import {
 import { SearchProvider } from '@/components/docs/search-provider';
 import { GoogleAnalytics } from '@/components/docs/google-analytics';
 import { sanitizeSvg } from '@/lib/sanitize-svg';
+import { primaryThemeCss } from '@/lib/primary-theme';
 
 interface LoadedSiteConfig extends SiteConfig {
   customHeadHtml?: string;
@@ -27,33 +28,6 @@ function emptySiteConfig(): LoadedSiteConfig {
   };
 }
 
-function adj(r: number, g: number, b: number, mul: number) {
-  return `rgb(${Math.min(255, Math.round(r * mul))},${Math.min(255, Math.round(g * mul))},${Math.min(255, Math.round(b * mul))})`;
-}
-
-function parsePrimary(hex: string) {
-  const r = parseInt(hex.slice(1, 3), 16);
-  const g = parseInt(hex.slice(3, 5), 16);
-  const b = parseInt(hex.slice(5, 7), 16);
-  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
-  const lightBgMul = lum < 0.15 ? 1.8 : lum < 0.3 ? 1.3 : 1;
-  const darkBgMul = lum < 0.15 ? 4 : lum < 0.3 ? 2.2 : lum < 0.4 ? 1.4 : 1;
-  const textMul =
-    lum > 0.9 ? 0.45 : lum > 0.7 ? 0.88 : lum > 0.5 ? 0.92 : lum < 0.15 ? 3.5 : lum < 0.3 ? 2 : 1;
-  const lightColor = adj(r, g, b, lightBgMul);
-  const darkColor = adj(r, g, b, darkBgMul);
-  const lightText = adj(r, g, b, textMul);
-  const darkText = adj(r, g, b, darkBgMul);
-  const lightLum = lum * lightBgMul;
-  const darkLum = Math.min(1, lum * darkBgMul);
-  const lightFg = lightLum > 0.5 ? '#0a0a0a' : '#fafafa';
-  const darkFg = darkLum > 0.5 ? '#0a0a0a' : '#fafafa';
-  const targetTintLum = 0.45;
-  const tintMul = lum > 0 ? Math.max(1, targetTintLum / lum) : 6;
-  const cardTint = adj(r, g, b, Math.min(tintMul, 10));
-  return { lightColor, darkColor, lightFg, darkFg, lightText, darkText, cardTint };
-}
-
 function createThemeInitializationScript(defaultTheme: 'light' | 'dark' | 'system'): string {
   return `(()=>{try{const e=document.documentElement,p=new URLSearchParams(location.search).get("appearance");let t=p==="light"||p==="dark"?p:"";if(!t){try{const s=localStorage.getItem("theme");if(s==="light"||s==="dark"||s==="system")t=s}catch{}}if(!t)t="${defaultTheme}";const r=t==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;e.classList.remove("light","dark");e.classList.add(r);e.style.colorScheme=r}catch{}})();`;
 }
@@ -196,13 +170,7 @@ export default function RootLayout({ children }: { children: React.ReactNode })
   const { customHeadHtml, ...siteConfig } = readSiteConfig();
   const defaultTheme = siteConfig.theme ?? 'system';
 
-  const pc = siteConfig.primaryColor;
-  const primaryCss = pc
-    ? (() => {
-        const p = parsePrimary(pc);
-        return `html{--color-primary:${p.lightColor}!important;--color-primary-foreground:${p.lightFg}!important;--primary-text:${p.lightText};--primary-card-tint:${p.cardTint}}html.dark{--color-primary:${p.darkColor}!important;--color-primary-foreground:${p.darkFg}!important;--primary-text:${p.darkText};--primary-card-tint:${p.cardTint}}@media(prefers-color-scheme:dark){html:not(.light){--color-primary:${p.darkColor}!important;--color-primary-foreground:${p.darkFg}!important;--primary-text:${p.darkText};--primary-card-tint:${p.cardTint}}}`;
-      })()
-    : '';
+  const primaryCss = primaryThemeCss(siteConfig.primaryColor ?? '');
 
   return (
     <html
```

**File**: `packages/docs-ui/app/page.tsx` (modified, +2/-32)
```diff
@@ -9,6 +9,7 @@ import {
   type HomeConfig,
 } from '@/components/docs/site-config-provider';
 import { useProjectWatch } from '@/lib/use-project-watch';
+import { primaryThemeCss } from '@/lib/primary-theme';
 
 const COLS = 45;
 const ROWS = 16;
@@ -111,44 +112,13 @@ export default function Home() {
         if (!data) return;
         if (data.home) setHome(data.home);
         if (data.primaryColor && /^#[0-9a-fA-F]{6}$/.test(data.primaryColor)) {
-          const pc = data.primaryColor;
-          const r = parseInt(pc.slice(1, 3), 16);
-          const g = parseInt(pc.slice(3, 5), 16);
-          const b = parseInt(pc.slice(5, 7), 16);
-          const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
-          const a = (m: number) =>
-            `rgb(${Math.min(255, Math.round(r * m))},${Math.min(255, Math.round(g * m))},${Math.min(255, Math.round(b * m))})`;
-          const lbm = lum < 0.15 ? 1.8 : lum < 0.3 ? 1.3 : 1;
-          const dbm = lum < 0.15 ? 4 : lum < 0.3 ? 2.2 : lum < 0.4 ? 1.4 : 1;
-          const tm =
-            lum > 0.9
-              ? 0.45
-              : lum > 0.7
-                ? 0.88
-                : lum > 0.5
-                  ? 0.92
-                  : lum < 0.15
-                    ? 3.5
-                    : lum < 0.3
-                      ? 2
-                      : 1;
-          const tintMul = lum > 0 ? Math.max(1, 0.45 / lum) : 6;
-          const lightColor = a(lbm),
-            darkColor = a(dbm),
-            lightText = a(tm),
-            darkText = a(dbm),
-            cardTint = a(Math.min(tintMul, 10));
-          const lightLum = lum * lbm,
-            darkLum = Math.min(1, lum * dbm);
-          const lightFg = lightLum > 0.5 ? '#0a0a0a' : '#fafafa';
-          const darkFg = darkLum > 0.5 ? '#0a0a0a' : '#fafafa';
           let s = document.querySelector('style[data-primary]') as HTMLStyleElement;
           if (!s) {
             s = document.createElement('style');
             s.setAttribute('data-primary', '');
             document.body.prepend(s);
           }
-          s.textContent = `html{--color-primary:${lightColor}!important;--color-primary-foreground:${lightFg}!important;--primary-text:${lightText};--primary-card-tint:${cardTint}}html.dark{--color-primary:${darkColor}!important;--color-primary-foreground:${darkFg}!important;--primary-text:${darkText};--primary-card-tint:${cardTint}}@media(prefers-color-scheme:dark){html:not(.light){--color-primary:${darkColor}!important;--color-primary-foreground:${darkFg}!important;--primary-text:${darkText};--primary-card-tint:${cardTint}}}`;
+          s.textContent = primaryThemeCss(data.primaryColor);
         }
       })
       .catch(() => {});
```

---

### Incident Patch 2: `3f8b1931` (2026-09-28)
**Commit Message**: fix: show configured title in documentation header

**File**: `packages/docs-ui/components/docs/docs-header.tsx` (modified, +1/-1)
```diff
@@ -379,7 +379,7 @@ export function DocsHeader() {
               )}
               {!hasCustomLogo && (
                 <span className="truncate text-lg font-semibold tracking-tight">
-                  {project || siteTitle || 'Cortex'}
+                  {siteTitle || project || 'Cortex'}
                 </span>
               )}
             </Link>
```

---

### Incident Patch 3: `5741cee9` (2026-09-28)
**Commit Message**: fix: adapt primary button text to configured colors

**File**: `e2e/docs-ui-static.spec.ts` (modified, +23/-0)
```diff
@@ -30,6 +30,29 @@ test.describe('Cloudflare Static Assets export', () => {
     await expect(page.locator('.cortex-cookie-settings-button')).toHaveCount(0);
   });
 
+  for (const appearance of ['light', 'dark']) {
+    for (const [color, background, foreground] of [
+      ['#c2410c', 'rgb(194, 65, 12)', 'rgb(255, 255, 255)'],
+      ['#2563eb', 'rgb(37, 99, 235)', 'rgb(255, 255, 255)'],
+      ['#7c3aed', 'rgb(124, 58, 237)', 'rgb(255, 255, 255)'],
+      ['#ffffff', 'rgb(255, 255, 255)', 'rgb(10, 10, 10)'],
+    ]) {
+      test(`adapts the homepage button text to ${color} in ${appearance} mode`, async ({
+        page,
+      }) => {
+        await page.route('**/api/config*', async (route) => {
+          const response = await route.fetch();
+          const config = await response.json();
+          await route.fulfill({ json: { ...config, primaryColor: color } });
+        });
+        await page.goto(`/?appearance=${appearance}`);
+        const button = page.getByRole('link', { name: 'Getting Started', exact: true });
+        await expect(button).toHaveCSS('background-color', background);
+        await expect(button).toHaveCSS('color', foreground);
+      });
+    }
+  }
+
   test('supports client navigation between generated documentation pages', async ({ page }) => {
     await page.goto('/docs/quickstart');
     await expect(page).toHaveTitle('Petstore Docs');
```

**File**: `packages/docs-ui/__tests__/primary-theme.test.ts` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+import { describe, expect, it } from 'vitest';
+import { primaryPalette, primaryThemeCss } from '../lib/primary-theme';
+
+describe('primary button contrast', () => {
+  it.each(['#c2410c', '#2563eb', '#7c3aed', '#000000', '#0000ff'])(
+    'uses white text on %s',
+    (color) => {
+      expect(primaryPalette(color).foreground).toBe('#ffffff');
+    },
+  );
+
+  it.each(['#ffffff', '#ffff00', '#00ff00', '#f97316', '#ff0000'])(
+    'uses dark text on a light fill (%s)',
+    (color) => {
+      expect(primaryPalette(color).foreground).toBe('#0a0a0a');
+    },
+  );
+
+  it('keeps the chosen button fill instead of brightening it in dark mode', () => {
+    expect(primaryPalette('#2563eb').background).toBe('rgb(37,99,235)');
+    expect(primaryThemeCss('#2563eb').match(/--color-primary:rgb\(37,99,235\)/g)).toHaveLength(3);
+  });
+
+  it('ignores invalid colors before producing CSS', () => {
+    expect(primaryThemeCss('red')).toBe('');
+    expect(primaryThemeCss('#fff; color:red')).toBe('');
+  });
+});
```

**File**: `packages/docs-ui/app/layout.tsx` (modified, +2/-34)
```diff
@@ -13,6 +13,7 @@ import {
 import { SearchProvider } from '@/components/docs/search-provider';
 import { GoogleAnalytics } from '@/components/docs/google-analytics';
 import { sanitizeSvg } from '@/lib/sanitize-svg';
+import { primaryThemeCss } from '@/lib/primary-theme';
 
 interface LoadedSiteConfig extends SiteConfig {
   customHeadHtml?: string;
@@ -27,33 +28,6 @@ function emptySiteConfig(): LoadedSiteConfig {
   };
 }
 
-function adj(r: number, g: number, b: number, mul: number) {
-  return `rgb(${Math.min(255, Math.round(r * mul))},${Math.min(255, Math.round(g * mul))},${Math.min(255, Math.round(b * mul))})`;
-}
-
-function parsePrimary(hex: string) {
-  const r = parseInt(hex.slice(1, 3), 16);
-  const g = parseInt(hex.slice(3, 5), 16);
-  const b = parseInt(hex.slice(5, 7), 16);
-  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
-  const lightBgMul = lum < 0.15 ? 1.8 : lum < 0.3 ? 1.3 : 1;
-  const darkBgMul = lum < 0.15 ? 4 : lum < 0.3 ? 2.2 : lum < 0.4 ? 1.4 : 1;
-  const textMul =
-    lum > 0.9 ? 0.45 : lum > 0.7 ? 0.88 : lum > 0.5 ? 0.92 : lum < 0.15 ? 3.5 : lum < 0.3 ? 2 : 1;
-  const lightColor = adj(r, g, b, lightBgMul);
-  const darkColor = adj(r, g, b, darkBgMul);
-  const lightText = adj(r, g, b, textMul);
-  const darkText = adj(r, g, b, darkBgMul);
-  const lightLum = lum * lightBgMul;
-  const darkLum = Math.min(1, lum * darkBgMul);
-  const lightFg = lightLum > 0.5 ? '#0a0a0a' : '#fafafa';
-  const darkFg = darkLum > 0.5 ? '#0a0a0a' : '#fafafa';
-  const targetTintLum = 0.45;
-  const tintMul = lum > 0 ? Math.max(1, targetTintLum / lum) : 6;
-  const cardTint = adj(r, g, b, Math.min(tintMul, 10));
-  return { lightColor, darkColor, lightFg, darkFg, lightText, darkText, cardTint };
-}
-
 function createThemeInitializationScript(defaultTheme: 'light' | 'dark' | 'system'): string {
   return `(()=>{try{const e=document.documentElement,p=new URLSearchParams(location.search).get("appearance");let t=p==="light"||p==="dark"?p:"";if(!t){try{const s=localStorage.getItem("theme");if(s==="light"||s==="dark"||s==="system")t=s}catch{}}if(!t)t="${defaultTheme}";const r=t==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;e.classList.remove("light","dark");e.classList.add(r);e.style.colorScheme=r}catch{}})();`;
 }
@@ -196,13 +170,7 @@ export default function RootLayout({ children }: { children: React.ReactNode })
   const { customHeadHtml, ...siteConfig } = readSiteConfig();
   const defaultTheme = siteConfig.theme ?? 'system';
 
-  const pc = siteConfig.primaryColor;
-  const primaryCss = pc
-    ? (() => {
-        const p = parsePrimary(pc);
-        return `html{--color-primary:${p.lightColor}!important;--color-primary-foreground:${p.lightFg}!important;--primary-text:${p.lightText};--primary-card-tint:${p.cardTint}}html.dark{--color-primary:${p.darkColor}!important;--color-primary-foreground:${p.darkFg}!important;--primary-text:${p.darkText};--primary-card-tint:${p.cardTint}}@media(prefers-color-scheme:dark){html:not(.light){--color-primary:${p.darkColor}!important;--color-primary-foreground:${p.darkFg}!important;--primary-text:${p.darkText};--primary-card-tint:${p.cardTint}}}`;
-      })()
-    : '';
+  const primaryCss = primaryThemeCss(siteConfig.primaryColor ?? '');
 
   return (
     <html
```

**File**: `packages/docs-ui/app/page.tsx` (modified, +2/-32)
```diff
@@ -9,6 +9,7 @@ import {
   type HomeConfig,
 } from '@/components/docs/site-config-provider';
 import { useProjectWatch } from '@/lib/use-project-watch';
+import { primaryThemeCss } from '@/lib/primary-theme';
 
 const COLS = 45;
 const ROWS = 16;
@@ -111,44 +112,13 @@ export default function Home() {
         if (!data) return;
         if (data.home) setHome(data.home);
         if (data.primaryColor && /^#[0-9a-fA-F]{6}$/.test(data.primaryColor)) {
-          const pc = data.primaryColor;
-          const r = parseInt(pc.slice(1, 3), 16);
-          const g = parseInt(pc.slice(3, 5), 16);
-          const b = parseInt(pc.slice(5, 7), 16);
-          const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
-          const a = (m: number) =>
-            `rgb(${Math.min(255, Math.round(r * m))},${Math.min(255, Math.round(g * m))},${Math.min(255, Math.round(b * m))})`;
-          const lbm = lum < 0.15 ? 1.8 : lum < 0.3 ? 1.3 : 1;
-          const dbm = lum < 0.15 ? 4 : lum < 0.3 ? 2.2 : lum < 0.4 ? 1.4 : 1;
-          const tm =
-            lum > 0.9
-              ? 0.45
-              : lum > 0.7
-                ? 0.88
-                : lum > 0.5
-                  ? 0.92
-                  : lum < 0.15
-                    ? 3.5
-                    : lum < 0.3
-                      ? 2
-                      : 1;
-          const tintMul = lum > 0 ? Math.max(1, 0.45 / lum) : 6;
-          const lightColor = a(lbm),
-            darkColor = a(dbm),
-            lightText = a(tm),
-            darkText = a(dbm),
-            cardTint = a(Math.min(tintMul, 10));
-          const lightLum = lum * lbm,
-            darkLum = Math.min(1, lum * dbm);
-          const lightFg = lightLum > 0.5 ? '#0a0a0a' : '#fafafa';
-          const darkFg = darkLum > 0.5 ? '#0a0a0a' : '#fafafa';
           let s = document.querySelector('style[data-primary]') as HTMLStyleElement;
           if (!s) {
             s = document.createElement('style');
             s.setAttribute('data-primary', '');
             document.body.prepend(s);
           }
-          s.textContent = `html{--color-primary:${lightColor}!important;--color-primary-foreground:${lightFg}!important;--primary-text:${lightText};--primary-card-tint:${cardTint}}html.dark{--color-primary:${darkColor}!important;--color-primary-foreground:${darkFg}!important;--primary-text:${darkText};--primary-card-tint:${cardTint}}@media(prefers-color-scheme:dark){html:not(.light){--color-primary:${darkColor}!important;--color-primary-foreground:${darkFg}!important;--primary-text:${darkText};--primary-card-tint:${cardTint}}}`;
+          s.textContent = primaryThemeCss(data.primaryColor);
         }
       })
       .catch(() => {});
```

**File**: `packages/docs-ui/lib/primary-theme.ts` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+type Rgb = [number, number, number];
+
+function luminance(color: Rgb): number {
+  const linear = color.map((channel) => {
+    const value = channel / 255;
+    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
+  });
+  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
+}
+
+export function primaryPalette(hex: string) {
+  const color: Rgb = [
+    parseInt(hex.slice(1, 3), 16),
+    parseInt(hex.slice(3, 5), 16),
+    parseInt(hex.slice(5, 7), 16),
+  ];
+  const brightness = (0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2]) / 255;
+  const adjusted = (multiplier: number) =>
+    `rgb(${color.map((channel) => Math.min(255, Math.round(channel * multiplier))).join(',')})`;
+  const backgroundLuminance = luminance(color);
+  const whiteContrast = 1.05 / (backgroundLuminance + 0.05);
+  const darkContrast = (backgroundLuminance + 0.05) / (luminance([10, 10, 10]) + 0.05);
+  const foreground = whiteContrast >= darkContrast ? '#ffffff' : '#0a0a0a';
+  const textMultiplier =
+    brightness > 0.9
+      ? 0.45
+      : brightness > 0.7
+        ? 0.88
+        : brightness > 0.5
+          ? 0.92
+          : brightness < 0.15
+            ? 3.5
+            : brightness < 0.3
+              ? 2
+              : 1;
+  const darkTextMultiplier =
+    brightness < 0.15 ? 4 : brightness < 0.3 ? 2.2 : brightness < 0.4 ? 1.4 : 1;
+  const tintMultiplier = brightness > 0 ? Math.max(1, 0.45 / brightness) : 6;
+  return {
+    // Keep the configured fill in both themes. Brighten standalone accents separately.
+    background: adjusted(1),
+    foreground,
+    lightText: adjusted(textMultiplier),
+    darkText: adjusted(darkTextMultiplier),
+    cardTint: adjusted(Math.min(tintMultiplier, 10)),
+  };
+}
+
+export function primaryThemeCss(hex: string): string {
+  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return '';
+  const p = primaryPalette(hex);
+  const shared = `--color-primary:${p.background}!important;--color-primary-foreground:${p.foreground}!important;--primary-card-tint:${p.cardTint}`;
+  return `html{${shared};--primary-text:${p.lightText}}html.dark{${shared};--primary-text:${p.darkText}}@media(prefers-color-scheme:dark){html:not(.light){${shared};--primary-text:${p.darkText}}}`;
+}
```

---

### Incident Patch 4: `6dd49327` (2026-09-28)
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

### Incident Patch 5: `f4b5a8d7` (2026-09-26)
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

### Incident Patch 6: `9f60c756` (2026-09-22)
**Commit Message**: Enhance README and add overview rendering scripts

- Updated README.md to replace the SVG overview with a new GIF and PNG representation, providing a more interactive visual experience.
- Added capture.mjs script to automate the process of capturing screenshots of the Cortex demo using Playwright.
- Introduced render.py script to generate a GIF from the captured screenshots and terminal output, facilitating a visual overview of the Cortex documentation process.
- Removed the outdated SVG overview file to streamline asset management.

**File**: `README.md` (modified, +8/-1)
```diff
@@ -36,7 +36,14 @@
 
 </br>
 
-![Cortex turns API sources into interactive documentation, typed SDKs, and an MCP server for developers, applications, and AI agents.](assets/cortex-overview.svg)
+<p align="center">
+  <a href="https://demo.cortexdocs.dev">
+    <picture>
+      <source media="(prefers-reduced-motion: reduce)" srcset="assets/cortex-overview.png">
+      <img src="assets/cortex-overview.gif" width="1200" alt="Run cortex generate with a configured OpenAPI file, then explore Getting Started, API Reference, SDKs, and MCP in the live demo. Click to try it.">
+    </picture>
+  </a>
+</p>
 
 Cortex combines OpenAPI, AsyncAPI, GraphQL, Protocol Buffer, OpenRPC, and Markdown sources. Developers get interactive documentation, applications get typed SDKs, and AI agents get an MCP server with project context.
 
```

**File**: `assets/cortex-overview.svg` (removed, +0/-178)
```diff
@@ -1,178 +0,0 @@
-<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
-  <title id="title">Cortex Docs product overview</title>
-  <desc id="desc">API specifications and Markdown flow through one Cortex project configuration into interactive documentation, typed SDKs, and an MCP server for AI agents.</desc>
-  <defs>
-    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
-      <stop offset="0" stop-color="#0b0d12"/>
-      <stop offset="1" stop-color="#141925"/>
-    </linearGradient>
-    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
-      <stop offset="0" stop-color="#6ee7f2"/>
-      <stop offset="1" stop-color="#8b7cf6"/>
-    </linearGradient>
-    <linearGradient id="asyncapi-logo" x1="1" y1="0" x2="0" y2="1">
-      <stop offset="0" stop-color="#2dccfd"/>
-      <stop offset="1" stop-color="#ad20e2"/>
-    </linearGradient>
-    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
-      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.3"/>
-    </filter>
-    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
-      <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/>
-    </marker>
-  </defs>
-
-  <rect width="1200" height="630" rx="24" fill="url(#background)"/>
-  <circle cx="600" cy="315" r="250" fill="#7767f4" opacity="0.05"/>
-  <circle cx="600" cy="315" r="175" fill="#67e8f9" opacity="0.04"/>
-
-  <g transform="translate(62 34) scale(1.3)" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
-    <g stroke="#f8fafc" fill="none" stroke-linecap="round" stroke-linejoin="round">
-      <path d="M9 2.5 Q11 1 13 2.5 L18 5 Q20 6 18 7 L13 9.5 Q11 11 9 9.5 L4 7 Q2 6 4 5 Z" stroke-width="1.5" fill="#f8fafc" fill-opacity=".1"/>
-      <path d="M3 10 L9 13.5 Q11 14.8 13 13.5 L19 10" stroke-width="1.5"/>
-      <path d="M3 13.5 L9 17 Q11 18.3 13 17 L19 13.5" stroke-width="1.5" stroke-opacity=".5"/>
-    </g>
-    <text x="26" y="15" fill="#f8fafc" font-size="16" font-weight="600">Cortex</text>
-  </g>
-
-  <text x="600" y="58" text-anchor="middle" fill="#f8fafc" font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="28" font-weight="700">Unlimited specs. Multiple ways to use it.</text>
-  <text x="600" y="88" text-anchor="middle" fill="#94a3b8" font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="15">Generate interactive docs for exploration, typed SDKs for integration, and MCP servers for AI agents.</text>
-
-  <g font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">
-    <text x="78" y="145" fill="#64748b" font-size="12" font-weight="700" letter-spacing="1.4">SOURCES</text>
-
-    <g fill="#151a24" stroke="#2a3242">
-      <rect x="62" y="166" width="224" height="54" rx="12"/>
-      <rect x="62" y="232" width="224" height="54" rx="12"/>
-      <rect x="62" y="298" width="224" height="54" rx="12"/>
-      <rect x="62" y="364" width="224" height="54" rx="12"/>
-      <rect x="62" y="430" width="224" height="54" rx="12"/>
-      <rect x="62" y="496" width="224" height="54" rx="12"/>
-    </g>
-
-    <g font-size="16" font-weight="600" fill="#e2e8f0">
-      <text x="118" y="199">OpenAPI</text>
-      <text x="118" y="265">AsyncAPI</text>
-      <text x="118" y="331">GraphQL</text>
-      <text x="118" y="397">Protocol Buffer</text>
-      <text x="118" y="463">OpenRPC</text>
-      <text x="118" y="529">Markdown</text>
-    </g>
-
-    <!-- OpenAPI -->
-    <g transform="translate(80 181)" fill="#6ba43a">
-      <path d="M21.039 0a2.959 2.959 0 0 0-2.65 4.274l-6.447 6.447a2.96 2.96 0 1 0 1.335 1.336l6.447-6.447A2.959 2.959 0 1 0 21.04 0ZM10.628 2.745c-.072 0-.143.003-.214.004-.072.002-.143.002-.215.005-.447.018-.893.064-1.335.138l-.03.005-.185.033-.105.02a7.718 7.718 0 0 0-.289.062l-.032.008a10.69 10.69 0 0 0-2.55.95l-.155.089c-.063.034-.125.07-.187.105-.046.027-.093.051-.14.079H5.19l-.01.005-.036.02v.002l.111.184 3.15 5.23a4.168 4.168 0 0 1 .38-.202 4.294 4.294 0 0 1 1.628-.413c.071-.004.143-.008.214-.008Zm.428.01v6.333c.325.034.647.103.96.209l4.66-4.66c-.173-.12-.348-.237-.528-.347l-.026-.015c-.056-.035-.112-.067-.168-.1l-.098-.056-.099-.055a12.735 12.735 0 0 0-.171-.092l-.027-.014a10.628 10.628 0 0 0-1.425-.617c-.69-.241-1.403-.41-2.128-.505l-.089-.012-.09-.01a6.56 6.56 0 0 0-.17-.019l-.049-.004-.204-.017a6.44 6.44 0 0 0-.255-.015c-.031-.003-.062-.003-.093-.004ZM4.782 4.498a9.92 9.92 0 0 0-1.36 1.062l4.461 4.461.018.018c.049-.04.098-.078.149-.116l-.011-.018Zm-1.67 1.36c-.05.05-.098.103-.147.154l-.149.155c-.33.357-.63.73-.902 1.118l-.039.056a10.588 10.588 0 0 0-.216.326 10.6 10.6 0 0 0-1.65 5.276l-.006.215-.003.214h6.317c0-.072.007-.143.01-.214.005-.072.006-.144.013-.215.081-.822.399-1.625.952-2.3.045-.055.096-.106.144-.16.048-.052.093-.107.144-.158Zm16.255 1.464-4.66
```

**File**: `scripts/overview/capture.mjs` (added, +100/-0)
```diff
@@ -0,0 +1,100 @@
+// Pass this file's contents, with the `export` keyword removed, as the code
+// argument to mcp__playwright__browser_run_code_unsafe. Create outputDir first,
+// then save the returned scenes array there as scenes.json for render.py.
+// No browser is launched outside the Playwright MCP session.
+
+export async function captureOverview(
+  page,
+  { outputDir = '.playwright-mcp/overview', baseUrl = 'https://demo.cortexdocs.dev' } = {},
+) {
+  await page.setViewportSize({ width: 1200, height: 700 });
+  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
+  await page.goto(`${baseUrl}/?appearance=dark`);
+  await page.evaluate(() => {
+    localStorage.setItem('cortex.cookie-consent.v1', 'denied');
+    window.dispatchEvent(new CustomEvent('cortex:consent-changed', { detail: 'denied' }));
+  });
+  const scenes = [];
+  const nav = (name) => page.locator('header').getByRole('link', { name, exact: true });
+
+  async function capture(name, label, step, duration, next) {
+    await page.evaluate(async () => {
+      await document.fonts.ready;
+      await Promise.all([...document.images].map((image) => image.decode().catch(() => {})));
+    });
+    // Let navigation, syntax highlighting, and scroll positioning finish.
+    await page.waitForTimeout(1400);
+    if (name === 'endpoint') {
+      // Keep the endpoint method visible below the sticky breadcrumb.
+      await page.locator('main main').evaluate((element) => {
+        element.scrollBy({ top: -48, behavior: 'instant' });
+      });
+    }
+    await page.mouse.move(1190, 690);
+    const box = next ? await next.boundingBox() : null;
+    if (next && !box) throw new Error(`Missing navigation target for ${name}`);
+    await page.screenshot({
+      path: `${outputDir}/${name}.png`,
+      scale: 'css',
+      animations: 'disabled',
+    });
+    scenes.push({
+      name,
+      label,
+      step,
+      duration,
+      url: page.url(),
+      target: box ? [box.x + box.width / 2, box.y + box.height / 2] : null,
+    });
+    if (next) await next.click();
+  }
+
+  await page.getByRole('heading', { name: 'Petstore Docs', exact: true }).waitFor();
+  await capture(
+    'home',
+    'Explore the live demo',
+    1,
+    1500,
+    page.getByRole('link', { name: 'Getting Started', exact: true }),
+  );
+  await page.getByRole('heading', { name: 'Quickstart', exact: true }).waitFor();
+  await capture('quickstart', 'Help developers get started', 1, 2400, nav('API Reference'));
+
+  await page.getByRole('heading', { name: 'REST API V1', exact: true }).waitFor();
+  await capture(
+    'reference',
+    'Browse your API reference',
+    2,
+    1200,
+    page.getByRole('button', { name: 'GET List all pets', exact: true }),
+  );
+  await page.waitForURL('**/api-reference/rest-api-v1/listPets');
+  await page.getByRole('button', { name: 'Try now', exact: true }).waitFor();
+  await capture('endpoint', 'Inspect schemas and typed code samples', 2, 2800, nav('SDKs'));
+
+  await page.getByRole('heading', { name: 'TypeScript SDKs', exact: true }).waitFor();
+  await capture(
+    'sdks',
+    'Choose from 11 SDK languages',
+    3,
+    1700,
+    page.getByText('@petstore/typescript-client-sdk', { exact: true }),
+  );
+  await page.getByRole('heading', { name: 'Installation', exact: true }).waitFor();
+  await capture('sdk-guide', 'Install a typed SDK and start building', 3, 2600, nav('MCP'));
+
+  await page.getByRole('heading', { name: 'Client Setup Guide', exact: true }).waitFor();
+  await capture(
+    'mcp',
+    'Connect your AI coding tools',
+    4,
+    2400,
+    page.getByRole('button', { name: 'Tools', exact: true }),
+  );
+  await page.waitForURL('**/mcp/docs_quickstart');
+  await capture('mcp-tools', 'Give agents API tools, SDK guides, and docs', 4, 2800, nav('Home'));
+  await page.getByRole('heading', { name: 'Petstore Docs', exact: true }).waitFor();
+  await capture('end', 'Try it yourself at demo.cortexdocs.dev', 4, 2000);
+
+  return { outputDir, scenes };
+}
```

**File**: `scripts/overview/render.py` (added, +207/-0)
```diff
@@ -0,0 +1,207 @@
+#!/usr/bin/env python3
+"""Render the README GIF from Playwright MCP screenshots and real CLI output.
+
+Requires Pillow. Run from any directory:
+  python3 scripts/overview/render.py
+
+Inputs in .playwright-mcp/overview: scenes.json, scene PNGs, and generate.log.
+Capture scenes with capture.mjs through the Playwright MCP tool. generate.log
+must be stdout from `cortex generate` in a Petstore project configured with the
+OpenAPI fixture and all 11 SDK languages. Absolute project paths are shortened.
+The terminal is replayed with edited timing; the UI tour uses the live demo.
+"""
+
+import argparse
+import json
+import os
+import re
+from pathlib import Path
+
+from PIL import Image, ImageColor, ImageDraw, ImageFont
+
+ROOT = Path(__file__).resolve().parents[2]
+WIDTH, HEIGHT = 1248, 864
+VIEWPORT = (1200, 700)
+BG, PANEL, BORDER = '#101113', '#0b0c0e', '#303236'
+TEXT, MUTED, ACCENT = '#f4f4f5', '#a1a1aa', '#a7f3d0'
+STEPS = ['Generate', 'Getting Started', 'API Reference', 'SDKs', 'MCP']
+
+
+def font(size, mono=False):
+    candidates = (
+        [os.environ.get('CORTEX_OVERVIEW_MONO_FONT'),
+         '/System/Library/Fonts/Menlo.ttc',
+         '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf']
+        if mono else
+        [os.environ.get('CORTEX_OVERVIEW_FONT'),
+         '/System/Library/Fonts/Supplemental/Arial.ttf',
+         '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf']
+    )
+    for candidate in candidates:
+        if candidate and Path(candidate).is_file():
+            return ImageFont.truetype(candidate, size)
+    raise SystemExit('Set CORTEX_OVERVIEW_FONT and CORTEX_OVERVIEW_MONO_FONT to font files.')
+
+
+def text(draw, position, value, size=18, color=TEXT, mono=False):
+    draw.text(position, value, fill=color, font=font(size, mono))
+
+
+def frame(label, step, location):
+    image = Image.new('RGB', (WIDTH, HEIGHT), BG)
+    draw = ImageDraw.Draw(image)
+    text(draw, (26, 22), 'cortex', 28)
+    draw.line((125, 23, 125, 54), fill=BORDER, width=1)
+    text(draw, (146, 28), label, 24)
+    draw.rounded_rectangle((23, 79, 1224, 817), radius=12, fill=PANEL, outline=BORDER)
+    draw.rounded_rectangle((24, 80, 1223, 124), radius=12, fill='#191b1e')
+    draw.rectangle((24, 106, 1223, 116), fill='#191b1e')
+    for x, color in [(44, '#ed6a5e'), (62, '#f4bf4f'), (80, '#61c554')]:
+        draw.ellipse((x, 94, x + 9, 103), fill=color)
+    length = draw.textlength(location, font=font(13, True))
+    text(draw, ((WIDTH - length) / 2, 90), location, 13, MUTED, True)
+    x = 26
+    for index, name in enumerate(STEPS):
+        color = ACCENT if index == step else (TEXT if index < step else MUTED)
+        draw.ellipse((x, 839, x + 6, 845), fill=color)
+        text(draw, (x + 14, 832), name, 16, color)
+        x += 14 + draw.textlength(name, font=font(16)) + 32
+    text(draw, (1015, 833), 'demo.cortexdocs.dev', 15, MUTED)
+    return image
+
+
+def terminal(lines, command='', count=0, serve=None, started=False, cursor=True):
+    image = frame('From OpenAPI to docs, SDKs, and MCP', 0, 'petstore — terminal')
+    draw = ImageDraw.Draw(image)
+    text(draw, (54, 146), '# OpenAPI source configured in cortex.config.yml', 18, MUTED, True)
+    text(draw, (54, 184), '$', 21, ACCENT, True)
+    text(draw, (80, 184), command, 21, TEXT, True)
+    if cursor and count == 0:
+        x = 82 + draw.textlength(command, font=font(21, True))
+        draw.rectangle((x, 186, x + 10, 208), fill=ACCENT)
+    for index, line in enumerate(lines[:count]):
+        color = ACCENT if line.startswith('✓') else MUTED
+        if index == 0:
+            color = TEXT
+        text(draw, (54, 231 + index * 24), line, 17, color, True)
+    if serve is not None:
+        text(draw, (54, 695), '$', 21, ACCENT, True)
+        text(draw, (80, 695), serve, 21, TEXT, True)
+        if cursor:
+            x = 82 + draw.textlength(serve, font=font(21, True))
+            draw.rectangle((x, 697, x + 10, 719), fill=ACCENT)
+    if started:
+        text(draw, (54, 741), 'Starting docs server at http://localhost:3012', 18, MUTED, True)
+    return image
+
+
+def browser(scene, source):
+    image = frame(scene['label'], scene['step'], scene['url'].replace('https://', '').split('?')[0])
+    with Image.open(source / f"{scene['name']}.png") as screenshot:
+        if screenshot.size != VIEWPORT:
+            raise ValueError(f"{scene['name']}: expected {VIEWPORT}, got {screenshot.size}")
+        image.paste(screenshot.convert('RGB'), (24, 116))
+    return image
+
+
+def pointer(image, point, pulse=0):
+    image = image.copy()
+    draw = ImageDraw.Draw(image)
+    x, y = point
+    if pulse:
+        radius = 10 + pulse * 8
+        draw.ellipse((x-radius, y-radius, x+radius, y+radius), outline=ACCENT, width=2)
+    points = [(x, y), (x+1, y+22), (x+7, y+17), (x+12, y+27),
+              (x+17, y+24), (x+12, y+15), (x+21, y+14)]
+    draw.polygon(points, fill='#ffffff', outline='#111111', wi
```

---

### Incident Patch 7: `f4d7a6ed` (2026-09-12)
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
 - Combine multiple specification files in one generated SDK.
 - Generate HTTP, WebSocket, GraphQL, gRPC, and JSON-RPC clients.
-- Generate a production documentation server with interactive API reference pages.
-- Generate MCP server for REST, GraphQL, OpenRPC, and WebSocket payload preparation.
+- Build static HTML documentation with interactive API reference pages.
+- Generate an MCP server with typed tools, embedded specifications, SDK guides, and project documentation for AI agents.
 - Add Markdown pages, SDK guides, and all API specifications to the MCP server.
 - Customize generated output with sparse Eta template overrides.
-- Publish generated packages and MCP to language registries and GitHub repositories.
+- Publish generated packages and MCP servers to language registries and GitHub repositories.
+
+## Unlimited specs. Multiple ways to use it.
+
+Generate interactive docs for exploration, typed SDKs for integration, and MCP servers for AI agents.
+
+| Task                | Split toolchain                       
```

**File**: `RELEASING.md` (modified, +5/-2)
```diff
@@ -59,9 +59,12 @@ The release workflow performs these actions:
 11. Build the complete product documentation as static files.
 12. Deploy the static files to `docs.cortexdocs.dev`.
 13. Make sure that Cloudflare Static Assets serves the product documentation.
+14. Create the GitHub Release with the generated changelog notes.
 
 The release stops before the product docs deployment if an npm publication fails. A rerun skips package versions that already exist.
 
+The workflow creates or updates the GitHub Release after all package and documentation checks pass. This operation is safe during a workflow rerun.
+
 The CLI tarball includes the internal workspace packages that it uses. The release does not publish these workspaces as separate npm packages.
 
 The release notes always contain these sections:
@@ -111,13 +114,13 @@ Run this command to calculate the next version without file changes:
 node scripts/set-release-version.mjs --check
 ```
 
-Run this command to build the demo for the Cloudflare runtime:
+Run this command to build the demo documentation as static files for Cloudflare:
 
 ```bash
 npm run --workspace=@cortex-docs/docs-ui demo:build
 ```
 
-Run this command to build the product docs for the Cloudflare runtime:
+Run this command to build the product documentation as static files for Cloudflare:
 
 ```bash
 npm run --workspace=@cortex-docs/docs-ui docs:build
```

**File**: `assets/cortex-overview.svg` (added, +178/-0)
```diff
@@ -0,0 +1,178 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" role="img" aria-labelledby="title desc">
+  <title id="title">Cortex Docs product overview</title>
+  <desc id="desc">API specifications and Markdown flow through one Cortex project configuration into interactive documentation, typed SDKs, and an MCP server for AI agents.</desc>
+  <defs>
+    <linearGradient id="background" x1="0" y1="0" x2="1" y2="1">
+      <stop offset="0" stop-color="#0b0d12"/>
+      <stop offset="1" stop-color="#141925"/>
+    </linearGradient>
+    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
+      <stop offset="0" stop-color="#6ee7f2"/>
+      <stop offset="1" stop-color="#8b7cf6"/>
+    </linearGradient>
+    <linearGradient id="asyncapi-logo" x1="1" y1="0" x2="0" y2="1">
+      <stop offset="0" stop-color="#2dccfd"/>
+      <stop offset="1" stop-color="#ad20e2"/>
+    </linearGradient>
+    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
+      <feDropShadow dx="0" dy="12" stdDeviation="16" flood-color="#000000" flood-opacity="0.3"/>
+    </filter>
+    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
+      <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/>
+    </marker>
+  </defs>
+
+  <rect width="1200" height="630" rx="24" fill="url(#background)"/>
+  <circle cx="600" cy="315" r="250" fill="#7767f4" opacity="0.05"/>
+  <circle cx="600" cy="315" r="175" fill="#67e8f9" opacity="0.04"/>
+
+  <g transform="translate(62 34) scale(1.3)" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif">
+    <g stroke="#f8fafc" fill="none" stroke-linecap="round" stroke-linejoin="round">
+      <path d="M9 2.5 Q11 1 13 2.5 L18 5 Q20 6 18 7 L13 9.5 Q11 11 9 9.5 L4 7 Q2 6 4 5 Z" stroke-width="1.5" fill="#f8fafc" fill-opacity=".1"/>
+      <path d="M3 10 L9 13.5 Q11 14.8 13 13.5 L19 10" stroke-width="1.5"/>
+      <path d="M3 13.5 L9 17 Q11 18.3 13 17 L19 13.5" stroke-width="1.5" stroke-opacity=".5"/>
+    </g>
+    <text x="26" y="15" fill="#f8fafc" font-size="16" font-weight="600">Cortex</text>
+  </g>
+
+  <text x="600" y="58" text-anchor="middle" fill="#f8fafc" font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="28" font-weight="700">Unlimited specs. Multiple ways to use it.</text>
+  <text x="600" y="88" text-anchor="middle" fill="#94a3b8" font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" font-size="15">Generate interactive docs for exploration, typed SDKs for integration, and MCP servers for AI agents.</text>
+
+  <g font-family="Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif">
+    <text x="78" y="145" fill="#64748b" font-size="12" font-weight="700" letter-spacing="1.4">SOURCES</text>
+
+    <g fill="#151a24" stroke="#2a3242">
+      <rect x="62" y="166" width="224" height="54" rx="12"/>
+      <rect x="62" y="232" width="224" height="54" rx="12"/>
+      <rect x="62" y="298" width="224" height="54" rx="12"/>
+      <rect x="62" y="364" width="224" height="54" rx="12"/>
+      <rect x="62" y="430" width="224" height="54" rx="12"/>
+      <rect x="62" y="496" width="224" height="54" rx="12"/>
+    </g>
+
+    <g font-size="16" font-weight="600" fill="#e2e8f0">
+      <text x="118" y="199">OpenAPI</text>
+      <text x="118" y="265">AsyncAPI</text>
+      <text x="118" y="331">GraphQL</text>
+      <text x="118" y="397">Protocol Buffer</text>
+      <text x="118" y="463">OpenRPC</text>
+      <text x="118" y="529">Markdown</text>
+    </g>
+
+    <!-- OpenAPI -->
+    <g transform="translate(80 181)" fill="#6ba43a">
+      <path d="M21.039 0a2.959 2.959 0 0 0-2.65 4.274l-6.447 6.447a2.96 2.96 0 1 0 1.335 1.336l6.447-6.447A2.959 2.959 0 1 0 21.04 0ZM10.628 2.745c-.072 0-.143.003-.214.004-.072.002-.143.002-.215.005-.447.018-.893.064-1.335.138l-.03.005-.185.033-.105.02a7.718 7.718 0 0 0-.289.062l-.032.008a10.69 10.69 0 0 0-2.55.95l-.155.089c-.063.034-.125.07-.187.105-.046.027-.093.051-.14.079H5.19l-.01.005-.036.02v.002l.111.184 3.15 5.23a4.168 4.168 0 0 1 .38-.202 4.294 4.294 0 0 1 1.628-.413c.071-.004.143-.008.214-.008Zm.428.01v6.333c.325.034.647.103.96.209l4.66-4.66c-.173-.12-.348-.237-.528-.347l-.026-.015c-.056-.035-.112-.067-.168-.1l-.098-.056-.099-.055a12.735 12.735 0 0 0-.171-.092l-.027-.014a10.628 10.628 0 0 0-1.425-.617c-.69-.241-1.403-.41-2.128-.505l-.089-.012-.09-.01a6.56 6.56 0 0 0-.17-.019l-.049-.004-.204-.017a6.44 6.44 0 0 0-.255-.015c-.031-.003-.062-.003-.093-.004ZM4.782 4.498a9.92 9.92 0 0 0-1.36 1.062l4.461 4.461.018.018c.049-.04.098-.078.149-.116l-.011-.018Zm-1.67 1.36c-.05.05-.098.103-.147.154l-.149.155c-.33.357-.63.73-.902 1.118l-.039.056a10.588 10.588 0 0 0-.216.326 10.6 10.6 0 0 0-1.65 5.276l-.006.215-.003.214h6.317c0-.072.007-.143.01-.214.005-.072.006-.144.013-.215.081-.822.399-1.625.952-2.3.045-.055.096-.106.144-.16.048-.052.093-.107.144-.158Zm16.255 1.464-4.66
```

**File**: `e2e/docs-ui-static.spec.ts` (modified, +38/-7)
```diff
@@ -38,18 +38,49 @@ test.describe('Cloudflare Static Assets export', () => {
   });
 
   test('serves generated MCP and SDK deep links', async ({ page }) => {
-    await page.goto('/mcp/docs_quickstart');
-    await expect(page.getByText('docs_quickstart').first()).toBeVisible();
-
-    await page.goto('/mcp/sdk_typescript_petstore_typescript_client_sdk');
-    await expect(
-      page.getByText('sdk_typescript_petstore_typescript_client_sdk').first(),
-    ).toBeVisible();
+    const mcp = await (await page.request.get('/api/mcp')).json();
+    for (const tool of [
+      'docs_quickstart',
+      'sdk_typescript_petstore_typescript_client_sdk',
+      mcp.tools.at(-1).name,
+    ]) {
+      await page.goto(`/mcp/${tool}`);
+      await page.waitForLoadState('networkidle');
+      await expect(page.locator(`[id="mcp-${tool}"]`)).toBeInViewport({ ratio: 1 });
+      await expect(page.getByRole('navigation', { name: 'breadcrumb' })).toContainText(tool);
+      await expect(page).toHaveURL(new RegExp(`/mcp/${tool}$`));
+    }
 
     await page.goto('/sdks/typescript');
     await expect(page.getByText('TypeScript').first()).toBeVisible();
   });
 
+  for (const width of [320, 390]) {
+    test(`keeps documentation readable and navigation usable at ${width}px`, async ({ page }) => {
+      await page.setViewportSize({ width, height: 844 });
+      await page.goto('/docs/quickstart');
+      await expect(page.getByRole('heading', { name: 'Quickstart', exact: true })).toBeVisible();
+      const article = await page.locator('article').boundingBox();
+      expect(article?.width).toBeGreaterThanOrEqual(width - 40);
+      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
+      await expect(page.getByRole('button', { name: 'Toggle theme' })).toBeInViewport({ ratio: 1 });
+      await expect(page.getByRole('button', { name: 'Search documentation' })).toBeInViewport({
+        ratio: 1,
+      });
+
+      await page.getByRole('button', { name: 'Open documentation navigation' }).click();
+      const navigation = page.getByRole('dialog', { name: 'Documentation', exact: true });
+      await expect(navigation).toBeVisible();
+      await navigation.getByRole('link', { name: 'Quickstart', exact: true }).click();
+      await expect(navigation).not.toBeVisible();
+
+      await page.getByRole('button', { name: 'Search documentation' }).click();
+      await expect(page.getByRole('dialog')).toBeVisible();
+      await page.keyboard.press('Escape');
+      await expect(page.getByRole('dialog')).not.toBeVisible();
+    });
+  }
+
   test('matches the local demo documentation and MCP SDK tools', async ({ request }) => {
     const docsResponse = await request.get('/api/docs');
     const docs = await docsResponse.json();
```

---

### Incident Patch 8: `978dc72c` (2026-09-12)
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
       "dev": true,
       "license": "MIT OR Apache-2.0"
     },
@@ -2128,6 +2128,7 @@
       "version": "1.11.3",
       "resolved": "https://registry.npmjs.org/@emnapi/runtime/-/runtime-1.11.3.tgz",
       "integrity": "sha512-Xz4Tpyki7XyrpbUK1jR1AhdAdaXyhhY4lZ3neLodmhpuWfy2PAQN5B46sAiU4liOXGLkHypn/qU+jvfWSCYYLA==",
+      "dev": true,
       "license": "MIT",
       "optional": true,
       "dependencies": {
@@ -3018,6 +3019,7 @@
       "cpu": [
         "arm64"
       ],
+      "dev": true,
       "license": "Apache-2.0",
       "optional": true,
       "os": [
@@ -3040,6 +3042,7 @@
       "cpu": [
         "x64"
       ],
+      "dev": true,
       "license": "Apache-2.0",
       "optional": true,
       "os": [
@@ -3059,6 +3062,7 @@
       "version": "0.35.4",
       "resolved": "https://registry.npmjs.org/@img/sharp-freebsd-wasm32/-/sharp-freebsd-wasm32-0.35.4.tgz",
       "integrity": "sha512-lIsKw/BU+kjB4eZjxrYrZmwOJYi3Ajrv66iAlBmUPyKc3HpnloevB1g3wxGD9P/5BbQ1brBGl65VRRrCvQDEqA==",

```

---

### Incident Patch 9: `b5dfc0f5` (2026-09-12)
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

### Incident Patch 10: `9568d09c` (2026-09-12)
**Commit Message**: refactor: remove DocsStartCommand and update documentation build process

- Removed the DocsStartCommand from the CLI, simplifying the documentation commands.
- Updated the DocsBuildCommand to export static HTML documentation instead of a Node.js server.
- Modified related documentation to reflect the changes in the build process and deployment instructions.
- Enhanced error handling and logging for the build process.
- Adjusted the UI components for better responsiveness and user experience.
- Cleaned up unused code and dependencies related to the removed start command.

**File**: `CHANGELOG.md` (modified, +5/-3)
```diff
@@ -8,15 +8,17 @@ The project uses Semantic Versioning. Each release contains the same three chang
 
 ### New Features
 
-- None.
+- `cortex docs build` now exports static HTML, CSS, JavaScript, and documentation data for deployment to a static web host.
 
 ### Bug Fixes
 
-- None.
+- Fixed the documentation layout and navigation on mobile screens.
+- Fixed MCP tool links that scrolled to the wrong position after the setup guide loaded.
+- Excluded workspace test dependencies from the CLI release package to prevent dependency conflicts during CI packaging.
 
 ### Improvements
 
-- None.
+- Removed `cortex docs start`. Use `cortex docs serve` for a local preview with file watching. Host production output as static files without a Node.js server.
 
 ## [0.1.29] - 2026-08-31
 
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

**File**: `README.md` (modified, +7/-7)
```diff
@@ -68,7 +68,7 @@ mcp-server → generated/mcp-server
 
 The generated MCP server gives AI agents typed tools, specifications, SDK guides, and project documentation.
 
-Generate the files. Then start the documentation server:
+Generate the files. Then start the local documentation preview:
 
 ```bash
 cortex generate
@@ -82,7 +82,7 @@ Open `http://localhost:3012`. Press `Ctrl+C` to stop the server.
 - Generate SDKs for TypeScript, Python, Go, Java, Kotlin, Ruby, PHP, C#, Rust, C++, and C.
 - Combine multiple specification files in one generated SDK.
 - Generate HTTP, WebSocket, GraphQL, gRPC, and JSON-RPC clients.
-- Generate a production documentation server with interactive API reference pages.
+- Build static HTML documentation with interactive API reference pages.
 - Generate an MCP server with typed tools, embedded specifications, SDK guides, and project documentation for AI agents.
 - Add Markdown pages, SDK guides, and all API specifications to the MCP server.
 - Customize generated output with sparse Eta template overrides.
@@ -184,8 +184,7 @@ See the [configuration reference](packages/docs-site/docs/configuration.md) for
 | `cortex generate --language typescript`   | Generate one configured language.                     |
 | `cortex generate --dry-run`               | Show planned output without writing files.            |
 | `cortex docs serve`                       | Start the development server and watch project files. |
-| `cortex docs build --output .cortex/docs` | Create a production Node.js documentation build.      |
-| `cortex docs start --output .cortex/docs` | Start a production documentation build.               |
+| `cortex docs build --output .cortex/docs` | Build static HTML documentation.                      |
 | `cortex mcp generate`                     | Generate only the MCP server.                         |
 | `cortex publish --dry-run`                | Check package publication without uploading.          |
 | `cortex publish`                          | Publish enabled generated packages.                   |
@@ -204,14 +203,15 @@ The generated MCP server does not call gRPC methods. It exposes Protocol Buffer
 
 ## Production documentation
 
-The build command creates a self-contained Next.js server. It is not a static HTML export.
+The build command exports the documentation as static HTML, CSS, JavaScript, and data files.
 
 ```bash
 cortex docs build --output .cortex/docs
-NODE_ENV=production cortex docs start --output .cortex/docs --port 3000
 ```
 
-Deploy the output directory to a service that can run Node.js. Keep `cortex.config.yml` and its referenced specifications available at runtime.
+Deploy the output directory to a static web host. Configure the host to resolve page URLs such as `/docs/quickstart` to `/docs/quickstart.html`.
+
+The deployed site needs no Node.js server or access to the original configuration and specifications. Rebuild the site after source changes. Use `cortex docs serve` for a local preview with file watching.
 
 ## MCP output
 
```

**File**: `RELEASING.md` (modified, +2/-2)
```diff
@@ -114,13 +114,13 @@ Run this command to calculate the next version without file changes:
 node scripts/set-release-version.mjs --check
 ```
 
-Run this command to build the demo for the Cloudflare runtime:
+Run this command to build the demo documentation as static files for Cloudflare:
 
 ```bash
 npm run --workspace=@cortex-docs/docs-ui demo:build
 ```
 
-Run this command to build the product docs for the Cloudflare runtime:
+Run this command to build the product documentation as static files for Cloudflare:
 
 ```bash
 npm run --workspace=@cortex-docs/docs-ui docs:build
```

**File**: `e2e/docs-ui-static.spec.ts` (modified, +38/-7)
```diff
@@ -38,18 +38,49 @@ test.describe('Cloudflare Static Assets export', () => {
   });
 
   test('serves generated MCP and SDK deep links', async ({ page }) => {
-    await page.goto('/mcp/docs_quickstart');
-    await expect(page.getByText('docs_quickstart').first()).toBeVisible();
-
-    await page.goto('/mcp/sdk_typescript_petstore_typescript_client_sdk');
-    await expect(
-      page.getByText('sdk_typescript_petstore_typescript_client_sdk').first(),
-    ).toBeVisible();
+    const mcp = await (await page.request.get('/api/mcp')).json();
+    for (const tool of [
+      'docs_quickstart',
+      'sdk_typescript_petstore_typescript_client_sdk',
+      mcp.tools.at(-1).name,
+    ]) {
+      await page.goto(`/mcp/${tool}`);
+      await page.waitForLoadState('networkidle');
+      await expect(page.locator(`[id="mcp-${tool}"]`)).toBeInViewport({ ratio: 1 });
+      await expect(page.getByRole('navigation', { name: 'breadcrumb' })).toContainText(tool);
+      await expect(page).toHaveURL(new RegExp(`/mcp/${tool}$`));
+    }
 
     await page.goto('/sdks/typescript');
     await expect(page.getByText('TypeScript').first()).toBeVisible();
   });
 
+  for (const width of [320, 390]) {
+    test(`keeps documentation readable and navigation usable at ${width}px`, async ({ page }) => {
+      await page.setViewportSize({ width, height: 844 });
+      await page.goto('/docs/quickstart');
+      await expect(page.getByRole('heading', { name: 'Quickstart', exact: true })).toBeVisible();
+      const article = await page.locator('article').boundingBox();
+      expect(article?.width).toBeGreaterThanOrEqual(width - 40);
+      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
+      await expect(page.getByRole('button', { name: 'Toggle theme' })).toBeInViewport({ ratio: 1 });
+      await expect(page.getByRole('button', { name: 'Search documentation' })).toBeInViewport({
+        ratio: 1,
+      });
+
+      await page.getByRole('button', { name: 'Open documentation navigation' }).click();
+      const navigation = page.getByRole('dialog', { name: 'Documentation', exact: true });
+      await expect(navigation).toBeVisible();
+      await navigation.getByRole('link', { name: 'Quickstart', exact: true }).click();
+      await expect(navigation).not.toBeVisible();
+
+      await page.getByRole('button', { name: 'Search documentation' }).click();
+      await expect(page.getByRole('dialog')).toBeVisible();
+      await page.keyboard.press('Escape');
+      await expect(page.getByRole('dialog')).not.toBeVisible();
+    });
+  }
+
   test('matches the local demo documentation and MCP SDK tools', async ({ request }) => {
     const docsResponse = await request.get('/api/docs');
     const docs = await docsResponse.json();
```

**File**: `packages/cli/README.md` (modified, +9/-0)
```diff
@@ -17,4 +17,13 @@ cortex generate
 cortex docs serve
 ```
 
+Build static HTML documentation for deployment:
+
+```bash
+cortex docs build --output .cortex/docs
+```
+
+Deploy the output directory to a static web host. Configure page URLs such as `/docs/quickstart` to resolve to `/docs/quickstart.html`.
+The deployed site needs no Node.js server. Rebuild the site after source changes.
+
 Read the [Cortex Docs repository](https://github.com/cortex-docs/cortex) for the complete documentation.
```

**File**: `packages/cli/__tests__/docs-build.test.ts` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+import * as fs from 'node:fs';
+import * as os from 'node:os';
+import * as path from 'node:path';
+import { execFileSync } from 'node:child_process';
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
+import { DocsBuildCommand } from '../src/commands/docs/build.command';
+import { prepareDocsUiBuildRuntime, resolveDocsUiPath } from '../src/commands/docs/runtime';
+import type { LoggerService } from '../src/services/logger.service';
+import type { ProjectService } from '../src/services/project.service';
+
+vi.mock('node:child_process', () => ({ execFileSync: vi.fn() }));
+vi.mock('../src/commands/docs/runtime', () => ({
+  prepareDocsUiBuildRuntime: vi.fn(),
+  resolveDocsUiPath: vi.fn(),
+  resolveNextBin: () => '/next/bin/next',
+}));
+
+describe('docs build', () => {
+  let workspace: string;
+  let outputDir: string;
+  let command: DocsBuildCommand;
+
+  beforeEach(() => {
+    vi.clearAllMocks();
+    workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'cortex-docs-build-'));
+    outputDir = path.join(workspace, 'site');
+    vi.mocked(resolveDocsUiPath).mockReturnValue(workspace);
+    command = new DocsBuildCommand(
+      { header: vi.fn(), info: vi.fn(), success: vi.fn() } as unknown as LoggerService,
+      {
+        findConfig: async () => path.join(workspace, 'cortex.config.yml'),
+        loadConfig: async () => ({ project: 'test', sources: [] }),
+      } as unknown as ProjectService,
+    );
+    fs.mkdirSync(outputDir);
+    fs.writeFileSync(path.join(outputDir, 'old.html'), 'previous build');
+  });
+
+  afterEach(() => {
+    fs.rmSync(workspace, { recursive: true, force: true });
+  });
+
+  it('replaces the previous build with exported pages, data, and browser assets', async () => {
+    vi.mocked(execFileSync).mockImplementation((_file, _args, options) => {
+      const runtimeDir = String(options!.cwd);
+      expect(options!.env).toMatchObject({
+        CORTEX_STATIC_EXPORT: '1',
+        CORTEX_DIST_DIR: '.next',
+        CORTEX_CONFIG_PATH: path.join(workspace, 'cortex.config.yml'),
+      });
+      for (const [name, content] of [
+        ['out/index.html', '<h1>Docs</h1>'],
+        ['out/docs/guide.html', '<h1>Guide</h1>'],
+        ['out/api/config', '{"project":"test"}'],
+        ['out/_next/static/app.js', 'browser code'],
+        ['out/logo.svg', '<svg/>'],
+        ['.next/server/app.js', 'server code'],
+      ]) {
+        const file = path.join(runtimeDir, name);
+        fs.mkdirSync(path.dirname(file), { recursive: true });
+        fs.writeFileSync(file, content);
+      }
+      return Buffer.from('');
+    });
+
+    await command.run([], { output: outputDir });
+
+    expect(fs.readFileSync(path.join(outputDir, 'index.html'), 'utf8')).toContain('Docs');
+    expect(fs.readFileSync(path.join(outputDir, 'docs/guide.html'), 'utf8')).toContain('Guide');
+    expect(JSON.parse(fs.readFileSync(path.join(outputDir, 'api/config'), 'utf8'))).toEqual({
+      project: 'test',
+    });
+    expect(fs.existsSync(path.join(outputDir, '_next/static/app.js'))).toBe(true);
+    expect(fs.existsSync(path.join(outputDir, 'logo.svg'))).toBe(true);
+    for (const file of ['old.html', '.next', '.cortex-docs-build.json', 'server.js']) {
+      expect(fs.existsSync(path.join(outputDir, file))).toBe(false);
+    }
+    expect(fs.readdirSync(workspace).filter((name) => name.startsWith('.cortex-build-'))).toEqual(
+      [],
+    );
+  });
+
+  it.each(['prepare', 'compile', 'export'])(
+    'preserves the previous build after a %s failure',
+    async (stage) => {
+      if (stage === 'prepare') {
+        vi.mocked(prepareDocsUiBuildRuntime).mockImplementationOnce(() => {
+          throw new Error('Cannot prepare runtime');
+        });
+      }
+      vi.mocked(execFileSync).mockImplementation(() => {
+        if (stage === 'compile') throw new Error('Compilation failed');
+        return Buffer.from('');
+      });
+
+      await expect(command.run([], { output: outputDir })).rejects.toThrow();
+
+      expect(fs.readFileSync(path.join(outputDir, 'old.html'), 'utf8')).toBe('previous build');
+      expect(fs.readdirSync(workspace).filter((name) => name.startsWith('.cortex-build-'))).toEqual(
+        [],
+      );
+    },
+  );
+});
```

**File**: `packages/cli/src/app.module.ts` (modified, +0/-2)
```diff
@@ -5,7 +5,6 @@ import { ValidateCommand } from './commands/validate/validate.command';
 import { DocsCommand } from './commands/docs/docs.command';
 import { DocsServeCommand } from './commands/docs/serve.command';
 import { DocsBuildCommand } from './commands/docs/build.command';
-import { DocsStartCommand } from './commands/docs/start.command';
 import { McpCommand } from './commands/mcp/mcp.command';
 import { McpGenerateCommand } from './commands/mcp/mcp-generate.command';
 import { PublishCommand } from './commands/publish/publish.command';
@@ -22,7 +21,6 @@ import { LoggerService } from './services/logger.service';
     DocsCommand,
     DocsServeCommand,
     DocsBuildCommand,
-    DocsStartCommand,
     McpCommand,
     McpGenerateCommand,
     PublishCommand,
```

---

### Incident Patch 11: `b5571433` (2026-08-31)
**Commit Message**: fix(codegen): reconnect Go GraphQL subscriptions (#63)

Co-authored-by: Nick Chisiu <[REDACTED_EMAIL]>

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

### Incident Patch 12: `29581d88` (2026-08-31)
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

### Incident Patch 13: `d5ab952f` (2026-08-27)
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
+    title: 'Petstore Docs',
     logo_dark: './assets/logo_dark.svg',
     logo_light: './assets/logo_light.svg',
     logoHeight: 24,
@@ -85,56 +149,46 @@ export function prepareDemo(apiUrl = process.env.CORTEX_DEMO_API_URL || 'http://
     theme: 'system',
     primaryColor: '#ffffff',
     home: {
-      title: 'Cortex Docs Demo',
+      title: 'Petstore Docs',
       description:
-        'Explore API documentation, generated SDKs, and MCP tools for the Petstore example.',
-      cta: { label: 'Open API Reference', href: '/api-reference' },
+        'Explore the full API surface, grab a client SDK, or wire up AI coding agents via our MCP for faster integration.',
+      cta: { label: 'Getting Started', href: '/docs' },
       sections: [
         {
           title: 'API Reference',
-          description: 'Send requests to the Worker-native Petstore API.',
-          badge: 'Live demo',
-          href: '/api-reference',
-          icon: 'assets/docs-icon.svg',
+          description:
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

### Incident Patch 14: `65468a96` (2026-08-27)
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
+    title: 'Petstore Docs',
     logo_dark: './assets/logo_dark.svg',
     logo_light: './assets/logo_light.svg',
     logoHeight: 24,
@@ -85,56 +149,46 @@ export function prepareDemo(apiUrl = process.env.CORTEX_DEMO_API_URL || 'http://
     theme: 'system',
     primaryColor: '#ffffff',
     home: {
-      title: 'Cortex Docs Demo',
+      title: 'Petstore Docs',
       description:
-        'Explore API documentation, generated SDKs, and MCP tools for the Petstore example.',
-      cta: { label: 'Open API Reference', href: '/api-reference' },
+        'Explore the full API surface, grab a client SDK, or wire up AI coding agents via our MCP for faster integration.',
+      cta: { label: 'Getting Started', href: '/docs' },
       sections: [
         {
           title: 'API Reference',
-          description: 'Send requests to the Worker-native Petstore API.',
-          badge: 'Live demo',
-          href: '/api-reference',
-          icon: 'assets/docs-icon.svg',
+          description:
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

### Incident Patch 15: `acbe280d` (2026-08-27)
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
+    title: 'Petstore Docs',
     logo_dark: './assets/logo_dark.svg',
     logo_light: './assets/logo_light.svg',
     logoHeight: 24,
@@ -85,56 +149,46 @@ export function prepareDemo(apiUrl = process.env.CORTEX_DEMO_API_URL || 'http://
     theme: 'system',
     primaryColor: '#ffffff',
     home: {
-      title: 'Cortex Docs Demo',
+      title: 'Petstore Docs',
       description:
-        'Explore API documentation, generated SDKs, and MCP tools for the Petstore example.',
-      cta: { label: 'Open API Reference', href: '/api-reference' },
+        'Explore the full API surface, grab a client SDK, or wire up AI coding agents via our MCP for faster integration.',
+      cta: { label: 'Getting Started', href: '/docs' },
       sections: [
         {
           title: 'API Reference',
-          description: 'Send requests to the Worker-native Petstore API.',
-          badge: 'Live demo',
-          href: '/api-reference',
-          icon: 'assets/docs-icon.svg',
+          description:
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
- **PR #111** (2026-10-01): fix: adapt primary button text to configured colors  (@nick-csu)
- **PR #110** (2026-10-01): fix: improve documentation contrast and site titles (@nick-csu)
- **PR #109** (2026-09-28): Release hosted documentation and live repository MCP (@nick-csu)
- **PR #108** (2026-09-28): feat: release hosted documentation and live repository MCP (@nick-csu)
- **PR #107** (2026-09-22): docs: promote primary color configuration example (@nick-csu)
- **PR #106** (2026-09-22): docs: show primaryColor in README configuration (@nick-csu)
- **PR #99** (2019-05-08): added new doc #1 (@nick-csu)
- **PR #98** (2019-05-08): added doc roadmap (@nick-csu)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
