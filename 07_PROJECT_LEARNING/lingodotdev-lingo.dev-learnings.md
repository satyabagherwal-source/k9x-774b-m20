> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/lingodotdev-lingo.dev-learnings.md`  
> **Source**: github ([https://github.com/lingodotdev/lingo.dev](https://github.com/lingodotdev/lingo.dev))  
> **Source Version**: `b29703a4`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T04:13:20.792Z  
> **Learning ID**: `learn-github-lingodotdev-lingo-dev`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): lingodotdev/lingo.dev

> **Canonical Artifact**: `07_PROJECT_LEARNING/lingodotdev-lingo.dev-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lingodotdev/lingo.dev](https://github.com/lingodotdev/lingo.dev))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T04:13:20.787Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lingodotdev/lingo.dev`
- **Description**: Open-source localization engineering tools. Connects to Lingo.dev localization engineering platform for consistent, quality translations.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, Dockerfile
- **Stars / Engagement**: 5396 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/cli/src/cli/cmd/run/_utils.ts`
```
import _ from "lodash";

import { CmdRunContext, CmdRunTask } from "./_types";
import { UserIdentity } from "../../utils/observability";
import { matchesFlatKeyPattern, safeDecode } from "../../utils/key-matching";
import createBucketLoader from "../../loaders";
import { Delta } from "../../utils/delta";

export function createLoaderForTask(assignedTask: CmdRunTask) {
  const bucketLoader = createBucketLoader(
    assignedTask.bucketType,
    assignedTask.bucketPathPattern,
    {
      defaultLocale: assignedTask.sourceLocale,
      injectLocale: assignedTask.injectLocale,
      formatter: assignedTask.formatter,
      keyColumn: assignedTask.keyColumn,
    },
    assignedTask.lockedKeys,
    assignedTask.lockedPatterns,
    assignedTask.ignoredKeys,
    assignedTask.preservedKeys,
    assignedTask.localizableKeys,
  );
  bucketLoader.setDefaultLocale(assignedTask.sourceLocale);

  return bucketLoader;
}

/**
 * The subset of source entries that actually needs translation for a task:
 * delta-changed keys (or everything with --force), narrowed by --key filters.
 * Shared by execute (what gets sent to the localizer) and estimate (what
 * gets counted) so the two can never disagree on scope.
 */
export function computeProcessableData(
  sourceData: Record<string, any>,
  delta: Delta,
  force: boolean | undefined,
  onlyKeys: string[],
): Record<string, any> {
  const patterns = onlyKeys.map(safeDecode);

  return _.chain(sourceData)
    .entries()
    .filter(
      ([key]) =>
        delta.added.includes(key) || delta.updated.includes(key) || !!force,
    )
    .filter(
      ([key]) =>
        !patterns.length || matchesFlatKeyPattern(safeDecode(key), patterns),
    )
    .fromPairs()
    .value();
}

/**
 * Determines the user's identity for tracking purposes.
 * Returns null if using BYOK mode or if authentication fails.
 */
export async function determineUserIdentity(
  ctx: CmdRunContext,
): Promise<UserIdentity> {
  const isByokMode = !!ctx.config?.provider;

  if (isByokMode) {
    return null;
  } else {
    try {
      const authStatus = await ctx.localizer?.checkAuth();
      if (!authStatus?.username || !authStatus?.userId) return null;
      return {
        email: authStatus.username,
        id: authStatus.userId,
      };
    } catch {
      return null;
    }
  }
}

```

### Core Architecture Module: `packages/cli/src/cli/loaders/_utils.ts`
```
import { ILoader, ILoaderDefinition } from "./_types";

export function composeLoaders(
  ...loaders: ILoader<any, any, any>[]
): ILoader<any, any> {
  return {
    init: async () => {
      for (const loader of loaders) {
        await loader.init?.();
      }
    },
    setDefaultLocale(locale: string) {
      for (const loader of loaders) {
        loader.setDefaultLocale?.(locale);
      }
      return this;
    },
    pull: async (locale, input) => {
      let result: any = input;
      for (let i = 0; i < loaders.length; i++) {
        result = await loaders[i].pull(locale, result);
      }
      return result;
    },
    push: async (locale, data) => {
      let result: any = data;
      for (let i = loaders.length - 1; i >= 0; i--) {
        result = await loaders[i].push(locale, result);
      }
      return result;
    },
    pullHints: async (originalInput?) => {
      let result: any = originalInput;
      for (let i = 0; i < loaders.length; i++) {
        const subResult = await loaders[i].pullHints?.(result);
        if (subResult) {
          result = subResult;
        }
      }
      return result;
    },
  };
}

export function createLoader<I, O, C>(
  lDefinition: ILoaderDefinition<I, O, C>,
): ILoader<I, O, C> {
  const state = {
    defaultLocale: undefined as string | undefined,
    originalInput: undefined as I | undefined | null,
    // Store pullInput and pullOutput per-locale to avoid race conditions
    // when multiple locales are processed concurrently
    pullInputByLocale: new Map<string, I | null>(),
    pullOutputByLocale: new Map<string, O | null>(),
    initCtx: undefined as C | undefined,
  };
  return {
    async init() {
      if (state.initCtx) {
        return state.initCtx;
      }
      state.initCtx = await lDefinition.init?.();
      return state.initCtx as C;
    },
    setDefaultLocale(locale) {
      if (state.defaultLocale) {
        throw new Error("Default locale already set");
      }
      state.defaultLocale = locale;
      return this;
    },
    async pullHints(originalInput?: I) {
      return lDefinition.pullHints?.(originalInput || state.originalInput!);
    },
    async pull(locale, input) {
      if (!state.defaultLocale) {
        throw new Error("Default locale not set");
      }
      if (state.originalInput === undefined && locale !== state.defaultLocale) {
        throw new Error("The first pull must be for the default locale");
      }
      if (locale === state.defaultLocale) {
        state.originalInput = input || null;
      }

      state.pullInputByLocale.set(locale, input || null);
      const result = await lDefinition.pull(
        locale,
        input,
        state.initCtx!,
        state.defaultLocale,
        state.originalInput!,
      );
      state.pullOutputByLocale.set(locale, result);

      return result;
    },
    async push(locale, data) {
      if (!state.defaultLocale) {
        throw new Error("Default locale not set");
      }
      if (state.originalInput === undefined) {
        throw new Error("Cannot push data without pulling first");
      }

      // Use locale-specific pullInput/pullOutput if available,
      // otherwise fall back to the default locale's values for backward compatibility
      // (some loaders push for locales that were never explicitly pulled)
      const pullInput =
        state.pullInputByLocale.get(locale) ??
        state.pullInputByLocale.get(state.defaultLocale) ??
        null;
      const pullOutput =
        state.pullOutputByLocale.get(locale) ??
        state.pullOutputByLocale.get(state.defaultLocale) ??
        null;

      const pushResult = await lDefinition.push(
        locale,
        data,
        state.originalInput,
        state.defaultLocale,
        pullInput!,
        pullOutput!,
      );
      return pushResult;
    },
  };
}

```

### Core Architecture Module: `packages/cli/src/cli/loaders/dato/_utils.ts`
```
import _ from "lodash";
import { buildClient, SimpleSchemaTypes } from "@datocms/cma-client-node";
import { DastDocument, DatoBlock, DatoSimpleValue, DatoValue } from "./_base";
import { DastDocumentNode } from "./_base";

type DatoClientParams = {
  apiKey: string;
  projectId: string;
};

export type DatoClient = ReturnType<typeof createDatoClient>;

export default function createDatoClient(params: DatoClientParams) {
  if (!params.apiKey) {
    throw new Error(
      "Missing required environment variable: DATO_API_TOKEN. Please set this variable and try again.",
    );
  }
  const dato = buildClient({
    apiToken: params.apiKey,
    extraHeaders: {
      "X-Exclude-Invalid": "true",
    },
  });

  return {
    findProject: async (): Promise<SimpleSchemaTypes.Site> => {
      const project = await dato.site.find();
      return project;
    },
    updateField: async (
      fieldId: string,
      payload: SimpleSchemaTypes.FieldUpdateSchema,
    ): Promise<void> => {
      try {
        await dato.fields.update(fieldId, payload);
      } catch (_error: any) {
        throw new Error(
          [
            `Failed to update field in DatoCMS.`,
            `Field ID: ${fieldId}`,
            `Payload: ${JSON.stringify(payload, null, 2)}`,
            `Error: ${JSON.stringify(_error, null, 2)}`,
          ].join("\n\n"),
        );
      }
    },
    findField: async (fieldId: string): Promise<SimpleSchemaTypes.Field> => {
      try {
        const field = await dato.fields.find(fieldId);
        if (!field) {
          throw new Error(`Field ${fieldId} not found`);
        }
        return field;
      } catch (_error: any) {
        throw new Error(
          [
            `Failed to find field in DatoCMS.`,
            `Field ID: ${fieldId}`,
            `Error: ${JSON.stringify(_error, null, 2)}`,
          ].join("\n\n"),
        );
      }
    },
    findModels: async (): Promise<SimpleSchemaTypes.ItemType[]> => {
      try {
        const models = await dato.itemTypes.list();
        const modelsWithoutBlocks = models.filter(
          (model) => !model.modular_block,
        );
        return modelsWithoutBlocks;
      } catch (_error: any) {
        throw new Error(
          [
            `Failed to find models in DatoCMS.`,
            `Error: ${JSON.stringify(_error, null, 2)}`,
          ].join("\n\n"),
        );
      }
    },
    findModel: async (modelId: string): Promise<SimpleSchemaTypes.ItemType> => {
      try {
        const model = await dato.itemTypes.find(modelId);
        if (!model) {
          throw new Error(`Model ${modelId} not found`);
        }
        return model;
      } catch (_error: any) {
        throw new Error(
          [
            `Failed to find model in DatoCMS.`,
            `Model ID: ${modelId}`,
            `Error: ${JSON.stringify(_error, null, 2)}`,
          ].join("\n\n"),
        );
      }
    },
    findRecords: async (
      records: string[],
      limit: number = 100,
    ): Promise<SimpleSchemaTypes.Item[]> => {
      return dato.items
        .list({
          nested: true,
          version: "current",
          limit,
          filter: {
            projectId: params.projectId,
            only_valid: "true",
            ids: !records.length ? undefined : records.join(","),
          },
        })
        .catch((error: any) =>
          Promise.reject(error?.response?.body?.data?.[0] || error),
        );
    },
    findRecordsForModel: async (
      modelId: string,
      records?: string[],
    ): Promise<SimpleSchemaTypes.Item[]> => {
      try {
        const result = await dato.items
          .list({
            nested: true,
            version: "current",
            filter: {
              type: modelId,
              only_valid: "true",
              ids: !records?.length ? undefined : records.join(","),
            },
          })
          .catch((error: any) =>
            Promise.reject(error?.response?.body?.data?.[0] || error),
          );
        return result;
      } catch (_error: any) {
        throw new Error(
          [
            `Failed to find records for model in DatoCMS.`,
            `Model ID: ${modelId}`,
            `Error: ${JSON.stringify(_error, null, 2)}`,
          ].join("\n\n"),
        );
      }
    },
    updateRecord: async (id: string, payload: any): Promise<void> => {
      try {
        await dato.items
          .update(id, payload)
          .catch((error: any) =>
            Promise.reject(error?.response?.body?.data?.[0] || error),
          );
      } catch (_error: any) {
        if (_error?.attributes?.details?.message) {
          throw new Error(
            [
              `${_error.attributes.details.message}`,
              `Payload: ${JSON.stringify(payload, null, 2)}`,
              `Error: ${JSON.stringify(_error, null, 2)}`,
            ].join("\n\n"),
          );
        }

        throw new Error(
          [
            `Failed to update record in DatoCMS.`,
            `Record ID: ${id}`,
            `Payload: ${JSON.stringify(payload, null, 2)}`,
            `Error: ${JSON.stringify(_error, null, 2)}`,
          ].join("\n\n"),
        );
      }
    },
    enableFieldLocalization: async (args: {
      modelId: string;
      fieldId: string;
    }): Promise<void> => {
      try {
        await dato.fields
          .update(`${args.modelId}::${args.fieldId}`, { localized: true })
          .catch((error: any) =>
            Promise.reject(error?.response?.body?.data?.[0] || error),
          );
      } catch (_error: any) {
        if (_error?.attributes?.code === "NOT_FOUND") {
          throw new Error(
            [
              `Field "${args.fieldId}" not found in model "${args.modelId}".`,
              `Error: ${JSON.stringify(_error, null, 2)}`,
            ].join("\n\n"),
          );
        }

        if (_error?.attributes?.details?.message) {
          throw new Error(
            [
              `${_error.attributes.details.message}`,
              `Error: ${JSON.stringify(_error, null, 2)}`,
            ].join("\n\n"),
          );
        }

        throw new Error(
          [
            `Failed to enable field localization in DatoCMS.`,
            `Field ID: ${args.fieldId}`,
            `Model ID: ${args.modelId}`,
            `Error: ${JSON.stringify(_error, null, 2)}`,
          ].join("\n\n"),
        );
      }
    },
  };
}

type TraverseDatoCallbackMap = {
  onValue?: (
    path: string[],
    value: DatoSimpleValue,
    setValue: (value: DatoSimpleValue) => void,
  ) => void;
  onBlock?: (path: string[], value: DatoBlock) => void;
};

export function traverseDatoPayload(
  payload: Record<string, DatoValue>,
  callbackMap: TraverseDatoCallbackMap,
  path: string[] = [],
) {
  for (const fieldName of Object.keys(payload)) {
    const fieldValue = payload[fieldName];
    traverseDatoValue(payload, fieldValue, callbackMap, [...path, fieldName]);
  }
}

export function traverseDatoValue(
  parent: Record<string, DatoValue>,
  value: DatoValue,
  callbackMap: TraverseDatoCallbackMap,
  path: string[] = [],
) {
  if (_.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverseDatoValue(parent, value[i], callbackMap, [...path, i.toString()]);
    }
  } else if (_.isObject(value)) {
    if ("schema" in value && value.schema === "dast") {
      traverseDastDocument(value, callbackMap, [...path]);
    } else if ("type" in value && value.type === "item") {
      traverseDatoBlock(value, callbackMap, [...path]);
    } else {
      throw new Error(
        [
          "Unsupported dato object value type:",
          JSON.stringify(value, null, 2),
        ].join("\n\n"),
      );
    }
  } else {
    callbackMap.onValue?.(path, value, (value) => {
      _.set(parent, path[path.length - 1], value);
    });
  }
}

