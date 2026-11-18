# Verification Protocol: Verification Protocol: Empirical Defect Shield for eclipse-theia-theia-learnings

<!-- PROVENANCE_START
{
  "source_repository": "eclipse-theia-theia-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T11:33:25.675Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-eclipse-theia-theia-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [eclipse-theia-theia-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T11:33:25.675Z`  
> **Learning ID**: `LEARN-EVO-eclipse-theia-theia-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `eclipse-theia-theia-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/eclipse-theia-theia-learnings.md`  
> **Source**: github ([https://github.com/eclipse-theia/theia](https://github.com/eclipse-theia/theia))  
> **Source Version**: `210f8510`  
> **License**: EPL-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-18T11:33:08.576Z  
> **Learning ID**: `learn-github-eclipse-theia-theia`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): eclipse-theia/theia

> **Canonical Artifact**: `07_PROJECT_LEARNING/eclipse-theia-theia-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/eclipse-theia/theia](https://github.com/eclipse-theia/theia))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-18T11:33:08.437Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `eclipse-theia/theia`
- **Description**: Eclipse Theia is an open-source platform for building custom IDEs and tools for browser and desktop. It includes Theia AI, the vendor-neutral AI harness platform, and powers the AI-native Theia IDE.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 21767 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `dev-packages/private-eslint-plugin/util/package-json.js`
```
// *****************************************************************************
// Copyright (C) 2026 EclipseSource GmbH.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

// @ts-check

const fs = require('fs');
const path = require('path');

/**
 * @typedef FoundPackageJson
 * @property {string} __filename
 * @property {string} [name]
 * @property {{[package: string]: string}} [dependencies]
 */

/**
 * Thrown when a package.json exists but cannot be read or parsed.
 */
class MalformedPackageJsonError extends Error {
    /**
     * @param {string} packageJsonPath
     * @param {unknown} cause
     */
    constructor(packageJsonPath, cause) {
        super(`Cannot read "${packageJsonPath}": ${cause instanceof Error ? cause.message : String(cause)}`);
        this.packageJsonPath = packageJsonPath;
    }
}

/**
 * Cache the package.json of a given directory, as rules run for every linted file. A
 * `MalformedPackageJsonError` is cached as well so that a broken file is only read once. Entries
 * are validated against the modification time and size of the file, so that a long lived ESLint
 * process, such as the one behind an editor integration, picks up an edited or repaired
 * package.json. An edit which keeps the size and lands within the same millisecond is missed,
 * which is the same trade-off the ESLint file cache makes.
 * @type {Map<string, {mtimeMs: number, size: number, result: FoundPackageJson | MalformedPackageJsonError}>}
 */
const readPackageJsonCache = new Map();

/**
 * Reads the package.json located directly in `directory`, without looking at parent directories.
 * @param {string} directory
 * @returns {FoundPackageJson | undefined} undefined if there is no package.json in `directory`.
 * @throws {MalformedPackageJsonError} if there is one but it cannot be read or parsed.
 */
function readPackageJson(directory) {
    const resolved = path.resolve(directory);
    const packageJsonPath = path.resolve(resolved, 'package.json');
    const stat = fs.statSync(packageJsonPath, { throwIfNoEntry: false });
    if (!stat) {
        readPackageJsonCache.delete(resolved);
        return undefined;
    }
    const cached = readPackageJsonCache.get(resolved);
    if (cached && cached.mtimeMs === stat.mtimeMs && cached.size === stat.size) {
        if (cached.result instanceof MalformedPackageJsonError) {
            throw cached.result;
        }
        return cached.result;
    }
    /** @type {FoundPackageJson | MalformedPackageJsonError} */
    let result;
    try {
        result = JSON.parse(fs.readFileSync(packageJsonPath, { encoding: 'utf8' }));
        result['__filename'] = packageJsonPath;
    } catch (error) {
        result = new MalformedPackageJsonError(packageJsonPath, error);
    }
    readPackageJsonCache.set(resolved, { mtimeMs: stat.mtimeMs, size: stat.size, result });
    if (result instanceof MalformedPackageJsonError) {
        throw result;
    }
    return result;
}

/**
 * Keep a shortcut from a directory to the directory holding its closest package.json, based on
 * previous crawls. Only the location is cached, the content still goes through `readPackageJson`,
 * so that an edited package.json is picked up. A package.json created in between the two
 * directories after the crawl is missed.
 * @type {Map<string, string>}
 */
const findPackageJsonCache = new Map();

/**
 * Finds the closest package.json by walking up from `from`.
 * @param {string} from file or directory path to start searching from. A path that does not exist
 * is treated as a file path, e.g. the virtual file names a rule gets in unit tests.
 * @returns {FoundPackageJson | undefined}
 * @throws {MalformedPackageJsonError} if a package.json on the way up cannot be read or parsed.
 */
function findPackageJson(from) {
    const resolved = path.resolve(from);
    const stat = fs.statSync(resolved, { throwIfNoEntry: false });
    let current = stat && stat.isDirectory() ? resolved : path.dirname(resolved);
    // Keep track of all paths tried before eventually finding a package.json file
    const tried = [current];
    while (true) {
        const cachedDir = findPackageJsonCache.get(current);
        if (cachedDir) {
            const cached = readPackageJson(cachedDir);
            if (cached) {
                return cached;
            }
            // The package.json has been deleted in the meantime, so crawl again from here.
            findPackageJsonCache.delete(current);
        }
        const packageJson = readPackageJson(current);
        if (packageJson) {
            for (const dir of tried) {
                findPackageJsonCache.set(dir, current);
            }
            return packageJson;
        }
        const parent = path.dirname(current);
        if (parent === current) {
            return undefined;
        }
        current = parent;
        tried.push(current);
    }
}

/**
 * Derives the Theia package name for the given file from its closest package.json. Only packages
 * living directly in 'packages' or 'dev-packages' follow the logger naming convention, so anything
 * else (examples, the monorepo root) yields undefined. Resolving the package rather than matching
 * path segments also keeps files in a checkout below a directory which happens to be named
 * 'packages' from resolving against that outer directory. The package.json `name` (without npm
 * scope) wins over the directory name as the two can differ, e.g. 'ai-hugging-face' contains
 * '@theia/ai-huggingface'.
 * @param {string} filename
 * @returns {string | undefined}
 * @throws {MalformedPackageJsonError} if a package.json on the way up cannot be read or parsed.
 */
function derivePackageName(filename) {
    const packageJson = findPackageJson(filename);
    if (!packageJson) {
        return undefined;
    }
    const packageDir = path.dirname(packageJson.__filename);
    const root = path.basename(path.dirname(packageDir));
    if (root !== 'packages' && root !== 'dev-packages') {
        return undefined;
    }
    return typeof packageJson.name === 'string' ? packageJson.name.replace(/^@[^/]+\//, '') : path.basename(packageDir);
}

/**
 * Errors already reported, as the same broken file would otherwise be reported again for every
 * linted file of the package. Re-reading a changed package.json produces a new error instance, so
 * a file which is repaired and later broken again is reported again.
 * @type {WeakSet<MalformedPackageJsonError>}
 */
const reportedErrors = new WeakSet();

/**
 * Runs `lookup` and turns a malformed package.json into a problem on the file currently being
 * linted, rather than letting it escape as an exception, which would abort the whole ESLint run.
 * A given package.json is reported by the first rule that trips over it.
 * @template T
 * @param {import('eslint').Rule.RuleContext} context
 * @param {() => T} lookup
 * @returns {T | undefined} undefined if the package.json is malformed, so that the caller can skip.
 */
function reportingMalformedPackageJson(context, lookup) {
    try {
        return lookup();
    } catch (error) {
        if (!(error instanceof MalformedPackageJsonError)) {
            throw error;
        }
        if (!reportedErrors.has(error)) {
            reportedErrors.add(error);
            context.report({ loc: { line: 0, column: 0 }, message: error.message });
        }
        return undefined;
    }
}

module.exports = { findPackageJson, derivePackageName, reportingMalformedPackageJson, MalformedPackageJsonError };

```

### Core Architecture Module: `dev-packages/private-eslint-plugin/util/preload-graph.js`
```
// *****************************************************************************
// Copyright (C) 2026 STMicroelectronics and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

// @ts-check

const fs = require('fs');
const path = require('path');

// The plugin is private to the monorepo, so it uses the parser hoisted at the root, the same way
// 'localization-check' uses the metadata of '@theia/core'.
// eslint-disable-next-line import/no-extraneous-dependencies
const parser = require('@typescript-eslint/parser');

const { findPackageJson } = require('./package-json');

/**
 * @typedef {import('estree').Node} Node
 * @typedef {import('eslint').Scope.ScopeManager} ScopeManager
 */

/**
 * An import that survives compilation, i.e. one that makes the imported module be evaluated.
 * @typedef ModuleImport
 * @property {string} specifier the module specifier as written in the source.
 * @property {Node} node the node carrying the specifier, for reporting.
 */

/**
 * A call of the NLS API that runs while the module is being evaluated.
 * @typedef NlsCall
 * @property {string} callee the called function, e.g. `nls.localizeByDefault`.
 * @property {Node} node the call expression, for reporting.
 */

/**
 * @typedef SourceAnalysis
 * @property {ModuleImport[]} imports
 * @property {NlsCall[]} nlsCalls
 */

/**
 * The file extensions of sources we follow, in resolution order. Declaration files are left out
 * because they carry no runtime code.
 */
const sourceExtensions = ['.ts', '.tsx', '.js', '.jsx'];

/**
 * The functions that read the localization data. `Command.toLocalizedCommand` and
 * `Command.toDefaultLocalizedCommand` are included because they delegate to `nls`.
 * @param {Node} callee
 * @returns {string | undefined} the name to report, or undefined if this is not an NLS call.
 */
function nlsCalleeName(callee) {
    if (callee.type !== 'MemberExpression' || callee.computed || callee.object.type !== 'Identifier' || callee.property.type !== 'Identifier') {
        return undefined;
    }
    const object = callee.object.name;
    const property = callee.property.name;
    if (object === 'nls' && property.startsWith('localize')) {
        return `${object}.${property}`;
    }
    if (object === 'Command' && (property === 'toLocalizedCommand' || property === 'toDefaultLocalizedCommand')) {
        return `${object}.${property}`;
    }
    return undefined;
}

/**
 * The child nodes of a node, each with the property it is reached through.
 * @param {Node} node
 * @returns {Array<[string, Node]>}
 */
function childNodes(node) {
    /** @type {Array<[string, Node]>} */
    const result = [];
    for (const [key, value] of Object.entries(node)) {
        // 'parent' points back up the tree and would make a traversal loop.
        if (key === 'parent' || !value || typeof value !== 'object') {
            continue;
        }
        for (const child of Array.isArray(value) ? value : [value]) {
            if (child && typeof child.type === 'string') {
                result.push([key, child]);
            }
        }
    }
    return result;
}

/**
 * Visits every node of the given tree. Own traversal rather than the one of ESLint, so that the
 * same analysis can run on the file being linted and on the files it pulls in.
 * @param {Node} node
 * @param {(node: Node) => void} visit
 */
function forEachNode(node, visit) {
    visit(node);
    for (const [, child] of childNodes(node)) {
        forEachNode(child, visit);
    }
}

/**
 * Walks the AST, tracking whether the visited node is evaluated while the module is loaded.
 * @param {Node} node
 * @param {boolean} moduleLevel whether `node` is evaluated while the module is loaded.
 * @param {(node: Node, moduleLevel: boolean) => void} visit
 */
function walk(node, moduleLevel, visit) {
    visit(node, moduleLevel);
    for (const [key, child] of childNodes(node)) {
        walk(child, childIsModuleLevel(node, key, moduleLevel), visit);
    }
}

/**
 * Whether the child reached through `key` of `node` still runs while the module is loaded.
 * @param {Node} node
 * @param {string} key the property of `node` the child is reached through.
 * @param {boolean} moduleLevel whether `node` itself is evaluated while the module is loaded.
 * @returns {boolean}
 */
function childIsModuleLevel(node, key, moduleLevel) {
    if (!moduleLevel) {
        return false;
    }
    switch (node.type) {
        case 'FunctionDeclaration':
        case 'FunctionExpression':
        case 'ArrowFunctionExpression':
            // Everything in a function, including the default values of its parameters, is only
            // evaluated once the function is called.
            return false;
        case 'PropertyDefinition':
        case 'TSAbstractPropertyDefinition':
            // The initializer of an instance field runs on construction, while its decorators and
            // its computed key are evaluated when the class is defined.
            return key !== 'value' || Boolean(node['static']);
        case 'TSModuleDeclaration':
            // A namespace body is evaluated with the module, unless it is merely declared.
            return !node['declare'];
        default:
            return true;
    }
}

/**
 * Whether the given import or export declaration makes the referenced module be evaluated. Type-only
 * declarations, and named imports whose bindings are never used as a value, are erased by the
 * compiler and therefore pull in nothing at runtime.
 * @param {Node} node an import or export declaration with a source.
 * @param {ScopeManager} scopeManager
 * @param {Set<Node>} metadataTypes the identifiers of the types that 'emitDecoratorMetadata' turns
 * into values, see `collectMetadataTypes`.
 * @returns {boolean}
 */
function isRuntimeImport(node, scopeManager, metadataTypes) {
    if (node['importKind'] === 'type' || node['exportKind'] === 'type') {
        return false;
    }
    if (node.type !== 'ImportDeclaration') {
        // A re-export has no local binding to look at. `export * from` and `export { x } from` are
        // assumed to carry values, which is the safe assumption for the barrel files this looks for.
        return true;
    }
    if (node.specifiers.length === 0) {
        // A bare `import './x'` is only there for its side effects, so it is never erased.
        return true;
    }
    return scopeManager.getDeclaredVariables(node).some(variable => variable.references.some(reference =>
        // A parser without type-aware scope information reports no 'isValueReference' at all, in
        // which case every reference has to count.
        reference['isValueReference'] !== false || metadataTypes.has(reference.identifier)));
}

/**
 * @param {Node} node
 * @returns {boolean} whether the given declaration carries a decorator.
 */
function isDecorated(node) {
    return node['decorators']?.length > 0;
}

/**
 * Collects the identifiers of the types that 'emitDecoratorMetadata', which the whole repository is
 * compiled with, turns into values: the type of a decorated property, and the parameter and return
 * types of a decorated member and of the constructor of a decorated class, are emitted into the
 * 'design:type', 'design:paramtypes' and 'design:returntype' metadata, so the modules declaring them
 * are required at runtime after all.
 *
 * A type that erases to `Object`, an interface for instance, is emitted as `Object` rather than as a
 * reference, and its import is erased if that is all the import is used for. Telling the two apart
 * needs the types, which this analysis does not have, so such an import is followed as well. The
 * remedy for what may then be reported, importing the symbol from the module declaring it rather
 * than through a barrel, is the right thing either way.
 * @param {Node} node a class or a member of one.
 * @param {Set<Node>} metadataTypes the set to collect into.
 */
function collectMetadataTypes(node, metadataTypes) {
    /** @type {Node[]} */
    const annotations = [];
    switch (node.type) {
        case 'PropertyDefinition':
        case 'TSAbstractPropertyDefinition':
            if (isDecorated(node)) {
                annotations.push(node['typeAnnotation']);
            }
            break;
        case 'MethodDefinition':
        case 'TSAbstractMethodDefinition': {
            const method = node['value'];
            if (isDecorated(node) || method?.params?.some(isDecorated)) {
                annotations.push(...method?.params ?? [], method?.returnType);
            }
            break;
        }
        case 'ClassDeclaration':
        case 'ClassExpression':
            if (isDecorated(node)) {
                // The parameters of the constructor are the 'design:paramtypes' of the class itself.
                const constructor = node['body']?.body?.find(member => member.type === 'MethodDefinition' && member.kind === 'constructor');
                annotations.push(...constructor?.value?.params ?? []);
            }
            break;
    }
    for (const annotation of annotations) {
        // A parameter is taken whole, because its own type annotation is the only type in it, while
        // its decorators are visited by the walk itself and carry values rather than types.
        if (annotation) {
            forEachNode(annotation, child => {
             
```

### Core Architecture Module: `dev-packages/private-re-exports/src/utility.ts`
```
// *****************************************************************************
// Copyright (C) 2021 Ericsson and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

export interface PackageJson {
    name: string
    dependencies?: Record<string, string>
    peerDependencies?: Record<string, string>
    optionalDependencies?: Record<string, string>
    theiaReExports?: Record<string, ReExportJson>
}

/**
 * Raw re-export declaration as written in `package.json#theiaReExports[<destination>]`.
 */
export interface ReExportJson {
    'export *'?: string[]
    'export ='?: string[]
    copy?: string
}

/**
 * Examples:
 * - `a` => `['a']`
 * - `a/b/c/...` => `['a', 'b/c/...']`
 * - `@a/b` => `['@a/b']`
 * - `@a/b/c/...` => `['@a/b', 'c/...']`
 */
export function parseModule(moduleName: string): [string, string?] {
    const slice = moduleName.startsWith('@') ? 2 : 1;
    const split = moduleName.split('/').filter(part => part.trim().length > 0);
    if (split.length < slice) {
        throw new Error(`Unexpected module name/format: ${JSON.stringify(moduleName)}`);
    }
    const packageName = split.slice(0, slice).join('/');
    if (split.length === slice) {
        return [packageName];
    } else {
        const subModuleName = split.slice(slice).join('/');
        return [packageName, subModuleName];
    }
}

```

### Core Architecture Module: `examples/playwright/src/util.ts`
```
// *****************************************************************************
// Copyright (C) 2021 logi.cals GmbH, EclipseSource and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { ElementHandle } from '@playwright/test';
import { tmpdir, platform } from 'os';
import { sep } from 'path';

export const USER_KEY_TYPING_DELAY = 80;

export function normalizeId(nodeId: string): string {
    // Special characters (i.e. in our case '.',':','/','%', '\\' and '~') in CSS IDs have to be escaped
    return nodeId.replace(/[.:,%/\\~]/g, matchedChar => '\\' + matchedChar);
}

export function escapeDoubleQuotes(nodeId: string): string {
    return nodeId.replace(/["\\]/g, matchedChar => '\\' + matchedChar);
}

export async function toTextContentArray(items: ElementHandle<SVGElement | HTMLElement>[]): Promise<string[]> {
    const contents = items.map(item => item.textContent());
    const resolvedContents = await Promise.all(contents);
    return resolvedContents.filter(text => text !== undefined) as string[];
}

export function isDefined(content: string | undefined): content is string {
    return content !== undefined;
}

export function isNotNull(content: string | null): content is string {
    return content !== null;
}

export async function textContent(elementPromise: Promise<ElementHandle<SVGElement | HTMLElement> | null>): Promise<string | undefined> {
    const element = await elementPromise;
    if (!element) {
        return undefined;
    }
    const content = await element.textContent();
    return content ? content : undefined;
}

export async function containsClass(elementPromise: Promise<ElementHandle<SVGElement | HTMLElement> | null> | undefined, cssClass: string): Promise<boolean> {
    return elementContainsClass(await elementPromise, cssClass);
}

export async function elementContainsClass(element: ElementHandle<SVGElement | HTMLElement> | null | undefined, cssClass: string): Promise<boolean> {
    if (element) {
        const classValue = await element.getAttribute('class');
        if (classValue) {
            return classValue?.split(' ').includes(cssClass);
        }
    }
    return false;
}

export async function isElementVisible(elementPromise: Promise<ElementHandle<SVGElement | HTMLElement> | null>): Promise<boolean> {
    const element = await elementPromise;
    return element ? element.isVisible() : false;
}

export async function elementId(element: ElementHandle<SVGElement | HTMLElement>): Promise<string> {
    const id = await element.getAttribute('id');
    if (id === null) { throw new Error('Could not get ID of ' + element); }
    return id;
}

export namespace OSUtil {
    export const isWindows = platform() === 'win32';
    export const isMacOS = platform() === 'darwin';
    // The platform-specific file separator '\' or '/'.
    export const fileSeparator = sep;
    // The platform-specific location of the temporary directory.
    export const tmpDir = tmpdir();
}

```

### Core Architecture Module: `packages/ai-chat-ui/src/browser/chat-date-utils.ts`
```
// *****************************************************************************
// Copyright (C) 2025 EclipseSource GmbH.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { nls } from '@theia/core';

/**
 * The relative time units supported by `formatTimeAgo` with their approximate
 * lengths in milliseconds, from largest to smallest. The first unit that fits
 * into the elapsed time is used.
 */
const RELATIVE_TIME_UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31_557_600_000], // 365.25 days
    ['month', 2_629_800_000], // 30.44 days
    ['week', 604_800_000],
    ['day', 86_400_000],
    ['hour', 3_600_000],
    ['minute', 60_000],
    ['second', 1_000]
];

let cachedRelativeTimeFormat: { locale: string | undefined; format: Intl.RelativeTimeFormat } | undefined;

/**
 * Returns a cached `Intl.RelativeTimeFormat` for the current Theia locale,
 * falling back to English if the locale is not supported.
 */
function getRelativeTimeFormat(): Intl.RelativeTimeFormat {
    // Theia locale ids may use '_' as region separator while `Intl` expects BCP-47 ('-').
    const locale = nls.locale?.replace('_', '-');
    if (cachedRelativeTimeFormat === undefined || cachedRelativeTimeFormat.locale !== locale) {
        try {
            cachedRelativeTimeFormat = { locale, format: new Intl.RelativeTimeFormat(locale, { numeric: 'always' }) };
        } catch {
            cachedRelativeTimeFormat = { locale, format: new Intl.RelativeTimeFormat('en', { numeric: 'always' }) };
        }
    }
    return cachedRelativeTimeFormat.format;
}

/**
 * Formats a timestamp as a human-readable relative time string (e.g., "2 hours ago").
 *
 * The largest unit that fits into the elapsed time is used and the value is rounded
 * down so that it never crosses into the next larger unit. Timestamps less than a
 * second away render as "0 seconds ago", future ones as "in ...".
 * @param timestamp - The timestamp in milliseconds
 */
export function formatTimeAgo(timestamp: number): string {
    if (typeof Intl === 'undefined' || typeof Intl.RelativeTimeFormat === 'undefined') {
        // Environments without `Intl.RelativeTimeFormat` get an absolute date instead.
        return new Date(timestamp).toLocaleString();
    }
    const elapsed = Date.now() - timestamp;
    const direction = elapsed >= 0 ? -1 : 1; // `Intl` expects negative values for the past
    const duration = Math.abs(elapsed);
    for (const [unit, unitLength] of RELATIVE_TIME_UNITS) {
        if (duration >= unitLength) {
            return getRelativeTimeFormat().format(direction * Math.floor(duration / unitLength), unit);
        }
    }
    return getRelativeTimeFormat().format(-0, 'second');
}

```

### Core Architecture Module: `packages/ai-chat-ui/src/browser/chat-input-scroll-util.ts`
```
// *****************************************************************************
// Copyright (C) 2026 Safi Seid-Ahmad, K2view and others.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

/**
 * Computes how far a scroll container must scroll so that the vertical range `[rowTop, rowBottom]`,
 * given in pixels relative to the top edge of the container's visible area, becomes fully visible.
 * Negative values scroll up, positive values scroll down, `0` means the range is already visible.
 */
export function computeRevealScrollDelta(rowTop: number, rowBottom: number, viewportHeight: number): number {
    if (rowTop < 0) {
        return rowTop;
    }
    if (rowBottom > viewportHeight) {
        return rowBottom - viewportHeight;
    }
    return 0;
}

```

### Core Architecture Module: `packages/ai-chat-ui/src/browser/chat-response-part-renderer.ts`
```
// *****************************************************************************
// Copyright (C) 2024 EclipseSource GmbH.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { ChatResponseContent } from '@theia/ai-chat/lib/common';
import { ReactNode } from '@theia/core/shared/react';
import { ResponseNode } from './chat-tree-view/chat-view-tree-widget.js';

export const ChatResponsePartRenderer = Symbol('ChatResponsePartRenderer');
export interface ChatResponsePartRenderer<T extends ChatResponseContent> {
    canHandle(response: ChatResponseContent): number;
    render(response: T, parentNode: ResponseNode): ReactNode;
    /**
     * Optional method to render a compact confirmation/interaction view for this content type.
     * Used by the delegation summary to show tool-specific confirmation UI in collapsed state.
     * If not implemented, a generic fallback confirmation UI is used.
     */
    renderConfirmation?(response: T, parentNode: ResponseNode): ReactNode;
}

```

### Core Architecture Module: `packages/ai-chat-ui/src/browser/chat-response-renderer/ai-selection-resolver.ts`
```
// *****************************************************************************
// Copyright (C) 2024 EclipseSource GmbH.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { CancellationToken, RecursivePartial, URI } from '@theia/core';
import { inject, injectable } from '@theia/core/shared/inversify';
import { EditorOpenerOptions, EditorWidget, Range } from '@theia/editor/lib/browser';

import { EditorSelectionResolver } from '@theia/editor/lib/browser/editor-manager';
import { DocumentSymbol } from '@theia/monaco-editor-core/esm/vs/editor/common/languages.js';
import { TextModel } from '@theia/monaco-editor-core/esm/vs/editor/common/model/textModel.js';
import { ILanguageFeaturesService } from '@theia/monaco-editor-core/esm/vs/editor/common/services/languageFeatures.js';
import { StandaloneServices } from '@theia/monaco-editor-core/esm/vs/editor/standalone/browser/standaloneServices.js';
import { MonacoEditor } from '@theia/monaco/lib/browser/monaco-editor';
import { MonacoToProtocolConverter } from '@theia/monaco/lib/browser/monaco-to-protocol-converter';

/** Regex to match GitHub-style position and range declaration with line (L) and column (C) */
export const LOCATION_REGEX = /#L(\d+)?(?:C(\d+))?(?:-L(\d+)?(?:C(\d+))?)?$/;

@injectable()
export class GitHubSelectionResolver implements EditorSelectionResolver {
    priority = 100;

    async resolveSelection(widget: EditorWidget, options: EditorOpenerOptions, uri?: URI): Promise<RecursivePartial<Range> | undefined> {
        if (!uri) {
            return;
        }
        // We allow the GitHub syntax of selecting a range in markdown 'L1', 'L1-L2' 'L1-C1_L2-C2' (starting at line 1 and column 1)
        const match = uri?.toString().match(LOCATION_REGEX);
        if (!match) {
            return;
        }
        // we need to adapt the position information from one-based (in GitHub) to zero-based (in Theia)
        const startLine = match[1] ? parseInt(match[1], 10) - 1 : undefined;
        // if no start column is given, we assume the start of the line
        const startColumn = match[2] ? parseInt(match[2], 10) - 1 : 0;
        const endLine = match[3] ? parseInt(match[3], 10) - 1 : undefined;
        // if no end column is given, we assume the end of the line
        const endColumn = match[4] ? parseInt(match[4], 10) - 1 : endLine ? widget.editor.document.getLineMaxColumn(endLine) : undefined;

        return {
            start: { line: startLine, character: startColumn },
            end: { line: endLine, character: endColumn }
        };
    }
}

@injectable()
export class TypeDocSymbolSelectionResolver implements EditorSelectionResolver {
    priority = 50;

    @inject(MonacoToProtocolConverter) protected readonly m2p: MonacoToProtocolConverter;

    async resolveSelection(widget: EditorWidget, options: EditorOpenerOptions, uri?: URI): Promise<RecursivePartial<Range> | undefined> {
        if (!uri) {
            return;
        }
        const editor = MonacoEditor.get(widget);
        const monacoEditor = editor?.getControl();
        if (!monacoEditor) {
            return;
        }
        const symbolPath = this.findSymbolPath(uri);
        if (!symbolPath) {
            return;
        }
        const textModel = monacoEditor.getModel() as unknown as TextModel;
        if (!textModel) {
            return;
        }

        // try to find the symbol through the document symbol provider
        // support referencing nested symbols by separating a dot path similar to TypeDoc
        for (const provider of StandaloneServices.get(ILanguageFeaturesService).documentSymbolProvider.ordered(textModel)) {
            const symbols = await provider.provideDocumentSymbols(textModel, CancellationToken.None);
            const match = this.findSymbolByPath(symbols ?? [], symbolPath);
            if (match) {
                return this.m2p.asRange(match.selectionRange);
            }
        }
    }

    protected findSymbolPath(uri: URI): string[] | undefined {
        return uri.fragment.split('.');
    }

    protected findSymbolByPath(symbols: DocumentSymbol[], symbolPath: string[]): DocumentSymbol | undefined {
        if (!symbols || symbolPath.length === 0) {
            return undefined;
        }
        let matchedSymbol: DocumentSymbol | undefined = undefined;
        let currentSymbols = symbols;
        for (const part of symbolPath) {
            matchedSymbol = currentSymbols.find(symbol => symbol.name === part);
            if (!matchedSymbol) {
                return undefined;
            }
            currentSymbols = matchedSymbol.children || [];
        }
        return matchedSymbol;
    }
}

@injectable()
export class TextFragmentSelectionResolver implements EditorSelectionResolver {
    async resolveSelection(widget: EditorWidget, options: EditorOpenerOptions, uri?: URI): Promise<RecursivePartial<Range> | undefined> {
        if (!uri) {
            return;
        }
        const fragment = this.findFragment(uri);
        if (!fragment) {
            return;
        }
        const matches = widget.editor.document.findMatches?.({ isRegex: false, matchCase: false, matchWholeWord: false, searchString: fragment }) ?? [];
        if (matches.length > 0) {
            return {
                start: {
                    line: matches[0].range.start.line - 1,
                    character: matches[0].range.start.character - 1
                },
                end: {
                    line: matches[0].range.end.line - 1,
                    character: matches[0].range.end.character - 1
                }
            };
        }
    }

    protected findFragment(uri: URI): string | undefined {
        return uri.fragment;
    }
}

```

### Core Architecture Module: `packages/ai-chat-ui/src/browser/chat-response-renderer/block-external-resources.ts`
```
// *****************************************************************************
// Copyright (C) 2026 EclipseSource GmbH.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { nls } from '@theia/core/lib/common/nls';
import { renderBlockedResourcePlaceholder } from './blocked-resource-placeholder.js';

export const BLOCKED_RESOURCE_CLASS = 'theia-blocked-resource';
export const BLOCKED_RESOURCE_ALLOW_CLASS = 'theia-blocked-resource-allow';
export const BLOCKED_RESOURCE_WRAPPER_CLASS = 'theia-blocked-resource-wrapper';

const SAFE_SCHEMES = new Set(['data:']);
const RESOURCE_SELECTORS = '*';
const EMBEDDED_CONTENT_SELECTORS = 'iframe, frame, object, embed';
const RESOURCE_URL_ATTRIBUTES = ['src', 'poster', 'href', 'xlink:href', 'data', 'background'];
const URL_FUNCTION_ATTRIBUTES = ['fill', 'stroke', 'filter', 'clip-path', 'mask', 'marker-start', 'marker-mid', 'marker-end'];
const INLINE_EXTERNAL_CONTENT_LABEL = nls.localize('theia/ai-chat-ui/blockedResource/inlineContent', '(inline external content)');
const URL_PATTERN = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)/gi;
const IMAGE_SET_PATTERN = /(?:-webkit-)?image-set\(([^)]*)\)/gi;
const IMAGE_SET_URL_PATTERN = /"([^"]*)"|'([^']*)'|(?:^|,)\s*([^,\s)]+)/gi;
const CSS_IMPORT_PATTERN = /@import\s+(?:"([^"]*)"|'([^']*)')/gi;
const CSS_COMMENT_PATTERN = /\/\*[\s\S]*?\*\//g;
const CSS_HEX_ESCAPE_PATTERN = /\\([0-9a-fA-F]{1,6})[\t\n\f\r ]?/g;
const CSS_CHARACTER_ESCAPE_PATTERN = /\\([\s\S])/g;
const CSS_DATA_URL_PATTERN = /^data:text\/css([^,]*),([\s\S]*)$/i;
const MAX_CODE_POINT = 0x10FFFF;
const blockedResources = new WeakMap<HTMLElement, Element>();

