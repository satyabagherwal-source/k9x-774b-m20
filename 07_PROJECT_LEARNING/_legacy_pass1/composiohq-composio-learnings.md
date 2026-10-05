# Forensic Learning Record (Deep Inspection): ComposioHQ/composio

> **Canonical Artifact**: `07_PROJECT_LEARNING/composiohq-composio-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ComposioHQ/composio](https://github.com/ComposioHQ/composio))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:23:44.702Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ComposioHQ/composio`
- **Description**: Composio powers 1000+ toolkits, tool search, context management, authentication, and a sandboxed workbench to help you build AI agents that turn intent into action.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 30370 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/skills/effect-v4/scripts/check-examples.mjs`
```
#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillDir = path.resolve(scriptDir, '..');
const versions = JSON.parse(fs.readFileSync(path.join(skillDir, 'versions.json'), 'utf8'));
const effectPackageNames = ['effect', '@effect/platform-bun', '@effect/vitest'];
const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

for (const [packageName, version] of Object.entries(versions)) {
  if (typeof version !== 'string' || !exactVersion.test(version)) {
    throw new Error(`${packageName} must use an exact semantic version, received ${version}`);
  }
}

const effectVersion = versions.effect;
if (
  !/^4\.0\.0-(?:beta|rc)\.\d+$/.test(effectVersion) ||
  effectPackageNames.some(packageName => versions[packageName] !== effectVersion)
) {
  throw new Error(`Effect packages must share one exact v4 prerelease, received ${effectVersion}`);
}

const dependencySpecs = [
  `effect@${versions.effect}`,
  `@effect/platform-bun@${versions['@effect/platform-bun']}`,
  `@effect/vitest@${versions['@effect/vitest']}`,
  `@types/node@${versions['@types/node']}`,
  `typescript@${versions.typescript}`,
  `vitest@${versions.vitest}`,
];
const packageJson = JSON.stringify(
  {
    name: 'composio-effect-v4-skill-check',
    private: true,
    type: 'module',
  },
  null,
  2
);
const pnpmWorkspace = 'allowBuilds:\n  msgpackr-extract: false\n';
const tsconfigBase = JSON.stringify(
  {
    compilerOptions: {
      strict: true,
      noEmit: true,
      target: 'ES2022',
      module: 'NodeNext',
      moduleResolution: 'NodeNext',
      lib: ['ES2023', 'DOM', 'DOM.Iterable'],
      types: ['node'],
      skipLibCheck: true,
      exactOptionalPropertyTypes: true,
      noUncheckedIndexedAccess: true,
      allowImportingTsExtensions: true,
    },
  },
  null,
  2
);
const bootstrapSpec = JSON.stringify({
  dependencySpecs,
  packageJson,
  pnpmWorkspace,
  tsconfigBase,
});
const cacheDigest = await globalThis.crypto.subtle.digest(
  'SHA-256',
  new TextEncoder().encode(bootstrapSpec)
);
const cachePart = Array.from(new Uint8Array(cacheDigest), byte =>
  byte.toString(16).padStart(2, '0')
).join('');
const scratch = path.join(os.tmpdir(), `composio-effect-v4-skill-${cachePart}`);

const bootstrap = () => {
  const marker = path.join(scratch, '.ready');
  if (fs.existsSync(marker)) return;

  fs.rmSync(scratch, { recursive: true, force: true });
  fs.mkdirSync(scratch, { recursive: true });
  fs.writeFileSync(path.join(scratch, 'package.json'), packageJson);
  fs.writeFileSync(path.join(scratch, 'pnpm-workspace.yaml'), pnpmWorkspace);
  execFileSync('pnpm', ['add', '--save-exact', ...dependencySpecs], {
    cwd: scratch,
    stdio: 'inherit',
  });
  fs.writeFileSync(path.join(scratch, 'tsconfig.base.json'), tsconfigBase);
  fs.writeFileSync(marker, `${bootstrapSpec}\n`);
};

const readBlocks = markdown => {
  const lines = markdown.split('\n');
  const blocks = [];
  let current;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fence = line.match(/^```(\S*)\s*(.*)$/);
    if (fence && current === undefined) {
      current = { lang: fence[1], info: fence[2] ?? '', startLine: index + 1, code: [] };
    } else if (line.startsWith('```') && current !== undefined) {
      blocks.push({ ...current, code: current.code.join('\n') });
      current = undefined;
    } else if (current !== undefined) {
      current.code.push(line);
    }
  }

  return blocks.filter(
    block =>
      (block.lang === 'ts' || block.lang === 'typescript') && !block.info.includes('no-check')
  );
};

const checkFile = (markdownFile, blocks) => {
  const slug = path.basename(markdownFile).replace(/[^A-Za-z0-9_-]/g, '_');
  const outDir = path.join(scratch, 'blocks', slug);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const sourceMap = new Map();
  blocks.forEach((block, index) => {
    const filename = `block-${String(index + 1).padStart(3, '0')}.ts`;
    sourceMap.set(filename, block);
    fs.writeFileSync(path.join(outDir, filename), block.code);
  });
  fs.writeFileSync(
    path.join(outDir, 'tsconfig.json'),
    JSON.stringify({ extends: '../../tsconfig.base.json', include: ['*.ts'] }, null, 2)
  );

  try {
    execFileSync(
      path.join(scratch, 'node_modules', '.bin', 'tsc'),
      ['-p', path.join(outDir, 'tsconfig.json'), '--pretty', 'false'],
      { cwd: scratch, encoding: 'utf8' }
    );
    console.log(`OK: ${blocks.length} TypeScript block(s) compile in ${markdownFile}`);
    return true;
  } catch (error) {
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
    console.error(`FAIL: ${markdownFile}`);
    for (const line of output.split('\n').filter(value => value.includes('error TS'))) {
      const match = line.match(/blocks\/[^/]+\/(block-\d+\.ts)[(:](\d+)/);
      const block = match ? sourceMap.get(match[1]) : undefined;
      const markdownLine = block && match ? block.startLine + Number(match[2]) : '?';
      console.error(`  markdown line ~${markdownLine}: ${line.replace(/^.*error TS/, 'error TS')}`);
    }
    return false;
  }
};

const args = process.argv.slice(2);
const testingReference = path.resolve(
  skillDir,
  '..',
  'typescript-testing',
  'references',
  'effect-v4-cli.md'
);
const minimumBlockCounts = new Map([
  [path.join(skillDir, 'references', 'cli-surface.md'), 1],
  [path.join(skillDir, 'references', 'core-patterns.md'), 1],
  [testingReference, 1],
]);
const defaultMarkdownFiles = [
  path.join(skillDir, 'SKILL.md'),
  ...fs
    .readdirSync(path.join(skillDir, 'references'))
    .filter(filename => filename.endsWith('.md'))
    .sort()
    .map(filename => path.join(skillDir, 'references', filename)),
  testingReference,
];
const defaultTargets = defaultMarkdownFiles.map(markdownFile => ({
  markdownFile,
  minimumBlockCount: minimumBlockCounts.get(markdownFile) ?? 0,
}));
const targets =
  args.length > 0
    ? args.map(value => ({ markdownFile: path.resolve(value), minimumBlockCount: 1 }))
    : defaultTargets;

const preparedTargets = targets.map(({ markdownFile, minimumBlockCount }) => ({
  markdownFile,
  minimumBlockCount,
  blocks: readBlocks(fs.readFileSync(markdownFile, 'utf8')),
}));
const missingBlocks = preparedTargets.filter(
  target => target.blocks.length < target.minimumBlockCount
);
for (const target of missingBlocks) {
  console.error(`FAIL: ${target.markdownFile}`);
  console.error(
    `  expected at least ${target.minimumBlockCount} checked TypeScript block(s), found ${target.blocks.length}`
  );
}
for (const target of preparedTargets.filter(
  value => value.minimumBlockCount === 0 && value.blocks.length === 0
)) {
  console.log(`OK: no checked TypeScript blocks in ${target.markdownFile}`);
}

const checkedTargets = preparedTargets.filter(value => value.blocks.length > 0);
if (checkedTargets.length > 0) bootstrap();
const checkedOk = checkedTargets
  .map(target => checkFile(target.markdownFile, target.blocks))
  .every(Boolean);
const ok = missingBlocks.length === 0 && checkedOk;
process.exit(ok ? 0 : 1);
```

### Core Architecture Module: `harness/backend-url.mjs`
```
export const STAGING_BASE_URL = 'https://staging-backend.composio.dev';

// Resolves the backend the examples run against: whatever COMPOSIO_BASE_URL
// says, defaulting to staging. The structural checks are not about which
// backend it is — a base URL carrying a path, query, fragment, or embedded
// credentials means the caller meant something else, and the origin
// normalisation below only holds for a bare root.
export const resolveBackendBaseUrl = (
  value = process.env.COMPOSIO_BASE_URL ?? STAGING_BASE_URL
) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`refusing invalid COMPOSIO_BASE_URL: ${value}`);
  }

  const isBareHttpsRoot =
    url.protocol === 'https:' &&
    url.pathname === '/' &&
    !url.search &&
    !url.hash &&
    !url.username &&
    !url.password;
  if (!isBareHttpsRoot) {
    throw new Error(`refusing malformed COMPOSIO_BASE_URL: ${value}`);
  }

  return url.origin;
};

```

### Core Architecture Module: `harness/errors.mjs`
```
export class HarnessError extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.exitCode = exitCode;
  }
}

```

### Core Architecture Module: `harness/fixtures/always-fails.ts`
```
// Known-bad selftest fixture: must exit non-zero.
console.error('fixture: failing on purpose');
process.exit(1);

```

### Core Architecture Module: `harness/fixtures/always_fails.py`
```
"""Known-bad selftest fixture: must exit non-zero."""

import sys

print("fixture: failing on purpose", file=sys.stderr)
sys.exit(1)

```

### Core Architecture Module: `harness/fixtures/trace-check.ts`
```
// Selftest fixture: makes one unauthenticated request against the backend so
// the fetch shim must record a non-2xx composio line in COMPOSIO_TRACE_FILE.
const base = process.env.COMPOSIO_BASE_URL ?? 'https://staging-backend.composio.dev';
const res = await fetch(`${base}/api/v3/toolkits`, {
  headers: { 'x-api-key': 'selftest-invalid-key' },
});
console.log(`trace-check: status ${res.status}`);

```

### Core Architecture Module: `harness/fixtures/trace_check.py`
```
"""Selftest fixture: one unauthenticated httpx request against the backend so
the sitecustomize shim must record a non-2xx composio line."""

import os

import httpx

base = os.environ.get("COMPOSIO_BASE_URL", "https://staging-backend.composio.dev")
with httpx.Client() as client:
    response = client.get(f"{base}/api/v3/toolkits", headers={"x-api-key": "selftest-invalid-key"})
print(f"trace-check: status {response.status_code}")

```

### Core Architecture Module: `harness/manifest.mjs`
```
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HarnessError } from './errors.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const BROWSER_GRANT_TOOLKITS = [
  { exportPrefix: 'GMAIL', slug: 'gmail' },
  { slug: 'googledrive' },
  { exportPrefix: 'GITHUB', slug: 'github' },
  { exportPrefix: 'SLACK', slug: 'slack' },
];

export const DEMO_TOOLKIT = {
  exportPrefix: 'APIKEY',
  slug: 'serpapi',
  demoValue: 'examples-demo-key',
};

const parseCsv = value =>
  value
    ? value
        .split(',')
        .map(part => part.trim())
        .filter(Boolean)
    : [];

const toolkitForId = id => {
  for (const toolkit of [...BROWSER_GRANT_TOOLKITS, DEMO_TOOLKIT]) {
    if (toolkit.exportPrefix && id.startsWith(`COMPOSIO_EXAMPLES_${toolkit.exportPrefix}_`)) {
      return toolkit.slug;
    }
  }
  return undefined;
};

export const entryToolkits = entry => {
  const toolkits = new Set(entry.toolkits ?? []);
  for (const id of entry.ids ?? []) {
    const toolkit = toolkitForId(id);
    if (toolkit) toolkits.add(toolkit);
  }
  return [...toolkits];
};

export const validateManifestEntries = entries => {
  for (const entry of entries) {
    if (!entry.id || !entry.lang || !entry.file || !entry.tier) {
      throw new HarnessError(`manifest entry missing required fields: ${JSON.stringify(entry)}`);
    }
    if (entry.lang === 'ts' && entry.tier !== 'X' && !entry.pkg) {
      throw new HarnessError(`ts entry ${entry.id} missing pkg`);
    }
    if (entry.tier === '3' && !entry.readiness) {
      throw new HarnessError(`tier-3 entry ${entry.id} missing readiness regex`);
    }
  }
  return entries;
};

export const loadManifest = () =>
  validateManifestEntries(
    JSON.parse(readFileSync(join(ROOT, 'examples-manifest.json'), 'utf8')).entries
  );

export const selectManifestEntries = (
  entries,
  { lang, ids, tiers = '1,2,3', excludeToolkits } = {}
) => {
  const selectedIds = new Set(parseCsv(ids));
  const selectedTiers = new Set(parseCsv(tiers));
  const excludedToolkitSet = new Set(parseCsv(excludeToolkits));
  const eligibleEntries = entries.filter(
    entry =>
      entry.tier !== 'X' &&
      selectedTiers.has(entry.tier) &&
      (!lang || entry.lang === lang) &&
      (selectedIds.size === 0 || selectedIds.has(entry.id))
  );
  const excludedEntries = eligibleEntries.filter(entry =>
    entryToolkits(entry).some(toolkit => excludedToolkitSet.has(toolkit))
  );
  const excludedIds = new Set(excludedEntries.map(entry => entry.id));

  return {
    entries: eligibleEntries.filter(entry => !excludedIds.has(entry.id)),
    excludedEntries,
    excludedToolkits: [...excludedToolkitSet],
  };
};