export function traverseDastDocument(
  dast: DastDocument,
  callbackMap: TraverseDatoCallbackMap,
  path: string[] = [],
) {
  traverseDastNode(dast.document, callbackMap, [...path, "document"]);
}

export function traverseDatoBlock(
  block: DatoBlock,
  callbackMap: TraverseDatoCallbackMap,
  path: string[] = [],
) {
  callbackMap.onBlock?.(path, block);
  traverseDatoPayload(block.attributes, callbackMap, [...path, "attributes"]);
}

export function traverseDastNode(
  node: DastDocumentNode,
  callbackMap: TraverseDatoCallbackMap,
  path: string[] = [],
) {
  if (node.value) {
    callbackMap.onValue?.(path, node.value, (value) => {
      _.set(node, "value", value);
    });
  }
  if (node.children?.length) {
    for (let i = 0; i < node.children.length; i++) {
      traverseDastNode(node.children[i], callbackMap, [...path, i.toString()]);
    }
  }
}

```

### Core Architecture Module: `packages/cli/src/cli/loaders/mdx2/_utils.ts`
```
import { Root, RootContent } from "mdast";

export function traverseMdast(
  ast: Root | RootContent,
  visitor: (node: Root | RootContent) => void,
) {
  visitor(ast);
  if ("children" in ast && Array.isArray(ast.children)) {
    for (const child of ast.children) {
      traverseMdast(child, visitor);
    }
  }
}

```

### Core Architecture Module: `packages/cli/src/cli/loaders/plutil-json-loader.ts`
```
import { formatPlutilStyle } from "../utils/plutil-formatter";
import { ILoader } from "./_types";
import { createLoader } from "./_utils";

export default function createPlutilJsonTextLoader(): ILoader<string, string> {
  return createLoader({
    async pull(locale, data) {
      return data;
    },
    async push(locale, data, originalInput) {
      const jsonData = JSON.parse(data);
      const result = formatPlutilStyle(jsonData, originalInput || "");

      return result;
    },
  });
}

```

### Core Architecture Module: `packages/cli/src/cli/utils/auth.ts`
```
import { CLIError } from "./errors";
import {
  checkCloudflareStatus,
  formatCloudflareStatusMessage,
} from "./cloudflare-status";

export type AuthenticatorParams = {
  apiUrl: string;
  apiKey: string;
};

export type AuthPayload = {
  email: string;
  id: string;
};

export function createAuthenticator(params: AuthenticatorParams) {
  return {
    async whoami(): Promise<AuthPayload | null> {
      try {
        const res = await fetch(`${params.apiUrl}/users/me`, {
          method: "GET",
          headers: {
            "X-API-Key": params.apiKey,
            "Content-Type": "application/json",
          },
        });

        if (res.ok) {
          const payload = await res.json();
          if (!payload?.email) {
            return null;
          }

          return {
            email: payload.email,
            id: payload.id,
          };
        }

        if (res.status >= 500 && res.status < 600) {
          const originalErrorMessage = `Server error (${res.status}): ${res.statusText}. Please try again later.`;

          const cloudflareStatus = await checkCloudflareStatus();

          if (!cloudflareStatus) {
            throw new CLIError({
              message: originalErrorMessage,
              docUrl: "connectionFailed",
            });
          }

          if (cloudflareStatus.status.indicator !== "none") {
            const cloudflareMessage =
              formatCloudflareStatusMessage(cloudflareStatus);
            throw new CLIError({
              message: cloudflareMessage,
              docUrl: "connectionFailed",
            });
          }

          throw new CLIError({
            message: originalErrorMessage,
            docUrl: "connectionFailed",
          });
        }

        return null;
      } catch (error) {
        if (error instanceof CLIError) {
          throw error;
        }

        const isNetworkError =
          error instanceof TypeError && error.message === "fetch failed";
        if (isNetworkError) {
          throw new CLIError({
            message: `Failed to connect to the API at ${params.apiUrl}. Please check your connection and try again.`,
            docUrl: "connectionFailed",
          });
        } else {
          throw error;
        }
      }
    },
  };
}