let allowedResourceUrls: readonly string[] = [];

/**
 * Configures URL prefixes whose external resources may be rendered without being blocked.
 * A resource is allowed when its URL starts with one of the configured prefixes, so entries
 * should include the full origin (e.g. `https://example.com/`) to avoid unintended matches.
 */
export function setAllowedResourceUrls(urls: readonly string[]): void {
    allowedResourceUrls = urls.map(url => url.trim()).filter(url => !!url);
}

function isAllowlistedUrl(url: string): boolean {
    return allowedResourceUrls.some(prefix => url.startsWith(prefix));
}

function isSafeUrl(rawUrl: string): boolean {
    const url = stripQuotes(rawUrl.trim());
    if (!url) {
        return true;
    }
    if (url.startsWith('#')) {
        return true;
    }
    const lowerCaseUrl = url.toLowerCase();
    for (const scheme of SAFE_SCHEMES) {
        if (lowerCaseUrl.startsWith(scheme)) {
            // A `data:` URL is inert on its own, but a `data:text/css` payload can itself reference
            // external resources, so decode and inspect such stylesheets instead of trusting them.
            // This inspection runs before the allowlist so that allowlisting a `data:` prefix cannot
            // disable it.
            return scheme === 'data:' ? isSafeDataUrl(url) : true;
        }
    }
    if (isAllowlistedUrl(url)) {
        return true;
    }
    return false;
}

