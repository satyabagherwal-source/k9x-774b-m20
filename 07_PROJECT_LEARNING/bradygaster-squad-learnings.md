# Forensic Learning Record (Deep Inspection): bradygaster/squad

> **Canonical Artifact**: `07_PROJECT_LEARNING/bradygaster-squad-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bradygaster/squad](https://github.com/bradygaster/squad))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:14:22.718Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bradygaster/squad`
- **Description**: Squad: AI agent teams for any project
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 3243 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.squad-templates/ralph-triage.js`
```
#!/usr/bin/env node
/**
 * Ralph Triage Script — Standalone CJS implementation
 *
 * ⚠️ SYNC NOTICE: This file ports triage logic from the SDK source:
 *   packages/squad-sdk/src/ralph/triage.ts
 *
 * Any changes to routing/triage logic MUST be applied to BOTH files.
 * The SDK module is the canonical implementation; this script exists
 * for zero-dependency use in GitHub Actions workflows.
 *
 * To verify parity: npm test -- test/ralph-triage.test.ts
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const https = require('node:https');
const { execSync } = require('node:child_process');

function parseArgs(argv) {
  let squadDir = '.squad';
  let output = 'triage-results.json';

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--squad-dir') {
      squadDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--output') {
      output = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!squadDir) throw new Error('--squad-dir requires a value');
  if (!output) throw new Error('--output requires a value');

  return { squadDir, output };
}

function printUsage() {
  console.log('Usage: node .squad/templates/ralph-triage.js --squad-dir .squad --output triage-results.json');
}

function normalizeEol(content) {
  return content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

function slugify(text) { return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

function parseRoutingRules(routingMd) {
  const table =
    parseTableSection(routingMd, /^##\s*work\s*type\s*(?:→|->)\s*agent\b/i) ||
    parseTableSection(routingMd, /^##\s*routing\s*table\b/i);
  if (!table) return [];

  const workTypeIndex = findColumnIndex(table.headers, ['work type', 'type']);
  const agentIndex = findColumnIndex(table.headers, [
    'agent',
    'route to',
    'route',
    'primary agent',
    'primary',
  ]);
  const examplesIndex = findColumnIndex(table.headers, ['examples', 'example']);

  if (workTypeIndex < 0 || agentIndex < 0) return [];

  const rules = [];
  for (const row of table.rows) {
    const workType = cleanCell(row[workTypeIndex] || '');
    const agentName = cleanCell(row[agentIndex] || '');
    const keywords = splitKeywords(examplesIndex >= 0 ? row[examplesIndex] : '');
    if (!workType || !agentName) continue;
    rules.push({ workType, agentName, keywords });
  }

  return rules;
}

function parseModuleOwnership(routingMd) {
  const table = parseTableSection(routingMd, /^##\s*module\s*ownership\b/i);
  if (!table) return [];

  const moduleIndex = findColumnIndex(table.headers, ['module', 'path']);
  const primaryIndex = findColumnIndex(table.headers, ['primary']);
  const secondaryIndex = findColumnIndex(table.headers, ['secondary']);

  if (moduleIndex < 0 || primaryIndex < 0) return [];

  const modules = [];
  for (const row of table.rows) {
    const modulePath = normalizeModulePath(row[moduleIndex] || '');
    const primary = cleanCell(row[primaryIndex] || '');
    const secondaryRaw = cleanCell(secondaryIndex >= 0 ? row[secondaryIndex] || '' : '');
    const secondary = normalizeOptionalOwner(secondaryRaw);

    if (!modulePath || !primary) continue;
    modules.push({ modulePath, primary, secondary });
  }

  return modules;
}

function parseRoster(teamMd) {
  const table =
    parseTableSection(teamMd, /^##\s*members\b/i) ||
    parseTableSection(teamMd, /^##\s*team\s*roster\b/i);

  if (!table) return [];

  const nameIndex = findColumnIndex(table.headers, ['name']);
  const roleIndex = findColumnIndex(table.headers, ['role']);
  if (nameIndex < 0 || roleIndex < 0) return [];

  const excluded = new Set(['scribe', 'ralph']);
  const members = [];

  for (const row of table.rows) {
    const name = cleanCell(row[nameIndex] || '');
    const role = cleanCell(row[roleIndex] || '');
    if (!name || !role) continue;
    if (excluded.has(name.toLowerCase())) continue;

    members.push({
      name,
      role,
      label: `squad:${slugify(name)}`,
    });
  }

  return members;
}

function triageIssue(issue, rules, modules, roster) {
  const issueText = `${issue.title}\n${issue.body || ''}`.toLowerCase();
  const normalizedIssueText = normalizeTextForPathMatch(issueText);

  const bestModule = findBestModuleMatch(normalizedIssueText, modules);
  if (bestModule) {
    const primaryMember = findMember(bestModule.primary, roster);
    if (primaryMember) {
      return {
        agent: primaryMember,
        reason: `Matched module path "${bestModule.modulePath}" to primary owner "${bestModule.primary}"`,
        source: 'module-ownership',
        confidence: 'high',
      };
    }

    if (bestModule.secondary) {
      const secondaryMember = findMember(bestModule.secondary, roster);
      if (secondaryMember) {
        return {
          agent: secondaryMember,
          reason: `Matched module path "${bestModule.modulePath}" to secondary owner "${bestModule.secondary}"`,
          source: 'module-ownership',
          confidence: 'medium',
        };
      }
    }
  }

  const bestRule = findBestRuleMatch(issueText, rules, roster);
  if (bestRule) {
    return {
      agent: bestRule.agent,
      reason: `Matched routing keyword(s): ${bestRule.matchedKeywords.join(', ')}`,
      source: 'routing-rule',
      confidence: bestRule.matchedKeywords.length >= 2 ? 'high' : 'medium',
    };
  }

  const lead = findLeadFallback(roster);
  if (!lead) return null;

  return {
    agent: lead,
    reason: 'No module, routing, or role keyword match — routed to Lead/Architect',
    source: 'lead-fallback',
    confidence: 'low',
  };
}

function parseTableSection(markdown, sectionHeader) {
  const lines = normalizeEol(markdown).split('\n');
  let inSection = false;
  const tableLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!inSection && sectionHeader.test(trimmed)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s+/.test(trimmed)) break;
    if (inSection && trimmed.startsWith('|')) tableLines.push(trimmed);
  }

  if (tableLines.length === 0) return null;

  let headers = null;
  const rows = [];

  for (const line of tableLines) {
    const cells = parseTableLine(line);
    if (cells.length === 0) continue;
    if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) continue;

    if (!headers) {
      headers = cells;
      continue;
    }

    rows.push(cells);
  }

  if (!headers) return null;
  return { headers, rows };
}

function parseTableLine(line) {
  return line
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function findColumnIndex(headers, candidates) {
  const normalizedHeaders = headers.map((header) => cleanCell(header).toLowerCase());
  for (const candidate of candidates) {
    const index = normalizedHeaders.findIndex((header) => header.includes(candidate));
    if (index >= 0) return index;
  }
  return -1;
}

function cleanCell(value) {
  return value
    .replace(/`/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .trim();
}

function splitKeywords(examplesCell) {
  if (!examplesCell) return [];
  return examplesCell
    .split(/[,;]+/)
    .map((keyword) => cleanCell(keyword))
    .filter((keyword) => keyword.length > 0);
}

function normalizeOptionalOwner(owner) {
  if (!owner) return null;
  if (/^[-—–]+$/.test(owner)) return null;
  return owner;
}

function normalizeModulePath(modulePath) {
  return cleanCell(modulePath).replace(/\\/g, '/').toLowerCase();
}

function normalizeTextForPathMatch(text) {
  return text.replace(/\\/g, '/').replace(/`/g, '');
}

function normalizeName(value) {
  return cleanCell(value)
    .toLowerCase()
    .replace(/[^\w@\s-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeRouteDestination(value) {
  return va
```

### Core Architecture Module: `cli.js`
```
#!/usr/bin/env node

// Show deprecation only when invoked via npx/npm (not `node cli.js`)
if (process.env.npm_execpath) {
  console.error('\x1b[33m');
  console.error('⚠  DEPRECATION NOTICE');
  console.error('   npx github:bradygaster/squad is deprecated.');
  console.error('   Switch to: npm install -g @bradygaster/squad-cli@latest');
  console.error('   Or use:    npx @bradygaster/squad-cli');
  console.error('\x1b[0m');
}

// Forward to the built CLI entry point (auto-executes main())
import './packages/squad-cli/dist/cli-entry.js';
```

### Core Architecture Module: `eslint.config.mjs`
```
import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import nPlugin from "eslint-plugin-n";

export default [
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/.squad/**"],
  },

  // Source packages — type-aware rules enabled via tsconfig project service
  {
    files: ["packages/**/*.ts", "packages/**/*.tsx"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      n: nPlugin,
    },
    rules: {
      // Catch fire-and-forget promises and missing awaits
      "@typescript-eslint/no-floating-promises": "warn",

      // Flag synchronous I/O inside functions (allowAtRootLevel
      // permits sync calls in module-level config/setup code)
      "n/no-sync": ["warn", { allowAtRootLevel: true }],

      // Prevent console.log in production; allow warn/error
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // Test files — no tsconfig coverage, so only non-type-aware rules
  {
    files: ["test/**/*.ts"],
    languageOptions: {
      parser: tsParser,
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },
];

```

### Core Architecture Module: `packages/squad-cli/scripts/patch-esm-imports.mjs`
```
#!/usr/bin/env node

/**
 * ESM Import Patcher — dual-layer fix for Node 22/24+ compatibility
 *
 * Layer 1: Patch vscode-jsonrpc/package.json with `exports` field
 *   vscode-jsonrpc@8.2.1 has no `exports` field. Node 22+ strict ESM
 *   rejects subpath imports like 'vscode-jsonrpc/node' without it.
 *   Injecting the exports map from v9.x fixes ALL subpath imports at once.
 *
 * Layer 2: Patch @github/copilot-sdk session.js (defense-in-depth)
 *   copilot-sdk@0.1.32 imports 'vscode-jsonrpc/node' without .js extension.
 *   This layer ensures the import works even if Layer 1 somehow fails.
 *
 * Issue: bradygaster/squad#449
 * Upstream: https://github.com/github/copilot-sdk/issues/707
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Locations where npm workspaces / global install may place dependencies
const _cwdNodeModules = join(process.cwd(), 'node_modules');
const SEARCH_ROOTS = [
  join(__dirname, '..', 'node_modules'),              // squad-cli local
  join(__dirname, '..', '..', '..', 'node_modules'),  // workspace root
  join(__dirname, '..', '..'),                         // global install (sibling)
  _cwdNodeModules,                                     // consumer project (cwd)
].filter((p, i, arr) => arr.indexOf(p) === i);         // deduplicate

/**
 * Layer 1 — Inject `exports` field into vscode-jsonrpc/package.json.
 * This is the canonical fix: once the package has proper exports, Node's
 * ESM resolver handles every subpath ('vscode-jsonrpc/node', '/browser', etc.)
 * without needing per-file patches.
 *
 * Patches EVERY root that contains a copy, not just the first one found:
 * stopping at the first (already-patched) copy left repo-local node_modules
 * unpatched on global installs (#1190).
 */
export function patchVscodeJsonrpcExports(searchRoots = SEARCH_ROOTS) {
  const exportsField = {
    '.': { types: './lib/common/api.d.ts', default: './lib/node/main.js' },
    './node': { node: './lib/node/main.js', types: './lib/node/main.d.ts' },
    './node.js': { node: './lib/node/main.js', types: './lib/node/main.d.ts' },
    './browser': { types: './lib/browser/main.d.ts', browser: './lib/browser/main.js' },
  };

  let patchedAny = false;
  for (const root of searchRoots) {
    const pkgPath = join(root, 'vscode-jsonrpc', 'package.json');
    if (!existsSync(pkgPath)) continue;

    try {
      const raw = readFileSync(pkgPath, 'utf8');
      const pkg = JSON.parse(raw);

      if (pkg.exports && pkg.exports['./node.js']) {
        console.log(`⏭️  vscode-jsonrpc already has complete exports field — skipping (${pkgPath})`);
        continue;
      }

      pkg.exports = exportsField;
      writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
      console.log(`✅ Patched vscode-jsonrpc/package.json with exports field (${pkgPath})`);
      patchedAny = true;
    } catch (err) {
      console.warn('⚠️  Failed to patch vscode-jsonrpc exports:', err.message);
    }
  }

  return patchedAny;
}

/**
 * Layer 2 — Patch copilot-sdk session.js import (defense-in-depth).
 * Rewrites extensionless 'vscode-jsonrpc/node' to 'vscode-jsonrpc/node.js'.
 * Same all-roots semantics as Layer 1 (#1190).
 */
export function patchCopilotSdkSessionJs(searchRoots = SEARCH_ROOTS) {
  let patchedAny = false;
  for (const root of searchRoots) {
    const sessionJsPath = join(root, '@github', 'copilot-sdk', 'dist', 'session.js');
    if (!existsSync(sessionJsPath)) continue;

    try {
      const content = readFileSync(sessionJsPath, 'utf8');

      const patched = content.replace(
        /from\s+["']vscode-jsonrpc\/node["']/g,
        'from "vscode-jsonrpc/node.js"'
      );

      if (patched !== content) {
        writeFileSync(sessionJsPath, patched, 'utf8');
        console.log(`✅ Patched @github/copilot-sdk session.js ESM imports (${sessionJsPath})`);
        patchedAny = true;
      }
    } catch (err) {
      console.warn('⚠️  Failed to patch copilot-sdk session.js:', err.message);
    }
  }

  return patchedAny;
}

// Run both layers when executed directly (postinstall). `squad upgrade` imports
// the functions above and points them at the consumer repo's node_modules (#1190).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  patchVscodeJsonrpcExports();
  patchCopilotSdkSessionJs();
}
```

### Core Architecture Module: `packages/squad-cli/scripts/patch-ink-rendering.mjs`
```
#!/usr/bin/env node

/**
 * Ink Rendering Patcher for Squad CLI
 *
 * Patches ink/build/ink.js to fix scroll flicker on Windows Terminal.
 * Three patches are applied:
 *
 * 1. Remove trailing newline — the extra '\n' appended to output causes
 *    logUpdate's previousLineCount to be off by one, pushing the bottom of
 *    the UI below the viewport.
 *
 * 2. Disable clearTerminal fullscreen path — when output fills the terminal,
 *    Ink clears the entire screen, causing violent scroll-to-top flicker.
 *    We force the condition to `false` so logUpdate's incremental
 *    erase-and-rewrite is always used instead.
 *
 * 3. Verify incrementalRendering passthrough — confirms that Ink forwards
 *    the incrementalRendering option to logUpdate.create(). No code change
 *    needed if already wired up.
 *
 * All patches are idempotent (safe to run multiple times).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function patchInkRendering() {
  // Try multiple possible locations (npm workspaces can hoist dependencies)
  const possiblePaths = [
    // squad-cli package node_modules
    join(__dirname, '..', 'node_modules', 'ink', 'build', 'ink.js'),
    // Workspace root node_modules (common with npm workspaces)
    join(__dirname, '..', '..', '..', 'node_modules', 'ink', 'build', 'ink.js'),
    // Global install location (node_modules at parent of package)
    join(__dirname, '..', '..', 'ink', 'build', 'ink.js'),
  ];

  const inkJsPath = possiblePaths.find(p => existsSync(p)) ?? null;

  if (!inkJsPath) {
    // ink not installed yet — exit silently
    return false;
  }

  try {
    let content = readFileSync(inkJsPath, 'utf8');
    let patchCount = 0;

    // --- Patch 1: Remove trailing newline ---
    // Original:  const outputToRender = output + '\n';
    // Patched:   const outputToRender = output;
    const trailingNewlineSearch = "const outputToRender = output + '\\n';";
    const trailingNewlineReplace = 'const outputToRender = output;';
    if (content.includes(trailingNewlineSearch)) {
      content = content.replace(trailingNewlineSearch, trailingNewlineReplace);
      console.log('  ✅ Patch 1/3: Removed trailing newline from outputToRender');
      patchCount++;
    } else if (content.includes(trailingNewlineReplace)) {
      console.log('  ⏭️  Patch 1/3: Trailing newline already removed');
    } else {
      console.warn('  ⚠️  Patch 1/3: Could not find outputToRender pattern — Ink version may have changed');
    }

    // --- Patch 2: Disable clearTerminal fullscreen path ---
    // Original:  if (isFullscreen) {
    //              const sync = shouldSynchronize(this.options.stdout);
    //              ...
    //              this.options.stdout.write(ansiEscapes.clearTerminal + ...
    // Patched:   if (false) {
    //
    // We match `if (isFullscreen) {` only when followed by the clearTerminal
    // usage to avoid replacing unrelated isFullscreen references.
    const fullscreenSearch = /if \(isFullscreen\) \{\s*\n\s*const sync = shouldSynchronize/;
    const fullscreenAlreadyPatched = /if \(false\) \{\s*\n\s*const sync = shouldSynchronize/;
    if (fullscreenSearch.test(content)) {
      content = content.replace(
        /if \(isFullscreen\) (\{\s*\n\s*const sync = shouldSynchronize)/,
        'if (false) $1'
      );
      console.log('  ✅ Patch 2/3: Disabled clearTerminal fullscreen path');
      patchCount++;
    } else if (fullscreenAlreadyPatched.test(content)) {
      console.log('  ⏭️  Patch 2/3: clearTerminal path already disabled');
    } else {
      console.warn('  ⚠️  Patch 2/3: Could not find isFullscreen pattern — Ink version may have changed');
    }

    // --- Patch 3: Verify incrementalRendering passthrough ---
    const incrementalPattern = 'incremental: options.incrementalRendering';
    if (content.includes(incrementalPattern)) {
      console.log('  ✅ Patch 3/3: incrementalRendering passthrough verified (no change needed)');
    } else {
      console.warn('  ⚠️  Patch 3/3: incrementalRendering passthrough not found — Ink version may have changed');
    }

    if (patchCount > 0) {
      writeFileSync(inkJsPath, content, 'utf8');
      console.log(`✅ Patched ink.js with ${patchCount} rendering fix(es) for scroll flicker`);
      return true;
    }

    return false;
  } catch (err) {
    console.warn('⚠️  Failed to patch ink.js rendering:', err.message);
    console.warn('    Scroll flicker may occur on Windows Terminal.');
    return false;
  }
}

// Run patch
patchInkRendering();

```

### Core Architecture Module: `packages/squad-cli/src/cli-entry.ts`
```
#!/usr/bin/env node

/**
 * Squad CLI — entry point for command-line invocation.
 * Separated from src/index.ts so library consumers can import
 * the SDK without triggering CLI argument parsing or process.exit().
 *
 * SDK library exports live in src/index.ts (dist/index.js).
 */

process.env.NODE_NO_WARNINGS = '1';

// Suppress ExperimentalWarning (e.g. node:sqlite) from leaking to terminal.
// process.env.NODE_NO_WARNINGS only works when set BEFORE process starts;
// this runtime hook catches warnings emitted during dynamic imports below.
const _origEmit = process.emit;
process.emit = function (evt: string, ...args: unknown[]) {
  if (evt === 'warning' && (args[0] as { name?: string })?.name === 'ExperimentalWarning') {
    return false;
  }
  return _origEmit.apply(this, [evt, ...args] as Parameters<typeof _origEmit>);
};

// Runtime ESM Import Patcher for @github/copilot-sdk (#265)
// ---------------------------------------------------------
// Patch broken ESM import in @github/copilot-sdk@0.1.32 at runtime before
// Node's module loader attempts resolution.
//
// Root cause: copilot-sdk's session.js imports 'vscode-jsonrpc/node' without
// .js extension, violating Node 24+ strict ESM resolution requirements.
//
// Why runtime patch?: NPX caches packages in ~/.npm/_cacache and skips
// postinstall scripts on cache hits (documented npm behavior). The install-time
// patch in scripts/patch-esm-imports.mjs never runs on npx cache hits, causing
// ERR_MODULE_NOT_FOUND crashes on Node 24+.
//
// This runtime patch intercepts Module._resolveFilename before any imports
// trigger copilot-sdk loading, rewriting the broken import to include .js.
// Works everywhere: npx (cache hit/miss), global install, CI/CD.
//
// Upstream issue: https://github.com/github/copilot-sdk/issues/707
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Module = require('node:module');

const _origResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request: string, parent: unknown, isMain: boolean, options?: unknown) {
  // Intercept the broken import: 'vscode-jsonrpc/node' → 'vscode-jsonrpc/node.js'
  if (request === 'vscode-jsonrpc/node') {
    request = 'vscode-jsonrpc/node.js';
  }
  return _origResolveFilename.call(this, request, parent, isMain, options);
};