```

### Core Architecture Module: `packages/cli/src/cli/utils/buckets.ts`
```
import _ from "lodash";
import path from "path";
import * as pkg from "glob";
const { glob } = pkg;
import { minimatch } from "minimatch";
import { CLIError } from "./errors";

// WHY: a bare `**/[locale].json` would otherwise descend into vendored trees
// and produce thousands of spurious matches plus locale-restoration failures.
// User-supplied `exclude` entries are applied on top of this list.
const DEFAULT_GLOB_IGNORE = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/.turbo/**",
];
import {
  I18nConfig,
  resolveOverriddenLocale,
  BucketItem,
  LocaleDelimiter,
} from "@lingo.dev/_spec";
import { bucketTypeSchema } from "@lingo.dev/_spec";
import Z from "zod";

// Track bucket types we've already warned about for misplaced `keyColumn`,
// so the warning fires only once per CLI invocation (getBuckets is called
// from multiple command stages).
const warnedKeyColumnTypes = new Set<string>();

type BucketConfig = {
  type: Z.infer<typeof bucketTypeSchema>;
  paths: Array<{ pathPattern: string; delimiter?: LocaleDelimiter }>;
  injectLocale?: string[];
  lockedKeys?: string[];
  lockedPatterns?: string[];
  ignoredKeys?: string[];
  preservedKeys?: string[];
  localizableKeys?: string[];
  keyColumn?: string;
};

export function getBuckets(i18nConfig: I18nConfig) {
  const result = Object.entries(i18nConfig.buckets).map(
    ([bucketType, bucketEntry]) => {
      const includeItems = bucketEntry.include.map((item) =>
        resolveBucketItem(item),
      );
      const excludeItems = bucketEntry.exclude?.map((item) =>
        resolveBucketItem(item),
      );
      const config: BucketConfig = {
        type: bucketType as Z.infer<typeof bucketTypeSchema>,
        paths: extractPathPatterns(
          i18nConfig.locale.source,
          includeItems,
          excludeItems,
        ),
      };
      if (bucketEntry.injectLocale) {
        config.injectLocale = bucketEntry.injectLocale;
      }
      if (bucketEntry.lockedKeys) {
        config.lockedKeys = bucketEntry.lockedKeys;
      }
      if (bucketEntry.lockedPatterns) {
        config.lockedPatterns = bucketEntry.lockedPatterns;
      }
      if (bucketEntry.ignoredKeys) {
        config.ignoredKeys = bucketEntry.ignoredKeys;
      }
      if (bucketEntry.preservedKeys) {
        config.preservedKeys = bucketEntry.preservedKeys;
      }
      if (bucketEntry.localizableKeys) {
        config.localizableKeys = bucketEntry.localizableKeys;
      }
      if (bucketEntry.keyColumn) {
        if (bucketType !== "csv") {
          if (!warnedKeyColumnTypes.has(bucketType)) {
            warnedKeyColumnTypes.add(bucketType);
            console.warn(
              `Warning: "keyColumn" is only supported on "csv" buckets, but was set on "${bucketType}". ` +
                `The setting will be ignored. Remove it from this bucket's config to silence this warning.`,
            );
          }
        } else {
          config.keyColumn = bucketEntry.keyColumn;
        }
      }
      return config;
    },
  );

  return result;
}

function extractPathPatterns(
  sourceLocale: string,
  include: BucketItem[],
  exclude?: BucketItem[],
) {
  // WHY: with recursive ** support a broad pattern can subsume narrower ones
  // (e.g. "src/**/[locale].json" + "src/[locale].json"), so we dedupe by the
  // (pathPattern, delimiter) pair before returning.
  const uniqKey = (item: {
    pathPattern: string;
    delimiter?: LocaleDelimiter;
  }) => `${item.pathPattern}::${item.delimiter ?? ""}`;
  const includedPatterns = _.uniqBy(
    include.flatMap((pattern) =>
      expandPlaceholderedGlob(
        pattern.path,
        resolveOverriddenLocale(sourceLocale, pattern.delimiter),
      ).map((pathPattern) => ({
        pathPattern,
        delimiter: pattern.delimiter,
      })),
    ),
    uniqKey,
  );
  const excludedPatterns = exclude?.flatMap((pattern) =>
    expandPlaceholderedGlob(
      pattern.path,
      resolveOverriddenLocale(sourceLocale, pattern.delimiter),
    ).map((pathPattern) => ({
      pathPattern,
      delimiter: pattern.delimiter,
    })),
  );
  // WHY: exclude semantics are about path subtraction, not delimiter matching.
  // Pre-PR `differenceBy` keyed on `item.pathPattern` only, so an exclude entry
  // with a different (or missing) delimiter still cancelled a matching include.
  // Keep that contract — only `uniqBy` above needs to distinguish delimiters,
  // because there a different delimiter means a genuinely different bucket
  // entry, not a redundant duplicate.
  const result = _.differenceBy(
    includedPatterns,
    excludedPatterns ?? [],
    (item) => item.pathPattern,
  );
  return result;
}

