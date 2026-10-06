# Forensic Learning Record (Deep Inspection): lingui/js-lingui

> **Canonical Artifact**: `07_PROJECT_LEARNING/lingui-js-lingui-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/lingui/js-lingui](https://github.com/lingui/js-lingui))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:41:56.005Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `lingui/js-lingui`
- **Description**: 🌍 📖 A readable, automated, and optimized (2 kb) internationalization for JavaScript
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 5905 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/remix-vite-babel/app/modules/lingui/utils.ts`
```
import { parseAcceptLanguage } from "intl-parse-accept-language";

export type Locales = string | string[] | undefined;

/**
 * Get the client's locales from the Accept-Language header.
 * If the header is not defined returns null.
 * If the header is defined return an array of locales, sorted by the quality
 * value.
 *
 * @example
 * export let loader: LoaderFunction = async ({ request }) => {
 *   let locales = getClientLocales(request)
 *   let date = new Date().toLocaleDateString(locales, {
 *     "day": "numeric",
 *   });
 *   return json({ date })
 * }
 */
export function getClientLocales(headers: Headers): Locales;
export function getClientLocales(request: Request): Locales;
export function getClientLocales(requestOrHeaders: Request | Headers): Locales {
  const headers = getHeaders(requestOrHeaders);

  const acceptLanguage = headers.get("Accept-Language");

  // if the header is not defined, return undefined
  if (!acceptLanguage) return undefined;

  const locales = parseAcceptLanguage(acceptLanguage, {
    validate: Intl.DateTimeFormat.supportedLocalesOf,
    ignoreWildcard: true,
  });

  // if there are no locales found, return undefined
  if (locales.length === 0) return undefined;
  // if there is only one locale, return it
  if (locales.length === 1) return locales[0];
  // if there are multiple locales, return the array
  return locales;
}

/**
 * Receives a Request or Headers objects.
 * If it's a Request returns the request.headers
 * If it's a Headers returns the object directly.
 */
function getHeaders(requestOrHeaders: Request | Headers): Headers {
  if (requestOrHeaders instanceof Request) {
    return requestOrHeaders.headers;
  }

  return requestOrHeaders;
}

```

### Core Architecture Module: `examples/tanstack-start/src/utils/loggingMiddleware.tsx`
```
import { createMiddleware } from "@tanstack/react-start"

const preLogMiddleware = createMiddleware({ type: "function" })
  .client(async (ctx) => {
    const clientTime = new Date()

    return ctx.next({
      context: {
        clientTime,
      },
      sendContext: {
        clientTime,
      },
    })
  })
  .server(async (ctx) => {
    const serverTime = new Date()

    return ctx.next({
      sendContext: {
        serverTime,
        durationToServer:
          serverTime.getTime() - ctx.context.clientTime.getTime(),
      },
    })
  })

export const logMiddleware = createMiddleware({ type: "function" })
  .middleware([preLogMiddleware])
  .client(async (ctx) => {
    const res = await ctx.next()

    const now = new Date()
    console.log("Client Req/Res:", {
      duration: res.context.clientTime.getTime() - now.getTime(),
      durationToServer: res.context.durationToServer,
      durationFromServer: now.getTime() - res.context.serverTime.getTime(),
    })

    return res
  })

```

### Core Architecture Module: `examples/tanstack-start/src/utils/posts.tsx`
```
import { notFound } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import axios from "redaxios"

export type PostType = {
  id: string
  title: string
  body: string
}

export const fetchPost = createServerFn({ method: "GET" })
  .inputValidator((d: string) => d)
  .handler(async ({ data }) => {
    console.info(`Fetching post with id ${data}...`)
    const post = await axios
      .get<PostType>(`https://jsonplaceholder.typicode.com/posts/${data}`)
      .then((r) => r.data)
      .catch((err) => {
        console.error(err)
        if (err.status === 404) {
          throw notFound()
        }
        throw err
      })

    return post
  })

export const fetchPosts = createServerFn({ method: "GET" }).handler(
  async () => {
    console.info("Fetching posts...")
    return axios
      .get<Array<PostType>>("https://jsonplaceholder.typicode.com/posts")
      .then((r) => r.data.slice(0, 10))
  }
)

```

### Core Architecture Module: `examples/tanstack-start/src/utils/seo.ts`
```
export const seo = ({
  title,
  description,
  keywords,
  image,
}: {
  title: string
  description?: string
  image?: string
  keywords?: string
}) => {
  const tags = [
    { title },
    { name: "description", content: description },
    { name: "keywords", content: keywords },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:creator", content: "@tannerlinsley" },
    { name: "twitter:site", content: "@tannerlinsley" },
    { name: "og:type", content: "website" },
    { name: "og:title", content: title },
    { name: "og:description", content: description },
    ...(image
      ? [
          { name: "twitter:image", content: image },
          { name: "twitter:card", content: "summary_large_image" },
          { name: "og:image", content: image },
        ]
      : []),
  ]

  return tags
}

```

### Core Architecture Module: `examples/tanstack-start/src/utils/users.tsx`
```
export type User = {
  id: number
  name: string
  email: string
}

export const DEPLOY_URL = "http://localhost:3000"

```

### Core Architecture Module: `packages/babel-plugin-lingui-macro/src/messageDescriptorUtils.ts`
```
import { ICUMessageFormat, ParsedResult, Tokens } from "./icu"
import * as types from "@babel/types"
import {
  Expression,
  ObjectExpression,
  ObjectProperty,
  SourceLocation,
} from "@babel/types"
import { EXTRACT_MARK, MsgDescriptorPropKey } from "./constants"
import { generateMessageId } from "@lingui/message-utils/generateMessageId"
import type { DirectiveValues } from "./linguiDirective"

function buildICUFromTokens(tokens: Tokens) {
  const messageFormat = new ICUMessageFormat()
  return messageFormat.fromTokens(tokens)
}

export type TextWithLoc = {
  text: string
  loc?: SourceLocation
}

type MessageDescriptorElementTransforms = {
  transformElement?: (value: Expression) => Expression
}

function isObjectProperty(
  node: TextWithLoc | ObjectProperty,
): node is ObjectProperty {
  return "type" in node
}

/**
 * The resolved mode after evaluating `"auto"` against the current environment.
 *
 * @see LinguiPluginOpts.descriptorFields
 */
export type ResolvedDescriptorFields = "all" | "id-only" | "message"

export function createMessageDescriptorFromTokens(
  tokens: Tokens,
  oldLoc: SourceLocation,
  descriptorFields: ResolvedDescriptorFields,
  defaults: DirectiveValues & {
    id?: TextWithLoc | ObjectProperty
    idPrefixLeader?: string
  } = {},
  transforms: MessageDescriptorElementTransforms = {},
) {
  const result = buildICUFromTokens(tokens)

  if (result.elements && transforms.transformElement) {
    result.elements = Object.fromEntries(
      Object.entries(result.elements).map(([key, value]) => [
        key,
        transforms.transformElement(value),
      ]),
    )
  }

  return createMessageDescriptor(result, oldLoc, descriptorFields, defaults)
}

export function createMessageDescriptor(
  result: Partial<ParsedResult>,
  oldLoc: SourceLocation,
  descriptorFields: ResolvedDescriptorFields,
  defaults: DirectiveValues & {
    id?: TextWithLoc | ObjectProperty
    idPrefixLeader?: string
  } = {},
) {
  const { message, values, elements } = result

  // Field inclusion rules based on descriptorFields mode:
  //   "all"     → id, message, context, comment
  //   "message" → id, message, context
  //   "id-only" → id
  const keepMessage = descriptorFields !== "id-only"
  const keepContext = descriptorFields !== "id-only"
  const keepComment = descriptorFields === "all"

  const properties: ObjectProperty[] = []
  const explicitIdProperty = createExplicitIdProperty(defaults)

  properties.push(
    explicitIdProperty
      ? explicitIdProperty
      : createIdProperty(
          message,
          defaults.context
            ? isObjectProperty(defaults.context)
              ? getTextFromExpression(defaults.context.value as Expression)
              : defaults.context.text
            : null,
        ),
  )

  if (keepMessage && message) {
    properties.push(
      createStringObjectProperty(MsgDescriptorPropKey.message, message),
    )
  }

  if (keepComment && defaults.comment) {
    properties.push(
      isObjectProperty(defaults.comment)
        ? defaults.comment
        : createStringObjectProperty(
            MsgDescriptorPropKey.comment,
            defaults.comment.text,
            defaults.comment.loc,
          ),
    )
  }

  if (keepContext && defaults.context) {
    properties.push(
      isObjectProperty(defaults.context)
        ? defaults.context
        : createStringObjectProperty(
            MsgDescriptorPropKey.context,
            defaults.context.text,
            defaults.context.loc,
          ),
    )
  }

  if (values) {
    properties.push(createValuesProperty(MsgDescriptorPropKey.values, values))
  }

  if (elements) {
    properties.push(
      createValuesProperty(MsgDescriptorPropKey.components, elements),
    )
  }

  return createMessageDescriptorObjectExpression(
    properties,
    // preserve line numbers for extractor
    oldLoc,
  )
}

function createExplicitIdProperty(
  defaults: DirectiveValues & {
    id?: TextWithLoc | ObjectProperty
    idPrefixLeader?: string
  },
) {
  if (!defaults.id) {
    return
  }

  const explicitId = isObjectProperty(defaults.id)
    ? getTextFromExpression(defaults.id.value as Expression)
    : defaults.id.text

  const resolvedId =
    explicitId !== undefined &&
    defaults.idPrefix &&
    (!defaults.idPrefixLeader || explicitId.startsWith(defaults.idPrefixLeader))
      ? defaults.idPrefix + explicitId
      : explicitId

  if (isObjectProperty(defaults.id) && resolvedId === explicitId) {
    return defaults.id
  }

  return createStringObjectProperty(
    MsgDescriptorPropKey.id,
    resolvedId,
    defaults.id.loc,
  )
}

function createIdProperty(message: string, context?: string) {
  return createStringObjectProperty(
    MsgDescriptorPropKey.id,
    generateMessageId(message, context),
  )
}

function createValuesProperty(key: string, values: Record<string, Expression>) {
  const valuesObject = Object.keys(values).map((key) =>
    types.objectProperty(
      types.isValidIdentifier(key)
        ? types.identifier(key)
        : // Numeric placeholder keys (e.g. plural/select indices) must be built
          // as numeric literals. Babel 8's @babel/types validates identifier
          // names, so types.identifier("0") throws "not a valid identifier name".
          /^\d+$/.test(key)
          ? types.numericLiteral(Number(key))
          : types.stringLiteral(key),
      values[key],
    ),
  )

  if (!valuesObject.length) return

  return types.objectProperty(
    types.identifier(key),
    types.objectExpression(valuesObject),
  )
}

export function createStringObjectProperty(
  key: string,
  value: string,
  oldLoc?: SourceLocation,
) {
  const property = types.objectProperty(
    types.identifier(key),
    types.stringLiteral(value),
  )
  if (oldLoc) {
    property.loc = oldLoc
  }

  return property
}

function getTextFromExpression(exp: Expression): string {
  if (types.isStringLiteral(exp)) {
    return exp.value
  }

  if (types.isTemplateLiteral(exp)) {
    if (exp?.quasis.length === 1) {
      return exp.quasis[0]?.value?.cooked
    }
  }
}

function createMessageDescriptorObjectExpression(
  properties: ObjectProperty[],
  oldLoc?: SourceLocation,
): ObjectExpression {
  const newDescriptor = types.objectExpression(properties.filter(Boolean))
  types.addComment(newDescriptor, "leading", EXTRACT_MARK)
  if (oldLoc) {
    newDescriptor.loc = oldLoc
  }

  return newDescriptor
}

```

### Core Architecture Module: `packages/babel-plugin-lingui-macro/src/utils.ts`
```
export const makeCounter =
  (index = 0) =>
  () =>
    index++

```

### Core Architecture Module: `packages/babel-plugin-lingui-macro/src/utils/cleanJSXElementLiteralChild.ts`
```
// taken from babel repo -> packages/babel-types/src/utils/react/cleanJSXElementLiteralChild.ts
export default function cleanJSXElementLiteralChild(value: string) {
  const lines = value.split(/\r\n|\n|\r/)

  let lastNonEmptyLine = 0

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/[^ \t]/)) {
      lastNonEmptyLine = i
    }
  }

  let str = ""

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    const isFirstLine = i === 0
    const isLastLine = i === lines.length - 1
    const isLastNonEmptyLine = i === lastNonEmptyLine

    // replace rendered whitespace tabs with spaces
    let trimmedLine = line.replace(/\t/g, " ")

    // trim whitespace touching a newline
    if (!isFirstLine) {
      trimmedLine = trimmedLine.replace(/^[ ]+/, "")
    }

    // trim whitespace touching an endline
    if (!isLastLine) {
      trimmedLine = trimmedLine.replace(/[ ]+$/, "")
    }

    if (trimmedLine) {
      if (!isLastNonEmptyLine) {
        trimmedLine += " "
      }

      str += trimmedLine
    }
  }

  return str
}

```

### Core Architecture Module: `packages/cli/src/api/resolveWorkersOptions.ts`
```
import * as os from "node:os"

export type WorkersOptions = { poolSize: number }

function parseWorkers(
  workers: number | string | undefined,
): number | undefined {
  if (workers === undefined) {
    return undefined
  }

  const parsedWorkers = Number(workers)

  if (!Number.isFinite(parsedWorkers) || !Number.isInteger(parsedWorkers)) {
    throw new Error("The `--workers` option must be an integer.")
  }

  return parsedWorkers
}

export function resolveWorkersOptions(opts: {
  workers?: number | string
}): WorkersOptions {
  const cores = os.availableParallelism()
  const workers = parseWorkers(opts.workers)

  if (workers !== undefined && workers <= 1) {
    return { poolSize: 0 }
  }

  if (cores === 1) {
    return { poolSize: 0 }
  }

  if (workers === undefined) {
    if (cores <= 2) {
      return { poolSize: cores } // on tiny machines, use all
    }
    // on big machines cap to 8, to avoid trashing
    return { poolSize: Math.min(cores - 1, 8) }
  }

  return { poolSize: workers }
}

```

### Core Architecture Module: `packages/cli/src/api/utils.ts`
```
import fs from "fs"
import path from "path"
import normalizePath from "normalize-path"

export const PATHSEP = "/" // force posix everywhere

export function prettyOrigin(origins: [filename: string, line?: number][]) {
  try {
    return origins.map((origin) => origin.join(":")).join(", ")
  } catch (e) {
    return ""
  }
}

export function replacePlaceholders(
  input: string,
  values: Record<string, string | undefined>,
): string {
  return input.replace(/\{([^}]+)}/g, (m, placeholder) => {
    return values[placeholder] ?? m
  })
}

export async function readFile(fileName: string): Promise<string | undefined> {
  try {
    return (await fs.promises.readFile(fileName, "utf-8")).toString()
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code != "ENOENT") {
      throw err
    }
  }
}

async function mkdirp(dir: string): Promise<void> {
  try {
    await fs.promises.mkdir(dir, {
      recursive: true,
    })
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code != "EEXIST") {
      throw err
    }
  }
}

export function isDirectory(filePath: string) {
  try {
    return fs.lstatSync(filePath).isDirectory()
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code != "ENOENT") {
      throw err
    }
  }
}

export async function writeFile(
  fileName: string,
  content: string,
): Promise<void> {
  await mkdirp(path.dirname(fileName))
  await fs.promises.writeFile(fileName, content, "utf-8")
}

export async function writeFileIfChanged(
  filename: string,
  newContent: string,
): Promise<void> {
  const raw = await readFile(filename)

  if (raw) {
    if (newContent !== raw) {
      await writeFile(filename, newContent)
    }
  } else {
    await writeFile(filename, newContent)
  }
}

export function hasYarn() {
  return fs.existsSync(path.resolve("yarn.lock"))
}

export function makeInstall(packageName: string, dev: boolean = false) {
  const withYarn = hasYarn()

  return withYarn
    ? `yarn add ${dev ? "--dev " : ""}${packageName}`
    : `npm install ${dev ? "--save-dev" : "--save"} ${packageName}`
}

/**
 * Remove ./ at the beginning: ./relative  => relative
 *                             relative    => relative
 * Preserve directories:       ./relative/ => relative/
 * Preserve absolute paths:    /absolute/path => /absolute/path
 */
export function normalizeRelativePath(sourcePath: string): string {
  if (path.isAbsolute(sourcePath)) {
    // absolute path
    return normalizePath(sourcePath, false)
  }

  // https://github.com/lingui/js-lingui/issues/809
  const isDir = isDirectory(sourcePath)

  return (
    normalizePath(path.relative(process.cwd(), sourcePath), false) +
    (isDir ? "/" : "")
  )
}

/**
 * Normalize a path relative to the project rootDir, for display purposes
 * (e.g. finding.catalogPath).
 */
export function toRootRelativePath(rootDir: string, filePath: string): string {
  return normalizePath(path.relative(rootDir, filePath))
}

/**
 * Escape special regex characters used in file-based routing systems
 */
export function makePathRegexSafe(path: string) {
  return path.replace(/[(){}[\]^$+]/g, "\\$&")
}

```

### Core Architecture Module: `packages/cli/src/api/workerLogger.ts`
```
import { Logger } from "./logger.js"