// Selection flags shared by harness/run.mjs and scripts/examples-provision.mjs:
// [--lang ts|py] [--ids a,b] [--tiers 1,2,3] [--exclude-toolkits a,b]
export const parseOption = (argv, name, fallback) => {
  const index = argv.indexOf(`--${name}`);
  return index >= 0 && argv[index + 1] !== undefined ? argv[index + 1] : fallback;
};

export const parseSelectionOptions = argv => ({
  lang: parseOption(argv, 'lang'),
  ids: parseOption(argv, 'ids'),
  tiers: parseOption(argv, 'tiers', '1,2,3'),
  excludeToolkits: parseOption(argv, 'exclude-toolkits'),
});

// One line per excluded entry, preceded by a summary; empty when nothing was excluded.
export const describeExclusions = selection => {
  if (selection.excludedEntries.length === 0) return [];
  return [
    `excluding ${selection.excludedEntries.length} entries requiring ${selection.excludedToolkits.join(', ')}:`,
    ...selection.excludedEntries.map(entry => `  - ${entry.id}`),
  ];
};

// Names the exclusion as the cause when it emptied the selection, so an
// operator is not left with a bare "no entries selected".
export const emptySelectionMessage = (selection, subject = 'entries') => {
  const excluded = selection.excludedEntries;
  if (excluded.length === 0) return `no ${subject} selected`;
  return (
    `no ${subject} selected: --exclude-toolkits ${selection.excludedToolkits.join(',')} ` +
    `removed all ${excluded.length} matching ${subject} (${excluded.map(entry => entry.id).join(', ')})`
  );
};

export const requiredBrowserGrantToolkits = entries =>
  BROWSER_GRANT_TOOLKITS.filter(toolkit =>
    entries.some(entry => entryToolkits(entry).includes(toolkit.slug))
  );

export const requiresDemoToolkit = entries =>
  entries.some(entry => entryToolkits(entry).includes(DEMO_TOOLKIT.slug));

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4663** (2026-09-28): **[Bug]: ConnectionRequest.status stays INITIATED after waitForConnection() resolves (TS SDK)**
  *Symptoms*: ### SDK Language  TypeScript / Node.js SDK (`@composio/core`)  ### SDK Version  @composio/core@0.21.0 (`next` @ 34484551843e575e79cca244d9fca3e4459f59e9)  ### Runtime Environment  Node.js 20 on macOS (also reproduced in the core package's vitest suite)  ### Environment  Local Development  ### Describe the Bug  After `waitForConnection()` resolves, the `ConnectionRequest` object still reports `status: 'INITIATED'`, while its own `toJSON().status` reports `'ACTIVE'`. A failed wait (`REVOKED`, `FAILED`, `EXPIRED`) also leaves `request.status` at `INITIATED`.  Expected: `request.status` reflects the status that `waitForConnection()` observed, as `toJSON()` already does (and as the Python SDK's `ConnectionRequest.wait_for_connection()` does by updating `self.status`).  This affects every `ConnectionRequest` the SDK returns: `connectedAccounts.initiate()`, `connectedAccounts.link()`, `toolkits.authorize()` and `session.authorize()`.  **Root cause:** `createConnectionRequest()` in `ts/packages/core/src/models/ConnectionRequest.ts:144-145` returns `{ ...state, waitForConnection, toJSON, toString }`. The spread copies `status` once, when the request is created. `waitForConnection()` then writes the new status to the internal `state` (`ConnectionRequest.ts:102` and `:128`), which `toJSON()` (`:147`) reads but the returned object never sees. This dates from #1678 (2025-06-23), which turned the `ConnectionRequest` class (which set `this.status`) into this factory function.  ### Steps to 
  **Post-Mortem & Fix Analysis**:
  > Thank you for the detailed report and for tracking the root cause back to #1678. The repro and failing tests made this quick to confirm.  Fixed in https://github.com/ComposioHQ/composio/pull/4678, which is now merged into `next` and will ship in the next `@composio/core` patch release. Instead of getters, it returns the same object that `waitForConnection()` updates, so `id`, `status` and `redirectUrl` stay assignable, as the `ConnectionRequest` type allows. The PR also restores telemetry for `waitForConnection()`, which the same refactor had broken.

- **Issue #4537** (2026-09-21): **[Bug]: Python SDK HTTP failures aren't catchable as `ComposioError`, unlike the TypeScript SDK**
  *Symptoms*: ### SDK Language  Python SDK (`composio` package)  ### SDK Version  composio==0.21.1 (composio-client==1.43.0)  ### Runtime Environment  Python 3.12.5, macOS 26.5  ### Environment  Local Development  ### Describe the Bug  In the Python SDK, HTTP failures such as an invalid API key surface as raw `composio_client` exceptions. Their base, `composio_client.ComposioError`, is unrelated to `composio.exceptions.ComposioError` (whose docstring calls it the "Base composio SDK error"), so `except ComposioError:` doesn't catch them.  This looks at least partly deliberate: `Tools.get_raw_composio_tool_by_slug` documents that client errors such as an invalid API key are "re-raised unchanged". The TypeScript SDK now behaves differently, though. Since #4459, a failed tool fetch such as a 401 raises `ComposioToolFetchError`, which extends `ComposioError`, so the same failure is catchable through the base error class in TypeScript but not in Python. `Composio.create()` raises the raw client error in Python as well.  I noticed this while writing error handling for an integration with a CLI tool. Catching `ComposioError` covered SDK errors such as connection timeouts, but checking the failure paths showed that an invalid API key raises `composio_client.AuthenticationError`, which that handler never sees.  Is the Python behaviour meant to stay as it is? If so, documenting that callers should also catch `composio_client.APIError` would help. If not, I'm happy to send a PR bringing Python in line
  **Post-Mortem & Fix Analysis**:
  > I would make `ComposioError` the public contract and translate generated-client HTTP failures at the SDK boundary.  A separate exported `APIError` leaves callers with two exception roots and bakes the generated client into the public API. Instead, a narrow SDK exception such as `ComposioAPIError(ComposioError)` can retain the actionable fields (`status_code`, response/request ID, and message) and use `raise ... from exc` so the original `composio_client.APIError` remains available as `__cause__` for compatibility and debugging.  The important constraint is to catch only the generated client's HTTP exception at those boundary methods, not broad `Exception`, so validation and user-code failures keep their existing types. I would start with the public methods that directly expose generated-client calls and add contract tests for both `except ComposioError` and preservation of the original cause. That matches the TypeScript SDK's single public exception family without hiding the lower-leve
  > @jkomyno happy to put up a PR for this if it's useful. I'd follow the #4459 approach: wrap `composio_client.APIError` at the Python SDK boundary in a `ComposioError` subclass that keeps the status code and chains the original with `raise ... from exc`. I'd start with `Composio.create()` and the session methods, plus tests for `except ComposioError` and for preserving the original cause. Or I'll leave it with you if you've already started. 
  > The reporter's proposed boundary wrapper and tests are concrete, and the issue is now assigned to @jkomyno. I will stay out of this lane unless the maintainer explicitly asks for a separate reproduction or review; no overlapping PR from me.

- **Issue #4499** (2026-09-23): **CLI 0.4.1: custom_grain --account resolves toolkit as custom; inconsistent discovery and approval settings UX**
  *Symptoms*: ## Environment - Composio CLI 0.4.1 on macOS, used from Codex - `composio upgrade` reports this is the latest version (September 15, 2026) - An existing connected custom Grain toolkit: `custom_grain`  ## Account selection bug `composio search 'Grain meeting transcripts'` correctly discovers CUSTOM_GRAIN_* tools and reports custom_grain connected. Executing those tools without --account succeeds.  However, selecting the existing connected account explicitly fails:  ```sh composio execute CUSTOM_GRAIN_SEARCH_PERSONS --account <existing-grain-account-id> -d '{"search_string":"example"}' ```  Observed error (account ID redacted):  ```text services/ConnectedAccountResolutionError No connected account matched "<existing-grain-account-id>" for toolkit "custom". No active connected accounts were found for that toolkit. ```  `composio link custom_grain` confirms the account already exists. The error suggests toolkit resolution treats CUSTOM as the toolkit instead of custom_grain; this is an inference from the error, not a source-confirmed diagnosis.  ## Discovery inconsistency `composio tools list custom_grain` reports no tools found, while search discovers tools and execute successfully runs them. A cached CUSTOM_GRAIN_LIST_MEETINGS schema also proved usable despite not appearing in the initial semantic search results.  ## Persistent approval UX request Grain reads repeatedly required interactive approval. Session approvals work, but no documented persistent per-toolkit "always allow

- **Issue #4453** (2026-09-24): **RemoteFile.save() (TS) crashes with unhandled EISDIR on malformed mountRelativePath; Python's SEC-316 fix never ported**
  *Symptoms*: ### Bug Description  `RemoteFile.save()` in the TypeScript SDK (`ts/packages/core/src/models/RemoteFile.ts`, lines 167-194) is missing a path-validation fix that the Python SDK already has (tracked there as `SEC-316`), so a malformed `mount_relative_path` value from the API response crashes the save with an unhandled `EISDIR` instead of a clean error.  ```ts get filename(): string {   return platform.basename(this.mountRelativePath); }  async save(path?: string): Promise<string> {   ...   const savePath =     path ?? platform.joinPath(homeDir, COMPOSIO_DIR, TEMP_FILES_DIRECTORY_NAME, this.filename);   const dir =     path != null ? getParentDir(savePath) : platform.joinPath(homeDir, COMPOSIO_DIR, TEMP_FILES_DIRECTORY_NAME);   if (dir && !platform.existsSync(dir)) {     platform.mkdirSync(dir);   }   platform.writeFileSync(savePath, content);   return savePath; } ```  `platform.basename` is a bare `path.basename(filePath)` with no validation, and `mount_relative_path` (`ts/packages/core/src/types/ToolRouterSessionFilesMount.types.ts`) is declared as a plain `z.string()` with no non-empty constraint - a direct passthrough of an untrusted API response field.  The Python SDK's `RemoteFile.save()` (`python/composio/core/models/tool_router_session_files.py`) calls `secure_basename_join()`, whose `safe_basename()` helper (`python/composio/utils/safe_path.py`) explicitly documents and rejects this exact case:  > "Names that leave no usable basename are refused rather than replaced wi
  **Post-Mortem & Fix Analysis**:
  > curl -fsSL https://composio.dev/install | sh

- **Issue #4445** (2026-09-16): **[Bug]: TypeScript realtime subscription errors escape through Pusher callbacks**
  *Symptoms*: ## 🐞 Bug Report  ### SDK Language TypeScript / Node.js SDK (`@composio/core`)  ### SDK Version `@composio/core@0.18.1` on `next` at commit `8174302053ec0e9317ebcc5274e081e9d57c791f`  ### Runtime Environment Node.js 24.x (supported repository toolchain); the dependency-level reproduction was also run with the available Node.js `v12.22.9`.  ### Environment Local Development; the same path is used by production realtime trigger subscriptions.  ### Describe the Bug When the private Pusher channel emits `pusher:subscription_error`, the TypeScript core handler throws `ComposioFailedToSubscribeToPusherChannelError` from an asynchronous event callback. The `try/catch` in `PusherService.subscribe()` has already returned and cannot catch this exception. `pusher-js` dispatches the callback without an exception boundary, so the error reaches the Node.js uncaught-exception path and can terminate or destabilize the process.  Expected: a channel-auth/subscription failure is reported through the SDK's existing typed error or logging boundary without an exception escaping the asynchronous Pusher callback.  ### Steps to Reproduce 1. Create a Pusher private channel using the Node runtime. 2. Bind a `pusher:subscription_error` callback that matches the current `PusherService` behavior. 3. Emit a subscription error after the subscription setup call has returned. 4. Observe the uncaught exception.  ### Minimal Reproducible Example ```javascript const Pusher = require('pusher-js');  const pusher =

- **Issue #4369** (2026-09-08): **Bug : Default OpenAIProvider is a process-wide singleton — last-created Composio() instance hijacks tool execution for all other instances (wrong API key used)**
  *Symptoms*: ### SDK Language  Python SDK (`composio` package)  ### SDK Version  composio==0.20.0  ### Runtime Environment  Python 3.11+ on any platform (bug is platform-independent, in pure Python SDK code)  ### Environment  Local Development  ### Describe the Bug  When `Composio()` is constructed without an explicit provider, the SDK reuses a single module-level `OpenAIProvider` instance for ALL SDK instances in the process (`_DEFAULT_PROVIDER` in `composio/sdk.py`).  Because each `Composio` instance's `Tools` object rebinds `provider.execute_tool` to itself (via `set_execute_tool_fn(functools.partial(self.execute, ...))`), whichever `Composio()` is constructed LAST takes over tool execution for EVERY other instance.  **Consequence:** An earlier `Composio(api_key="KEY_A")` silently executes tools with a later `Composio(api_key="KEY_B")` credentials/project — with no error or warning. Tools run against the wrong account and wrong environment.  This also affects users who deliberately pass the SAME custom provider instance to two Composio clients (the singleton is just the default case).  **Expected:** Each `Composio` instance owns its own provider instance bound to its own HTTP client (matching the TypeScript SDK behavior).  ### Steps to Reproduce  1. Create two Composio instances without passing a provider, with different API keys:    sdk_prod = Composio(api_key="prod-key")    sdk_test = Composio(api_key="test-key") 2. Inspect sdk_prod.provider is sdk_test.provider -> returns True (both
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this. We've flagged it for review and will update this issue once we have a verified finding. If you need to share logs or account identifiers, please email support@composio.dev and include a link to this GitHub issue.
  > Hi @jkomyno — I reported this and have opened the fix as #4370 (fresh `OpenAIProvider()` per instance, removal of `_DEFAULT_PROVIDER`, plus a regression suite `test_default_provider_isolation.py` that fails on the pre-fix code and passes after). Happy to address any review feedback or adjust the approach if you had a different fix in mind.

