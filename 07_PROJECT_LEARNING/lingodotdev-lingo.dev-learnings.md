# Forensic Learning Record (Deep Inspection): lingodotdev/lingo.dev

> **Canonical Artifact**: `07_PROJECT_LEARNING/lingodotdev-lingo.dev-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lingodotdev/lingo.dev](https://github.com/lingodotdev/lingo.dev))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:03:01.852Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lingodotdev/lingo.dev`
- **Description**: Open-source localization engineering tools. Connects to Lingo.dev localization engineering platform for consistent, quality translations.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, Dockerfile
- **Stars / Engagement**: 5405 stars

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

### Core Architecture Module: `packages/cli/src/cli/utils/delta.ts`
```
import _ from "lodash";
import z from "zod";
import { md5 } from "./md5";
import { tryReadFile, writeFile, checkIfFileExists } from "../utils/fs";
import * as path from "path";
import YAML from "yaml";
import { deduplicateLockfileYaml } from "./lockfile";

const LockSchema = z.object({
  version: z.literal(1).prefault(1),
  checksums: z
    .record(
      z.string(), // localizable files' keys
      // checksums hashmap
      z
        .record(
          // key
          z.string(),
          // checksum of the key's value in the source locale
          z.string(),
        )
        .prefault({}),
    )
    .prefault({}),
});
export type LockData = z.infer<typeof LockSchema>;

export type Delta = {
  added: string[];
  removed: string[];
  updated: string[];
  renamed: [string, string][];
  hasChanges: boolean;
};

export function createDeltaProcessor(fileKey: string) {
  const lockfilePath = path.join(process.cwd(), "i18n.lock");
  return {
    async checkIfLockExists() {
      return checkIfFileExists(lockfilePath);
    },
    async calculateDelta(params: {
      sourceData: Record<string, any>;
      targetData: Record<string, any>;
      checksums: Record<string, string>;
    }): Promise<Delta> {
      let added = _.difference(
        Object.keys(params.sourceData),
        Object.keys(params.targetData),
      );
      let removed = _.difference(
        Object.keys(params.targetData),
        Object.keys(params.sourceData),
      );
      const updated = Object.keys(params.sourceData).filter(
        (key) =>
          md5(params.sourceData[key]) !== params.checksums[key] &&
          params.checksums[key],
      );

      const renamed: [string, string][] = [];
      for (const addedKey of added) {
        const addedHash = md5(params.sourceData[addedKey]);
        for (const removedKey of removed) {
          if (params.checksums[removedKey] === addedHash) {
            renamed.push([removedKey, addedKey]);
            break;
          }
        }
      }
      added = added.filter(
        (key) => !renamed.some(([oldKey, newKey]) => newKey === key),
      );
      removed = removed.filter(
        (key) => !renamed.some(([oldKey, newKey]) => oldKey === key),
      );

      const hasChanges = [
        added.length > 0,
        removed.length > 0,
        updated.length > 0,
        renamed.length > 0,
      ].some((v) => v);

      return {
        added,
        removed,
        updated,
        renamed,
        hasChanges,
      };
    },
    async loadLock() {
      const lockfileContent = tryReadFile(lockfilePath, null);

      if (!lockfileContent) {
        return {
          version: 1,
          checksums: {},
        } as const;
      }

      // Fast path: a lockfile the CLI itself wrote always parses directly.
      // Deduplication costs a full CST parse plus a re-serialization of the
      // whole file, and it only ever repairs a hand-merged lockfile - exactly
      // the case `YAML.parse` refuses to parse. So try the cheap parse first
      // and fall back to the repair path on any failure.
      try {
        return LockSchema.parse(YAML.parse(lockfileContent));
      } catch {
        // Malformed or hand-merged lockfile - repair it below.
      }

      // Deduplicate using the universal function
      const { deduplicatedContent, duplicatesRemoved } = deduplicateLockfileYaml(lockfileContent);

      // Write back to disk if duplicates were found
      if (duplicatesRemoved > 0) {
        writeFile(lockfilePath, deduplicatedContent);
        console.log(
          `Removed ${duplicatesRemoved} duplicate ${duplicatesRemoved === 1 ? "entry" : "entries"} from i18n.lock`,
        );
      }

      const parsed = LockSchema.parse(YAML.parse(deduplicatedContent));
      return parsed;
    },
    async saveLock(lockData: LockData) {
      const lockfileYaml = YAML.stringify(lockData);
      writeFile(lockfilePath, lockfileYaml);
    },
    async loadChecksums() {
      const id = md5(fileKey);
      const lockfileData = await this.loadLock();
      const checksums = lockfileData.checksums as Record<string, Record<string, string>>;
      return checksums[id] || {};
    },
    async saveChecksums(checksums: Record<string, string>) {
      const id = md5(fileKey);
      const lockfileData = await this.loadLock();
      const lockChecksums = lockfileData.checksums as Record<string, Record<string, string>>;
      lockChecksums[id] = checksums;
      await this.saveLock(lockfileData);
    },
    async createChecksums(sourceData: Record<string, any>) {
      const checksums = _.mapValues(sourceData, (value) => md5(value));
      return checksums;
    },
  };
}

```