export type SerializedLogs = {
  errors: string
}

export class WorkerLogger implements Logger {
  private errors: string[] = []

  error(msg: string): void {
    this.errors.push(msg)
  }

  flush(): SerializedLogs {
    const errors = this.errors.join("\n")
    this.errors = []

    return {
      errors,
    }
  }
}

```

### Core Architecture Module: `packages/cli/src/api/workerPools.ts`
```
import { createWorkerPool, WorkerPool } from "./typedPool.js"
import type { ExtractWorkerFunction } from "../workers/extractWorker.js"
import type { ExtractWorkerFunction as ExtractExperimentalWorkerFunction } from "../extract-experimental/workers/extractWorker.js"
import type { CompileWorkerFunction } from "../workers/compileWorker.js"
import type { MissingWorkerFunction } from "../workers/missingWorker.js"

export type ExtractWorkerPool = WorkerPool<ExtractWorkerFunction>
export type MissingWorkerPool = WorkerPool<MissingWorkerFunction>

type PoolOptions = {
  poolSize: number
}

/** @internal */
export const createExtractWorkerPool = (opts: PoolOptions): ExtractWorkerPool =>
  createWorkerPool<ExtractWorkerFunction>(
    "../workers/extractWorkerWrapper",
    import.meta.url,
    opts.poolSize,
  )

/** @internal */
export const createExtractExperimentalWorkerPool = (
  opts: PoolOptions,
): WorkerPool<ExtractExperimentalWorkerFunction> =>
  createWorkerPool<ExtractExperimentalWorkerFunction>(
    "../extract-experimental/workers/extractWorkerWrapper",
    import.meta.url,
    opts.poolSize,
  )

/** @internal */
export const createCompileWorkerPool = (
  opts: PoolOptions,
): WorkerPool<CompileWorkerFunction> =>
  createWorkerPool<CompileWorkerFunction>(
    "../workers/compileWorkerWrapper",
    import.meta.url,
    opts.poolSize,
  )

/** @internal */
export const createMissingWorkerPool = (opts: PoolOptions): MissingWorkerPool =>
  createWorkerPool<MissingWorkerFunction>(
    "../workers/missingWorkerWrapper",
    import.meta.url,
    opts.poolSize,
  )

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2681** (2026-09-28): **lingui compile crashes when NODE_ENV=test**
  *Symptoms*: ### Verifications  - [x] I've searched [existing issues](https://github.com/lingui/js-lingui/issues) and this hasn't been reported yet. - [x] I've checked [the docs](https://lingui.dev) and this isn't expected behavior. - [x] I'm using the latest version of Lingui, and the problem still occurs.  ### Description  In our repo, we run lingui compile right before we run tests, to make sure we have the latest compiled messages while running our tests.  `NODE_ENV=test lingui compile && jest`  There's an issue with the cli if you are running it while having a `NODE_ENV === "test"` because of resolveWorkerFile in https://github.com/lingui/js-lingui/blame/main/packages/cli/src/api/typedPool.ts#L25 that picks the worker file based on NODE_ENV:  ```typescript process.env.NODE_ENV === "test" ? `${basePath}.jiti.js` : `${basePath}.prod.js` ```  The *.jiti.js wrappers files are not found in dist build.  This used to work in v5  ### Reproduction Link  https://stackblitz.com/github/MPeloquin/lingui-node-env-test-repro?file=package.json  ### Reproduction Steps  In stackblitz https://stackblitz.com/github/MPeloquin/lingui-node-env-test-repro?file=package.json  ``` npm install npm run compile:test-env ```  ``` Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../node_modules/@lingui/cli/dist/workers/compileWorkerWrapper.jiti.js' ```   ```npm run compile:test-env-no-workers``` works (no pool). ```npx lingui compile``` without `NODE_ENV` works.  The same applies to extract (and extract-experimen

- **Issue #2676** (2026-09-21): **Macro accepts JSX placeholder names containing `-` or `.`, but the React runtime renders them as literal text**
  *Symptoms*: ### Verifications  - [x] I've searched [existing issues](https://github.com/lingui/js-lingui/issues) and this hasn't been reported yet. - [x] I've checked [the docs](https://lingui.dev) and this isn't expected behavior. - [x] I'm using the latest version of Lingui, and the problem still occurs.  ### Description  The macro and the React runtime disagree on which placeholder names are valid, and the mismatch fails silently.  `tokenizeElement` in `packages/babel-plugin-lingui-macro/src/macroJsx.ts` validates names against:  ```js /^[a-zA-Z_]([\w.-]*\w)?$/ ```  and its error message states that names "may contain `.-` in between".  `formatElements` in `packages/react/src/format.tsx` substitutes the components back in using:  ```js const tagRe = /<([a-zA-Z0-9]+)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9]+)\/>/ ```  The runtime pattern is narrower than the one the macro enforces. A name containing `-`, `.` or `_` passes validation, extracts and compiles without a warning, and then fails to match at render time — so the tag is emitted as literal text.  Kebab-case is a natural way to name a link placeholder, which makes this easy to hit:  | `_t` value | macro accepts | runtime matches | | --- | --- | --- | | `termsLink` | yes | yes | | `terms-link` | yes | **no** | | `terms_link` | yes | **no** | | `terms.link` | yes | **no** |   ### Reproduction Link  _No response_  ### Reproduction Steps  With `macro: { jsxPlaceholderAttribute: "_t" }` in the lingui config:  ```jsx <Trans>   I agree to the <a 
  **Post-Mortem & Fix Analysis**:
  > Taking this — the macro and React runtime disagree on placeholder names.  `tokenizeElement` already accepts names matching `/^[a-zA-Z_]([\w.-]*\w)?$/` (so `terms-link`, `terms_link`, `terms.link` extract/compile), but `formatElements` `tagRe` is `[a-zA-Z0-9]+` and leaves those tags as literal text at render time.  No open Fixes PR on #2676. I'll widen the runtime regex to the documented macro charset (preferred over a build-time reject: a silent render bug is worse) and add `formatElements` regression tests. Extraction message IDs stay unchanged.
  > Opened https://github.com/lingui/js-lingui/pull/2680 against `main` (**Fixes #2676**).  Approach: widen `formatElements` `tagRe` to the documented macro charset so `terms-link` / `terms_link` / `terms.link` (and existing camelCase / numeric names) are substituted at render time. Extraction IDs are unchanged.

- **Issue #2671** (2026-09-23): **"Translation" moved from start to end of json object in 2nd extract**
  *Symptoms*: ### Verifications  - [x] I've searched [existing issues](https://github.com/lingui/js-lingui/issues) and this hasn't been reported yet. - [x] I've checked [the docs](https://lingui.dev) and this isn't expected behavior. - [x] I'm using the latest version of Lingui, and the problem still occurs.  ### Description  <img width="728" height="574" alt="Image" src="https://github.com/user-attachments/assets/70c2a1c8-5427-4390-b6a8-23e6b70c83ad" />  <img width="1769" height="381" alt="Image" src="https://github.com/user-attachments/assets/66033cd8-102a-41d4-994a-c6ce284ff77d" />  Since the first extract adds the translation to the front then it gets moved on merge there are PRs that show a json diff of this line being moved. Just add it to the end from the start  ### Reproduction Link  _No response_  ### Reproduction Steps  1. Create a new string 2. Run extract and merge PR 3. Pull latest and add different strings 4. Notice the json diffs will include the "translation" line being moved from the top to the bottom  ### Expected Behavior  "Translation" line is added to the bottom on every extract run  ### Macro Support  Babel with @lingui/babel-plugin-lingui-macro  ### Lingui Version  6.4.0  ### Babel / SWC Version  _No response_  ### Node Version  _No response_  ### Framework  _No response_
  **Post-Mortem & Fix Analysis**:
  > @KBaldwin2 thanks for reporting this, confirmed. The catalog merge builds a brand-new entry with translation first, but rebuilds an existing one with translation last, and the JSON formatter writes whatever order it gets. It's a regression from 5.2.0, before that both paths agreed. The fix is small: build new entries the same way, with translation at the end, as you suggested.

- **Issue #2662** (2026-09-11): **`orderByMessageId` never got the #1808 fix, and custom `orderBy` functions throw**
  *Symptoms*: ### Verifications  - [x] I've searched [existing issues](https://github.com/lingui/js-lingui/issues) and this hasn't been reported yet. - [x] I've checked [the docs](https://lingui.dev) and this isn't expected behavior. - [x] I'm using the latest version of Lingui, and the problem still occurs.  ### Description  Hello!  I found two related gaps in the catalog sorting code, both still present on `main`. 1. `orderByMessage` was fixed to use a hardcoded collator in #1808 to stop catalogs from sorting differently depending on the machine's locale, but that fix was never applied to `orderByMessageId`. 2. #2394 added support for passing a custom `orderBy` function, but seems like `makeConfig.ts`'s `jest-validate` schema was never updated to allow it. `exampleConfig.orderBy` is still just `"message"` (a bare string), so `validate(config, configValidation)` rejects a function.   The only way around these right now is by patching. Patches are small, so I am happy to open a PR if that lightens the load for the maintainers. 😄  ### Reproduction Link  _No response_  ### Reproduction Steps  ```ts // lingui.config.ts import { defineConfig } from "@lingui/cli" import { formatter } from "@lingui/format-json"  export default defineConfig({   locales: ["en", "es"],   sourceLocale: "en",   format: formatter({ style: "minimal" }),   orderBy: "messageId",   catalogs: [{ path: "src/locales/{locale}/messages", include: ["src"] }], }) ```  - Run `lingui extract` with different locales. The same sour
  **Post-Mortem & Fix Analysis**:
  > I can work on this if you have not already started a fix. I traced the sorting regression to the switch from code-point comparison to localeCompare, and the function validation problem to the example-derived orderBy schema. My plan is to restore deterministic code-point ordering, accept Function as a valid orderBy option, and add focused regression tests for both behaviors. Please let me know if you are already preparing a PR so we do not duplicate work.
  > @carloitaben thanks for reporting this! #1808 only touched `orderByMessage`, and #2394 carried the bare `localeCompare` over in the refactor. The validation gap is exactly as you describe - the schema in `makeConfig.ts` was never updated, so passing a function in the config has never actually worked.
  > I see #2665 now covers this issue, so I will hold my local branch to avoid creating a duplicate PR. Thanks for picking it up.