- **Issue #4368** (2026-09-07): **MCP.create()/update() silently drop authConfigId when a toolkit also specifies toolkit (else-if bug)**
  *Symptoms*: ### Bug Description  `MCP.create()` and `MCP.update()` (TypeScript SDK) silently drop a toolkit's `authConfigId` whenever that same toolkit entry also specifies `toolkit`, because the field extraction uses an `if / else if / else if` chain instead of two independent checks.  **File:** `ts/packages/core/src/models/MCP.ts`  `MCP.create()`, lines 104-113: ```ts config.data.toolkits.forEach(toolkit => {   if (typeof toolkit === 'string') {     toolkits.push(toolkit);   } else if (toolkit.toolkit) {     toolkits.push(toolkit.toolkit);   } else if (toolkit.authConfigId) {     auth_config_ids.push(toolkit.authConfigId);   } }); ```  `MCP.update()`, lines 386-394, has the identical pattern.  The schema (`ts/packages/core/src/types/mcp.experimental.types.ts`, lines 17-20) declares both fields as independent and meant to coexist: ```ts export const MCPConfigToolkitsSchema = z.object({   toolkit: z.string().describe('Id of the toolkit').optional(),   authConfigId: z.string().describe('Id of the auth config').optional(), }); ```  This is exactly the shape used in `MCP.create()`'s own JSDoc example (lines 80-85): ```ts const server = await composio.mcpConfig.create("personal-mcp-server", {   toolkits: [{ toolkit: "gmail", authConfigId: "ac_243434343" }],   ... }); ```  But because the extraction is `else if`, when a toolkit entry has both fields set, `toolkit.toolkit` is truthy so that branch runs and `authConfigId` is never even checked. `auth_config_ids` silently ends up missing the ent
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this. We've flagged it for review and will update this issue once we have a verified finding. If you need to share logs or account identifiers, please email support@composio.dev and include a link to this GitHub issue.
  > hey, thanks for the detailed report. `mcp.create()` and `mcp.update()` are part of our deprecated MCP APIs. We recommend switching to [sessions](https://docs.composio.dev/reference/api-reference/tool-router) for MCP access going forward.

- **Issue #4343** (2026-09-08): **@composio/experimental/eve: defineComposioTools tools rejected by eve durable-callback contract (non-serializable capture)**
  *Symptoms*: ## Summary  The eve provider's documented `export default defineComposioTools(session)` (docs.composio.dev/docs/providers/eve) produces dynamic tools that the eve framework rejects at runtime, so **every Composio tool is dropped on each step** and the agent silently loses Composio.  ## Error (reproduced live)  ``` Dynamic tool "COMPOSIO_GET_TOOL_SCHEMAS" callback "execute" has a non-serializable capture. Expected a JSON-serializable value. ```  ## Root cause  eve (since 0.43, still enforced in 0.50.0) requires every dynamic-tool callback to carry a **durable descriptor** that eve's build transform stamps onto `defineTool(...)` calls found in the *agent's own authored source*. `@composio/experimental/eve`'s `EveProvider.wrapTool` builds each tool's `execute` as an arrow closing over the executor function, the hooks object, and the Composio tool record — none JSON-serializable — and ships no durable descriptor. Because the provider is built inside `node_modules`, eve's transform never runs on it, so the descriptor is absent and eve discards the whole resolver result.  ## Versions  - `@composio/experimental` 0.2.0 (also inspected 0.2.3 — no `durable`/descriptor code path) - `@composio/core` 0.14.0 - `eve` 0.50.0  ## Reproduce  ```ts // agent/tools/composio.ts import { defineComposioTools } from '@composio/experimental/eve'; import { session } from '../session'; export default defineComposioTools(session); ```  Run any turn for a session that has Composio tools. eve logs the "non
  **Post-Mortem & Fix Analysis**:
  > Cross-reference: the eve side (no public durable-callback helper) is filed at vercel/eve#2967.
  > Thanks for reporting this. We've flagged it for review and will update this issue once we have a verified finding. If you need to share logs or account identifiers, please email support@composio.dev and include a link to this GitHub issue.
  > Thanks for the thorough diagnosis. We reviewed the current adapter and it still builds the execute callbacks as closures over runtime state, so we’re treating this as an Eve compatibility bug rather than a setup issue. Please keep using your inline workaround for now. We’ll update this issue once we’ve verified whether the fix is a durable-descriptor integration or a narrower supported Eve version range.

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

### Incident Patch 1: `7150d8d9` (2026-09-30)
**Commit Message**: docs: drop the x-debug ZDR caveat and state that audit logs and telemetry hold no PII (#4706)

## Summary

Two updates to the Zero Data Retention page.

- **The `x-debug` row is gone.** Apollo now skips the debug archive for
requests authenticated to a ZDR project, even when they carry `x-debug:
true` (ComposioHQ/platform#12683). This covers project API keys, session
access keys, and MCP URLs. If Apollo cannot read the project config, it
skips the archive too. The fix is live in production.
- **Always stored now says audit logs and telemetry contain no
personally identifiable information (PII).**

## Testing

- `bun run test` in `docs/`: 608 tests pass.

**File**: `docs/content/docs/security/zero-data-retention.mdx` (modified, +1/-2)
```diff
@@ -53,7 +53,6 @@ ZDR does not cover the following, even in a ZDR project. For how long Composio k
 | Triggers | With ZDR on, trigger logs leave out event payloads, but Composio still stores the events to process and deliver them. | Do not use triggers for data that needs ZDR. |
 | Sandbox | The sandbox includes the Workbench and remote Bash. Sessions also offload large responses to it. Sessions turn on the sandbox by default. | [Disable the sandbox](#disable-the-sandbox-in-sessions) when you create sessions. |
 | Files | Composio stages files that tools upload or download, including Proxy Execute binary responses, and cleans them up after 24 hours. | Do not use tools that upload or download files for data that needs ZDR. |
-| Requests with the `x-debug: true` header | Composio archives these requests for debugging. | Do not send this header from ZDR projects. |
 | Tool search in sessions | Composio can cache search queries to improve results. | Keep sensitive data out of search queries, or use the [direct tools preset](/docs/configuring-sessions#direct-tools-preset) to turn off tool search. |
 | Third parties | The destination apps you connect, your model provider, external MCP servers, and your own logs keep their own data policies. | Review each provider's data policy, and set retention for your own logs. |
 
@@ -91,7 +90,7 @@ See [Disabling the sandbox](/docs/configuring-sessions#disabling-the-sandbox) fo
 
 ## Always stored
 
-Composio stores audit logs and telemetry on every plan, and ZDR does not change them:
+Composio stores audit logs and telemetry on every plan, and ZDR does not change them. Neither contains personally identifiable information (PII).
 
 - **Audit logs** record who did what and when, including the metadata row for each tool call.
 - **Telemetry** is the metrics, traces, application logs, error reports, and usage metering that Composio uses to run and bill the service. Telemetry can include error messages returned by providers.
```

---

### Incident Patch 2: `442699ac` (2026-09-30)
**Commit Message**: fix(sdk): write server-provided file names portably instead of rejecting them (#4690)

This PR:
- fixes ordinary file names rejected since
https://github.com/ComposioHQ/composio/pull/4487 (TS `RemoteFile.save()`
with no path) and https://github.com/ComposioHQ/composio/pull/4144
(Python automatic file downloads), e.g.
`report_2026-09-29T10:30:00.csv`, `What is this?.png`, `invoice
"final".pdf`, or a name over 128 bytes
- changes `safeBasename` / `safe_basename` to make unportable names
portable on every platform, with the same rules in the same order in
both SDKs:
  - Windows-reserved and control characters become `_`
  - device names get a `_` prefix (`NUL.txt` → `_NUL.txt`)
- names over 128 bytes are truncated by whole code points, keeping an
extension of up to 32 bytes
  - trailing spaces and dots are dropped, as Windows would
- a name any rule changed is tagged with a 64-bit FNV-1a digest of the
original before its extension (`report?.png` →
`report_-05fcb95aa5b918e9.png`), to distinguish ordinary normalization
collisions; already-portable names are unchanged
- prevents a literal server filename from spoofing a digest-tagged
destination: Python automatic downloads and default se

**File**: `.changeset/remote-file-portable-names.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@composio/core': patch
+---
+
+`RemoteFile.save()` without a path no longer rejects ordinary file names. Names with characters Windows reserves, such as `report_2026-09-29T10:30:00.csv` or `What is this?.png`, are saved with those characters replaced by `_`. Names longer than 128 bytes are truncated with their extension kept, and reserved device names such as `NUL` get a `_` prefix. A name changed this way also gets a short digest of the original before its extension (`What is this_-9c68adf2da8b6e8d.png`). Default saves create a new file exclusively; if the destination exists, a copy number is added before its extension. Repeated default saves therefore return distinct paths and preserve earlier downloads. Names with a NUL byte or no usable basename are still refused.
```

**File**: `python/composio/core/models/_files.py` (modified, +15/-5)
```diff
@@ -27,7 +27,7 @@
 )
 from composio.utils import mimetypes
 from composio.utils.json_schema import dereference_json_schema
-from composio.utils.safe_path import secure_basename_join, secure_join
+from composio.utils.safe_path import open_unique_file, secure_basename_join, secure_join
 from composio.utils.url_safety import (
     parse_content_length,
     safe_get,
@@ -716,8 +716,11 @@ def download(
             outfile = secure_basename_join(outdir, self.name, root=root)
         except UnsafePathComponentError as e:
             raise ErrorDownloadingFile(str(e)) from e
+        # A presigned storage URL can legitimately answer with a redirect (an S3
+        # region redirect, say), so it is followed, with every hop validated.
         try:
-            response = safe_get(
+            response = safe_request(
+                "GET",
                 self.s3url,
                 stream=True,
                 timeout=(_CONNECT_TIMEOUT, _READ_TIMEOUT),
@@ -745,12 +748,17 @@ def download(
             )
 
         total_bytes = 0
+        created = False
         try:
             # Only once the fetch is validated and connected, so a blocked URL
             # leaves no directory behind — and inside the `try`, so a failure
             # here still closes the response.
             outdir.mkdir(exist_ok=True, parents=True)
-            with outfile.open("wb") as fd:
+            # A literal server name can equal a digest-tagged name. Claim the
+            # path exclusively, then choose a numbered name if it exists.
+            outfile, fd = open_unique_file(outfile)
+            created = True
+            with fd:
                 for chunk in response.iter_content(chunk_size=chunk_size):
                     if chunk:
                         total_bytes += len(chunk)
@@ -763,14 +771,16 @@ def download(
         except ResponseTooLargeError:
             # Propagates uncaught — callers must see the limit hit — but the
             # truncated file must not be left behind as if it were the download.
-            _discard_partial_download(outfile)
+            if created:
+                _discard_partial_download(outfile)
             raise
         except OSError as e:
             # `requests.exceptions.RequestException` subclasses `OSError`, so a
             # mid-stream transport failure and a failing `fd.write`/`mkdir`
             # (disk full, permissions) both land here — and both owe the caller
             # the `ErrorDownloadingFile` this method documents.
-            _discard_partial_download(outfile)
+            if created:
+                _discard_partial_download(outfile)
             raise ErrorDownloadingFile(
                 "Error downloading file: "
                 f"{_sanitize_url_for_logging(self.s3url)}. Error: {type(e).__name__}"
```

**File**: `python/composio/core/models/tool_router_session_files.py` (modified, +14/-2)
```diff
@@ -28,7 +28,7 @@
     ValidationError,
 )
 from composio.utils.mimetypes import get_extension_from_mime_type
-from composio.utils.safe_path import secure_basename_join
+from composio.utils.safe_path import open_unique_file, secure_basename_join
 from composio.utils.url_safety import (
     parse_content_length,
     safe_get,
@@ -232,6 +232,7 @@ def save(self, path: t.Optional[t.Union[str, Path]] = None) -> str:
 
         Returns the absolute path where the file was saved.
         If path is omitted, saves to ~/.composio/files/ using the filename.
+        An existing default destination gets a copy number before its extension.
         """
         content = self.buffer()
         save_path: Path
@@ -256,7 +257,18 @@ def save(self, path: t.Optional[t.Union[str, Path]] = None) -> str:
                 raise ValidationError(str(e)) from e
 
         save_path.parent.mkdir(parents=True, exist_ok=True)
-        save_path.write_bytes(content)
+        if path is not None:
+            save_path.write_bytes(content)
+        else:
+            save_path, fd = open_unique_file(save_path)
+            try:
+                with fd:
+                    fd.write(content)
+            except BaseException:
+                # The path was claimed for this save, so a failed write must
+                # not leave a partial file that a retry would number around.
+                save_path.unlink(missing_ok=True)
+                raise
         return str(save_path.resolve())
 
     @classmethod
```

**File**: `python/composio/utils/safe_path.py` (modified, +155/-51)
```diff
@@ -58,8 +58,16 @@
     | {f"LPT{i}" for i in "¹²³"}
 )
 """Reserved DOS device names. Writing to one on Windows targets the device
-rather than a file. Rejected on every platform so behaviour does not diverge
-between a POSIX developer machine and a Windows deployment."""
+rather than a file. Rejected as slugs and prefixed in filenames, on every
+platform, so behaviour does not diverge between a POSIX developer machine and a
+Windows deployment."""
+
+MAX_PRESERVED_EXTENSION_BYTES = 32
+"""Longest extension, in bytes and including its dot, that filename truncation
+keeps. Anything longer is not a real extension and is truncated with the rest."""
+
+_WINDOWS_INVALID_FILENAME_CHARS = re.compile(r'[\x00-\x1f<>:"|?*]')
+"""Control characters and characters reserved by Windows."""
 
 
 def is_inside_dir(child: Path, parent: Path) -> bool:
@@ -141,80 +149,176 @@ def assert_safe_path_component(value: str, *, label: str = "path component") ->
     return value
 
 
+def _encoded_length(value: str) -> int:
+    return len(os.fsencode(value))
+
+
+def _truncate_to_bytes(value: str, max_bytes: int) -> str:
+    """The longest prefix of ``value``, by whole code points, that fits in
+    ``max_bytes``."""
+    truncated = []
+    size = 0
+    for char in value:
+        size += _encoded_length(char)
+        if size > max_bytes:
+            break
+        truncated.append(char)
+    return "".join(truncated)
+
+
+def _split_extension(name: str) -> t.Tuple[str, str]:
+    """Split off a short trailing extension (with its dot); a leading dot is
+    not one."""
+    dot = name.rfind(".")
+    extension = name[dot:] if dot > 0 else ""
+    if extension and _encoded_length(extension) <= MAX_PRESERVED_EXTENSION_BYTES:
+        return name[:dot], extension
+    return name, ""
+
+
+def _fit_filename_bytes(name: str, max_bytes: int = MAX_COMPONENT_LENGTH) -> str:
+    """Truncate ``name`` to ``max_bytes``, keeping a short extension so the file
+    still opens with the right application."""
+    if _encoded_length(name) <= max_bytes:
+        return name
+    stem, extension = _split_extension(name)
+    return _truncate_to_bytes(stem, max_bytes - _encoded_length(extension)) + extension
+
+
+def numbered_basename(name: str, copy: int) -> str:
+    """Add a copy number before the extension within the filename byte limit."""
+    suffix = f"-{copy}"
+    stem, extension = _split_extension(name)
+    return (
+        _truncate_to_bytes(
+            stem, MAX_COMPONENT_LENGTH - _encoded_length(extension) - len(suffix)
+        )
+        + suffix
+        + extension
+    )
+
+
+def open_unique_file(path: Path) -> t.Tuple[Path, t.BinaryIO]:
+    """Claim a validated download path without replacing an existing file.
+
+    Numbered alternatives stay in the same directory and preserve a short
+    extension. Exclusive creation also prevents concurrent saves from sharing
+    a destination.
+    """
+    copy = 0
+    while True:
+        candidate = (
+            path if copy == 0 else path.with_name(numbered_basename(path.name, copy))
+        )
+        try:
+            return candidate, candidate.open("xb")
+        except FileExistsError:
+            copy += 1
+
+
+_FNV_OFFSET_BASIS_64 = 0xCBF29CE484222325
+_FNV_PRIME_64 = 0x100000001B3
+_UINT64_MASK = 0xFFFFFFFFFFFFFFFF
+
+
+def _fnv1a64_hex(value: str) -> str:
+    """64-bit FNV-1a of the UTF-8 bytes, as 16 hex digits. ``fnv1a64Hex`` in
+    the TypeScript SDK matches it."""
+    digest = _FNV_OFFSET_BASIS_64
+    for byte in value.encode("utf-8", "surrogatepass"):
+        digest = ((digest ^ byte) * _FNV_PRIME_64) & _UINT64_MASK
+    return f"{digest:016x}"
+
+
+def _tag_with_original(portable: str, original: str) -> str:
+    """Tag a name that portability changed with a digest of the name it came
+    from, before the extension: ``report?.png`` and ``report*.png`` both become
+    ``report_.png``, and two long names can share a truncated prefix, so
+    without the tag one download wou
```

**File**: `python/tests/test_files.py` (modified, +143/-52)
```diff
@@ -2659,7 +2659,7 @@ def _downloadable() -> FileDownloadable:
             s3url="https://example.com/report.bin",
         )
 
-    @patch("composio.core.models._files.safe_get")
+    @patch("composio.core.models._files.safe_request")
     def test_download_rejects_oversized_content_length(self, mock_get, tmp_path):
         """A self-declared oversized body is rejected before any bytes are read."""
         mock_response = MagicMock()
@@ -2673,7 +2673,7 @@ def test_download_rejects_oversized_content_length(self, mock_get, tmp_path):
 
         mock_response.iter_content.assert_not_called()
 
-    @patch("composio.core.models._files.safe_get")
+    @patch("composio.core.models._files.safe_request")
     def test_download_rejects_oversized_during_streaming(self, mock_get, tmp_path):
         """A dishonest (here, absent) Content-Length cannot bypass the cap."""
         mock_response = MagicMock()
@@ -2686,8 +2686,11 @@ def test_download_rejects_oversized_during_streaming(self, mock_get, tmp_path):
         with pytest.raises(ResponseTooLargeError):
             self._downloadable().download(outdir=tmp_path, root=tmp_path, max_size=1024)
 
-    @patch("composio.core.models._files.safe_get")
-    def test_download_removes_partial_file_on_failure(self, mock_get, tmp_path):
+    @pytest.mark.parametrize("existing", [False, True])
+    @patch("composio.core.models._files.safe_request")
+    def test_download_removes_partial_file_on_failure(
+        self, mock_get, tmp_path, existing
+    ):
         """A truncated download must not be left behind as if it succeeded."""
         mock_response = MagicMock()
         mock_response.status_code = 200
@@ -2696,12 +2699,19 @@ def test_download_removes_partial_file_on_failure(self, mock_get, tmp_path):
         mock_response.close = MagicMock()
         mock_get.return_value = mock_response
 
+        if existing:
+            (tmp_path / "report.bin").write_bytes(b"original")
+
         with pytest.raises(ResponseTooLargeError):
             self._downloadable().download(outdir=tmp_path, root=tmp_path, max_size=1024)
 
-        assert list(tmp_path.iterdir()) == []
+        if existing:
+            assert list(tmp_path.iterdir()) == [tmp_path / "report.bin"]
+            assert (tmp_path / "report.bin").read_bytes() == b"original"
+        else:
+            assert list(tmp_path.iterdir()) == []
 
-    @patch("composio.core.models._files.safe_get")
+    @patch("composio.core.models._files.safe_request")
     def test_download_accepts_file_within_limit(self, mock_get, tmp_path):
         """A body under the cap is written through unchanged."""
         mock_response = MagicMock()
@@ -2718,7 +2728,7 @@ def test_download_accepts_file_within_limit(self, mock_get, tmp_path):
         assert outfile.exists()
         assert outfile.read_bytes() == b"x" * 256 + b"y" * 256
 
-    @patch("composio.core.models._files.safe_get")
+    @patch("composio.core.models._files.safe_request")
     def test_download_wraps_stream_failure_and_removes_partial_file(
         self, mock_get, tmp_path
     ):
@@ -2740,7 +2750,7 @@ def failing_stream(chunk_size=None):
 
         assert list(tmp_path.iterdir()) == []
 
-    @patch("composio.core.models._files.safe_get")
+    @patch("composio.core.models._files.safe_request")
     def test_download_wraps_write_failure_and_removes_partial_file(
         self, mock_get, tmp_path
     ):
@@ -2942,7 +2952,7 @@ def test_relative_traversal_is_neutralized(self, tmp_path):
             s3url="https://example.com/file",
         )
         with patch(
-            "composio.core.models._files.safe_get",
+            "composio.core.models._files.safe_request",
             return_value=self._mock_response(b"#!/bin/sh\n"),
         ):
             written = f.download(outdir, root=outdir)
@@ -2961,7 +2971,7 @@ def test_absolute_path_is_neutralized(self, tmp_path):
             s3url="https://example.com/file",
         )
         with patch(
-            "composio.core.model
```

---

### Incident Patch 3: `3f43cb5b` (2026-09-30)
**Commit Message**: fix(core): remove a claimed download file when closing it fails

**File**: `ts/packages/core/src/platform/node.ts` (modified, +10/-8)
```diff
@@ -111,15 +111,17 @@ export const platform = {
 
   writeFileExclusiveSync(filePath: string, content: Uint8Array): void {
     const fd = fs.openSync(filePath, 'wx');
-    let written = false;
     try {
-      fs.writeFileSync(fd, content);
-      written = true;
-    } finally {
-      fs.closeSync(fd);
-      // The path was created here, so a failed write must not leave a
-      // partial file that a retry would treat as an existing download.
-      if (!written) fs.rmSync(filePath, { force: true });
+      try {
+        fs.writeFileSync(fd, content);
+      } finally {
+        fs.closeSync(fd);
+      }
+    } catch (error) {
+      // The path was created here, so a failed write or close must not leave
+      // a partial file that a retry would treat as an existing download.
+      fs.rmSync(filePath, { force: true });
+      throw error;
     }
   },
 } as Platform;
```

**File**: `ts/packages/core/test/platform/node.test.ts` (modified, +25/-1)
```diff
@@ -7,7 +7,11 @@ import { platform } from '../../src/platform/node';
 
 vi.mock('node:fs', async importOriginal => {
   const actual = await importOriginal<typeof import('node:fs')>();
-  return { ...actual, writeFileSync: vi.fn(actual.writeFileSync) };
+  return {
+    ...actual,
+    closeSync: vi.fn(actual.closeSync),
+    writeFileSync: vi.fn(actual.writeFileSync),
+  };
 });
 
 const invertAsciiCase = (value: string): string =>
@@ -63,6 +67,26 @@ describe('node platform exclusive writes', () => {
     }
   });
 
+  it('removes the file it created when closing it fails', () => {
+    const root = mkdtempSync(path.join(os.tmpdir(), 'composio-exclusive-write-'));
+    try {
+      const filePath = path.join(root, 'report.pdf');
+      const actual = vi.mocked(fs.closeSync).getMockImplementation()!;
+      // Some filesystems report a deferred write error only on close.
+      vi.mocked(fs.closeSync).mockImplementationOnce(fd => {
+        actual(fd);
+        throw Object.assign(new Error('disk quota exceeded'), { code: 'EDQUOT' });
+      });
+
+      expect(() => platform.writeFileExclusiveSync(filePath, new Uint8Array([1, 2]))).toThrow(
+        'disk quota exceeded'
+      );
+      expect(existsSync(filePath)).toBe(false);
+    } finally {
+      rmSync(root, { recursive: true, force: true });
+    }
+  });
+
   it('leaves an existing file untouched', () => {
     const root = mkdtempSync(path.join(os.tmpdir(), 'composio-exclusive-write-'));
     try {
```

---

### Incident Patch 4: `4257b990` (2026-09-30)
**Commit Message**: fix(sdk): remove a claimed download file when its write fails

**File**: `python/composio/core/models/tool_router_session_files.py` (modified, +8/-2)
```diff
@@ -261,8 +261,14 @@ def save(self, path: t.Optional[t.Union[str, Path]] = None) -> str:
             save_path.write_bytes(content)
         else:
             save_path, fd = open_unique_file(save_path)
-            with fd:
-                fd.write(content)
+            try:
+                with fd:
+                    fd.write(content)
+            except BaseException:
+                # The path was claimed for this save, so a failed write must
+                # not leave a partial file that a retry would number around.
+                save_path.unlink(missing_ok=True)
+                raise
         return str(save_path.resolve())
 
     @classmethod
```

**File**: `python/tests/test_tool_router_session_files.py` (modified, +18/-0)
```diff
@@ -406,6 +406,24 @@ def test_default_save_preserves_files_with_colliding_names(self, names, tmp_path
         assert all(len(path.name.encode()) <= 128 for path in paths)
         assert all(path.suffix == Path(names[0]).suffix for path in paths)
 
+    def test_failed_default_save_leaves_no_file_behind(self, tmp_path):
+        file = RemoteFile(
+            expires_at="2026-01-01",
+            mount_relative_path="report.pdf",
+            sandbox_mount_prefix="/mnt/files",
+            download_url="https://example.com/file",
+        )
+        with patch("pathlib.Path.home", return_value=tmp_path):
+            # Writing `str` to the binary file fails after the path is claimed.
+            with patch.object(file, "buffer", return_value="not bytes"):
+                with pytest.raises(TypeError):
+                    file.save()
+            with patch.object(file, "buffer", return_value=b"content"):
+                saved = Path(file.save())
+
+        assert saved.name == "report.pdf"
+        assert [path.name for path in saved.parent.iterdir()] == ["report.pdf"]
+
 
 class TestResponseDerivedUrlsAreGuarded:
     """`download_url` and `upload_url` are response fields, so they are guarded.
```

**File**: `ts/packages/core/src/platform/node.ts` (modified, +11/-1)
```diff
@@ -110,6 +110,16 @@ export const platform = {
   },
 
   writeFileExclusiveSync(filePath: string, content: Uint8Array): void {
-    fs.writeFileSync(filePath, content, { flag: 'wx' });
+    const fd = fs.openSync(filePath, 'wx');
+    let written = false;
+    try {
+      fs.writeFileSync(fd, content);
+      written = true;
+    } finally {
+      fs.closeSync(fd);
+      // The path was created here, so a failed write must not leave a
+      // partial file that a retry would treat as an existing download.
+      if (!written) fs.rmSync(filePath, { force: true });
+    }
   },
 } as Platform;
```

**File**: `ts/packages/core/src/platform/types.ts` (modified, +1/-1)
```diff
@@ -85,7 +85,7 @@ export interface Platform {
   writeFileSync(filePath: string, content: Uint8Array, encoding?: never): void;
   writeFileSync(filePath: string, content: string, encoding: Uint8ArrayEncoding): void;
 
-  /** Writes a new file, failing if its path already exists. */
+  /** Writes a new file, failing if its path already exists. A failed write removes the file. */
   writeFileExclusiveSync(filePath: string, content: Uint8Array): void;
 
   /**
```

**File**: `ts/packages/core/test/platform/node.test.ts` (modified, +43/-2)
```diff
@@ -1,9 +1,15 @@
-import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
+import * as fs from 'node:fs';
+import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
 import * as os from 'node:os';
 import * as path from 'node:path';
-import { describe, expect, it } from 'vitest';
+import { describe, expect, it, vi } from 'vitest';
 import { platform } from '../../src/platform/node';
 
+vi.mock('node:fs', async importOriginal => {
+  const actual = await importOriginal<typeof import('node:fs')>();
+  return { ...actual, writeFileSync: vi.fn(actual.writeFileSync) };
+});
+
 const invertAsciiCase = (value: string): string =>
   [...value]
     .map(character => {
@@ -35,3 +41,38 @@ describe('node platform filesystem case detection', () => {
     }
   });
 });
+
+describe('node platform exclusive writes', () => {
+  it('removes the file it created when the write fails', () => {
+    const root = mkdtempSync(path.join(os.tmpdir(), 'composio-exclusive-write-'));
+    try {
+      const filePath = path.join(root, 'report.pdf');
+      const actual = vi.mocked(fs.writeFileSync).getMockImplementation()!;
+      // A disk that fills up mid-write: some bytes land, then the write fails.
+      vi.mocked(fs.writeFileSync).mockImplementationOnce((file, data, options) => {
+        actual(file, (data as Uint8Array).subarray(0, 1), options);
+        throw Object.assign(new Error('no space left on device'), { code: 'ENOSPC' });
+      });
+
+      expect(() => platform.writeFileExclusiveSync(filePath, new Uint8Array([1, 2]))).toThrow(
+        'no space left on device'
+      );
+      expect(existsSync(filePath)).toBe(false);
+    } finally {
+      rmSync(root, { recursive: true, force: true });
+    }
+  });
+
+  it('leaves an existing file untouched', () => {
+    const root = mkdtempSync(path.join(os.tmpdir(), 'composio-exclusive-write-'));
+    try {
+      const filePath = path.join(root, 'report.pdf');
+      writeFileSync(filePath, 'original');
+
+      expect(() => platform.writeFileExclusiveSync(filePath, new Uint8Array([1]))).toThrow();
+      expect(readFileSync(filePath, 'utf8')).toBe('original');
+    } finally {
+      rmSync(root, { recursive: true, force: true });
+    }
+  });
+});
```

---

### Incident Patch 5: `a1e7a6f7` (2026-09-30)
**Commit Message**: fix(json-schema-to-zod): keep guarded tool schemas as objects (#4686)

This PR:
- fixes two regressions from
https://github.com/ComposioHQ/composio/pull/4316 in the whole-schema
guard
- keeps the converted schema's Zod kind: guarded nodes now subclass
their own class instead of `z.any().pipe(...)`, so an object tool schema
stays a `ZodObject` with a `shape`
- LangChain, Vercel, and LlamaIndex emitted
`{"allOf":[{},{"type":"object",...}]}` for any tool with
`anyOf`/`oneOf`/`allOf`/`$ref`/… anywhere; OpenAI returned 400 `schema
must be a JSON Schema of 'type: "object"'` and Anthropic returned 400
`input_schema.type: Field required`
- Claude Agent SDK (MCP `tools/list`) collapsed those tools to empty
parameters
- gives the guard's interpreter Unicode-mode spellings of patterns
(`toUnicodePattern`): `@cfworker/json-schema` compiles with the `u`
flag, so identity escapes like `\_` failed every call with `Invalid
regular expression … Invalid escape`
- keeps the guard validating raw input before defaults, composes nested
guards, and survives `.describe()`
- adds regression tests in `test/semantic-regressions.test.ts` (both
fail on `next`)

## Verification

- live calls through the LangCha

**File**: `.changeset/json-schema-to-zod-object-root.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'@composio/json-schema-to-zod': patch
+'@composio/core': patch
+---
+
+Fix tool schemas rejected by OpenAI and Anthropic when a parameter uses `anyOf`, `oneOf`, `allOf`, `$ref`, or similar keywords. The converted schema is a `ZodObject` again, so the LangChain, Vercel, LlamaIndex, and Claude Agent SDK providers send tool parameters with a top-level `type: "object"`. Patterns with escapes such as `\_` or `\:` no longer fail every call to the tool.
```

**File**: `ts/packages/json-schema-to-zod/src/utils/unicode-pattern.ts` (added, +184/-0)
```diff
@@ -0,0 +1,184 @@
+const compilesAsUnicode = (pattern: string): boolean => {
+  try {
+    new RegExp(pattern, 'u');
+    return true;
+  } catch {
+    return false;
+  }
+};
+
+const REGEX_SYNTAX_CHARACTERS = new Set('^$\\.*+?()[]{}|/');
+const CHARACTER_CLASS_ESCAPES = new Set('dDwWsS');
+const CONTROL_ESCAPES = new Set('fnrtv');
+const HEX_DIGIT = /^[0-9A-Fa-f]$/;
+const QUANTIFIER = /^\{\d+(?:,\d*)?\}/;
+
+const hexEscape = (code: number): string => `\\x${code.toString(16).padStart(2, '0')}`;
+
+/** Capturing group count and whether any is named, as the parser counts them. */
+const scanGroups = (pattern: string): { count: number; named: boolean } => {
+  let count = 0;
+  let named = false;
+  let inClass = false;
+  for (let index = 0; index < pattern.length; index++) {
+    const char = pattern[index];
+    if (char === '\\') {
+      index++;
+    } else if (inClass) {
+      inClass = char !== ']';
+    } else if (char === '[') {
+      inClass = true;
+    } else if (char === '(') {
+      if (pattern[index + 1] !== '?') {
+        count++;
+      } else if (pattern[index + 2] === '<' && !'=!'.includes(pattern[index + 3] ?? '')) {
+        count++;
+        named = true;
+      }
+    }
+  }
+  return { count, named };
+};
+
+/**
+ * A legacy octal escape (a `\` digit sequence that is not a backreference) as
+ * a hex escape. Returns the replacement and how many digits it consumed.
+ */
+const legacyOctalEscape = (pattern: string, index: number): [string, number] => {
+  const first = pattern[index];
+  if (first === '8' || first === '9') {
+    return [first, 1];
+  }
+  const maxDigits = first <= '3' ? 3 : 2;
+  let digits = first;
+  while (digits.length < maxDigits && /^[0-7]$/.test(pattern[index + digits.length] ?? '')) {
+    digits += pattern[index + digits.length];
+  }
+  return [hexEscape(parseInt(digits, 8)), digits.length];
+};
+
+/**
+ * The interpreter compiles every pattern with the `u` flag, while
+ * `compilePattern` and the native parsers deliberately do not. This spells a
+ * pattern written for the legacy (Annex B) grammar in the Unicode grammar with
+ * the same meaning: identity escapes such as `\_`, `\:` or `\k` become the
+ * literal character, incomplete `\x`, `\u` and `\c` escapes and legacy octal
+ * escapes are spelled out, lone `{`, `}` and `]` are escaped, and a hyphen
+ * next to a class escape (`[\w-.]`), which is a literal there, is escaped.
+ *
+ * Returns `undefined` for the few legacy constructs with no Unicode spelling,
+ * such as a quantified lookahead. Matching differs only for astral
+ * characters, which `.` and negated classes treat as one character, not two.
+ */
+export const toUnicodePattern = (pattern: string): string | undefined => {
+  const { count: groupCount, named: hasNamedGroups } = scanGroups(pattern);
+
+  let rewritten = '';
+  let inClass = false;
+  let previousAtomWasClassEscape = false;
+  let index = 0;
+  while (index < pattern.length) {
+    const char = pattern[index];
+
+    if (char !== '\\' && inClass) {
+      if (char === ']') {
+        inClass = false;
+        rewritten += char;
+      } else if (
+        char === '-' &&
+        (previousAtomWasClassEscape ||
+          (pattern[index + 1] === '\\' && CHARACTER_CLASS_ESCAPES.has(pattern[index + 2] ?? '')))
+      ) {
+        rewritten += '\\-';
+      } else {
+        rewritten += char;
+      }
+      previousAtomWasClassEscape = false;
+      index++;
+      continue;
+    }
+
+    if (char !== '\\') {
+      const quantifier = char === '{' ? QUANTIFIER.exec(pattern.slice(index)) : null;
+      if (char === '[') {
+        inClass = true;
+        const opening = pattern[index + 1] === '^' ? '[^' : '[';
+        rewritten += opening;
+        index += opening.length;
+      } else if (quantifier) {
+        rewritten += quantifier[0];
+        index += quantifier[0].length;
+      } else {
+        rewritten += char === '{' || char === '}' || char === ']' ? `\\${char}` : char;
+        in
```

**File**: `ts/packages/json-schema-to-zod/src/whole-schema-validation.ts` (modified, +240/-33)
```diff
@@ -1,8 +1,9 @@
-import { encodePointer, Validator } from '@cfworker/json-schema';
+import { encodePointer, format, Validator } from '@cfworker/json-schema';
 import type { Schema as InterpreterSchema } from '@cfworker/json-schema';
 import { z } from 'zod/v3';
 
 import type { JsonSchema, JsonSchemaObject } from './types';
+import { toUnicodePattern } from './utils/unicode-pattern';
 
 const REQUIRES_WHOLE_SCHEMA_VALIDATION = new Set([
   '$ref',
@@ -161,12 +162,149 @@ export const guardSchemaAt = (
       { ...refs.root, $ref: `#/${refs.path.map(part => encodePointer(String(part))).join('/')}` }
     : node;
 
+const patternKeyRenames = new WeakMap<object, ReadonlyMap<string, string>>();
+
+/**
+ * The Unicode spelling of each `patternProperties` key. Two keys that spell
+ * the same way (`^a\_b$` and `^a_b$`) stay separate entries: the later one is
+ * wrapped in a non-capturing group, which matches the same names, so neither
+ * value schema is dropped. A key with no Unicode spelling is kept as is and
+ * surfaces as a guard failure rather than an unenforced constraint.
+ */
+const renamePatternKeys = (patternProperties: object): ReadonlyMap<string, string> => {
+  const cached = patternKeyRenames.get(patternProperties);
+  if (cached) {
+    return cached;
+  }
+
+  const renames = new Map<string, string>();
+  const used = new Set<string>();
+  for (const key of Object.keys(patternProperties)) {
+    let renamed = toUnicodePattern(key) ?? key;
+    while (used.has(renamed)) {
+      renamed = `(?:${renamed})`;
+    }
+    used.add(renamed);
+    renames.set(key, renamed);
+  }
+  patternKeyRenames.set(patternProperties, renames);
+  return renames;
+};
+
+const decodePointerSegment = (segment: string): string => {
+  try {
+    return decodeURI(segment).replace(/~1/g, '/').replace(/~0/g, '~');
+  } catch {
+    return segment;
+  }
+};
+
+/**
+ * What a JSON Pointer segment addresses: a keyword of a schema, a name in a
+ * keyword's map (`properties`, `$defs`, ...), a `patternProperties` key, an
+ * index into a schema array, or something that holds no schemas.
+ */
+type PointerPosition = 'keyword' | 'name' | 'patternKey' | 'index' | 'other';
+
+const positionAfter = (position: PointerPosition, key: string, child: unknown): PointerPosition => {
+  if (position !== 'keyword') {
+    return position === 'other' ? 'other' : 'keyword';
+  }
+  if (key === 'patternProperties') {
+    return 'patternKey';
+  }
+  if (SCHEMA_MAP_KEYWORDS.has(key)) {
+    return 'name';
+  }
+  if (SCHEMA_ARRAY_KEYWORDS.has(key) || (SCHEMA_VALUE_KEYWORDS.has(key) && Array.isArray(child))) {
+    return 'index';
+  }
+  return SCHEMA_VALUE_KEYWORDS.has(key) ? 'keyword' : 'other';
+};
+
+/**
+ * A local `$ref` rewritten to address the renamed `patternProperties` keys of
+ * the interpreter copy. `root` is the unrenamed document it points into. Only
+ * a segment in keyword position is a keyword, so a definition that happens to
+ * be named `patternProperties` is not mistaken for one.
+ */
+const renameRefThroughPatternKeys = (ref: string, root: unknown): string => {
+  if (!ref.startsWith('#/')) {
+    return ref;
+  }
+
+  let node: unknown = root;
+  let position: PointerPosition = 'keyword';
+  let changed = false;
+  const renamed = ref
+    .slice(2)
+    .split('/')
+    .map(segment => {
+      const key = decodePointerSegment(segment);
+      let result = segment;
+      if (position === 'patternKey' && isObject(node)) {
+        const renamedKey = renamePatternKeys(node).get(key);
+        if (renamedKey !== undefined && renamedKey !== key) {
+          result = encodePointer(renamedKey);
+          changed = true;
+        }
+      }
+      const child =
+        isObject(node) || Array.isArray(node) ? (node as Record<string, unknown>)[key] : undefined;
+      position = positionAfter(position, key, child);
+      node = child;
+      return result;
+    });
+
+  return changed ? `#/${renamed.join('/')}` : ref;
+};
+
+const PATTERN_FORM
```

**File**: `ts/packages/json-schema-to-zod/test/semantic-regressions.test.ts` (modified, +103/-0)
```diff
@@ -1,4 +1,5 @@
 import Ajv from 'ajv';
+import { format } from '@cfworker/json-schema';
 import { describe, expect, it } from 'vitest';
 
 import { z } from 'zod/v3';
@@ -323,6 +324,108 @@ describe('whole-schema semantic regressions', () => {
     expect(jsonSchemaToZod(schema).safeParse(value).success).toBe(false);
   });
 
+  it('keeps a guarded object root a ZodObject with its shape', () => {
+    const schema: JsonSchema = {
+      type: 'object',
+      properties: {
+        q: { type: 'string' },
+        limit: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
+      },
+      required: ['q'],
+    };
+    const parsed = jsonSchemaToZod(schema);
+
+    expect(parsed).toBeInstanceOf(z.ZodObject);
+    expect(Object.keys((parsed as z.AnyZodObject).shape)).toEqual(['q', 'limit']);
+    expect(parsed.safeParse({ q: 'cats', limit: null }).success).toBe(true);
+    expect(parsed.safeParse({ q: 'cats', limit: 'ten' }).success).toBe(false);
+    expect(parsed.describe('Search').safeParse({ q: 'cats', limit: 'ten' }).success).toBe(false);
+  });
+
+  it('accepts patterns with identity escapes that Unicode mode refuses', () => {
+    const schema: JsonSchema = {
+      type: 'object',
+      properties: {
+        slug: { type: 'string', pattern: '^[a-z\\_]+$' },
+        ref: { $ref: '#/$defs/handle' },
+        limit: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
+      },
+      $defs: { handle: { type: 'string', pattern: '^\\@[a-z\\-]+$' } },
+    };
+    const parsed = jsonSchemaToZod(schema);
+
+    expect(parsed.safeParse({ slug: 'a_b', ref: '@a-b' }).success).toBe(true);
+    expect(parsed.safeParse({ slug: 'A' }).success).toBe(false);
+    expect(parsed.safeParse({ ref: 'a-b' }).success).toBe(false);
+  });
+
+  it.each([
+    { name: 'a legacy identity escape', pattern: '^\\k_$', valid: 'k_', invalid: 'wrong' },
+    { name: 'a quantified lookahead', pattern: '^(?=a){2}ab$', valid: 'ab', invalid: 'b' },
+  ])('enforces $name in a pattern only the guard sees', ({ pattern, valid, invalid }) => {
+    const schema: JsonSchema = {
+      type: 'object',
+      properties: { handle: { $ref: '#/$defs/handle' } },
+      $defs: { handle: { type: 'string', pattern } },
+    };
+    const parsed = jsonSchemaToZod(schema);
+
+    expect(parsed.safeParse({ handle: valid }).success).toBe(true);
+    expect(parsed.safeParse({ handle: invalid }).success).toBe(false);
+  });
+
+  it('leaves no pattern formats in the interpreter format table', () => {
+    const schema: JsonSchema = {
+      type: 'object',
+      properties: { handle: { $ref: '#/$defs/handle' } },
+      $defs: { handle: { type: 'string', pattern: '^leak-check-\\d+$' } },
+    };
+    const parsed = jsonSchemaToZod(schema);
+
+    expect(parsed.safeParse({ handle: 'leak-check-1' }).success).toBe(true);
+    expect(parsed.safeParse({ handle: 'wrong' }).success).toBe(false);
+    expect(Object.keys(format).filter(name => name.includes('leak-check'))).toEqual([]);
+  });
+
+  it('enforces every patternProperties key, including keys that differ only in escapes', () => {
+    const schema: JsonSchema = {
+      patternProperties: {
+        '^a\\_b$': { type: 'integer', minimum: 10 },
+        '^a_b$': { type: 'integer' },
+        '^\\k_$': { type: 'string' },
+      },
+    };
+    const parsed = jsonSchemaToZod(schema);
+
+    expect(parsed.safeParse({ a_b: 12, k_: 'ok' }).success).toBe(true);
+    expect(parsed.safeParse({ a_b: 2 }).success).toBe(false);
+    expect(parsed.safeParse({ k_: 1 }).success).toBe(false);
+  });
+
+  it('resolves references nested under a patternProperties key that needs a rewrite', () => {
+    const schema: JsonSchema = {
+      type: 'object',
+      patternProperties: { '^x\\_': { $ref: '#/$defs/label' } },
+      $defs: { label: { type: 'string' } },
+    };
+    const parsed = jsonSchemaToZod(schema);
+
+    expect(parsed.safeParse({ x_1: 'ok' }).success).toBe(true);
+    expect(parsed.safeParse({ x_1: 1 }).success).toBe(false
```

**File**: `ts/packages/json-schema-to-zod/test/unicode-pattern.test.ts` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+import fc from 'fast-check';
+import { describe, expect, it } from 'vitest';
+
+import { toUnicodePattern } from '../src/utils/unicode-pattern';
+
+const compiles = (pattern: string, flags?: string): boolean => {
+  try {
+    new RegExp(pattern, flags);
+    return true;
+  } catch {
+    return false;
+  }
+};
+
+const legacyCases: ReadonlyArray<{ pattern: string; matches: string[]; rejects: string[] }> = [
+  { pattern: '^[a-z\\_]+$', matches: ['a_b'], rejects: ['A'] },
+  { pattern: '^\\k_$', matches: ['k_'], rejects: ['wrong', '\\k_'] },
+  { pattern: '^a\\:b\\@c$', matches: ['a:b@c'], rejects: ['ab'] },
+  { pattern: '^a{$', matches: ['a{'], rejects: ['a'] },
+  { pattern: '^}]$', matches: ['}]'], rejects: [']'] },
+  { pattern: '^\\x4$', matches: ['x4'], rejects: ['\x04'] },
+  { pattern: '^\\u12$', matches: ['u12'], rejects: ['\u0012'] },
+  { pattern: '^\\p{L}$', matches: ['p{L}'], rejects: ['a'] },
+  { pattern: '^\\u{2}$', matches: ['uu'], rejects: ['\u0002'] },
+  { pattern: '^\\c$', matches: ['\\c'], rejects: ['c'] },
+  { pattern: '^[\\c1]$', matches: ['\x11'], rejects: ['1'] },
+  { pattern: '^\\1$', matches: ['\x01'], rejects: ['1'] },
+  { pattern: '^(a)\\1\\2$', matches: ['aa\x02'], rejects: ['aa'] },
+  { pattern: '^\\8$', matches: ['8'], rejects: ['\\8'] },
+  { pattern: '^[\\w-.]+$', matches: ['a-b.c'], rejects: ['a b'] },
+  { pattern: '^[.-\\d]$', matches: ['-', '5'], rejects: ['/'] },
+  { pattern: '^[\\B]$', matches: ['B'], rejects: ['b'] },
+];
+
+describe('toUnicodePattern', () => {
+  it.each(legacyCases)('gives $pattern its legacy meaning', ({ pattern, matches, rejects }) => {
+    const unicode = toUnicodePattern(pattern);
+    expect(unicode).toBeDefined();
+
+    for (const value of [...matches, ...rejects]) {
+      expect(new RegExp(unicode!, 'u').test(value), value).toBe(new RegExp(pattern).test(value));
+    }
+    expect(matches.every(value => new RegExp(pattern).test(value))).toBe(true);
+    expect(rejects.some(value => new RegExp(pattern).test(value))).toBe(false);
+  });
+
+  it('keeps patterns that already mean the same in both grammars', () => {
+    expect(toUnicodePattern('^[a-z]+(?:-[a-z]+)*$')).toBe('^[a-z]+(?:-[a-z]+)*$');
+    expect(toUnicodePattern('^(?<year>\\d{4})-\\k<year>$')).toBe('^(?<year>\\d{4})-\\k<year>$');
+  });
+
+  it('returns undefined for a quantified lookahead, which has no Unicode spelling', () => {
+    expect(compiles('^(?=a){2}a$')).toBe(true);
+    expect(toUnicodePattern('^(?=a){2}a$')).toBeUndefined();
+  });
+
+  it('matches exactly what the legacy pattern matches on ASCII input', () => {
+    const pattern = fc
+      .array(
+        fc.constantFrom(
+          ...'ab_:-.^$*+?()[]{}|/\\0189cdkpuxBDSWw,'.split(''),
+          '\\',
+          '\\\\',
+          '{2}',
+          '{1,3}'
+        ),
+        { maxLength: 12 }
+      )
+      .map(parts => parts.join(''))
+      .filter(candidate => compiles(candidate));
+    const input = fc.string({ unit: fc.constantFrom(...'ab_:-.^${}[]\\/ 019cdkpuxBw,'.split('')) });
+
+    fc.assert(
+      fc.property(pattern, fc.array(input, { maxLength: 8 }), (candidate, values) => {
+        const unicode = toUnicodePattern(candidate);
+        if (unicode === undefined) {
+          return;
+        }
+        for (const value of values) {
+          expect(new RegExp(unicode, 'u').test(value)).toBe(new RegExp(candidate).test(value));
+        }
+      }),
+      { numRuns: 2000 }
+    );
+  });
+});
```

---

### Incident Patch 6: `d336236f` (2026-09-30)
**Commit Message**: Merge branch 'next' into fix/json-schema-to-zod-object-root

**File**: `.changeset/connection-request-live-status.md` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
----
-'@composio/core': patch
----
-
-Keep `ConnectionRequest.status` in sync with `waitForConnection()`. The request now reports `ACTIVE` once the connection completes, or the terminal status (`FAILED`, `EXPIRED`, `REVOKED`) when it fails, matching `toJSON()` and the Python SDK.
```

**File**: `.changeset/connection-request-telemetry.md` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
----
-'@composio/core': patch
----
-
-Restore telemetry for `ConnectionRequest.waitForConnection()`. `telemetry.instrument()` now also instruments async methods defined directly on plain objects, such as the ones returned by `createConnectionRequest()`.
```

**File**: `.changeset/dependabot-september-rollup.md` (removed, +0/-9)
```diff
@@ -1,9 +0,0 @@
----
-'@composio/core': patch
-'@composio/slim': patch
-'@composio/experimental': patch
-'@composio/ts-builders': patch
-'@composio/anthropic': patch
----
-
-Refresh runtime dependencies and support Anthropic SDK 0.127 in the Anthropic provider.
```

**File**: `.changeset/premium-usage-response-contract.md` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
----
-'@composio/core': minor
----
-
-Expose the exact premium usage charge in project usage summaries and tool log metadata.
```

**File**: `.changeset/remove-openai-assistants-helpers.md` (removed, +0/-5)
```diff
@@ -1,5 +0,0 @@
----
-'@composio/core': minor
----
-
-Remove the deprecated OpenAI Assistants API helpers from `OpenAIProvider`: `handleAssistantMessage`, `waitAndHandleAssistantToolCalls`, and `waitAndHandleAssistantStreamToolCalls`. OpenAI shut down the Assistants API on August 26, 2026, so these helpers could no longer complete a run. Use `OpenAIResponsesProvider` from `@composio/openai` with the Responses API instead.
```

---

### Incident Patch 7: `9a23381d` (2026-09-30)
**Commit Message**: fix(sdk): preserve downloads when destination names collide

**File**: `.changeset/remote-file-portable-names.md` (modified, +1/-1)
```diff
@@ -2,4 +2,4 @@
 '@composio/core': patch
 ---
 
-`RemoteFile.save()` without a path no longer rejects ordinary file names. Names with characters Windows reserves, such as `report_2026-09-29T10:30:00.csv` or `What is this?.png`, are saved with those characters replaced by `_`. Names longer than 128 bytes are truncated with their extension kept, and reserved device names such as `NUL` get a `_` prefix. A name changed this way also gets a short digest of the original before its extension (`What is this_-9c68adf2da8b6e8d.png`), so two files whose names differ only in those characters never overwrite each other. Names with a NUL byte or no usable basename are still refused.
+`RemoteFile.save()` without a path no longer rejects ordinary file names. Names with characters Windows reserves, such as `report_2026-09-29T10:30:00.csv` or `What is this?.png`, are saved with those characters replaced by `_`. Names longer than 128 bytes are truncated with their extension kept, and reserved device names such as `NUL` get a `_` prefix. A name changed this way also gets a short digest of the original before its extension (`What is this_-9c68adf2da8b6e8d.png`). Default saves create a new file exclusively; if the destination exists, a copy number is added before its extension. Repeated default saves therefore return distinct paths and preserve earlier downloads. Names with a NUL byte or no usable basename are still refused.
```

**File**: `python/composio/core/models/_files.py` (modified, +11/-4)
```diff
@@ -27,7 +27,7 @@
 )
 from composio.utils import mimetypes
 from composio.utils.json_schema import dereference_json_schema
-from composio.utils.safe_path import secure_basename_join, secure_join
+from composio.utils.safe_path import open_unique_file, secure_basename_join, secure_join
 from composio.utils.url_safety import (
     parse_content_length,
     safe_get,
@@ -748,12 +748,17 @@ def download(
             )
 
         total_bytes = 0
+        created = False
         try:
             # Only once the fetch is validated and connected, so a blocked URL
             # leaves no directory behind — and inside the `try`, so a failure
             # here still closes the response.
             outdir.mkdir(exist_ok=True, parents=True)
-            with outfile.open("wb") as fd:
+            # A literal server name can equal a digest-tagged name. Claim the
+            # path exclusively, then choose a numbered name if it exists.
+            outfile, fd = open_unique_file(outfile)
+            created = True
+            with fd:
                 for chunk in response.iter_content(chunk_size=chunk_size):
                     if chunk:
                         total_bytes += len(chunk)
@@ -766,14 +771,16 @@ def download(
         except ResponseTooLargeError:
             # Propagates uncaught — callers must see the limit hit — but the
             # truncated file must not be left behind as if it were the download.
-            _discard_partial_download(outfile)
+            if created:
+                _discard_partial_download(outfile)
             raise
         except OSError as e:
             # `requests.exceptions.RequestException` subclasses `OSError`, so a
             # mid-stream transport failure and a failing `fd.write`/`mkdir`
             # (disk full, permissions) both land here — and both owe the caller
             # the `ErrorDownloadingFile` this method documents.
-            _discard_partial_download(outfile)
+            if created:
+                _discard_partial_download(outfile)
             raise ErrorDownloadingFile(
                 "Error downloading file: "
                 f"{_sanitize_url_for_logging(self.s3url)}. Error: {type(e).__name__}"
```

**File**: `python/composio/core/models/tool_router_session_files.py` (modified, +8/-2)
```diff
@@ -28,7 +28,7 @@
     ValidationError,
 )
 from composio.utils.mimetypes import get_extension_from_mime_type
-from composio.utils.safe_path import secure_basename_join
+from composio.utils.safe_path import open_unique_file, secure_basename_join
 from composio.utils.url_safety import (
     parse_content_length,
     safe_get,
@@ -232,6 +232,7 @@ def save(self, path: t.Optional[t.Union[str, Path]] = None) -> str:
 
         Returns the absolute path where the file was saved.
         If path is omitted, saves to ~/.composio/files/ using the filename.
+        An existing default destination gets a copy number before its extension.
         """
         content = self.buffer()
         save_path: Path
@@ -256,7 +257,12 @@ def save(self, path: t.Optional[t.Union[str, Path]] = None) -> str:
                 raise ValidationError(str(e)) from e
 
         save_path.parent.mkdir(parents=True, exist_ok=True)
-        save_path.write_bytes(content)
+        if path is not None:
+            save_path.write_bytes(content)
+        else:
+            save_path, fd = open_unique_file(save_path)
+            with fd:
+                fd.write(content)
         return str(save_path.resolve())
 
     @classmethod
```

**File**: `python/composio/utils/safe_path.py` (modified, +35/-2)
```diff
@@ -185,6 +185,37 @@ def _fit_filename_bytes(name: str, max_bytes: int = MAX_COMPONENT_LENGTH) -> str
     return _truncate_to_bytes(stem, max_bytes - _encoded_length(extension)) + extension
 
 
+def numbered_basename(name: str, copy: int) -> str:
+    """Add a copy number before the extension within the filename byte limit."""
+    suffix = f"-{copy}"
+    stem, extension = _split_extension(name)
+    return (
+        _truncate_to_bytes(
+            stem, MAX_COMPONENT_LENGTH - _encoded_length(extension) - len(suffix)
+        )
+        + suffix
+        + extension
+    )
+
+
+def open_unique_file(path: Path) -> t.Tuple[Path, t.BinaryIO]:
+    """Claim a validated download path without replacing an existing file.
+
+    Numbered alternatives stay in the same directory and preserve a short
+    extension. Exclusive creation also prevents concurrent saves from sharing
+    a destination.
+    """
+    copy = 0
+    while True:
+        candidate = (
+            path if copy == 0 else path.with_name(numbered_basename(path.name, copy))
+        )
+        try:
+            return candidate, candidate.open("xb")
+        except FileExistsError:
+            copy += 1
+
+
 _FNV_OFFSET_BASIS_64 = 0xCBF29CE484222325
 _FNV_PRIME_64 = 0x100000001B3
 _UINT64_MASK = 0xFFFFFFFFFFFFFFFF
@@ -238,8 +269,10 @@ def safe_basename(name: str, *, label: str = "filename") -> str:
     extension kept, trailing spaces and dots are dropped as Windows would, and
     a resulting reserved device name gets a ``_`` prefix. A name any of these
     rules changed is then tagged with a digest of the original before its
-    extension (``report_-<16 hex>.png``), so distinct names never land on the
-    same file; a name that was already portable is returned unchanged.
+    extension (``report_-<16 hex>.png``) to distinguish ordinary normalization
+    collisions; a name that was already portable is returned unchanged. The
+    result can still equal a literal server name, so download writes use
+    :func:`open_unique_file` to preserve existing files.
     ``safeBasename`` in the TypeScript SDK applies the same rules in the same
     order.
 
```

**File**: `python/tests/test_files.py` (modified, +42/-2)
```diff
@@ -2686,8 +2686,11 @@ def test_download_rejects_oversized_during_streaming(self, mock_get, tmp_path):
         with pytest.raises(ResponseTooLargeError):
             self._downloadable().download(outdir=tmp_path, root=tmp_path, max_size=1024)
 
+    @pytest.mark.parametrize("existing", [False, True])
     @patch("composio.core.models._files.safe_request")
-    def test_download_removes_partial_file_on_failure(self, mock_get, tmp_path):
+    def test_download_removes_partial_file_on_failure(
+        self, mock_get, tmp_path, existing
+    ):
         """A truncated download must not be left behind as if it succeeded."""
         mock_response = MagicMock()
         mock_response.status_code = 200
@@ -2696,10 +2699,17 @@ def test_download_removes_partial_file_on_failure(self, mock_get, tmp_path):
         mock_response.close = MagicMock()
         mock_get.return_value = mock_response
 
+        if existing:
+            (tmp_path / "report.bin").write_bytes(b"original")
+
         with pytest.raises(ResponseTooLargeError):
             self._downloadable().download(outdir=tmp_path, root=tmp_path, max_size=1024)
 
-        assert list(tmp_path.iterdir()) == []
+        if existing:
+            assert list(tmp_path.iterdir()) == [tmp_path / "report.bin"]
+            assert (tmp_path / "report.bin").read_bytes() == b"original"
+        else:
+            assert list(tmp_path.iterdir()) == []
 
     @patch("composio.core.models._files.safe_request")
     def test_download_accepts_file_within_limit(self, mock_get, tmp_path):
@@ -3215,6 +3225,36 @@ def test_names_that_normalize_alike_do_not_overwrite_each_other(self, tmp_path):
             b"\x02",
         ]
 
+    @pytest.mark.parametrize(
+        "names",
+        [
+            ["report?.png", "report_-05fcb95aa5b918e9.png"],
+            ["report_-05fcb95aa5b918e9.png", "report?.png"],
+            ["請" * 41 + ".pdf"] * 3,
+        ],
+    )
+    def test_literal_tag_name_does_not_overwrite_download(self, names, tmp_path):
+        outdir = tmp_path / "safe"
+        outfiles = []
+        for index, name in enumerate(names):
+            file = FileDownloadable(
+                name=name,
+                mimetype="image/png",
+                s3url="https://example.com/file",
+            )
+            with patch(
+                "composio.core.models._files.safe_request",
+                return_value=self._mock_response(bytes([index])),
+            ):
+                outfiles.append(file.download(outdir, root=outdir))
+
+        assert len(set(outfiles)) == len(names)
+        assert [outfile.read_bytes() for outfile in outfiles] == [
+            bytes([i]) for i in range(len(names))
+        ]
+        assert all(len(outfile.name.encode()) <= 128 for outfile in outfiles)
+        assert all(outfile.suffix == Path(names[0]).suffix for outfile in outfiles)
+
 
 class TestDownloadDirSlugTraversal:
     """Server-controlled tool/toolkit slugs must not relocate the download
```

---

### Incident Patch 8: `9cb9b97b` (2026-09-30)
**Commit Message**: fix(json-schema-to-zod): scope pattern formats to each guard's validation

**File**: `ts/packages/json-schema-to-zod/src/whole-schema-validation.ts` (modified, +33/-15)
```diff
@@ -261,23 +261,25 @@ const renameRefThroughPatternKeys = (ref: string, root: unknown): string => {
 
 const PATTERN_FORMAT_PREFIX = 'composio-pattern:';
 
+/** Pattern formats of one guard, installed on the interpreter only while it validates. */
+type PatternFormats = Map<string, (value: string) => boolean>;
+
 /**
- * Registers `pattern` as an interpreter format that tests it exactly as the
- * native string parser does, without the `u` flag, and returns the format
- * name. The name is derived from the pattern, so every schema using the same
- * pattern shares one entry. Returns `undefined` for a pattern that does not
- * compile at all, which the interpreter then reports as it always has.
+ * Adds `pattern` to `formats` as an interpreter format that tests it exactly as
+ * the native string parser does, without the `u` flag, and returns the format
+ * name. Returns `undefined` for a pattern that does not compile at all, which
+ * the interpreter then reports as it always has.
  */
-const patternFormat = (pattern: string): string | undefined => {
+const patternFormat = (pattern: string, formats: PatternFormats): string | undefined => {
   const name = `${PATTERN_FORMAT_PREFIX}${pattern}`;
-  if (!Object.hasOwn(format, name)) {
+  if (!formats.has(name)) {
     let regex: RegExp;
     try {
       regex = new RegExp(pattern);
     } catch {
       return undefined;
     }
-    format[name] = value => regex.test(value);
+    formats.set(name, value => regex.test(value));
   }
   return name;
 };
@@ -295,9 +297,14 @@ const patternFormat = (pattern: string): string | undefined => {
  *   `patternProperties` key cannot leave the interpreter, so it gets its
  *   Unicode spelling (`toUnicodePattern`), and local `$ref`s through a renamed
  *   key follow the rename. `root` is the unmodified document those refs
- *   address.
+ *   address. `formats` collects the pattern formats.
  */
-const prepareInterpreterSchema = (value: unknown, seen: WeakSet<object>, root: unknown): void => {
+const prepareInterpreterSchema = (
+  value: unknown,
+  seen: WeakSet<object>,
+  root: unknown,
+  formats: PatternFormats
+): void => {
   if (!isObject(value) || seen.has(value)) {
     return;
   }
@@ -320,7 +327,7 @@ const prepareInterpreterSchema = (value: unknown, seen: WeakSet<object>, root: u
     value.$ref = renameRefThroughPatternKeys(value.$ref, root);
   }
   const patternFormatName =
-    typeof value.pattern === 'string' ? patternFormat(value.pattern) : undefined;
+    typeof value.pattern === 'string' ? patternFormat(value.pattern, formats) : undefined;
   if (patternFormatName !== undefined) {
     delete value.pattern;
     if (value.format === undefined) {
@@ -342,12 +349,12 @@ const prepareInterpreterSchema = (value: unknown, seen: WeakSet<object>, root: u
 
   for (const [key, child] of Object.entries(value)) {
     if (SCHEMA_MAP_KEYWORDS.has(key) && isObject(child)) {
-      Object.values(child).forEach(nested => prepareInterpreterSchema(nested, seen, root));
+      Object.values(child).forEach(nested => prepareInterpreterSchema(nested, seen, root, formats));
     } else if (SCHEMA_ARRAY_KEYWORDS.has(key) && Array.isArray(child)) {
-      child.forEach(nested => prepareInterpreterSchema(nested, seen, root));
+      child.forEach(nested => prepareInterpreterSchema(nested, seen, root, formats));
     } else if (SCHEMA_VALUE_KEYWORDS.has(key)) {
       (Array.isArray(child) ? child : [child]).forEach(nested =>
-        prepareInterpreterSchema(nested, seen, root)
+        prepareInterpreterSchema(nested, seen, root, formats)
       );
     }
   }
@@ -401,19 +408,30 @@ export const withWholeSchemaValidation = (
   parsedSchema: z.ZodTypeAny
 ): z.ZodTypeAny => {
   const interpreterSchema = structuredClone(jsonSchema);
-  prepareInterpreterSchema(interpreterSchema, new WeakSet(), jsonSchema);
+  const formats: PatternFormats = new Map();
+  prepareInterpreterSchema(interpreterSchema, new WeakSet(), jsonSchema, formats);
   const v
```

**File**: `ts/packages/json-schema-to-zod/test/semantic-regressions.test.ts` (modified, +14/-0)
```diff
@@ -1,4 +1,5 @@
 import Ajv from 'ajv';
+import { format } from '@cfworker/json-schema';
 import { describe, expect, it } from 'vitest';
 
 import { z } from 'zod/v3';
@@ -373,6 +374,19 @@ describe('whole-schema semantic regressions', () => {
     expect(parsed.safeParse({ handle: invalid }).success).toBe(false);
   });
 
+  it('leaves no pattern formats in the interpreter format table', () => {
+    const schema: JsonSchema = {
+      type: 'object',
+      properties: { handle: { $ref: '#/$defs/handle' } },
+      $defs: { handle: { type: 'string', pattern: '^leak-check-\\d+$' } },
+    };
+    const parsed = jsonSchemaToZod(schema);
+
+    expect(parsed.safeParse({ handle: 'leak-check-1' }).success).toBe(true);
+    expect(parsed.safeParse({ handle: 'wrong' }).success).toBe(false);
+    expect(Object.keys(format).filter(name => name.includes('leak-check'))).toEqual([]);
+  });
+
   it('enforces every patternProperties key, including keys that differ only in escapes', () => {
     const schema: JsonSchema = {
       patternProperties: {
```

---

### Incident Patch 9: `6f134ff9` (2026-09-30)
**Commit Message**: fix(gemini): run optional and constrained arguments through AFC again (#4691)

This PR:
- fixes two regressions from
https://github.com/ComposioHQ/composio/pull/4316 in `composio_gemini`
automatic function calling (AFC)
- builds the validation model with defaults (`skip_default=False`): with
`skip_default=True`, every optional argument was required, so
`fn(query="is:unread")` raised `ValidationError: max_results Field
required` and the tool never ran
- hands AFC plain annotations (`_afc_annotation`): google-genai converts
arguments with `isinstance` on each annotation, which raised `TypeError`
on the `Annotated[...]`, `Dict[str, Any]` and `typing.Any` annotations
#4316 introduced
- affected: enums, `pattern`, `minimum`/`maximum`, `anyOf`, `const`,
free-form objects, arrays of objects
- declarations match the ones before #4316, except a free-form property
without a `type`, now declared without one so any value converts; a
typeless `const`/`enum` is declared with its values' type; the source
schema is still enforced by `args_schema`
- serializes AFC's pydantic models with `exclude_unset=True,
by_alias=True`, so omitted nested optional fields are no longer sent as
`null`
- replaces th

**File**: `python/providers/gemini/composio_gemini/provider.py` (modified, +68/-10)
```diff
@@ -42,19 +42,71 @@ def _to_serializable(value: t.Any) -> t.Any:
     the Composio ``execute_tool`` call fails.  This helper normalises them back
     to plain Python primitives before handing off to the API.
     """
+    # Only fields the model returned: AFC fills omitted optional fields with
+    # ``None``, which the tool schema may not allow. Aliases restore reserved
+    # names such as ``from``.
     # Pydantic v2 BaseModel
     if hasattr(value, "model_dump"):
-        return value.model_dump()
+        return value.model_dump(exclude_unset=True, by_alias=True)
     # Pydantic v1 BaseModel
     if hasattr(value, "dict") and hasattr(value, "__fields__"):
-        return value.dict()
+        return value.dict(exclude_unset=True, by_alias=True)
     if isinstance(value, dict):
         return {k: _to_serializable(v) for k, v in value.items()}
     if isinstance(value, (list, tuple)):
         return [_to_serializable(v) for v in value]
     return value
 
 
+def _literal_type(schema: t.Any) -> type:
+    """The Python type shared by a typeless property's ``const``/``enum``
+    values, or ``object`` when there is none."""
+    if not isinstance(schema, dict):
+        return object
+    if "const" in schema:
+        values = [schema["const"]]
+    elif isinstance(schema.get("enum"), list) and schema["enum"]:
+        values = schema["enum"]
+    else:
+        return object
+    # ``bool`` first: it is a subclass of ``int``.
+    for literal_type in (bool, str, int, float):
+        if all(type(value) is literal_type for value in values):
+            return literal_type
+    return object
+
+
+def _afc_annotation(annotation: t.Any, schema: t.Any = None) -> t.Any:
+    """Return an annotation google-genai AFC can convert arguments with.
+
+    AFC reads the callable's signature both to declare the function and to
+    convert the arguments the model returns, and the conversion calls
+    ``isinstance`` with the annotation. That raises on ``Annotated[...]``,
+    parameterized ``Dict`` and ``typing.Any``, so any tool using them failed
+    before it ran. The plain annotations declare the same function; the source
+    schema is still enforced by ``args_schema``.
+
+    A property without a ``type`` is ``typing.Any``. A bare ``const`` or
+    ``enum`` is declared with the type of its values, so ``{"enum": ["asc",
+    "desc"]}`` stays a string as it was before the signature carried
+    validators. Anything else becomes ``object``, which declares no type and
+    lets the conversion accept any value.
+    """
+    origin = t.get_origin(annotation)
+    args = t.get_args(annotation)
+    if origin is t.Annotated:
+        return _afc_annotation(args[0], schema)
+    if origin is list and args:
+        return t.List[_afc_annotation(args[0])]  # type: ignore[misc]
+    if origin is dict:
+        return dict
+    if origin in (t.Union, pytypes.UnionType):
+        return t.Union[tuple(_afc_annotation(arg) for arg in args)]
+    if annotation is t.Any:
+        return _literal_type(schema)
+    return annotation
+
+
 def _process_execution_result(result: t.Any) -> t.Dict:
     """Process a tool execution result into a dict suitable for Gemini function responses."""
     if not isinstance(result, dict):
@@ -105,10 +157,10 @@ def wrap_tool(
         2. Store it in the AFC ``function_map`` for automatic execution
         """
         aliases = alias_tool_input_schema(schema=tool.input_parameters)
-        args_schema = json_schema_to_model(
-            aliases.schema,
-            skip_default=self.skip_default,
-        )
+        # Defaults stay out of the function declaration (see below), but the
+        # validation model needs them: without a default every optional field
+        # would be required.
+        args_schema = json_schema_to_model(aliases.schema, skip_default=False)
         self._executors[tool.slug] = (execute_tool, aliases, args_schema)
 
         def function(**kwargs: t.Any) -> t.Dict:
@@ -137,10 +189,
```

**File**: `python/tests/test_gemini_provider.py` (modified, +203/-3)
```diff
@@ -10,7 +10,6 @@
 """
 
 import inspect
-import typing as t
 from unittest.mock import MagicMock, Mock
 
 import pytest
@@ -194,8 +193,10 @@ def test_callable_has_typed_free_form_object_argument(self):
         result = provider.wrap_tool(tool, create_mock_execute_tool())
         parameter = inspect.signature(result).parameters["payload"]
 
-        assert parameter.annotation == t.Dict[str, t.Any]  # noqa: UP006
-        assert result.__annotations__["payload"] == t.Dict[str, t.Any]  # noqa: UP006
+        # Plain `dict`: AFC calls `isinstance` with each value's annotation, and
+        # `Dict[str, Any]` makes that raise for every nested value.
+        assert parameter.annotation is dict
+        assert result.__annotations__["payload"] is dict
 
     def test_callable_has_annotations(self):
         from composio_gemini import GeminiProvider
@@ -539,6 +540,146 @@ def test_empty_list(self):
 # ---------------------------------------------------------------------------
 
 
+AFC_CASES = [
+    pytest.param(
+        {"query": {"type": "string"}, "max_results": {"type": "integer"}},
+        ["query"],
+        {"query": "is:unread"},
+        {"query": {"type": "STRING"}, "max_results": {"type": "INTEGER"}},
+        id="omitted-optional",
+    ),
+    pytest.param(
+        {"order": {"type": "string", "enum": ["asc", "desc"]}},
+        ["order"],
+        {"order": "asc"},
+        {"order": {"type": "STRING"}},
+        id="enum",
+    ),
+    pytest.param(
+        {"order": {"enum": ["asc", "desc"]}},
+        ["order"],
+        {"order": "asc"},
+        {"order": {"type": "STRING"}},
+        id="typeless-enum",
+    ),
+    pytest.param(
+        {"slug": {"type": "string", "pattern": "^[a-z_]+$"}},
+        ["slug"],
+        {"slug": "a_b"},
+        {"slug": {"type": "STRING"}},
+        id="pattern",
+    ),
+    pytest.param(
+        {"n": {"type": "integer", "minimum": 1}},
+        ["n"],
+        {"n": 3},
+        {"n": {"type": "INTEGER"}},
+        id="minimum",
+    ),
+    pytest.param(
+        {"v": {"anyOf": [{"type": "integer"}, {"type": "string"}]}},
+        ["v"],
+        {"v": "x"},
+        {"v": {"any_of": [{"type": "INTEGER"}, {"type": "STRING"}], "type": "OBJECT"}},
+        id="any-of",
+    ),
+    pytest.param(
+        {"meta": {"type": "object"}},
+        ["meta"],
+        {"meta": {"x": {"y": 1}}},
+        {"meta": {"type": "OBJECT"}},
+        id="free-form-object",
+    ),
+    pytest.param(
+        {"meta": {"description": "Anything"}},
+        ["meta"],
+        {"meta": {"x": 1}},
+        {"meta": {}},
+        id="typeless-free-form",
+    ),
+    pytest.param(
+        {"c": {"const": "fixed"}},
+        ["c"],
+        {"c": "fixed"},
+        {"c": {"type": "STRING"}},
+        id="const",
+    ),
+    pytest.param(
+        {"version": {"const": 2}},
+        ["version"],
+        {"version": 2},
+        {"version": {"type": "INTEGER"}},
+        id="integer-const",
+    ),
+    pytest.param(
+        {
+            "body": {
+                "type": "object",
+                "properties": {"a": {"type": "string"}, "b": {"type": "integer"}},
+                "required": ["a"],
+            }
+        },
+        ["body"],
+        {"body": {"a": "x"}},
+        {
+            "body": {
+                "type": "OBJECT",
+                "properties": {"a": {"type": "STRING"}, "b": {"type": "INTEGER"}},
+                "required": ["a", "b"],
+            }
+        },
+        id="nested-omitted-optional",
+    ),
+    pytest.param(
+        {
+            "items": {
+                "type": "array",
+                "items": {
+                    "type": "object",
+                    "properties": {"k": {"type": "string"}, "v": {"type": "string"}},
+                    "required": ["k"],
+                },
+            }
+        },
+        ["items"],
+        {"items": [{"k": "a"}, {"k": "b", "v": "c"}]},
+        {
+            "items": {
+                
```

---

### Incident Patch 10: `5ee8ec3a` (2026-09-30)
**Commit Message**: docs: drop the x-debug ZDR caveat and say what audit logs hold

Composio no longer archives requests that carry the x-debug: true header
when their project has ZDR on (ComposioHQ/platform#12683), so the page
drops that row from the not-covered table. The audit logs bullet now
says they hold no request arguments, response data, or error text.

**File**: `docs/content/docs/security/zero-data-retention.mdx` (modified, +1/-2)
```diff
@@ -53,7 +53,6 @@ ZDR does not cover the following, even in a ZDR project. For how long Composio k
 | Triggers | With ZDR on, trigger logs leave out event payloads, but Composio still stores the events to process and deliver them. | Do not use triggers for data that needs ZDR. |
 | Sandbox | The sandbox includes the Workbench and remote Bash. Sessions also offload large responses to it. Sessions turn on the sandbox by default. | [Disable the sandbox](#disable-the-sandbox-in-sessions) when you create sessions. |
 | Files | Composio stages files that tools upload or download, including Proxy Execute binary responses, and cleans them up after 24 hours. | Do not use tools that upload or download files for data that needs ZDR. |
-| Requests with the `x-debug: true` header | Composio archives these requests for debugging. | Do not send this header from ZDR projects. |
 | Tool search in sessions | Composio can cache search queries to improve results. | Keep sensitive data out of search queries, or use the [direct tools preset](/docs/configuring-sessions#direct-tools-preset) to turn off tool search. |
 | Third parties | The destination apps you connect, your model provider, external MCP servers, and your own logs keep their own data policies. | Review each provider's data policy, and set retention for your own logs. |
 
@@ -93,7 +92,7 @@ See [Disabling the sandbox](/docs/configuring-sessions#disabling-the-sandbox) fo
 
 Composio stores audit logs and telemetry on every plan, and ZDR does not change them:
 
-- **Audit logs** record who did what and when, including the metadata row for each tool call.
+- **Audit logs** record who did what and when, including the metadata row for each tool call. They do not hold request arguments, response data, or error text.
 - **Telemetry** is the metrics, traces, application logs, error reports, and usage metering that Composio uses to run and bill the service. Telemetry can include error messages returned by providers.
 
 ## Existing data
```

#### Recent Merged Pull Requests:
- **PR #4709** (2026-09-30): docs: update guides for SDK changes (@sdkrelease[bot])
- **PR #4708** (2026-09-30): docs: update TypeScript SDK reference from source (@sdkrelease[bot])
- **PR #4706** (2026-09-30): docs: drop the x-debug ZDR caveat and state that audit logs and telemetry hold no PII (@shubham22)
- **PR #4702** (2026-09-30): docs(kb): refresh public support knowledge (@sdkrelease[bot])
- **PR #4698** (2026-09-29): chore(release): prepare Python SDK 0.25.0 (@jkomyno)
- **PR #4697** (2026-09-30): docs(gong): list trusted IPs as bullets with inline code (@devin-ai-integration[bot])
- **PR #4695** (2026-09-29): docs: clarify Instant tools setup and project gate (@palash-c)
- **PR #4694** (2026-09-29): feat(core): adopt Instant session and account contracts (@prachi005)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
