# Forensic Learning Record (Deep Inspection): openai/openai-agents-js

> **Canonical Artifact**: `07_PROJECT_LEARNING/openai-openai-agents-js-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/openai/openai-agents-js](https://github.com/openai/openai-agents-js))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:56:07.040Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `openai/openai-agents-js`
- **Description**: A lightweight, powerful framework for multi-agent workflows and voice agents
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 3882 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/skills/changeset-validation/scripts/changeset-assign-milestone.mjs`
```
#!/usr/bin/env node

import fs from 'fs';
import { execFileSync } from 'child_process';

const { fetch, console, process } = globalThis;

function printUsage() {
  console.log('Usage: pnpm changeset:assign-milestone -- <path-to-json>');
}

function readJson(filePath) {
  const contents = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(contents);
}

function parseMilestoneTitle(title) {
  const match = title.match(/^(\d+)\.(\d+)\.x$/);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), title };
}

const bumpRanks = {
  none: 0,
  patch: 1,
  minor: 2,
  major: 3,
};

function maxBump(left, right) {
  return bumpRanks[right] > bumpRanks[left] ? right : left;
}

function bumpFromChangesetLine(line) {
  const match = line.match(
    /^\s*['"]?[^'":]+['"]?\s*:\s*(patch|minor|major)\s*$/,
  );
  return match?.[1];
}

function changesetBumpFromContent(content) {
  const parts = content.split('---');
  if (parts.length < 3) {
    return 'none';
  }
  let bump = 'none';
  for (const line of parts[1].split(/\r?\n/)) {
    const lineBump = bumpFromChangesetLine(line);
    if (lineBump) {
      bump = maxBump(bump, lineBump);
    }
  }
  return bump;
}

function changedChangesetFiles(baseSha, headSha) {
  const diff = execFileSync(
    'git',
    ['diff', '--name-only', `${baseSha}...${headSha}`, '--', '.changeset'],
    { encoding: 'utf8' },
  ).trim();
  return diff
    ? diff
        .split(/\r?\n/)
        .filter((file) => file.endsWith('.md') && !file.endsWith('README.md'))
    : [];
}

function changesetBumpForEvent(event) {
  const baseSha = event?.pull_request?.base?.sha;
  const headSha = event?.pull_request?.head?.sha;
  if (!baseSha || !headSha) {
    return 'none';
  }

  let bump = 'none';
  for (const file of changedChangesetFiles(baseSha, headSha)) {
    let content;
    try {
      content = execFileSync('git', ['show', `${headSha}:${file}`], {
        encoding: 'utf8',
      });
    } catch (_error) {
      continue;
    }
    bump = maxBump(bump, changesetBumpFromContent(content));
  }
  return bump;
}

async function listOpenMilestones(owner, repo, token) {
  if (process.env.CHANGESET_ASSIGN_MILESTONE_MILESTONES_JSON) {
    return JSON.parse(process.env.CHANGESET_ASSIGN_MILESTONE_MILESTONES_JSON);
  }

  const milestonesResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/milestones?state=open&per_page=100`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!milestonesResponse.ok) {
    console.warn(
      `Milestone assignment skipped (failed to list milestones: ${milestonesResponse.status}).`,
    );
    return null;
  }

  return milestonesResponse.json();
}

async function assignMilestone(releaseBump) {
  if (releaseBump === 'none') {
    console.log('Milestone assignment skipped (no package changes).');
    return;
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn('Milestone assignment skipped (missing GITHUB_TOKEN).');
    return;
  }

  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    console.warn('Milestone assignment skipped (missing GITHUB_EVENT_PATH).');
    return;
  }

  let event;
  try {
    event = JSON.parse(fs.readFileSync(eventPath, 'utf8'));
  } catch (_error) {
    console.warn(
      'Milestone assignment skipped (failed to read event payload).',
    );
    return;
  }

  const owner = event?.repository?.owner?.login;
  const repo = event?.repository?.name;
  const prNumber = event?.pull_request?.number;
  if (!owner || !repo || !prNumber) {
    console.warn(
      'Milestone assignment skipped (missing repository or PR info).',
    );
    return;
  }

  const milestones = await listOpenMilestones(owner, repo, token);
  if (!milestones) {
    return;
  }

  const parsed = milestones
    .map((milestone) => ({
      milestone,
      parsed: parseMilestoneTitle(milestone.title),
    }))
    .filter((entry) => entry.parsed)
    .sort((a, b) => {
      if (a.parsed.major !== b.parsed.major)
        return a.parsed.major - b.parsed.major;
      return a.parsed.minor - b.parsed.minor;
    });

  if (parsed.length === 0) {
    console.warn(
      'Milestone assignment skipped (no open milestones matching X.Y.x).',
    );
    return;
  }

  const majors = Array.from(
    new Set(parsed.map((entry) => entry.parsed.major)),
  ).sort((a, b) => a - b);
  const currentMajor = majors[0];
  const nextMajor = majors[1];

  const currentMajorEntries = parsed.filter(
    (entry) => entry.parsed.major === currentMajor,
  );
  const patchTarget = currentMajorEntries[0];
  const minorTarget = currentMajorEntries[1] ?? patchTarget;

  let majorTarget;
  if (nextMajor !== undefined) {
    const nextMajorEntries = parsed.filter(
      (entry) => entry.parsed.major === nextMajor,
    );
    majorTarget = nextMajorEntries[0];
  }

  let targetEntry;
  if (releaseBump === 'major') {
    targetEntry = majorTarget;
  } else if (releaseBump === 'minor') {
    targetEntry = minorTarget;
  } else {
    targetEntry = patchTarget;
  }
  if (!targetEntry) {
    console.warn(
      'Milestone assignment skipped (not enough open milestones for selection).',
    );
    return;
  }

  if (process.env.CHANGESET_ASSIGN_MILESTONE_DRY_RUN === '1') {
    console.log(`Milestone would be set to ${targetEntry.milestone.title}.`);
    return;
  }

  const updateResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/issues/${prNumber}`,
    {
      method: 'PATCH',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ milestone: targetEntry.milestone.number }),
    },
  );

  if (!updateResponse.ok) {
    console.warn(
      `Milestone assignment skipped (failed to update PR milestone: ${updateResponse.status}).`,
    );
    return;
  }

  console.log(`Milestone set to ${targetEntry.milestone.title}.`);
}

function main() {
  const inputPath = process.argv
    .slice(2)
    .filter((arg) => arg !== '--')
    .find(Boolean);
  if (!inputPath) {
    printUsage();
    console.warn('Milestone assignment skipped (missing input path).');
    return;
  }

  let data;
  try {
    data = readJson(inputPath);
  } catch (_error) {
    console.warn(
      `Milestone assignment skipped (failed to read JSON from ${inputPath}).`,
    );
    return;
  }

  const requiredBump = data?.required_bump;
  if (!requiredBump) {
    console.warn('Milestone assignment skipped (missing required_bump).');
    return;
  }

  let releaseBump = requiredBump;
  if (process.env.GITHUB_EVENT_PATH) {
    try {
      const event = JSON.parse(
        fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'),
      );
      releaseBump = maxBump(requiredBump, changesetBumpForEvent(event));
    } catch (_error) {
      releaseBump = requiredBump;
    }
  }

  assignMilestone(releaseBump).catch((error) => {
    console.warn(`Milestone assignment skipped: ${error.message}`);
  });
}

main();

```

### Core Architecture Module: `.agents/skills/changeset-validation/scripts/changeset-prompt.mjs`
```
#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';

const { console, process } = globalThis;

const EXEC_MAX_BUFFER = Number(
  process.env.CHANGESET_MAX_BUFFER_BYTES || 50 * 1024 * 1024,
);
const ALLOWED_PACKAGES = [
  '@openai/agents',
  '@openai/agents-core',
  '@openai/agents-extensions',
  '@openai/agents-openai',
  '@openai/agents-realtime',
];

const MAX_DIFF_CHARS = Number(process.env.CHANGESET_MAX_DIFF_CHARS || 12000);
const PROMPT_PATH = path.join(
  '.agents',
  'skills',
  'changeset-validation',
  'references',
  'validation-prompt.md',
);

function printUsage() {
  console.log(`changeset-prompt

Usage:
  pnpm changeset:validate-prompt -- [--base <ref>] [--head <ref>] [--ci] [--output <path>]

Options:
  --base <ref>           Base ref or SHA (default: origin/main if available, else main).
  --head <ref>           Head ref or SHA (default: HEAD).
  --ci                   Use CI context (PR body, no working tree diffs).
  --output <path>        Write the generated prompt to a file instead of stdout.
  --help                 Show this help text.
`);
}

function run(args) {
  return execFileSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: EXEC_MAX_BUFFER,
  }).trim();
}

function runOptional(args) {
  try {
    return run(args);
  } catch (_error) {
    return '';
  }
}

function parseArgs(argv) {
  const options = {
    base: null,
    head: null,
    ci: process.env.GITHUB_ACTIONS === 'true',
    output: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help') {
      options.help = true;
      continue;
    }
    if (arg === '--base') {
      options.base = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--head') {
      options.head = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === '--ci') {
      options.ci = true;
      continue;
    }
    if (arg === '--output') {
      options.output = argv[i + 1];
      i += 1;
      continue;
    }
  }

  return options;
}

function parseNameStatus(text) {
  if (!text) return [];
  const lines = text.split(/\r?\n/).filter(Boolean);
  const entries = [];
  for (const line of lines) {
    const parts = line.split('\t');
    const status = parts[0];
    if (!status) continue;
    if (status.startsWith('R') || status.startsWith('C')) {
      if (parts[1]) entries.push({ path: parts[1], status });
      if (parts[2]) entries.push({ path: parts[2], status });
    } else if (parts[1]) {
      entries.push({ path: parts[1], status });
    }
  }
  return entries;
}

function isChangesetFile(filePath) {
  if (!filePath.startsWith('.changeset/')) return false;
  if (!filePath.endsWith('.md')) return false;
  return path.basename(filePath) !== 'README.md';
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (_error) {
    return null;
  }
}

function truncateText(text, maxChars) {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n... (truncated ${text.length - maxChars} chars)`;
}

function getDiffNoIndex(filePath) {
  const result = spawnSync(
    'git',
    ['diff', '--no-index', '--', '/dev/null', filePath],
    {
      encoding: 'utf8',
    },
  );
  return result.stdout.trim();
}

function readFileFromGit(ref, filePath) {
  const result = spawnSync('git', ['show', `${ref}:${filePath}`], {
    encoding: 'utf8',
  });
  if (result.status !== 0) return null;
  return result.stdout;
}

function readFileAtRefOrWorktree(ref, filePath, preferWorkingTree = false) {
  if (preferWorkingTree) {
    const contents = readFileSafe(filePath);
    if (contents !== null) return contents;
  }
  return readFileFromGit(ref, filePath);
}

function parseJsonSafe(contents) {
  if (!contents) return null;
  try {
    return JSON.parse(contents);
  } catch (_error) {
    return null;
  }
}

function cloneJsonValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function stripReleaseOnlyPackageJsonFields(packageJson) {
  if (!packageJson || typeof packageJson !== 'object') return packageJson;
  const normalized = cloneJsonValue(packageJson);
  delete normalized.version;
  return normalized;
}

function isReleaseManagedPackageFile(filePath, dir) {
  return (
    filePath === `packages/${dir}/CHANGELOG.md` ||
    filePath === `packages/${dir}/package.json` ||
    filePath === `packages/${dir}/src/metadata.ts`
  );
}

function hasMeaningfulPackageJsonChanges({
  dir,
  baseSha,
  headSha,
  includeWorkingTree,
}) {
  const filePath = `packages/${dir}/package.json`;
  const basePackageJson = parseJsonSafe(readFileFromGit(baseSha, filePath));
  const headPackageJson = parseJsonSafe(
    readFileAtRefOrWorktree(headSha, filePath, includeWorkingTree),
  );

  if (!basePackageJson || !headPackageJson) {
    return true;
  }

  return (
    JSON.stringify(stripReleaseOnlyPackageJsonFields(basePackageJson)) !==
    JSON.stringify(stripReleaseOnlyPackageJsonFields(headPackageJson))
  );
}

function collectRelevantPackageDirs({
  changedPackageDirs,
  packageFilesByDir,
  baseSha,
  headSha,
  includeWorkingTree,
}) {
  const relevantDirs = new Set();

  for (const dir of changedPackageDirs) {
    const files = packageFilesByDir.get(dir) || [];
    const onlyReleaseManagedFiles =
      files.length > 0 &&
      files.every((filePath) => isReleaseManagedPackageFile(filePath, dir));
    const meaningfulPackageJsonChanges = files.includes(
      `packages/${dir}/package.json`,
    )
      ? hasMeaningfulPackageJsonChanges({
          dir,
          baseSha,
          headSha,
          includeWorkingTree,
        })
      : false;

    if (onlyReleaseManagedFiles && !meaningfulPackageJsonChanges) {
      continue;
    }

    relevantDirs.add(dir);
  }

  return relevantDirs;
}

function readEventPayload() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) return null;
  const contents = readFileSafe(eventPath);
  if (!contents) return null;
  try {
    return JSON.parse(contents);
  } catch (_error) {
    return null;
  }
}

function renderPrompt(template, data) {
  return template
    .replaceAll('{{ALLOWED_PACKAGES}}', data.allowedPackages)
    .replaceAll('{{CHANGED_PACKAGES}}', data.changedPackages)
    .replaceAll('{{CHANGED_FILES}}', data.changedFiles)
    .replaceAll('{{CHANGESET_FILES}}', data.changesetFiles)
    .replaceAll('{{PR_BODY}}', data.prBody)
    .replaceAll('{{PR_LABELS}}', data.prLabels)
    .replaceAll('{{PACKAGE_DIFF}}', data.packageDiff)
    .replaceAll('{{UNKNOWN_PACKAGE_DIRS}}', data.unknownPackageDirs);
}

function formatChangesetFiles(entries) {
  if (entries.length === 0) return '(none)';
  return entries
    .map((entry) => {
      const header = `File: ${entry.path} (${entry.status || 'unknown'})`;
      const content = entry.content ? entry.content.trimEnd() : '(missing)';
      return `${header}\n\n\`\`\`md\n${content}\n\`\`\``;
    })
    .join('\n\n');
}