- **Issue #2643** (2026-08-31): **`t` with `selectOrdinal` doesn't capture values on build**
  *Symptoms*: ### Verifications  - [x] I've searched [existing issues](https://github.com/lingui/js-lingui/issues) and this hasn't been reported yet. - [x] I've checked [the docs](https://lingui.dev) and this isn't expected behavior. - [x] I'm using the latest version of Lingui, and the problem still occurs.  ### Description  When using `t` macro together with `selectOrdinal`, the emitted JavaScript does not pass in the required values to `_`.  Swapping `t` with `msg` (then t'ing that) works.  Using `_` directly also works fine.  t with selectOrdinal works fine with Dev/HMR build and serve, this only impacts production build   ### Reproduction Link  Can see what it was and what works in this PR implementing work around: https://github.com/FFXIVVenues/ffxiv-venues-web2/pull/63   ### Reproduction Steps  1. Take the [given example](https://lingui.dev/ref/macro#selectordinal) raw from the docs ```js const count = 28; const message = t({     id: "my.custom.id",     comment: "My Comment",     message: selectOrdinal(count, {         one: "#st",         two: "#nd",         few: "#rd",         other: "#th",     }), }); console.log(message);   // NaNth ```  2. `lingui extract` -> `lingui compile` -> `npx vite build` -> `npx serve`  3. The output will be:  `const p=n._({id:"my.custom.id"});console.log(p);`  and console.log gives `NaNth`  ### Expected Behavior  Should emit `n._({id:"my.custom.id", values: { count }});` ? and print `28th` in console.  ### Macro Support  SWC with @lingui/swc-plugin  ###
  **Post-Mortem & Fix Analysis**:
  > Hi! I'd like to take a look at this issue and, if it's still available, work on a fix. I'll first reproduce the production-build behavior and investigate how the SWC macro transformation handles selectOrdinal values. If I can identify the root cause, I'd be happy to submit a PR with a regression test.
  > Update: I investigated this on a local reproduction using Lingui 6.6.0, @lingui/swc-plugin 6.6.0, Vite 7.3.0, and the production build pipeline.  The current SWC transformation preserves values: { count } for the object-form t({ message: selectOrdinal(...) }) case, including the descriptorFields: "id-only" configuration.  I also ran the Vite production build and inspected the generated bundle. The final production output still contains:  _{id:"my.custom.id",values:{count:A1}}  so I couldn't reproduce the reported loss of values with the current stack.  One notable difference is that the issue reports Lingui 6.6.0 but Babel/SWC version 6.5.1. This may indicate a version-specific or environment-specific issue. I don't have a source-level fix to propose at this point. 
  > I can confirm, i could not reproduce this in the SWC plugin tests using this snippet:   ```rust to!(     case_github,     LinguiOptions {         descriptor_fields: DescriptorFields::IdOnly,         ..Default::default()     },     // language=js     r#"  import { selectOrdinal } from '@lingui/core/macro'; import { useLingui } from '@lingui/react/macro';  function Component() {   const {t} = useLingui();   const count = 28;    const message = t({     id: '#my.custom.id',     comment: "My Comment",     message: selectOrdinal(count, {         one: "st",         two: "sd",         few: "rd",         other: "th",     }),   }); }      "# ```  This produces:   ```js          23 │+import { useLingui as $_useLingui } from "@lingui/react";                                                                                                                                                                                               24 │+function Component() {                                           

- **Issue #2631** (2026-07-28): **jsxPlaceholderDefaults fails when passing the same tag twice in the same message**
  *Symptoms*: ### Description  Using the same tag with `jsxPlaceholderDefaults` twice results in an error. Likely a collision?  Error: ``` SyntaxError: Multiple distinct JSX elements with the same placeholder name (`link`). Differentiate them by setting `macro.jsxPlaceholderAttribute` in the lingui config and then adding the attribute to your JSX elements (e.g. `<element _t="newName" />`). ```  Like, I do understand `jsxPlaceholderAttribute` works as an alternative, and I did use it to work around this problem, but I feel like it's not the right solution to error out.  ### Verifications  - [x] I've checked [the docs](https://lingui.dev) and this isn't covered there. - [x] I've searched existing issues on [GitHub](https://github.com/lingui/js-lingui/issues).  ### Reproduction Steps  Code  ```tsx import { Trans } from "@lingui/react/macro"  export default function App() {    return <Trans><a>hi</a><a>bye</a></Trans> } ```  Config  ```ts {   // ....   macro: {     jsxPlaceholderDefaults: { a: "link" },   } } ```  ### Expected Behavior  I expected the reuslt to be:  ```html <link>hi</link><link_1>bye</link_1> ```  or  ```html <link_0>hi</link_0><link_1>bye</link_1> ```  ### Macro Support  Babel with babel-macro-plugin  ### Lingui Version  6.5.0  ### Babel Version  7.29.7  ### Framework  React, Vite
  **Post-Mortem & Fix Analysis**:
  > That is expected behavior. You need to specify name for collided elements manually, no magic like `_0` automatically applied. 
  > I understand that this is the implemented behavior. However, I am hoping you could reconsider for the following reasons:  - It is not obvious from the documentation this is intended, and _why_ it is.  - It essentially waters down the value of `jsxPlaceholderDefaults` as a simple "compile-time check" to enforce that we always add a custom `jsxPlaceholderAttribute`.  ---  For example, in the following example  ```tsx <Trans>   Click here to learn the <a>Privacy Policy</a> and here to read the <a>Terms of Serivce</a> </Trans> ```  This fails: _ 💥 Multiple distinct JSX elements with the same placeholder name (`link`)_  So the user has to do the following (assume `jsxPlaceholderAttribute: 'ph'`)  ```tsx <Trans>   Click here to learn the <a>Privacy Policy</a> and here to read the <a ph="link_1">Terms of Serivce</a> </Trans> ```  ---  In this case, I can see the argument that `link_1` aint helpful for translators. But all in all, I think it just means that `jsxPlaceholderDefaults` real value
  > (i.e. maybe rather than being "this is a bug", should I file a "improve docs for `jsxPlaceholderDefaults`"?)

- **Issue #2628** (2026-09-22): **Cannot find package '@babel/types' when run messages:extract**
  *Symptoms*: ### Description ``` npm notice run messages:extract npm notice run lingui extract node:internal/modules/package_json_reader:301   throw new ERR_MODULE_NOT_FOUND(packageName, fileURLToPath(base), null);         ^  Error [ERR_MODULE_NOT_FOUND]: Cannot find package '@babel/types' imported from D:\Documents\xxxx\xxxx\node_modules\@lingui\babel-plugin-lingui-macro\dist\shared\babel-plugin-lingui-macro.BYtM9YP7.mjs     at Object.getPackageJSONURL (node:internal/modules/package_json_reader:301:9)     at packageResolve (node:internal/modules/esm/resolve:768:81)     at moduleResolve (node:internal/modules/esm/resolve:859:18)     at defaultResolve (node:internal/modules/esm/resolve:992:11)     at #cachedDefaultResolve (node:internal/modules/esm/loader:691:20)     at #resolveAndMaybeBlockOnLoaderThread (node:internal/modules/esm/loader:708:38)     at ModuleLoader.resolveSync (node:internal/modules/esm/loader:740:52)     at #resolve (node:internal/modules/esm/loader:673:17)     at ModuleLoader.getOrCreateModuleJob (node:internal/modules/esm/loader:593:35)     at ModuleJob.syncLink (node:internal/modules/esm/module_job:163:33) {   code: 'ERR_MODULE_NOT_FOUND' }  Node.js v24.16.0 ```  ### Verifications  - [x] I've checked [the docs](https://lingui.dev) and this isn't covered there. - [x] I've searched existing issues on [GitHub](https://github.com/lingui/js-lingui/issues).  ### Reproduction Steps  After upgrading from version 6.5.0 to 6.6.0, running `npm run messages:extract` results the e
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this!  This is a regression from #2623. `@lingui/babel-plugin-lingui-macro` has a top-level `import * as t from "@babel/types"` in its compiled output, so `@babel/types` must be resolvable from the macro package the moment it loads. #2623 changed it from a direct dependency to an optional peer dependency - and npm doesn't install optional peers at all, so nothing guarantees it's there anymore.  Most installs still work by luck: `@lingui/cli`'s own copy of `@babel/types` usually gets hoisted to the root `node_modules`. In your tree it ended up nested (e.g. under `node_modules/@lingui/cli/node_modules/`), where the macro can't see it. It wasn't caught by CI because Yarn workspace hoisting always keeps a copy resolvable in the monorepo.  Workaround until a fix is out: install it directly in your project - `npm i -D @babel/types`.  @youdie006 could you please take a look? 
  > I actually refrained from proposing a PR with a babel update to v8 because i haven't found any official instructions how to make a plugin working with both v7 and v8 versions. All possible options i'm seeing requiring to choose one or another.   There is also a way to not using `@babel/types`, babel is injecting it to the plugin - but that would require to pass this object to every function in the plugin (now it's available globally), hence a big change.   I think the best option for now would be to revert this change. 
  > Should use `import type` instead of `import` to import types from `@babel/types`.

- **Issue #2584** (2026-06-29): **Plural React macro do not work properly**
  *Symptoms*: ### Description  Trying to follow the documentation [here](https://lingui.dev/ref/macro#plural-1).  This exact usage of the `<Plural>` macro causes a "Unsupported macro usage" error at runtime. Extracting locales work as expected.  ### Verifications  - [x] I've checked [the docs](https://lingui.dev) and this isn't covered there. - [x] I've searched existing issues on [GitHub](https://github.com/lingui/js-lingui/issues).  ### Reproduction Steps  **Here is a full reproduction on a minimal project:** https://github.com/AFCMS/vite-lingui-test/tree/plural_bug  `App.tsx`: ```tsx import { Plural } from "@lingui/react/macro"  export default function App() {    return <Plural value={tt} one="One item" other="Many items" /> } ```  `lingui.config.ts`: ```ts import { defineConfig } from "@lingui/cli";  export default defineConfig({   sourceLocale: "en",   locales: ["en", "fr"],   catalogs: [     {       path: "<rootDir>/src/locales/{locale}/messages",       include: ["src"],       exclude: ["**/node_modules/**"],     },   ], }); ```  `vite.config.ts`: ```ts import { defineConfig } from "vite"; import react, { reactCompilerPreset } from "@vitejs/plugin-react"; import babel from "@rolldown/plugin-babel"; import { lingui, linguiTransformerBabelPreset } from "@lingui/vite-plugin";  // https://vite.dev/config/ export default defineConfig({   plugins: [     react(),     lingui(),     babel({ presets: [linguiTransformerBabelPreset(), reactCompilerPreset()] }),   ], });  ```  Causes a "Unsupport
  **Post-Mortem & Fix Analysis**:
  > > Here is a full reproduction on a minimal project: https://github.com/AFCMS/vite-lingui-test/tree/plural_bug  The repository is probably private, i could not open it.   It seems, that this is caused by some incopatible version of something. Probably babel. Would like to check the repro first to make a correct investigation. 
  > @timofei-iatsenko I am really really sorry I completely forgot to make the repository public 😓  Should be fixed now.
  > @AFCMS i tested it now and it builds and runs fine on my end. Try to delete and reinstall `node_modules`, you probably has some corrupted state in here  <img width="976" height="254" alt="Image" src="https://github.com/user-attachments/assets/660e4dfa-ca19-49a5-8b1b-677cd942132c" />

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

### Incident Patch 1: `c3b7838a` (2026-10-05)
**Commit Message**: fix(format-csv): read catalogs that end with a line break (#2696)

**File**: `packages/format-csv/package.json` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@
   ],
   "dependencies": {
     "@lingui/conf": "workspace:*",
-    "papaparse": "^5.4.0"
+    "papaparse": "^5.7.0"
   },
   "devDependencies": {
     "typescript": "catalog:",
```

**File**: `packages/format-csv/src/csv.test.ts` (modified, +57/-0)
```diff
@@ -31,4 +31,61 @@ describe("csv format", () => {
     const actual = format.parse(csv, {} as any)
     expect(actual).toMatchSnapshot()
   })
+
+  describe("catalog ending with a line break", () => {
+    const parsed = (translation: string) => ({
+      translation,
+      obsolete: false,
+      message: null,
+      origin: [],
+    })
+
+    it.each([
+      [
+        "LF",
+        "static,Static message\nempty,\n",
+        { static: parsed("Static message"), empty: parsed("") },
+      ],
+      [
+        "CRLF",
+        "static,Static message\r\nempty,\r\n",
+        { static: parsed("Static message"), empty: parsed("") },
+      ],
+      [
+        "LF, single row",
+        "static,Static message\n",
+        { static: parsed("Static message") },
+      ],
+    ])("should read the catalog (%s)", (_, csv, expected) => {
+      expect(format.parse(csv, {} as any)).toEqual(expected)
+    })
+
+    it("should not add an empty id to a long catalog", () => {
+      // Delimiter detection only looks at the first 10 rows, so here the
+      // empty row doesn't throw and would end up as a message with id "".
+      const ids = Array.from({ length: 12 }, (_, i) => `id${i}`)
+      const csv = ids.map((id) => `${id},Translation\n`).join("")
+
+      expect(Object.keys(format.parse(csv, {} as any))).toEqual(ids)
+    })
+
+    it("should read back a written catalog", () => {
+      const catalog = {
+        static: { translation: "Static message" },
+        withComma: { translation: "One, two" },
+      }
+      const csv = format.serialize(catalog, {} as any) + "\r\n"
+
+      expect(format.parse(csv, {} as any)).toEqual({
+        static: parsed("Static message"),
+        withComma: parsed("One, two"),
+      })
+    })
+  })
+
+  it("should throw on malformed csv", () => {
+    expect(() =>
+      format.parse('static,"Static message\nother,Other', {} as any),
+    ).toThrow("MissingQuotes")
+  })
 })
```

**File**: `packages/format-csv/src/csv.ts` (modified, +2/-1)
```diff
@@ -11,7 +11,8 @@ const serialize = (catalog: CatalogType) => {
 }
 
 const deserialize = (raw: string): { [key: string]: MessageType } => {
-  const rawCatalog = Papa.parse<[string, string]>(raw)
+  // Skip the trailing line break that editors and spreadsheets add on save.
+  const rawCatalog = Papa.parse<[string, string]>(raw, { skipEmptyLines: true })
   const messages: CatalogType = {}
   if (rawCatalog.errors.length) {
     throw new Error(
```

**File**: `yarn.lock` (modified, +5/-5)
```diff
@@ -1634,7 +1634,7 @@ __metadata:
   resolution: "@lingui/format-csv@workspace:packages/format-csv"
   dependencies:
     "@lingui/conf": "workspace:*"
-    papaparse: "npm:^5.4.0"
+    papaparse: "npm:^5.7.0"
     typescript: "catalog:"
     unbuild: "catalog:"
     vitest: "catalog:"
@@ -11228,10 +11228,10 @@ __metadata:
   languageName: node
   linkType: hard
 
-"papaparse@npm:^5.4.0":
-  version: 5.4.0
-  resolution: "papaparse@npm:5.4.0"
-  checksum: 10/2d2c171128f6c93b554daa6925ac4eba142e1ddd49bae771c767f53adb8fbf222aebf363315c48fb4103d4e4283012a247eedfd16eb4b1d7edb5dc982b1983eb
+"papaparse@npm:^5.7.0":
+  version: 5.7.0
+  resolution: "papaparse@npm:5.7.0"
+  checksum: 10/ce787e38d109c75b261bf2e0ea724fe655430554f7dfec98c82b8e95c18d7b3005db25f3d290847383e8debb0c0774c518ea3439e6a22cc864dd0b8df7db0f20
   languageName: node
   linkType: hard
 
```

---

### Incident Patch 2: `9f400ef6` (2026-10-01)
**Commit Message**: fix(format-po-gettext): write one msgstr per plural form of locale (#2690)

**File**: `packages/format-po-gettext/src/__snapshots__/po-gettext.test.ts.snap` (modified, +1/-0)
```diff
@@ -768,6 +768,7 @@ msgid "custom.id"
 msgid_plural "custom.id_plural"
 msgstr[0] ""
 msgstr[1] ""
+msgstr[2] ""
 
 #. js-lingui:icu=%7BanotherCount%2C+plural%2C+one+%7BSingular+case%7D+other+%7BCase+number+%7BanotherCount%7D%7D%7D&pluralize_on=anotherCount
 msgid "Singular case"
```

**File**: `packages/format-po-gettext/src/po-gettext.test.ts` (modified, +78/-0)
```diff
@@ -355,6 +355,84 @@ msgstr[2] "{count} jours"
     `)
   })
 
+  describe("untranslated plurals", () => {
+    const message = "{count, plural, one {# book} other {# books}}"
+    const id = generateMessageId(message)
+    const catalog: CatalogType = {
+      [id]: { message, translation: "" },
+    }
+
+    const getMsgstrKeys = (pofile: string) => pofile.match(/^msgstr\[\d+\]/gm)
+
+    it("should write a msgstr for each plural form of the language", () => {
+      const ru = format.serialize(catalog, {
+        ...defaultSerializeCtx,
+        locale: "ru",
+      }) as string
+      const ja = format.serialize(catalog, {
+        ...defaultSerializeCtx,
+        locale: "ja",
+      }) as string
+
+      expect(getMsgstrKeys(ru)).toEqual(["msgstr[0]", "msgstr[1]", "msgstr[2]"])
+      expect(getMsgstrKeys(ja)).toEqual(["msgstr[0]"])
+    })
+
+    it("should parse back all translated plural forms", () => {
+      const pofile = format.serialize(catalog, {
+        ...defaultSerializeCtx,
+        locale: "ru",
+      }) as string
+
+      const translated = pofile
+        .replace('msgstr[0] ""', 'msgstr[0] "# книга"')
+        .replace('msgstr[1] ""', 'msgstr[1] "# книги"')
+        .replace('msgstr[2] ""', 'msgstr[2] "# книг"')
+
+      const parsed = format.parse(translated, {
+        ...defaultParseCtx,
+        locale: "ru",
+      })
+
+      expect(parsed).toMatchObject({
+        [id]: {
+          translation:
+            "{count, plural, one {# книга} few {# книги} other {# книг}}",
+        },
+      })
+    })
+
+    it("should prefer nplurals from the Plural-Forms header", () => {
+      const existing = `msgid ""
+msgstr ""
+"Language: ru\\n"
+"Plural-Forms: nplurals=4; plural=(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<12 || n%100>14) ? 1 : n%10==0 || (n%10>=5 && n%10<=9) || (n%100>=11 && n%100<=14)? 2 : 3);\\n"
+`
+
+      const pofile = format.serialize(catalog, {
+        ...defaultSerializeCtx,
+        locale: "ru",
+        existing,
+      }) as string
+
+      expect(getMsgstrKeys(pofile)).toEqual([
+        "msgstr[0]",
+        "msgstr[1]",
+        "msgstr[2]",
+        "msgstr[3]",
+      ])
+    })
+
+    it("should keep two msgstr in the template", () => {
+      const pofile = format.serialize(catalog, {
+        ...defaultSerializeCtx,
+        locale: undefined,
+      }) as string
+
+      expect(getMsgstrKeys(pofile)).toEqual(["msgstr[0]", "msgstr[1]"])
+    })
+  })
+
   it("should correctly handle skipped form", () => {
     // in this test Plural-Forms header defines 4 forms via `nplurals=4`
     // but expression never returns 2 form, only [0, 1, 3]
```

**File**: `packages/format-po-gettext/src/po-gettext.ts` (modified, +16/-2)
```diff
@@ -9,7 +9,10 @@ import type { CatalogFormatter, CatalogType, MessageType } from "@lingui/conf"
 import { generateMessageId } from "@lingui/message-utils/generateMessageId"
 import { parsePoFile, formatter as poFormatter } from "@lingui/format-po"
 import type { PoFormatterOptions } from "@lingui/format-po"
-import { mapGettextPlurals2Icu } from "./utils/mapGettextPlurals2Icu"
+import {
+  getLanguageDef,
+  mapGettextPlurals2Icu,
+} from "./utils/mapGettextPlurals2Icu"
 
 export type PoGettextFormatterOptions = PoFormatterOptions & {
   /**
@@ -124,7 +127,7 @@ function serializePlurals(
 
       // If there is a translated value, parse that instead of the original message to prevent overriding localized
       // content with the original message. If there is no translated value, don't touch msgstr, since marking item as
-      // plural (above) already causes `pofile` to automatically generate `msgstr[0]` and `msgstr[1]`.
+      // plural (above) already causes `pofile` to automatically generate empty `msgstr[]` entries.
       if (message.translation) {
         const ast = parseIcu(message.translation)[0] as Select
         if (ast.cases == null) {
@@ -508,7 +511,18 @@ export function formatter(
     serialize(catalog, ctx): string {
       const po = parsePoFile(formatter.serialize(catalog, ctx) as string)
 
+      // Without a Plural-Forms header, parse() reads msgstr[] using the CLDR plural
+      // forms of the language, so leave the same number of msgstr[] to translate.
+      const nplurals =
+        !po.headers["Plural-Forms"] && po.headers.Language
+          ? getLanguageDef(po.headers.Language)?.plurals
+          : undefined
+
       po.items = po.items.map((item) => {
+        if (nplurals) {
+          item.nplurals = nplurals
+        }
+
         const isGeneratedId = !item.extractedComments.includes(
           "js-lingui-explicit-id",
         )
```

---

### Incident Patch 3: `cf3d251f` (2026-10-01)
**Commit Message**: chore: bump @lingui/native-tools to 0.1.5 (#2691)

**File**: `packages/cli/package.json` (modified, +1/-1)
```diff
@@ -60,7 +60,7 @@
     "@lingui/core": "workspace:*",
     "@lingui/format-po": "workspace:*",
     "@lingui/message-utils": "workspace:*",
-    "@lingui/native-tools": "^0.1.3",
+    "@lingui/native-tools": "^0.1.5",
     "chokidar": "5.0.0",
     "cli-table3": "^0.6.5",
     "commander": "^14.0.2",
```

**File**: `packages/vite-plugin/package.json` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@
   "dependencies": {
     "@lingui/cli": "workspace:*",
     "@lingui/conf": "workspace:*",
-    "@lingui/native-tools": "^0.1.3"
+    "@lingui/native-tools": "^0.1.5"
   },
   "peerDependencies": {
     "@babel/core": "^7.29.0 || ^8.0.0",
```

**File**: `yarn.lock` (modified, +43/-43)
```diff
@@ -1533,7 +1533,7 @@ __metadata:
     "@lingui/core": "workspace:*"
     "@lingui/format-po": "workspace:*"
     "@lingui/message-utils": "workspace:*"
-    "@lingui/native-tools": "npm:^0.1.3"
+    "@lingui/native-tools": "npm:^0.1.5"
     "@lingui/test-utils": "workspace:*"
     "@rolldown/plugin-babel": "npm:^0.2.3"
     "@types/babel__generator": "npm:^7.27.0"
@@ -1740,82 +1740,82 @@ __metadata:
   languageName: unknown
   linkType: soft
 
-"@lingui/native-tools-android-arm64@npm:0.1.3":
-  version: 0.1.3
-  resolution: "@lingui/native-tools-android-arm64@npm:0.1.3"
+"@lingui/native-tools-android-arm64@npm:0.1.5":
+  version: 0.1.5
+  resolution: "@lingui/native-tools-android-arm64@npm:0.1.5"
   conditions: os=android & cpu=arm64
   languageName: node
   linkType: hard
 
-"@lingui/native-tools-darwin-arm64@npm:0.1.3":
-  version: 0.1.3
-  resolution: "@lingui/native-tools-darwin-arm64@npm:0.1.3"
+"@lingui/native-tools-darwin-arm64@npm:0.1.5":
+  version: 0.1.5
+  resolution: "@lingui/native-tools-darwin-arm64@npm:0.1.5"
   conditions: os=darwin & cpu=arm64
   languageName: node
   linkType: hard
 
-"@lingui/native-tools-darwin-x64@npm:0.1.3":
-  version: 0.1.3
-  resolution: "@lingui/native-tools-darwin-x64@npm:0.1.3"
+"@lingui/native-tools-darwin-x64@npm:0.1.5":
+  version: 0.1.5
+  resolution: "@lingui/native-tools-darwin-x64@npm:0.1.5"
   conditions: os=darwin & cpu=x64
   languageName: node
   linkType: hard
 
-"@lingui/native-tools-linux-arm64-gnu@npm:0.1.3":
-  version: 0.1.3
-  resolution: "@lingui/native-tools-linux-arm64-gnu@npm:0.1.3"
+"@lingui/native-tools-linux-arm64-gnu@npm:0.1.5":
+  version: 0.1.5
+  resolution: "@lingui/native-tools-linux-arm64-gnu@npm:0.1.5"
   conditions: os=linux & cpu=arm64 & libc=glibc
   languageName: node
   linkType: hard
 
-"@lingui/native-tools-linux-arm64-musl@npm:0.1.3":
-  version: 0.1.3
-  resolution: "@lingui/native-tools-linux-arm64-musl@npm:0.1.3"
+"@lingui/native-tools-linux-arm64-musl@npm:0.1.5":
+  version: 0.1.5
+  resolution: "@lingui/native-tools-linux-arm64-musl@npm:0.1.5"
   conditions: os=linux & cpu=arm64 & libc=musl
   languageName: node
   linkType: hard
 
-"@lingui/native-tools-linux-x64-gnu@npm:0.1.3":
-  version: 0.1.3
-  resolution: "@lingui/native-tools-linux-x64-gnu@npm:0.1.3"
+"@lingui/native-tools-linux-x64-gnu@npm:0.1.5":
+  version: 0.1.5
+  resolution: "@lingui/native-tools-linux-x64-gnu@npm:0.1.5"
   conditions: os=linux & cpu=x64 & libc=glibc
   languageName: node
   linkType: hard
 
-"@lingui/native-tools-linux-x64-musl@npm:0.1.3":
-  version: 0.1.3
-  resolution: "@lingui/native-tools-linux-x64-musl@npm:0.1.3"
+"@lingui/native-tools-linux-x64-musl@npm:0.1.5":
+  version: 0.1.5
+  resolution: "@lingui/native-tools-linux-x64-musl@npm:0.1.5"
   conditions: os=linux & cpu=x64 & libc=musl
   languageName: node
   linkType: hard
 
-"@lingui/native-tools-win32-arm64-msvc@npm:0.1.3":
-  version: 0.1.3
-  resolution: "@lingui/native-tools-win32-arm64-msvc@npm:0.1.3"
+"@lingui/native-tools-win32-arm64-msvc@npm:0.1.5":
+  version: 0.1.5
+  resolution: "@lingui/native-tools-win32-arm64-msvc@npm:0.1.5"
   conditions: os=win32 & cpu=arm64
   languageName: node
   linkType: hard
 
-"@lingui/native-tools-win32-x64-msvc@npm:0.1.3":
-  version: 0.1.3
-  resolution: "@lingui/native-tools-win32-x64-msvc@npm:0.1.3"
+"@lingui/native-tools-win32-x64-msvc@npm:0.1.5":
+  version: 0.1.5
+  resolution: "@lingui/native-tools-win32-x64-msvc@npm:0.1.5"
   conditions: os=win32 & cpu=x64
   languageName: node
   linkType: hard
 
-"@lingui/native-tools@npm:^0.1.3":
-  version: 0.1.3
-  resolution: "@lingui/native-tools@npm:0.1.3"
-  dependencies:
-    "@lingui/native-tools-android-arm64": "npm:0.1.3"
-    "@lingui/native-tools-darwin-arm64": "npm:0.1.3"
-    "@lingui/native-tools-darwin-x64": "npm:0.1.3"
-    "@lingui/native-tools-linux-arm64-gnu": "npm:0.1.3"
-    "@lingui/native-tools-linux-arm64-musl": "npm:0.1.3"
-    "@lingui/native-tools-linux-x64-gnu": "npm:0.1.3"
-    "@lingui/native-tools-linux-x64-musl": "npm:0.1.3"
-    "@lingui/native-tools-win32-arm64-msvc": "npm:0.1.3"
-    "@lingui/native-tools-win32-x64-msvc": "npm:0.1.3"
+"@lingui/native-tools@npm:^0.1.5":
+  version: 0.1.5
+  resolution: "@lingui/native-tools@npm:0.1.5"
+  dependencies:
+    "@lingui/native-tools-android-arm64": "npm:0.1.5"
+    "@lingui/native-tools-darwin-arm64": "npm:0.1.5"
+    "@lingui/native-tools-darwin-x64": "npm:0.1.5"
+    "@lingui/native-tools-linux-arm64-gnu": "npm:0.1.5"
+    "@lingui/native-tools-linux-arm64-musl": "npm:0.1.5"
+    "@lingui/native-tools-linux-x64-gnu": "npm:0.1.5"
+    "@lingui/native-tools-linux-x64-musl": "npm:0.1.5"
+    "@lingui/native-tools-win32-arm64-msvc": "npm:0.1.5"
+    "@lingui/native-tools-win32-x64-msvc": "npm:0.1.5"
     "@swc/types": "npm:^0.1.25"
   peerDependencies:
     "@lingui/conf": ^6.0.1
@@ -1838,7 +1838,7 @@ __metadata:
       optional: true
     "@lingui/native-tools-win32-x64-msvc":
       optional: true
-  checksum: 
```

---

### Incident Patch 4: `da831768` (2026-10-01)
**Commit Message**: docs(guides): Translator-friendly Messages (#2684)

**File**: `website/blog/2026-04-22-announcing-lingui-6.0/index.md` (modified, +3/-1)
```diff
@@ -136,7 +136,7 @@ better context for translators:
 
 Named placeholders help translators understand _what_ the value represents, so they can choose the correct grammar or wording for the target language.
 
-📖 Read more about the `ph()` macro in the [macro documentation](/ref/macro#ph).
+📖 Read more about the `ph()` macro in the [macro documentation](/ref/macro#ph) and in the [Translator-friendly Messages](/guides/translator-friendly-messages) guide.
 
 ## What's New in 6.0?
 
@@ -223,6 +223,8 @@ The result is more human-readable messages, better translator context, and fewer
 
 The same capability is also available in [`@lingui/swc-plugin`](/ref/swc-plugin), so teams using either Babel or SWC can keep placeholder naming behavior consistent.
 
+📖 See the [Translator-friendly Messages](/guides/translator-friendly-messages#name-your-tags) guide for configuration details and limitations.
+
 ### Vue 3 Reactivity Transform in Vue Extractor
 
 The Vue extractor now supports [Vue's Reactivity Transform](https://github.com/vuejs/rfcs/discussions/502) (reactive props destructure in `<script setup>`). In Vue 3, destructuring props from `defineProps()` is compiled in a way that can change how variables appear in the generated code. If the extractor runs on the raw source while your app runs on the compiled output, message IDs can diverge and translations may not resolve at runtime.
```

**File**: `website/docs/guides/explicit-vs-generated-ids.md` (modified, +1/-1)
```diff
@@ -74,7 +74,7 @@ By default, when using generated IDs, the same text elements are extracted with
 
 To distinguish these two cases, you can add `context` to messages. The same text elements with different contexts are extracted with different IDs. Then, they can be translated differently and merged back into the application as different translation entries.
 
-Regardless of whether you use generated IDs or not, adding context makes the translation process less challenging and helps translators interpret the source accurately. You, in return, get translations of better quality faster and decrease the number of context-related issues you would need to solve.
+Regardless of whether you use generated IDs or not, adding context makes the translation process less challenging and helps translators interpret the source accurately. You, in return, get translations of better quality faster and decrease the number of context-related issues you would need to solve. See [Translator-friendly Messages](/guides/translator-friendly-messages) for the other ways to give translators context.
 
 Examples:
 
```

**File**: `website/docs/guides/message-extraction.md` (modified, +1/-1)
```diff
@@ -88,7 +88,7 @@ const msg2 = t`Cancel`;
 
 Both messages will be extracted with `context="settings"` and `comment="Settings page"`. The directive values persist for all subsequent macros until overridden by another directive or cleared with `lingui-reset`.
 
-See [`lingui-set` Comment Directive](/ref/macro#lingui-directive) in the Macros reference for full details and examples.
+See [`lingui-set` Comment Directive](/ref/macro#lingui-directive) in the Macros reference for full details and examples, and [Translator-friendly Messages](/guides/translator-friendly-messages#set-context-once-per-file) for when to use directives.
 
 ### Explicitly Marking Messages
 
```

**File**: `website/docs/guides/pseudolocalization.md` (modified, +12/-0)
```diff
@@ -21,6 +21,18 @@ import { defineConfig } from "@lingui/cli";
 export default defineConfig({
   locales: ["en", "pseudo-LOCALE"],
   pseudoLocale: { locale: "pseudo-LOCALE" },
+  fallbackLocales: {
+    "pseudo-LOCALE": "en",
+  },
+});
+```
+
+To generate several pseudolocales at once, for example one left-to-right and one right-to-left, pass an array:
+
+```ts title="lingui.config.{ts,js}"
+import { defineConfig } from "@lingui/cli";
+
+export default defineConfig({
   locales: ["en", "pseudo-LOCALE", "pseudo-RTL"],
   pseudoLocale: [{ locale: "pseudo-LOCALE" }, { locale: "pseudo-RTL", rightToLeft: true }],
   fallbackLocales: {
```

**File**: `website/docs/guides/translator-friendly-messages.md` (added, +277/-0)
```diff
@@ -0,0 +1,277 @@
+---
+title: Translator-friendly Messages
+description: Write Lingui messages that give translators and AI the context they need - whole sentences, named placeholders and tags, comments, and context - and enforce it with ESLint
+---
+
+# Translator-friendly Messages
+
+Translators rarely see your UI. They see a catalog: one message at a time, out of order, with no screen around it. AI translation tools see exactly the same thing. Everything they can't learn from the message itself is a guess, and every guess is a bug you find only after release.
+
+Lingui gives you several ways to put that missing knowledge into the message. This guide walks through them, from the sentence itself down to a single placeholder, and shows how to enforce each one with the [ESLint Plugin](/ref/eslint-plugin) so quality doesn't depend on code review.
+
+## Keep the Sentence Whole
+
+The most common context loss is splitting a sentence into pieces. Word order, grammar, and agreement differ between languages, so a translator needs the entire sentence to produce a correct one.
+
+Don't build sentences from fragments:
+
+```jsx
+// ❌ Three unrelated messages; nothing can be reordered in translation
+<Trans>You have</Trans> {count} <Trans>unread messages</Trans>
+```
+
+Use one message with placeholders, and let ICU handle the plural forms:
+
+```jsx
+import { Plural } from "@lingui/react/macro";
+
+<Plural value={count} one="You have # unread message" other="You have # unread messages" />;
+```
+
+The same applies to markup. [`Trans`](/ref/macro#trans) extracts a sentence with inline elements as a single string, so the translator can move the link to wherever their language needs it:
+
+```jsx
+import { Trans } from "@lingui/react/macro";
+
+<Trans>
+  Read the <a href="/docs">docs</a> before you start.
+</Trans>;
+
+// extracted message: "Read the <0>docs</0> before you start."
+```
+
+Use [`select`](/ref/macro#select) for grammatical variations such as gender instead of branching in code, so the whole sentence stays in one message for every variant. See [Pluralization](/guides/plurals) for the full set of ICU options.
+
+:::tip Enforce with ESLint
+[`no-single-variables-to-translate`](https://github.com/lingui/eslint-plugin/blob/main/docs/rules/no-single-variables-to-translate.md) catches `` t`${value}` `` and `<Trans>{value}</Trans>`, [`no-single-tag-to-translate`](https://github.com/lingui/eslint-plugin/blob/main/docs/rules/no-single-tag-to-translate.md) catches `<Trans><b>{value}</b></Trans>`, and [`no-trans-inside-trans`](https://github.com/lingui/eslint-plugin/blob/main/docs/rules/no-trans-inside-trans.md) catches a sentence that was split into nested `Trans` elements. All three are part of the recommended config.
+:::
+
+## Name Your Placeholders
+
+Simple variables become named placeholders automatically. Any other expression becomes a positional one:
+
+```js
+import { t } from "@lingui/core/macro";
+
+t`Hello ${name}`; // Hello {name}
+t`Hello ${user.name}`; // Hello {0}
+t`Hello ${getUserName()}`; // Hello {0}
+```
+
+`{0}` says nothing about what will be inserted. Is it a name, a number, a date? Does it need an article, or a specific case? A named placeholder answers those questions for free.
+
+Use the [`ph`](/ref/macro#ph) macro to label any expression:
+
+```js
+import { t, ph } from "@lingui/core/macro";
+
+t`Hello ${ph({ name: user.name })}`; // Hello {name}
+t`Due ${ph({ dueDate: formatDate(task.due) })}`; // Due {dueDate}
+```
+
+It works everywhere expressions are accepted, including [`plural`](/ref/macro#plural), [`select`](/ref/macro#select), and JSX macros:
+
+```jsx
+import { Trans } from "@lingui/react/macro";
+import { ph } from "@lingui/core/macro";
+
+<Trans>Welcome back, {ph({ username: getUser().name })}!</Trans>;
+
+// extracted message: "Welcome back, {username}!"
+```
+
+Extracting the expression into a well-named variable first gives the same result and is often the more readable choice.
+
+:::note
+Because variable names become placeholder names, renaming a variable changes the message and therefore its generated ID. `ph` decouples the two: the label stays stable even when the code around it is refactored.
+:::
+
+### Placeholder Values in Catalog Comments
+
+For positional placeholders that remain, Lingui prints the source expression as a comment in the PO catalog, so translators at least see where the value comes from:
+
+```po
+#. placeholder {0}: user.name
+msgid "Hello {0}"
+msgstr ""
+```
+
+This is on by default and controlled by the [`printPlaceholdersInComments`](/ref/catalog-formats#po-configuration) formatter option. Treat it as a safety net, not a replacement for naming: a comment is easier to overlook than the placeholder itself, and it is not shown by every translation tool.
+
+:::tip Enforce with ESLint
+[`no-expression-in-message`](https://github.com/lingui/eslint-plugin/blob/main/docs/rules/no-expression-in-message.md) reports member expressions and function calls
```

**File**: `website/docs/ref/conf.md` (modified, +24/-0)
```diff
@@ -683,6 +683,30 @@ A mapping of JSX element tag names to default placeholder names. When a JSX elem
 
 Explicit attributes (via `jsxPlaceholderAttribute`) take priority over defaults.
 
+:::caution One Name per Distinct Element
+A placeholder name can be used only once per message. If two elements in the same `<Trans>` resolve to the same name but differ in tag or props, for example two `<a>` elements with different `href` values both mapped to `link`, the macro throws an error instead of numbering them (`<link1>`, `<link2>`). Give at least one of them an explicit name via `jsxPlaceholderAttribute`:
+
+```jsx
+<Trans>
+  Read the{" "}
+  <a _t="docs" href="/docs">
+    docs
+  </a>{" "}
+  or the{" "}
+  <a _t="faq" href="/faq">
+    FAQ
+  </a>
+  .
+</Trans>
+
+// extracted message: "Read the <docs>docs</docs> or the <faq>FAQ</faq>."
+```
+
+Identical elements, such as two `<br />` with no props, share a single placeholder without error.
+:::
+
+See [Translator-friendly Messages](/guides/translator-friendly-messages#name-your-tags) for when and why to name tags.
+
 :::tip Enforce Named Placeholders with ESLint
 You can enforce that all JSX tags in `<Trans>` have named placeholders across your codebase using the Lingui [ESLint Plugin](/ref/eslint-plugin) rule [`no-unnamed-tag-placeholders`](https://github.com/lingui/eslint-plugin/blob/main/docs/rules/no-unnamed-tag-placeholders.md).
 :::
```

**File**: `website/docs/ref/macro.mdx` (modified, +3/-3)
```diff
@@ -503,7 +503,7 @@ const message = /** i18n */ {
 
 The `ph` macro is used to provide explicit labels for placeholders. By default, only simple variables are referenced by name in transformed messages. Complex expressions (like function calls) are referenced by numeric index (`{0}`, `{1}`), which provides little context for translators.
 
-The `ph` macro solves this by letting you assign meaningful names to any expression:
+The `ph` macro solves this by letting you assign meaningful names to any expression. See [Translator-friendly Messages](/guides/translator-friendly-messages#name-your-placeholders) for guidance on when to use it:
 
 ```js
 import { t, ph } from "@lingui/core/macro";
@@ -549,7 +549,7 @@ import { Trans } from "@lingui/react";
 
 ### `lingui-set` / `lingui-reset` Comment Directives {#lingui-directive}
 
-Instead of passing `context` and/or `comment` to every macro call, you can use the `lingui-set` and `lingui-reset` comment directives to set these values for all subsequent macros in the same file (or until the next directive resets/overrides them).
+Instead of passing `context` and/or `comment` to every macro call, you can use the `lingui-set` and `lingui-reset` comment directives to set these values for all subsequent macros in the same file (or until the next directive resets/overrides them). See [Translator-friendly Messages](/guides/translator-friendly-messages#set-context-once-per-file) for typical use cases.
 
 - **`lingui-set`**: Sets the specified parameters for all subsequent macros. Requires at least one parameter.
 - **`lingui-reset`**: Clears all previously set parameters. Also accepts new parameters to set like `lingui-set`.
@@ -703,7 +703,7 @@ import { Trans } from "@lingui/react";
 
 #### `comment`
 
-Comment for translators to give them additional information about the message. It will be visible in the [TMS](/tools/introduction) if it is supported, and in the [catalog format](/ref/catalog-formats). It will be removed from production code.
+Comment for translators to give them additional information about the message. It will be visible in the [TMS](/tools/introduction) if it is supported, and in the [catalog format](/ref/catalog-formats). It will be removed from production code. See [Translator-friendly Messages](/guides/translator-friendly-messages#explain-what-the-message-means) for what makes a useful comment.
 
 :::tip
 You can require every message to describe itself to translators with the Lingui [ESLint Plugin](/ref/eslint-plugin) rule [`require-comment`](https://github.com/lingui/eslint-plugin/blob/main/docs/rules/require-comment.md). It accepts a [`lingui-set comment="..."`](#lingui-directive) directive as well, which is the only option for tagged template literals such as `` t`Save` ``.
```

**File**: `website/docs/tutorials/react.md` (modified, +3/-1)
```diff
@@ -382,9 +382,11 @@ Any expressions are allowed, not just simple variables. The only difference is,
   ```
 
 :::caution
-Try to keep your messages simple and avoid complex expressions. During extraction, these expressions will be replaced by placeholders, resulting in a lack of context for translators. There is also a special rule in Lingui [ESLint Plugin](/ref/eslint-plugin) to catch these cases: [`no-expression-in-message`](https://github.com/lingui/eslint-plugin/blob/main/docs/rules/no-expression-in-message.md).
+Try to keep your messages simple and avoid complex expressions. During extraction, these expressions will be replaced by positional placeholders such as `{0}`, resulting in a lack of context for translators. When you can't avoid an expression, give it a name with the [`ph`](/ref/macro#ph) macro: `` t`Hello ${ph({ name: user.name })}` `` is extracted as `Hello {name}`. There is also a special rule in Lingui [ESLint Plugin](/ref/eslint-plugin) to catch these cases: [`no-expression-in-message`](https://github.com/lingui/eslint-plugin/blob/main/docs/rules/no-expression-in-message.md).
 
 Similarly, to prevent numbered tag placeholders like `<0>` from depriving translators of context, use [named tag placeholders](/ref/conf#macrojsxplaceholderattribute) and enforce them with [`no-unnamed-tag-placeholders`](https://github.com/lingui/eslint-plugin/blob/main/docs/rules/no-unnamed-tag-placeholders.md).
+
+See [Translator-friendly Messages](/guides/translator-friendly-messages) for the complete set of practices.
 :::
 
 ### Dates and Numbers
```

---

### Incident Patch 5: `7faa6ba6` (2026-09-28)
**Commit Message**: docs: rewrite the monorepo setup guide (#2667)

**File**: `website/docs/guides/monorepo.md` (modified, +227/-5)
```diff
@@ -1,12 +1,234 @@
 ---
 title: Monorepo Setup
-description: How to use Lingui in a monorepo with one root Babel and Lingui configuration that each package extends or overrides
+description: How to organize message catalogs, extraction and the shared runtime when Lingui is used across several apps and packages in a monorepo
 ---
 
 # Monorepo
 
-If you're using lingui within a monorepo you need:
+Lingui has no monorepo-specific mode. Everything on this page is regular configuration; what changes in a monorepo is where you put it. You need to decide three things:
 
-- 1x `babel.config.js` within root
-- 1x `lingui.config.js` within root
-- And **n**-times `lingui.config.js` per package which extends/overrides from root
+1. Where the catalogs live: one catalog per app, or one per package.
+2. Where extraction runs: which `lingui.config` scans which sources.
+3. How the runtime is shared: one `I18nProvider` and one copy of `@lingui/react`.
+
+The examples use the layout below. It works the same with pnpm, Yarn or npm workspaces, with or without Turborepo or Nx on top.
+
+```bash
+.
+├── apps/
+│   ├── web/
+│   └── admin/
+└── packages/
+    └── ui/     # shared components that render <Trans>
+```
+
+## Choose a Strategy
+
+| Your setup                                                                           | Strategy                                                                   |
+| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
+| Internal (unpublished) packages, one or a few apps                                   | [One catalog per app](#one-catalog-per-app). Start here                    |
+| Several apps share many strings that should be translated once                       | [Catalog per package, merged per app](#catalog-per-package-merged-per-app) |
+| Shared packages, and each app catalog should contain only what the app actually uses | [Dependency-based extraction](#dependency-based-extraction), experimental  |
+| Packages published to npm and used outside the monorepo                              | [Published packages](#published-packages)                                  |
+
+## One Catalog per App
+
+Each app owns a `lingui.config.ts`, its catalogs and the `extract` and `compile` scripts. Shared packages have no Lingui config. The app includes their source directories, so their messages land in the catalog of every app that uses them:
+
+```ts title="apps/web/lingui.config.ts"
+import { defineConfig } from "@lingui/conf";
+
+export default defineConfig({
+  sourceLocale: "en",
+  locales: ["en", "cs"],
+  catalogs: [
+    {
+      path: "<rootDir>/src/locales/{locale}",
+      include: ["<rootDir>/src", "<rootDir>/../../packages/ui/src"],
+    },
+  ],
+});
+```
+
+Run [`lingui extract`](/ref/cli#extract) and [`lingui compile`](/ref/cli#compile) from `apps/web` through the app's `package.json` scripts:
+
+```json title="apps/web/package.json"
+{
+  "scripts": {
+    "extract": "lingui extract",
+    "compile": "lingui compile"
+  }
+}
+```
+
+Scripts run with the package as the working directory, so the CLI finds the app's config. From another directory, pass `--config apps/web/lingui.config.ts`. Every catalog contains exactly what its app renders. Any bundler plugin works unchanged.
+
+The trade-off is that a string from `packages/ui` is translated once per app. A translation management system with translation memory removes most of that cost.
+
+:::tip Derive the include list from workspace dependencies
+Instead of listing packages by hand, read them from the app's `package.json`. The catalog then follows the dependency graph automatically:
+
+```ts title="apps/web/lingui.config.ts"
+import { readFileSync } from "node:fs";
+import { defineConfig } from "@lingui/conf";
+
+const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));
+
+const workspacePackages = Object.keys(pkg.dependencies ?? {})
+  .filter((name) => name.startsWith("@acme/"))
+  .map((name) => `<rootDir>/../../packages/${name.split("/")[1]}/src`);
+
+export default defineConfig({
+  sourceLocale: "en",
+  locales: ["en", "cs"],
+  catalogs: [
+    {
+      path: "<rootDir>/src/locales/{locale}",
+      include: ["<rootDir>/src", ...workspacePackages],
+    },
+  ],
+});
+```
+
+:::
+
+## Catalog per Package, Merged per App
+
+Every package with messages gets its own catalog, kept next to its sources and translated once. Each app lists its own catalog and those of the packages it uses, and merges them at compile time with [`catalogsMergePath`](/ref/conf#catalogsmergepath):
+
+```ts title="apps/admin/lingui.config.ts"
+import { defineConfig } from "@lingui/conf";
+
+export default defineConfig({
+  sourceLocale: "en",
+  locales: ["en", "cs"],
+  catalogs: [
+    {
+      path: "<rootDir>/locales/{locale}",
+      include: ["<rootDir>/src"],
+    },
+    {
+      path: "<rootDir>/..
```

---

### Incident Patch 6: `cac98805` (2026-09-28)
**Commit Message**: fix(cli): resolve workers from caller source (#2682)

**File**: `packages/cli/src/api/typedPool.test.ts` (added, +60/-0)
```diff
@@ -0,0 +1,60 @@
+import { existsSync } from "node:fs"
+import { Tinypool } from "tinypool"
+import { afterEach, describe, expect, test, vi } from "vitest"
+import { createWorkerPool } from "./typedPool.js"
+
+vi.mock("tinypool")
+
+afterEach(() => {
+  vi.clearAllMocks()
+  vi.unstubAllEnvs()
+})
+
+const workerPaths = [
+  "../workers/compileWorkerWrapper",
+  "../workers/extractWorkerWrapper",
+  "../extract-experimental/workers/extractWorkerWrapper",
+  "../workers/missingWorkerWrapper",
+] as const
+
+describe.each(["test", "production", "development", undefined])(
+  "worker resolution with NODE_ENV=%s",
+  (environment) => {
+    test.each(workerPaths)(
+      "uses shipped JavaScript for %s from a built module",
+      (workerPath) => {
+        vi.stubEnv("NODE_ENV", environment)
+        const baseUrl = new URL(
+          "../../dist/api/workerPools.js",
+          import.meta.url,
+        )
+
+        createWorkerPool(workerPath, baseUrl.href, 1)
+
+        expect(Tinypool).toHaveBeenCalledExactlyOnceWith({
+          filename: new URL(`${workerPath}.prod.js`, baseUrl).href,
+          minThreads: 1,
+          maxThreads: 1,
+        })
+      },
+    )
+
+    test.each(workerPaths)(
+      "uses an existing source harness for %s from a TypeScript module",
+      (workerPath) => {
+        vi.stubEnv("NODE_ENV", environment)
+        const baseUrl = new URL("./workerPools.ts", import.meta.url)
+        const wrapperUrl = new URL(`${workerPath}.jiti.js`, baseUrl)
+
+        createWorkerPool(workerPath, baseUrl.href, 1)
+
+        expect(Tinypool).toHaveBeenCalledExactlyOnceWith({
+          filename: wrapperUrl.href,
+          minThreads: 1,
+          maxThreads: 1,
+        })
+        expect(existsSync(wrapperUrl)).toBe(true)
+      },
+    )
+  },
+)
```

**File**: `packages/cli/src/api/typedPool.ts` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ export type WorkerPool<TFn extends (...args: never[]) => unknown> = TypedPool<
 
 const resolveWorkerFile = (basePath: string, baseUrl: string) =>
   new URL(
-    process.env.NODE_ENV === "test"
+    new URL(baseUrl).pathname.endsWith(".ts")
       ? `${basePath}.jiti.js`
       : `${basePath}.prod.js`,
     baseUrl,
```

---

### Incident Patch 7: `f97cb921` (2026-09-28)
**Commit Message**: fix(solid): match macro-accepted placeholder names in formatElements (#2687)

**File**: `packages/solid/src/format.test.tsx` (modified, +36/-0)
```diff
@@ -82,6 +82,42 @@ describe("formatElements", function () {
     ).toEqual('<a href="/about">About</a>')
   })
 
+  it("should format paired elements whose names use the macro charset", function () {
+    const link = (props: { children?: JSX.Element }) => (
+      <a href="/terms">{props.children}</a>
+    )
+
+    for (const name of ["terms-link", "terms_link", "terms.link"]) {
+      expect(
+        html(() =>
+          formatElements(`<${name}>Terms</${name}>`, { [name]: link }),
+        ),
+      ).toEqual('<a href="/terms">Terms</a>')
+    }
+
+    expect(
+      html(() =>
+        formatElements(
+          "I agree to the <terms-link>Terms</terms-link> and the <privacy-link>Privacy Policy</privacy-link>.",
+          {
+            "terms-link": link,
+            "privacy-link": (props) => <a href="/privacy">{props.children}</a>,
+          },
+        ),
+      ),
+    ).toEqual(
+      'I agree to the <a href="/terms">Terms</a> and the <a href="/privacy">Privacy Policy</a>.',
+    )
+  })
+
+  it("should format unpaired elements whose names use the macro charset", function () {
+    for (const name of ["terms-link", "terms_link", "terms.link"]) {
+      expect(
+        html(() => formatElements(`text<${name}/>`, { [name]: () => <br /> })),
+      ).toEqual("text<br>")
+    }
+  })
+
   it("should preserve nested named element props", function () {
     expect(
       html(() =>
```

**File**: `packages/solid/src/format.tsx` (modified, +3/-1)
```diff
@@ -5,7 +5,9 @@ import {
 } from "solid-js"
 
 // match <tag>paired</tag> and <tag/> unpaired tags
-const tagRe = /<([a-zA-Z0-9]+)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9]+)\/>/
+// Names use the same charset the macro accepts, so `_`, `.` and `-` are valid in between.
+const tagRe =
+  /<([a-zA-Z0-9_](?:[\w.-]*\w)?)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9_](?:[\w.-]*\w)?)\/>/
 
 /**
  * `formatElements` - parse string and return tree of Solid elements
```

---

### Incident Patch 8: `202a5f05` (2026-09-23)
**Commit Message**: fix(cli): add translation as the last key of a new message (#2677)

**File**: `packages/cli/src/api/catalog/mergeCatalog.test.ts` (modified, +42/-0)
```diff
@@ -188,4 +188,46 @@ describe("mergeCatalog", () => {
       }
     `)
   })
+
+  describe("key order", () => {
+    // key order is what a formatter writes out, so it is what shows up in the
+    // catalog diff
+    const serializedKeys = (entry: unknown) =>
+      Object.keys(JSON.parse(JSON.stringify(entry)))
+
+    it("should add translation as the last key of a new message", () => {
+      const result = mergeCatalog(
+        undefined,
+        nextCatalog,
+        false,
+        defaultMergeOptions,
+      )
+
+      expect(serializedKeys(result["custom.id"]).at(-1)).toBe("translation")
+      expect(
+        serializedKeys(result["Message with <0>auto-generated</0> ID"]).at(-1),
+      ).toBe("translation")
+    })
+
+    it("should keep the key order of a message stable between extract runs", () => {
+      // first extract, both messages are new
+      const firstRun = mergeCatalog(
+        undefined,
+        nextCatalog,
+        false,
+        defaultMergeOptions,
+      )
+      // second extract, the very same messages are merged from the catalog
+      const secondRun = mergeCatalog(
+        firstRun,
+        nextCatalog,
+        false,
+        defaultMergeOptions,
+      )
+
+      expect(JSON.stringify(secondRun, null, 2)).toEqual(
+        JSON.stringify(firstRun, null, 2),
+      )
+    })
+  })
 })
```

**File**: `packages/cli/src/api/catalog/mergeCatalog.ts` (modified, +3/-1)
```diff
@@ -31,12 +31,14 @@ export function mergeCatalog(
   }
 
   // Initialize new catalog with new keys
+  // `translation` is added last, so a message keeps the same key order once it
+  // is merged from the previous catalog on the next extract
   const newMessages: CatalogType = Object.fromEntries(
     newKeys.map((key) => [
       key,
       {
-        translation: forSourceLocale ? nextCatalog[key]!.message || key : "",
         ...nextCatalog[key],
+        translation: forSourceLocale ? nextCatalog[key]!.message || key : "",
       },
     ]),
   )
```

---

### Incident Patch 9: `db5f57c8` (2026-09-22)
**Commit Message**: fix(babel-plugin-lingui-macro): restore `@babel/types` as a runtime dependency (#2634)

**File**: `packages/babel-plugin-lingui-macro/package.json` (modified, +2/-6)
```diff
@@ -55,19 +55,16 @@
     "node": ">=22.19.0"
   },
   "dependencies": {
+    "@babel/types": "^7.20.7",
     "@lingui/conf": "workspace:*",
     "@lingui/message-utils": "workspace:*"
   },
   "peerDependencies": {
-    "@babel/core": "^7.20.12 || ^8.0.0",
-    "@babel/types": "^7.20.7 || ^8.0.0"
+    "@babel/core": "^7.20.12 || ^8.0.0"
   },
   "peerDependenciesMeta": {
     "@babel/core": {
       "optional": true
-    },
-    "@babel/types": {
-      "optional": true
     }
   },
   "devDependencies": {
@@ -76,7 +73,6 @@
     "@babel/plugin-syntax-jsx": "^7.28.6",
     "@babel/preset-typescript": "^7.18.6",
     "@babel/traverse": "^7.20.12",
-    "@babel/types": "^7.29.0",
     "babel-plugin-macros": "^3.1.0",
     "babel-plugin-react-compiler": "^1.0.0",
     "prettier": "3.9.6",
```

**File**: `yarn.lock` (modified, +1/-4)
```diff
@@ -1502,7 +1502,7 @@ __metadata:
     "@babel/plugin-syntax-jsx": "npm:^7.28.6"
     "@babel/preset-typescript": "npm:^7.18.6"
     "@babel/traverse": "npm:^7.20.12"
-    "@babel/types": "npm:^7.29.0"
+    "@babel/types": "npm:^7.20.7"
     "@lingui/conf": "workspace:*"
     "@lingui/message-utils": "workspace:*"
     babel-plugin-macros: "npm:^3.1.0"
@@ -1513,12 +1513,9 @@ __metadata:
     vitest: "catalog:"
   peerDependencies:
     "@babel/core": ^7.20.12 || ^8.0.0
-    "@babel/types": ^7.20.7 || ^8.0.0
   peerDependenciesMeta:
     "@babel/core":
       optional: true
-    "@babel/types":
-      optional: true
   languageName: unknown
   linkType: soft
 
```

---

### Incident Patch 10: `74089ab0` (2026-09-21)
**Commit Message**: fix(react): substitute macro-accepted placeholder names in formatElements (#2680)

**File**: `packages/react/src/format.test.tsx` (modified, +67/-0)
```diff
@@ -54,6 +54,73 @@ describe("formatElements", function () {
     ).toEqual('<a href="/about">About</a>')
   })
 
+  it("should format paired placeholders whose names use the macro charset", function () {
+    // camelCase already works; hyphen / underscore / dot must as well (#2676)
+    expect(
+      html(
+        formatElements("<termsLink>Terms</termsLink>", {
+          termsLink: <a href="/terms" />,
+        }),
+      ),
+    ).toEqual('<a href="/terms">Terms</a>')
+
+    expect(
+      html(
+        formatElements("<terms-link>Terms</terms-link>", {
+          "terms-link": <a href="/terms" />,
+        }),
+      ),
+    ).toEqual('<a href="/terms">Terms</a>')
+
+    expect(
+      html(
+        formatElements("<terms_link>Terms</terms_link>", {
+          terms_link: <a href="/terms" />,
+        }),
+      ),
+    ).toEqual('<a href="/terms">Terms</a>')
+
+    expect(
+      html(
+        formatElements("<terms.link>Terms</terms.link>", {
+          "terms.link": <a href="/terms" />,
+        }),
+      ),
+    ).toEqual('<a href="/terms">Terms</a>')
+
+    expect(
+      html(
+        formatElements(
+          "I agree to the <terms-link>Terms of Service</terms-link> and the <privacy-link>Privacy Policy</privacy-link>.",
+          {
+            "terms-link": <a href="/terms" />,
+            "privacy-link": <a href="/privacy" />,
+          },
+        ),
+      ),
+    ).toEqual(
+      'I agree to the <a href="/terms">Terms of Service</a> and the <a href="/privacy">Privacy Policy</a>.',
+    )
+  })
+
+  it("should format unpaired placeholders whose names use the macro charset", function () {
+    expect(
+      html(formatElements("text<termsLink/>", { termsLink: <br /> })),
+    ).toEqual("text<br>")
+
+    expect(
+      html(formatElements("text<terms-link/>", { "terms-link": <br /> })),
+    ).toEqual("text<br>")
+
+    expect(
+      html(formatElements("text<terms_link/>", { terms_link: <br /> })),
+    ).toEqual("text<br>")
+
+    expect(
+      html(formatElements("text<terms.link/>", { "terms.link": <br /> })),
+    ).toEqual("text<br>")
+  })
+
   it("should preserve nested named element props", function () {
     expect(
       html(
```

**File**: `packages/react/src/format.tsx` (modified, +4/-1)
```diff
@@ -1,7 +1,10 @@
 import { cloneElement } from "react"
 
 // match <tag>paired</tag> and <tag/> unpaired tags
-const tagRe = /<([a-zA-Z0-9]+)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9]+)\/>/
+// Names: auto-generated digits, or the macro charset from tokenizeElement —
+// /^[a-zA-Z_]([\w.-]*\w)?$/ — so `_`, `.` and `-` are valid in between.
+const tagRe =
+  /<([a-zA-Z0-9_](?:[\w.-]*\w)?)>([\s\S]*?)<\/\1>|<([a-zA-Z0-9_](?:[\w.-]*\w)?)\/>/
 
 // For HTML, certain tags should omit their close tag. We keep a whitelist for
 // those special-case tags.
```

---

### Incident Patch 11: `4cc6cddc` (2026-09-18)
**Commit Message**: feat(cli): add lingui check sync | missing commands (#2515)

**File**: `eslint.config.js` (modified, +12/-3)
```diff
@@ -1,6 +1,6 @@
 import { defineConfig } from "eslint/config"
 import pluginJs from "@eslint/js"
-import tseslint from "typescript-eslint"
+import { configs as typescriptEslintConfigs } from "typescript-eslint"
 import importPlugin from "eslint-plugin-import"
 
 export default defineConfig(
@@ -20,13 +20,16 @@ export default defineConfig(
     files: ["**/*.{ts,tsx,js,jsx}"],
     extends: [
       pluginJs.configs.recommended,
-      ...tseslint.configs.recommended,
+      ...typescriptEslintConfigs.recommended,
       importPlugin.flatConfigs.recommended,
       importPlugin.flatConfigs.typescript,
     ],
     settings: {
       "import/resolver": {
-        typescript: true,
+        typescript: {
+          noWarnOnMultipleProjects: true,
+          project: ["./tsconfig.json", "./packages/*/tsconfig.json"],
+        },
         node: true,
       },
     },
@@ -68,4 +71,10 @@ export default defineConfig(
       "import/no-extraneous-dependencies": "off",
     },
   },
+  {
+    files: ["**/next-env.d.ts"],
+    rules: {
+      "import/no-unresolved": "off",
+    },
+  },
 )
```

**File**: `examples/tanstack-start/src/routes/__root.tsx` (modified, +1/-1)
```diff
@@ -146,7 +146,7 @@ function RootDocument({ children }: { children: React.ReactNode }) {
             <Trans>Content</Trans>
           </Link>{" "}
           <Link
-            // @ts-expect-error
+            // @ts-expect-error - This deliberately links to a missing route.
             to="/this-route-does-not-exist"
             activeProps={{
               className: "font-bold",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -70,7 +70,7 @@
   "lint-staged": {
     "*.{ts,tsx,js,jsx}": [
       "prettier --write --ignore-unknown",
-      "eslint --fix"
+      "eslint --fix --no-warn-ignored"
     ]
   },
   "size-limit": [
```

**File**: `packages/cli/src/api/catalog/getTranslationsForCatalog.test.ts` (modified, +143/-8)
```diff
@@ -1,12 +1,8 @@
 import { getTranslationsForCatalog } from "./getTranslationsForCatalog.js"
-import { Catalog } from "../catalog.js"
 import type { AllCatalogsType, CatalogType } from "../types.js"
 
-function getCatalogStub(
-  catalogs: AllCatalogsType,
-  template: CatalogType = {},
-): Catalog {
-  const catalogStub: Partial<Catalog> = {
+function getCatalogStub(catalogs: AllCatalogsType, template: CatalogType = {}) {
+  return {
     async readAll(): Promise<AllCatalogsType> {
       return catalogs
     },
@@ -15,8 +11,6 @@ function getCatalogStub(
       return template
     },
   }
-
-  return catalogStub as Catalog
 }
 
 function lang(
@@ -44,6 +38,18 @@ function message(id: string, source: string, noTranslation = false) {
   })
 }
 
+function obsoleteMessage(id: string, source: string, noTranslation = false) {
+  return (locale: string): CatalogType => ({
+    [id]: {
+      message: source,
+      translation: noTranslation
+        ? undefined
+        : `${locale}: translation: ${source}`,
+      obsolete: true,
+    },
+  })
+}
+
 describe("getTranslationsForCatalog", () => {
   it("Should return translated catalog if all translation exists", async () => {
     // prettier-ignore
@@ -99,6 +105,43 @@ describe("getTranslationsForCatalog", () => {
     `)
   })
 
+  it("Should report raw missing catalog entries even when fallbackLocales.default resolves them", async () => {
+    // prettier-ignore
+    const catalogStub = getCatalogStub({
+      ...lang("pl", [
+        message("hashid1", "Lorem"),
+        message("hashid2", "Ipsum")
+      ]),
+      ...lang("ru", [
+        message("hashid1", "Lorem"),
+        message("hashid2", "Ipsum", true)
+      ])
+    })
+
+    const actual = await getTranslationsForCatalog(catalogStub, "ru", {
+      sourceLocale: "en",
+      fallbackLocales: {
+        default: "pl",
+      },
+      missingBehavior: "catalog",
+    })
+
+    expect(actual).toMatchInlineSnapshot(`
+      {
+        messages: {
+          hashid1: ru: translation: Lorem,
+          hashid2: pl: translation: Ipsum,
+        },
+        missing: [
+          {
+            id: hashid2,
+            source: Ipsum,
+          },
+        ],
+      }
+    `)
+  })
+
   it("Should fallback to single fallbackLocales", async () => {
     // prettier-ignore
     const catalogStub = getCatalogStub({
@@ -381,4 +424,96 @@ describe("getTranslationsForCatalog", () => {
       }
     `)
   })
+
+  it("Should ignore obsolete messages that are not active anywhere", async () => {
+    // prettier-ignore
+    const catalogStub = getCatalogStub({
+      ...lang("pl", [
+        message("hashid1", "Lorem"),
+        obsoleteMessage("hashid2", "Ipsum", true)
+      ])
+    })
+
+    const actual = await getTranslationsForCatalog(catalogStub, "pl", {
+      sourceLocale: "en",
+      fallbackLocales: {},
+      ignoreObsolete: true,
+    })
+
+    expect(actual).toMatchInlineSnapshot(`
+      {
+        messages: {
+          hashid1: pl: translation: Lorem,
+        },
+        missing: [],
+      }
+    `)
+  })
+
+  it("Should not use obsolete target translations for active messages", async () => {
+    // prettier-ignore
+    const catalogStub = getCatalogStub({
+      ...lang("pl", [
+        obsoleteMessage("hashid1", "Lorem")
+      ])
+    }, lang("tpl", [
+      message("hashid1", "Lorem", true)
+    ]).tpl)
+
+    const actual = await getTranslationsForCatalog(catalogStub, "pl", {
+      sourceLocale: "en",
+      fallbackLocales: {},
+      ignoreObsolete: true,
+    })
+
+    expect(actual).toMatchInlineSnapshot(`
+      {
+        messages: {
+          hashid1: Lorem,
+        },
+        missing: [
+          {
+            id: hashid1,
+            source: Lorem,
+          },
+        ],
+      }
+    `)
+  })
+
+  it("Should not use obsolete fallback translations", async () => {
+    // prettier-ignore
+    const catalogStub = getCatalogStub({
+      ...lang("pl", [
+        obsoleteMessage("hashid1", "Lorem")
+      ]),
+      ...lang("ru", [
+        message("hashid1", "Lorem", true)
+      ])
+    }, lang("tpl", [
+      message("hashid1", "Lorem", true)
+    ]).tpl)
+
+    const actual = await getTranslationsForCatalog(catalogStub, "ru", {
+      sourceLocale: "en",
+      fallbackLocales: {
+        default: "pl",
+      },
+      ignoreObsolete: true,
+    })
+
+    expect(actual).toMatchInlineSnapshot(`
+      {
+        messages: {
+          hashid1: Lorem,
+        },
+        missing: [
+          {
+            id: hashid1,
+            source: Lorem,
+          },
+        ],
+      }
+    `)
+  })
 })
```

**File**: `packages/cli/src/api/catalog/getTranslationsForCatalog.ts` (modified, +105/-32)
```diff
@@ -1,4 +1,3 @@
-import { Catalog } from "../catalog.js"
 import { FallbackLocales } from "@lingui/conf"
 import type { AllCatalogsType, CatalogType, MessageType } from "../types.js"
 import { getFallbackListForLocale } from "./getFallbackListForLocale.js"
@@ -8,44 +7,61 @@ export type TranslationMissingEvent = {
   id: string
 }
 
+export type MissingBehavior = "resolved" | "catalog"
+
+export function isMissingBehavior(value: string): value is MissingBehavior {
+  return value === "resolved" || value === "catalog"
+}
+
 export type GetTranslationsOptions = {
   sourceLocale: string
   fallbackLocales: FallbackLocales
+  missingBehavior?: MissingBehavior
+  ignoreObsolete?: boolean
+}
+
+type CatalogTranslationsReader = {
+  readAll(locales: string[]): Promise<AllCatalogsType>
+  readTemplate(): Promise<CatalogType | undefined>
 }
 
 export async function getTranslationsForCatalog(
-  catalog: Catalog,
+  catalog: CatalogTranslationsReader,
   locale: string,
   options: GetTranslationsOptions,
 ) {
-  const locales = new Set([
-    locale,
-    options.sourceLocale,
-    ...getFallbackListForLocale(options.fallbackLocales, locale),
-  ])
+  const fallbackList = getFallbackListForLocale(options.fallbackLocales, locale)
+  const locales = new Set([locale, options.sourceLocale, ...fallbackList])
 
-  const [catalogs, template] = await Promise.all([
+  const [rawCatalogs, rawTemplate] = await Promise.all([
     catalog.readAll(Array.from(locales)),
     catalog.readTemplate(),
   ])
 
+  const ignoreObsolete = options.ignoreObsolete ?? false
+  const catalogs = withoutObsolete(rawCatalogs, ignoreObsolete)
+  const template = withoutObsoleteCatalog(rawTemplate, ignoreObsolete)
   const sourceLocaleCatalog = catalogs[options.sourceLocale] || {}
 
   const input = { ...template, ...sourceLocaleCatalog, ...catalogs[locale] }
 
   const missing: TranslationMissingEvent[] = []
+  const missingBehavior = options.missingBehavior ?? "resolved"
 
-  const messages = Object.keys(input).reduce<{ [id: string]: string }>(
-    (acc, key) => {
+  const messages = Object.entries(input).reduce<{ [id: string]: string }>(
+    (acc, [key, msg]) => {
       acc[key] = getTranslation(
         catalogs,
-        input[key]!,
+        msg,
         locale,
         key,
+        options.sourceLocale,
+        fallbackList,
+        ignoreObsolete,
+        missingBehavior,
         (event) => {
           missing.push(event)
         },
-        options,
       )
       return acc
     },
@@ -58,37 +74,84 @@ export async function getTranslationsForCatalog(
   }
 }
 
-function sourceLocaleFallback(catalog: CatalogType | undefined, key: string) {
-  if (!catalog?.[key]) {
+function isActiveMessage(
+  message: MessageType | undefined,
+  ignoreObsolete: boolean,
+): message is MessageType {
+  return Boolean(message && (!ignoreObsolete || !message.obsolete))
+}
+
+function withoutObsolete(
+  catalogs: AllCatalogsType,
+  ignoreObsolete: boolean,
+): AllCatalogsType {
+  return Object.fromEntries(
+    Object.entries(catalogs).map(([locale, catalog]) => [
+      locale,
+      withoutObsoleteCatalog(catalog, ignoreObsolete),
+    ]),
+  )
+}
+
+function withoutObsoleteCatalog(
+  catalog: CatalogType | undefined,
+  ignoreObsolete: boolean,
+): CatalogType {
+  const activeCatalog: CatalogType = {}
+
+  Object.entries(catalog ?? {}).forEach(([id, message]) => {
+    if (isActiveMessage(message, ignoreObsolete)) {
+      activeCatalog[id] = message
+    }
+  })
+
+  return activeCatalog
+}
+
+function sourceLocaleFallback(
+  catalog: CatalogType | undefined,
+  key: string,
+  ignoreObsolete: boolean,
+) {
+  const message = catalog?.[key]
+
+  if (!isActiveMessage(message, ignoreObsolete)) {
     return undefined
   }
 
-  return catalog[key].translation || catalog[key].message
+  return message.translation || message.message
 }
 
 function getTranslation(
   catalogs: AllCatalogsType,
   msg: MessageType,
   locale: string,
   key: string,
+  sourceLocale: string,
+  fallbackList: string[],
+  ignoreObsolete: boolean,
+  missingBehavior: MissingBehavior,
   onMissing: (message: TranslationMissingEvent) => void,
-  options: GetTranslationsOptions,
 ) {
-  const { fallbackLocales, sourceLocale } = options
-
-  const getTranslation = (_locale: string) => {
+  const getCatalogTranslation = (_locale: string) => {
     const localeCatalog = catalogs[_locale]
-    return localeCatalog?.[key]?.translation
+    const message = localeCatalog?.[key]
+
+    if (!isActiveMessage(message, ignoreObsolete)) {
+      return undefined
+    }
+
+    return message.translation
   }
 
-  const getMultipleFallbacks = (_locale: string) => {
-    const fL = getFallbackListForLocale(fallbackLocales, _locale)
+  const getMultipleFallbacks = () => {
+    if (!fallbackList.length) return null
 
-    if (!fL.length) return null
+    for (const fallbackLocale of fallbackList) {
+      const fallbackTranslation = getCatalogTranslation(fallbackLocale)
 
-    for
```

**File**: `packages/cli/src/api/catalog/translations.ts` (added, +79/-0)
```diff
@@ -0,0 +1,79 @@
+import { Catalog } from "../catalog.js"
+import { toRootRelativePath } from "../utils.js"
+import type { CheckFindingBase } from "../check/types.js"
+import {
+  getTranslationsForCatalog,
+  TranslationMissingEvent,
+} from "./getTranslationsForCatalog.js"
+import type { MissingBehavior } from "./getTranslationsForCatalog.js"
+
+export type MissingTranslationFinding = CheckFindingBase & {
+  code: "missing_translation"
+  locale: string
+}
+
+export async function getMissingTranslationFindings(
+  catalog: Catalog,
+  locale: string,
+  missingBehavior: MissingBehavior = "resolved",
+): Promise<MissingTranslationFinding[]> {
+  if (catalog.config.pseudoLocale.some((item) => item.locale === locale)) {
+    return []
+  }
+
+  const { missing } = await getCatalogTranslationsWithMissing(
+    catalog,
+    locale,
+    missingBehavior,
+  )
+
+  return missing.map((entry) =>
+    createMissingTranslationFinding(catalog, locale, entry),
+  )
+}
+
+function createMissingTranslationMessage(messageId: string, source?: string) {
+  return source || source === messageId
+    ? `${messageId}: (${source})`
+    : messageId
+}
+
+export async function getCatalogTranslationsWithMissing(
+  catalog: Catalog,
+  locale: string,
+  missingBehavior: MissingBehavior = "resolved",
+) {
+  const { messages, missing } = await getTranslationsForCatalog(
+    catalog,
+    locale,
+    {
+      fallbackLocales: catalog.config.fallbackLocales,
+      sourceLocale: catalog.config.sourceLocale,
+      missingBehavior,
+      ignoreObsolete: true,
+    },
+  )
+
+  return {
+    messages,
+    missing,
+  }
+}
+
+export function createMissingTranslationFinding(
+  catalog: Catalog,
+  locale: string,
+  missing: TranslationMissingEvent,
+): MissingTranslationFinding {
+  const catalogPath = toRootRelativePath(
+    catalog.config.rootDir,
+    catalog.getFilename(locale),
+  )
+
+  return {
+    code: "missing_translation",
+    locale,
+    catalogPath,
+    message: createMissingTranslationMessage(missing.id, missing.source),
+  }
+}
```

**File**: `packages/cli/src/api/check/index.ts` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+import { missingCheck } from "./missing.js"
+import { syncCheck } from "./sync.js"
+import {
+  CheckCliOptionName,
+  CheckDefinition,
+  CheckName,
+  CheckRunOptions,
+  CheckSpecificOption,
+  checkSpecificOptions,
+} from "./types.js"
+
+export const checkDefinitionsByName = {
+  sync: syncCheck,
+  missing: missingCheck,
+} satisfies Record<CheckName, CheckDefinition>
+
+const registeredChecks: readonly CheckDefinition[] = Object.values(
+  checkDefinitionsByName,
+)
+
+export function getRegisteredChecks(): readonly CheckDefinition[] {
+  return registeredChecks
+}
+
+function getSupportedOptions(check: CheckDefinition) {
+  return check.cli.options.map((option) => option.runOption)
+}
+
+type OptionOwner = { checkName: CheckName; cliOptionName: CheckCliOptionName }
+
+const optionOwnerByOption: ReadonlyMap<CheckSpecificOption, OptionOwner> =
+  new Map(
+    registeredChecks.flatMap((check) =>
+      check.cli.options.map(
+        (option) =>
+          [
+            option.runOption,
+            { checkName: check.name, cliOptionName: option.name },
+          ] as const,
+      ),
+    ),
+  )
+
+export function validateSupportedOptions(
+  check: CheckDefinition,
+  options: CheckRunOptions,
+) {
+  checkSpecificOptions.forEach((option) => {
+    if (!options[option] || getSupportedOptions(check).includes(option)) {
+      return
+    }
+
+    const owner = optionOwnerByOption.get(option)
+
+    if (!owner) {
+      throw new Error(`Unsupported check option \`${option}\`.`)
+    }
+
+    throw new Error(
+      `Option \`--${owner.cliOptionName}\` can only be used with the \`${owner.checkName}\` check.`,
+    )
+  })
+}
+
+function isCheckName(inputCheck: string): inputCheck is CheckName {
+  return Object.prototype.hasOwnProperty.call(
+    checkDefinitionsByName,
+    inputCheck,
+  )
+}
+
+export function getCheck(inputCheck: string): CheckDefinition {
+  if (!isCheckName(inputCheck)) {
+    throw new Error(`Unknown check ${inputCheck}.`)
+  }
+
+  return checkDefinitionsByName[inputCheck]
+}
```

**File**: `packages/cli/src/api/check/missing.ts` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+import { getMissingTranslationFindings } from "../catalog/translations.js"
+import { runBounded } from "../runBounded.js"
+import { createMissingWorkerPool, MissingWorkerPool } from "../workerPools.js"
+import { CheckContext, CheckDefinition, finalizeCheckResult } from "./types.js"
+import { getMissingBehaviorDescription } from "../messages.js"
+import type { MissingTranslationFinding } from "../catalog/translations.js"
+
+export const missingCheck: CheckDefinition = {
+  name: "missing",
+  description:
+    "Verify that message catalogs have no missing translations after fallbackLocales are applied.",
+  cli: {
+    options: [
+      {
+        name: "mode",
+        runOption: "missingBehavior",
+        description:
+          "Missing translation behavior: resolved (after fallbackLocales) or catalog (before fallbackLocales)",
+      },
+    ],
+    examples: [
+      {
+        description: "Check for missing translations after fallbackLocales",
+        command: "check missing",
+      },
+      {
+        description: "Check target catalogs before fallbackLocales",
+        command: "check missing --mode catalog",
+      },
+      {
+        description: "Check missing translations verbosely for a locale",
+        command: "check missing --locale pl --verbose",
+      },
+    ],
+  },
+  async run(ctx: CheckContext) {
+    const tasks = ctx.locales.flatMap((locale) =>
+      ctx.catalogs.map((catalog) => ({
+        locale,
+        catalog,
+      })),
+    )
+
+    const resolvedConfigPath = ctx.config.resolvedConfigPath
+    let workerPool: MissingWorkerPool | undefined
+
+    if (ctx.workersOptions.poolSize > 0 && resolvedConfigPath) {
+      workerPool = createMissingWorkerPool(ctx.workersOptions)
+    }
+
+    let findings: MissingTranslationFinding[]
+
+    try {
+      findings = (
+        await runBounded(
+          tasks,
+          ctx.workersOptions.poolSize,
+          async ({ locale, catalog }) =>
+            workerPool
+              ? workerPool.run(
+                  catalog.path,
+                  locale,
+                  ctx.missingBehavior,
+                  resolvedConfigPath!,
+                )
+              : getMissingTranslationFindings(
+                  catalog,
+                  locale,
+                  ctx.missingBehavior,
+                ),
+        )
+      ).flat()
+    } finally {
+      if (workerPool) {
+        await workerPool.destroy()
+      }
+    }
+
+    const missingBehaviorDescription = getMissingBehaviorDescription(
+      ctx.missingBehavior,
+    )
+
+    return finalizeCheckResult(
+      "missing",
+      findings,
+      `No missing translations found ${missingBehaviorDescription}.`,
+      (count) =>
+        `Found ${count} missing translation(s) ${missingBehaviorDescription}.`,
+    )
+  },
+}
```

---

### Incident Patch 12: `bb649698` (2026-09-17)
**Commit Message**: docs: document require-comment, require-directive-reset and Oxlint support (#2674)

**File**: `website/docs/ref/eslint-plugin.md` (modified, +22/-1)
```diff
@@ -91,7 +91,7 @@ Alternatively, add `lingui` to the `plugins` section of your `.eslintrc` configu
 }
 ```
 
-In the rules section, configure the rules you want to use:
+In the rules section, configure the rules you want to use. For example:
 
 ```json
 {
@@ -107,6 +107,27 @@ In the rules section, configure the rules you want to use:
 }
 ```
 
+### Oxlint {#oxlint}
+
+The plugin also works as an [Oxlint JS plugin](https://oxc.rs/docs/guide/usage/linter/js-plugins) without any changes. Add it to `jsPlugins` in your `.oxlintrc.json` and enable the rules you need.
+
+Oxlint doesn't read the plugin's `configs`, so the recommended rules have to be listed explicitly:
+
+```json
+{
+  "jsPlugins": ["eslint-plugin-lingui"],
+  "rules": {
+    "lingui/t-call-in-function": "error",
+    "lingui/no-single-tag-to-translate": "warn",
+    "lingui/no-single-variables-to-translate": "warn",
+    "lingui/no-trans-inside-trans": "warn",
+    "lingui/no-expression-in-message": "warn"
+  }
+}
+```
+
+Compatibility with Oxlint is verified in CI on every change. The only known limitation is the `useTsTypes` option of the [`no-unlocalized-strings`](https://github.com/lingui/eslint-plugin/blob/main/docs/rules/no-unlocalized-strings.md) rule: it needs type information from `@typescript-eslint/parser`, which Oxlint doesn't provide.
+
 :::tip
 See the [official repository](https://github.com/lingui/eslint-plugin) for more information about the rules.
 :::
```

**File**: `website/docs/ref/macro.mdx` (modified, +8/-0)
```diff
@@ -566,6 +566,10 @@ const msg2 = t`Sign up`;
 
 Both `msg1` and `msg2` will have `context` set to `"homepage"`.
 
+:::tip
+A directive that is never reset applies to every macro that follows it in the file, including messages added later. You can enforce that each `lingui-set` is closed with a `lingui-reset` using the Lingui [ESLint Plugin](/ref/eslint-plugin) rule [`require-directive-reset`](https://github.com/lingui/eslint-plugin/blob/main/docs/rules/require-directive-reset.md).
+:::
+
 #### Supported Params
 
 | Param      | Example                     | Description                                                                                                                                                                 |
@@ -701,6 +705,10 @@ import { Trans } from "@lingui/react";
 
 Comment for translators to give them additional information about the message. It will be visible in the [TMS](/tools/introduction) if it is supported, and in the [catalog format](/ref/catalog-formats). It will be removed from production code.
 
+:::tip
+You can require every message to describe itself to translators with the Lingui [ESLint Plugin](/ref/eslint-plugin) rule [`require-comment`](https://github.com/lingui/eslint-plugin/blob/main/docs/rules/require-comment.md). It accepts a [`lingui-set comment="..."`](#lingui-directive) directive as well, which is the only option for tagged template literals such as `` t`Save` ``.
+:::
+
 #### `context`
 
 Allows to extract the same messages with different IDs. It is useful when the same message has different meanings in different contexts. See [Context](/guides/explicit-vs-generated-ids#context) for more details.
```

---

### Incident Patch 13: `fd416f9e` (2026-09-17)
**Commit Message**: revert: "feat(cli): add support for `BatchExtractor` (#2562)" (#2673)

**File**: `packages/cli/src/api/catalog.test.ts` (modified, +6/-23)
```diff
@@ -15,27 +15,10 @@ import {
   defaultMergeOptions,
   makeCatalog,
 } from "../tests.js"
-import { AllCatalogsType, ExtractedCatalogType } from "./types.js"
-import {
-  extractFromFiles,
-  mergeExtractedMessage,
-} from "./catalog/extractFromFiles.js"
+import { AllCatalogsType } from "./types.js"
+import { extractFromFiles } from "./catalog/extractFromFiles.js"
 import { FormatterWrapper, getFormat } from "./formats/index.js"
 import { createBabelExtractor } from "./extractors/babel.js"
-import type { ExtractedMessage, LinguiConfigNormalized } from "@lingui/conf"
-
-async function extractMessages(
-  paths: string[],
-  config: LinguiConfigNormalized,
-) {
-  const messages: ExtractedCatalogType = {}
-  const success = await extractFromFiles(
-    paths,
-    (msg: ExtractedMessage) => mergeExtractedMessage(msg, messages, config),
-    config,
-  )
-  return success ? messages : undefined
-}
 
 export const fixture = (...dirs: string[]) =>
   (
@@ -226,7 +209,7 @@ describe("Catalog", () => {
 
   describe("collect", () => {
     it("should support JSX and Typescript", async () => {
-      const messages = await extractMessages(
+      const messages = await extractFromFiles(
         [
           fixture("collect-typescript-jsx/jsx-in-js.js"),
           fixture("collect-typescript-jsx/jsx-syntax.jsx"),
@@ -240,15 +223,15 @@ describe("Catalog", () => {
     })
 
     it("should sort placeholders to keep them stable between runs", async () => {
-      const runA = await extractMessages(
+      const runA = await extractFromFiles(
         [
           fixture("collect-placeholders-sorting/a.ts"),
           fixture("collect-placeholders-sorting/b.ts"),
         ],
         mockConfig(),
       )
 
-      const runB = await extractMessages(
+      const runB = await extractFromFiles(
         [
           fixture("collect-placeholders-sorting/b.ts"),
           fixture("collect-placeholders-sorting/a.ts"),
@@ -271,7 +254,7 @@ describe("Catalog", () => {
     })
 
     it("should support experimental typescript decorators under a flag", async () => {
-      const messages = await extractMessages(
+      const messages = await extractFromFiles(
         [fixture("collect-typescript-jsx/tsx-experimental-decorators.tsx")],
         mockConfig({
           extractors: [
```

**File**: `packages/cli/src/api/catalog.ts` (modified, +7/-91)
```diff
@@ -4,8 +4,6 @@ import { globSync } from "node:fs"
 import normalize from "normalize-path"
 
 import {
-  ExtractedMessage,
-  ExtractorType,
   LinguiConfigNormalized,
   MessageType,
   OrderBy,
@@ -22,7 +20,6 @@ import { mergeCatalog } from "./catalog/mergeCatalog.js"
 import {
   extractFromFiles,
   extractFromFilesWithWorkerPool,
-  mergeExtractedMessage,
 } from "./catalog/extractFromFiles.js"
 import {
   isDirectory,
@@ -33,10 +30,6 @@ import {
 } from "./utils.js"
 import { AllCatalogsType, CatalogType, ExtractedCatalogType } from "./types.js"
 import { ExtractWorkerPool } from "./workerPools.js"
-import {
-  getConfiguredExtractors,
-  isBatchExtractor,
-} from "./extractors/index.js"
 
 const LOCALE = "{locale}"
 const LOCALE_SUFFIX_RE = /\{locale\}.*$/
@@ -185,92 +178,15 @@ export class Catalog {
       paths = paths.filter((path: string) => regex.test(normalize(path)))
     }
 
-    const messages: ExtractedCatalogType = {}
-    const onMessageExtracted = (next: ExtractedMessage) => {
-      mergeExtractedMessage(next, messages, this.config)
-    }
-
-    const extractors = getConfiguredExtractors(this.config)
-
-    // Optimized hot path: if there are no batch extractors defined, skip the more complex logic.
-    if (!extractors.some(isBatchExtractor)) {
-      const success = options.workerPool
-        ? await extractFromFilesWithWorkerPool(
-            options.workerPool,
-            paths,
-            onMessageExtracted,
-            this.config,
-          )
-        : await extractFromFiles(paths, onMessageExtracted, this.config)
-
-      return success ? messages : undefined
-    }
-
-    return await this.collectWithExtractors(
-      extractors,
-      paths,
-      onMessageExtracted,
-      messages,
-      options,
-    )
-  }
-
-  private async collectWithExtractors(
-    extractors: ExtractorType[],
-    paths: string[],
-    onMessageExtracted: (msg: ExtractedMessage) => void,
-    messages: ExtractedCatalogType,
-    options: { workerPool?: ExtractWorkerPool },
-  ): Promise<ExtractedCatalogType | undefined> {
-    let remaining = paths
-    let catalogSuccess = true
-
-    for (const extractor of extractors) {
-      if (remaining.length === 0) break
-
-      const matched: string[] = []
-      const unmatched: string[] = []
-
-      for (const f of remaining) {
-        if (extractor.match(f)) {
-          matched.push(f)
-        } else {
-          unmatched.push(f)
-        }
-      }
-
-      if (matched.length === 0) continue
-
-      remaining = unmatched
-
-      if (isBatchExtractor(extractor)) {
-        try {
-          await extractor.extractFromFiles(matched, onMessageExtracted, {
-            linguiConfig: this.config,
-          })
-        } catch (e) {
-          console.error(`Extractor failed: ${(e as Error).message}`)
-          console.error((e as Error).stack)
-          catalogSuccess = false
-        }
-      } else {
-        const success = options.workerPool
-          ? await extractFromFilesWithWorkerPool(
-              options.workerPool,
-              matched,
-              onMessageExtracted,
-              this.config,
-            )
-          : await extractFromFiles(matched, onMessageExtracted, this.config)
-
-        if (!success) {
-          catalogSuccess = false
-        }
-      }
+    if (options.workerPool) {
+      return await extractFromFilesWithWorkerPool(
+        options.workerPool,
+        paths,
+        this.config,
+      )
     }
 
-    if (!catalogSuccess) return undefined
-    return messages
+    return await extractFromFiles(paths, this.config)
   }
 
   /*
```

**File**: `packages/cli/src/api/catalog/collectWithBatchExtractor.test.ts` (removed, +0/-316)
```diff
@@ -1,316 +0,0 @@
-import path from "path"
-import type {
-  Experimental__BatchExtractorType,
-  ExtractedMessage,
-  ExtractorType,
-  PerFileExtractorType,
-} from "@lingui/conf"
-import { makeConfig } from "@lingui/conf"
-import { describe, expect, it, vi } from "vitest"
-import { Catalog } from "../catalog.js"
-import { getFormat } from "../formats/index.js"
-import { mockConsole } from "@lingui/test-utils"
-
-const fixturesDir = path.resolve(import.meta.dirname, "../fixtures")
-const collectDir = path.join(fixturesDir, "collect")
-
-const matchAll = () => true
-
-async function makeCatalogWithExtractors(extractors: ExtractorType[]) {
-  const config = makeConfig(
-    {
-      rootDir: fixturesDir,
-      locales: ["en"],
-      sourceLocale: "en",
-      extractors,
-    },
-    { skipValidation: true },
-  )
-
-  return new Catalog(
-    {
-      name: "messages",
-      path: "locales/{locale}/messages",
-      include: [collectDir],
-      exclude: [],
-      format: await getFormat(config.format, config.sourceLocale),
-    },
-    config,
-  )
-}
-
-describe("Catalog.collect with batch extractor", () => {
-  it("passes matched paths to extractFromFiles", async () => {
-    const extractFromFilesFn: Experimental__BatchExtractorType["extractFromFiles"] =
-      vi.fn(async () => {})
-
-    const extractor: Experimental__BatchExtractorType = {
-      match: matchAll,
-      extractFromFiles: extractFromFilesFn,
-    }
-
-    const catalog = await makeCatalogWithExtractors([extractor])
-    await catalog.collect()
-
-    const mock = vi.mocked(extractFromFilesFn)
-    expect(mock).toHaveBeenCalledTimes(1)
-    const filenames = mock.mock.calls[0]![0]
-    expect(filenames.length).toBeGreaterThan(0)
-    expect(filenames.every((f) => path.isAbsolute(f))).toBe(true)
-  })
-
-  it("merges extracted messages into catalog", async () => {
-    const extractor: Experimental__BatchExtractorType = {
-      match: matchAll,
-      extractFromFiles: async (
-        filenames: string[],
-        onMessageExtracted: (msg: ExtractedMessage) => void,
-      ) => {
-        onMessageExtracted({
-          id: "msg.hello",
-          message: "Hello",
-          origin: [filenames[0]!, 1],
-        })
-        onMessageExtracted({
-          id: "msg.world",
-          message: "World",
-          origin: [filenames[0]!, 5],
-        })
-      },
-    }
-
-    const catalog = await makeCatalogWithExtractors([extractor])
-    const result = await catalog.collect()
-
-    expect(result).toBeDefined()
-    expect(result!["msg.hello"]?.message).toBe("Hello")
-    expect(result!["msg.world"]?.message).toBe("World")
-  })
-
-  it("should throw an error when duplicate identifier with different defaults found", async () => {
-    const extractor: Experimental__BatchExtractorType = {
-      match: matchAll,
-      extractFromFiles: async (
-        filenames: string[],
-        onMessageExtracted: (msg: ExtractedMessage) => void,
-      ) => {
-        onMessageExtracted({
-          id: "custom.id",
-          message: "Hello",
-          origin: [filenames[0]!, 1],
-        })
-        onMessageExtracted({
-          id: "custom.id",
-          message: "World",
-          origin: [filenames[0]!, 5],
-        })
-      },
-    }
-
-    const catalog = await makeCatalogWithExtractors([extractor])
-
-    expect.assertions(2)
-    await mockConsole(async (console) => {
-      const result = await catalog.collect()
-
-      expect(result).toBeUndefined()
-
-      expect(console.error).toHaveBeenCalledWith(
-        expect.stringContaining(
-          `Encountered different default translations for message`,
-        ),
-      )
-    })
-  })
-
-  it("returns undefined on extractor error", async () => {
-    const extractor: Experimental__BatchExtractorType = {
-      match: matchAll,
-      extractFromFiles: async () => {
-        throw new Error("native crash")
-      },
-    }
-
-    const catalog = await makeCatalogWithExtractors([extractor])
-    await mockConsole(async (console) => {
-      const result = await catalog.collect()
-
-      expect(console.error).toHaveBeenCalledWith(
-        expect.stringContaining(`native crash`),
-      )
-      expect(result).toBeUndefined()
-    })
-  })
-
-  it("skips worker pool for batch extractor", async () => {
-    const extractFromFilesFn = vi.fn(async () => {})
-
-    const extractor: Experimental__BatchExtractorType = {
-      match: matchAll,
-      extractFromFiles: extractFromFilesFn,
-    }
-
-    const catalog = await makeCatalogWithExtractors([extractor])
-    const run = vi.fn()
-    const pool = { run, destroy: vi.fn() } as any
-
-    await catalog.collect({ workerPool: pool })
-
-    expect(extractFromFilesFn).toHaveBeenCalledTimes(1)
-    expect(run).not.toHaveBeenCalled()
-  })
-
-  it("only passes files matching the batch extractor's match()", async () => {
-    const extractFromFilesFn: Experimental__BatchExtractorType["extractFromFiles"] =
-      vi.fn(async () =>
```

**File**: `packages/cli/src/api/catalog/extractFromFiles.test.ts` (modified, +2/-11)
```diff
@@ -74,19 +74,10 @@ describe("extractFromFilesWithWorkerPool", () => {
 
     const pool = { run, destroy: vi.fn() } as unknown as ExtractWorkerPool
 
-    const messages: Record<string, any> = {}
-
-    await extractFromFilesWithWorkerPool(
-      pool,
-      paths,
-      (next) => {
-        mergeExtractedMessage(next, messages, config)
-      },
-      config,
-    )
+    const catalog = await extractFromFilesWithWorkerPool(pool, paths, config)
 
     expect(run).toHaveBeenCalledTimes(2)
-    expect(messages.one?.origin).toEqual([
+    expect(catalog?.one?.origin).toEqual([
       ["a.ts", 1],
       ["z.ts", 1],
     ])
```

**File**: `packages/cli/src/api/catalog/extractFromFiles.ts` (modified, +23/-11)
```diff
@@ -4,7 +4,7 @@ import path from "path"
 import extract from "../extractors/index.js"
 import { ExtractedCatalogType, MessageOrigin } from "../types.js"
 import { prettyOrigin } from "../utils.js"
-import type { ExtractWorkerPool } from "../workerPools.js"
+import { ExtractWorkerPool } from "../workerPools.js"
 
 function compareOrigins(a: MessageOrigin, b: MessageOrigin): number {
   const byPath = a[0].localeCompare(b[0])
@@ -50,17 +50,26 @@ function mergePlaceholders(
 
 export async function extractFromFiles(
   paths: string[],
-  onMessageExtracted: (msg: ExtractedMessage) => void,
   config: LinguiConfigNormalized,
-): Promise<boolean> {
+) {
+  const messages: ExtractedCatalogType = {}
+
   let catalogSuccess = true
 
   for (const filename of paths) {
-    const fileSuccess = await extract(filename, onMessageExtracted, config)
+    const fileSuccess = await extract(
+      filename,
+      (next: ExtractedMessage) => {
+        mergeExtractedMessage(next, messages, config)
+      },
+      config,
+    )
     catalogSuccess &&= fileSuccess
   }
 
-  return catalogSuccess
+  if (!catalogSuccess) return undefined
+
+  return messages
 }
 
 export function mergeExtractedMessage(
@@ -113,9 +122,12 @@ export function mergeExtractedMessage(
 export async function extractFromFilesWithWorkerPool(
   workerPool: ExtractWorkerPool,
   paths: string[],
-  onMessageExtracted: (msg: ExtractedMessage) => void,
   config: LinguiConfigNormalized,
-): Promise<boolean> {
+): Promise<ExtractedCatalogType | undefined> {
+  const messages: ExtractedCatalogType = {}
+
+  let catalogSuccess = true
+
   const resolvedConfigPath = config.resolvedConfigPath
 
   if (!resolvedConfigPath) {
@@ -124,8 +136,6 @@ export async function extractFromFilesWithWorkerPool(
     )
   }
 
-  let catalogSuccess = true
-
   const results = await Promise.all(
     paths.map((filename) => workerPool.run(filename, resolvedConfigPath)),
   )
@@ -135,10 +145,12 @@ export async function extractFromFilesWithWorkerPool(
       catalogSuccess = false
     } else {
       result.messages.forEach((message) => {
-        onMessageExtracted(message)
+        mergeExtractedMessage(message, messages, config)
       })
     }
   })
 
-  return catalogSuccess
+  if (!catalogSuccess) return undefined
+
+  return messages
 }
```

**File**: `packages/cli/src/api/extractors/index.ts` (modified, +3/-22)
```diff
@@ -1,11 +1,9 @@
 import fs from "fs/promises"
 import { createBabelExtractor } from "./babel.js"
 import {
-  Experimental__BatchExtractorType,
   ExtractedMessage,
   ExtractorType,
   LinguiConfigNormalized,
-  PerFileExtractorType,
 } from "@lingui/conf"
 
 let defaultExtractor: ExtractorType
@@ -18,31 +16,14 @@ function createDefaultExtractor(linguiConfig: LinguiConfigNormalized) {
   return defaultExtractor
 }
 
-export function isBatchExtractor(
-  ext: ExtractorType,
-): ext is Experimental__BatchExtractorType {
-  return "extractFromFiles" in ext && typeof ext.extractFromFiles === "function"
-}
-
-export function isPerFileExtractor(
-  ext: ExtractorType,
-): ext is PerFileExtractorType {
-  return "extract" in ext && typeof ext.extract === "function"
-}
-
-export const getConfiguredExtractors = (
-  linguiConfig: LinguiConfigNormalized,
-) => {
-  return linguiConfig.extractors ?? [createDefaultExtractor(linguiConfig)]
-}
-
 export default async function extract(
   filename: string,
   onMessageExtracted: (msg: ExtractedMessage) => void,
   linguiConfig: LinguiConfigNormalized,
 ): Promise<boolean> {
-  const extractorsToExtract =
-    getConfiguredExtractors(linguiConfig).filter(isPerFileExtractor)
+  const extractorsToExtract = linguiConfig.extractors ?? [
+    createDefaultExtractor(linguiConfig),
+  ]
 
   for (const ext of extractorsToExtract) {
     if (!ext.match(filename)) continue
```

**File**: `packages/conf/__typetests__/index.tst.ts` (modified, +0/-11)
```diff
@@ -4,7 +4,6 @@ import {
   ExtractorCtx,
   FallbackLocales,
   LinguiConfig,
-  ExtractorType,
 } from "@lingui/conf"
 import { expect } from "tstyche"
 
@@ -125,13 +124,3 @@ expect({
     Trans: ["./custom-config", "Trans"] as [string, string],
   },
 }).type.toBeAssignableTo<LinguiConfig>()
-
-const extractor: ExtractorType = {
-  match: (fileName: string) => false,
-  extract: (
-    filename: string,
-    code: string,
-    onMessageExtracted: (msg: ExtractedMessage) => void,
-    ctx?: ExtractorCtx,
-  ) => {},
-}
```

**File**: `packages/conf/src/types.ts` (modified, +2/-48)
```diff
@@ -39,18 +39,8 @@ export type CatalogType<Extra = CatalogExtra> = {
   [msgId: string]: MessageType<Extra>
 }
 
-/**
- * Per-file extractor that processes one file at a time.
- * The CLI reads file contents and calls `extract` for each file that `match` returns true for.
- */
-export type PerFileExtractorType = {
-  /**
-   * Determine whether this extractor should handle the given file.
-   */
+export type ExtractorType = {
   match(filename: string): boolean
-  /**
-   * Extract messages from a single file's source code.
-   */
   extract(
     filename: string,
     code: string,
@@ -59,38 +49,6 @@ export type PerFileExtractorType = {
   ): Promise<void> | void
 }
 
-/**
- * Batch extractor that receives all matched file paths at once and handles
- * file I/O and parallelism internally.
- *
- * Files are matched using `match` and only those are passed to `extractFromFiles`.
- * The CLI does not read file contents or use worker pools for batch extractors.
- *
- * @experimental This type is experimental and may change in future versions.
- */
-export type Experimental__BatchExtractorType = {
-  /**
-   * Determine whether this extractor should handle the given file.
-   */
-  match(filename: string): boolean
-  /**
-   * Extract messages from multiple files at once.
-   * The extractor is responsible for reading file contents and managing concurrency.
-   *
-   * @param filenames - File paths that passed the `match` filter.
-   * @param onMessageExtracted - Callback to emit each extracted message.
-   * @param ctx - Extraction context containing the Lingui configuration.
-   */
-  extractFromFiles(
-    filenames: string[],
-    onMessageExtracted: (msg: ExtractedMessage) => void,
-    ctx: ExtractorCtx,
-  ): Promise<void>
-}
-
-export type ExtractorType =
-  PerFileExtractorType | Experimental__BatchExtractorType
-
 export type CatalogFormatter = {
   catalogExtension: string
   /**
@@ -322,11 +280,7 @@ export type LinguiConfig = {
   compilerBabelOptions?: any
   fallbackLocales?: FallbackLocales | false
   /**
-   * Specifies custom message extractor implementations.
-   *
-   * Extractors can be either per-file (with `match` and `extract` methods)
-   * or batch (with `extractFromFiles` method that receives all paths at once
-   * and handles file I/O and parallelism internally).
+   * Specifies custom message extractor implementations
    *
    * https://lingui.dev/guides/custom-extractor
    */
```

---

### Incident Patch 14: `279de2dc` (2026-09-14)
**Commit Message**: fix(cli): export all types that are part of the public API (#2668)

**File**: `packages/cli/src/index.ts` (modified, +2/-1)
```diff
@@ -1 +1,2 @@
-export { defineConfig } from "@lingui/conf"
+// Re-export both the `defineConfig` function and the types it depends on
+export { defineConfig, type LinguiConfig } from "@lingui/conf"
```

---

### Incident Patch 15: `8cff1f0a` (2026-09-11)
**Commit Message**: fix: make orderBy handling consistent (#2665)

**File**: `packages/cli/src/api/catalog.test.ts` (modified, +19/-0)
```diff
@@ -668,6 +668,25 @@ describe("order", () => {
     expect(Object.keys(orderedCatalogs)).toMatchSnapshot()
   })
 
+  it("should not depend on String.localeCompare when ordering message ids", () => {
+    const localeCompare = vi
+      .spyOn(String.prototype, "localeCompare")
+      .mockImplementation(() => {
+        throw new Error("host-locale-dependent comparison")
+      })
+    const catalog = {
+      z: makeNextMessage({ translation: "Z" }),
+      a: makeNextMessage({ translation: "A" }),
+    }
+
+    try {
+      expect(Object.keys(order("messageId", catalog))).toEqual(["a", "z"])
+      expect(localeCompare).not.toHaveBeenCalled()
+    } finally {
+      localeCompare.mockRestore()
+    }
+  })
+
   it("should order messages by origin", () => {
     const catalog = {
       LabelB: makeNextMessage({
```

**File**: `packages/cli/src/api/catalog.ts` (modified, +5/-5)
```diff
@@ -458,12 +458,16 @@ export function order<T extends CatalogType>(by: OrderBy, catalog: T): T {
       return acc
     }, {} as T)
 }
+// hardcoded en-US locale to have consistent sorting
+// @see https://github.com/lingui/js-lingui/pull/1808
+const collator = new Intl.Collator("en-US")
+
 /**
  * Object keys are in the same order as they were created
  * https://stackoverflow.com/a/31102605/1535540
  */
 const orderByMessageId: OrderByFn = (a, b) => {
-  return a.messageId.localeCompare(b.messageId)
+  return collator.compare(a.messageId, b.messageId)
 }
 
 const orderByOrigin: OrderByFn = (a, b) => {
@@ -516,10 +520,6 @@ export async function writeCompiled(
   return filename
 }
 
-// hardcoded en-US locale to have consistent sorting
-// @see https://github.com/lingui/js-lingui/pull/1808
-const collator = new Intl.Collator("en-US")
-
 export const orderByMessage: OrderByFn = (a, b) => {
   const aMsg = a.entry.message || ""
   const bMsg = b.entry.message || ""
```

**File**: `packages/conf/src/index.test.ts` (modified, +11/-0)
```diff
@@ -60,6 +60,17 @@ describe("@lingui/conf", () => {
     })
   })
 
+  it("should accept a custom `orderBy` function", () => {
+    mockConsole((console) => {
+      const orderBy = () => 0
+      const config = makeConfig({ locales: ["en"], orderBy })
+
+      expect(config.orderBy).toBe(orderBy)
+      expect(console.warn).not.toBeCalled()
+      expect(console.error).not.toBeCalled()
+    })
+  })
+
   it("should validate `format` and throw error if old string format passed (remove in v7)", () => {
     expect(() =>
       makeConfig({
```

**File**: `packages/conf/src/makeConfig.ts` (modified, +1/-0)
```diff
@@ -112,6 +112,7 @@ export const defaultConfig = {
 
 export const exampleConfig = {
   ...defaultConfig,
+  orderBy: multipleValidOptions("message", Function),
   macro: {
     ...defaultConfig.macro,
     idPrefixLeader: ".",
```

#### Recent Merged Pull Requests:
- **PR #2696** (2026-10-05): fix(format-csv): read catalogs that end with a line break (@giaBaoJS)
- **PR #2695** (2026-10-01): chore(release): published v6.9.0 [skip ci] (@andrii-bodnar)
- **PR #2694** (2026-10-01): chore: bump the root-and-package-dev-dependencies group across 4 directories with 11 updates (@dependabot[bot])
- **PR #2693** (2026-10-01): chore: bump the website-dependencies group in /website with 11 updates (@dependabot[bot])
- **PR #2692** (2026-10-01): ci: bump codecov/codecov-action from 7.0.0 to 7.1.1 in the github-actions group (@dependabot[bot])
- **PR #2691** (2026-10-01): chore: bump @lingui/native-tools to 0.1.5 (@andrii-bodnar)
- **PR #2690** (2026-10-01): fix(format-po-gettext): write one msgstr per plural form of locale (@giaBaoJS)
- **PR #2689** (2026-10-01): docs: document the native macro transform for Vite and extract-experimental (@andrii-bodnar)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
