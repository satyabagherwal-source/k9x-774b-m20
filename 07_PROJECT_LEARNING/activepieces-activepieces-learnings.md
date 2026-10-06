# Forensic Learning Record (Deep Inspection): activepieces/activepieces

> **Canonical Artifact**: `07_PROJECT_LEARNING/activepieces-activepieces-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/activepieces/activepieces](https://github.com/activepieces/activepieces))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T01:44:32.376Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `activepieces/activepieces`
- **Description**: AI Agents & MCPs & AI Workflow Automation • (~400 MCP servers for AI agents) • AI Automation / AI Agent with MCPs • AI Workflows & AI Agents • MCPs for AI Agents
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 24912 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `packages/cli/src/lib/commands/generate-worker-token.ts`
```
import { Command } from 'commander';
import chalk from 'chalk';
import { prompt } from 'inquirer';
import { nanoid } from 'nanoid';
import jwtLibrary from 'jsonwebtoken';

const KEY_ID = '1'
const ISSUER = 'activepieces'
const ALGORITHM = 'HS256'

export const generateWorkerTokenCommand = new Command('token')
    .description('Generate a JWT token for worker authentication')
    .action(async () => {
        const answers = await prompt([
            {
                type: 'input',
                name: 'jwtSecret',
                message: 'Enter your JWT secret (should be the same as AP_JWT_SECRET used for the app server):',
                validate: (input) => {
                    if (!input) {
                        return 'JWT secret is required';
                    }
                    return true;
                }
            }
        ]);

        const payload = {
            id: nanoid(),
            type: 'WORKER',
        };

        // 100 years in seconds
        const expiresIn = 100 * 365 * 24 * 60 * 60;

        try {
            const token = jwtLibrary.sign(payload, answers.jwtSecret, {
                expiresIn,
                keyid: KEY_ID,
                algorithm: ALGORITHM,
                issuer: ISSUER,
            });
            console.log(chalk.green('\nGenerated Worker Token, Please use it in AP_WORKER_TOKEN environment variable:'));
            console.log(chalk.yellow(token));
           
        } catch (error) {
            console.error(chalk.red('Failed to generate token:'), error);
            process.exit(1);
        }
    }); 
```

### Core Architecture Module: `packages/cli/src/lib/utils/bundle-piece-utils.ts`
```
import { statSync, existsSync, readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { join, resolve, isAbsolute, basename, sep } from 'node:path'
import * as esbuild from 'esbuild'

async function bundlePiece({ piecePath, distPath, repoRoot }: BundlePieceParams): Promise<BundleResult> {
    const entryFile = join(piecePath, 'src', 'index.ts')
    if (!existsSync(entryFile)) {
        throw new Error(`[bundlePiece] no entry at ${entryFile}`)
    }

    const manifest = readPieceManifest(piecePath)
    const { inlineAll, inlineList, excludeList } = readInlineConfig(manifest)
    const outfile = join(distPath, BUNDLE_FILENAME)

    // Pass 1: inline everything safe. Known-native packages are externalized upfront so a
    // native .node binary can never be pulled into the bundle.
    let pass = await runEsbuild({ entryFile, outfile, repoRoot, inlineAll, inlineList, external: new Set(excludeList) })

    // A dynamic/indirect require (or a stray .node) can only be detected after esbuild has tried
    // to trace it. If pass 1 surfaced any such unsafe package, externalize it and rebuild ONCE —
    // auto-externalize the offending dep instead of failing the whole piece. Only the handful of
    // pieces with dynamic-require deps (couchbase, metabase, text-helper, scrapeless) hit pass 2.
    const unsafe = new Set([
        ...unsafePackages({ metafile: pass.result.metafile, warnings: pass.result.warnings }),
        ...importMetaPackages(pass.result.metafile),
    ])
    if (unsafe.size > 0) {
        pass = await runEsbuild({ entryFile, outfile, repoRoot, inlineAll, inlineList, external: new Set([...excludeList, ...unsafe]) })
    }

    // Anything still broken after auto-externalization is a genuine un-resolvable bug — fail loud.
    let issues = gateBundle({ metafile: pass.result.metafile, warnings: pass.result.warnings })
    if (issues.length > 0) {
        throw new Error(`[bundlePiece] ${piecePath} failed the safety gate:\n  - ${issues.join('\n  - ')}`)
    }

    // Size fallback: inlining a very large SDK (e.g. datadog's 7.7 MB API client) blows the cap.
    // Rather than fail, fall back to external-by-default for this piece — its third-party deps
    // install at runtime and the bundle stays small. Keeps every piece building and lean.
    if (inlineAll && statSync(outfile).size > FAIL_BYTES) {
        pass = await runEsbuild({ entryFile, outfile, repoRoot, inlineAll: false, inlineList: new Set(), external: new Set(excludeList) })
        issues = gateBundle({ metafile: pass.result.metafile, warnings: pass.result.warnings })
        if (issues.length > 0) {
            throw new Error(`[bundlePiece] ${piecePath} failed the safety gate (external fallback):\n  - ${issues.join('\n  - ')}`)
        }
    }

    assertDirnameUsageDeclared({ piecePath, metafile: pass.result.metafile, manifest })
    const forked = await bundleForkedEntries({ piecePath, distPath, repoRoot, manifest, inlineAll, inlineList, excludeList })
    for (const dep of forked.externalized) {
        pass.externalized.add(dep)
    }

    const bundleBytes = statSync(outfile).size
    const rawBytes = totalInputBytes(pass.result.metafile)
    const external = [...pass.externalized].filter((dep) => !dep.startsWith('@activepieces/') && !BUNDLE_HELPER_DEPS.has(dep))

    enforceSizeGate({ piecePath, bundleBytes })

    return { bundleFile: outfile, bundleBytes, rawBytes, external, inlined: [...pass.inlined], extraBundleFiles: forked.files }
}

async function bundleForkedEntries({ piecePath, distPath, repoRoot, manifest, inlineAll, inlineList, excludeList }: ForkedEntriesParams): Promise<ForkedEntriesResult> {
    const files: string[] = []
    const externalized = new Set<string>()
    for (const entry of manifest.bundleForkedEntries ?? []) {
        const entryFile = join(piecePath, entry)
        if (!existsSync(entryFile)) {
            throw new Error(`[bundlePiece] bundleForkedEntries: no file at ${entryFile}`)
        }
        const outRel = `src/${basename(entry).replace(/\.ts$/, '.js')}`
        if (outRel === BUNDLE_FILENAME) {
            throw new Error(`[bundlePiece] bundleForkedEntries: "${entry}" collides with the main bundle at ${BUNDLE_FILENAME}`)
        }
        if (files.some((file) => file.toLowerCase() === outRel.toLowerCase())) {
            throw new Error(`[bundlePiece] bundleForkedEntries: "${entry}" collides with another declared entry at ${outRel}`)
        }
        const outfile = join(distPath, outRel)
        let pass = await runEsbuild({ entryFile, outfile, repoRoot, inlineAll, inlineList, external: new Set(excludeList) })
        const unsafe = new Set([
            ...unsafePackages({ metafile: pass.result.metafile, warnings: pass.result.warnings }),
            ...importMetaPackages(pass.result.metafile),
        ])
        if (unsafe.size > 0) {
            pass = await runEsbuild({ entryFile, outfile, repoRoot, inlineAll, inlineList, external: new Set([...excludeList, ...unsafe]) })
        }
        const issues = gateBundle({ metafile: pass.result.metafile, warnings: pass.result.warnings })
        if (issues.length > 0) {
            throw new Error(`[bundlePiece] ${piecePath} forked entry "${entry}" failed the safety gate:\n  - ${issues.join('\n  - ')}`)
        }
        enforceSizeGate({ piecePath: `${piecePath} (${entry})`, bundleBytes: statSync(outfile).size })
        files.push(outRel)
        for (const dep of pass.externalized) {
            externalized.add(dep)
        }
    }
    return { files, externalized }
}

function assertDirnameUsageDeclared({ piecePath, metafile, manifest }: DirnameGateParams): void {
    if ((manifest.bundleForkedEntries ?? []).length > 0) {
        return
    }
    const pieceRoot = resolve(piecePath)
    for (const input of Object.keys(metafile.inputs)) {
        const abs = resolve(process.cwd(), input)
        if (!abs.startsWith(pieceRoot + sep) || abs.includes(`${sep}node_modules${sep}`)) {
            continue
        }
        if (/\b__dirname\b/.test(safeReadFile(abs))) {
            throw new Error(
                `[bundlePiece] ${input} uses __dirname but the piece declares no bundleForkedEntries. `
                + 'The published piece is a single bundled src/index.js, so __dirname-relative file access breaks after publish. '
                + 'Declare the runtime-loaded file in package.json "bundleForkedEntries" (it will be emitted beside the bundle), or remove the __dirname usage.',
            )
        }
    }
}

function safeReadFile(file: string): string {
    try {
        return readFileSync(file, 'utf-8')
    }
    catch {
        return ''
    }
}

async function runEsbuild({ entryFile, outfile, repoRoot, inlineAll, inlineList, external }: RunEsbuildParams): Promise<EsbuildPass> {
    const inlined = new Set<string>()
    const externalized = new Set<string>()
    const result = await esbuild.build({
        entryPoints: [entryFile],
        bundle: true,
        platform: 'node',
        target: 'node20',
        format: 'cjs',
        outfile,
        minify: true,
        // The engine extracts a piece by scanning module exports for one whose
        // `constructor.name === 'Piece'` (see extractPieceFromModule). Minification would
        // otherwise mangle the Piece class name and make every bundled piece un-installable.
        keepNames: true,
        treeShaking: true,
        metafile: true,
        logLevel: 'silent',
        alias: workspaceAliases(repoRoot),
        plugins: [externalizeThirdParty({ inlineAll, inlineList, external, inlined, externalized })],
        loader: { '.node': 'file' },
    })
    return { result, inlined, externalized }
}

function readPieceManifest(piecePath: string): PieceManifest {
    const pkgPath = join(piecePath, 'package.json')
    if (!existsSync(pkgPath)) {
        return {}
    }
    return JSON.parse(readFileSync(pkgPath, 'utf-8'))
}

// Inline-by-default. Third-party deps are bundled in unless they cannot be safely inlined
// (native addons / dynamic require — those are auto-externalized by the safety gate):
//   bundleDeps absent / true → inline every third-party dep (default)
//   bundleDeps === ['a','b']  → inline only these
//   bundleDeps === false      → externalize all third-party (explicit opt-out / escape hatch)
// `excludeList` (known-native packages) is always kept external, even under inline-all.
function readInlineConfig(manifest: PieceManifest): InlineConfig {
    const value = manifest.bundleDeps
    const excludeList = new Set(NATIVE_EXTERNALS)
    if (value === false) {
        return { inlineAll: false, inlineList: new Set(), excludeList }
    }
    if (Array.isArray(value)) {
        return { inlineAll: false, inlineList: new Set(value), excludeList }
    }
    return { inlineAll: true, inlineList: new Set(), excludeList }
}

// Only @activepieces/* workspace code and relative/absolute imports are always bundled in.
// Node builtins and packages in `external` (known-native + auto-externalized dynamic-require
// deps) are kept external. Everything else is inlined when inlineAll / listed in inlineList.
function externalizeThirdParty({ inlineAll, inlineList, external, inlined, externalized }: ExternalizeParams): esbuild.Plugin {
    return {
        name: 'externalize-third-party',
        setup(build) {
            build.onResolve({ filter: /.*/ }, (args) => {
                if (args.kind === 'entry-point') {
                    return null
                }
                const id = args.path
                if (id.startsWith('.') || isAbsolute(id)) {
                    return null
                }
                if (id.startsWith('@activepieces/')) {
                    return null
                }
                if (id.startsWith('node:') || NODE_BUILTINS.has(id)) {
                    return { path: id, external: true }
                }
                const top = topLevelPkg(id)
                if (external.has(top)) {
           
```

### Core Architecture Module: `packages/cli/src/lib/utils/exec.ts`
```
import { exec as execCallback } from 'node:child_process';
import { promisify } from 'node:util';

export const exec = promisify(execCallback);

```

### Core Architecture Module: `packages/cli/src/lib/utils/files.ts`
```
import {
  constants,
  readFile,
  access,
  mkdir,
} from 'node:fs/promises';

export type PackageJson = {
  name: string;
  version: string;
  keywords: string[];
};

export const checkIfFileExists = async (filePath: string) => {
  try {
    await access(filePath, constants.F_OK);
    return true;
  } catch (e) {
    return false;
  }
};

const readJsonFile = async <T>(path: string): Promise<T> => {
  const jsonFile = await readFile(path, { encoding: 'utf-8' });
  return JSON.parse(jsonFile) as T;
};

export const readPackageJson = async (path: string): Promise<PackageJson> => {
  return await readJsonFile(`${path}/package.json`);
};

export const makeFolderRecursive = async (path: string): Promise<void> => {
  await mkdir(path, { recursive: true });
};

```

### Core Architecture Module: `packages/cli/src/lib/utils/migrate-piece-utils.ts`
```
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

function migratePiece({ piecePath, dryRun }: MigratePieceParams): MigrateReport {
    const repointedFiles: string[] = []
    const srcDir = join(piecePath, 'src')
    if (existsSync(srcDir)) {
        for (const file of collectTsFiles(srcDir)) {
            const original = readFileSync(file, 'utf-8')
            const rewritten = repointImports(original)
            if (rewritten !== original) {
                repointedFiles.push(file)
                if (!dryRun) {
                    writeFileSync(file, rewritten)
                }
            }
        }
    }
    const manifestChanged = migrateManifest({ piecePath, dryRun })
    const eslintChanged = migrateEslintConfig({ piecePath, dryRun })
    return { repointedFiles, manifestChanged, eslintChanged }
}

function collectTsFiles(dir: string): string[] {
    const files: string[] = []
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
            files.push(...collectTsFiles(full))
        }
        else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
            files.push(full)
        }
    }
    return files
}

// A piece imports only from @activepieces/pieces-framework (which re-exports the foundation
// symbols). Repoint every shared / core-* import specifier to the framework; a symbol the
// framework does not re-export was server-only and will surface as a build error.
function repointImports(content: string): string {
    let next = content
    for (const moduleName of REPOINTED_MODULES) {
        next = next.split(`from '${moduleName}'`).join(`from '${FRAMEWORK}'`)
        next = next.split(`from "${moduleName}"`).join(`from "${FRAMEWORK}"`)
    }
    return next
}

function migrateManifest({ piecePath, dryRun }: MigratePieceParams): boolean {
    const manifestPath = join(piecePath, 'package.json')
    if (!existsSync(manifestPath)) {
        return false
    }
    const raw = readFileSync(manifestPath, 'utf-8')
    const manifest = JSON.parse(raw)
    const dependencies: Record<string, string> = manifest.dependencies ?? {}
    const devDependencies: Record<string, string> = manifest.devDependencies ?? {}
    const scripts: Record<string, string> = manifest.scripts ?? {}

    delete dependencies['@activepieces/shared']
    for (const dep of REQUIRED_DEPENDENCIES) {
        dependencies[dep] = dependencies[dep] ?? 'workspace:*'
    }
    if (dependencies['tslib']) {
        devDependencies['tslib'] = devDependencies['tslib'] ?? dependencies['tslib']
        delete dependencies['tslib']
    }
    devDependencies['tslib'] = devDependencies['tslib'] ?? TSLIB_VERSION
    scripts['bundle'] = scripts['bundle'] ?? BUNDLE_SCRIPT

    manifest.dependencies = dependencies
    manifest.devDependencies = devDependencies
    manifest.scripts = scripts

    const next = JSON.stringify(manifest, null, 2) + '\n'
    if (next === raw) {
        return false
    }
    if (!dryRun) {
        writeFileSync(manifestPath, next)
    }
    return true
}

function migrateEslintConfig({ piecePath, dryRun }: MigratePieceParams): boolean {
    const configPath = join(piecePath, '.eslintrc.json')
    const previous = existsSync(configPath) ? readFileSync(configPath, 'utf-8') : ''
    const config = previous ? JSON.parse(previous.replace(/^﻿/, '')) : defaultEslintConfig()

    const overrides: EslintOverride[] = config.overrides ?? []
    let tsOverride = overrides.find((override) => Array.isArray(override.files) && override.files.includes('*.ts') && !override.files.includes('*.js'))
    if (!tsOverride) {
        tsOverride = { files: ['*.ts', '*.tsx'], rules: {} }
        overrides.push(tsOverride)
    }
    tsOverride.rules = tsOverride.rules ?? {}
    tsOverride.rules['no-restricted-imports'] = ['error', { patterns: [...IMPORT_BOUNDARY_PATTERNS] }]
    config.overrides = overrides

    const next = JSON.stringify(config, null, 2) + '\n'
    if (next === previous) {
        return false
    }
    if (!dryRun) {
        writeFileSync(configPath, next)
    }
    return true
}

function defaultEslintConfig(): Record<string, unknown> {
    return {
        extends: ['../../../../.eslintrc.json'],
        ignorePatterns: ['!**/*'],
        overrides: [
            { files: ['*.ts', '*.tsx', '*.js', '*.jsx'], rules: {} },
            { files: ['*.js', '*.jsx'], rules: {} },
        ],
    }
}

const FRAMEWORK = '@activepieces/pieces-framework'
const REPOINTED_MODULES = [
    '@activepieces/shared',
    '@activepieces/core-utils',
    '@activepieces/core-piece-types',
    '@activepieces/core-formula',
    '@activepieces/core-execution',
]
const REQUIRED_DEPENDENCIES = [
    '@activepieces/pieces-common',
    '@activepieces/pieces-framework',
    '@activepieces/core-piece-types',
    '@activepieces/core-utils',
]
const IMPORT_BOUNDARY_PATTERNS = [
    'lodash',
    'lodash/*',
    '@activepieces/core-*',
    '@activepieces/server*',
    '@activepieces/engine',
    '@activepieces/shared',
]
const TSLIB_VERSION = '2.6.2'
const BUNDLE_SCRIPT = 'node ../../../../dist/packages/cli/src/index.js pieces bundle'

export const migratePieceUtils = { migratePiece }

export type MigratePieceParams = {
    piecePath: string
    dryRun: boolean
}
export type MigrateReport = {
    repointedFiles: string[]
    manifestChanged: boolean
    eslintChanged: boolean
}
type EslintOverride = {
    files: string[]
    rules?: Record<string, unknown>
}

```

### Core Architecture Module: `packages/cli/src/lib/utils/piece-utils.ts`
```
import { readdir, stat } from 'node:fs/promises'
import * as path from 'path'
import { cwd } from 'node:process'
import { readPackageJson } from './files'
import { exec } from './exec'
import axios from 'axios'
import chalk from 'chalk'
import FormData from 'form-data';
import fs from 'fs';
import { preparePieceDistForPublish } from './prepare-piece-utils';

export const piecesPath = () => path.join(cwd(), 'packages', 'pieces')
export const customPiecePath = () => path.join(piecesPath(), 'custom')

/**
 * Finds and returns the paths of specific pieces or all available pieces in a given directory.
 *
 * @param inputPath - The root directory to search for pieces. If not provided, a default path to custom pieces is used.
 * @param pieces - An optional array of piece names to search for. If not provided, all pieces in the directory are returned.
 * @returns A promise resolving to an array of strings representing the paths of the found pieces.
 */
export async function findPieces(inputPath?: string, pieces?: string[]): Promise<string[]> {
    const piecesPath = inputPath ?? customPiecePath()
    const piecesFolders = await traverseFolder(piecesPath)
    if (pieces) {
        return pieces.flatMap((piece) => {
          const folder = piecesFolders.find((p) => {
              const normalizedPath = path.normalize(p);
              return normalizedPath.endsWith(path.sep + piece);
          });
          if (!folder) {
              return [];
          }
          return [folder];
      });
    } else {
        return piecesFolders
    }
}

/**
 * Finds and returns the path of a single piece. Exits the process if the piece is not found.
 *
 * @param pieceName - The name of the piece to search for.
 * @returns A promise resolving to a string representing the path of the found piece. If not found, the process exits.
 */
export async function findPiece(pieceName: string): Promise<string | null> {
    return (await findPieces(piecesPath(), [pieceName]))[0] ?? null;
}

export async function buildPiece(pieceFolder: string): Promise<{ outputFolder: string, outputFile: string }> {
    const packageJson = await readPackageJson(pieceFolder);

    await buildPackage(packageJson.name);

    const compiledPath = `packages/${removeStartingSlashes(pieceFolder).split(path.sep + 'packages')[1]}/dist`;

    await preparePieceDistForPublish(pieceFolder);

    const { stdout } = await exec('npm pack --json', { cwd: compiledPath });
    const tarFileName = JSON.parse(stdout)[0].filename;
    return {
        outputFolder: compiledPath,
        outputFile: path.join(compiledPath, tarFileName)
    };
}

export async function buildPackage(packageName: string) {
    await exec(`npx turbo run build --filter=${packageName} --force`);
    return {
        outputFolder: `dist/packages/${packageName}`,
    }
}

export async function publishPieceFromFolder(
    {pieceFolder, apiUrl, apiKey, failOnError}:
  {pieceFolder: string,
  apiUrl: string,
  apiKey: string,
  failOnError: boolean,}
) {
    const packageJson = await readPackageJson(pieceFolder);

    await buildPackage(packageJson.name);

    const { outputFile } = await buildPiece(pieceFolder);
    const formData = new FormData();

    console.log(chalk.blue(`Uploading ${outputFile}`));
    formData.append('pieceArchive', fs.createReadStream(outputFile));
    formData.append('pieceName', packageJson.name);
    formData.append('pieceVersion', packageJson.version);
    formData.append('packageType', 'ARCHIVE');
    formData.append('scope', 'PLATFORM');

    try {
        await axios.post(`${apiUrl}/v1/pieces`, formData, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                ...formData.getHeaders()
            }
        });
        console.info(chalk.green(`Piece '${packageJson.name}' published.`));
    } catch (error) {
     
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 409) {
                console.info(chalk.yellow(`Piece '${packageJson.name}' and '${packageJson.version}' already published.`));
            } else if (error.response && Math.floor(error.response.status / 100) !== 2) {
                console.info(chalk.red(`Error publishing piece '${packageJson.name}',  ${error}` ));
                if (failOnError) {
                    console.info(chalk.yellow(`Terminating process due to publish failure for piece '${packageJson.name}' (fail-on-error is enabled)`));
                    process.exit(1);
                }
            } else {
                console.error(chalk.red(`Unexpected error: ${error.message}`));
                if (failOnError) {
                    console.info(chalk.yellow(`Terminating process due to unexpected error for piece '${packageJson.name}' (fail-on-error is enabled)`));
                    process.exit(1);
                }
            }
        } else {
            console.error(chalk.red(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`));
            if (failOnError) {
              console.info(chalk.yellow(`Terminating process due to unexpected error for piece '${packageJson.name}' (fail-on-error is enabled)`));
              process.exit(1);
            }
        }
    }
}
async function traverseFolder(folderPath: string): Promise<string[]> {
    const paths: string[] = []
    const directoryExists = await stat(folderPath).catch(() => null)

    if (directoryExists && directoryExists.isDirectory()) {
        const files = await readdir(folderPath)

        for (const file of files) {
            const filePath = path.join(folderPath, file)
            const fileStats = await stat(filePath)
            if (fileStats.isDirectory() && file !== 'node_modules' && file !== 'dist') {
                paths.push(...await traverseFolder(filePath))
            }
            else if (file === 'package.json') {
                paths.push(folderPath)
            }
        }
    }
    return paths
}

export function displayNameToKebabCase(displayName: string): string {
    return displayName.toLowerCase().replace(/\s+/g, '-');
}

export function displayNameToCamelCase(input: string): string {
    const words = input.split(' ');
    const camelCaseWords = words.map((word, index) => {
      if (index === 0) {
        return word.toLowerCase();
      } else {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
    });
    return camelCaseWords.join('');
  }

export function assertPieceExists(pieceName: string | null): asserts pieceName is string {
    if (!pieceName) {
      console.error(chalk.red(`🚨 Piece ${pieceName} not found`));
      process.exit(1);
    }
  }


  export const removeStartingSlashes = (str: string) => {
    return str.startsWith('/') ? str.slice(1) : str;
  }


```

### Core Architecture Module: `packages/cli/src/lib/utils/prepare-piece-utils.ts`
```
import { readFileSync, writeFileSync, existsSync, copyFileSync, readdirSync, mkdirSync, statSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, relative } from 'node:path'
import { buildWorkspaceVersionMap, findRepoRoot, resolveWorkspaceDependencies, stripSemverRanges } from './workspace-utils'
import { bundlePieceUtils } from './bundle-piece-utils'

function copyPackageJson({ piecePath, distPath }: PieceDistPaths): void {
    const srcPackageJson = join(piecePath, 'package.json')
    if (!existsSync(srcPackageJson)) {
        throw new Error(`[preparePiece] no package.json at ${srcPackageJson}`)
    }
    copyFileSync(srcPackageJson, join(distPath, 'package.json'))
}

function copyI18nAssets({ piecePath, distPath }: PieceDistPaths): void {
    const i18nSrc = join(piecePath, 'src', 'i18n')
    if (!existsSync(i18nSrc)) {
        return
    }

    const i18nDest = join(distPath, 'src', 'i18n')
    mkdirSync(i18nDest, { recursive: true })

    const files = readdirSync(i18nSrc)
    for (const file of files) {
        copyFileSync(join(i18nSrc, file), join(i18nDest, file))
    }
}

async function preparePieceDistForPublish(piecePath: string): Promise<void> {
    const distPath = join(piecePath, 'dist')

    if (!existsSync(distPath)) {
        throw new Error(`[preparePiece] no dist output at ${distPath} for ${piecePath}`)
    }

    const repoRoot = findRepoRoot(piecePath)
    const paths = { piecePath, distPath }
    copyPackageJson(paths)
    copyI18nAssets(paths)

    const { bundleBytes, rawBytes, external, extraBundleFiles } = await bundlePieceUtils.bundlePiece({ ...paths, repoRoot })

    rewriteManifestForBundle({ distPath, external, repoRoot, extraBundleFiles })
    pruneDistToPublishedFiles({ distPath })

    const ratio = rawBytes > 0 ? (rawBytes / bundleBytes).toFixed(1) : '—'
    const extNote = external.length ? ` external=[${external.join(', ')}]` : ''
    const forkNote = extraBundleFiles.length ? ` forked=[${extraBundleFiles.join(', ')}]` : ''
    console.info(`[preparePiece] bundled ${piecePath} → ${(bundleBytes / 1024).toFixed(0)} KB (${ratio}x smaller than ${(rawBytes / 1024).toFixed(0)} KB raw inputs)${extNote}${forkNote}`)
}

// The published artifact inlines @activepieces/* workspace code AND third-party deps into the
// self-contained bundle by default. Only deps that cannot be safely inlined (native addons,
// dynamic require) stay external and are kept here so the runtime installer resolves them.
// A piece can force a dep external via bundleDeps in its package.json (escape hatch).
function rewriteManifestForBundle({ distPath, external, repoRoot, extraBundleFiles = [] }: { distPath: string, external: string[], repoRoot: string, extraBundleFiles?: string[] }): void {
    const distPackageJsonPath = join(distPath, 'package.json')
    const json = JSON.parse(readFileSync(distPackageJsonPath, 'utf-8'))

    const workspaceVersionMap = buildWorkspaceVersionMap(repoRoot)
    const resolvedDeps = stripSemverRanges(resolveWorkspaceDependencies(json.dependencies ?? {}, workspaceVersionMap)) ?? {}

    const externalDeps: Record<string, string> = {}
    for (const dep of external) {
        if (bundlePieceUtils.OPTIONAL_EXTERNALS.has(dep)) {
            continue
        }
        const version = resolvedDeps[dep] ?? resolveInstalledVersion({ dep, repoRoot })
        if (version === undefined) {
            throw new Error(`[preparePiece] external dependency "${dep}" has no resolvable version (not a direct dependency and not found under node_modules); publishing it would crash at runtime with a missing module`)
        }
        externalDeps[dep] = version
    }

    json.main = `./${bundlePieceUtils.BUNDLE_FILENAME}`
    json.dependencies = externalDeps
    delete json.devDependencies
    delete json.peerDependencies
    delete json.scripts
    delete json.types
    delete json.bundleDeps
    delete json.bundleForkedEntries
    json.files = [bundlePieceUtils.BUNDLE_FILENAME, ...extraBundleFiles, 'package.json', 'src/i18n']

    writeFileSync(distPackageJsonPath, JSON.stringify(json, null, 2) + '\n')
}

function resolveInstalledVersion({ dep, repoRoot }: { dep: string, repoRoot: string }): string | undefined {
    try {
        const requireFromRoot = createRequire(join(repoRoot, 'package.json'))
        return JSON.parse(readFileSync(requireFromRoot.resolve(`${dep}/package.json`), 'utf-8')).version
    }
    catch {
        return findInstalledVersion({ nodeModulesDir: join(repoRoot, 'node_modules'), dep })
    }
}

function findInstalledVersion({ nodeModulesDir, dep }: { nodeModulesDir: string, dep: string }): string | undefined {
    const relPackageJson = join(...dep.split('/'), 'package.json')
    const stack = [nodeModulesDir]
    while (stack.length > 0) {
        const dir = stack.pop()!
        const candidate = join(dir, relPackageJson)
        if (existsSync(candidate)) {
            return JSON.parse(readFileSync(candidate, 'utf-8')).version
        }
        stack.push(...nestedNodeModules(dir))
    }
    return undefined
}

function nestedNodeModules(nodeModulesDir: string): string[] {
    return safeReaddir(nodeModulesDir).flatMap((name) => {
        const packageDir = join(nodeModulesDir, name)
        const packageDirs = name.startsWith('@')
            ? safeReaddir(packageDir).map((child) => join(packageDir, child))
            : [packageDir]
        return packageDirs.map((d) => join(d, 'node_modules')).filter((nested) => existsSync(nested))
    })
}

function safeReaddir(dir: string): string[] {
    try {
        return readdirSync(dir)
    }
    catch {
        return []
    }
}

// After bundling, dist/ still holds the full tsc output (compiled lib/*, .d.ts, .map). Prune it
// down to EXACTLY what npm would publish — the manifest's `files` allow-list (the self-contained
// bundle + i18n) plus package.json — so `dist/` mirrors the published artifact 1:1.
function pruneDistToPublishedFiles({ distPath }: { distPath: string }): void {
    const json = JSON.parse(readFileSync(join(distPath, 'package.json'), 'utf-8'))
    const entries: string[] = json.files ?? []

    const keepFiles = new Set<string>(['package.json'])
    const keepDirs: string[] = []
    for (const entry of entries) {
        const normalized = entry.replace(/\/$/, '')
        const abs = join(distPath, normalized)
        if (existsSync(abs) && statSync(abs).isDirectory()) {
            keepDirs.push(normalized)
        }
        else {
            keepFiles.add(normalized)
        }
    }

    const toPosix = (p: string): string => p.split('\\').join('/')
    const isKept = (rel: string): boolean =>
        keepFiles.has(rel) || keepDirs.some((dir) => rel === dir || rel.startsWith(`${dir}/`))

    const removeUnpublished = (dir: string): boolean => {
        let empty = true
        for (const name of readdirSync(dir)) {
            const full = join(dir, name)
            if (statSync(full).isDirectory()) {
                const childEmpty = removeUnpublished(full)
                if (childEmpty) {
                    rmSync(full, { recursive: true, force: true })
                }
                else {
                    empty = false
                }
            }
            else if (isKept(toPosix(relative(distPath, full)))) {
                empty = false
            }
            else {
                rmSync(full, { force: true })
            }
        }
        return empty
    }

    removeUnpublished(distPath)
}

export { preparePieceDistForPublish, resolveInstalledVersion, findInstalledVersion, rewriteManifestForBundle }

type PieceDistPaths = {
    piecePath: string
    distPath: string
}

```

### Core Architecture Module: `packages/cli/src/lib/utils/workspace-utils.ts`
```
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

// Walk up from a piece folder to the monorepo root (the package.json that declares
// `workspaces`). Lets bundling run from any cwd — e.g. a per-package turbo task.
export function findRepoRoot(startDir: string): string {
  let dir = startDir
  while (true) {
    const pkgPath = join(dir, 'package.json')
    if (existsSync(pkgPath)) {
      const pkg = JSON.parse(readFileSync(pkgPath).toString())
      if (Array.isArray(pkg.workspaces)) {
        return dir
      }
    }
    const parent = dirname(dir)
    if (parent === dir) {
      throw new Error(`[findRepoRoot] no workspace root found above ${startDir}`)
    }
    dir = parent
  }
}

export function buildWorkspaceVersionMap(rootDir: string): Map<string, string> {
  const versionMap = new Map<string, string>()
  const rootPkg = JSON.parse(readFileSync(join(rootDir, 'package.json')).toString())
  const workspacePatterns: string[] = rootPkg.workspaces ?? []

  for (const pattern of workspacePatterns) {
    if (pattern.endsWith('/*')) {
      const dir = join(rootDir, pattern.slice(0, -2))
      if (!existsSync(dir)) {
        continue
      }
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const pkgPath = join(dir, entry.name, 'package.json')
          if (existsSync(pkgPath)) {
            const pkg = JSON.parse(readFileSync(pkgPath).toString())
            versionMap.set(pkg.name, pkg.version)
          }
        }
      }
    } else {
      const pkgPath = join(rootDir, pattern, 'package.json')
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath).toString())
        versionMap.set(pkg.name, pkg.version)
      }
    }
  }

  return versionMap
}

export function resolveWorkspaceDependencies(
  deps: Record<string, string> | undefined,
  versionMap: Map<string, string>,
): Record<string, string> | undefined {
  if (!deps) {
    return deps
  }
  const resolved: Record<string, string> = {}
  for (const [name, version] of Object.entries(deps)) {
    if (version.startsWith('workspace:')) {
      const resolvedVersion = versionMap.get(name)
      if (resolvedVersion) {
        resolved[name] = resolvedVersion
      } else {
        throw new Error(`Failed to resolve workspace dependency ${name}: ${version}. Package not found in workspace.`)
      }
    } else {
      resolved[name] = version
    }
  }
  return resolved
}

export function isExactVersion(version: string): boolean {
  return /^\d+(\.\d+){0,2}(-[\w.]+)?$/.test(version)
}

export function stripSemverRanges(
  deps: Record<string, string> | undefined,
): Record<string, string> | undefined {
  if (!deps) {
    return deps
  }
  const stripped: Record<string, string> = {}
  for (const [name, version] of Object.entries(deps)) {
    const pinned = version.replace(/^[\^~]/, '')
    if (!isExactVersion(pinned)) {
      throw new Error(`[stripSemverRanges] unsupported version range for ${name}: "${version}"`)
    }
    stripped[name] = pinned
  }
  return stripped
}

```

### Core Architecture Module: `packages/core/ai-providers/src/index.ts`
```
export { createImageModel, createLanguageModel, buildOpenAICompatibleHeaders } from './lib/create-language-model'
export type { CreateImageModelParams, CreateLanguageModelParams, ImageModelOptions, LanguageModelOptions } from './lib/create-language-model'
export { createCloudflareGatewayModel } from './lib/create-cloudflare-gateway-model'
export type { CreateCloudflareGatewayModelParams, CloudflareGatewayMetadata, CloudflareGatewayRouting } from './lib/create-cloudflare-gateway-model'

```

### Core Architecture Module: `packages/core/ai-providers/src/lib/create-cloudflare-gateway-model.ts`
```
import { AiProviderCredentials, AIProviderName, isNil, observedProviderFetch, ProviderOutcomeReporter, spreadIfDefined } from '@activepieces/core-utils'
import { splitCloudflareGatewayModelId } from '@activepieces/core-piece-types'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { ImageModel, LanguageModel } from 'ai'
import { createAiGateway } from 'ai-gateway-provider'

export function createCloudflareGatewayModel(params: CreateCloudflareGatewayModelParams & { isImage: true }): ImageModel
export function createCloudflareGatewayModel(params: CreateCloudflareGatewayModelParams & { isImage?: false }): LanguageModel
export function createCloudflareGatewayModel({ credentials, modelId, isImage = false, openaiResponsesModel = false, routing = 'compat', metadata, onOutcome }: CreateCloudflareGatewayModelParams): ImageModel | LanguageModel {
    const { apiKey } = credentials.auth
    const { vertexProject, vertexRegion } = credentials.config
    const accountId = credentials.config.accountId ?? ''
    const gatewayId = credentials.config.gatewayId ?? ''
    const { provider: providerPrefix, model: actualModelId, publisher } = splitCloudflareGatewayModelId(modelId)
    const headers = {
        'cf-aig-authorization': `Bearer ${apiKey}`,
        ...(isNil(metadata) ? {} : { 'cf-aig-metadata': JSON.stringify(metadata) }),
    }

    if (routing === 'compat') {
        return compatGatewayModel({ accountId, gatewayId, headers, isImage, modelId: actualModelId, onOutcome })
    }

    const aigateway = createAiGateway({ accountId, gateway: gatewayId, apiKey })
    switch (providerPrefix) {
        case 'anthropic':
            return aigateway(createAnthropic({ apiKey: CF_TEMP_TOKEN, headers })(actualModelId))
        case 'google-ai-studio':
            return aigateway(createGoogleGenerativeAI({ apiKey: CF_TEMP_TOKEN, headers })(actualModelId))
        case 'google-vertex-ai': {
            if (isNil(vertexProject) || isNil(vertexRegion) || isNil(publisher)) {
                return compatGatewayModel({ accountId, gatewayId, headers, isImage, modelId })
            }
            return createGoogleGenerativeAI({
                apiKey,
                baseURL: `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/google-vertex-ai/v1/projects/${vertexProject}/locations/${vertexRegion}/publishers/${publisher}/`,
                headers,
            })(actualModelId)
        }
        case 'openai': {
            const openaiProvider = createOpenAI({
                apiKey: NO_KEY_PLACEHOLDER,
                baseURL: `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/openai`,
                headers,
                fetch: stripAuthorizationHeader,
            })
            if (isImage) {
                return openaiProvider.imageModel(actualModelId)
            }
            return openaiResponsesModel ? openaiProvider.responses(actualModelId) : openaiProvider.chat(actualModelId)
        }
        default:
            return compatGatewayModel({ accountId, gatewayId, headers, isImage, modelId })
    }
}

function compatGatewayModel({ accountId, gatewayId, headers, isImage, modelId, onOutcome }: {
    accountId: string
    gatewayId: string
    headers: Record<string, string>
    isImage: boolean
    modelId: string
    onOutcome?: ProviderOutcomeReporter
}): ImageModel | LanguageModel {
    const provider = createOpenAICompatible({
        name: 'cloudflare',
        baseURL: `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewayId}/compat`,
        headers,
        ...spreadIfDefined('fetch', observedProviderFetch(onOutcome)),
    })
    return isImage ? provider.imageModel(modelId) : provider.chatModel(modelId)
}

const stripAuthorizationHeader: typeof globalThis.fetch = (input, init) => {
    const headers = new Headers(init?.headers)
    headers.delete('Authorization')
    return fetch(input, { ...init, headers })
}

const NO_KEY_PLACEHOLDER = 'no-key'
const CF_TEMP_TOKEN = 'CF_TEMP_TOKEN'

export type CloudflareGatewayRouting = 'compat' | 'submodel'

export type CloudflareGatewayMetadata = {
    projectId: string
    flowId: string
    runId: string
}

export type CreateCloudflareGatewayModelParams = {
    credentials: Extract<AiProviderCredentials, { provider: AIProviderName.CLOUDFLARE_GATEWAY }>
    modelId: string
    isImage?: boolean
    openaiResponsesModel?: boolean
    routing?: CloudflareGatewayRouting
    metadata?: CloudflareGatewayMetadata
    onOutcome?: ProviderOutcomeReporter
}

```

### Core Architecture Module: `packages/core/ai-providers/src/lib/create-language-model.ts`
```
import { AiProviderCredentials, AIProviderName, observedProviderFetch, ProviderOutcomeReporter, spreadIfDefined } from '@activepieces/core-utils'
import { OPENAI_COMPATIBLE_VENDOR_BASE_URLS } from '@activepieces/core-piece-types'
import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock'
import { createVertex } from '@ai-sdk/google-vertex'
import { createVertexAnthropic } from '@ai-sdk/google-vertex/anthropic'
import { createVertexMaas } from '@ai-sdk/google-vertex/maas'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createAzure } from '@ai-sdk/azure'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { createOpenRouter, OpenRouterChatSettings } from '@openrouter/ai-sdk-provider'
import { ImageModel, LanguageModel } from 'ai'

const VERTEX_MAAS_SUFFIX = '-maas'
const VERTEX_ANTHROPIC_PREFIX = 'claude'
const MISTRAL_BASE_URL = 'https://api.mistral.ai/v1'
const AUTHORIZATION_HEADER = 'authorization'

export function createLanguageModel({ credentials, modelId, options = {} }: CreateLanguageModelParams): LanguageModel {
    const observed = spreadIfDefined('fetch', observedProviderFetch(options.onOutcome))
    switch (credentials.provider) {
        case AIProviderName.OPENAI: {
            const { apiKey } = credentials.auth
            const client = createOpenAI({ apiKey, ...observed })
            return options.openaiResponsesModel ? client.responses(modelId) : client.chat(modelId)
        }
        case AIProviderName.ANTHROPIC: {
            const { apiKey } = credentials.auth
            return createAnthropic({ apiKey, ...observed })(modelId)
        }
        case AIProviderName.GOOGLE: {
            const { apiKey } = credentials.auth
            return createGoogleGenerativeAI({ apiKey, ...observed })(modelId)
        }
        case AIProviderName.AZURE: {
            const { apiKey } = credentials.auth
            const { resourceName, apiVersion } = credentials.config
            return createAzure({ resourceName, apiKey, apiVersion, ...observed }).chat(modelId)
        }
        case AIProviderName.BEDROCK: {
            const { accessKeyId, secretAccessKey, sessionToken } = credentials.auth
            const { region } = credentials.config
            return createAmazonBedrock({ region, accessKeyId, secretAccessKey, sessionToken, ...observed })(modelId)
        }
        case AIProviderName.VERTEX: {
            const { serviceAccountJson } = credentials.auth
            const { project, region } = credentials.config
            const vertexSettings = { project, location: region, googleAuthOptions: { credentials: parseServiceAccount(serviceAccountJson ?? '') }, ...observed }
            return vertexClientFor({ modelId })(vertexSettings)(modelId)
        }
        case AIProviderName.CUSTOM: {
            const { apiKey } = credentials.auth
            const { apiKeyHeader, baseUrl, defaultHeaders, apiStyle } = credentials.config
            const headers = buildOpenAICompatibleHeaders({ apiKeyHeader: apiKeyHeader ?? AUTHORIZATION_HEADER, apiKey: apiKey ?? '', defaultHeaders, extraHeaders: options.extraHeaders })
            if (apiStyle === 'responses') {
                return createOpenAI({
                    baseURL: baseUrl,
                    apiKey: apiKey ?? '',
                    headers,
                    ...observed,
                    ...spreadIfDefined('fetch', stripDefaultAuthorization({
                        headers,
                        delegate: observedProviderFetch(options.onOutcome),
                    })),
                }).responses(modelId)
            }
            return createOpenAICompatible({
                name: 'openai-compatible',
                baseURL: baseUrl ?? '',
                headers,
                ...observed,
            }).chatModel(modelId)
        }
        case AIProviderName.MISTRAL: {
            const { apiKey } = credentials.auth
            if (options.mistralViaOpenRouter) {
                return createOpenRouterChatModel({ apiKey, modelId, options })
            }
            return createOpenAICompatible({ name: 'mistral', baseURL: MISTRAL_BASE_URL, apiKey: apiKey ?? '', ...observed }).chatModel(modelId)
        }
        case AIProviderName.XAI:
        case AIProviderName.DEEPSEEK:
        case AIProviderName.ZAI:
        case AIProviderName.QWEN:
        case AIProviderName.MINIMAX:
        case AIProviderName.MOONSHOT: {
            const { apiKey } = credentials.auth
            return createOpenAICompatible({
                name: credentials.provider,
                baseURL: OPENAI_COMPATIBLE_VENDOR_BASE_URLS[credentials.provider],
                apiKey: apiKey ?? '',
                ...observed,
            }).chatModel(modelId)
        }
        case AIProviderName.OPENROUTER:
        case AIProviderName.ACTIVEPIECES: {
            const { apiKey } = credentials.auth
            return createOpenRouterChatModel({ apiKey, modelId, options })
        }
        case AIProviderName.CLOUDFLARE_GATEWAY:
            throw new Error('Cloudflare Gateway routing is caller-specific and is not handled by the shared language-model factory')
        default: {
            const exhaustiveCheck: never = credentials
            throw new Error(`Unsupported provider: ${exhaustiveCheck}`)
        }
    }
}

export function createImageModel({ credentials, modelId, options = {} }: CreateImageModelParams): ImageModel | undefined {
    const observed = spreadIfDefined('fetch', observedProviderFetch(options.onOutcome))
    switch (credentials.provider) {
        case AIProviderName.OPENAI: {
            const { apiKey } = credentials.auth
            return createOpenAI({ apiKey, ...observed }).imageModel(modelId)
        }
        case AIProviderName.AZURE: {
            const { apiKey } = credentials.auth
            const { resourceName, apiVersion } = credentials.config
            return createAzure({ resourceName, apiKey, apiVersion, ...observed }).imageModel(modelId)
        }
        case AIProviderName.BEDROCK: {
            const { accessKeyId, secretAccessKey, sessionToken } = credentials.auth
            const { region } = credentials.config
            return createAmazonBedrock({ region, accessKeyId, secretAccessKey, sessionToken, ...observed }).imageModel(modelId)
        }
        case AIProviderName.VERTEX: {
            const { serviceAccountJson } = credentials.auth
            const { project, region } = credentials.config
            return createVertex({ project, location: region, googleAuthOptions: { credentials: parseServiceAccount(serviceAccountJson ?? '') }, ...observed }).imageModel(modelId)
        }
        case AIProviderName.CUSTOM: {
            const { apiKey } = credentials.auth
            const { apiKeyHeader, baseUrl, defaultHeaders } = credentials.config
            return createOpenAICompatible({
                name: 'openai-compatible',
                baseURL: baseUrl ?? '',
                headers: buildOpenAICompatibleHeaders({ apiKeyHeader: apiKeyHeader ?? AUTHORIZATION_HEADER, apiKey: apiKey ?? '', defaultHeaders, extraHeaders: options.extraHeaders }),
                ...observed,
            }).imageModel(modelId)
        }
        default:
            return undefined
    }
}

function vertexClientFor({ modelId }: { modelId: string }): typeof createVertex | typeof createVertexAnthropic | typeof createVertexMaas {
    if (modelId.includes('/') || modelId.endsWith(VERTEX_MAAS_SUFFIX)) {
        return createVertexMaas
    }
    if (modelId.toLowerCase().startsWith(VERTEX_ANTHROPIC_PREFIX)) {
        return createVertexAnthropic
    }
    return createVertex
}

function parseServiceAccount(serviceAccountJson: string): { client_email?: string, private_key?: string } {
    const parsed: unknown = JSON.parse(serviceAccountJson)
    const fields: Record<string, unknown> = typeof parsed === 'object' && parsed !== null ? { ...parsed } : {}
    const clientEmail = fields['client_email']
    const privateKey = fields['private_key']
    return {
        client_email: typeof clientEmail === 'string' ? clientEmail : undefined,
        private_key: typeof privateKey === 'string' ? privateKey.replace(/\\n/g, '\n') : undefined,
    }
}

function stripDefaultAuthorization({ headers, delegate }: {
    headers: Record<string, string>
    delegate?: typeof globalThis.fetch
}): typeof globalThis.fetch | undefined {
    const carriesAuthorization = Object.keys(headers).some((key) => key.trim().toLowerCase() === AUTHORIZATION_HEADER)
    if (carriesAuthorization) {
        return undefined
    }
    return (input, init) => {
        const sent = new Headers(init?.headers)
        sent.delete(AUTHORIZATION_HEADER)
        return (delegate ?? globalThis.fetch)(input, { ...init, headers: sent })
    }
}

function createOpenRouterChatModel({ apiKey, modelId, options }: {
    apiKey: string | undefined
    modelId: string
    options: LanguageModelOptions
}): LanguageModel {
    return createOpenRouter({
        apiKey: apiKey ?? '',
        ...spreadIfDefined('headers', options.extraHeaders),
        ...spreadIfDefined('fetch', observedProviderFetch(options.onOutcome)),
    }).chat(modelId, options.openRouterSettings) as LanguageModel
}

export function buildOpenAICompatibleHeaders({ apiKeyHeader, apiKey, defaultHeaders, extraHeaders }: {
    apiKeyHeader: string
    apiKey: string
    defaultHeaders?: Record<string, string>
    extraHeaders?: Record<string, string>
}): Record<string, string> {
    return {
        ...(extraHeaders ?? {}),
        ...(defaultHeaders ?? {}),
        [apiKeyHeader]: apiKey,
    }
}

export type LanguageModelOptions = {
    onOutcome?: ProviderOutcomeReporter
    openaiResponsesModel?: boolean
    openRouterSettings?: OpenRouterChatSettings
    mistralViaOpenRouter?: boolean
    extraHeaders?: Record<string, string>
}

export type CreateImageModel
```

### Core Architecture Module: `packages/core/execution/src/index.ts`
```
// @activepieces/core-execution — the execution layer extracted from @activepieces/shared
// (flows, flow-run, engine operations, agents, workers). See SRE-163.

export * from './lib/flows/actions/action'
export * from './lib/flows/operations'
export * from './lib/flows/operations/paste-operations'
export * from './lib/flows/triggers/trigger'
export * from './lib/flows/triggers/trigger-events/trigger-events-dto'
export * from './lib/flows/triggers/trigger-events/trigger-event'
export * from './lib/flows/triggers/trigger-run'
export * from './lib/flows/flow-version'
export * from './lib/flows/flow'
export * from './lib/flows/dto/count-flows-request'
export * from './lib/flows/dto/create-flow-request'
export * from './lib/flows/dto/list-flows-request'
export * from './lib/flows/dto/flow-mcp.requests'
export * from './lib/flows/sample-data'
export * from './lib/flows/folders/folder'
export * from './lib/flows/folders/folder-requests'
export * from './lib/flows/util/flow-structure-util'
export * from './lib/flows/util/flow-piece-util'
export * from './lib/flows/util/flow-canvas-util'
export * from './lib/flows'
export * from './lib/flow-run/dto/list-flow-runs-request'
export * from './lib/flow-run/execution'
export * from './lib/flow-run/flow-run'
export * from './lib/flow-run/test-flow-run-request'
export * from './lib/flow-run/log-serializer'
export * from './lib/flow-run/waitpoint'
export * from './lib/engine'
export * from './lib/engine/rpc'
export * from './lib/workers/agent-events'
export * from './lib/workers/job-data'
export * from './lib/workers/worker-contract'
export * from './lib/workers'
export * from './lib/agents'


```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #15824** (2026-09-26): **[BUG]: :latest Docker tag lags behind actual newest release (stuck at 0.82.0 vs 0.92.0). likely sync-version-to-main PR not merged before release-candidate cut**
  *Symptoms*: edit -- it looks like the continuous delivery yml was taken out of commission a few months ago.  Can you guys delete the :latest tag or mark it depreciated if possible?  that would basically fix the issue.  TYSM.  **Describe the bug** The `activepieces/activepieces:latest` Docker tag is stuck on `0.82.0`, while the GitHub Releases page banner shows `0.91.3` as "Latest" and the actual newest release is `0.92.0` (which `docker-compose.yml` on main already points to). Three different "current versions" depending on where you look.  **To Reproduce** 1. Pull repo with :latest tag, check version of -app and -worker - is `0.82.0` 2. Go to the repo's Releases page main banner - shows "0.91.3 (latest)" 3, Click into the full Releases list: newest is `0.92.0` 4. Compare against `docker-compose.yml` on `main`: pinned to `0.92.0`  **Expected behavior** `:latest` should always match the newest published release (`0.92.0`), and the Releases page banner shouldn't lag behind the actual newest release either  **Screenshots** n/a  **Additional context** looks like the same thing as the mismatch around `0.85.x`  I tried looking at the github actions but there are a lot of workflows in there and I can't tell what's what.
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/activepieces/issue/GIT-1939">GIT-1939</a></p>
  > ### ⚠️COMMENT VISIBILITY WARNING⚠️ Comments on closed issues are hard for our team to see. If this issue is continuing with the latest stable version of Activepieces, please open a new issue that references this one.

- **Issue #14390** (2026-07-27): **[BUG]: piece schedule trigger every-x-minutes publish fail**
  *Symptoms*: **Describe the bug** When adding trigger Scheduler > Every x minute (0.1.18), flow publishing fall in error  ```json {   "standardError": "TypeError: Cannot read properties of undefined (reading 'trim')\n    at split (/usr/src/app/cache/v11/common/main.js:61:3574)\n    at exports2.isValidCron (/usr/src/app/cache/v11/common/main.js:61:3782)\n    at Object.setSchedule (/usr/src/app/cache/v11/common/main.js:240:239304)\n    at Se.onEnable (/usr/src/app/cache/v11/common/node_modules/.bun/@activepieces+piece-schedule@0.1.18/node_modules/@activepieces/piece-schedule/src/index.js:1:92482)\n    at Object.executeTrigger (/usr/src/app/cache/v11/common/main.js:240:240315)\n    at async tryCatch (/usr/src/app/cache/v11/common/main.js:240:69907)\n    at async Object.tryCatchAndThrowOnEngineError (/usr/src/app/cache/v11/common/main.js:240:134620)\n    at async Object.execute (/usr/src/app/cache/v11/common/main.js:317:22386)\n    at async tryCatch (/usr/src/app/cache/v11/common/main.js:240:69907)\n    at async execute2 (/usr/src/app/cache/v11/common/main.js:317:22723)",   "standardOutput": "" } ```  **To Reproduce** Steps to reproduce the behavior: 1. Create a new flow 2. Add trigger Scheduler > Every x minutes 3. Define settings 4. Publish directly 5. Error : Panel open with the error message below  **Screenshots**  <img width="791" height="880" alt="Image" src="https://github.com/user-attachments/assets/d0d5d24f-3a75-4167-8da5-168350634625" />  **Additional context** Add any other context
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/activepieces/issue/GIT-1659">GIT-1659</a></p>
  > This looks already fixed on `main` — posting the trail so it can be closed or reopened with confidence rather than sitting.  The crash is `isValidCron(undefined)`, and on `0.1.18` the trigger passed a cron string while the engine had moved to accepting an interval. **PR #14393 ("fix: git 1630 schedule double fire", merged 2026-07-24, the day after this report)** changed exactly that call:  ```diff    onEnable: async (ctx) => { -    const cronExpression = `*/${ctx.propsValue.minutes} * * * *`;      ctx.setSchedule({ -      cronExpression: cronExpression, -      timezone: 'UTC', +      intervalMs: ctx.propsValue.minutes * 60_000,      }); ```  and `trigger-helper.ts` now takes the interval branch before any cron validation runs:  ```ts setSchedule(request: SetScheduleRequest) {     if ('intervalMs' in request) {          // <- taken now; returns early         ...         return     }     if (!isValidCron(request.cronExpression)) {   // <- where 0.1.18 blew up ```  So the `.trim()` on `un
  > ok, ok, it has been merged 3 days ago, that reassures me because I hadn't seen any mention of it in the issues  Good to know that Jiho, thanks for the feedback, we'll waiting the piece to be updated automatically (on self-hosted instance, it didn't require to upgrade the main instance of Activepieces, pieces will are updated OTH)  We can close this issue for the moment so :)

- **Issue #14308** (2026-07-23): **fix: some telemetry events for billing were not being fired for cloud because it had thousands of platforms**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > <h3>Confidence Score: 5/5</h3>  Safe to merge — the change is additive (new batch/flush loop), errors are handled gracefully, and three new unit tests cover the critical paths.  The logic change is narrow and well-tested: the new outer chunk loop never skips events, the queue size is 2× the batch size so no overflow can occur within a batch, flush failures are swallowed with a warning rather than crashing the job, and the feature doc was updated in the same PR.  No files require special attention.  <h3>Important Files Changed</h3>     | Filename | Overview | |----------|----------| | packages/server/api/src/app/helper/telemetry.utils.ts | Adds `BILLING_EVENTS_FLUSH_BATCH_SIZE`, `BILLING_EVENTS_MAX_QUEUE_SIZE`, and `flushBillingEvents()` to the PostHog wrapper; sets `maxQueueSize` on the shared instance so the queue can hold 2× a single batch without dropping events. | | packages/server/api/src/app/ee/flow-run-tracking/flow-run-tracking-service.ts | Replaces the flat `for…of` loop with 

- **Issue #14111** (2026-07-08): **fix(event-destinations): fire event streaming to internal handler flows on self-hosted instances behind private IPs**
  *Symptoms*: ## Problem  On self-hosted deployments, the event-destination worker POSTs every event to the destination's webhook URL through the SSRF filter (`safeHttp.axios`), which rejects private/loopback/internal IPs. When the destination is a handler flow on the **same instance** (the auto-generated default), the instance's own hostname resolves to a private IP and the POST is blocked. The worker swallowed the failure as `warn` + `OK`, so the handler flow never ran and nothing indicated why.  Confirmed on real traffic on a live self-hosted EE deployment (instance behind an internal load balancer). Ref: Pylon #5036.  ## Fix  - `eventDestinationService.trigger`/`test` now classify each destination URL against the instance's public API origin (exact parsed-origin equality + `/v1/webhooks/` path prefix, reusing the cycle-guard helper). Same-origin handler-flow destinations are dispatched **internally** through `webhookService.handleWebhook` (async `EXECUTE_WEBHOOK` path) instead of an outbound HTTP call back to ourselves; external URLs keep going through the SSRF-protected worker job unchanged. - Internal dispatch is limited to rewrite-safe webhook routes (`''` and `/sync`). `/draft` and `/test` have different version/sample-data semantics and stay on the outbound path. - The destination URL's query params are forwarded on internal dispatch instead of being silently dropped (shared-secret pattern). - The worker now logs delivery failures (transport errors and 4xx/5xx responses) at `error
  **Post-Mortem & Fix Analysis**:
  > <h3>Confidence Score: 5/5</h3>  Safe to merge. The SSRF bypass is tightly scoped to exact origin equality plus the /v1/webhooks/ path prefix, and the internal dispatch path never makes an outbound HTTP call, so no request can escape the SSRF filter.  The classification logic is simple and clearly tested: origin equality check plus a prefix match. The cycle guard correctly carries forward to all same-origin URLs. Error handling is explicit at every branch, and the tests cover internal dispatch, external passthrough, query-param forwarding, the attacker-origin bypass, and the cycle guard across multiple route suffix variants.  No files require special attention.  <h3>Important Files Changed</h3>     | Filename | Overview | |----------|----------| | packages/server/api/src/app/event-destinations/event-destinations.service.ts | Core fix: classifies destinations as internal/external, dispatches same-origin handler-flow URLs through webhookService.handleWebhook instead of an outbound HTTP ca
  > @greptile review
  > <!-- mintlify-preview-comment-activepieces-feature-git-1539 --> Preview deployment for your docs. Learn more about [Mintlify Previews](https://www.mintlify.com/docs/deploy/preview-deployments).  | Project | Status | Preview | Updated (UTC) | |---------|--------|---------|---------------| | [activepieces](https://app.mintlify.com/activepieces/activepieces?section=previews) | 🟢 Ready | [View Preview](https://activepieces-feature-git-1539.mintlify.app) | Jul 8, 2026, 3:00 PM |  💡 **Tip:** Enable [Workflows](https://www.mintlify.com/docs/agent/workflows) to automatically generate PRs for you.

- **Issue #14104** (2026-07-08): **fix(engine): dynamic property slugs with reserved characters break required-field validation**
  *Symptoms*: ## Problem  Fixes GIT-1515 (and GIT-1336, same root cause).  When `Property.DynamicProperties` returns child properties whose slug contains `.` (e.g. `employee.firstName`) — or `[`, `]`, `"`, `'` — the builder shows the field as required-and-empty even after the user types a value, and the step can never be saved.  ## Root cause (verified)  react-hook-form's path parser (`stringToPath`) splits field names on every `.` and `[` and strips `]` and quotes, with no escaping mechanism. So for a dotted child key:  - the zod form schema (`buildSchema`) validates the **flat literal key** `"employee.firstName"`, seeded with `''` - but the `FormField` name `settings.input.<dynProp>.employee.firstName` makes RHF write the typed value into a **nested** object  Validation always sees the empty seed → permanent required error. The dynamic-value toggle (`settings.propertySettings.<childName>`) corrupts `propertySettings` the same way.  ## Fix  Everything funnels through two engine choke points, so the fix lives there and the web layer needs no changes:  1. **`piece-helper.ts` → `executeProps`** — the single place dynamic props are resolved (builder UI, MCP tools, agent tools). Child keys are escaped JSON-Pointer style (`~0`–`~5` for `~ . [ ] " '`), fully reversible for any input. Downstream (RHF paths, zod schema, propertySettings writes) the keys contain no reserved characters, so the form just works. 2. **`props-processor.ts`** — the single place resolved input becomes `propsValue` for act
  **Post-Mortem & Fix Analysis**:
  > <h3>Confidence Score: 4/5</h3>  This is close, but the remaining key-mutation case should be fixed before merging.  - Escaped builder-created keys are restored before pieces consume them. - Literal schema-less dynamic keys that begin with `~ap~` can still be rewritten. - That can make callers and pieces disagree about the actual child slug.  packages/server/engine/src/lib/helper/dynamic-prop-keys.ts  <h3>Important Files Changed</h3>     | Filename | Overview | |----------|----------| | packages/server/engine/src/lib/helper/dynamic-prop-keys.ts | Adds dynamic property key escaping and unescaping, but marker-prefixed literal keys can still be decoded unintentionally. | | packages/server/engine/src/lib/helper/piece-helper.ts | Escapes dynamic property options at the `executeProps` boundary before returning them to callers. | | packages/server/engine/src/lib/variables/props-processor.ts | Restores escaped dynamic input and schema keys before nested processing, while still calling the marke

- **Issue #14103** (2026-07-09): **fix(event-streaming): accept null stepNameToTest so real flow-run events pass schema**
  *Symptoms*: ## Problem  On self-hosted EE, Event Streaming never triggers the handler flow for **real** flow runs. When a real (production) flow finishes, the `flow.run.finished` event is enqueued as an `EVENT_DESTINATION` job, but the job is **dropped at dequeue** (`Failing job with invalid schema as unrecoverable`) *before* the worker runs it — so the handler flow never executes. Silent: no error/toast, dispatch reports success.  The **Test destination** button works because it sends a *mock* event that omits the offending field (`undefined`, not `null`), so it never exercises the bug.  ## Root cause  `FlowRunEventData.flowRun.stepNameToTest` was declared `z.string().optional()`, which accepts `string | undefined` but **rejects `null`**. Every real `FlowRun` carries `stepNameToTest: null` (it's null for all non-test/production runs), so the payload fails `FlowRunEvent` validation, `JobData.safeParse` fails in the job broker, and the job is moved to failed at dequeue. Sibling fields `startTime` / `finishTime` correctly use `.nullish()`; `stepNameToTest` was missed.  ## Fix  One line — make the field null-safe like its siblings, plus the required `@activepieces/shared` patch bump.  Fixes GIT-1543 (ref Pylon #5036, #13632)  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  **Post-Mortem & Fix Analysis**:
  > <h3>Confidence Score: 5/5</h3>  This looks safe to merge.  - No blocking issues found in the changed code.    <h3>Important Files Changed</h3>     | Filename | Overview | |----------|----------| | packages/core/shared/src/lib/ee/audit-events/index.ts | Allows production flow-run events to validate when `stepNameToTest` is `null`. | | packages/server/api/test/integration/cloud/event-destinations/event-destination-trigger.test.ts | Updates event-destination test payloads to match the production flow-run event shape. | | packages/core/shared/package.json | Bumps the shared package patch version. |   <!-- greptile_other_comments_section -->  <sub>Reviews (5): Last reviewed commit: ["Merge branch &#39;main&#39; into fix/git-1543"](https://github.com/activepieces/activepieces/commit/d0188c058a02b5c1e2be549a7af8c410058e9574) | [Re-trigger Greptile](https://app.greptile.com/api/retrigger?id=42563964)</sub>

- **Issue #14100** (2026-07-09): **fix(web): taking over a locked flow or table no longer breaks embedded views**
  *Symptoms*: ## Problem  Clicking **Take Over** on the resource-lock banner called `window.location.reload()` after the force-lock succeeded. A full document reload does not survive **embed mode**: the iframe re-mounts standalone without the embed SDK handshake (the SDK removes its init listener after the first handshake), so it hangs on a blank spinner with no error. Reported via Pylon #5019 and GitHub #13554 (GIT-1529). Present since `0.82.0`.  The reload lived on the take-over path in three places named in the issue: `use-resource-lock.ts` (the shared hook, powering both the builder and tables), the builder banner, and the tables header (plus the tables import dialog).  ## Fix  Refresh the resource **in place** instead of reloading the document — the same end state the reload produced, minus the reload:  - **`use-resource-lock.ts`** — `takeOver` no longer reloads. On a successful force-acquire it clears `lockedBy`, bumps a `lockSession` so the acquire effect re-runs (re-emitting a non-force `LOCK_RESOURCE` over the same socket), and calls an `onTakeOver` callback. The re-acquire is important: the server's `force` acquire does **not** set `socket.data.lockedResourceId`, so this follow-up non-force acquire is what re-registers ownership for disconnect-release — exactly what a fresh page mount used to do. `isOwner` is reset before the session bump so the effect cleanup can't emit a spurious `UNLOCK` that would release the just-taken lock. - **Builder (`use-flow-lock.ts`)** — `onTakeOver` 
  **Post-Mortem & Fix Analysis**:
  > <h3>Confidence Score: 5/5</h3>  Safe to merge — all three reload sites are replaced with embed-compatible in-place refresh, the lock lifecycle invariants are preserved, and the critical paths are mutation-verified by new unit tests.  The change is frontend-only, well-scoped, and every critical line is guarded by a new test that fails if the old reload() behaviour is reintroduced. The isOwner reset before the session bump correctly prevents a spurious UNLOCK from briefly releasing the force-acquired lock. The TableLockProvider hoisting above the remount boundary is both logically sound and directly tested. No server, API, or DB changes are involved.  No files require special attention.  <h3>Important Files Changed</h3>     | Filename | Overview | |----------|----------| | packages/web/src/hooks/use-resource-lock.ts | Core fix: replaces window.location.reload() with a lockSession bump that re-runs the acquire effect; isOwner is reset before the session bump to prevent a spurious UNLOCK d
  > @greptile review

- **Issue #14093** (2026-07-07): **fix(tables): neq filter returns rows with empty/unset cells**
  *Symptoms*: ## Problem  The Tables `neq` filter silently drops rows where the target column is empty or was never filled. Reported case: filtering `converted neq "true"` returned an empty result even though rows existed where `converted` was empty — and empty ≠ `"true"`, so those rows should match.  ## Root cause  Record filtering runs in-memory in `record.service.ts`. A record with **no cell** for the filtered field was special-cased to match only `NOT_EXISTS`:  ```ts const cell = record.cells.find(c => c.fieldId === filter.fieldId) if (!cell) {     return filter.operator === FilterOperator.NOT_EXISTS } ```  So for a never-filled column, `neq` (and `eq`, `co`, …) always returned `false` and the row was excluded — regardless of the actual comparison.  ## Fix  Treat a missing cell as an empty value (`''`, the same sentinel `update` writes via `value: cellData.value ?? ''`) and route it through the normal operator logic. All operators now handle empty/unset columns consistently — `neq "true"` returns the empty rows, while `exists` / `not_exists` still behave correctly since `''` is the empty sentinel.  ## Tests  Added two integration cases to `record.test.ts`: - `NEQ: should match record without a cell for the field` - `NEQ: should match record with empty string cell`  Both pass on CE (`AP_EDITION=ce`); logic is edition-agnostic.
  **Post-Mortem & Fix Analysis**:
  > <h3>Confidence Score: 5/5</h3>  Safe to merge — the change is a minimal, well-reasoned fix to in-memory filter logic with no database or API contract changes.  The two-line core change is logically sound: every filter operator in doesCellValueMatchFilters already handles an empty string correctly (EXISTS → false, NOT_EXISTS → true, NEQ → true when filter value is non-empty, numeric operators → false via NaN). The function signature tightening to Pick<Cell, 'fieldId' | 'value'> is backward-compatible. Feature docs and integration tests are included in the same PR.  No files require special attention.  <h3>Important Files Changed</h3>     | Filename | Overview | |----------|----------| | packages/server/api/src/app/tables/record/record.service.ts | Correctly treats missing cells as empty-string sentinels instead of short-circuiting to false, fixing NEQ/EQ/CO/numeric filters for unset columns; EXISTS and NOT_EXISTS still behave correctly since '' triggers the right branches | | packages/s

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

### Incident Patch 1: `ad4daf10` (2026-10-05)
**Commit Message**: fix(logs): stop the post-emit warning flood and keep late errors (#14955)

**File**: `brain/knowledge/engineering/server-module-anatomy.md` (modified, +1/-0)
```diff
@@ -151,6 +151,7 @@ Verify with `npm run lint-dev` and `npm run test-api`.
 - **`CREATE INDEX CONCURRENTLY IF NOT EXISTS` without a `DROP … IF EXISTS` prelude leaves an INVALID index forever.** A concurrent build that aborts (deadlock, cancelled statement, killed connection) leaves the index behind marked INVALID — maintained on every write, used by no query. TypeORM does not mark the migration complete, so it retries, but the leftover INVALID index *satisfies* `IF NOT EXISTS`, so the retry is a silent no-op and the index never becomes valid. Always lead a concurrent build with `DROP INDEX CONCURRENTLY IF EXISTS "<same name>"`, the way `1821000000000-AddWaitpointSignals` does.
 - **In a `transaction = false` migration, `ALTER TABLE … ADD CONSTRAINT` is the one statement that cannot be made retry-safe by a guard.** PostgreSQL has no `IF NOT EXISTS` for it. Every other statement in such a migration takes `IF NOT EXISTS`/`IF EXISTS`, so the file reads as re-runnable — but with no transaction to roll back, a failure in any *later* statement leaves the constraint in place while TypeORM leaves the migration unrecorded. The retry on next boot dies on `duplicate_object`, and the instance boot-loops. Wrap it in `DO $$ … EXCEPTION WHEN duplicate_object THEN NULL; END $$` or pre-check `pg_constraint`, as `1821000000000-AddWaitpointSignals` does for `waitpoint_signal`'s FK to `waitpoint`.
 - **A wide event keeps an error's `name`, `message` and `stack` — never its `params`.** `wideEvent.error()` hands the error to evlog, which copies those three fields plus a whitelist (`code`, `status*`, `data`, `cause`, `internal`). `ActivepiecesError` puts the useful text in `error.params.reason` and sets `message` to the bare code unless you pass the second constructor argument, so a throw without it logs `SANDBOX_INTERNAL_ERROR` and nothing else — GIT-1885 needed a full reproduction rig to learn the bind was failing `EADDRINUSE`. Whenever the params carry a reason worth reading in production, pass it as the message too: `new ActivepiecesError({ code, params: { reason, ... } }, reason)`.
+- **Anything logged after the wide event is emitted never lands on it, and an `info` line is dropped outright.** The evlog fastify plugin emits on `onResponse`/`onError`, and a worker job emits in its `finally`, but work started inside the request (a `rejectedPromiseHandler` promise, a timer, the custom `errorHandler` on a 500) still sees that sealed event through ALS. `wideEvent.run` marks the event sealed at emit; after that `logger.info` and `wideEvent.set`/`timed` are dropped silently, while `warn`/`error`/`fatal`, `wideEvent.error` and `wideEvent.audit` become standalone events carrying `postEmit: true` and the request's `requestId`. Query `postEmit` in ClickHouse to find the code that outlives its request; if a late line matters, log it before the reply or at `warn`.
 
 - **Concurrency is a per-table decision, and the small table is the one people forget.** `CREATE INDEX` without `CONCURRENTLY` takes a SHARE lock that blocks every INSERT/UPDATE/DELETE on that table for the whole build. `flow_run` gets the concurrent treatment by reflex because it is huge; `waitpoint` gets missed because it is small — but every run that pauses, resumes or finishes writes to it, so blocking it stalls execution instance-wide. Size of the table is not the criterion; write traffic on the critical path is.
 - **Duplicate migration timestamps are safe, not luck.** Several timestamps are shared by two or three files (1787, 1794, 1797, 1798, 1811, 1818, 1819, …). TypeORM sorts `getMigrations()` by parsed timestamp and `Array.prototype.sort` has been spec-stable since ES2019, so ties resolve to array order in `postgres-connection.ts` — the same code on every instance, hence the same order everywhere. Do not add a tie-break scheme. Do keep a real dependency (column → index on that column) on *distinct* timestamps rather than relying on array order to express it.
```

**File**: `packages/server/api/src/app/helper/error-handler.ts` (modified, +6/-1)
```diff
@@ -23,7 +23,12 @@ export const errorHandler = async (
             !error.statusCode ||
       error.statusCode === StatusCodes.INTERNAL_SERVER_ERROR.valueOf()
         ) {
-            exceptionHandler.handle(error, request.log)
+            if (wideEvent.sealed()) {
+                exceptionHandler.captureException(error)
+            }
+            else {
+                exceptionHandler.handle(error, request.log)
+            }
         }
         await reply
             .status(error.statusCode ?? StatusCodes.INTERNAL_SERVER_ERROR)
```

**File**: `packages/server/api/src/app/helper/exception-handler.ts` (modified, +8/-3)
```diff
@@ -25,8 +25,13 @@ export const exceptionHandler = {
     },
     handle: (e: unknown, log: FastifyBaseLogger): void => {
         log.error({ error: e }, 'Unhandled exception')
-        if (sentryInitialized) {
-            Sentry.captureException(e)
-        }
+        captureException(e)
     },
+    captureException,
+}
+
+function captureException(e: unknown): void {
+    if (sentryInitialized) {
+        Sentry.captureException(e)
+    }
 }
```

**File**: `packages/server/api/test/unit/app/helper/error-handler-post-emit.test.ts` (added, +79/-0)
```diff
@@ -0,0 +1,79 @@
+import { apLogger, evlogFastify, useWideEventLogger, wideEvent } from '@activepieces/server-utils'
+import Fastify, { FastifyInstance } from 'fastify'
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
+import { enrichWideEventWithError, errorHandler } from '../../../../src/app/helper/error-handler'
+import { exceptionHandler } from '../../../../src/app/helper/exception-handler'
+
+async function buildApp(): Promise<FastifyInstance> {
+    const app = Fastify()
+    app.setErrorHandler(errorHandler)
+    app.addHook('onError', (_request, _reply, error, done) => {
+        enrichWideEventWithError(error)
+        done()
+    })
+    await app.register(evlogFastify, { exclude: ['/excluded'] })
+    app.addHook('onRequest', (request, _reply, done) => {
+        try {
+            const wide = useWideEventLogger()
+            Object.assign(request, { log: apLogger.create({ bindings: {} }) })
+            wideEvent.run({ logger: wide, fn: () => done() })
+        }
+        catch {
+            done()
+        }
+    })
+    app.get('/boom', async () => {
+        throw new Error('database is down')
+    })
+    app.get('/excluded', async () => {
+        throw new Error('excluded route failed')
+    })
+    return app
+}
+
+function postEmitWarnings(warnSpy: ReturnType<typeof vi.spyOn>): string[] {
+    return warnSpy.mock.calls
+        .map((call) => String(call[0]))
+        .filter((line) => line.includes('called after the wide event was emitted'))
+}
+
+describe('errorHandler after the evlog plugin sealed the wide event', () => {
+    let app: FastifyInstance
+    let warnSpy: ReturnType<typeof vi.spyOn>
+
+    beforeEach(async () => {
+        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
+        vi.spyOn(console, 'error').mockImplementation(() => undefined)
+        vi.spyOn(console, 'info').mockImplementation(() => undefined)
+        vi.spyOn(console, 'log').mockImplementation(() => undefined)
+        app = await buildApp()
+    })
+
+    afterEach(async () => {
+        await app.close()
+        vi.restoreAllMocks()
+    })
+
+    it('reports a 500 to Sentry only, because the wide event already carries the error', async () => {
+        const handleSpy = vi.spyOn(exceptionHandler, 'handle')
+        const captureSpy = vi.spyOn(exceptionHandler, 'captureException')
+
+        const response = await app.inject({ method: 'GET', url: '/boom' })
+
+        expect(response.statusCode).toBe(500)
+        expect(handleSpy).not.toHaveBeenCalled()
+        expect(captureSpy).toHaveBeenCalledTimes(1)
+        expect(postEmitWarnings(warnSpy)).toEqual([])
+    })
+
+    it('still logs a 500 on a route without a wide event', async () => {
+        const handleSpy = vi.spyOn(exceptionHandler, 'handle')
+        const captureSpy = vi.spyOn(exceptionHandler, 'captureException')
+
+        const response = await app.inject({ method: 'GET', url: '/excluded' })
+
+        expect(response.statusCode).toBe(500)
+        expect(handleSpy).toHaveBeenCalledTimes(1)
+        expect(captureSpy).not.toHaveBeenCalled()
+    })
+})
```

**File**: `packages/server/utils/src/ap-logger.ts` (modified, +6/-6)
```diff
@@ -36,7 +36,7 @@ function buildLogger(bindings: Record<string, unknown>): ApLogger {
                 if (wide) {
                     wide.info(message ?? 'log', { ...bindings, ...safeFields })
                 }
-                else {
+                else if (!wideEvent.sealed()) {
                     log.info({ msg: message, ...bindings, ...safeFields })
                 }
             }
@@ -53,7 +53,7 @@ function buildLogger(bindings: Record<string, unknown>): ApLogger {
                     wide.warn(message ?? 'log', { ...bindings, ...safeFields })
                 }
                 else {
-                    log.warn({ msg: message, ...bindings, ...safeFields })
+                    log.warn({ msg: message, ...wideEvent.postEmitContext(), ...bindings, ...safeFields })
                 }
             }
             catch {
@@ -71,10 +71,10 @@ function buildLogger(bindings: Record<string, unknown>): ApLogger {
                 }
                 else {
                     if (err) {
-                        log.error({ msg: message ?? err.message, error: stringifyError(err), ...bindings, ...fields })
+                        log.error({ msg: message ?? err.message, error: stringifyError(err), ...wideEvent.postEmitContext(), ...bindings, ...fields })
                     }
                     else {
-                        log.error({ msg: message, ...bindings, ...fields })
+                        log.error({ msg: message, ...wideEvent.postEmitContext(), ...bindings, ...fields })
                     }
                 }
             }
@@ -91,10 +91,10 @@ function buildLogger(bindings: Record<string, unknown>): ApLogger {
                 }
                 else {
                     if (err) {
-                        log.error({ msg: message ?? err.message, error: stringifyError(err), ...bindings, ...fields })
+                        log.error({ msg: message ?? err.message, error: stringifyError(err), ...wideEvent.postEmitContext(), ...bindings, ...fields })
                     }
                     else {
-                        log.error({ msg: message, ...bindings, ...fields })
+                        log.error({ msg: message, ...wideEvent.postEmitContext(), ...bindings, ...fields })
                     }
                 }
             }
```

**File**: `packages/server/utils/src/wide-event.ts` (modified, +45/-7)
```diff
@@ -1,40 +1,48 @@
 import { toError } from '@activepieces/core-utils'
 import { AsyncLocalStorage } from 'node:async_hooks'
-import { audit as standaloneAudit, AuditInput, RequestLogger, withAuditMethods } from 'evlog'
+import { audit as standaloneAudit, AuditInput, log, RequestLogger, withAuditMethods } from 'evlog'
 
 const als = new AsyncLocalStorage<RequestLogger>()
+const sealedLoggers = new WeakMap<RequestLogger, Record<string, unknown>>()
+const trackedLoggers = new WeakSet<RequestLogger>()
 
 function run<T>({ logger, fn }: { logger: RequestLogger, fn: () => T }): T {
+    trackSeal(logger)
     return als.run(logger, fn)
 }
 
 function set(fields: Record<string, unknown>): void {
-    als.getStore()?.set(fields)
+    current()?.set(fields)
 }
 
 function error(err: unknown): void {
     const store = als.getStore()
     if (!store) return
-    store.error(toError(err))
+    const wrapped = toError(err)
+    if (sealedLoggers.has(store)) {
+        log.error({ msg: wrapped.message, error: `${wrapped.message}\n${wrapped.stack ?? ''}`, ...postEmitContext() })
+        return
+    }
+    store.error(wrapped)
 }
 
 async function timed<T>({ name, fn }: { name: string, fn: () => Promise<T> }): Promise<T> {
     const start = Date.now()
     try {
         const result = await fn()
         const ms = Math.round(Date.now() - start)
-        als.getStore()?.set({ timings: { [`${name}Ms`]: ms } })
+        set({ timings: { [`${name}Ms`]: ms } })
         return result
     }
     catch (err) {
         const ms = Math.round(Date.now() - start)
-        als.getStore()?.set({ timings: { [`${name}Ms`]: ms } })
+        set({ timings: { [`${name}Ms`]: ms } })
         throw err
     }
 }
 
 function audit(input: AuditInput): void {
-    const store = als.getStore()
+    const store = current()
     if (store) {
         withAuditMethods(store).audit(input)
         return
@@ -43,7 +51,35 @@ function audit(input: AuditInput): void {
 }
 
 function current(): RequestLogger | undefined {
-    return als.getStore()
+    const store = als.getStore()
+    if (!store || sealedLoggers.has(store)) {
+        return undefined
+    }
+    return store
+}
+
+function sealed(): boolean {
+    const store = als.getStore()
+    return store !== undefined && sealedLoggers.has(store)
+}
+
+function postEmitContext(): Record<string, unknown> {
+    const store = als.getStore()
+    const context = store ? sealedLoggers.get(store) : undefined
+    return context ? { postEmit: true, ...context } : {}
+}
+
+function trackSeal(logger: RequestLogger): void {
+    if (trackedLoggers.has(logger)) {
+        return
+    }
+    trackedLoggers.add(logger)
+    const originalEmit = logger.emit.bind(logger)
+    logger.emit = (overrides) => {
+        const requestId = logger.getContext()['requestId']
+        sealedLoggers.set(logger, typeof requestId === 'string' ? { requestId } : {})
+        return originalEmit(overrides)
+    }
 }
 
 export const wideEvent = {
@@ -53,4 +89,6 @@ export const wideEvent = {
     timed,
     audit,
     current,
+    sealed,
+    postEmitContext,
 }
```

**File**: `packages/server/utils/test/ap-logger-post-emit.test.ts` (added, +183/-0)
```diff
@@ -0,0 +1,183 @@
+import { createRequestLogger, initLogger } from 'evlog'
+import { evlog as evlogFastify, useLogger } from 'evlog/fastify'
+import Fastify from 'fastify'
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
+import { apLogger } from '../src/ap-logger'
+import { wideEvent } from '../src/wide-event'
+
+function printed(spy: ReturnType<typeof vi.spyOn>): string[] {
+    return spy.mock.calls.map((call) => String(call[0]))
+}
+
+function evlogWarnings(warnSpy: ReturnType<typeof vi.spyOn>): string[] {
+    return printed(warnSpy).filter((line) => line.includes('[evlog]'))
+}
+
+function findLine({ spy, text }: { spy: ReturnType<typeof vi.spyOn>, text: string }): Record<string, unknown> | undefined {
+    const line = printed(spy).find((entry) => entry.includes(text))
+    return line ? JSON.parse(line) : undefined
+}
+
+describe('post-emit logging', () => {
+    let warnSpy: ReturnType<typeof vi.spyOn>
+    let infoSpy: ReturnType<typeof vi.spyOn>
+    let errorSpy: ReturnType<typeof vi.spyOn>
+
+    beforeEach(() => {
+        initLogger({ env: { service: 'post-emit-test' }, pretty: false, redact: false })
+        warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
+        infoSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined)
+        errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
+    })
+
+    afterEach(() => {
+        vi.restoreAllMocks()
+    })
+
+    it('apLogger.info after emit is dropped without a warning or a standalone event', () => {
+        const logger = createRequestLogger({ method: 'GET', path: '/v1/files', requestId: 'req_info1' })
+        wideEvent.run({
+            logger,
+            fn: () => {
+                logger.emit()
+                apLogger.create({}).info({ s3Key: 'project/p1/file' }, 'streaming file to s3')
+            },
+        })
+        expect(evlogWarnings(warnSpy)).toEqual([])
+        expect(printed(infoSpy).filter((line) => line.includes('streaming file to s3'))).toEqual([])
+    })
+
+    it('apLogger.warn after emit becomes a standalone event marked postEmit', () => {
+        const logger = createRequestLogger({ method: 'GET', path: '/v1/files', requestId: 'req_warn1' })
+        wideEvent.run({
+            logger,
+            fn: () => {
+                logger.emit()
+                apLogger.create({}).warn({ s3Key: 'project/p1/file' }, 'objectExists check failed')
+            },
+        })
+        expect(evlogWarnings(warnSpy)).toEqual([])
+        expect(findLine({ spy: warnSpy, text: 'objectExists check failed' })).toMatchObject({ s3Key: 'project/p1/file', postEmit: true, requestId: 'req_warn1' })
+    })
+
+    it('apLogger.error after emit becomes a standalone event marked postEmit', () => {
+        const logger = createRequestLogger({ method: 'POST', path: '/v1/files', requestId: 'req_err1' })
+        wideEvent.run({
+            logger,
+            fn: () => {
+                logger.emit()
+                apLogger.create({ bindings: { route: '/v1/files' } }).error({ error: new Error('boom') }, 'failed to stream file to s3')
+            },
+        })
+        expect(evlogWarnings(warnSpy)).toEqual([])
+        expect(findLine({ spy: errorSpy, text: 'failed to stream file to s3' })).toMatchObject({ route: '/v1/files', postEmit: true, requestId: 'req_err1' })
+    })
+
+    it('apLogger.info outside any wide event still logs standalone without the postEmit marker', () => {
+        apLogger.create({}).info({ step: 'boot' }, 'server started')
+        const line = findLine({ spy: infoSpy, text: 'server started' })
+        expect(line).toMatchObject({ step: 'boot' })
+        expect(line).not.toHaveProperty('postEmit')
+    })
+
+    it('wideEvent.set after emit is silently skipped', () => {
+        const logger = createRequestLogger({ method: 'GET', path: '/v1/webhooks', requestId: 'req_set1' })
+        wideEvent.run({
+            logger,
+            fn: () => {
+                logger.emit()
+                wideEvent.set({ outcome: 'late' })
+            },
+        })
+        expect(evlogWarnings(warnSpy)).toEqual([])
+    })
+
+    it('wideEvent.error after emit becomes a standalone event and keeps a non-Error payload readable', () => {
+        const logger = createRequestLogger({ method: 'GET', path: '/v1/runs', requestId: 'req_werr' })
+        wideEvent.run({
+            logger,
+            fn: () => {
+                logger.emit()
+                wideEvent.error({ code: 'TOOL_FAILED' })
+            },
+        })
+        expect(evlogWarnings(warnSpy)).toEqual([])
+        expect(findLine({ spy: errorSpy, text: 'TOOL_FAILED' })).toMatchObject({ msg: '{"code":"TOOL_FAILED"}', postEmit: true, requestId: 'req_werr' })
+    })
+
+    it('wideEvent.audit after emit is kept as a standalone audit event', () => {
+        const logger = createRequestLogger({ method: 'GET', path: '/v1/connections', requestId: 'req_aud1' })
+    
```

**File**: `packages/server/utils/test/ap-logger.test.ts` (modified, +2/-0)
```diff
@@ -39,6 +39,8 @@ vi.mock('../src/wide-event', () => ({
             }
             : undefined,
         set: spies.wideSetSpy,
+        sealed: () => false,
+        postEmitContext: () => ({}),
     },
 }))
 
```

---

### Incident Patch 2: `90fed1a3` (2026-10-05)
**Commit Message**: fix(builder): opening an imported step with a missing connection no longer wipes its values (#16131)

**File**: `brain/knowledge/flows-execution/templates.md` (modified, +1/-0)
```diff
@@ -23,6 +23,7 @@ Templates are a library of reusable flow (and table) blueprints users can browse
 - OFFICIAL and SHARED templates cannot be updated or deleted via API; ownership is double-checked (`template.platformId === principal.platform.id`).
 - Flow version migration (`migrateFlowVersionTemplateList`) runs as a `preValidation` hook on create/update to handle schema evolution in stored flows.
 - `pieces` and `categories` are denormalized + indexed for fast filtering.
+- **A flow export (`GET /v1/flows/:id/template`) keeps its connection refs.** `removeConnectionsFromInput` in `flow-version.service.ts` strips only the old `{{connections.x}}` dot syntax, and the builder has written `{{connections['x']}}` since 2023. Import keeps the ref, so a flow re-imported where a connection with that External ID exists just works, and users rely on it. Fixing the regex is a functional breaking change, not a cleanup (GIT-1957).
 
 - **`POST /v1/templates-telemetry/event` serves two callers, and only one of them is the relay — do not gate it on edition or skip the gate.** It is `securityAccess.public()`, and the local browser posts to it directly for VIEW, INSTALL and EXPLORE_VIEW (`packages/web/src/features/templates/api/templates-telemetry-api.ts`, four call sites); a self-hosted instance *also* posts to Cloud's copy of the same route via `sendToCloud`. Those three event types travel **only** this path, so treating the route as "the relay hop, already consented upstream" silently un-gates them for every opted-out self-hoster. The controller therefore resolves `platformUtils.getPlatformIdForRequest` and the service gates on that platform's row when one resolves; a null platform means the genuine relay case (a Cloud request with no principal, whose `projectId`/`templateId` belong to the sending deployment's database) and is forwarded. ACTIVATE/DEACTIVATE come from `trigger-source-service` with a real `projectId` and are gated through the project. Also note `sendToCloud`/`sendToInternal` use raw `fetch`, not `safeHttp`/`apAxios` — pre-existing, and only sound because both URLs are hardcoded.
 
```

**File**: `brain/knowledge/pieces-engine/pieces.md` (modified, +1/-1)
```diff
@@ -30,7 +30,7 @@ The metadata catalog of automation integrations ("pieces") — each a named inte
 - `DynamicPropertiesContext` tracks loading by property name only, so two in-flight requests for the same property let the first completion clear the flag for both — briefly re-enabling Test Step while the value is still cleared.
 - **`POST /v1/pieces/options` cost scales with the whole flow's sample data, not with the property being resolved.** The handler builds an `EXECUTE_PROPERTY` job whose payload carries `sampleData` — and `getSampleDataForFlow` reads *every* step's sample-data `file` row. That payload then crosses Postgres → API → Redis → worker → engine socket, so a big flow pays megabytes to resolve a trivial resolver like the HTTP piece's `authFields`: measured 7.3 MB on a 25-step flow, and a panel open fires three of these in parallel (GIT-1822). The engine only uses `sampleData` to seed step outputs so `{{step.x}}` inside the property's `input` resolves, so callers must use `getSampleDataReferencedBy` and pass the request `input` — which narrows the read to the steps that input names. When narrowing, a referenced `LOOP_ON_ITEMS` step also needs whatever its `items` expression references: `stateFromFlowVersion` derives a loop's `item` by resolving its settings against the context built so far, never from `sampleData[loopName]`. Matching step names as substrings of the serialized input over-approximates, which is the safe direction — a step reference always spells the name literally, in both the property-path and script branches of `props-resolver`.
 - **There is no static signal for whether a DynamicProperties resolver is pure, so caching its result is never safe by inspection.** Both tempting heuristics have counterexamples in this repo. "Trivial resolver" fails because purity cannot be read off the declaration; "declares no connection" fails because `packages/pieces/core/tables` `update-record` declares `auth: PieceAuth.None()` yet its `values` resolver calls `tablesCommon.createFieldProperties` → `getTableFields`, a live request to `v1/fields` authenticated with the **engine token** rather than a connection — so a column added to an Activepieces Table would not show up. Third-party resolvers that fetch live schema (Zendesk `userFieldsDynamicProp`, Supabase `table_columns`) are the same class reached through a connection. The failure mode is a silently outdated form, which the builder gives the user no way to refresh. Anything in this area (GIT-813) needs either a purity signal the piece declares, or stale-while-revalidate that always refetches and corrects within a round trip — and note that SWR re-applies the schema a second time, which is exactly the path the `lastKnownValue` snapshot above exists to protect.
-- **The frontend `POST /v1/pieces/options` client only rejects for DYNAMIC.** `piecesApi.options` (`packages/web/src/features/pieces/api/`) catches DROPDOWN failures, toasts, and *resolves* with a disabled-dropdown fallback — so for dropdowns every error path wired onto that mutation is dead: `usePieceOptions`' `onError` handlers, its `retry: 1`, and the `if (error) throw error` into `DynamicPropertiesErrorBoundary`. DYNAMIC must rethrow: a swallowed failure arrives as a *successful* empty schema, which resets the property's children to defaults and gets persisted by step-settings autosave.
+- **The frontend `POST /v1/pieces/options` client only rejects for DYNAMIC.** `piecesApi.options` (`packages/web/src/features/pieces/api/`) catches DROPDOWN failures, toasts, and *resolves* with a disabled-dropdown fallback — so for dropdowns every error path wired onto that mutation is dead: `usePieceOptions`' `onError` handlers, its `retry: 1`, and the `if (error) throw error` into `DynamicPropertiesErrorBoundary`. DYNAMIC must rethrow: a swallowed failure arrives as a *successful* empty schema, which resets the property's children to defaults and gets persisted by step-settings autosave. The engine swallows failures too: `executeProps` turns any non-engine error (a missing or revoked connection, a resolver that throws) into the disabled-dropdown placeholder with status OK, and an `INTERNAL_ERROR` job comes back as a 200 with an empty body. So for DYNAMIC the client also rejects any response whose `options` is not a property map; an empty map `{}` is valid (GIT-1957).
 - **An action that can be called as an MCP tool cannot create a waitpoint.** An MCP piece tool runs the
   real action through `actionRunService`, which sets `actionRunMode` on the engine, and
   `createWaitpoint` / `waitForWaitpoint` both throw `assertActionRunCannotSuspend` there. So an action
```

**File**: `packages/web/public/locales/en/translation.json` (modified, +1/-0)
```diff
@@ -1,4 +1,5 @@
 {
+  "Connection not found": "Connection not found",
   "You must include these actions to publish.": "You must include these actions to publish.",
   "You must include one of these actions to publish.": "You must include one of these actions to publish.",
   "At least one": "At least one",
```

**File**: `packages/web/src/app/builder/piece-properties/dynamic-piece-property.tsx` (modified, +0/-2)
```diff
@@ -11,7 +11,6 @@ import { useDeepCompareEffectNoCheck } from 'use-deep-compare-effect';
 
 import { useBuilderStateContext } from '@/app/builder/builder-hooks';
 import { SkeletonList } from '@/components/ui/skeleton';
-import { internalErrorToast } from '@/components/ui/sonner';
 import { piecesHooks, formUtils } from '@/features/pieces';
 import { authenticationSession } from '@/lib/authentication-session';
 
@@ -78,7 +77,6 @@ const DynamicPropertiesImplementation = React.memo(
         },
         onError: (error) => {
           console.error(error);
-          internalErrorToast();
           propertyLoadingFinished(props.propertyName);
         },
         onSuccess: () => {
```

**File**: `packages/web/src/app/builder/step-settings/piece-settings/connection-select.tsx` (modified, +34/-25)
```diff
@@ -222,31 +222,10 @@ function ConnectionSelect(params: ConnectionSelectProps) {
                         placeholder={t('Select a connection')}
                         data-testid="select-connection-value"
                       >
-                        {!isNil(field.value) &&
-                        !isNil(
-                          connections?.data?.find(
-                            (connection) =>
-                              connection.externalId ===
-                              removeBrackets(field.value),
-                          ),
-                        ) ? (
-                          <div className="truncate grow shrink flex items-center gap-2">
-                            {connections?.data?.find(
-                              (connection) =>
-                                connection.externalId ===
-                                removeBrackets(field.value),
-                            )?.scope === AppConnectionScope.PLATFORM && (
-                              <Globe size={16} className="shrink-0" />
-                            )}
-                            {
-                              connections?.data?.find(
-                                (connection) =>
-                                  connection.externalId ===
-                                  removeBrackets(field.value),
-                              )?.displayName
-                            }
-                          </div>
-                        ) : null}
+                        <SelectedConnectionLabel
+                          value={field.value}
+                          connections={connections?.data ?? []}
+                        />
                       </SelectValue>
                       <div className="grow"></div>
                       {field.value &&
@@ -377,6 +356,36 @@ function removeBrackets(str: string | undefined) {
     (_, connectionName) => connectionName,
   );
 }
+function SelectedConnectionLabel({
+  value,
+  connections,
+}: {
+  value: string | undefined;
+  connections: AppConnectionWithoutSensitiveData[];
+}) {
+  if (isNil(value) || value === '') {
+    return null;
+  }
+  const connection = connections.find(
+    (connection) => connection.externalId === removeBrackets(value),
+  );
+  if (isNil(connection)) {
+    return (
+      <div className="truncate grow shrink flex items-center gap-2 text-gray-11">
+        <Unplug size={16} className="shrink-0 text-danger-11" />
+        {t('Connection not found')}
+      </div>
+    );
+  }
+  return (
+    <div className="truncate grow shrink flex items-center gap-2">
+      {connection.scope === AppConnectionScope.PLATFORM && (
+        <Globe size={16} className="shrink-0" />
+      )}
+      {connection.displayName}
+    </div>
+  );
+}
 function getConnectionStatusDisplay(status: AppConnectionStatus): {
   Icon: LucideIcon;
   iconClassName: string;
```

**File**: `packages/web/src/features/pieces/api/pieces-api.ts` (modified, +29/-0)
```diff
@@ -44,6 +44,15 @@ export const piecesApi = {
   ): Promise<ExecutePropsResult<T>> {
     return api
       .post<ExecutePropsResult<T>>(`/v1/pieces/options`, request)
+      .then((response) => {
+        if (
+          propertyType === PropertyType.DYNAMIC &&
+          !hasPropertyMapOptions(response)
+        ) {
+          throw new Error('Dynamic properties did not resolve to a schema');
+        }
+        return response;
+      })
       .catch((error) => {
         if (propertyType === PropertyType.DYNAMIC) {
           throw error;
@@ -97,3 +106,23 @@ export const piecesApi = {
     return api.delete(`/v1/pieces/${id}`);
   },
 };
+
+function hasPropertyMapOptions(response: unknown): boolean {
+  if (!isObject(response) || !('options' in response)) {
+    return false;
+  }
+  const { options } = response;
+  return (
+    isObject(options) &&
+    Object.values(options).every(
+      (property) =>
+        isObject(property) &&
+        'type' in property &&
+        typeof property.type === 'string',
+    )
+  );
+}
+
+function isObject(value: unknown): value is object {
+  return typeof value === 'object' && value !== null && !Array.isArray(value);
+}
```

**File**: `packages/web/test/features/pieces/pieces-api.test.ts` (modified, +58/-0)
```diff
@@ -31,6 +31,64 @@ describe('piecesApi.options', () => {
     ).rejects.toBe(failure);
   });
 
+  it('rejects for DYNAMIC when the engine answers with the dropdown placeholder', async () => {
+    post.mockResolvedValue({
+      type: PropertyType.DYNAMIC,
+      options: {
+        disabled: true,
+        options: [],
+        placeholder: 'Throws an error, reconnect or refresh the page',
+      },
+    });
+
+    await expect(
+      piecesApi.options(request, PropertyType.DYNAMIC),
+    ).rejects.toThrow();
+  });
+
+  it('rejects for DYNAMIC when the engine answers with an empty body', async () => {
+    post.mockResolvedValue('');
+
+    await expect(
+      piecesApi.options(request, PropertyType.DYNAMIC),
+    ).rejects.toThrow();
+  });
+
+  it('resolves for DYNAMIC when the engine answers with a property map', async () => {
+    const response = {
+      type: PropertyType.DYNAMIC,
+      options: {
+        url: { type: PropertyType.SHORT_TEXT, displayName: 'URL' },
+      },
+    };
+    post.mockResolvedValue(response);
+
+    await expect(
+      piecesApi.options(request, PropertyType.DYNAMIC),
+    ).resolves.toBe(response);
+  });
+
+  it('resolves for DYNAMIC when the engine answers with an empty property map', async () => {
+    const response = { type: PropertyType.DYNAMIC, options: {} };
+    post.mockResolvedValue(response);
+
+    await expect(
+      piecesApi.options(request, PropertyType.DYNAMIC),
+    ).resolves.toBe(response);
+  });
+
+  it('resolves the engine placeholder unchanged for DROPDOWN', async () => {
+    const response = {
+      type: PropertyType.DROPDOWN,
+      options: { disabled: true, options: [], placeholder: 'reconnect' },
+    };
+    post.mockResolvedValue(response);
+
+    await expect(
+      piecesApi.options(request, PropertyType.DROPDOWN),
+    ).resolves.toBe(response);
+  });
+
   it('resolves a disabled dropdown state for DROPDOWN', async () => {
     post.mockRejectedValue(new Error('boom'));
 
```

---

### Incident Patch 3: `b6f58a98` (2026-10-05)
**Commit Message**: fix(web): keep focus rings and the running status neutral instead of brand-coloured (#16117)

**File**: `brain/knowledge/design-system/colour.md` (modified, +4/-1)
```diff
@@ -30,7 +30,7 @@ Five scales of twelve steps, plus six exceptions. **There is no semantic layer**
 
 Steps **1 and 12 are an inverse pair**: `bg-gray-12 text-gray-1` is a dark chip in light mode and a
 light chip in dark mode, correct in both, with no `dark:`. `inverse`, the focus ring, the canvas and the
-divider need no names: they are `gray-12`, `accent-8`, `gray-2` and `gray-6`. A hover is stronger than
+divider need no names: they are `gray-12`, `gray-8`, `gray-2` and `gray-6`. A hover is stronger than
 the thing it hovers: a row on the page hovers to `gray-3` or `gray-4`, a `gray-3` component to `gray-4`. A
 chip inside a row that hovers or selects sits on `gray-5`, so neither state swallows it.
 
@@ -187,6 +187,9 @@ the wrapper clips) and `imageClassName` the image. On failure it renders a monog
 - **An invalid field's border is `danger-9`** (`aria-invalid:` in the primitives). Step 8 falls under 3:1 on
   the light page, and an error has to read at least as strongly as the default border. Banners and badges
   keep their step-7 frame.
+- **The focus ring is neutral: `ring-gray-8` / `border-gray-8`, never `accent-8`.** Embedded tenants see
+  their brand on every focused control otherwise. A ring that marks a brand-coloured selection (the active
+  OTP cell) may stay on the accent scale.
 - **A selected item's border is on the accent scale** (`accent-7` to `accent-9`); a neutral selection (a
   filter chip, an inverse `gray-12` box) stays neutral. Other borders stay on 6–8.
 - **The stock Tailwind palette still resolves.** Not using it is a convention, not a build error.
```

**File**: `packages/web/src/app/builder/data-selector/data-selector-size-togglers.tsx` (modified, +2/-1)
```diff
@@ -30,7 +30,8 @@ export const DataSelectorSizeTogglers = ({
   };
 
   const buttonClassName = (btnState: DataSelectorSizeState) =>
-    cn('', {
+    cn('text-gray-11 enabled:hover:text-gray-12', {
+      'text-gray-12': state === btnState,
       'opacity-50': state !== btnState,
     });
 
```

**File**: `packages/web/src/app/builder/piece-properties/date-range-property.tsx` (modified, +1/-1)
```diff
@@ -59,7 +59,7 @@ function DateRangeProperty({
                 aria-pressed={selected}
                 onClick={() => selectPreset(option.value)}
                 className={cn(
-                  'rounded-full border px-3 py-1 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent-8/50',
+                  'rounded-full border px-3 py-1 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-gray-8/50',
                   selected
                     ? 'border-accent-9 bg-accent-3 text-accent-11'
                     : 'border-gray-6 text-gray-11 hover:text-gray-12',
```

**File**: `packages/web/src/app/builder/piece-properties/filter-builder-layout.tsx` (modified, +3/-3)
```diff
@@ -222,7 +222,7 @@ function FilterRow({
         aria-label={t('Remove filter')}
         disabled={disabled}
         onClick={onRemove}
-        className="flex h-[38px] w-[30px] shrink-0 items-center justify-center rounded-md text-gray-11 outline-none transition-colors hover:text-gray-12 focus-visible:ring-2 focus-visible:ring-accent-8/50 disabled:pointer-events-none disabled:opacity-50"
+        className="flex h-[38px] w-[30px] shrink-0 items-center justify-center rounded-md text-gray-11 outline-none transition-colors hover:text-gray-12 focus-visible:ring-2 focus-visible:ring-gray-8/50 disabled:pointer-events-none disabled:opacity-50"
       >
         <X className="size-4" />
       </button>
@@ -283,7 +283,7 @@ function AddFilterPopover({
           <button
             type="button"
             disabled={disabled}
-            className="flex w-full items-center justify-center gap-2 rounded-[11px] border-[1.5px] border-dashed border-accent-6 bg-accent-3 py-[13px] text-sm font-semibold text-accent-11 outline-none transition-colors hover:bg-accent-4 focus-visible:ring-2 focus-visible:ring-accent-8/50 disabled:pointer-events-none disabled:opacity-50"
+            className="flex w-full items-center justify-center gap-2 rounded-[11px] border-[1.5px] border-dashed border-accent-6 bg-accent-3 py-[13px] text-sm font-semibold text-accent-11 outline-none transition-colors hover:bg-accent-4 focus-visible:ring-2 focus-visible:ring-gray-8/50 disabled:pointer-events-none disabled:opacity-50"
           >
             <Plus className="size-4" />
             {t('Add filter')}
@@ -292,7 +292,7 @@ function AddFilterPopover({
           <button
             type="button"
             disabled={disabled}
-            className="flex items-center gap-2 rounded-[9px] border border-gray-6 bg-gray-1 px-3.5 py-2 text-sm font-semibold text-accent-11 outline-none transition-colors hover:bg-accent-3 focus-visible:ring-2 focus-visible:ring-accent-8/50 disabled:pointer-events-none disabled:opacity-50"
+            className="flex items-center gap-2 rounded-[9px] border border-gray-6 bg-gray-1 px-3.5 py-2 text-sm font-semibold text-accent-11 outline-none transition-colors hover:bg-accent-3 focus-visible:ring-2 focus-visible:ring-gray-8/50 disabled:pointer-events-none disabled:opacity-50"
           >
             <Plus className="size-4" />
             {t('Add filter')}
```

**File**: `packages/web/src/app/builder/piece-properties/filter-layout.tsx` (modified, +1/-1)
```diff
@@ -265,7 +265,7 @@ function FilterSummary({
                 aria-label={t('Remove')}
                 disabled={disabled}
                 onClick={() => clearOne(name, property)}
-                className="shrink-0 rounded-full p-0.5 text-accent-11/70 outline-none transition-colors hover:text-accent-11 focus-visible:ring-2 focus-visible:ring-accent-8/50 disabled:pointer-events-none disabled:opacity-50"
+                className="shrink-0 rounded-full p-0.5 text-accent-11/70 outline-none transition-colors hover:text-accent-11 focus-visible:ring-2 focus-visible:ring-gray-8/50 disabled:pointer-events-none disabled:opacity-50"
               >
                 <X className="size-3" />
               </button>
```

**File**: `packages/web/src/app/builder/piece-properties/mention-chips-input.tsx` (modified, +3/-3)
```diff
@@ -168,7 +168,7 @@ function MentionChipsInput({
               'inline-flex max-w-full items-start gap-1 rounded-md bg-gray-3 py-0.5 pl-2.5 pr-1 text-sm outline-none transition-colors',
               disabled
                 ? 'cursor-default'
-                : 'cursor-pointer hover:bg-gray-3/70 focus-visible:ring-2 focus-visible:ring-accent-8/50',
+                : 'cursor-pointer hover:bg-gray-3/70 focus-visible:ring-2 focus-visible:ring-gray-8/50',
               {
                 'bg-danger-3 text-danger-11 hover:bg-danger-4': invalid,
               },
@@ -189,7 +189,7 @@ function MentionChipsInput({
                 type="button"
                 aria-label={t('Remove')}
                 className={cn(
-                  'shrink-0 rounded-full px-1 py-0.5 text-gray-11 outline-none transition-colors hover:text-gray-12 focus-visible:ring-2 focus-visible:ring-accent-8/50',
+                  'shrink-0 rounded-full px-1 py-0.5 text-gray-11 outline-none transition-colors hover:text-gray-12 focus-visible:ring-2 focus-visible:ring-gray-8/50',
                   { 'text-danger-11/70 hover:text-danger-11': invalid },
                 )}
                 onClick={(event) => {
@@ -206,7 +206,7 @@ function MentionChipsInput({
 
       {!disabled && (
         <div
-          className="min-w-[140px] flex-1 rounded-sm focus-within:ring-2 focus-within:ring-accent-8/50"
+          className="min-w-[140px] flex-1 rounded-sm focus-within:ring-2 focus-within:ring-gray-8/50"
           onKeyDownCapture={handleKeyDownCapture}
           onPasteCapture={handlePasteCapture}
           onBlur={handleComposeBlur}
```

**File**: `packages/web/src/app/builder/piece-properties/number-stepper.tsx` (modified, +1/-1)
```diff
@@ -3,7 +3,7 @@ import { Minus, Plus } from 'lucide-react';
 import React from 'react';
 
 const buttonClass =
-  'flex size-8 items-center justify-center text-gray-11 outline-none transition-colors hover:bg-gray-4 hover:text-gray-12 disabled:pointer-events-none disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-accent-8/50';
+  'flex size-8 items-center justify-center text-gray-11 outline-none transition-colors hover:bg-gray-4 hover:text-gray-12 disabled:pointer-events-none disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-gray-8/50';
 
 function NumberStepper({
   value,
```

**File**: `packages/web/src/app/builder/piece-properties/property-group-tabs.tsx` (modified, +1/-1)
```diff
@@ -189,7 +189,7 @@ function PropertyGroupTabs({
                   disabled={disabled}
                   aria-invalid={hasError}
                   className={cn(
-                    'relative z-10 flex-1 gap-1.5 rounded-sm px-2 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-accent-8/50 data-[state=active]:bg-transparent data-[state=active]:shadow-none',
+                    'relative z-10 flex-1 gap-1.5 rounded-sm px-2 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-gray-8/50 data-[state=active]:bg-transparent data-[state=active]:shadow-none',
                     hasError
                       ? 'text-danger-11 data-[state=active]:text-danger-11'
                       : 'text-gray-11 hover:text-gray-12 data-[state=active]:text-gray-12',
```

---

### Incident Patch 4: `fe3c8608` (2026-10-05)
**Commit Message**: fix(chat): chat-built steps run their dynamic fields with real values (#16120)

**File**: `brain/knowledge/flows-execution/chat.md` (modified, +1/-0)
```diff
@@ -53,6 +53,7 @@ A turn is kept alive / reclaimed by three separate mechanisms in `execute-agent-
 - **The context budget subtracts what the request reserves.** Anthropic/OpenRouter count tool schemas and the reserved `max_tokens` against the 200k window, so `getAgentConfig` passes `reservedTokens` (the clamped output window from `agentAiUtils.affordableOutputTokens`, the same helper the worker uses for `maxOutputTokens`, plus `TOOL_SCHEMA_TOKEN_ESTIMATE = 12_000`) into `agentCompaction`. The threshold, the fit check and the recent window are all measured against `maxContext - reservedTokens`, and the recent window is sized by estimated tokens, not message count. The tool-schema figure is a constant because the tools are built in the worker and the API never sees their definitions. The worker sets `maxOutputTokens` per step in `prepareStep`, so a thinking-disabled step (round one, discovery phase) does not reserve `thinkingBudget`. The system prompt's size is added to the reserve for the window and fit check, and each message is capped at 20k chars in the summary request so the summarizer itself cannot overflow.
 - **A write tool in `BUILD_ONLY_TOOL_NAMES` is only reachable if something flips the phase for it.** The denylist is the consistent home for anything that writes (`ap_create_flow`, `ap_create_table`, `ap_lock_and_publish` are all in it), but the only route out of `discovery` is `ap_set_phase`, whose description tells the model to switch when it starts *building an automation*. A tool for a subject with no build guide and no sibling build-only call, the agent-building tools being the case that found this, becomes invisible in any conversation that never builds a flow: `activeToolsForPhase` filters it out and the prompt names no tool, so the model cannot discover that it exists. Classifying by "does it write" is not enough; check what would actually flip the phase in a conversation about *that* subject. The four agent *write* tools (`ap_create_agent`, `ap_update_agent`, `ap_add_agent_tool`, `ap_remove_agent_tool`) were added to the set and then reverted for exactly this, with a test pinning the choice; `ap_list_agents` is a read and was never in it, so the group is five tools and only four were ever candidates.
 - **Read-only checks don't belong in `BUILD_ONLY_TOOL_NAMES`.** `ap_validate_flow` was in it, so "check that this solution fits together" never saw the tool. The agent inspected flows by hand instead and misread a Call Flow `flowId` (an externalId) as a mismatch with the flow's id. It now stays visible in discovery, like `ap_flow_structure`.
+- **A dynamic property only runs with a saved schema.** The engine processes a `DYNAMIC` prop's sub-fields (JSON parse, numbers, arrays) only from `propertySettings[prop].schema`, which the builder saves when it resolves the prop. Chat tools used to save `propertySettings: {}`, so an advanced-mode Call Flow payload reached the subflow as one string and a live run saved empty fields. `mcpUtils.resolveDynamicPropertySettings` now resolves and saves it on build, add and update.
 - **Capability notes are built where `discoveryOnly` is not known, so a prompt can promise tools the worker has stripped.** `getAgentConfig` composes the system prompt in the api, while `discoveryOnly` rides on the job data; before Aug 2026 it never crossed that boundary. Meanwhile the worker strips image tools, email tools and the agent tools on such a run, so the notes claimed all three. Two of the three had been wrong since long before anyone noticed, because each note computed its own availability term. The flag now travels with the config request and the three notes read one shared `actingRun = !dryRun && !discoveryOnly`. Whenever a tool group is gated on a run mode in the worker, the note that advertises it has to be gated on the same term, in one place.
 - **Tool output can't be trusted to waive a charge.** A user's own MCP server or `ap_run_code` controls its output's top-level keys, and they reach the persisted part unchanged. Chat billing only honours `billedAtCost` from `ap_web_search` and `ap_generate_image`; a new built-in tool that bills at cost must be added to `TOOLS_THAT_BILL_AT_COST` in `chatBilling`.
 - **Credits are checked after every step, not just before the turn.** `runAgentTurn` asks the API (`agentHasCredits`) after each tool step, sending what the turn has used so far (`chatBilling.creditsForTurn`, the same rule end-of-turn billing uses), and stops once the remaining balance no longer covers it. Flat credits are only charged when the turn ends, so without that pending count the balance never moves mid-turn. The check fails open if the RPC errors.
```

**File**: `packages/server/api/src/app/mcp/tools/ap-add-step.ts` (modified, +1/-0)
```diff
@@ -119,6 +119,7 @@ export const apAddStepTool = ({ mcp, userId }: McpToolContext, log: FastifyBaseL
                             if (unknownPropsError) {
                                 return unknownPropsError
                             }
+                            pieceSettings.propertySettings = await mcpUtils.resolveDynamicPropertySettings({ pieceName: versionResult.normalizedPieceName, pieceVersion: versionResult.pieceVersion, componentName: actionName, componentType: 'action', input: resolvedInput, projectId: mcp.projectId, platformId: project.platformId, log })
                         }
                     }
                     skeletonAction = {
```

**File**: `packages/server/api/src/app/mcp/tools/ap-build-flow.ts` (modified, +22/-4)
```diff
@@ -113,7 +113,7 @@ export const apBuildFlowTool = ({ mcp, userId }: McpToolContext, log: FastifyBas
                         pieceVersion: triggerVersionResult.pieceVersion,
                         triggerName: trigger.triggerName,
                         input: triggerInput,
-                        propertySettings: {},
+                        propertySettings: await mcpUtils.resolveDynamicPropertySettings({ pieceName: triggerVersionResult.normalizedPieceName, pieceVersion: triggerVersionResult.pieceVersion, componentName: trigger.triggerName, componentType: 'trigger', input: triggerInput, projectId, platformId, log }),
                     },
                 })
                 let currentFlow = await flowService(log).update({
@@ -152,7 +152,8 @@ export const apBuildFlowTool = ({ mcp, userId }: McpToolContext, log: FastifyBas
                     const stepUnknown = await knownStepInput({ step, pieceName: resolvedPieceName, pieceVersion: resolvedPieceVersion, platformId, log })
                     const rewritten = mcpUtils.rewriteAllReferences({ input: stepUnknown.input, loopItems: step.loopItems, trigger: latestTrigger })
                     const rewrittenStep = { ...step, input: rewritten.input, loopItems: rewritten.loopItems }
-                    const skeleton = buildSkeleton({ step: rewrittenStep, name: stepName, resolvedPieceVersion, resolvedPieceName })
+                    const propertySettings = await stepPropertySettings({ actionName: step.actionName, pieceName: resolvedPieceName, pieceVersion: resolvedPieceVersion, input: { ...(rewritten.input ?? {}), ...(step.auth ? { auth: `{{connections['${step.auth}']}}` } : {}) }, projectId, platformId, log })
+                    const skeleton = buildSkeleton({ step: rewrittenStep, name: stepName, resolvedPieceVersion, resolvedPieceName, propertySettings })
                     const parseResult = UpdateActionRequest.safeParse(skeleton)
                     if (!parseResult.success) {
                         skippedSteps.push(step.displayName)
@@ -227,6 +228,22 @@ export const apBuildFlowTool = ({ mcp, userId }: McpToolContext, log: FastifyBas
     }
 }
 
+async function stepPropertySettings({ actionName, pieceName, pieceVersion, input, projectId, platformId, log }: {
+    actionName: string | undefined
+    pieceName: string | undefined
+    pieceVersion: string | undefined
+    input: Record<string, unknown>
+    projectId: string
+    platformId: string
+    log: FastifyBaseLogger
+}): Promise<Record<string, unknown>> {
+    const isPieceAction = !isNil(pieceName) && !isNil(pieceVersion) && !isNil(actionName)
+    if (!isPieceAction) {
+        return {}
+    }
+    return mcpUtils.resolveDynamicPropertySettings({ pieceName, pieceVersion, componentName: actionName, componentType: 'action', input, projectId, platformId, log })
+}
+
 async function knownStepInput({ step, pieceName, pieceVersion, platformId, log }: {
     step: z.infer<typeof stepSpec>
     pieceName: string | undefined
@@ -242,11 +259,12 @@ async function knownStepInput({ step, pieceName, pieceVersion, platformId, log }
     return mcpUtils.dropUnknownInputProps({ pieceName, pieceVersion, componentName: actionName, componentType: 'action', input: step.input, platformId, log })
 }
 
-function buildSkeleton({ step, name, resolvedPieceVersion, resolvedPieceName }: {
+function buildSkeleton({ step, name, resolvedPieceVersion, resolvedPieceName, propertySettings }: {
     step: z.infer<typeof stepSpec>
     name: string
     resolvedPieceVersion?: string
     resolvedPieceName?: string
+    propertySettings: Record<string, unknown>
 }): Record<string, unknown> {
     const resolvedInput = {
         ...(step.input ?? {}),
@@ -281,7 +299,7 @@ function buildSkeleton({ step, name, resolvedPieceVersion, resolvedPieceName }:
                     pieceVersion: resolvedPieceVersion ?? '',
                     actionName: step.actionName ?? '',
                     input: resolvedInput,
-                    propertySettings: {},
+                    propertySettings,
                     errorHandlingOptions: mcpUtils.buildErrorHandlingOptions({ continueOnFailure: step.continueOnFailure, retryOnFailure: step.retryOnFailure }),
                 },
             }
```

**File**: `packages/server/api/src/app/mcp/tools/ap-update-step.ts` (modified, +1/-0)
```diff
@@ -144,6 +144,7 @@ export const apUpdateStepTool = ({ mcp, userId }: McpToolContext, log: FastifyBa
                         return unknownPropsError
                     }
                     updatedSettings.input = knownInput
+                    updatedSettings.propertySettings = await mcpUtils.resolveDynamicPropertySettings({ pieceName, pieceVersion, componentName: resolvedActionName, componentType: 'action', input: knownInput, propertySettings: currentSettings.propertySettings, changedKeys: Object.keys(callerInput), projectId: mcp.projectId, platformId: project.platformId, log })
                 }
             }
 
```

**File**: `packages/server/api/src/app/mcp/tools/ap-update-trigger.ts` (modified, +1/-1)
```diff
@@ -84,7 +84,7 @@ export const apUpdateTriggerTool = ({ mcp, userId }: McpToolContext, log: Fastif
                     pieceVersion,
                     triggerName,
                     input,
-                    propertySettings: existingPieceSettings?.propertySettings ?? {},
+                    propertySettings: await mcpUtils.resolveDynamicPropertySettings({ pieceName: resolvedPieceName, pieceVersion, componentName: triggerName, componentType: 'trigger', input, propertySettings: existingPieceSettings?.propertySettings, changedKeys: existingPieceSettings?.pieceVersion === pieceVersion ? Object.keys(callerInput) : Object.keys(input), projectId: mcp.projectId, platformId: project.platformId, log }),
                 },
             }
 
```

**File**: `packages/server/api/src/app/mcp/tools/mcp-utils.ts` (modified, +34/-1)
```diff
@@ -1,6 +1,6 @@
 import { isNil, isObject, tryCatch } from '@activepieces/core-utils'
 import { AiMetadata, OutputSchema, OutputSchemaField, PieceMetadataModel, PiecePropertyMap, PropertyType } from '@activepieces/pieces-framework'
-import { BranchOperator, EngineResponse, EngineResponseStatus, flowStructureUtil, McpServerType, McpToolResult, ProjectScopedMcpServer, singleValueConditions, WorkerJobType } from '@activepieces/shared'
+import { BranchOperator, EngineResponse, EngineResponseStatus, flowStructureUtil, McpServerType, McpToolResult, ProjectScopedMcpServer, PropertyExecutionType, PropertySettings, singleValueConditions, WorkerJobType } from '@activepieces/shared'
 import type { BranchedAction, Step } from '@activepieces/shared'
 import { FastifyBaseLogger } from 'fastify'
 import { z } from 'zod'
@@ -714,6 +714,38 @@ async function executePropertyResolution({ pieceName, pieceVersion, actionOrTrig
     return { status: 'failed', message: 'Unrecognized options format' }
 }
 
+async function resolveDynamicPropertySettings({ pieceName, pieceVersion, componentName, componentType, input, propertySettings, changedKeys = [], projectId, platformId, log }: {
+    pieceName: string
+    pieceVersion: string
+    componentName: string
+    componentType: 'action' | 'trigger'
+    input: Record<string, unknown>
+    propertySettings?: unknown
+    changedKeys?: string[]
+    projectId: string
+    platformId: string
+    log: FastifyBaseLogger
+}): Promise<Record<string, PropertySettings>> {
+    const current = z.record(z.string(), PropertySettings).safeParse(propertySettings).data ?? {}
+    const { data: piece } = await tryCatch(() => pieceMetadataService(log).getOrThrow({ platformId, name: pieceName, version: pieceVersion }))
+    const component = isNil(piece) ? undefined : (componentType === 'action' ? piece.actions[componentName] : piece.triggers[componentName])
+    if (isNil(component)) {
+        return current
+    }
+    const needingSchema = Object.entries(component.props).filter(([name, prop]) => {
+        const watchedKeys = [name, ...('refreshers' in prop ? prop.refreshers : [])]
+        const needsSchema = isNil(current[name]?.schema) || watchedKeys.some((key) => changedKeys.includes(key))
+        return prop.type === PropertyType.DYNAMIC && !isNil(input[name]) && needsSchema
+    })
+    const refreshed = await Promise.all(needingSchema.map(async ([name]) => {
+        const type = current[name]?.type ?? PropertyExecutionType.MANUAL
+        const { data: result } = await tryCatch(() => executePropertyResolution({ pieceName, pieceVersion, actionOrTriggerName: componentName, propertyName: name, input, projectId, platformId, log }))
+        const settings: PropertySettings = result?.status === 'dynamic' ? { type, schema: result.props } : { type }
+        return [name, settings] as const
+    }))
+    return { ...current, ...Object.fromEntries(refreshed) }
+}
+
 // Classify an action by how many records it returns, from its name. This is the signal the agent
 // lacks today: it reaches for find_record (one match) when it meant to enumerate, then thrashes on
 // the empty result. 'enumerate' = list/search/plural-find; 'single' = find/get one; 'other' = a write
@@ -847,6 +879,7 @@ export const mcpUtils = {
     rewriteAllReferences,
     extractOptionsArray,
     executePropertyResolution,
+    resolveDynamicPropertySettings,
     RESOLVE_TIMEOUT_MS,
     STEP_REFERENCE_HINT,
     BRANCH_CONDITIONS_INPUT_SCHEMA,
```

**File**: `packages/server/api/src/assets/prompts/guides/build_flow.md` (modified, +1/-1)
```diff
@@ -50,7 +50,7 @@ How to build one:
 2. **Names:** name each flow for its one job, in plain words ("Save order", not "Flow 2" or "Order flow helper").
 3. **Order:** tables first, then subflows, then the flows that call them. Each step needs an id the previous one returned.
 4. **Subflow:** trigger `@activepieces/piece-subflows` `callableFlow`, with `exampleData.sampleData` listing every input it takes, e.g. `{"orderId": "123", "email": "a@b.co"}`. Its steps read each input as `{{trigger['output'].data.<key>}}`, never `{{trigger['output'].<key>}}` (that is empty at run time). Add a `returnResponse` step only if a caller needs data back.
-5. **Caller:** a `callFlow` step with `flowId` set to the subflow's **externalId** (the one `ap_build_flow` returned, not its flow id). Use `mode: "simple"` and send every key of the subflow's sample data in `flowProps.payload` as an object; a JSON-text payload arrives in the subflow as one string. Set `waitForResponse` only when the subflow has a Return Response step.
+5. **Caller:** a `callFlow` step with `flowId` set to the subflow's **externalId** (the one `ap_build_flow` returned, not its flow id). Use `mode: "simple"` and send every key of the subflow's sample data in `flowProps.payload` as an object. Set `waitForResponse` only when the subflow has a Return Response step.
 6. **Tables steps:** `table_id` is the table's **externalId**. Form `values` are keyed by field externalId.
 7. **Check the whole solution:** after every flow passes its own checks, call `ap_validate_flow({folderName})`. Fix each issue it lists and run it again until it returns ✅. Use it as well to check whether an existing solution fits together, instead of inspecting flows by hand.
 8. **Build card:** one card for the whole solution. `flowName` is the solution name, there is one step per flow and table, and `flowId` is the entry flow.
```

**File**: `packages/server/api/test/integration/ce/mcp/mcp-tools.test.ts` (modified, +128/-3)
```diff
@@ -1,8 +1,8 @@
-import { apId } from '@activepieces/core-utils'
-import { FlowActionType, FlowCreatorType, FlowOperationType, FlowRunStatus, flowStructureUtil, FlowTriggerType, McpServerType, PackageType, PieceType, ProjectScopedMcpServer, RunEnvironment, StepLocationRelativeToParent } from '@activepieces/shared'
+import { apId, isObject } from '@activepieces/core-utils'
+import { EngineResponseStatus, FlowActionType, FlowCreatorType, FlowOperationType, FlowRunStatus, flowStructureUtil, FlowTriggerType, McpServerType, PackageType, PieceType, ProjectScopedMcpServer, RunEnvironment, StepLocationRelativeToParent } from '@activepieces/shared'
 import { FastifyBaseLogger, FastifyInstance } from 'fastify'
 import { StatusCodes } from 'http-status-codes'
-import { afterAll, beforeAll, describe, expect, it } from 'vitest'
+import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
 import { z } from 'zod'
 import { flowService } from '../../../../src/app/flows/flow/flow.service'
 import { flowFolderService } from '../../../../src/app/flows/folder/folder.service'
@@ -34,6 +34,7 @@ import { apReadStepSettingsTool } from '../../../../src/app/mcp/tools/ap-read-st
 import { apRunActionTool } from '../../../../src/app/mcp/tools/ap-run-action'
 import { mcpUtils } from '../../../../src/app/mcp/tools/mcp-utils'
 import { tableService } from '../../../../src/app/tables/table/table.service'
+import { userInteractionWatcher } from '../../../../src/app/workers/user-interaction-watcher'
 import { db } from '../../../helpers/db'
 import { createMockPieceMetadata } from '../../../helpers/mocks'
 import { createTestContext } from '../../../helpers/test-context'
@@ -56,6 +57,17 @@ beforeAll(async () => {
         packageType: PackageType.REGISTRY,
         platformId: undefined,
         actions: {
+            send_template: {
+                name: 'send_template',
+                displayName: 'Send Template',
+                description: 'Send an email from a template',
+                requireAuth: false,
+                props: {
+                    template: { type: 'SHORT_TEXT', displayName: 'Template', required: true },
+                    note: { type: 'SHORT_TEXT', displayName: 'Note', required: false },
+                    fields: { type: 'DYNAMIC', displayName: 'Fields', required: true, refreshers: ['template'] },
+                },
+            },
             send_email: {
                 name: 'send_email',
                 displayName: 'Send Email',
@@ -79,6 +91,16 @@ beforeAll(async () => {
                     label: { type: 'SHORT_TEXT', displayName: 'Label', required: false },
                 },
             },
+            new_templated_email: {
+                name: 'new_templated_email',
+                displayName: 'New Templated Email',
+                description: 'Triggers on new email matching a template',
+                requireAuth: false,
+                props: {
+                    template: { type: 'SHORT_TEXT', displayName: 'Template', required: true },
+                    fields: { type: 'DYNAMIC', displayName: 'Fields', required: true, refreshers: ['template'] },
+                },
+            },
             new_labeled_email: {
                 name: 'new_labeled_email',
                 displayName: 'New Labeled Email',
@@ -99,6 +121,7 @@ beforeAll(async () => {
         },
     })
     await db.save('piece_metadata', gmailPiece)
+    await db.save('piece_metadata', { ...gmailPiece, id: apId(), version: '0.0.9' })
 
     const arrayPiece = createMockPieceMetadata({
         name: '@activepieces/piece-test-array',
@@ -2813,4 +2836,106 @@ describe('MCP Tools integration', () => {
         expect(text(triggerUpdate)).not.toContain('Unknown properties')
         expect(updatedFlow.version.trigger.settings.input).toEqual({ folder: 'INBOX', label: 'urgent' })
     })
+
+    it('ap_add_step and ap_update_step save the schema of a dynamic property, so the engine can process its fields', async () => {
+        const ctx = await createTestContext(app)
+        const mcp = makeMcp(ctx.project.id)
+        const schema = { count: { type: 'NUMBER', displayName: 'Count', required: false } }
+        const resolve = vi.spyOn(userInteractionWatcher, 'submitAndWaitForResponse').mockResolvedValue({ status: EngineResponseStatus.OK, response: { options: schema } })
+        const flowId = await createFlowAndGetId(mcp, 'Dynamic schema')
+        await apUpdateTriggerTool({ mcp }, mockLog).execute({ flowId, pieceName: '@activepieces/piece-test-email', triggerName: 'new_email' })
+
+        await apAddStepTool({ mcp }, mockLog).execute({
+            flowId, parentStepName: 'trigger', stepLocationRelativeToParent: StepLocationRelativeToParent.AFTER, stepType: FlowActionType.PIECE, displayName: 'Send',
+            pieceName: '@activepieces/piece-test-email', actionName: 'send_template', input: { template: 'welcome', fields: { count: '3' } },
+        })
+        const afterAdd = resolve
```

---

### Incident Patch 5: `611efc78` (2026-10-05)
**Commit Message**: fix(cli): compile the CLI with strict TypeScript (#16118)

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `bun.lock` (modified, +6/-0)
```diff
@@ -93,6 +93,8 @@
       },
       "devDependencies": {
         "@types/autocannon": "7.12.7",
+        "@types/inquirer": "8.2.13",
+        "@types/jsonwebtoken": "9.0.10",
         "@types/node": "24.11.0",
       },
     },
@@ -14575,6 +14577,8 @@
 
     "@types/http-errors": ["@types/http-errors@2.0.5", "", {}, "sha512-r8Tayk8HJnX0FztbZN7oVqGccWgw98T/0neJphO91KkmOzug1KkofZURD4UaD5uH8AqcFLfdPErnBod0u71/qg=="],
 
+    "@types/inquirer": ["@types/inquirer@8.2.13", "", { "dependencies": { "@types/through": "*", "rxjs": "^7.2.0" } }, "sha512-shSvl3mn4Z8AK627kA1vx8PYkyH6CdIjV5NYYj7a0xIxzmG3ZgzEpzCi3CWfktjAlq+0Z0wHJGtWNiACaYpeOg=="],
+
     "@types/is-url": ["@types/is-url@1.2.32", "", {}, "sha512-46VLdbWI8Sc+hPexQ6NLNR2YpoDyDZIpASHkJQ2Yr+Kf9Giw6LdCTkwOdsnHKPQeh7xTjTmSnxbE8qpxYuCiHA=="],
 
     "@types/js-cookie": ["@types/js-cookie@2.2.7", "", {}, "sha512-aLkWa0C0vO5b4Sr798E26QgOkss68Un0bLjs7u9qxzPT5CG+8DuNTffWES58YzJs3hrVAOs1wonycqEBqNJubA=="],
@@ -14681,6 +14685,8 @@
 
     "@types/symlink-or-copy": ["@types/symlink-or-copy@1.2.2", "", {}, "sha512-MQ1AnmTLOncwEf9IVU+B2e4Hchrku5N67NkgcAHW0p3sdzPe0FNMANxEm6OJUzPniEQGkeT3OROLlCwZJLWFZA=="],
 
+    "@types/through": ["@types/through@0.0.33", "", { "dependencies": { "@types/node": "*" } }, "sha512-HsJ+z3QuETzP3cswwtzt2vEIiHBk/dCcHGhbmG5X3ecnwFD/lPrMpliGXxSCg03L9AhrdwA4Oz/qfspkDW+xGQ=="],
+
     "@types/tinycolor2": ["@types/tinycolor2@1.4.5", "", {}, "sha512-uLJijDHN5E6j5n1qefF9oaeplgszXglWXWTviMoFr/YxgvbyrkFil20yDT7ljhCiTQ/BfCYtxfJS81LdTro5DQ=="],
 
     "@types/tough-cookie": ["@types/tough-cookie@4.0.5", "", {}, "sha512-/Ad8+nIOV7Rl++6f1BdKxFSMgmoqEoYbHRpPcx3JEfv8VRsQe9Z4mCXeJBzxs7mbHY/XOZZuXlRNfhpVPbs6ZA=="],
```

**File**: `packages/cli/package.json` (modified, +2/-0)
```diff
@@ -30,6 +30,8 @@
   },
   "devDependencies": {
     "@types/autocannon": "7.12.7",
+    "@types/inquirer": "8.2.13",
+    "@types/jsonwebtoken": "9.0.10",
     "@types/node": "24.11.0"
   }
 }
```

**File**: `packages/cli/src/lib/commands/build-piece.ts` (modified, +2/-1)
```diff
@@ -1,10 +1,11 @@
 import { Command } from "commander";
-import { buildPiece, findPiece } from '../utils/piece-utils';
+import { assertPieceExists, buildPiece, findPiece } from '../utils/piece-utils';
 import chalk from "chalk";
 import inquirer from "inquirer";
 
 async function buildPieces(pieceName: string) {
     const pieceFolder = await findPiece(pieceName);
+    assertPieceExists(pieceFolder);
     const { outputFolder } = await buildPiece(pieceFolder);
     console.info(chalk.green(`Piece '${pieceName}' built and packed successfully at ${outputFolder}.`));
 }
```

**File**: `packages/cli/src/lib/commands/generate-translation-file-for-piece.ts` (modified, +4/-3)
```diff
@@ -1,9 +1,9 @@
 import { writeFile } from 'node:fs/promises';
 import chalk from 'chalk';
 import { Command } from 'commander';
-import { buildPackage, findPiece, findPieces } from '../utils/piece-utils';
+import { assertPieceExists, buildPackage, findPiece, findPieces } from '../utils/piece-utils';
 import { makeFolderRecursive, readPackageJson } from '../utils/files';
-import { join } from 'node:path';
+import { basename, join } from 'node:path';
 import { exec } from '../utils/exec';
 import { pieceTranslation } from '@activepieces/pieces-framework';
 import { MAX_KEY_LENGTH_FOR_CORWDIN } from '@activepieces/shared';
@@ -66,6 +66,7 @@ const generateTranslationFileFromPiece = (piece: Record<string, unknown>) => { c
 
 const generateTranslationFile = async (pieceName: string) => {
   const pieceRoot = await findPiece(pieceName)
+  assertPieceExists(pieceRoot)
   const packageJson = await readPackageJson(pieceRoot)
   await buildPackage(packageJson.name)
   try{
@@ -94,7 +95,7 @@ export const generateTranslationFileForPieceCommand = new Command('generate-tran
   .requiredOption('--shard-total <shardTotal>', 'Total number of shards', (value) => parseInt(value, 10))
   .action(async ({shardIndex, shardTotal}: { shardIndex: number; shardTotal: number }) => {
     const piecesDirectory = join(process.cwd(), 'packages', 'pieces', 'community')
-    const pieces = (await findPieces(piecesDirectory)).map(piece => piece.split('/').pop());
+    const pieces = (await findPieces(piecesDirectory)).map(piece => basename(piece));
     let totalTime = 0
     let indexAcrossAllPieces = 0
     for (const piece of pieces) {
```

**File**: `packages/cli/src/lib/commands/sync-pieces.ts` (modified, +2/-2)
```diff
@@ -7,7 +7,7 @@ async function syncPieces(
   params:
   {apiUrl: string,
   apiKey: string,
-  pieces: string[] | null,
+  pieces: string[] | undefined,
   failOnError: boolean,}
 ) {
   const piecesDirectory = join(process.cwd(), 'packages', 'pieces', 'custom')
@@ -28,7 +28,7 @@ export const syncPieceCommand = new Command('sync')
     .option('-f, --fail-on-error', 'Exit the process if an error occurs while syncing a piece', false)
     .action(async (options) => {
         const apiKey = process.env.AP_API_KEY;
-        const pieces = options.pieces ? [...new Set<string>(options.pieces)] : null;
+        const pieces = options.pieces ? [...new Set<string>(options.pieces)] : undefined;
         const failOnError = options.failOnError;
         if (!apiKey) {
             console.error(chalk.red('AP_API_KEY environment variable is required'));
```

**File**: `packages/cli/src/lib/utils/piece-utils.ts` (modified, +3/-3)
```diff
@@ -120,7 +120,7 @@ export async function publishPieceFromFolder(
                 }
             }
         } else {
-            console.error(chalk.red(`Unexpected error: ${error.message}`));
+            console.error(chalk.red(`Unexpected error: ${error instanceof Error ? error.message : String(error)}`));
             if (failOnError) {
               console.info(chalk.yellow(`Terminating process due to unexpected error for piece '${packageJson.name}' (fail-on-error is enabled)`));
               process.exit(1);
@@ -165,12 +165,12 @@ export function displayNameToCamelCase(input: string): string {
     return camelCaseWords.join('');
   }
 
-export const assertPieceExists = async (pieceName: string | null) => {
+export function assertPieceExists(pieceName: string | null): asserts pieceName is string {
     if (!pieceName) {
       console.error(chalk.red(`🚨 Piece ${pieceName} not found`));
       process.exit(1);
     }
-  };
+  }
 
 
   export const removeStartingSlashes = (str: string) => {
```

**File**: `packages/cli/tsconfig.json` (modified, +1/-0)
```diff
@@ -2,6 +2,7 @@
   "extends": "../../tsconfig.base.json",
   "compilerOptions": {
     "module": "commonjs",
+    "strict": true,
   },
   "files": [],
   "include": [],
```

---

### Incident Patch 6: `5dc18c49` (2026-10-05)
**Commit Message**: feat(chat): build requests with several jobs as a folder of small flows (#16115)

**File**: `packages/server/api/src/app/mcp/tools/ap-build-flow.ts` (modified, +4/-3)
```diff
@@ -87,6 +87,7 @@ export const apBuildFlowTool = ({ mcp, userId }: McpToolContext, log: FastifyBas
                 })
                 flowId = flow.id
                 const createdIn = `${mcpUtils.folderSuffix(folder.folderName)}, externalId ${flow.externalId}`
+                const solutionCheckHint = isNil(folder.folderName) ? '' : `\nOnce every flow and table in this folder is built, check how they fit together with ap_validate_flow({ folderName: ${JSON.stringify(folder.folderName)} }).`
 
                 const triggerVersionResult = await mcpUtils.resolveLatestPieceVersion({ pieceName: trigger.pieceName, projectId, platformId, log })
                 if (triggerVersionResult.error) {
@@ -209,12 +210,12 @@ export const apBuildFlowTool = ({ mcp, userId }: McpToolContext, log: FastifyBas
                     unknownProps: unknownPropFindings,
                 }
                 if (unknownPropFindings.length > 0) {
-                    return { content: [{ type: 'text', text: `❌ Flow "${flowName}" created (id: ${flowId})${createdIn}, but some settings used property names that do NOT exist on the piece and were dropped — the flow does NOT behave as configured. Do NOT tell the user these settings were applied. Fix each with ap_update_step / ap_update_trigger using the correct property names:\n${unknownPropFindings.join('\n')}\nOpen: ${flowUrl}` }], structuredContent: structured }
+                    return { content: [{ type: 'text', text: `❌ Flow "${flowName}" created (id: ${flowId})${createdIn}, but some settings used property names that do NOT exist on the piece and were dropped — the flow does NOT behave as configured. Do NOT tell the user these settings were applied. Fix each with ap_update_step / ap_update_trigger using the correct property names:\n${unknownPropFindings.join('\n')}\nOpen: ${flowUrl}${solutionCheckHint}` }], structuredContent: structured }
                 }
                 if (invalidSteps.length === 0 && skippedSteps.length === 0) {
-                    return { content: [{ type: 'text', text: `✅ Flow "${flowName}" created (id: ${flowId})${createdIn} with ${allSteps.length} ${stepWord}, all valid. Open: ${flowUrl}` }], structuredContent: structured }
+                    return { content: [{ type: 'text', text: `✅ Flow "${flowName}" created (id: ${flowId})${createdIn} with ${allSteps.length} ${stepWord}, all valid. Open: ${flowUrl}${solutionCheckHint}` }], structuredContent: structured }
                 }
-                return { content: [{ type: 'text', text: `⚠️ Flow "${flowName}" created (id: ${flowId})${createdIn} with ${allSteps.length} ${stepWord} (${validCount} valid, ${invalidSteps.length} invalid: ${invalidSteps.join(', ')}).${skippedHint} Use ap_update_step or ap_update_trigger to fix. Open: ${flowUrl}` }], structuredContent: structured }
+                return { content: [{ type: 'text', text: `⚠️ Flow "${flowName}" created (id: ${flowId})${createdIn} with ${allSteps.length} ${stepWord} (${validCount} valid, ${invalidSteps.length} invalid: ${invalidSteps.join(', ')}).${skippedHint} Use ap_update_step or ap_update_trigger to fix. Open: ${flowUrl}${solutionCheckHint}` }], structuredContent: structured }
             }
             catch (err) {
                 if (flowId) {
```

**File**: `packages/server/api/src/app/mcp/tools/solution-validation.ts` (modified, +37/-0)
```diff
@@ -29,6 +29,7 @@ async function validate({ mcp, userId, folderName, log }: { mcp: ProjectScopedMc
     ])
     const issues = [
         ...flows.flatMap(validationIssues),
+        ...flows.flatMap(subflowInputIssues),
         ...steps.flatMap(({ flow, step }) => checkStep({ step, targetsByExternalId, tablesByExternalId }).map((message) => ({ flow, step, message }))),
     ]
     return {
@@ -52,6 +53,21 @@ function validationIssues(flow: PopulatedFlow): SolutionIssue[] {
         })
 }
 
+function subflowInputIssues(flow: PopulatedFlow): SolutionIssue[] {
+    if (!isPieceStep({ step: flow.version.trigger, pieceName: SUBFLOWS_PIECE_NAME, componentName: CALLABLE_FLOW_TRIGGER })) {
+        return []
+    }
+    return flowStructureUtil.getAllSteps(flow.version.trigger).flatMap((step) => {
+        const misreadKeys = unique(stringLeaves(step.settings).flatMap((text) => [...text.matchAll(TRIGGER_OUTPUT_KEY_PATTERN)].map((match) => match[1] ?? match[2])))
+            .filter((key) => !CALLABLE_FLOW_OUTPUT_KEYS.includes(key))
+        if (misreadKeys.length === 0) {
+            return []
+        }
+        const fixes = misreadKeys.map((key) => `{{trigger['output'].${key}}} → {{trigger['output'].data.${key}}}`).join(', ')
+        return [{ flow, step, message: `reads the subflow's inputs from the wrong place, so they are empty at run time. A Callable Flow puts its inputs under data: ${fixes}` }]
+    })
+}
+
 function summarize({ folderName, flowCount, issues, unchecked }: { folderName: string | undefined, flowCount: number, issues: SolutionIssue[], unchecked: SolutionIssue[] }): string {
     const flowWord = flowCount === 1 ? 'flow' : 'flows'
     const uncheckedPart = unchecked.length === 0 ? '' : `\nThese connections could not be checked, so the solution is not verified:\n${unchecked.map(formatLine).join('\n')}`
@@ -126,7 +142,10 @@ function checkCallFlow({ step, target }: { step: Step, target: PopulatedFlow | u
     const payload = isNil(rawPayload) ? {} : parseObject(rawPayload)
     const missingKeys = isNil(contract) || isNil(payload) ? [] : Object.keys(contract).filter((key) => !(key in payload))
     const waitsForResponse = input['waitForResponse'] === true || input['waitForResponse'] === 'true'
+    const payloadSchemaSaved = !isNil(readPath({ value: step.settings, path: ['propertySettings', 'flowProps', 'schema'] }))
+    const sendsPayloadAsText = typeof rawPayload === 'string' && !payloadSchemaSaved && readsInputFields(target)
     return [
+        ...(sendsPayloadAsText ? [`Call Flow sends its payload as JSON text, so "${targetName}" receives one string instead of its inputs. Set mode to "simple" and flowProps.payload to an object`] : []),
         ...(missingKeys.length > 0 ? [`Call Flow to "${targetName}" does not send ${missingKeys.join(', ')}, which its Callable Flow sample data expects`] : []),
         ...(waitsForResponse && !hasReturnResponse(target) ? [`Call Flow waits for a response, but "${targetName}" has no Return Response step`] : []),
     ]
@@ -157,6 +176,20 @@ function checkTableStep({ step, table }: { step: Step, table: SolutionTable | un
     return [`writes fields table "${tableName}" does not have: ${unknownFields.join(', ')}. Key form values by field externalId (raw records JSON by field name). Valid fields: ${validFields || 'none'}`]
 }
 
+function stringLeaves(value: unknown): string[] {
+    if (typeof value === 'string') {
+        return [value]
+    }
+    if (Array.isArray(value)) {
+        return value.flatMap(stringLeaves)
+    }
+    return isObject(value) ? Object.values(value).flatMap(stringLeaves) : []
+}
+
+function readsInputFields(flow: PopulatedFlow): boolean {
+    return flowStructureUtil.getAllSteps(flow.version.trigger).some((step) => stringLeaves(step.settings).some((text) => INPUT_FIELD_REFERENCE_PATTERN.test(text)))
+}
+
 function hasReturnResponse(flow: PopulatedFlow): boolean {
     return flowStructureUtil.getAllSteps(flow.version.trigger).some((step) => isPieceStep({ step, pieceName: SUBFLOWS_PIECE_NAME, componentName: RETURN_RESPONSE_ACTION }))
 }
@@ -266,6 +299,10 @@ const TABLES_PIECE_NAME = '@activepieces/piece-tables'
 const CALL_FLOW_ACTION = 'callFlow'
 const CALLABLE_FLOW_TRIGGER = 'callableFlow'
 const RETURN_RESPONSE_ACTION = 'returnResponse'
+const CALLABLE_FLOW_OUTPUT_KEYS = ['data', 'callbackUrl']
+const TRIGGER_OUTPUT_SOURCE = String.raw`trigger(?:\.output|\[['"]output['"]\])`
+const INPUT_FIELD_REFERENCE_PATTERN = new RegExp(String.raw`${TRIGGER_OUTPUT_SOURCE}(?:\.data|\[['"]data['"]\])(?:\.|\[)`)
+const TRIGGER_OUTPUT_KEY_PATTERN = new RegExp(String.raw`${TRIGGER_OUTPUT_SOURCE}(?:\.([A-Za-z_$][\w$]*)|\[['"]([^'"\]]+)['"]\])`, 'g')
 const UPDATE_RECORD_ACTION = 'tables-update-record'
 
 type SolutionIssue = {
```

**File**: `packages/server/api/src/assets/prompts/chat-system-prompt.md` (modified, +2/-2)
```diff
@@ -266,15 +266,15 @@ Hard limits. Everything not listed here is your judgment to exercise.
 </discovery>
 
 <guides>
-You work in two phases. You start in **discovery** (understanding the goal, reading data) with only read/understand tools available. The moment you begin constructing, editing, testing, or running an automation, call `ap_set_phase('build')` (silent, no thinking status) — this unlocks the build/execution tools. Pair it with loading the guide: when you `ap_load_guide('build_flow')` or `ap_load_guide('one_time_task')`, also `ap_set_phase('build')`.
+You work in two phases. You start in **discovery** (understanding the goal, reading data) with only read/understand tools available. The moment you begin constructing, editing, testing, running, or publishing (turning on) an automation, call `ap_set_phase('build')` (silent, no thinking status) — this unlocks the build/execution tools. Every new message starts in discovery again, so a "Turn it on" reply after a build needs `ap_set_phase('build')` before `ap_lock_and_publish`. Pair it with loading the guide: when you `ap_load_guide('build_flow')` or `ap_load_guide('one_time_task')`, also `ap_set_phase('build')`.
 
 When (and ONLY when) you commit to building a brand-new recurring automation via `build_flow`, also call `ap_set_build_plan` (silent, no thinking status) with `phase: 'detecting'`, a bold celebratory `tagline` about the exact busywork you're killing (e.g. "Say goodbye to copy-pasting leads"), and the steps you intend to build — this celebrates the moment in a single contained build card and keeps a live plan the user watches update; finish with `phase: 'done'` and the `flowId` to reveal Open / Test / Run. Details in `build_flow`. NEVER call it for one-time tasks, single actions, lookups, answers, or small edits to an existing automation — those get no card.
 
 Detailed playbooks load on demand with `ap_load_guide({ topic })` (silent, no thinking status). Load the relevant guide BEFORE that kind of work — don't build, handle errors, fall back to HTTP, or run a one-shot task from memory.
 
 | topic | load it when |
 |-------|--------------|
-| `build_flow` | You're about to construct/validate/test an automation (after discovery). |
+| `build_flow` | You're about to construct/validate/test an automation (after discovery), including a solution of several flows and tables in one folder. |
 | `one_time_task` | The user wants a one-shot action now, not a recurring automation. |
 | `error_handling` | The user wants the automation to react to a step failing (success/failure branches). |
 | `http_fallback` | A required app has no connection and the user can't/won't connect. |
```

**File**: `packages/server/api/src/assets/prompts/guides/build_flow.md` (modified, +26/-2)
```diff
@@ -33,6 +33,32 @@ The majority are 2–5 linear steps: a schedule or form/webhook trigger and a co
 
 **Exception — reprocessing safety is never "over-building".** The rule above does NOT license skipping an anti-reprocessing mechanism on a recurring flow that reads persistent data. That mechanism is required correctness (see the next section), not a "to be safe" extra — leaving it out is a silent bug, not a simpler flow.
 
+## A use case with several jobs is a solution: small flows in one folder
+Before you build, list the jobs in the request: intake, enrichment or processing, storage, reporting, approval, alerting. One job is one flow, as above. Two or more jobs, or a job several flows need, is a **solution**: build a folder of small flows, each doing one job, joined by subflows and Tables. Don't wait for the user to ask; most people don't know subflows exist. One big flow does every job in one place, so one failure breaks all of them and nobody can tell which part failed.
+
+Example: "when an order comes in by webhook, save it, and send me a daily summary" is three jobs:
+- **Receive orders** (webhook → Call Flow)
+- **Save order** (Callable Flow → Tables create)
+- **Daily order summary** (schedule → Tables find → message)
+
+All three go in an `Order intake` folder with an `Orders` table.
+
+**Shared work goes in one subflow.** When several entry points feed the same processing (a webhook and a form, two schedules, two apps), put that processing in ONE Callable subflow. Each entry flow then only receives its input and calls the subflow. Never copy the same steps into two flows: every later fix would have to be made twice. For example, "leads come from a webhook and a form; score each with AI and save it" is **Score and save lead** (Callable Flow → AI → Tables create), called by **Receive webhook lead** and **Receive form lead**.
+
+How to build one:
+1. **Folder:** `ap_create_folder` with a name for the whole solution. Pass that `folderName` to every `ap_build_flow` and `ap_create_table` in it.
+2. **Names:** name each flow for its one job, in plain words ("Save order", not "Flow 2" or "Order flow helper").
+3. **Order:** tables first, then subflows, then the flows that call them. Each step needs an id the previous one returned.
+4. **Subflow:** trigger `@activepieces/piece-subflows` `callableFlow`, with `exampleData.sampleData` listing every input it takes, e.g. `{"orderId": "123", "email": "a@b.co"}`. Its steps read each input as `{{trigger['output'].data.<key>}}`, never `{{trigger['output'].<key>}}` (that is empty at run time). Add a `returnResponse` step only if a caller needs data back.
+5. **Caller:** a `callFlow` step with `flowId` set to the subflow's **externalId** (the one `ap_build_flow` returned, not its flow id). Use `mode: "simple"` and send every key of the subflow's sample data in `flowProps.payload` as an object; a JSON-text payload arrives in the subflow as one string. Set `waitForResponse` only when the subflow has a Return Response step.
+6. **Tables steps:** `table_id` is the table's **externalId**. Form `values` are keyed by field externalId.
+7. **Check the whole solution:** after every flow passes its own checks, call `ap_validate_flow({folderName})`. Fix each issue it lists and run it again until it returns ✅. Use it as well to check whether an existing solution fits together, instead of inspecting flows by hand.
+8. **Build card:** one card for the whole solution. `flowName` is the solution name, there is one step per flow and table, and `flowId` is the entry flow.
+
+Testing: a Call Flow only reaches a subflow that is published and turned on, so a caller's test run fails at that step while the subflow is a draft. Test each subflow on its own with `ap_test_flow`, using mock trigger data shaped the way a caller delivers it: `{"data": <its sample data>}`. Test the caller's steps before the Call Flow.
+
+Turning it on: one "Turn it on?" card for the whole solution. On yes, call `ap_set_phase('build')`, then publish the subflows first and the flows that call them last.
+
 ## Recurring flows must not reprocess
 **Before you build, answer one question: does this run more than once, and does it read data that persists between runs?** If a scheduled/recurring flow reads a source that keeps its data (a sheet, a Table, an inbox, any record set), that source holds the SAME rows again on the next run. A flow shaped `read-all → act → done` will redo run N's work on run N+1 — re-sending, re-paying, re-notifying. This is the #1 silent logic bug: it validates fine, a single test run looks perfect, and the damage only appears on the second run.
 
@@ -119,8 +145,6 @@ Chat NEVER publishes on its own. A flow only runs once published, so once it val
 
 **After `ap_build_flow`** it creates the skeleton but does NOT validate configs or field mappings. You MUST: (1) `ap_validate_step_config` on the trigger and each step, (2) fix any errors with `ap_update_step`/`ap_update_trigger`, (3) `ap_validate_fl
```

**File**: `packages/server/api/test/integration/ce/mcp/mcp-tools.test.ts` (modified, +9/-0)
```diff
@@ -2691,6 +2691,15 @@ describe('MCP Tools integration', () => {
         expect(builtContent.folderName).toBe('Order intake')
         expect(text(created)).toContain('in folder "Order intake"')
         expect(text(built)).toContain(`externalId ${builtFlow?.externalId}`)
+        expect(text(built)).toContain('ap_validate_flow({ folderName: "Order intake" })')
+        await apCreateFolderTool(mcp, mockLog).execute({ folderName: 'Order "rush"' })
+        const quoted = await apBuildFlowTool({ mcp }, mockLog).execute({
+            flowName: 'Quoted folder',
+            folderName: 'Order "rush"',
+            trigger: { pieceName: '@activepieces/piece-test-email', triggerName: 'new_email' },
+            steps: [],
+        })
+        expect(text(quoted)).toContain('ap_validate_flow({ folderName: "Order \\"rush\\"" })')
     })
 
     it('ap_build_flow into a folder that does not exist creates nothing', async () => {
```

**File**: `packages/server/api/test/integration/ce/mcp/mcp-validate-solution.test.ts` (modified, +61/-6)
```diff
@@ -1,11 +1,13 @@
-import { agentToolClassification, FlowActionType, PackageType, PieceType, ProjectScopedMcpServer } from '@activepieces/shared'
+import { agentToolClassification, FlowActionType, FlowOperationType, flowStructureUtil, PackageType, PieceType, ProjectScopedMcpServer } from '@activepieces/shared'
 import { FastifyBaseLogger, FastifyInstance } from 'fastify'
 import { afterAll, beforeAll, describe, expect, it } from 'vitest'
 import { z } from 'zod'
+import { flowService } from '../../../../src/app/flows/flow/flow.service'
 import { apBuildFlowTool } from '../../../../src/app/mcp/tools/ap-build-flow'
 import { apCreateFolderTool } from '../../../../src/app/mcp/tools/ap-create-folder'
 import { apCreateTableTool } from '../../../../src/app/mcp/tools/ap-create-table'
 import { apValidateFlowTool } from '../../../../src/app/mcp/tools/ap-validate-flow'
+import { projectService } from '../../../../src/app/project/project-service'
 import { db } from '../../../helpers/db'
 import { mockProjectScopedMcpServer } from '../../../helpers/mcp-flow'
 import { createMockPieceMetadata } from '../../../helpers/mocks'
@@ -104,7 +106,7 @@ describe('ap_validate_flow with folderName', () => {
     it('passes a solution whose subflow, call and table all fit together', async () => {
         const { mcp, table } = await createSolutionBase()
         const subflow = await buildSubflow({ mcp, withResponse: true, writeField: table.fieldExternalId, tableExternalId: table.externalId })
-        await buildCaller({ mcp, subflowExternalId: subflow.externalId, payload: { orderId: '{{trigger.body.id}}' }, waitForResponse: true })
+        await buildCaller({ mcp, subflowExternalId: subflow.externalId, payload: { orderId: '{{trigger.data.id}}' }, waitForResponse: true })
 
         const result = await apValidateFlowTool({ mcp }, log).execute({ folderName: SOLUTION_FOLDER })
         const report = structured(result)
@@ -115,6 +117,59 @@ describe('ap_validate_flow with folderName', () => {
         expect(text(result)).toContain('every connection checks out')
     })
 
+    it('reports a subflow that reads its inputs from outside data, which are empty at run time', async () => {
+        const { mcp, table } = await createSolutionBase()
+        await buildSubflow({ mcp, withResponse: false, writeField: table.fieldExternalId, tableExternalId: table.externalId, inputRef: '{{trigger.orderId}}' })
+
+        const messages = await issueMessages(mcp)
+
+        expect(messages).toContainEqual(expect.stringContaining("A Callable Flow puts its inputs under data: {{trigger['output'].orderId}} → {{trigger['output'].data.orderId}}"))
+    })
+
+    it.each([
+        { spelling: '{{trigger.output.orderId}}' },
+        { spelling: '{{trigger["output"]["orderId"]}}' },
+    ])('reports a subflow input read outside data in a builder-saved spelling: $spelling', async ({ spelling }) => {
+        const { mcp, table } = await createSolutionBase()
+        const subflow = await buildSubflow({ mcp, withResponse: false, writeField: table.fieldExternalId, tableExternalId: table.externalId })
+        const { data: [flow] } = await flowService(log).list({ projectIds: [mcp.projectId], externalIds: [subflow.externalId], includeTriggerSource: false })
+        const step = flowStructureUtil.getStepOrThrow('step_1', flow.version.trigger)
+        const { platformId } = await projectService(log).getOneOrThrow(mcp.projectId)
+        await flowService(log).update({
+            id: flow.id, projectId: mcp.projectId, userId: null, platformId,
+            operation: { type: FlowOperationType.UPDATE_ACTION, request: { ...step, settings: { ...step.settings, input: { table_id: table.externalId, values: { values: [{ [table.fieldExternalId]: spelling }] } } } } },
+        })
+
+        const messages = await issueMessages(mcp)
+
+        expect(messages).toContainEqual(expect.stringContaining("{{trigger['output'].data.orderId}}"))
+    })
+
+    it('reports a Call Flow that sends its payload as JSON text, which the subflow receives as one string', async () => {
+        const { mcp, table } = await createSolutionBase()
+        const subflow = await buildSubflow({ mcp, withResponse: false, writeField: table.fieldExternalId, tableExternalId: table.externalId })
+        await buildFlow({ mcp, flowName: 'Receive order', steps: [
+            { type: FlowActionType.PIECE, displayName: 'Enrich', pieceName: '@activepieces/piece-subflows', actionName: 'callFlow', input: { flowId: subflow.externalId, mode: 'advanced', flowProps: { payload: '{"orderId": "{{trigger.data.id}}"}' }, waitForResponse: false } },
+        ] })
+
+        const messages = await issueMessages(mcp)
+
+        expect(messages).toContainEqual(expect.stringContaining('sends its payload as JSON text'))
+        expect(messages).not.toContainEqual(expect.stringContaining('does not send'))
+    })
+
+    it('accepts a JSON-text payload when the subflow parses its data itself', async () => {
+  
```

---

### Incident Patch 7: `dcebeca5` (2026-10-05)
**Commit Message**: feat(builder): ask for required actions before publishing (#15954)

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `packages/web/public/locales/en/translation.json` (modified, +2/-0)
```diff
@@ -1,4 +1,6 @@
 {
+  "You must include these actions to publish.": "You must include these actions to publish.",
+  "You must include one of these actions to publish.": "You must include one of these actions to publish.",
   "At least one": "At least one",
   "No required actions": "No required actions",
   "Choose actions that flows in projects assigned to this set must include before they can publish.": "Choose actions that flows in projects assigned to this set must include before they can publish.",
```

**File**: `packages/web/src/app/builder/flow-canvas/widgets/publish-flow-reminder-widget.tsx` (modified, +30/-1)
```diff
@@ -8,6 +8,7 @@ import {
 import { useMutation } from '@tanstack/react-query';
 import { t } from 'i18next';
 import { Info } from 'lucide-react';
+import { useState } from 'react';
 
 import { RightSideBarType } from '@/app/builder/types';
 import { LoadingSpinner } from '@/components/custom/spinner';
@@ -26,6 +27,11 @@ import { useBuilderStateContext } from '../../builder-hooks';
 
 import { runDiscard } from './discard-draft';
 import LargeWidgetWrapper from './large-widget-wrapper';
+import {
+  FailedRequiredActionsCheck,
+  RequiredActionsDialog,
+  useRequiredActionsCheck,
+} from './required-actions-dialog';
 
 const PublishFlowReminderWidget = () => {
   const [
@@ -79,6 +85,10 @@ const PublishFlowReminderWidget = () => {
         }),
     },
   );
+  const { checkRequiredActions, explainServerRejection } =
+    useRequiredActionsCheck();
+  const [failedRequiredActionsCheck, setFailedRequiredActionsCheck] =
+    useState<FailedRequiredActionsCheck | null>(null);
   const { mutateAsync: publish } = flowHooks.useChangeFlowStatus({
     flowId: flow.id,
     change: 'publish',
@@ -87,7 +97,22 @@ const PublishFlowReminderWidget = () => {
       setVersion(updatedFlow.version);
     },
     setIsPublishing: setIsPublishing,
+    onRequiredActionsMissing: (params) => {
+      explainServerRejection(params)
+        .then(setFailedRequiredActionsCheck)
+        .catch(() => undefined);
+    },
   });
+  const handlePublish = async () => {
+    setIsPublishing(true);
+    const failedCheck = await checkRequiredActions(flowVersion);
+    if (failedCheck) {
+      setIsPublishing(false);
+      setFailedRequiredActionsCheck(failedCheck);
+      return;
+    }
+    await publish();
+  };
   const { mutateAsync: overWriteDraftWithVersion } =
     flowHooks.useOverWriteDraftWithVersion({
       onSuccess: (updatedFlow) => {
@@ -136,7 +161,7 @@ const PublishFlowReminderWidget = () => {
                   loading={isSaving}
                   //for e2e tests
                   name="Publish"
-                  onClick={() => publish()}
+                  onClick={handlePublish}
                   disabled={!isValid}
                 >
                   {requiresApproval ? t('Request approval') : t('Publish')}
@@ -150,6 +175,10 @@ const PublishFlowReminderWidget = () => {
           </Tooltip>
         </div>
       )}
+      <RequiredActionsDialog
+        failedCheck={failedRequiredActionsCheck}
+        onClose={() => setFailedRequiredActionsCheck(null)}
+      />
     </LargeWidgetWrapper>
   );
 };
```

**File**: `packages/web/src/app/builder/flow-canvas/widgets/required-actions-dialog.tsx` (added, +521/-0)
```diff
@@ -0,0 +1,521 @@
+import {
+  isNil,
+  RequiredActionsMissingErrorParams,
+  tryCatch,
+  unique,
+} from '@activepieces/core-utils';
+import { PieceMetadataModel } from '@activepieces/pieces-framework';
+import {
+  FlowActionType,
+  FlowOperationType,
+  FlowVersion,
+  RequiredActionsCheckResult,
+  RequiredActionsMode,
+  requiredActionsUtil,
+  StepLocationRelativeToParent,
+} from '@activepieces/shared';
+import { QueryClient, useQueryClient } from '@tanstack/react-query';
+import { useReactFlow } from '@xyflow/react';
+import { t } from 'i18next';
+import { useState } from 'react';
+import { useTranslation } from 'react-i18next';
+
+import {
+  BuilderState,
+  useBuilderStateContext,
+} from '@/app/builder/builder-hooks';
+import { getLastLocationAsPasteLocation } from '@/app/builder/flow-canvas/utils/bulk-actions';
+import { flowCanvasUtils } from '@/app/builder/flow-canvas/utils/flow-canvas-utils';
+import { Badge } from '@/components/ui/badge';
+import { Button } from '@/components/ui/button';
+import { Checkbox } from '@/components/ui/checkbox';
+import {
+  Dialog,
+  DialogContent,
+  DialogDescription,
+  DialogFooter,
+  DialogHeader,
+  DialogTitle,
+} from '@/components/ui/dialog';
+import { ScrollArea } from '@/components/ui/scroll-area';
+import {
+  pieceSetQueryOptions,
+  RequiredActionGroupHeader,
+} from '@/features/piece-sets';
+import { pieceQueryOptions, stepUtils } from '@/features/pieces';
+import { projectCollectionUtils } from '@/features/projects';
+import { platformHooks } from '@/hooks/platform-hooks';
+import { cn } from '@/lib/utils';
+
+export function useRequiredActionsCheck() {
+  const queryClient = useQueryClient();
+  const { i18n } = useTranslation();
+  const { platform } = platformHooks.useCurrentPlatform();
+  const { project } = projectCollectionUtils.useCurrentProject();
+
+  const checkRequiredActions = async (
+    flowVersion: FlowVersion,
+  ): Promise<FailedRequiredActionsCheck | null> => {
+    if (!platform.plan.managePiecesEnabled) {
+      return null;
+    }
+    const { data } = await tryCatch(() =>
+      loadAndCheckRequiredActions({
+        queryClient,
+        projectId: project.id,
+        language: i18n.language,
+        flowVersion,
+      }),
+    );
+    return data ?? null;
+  };
+
+  const explainServerRejection = async (
+    params: RequiredActionsMissingErrorParams['params'],
+  ): Promise<FailedRequiredActionsCheck> => {
+    const result = toCheckResult(params);
+    const pieceNames = unique([
+      ...Object.keys(result.missingActions),
+      ...Object.keys(result.skippedActions),
+    ]);
+    const piecesByName = await loadPiecesByName({
+      queryClient,
+      pieceNames,
+      language: i18n.language,
+    });
+    return { result, piecesByName };
+  };
+
+  return { checkRequiredActions, explainServerRejection };
+}
+
+export function RequiredActionsDialog({
+  failedCheck,
+  onClose,
+}: {
+  failedCheck: FailedRequiredActionsCheck | null;
+  onClose: () => void;
+}) {
+  return (
+    <Dialog
+      open={failedCheck !== null}
+      onOpenChange={(open) => !open && onClose()}
+    >
+      <DialogContent className="sm:max-w-md">
+        {failedCheck && (
+          <RequiredActionsDialogContent
+            failedCheck={failedCheck}
+            onClose={onClose}
+          />
+        )}
+      </DialogContent>
+    </Dialog>
+  );
+}
+
+function RequiredActionsDialogContent({
+  failedCheck,
+  onClose,
+}: {
+  failedCheck: FailedRequiredActionsCheck;
+  onClose: () => void;
+}) {
+  const { result, piecesByName } = failedCheck;
+  const { fitView } = useReactFlow();
+  const [flowVersion, handleAddingOrUpdatingStep] = useBuilderStateContext(
+    (state) => [state.flowVersion, state.handleAddingOrUpdatingStep],
+  );
+  const areAllActionsRequired = result.mode === RequiredActionsMode.ALL;
+  const missingRequiredActionsGroupedByPiece = buildMissingRequiredActionGroups(
+    {
+      result,
+      piecesByName,
+    },
+  );
+  const missingRequiredActions = missingRequiredActionsGroupedByPiece.flatMap(
+    (group) => group.actions,
+  );
+  const [requiredActionsToAdd, setRequiredActionsToAdd] = useState<
+    Record<string, string[]>
+  >(() =>
+    groupByPiece(
+      areAllActionsRequired
+        ? missingRequiredActions
+        : missingRequiredActions.slice(0, 1),
+    ),
+  );
+  const missingRequiredActionsToAdd = missingRequiredActions.filter((action) =>
+    willBeAdded({ requiredActionsToAdd, action }),
+  );
+
+  const toggleRequiredActionToAdd = (action: MissingRequiredAction) =>
+    setRequiredActionsToAdd((prev) =>
+      toggleRequiredAction({ requiredActionsToAdd: prev, action }),
+    );
+
+  const [showNoActionError, setShowNoActionError] = useState(false);
+
+  const addSteps = () => {
+    if (missingRequiredActionsToAdd.length === 0) {
+      setShowNoActionError(true);
+      return;
+    }
+    const addedStepNames = addRequiredSteps({
+      requiredActions: missingRequired
```

**File**: `packages/web/src/app/components/project-settings/pieces/index.tsx` (modified, +1/-3)
```diff
@@ -87,9 +87,7 @@ const PiecesSettings = () => {
     isTableQuery: true,
   });
 
-  const { data: pieceSet } = pieceSetQueries.usePieceSet(
-    project.pieceSetId ?? '',
-  );
+  const { data: pieceSet } = pieceSetQueries.useProjectPieceSet(project.id);
 
   const customFilters = useMemo(
     () => [
```

**File**: `packages/web/src/app/routes/mcp-server/pieces/pieces-panel.tsx` (modified, +3/-7)
```diff
@@ -13,7 +13,6 @@ import { VirtualizedList } from '@/components/ui/virtualized-list';
 import { RequestTrial } from '@/features/billing';
 import { pieceSetQueries } from '@/features/piece-sets';
 import { piecesHooks } from '@/features/pieces/hooks/pieces-hooks';
-import { projectCollectionUtils } from '@/features/projects';
 import { useIsPlatformAdmin } from '@/hooks/authorization-hooks';
 import { platformHooks } from '@/hooks/platform-hooks';
 
@@ -184,10 +183,7 @@ function RunActionDisabledAlert({
 function PieceSetBanner({ projectId }: { projectId: string | null }) {
   const { platform } = platformHooks.useCurrentPlatform();
   const isPlatformAdmin = useIsPlatformAdmin();
-  const { data: projects = [] } = projectCollectionUtils.useAll();
-  const pieceSetId =
-    projects.find((project) => project.id === projectId)?.pieceSetId ?? null;
-  const { data: pieceSet } = pieceSetQueries.usePieceSet(pieceSetId ?? '');
+  const { data: pieceSet } = pieceSetQueries.useProjectPieceSet(projectId);
 
   if (!platform.plan.managePiecesEnabled) {
     return (
@@ -225,8 +221,8 @@ function PieceSetBanner({ projectId }: { projectId: string | null }) {
         >
           <Link
             to={
-              pieceSetId
-                ? `/platform/pieces/piece-sets/${pieceSetId}`
+              pieceSet
+                ? `/platform/pieces/piece-sets/${pieceSet.id}`
                 : PIECE_SETS_LIST_ROUTE
             }
           >
```

**File**: `packages/web/src/features/flows/hooks/flow-hooks.tsx` (modified, +14/-0)
```diff
@@ -2,6 +2,7 @@ import {
   ApErrorParams,
   isNil,
   ErrorCode,
+  RequiredActionsMissingErrorParams,
   SeekPage,
 } from '@activepieces/core-utils';
 import {
@@ -72,6 +73,7 @@ export const flowHooks = {
     change,
     onSuccess,
     setIsPublishing,
+    onRequiredActionsMissing,
   }: UseChangeFlowStatusParams) => {
     const { data: enableFlowOnPublish } = flagsHooks.useFlag<boolean>(
       ApFlagId.ENABLE_FLOW_ON_PUBLISH,
@@ -169,6 +171,15 @@ export const flowHooks = {
             },
             technicalDetailsDefaultOpen: isNil(reportedError),
           });
+        } else if (apError.code === ErrorCode.REQUIRED_ACTIONS_MISSING) {
+          if (onRequiredActionsMissing) {
+            onRequiredActionsMissing(apError.params);
+            return;
+          }
+          toast.error(t('Publish failed'), {
+            description: apError.params.message,
+            duration: 5000,
+          });
         } else if (apError.code === ErrorCode.QUOTA_EXCEEDED) {
           toast.error(t('Active flows limit reached'), {
             description: t(
@@ -595,4 +606,7 @@ type UseChangeFlowStatusParams = {
   change: 'publish' | FlowStatus;
   onSuccess: (flow: PopulatedFlow) => void;
   setIsPublishing?: (isPublishing: boolean) => void;
+  onRequiredActionsMissing?: (
+    params: RequiredActionsMissingErrorParams['params'],
+  ) => void;
 };
```

---

### Incident Patch 8: `6ae9b548` (2026-10-05)
**Commit Message**: feat(piece-sets): admin UI for required actions (#15953)

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `docs/admin-guide/guides/manage-pieces.mdx` (modified, +65/-18)
```diff
@@ -20,8 +20,8 @@ There are **two levels** of piece management:
 
 | Level | Who Can Manage | Scope |
 | --- | --- | --- |
-| **Platform Level** | Platform Admin | Install and remove across the entire platform |
-| **Project Level** | Project Admin | Show/hide specific pieces for specfic project |
+| **Platform Level** | Platform Admin | Install and remove pieces across the entire platform |
+| **Piece Sets** | Platform Admin | Choose which pieces, actions, and triggers each project can use, and which actions a flow must contain to publish |
 
 <Note>
   Pieces are standard npm packages — official pieces are **auto-synced from the registry hourly**, so you don't need to upgrade the server to get new versions. Each step in a flow is pinned to a specific piece version, and drafts can be upgraded from the builder. See [Piece Syncing & Versioning](/install/architecture/piece-syncing) for the full pipeline.
@@ -33,34 +33,81 @@ There are **two levels** of piece management:
 
 Platform administrators can manage pieces for the entire Activepieces instance from **Platform Admin → Catalogue → Pieces**.
 
-## Project-Level Management
+## Piece Sets
 
-Project administrators can further restrict which pieces are available within their specific project. This is useful when different teams or projects need access to different integrations.
+A piece set is a named list of the pieces, actions, and triggers that users can see in the builder. Every project uses exactly one piece set. Projects that you don't assign to a set use the **Default** set.
 
-### Show/Hide Pieces in a Project
+Manage piece sets from **Platform Admin → Catalogue → Pieces → Piece Sets**.
 
-<Steps>
-  <Step title="Open Project Settings">
-    Navigate to your project and go to **Settings → Pieces**.
-  </Step>
-  <Step title="Configure Visibility">
-    You'll see a list of all pieces installed on the platform. Toggle the visibility for each piece:
+### Create a Piece Set and Assign Projects
 
-    - **Enabled**: Users in this project can use the piece
-    - **Disabled**: The piece is hidden from users in this project
+<Steps>
+  <Step title="Create the set">
+    Click **New Piece Set**, give it a name, and open it.
   </Step>
-  <Step title="Save Changes">
-    Changes take effect immediately — users will only see the enabled pieces when building their flows.
+  <Step title="Assign projects">
+    Click the **Assigned** button and select the projects that use this set. A project can use only one set, so a project that already uses another set moves to this one. The dialog shows each project's current set and warns you before a project moves.
   </Step>
 </Steps>
 
-<img src="/resources/screenshots/manage-pieces.png" alt="Manage Pieces" /> <img src="/resources/screenshots/manage-pieces-2.png" alt="Manage Pieces" />
+### Choose the Pieces
+
+- Turn a piece's switch off to hide it from the projects in this set.
+- Select several pieces and use **Include** to set what they show:
+  - **Actions and triggers**: all actions and all triggers.
+  - **Actions only**: all actions and no triggers.
+  - **Triggers only**: all triggers and no actions.
+
+  Use **Exclude** to remove them from the set.
+- **Auto-Include · New pieces** decides whether pieces installed later are visible in this set. It doesn't change the pieces you've already chosen.
+
+### Choose the Actions and Triggers of a Piece
+
+Click a piece row to open **Actions & triggers**:
+
+- **All** makes every current and future action and trigger of the piece available.
+- **Only selected** makes only the checked items available. Actions and triggers added to the piece later stay hidden until you check them. Use **Select all** to check or clear every item at once.
 
 <Note>
-  Project-level settings can only **hide** pieces that are installed at the platform level. You cannot add pieces at the project level that aren't already installed on the platform.
+  A piece set controls what users see in the builder. It does not stop a flow that already uses a hidden piece from running or being published.
 </Note>
 
-### Install Private Pieces
+### Required Actions
+
+Use required actions when every published flow must use your own app — for example, an embedded integration that must always write to your product.
+
+Open the piece set and go to the **Required actions** tab.
+
+<Steps>
+  <Step title="Choose the publishing rule">
+    Under **Publishing flows rule**, choose:
+
+    - **At least one** (default): a flow must contain at least one of the required actions.
+    - **All required actions**: a flow must contain every required action.
+  </Step>
+  <Step title="Add required actions">
+    Click **Add actions**, pick a piece, check the actions to require, and click **Save**. Only actions can be required, not triggers. The piece must be in the set.
+  </Step>
+  <Step title="Edit or remove them">
+    Each piece has its own card. Click **Edit** on a card to change its actions, click the **×** on an action
```

**File**: `packages/web/public/locales/en/translation.json` (modified, +45/-4)
```diff
@@ -1,4 +1,46 @@
 {
+  "At least one": "At least one",
+  "No required actions": "No required actions",
+  "Choose actions that flows in projects assigned to this set must include before they can publish.": "Choose actions that flows in projects assigned to this set must include before they can publish.",
+  "Choose actions that flows in projects assigned to this set must include at least one of before they can publish.": "Choose actions that flows in projects assigned to this set must include at least one of before they can publish.",
+  "This piece has no actions.": "This piece has no actions.",
+  "requiredCount": "{count} required",
+  "A flow can publish only when it contains every required action.": "A flow can publish only when it contains every required action.",
+  "A flow can publish only when it contains at least one required action.": "A flow can publish only when it contains at least one required action.",
+  "All required actions": "All required actions",
+  "Add actions": "Add actions",
+  "requiredActionsAcrossPieces": "{actionCount, plural, =1 {1 action} other {# actions}} across {pieceCount, plural, =1 {1 piece} other {# pieces}}",
+  "actionsNotInLatestPieceVersion": "{count, plural, =1 {1 action is} other {# actions are}} no longer in the latest version of {pieceName}. Publishing ignores them.",
+  "Remove all": "Remove all",
+  "Publishing flows rule": "Publishing flows rule",
+  "{count} of {total} included": "{count} of {total} included",
+  "Not in set": "Not in set",
+  "Actions that are not in the set are added to it when you make them required.": "Actions that are not in the set are added to it when you make them required.",
+  "{pieceName} required actions": "{pieceName} required actions",
+  "A flow can publish only when it contains all the actions you check.": "A flow can publish only when it contains all the actions you check.",
+  "A flow can publish only when it contains at least one of the actions you check.": "A flow can publish only when it contains at least one of the actions you check.",
+  "To edit {name}, include it in the set first.": "To edit {name}, include it in the set first.",
+  "Choose which actions/triggers this set includes.": "Choose which actions/triggers this set includes.",
+  "A piece set decides which pieces (actions/triggers) a project can see. It can also set required actions that a flow must include before it can be published.": "A piece set decides which pieces (actions/triggers) a project can see. It can also set required actions that a flow must include before it can be published.",
+  "What to include in the set": "What to include in the set",
+  "Everything in this piece, including actions/triggers added later.": "Everything in this piece, including actions/triggers added later.",
+  "Only what you check below. New actions/triggers are not included.": "Only what you check below. New actions/triggers are not included.",
+  "Add required actions": "Add required actions",
+  "Add a required action": "Add a required action",
+  "addActionsCount": "{count, plural, =0 {Add action} =1 {Add action} other {Add # actions}}",
+  "Remove required actions?": "Remove required actions?",
+  "removingPiecesRemovesRequiredActions": "{count, plural, =1 {You are removing this piece from the set, which removes its {actionCount, plural, =1 {1 required action} other {# required actions}}. Your users will be able to publish their flows without including {actionCount, plural, =1 {it} other {them}}.} other {You are removing these pieces from the set, which removes their {actionCount, plural, =1 {1 required action} other {# required actions}}. Your users will be able to publish their flows without including {actionCount, plural, =1 {it} other {them}}.}}",
+  "excludingActionsRemovesRequiredActions": "{count, plural, =1 {You are removing actions of this piece from the set, which removes its {actionCount, plural, =1 {1 required action} other {# required actions}}. Your users will be able to publish their flows without including {actionCount, plural, =1 {it} other {them}}.} other {You are removing actions of these pieces from the set, which removes their {actionCount, plural, =1 {1 required action} other {# required actions}}. Your users will be able to publish their flows without including {actionCount, plural, =1 {it} other {them}}.}}",
+  "Save and remove": "Save and remove",
+  "Required actions": "Required actions",
+  "Required": "Required",
+  "Actions only": "Actions only",
+  "Triggers only": "Triggers only",
+  "Actions and triggers": "Actions and triggers",
+  "actions and triggers": "actions and triggers",
+  "Select at least one action to add.": "Select at least one action to add.",
+  "Currently: {name}": "Currently: {name}",
+  "projectsMovingFromOtherSets": "{count, plural, =1 {1 project will move from another piece set.} other {# projects will move from other piece sets.}}",
   "Exactly one route runs.": "Exactly one route runs.",
   "Asks the model once p
```

**File**: `packages/web/src/app/routes/platform/setup/pieces/piece-component-visibility-sheet.tsx` (removed, +0/-435)
```diff
@@ -1,435 +0,0 @@
-import { ActionBase, TriggerBase } from '@activepieces/pieces-framework';
-import { PieceSet } from '@activepieces/shared';
-import { t } from 'i18next';
-import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
-import { useMemo, useState } from 'react';
-
-import { Badge } from '@/components/ui/badge';
-import { Button } from '@/components/ui/button';
-import { Checkbox } from '@/components/ui/checkbox';
-import {
-  Collapsible,
-  CollapsibleContent,
-  CollapsibleTrigger,
-} from '@/components/ui/collapsible';
-import {
-  Sheet,
-  SheetContent,
-  SheetDescription,
-  SheetHeader,
-  SheetTitle,
-} from '@/components/ui/sheet';
-import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
-import { pieceSetMutations } from '@/features/piece-sets';
-import { piecesHooks } from '@/features/pieces';
-import { AdminControl, adminControl } from '@/lib/admin-control';
-import { cn } from '@/lib/utils';
-
-type PieceComponentVisibilitySheetProps = {
-  pieceName: string;
-  pieceDisplayName: string;
-  open: boolean;
-  onOpenChange: (open: boolean) => void;
-  pieceSet: PieceSet;
-};
-
-type ComponentItem =
-  | { type: 'action'; data: ActionBase }
-  | { type: 'trigger'; data: TriggerBase };
-
-type VisibilityMode = 'all' | 'selected';
-
-export const PieceComponentVisibilitySheet = ({
-  pieceName,
-  pieceDisplayName,
-  open,
-  onOpenChange,
-  pieceSet,
-}: PieceComponentVisibilitySheetProps) => {
-  return (
-    <Sheet open={open} onOpenChange={onOpenChange}>
-      <SheetContent className="w-[600px] sm:max-w-[600px] flex flex-col p-0">
-        <PieceComponentVisibilitySheetContent
-          key={`${pieceName}:${open}`}
-          pieceName={pieceName}
-          pieceDisplayName={pieceDisplayName}
-          open={open}
-          onOpenChange={onOpenChange}
-          pieceSet={pieceSet}
-        />
-      </SheetContent>
-    </Sheet>
-  );
-};
-
-PieceComponentVisibilitySheet.displayName = 'PieceComponentVisibilitySheet';
-
-function PieceComponentVisibilitySheetContent({
-  pieceName,
-  pieceDisplayName,
-  open,
-  onOpenChange,
-  pieceSet,
-}: PieceComponentVisibilitySheetProps) {
-  const { pieceModel, isLoading } = piecesHooks.usePiece({
-    name: pieceName,
-    enabled: open,
-  });
-
-  const allActionNames = useMemo(
-    () => (pieceModel ? Object.keys(pieceModel.actions) : []),
-    [pieceModel],
-  );
-  const allTriggerNames = useMemo(
-    () => (pieceModel ? Object.keys(pieceModel.triggers) : []),
-    [pieceModel],
-  );
-
-  const originalMode: VisibilityMode =
-    pieceName in pieceSet.config.selectedActions ||
-    pieceName in pieceSet.config.selectedTriggers
-      ? 'selected'
-      : 'all';
-
-  const originalHiddenActions = useMemo(() => {
-    if (originalMode !== 'selected') {
-      return [];
-    }
-    const selected = pieceSet.config.selectedActions[pieceName] ?? [];
-    return allActionNames.filter((n) => !selected.includes(n));
-  }, [pieceSet, pieceName, originalMode, allActionNames]);
-
-  const originalHiddenTriggers = useMemo(() => {
-    if (originalMode !== 'selected') {
-      return [];
-    }
-    const selected = pieceSet.config.selectedTriggers[pieceName] ?? [];
-    return allTriggerNames.filter((n) => !selected.includes(n));
-  }, [pieceSet, pieceName, originalMode, allTriggerNames]);
-
-  const [mode, setMode] = useState<VisibilityMode>(originalMode);
-  const [touchedHiddenActions, setTouchedHiddenActions] = useState<
-    string[] | null
-  >(null);
-  const [touchedHiddenTriggers, setTouchedHiddenTriggers] = useState<
-    string[] | null
-  >(null);
-
-  const localHiddenActions = touchedHiddenActions ?? originalHiddenActions;
-  const localHiddenTriggers = touchedHiddenTriggers ?? originalHiddenTriggers;
-  const setLocalHiddenActions = (
-    updater: string[] | ((prev: string[]) => string[]),
-  ) =>
-    setTouchedHiddenActions((prev) => {
-      const current = prev ?? originalHiddenActions;
-      return typeof updater === 'function' ? updater(current) : updater;
-    });
-  const setLocalHiddenTriggers = (
-    updater: string[] | ((prev: string[]) => string[]),
-  ) =>
-    setTouchedHiddenTriggers((prev) => {
-      const current = prev ?? originalHiddenTriggers;
-      return typeof updater === 'function' ? updater(current) : updater;
-    });
-
-  const { mutate: updatePieceSet, isPending: isPieceSetPending } =
-    pieceSetMutations.useUpdatePieceSet();
-
-  const isMutating = isPieceSetPending;
-
-  const allActions = useMemo<ComponentItem[]>(() => {
-    if (!pieceModel) return [];
-    return Object.values(pieceModel.actions).map((a) => ({
-      type: 'action' as const,
-      data: a,
-    }));
-  }, [pieceModel]);
-
-  const allTriggers = useMemo<ComponentItem[]>(() => {
-    if (!pieceModel) return [];
-    return Object.values(pieceModel.triggers).map((tr) => ({
-      type: 'trigger' as const,
-      data: tr,
-    }));
-  }, [pieceModel]);
-
-  const visibleActionCount = allActio
```

**File**: `packages/web/src/app/routes/platform/setup/pieces/piece-sets/confirm-excluding-required-actions.tsx` (added, +123/-0)
```diff
@@ -0,0 +1,123 @@
+import { t } from 'i18next';
+
+import { Button } from '@/components/ui/button';
+import {
+  Dialog,
+  DialogContent,
+  DialogDescription,
+  DialogFooter,
+  DialogHeader,
+  DialogTitle,
+} from '@/components/ui/dialog';
+import { ScrollArea } from '@/components/ui/scroll-area';
+import { RequiredActionGroupHeader } from '@/features/piece-sets';
+
+import {
+  RequiredActionGroup,
+  useRequiredActionsGroupedByPiece,
+} from './use-required-actions-grouped-by-piece';
+
+export function ConfirmExcludingRequiredActionsDialog({
+  excludedRequiredActions,
+  reason,
+  onConfirm,
+  onCancel,
+}: {
+  excludedRequiredActions: Record<string, string[]> | null;
+  reason: ExcludingReason;
+  onConfirm: () => void;
+  onCancel: () => void;
+}) {
+  return (
+    <Dialog
+      open={excludedRequiredActions !== null}
+      onOpenChange={(open) => !open && onCancel()}
+    >
+      <DialogContent className="sm:max-w-md">
+        {excludedRequiredActions && (
+          <ConfirmExcludingRequiredActionsContent
+            excludedRequiredActions={excludedRequiredActions}
+            reason={reason}
+            onConfirm={onConfirm}
+            onCancel={onCancel}
+          />
+        )}
+      </DialogContent>
+    </Dialog>
+  );
+}
+
+function ConfirmExcludingRequiredActionsContent({
+  excludedRequiredActions,
+  reason,
+  onConfirm,
+  onCancel,
+}: {
+  excludedRequiredActions: Record<string, string[]>;
+  reason: ExcludingReason;
+  onConfirm: () => void;
+  onCancel: () => void;
+}) {
+  const { requiredActionsGroupedByPiece } = useRequiredActionsGroupedByPiece({
+    actions: excludedRequiredActions,
+  });
+  const pieceCount = Object.keys(excludedRequiredActions).length;
+  const actionCount = Object.values(excludedRequiredActions).flat().length;
+  return (
+    <>
+      <DialogHeader>
+        <DialogTitle>{t('Remove required actions?')}</DialogTitle>
+        <DialogDescription>
+          {reason === 'removePieces'
+            ? t('removingPiecesRemovesRequiredActions', {
+                count: pieceCount,
+                actionCount,
+              })
+            : t('excludingActionsRemovesRequiredActions', {
+                count: pieceCount,
+                actionCount,
+              })}
+        </DialogDescription>
+      </DialogHeader>
+      <ScrollArea viewPortClassName="max-h-80">
+        <RequiredActionsList
+          requiredActionsGroupedByPiece={requiredActionsGroupedByPiece}
+        />
+      </ScrollArea>
+      <DialogFooter>
+        <Button type="button" variant="outline" onClick={onCancel}>
+          {t('Cancel')}
+        </Button>
+        <Button type="button" onClick={onConfirm}>
+          {t('Save and remove')}
+        </Button>
+      </DialogFooter>
+    </>
+  );
+}
+
+function RequiredActionsList({
+  requiredActionsGroupedByPiece,
+}: {
+  requiredActionsGroupedByPiece: RequiredActionGroup[];
+}) {
+  return (
+    <div className="flex flex-col gap-3">
+      {requiredActionsGroupedByPiece.map((group) => (
+        <div key={group.pieceName} className="flex flex-col">
+          <RequiredActionGroupHeader
+            displayName={group.displayName}
+            logoUrl={group.logoUrl}
+          />
+          {group.actions.map((action) => (
+            <p key={action.name} className="py-1.5 pl-9 text-sm">
+              {action.displayName}
+            </p>
+          ))}
+        </div>
+      ))}
+    </div>
+  );
+}
+
+export type ExcludingReason = 'removePieces' | 'excludeActions';
```

**File**: `packages/web/src/app/routes/platform/setup/pieces/piece-sets/mode-radio-cards.tsx` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
+import { cn } from '@/lib/utils';
+
+export function ModeRadioCards<TValue extends string>({
+  title,
+  value,
+  options,
+  onChange,
+}: {
+  title: string;
+  value: TValue;
+  options: { value: TValue; label: string; description: string }[];
+  onChange: (value: TValue) => void;
+}) {
+  return (
+    <div className="flex flex-col gap-2.5">
+      <span className="text-sm font-semibold">{title}</span>
+      <RadioGroup
+        value={value}
+        onValueChange={(newValue) => {
+          const option = options.find((option) => option.value === newValue);
+          if (option) {
+            onChange(option.value);
+          }
+        }}
+        className="grid grid-cols-2 gap-3"
+      >
+        {options.map((option) => (
+          <label
+            key={option.value}
+            className={cn(
+              'flex cursor-pointer flex-col gap-1.5 rounded-lg border p-3 transition-colors',
+              option.value === value
+                ? 'border-accent-9 bg-accent-3'
+                : 'hover:bg-gray-3/50',
+            )}
+          >
+            <span className="flex items-center gap-2 text-sm font-medium">
+              <RadioGroupItem value={option.value} />
+              {option.label}
+            </span>
+            <span className="text-sm text-gray-11">{option.description}</span>
+          </label>
+        ))}
+      </RadioGroup>
+    </div>
+  );
+}
```

**File**: `packages/web/src/app/routes/platform/setup/pieces/piece-sets/piece-actions-and-triggers-form.ts` (added, +107/-0)
```diff
@@ -0,0 +1,107 @@
+import { PieceSet, UpdatePieceSetRequestBody } from '@activepieces/shared';
+import { z } from 'zod';
+
+function buildDefaultValues({
+  pieceSet,
+  pieceName,
+  actionNames,
+  triggerNames,
+}: {
+  pieceSet: PieceSet;
+  pieceName: string;
+  actionNames: string[];
+  triggerNames: string[];
+}): PieceActionsAndTriggersFormValues {
+  const { selectedActions, selectedTriggers } = pieceSet.config;
+  const mode: IncludeMode =
+    pieceName in selectedActions || pieceName in selectedTriggers
+      ? 'selected'
+      : 'all';
+  return {
+    mode,
+    selectedActions: pickSelected({
+      mode,
+      allNames: actionNames,
+      savedNames: selectedActions[pieceName],
+    }),
+    selectedTriggers: pickSelected({
+      mode,
+      allNames: triggerNames,
+      savedNames: selectedTriggers[pieceName],
+    }),
+  };
+}
+
+function toUpdateRequest({
+  values,
+  pieceName,
+}: {
+  values: PieceActionsAndTriggersFormValues;
+  pieceName: string;
+}): UpdatePieceSetRequestBody {
+  if (values.mode === 'all') {
+    return {
+      actions: { [pieceName]: { mode: 'all' } },
+      triggers: { [pieceName]: { mode: 'all' } },
+    };
+  }
+  return {
+    actions: {
+      [pieceName]: { mode: 'selected', selected: values.selectedActions },
+    },
+    triggers: {
+      [pieceName]: { mode: 'selected', selected: values.selectedTriggers },
+    },
+  };
+}
+
+function toggleName({
+  checkedNames,
+  allNames,
+  name,
+}: {
+  checkedNames: string[];
+  allNames: string[];
+  name: string;
+}): string[] {
+  return allNames.filter((existingName) =>
+    existingName === name
+      ? !checkedNames.includes(existingName)
+      : checkedNames.includes(existingName),
+  );
+}
+
+function pickSelected({
+  mode,
+  allNames,
+  savedNames,
+}: {
+  mode: IncludeMode;
+  allNames: string[];
+  savedNames: string[] | undefined;
+}): string[] {
+  if (mode === 'all' || savedNames === undefined) {
+    return allNames;
+  }
+  return allNames.filter((name) => savedNames.includes(name));
+}
+
+const IncludeMode = z.enum(['all', 'selected']);
+
+export const PieceActionsAndTriggersFormSchema = z.object({
+  mode: IncludeMode,
+  selectedActions: z.array(z.string()),
+  selectedTriggers: z.array(z.string()),
+});
+
+export const pieceActionsAndTriggersForm = {
+  buildDefaultValues,
+  toUpdateRequest,
+  toggleName,
+};
+
+export type IncludeMode = z.infer<typeof IncludeMode>;
+
+export type PieceActionsAndTriggersFormValues = z.infer<
+  typeof PieceActionsAndTriggersFormSchema
+>;
```

**File**: `packages/web/src/app/routes/platform/setup/pieces/piece-sets/piece-actions-and-triggers-sheet.tsx` (added, +470/-0)
```diff
@@ -0,0 +1,470 @@
+import {
+  ActionBase,
+  PieceMetadataModel,
+  TriggerBase,
+} from '@activepieces/pieces-framework';
+import { PieceSet } from '@activepieces/shared';
+import { zodResolver } from '@hookform/resolvers/zod';
+import { t } from 'i18next';
+import { Loader2 } from 'lucide-react';
+import { useState } from 'react';
+import { useForm } from 'react-hook-form';
+
+import { DataFetchErrorState } from '@/components/custom/data-fetch-error-state';
+import { Badge } from '@/components/ui/badge';
+import { Button } from '@/components/ui/button';
+import { Checkbox } from '@/components/ui/checkbox';
+import { Form, FormField } from '@/components/ui/form';
+import {
+  Sheet,
+  SheetContent,
+  SheetDescription,
+  SheetHeader,
+  SheetTitle,
+} from '@/components/ui/sheet';
+import {
+  Tooltip,
+  TooltipContent,
+  TooltipTrigger,
+} from '@/components/ui/tooltip';
+import { pieceSetMutations } from '@/features/piece-sets';
+import { PieceIcon, piecesHooks } from '@/features/pieces';
+import { AdminControl, adminControl } from '@/lib/admin-control';
+import { cn } from '@/lib/utils';
+
+import { ConfirmExcludingRequiredActionsDialog } from './confirm-excluding-required-actions';
+import { ModeRadioCards } from './mode-radio-cards';
+import {
+  pieceActionsAndTriggersForm,
+  PieceActionsAndTriggersFormSchema,
+  PieceActionsAndTriggersFormValues,
+  IncludeMode,
+} from './piece-actions-and-triggers-form';
+import { pieceSetInclusionUtils } from './piece-set-inclusion-utils';
+
+export const PieceActionsAndTriggersSheet = ({
+  pieceName,
+  pieceDisplayName,
+  open,
+  onOpenChange,
+  pieceSet,
+}: PieceActionsAndTriggersSheetProps) => {
+  return (
+    <Sheet open={open} onOpenChange={onOpenChange}>
+      <SheetContent className="w-[600px] sm:max-w-[600px] flex flex-col p-0">
+        <PieceActionsAndTriggersSheetBody
+          key={pieceName}
+          pieceName={pieceName}
+          pieceDisplayName={pieceDisplayName}
+          pieceSet={pieceSet}
+          onClose={() => onOpenChange(false)}
+        />
+      </SheetContent>
+    </Sheet>
+  );
+};
+
+PieceActionsAndTriggersSheet.displayName = 'PieceActionsAndTriggersSheet';
+
+function PieceActionsAndTriggersSheetBody({
+  pieceName,
+  pieceDisplayName,
+  pieceSet,
+  onClose,
+}: {
+  pieceName: string;
+  pieceDisplayName: string;
+  pieceSet: PieceSet;
+  onClose: () => void;
+}) {
+  const { pieceModel, isLoading, refetch } = piecesHooks.usePiece({
+    name: pieceName,
+  });
+
+  return (
+    <>
+      <SheetHeader className="px-6 py-4 border-b shrink-0 flex-row items-center gap-3 space-y-0">
+        <PieceIcon
+          size="lg"
+          border={true}
+          displayName={pieceDisplayName}
+          logoUrl={pieceModel?.logoUrl}
+          showTooltip={false}
+        />
+        <div className="flex flex-col gap-0.5 min-w-0">
+          <SheetTitle className="text-base">{pieceDisplayName}</SheetTitle>
+          <SheetDescription>
+            {t('Choose which actions/triggers this set includes.')}
+          </SheetDescription>
+        </div>
+      </SheetHeader>
+      {isLoading ? (
+        <div className="flex flex-1 items-center justify-center">
+          <Loader2 className="size-8 animate-spin text-gray-11" />
+        </div>
+      ) : !pieceModel ? (
+        <DataFetchErrorState
+          entity={t('actions and triggers')}
+          onRetry={refetch}
+        />
+      ) : (
+        <PieceActionsAndTriggersEditor
+          piece={pieceModel}
+          pieceName={pieceName}
+          pieceSet={pieceSet}
+          onClose={onClose}
+        />
+      )}
+    </>
+  );
+}
+
+function PieceActionsAndTriggersEditor({
+  piece,
+  pieceName,
+  pieceSet,
+  onClose,
+}: {
+  piece: PieceMetadataModel;
+  pieceName: string;
+  pieceSet: PieceSet;
+  onClose: () => void;
+}) {
+  const actions = Object.values(piece.actions);
+  const triggers = Object.values(piece.triggers);
+  const actionNames = actions.map((action) => action.name);
+  const triggerNames = triggers.map((trigger) => trigger.name);
+  const form = useForm<PieceActionsAndTriggersFormValues>({
+    resolver: zodResolver(PieceActionsAndTriggersFormSchema),
+    defaultValues: pieceActionsAndTriggersForm.buildDefaultValues({
+      pieceSet,
+      pieceName,
+      actionNames,
+      triggerNames,
+    }),
+    mode: 'onChange',
+  });
+  const [
+    showRequiredActionWillBeExcludedConfirmationDialog,
+    setShowRequiredActionWillBeExcludedConfirmationDialog,
+  ] = useState(false);
+  const { mutate: updatePieceSet, isPending } =
+    pieceSetMutations.useUpdatePieceSet();
+  const values = form.watch();
+  const request = pieceActionsAndTriggersForm.toUpdateRequest({
+    values,
+    pieceName,
+  });
+  const requiredActionNames =
+    pieceSet.config.requiredActions.actions[pieceName] ?? [];
+  const isDirty = form.formState.isDirty;
+
+  const updateAndClose = () =>
+    updatePieceSet({ id: pieceSet.id, request }, { onSucc
```

**File**: `packages/web/src/app/routes/platform/setup/pieces/piece-sets/piece-select.tsx` (added, +142/-0)
```diff
@@ -0,0 +1,142 @@
+import { PieceMetadataModelSummary } from '@activepieces/pieces-framework';
+import { t } from 'i18next';
+import { Check, ChevronsUpDown } from 'lucide-react';
+import { useState } from 'react';
+
+import { Button } from '@/components/ui/button';
+import { Input } from '@/components/ui/input';
+import {
+  Popover,
+  PopoverContent,
+  PopoverTrigger,
+} from '@/components/ui/popover';
+import { VirtualizedScrollArea } from '@/components/ui/virtualized-scroll-area';
+import { PieceIcon } from '@/features/pieces';
+import { cn } from '@/lib/utils';
+
+export function PieceSelect({
+  pieces,
+  value,
+  loading,
+  onChange,
+}: {
+  pieces: PieceMetadataModelSummary[];
+  value: string | null;
+  loading: boolean;
+  onChange: (pieceName: string) => void;
+}) {
+  const [open, setOpen] = useState(false);
+  const [search, setSearch] = useState('');
+  const [popoverContainer, setPopoverContainer] =
+    useState<HTMLDivElement | null>(null);
+  const selectedPiece = pieces.find((piece) => piece.name === value);
+  const matchingPieces = pieces.filter((piece) =>
+    piece.displayName.toLowerCase().includes(search.toLowerCase()),
+  );
+  const listHeight = Math.min(
+    matchingPieces.length * ITEM_HEIGHT,
+    MAX_LIST_HEIGHT,
+  );
+
+  return (
+    <div ref={setPopoverContainer}>
+      <Popover
+        open={open}
+        onOpenChange={(isOpen) => {
+          setOpen(isOpen);
+          setSearch('');
+        }}
+      >
+        <PopoverTrigger asChild>
+          <Button
+            variant="outline"
+            role="combobox"
+            aria-expanded={open}
+            disabled={loading}
+            className="w-full justify-start gap-2 font-normal"
+          >
+            {selectedPiece ? (
+              <>
+                <PieceIcon
+                  size="xs"
+                  border={true}
+                  displayName={selectedPiece.displayName}
+                  logoUrl={selectedPiece.logoUrl}
+                  showTooltip={false}
+                />
+                <span className="flex-1 truncate text-left">
+                  {selectedPiece.displayName}
+                </span>
+              </>
+            ) : (
+              <span className="flex-1 text-left text-gray-11">
+                {t('Select a piece')}
+              </span>
+            )}
+            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
+          </Button>
+        </PopoverTrigger>
+        <PopoverContent
+          container={popoverContainer}
+          className="w-[var(--radix-popover-trigger-width)] p-0"
+        >
+          <div className="border-b p-2">
+            <Input
+              autoFocus
+              value={search}
+              placeholder={t('Search pieces')}
+              onChange={(event) => setSearch(event.target.value)}
+            />
+          </div>
+          {matchingPieces.length === 0 ? (
+            <div className="px-3 py-4 text-sm text-gray-11">
+              {t('No pieces found')}
+            </div>
+          ) : (
+            <div style={{ height: listHeight }}>
+              <VirtualizedScrollArea
+                items={matchingPieces}
+                estimateSize={() => ITEM_HEIGHT}
+                getItemKey={(index) => matchingPieces[index].name}
+                overscan={10}
+                renderItem={(piece) => (
+                  <button
+                    type="button"
+                    onClick={() => {
+                      onChange(piece.name);
+                      setOpen(false);
+                    }}
+                    className={cn(
+                      'flex h-full w-full items-center gap-2 px-3 text-sm hover:bg-gray-4',
+                      piece.name === value && 'bg-gray-4',
+                    )}
+                  >
+                    <PieceIcon
+                      size="xs"
+                      border={true}
+                      displayName={piece.displayName}
+                      logoUrl={piece.logoUrl}
+                      showTooltip={false}
+                    />
+                    <span className="flex-1 truncate text-left">
+                      {piece.displayName}
+                    </span>
+                    <Check
+                      className={cn(
+                        'size-4 shrink-0',
+                        piece.name === value ? 'opacity-100' : 'opacity-0',
+                      )}
+                    />
+                  </button>
+                )}
+              />
+            </div>
+          )}
+        </PopoverContent>
+      </Popover>
+    </div>
+  );
+}
+
+const ITEM_HEIGHT = 36;
+const MAX_LIST_HEIGHT = 288;
```

---

### Incident Patch 9: `17589082` (2026-10-05)
**Commit Message**: feat(piece-sets): required actions a flow must contain to publish (#15952)

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `brain/knowledge/decisions/000043-publish-checks-required-actions-never-visibility.md` (added, +17/-0)
```diff
@@ -0,0 +1,17 @@
+---
+status: accepted
+---
+
+# Publish checks required actions, never visibility
+
+## Decision
+A piece set's **required actions** are checked on every publish (`LOCK_AND_PUBLISH`), on the server and in the builder. What the set **hides** is still not checked at publish: a flow that uses a hidden piece, trigger or action publishes and runs.
+
+## Context
+Embed vendors need every published flow to contain their own app's actions. Piece sets already hide items in the builder, but an API call or an import can still use a hidden item. Zapier Enterprise and Power Platform both block publishing on hidden items; we looked at doing the same in the same hook.
+
+## Why
+Checking visibility at publish would be a functional breaking change: flows that publish today would start failing after the upgrade, and the rule has no escape for flows built before a piece was hidden. Required actions are new, so checking them breaks nothing. Rejected: enforcing both in one release.
+
+## Consequences
+The trigger limit ("users can only start from these triggers") holds in the builder only. Published flows keep running when a rule changes; the rule applies at the next publish. Approval (`flowApprovalRequestService.approve`) does not check again. A required action that is not in the latest piece version is ignored, so a piece update never locks users out.
```

**File**: `brain/knowledge/pieces-engine/piece-sets.md` (modified, +10/-4)
```diff
@@ -7,25 +7,31 @@ icon: 🗂️
 A named, reusable piece/action/trigger visibility configuration a platform admin defines once and assigns to many projects. Visibility is **derived at read time** — nothing is written when a new piece or action is installed.
 
 ### Model
-- **PieceSetConfig** — `{ pieces: PieceSelection, selectedActions: Record<piece, action[]>, selectedTriggers: Record<piece, trigger[]> }`.
+- **PieceSetConfig** — `{ pieces: PieceSelection, selectedActions: Record<piece, action[]>, selectedTriggers: Record<piece, trigger[]>, requiredActions: RequiredActions }`.
+- **Component** — an action or a trigger of a piece. `selectedActions` and `selectedTriggers` are the two component lists. _Avoid_: "step" (a step is a component placed in a flow).
 - **PieceSelection** — `{ mode: 'include_all' | 'exclude_all', exceptions: string[] }`. `include_all` = everything present and future except exceptions (auto-includes new pieces); `exclude_all` = only exceptions, hiding future pieces.
 - **Selected components** — a piece key present in `selectedActions`/`selectedTriggers` means "curated": only listed components visible, new ones stay hidden. Absent key = all visible incl. future.
+- **Required actions** — `{ mode: 'any' | 'all', actions: Record<piece, action[]> }`: a flow can publish only if it contains at least one (`any`, the default) or every (`all`) listed action, in a step that is not skipped. Actions only, never triggers.
 - **Default Set** — one per platform (`isDefault`, `key: 'default'`); unassigned projects resolve to it. Can't be deleted; projects reassign to it rather than being removed.
 - Shared pure resolvers `isPieceVisible` / `isComponentVisible` live in `core/shared/.../ee/piece-set/` (used by both server and web).
 
 ### Entities & services
 - `piece_set` entity — `platformId` (CASCADE), `name`, `key` (embed handle, unique per platform, auto `kebabCase(name)-<random>`), `isDefault` (partial unique index), `config` jsonb. Projects reference it via `project.pieceSetId` (FK SET NULL).
-- `pieceSetService` — CRUD + `getOrCreateDefaultPieceSet` (distributed lock), `duplicate`, `assignProject(s)` / `removeProjectAssignment`. `update` runs `pieceSetConfig.applyUpdate` (declarative merge, never touches unreferenced component keys).
-- Routes `/v1/piece-sets` (platformAdminOnly). Update uses **ComponentIntent**: `{ mode: 'all' }` resets a piece to all; `{ mode: 'selected', selected }` sets the allow-list (empty array = hide all).
+- `pieceSetService` — CRUD + `getOrCreateDefaultPieceSet` (distributed lock), `getForProject` (the project's set, or the Default Set when `pieceSetId` is null), `duplicate`, `assignProject(s)` / `removeProjectAssignment`. `update` runs `pieceSetConfig.applyUpdate` (declarative merge, never touches unreferenced component keys).
+- Routes `/v1/piece-sets` (platformAdminOnly), except `GET /v1/piece-sets/projects/:projectId`, which any member of that project can read. Update uses **ComponentSelection**: `{ mode: 'all' }` resets a piece to all; `{ mode: 'selected', selected }` sets the allow-list (empty array = hide all).
 
 ### Gotchas
+- **`requiredActions.actions` has one empty state.** `[piece]: []` means "nothing required from this piece", the opposite of `selectedActions`, where `[]` means "hide all". The save removes empty keys, and an empty record skips the check. The skip is explicit: "any of zero actions" would otherwise fail every publish.
+- **Required actions are checked against the latest piece version.** Names not in the latest version (from `pieceMetadataService.get` **without** `projectId`, or hidden actions would look removed) are ignored, so a piece update never locks users out. A step inside a skipped loop or branch does not count.
+- **Approval does not re-check required actions.** The check runs in `LOCK_AND_PUBLISH` before `routePublish`; `flowApprovalRequestService.approve` publishes through `setPublishedVersion`, so a rule added while a request waits is not applied to it.
+- **A connection replace skips the required-actions check.** When it republishes, `handleLockedVersion` passes `skipRequiredActionsCheck: true` to `LOCK_AND_PUBLISH`, so a flow that misses a required action still gets the new connection. The flow content does not change, and the rule applies at its next normal publish.
 - EE/Cloud only, gated behind `platform.plan.managePiecesEnabled`. On CE / flag off, piece sets are inert and filtering falls back to legacy project-plan allow/block lists.
 - The **whole** `/v1/piece-sets` module is behind that flag, `GET` included — so on a locked plan the web list query is `enabled: false`, the table is simply empty, and row actions never render. Only toolbar/entry points need a UI guard. `PiecesLockedBanner` renders at the top of both the Pieces and the Piece Sets pages, since the same flag gates both; the details route redirects back to `/platform/pieces/piece-sets` rather than hanging on a spinner waiting for a query that will never run.
 - Ther
```

**File**: `bun.lock` (modified, +1/-1)
```diff
@@ -188,7 +188,7 @@
     },
     "packages/core/utils": {
       "name": "@activepieces/core-utils",
-      "version": "0.8.6",
+      "version": "0.9.0",
       "dependencies": {
         "deepmerge-ts": "8.0.2",
         "ipaddr.js": "2.3.0",
```

**File**: `packages/core/shared/src/index.ts` (modified, +2/-0)
```diff
@@ -75,5 +75,7 @@ export * from './lib/ee/secret-managers'
 export * from './lib/ee/scim'
 export * from './lib/ee/embed-subdomain'
 export * from './lib/ee/piece-set'
+export * from './lib/ee/piece-set/required-actions-util'
+export * from './lib/ee/piece-set/piece-set-config-util'
 export * from './lib/ee/flow-approval'
 export * from './lib/management/project/project-requests'
```

**File**: `packages/core/shared/src/lib/ee/piece-set/index.ts` (modified, +20/-4)
```diff
@@ -25,10 +25,22 @@ export const PieceSelection = z.object({
 })
 export type PieceSelection = z.infer<typeof PieceSelection>
 
+export enum RequiredActionsMode {
+    ANY = 'any',
+    ALL = 'all',
+}
+
+export const RequiredActions = z.object({
+    mode: z.enum(RequiredActionsMode).default(RequiredActionsMode.ANY),
+    actions: z.record(z.string(), z.array(z.string())).default({}),
+})
+export type RequiredActions = z.infer<typeof RequiredActions>
+
 export const PieceSetConfig = z.object({
     pieces: PieceSelection.default({ mode: PieceSelectionMode.INCLUDE_ALL, exceptions: [] }),
     selectedActions: z.record(z.string(), z.array(z.string())).default({}),
     selectedTriggers: z.record(z.string(), z.array(z.string())).default({}),
+    requiredActions: RequiredActions.default({ mode: RequiredActionsMode.ANY, actions: {} }),
 })
 export type PieceSetConfig = z.infer<typeof PieceSetConfig>
 
@@ -43,11 +55,11 @@ export const PieceSet = z.object({
 })
 export type PieceSet = z.infer<typeof PieceSet>
 
-export const ComponentIntent = z.discriminatedUnion('mode', [
+export const ComponentSelection = z.discriminatedUnion('mode', [
     z.object({ mode: z.literal('all') }),
     z.object({ mode: z.literal('selected'), selected: z.array(z.string()) }),
 ])
-export type ComponentIntent = z.infer<typeof ComponentIntent>
+export type ComponentSelection = z.infer<typeof ComponentSelection>
 
 export const CreatePieceSetRequestBody = z.object({
     name: z.string().min(1, { message: formErrors.required }),
@@ -59,8 +71,12 @@ export const UpdatePieceSetRequestBody = z.object({
     name: z.string().min(1, { message: formErrors.required }).optional(),
     key: z.string().optional(),
     pieces: PieceSelection.optional(),
-    actions: z.record(z.string(), ComponentIntent).optional(),
-    triggers: z.record(z.string(), ComponentIntent).optional(),
+    actions: z.record(z.string(), ComponentSelection).optional(),
+    triggers: z.record(z.string(), ComponentSelection).optional(),
+    requiredActions: z.object({
+        mode: z.enum(RequiredActionsMode).optional(),
+        actions: z.record(z.string(), z.array(z.string())).optional(),
+    }).optional(),
 })
 export type UpdatePieceSetRequestBody = z.infer<typeof UpdatePieceSetRequestBody>
 
```

**File**: `packages/core/shared/src/lib/ee/piece-set/piece-set-config-util.ts` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+import { apId, isNil, unique } from '@activepieces/core-utils'
+import { requiredActionsUtil } from './required-actions-util'
+import { ComponentSelection, PieceSelectionMode, PieceSetConfig, RequiredActions, RequiredActionsMode, UpdatePieceSetRequestBody } from './index'
+
+function buildDefaultSet(platformId: string) {
+    return {
+        id: apId(),
+        platformId,
+        name: 'Default',
+        key: 'default',
+        isDefault: true,
+        generatedForProjectId: null,
+        config: emptyConfig(),
+    }
+}
+
+function emptyConfig(): PieceSetConfig {
+    return {
+        pieces: { mode: PieceSelectionMode.INCLUDE_ALL, exceptions: [] },
+        selectedActions: {},
+        selectedTriggers: {},
+        requiredActions: { mode: RequiredActionsMode.ANY, actions: {} },
+    }
+}
+
+function applyUpdate({ current, request }: { current: PieceSetConfig, request: UpdatePieceSetRequestBody }): PieceSetConfig {
+    const configWithUpdatedVisibility: PieceSetConfig = {
+        ...current,
+        pieces: request.pieces ?? current.pieces,
+        selectedActions: applyComponentSelections({ current: current.selectedActions, selections: request.actions }),
+        selectedTriggers: applyComponentSelections({ current: current.selectedTriggers, selections: request.triggers }),
+    }
+    return {
+        ...configWithUpdatedVisibility,
+        requiredActions: applyRequiredActionsUpdate({ config: configWithUpdatedVisibility, request: request.requiredActions }),
+    }
+}
+
+function applyComponentSelections({ current, selections }: { current: SelectedComponents, selections: Record<string, ComponentSelection> | undefined }): SelectedComponents {
+    if (isNil(selections)) {
+        return current
+    }
+    return Object.entries(selections).reduce<SelectedComponents>((acc, [piece, selection]) => {
+        if (selection.mode === 'all') {
+            return Object.fromEntries(Object.entries(acc).filter(([key]) => key !== piece))
+        }
+        return { ...acc, [piece]: unique(selection.selected) }
+    }, current)
+}
+
+function applyRequiredActionsUpdate({ config, request }: { config: PieceSetConfig, request: UpdatePieceSetRequestBody['requiredActions'] }): RequiredActions {
+    const current = config.requiredActions
+    return {
+        mode: request?.mode ?? current.mode,
+        actions: requiredActionsUtil.removeExcludedRequiredActions({
+            config,
+            requiredActions: { ...current.actions, ...request?.actions },
+        }),
+    }
+}
+
+export const pieceSetConfigUtil = {
+    buildDefaultSet,
+    emptyConfig,
+    applyUpdate,
+}
+
+type SelectedComponents = Record<string, string[]>
```

**File**: `packages/core/shared/src/lib/ee/piece-set/required-actions-util.ts` (added, +121/-0)
```diff
@@ -0,0 +1,121 @@
+import { FlowActionType, flowStructureUtil, FlowVersion, Step } from '@activepieces/core-execution'
+import { unique } from '@activepieces/core-utils'
+import { isComponentVisible, isPieceVisible, PieceSetConfig, RequiredActions, RequiredActionsMode } from './index'
+
+function dropUnavailableActionsInLatestPieceVersion({ actions, actionExists }: { actions: ActionsGroupedByPiece, actionExists: ActionExistence }): ActionsGroupedByPiece {
+    return filterActionsPerPiece({ actions, keep: ({ pieceName, actionName }) => actionExists[pieceName]?.[actionName] === true })
+}
+
+function removeExcludedRequiredActions({ config, requiredActions }: { config: PieceSetConfig, requiredActions: ActionsGroupedByPiece }): ActionsGroupedByPiece {
+    return filterActionsPerPiece({ actions: requiredActions, keep: ({ pieceName, actionName }) => isActionIncluded({ config, pieceName, actionName }) })
+}
+
+function findExcludedRequiredActions({ config, requiredActions }: { config: PieceSetConfig, requiredActions: ActionsGroupedByPiece }): ActionsGroupedByPiece {
+    return filterActionsPerPiece({ actions: requiredActions, keep: ({ pieceName, actionName }) => !isActionIncluded({ config, pieceName, actionName }) })
+}
+
+function checkRequiredActionsExistInFlowVersion({ requiredActions, flowVersion, actionExists }: CheckRequiredActionsExistInFlowVersionParams): RequiredActionsCheckResult {
+    const availableRequiredActionsInLatestPieceVersion = dropUnavailableActionsInLatestPieceVersion({ actions: requiredActions.actions, actionExists })
+    const required = ungroupActionsByPiece(availableRequiredActionsInLatestPieceVersion)
+    if (required.length === 0) {
+        return { passed: true, mode: requiredActions.mode, requiredActions: availableRequiredActionsInLatestPieceVersion, missingActions: {}, skippedActions: {} }
+    }
+    const steps = flowStructureUtil.getAllSteps(flowVersion.trigger)
+    const skippedStepNames = flowStructureUtil.getSkippedStepNames({ trigger: flowVersion.trigger })
+    const pieceActionSteps = getPieceActionsInFlowVersion({ steps }).map((step) => ({ ...step, skipped: skippedStepNames.has(step.stepName) }))
+    const nonSkippedActionsInFlowVersion = new Set(pieceActionSteps.filter((step) => !step.skipped).map(concatPieceNameAndActionName))
+    const skippedActionsInFlowVersion = new Set(pieceActionSteps.filter((step) => step.skipped).map(concatPieceNameAndActionName))
+    const requiredActionsNotInFlowVersion = required.filter((step) => !nonSkippedActionsInFlowVersion.has(concatPieceNameAndActionName(step)))
+    const passed = requiredActions.mode === RequiredActionsMode.ALL ? requiredActionsNotInFlowVersion.length === 0 : requiredActionsNotInFlowVersion.length < required.length
+    return {
+        passed,
+        mode: requiredActions.mode,
+        requiredActions: availableRequiredActionsInLatestPieceVersion,
+        missingActions: passed ? {} : groupActionsByPiece(requiredActionsNotInFlowVersion.filter((ref) => !skippedActionsInFlowVersion.has(concatPieceNameAndActionName(ref)))),
+        skippedActions: passed ? {} : groupActionsByPiece(requiredActionsNotInFlowVersion.filter((ref) => skippedActionsInFlowVersion.has(concatPieceNameAndActionName(ref)))),
+    }
+}
+
+function buildRequiredActionsMissingErrorMessage(result: RequiredActionsCheckResult): string {
+    const list = formatActionList([...ungroupActionsByPiece(result.missingActions), ...ungroupActionsByPiece(result.skippedActions)])
+    const lead = result.mode === RequiredActionsMode.ALL
+        ? 'This flow needs these actions to publish'
+        : 'This flow needs one of these actions to publish'
+    return `${lead}: ${list}`
+}
+
+function buildExcludedRequiredActionsErrorMessage(excludedRequiredActions: ActionsGroupedByPiece): string {
+    return `Required actions must be included in the piece set: ${formatActionList(ungroupActionsByPiece(excludedRequiredActions))}`
+}
+
+function formatActionList(refs: ActionAndPieceNames[]): string {
+    return refs
+        .map((ref) => `${ref.pieceName} · ${ref.actionName}`)
+        .join(', ')
+}
+
+function getPieceActionsInFlowVersion({ steps }: { steps: Step[] }): (ActionAndPieceNames & { stepName: string })[] {
+    return steps.flatMap((step) => {
+        if (step.type !== FlowActionType.PIECE || step.settings.actionName === undefined) {
+            return []
+        }
+        return [{ pieceName: step.settings.pieceName, actionName: step.settings.actionName, stepName: step.name }]
+    })
+}
+
+function filterActionsPerPiece({ actions, keep }: { actions: ActionsGroupedByPiece, keep: (action: ActionAndPieceNames) => boolean }): ActionsGroupedByPiece {
+    const keptActionsPerPiece = Object.entries(actions).map(([pieceName, actionNames]) => {
+        const keptActionNames = unique(actionNames).filter((actionName) => keep({ pieceName, actionName }))
+        return [pieceName, keptActionNames] as const
+    })
+    const piecesWithKeptActions 
```

**File**: `packages/core/shared/test/ee/piece-set-config-util.test.ts` (added, +129/-0)
```diff
@@ -0,0 +1,129 @@
+import { PieceSelectionMode, PieceSetConfig, RequiredActionsMode } from '../../src/lib/ee/piece-set'
+import { pieceSetConfigUtil } from '../../src/lib/ee/piece-set/piece-set-config-util'
+import { requiredActionsUtil } from '../../src/lib/ee/piece-set/required-actions-util'
+
+const base: PieceSetConfig = {
+    pieces: { mode: PieceSelectionMode.INCLUDE_ALL, exceptions: [] },
+    selectedActions: {},
+    selectedTriggers: {},
+    requiredActions: { mode: RequiredActionsMode.ANY, actions: {} },
+}
+
+describe('pieceSetConfigUtil.applyUpdate', () => {
+    it('replaces the pieces selection wholesale when provided', () => {
+        const result = pieceSetConfigUtil.applyUpdate({
+            current: base,
+            request: { pieces: { mode: PieceSelectionMode.EXCLUDE_ALL, exceptions: ['slack'] } },
+        })
+        expect(result.pieces).toEqual({ mode: PieceSelectionMode.EXCLUDE_ALL, exceptions: ['slack'] })
+    })
+
+    it('leaves the pieces selection untouched when not provided', () => {
+        const current = { ...base, pieces: { mode: PieceSelectionMode.EXCLUDE_ALL, exceptions: ['slack'] } }
+        const result = pieceSetConfigUtil.applyUpdate({ current, request: { actions: {} } })
+        expect(result.pieces).toEqual(current.pieces)
+    })
+
+    it('sets a selected allow-list and dedupes', () => {
+        const result = pieceSetConfigUtil.applyUpdate({
+            current: base,
+            request: { actions: { slack: { mode: 'selected', selected: ['a', 'a', 'b'] } } },
+        })
+        expect(result.selectedActions).toEqual({ slack: ['a', 'b'] })
+    })
+
+    it('keeps an empty selected array (hide-all) rather than deleting the key', () => {
+        const result = pieceSetConfigUtil.applyUpdate({
+            current: base,
+            request: { actions: { slack: { mode: 'selected', selected: [] } } },
+        })
+        expect(result.selectedActions).toEqual({ slack: [] })
+    })
+
+    it('mode "all" deletes the piece key (reset to all)', () => {
+        const current = { ...base, selectedActions: { slack: ['a'], gmail: ['b'] } }
+        const result = pieceSetConfigUtil.applyUpdate({
+            current,
+            request: { actions: { slack: { mode: 'all' } } },
+        })
+        expect(result.selectedActions).toEqual({ gmail: ['b'] })
+    })
+
+    it('merges per-piece: only referenced keys change', () => {
+        const current = { ...base, selectedActions: { slack: ['a'], gmail: ['b'] } }
+        const result = pieceSetConfigUtil.applyUpdate({
+            current,
+            request: { actions: { slack: { mode: 'selected', selected: ['c'] } } },
+        })
+        expect(result.selectedActions).toEqual({ slack: ['c'], gmail: ['b'] })
+    })
+
+    it('handles triggers the same way as actions', () => {
+        const result = pieceSetConfigUtil.applyUpdate({
+            current: base,
+            request: { triggers: { slack: { mode: 'selected', selected: ['new_message'] } } },
+        })
+        expect(result.selectedTriggers).toEqual({ slack: ['new_message'] })
+    })
+})
+
+describe('pieceSetConfigUtil.emptyConfig', () => {
+    it('is fully permissive (include_all, no component selections)', () => {
+        expect(pieceSetConfigUtil.emptyConfig()).toEqual({
+            pieces: { mode: PieceSelectionMode.INCLUDE_ALL, exceptions: [] },
+            selectedActions: {},
+            selectedTriggers: {},
+            requiredActions: { mode: RequiredActionsMode.ANY, actions: {} },
+        })
+    })
+})
+
+describe('pieceSetConfigUtil.applyUpdate requiredActions', () => {
+    it('replaces the list of a piece in the request, dedupes it, and keeps other pieces', () => {
+        const current = { ...base, requiredActions: { mode: RequiredActionsMode.ANY, actions: { gmail: ['send'] } } }
+        const result = pieceSetConfigUtil.applyUpdate({
+            current,
+            request: { requiredActions: { actions: { slack: ['post', 'post'] } } },
+        })
+        expect(result.requiredActions.actions).toEqual({ gmail: ['send'], slack: ['post'] })
+    })
+
+    it('removes the piece key when its list is empty', () => {
+        const current = { ...base, requiredActions: { mode: RequiredActionsMode.ANY, actions: { slack: ['post'] } } }
+        const result = pieceSetConfigUtil.applyUpdate({ current, request: { requiredActions: { actions: { slack: [] } } } })
+        expect(result.requiredActions.actions).toEqual({})
+    })
+
+    it('changes the mode only when the request has one', () => {
+        const current = { ...base, requiredActions: { mode: RequiredActionsMode.ANY, actions: { slack: ['post'] } } }
+        expect(pieceSetConfigUtil.applyUpdate({ current, request: { requiredActions: { mode: RequiredActionsMode.ALL } } }).requiredActions)
+            .toEqual({ mode: RequiredActionsMode.ALL, actions: { slack: ['post'] } })
+        expect(pieceSetConfigUtil.applyUpdate({ current, request: { require
```

---

### Incident Patch 10: `77a48fe5` (2026-10-05)
**Commit Message**: fix(flows): steps inside a skipped parent no longer block publish (#15951)

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `bun.lock` (modified, +2/-2)
```diff
@@ -120,7 +120,7 @@
     },
     "packages/core/execution": {
       "name": "@activepieces/core-execution",
-      "version": "0.23.6",
+      "version": "0.24.0",
       "dependencies": {
         "@activepieces/core-piece-types": "workspace:*",
         "@activepieces/core-utils": "workspace:*",
@@ -7669,7 +7669,7 @@
     },
     "packages/pieces/community/reddit": {
       "name": "@activepieces/piece-reddit",
-      "version": "0.3.0",
+      "version": "0.4.0",
       "dependencies": {
         "@activepieces/core-piece-types": "workspace:*",
         "@activepieces/core-utils": "workspace:*",
```

**File**: `packages/core/execution/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@activepieces/core-execution",
-  "version": "0.23.6",
+  "version": "0.24.0",
   "type": "commonjs",
   "main": "./dist/src/index.js",
   "scripts": {
```

**File**: `packages/core/execution/src/lib/flows/operations/index.ts` (modified, +2/-4)
```diff
@@ -427,10 +427,8 @@ export const flowOperations = {
             default:
                 break
         }
-        clonedVersion.valid = flowStructureUtil.getAllSteps(clonedVersion.trigger).every((step) => {
-            const isSkipped = step.type != FlowTriggerType.EMPTY && step.type != FlowTriggerType.PIECE && step.skip
-            return step.valid || isSkipped
-        })
+        const skippedStepNames = flowStructureUtil.getSkippedStepNames({ trigger: clonedVersion.trigger })
+        clonedVersion.valid = flowStructureUtil.getAllSteps(clonedVersion.trigger).every((step) => step.valid || skippedStepNames.has(step.name))
         return clonedVersion
     },
 }
```

**File**: `packages/core/execution/src/lib/flows/util/flow-canvas-util.ts` (modified, +3/-11)
```diff
@@ -47,7 +47,7 @@ function getFlowBoundingBox(step: Step | FlowAction | null | undefined, forBranc
             withChildHeight = merged.height
         }
     }
-    else if (hasContinueOnFailureBranches(step)) {
+    else if (flowStructureUtil.hasContinueOnFailureBranches(step)) {
         const branches = getContinueOnFailureBranchPair(step)
         const childBoundingBoxes = branches.map(b => getFlowBoundingBox(b, true))
         const merged = mergeBranchedChildBoundingBoxes(childBoundingBoxes)
@@ -92,7 +92,7 @@ function buildPositions({ step, offsetX, offsetY, positions }: {
         const subgraphEndY = positionBranchedChildren({ children: step.children, offsetX, offsetY, positions })
         buildPositions({ step: step.nextAction, offsetX, offsetY: offsetY + subgraphEndY, positions })
     }
-    else if (hasContinueOnFailureBranches(step)) {
+    else if (flowStructureUtil.hasContinueOnFailureBranches(step)) {
         const subgraphEndY = positionBranchedChildren({ children: getContinueOnFailureBranchPair(step), offsetX, offsetY, positions })
         buildPositions({ step: step.nextAction, offsetX, offsetY: offsetY + subgraphEndY, positions })
     }
@@ -169,20 +169,13 @@ function positionBranchedChildren({ children, offsetX, offsetY, positions }: {
     return FLOW_CANVAS_STEP_HEIGHT + FLOW_CANVAS_ROUTER_VOFFSET + maxChildHeight + FLOW_CANVAS_ARC + FLOW_CANVAS_VSPACE
 }
 
-function hasContinueOnFailureBranches(step: Step | FlowAction): step is CodeAction | PieceAction {
-    if (step.type !== FlowActionType.CODE && step.type !== FlowActionType.PIECE) {
-        return false
-    }
-    return step.settings.errorHandlingOptions?.continueOnFailure?.value ?? false
-}
-
 function getContinueOnFailureBranchPair(step: CodeAction | PieceAction): (FlowAction | undefined)[] {
     const branches = step.continueOnFailureBranches
     return [branches?.onSuccess, branches?.onFailure]
 }
 
 function getStepBranchRelativeTo(ancestor: Step | FlowAction, targetStepName: string): 'on-success' | 'on-failure' | null {
-    if (!hasContinueOnFailureBranches(ancestor)) {
+    if (!flowStructureUtil.hasContinueOnFailureBranches(ancestor)) {
         return null
     }
     const [onSuccess, onFailure] = getContinueOnFailureBranchPair(ancestor)
@@ -205,7 +198,6 @@ export const flowCanvasUtils = {
         buildPositions({ step: trigger, offsetX: 0, offsetY: 0, positions })
         return positions
     },
-    hasContinueOnFailureBranches,
     getContinueOnFailureBranchPair,
     getStepBranchRelativeTo,
     computeRouterChildOffsets,
```

**File**: `packages/core/execution/src/lib/flows/util/flow-structure-util.ts` (modified, +20/-1)
```diff
@@ -1,7 +1,7 @@
 import { AgentPieceProps } from '@activepieces/core-piece-types'
 import { isNil, unique } from '@activepieces/core-utils'
 import { ActivepiecesError, ErrorCode } from '@activepieces/core-utils'
-import { BranchCondition, BranchedAction, BranchExecutionType, emptyCondition, FlowAction, FlowActionType } from '../actions/action'
+import { BranchCondition, BranchedAction, BranchExecutionType, CodeAction, emptyCondition, FlowAction, FlowActionType, PieceAction } from '../actions/action'
 import { FlowVersion } from '../flow-version'
 import { FlowTrigger, FlowTriggerType } from '../triggers/trigger'
 
@@ -195,6 +195,22 @@ function getAllChildSteps(action: Step): Step[] {
     })
 }
 
+function hasContinueOnFailureBranches(step: Step): step is CodeAction | PieceAction {
+    if (step.type !== FlowActionType.CODE && step.type !== FlowActionType.PIECE) {
+        return false
+    }
+    return step.settings.errorHandlingOptions?.continueOnFailure?.value ?? false
+}
+
+function getSkippedStepNames({ trigger }: { trigger: FlowTrigger }): Set<string> {
+    const skippedSteps = getAllSteps(trigger).filter((step) => isAction(step.type) && 'skip' in step && step.skip === true)
+    return new Set(skippedSteps.flatMap((step) => getAllChildSteps(step).map((child) => child.name)))
+}
+
+function isSkipped({ stepName, trigger }: { stepName: string, trigger: FlowTrigger }): boolean {
+    return getSkippedStepNames({ trigger }).has(stepName)
+}
+
 function isChildOf(parent: Step, childStepName: string): boolean {
     return getAllChildSteps(parent).some((c) => c.name === childStepName && c.name !== parent.name)
 }
@@ -297,6 +313,9 @@ export const flowStructureUtil = {
     findUnusedNames,
     getAllNextActionsWithoutChildren,
     getAllChildSteps,
+    hasContinueOnFailureBranches,
+    getSkippedStepNames,
+    isSkipped,
     extractConnectionIds,
     isAgentPiece,
     isBranchedAction,
```

**File**: `packages/core/execution/test/flow/skipped-steps.test.ts` (added, +150/-0)
```diff
@@ -0,0 +1,150 @@
+import { BranchExecutionType, CodeAction, FlowAction, FlowActionType, FlowOperationType, flowOperations, flowStructureUtil, FlowTriggerType, FlowVersion, FlowVersionState, LoopOnItemsAction, RouterAction, RouterExecutionType } from '../../src'
+
+function codeStep({ name, valid = true, skip, continueOnFailure = false, onSuccess, onFailure, nextAction }: { name: string, valid?: boolean, skip?: boolean, continueOnFailure?: boolean, onSuccess?: FlowAction, onFailure?: FlowAction, nextAction?: FlowAction }): CodeAction {
+    return {
+        name,
+        type: FlowActionType.CODE,
+        valid,
+        skip,
+        displayName: name,
+        lastUpdatedDate: '2026-09-28T00:00:00.000Z',
+        settings: {
+            sourceCode: { code: '', packageJson: '{}' },
+            input: {},
+            errorHandlingOptions: {
+                continueOnFailure: { value: continueOnFailure },
+                retryOnFailure: { value: false },
+            },
+        },
+        continueOnFailureBranches: onSuccess || onFailure ? { onSuccess, onFailure } : undefined,
+        nextAction,
+    }
+}
+
+function routerStep({ name, skip, children, nextAction }: { name: string, skip?: boolean, children: (FlowAction | null)[], nextAction?: FlowAction }): RouterAction {
+    return {
+        name,
+        type: FlowActionType.ROUTER,
+        valid: true,
+        skip,
+        displayName: name,
+        lastUpdatedDate: '2026-09-28T00:00:00.000Z',
+        settings: {
+            branches: children.map((_, index) => ({ branchName: `branch_${index}`, branchType: BranchExecutionType.CONDITION, conditions: [[]] })),
+            executionType: RouterExecutionType.EXECUTE_FIRST_MATCH,
+        },
+        children,
+        nextAction,
+    }
+}
+
+function loopStep({ name, skip, firstLoopAction, nextAction }: { name: string, skip?: boolean, firstLoopAction?: FlowAction, nextAction?: FlowAction }): LoopOnItemsAction {
+    return {
+        name,
+        type: FlowActionType.LOOP_ON_ITEMS,
+        valid: true,
+        skip,
+        displayName: name,
+        lastUpdatedDate: '2026-09-28T00:00:00.000Z',
+        settings: { items: '' },
+        firstLoopAction,
+        nextAction,
+    }
+}
+
+function flowWith(head: FlowAction): FlowVersion {
+    return {
+        id: 'version',
+        created: '2026-09-28T00:00:00.000Z',
+        updated: '2026-09-28T00:00:00.000Z',
+        flowId: 'flow',
+        displayName: 'Flow',
+        updatedBy: null,
+        valid: false,
+        schemaVersion: null,
+        agentIds: [],
+        state: FlowVersionState.DRAFT,
+        connectionIds: [],
+        backupFiles: null,
+        notes: [],
+        trigger: {
+            name: 'trigger',
+            type: FlowTriggerType.EMPTY,
+            valid: true,
+            displayName: 'Trigger',
+            lastUpdatedDate: '2026-09-28T00:00:00.000Z',
+            settings: {},
+            nextAction: head,
+        },
+    }
+}
+
+function rename(flowVersion: FlowVersion): FlowVersion {
+    return flowOperations.apply(flowVersion, { type: FlowOperationType.CHANGE_NAME, request: { displayName: 'Renamed' } })
+}
+
+describe('flowStructureUtil.getSkippedStepNames', () => {
+    it('includes a skipped loop and every step inside it, but not the step after it', () => {
+        const flowVersion = flowWith(loopStep({
+            name: 'step_1',
+            skip: true,
+            firstLoopAction: codeStep({ name: 'step_2' }),
+            nextAction: codeStep({ name: 'step_3' }),
+        }))
+        expect(flowStructureUtil.getSkippedStepNames({ trigger: flowVersion.trigger })).toEqual(new Set(['step_1', 'step_2']))
+    })
+
+    it('includes only the step itself for a skipped step without children', () => {
+        const flowVersion = flowWith(codeStep({ name: 'step_1', skip: true, nextAction: codeStep({ name: 'step_2' }) }))
+        expect(flowStructureUtil.getSkippedStepNames({ trigger: flowVersion.trigger })).toEqual(new Set(['step_1']))
+    })
+
+    it('includes a skipped router and the steps in every branch, but not the step after it', () => {
+        const flowVersion = flowWith(routerStep({
+            name: 'step_1',
+            skip: true,
+            children: [codeStep({ name: 'step_2' }), codeStep({ name: 'step_3' })],
+            nextAction: codeStep({ name: 'step_4' }),
+        }))
+        expect(flowStructureUtil.getSkippedStepNames({ trigger: flowVersion.trigger })).toEqual(new Set(['step_1', 'step_2', 'step_3']))
+    })
+
+    it('includes the success and failure branches of a skipped step with continue on failure', () => {
+        const flowVersion = flowWith(codeStep({
+            name: 'step_1',
+            skip: true,
+            continueOnFailure: true,
+            onSuccess: codeStep({ name: 'step_2' }),
+            onFailure: codeStep({ name: 'step_3' }),
+            nextAction: codeStep({ name: 'step_4' }),
+        }))
+        expect(flowStr
```

**File**: `packages/server/api/src/app/mcp/tools/ap-flow-structure.ts` (modified, +9/-8)
```diff
@@ -1,5 +1,5 @@
 import { isNil, Permission } from '@activepieces/core-utils'
-import { BranchCondition, BranchExecutionType, FlowActionType, flowCanvasUtils, flowStructureUtil, FlowTriggerType, McpToolDefinition, Note, ProjectScopedMcpServer, StepLocationRelativeToParent } from '@activepieces/shared'
+import { BranchCondition, BranchExecutionType, FlowActionType, flowCanvasUtils, flowStructureUtil, FlowTrigger, FlowTriggerType, McpToolDefinition, Note, ProjectScopedMcpServer, StepLocationRelativeToParent } from '@activepieces/shared'
 import type { Step } from '@activepieces/shared'
 import { FastifyBaseLogger } from 'fastify'
 import { z } from 'zod'
@@ -19,8 +19,8 @@ type StepInfo = {
     configStatus: string
 }
 
-function getConfigStatus(step: Step): string {
-    if ((step as { skip?: boolean }).skip) return 'skipped'
+function getConfigStatus({ step, skippedStepNames }: { step: Step, skippedStepNames: Set<string> }): string {
+    if (skippedStepNames.has(step.name)) return 'skipped'
     if (step.valid) return 'configured'
     const s = step.settings as { triggerName?: string, actionName?: string }
     switch (step.type) {
@@ -114,8 +114,9 @@ function formatBranchConditions(conditions: BranchCondition[][]): string {
     return groups.join(' OR ')
 }
 
-function buildFlowStructure(trigger: Step): { structure: StepInfo[], stepByName: Map<string, Step> } {
+function buildFlowStructure(trigger: FlowTrigger): { structure: StepInfo[], stepByName: Map<string, Step> } {
     const allSteps = flowStructureUtil.getAllSteps(trigger)
+    const skippedStepNames = flowStructureUtil.getSkippedStepNames({ trigger })
     const stepByName = new Map(allSteps.map(s => [s.name, s]))
     const structure = allSteps.map((step): StepInfo => {
         if (flowStructureUtil.isTrigger(step.type)) {
@@ -126,8 +127,8 @@ function buildFlowStructure(trigger: Step): { structure: StepInfo[], stepByName:
                 parentName: null,
                 relationship: 'trigger',
                 valid: step.valid,
-                skip: (step as { skip?: boolean }).skip,
-                configStatus: getConfigStatus(step),
+                skip: skippedStepNames.has(step.name),
+                configStatus: getConfigStatus({ step, skippedStepNames }),
             }
         }
         let parentName: string | null = null
@@ -177,8 +178,8 @@ function buildFlowStructure(trigger: Step): { structure: StepInfo[], stepByName:
             relationship,
             ...(relationship === 'branch' && { branchIndex, branchName }),
             valid: step.valid,
-            skip: (step as { skip?: boolean }).skip,
-            configStatus: getConfigStatus(step),
+            skip: skippedStepNames.has(step.name),
+            configStatus: getConfigStatus({ step, skippedStepNames }),
         }
     })
     return { structure, stepByName }
```

**File**: `packages/server/api/src/app/mcp/tools/ap-lock-and-publish.ts` (modified, +2/-1)
```diff
@@ -31,7 +31,8 @@ export const apLockAndPublishTool = ({ mcp, userId }: McpToolContext, log: Fasti
             }
 
             const allSteps = flowStructureUtil.getAllSteps(flow.version.trigger)
-            const invalidSteps = allSteps.filter(s => !s.valid && !(s as { skip?: boolean }).skip)
+            const skippedStepNames = flowStructureUtil.getSkippedStepNames({ trigger: flow.version.trigger })
+            const invalidSteps = allSteps.filter(s => !s.valid && !skippedStepNames.has(s.name))
             if (invalidSteps.length > 0) {
                 const stepList = invalidSteps.map(s => `"${s.name}" (${s.displayName})`).join(', ')
                 return {
```

---

### Incident Patch 11: `b82dd20b` (2026-10-05)
**Commit Message**: fix(chat): stop the chat getting stuck on a setting it already removed (#16111)

**File**: `packages/server/api/src/app/mcp/tools/ap-build-flow.ts` (modified, +22/-9)
```diff
@@ -1,4 +1,4 @@
-import { Permission } from '@activepieces/core-utils'
+import { isNil, Permission } from '@activepieces/core-utils'
 import { FlowActionType, FlowCreatorType, FlowOperationType, flowStructureUtil, FlowTriggerType, McpToolContext, McpToolDefinition, PieceTrigger, StepLocationRelativeToParent, UpdateActionRequest } from '@activepieces/shared'
 import { FastifyBaseLogger } from 'fastify'
 import { z } from 'zod'
@@ -96,8 +96,9 @@ export const apBuildFlowTool = ({ mcp, userId }: McpToolContext, log: FastifyBas
                     return triggerVersionResult.error
                 }
 
+                const triggerUnknown = await mcpUtils.dropUnknownInputProps({ pieceName: triggerVersionResult.normalizedPieceName, pieceVersion: triggerVersionResult.pieceVersion, componentName: trigger.triggerName, componentType: 'trigger', input: trigger.input, platformId, log })
                 const triggerInput = {
-                    ...(trigger.input ?? {}),
+                    ...triggerUnknown.input,
                     ...(trigger.auth ? { auth: `{{connections['${trigger.auth}']}}` } : {}),
                 }
                 const triggerPayload = PieceTrigger.parse({
@@ -119,7 +120,6 @@ export const apBuildFlowTool = ({ mcp, userId }: McpToolContext, log: FastifyBas
                     operation: { type: FlowOperationType.UPDATE_TRIGGER, request: triggerPayload },
                 })
                 const unknownPropFindings: string[] = []
-                const triggerUnknown = await mcpUtils.detectUnknownInputProps({ pieceName: triggerVersionResult.normalizedPieceName, pieceVersion: triggerVersionResult.pieceVersion, componentName: trigger.triggerName, componentType: 'trigger', input: trigger.input, platformId, log })
                 if (triggerUnknown.unknownKeys.length > 0) {
                     unknownPropFindings.push(`trigger: ${triggerUnknown.message}`)
                 }
@@ -148,7 +148,8 @@ export const apBuildFlowTool = ({ mcp, userId }: McpToolContext, log: FastifyBas
                         resolvedPieceName = versionResult.normalizedPieceName
                     }
 
-                    const rewritten = mcpUtils.rewriteAllReferences({ input: step.input, loopItems: step.loopItems, trigger: latestTrigger })
+                    const stepUnknown = await knownStepInput({ step, pieceName: resolvedPieceName, pieceVersion: resolvedPieceVersion, platformId, log })
+                    const rewritten = mcpUtils.rewriteAllReferences({ input: stepUnknown.input, loopItems: step.loopItems, trigger: latestTrigger })
                     const rewrittenStep = { ...step, input: rewritten.input, loopItems: rewritten.loopItems }
                     const skeleton = buildSkeleton({ step: rewrittenStep, name: stepName, resolvedPieceVersion, resolvedPieceName })
                     const parseResult = UpdateActionRequest.safeParse(skeleton)
@@ -179,11 +180,8 @@ export const apBuildFlowTool = ({ mcp, userId }: McpToolContext, log: FastifyBas
                         },
                     })
 
-                    if (step.type === FlowActionType.PIECE && resolvedPieceName && resolvedPieceVersion && step.actionName) {
-                        const stepUnknown = await mcpUtils.detectUnknownInputProps({ pieceName: resolvedPieceName, pieceVersion: resolvedPieceVersion, componentName: step.actionName, componentType: 'action', input: step.input, platformId, log })
-                        if (stepUnknown.unknownKeys.length > 0) {
-                            unknownPropFindings.push(`${stepName} (${step.displayName}): ${stepUnknown.message}`)
-                        }
+                    if (stepUnknown.unknownKeys.length > 0) {
+                        unknownPropFindings.push(`${stepName} (${step.displayName}): ${stepUnknown.message}`)
                     }
 
                     if (location === StepLocationRelativeToParent.AFTER) {
@@ -228,6 +226,21 @@ export const apBuildFlowTool = ({ mcp, userId }: McpToolContext, log: FastifyBas
     }
 }
 
+async function knownStepInput({ step, pieceName, pieceVersion, platformId, log }: {
+    step: z.infer<typeof stepSpec>
+    pieceName: string | undefined
+    pieceVersion: string | undefined
+    platformId: string
+    log: FastifyBaseLogger
+}): Promise<{ input: Record<string, unknown> | undefined, unknownKeys: string[], message: string }> {
+    const actionName = step.actionName
+    const isPieceAction = step.type === FlowActionType.PIECE && !isNil(pieceName) && !isNil(pieceVersion) && !isNil(actionName)
+    if (!isPieceAction) {
+        return { input: step.input, unknownKeys: [], message: '' }
+    }
+    return mcpUtils.dropUnknownInputProps({ pieceName, pieceVersion, componentName: actionName, componentType: 'action', input: step.input, platformId, log })
+}
+
 function buildSkeleton({ step, name, resolvedPieceVersion, resolvedPieceName }: {
     step: z.infer<typeof stepSpec>
     name: string
```

**File**: `packages/server/api/src/app/mcp/tools/ap-update-step.ts` (modified, +6/-1)
```diff
@@ -135,10 +135,15 @@ export const apUpdateStepTool = ({ mcp, userId }: McpToolContext, log: FastifyBa
 
                 const { pieceName, pieceVersion, actionName: resolvedActionName } = updatedSettings
                 if (typeof pieceName === 'string' && typeof pieceVersion === 'string' && typeof resolvedActionName === 'string') {
-                    const unknownPropsError = await mcpUtils.rejectUnknownInputProps({ pieceName, pieceVersion, componentName: resolvedActionName, componentType: 'action', input: updatedSettings.input, platformId: project.platformId, log })
+                    const callerInput = {
+                        ...(rewritten.input ?? {}),
+                        ...(auth !== undefined && { auth: `{{connections['${auth}']}}` }),
+                    }
+                    const { input: knownInput, error: unknownPropsError } = await mcpUtils.keepKnownInputProps({ pieceName, pieceVersion, componentName: resolvedActionName, componentType: 'action', input: updatedSettings.input, callerInput, platformId: project.platformId, log })
                     if (unknownPropsError) {
                         return unknownPropsError
                     }
+                    updatedSettings.input = knownInput
                 }
             }
 
```

**File**: `packages/server/api/src/app/mcp/tools/ap-update-trigger.ts` (modified, +2/-4)
```diff
@@ -64,13 +64,11 @@ export const apUpdateTriggerTool = ({ mcp, userId }: McpToolContext, log: Fastif
 
             const { auth: _rawAuth, ...rawInputWithoutAuth } = rawInput ?? {}
             const rewritten = mcpUtils.rewriteAllReferences({ input: rawInputWithoutAuth, trigger: flow.version.trigger })
-            const input = {
-                ...(existingPieceSettings?.input ?? {}),
+            const callerInput = {
                 ...(rewritten.input ?? {}),
                 ...(auth !== undefined && { auth: `{{connections['${auth}']}}` }),
             }
-
-            const unknownPropsError = await mcpUtils.rejectUnknownInputProps({ pieceName: resolvedPieceName, pieceVersion, componentName: triggerName, componentType: 'trigger', input, platformId: project.platformId, log })
+            const { input, error: unknownPropsError } = await mcpUtils.keepKnownInputProps({ pieceName: resolvedPieceName, pieceVersion, componentName: triggerName, componentType: 'trigger', input: { ...(existingPieceSettings?.input ?? {}), ...callerInput }, callerInput, platformId: project.platformId, log })
             if (unknownPropsError) {
                 return unknownPropsError
             }
```

**File**: `packages/server/api/src/app/mcp/tools/mcp-utils.ts` (modified, +18/-0)
```diff
@@ -245,6 +245,22 @@ async function rejectUnknownInputProps(params: DetectUnknownInputPropsParams): P
     return { content: [{ type: 'text', text: `❌ ${message}` }] }
 }
 
+async function dropUnknownInputProps(params: DetectUnknownInputPropsParams): Promise<{ input: Record<string, unknown>, unknownKeys: string[], message: string }> {
+    const input = isObject(params.input) ? params.input : {}
+    const { unknownKeys, message } = await detectUnknownInputProps(params)
+    const knownInput = Object.fromEntries(Object.entries(input).filter(([key]) => !unknownKeys.includes(key)))
+    return { input: knownInput, unknownKeys, message }
+}
+
+async function keepKnownInputProps({ callerInput, ...params }: DetectUnknownInputPropsParams & { callerInput: Record<string, unknown> }): Promise<{ input: Record<string, unknown>, error: McpToolResult | null }> {
+    const { input, unknownKeys } = await dropUnknownInputProps(params)
+    const callerSentUnknownKey = unknownKeys.some((key) => key in callerInput)
+    if (callerSentUnknownKey) {
+        return { input, error: await rejectUnknownInputProps({ ...params, input: callerInput }) }
+    }
+    return { input, error: null }
+}
+
 const MAX_PROP_DEPTH = 3
 
 function buildPropSummaries(props: PiecePropertyMap, depth = 0): PropSummary[] {
@@ -807,6 +823,8 @@ export const mcpUtils = {
     coerceEmptyContainerInputs,
     detectUnknownInputProps,
     rejectUnknownInputProps,
+    dropUnknownInputProps,
+    keepKnownInputProps,
     buildPropSummaries,
     buildExampleInput,
     buildRequiredInputs,
```

**File**: `packages/server/api/test/integration/ce/mcp/mcp-tools.test.ts` (modified, +67/-1)
```diff
@@ -1,5 +1,5 @@
 import { apId } from '@activepieces/core-utils'
-import { FlowActionType, FlowCreatorType, FlowRunStatus, McpServerType, PackageType, PieceType, ProjectScopedMcpServer, RunEnvironment, StepLocationRelativeToParent } from '@activepieces/shared'
+import { FlowActionType, FlowCreatorType, FlowOperationType, FlowRunStatus, flowStructureUtil, FlowTriggerType, McpServerType, PackageType, PieceType, ProjectScopedMcpServer, RunEnvironment, StepLocationRelativeToParent } from '@activepieces/shared'
 import { FastifyBaseLogger, FastifyInstance } from 'fastify'
 import { StatusCodes } from 'http-status-codes'
 import { afterAll, beforeAll, describe, expect, it } from 'vitest'
@@ -79,6 +79,16 @@ beforeAll(async () => {
                     label: { type: 'SHORT_TEXT', displayName: 'Label', required: false },
                 },
             },
+            new_labeled_email: {
+                name: 'new_labeled_email',
+                displayName: 'New Labeled Email',
+                description: 'Triggers on new email with a label',
+                requireAuth: false,
+                props: {
+                    folder: { type: 'SHORT_TEXT', displayName: 'Folder', required: false },
+                    label: { type: 'SHORT_TEXT', displayName: 'Label', required: true },
+                },
+            },
             new_attachment: {
                 name: 'new_attachment',
                 displayName: 'New Attachment',
@@ -2738,4 +2748,60 @@ describe('MCP Tools integration', () => {
         expect(flow?.folderId).toBeNull()
         expect(text(created)).not.toContain('in folder')
     })
+
+    it('ap_build_flow drops unknown properties from steps that are not valid yet, so a later update is not rejected for them', async () => {
+        const ctx = await createTestContext(app)
+        const mcp = makeMcp(ctx.project.id)
+
+        const built = await apBuildFlowTool({ mcp }, mockLog).execute({
+            flowName: 'Unknown props',
+            trigger: { pieceName: '@activepieces/piece-test-email', triggerName: 'new_labeled_email', input: { folder: 'INBOX', method: 'POST' } },
+            steps: [{ type: FlowActionType.PIECE, displayName: 'Send', pieceName: '@activepieces/piece-test-email', actionName: 'send_email', input: { to: 'a@b.co', bogus: 'x' } }],
+        })
+        const { flowId } = structured({ result: built, schema: z.object({ flowId: z.string() }) })
+        const builtFlow = await flowService(mockLog).getOnePopulatedOrThrow({ id: flowId, projectId: ctx.project.id })
+
+        const triggerUpdate = await apUpdateTriggerTool({ mcp }, mockLog).execute({ flowId, pieceName: '@activepieces/piece-test-email', triggerName: 'new_labeled_email', input: { label: 'urgent' } })
+        const stepUpdate = await apUpdateStepTool({ mcp }, mockLog).execute({ flowId, stepName: 'step_1', input: { subject: 'Hello' } })
+        const rejected = await apUpdateStepTool({ mcp }, mockLog).execute({ flowId, stepName: 'step_1', input: { nope: 'x' } })
+        const updatedFlow = await flowService(mockLog).getOnePopulatedOrThrow({ id: flowId, projectId: ctx.project.id })
+
+        expect(text(built)).toContain('dropped')
+        expect(builtFlow.version.trigger.valid).toBe(false)
+        expect(builtFlow.version.trigger.settings.input).not.toHaveProperty('method')
+        expect(flowStructureUtil.getStepOrThrow('step_1', builtFlow.version.trigger).settings.input).not.toHaveProperty('bogus')
+        expect(text(triggerUpdate)).not.toContain('Unknown properties')
+        expect(text(stepUpdate)).not.toContain('Unknown properties')
+        expect(text(rejected)).toContain("Unknown properties: 'nope'")
+        expect(updatedFlow.version.trigger.settings.input).toMatchObject({ folder: 'INBOX', label: 'urgent' })
+        expect(flowStructureUtil.getStepOrThrow('step_1', updatedFlow.version.trigger).settings.input).toMatchObject({ to: 'a@b.co', subject: 'Hello' })
+    })
+
+    it('ap_update_trigger clears a stale unknown property saved on a trigger that is not valid yet', async () => {
+        const ctx = await createTestContext(app)
+        const mcp = makeMcp(ctx.project.id)
+        const flowId = await createFlowAndGetId(mcp, 'Stale props')
+        const flow = await flowService(mockLog).getOnePopulatedOrThrow({ id: flowId, projectId: ctx.project.id })
+        await flowService(mockLog).update({
+            id: flowId, projectId: ctx.project.id, userId: null, platformId: ctx.platform.id,
+            operation: {
+                type: FlowOperationType.UPDATE_TRIGGER,
+                request: {
+                    name: flow.version.trigger.name,
+                    displayName: 'New Labeled Email',
+                    valid: false,
+                    type: FlowTriggerType.PIECE,
+                    settings: { pieceName: '@activepieces/piece-test-email', pieceVersion: '0.1.0', triggerName: 'new_labeled_email', input: { folder: 'INBOX', method: 'POST' }, propertySetting
```

---

### Incident Patch 12: `7a4f0ec1` (2026-10-05)
**Commit Message**: feat(ci): nightly benchmark cron with regression alerts + HyperDX dashboard (#15723)

**File**: `.github/workflows/benchmark.yml` (modified, +196/-79)
```diff
@@ -4,123 +4,237 @@ on:
   workflow_dispatch:
     inputs:
       total_requests:
-        description: 'Total number of requests for hey'
+        description: 'Total number of requests for the benchmark'
         required: false
-        default: '500'
+        default: '2000'
+  schedule:
+    - cron: '0 3 * * *'
+
 jobs:
   benchmark:
-    runs-on: depot-ubuntu-24.04-16
+    runs-on: depot-ubuntu-24.04-32
     timeout-minutes: 30
     env:
       AP_FILE_STORAGE_LOCATION: ${{ secrets.AP_FILE_STORAGE_LOCATION }}
-      AP_EXECUTION_MODE: SANDBOX_CODE_ONLY
+      AP_EXECUTION_MODE: SANDBOX_PROCESS
       AP_S3_BUCKET: ${{ secrets.AP_S3_BUCKET }}
       AP_S3_ACCESS_KEY_ID: ${{ secrets.AP_S3_ACCESS_KEY_ID }}
       AP_S3_SECRET_ACCESS_KEY: ${{ secrets.AP_S3_SECRET_ACCESS_KEY }}
       AP_S3_ENDPOINT: ${{ secrets.AP_S3_ENDPOINT }}
       AP_S3_REGION: ${{ secrets.AP_S3_REGION }}
       AP_S3_USE_SIGNED_URLS: ${{ secrets.AP_S3_USE_SIGNED_URLS }}
+      TOTAL_REQUESTS: ${{ inputs.total_requests || '2000' }}
     strategy:
+      fail-fast: false
       matrix:
         include:
-          - apps: 1
-            workers: 2
-            label: "1app-2workers"
-          - apps: 2
-            workers: 4
-            label: "2app-4workers"
-          - apps: 3
-            workers: 6
-            label: "3app-6workers"
-          - apps: 1
-            workers: 4
-            label: "1app-4workers"
-          - apps: 2
-            workers: 8
-            label: "2app-8workers"
-          - apps: 3
-            workers: 12
-            label: "3app-12workers"
+          # Both cells: 28 × 0.5cpu / 1 GB / 1 slot / heap 768M — mirrors the
+          # per-host density Kamal deploys on prod 16-vCPU worker boxes.
+          # Only AP_REUSE_SANDBOX differs, so any per-cell delta isolates
+          # the reuse variable.
+          - label: "shared"
+            apps: 1
+            workers: 28
+            worker_cpus: '0.5'
+            worker_memory: '1G'
+            worker_concurrency: '1'
+            worker_heap_mb: '768'
+            reuse: 'false'
+            total_slots: 28
+          - label: "dedicated"
+            apps: 1
+            workers: 28
+            worker_cpus: '0.5'
+            worker_memory: '1G'
+            worker_concurrency: '1'
+            worker_heap_mb: '768'
+            reuse: 'true'
+            total_slots: 28
 
     steps:
       - name: Checkout
         uses: actions/checkout@v5
 
+      - name: Setup Bun
+        uses: oven-sh/setup-bun@v2
+        with:
+          bun-version: latest
+
+      - name: Install monorepo deps (for CLI)
+        run: bun install --frozen-lockfile
+
       - name: Build Docker image
         run: docker build -t activepieces-benchmark:local .
 
+      - name: Export cell env (compose reads these on every invocation)
+        run: |
+          {
+            echo "APP_REPLICAS=${{ matrix.apps }}"
+            echo "WORKER_REPLICAS=${{ matrix.workers }}"
+            echo "WORKER_CPUS=${{ matrix.worker_cpus }}"
+            echo "WORKER_MEMORY=${{ matrix.worker_memory }}"
+            echo "WORKER_HEAP_MB=${{ matrix.worker_heap_mb }}"
+            echo "AP_WORKER_CONCURRENCY=${{ matrix.worker_concurrency }}"
+            echo "AP_REUSE_SANDBOX=${{ matrix.reuse }}"
+          } >> "$GITHUB_ENV"
+
       - name: Start benchmark stack
         run: |
-          APP_REPLICAS=${{ matrix.apps }} \
-          WORKER_REPLICAS=${{ matrix.workers }} \
-            docker compose -f benchmark/docker-compose.yml up -d
+          docker compose -f benchmark/docker-compose.yml -f benchmark/docker-compose.ci.yml up -d
           echo "Waiting for containers to start..."
           sleep 5
-          docker compose -f benchmark/docker-compose.yml ps
+          docker compose -f benchmark/docker-compose.yml -f benchmark/docker-compose.ci.yml ps
 
-      - name: Setup flow and wait for app
+      - name: Verify container caps (proves the per-cell shape, cpuset partitioned)
+        run: |
+          echo "=== Container CPU / memory / cpuset (as Docker actually applied) ==="
+          for c in $(docker compose -f benchmark/docker-compose.yml -f benchmark/docker-compose.ci.yml ps -q); do
+            docker inspect "$c" --format '{{.Name}}  quota={{.HostConfig.CpuQuota}}  period={{.HostConfig.CpuPeriod}}  cpuset={{if .HostConfig.CpusetCpus}}{{.HostConfig.CpusetCpus}}{{else}}(any){{end}}  memBytes={{.HostConfig.Memory}}'
+          done
+          echo
+          echo "Effective vCPU = quota / period.  Expected this cell:"
+          echo "  app    → 2.00 vCPU (200000/100000)   cpuset 16-17"
+          echo "  worker → ${{ matrix.worker_cpus }} vCPU                cpuset 0-15 (${{ matrix.workers }} replica(s))"
+
+      - name: Setup flow, platform API key, and wait for app
         id: setup
         run: |
-          chmod +x benchmark/setup.sh
-          FLOW_ID=$(benchmark/setup.sh)
+          FLOW_ID=$(BENCH_API_KEY_FILE=/tmp/bench-api-key BENCH_PROJECT_ID_FILE=
```

**File**: `.github/workflows/dast.yml` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ jobs:
           # Sign in with the throwaway account. On cloud, an already-onboarded account
           # returns a USER token with a projectId; a fresh account returns an ONBOARDING
           # token (projectId null) which we complete by creating a platform. Mirrors
-          # benchmark/setup.sh.
+          # benchmark/setup.ts.
           SIGNIN=$(curl -s "${BASE_URL}/authentication/sign-in" \
             -H "Content-Type: application/json" \
             -d "{\"email\":\"${DAST_STG_EMAIL}\",\"password\":\"${DAST_STG_PASSWORD}\"}")
```

**File**: `.github/workflows/smoke-test.yml` (modified, +12/-8)
```diff
@@ -36,6 +36,11 @@ jobs:
       - name: Checkout
         uses: actions/checkout@v5
 
+      - name: Setup Bun (for benchmark/setup.ts)
+        uses: oven-sh/setup-bun@v2
+        with:
+          bun-version: latest
+
       - name: Build Docker image
         run: docker build -t activepieces-benchmark:local .
 
@@ -51,8 +56,7 @@ jobs:
       - name: Setup flow
         id: setup
         run: |
-          chmod +x benchmark/setup.sh
-          FLOW_ID=$(benchmark/setup.sh)
+          FLOW_ID=$(bun run benchmark/setup.ts)
           echo "flow_id=$FLOW_ID" >> "$GITHUB_OUTPUT"
           echo "Flow ID: $FLOW_ID"
 
@@ -87,7 +91,7 @@ jobs:
         if: matrix.executionMode == 'SANDBOX_CODE_ONLY'
         id: setup-oom
         run: |
-          FLOW_ID=$(CODE_BODY_FILE=benchmark/oom-code.js benchmark/setup.sh)
+          FLOW_ID=$(CODE_BODY_FILE=benchmark/oom-code.js bun run benchmark/setup.ts)
           echo "flow_id=$FLOW_ID" >> "$GITHUB_OUTPUT"
           echo "Flow ID: $FLOW_ID"
 
@@ -120,8 +124,8 @@ jobs:
         if: matrix.executionMode == 'SANDBOX_CODE_ONLY'
         id: setup-s3
         run: |
-          chmod +x benchmark/setup.sh
-          FLOW_ID=$(benchmark/setup.sh)
+          
+          FLOW_ID=$(bun run benchmark/setup.ts)
           echo "flow_id=$FLOW_ID" >> "$GITHUB_OUTPUT"
           echo "Flow ID: $FLOW_ID"
 
@@ -155,8 +159,8 @@ jobs:
         if: matrix.executionMode == 'SANDBOX_CODE_ONLY'
         id: setup-s3-signed
         run: |
-          chmod +x benchmark/setup.sh
-          FLOW_ID=$(benchmark/setup.sh)
+          
+          FLOW_ID=$(bun run benchmark/setup.ts)
           echo "flow_id=$FLOW_ID" >> "$GITHUB_OUTPUT"
           echo "Flow ID: $FLOW_ID"
 
@@ -172,7 +176,7 @@ jobs:
       # the bottleneck, not our code), permanently below the 40 req/s threshold, so it would fail
       # every release. It is not measuring a code regression. Run it on controlled hardware:
       #   docker compose -f benchmark/docker-compose.yml -f benchmark/docker-compose.perf.yml up -d
-      #   benchmark/setup.sh && smoke-test/verify-perf.sh <flow-id>
+      #   bun run benchmark/setup.ts && smoke-test/verify-perf.sh <flow-id>
       # (both verify-perf.sh and docker-compose.perf.yml are kept in the repo for that.)
 
       # All overlays are listed so logs + teardown resolve regardless of which stack
```

**File**: `benchmark/aggregate-stats.mjs` (added, +75/-0)
```diff
@@ -0,0 +1,75 @@
+#!/usr/bin/env node
+import { readFileSync } from 'node:fs'
+
+const INPUT = process.argv[2]
+if (!INPUT) {
+    console.error('usage: aggregate-stats.mjs <stats.jsonl>')
+    process.exit(2)
+}
+
+const raw = readFileSync(INPUT, 'utf8').split('\n').filter(Boolean)
+const samples = []
+for (const line of raw) {
+    try {
+        samples.push(JSON.parse(line))
+    }
+    catch {
+        // skip malformed lines (docker stats occasionally interleaves)
+    }
+}
+
+function parseMemUsageMB(memUsage) {
+    const first = memUsage.split('/')[0].trim()
+    const match = first.match(/^([0-9.]+)\s*(GiB|MiB|KiB|B)$/)
+    if (!match) return 0
+    const value = Number(match[1])
+    switch (match[2]) {
+    case 'GiB': return value * 1024
+    case 'MiB': return value
+    case 'KiB': return value / 1024
+    case 'B': return value / (1024 * 1024)
+    default: return 0
+    }
+}
+
+function parseCpuPct(cpuPerc) {
+    return Number(cpuPerc.replace('%', '')) || 0
+}
+
+function classify(name) {
+    if (name.includes('-worker-') || name.endsWith('-worker')) return 'worker'
+    if (name.includes('-app-') || name.endsWith('-app')) return 'app'
+    return 'other'
+}
+
+function quantile(sorted, q) {
+    if (sorted.length === 0) return 0
+    const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1))))
+    return sorted[idx]
+}
+
+const buckets = { app: { cpu: [], mem: [] }, worker: { cpu: [], mem: [] } }
+for (const s of samples) {
+    const role = classify(s.Name || '')
+    if (role === 'other') continue
+    buckets[role].cpu.push(parseCpuPct(s.CPUPerc || '0%'))
+    buckets[role].mem.push(parseMemUsageMB(s.MemUsage || '0MiB'))
+}
+
+function summarize(values) {
+    if (values.length === 0) return { samples: 0, max: 0, p95: 0, p50: 0 }
+    const sorted = [...values].sort((a, b) => a - b)
+    return {
+        samples: sorted.length,
+        max: sorted[sorted.length - 1],
+        p95: quantile(sorted, 0.95),
+        p50: quantile(sorted, 0.5),
+    }
+}
+
+const summary = {
+    app: { cpuPct: summarize(buckets.app.cpu), memMb: summarize(buckets.app.mem) },
+    worker: { cpuPct: summarize(buckets.worker.cpu), memMb: summarize(buckets.worker.mem) },
+}
+
+process.stdout.write(JSON.stringify(summary, null, 2) + '\n')
```

**File**: `benchmark/combine-results.mjs` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+#!/usr/bin/env node
+import { readFileSync, writeFileSync } from 'node:fs'
+
+const args = Object.fromEntries(
+    process.argv.slice(2).reduce((acc, curr, i, arr) => {
+        if (curr.startsWith('--')) acc.push([curr.slice(2), arr[i + 1]])
+        return acc
+    }, []),
+)
+
+const required = ['report', 'stats', 'sha', 'label', 'runId', 'out']
+for (const key of required) {
+    if (!args[key]) {
+        console.error(`missing --${key}`)
+        process.exit(2)
+    }
+}
+
+const report = JSON.parse(readFileSync(args.report, 'utf8'))
+const stats = JSON.parse(readFileSync(args.stats, 'utf8'))
+
+const run = report.runs?.[0]
+if (!run) {
+    console.error('report.runs[0] missing — CLI produced no phase results')
+    process.exit(1)
+}
+
+const s = run.summary ?? {}
+const t = run.timeline ?? {}
+
+const result = {
+    schemaVersion: 2,
+    meta: {
+        ts: new Date().toISOString(),
+        sha: args.sha,
+        label: args.label,
+        runId: args.runId,
+        loader: 'activepieces-cli',
+        cliTarget: report.meta?.target,
+        flowId: report.flowId,
+        connections: run.connections,
+        requests: run.requests,
+    },
+    latency: {
+        p50Ms: s.p50Ms ?? 0,
+        p90Ms: s.p90Ms ?? 0,
+        p99Ms: s.p99Ms ?? 0,
+        meanMs: s.latencyMeanMs ?? 0,
+        minMs: s.minMs ?? 0,
+        maxMs: s.maxMs ?? 0,
+    },
+    throughput: { reqSec: s.throughputReqSec ?? 0 },
+    counts: { ok2xx: s.ok2xx ?? 0, failed: s.failed ?? 0, errors: s.errors ?? 0, timeouts: s.timeouts ?? 0 },
+    timeline: {
+        sampleCount: t.sampleCount ?? 0,
+        queueWaitP50Ms: t.queueWaitP50 ?? 0,
+        queueWaitP90Ms: t.queueWaitP90 ?? 0,
+        serviceP50Ms: t.serviceP50 ?? 0,
+        serviceP90Ms: t.serviceP90 ?? 0,
+        queueMaxMs: t.queueMax ?? 0,
+        provisionP50Ms: t.provisionP50 ?? 0,
+        bootP50Ms: t.bootP50 ?? 0,
+        rateLimitedRuns: t.rateLimitedRunsCount ?? 0,
+    },
+    resources: stats,
+}
+
+writeFileSync(args.out, JSON.stringify(result, null, 2) + '\n')
+console.error(`Wrote ${args.out}`)
```

**File**: `benchmark/detect-regression.mjs` (added, +173/-0)
```diff
@@ -0,0 +1,173 @@
+#!/usr/bin/env node
+import { readFileSync } from 'node:fs'
+
+const args = Object.fromEntries(
+    process.argv.slice(2).reduce((acc, curr, i, arr) => {
+        if (curr.startsWith('--')) acc.push([curr.slice(2), arr[i + 1]])
+        return acc
+    }, []),
+)
+
+const required = ['current', 'label', 'runUrl']
+for (const key of required) {
+    if (!args[key]) {
+        console.error(`missing --${key}`)
+        process.exit(2)
+    }
+}
+
+if (!/^[a-z0-9-]+$/i.test(args.label)) {
+    console.error(`--label must match /^[a-z0-9-]+$/i, got ${args.label}`)
+    process.exit(2)
+}
+
+const THRESHOLD_PCT = Number(args.threshold ?? 5)
+const CONSECUTIVE = Number(args.consecutive ?? 2)
+const WEBHOOK_URL = process.env.BETTERSTACK_WEBHOOK_URL
+const CH_HOST = process.env.CH_HOST
+const CH_USER = process.env.CH_USER
+const CH_PASS = process.env.CH_PASS
+
+if (!CH_HOST || !CH_USER || !CH_PASS) {
+    console.error('CH_HOST / CH_USER / CH_PASS env vars are required')
+    process.exit(2)
+}
+
+const DIMENSIONS = [
+    { name: 'client p90', unit: 'ms', get: (r) => r.latency?.p90Ms ?? 0 },
+    { name: 'client p99', unit: 'ms', get: (r) => r.latency?.p99Ms ?? 0 },
+    { name: 'throughput', unit: 'req/s', get: (r) => r.throughput?.reqSec ?? 0, invert: true },
+    { name: 'queue wait p90', unit: 'ms', get: (r) => r.timeline?.queueWaitP90Ms ?? 0 },
+    { name: 'service p90', unit: 'ms', get: (r) => r.timeline?.serviceP90Ms ?? 0 },
+    { name: 'provision p50', unit: 'ms', get: (r) => r.timeline?.provisionP50Ms ?? 0 },
+    { name: 'boot p50', unit: 'ms', get: (r) => r.timeline?.bootP50Ms ?? 0 },
+    { name: 'worker cpu p95', unit: '%', get: (r) => r.resources?.worker?.cpuPct?.p95 ?? 0 },
+    { name: 'worker mem max', unit: 'MB', get: (r) => r.resources?.worker?.memMb?.max ?? 0 },
+    { name: 'app cpu p95', unit: '%', get: (r) => r.resources?.app?.cpuPct?.p95 ?? 0 },
+    { name: 'app mem max', unit: 'MB', get: (r) => r.resources?.app?.memMb?.max ?? 0 },
+]
+
+const current = JSON.parse(readFileSync(args.current, 'utf8'))
+const history = (await fetchHistory({ label: args.label })).reverse()
+
+console.error(`Loaded ${history.length} trailing rows for label=${args.label}`)
+
+const results = []
+for (const dim of DIMENSIONS) {
+    const currentValue = dim.get(current)
+    const historyValues = history.map(dim.get)
+    const baseline = median(historyValues)
+    const pct = shiftPct({ current: currentValue, baseline, invert: dim.invert })
+
+    const priorNeeded = Math.max(0, CONSECUTIVE - 1)
+    const recentValues = priorNeeded > 0 ? history.slice(-priorNeeded).map(dim.get) : []
+    const recentShifts = recentValues.map((v) => shiftPct({ current: v, baseline, invert: dim.invert }))
+    const consecutiveBreach = pct > THRESHOLD_PCT
+        && recentShifts.length >= priorNeeded
+        && recentShifts.every((s) => s > THRESHOLD_PCT)
+
+    results.push({ name: dim.name, unit: dim.unit, currentValue, baseline, pct, breach: consecutiveBreach })
+}
+
+const breaches = results.filter((r) => r.breach)
+const summary = {
+    label: args.label,
+    threshold: THRESHOLD_PCT,
+    consecutive: CONSECUTIVE,
+    historyCount: history.length,
+    dimensions: results,
+    breachCount: breaches.length,
+}
+process.stdout.write(JSON.stringify(summary, null, 2) + '\n')
+
+const MIN_HISTORY = Math.max(3, CONSECUTIVE)
+if (history.length < MIN_HISTORY) {
+    console.error(`History has ${history.length} entries (< ${MIN_HISTORY}); need more baselines before firing.`)
+    process.exit(0)
+}
+
+const ALERT_ID = `bench-regression-${args.label}`
+
+if (breaches.length === 0) {
+    console.error(`No regressions on ${args.label}.`)
+    if (!WEBHOOK_URL) process.exit(0)
+    await postToBetterstack({
+        name: `Bench regression: ${args.label}`,
+        cause: `No regressions on \`${args.label}\` (${results.length} dimensions all within ${THRESHOLD_PCT}% of trailing-14 median).\n\n[Run details →](${args.runUrl})`,
+        alertId: ALERT_ID,
+        state: 'ok',
+    })
+    process.exit(0)
+}
+
+if (!WEBHOOK_URL) {
+    console.error(`BREACH on ${args.label} but BETTERSTACK_WEBHOOK_URL unset — skipping alert.`)
+    process.exit(0)
+}
+
+const lines = breaches.map((b) => `- **${b.name}**: ${b.currentValue.toFixed(2)} ${b.unit} (baseline ${b.baseline.toFixed(2)}, +${b.pct.toFixed(1)}%)`)
+const cause = `Benchmark regression on \`${args.label}\` — ${breaches.length} dimension(s) above ${THRESHOLD_PCT}% for ${CONSECUTIVE} consecutive runs:\n\n${lines.join('\n')}\n\n[Run details →](${args.runUrl})\n\nSHA: \`${current.meta.sha}\``
+
+await postToBetterstack({
+    name: `Bench regression: ${args.label}`,
+    cause,
+    alertId: ALERT_ID,
+    state: 'alert',
+})
+console.error(`Alerted Betterstack on ${breaches.length} dimension(s).`)
+
+async function postToBetterstack(payload) {
+    const res = await fetch(WEBHOOK_URL, {
+        method: 'POST',
+        headers: { 'Content-Type': 'application
```

**File**: `benchmark/docker-compose.ci.yml` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+# CI-only override layered on top of docker-compose.yml.
+#
+# Keeps bench-specific config out of the base file so smoke-test.yml and dev
+# `docker compose up` keep running with CE defaults (base is unchanged from
+# the pre-SRE-229 shape).
+#
+# Adds, as a group, everything the nightly benchmark needs that the smoke
+# test does NOT want:
+#   - cpuset pinning (requires ≥18 cores — breaks smaller dev hosts; fine
+#     on the 32-vCPU CI runner).
+#   - AP_EDITION=ee (smoke-test runs CE by design, since most self-hosters
+#     are on CE; shouldn't be forced to EE just because the bench stack is).
+#   - AP_NETWORK_MODE=UNRESTRICTED / AP_PROJECT_WORKER: prod-parity env
+#     (matches Kamal shared tag). Note: prod's Kamal also sets
+#     AP_PRE_WARM_CACHE=true, but that is dead config — the server does
+#     not read it (removed), the current prewarm toggle is
+#     AP_PREWARM_CACHE_ON_STARTUP. We don't set either so cold-boot
+#     behavior matches real prod.
+#   - NODE_OPTIONS heap: sized to WORKER_HEAP_MB from the matrix.
+#   - AP_EXECUTION_MODE=SANDBOX_PROCESS: prod mode. Smoke-test keeps the
+#     SANDBOX_CODE_ONLY base default.
+#   - AP_REUSE_SANDBOX: required explicitly via ${:?} so you can't forget
+#     to pass it per matrix cell. Smoke-test needs the mode-aware default
+#     from canReuseSandbox() (its verify-memory.sh measures warm reuse).
+#   - cpus / memory / replicas: overridden per cell by matrix env vars.
+#
+# Layer usage (CI and run-local, not smoke-test):
+#   docker compose -f benchmark/docker-compose.yml -f benchmark/docker-compose.ci.yml up -d
+
+services:
+  app:
+    cpuset: "16-17"
+    environment:
+      AP_EDITION: ee
+      AP_NETWORK_MODE: UNRESTRICTED
+      AP_EXECUTION_MODE: ${AP_EXECUTION_MODE:-SANDBOX_PROCESS}
+
+  worker:
+    cpuset: "0-15"
+    environment:
+      AP_EDITION: ee
+      AP_NETWORK_MODE: UNRESTRICTED
+      AP_PROJECT_WORKER: 'false'
+      AP_EXECUTION_MODE: ${AP_EXECUTION_MODE:-SANDBOX_PROCESS}
+      AP_REUSE_SANDBOX: ${AP_REUSE_SANDBOX:?AP_REUSE_SANDBOX must be set (true|false) when using docker-compose.ci.yml}
+      AP_WORKER_CONCURRENCY: ${AP_WORKER_CONCURRENCY:-1}
+      NODE_OPTIONS: --max-old-space-size=${WORKER_HEAP_MB:-768}
+    deploy:
+      replicas: ${WORKER_REPLICAS:-4}
+      resources:
+        limits:
+          cpus: ${WORKER_CPUS:-0.5}
+          memory: ${WORKER_MEMORY:-1G}
```

**File**: `benchmark/parse.sh` (removed, +0/-78)
```diff
@@ -1,78 +0,0 @@
-#!/usr/bin/env bash
-set -euo pipefail
-
-INPUT_FILE="${1:-/tmp/hey-output.txt}"
-JSON_FILE="${2:-}"
-
-if [ ! -f "$INPUT_FILE" ]; then
-  echo "ERROR: hey output file not found: $INPUT_FILE"
-  exit 1
-fi
-
-echo ""
-echo "========================================="
-echo "         BENCHMARK RESULTS"
-echo "========================================="
-echo ""
-
-# Extract throughput (requests/sec)
-THROUGHPUT=$(grep "Requests/sec:" "$INPUT_FILE" | awk '{print $2}')
-echo "Throughput:     $THROUGHPUT req/s"
-
-# Extract average latency
-AVG_LATENCY=$(grep "Average:" "$INPUT_FILE" | head -1 | awk '{print $2}')
-echo "Mean latency:   ${AVG_LATENCY}s"
-
-# Extract fastest
-FASTEST=$(grep "Fastest:" "$INPUT_FILE" | awk '{print $2}')
-echo "Fastest:        ${FASTEST}s"
-
-# Extract slowest
-SLOWEST=$(grep "Slowest:" "$INPUT_FILE" | awk '{print $2}')
-echo "Slowest:        ${SLOWEST}s"
-
-# Extract status code distribution
-echo ""
-echo "Status codes:"
-sed -n '/Status code distribution/,/^$/p' "$INPUT_FILE" | grep -v "Status code distribution" | sed 's/^/  /'
-
-# Extract latency distribution (includes p50, p99 etc)
-echo ""
-echo "Latency distribution:"
-sed -n '/Latency distribution/,/^$/p' "$INPUT_FILE" | grep -v "Latency distribution" | sed 's/^/  /'
-
-# Calculate success rate
-TOTAL=$(grep '\[200\].*responses' "$INPUT_FILE" | awk '{print $2}' || echo "0")
-TOTAL_REQUESTS=$(grep "^  Total:" "$INPUT_FILE" | head -1 | awk '{print $2}' || echo "0")
-
-if [ -n "$TOTAL" ] && [ "$TOTAL" != "0" ]; then
-  echo ""
-  echo "200 OK count:   $TOTAL"
-fi
-
-echo ""
-echo "========================================="
-
-# Write JSON output if a second argument was provided
-if [ -n "$JSON_FILE" ]; then
-  # Extract latency distribution percentiles
-  P50=$(sed -n '/Latency distribution/,/^$/p' "$INPUT_FILE" | grep "50%" | awk '{print $3}')
-  P75=$(sed -n '/Latency distribution/,/^$/p' "$INPUT_FILE" | grep "75%" | awk '{print $3}')
-  P90=$(sed -n '/Latency distribution/,/^$/p' "$INPUT_FILE" | grep "90%" | awk '{print $3}')
-  P99=$(sed -n '/Latency distribution/,/^$/p' "$INPUT_FILE" | grep "99%" | awk '{print $3}')
-
-  cat > "$JSON_FILE" <<JSONEOF
-{
-  "throughput": "$THROUGHPUT",
-  "mean_latency": "$AVG_LATENCY",
-  "fastest": "$FASTEST",
-  "slowest": "$SLOWEST",
-  "ok_count": "$TOTAL",
-  "p50": "$P50",
-  "p75": "$P75",
-  "p90": "$P90",
-  "p99": "$P99"
-}
-JSONEOF
-  echo "JSON results written to $JSON_FILE"
-fi
```

---

### Incident Patch 13: `1849cf07` (2026-10-04)
**Commit Message**: fix(files): send upload file names as ASCII-safe headers (#15959)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>
Co-authored-by: copilot-swe-agent[bot] <[REDACTED_EMAIL]>

**File**: `brain/knowledge/data-storage-observability/file-storage.md` (modified, +1/-0)
```diff
@@ -32,6 +32,7 @@ The central service for persisting binary files, backing the execution engine an
 - User-facing docs: [Large File Streaming](../../../docs/build-pieces/piece-reference/large-file-streaming.mdx).
 
 ### Gotchas
+- **The engine's upload file name travels in a header, so it must be ASCII on the wire.** `x-ap-file-name` used to carry the raw name; Node fetch sends a Latin-1 char like `é` as the single byte `0xE9`, which is invalid UTF-8, and chars above 255 (`–`, emoji, CJK) throw `Cannot convert argument to a ByteString` before the request leaves. Behind Cloudflare the first case is a 403 from the managed rule *Anomaly:Header — Invalid UTF-8 Encoding*, surfacing as `EngineFileUploadError: … 403 Forbidden` (Alan, 2026-09-29, French document names). The engine now sends an ASCII fallback in `x-ap-file-name` plus `encodeURIComponent(name)` in `x-ap-file-name-encoded`; the app prefers the encoded one and falls back to the raw header, so old/new engines and apps interoperate in both directions. Never put user text in a header raw.
 - **On cloud the real key prefix is doubled — `<bucket>/<bucket>/…` — so ad-hoc CLI work against the bucket silently finds nothing.** Cloud's `AP_S3_ENDPOINT` embeds the bucket as a *path segment* (`https://<account>.r2.cloudflarestorage.com/ap-files-prod`), and `getS3Client` sets `forcePathStyle: true` whenever an endpoint is present, so the SDK appends the bucket again. An object the app stores as `pieces/x.tgz` actually lands at `ap-files-prod/pieces/x.tgz` inside bucket `ap-files-prod`. Symptom when you get it wrong: `aws s3 ls` returns `NoSuchKey` on a *prefix* listing (Aug 2026 — cost three attempts to spot). Strip the trailing `/<bucket>` from the endpoint for the CLI, then prepend the bucket name to the prefix; or better, do bulk work through `s3Helper` so the same client resolves the same paths. Note cloud's object store is **Cloudflare R2** while the piece CDN is a **DigitalOcean Space** — two different systems, easy to conflate.
 - **The live piece-bundle cache sits *inside* the legacy one — `pieces/v2/` is nested under `pieces/`, so a recursive delete of `pieces/` takes the active cache with it.** `S3_PIECES_PREFIX` in `piece-bundle.ts` is `pieces/v2/`; the bare `pieces/` keys beside it are pre-CDN tarballs left by the older writer. Combined with the doubled prefix above, the real keys are `ap-files-prod/pieces/…` (legacy) and `ap-files-prod/pieces/v2/…` (live). Probe both with `wrangler r2 object get` before any prefix-wide operation — wiping v2 used to be survivable because it refilled lazily, at the cost of a burst of cache misses on every piece. **Both prefixes are now dead storage and safe to sweep:** the `BUNDLE_PIECE` job and the S3 mirror were removed, so `resolve()` no longer reads or writes either prefix and registry pieces redirect straight to the CDN (else npm). The mirror was deleted because it was written from whichever source was preferred *at cache time* and then took precedence over the CDN forever — a bucket populated before the CDN became preferred kept serving the unbundled npm build, which is what fans out one `@activepieces/shared` copy per piece in the engine (see the Workers page).
 - **`deleteFiles` succeeding does not mean the objects are gone.** `DeleteObjectsCommand` reports per-object failures in `response.Errors` and does **not** throw, and `Quiet: true` only suppresses the success entries — so a request that "worked" can still have left objects behind. `deleteFiles` logs a warn naming the failure codes, which is all its callers (best-effort cleanup) need. Anything whose *correctness* depends on the prefix being empty afterwards would have to surface those keys and retry — but prefer not to need that at all: a reader that must not see the old objects should read from a new key prefix rather than race a delete against writers that may still be running old code.
```

**File**: `brain/knowledge/execution-runtime/workers.md` (modified, +1/-0)
```diff
@@ -20,6 +20,7 @@ The deep `Resolver`/`Runtime` concurrency and bundle-caching model lives on the
 - `concurrency === 1` primes the sandbox to the full container RAM (cgroup-aware) via `primeFullContainerMemory()`.
 
 ### Gotchas
+- **`AP_CONTAINER_TYPE=WORKER` moves every engine→app call onto `AP_FRONTEND_URL`.** In `WORKER_AND_APP` the engine reaches the app at `http://127.0.0.1:<port>/api/`; in `WORKER` it uses `AP_FRONTEND_URL + '/api/'` (`getApiUrl` in `worker/src/lib/config/configs.ts`), and the worker's Socket.IO connection follows it. If that URL is the public hostname, file uploads, run-log uploads and the worker socket all cross the ingress/WAF/CDN, so WAF rules and websocket idle timeouts start failing runs that worked the day before. Point separated workers at the in-cluster app service instead. Found on Alan's fleet 2026-09-29, the day after being advised to switch to `WORKER`.
 - **The piece workspace pins `linker = "isolated"` in its own `bunfig.toml` — do not delete it, the engine's piece resolver depends on the layout bun chooses.** `pieceInstaller` generates a bun workspace at `<cache>/<version>/common` whose members are `pieces/<pieceName>-<pieceVersion>`, and the engine (`piece-loader.ts` → `resolveInstalledPieceEntry`) resolves a piece **only** at `pieces/<alias>/node_modules/<pieceName>`, which just the isolated linker produces. The workspace used to carry no bunfig and inherited whatever ancestor bunfig bun discovered above the cache mount (`/usr/src/app/bunfig.toml`); when bun instead uses the **hoisted** linker it writes the package as a real directory at the workspace root `node_modules/@activepieces/<name>` and leaves the member with no `node_modules` at all, so every run of that piece fails `PieceNotFoundError: Piece not found for package: <name>-<version>` while `bun install` still exits 0. It was silent and self-perpetuating — `markPiecesAsUsed` writes `ready` and `pieceCheckIfAlreadyInstalled` only looks for *a* `node_modules`, so the piece is reinstalled forever and never resolves. Sep 2026 production: 125/125 folders missing `node_modules` were exactly the 125 packages sitting hoisted at the workspace root; 7,400+ `EXECUTE_FLOW` jobs, 15+ platforms, ~60 official pieces, ~300/hr. Two things had to line up — bun 1.4.0 (Aug 31) changed the layout newly-installed members got, and removing the piece-upgrade Redis gate (#15236, deployed 2026-09-03 08:09 UTC) mass-upgraded every platform's flows to newer piece versions so almost every install was suddenly a *first-time* install. Diagnose on a worker with `for d in <cache>/v*/common/pieces/@activepieces/*/; do [ -d "$d/node_modules" ] || basename $d; done`. Fixed by pinning the linker plus a `LATEST_CACHE_VERSION` bump (v14 → v15) so the fleet rebuilds one clean workspace under the pinned layout rather than carrying a mixed one.
 - **No PM2 anymore — the container is the supervision unit.** `docker-entrypoint.sh` launches the bootstrap scripts with plain `node --enable-source-maps` (removed the `pm2-runtime` + `/tmp/ecosystem.config.js` machinery). `APP`/`WORKER` `exec` a single node as PID 1; `WORKER_AND_APP` runs both and, if either exits, kills the other and exits non-zero so the orchestrator restarts the whole container. This drops PM2's *in-container* crash/OOM restart: an OOM-kill no longer silently recycles a child every ~4 min behind a `RestartCount: 0` (the 2026-07-26 wedge's supply of retry attempts — see below); the container now dies and is rescheduled instead. The historical incident notes below still describe the old PM2 behavior as it happened.
 - **Version gate (rolling-deploy safety)**: dispatch requires an exact release match, enforced both sides via `versionsAreCompatible` (fail-closed — `undefined` or `UNKNOWN_VERSION` `'0.0.0'` is treated incompatible). App withholds jobs from a mismatched worker (`poll` returns null); worker pauses polling 10s. Ordinary mismatch self-heals on convergence; a read failure does not (cached for process life) and pages on-call once at startup via `assertReleaseReadable`.
```

**File**: `packages/server/api/src/app/file/files-controller.ts` (modified, +15/-3)
```diff
@@ -1,5 +1,6 @@
+import type { IncomingHttpHeaders } from 'node:http'
 import { Readable } from 'node:stream'
-import { ActivepiecesError, ApId, assertNotNullOrUndefined, ErrorCode, isNil } from '@activepieces/core-utils'
+import { ActivepiecesError, ApId, assertNotNullOrUndefined, ErrorCode, isNil, tryCatchSync } from '@activepieces/core-utils'
 import { ALL_PRINCIPAL_TYPES, EnginePrincipal, FileCompression, FileTransportQueryParams, FileType, Principal, PrincipalType } from '@activepieces/shared'
 import contentDisposition from 'content-disposition'
 import { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
@@ -33,7 +34,7 @@ export const filesController: FastifyPluginAsyncZod = async (app) => {
             const token = (request.query as { token: string }).token
             const principal = await verifyEnginePrincipal(token, request.log)
             const fileType = parseFileTypeHeader(request.headers[fileTransportHeaders.TYPE])
-            const fileName = parseStringHeader(request.headers[fileTransportHeaders.NAME])
+            const fileName = parseFileNameHeader(request.headers)
             const contentEncoding = parseStringHeader(request.headers['content-encoding'])
             const compression = contentEncoding === 'zstd' ? FileCompression.ZSTD : FileCompression.NONE
             const contentLength = Number(request.headers['content-length'] ?? 0)
@@ -79,7 +80,7 @@ export const filesController: FastifyPluginAsyncZod = async (app) => {
         const { fileId } = request.params
         const principal = await verifyEnginePrincipal(request.query.token, request.log)
         const fileType = parseFileTypeHeader(request.headers[fileTransportHeaders.TYPE])
-        const fileName = parseStringHeader(request.headers[fileTransportHeaders.NAME])
+        const fileName = parseFileNameHeader(request.headers)
         const contentEncoding = parseStringHeader(request.headers['content-encoding'])
         const compression = contentEncoding === 'zstd' ? FileCompression.ZSTD : FileCompression.NONE
 
@@ -231,6 +232,17 @@ function parseFileTypeHeader(value: unknown): FileType {
     return raw as FileType
 }
 
+function parseFileNameHeader(headers: IncomingHttpHeaders): string | undefined {
+    const encoded = parseStringHeader(headers[fileTransportHeaders.ENCODED_NAME])
+    if (!isNil(encoded) && encoded.length > 0) {
+        const { data: decoded } = tryCatchSync(() => decodeURIComponent(encoded))
+        if (!isNil(decoded)) {
+            return decoded
+        }
+    }
+    return parseStringHeader(headers[fileTransportHeaders.NAME])
+}
+
 function parseStringHeader(value: unknown): string | undefined {
     if (typeof value === 'string') {
         return value
```

**File**: `packages/server/api/src/app/file/files-service.ts` (modified, +1/-0)
```diff
@@ -63,6 +63,7 @@ export const fileTransportHeaders = {
     READ_URL: 'x-ap-file-read-url',
     TYPE: 'x-ap-file-type',
     NAME: 'x-ap-file-name',
+    ENCODED_NAME: 'x-ap-file-name-encoded',
 } as const
 
 export const ENGINE_WRITABLE_FILE_TYPES: ReadonlySet<FileType> = new Set([
```

**File**: `packages/server/api/test/integration/ce/file/files-controller.test.ts` (modified, +43/-0)
```diff
@@ -338,6 +338,49 @@ describe('Files Controller', () => {
             expect(getResponse?.headers['content-disposition']).toBe('attachment; filename="invoice.pdf"')
         })
 
+        it.each([
+            {
+                scenario: 'a current engine (ASCII fallback + encoded header)',
+                headers: { 'x-ap-file-name': 'Lettre _ Elodie.pdf', 'x-ap-file-name-encoded': encodeURIComponent('Lettre – Élodie.pdf') },
+                storedName: 'Lettre – Élodie.pdf',
+            },
+            {
+                scenario: 'an older engine (raw legacy header only)',
+                headers: { 'x-ap-file-name': 'invoice.pdf' },
+                storedName: 'invoice.pdf',
+            },
+            {
+                scenario: 'a malformed encoded header',
+                headers: { 'x-ap-file-name': 'report.pdf', 'x-ap-file-name-encoded': 'report%E0%A4%A.pdf' },
+                storedName: 'report.pdf',
+            },
+        ])('stores the upload name sent by $scenario', async ({ headers, storedName }) => {
+            const { mockProject, mockPlatform } = await mockAndSaveBasicSetup()
+            const engineToken = await generateMockToken({
+                type: PrincipalType.ENGINE,
+                id: apId(),
+                projectId: mockProject.id,
+                platform: { id: mockPlatform.id },
+            })
+            const fileId = apId()
+
+            const putResponse = await app!.inject({
+                method: 'PUT',
+                url: `/api/v1/files/${fileId}`,
+                query: { token: engineToken },
+                headers: {
+                    'content-type': 'application/octet-stream',
+                    'x-ap-file-type': FileType.FLOW_STEP_FILE,
+                    ...headers,
+                },
+                payload: Buffer.from('%PDF-1.4', 'utf-8'),
+            })
+
+            expect(putResponse?.statusCode).toBe(StatusCodes.OK)
+            const file = await fileService(app!.log).getFileOrThrow({ fileId, projectId: mockProject.id })
+            expect(file.fileName).toBe(storedName)
+        })
+
         it.each([
             { fileName: 'résumé.pdf', expected: 'attachment; filename="résumé.pdf"' },
             { fileName: '報告書.json', expected: 'attachment; filename="???.json"; filename*=UTF-8\'\'%E5%A0%B1%E5%91%8A%E6%9B%B8.json' },
```

**File**: `packages/server/engine/src/lib/api/engine-file-api.ts` (modified, +12/-1)
```diff
@@ -8,6 +8,7 @@ const zstdDecompress = promisify(zstdDecompressCallback)
 const READ_URL_HEADER = 'x-ap-file-read-url'
 const FILE_TYPE_HEADER = 'x-ap-file-type'
 const FILE_NAME_HEADER = 'x-ap-file-name'
+const FILE_NAME_ENCODED_HEADER = 'x-ap-file-name-encoded'
 
 export const engineFileApi = {
     async upload({ engineToken, apiUrl, fileId, type, fileName, compression, data }: UploadParams): Promise<UploadResult> {
@@ -130,14 +131,24 @@ function buildPutHeaders({ type, fileName, compression, contentLength }: BuildHe
         headers['Content-Length'] = String(contentLength)
     }
     if (fileName) {
-        headers[FILE_NAME_HEADER] = fileName
+        const wellFormedName = toWellFormed(fileName)
+        headers[FILE_NAME_HEADER] = toAsciiHeaderValue(wellFormedName)
+        headers[FILE_NAME_ENCODED_HEADER] = encodeURIComponent(wellFormedName)
     }
     if (compression === FileCompression.ZSTD) {
         headers['Content-Encoding'] = 'zstd'
     }
     return headers
 }
 
+function toWellFormed(value: string): string {
+    return value.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '\uFFFD')
+}
+
+function toAsciiHeaderValue(value: string): string {
+    return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '_')
+}
+
 function stripApHeaders(headers: Record<string, string>): Record<string, string> {
     const result: Record<string, string> = {}
     for (const [key, value] of Object.entries(headers)) {
```

**File**: `packages/server/engine/test/engine-file-api.test.ts` (modified, +51/-0)
```diff
@@ -1,5 +1,6 @@
 import { promisify } from 'node:util'
 import { zstdCompress as zstdCompressCallback } from 'node:zlib'
+import { FileType } from '@activepieces/shared'
 import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
 import { engineFileApi } from '../src/lib/api/engine-file-api'
 
@@ -43,3 +44,53 @@ describe('engineFileApi.download zstd auto-decompression', () => {
         })
     })
 })
+
+describe('engineFileApi.upload file-name headers', () => {
+    afterEach(() => {
+        vi.restoreAllMocks()
+    })
+
+    async function uploadAndCaptureHeaders(fileName: string): Promise<Headers> {
+        const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
+            new Response(JSON.stringify({ readUrl: 'http://localhost:3000/v1/files/file-1' }), { status: 200 }),
+        )
+        await engineFileApi.upload({
+            ...PARAMS,
+            type: FileType.FLOW_STEP_FILE,
+            fileName,
+            data: Buffer.from('payload'),
+        })
+        return new Headers(fetchSpy.mock.calls[0][1]?.headers)
+    }
+
+    it.each([
+        { fileName: 'résumé.pdf', ascii: 'resume.pdf' },
+        { fileName: 'Lettre – Élodie.pdf', ascii: 'Lettre _ Elodie.pdf' },
+        { fileName: '報告書.json', ascii: '___.json' },
+        { fileName: 'evil\r\nX-Injected: 1.json', ascii: 'evil__X-Injected: 1.json' },
+    ])('sends $fileName as printable ASCII plus a lossless encoded copy', async ({ fileName, ascii }) => {
+        const headers = await uploadAndCaptureHeaders(fileName)
+
+        expect(headers.get('x-ap-file-name')).toBe(ascii)
+        expect(headers.get('x-ap-file-name')).toMatch(/^[\x20-\x7e]*$/)
+        expect(decodeURIComponent(headers.get('x-ap-file-name-encoded') ?? '')).toBe(fileName)
+    })
+
+    it.each([
+        { fileName: 'cut\uD83D.pdf', ascii: 'cut_.pdf', decoded: 'cut\uFFFD.pdf' },
+        { fileName: '\uDE00lone-low.pdf', ascii: '_lone-low.pdf', decoded: '\uFFFDlone-low.pdf' },
+        { fileName: 'whole \uD83D\uDE00.pdf', ascii: 'whole __.pdf', decoded: 'whole \uD83D\uDE00.pdf' },
+    ])('replaces an unpaired surrogate instead of aborting the upload ($fileName)', async ({ fileName, ascii, decoded }) => {
+        const headers = await uploadAndCaptureHeaders(fileName)
+
+        expect(headers.get('x-ap-file-name')).toBe(ascii)
+        expect(decodeURIComponent(headers.get('x-ap-file-name-encoded') ?? '')).toBe(decoded)
+    })
+
+    it('keeps a plain ASCII name unchanged in the legacy header', async () => {
+        const headers = await uploadAndCaptureHeaders('invoice.pdf')
+
+        expect(headers.get('x-ap-file-name')).toBe('invoice.pdf')
+        expect(headers.get('x-ap-file-name-encoded')).toBe('invoice.pdf')
+    })
+})
```

---

### Incident Patch 14: `0a6570d2` (2026-10-04)
**Commit Message**: fix(helm): OpenShift overlay, and the cluster's default storage class when none is set (#16033)

Co-authored-by: Claude Opus 4.7 <[REDACTED_EMAIL]>
Co-authored-by: amr <[REDACTED_EMAIL]>

**File**: `brain/knowledge/engineering/helm-chart.md` (modified, +4/-0)
```diff
@@ -36,3 +36,7 @@ Only two secrets, both `data: {}` with mittwald `secret-generator` annotations t
 - **The HPA targets whatever `activepieces.workloadType` resolves to.** It used to target a `Deployment` the chart never creates.
 - **`Chart.yaml` `appVersion` is the default image tag.** `release-self-hosted.yml` fails the release if it drifts from `package.json`, and the version sync PR bumps it.
 - **`AP_EDITION=ee` needs `AP_EXECUTION_MODE` set in the same breath or the pod will not boot.** `system-validator.ts` throws for `cloud`/`ee` in production unless the mode is one of `SANDBOX_PROCESS`, `SANDBOX_CODE_ONLY`, `SANDBOX_CODE_AND_PROCESS`, and the default is `UNSANDBOXED`. The error names the execution mode, not the edition, so it reads as a sandboxing problem rather than the edition switch that caused it.
+- **Bumping the bundled Bitnami subcharts is a database migration, not a version bump.** `postgresql` past 11.7.2 ships PostgreSQL 17, which will not start on the 14 data directory, so every bundled-DB install needs a dump, a fresh `data-<release>-postgresql-0` claim and a restore while the app is held at zero replicas (and HPA off). Plan it as its own release with migration docs. Images only exist under `bitnamilegacy/*` since Bitnami's 2025-08-28 freeze; check a target chart's default tags exist there first. See GIT-1929.
+- **OpenShift support is an overlay, not a default.** `values-openshift.yaml` moves the pod to non-root on 8080 without capabilities and turns off the bundled subcharts' security contexts (they hardcode user ID 1001); the base chart stays root on port 80 so `SANDBOX_PROCESS` installs keep working. The overlay must never set `runAsUser` / `fsGroup` (restricted-v2 rejects IDs outside the project's range) or `AP_EXECUTION_MODE` (the shipped values already read it from a secret, so it would render twice). See GIT-1929.
+- **An empty `persistence.storageClassName` keeps whatever class the live StatefulSet already has.** A StatefulSet's `volumeClaimTemplates` are immutable, so any change there fails the whole `helm upgrade` ("updates to statefulset spec ... are forbidden"). `activepieces.cacheStorageClassName` looks the old class up and reuses it; offline renders (Argo CD, `helm template`) cannot, so changing the chart's default class is a breaking change for them even though `helm upgrade` survives it.
+- **A failed `helm upgrade` is not atomic.** Resources Helm patched before the failing one stay patched, so a release can end up half on the new chart, for example a bundled database already on a new major image while the app StatefulSet patch was rejected. Run anything irreversible (dumps, backups) before the upgrade, not after it fails.
```

**File**: `deploy/activepieces-helm/Chart.yaml` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@ type: application
 # This is the chart version. This version number should be incremented each time you make changes
 # to the chart and its templates, including the app version.
 # Versions are expected to follow Semantic Versioning (https://semver.org/)
-version: 0.4.0
+version: 0.5.0
 
 # This is the version number of the application being deployed. This version number should be
 # incremented each time you make changes to the application. Versions are not expected to
```

**File**: `deploy/activepieces-helm/templates/_helpers.tpl` (modified, +14/-0)
```diff
@@ -72,3 +72,17 @@ Create the name of the service account to use
 {{- "rollout" }}
 {{- end }}
 {{- end }}
+
+{{- define "activepieces.cacheStorageClassName" -}}
+{{- if .Values.persistence.storageClassName }}
+{{- .Values.persistence.storageClassName }}
+{{- else }}
+{{- with lookup "apps/v1" "StatefulSet" .Release.Namespace (include "activepieces.fullname" .) }}
+{{- range .spec.volumeClaimTemplates }}
+{{- if eq .metadata.name "cache" }}
+{{- .spec.storageClassName | default "" }}
+{{- end }}
+{{- end }}
+{{- end }}
+{{- end }}
+{{- end }}
```

**File**: `deploy/activepieces-helm/templates/deployment.yaml` (modified, +3/-1)
```diff
@@ -138,7 +138,9 @@ spec:
         name: cache
       spec:
         accessModes: [ "ReadWriteOnce" ]
-        storageClassName: {{ .Values.persistence.storageClassName | default "local-path" | quote }}
+        {{- with include "activepieces.cacheStorageClassName" . }}
+        storageClassName: {{ . | quote }}
+        {{- end }}
         resources:
           requests:
             storage: {{ .Values.persistence.size | quote }}
```

**File**: `deploy/activepieces-helm/values-openshift.yaml` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+# Overlay for OpenShift 4.x under the default `restricted-v2` SCC.
+#
+# Install:
+#   helm install activepieces deploy/activepieces-helm \
+#     -f deploy/activepieces-helm/values.yaml \
+#     -f deploy/activepieces-helm/values-openshift.yaml \
+#     -f my-values.yaml
+#
+# What this overlay changes vs. the base chart:
+# - Port moves above 1024 so a non-root pod can bind without NET_BIND_SERVICE.
+# - securityContext hardened: non-root, no capabilities, seccomp RuntimeDefault.
+#   No runAsUser / fsGroup: the SCC assigns both from the project's range, and a
+#   fixed ID outside that range is rejected at admission.
+# - storageClassName left empty so the cluster's default class is used.
+# - The bundled PostgreSQL and Redis subcharts hardcode user ID 1001, which
+#   restricted-v2 rejects; their security contexts are turned off so the SCC
+#   assigns the IDs instead.
+#
+# Set AP_EXECUTION_MODE to SANDBOX_CODE_ONLY (or UNSANDBOXED) in the
+# activepieces-config-secrets secret, not here: SANDBOX_PROCESS and
+# SANDBOX_CODE_AND_PROCESS need CAP_SYS_ADMIN, which restricted-v2 never grants.
+
+podSecurityContext:
+  runAsNonRoot: true
+  seccompProfile:
+    type: RuntimeDefault
+
+securityContext:
+  runAsNonRoot: true
+  allowPrivilegeEscalation: false
+  capabilities:
+    drop:
+      - ALL
+
+container:
+  port: 8080
+
+persistence:
+  storageClassName: ""
+
+activepiecesConfig:
+  AP_PORT: "8080"
+
+postgresql:
+  primary:
+    podSecurityContext:
+      enabled: false
+    containerSecurityContext:
+      enabled: false
+  readReplicas:
+    podSecurityContext:
+      enabled: false
+    containerSecurityContext:
+      enabled: false
+
+redis:
+  master:
+    podSecurityContext:
+      enabled: false
+    containerSecurityContext:
+      enabled: false
+  replica:
+    podSecurityContext:
+      enabled: false
+    containerSecurityContext:
+      enabled: false
```

**File**: `deploy/activepieces-helm/values.yaml` (modified, +2/-0)
```diff
@@ -120,6 +120,8 @@ persistence:
   enabled: true
   size: 2Gi
   mountPath: "/usr/src/app/cache"
+  # Leave empty to use the cluster's default StorageClass.
+  storageClassName: ""
 
 volumes: []
 volumeMounts: []
```

**File**: `docs/install/options/helm.mdx` (modified, +22/-1)
```diff
@@ -13,7 +13,7 @@ This guide walks you through deploying Activepieces on Kubernetes using the offi
 - Helm 3.x installed
 - kubectl configured to access your cluster
 
-When `helm install` or `helm upgrade` talks to a cluster without [Argo Rollouts](https://argoproj.github.io/rollouts/), the chart deploys a `StatefulSet`; otherwise it deploys an Argo `Rollout`. A release that already runs as a `Rollout` stays one. Rendering without a cluster (`helm template`, Kustomize) produces a `Rollout`, so set `workloadType: statefulset` there, or pass the cluster's API versions as Argo CD does. The StatefulSet volume uses the `local-path` storage class unless you set `persistence.storageClassName`.
+When `helm install` or `helm upgrade` talks to a cluster without [Argo Rollouts](https://argoproj.github.io/rollouts/), the chart deploys a `StatefulSet`; otherwise it deploys an Argo `Rollout`. A release that already runs as a `Rollout` stays one. Rendering without a cluster (`helm template`, Kustomize) produces a `Rollout`, so set `workloadType: statefulset` there, or pass the cluster's API versions as Argo CD does. The StatefulSet volume uses the cluster's default StorageClass unless you set `persistence.storageClassName`. On a cluster without a default class (`kubectl get storageclass` shows none marked `(default)`), set it, or the pod stays `Pending`. Choose it before the first install: a StatefulSet's volume class cannot change afterwards.
 
 ## Database and Redis
 
@@ -196,6 +196,27 @@ kubectl delete statefulset "$FULLNAME"
 kubectl delete pvc "cache-$FULLNAME-0"
 ```
 
+## OpenShift
+
+The base chart runs as root on port 80, which OpenShift's default `restricted-v2` SCC rejects with `listen EACCES :::80`. Add the OpenShift overlay on top of your own values:
+
+```bash
+helm install activepieces deploy/activepieces-helm \
+  -f deploy/activepieces-helm/values.yaml \
+  -f deploy/activepieces-helm/values-openshift.yaml \
+  -f my-values.yaml
+```
+
+The overlay runs the pod as non-root on port 8080, drops all capabilities and uses the cluster's default StorageClass. It sets no user or group ID, so OpenShift assigns both from the project's range.
+
+Set `AP_EXECUTION_MODE` to `SANDBOX_CODE_ONLY` in the `activepieces-config-secrets` secret, as in step 3. `SANDBOX_PROCESS` and `SANDBOX_CODE_AND_PROCESS` need `CAP_SYS_ADMIN`, which `restricted-v2` never grants. In `SANDBOX_CODE_ONLY`, code steps that import npm packages fail; see [Sandboxing](/install/architecture/sandboxing).
+
+The bundled PostgreSQL and Redis subcharts hardcode user ID 1001, which `restricted-v2` rejects. The overlay turns off their security contexts and OpenShift assigns the IDs instead, so `postgresql.enabled` and `redis.enabled` need no extra settings.
+
+The chart does not create an OpenShift `Route`. Create one pointing at the `activepieces` service on port 80, or use the `Ingress` under `ingress.*`.
+
+To use the overlay on another cluster that enforces the Kubernetes `restricted` Pod Security profile, also set a non-root `runAsUser` and `fsGroup` (for example `1001`) under `podSecurityContext`: the image runs as root, and `runAsNonRoot` refuses to start it without one. Use external PostgreSQL and Redis there: with the overlay, the bundled database pods have no security context, which that profile rejects.
+
 ## Troubleshooting
 
 ### Common Issues
```

**File**: `docs/install/reference/breaking-changes.mdx` (modified, +15/-0)
```diff
@@ -8,6 +8,21 @@ icon: "hammer"
 
 ### What has changed?
 
+#### Helm chart 0.5.0 uses the cluster's default StorageClass again
+
+Chart 0.4.0 set the app's cache volume to the `local-path` StorageClass whenever `persistence.storageClassName` was unset, which only exists on k3s-style clusters, so new installs elsewhere stayed `Pending`. From 0.5.0 an unset value uses the cluster's default StorageClass again, as chart 0.3.x did. A StatefulSet's volume class cannot change after it is created, so `helm upgrade` keeps the class your release already uses.
+
+#### What you need to do
+
+If your release was created with chart 0.4.0, you never set `persistence.storageClassName`, and you deploy by rendering the chart without a cluster connection (Argo CD, `helm template | kubectl apply`), pin the class your StatefulSet was created with before upgrading, or every sync fails with `updates to statefulset spec ... are forbidden`:
+
+```yaml
+persistence:
+  storageClassName: "local-path"
+```
+
+Direct `helm upgrade` needs no change. A new install on a cluster with no default StorageClass (`kubectl get storageclass` shows none marked `(default)`) must set `persistence.storageClassName`, or the cache volume and the app pod stay `Pending`.
+
 #### Zoho CRM Read File and Custom API Call only send the token to the connection's Zoho CRM hosts
 
 Read File used to send the connection's Zoho access token to whatever URL it was given, including hosts outside Zoho. From Zoho CRM 0.4.0 it only fetches `https` URLs on the connection's own Zoho API host under `/crm/` (for example `https://www.zohoapis.com/crm/bulk/v8/read/<job>/result`), or on that data centre's download hosts (for example `https://download-accl.zoho.com/v2/crm/...` for a data backup). Custom Zoho function URLs (`/crm/.../functions/...`) and URLs in another data centre are refused. Any other URL fails before a request is made. Redirects are followed only to those same hosts; a redirect anywhere else stops the download before that host is requested. The file is streamed, so the deployment's file size limit (`AP_MAX_FILE_SIZE_MB`) applies.
```

---

### Incident Patch 15: `e136e014` (2026-10-04)
**Commit Message**: fix(connections): searching OAuth2 permissions filters the list again (#15811)

Co-authored-by: Othman Emad <[REDACTED_EMAIL]>

**File**: `packages/web/src/app/connections/oauth2-connection-settings.tsx` (modified, +30/-12)
```diff
@@ -31,6 +31,7 @@ import {
   MultiSelectValue,
 } from '@/components/custom/multi-select';
 import { Button } from '@/components/ui/button';
+import { CommandEmpty } from '@/components/ui/command';
 import {
   FormControl,
   FormField,
@@ -88,6 +89,10 @@ function OAuth2ConnectionSettings({
     grantType === OAuth2GrantType.AUTHORIZATION_CODE;
   const [loading, setLoading] = useState(false);
   const [scopesEditing, setScopesEditing] = useState(false);
+  const [scopeSearch, setScopeSearch] = useState('');
+  const filteredScopes = authProperty.scope.filter((scope) =>
+    scope.toLowerCase().includes(scopeSearch.toLowerCase()),
+  );
 
   return (
     <div className="flex flex-col gap-4">
@@ -188,6 +193,12 @@ function OAuth2ConnectionSettings({
                           value: scope,
                           label: scope,
                         }))}
+                        onSearch={(keyword) => setScopeSearch(keyword ?? '')}
+                        onOpenChange={(open) => {
+                          if (!open) {
+                            setScopeSearch('');
+                          }
+                        }}
                       >
                         <MultiSelectTrigger>
                           {selected.length < 10 ? (
@@ -205,24 +216,31 @@ function OAuth2ConnectionSettings({
                             placeholder={t('Search permissions')}
                           />
                           <MultiSelectList>
-                            <div
-                              onClick={(e) => {
-                                e.stopPropagation();
-                                e.preventDefault();
-                                field.onChange(authProperty.scope.join(' '));
-                              }}
-                            >
-                              <MultiSelectItem>
-                                {t('Select All')}
-                              </MultiSelectItem>
-                            </div>
-                            {authProperty.scope.map((scope) => (
+                            {scopeSearch === '' && (
+                              <div
+                                onClick={(e) => {
+                                  e.stopPropagation();
+                                  e.preventDefault();
+                                  field.onChange(authProperty.scope.join(' '));
+                                }}
+                              >
+                                <MultiSelectItem>
+                                  {t('Select All')}
+                                </MultiSelectItem>
+                              </div>
+                            )}
+                            {filteredScopes.map((scope) => (
                               <MultiSelectItem key={scope} value={scope}>
                                 <span className="truncate min-w-0">
                                   {scope}
                                 </span>
                               </MultiSelectItem>
                             ))}
+                            {filteredScopes.length === 0 && (
+                              <CommandEmpty>
+                                {t('No results found.')}
+                              </CommandEmpty>
+                            )}
                           </MultiSelectList>
                         </MultiSelectContent>
                       </MultiSelect>
```

**File**: `packages/web/src/components/custom/multi-select.tsx` (modified, +7/-10)
```diff
@@ -44,9 +44,7 @@ interface MultiSelectContextValue {
 
   onDeselect(value: string, item: MultiSelectOptionItem): void;
 
-  onSearch?(keyword: string | undefined): void;
-
-  filter?: boolean | ((keyword: string, current: string) => boolean);
+  onSearch(keyword: string | undefined): void;
 
   disabled?: boolean;
 
@@ -79,8 +77,7 @@ type MultiSelectProps = React.ComponentPropsWithoutRef<
   onSelect?(value: string, item: MultiSelectOptionItem): void;
   onDeselect?(value: string, item: MultiSelectOptionItem): void;
   defaultValue?: string[];
-  onSearch?(keyword: string | undefined): void;
-  filter?: boolean | ((keyword: string, current: string) => boolean);
+  onSearch(keyword: string | undefined): void;
   disabled?: boolean;
   maxCount?: number;
   items?: MultiSelectOptionItem[];
@@ -96,7 +93,6 @@ const MultiSelect: React.FC<MultiSelectProps> = ({
   onOpenChange,
   defaultOpen,
   onSearch,
-  filter,
   disabled,
   maxCount,
   items = [],
@@ -162,7 +158,6 @@ const MultiSelect: React.FC<MultiSelectProps> = ({
       value: value || [],
       open: open || false,
       onSearch,
-      filter,
       disabled,
       maxCount,
       onSelect: handleSelect,
@@ -173,7 +168,6 @@ const MultiSelect: React.FC<MultiSelectProps> = ({
     value,
     open,
     onSearch,
-    filter,
     disabled,
     maxCount,
     handleSelect,
@@ -417,7 +411,10 @@ const MultiSelectContent = React.forwardRef<
 
   if (!context.open) {
     return fragmentRef.current
-      ? createPortal(<Command>{children}</Command>, fragmentRef.current)
+      ? createPortal(
+          <Command shouldFilter={false}>{children}</Command>,
+          fragmentRef.current,
+        )
       : null;
   }
 
@@ -449,7 +446,7 @@ const MultiSelectContent = React.forwardRef<
       >
         <Command
           className={cn('px-1 max-h-96 w-full', className)}
-          shouldFilter={!context.onSearch}
+          shouldFilter={false}
         >
           {children}
         </Command>
```

**File**: `packages/web/test/app/connections/oauth2-connection-settings.test.tsx` (added, +217/-0)
```diff
@@ -0,0 +1,217 @@
+/**
+ * @vitest-environment jsdom
+ */
+import { PieceAuth } from '@activepieces/pieces-framework';
+import {
+  AppConnectionType,
+  OAuth2GrantType,
+  PackageType,
+  PieceType,
+} from '@activepieces/shared';
+import * as React from 'react';
+import { act } from 'react';
+import { createRoot, type Root } from 'react-dom/client';
+import { FormProvider, useForm } from 'react-hook-form';
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
+
+vi.mock('i18next', () => ({ t: (key: string) => key }));
+vi.mock('@/hooks/flags-hooks', () => ({
+  flagsHooks: { useFlag: () => ({ data: undefined }) },
+}));
+vi.mock('@/features/connections', () => ({
+  oauth2Utils: { resolveRedirectUrl: () => 'https://redirect.example' },
+}));
+vi.mock('@/features/connections/api/app-connections', () => ({
+  appConnectionsApi: {},
+}));
+vi.mock('@/lib/api', () => ({ api: {} }));
+vi.mock('@/app/builder/piece-properties/generic-properties-form', () => ({
+  GenericPropertiesForm: () => null,
+}));
+
+import { OAuth2ConnectionSettings } from '@/app/connections/oauth2-connection-settings';
+
+declare global {
+  var IS_REACT_ACT_ENVIRONMENT: boolean;
+}
+
+Element.prototype.scrollIntoView = () => undefined;
+globalThis.ResizeObserver = class {
+  observe() {}
+  unobserve() {}
+  disconnect() {}
+} as never;
+if (!globalThis.PointerEvent) {
+  globalThis.PointerEvent = MouseEvent as never;
+}
+globalThis.IS_REACT_ACT_ENVIRONMENT = true;
+
+const SCOPES = [
+  'https://www.googleapis.com/auth/gmail.send',
+  'https://www.googleapis.com/auth/gmail.modify',
+  'https://www.googleapis.com/auth/gmail.readonly',
+];
+
+const AUTH = PieceAuth.OAuth2({
+  authUrl: 'https://accounts.google.com/o/oauth2/auth',
+  tokenUrl: 'https://oauth2.googleapis.com/token',
+  required: true,
+  scope: SCOPES,
+});
+
+const PIECE = {
+  name: '@activepieces/piece-gmail',
+  displayName: 'Gmail',
+  logoUrl: 'https://cdn.activepieces.com/pieces/gmail.png',
+  description: '',
+  authors: [],
+  version: '0.1.0',
+  actions: 0,
+  triggers: 0,
+  contextInfo: undefined,
+  projectUsage: 0,
+  pieceType: PieceType.OFFICIAL,
+  packageType: PackageType.REGISTRY,
+};
+
+function Harness() {
+  const form = useForm({
+    defaultValues: {
+      request: {
+        value: { client_id: 'id', client_secret: 'secret', scope: '' },
+      },
+    },
+  });
+  return (
+    <FormProvider {...form}>
+      <OAuth2ConnectionSettings
+        authProperty={AUTH}
+        oauth2App={{
+          oauth2Type: AppConnectionType.CLOUD_OAUTH2,
+          clientId: 'client-id',
+        }}
+        piece={PIECE}
+        grantType={OAuth2GrantType.CLIENT_CREDENTIALS}
+      />
+    </FormProvider>
+  );
+}
+
+const click = (element: Element | null | undefined) => {
+  act(() => {
+    element?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
+    element?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
+  });
+};
+
+const openTrigger = () =>
+  click(
+    Array.from(document.querySelectorAll('button')).find((button) =>
+      button.textContent?.includes('Select permissions'),
+    ),
+  );
+
+const openPicker = () => {
+  act(() => {
+    document
+      .querySelector<HTMLElement>('[role="button"]')
+      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
+  });
+  openTrigger();
+};
+
+const closePicker = () => {
+  act(() => {
+    document
+      .querySelector('[cmdk-input]')
+      ?.dispatchEvent(
+        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
+      );
+  });
+};
+
+const typeSearch = (value: string) => {
+  const input = document.querySelector<HTMLInputElement>('[cmdk-input]');
+  const setter = Object.getOwnPropertyDescriptor(
+    HTMLInputElement.prototype,
+    'value',
+  )?.set;
+  act(() => {
+    setter?.call(input, value);
+    input?.dispatchEvent(new Event('input', { bubbles: true }));
+  });
+  return input;
+};
+
+const listedItems = () =>
+  Array.from(document.querySelectorAll('[cmdk-item]')).map(
+    (item) => item.textContent,
+  );
+
+describe('OAuth2ConnectionSettings scope search', () => {
+  let root: Root | undefined;
+  let unhandled: unknown[] = [];
+  const collect = (error: unknown) => unhandled.push(error);
+
+  beforeEach(() => {
+    unhandled = [];
+    process.on('uncaughtException', collect);
+  });
+
+  afterEach(() => {
+    act(() => root?.unmount());
+    process.off('uncaughtException', collect);
+    document.body.innerHTML = '';
+    expect(unhandled).toEqual([]);
+  });
+
+  const mountAndOpen = () => {
+    act(() => {
+      root = createRoot(
+        document.body.appendChild(document.createElement('div')),
+      );
+      root.render(<Harness />);
+    });
+    openPicker();
+  };
+
+  it('keeps the typed keyword and filters the scope list', () => {
+    mountAndOpen();
+    expect(listedItems()).toEqual(['Select All', ...SCOPES]);
+
+    const input = typeSearch('modify');
+
+    expect(input?.value).toBe('
```

#### Recent Merged Pull Requests:
- **PR #16131** (2026-10-05): fix(builder): opening an imported step with a missing connection no longer wipes its values (@othmanemad)
- **PR #16124** (2026-10-05): ci(crowdin): cancel older merger runs on the same PR (@AbdulTheActivePiecer)
- **PR #16120** (2026-10-05): fix(chat): chat-built steps run their dynamic fields with real values (@hazemadelkhalel)
- **PR #16119** (2026-10-05): New Crowdin updates (@automated-commits-ap)
- **PR #16118** (2026-10-05): fix(cli): compile the CLI with strict TypeScript (@AbdulTheActivePiecer)
- **PR #16117** (2026-10-05): fix(web): keep focus rings and the running status neutral instead of brand-coloured (@moaaz-ae)
- **PR #16115** (2026-10-05): feat(chat): build requests with several jobs as a folder of small flows (@hazemadelkhalel)
- **PR #16111** (2026-10-05): fix(chat): stop the chat getting stuck on a setting it already removed (@hazemadelkhalel)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