function writeOutputFile(outputPath, prompt) {
  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(outputPath, `${prompt.trim()}\n`, 'utf8');
  console.log(`Wrote prompt to ${outputPath}.`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    process.exit(0);
  }

  const repoRoot = run(['rev-parse', '--show-toplevel']);
  process.chdir(repoRoot);

  const eventPayload = readEventPayload();
  const eventBaseSha = eventPayload?.pull_request?.base?.sha;
  const eventHeadSha = eventPayload?.pull_request?.head?.sha;

  const baseRef =
    options.base ||
    eventBaseSha ||
    (runOptional(['rev-parse', '--verify', 'origin/main'])
      ? 'origin/main'
      : 'main');
  const headRef = options.head || eventHeadSha || 'HEAD';

  let baseSha;
  let headSha;
  try {
    headSha = run(['rev-parse', headRef]);
    baseSha = run(['merge-ba
```

### Core Architecture Module: `.agents/skills/changeset-validation/scripts/changeset-validation-result.mjs`
```
#!/usr/bin/env node

import fs from 'fs';

const { console, process } = globalThis;

function printUsage() {
  console.log('Usage: pnpm changeset:validate-result -- <path-to-json>');
}

function readJson(filePath) {
  const contents = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(contents);
}

function validateShape(data) {
  if (typeof data?.ok !== 'boolean') return 'Missing ok boolean.';
  if (!Array.isArray(data?.errors)) return 'Missing errors array.';
  if (!Array.isArray(data?.warnings)) return 'Missing warnings array.';
  if (!['patch', 'minor', 'major', 'none'].includes(data?.required_bump)) {
    return 'Missing required_bump with value patch/minor/major/none.';
  }
  return null;
}

function printWarnings(warnings) {
  if (warnings.length === 0) return;
  console.warn('\nWarnings:');
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

function main() {
  const inputPath = process.argv
    .slice(2)
    .filter((arg) => arg !== '--')
    .find(Boolean);
  if (!inputPath) {
    printUsage();
    process.exit(1);
  }

  let data;
  try {
    data = readJson(inputPath);
  } catch (_error) {
    console.error(`Failed to read JSON from ${inputPath}.`);
    process.exit(1);
  }

  const shapeError = validateShape(data);
  if (shapeError) {
    console.error(`changeset-validation failed: ${shapeError}`);
    process.exit(1);
  }

  if (!data.ok) {
    console.error('changeset-validation failed.');
    for (const message of data.errors) {
      console.error(`- ${message}`);
    }
    printWarnings(data.warnings);
    process.exit(1);
  }

  console.log('changeset-validation passed.');
  printWarnings(data.warnings);
}

main();

```

### Core Architecture Module: `.agents/skills/code-change-verification/scripts/run.mjs`
```
#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { console, process } = globalThis;
const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);

const VALIDATION_NAMES = [
  'build-check',
  'dist-check',
  'lint',
  'test',
  'format-check',
];
const VALIDATION_COMMANDS = [
  'pnpm -r build-check',
  'pnpm -r -F "@openai/*" dist:check',
  'pnpm lint',
  'pnpm test',
  'pnpm format:check:changed',
];

function printUsage() {
  console.log(`code-change-verification

Usage:
  node .agents/skills/code-change-verification/scripts/run.mjs
`);
}

function getRepoRoot() {
  try {
    return execFileSync(
      'git',
      ['-C', scriptDir, 'rev-parse', '--show-toplevel'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ).trim();
  } catch {
    return path.resolve(scriptDir, '../../../..');
  }
}

function getPnpmCommand() {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

function runPnpm(repoRoot, label, args) {
  console.log(`Running pnpm ${args.join(' ')}...`);
  const result = spawnSync(getPnpmCommand(), args, {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  });

  if (result.error) {
    console.error(`code-change-verification: ${label} failed to start.`);
    console.error(result.error);
    return 1;
  }
  if (typeof result.status === 'number') {
    if (result.status !== 0) {
      console.error(
        `code-change-verification: ${label} failed with exit code ${result.status}.`,
      );
    }
    return result.status;
  }

  console.error(
    `code-change-verification: ${label} terminated by ${result.signal ?? 'an unknown signal'}.`,
  );
  return 1;
}

function runVerification() {
  const repoRoot = getRepoRoot();
  const installExitCode = runPnpm(repoRoot, 'install', [
    'i',
    '--frozen-lockfile',
  ]);
  if (installExitCode !== 0) {
    return installExitCode;
  }

  const buildExitCode = runPnpm(repoRoot, 'build', ['build']);
  if (buildExitCode !== 0) {
    return buildExitCode;
  }

  const validationExitCode = runPnpm(repoRoot, 'validation', [
    'exec',
    'concurrently',
    '--kill-others-on-fail',
    '--kill-timeout',
    '5000',
    '--names',
    VALIDATION_NAMES.join(','),
    ...VALIDATION_COMMANDS,
  ]);
  if (validationExitCode !== 0) {
    return validationExitCode;
  }

  console.log('code-change-verification: all commands passed.');
  return 0;
}

if (process.argv.includes('--help')) {
  printUsage();
  process.exit(0);
}

process.exit(runVerification());

```

### Core Architecture Module: `.agents/skills/implementation-final-review/scripts/prepare_review_round.py`
```
#!/usr/bin/env python3
"""Generate deterministic evidence for one implementation final-review round."""

from __future__ import annotations

import argparse
import base64
import json
import os
import shlex
import subprocess
from pathlib import Path

from review_state import (
    _git,
    _load_pathspec_file,
    _parse_component_files,
    review_state,
)

_FINGERPRINT_LENGTH = 64
_REVIEWER_INSTRUCTIONS_HEADING = "## Reviewer instructions\n"
_DEFAULT_REVIEWER_BRIEF = (
    Path(__file__).resolve().parent.parent / "references" / "reviewer-brief.md"
)


def _read_required_text(path: Path, label: str) -> str:
    try:
        value = path.read_text()
    except (OSError, UnicodeError) as error:
        raise ValueError(f"Cannot read {label} {path}: {error}") from error
    if not value.strip():
        raise ValueError(f"{label.capitalize()} must not be empty: {path}")
    return value.rstrip() + "\n"


def _load_prior_clean_components(
    path: Path | None, current_components: set[str]
) -> dict[str, str]:
    if path is None:
        return {}
    try:
        payload = json.loads(path.read_text())
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise ValueError(f"Cannot read prior clean state {path}: {error}") from error
    if not isinstance(payload, dict) or set(payload) != {"clean_components"}:
        raise ValueError(
            "Prior clean state must contain exactly one clean_components object."
        )
    clean_components = payload["clean_components"]
    if not isinstance(clean_components, dict):
        raise ValueError("Prior clean state clean_components must be an object.")
    unknown = sorted(set(clean_components) - current_components)
    if unknown:
        raise ValueError(f"Prior clean state contains unknown components: {unknown}")
    validated: dict[str, str] = {}
    for name, fingerprint in clean_components.items():
        if not isinstance(fingerprint, str) or len(fingerprint) != _FINGERPRINT_LENGTH:
            raise ValueError(
                f"Prior clean component {name} must have a 64-character fingerprint."
            )
        try:
            int(fingerprint, 16)
        except ValueError as error:
            raise ValueError(
                f"Prior clean component {name} must have a hexadecimal fingerprint."
            ) from error
        validated[name] = fingerprint
    return validated


def _load_reviewer_contract(path: Path) -> str:
    brief = _read_required_text(path, "reviewer brief")
    _, separator, contract = brief.partition(_REVIEWER_INSTRUCTIONS_HEADING)
    if not separator or not contract.strip():
        raise ValueError(
            "Reviewer brief must contain a nonempty Reviewer instructions section."
        )
    return _REVIEWER_INSTRUCTIONS_HEADING + contract


def _component_candidates(
    state: dict[str, object], prior_clean: dict[str, str]
) -> tuple[list[str], list[str]]:
    components = state["components"]
    assert isinstance(components, dict)
    reusable: list[str] = []
    invalidated: list[str] = []
    for name, prior_fingerprint in sorted(prior_clean.items()):
        component = components[name]
        assert isinstance(component, dict)
        if component["content_fingerprint"] == prior_fingerprint:
            reusable.append(name)
        else:
            invalidated.append(name)
    return reusable, invalidated


def _shell_command(arguments: list[str]) -> str:
    return shlex.join(arguments)


def _resolved_git_directory(repo: Path, argument: str) -> Path:
    value = Path(_git(repo, "rev-parse", argument).decode().strip())
    return value.resolve() if value.is_absolute() else (repo / value).resolve()


def _is_within(path: Path, directory: Path) -> bool:
    try:
        path.relative_to(directory)
    except ValueError:
        return False
    return True


def _untracked_content(
    repo: Path, pathspecs: tuple[str, ...]
) -> list[dict[str, object]]:
    raw_paths = _git(
        repo,
        "ls-files",
        "--others",
        "--exclude-standard",
        "-z",
        "--",
        *pathspecs,
    )
    content: list[dict[str, object]] = []
    for raw_path in sorted(path for path in raw_paths.split(b"\0") if path):
        relative_path = os.fsdecode(raw_path)
        path = repo / relative_path
        if path.is_symlink():
            content.append(
                {
                    "path": relative_path,
                    "kind": "symlink",
                    "target": os.readlink(path),
                }
            )
            continue
        data = path.read_bytes()
        try:
            text_content = data.decode("utf-8")
        except UnicodeDecodeError:
            content.append(
                {
                    "path": relative_path,
                    "kind": "file",
                    "executable": bool(path.stat().st_mode & 0o111),
                    "encoding": "base64",
                    "content": base64.b64encode(data).decode("ascii"),
                }
            )
        else:
            content.append(
                {
                    "path": relative_path,
                    "kind": "file",
                    "executable": bool(path.stat().st_mode & 0o111),
                    "encoding": "utf-8",
                    "content": text_content,
                }
            )
    return content


def prepare_review_round(
    *,
    repo: Path,
    base: str,
    pathspec_file: Path,
    component_pathspec_files: list[str],
    base_packet: Path,
    round_delta: Path,
    output_dir: Path,
    prior_clean_state: Path | None = None,
    reviewer_brief: Path = _DEFAULT_REVIEWER_BRIEF,
) -> dict[str, object]:
    repo = repo.resolve()
    output_dir = output_dir.resolve()
    git_directories = {
        _resolved_git_directory(repo, "--git-dir"),
        _resolved_git_directory(repo, "--git-common-dir"),
    }
    if any(_is_within(output_dir, directory) for directory in git_directories):
        raise ValueError("Review output directory must not be inside .git.")

    pathspecs = _load_pathspec_file(pathspec_file)
    if not pathspecs:
        raise ValueError("The task pathspec file must contain at least one pathspec.")
    components = _parse_component_files(component_pathspec_files)
    if not components:
        raise ValueError("At least one semantic component manifest is required.")
    state = review_state(repo, base, pathspecs, components)
    stable_packet = _read_required_text(base_packet, "base packet")
    current_delta = _read_required_text(round_delta, "round delta")
    reviewer_contract = _load_reviewer_contract(reviewer_brief)
    prior_clean = _load_prior_clean_components(prior_clean_state, set(components))
    reusable, invalidated = _component_candidates(state, prior_clean)

    resolved_base = str(state["base"])
    tracked_diff = _git(
        repo, "diff", "--binary", "--full-index", resolved_base, "--", *pathspecs
    )
    context_diff = _git(
        repo, "diff", "--full-index", "--unified=80", resolved_base, "--", *pathspecs
    )
    raw_status = _git(
        repo,
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        "--",
        *pathspecs,
    ).decode(errors="replace")

    output_dir.mkdir(parents=True, exist_ok=True)
    state_path = output_dir / "review-state.json"
    diff_path = output_dir / "task.diff"
    context_path = output_dir / "task-context.diff"
    untracked_path = output_dir / "task-untracked.json"
    packet_path = output_dir / "review-packet.md"

    component_args = [
        argument
        for value in component_pathspec_files
        for argument in ("--component-pathspec-file", value)
    ]
    revalidation = _shell_command(
        [
            "PYTHONDONTWRITEBYTECODE=1",
            "python3",
            ".agents/skills/implementation-final-review/scripts/review_state.py",
            "--repo",
            os.fspath(repo),
            "--base",
            resolved_ba
```

### Core Architecture Module: `.agents/skills/implementation-final-review/scripts/review_protocol.py`
```
#!/usr/bin/env python3
"""Validate final-review packets, reviewer outputs, and verification receipts."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
from pathlib import Path
from typing import Any

from review_state import (
    _content_fingerprint,
    _NonRegularFileError,
    _read_regular_file,
    _repository_fingerprint,
)

PACKET_SOFT_LIMIT_BYTES = 12 * 1024
SENTINELS = {"none", "not applicable"}
ROOT_CAUSE_ID = re.compile(r"[A-Z][A-Z0-9_-]*")
NEW_ROOT_CAUSE_ID = re.compile(r"NEW:[a-z0-9]+(?:-[a-z0-9]+)*")
SHA256 = re.compile(r"[0-9a-f]{64}")
PLACEHOLDER_TOKEN = re.compile(r"<(?=\S)[^<>\n]*\S>")

REQUIRED_PACKET_TEXT = (
    "task.id",
    "task.original_requirement",
    "task.risk_tier",
    "task.risk_reason",
    "scope_contract.required_behavior",
    "scope_contract.compatibility_requirements",
    "scope_contract.unsupported_cases",
    "scope_contract.supported_alternative",
    "repository.target",
    "repository.merge_base",
    "repository.head",
    "repository.release_boundary",
    "repository.status_evidence_id",
    "repository.complete_diff_command",
    "ledger.path",
    "manifests.task",
    "review_state.evidence_id",
    "review_state.revalidation_command",
    "verification.eligible_concurrent_gates",
    "verification.deferred_gates",
)
REVIEWER_OUTPUT_FIELDS = {
    "verdict",
    "reviewed_fingerprints",
    "checked_inventory_ids",
    "unchecked_inventory_ids",
    "high_risk_dimensions_checked",
    "focused_probes",
    "remaining_uncertainty",
    "findings",
    "sibling_scenario_scan",
    "inspection_call_count",
    "inspection_budget_reason",
}
FINDING_FIELDS = {
    "priority",
    "title",
    "location",
    "failure_scenario",
    "user_consequence",
    "support_basis",
    "baseline_patch_evidence",
    "smallest_safe_correction",
    "root_cause_id",
    "root_cause_evidence",
}
INVENTORY_FIELDS = {
    "contract": {
        "surface",
        "producers",
        "consumers",
        "behavior",
        "exports",
        "adjacent",
        "tests",
    },
    "await-boundary": {
        "operation",
        "state_snapshot",
        "blocking_point",
        "suspended_events",
        "monotonic_evidence",
        "revalidation",
        "side_effects_invariant",
    },
    "authority-data-flow": {
        "input_authority",
        "validation",
        "in_memory_state",
        "persisted_state",
        "retry_replay",
        "output",
        "exception_exposure",
        "cleanup_revocation",
    },
}


class ProtocolError(ValueError):
    """Raised when a review protocol artifact is incomplete or inconsistent."""


def _object(value: Any, context: str) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise ProtocolError(f"{context} must be an object.")
    return value


def _require_exact_fields(value: dict[str, Any], expected: set[str], context: str) -> None:
    missing = sorted(expected - value.keys())
    unexpected = sorted(value.keys() - expected)
    if missing or unexpected:
        raise ProtocolError(
            f"{context} does not match the exact schema: "
            f"missing={missing}, unexpected={unexpected}."
        )


def _array(value: Any, context: str) -> list[Any]:
    if not isinstance(value, list):
        raise ProtocolError(f"{context} must be an array.")
    return value


def _text(value: Any, context: str, *, concrete: bool = False) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ProtocolError(f"{context} must be a nonempty string.")
    if concrete and value.strip().lower() in SENTINELS:
        raise ProtocolError(f"{context} must contain concrete evidence.")
    return value


def _strings(value: Any, context: str) -> list[str]:
    result = [
        _text(item, f"{context}[{index}]")
        for index, item in enumerate(_array(value, context))
    ]
    if len(result) != len(set(result)):
        raise ProtocolError(f"{context} must not contain duplicates.")
    return result


def _integer(value: Any, context: str, *, minimum: int) -> int:
    if type(value) is not int or value < minimum:
        qualifier = "positive" if minimum == 1 else "nonnegative"
        raise ProtocolError(f"{context} must be a {qualifier} integer.")
    return value


def _at(value: dict[str, Any], dotted_path: str) -> Any:
    current: Any = value
    for part in dotted_path.split("."):
        if not isinstance(current, dict) or part not in current:
            raise ProtocolError(f"Missing required packet field: {dotted_path}.")
        current = current[part]
    return current


FileIdentity = tuple[int, int]


def _read_bytes(value: Any, context: str) -> tuple[Path, bytes, FileIdentity]:
    requested_path = Path(_text(value, context, concrete=True))
    if not requested_path.is_absolute():
        raise ProtocolError(f"{context} must be an absolute path: {requested_path}.")
    try:
        path = requested_path.resolve(strict=True)
        data, file_stat = _read_regular_file(path)
    except _NonRegularFileError as error:
        raise ProtocolError(f"{context} must be a regular file: {requested_path}.") from error
    except (OSError, ValueError) as error:
        raise ProtocolError(f"Cannot read {context} {requested_path}: {error}") from error
    return path, data, (file_stat.st_dev, file_stat.st_ino)


def _json_bytes(data: bytes, context: str) -> dict[str, Any]:
    def unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for key, value in pairs:
            if key in result:
                raise ProtocolError(f"Duplicate JSON key in {context}: {key!r}.")
            result[key] = value
        return result

    def reject_constant(value: str) -> None:
        raise ProtocolError(f"Non-finite JSON number in {context}: {value}.")

    def finite_float(value: str) -> float:
        parsed = float(value)
        if not math.isfinite(parsed):
            raise ProtocolError(f"Non-finite JSON number in {context}: {value}.")
        return parsed

    try:
        value = json.loads(
            data,
            object_pairs_hook=unique_object,
            parse_constant=reject_constant,
            parse_float=finite_float,
        )
    except ProtocolError:
        raise
    except (RecursionError, UnicodeError, ValueError) as error:
        raise ProtocolError(f"Cannot read JSON object from {context}: {error}") from error
    return _object(value, context)


def _load_json(path: Path) -> dict[str, Any]:
    _, data, _ = _read_bytes(str(path.resolve()), str(path))
    return _json_bytes(data, str(path))


def _descriptor(value: Any, context: str) -> tuple[Path, bytes, str, FileIdentity]:
    descriptor = _object(value, context)
    path, data, identity = _read_bytes(descriptor.get("path"), f"{context}.path")
    expected = _text(descriptor.get("sha256"), f"{context}.sha256")
    if not SHA256.fullmatch(expected):
        raise ProtocolError(f"{context}.sha256 must be a lowercase SHA-256 digest.")
    actual = hashlib.sha256(data).hexdigest()
    if actual != expected:
        raise ProtocolError(f"{context} digest mismatch for {path}.")
    return path, data, actual, identity


def _read_unchanged(path: Path, expected_digest: str, context: str) -> bytes:
    _, data, _ = _read_bytes(str(path.resolve()), context)
    if hashlib.sha256(data).hexdigest() != expected_digest:
        raise ProtocolError(f"{context} changed during protocol validation.")
    return data


def _pathspec_file(value: Any, context: str) -> list[str]:
    _, data, _ = _read_bytes(value, context)
    try:
        lines = [line for line in data.decode().splitlines() if line]
    except UnicodeError as error:
        raise ProtocolError(f"Cannot decode {context}: {error}") from error
    if not lines or len(lines) != len(set(lines)):
        raise ProtocolError(f"{context} must contain unique nonempty pathspecs.")
    return lines


def
```

### Core Architecture Module: `.agents/skills/implementation-final-review/scripts/review_state.py`
```
#!/usr/bin/env python3
"""Print deterministic content and repository fingerprints for a review state."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath


def _git(repo: Path, *args: str) -> bytes:
    return subprocess.check_output(
        ("git", "-C", os.fspath(repo), *args), stderr=subprocess.PIPE
    )


def _git_diff(repo: Path, *args: str) -> bytes:
    completed = subprocess.run(
        ("git", "-C", os.fspath(repo), *args),
        capture_output=True,
    )
    if completed.returncode not in {0, 1}:
        raise subprocess.CalledProcessError(
            completed.returncode,
            completed.args,
            output=completed.stdout,
            stderr=completed.stderr,
        )
    return completed.stdout


def _digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


@dataclass(frozen=True, slots=True)
class _Snapshot:
    tracked_diff: bytes
    complete_diff: bytes
    status: bytes
    workspace: list[dict[str, object]]
    unfiltered_status: bytes
    unfiltered_workspace: list[dict[str, object]]
    component_workspaces: dict[str, list[dict[str, object]]]


class _NonRegularFileError(ValueError):
    pass


def _nonblocking_opener(path: str, flags: int) -> int:
    return os.open(path, flags | getattr(os, "O_NONBLOCK", 0))


def _read_regular_file(path: Path) -> tuple[bytes, os.stat_result]:
    with open(path, "rb", opener=_nonblocking_opener) as file:
        file_stat = os.fstat(file.fileno())
        if not stat.S_ISREG(file_stat.st_mode):
            raise _NonRegularFileError(path)
        return file.read(), file_stat


def _unsafe_index_paths(repo: Path) -> tuple[tuple[str, str], ...]:
    raw_entries = _git(repo, "ls-files", "-v", "-z")
    unsafe_paths: list[tuple[str, str]] = []
    for entry in raw_entries.split(b"\0"):
        if len(entry) < 3 or entry[1:2] != b" ":
            continue
        tag = entry[:1]
        relative_path = os.fsdecode(entry[2:])
        if tag.islower():
            unsafe_paths.append(("assume-unchanged", relative_path))
        elif tag == b"S":
            candidate = repo / relative_path
            if candidate.exists() or candidate.is_symlink():
                unsafe_paths.append(("materialized skip-worktree", relative_path))
    for entry in _git(repo, "ls-files", "--unmerged", "-z").split(b"\0"):
        _, separator, raw_path = entry.partition(b"\t")
        if separator:
            unsafe_paths.append(("unmerged", os.fsdecode(raw_path)))
    return tuple(sorted(set(unsafe_paths)))


def _require_reviewable_index(repo: Path, context: str = "repository") -> None:
    unsafe_paths = _unsafe_index_paths(repo)
    if unsafe_paths:
        details = ", ".join(f"{kind}={path}" for kind, path in unsafe_paths)
        raise ValueError(f"The {context} contains unsupported index state: {details}")


def _index_gitlinks(repo: Path) -> dict[str, str]:
    raw_entries = _git(repo, "ls-files", "--stage", "-z")
    gitlinks: dict[str, str] = {}
    for raw_entry in raw_entries.split(b"\0"):
        metadata, separator, raw_path = raw_entry.partition(b"\t")
        fields = metadata.split()
        if separator and len(fields) == 3 and fields[0] == b"160000" and fields[2] == b"0":
            gitlinks[os.fsdecode(raw_path)] = fields[1].decode()
    return gitlinks


def _is_repository_root(path: Path) -> bool:
    try:
        top_level = _git(path, "rev-parse", "--show-toplevel")
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False
    return Path(os.fsdecode(top_level.rstrip(b"\n"))).resolve() == path.resolve()


def _require_clean_submodule(
    repo: Path,
    display_path: str,
    expected_head: str,
    ancestors: frozenset[Path],
) -> None:
    resolved_repo = repo.resolve()
    if resolved_repo in ancestors:
        raise ValueError(f"Cyclic submodule worktree is unsupported: {display_path}")
    ancestors |= {resolved_repo}
    _require_reviewable_index(repo, f"submodule {display_path}")
    actual_head = _git(repo, "rev-parse", "HEAD^{commit}").decode().strip()
    if actual_head != expected_head:
        raise ValueError(f"Submodule HEAD does not match the parent index: {display_path}")
    for nested_relative_path, nested_head in _index_gitlinks(repo).items():
        nested_path = repo / nested_relative_path
        _require_clean_gitlink(
            nested_path,
            f"{display_path}/{nested_relative_path}",
            nested_head,
            ancestors,
        )
    if _git(
        repo,
        "status",
        "--porcelain=v1",
        "-z",
        "--untracked-files=all",
        "--ignore-submodules=none",
    ):
        raise ValueError(f"Dirty submodule worktrees are unsupported: {display_path}")


def _require_clean_gitlink(
    path: Path,
    display_path: str,
    expected_head: str,
    ancestors: frozenset[Path],
) -> None:
    if _is_repository_root(path):
        _require_clean_submodule(path, display_path, expected_head, ancestors)
    elif path.is_dir() and any(path.iterdir()):
        raise ValueError(f"Materialized gitlink is not an initialized submodule: {display_path}")


def _require_clean_submodules(repo: Path) -> None:
    ancestors = frozenset({repo.resolve()})
    for relative_path, expected_head in _index_gitlinks(repo).items():
        _require_clean_gitlink(
            repo / relative_path,
            relative_path,
            expected_head,
            ancestors,
        )


def _write_bytes_atomically(path: Path, data: bytes) -> None:
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=".review-state-diff-",
        dir=path.parent,
    )
    try:
        with os.fdopen(descriptor, "wb") as temporary_file:
            temporary_file.write(data)
        os.replace(temporary_name, path)
    finally:
        try:
            os.unlink(temporary_name)
        except FileNotFoundError:
            pass


def _directory_is_within(path: Path, root: Path) -> bool:
    current = path
    while True:
        try:
            if current.samefile(root):
                return True
        except OSError:
            pass
        parent = current.parent
        if parent == current:
            return False
        current = parent


def _canonical_pathspecs(pathspecs: tuple[str, ...]) -> tuple[str, ...]:
    canonical: list[str] = []
    seen: set[str] = set()
    for pathspec in pathspecs:
        if not pathspec:
            raise ValueError("Pathspecs must not be empty.")
        if "\0" in pathspec:
            raise ValueError("Pathspecs must not contain NUL bytes.")
        if pathspec not in seen:
            canonical.append(pathspec)
            seen.add(pathspec)
    return tuple(canonical)


def _base_has_literal_path(repo: Path, base: str, pathspec: str) -> bool:
    raw_path = os.fsencode(pathspec)
    entries = _git(
        repo,
        "ls-tree",
        "-z",
        base,
        "--",
        f":(literal){pathspec}",
    )
    for entry in entries.split(b"\0"):
        metadata, separator, entry_path = entry.partition(b"\t")
        fields = metadata.split()
        if separator and entry_path == raw_path and len(fields) >= 2 and fields[1] != b"tree":
            return True
    return False


def _load_pathspec_file(path: Path) -> tuple[str, ...]:
    try:
        data, _ = _read_regular_file(path)
        values = [line for line in data.decode().splitlines() if line]
    except (OSError, UnicodeError, ValueError) as error:
        raise ValueError(f"Cannot read pathspec file {path}: {error}") from error
    return _canonical_pathspecs(tuple(values))


def _read_workspace_file(path: Path, relative_path: str) -> tuple[bytes, os.stat_result]:
    try:
        return _read_regular_file(path)
    except _NonRegularFileError as error:
        raise ValueError(f"Unsupported workspace file typ
```

### Core Architecture Module: `.agents/skills/implementation-kickoff/scripts/validate_handoff.py`
```
#!/usr/bin/env python3
"""Validate the Git invariants of an implementation-kickoff handoff."""

from __future__ import annotations

import argparse
import json
import os
import re
import stat
import subprocess
import sys
from pathlib import Path, PurePosixPath


class GitCommandError(RuntimeError):
    """Report a failed Git inspection command."""


def run_git(
    repo: Path, *args: str, check: bool = True
) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(
        ["git", *args],
        cwd=repo,
        check=False,
        capture_output=True,
        text=True,
        errors="surrogateescape",
    )
    if check and result.returncode != 0:
        command = "git " + " ".join(args)
        detail = result.stderr.strip() or result.stdout.strip() or "unknown Git error"
        raise GitCommandError(f"{command} failed: {detail}")
    return result


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate a clean, single-commit implementation-kickoff handoff."
    )
    parser.add_argument(
        "--repo", type=Path, required=True, help="Path to the task worktree."
    )
    parser.add_argument(
        "--base",
        required=True,
        help="Expected parent commit or ref for the single handoff commit.",
    )
    parser.add_argument(
        "--expected-branch",
        required=True,
        help="Exact local branch name expected at HEAD.",
    )
    parser.add_argument(
        "--required-trailer-email",
        action="append",
        default=[],
        help="Email that must appear in a Co-authored-by trailer. Repeat as needed.",
    )
    parser.add_argument(
        "--shipped-path-manifest",
        type=Path,
        help=(
            "File containing the exact repository-relative paths expected in the handoff commit, "
            "one per line."
        ),
    )
    parser.add_argument("--json", action="store_true", help="Emit the result as JSON.")
    return parser.parse_args()


def _nonblocking_opener(path: str, flags: int) -> int:
    return os.open(path, flags | getattr(os, "O_NONBLOCK", 0))


def load_shipped_paths(path: Path) -> set[str]:
    with open(path, "rb", opener=_nonblocking_opener) as file:
        if not stat.S_ISREG(os.fstat(file.fileno()).st_mode):
            raise ValueError(f"Shipped-path manifest must be a regular file: {path}")
        lines = file.read().decode().splitlines()
    if not lines:
        raise ValueError(f"Shipped-path manifest is empty: {path}")

    shipped_paths: set[str] = set()
    for line_number, raw_path in enumerate(lines, start=1):
        if not raw_path:
            raise ValueError(
                f"Shipped-path manifest contains a blank line at {line_number}."
            )
        path_value = PurePosixPath(raw_path)
        if (
            path_value.is_absolute()
            or ".." in path_value.parts
            or str(path_value) != raw_path
        ):
            raise ValueError(
                "Shipped-path manifest entries must be normalized repository-relative paths: "
                f"{raw_path!r}."
            )
        if raw_path in shipped_paths:
            raise ValueError(f"Duplicate shipped-path manifest entry: {raw_path}")
        shipped_paths.add(raw_path)
    return shipped_paths


def is_repository_root(path: Path) -> bool:
    if not path.is_dir():
        return False
    result = run_git(path, "rev-parse", "--show-toplevel", check=False)
    return result.returncode == 0 and Path(result.stdout.strip()).resolve() == path.resolve()


def hidden_index_paths(
    repo: Path,
    prefix: str = "",
    seen_repositories: frozenset[Path] = frozenset(),
) -> list[str]:
    resolved_repo = repo.resolve()
    if resolved_repo in seen_repositories:
        return []
    seen_repositories |= {resolved_repo}

    def display_path(relative_path: str) -> str:
        return f"{prefix}/{relative_path}" if prefix else relative_path

    hidden_paths: list[str] = []
    for entry in run_git(repo, "ls-files", "-v", "-z").stdout.split("\0"):
        if len(entry) < 3 or entry[1] != " ":
            continue
        tag = entry[0]
        relative_path = entry[2:]
        if tag.islower():
            hidden_paths.append(f"assume-unchanged={display_path(relative_path)}")
        elif tag == "S":
            candidate = repo / relative_path
            if candidate.exists() or candidate.is_symlink():
                hidden_paths.append(f"materialized skip-worktree={display_path(relative_path)}")
    for entry in run_git(repo, "ls-files", "--stage", "-z").stdout.split("\0"):
        metadata, separator, relative_path = entry.partition("\t")
        fields = metadata.split()
        if not separator or len(fields) != 3 or fields[0] != "160000" or fields[2] != "0":
            continue
        submodule_path = repo / relative_path
        if is_repository_root(submodule_path):
            hidden_paths.extend(
                hidden_index_paths(
                    submodule_path,
                    display_path(relative_path),
                    seen_repositories,
                )
            )
    return sorted(hidden_paths)


def validate(args: argparse.Namespace) -> tuple[dict[str, object], list[str]]:
    repo = args.repo.expanduser().resolve()
    failures: list[str] = []

    if not repo.is_dir():
        return {"repo": str(repo), "valid": False}, [f"Repository path does not exist: {repo}"]

    top_level = Path(
        run_git(repo, "rev-parse", "--show-toplevel").stdout.strip()
    ).resolve()
    if top_level != repo:
        failures.append(
            f"--repo must be the worktree root: expected {top_level}, got {repo}"
        )

    status = run_git(
        repo,
        "status",
        "--porcelain=v1",
        "--untracked-files=all",
        "--ignore-submodules=none",
    ).stdout
    if status:
        failures.append("Worktree is not clean.")
    hidden_paths = hidden_index_paths(repo)
    if hidden_paths:
        failures.append(f"Index flags can hide worktree changes: {hidden_paths}.")

    branch_result = run_git(
        repo, "symbolic-ref", "--quiet", "--short", "HEAD", check=False
    )
    branch = branch_result.stdout.strip() if branch_result.returncode == 0 else None
    if branch is None:
        failures.append("HEAD is detached.")
    elif branch != args.expected_branch:
        failures.append(
            f"Current branch is {branch!r}, expected {args.expected_branch!r}."
        )

    base = run_git(repo, "rev-parse", f"{args.base}^{{commit}}").stdout.strip()
    head = run_git(repo, "rev-parse", "HEAD").stdout.strip()
    parent_line = run_git(repo, "show", "-s", "--format=%P", "HEAD").stdout.strip()
    parents = parent_line.split() if parent_line else []
    if len(parents) != 1:
        failures.append(f"HEAD must have exactly one parent, found {len(parents)}.")
    elif parents[0] != base:
        failures.append(f"HEAD parent is {parents[0]}, expected base {base}.")

    ahead_text = run_git(repo, "rev-list", "--count", f"{base}..{head}").stdout.strip()
    ahead = int(ahead_text)
    if ahead != 1:
        failures.append(
            f"HEAD must be exactly one commit ahead of base, found {ahead} commits."
        )

    shipped_manifest: str | None = None
    shipped_paths: list[str] | None = None
    if args.shipped_path_manifest is not None:
        manifest_path = args.shipped_path_manifest.expanduser().resolve()
        expected_paths = load_shipped_paths(manifest_path)
        actual_paths = {
            path
            for path in run_git(
                repo,
                "diff",
                "--name-only",
                "--no-renames",
                "-z",
                f"{base}..{head}",
            ).stdout.split("\0")
            if path
        }
        missing_paths = sorted(expected_paths - actual_paths)
        unexpected_paths = sorted(actual_paths - expected_paths)
        if missing_paths or unexpected_paths:
  
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1435** (2026-07-02): **Consecutive tool call approvals fail in a streamed run with `previousResponseId`**
  *Symptoms*: ### Please read this first  - **Have you read the docs?** [Agents SDK docs](https://openai.github.io/openai-agents-js/) - **Have you searched for related issues?** Others may have faced similar issues.  ### Describe the bug  When a streamed run is started with `previousResponseId` and then resumed more than one tool-approval interruption, the run fails with: `400 No tool call found for function call output with call_id <id>`  ### Debug information  - Agents SDK version: v0.11.6 - Runtime environment: Node.js v24.12.0  ### Repro steps  1. Start a streamed run with previousResponseId set. 2. Agent calls an approval-gated tool → interruption. Approve. 3. Agent does more work, then calls another approval-gated tool → second interruption. Approve. 4. SDK sends back second approval including the first tool's `function_call_output` again, but `previous_response_id` now points past its `function_call` -> 400 error  ```js import { Agent, run, tool } from '@openai/agents'; import { z } from 'zod';  const ping = tool({   name: 'ping',   description: 'Ping a host.',   parameters: z.object({ host: z.string() }),   needsApproval: true,   execute: async ({ host }) => `pong ${host}`, });  const agent = new Agent({   name: 'repro',   model: 'gpt-5.4',   instructions:     'Call ping for "example.com", then AFTER it returns call ping again for "google.com". One at a time.',   tools: [ping], });  // Seed a first response so the failing run starts with previousResponseId set. const seed = await r

- **Issue #1340** (2026-05-21): **extractUsage does not propagate outputTokensDetails (reasoning tokens lost in tracing)**
  *Symptoms*: ### Please read this first  - **Have you read the docs?** Yes - **Have you searched for related issues?** Yes, no existing issues for this.  ### Describe the bug  `extractUsage` in `packages/agents-extensions/src/ai-sdk/index.ts` extracts `inputTokensDetails` (cache read/write tokens) but does not extract `outputTokensDetails`. When models use reasoning effort > `'none'`, the AI SDK provider reports output tokens as `{ total: N, reasoning: M }`. The `extractTokenCount` helper correctly reads `.total` for the aggregate count, but the `.reasoning` breakdown is discarded and never propagated to tracing spans via `toTracingUsage`.  This means `GenerationSpanData.usage` never contains output token details (reasoning tokens), making it impossible for downstream tracing/observability integrations to report per-span reasoning token breakdowns.  ### Debug information  - Agents SDK version: `@openai/agents-extensions@0.11.3` (also verified at HEAD/0.11.4) - Runtime environment: Node.js 22.x - AI SDK versions: `ai@^6.0.0`, `@ai-sdk/provider@^3.0.0`  ### Repro steps  1. Configure an agent with a GPT-5.x model using `reasoning: { effort: 'low' }` via the `aisdk()` adapter from `@openai/agents-extensions/ai-sdk` 2. Run the agent and inspect `GenerationSpanData.usage` in a `TracingProcessor.onSpanEnd` callback 3. Observe that `usage` contains `input_tokens`, `output_tokens`, and optionally `input_tokens_details` (with `cached_tokens`) 4. `output_tokens_details` / `reasoning_tokens` is never

- **Issue #1190** (2026-05-05): **`run()` abort with `conversationId` leaves orphan `function_call` items in the conversation store**
  *Symptoms*: ### Please read this first  - **Have you read the docs?** [Agents SDK docs](https://openai.github.io/openai-agents-js/) Yes - **Have you searched for related issues?** Others may have faced similar issues. Yes  ### Describe the bug  When a streamed `run()` is aborted via its `signal` after the model has emitted one or more `function_call`s but before the SDK executes the tools and sends the corresponding `function_call_output`s, those calls stay in the server-side conversation store without outputs. Any later `run()` against the same `conversationId` fails with:  > 400 No tool output found for function call call_XXX  ### Our use case We run an SSE endpoint that pipes `run(agent, input, { stream: true, conversationId, signal: controller.signal })` to the client. We wire `controller.abort()` to `req.on('aborted')` / `req.on('close')` to stop the run when the user closes the tab, refreshes, or loses the network. Whenever that happens mid tool-call, the conversation becomes unusable and we have to reconcile orphan items manually via the Conversations API.  ### Reproduction ```js const controller = new AbortController(); const stream = await run(agent, input, {   stream: true,   conversationId,   signal: controller.signal, }); for await (const e of stream) { /* consume */ } ``` Call `controller.abort()` while the model is streaming a `function_call`, then start a new `run()` against the same `conversationId`.  ### Root cause In `@openai/agents-core`, `run.js` around the streamed r
  **Post-Mortem & Fix Analysis**:
  > Hi @seratch, would love to take a stab at this. Posting a proposed approach first to confirm scope before opening a PR.  ## Proposed fix  In `packages/agents-core/src/run.ts` (around the streamed-response loop at L1170–1233), I'd:  1. **Track `function_call` items as they're streamed** — collect call IDs from `event.type === 'response.output_item.added'` (or equivalent) when the item type is `function_call`, into a `pendingFunctionCalls: Map<callId, FunctionCallItem>`. 2. **Reconcile on `response_done`** — clear entries whose tool outputs we know we'll execute below, so successful turns are unaffected. 3. **In the `isAbortError` branch (L1225)** — if `serverConversationTracker?.conversationId` is set AND `pendingFunctionCalls` is non-empty, POST synthetic `function_call_output` items to `/v1/conversations/{conversationId}/items` (one per orphaned call) before returning. Synthetic body: `{ output: 'aborted' }` with `status: 'incomplete'` (matches the precedent set in #1110 for rejected 
  > Put together a fix in https://github.com/openai/openai-agents-js/pull/1198.

- **Issue #1176** (2026-04-17): **Session compaction converts prompt to invalid format**
  *Symptoms*: ### Please read this first  - **Have you read the docs?** yes - **Have you searched for related issues?** yes  ### Describe the bug  After OpenAIResponsesCompactionSession runs compaction it converts prompt images to Responses API format which is not supported by Agents SDK. That means, it changes `{type: 'input_image', image: 'data:image/jpeg;base64,xxx'}` to: `{type: 'input_image', detail:'auto', file_id:null, image_url: 'data:image/jpeg;base64,xxx'}`  ### Debug information  - Agents SDK version: (e.g. `v0.8.3`) - Runtime environment (e.g. `Node.js 24.11.1`)  ### Repro steps  ``` const session = new OpenAIResponsesCompactionSession({ 	client: openai, 	model: 'gpt-5.4', 	underlyingSession: new MemorySession(), 	shouldTriggerCompaction: ({ compactionCandidateItems }) => { 		return compactionCandidateItems.length >= 2; 	} }); const content = [ 	{type: 'input_text', text: 'analyse these images'}, 	{type: 'input_image', image: `data:image/jpeg;base64,${Buffer.from(datafile).toString('base64')}`}, ]; const history = [ 	{role: 'user', content}, 	{role: 'assistant', content: [{type: 'output_text', text: 'how can I help?'}]}, ]; const prompt = [{role: 'user', content: [{type: 'input_text', text: 'analyse these images'}]}];  await session.addItems(history); await session.runCompaction();  const agent = new Agent({name: 'agent', model: 'gpt-5.4', modelSettings: {store: false}}); const res = await run(agent, prompt, {session}); ```  ### Error Error: 400 Missing mutually exclusive param

- **Issue #1163** (2026-04-15): **Bug: Using Twilio Transport extension causes session options specified in non-deprecated format to be silently ignored**
  *Symptoms*: ### Please read this first  - **Have you read the docs?** [Agents SDK docs](https://openai.github.io/openai-agents-js/) - **Have you searched for related issues?** Others may have faced similar issues.  ### Describe the bug  Using the Twilio extension forces session options to use the "deprecated" format. It also causes RealtimeSession to silently drop the majority of options if specified in the current preferred format. The issue is that [the code ](https://github.com/openai/openai-agents-js/blob/a9e224a32999860b470affcd51adba160f7f9ade/packages/agents-extensions/src/TwilioRealtimeTransport.ts#L69-L88) assigns the audio types to properties that trigger the legacy deprecated check, and causes a change in the session options format internally, which drops the passed values.  Not sure what the best backwards compatible fix for this would be. Maybe check if the partialConfig has attributes in the non-deprecated paths, and assign the ulav values either to new or old props based on that?  ### Debug information  - Agents SDK version: v.0.8.3 - Runtime environment (e.g. `Node.js 22.16.0`)  ### Repro steps If you create a session like so: ``` this.sessionOptions = {         model: config.model,         config: {           ...(inputTranscription && { input_audio_transcription: inputTranscription }),           audio: {             input: {               turnDetection: config.turnDetection,               noiseReduction: config.noiseReduction || { type: 'near_field' },               ...(
  **Post-Mortem & Fix Analysis**:
  > And this is the [location](https://github.com/openai/openai-agents-js/blob/a9e224a32999860b470affcd51adba160f7f9ade/packages/agents-realtime/src/clientMessages.ts#L181) that trips it inside the core Realtime when it is called in [here](https://github.com/openai/openai-agents-js/blob/a9e224a32999860b470affcd51adba160f7f9ade/packages/agents-realtime/src/clientMessages.ts#L202). So in essence, when the audio format fields are added by the Twilio extension, it deprecates any config passed in automatically.

- **Issue #972** (2026-02-16): **Built-in tools (shellTool, applyPatchTool, computerTool) don’t emit tracing spans**
  *Symptoms*: ### Please read this first  - **Have you read the docs?** [Agents SDK docs](https://openai.github.io/openai-agents-js/) - **Have you searched for related issues?** Others may have faced similar issues.  > Note: I have used AI to produce a detailed bug report description. The bug is real though.  ### Describe the bug  Built-in tools (`shellTool`, `applyPatchTool`, `computerTool`) do not create tracing spans when executed. Only regular function tools (created with `tool()`) produce `function`-type spans via `withFunctionSpan()`.  In `packages/agents-core/src/runner/toolExecution.ts`:  - `runApprovedFunctionTool()` (line 346) wraps execution in `withFunctionSpan()` — spans appear in traces. - `executeShellActions()` (line 675) only calls `emitToolStart()`/`emitToolEnd()` — **no tracing span is created**. - Same for `executeApplyPatchOperations()` and `executeComputerActions()`.  This means any `TracingExporter` (e.g. a custom OTLP exporter or `ConsoleSpanExporter`) will never receive spans for built-in tool executions, making it impossible to observe tool calls in trace UIs.  ### Debug information  - Agents SDK version: `v0.4.8` (`@openai/agents-core`) - Runtime environment: `Node.js v24.12.0`  ### Repro steps  1. Add a `ConsoleSpanExporter` to `examples/tools/local-shell.ts`: ```typescript import { ConsoleSpanExporter, BatchTraceProcessor, setTraceProcessors } from '@openai/agents';  setTraceProcessors([new BatchTraceProcessor(new ConsoleSpanExporter())]); ```  2. Run the examp
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this issue. We'll resolve it in the next release.

- **Issue #955** (2026-02-13): **Write cache tokens are not reported in span data from vercel ai SDK**
  *Symptoms*:  Following up this [issue](https://github.com/openai/openai-agents-js/issues/945).  Some providers charge for cache tokens writes(basically only Anthropic - from [AWS Bedrock](https://aws.amazon.com/bedrock/pricing/) and [Anthropic API](https://platform.claude.com/docs/en/about-claude/pricing)). Reporting this cache writes helps for calculating the cost of features.  AI SDK reports this as `cacheWrite` under `inputTokens`(see [LanguageModelV3Usage](https://github.com/vercel/ai/blob/99e3a4631f68207e157e8caf2abfe24038511437/packages/provider/src/language-model/v3/language-model-v3-usage.ts#L6)).  Exposing it in [`extractCachedInputTokens`](https://github.com/openai/openai-agents-js/blob/9b1386ad86066313d20315af7ae8dfa7e3ab5f46/packages/agents-extensions/src/ai-sdk/index.ts#L1573C10-L1573C34) will help report this data point to observability platforms.  ### Debug information  - Agents SDK version: (e.g. `v0.4.7`) - Runtime environment (e.g. `Node.js 22.19.0`) ``` "@ai-sdk/amazon-bedrock": "^4.0.24", "@ai-sdk/anthropic": "^3.0.18", "@ai-sdk/google-vertex": "^4.0.23", ```  ### Expected behavior  report token cache writes for Generation spans

- **Issue #945** (2026-02-09): **Cache tokens are not reported in span data from vercel ai SDK**
  *Symptoms*:   ### Describe the bug  I am currently using Bedrock with Vercel AI as model provider.  I noticed that cache tokens are not extracted and reported in the span data(I am using [braintrust integration](https://github.com/braintrustdata/braintrust-sdk/blob/10e2d2237b0791683386e551bd4be79cf86367db/integrations/openai-agents-js/src/index.ts#L409) as my observability platform) - they expect the `usage.input_tokens_details?.cached_tokens` to be reported in the span data. Seems like [extractTokenCount](https://github.com/openai/openai-agents-js/blob/2e8bbbd767a1afd65a9efb198de41dd579f19ea3/packages/agents-extensions/src/ai-sdk/index.ts#L1567) don't populate `input_tokens_details` and read `cacheRead` property defined in [LanguageModelV3Usage](https://github.com/vercel/ai/blob/99e3a4631f68207e157e8caf2abfe24038511437/packages/provider/src/language-model/v3/language-model-v3-usage.ts#L6) in the vercel AI SDK and omits the cache reads.  What should be the expected result? what is the right shape of the usage object in the span?   ### Debug information  - Runtime environment - `Node.js 22.19.0`  My versions:  ```     "@ai-sdk/amazon-bedrock": "^4.0.24",     "@braintrust/openai-agents": "^0.1.2",     "@openai/agents": "^0.4.1",     "@openai/agents-extensions": "^0.4.1", ```  I created custom trace processor that replicates this:  ``` class CacheUsageTraceProcessor implements TracingProcessor {   async onTraceStart(): Promise<void> {}   async onTraceEnd(): Promise<void> {}   async onSpanSt

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

### Incident Patch 1: `fdaf0a66` (2026-09-25)
**Commit Message**: fix(agents-core): handle same-server MCP tool name collisions (#1935)

**File**: `.changeset/mcp-intra-server-tool-name-collisions.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@openai/agents-core': patch
+---
+
+fix: handle MCP tools from one server whose names normalize to the same function tool name
```

**File**: `packages/agents-core/src/mcp.ts` (modified, +39/-16)
```diff
@@ -58,6 +58,7 @@ import {
   assertOpenAIStrictToolSchemaPreservesOpenObjects,
   isJsonSchemaDepthError,
 } from './utils/strictToolSchema';
+import { toFunctionToolName } from './utils/tools';
 import type {
   ToolInputGuardrailDefinition,
   ToolOutputGuardrailDefinition,
@@ -882,13 +883,13 @@ export async function getAllMcpTools<TContext = UnknownContext>(
           toolNameOverrides.get(getToolNameOverrideKey(serverIndex, toolIndex)),
         ),
       });
-      const serverToolNames = new Set(serverTools.map((t) => t.name));
-      const intersection = [...serverToolNames]
-        .filter((n) => toolNames.has(n))
-        .sort();
-      if (intersection.length > 0) {
+      const duplicateToolNames = findDuplicateToolNames(
+        serverTools.map((t) => t.name),
+        toolNames,
+      );
+      if (duplicateToolNames.length > 0) {
         throw new UserError(
-          `Duplicate tool names found across MCP servers: ${intersection.join(', ')}`,
+          `Duplicate tool names found across MCP servers: ${duplicateToolNames.join(', ')}`,
         );
       }
       for (const t of serverTools) {
@@ -910,13 +911,13 @@ export async function getAllMcpTools<TContext = UnknownContext>(
       errorFunction,
       tracingParent,
     });
-    const serverToolNames = new Set(serverTools.map((t) => t.name));
-    const intersection = [...serverToolNames]
-      .filter((n) => toolNames.has(n))
-      .sort();
-    if (intersection.length > 0) {
+    const duplicateToolNames = findDuplicateToolNames(
+      serverTools.map((t) => t.name),
+      toolNames,
+    );
+    if (duplicateToolNames.length > 0) {
       throw new UserError(
-        `Duplicate tool names found across MCP servers: ${intersection.join(', ')}`,
+        `Duplicate tool names found across MCP servers: ${duplicateToolNames.join(', ')}`,
       );
     }
     for (const t of serverTools) {
@@ -927,6 +928,25 @@ export async function getAllMcpTools<TContext = UnknownContext>(
   return allTools;
 }
 
+/**
+ * Returns the names that repeat within `names` or were already seen in
+ * `previousNames`.
+ */
+function findDuplicateToolNames(
+  names: string[],
+  previousNames: Set<string>,
+): string[] {
+  const seen = new Set(previousNames);
+  const duplicates = new Set<string>();
+  for (const name of names) {
+    if (seen.has(name)) {
+      duplicates.add(name);
+    }
+    seen.add(name);
+  }
+  return [...duplicates].sort();
+}
+
 function getToolNameOverrideKey(
   serverIndex: number,
   toolIndex: number,
@@ -1081,7 +1101,8 @@ function buildPrefixedToolNameOverrides(
     const serverName = getMcpServerExternalName(server.name);
     for (const mcpTool of mcpTools) {
       const baseName = buildPrefixedToolBaseName(serverName, mcpTool.name);
-      baseNameCounts.set(baseName, (baseNameCounts.get(baseName) ?? 0) + 1);
+      const publicName = toFunctionToolName(baseName);
+      baseNameCounts.set(publicName, (baseNameCounts.get(publicName) ?? 0) + 1);
     }
   }
 
@@ -1102,8 +1123,10 @@ function buildPrefixedToolNameOverrides(
         );
       }
       rawServerNamesBySeed.set(seed, server.name);
+      const functionToolName = toFunctionToolName(baseName);
       const forceHash =
-        (baseNameCounts.get(baseName) ?? 0) > 1 || reservedNames.has(baseName);
+        (baseNameCounts.get(functionToolName) ?? 0) > 1 ||
+        reservedNames.has(functionToolName);
       candidates.push({
         batchKey: getToolNameOverrideKey(serverIndex, toolIndex),
         baseName,
@@ -1127,7 +1150,7 @@ function buildPrefixedToolNameOverrides(
   })) {
     let publicName = candidate.initialName;
     let collisionIndex = 1;
-    while (usedNames.has(publicName)) {
+    while (usedNames.has(toFunctionToolName(publicName))) {
       publicName = shortenToolName(
         candidate.baseName,
         `${candidate.seed}\0${collisionIndex}`,
@@ -1136,7 +1159,7 @@ function buildPrefixedToolNameOverrides(
       collisionIndex += 1;
     }
 
-   
```

**File**: `packages/agents-core/test/mcpCache.test.ts` (modified, +85/-0)
```diff
@@ -7,6 +7,8 @@ import {
   MCPServerSSE,
 } from '../src/mcp';
 import { UserError } from '../src/errors';
+import { run } from '../src';
+import { ScriptedModel, assistantMessage, functionCall } from '../src/testing';
 import { tool, type FunctionTool } from '../src/tool';
 import { withTrace } from '../src/tracing';
 import { NodeMCPServerStdio } from '../src/shims/mcp-server/node';
@@ -622,6 +624,72 @@ describe('MCP tools uniqueness', () => {
     });
   });
 
+  it('throws when one server returns tool names that normalize to one function tool name', async () => {
+    await withTrace('test', async () => {
+      const server = new StubServer('docs', [
+        toolNamed('search-a'),
+        toolNamed('search_a'),
+      ]);
+
+      await expect(
+        getAllMcpTools({
+          mcpServers: [server],
+          runContext: new RunContext({}),
+          agent: new Agent({ name: 'AgentOne' }),
+        }),
+      ).rejects.toBeInstanceOf(UserError);
+    });
+  });
+
+  it.each([false, true])(
+    'invokes both tools of one server through run() with stream=%s',
+    async (stream) => {
+      await withTrace('test', async () => {
+        const server = new StubServer('docs', [
+          toolNamed('search-a'),
+          toolNamed('search_a'),
+        ]);
+        const callTool = vi.spyOn(server, 'callTool');
+
+        const agent = new Agent({
+          name: 'SameServerDuplicateToolsAgent',
+          mcpServers: [server],
+          mcpConfig: { includeServerInToolNames: true },
+        });
+
+        // The advertised names are what the model can call; the server still
+        // has to receive the original tool names it published.
+        const advertised = (await agent.getAllTools(new RunContext({}))).map(
+          (candidate) => candidate.name,
+        );
+        expect(new Set(advertised).size).toBe(2);
+
+        agent.model = new ScriptedModel([
+          [
+            functionCall(advertised[0]!, {}, { callId: 'search_dash' }),
+            functionCall(advertised[1]!, {}, { callId: 'search_underscore' }),
+          ],
+          [assistantMessage('both tools ran')],
+        ]);
+
+        let result;
+        if (stream) {
+          const streamed = await run(agent, 'search twice', { stream: true });
+          await streamed.completed;
+          result = streamed;
+        } else {
+          result = await run(agent, 'search twice');
+        }
+
+        expect(result.finalOutput).toBe('both tools ran');
+        expect(callTool.mock.calls.map(([name]) => name).sort()).toEqual([
+          'search-a',
+          'search_a',
+        ]);
+      });
+    },
+  );
+
   it('prefixes local MCP tool names with server names when requested', async () => {
     await withTrace('test', async () => {
       const serverA = new StubServer('docs', [
@@ -953,6 +1021,23 @@ describe('MCP tools uniqueness', () => {
           name.startsWith('mcp_docs__search_'),
         ),
       ).toBe(true);
+
+      const dashOrder = await publicNamesByOriginalTool([
+        'search-a',
+        'search_a',
+      ]);
+      const reversedDashOrder = await publicNamesByOriginalTool([
+        'search_a',
+        'search-a',
+      ]);
+
+      expect(dashOrder).toEqual(reversedDashOrder);
+      expect(new Set(Object.values(dashOrder)).size).toBe(2);
+      expect(
+        Object.values(dashOrder).every((name) =>
+          name.startsWith('mcp_docs__search_'),
+        ),
+      ).toBe(true);
     });
   });
 
```

---

### Incident Patch 2: `7b534bbf` (2026-09-25)
**Commit Message**: fix(realtime): preserve history order across overlapping edits (#1985)

* fix(realtime): keep conversation order when updateHistory corrects or inserts an item

`conversation.item.create` appends to the end of the conversation when
`previous_item_id` is omitted. `resetHistory()` omitted it for every item it
created, so correcting an item in the middle of the history -- which the voice
agent guide recommends for exactly that purpose -- moved it behind everything
that followed it. Inserting an item did the same.

The items are now walked in new-history order so each created item can name the
item it follows. Untouched items keep their place and can anchor the next
insert; a function call that could not be created does not, and neither does a
removed item.

An item with nothing before it is still created without `previous_item_id`.
The protocol accepts `previous_item_id: null` but does not document where that
places the item, so this leaves that case exactly as it was.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>

* fix(realtime): place a corrected or inserted first history item at the beginning

The previous revision omitted `previous_item_id` when an item had 

**File**: `.changeset/realtime-history-item-placement.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@openai/agents-realtime': patch
+---
+
+fix(realtime): keep conversation order when updateHistory corrects or inserts items, including overlapping edits
```

**File**: `packages/agents-realtime/src/openaiRealtimeBase.ts` (modified, +110/-12)
```diff
@@ -155,6 +155,12 @@ function cloneRealtimeEvent<T>(event: T): T {
   return JSON.parse(JSON.stringify(event)) as T;
 }
 
+/**
+ * Sentinel accepted by `conversation.item.create` that places the item at the
+ * beginning of the conversation. Omitting `previous_item_id` appends instead.
+ */
+const CONVERSATION_ROOT = 'root';
+
 export abstract class OpenAIRealtimeBase
   extends EventEmitterDelegate<OpenAIRealtimeEventTypes>
   implements RealtimeTransportLayer
@@ -163,6 +169,13 @@ export abstract class OpenAIRealtimeBase
   #apiKey: ApiKey | undefined;
   #tracingConfig: RealtimeTracingConfig | null = null;
   #rawSessionConfig: Record<string, any> | null = null;
+  // Requests stay in wire order so placement can project both removals and
+  // recreations while the session still exposes server-confirmed history.
+  #pendingHistoryRequests = new Map<
+    string,
+    { itemId: string; kind: 'create' | 'delete' }
+  >();
+  #historyRequestSeq = 0;
 
   protected eventEmitter: RuntimeEventEmitter<OpenAIRealtimeEventTypes> =
     new RuntimeEventEmitter<OpenAIRealtimeEventTypes>();
@@ -239,7 +252,17 @@ export abstract class OpenAIRealtimeBase
       return;
     }
 
+    if (parsed.type === 'conversation.item.added' && parsed.item.id) {
+      this.#settleHistoryRequest(parsed.item.id, 'create');
+    }
+
     if (parsed.type === 'error') {
+      // The Realtime API reports the offending client event under `error.event_id`.
+      const causedBy = (parsed.error as { event_id?: unknown } | undefined)
+        ?.event_id;
+      if (typeof causedBy === 'string') {
+        this.#pendingHistoryRequests.delete(causedBy);
+      }
       this.emit('error', { type: 'error', error: parsed });
     } else {
       this.emit(parsed.type, parsed);
@@ -308,6 +331,7 @@ export abstract class OpenAIRealtimeBase
     }
 
     if (parsed.type === 'conversation.item.deleted') {
+      this.#settleHistoryRequest(parsed.item_id, 'delete');
       this.emit('item_deleted', {
         itemId: parsed.item_id,
       });
@@ -381,11 +405,15 @@ export abstract class OpenAIRealtimeBase
         return;
       }
       if (parsed.item.type === 'message') {
+        // `null` here is the server saying the item has nothing before it, which
+        // is what decides where local history puts it. An event that does not
+        // carry the field says nothing about placement, so it stays undefined
+        // rather than claiming the front.
         const previousItemId =
           parsed.type === 'conversation.item.added' ||
           parsed.type === 'conversation.item.done'
             ? parsed.previous_item_id
-            : null;
+            : undefined;
         const item = realtimeMessageItemSchema.parse({
           itemId: parsed.item.id,
           previousItemId,
@@ -540,7 +568,35 @@ export abstract class OpenAIRealtimeBase
     this.emit('connected');
   }
 
+  // Successful replies identify the item, so retire its oldest matching request.
+  // `done` finalizes content and must not settle another create of the same ID.
+  #settleHistoryRequest(itemId: string, kind: 'create' | 'delete'): void {
+    for (const [eventId, request] of this.#pendingHistoryRequests) {
+      if (request.itemId === itemId && request.kind === kind) {
+        this.#pendingHistoryRequests.delete(eventId);
+        return;
+      }
+    }
+  }
+
+  #sendHistoryRequest(
+    itemId: string,
+    kind: 'create' | 'delete',
+    event: RealtimeClientMessage,
+  ): void {
+    const eventId = `agents_${kind}_${++this.#historyRequestSeq}`;
+    this.#pendingHistoryRequests.set(eventId, { itemId, kind });
+    try {
+      this.sendEvent({ ...event, event_id: eventId });
+    } catch (error) {
+      this.#pendingHistoryRequests.delete(eventId);
+      throw error;
+    }
+  }
+
   protected _onClose() {
+    // Unacknowledged requests belong only to the connection that sent them.
+    this.#pendingHistoryRequests.clear();
     this.emit('disconnected');
   }
 
@@ -1015,3
```

**File**: `packages/agents-realtime/src/utils.ts` (modified, +6/-0)
```diff
@@ -312,6 +312,12 @@ export function updateRealtimeHistory(
       }
       return item;
     });
+  } else if ((event as any).previousItemId === null) {
+    // The server reported no predecessor, so the item belongs at the front --
+    // this is how a `previous_item_id: 'root'` create comes back. An event that
+    // simply omits the field falls through to the append below: absent is not
+    // the same claim as first.
+    return [newEvent, ...history];
   } else if ((event as any).previousItemId) {
     // Insert after previousItemId if found, else at end
     const prevIndex = history.findIndex(
```

**File**: `packages/agents-realtime/test/historyPlacement.test.ts` (added, +290/-0)
```diff
@@ -0,0 +1,290 @@
+import { describe, expect, it, vi } from 'vitest';
+import { OpenAIRealtimeBase } from '../src/openaiRealtimeBase';
+import { RealtimeAgent } from '../src/realtimeAgent';
+import { RealtimeSession } from '../src/realtimeSession';
+import type { RealtimeItem, RealtimeMessageItem } from '../src/items';
+import type { RealtimeClientMessage } from '../src/clientMessages';
+
+const message = (itemId: string, text = itemId): RealtimeMessageItem => ({
+  itemId,
+  type: 'message',
+  role: 'user',
+  status: 'completed',
+  content: [{ type: 'input_text', text }],
+});
+
+// Model the provider's placement rules while controlling wire acknowledgements.
+// A scripted session transport bypasses the base transport's request tracking.
+class HistoryTransport extends OpenAIRealtimeBase {
+  status = 'connected' as const;
+  connect = vi.fn(async () => {});
+  mute = vi.fn();
+  interrupt = vi.fn();
+  get muted() {
+    return false;
+  }
+  close() {
+    this._onClose();
+  }
+  history: RealtimeMessageItem[] = [];
+  replies: Record<string, unknown>[] = [];
+  sent: RealtimeClientMessage[] = [];
+  failNextCreate = false;
+  throwNextSend = false;
+  #sequence = 0;
+
+  deliver(reply: Record<string, unknown>) {
+    this._onMessage({
+      data: JSON.stringify({
+        event_id: `server_${++this.#sequence}`,
+        ...reply,
+      }),
+    } as MessageEvent);
+  }
+
+  flush() {
+    while (this.replies.length) this.deliver(this.replies.shift()!);
+  }
+
+  seed(items: RealtimeMessageItem[]) {
+    this.history = [...items];
+    for (const [index, item] of items.entries()) {
+      this.deliver(this.added(item, items[index - 1]?.itemId ?? null));
+    }
+  }
+
+  added(item: RealtimeMessageItem, predecessor: string | null) {
+    const { itemId, ...wireItem } = item;
+    return {
+      type: 'conversation.item.added',
+      previous_item_id: predecessor,
+      item: { ...wireItem, id: itemId },
+    };
+  }
+
+  sendEvent(event: RealtimeClientMessage) {
+    if (this.throwNextSend) {
+      this.throwNextSend = false;
+      throw new Error('send failed');
+    }
+    this.sent.push(event);
+    if (event.type === 'conversation.item.delete') {
+      const index = this.history.findIndex(
+        (item) => item.itemId === event.item_id,
+      );
+      if (index < 0) {
+        this.reject(event);
+      } else {
+        this.history.splice(index, 1);
+        this.replies.push({
+          type: 'conversation.item.deleted',
+          item_id: event.item_id,
+        });
+      }
+    } else if (event.type === 'conversation.item.create') {
+      const wireItem = event.item as {
+        id: string;
+        content: RealtimeMessageItem['content'];
+      };
+      const anchor = event.previous_item_id;
+      const index =
+        anchor === undefined
+          ? this.history.length
+          : anchor === 'root'
+            ? 0
+            : this.history.findIndex((item) => item.itemId === anchor) + 1;
+      if (
+        this.failNextCreate ||
+        (anchor !== undefined && anchor !== 'root' && index === 0) ||
+        this.history.some((item) => item.itemId === wireItem.id)
+      ) {
+        this.failNextCreate = false;
+        this.reject(event);
+        return;
+      }
+      const item = {
+        ...message(wireItem.id),
+        content: wireItem.content,
+      } as RealtimeMessageItem;
+      this.history.splice(index, 0, item);
+      const added = this.added(item, this.history[index - 1]?.itemId ?? null);
+      this.replies.push(added, { ...added, type: 'conversation.item.done' });
+    }
+  }
+
+  reject(event: RealtimeClientMessage) {
+    this.replies.push({
+      type: 'error',
+      error: {
+        type: 'invalid_request_error',
+        message: 'Rejected history operation',
+        event_id: event.event_id,
+      },
+    });
+  }
+}
+
+async function setup(items = [message('a'), message('b'), message('c')]) {
+  const transport = new HistoryTransport();
+  const
```

**File**: `packages/agents-realtime/test/historyReplay.test.ts` (modified, +18/-3)
```diff
@@ -128,6 +128,7 @@ describe('OpenAI realtime history replay', () => {
     expect(base.events).toEqual([
       {
         type: 'conversation.item.delete',
+        event_id: expect.stringMatching(/^agents_delete_\d+$/),
         item_id: 'remove-me',
       },
     ]);
@@ -144,6 +145,7 @@ describe('OpenAI realtime history replay', () => {
     expect(createEvents(base.events)).toEqual([
       {
         type: 'conversation.item.create',
+        event_id: expect.stringMatching(/^agents_create_\d+$/),
         item: {
           id: 'new',
           type: 'message',
@@ -163,11 +165,16 @@ describe('OpenAI realtime history replay', () => {
     base.resetHistory(oldHistory, newHistory);
 
     expect(deleteEvents(base.events)).toEqual([
-      { type: 'conversation.item.delete', item_id: 'msg-1' },
+      {
+        type: 'conversation.item.delete',
+        event_id: expect.stringMatching(/^agents_delete_\d+$/),
+        item_id: 'msg-1',
+      },
     ]);
     expect(createEvents(base.events)).toEqual([
       {
         type: 'conversation.item.create',
+        event_id: expect.stringMatching(/^agents_create_\d+$/),
         item: {
           id: 'msg-1',
           type: 'message',
@@ -187,7 +194,11 @@ describe('OpenAI realtime history replay', () => {
     base.resetHistory(oldHistory, newHistory);
 
     expect(deleteEvents(base.events)).toEqual([
-      { type: 'conversation.item.delete', item_id: 'msg-1' },
+      {
+        type: 'conversation.item.delete',
+        event_id: expect.stringMatching(/^agents_delete_\d+$/),
+        item_id: 'msg-1',
+      },
     ]);
     expect(createEvents(base.events)).toEqual([]);
   });
@@ -210,7 +221,11 @@ describe('OpenAI realtime history replay', () => {
     base.resetHistory(oldHistory, newHistory);
 
     expect(base.events).toEqual([
-      { type: 'conversation.item.delete', item_id: 'mcp-1' },
+      {
+        type: 'conversation.item.delete',
+        event_id: expect.stringMatching(/^agents_delete_\d+$/),
+        item_id: 'mcp-1',
+      },
     ]);
   });
 
```

---

### Incident Patch 3: `00eef0cb` (2026-09-25)
**Commit Message**: fix: reject filtered handoffs with server-managed history (#1960)

**File**: `.changeset/safe-handoff-history-ownership.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'@openai/agents-core': patch
+'@openai/agents-openai': patch
+---
+
+fix: Reject selected handoff input filters with server-managed conversationId or previousResponseId before handoff side effects; use client-managed history or a Session without continuation options instead.
```

**File**: `packages/agents-core/src/handoff.ts` (modified, +4/-1)
```diff
@@ -213,7 +213,9 @@ export class Handoff<
    * that triggered the handoff and a tool call output item representing the handoff tool's output.
    *
    * You are free to modify the input history or new items as you see fit. The next agent that runs
-   * will receive `handoffInputData.allItems
+   * will receive `handoffInputData.allItems`.
+   * Filtered handoffs cannot use `conversationId` or `previousResponseId`, including no-op filters.
+   * Use client-managed history or a Session without either continuation option instead.
    */
   public inputFilter?: HandoffInputFilter;
 
@@ -324,6 +326,7 @@ export type HandoffConfig<
 
   /**
    * A function that filters the inputs that are passed to the next agent.
+   * Cannot be combined with `conversationId` or `previousResponseId`; see `Handoff.inputFilter`.
    */
   inputFilter?: HandoffInputFilter;
 
```

**File**: `packages/agents-core/src/run.ts` (modified, +6/-1)
```diff
@@ -334,7 +334,8 @@ export type RunConfig = {
   /**
    * A global input filter to apply to all handoffs. If `Handoff.inputFilter` is set, then that
    * will take precedence. The input filter allows you to edit the inputs that are sent to the new
-   * agent. See the documentation in `Handoff.inputFilter` for more details.
+   * agent. A selected filtered handoff cannot use `conversationId` or `previousResponseId`.
+   * See the documentation in `Handoff.inputFilter` for more details.
    */
   handoffInputFilter?: HandoffInputFilter;
 
@@ -2094,6 +2095,8 @@ export class Runner extends RunHooks<any, AgentOutputType<unknown>> {
                     state._lastTurnResponse!,
                     preparedCall.tools,
                     preparedCall.handoffs,
+                    this,
+                    options.signal,
                   ),
               },
             );
@@ -3297,6 +3300,8 @@ export class Runner extends RunHooks<any, AgentOutputType<unknown>> {
                   result.state._lastTurnResponse!,
                   preparedCall.tools,
                   preparedCall.handoffs,
+                  this,
+                  options.signal,
                 ),
             },
           );
```

**File**: `packages/agents-core/src/runner/turnResolution.ts` (modified, +43/-3)
```diff
@@ -96,6 +96,8 @@ export function preflightModelResponseToolInvocations<TContext>(
   modelResponse: ModelResponse,
   tools: Tool<TContext>[],
   handoffs: Handoff<any, any>[],
+  runner: Runner,
+  signal?: AbortSignal,
 ): void {
   const functionMap = buildFunctionToolLookupMap(
     tools.filter(
@@ -109,19 +111,24 @@ export function preflightModelResponseToolInvocations<TContext>(
   const shell = tools.find((tool) => tool.type === 'shell');
   const applyPatch = tools.find((tool) => tool.type === 'apply_patch');
   const seen = new Map<string, string>();
+  let selectedHandoff: Handoff<any, any> | undefined;
   const validate = (
     toolName: string | undefined,
     rawItem: ApprovalCapableToolCall,
   ) => {
     if (!toolName) {
-      return;
+      return false;
     }
     const { callId, fingerprint } = state._context._validateToolInvocation(
       agent,
       toolName,
       rawItem,
     );
-    state._preflightToolInvocation(agent, callId, fingerprint);
+    const completed = state._preflightToolInvocation(
+      agent,
+      callId,
+      fingerprint,
+    );
     const previous = seen.get(callId);
     if (previous !== undefined && previous !== fingerprint) {
       throw new ModelBehaviorError(
@@ -130,6 +137,7 @@ export function preflightModelResponseToolInvocations<TContext>(
       );
     }
     seen.set(callId, fingerprint);
+    return !completed && previous !== fingerprint;
   };
 
   for (const output of modelResponse.output) {
@@ -138,7 +146,13 @@ export function preflightModelResponseToolInvocations<TContext>(
         ? handoffMap.get(output.name)
         : undefined;
       if (handoff) {
-        validate(getHandoffToolInvocationName(handoff.toolName), output);
+        const shouldRun = validate(
+          getHandoffToolInvocationName(handoff.toolName),
+          output,
+        );
+        if (shouldRun && !selectedHandoff) {
+          selectedHandoff = handoff;
+        }
         continue;
       }
       const resolvedTool = resolveFunctionToolCall(output, functionMap);
@@ -177,6 +191,9 @@ export function preflightModelResponseToolInvocations<TContext>(
       );
     }
   }
+  if (selectedHandoff && !signal?.aborted) {
+    validateHandoffInputFilter(selectedHandoff, runner, state);
+  }
 }
 
 export function preflightToolInvocations<TContext>(
@@ -1021,6 +1038,9 @@ export async function resolveInterruptedTurn<TContext>(
     (run) => !suppressedToolCalls.has(run.toolCall),
   );
   if (handoffRuns.length > 0) {
+    if (!signal?.aborted) {
+      validateHandoffInputFilter(handoffRuns[0].handoff, runner, state);
+    }
     validateHandoffAgent?.(handoffRuns[0].handoff.agent);
   }
   // call_ids for function tools
@@ -1420,6 +1440,9 @@ export async function resolveTurnAfterModelResponse<
     (run) => !suppressedToolCalls.has(run.toolCall),
   );
   if (handoffRuns.length > 0) {
+    if (!signal?.aborted) {
+      validateHandoffInputFilter(handoffRuns[0].handoff, runner, state);
+    }
     validateHandoffAgent?.(handoffRuns[0].handoff.agent);
   }
   const functionRuns = processedResponse.functions.filter(
@@ -1802,6 +1825,23 @@ type TurnFinalizationParams<TContext> = {
   additionalInterruptions?: RunToolApprovalItem[];
 };
 
+// Local handoff filters cannot remove history already owned by the server.
+function validateHandoffInputFilter(
+  handoff: Handoff<any, any>,
+  runner: Runner,
+  state: RunState<any, any>,
+): void {
+  const inputFilter = handoff.inputFilter ?? runner.config.handoffInputFilter;
+  if (
+    inputFilter != null &&
+    (state._conversationId || state._previousResponseId)
+  ) {
+    throw new UserError(
+      'Handoff input filters cannot be used with conversationId or previousResponseId because server-managed history cannot be filtered locally. Use explicit client-managed history or a Session without either continuation option.',
+    );
+  }
+}
+
 // Handoffs retain precedence over terminal tool behavior, but cannot discard pending approva
```

**File**: `packages/agents-core/test/run.test.ts` (modified, +110/-8)
```diff
@@ -2898,6 +2898,109 @@ describe('Runner.run', () => {
       expect(model.calls).toHaveLength(0);
     });
 
+    it.each([false, true])(
+      'preserves cancellation during client-managed filtered handoff processing (stream=%s)',
+      async (stream) => {
+        const controller = new AbortController();
+        const abortReason = new Error('stop before filtered handoff');
+        let markSearchStarted!: () => void;
+        const searchStarted = new Promise<void>((resolve) => {
+          markSearchStarted = resolve;
+        });
+        let releaseSearch!: () => void;
+        const searchCanFinish = new Promise<void>((resolve) => {
+          releaseSearch = resolve;
+        });
+        const toolSearch = attachClientToolSearchExecutor(
+          {
+            type: 'hosted_tool',
+            name: 'tool_search',
+            providerData: { type: 'tool_search', execution: 'client' },
+          },
+          async () => {
+            markSearchStarted();
+            await searchCanFinish;
+            return [];
+          },
+        );
+        const receiverModel = new ScriptedModel([
+          modelResponse(TEST_MODEL_RESPONSE_BASIC),
+        ]);
+        const receiver = new Agent({ name: 'receiver', model: receiverModel });
+        const onHandoff = vi.fn();
+        const inputFilter = vi.fn((input) => input);
+        const transfer = handoff(receiver, { onHandoff, inputFilter });
+        const source = new Agent({
+          name: 'source',
+          model: new ScriptedModel([
+            modelResponse({
+              output: [
+                {
+                  type: 'function_call',
+                  id: 'fc_handoff',
+                  callId: 'call_handoff',
+                  name: transfer.toolName,
+                  arguments: '{}',
+                  status: 'completed',
+                },
+                {
+                  type: 'tool_search_call',
+                  id: 'ts_lookup',
+                  status: 'completed',
+                  arguments: {},
+                  providerData: { call_id: 'call_lookup' },
+                },
+              ],
+              responseId: 'resp_source',
+              usage: new Usage(),
+            }),
+          ]),
+          tools: [toolSearch],
+          handoffs: [transfer],
+        });
+        const state = new RunState(new RunContext(), 'start', source, 10);
+        const outcome = (async () => {
+          const options = {
+            signal: controller.signal,
+          };
+          if (stream) {
+            const result = await new Runner().run(source, state, {
+              ...options,
+              stream: true,
+            });
+            await result.completed;
+            if (result.error) throw result.error;
+            return { cancelled: result.cancelled, error: result.error };
+          } else {
+            await new Runner().run(source, state, options);
+          }
+        })().catch((error: unknown) => error);
+
+        await searchStarted;
+        controller.abort(abortReason);
+        releaseSearch();
+
+        const result = await outcome;
+        if (stream) {
+          expect(result).toEqual({ cancelled: true, error: null });
+        } else {
+          expect(result).toBe(abortReason);
+        }
+        expect(onHandoff).not.toHaveBeenCalled();
+        expect(inputFilter).not.toHaveBeenCalled();
+        expect(receiverModel.calls).toHaveLength(0);
+        expect(
+          state._generatedItems.map((item) => item.rawItem),
+        ).toContainEqual(
+          expect.objectContaining({
+            type: 'function_call_result',
+            callId: 'call_handoff',
+            status: 'incomplete',
+          }),
+        );
+      },
+    );
+
     it('loads runtime tools from custom client tool_search execute callbacks across turns', async () => {
       const lookupAccount = tool({
         name: 'lookup_account',
@@ -9818,7 +9921,7 @@ describe('Runner.run', () => {
  
```

---

### Incident Patch 4: `f5075900` (2026-09-24)
**Commit Message**: fix: accept deferred hosted MCP listings before tool search (#1980)

**File**: `.changeset/tidy-mcp-discovery.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@openai/agents-core': patch
+---
+
+fix: accept deferred hosted MCP listings before tool-search results (#1978)
```

**File**: `packages/agents-core/src/runner/modelOutputs.ts` (modified, +5/-0)
```diff
@@ -177,6 +177,11 @@ function ensureHostedToolCallAllowed<TContext>(
     serverLabel,
     agent,
   );
+  // Hosted MCP discovery can be reported before the tool-search result.
+  // Listing tools does not execute them or mark the server as loaded.
+  if (providerType === 'mcp_list_tools' || output.name === 'mcp_list_tools') {
+    return;
+  }
   if (
     mcpTool.providerData.defer_loading !== true ||
     loadedToolNames.has(serverLabel)
```

**File**: `packages/agents-core/test/hostedMcpDiscovery.test.ts` (added, +140/-0)
```diff
@@ -0,0 +1,140 @@
+import { describe, expect, it } from 'vitest';
+import {
+  Agent,
+  Runner,
+  RunContext,
+  RunState,
+  Usage,
+  attachClientToolSearchExecutor,
+  hostedMcpTool,
+} from '../src';
+import { processModelResponseAsync } from '../src/runner/modelOutputs';
+import { ScriptedModel, assistantMessage } from '../src/testing';
+import type { OutputModelItem } from '../src/types/protocol';
+
+function discoveryResponse() {
+  const mcpTool = hostedMcpTool({
+    serverLabel: 'records',
+    serverUrl: 'https://example.invalid/mcp',
+    deferLoading: true,
+    requireApproval: 'never',
+  });
+  const output: OutputModelItem[] = [
+    {
+      type: 'hosted_tool_call',
+      id: 'listing',
+      name: 'mcp_list_tools',
+      status: 'completed',
+      providerData: {
+        type: 'mcp_list_tools',
+        server_label: 'records',
+        tools: [
+          {
+            name: 'lookup',
+            input_schema: { type: 'object', properties: {} },
+          },
+        ],
+      },
+    },
+    {
+      type: 'tool_search_call',
+      id: 'search',
+      status: 'completed',
+      arguments: { paths: ['records'] },
+      execution: 'server',
+    },
+    {
+      type: 'tool_search_output',
+      id: 'search_output',
+      status: 'completed',
+      tools: [mcpTool.providerData],
+      execution: 'server',
+    },
+    {
+      type: 'hosted_tool_call',
+      id: 'call',
+      name: 'mcp_call',
+      status: 'completed',
+      output: 'found',
+      providerData: {
+        type: 'mcp_call',
+        server_label: 'records',
+        name: 'lookup',
+        arguments: '{}',
+      },
+    },
+    assistantMessage('Done.'),
+  ];
+  return { mcpTool, output };
+}
+
+describe('deferred hosted MCP discovery', () => {
+  it.each([false, true])(
+    'accepts a listing before search and preserves the completed call (stream: %s)',
+    async (stream) => {
+      const { mcpTool, output } = discoveryResponse();
+      const model = new ScriptedModel([output]);
+      const agent = new Agent({
+        name: 'Records',
+        model,
+        tools: [
+          mcpTool,
+          {
+            type: 'hosted_tool',
+            name: 'tool_search',
+            providerData: { type: 'tool_search' },
+          },
+        ],
+      });
+      const runner = new Runner({ tracingDisabled: true });
+      const result = stream
+        ? await runner.run(agent, 'Look up a record.', { stream: true })
+        : await runner.run(agent, 'Look up a record.');
+      if ('completed' in result) await result.completed;
+
+      expect(result.finalOutput).toBe('Done.');
+      expect(result.newItems.map((item) => item.rawItem.id)).toEqual(
+        output.map((item) => item.id),
+      );
+      expect(result.newItems[3].rawItem).toMatchObject({
+        name: 'mcp_call',
+        output: 'found',
+      });
+      model.assertComplete();
+    },
+  );
+
+  it('accepts the listing when processing also executes client tool search', async () => {
+    const { mcpTool, output } = discoveryResponse();
+    const searchTool = attachClientToolSearchExecutor(
+      {
+        type: 'hosted_tool',
+        name: 'tool_search',
+        providerData: { type: 'tool_search', execution: 'client' },
+      },
+      async () => [],
+    );
+    const agent = new Agent({ name: 'Records', tools: [mcpTool, searchTool] });
+    const result = await processModelResponseAsync(
+      {
+        output: [
+          {
+            type: 'tool_search_call',
+            callId: 'client_search',
+            execution: 'client',
+            arguments: { paths: [] },
+          },
+          ...output,
+        ],
+        usage: new Usage(),
+      },
+      agent,
+      agent.tools,
+      [],
+      new RunState(new RunContext(), 'Look up a record.', agent, 1),
+    );
+    expect(
+      result.newItems.slice(-output.length).map((item) => item.rawItem.id),
+    ).toEqual(output.map((item) => item.id));
+  });
+});
```

**File**: `packages/agents-core/test/runner/modelOutputs.test.ts` (modified, +23/-27)
```diff
@@ -510,8 +510,8 @@ describe('processModelResponse', () => {
     },
   );
 
-  it.each(['mcp_call', 'mcp_list_tools', 'mcp_approval_request'] as const)(
-    'rejects programmatic %s items before a deferred MCP server is loaded',
+  it.each(['mcp_call', 'mcp_approval_request'] as const)(
+    'rejects programmatic %s items after listing a deferred MCP server without loading it',
     async (mcpCallType) => {
       const mcpTool = hostedMcpTool({
         serverLabel: 'server',
@@ -526,34 +526,30 @@ describe('processModelResponse', () => {
         name: mcpCallType,
         status: 'completed',
         caller: { type: 'program', callerId: 'call_program' },
-        providerData:
-          mcpCallType === 'mcp_call'
-            ? {
-                type: mcpCallType,
-                id: 'mcp_call_programmatic',
-                server_label: 'server',
-                name: 'lookup',
-                arguments: '{}',
-              }
-            : mcpCallType === 'mcp_list_tools'
-              ? {
-                  type: mcpCallType,
-                  id: 'mcp_list_tools_programmatic',
-                  server_label: 'server',
-                  tools: [],
-                }
-              : {
-                  type: mcpCallType,
-                  id: 'mcp_approval_programmatic',
-                  server_label: 'server',
-                  name: 'lookup',
-                  arguments: '{}',
-                },
+        providerData: {
+          type: mcpCallType,
+          id: `${mcpCallType}_programmatic`,
+          server_label: 'server',
+          name: 'lookup',
+          arguments: '{}',
+        },
+      };
+      const listing: protocol.HostedToolCallItem = {
+        type: 'hosted_tool_call',
+        id: 'mcp_listing',
+        name: 'mcp_list_tools',
+        status: 'completed',
+        caller: { type: 'program', callerId: 'call_program' },
+        providerData: {
+          type: 'mcp_list_tools',
+          server_label: 'server',
+          tools: [],
+        },
       };
 
       expect(() =>
         processModelResponse(
-          { output: [programmaticMcpCall], usage: new Usage() },
+          { output: [listing, programmaticMcpCall], usage: new Usage() },
           TEST_AGENT,
           [mcpTool],
           [],
@@ -587,7 +583,7 @@ describe('processModelResponse', () => {
       await expect(
         processModelResponseAsync(
           {
-            output: [toolSearchCall, programmaticMcpCall],
+            output: [toolSearchCall, listing, programmaticMcpCall],
             usage: new Usage(),
           },
           TEST_AGENT,
```

---

### Incident Patch 5: `4ef9008b` (2026-09-24)
**Commit Message**: fix: Preserve unrelated MCP server tool caches during invalidation (#1977)

**File**: `.changeset/tidy-mcp-cache-scope.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@openai/agents-core': patch
+---
+
+fix: Preserve cached MCP tools for unrelated servers with colon-suffixed names when invalidating another server's cache (#1976).
```

**File**: `packages/agents-core/src/mcpToolCache.ts` (modified, +0/-5)
```diff
@@ -60,9 +60,4 @@ export async function invalidateServerToolsCache(serverName: string) {
   }
 
   delete cachedMcpTools[serverName];
-  for (const cacheKey of Object.keys(cachedMcpTools)) {
-    if (cacheKey.startsWith(`${serverName}:`)) {
-      delete cachedMcpTools[cacheKey];
-    }
-  }
 }
```

**File**: `packages/agents-core/test/mcpCache.test.ts` (modified, +39/-0)
```diff
@@ -49,6 +49,45 @@ class StubServer extends NodeMCPServerStdio {
 }
 
 describe('MCP tools cache invalidation', () => {
+  it.each([false, true])(
+    'preserves colon-suffixed server caches when the base server was cached=%s',
+    async (cacheBaseServer) => {
+      const serverName = `isolated-cache-${cacheBaseServer}`;
+      const server = new StubServer(serverName, [toolNamed('query')]);
+      const suffixedServer = new StubServer(`${serverName}:readonly`, [
+        toolNamed('read'),
+      ]);
+      const listTools = vi.spyOn(server, 'listTools');
+      const listSuffixedTools = vi.spyOn(suffixedServer, 'listTools');
+
+      try {
+        if (cacheBaseServer) {
+          await getAllMcpTools({ mcpServers: [server] });
+        }
+        await getAllMcpTools({ mcpServers: [suffixedServer] });
+
+        await invalidateServerToolsCache(serverName);
+        await invalidateServerToolsCache(serverName);
+
+        const cachedTools = await getAllMcpTools({
+          mcpServers: [suffixedServer],
+        });
+        expect(cachedTools.map((tool) => tool.name)).toEqual(['read']);
+        expect(listSuffixedTools).toHaveBeenCalledTimes(1);
+
+        await getAllMcpTools({ mcpServers: [server] });
+        expect(listTools).toHaveBeenCalledTimes(cacheBaseServer ? 2 : 1);
+
+        await suffixedServer.invalidateToolsCache();
+        await getAllMcpTools({ mcpServers: [suffixedServer] });
+        expect(listSuffixedTools).toHaveBeenCalledTimes(2);
+      } finally {
+        await invalidateServerToolsCache(serverName);
+        await invalidateServerToolsCache(suffixedServer.name);
+      }
+    },
+  );
+
   it.each([false, true])(
     'reevaluates callable filters for each run context with prefixed names=%s',
     async (includeServerInToolNames) => {
```

---

### Incident Patch 6: `a0b1c6fd` (2026-09-22)
**Commit Message**: fix: preserve current approval decisions during nested restore (#1973)

**File**: `.changeset/calm-nested-approvals.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@openai/agents-core': patch
+---
+
+fix: Preserve current permanent function approval decisions when restoring nested runs from saved state.
```

**File**: `packages/agents-core/src/runContext.ts` (modified, +6/-0)
```diff
@@ -677,6 +677,12 @@ export class RunContext<TContext = UnknownContext> {
     for (const { agentIdentity, approvals: approvalsByTool } of approvals) {
       const agent = agentsByIdentity.get(agentIdentity)!;
       for (const [toolName, incoming] of Object.entries(approvalsByTool)) {
+        const current = this.#getFunctionApprovalMap(agent).get(toolName);
+        // A saved decision must not override a current permanent decision,
+        // including its per-call exceptions and rejection messages.
+        if (current?.approved === true || current?.rejected === true) {
+          continue;
+        }
         this.#setFunctionApprovalRecord(agent, toolName, incoming);
       }
     }
```

**File**: `packages/agents-core/test/nestedApprovalRestore.test.ts` (added, +194/-0)
```diff
@@ -0,0 +1,194 @@
+import { describe, expect, it, vi } from 'vitest';
+import { z } from 'zod';
+import {
+  Agent,
+  RunContext,
+  Runner,
+  RunState,
+  tool,
+  toolNamespace,
+} from '../src';
+import {
+  ScriptedModel,
+  assistantMessage as message,
+  functionCall,
+} from '../src/testing';
+
+function call(name: string, callId: string) {
+  return functionCall(
+    name,
+    {},
+    {
+      callId,
+      namespace: name === 'protected_tool' ? 'secure' : undefined,
+    },
+  );
+}
+
+describe('nested approval restoration', () => {
+  it.each([false, true])(
+    'keeps a current permanent rejection after nested resume (round trip: %s)',
+    async (roundTrip) => {
+      const execute = vi.fn(async () => 'executed');
+      const protectedTool = tool({
+        name: 'protected_tool',
+        description: 'Run a protected function',
+        parameters: z.object({}),
+        needsApproval: true,
+        execute,
+      });
+      const checkpoint = tool({
+        name: 'checkpoint',
+        description: 'Pause the nested run',
+        parameters: z.object({}),
+        needsApproval: true,
+        execute: async () => 'continued',
+      });
+      const nestedModel = new ScriptedModel([
+        [call('protected_tool', 'initial')],
+        [call('checkpoint', 'pause')],
+        [call('protected_tool', 'fresh')],
+        [message('Nested done')],
+      ]);
+      const nested = new Agent({
+        name: 'Nested',
+        model: nestedModel,
+        tools: [
+          ...toolNamespace({
+            name: 'secure',
+            description: 'Protected functions',
+            tools: [protectedTool],
+          }),
+          checkpoint,
+        ],
+      });
+      const outer = new Agent({
+        name: 'Outer',
+        model: new ScriptedModel([
+          [
+            {
+              ...call('nested', 'outer'),
+              arguments: JSON.stringify({ input: 'start' }),
+            },
+          ],
+          [message('Outer done')],
+        ]),
+        tools: [
+          nested.asTool({ toolName: 'nested', toolDescription: 'Nested' }),
+        ],
+      });
+      const runner = new Runner({ tracingDisabled: true });
+      const first = await runner.run(outer, 'start');
+      expect(first.interruptions).toHaveLength(1);
+      const grant = first.interruptions[0];
+      first.state.approve(grant, { alwaysApprove: true });
+      const paused = await runner.run(outer, first.state);
+      expect(execute).toHaveBeenCalledTimes(1);
+      expect(paused.interruptions).toHaveLength(1);
+      const current = roundTrip
+        ? await RunState.fromString<undefined, typeof outer>(
+            outer,
+            paused.state.toString(),
+          )
+        : paused.state;
+      current.reject(grant, { alwaysReject: true, message: 'Grant revoked' });
+      current.approve(current.getInterruptions()[0]);
+      const resumed = await runner.run(outer, current);
+      expect(resumed.finalOutput).toBe('Outer done');
+      expect(resumed.interruptions).toHaveLength(0);
+      expect(execute).toHaveBeenCalledTimes(1);
+      expect(nestedModel.lastCall?.request.input).toEqual(
+        expect.arrayContaining([
+          expect.objectContaining({
+            type: 'function_call_result',
+            callId: 'fresh',
+            output: expect.objectContaining({ text: 'Grant revoked' }),
+          }),
+        ]),
+      );
+    },
+  );
+
+  it.each(['merge', 'replace', 'current approval'] as const)(
+    'restores saved decisions with %s semantics',
+    async (strategy) => {
+      const execute = vi.fn(async () => 'executed');
+      const protectedTool = tool({
+        name: 'protected_tool',
+        description: 'Run a protected function',
+        parameters: z.object({}),
+        needsApproval: true,
+        execute,
+      });
+      const checkpoint = tool({
+        name: 'checkpoint',
+        description: 'Pause the nested run',
+        parameters: z.object({}),
```

---

### Incident Patch 7: `c55d64d2` (2026-09-22)
**Commit Message**: fix: add an optional compaction rollback item budget (#1969)

**File**: `.changeset/bounded-compaction-rollback.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'@openai/agents-openai': patch
+'@openai/agents-core': patch
+---
+
+fix: add an optional rollback item budget for Responses session compaction.
```

**File**: `packages/agents-core/src/runner/sessionPersistence.ts` (modified, +25/-13)
```diff
@@ -5,6 +5,7 @@ import {
   isRunContextAwareSession,
   isSessionHistoryTransactionAwareSession,
   type OpenAIResponsesCompactionArgs,
+  type OpenAIResponsesCompactionResult,
   type OpenAIResponsesCompactionAwareSession,
   type Session,
   type SessionHistoryTransaction,
@@ -38,7 +39,10 @@ import {
   type ReasoningItemIdPolicy,
 } from './items';
 import logger, { logModelAndToolActionWarning } from '../logger';
-import { getRunStateUsageRecorder } from './usageTracking';
+import {
+  consumeModelFailureUsage,
+  getRunStateUsageRecorder,
+} from './usageTracking';
 import {
   buildRunItemPersistencePlan as buildCanonicalRunItemPersistencePlan,
   getBlockedOutputSessionSnapshotRunItems,
@@ -2570,18 +2574,26 @@ async function runCompactionOnSession(
           ...(typeof store === 'undefined' ? {} : { store }),
           ...(typeof compactionMode === 'undefined' ? {} : { compactionMode }),
         };
-  const compactionResult = isOpenAIResponsesCompactionOwnershipAwareSession(
-    session,
-  )
-    ? await session.runCompaction(
-        compactionArgs,
-        state._context,
-        getSessionCompactionState(session, state)?.ownership ?? null,
-        getSessionCompactionState(session, state)?.modelExchange,
-      )
-    : isRunContextAwareSession(session)
-      ? await session.runCompaction(compactionArgs, state._context)
-      : await session.runCompaction(compactionArgs);
+  let compactionResult: OpenAIResponsesCompactionResult | null | void;
+  try {
+    compactionResult = isOpenAIResponsesCompactionOwnershipAwareSession(session)
+      ? await session.runCompaction(
+          compactionArgs,
+          state._context,
+          getSessionCompactionState(session, state)?.ownership ?? null,
+          getSessionCompactionState(session, state)?.modelExchange,
+        )
+      : isRunContextAwareSession(session)
+        ? await session.runCompaction(compactionArgs, state._context)
+        : await session.runCompaction(compactionArgs);
+  } catch (error) {
+    const usage = consumeModelFailureUsage(error);
+    if (usage) {
+      state._context.usage.add(usage);
+      getRunStateUsageRecorder(state)?.(usage);
+    }
+    throw error;
+  }
   if (!compactionResult) {
     return;
   }
```

**File**: `packages/agents-core/test/runner/sessionPersistence.test.ts` (modified, +53/-0)
```diff
@@ -52,6 +52,11 @@ import type { AgentInputItem, UnknownContext } from '../../src/types';
 import * as protocol from '../../src/types/protocol';
 import { ScriptedModelProvider, TEST_AGENT, fakeModelMessage } from '../stubs';
 import logger from '../../src/logger';
+import {
+  attachModelFailureUsage,
+  consumeModelFailureUsage,
+  setRunStateUsageRecorder,
+} from '../../src/runner/usageTracking';
 
 beforeAll(() => {
   setTracingDisabled(true);
@@ -5269,6 +5274,54 @@ describe('saveToSession', () => {
     ).toEqual(['responses.create']);
   });
 
+  it('forwards failed compaction usage to the run recorder and consumes it once', async () => {
+    const failure = new Error('post-request snapshot failed');
+    const requestUsage = new RequestUsage({
+      inputTokens: 4,
+      outputTokens: 6,
+      totalTokens: 10,
+      endpoint: 'responses.compact',
+    });
+    class PaidFailureSession extends TransactionMemorySession {
+      async runCompaction(): Promise<never> {
+        attachModelFailureUsage(
+          failure,
+          new Usage({
+            ...requestUsage,
+            requests: 1,
+            requestUsageEntries: [requestUsage],
+          }),
+        );
+        throw failure;
+      }
+    }
+    const agent = new Agent<UnknownContext, AgentOutputType>({
+      name: 'failed compaction',
+    });
+    const state = new RunState(new RunContext(), 'hello', agent, 10);
+    const recorder = vi.fn();
+    setRunStateUsageRecorder(state, recorder);
+    await expect(
+      saveToSession(
+        new PaidFailureSession(),
+        toAgentInputList(state._originalInput),
+        new RunResult(state),
+      ),
+    ).rejects.toBe(failure);
+    expect(state.usage.requests).toBe(1);
+    expect(state.usage.totalTokens).toBe(10);
+    expect(state.usage.requestUsageEntries).toEqual([requestUsage]);
+    expect(recorder).toHaveBeenCalledTimes(1);
+    expect(recorder).toHaveBeenCalledWith(
+      expect.objectContaining({
+        requests: 1,
+        totalTokens: 10,
+        requestUsageEntries: [requestUsage],
+      }),
+    );
+    expect(consumeModelFailureUsage(failure)).toBeUndefined();
+  });
+
   it('adds compaction usage to the run state when returned', async () => {
     class TrackingSession implements Session {
       items: AgentInputItem[] = [];
```

**File**: `packages/agents-openai/src/memory/openaiResponsesCompactionSession.ts` (modified, +63/-2)
```diff
@@ -3,6 +3,7 @@ import {
   getLogger,
   MemorySession,
   RequestUsage,
+  Usage,
   UserError,
 } from '@openai/agents-core';
 import type {
@@ -14,6 +15,7 @@ import type {
 } from '@openai/agents-core';
 import type { OpenAIResponsesCompactionResult } from '@openai/agents-core';
 import {
+  attachModelFailureUsage,
   getModelVisibleSessionItems,
   logModelAndToolActionWarning,
 } from '@openai/agents-core/utils/internal';
@@ -88,6 +90,19 @@ export type OpenAIResponsesCompactionSessionOptions = {
    * - `input`: Sends the locally stored session items as input and does not require a response id.
    */
   compactionMode?: OpenAIResponsesCompactionMode;
+  /**
+   * Optional positive integer budget for complete history snapshots used for rollback.
+   * The budget plus one must be a safe integer. Omitting the budget preserves unlimited reads.
+   *
+   * Snapshot reads request at most this many items plus one overflow item. Oversized history
+   * throws a `UserError` before the compaction API call, including forced calls. The snapshot is
+   * refreshed and checked again after the API call, before replacing history. Automatic
+   * compaction that passes the ownership and model-visibility checks also honors this budget.
+   *
+   * This does not limit bytes, tokens, stored history, model input, or ordinary candidate reads.
+   * Underlying retrieval defaults remain independent of this budget.
+   */
+  maxRollbackItems?: number;
   /**
    * Custom decision hook that determines whether to call `responses.compact`.
    *
@@ -124,6 +139,7 @@ export class OpenAIResponsesCompactionSession
   private readonly underlyingSession: Session;
   private readonly model: OpenAI.ResponsesModel;
   private readonly compactionMode: OpenAIResponsesCompactionMode;
+  private readonly maxRollbackItems: number | undefined;
   private responseId?: string;
   private lastStore?: boolean;
   private readonly shouldTriggerCompaction: (
@@ -136,6 +152,18 @@ export class OpenAIResponsesCompactionSession
   private readonly compactionOwnership = new WeakMap<object, object>();
 
   constructor(options: OpenAIResponsesCompactionSessionOptions) {
+    const { maxRollbackItems } = options;
+    if (
+      maxRollbackItems !== undefined &&
+      (!Number.isSafeInteger(maxRollbackItems) ||
+        maxRollbackItems <= 0 ||
+        !Number.isSafeInteger(maxRollbackItems + 1))
+    ) {
+      throw new UserError(
+        'maxRollbackItems must be a positive integer whose value plus one is a safe integer.',
+      );
+    }
+    this.maxRollbackItems = maxRollbackItems;
     this.client = resolveClient(options);
     if (isOpenAIConversationsSessionDelegate(options.underlyingSession)) {
       throw new UserError(
@@ -230,6 +258,11 @@ export class OpenAIResponsesCompactionSession
       );
     }
 
+    if (args.force === true && this.maxRollbackItems !== undefined) {
+      // Forced calls do not need a decision hook or potentially unlimited candidates first.
+      await this.getAllUnderlyingSessionItems();
+    }
+
     const { compactionCandidateItems, sessionItems } =
       await this.ensureCompactionCandidates();
     const shouldTriggerCompaction =
@@ -249,6 +282,10 @@ export class OpenAIResponsesCompactionSession
       return null;
     }
 
+    if (args.force !== true && this.maxRollbackItems !== undefined) {
+      await this.getAllUnderlyingSessionItems();
+    }
+
     logger.debug('compact: start %o', {
       responseId: this.responseId,
       model: this.model,
@@ -269,7 +306,18 @@ export class OpenAIResponsesCompactionSession
     const outputItems = normalizeCompactionOutputItems(compacted.output ?? []);
     const outputCompactionCandidateItems =
       selectCompactionCandidateItems(outputItems);
-    const previousItems = await this.getAllUnderlyingSessionItems();
+    // Refresh after the request so rollback does not revive items that expired during the await.
+    let previousItems: AgentInputItem[];
+    try {
+      previousI
```

**File**: `packages/agents-openai/test/openaiResponsesCompactionSession.runner.test.ts` (modified, +177/-0)
```diff
@@ -6,6 +6,7 @@ import {
   Runner,
   RunContext,
   RunState,
+  UserError,
   tool,
   type AgentInputItem,
   type NonStreamRunOptions,
@@ -602,3 +603,179 @@ describe('Runner compaction model visibility', () => {
     },
   );
 });
+
+describe('Runner compaction rollback budget', () => {
+  it.each([false, true])(
+    'keeps completed turns below the default trigger even above the budget (stream=%s)',
+    async (stream) => {
+      const initialItems = [
+        user('one'),
+        assistantMessage('one'),
+        user('two'),
+        assistantMessage('two'),
+      ];
+      const underlying = new MemorySession({ initialItems });
+      const compact = vi.fn();
+      const session = new OpenAIResponsesCompactionSession({
+        underlyingSession: underlying,
+        maxRollbackItems: 5,
+        client: { responses: { compact } } as any,
+      });
+      const reply = assistantMessage('done');
+      const result = await startRun(
+        new Runner({ tracingDisabled: true }),
+        new Agent({
+          name: 'default trigger',
+          model: new ScriptedModel([[reply]]),
+        }),
+        stream,
+        { session },
+      );
+      if ('completed' in result) await result.completed;
+      expect(result.finalOutput).toBe('done');
+      expect(compact).not.toHaveBeenCalled();
+      await expect(underlying.getItems()).resolves.toEqual([
+        ...initialItems,
+        user('hello'),
+        reply,
+      ]);
+    },
+  );
+
+  it.each([false, true])(
+    'records paid compaction usage once when the post-request snapshot overflows (stream=%s)',
+    async (stream) => {
+      const started = deferred();
+      const proceed = deferred();
+      const underlying = new MemorySession();
+      const clear = vi.spyOn(underlying, 'clearSession');
+      const compact = vi.fn(async () => {
+        started.resolve();
+        await proceed.promise;
+        return {
+          output: [],
+          usage: { input_tokens: 7, output_tokens: 3, total_tokens: 10 },
+        };
+      });
+      const session = new OpenAIResponsesCompactionSession({
+        underlyingSession: underlying,
+        maxRollbackItems: 2,
+        shouldTriggerCompaction: () => true,
+        client: { responses: { compact } } as any,
+      });
+      const reply = assistantMessage('done');
+      const context = new RunContext();
+      const running = startRun(
+        new Runner({ tracingDisabled: true }),
+        new Agent({
+          name: 'paid overflow',
+          model: new ScriptedModel([[reply]]),
+        }),
+        stream,
+        { session, context },
+      );
+      const completion = running.then(async (result) => {
+        if ('completed' in result) await result.completed;
+      });
+      const failed = completion.catch((error: unknown) => error);
+      await started.promise;
+      await underlying.addItems([user('external')]);
+      proceed.resolve();
+      const error = await failed;
+      expect(error).toBeInstanceOf(UserError);
+      expect((error as UserError).message).toContain(
+        'exceeds maxRollbackItems',
+      );
+      const usage = context.usage;
+      expect(usage.requests).toBe(2);
+      expect(usage.inputTokens).toBe(7);
+      expect(usage.outputTokens).toBe(3);
+      expect(usage.totalTokens).toBe(10);
+      expect(
+        usage.requestUsageEntries?.filter(
+          (entry) => entry.endpoint === 'responses.compact',
+        ),
+      ).toEqual([
+        expect.objectContaining({
+          inputTokens: 7,
+          outputTokens: 3,
+          totalTokens: 10,
+        }),
+      ]);
+      expect(compact).toHaveBeenCalledTimes(1);
+      expect(clear).not.toHaveBeenCalled();
+      await expect(underlying.getItems()).resolves.toEqual([
+        user('hello'),
+        reply,
+        user('external'),
+      ]);
+    },
+  );
+
+  it.each([false, true])(
+    'honors the budget after turn persistence (stream=%s)',
+    async (stream) => {
+      for (c
```

---

### Incident Patch 8: `3949bb1c` (2026-09-22)
**Commit Message**: fix: Apply static MCP filters without run context (#1974)

**File**: `.changeset/honor-static-mcp-discovery-filters.md` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+---
+'@openai/agents-core': patch
+---
+
+fix: Apply static MCP tool filters when discovering tools without full agent and run context.
```

**File**: `packages/agents-core/src/mcp.ts` (modified, +6/-2)
```diff
@@ -649,13 +649,17 @@ async function getMcpToolsFromServer<TContext = UnknownContext>({
     );
     let mcpTools: MCPTool[] = fetchedMcpTools;
 
-    if (runContext && agent) {
-      const context = { runContext, agent, serverName: server.name };
+    if (server.toolFilter) {
       const filteredTools: MCPTool[] = [];
       for (const tool of fetchedMcpTools) {
         const filter = server.toolFilter;
         if (filter) {
           if (typeof filter === 'function') {
+            if (!runContext || !agent) {
+              filteredTools.push(tool);
+              continue;
+            }
+            const context = { runContext, agent, serverName: server.name };
             const [detachedTool] = snapshotMcpTools([tool]);
             const filtered = await filter(context, detachedTool);
             if (!filtered) {
```

**File**: `packages/agents-core/test/mcpStaticDiscovery.test.ts` (added, +196/-0)
```diff
@@ -0,0 +1,196 @@
+import { beforeEach, describe, expect, it, vi } from 'vitest';
+import {
+  Agent,
+  getAllMcpTools,
+  invalidateServerToolsCache,
+  RunContext,
+  Runner,
+  type MCPServer,
+} from '../src';
+import type { MCPTool } from '../src/mcp';
+import { ScriptedModel } from '../src/testing';
+
+const definitions: MCPTool[] = ['alpha', 'beta', 'gamma'].map((name) => ({
+  name,
+  inputSchema: {
+    type: 'object',
+    properties: {},
+    required: [],
+    additionalProperties: false,
+  },
+}));
+
+function recordingServer(): MCPServer {
+  return {
+    name: 'static-discovery',
+    cacheToolsList: true,
+    connect: async () => {},
+    close: async () => {},
+    listTools: vi.fn(async () => definitions),
+    callTool: vi.fn(async () => [{ type: 'text', text: 'recorded' }]),
+    invalidateToolsCache: async () => {},
+  };
+}
+
+const contextCases = [
+  { label: 'no context', runContext: undefined, agent: undefined },
+  {
+    label: 'run context only',
+    runContext: new RunContext({}),
+    agent: undefined,
+  },
+  {
+    label: 'agent only',
+    runContext: undefined,
+    agent: new Agent({ name: 'Discovery' }),
+  },
+  {
+    label: 'full context',
+    runContext: new RunContext({}),
+    agent: new Agent({ name: 'Discovery' }),
+  },
+];
+
+describe('static MCP discovery filters', () => {
+  beforeEach(async () => {
+    await invalidateServerToolsCache('static-discovery');
+  });
+
+  describe.each(['positional', 'options'] as const)('%s API', (shape) => {
+    it.each(contextCases)(
+      'applies static policies with $label',
+      async ({ runContext, agent }) => {
+        const server = recordingServer();
+        const discover = () =>
+          shape === 'positional'
+            ? getAllMcpTools([server], runContext, agent)
+            : getAllMcpTools({ mcpServers: [server], runContext, agent });
+
+        server.toolFilter = {
+          allowedToolNames: ['alpha', 'beta'],
+          blockedToolNames: ['beta'],
+        };
+        expect((await discover()).map((tool) => tool.name)).toEqual(['alpha']);
+        server.toolFilter = { blockedToolNames: ['alpha'] };
+        expect((await discover()).map((tool) => tool.name)).toEqual([
+          'beta',
+          'gamma',
+        ]);
+        server.toolFilter = { allowedToolNames: ['beta'] };
+        expect((await discover()).map((tool) => tool.name)).toEqual(['beta']);
+        server.toolFilter = { allowedToolNames: [], blockedToolNames: [] };
+        expect((await discover()).map((tool) => tool.name)).toEqual([
+          'alpha',
+          'beta',
+          'gamma',
+        ]);
+        server.toolFilter = undefined;
+        expect((await discover()).map((tool) => tool.name)).toEqual([
+          'alpha',
+          'beta',
+          'gamma',
+        ]);
+        expect(server.listTools).toHaveBeenCalledTimes(1);
+        expect(server.callTool).not.toHaveBeenCalled();
+      },
+    );
+  });
+
+  it('requires full context for callable filters on cached discovery', async () => {
+    const server = recordingServer();
+    const filter = vi.fn(
+      async (_context, tool: MCPTool) => tool.name === 'beta',
+    );
+    server.toolFilter = filter;
+    const discover = (context: (typeof contextCases)[number]) =>
+      getAllMcpTools({
+        mcpServers: [server],
+        runContext: context.runContext,
+        agent: context.agent,
+        generateMCPToolCacheKey: () => 'static-discovery',
+      });
+    for (const context of contextCases.slice(0, 3)) {
+      expect((await discover(context)).map((tool) => tool.name)).toEqual([
+        'alpha',
+        'beta',
+        'gamma',
+      ]);
+    }
+    expect(filter).not.toHaveBeenCalled();
+    expect((await discover(contextCases[3])).map((tool) => tool.name)).toEqual([
+      'beta',
+    ]);
+    expect(filter).toHaveBeenCalledTimes(3);
+    expect(filter).toHaveBeenCalledWith(
+      {
+        runContext: contextCases[3].runContext,
+        agen
```

---

### Incident Patch 9: `9c941387` (2026-09-22)
**Commit Message**: fix: honor sensitive-data policy in Codex tracing (#1970)

**File**: `.changeset/codex-sensitive-tracing.md` (added, +6/-0)
```diff
@@ -0,0 +1,6 @@
+---
+'@openai/agents-core': patch
+'@openai/agents-extensions': patch
+---
+
+fix: honor the invoking Runner's sensitive-data tracing policy in Codex spans, including mixed CommonJS and ESM applications.
```

**File**: `packages/agents-core/src/agentToolRunConfig.ts` (modified, +10/-6)
```diff
@@ -9,7 +9,8 @@ const TRANSPORT_OVERRIDE_PROVIDER_DATA_ALIAS_KEYS = [
   ['extra_query', 'extraQuery'],
   ['extra_body', 'extraBody'],
 ] as const;
-const AGENT_TOOL_PARENT_RUN_CONFIG_SYMBOL = Symbol(
+// Runner and tool adapters can load separate CJS/ESM copies of core.
+const AGENT_TOOL_PARENT_RUN_CONFIG_SYMBOL = Symbol.for(
   'openai.agents.agentToolParentRunConfig',
 );
 const TOOL_CALL_PARENT_SPAN_SYMBOL = Symbol('openai.agents.toolCallParentSpan');
@@ -26,11 +27,14 @@ export function setAgentToolParentRunConfigOnDetails(
   details: object,
   parentRunConfig: Partial<RunConfig> | undefined,
 ): void {
-  const safeParentRunConfig = getInheritedAgentToolRunConfig(
-    parentRunConfig,
-    undefined,
-  );
-  if (!safeParentRunConfig) {
+  const safeParentRunConfig = {
+    ...getInheritedAgentToolRunConfig(parentRunConfig, undefined),
+    // The invoking tool needs this policy even though nested runners do not inherit it.
+    ...(typeof parentRunConfig?.traceIncludeSensitiveData !== 'undefined'
+      ? { traceIncludeSensitiveData: parentRunConfig.traceIncludeSensitiveData }
+      : {}),
+  };
+  if (Object.keys(safeParentRunConfig).length === 0) {
     return;
   }
 
```

**File**: `packages/agents-core/src/utils/internal.ts` (modified, +1/-0)
```diff
@@ -39,3 +39,4 @@ export {
   validateToolInvocationApproval,
   validateToolInvocationName,
 } from '../toolInvocation';
+export { getAgentToolParentRunConfigFromDetails } from '../agentToolRunConfig';
```

**File**: `packages/agents-extensions/src/experimental/codex/index.ts` (modified, +146/-57)
```diff
@@ -11,7 +11,10 @@ import {
   toFunctionToolName,
   toSmartString,
 } from '@openai/agents-core/utils';
-import { recordToolUsage } from '@openai/agents-core/utils/internal';
+import {
+  getAgentToolParentRunConfigFromDetails,
+  recordToolUsage,
+} from '@openai/agents-core/utils/internal';
 import type {
   CustomSpanData,
   FunctionCallItem,
@@ -440,6 +443,9 @@ export function codexTool(
     parameters: resolvedParameters,
     strict: true,
     execute: async (input, runContext = new RunContext(), details) => {
+      const includeSensitiveData =
+        getAgentToolParentRunConfigFromDetails(details)
+          ?.traceIncludeSensitiveData ?? true;
       const args = normalizeParameters(input as AnyCodexToolParameters);
 
       if (useRunContextThreadId) {
@@ -483,6 +489,7 @@ export function codexTool(
         threadId: streamedThreadId,
       } = await consumeEvents(streamResult, {
         args,
+        includeSensitiveData,
         onStream,
         toolCall: details?.toolCall,
       });
@@ -1309,6 +1316,7 @@ function buildCodexInput(args: CodexToolCallArguments): string | UserInput[] {
 }
 
 type ConsumeEventsOptions = {
+  includeSensitiveData: boolean;
   args: CodexToolCallArguments;
   onStream?: CodexToolStreamHandler;
   toolCall?: FunctionCallItem;
@@ -1332,7 +1340,7 @@ async function consumeEvents(
   usage: CodexUsage | null;
   threadId: string | null;
 }> {
-  const { args, onStream, toolCall } = options;
+  const { args, onStream, toolCall, includeSensitiveData } = options;
   const activeSpans = new Map<string, CustomSpan>();
   let finalResponse = '';
   let usage: CodexUsage | null = null;
@@ -1352,13 +1360,13 @@ async function consumeEvents(
 
       switch (event.type) {
         case 'item.started':
-          handleItemStarted(event.item, activeSpans);
+          handleItemStarted(event.item, activeSpans, includeSensitiveData);
           break;
         case 'item.updated':
-          handleItemUpdated(event.item, activeSpans);
+          handleItemUpdated(event.item, activeSpans, includeSensitiveData);
           break;
         case 'item.completed':
-          handleItemCompleted(event.item, activeSpans);
+          handleItemCompleted(event.item, activeSpans, includeSensitiveData);
           if (
             event.item.type === 'agent_message' &&
             typeof event.item.text === 'string'
@@ -1394,12 +1402,16 @@ async function consumeEvents(
   return { response: finalResponse, usage, threadId };
 }
 
-function handleItemStarted(item: ThreadItem, spans: Map<string, CustomSpan>) {
+function handleItemStarted(
+  item: ThreadItem,
+  spans: Map<string, CustomSpan>,
+  includeSensitiveData: boolean,
+) {
   if (isCommandExecutionItem(item)) {
     const span = createCustomSpan({
       data: {
         name: 'Codex command execution',
-        data: buildCommandSpanData(item),
+        data: buildCommandSpanData(item, includeSensitiveData),
       },
     });
     span.start();
@@ -1411,7 +1423,7 @@ function handleItemStarted(item: ThreadItem, spans: Map<string, CustomSpan>) {
     const span = createCustomSpan({
       data: {
         name: 'Codex file change',
-        data: buildFileChangeSpanData(item),
+        data: buildFileChangeSpanData(item, includeSensitiveData),
       },
     });
     span.start();
@@ -1423,7 +1435,7 @@ function handleItemStarted(item: ThreadItem, spans: Map<string, CustomSpan>) {
     const span = createCustomSpan({
       data: {
         name: `Codex MCP tool call`,
-        data: buildMcpToolSpanData(item),
+        data: buildMcpToolSpanData(item, includeSensitiveData),
       },
     });
     span.start();
@@ -1435,7 +1447,7 @@ function handleItemStarted(item: ThreadItem, spans: Map<string, CustomSpan>) {
     const span = createCustomSpan({
       data: {
         name: 'Codex web search',
-        data: buildWebSearchSpanData(item),
+        data: buildWebSearchSpanData(item, includeSensitiveData),
       },
     });
     span.start();
@
```

**File**: `packages/agents-extensions/test/experimental/codex/index.test.ts` (modified, +422/-2)
```diff
@@ -3,6 +3,8 @@ import {
   BatchTraceProcessor,
   ConsoleSpanExporter,
   RunContext,
+  Runner,
+  createCustomSpan,
   Span,
   TracingProcessor,
   setTraceProcessors,
@@ -13,6 +15,7 @@ import {
 } from '@openai/agents';
 import { describe, afterEach, beforeEach, expect, test, vi } from 'vitest';
 import { z } from 'zod';
+import { ScriptedModel, functionCall } from '@openai/agents-core/testing';
 import { codexTool } from '../../../src/experimental/codex';
 
 type AnySpan = Span<any>;
@@ -21,6 +24,8 @@ const codexMockState: {
   events: any[];
   threadId: string | null;
   lastTurnOptions?: any;
+  afterEvent?: () => void;
+  streamError?: Error;
 } = {
   events: [],
   threadId: 'thread-1',
@@ -47,9 +52,16 @@ vi.mock('@openai/codex-sdk', () => {
       async function* eventStream(events: any[]) {
         for (const event of events) {
           yield event;
+          codexMockState.afterEvent?.();
         }
       }
-      return { events: eventStream(codexMockState.events) };
+      const stream = async function* () {
+        yield* eventStream(codexMockState.events);
+        if (codexMockState.streamError) {
+          throw codexMockState.streamError;
+        }
+      };
+      return { events: stream() };
     }
   }
 
@@ -67,12 +79,17 @@ vi.mock('@openai/codex-sdk', () => {
 
 class CollectingProcessor implements TracingProcessor {
   public spans: AnySpan[] = [];
+  public started: AnySpan[] = [];
+  public startSnapshots: unknown[] = [];
 
   async onTraceStart(): Promise<void> {}
 
   async onTraceEnd(): Promise<void> {}
 
-  async onSpanStart(): Promise<void> {}
+  async onSpanStart(span: AnySpan): Promise<void> {
+    this.started.push(span);
+    this.startSnapshots.push(structuredClone(span.toJSON()));
+  }
 
   async onSpanEnd(span: AnySpan): Promise<void> {
     this.spans.push(span);
@@ -90,6 +107,10 @@ describe('codexTool', () => {
 
   beforeEach(() => {
     processor.spans = [];
+    processor.started = [];
+    processor.startSnapshots = [];
+    codexMockState.afterEvent = undefined;
+    codexMockState.streamError = undefined;
     setTracingDisabled(false);
     setTraceProcessors([processor]);
     codexMockState.events = [];
@@ -117,6 +138,405 @@ describe('codexTool', () => {
     }
   });
 
+  function policyEvents() {
+    const events: any[] = [{ type: 'thread.started', thread_id: 'thread-1' }];
+    for (const phase of ['started', 'updated', 'completed']) {
+      const payload = `private-${phase}`;
+      const status = phase === 'completed' ? 'failed' : 'in_progress';
+      const items = [
+        {
+          id: 'command',
+          type: 'command_execution',
+          command: payload,
+          aggregated_output: payload,
+          exit_code: 7,
+          status,
+        },
+        {
+          id: 'files',
+          type: 'file_change',
+          changes: [{ path: payload, kind: 'update' }],
+          status,
+        },
+        {
+          id: 'mcp',
+          type: 'mcp_tool_call',
+          server: 'server',
+          tool: 'lookup',
+          arguments: { query: payload },
+          result: {
+            content: [{ type: 'text', text: payload }],
+            structured_content: { answer: payload },
+          },
+          error: { message: payload },
+          status,
+        },
+        { id: 'search', type: 'web_search', query: payload },
+        {
+          id: 'todo',
+          type: 'todo_list',
+          items: [{ text: payload, completed: phase === 'completed' }],
+        },
+        { id: 'reason', type: 'reasoning', text: payload },
+        { id: 'error', type: 'error', message: payload },
+      ];
+      events.push(...items.map((item) => ({ type: `item.${phase}`, item })));
+    }
+    events.push(
+      {
+        type: 'item.completed',
+        item: {
+          id: 'message',
+          type: 'agent_message',
+          text: 'private-response',
+        },
+      },
+      {
+        type: 'turn.completed',
+        usage: 
```

---

### Incident Patch 10: `612009de` (2026-09-21)
**Commit Message**: fix: pass changeset prompt Git arguments without a shell (#1972)

**File**: `.agents/skills/changeset-validation/scripts/changeset-prompt.mjs` (modified, +32/-22)
```diff
@@ -2,7 +2,7 @@
 
 import fs from 'fs';
 import path from 'path';
-import { execSync, spawnSync } from 'child_process';
+import { execFileSync, spawnSync } from 'child_process';
 
 const { console, process } = globalThis;
 
@@ -41,18 +41,17 @@ Options:
 `);
 }
 
-function run(cmd, options = {}) {
-  return execSync(cmd, {
+function run(args) {
+  return execFileSync('git', args, {
     encoding: 'utf8',
     stdio: ['ignore', 'pipe', 'pipe'],
     maxBuffer: EXEC_MAX_BUFFER,
-    ...options,
   }).trim();
 }
 
-function runOptional(cmd) {
+function runOptional(args) {
   try {
-    return run(cmd);
+    return run(args);
   } catch (_error) {
     return '';
   }
@@ -294,7 +293,7 @@ async function main() {
     process.exit(0);
   }
 
-  const repoRoot = run('git rev-parse --show-toplevel');
+  const repoRoot = run(['rev-parse', '--show-toplevel']);
   process.chdir(repoRoot);
 
   const eventPayload = readEventPayload();
@@ -304,40 +303,47 @@ async function main() {
   const baseRef =
     options.base ||
     eventBaseSha ||
-    (runOptional('git rev-parse --verify origin/main')
+    (runOptional(['rev-parse', '--verify', 'origin/main'])
       ? 'origin/main'
       : 'main');
   const headRef = options.head || eventHeadSha || 'HEAD';
 
   let baseSha;
   let headSha;
   try {
-    headSha = run(`git rev-parse ${headRef}`);
-    baseSha = run(`git merge-base ${baseRef} ${headRef}`);
+    headSha = run(['rev-parse', headRef]);
+    baseSha = run(['merge-base', baseRef, headRef]);
   } catch (error) {
     console.error(`Failed to resolve git refs: ${error.message}`);
     process.exit(1);
   }
 
   const includeWorkingTree = !options.ci;
   const changes = new Map();
-  const committedDiff = runOptional(
-    `git diff --name-status ${baseSha} ${headSha}`,
-  );
+  const committedDiff = runOptional([
+    'diff',
+    '--name-status',
+    baseSha,
+    headSha,
+  ]);
   for (const entry of parseNameStatus(committedDiff)) {
     changes.set(entry.path, entry.status);
   }
 
   if (includeWorkingTree) {
-    const staged = runOptional('git diff --name-status --cached');
-    const unstaged = runOptional('git diff --name-status');
+    const staged = runOptional(['diff', '--name-status', '--cached']);
+    const unstaged = runOptional(['diff', '--name-status']);
     for (const entry of parseNameStatus(staged)) {
       changes.set(entry.path, entry.status);
     }
     for (const entry of parseNameStatus(unstaged)) {
       changes.set(entry.path, entry.status);
     }
-    const untracked = runOptional('git ls-files --others --exclude-standard');
+    const untracked = runOptional([
+      'ls-files',
+      '--others',
+      '--exclude-standard',
+    ]);
     for (const line of untracked.split(/\r?\n/).filter(Boolean)) {
       changes.set(line, 'A');
     }
@@ -417,9 +423,7 @@ async function main() {
   );
   const committedPackageDiff =
     relevantPackagePaths.length > 0
-      ? runOptional(
-          `git diff ${baseSha} ${headSha} -- ${relevantPackagePaths.join(' ')}`,
-        )
+      ? runOptional(['diff', baseSha, headSha, '--', ...relevantPackagePaths])
       : '';
   if (committedPackageDiff) {
     diffSections.push(`Committed diff (packages):\n${committedPackageDiff}`);
@@ -428,14 +432,14 @@ async function main() {
   if (includeWorkingTree) {
     const stagedPackageDiff =
       relevantPackagePaths.length > 0
-        ? runOptional(`git diff --cached -- ${relevantPackagePaths.join(' ')}`)
+        ? runOptional(['diff', '--cached', '--', ...relevantPackagePaths])
         : '';
     if (stagedPackageDiff && relevantPackageDirs.size > 0) {
       diffSections.push(`Staged diff (packages):\n${stagedPackageDiff}`);
     }
     const unstagedPackageDiff =
       relevantPackagePaths.length > 0
-        ? runOptional(`git diff -- ${relevantPackagePaths.join(' ')}`)
+        ? runOptional(['diff', '--', ...relevantPackagePaths])
         : '';
     if (unstagedPackageDiff && relevantPackageDirs.size > 0) {
```

**File**: `.agents/skills/changeset-validation/scripts/changeset-prompt.test.mjs` (added, +231/-0)
```diff
@@ -0,0 +1,231 @@
+import assert from 'node:assert/strict';
+import fs from 'node:fs';
+import path from 'node:path';
+import test from 'node:test';
+import { URL } from 'node:url';
+import { SourceTextModule, SyntheticModule, createContext } from 'node:vm';
+
+const source = fs.readFileSync(
+  new URL('./changeset-prompt.mjs', import.meta.url),
+  'utf8',
+);
+const templatePath =
+  '.agents/skills/changeset-validation/references/validation-prompt.md';
+const template = fs.readFileSync(
+  new URL('../references/validation-prompt.md', import.meta.url),
+  'utf8',
+);
+
+// Every process and filesystem operation in the generator is recorded or stubbed.
+// Special-character fixtures never reach an operating-system process or Git object.
+async function generate({ ci = false, failOptional = false } = {}) {
+  const baseRef = 'base;literal&suffix';
+  const headRef = 'topic$(literal)';
+  const packageDir = "extra package;'$ &()";
+  const packagePath = `packages/${packageDir}`;
+  const changedFile = `${packagePath}/source file.ts`;
+  const untrackedFile = `${packagePath}/new file.ts`;
+  const changeset = '.changeset/example.md';
+  const calls = [];
+  const output = [];
+  const errors = [];
+  const writes = [];
+  const files = new Map([
+    [templatePath, template],
+    [
+      'packages/agents-core/package.json',
+      '{"name":"@openai/agents-core","version":"1.0.0"}',
+    ],
+  ]);
+  const sameArgs = (args, expected) =>
+    JSON.stringify(args) === JSON.stringify(expected);
+  function record(method, file, args, options) {
+    assert.equal(file, 'git');
+    assert.ok(Array.isArray(args));
+    assert.ok(args.every((arg) => typeof arg === 'string'));
+    assert.ok(!options.shell);
+    calls.push({ method, args: Array.from(args) });
+  }
+  const childProcess = {
+    execSync() {
+      throw new Error('Shell execution is forbidden in this test');
+    },
+    execFileSync(file, args, options) {
+      record('execFileSync', file, args, options);
+      assert.equal(options.encoding, 'utf8');
+      assert.deepEqual(Array.from(options.stdio), ['ignore', 'pipe', 'pipe']);
+      assert.equal(options.maxBuffer, 1024 * 1024);
+      if (sameArgs(args, ['rev-parse', '--show-toplevel'])) return '/fixture\n';
+      if (sameArgs(args, ['rev-parse', headRef])) {
+        return 'head-sha\n';
+      }
+      if (sameArgs(args, ['merge-base', baseRef, headRef])) return 'base-sha\n';
+      if (sameArgs(args, ['diff', '--name-status', 'base-sha', 'head-sha'])) {
+        return `M\t${changedFile}\nA\t${changeset}\nM\tpackages/agents-core/package.json\n`;
+      }
+      if (sameArgs(args, ['diff', '--name-status', '--cached']))
+        return `M\t${changedFile}\n`;
+      if (sameArgs(args, ['diff', '--name-status']))
+        return `M\t${changedFile}\n`;
+      if (sameArgs(args, ['ls-files', '--others', '--exclude-standard']))
+        return `${untrackedFile}\n`;
+      if (sameArgs(args, ['diff', 'base-sha', 'head-sha', '--', packagePath]))
+        return ' committed content \n';
+      if (sameArgs(args, ['diff', '--cached', '--', packagePath]))
+        return ' staged content \n';
+      if (sameArgs(args, ['diff', '--', packagePath])) {
+        if (failOptional) throw new Error('optional diff unavailable');
+        return ' unstaged content \n';
+      }
+      if (
+        sameArgs(args, [
+          'ls-files',
+          '--others',
+          '--exclude-standard',
+          '--',
+          changedFile,
+        ])
+      )
+        return '';
+      if (
+        sameArgs(args, [
+          'ls-files',
+          '--others',
+          '--exclude-standard',
+          '--',
+          untrackedFile,
+        ])
+      )
+        return `${untrackedFile}\n`;
+      throw new Error(`Unexpected invocation: ${JSON.stringify(args)}`);
+    },
+    spawnSync(file, args, options) {
+      record('spawnSync', file, args, options);
+      if (sameArgs(args, ['show', `head-sha:${changeset}`])) {
+        r
```

**File**: `.agents/skills/changeset-validation/scripts/run-fixtures.sh` (modified, +2/-0)
```diff
@@ -4,6 +4,8 @@ set -euo pipefail
 ROOT_DIR=$(git rev-parse --show-toplevel)
 SKILL_DIR="$ROOT_DIR/.agents/skills/changeset-validation"
 
+node --experimental-vm-modules --test "$SKILL_DIR/scripts/changeset-prompt.test.mjs"
+
 node "$SKILL_DIR/scripts/changeset-prompt.mjs" --output "$SKILL_DIR/tmp/prompt.md" >/dev/null
 
 TMP_DIR=$(mktemp -d)
```

#### Recent Merged Pull Requests:
- **PR #1985** (2026-09-25): fix(realtime): preserve history order across overlapping edits (@jbeckwith-oai)
- **PR #1984** (2026-09-25): docs: update top page content (@seratch)
- **PR #1983** (2026-09-25): docs: add GPT Live Responses delegation example (@seratch)
- **PR #1982** (2026-09-25): docs: update translated pages (@seratch)
- **PR #1981** (2026-09-24): docs: update the top page to align with developers.openai.com site (@seratch)
- **PR #1980** (2026-09-24): fix: accept deferred hosted MCP listings before tool search (@jbeckwith-oai)
- **PR #1979** (2026-09-24): docs: remove beta tag from sandbox agents docs (@seratch)
- **PR #1977** (2026-09-24): fix: Preserve unrelated MCP server tool caches during invalidation (@jbeckwith-oai)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