### Core Architecture Module: `packages/cli/src/cli/utils/element-extraction.ts`
```
import { Element } from "domhandler";
import * as domutils from "domutils";

/**
 * SVG tags that contain translatable content.
 * All other SVG elements should be excluded from translation.
 *
 * @see https://www.w3.org/TR/SVG/text.html
 */
export const SVG_TRANSLATABLE_TAGS = new Set([
  "title",
  "text",
  "desc",
]) as ReadonlySet<string>;

/**
 * Based on WHATWG HTML spec: https://html.spec.whatwg.org/multipage/indices.html
 * Phrasing content = inline elements that should be preserved within text
 */
export const PHRASING_ELEMENTS = new Set([
  // Text-level semantics
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "br",
  "cite",
  "code",
  "data",
  "dfn",
  "em",
  "i",
  "kbd",
  "mark",
  "q",
  "ruby",
  "s",
  "samp",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "time",
  "u",
  "var",
  "wbr",
  // Media
  "audio",
  "img",
  "video",
  "picture",
  // Interactive
  "button",
  "input",
  "label",
  "select",
  "textarea",
  // Embedded
  "canvas",
  "iframe",
  "object",
  "svg",
  "math",
  // Other
  "del",
  "ins",
  "map",
  "area",
]) as ReadonlySet<string>;

/**
 * Block elements create translation boundaries.
 */
export const BLOCK_ELEMENTS = new Set([
  "div",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "blockquote",
  "pre",
  "article",
  "aside",
  "nav",
  "section",
  "header",
  "footer",
  "main",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
  "caption",
  "form",
  "fieldset",
  "legend",
  "details",
  "summary",
  "address",
  "hr",
  "search",
  "dialog",
  "noscript",
  "title",
]) as ReadonlySet<string>;

/**
 * Tags whose content should never be translated.
 */
export const UNLOCALIZABLE_TAGS = new Set([
  "script",
  "style",
]) as ReadonlySet<string>;

/**
 * Base localizable attributes for HTML elements.
 * Loaders can extend this with additional attributes.
 */
export const BASE_LOCALIZABLE_ATTRIBUTES: Record<string, string[]> = {
  meta: ["content"],
  img: ["alt", "title"],
  input: ["placeholder", "title"],
  textarea: ["placeholder", "title"],
  a: ["title"],
  abbr: ["title"],
  button: ["title"],
  link: ["title"],
};

/**
 * Check if element is inside an unlocalizable tag.
 */
export function isInsideUnlocalizableTag(
  element: Element,
  unlocalizableTags: ReadonlySet<string> = UNLOCALIZABLE_TAGS,
): boolean {
  let current = element.parent;
  while (current && current.type === "tag") {
    if (unlocalizableTags.has((current as Element).name.toLowerCase())) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/**
 * Check if element contains any translatable text (not just whitespace).
 */
export function hasTranslatableContent(element: Element): boolean {
  const text = domutils.textContent(element);
  return text.trim().length > 0;
}

/**
 * Check if element is a "leaf" block (contains text with inline elements, not nested blocks).
 */
export function isLeafBlock(
  element: Element,
  blockElements: ReadonlySet<string> = BLOCK_ELEMENTS,
): boolean {
  const childElements = element.children.filter(
    (child): child is Element => child.type === "tag",
  );
  for (const child of childElements) {
    if (blockElements.has(child.name.toLowerCase())) {
      return false;
    }
  }
  return hasTranslatableContent(element);
}

/**
 * Strategy for handling SVG elements during extraction.
 */
export type SvgExtractionStrategy =
  | "extract" // Element is translatable - extract its content
  | "skip-recurse" // Element is not translatable - skip but recurse into children
  | "process-normal"; // Element is not in SVG context - use normal extraction

/**
 * Check if an element is nested inside an SVG element by traversing up the DOM tree.
 *
 * @param element - The DOM element to check
 * @returns True if any ancestor is an <svg> tag, false otherwise
 *
 * @example
 * // <svg><text>Hello</text></svg>
 * isInsideSvg(textElement) // returns true
 */
function isInsideSvg(element: Element): boolean {
  let current = element.parent;
  while (current && current.type === "tag") {
    if (current.name.toLowerCase() === "svg") {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/**
 * Check if an element contains an SVG descendant (recursive).
 * Used to determine if we should recurse into an element rather than extracting it as a whole.
 *
 * @param element - The DOM element to check
 * @returns True if any descendant is an <svg> tag, false otherwise
 */
function containsSvgDescendant(element: Element): boolean {
  const childElements = element.children.filter(
    (child): child is Element => child.type === "tag",
  );
  for (const child of childElements) {
    if (child.name.toLowerCase() === "svg") {
      return true;
    }
    if (containsSvgDescendant(child)) {
      return true;
    }
  }
  return false;
}

/**
 * Determines the extraction strategy for an SVG element.
 * Consolidates all SVG-specific logic into a single decision function.
 *
 * @param element - The DOM element to evaluate
 * @returns The extraction strategy to apply:
 *   - "extract": Element is translatable (title/text/desc inside SVG) - extract content
 *   - "skip-recurse": Element is non-translatable SVG element - skip but recurse into children
 *   - "process-normal": Element is not in SVG context - use normal extraction logic
 *
 * @example
 * // <svg><title>Chart</title><rect/></svg>
 * getSvgExtractionStrategy(titleElement) // returns "extract"
 * getSvgExtractionStrategy(rectElement)  // returns "skip-recurse"
 * getSvgExtractionStrategy(svgElement)   // returns "skip-recurse"
 */
export function getSvgExtractionStrategy(
  element: Element,
): SvgExtractionStrategy {
  const tagName = element.name.toLowerCase();

  // SVG element itself should be skipped but children should be processed
  if (tagName === "svg") {
    return "skip-recurse";
  }

  // Check if element is inside an SVG context
  const inSvg = isInsideSvg(element);
  if (!inSvg) {
    return "process-normal";
  }

  // Inside SVG - only extract translatable tags, skip others
  return SVG_TRANSLATABLE_TAGS.has(tagName) ? "extract" : "skip-recurse";
}

/**
 * Context-specific functions for extraction.
 * Only includes functions that differ between loaders.
 */
export interface ExtractionContext {
  /**
   * Get the innerHTML of an element (serialized children).
   * This may include format-specific processing (e.g., Twig restoration).
   */
  getInnerHTML: (element: Element) => string;

  /**
   * Extract localizable attributes from element.
   * This may include format-specific processing (e.g., Twig restoration).
   */
  extractAttributes: (element: Element, path: string) => void;
}

/**
 * Creates a reusable extraction function that can be shared across loaders.
 * Uses the shared BLOCK_ELEMENTS, PHRASING_ELEMENTS, and UNLOCALIZABLE_TAGS constants.
 *
 * @param context - Loader-specific context functions (getInnerHTML, extractAttributes)
 * @param result - Output object to store extracted content
 * @returns A function that recursively extracts translatable content from the DOM
 *
 * @example
 * const extractFromElement = createElementExtractor(context, result);
 * extractFromElement(rootElement, ["body", 0]);
 */
export function createElementExtractor(
  context: ExtractionContext,
  result: Record<string, string>,
) {
  /**
   * Recursively extracts translation units from element tree.
   * Handles SVG filtering, block/phrasing elements, and attributes.
   */
  function extractFromElement(
    element: Element,
    pathParts: (string | number)[],
  ): void {
    const path = pathParts.join("/");
    const tagName = element.name.toLowerCase();

    // Skip if inside unlocalizable tag
    if (isInsideUnlocalizableTag(element)) {
      return;
    }

    // Extract localizable attributes
    context.extractAttributes(element, path);

    // Handle SVG elements using strategy pattern
    const svgStrategy = getSvgExtractionStrategy(element);

    if (svgStrategy === "extract") {
      // SVG translatable element (<title>, <text>, <desc>)
      const content = context.getInnerHTML(element).trim();
      if (content) {
        result[path] = content;
      }
      return;
    }

    if (svgStrategy === "skip-recurse") {
      // SVG non-translatable element - skip but recurse into children
      let childIndex = 0;
      const childElements = element.children.filter(
        (child): child is Element => child.type === "tag",
      );
      for (const child of childElements) {
        extractFromElement(child, [...pathParts, childIndex++]);
      }
      return;
    }

    // svgStrategy === "process-normal" - use normal extraction logic

    // If this is a leaf block element (contains text but no nested blocks), extract it
    // But NOT if it contains SVG - in that case, recurse to handle SVG separately
    if (
      BLOCK_ELEMENTS.has(tagName) &&
      isLeafBlock(element) &&
      !containsSvgDescendant(element)
    ) {
      const content = context.getInnerHTML(element).trim();
      if (content) {
        result[path] = content;
      }
      // Don't recurse into children - innerHTML captures everything
      return;
    }

    // If this is a standalone phrasing element with text content, extract it
    // But NOT if it contains SVG - in that case, recurse to handle SVG separately
    if (
      PHRASING_ELEMENTS.has(tagName) &&
      hasTranslatableContent(element) &&
      !containsSvgDescendant(element)
    ) {
      const content = context.getInnerHTML(element).trim();
      if (content) {
        result[path] = content;
      }
      // Don't recurse - innerHTML captures everything
      return;
    }

    // For structural/container elements, recurse into children
    let childIndex = 0;
    const childElements = element.children.filter(
      (child): child is Element => child.type === "tag",
    );
    for (const child of childElements) {
    
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #66** (2024-04-24): **Leading whitespaces shouldn't be trimmed**
  *Symptoms*: ## Description  Whitespaces that start / end a piece of text get trimmed, but they shouldn't.  Expected: `Hello 42 what is up` Actual: `Hello42what is up`  Example:  ```tsx const someNumber = 42;  export default function Page() {   return (     <>       Hello {someNumber} what is up     </>   ) } ``` 

- **Issue #65** (2024-04-24): **Variable expressions get replaced by Replexica Compiler**
  *Symptoms*: ## Description In the code below, instead of rendering `42`, Replexica Compiler renders `{variable:someNumber}`.  ```tsx const someNumber = 42;  export default function Page() {   return (     <>       Hello {someNumber}     </>   ) } ```  

- **Issue #64** (2024-04-24): **Support for shadcn/ui components**
  *Symptoms*: ## Description The following shadcn/ui components don't get fully transpiled (hence translated) by Replexica Compiler:  ```tsx import CtaReviews from "@/components/CtaReviews";  export default function Page() {   return (     <>       <div>ShadcnUI Page</div>       <br />       <p className="leading-normal text-muted-foreground sm:text-xl sm:leading-8">         <Highlight>Chrome Extension</Highlight> —{" "}         <Highlight>Save Time</Highlight> and{" "}         <Highlight>Gain Insights</Highlight> Effortlessly       </p>       <br />       <CtaReviews maxReviews={5} reviews={[]} />     </>   ) }  function Highlight({ children }: any) {   return <span className="text-yellow-400">{children}</span> } ```  ```tsx "use client"  import { useEffect, useState } from "react" import { cn } from "@/lib/utils" import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"  type CtaReviewsProps = {   reviews: any[]   maxReviews?: number }  export default function CtaReviews({   reviews,   maxReviews = 5, }: CtaReviewsProps) {   const [randomizedReviewsSlice, setRandomizedReviewsSlice] = useState(     reviews.slice(0, maxReviews)   )    useEffect(() => {     setRandomizedReviewsSlice(reviews.slice(0, maxReviews))   }, [maxReviews, reviews])    return (     <div className="flex flex-row items-start space-x-2">       <div className="flex items-center justify-center -space-x-7 [&>span]:ring-2 [&>span]:ring-white dark:[&>spa

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

### Incident Patch 1: `077c6801` (2026-10-05)
**Commit Message**: fix(deps): bump figlet to 1.11.4 (#2235)

**File**: `.changeset/bump-figlet.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"lingo.dev": patch
+---
+
+Bump `figlet` from 1.9.4 to 1.11.4.
```

**File**: `packages/cli/package.json` (modified, +1/-1)
```diff
@@ -111,7 +111,7 @@
     "domutils": "3.2.2",
     "dotenv": "16.4.7",
     "ejs": "3.1.10",
-    "figlet": "1.9.4",
+    "figlet": "1.11.4",
     "flat": "6.0.1",
     "gettext-parser": "8.0.0",
     "glob": "11.1.0",
```

**File**: `pnpm-lock.yaml` (modified, +5/-5)
```diff
@@ -357,8 +357,8 @@ importers:
         specifier: 3.1.10
         version: 3.1.10
       figlet:
-        specifier: 1.9.4
-        version: 1.9.4
+        specifier: 1.11.4
+        version: 1.11.4
       flat:
         specifier: 6.0.1
         version: 6.0.1
@@ -5156,8 +5156,8 @@ packages:
   fflate@0.8.3:
     resolution: {integrity: sha512-tbZNuJrLwGUp3zshBtdy4W+ORxZuIh8a5ilyIEQDC5rY1f3U20JMry0Ll3WBzU58EZKsEuJFXhb5gwv8CsPvgA==}
 
-  figlet@1.9.4:
-    resolution: {integrity: sha512-uN6QE+TrzTAHC1IWTyrc4FfGo2KH/82J8Jl1tyKB7+z5DBit/m3D++Iu5lg91qJMnQQ3vpJrj5gxcK/pk4R9tQ==}
+  figlet@1.11.4:
+    resolution: {integrity: sha512-ZU41480OncL+NVLQrT0GVnbO0COL24sLSrzksioDgunmdJNYEUxhJJZ4Y3x1csN8XXqN5OcCZTLG8lKdquNyfQ==}
     engines: {node: '>= 17.0.0'}
     hasBin: true
 
@@ -12623,7 +12623,7 @@ snapshots:
 
   fflate@0.8.3: {}
 
-  figlet@1.9.4:
+  figlet@1.11.4:
     dependencies:
       commander: 14.0.2
 
```

---

### Incident Patch 2: `56d84965` (2026-10-02)
**Commit Message**: fix(deps): bump next to 16.3.6 and axios, brace-expansion overrides for new advisories (#2224)

**File**: `.changeset/patch-next-axios-brace-expansion.md` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+---
+---
```

**File**: `demo/new-compiler-next16/package.json` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
   },
   "dependencies": {
     "@lingo.dev/compiler": "workspace:*",
-    "next": "16.3.3",
+    "next": "16.3.6",
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
-    "next": "16.3.3",
+    "next": "16.3.6",
     "tsup": "8.5.1",
     "typescript": "5.9.3",
     "vitest": "4.1.11"
```

**File**: `packages/new-compiler/package.json` (modified, +1/-1)
```diff
@@ -146,7 +146,7 @@
     "@types/react": "19.2.7",
     "@types/react-dom": "19.2.3",
     "@types/ws": "8.18.1",
-    "next": "16.3.3",
+    "next": "16.3.6",
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
-    "next": "16.3.3",
+    "next": "16.3.6",
     "react": "19.2.3",
     "react-dom": "19.2.3",
     "tsup": "8.5.1",
```

**File**: `pnpm-lock.yaml` (modified, +88/-88)
```diff
@@ -22,7 +22,7 @@ overrides:
   path-to-regexp: '>=8.4.0 <9'
   lodash: '>=4.18.0 <5'
   lodash-es: '>=4.18.0 <5'
-  axios: '>=1.16.0 <2'
+  axios: '>=1.20.0 <2'
   browserslist: '>=4.28.8 <5'
   vite: '>=7.3.5 <8'
   '@xmldom/xmldom@>=0.8 <0.8.15': 0.8.15
@@ -34,7 +34,7 @@ overrides:
   minimatch@>=6 <9.0.7: 9.0.7
   minimatch@>=10 <10.2.6: 10.2.6
   brace-expansion@<1.1.16: 1.1.16
-  brace-expansion@>=4 <5.0.9: 5.0.9
+  brace-expansion@>=4 <5.0.12: 5.0.12
   picomatch@<2.3.2: 2.3.2
   picomatch@>=4 <4.0.4: 4.0.4
   qs@>=6.11.1 <6.16.0: 6.16.0
@@ -114,8 +114,8 @@ importers:
         specifier: workspace:*
         version: link:../../packages/new-compiler
       next:
-        specifier: 16.3.3
-        version: 16.3.3(@opentelemetry/api@1.9.0)(@playwright/test@1.57.0)(@types/node@20.19.25)(react-dom@19.2.0(react@19.2.0))(react@19.2.0)
+        specifier: 16.3.6
+        version: 16.3.6(@opentelemetry/api@1.9.0)(@playwright/test@1.57.0)(@types/node@20.19.25)(react-dom@19.2.0(react@19.2.0))(react@19.2.0)
       react:
         specifier: 19.2.0
         version: 19.2.0
@@ -668,8 +668,8 @@ importers:
         specifier: 19.2.7
         version: 19.2.7
       next:
-        specifier: 16.3.3
-        version: 16.3.3(@opentelemetry/api@1.9.0)(@playwright/test@1.57.0)(@types/node@25.0.3)(react-dom@19.2.3(react@19.2.3))(react@19.2.3)
+        specifier: 16.3.6
+        version: 16.3.6(@opentelemetry/api@1.9.0)(@playwright/test@1.57.0)(@types/node@25.0.3)(react-dom@19.2.3(react@19.2.3))(react@19.2.3)
       tsup:
         specifier: 8.5.1
         version: 8.5.1(@swc/core@1.15.3(@swc/helpers@0.5.23))(jiti@2.6.1)(postcss@8.5.23)(tsx@4.21.0)(typescript@5.9.3)(yaml@2.9.0)
@@ -836,8 +836,8 @@ importers:
         specifier: 8.18.1
         version: 8.18.1
       next:
-        specifier: 16.3.3
-        version: 16.3.3(@babel/core@7.29.6)(@opentelemetry/api@1.9.0)(@playwright/test@1.56.1)(@types/node@25.0.3)(react-dom@19.2.3(react@19.2.3))(react@19.2.3)
+        specifier: 16.3.6
+        version: 16.3.6(@babel/core@7.29.6)(@opentelemetry/api@1.9.0)(@playwright/test@1.56.1)(@types/node@25.0.3)(react-dom@19.2.3(react@19.2.3))(react@19.2.3)
       tsdown:
         specifier: 0.18.2
         version: 0.18.2(synckit@0.11.11)(typescript@5.9.3)
@@ -885,8 +885,8 @@ importers:
         specifier: 3.0.0
         version: 3.0.0
       next:
-        specifier: 16.3.3
-        version: 16.3.3(@babel/core@7.29.6)(@opentelemetry/api@1.9.0)(@playwright/test@1.57.0)(@types/node@25.0.3)(react-dom@19.2.3(react@19.2.3))(react@19.2.3)
+        specifier: 16.3.6
+        version: 16.3.6(@babel/core@7.29.6)(@opentelemetry/api@1.9.0)(@playwright/test@1.57.0)(@types/node@25.0.3)(react-dom@19.2.3(react@19.2.3))(react@19.2.3)
       react:
         specifier: 19.2.3
         version: 19.2.3
@@ -2522,57 +2522,57 @@ packages:
       '@emnapi/core': ^1.7.1
       '@emnapi/runtime': ^1.7.1
 
-  '@next/env@16.3.3':
-    resolution: {integrity: sha512-U2eYQRwXj+dsqxV79zFqExDdatnNY/ZWc2nsJU1p/OgT7fd3dXwlF6OjYaFQCfMoeTA19PWq+wVmYgimVA+V+g==}
+  '@next/env@16.3.6':
+    resolution: {integrity: sha512-x9Vblze1EbtltQYnNH38xCPWU3TVfBd1eXqA3+w9+BTpedkkdNpAaltXlGQ/nsc1+E0mVTNrtcbX3GoO09zeLQ==}
 
-  '@next/swc-darwin-arm64@16.3.3':
-    resolution: {integrity: sha512-8Hiv32QJPwdV6KYJ8meR9SBA061tQqnIKTJDocvOXlEQqib0xMFpzArosuffFUUc0sslbh7QQ8a3Yey1QV8EIw==}
+  '@next/swc-darwin-arm64@16.3.6':
+    resolution: {integrity: sha512-E/7GEqaUkt8mk/T8v9lAnrhzR06kdq1ZBkC12F8tAMkdIadwNp3H1KqHynDHrpcTlGCUdq/qu6vUL2aYVyYBdw==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [darwin]
 
-  '@next/swc-darwin-x64@16.3.3':
-    resolution: {integrity: sha512-A1lgKgwVchRYmSe467zdwhxT9040dd8lH+o65sL5Jet8fjB4kegw/rDyPIpYVRb6jAqwXFOJpjIXJLxQKLiE3A==}
+  '@next/swc-darwin-x64@16.3.6':
+    resolution: {integrity: sha512-yBE893/nDWTlaiBD1p+qgt7NUen4U5R6FXyH0s67Npq1S3E0cVSef1WIXC2xBRgQvwAvJq6DnS6Y6PrY0cy4Ew==}
     engines: {node: '>= 10'}
     cpu: [x64]
     os: [darwin]
 
-  '@next/swc-linux-arm64-gnu@16.3.3':
-    resolution: {integrity: sha512-bf0FIssMFueU2dm7vQEWWxk0c8UjKTdW0yzuh0sQsD8pf1+KCLDdaqhYZNMYGmXwEOiHAUzgBKudovIlcvvBjg==}
+  '@next/swc-linux-arm64-gnu@16.3.6':
+    resolution: {integrity: sha512-KJDpjBqBPYlvkivmyrp+Qys6k/7ksbqGQvRVc6ZEGfR+cjQxx+nUkJaWmNZJsmoOrqYNbaXByF8wa0lBwDhB3Q==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [linux]
     libc: [glibc]
 
-  '@next/swc-linux-arm64-musl@16.3.3':
-    resolution: {integrity: sha512-W7viwCk9JY/cAkdz/A273rd5bb3RgT/IHwR7Upv90tunjBWNtAAhGhoecHh+teRNRSinuAFmE+l7fwZ4YKkrXg==}
+  '@next/swc-linux-arm64-musl@16.3.6':
+    resolution: {integrity: sha512-mqNg2K+hvWskSRb/QM+Ix412DvBsuSF0XV+frTSw5vmoucNnIlynFwKYew8D01bfATErMOM7Bujrf0BA5DRKFA==}
     engines: {node: '>= 10'}
     cpu: [arm64]
     os: [linux]
     libc: [musl]
 
-  '@next/swc-linux-x64-gnu@16.3.3':
-    resolution: {integrity: sha512-0W46zw1N3ODpI6n0GeivHvvob1pooozgZVqy65k0mh4/7vr+FbY9+WpHzNVXjHipJf/A3FDheBG19H1s5A25rA==}
+  '@next/swc-linux-x
```

**File**: `pnpm-workspace.yaml` (modified, +2/-2)
```diff
@@ -24,7 +24,7 @@ overrides:
   path-to-regexp: ">=8.4.0 <9"
   lodash: ">=4.18.0 <5"
   lodash-es: ">=4.18.0 <5"
-  axios: ">=1.16.0 <2"
+  axios: ">=1.20.0 <2"
   browserslist: ">=4.28.8 <5"
   vite: ">=7.3.5 <8"
   "@xmldom/xmldom@>=0.8 <0.8.15": 0.8.15
@@ -36,7 +36,7 @@ overrides:
   minimatch@>=6 <9.0.7: 9.0.7
   minimatch@>=10 <10.2.6: 10.2.6
   brace-expansion@<1.1.16: 1.1.16
-  brace-expansion@>=4 <5.0.9: 5.0.9
+  brace-expansion@>=4 <5.0.12: 5.0.12
   picomatch@<2.3.2: 2.3.2
   picomatch@>=4 <4.0.4: 4.0.4
   qs@>=6.11.1 <6.16.0: 6.16.0
```

---

### Incident Patch 3: `81525d15` (2026-10-02)
**Commit Message**: fix: patch joi and resolve open CodeQL alerts (#2220)

* fix(deps): override joi to 18.2.6 for the isoDate ReDoS advisory

* ci: give the docker, compiler-e2e and merge-conflict jobs explicit token permissions

* fix(cli): pass the working directory to git safe.directory as an argument

**File**: `.changeset/patch-joi-and-codeql-alerts.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"lingo.dev": patch
+---
+
+Pass the working directory to `git config safe.directory` as an argument instead of interpolating it into a shell command
```

**File**: `.github/workflows/docker.yml` (modified, +3/-0)
```diff
@@ -8,6 +8,9 @@ on:
     branches:
       - main
 
+permissions:
+  contents: read
+
 jobs:
   docker:
     runs-on: ubuntu-latest
```

**File**: `.github/workflows/pr-check.yml` (modified, +2/-0)
```diff
@@ -76,6 +76,8 @@ jobs:
     needs: check
     timeout-minutes: 60
     runs-on: ubuntu-latest
+    permissions:
+      contents: read
     steps:
       - name: Checkout
         uses: actions/checkout@v4
```

**File**: `.github/workflows/pr-merge-conflict-check.yml` (modified, +2/-0)
```diff
@@ -12,6 +12,8 @@ jobs:
   check-merge-conflict:
     runs-on: ubuntu-latest
     if: github.event_name == 'pull_request'
+    permissions:
+      pull-requests: read
 
     steps:
       - name: Check for merge conflicts
```

**File**: `packages/cli/src/cli/cmd/ci/flows/in-branch.ts` (modified, +7/-2)
```diff
@@ -1,4 +1,4 @@
-import { execSync } from "child_process";
+import { execFileSync, execSync } from "child_process";
 import path from "path";
 import {
   getGitConfig,
@@ -97,7 +97,12 @@ export class InBranchFlow extends IntegrationFlow {
     execSync(`pwd`, { stdio: "inherit" });
     execSync(`ls -la`, { stdio: "inherit" });
 
-    execSync(`git config --global safe.directory ${process.cwd()}`);
+    execFileSync("git", [
+      "config",
+      "--global",
+      "safe.directory",
+      process.cwd(),
+    ]);
 
     execSync(`git config user.name "${gitConfig.userName}"`);
     execSync(`git config user.email "${gitConfig.userEmail}"`);
```

**File**: `pnpm-lock.yaml` (modified, +5/-5)
```diff
@@ -47,7 +47,7 @@ overrides:
   launch-editor@<2.14.1: 2.14.1
   js-yaml@>=3 <3.15.2: 3.15.2
   js-yaml@>=4 <4.3.2: 4.3.2
-  joi@>=18 <18.2.5: 18.2.5
+  joi@>=18 <18.2.6: 18.2.6
   colord@<2.9.4: 2.9.4
   fflate@>=0.8 <0.8.3: 0.8.3
   decode-uri-component@<0.5.0: 0.5.0
@@ -5626,8 +5626,8 @@ packages:
     resolution: {integrity: sha512-ekilCSN1jwRvIbgeg/57YFh8qQDNbwDb9xT/qu2DAHbFFZUicIl4ygVaAvzveMhMVr3LnpSKTNnwt8PoOfmKhQ==}
     hasBin: true
 
-  joi@18.2.5:
-    resolution: {integrity: sha512-+gEA7rLfaNWx9JzawWPrPetSZwT16NUqHtECDgjyAJreXcs4TM7tx2Pa+VVJJK0YHM83ybrVdaT6UekHH50FJQ==}
+  joi@18.2.6:
+    resolution: {integrity: sha512-8MD5jy4xIcTQi/pHbc10auxclVoJS3pPNiLaTNfW0eh90GbOPU+Y2AjDQnuQsUcHUGNJxqTMmAW6Ho895RaKPA==}
     engines: {node: '>= 20'}
 
   joycon@3.1.1:
@@ -9282,7 +9282,7 @@ snapshots:
       '@directus/system-data': 3.4.2
       date-fns: 4.1.0
       fs-extra: 11.3.2
-      joi: 18.2.5
+      joi: 18.2.6
       js-yaml: 4.3.2
       lodash-es: 4.18.1
       micromustache: 8.0.3
@@ -13075,7 +13075,7 @@ snapshots:
 
   jiti@2.6.1: {}
 
-  joi@18.2.5:
+  joi@18.2.6:
     dependencies:
       '@hapi/address': 5.1.1
       '@hapi/formula': 3.0.2
```

**File**: `pnpm-workspace.yaml` (modified, +1/-1)
```diff
@@ -49,7 +49,7 @@ overrides:
   launch-editor@<2.14.1: 2.14.1
   js-yaml@>=3 <3.15.2: 3.15.2
   js-yaml@>=4 <4.3.2: 4.3.2
-  joi@>=18 <18.2.5: 18.2.5
+  joi@>=18 <18.2.6: 18.2.6
   colord@<2.9.4: 2.9.4
   fflate@>=0.8 <0.8.3: 0.8.3
   decode-uri-component@<0.5.0: 0.5.0
```

---

### Incident Patch 4: `b86d3d4d` (2026-09-28)
**Commit Message**: Merge pull request #2218 from lingodotdev/chore/security-dependency-patches

fix(deps): bump vitest to 4.1.11 and pin patched transitive versions

**File**: `.changeset/quiet-vitest-patches.md` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+---
+---
```

**File**: `integrations/directus/package.json` (modified, +1/-1)
```diff
@@ -35,6 +35,6 @@
     "@unhead/vue": "2.1.15",
     "tsup": "8.5.1",
     "typescript": "5.9.3",
-    "vitest": "4.1.0"
+    "vitest": "4.1.11"
   }
 }
```

**File**: `packages/cli/package.json` (modified, +1/-1)
```diff
@@ -183,7 +183,7 @@
     "gray-matter": "4.0.3",
     "tsup": "8.5.1",
     "typescript": "5.9.3",
-    "vitest": "3.2.6"
+    "vitest": "4.1.11"
   },
   "engines": {
     "node": ">=18"
```

**File**: `packages/compiler/package.json` (modified, +1/-1)
```diff
@@ -48,7 +48,7 @@
     "next": "16.3.3",
     "tsup": "8.5.1",
     "typescript": "5.9.3",
-    "vitest": "4.1.0"
+    "vitest": "4.1.11"
   },
   "dependencies": {
     "@ai-sdk/anthropic": "3.0.117",
```

**File**: `packages/locales/package.json` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@
     "@types/node": "22.13.5",
     "tsup": "8.5.1",
     "typescript": "5.9.3",
-    "vitest": "3.2.6"
+    "vitest": "4.1.11"
   },
   "dependencies": {
     "iso-639-3": "3.0.1"
```

**File**: `packages/logging/package.json` (modified, +1/-1)
```diff
@@ -39,6 +39,6 @@
     "@types/node": "22.10.2",
     "tsup": "8.5.1",
     "typescript": "5.9.3",
-    "vitest": "3.2.6"
+    "vitest": "4.1.11"
   }
 }
```

**File**: `packages/new-compiler/package.json` (modified, +1/-1)
```diff
@@ -151,7 +151,7 @@
     "tsx": "4.21.0",
     "typescript": "5.9.3",
     "unplugin": "2.3.11",
-    "vitest": "4.1.0"
+    "vitest": "4.1.11"
   },
   "dependencies": {
     "@ai-sdk/google": "3.0.122",
```

**File**: `packages/react/package.json` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@
     "tsup": "8.5.1",
     "typescript": "5.9.3",
     "unbuild": "3.6.1",
-    "vitest": "3.2.6"
+    "vitest": "4.1.11"
   },
   "peerDependencies": {
     "next": ">=15.5.19 <16"
```

---

### Incident Patch 5: `d664a884` (2026-09-14)
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

### Incident Patch 6: `8dfdf49b` (2026-09-11)
**Commit Message**: fix: bump csv-parse and ai-sdk packages to clear npm audit advisories (#2208)

* fix: bump csv-parse and ai-sdk packages to clear npm audit advisories

* fix: drop redundant provider-utils override, re-resolve instead

* fix: pass system prompt via ai-sdk system option instead of a system message

* test: guard against the ai-sdk prompt warning coming back

* fix: send the basic translator's system prompt without the JSON envelope

**File**: `.changeset/security-csv-parse-provider-utils.md` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+---
+"lingo.dev": patch
+"@lingo.dev/_compiler": patch
+"@lingo.dev/compiler": patch
+---
+
+Clear two `npm audit` advisories that surfaced through transitive dependencies.
+
+`csv-parse` moves from 5.6.0 to 7.0.2, which patches GHSA-8cw4-87c7-c6xx (prototype replacement reachable through the `columns` option). None of the options renamed in csv-parse 6.0.0 were in use, so the CSV loaders are unchanged.
+
+The AI SDK packages move to the latest release of the major they were already on, so that `@ai-sdk/provider-utils` resolves at or above 4.0.33 and clears GHSA-866g-f22w-33x8 (uncontrolled resource consumption). The SDK packages pin `@ai-sdk/provider-utils` to an exact version, so bumping them is the only way to reach it: `ai` goes to 6.0.280 and `@ai-sdk/anthropic`, `@ai-sdk/google`, `@ai-sdk/groq`, `@ai-sdk/mistral` and `@ai-sdk/openai` follow on their 3.x line.
+
+The system prompt moves from a `{ role: "system" }` entry in `messages` to the `system` option on `generateText`. Since `ai` 6.0.170 the former makes the SDK print a prompt-injection warning on every BYOK run.
+
+The basic translator also stops wrapping its system prompt in a serialized `{ role, content }` envelope before handing it over, so the provider now receives the prompt text on its own rather than a line of JSON quoting it. This is the one change here that alters what reaches the model.
```

**File**: `packages/cli/package.json` (modified, +6/-6)
```diff
@@ -75,10 +75,10 @@
   "author": "",
   "license": "Apache-2.0",
   "dependencies": {
-    "@ai-sdk/anthropic": "3.0.9",
-    "@ai-sdk/google": "3.0.6",
-    "@ai-sdk/mistral": "3.0.5",
-    "@ai-sdk/openai": "3.0.7",
+    "@ai-sdk/anthropic": "3.0.117",
+    "@ai-sdk/google": "3.0.122",
+    "@ai-sdk/mistral": "3.0.64",
+    "@ai-sdk/openai": "3.0.112",
     "@babel/generator": "7.28.5",
     "@babel/parser": "7.28.5",
     "@babel/traverse": "7.28.5",
@@ -95,13 +95,13 @@
     "@openrouter/ai-sdk-provider": "6.0.0-alpha.1",
     "@paralleldrive/cuid2": "2.2.2",
     "@types/ejs": "3.1.5",
-    "ai": "6.0.25",
+    "ai": "6.0.280",
     "bitbucket": "2.12.0",
     "chalk": "5.6.2",
     "chokidar": "4.0.3",
     "cli-progress": "3.12.0",
     "cli-table3": "0.6.5",
-    "csv-parse": "5.6.0",
+    "csv-parse": "7.0.2",
     "csv-stringify": "6.6.0",
     "date-fns": "4.1.0",
     "dedent": "1.7.0",
```

**File**: `packages/cli/src/cli/localizer/explicit.ts` (modified, +2/-2)
```diff
@@ -152,8 +152,8 @@ function createAiSdkLocalizer(params: {
         await generateText({
           model,
           ...params.settings,
+          system: "You are an echo server",
           messages: [
-            { role: "system", content: "You are an echo server" },
             { role: "user", content: "OK" },
             { role: "assistant", content: "OK" },
             { role: "user", content: "OK" },
@@ -221,8 +221,8 @@ function createAiSdkLocalizer(params: {
       const response = await generateText({
         model,
         ...params.settings,
+        system: systemPrompt,
         messages: [
-          { role: "system", content: systemPrompt },
           ...shots.flatMap(
             ([userShot, assistantShot]) =>
               [
```

**File**: `packages/cli/src/cli/processor/basic.spec.ts` (added, +73/-0)
```diff
@@ -0,0 +1,73 @@
+import { afterEach, describe, expect, it, vi } from "vitest";
+import type { LanguageModelV3CallOptions, LanguageModelV3Prompt } from "ai";
+import { MockLanguageModelV3 } from "ai/test";
+import { createBasicTranslator } from "./basic";
+
+/**
+ * The AI SDK reports prompt-shape problems by writing to `console.warn`, not by
+ * failing the call: since `ai` 6.0.170 a system message passed inside `messages`
+ * (rather than through the `system` option) is flagged as a prompt-injection
+ * risk. That means a dependency bump can start printing a warning on every BYOK
+ * run without a single test failing, so these specs assert the translator keeps
+ * the console quiet.
+ */
+function createModel() {
+  let prompt: LanguageModelV3Prompt | undefined;
+  const model = new MockLanguageModelV3({
+    doGenerate: async (options: LanguageModelV3CallOptions) => {
+      prompt = options.prompt;
+      return {
+        finishReason: "stop" as const,
+        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
+        content: [
+          { type: "text" as const, text: JSON.stringify({ greeting: "Hola" }) },
+        ],
+        warnings: [],
+      };
+    },
+  });
+  return { model, getPrompt: () => prompt };
+}
+
+const input = {
+  sourceLocale: "en",
+  targetLocale: "es",
+  sourceData: { greeting: "Hello" },
+  processableData: { greeting: "Hello" },
+  targetData: {},
+};
+
+describe("createBasicTranslator", () => {
+  afterEach(() => {
+    vi.restoreAllMocks();
+  });
+
+  it("translates without the SDK warning about the prompt", async () => {
+    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
+    const { model } = createModel();
+
+    const result = await createBasicTranslator(model, "Translate")(
+      input,
+      () => {},
+    );
+
+    expect(result).toEqual({ greeting: "Hola" });
+    expect(warn).not.toHaveBeenCalled();
+  });
+
+  it("sends the system prompt through the system option, with locales substituted", async () => {
+    const { model, getPrompt } = createModel();
+
+    await createBasicTranslator(
+      model,
+      "Translate from {source} to {target}",
+    )(input, () => {});
+
+    const prompt = getPrompt()!;
+    expect(prompt[0].role).toBe("system");
+    expect(prompt[0].content).toBe("Translate from en to es");
+    expect(prompt.slice(1).map((message) => message.role)).not.toContain(
+      "system",
+    );
+  });
+});
```

**File**: `packages/cli/src/cli/processor/basic.ts` (modified, +3/-9)
```diff
@@ -39,16 +39,10 @@ export function createBasicTranslator(
     const response = await generateText({
       model,
       ...settings,
+      system: systemPrompt
+        .replaceAll("{source}", input.sourceLocale)
+        .replaceAll("{target}", input.targetLocale),
       messages: [
-        {
-          role: "system",
-          content: JSON.stringify({
-            role: "system",
-            content: systemPrompt
-              .replaceAll("{source}", input.sourceLocale)
-              .replaceAll("{target}", input.targetLocale),
-          }),
-        },
         {
           role: "user",
           content: JSON.stringify({
```

**File**: `packages/compiler/package.json` (modified, +6/-6)
```diff
@@ -51,19 +51,19 @@
     "vitest": "4.1.0"
   },
   "dependencies": {
-    "@ai-sdk/anthropic": "3.0.9",
-    "@ai-sdk/google": "3.0.6",
-    "@ai-sdk/groq": "3.0.4",
-    "@ai-sdk/mistral": "3.0.5",
-    "@ai-sdk/openai": "3.0.7",
+    "@ai-sdk/anthropic": "3.0.117",
+    "@ai-sdk/google": "3.0.122",
+    "@ai-sdk/groq": "3.0.65",
+    "@ai-sdk/mistral": "3.0.64",
+    "@ai-sdk/openai": "3.0.112",
     "@babel/generator": "7.28.5",
     "@babel/parser": "7.28.5",
     "@babel/traverse": "7.28.5",
     "@babel/types": "7.28.5",
     "@lingo.dev/_sdk": "workspace:*",
     "@lingo.dev/_spec": "workspace:*",
     "@openrouter/ai-sdk-provider": "6.0.0-alpha.1",
-    "ai": "6.0.25",
+    "ai": "6.0.280",
     "dedent": "1.7.0",
     "dotenv": "16.4.5",
     "fast-xml-parser": "5.7.0",
```

**File**: `packages/compiler/src/lib/lcp/api/index.ts` (modified, +5/-8)
```diff
@@ -237,15 +237,12 @@ export class LCPAPI {
 
         const response = await generateText({
           model: aiModel,
+          system: getSystemPrompt({
+            sourceLocale,
+            targetLocale,
+            prompt: prompt ?? undefined,
+          }),
           messages: [
-            {
-              role: "system",
-              content: getSystemPrompt({
-                sourceLocale,
-                targetLocale,
-                prompt: prompt ?? undefined,
-              }),
-            },
             ...shots.flatMap((shotsTuple) => [
               {
                 role: "user" as const,
```

**File**: `packages/new-compiler/package.json` (modified, +5/-5)
```diff
@@ -154,10 +154,10 @@
     "vitest": "4.1.0"
   },
   "dependencies": {
-    "@ai-sdk/google": "3.0.1",
-    "@ai-sdk/groq": "3.0.1",
-    "@ai-sdk/mistral": "3.0.1",
-    "@ai-sdk/openai": "3.0.1",
+    "@ai-sdk/google": "3.0.122",
+    "@ai-sdk/groq": "3.0.65",
+    "@ai-sdk/mistral": "3.0.64",
+    "@ai-sdk/openai": "3.0.112",
     "@babel/core": "7.29.6",
     "@babel/generator": "7.28.5",
     "@babel/parser": "7.28.5",
@@ -167,7 +167,7 @@
     "@babel/types": "7.28.5",
     "@formatjs/icu-messageformat-parser": "3.1.1",
     "@openrouter/ai-sdk-provider": "1.5.4",
-    "ai": "6.0.3",
+    "ai": "6.0.280",
     "ai-sdk-ollama": "3.8.8",
     "dotenv": "17.2.3",
     "fast-xml-parser": "5.7.0",
```

---

### Incident Patch 7: `ee3fa2eb` (2026-09-04)
**Commit Message**: fix(deps): drop unused remark-mdx-frontmatter and bump browserslist override (#2204)

**File**: `.changeset/quiet-pugs-invite.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+"lingo.dev": patch
+---
+
+Remove the unused `remark-mdx-frontmatter` import and dependency from the mdx loader.
```

**File**: `packages/cli/package.json` (modified, +0/-1)
```diff
@@ -149,7 +149,6 @@
     "remark-frontmatter": "5.0.0",
     "remark-gfm": "4.0.1",
     "remark-mdx": "3.1.1",
-    "remark-mdx-frontmatter": "5.2.0",
     "remark-parse": "11.0.0",
     "remark-rehype": "11.1.2",
     "remark-stringify": "11.0.0",
```

**File**: `packages/cli/src/cli/loaders/mdx.ts` (modified, +0/-1)
```diff
@@ -4,7 +4,6 @@ import remarkParse from "remark-parse";
 import remarkFrontmatter from "remark-frontmatter";
 import remarkGfm from "remark-gfm";
 import remarkStringify from "remark-stringify";
-import remarkMdxFrontmatter from "remark-mdx-frontmatter";
 import { VFile } from "vfile";
 import { Root, RootContent, RootContentMap } from "mdast";
 import { ILoader } from "./_types";
```

**File**: `pnpm-lock.yaml` (modified, +44/-78)
```diff
@@ -23,6 +23,7 @@ overrides:
   lodash: '>=4.18.0 <5'
   lodash-es: '>=4.18.0 <5'
   axios: '>=1.16.0 <2'
+  browserslist: '>=4.28.8 <5'
   vite: '>=7.3.5 <8'
   '@xmldom/xmldom': '>=0.8.13 <0.9'
   form-data: '>=4.0.6 <5'
@@ -465,9 +466,6 @@ importers:
       remark-mdx:
         specifier: 3.1.1
         version: 3.1.1
-      remark-mdx-frontmatter:
-        specifier: 5.2.0
-        version: 5.2.0
       remark-parse:
         specifier: 11.0.0
         version: 11.0.0
@@ -4472,6 +4470,11 @@ packages:
     engines: {node: '>=6.0.0'}
     hasBin: true
 
+  baseline-browser-mapping@2.11.20:
+    resolution: {integrity: sha512-H0ulySigv6icDJ1F7SjtdCD6PrhTpdYCmP0CactWy1+ekh0AFd0o1Wn5T8b+hnTmdBx19u9yhL6wvCylXMY7zw==}
+    engines: {node: '>=6.0.0'}
+    hasBin: true
+
   before-after-hook@2.2.3:
     resolution: {integrity: sha512-NzUnlZexiaH/46WDhANlyR2bXRopNg4F/zuSA3OpZnllCUgRaOF2znDioDWrmbNVsuZk6l9pMquQB38cfBZwkQ==}
 
@@ -4512,8 +4515,8 @@ packages:
     resolution: {integrity: sha512-yQbXgO/OSZVD2IsiLlro+7Hf6Q18EJrKSEsdoMzKePKXct3gvD8oLcOQdIzGupr5Fj+EDe8gO/lxc1BzfMpxvA==}
     engines: {node: '>=8'}
 
-  browserslist@4.28.1:
-    resolution: {integrity: sha512-ZC5Bd0LgJXgwGqUknZY/vkUQ04r8NXnJZ3yYi4vDmSiZmC/pdSN0NbNRPxZpbtO4uAfDUAFffO8IZoM3Gj8IkA==}
+  browserslist@4.28.8:
+    resolution: {integrity: sha512-V2NpofLblG64mfOtSgDhOJESZEGogzDMBv/q+W6oc4LXWP/q75eOXoOaaOu1EOadB9U4Bwx/e0yzbvwKH8zalA==}
     engines: {node: ^6 || ^7 || ^8 || ^9 || ^10 || ^11 || ^12 || >=13.7}
     hasBin: true
 
@@ -4563,6 +4566,9 @@ packages:
   caniuse-lite@1.0.30001761:
     resolution: {integrity: sha512-JF9ptu1vP2coz98+5051jZ4PwQgd2ni8A+gYSN7EA7dPKIMf0pDlSUxhdmVOaV3/fYK5uWBkgSXJaRLr4+3A6g==}
 
+  caniuse-lite@1.0.30001810:
+    resolution: {integrity: sha512-TITQPUkaz+aVk5GL6NhOdwk1aEaNTSDPsGFWrTuhKGtjTF70jL/Oht2W4c6rXUe5fu7Ie19VIahAXHIIiWWNeg==}
+
   ccount@2.0.1:
     resolution: {integrity: sha512-eyrF0jiFpY+3drT6383f1qhkbGsLSifNAjA61IUjZjmLCWjItY6LB9ft9YhoDgwfmclB2zhu51Lc7+95b8NRAg==}
 
@@ -5051,8 +5057,8 @@ packages:
     engines: {node: '>=0.10.0'}
     hasBin: true
 
-  electron-to-chromium@1.5.267:
-    resolution: {integrity: sha512-0Drusm6MVRXSOJpGbaSVgcQsuB4hEkMpHXaVstcPmhu5LIedxs1xNK/nIxmQIU/RPC0+1/o0AVZfBTkTNJOdUw==}
+  electron-to-chromium@1.5.420:
+    resolution: {integrity: sha512-2yD6XreGusOfNV+dUcvipJEXc3n/n7fgr7996aszTG+YY5E4mqM4tOq/3uhP129cazL9YHbVWSpc79ePotWtPA==}
 
   emoji-regex@10.6.0:
     resolution: {integrity: sha512-toUI84YS5YmxW219erniWD0CIVOo46xGKColeNQRgOzDorgBi1v4D71/OFzgD9GO2UGKIv1C3Sp8DAn0+j5w7A==}
@@ -5156,12 +5162,6 @@ packages:
   estree-util-is-identifier-name@3.0.0:
     resolution: {integrity: sha512-hFtqIDZTIUZ9BXLb8y4pYGyk6+wekIivNVTcmvk8NoOh+VeRn5y6cEHzbURrWbfp1fIqdVipilzj+lfaadNZmg==}
 
-  estree-util-scope@1.0.0:
-    resolution: {integrity: sha512-2CAASclonf+JFWBNJPndcOpA8EMJwa0Q8LUFJEKqXLW6+qBvbFZuF5gItbQOs/umBUkjviCSDCbBwU2cXbmrhQ==}
-
-  estree-util-value-to-estree@3.5.0:
-    resolution: {integrity: sha512-aMV56R27Gv3QmfmF1MY12GWkGzzeAezAX+UplqHVASfjc9wNzI/X6hC0S9oxq61WT4aQesLGslWP9tKk6ghRZQ==}
-
   estree-util-visit@2.0.0:
     resolution: {integrity: sha512-m5KgiH85xAhhW8Wta0vShLcUvOsh3LLPI2YVwcbio1l7E09NTLL1EyMZFM1OyWowoH0skScNbhOPl4kcBgzTww==}
 
@@ -6370,8 +6370,9 @@ packages:
   node-machine-id@1.1.12:
     resolution: {integrity: sha512-QNABxbrPa3qEIfrE6GOJ7BYIuignnJw7iQ2YPbc3Nla1HzRJjXzZOiikfF8m7eAMfichLt3M4VgLOetqgDmgGQ==}
 
-  node-releases@2.0.27:
-    resolution: {integrity: sha512-nmh3lCkYZ3grZvqcCH+fjmQ7X+H0OeZgP40OierEaAptX4XofMh5kwNbWh7lBduUzCcV/8kZ+NDLCwm2iorIlA==}
+  node-releases@2.0.54:
+    resolution: {integrity: sha512-YHs7BmmcsdAI5Ozuf8JZo6PT0mv2GIWC9vMfvUC3dp65M8hn7Ux8CPL+2oBI7juNuj9d0ndhTcznq2ODBps9cQ==}
+    engines: {node: '>=18'}
 
   node-webvtt@1.9.4:
     resolution: {integrity: sha512-EjrJdKdxSyd8j4LMLW6s2Ah4yNoeVXp18Ob04CQl1In18xcUmKzEE8pcsxxnFVqanTyjbGYph2VnvtwIXR4EjA==}
@@ -7028,9 +7029,6 @@ packages:
   remark-gfm@4.0.1:
     resolution: {integrity: sha512-1quofZ2RQ9EWdeN34S79+KExV1764+wCUGop5CPL1WGdD0ocPpu91lzPGbwWMECpEpd42kJGQwzRfyov9j4yNg==}
 
-  remark-mdx-frontmatter@5.2.0:
-    resolution: {integrity: sha512-U/hjUYTkQqNjjMRYyilJgLXSPF65qbLPdoESOkXyrwz2tVyhAnm4GUKhfXqOOS9W34M3545xEMq+aMpHgVjEeQ==}
-
   remark-mdx@3.1.1:
     resolution: {integrity: sha512-Pjj2IYlUY3+D8x00UJsIOg5BEvfMyeI+2uLPn9VO9Wg4MEtN/VTIq2NEJQfde9PnX15KgtHyl9S0BcTnWrIuWg==}
 
@@ -7579,9 +7577,6 @@ packages:
     resolution: {integrity: sha512-/m8M+2BJUpoJdgAHoG+baCwBT+tf2VraSfkBgl0Y00qIWt41DJ8R5B8nsEw0I58YwF5IZH6z24/2TobDKnqSWw==}
     engines: {node: '>=12'}
 
-  toml@3.0.0:
-    resolution: {integrity: sha512-y/mWCZinnvxjTKYhJ+pYxwD0mRLVvOtdS2Awbgxln6iEnt4rk0yBxeSBHkGJcPucRiG0e55mwWp+g/05rsrd6w==}
-
   totalist@3.0.1:
     resolution: {integrity: sha512-sf4i37nQ2LBx4m3wB74y+ubopq6W/dIzXg0FDGjsYnZHVa1Da8FH853wlL2gtUhg+xJXjfk3kUZS3BRoQeoQBQ==}
     engines: {node: '>=6'}
@@ -7740,9 +7735,6 @@ packages:
   unist-util-is@6.0.1:
     resolution: {integrity: sha512-Ls
```

**File**: `pnpm-workspace.yaml` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@ overrides:
   lodash: ">=4.18.0 <5"
   lodash-es: ">=4.18.0 <5"
   axios: ">=1.16.0 <2"
+  browserslist: ">=4.28.8 <5"
   vite: ">=7.3.5 <8"
   "@xmldom/xmldom": ">=0.8.13 <0.9"
   form-data: ">=4.0.6 <5"
```

---

### Incident Patch 8: `b05bc64a` (2026-09-04)
**Commit Message**: fix(deps): bump fast-uri override to 3.1.7 (#2203)

**File**: `.changeset/mighty-teeth-mate.md` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+---
+---
```

**File**: `pnpm-lock.yaml` (modified, +5/-5)
```diff
@@ -11,7 +11,7 @@ overrides:
   '@modelcontextprotocol/sdk': '>=1.26.0 <2'
   '@isaacs/brace-expansion': '>=5.0.1 <6'
   effect: '>=3.20.0 <4'
-  fast-uri: '>=3.1.5 <4'
+  fast-uri: '>=3.1.7 <4'
   defu: '>=6.1.5 <7'
   ws: '>=8.21.0 <9'
   js-cookie: '>=3.0.7 <4'
@@ -5229,8 +5229,8 @@ packages:
     resolution: {integrity: sha512-dwsoQlS7h9hMeYUq1W++23NDcBLV4KqONnITDV9DjfS3q1SgDGVrBdvvTLUotWtPSD7asWDV9/CmsZPy8Hf70A==}
     engines: {node: '>=6'}
 
-  fast-uri@3.1.5:
-    resolution: {integrity: sha512-gHwA1O9LDIcKunMKhObS/HimwtehO1nPUECKAu5TpKgaO19fcWEl4bliWe1jWxVFvIXztJjjQ4L8XQ1EU9f7Jw==}
+  fast-uri@3.1.7:
+    resolution: {integrity: sha512-dOvZVzjdZdz7phd9v6jCbwxrBW3fK6n8Rc0CtdmM4bumzMnxywBYhuph6J819RRw/ku+rLbelwfMunktuzVVHg==}
 
   fast-xml-builder@1.2.0:
     resolution: {integrity: sha512-00aAWieqff+ZJhsXA4g1g7M8k+7AYoMUUHF+/zFb5U6Uv/P0Vl4QZo84/IcufzYalLuEj9928bXN9PbbFzMF0Q==}
@@ -12026,7 +12026,7 @@ snapshots:
   ajv@8.18.0:
     dependencies:
       fast-deep-equal: 3.1.3
-      fast-uri: 3.1.5
+      fast-uri: 3.1.7
       json-schema-traverse: 1.0.0
       require-from-string: 2.0.2
 
@@ -12874,7 +12874,7 @@ snapshots:
 
   fast-redact@3.5.0: {}
 
-  fast-uri@3.1.5: {}
+  fast-uri@3.1.7: {}
 
   fast-xml-builder@1.2.0:
     dependencies:
```

**File**: `pnpm-workspace.yaml` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ overrides:
   "@modelcontextprotocol/sdk": ">=1.26.0 <2"
   "@isaacs/brace-expansion": ">=5.0.1 <6"
   effect: ">=3.20.0 <4"
-  fast-uri: ">=3.1.5 <4"
+  fast-uri: ">=3.1.7 <4"
   defu: ">=6.1.5 <7"
   ws: ">=8.21.0 <9"
   js-cookie: ">=3.0.7 <4"
```

---

### Incident Patch 9: `007d2520` (2026-08-31)
**Commit Message**: fix(deps): bump nanoid override to 3.3.18 (#2202)

**File**: `.changeset/hungry-poets-fly.md` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+---
+---
```

**File**: `pnpm-lock.yaml` (modified, +5/-5)
```diff
@@ -41,7 +41,7 @@ overrides:
   postcss@>=8 <8.5.23: 8.5.23
   ajv@>=6 <6.14.0: 6.14.0
   ajv@>=7 <8.18.0: 8.18.0
-  nanoid@<3.3.17: 3.3.17
+  nanoid@<3.3.18: 3.3.18
   nanoid@>=4 <5.1.16: 5.1.16
   launch-editor@<2.14.1: 2.14.1
   js-yaml@>=3 <3.15.1: 3.15.1
@@ -6320,8 +6320,8 @@ packages:
   mz@2.7.0:
     resolution: {integrity: sha512-z81GNO7nnYMEhrGh9LeymoE4+Yr0Wn5McHIZMK5cfQCl+NDX08sCZgUc9/6MHni9IWuFLm1Z3HTCXu2z9fN62Q==}
 
-  nanoid@3.3.17:
-    resolution: {integrity: sha512-xQLf0A3HOMlgHq0n247/LRuAOYmB7dXJ/DvAxGvsSBij45XtBSmQycu+F8ODbHwns/XyFZagyL1+J0Offw1E0g==}
+  nanoid@3.3.18:
+    resolution: {integrity: sha512-DTg4MJbGMWkfi6VZFdNt2/caMbQy4Ou+Op/hJQvGEWcnVfoA1QA+xzRKAzw9jD6+GVOOeYr/mIcuDSdug6F6+w==}
     engines: {node: ^10 || ^12 || ^13.7 || ^14 || >=15.0.1}
     hasBin: true
 
@@ -14223,7 +14223,7 @@ snapshots:
       object-assign: 4.1.1
       thenify-all: 1.6.0
 
-  nanoid@3.3.17: {}
+  nanoid@3.3.18: {}
 
   nanoid@5.1.16: {}
 
@@ -14868,7 +14868,7 @@ snapshots:
 
   postcss@8.5.23:
     dependencies:
-      nanoid: 3.3.17
+      nanoid: 3.3.18
       picocolors: 1.1.1
       source-map-js: 1.2.1
 
```

**File**: `pnpm-workspace.yaml` (modified, +1/-1)
```diff
@@ -43,7 +43,7 @@ overrides:
   postcss@>=8 <8.5.23: 8.5.23
   ajv@>=6 <6.14.0: 6.14.0
   ajv@>=7 <8.18.0: 8.18.0
-  nanoid@<3.3.17: 3.3.17
+  nanoid@<3.3.18: 3.3.18
   nanoid@>=4 <5.1.16: 5.1.16
   launch-editor@<2.14.1: 2.14.1
   js-yaml@>=3 <3.15.1: 3.15.1
```

---

### Incident Patch 10: `86dc87f0` (2026-08-20)
**Commit Message**: fix(compiler): translate JSX passed through attributes (ENG-1368) (#2196)

* fix(compiler): translate JSX passed through attributes (ENG-1368)

* fix(compiler): keep hooks out of prop callbacks when traversing attributes

* fix(compiler): guard prop callbacks at the component check, not the visitor set

* test(compiler): pin transformed flag on locale-only rewrite

**File**: `.changeset/jsx-in-props-translated.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+---
+"@lingo.dev/compiler": patch
+---
+
+Translate JSX handed to a component through an attribute, such as `actions={<span>Text</span>}` or `renderItem={() => <span>Text</span>}`.
+
+Strings that were silently untranslated become new translation entries, so translation volume can jump on the next build. Translatable attributes inside prop JSX, such as `alt` on an `<img>`, are picked up too. A function handed to a prop is treated as the callback it is rather than as a component, so its strings are registered against the enclosing component instead of receiving a translation hook of their own.
+
+Still not covered: JSX in a prop of an element that is itself folded into an ancestor's rich text.
```

**File**: `packages/new-compiler/src/plugin/transform/__snapshots__/transform.test.ts.snap` (modified, +99/-0)
```diff
@@ -1,5 +1,104 @@
 // Vitest Snapshot v1, https://vitest.dev/guide/snapshot.html
 
+exports[`transformComponent > JSX passed through attributes > should keep hooks out of a prop callback on a host with no text of its own 1`] = `
+"import { useTranslation } from "@lingo.dev/compiler/react";
+export function Page() {
+  const {
+    t
+  } = useTranslation(["ded0923063da"]);
+  return <FrameHeader actions={function renderIt() {
+    return <span>{t("ded0923063da", "Text A")}</span>;
+  }} />;
+}"
+`;
+
+exports[`transformComponent > JSX passed through attributes > should leave the document root <html> its locale attribute 1`] = `
+"import { useTranslation } from "@lingo.dev/compiler/react";
+export default function Layout({
+  children
+}) {
+  const {
+    t,
+    locale
+  } = useTranslation([]);
+  return <html lang={locale}><body>{children}</body></html>;
+}"
+`;
+
+exports[`transformComponent > JSX passed through attributes > should not inject a hook into a named function passed as a prop 1`] = `
+"import { useTranslation } from "@lingo.dev/compiler/react";
+export function Page() {
+  const {
+    t
+  } = useTranslation(["94ae71f36192", "f0bda09b5bf3"]);
+  return <FrameHeader actions={function renderIt() {
+    return <span>{t("f0bda09b5bf3", "Text A")}</span>;
+  }}>{t("94ae71f36192", "Text B")}</FrameHeader>;
+}"
+`;
+
+exports[`transformComponent > JSX passed through attributes > should not inject the locale attribute into an <html> inside a prop 1`] = `
+"import { useTranslation } from "@lingo.dev/compiler/react";
+export function Page() {
+  const {
+    t
+  } = useTranslation(["7fd016755b3d", "80d399983384"]);
+  return <FrameHeader actions={<html><body>{t("80d399983384", "Text A")}</body></html>}>{t("7fd016755b3d", "Text B")}</FrameHeader>;
+}"
+`;
+
+exports[`transformComponent > JSX passed through attributes > should register each nested prop JSX exactly once 1`] = `
+"import { useTranslation } from "@lingo.dev/compiler/react";
+export function Nested() {
+  const {
+    t
+  } = useTranslation(["a8cac695134e", "32acd7466846", "2f5156f6a49b"]);
+  return <Outer header={<Inner badge={<span>{t("2f5156f6a49b", "Deep")}</span>}>{t("32acd7466846", "Middle")}</Inner>}>{t("a8cac695134e", "Shallow")}</Outer>;
+}"
+`;
+
+exports[`transformComponent > JSX passed through attributes > should translate JSX in a prop of an element that also has text children 1`] = `
+"import { useTranslation } from "@lingo.dev/compiler/react";
+export function Panel() {
+  const {
+    t
+  } = useTranslation(["f9b1408ca440", "44b3381ba9de"]);
+  return <FrameHeader actions={<span>{t("44b3381ba9de", "Text A")}</span>}>{t("f9b1408ca440", "Text B")}</FrameHeader>;
+}"
+`;
+
+exports[`transformComponent > JSX passed through attributes > should translate JSX returned by an arrow render prop 1`] = `
+"import { useTranslation } from "@lingo.dev/compiler/react";
+export function Page() {
+  const {
+    t
+  } = useTranslation(["20b2cf1823f3"]);
+  return <List renderItem={() => <span>{t("20b2cf1823f3", "Hello world")}</span>} />;
+}"
+`;
+
+exports[`transformComponent > JSX passed through attributes > should translate attributes of JSX passed through a prop 1`] = `
+"import { useTranslation } from "@lingo.dev/compiler/react";
+export function Row() {
+  const {
+    t
+  } = useTranslation(["b0deb282e0b3", "4a2587a16bdd"]);
+  return <Cell icon={<img alt={t("4a2587a16bdd", "Company logo")} src="/logo.png" />}>{t("b0deb282e0b3", "Cell label")}</Cell>;
+}"
+`;
+
+exports[`transformComponent > JSX passed through attributes > should translate prop JSX on a rich-text host 1`] = `
+"import { useTranslation } from "@lingo.dev/compiler/react";
+export function Notice() {
+  const {
+    t
+  } = useTranslation(["97be58bd7333", "dff11b9afb69"]);
+  return <Banner action={<a href="/docs">{t("dff11b9afb69", "Read the docs")}</a>}>{t("97be58bd7333", "Hello <b0>world</b0>", {
+      b0: chunks => <b>{chunks}</b>
+    })}</Banner>;
+}"
+`;
+
 exports[`transformComponent > attributes translation > should not translate attributes with expression values 1`] = `
 "import { useTranslation } from "@lingo.dev/compiler/react";
 export function DynamicButton() {
```

**File**: `packages/new-compiler/src/plugin/transform/process-file.ts` (modified, +31/-1)
```diff
@@ -506,9 +506,28 @@ function processJSXElement(
   registerEntry(entry, state, component.name);
   rewriteChildren(path, state, scope, entry.hash);
 
+  // `path.skip()` below prunes the whole subtree, `openingElement` included, so JSX
+  // handed to this element through an attribute (`actions={<span>Text</span>}`) would
+  // never be visited. Traverse the opening element first. Fragments have no attributes.
+  if (path.node.type === "JSXElement") {
+    path.get("openingElement").traverse(componentVisitors, { visitorState: state });
+  }
+
   path.skip();
 }
 
+/**
+ * Is this node part of the value handed to a JSX attribute?
+ *
+ * Two visitors need the answer, and neither can get it from the node alone. A
+ * function sitting in a prop is a callback, not a component — `inferComponentName`
+ * only looks for a name and would happily accept `actions={function renderIt() { … }}`
+ * — and an `<html>` sitting in a prop is not the document root.
+ */
+function isInsidePropValue(path: NodePath): boolean {
+  return path.findParent((parent) => parent.isJSXAttribute()) !== null;
+}
+
 /**
  * Inject dynamic locale attribute into <html> elements
  * Transforms: <html> → <html lang={locale}>
@@ -623,6 +642,13 @@ function processComponentFunction(
   >,
   state: VisitorsInternalState,
 ): void {
+  // A function handed to a prop is a callback, however React-shaped it looks. Return
+  // without skipping so its JSX is still reached by the ambient traversal and gets
+  // registered against the enclosing component, whose `t` it closes over. Skipping
+  // here instead would drop those strings, which is what used to happen to arrow
+  // render props.
+  if (isInsidePropValue(path)) return;
+
   if (!isReactComponent(path)) {
     path.skip();
     logger.debug(`Skipping non-React component: ${path.node.type}`);
@@ -682,7 +708,11 @@ const componentVisitors = {
     translateAttributes(path.node, this.visitorState);
 
     // Inject locale attribute into <html> elements for Next.js
-    injectHtmlLangAttribute(path.node, this.visitorState);
+    // Only the document root gets the locale. An `<html>` handed to a prop is
+    // somebody's example markup, not the page.
+    if (!isInsidePropValue(path)) {
+      injectHtmlLangAttribute(path.node, this.visitorState);
+    }
 
     if (shouldSkipTranslationForElement(path.node)) {
       path.skip();
```

**File**: `packages/new-compiler/src/plugin/transform/transform.test.ts` (modified, +228/-0)
```diff
@@ -2852,4 +2852,232 @@ export function Legal() {
       expect(result.code).toMatchSnapshot();
     });
   });
+
+  describe("JSX passed through attributes", () => {
+    // Entry order is deterministic and meaningful: an element's own children are
+    // rewritten first, then its opening element is traversed, so host text comes
+    // before prop JSX and outer elements come before inner ones.
+    it("should translate JSX in a prop of an element that also has text children", () => {
+      const code = `
+export function Panel() {
+  return <FrameHeader actions={<span>Text A</span>}>Text B</FrameHeader>;
+}
+`;
+
+      const result = transformComponent({
+        code,
+        filePath: "src/Panel.tsx",
+        config,
+      });
+
+      expect(result.transformed).toBe(true);
+      assert.isDefined(result.newEntries);
+      expect(result.newEntries).toHaveLength(2);
+      expect(result.newEntries.map((e) => e.sourceText)).toEqual([
+        "Text B",
+        "Text A",
+      ]);
+      expect(result.code).toMatchSnapshot();
+    });
+
+    it("should translate attributes of JSX passed through a prop", () => {
+      const code = `
+export function Row() {
+  return <Cell icon={<img alt="Company logo" src="/logo.png" />}>Cell label</Cell>;
+}
+`;
+
+      const result = transformComponent({
+        code,
+        filePath: "src/Row.tsx",
+        config,
+      });
+
+      expect(result.transformed).toBe(true);
+      assert.isDefined(result.newEntries);
+      expect(result.newEntries).toHaveLength(2);
+      expect(result.newEntries.map((e) => e.sourceText)).toEqual([
+        "Cell label",
+        "Company logo",
+      ]);
+
+      const altEntry = result.newEntries.find((e) => e.type === "attribute");
+      assert.isDefined(altEntry);
+      expect(asAttribute(altEntry).sourceText).toBe("Company logo");
+      expect(result.code).toMatchSnapshot();
+    });
+
+    it("should register each nested prop JSX exactly once", () => {
+      const code = `
+export function Nested() {
+  return (
+    <Outer header={<Inner badge={<span>Deep</span>}>Middle</Inner>}>
+      Shallow
+    </Outer>
+  );
+}
+`;
+
+      const result = transformComponent({
+        code,
+        filePath: "src/Nested.tsx",
+        config,
+      });
+
+      expect(result.transformed).toBe(true);
+      assert.isDefined(result.newEntries);
+      expect(result.newEntries).toHaveLength(3);
+      expect(result.newEntries.map((e) => e.sourceText)).toEqual([
+        "Shallow",
+        "Middle",
+        "Deep",
+      ]);
+      expect(result.code).toMatchSnapshot();
+    });
+
+    it("should translate prop JSX on a rich-text host", () => {
+      const code = `
+export function Notice() {
+  return <Banner action={<a href="/docs">Read the docs</a>}>Hello <b>world</b></Banner>;
+}
+`;
+
+      const result = transformComponent({
+        code,
+        filePath: "src/Notice.tsx",
+        config,
+      });
+
+      expect(result.transformed).toBe(true);
+      assert.isDefined(result.newEntries);
+      expect(result.newEntries).toHaveLength(2);
+      expect(result.newEntries.map((e) => e.sourceText)).toEqual([
+        "Hello <b0>world</b0>",
+        "Read the docs",
+      ]);
+      expect(result.code).toMatchSnapshot();
+    });
+
+    // `inferComponentName` accepts any named function expression, so a callback
+    // handed to a prop would otherwise be treated as a component and given a
+    // `useTranslation` call it never runs as one — a rules-of-hooks violation. Its
+    // JSX is still translated and registered against the enclosing component,
+    // whose `t` it closes over.
+    it("should not inject a hook into a named function passed as a prop", () => {
+      const code = `
+export function Page() {
+  return <FrameHeader actions={function renderIt() { return <span>Text A</span>; }}>Text B</FrameHeader>;
+}
+`;
+
+      const result = transformComponent({
+        code,
+        filePath: "src/Page.tsx",
+        config,
+      });
+
+      expect(result.transformed).toBe(true);
+      assert.isDefined(result.newEntries);
+      expect(result.newEntries.map((e) => e.sourceText)).toEqual([
+        "Text B",
+        "Text A",
+      ]);
+      // Once for the import, once for the single call in `Page` — none inside
+      // `renderIt`.
+      expect(result.code.match(/useTranslation/g)).toHaveLength(2);
+      expect(result.code).toMatchSnapshot();
+    });
+
+    it("should not inject the locale attribute into an <html> inside a prop", () => {
+      const code = `
+export function Page() {
+  return <FrameHeader actions={<html><body>Text A</body></html>}>Text B</FrameHeader>;
+}
+`;
+
+      const result = transformComponent({
+        code,
+        filePath: "src/PageHtml.tsx",
+        config,
+      });
+
+      expect(result.transformed).toBe(true);
+      assert.isDefined(result.newEntries);
+      expect(result.newEntries.map((e) => e.sourceText)).toEqual([
+        "Text B",
+        "T
```

---

### Incident Patch 11: `9db8613f` (2026-08-20)
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

### Incident Patch 12: `fa77c247` (2026-08-19)
**Commit Message**: fix(cli): stop rewriting i18n.lock once per task (#2191)

**File**: `.changeset/lockfile-write-amplification.md` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+---
+"lingo.dev": patch
+---
+
+Speed up `lingo.dev run` on projects with many bucket paths and locales.
+
+Every translation task rewrote the whole `i18n.lock`, so a run performed
+`patterns × locales` full read-modify-write cycles to persist `patterns`
+sections. Since every target locale of a bucket path derives its checksums from
+the same source data, all but the first write per pattern stored identical
+bytes. A run now writes a pattern's section once, and those writes are
+serialized against each other.
+
+Loading the lockfile also ran the deduplication pass — a full CST parse plus a
+re-serialization of the entire file — on every load. Deduplication only repairs
+a hand-merged lockfile, which is exactly the case `YAML.parse` rejects, so the
+load now tries the plain parse first and falls back to the repair path only when
+that fails. Malformed and hand-merged lockfiles keep loading exactly as before.
+
+The contents of `i18n.lock` are unchanged.
```

**File**: `packages/cli/src/cli/cmd/run/execute-checksums.spec.ts` (added, +133/-0)
```diff
@@ -0,0 +1,133 @@
+import { describe, it, expect, vi } from "vitest";
+import pLimit from "p-limit";
+
+import { persistChecksums } from "./execute";
+import { CmdRunContext } from "./_types";
+
+function setup(flags: Partial<CmdRunContext["flags"]> = {}) {
+  const writes: Record<string, string>[] = [];
+  const deltaProcessor = {
+    saveChecksums: vi.fn(async (checksums: Record<string, string>) => {
+      writes.push({ ...checksums });
+    }),
+  } as any;
+
+  return {
+    writes,
+    deltaProcessor,
+    args: {
+      ctx: { flags } as CmdRunContext,
+      ioLimiter: pLimit(1),
+      lastWrittenChecksums: new Map<string, string>(),
+      deltaProcessor,
+    },
+  };
+}
+
+describe("persistChecksums", () => {
+  const PATTERN = "src/i18n/locales/[locale]/auth.ts";
+
+  it("writes once when every locale of a pattern produces the same payload", async () => {
+    const { args, writes } = setup();
+    const checksums = { "auth.title": "abc123" };
+
+    for (let locale = 0; locale < 24; locale++) {
+      await persistChecksums({ ...args, bucketPathPattern: PATTERN, checksums });
+    }
+
+    expect(writes).toEqual([{ "auth.title": "abc123" }]);
+  });
+
+  // Two bucket entries can share one path pattern - they are deduped by
+  // `pathPattern::delimiter`, while the lockfile section is keyed by the
+  // pattern alone - so one section can legitimately receive alternating
+  // payloads. Skipping a repeat payload must never leave the wrong one on disk.
+  it("rewrites when the payload for a pattern alternates (A, B, A)", async () => {
+    const { args, writes } = setup();
+    const a = { key: "payload-a" };
+    const b = { key: "payload-b" };
+
+    for (const checksums of [a, b, a]) {
+      await persistChecksums({ ...args, bucketPathPattern: PATTERN, checksums });
+    }
+
+    expect(writes).toEqual([a, b, a]);
+    expect(writes.at(-1)).toEqual(a);
+  });
+
+  it("tracks patterns independently", async () => {
+    const { args, writes } = setup();
+    const other = "src/i18n/locales/[locale]/lab.ts";
+
+    await persistChecksums({ ...args, bucketPathPattern: PATTERN, checksums: { a: "1" } });
+    await persistChecksums({ ...args, bucketPathPattern: other, checksums: { b: "2" } });
+    await persistChecksums({ ...args, bucketPathPattern: PATTERN, checksums: { a: "1" } });
+    await persistChecksums({ ...args, bucketPathPattern: other, checksums: { b: "2" } });
+
+    expect(writes).toEqual([{ a: "1" }, { b: "2" }]);
+  });
+
+  it("writes nothing when --target-locale narrows the run", async () => {
+    const { args, writes } = setup({ targetLocale: ["de-DE"] });
+
+    await persistChecksums({ ...args, bucketPathPattern: PATTERN, checksums: { a: "1" } });
+
+    expect(writes).toEqual([]);
+  });
+
+  it("does not mark a pattern as written when the write fails", async () => {
+    const { args, writes, deltaProcessor } = setup();
+    deltaProcessor.saveChecksums.mockRejectedValueOnce(new Error("disk full"));
+
+    await expect(
+      persistChecksums({ ...args, bucketPathPattern: PATTERN, checksums: { a: "1" } }),
+    ).rejects.toThrow("disk full");
+
+    // A later locale of the same pattern must retry rather than assume success.
+    await persistChecksums({ ...args, bucketPathPattern: PATTERN, checksums: { a: "1" } });
+    expect(writes).toEqual([{ a: "1" }]);
+  });
+
+  it("writes once when a pattern is persisted concurrently", async () => {
+    const { args, writes, deltaProcessor } = setup();
+    deltaProcessor.saveChecksums.mockImplementation(
+      async (checksums: Record<string, string>) => {
+        await new Promise((resolve) => setTimeout(resolve, 5));
+        writes.push({ ...checksums });
+      },
+    );
+    const checksums = { "auth.title": "abc123" };
+
+    await Promise.all(
+      Array.from({ length: 8 }, () =>
+        persistChecksums({ ...args, bucketPathPattern: PATTERN, checksums }),
+      ),
+    );
+
+    expect(writes).toEqual([{ "auth.title": "abc123" }]);
+  });
+
+  it("serializes concurrent writes through the shared io limiter", async () => {
+    const { args } = setup();
+    let inFlight = 0;
+    let maxInFlight = 0;
+    args.deltaProcessor.saveChecksums = vi.fn(async () => {
+      inFlight += 1;
+      maxInFlight = Math.max(maxInFlight, inFlight);
+      await new Promise((resolve) => setTimeout(resolve, 5));
+      inFlight -= 1;
+    });
+
+    await Promise.all(
+      Array.from({ length: 8 }, (_, i) =>
+        persistChecksums({
+          ...args,
+          bucketPathPattern: `pattern-${i}`,
+          checksums: { key: `value-${i}` },
+        }),
+      ),
+    );
+
+    expect(maxInFlight).toBe(1);
+  });
+});
```

**File**: `packages/cli/src/cli/cmd/run/execute.ts` (modified, +71/-6)
```diff
@@ -8,6 +8,7 @@ import { CmdRunContext, CmdRunTask, CmdRunTaskResult } from "./_types";
 import { commonTaskRendererOptions } from "./_const";
 import { createDeltaProcessor, Delta } from "../../utils/delta";
 import { computeProcessableData, createLoaderForTask } from "./_utils";
+import { md5 } from "../../utils/md5";
 
 const WARN_CONCURRENCY_COUNT = 30;
 
@@ -58,8 +59,18 @@ export default async function execute(input: CmdRunContext) {
           }
 
           const i18nLimiter = pLimit(effectiveConcurrency);
+          // Serializes every i18n.lock write. Each write is a read-modify-write
+          // of the whole file, and the per-pattern limiters below cannot guard
+          // it because all patterns share one lockfile.
           const ioLimiter = pLimit(1);
 
+          // Checksum payload last written to i18n.lock per bucket path pattern,
+          // scoped to this run. Every target locale of a pattern derives its
+          // checksums from the same source data, so without this each locale
+          // rewrites the entire lockfile with byte-identical content -
+          // patterns x locales full-file rewrites to persist patterns sections.
+          const lastWrittenChecksums = new Map<string, string>();
+
           const perFileIoLimiters = new Map<string, LimitFunction>();
           const getFileIoLimiter = (
             bucketPathPattern: string,
@@ -86,6 +97,7 @@ export default async function execute(input: CmdRunContext) {
                 ioLimiter,
                 i18nLimiter,
                 initialChecksumsMap,
+                lastWrittenChecksums,
                 getFileIoLimiter,
                 onDone() {
                   task.title = createExecutionProgressMessage(ctx);
@@ -146,13 +158,56 @@ function createExecutionProgressMessage(ctx: CmdRunContext) {
   }, Failed ${chalk.red(failedTasksCount)}, Skipped ${chalk.dim(skippedTasksCount)}`;
 }
 
+/**
+ * Persists a pattern's source checksums to i18n.lock, skipping the write when
+ * this run already wrote exactly this payload for this pattern.
+ *
+ * The lockfile section is keyed by the bucket path pattern and holds checksums
+ * of the source data, which is identical for every target locale of that
+ * pattern - so all but the first locale rewrite the whole file with the same
+ * bytes. Keying on the last payload written (rather than on every payload ever
+ * written) keeps the on-disk result identical to writing unconditionally, even
+ * when two bucket entries share one path pattern and produce different source
+ * data, e.g. entries that differ only by locale delimiter.
+ */
+export async function persistChecksums(args: {
+  ctx: CmdRunContext;
+  ioLimiter: LimitFunction;
+  lastWrittenChecksums: Map<string, string>;
+  bucketPathPattern: string;
+  deltaProcessor: ReturnType<typeof createDeltaProcessor>;
+  checksums: Record<string, string>;
+}) {
+  if (args.ctx.flags.targetLocale?.length) {
+    return;
+  }
+
+  const payloadHash = md5(args.checksums);
+  if (args.lastWrittenChecksums.get(args.bucketPathPattern) === payloadHash) {
+    return;
+  }
+
+  await args.ioLimiter(async () => {
+    // Re-check under the limiter: callers that reach this concurrently for one
+    // pattern would otherwise all pass the check above before the first write
+    // records the payload, turning one write into several identical ones.
+    if (args.lastWrittenChecksums.get(args.bucketPathPattern) === payloadHash) {
+      return;
+    }
+
+    await args.deltaProcessor.saveChecksums(args.checksums);
+    args.lastWrittenChecksums.set(args.bucketPathPattern, payloadHash);
+  });
+}
+
 function createWorkerTask(args: {
   ctx: CmdRunContext;
   assignedTasks: CmdRunTask[];
   ioLimiter: LimitFunction;
   i18nLimiter: LimitFunction;
   onDone: () => void;
   initialChecksumsMap: Map<string, Record<string, string>>;
+  lastWrittenChecksums: Map<string, string>;
   getFileIoLimiter: (bucketPathPattern: string) => LimitFunction;
 }): ListrTask {
   return {
@@ -213,9 +268,14 @@ function createWorkerTask(args: {
                 // then reports the source as changed.
                 const checksums =
                   await deltaProcessor.createChecksums(sourceData);
-                if (!args.ctx.flags.targetLocale?.length) {
-                  await deltaProcessor.saveChecksums(checksums);
-                }
+                await persistChecksums({
+                  ctx: args.ctx,
+                  ioLimiter: args.ioLimiter,
+                  lastWrittenChecksums: args.lastWrittenChecksums,
+                  bucketPathPattern: assignedTask.bucketPathPattern,
+                  deltaProcessor,
+                  checksums,
+                });
               });
               return {
                 status: "skipped",
@@ -294,9 +354,14 @@ function createWorkerTask(args: {
 
               const checksums =
                 await deltaProcessor.createChecksums(sourceData);
-              if (!args.ctx.flags.targetLocale
```

**File**: `packages/cli/src/cli/utils/delta-lockfile-load.spec.ts` (added, +115/-0)
```diff
@@ -0,0 +1,115 @@
+import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
+import fs from "fs";
+import os from "os";
+import path from "path";
+import YAML from "yaml";
+
+import { createDeltaProcessor } from "./delta";
+
+/**
+ * `loadLock` takes a fast path through `YAML.parse` and only falls back to
+ * `deduplicateLockfileYaml` when that fails. Deduplication is not just a
+ * duplicate-key remover: `YAML.parseDocument` collects syntax errors instead of
+ * throwing, so it also rescues shapes `YAML.parse` rejects outright. These
+ * tests pin every such shape, because skipping the fallback would turn a
+ * lockfile that loads today into a hard failure.
+ */
+describe("loadLock repair path", () => {
+  let tmpDir: string;
+  let originalCwd: string;
+
+  beforeEach(() => {
+    originalCwd = process.cwd();
+    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "lingo-loadlock-"));
+    process.chdir(tmpDir);
+  });
+
+  afterEach(() => {
+    process.chdir(originalCwd);
+    fs.rmSync(tmpDir, { recursive: true, force: true });
+  });
+
+  function writeLock(content: string) {
+    fs.writeFileSync(path.join(tmpDir, "i18n.lock"), content);
+  }
+
+  function readLock() {
+    return fs.readFileSync(path.join(tmpDir, "i18n.lock"), "utf-8");
+  }
+
+  it("loads a well-formed lockfile without rewriting it", async () => {
+    const content = YAML.stringify({
+      version: 1,
+      checksums: { sectionA: { greeting: "abc123" } },
+    });
+    writeLock(content);
+
+    const lock = await createDeltaProcessor("src/[locale].json").loadLock();
+
+    expect(lock.checksums).toEqual({ sectionA: { greeting: "abc123" } });
+    expect(readLock()).toBe(content);
+  });
+
+  it("returns the default lock when the file is absent", async () => {
+    const lock = await createDeltaProcessor("src/[locale].json").loadLock();
+    expect(lock).toEqual({ version: 1, checksums: {} });
+  });
+
+  it("repairs duplicate keys inside a section, keeping the last occurrence", async () => {
+    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
+    writeLock("version: 1\nchecksums:\n  sectionA:\n    greeting: first\n    greeting: second\n");
+
+    const lock = await createDeltaProcessor("src/[locale].json").loadLock();
+
+    expect(lock.checksums).toEqual({ sectionA: { greeting: "second" } });
+    // The repaired content is written back so later loads take the fast path.
+    expect(readLock()).not.toContain("greeting: first");
+    expect(logSpy).toHaveBeenCalledWith(
+      expect.stringContaining("Removed 1 duplicate entry from i18n.lock"),
+    );
+    logSpy.mockRestore();
+  });
+
+  // These shapes all make `YAML.parse` throw while `YAML.parseDocument`
+  // recovers. They load today and must keep loading.
+  it.each([
+    [
+      "a duplicate section id",
+      "version: 1\nchecksums:\n  sectionA:\n    a: aaa\n  sectionA:\n    b: bbb\n",
+    ],
+    [
+      "a duplicate top-level checksums key",
+      "version: 1\nchecksums:\n  sectionA:\n    a: aaa\nchecksums:\n  sectionB:\n    b: bbb\n",
+    ],
+    [
+      "a duplicate top-level version key",
+      "version: 1\nversion: 1\nchecksums:\n  sectionA:\n    a: aaa\n",
+    ],
+  ])("still loads a lockfile with %s", async (_label, content) => {
+    writeLock(content);
+    expect(() => YAML.parse(content)).toThrow();
+
+    const lock = await createDeltaProcessor("src/[locale].json").loadLock();
+
+    expect(lock.version).toBe(1);
+    expect(Object.keys(lock.checksums).length).toBeGreaterThan(0);
+  });
+
+  it("keeps the fast path byte-identical to the repair path on clean input", async () => {
+    const content = YAML.stringify({
+      version: 1,
+      checksums: {
+        // numeric-like keys are real: demo/php and demo/txt use them
+        sectionA: { "0": "aaa", "1": "bbb", "10": "ccc", named: "ddd" },
+        sectionB: { "unicode.ключ": "eee", "emoji🎉": "fff" },
+      },
+    });
+    writeLock(content);
+
+    const processor = createDeltaProcessor("src/[locale].json");
+    const lock = await processor.loadLock();
+    await processor.saveLock(lock);
+
+    expect(readLock()).toBe(content);
+  });
+});
```

**File**: `packages/cli/src/cli/utils/delta.ts` (modified, +11/-0)
```diff
@@ -100,6 +100,17 @@ export function createDeltaProcessor(fileKey: string) {
         } as const;
       }
 
+      // Fast path: a lockfile the CLI itself wrote always parses directly.
+      // Deduplication costs a full CST parse plus a re-serialization of the
+      // whole file, and it only ever repairs a hand-merged lockfile - exactly
+      // the case `YAML.parse` refuses to parse. So try the cheap parse first
+      // and fall back to the repair path on any failure.
+      try {
+        return LockSchema.parse(YAML.parse(lockfileContent));
+      } catch {
+        // Malformed or hand-merged lockfile - repair it below.
+      }
+
       // Deduplicate using the universal function
       const { deduplicatedContent, duplicatesRemoved } = deduplicateLockfileYaml(lockfileContent);
 
```

---

### Incident Patch 13: `e5458e60` (2026-08-19)
**Commit Message**: test(compiler): pin the timeout repro to its own deadline (#2193)

**File**: `.changeset/repro-test-independent-of-default.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"@lingo.dev/compiler": patch
+---
+
+Pin the timeout repro test to its own deadline instead of the package default, so raising the
+default does not break it.
```

**File**: `packages/new-compiler/src/translators/lingo/timeout-repro.test.ts` (modified, +10/-6)
```diff
@@ -27,33 +27,37 @@ function sourceEntries(count: number) {
   );
 }
 
-describe("the reported failure: a chunk exceeds the 60s API timeout", () => {
+const AI_TIMEOUT = 60_000;
+
+describe("the reported failure: a chunk exceeds the API timeout", () => {
   it("should keep the chunks that finished before the timeout", async () => {
     vi.useFakeTimers();
 
-    // Chunks 1 and 2 come back; chunk 3 hangs, which is what the 60s
-    // DEFAULT_TIMEOUTS.AI_API ceiling turns into a TimeoutError.
+    // Chunks 1 and 2 come back; chunk 3 hangs, which the timeout ceiling
+    // turns into a TimeoutError.
     localizeObject
       .mockImplementationOnce(async (dictionary) => translated(dictionary))
       .mockImplementationOnce(async (dictionary) => translated(dictionary))
       .mockImplementationOnce(() => new Promise(() => {}));
 
     const translator = new LingoTranslator(
-      { models: "lingo.dev", sourceLocale: "en" },
+      { models: "lingo.dev", sourceLocale: "en", aiTimeout: AI_TIMEOUT },
       new Logger({ enableConsole: false }),
     );
 
     const run = translator
       .translate("de", sourceEntries(250))
       .catch((caught: unknown) => caught);
 
-    await vi.advanceTimersByTimeAsync(60_000);
+    await vi.advanceTimersByTimeAsync(AI_TIMEOUT);
     const error = await run;
 
     vi.useRealTimers();
 
     expect(error).toBeInstanceOf(PartialTranslationError);
-    expect((error as Error).message).toContain("timed out after 60000ms");
+    expect((error as Error).message).toContain(
+      `timed out after ${AI_TIMEOUT}ms`,
+    );
 
     const partial = (error as PartialTranslationError).partialTranslations;
     expect(Object.keys(partial)).toHaveLength(200);
```

---

### Incident Patch 14: `b65e5fcb` (2026-08-19)
**Commit Message**: feat(compiler): make the AI request timeout configurable (#2192)

* feat(compiler): make the AI request timeout configurable

* feat(compiler): honour the configured timeout in pluralization too

* fix(compiler): stop the shared timeout overwriting a pluralization-specific one

**File**: `.changeset/configurable-ai-timeout.md` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+---
+"@lingo.dev/compiler": patch
+---
+
+Let the AI request timeout be configured, and raise the default to 2 minutes.
+
+The timeout for a single AI translation request was hardcoded at 60 seconds, which is not
+enough when the build runs somewhere with slow network to the model, such as CI, or when a
+chunk carries enough text that the model needs longer. The documented workaround was
+patching the compiled file inside `node_modules`.
+
+`aiTimeout` is now a plugin option, and the default is 120000. The request that times out is
+not cancelled and is still billed, so a value that is too low costs money as well as build
+time.
```

**File**: `packages/new-compiler/README.md` (modified, +1/-0)
```diff
@@ -117,6 +117,7 @@ See `demo/new-compiler-next16` for the working example
 | `useDirective` | `boolean` | `false` | Whether to require `'use i18n'` directive |
 | `models` | `string \| Record<string, string>` | `"lingo.dev"` | Model configuration (see below) |
 | `prompt` | `string` | `undefined` | Custom translation prompt |
+| `aiTimeout` | `number` | `120000` | Milliseconds to wait for a single AI translation request. Raise it for slow networks or large chunks |
 | `buildMode` | `"translate" \| "cache-only"` | `"translate"` | Build mode (see below) |
 
 ### Development Configuration
```

**File**: `packages/new-compiler/src/translators/ai-timeout-wiring.test.ts` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+import { describe, expect, it, vi } from "vitest";
+
+import { createLingoConfig } from "../utils/config-factory";
+import { DEFAULT_CONFIG } from "../utils/config-factory";
+import { Logger } from "../utils/logger";
+import type { LingoPluginOptions } from "../plugin/unplugin";
+
+vi.mock("./lingo/model-factory", async (importOriginal) => ({
+  ...(await importOriginal<typeof import("./lingo/model-factory")>()),
+  validateAndGetApiKeys: () => ({ "lingo.dev": "test-key", groq: "test-key" }),
+  createAiModel: () => ({ modelId: "test-model" }),
+}));
+
+vi.mock("lingo.dev/sdk", () => ({
+  LingoDotDevEngine: class {
+    localizeObject = () => new Promise(() => {});
+  },
+}));
+
+const { TranslationService } = await import("./translation-service");
+
+function serviceFromPluginOptions(options: Partial<LingoPluginOptions>) {
+  const config = createLingoConfig({
+    sourceLocale: "en",
+    sourceRoot: "src",
+    targetLocales: ["de"],
+    environment: "production",
+    ...options,
+  } as never);
+
+  return {
+    config,
+    service: new TranslationService(
+      config,
+      new Logger({ enableConsole: false }),
+    ),
+  };
+}
+
+function collaborator(
+  service: object,
+  name: "translator" | "pluralizationService",
+) {
+  return (service as Record<string, Record<string, unknown>>)[name];
+}
+
+describe("aiTimeout from plugin options to the collaborators that use it", () => {
+  it("should default to two minutes", () => {
+    expect(DEFAULT_CONFIG.aiTimeout).toBe(120_000);
+    expect(serviceFromPluginOptions({}).config.aiTimeout).toBe(120_000);
+  });
+
+  it("should reach the translator a caller configured it for", () => {
+    const { service } = serviceFromPluginOptions({ aiTimeout: 300_000 });
+
+    expect(collaborator(service, "translator").config).toMatchObject({
+      aiTimeout: 300_000,
+    });
+  });
+
+  it("should reach pluralization", () => {
+    const { service } = serviceFromPluginOptions({
+      aiTimeout: 300_000,
+      pluralization: { enabled: true, model: "groq:llama-3.1-8b-instant" },
+    } as never);
+
+    expect(collaborator(service, "pluralizationService")).toHaveProperty(
+      "aiTimeout",
+      300_000,
+    );
+  });
+
+  it("should let a pluralization-specific value win over the shared one", () => {
+    const { service } = serviceFromPluginOptions({
+      aiTimeout: 300_000,
+      pluralization: {
+        enabled: true,
+        model: "groq:llama-3.1-8b-instant",
+        aiTimeout: 600_000,
+      },
+    } as never);
+
+    expect(collaborator(service, "pluralizationService")).toHaveProperty(
+      "aiTimeout",
+      600_000,
+    );
+  });
+});
```

**File**: `packages/new-compiler/src/translators/lingo/ai-timeout.test.ts` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+import { describe, expect, it, vi } from "vitest";
+
+import { Logger } from "../../utils/logger";
+import { DEFAULT_TIMEOUTS } from "../../utils/timeout";
+
+const localizeObject = vi.fn(() => new Promise(() => {}));
+
+vi.mock("lingo.dev/sdk", () => ({
+  LingoDotDevEngine: class {
+    localizeObject = localizeObject;
+  },
+}));
+
+vi.mock("./model-factory", async (importOriginal) => ({
+  ...(await importOriginal<typeof import("./model-factory")>()),
+  validateAndGetApiKeys: () => ({ "lingo.dev": "test-key" }),
+}));
+
+const { LingoTranslator } = await import("./translator");
+
+function hangingTranslator(aiTimeout?: number) {
+  return new LingoTranslator(
+    { models: "lingo.dev", sourceLocale: "en", aiTimeout },
+    new Logger({ enableConsole: false }),
+  );
+}
+
+const entry = { h0: { text: "text", context: {} } };
+
+describe("aiTimeout", () => {
+  it("should wait as long as the caller asked instead of the default", async () => {
+    vi.useFakeTimers();
+    const run = hangingTranslator(300_000)
+      .translate("de", entry)
+      .catch((caught: unknown) => caught);
+
+    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUTS.AI_API);
+    expect(await settled(run)).toBe(false);
+
+    await vi.advanceTimersByTimeAsync(300_000 - DEFAULT_TIMEOUTS.AI_API);
+    vi.useRealTimers();
+
+    expect((await run) as Error).toHaveProperty(
+      "message",
+      expect.stringContaining("timed out after 300000ms"),
+    );
+  });
+
+  it("should fall back to the default when the caller says nothing", async () => {
+    vi.useFakeTimers();
+    const run = hangingTranslator()
+      .translate("de", entry)
+      .catch((caught: unknown) => caught);
+
+    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUTS.AI_API);
+    vi.useRealTimers();
+
+    expect((await run) as Error).toHaveProperty(
+      "message",
+      expect.stringContaining(`timed out after ${DEFAULT_TIMEOUTS.AI_API}ms`),
+    );
+  });
+});
+
+async function settled(promise: Promise<unknown>) {
+  const marker = Symbol("pending");
+  return (await Promise.race([promise, Promise.resolve(marker)])) !== marker;
+}
```

**File**: `packages/new-compiler/src/translators/lingo/translator.ts` (modified, +5/-4)
```diff
@@ -16,6 +16,7 @@ export interface LingoTranslatorConfig {
   models: "lingo.dev" | Record<string, string>;
   sourceLocale: LocaleCode;
   prompt?: string;
+  aiTimeout?: number;
 }
 
 /**
@@ -122,7 +123,7 @@ export class LingoTranslator implements Translator<LingoTranslatorConfig> {
 
   /**
    * Translate using Lingo.dev Engine
-   * Times out after 60 seconds to prevent indefinite hangs
+   * Times out after `aiTimeout` to prevent indefinite hangs
    */
   private async translateWithLingoDotDev(
     sourceDictionary: DictionarySchema,
@@ -147,7 +148,7 @@ export class LingoTranslator implements Translator<LingoTranslatorConfig> {
           sourceLocale: this.config.sourceLocale,
           targetLocale: targetLocale,
         }),
-        DEFAULT_TIMEOUTS.AI_API,
+        this.config.aiTimeout ?? DEFAULT_TIMEOUTS.AI_API,
         `Lingo.dev API translation to ${targetLocale}`,
       );
 
@@ -162,7 +163,7 @@ export class LingoTranslator implements Translator<LingoTranslatorConfig> {
 
   /**
    * Translate using generic LLM
-   * Times out after 60 seconds to prevent indefinite hangs
+   * Times out after `aiTimeout` to prevent indefinite hangs
    */
   private async translateWithLLM(
     sourceDictionary: DictionarySchema,
@@ -216,7 +217,7 @@ export class LingoTranslator implements Translator<LingoTranslatorConfig> {
             },
           ],
         }),
-        DEFAULT_TIMEOUTS.AI_API,
+        this.config.aiTimeout ?? DEFAULT_TIMEOUTS.AI_API,
         `${localeModel.provider} LLM translation to ${targetLocale}`,
       );
 
```

**File**: `packages/new-compiler/src/translators/pluralization/ai-timeout.test.ts` (added, +62/-0)
```diff
@@ -0,0 +1,62 @@
+import { describe, expect, it, vi } from "vitest";
+
+import { Logger } from "../../utils/logger";
+import { DEFAULT_TIMEOUTS } from "../../utils/timeout";
+
+vi.mock("ai", () => ({
+  generateText: vi.fn(() => new Promise(() => {})),
+}));
+
+vi.mock("../lingo/model-factory", async (importOriginal) => ({
+  ...(await importOriginal<typeof import("../lingo/model-factory")>()),
+  validateAndGetApiKeys: () => ({ groq: "test-key" }),
+  createAiModel: () => ({ modelId: "test-model" }),
+}));
+
+const { PluralizationService } = await import("./service");
+
+function hangingService(aiTimeout?: number) {
+  return new PluralizationService(
+    {
+      sourceLocale: "en",
+      enabled: true,
+      model: "groq:llama-3.1-8b-instant",
+      aiTimeout,
+    },
+    new Logger({ enableConsole: false }),
+  );
+}
+
+const candidates = [{ hash: "h0", sourceText: "You have 1 message" }];
+
+describe("aiTimeout in pluralization", () => {
+  it("should give a batch twice the configured timeout", async () => {
+    vi.useFakeTimers();
+    const run = hangingService(300_000).generateBatch(candidates);
+
+    await vi.advanceTimersByTimeAsync(300_000);
+    expect(await settled(run)).toBe(false);
+
+    await vi.advanceTimersByTimeAsync(300_000);
+    vi.useRealTimers();
+
+    expect((await run).get("h0")?.error).toContain("timed out after 600000ms");
+  });
+
+  it("should fall back to twice the default when nothing is configured", async () => {
+    vi.useFakeTimers();
+    const run = hangingService().generateBatch(candidates);
+
+    await vi.advanceTimersByTimeAsync(DEFAULT_TIMEOUTS.AI_API * 2);
+    vi.useRealTimers();
+
+    expect((await run).get("h0")?.error).toContain(
+      `timed out after ${DEFAULT_TIMEOUTS.AI_API * 2}ms`,
+    );
+  });
+});
+
+async function settled(promise: Promise<unknown>) {
+  const marker = Symbol("pending");
+  return (await Promise.race([promise, Promise.resolve(marker)])) !== marker;
+}
```

**File**: `packages/new-compiler/src/translators/pluralization/service.ts` (modified, +3/-1)
```diff
@@ -34,6 +34,7 @@ export class PluralizationService {
   private cache = new Map<string, ICUGenerationResult>();
   private readonly prompt: string;
   private readonly sourceLocale: string;
+  private readonly aiTimeout: number | undefined;
 
   constructor(
     config: PluralizationConfig,
@@ -56,6 +57,7 @@ export class PluralizationService {
 
     this.languageModel = createAiModel(localeModel, validatedKeys);
     this.sourceLocale = config.sourceLocale;
+    this.aiTimeout = config.aiTimeout;
     this.prompt = getSystemPrompt({ sourceLocale: config.sourceLocale });
 
     this.logger.debug(
@@ -165,7 +167,7 @@ export class PluralizationService {
             },
           ],
         }),
-        DEFAULT_TIMEOUTS.AI_API * 2, // Double timeout for batch
+        (this.aiTimeout ?? DEFAULT_TIMEOUTS.AI_API) * 2, // Double timeout for batch
         `Pluralization with ${this.languageModel}`,
       );
 
```

**File**: `packages/new-compiler/src/translators/pluralization/types.ts` (modified, +6/-0)
```diff
@@ -20,6 +20,12 @@ export type PluralizationConfig = {
   sourceLocale: LocaleCode;
   enabled: boolean;
 
+  /**
+   * Milliseconds to wait for a pluralization batch. Defaults to twice the
+   * translation timeout, since a batch asks the model for more at once.
+   */
+  aiTimeout?: number;
+
   /**
    * LLM provider for pluralization detection
    * Format: "provider:model" (e.g., "groq:llama3-8b-8192")
```

---

### Incident Patch 15: `b2523013` (2026-08-19)
**Commit Message**: fix(compiler): keep translations that completed before a run failed (#2190)

* fix(compiler): keep translations that completed before a run failed

* fix(compiler): address review findings on partial-translation persistence

* test(compiler): reproduce the 60s timeout path end to end

* test(compiler): name the repro test after what it asserts

* fix(compiler): correct stats.failed edge and drop two misleading test comments

**File**: `.changeset/persist-completed-translations.md` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+---
+"@lingo.dev/compiler": patch
+---
+
+Keep translations that completed before a run failed.
+
+When a translation run threw partway through, every entry that had already come back was
+discarded: the cache write sits after an early `return` in the `catch`, and the chunk loop
+had no inner `try`, so a failure on one chunk took the earlier chunks with it. Those entries
+were already generated and billed, and because the next build derives its work list from
+what is missing from the cache, the identical strings were submitted and paid for again on
+every subsequent build.
+
+Failed runs now persist what completed. The failure is still reported and the build still
+fails, so the only change in behaviour is that already-paid work survives.
```

**File**: `packages/new-compiler/src/translators/api.ts` (modified, +16/-0)
```diff
@@ -11,6 +11,22 @@ export interface Translator<Config> {
   ) => Promise<Record<string, string>>;
 }
 
+/**
+ * Thrown when a translation run fails partway through, carrying the entries
+ * that already came back. They have been paid for, so discarding them makes the
+ * next build request and pay for identical source text again.
+ */
+export class PartialTranslationError extends Error {
+  constructor(
+    message: string,
+    public readonly partialTranslations: Record<string, string>,
+    cause: unknown,
+  ) {
+    super(message, { cause });
+    this.name = "PartialTranslationError";
+  }
+}
+
 /**
  * Dictionary schema for translation
  * Simple flat structure with direct access to translations
```

**File**: `packages/new-compiler/src/translators/lingo/timeout-repro.test.ts` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+import { describe, expect, it, vi } from "vitest";
+
+import { PartialTranslationError } from "../api";
+import { Logger } from "../../utils/logger";
+
+const localizeObject = vi.fn();
+
+vi.mock("lingo.dev/sdk", () => ({
+  LingoDotDevEngine: class {
+    localizeObject = localizeObject;
+  },
+}));
+
+vi.mock("./model-factory", async (importOriginal) => ({
+  ...(await importOriginal<typeof import("./model-factory")>()),
+  validateAndGetApiKeys: () => ({ "lingo.dev": "test-key" }),
+}));
+
+const { LingoTranslator } = await import("./translator");
+
+function sourceEntries(count: number) {
+  return Object.fromEntries(
+    Array.from({ length: count }, (_, i) => [
+      `h${i}`,
+      { text: `text ${i}`, context: {} },
+    ]),
+  );
+}
+
+describe("the reported failure: a chunk exceeds the 60s API timeout", () => {
+  it("should keep the chunks that finished before the timeout", async () => {
+    vi.useFakeTimers();
+
+    // Chunks 1 and 2 come back; chunk 3 hangs, which is what the 60s
+    // DEFAULT_TIMEOUTS.AI_API ceiling turns into a TimeoutError.
+    localizeObject
+      .mockImplementationOnce(async (dictionary) => translated(dictionary))
+      .mockImplementationOnce(async (dictionary) => translated(dictionary))
+      .mockImplementationOnce(() => new Promise(() => {}));
+
+    const translator = new LingoTranslator(
+      { models: "lingo.dev", sourceLocale: "en" },
+      new Logger({ enableConsole: false }),
+    );
+
+    const run = translator
+      .translate("de", sourceEntries(250))
+      .catch((caught: unknown) => caught);
+
+    await vi.advanceTimersByTimeAsync(60_000);
+    const error = await run;
+
+    vi.useRealTimers();
+
+    expect(error).toBeInstanceOf(PartialTranslationError);
+    expect((error as Error).message).toContain("timed out after 60000ms");
+
+    const partial = (error as PartialTranslationError).partialTranslations;
+    expect(Object.keys(partial)).toHaveLength(200);
+    expect(partial.h0).toBe("h0-de");
+    expect(partial.h199).toBe("h199-de");
+    expect(partial.h200).toBeUndefined();
+  });
+});
+
+function translated(dictionary: { entries: Record<string, string> }) {
+  return {
+    ...dictionary,
+    locale: "de",
+    entries: Object.fromEntries(
+      Object.keys(dictionary.entries).map((hash) => [hash, `${hash}-de`]),
+    ),
+  };
+}
```

**File**: `packages/new-compiler/src/translators/lingo/translator.test.ts` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+import { describe, expect, it, vi } from "vitest";
+
+import { PartialTranslationError, type DictionarySchema } from "../api";
+import { LingoTranslator } from "./translator";
+import { Logger } from "../../utils/logger";
+
+vi.mock("lingo.dev/sdk", () => ({
+  LingoDotDevEngine: class {
+    localizeObject = () => {
+      throw new Error("the SDK must not be reached from this test");
+    };
+  },
+}));
+
+vi.mock("./model-factory", async (importOriginal) => ({
+  ...(await importOriginal<typeof import("./model-factory")>()),
+  validateAndGetApiKeys: () => ({ "lingo.dev": "test-key" }),
+}));
+
+type TranslateChunkFn = (
+  chunk: DictionarySchema,
+  targetLocale: string,
+) => Promise<DictionarySchema>;
+
+function makeTranslator(translateChunk: TranslateChunkFn) {
+  const translator = new LingoTranslator(
+    { models: "lingo.dev", sourceLocale: "en" },
+    new Logger({ enableConsole: false }),
+  );
+
+  Object.assign(translator as unknown as { translateChunk: TranslateChunkFn }, {
+    translateChunk,
+  });
+
+  return translator;
+}
+
+function sourceEntries(count: number) {
+  return Object.fromEntries(
+    Array.from({ length: count }, (_, i) => [
+      `h${i}`,
+      { text: `text ${i}`, context: {} },
+    ]),
+  );
+}
+
+describe("LingoTranslator.translate when a chunk fails", () => {
+  it("should hand back the chunks that completed before the failure", async () => {
+    // MAX_ENTRIES_PER_CHUNK is 100, so 250 entries is three chunks and
+    // failing the third leaves the first two, i.e. 200 entries.
+    let call = 0;
+    const translator = makeTranslator(async (chunk) => {
+      call += 1;
+      if (call === 3) throw new Error("timed out after 60000ms");
+      return {
+        version: chunk.version,
+        locale: "de",
+        entries: Object.fromEntries(
+          Object.keys(chunk.entries).map((hash) => [hash, `${hash}-de`]),
+        ),
+      };
+    });
+
+    const error = await translator
+      .translate("de", sourceEntries(250))
+      .catch((caught: unknown) => caught);
+
+    expect(error).toBeInstanceOf(PartialTranslationError);
+    const partial = (error as PartialTranslationError).partialTranslations;
+    expect(Object.keys(partial)).toHaveLength(200);
+    expect(partial.h0).toBe("h0-de");
+    expect(partial.h199).toBe("h199-de");
+    expect(partial.h200).toBeUndefined();
+  });
+
+  it("should keep the original error reachable as the cause", async () => {
+    const cause = new Error("timed out after 60000ms");
+    const translator = makeTranslator(async () => {
+      throw cause;
+    });
+
+    const error = await translator
+      .translate("de", sourceEntries(1))
+      .catch((caught: unknown) => caught);
+
+    expect(error).toBeInstanceOf(PartialTranslationError);
+    expect((error as PartialTranslationError).cause).toBe(cause);
+    expect((error as PartialTranslationError).partialTranslations).toEqual({});
+  });
+});
```

**File**: `packages/new-compiler/src/translators/lingo/translator.ts` (modified, +23/-15)
```diff
@@ -1,6 +1,6 @@
 import { generateText } from "ai";
 import { LingoDotDevEngine } from "lingo.dev/sdk";
-import { dictionaryFrom, type DictionarySchema, type TranslatableEntry, type Translator, } from "../api";
+import { dictionaryFrom, PartialTranslationError, type DictionarySchema, type TranslatableEntry, type Translator, } from "../api";
 import { getSystemPrompt } from "./prompt";
 import { obj2xml, parseXmlFromResponseText } from "../parse-xml";
 import { shots } from "./shots";
@@ -73,21 +73,29 @@ export class LingoTranslator implements Translator<LingoTranslatorConfig> {
 
     const translatedChunks: DictionarySchema[] = [];
 
-    for (let i = 0; i < chunks.length; i++) {
-      const chunk = chunks[i];
-      this.logger.debug(
-        `Translating chunk ${i + 1}/${chunks.length} with ${Object.keys(chunk.entries).length} entries`,
-      );
-      const chunkStartTime = performance.now();
-
-      const translatedChunk = await this.translateChunk(chunk, targetLocale);
-
-      const chunkEndTime = performance.now();
-      this.logger.debug(
-        `Chunk ${i + 1}/${chunks.length} completed in ${(chunkEndTime - chunkStartTime).toFixed(2)}ms`,
+    try {
+      for (let i = 0; i < chunks.length; i++) {
+        const chunk = chunks[i];
+        this.logger.debug(
+          `Translating chunk ${i + 1}/${chunks.length} with ${Object.keys(chunk.entries).length} entries`,
+        );
+        const chunkStartTime = performance.now();
+
+        const translatedChunk = await this.translateChunk(chunk, targetLocale);
+
+        const chunkEndTime = performance.now();
+        this.logger.debug(
+          `Chunk ${i + 1}/${chunks.length} completed in ${(chunkEndTime - chunkStartTime).toFixed(2)}ms`,
+        );
+
+        translatedChunks.push(translatedChunk);
+      }
+    } catch (error) {
+      throw new PartialTranslationError(
+        error instanceof Error ? error.message : String(error),
+        this.mergeDictionaries(translatedChunks).entries,
+        error,
       );
-
-      translatedChunks.push(translatedChunk);
     }
 
     const result = this.mergeDictionaries(translatedChunks);
```

**File**: `packages/new-compiler/src/translators/translation-service.test.ts` (added, +131/-0)
```diff
@@ -0,0 +1,131 @@
+import { describe, expect, it, vi } from "vitest";
+
+import { PartialTranslationError, type Translator } from "./api";
+import { TranslationService } from "./translation-service";
+import { MemoryTranslationCache } from "./memory-cache";
+import type { TranslationCache } from "./cache";
+import type { MetadataSchema } from "../types";
+import { Logger } from "../utils/logger";
+
+type TranslateFn = Translator<unknown>["translate"];
+
+function metadataOf(entries: Record<string, string>): MetadataSchema {
+  return Object.fromEntries(
+    Object.entries(entries).map(([hash, sourceText]) => [
+      hash,
+      {
+        type: "content",
+        hash,
+        sourceText,
+        context: { filePath: "src/App.tsx" },
+        location: { filePath: "src/App.tsx", line: 1, column: 1 },
+      },
+    ]),
+  ) as MetadataSchema;
+}
+
+function makeService(translate: TranslateFn) {
+  const service = new TranslationService(
+    {
+      sourceLocale: "en",
+      sourceRoot: "src",
+      lingoDir: "lingo",
+      cacheType: "local",
+      pluralization: { enabled: false, model: "groq:llama3-8b-8192" },
+      models: "lingo.dev",
+      environment: "development",
+      dev: { usePseudotranslator: true },
+    },
+    new Logger({ enableConsole: false }),
+  );
+
+  const cache = new MemoryTranslationCache();
+  Object.assign(
+    service as unknown as {
+      translator: Translator<unknown>;
+      cache: TranslationCache;
+    },
+    { translator: { config: {}, translate }, cache },
+  );
+
+  return { service, cache };
+}
+
+describe("TranslationService.translate on a failed run", () => {
+  it("should cache the entries the translator finished before it failed", async () => {
+    const { service, cache } = makeService(async () => {
+      throw new PartialTranslationError(
+        "Lingo.dev API translation to de timed out after 60000ms",
+        { a: "Alpha-de", b: "Bravo-de" },
+        new Error("timed out"),
+      );
+    });
+
+    const result = await service.translate(
+      "de",
+      metadataOf({ a: "Alpha", b: "Bravo", c: "Charlie" }),
+    );
+
+    expect(await cache.get("de")).toEqual({ a: "Alpha-de", b: "Bravo-de" });
+    expect(result.translations).toMatchObject({
+      a: "Alpha-de",
+      b: "Bravo-de",
+    });
+  });
+
+  it("should count only the hashes still missing a translation", async () => {
+    const { service } = makeService(async () => {
+      throw new PartialTranslationError("boom", { a: "Alpha-de" }, undefined);
+    });
+
+    const result = await service.translate(
+      "de",
+      metadataOf({ a: "Alpha", b: "Bravo" }),
+    );
+
+    expect(result.errors).toHaveLength(1);
+    expect(result.errors[0]).toMatchObject({ hash: "all" });
+    expect(result.stats.failed).toBe(1);
+  });
+
+  it("should cache nothing when the run fails before any entry completes", async () => {
+    const { service, cache } = makeService(async () => {
+      throw new PartialTranslationError("boom", {}, undefined);
+    });
+
+    await service.translate("de", metadataOf({ a: "Alpha" }));
+
+    expect(await cache.get("de")).toEqual({});
+  });
+
+  it("should survive a plain error that carries no partial results", async () => {
+    const { service, cache } = makeService(async () => {
+      throw new Error("network down");
+    });
+
+    const result = await service.translate("de", metadataOf({ a: "Alpha" }));
+
+    expect(await cache.get("de")).toEqual({});
+    expect(result.errors).toHaveLength(1);
+  });
+
+  it("should not re-request what the failed run already cached", async () => {
+    const translate = vi
+      .fn<TranslateFn>()
+      .mockRejectedValueOnce(
+        new PartialTranslationError(
+          "timeout",
+          { a: "Alpha-de" },
+          new Error("timed out"),
+        ),
+      )
+      .mockResolvedValueOnce({ b: "Bravo-de" });
+    const { service } = makeService(translate);
+    const metadata = metadataOf({ a: "Alpha", b: "Bravo" });
+
+    await service.translate("de", metadata);
+    await service.translate("de", metadata);
+
+    expect(Object.keys(translate.mock.calls[1][1])).toEqual(["b"]);
+  });
+});
```

**File**: `packages/new-compiler/src/translators/translation-service.ts` (modified, +27/-32)
```diff
@@ -9,7 +9,11 @@
  */
 
 import type { TranslationCache } from "./cache";
-import type { TranslatableEntry, Translator } from "./api";
+import {
+  PartialTranslationError,
+  type TranslatableEntry,
+  type Translator,
+} from "./api";
 import type { LingoEnvironment, MetadataSchema } from "../types";
 import {
   type PluralizationConfig,
@@ -258,6 +262,18 @@ Set the required API keys for real translations.`);
         );
         // Merge translated texts with overridden translations
         newTranslations = { ...overriddenTranslations, ...translatedTexts };
+
+        // Check for partial failures (some hashes didn't get translated)
+        for (const hash of uncachedHashes) {
+          if (!newTranslations[hash]) {
+            const entry = filteredMetadata[hash];
+            errors.push({
+              hash,
+              sourceText: entry?.sourceText || "",
+              error: "Translator doesn't return translation",
+            });
+          }
+        }
       } catch (error) {
         const errorMessage =
           error instanceof Error ? error.message : String(error);
@@ -268,37 +284,14 @@ Set the required API keys for real translations.`);
           this.logger.debug(`Stack trace: ${error.stack}`);
         }
 
-        return {
-          translations: this.pickTranslations(
-            cachedTranslations,
-            workingHashes,
-          ),
-          errors: [
-            {
-              hash: "all",
-              sourceText: "all",
-              error: errorMessage,
-            },
-          ],
-          stats: {
-            total: workingHashes.length,
-            cached: cachedCount,
-            translated: 0,
-            failed: uncachedHashes.length,
-          },
-        };
-      }
-
-      // Check for partial failures (some hashes didn't get translated)
-      for (const hash of uncachedHashes) {
-        if (!newTranslations[hash]) {
-          const entry = filteredMetadata[hash];
-          errors.push({
-            hash,
-            sourceText: entry?.sourceText || "",
-            error: "Translator doesn't return translation",
-          });
+        if (error instanceof PartialTranslationError) {
+          Object.assign(newTranslations, error.partialTranslations);
         }
+        errors.push({
+          hash: "all",
+          sourceText: "all",
+          error: errorMessage,
+        });
       }
     }
 
@@ -328,7 +321,9 @@ Set the required API keys for real translations.`);
         total: workingHashes.length,
         cached: cachedCount,
         translated: Object.keys(newTranslations).length,
-        failed: errors.length,
+        failed: uncachedHashes.filter(
+          (hash) => filteredMetadata[hash] && !newTranslations[hash],
+        ).length,
       },
     };
   }
```

#### Recent Merged Pull Requests:
- **PR #2235** (2026-10-05): fix(deps): bump figlet to 1.11.4 (@AndreyHirsa)
- **PR #2234** (2026-10-05): chore: localize the README through the Lingo.dev GitHub App (@cherkanovart)
- **PR #2232** (closed): chore(deps): bump figlet from 1.9.4 to 1.11.3 in the npm_and_yarn group across 1 directory (@dependabot[bot])
- **PR #2231** (closed): chore(deps): bump figlet from 1.9.4 to 1.11.3 in /packages/cli in the npm_and_yarn group across 1 directory (@dependabot[bot])
- **PR #2230** (2026-10-05): chore(deps): bump @markdoc/markdoc to 0.5.10 and csv-stringify to 6.9.0 (@AndreyHirsa)
- **PR #2229** (closed): chore(deps): bump plist from 3.1.0 to 5.0.0 (@dependabot[bot])
- **PR #2228** (closed): chore(deps): bump chokidar from 4.0.3 to 5.0.0 (@dependabot[bot])
- **PR #2227** (closed): chore(deps): bump csv-stringify from 6.6.0 to 6.9.0 (@dependabot[bot])

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