function isSafeDataUrl(url: string): boolean {
    const match = CSS_DATA_URL_PATTERN.exec(url);
    if (!match) {
        // Any non-CSS `data:` URL is inert on its own.
        return true;
    }
    const css = decodeCssPayload(match[1], match[2]);
    if (css === undefined) {
        // Fail closed: if the payload cannot be decoded, the browser may still resolve the valid
        // escape sequences and load external resources, so treat the stylesheet as unsafe.
        return false;
    }
    return !extractCssUrls(css).some(nested => !isSafeUrl(nested));
}

function decodeCssPayload(parameters: string, payload: string): string | undefined {
    try {
        return /;\s*base64/i.test(parameters) ? atob(payload) : decodeURIComponent(payload);
    } catch {
        return undefined;
    }
}

/**
 * Neutralizes resources that would otherwise load or execute automatically.
 *
 * Active embedded content (`iframe`, `frame`, `object`, `embed`) is always blocked because it can
 * run active content with the IDE's origin, which is unsafe even for trusted, user-authored Markdown.
 * External URL resources (images, stylesheets, SVG references, ...) are only blocked when
 * {@link blockExternalUrls} is `true`; trusted content passes `false` to render them directly.
 */
export function blockExternalResources(root: ParentNode & { ownerDocument: Document }, blockExternalUrls: boolean = true): void {
    for (const element of Array.from(root.querySelectorAll(EMBEDDED_CONTENT_SELECTORS))) {
        element.replaceWith(buildPlaceholder(root.ownerDocument, element));
    }

    if (!blockExternalUrls) {
        return;
    }

    for (const element of Array.from(root.querySelectorAll(RESOURCE_SELECTORS))) {
        if (elementHasExternalReference(element)) {
            element.replaceWith(buildPlaceholder(root.ownerDocument, element));
        }
    }

    for (const element of Array.from(root.querySelectorAll('[style]'))) {
        const unsafeStyleUrls = extractUnsafeStyleUrls(element);
        if (unsafeStyleUrls.length) {
            const wrapper = root.ownerDocument.createElement('span');
            wrapper.classList.add(BLOCKED_RESOURCE_WRAPPER_CLASS);
            wrapper.appendChild(buildPlaceholder(root.ownerDocument, element));

            const safeClone = element.cloneNode(true) as HTMLElement;
            removeUnsafeStyleDeclarations(safeClone);
            blockExternalResources(safeClone);
            wrapper.appendChild(safeClone);
            element.replaceWith(wrapper);
        }
    }
}