// Pre-flight: require Node.js ≥22.5.0 for node:sqlite (#214, #502).
// node:sqlite is used by the Copilot SDK for session storage.
// Fail fast with a clear message rather than letting users hit a cryptic
// ERR_UNKNOWN_BUILTIN_MODULE crash when the SDK loads.
{
  const parts = process.versions.node.split('.').map(Number);
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  if (major < 22 || (major === 22 && minor < 5)) {
    console.error(
      `✗ Squad requires Node.js ≥22.5.0 (you have v${process.versions.node}).\n` +
      `  node:sqlite (required by the Copilot SDK for session storage) was added in Node 22.5.0.\n` +
      `  Upgrade at: https://nodejs.org/en/download\n`,
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Top-level signal handlers — safety net for clean exit on Ctrl+C / SIGTERM.
// Individual commands (shell, watch, aspire, rc) register their own handlers
// that run first; these ensure the process never hangs if a command doesn't.
// ---------------------------------------------------------------------------
let _exitingOnSignal = false;
function _handleTopLevelSignal(signal: 'SIGINT' | 'SIGTERM'): void {
  const code = signal === 'SIGINT' ? 130 : 143;
  if (_exitingOnSignal) {
    // Second signal — force exit immediately
    process.exit(code);
  }
  _exitingOnSignal = true;
  // Allow in-flight cleanup handlers a brief window, then force exit
  setTimeout(() => process.exit(code), 3_000).unref();
}
process.on('SIGINT', () => _handleTopLevelSignal('SIGINT'));
process.on('SIGTERM', () => _handleTopLevelSignal('SIGTERM'));

import { FSStorageProvider, resolveSquadState } from '@bradygaster/squad-sdk';
import type { SquadStateContext, StateBackendType } from '@bradygaster/squad-sdk';
import path from 'node:path';
import { fatal, SquadError } from './cli/core/errors.js';
import { BOLD, RESET, DIM, RED, GREEN, YELLOW } from './cli/core/output.js';
import { runInit } from './cli/core/init.js';
import { runCost } from './cli/commands/cost.js';
import { getPackageVersion } from './cli/core/version.js';
import { printCommandHelp, printGenericCommandHelp } from './cli/core/command-help.js';

// Lazy-load squad-sdk to avoid triggering @github/copilot-sdk import on Node 24+
// (Issue: copilot-sdk has broken ESM imports - vscode-jsonrpc/node without .js extension)
const lazySquadSdk = () => import('@bradygaster/squad-sdk');
const lazyRunShell = () => import('./cli/shell/index.js');

// Use local version resolver instead of importing VERSION from squad-sdk
const VERSION = getPackageVersion();

/**
 * Return the starting directory for squad resolution.
 * Respects --team-root / SQUAD_TEAM_ROOT env var so that subprocesses
 * (e.g. Copilot CLI bang commands) can locate .squad/ even when their
 * working directory differs from the interactive shell. (#734)
 */
function getSquadStartDir(): string {
  return process.env['SQUAD_TEAM_ROOT'] || process.cwd();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  // --team-root flag: override team root for resolution
  const teamRootIdx = args.indexOf('--team-root');
  if (teamRootIdx !== -1 && args[teamRootIdx + 1]) {
    process.env['SQUAD_TEAM_ROOT'] = args[teamRootIdx + 1]!;
    // Remove --team-root and its value from args
    args.splice(teamRootIdx, 2);
  }
  
  const hasGlobal = args.includes('--global');
  // --economy activates economy mode for this session (sets env var for spawner)
  const hasEconomy = args.includes('--economy');
  if (hasEconomy) {
    process.env['SQUAD_ECONOMY_MODE'] = '1';
  }
  const rawCmd = args[0];
  const cmd = rawCmd?.trim() || '';

  // --version / -v / version
  // Investigated: routing is correct — cmd matches 'version' directly.
  // "Unknown command: version" reports may be shell-specific (e.g. alias/wrapper
  // prepending flags so args[0] is no longer 'version'). No intercepting router found.
  if (cmd === '--version' || cmd === '-v' || cmd === 'version') {
    console.log(VERSION);
    return;
  }

  // --help / -h / help
  if (cmd === '--help' || cmd === '-h' || cmd === 'help') {
    console.log(`\n${BOLD}squad${RESET} v${VERSION} — Add an AI agent team to any project\n`);
    console.log(`Usage: squad [command] [options]\n`);
    console.log(`Commands:`);
    console.log(`  ${BOLD}(default)${RESET}  Launch interactive shell (no args)`);
    console.log(`             Flags: --global (init in personal squad directory)`);
    console.log(`  ${BOLD}init${RESET}       Initialize Squad (markdown-only, default)`);
    console.log(`             Flags: --sdk (SDK builder syntax)`);
    console.log(`                    --roles (use base roles)`);
    console.log(`                    --global (personal squad dir)`);
    console.log(`                    --no-workflows (skip CI setup)`);
    console.log(`                    --no-vscode-default (skip .vscode/settings.json update)`);
    console.log(`                    --preset <name> (apply a preset after init)`);
    console.log(`                    --state-backend <type> (local|orphan|two-layer)`);
    console.log(`             Usage: init --mode remote <team-repo-path>`);
    console.log(`             Creates .squad/config.json pointing to an external team root`);
    console.log(`  ${BOLD}upgrade${RESET}    Update Squad-owned files to latest version`);
    console.log(`             Overwrites: squad.agent.md, templates dir (.squad/templates/)`);
    console.log(`             Never touches: .squad/ or .ai-team/ (your team state)`);
    console.log(`             Flags: --global (upgrade persona
```

### Core Architecture Module: `packages/squad-cli/src/cli/commands/aspire.ts`
```
/**
 * Aspire command — Launch Aspire dashboard for Squad observability
 * (Issue #265)
 *
 * Starts the Aspire dashboard and configures OTLP export so Squad
 * traces and metrics flow into the dashboard automatically.
 */

import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { BOLD, RESET, DIM, GREEN, RED, YELLOW } from '../core/output.js';

// ============================================================================
// Constants
// ============================================================================

/** Default OTLP endpoint the Aspire dashboard listens on (host-mapped gRPC port). */
const ASPIRE_OTLP_ENDPOINT = 'http://localhost:4317';

/** Default Aspire dashboard UI port. */
const ASPIRE_DASHBOARD_PORT = 18888;

/** Docker container name for the Aspire dashboard. */
const ASPIRE_CONTAINER_NAME = 'squad-aspire-dashboard';

/** Docker image for the Aspire dashboard. */
const ASPIRE_DOCKER_IMAGE = 'mcr.microsoft.com/dotnet/aspire-dashboard:latest';

// ============================================================================
// Detection helpers
// ============================================================================

function commandExists(cmd: string): boolean {
  try {
    execSync(`${cmd} --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function isDotnetAspireAvailable(): boolean {
  if (!commandExists('dotnet')) return false;
  try {
    const output = execSync('dotnet tool list -g', { encoding: 'utf8' });
    if (output.toLowerCase().includes('aspire')) return true;
  } catch {
    // Ignore
  }
  try {
    const workloads = execSync('dotnet workload list', { encoding: 'utf8' });
    if (workloads.toLowerCase().includes('aspire')) return true;
  } catch {
    // Ignore
  }
  return false;
}

function isDockerAvailable(): boolean {
  return commandExists('docker');
}

// ============================================================================
// Launch strategies
// ============================================================================

function launchWithDocker(): ChildProcess {
  console.log(`${DIM}Starting Aspire dashboard via Docker...${RESET}`);
  const child = spawn('docker', [
    'run', '--rm',
    '--name', ASPIRE_CONTAINER_NAME,
    '-p', `${ASPIRE_DASHBOARD_PORT}:18888`,
    '-p', '4317:18889',
    '-e', 'DASHBOARD__FRONTEND__AUTHMODE=Unsecured',
    '-e', 'DASHBOARD__OTLP__AUTHMODE=Unsecured',
    ASPIRE_DOCKER_IMAGE,
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });
  return child;
}

function launchWithDotnet(): ChildProcess {
  console.log(`${DIM}Starting Aspire dashboard via dotnet...${RESET}`);
  const child = spawn('dotnet', [
    'run', '--project', 'aspire',
    '--', '--dashboard-port', String(ASPIRE_DASHBOARD_PORT),
  ], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });
  return child;
}

// ============================================================================
// Public API
// ============================================================================

export interface AspireOptions {
  /** Use Docker even if dotnet is available */
  docker?: boolean;
  /** Custom OTLP endpoint port */
  port?: number;
}

/**
 * Run the `squad aspire` command.
 * Launches the Aspire dashboard and configures OTLP export.
 */
export async function runAspire(options: AspireOptions = {}): Promise<void> {
  const port = options.port ?? ASPIRE_DASHBOARD_PORT;
  const otlpEndpoint = ASPIRE_OTLP_ENDPOINT;

  console.log(`\n${BOLD}🔭 Squad Aspire — OpenTelemetry Dashboard${RESET}\n`);

  // Set OTLP environment so OTel providers pick it up (gRPC endpoint, not dashboard UI)
  process.env['OTEL_EXPORTER_OTLP_ENDPOINT'] = otlpEndpoint;
  console.log(`${DIM}OTLP endpoint: ${otlpEndpoint}${RESET}`);

  // Determine launch strategy
  const useDocker = options.docker || !isDotnetAspireAvailable();
  let child: ChildProcess | undefined;

  if (useDocker && isDockerAvailable()) {
    child = launchWithDocker();
  } else if (!useDocker && isDotnetAspireAvailable()) {
    child = launchWithDotnet();
  } else if (isDockerAvailable()) {
    child = launchWithDocker();
  } else {
    console.log(`${RED}✗${RESET} Neither Docker nor Aspire workload found.`);
    console.log(`\n  Install options:`);
    console.log(`    ${BOLD}Docker:${RESET}  https://docker.com/get-started`);
    console.log(`    ${BOLD}Aspire:${RESET}  dotnet workload install aspire\n`);
    return;
  }

  // Wire up output
  child.stdout?.on('data', (data: Buffer) => {
    const text = data.toString().trim();
    if (text) console.log(`${DIM}[aspire]${RESET} ${text}`);
  });

  child.stderr?.on('data', (data: Buffer) => {
    const text = data.toString().trim();
    if (text) console.log(`${YELLOW}[aspire]${RESET} ${text}`);
  });

  child.on('error', (err: Error) => {
    console.error(`${RED}✗${RESET} Failed to start Aspire: ${err.message}`);
  });

  // Give the dashboard a moment to start
  await new Promise<void>((resolve) => setTimeout(resolve, 2000));

  console.log(`\n${GREEN}✓${RESET} Aspire dashboard launching`);
  console.log(`  ${BOLD}Dashboard:${RESET}  http://localhost:${port}`);
  console.log(`  ${BOLD}OTLP gRPC:${RESET}  localhost:4317`);
  console.log(`\n${DIM}Squad OTel will automatically export to this endpoint.${RESET}`);
  console.log(`${DIM}Press Ctrl+C to stop.${RESET}\n`);

  // Keep alive until Ctrl+C
  return new Promise<void>((resolve) => {
    const shutdown = () => {
      console.log(`\n${DIM}🔭 Aspire dashboard stopping...${RESET}`);
      child?.kill();
      resolve();
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    child?.on('close', () => {
      console.log(`${DIM}Aspire process exited.${RESET}`);
      resolve();
    });
  });
}

```

### Core Architecture Module: `packages/squad-cli/src/cli/commands/cast.ts`
```
/**
 * squad cast — show current session cast (project + personal agents merged)
 *
 * Displays the merged session cast with project agents and personal agents,
 * highlighting which agents come from the personal squad.
 *
 * @module cli/commands/cast
 */

import * as path from 'node:path';
import { LocalAgentSource } from '@bradygaster/squad-sdk/config/agent-source';
import { resolvePersonalAgents, mergeSessionCast } from '@bradygaster/squad-sdk/agents/personal';
import { resolveSquadPaths, resolveExternalStateDir } from '@bradygaster/squad-sdk/resolution';
import { BOLD, RESET, DIM, GREEN, YELLOW } from '../core/output.js';
import { fatal } from '../core/errors.js';

/**
 * Run the cast command — show merged session cast.
 */
export async function runCast(cwd: string): Promise<void> {
  // Resolve squad paths
  const paths = resolveSquadPaths(cwd);
  if (!paths) {
    fatal('No squad found. Run "squad init" first.');
  }
  
  // Discover project agents.
  // LocalAgentSource appends .squad/agents to its base path, so we must supply:
  //   - local mode: parent of paths.projectDir (the repo root)
  //   - remote mode: paths.teamDir (the team repo root, which itself contains .squad/agents)
  const agentBase =
    paths.mode === 'remote'
      ? paths.teamDir
      : path.resolve(paths.projectDir, '..');
  // #1399: when state is externalized, agents live at <externalStateDir>/agents
  // (no .squad nesting), so the base-path probing above can't reach them —
  // externalize sets teamRoot '.' which lands here as remote mode with a
  // repo-local teamDir. Hand LocalAgentSource the explicit directory instead.
  // (resolveExternalStateDir comes from the /resolution subpath on purpose:
  // importing the sdk root barrel here adds seconds to this module's load.)
  const externalAgentsDir =
    paths.config?.stateLocation === 'external' && paths.config.projectKey
      ? path.join(resolveExternalStateDir(paths.config.projectKey, false), 'agents')
      : undefined;
  const projectSource = new LocalAgentSource(agentBase, undefined, undefined, externalAgentsDir);
  const projectAgents = await projectSource.listAgents();
  
  // Discover personal agents
  const personalAgents = await resolvePersonalAgents();
  
  // Merge session cast
  const cast = mergeSessionCast(projectAgents, personalAgents);
  
  if (cast.length === 0) {
    console.log('\nNo agents found in current session cast.\n');
    return;
  }
  
  // Count project vs personal
  const projectCount = projectAgents.length;
  const personalCount = personalAgents.filter(
    pa => !projectAgents.some(pra => pra.name.toLowerCase() === pa.name.toLowerCase())
  ).length;
  
  console.log(`\n${BOLD}Session Cast${RESET} (${cast.length} agents):\n`);
  
  if (projectCount > 0) {
    console.log(`  Project agents:  ${projectCount}`);
  }
  if (personalCount > 0) {
    console.log(`  Personal agents: ${personalCount} ${YELLOW}(ambient)${RESET}`);
  }
  console.log();
  
  // Calculate column widths
  const maxNameLen = Math.max(...cast.map(a => a.name.length), 4);
  const maxRoleLen = Math.max(...cast.map(a => a.role.length), 4);
  
  // Header
  console.log(
    `  ${'Name'.padEnd(maxNameLen)}  ` +
    `${'Role'.padEnd(maxRoleLen)}  ` +
    `Origin        Ghost Protocol`
  );
  console.log(
    `  ${'─'.repeat(maxNameLen)}  ` +
    `${'─'.repeat(maxRoleLen)}  ` +
    `${'─'.repeat(13)} ${'─'.repeat(14)}`
  );
  
  // Rows
  for (const agent of cast) {
    const isPersonal = 'personal' in agent;
    const nameDisplay = isPersonal
      ? `👤 ${agent.name}`.padEnd(maxNameLen + 3) // +3 for emoji width
      : agent.name.padEnd(maxNameLen);
    
    const origin = isPersonal ? `${YELLOW}personal${RESET}` : 'project';
    const originPadded = isPersonal ? origin + ' '.repeat(6) : origin.padEnd(13);
    
    const ghostProtocol = isPersonal && agent.personal.ghostProtocol
      ? `${GREEN}✓ enforced${RESET}`
      : '–';
    
    console.log(
      `  ${nameDisplay}  ` +
      `${agent.role.padEnd(maxRoleLen)}  ` +
      `${originPadded} ${ghostProtocol}`
    );
  }
  
  console.log();
  
  // Legend
  if (personalCount > 0) {
    console.log(`${DIM}👤 = Personal agent (ambient, Ghost Protocol enforced in projects)${RESET}`);
    console.log();
  }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2049** (2026-09-23): **Fix terminal lifecycle for granular plan activation**
  *Symptoms*: ## Bug  `/squad plan activate` can create all planned issues successfully and still end red because the terminal lifecycle safe-output validator accepts `/squad activate` and `/squad plan accept`, but not the granular command `/squad plan activate`. The terminal repair path has the same command omission and only recognizes the fast-path `plan-accepted` artifact, not granular `impl-accepted`.  ## Evidence  - Reference failure: https://github.com/octodemo/eshop-bradyg-dev/actions/runs/34987615314 - Durable activation output: https://github.com/octodemo/eshop-bradyg-dev/issues/4#issuecomment-5682975648 - Failing job message: `Lifecycle body must include an H2 lifecycle heading plus state, last-command, and a nonterminal next-action value consisting of a backticked /squad command.`  ## Acceptance criteria  - Terminal lifecycle upsert accepts `/squad plan activate`. - Idempotent terminal repair recognizes `/squad plan activate` after a trusted `impl-accepted` artifact. - Existing fast-path commands remain supported. - Targeted lifecycle tests and all seven strict gh-aw compilations pass. 
  **Post-Mortem & Fix Analysis**:
  > ### 📋 Assigned to agentic-workflows-dev (Agentic Workflows Engineer)  **Issue:** #2049 — Fix terminal lifecycle for granular plan activation  agentic-workflows-dev will pick this up in the next Copilot session.  > **For Copilot coding agent:** If enabled, this issue will be worked automatically. > Otherwise, start a Copilot session and say: > `agentic-workflows-dev, work on issue #2049`
  > Closing as resolved — this was fixed by PR #2050, and current lifecycle validation accepts `/squad plan activate` (`workflows/shared/squad.md:338`, `scripts/check-workflow-input-interpolation.mjs:78-80`).

- **Issue #1971** (2026-09-11): **TEMPLATE_MANIFEST references Rai-charter.md but file is rai-charter.md (masked by macOS case-insensitivity)**
  *Symptoms*: ## Summary  `TEMPLATE_MANIFEST` declares `source: 'Rai-charter.md'` (`packages/squad-cli/src/cli/core/templates.ts:139-140`), but the file on disk is **`rai-charter.md`** (lowercase) in all four template locations. It is the **only** one of 59 manifest sources that does not resolve case-sensitively.  Found while fixing the README casing in #1949; deliberately left out of that docs PR because the fix spans runtime code, tests, and a prompt template.  ## Why this hasn't been caught  `existsSync` gives a **false pass on macOS**, because the filesystem is case-insensitive. A check that reads directory entries and compares exact basenames tells the truth:  ``` total 59  case-sensitively missing 1   MISSING: Rai-charter.md ```  On disk, all four locations agree:  ``` .squad-templates                 charter.md fact-checker-charter.md rai-charter.md scribe-charter.md templates                        charter.md fact-checker-charter.md personal-charter.md rai-charter.md scribe-charter.md packages/squad-cli/templates     charter.md fact-checker-charter.md rai-charter.md scribe-charter.md packages/squad-sdk/templates     charter.md fact-checker-charter.md rai-charter.md scribe-charter.md ```  This is exactly the failure mode the codebase already warns about in its own comment at `packages/squad-sdk/src/config/init.ts:1141-1151` — mixed-case lookups missing on case-sensitive filesystems (Linux CI), referencing the regression #1299 was fixing.  ## Blast radius  The wrong casing is load-be
  **Post-Mortem & Fix Analysis**:
  > Closing as completed following backlog cleanup: the associated fix, validation, or tracking work has been completed.

- **Issue #1878** (2026-08-25): **gh-aw install-order test still asserts worker-first after dispatcher-first rollout**
  *Symptoms*: ## Problem  PR #1874 deliberately changed every live `gh aw add` surface to install the dispatcher first because current gh-aw dependency discovery compiles the dispatcher before confirming the explicit worker/reviewer surface. The guide now correctly says:  > Keep the dispatcher first.  But `test/gh-aw-implement-workflow.test.ts` still asserts the old worker-first contract:  ```ts expect(dispatcherIndex).toBeGreaterThan(workerIndex); expect(guide).toContain('The single command installs the dedicated worker first'); ```  On current `dev` (`08b89daa` when measured), the guide indices are `dispatcher=875`, `worker=920`, so the full suite fails with `expected 875 to be greater than 920`.  This is not a #1605 regression: PR #1877 independently reproduces the same failure against `origin/dev`. It currently blocks that otherwise-repaired PR.  ## Acceptance criteria  - [ ] Update the install-order test to enforce the current dispatcher-first contract. - [ ] Assert the current explanatory prose (`gh aw add` discovers worker/reviewer dependencies while compiling the dispatcher), not the removed worker-first sentence. - [ ] Verify all three install surfaces remain in coherent order: dispatcher, implementation worker, reviewer. - [ ] Mutation-check reversing dispatcher/worker or worker/reviewer order makes the test fail. - [ ] Run the focused workflow test and full relevant CI.  ## Scope  Test correction only unless current `dev` reveals another stale worker-first assertion. Do not chan

- **Issue #1860** (2026-08-24): **gh-aw: `plan activate` summary reports `squad:{agent}` labels it did not apply, and omits the required `Non-roster agent values` disclosure**
  *Symptoms*: ## Summary  The `/squad plan activate` summary's **Hierarchy** section reports `squad:{agent}` labels on two epic issues that were never applied, and omits the `Non-roster agent values` disclosure that `workflows/squad.md:1325` requires in exactly this situation.  The *behaviour* was correct — the labels were rightly withheld. Only the **reporting** is wrong. But a summary that claims labels it did not apply is a false provenance claim, which is the specific failure mode #1812 exists to prevent.  ## Evidence  Fixture: `octodemo/aspiregregator-squad-e2e`, seed issue #5, activation run `32778953402` (all six jobs `success`).  **What the summary claimed:**  ``` - [Epic] Worker loop hardening (Epic 1.1) — squad:kint - [Epic] Fetch retry, timeout, and failure persistence (Epic 1.2) — squad:kint / squad:mcmanus ```  **What was actually applied:**  ``` #6 created=2026-08-24T21:28:57Z labels=[squad] [Epic] Worker loop hardening #7 created=2026-08-24T21:28:59Z labels=[squad] [Epic] Fetch retry, timeout, and failure ```  Neither epic carries any `squad:{agent}` label. For contrast, the very next two issues created seconds later did get theirs, so this is not a transient failure or a label-does-not-exist-yet race:  ``` #8 created=2026-08-24T21:29:01Z labels=[squad,squad:hockney] #9 created=2026-08-24T21:29:03Z labels=[squad,squad:kint] ```  ## Root cause  The withholding is correct and intentional. Both epics have **multi-valued** owners in the program plan:  - Epic 1.1 — suggested owne

- **Issue #1859** (2026-08-24): **gh-aw: `plan activate` binds a task's `squad:{agent}` label from its epic owner, not the task's `Agent` cell**
  *Symptoms*: ## Summary  During the E4 end-to-end run on the live fixture, `/squad plan activate` minted a task's `squad:{agent}` label from its **epic's owner** rather than from the task's own `Agent` cell in the accepted implementation plan. 11 of 12 tasks bound correctly; task 6 drifted.  This is an agent-binding correctness bug in the same family as #1784 / #1801 — but it survives all existing guards, because TG-2 certification and validation Check 10 both pass: the label applied *is* a certified roster name, just the **wrong** one.  ## Evidence  Fixture: `octodemo/aspiregregator-squad-e2e`, seed issue #5, activation run `32778953402` (all six jobs `success`).  **Accepted implementation plan** (comment `5400751833`, the artifact locked by `/squad plan accept implementation`):  ``` | 6 | Reconcile `MostRecentItems` by `Link` on refresh | M | — | McManus | 2.1 | ```  **Issue actually created** for that task:  ``` #17 [squad,squad:kint] Reconcile MostRecentItems by Link on refresh **Context:** Epic 2.1, D4 · Size M · Depends on: — ```  Epic 2.1's suggested owner in the program plan is **Kint**. The task's `Agent` is **McManus**. The minted label followed the epic, not the task.  All other 11 tasks matched their `Agent` cell exactly:  | Task | Plan `Agent` | Issue | Label | Match | |---|---|---|---|---| | 1 | Kint | #12 | `squad:kint` | ✅ | | 2 | Kint | #13 | `squad:kint` | ✅ | | 3 | Kint | #14 | `squad:kint` | ✅ | | 4 | Kint | #15 | `squad:kint` | ✅ | | 5 | McManus | #16 | `squad:mcmanus

- **Issue #1842** (2026-08-24): **workflows/squad.md is ~37 bytes from the prompt-budget floor — the next change to it fails CI on byte count alone**
  *Symptoms*: ## Measured  `test/gh-aw-quality.test.ts` → `gh-aw: prompt budget & planning import regression` → `reports combined bytes and headroom` asserts at least 5 KB of headroom under a 100 KB prompt ceiling:  ```js ).toBeGreaterThan(5 * 1024); ```  On `dev` at `4b32f7be`, that gate passes with roughly **5157 bytes** of headroom — about **37 bytes** above the 5120-byte floor.  ## Why this is a blocker, not a nit  Discovered while fixing #1835, which needed a ~18-byte change to one `awk` one-liner in `workflows/squad.md`. Measured cost of each attempt:  | Change | Headroom | Gate | |---|---:|---| | Baseline (`dev`) | ~5157 | ✅ | | Fix + 5-line explanatory paragraph | 4823 | ❌ | | Fix + 2-line note | 5040 | ❌ | | Fix + 1-line note, compacted `awk` | 5092 | ❌ | | Fix + 4-word note, compacted `awk` | ~5155 | ✅ |  To land an 18-byte behavioral fix I had to:  1. strip inter-statement spaces from the `awk` program, hurting readability of the exact line most likely to be reread during an incident, and 2. delete the prose explaining *why* the line is shaped that way.  That is the budget dictating code style and deleting rationale. Both are load-bearing in a file that **is** the prompt.  ## The compounding part  `workflows/squad.md` is the `/squad` coordinator prompt. Nearly every open gh-aw item edits it — #1801 (plan validation), #1780 (ontology drift next-hints), #1730 (issue-scoped concurrency + actor authorization), #1757 (adversarial plan validate), #1608 (richer `squad.agent.md`). Each 
  **Post-Mortem & Fix Analysis**:
  > ## Two corrections + one resolved unknown  ### 1. Acceptance criterion 3 is answered: the 100 KB ceiling is real, not inherited  This issue asks that the ceiling be "justified against the actual model/runner limit rather than inherited." It is a genuine gh-aw limit. `CHANGELOG.md:28` records the original compression work:  > prompt-size compression (135KB -> under the 100KB gh-aw limit)  So raising the ceiling is **not** on the table. Only three levers remain: trim the prompt, lower the 5 KB guard, or move content out of the assembled set.  ### 2. The byte numbers in the description are wrong  Measured against current `origin/dev`:  | ref | total | headroom | spare over the 5120 floor | |---|---:|---:|---:| | `origin/dev` | 97,207 | 5,193 | **73** | | #1841 head | 97,254 | 5,146 | **26** |  The description says ~37 and ~65. Actual is 73 and 26 — so #1841 is **tighter** than recorded, not looser.  ### 3. Measurement gotcha that will mislead the next person  Do not measure the working tr

- **Issue #1835** (2026-08-23): **PC-0 turns a leading-newline dispatch value into a silent EMPTY_DISPATCH halt**
  *Symptoms*: Follow-up nit from FIDO's pass-3 review of #1832 (merged). Filed rather than fixed in-PR because the review verdict was APPROVE/merge-as-is and the path is not reachable from either real producer.  ## Measured  `workflows/squad.md`, Step PC-0, normalizes the dispatched command with an `awk` program gated on `NR==1`:  ```bash printf '%s\n' "$SQUAD_DISPATCH_COMMAND" | awk 'NR==1{sub(/\r$/,""); sub(/^[[:space:]]+/,""); sub(/[[:space:]]+$/,""); if($0==""){print "EMPTY_DISPATCH"; exit} if($0 ~ /^\/squad([[:space:]]|$)/) print; else print "/squad " $0}' ```  Because the program only ever inspects record 1, a value whose first character is a newline puts an **empty string** on that record:  ``` PC0($'\nimplement')  →  EMPTY_DISPATCH ```  `EMPTY_DISPATCH` routes to the activation guard, which halts with a `::warning::` and **no comment** — by design, so that empty activation probes stay side-effect free (PR #1777, junk issues #12/#14). So a structurally valid `implement` dispatch would halt silently rather than run.  Silent-halt-on-valid-input is the same defect class #1824 and #1832 exist to close.  ## Why this is a nit and not a defect  FIDO enumerated the producers that can reach PC-0:  1. `workflows/squad-implement-worker.md:259` — relays a **literal** single-token value (`"command": "implement"`). 2. The `workflow_dispatch` UI input — single-line by schema.  Neither can emit a leading newline. Reaching this requires a crafted `actions: write` API payload, and an actor holding `a

- **Issue #1833** (2026-08-24): **gh-aw quality suite silently skips 13 tests (28 assertions) on Windows via `existsSync('/bin/sh')` probe**
  *Symptoms*: ## Summary  `test/gh-aw-quality.test.ts:30` gates two `describe` blocks on a POSIX shell that never exists on Windows:  ```ts const HAS_POSIX_SHELL = existsSync('/bin/sh'); ```  ```ts // :1515 describe.skipIf(!HAS_POSIX_SHELL)('gh-aw: Team Guard roster-row detection — committed-HEAD git repo coverage (#1689 revision 3)', …) // :1687 describe.skipIf(!HAS_POSIX_SHELL)('gh-aw: Cast PR dedup jq filter behavioral coverage (#1689 revision)', …) ```  On Windows, `/bin/sh` does not exist, so both blocks skip. **Measured: 13 tests containing 28 `expect()` calls never execute** — and the suite reports green.  This is the same defect class as #1824 / #1812 / #1801 / #1822 / #1827: **a gate that structurally cannot observe the failure it exists to catch.** Per the standing decision in `.squad/decisions.md` (2026-08-20): *a permanently green — or permanently red — gate is equivalent to no gate.*  ## Why this one stings  The skipped blocks are **#1689's own behavioral coverage** — assertions written specifically to prove gh-aw Team Guard and Cast PR dedup behavior. A Windows contributor sees a green suite and reasonably concludes that behavior is verified. It isn't.  Git Bash ships a POSIX shell on essentially every Windows dev machine that has Git installed, so the skip isn't even buying portability — it's discarding coverage that could have run.  ## Prior art in this repo — the fix shape already exists  `test/gh-aw-command-parse.test.ts` (added in #1832 for #1824) hit the identical probl

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

### Incident Patch 1: `93aec83a` (2026-09-29)
**Commit Message**: fix(gh-aw): correct exact enlistment compiler warning gate (#2118)

* fix(gh-aw): correct exact enlistment warning gate

Closes #2117

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

* docs(gh-aw): retain bot-trigger explanation

Closes #2117

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

---------

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

**File**: `.changeset/gh-aw-native-review-warning.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"@bradygaster/squad-cli": patch
+"@bradygaster/squad-sdk": patch
+---
+
+Correct the enlistment skill's strict compile gate for gh-aw v0.89.21 to accept only the exact native review advisory and bot-trigger warning. Preserve all reviewer controls, human approval, and hard stops for errors or any unexpected warning.
```

**File**: `.squad-templates/skills/gh-aw-enlistment/SKILL.md` (modified, +27/-5)
```diff
@@ -222,11 +222,33 @@ This must run after any first-install approval and before committing. Success
 criteria:
 
 - All eight workflows compile successfully.
-- The **only** permitted warning is the known `squad.md` bot-trigger warning: it
-  configures both slash-command and `github-actions[bot]` triggers, and the bot
-  trigger is required for controlled worker-continuation dispatches.
-- **STOP** on any error, or on **any additional warning** beyond that single
-  documented one.
+- With gh-aw v0.89.21, require exactly two warnings, one occurrence of each
+  exact diagnostic header below (including its workflow path):
+
+<!-- compile-warning-allowlist-start -->
+```text
+.github/workflows/squad-review.md: warning: pull_request_target is a very dangerous trigger.
+.github/workflows/squad.md: warning: Both slash_command and bots triggers are configured. If a bot listed in bots: posts a comment that starts with the slash command text (e.g., /command-name), it will trigger the workflow and occupy the concurrency slot, potentially blocking simultaneous manual invocations. To ensure the workflow only runs on explicit user commands, remove the 'bots:' field.
+```
+<!-- compile-warning-allowlist-end -->
+
+The native review advisory includes the compiler's standard explanation and
+Security Lab link. The following guard-policy dry-run lines are informational,
+not another warning. The bot-trigger warning is expected because
+`github-actions[bot]` enables controlled worker-continuation dispatches.
+
+Accept the native review advisory **only while all existing controls remain**:
+same-repository head restriction, base-controlled workflow source,
+`checkout: false` agent path, API-only inspection, exact run/head/attempt guard,
+least-privilege jobs, advisory verdict, and independent human approval.
+`pull_request_target` is not generally safe; this narrow exception neither
+weakens those controls nor authorizes PR-head execution.
+
+**STOP** on any error, or on **any additional warning** beyond these two exact
+documented diagnostics. Also STOP if either warning is missing, duplicated,
+changed, or attributed to another path, if the summary is not
+`Compiled 8 workflows: 8 succeeded, 2 warnings`, or if any required control is
+absent. Do not suppress warnings or use `--approve` to bypass this gate.
 
 ### 6. Require the verifier to prove the complete consumer contract
 
```

**File**: `docs/src/content/docs/guide/gh-aw.md` (modified, +28/-4)
```diff
@@ -341,10 +341,34 @@ gh aw compile --strict
 ```
 
 Run this exact command after any required first-install approval and before
-committing. It must report all eight workflows succeeded. `squad.md` currently
-emits one known warning because both slash-command and `github-actions[bot]`
-triggers are configured; the bot trigger is required for controlled worker
-continuation dispatches. Any error or any additional warning is a stop condition.
+committing. With gh-aw v0.89.21, require exactly two warnings, one occurrence
+of each exact diagnostic header below (including its workflow path):
+
+<!-- compile-warning-allowlist-start -->
+```text
+.github/workflows/squad-review.md: warning: pull_request_target is a very dangerous trigger.
+.github/workflows/squad.md: warning: Both slash_command and bots triggers are configured. If a bot listed in bots: posts a comment that starts with the slash command text (e.g., /command-name), it will trigger the workflow and occupy the concurrency slot, potentially blocking simultaneous manual invocations. To ensure the workflow only runs on explicit user commands, remove the 'bots:' field.
+```
+<!-- compile-warning-allowlist-end -->
+
+The native review advisory includes the compiler's standard explanation and
+Security Lab link. The following guard-policy dry-run lines are informational,
+not another warning. The bot-trigger warning is expected because `squad.md`
+configures both slash-command and `github-actions[bot]` triggers for controlled
+worker-continuation dispatches.
+
+Accept the native review advisory **only while all existing controls remain**:
+same-repository head restriction, base-controlled workflow source,
+`checkout: false` agent path, API-only inspection, exact run/head/attempt guard,
+least-privilege jobs, advisory verdict, and independent human approval.
+`pull_request_target` is not generally safe; this narrow exception neither
+weakens those controls nor authorizes PR-head execution.
+
+**STOP** on any error, or on **any additional warning** beyond these two exact
+documented diagnostics. Also STOP if either warning is missing, duplicated,
+changed, or attributed to another path, if the summary is not
+`Compiled 8 workflows: 8 succeeded, 2 warnings`, or if any required control is
+absent. Do not suppress warnings or use `--approve` to bypass this gate.
 
 Verify the complete source/lock surface:
 
```

**File**: `packages/squad-cli/templates/skills/gh-aw-enlistment/SKILL.md` (modified, +27/-5)
```diff
@@ -222,11 +222,33 @@ This must run after any first-install approval and before committing. Success
 criteria:
 
 - All eight workflows compile successfully.
-- The **only** permitted warning is the known `squad.md` bot-trigger warning: it
-  configures both slash-command and `github-actions[bot]` triggers, and the bot
-  trigger is required for controlled worker-continuation dispatches.
-- **STOP** on any error, or on **any additional warning** beyond that single
-  documented one.
+- With gh-aw v0.89.21, require exactly two warnings, one occurrence of each
+  exact diagnostic header below (including its workflow path):
+
+<!-- compile-warning-allowlist-start -->
+```text
+.github/workflows/squad-review.md: warning: pull_request_target is a very dangerous trigger.
+.github/workflows/squad.md: warning: Both slash_command and bots triggers are configured. If a bot listed in bots: posts a comment that starts with the slash command text (e.g., /command-name), it will trigger the workflow and occupy the concurrency slot, potentially blocking simultaneous manual invocations. To ensure the workflow only runs on explicit user commands, remove the 'bots:' field.
+```
+<!-- compile-warning-allowlist-end -->
+
+The native review advisory includes the compiler's standard explanation and
+Security Lab link. The following guard-policy dry-run lines are informational,
+not another warning. The bot-trigger warning is expected because
+`github-actions[bot]` enables controlled worker-continuation dispatches.
+
+Accept the native review advisory **only while all existing controls remain**:
+same-repository head restriction, base-controlled workflow source,
+`checkout: false` agent path, API-only inspection, exact run/head/attempt guard,
+least-privilege jobs, advisory verdict, and independent human approval.
+`pull_request_target` is not generally safe; this narrow exception neither
+weakens those controls nor authorizes PR-head execution.
+
+**STOP** on any error, or on **any additional warning** beyond these two exact
+documented diagnostics. Also STOP if either warning is missing, duplicated,
+changed, or attributed to another path, if the summary is not
+`Compiled 8 workflows: 8 succeeded, 2 warnings`, or if any required control is
+absent. Do not suppress warnings or use `--approve` to bypass this gate.
 
 ### 6. Require the verifier to prove the complete consumer contract
 
```

**File**: `packages/squad-sdk/templates/skills/gh-aw-enlistment/SKILL.md` (modified, +27/-5)
```diff
@@ -222,11 +222,33 @@ This must run after any first-install approval and before committing. Success
 criteria:
 
 - All eight workflows compile successfully.
-- The **only** permitted warning is the known `squad.md` bot-trigger warning: it
-  configures both slash-command and `github-actions[bot]` triggers, and the bot
-  trigger is required for controlled worker-continuation dispatches.
-- **STOP** on any error, or on **any additional warning** beyond that single
-  documented one.
+- With gh-aw v0.89.21, require exactly two warnings, one occurrence of each
+  exact diagnostic header below (including its workflow path):
+
+<!-- compile-warning-allowlist-start -->
+```text
+.github/workflows/squad-review.md: warning: pull_request_target is a very dangerous trigger.
+.github/workflows/squad.md: warning: Both slash_command and bots triggers are configured. If a bot listed in bots: posts a comment that starts with the slash command text (e.g., /command-name), it will trigger the workflow and occupy the concurrency slot, potentially blocking simultaneous manual invocations. To ensure the workflow only runs on explicit user commands, remove the 'bots:' field.
+```
+<!-- compile-warning-allowlist-end -->
+
+The native review advisory includes the compiler's standard explanation and
+Security Lab link. The following guard-policy dry-run lines are informational,
+not another warning. The bot-trigger warning is expected because
+`github-actions[bot]` enables controlled worker-continuation dispatches.
+
+Accept the native review advisory **only while all existing controls remain**:
+same-repository head restriction, base-controlled workflow source,
+`checkout: false` agent path, API-only inspection, exact run/head/attempt guard,
+least-privilege jobs, advisory verdict, and independent human approval.
+`pull_request_target` is not generally safe; this narrow exception neither
+weakens those controls nor authorizes PR-head execution.
+
+**STOP** on any error, or on **any additional warning** beyond these two exact
+documented diagnostics. Also STOP if either warning is missing, duplicated,
+changed, or attributed to another path, if the summary is not
+`Compiled 8 workflows: 8 succeeded, 2 warnings`, or if any required control is
+absent. Do not suppress warnings or use `--approve` to bypass this gate.
 
 ### 6. Require the verifier to prove the complete consumer contract
 
```

---

### Incident Patch 2: `f67bee5a` (2026-09-29)
**Commit Message**: fix(gh-aw): preserve ownership staging with bounded index verification (#2116)

* fix(gh-aw): verify ownership metadata in staged installs

Handoff for independent revision: staged-tree enumeration still requires the reviewer-requested large-consumer correction before PR creation.

Closes #2113

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

* fix(gh-aw): bound staged install queries to required paths

Independently revise the rejected ownership staging handoff. Avoid recursive consumer-tree enumeration and preserve exact staged type and digest checks. Cover 20,000 unrelated tracked files, unchanged staging, bounded blob reads, index locks, and substituted directories.

Closes #2113

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

* docs(changeset): record verified gh-aw ownership staging

Add the coordinator-authorized patch changeset for both template-shipping packages to satisfy the hosted changelog gate.

Closes #2113

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

---------

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

**File**: `.changeset/verified-gh-aw-ownership-staging.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"@bradygaster/squad-cli": patch
+"@bradygaster/squad-sdk": patch
+---
+
+Preserve manifest-allowlisted gh-aw ownership metadata through broad consumer ignore rules by force-staging only the exact required ownership file. Verify every required artifact's staged type and bytes before commit or push, using bounded index queries that exclude unrelated consumer files.
```

**File**: `.squad-templates/skills/gh-aw-enlistment/SKILL.md` (modified, +19/-5)
```diff
@@ -11,7 +11,7 @@ tools:
     when: "Every step: preflight identity/auth, requiring Issues, enabling Actions-created PRs, opening and watching the bootstrap PR."
   - name: "gh aw"
     description: "GitHub Agentic Workflows extension (github/gh-aw) — installs and strictly compiles the Squad workflow set."
-    when: "Installing the immutable native Squad package and compiling its seven workflows into deterministic .lock.yml files."
+    when: "Installing the immutable native Squad package and compiling its eight workflows into deterministic .lock.yml files."
 ---
 
 ## Context
@@ -146,7 +146,7 @@ gh aw add "bradygaster/squad/workflows@${SQUAD_SHA}"
 
 The nested `workflows/aw.yml` is the only supported distribution registration.
 It isolates package auto-discovery from unrelated repository skills and agents,
-and installs exactly seven workflows, fifteen runtime resources, and one
+and installs exactly eight workflows, seventeen runtime resources, and one
 `gh-aw-enlistment` skill at the same resolved revision:
 
 - `squad.md` + `squad.lock.yml`
@@ -156,11 +156,12 @@ and installs exactly seven workflows, fifteen runtime resources, and one
 - `squad-retro.md` + `squad-retro.lock.yml`
 - `squad-improvement-worker.md` + `squad-improvement-worker.lock.yml`
 - `squad-bootstrap.md` + `squad-bootstrap.lock.yml`
+- `squad-command-router.md` + `squad-command-router.lock.yml`
 
 `squad-improvement-worker` is part of the standard, coherent install above —
 not a separate opt-in add-on. It stays dormant until a maintainer approves a
 governance-scoped retrospective proposal (see the gh-aw guide's retrospective
-auto-implementation section); installing it alongside the other six keeps the
+auto-implementation section); installing it alongside the other seven keeps the
 full stack consistent and avoids a second bootstrap pass later.
 
 Report/proposal-only is the default. Ordinary fixes require the explicit
@@ -220,7 +221,7 @@ node .github/workflows/shared/squad-install-verifier.mjs \
 This must run after any first-install approval and before committing. Success
 criteria:
 
-- All seven workflows compile successfully.
+- All eight workflows compile successfully.
 - The **only** permitted warning is the known `squad.md` bot-trigger warning: it
   configures both slash-command and `github-actions[bot]` triggers, and the bot
   trigger is required for controlled worker-continuation dispatches.
@@ -230,7 +231,7 @@ criteria:
 ### 6. Require the verifier to prove the complete consumer contract
 
 - **STOP** if the verifier reports a missing source/lock pair, missing package
-  ownership record, stale source/resource digest, incomplete seven-workflow
+  ownership record, stale source/resource digest, incomplete eight-workflow
   registration, or mixed revision.
 - Use only the recovery commands printed by the verifier. They reinstall the
   complete package at one immutable revision; never repair one workflow or
@@ -258,6 +259,8 @@ Stage **only** the documented generated surfaces, then verify the staged set:
 
 ```bash
 git add -- .gitattributes .github/aw/ .github/workflows/ .github/skills/
+node .github/workflows/shared/squad-install-verifier.mjs \
+  --verify-staged-install --stage-ownership --source-revision "${SQUAD_SHA}" || exit 1
 git diff --cached --stat
 # No deletions should be staged:
 test -z "$(git diff --cached --diff-filter=D --name-only)" || { echo "STOP: staged deletions"; exit 1; }
@@ -267,6 +270,15 @@ test -z "$(git diff --cached --diff-filter=D --name-only)" || { echo "STOP: stag
   edits to **unrelated files**, or committed **log/diagnostic output**. Re-scope with
   explicit `git add -- <path>` — never `git add .`, `git add -A`, or `git commit -a`.
 
+Consumer rules such as `packages/` can silently ignore the required ownership
+JSON under `.github/aw/packages/`. The staged verifier force-adds only the exact
+native package ownership JSON when it is ignored and untracked. It then verifies
+every manifest-required source, lo
```

**File**: `docs/src/content/docs/guide/gh-aw.md` (modified, +14/-0)
```diff
@@ -84,6 +84,8 @@ node .github/workflows/shared/squad-install-verifier.mjs \
 
 # 7. Commit the generated files and open the bootstrap PR
 git add -- .gitattributes .github/aw/ .github/workflows/ .github/skills/
+node .github/workflows/shared/squad-install-verifier.mjs \
+  --verify-staged-install --stage-ownership --source-revision "${SQUAD_SHA}" || exit 1
 git diff --cached --stat
 test -z "$(git diff --cached --diff-filter=D --name-only)"
 git commit -m "ci: add Squad agentic workflow"
@@ -364,6 +366,8 @@ done
 
 ```bash
 git add -- .gitattributes .github/aw/ .github/workflows/ .github/skills/
+node .github/workflows/shared/squad-install-verifier.mjs \
+  --verify-staged-install --stage-ownership --source-revision "${SQUAD_SHA}" || exit 1
 git diff --cached --stat
 test -z "$(git diff --cached --diff-filter=D --name-only)"
 git commit -m "ci: add Squad agentic workflow"
@@ -381,6 +385,16 @@ state under `.github/aw/`, the installed skills, and `.gitattributes`. Review
 the complete generated diff in the bootstrap PR, address Copilot review
 feedback, and wait for required checks. Merge only after human approval.
 
+Consumer ignore rules such as `packages/` can silently omit the required
+`.github/aw/packages/` ownership JSON from directory staging. The staged verifier
+force-adds only the exact native package ownership JSON when ignored and
+untracked, never unrelated ignored files. It checks every manifest-required
+source, lock, runtime, skill, manifest and ownership file in the Git index
+against the verified working-tree bytes. Missing metadata, failed staging,
+omitted required files or staged digest mismatches stop the install before
+commit/push. Never force-add a directory or glob; rerun the gate after edits or
+restaging, including package upgrades.
+
 `gh aw add` may also create `.vscode/settings.json` to enable Copilot for
 Markdown workflow files. The command above intentionally leaves that optional
 editor setting untracked. Delete it if you do not want the local setting, or
```

**File**: `packages/squad-cli/templates/skills/gh-aw-enlistment/SKILL.md` (modified, +19/-5)
```diff
@@ -11,7 +11,7 @@ tools:
     when: "Every step: preflight identity/auth, requiring Issues, enabling Actions-created PRs, opening and watching the bootstrap PR."
   - name: "gh aw"
     description: "GitHub Agentic Workflows extension (github/gh-aw) — installs and strictly compiles the Squad workflow set."
-    when: "Installing the immutable native Squad package and compiling its seven workflows into deterministic .lock.yml files."
+    when: "Installing the immutable native Squad package and compiling its eight workflows into deterministic .lock.yml files."
 ---
 
 ## Context
@@ -146,7 +146,7 @@ gh aw add "bradygaster/squad/workflows@${SQUAD_SHA}"
 
 The nested `workflows/aw.yml` is the only supported distribution registration.
 It isolates package auto-discovery from unrelated repository skills and agents,
-and installs exactly seven workflows, fifteen runtime resources, and one
+and installs exactly eight workflows, seventeen runtime resources, and one
 `gh-aw-enlistment` skill at the same resolved revision:
 
 - `squad.md` + `squad.lock.yml`
@@ -156,11 +156,12 @@ and installs exactly seven workflows, fifteen runtime resources, and one
 - `squad-retro.md` + `squad-retro.lock.yml`
 - `squad-improvement-worker.md` + `squad-improvement-worker.lock.yml`
 - `squad-bootstrap.md` + `squad-bootstrap.lock.yml`
+- `squad-command-router.md` + `squad-command-router.lock.yml`
 
 `squad-improvement-worker` is part of the standard, coherent install above —
 not a separate opt-in add-on. It stays dormant until a maintainer approves a
 governance-scoped retrospective proposal (see the gh-aw guide's retrospective
-auto-implementation section); installing it alongside the other six keeps the
+auto-implementation section); installing it alongside the other seven keeps the
 full stack consistent and avoids a second bootstrap pass later.
 
 Report/proposal-only is the default. Ordinary fixes require the explicit
@@ -220,7 +221,7 @@ node .github/workflows/shared/squad-install-verifier.mjs \
 This must run after any first-install approval and before committing. Success
 criteria:
 
-- All seven workflows compile successfully.
+- All eight workflows compile successfully.
 - The **only** permitted warning is the known `squad.md` bot-trigger warning: it
   configures both slash-command and `github-actions[bot]` triggers, and the bot
   trigger is required for controlled worker-continuation dispatches.
@@ -230,7 +231,7 @@ criteria:
 ### 6. Require the verifier to prove the complete consumer contract
 
 - **STOP** if the verifier reports a missing source/lock pair, missing package
-  ownership record, stale source/resource digest, incomplete seven-workflow
+  ownership record, stale source/resource digest, incomplete eight-workflow
   registration, or mixed revision.
 - Use only the recovery commands printed by the verifier. They reinstall the
   complete package at one immutable revision; never repair one workflow or
@@ -258,6 +259,8 @@ Stage **only** the documented generated surfaces, then verify the staged set:
 
 ```bash
 git add -- .gitattributes .github/aw/ .github/workflows/ .github/skills/
+node .github/workflows/shared/squad-install-verifier.mjs \
+  --verify-staged-install --stage-ownership --source-revision "${SQUAD_SHA}" || exit 1
 git diff --cached --stat
 # No deletions should be staged:
 test -z "$(git diff --cached --diff-filter=D --name-only)" || { echo "STOP: staged deletions"; exit 1; }
@@ -267,6 +270,15 @@ test -z "$(git diff --cached --diff-filter=D --name-only)" || { echo "STOP: stag
   edits to **unrelated files**, or committed **log/diagnostic output**. Re-scope with
   explicit `git add -- <path>` — never `git add .`, `git add -A`, or `git commit -a`.
 
+Consumer rules such as `packages/` can silently ignore the required ownership
+JSON under `.github/aw/packages/`. The staged verifier force-adds only the exact
+native package ownership JSON when it is ignored and untracked. It then verifies
+every manifest-required source, lo
```

**File**: `packages/squad-sdk/templates/skills/gh-aw-enlistment/SKILL.md` (modified, +19/-5)
```diff
@@ -11,7 +11,7 @@ tools:
     when: "Every step: preflight identity/auth, requiring Issues, enabling Actions-created PRs, opening and watching the bootstrap PR."
   - name: "gh aw"
     description: "GitHub Agentic Workflows extension (github/gh-aw) — installs and strictly compiles the Squad workflow set."
-    when: "Installing the immutable native Squad package and compiling its seven workflows into deterministic .lock.yml files."
+    when: "Installing the immutable native Squad package and compiling its eight workflows into deterministic .lock.yml files."
 ---
 
 ## Context
@@ -146,7 +146,7 @@ gh aw add "bradygaster/squad/workflows@${SQUAD_SHA}"
 
 The nested `workflows/aw.yml` is the only supported distribution registration.
 It isolates package auto-discovery from unrelated repository skills and agents,
-and installs exactly seven workflows, fifteen runtime resources, and one
+and installs exactly eight workflows, seventeen runtime resources, and one
 `gh-aw-enlistment` skill at the same resolved revision:
 
 - `squad.md` + `squad.lock.yml`
@@ -156,11 +156,12 @@ and installs exactly seven workflows, fifteen runtime resources, and one
 - `squad-retro.md` + `squad-retro.lock.yml`
 - `squad-improvement-worker.md` + `squad-improvement-worker.lock.yml`
 - `squad-bootstrap.md` + `squad-bootstrap.lock.yml`
+- `squad-command-router.md` + `squad-command-router.lock.yml`
 
 `squad-improvement-worker` is part of the standard, coherent install above —
 not a separate opt-in add-on. It stays dormant until a maintainer approves a
 governance-scoped retrospective proposal (see the gh-aw guide's retrospective
-auto-implementation section); installing it alongside the other six keeps the
+auto-implementation section); installing it alongside the other seven keeps the
 full stack consistent and avoids a second bootstrap pass later.
 
 Report/proposal-only is the default. Ordinary fixes require the explicit
@@ -220,7 +221,7 @@ node .github/workflows/shared/squad-install-verifier.mjs \
 This must run after any first-install approval and before committing. Success
 criteria:
 
-- All seven workflows compile successfully.
+- All eight workflows compile successfully.
 - The **only** permitted warning is the known `squad.md` bot-trigger warning: it
   configures both slash-command and `github-actions[bot]` triggers, and the bot
   trigger is required for controlled worker-continuation dispatches.
@@ -230,7 +231,7 @@ criteria:
 ### 6. Require the verifier to prove the complete consumer contract
 
 - **STOP** if the verifier reports a missing source/lock pair, missing package
-  ownership record, stale source/resource digest, incomplete seven-workflow
+  ownership record, stale source/resource digest, incomplete eight-workflow
   registration, or mixed revision.
 - Use only the recovery commands printed by the verifier. They reinstall the
   complete package at one immutable revision; never repair one workflow or
@@ -258,6 +259,8 @@ Stage **only** the documented generated surfaces, then verify the staged set:
 
 ```bash
 git add -- .gitattributes .github/aw/ .github/workflows/ .github/skills/
+node .github/workflows/shared/squad-install-verifier.mjs \
+  --verify-staged-install --stage-ownership --source-revision "${SQUAD_SHA}" || exit 1
 git diff --cached --stat
 # No deletions should be staged:
 test -z "$(git diff --cached --diff-filter=D --name-only)" || { echo "STOP: staged deletions"; exit 1; }
@@ -267,6 +270,15 @@ test -z "$(git diff --cached --diff-filter=D --name-only)" || { echo "STOP: stag
   edits to **unrelated files**, or committed **log/diagnostic output**. Re-scope with
   explicit `git add -- <path>` — never `git add .`, `git add -A`, or `git commit -a`.
 
+Consumer rules such as `packages/` can silently ignore the required ownership
+JSON under `.github/aw/packages/`. The staged verifier force-adds only the exact
+native package ownership JSON when it is ignored and untracked. It then verifies
+every manifest-required source, lo
```

---

### Incident Patch 3: `26c51f00` (2026-09-29)
**Commit Message**: fix(gh-aw): submit bootstrap chunks without agent transcription (#2115)

* fix(gh-aw): submit bootstrap chunks without agent transcription

Closes #2112

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

* fix(ci): seed immutable actions in native workflow consumer

Closes #2112

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

---------

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

**File**: `.github/workflows/squad-ci.yml` (modified, +4/-0)
```diff
@@ -791,6 +791,10 @@ jobs:
             test "$(find .github/workflows -maxdepth 1 -name 'squad*.md' | wc -l | tr -d ' ')" = 8
             test "$(find .github/workflows/shared -type f ! -name 'squad-bootstrap-trigger-probe.json' | wc -l | tr -d ' ')" = 17
             test "$(find .github/skills/gh-aw-enlistment -type f | wc -l | tr -d ' ')" = 1
+            node --input-type=module -e '
+              import { compileWithPinnedActions } from "./.github/workflows/shared/squad-install-verifier.mjs";
+              compileWithPinnedActions(process.cwd());
+            '
             gh aw compile --strict --approve --no-check-update
             for workflow in squad squad-implement-worker squad-review squad-deps-worker squad-retro squad-improvement-worker squad-bootstrap squad-command-router; do
               gh aw compile "$workflow" --strict --no-check-update
```

**File**: `docs/src/content/docs/guide/gh-aw.md` (modified, +7/-0)
```diff
@@ -150,6 +150,13 @@ validated payload:
 - a draft Cast PR on `squad/bootstrap-cast`; and
 - `[Research Proposals] Agent-discovered repo opportunities`.
 
+Bootstrap submits the shared payload through one authenticated command. Runtime
+code assembles and validates its bounded chunks, then passes JSON directly to
+the existing typed safe-output tool; the agent never copies chunks into tool
+arguments. Missing, duplicate, reordered, malformed, oversized, or mismatched
+payloads fail closed before submission, and the write job independently
+revalidates the payload. A submission error is terminal, not permission to retry.
+
 Review and merge the Cast PR, then rerun `/squad triage` on the linked issue to
 classify its existing bootstrap proposals. If a proposal needs deeper or newer
 evidence, use one of the issue's focused `/squad research ...` commands first;
```

**File**: `test/gh-aw-bootstrap-workflow.test.ts` (modified, +130/-6)
```diff
@@ -1,6 +1,8 @@
 import { afterAll, describe, expect, it } from 'vitest';
 import {
   cpSync,
+  chmodSync,
+  existsSync,
   mkdirSync,
   mkdtempSync,
   readFileSync,
@@ -12,6 +14,7 @@ import { createHash } from 'node:crypto';
 import { dirname, join, resolve } from 'node:path';
 import { tmpdir } from 'node:os';
 import { fileURLToPath } from 'node:url';
+import { parse } from 'yaml';
 import {
   BOOTSTRAP_BRANCH,
   BOOTSTRAP_ISSUE_MARKER,
@@ -375,6 +378,48 @@ function validateFixture(
   );
 }
 
+function submissionFixture() {
+  const fixture = createFixture();
+  const targetBytes = 40_843;
+  const remaining = targetBytes - Buffer.byteLength(JSON.stringify(fixture.payload));
+  const rationale = ' Repository evidence informs this proposed specialist; human review is required before activation.';
+  fixture.payload.pr_body += rationale.repeat(Math.ceil(remaining / rationale.length)).slice(0, remaining);
+  const text = JSON.stringify(fixture.payload);
+  expect(Buffer.byteLength(text)).toBe(targetBytes);
+  writeFileSync(fixture.payloadPath, text);
+  const envelope = createBootstrapPayloadEnvelope(text) as Record<string, string>;
+  expect(envelope.payload_chunk_count).toBe('7');
+  const envelopePath = join(fixture.root, 'envelope.json');
+  writeFileSync(envelopePath, JSON.stringify(envelope));
+  const capture = join(fixture.root, 'calls.jsonl');
+  const proxy = join(fixture.root, 'bin/safeoutputs');
+  write(fixture.root, 'bin/safeoutputs', `#!${process.execPath}
+const fs = require('node:fs');
+const args = process.argv.slice(2);
+if (JSON.stringify(args) !== JSON.stringify(['materialize_bootstrap', '.'])) process.exit(2);
+const input = JSON.parse(fs.readFileSync(0, 'utf8'));
+if (Object.values(input).some(value => typeof value !== 'string' || Buffer.byteLength(value) > 10240)) process.exit(3);
+fs.appendFileSync(process.env.CAPTURE, JSON.stringify(input) + '\\n');
+if (process.env.PROXY_FAIL === '1') { console.error('proxy rejected request'); process.exit(4); }
+console.log('tool accepted');
+`);
+  chmodSync(proxy, 0o700);
+  const env = {
+    ...process.env,
+    PATH: `${join(fixture.root, 'bin')}:${process.env.PATH}`,
+    CAPTURE: capture,
+    GITHUB_WORKSPACE: fixture.root,
+    GITHUB_REPOSITORY: 'octo/example',
+    DEFAULT_BRANCH: 'main',
+  };
+  const submit = (overrides = {}) => spawnSync(process.execPath, [
+    VALIDATOR, '--submit-envelope', envelopePath,
+    '--root', fixture.root, '--payload', fixture.payloadPath,
+    '--repository', 'octo/example', '--default-branch', 'main', '--link-mode', 'placeholder',
+  ], { env: { ...env, ...overrides }, encoding: 'utf8' });
+  return { ...fixture, text, envelope, envelopePath, capture, proxy, env, submit };
+}
+
 function compileWorkflow(source = WORKFLOW): string {
   const root = mkdtempSync(join(tmpdir(), 'gh-aw-bootstrap-compile-'));
   workspaces.push(root);
@@ -601,12 +646,8 @@ describe('automatic Squad bootstrap workflow', () => {
   });
 
   it('fails closed for every chunk transport corruption class', () => {
-    const payloadText = JSON.stringify({
-      shared: 'Cast and research stay in one validated payload.',
-      content: 'x'.repeat(PAYLOAD_CHUNK_BYTES * 2),
-    });
-    const valid = createBootstrapPayloadEnvelope(payloadText) as Record<string, string>;
-    expect(Number(valid.payload_chunk_count)).toBeGreaterThanOrEqual(3);
+    const fixture = submissionFixture();
+    const valid = fixture.envelope;
 
     const mutations: Array<[string, (envelope: Record<string, string>) => void, RegExp]> = [
       ['missing', (envelope) => delete envelope.payload_chunk_00, /payload_chunk_00 is missing/],
@@ -653,6 +694,8 @@ describe('automatic Squad bootstrap workflow', () => {
         /decoded length does not match|length mismatch/,
       ],
       ['hash mismatch', (envelope) => { envelope.payload_sha256 = '0'.repeat(64); }, /SHA-256 mismatch/],
+      ['noncanonical count', (envelope) => { envelope.payload_chunk_count = '07'; }, /
```

**File**: `test/gh-aw-quality.test.ts` (modified, +51/-0)
```diff
@@ -3992,6 +3992,57 @@ describe('gh-aw: canonical package integrity contract', () => {
     120_000,
   );
 
+  it('seeds native-consumer CI pins without usable authentication and rejects tampering', () => {
+    const workflow = parseDocument(readText(join(process.cwd(), '.github/workflows/squad-ci.yml'))).toJS();
+    const step = workflow.jobs['gh-aw-compile'].steps.find(
+      (candidate: { name?: string }) => candidate.name === 'Verify a clean native package consumer',
+    );
+    const seed = step.run.match(/node --input-type=module -e '([\s\S]*?)'/)?.[1];
+    expect(seed, 'native consumer must execute the version-bound pin helper').toBeDefined();
+    expect(step.run.indexOf('compileWithPinnedActions(process.cwd())'))
+      .toBeLessThan(step.run.indexOf('gh aw compile --strict --approve'));
+    expect(step.run).toContain('--verify-install');
+    expect(step.run).toContain('--strict-compile');
+
+    const root = makeConsumer(revisionA, true, 'package');
+    execFileSync('git', ['init', '--quiet'], { cwd: root });
+    execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/example/squad-consumer.git'], { cwd: root });
+    // A deliberately invalid test credential prevents fallback to local keychain authentication.
+    const env = { ...process.env, GH_TOKEN: 'invalid-test-token', GITHUB_TOKEN: '' };
+    const compile = () => execFileSync('gh', ['aw', 'compile', '--strict', '--no-check-update'], {
+      cwd: root, env, stdio: 'pipe', timeout: 120_000,
+    });
+    const lockPath = join(root, '.github/workflows/squad.lock.yml');
+    compile();
+    const unpinned = readText(lockPath);
+    expect(createHash('sha256').update(normalizeCompiledLock(unpinned, revisionA)).digest('hex'))
+      .toBe('bf54175720e6e9ab3fe5d5e3054c28f3a69595c95cdf50e56f9b30988158270f');
+    expect(verifyInstall(root).failures.join('\n')).toContain('Installed digest mismatch');
+
+    const seedPins = () => spawnSync(process.execPath, ['--input-type=module', '-e', seed!], {
+      cwd: root, env, encoding: 'utf8', timeout: 120_000,
+    });
+    const seeded = seedPins();
+    expect(seeded.status, seeded.stderr).toBe(0);
+    compile();
+    expect(verifyInstall(root, { expectedRevision: revisionA, strictCompile: true }).failures).toEqual([]);
+    const contract = JSON.parse(readText(join(root, CONTRACT_DESTINATION)));
+    for (const entry of contract.workflows) {
+      const lock = readText(join(root, entry.lock));
+      expect(() => validateCompilerActionPins(lock)).not.toThrow();
+      expect(createHash('sha256').update(normalizeCompiledLock(lock, revisionA)).digest('hex'))
+        .toBe(entry.package_lock_sha256);
+    }
+
+    const pinPath = join(root, '.github/aw/actions-lock.json');
+    const pins = JSON.parse(readText(pinPath));
+    pins.entries[`github/gh-aw-actions/setup@${MIN_GH_AW_VERSION}`].sha = '0'.repeat(40);
+    writeFileSync(pinPath, JSON.stringify(pins));
+    const tampered = seedPins();
+    expect(tampered.status).not.toBe(0);
+    expect(tampered.stderr).toContain('missing or noncanonical pin');
+  }, 120_000);
+
   function updateOwnedDigest(root: string, destination: string): void {
     const path = join(root, '.github/aw/packages/bradygaster-squad-workflows-test.json');
     const record = JSON.parse(readFileSync(path, 'utf8'));
```

**File**: `workflows/package/squad-bootstrap.md` (modified, +24/-30)
```diff
@@ -30,6 +30,7 @@ network:
   allowed:
     - defaults
 tools:
+  cli-proxy: true
   edit: null
   bash: true
   github:
@@ -153,17 +154,18 @@ pre-agent-steps:
       # BEGIN GENERATED RESOURCE DIGESTS
       check_hash "$install_verifier" "514e210ebeae3b355ff73ed81bfd17f37207c9a3576ca44eaf8af7bfa21fc173"
       check_hash "$cast_validator" "0988e04aeef316f4d7a0107c902bbbcf6538b8899b9fffba5f62150717967685"
-      check_hash "$bootstrap_validator" "d449b9204f7fad133ff7133c1a30c9381c87e3c0c9d481352819ca93ea1a1dad"
+      check_hash "$bootstrap_validator" "4fc1bcc79b887bb4f2f78e7eef8693d5c1eaf817d8715ce3c92169934aa225b7"
       # END GENERATED RESOURCE DIGESTS
       node "$bootstrap_validator" \
+        --encode-payload "${GITHUB_WORKSPACE:?}/.github/workflows/squad-bootstrap-payload.json" \
+        > "${GITHUB_WORKSPACE:?}/.github/workflows/squad-bootstrap-envelope.json"
+      node "$bootstrap_validator" \
+        --submit-envelope "${GITHUB_WORKSPACE:?}/.github/workflows/squad-bootstrap-envelope.json" \
         --root "$PWD" \
         --payload "${GITHUB_WORKSPACE:?}/.github/workflows/squad-bootstrap-payload.json" \
         --repository "${GITHUB_REPOSITORY:?}" \
-        --default-branch "${SQUAD_BOOTSTRAP_DEFAULT_BRANCH:?}" \
+        --default-branch "${DEFAULT_BRANCH:?}" \
         --link-mode placeholder
-      node "$bootstrap_validator" \
-        --encode-payload "${GITHUB_WORKSPACE:?}/.github/workflows/squad-bootstrap-payload.json" \
-        > "${GITHUB_WORKSPACE:?}/.github/workflows/squad-bootstrap-envelope.json"
       SQUAD_BOOTSTRAP_VALIDATOR
       chmod 500 "$runner"
 safe-outputs:
@@ -737,33 +739,25 @@ exemplar's long audit format.
 
 ## Validation and output
 
-Run exactly:
+After generating the payload, run this command exactly once:
 
 ```bash
 "${GITHUB_WORKSPACE:?}/.github/workflows/run-squad-bootstrap-validator"
 ```
 
-Only exit status zero with stdout exactly
-`Squad bootstrap validation passed.` authorizes reading
-`.github/workflows/squad-bootstrap-envelope.json`. That file is the only
-transport source for one `materialize_bootstrap` call.
-
-The envelope contains:
-
-- `payload_encoding`: exactly `base64`
-- `payload_byte_length`: canonical decimal UTF-8 byte length, maximum 96,000
-- `payload_sha256`: lowercase SHA-256 of the complete payload bytes
-- `payload_chunk_count`: canonical decimal from 1 through 16
-- `payload_chunk_00` through `payload_chunk_15`: only the populated fixed slots
-
-Each populated chunk is `NN:` followed by canonical Base64 for at most 6,000
-payload bytes, so every string is at most 8,003 bytes and stays conservatively
-below gh-aw's 10,240-byte per-string input limit. Pass every property from the
-envelope byte-for-byte to the typed safe-output call. Do not reserialize the
-payload, recompute metadata, rename slots, add unused slots, or split semantic
-generation into separate Cast and research outputs. The writer reconstructs the
-one shared payload and verifies order, count, bounds, UTF-8, total byte length,
-and SHA-256 before parsing any JSON.
-
-Any validation or envelope error is terminal: emit no materialization output,
-report the exact validator stderr, and stop.
+The authenticated command deterministically encodes the payload, reconstructs
+and checks all chunk ordinals, count, bounds, UTF-8, byte length and SHA-256,
+validates the payload schema and Cast tree, then invokes the existing typed
+`materialize_bootstrap` safe-output tool through its mounted CLI with JSON on
+stdin. Its tool invocation is bounded to 60 seconds. GitHub writes still occur
+only in the safe-output job, which independently revalidates the payload.
+
+Exit status zero with stdout exactly
+`Squad bootstrap validation passed; materialize_bootstrap submitted.`
+means the one output has already been submitted. Stop immediately.
+Never read, print, extract, or transcribe `squad-bootstrap-envelope.json` or its
+chunks. Never invoke `materialize_bootstrap` separately, retry the command,
```

---

### Incident Patch 4: `59bedd0b` (2026-09-29)
**Commit Message**: fix(gh-aw): verify native package source digest variants (#2111)

Supports both legitimate native installer provenance forms with complete source-selected digests and deterministic immutable gh-aw toolchain action pins. Integrity normalization and installed-byte verification remain unchanged.\n\nCloses #2103\n\nCo-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

**File**: `docs/src/content/docs/guide/gh-aw.md` (modified, +25/-0)
```diff
@@ -1802,6 +1802,31 @@ then reapply them before the final compile. Never customize generated
 ownership record, missing source/lock pair, or absent runtime resource and
 prints the exact safe recovery commands.
 
+The schema-v2 integrity manifest records two complete compiled lock digests per
+workflow: `lock_sha256` for a per-workflow source annotation and
+`package_lock_sha256` for a package-root annotation. gh-aw v0.89.21 emits
+`bradygaster/squad/workflows@SHA` for direct package includes, but can emit
+`bradygaster/squad/workflows/package/<workflow>.md@SHA` when installing dispatched
+dependencies. Fresh and forced installs can therefore contain different mixtures.
+The verifier selects one digest from the exact, ownership- and source-validated
+annotation; it never tries both until one passes. Compiled source comments,
+URLs, action pins, permissions and runtime bytes remain integrity-checked.
+No additional fields are removed during lock normalization.
+
+Manifest generation and installation test fixtures seed isolated compiler action
+locks with the immutable `setup` and `setup-cli` pins for gh-aw v0.89.21. Both
+source variants use the real strict compiler and validate its version and emitted
+action pins. This avoids a second network resolution returning a mutable version
+tag when credentials or the API are unavailable. Missing or altered pins fail
+generation; mutable-tag compiled locks still fail installation integrity.
+
+This fixes the post-merge installation failure in #2103: the old generator and
+local-consumer tests covered only per-workflow annotations, while the native
+installer also emitted package-root annotations. The difference was installation
+provenance, not the squash commit identity or a generated timestamp. Old manifests
+or manifests missing either digest are rejected; upgrade the entire package,
+including the verifier and manifest, using the block above.
+
 Use the complete upgrade block even when a failure appears limited to the
 first-run bootstrap workflow. Updating only `squad-bootstrap.md` is unsupported
 because it can leave its validator or the rest of the workflow set at a
```

**File**: `test/gh-aw-quality.test.ts` (modified, +188/-3)
```diff
@@ -36,11 +36,15 @@ import {
   TRIGGER_PROBE,
   TRIGGER_PROBE_DESTINATION,
   WORKFLOW_NAMES,
+  buildContract,
   checkSource,
+  compileWithPinnedActions,
   materializeRuntime,
   normalizeCompiledLock,
   validateContract,
+  validateCompilerActionPins,
   verifyInstall,
+  verifyCanonicalManifest,
 } from '../workflows/shared/squad-install-verifier.mjs';
 
 const WORKFLOWS_DIR = join(process.cwd(), 'workflows');
@@ -3780,9 +3784,13 @@ describe('gh-aw: canonical package integrity contract', () => {
     cpSync(join(process.cwd(), source), target);
   }
 
-  function makeConsumer(revision = revisionA, materialize = true): string {
+  function makeConsumer(
+    revision = revisionA,
+    materialize = true,
+    sourceBinding: 'workflow' | 'package' | 'mixed' = 'workflow',
+  ): string {
     const root = createTestWorkspace('gh-aw-package-contract-');
-    const install = createFirstInstallFixture(revision);
+    const install = createFirstInstallFixture(revision, sourceBinding);
     copyInto(root, CONTRACT_SOURCE, CONTRACT_DESTINATION);
     const contract = JSON.parse(readFileSync(join(process.cwd(), CONTRACT_SOURCE), 'utf8'));
     for (const workflow of contract.workflows) {
@@ -3873,7 +3881,7 @@ describe('gh-aw: canonical package integrity contract', () => {
       expect(readText(join(process.cwd(), workflow.source))).not.toMatch(/^resources:/m);
     }
     expect(existsSync(join(process.cwd(), 'aw.yml'))).toBe(false);
-  });
+  }, 120_000);
 
   it('accepts a coherent consumer with the exact ownership cardinality', () => {
     const root = makeConsumer();
@@ -3885,6 +3893,183 @@ describe('gh-aw: canonical package integrity contract', () => {
     expect(record.files).toHaveLength(OWNERSHIP_ENTRY_COUNT);
   });
 
+  it.each(['workflow', 'package', 'mixed'] as const)(
+    'verifies %s source bindings at the immutable squash-merged revision',
+    sourceBinding => {
+      const revision = '6ec06cc79230cf71d55b484457e8f11190e20a49';
+      const root = makeConsumer(revision, true, sourceBinding);
+      execFileSync('git', ['init', '--quiet'], { cwd: root });
+      execFileSync('git', ['remote', 'add', 'origin', 'https://github.com/example/squad-consumer.git'], { cwd: root });
+      compileWithPinnedActions(root);
+      expect(verifyInstall(root, { expectedRevision: revision, strictCompile: true }).failures).toEqual([]);
+      const contract = JSON.parse(readFileSync(join(root, CONTRACT_DESTINATION), 'utf8'));
+      const review = contract.workflows.find((entry: { name: string }) => entry.name === 'squad-review');
+      expect(review.package_lock_sha256).not.toBe(review.lock_sha256);
+      expect(contract.schema_version).toBe(2);
+    },
+    120_000,
+  );
+
+  it('keeps both compiled digest variants stable across equivalent trees with different commit identities', () => {
+    const trees: string[] = [];
+    const commits: string[] = [];
+    for (const message of ['PR head', 'Squash merge']) {
+      const root = createTestWorkspace('gh-aw-commit-identity-');
+      cpSync(WORKFLOWS_DIR, join(root, 'workflows'), { recursive: true });
+      const git = (args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
+      git(['init', '--quiet']);
+      git(['add', 'workflows']);
+      git(['-c', 'user.name=Contract Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', message]);
+      trees.push(git(['rev-parse', 'HEAD^{tree}']));
+      const revision = git(['rev-parse', 'HEAD']);
+      commits.push(revision);
+      expect(buildContract(root)).toEqual(JSON.parse(readFileSync(join(root, CONTRACT_SOURCE), 'utf8')));
+      for (const sourceBinding of ['workflow', 'package'] as const) {
+        expect(verifyInstall(makeConsumer(revision, true, sourceBinding), {
+          expectedRevision: revision,
+        }).failures).toEqual([]);
+      }
+    }
+    expect(trees[0]).toBe(trees[1]);
+    expect(commits[0]).not.toBe(commits[1]);
+  }, 120_000);
+
+  i
```

**File**: `test/helpers/gh-aw-install-fixture.ts` (modified, +14/-10)
```diff
@@ -13,6 +13,7 @@ import {
   CONTRACT_DESTINATION,
   CONTRACT_SOURCE,
   PACKAGE_NAME,
+  compileWithPinnedActions,
 } from '../../workflows/shared/squad-install-verifier.mjs';
 
 interface ContractEntry {
@@ -26,6 +27,7 @@ interface WorkflowEntry extends ContractEntry {
   lock: string;
   source_sha256: string;
   lock_sha256: string;
+  package_lock_sha256: string;
 }
 
 interface RuntimeEntry extends ContractEntry {
@@ -99,8 +101,12 @@ export function githubFile(content: Buffer): {
   };
 }
 
-export function createFirstInstallFixture(revision: string): InstallFixture {
-  const cached = fixtureCache.get(revision);
+export function createFirstInstallFixture(
+  revision: string,
+  sourceBinding: 'workflow' | 'package' | 'mixed' = 'workflow',
+): InstallFixture {
+  const cacheKey = `${revision}:${sourceBinding}`;
+  const cached = fixtureCache.get(cacheKey);
   if (cached) return cloneFixture(cached);
   const root = process.cwd();
   const manifestBytes = readFileSync(resolve(root, CONTRACT_SOURCE));
@@ -113,21 +119,19 @@ export function createFirstInstallFixture(revision: string): InstallFixture {
     mkdirSync(workflowRoot, { recursive: true });
     cpSync(resolve(root, 'workflows/shared'), resolve(workflowRoot, 'shared'), { recursive: true });
 
-    for (const entry of manifest.workflows as WorkflowEntry[]) {
+    for (const [index, entry] of (manifest.workflows as WorkflowEntry[]).entries()) {
       const canonical = readFileSync(resolve(root, entry.source));
       canonicalFiles.set(entry.source, canonical);
-      const installed = withSource(canonical, entry.source, revision);
+      const source = sourceBinding === 'package' || (sourceBinding === 'mixed' && index % 2 === 0)
+        ? 'workflows' : entry.source;
+      const installed = withSource(canonical, source, revision);
       consumerFiles.set(entry.destination, installed);
       const path = resolve(scratch, entry.destination);
       mkdirSync(dirname(path), { recursive: true });
       writeFileSync(path, installed);
     }
     execFileSync('git', ['init', '--quiet'], { cwd: scratch });
-    execFileSync('gh', ['aw', 'compile', '--strict', '--no-check-update'], {
-      cwd: scratch,
-      stdio: 'pipe',
-      timeout: 120_000,
-    });
+    compileWithPinnedActions(scratch);
     for (const entry of manifest.workflows as WorkflowEntry[]) {
       consumerFiles.set(entry.lock, readFileSync(resolve(scratch, entry.lock)));
     }
@@ -169,7 +173,7 @@ export function createFirstInstallFixture(revision: string): InstallFixture {
       consumerFiles,
       canonicalFiles,
     };
-    fixtureCache.set(revision, fixture);
+    fixtureCache.set(cacheKey, fixture);
     return cloneFixture(fixture);
   } finally {
     rmSync(scratch, { recursive: true, force: true });
```

**File**: `workflows/package/squad-bootstrap.md` (modified, +1/-1)
```diff
@@ -151,7 +151,7 @@ pre-agent-steps:
         node --check "$path" >/dev/null
       }
       # BEGIN GENERATED RESOURCE DIGESTS
-      check_hash "$install_verifier" "71418638e37a53f570b13919bf5b232f5999be217dac4efc6b76e91918f85f16"
+      check_hash "$install_verifier" "514e210ebeae3b355ff73ed81bfd17f37207c9a3576ca44eaf8af7bfa21fc173"
       check_hash "$cast_validator" "0988e04aeef316f4d7a0107c902bbbcf6538b8899b9fffba5f62150717967685"
       check_hash "$bootstrap_validator" "d449b9204f7fad133ff7133c1a30c9381c87e3c0c9d481352819ca93ea1a1dad"
       # END GENERATED RESOURCE DIGESTS
```

**File**: `workflows/shared/squad-install-verifier.mjs` (modified, +98/-30)
```diff
@@ -33,6 +33,9 @@ export const TRIGGER_PROBE_DESTINATION =
 const SHA256_PATTERN = /^[0-9a-f]{64}$/;
 const REVISION_PATTERN = /^[0-9a-f]{40}$/;
 const LOCK_REVISION_PLACEHOLDER = 'f'.repeat(40);
+const COMPILER_ACTION_VERSION = 'v0.89.21';
+const COMPILER_ACTION_SHA = '924af5fdc64061cfbf66fb584c8b07e2ac230c60';
+const COMPILER_ACTION_REPOS = ['github/gh-aw-actions/setup', 'github/gh-aw-actions/setup-cli'];
 
 function deepFreeze(value) {
   if (value && typeof value === 'object' && !Object.isFrozen(value)) {
@@ -147,7 +150,9 @@ function assertDigest(value, label) {
 
 export function validateContract(contract) {
   assertKeys(contract, TOP_LEVEL_KEYS, 'Integrity contract');
-  if (contract.schema_version !== 1) throw new Error('Integrity contract schema_version must be 1.');
+  if (contract.schema_version !== 2) {
+    throw new Error('Integrity contract schema_version must be 2; reinstall the complete package from one immutable revision.');
+  }
   if (contract.package !== PACKAGE_NAME) throw new Error(`Integrity contract package must be ${PACKAGE_NAME}.`);
   if (contract.manifest !== PACKAGE_MANIFEST) throw new Error(`Integrity contract manifest must be ${PACKAGE_MANIFEST}.`);
   if (contract.minimum_gh_aw_version !== MIN_GH_AW_VERSION) {
@@ -161,7 +166,7 @@ export function validateContract(contract) {
   contract.workflows.forEach((entry, index) => {
     assertKeys(
       entry,
-      ['name', 'source', 'destination', 'lock', 'source_sha256', 'lock_sha256'],
+      ['name', 'source', 'destination', 'lock', 'source_sha256', 'lock_sha256', 'package_lock_sha256'],
       `Workflow entry ${index}`,
     );
     const [name, source, destination, lock] = WORKFLOW_TUPLES[index];
@@ -171,6 +176,7 @@ export function validateContract(contract) {
     validatePathSyntax(entry.lock, lock, `Workflow ${name} lock`);
     assertDigest(entry.source_sha256, `Workflow ${name} source_sha256`);
     assertDigest(entry.lock_sha256, `Workflow ${name} lock_sha256`);
+    assertDigest(entry.package_lock_sha256, `Workflow ${name} package_lock_sha256`);
   });
 
   assertArray(contract.shared_runtime, RUNTIME_TUPLES.length, 'Integrity contract shared_runtime');
@@ -326,14 +332,15 @@ function packageWorkflowSource(_root, name) {
   return `workflows/package/${name}.md`;
 }
 
-function workflowWithSource(content, name, revision) {
+function workflowWithSource(content, name, revision, packageSource) {
   const marker = '\n---\n';
   const end = content.indexOf(marker, 4);
   if (!content.startsWith('---\n') || end < 0) {
     throw new Error(`Generated package workflow has invalid frontmatter: ${name}`);
   }
+  const source = packageSource ? PACKAGE_NAME : `${PACKAGE_NAME}/package/${name}.md`;
   return `${content.slice(0, end)}
-source: ${PACKAGE_NAME}/package/${name}.md@${revision}${content.slice(end)}`;
+source: ${source}@${revision}${content.slice(end)}`;
 }
 
 export function normalizeCompiledLock(content, revision) {
@@ -357,7 +364,69 @@ export function normalizeCompiledLock(content, revision) {
     .replaceAll(revision, LOCK_REVISION_PLACEHOLDER);
 }
 
-function buildLockDigests(root, renderedWorkflows) {
+export function validateCompilerActionPins(content) {
+  const text = String(content);
+  const metadata = text.match(/^# gh-aw-manifest: (.+)$/m);
+  const actions = metadata ? JSON.parse(metadata[1]).actions : undefined;
+  if (!Array.isArray(actions)
+    || !actions.some(action => action.repo === COMPILER_ACTION_REPOS[0])) {
+    throw new Error('Compiled workflow is missing the gh-aw setup action pin.');
+  }
+  for (const action of actions.filter(action => COMPILER_ACTION_REPOS.includes(action.repo))) {
+    if (action.sha !== COMPILER_ACTION_SHA || action.version !== COMPILER_ACTION_VERSION) {
+      throw new Error(`Compiled workflow has an invalid immutable action pin: ${action.repo}`);
+    }
+  }
+  const references = [...text.matchAll(/^\s+uses: (github\/gh-aw-actions\/setup(?:-cli)?)@(\S+)/gm)];
+  if (!references.some(([, 
```

---

### Incident Patch 5: `6ec06cc7` (2026-09-29)
**Commit Message**: fix(gh-aw): replace reviewer App with native review authority (#2109)

Removes the dedicated reviewer App, private-key secret, environment, token minting, and custom Checks API publisher. Uses the base-controlled native GitHub Actions/gh-aw review job and exact-run relay binding, with context-only merge enforcement explicitly advisory unless source-bound policy is available.\n\nCloses #2103\n\nCo-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

**File**: `.changeset/dedicated-review-app.md` (modified, +7/-1)
```diff
@@ -3,4 +3,10 @@
 "@bradygaster/squad-sdk": patch
 ---
 
-Require a dedicated, branch-restricted GitHub App identity for authoritative Squad review checks.
+Use the base-controlled deterministic relay's native `Squad Review / review`
+job as the authoritative review result only when it validates the exact trusted
+automatic workflow run. Authoritative merge enforcement requires a source-bound
+required-workflow or equivalent ruleset; where that is unavailable, the context
+is advisory and an independent human approving review remains required. This
+path needs no separately provisioned reviewer App, token, private key, secret,
+environment, or custom Checks API publisher.
```

**File**: `.github/agents.md` (modified, +8/-6)
```diff
@@ -35,12 +35,14 @@ GitHub Agentic Workflows (`gh-aw`) are composable AI workflows triggered by slas
 > the repository's default branch.
 > The installation PR is a manual trust boundary: its PR-controlled workflow
 > cannot mint a trusted Squad verdict. After merge, require the automatically
-> opened Cast PR to pass the exact-head `Squad Review / review` attestation from
-> the base-controlled `pull_request_target` authority before treating bootstrap
-> or lifecycle automation as trusted. That check must be published by a
-> dedicated GitHub App token minted only inside the exact-default-branch
-> `squad-review-authority` environment. Missing or misconfigured reviewer
-> credentials fail closed; the workflow never falls back to `github.token`.
+> opened Cast PR to pass the deterministic relay's native
+> `Squad Review / review` job, which is authoritative only when it validates the
+> exact trusted automatic run from the base-controlled `pull_request_target`
+> workflow. Authoritative merge enforcement requires a source-bound
+> required-workflow or equivalent ruleset. Where source binding is unavailable,
+> treat the context as advisory and continue to require an independent human
+> approving review. The relay requires no separate PAT, GitHub App, private key,
+> secret, environment, or external service.
 
 The quick start installs this workflow set:
 
```

**File**: `.squad-templates/skills/gh-aw-enlistment/SKILL.md` (modified, +35/-32)
```diff
@@ -182,17 +182,17 @@ uses a moving branch reference.
 On a clean repo, `gh aw add` reports these expected safe updates and **nothing else**:
 
 <!-- allowlist-start -->
-- Restricted secrets: **`SQUAD_GITHUB_APP_PRIVATE_KEY`**,
-  **`SQUAD_GITHUB_TOKEN`**, and **`SQUAD_REVIEW_APP_PRIVATE_KEY`**
+- Restricted secrets: **`SQUAD_GITHUB_APP_PRIVATE_KEY`** and **`SQUAD_GITHUB_TOKEN`**
 - Action: **`bradygaster/squad/.github/actions/squad-init`**
 <!-- allowlist-end -->
 
-> **Compilation approval is not credential provisioning.** `gh aw add` lists
-> referenced names so you can approve the surface. `SQUAD_GITHUB_APP_PRIVATE_KEY`
-> and `SQUAD_GITHUB_TOKEN` remain optional activation credentials.
-> `SQUAD_REVIEW_APP_PRIVATE_KEY` is different: trusted check publication requires
-> it in the exact-default-branch `squad-review-authority` environment. Never put
-> reviewer credentials at repository scope and never fall back to `github.token`.
+> **These are referenced names, not prerequisites.** `gh aw add` lists the secrets
+> the workflows *reference* so you can approve that surface — it is not asking you
+> to supply them. Both secrets are optional, they need not exist, and neither is
+> required to enlist a repository. Single-repo activation runs on the built-in
+> `github.token`. Configure them only for cross-repo access or elevated
+> permissions. Auth precedence: GitHub App token, then the PAT, then
+> `github.token`. Never block an enlistment waiting for a credential.
 
 If — and only if — the report contains exactly those documented entries, complete
 the one-time approval:
@@ -284,25 +284,30 @@ gh pr checks --watch
   `main`.
 - Request Copilot review, address feedback, and wait for required checks.
 
-### 9. Verify the external review-authority prerequisite when API access permits
-
-Before claiming trusted review is ready, query the repository environment. It
-must be named `squad-review-authority`, use custom deployment branch policies,
-allow exactly the captured `${default_branch}`, contain the environment secret
-`SQUAD_REVIEW_APP_PRIVATE_KEY`, and define environment variables
-`SQUAD_REVIEW_APP_ID`, `SQUAD_REVIEW_APP_SLUG`, and
-`SQUAD_REVIEW_APP_OWNER`. The App ID/slug must differ from
-`15368`/`github-actions`. All four reviewer-specific names must also be absent
-from repository-level Actions secrets and variables; repository fallback does
-not satisfy this gate.
-
-If the authenticated account cannot read environment configuration, or any
-requirement is absent, report the exact external prerequisite and do not claim
-the required check is trusted. The installation PR remains a human boundary;
-after it merges, the Cast canary intentionally fails closed until an
-administrator provisions the environment and reruns the base-controlled
-review. Configure a ruleset only from the canary check's observed App
-integration ID, never from user input or a guessed value.
+### 9. Verify the native review contract after merge
+
+The installation PR remains an explicit human trust boundary. After a human
+merges it, inspect the automatically opened Cast PR and require the native
+`Squad Review / review` job from the base-controlled `pull_request_target`
+workflow to succeed. Verify the exact workflow path, immutable base/workflow
+SHA, PR base/head, run ID and attempt, successful `review` job, and exact-head
+GitHub Actions check-run binding.
+
+This review path uses only the native GitHub Actions/gh-aw runtime identity.
+Never request or provision a reviewer PAT, GitHub App, private key, secret,
+environment, hosted attestor, callback, or external service. The optional
+`SQUAD_GITHUB_APP_*` and `SQUAD_GITHUB_TOKEN` activation credentials remain
+unrelated to reviewer authority.
+
+For authoritative merge enforcement, use a source-bound required-workflow or
+equivalent ruleset when available. A context-only requirement for
+`Squad Review / review` is advisory because a PR-controlled workflow may be
+able to emit the same workf
```

**File**: `docs/src/content/docs/guide/gh-aw.md` (modified, +50/-74)
```diff
@@ -119,6 +119,9 @@ GitHub Actions bot comment, so editable PR prose cannot rebind an old bootstrap
 run to a changed branch head. Only after that base-controlled canary succeeds
 should the Cast/bootstrap lifecycle be treated as trusted. Do not enable the
 required check in a ruleset before this post-install canary has been observed.
+The review uses only the native GitHub Actions/gh-aw runtime identity; it does
+not require a reviewer PAT, GitHub App, private key, secret, environment, or
+external service.
 
 Step 2 deliberately checks Issues before creating the bootstrap branch or
 installing any workflow. Squad commands are issue comments, and the merged
@@ -298,21 +301,17 @@ source/lock pairs, and one coherent 40-character revision.
 
 On a clean repository, `gh aw add` reports these expected safe-update changes:
 
-- Restricted secrets: `SQUAD_GITHUB_APP_PRIVATE_KEY`, `SQUAD_GITHUB_TOKEN`, and
-  `SQUAD_REVIEW_APP_PRIVATE_KEY`
+- Restricted secrets: `SQUAD_GITHUB_APP_PRIVATE_KEY` and `SQUAD_GITHUB_TOKEN`
 - Action: `bradygaster/squad/.github/actions/squad-init`
 
 > **These are referenced names, not prerequisites.** `gh aw add` lists the secrets
 > the workflows *reference* so you can approve that surface — it is not asking you
-> to supply them during compilation. `SQUAD_GITHUB_APP_PRIVATE_KEY` and
-> `SQUAD_GITHUB_TOKEN` remain optional activation credentials; single-repo
-> activation can use the built-in `github.token`. Configure those only for cross-repo access or
+> to supply them. Both secrets are optional, they need not exist, and you do not
+> need to create either one to enlist a repository. Single-repo activation runs on
+> the built-in `github.token`. Configure these only for cross-repo access or
 > elevated permissions — see [enhanced permissions with a GitHub
 > App](#optional-enhanced-permissions-with-a-github-app) and [PAT
-> fallback](#optional-pat-fallback). `SQUAD_REVIEW_APP_PRIVATE_KEY` is different:
-> it belongs only in the branch-restricted `squad-review-authority` environment
-> described below. Trusted required-check publication intentionally fails closed
-> until that external prerequisite is provisioned.
+> fallback](#optional-pat-fallback).
 
 Review the report before approving it. If it contains only those documented
 entries, complete the first-install approval with:
@@ -436,47 +435,6 @@ a Personal Access Token:
 
 **Auth precedence:** GitHub App token → `SQUAD_GITHUB_TOKEN` → `github.token`.
 
-### Required: dedicated review authority App
-
-The required `Squad Review / review` check must not use `github.token`.
-`github.token` checks are owned by the shared GitHub Actions App
-(`id: 15368`, slug: `github-actions`), which is also available to ordinary
-same-repository PR workflows. The reviewer instead mints a short-lived token
-for a dedicated GitHub App inside a protected environment and has no fallback.
-
-Before expecting the post-install Cast canary to pass:
-
-1. Create a dedicated GitHub App with repository **Checks: read and write** and
-   read access to Actions, contents, metadata, and pull requests. Install it
-   only on the consumer repository.
-2. Create the Actions environment **`squad-review-authority`**.
-3. Configure a custom deployment branch policy containing exactly the
-   repository default branch. Do not allow wildcard, feature, release, tag, or
-   additional branch policies; a PR workflow must not be able to request this
-   environment from its own ref.
-4. Store these reviewer-specific values in that environment, not as
-   repository-level Actions secrets or variables:
-
-   | Setting | Type | Purpose |
-   |---------|------|---------|
-   | `SQUAD_REVIEW_APP_ID` | Variable | Dedicated App numeric ID; must not be `15368` |
-   | `SQUAD_REVIEW_APP_SLUG` | Variable | Dedicated App slug; must not be `github-actions` |
-   | `SQUAD_REVIEW_APP_OWNER` | Variable | Repository owner where the App is installed |
-   | `SQUAD_REVIEW_APP_PRIVATE_KEY` | Secret | Dedicated A
```

**File**: `packages/squad-cli/templates/skills/gh-aw-enlistment/SKILL.md` (modified, +35/-32)
```diff
@@ -182,17 +182,17 @@ uses a moving branch reference.
 On a clean repo, `gh aw add` reports these expected safe updates and **nothing else**:
 
 <!-- allowlist-start -->
-- Restricted secrets: **`SQUAD_GITHUB_APP_PRIVATE_KEY`**,
-  **`SQUAD_GITHUB_TOKEN`**, and **`SQUAD_REVIEW_APP_PRIVATE_KEY`**
+- Restricted secrets: **`SQUAD_GITHUB_APP_PRIVATE_KEY`** and **`SQUAD_GITHUB_TOKEN`**
 - Action: **`bradygaster/squad/.github/actions/squad-init`**
 <!-- allowlist-end -->
 
-> **Compilation approval is not credential provisioning.** `gh aw add` lists
-> referenced names so you can approve the surface. `SQUAD_GITHUB_APP_PRIVATE_KEY`
-> and `SQUAD_GITHUB_TOKEN` remain optional activation credentials.
-> `SQUAD_REVIEW_APP_PRIVATE_KEY` is different: trusted check publication requires
-> it in the exact-default-branch `squad-review-authority` environment. Never put
-> reviewer credentials at repository scope and never fall back to `github.token`.
+> **These are referenced names, not prerequisites.** `gh aw add` lists the secrets
+> the workflows *reference* so you can approve that surface — it is not asking you
+> to supply them. Both secrets are optional, they need not exist, and neither is
+> required to enlist a repository. Single-repo activation runs on the built-in
+> `github.token`. Configure them only for cross-repo access or elevated
+> permissions. Auth precedence: GitHub App token, then the PAT, then
+> `github.token`. Never block an enlistment waiting for a credential.
 
 If — and only if — the report contains exactly those documented entries, complete
 the one-time approval:
@@ -284,25 +284,30 @@ gh pr checks --watch
   `main`.
 - Request Copilot review, address feedback, and wait for required checks.
 
-### 9. Verify the external review-authority prerequisite when API access permits
-
-Before claiming trusted review is ready, query the repository environment. It
-must be named `squad-review-authority`, use custom deployment branch policies,
-allow exactly the captured `${default_branch}`, contain the environment secret
-`SQUAD_REVIEW_APP_PRIVATE_KEY`, and define environment variables
-`SQUAD_REVIEW_APP_ID`, `SQUAD_REVIEW_APP_SLUG`, and
-`SQUAD_REVIEW_APP_OWNER`. The App ID/slug must differ from
-`15368`/`github-actions`. All four reviewer-specific names must also be absent
-from repository-level Actions secrets and variables; repository fallback does
-not satisfy this gate.
-
-If the authenticated account cannot read environment configuration, or any
-requirement is absent, report the exact external prerequisite and do not claim
-the required check is trusted. The installation PR remains a human boundary;
-after it merges, the Cast canary intentionally fails closed until an
-administrator provisions the environment and reruns the base-controlled
-review. Configure a ruleset only from the canary check's observed App
-integration ID, never from user input or a guessed value.
+### 9. Verify the native review contract after merge
+
+The installation PR remains an explicit human trust boundary. After a human
+merges it, inspect the automatically opened Cast PR and require the native
+`Squad Review / review` job from the base-controlled `pull_request_target`
+workflow to succeed. Verify the exact workflow path, immutable base/workflow
+SHA, PR base/head, run ID and attempt, successful `review` job, and exact-head
+GitHub Actions check-run binding.
+
+This review path uses only the native GitHub Actions/gh-aw runtime identity.
+Never request or provision a reviewer PAT, GitHub App, private key, secret,
+environment, hosted attestor, callback, or external service. The optional
+`SQUAD_GITHUB_APP_*` and `SQUAD_GITHUB_TOKEN` activation credentials remain
+unrelated to reviewer authority.
+
+For authoritative merge enforcement, use a source-bound required-workflow or
+equivalent ruleset when available. A context-only requirement for
+`Squad Review / review` is advisory because a PR-controlled workflow may be
+able to emit the same workf
```

---

### Incident Patch 6: `29e69f53` (2026-09-29)
**Commit Message**: Merge pull request #2105 from bradygaster/bradygaster-fix-first-install-identity

fix(gh-aw): attest review from base context

**File**: `.changeset/dedicated-review-app.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+"@bradygaster/squad-cli": patch
+"@bradygaster/squad-sdk": patch
+---
+
+Require a dedicated, branch-restricted GitHub App identity for authoritative Squad review checks.
```

**File**: `.github/agents.md` (modified, +8/-0)
```diff
@@ -33,6 +33,14 @@ GitHub Agentic Workflows (`gh-aw`) are composable AI workflows triggered by slas
 > Stop at the bootstrap PR; the human merges it.
 > `/squad` slash commands become active only after that merge reaches
 > the repository's default branch.
+> The installation PR is a manual trust boundary: its PR-controlled workflow
+> cannot mint a trusted Squad verdict. After merge, require the automatically
+> opened Cast PR to pass the exact-head `Squad Review / review` attestation from
+> the base-controlled `pull_request_target` authority before treating bootstrap
+> or lifecycle automation as trusted. That check must be published by a
+> dedicated GitHub App token minted only inside the exact-default-branch
+> `squad-review-authority` environment. Missing or misconfigured reviewer
+> credentials fail closed; the workflow never falls back to `github.token`.
 
 The quick start installs this workflow set:
 
```

**File**: `.github/workflows/squad-ci.yml` (modified, +7/-2)
```diff
@@ -173,7 +173,7 @@ jobs:
         # than skipping — a skipped gate is indistinguishable from no gate. This
         # includes the shell input security contract gate (#1834) and the compile
         # contract (#1732).
-        run: gh extension install --pin v0.87.10 github/gh-aw
+        run: gh extension install --pin v0.89.21 github/gh-aw
         env:
           GH_TOKEN: ${{ github.token }}
       - name: Build
@@ -778,7 +778,12 @@ jobs:
           git -C "$CONSUMER_DIR" remote add origin https://github.com/example/squad-consumer.git
           (
             cd "$CONSUMER_DIR"
-            gh aw add "$GITHUB_WORKSPACE/workflows"
+            mkdir -p .github/workflows
+            for workflow in squad squad-implement-worker squad-review squad-deps-worker squad-retro squad-improvement-worker squad-bootstrap squad-command-router; do
+              cp "$GITHUB_WORKSPACE/workflows/package/${workflow}.md" \
+                ".github/workflows/${workflow}.md"
+            done
+            gh aw add --force "$GITHUB_WORKSPACE/workflows"
             node .github/workflows/shared/squad-install-verifier.mjs \
               --write-local-test-ownership \
               --source-revision "$SQUAD_SOURCE_REVISION"
```

**File**: `.squad-templates/skills/gh-aw-enlistment/SKILL.md` (modified, +34/-12)
```diff
@@ -182,17 +182,17 @@ uses a moving branch reference.
 On a clean repo, `gh aw add` reports these expected safe updates and **nothing else**:
 
 <!-- allowlist-start -->
-- Restricted secrets: **`SQUAD_GITHUB_APP_PRIVATE_KEY`** and **`SQUAD_GITHUB_TOKEN`**
+- Restricted secrets: **`SQUAD_GITHUB_APP_PRIVATE_KEY`**,
+  **`SQUAD_GITHUB_TOKEN`**, and **`SQUAD_REVIEW_APP_PRIVATE_KEY`**
 - Action: **`bradygaster/squad/.github/actions/squad-init`**
 <!-- allowlist-end -->
 
-> **These are referenced names, not prerequisites.** `gh aw add` lists the secrets
-> the workflows *reference* so you can approve that surface — it is not asking you
-> to supply them. Both secrets are optional, they need not exist, and neither is
-> required to enlist a repository. Single-repo activation runs on the built-in
-> `github.token`. Configure them only for cross-repo access or elevated
-> permissions. Auth precedence: GitHub App token, then the PAT, then
-> `github.token`. Never block an enlistment waiting for a credential.
+> **Compilation approval is not credential provisioning.** `gh aw add` lists
+> referenced names so you can approve the surface. `SQUAD_GITHUB_APP_PRIVATE_KEY`
+> and `SQUAD_GITHUB_TOKEN` remain optional activation credentials.
+> `SQUAD_REVIEW_APP_PRIVATE_KEY` is different: trusted check publication requires
+> it in the exact-default-branch `squad-review-authority` environment. Never put
+> reviewer credentials at repository scope and never fall back to `github.token`.
 
 If — and only if — the report contains exactly those documented entries, complete
 the one-time approval:
@@ -284,7 +284,27 @@ gh pr checks --watch
   `main`.
 - Request Copilot review, address feedback, and wait for required checks.
 
-### 9. Never auto-merge — and explain what comes next
+### 9. Verify the external review-authority prerequisite when API access permits
+
+Before claiming trusted review is ready, query the repository environment. It
+must be named `squad-review-authority`, use custom deployment branch policies,
+allow exactly the captured `${default_branch}`, contain the environment secret
+`SQUAD_REVIEW_APP_PRIVATE_KEY`, and define environment variables
+`SQUAD_REVIEW_APP_ID`, `SQUAD_REVIEW_APP_SLUG`, and
+`SQUAD_REVIEW_APP_OWNER`. The App ID/slug must differ from
+`15368`/`github-actions`. All four reviewer-specific names must also be absent
+from repository-level Actions secrets and variables; repository fallback does
+not satisfy this gate.
+
+If the authenticated account cannot read environment configuration, or any
+requirement is absent, report the exact external prerequisite and do not claim
+the required check is trusted. The installation PR remains a human boundary;
+after it merges, the Cast canary intentionally fails closed until an
+administrator provisions the environment and reruns the base-controlled
+review. Configure a ruleset only from the canary check's observed App
+integration ID, never from user input or a guessed value.
+
+### 10. Never auto-merge — and explain what comes next
 
 - **Never** merge the bootstrap PR yourself. Merge happens **only** after human
   approval.
@@ -346,8 +366,9 @@ gh pr edit --add-reviewer @copilot   # then wait for review + checks; DO NOT mer
 ### ✓ Correct: STOP on an undocumented safe-update entry
 
 ```text
-gh aw add reports a third secret: `ACME_DEPLOY_KEY`.
-→ This is NOT in the allowlist (SQUAD_GITHUB_APP_PRIVATE_KEY, SQUAD_GITHUB_TOKEN)
+gh aw add reports an additional secret: `ACME_DEPLOY_KEY`.
+→ This is NOT in the allowlist (SQUAD_GITHUB_APP_PRIVATE_KEY, SQUAD_GITHUB_TOKEN,
+  SQUAD_REVIEW_APP_PRIVATE_KEY)
   and is NOT the squad-init action. Do NOT run `--approve`.
   Halt, report "unexpected safe-update entry: ACME_DEPLOY_KEY", and wait.
 ```
@@ -381,7 +402,8 @@ gh pr merge --squash                # auto-merge before human review. NEVER.
 - ❌ **Blanket staging** (`git add .` / `-A` / `git commit -a`). Stage only
   `.gitattributes`, `.github/aw/`, `.github/workflows/`, `.github/s
```

**File**: `docs/src/content/docs/guide/gh-aw.md` (modified, +124/-39)
```diff
@@ -103,6 +103,23 @@ skill as one update unit. For an upgrade, resolve or select one reviewed commit
 and reinstall that same package as described in
 [Upgrading the workflows](#upgrading-the-workflows).
 
+The bootstrap installation PR is an explicit human trust boundary. Because its
+base branch does not yet contain the Squad review guard and manifest, no job,
+check name, review comment, or workflow code introduced by that PR is accepted
+as a trusted Squad verdict. The canonical workflow reports
+`First-install manual boundary`, emits no `Squad-Review-Verdict:` record, and
+requires a human to review the verifier/compile evidence before merging.
+
+After merge, the default-branch bootstrap workflow opens the draft Cast PR.
+That PR is the activation canary: `Squad Review / review` must succeed using the
+base-controlled `pull_request_target` workflow plus the guard and manifest
+checked out from the Cast PR's exact base commit. The guard
+also requires matching exact-head provenance in the PR body and a durable
+GitHub Actions bot comment, so editable PR prose cannot rebind an old bootstrap
+run to a changed branch head. Only after that base-controlled canary succeeds
+should the Cast/bootstrap lifecycle be treated as trusted. Do not enable the
+required check in a ruleset before this post-install canary has been observed.
+
 Step 2 deliberately checks Issues before creating the bootstrap branch or
 installing any workflow. Squad commands are issue comments, and the merged
 bootstrap creates a research/proposals issue; without Issues, the installation
@@ -281,17 +298,21 @@ source/lock pairs, and one coherent 40-character revision.
 
 On a clean repository, `gh aw add` reports these expected safe-update changes:
 
-- Restricted secrets: `SQUAD_GITHUB_APP_PRIVATE_KEY` and `SQUAD_GITHUB_TOKEN`
+- Restricted secrets: `SQUAD_GITHUB_APP_PRIVATE_KEY`, `SQUAD_GITHUB_TOKEN`, and
+  `SQUAD_REVIEW_APP_PRIVATE_KEY`
 - Action: `bradygaster/squad/.github/actions/squad-init`
 
 > **These are referenced names, not prerequisites.** `gh aw add` lists the secrets
 > the workflows *reference* so you can approve that surface — it is not asking you
-> to supply them. Both secrets are optional, they need not exist, and you do not
-> need to create either one to enlist a repository. Single-repo activation runs on
-> the built-in `github.token`. Configure these only for cross-repo access or
+> to supply them during compilation. `SQUAD_GITHUB_APP_PRIVATE_KEY` and
+> `SQUAD_GITHUB_TOKEN` remain optional activation credentials; single-repo
+> activation can use the built-in `github.token`. Configure those only for cross-repo access or
 > elevated permissions — see [enhanced permissions with a GitHub
 > App](#optional-enhanced-permissions-with-a-github-app) and [PAT
-> fallback](#optional-pat-fallback).
+> fallback](#optional-pat-fallback). `SQUAD_REVIEW_APP_PRIVATE_KEY` is different:
+> it belongs only in the branch-restricted `squad-review-authority` environment
+> described below. Trusted required-check publication intentionally fails closed
+> until that external prerequisite is provisioned.
 
 Review the report before approving it. If it contains only those documented
 entries, complete the first-install approval with:
@@ -415,6 +436,47 @@ a Personal Access Token:
 
 **Auth precedence:** GitHub App token → `SQUAD_GITHUB_TOKEN` → `github.token`.
 
+### Required: dedicated review authority App
+
+The required `Squad Review / review` check must not use `github.token`.
+`github.token` checks are owned by the shared GitHub Actions App
+(`id: 15368`, slug: `github-actions`), which is also available to ordinary
+same-repository PR workflows. The reviewer instead mints a short-lived token
+for a dedicated GitHub App inside a protected environment and has no fallback.
+
+Before expecting the post-install Cast canary to pass:
+
+1. Create a dedicated GitHub App with repository **Checks: read and write** and
+   read access to Actions, contents, metadata, a
```

---

### Incident Patch 7: `abb42262` (2026-09-29)
**Commit Message**: fix(ci): align gh-aw compiler pin

Closes #2103

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

**File**: `.github/workflows/squad-ci.yml` (modified, +1/-1)
```diff
@@ -173,7 +173,7 @@ jobs:
         # than skipping — a skipped gate is indistinguishable from no gate. This
         # includes the shell input security contract gate (#1834) and the compile
         # contract (#1732).
-        run: gh extension install --pin v0.87.10 github/gh-aw
+        run: gh extension install --pin v0.89.21 github/gh-aw
         env:
           GH_TOKEN: ${{ github.token }}
       - name: Build
```

**File**: `test/gh-aw-quality.test.ts` (modified, +10/-64)
```diff
@@ -27,6 +27,7 @@ import {
 import {
   CONTRACT_DESTINATION,
   CONTRACT_SOURCE,
+  MIN_GH_AW_VERSION,
   OWNERSHIP_ENTRY_COUNT,
   PACKAGE_NAME,
   RUNTIME_TUPLES,
@@ -3630,21 +3631,9 @@ describe('gh-aw: canonical package integrity contract', () => {
   });
 
   it('normalizes only compiler-declared repository-scattered schedules', () => {
-    const setupPin = '924af5fdc64061cfbf66fb584c8b07e2ac230c60';
-    const metadata = `# gh-aw-metadata: ${JSON.stringify({
-      frontmatter_hash: 'a'.repeat(64),
-      compiler_version: 'v0.89.21',
-    })}`;
+    const metadata = `# gh-aw-metadata: {"frontmatter_hash":"${'a'.repeat(64)}"}`;
     const lock = [
       metadata,
-      `# gh-aw-manifest: ${JSON.stringify({
-        actions: [{
-          repo: 'github/gh-aw-actions/setup',
-          sha: setupPin,
-          version: 'v0.89.21',
-        }],
-      })}`,
-      `uses: github/gh-aw-actions/setup@${setupPin}`,
       `source_revision: ${revisionA}`,
       '      - cron: "17 4 * * 2" # Friendly format: weekly on Tuesday at 04:00 (scattered)',
       '      - cron: "0 4 * * 2" # Fixed schedule',
@@ -3658,57 +3647,14 @@ describe('gh-aw: canonical package integrity contract', () => {
     expect(normalized).not.toContain(revisionA);
   });
 
-  it('normalizes only the approved gh-aw setup tag to its exact compiler pin', () => {
-    const setupPin = '924af5fdc64061cfbf66fb584c8b07e2ac230c60';
-    const compiled = (setupRef: string, permissions = 'checks: read') => [
-      `# gh-aw-metadata: ${JSON.stringify({
-        schema_version: 'v4',
-        frontmatter_hash: 'a'.repeat(64),
-        body_hash: 'b'.repeat(64),
-        compiler_version: 'v0.89.21',
-        strict: true,
-      })}`,
-      `# gh-aw-manifest: ${JSON.stringify({
-        version: 1,
-        secrets: ['SQUAD_REVIEW_APP_PRIVATE_KEY'],
-        actions: [{
-          repo: 'github/gh-aw-actions/setup',
-          sha: setupRef,
-          version: 'v0.89.21',
-        }],
-      })}`,
-      `#   - github/gh-aw-actions/setup@${setupRef}${setupRef === setupPin ? ' # v0.89.21' : ''}`,
-      `source_revision: ${revisionA}`,
-      'permissions:',
-      `  ${permissions}`,
-      'environment: squad-review-authority',
-      'github-token: ${{ steps.squad-review-app-token.outputs.token }}',
-      `uses: github/gh-aw-actions/setup@${setupRef}${setupRef === setupPin ? ' # v0.89.21' : ''}`,
-    ].join('\n');
-    const macOS = normalizeCompiledLock(compiled(setupPin), revisionA);
-    const linux = normalizeCompiledLock(compiled('v0.89.21'), revisionA);
-
-    expect(linux).toBe(macOS);
-    expect(linux).toContain(`github/gh-aw-actions/setup@${setupPin}`);
-    expect(linux).not.toContain('github/gh-aw-actions/setup@v0.89.21');
-    expect(() => normalizeCompiledLock(compiled('c'.repeat(40)), revisionA))
-      .toThrow(/approved compiler pin/);
-    expect(normalizeCompiledLock(compiled(setupPin, 'checks: write'), revisionA))
-      .not.toBe(macOS);
-    expect(normalizeCompiledLock(
-      compiled(setupPin).replace(
-        'environment: squad-review-authority',
-        'environment: unrestricted',
-      ),
-      revisionA,
-    )).not.toBe(macOS);
-    expect(normalizeCompiledLock(
-      compiled(setupPin).replace(
-        'github-token: ${{ steps.squad-review-app-token.outputs.token }}',
-        'github-token: ${{ github.token }}',
-      ),
-      revisionA,
-    )).not.toBe(macOS);
+  it('pins every CI compiler install to the package minimum gh-aw version', () => {
+    const ci = readText(join(process.cwd(), '.github/workflows/squad-ci.yml'));
+    const pins = [...ci.matchAll(
+      /gh extension install(?: --force)? --pin (v[0-9.]+) github\/gh-aw/g,
+    )].map(match => match[1]);
+
+    expect(pins).toHaveLength(2);
+    expect(new Set(pins)).toEqual(new Set([MIN_GH_AW_VERSION]));
   });
 
   it('accepts only the deterministic retained bootstrap trigger sentinel', () => {
```

**File**: `workflows/package/squad-bootstrap.md` (modified, +1/-1)
```diff
@@ -151,7 +151,7 @@ pre-agent-steps:
         node --check "$path" >/dev/null
       }
       # BEGIN GENERATED RESOURCE DIGESTS
-      check_hash "$install_verifier" "09f806f17c7ff2ddd207484a536e13f41071c4ed584ab37be415755979bec1c4"
+      check_hash "$install_verifier" "4f385df488cc65165e398e499663c015ce63851cb9c938f4c3dd0af38d25f991"
       check_hash "$cast_validator" "0988e04aeef316f4d7a0107c902bbbcf6538b8899b9fffba5f62150717967685"
       check_hash "$bootstrap_validator" "d449b9204f7fad133ff7133c1a30c9381c87e3c0c9d481352819ca93ea1a1dad"
       # END GENERATED RESOURCE DIGESTS
```

**File**: `workflows/shared/squad-install-verifier.mjs` (modified, +0/-41)
```diff
@@ -33,9 +33,6 @@ export const TRIGGER_PROBE_DESTINATION =
 const SHA256_PATTERN = /^[0-9a-f]{64}$/;
 const REVISION_PATTERN = /^[0-9a-f]{40}$/;
 const LOCK_REVISION_PLACEHOLDER = 'f'.repeat(40);
-const GH_AW_SETUP_PINS = Object.freeze({
-  'v0.89.21': '924af5fdc64061cfbf66fb584c8b07e2ac230c60',
-});
 
 function deepFreeze(value) {
   if (value && typeof value === 'object' && !Object.isFrozen(value)) {
@@ -351,46 +348,8 @@ export function normalizeCompiledLock(content, revision) {
     /^(# gh-aw-metadata: \{[^\n]*"frontmatter_hash":")([0-9a-f]{64})("[^\n]*\})$/m,
   );
   if (!metadata) throw new Error('Compiled lock has missing or malformed gh-aw metadata.');
-  const compilerVersion = JSON.parse(metadata[0].slice('# gh-aw-metadata: '.length))
-    .compiler_version;
-  const setupPin = GH_AW_SETUP_PINS[compilerVersion];
-  if (!setupPin) {
-    throw new Error(`Compiled lock uses unsupported gh-aw compiler version: ${compilerVersion}.`);
-  }
-  const manifest = text.match(/^(# gh-aw-manifest: )(\{[^\n]*\})$/m);
-  if (!manifest) throw new Error('Compiled lock has missing or malformed gh-aw manifest.');
-  const manifestValue = JSON.parse(manifest[2]);
-  const setupActions = manifestValue.actions?.filter(
-    action => action.repo === 'github/gh-aw-actions/setup',
-  ) ?? [];
-  if (setupActions.length !== 1) {
-    throw new Error('Compiled lock must declare exactly one gh-aw setup action.');
-  }
-  const setupAction = setupActions[0];
-  if (setupAction.version !== compilerVersion) {
-    throw new Error('Compiled lock gh-aw setup action version does not match its compiler.');
-  }
-  if (![compilerVersion, setupPin].includes(setupAction.sha)) {
-    throw new Error('Compiled lock gh-aw setup action does not match the approved compiler pin.');
-  }
-  setupAction.sha = setupPin;
-  const setupRefs = [
-    ...text.matchAll(/github\/gh-aw-actions\/setup@([^\s#'"]+)/g),
-  ].map(match => match[1]);
-  if (setupRefs.some(ref => ![compilerVersion, setupPin].includes(ref))) {
-    throw new Error('Compiled lock contains an unapproved gh-aw setup action reference.');
-  }
   return text
     .replace(metadata[0], `${metadata[1]}${'0'.repeat(64)}${metadata[3]}`)
-    .replace(manifest[0], `${manifest[1]}${JSON.stringify(manifestValue)}`)
-    .replaceAll(
-      `github/gh-aw-actions/setup@${compilerVersion}`,
-      `github/gh-aw-actions/setup@${setupPin}`,
-    )
-    .replaceAll(
-      `github/gh-aw-actions/setup@${setupPin} # ${compilerVersion}`,
-      `github/gh-aw-actions/setup@${setupPin}`,
-    )
     .replace(
       /^(\s*-\s+cron:\s+)"[^"]+"(\s+# Friendly format: .+ \(scattered\))$/gm,
       '$1"<repository-scattered>"$2',
```

**File**: `workflows/squad-bootstrap.md` (modified, +1/-1)
```diff
@@ -158,7 +158,7 @@ pre-agent-steps:
         node --check "$path" >/dev/null
       }
       # BEGIN GENERATED RESOURCE DIGESTS
-      check_hash "$install_verifier" "09f806f17c7ff2ddd207484a536e13f41071c4ed584ab37be415755979bec1c4"
+      check_hash "$install_verifier" "4f385df488cc65165e398e499663c015ce63851cb9c938f4c3dd0af38d25f991"
       check_hash "$cast_validator" "0988e04aeef316f4d7a0107c902bbbcf6538b8899b9fffba5f62150717967685"
       check_hash "$bootstrap_validator" "d449b9204f7fad133ff7133c1a30c9381c87e3c0c9d481352819ca93ea1a1dad"
       # END GENERATED RESOURCE DIGESTS
```

---

### Incident Patch 8: `f88755cc` (2026-09-29)
**Commit Message**: fix(gh-aw): normalize compiler setup pin

Closes #2103

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

**File**: `test/gh-aw-quality.test.ts` (modified, +66/-1)
```diff
@@ -3630,9 +3630,21 @@ describe('gh-aw: canonical package integrity contract', () => {
   });
 
   it('normalizes only compiler-declared repository-scattered schedules', () => {
-    const metadata = `# gh-aw-metadata: {"frontmatter_hash":"${'a'.repeat(64)}"}`;
+    const setupPin = '924af5fdc64061cfbf66fb584c8b07e2ac230c60';
+    const metadata = `# gh-aw-metadata: ${JSON.stringify({
+      frontmatter_hash: 'a'.repeat(64),
+      compiler_version: 'v0.89.21',
+    })}`;
     const lock = [
       metadata,
+      `# gh-aw-manifest: ${JSON.stringify({
+        actions: [{
+          repo: 'github/gh-aw-actions/setup',
+          sha: setupPin,
+          version: 'v0.89.21',
+        }],
+      })}`,
+      `uses: github/gh-aw-actions/setup@${setupPin}`,
       `source_revision: ${revisionA}`,
       '      - cron: "17 4 * * 2" # Friendly format: weekly on Tuesday at 04:00 (scattered)',
       '      - cron: "0 4 * * 2" # Fixed schedule',
@@ -3646,6 +3658,59 @@ describe('gh-aw: canonical package integrity contract', () => {
     expect(normalized).not.toContain(revisionA);
   });
 
+  it('normalizes only the approved gh-aw setup tag to its exact compiler pin', () => {
+    const setupPin = '924af5fdc64061cfbf66fb584c8b07e2ac230c60';
+    const compiled = (setupRef: string, permissions = 'checks: read') => [
+      `# gh-aw-metadata: ${JSON.stringify({
+        schema_version: 'v4',
+        frontmatter_hash: 'a'.repeat(64),
+        body_hash: 'b'.repeat(64),
+        compiler_version: 'v0.89.21',
+        strict: true,
+      })}`,
+      `# gh-aw-manifest: ${JSON.stringify({
+        version: 1,
+        secrets: ['SQUAD_REVIEW_APP_PRIVATE_KEY'],
+        actions: [{
+          repo: 'github/gh-aw-actions/setup',
+          sha: setupRef,
+          version: 'v0.89.21',
+        }],
+      })}`,
+      `#   - github/gh-aw-actions/setup@${setupRef}${setupRef === setupPin ? ' # v0.89.21' : ''}`,
+      `source_revision: ${revisionA}`,
+      'permissions:',
+      `  ${permissions}`,
+      'environment: squad-review-authority',
+      'github-token: ${{ steps.squad-review-app-token.outputs.token }}',
+      `uses: github/gh-aw-actions/setup@${setupRef}${setupRef === setupPin ? ' # v0.89.21' : ''}`,
+    ].join('\n');
+    const macOS = normalizeCompiledLock(compiled(setupPin), revisionA);
+    const linux = normalizeCompiledLock(compiled('v0.89.21'), revisionA);
+
+    expect(linux).toBe(macOS);
+    expect(linux).toContain(`github/gh-aw-actions/setup@${setupPin}`);
+    expect(linux).not.toContain('github/gh-aw-actions/setup@v0.89.21');
+    expect(() => normalizeCompiledLock(compiled('c'.repeat(40)), revisionA))
+      .toThrow(/approved compiler pin/);
+    expect(normalizeCompiledLock(compiled(setupPin, 'checks: write'), revisionA))
+      .not.toBe(macOS);
+    expect(normalizeCompiledLock(
+      compiled(setupPin).replace(
+        'environment: squad-review-authority',
+        'environment: unrestricted',
+      ),
+      revisionA,
+    )).not.toBe(macOS);
+    expect(normalizeCompiledLock(
+      compiled(setupPin).replace(
+        'github-token: ${{ steps.squad-review-app-token.outputs.token }}',
+        'github-token: ${{ github.token }}',
+      ),
+      revisionA,
+    )).not.toBe(macOS);
+  });
+
   it('accepts only the deterministic retained bootstrap trigger sentinel', () => {
     const root = makeConsumer();
     const probePath = join(root, TRIGGER_PROBE_DESTINATION);
```

**File**: `workflows/package/squad-bootstrap.md` (modified, +1/-1)
```diff
@@ -151,7 +151,7 @@ pre-agent-steps:
         node --check "$path" >/dev/null
       }
       # BEGIN GENERATED RESOURCE DIGESTS
-      check_hash "$install_verifier" "4f385df488cc65165e398e499663c015ce63851cb9c938f4c3dd0af38d25f991"
+      check_hash "$install_verifier" "09f806f17c7ff2ddd207484a536e13f41071c4ed584ab37be415755979bec1c4"
       check_hash "$cast_validator" "0988e04aeef316f4d7a0107c902bbbcf6538b8899b9fffba5f62150717967685"
       check_hash "$bootstrap_validator" "d449b9204f7fad133ff7133c1a30c9381c87e3c0c9d481352819ca93ea1a1dad"
       # END GENERATED RESOURCE DIGESTS
```

**File**: `workflows/shared/squad-install-verifier.mjs` (modified, +41/-0)
```diff
@@ -33,6 +33,9 @@ export const TRIGGER_PROBE_DESTINATION =
 const SHA256_PATTERN = /^[0-9a-f]{64}$/;
 const REVISION_PATTERN = /^[0-9a-f]{40}$/;
 const LOCK_REVISION_PLACEHOLDER = 'f'.repeat(40);
+const GH_AW_SETUP_PINS = Object.freeze({
+  'v0.89.21': '924af5fdc64061cfbf66fb584c8b07e2ac230c60',
+});
 
 function deepFreeze(value) {
   if (value && typeof value === 'object' && !Object.isFrozen(value)) {
@@ -348,8 +351,46 @@ export function normalizeCompiledLock(content, revision) {
     /^(# gh-aw-metadata: \{[^\n]*"frontmatter_hash":")([0-9a-f]{64})("[^\n]*\})$/m,
   );
   if (!metadata) throw new Error('Compiled lock has missing or malformed gh-aw metadata.');
+  const compilerVersion = JSON.parse(metadata[0].slice('# gh-aw-metadata: '.length))
+    .compiler_version;
+  const setupPin = GH_AW_SETUP_PINS[compilerVersion];
+  if (!setupPin) {
+    throw new Error(`Compiled lock uses unsupported gh-aw compiler version: ${compilerVersion}.`);
+  }
+  const manifest = text.match(/^(# gh-aw-manifest: )(\{[^\n]*\})$/m);
+  if (!manifest) throw new Error('Compiled lock has missing or malformed gh-aw manifest.');
+  const manifestValue = JSON.parse(manifest[2]);
+  const setupActions = manifestValue.actions?.filter(
+    action => action.repo === 'github/gh-aw-actions/setup',
+  ) ?? [];
+  if (setupActions.length !== 1) {
+    throw new Error('Compiled lock must declare exactly one gh-aw setup action.');
+  }
+  const setupAction = setupActions[0];
+  if (setupAction.version !== compilerVersion) {
+    throw new Error('Compiled lock gh-aw setup action version does not match its compiler.');
+  }
+  if (![compilerVersion, setupPin].includes(setupAction.sha)) {
+    throw new Error('Compiled lock gh-aw setup action does not match the approved compiler pin.');
+  }
+  setupAction.sha = setupPin;
+  const setupRefs = [
+    ...text.matchAll(/github\/gh-aw-actions\/setup@([^\s#'"]+)/g),
+  ].map(match => match[1]);
+  if (setupRefs.some(ref => ![compilerVersion, setupPin].includes(ref))) {
+    throw new Error('Compiled lock contains an unapproved gh-aw setup action reference.');
+  }
   return text
     .replace(metadata[0], `${metadata[1]}${'0'.repeat(64)}${metadata[3]}`)
+    .replace(manifest[0], `${manifest[1]}${JSON.stringify(manifestValue)}`)
+    .replaceAll(
+      `github/gh-aw-actions/setup@${compilerVersion}`,
+      `github/gh-aw-actions/setup@${setupPin}`,
+    )
+    .replaceAll(
+      `github/gh-aw-actions/setup@${setupPin} # ${compilerVersion}`,
+      `github/gh-aw-actions/setup@${setupPin}`,
+    )
     .replace(
       /^(\s*-\s+cron:\s+)"[^"]+"(\s+# Friendly format: .+ \(scattered\))$/gm,
       '$1"<repository-scattered>"$2',
```

**File**: `workflows/squad-bootstrap.md` (modified, +1/-1)
```diff
@@ -158,7 +158,7 @@ pre-agent-steps:
         node --check "$path" >/dev/null
       }
       # BEGIN GENERATED RESOURCE DIGESTS
-      check_hash "$install_verifier" "4f385df488cc65165e398e499663c015ce63851cb9c938f4c3dd0af38d25f991"
+      check_hash "$install_verifier" "09f806f17c7ff2ddd207484a536e13f41071c4ed584ab37be415755979bec1c4"
       check_hash "$cast_validator" "0988e04aeef316f4d7a0107c902bbbcf6538b8899b9fffba5f62150717967685"
       check_hash "$bootstrap_validator" "d449b9204f7fad133ff7133c1a30c9381c87e3c0c9d481352819ca93ea1a1dad"
       # END GENERATED RESOURCE DIGESTS
```

**File**: `workflows/squad-workflows.manifest.json` (modified, +10/-10)
```diff
@@ -15,63 +15,63 @@
       "destination": ".github/workflows/squad.md",
       "lock": ".github/workflows/squad.lock.yml",
       "source_sha256": "bb7f231c852dfb73c5d1a6ba5e9f23f9f7c9fc5af9e1f1021c4c5213fd9389f9",
-      "lock_sha256": "f2e62f0ded2b937c99dcdab321f1ea2f886ff2f0537a324af4342908466a2bcf"
+      "lock_sha256": "98b174e188340159ee581b02cf6463d5a0e3ad60ad16c0c59a53133e3ca65b3d"
     },
     {
       "name": "squad-implement-worker",
       "source": "workflows/package/squad-implement-worker.md",
       "destination": ".github/workflows/squad-implement-worker.md",
       "lock": ".github/workflows/squad-implement-worker.lock.yml",
       "source_sha256": "ae710dd5c89360af540576dac378a0d0df129cce5a9bbf16f0615dfd86d0b21c",
-      "lock_sha256": "d6d2fa7f2bac5845c414cf42a9ea565d3663dba23d9208942fe142fca6b23bc3"
+      "lock_sha256": "ff1d336b2ee99a51c7b7f1b87dcc03dbcaec069cde5fc962f1da30189a99f9d6"
     },
     {
       "name": "squad-review",
       "source": "workflows/package/squad-review.md",
       "destination": ".github/workflows/squad-review.md",
       "lock": ".github/workflows/squad-review.lock.yml",
       "source_sha256": "27adf384cbe16c11ec89f4ecd76c9087a409c911ab9760575a3254b1d21dfb56",
-      "lock_sha256": "c3ed91988744077da65cbbc8a77a6d262bf4dca3bbfc593ab520283c3e9ced6b"
+      "lock_sha256": "a29203c21a6af2c9ce4dbf838a8d61f0fe39f9d6fe08b371d54167c2f74177a4"
     },
     {
       "name": "squad-deps-worker",
       "source": "workflows/package/squad-deps-worker.md",
       "destination": ".github/workflows/squad-deps-worker.md",
       "lock": ".github/workflows/squad-deps-worker.lock.yml",
       "source_sha256": "37c4ba60b85c5fc07bef322bbfd0f713472924d55cff9481ae76af7ec0c91fac",
-      "lock_sha256": "d5a8c0b1eb7933bb4bb74499fd9de872b6d55045665f918c831658f8baa20f71"
+      "lock_sha256": "858c9247b26ff786cca81052ff3c6bb18168e8fb50cd72e8b0e5c4b42bfd38ad"
     },
     {
       "name": "squad-retro",
       "source": "workflows/package/squad-retro.md",
       "destination": ".github/workflows/squad-retro.md",
       "lock": ".github/workflows/squad-retro.lock.yml",
       "source_sha256": "92bcfa39cc5fd3087b11612125e314959237c5b79460825453d1e493727a2562",
-      "lock_sha256": "00771decb93b93d04ea9c9e6173c2338eef615e49df0a8ca12729680fa15fc52"
+      "lock_sha256": "03f31bf1cbe276c686ae7899307180b2231e1c0ff25edd1afc40151ec29c105d"
     },
     {
       "name": "squad-improvement-worker",
       "source": "workflows/package/squad-improvement-worker.md",
       "destination": ".github/workflows/squad-improvement-worker.md",
       "lock": ".github/workflows/squad-improvement-worker.lock.yml",
       "source_sha256": "01c89f8890f02c0ca884513aa10225787feaf3606ab604d5c0e85fbbccdb6c95",
-      "lock_sha256": "880b7673b022d6155870d87b70e6d6a2489eb7eefec64fcf3515041d5ca5c42e"
+      "lock_sha256": "583d505966d9591088c7a482f08d23c410b0c1e6bbf7396ae871c0a87c8ecba6"
     },
     {
       "name": "squad-bootstrap",
       "source": "workflows/package/squad-bootstrap.md",
       "destination": ".github/workflows/squad-bootstrap.md",
       "lock": ".github/workflows/squad-bootstrap.lock.yml",
-      "source_sha256": "9df28d8e4094b66e7ddf4aed1ff3626efaa65c1dcd3815984d70573b40af640d",
-      "lock_sha256": "9a23ee0bd51cd7dd69b91538872a3fce0fb2376423ce8ac56c7c9f6f5b7f4b1b"
+      "source_sha256": "de21c6e2baed831a573596d85e2ccdd70a28fe5b1fe275797055c44609a999d0",
+      "lock_sha256": "b46648d07dae93a51958349a052f85c900eb50075d1c0bbf841234493af93112"
     },
     {
       "name": "squad-command-router",
       "source": "workflows/package/squad-command-router.md",
       "destination": ".github/workflows/squad-command-router.md",
       "lock": ".github/workflows/squad-command-router.lock.yml",
       "source_sha256": "cbce466a6cfe64c194b17672ea3363fe7c22cb6b4258c195cc93a2d294d0bf88",
-      "lock_sha256": "9c5bf2b28dc82a575c528ce73a75c38b54129d512341e10cdce2a6e12ceecb4b"
+      "lock_sha256": "bb604c0fd7d061e37a5ac9bf
```

---

### Incident Patch 9: `b34f9523` (2026-09-29)
**Commit Message**: fix(gh-aw): dedicate review check identity

Part of #2103

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

**File**: `.github/agents.md` (modified, +4/-1)
```diff
@@ -37,7 +37,10 @@ GitHub Agentic Workflows (`gh-aw`) are composable AI workflows triggered by slas
 > cannot mint a trusted Squad verdict. After merge, require the automatically
 > opened Cast PR to pass the exact-head `Squad Review / review` attestation from
 > the base-controlled `pull_request_target` authority before treating bootstrap
-> or lifecycle automation as trusted.
+> or lifecycle automation as trusted. That check must be published by a
+> dedicated GitHub App token minted only inside the exact-default-branch
+> `squad-review-authority` environment. Missing or misconfigured reviewer
+> credentials fail closed; the workflow never falls back to `github.token`.
 
 The quick start installs this workflow set:
 
```

**File**: `.squad-templates/skills/gh-aw-enlistment/SKILL.md` (modified, +34/-12)
```diff
@@ -182,17 +182,17 @@ uses a moving branch reference.
 On a clean repo, `gh aw add` reports these expected safe updates and **nothing else**:
 
 <!-- allowlist-start -->
-- Restricted secrets: **`SQUAD_GITHUB_APP_PRIVATE_KEY`** and **`SQUAD_GITHUB_TOKEN`**
+- Restricted secrets: **`SQUAD_GITHUB_APP_PRIVATE_KEY`**,
+  **`SQUAD_GITHUB_TOKEN`**, and **`SQUAD_REVIEW_APP_PRIVATE_KEY`**
 - Action: **`bradygaster/squad/.github/actions/squad-init`**
 <!-- allowlist-end -->
 
-> **These are referenced names, not prerequisites.** `gh aw add` lists the secrets
-> the workflows *reference* so you can approve that surface — it is not asking you
-> to supply them. Both secrets are optional, they need not exist, and neither is
-> required to enlist a repository. Single-repo activation runs on the built-in
-> `github.token`. Configure them only for cross-repo access or elevated
-> permissions. Auth precedence: GitHub App token, then the PAT, then
-> `github.token`. Never block an enlistment waiting for a credential.
+> **Compilation approval is not credential provisioning.** `gh aw add` lists
+> referenced names so you can approve the surface. `SQUAD_GITHUB_APP_PRIVATE_KEY`
+> and `SQUAD_GITHUB_TOKEN` remain optional activation credentials.
+> `SQUAD_REVIEW_APP_PRIVATE_KEY` is different: trusted check publication requires
+> it in the exact-default-branch `squad-review-authority` environment. Never put
+> reviewer credentials at repository scope and never fall back to `github.token`.
 
 If — and only if — the report contains exactly those documented entries, complete
 the one-time approval:
@@ -284,7 +284,27 @@ gh pr checks --watch
   `main`.
 - Request Copilot review, address feedback, and wait for required checks.
 
-### 9. Never auto-merge — and explain what comes next
+### 9. Verify the external review-authority prerequisite when API access permits
+
+Before claiming trusted review is ready, query the repository environment. It
+must be named `squad-review-authority`, use custom deployment branch policies,
+allow exactly the captured `${default_branch}`, contain the environment secret
+`SQUAD_REVIEW_APP_PRIVATE_KEY`, and define environment variables
+`SQUAD_REVIEW_APP_ID`, `SQUAD_REVIEW_APP_SLUG`, and
+`SQUAD_REVIEW_APP_OWNER`. The App ID/slug must differ from
+`15368`/`github-actions`. All four reviewer-specific names must also be absent
+from repository-level Actions secrets and variables; repository fallback does
+not satisfy this gate.
+
+If the authenticated account cannot read environment configuration, or any
+requirement is absent, report the exact external prerequisite and do not claim
+the required check is trusted. The installation PR remains a human boundary;
+after it merges, the Cast canary intentionally fails closed until an
+administrator provisions the environment and reruns the base-controlled
+review. Configure a ruleset only from the canary check's observed App
+integration ID, never from user input or a guessed value.
+
+### 10. Never auto-merge — and explain what comes next
 
 - **Never** merge the bootstrap PR yourself. Merge happens **only** after human
   approval.
@@ -346,8 +366,9 @@ gh pr edit --add-reviewer @copilot   # then wait for review + checks; DO NOT mer
 ### ✓ Correct: STOP on an undocumented safe-update entry
 
 ```text
-gh aw add reports a third secret: `ACME_DEPLOY_KEY`.
-→ This is NOT in the allowlist (SQUAD_GITHUB_APP_PRIVATE_KEY, SQUAD_GITHUB_TOKEN)
+gh aw add reports an additional secret: `ACME_DEPLOY_KEY`.
+→ This is NOT in the allowlist (SQUAD_GITHUB_APP_PRIVATE_KEY, SQUAD_GITHUB_TOKEN,
+  SQUAD_REVIEW_APP_PRIVATE_KEY)
   and is NOT the squad-init action. Do NOT run `--approve`.
   Halt, report "unexpected safe-update entry: ACME_DEPLOY_KEY", and wait.
 ```
@@ -381,7 +402,8 @@ gh pr merge --squash                # auto-merge before human review. NEVER.
 - ❌ **Blanket staging** (`git add .` / `-A` / `git commit -a`). Stage only
   `.gitattributes`, `.github/aw/`, `.github/workflows/`, `.github/s
```

**File**: `docs/src/content/docs/guide/gh-aw.md` (modified, +59/-8)
```diff
@@ -298,17 +298,21 @@ source/lock pairs, and one coherent 40-character revision.
 
 On a clean repository, `gh aw add` reports these expected safe-update changes:
 
-- Restricted secrets: `SQUAD_GITHUB_APP_PRIVATE_KEY` and `SQUAD_GITHUB_TOKEN`
+- Restricted secrets: `SQUAD_GITHUB_APP_PRIVATE_KEY`, `SQUAD_GITHUB_TOKEN`, and
+  `SQUAD_REVIEW_APP_PRIVATE_KEY`
 - Action: `bradygaster/squad/.github/actions/squad-init`
 
 > **These are referenced names, not prerequisites.** `gh aw add` lists the secrets
 > the workflows *reference* so you can approve that surface — it is not asking you
-> to supply them. Both secrets are optional, they need not exist, and you do not
-> need to create either one to enlist a repository. Single-repo activation runs on
-> the built-in `github.token`. Configure these only for cross-repo access or
+> to supply them during compilation. `SQUAD_GITHUB_APP_PRIVATE_KEY` and
+> `SQUAD_GITHUB_TOKEN` remain optional activation credentials; single-repo
+> activation can use the built-in `github.token`. Configure those only for cross-repo access or
 > elevated permissions — see [enhanced permissions with a GitHub
 > App](#optional-enhanced-permissions-with-a-github-app) and [PAT
-> fallback](#optional-pat-fallback).
+> fallback](#optional-pat-fallback). `SQUAD_REVIEW_APP_PRIVATE_KEY` is different:
+> it belongs only in the branch-restricted `squad-review-authority` environment
+> described below. Trusted required-check publication intentionally fails closed
+> until that external prerequisite is provisioned.
 
 Review the report before approving it. If it contains only those documented
 entries, complete the first-install approval with:
@@ -432,6 +436,47 @@ a Personal Access Token:
 
 **Auth precedence:** GitHub App token → `SQUAD_GITHUB_TOKEN` → `github.token`.
 
+### Required: dedicated review authority App
+
+The required `Squad Review / review` check must not use `github.token`.
+`github.token` checks are owned by the shared GitHub Actions App
+(`id: 15368`, slug: `github-actions`), which is also available to ordinary
+same-repository PR workflows. The reviewer instead mints a short-lived token
+for a dedicated GitHub App inside a protected environment and has no fallback.
+
+Before expecting the post-install Cast canary to pass:
+
+1. Create a dedicated GitHub App with repository **Checks: read and write** and
+   read access to Actions, contents, metadata, and pull requests. Install it
+   only on the consumer repository.
+2. Create the Actions environment **`squad-review-authority`**.
+3. Configure a custom deployment branch policy containing exactly the
+   repository default branch. Do not allow wildcard, feature, release, tag, or
+   additional branch policies; a PR workflow must not be able to request this
+   environment from its own ref.
+4. Store these reviewer-specific values in that environment, not as
+   repository-level Actions secrets or variables:
+
+   | Setting | Type | Purpose |
+   |---------|------|---------|
+   | `SQUAD_REVIEW_APP_ID` | Variable | Dedicated App numeric ID; must not be `15368` |
+   | `SQUAD_REVIEW_APP_SLUG` | Variable | Dedicated App slug; must not be `github-actions` |
+   | `SQUAD_REVIEW_APP_OWNER` | Variable | Repository owner where the App is installed |
+   | `SQUAD_REVIEW_APP_PRIVATE_KEY` | Secret | Dedicated App private key |
+
+The publisher validates the configured ID and slug, mints an installation token
+inside the environment, publishes with that token, and validates the App
+identity returned by the Checks API. Missing environment protection, missing
+credentials, token-mint failure, Actions App identity, or any ID/slug mismatch
+fails closed. An ordinary `github.token` may create a same-named check owned by
+the Actions App, but it cannot update the dedicated App's check and cannot
+satisfy an integration-bound ruleset.
+
+Before rollout, verify the four reviewer-specific names are absent from
+repository-level Actions secrets and variables. GitHub expressi
```

**File**: `packages/squad-cli/templates/skills/gh-aw-enlistment/SKILL.md` (modified, +34/-12)
```diff
@@ -182,17 +182,17 @@ uses a moving branch reference.
 On a clean repo, `gh aw add` reports these expected safe updates and **nothing else**:
 
 <!-- allowlist-start -->
-- Restricted secrets: **`SQUAD_GITHUB_APP_PRIVATE_KEY`** and **`SQUAD_GITHUB_TOKEN`**
+- Restricted secrets: **`SQUAD_GITHUB_APP_PRIVATE_KEY`**,
+  **`SQUAD_GITHUB_TOKEN`**, and **`SQUAD_REVIEW_APP_PRIVATE_KEY`**
 - Action: **`bradygaster/squad/.github/actions/squad-init`**
 <!-- allowlist-end -->
 
-> **These are referenced names, not prerequisites.** `gh aw add` lists the secrets
-> the workflows *reference* so you can approve that surface — it is not asking you
-> to supply them. Both secrets are optional, they need not exist, and neither is
-> required to enlist a repository. Single-repo activation runs on the built-in
-> `github.token`. Configure them only for cross-repo access or elevated
-> permissions. Auth precedence: GitHub App token, then the PAT, then
-> `github.token`. Never block an enlistment waiting for a credential.
+> **Compilation approval is not credential provisioning.** `gh aw add` lists
+> referenced names so you can approve the surface. `SQUAD_GITHUB_APP_PRIVATE_KEY`
+> and `SQUAD_GITHUB_TOKEN` remain optional activation credentials.
+> `SQUAD_REVIEW_APP_PRIVATE_KEY` is different: trusted check publication requires
+> it in the exact-default-branch `squad-review-authority` environment. Never put
+> reviewer credentials at repository scope and never fall back to `github.token`.
 
 If — and only if — the report contains exactly those documented entries, complete
 the one-time approval:
@@ -284,7 +284,27 @@ gh pr checks --watch
   `main`.
 - Request Copilot review, address feedback, and wait for required checks.
 
-### 9. Never auto-merge — and explain what comes next
+### 9. Verify the external review-authority prerequisite when API access permits
+
+Before claiming trusted review is ready, query the repository environment. It
+must be named `squad-review-authority`, use custom deployment branch policies,
+allow exactly the captured `${default_branch}`, contain the environment secret
+`SQUAD_REVIEW_APP_PRIVATE_KEY`, and define environment variables
+`SQUAD_REVIEW_APP_ID`, `SQUAD_REVIEW_APP_SLUG`, and
+`SQUAD_REVIEW_APP_OWNER`. The App ID/slug must differ from
+`15368`/`github-actions`. All four reviewer-specific names must also be absent
+from repository-level Actions secrets and variables; repository fallback does
+not satisfy this gate.
+
+If the authenticated account cannot read environment configuration, or any
+requirement is absent, report the exact external prerequisite and do not claim
+the required check is trusted. The installation PR remains a human boundary;
+after it merges, the Cast canary intentionally fails closed until an
+administrator provisions the environment and reruns the base-controlled
+review. Configure a ruleset only from the canary check's observed App
+integration ID, never from user input or a guessed value.
+
+### 10. Never auto-merge — and explain what comes next
 
 - **Never** merge the bootstrap PR yourself. Merge happens **only** after human
   approval.
@@ -346,8 +366,9 @@ gh pr edit --add-reviewer @copilot   # then wait for review + checks; DO NOT mer
 ### ✓ Correct: STOP on an undocumented safe-update entry
 
 ```text
-gh aw add reports a third secret: `ACME_DEPLOY_KEY`.
-→ This is NOT in the allowlist (SQUAD_GITHUB_APP_PRIVATE_KEY, SQUAD_GITHUB_TOKEN)
+gh aw add reports an additional secret: `ACME_DEPLOY_KEY`.
+→ This is NOT in the allowlist (SQUAD_GITHUB_APP_PRIVATE_KEY, SQUAD_GITHUB_TOKEN,
+  SQUAD_REVIEW_APP_PRIVATE_KEY)
   and is NOT the squad-init action. Do NOT run `--approve`.
   Halt, report "unexpected safe-update entry: ACME_DEPLOY_KEY", and wait.
 ```
@@ -381,7 +402,8 @@ gh pr merge --squash                # auto-merge before human review. NEVER.
 - ❌ **Blanket staging** (`git add .` / `-A` / `git commit -a`). Stage only
   `.gitattributes`, `.github/aw/`, `.github/workflows/`, `.github/s
```

**File**: `packages/squad-sdk/templates/skills/gh-aw-enlistment/SKILL.md` (modified, +34/-12)
```diff
@@ -182,17 +182,17 @@ uses a moving branch reference.
 On a clean repo, `gh aw add` reports these expected safe updates and **nothing else**:
 
 <!-- allowlist-start -->
-- Restricted secrets: **`SQUAD_GITHUB_APP_PRIVATE_KEY`** and **`SQUAD_GITHUB_TOKEN`**
+- Restricted secrets: **`SQUAD_GITHUB_APP_PRIVATE_KEY`**,
+  **`SQUAD_GITHUB_TOKEN`**, and **`SQUAD_REVIEW_APP_PRIVATE_KEY`**
 - Action: **`bradygaster/squad/.github/actions/squad-init`**
 <!-- allowlist-end -->
 
-> **These are referenced names, not prerequisites.** `gh aw add` lists the secrets
-> the workflows *reference* so you can approve that surface — it is not asking you
-> to supply them. Both secrets are optional, they need not exist, and neither is
-> required to enlist a repository. Single-repo activation runs on the built-in
-> `github.token`. Configure them only for cross-repo access or elevated
-> permissions. Auth precedence: GitHub App token, then the PAT, then
-> `github.token`. Never block an enlistment waiting for a credential.
+> **Compilation approval is not credential provisioning.** `gh aw add` lists
+> referenced names so you can approve the surface. `SQUAD_GITHUB_APP_PRIVATE_KEY`
+> and `SQUAD_GITHUB_TOKEN` remain optional activation credentials.
+> `SQUAD_REVIEW_APP_PRIVATE_KEY` is different: trusted check publication requires
+> it in the exact-default-branch `squad-review-authority` environment. Never put
+> reviewer credentials at repository scope and never fall back to `github.token`.
 
 If — and only if — the report contains exactly those documented entries, complete
 the one-time approval:
@@ -284,7 +284,27 @@ gh pr checks --watch
   `main`.
 - Request Copilot review, address feedback, and wait for required checks.
 
-### 9. Never auto-merge — and explain what comes next
+### 9. Verify the external review-authority prerequisite when API access permits
+
+Before claiming trusted review is ready, query the repository environment. It
+must be named `squad-review-authority`, use custom deployment branch policies,
+allow exactly the captured `${default_branch}`, contain the environment secret
+`SQUAD_REVIEW_APP_PRIVATE_KEY`, and define environment variables
+`SQUAD_REVIEW_APP_ID`, `SQUAD_REVIEW_APP_SLUG`, and
+`SQUAD_REVIEW_APP_OWNER`. The App ID/slug must differ from
+`15368`/`github-actions`. All four reviewer-specific names must also be absent
+from repository-level Actions secrets and variables; repository fallback does
+not satisfy this gate.
+
+If the authenticated account cannot read environment configuration, or any
+requirement is absent, report the exact external prerequisite and do not claim
+the required check is trusted. The installation PR remains a human boundary;
+after it merges, the Cast canary intentionally fails closed until an
+administrator provisions the environment and reruns the base-controlled
+review. Configure a ruleset only from the canary check's observed App
+integration ID, never from user input or a guessed value.
+
+### 10. Never auto-merge — and explain what comes next
 
 - **Never** merge the bootstrap PR yourself. Merge happens **only** after human
   approval.
@@ -346,8 +366,9 @@ gh pr edit --add-reviewer @copilot   # then wait for review + checks; DO NOT mer
 ### ✓ Correct: STOP on an undocumented safe-update entry
 
 ```text
-gh aw add reports a third secret: `ACME_DEPLOY_KEY`.
-→ This is NOT in the allowlist (SQUAD_GITHUB_APP_PRIVATE_KEY, SQUAD_GITHUB_TOKEN)
+gh aw add reports an additional secret: `ACME_DEPLOY_KEY`.
+→ This is NOT in the allowlist (SQUAD_GITHUB_APP_PRIVATE_KEY, SQUAD_GITHUB_TOKEN,
+  SQUAD_REVIEW_APP_PRIVATE_KEY)
   and is NOT the squad-init action. Do NOT run `--approve`.
   Halt, report "unexpected safe-update entry: ACME_DEPLOY_KEY", and wait.
 ```
@@ -381,7 +402,8 @@ gh pr merge --squash                # auto-merge before human review. NEVER.
 - ❌ **Blanket staging** (`git add .` / `-A` / `git commit -a`). Stage only
   `.gitattributes`, `.github/aw/`, `.github/workflows/`, `.github/s
```

---

### Incident Patch 10: `6c567c9b` (2026-09-29)
**Commit Message**: fix(gh-aw): attest review from base context

Part of #2103

Co-authored-by: Copilot App <223556219+Copilot@users.noreply.github.com>

**File**: `.github/agents.md` (modified, +3/-2)
```diff
@@ -35,8 +35,9 @@ GitHub Agentic Workflows (`gh-aw`) are composable AI workflows triggered by slas
 > the repository's default branch.
 > The installation PR is a manual trust boundary: its PR-controlled workflow
 > cannot mint a trusted Squad verdict. After merge, require the automatically
-> opened Cast PR to pass `Squad Review / review` using the base-controlled guard
-> before treating bootstrap or lifecycle automation as trusted.
+> opened Cast PR to pass the exact-head `Squad Review / review` attestation from
+> the base-controlled `pull_request_target` authority before treating bootstrap
+> or lifecycle automation as trusted.
 
 The quick start installs this workflow set:
 
```

**File**: `docs/src/content/docs/guide/gh-aw.md` (modified, +36/-21)
```diff
@@ -112,7 +112,8 @@ requires a human to review the verifier/compile evidence before merging.
 
 After merge, the default-branch bootstrap workflow opens the draft Cast PR.
 That PR is the activation canary: `Squad Review / review` must succeed using the
-guard and manifest checked out from the Cast PR's exact base commit. The guard
+base-controlled `pull_request_target` workflow plus the guard and manifest
+checked out from the Cast PR's exact base commit. The guard
 also requires matching exact-head provenance in the PR body and a durable
 GitHub Actions bot comment, so editable PR prose cannot rebind an old bootstrap
 run to a changed branch head. Only after that base-controlled canary succeeds
@@ -1448,10 +1449,12 @@ The implementation worker performs an internal self-review before opening a PR:
 After the PR is opened, `squad-review` provides an independent review.
 Every same-repository pull request triggers review on `opened`, `reopened`,
 `ready_for_review` and `synchronize`; fork pull requests are refused. The
-workflow has no `workflow_dispatch` trigger, so a contributor-selected ref
-cannot execute reviewer code or safe-output handlers. Comment `/squad review`
-to receive instructions for opening the existing `Squad Review / review` run
-for the current head and using GitHub's **Re-run jobs** action.
+workflow runs as `pull_request_target` from immutable default-branch context,
+sets `checkout: false`, and has no `workflow_dispatch` trigger. It never checks
+out or executes pull request files, actions, scripts, guards, or manifests; the
+agent reads the diff through GitHub APIs. Comment `/squad review` to receive
+instructions for opening the existing base-controlled run and using GitHub's
+**Re-run all jobs** action.
 
 The reviewer classifies provenance in this priority order:
 
@@ -1485,9 +1488,11 @@ labels, and GitHub logins do not establish independent logical agent identity.
 This is auditable logical attribution, not proof of a separate account or model.
 Registry migration and legitimate attribution changes require human review.
 
-The trusted guard reads attribution from the exact PR head commit, never the
-agent's working tree. A `Squad-Review-Verdict:` JSON record binds repository, PR,
-head SHA, both agent IDs, verdict, UTC timestamp, and workflow run/attempt.
+The trusted guard reads attribution from the exact PR head commit through the
+GitHub API, never by checking out or executing the PR. A
+`Squad-Review-Verdict:` JSON record binds repository, PR, base SHA, head SHA,
+immutable workflow SHA, both agent IDs, verdict, UTC timestamp, and the
+`pull_request_target` workflow run/attempt.
 Exactly one current-head record is required. The legacy
 `Squad-Review-Head: <SHA>` marker remains human-readable but is not authorization.
 Per-PR concurrency cancels stale runs; both output and final gate re-fetch the
@@ -1506,8 +1511,13 @@ exactly one pull request review. It returns:
 
 The trusted writer publishes these logical verdicts in a native `COMMENT`
 review: GitHub does not permit an account to approve or request changes on its
-own PR. The separate status check enforces `REQUEST_CHANGES`; no additional bot
-accounts or Apps are needed.
+own PR. The native `Squad Review Authority / attest` job proves that the base-controlled
+workflow executed. Its publisher creates `Squad Review / review` on the exact
+PR head with a `squad-review-check/v1` attestation linked to that run. A
+PR-controlled workflow may create advisory output with the same display name,
+but it cannot satisfy the relay without the successful native authority job and
+exact event/base/head/run/App binding. The status check enforces
+`REQUEST_CHANGES`; no additional bot accounts or Apps are needed.
 
 The reviewer has no file-editing, issue-creation,
 pull-request-creation, remediation, merge, or `APPROVE` authority. Its verdict
@@ -1521,35 +1531,39 @@ The lifecycle is:
 ```
 
 The epic relay repeats the guard before running the agent and befor
```

**File**: `scripts/gh-aw-hosted-e2e.mjs` (modified, +25/-3)
```diff
@@ -572,10 +572,16 @@ function waitForBaseControlledReviewCanary(target, castPr, evidence) {
       'api',
       '-H', 'Accept: application/vnd.github+json',
       `repos/${target}/commits/${castPr.headSha}/check-runs`,
-      '--jq', '{check_runs:[.check_runs[] | {id,name,status,conclusion,app:{slug:.app.slug}}]}',
+      '--jq', '{check_runs:[.check_runs[] | {id,name,status,conclusion,head_sha,external_id,details_url,completed_at,output:{summary:.output.summary},app:{id:.app.id,slug:.app.slug}}]}',
     ]).check_runs;
+    const externalId =
+      `squad-review-authority/v1:${target}:${castPr.number}:${castPr.baseSha}:${castPr.headSha}`;
     const trustedChecks = checks.filter((check) =>
-      check.name === 'Squad Review / review' && check.app?.slug === 'github-actions');
+      check.name === 'Squad Review / review' &&
+      check.external_id === externalId &&
+      check.head_sha === castPr.headSha &&
+      check.app?.id === 15368 &&
+      check.app?.slug === 'github-actions');
     if (trustedChecks.length > 1) {
       throw new Error(`Expected one base-controlled Squad Review canary check; found ${trustedChecks.length}.`);
     }
@@ -611,15 +617,31 @@ function waitForBaseControlledReviewCanary(target, castPr, evidence) {
         || verdict.author_agent !== '@squad/base-controlled-bootstrap'
         || verdict.reviewer_agent !== '@squad/base-controlled-review'
         || verdict.result !== 'COMMENT'
-        || verdict.event !== 'pull_request'
+        || verdict.event !== 'pull_request_target'
+        || verdict.workflow_sha !== castPr.baseSha
         || verdict.workflow_path !== '.github/workflows/squad-review.lock.yml') {
         throw new Error('Squad Review canary verdict is not bound to the base-controlled bootstrap activation.');
       }
+      const attestation = JSON.parse(check.output?.summary ?? '');
+      if (attestation.schema !== 'squad-review-check/v1'
+        || attestation.repository !== target
+        || attestation.pull_request !== castPr.number
+        || attestation.base_sha !== castPr.baseSha
+        || attestation.head_sha !== castPr.headSha
+        || attestation.workflow_sha !== castPr.baseSha
+        || attestation.run_id !== verdict.run_id
+        || attestation.event !== 'pull_request_target'
+        || attestation.workflow_path !== '.github/workflows/squad-review.lock.yml'
+        || attestation.authority_job !== 'Squad Review Authority / attest'
+        || check.details_url !== `https://github.com/${target}/actions/runs/${verdict.run_id}`) {
+        throw new Error('Squad Review canary check is not bound to the base-controlled authority run.');
+      }
       writeJson(resolve(evidence, 'base-controlled-review-canary.json'), {
         pull_request: castPr,
         check,
         review: verdicts[0],
         verdict,
+        attestation,
       });
       return { check, verdict };
     }
```

**File**: `test/gh-aw-review-guard.test.ts` (modified, +77/-12)
```diff
@@ -27,9 +27,11 @@ afterEach(() => {
 function fixture(relay = false) {
   vi.spyOn(Date, 'now').mockReturnValue(NOW);
   const env = {
-    GITHUB_EVENT_NAME: 'pull_request', GITHUB_REPOSITORY: REPOSITORY,
+    GITHUB_EVENT_NAME: 'pull_request_target', GITHUB_REPOSITORY: REPOSITORY,
+    GITHUB_SERVER_URL: 'https://github.com',
     GITHUB_RUN_ID: '17', GITHUB_RUN_ATTEMPT: '1',
-    SQUAD_REVIEW_PR: '42', SQUAD_REVIEW_HEAD: HEAD, SQUAD_REVIEW_DEFAULT_BRANCH: 'dev',
+    SQUAD_REVIEW_PR: '42', SQUAD_REVIEW_HEAD: HEAD,
+    SQUAD_REVIEW_WORKFLOW_SHA: BASE, SQUAD_REVIEW_DEFAULT_BRANCH: 'dev',
   };
   const attribution = {
     schema: 'squad-review-author/v1', repository: REPOSITORY, issue: 9,
@@ -53,22 +55,53 @@ function fixture(relay = false) {
   const verdict = {
     schema: 'squad-review-verdict/v1', repository: REPOSITORY, pull_request: 42,
     base_sha: BASE, head_sha: HEAD, author_agent: 'implementer', reviewer_agent: 'reviewer',
-    result: 'COMMENT', timestamp: ISSUED, run_id: 17, run_attempt: 1, event: 'pull_request',
-    workflow_path: '.github/workflows/squad-review.lock.yml',
+    result: 'COMMENT', timestamp: ISSUED, run_id: 17, run_attempt: 1,
+    event: 'pull_request_target', workflow_path: '.github/workflows/squad-review.lock.yml',
+    workflow_sha: BASE,
   };
   const review = {
     id: 123, user: { login: 'github-actions[bot]', id: 41898282, type: 'Bot' }, commit_id: HEAD,
     state: 'COMMENTED', submitted_at: SUBMITTED,
     body: '',
   };
   const run = {
-    event: 'pull_request', path: '.github/workflows/squad-review.lock.yml',
+    event: 'pull_request_target', path: '.github/workflows/squad-review.lock.yml',
     display_title: 'Squad review \u2014 PR #42',
-    repository: { full_name: REPOSITORY }, head_sha: HEAD, run_attempt: 1,
+    repository: { full_name: REPOSITORY }, head_sha: BASE, run_attempt: 1,
     pull_requests: [{ number: 42, head: { sha: HEAD }, base: { repo: { name: 'example' } } }],
     run_started_at: START, updated_at: FINISHED, status: 'completed', conclusion: 'success',
   };
-  const jobs = [{ name: CHECK_NAME, conclusion: 'success', completed_at: FINISHED }];
+  const jobs = [{
+    name: 'Squad Review Authority / attest',
+    conclusion: 'success',
+    completed_at: FINISHED,
+  }];
+  const checkRuns = [{
+    id: 88,
+    name: CHECK_NAME,
+    external_id: `squad-review-authority/v1:${REPOSITORY}:42:${BASE}:${HEAD}`,
+    head_sha: HEAD,
+    status: 'completed',
+    conclusion: 'success',
+    completed_at: FINISHED,
+    details_url: `https://github.com/${REPOSITORY}/actions/runs/17`,
+    app: { id: 15368, slug: 'github-actions' },
+    output: {
+      summary: JSON.stringify({
+        schema: 'squad-review-check/v1',
+        repository: REPOSITORY,
+        pull_request: 42,
+        base_sha: BASE,
+        head_sha: HEAD,
+        workflow_sha: BASE,
+        run_id: 17,
+        run_attempt: 1,
+        event: 'pull_request_target',
+        workflow_path: '.github/workflows/squad-review.lock.yml',
+        authority_job: 'Squad Review Authority / attest',
+      }),
+    },
+  }];
   const bootstrapRun = {
     event: 'push', path: '.github/workflows/squad-bootstrap.lock.yml',
     repository: { full_name: REPOSITORY }, head_sha: BASE, head_branch: 'dev',
@@ -100,6 +133,9 @@ function fixture(relay = false) {
       if (state.changeAfterFirstRead && state.prReads > 1) pr.head.sha = BASE;
       return structuredClone(pr);
     }
+    if (route === `repos/${REPOSITORY}`) {
+      return { full_name: REPOSITORY, default_branch: 'dev' };
+    }
     if (route.endsWith('/contents/.squad-review.json')) {
       expect(fields?.ref).toBe(HEAD);
       if (state.missingManifest) {
@@ -116,6 +152,7 @@ function fixture(relay = false) {
     if (route.endsWith('/actions/runs/29')) return bootstrapRun;
     if (route.endsWith('/attempts/1')) return { ...run, run_attempt: 1, run_started_at: START };
     if (/\/attempts\/[12]\/jobs$/.test(route)) return { jobs };
```

**File**: `test/gh-aw-review-workflow.test.ts` (modified, +79/-13)
```diff
@@ -92,8 +92,14 @@ function assertReviewerContract(workflow: string): void {
   expect(concurrency).toContain('cancel-in-progress: true');
   expect(trigger).not.toMatch(/^\s+forks:/m);
   expect(trigger).not.toContain('workflow_dispatch:');
+  expect(trigger).toMatch(/pull_request_target:/);
+  expect(trigger).not.toMatch(/^\s+pull_request:/m);
+  expect(yaml).toContain('checkout: false');
+  expect(yaml).toContain('strict: false');
   expect(yaml).toContain('github.event.pull_request.head.repo.full_name == github.repository');
-  expect(yaml).not.toContain('github.workflow_sha');
+  expect(yaml).toContain('SQUAD_REVIEW_WORKFLOW_SHA: ${{ github.workflow_sha }}');
+  expect(yaml).toContain('ref: ${{ github.event.pull_request.base.sha }}');
+  expect(yaml).not.toContain('ref: ${{ github.workflow_sha }}');
   expect(yaml).not.toContain('github.event.inputs');
   expect(workflow).toContain('Squad-Review-Head: {40-character lowercase head SHA}');
   expect(rows).toEqual([
@@ -107,6 +113,9 @@ function assertReviewerContract(workflow: string): void {
   expect(workflow).toContain('inlined-imports: true');
   expect(workflow).toContain('await guard.enforceReviewOutputs');
   expect(workflow).toContain('await guard.assertClearingReview');
+  expect(workflow).toContain('Squad Review Authority / attest');
+  expect(workflow).toContain('Publish exact-head required check');
+  expect(workflow).toContain("run.event !== 'pull_request_target'");
   expect(workflow).toContain('The workflow-installation PR is an explicit human trust boundary.');
   expect(workflow).toContain('Trusted review starts on the automatic post-merge Cast PR.');
   expect(workflow).toContain('Human approval remains mandatory.');
@@ -150,16 +159,19 @@ afterAll(() => {
 function assertCompiledGate(lock: string): void {
   const workflow = parse(lock);
   const { jobs } = workflow;
+  expect(workflow.on).toHaveProperty('pull_request_target');
+  expect(workflow.on).not.toHaveProperty('pull_request');
   expect(workflow['run-name']).toBe('Squad review — PR #${{ github.event.pull_request.number }}');
   const review = jobs.review;
-  expect(review.name).toBe('Squad Review / review');
+  expect(review.name).toBe('Squad Review Authority / attest');
   expect(review.if).toBe('always()');
   expect(review.needs).toEqual(expect.arrayContaining(['agent', 'safe_outputs']));
   const execution = review.steps.find((step: { name: string }) => step.name === 'Require successful PR review execution');
   expect(execution.run).toContain('test "$AGENT_RESULT" = success');
   expect(execution.run).toContain('test "$OUTPUT_RESULT" = success');
   expect(review.steps.at(-1).with.script).toContain('await guard.assertClearingReview');
   expect(review.steps.at(-1).env.SQUAD_REVIEW_HEAD).toBe('${{ github.event.pull_request.head.sha }}');
+  expect(review.steps.at(-1).env.SQUAD_REVIEW_WORKFLOW_SHA).toBe('${{ github.workflow_sha }}');
   const steps = jobs.safe_outputs.steps;
   const guard = steps.findIndex((step: { name: string }) => step.name === 'Bind review output to committed agent identities and current head');
   const process = steps.findIndex((step: { name: string }) => step.name === 'Process Safe Outputs');
@@ -189,6 +201,27 @@ function assertCompiledGate(lock: string): void {
   expect(finalGate.with.script).not.toContain('Squad-Review-Verdict:');
   for (const step of review.steps) expect(step['continue-on-error']).toBeUndefined();
   expect(review['continue-on-error']).toBeUndefined();
+  const publish = jobs.publish;
+  expect(publish.name).toBe('Publish Squad Review required check');
+  expect(publish.if).toBe('always()');
+  expect(publish.needs).toEqual(expect.arrayContaining(['agent', 'safe_outputs', 'review']));
+  expect(publish.permissions).toMatchObject({
+    actions: 'read',
+    checks: 'write',
+    contents: 'read',
+    'pull-requests': 'read',
+  });
+  const publishStep = publish.steps.find((step: { name: string }) =>
+    step.name === 'Publish exact-head required 
```

#### Recent Merged Pull Requests:
- **PR #2118** (2026-09-29): fix(gh-aw): correct exact enlistment compiler warning gate (@bradygaster)
- **PR #2116** (2026-09-29): fix(gh-aw): preserve ownership staging with bounded index verification (@bradygaster)
- **PR #2115** (2026-09-29): fix(gh-aw): submit bootstrap chunks without agent transcription (@bradygaster)
- **PR #2111** (2026-09-29): fix(gh-aw): verify native package source digest variants (@bradygaster)
- **PR #2110** (2026-09-30): Enforce coordinator scope and tracked behavior changes (@bradygaster)
- **PR #2109** (2026-09-29): fix(gh-aw): replace reviewer App with native review authority (@bradygaster)
- **PR #2105** (2026-09-29): fix(gh-aw): attest review from base context (@bradygaster)
- **PR #2104** (2026-09-29): fix(gh-aw): make Squad Review safe outputs first-install safe (@bradygaster)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
