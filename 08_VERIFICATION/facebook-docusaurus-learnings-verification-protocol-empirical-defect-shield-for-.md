# Verification Protocol: Verification Protocol: Empirical Defect Shield for facebook-docusaurus-learnings

<!-- PROVENANCE_START
{
  "source_repository": "facebook-docusaurus-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T14:22:56.283Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-facebook-docusaurus-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [facebook-docusaurus-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T14:22:56.283Z`  
> **Learning ID**: `LEARN-EVO-facebook-docusaurus-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `facebook-docusaurus-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/facebook-docusaurus-learnings.md`  
> **Source**: github ([https://github.com/facebook/docusaurus](https://github.com/facebook/docusaurus))  
> **Source Version**: `4c4ec4aa`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-17T14:22:51.050Z  
> **Learning ID**: `learn-github-meta-docusaurus`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): meta/docusaurus

> **Canonical Artifact**: `07_PROJECT_LEARNING/facebook-docusaurus-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/facebook/docusaurus](https://github.com/facebook/docusaurus))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T14:22:50.702Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `meta/docusaurus`
- **Description**: Easy to maintain open source documentation websites.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 66749 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `admin/new.docusaurus.io/functionUtils/playgroundUtils.ts`
```
/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

const CookieName = 'DocusaurusPlaygroundName';

const PlaygroundConfigs = {
  codesandbox:
    'https://codesandbox.io/p/sandbox/github/meta/docusaurus/tree/main/examples/classic?file=%2FREADME.md&privacy=public',
  'codesandbox-ts':
    'https://codesandbox.io/p/sandbox/github/meta/docusaurus/tree/main/examples/classic-typescript?file=%2FREADME.md&privacy=public',

  // Slow to load
  // stackblitz: 'https://stackblitz.com/github/meta/docusaurus/tree/main/examples/classic',
  // Dedicated branch: faster load
  stackblitz: 'https://stackblitz.com/github/meta/docusaurus/tree/starter',
  'stackblitz-ts':
    'https://stackblitz.com/github/meta/docusaurus/tree/main/examples/classic-typescript',
};

const PlaygroundDocumentationUrl = 'https://docusaurus.io/docs/playground';

export type PlaygroundName = keyof typeof PlaygroundConfigs;

function isValidPlaygroundName(
  playgroundName: string | undefined,
): playgroundName is PlaygroundName {
  return (
    !!playgroundName && Object.keys(PlaygroundConfigs).includes(playgroundName)
  );
}

export function createPlaygroundDocumentationResponse(): Response {
  return new Response(null, {
    status: 302,
    headers: {
      Location: PlaygroundDocumentationUrl,
    },
  });
}

export function createPlaygroundResponse(
  playgroundName: PlaygroundName,
): Response {
  const playgroundUrl = PlaygroundConfigs[playgroundName];
  // Not using Response.redirect(): its headers are immutable
  return new Response(null, {
    status: 302,
    headers: {
      Location: playgroundUrl,
      'Set-Cookie': `${CookieName}=${playgroundName}`,
    },
  });
}

// Inspired by https://stackoverflow.com/a/3409200/82609
function parseCookieString(cookieString: string): {[key: string]: string} {
  const result: {[key: string]: string} = {};
  cookieString.split(';').forEach((cookie) => {
    const [name, value] = cookie.split('=') as [string, string];
    result[name.trim()] = decodeURI(value);
  });
  return result;
}

export function readPlaygroundName(
  request: Request,
): PlaygroundName | undefined {
  const cookieString = request.headers.get('cookie');
  const parsedCookie: {[key: string]: string} = cookieString
    ? parseCookieString(cookieString)
    : {};
  const playgroundName: string | undefined = parsedCookie[CookieName];

  if (!isValidPlaygroundName(playgroundName)) {
    console.error(
      `playgroundName found in cookie was invalid: ${playgroundName}`,
    );
    return undefined;
  }
  return playgroundName;
}

```

### Core Architecture Module: `packages/create-docusaurus/src/utils.ts`
```
/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from 'node:path';
import {logger} from '@docusaurus/logger';
import {fs} from '@docusaurus/fs';
import {type PackageManager} from './constants.js';

/**
 * We use a simple kebab-case-like conversion
 * It's not perfect, but good enough
 * We don't want to depend on lodash in this package
 * See https://github.com/meta/docusaurus/pull/11653
 * @param siteName
 */
export function siteNameToPackageName(siteName: string): string {
  const match = siteName.match(
    /[A-Z]{2,}(?=[A-Z][a-z]+\d*|\b|_)|[A-Z]?[a-z]+\d*|[A-Z]|\d+/g,
  );
  if (match) {
    return match.map((x) => x.toLowerCase()).join('-');
  }
  return siteName;
}

export async function updatePkg(
  pkgPath: string,
  obj: {[key: string]: unknown},
): Promise<void> {
  const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8')) as {
    [key: string]: unknown;
  };
  const newPkg = Object.assign(pkg, obj);

  await fs.mkdir(path.dirname(pkgPath), {recursive: true});
  await fs.writeFile(pkgPath, `${JSON.stringify(newPkg, null, 2)}\n`);
}

export function printPackageManagerHelp({
  pkgManager,
  cdpath,
}: {
  pkgManager: PackageManager;
  cdpath: string;
}) {
  const useNpm = pkgManager === 'npm';
  const useBun = pkgManager === 'bun';
  const run = useNpm || useBun ? 'run ' : '';
  logger.success`Created name=${cdpath}.`;
  logger.info`Inside that directory, you can run several commands:

  code=${`${pkgManager} start`}
    Starts the development server.

  code=${`${pkgManager} ${run}build`}
    Bundles your website into static files for production.

  code=${`${pkgManager} ${run}serve`}
    Serves the built website locally.

  code=${`${pkgManager} ${run}deploy`}
    Publishes the website to GitHub pages.

We recommend that you begin by typing:

  code=${`cd ${cdpath}`}
  code=${`${pkgManager} start`}

Happy building awesome websites!
`;
}

```

### Core Architecture Module: `packages/docusaurus-babel/src/utils.ts`
```
/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import path from 'node:path';
import {BABEL_CONFIG_FILE_NAME} from '@docusaurus/utils';
import {pathExists} from '@docusaurus/fs';
import type {TransformOptions} from '@babel/core';

export async function getCustomBabelConfigFilePath(
  siteDir: string,
): Promise<string | undefined> {
  const customBabelConfigurationPath = path.join(
    siteDir,
    BABEL_CONFIG_FILE_NAME,
  );
  return (await pathExists(customBabelConfigurationPath))
    ? customBabelConfigurationPath
    : undefined;
}

/**
 * Returns the options to pass to Babel.
 * @param configFile the site's custom Babel config file, if any. Without it,
 * the Docusaurus Babel preset is used.
 */
export function getBabelOptions({
  isServer,
  configFile,
}: {
  isServer?: boolean;
  configFile?: string;
} = {}): TransformOptions {
  const caller = {name: isServer ? 'server' : 'client'};
  if (configFile) {
    return {
      babelrc: false,
      configFile,
      caller,
    };
  }
  return {
    presets: [require.resolve('@docusaurus/babel/preset')],
    babelrc: false,
    configFile: false,
    caller,
  };
}

```

### Core Architecture Module: `packages/docusaurus-fs/src/fsUtils.ts`
```
/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Small helpers to replace fs-extra APIs, with the same semantics.

import fsCallback from 'node:fs';
import path from 'node:path';
import {promisify} from 'node:util';
import logger from '@docusaurus/logger';
import {fs} from './fs';

/**
 * Checks if a file or directory exists, without throwing.
 * Same semantics as fs-extra `pathExists()`.
 */
export async function pathExists(filePath: string): Promise<boolean> {
  return fs.access(filePath).then(
    () => true,
    () => false,
  );
}

/**
 * Writes a file, creating the parent directories if they don't exist yet.
 * Same semantics as fs-extra `outputFile()`.
 */
export async function outputFile(
  filePath: string,
  data: Parameters<typeof fs.writeFile>[1],
  options?: Parameters<typeof fs.writeFile>[2],
): Promise<void> {
  await fs.mkdir(path.dirname(filePath), {recursive: true});
  await fs.writeFile(filePath, data, options);
}

// JSON.parse() rejects a leading UTF-8 BOM (U+FEFF) character, but some
// editors (such as Windows Notepad) add one when saving files
function stripUTF8BOM(content: string): string {
  return content.startsWith('\uFEFF') ? content.slice(1) : content;
}

/**
 * Reads and parses a JSON file, ignoring a leading UTF-8 BOM (like fs-extra
 * `readJSON()`).
 * @throws Throws an error mentioning the relative file path, with the read or
 * parse error as cause.
 */
export async function readJSON(filePath: string): Promise<unknown> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(stripUTF8BOM(content));
  } catch (err) {
    throw new Error(
      logger.interpolate`Failed to read JSON file at path=${path.relative(
        process.cwd(),
        filePath,
      )}`,
      {cause: err},
    );
  }
}

/**
 * Resolves a path to its canonical absolute path.
 * Same semantics as fs-extra `realpath()`, which uses the Node.js JavaScript
 * implementation `fs.realpath()`. In contrast, `fs/promises` `realpath()` uses
 * the native implementation, which may normalize path casing (macOS, Windows)
 * or resolve Windows subst/network drives differently from Node's module
 * resolution.
 */
export async function realpath(filePath: string): Promise<string> {
  return promisify(fsCallback.realpath)(filePath);
}

```

### Core Architecture Module: `packages/docusaurus-fs/src/queue.ts`
```
/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import PQueue from 'p-queue';

// Large sites can read/write a file for each of their thousands of docs/blog
// posts concurrently. We bound how many files we keep open at once to avoid
// EMFILE errors ("too many open files"): node:fs doesn't queue and retry
// operations failing with EMFILE like graceful-fs (used by fs-extra) does.
const DefaultFileOperationConcurrency = 100;

// Secret way to set the concurrency (see DOCUSAURUS_GIT_COMMAND_CONCURRENCY)
export function getFileOperationConcurrency(
  envValue: string | undefined = process.env.DOCUSAURUS_FS_CONCURRENCY,
): number {
  const concurrency = envValue ? parseInt(envValue, 10) : NaN;
  return concurrency > 0 ? concurrency : DefaultFileOperationConcurrency;
}

const FileOperationQueue = new PQueue({
  concurrency: getFileOperationConcurrency(),
});

/**
 * Runs a file system operation through the shared queue.
 * Only queue "leaf" operations: an operation waiting for another queued one
 * could wait for a free slot forever.
 */
export function queueFileOperation<T>(operation: () => Promise<T>): Promise<T> {
  return FileOperationQueue.add(operation);
}

```

### Core Architecture Module: `packages/docusaurus-glob/src/globUtils.ts`
```
/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Tinyglobby/Picomatch are the 2 libs we use in Docusaurus consistently

import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {fs} from '@docusaurus/fs';
import Picomatch from 'picomatch';
import * as Tinyglobby from 'tinyglobby';

/**
 * Our own glob options: we only expose the options we actually use, so that
 * we can swap the underlying lib (e.g. for Node.js native `fs.glob`).
 */
export type GlobOptions = Pick<
  Tinyglobby.GlobOptions,
  'cwd' | 'ignore' | 'absolute' | 'expandDirectories'
>;

/**
 * Finds the files matching the given glob patterns, in a stable order. A
 * pattern that is the path of an existing directory matches all the files of
 * that directory.
 */
export async function glob(
  patterns: string | string[],
  options?: GlobOptions,
): Promise<string[]> {
  const cwd = options?.cwd ?? process.cwd();
  const cwdPath = cwd instanceof URL ? fileURLToPath(cwd) : cwd;
  const expandedPatterns = await Promise.all(
    [patterns]
      .flat()
      .map((pattern) => expandDirectoryPattern(pattern, cwdPath)),
  );
  const files = await Tinyglobby.glob(expandedPatterns, {
    // Tinyglobby appends `/**` to all patterns, even `**/*.md`, unlike globby
    // See https://github.com/meta/docusaurus/pull/13037
    expandDirectories: false,
    // Other lib options are still forwarded at runtime for retro-compatibility
    ...options,
  });
  // Tinyglobby reads folders concurrently: their files come in a random order
  // See https://github.com/meta/docusaurus/pull/13031
  return files.sort();
}

// Like globby, only expand the patterns of existing directories
// See https://github.com/sindresorhus/globby/blob/v16.2.4/index.js#L91-L111
// Doing it ourselves eases a later migration to Node.js `fs.glob`, which never
// expands directories
async function expandDirectoryPattern(
  pattern: string,
  cwd: string,
): Promise<string> {
  if (pattern.startsWith('!')) {
    return pattern;
  }
  const isDirectory = await fs.stat(path.resolve(cwd, pattern)).then(
    (stats) => stats.isDirectory(),
    () => false,
  );
  // The directory path is literal: `[old]` or `(copy)` are not glob syntax
  return isDirectory
    ? path.posix.join(Tinyglobby.escapePath(pattern), '**')
    : pattern;
}

/**
 * The default glob patterns we ignore when sourcing content.
 * - Ignore files and folders starting with `_` recursively
 * - Ignore tests
 */
export const GlobExcludeDefault = [
  '**/_*.{js,jsx,ts,tsx,md,mdx}',
  '**/_*/**',
  '**/*.test.{js,jsx,ts,tsx}',
  '**/__tests__/**',
];

type Matcher = (str: string) => boolean;

/**
 * Creates a matcher that tells if a path is matched by any of the patterns.
 *
 * @see {@link createAbsoluteFilePathMatcher}
 * @param patterns A list of glob patterns. If the list is empty, it defaults to
 * matching none.
 * @returns A matcher handle that tells if a file path is matched by any of the
 * patterns.
 */
export function createMatcher(patterns: string[]): Matcher {
  if (patterns.length === 0) {
    // `/(?:)/.test("foo")` is `true`
    return () => false;
  }
  // makeRe() does not detect the OS: accept \ separators on Windows
  const options = {windows: process.platform === 'win32'};
  const regexp = new RegExp(
    patterns
      .map((pattern) => Picomatch.makeRe(pattern, options).source)
      .join('|'),
  );
  return (str) => regexp.test(str);
}

/**
 * We use match patterns like `"** /_* /**"` (ignore the spaces), where `"_*"`
 * should only be matched within a subfolder. This function would:
 * - Match `/user/sebastien/website/docs/_partials/xyz.md`
 * - Ignore `/user/_sebastien/website/docs/partials/xyz.md`
 *
 * @param patterns A list of glob patterns.
 * @param rootFolders A list of root folders to resolve the glob from.
 * @returns A matcher handle that tells if a file path is matched by any of the
 * patterns, resolved from the first root folder that contains the path.
 * @throws Throws when the returned matcher receives a path that doesn't belong
 * to any of the `rootFolders`.
 */
export function createAbsoluteFilePathMatcher(
  patterns: string[],
  rootFolders: string[],
): Matcher {
  const matcher = createMatcher(patterns);

  function getRelativeFilePath(absoluteFilePath: string) {
    const rootFolder = rootFolders.find((folderPath) =>
      ['/', '\\'].some((separator) =>
        absoluteFilePath.startsWith(
          folderPath.endsWith(separator) ? folderPath : folderPath + separator,
        ),
      ),
    );
    if (!rootFolder) {
      throw new Error(
        `createAbsoluteFilePathMatcher unexpected error, absoluteFilePath=${absoluteFilePath} was not contained in any of the root folders: ${rootFolders.join(
          ', ',
        )}`,
      );
    }
    return path.relative(rootFolder, absoluteFilePath);
  }

  return (absoluteFilePath: string) =>
    matcher(getRelativeFilePath(absoluteFilePath));
}

// Duplicated from @docusaurus/utils to keep this package dependency-free
// See https://github.com/sindresorhus/slash/blob/main/index.js
function posixPath(str: string): string {
  const isExtendedLengthPath = str.startsWith('\\\\?\\');
  if (isExtendedLengthPath) {
    return str;
  }
  return str.replace(/\\/g, '/');
}

// Glob that fix Windows path patterns
// See https://github.com/meta/docusaurus/pull/4222#issuecomment-795517329
export async function safeGlob(
  patterns: string[],
  options?: GlobOptions,
): Promise<string[]> {
  // Required for Windows support, as paths using \ should not be used by glob
  // (also using the windows hard drive prefix like c: is not a good idea)
  const globPaths = patterns.map((dirPath) =>
    posixPath(path.relative(process.cwd(), dirPath)),
  );

  return glob(globPaths, options);
}

```

### Core Architecture Module: `packages/docusaurus-glob/src/translationUtils.ts`
```
/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Awkward to have translation code in this package, but it is consumed by both
// @docusaurus/core and @docusaurus/theme-translations: this avoids duplication

import path from 'node:path';
import {safeGlob} from './globUtils';

export const isTranslatableSourceFile: (filePath: string) => boolean = (() => {
  // We only support extracting source code translations from these extensions
  const extensionsAllowed = new Set([
    '.js',
    '.jsx',
    '.ts',
    '.tsx',
    // TODO support md/mdx too? (may be overkill)
    // need to compile the MDX to JSX first and remove front matter
    // '.md',
    // '.mdx',
  ]);

  const isBlacklistedFilePath = (filePath: string) => {
    // We usually extract from ts files, unless they are .d.ts files
    return filePath.endsWith('.d.ts');
  };

  return (filePath): boolean => {
    const ext = path.extname(filePath);
    return extensionsAllowed.has(ext) && !isBlacklistedFilePath(filePath);
  };
})();

export async function globTranslatableSourceFiles(
  patterns: string[],
): Promise<string[]> {
  const filePaths = await safeGlob(patterns, {
    absolute: true,
  });
  return filePaths.filter(isTranslatableSourceFile);
}

```

### Core Architecture Module: `packages/docusaurus-glob/src/watchUtils.ts`
```
/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

// Chokidar is the lib we use in Docusaurus to watch files

import * as Chokidar from 'chokidar';

/**
 * Our own watch options: we only expose the options we actually use, so that
 * we can upgrade or swap the underlying lib.
 */
export type WatchOptions = Pick<
  Chokidar.WatchOptions,
  'cwd' | 'usePolling' | 'interval'
>;

/** Our own file watcher handle, exposing only the APIs we actually use. */
export type Watcher = Pick<Chokidar.FSWatcher, 'on' | 'close'>;

/**
 * Watches file system paths for changes.
 * Only emits events for changes happening after the watcher is created.
 */
export function watch(
  paths: string | string[],
  options?: WatchOptions,
): Watcher {
  return Chokidar.watch(paths, {
    // Other lib options are still forwarded at runtime for retro-compatibility
    ...options,
    ignoreInitial: true,
  });
}

```

### Core Architecture Module: `packages/docusaurus-mdx-loader/src/remark/toc/utils.ts`
```
/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import {toString} from 'mdast-util-to-string';
import {valueToEstree} from 'estree-util-value-to-estree';
import escapeHtml from 'escape-html';
import type {Node, Parent} from 'unist';
import type {
  MdxjsEsm,
  MdxJsxAttribute,
  MdxJsxTextElement,
} from 'mdast-util-mdx';
import type {TOCHeading, TOCItem, TOCItems, TOCSlice} from './types';
import type {
  Program,
  SpreadElement,
  ImportDeclaration,
  ImportSpecifier,
} from 'estree';
import type {Heading, PhrasingContent} from 'mdast';

export function getImportDeclarations(program: Program): ImportDeclaration[] {
  return program.body.filter(
    (item): item is ImportDeclaration => item.type === 'ImportDeclaration',
  );
}

export function isMarkdownImport(node: Node): node is ImportDeclaration {
  if (node.type !== 'ImportDeclaration') {
    return false;
  }
  const importPath = (node as ImportDeclaration).source.value;
  return typeof importPath === 'string' && /\.mdx?$/.test(importPath);
}

export function findDefaultImportName(
  importDeclaration: ImportDeclaration,
): string | undefined {
  return importDeclaration.specifiers.find(
    (o: Node) => o.type === 'ImportDefaultSpecifier',
  )?.local.name;
}

function findNamedImportSpecifier(
  importDeclaration: ImportDeclaration,
  localName: string,
): ImportSpecifier | undefined {
  return importDeclaration?.specifiers.find(
    (specifier): specifier is ImportSpecifier =>
      specifier.type === 'ImportSpecifier' &&
      specifier.local.name === localName,
  );
}

// Before: import Partial from "partial"
// After: import Partial, {toc as __tocPartial} from "partial"
export function addTocSliceImportIfNeeded({
  importDeclaration,
  tocExportName,
  tocSliceImportName,
}: {
  importDeclaration: ImportDeclaration;
  tocExportName: string;
  tocSliceImportName: string;
}): void {
  // We only add the toc slice named import if it doesn't exist already
  if (!findNamedImportSpecifier(importDeclaration, tocSliceImportName)) {
    importDeclaration.specifiers.push({
      type: 'ImportSpecifier',
      imported: {type: 'Identifier', name: tocExportName},
      local: {type: 'Identifier', name: tocSliceImportName},
    });
  }
}

export function isNamedExport(
  node: Node,
  exportName: string,
): node is MdxjsEsm {
  if (node.type !== 'mdxjsEsm') {
    return false;
  }
  const program = (node as MdxjsEsm).data?.estree;
  if (!program) {
    return false;
  }
  if (program.body.length !== 1) {
    return false;
  }
  const exportDeclaration = program.body[0]!;
  if (exportDeclaration.type !== 'ExportNamedDeclaration') {
    return false;
  }
  const variableDeclaration = exportDeclaration.declaration;
  if (variableDeclaration?.type !== 'VariableDeclaration') {
    return false;
  }
  const {id} = variableDeclaration.declarations[0]!;
  if (id.type !== 'Identifier') {
    return false;
  }

  return id.name === exportName;
}

export function createTOCExportNodeAST({
  tocExportName,
  tocItems,
}: {
  tocExportName: string;
  tocItems: TOCItems;
}): MdxjsEsm {
  function createTOCSliceAST(tocSlice: TOCSlice): SpreadElement {
    return {
      type: 'SpreadElement',
      argument: {type: 'Identifier', name: tocSlice.importName},
    };
  }

  function createTOCHeadingAST({heading}: TOCHeading) {
    const value: TOCItem = {
      value: toHeadingHTMLValue(heading),
      id: heading.data!.id!,
      level: heading.depth,
    };
    return valueToEstree(value);
  }

  function createTOCItemAST(tocItem: TOCItems[number]) {
    switch (tocItem.type) {
      case 'slice':
        return createTOCSliceAST(tocItem);
      case 'heading':
        return createTOCHeadingAST(tocItem);
      default: {
        throw new Error(`unexpected toc item type`);
      }
    }
  }

  return {
    type: 'mdxjsEsm',
    value: '', // See https://github.com/meta/docusaurus/pull/9684#discussion_r1457595181
    data: {
      estree: {
        type: 'Program',
        body: [
          {
            type: 'ExportNamedDeclaration',
            attributes: [],
            declaration: {
              type: 'VariableDeclaration',
              declarations: [
                {
                  type: 'VariableDeclarator',
                  id: {
                    type: 'Identifier',
                    name: tocExportName,
                  },
                  init: {
                    type: 'ArrayExpression',
                    elements: tocItems.map(createTOCItemAST),
                  },
                },
              ],
              kind: 'const',
            },
            specifiers: [],
            source: null,
          },
        ],
        sourceType: 'module',
      },
    },
  };
}

function stringifyChildren(node: Parent): string {
  return (node.children as PhrasingContent[])
    .map(toHeadingHTMLValue)
    .join('')
    .trim();
}

// TODO This is really a workaround, and not super reliable
// For now we only support serializing tagName, className and content
// Can we implement the TOC with real JSX nodes instead of html strings later?
function mdxJsxTextElementToHtml(element: MdxJsxTextElement): string {
  const tag = element.name;

  // See https://github.com/meta/docusaurus/issues/11003#issuecomment-2733925363
  if (tag === 'img') {
    return '';
  }

  const attributes = element.attributes.filter(
    (child): child is MdxJsxAttribute => child.type === 'mdxJsxAttribute',
  );

  const classAttribute =
    attributes.find((attr) => attr.name === 'className') ??
    attributes.find((attr) => attr.name === 'class');

  const classAttributeString = classAttribute
    ? `class="${escapeHtml(String(classAttribute.value))}"`
    : ``;

  const allAttributes = classAttributeString ? ` ${classAttributeString}` : '';

  const content = stringifyChildren(element);

  return `<${tag}${allAttributes}>${content}</${tag}>`;
}

export function toHeadingHTMLValue(
  node: PhrasingContent | Heading | MdxJsxTextElement,
): string {
  switch (node.type) {
    case 'mdxJsxTextElement': {
      return mdxJsxTextElementToHtml(node as MdxJsxTextElement);
    }
    case 'text':
      return escapeHtml(node.value);
    case 'heading':
      return stringifyChildren(node);
    case 'inlineCode':
      return `<code>${escapeHtml(node.value)}</code>`;
    case 'emphasis':
      return `<em>${stringifyChildren(node)}</em>`;
    case 'strong':
      return `<strong>${stringifyChildren(node)}</strong>`;
    case 'delete':
      return `<del>${stringifyChildren(node)}</del>`;
    case 'link':
      return stringifyChildren(node);
    default:
      return toString(node);
  }
}

```

### Core Architecture Module: `packages/docusaurus-mdx-loader/src/remark/utils/index.ts`
```
/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import logger from '@docusaurus/logger';
import type {Node} from 'unist';
import type {MdxJsxAttributeValueExpression} from 'mdast-util-mdx';

/**
 * Util to transform one node type to another node type
 * The input node is mutated in place
 * @param node the node to mutate
 * @param newNode what the original node should become become
 */
export function transformNode<NewNode extends Node>(
  node: Node,
  newNode: NewNode,
): NewNode {
  Object.keys(node).forEach((key) => {
    // @ts-expect-error: unsafe but ok
    delete node[key];
  });
  Object.keys(newNode).forEach((key) => {
    // @ts-expect-error: unsafe but ok
    node[key] = newNode[key];
  });
  return node as NewNode;
}

export function assetRequireAttributeValue(
  requireString: string,
  hash: string,
): MdxJsxAttributeValueExpression {
  return {
    type: 'mdxJsxAttributeValueExpression',
    value: `require("${requireString}")${hash && ` + '${hash}'`}`,
    data: {
      estree: {
        type: 'Program',
        body: [
          {
            type: 'ExpressionStatement',
            expression: {
              type: 'BinaryExpression',
              left: {
                type: 'CallExpression',
                callee: {
                  type: 'Identifier',
                  name: 'require',
                },
                arguments: [
                  {
                    type: 'Literal',
                    value: requireString,
                    raw: `"${requireString}"`,
                  },
                ],
                optional: false,
              },
              operator: '+',
              right: {
                type: 'Literal',
                value: hash,
                raw: `"${hash}"`,
              },
            },
          },
        ],
        sourceType: 'module',
        comments: [],
      },
    },
  };
}

function formatNodePosition(node: Node): string | undefined {
  return node.position?.start
    ? logger.interpolate`number=${node.position.start.line}:number=${node.position.start.column}`
    : undefined;
}

// Returns " (line:column)" when position info is available
// The initial space is useful to append easily to any existing message
export function formatNodePositionExtraMessage(node: Node): string {
  const position = formatNodePosition(node);
  return `${position ? ` (${position})` : ''}`;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #12743** (2026-10-29): **Add the mobile-web-app-capable meta tag to the website's PWA configuration**
  *Symptoms*: ### Have you read the Contributing Guidelines on issues?  - [x] I have read the [Contributing Guidelines on issues](https://github.com/facebook/docusaurus/blob/main/CONTRIBUTING.md#issues).  ### Prerequisites  - [x] I'm using the latest version of Docusaurus. - [x] I have tried the `npm run clear` or `yarn clear` command. - [x] I have tried `rm -rf node_modules yarn.lock package-lock.json` and re-installing packages. - [x] I have tried creating a repro with https://new.docusaurus.io. - [x] I have read the console error message carefully (if applicable).  ### Description  ### Description  The Docusaurus website's PWA configuration includes the `apple-mobile-web-app-capable` meta tag, which triggers a deprecation warning in Chrome.  The browser console reports:  ```text (index):1 <meta name="apple-mobile-web-app-capable" content="yes"> is deprecated. Please include <meta name="mobile-web-app-capable" content="yes"> ```  The existing configuration is in `website/docusaurus.config.ts` and includes the Apple-specific meta tag with `content: 'yes'`.  Adding the standard `mobile-web-app-capable` meta tag alongside the existing Apple-specific tag may resolve this warning while preserving compatibility with Apple devices.  I would be happy to investigate and implement this change if the maintainers consider it appropriate.  ### Reproducible demo  https://docusaurus.io/  ### Steps to reproduce  1. Visit https://docusaurus.io/. 2. Open Chrome Developer Tools. 3. Select the Console tab. 

- **Issue #12584** (2026-10-08): **Security: Update to Tinypool 2.1.2 in @docusaurus/core@3.x - CVE-2026-104848 CVE-2026-104849**
  *Symptoms*: ### Have you read the Contributing Guidelines on issues?  - [x] I have read the [Contributing Guidelines on issues](https://github.com/facebook/docusaurus/blob/main/CONTRIBUTING.md#issues).  ### Prerequisites  - [x] I'm using the latest version of Docusaurus. - [x] I have tried the `npm run clear` or `yarn clear` command. - [x] I have tried `rm -rf node_modules yarn.lock package-lock.json` and re-installing packages. - [ ] I have tried creating a repro with https://new.docusaurus.io. - [ ] I have read the console error message carefully (if applicable).  ### Description  Please update to Tinypool 2.1.2 in @docusaurus/core@3.x  Consider using an CVE-Scanner and an automatic update tool like renovate.  See:  - [GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) - [cve-2026-104849](https://nvd.nist.gov/vuln/detail/cve-2026-104849) - [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) - [cve-2026-104848](https://nvd.nist.gov/vuln/detail/cve-2026-104848)  ### Reproducible demo  _No response_  ### Steps to reproduce  1. npm install 2. npm audit  ### Expected behavior  No critical Dependencies  ### Actual behavior  `45 vulnerabilities (2 low, 13 moderate, 14 high, 16 critical)`  ### Your environment  - Docusaurus version used: 3.10.2   ### Self-service  - [ ] I'd be willing to fix this bug myself.

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

### Incident Patch 1: `5b2eeddc` (2026-11-13)
**Commit Message**: fix(pwa): only use our own precache manifest injection when MD5 is not available (#13043)

* fix(pwa): only use our own precache manifest injection when MD5 is not available

Keeps the official Workbox injectManifest() code path for most sites, and
only falls back to injectManifestFIPS() in FIPS mode, until Workbox
supports it (GoogleChrome/workbox#3366).

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test(pwa): don't hardcode MD5 in the expected precache revisions

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test(pwa): test injectManifestFIPS() without MD5, like in FIPS mode

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* refactor(pwa): rename precacheManifest.ts to injectManifestFIPS.ts

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test(pwa): assert the revisions differ from Workbox, and the service worker isn't precached

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `packages/docusaurus-plugin-pwa/src/__tests__/injectManifestFIPS.test.ts` (renamed, +46/-13)
```diff
@@ -5,13 +5,19 @@
  * LICENSE file in the root directory of this source tree.
  */
 
-import {describe, expect, it} from 'vitest';
+import {describe, expect, it, vi} from 'vitest';
 import crypto from 'node:crypto';
 import fs from 'node:fs/promises';
 import {tmpdir} from 'node:os';
 import path from 'node:path';
 import {injectManifest, type ManifestEntry} from 'workbox-build';
-import {injectPrecacheManifest} from '../precacheManifest';
+import {injectManifestFIPS} from '../injectManifestFIPS';
+
+// injectManifestFIPS() only runs when MD5 is not available
+vi.mock('node:crypto', async (importOriginal) => ({
+  ...(await importOriginal<typeof import('node:crypto')>()),
+  getHashes: () => ['sha256'],
+}));
 
 const SwSource = 'const manifest = self.__WB_MANIFEST;';
 
@@ -49,36 +55,63 @@ function getOptions(outDir: string) {
   };
 }
 