function buildPlaceholder(doc: Document, original: Element): HTMLElement {
    const resources = collectExternalResourceUrls(original);
    const placeholder = doc.createElement('span');
    placeholder.classList.add(BLOCKED_RESOURCE_CLASS);
    placeholder.setAttribute('role', 'group');
    placeholder.setAttribute('aria-label', nls.localize(
        'theia/ai-chat-ui/blockedResource/aria',
        'Blocked external resources: {0}',
        resources.join(', ')
    ));
    placeholder.dataset.blockedTag = original.tagName.toLowerCase();
    blockedResources.set(placeholder, sandboxEmbeddedContent(original.cloneNode(true) as Element));

    placeholder.innerHTML = renderBlockedResourcePlaceholder(resources);

    return placeholder;
}

export function restoreBlockedResource(placeholder: Element): Element | undefined {
    if (!(placeholder instanceof HTMLElement)) {
        return undefined;
    }
    const original = blockedResources.get(placeholder);
    blockedResources.delete(placeholder);
    return original?.cloneNode(true) as Element | undefined;
}

function sandboxEmbeddedContent(element: Element): Element {
    // Restored iframes may carry attacker-controlled `srcdoc` content which would otherwise run
    // with the origin of the IDE. Force full sandboxing so allowed content stays inert.
    for (const embedded of [element, ...Array.from(element.querySelectorAll('iframe, frame'))]) {
        const tagName = embedded.tagName.toUpperCase();
        if (tagName === 'IFRAME' || tagName === 'FRAME') {
            embedded.setAttribute('sandbox', '');
        }
    }
    return element;
}

function isAnchor(element: Element): boolean {
    // SVG elements keep their lower-case tag names, so normalize before comparing
    return element.tagName.toUpperCase() === 'A';
}

function elementHasExternalReference(element: Element): boolean {
    if (isAnchor(element)) {
        return false;
    }
    for (const attributeName of RESOURCE_URL_ATTRIBUTES) {
        const value = element.getAttribute(attributeName);
        if (value && !isSafeUrl(value)) {
            return true;
        }
    }

    const srcset = element.getAttribute('srcset');
    if (srcset && srcsetHasExternalReference(srcset)) {
        return true;
    }

    if (extractUnsafeStyleSheetUrls(element).length || extractUnsafeUrlFunctionAttributeUrls(element).length) {
        return true;
    }

    return false;
}

function collectExternalResourceUrls(element: Element): string[] {
    const urls = new Set<string>();
    for (const candidate of [element, ...Array.from(element.querySelectorAll('*'))]) {
        collectElementExternalResourceUrls(candidate, urls);
    }
    if (!urls.size) {
        urls.add(INLINE_EXTERNAL_CONTENT_LABEL);
    }
    return Array.from(urls);
}