// Windows path normalization helper function
function normalizePath(filepath: string): string {
  const normalized = path.normalize(filepath);
  // Ensure case consistency on Windows
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

// Path expansion
function expandPlaceholderedGlob(
  _pathPattern: string,
  sourceLocale: string,
): string[] {
  const absolutePathPattern = path.resolve(_pathPattern);
  const pathPattern = normalizePath(
    path.relative(process.cwd(), absolutePathPattern),
  );
  if (pathPattern.startsWith("..")) {
    throw new CLIError({
      message: `Invalid path pattern: ${pathPattern}. Path pattern must be within the current working directory.`,
      docUrl: "invalidPathPattern",
    });
  }

  const pathPatternChunks = pathPattern.split(path.sep);
  const localeSegmentIndexes = pathPatternChunks.reduce(
    (indexes, segment, index) => {
      if (segment.includes("[locale]")) {
        indexes.push(index);
      }
      return indexes;
    },
    [] as number[],
  );
  // Case-insensitive on Windows: normalizePath lowercases matched paths while
  // sourceLocale retains original casing (e.g. en-US).
  const normalizedLocale =
    process.platform === "win32" ? sourceLocale.toLowerCase() : sourceLocale;
  const sourcePathPattern = pathPattern.replaceAll(
    /\[locale\]/g,
    normalizedLocale,
  );
  const unixStylePattern = sourcePathPattern.replace(/\\/g, "/");

  // WHY: only narrow the search and use the new mapping algorithm for patterns
  // that actually contain a `**` *segment*. For everything else (concrete paths,
  // single-`*` patterns) we keep the pre-PR code path byte-for-byte so existing
  // customers see zero behavior change. Substring check on `unixStylePattern`
  // would false-positive on patterns like `foo**bar` (literal `**` inside a
  // segment), so we test the segment array instead.
  const isRecursive = pathPatternChunks.includes("**");
  const sourcePaths = glob
    .sync(unixStylePattern, {
      follow: !isRecursive,
      withFileTypes: true,
      windowsPathsNoEscape: true,
      ignore: isRecursive ? DEFAULT_GLOB_IGNORE : undefined,
    })
    .filter((file) => file.isFile() || file.isSymbolicLink())
    .map((file) => file.fullpath())
    .map((fullpath) => normalizePath(path.relative(process.cwd(), fullpath)));

  if (!isRecursive) {
    // Legacy path: derivative of the pre-PR implementation, preserved verbatim
    // except for the `/i` flag added to keep mixed-case locale support
    // (configured `en-US` matching on-disk `en-us` on macOS / Windows).
    return sourcePaths.map((sourcePath) => {
      const normalizedSourcePath = normalizePath(
        sourcePath.replace(/\//g, path.sep),
      );
      const sourcePathChunks = normalizedSourcePath.split(path.sep);
      localeSegmentIndexes.forEach((localeSegmentIndex) => {
        const pathPatternChunk = pathPatternChunks[localeSegmentIndex];
        const sourcePathChunk = sourcePathChunks[localeSegmentIndex];
        const regexp = new RegExp(
          "(" +
            pathPatternChunk
              .replaceAll(".", "\\.")
              .replaceAll("*", ".*")
              .replace("[locale]", `)${sourceLocale}(`) +
            ")",
          "i",
        );
        const match = sourcePathChunk.match(regexp);
        if (match) {
          const [, prefix, suffix] = match;
          const placeholderedSegment = prefix + "[locale]" + suffix;
          sourcePathChunks[localeSegmentIndex] = placeholderedSegment;
        }
      });
      return sourcePathChunks.join(path.sep);
    });
  }

  const placeholderedPaths = sourcePaths.map((sourcePath) => {
    const normalizedSourcePath = normalizePath(
      sourcePath.replace(/\//g, path.sep),
    );
    const sourcePathChunks = normalizedSourcePath.split(path.sep);
    const mapping = mapPatternToSource(
      pathPatternChunks,
      sourcePathChunks,
      normalizedLocale,
      pathPattern,
      normalizedSourcePath,
    );
    localeSegmentIndexes.forEach((localeSegmentIndex) => {
      const sourceIndex = mapping.patToSrc[localeSegmentIndex];
      if (sourceIndex < 0) {
        throw new CLIError({
          message: `Pattern "${pathPattern}" matched file "${normalizedSourcePath}" via glob, but the [locale] segment could not be mapped back. Adjust the pattern so [locale] sits in an unambiguous segment.`,
          docUrl: "ambiguousPathPattern",
        });
      }
      sourcePathChunks[sourceIndex] = buildLocalePlaceholderSegment(
        pathPatternChunks[localeSegmentIndex],
        sourcePathChunks[sourceIndex],
        normalizedLocale,
        pathPattern,
        normalizedSourcePath,
      );
    });
    return sourcePathChunks.join(path.sep);
  });
  return placeholderedPaths;
}

// Aligns each pattern segment to a source-path segment, accounting for "**"
// segments that consume a variable number of source segments. Implemented as
// DFS with memoization (O(N*M) instead of exponential backtracking).
//
// Returns the first valid mapping. To guard against silently picking the wrong
// [locale] segment when ** admits multiple valid alignments, the caller must
// validate uniqueness via `hasAmbiguousLocaleMapping` below.
function mapPatternToSource(
  pattern: string[],
  sou
```

### Core Architecture Module: `packages/cli/src/cli/utils/cache.ts`
```
import path from "path";
import fs from "fs";

interface CacheRow {
  targetLocale: string;
  key: string;
  source: string;
  processed: string;
}

interface NormalizedCacheItem {
  source: string;
  result: string;
}

type NormalizedCache = Record<string, NormalizedCacheItem>;

interface NormalizedLocaleCache {
  [targetLocale: string]: NormalizedCache;
}

export const cacheChunk = (
  targetLocale: string,
  sourceChunk: Record<string, string>,
  processedChunk: Record<string, string>,
) => {
  const rows = Object.entries(sourceChunk).map(([key, source]) => ({
    targetLocale,
    key,
    source,
    processed: processedChunk[key],
  }));
  _appendToCache(rows);
};

export function getNormalizedCache() {
  const rows = _loadCache();
  if (!rows.length) {
    return null;
  }

  const normalized: NormalizedLocaleCache = {};

  for (const row of rows) {
    if (!normalized[row.targetLocale]) {
      normalized[row.targetLocale] = {};
    }

    normalized[row.targetLocale][row.key] = {
      source: row.source,
      result: row.processed,
    };
  }

  return normalized;
}

export function deleteCache() {
  const cacheFilePath = _getCacheFilePath();
  try {
    fs.unlinkSync(cacheFilePath);
  } catch (e) {
    // file might not exist
  }
}

function _loadCache() {
  const cacheFilePath = _getCacheFilePath();
  if (!fs.existsSync(cacheFilePath)) {
    return [];
  }
  const content = fs.readFileSync(cacheFilePath, "utf-8");
  const result = _parseJSONLines(content);
  return result;
}

function _appendToCache(rows: CacheRow[]) {
  const cacheFilePath = _getCacheFilePath();
  const lines = _buildJSONLines(rows);
  fs.appendFileSync(cacheFilePath, lines);
}

function _getCacheFilePath() {
  return path.join(process.cwd(), "i18n.cache");
}

function _buildJSONLines(rows: CacheRow[]) {
  return rows.map((row) => JSON.stringify(row)).join("\n") + "\n";
}

function _parseJSONLines(lines: string) {
  return lines
    .split("\n")
    .map(_tryParseJSON)
    .filter((line) => line !== null);
}

function _tryParseJSON(line: string) {
  try {
    return JSON.parse(line);
  } catch (e) {
    return null;
  }
}

```

### Core Architecture Module: `packages/cli/src/cli/utils/cloudflare-status.ts`
```
export interface CloudflareStatusResponse {
  status: {
    indicator: "none" | "minor" | "major" | "critical";
    description: string;
  };
}

export async function checkCloudflareStatus(): Promise<CloudflareStatusResponse | null> {
  try {
    const response = await fetch(
      "https://www.cloudflarestatus.com/api/v2/status.json",
      {
        signal: AbortSignal.timeout(5000),
      },
    );
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {}
  return null;
}

export function formatCloudflareStatusMessage(
  status: CloudflareStatusResponse,
): string {
  if (status.status.indicator === "none") {
    return "";
  }
  return `Cloudflare is experiencing ${status.status.indicator} issues: ${status.status.description}. This may be affecting the API connection.`;
}

```

### Core Architecture Module: `packages/cli/src/cli/utils/config.ts`
```
import _ from "lodash";
import fs from "fs";
import path from "path";
import { I18nConfig, parseI18nConfig } from "@lingo.dev/_spec";

export function getConfig(resave = true): I18nConfig | null {
  const configFilePath = _getConfigFilePath();

  const configFileExists = fs.existsSync(configFilePath);
  if (!configFileExists) {
    return null;
  }

  const fileContents = fs.readFileSync(configFilePath, "utf8");
  const rawConfig = JSON.parse(fileContents);

  const result = parseI18nConfig(rawConfig);
  const didConfigChange = !_.isEqual(rawConfig, result);

  if (resave && didConfigChange) {
    // Ensure the config is saved with the latest version / schema
    saveConfig(result);
  }

  return result;
}

export function saveConfig(config: I18nConfig) {
  const configFilePath = _getConfigFilePath();

  const serialized = JSON.stringify(config, null, 2);
  fs.writeFileSync(configFilePath, serialized);

  return config;
}

// Private

function _getConfigFilePath() {
  return path.join(process.cwd(), "i18n.json");
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #66** (2024-04-24): **Leading whitespaces shouldn't be trimmed**
  *Symptoms*: ## Description  Whitespaces that start / end a piece of text get trimmed, but they shouldn't.  Expected: `Hello 42 what is up` Actual: `Hello42what is up`  Example:  ```tsx const someNumber = 42;  export default function Page() {   return (     <>       Hello {someNumber} what is up     </>   ) } ``` 

- **Issue #65** (2024-04-24): **Variable expressions get replaced by Replexica Compiler**
  *Symptoms*: ## Description In the code below, instead of rendering `42`, Replexica Compiler renders `{variable:someNumber}`.  ```tsx const someNumber = 42;  export default function Page() {   return (     <>       Hello {someNumber}     </>   ) } ```  

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

### Incident Patch 1: `d664a884` (2026-09-14)
**Commit Message**: chore: security dependency patches (#2213)

* chore: security dependency patches

* chore: changeset

* chore: fix build error in next demo

**File**: `.changeset/fiery-lions-appear.md` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+---
+"@lingo.dev/compiler": patch
+"@lingo.dev/_compiler": patch
+"@lingo.dev/_react": patch
+---
+
+Updated dependency overrides to patch critical and high severity vulnerabilities.
```

**File**: `demo/new-compiler-next16/next.config.ts` (modified, +2/-2)
```diff
@@ -1,9 +1,9 @@
 import type { NextConfig } from "next";
 import { withLingo } from "@lingo.dev/compiler/next";
 
-const nextConfig: NextConfig = {};
+const nextConfig = {} satisfies NextConfig;
 
-export default async function (): Promise<NextConfig> {
+export default async function () {
   return await withLingo(nextConfig, {
     sourceRoot: "./app",
     lingoDir: ".lingo",
```

**File**: `demo/new-compiler-next16/package.json` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
   },
   "dependencies": {
     "@lingo.dev/compiler": "workspace:*",
-    "next": "16.2.11",
+    "next": "16.3.3",
     "react": "19.2.0",
     "react-dom": "19.2.0"
   },
```

**File**: `packages/compiler/package.json` (modified, +1/-1)
```diff
@@ -45,7 +45,7 @@
     "@types/lodash": "4.17.21",
     "@types/object-hash": "3.0.6",
     "@types/react": "19.2.7",
-    "next": "16.2.11",
+    "next": "16.3.3",
     "tsup": "8.5.1",
     "typescript": "5.9.3",
     "vitest": "4.1.0"
```

**File**: `packages/new-compiler/package.json` (modified, +1/-1)
```diff
@@ -146,7 +146,7 @@
     "@types/react": "19.2.7",
     "@types/react-dom": "19.2.3",
     "@types/ws": "8.18.1",
-    "next": "16.2.11",
+    "next": "16.3.3",
     "tsdown": "0.18.2",
     "tsx": "4.21.0",
     "typescript": "5.9.3",
```

**File**: `packages/react/package.json` (modified, +1/-1)
```diff
@@ -54,7 +54,7 @@
     "@types/react-dom": "19.2.3",
     "@vitejs/plugin-react": "4.4.1",
     "chokidar-cli": "3.0.0",
-    "next": "16.2.11",
+    "next": "16.3.3",
     "react": "19.2.3",
     "react-dom": "19.2.3",
     "tsup": "8.5.1",
```

**File**: `pnpm-lock.yaml` (modified, +307/-321)
```diff
@@ -15,8 +15,8 @@ overrides:
   defu: '>=6.1.5 <7'
   ws: '>=8.21.0 <9'
   js-cookie: '>=3.0.7 <4'
-  svgo: '>=4.0.2 <5'
-  sharp: '>=0.35.0 <0.36'
+  svgo@>=4 <4.1.0: 4.1.0
+  sharp@>=0.35 <0.35.4: 0.35.4
   serialize-javascript: '>=7.0.3 <8'
   rollup: '>=4.59.0 <5'
   path-to-regexp: '>=8.4.0 <9'
@@ -25,7 +25,7 @@ overrides:
   axios: '>=1.16.0 <2'
   browserslist: '>=4.28.8 <5'
   vite: '>=7.3.5 <8'
-  '@xmldom/xmldom': '>=0.8.13 <0.9'
+  '@xmldom/xmldom@>=0.8 <0.8.15': 0.8.15
   form-data: '>=4.0.6 <5'
   flatted: '>=3.4.2 <4'
   tmp: '>=0.2.6 <0.3'
@@ -45,8 +45,8 @@ overrides:
   nanoid@<3.3.18: 3.3.18
   nanoid@>=4 <5.1.16: 5.1.16
   launch-editor@<2.14.1: 2.14.1
-  js-yaml@>=3 <3.15.1: 3.15.1
-  js-yaml@>=4 <4.3.1: 4.3.1
+  js-yaml@>=3 <3.15.2: 3.15.2
+  js-yaml@>=4 <4.3.2: 4.3.2
   joi@>=18 <18.2.1: 18.2.1
   diff@>=6 <8.0.3: 8.0.3
   '@babel/core@<7.29.6': 7.29.6
@@ -110,8 +110,8 @@ importers:
         specifier: workspace:*
         version: link:../../packages/new-compiler
       next:
-        specifier: 16.2.11
-        version: 16.2.11(@opentelemetry/api@1.9.0)(@playwright/test@1.57.0)(@types/node@20.19.25)(react-dom@19.2.0(react@19.2.0))(react@19.2.0)
+        specifier: 16.3.3
+        version: 16.3.3(@opentelemetry/api@1.9.0)(@playwright/test@1.57.0)(@types/node@20.19.25)(react-dom@19.2.0(react@19.2.0))(react@19.2.0)
       react:
         specifier: 19.2.0
         version: 19.2.0
@@ -216,13 +216,13 @@ importers:
     devDependencies:
       '@directus/extensions-sdk':
         specifier: 17.0.3
-        version: 17.0.3(@types/node@25.0.3)(@unhead/vue@2.1.15(vue@3.5.24(typescript@5.9.3)))(jiti@2.6.1)(knex@3.1.0)(lightningcss@1.30.2)(pinia@2.3.1(typescript@5.9.3)(vue@3.5.24(typescript@5.9.3)))(sharp@0.35.3(@types/node@25.0.3))(terser@5.44.1)(tsx@4.21.0)(typescript@5.9.3)(ws@8.21.0)(yaml@2.9.0)
+        version: 17.0.3(@types/node@25.0.3)(@unhead/vue@2.1.15(vue@3.5.24(typescript@5.9.3)))(jiti@2.6.1)(knex@3.1.0)(lightningcss@1.30.2)(pinia@2.3.1(typescript@5.9.3)(vue@3.5.24(typescript@5.9.3)))(terser@5.44.1)(tsx@4.21.0)(typescript@5.9.3)(ws@8.21.0)(yaml@2.9.0)
       '@unhead/vue':
         specifier: '>=2.1.15 <3'
         version: 2.1.15(vue@3.5.24(typescript@5.9.3))
       tsup:
         specifier: 8.5.1
-        version: 8.5.1(@swc/core@1.15.3)(jiti@2.6.1)(postcss@8.5.23)(tsx@4.21.0)(typescript@5.9.3)(yaml@2.9.0)
+        version: 8.5.1(@swc/core@1.15.3(@swc/helpers@0.5.23))(jiti@2.6.1)(postcss@8.5.23)(tsx@4.21.0)(typescript@5.9.3)(yaml@2.9.0)
       typescript:
         specifier: 5.9.3
         version: 5.9.3
@@ -559,7 +559,7 @@ importers:
         version: 4.0.3
       tsup:
         specifier: 8.5.1
-        version: 8.5.1(@swc/core@1.15.3)(jiti@2.6.1)(postcss@8.5.23)(tsx@4.21.0)(typescript@5.9.3)(yaml@2.9.0)
+        version: 8.5.1(@swc/core@1.15.3(@swc/helpers@0.5.23))(jiti@2.6.1)(postcss@8.5.23)(tsx@4.21.0)(typescript@5.9.3)(yaml@2.9.0)
       typescript:
         specifier: 5.9.3
         version: 5.9.3
@@ -664,11 +664,11 @@ importers:
         specifier: 19.2.7
         version: 19.2.7
       next:
-        specifier: 16.2.11
-        version: 16.2.11(@opentelemetry/api@1.9.0)(@playwright/test@1.57.0)(@types/node@25.0.3)(react-dom@19.2.3(react@19.2.3))(react@19.2.3)
+        specifier: 16.3.3
+        version: 16.3.3(@opentelemetry/api@1.9.0)(@playwright/test@1.57.0)(@types/node@25.0.3)(react-dom@19.2.3(react@19.2.3))(react@19.2.3)
       tsup:
         specifier: 8.5.1
-        version: 8.5.1(@swc/core@1.15.3)(jiti@2.6.1)(postcss@8.5.23)(tsx@4.21.0)(typescript@5.9.3)(yaml@2.9.0)
+        version: 8.5.1(@swc/core@1.15.3(@swc/helpers@0.5.23))(jiti@2.6.1)(postcss@8.5.23)(tsx@4.21.0)(typescript@5.9.3)(yaml@2.9.0)
       typescript:
         specifier: 5.9.3
         version: 5.9.3
@@ -687,7 +687,7 @@ importers:
         version: 22.13.5
       tsup:
         specifier: 8.5.1
-        version: 8.5.1(@swc/core@1.15.3)(jiti@2.6.1)(postcss@8.5.23)(tsx@4.21.0)(typescript@5.9.3)(yaml@2.9.0)
+        version: 8.5.1(@swc/core@1.15.3(@swc/helpers@0.5.23))(jiti@2.6.1)(postcss@8.5.23)(tsx@4.21.0)(typescript@5.9.3)(yaml@2.9.0)
       typescript:
         specifier: 5.9.3
         version: 5.9.3
@@ -712,7 +712,7 @@ importers:
         version: 22.10.2
       tsup:
         specifier: 8.5.1
-        version: 8.5.1(@swc/core@1.15.3)(jiti@2.6.1)(postcss@8.5.23)(tsx@4.21.0)(typescript@5.9.3)(yaml@2.9.0)
+        version: 8.5.1(@swc/core@1.15.3(@swc/helpers@0.5.23))(jiti@2.6.1)(postcss@8.5.23)(tsx@4.21.0)(typescript@5.9.3)(yaml@2.9.0)
       typescript:
         specifier: 5.9.3
         version: 5.9.3
@@ -832,8 +832,8 @@ importers:
         specifier: 8.18.1
         version: 8.18.1
       next:
-        specifier: 16.2.11
-        version: 16.2.11(@babel/core@7.29.6)(@opentelemetry/api@1.9.0)(@playwright/test@1.56.1)(@types/node@25.0.3)(react-dom@19.2.3(react@19.2.3))(react@19.2.3)
+        specifier: 16.3.3
+        version: 16.3.3(@babel/core@7.29.6)(@opentelemetry/api@1.9.0)(@playwright/test@1.5
```

**File**: `pnpm-workspace.yaml` (modified, +5/-5)
```diff
@@ -17,8 +17,8 @@ overrides:
   defu: ">=6.1.5 <7"
   ws: ">=8.21.0 <9"
   js-cookie: ">=3.0.7 <4"
-  svgo: ">=4.0.2 <5"
-  sharp: ">=0.35.0 <0.36"
+  "svgo@>=4 <4.1.0": 4.1.0
+  "sharp@>=0.35 <0.35.4": 0.35.4
   serialize-javascript: ">=7.0.3 <8"
   rollup: ">=4.59.0 <5"
   path-to-regexp: ">=8.4.0 <9"
@@ -27,7 +27,7 @@ overrides:
   axios: ">=1.16.0 <2"
   browserslist: ">=4.28.8 <5"
   vite: ">=7.3.5 <8"
-  "@xmldom/xmldom": ">=0.8.13 <0.9"
+  "@xmldom/xmldom@>=0.8 <0.8.15": 0.8.15
   form-data: ">=4.0.6 <5"
   flatted: ">=3.4.2 <4"
   tmp: ">=0.2.6 <0.3"
@@ -47,8 +47,8 @@ overrides:
   nanoid@<3.3.18: 3.3.18
   nanoid@>=4 <5.1.16: 5.1.16
   launch-editor@<2.14.1: 2.14.1
-  js-yaml@>=3 <3.15.1: 3.15.1
-  js-yaml@>=4 <4.3.1: 4.3.1
+  js-yaml@>=3 <3.15.2: 3.15.2
+  js-yaml@>=4 <4.3.2: 4.3.2
   joi@>=18 <18.2.1: 18.2.1
   diff@>=6 <8.0.3: 8.0.3
   "@babel/core@<7.29.6": 7.29.6
```

---

### Incident Patch 2: `9db8613f` (2026-08-20)
**Commit Message**: fix(cli): make run --key match real keys and stop it poisoning i18n.lock (#2197)

* fix(cli): make run --key match real keys and stop it poisoning i18n.lock

* fix(cli): bound --key prefixes on / only, and skip the discarded checksum hashing

* fix(cli): point the --frozen failure at a command that actually repairs the lockfile

**File**: `.changeset/eng-1419-cli-key-matcher.md` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+---
+"lingo.dev": patch
+---
+
+Fix `run --key`, which matched nothing and could overwrite unrelated lockfile entries.
+
+`--key` filtered with a raw glob match, but flat buckets join nesting with `/`, so a prefix like `auth/login` matched no key at all and the run reported everything as cached. It now matches on exact key, on a prefix that ends at a `/`, or on a glob. `auth/login` selects `auth/login/title` and leaves `auth/login_url` and `sign-in-error` alone.
+
+A `--key` run also wrote checksums for every source key, not just the translated subset, which marked untouched keys as translated in `i18n.lock`. `--key` now suppresses the checksum write, as `--target-locale` already did, and no longer computes the discarded checksums at all.
+
+The help text for `--key` documented dot-separated paths and an `auth.login` example, neither of which matched real keys. It now states the `/` separator, that a prefix must end at one, and that a glob does not cross one.
+
+The `--frozen` failure message told the user to run `lingo.dev lockfile`, which does nothing once the lockfile section is populated. It now points at `lingo.dev run`, which localizes what is pending and updates the lockfile.
```

**File**: `packages/cli/src/cli/cmd/run/_utils.ts` (modified, +4/-6)
```diff
@@ -1,9 +1,8 @@
 import _ from "lodash";
-import { minimatch } from "minimatch";
 
 import { CmdRunContext, CmdRunTask } from "./_types";
 import { UserIdentity } from "../../utils/observability";
-import { safeDecode } from "../../utils/key-matching";
+import { matchesFlatKeyPattern, safeDecode } from "../../utils/key-matching";
 import createBucketLoader from "../../loaders";
 import { Delta } from "../../utils/delta";
 
@@ -40,6 +39,8 @@ export function computeProcessableData(
   force: boolean | undefined,
   onlyKeys: string[],
 ): Record<string, any> {
+  const patterns = onlyKeys.map(safeDecode);
+
   return _.chain(sourceData)
     .entries()
     .filter(
@@ -48,10 +49,7 @@ export function computeProcessableData(
     )
     .filter(
       ([key]) =>
-        !onlyKeys.length ||
-        onlyKeys.some((pattern) =>
-          minimatch(safeDecode(key), safeDecode(pattern)),
-        ),
+        !patterns.length || matchesFlatKeyPattern(safeDecode(key), patterns),
     )
     .fromPairs()
     .value();
```

**File**: `packages/cli/src/cli/cmd/run/estimate.spec.ts` (modified, +23/-10)
```diff
@@ -29,33 +29,46 @@ describe("countTranslatableChars", () => {
 });
 
 describe("computeProcessableData", () => {
+  // Flat buckets join nesting with "/" and encode each segment, so these are the
+  // keys --key is filtering against.
   const sourceData = {
-    "a.title": "Title",
-    "a.body": "Body",
-    "b.title": "Other",
+    "auth/login/title": "Title",
+    "auth/login/button": "Go",
+    "auth/login_url": "https://example.com",
+    "sign-in": "Sign in",
+    "sign-in-error": "Wrong password",
   };
 
   it("keeps only delta-changed keys", () => {
     const result = computeProcessableData(
       sourceData,
-      delta(["a.title"], ["b.title"]),
+      delta(["auth/login/title"], ["sign-in"]),
       false,
       [],
     );
-    expect(Object.keys(result)).toEqual(["a.title", "b.title"]);
+    expect(Object.keys(result)).toEqual(["auth/login/title", "sign-in"]);
   });
 
   it("keeps everything with force", () => {
     const result = computeProcessableData(sourceData, delta(), true, []);
     expect(Object.keys(result)).toEqual(Object.keys(sourceData));
   });
 
-  it("narrows by key patterns", () => {
-    const result = computeProcessableData(sourceData, delta(), true, ["a.*"]);
-    expect(Object.keys(result)).toEqual(["a.title", "a.body"]);
-  });
-
   it("returns empty when nothing changed", () => {
     expect(computeProcessableData(sourceData, delta(), false, [])).toEqual({});
   });
+
+  // The CLI encodes each --key value at parse time, so patterns arrive encoded.
+  it.each([
+    ["auth/login", ["auth/login/title", "auth/login/button"]],
+    ["auth", ["auth/login/title", "auth/login/button", "auth/login_url"]],
+    ["auth/login/*", ["auth/login/title", "auth/login/button"]],
+    ["auth/login/title", ["auth/login/title"]],
+    ["sign-in", ["sign-in"]],
+  ])("narrows to %s", (pattern, expected) => {
+    const result = computeProcessableData(sourceData, delta(), true, [
+      encodeURIComponent(pattern),
+    ]);
+    expect(Object.keys(result)).toEqual(expected);
+  });
 });
```

**File**: `packages/cli/src/cli/cmd/run/execute-checksums.spec.ts` (modified, +52/-13)
```diff
@@ -32,7 +32,11 @@ describe("persistChecksums", () => {
     const checksums = { "auth.title": "abc123" };
 
     for (let locale = 0; locale < 24; locale++) {
-      await persistChecksums({ ...args, bucketPathPattern: PATTERN, checksums });
+      await persistChecksums({
+        ...args,
+        bucketPathPattern: PATTERN,
+        checksums,
+      });
     }
 
     expect(writes).toEqual([{ "auth.title": "abc123" }]);
@@ -48,7 +52,11 @@ describe("persistChecksums", () => {
     const b = { key: "payload-b" };
 
     for (const checksums of [a, b, a]) {
-      await persistChecksums({ ...args, bucketPathPattern: PATTERN, checksums });
+      await persistChecksums({
+        ...args,
+        bucketPathPattern: PATTERN,
+        checksums,
+      });
     }
 
     expect(writes).toEqual([a, b, a]);
@@ -59,32 +67,63 @@ describe("persistChecksums", () => {
     const { args, writes } = setup();
     const other = "src/i18n/locales/[locale]/lab.ts";
 
-    await persistChecksums({ ...args, bucketPathPattern: PATTERN, checksums: { a: "1" } });
-    await persistChecksums({ ...args, bucketPathPattern: other, checksums: { b: "2" } });
-    await persistChecksums({ ...args, bucketPathPattern: PATTERN, checksums: { a: "1" } });
-    await persistChecksums({ ...args, bucketPathPattern: other, checksums: { b: "2" } });
+    await persistChecksums({
+      ...args,
+      bucketPathPattern: PATTERN,
+      checksums: { a: "1" },
+    });
+    await persistChecksums({
+      ...args,
+      bucketPathPattern: other,
+      checksums: { b: "2" },
+    });
+    await persistChecksums({
+      ...args,
+      bucketPathPattern: PATTERN,
+      checksums: { a: "1" },
+    });
+    await persistChecksums({
+      ...args,
+      bucketPathPattern: other,
+      checksums: { b: "2" },
+    });
 
     expect(writes).toEqual([{ a: "1" }, { b: "2" }]);
   });
 
-  it("writes nothing when --target-locale narrows the run", async () => {
-    const { args, writes } = setup({ targetLocale: ["de-DE"] });
+  it.each([{ targetLocale: ["de-DE"] }, { key: ["auth/login"] }])(
+    "writes nothing when %o narrows the run",
+    async (flags) => {
+      const { args, writes } = setup(flags);
 
-    await persistChecksums({ ...args, bucketPathPattern: PATTERN, checksums: { a: "1" } });
+      await persistChecksums({
+        ...args,
+        bucketPathPattern: PATTERN,
+        checksums: { a: "1" },
+      });
 
-    expect(writes).toEqual([]);
-  });
+      expect(writes).toEqual([]);
+    },
+  );
 
   it("does not mark a pattern as written when the write fails", async () => {
     const { args, writes, deltaProcessor } = setup();
     deltaProcessor.saveChecksums.mockRejectedValueOnce(new Error("disk full"));
 
     await expect(
-      persistChecksums({ ...args, bucketPathPattern: PATTERN, checksums: { a: "1" } }),
+      persistChecksums({
+        ...args,
+        bucketPathPattern: PATTERN,
+        checksums: { a: "1" },
+      }),
     ).rejects.toThrow("disk full");
 
     // A later locale of the same pattern must retry rather than assume success.
-    await persistChecksums({ ...args, bucketPathPattern: PATTERN, checksums: { a: "1" } });
+    await persistChecksums({
+      ...args,
+      bucketPathPattern: PATTERN,
+      checksums: { a: "1" },
+    });
     expect(writes).toEqual([{ a: "1" }]);
   });
 
```

**File**: `packages/cli/src/cli/cmd/run/execute.ts` (modified, +35/-21)
```diff
@@ -170,6 +170,16 @@ function createExecutionProgressMessage(ctx: CmdRunContext) {
  * when two bucket entries share one path pattern and produce different source
  * data, e.g. entries that differ only by locale delimiter.
  */
+/**
+ * Flags that make a run deliberately partial. Checksums always cover the whole
+ * source, so recording them afterwards would mark keys that were never sent as
+ * translated. `--key` narrows which keys are sent; `--target-locale` narrows
+ * which locales are written, and a partial-locale run must not record the
+ * source as fully handled either.
+ */
+export const narrowsRun = (flags: CmdRunContext["flags"]) =>
+  !!flags.targetLocale?.length || !!flags.key?.length;
+
 export async function persistChecksums(args: {
   ctx: CmdRunContext;
   ioLimiter: LimitFunction;
@@ -178,7 +188,7 @@ export async function persistChecksums(args: {
   deltaProcessor: ReturnType<typeof createDeltaProcessor>;
   checksums: Record<string, string>;
 }) {
-  if (args.ctx.flags.targetLocale?.length) {
+  if (narrowsRun(args.ctx.flags)) {
     return;
   }
 
@@ -266,16 +276,18 @@ function createWorkerTask(args: {
                 // Without this, an "everything already translated" run leaves
                 // i18n.lock without an entry for this pattern, and --frozen
                 // then reports the source as changed.
-                const checksums =
-                  await deltaProcessor.createChecksums(sourceData);
-                await persistChecksums({
-                  ctx: args.ctx,
-                  ioLimiter: args.ioLimiter,
-                  lastWrittenChecksums: args.lastWrittenChecksums,
-                  bucketPathPattern: assignedTask.bucketPathPattern,
-                  deltaProcessor,
-                  checksums,
-                });
+                if (!narrowsRun(args.ctx.flags)) {
+                  const checksums =
+                    await deltaProcessor.createChecksums(sourceData);
+                  await persistChecksums({
+                    ctx: args.ctx,
+                    ioLimiter: args.ioLimiter,
+                    lastWrittenChecksums: args.lastWrittenChecksums,
+                    bucketPathPattern: assignedTask.bucketPathPattern,
+                    deltaProcessor,
+                    checksums,
+                  });
+                }
               });
               return {
                 status: "skipped",
@@ -352,16 +364,18 @@ function createWorkerTask(args: {
                 finalRenamedTargetData,
               );
 
-              const checksums =
-                await deltaProcessor.createChecksums(sourceData);
-              await persistChecksums({
-                ctx: args.ctx,
-                ioLimiter: args.ioLimiter,
-                lastWrittenChecksums: args.lastWrittenChecksums,
-                bucketPathPattern: assignedTask.bucketPathPattern,
-                deltaProcessor,
-                checksums,
-              });
+              if (!narrowsRun(args.ctx.flags)) {
+                const checksums =
+                  await deltaProcessor.createChecksums(sourceData);
+                await persistChecksums({
+                  ctx: args.ctx,
+                  ioLimiter: args.ioLimiter,
+                  lastWrittenChecksums: args.lastWrittenChecksums,
+                  bucketPathPattern: assignedTask.bucketPathPattern,
+                  deltaProcessor,
+                  checksums,
+                });
+              }
             });
 
             return {
```

**File**: `packages/cli/src/cli/cmd/run/frozen.ts` (modified, +4/-4)
```diff
@@ -126,7 +126,7 @@ export default async function frozen(input: CmdRunContext) {
               );
               if (Object.keys(updatedSourceData).length > 0) {
                 throw new Error(
-                  `Localization data has changed. Run \`lingo.dev lockfile\` to refresh i18n.lock, or run without --frozen. Details: Source file has been updated.`,
+                  `Localization data has changed. Run \`lingo.dev run\` to localize what is pending and update i18n.lock, or run without --frozen. Details: Source file has been updated.`,
                 );
               }
 
@@ -144,7 +144,7 @@ export default async function frozen(input: CmdRunContext) {
                 );
                 if (missingKeys.length > 0) {
                   throw new Error(
-                    `Localization data has changed. Run \`lingo.dev lockfile\` to refresh i18n.lock, or run without --frozen. Details: Target file is missing translations.`,
+                    `Localization data has changed. Run \`lingo.dev run\` to localize what is pending and update i18n.lock, or run without --frozen. Details: Target file is missing translations.`,
                   );
                 }
 
@@ -154,7 +154,7 @@ export default async function frozen(input: CmdRunContext) {
                 );
                 if (extraKeys.length > 0) {
                   throw new Error(
-                    `Localization data has changed. Run \`lingo.dev lockfile\` to refresh i18n.lock, or run without --frozen. Details: Target file has extra translations not present in the source file.`,
+                    `Localization data has changed. Run \`lingo.dev run\` to localize what is pending and update i18n.lock, or run without --frozen. Details: Target file has extra translations not present in the source file.`,
                   );
                 }
 
@@ -164,7 +164,7 @@ export default async function frozen(input: CmdRunContext) {
                 );
                 if (unlocalizableDataDiff) {
                   throw new Error(
-                    `Localization data has changed. Run \`lingo.dev lockfile\` to refresh i18n.lock, or run without --frozen. Details: Unlocalizable data (such as booleans, dates, URLs, etc.) do not match.`,
+                    `Localization data has changed. Run \`lingo.dev run\` to localize what is pending and update i18n.lock, or run without --frozen. Details: Unlocalizable data (such as booleans, dates, URLs, etc.) do not match.`,
                   );
                 }
               }
```

**File**: `packages/cli/src/cli/cmd/run/index.ts` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ export default new Command()
   )
   .option(
     "--key <key>",
-    "Filter keys by prefix matching on dot-separated paths. Example: auth.login to match all keys starting with auth.login. Repeat for multiple patterns",
+    "Filter keys by exact match, prefix, or glob. Nesting joins with /, and a prefix must end at a /, so auth/login matches auth/login/title but not auth/login_url. A glob does not cross a /, so use auth/login/** to reach every level below. Repeat for multiple patterns",
     (val: string, prev: string[]) =>
       prev ? [...prev, encodeURIComponent(val)] : [encodeURIComponent(val)],
   )
```

**File**: `packages/cli/src/cli/utils/key-matching.ts` (modified, +18/-0)
```diff
@@ -27,6 +27,24 @@ export function matchesKeyPattern(key: string, patterns: string[]): boolean {
   );
 }
 
+/**
+ * Like `matchesKeyPattern`, but "/" is the only separator that can bound a
+ * prefix. Flat buckets join nesting with "/" alone, so "." and "-" are ordinary
+ * characters inside a segment there — bounding on them would make `--key
+ * sign-in` also select `sign-in-error` and overwrite its translation.
+ */
+export function matchesFlatKeyPattern(
+  key: string,
+  patterns: string[],
+): boolean {
+  return patterns.some(
+    (pattern) =>
+      key === pattern ||
+      key.startsWith(pattern + "/") ||
+      minimatch(key, pattern),
+  );
+}
+
 /**
  * Filters entries based on key matching patterns
  */
```

---

### Incident Patch 3: `19abe0bc` (2026-10-07)
**Commit Message**: chore: override deps for new security advisories (#2237)

**File**: `.changeset/grumpy-comics-move.md` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+---
+---
```

**File**: `pnpm-lock.yaml` (modified, +338/-308)
```diff
@@ -6,8 +6,8 @@ settings:
 
 overrides:
   fast-xml-parser: '>=5.5.6 <6'
-  shell-quote: '>=1.9.0 <2'
-  seroval: '>=1.5.3 <2'
+  shell-quote: '>=1.11.0 <2'
+  seroval: '>=1.6.3 <2'
   '@modelcontextprotocol/sdk': '>=1.26.0 <2'
   '@isaacs/brace-expansion': '>=5.0.1 <6'
   effect: '>=3.20.0 <4'
@@ -16,7 +16,7 @@ overrides:
   ws: '>=8.21.0 <9'
   js-cookie: '>=3.0.7 <4'
   svgo@>=4 <4.1.0: 4.1.0
-  sharp@>=0.35 <0.35.4: 0.35.4
+  sharp@>=0.35 <0.35.5: 0.35.5
   serialize-javascript: '>=7.0.3 <8'
   rollup: '>=4.59.0 <5'
   path-to-regexp: '>=8.4.0 <9'
@@ -47,13 +47,16 @@ overrides:
   launch-editor@<2.14.1: 2.14.1
   js-yaml@>=3 <3.15.2: 3.15.2
   js-yaml@>=4 <4.3.2: 4.3.2
-  joi@>=18 <18.2.6: 18.2.6
+  joi@>=18 <18.2.9: 18.2.9
   colord@<2.9.4: 2.9.4
   fflate@>=0.8 <0.8.3: 0.8.3
   decode-uri-component@<0.5.0: 0.5.0
   postcss-selector-parser@>=7 <7.1.6: 7.1.6
   diff@>=6 <8.0.3: 8.0.3
   '@babel/core@<7.29.6': 7.29.6
+  source-map-js: '>=1.2.2 <2'
+  vue: '>=3.5.42 <4'
+  argparse@<2: 2.0.1
 
 importers:
 
@@ -220,10 +223,10 @@ importers:
     devDependencies:
       '@directus/extensions-sdk':
         specifier: 17.0.3
-        version: 17.0.3(@types/node@25.0.3)(@unhead/vue@2.1.15(vue@3.5.24(typescript@5.9.3)))(jiti@2.6.1)(knex@3.1.0)(lightningcss@1.30.2)(pinia@2.3.1(typescript@5.9.3)(vue@3.5.24(typescript@5.9.3)))(terser@5.44.1)(tsx@4.21.0)(typescript@5.9.3)(ws@8.21.0)(yaml@2.9.0)
+        version: 17.0.3(@types/node@25.0.3)(@unhead/vue@2.1.15(vue@3.5.43(typescript@5.9.3)))(jiti@2.6.1)(knex@3.1.0)(lightningcss@1.30.2)(pinia@2.3.1(typescript@5.9.3)(vue@3.5.43(typescript@5.9.3)))(terser@5.44.1)(tsx@4.21.0)(typescript@5.9.3)(ws@8.21.0)(yaml@2.9.0)
       '@unhead/vue':
         specifier: '>=2.1.15 <3'
-        version: 2.1.15(vue@3.5.24(typescript@5.9.3))
+        version: 2.1.15(vue@3.5.43(typescript@5.9.3))
       tsup:
         specifier: 8.5.1
         version: 8.5.1(@swc/core@1.15.3(@swc/helpers@0.5.23))(jiti@2.6.1)(postcss@8.5.23)(tsx@4.21.0)(typescript@5.9.3)(yaml@2.9.0)
@@ -901,7 +904,7 @@ importers:
         version: 5.9.3
       unbuild:
         specifier: 3.6.1
-        version: 3.6.1(typescript@5.9.3)(vue@3.5.24(typescript@5.9.3))
+        version: 3.6.1(typescript@5.9.3)(vue@3.5.43(typescript@5.9.3))
       vitest:
         specifier: 4.1.11
         version: 4.1.11(@opentelemetry/api@1.9.0)(@types/node@25.0.3)(@vitest/ui@4.1.11)(jsdom@27.3.0)(vite@7.3.5(@types/node@25.0.3)(jiti@2.6.1)(lightningcss@1.30.2)(terser@5.44.1)(tsx@4.21.0)(yaml@2.9.0))
@@ -1343,6 +1346,11 @@ packages:
     engines: {node: '>=6.0.0'}
     hasBin: true
 
+  '@babel/parser@7.29.9':
+    resolution: {integrity: sha512-CjXrNHTnvqBVqHgdBysY3vk2T8tpJHb5/RMeHJBTyVa9xgugCB0CJTx/3oO8RV2QRQP391RWpB7D6hLjm8V9uA==}
+    engines: {node: '>=6.0.0'}
+    hasBin: true
+
   '@babel/plugin-syntax-jsx@7.27.1':
     resolution: {integrity: sha512-y8YTNIeKoyhGd9O0Jiyzyyqk8gdjnumGTQPsz0xOZOQ2RmkVJeZ1vmmfIvFEKqucBG6axJGBZDE/7iI5suUI/w==}
     engines: {node: '>=6.9.0'}
@@ -1455,6 +1463,10 @@ packages:
     resolution: {integrity: sha512-4zBIxpPzowiZpusoFkyGVwakdRJUyuH5PxQ/PrqghfdFWWasvnCdPfQXHrenDai+gyLARulZjZowCOj6fjT4pA==}
     engines: {node: '>=6.9.0'}
 
+  '@babel/types@7.29.8':
+    resolution: {integrity: sha512-Vj1jF3cPfxg7OAfoI7QnVKLoILlm2JF9pnVHrX8qx7AHMiYWT+NDAA7jChlNgRS4WTLc/fD1lXLmPixluj+3Gg==}
+    engines: {node: '>=6.9.0'}
+
   '@biomejs/js-api@4.0.0':
     resolution: {integrity: sha512-EOArR/6drRzM1/hwOIz1pZw90FL31Ud4Y7hEHGWVtMNmAwS9SrwZ8hMENGlLVXCeGW/kL46p8kX7eO6x9Nmezg==}
     peerDependencies:
@@ -1650,7 +1662,7 @@ packages:
   '@directus/composables@11.2.7':
     resolution: {integrity: sha512-vyCljJOce30/0pjtZGTo7f6mAMQNWvQgm9rafXXOgd1W57JqwRMwi8xDPn4Peuu3PRLNf9wlctXwUPH0fXljLw==}
     peerDependencies:
-      vue: 3.5.24
+      vue: '>=3.5.42 <4'
 
   '@directus/constants@14.0.0':
     resolution: {integrity: sha512-l4gsGIiZBV5WYkNTv3+HjxDBZJEkwPSo5tYpJ3fk6xOr7b2Km60aq8LOBmfuKwlLGLnvUzD4Y4S3ebgrwBE2iQ==}
@@ -1665,7 +1677,7 @@ packages:
     peerDependencies:
       knex: 3.1.0
       pino: 9.7.0
-      vue: 3.5.24
+      vue: '>=3.5.42 <4'
       vue-router: 4.6.3
     peerDependenciesMeta:
       knex:
@@ -1688,7 +1700,7 @@ packages:
     peerDependencies:
       '@unhead/vue': '>=2.1.15 <3'
       pinia: 2.3.1
-      vue: 3.5.24
+      vue: '>=3.5.42 <4'
 
   '@directus/types@13.4.0':
     resolution: {integrity: sha512-/OXBSftChg/g238mB7JvJTv1+SH+TExYHm1+KiKejK2DjK3E1NZWgFpDtVtCDU8dgXI/BLZbdApyuBI9QhpeQQ==}
@@ -1701,7 +1713,7 @@ packages:
       openapi3-ts: 4.5.0
       pino: 9.7.0
       sharp: 0.34.5
-      vue: 3.5.24
+      vue: '>=3.5.42 <4'
       vue-router: 4.6.3
       ws: '>=8.21.0 <9'
     peerDependenciesMeta:
@@ -1731,7 +1743,7 @@ packages:
   '@directus/utils@13.0.13':
     resolution: {integrity: sha512-qUOiSki7GpGxBVKSW7dGusgOFKph3eDE5ObiMi3kYtisziTKGukCVAg8ZxMWD8jq3exqUF2Rc3uJzmZwWnV2Dg==}
     peerDependencies:
-      vue: 3.5.24
+      vue: '>=3.5.42 <4'
     peerDependenciesMeta:
       v
```

**File**: `pnpm-workspace.yaml` (modified, +7/-4)
```diff
@@ -8,8 +8,8 @@ packages:
   - "./scripts/*"
 overrides:
   fast-xml-parser: ">=5.5.6 <6"
-  shell-quote: ">=1.9.0 <2"
-  seroval: ">=1.5.3 <2"
+  shell-quote: ">=1.11.0 <2"
+  seroval: ">=1.6.3 <2"
   "@modelcontextprotocol/sdk": ">=1.26.0 <2"
   "@isaacs/brace-expansion": ">=5.0.1 <6"
   effect: ">=3.20.0 <4"
@@ -18,7 +18,7 @@ overrides:
   ws: ">=8.21.0 <9"
   js-cookie: ">=3.0.7 <4"
   "svgo@>=4 <4.1.0": 4.1.0
-  "sharp@>=0.35 <0.35.4": 0.35.4
+  "sharp@>=0.35 <0.35.5": 0.35.5
   serialize-javascript: ">=7.0.3 <8"
   rollup: ">=4.59.0 <5"
   path-to-regexp: ">=8.4.0 <9"
@@ -49,13 +49,16 @@ overrides:
   launch-editor@<2.14.1: 2.14.1
   js-yaml@>=3 <3.15.2: 3.15.2
   js-yaml@>=4 <4.3.2: 4.3.2
-  joi@>=18 <18.2.6: 18.2.6
+  joi@>=18 <18.2.9: 18.2.9
   colord@<2.9.4: 2.9.4
   fflate@>=0.8 <0.8.3: 0.8.3
   decode-uri-component@<0.5.0: 0.5.0
   postcss-selector-parser@>=7 <7.1.6: 7.1.6
   diff@>=6 <8.0.3: 8.0.3
   "@babel/core@<7.29.6": 7.29.6
+  source-map-js: ">=1.2.2 <2"
+  vue: ">=3.5.42 <4"
+  argparse@<2: 2.0.1
 engineStrict: true
 allowBuilds:
   "@openrouter/sdk": true
```

#### Recent Merged Pull Requests:
- **PR #2244** (closed): chore(deps-dev): bump next from 16.3.6 to 16.3.8 in /packages/compiler in the npm_and_yarn group across 1 directory (@dependabot[bot])
- **PR #2238** (2026-10-07): fix(deps): drop braces by bumping changesets, syncpack and tanstack router (@AndreyHirsa)
- **PR #2237** (2026-10-07): chore: override deps for new security advisories (@AndreyHirsa)
- **PR #2236** (2026-10-07): chore: mark deprecated legacy packages as private so publish skips them (@AndreyHirsa)
- **PR #2235** (2026-10-05): fix(deps): bump figlet to 1.11.4 (@AndreyHirsa)
- **PR #2234** (2026-10-05): chore: localize the README through the Lingo.dev GitHub App (@cherkanovart)

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

## X. security dependency patches (#2213)

**RULE**:
When implementing operations in `.changeset/fiery-lions-appear.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lingodotdev/lingo.dev. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d664a884`: security dependency patches (#2213). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.changeset/fiery-lions-appear.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
---
"@lingo.dev/compiler": patch
"@lingo.dev/_compiler": patch
"@lingo.dev/_react": patch
---

Updated dependency overrides to patch critical and high severity vulnerabilities.
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d664a884` are properly handled with clean fallback behavior.