-describe('injectPrecacheManifest', () => {
-  it('injects the same manifest as Workbox', async () => {
+describe('injectManifestFIPS', () => {
+  it('injects the same files as Workbox', async () => {
     await using workboxOutDir = await createOutDir();
     await using outDir = await createOutDir();
 
     await injectManifest(getOptions(workboxOutDir.path));
-    await injectPrecacheManifest(getOptions(outDir.path));
+    await injectManifestFIPS(getOptions(outDir.path));
 
     const workboxManifest = await readSwManifest(workboxOutDir.path);
     const manifest = await readSwManifest(outDir.path);
-    expect(manifest).toEqual(workboxManifest);
+    expect(manifest.map((entry) => entry.url)).toEqual(
+      workboxManifest.map((entry) => entry.url),
+    );
+    // Workbox hashes with MD5 anyway
+    manifest.forEach((entry, index) => {
+      expect(entry.revision).not.toBe(workboxManifest[index]!.revision);
+    });
   });
 
-  it('injects files hashed with MD5, except the service worker', async () => {
+  it('injects files hashed with SHA-256', async () => {
     await using outDir = await createOutDir();
 
-    await injectPrecacheManifest(getOptions(outDir.path));
+    await injectManifestFIPS(getOptions(outDir.path));
 
     const manifest = await readSwManifest(outDir.path);
     expect(manifest).toEqual([
-      {url: 'assets/main.css', revision: 'aa676972bbd2b68e94ef8e91e81d20be'},
-      {url: 'assets/main.js', revision: '238e96d5b62a1aec3739730469f27192'},
-      {url: 'index.html', revision: 'fe919dfbe925337c176e602ebbf0d15c'},
+      {
+        url: 'assets/main.css',
+        revision:
+          '7c98040a541657584690ae2a1cc3b42a8b53b159cc60c5d3abbfecbaeac6c94a',
+      },
+      {
+        url: 'assets/main.js',
+        revision:
+          '6e11c72f7cf6bc383152dd16ddd5903aba6bb1c99d6b6639a4bb0b838185fa92',
+      },
+      {
+        url: 'index.html',
+        revision:
+          '1a7133067a4ac7fe06565943dd44870f232041b1d28b4340e2b678244a3b79f6',
+      },
     ]);
   });
 
+  it("doesn't precache the service worker", async () => {
+    await using outDir = await createOutDir();
+
+    await injectManifestFIPS(getOptions(outDir.path));
+
+    const manifest = await readSwManifest(outDir.path);
+    expect(manifest.map((entry) => entry.url)).not.toContain('sw.js');
+  });
+
   it('delegates templatedURLs to Workbox', async () => {
     await using outDir = await createOutDir();
 
-    await injectPrecacheManifest({
+    await injectManifestFIPS({
       ...getOptions(outDir.path),
       templatedURLs: {'/app-shell': 'shell'},
     });
@@ -93,7 +126,7 @@ describe('injectPrecacheManifest', () => {
   it('applies the Workbox manifest options', async () => {
     await using outDir = await createOutDir();
 
-    await injectPrecacheManifest({
+    await injectManifestFIPS({
       ...getOptions(outDir.path),
       globIgnores: ['**/*.css'],
       maximumFileSizeToCacheInBytes: 10,
```

**File**: `packages/docusaurus-plugin-pwa/src/index.ts` (modified, +5/-2)
```diff
@@ -13,11 +13,12 @@ import {
   getProgressBarPlugin,
   getMinimizers,
 } from '@docusaurus/bundler';
+import {injectManifest} from 'workbox-build';
 import {normalizeUrl} from '@docusaurus/utils';
 import logger from '@docusaurus/logger';
 import {readDefaultCodeTranslationMessages} from '@docusaurus/theme-translations';
 import {getGlobPatterns} from './globPatterns';
-import {injectPrecacheManifest} from './precacheManifest';
+import {injectManifestFIPS, isMD5Available} from './injectManifestFIPS';
 import type {HtmlTags, LoadContext, Plugin} from '@docusaurus/types';
 import type {PluginOptions} from '@docusaurus/plugin-pwa';
 
@@ -175,7 +176,9 @@ export default function pluginPWA(
 
       const swDest = path.resolve(props.outDir, 'sw.js');
 
-      await injectPrecacheManifest({
+      const inject = isMD5Available() ? injectManifest : injectManifestFIPS;
+
+      await inject({
         ...injectManifestConfig,
         globPatterns: getGlobPatterns(injectManifestConfig),
         // Those attributes are not overrideable
```

**File**: `packages/docusaurus-plugin-pwa/src/injectManifestFIPS.ts` (renamed, +12/-2)
```diff
@@ -5,6 +5,7 @@
  * LICENSE file in the root directory of this source tree.
  */
 
+import {getHashes} from 'node:crypto';
 import path from 'node:path';
 import {injectManifest} from 'workbox-build';
 // Internal Workbox APIs, to apply the user options the same way Workbox does
@@ -16,12 +17,21 @@ import logger from '@docusaurus/logger';
 import {hashString, posixPath} from '@docusaurus/utils';
 import type {FileDetails, InjectManifestOptions} from 'workbox-build';
 
+/** FIPS mode rejects MD5 */
+export function isMD5Available(): boolean {
+  return getHashes().includes('md5');
+}
+
 /**
  * Same as Workbox `injectManifest()`, but falls back to SHA-256 to hash the
  * files when MD5 is not available. Workbox hardcodes MD5, which FIPS mode
- * rejects. See https://github.com/GoogleChrome/workbox/issues/3366
+ * rejects. Only use it when MD5 is not available, to keep the Workbox code
+ * path everywhere else.
+ *
+ * TODO temporary workaround: remove once Workbox supports FIPS mode
+ *  See https://github.com/GoogleChrome/workbox/issues/3366
  */
-export async function injectPrecacheManifest(
+export async function injectManifestFIPS(
   config: InjectManifestOptions,
 ): Promise<void> {
   const options = validateInjectManifestOptions(config);
```

---

### Incident Patch 2: `05200e2c` (2026-11-13)
**Commit Message**: fix(glob): only expand the glob patterns of existing directories, like globby (#13045)

Tinyglobby appends `/**` to all the patterns by default: `**/*.{md,mdx}`
matched `folder.md/notes.txt`, which the docs, blog and pages plugins
loaded as content. `glob()` now only expands the patterns that are the
path of an existing directory, like globby did in v3, and escapes that
path so that directory names with glob characters work.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `packages/docusaurus-glob/package.json` (modified, +1/-0)
```diff
@@ -18,6 +18,7 @@
   },
   "license": "MIT",
   "dependencies": {
+    "@docusaurus/fs": "workspace:*",
     "chokidar": "catalog:",
     "picomatch": "catalog:",
     "tinyglobby": "catalog:",
```

**File**: `packages/docusaurus-glob/src/__tests__/__fixtures__/folder-named-like-file/doc.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+# Doc
```

**File**: `packages/docusaurus-glob/src/__tests__/__fixtures__/folder-named-like-file/folder.md/doc.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+# Doc
```

**File**: `packages/docusaurus-glob/src/__tests__/__fixtures__/folder-named-like-file/folder.md/notes.txt` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+Not a doc
```

**File**: `packages/docusaurus-glob/src/__tests__/__fixtures__/glob-characters/folder (copy) [old]/doc.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+# Doc
```

**File**: `packages/docusaurus-glob/src/__tests__/globUtils.test.ts` (modified, +57/-1)
```diff
@@ -10,10 +10,11 @@ import os from 'node:os';
 import path from 'node:path';
 import fs from 'node:fs/promises';
 import {
+  glob,
+  safeGlob,
   GlobExcludeDefault,
   createMatcher,
   createAbsoluteFilePathMatcher,
-  glob,
 } from '../globUtils';
 
 describe('glob', () => {
@@ -45,6 +46,45 @@ describe('glob', () => {
       path.join('b', 'a.md'),
     ]);
   });
+
+  describe('with a folder named like a file', () => {
+    const cwd = path.join(__dirname, '__fixtures__', 'folder-named-like-file');
+
+    it('does not match the files of a folder named like the pattern', async () => {
+      await expect(glob(['**/*.md'], {cwd})).resolves.toEqual([
+        'doc.md',
+        'folder.md/doc.md',
+      ]);
+    });
+
+    it('matches all the files of a directory pattern', async () => {
+      await expect(glob(['folder.md'], {cwd})).resolves.toEqual([
+        'folder.md/doc.md',
+        'folder.md/notes.txt',
+      ]);
+    });
+
+    it('matches all the files of a directory pattern with a trailing slash', async () => {
+      await expect(glob(['folder.md/'], {cwd})).resolves.toEqual([
+        'folder.md/doc.md',
+        'folder.md/notes.txt',
+      ]);
+    });
+
+    it('ignores all the files of a directory', async () => {
+      await expect(
+        glob(['**/*'], {cwd, ignore: ['folder.md']}),
+      ).resolves.toEqual(['doc.md']);
+    });
+  });
+
+  it('matches all the files of a directory named with glob characters', async () => {
+    await expect(
+      glob(['folder (copy) [old]'], {
+        cwd: path.join(__dirname, '__fixtures__', 'glob-characters'),
+      }),
+    ).resolves.toEqual(['folder (copy) [old]/doc.md']);
+  });
 });
 
 describe('createMatcher', () => {
@@ -169,3 +209,19 @@ describe('createAbsoluteFilePathMatcher', () => {
     ).toBe(false);
   });
 });
+
+describe('safeGlob', () => {
+  it('matches all the files of an absolute directory path', async () => {
+    const dirPath = path.join(
+      __dirname,
+      '__fixtures__',
+      'folder-named-like-file',
+      'folder.md',
+    );
+    const files = await safeGlob([dirPath], {absolute: true});
+    expect(files.map((file) => path.relative(dirPath, file))).toEqual([
+      'doc.md',
+      'notes.txt',
+    ]);
+  });
+});
```

**File**: `packages/docusaurus-glob/src/globUtils.ts` (modified, +42/-3)
```diff
@@ -8,6 +8,8 @@
 // Tinyglobby/Picomatch are the 2 libs we use in Docusaurus consistently
 
 import path from 'node:path';
+import {fileURLToPath} from 'node:url';
+import {fs} from '@docusaurus/fs';
 import Picomatch from 'picomatch';
 import * as Tinyglobby from 'tinyglobby';
 
@@ -20,18 +22,55 @@ export type GlobOptions = Pick<
   'cwd' | 'ignore' | 'absolute' | 'expandDirectories'
 >;
 
-/** Finds the files matching the given glob patterns, in a stable order. */
+/**
+ * Finds the files matching the given glob patterns, in a stable order. A
+ * pattern that is the path of an existing directory matches all the files of
+ * that directory.
+ */
 export async function glob(
   patterns: string | string[],
   options?: GlobOptions,
 ): Promise<string[]> {
-  // Other lib options are still forwarded at runtime for retro-compatibility
-  const files = await Tinyglobby.glob(patterns, {...options});
+  const cwd = options?.cwd ?? process.cwd();
+  const cwdPath = cwd instanceof URL ? fileURLToPath(cwd) : cwd;
+  const expandedPatterns = await Promise.all(
+    [patterns]
+      .flat()
+      .map((pattern) => expandDirectoryPattern(pattern, cwdPath)),
+  );
+  const files = await Tinyglobby.glob(expandedPatterns, {
+    // Tinyglobby appends `/**` to all patterns, even `**/*.md`, unlike globby
+    // See https://github.com/meta/docusaurus/pull/13037
+    expandDirectories: false,
+    // Other lib options are still forwarded at runtime for retro-compatibility
+    ...options,
+  });
   // Tinyglobby reads folders concurrently: their files come in a random order
   // See https://github.com/meta/docusaurus/pull/13031
   return files.sort();
 }
 
+// Like globby, only expand the patterns of existing directories
+// See https://github.com/sindresorhus/globby/blob/v16.2.4/index.js#L91-L111
+// Doing it ourselves eases a later migration to Node.js `fs.glob`, which never
+// expands directories
+async function expandDirectoryPattern(
+  pattern: string,
+  cwd: string,
+): Promise<string> {
+  if (pattern.startsWith('!')) {
+    return pattern;
+  }
+  const isDirectory = await fs.stat(path.resolve(cwd, pattern)).then(
+    (stats) => stats.isDirectory(),
+    () => false,
+  );
+  // The directory path is literal: `[old]` or `(copy)` are not glob syntax
+  return isDirectory
+    ? path.posix.join(Tinyglobby.escapePath(pattern), '**')
+    : pattern;
+}
+
 /**
  * The default glob patterns we ignore when sourcing content.
  * - Ignore files and folders starting with `_` recursively
```

**File**: `packages/docusaurus-plugin-content-blog/src/__tests__/index.test.ts` (modified, +0/-1)
```diff
@@ -464,7 +464,6 @@ describe('blog plugin', () => {
     const blogPosts = await getBlogPosts(siteDir);
 
     expect(blogPosts.map((post) => post.metadata.source).sort()).toEqual([
-      '@site/blog/folder.md/notes.txt',
       '@site/blog/folder.md/post.md',
     ]);
   });
```

---

### Incident Patch 3: `42e00a97` (2026-11-13)
**Commit Message**: fix(glob): sort glob results, files of different folders came in a random order (#13031)

* fix(glob): return files in a stable order, whatever the file system and runtime

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* link this PR in the comment

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* sort with a plain sort(), test the concurrent folder reads that cause the random order

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

---------

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `packages/docusaurus-glob/src/__tests__/globUtils.test.ts` (modified, +36/-1)
```diff
@@ -5,13 +5,48 @@
  * LICENSE file in the root directory of this source tree.
  */
 
-import {describe, expect, it} from 'vitest';
+import {describe, expect, it, onTestFinished} from 'vitest';
+import os from 'node:os';
+import path from 'node:path';
+import fs from 'node:fs/promises';
 import {
   GlobExcludeDefault,
   createMatcher,
   createAbsoluteFilePathMatcher,
+  glob,
 } from '../globUtils';
 
+describe('glob', () => {
+  async function createFiles(files: string[]): Promise<string> {
+    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'glob-test-'));
+    onTestFinished(() => fs.rm(dir, {recursive: true, force: true}));
+    for (const file of files) {
+      await fs.mkdir(path.dirname(path.join(dir, file)), {recursive: true});
+      await fs.writeFile(path.join(dir, file), '');
+    }
+    return dir;
+  }
+
+  it('sorts the files of folders read concurrently', async () => {
+    const sortedFiles = Array.from(
+      {length: 30},
+      (_, i) => `post-${String(i).padStart(2, '0')}/index.md`,
+    );
+    const dir = await createFiles(sortedFiles);
+    await expect(glob('**/*.md', {cwd: dir})).resolves.toEqual(sortedFiles);
+  });
+
+  it('sorts absolute file paths', async () => {
+    const dir = await createFiles(['b/a.md', 'b.md', 'a.md']);
+    const files = await glob('**/*.md', {cwd: dir, absolute: true});
+    expect(files.map((file) => path.relative(dir, file))).toEqual([
+      'a.md',
+      'b.md',
+      path.join('b', 'a.md'),
+    ]);
+  });
+});
+
 describe('createMatcher', () => {
   it('match default exclude MD/MDX partials correctly', () => {
     const matcher = createMatcher(GlobExcludeDefault);
```

**File**: `packages/docusaurus-glob/src/globUtils.ts` (modified, +5/-2)
```diff
@@ -20,13 +20,16 @@ export type GlobOptions = Pick<
   'cwd' | 'ignore' | 'absolute' | 'expandDirectories'
 >;
 
-/** Finds the files matching the given glob patterns. */
+/** Finds the files matching the given glob patterns, in a stable order. */
 export async function glob(
   patterns: string | string[],
   options?: GlobOptions,
 ): Promise<string[]> {
   // Other lib options are still forwarded at runtime for retro-compatibility
-  return Tinyglobby.glob(patterns, {...options});
+  const files = await Tinyglobby.glob(patterns, {...options});
+  // Tinyglobby reads folders concurrently: their files come in a random order
+  // See https://github.com/meta/docusaurus/pull/13031
+  return files.sort();
 }
 
 /**
```

**File**: `packages/docusaurus-plugin-content-pages/src/__tests__/__snapshots__/index.test.ts.snap` (modified, +29/-29)
```diff
@@ -2,16 +2,6 @@
 
 exports[`docusaurus-plugin-content-pages > loads simple pages 1`] = `
 [
-  {
-    "permalink": "/",
-    "source": "@site/src/pages/index.js",
-    "type": "jsx",
-  },
-  {
-    "permalink": "/typescript",
-    "source": "@site/src/pages/typescript.tsx",
-    "type": "jsx",
-  },
   {
     "description": "Markdown index page",
     "editUrl": undefined,
@@ -67,21 +57,21 @@ exports[`docusaurus-plugin-content-pages > loads simple pages 1`] = `
     "source": "@site/src/pages/hello/world.js",
     "type": "jsx",
   },
-]
-`;
-
-exports[`docusaurus-plugin-content-pages > loads simple pages with french translations (translate: false) 1`] = `
-[
   {
-    "permalink": "/fr/",
+    "permalink": "/",
     "source": "@site/src/pages/index.js",
     "type": "jsx",
   },
   {
-    "permalink": "/fr/typescript",
+    "permalink": "/typescript",
     "source": "@site/src/pages/typescript.tsx",
     "type": "jsx",
   },
+]
+`;
+
+exports[`docusaurus-plugin-content-pages > loads simple pages with french translations (translate: false) 1`] = `
+[
   {
     "description": "Markdown index page",
     "editUrl": undefined,
@@ -137,11 +127,6 @@ exports[`docusaurus-plugin-content-pages > loads simple pages with french transl
     "source": "@site/src/pages/hello/world.js",
     "type": "jsx",
   },
-]
-`;
-
-exports[`docusaurus-plugin-content-pages > loads simple pages with french translations 1`] = `
-[
   {
     "permalink": "/fr/",
     "source": "@site/src/pages/index.js",
@@ -152,6 +137,11 @@ exports[`docusaurus-plugin-content-pages > loads simple pages with french transl
     "source": "@site/src/pages/typescript.tsx",
     "type": "jsx",
   },
+]
+`;
+
+exports[`docusaurus-plugin-content-pages > loads simple pages with french translations 1`] = `
+[
   {
     "description": "Markdown index page",
     "editUrl": undefined,
@@ -207,21 +197,21 @@ exports[`docusaurus-plugin-content-pages > loads simple pages with french transl
     "source": "@site/src/pages/hello/world.js",
     "type": "jsx",
   },
-]
-`;
-
-exports[`docusaurus-plugin-content-pages > loads simple pages with last update 1`] = `
-[
   {
-    "permalink": "/",
+    "permalink": "/fr/",
     "source": "@site/src/pages/index.js",
     "type": "jsx",
   },
   {
-    "permalink": "/typescript",
+    "permalink": "/fr/typescript",
     "source": "@site/src/pages/typescript.tsx",
     "type": "jsx",
   },
+]
+`;
+
+exports[`docusaurus-plugin-content-pages > loads simple pages with last update 1`] = `
+[
   {
     "description": "Markdown index page",
     "editUrl": "url placeholder",
@@ -277,5 +267,15 @@ exports[`docusaurus-plugin-content-pages > loads simple pages with last update 1
     "source": "@site/src/pages/hello/world.js",
     "type": "jsx",
   },
+  {
+    "permalink": "/",
+    "source": "@site/src/pages/index.js",
+    "type": "jsx",
+  },
+  {
+    "permalink": "/typescript",
+    "source": "@site/src/pages/typescript.tsx",
+    "type": "jsx",
+  },
 ]
 `;
```

#### Recent Merged Pull Requests:
- **PR #13048** (2026-11-13): feat(core): check the Bun version at startup (@slorber)
- **PR #13047** (2026-11-13): chore(ci): remove the encodeurl@2.0.2 exclude from the site template trust policy (@slorber)
- **PR #13045** (2026-11-13): fix(glob): only expand the glob patterns of existing directories, like globby (@slorber)
- **PR #13044** (2026-11-13): feat: support the Bun runtime, starting with Bun 1.4.3 (@slorber)
- **PR #13043** (2026-11-13): fix(pwa): only use our own precache manifest injection when MD5 is not available (@slorber)
- **PR #13041** (2026-11-13): test: remove the sorts that compensated for the random glob order (@slorber)

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

## X. pwa): only use our own precache manifest injection when MD5 is not available

**RULE**:
When implementing operations in `packages/docusaurus-plugin-pwa/src/__tests__/injectManifestFIPS.test.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in meta/docusaurus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5b2eeddc`: pwa): only use our own precache manifest injection when MD5 is not available. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/docusaurus-plugin-pwa/src/__tests__/injectManifestFIPS.test.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
import {describe, expect, it, vi} from 'vitest';
import {injectManifestFIPS} from '../injectManifestFIPS';

// injectManifestFIPS() only runs when MD5 is not available
vi.mock('node:crypto', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:crypto')>()),
  getHashes: () => ['sha256'],
}));
describe('injectManifestFIPS', () => {
  it('injects the same files as Workbox', async () => {
    await injectManifestFIPS(getOptions(outDir.path));
    expect(manifest.map((entry) => entry.url)).toEqual(
      workboxManifest.map((entry) => entry.url),
    );
    // Workbox hashes with MD5 anyway
    manifest.forEach((entry, index) => {
      expect(entry.revision).not.toBe(workboxManifest[index]!.revision);
    });
  it('injects files hashed with SHA-256', async () => {
    await injectManifestFIPS(getOptions(outDir.path));
      {
        url: 'assets/main.css',
        revision:
          '7c98040a541657584690ae2a1cc3b42a8b53b159cc60c5d3abbfecbaeac6c94a',
      },
      {
        url: 'assets/main.js',
        revision:
          '6e11c72f7cf6bc383152dd16ddd5903aba6bb1c99d6b6639a4bb0b838185fa92',
      },
      {
        url: 'index.html',
        revision:
        
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
import {describe, expect, it} from 'vitest';
import {injectPrecacheManifest} from '../precacheManifest';
describe('injectPrecacheManifest', () => {
  it('injects the same manifest as Workbox', async () => {
    await injectPrecacheManifest(getOptions(outDir.path));
    expect(manifest).toEqual(workboxManifest);
  it('injects files hashed with MD5, except the service worker', async () => {
    await injectPrecacheManifest(getOptions(outDir.path));
      {url: 'assets/main.css', revision: 'aa676972bbd2b68e94ef8e91e81d20be'},
      {url: 'assets/main.js', revision: '238e96d5b62a1aec3739730469f27192'},
      {url: 'index.html', revision: 'fe919dfbe925337c176e602ebbf0d15c'},
    await injectPrecacheManifest({
    await injectPrecacheManifest({
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5b2eeddc` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