function collectElementExternalResourceUrls(element: Element, urls: Set<string>): void {
    if (!isAnchor(element)) {
        for (const attributeName of RESOURCE_URL_ATTRIBUTES) {
            const value = element.getAttribute(attributeName);
            if (value && !isSafeUrl(value)) {
                urls.add(value);
            }
        }
    }

    const srcset = element.getAttribute('srcset');
    if (srcset) {
        for (const url of extractSrcsetUrls(srcset).filter(candidate => !isSafeUrl(candidate))) {
            urls.add(url);
        }
    }

    for (const url of extractUnsafeStyleUrls(element)) {
        urls.add(url);
    }

    for (const url of extractUnsafeStyleSheetUrls(element)) {
        urls.add(url);
    }

    for (const url of extractUnsafeUrlFunctionAttributeUrls(element)) {
        urls.add(url);
    }

    if ((element.tagName === 'IFRAME' || element.tagName === 'FRAME') && element.hasAttribute('srcdoc'
```

### Core Architecture Module: `packages/ai-chat-ui/src/browser/chat-response-renderer/blocked-resource-placeholder.tsx`
```
// *****************************************************************************
// Copyright (C) 2026 EclipseSource GmbH.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import * as React from '@theia/core/shared/react';
import { renderToStaticMarkup } from '@theia/core/shared/react-dom/server';
import { nls } from '@theia/core/lib/common/nls';

export interface BlockedResourcePlaceholderProps {
    resources: string[];
}

export const BlockedResourcePlaceholder = ({ resources }: BlockedResourcePlaceholderProps): React.ReactNode => {
    const firstResource = resources[0] ?? nls.localize('theia/ai-chat-ui/blockedResource/inlineContent', '(inline external content)');
    return <>
        <span className='theia-blocked-resource-icon codicon codicon-shield'></span>
        <span className='theia-blocked-resource-label'>
            {nls.localize('theia/ai-chat-ui/blockedResource/label', 'External resource blocked:')}{' '}
            <span className='theia-blocked-resource-url' title={firstResource}>{firstResource}</span>
        </span>
        {resources.length > 1 && <details className='theia-blocked-resource-details'>
            <summary>{nls.localize('theia/ai-chat-ui/blockedResource/resourcesToAllow', '{0} resources will be enabled', resources.length)}</summary>
            <ul>
                {resources.map(resource => <li key={resource} title={resource}>{resource}</li>)}
            </ul>
        </details>}
        <button type='button' className='theia-blocked-resource-allow'>{nls.localize('theia/ai-chat-ui/blockedResource/allow', 'Allow this blocked content')}</button>
    </>;
};

export const renderBlockedResourcePlaceholder = (resources: string[]): string => renderToStaticMarkup(<BlockedResourcePlaceholder resources={resources} />);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #18390** (2026-11-18): **Source Control view aggressively grabs focus on Git status changes**
  *Symptoms*: <!-- Please provide a detailed description of the bug. --> <!-- Note: This template is not meant for security vulnerabilities disclosure --> <!-- Any such issue, created in this repo, will be deleted on sight --> <!-- Instead please report vulnerabilities to the Eclipse Foundation's security team --> <!-- For more details, please read SECURITY.md in the repository root --> ### Bug Description:  When the git staging files change, the Source Control view automatically grabs focus. This is especially annoying when working with Git from the Theia CLI, as the focus might change to a different view while you're typing  <!-- Please provide clear steps to reproduce the bug. --> ### Steps to Reproduce:  1. Open the Source Control view + Theia Terminal 2. Make some changes in a git repo 3. In Theia CLI: git add . (Or any similar Git command that will affect the staged files) 4. In Theia CLI: git commit -m "test commit" (Or anything else)  The Source Control view will grab the focus somewhere between step 3 and step 4, preventing the user from typing the second command (until they manually switch the focus back to the terminal)  <!-- Please provide any additional information available. --> <!-- Additional information can be in the form of logs, screenshots, screencasts. -->  ### Additional Information  - Operating System: Linux - Theia Version: 1.77.0  <!-- 💙 Eclipse Theia is community-supported. If you find it valuable, consider sponsoring the project: https://theia-ide.org/support/ -

- **Issue #18369** (2026-11-13): **Chat sessions are no longer saved after the RPC connection recovers**
  *Symptoms*: <!-- Please provide a detailed description of the bug. --> <!-- Note: This template is not meant for security vulnerabilities disclosure --> <!-- Any such issue, created in this repo, will be deleted on sight --> <!-- Instead please report vulnerabilities to the Eclipse Foundation's security team --> <!-- For more details, please read SECURITY.md in the repository root --> ### Bug Description:  After the RPC connection between frontend and backend breaks and recovers, chat sessions are no longer persisted until the frontend is reloaded.  `ChatSessionStoreImpl` serializes all of its writes (`storeSessions`, `deleteSession`, `clearAllSessions`, and `setSessionTitle`) on a promise chain in the `storePromise` field:  ```ts this.storePromise = this.storePromise.then(async () => { ... }); return this.storePromise; ```  Nothing recovers the chain from a rejection, so once any step fails, `storePromise` stays rejected and every subsequent operation skips its callback and just propagates the original rejection. No more session files, index updates, title changes, or deletions are written for the rest of the frontend's lifetime.  A broken connection is an easy way to get there: `RpcProtocol` rejects all pending requests when the channel closes, so a `FileService.writeFile()` call that is in flight at that moment rejects and poisons the chain. Requests made while disconnected just wait for the reconnect, so the problem needs a write in flight at the time of the break, which is fairly li

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

### Incident Patch 1: `912262d1` (2026-11-17)
**Commit Message**: fix(filesystem): order overlapping OPFS file accesses (#18215)

Upgrade opfs-worker from 1.3.1 to 2.3.1, which locks each path for
readFile/writeFile and from open to close, so concurrent accesses to
one OPFS file no longer fail with "File not found" or "I/O error".
Adapt the provider to the 2.x API (createOPFS, importFiles, one shared
watch listener), dispose the opfs-worker facade with the provider, and
pass the broadcast channel by name instead of creating one that is
never closed.

Signed-off-by: David Wilson <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@
 
 - [core, electron] the generated `electron-main.js` no longer blocks on `fix-path` before the Electron main process starts: the backend resolves the environment of the user's login shell itself and, until it is known, holds the channel of every backend service that a frontend opens, unless the service's `ConnectionHandler` declares `independentOfShellEnvironment`. Main-process code that spawns the user's tools has to resolve the `PATH` itself, backend code that spawns before a frontend connects has to await `ShellEnvironmentServer.whenResolved()`, and `RpcConnectionHandler`, `bindBackendService` and `MessagingService.registerChannelHandler` take an options argument. See the [migration guide](https://github.com/eclipse-theia/theia/blob/master/doc/Migration.md#electron-the-backend-resolves-the-login-shell-environment-18204) [#18204](https://github.com/eclipse-theia/theia/pull/18204) - Contributed on behalf of STMicroelectronics
 - [core] `SocketWriteBuffer` keeps the messages written while disconnected in a list and sends them one by one on reconnect. Its protected `disconnectedBuffer` and `bufferWritePosition` fields are replaced by `bufferedMessages` and `bufferedBytes` [#18339](https://github.com/eclipse-theia/theia/pull/18339) - Contributed on behalf of CodeSignal
+- [filesystem] upgraded opfs-worker from 1.3.1 to 2.3.1. `OPFSFileSystemProvider.writeFile` now writes through opfs-worker's `writeFile` instead of `open`/`write`/`close`, and `OPFSInitialization.getBroadcastChannel()` is replaced by `getBroadcastChannelName()`, which returns the name of the channel instead of a `BroadcastChannel`. Implementations and subclasses that override `getBroadcastChannel()` must implement `getBroadcastChannelName()` instead [#18215](https://github.com/eclipse-theia/theia/pull/18215) - Contributed on behalf of CodeSignal
 
 ## 1.77.0 - 11/5/2026
 
```

**File**: `dev-packages/cli/patches/opfs-worker+1.3.1.patch` (removed, +0/-90)
```diff
@@ -1,90 +0,0 @@
-diff --git a/node_modules/opfs-worker/dist/facade.d.ts b/node_modules/opfs-worker/dist/facade.d.ts
-index 574d506..6f2e7ba 100644
---- a/node_modules/opfs-worker/dist/facade.d.ts
-+++ b/node_modules/opfs-worker/dist/facade.d.ts
-@@ -1,4 +1,4 @@
--import type { BinaryEncoding, DirentData, Encoding, FileOpenOptions, FileStat, OPFSOptions, PathLike, RenameOptions, StringEncoding, WatchOptions } from './types';
-+import type { BinaryEncoding, DirentData, Encoding, FileOpenOptions, FileStat, OPFSOptions, PathLike, RenameOptions, StringEncoding, WatchOptions } from './types.js';
- /**
-  * Facade class that provides a clean interface for communicating with the OPFS worker
-  * while hiding Comlink implementation details.
-diff --git a/node_modules/opfs-worker/dist/index.d.ts b/node_modules/opfs-worker/dist/index.d.ts
-index a1301f6..46c43b7 100644
---- a/node_modules/opfs-worker/dist/index.d.ts
-+++ b/node_modules/opfs-worker/dist/index.d.ts
-@@ -1,10 +1,10 @@
--import { OPFSFileSystem } from './facade';
--import type { OPFSOptions } from './types';
--export * from './types';
--export * from './utils/errors';
--export * from './utils/helpers';
--export * from './utils/encoder';
--export * from './facade';
-+import { OPFSFileSystem } from './facade.js';
-+import type { OPFSOptions } from './types.js';
-+export * from './types.js';
-+export * from './utils/errors.js';
-+export * from './utils/helpers.js';
-+export * from './utils/encoder.js';
-+export * from './facade.js';
- /**
-  * Creates a new file system instance with inline worker
-  * @param options - Optional configuration options
-diff --git a/node_modules/opfs-worker/dist/raw.d.ts b/node_modules/opfs-worker/dist/raw.d.ts
-index 9b2886d..d93400b 100644
---- a/node_modules/opfs-worker/dist/raw.d.ts
-+++ b/node_modules/opfs-worker/dist/raw.d.ts
-@@ -1,8 +1,8 @@
--import type { OPFSOptions, RemoteOPFSWorker } from './types';
--export * from './types';
--export * from './utils/errors';
--export * from './utils/helpers';
--export * from './utils/encoder';
-+import type { OPFSOptions, RemoteOPFSWorker } from './types.js';
-+export * from './types.js';
-+export * from './utils/errors.js';
-+export * from './utils/helpers.js';
-+export * from './utils/encoder.js';
- /**
-  * Creates a new file system instance with inline worker
-  * Returns the raw Comlink-wrapped worker for advanced use cases
-diff --git a/node_modules/opfs-worker/dist/types.d.ts b/node_modules/opfs-worker/dist/types.d.ts
-index a46a87f..b7ec048 100644
---- a/node_modules/opfs-worker/dist/types.d.ts
-+++ b/node_modules/opfs-worker/dist/types.d.ts
-@@ -1,4 +1,4 @@
--import type { OPFSWorker } from './worker';
-+import type { OPFSWorker } from './worker.js';
- import type { Remote } from 'comlink';
- /**
-  * Type for paths that can be either a string or URI
-diff --git a/node_modules/opfs-worker/dist/utils/encoder.d.ts b/node_modules/opfs-worker/dist/utils/encoder.d.ts
-index 2e8bcb0..d9d3fb0 100644
---- a/node_modules/opfs-worker/dist/utils/encoder.d.ts
-+++ b/node_modules/opfs-worker/dist/utils/encoder.d.ts
-@@ -1,4 +1,4 @@
--import type { Encoding } from '../types';
-+import type { Encoding } from '../types.js';
- /**
-  * Common binary file extensions
-  */
-diff --git a/node_modules/opfs-worker/dist/utils/helpers.d.ts b/node_modules/opfs-worker/dist/utils/helpers.d.ts
-index 702fa85..2446427 100644
---- a/node_modules/opfs-worker/dist/utils/helpers.d.ts
-+++ b/node_modules/opfs-worker/dist/utils/helpers.d.ts
-@@ -1,4 +1,4 @@
--import type { Encoding } from '../types';
-+import type { Encoding } from '../types.js';
- /**
-  * Check if the browser supports the OPFS API
-  *
-diff --git a/node_modules/opfs-worker/dist/worker.d.ts b/node_modules/opfs-worker/dist/worker.d.ts
-index db9a66a..d890586 100644
---- a/node_modules/opfs-worker/dist/worker.d.ts
-+++ b/node_modules/opfs-worker/dist/worker.d.ts
-@@ -1,4 +1,4 @@
--import type { DirentData, FileOpenOptions, FileStat, OPFSOptions, RenameOptions, WatchOptions } from './types';
-+import type { DirentData, FileOpenOptions, FileStat, OPFSOptions, RenameOptions, WatchOptions } from './types.js';
- /**
-  * OPFS (Origin Private File System) File System implementation
-  *
```

**File**: `package-lock.json` (modified, +4/-4)
```diff
@@ -19997,9 +19997,9 @@
       }
     },
     "node_modules/opfs-worker": {
-      "version": "1.3.1",
-      "resolved": "https://registry.npmjs.org/opfs-worker/-/opfs-worker-1.3.1.tgz",
-      "integrity": "sha512-bQwEhkXm8ODfhoVflyKgd3exbUXfnA9kZ5wxb/o9M83y725SXawjrTaAwzJ3DKcYkEosiOkTeOphBwd/8br34w==",
+      "version": "2.3.1",
+      "resolved": "https://registry.npmjs.org/opfs-worker/-/opfs-worker-2.3.1.tgz",
+      "integrity": "sha512-vxJ0cdIAC5k0RcGfHASYM1robWFfWonaUKv66Wp5RuqbTOGAOUj1iJfUCIWI1fIL6b0GhP9a0pH8ipo4grXS7w==",
       "license": "MIT",
       "dependencies": {
         "comlink": "^4.4.2",
@@ -27303,7 +27303,7 @@
         "ignore": "^6.0.2",
         "minimatch": "^10.2.6",
         "multer": "^2.4.0",
-        "opfs-worker": "1.3.1",
+        "opfs-worker": "2.3.1",
         "rimraf": "^5.0.10",
         "stat-mode": "^1.0.0",
         "tar-fs": "^3.1.3",
```

**File**: `packages/filesystem/package.json` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
     "ignore": "^6.0.2",
     "minimatch": "^10.2.6",
     "multer": "^2.4.0",
-    "opfs-worker": "1.3.1",
+    "opfs-worker": "2.3.1",
     "rimraf": "^5.0.10",
     "stat-mode": "^1.0.0",
     "tar-fs": "^3.1.3",
```

**File**: `packages/filesystem/src/browser-only/opfs-filesystem-initialization.ts` (modified, +3/-3)
```diff
@@ -19,15 +19,15 @@ import { injectable } from '@theia/core/shared/inversify';
 
 export const OPFSInitialization = Symbol('OPFSInitialization');
 export interface OPFSInitialization {
-    getBroadcastChannel(): BroadcastChannel;
+    getBroadcastChannelName(): string;
     getRootDirectory(): Promise<string> | string;
     initializeFS(provider: OPFSFileSystemProvider): Promise<void>;
 }
 
 @injectable()
 export class DefaultOPFSInitialization implements OPFSInitialization {
-    getBroadcastChannel(): BroadcastChannel {
-        return new BroadcastChannel('theia-opfs-events');
+    getBroadcastChannelName(): string {
+        return 'theia-opfs-events';
     }
 
     getRootDirectory(): Promise<string> | string {
```

**File**: `packages/filesystem/src/browser-only/opfs-filesystem-provider.spec.ts` (added, +418/-0)
```diff
@@ -0,0 +1,418 @@
+// *****************************************************************************
+// Copyright (C) 2026 CodeSignal and others.
+//
+// This program and the accompanying materials are made available under the
+// terms of the Eclipse Public License v. 2.0 which is available at
+// http://www.eclipse.org/legal/epl-2.0.
+//
+// This Source Code may also be made available under the following Secondary
+// Licenses when the conditions for such availability set forth in the Eclipse
+// Public License v. 2.0 are satisfied: GNU General Public License, version 2
+// with the GNU Classpath Exception which is available at
+// https://www.gnu.org/software/classpath/license.html.
+//
+// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
+// *****************************************************************************
+
+import { expect } from 'chai';
+import { locks } from 'worker_threads';
+import { Container, injectable } from '@theia/core/shared/inversify';
+import { CancellationToken, URI } from '@theia/core';
+import { EncodingService } from '@theia/core/lib/common/encoding-service';
+import { BinaryBuffer } from '@theia/core/lib/common/buffer';
+import { OPFSFacade, OPFSSync, type OPFSOptions } from 'opfs-worker';
+import { FileSystemProviderErrorCode, toFileSystemProviderErrorCode } from '../common/files.js';
+import { OPFSFileSystemProvider } from './opfs-filesystem-provider.js';
+import { OPFSInitialization } from './opfs-filesystem-initialization.js';
+
+function settle(): Promise<void> {
+    return new Promise(resolve => setImmediate(resolve));
+}
+
+class FakeFile {
+    data = new Uint8Array();
+    lastModified = Date.now();
+    hasSyncAccessHandle = false;
+}
+
+class FakeSyncAccessHandle {
+    constructor(protected readonly file: FakeFile) { }
+
+    getSize(): number {
+        return this.file.data.byteLength;
+    }
+
+    read(buffer: Uint8Array, { at = 0 }: { at?: number } = {}): number {
+        const bytes = this.file.data.subarray(at, at + buffer.byteLength);
+        buffer.set(bytes);
+        return bytes.byteLength;
+    }
+
+    write(buffer: Uint8Array, { at = 0 }: { at?: number } = {}): number {
+        if (at + buffer.byteLength > this.file.data.byteLength) {
+            const grown = new Uint8Array(at + buffer.byteLength);
+            grown.set(this.file.data);
+            this.file.data = grown;
+        }
+        this.file.data.set(buffer, at);
+        this.file.lastModified = Date.now();
+        return buffer.byteLength;
+    }
+
+    truncate(size: number): void {
+        this.file.data = this.file.data.slice(0, size);
+    }
+
+    flush(): void { }
+
+    close(): void {
+        this.file.hasSyncAccessHandle = false;
+    }
+}
+
+/**
+ * Like OPFS in a browser, a file can have only one sync access handle at a time.
+ */
+class FakeFileHandle {
+    readonly kind = 'file';
+
+    constructor(readonly name: string, protected readonly file: FakeFile) { }
+
+    async getFile(): Promise<{ size: number, lastModified: number }> {
+        return { size: this.file.data.byteLength, lastModified: this.file.lastModified };
+    }
+
+    async createSyncAccessHandle(): Promise<FakeSyncAccessHandle> {
+        if (this.file.hasSyncAccessHandle) {
+            throw new DOMException(`${this.name} already has a sync access handle`, 'NoModificationAllowedError');
+        }
+        this.file.hasSyncAccessHandle = true;
+        await settle();
+        return new FakeSyncAccessHandle(this.file);
+    }
+}
+
+class FakeDirectoryHandle {
+    readonly kind = 'directory';
+    readonly entries = new Map<string, FakeFile | FakeDirectoryHandle>();
+
+    constructor(readonly name: string) { }
+
+    async getDirectoryHandle(name: string, { create = false } = {}): Promise<FakeDirectoryHandle> {
+        let entry = this.entries.get(name);
+        if (!entry && create) {
+            entry = new FakeDirectoryHandle(name);
+            this.entries.set(name, entry);
+        }
+        if (!entry) {
+            throw new DOMException(name, 'NotFoundError');
+        }
+        if (!(entry instanceof FakeDirectoryHandle)) {
+            throw new DOMException(name, 'TypeMismatchError');
+        }
+        return entry;
+    }
+
+    async getFileHandle(name: string, { create = false } = {}): Promise<FakeFileHandle> {
+        let entry = this.entries.get(name);
+        if (!entry && create) {
+            entry = new FakeFile();
+            this.entries.set(name, entry);
+        }
+        await settle();
+        if (!entry) {
+            throw new DOMException(name, 'NotFoundError');
+        }
+        if (!(entry instanceof FakeFile)) {
+            throw new DOMException(name, 'TypeMismatchError');
+        }
+        return new FakeFileHandle(name, entry);
+    }
+}
+
+@injectable()
+class TestOPFSFileSystemProvider extends OPFSFileSystemProvider {
+    fileSystemDisposed = false;
+
+    protected override createFileSystem(options: 
```

**File**: `packages/filesystem/src/browser-only/opfs-filesystem-provider.ts` (modified, +25/-32)
```diff
@@ -32,7 +32,7 @@ import { EncodingService } from '@theia/core/lib/common/encoding-service';
 import { BinaryBuffer } from '@theia/core/lib/common/buffer';
 import { TextDocumentContentChangeEvent } from '@theia/core/shared/vscode-languageserver-protocol';
 import { TextDocument } from 'vscode-languageserver-textdocument';
-import { OPFSFileSystem, WatchEventType, type FileStat, type OPFSError, type WatchEvent } from 'opfs-worker';
+import { createOPFS, WatchEventType, type FileStat, type OPFSError, type OPFSFacade, type OPFSOptions, type WatchEvent } from 'opfs-worker';
 import { OPFSInitialization } from './opfs-filesystem-initialization.js';
 import { ReadableStreamEvents, newWriteableStream } from '@theia/core/lib/common/stream';
 import { readFileIntoStream } from '../common/io.js';
@@ -65,8 +65,10 @@ export class OPFSFileSystemProvider implements Disposable,
     @inject(EncodingService)
     protected readonly encodingService: EncodingService;
 
-    private fs!: OPFSFileSystem;
+    private fs!: OPFSFacade;
     private initialized: Promise<true>;
+    /** The listener of every watch, so that opfs-worker reports a change once when several watches match it. */
+    private readonly watchListener = (event: WatchEvent) => this.handleFileSystemChange(event);
 
     protected readonly toDispose = new DisposableCollection(
         this.onDidChangeFileEmitter
@@ -79,17 +81,18 @@ export class OPFSFileSystemProvider implements Disposable,
     protected init(): void {
         const setup = async (): Promise<true> => {
             const root = await this.initialization.getRootDirectory();
-            const broadcastChannel = this.initialization.getBroadcastChannel();
 
-            // Set up file change listening via BroadcastChannel
-            broadcastChannel.onmessage = this.handleFileSystemChange.bind(this);
-
-            // Initialize the file system
-            this.fs = new OPFSFileSystem({
+            const fs = this.createFileSystem({
                 root,
-                broadcastChannel,
+                broadcastChannel: this.initialization.getBroadcastChannelName(),
                 hashAlgorithm: false,
             });
+            if (this.toDispose.disposed) {
+                fs.dispose();
+                return true;
+            }
+            this.fs = fs;
+            this.toDispose.push(Disposable.create(() => fs.dispose()));
 
             await this.initialization.initializeFS(new Proxy(this, {
                 get(target, prop, receiver): unknown {
@@ -105,6 +108,10 @@ export class OPFSFileSystemProvider implements Disposable,
         this.initialized = setup();
     }
 
+    protected createFileSystem(options: OPFSOptions): OPFSFacade {
+        return createOPFS(options);
+    }
+
     /**
      * Watches a resource for file system changes
      */
@@ -116,7 +123,7 @@ export class OPFSFileSystemProvider implements Disposable,
         const unwatch = this.fs.watch(formatPath(resource), {
             recursive: opts.recursive,
             exclude: opts.excludes,
-        });
+        }, this.watchListener);
 
         return Disposable.create(unwatch);
     }
@@ -129,7 +136,7 @@ export class OPFSFileSystemProvider implements Disposable,
         for (const [uri, content] of entries) {
             arrayEntries.push([formatPath(uri), content]);
         }
-        await this.fs.createIndex(arrayEntries);
+        await this.fs.importFiles(arrayEntries);
     }
 
     /**
@@ -313,7 +320,7 @@ export class OPFSFileSystemProvider implements Disposable,
         await this.initialized;
 
         try {
-            return await this.fs.readFile(formatPath(resource), 'binary') as Uint8Array;
+            return await this.fs.readFile(formatPath(resource), 'binary');
         } catch (error) {
             throw toFileSystemProviderError(error as Error | OPFSError);
         }
@@ -339,8 +346,6 @@ export class OPFSFileSystemProvider implements Disposable,
     async writeFile(resource: URI, content: Uint8Array, opts: FileWriteOptions): Promise<void> {
         await this.initialized;
 
-        let handle: number | undefined = undefined;
-
         if (!resource || !resource.path) {
             throw createFileSystemProviderError('Invalid resource URI', FileSystemProviderErrorCode.FileNotFound);
         }
@@ -364,17 +369,9 @@ export class OPFSFileSystemProvider implements Disposable,
                 }
             }
 
-            // Open
-            handle = await this.open(resource, { create: true });
-
-            // Write content at once
-            await this.write(handle, 0, content, 0, content.byteLength);
+            await this.fs.writeFile(path, content);
         } catch (error) {
             throw toFileSystemProviderError(error as Error | OPFSError);
-        } finally {
-            if (typeof handle === 'number') {
-                await this.close(handle);
-            }
         }
     }
 
@@ -485,19 +482,15 @@ export class OPFSFileSystemProvider implem
```

---

### Incident Patch 2: `885092a0` (2026-11-12)
**Commit Message**: fix(ai-chat): recover the session store queue from a failed write

Keep the tail of the ChatSessionStoreImpl write queue resolved so that
a failed operation, such as a write in flight when the RPC channel
closes, no longer causes every later store, delete, clear, and title
change to be skipped. Each caller still sees the outcome of its own
operation.

Start a new session index only when the index file is missing or is
not valid JSON. Other read errors are now propagated instead of
caching an empty index, which a later store would otherwise write
over the persisted one.

Fixes #18369

Signed-off-by: Christian W. Damus <[REDACTED_EMAIL]>

**File**: `packages/ai-chat/src/browser/chat-session-store-impl.spec.ts` (modified, +168/-16)
```diff
@@ -37,7 +37,7 @@ import {
     SessionStorageScope
 } from '../common/ai-chat-preferences.js';
 import { ChatAgentLocation } from '../common/chat-agents.js';
-import { FileStat } from '@theia/filesystem/lib/common/files';
+import { FileOperationError, FileOperationResult, FileStat } from '@theia/filesystem/lib/common/files';
 
 disableJSDOM();
 
@@ -57,6 +57,12 @@ describe('ChatSessionStoreImpl', () => {
     };
     let deletedFiles: string[];
     let preferenceChangeCallback: ((event: { preferenceName: string }) => void) | undefined;
+    let mockLogger: {
+        debug: sinon.SinonStub;
+        info: sinon.SinonStub;
+        warn: sinon.SinonStub;
+        error: sinon.SinonStub;
+    };
 
     // Use obviously fake paths that will not exist on real systems to prevent any accidental
     // interaction with actual user data if mocking were to misconfigured
@@ -100,7 +106,7 @@ describe('ChatSessionStoreImpl', () => {
         container = new Container();
 
         mockFileService = {
-            readFile: sandbox.stub(),
+            readFile: sandbox.stub().rejects(new FileOperationError('File not found', FileOperationResult.FILE_NOT_FOUND)),
             writeFile: sandbox.stub().resolves(),
             delete: sandbox.stub().callsFake(async (uri: URI) => {
                 deletedFiles.push(uri.toString());
@@ -128,12 +134,12 @@ describe('ChatSessionStoreImpl', () => {
             tryGetRoots: () => []
         };
         const mockStorageService = {} as StorageService;
-        const mockLogger = {
+        mockLogger = {
             debug: sandbox.stub(),
             info: sandbox.stub(),
             warn: sandbox.stub(),
             error: sandbox.stub()
-        } as unknown as ILogger;
+        };
 
         // Create a mock WorkspaceMetadataStore
         const locationChangeEmitter = new Emitter<URI>();
@@ -158,7 +164,7 @@ describe('ChatSessionStoreImpl', () => {
         container.bind(WorkspaceMetadataStorageService).toConstantValue(mockMetadataStorageService as unknown as WorkspaceMetadataStorageService);
         container.bind(StorageService).toConstantValue(mockStorageService);
         container.bind('ChatSessionStore').toConstantValue(mockLogger);
-        container.bind(ILogger).toConstantValue(mockLogger);
+        container.bind(ILogger).toConstantValue(mockLogger as unknown as ILogger);
 
         container.bind(ChatSessionStoreImpl).toSelf().inSingletonScope();
 
@@ -706,19 +712,19 @@ describe('ChatSessionStoreImpl', () => {
         });
     });
 
-    describe('rootSessionId persistence', () => {
-        const mockModel = (id: string) => ({
-            id,
-            isEmpty: () => false,
+    const mockModel = (id: string) => ({
+        id,
+        isEmpty: () => false,
+        location: ChatAgentLocation.Panel,
+        toSerializable: () => ({
             location: ChatAgentLocation.Panel,
-            toSerializable: () => ({
-                location: ChatAgentLocation.Panel,
-                requests: [],
-                responses: [],
-                hierarchy: { rootBranchId: '', branches: {} }
-            })
-        });
+            requests: [],
+            responses: [],
+            hierarchy: { rootBranchId: '', branches: {} }
+        })
+    });
 
+    describe('rootSessionId persistence', () => {
         it('should include rootSessionId in the session index when updating', async () => {
             mockPreferenceService.get.withArgs(PERSISTED_SESSION_LIMIT_PREF, 25).returns(25);
 
@@ -765,4 +771,150 @@ describe('ChatSessionStoreImpl', () => {
         });
     });
 
+    describe('recovery from a failed write', () => {
+        const connectionClosed = new Error('Connection closed');
+
+        async function failFirstStore(): Promise<void> {
+            mockFileService.writeFile.onFirstCall().rejects(connectionClosed);
+            const error = await chatSessionStore.storeSessions({ model: mockModel('session-1') as never, title: 'Session 1' })
+                .then(() => undefined, (reason: unknown) => reason);
+            expect(error).to.equal(connectionClosed);
+        }
+
+        function mockIndexFile(index: ChatSessionIndex): void {
+            mockFileService.readFile.resolves({
+                value: BinaryBuffer.fromString(JSON.stringify(index))
+            } as never);
+        }
+
+        beforeEach(() => {
+            mockPreferenceService.get.withArgs(PERSISTED_SESSION_LIMIT_PREF, 25).returns(25);
+        });
+
+        it('should reject the operation whose write failed', async () => {
+            await failFirstStore();
+        });
+
+        it('should store sessions after a previous store failed', async () => {
+            await failFirstStore();
+
+            await chatSessionStore.storeSessions({ model: mockModel('session-2') as never, title: 'Session 2' });
+
+            const writtenFiles = mockFileService.writeFile.getCalls().map(call => call.args[0].toString());
+            expect(writtenFiles).t
```

**File**: `packages/ai-chat/src/browser/chat-session-store-impl.ts` (modified, +63/-34)
```diff
@@ -16,6 +16,7 @@
 
 import { inject, injectable, named, postConstruct } from '@theia/core/shared/inversify';
 import { FileService } from '@theia/filesystem/lib/browser/file-service';
+import { FileOperationError, FileOperationResult } from '@theia/filesystem/lib/common/files';
 import { WorkspaceService, WorkspaceMetadataStorageService, WorkspaceMetadataStore } from '@theia/workspace/lib/browser';
 import { PreferenceService } from '@theia/core/lib/common';
 import { StorageService } from '@theia/core/lib/browser';
@@ -87,7 +88,7 @@ export class ChatSessionStoreImpl implements ChatSessionStore {
     }
 
     async storeSessions(...sessions: Array<ChatModel | ChatModelWithMetadata>): Promise<void> {
-        this.storePromise = this.storePromise.then(async () => {
+        return this.enqueue(async () => {
             const root = await this.ensureStorageReady();
             if (!root) {
                 this.logger.debug('Session persistence is disabled: skipping store.');
@@ -142,7 +143,17 @@ export class ChatSessionStoreImpl implements ChatSessionStore {
             await this.trimSessions();
             this.logger.debug('Finished storing sessions');
         });
-        return this.storePromise;
+    }
+
+    /**
+     * Runs a write operation after all previously enqueued operations have settled.
+     * The returned promise reports the outcome of this operation only, so a failed
+     * operation does not prevent subsequent operations from running.
+     */
+    protected enqueue(operation: () => Promise<void>): Promise<void> {
+        const result = this.storePromise.then(operation);
+        this.storePromise = result.catch(() => undefined);
+        return result;
     }
 
     private isChatModelWithMetadata(session: ChatModel | ChatModelWithMetadata): session is ChatModelWithMetadata {
@@ -176,7 +187,7 @@ export class ChatSessionStoreImpl implements ChatSessionStore {
     }
 
     async deleteSession(sessionId: string): Promise<void> {
-        this.storePromise = this.storePromise.then(async () => {
+        return this.enqueue(async () => {
             const root = await this.ensureStorageReady();
             if (!root) {
                 this.logger.debug('Session persistence is disabled: skipping delete.', { sessionId });
@@ -198,11 +209,10 @@ export class ChatSessionStoreImpl implements ChatSessionStore {
             await this.saveIndex(index);
             this.logger.debug('Session removed from index', { sessionId });
         });
-        return this.storePromise;
     }
 
     async clearAllSessions(): Promise<void> {
-        this.storePromise = this.storePromise.then(async () => {
+        return this.enqueue(async () => {
             const root = await this.ensureStorageReady();
             if (!root) {
                 this.logger.debug('Session persistence is disabled: skipping clear.');
@@ -219,7 +229,6 @@ export class ChatSessionStoreImpl implements ChatSessionStore {
             this.indexCache = {};
             await this.saveIndex({});
         });
-        return this.storePromise;
     }
 
     async getSessionIndex(): Promise<ChatSessionIndex> {
@@ -229,14 +238,13 @@ export class ChatSessionStoreImpl implements ChatSessionStore {
     }
 
     async setSessionTitle(sessionId: string, title: string): Promise<void> {
-        this.storePromise = this.storePromise.then(async () => {
+        return this.enqueue(async () => {
             const index = await this.loadIndex();
             if (index[sessionId]) {
                 index[sessionId].title = title;
                 await this.saveIndex(index);
             }
         });
-        return this.storePromise;
     }
 
     /**
@@ -427,42 +435,63 @@ export class ChatSessionStoreImpl implements ChatSessionStore {
         }
         const indexFile = root.resolve(INDEX_FILE);
 
+        let rawIndex: unknown;
         try {
             const content = await this.fileService.readFile(indexFile);
-            const rawIndex = JSON.parse(content.value.toString());
-
-            // Validate and clean up index entries
-            const validatedIndex: ChatSessionIndex = {};
-            let hasInvalidEntries = false;
-
-            for (const [sessionId, metadata] of Object.entries(rawIndex)) {
-                // Check if entry has required fields and valid values
-                if (this.isValidMetadata(metadata)) {
-                    validatedIndex[sessionId] = metadata as ChatSessionMetadata;
-                } else {
-                    hasInvalidEntries = true;
-                    this.logger.warn('Removing invalid session metadata from index', {
-                        sessionId,
-                        metadata
-                    });
-                }
+            rawIndex = JSON.parse(content.value.toString());
+        } catch (e) {
+            if (!this.isMissingOrCorruptIndexError(e)) {
+                throw e;
             }
+            if (e instanceof SyntaxError) {
+            
```

---

### Incident Patch 3: `851142ef` (2026-11-13)
**Commit Message**: fix(ai-ide): include the number of matches in the search limit message (#18294)

The searchInWorkspace tool asked the search service for only one match
more than its limit, so it could only report "Found 30+ results" and the
model could not tell 31 matches from thousands.

Count the matches up to ten times the limit and report their number, or
"more than N" beyond that, together with the limit. Return only the
first matches up to the limit; previously one match more was returned.

Dispose the cancellation listener when the search ends, as it kept the
search results in memory for the lifetime of the chat response.

Fixes #17538

Signed-off-by: Mohammed Sufiyan Ahmed <[REDACTED_EMAIL]>

**File**: `packages/ai-ide/src/browser/workspace-search-provider.spec.ts` (modified, +52/-1)
```diff
@@ -62,7 +62,8 @@ describe('Workspace Search Provider Cancellation Tests', () => {
         const mockWorkspaceScope = {
             getRootMapping: () => new Map([['workspace', new URI('file:///workspace')]]),
             getContainingRoot: () => new URI('file:///workspace'),
-            resolveAccessiblePath: async (path: string) => new URI(`file:///workspace/${path}`)
+            resolveAccessiblePath: async (path: string) => new URI(`file:///workspace/${path}`),
+            toWorkspaceRelativePath: (uri: URI) => uri.path.base
         } as unknown as WorkspaceFunctionScope;
 
         const mockPreferenceService = {
@@ -200,4 +201,54 @@ describe('Workspace Search Provider Cancellation Tests', () => {
         expect(capturedOptions?.include).to.deep.equal(['**/*.ts', '**/*.js']);
     });
 
+    /** Rebinds the search service to report one file per entry of `matchesPerFile` with that many matches. */
+    function bindSearchResults(matchesPerFile: number[]): { options?: SearchInWorkspaceOptions } {
+        const search: { options?: SearchInWorkspaceOptions } = {};
+        container.rebind(SearchInWorkspaceService).toConstantValue({
+            searchWithCallback: async (
+                query: string,
+                rootUris: string[],
+                callbacks: SearchInWorkspaceCallbacks,
+                options: SearchInWorkspaceOptions
+            ) => {
+                search.options = options;
+                matchesPerFile.forEach((count, index) => callbacks.onResult(1, {
+                    root: 'file:///workspace',
+                    fileUri: `file:///workspace/file${index}.ts`,
+                    matches: Array.from({ length: count }, (_, line) => ({ line: line + 1, character: 1, length: 4, lineText: 'test' }))
+                }));
+                callbacks.onDone(1);
+                return 1;
+            },
+            cancel: () => { }
+        } as unknown as SearchInWorkspaceService);
+        return search;
+    }
+
+    it('should report the number of matches and return only the first matches when the limit is exceeded', async () => {
+        // ripgrep can report a file without matches, e.g. for `$` on a last line without a line break, which must not be returned
+        const search = bindSearchResults([20, 0, 20]);
+
+        const searchProvider = container.get(WorkspaceSearchProvider);
+        const handler = searchProvider.getTool().handler;
+        const result = await handler(JSON.stringify({ query: 'test', useRegExp: false }), mockCtx);
+
+        const jsonResponse = JSON.parse(result as string);
+        expect(search.options?.maxResults).to.equal(301);
+        expect(jsonResponse.info).to.contain('Found 40 results, showing the first 30.');
+        expect(jsonResponse.incompleteResults.map((file: { matches: unknown[] }) => file.matches.length)).to.deep.equal([20, 10]);
+    });
+
+    it('should report more than ten times the limit when the search stops at its bound', async () => {
+        bindSearchResults([200, 101]);
+
+        const searchProvider = container.get(WorkspaceSearchProvider);
+        const handler = searchProvider.getTool().handler;
+        const result = await handler(JSON.stringify({ query: 'test', useRegExp: false }), mockCtx);
+
+        const jsonResponse = JSON.parse(result as string);
+        expect(jsonResponse.info).to.contain('Found more than 300 results, showing the first 30.');
+        expect(jsonResponse.incompleteResults.map((file: { matches: unknown[] }) => file.matches.length)).to.deep.equal([30]);
+    });
+
 });
```

**File**: `packages/ai-ide/src/browser/workspace-search-provider.ts` (modified, +28/-11)
```diff
@@ -15,7 +15,7 @@
 // *****************************************************************************
 
 import { ToolInvocationContext, ToolProvider, ToolRequest } from '@theia/ai-core';
-import { CancellationToken } from '@theia/core';
+import { CancellationToken, Disposable } from '@theia/core';
 import { PreferenceService } from '@theia/core/lib/common/preferences/preference-service';
 import { inject, injectable } from '@theia/core/shared/inversify';
 import { FileService } from '@theia/filesystem/lib/browser/file-service';
@@ -113,6 +113,7 @@ export class WorkspaceSearchProvider implements ToolProvider {
     }
 
     private async handleSearch(argString: string, cancellationToken?: CancellationToken): Promise<string> {
+        let cancellationListener: Disposable | undefined;
         try {
             const args: { query: string, useRegExp: boolean, fileExtensions?: string[] | string, subDirectoryPath?: string } = JSON.parse(argString);
 
@@ -124,20 +125,22 @@ export class WorkspaceSearchProvider implements ToolProvider {
             let expectedSearchId: number | undefined;
             let searchCompleted = false;
 
-            cancellationToken?.onCancellationRequested(() => {
+            cancellationListener = cancellationToken?.onCancellationRequested(() => {
                 if (expectedSearchId !== undefined && !searchCompleted) {
                     this.searchService.cancel(expectedSearchId);
                     searchCompleted = true;
                 }
             });
 
-            // Use one more than our actual maximum. this way we can determine if we have more results than our maximum and warn the user
-            const maxResultsForTheiaAPI = this.preferenceService.get<number>(SEARCH_IN_WORKSPACE_MAX_RESULTS_PREF, 30) + 1;
+            const maxResults = this.preferenceService.get<number>(SEARCH_IN_WORKSPACE_MAX_RESULTS_PREF, 30);
+            // Count the matches up to ten times our maximum, to tell slightly more matches from many more.
+            const maxCountedResults = maxResults * 10;
             const options: SearchInWorkspaceOptions = {
                 useRegExp: args.useRegExp,
                 matchCase: false,
                 matchWholeWord: false,
-                maxResults: maxResultsForTheiaAPI,
+                // Request one more match than we count, so that we can tell whether there are even more.
+                maxResults: maxCountedResults + 1,
             };
 
             // The model may supply fileExtensions as a single string instead of an array; normalize to an array so that `.map` never throws.
@@ -209,27 +212,41 @@ export class WorkspaceSearchProvider implements ToolProvider {
             });
 
             const finalResults = await Promise.race([searchPromise, timeoutPromise]);
-            const maxResults = this.preferenceService.get<number>(SEARCH_IN_WORKSPACE_MAX_RESULTS_PREF, 30);
-
-            const formattedResults = optimizeSearchResults(finalResults, this.workspaceScope);
 
             let numberOfMatchesInFinalResults = 0;
             for (const result of finalResults) {
                 numberOfMatchesInFinalResults += result.matches.length;
             }
             if (numberOfMatchesInFinalResults > maxResults) {
+                // Only return the first matches up to our maximum.
+                const truncatedResults: SearchInWorkspaceResult[] = [];
+                let remainingMatches = maxResults;
+                for (const result of finalResults) {
+                    if (remainingMatches <= 0) {
+                        break;
+                    }
+                    const matches = result.matches.slice(0, remainingMatches);
+                    if (matches.length > 0) {
+                        truncatedResults.push({ ...result, matches });
+                        remainingMatches -= matches.length;
+                    }
+                }
+                const foundMatches = numberOfMatchesInFinalResults > maxCountedResults ? 'more than ' + maxCountedResults : String(numberOfMatchesInFinalResults);
                 return JSON.stringify({
-                    info: 'Search limit exceeded: Found ' + maxResults + '+ results. ' +
+                    info: 'Search limit exceeded: Found ' + foundMatches + ' results, showing the first ' + maxResults + '. ' +
                         'Please refine your search with more specific terms or use file extension filters. ' +
                         'You can increase the limit in preferences under \'ai-features.workspaceFunctions.searchMaxResults\'.',
-                    incompleteResults: formattedResults
+                    incompleteResults: optimizeSearchResults(truncatedResults, this.workspaceScope)
                 });
             }
 
-            return JSON.stringify(formattedResults);
+            return JSON.stringify(optimizeSearchResults(finalResults, this.workspaceScope));
 
         } catch (error) {
             return JSON.stringify({ error: er
```

#### Recent Merged Pull Requests:
- **PR #18397** (2026-11-18): Preserve focus when the SCM AI commit overlay changes (@JunaidAhamed-7777)
- **PR #18389** (closed): Add initial devcontainer configuration (@joeyr64)
- **PR #18380** (2026-11-16): fix(ci): post the basic checks for first-time contributor PRs (@ndoschek)
- **PR #18373** (2026-11-17): Report the shell PID as shellProcessId when runInTerminal (@colin-grant-work)
- **PR #18372** (2026-11-13): Hide empty title bar (@colin-grant-work)
- **PR #18371** (2026-11-17): fix(navigator): support sibling clauses in files.exclude (@KevinGruber2001)

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

## X. filesystem): order overlapping OPFS file accesses

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in eclipse-theia/theia. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `912262d1`: filesystem): order overlapping OPFS file accesses. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
- [filesystem] upgraded opfs-worker from 1.3.1 to 2.3.1. `OPFSFileSystemProvider.writeFile` now writes through opfs-worker's `writeFile` instead of `open`/`write`/`close`, and `OPFSInitialization.getBroadcastChannel()` is replaced by `getBroadcastChannelName()`, which returns the name of the channel instead of a `BroadcastChannel`. Implementations and subclasses that override `getBroadcastChannel()` must implement `getBroadcastChannelName()` instead [#18215](https://github.com/eclipse-theia/theia/pull/18215) - Contributed on behalf of CodeSignal
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `912262d1` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
