# Forensic Learning Record (Deep Inspection): coreyhaines31/marketingskills

> **Canonical Artifact**: `07_PROJECT_LEARNING/coreyhaines31-marketingskills-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-07T19:30:19.261Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `coreyhaines31/marketingskills`
- **Description**: Marketing skills for Claude Code and AI agents. CRO, copywriting, SEO, analytics, and growth engineering.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 53569 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `scripts/check-versions.mjs`
```
#!/usr/bin/env node
// Enforce the versioning rules in AGENTS.md.
//
//   node scripts/check-versions.mjs                  # consistency checks only
//   node scripts/check-versions.mjs --base origin/main  # also require bumps vs base (CI)
//
// Consistency:
//   - every skill's metadata.version matches its VERSIONS.md row, and every skill has a row
//   - plugin.json, marketplace.json, and .codex-plugin/plugin.json share one repo version, matching the newest `### x.y.z` block in VERSIONS.md
//   - every file in skills/<name>/references/ is linked from that skill's SKILL.md
//     or from another of its reference files (no orphans)
// With --base:
//   - a skill whose files changed must bump metadata.version (evals/ is exempt: it doesn't ship behavior)
//   - if any skill changed, was added, or was removed, the repo version must bump

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const baseIdx = process.argv.indexOf("--base");
const base = baseIdx > -1 ? process.argv[baseIdx + 1] : null;

const errors = [];
const read = (p) => readFileSync(resolve(ROOT, p), "utf8");
const git = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });

const frontmatter = (text) => text.replace(/\r\n/g, "\n").match(/^---\n([\s\S]*?)\n---/)?.[1] ?? "";
const skillVersion = (text) => frontmatter(text).match(/^metadata:\s*\n(?:[ \t]+.*\n)*?[ \t]+version:\s*["']?([\d.]+)/m)?.[1];
const repoVersion = (json) => JSON.parse(json).version;
const marketVersion = (json) => JSON.parse(json).metadata?.version;
const newer = (a, b) => {
  const [x, y] = [a, b].map((v) => v.split(".").map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

const skills = readdirSync(resolve(ROOT, "skills"), { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(resolve(ROOT, "skills", d.name, "SKILL.md")))
  .map((d) => d.name);

// VERSIONS.md table <-> SKILL.md metadata
const versionsMd = read("VERSIONS.md").replace(/\r\n/g, "\n");
const table = Object.fromEntries(
  [...versionsMd.matchAll(/^\|\s*([a-z0-9-]+)\s*\|\s*(\d+\.\d+\.\d+)\s*\|/gm)].map((m) => [m[1], m[2]])
);

for (const name of skills) {
  const v = skillVersion(read(`skills/${name}/SKILL.md`));
  if (!v) errors.push(`skills/${name}/SKILL.md: missing metadata.version`);
  else if (!table[name]) errors.push(`VERSIONS.md: no row for ${name}`);
  else if (table[name] !== v) errors.push(`${name}: SKILL.md is ${v} but VERSIONS.md says ${table[name]}`);
}
for (const name of Object.keys(table)) {
  if (!skills.includes(name)) errors.push(`VERSIONS.md: row for ${name}, but skills/${name}/SKILL.md doesn't exist`);
}

// Repo version
const plugin = repoVersion(read(".claude-plugin/plugin.json"));
const market = marketVersion(read(".claude-plugin/marketplace.json"));
if (plugin !== market) errors.push(`plugin.json is ${plugin} but marketplace.json metadata.version is ${market}`);
const codexPath = resolve(ROOT, ".codex-plugin/plugin.json");
if (existsSync(codexPath)) {
  const codex = repoVersion(readFileSync(codexPath, "utf8"));
  if (codex !== plugin) errors.push(`.codex-plugin/plugin.json is ${codex} but plugin.json is ${plugin}`);
}
const latestHeading = versionsMd.match(/^### (\d+\.\d+\.\d+)(\s|$)/m)?.[1];
if (latestHeading !== plugin) errors.push(`VERSIONS.md: newest changelog block is ${latestHeading ?? "missing"}, but repo version is ${plugin}`);

// Orphan references
for (const name of skills) {
  const dir = resolve(ROOT, "skills", name, "references");
  if (!existsSync(dir)) continue;
  const files = readdirSync(dir);
  const skillMd = read(`skills/${name}/SKILL.md`);
  for (const file of files) {
    if (skillMd.includes(file)) continue;
    const linkedFromSibling = files.some((other) => other !== file && read(`skills/${name}/references/${other}`).includes(file));
    if (!linkedFromSibling) errors.push(`skills/${name}/references/${file}: not linked from SKILL.md or any sibling reference`);
  }
}

// Bumps vs base
if (base) {
  const atBase = (path) => {
    try {
      // A path missing at base (a new skill) is expected; keep git's "fatal:" off stderr.
      return execFileSync("git", ["show", `${base}:${path}`], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    } catch {
      return null;
    }
  };
  const changed = git("diff", "--name-only", `${base}...HEAD`).split("\n").filter(Boolean);
  const touched = (paths) => [...new Set(paths.map((p) => p.match(/^skills\/([^/]+)\//)?.[1]).filter(Boolean))];
  const changedSkills = touched(changed.filter((p) => !/^skills\/[^/]+\/evals\//.test(p)));

  for (const name of changedSkills.filter((n) => skills.includes(n))) {
    const before = atBase(`skills/${name}/SKILL.md`);
    if (!before) continue;
    const was = skillVersion(before);
    const now = skillVersion(read(`skills/${name}/SKILL.md`));
    if (was && now && !newer(now, was)) errors.push(`${name}: files changed but metadata.version went ${was} → ${now}; it must increase`);
  }

  const basePlugin = atBase(".claude-plugin/plugin.json");
  if (changedSkills.length && basePlugin && !newer(plugin, repoVersion(basePlugin))) {
    errors.push(`skills changed (${changedSkills.join(", ")}) but repo version went ${repoVersion(basePlugin)} → ${plugin}; it must increase`);
  }
}

if (errors.length) {
  console.error(errors.map((e) => `✗ ${e}`).join("\n"));
  process.exit(1);
}
console.log(`✓ versions consistent across ${skills.length} skills (repo ${plugin})${base ? `, bumps checked against ${base}` : ""}`);

```

### Core Architecture Module: `scripts/sync-partners.mjs`
```
#!/usr/bin/env node
// Regenerate every partner surface from the canonical partners.json.
//
//   node scripts/sync-partners.mjs           # write the generated blocks
//   node scripts/sync-partners.mjs --check   # fail if anything is out of date (CI)
//
// Owns the marked blocks in:
//   - README.md                → the Partners section list
//   - tools/REGISTRY.md        → the Verified Partners table
// Everything outside the <!-- PARTNERS:START --> / <!-- PARTNERS:END --> markers
// is left untouched. The marketing-skills.com site reads partners.json directly.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");
const REPO = "https://github.com/coreyhaines31/marketingskills/blob/main";
const REF = "?ref=marketingskills";

const START = "<!-- PARTNERS:START -->";
const END = "<!-- PARTNERS:END -->";
const check = process.argv.includes("--check");

const { partners } = JSON.parse(readFileSync(resolve(ROOT, "partners.json"), "utf8"));
const active = partners.filter((p) => p.active);

const readmeBlock = active.length
  ? active
      .map(
        (p) =>
          `> ◆ **[${p.name}](${p.url}${REF})** — *${p.categoryShort || p.category}.* ${p.blurb} → [Integration guide](${p.integration})`
      )
      .join("\n\n")
  : "_No active partners yet. [Become a partner →](https://marketing-skills.com/sponsorship)_";

const registryBlock = [
  "| Partner | Category | Guide |",
  "|---------|----------|-------|",
  ...active.map(
    (p) =>
      `| ◆ ${p.name} | ${p.categoryShort || p.category} | [${p.integration.split("/").pop()}](${p.integration.replace(/^tools\//, "")}) |`
  ),
].join("\n");

const targets = [
  { file: "README.md", block: readmeBlock },
  { file: "tools/REGISTRY.md", block: registryBlock },
];

let stale = false;
for (const { file, block } of targets) {
  const path = resolve(ROOT, file);
  const src = readFileSync(path, "utf8");
  const i = src.indexOf(START);
  const j = src.indexOf(END);
  if (i === -1 || j === -1 || j < i) {
    console.error(`✗ ${file}: missing ${START} / ${END} markers`);
    process.exitCode = 1;
    continue;
  }
  const newline = src.includes("\r\n") ? "\r\n" : "\n";
  const generatedBlock = block.replaceAll("\n", newline);
  const next = src.slice(0, i + START.length) + newline + generatedBlock + newline + src.slice(j);
  if (next === src) {
    console.log(`✓ ${file} up to date`);
    continue;
  }
  if (check) {
    console.error(`✗ ${file} is out of date — run: node scripts/sync-partners.mjs`);
    stale = true;
    continue;
  }
  writeFileSync(path, next);
  console.log(`↻ ${file} updated (${active.length} partner${active.length === 1 ? "" : "s"})`);
}

if (check && stale) process.exitCode = 1;

```

### Core Architecture Module: `tools/clis/activecampaign.js`
```
#!/usr/bin/env node

const rawArgs = process.argv.slice(2)
const API_KEY = process.env.ACTIVECAMPAIGN_API_KEY
const API_URL = process.env.ACTIVECAMPAIGN_API_URL

if ((!API_KEY) && rawArgs.length > 0) {
  console.error(JSON.stringify({ error: 'ACTIVECAMPAIGN_API_KEY environment variable required' }))
  process.exit(1)
}

if ((!API_URL) && rawArgs.length > 0) {
  console.error(JSON.stringify({ error: 'ACTIVECAMPAIGN_API_URL environment variable required (e.g. https://yourname.api-us1.com)' }))
  process.exit(1)
}

const BASE_URL = API_URL ? `${API_URL.replace(/\/$/, '')}/api/3` : ''

async function api(method, path, body) {
  if (args['dry-run']) {
    return { _dry_run: true, method, url: `${BASE_URL}${path}`, headers: { 'Api-Token': '***', 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: body || undefined }
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Api-Token': API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

function parseArgs(args) {
  const result = { _: [] }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        result[key] = next
        i++
      } else {
        result[key] = true
      }
    } else {
      result._.push(arg)
    }
  }
  return result
}

const args = parseArgs(rawArgs)
const [cmd, sub, ...rest] = args._

async function main() {
  let result
  const limit = args.limit ? Number(args.limit) : 20
  const offset = args.offset ? Number(args.offset) : 0

  switch (cmd) {
    case 'contacts':
      switch (sub) {
        case 'list': {
          const params = new URLSearchParams()
          params.set('limit', String(limit))
          params.set('offset', String(offset))
          if (args.email) params.set('email', args.email)
          if (args.search) params.set('search', args.search)
          if (args['list-id']) params.set('listid', args['list-id'])
          if (args.status) params.set('status', args.status)
          result = await api('GET', `/contacts?${params.toString()}`)
          break
        }
        case 'get': {
          const id = args.id
          if (!id) { result = { error: '--id required' }; break }
          result = await api('GET', `/contacts/${id}`)
          break
        }
        case 'create': {
          const email = args.email
          if (!email) { result = { error: '--email required' }; break }
          const contact = { email }
          if (args['first-name']) contact.firstName = args['first-name']
          if (args['last-name']) contact.lastName = args['last-name']
          if (args.phone) contact.phone = args.phone
          result = await api('POST', '/contacts', { contact })
          break
        }
        case 'update': {
          const id = args.id
          if (!id) { result = { error: '--id required' }; break }
          const contact = {}
          if (args.email) contact.email = args.email
          if (args['first-name']) contact.firstName = args['first-name']
          if (args['last-name']) contact.lastName = args['last-name']
          if (args.phone) contact.phone = args.phone
          result = await api('PUT', `/contacts/${id}`, { contact })
          break
        }
        case 'delete': {
          const id = args.id
          if (!id) { result = { error: '--id required' }; break }
          result = await api('DELETE', `/contacts/${id}`)
          break
        }
        case 'sync': {
          const email = args.email
          if (!email) { result = { error: '--email required' }; break }
          const contact = { email }
          if (args['first-name']) contact.firstName = args['first-name']
          if (args['last-name']) contact.lastName = args['last-name']
          if (args.phone) contact.phone = args.phone
          result = await api('POST', '/contact/sync', { contact })
          break
        }
        default:
          result = { error: 'Unknown contacts subcommand. Use: list, get, create, update, delete, sync' }
      }
      break

    case 'lists':
      switch (sub) {
        case 'list': {
          const params = new URLSearchParams()
          params.set('limit', String(limit))
          params.set('offset', String(offset))
          result = await api('GET', `/lists?${params.toString()}`)
          break
        }
        case 'get': {
          const id = args.id
          if (!id) { result = { error: '--id required' }; break }
          result = await api('GET', `/lists/${id}`)
          break
        }
        case 'create': {
          const name = args.name
          if (!name) { result = { error: '--name required' }; break }
          const list = { name }
          if (args['string-id']) list.stringid = args['string-id']
          if (args['sender-url']) list.sender_url = args['sender-url']
          if (args['sender-reminder']) list.sender_reminder = args['sender-reminder']
          result = await api('POST', '/lists', { list })
          break
        }
        case 'delete': {
          const id = args.id
          if (!id) { result = { error: '--id required' }; break }
          result = await api('DELETE', `/lists/${id}`)
          break
        }
        case 'subscribe': {
          const listId = args['list-id'] || args.id
          const contactId = args['contact-id']
          if (!listId) { result = { error: '--list-id required' }; break }
          if (!contactId) { result = { error: '--contact-id required' }; break }
          result = await api('POST', '/contactLists', {
            contactList: { list: listId, contact: contactId, status: 1 }
          })
          break
        }
        case 'unsubscribe': {
          const listId = args['list-id'] || args.id
          const contactId = args['contact-id']
          if (!listId) { result = { error: '--list-id required' }; break }
          if (!contactId) { result = { error: '--contact-id required' }; break }
          result = await api('POST', '/contactLists', {
            contactList: { list: listId, contact: contactId, status: 2 }
          })
          break
        }
        default:
          result = { error: 'Unknown lists subcommand. Use: list, get, create, delete, subscribe, unsubscribe' }
      }
      break

    case 'campaigns':
      switch (sub) {
        case 'list': {
          const params = new URLSearchParams()
          params.set('limit', String(limit))
          params.set('offset', String(offset))
          result = await api('GET', `/campaigns?${params.toString()}`)
          break
        }
        case 'get': {
          const id = args.id
          if (!id) { result = { error: '--id required' }; break }
          result = await api('GET', `/campaigns/${id}`)
          break
        }
        default:
          result = { error: 'Unknown campaigns subcommand. Use: list, get' }
      }
      break

    case 'deals':
      switch (sub) {
        case 'list': {
          const params = new URLSearchParams()
          params.set('limit', String(limit))
          params.set('offset', String(offset))
          if (args.search) params.set('search', args.search)
          if (args.stage) params.set('filters[stage]', args.stage)
          if (args.owner) params.set('filters[owner]', args.owner)
          result = await api('GET', `/deals?${params.toString()}`)
          break
        }
        case 'get': {
          const id = args.id
          if (!id) { result = { error: '--id required' }; break }
          result = await api('GET', `/deals/${id}`)
          break
        }
        case 'create': {
          const title = args.title
          if (!title) { result = { error: '--title required' }; break }
          const deal = { title }
          if (args.value) deal.value = Number(args.value)
          if (args.currency) deal.currency = args.currency
          if (args.pipeline) deal.group = args.pipeline
          if (args.stage) deal.stage = args.stage
          if (args.owner) deal.owner = args.owner
          if (args['contact-id']) deal.contact = args['contact-id']
          result = await api('POST', '/deals', { deal })
          break
        }
        case 'update': {
          const id = args.id
          if (!id) { result = { error: '--id required' }; break }
          const deal = {}
          if (args.title) deal.title = args.title
          if (args.value) deal.value = Number(args.value)
          if (args.stage) deal.stage = args.stage
          if (args.owner) deal.owner = args.owner
          if (args.status) deal.status = Number(args.status)
          result = await api('PUT', `/deals/${id}`, { deal })
          break
        }
        case 'delete': {
          const id = args.id
          if (!id) { result = { error: '--id required' }; break }
          result = await api('DELETE', `/deals/${id}`)
          break
        }
        default:
          result = { error: 'Unknown deals subcommand. Use: list, get, create, update, delete' }
      }
      break

    case 'automations':
      switch (sub) {
        case 'list': {
          const params = new URLSearchParams()
          params.set('limit', String(limit))
          params.set('offset', String(offset))
          result = await api('GET', `/automations?${params.toString()}`)
          break
        }
        case 'get': {
          const id = args.id
          if (!id) { result = { error: '--id required' }; break }
          result = await api('GET', `/automations/${id}`)
          break
        }
        case 'add-contact': {
          const automationId = args.id
          const contactId = args['contact-id']
          if (!automationId) { result = { error: '--id required (autom
```

### Core Architecture Module: `tools/clis/adobe-analytics.js`
```
#!/usr/bin/env node

const rawArgs = process.argv.slice(2)
const ACCESS_TOKEN = process.env.ADOBE_ACCESS_TOKEN
const CLIENT_ID = process.env.ADOBE_CLIENT_ID
const COMPANY_ID = process.env.ADOBE_COMPANY_ID

if ((!ACCESS_TOKEN || !CLIENT_ID || !COMPANY_ID) && rawArgs.length > 0) {
  console.error(JSON.stringify({ error: 'ADOBE_ACCESS_TOKEN, ADOBE_CLIENT_ID, and ADOBE_COMPANY_ID environment variables required' }))
  process.exit(1)
}

const BASE_URL = `https://analytics.adobe.io/api/${COMPANY_ID}`

async function api(method, path, body) {
  if (args['dry-run']) {
    return { _dry_run: true, method, url: `${BASE_URL}${path}`, headers: { 'Authorization': '***', 'x-api-key': '***', 'x-proxy-global-company-id': COMPANY_ID, 'Content-Type': 'application/json' }, body: body || undefined }
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'x-api-key': CLIENT_ID,
      'x-proxy-global-company-id': COMPANY_ID,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

function parseArgs(args) {
  const result = { _: [] }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        result[key] = next
        i++
      } else {
        result[key] = true
      }
    } else {
      result._.push(arg)
    }
  }
  return result
}

const args = parseArgs(rawArgs)
const [cmd, sub, ...rest] = args._

async function main() {
  let result

  switch (cmd) {
    case 'reportsuites':
      switch (sub) {
        case 'list':
          result = await api('GET', '/reportsuites')
          break
        default:
          result = { error: 'Unknown reportsuites subcommand. Use: list' }
      }
      break

    case 'dimensions':
      switch (sub) {
        case 'list': {
          if (!args.rsid) { result = { error: '--rsid required' }; break }
          const params = new URLSearchParams()
          params.set('rsid', args.rsid)
          result = await api('GET', `/dimensions?${params}`)
          break
        }
        default:
          result = { error: 'Unknown dimensions subcommand. Use: list' }
      }
      break

    case 'metrics':
      switch (sub) {
        case 'list': {
          if (!args.rsid) { result = { error: '--rsid required' }; break }
          const params = new URLSearchParams()
          params.set('rsid', args.rsid)
          result = await api('GET', `/metrics?${params}`)
          break
        }
        default:
          result = { error: 'Unknown metrics subcommand. Use: list' }
      }
      break

    case 'reports':
      switch (sub) {
        case 'run': {
          if (!args.rsid) { result = { error: '--rsid required' }; break }
          if (!args['start-date']) { result = { error: '--start-date required' }; break }
          if (!args['end-date']) { result = { error: '--end-date required' }; break }
          if (!args.metrics) { result = { error: '--metrics required (comma-separated)' }; break }
          const body = {
            rsid: args.rsid,
            globalFilters: [{
              type: 'dateRange',
              dateRange: `${args['start-date']}T00:00:00/${args['end-date']}T23:59:59`,
            }],
            metricContainer: {
              metrics: args.metrics.split(',').map(m => ({ id: m.trim() })),
            },
          }
          if (args.dimension) {
            body.dimension = args.dimension
          }
          result = await api('POST', '/reports', body)
          break
        }
        default:
          result = { error: 'Unknown reports subcommand. Use: run' }
      }
      break

    case 'segments':
      switch (sub) {
        case 'list': {
          const params = new URLSearchParams()
          if (args.rsid) params.set('rsid', args.rsid)
          result = await api('GET', `/segments?${params}`)
          break
        }
        default:
          result = { error: 'Unknown segments subcommand. Use: list' }
      }
      break

    default:
      result = {
        error: 'Unknown command',
        usage: {
          reportsuites: 'reportsuites list',
          dimensions: 'dimensions list --rsid <report_suite_id>',
          metrics: 'metrics list --rsid <report_suite_id>',
          reports: 'reports run --rsid <report_suite_id> --start-date <YYYY-MM-DD> --end-date <YYYY-MM-DD> --metrics <metrics> [--dimension <dimension>]',
          segments: 'segments list [--rsid <report_suite_id>]',
        }
      }
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }))
  process.exit(1)
})

```

### Core Architecture Module: `tools/clis/ahrefs.js`
```
#!/usr/bin/env node

const rawArgs = process.argv.slice(2)
const API_KEY = process.env.AHREFS_API_KEY
const BASE_URL = 'https://api.ahrefs.com/v3'

if ((!API_KEY) && rawArgs.length > 0) {
  console.error(JSON.stringify({ error: 'AHREFS_API_KEY environment variable required' }))
  process.exit(1)
}

async function api(method, path) {
  if (args['dry-run']) {
    return { _dry_run: true, method, url: `${BASE_URL}${path}`, headers: { 'Authorization': '***', 'Content-Type': 'application/json' } }
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

function parseArgs(args) {
  const result = { _: [] }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        result[key] = next
        i++
      } else {
        result[key] = true
      }
    } else {
      result._.push(arg)
    }
  }
  return result
}

const args = parseArgs(rawArgs)
const [cmd, sub, ...rest] = args._

function reportDate() {
  const date = args.date === undefined ? new Date().toISOString().slice(0, 10) : args.date
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('--date must be a valid YYYY-MM-DD calendar date')
  }
  const parsed = new Date(`${date}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error('--date must be a valid YYYY-MM-DD calendar date')
  }
  return date
}

function reportSelect(defaultColumns) {
  if (args.select === undefined) return defaultColumns
  if (typeof args.select !== 'string' || !args.select.split(',').every(column => column.trim())) {
    throw new Error('--select must be a comma-separated list of nonempty columns')
  }
  return args.select
}

async function main() {
  let result
  const mode = args.mode || 'domain'

  switch (cmd) {
    case 'domain-rating':
      switch (sub) {
        case 'get': {
          if (!args.target) { result = { error: '--target required (domain)' }; break }
          const params = new URLSearchParams({ target: args.target, date: reportDate() })
          result = await api('GET', `/site-explorer/domain-rating?${params}`)
          break
        }
        default:
          result = { error: 'Unknown domain-rating subcommand. Use: get' }
      }
      break

    case 'backlinks':
      switch (sub) {
        case 'list': {
          if (!args.target) { result = { error: '--target required (domain or URL)' }; break }
          const params = new URLSearchParams({ target: args.target, mode })
          if (args.limit) params.set('limit', args.limit)
          result = await api('GET', `/site-explorer/backlinks?${params}`)
          break
        }
        default:
          result = { error: 'Unknown backlinks subcommand. Use: list' }
      }
      break

    case 'refdomains':
      switch (sub) {
        case 'list': {
          if (!args.target) { result = { error: '--target required (domain or URL)' }; break }
          const params = new URLSearchParams({ target: args.target, mode })
          if (args.limit) params.set('limit', args.limit)
          result = await api('GET', `/site-explorer/refdomains?${params}`)
          break
        }
        default:
          result = { error: 'Unknown refdomains subcommand. Use: list' }
      }
      break

    case 'keywords':
      switch (sub) {
        case 'organic': {
          if (!args.target) { result = { error: '--target required (domain or URL)' }; break }
          const params = new URLSearchParams({ target: args.target, mode, date: reportDate(), select: reportSelect('keyword,volume,best_position,sum_traffic,best_position_url') })
          if (args.country) params.set('country', args.country)
          if (args.limit) params.set('limit', args.limit)
          result = await api('GET', `/site-explorer/organic-keywords?${params}`)
          break
        }
        default:
          result = { error: 'Unknown keywords subcommand. Use: organic' }
      }
      break

    case 'top-pages':
      switch (sub) {
        case 'list': {
          if (!args.target) { result = { error: '--target required (domain or URL)' }; break }
          const params = new URLSearchParams({ target: args.target, mode, date: reportDate(), select: reportSelect('url,sum_traffic,keywords,top_keyword') })
          if (args.country) params.set('country', args.country)
          if (args.limit) params.set('limit', args.limit)
          result = await api('GET', `/site-explorer/top-pages?${params}`)
          break
        }
        default:
          result = { error: 'Unknown top-pages subcommand. Use: list' }
      }
      break

    case 'keyword-overview':
      switch (sub) {
        case 'get': {
          const params = new URLSearchParams({ keywords: args.keywords })
          if (args.country) params.set('country', args.country)
          result = await api('GET', `/keywords-explorer/overview?${params}`)
          break
        }
        default:
          result = { error: 'Unknown keyword-overview subcommand. Use: get' }
      }
      break

    case 'keyword-suggestions':
      switch (sub) {
        case 'get': {
          const params = new URLSearchParams({ keyword: args.keyword })
          if (args.country) params.set('country', args.country)
          if (args.limit) params.set('limit', args.limit)
          result = await api('GET', `/keywords-explorer/matching-terms?${params}`)
          break
        }
        default:
          result = { error: 'Unknown keyword-suggestions subcommand. Use: get' }
      }
      break

    case 'serp':
      switch (sub) {
        case 'get': {
          const params = new URLSearchParams({ keyword: args.keyword })
          if (args.country) params.set('country', args.country)
          result = await api('GET', `/keywords-explorer/serp-overview?${params}`)
          break
        }
        default:
          result = { error: 'Unknown serp subcommand. Use: get' }
      }
      break

    default:
      result = {
        error: 'Unknown command',
        usage: {
          'domain-rating': 'domain-rating get --target <domain> [--date <YYYY-MM-DD>]',
          'backlinks': 'backlinks list --target <domain> [--mode <mode>] [--limit <n>]',
          'refdomains': 'refdomains list --target <domain> [--mode <mode>] [--limit <n>]',
          'keywords': 'keywords organic --target <domain> [--date <YYYY-MM-DD>] [--select <columns>] [--country <cc>] [--limit <n>]',
          'top-pages': 'top-pages list --target <domain> [--date <YYYY-MM-DD>] [--select <columns>] [--country <cc>] [--limit <n>]',
          'keyword-overview': 'keyword-overview get --keywords <kw1,kw2> [--country <cc>]',
          'keyword-suggestions': 'keyword-suggestions get --keyword <keyword> [--country <cc>] [--limit <n>]',
          'serp': 'serp get --keyword <keyword> [--country <cc>]',
          'modes': 'domain (default), subdomains, prefix, exact',
        }
      }
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }))
  process.exit(1)
})

```

### Core Architecture Module: `tools/clis/airops.js`
```
#!/usr/bin/env node

const rawArgs = process.argv.slice(2)
const API_KEY = process.env.AIROPS_API_KEY
const WORKSPACE_ID = process.env.AIROPS_WORKSPACE_ID
const BASE_URL = 'https://api.airops.com/public_api/v1'

if ((!API_KEY) && rawArgs.length > 0) {
  console.error(JSON.stringify({ error: 'AIROPS_API_KEY environment variable required' }))
  process.exit(1)
}

if ((!WORKSPACE_ID) && rawArgs.length > 0) {
  console.error(JSON.stringify({ error: 'AIROPS_WORKSPACE_ID environment variable required' }))
  process.exit(1)
}

async function api(method, path, body) {
  const url = `${BASE_URL}${path}`
  if (args['dry-run']) {
    return { _dry_run: true, method, url, headers: { 'Authorization': 'Bearer ***', 'Content-Type': 'application/json' }, body: body || undefined }
  }
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

function parseArgs(args) {
  const result = { _: [] }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        result[key] = next
        i++
      } else {
        result[key] = true
      }
    } else {
      result._.push(arg)
    }
  }
  return result
}

const args = parseArgs(rawArgs)
const [cmd, sub, ...rest] = args._

async function main() {
  let result

  switch (cmd) {
    case 'flows':
      switch (sub) {
        case 'list': {
          result = await api('GET', `/workspaces/${WORKSPACE_ID}/flows`)
          break
        }
        case 'get': {
          const id = args.id
          if (!id) { result = { error: '--id required' }; break }
          result = await api('GET', `/workspaces/${WORKSPACE_ID}/flows/${id}`)
          break
        }
        case 'execute': {
          const id = args.id
          if (!id) { result = { error: '--id required' }; break }
          const inputs = args.inputs
          let parsedInputs = {}
          if (inputs) {
            try {
              parsedInputs = JSON.parse(inputs)
            } catch {
              result = { error: '--inputs must be valid JSON' }
              break
            }
          }
          result = await api('POST', `/workspaces/${WORKSPACE_ID}/flows/${id}/execute`, { inputs: parsedInputs })
          break
        }
        case 'runs': {
          const id = args.id
          if (!id) { result = { error: '--id required' }; break }
          result = await api('GET', `/workspaces/${WORKSPACE_ID}/flows/${id}/runs`)
          break
        }
        case 'run-status': {
          const runId = args['run-id']
          if (!runId) { result = { error: '--run-id required' }; break }
          result = await api('GET', `/workspaces/${WORKSPACE_ID}/runs/${runId}`)
          break
        }
        default:
          result = { error: 'Unknown flows subcommand. Use: list, get, execute, runs, run-status' }
      }
      break

    case 'workflows':
      switch (sub) {
        case 'list': {
          result = await api('GET', `/workspaces/${WORKSPACE_ID}/workflows`)
          break
        }
        case 'execute': {
          const id = args.id
          if (!id) { result = { error: '--id required' }; break }
          const inputs = args.inputs
          let parsedInputs = {}
          if (inputs) {
            try {
              parsedInputs = JSON.parse(inputs)
            } catch {
              result = { error: '--inputs must be valid JSON' }
              break
            }
          }
          result = await api('POST', `/workspaces/${WORKSPACE_ID}/workflows/${id}/execute`, { inputs: parsedInputs })
          break
        }
        default:
          result = { error: 'Unknown workflows subcommand. Use: list, execute' }
      }
      break

    default:
      result = {
        error: 'Unknown command',
        usage: {
          flows: {
            list: 'flows list',
            get: 'flows get --id <id>',
            execute: 'flows execute --id <id> --inputs <json>',
            runs: 'flows runs --id <id>',
            'run-status': 'flows run-status --run-id <id>',
          },
          workflows: {
            list: 'workflows list',
            execute: 'workflows execute --id <id> --inputs <json>',
          },
        }
      }
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }))
  process.exit(1)
})

```

### Core Architecture Module: `tools/clis/amplitude.js`
```
#!/usr/bin/env node

const rawArgs = process.argv.slice(2)
const API_KEY = process.env.AMPLITUDE_API_KEY
const SECRET_KEY = process.env.AMPLITUDE_SECRET_KEY
const INGESTION_URL = 'https://api2.amplitude.com'
const QUERY_URL = 'https://amplitude.com/api/2'

if ((!API_KEY) && rawArgs.length > 0) {
  console.error(JSON.stringify({ error: 'AMPLITUDE_API_KEY environment variable required' }))
  process.exit(1)
}

async function ingestApi(method, path, body) {
  if (args['dry-run']) {
    const maskedBody = body ? JSON.parse(JSON.stringify(body)) : undefined
    if (maskedBody && maskedBody.api_key) maskedBody.api_key = '***'
    return { _dry_run: true, method, url: `${INGESTION_URL}${path}`, headers: { 'Content-Type': 'application/json' }, body: maskedBody }
  }
  const res = await fetch(`${INGESTION_URL}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

async function queryApi(method, path, params) {
  if (!SECRET_KEY) {
    return { error: 'AMPLITUDE_SECRET_KEY required for query/export operations' }
  }
  const url = params ? `${QUERY_URL}${path}?${params}` : `${QUERY_URL}${path}`
  if (args['dry-run']) {
    return { _dry_run: true, method, url, headers: { 'Authorization': '***', 'Content-Type': 'application/json' } }
  }
  const auth = Buffer.from(`${API_KEY}:${SECRET_KEY}`).toString('base64')
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
  })
  // Export responses are ZIP archives, not text. Keep JSON stdout while
  // preserving their bytes: Buffer.from(result.body, 'base64') restores the ZIP.
  if (path === '/export' && res.ok) {
    return {
      status: res.status,
      contentType: 'application/zip',
      encoding: 'base64',
      body: Buffer.from(await res.arrayBuffer()).toString('base64'),
    }
  }
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

function parseArgs(args) {
  const result = { _: [] }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        result[key] = next
        i++
      } else {
        result[key] = true
      }
    } else {
      result._.push(arg)
    }
  }
  return result
}

const args = parseArgs(rawArgs)
const [cmd, sub, ...rest] = args._

async function main() {
  let result

  switch (cmd) {
    case 'track':
      switch (sub) {
        case 'event': {
          if (!args['user-id']) { result = { error: '--user-id required' }; break }
          if (!args['event-type']) { result = { error: '--event-type required' }; break }
          const event = {
            user_id: args['user-id'],
            event_type: args['event-type'],
          }
          if (args.properties) {
            event.event_properties = JSON.parse(args.properties)
          }
          result = await ingestApi('POST', '/2/httpapi', {
            api_key: API_KEY,
            events: [event],
          })
          break
        }
        case 'batch': {
          if (!args.events) { result = { error: '--events required (JSON array)' }; break }
          const events = JSON.parse(args.events)
          result = await ingestApi('POST', '/batch', {
            api_key: API_KEY,
            events,
          })
          break
        }
        default:
          result = { error: 'Unknown track subcommand. Use: event, batch' }
      }
      break

    case 'users':
      switch (sub) {
        case 'activity': {
          if (!args['user-id']) { result = { error: '--user-id required' }; break }
          const params = new URLSearchParams()
          params.set('user', args['user-id'])
          result = await queryApi('GET', '/useractivity', params)
          break
        }
        default:
          result = { error: 'Unknown users subcommand. Use: activity' }
      }
      break

    case 'export':
      switch (sub) {
        case 'events': {
          if (!args.start) { result = { error: '--start required (e.g. 20240101T00)' }; break }
          if (!args.end) { result = { error: '--end required (e.g. 20240131T23)' }; break }
          const params = new URLSearchParams()
          params.set('start', args.start)
          params.set('end', args.end)
          result = await queryApi('GET', '/export', params)
          break
        }
        default:
          result = { error: 'Unknown export subcommand. Use: events' }
      }
      break

    case 'retention':
      switch (sub) {
        case 'get': {
          if (!args.start) { result = { error: '--start required (e.g. 20240101)' }; break }
          if (!args.end) { result = { error: '--end required (e.g. 20240131)' }; break }
          const params = new URLSearchParams()
          params.set('start', args.start)
          params.set('end', args.end)
          if (args.event) {
            params.set('e', JSON.stringify([{ event_type: args.event }]))
          }
          result = await queryApi('GET', '/retention', params)
          break
        }
        default:
          result = { error: 'Unknown retention subcommand. Use: get' }
      }
      break

    default:
      result = {
        error: 'Unknown command',
        usage: {
          track: 'track [event --user-id <id> --event-type <type> [--properties <json>] | batch --events <json>]',
          users: 'users activity --user-id <id>',
          export: "export events --start <YYYYMMDDThh> --end <YYYYMMDDThh> (ZIP in base64 body; decode with Buffer.from(result.body, 'base64'))",
          retention: 'retention get --start <YYYYMMDD> --end <YYYYMMDD> [--event <type>]',
        }
      }
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }))
  process.exit(1)
})

```

### Core Architecture Module: `tools/clis/apollo.js`
```
#!/usr/bin/env node

const rawArgs = process.argv.slice(2)
const API_KEY = process.env.APOLLO_API_KEY
const BASE_URL = 'https://api.apollo.io/api/v1'

if ((!API_KEY) && rawArgs.length > 0) {
  console.error(JSON.stringify({ error: 'APOLLO_API_KEY environment variable required' }))
  process.exit(1)
}

async function api(method, path, body) {
  const authBody = body ? { ...body, api_key: API_KEY } : { api_key: API_KEY }
  if (args['dry-run']) {
    return { _dry_run: true, method, url: `${BASE_URL}${path}`, headers: { 'Content-Type': 'application/json' }, body: { ...authBody, api_key: '***' } }
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(authBody),
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

function parseArgs(args) {
  const result = { _: [] }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        result[key] = next
        i++
      } else {
        result[key] = true
      }
    } else {
      result._.push(arg)
    }
  }
  return result
}

const args = parseArgs(rawArgs)
const [cmd, sub, ...rest] = args._

async function main() {
  let result
  const page = args.page ? Number(args.page) : 1
  const perPage = args['per-page'] ? Number(args['per-page']) : 25

  switch (cmd) {
    case 'people':
      switch (sub) {
        case 'search': {
          const body = { page, per_page: perPage }
          if (args.titles) body.person_titles = args.titles.split(',')
          if (args.locations) body.person_locations = args.locations.split(',')
          if (args.seniorities) body.person_seniorities = args.seniorities.split(',')
          if (args['employee-ranges']) body.organization_num_employees_ranges = args['employee-ranges'].split(',').map(r => r.trim())
          if (args.keywords) body.q_keywords = args.keywords
          result = await api('POST', '/mixed_people/search', body)
          break
        }
        case 'enrich': {
          const body = {}
          if (args.email) body.email = args.email
          if (args['first-name']) body.first_name = args['first-name']
          if (args['last-name']) body.last_name = args['last-name']
          if (args.domain) body.domain = args.domain
          if (args.linkedin) body.linkedin_url = args.linkedin
          if (!args.email && !args.linkedin && !(args['first-name'] && args.domain)) {
            result = { error: '--email, --linkedin, or --first-name + --domain required' }
            break
          }
          result = await api('POST', '/people/match', body)
          break
        }
        case 'bulk-enrich': {
          const emails = args.emails?.split(',')
          if (!emails) { result = { error: '--emails required (comma-separated)' }; break }
          const details = emails.map(email => ({ email: email.trim() }))
          result = await api('POST', '/people/bulk_match', { details })
          break
        }
        default:
          result = { error: 'Unknown people subcommand. Use: search, enrich, bulk-enrich' }
      }
      break

    case 'organizations':
      switch (sub) {
        case 'search': {
          const body = { page, per_page: perPage }
          if (args.locations) body.organization_locations = args.locations.split(',')
          if (args['employee-ranges']) body.organization_num_employees_ranges = args['employee-ranges'].split(',').map(r => r.trim())
          if (args.keywords) body.q_keywords = args.keywords
          result = await api('POST', '/mixed_companies/search', body)
          break
        }
        case 'enrich': {
          const domain = args.domain
          if (!domain) { result = { error: '--domain required' }; break }
          result = await api('POST', '/organizations/enrich', { domain })
          break
        }
        default:
          result = { error: 'Unknown organizations subcommand. Use: search, enrich' }
      }
      break

    default:
      result = {
        error: 'Unknown command',
        usage: {
          people: {
            search: 'people search [--titles <t1,t2>] [--locations <l1,l2>] [--seniorities <s1,s2>] [--employee-ranges <1,100>] [--keywords <kw>] [--page <n>]',
            enrich: 'people enrich --email <email> | --first-name <name> --last-name <name> --domain <domain> | --linkedin <url>',
            'bulk-enrich': 'people bulk-enrich --emails <e1,e2,e3>',
          },
          organizations: {
            search: 'organizations search [--locations <l1,l2>] [--employee-ranges <1,100>] [--keywords <kw>] [--page <n>]',
            enrich: 'organizations enrich --domain <domain>',
          },
        }
      }
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }))
  process.exit(1)
})

```

### Core Architecture Module: `tools/clis/beehiiv.js`
```
#!/usr/bin/env node

const rawArgs = process.argv.slice(2)
const API_KEY = process.env.BEEHIIV_API_KEY
const BASE_URL = 'https://api.beehiiv.com/v2'

if ((!API_KEY) && rawArgs.length > 0) {
  console.error(JSON.stringify({ error: 'BEEHIIV_API_KEY environment variable required' }))
  process.exit(1)
}

async function api(method, path, body) {
  if (args['dry-run']) {
    return { _dry_run: true, method, url: `${BASE_URL}${path}`, headers: { 'Authorization': '***', 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: body || undefined }
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

function parseArgs(args) {
  const result = { _: [] }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        result[key] = next
        i++
      } else {
        result[key] = true
      }
    } else {
      result._.push(arg)
    }
  }
  return result
}

const args = parseArgs(rawArgs)
const [cmd, sub, ...rest] = args._

function booleanArg(name) {
  const value = args[name]
  if (value === true || value === 'true') return true
  if (value === 'false') return false
  throw new Error(`--${name} must be true or false (or a bare flag for true)`)
}

async function main() {
  let result
  const pubId = args.publication || args.pub
  const limit = args.limit ? Number(args.limit) : 10

  switch (cmd) {
    case 'publications':
      switch (sub) {
        case 'list':
          result = await api('GET', '/publications')
          break
        case 'get': {
          if (!pubId) { result = { error: '--publication required' }; break }
          result = await api('GET', `/publications/${pubId}`)
          break
        }
        default:
          result = { error: 'Unknown publications subcommand. Use: list, get' }
      }
      break

    case 'subscriptions':
      switch (sub) {
        case 'list': {
          if (!pubId) { result = { error: '--publication required' }; break }
          const params = new URLSearchParams()
          params.set('limit', String(limit))
          if (args.email) params.set('email', args.email)
          if (args.status) params.set('status', args.status)
          if (args.tier) params.set('tier', args.tier)
          if (args.cursor) params.set('cursor', args.cursor)
          if (args.expand) params.set('expand[]', args.expand)
          result = await api('GET', `/publications/${pubId}/subscriptions?${params.toString()}`)
          break
        }
        case 'get': {
          if (!pubId) { result = { error: '--publication required' }; break }
          const subId = args.id
          if (!subId) { result = { error: '--id required' }; break }
          result = await api('GET', `/publications/${pubId}/subscriptions/${subId}`)
          break
        }
        case 'create': {
          if (!pubId) { result = { error: '--publication required' }; break }
          const email = args.email
          if (!email) { result = { error: '--email required' }; break }
          const body = { email }
          if (args['reactivate-existing'] !== undefined) body.reactivate_existing = booleanArg('reactivate-existing')
          if (args['send-welcome-email'] !== undefined) body.send_welcome_email = booleanArg('send-welcome-email')
          if (args['utm-source']) body.utm_source = args['utm-source']
          if (args['utm-medium']) body.utm_medium = args['utm-medium']
          if (args['utm-campaign']) body.utm_campaign = args['utm-campaign']
          if (args.tier) body.tier = args.tier
          if (args['referring-site']) body.referring_site = args['referring-site']
          result = await api('POST', `/publications/${pubId}/subscriptions`, body)
          break
        }
        case 'update': {
          if (!pubId) { result = { error: '--publication required' }; break }
          const subId = args.id
          if (!subId) { result = { error: '--id required' }; break }
          const body = {}
          if (args.tier) body.tier = args.tier
          result = await api('PUT', `/publications/${pubId}/subscriptions/${subId}`, body)
          break
        }
        case 'delete': {
          if (!pubId) { result = { error: '--publication required' }; break }
          const subId = args.id
          if (!subId) { result = { error: '--id required' }; break }
          result = await api('DELETE', `/publications/${pubId}/subscriptions/${subId}`)
          break
        }
        default:
          result = { error: 'Unknown subscriptions subcommand. Use: list, get, create, update, delete' }
      }
      break

    case 'posts':
      switch (sub) {
        case 'list': {
          if (!pubId) { result = { error: '--publication required' }; break }
          const params = new URLSearchParams()
          params.set('limit', String(limit))
          if (args.status) params.set('status', args.status)
          if (args.cursor) params.set('cursor', args.cursor)
          result = await api('GET', `/publications/${pubId}/posts?${params.toString()}`)
          break
        }
        case 'get': {
          if (!pubId) { result = { error: '--publication required' }; break }
          const postId = args.id
          if (!postId) { result = { error: '--id required' }; break }
          result = await api('GET', `/publications/${pubId}/posts/${postId}`)
          break
        }
        case 'create': {
          if (!pubId) { result = { error: '--publication required' }; break }
          const title = args.title
          if (!title) { result = { error: '--title required' }; break }
          const body = { title }
          if (args.subtitle) body.subtitle = args.subtitle
          if (args.content) body.content = args.content
          if (args.status) body.status = args.status
          result = await api('POST', `/publications/${pubId}/posts`, body)
          break
        }
        case 'delete': {
          if (!pubId) { result = { error: '--publication required' }; break }
          const postId = args.id
          if (!postId) { result = { error: '--id required' }; break }
          result = await api('DELETE', `/publications/${pubId}/posts/${postId}`)
          break
        }
        default:
          result = { error: 'Unknown posts subcommand. Use: list, get, create, delete' }
      }
      break

    case 'segments':
      switch (sub) {
        case 'list': {
          if (!pubId) { result = { error: '--publication required' }; break }
          result = await api('GET', `/publications/${pubId}/segments`)
          break
        }
        case 'get': {
          if (!pubId) { result = { error: '--publication required' }; break }
          const segId = args.id
          if (!segId) { result = { error: '--id required' }; break }
          result = await api('GET', `/publications/${pubId}/segments/${segId}`)
          break
        }
        default:
          result = { error: 'Unknown segments subcommand. Use: list, get' }
      }
      break

    case 'automations':
      switch (sub) {
        case 'list': {
          if (!pubId) { result = { error: '--publication required' }; break }
          result = await api('GET', `/publications/${pubId}/automations`)
          break
        }
        case 'get': {
          if (!pubId) { result = { error: '--publication required' }; break }
          const autoId = args.id
          if (!autoId) { result = { error: '--id required' }; break }
          result = await api('GET', `/publications/${pubId}/automations/${autoId}`)
          break
        }
        default:
          result = { error: 'Unknown automations subcommand. Use: list, get' }
      }
      break

    case 'referral-program':
      switch (sub) {
        case 'get': {
          if (!pubId) { result = { error: '--publication required' }; break }
          result = await api('GET', `/publications/${pubId}/referral_program`)
          break
        }
        default:
          result = { error: 'Unknown referral-program subcommand. Use: get' }
      }
      break

    default:
      result = {
        error: 'Unknown command',
        usage: {
          publications: 'publications [list | get --publication <id>]',
          subscriptions: 'subscriptions [list | get --id <id> | create --email <email> | update --id <id> | delete --id <id>] --publication <id>',
          posts: 'posts [list | get --id <id> | create --title <title> | delete --id <id>] --publication <id>',
          segments: 'segments [list | get --id <id>] --publication <id>',
          automations: 'automations [list | get --id <id>] --publication <id>',
          'referral-program': 'referral-program [get] --publication <id>',
          options: '--publication <id> --limit <n> --email <email> --status <status> --tier <tier>',
        }
      }
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }))
  process.exit(1)
})

```

### Core Architecture Module: `tools/clis/brevo.js`
```
#!/usr/bin/env node

const rawArgs = process.argv.slice(2)
const API_KEY = process.env.BREVO_API_KEY
const BASE_URL = 'https://api.brevo.com/v3'

if ((!API_KEY) && rawArgs.length > 0) {
  console.error(JSON.stringify({ error: 'BREVO_API_KEY environment variable required' }))
  process.exit(1)
}

async function api(method, path, body) {
  if (args['dry-run']) {
    return { _dry_run: true, method, url: `${BASE_URL}${path}`, headers: { 'api-key': '***', 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: body || undefined }
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'api-key': API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

function parseArgs(args) {
  const result = { _: [] }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        result[key] = next
        i++
      } else {
        result[key] = true
      }
    } else {
      result._.push(arg)
    }
  }
  return result
}

const args = parseArgs(rawArgs)
const [cmd, sub, ...rest] = args._

async function main() {
  let result
  const limit = args.limit ? Number(args.limit) : 50
  const offset = args.offset ? Number(args.offset) : 0

  switch (cmd) {
    case 'account':
      switch (sub) {
        case 'get':
          result = await api('GET', '/account')
          break
        default:
          result = { error: 'Unknown account subcommand. Use: get' }
      }
      break

    case 'contacts':
      switch (sub) {
        case 'list': {
          const params = new URLSearchParams()
          params.set('limit', String(limit))
          params.set('offset', String(offset))
          if (args.sort) params.set('sort', args.sort)
          result = await api('GET', `/contacts?${params.toString()}`)
          break
        }
        case 'get': {
          const id = args.id || args.email
          if (!id) { result = { error: '--id or --email required' }; break }
          result = await api('GET', `/contacts/${encodeURIComponent(id)}`)
          break
        }
        case 'create': {
          const email = args.email
          if (!email) { result = { error: '--email required' }; break }
          const body = { email }
          if (args['first-name'] || args['last-name']) {
            body.attributes = {}
            if (args['first-name']) body.attributes.FIRSTNAME = args['first-name']
            if (args['last-name']) body.attributes.LASTNAME = args['last-name']
          }
          if (args['list-ids']) body.listIds = args['list-ids'].split(',').map(Number)
          result = await api('POST', '/contacts', body)
          break
        }
        case 'update': {
          const id = args.id || args.email
          if (!id) { result = { error: '--id or --email required' }; break }
          const body = {}
          if (args['first-name'] || args['last-name']) {
            body.attributes = {}
            if (args['first-name']) body.attributes.FIRSTNAME = args['first-name']
            if (args['last-name']) body.attributes.LASTNAME = args['last-name']
          }
          if (args['list-ids']) body.listIds = args['list-ids'].split(',').map(Number)
          if (args['unlink-list-ids']) body.unlinkListIds = args['unlink-list-ids'].split(',').map(Number)
          result = await api('PUT', `/contacts/${encodeURIComponent(id)}`, body)
          break
        }
        case 'delete': {
          const id = args.id || args.email
          if (!id) { result = { error: '--id or --email required' }; break }
          result = await api('DELETE', `/contacts/${encodeURIComponent(id)}`)
          break
        }
        case 'import': {
          const emails = args.emails?.split(',')
          if (!emails) { result = { error: '--emails required (comma-separated)' }; break }
          const body = {
            jsonBody: emails.map(e => ({ email: e.trim() })),
          }
          if (args['list-ids']) body.listIds = args['list-ids'].split(',').map(Number)
          result = await api('POST', '/contacts/import', body)
          break
        }
        default:
          result = { error: 'Unknown contacts subcommand. Use: list, get, create, update, delete, import' }
      }
      break

    case 'lists':
      switch (sub) {
        case 'list': {
          const params = new URLSearchParams()
          params.set('limit', String(limit))
          params.set('offset', String(offset))
          if (args.sort) params.set('sort', args.sort)
          result = await api('GET', `/contacts/lists?${params.toString()}`)
          break
        }
        case 'get': {
          const id = args.id
          if (!id) { result = { error: '--id required' }; break }
          result = await api('GET', `/contacts/lists/${id}`)
          break
        }
        case 'create': {
          const name = args.name
          if (!name) { result = { error: '--name required' }; break }
          const body = { name, folderId: args.folder ? Number(args.folder) : 1 }
          result = await api('POST', '/contacts/lists', body)
          break
        }
        case 'update': {
          const id = args.id
          if (!id) { result = { error: '--id required' }; break }
          const body = {}
          if (args.name) body.name = args.name
          if (args.folder) body.folderId = Number(args.folder)
          result = await api('PUT', `/contacts/lists/${id}`, body)
          break
        }
        case 'delete': {
          const id = args.id
          if (!id) { result = { error: '--id required' }; break }
          result = await api('DELETE', `/contacts/lists/${id}`)
          break
        }
        case 'contacts': {
          const id = args.id
          if (!id) { result = { error: '--id required' }; break }
          const params = new URLSearchParams()
          params.set('limit', String(limit))
          params.set('offset', String(offset))
          result = await api('GET', `/contacts/lists/${id}/contacts?${params.toString()}`)
          break
        }
        case 'add-contacts': {
          const id = args.id
          if (!id) { result = { error: '--id required' }; break }
          const emails = args.emails?.split(',')
          if (!emails) { result = { error: '--emails required (comma-separated)' }; break }
          result = await api('POST', `/contacts/lists/${id}/contacts/add`, { emails })
          break
        }
        case 'remove-contacts': {
          const id = args.id
          if (!id) { result = { error: '--id required' }; break }
          const emails = args.emails?.split(',')
          if (!emails) { result = { error: '--emails required (comma-separated)' }; break }
          result = await api('POST', `/contacts/lists/${id}/contacts/remove`, { emails })
          break
        }
        default:
          result = { error: 'Unknown lists subcommand. Use: list, get, create, update, delete, contacts, add-contacts, remove-contacts' }
      }
      break

    case 'email':
      switch (sub) {
        case 'send': {
          const senderEmail = args.from
          const to = args.to
          const subject = args.subject
          if (!senderEmail) { result = { error: '--from required' }; break }
          if (!to) { result = { error: '--to required' }; break }
          if (!subject) { result = { error: '--subject required' }; break }
          const body = {
            sender: { email: senderEmail },
            to: to.split(',').map(e => ({ email: e.trim() })),
            subject,
          }
          if (args['sender-name']) body.sender.name = args['sender-name']
          if (args.html) body.htmlContent = args.html
          if (args.text) body.textContent = args.text
          if (!args.html && !args.text) body.textContent = ''
          if (args['reply-to']) body.replyTo = { email: args['reply-to'] }
          if (args.tags) body.tags = args.tags.split(',')
          result = await api('POST', '/smtp/email', body)
          break
        }
        default:
          result = { error: 'Unknown email subcommand. Use: send' }
      }
      break

    case 'campaigns':
      switch (sub) {
        case 'list': {
          const params = new URLSearchParams()
          params.set('limit', String(limit))
          params.set('offset', String(offset))
          if (args.type) params.set('type', args.type)
          if (args.status) params.set('status', args.status)
          if (args.sort) params.set('sort', args.sort)
          result = await api('GET', `/emailCampaigns?${params.toString()}`)
          break
        }
        case 'get': {
          const id = args.id
          if (!id) { result = { error: '--id required' }; break }
          result = await api('GET', `/emailCampaigns/${id}`)
          break
        }
        case 'create': {
          const name = args.name
          if (!name) { result = { error: '--name required' }; break }
          const body = {
            name,
            sender: { email: args.from || '' },
            subject: args.subject || '',
          }
          if (args['sender-name']) body.sender.name = args['sender-name']
          if (args.html) body.htmlContent = args.html
          if (args['list-ids']) body.recipients = { listIds: args['list-ids'].split(',').map(Number) }
          result = await api('POST', '/emailCampaigns', body)
          break
        }
        case 'update': {
          const id = args.id
          if (!id) { result = { error: '--id required' }; break }
          const body = {}
          if (args.name) body.name = args.name
          if (args.subject) body.subject = args.subject
          if (args.html) body.htmlContent
```

### Core Architecture Module: `tools/clis/buffer.js`
```
#!/usr/bin/env node

const rawArgs = process.argv.slice(2)
const API_KEY = process.env.BUFFER_API_KEY
const BASE_URL = 'https://api.bufferapp.com/1'

if ((!API_KEY) && rawArgs.length > 0) {
  console.error(JSON.stringify({ error: 'BUFFER_API_KEY environment variable required' }))
  process.exit(1)
}

async function api(method, path, body) {
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Accept': 'application/json',
  }
  if (body && method !== 'GET') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
  }
  if (args['dry-run']) {
    return { _dry_run: true, method, url: `${BASE_URL}${path}`, headers: { ...headers, 'Authorization': '***' }, body: body || undefined }
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body ? new URLSearchParams(body).toString() : undefined,
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

async function apiJson(method, path, body) {
  if (args['dry-run']) {
    return { _dry_run: true, method, url: `${BASE_URL}${path}`, headers: { 'Authorization': '***', 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: body || undefined }
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

function parseArgs(args) {
  const result = { _: [] }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        result[key] = next
        i++
      } else {
        result[key] = true
      }
    } else {
      result._.push(arg)
    }
  }
  return result
}

const args = parseArgs(rawArgs)
const [cmd, sub, ...rest] = args._

async function main() {
  let result

  switch (cmd) {
    case 'user':
      switch (sub) {
        case 'info':
          result = await api('GET', '/user.json')
          break
        case 'deauthorize':
          result = await api('POST', '/user/deauthorize.json')
          break
        default:
          result = { error: 'Unknown user subcommand. Use: info, deauthorize' }
      }
      break

    case 'profiles':
      switch (sub) {
        case 'list':
          result = await api('GET', '/profiles.json')
          break
        case 'get': {
          const id = args.id
          if (!id) { result = { error: '--id required' }; break }
          result = await api('GET', `/profiles/${id}.json`)
          break
        }
        case 'schedules': {
          const id = args.id
          if (!id) { result = { error: '--id required (profile ID)' }; break }
          result = await api('GET', `/profiles/${id}/schedules.json`)
          break
        }
        default:
          result = { error: 'Unknown profiles subcommand. Use: list, get, schedules' }
      }
      break

    case 'updates':
      switch (sub) {
        case 'get': {
          const id = args.id
          if (!id) { result = { error: '--id required (update ID)' }; break }
          result = await api('GET', `/updates/${id}.json`)
          break
        }
        case 'pending': {
          const id = args.id
          if (!id) { result = { error: '--id required (profile ID)' }; break }
          const params = new URLSearchParams()
          if (args.page) params.set('page', args.page)
          if (args.count) params.set('count', args.count)
          if (args.since) params.set('since', args.since)
          const qs = params.toString() ? `?${params.toString()}` : ''
          result = await api('GET', `/profiles/${id}/updates/pending.json${qs}`)
          break
        }
        case 'sent': {
          const id = args.id
          if (!id) { result = { error: '--id required (profile ID)' }; break }
          const params = new URLSearchParams()
          if (args.page) params.set('page', args.page)
          if (args.count) params.set('count', args.count)
          if (args.since) params.set('since', args.since)
          const qs = params.toString() ? `?${params.toString()}` : ''
          result = await api('GET', `/profiles/${id}/updates/sent.json${qs}`)
          break
        }
        case 'create': {
          const profileIds = args['profile-ids']
          const text = args.text
          if (!profileIds) { result = { error: '--profile-ids required (comma-separated)' }; break }
          if (!text) { result = { error: '--text required' }; break }
          const body = { text }
          profileIds.split(',').forEach(id => {
            if (!body['profile_ids[]']) body['profile_ids[]'] = []
          })
          const formBody = new URLSearchParams()
          formBody.append('text', text)
          profileIds.split(',').forEach(id => formBody.append('profile_ids[]', id.trim()))
          if (args['scheduled-at']) formBody.append('scheduled_at', args['scheduled-at'])
          if (args.now) formBody.append('now', 'true')
          if (args.top) formBody.append('top', 'true')
          if (args.shorten) formBody.append('shorten', 'true')
          if (args['dry-run']) {
            result = { _dry_run: true, method: 'POST', url: `${BASE_URL}/updates/create.json`, headers: { 'Authorization': '***', 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' }, body: formBody.toString() }
            break
          }
          const res = await fetch(`${BASE_URL}/updates/create.json`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${API_KEY}`,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
            },
            body: formBody.toString(),
          })
          const resText = await res.text()
          try { result = JSON.parse(resText) } catch { result = { status: res.status, body: resText } }
          break
        }
        case 'update': {
          const id = args.id
          const text = args.text
          if (!id) { result = { error: '--id required (update ID)' }; break }
          if (!text) { result = { error: '--text required' }; break }
          const body = { text }
          if (args['scheduled-at']) body.scheduled_at = args['scheduled-at']
          result = await api('POST', `/updates/${id}/update.json`, body)
          break
        }
        case 'share': {
          const id = args.id
          if (!id) { result = { error: '--id required (update ID)' }; break }
          result = await api('POST', `/updates/${id}/share.json`)
          break
        }
        case 'destroy': {
          const id = args.id
          if (!id) { result = { error: '--id required (update ID)' }; break }
          result = await api('POST', `/updates/${id}/destroy.json`)
          break
        }
        case 'reorder': {
          const id = args.id
          const order = args.order
          if (!id) { result = { error: '--id required (profile ID)' }; break }
          if (!order) { result = { error: '--order required (comma-separated update IDs)' }; break }
          const formBody = new URLSearchParams()
          order.split(',').forEach(uid => formBody.append('order[]', uid.trim()))
          if (args['dry-run']) {
            result = { _dry_run: true, method: 'POST', url: `${BASE_URL}/profiles/${id}/updates/reorder.json`, headers: { 'Authorization': '***', 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' }, body: formBody.toString() }
            break
          }
          const res = await fetch(`${BASE_URL}/profiles/${id}/updates/reorder.json`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${API_KEY}`,
              'Content-Type': 'application/x-www-form-urlencoded',
              'Accept': 'application/json',
            },
            body: formBody.toString(),
          })
          const resText = await res.text()
          try { result = JSON.parse(resText) } catch { result = { status: res.status, body: resText } }
          break
        }
        case 'shuffle': {
          const id = args.id
          if (!id) { result = { error: '--id required (profile ID)' }; break }
          result = await api('POST', `/profiles/${id}/updates/shuffle.json`)
          break
        }
        default:
          result = { error: 'Unknown updates subcommand. Use: get, pending, sent, create, update, share, destroy, reorder, shuffle' }
      }
      break

    case 'info':
      result = await api('GET', '/info/configuration.json')
      break

    default:
      result = {
        error: 'Unknown command',
        usage: {
          user: 'user [info | deauthorize]',
          profiles: 'profiles [list | get --id <id> | schedules --id <id>]',
          updates: 'updates [get --id <id> | pending --id <profile-id> | sent --id <profile-id> | create --profile-ids <ids> --text <text> [--scheduled-at <time>] [--now] | update --id <id> --text <text> | share --id <id> | destroy --id <id> | reorder --id <profile-id> --order <id1,id2> | shuffle --id <profile-id>]',
          info: 'info',
        }
      }
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch(err => {
  console.error(JSON.stringify({ error: err.message }))
  process.exit(1)
})

```

### Core Architecture Module: `tools/clis/calendly.js`
```
#!/usr/bin/env node

const rawArgs = process.argv.slice(2)
const API_KEY = process.env.CALENDLY_API_KEY
const BASE_URL = 'https://api.calendly.com'

if ((!API_KEY) && rawArgs.length > 0) {
  console.error(JSON.stringify({ error: 'CALENDLY_API_KEY environment variable required' }))
  process.exit(1)
}

async function api(method, path, body) {
  if (args['dry-run']) {
    return { _dry_run: true, method, url: `${BASE_URL}${path}`, headers: { 'Authorization': '***', 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: body || undefined }
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    return { status: res.status, body: text }
  }
}

function parseArgs(args) {
  const result = { _: [] }
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        result[key] = next
        i++
      } else {
        result[key] = true
      }
    } else {
      result._.push(arg)
    }
  }
  return result
}

const args = parseArgs(rawArgs)
const [cmd, sub, ...rest] = args._

async function main() {
  let result
  const count = args.count ? Number(args.count) : 20

  switch (cmd) {
    case 'users':
      switch (sub) {
        case 'me':
          result = await api('GET', '/users/me')
          break
        default:
          result = { error: 'Unknown users subcommand. Use: me' }
      }
      break

    case 'event-types':
      switch (sub) {
        case 'list': {
          const user = args.user
          const org = args.organization
          if (!user && !org) { result = { error: '--user or --organization URI required' }; break }
          const params = new URLSearchParams()
          if (user) params.set('user', user)
          if (org) params.set('organization', org)
          if (args.active) params.set('active', args.active)
          params.set('count', String(count))
          if (args['page-token']) params.set('page_token', args['page-token'])
          result = await api('GET', `/event_types?${params}`)
          break
        }
        case 'get': {
          const uuid = args.uuid
          if (!uuid) { result = { error: '--uuid required' }; break }
          result = await api('GET', `/event_types/${uuid}`)
          break
        }
        default:
          result = { error: 'Unknown event-types subcommand. Use: list, get' }
      }
      break

    case 'events':
      switch (sub) {
        case 'list': {
          const user = args.user
          const org = args.organization
          if (!user && !org) { result = { error: '--user or --organization URI required' }; break }
          const params = new URLSearchParams()
          if (user) params.set('user', user)
          if (org) params.set('organization', org)
          if (args['min-start']) params.set('min_start_time', args['min-start'])
          if (args['max-start']) params.set('max_start_time', args['max-start'])
          if (args.status) params.set('status', args.status)
          params.set('count', String(count))
          if (args['page-token']) params.set('page_token', args['page-token'])
          if (args.sort) params.set('sort', args.sort)
          result = await api('GET', `/scheduled_events?${params}`)
          break
        }
        case 'get': {
          const uuid = args.uuid
          if (!uuid) { result = { error: '--uuid required' }; break }
          result = await api('GET', `/scheduled_events/${uuid}`)
          break
        }
        case 'cancel': {
          const uuid = args.uuid
          if (!uuid) { result = { error: '--uuid required' }; break }
          const body = {}
          if (args.reason) body.reason = args.reason
          result = await api('POST', `/scheduled_events/${uuid}/cancellation`, body)
          break
        }
        case 'invitees': {
          const uuid = args.uuid
          if (!uuid) { result = { error: '--uuid required (event UUID)' }; break }
          const params = new URLSearchParams()
          params.set('count', String(count))
          if (args['page-token']) params.set('page_token', args['page-token'])
          if (args.email) params.set('email', args.email)
          if (args.status) params.set('status', args.status)
          result = await api('GET', `/scheduled_events/${uuid}/invitees?${params}`)
          break
        }
        default:
          result = { error: 'Unknown events subcommand. Use: list, get, cancel, invitees' }
      }
      break

    case 'availability':
      switch (sub) {
        case 'times': {
          const eventType = args['event-type']
          if (!eventType) { result = { error: '--event-type URI required' }; break }
          const startTime = args['start-time']
          const endTime = args['end-time']
          if (!startTime || !endTime) { result = { error: '--start-time and --end-time required (ISO 8601)' }; break }
          const params = new URLSearchParams({
            event_type: eventType,
            start_time: startTime,
            end_time: endTime,
          })
          result = await api('GET', `/event_type_available_times?${params}`)
          break
        }
        case 'busy': {
          const user = args.user
          if (!user) { result = { error: '--user URI required' }; break }
          const startTime = args['start-time']
          const endTime = args['end-time']
          if (!startTime || !endTime) { result = { error: '--start-time and --end-time required (ISO 8601)' }; break }
          const params = new URLSearchParams({
            user,
            start_time: startTime,
            end_time: endTime,
          })
          result = await api('GET', `/user_busy_times?${params}`)
          break
        }
        default:
          result = { error: 'Unknown availability subcommand. Use: times, busy' }
      }
      break

    case 'webhooks':
      switch (sub) {
        case 'list': {
          const org = args.organization
          const scope = args.scope || 'organization'
          if (!org) { result = { error: '--organization URI required' }; break }
          if (!['organization', 'user', 'group'].includes(scope)) { result = { error: '--scope must be organization, user, or group' }; break }
          if (scope === 'user' && !args.user) { result = { error: '--user URI required for user scope' }; break }
          if (scope === 'group' && !args.group) { result = { error: '--group URI required for group scope' }; break }
          const params = new URLSearchParams({ organization: org, scope })
          if (args.user) params.set('user', args.user)
          if (args.group) params.set('group', args.group)
          params.set('count', String(count))
          if (args['page-token']) params.set('page_token', args['page-token'])
          result = await api('GET', `/webhook_subscriptions?${params}`)
          break
        }
        case 'create': {
          const url = args.url
          const events = args.events?.split(',')
          const org = args.organization
          const scope = args.scope || 'organization'
          if (!url || !events || !org) { result = { error: '--url, --events (comma-separated), and --organization required' }; break }
          if (!['organization', 'user', 'group'].includes(scope)) { result = { error: '--scope must be organization, user, or group' }; break }
          if (scope === 'user' && !args.user) { result = { error: '--user URI required for user scope' }; break }
          if (scope === 'group' && !args.group) { result = { error: '--group URI required for group scope' }; break }
          const body = { url, events, organization: org, scope }
          if (args.user) body.user = args.user
          if (args.group) body.group = args.group
          result = await api('POST', '/webhook_subscriptions', body)
          break
        }
        case 'delete': {
          const uuid = args.uuid
          if (!uuid) { result = { error: '--uuid required' }; break }
          result = await api('DELETE', `/webhook_subscriptions/${uuid}`)
          break
        }
        default:
          result = { error: 'Unknown webhooks subcommand. Use: list, create, delete' }
      }
      break

    case 'org':
      switch (sub) {
        case 'members': {
          const org = args.organization
          if (!org) { result = { error: '--organization URI required' }; break }
          const params = new URLSearchParams({ organization: org })
          params.set('count', String(count))
          if (args['page-token']) params.set('page_token', args['page-token'])
          result = await api('GET', `/organization_memberships?${params}`)
          break
        }
        default:
          result = { error: 'Unknown org subcommand. Use: members' }
      }
      break

    default:
      result = {
        error: 'Unknown command',
        usage: {
          users: 'users me',
          'event-types': 'event-types [list --user <uri> | get --uuid <id>]',
          events: 'events [list --user <uri> | get --uuid <id> | cancel --uuid <id> | invitees --uuid <id>]',
          availability: 'availability [times --event-type <uri> --start-time <iso> --end-time <iso> | busy --user <uri> --start-time <iso> --end-time <iso>]',
          webhooks: 'webhooks [list --organization <uri> | create --url <url> --events <e1,e2> --organization <uri> | delete --uuid <id>]',
          org: 'org [members --organization <uri>]',
          options: '--count <n> --page-token <token> --status <active|canceled> --scope <organization|user|group> --user <uri> --group <uri>',
        }
      }
  }

  console.log(JSON.stringify(result, null, 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #608** (2026-10-01): **Battle cards are orphaned between competitors and sales-enablement**
  *Symptoms*: `competitors` lists 'battle card' as a trigger but has no battle card guidance. `sales-enablement` sends battle cards to `competitors`. `competitor-profiling` and `prospecting` send them to `sales-enablement`. So a battle card request lands in a skill that can't produce one, or bounces between two.  Fix: battle cards are internal sales collateral, so give them a home in `sales-enablement` (structure, refresh cadence, evidence rules from #602). Move the trigger there and point `competitors` at it.

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

### Incident Patch 1: `2588c271` (2026-10-07)
**Commit Message**: feat(marketing-loops): add SEO operator recipe and three new loops

Striking-distance push, AI-answer check, and claim-drift loops, plus a
reference that composes the SEO loops into one scheduled operator with
shared state. Fixes the stale loop count.

Refs #787.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `skills/marketing-loops/SKILL.md` (modified, +8/-4)
```diff
@@ -1,8 +1,8 @@
 ---
 name: marketing-loops
-description: "When the user wants to set up a recurring, self-running marketing workflow — a repeatable loop an AI agent runs on a cadence (weekly, daily, on a trigger) rather than a one-off task. Also use when the user mentions 'marketing loop,' 'recurring marketing workflow,' 'automate my marketing,' 'marketing on autopilot,' 'weekly marketing review,' 'ad fatigue check,' 'content refresh loop,' 'churn watch,' 'ranking drop alert,' 'always-on marketing,' 'marketing automation workflow,' or 'run this every week.' Use this to pick, adapt, and schedule an ongoing marketing loop that orchestrates the other marketing skills. For one-off marketing ideas, see marketing-ideas. For the experimentation loop specifically, see ab-testing."
+description: "When the user wants to set up a recurring, self-running marketing workflow — a repeatable loop an AI agent runs on a cadence (weekly, daily, on a trigger) rather than a one-off task. Also use when the user mentions 'marketing loop,' 'recurring marketing workflow,' 'automate my marketing,' 'marketing on autopilot,' 'weekly marketing review,' 'ad fatigue check,' 'content refresh loop,' 'churn watch,' 'ranking drop alert,' 'run my SEO,' 'SEO operator,' 'daily SEO agent,' 'always-on marketing,' 'marketing automation workflow,' or 'run this every week.' Use this to pick, adapt, and schedule an ongoing marketing loop that orchestrates the other marketing skills. For one-off marketing ideas, see marketing-ideas. For the experimentation loop specifically, see ab-testing."
 metadata:
-  version: 1.2.1
+  version: 1.3.0
 ---
 
 # Marketing Loops
@@ -22,7 +22,7 @@ Then:
 4. **Confirm the human checkpoint.** Decide what the loop does autonomously vs. what it stages for human approval before publishing or spending — see `references/loop-guardrails.md`.
 5. **Schedule it** (see "Scheduling a loop" below).
 
-Building more than one loop, or a whole marketing operating system? See `references/loop-orchestration.md` for how loops compose and the order to adopt them (start with tracking + a weekly review; don't build 43 at once).
+Building more than one loop, or a whole marketing operating system? See `references/loop-orchestration.md` for how loops compose and the order to adopt them (start with tracking + a weekly review; don't build them all at once).
 
 ## Anatomy of a Marketing Loop
 
@@ -81,7 +81,11 @@ Default to time-of-day cron for review-style loops (weekly review, ranking watch
 
 ## The Catalog
 
-`references/loop-catalog.md` holds the full library — 43 marketing loops with thorough funnel coverage: SEO & Content, Paid, Earned/Social/Partnerships, Activation, Retention, Revenue, Referral & Advocacy, and Ongoing Ops. Each is a complete, adaptable spec. Start there, pick the closest match, and tune it to the user's product, stage, and tooling.
+`references/loop-catalog.md` holds the full library — 48 marketing loops with thorough funnel coverage: SEO & Content, Paid, Earned/Social/Partnerships, Activation, Retention, Revenue, Referral & Advocacy, and Ongoing Ops. Each is a complete, adaptable spec. Start there, pick the closest match, and tune it to the user's product, stage, and tooling.
+
+## Running a whole channel: the SEO operator
+
+When the user wants an agent to own SEO for a site rather than run one loop, use `references/seo-operator.md`. It bundles the SEO loops (site health, claim drift, striking-distance push, AI-answer check, keyword gap, content decay, competitor watch, and more) into one schedule with shared memory in `.agents/seo/`, a first-run checklist, operating rules, a writing gate, and a one-screen weekly report.
 
 ## Authoring a new loop
 
```

**File**: `skills/marketing-loops/references/loop-catalog.md` (modified, +44/-0)
```diff
@@ -45,6 +45,35 @@ Loops are grouped by function. Naming follows the "The X loop" convention.
 - **Stop / bail-out**: No material drop → log "stable." Escalate suspected algo hits to a human rather than mass-editing.
 - **Output**: A regression report with a recommended fix.
 
+### The striking-distance push loop
+- **Check cadence**: Weekly
+- **Acts when**: An existing page ranks in positions 8–20 for a query with meaningful impressions, or ranks in the top 5 with a click-through rate well below its neighbors.
+- **Purpose**: Move pages that Google already half-trusts onto page one, the cheapest ranking gains available.
+- **Skills used**: `seo-audit`, `copywriting`, `site-architecture`
+- **Loop body**:
+  1. Pull query + page pairs from Search Console for the trailing 28 days; keep positions 8–20 above an impression floor, plus top-5 positions with weak click-through.
+  2. For each candidate, read the top three results and name the specific reason each one outranks the page (intent match, a missing section, fresher facts, stronger internal links).
+  3. Draft the smallest change that closes that gap: answer the query in the opening lines, add the missing section, add internal links from strong related pages. For the weak-CTR cases, change only the title and meta description.
+  4. Stage the edits and record the starting position and CTR.
+- **Self-check**: Is the page the right one for the query, or is another page on the site competing for it (cannibalization)? Fix the conflict first. Is the impression count big enough for the position to mean anything?
+- **State / idempotency**: Track each page's last edit date and starting metrics; give an edited page 3–4 weeks before touching it again, so results are attributable.
+- **Stop / bail-out**: No candidates above the impression floor → log "no action." Two pushes on the same page with no movement → stop and escalate; the problem is probably authority or intent, not on-page.
+- **Output**: Staged page edits, each with the query, the reason, the change, and its baseline. Method in `seo-audit`'s [rankings push reference](https://github.com/coreyhaines31/marketingskills/blob/main/skills/seo-audit/references/rankings-push.md).
+
+### The AI-answer check loop
+- **Check cadence**: Weekly (AI answers vary run to run; daily checks mostly measure noise)
+- **Acts when**: A tracked prompt's answer omits the brand, misstates a fact about it, or cites a new source in the category.
+- **Purpose**: Keep the brand present and described accurately in AI assistants' answers to the questions buyers actually ask.
+- **Skills used**: `ai-seo`, `product-marketing`, `public-relations`, `directory-submissions`
+- **Loop body**:
+  1. Run the prompt panel (20–30 prompts spread across awareness stages) on each assistant you track, several runs per prompt.
+  2. Record per prompt: mentioned or not, how the brand is described, which sources were cited.
+  3. Turn findings into work: a wrong or vague fact means the page that should state it doesn't state it plainly, so fix that page. Absence means the cited sources are the target list for PR, directories, and review sites.
+- **Self-check**: Is the change consistent across runs, or one sample? Treat a single-run difference as noise.
+- **State / idempotency**: Keep each run's results per prompt so changes are diffs, not re-reports; don't re-file a fix that's already open.
+- **Stop / bail-out**: No material change since last run → log "stable." Never contact a cited source automatically; outreach is staged for approval.
+- **Output**: A short visibility diff, page fixes for misstated facts, and a source target list.
+
 ### The content-decay loop
 - **Check cadence**: Monthly
 - **Acts when**: A page's traffic/rankings declined materially over the trailing 90 days.
@@ -668,6 +697,21 @@ Loops are grouped by function. Naming follows the "The X loop" convention.
 - **Stop / bail-out**: All tracking healthy → log "clean." **Escalate a broken revenue/conversion event immediately** — every downstream loop is blind until it's fixed.
 - **Output**: A tracking-QA report with prioritized fixes.
 
+### The claim-drift loop
+- **Check cadence**: On every deploy or merge to the product, or daily
+- **Acts when**: A product change (price, plan limit, feature, integration, supported platform) makes a statement on a marketing surface false.
+- **Purpose**: Stop the site, docs, comparison pages, and ads from describing a product that no longer exists.
+- **Skills used**: `product-marketing`, `copy-editing`, `competitors`, `pricing`
+- **Loop body**:
+  1. Read the product changes since the last run: merged PRs, commits, release notes, pricing config.
+  2. Pick out the ones that change a customer-facing fact.
+  3. Search every marketing surface for the old fact (pages, docs, comparison tables, FAQ, structured data, ad copy, email templates) and stage corrections.
+  4. For new capabilities, add a backlog item: which queries or comparisons can the 
```

**File**: `skills/marketing-loops/references/loop-orchestration.md` (modified, +4/-2)
```diff
@@ -1,6 +1,6 @@
 # Loop Orchestration & Rollout
 
-Loops aren't independent scripts — they compose into a marketing operating system. This reference covers how they fit together and the order to adopt them so you never build 43 at once.
+Loops aren't independent scripts — they compose into a marketing operating system. This reference covers how they fit together and the order to adopt them so you never build them all at once.
 
 ## The system view
 
@@ -59,11 +59,13 @@ Once volume is healthy, tune revenue per user — judged on revenue quality, not
 `referral-nudge`, `review-and-UGC-harvest`, `review-site-management`, `case-study-sourcing`, `partner-pipeline`, `brand-mention/reputation`, `experiment-backlog`, `campaign-postmortem`.
 The flywheel: happy customers and earned media that feed back into acquisition, plus the learning loops that make everything compound.
 
-The remaining catalog loops (content-decay, internal-linking, programmatic-SEO quality, content-calendar refill, paid-search query-mining, retargeting-hygiene, landing-page regression, community-engagement, competitor-watch, backlink-prospecting, directory-submission, feature-adoption, lead-capture-asset, email-deliverability, voice-of-customer) slot into the stage that matches their function as each channel becomes a priority.
+The remaining catalog loops (content-decay, striking-distance push, AI-answer check, claim-drift, internal-linking, programmatic-SEO quality, content-calendar refill, paid-search query-mining, retargeting-hygiene, landing-page regression, community-engagement, competitor-watch, backlink-prospecting, directory-submission, feature-adoption, lead-capture-asset, email-deliverability, voice-of-customer) slot into the stage that matches their function as each channel becomes a priority.
 
 ## Rollout rules
 
 - **One at a time.** Prove a loop earns its keep (someone acts on its output, it moves its metric) before adding the next.
 - **Foundation before growth.** Acquisition loops before solid tracking + retention = pouring water into a leaky bucket.
 - **Cap the total.** If you're running more loops than you can review the output of, you have vanity loops. Retire the ones nobody acts on.
 - **Re-audit quarterly.** Recalibrate thresholds, kill dead loops, promote the ones that consistently drive action.
+
+For a worked example of several loops composed into one channel operator, see `seo-operator.md`.
```

**File**: `skills/marketing-loops/references/seo-operator.md` (added, +110/-0)
```diff
@@ -0,0 +1,110 @@
+# The SEO Operator
+
+A recipe for handing an agent the whole SEO job for one site, run from the site's own repo on a schedule. It doesn't add new mechanics. It bundles the SEO loops from the catalog, gives them one shared memory, and sets the rules that keep an always-on agent useful instead of busy.
+
+Use it when the user wants SEO run for them rather than advice about SEO, and the agent can work in the repo that builds the marketing site. If the site lives in a hosted builder with no repo access, run the same loops in draft mode and hand the changes to a human.
+
+## Before the first run
+
+Settle five things with the owner and write them at the top of the operator brief (below):
+
+| Setting | What to capture |
+|---------|-----------------|
+| **Site** | The production URL |
+| **Conversion** | The one action that counts (trial, demo request, purchase). Traffic that never reaches it isn't the goal |
+| **Competitors** | 3–8 names, or permission to find them from the SERPs and AI answers |
+| **Ship mode** | "Open a PR for review" (default) or "merge when checks pass." Auto-merge needs the owner's explicit say-so; see `loop-guardrails.md` |
+| **Data access** | Which of Search Console, analytics, a rank or backlink tool, and an AI-visibility tool the agent can read |
+
+Then confirm the foundation: tracking works (the tracking-QA loop), and `.agents/product-marketing.md` exists. If it doesn't, build it with the `product-marketing` skill first. The operator reads product facts from there; it doesn't keep a second copy.
+
+## Shared memory
+
+Agents start every run with no memory, so everything the operator knows lives in files. Use the loop-state convention (`.agents/loops/`) for run logs, plus one folder for SEO working files:
+
+```
+.agents/seo/
+  brief.md          # the five settings above + any owner preferences
+  claims.md         # claims ledger: each customer-facing fact, its source of truth, the pages that state it
+  queries.csv       # query map: query, intent, page, status (live / planned / gap), position, last checked
+  queue.md          # work queue, ranked by expected conversions per hour of effort
+  prompts.md        # AI prompt panel by awareness stage, with each run's results
+  snapshots/        # competitor sitemaps and key pages, for diffing
+  reports/          # one file per weekly report
+.agents/loops/seo-operator.log   # one line per run, acted or not
+```
+
+Two rules make the query map work. **Every page owns one primary query**, and **every query has at most one page.** Two pages chasing the same query is a defect: merge them and redirect the weaker one. A query with no page is a gap and goes in the queue.
+
+Every fact in `claims.md` cites where it came from (a file in the product repo, the live pricing page). Facts from memory don't go in.
+
+## Run schedule
+
+| Every run (daily, or on each deploy) | Weekly | Monthly |
+|---|---|---|
+| Site health crawl | Striking-distance push | Rebuild the query map (keyword-gap) |
+| Claim drift | Ranking-drop watch | Content decay |
+| Ship the top item in the queue | Indexing check | Comparison-page review (`competitors` asset audit) |
+| Append to the run log | Internal linking | Backlink prospecting + directory submissions |
+| | AI-answer check | One free-tool candidate (`free-tools`) |
+| | Competitor watch (sitemap diff) | |
+| | Weekly report | |
+
+Each cell is a catalog loop or a step defined below; run it with that loop's self-check, state, and stop rules. Skip any loop whose data isn't connected and say so in the report.
+
+**Site health crawl.** Fetch the sitemap and request every URL. Flag non-200s, redirect chains, wrong canonicals, stray `noindex`, robots blocks, broken internal links, orphan pages, duplicate or missing titles and descriptions, and pages whose main content isn't in the server-rendered HTML. The `seo-audit` skill covers each check.
+
+**Indexing check.** Compare the sitemap to what Search Console reports as indexed. For each unindexed URL, find the cause (thin, duplicate, orphaned, blocked, canonicalized elsewhere) and fix that, not the symptom. If indexing can't be verified, report "not verified." Never report a page as indexed without checking.
+
+**Competitor watch.** Diff each competitor's sitemap against last week's snapshot to see what they published, then check which of those pages rank. Queue a response only where you can build a better page, not for every page they ship.
+
+## The first run
+
+1. **Learn the repo.** How routes and posts are created, and where titles, meta descriptions, canonicals, the sitemap, robots.txt, and structured data come from. Add pages the way the repo already does.
+2. **Learn the product** from the code and the live site until you can explain it better than the homepage does. Fill `claims.md`.
+3. **Build the query map** from buyers, not search volume: the problems they search, category terms, competitor names, "alternative" and "vs" queries, 
```

---

### Incident Patch 2: `dda3841f` (2026-10-03)
**Commit Message**: Merge pull request #667 from coreyhaines31/fix/600-592-hyperframes-review-template

fix: working Hyperframes example and creative-review template fixes (2.11.17)

**File**: `.claude-plugin/marketplace.json` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
   },
   "metadata": {
     "description": "Marketing skills for AI agents — conversion optimization, copywriting, SEO, paid ads, and growth",
-    "version": "2.11.16",
+    "version": "2.11.17",
     "repository": "https://github.com/coreyhaines31/marketingskills"
   },
   "plugins": [
```

**File**: `.claude-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "marketing-skills",
   "description": "Marketing skills for AI agents — conversion optimization, copywriting, SEO, paid ads, ad creative, and growth",
-  "version": "2.11.16",
+  "version": "2.11.17",
   "author": {
     "name": "Corey Haines"
   },
```

**File**: `.codex-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "marketing-skills",
   "description": "Marketing skills for AI agents — conversion optimization, copywriting, SEO, paid ads, ad creative, and growth",
-  "version": "2.11.16",
+  "version": "2.11.17",
   "author": {
     "name": "Corey Haines"
   },
```

**File**: `VERSIONS.md` (modified, +7/-2)
```diff
@@ -5,7 +5,7 @@ Current versions of all skills. Agents can compare against local versions to che
 | Skill | Version | Last Updated |
 |-------|---------|--------------|
 | ab-testing | 2.0.0 | 2026-05-05 |
-| ad-creative | 2.9.2 | 2026-10-02 |
+| ad-creative | 2.9.3 | 2026-10-02 |
 | ai-seo | 2.7.2 | 2026-10-02 |
 | analytics | 2.0.2 | 2026-10-02 |
 | aso | 2.0.1 | 2026-08-19 |
@@ -53,10 +53,15 @@ Current versions of all skills. Agents can compare against local versions to che
 | site-architecture | 2.0.0 | 2026-05-05 |
 | sms | 1.1.0 | 2026-10-02 |
 | social | 2.3.2 | 2026-10-02 |
-| video | 2.2.0 | 2026-10-02 |
+| video | 2.2.1 | 2026-10-02 |
 
 ## Recent Changes
 
+### 2.11.17 (2026-10-02)
+
+- **video** (2.2.0 → 2.2.1) and the **Hyperframes integration guide** (reported in #600 by @pjthegiant): the old example called a `render({ frames })` API that the `hyperframes` package doesn't export. Both now lead with the CLI (`npx hyperframes init`, `preview`, `render -o output.mp4`) and explain the composition format: a root with `data-composition-id`, `class="clip"` elements with timing attributes, and a paused GSAP timeline. Rendering from code goes through `@hyperframes/producer` (`createRenderJob` + `executeRenderJob`). Checked against v0.8.114.
+- **ad-creative** (2.9.2 → 2.9.3): three creative-review template fixes (reported in #592 by @antongulin). Malformed data now shows a clear error instead of a blank page. The concept switcher uses `aria-pressed` buttons instead of incomplete tab semantics. The Instagram like count comes from an optional `likes` field, where it used to be a hardcoded 6,240.
+
 ### 2.11.16 (2026-10-02)
 
 - **OpenAI Codex plugin** (#445 by @darkweb19, closes #295): `.codex-plugin/plugin.json` plus a marketplace at `.agents/plugins/marketplace.json`. Install with `codex plugin marketplace add coreyhaines31/marketingskills`, then `/plugins`, and update with `codex plugin marketplace upgrade`. It uses the Codex compatibility layout OpenAI's plugin creator scaffolds. `scripts/check-versions.mjs` now requires the Codex manifest's version to match the repo version so the two can't drift.
```

**File**: `skills/ad-creative/SKILL.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 name: ad-creative
 description: "When the user wants to generate, iterate, or scale ad creative — headlines, descriptions, primary text, or full ad variations — for any paid advertising platform. Also use when the user mentions 'ad copy variations,' 'ad creative,' 'generate headlines,' 'RSA headlines,' 'bulk ad copy,' 'ad iterations,' 'creative testing,' 'write me some ads,' 'Facebook ad copy,' 'Google ad headlines,' 'LinkedIn ad text,' 'static ads,' 'ad templates,' 'iMessage ad,' 'chat reveal ad,' 'ChatGPT ad,' 'Apple Notes ad,' 'AirDrop ad,' 'creative strategy,' 'creative roadmap,' 'creative retro,' 'hook writing,' 'creative review page,' 'present ad creative for approval,' 'motion video ad,' 'faceless video ad,' 'UGC ad,' 'greenscreen ad,' 'TikTok/Reels ad format,' 'which ad format to make,' 'Meta ad format tier list,' or 'creative format taxonomy.' Use it to produce or iterate ad copy at scale. Copy avoids AI tells like 'it's not X, it's Y' reveals. For campaign strategy and targeting, see ads. For landing page copy, see copywriting."
 metadata:
-  version: 2.9.2
+  version: 2.9.3
 ---
 
 # Ad Creative
```

**File**: `skills/ad-creative/assets/creative-review-template.html` (modified, +17/-4)
```diff
@@ -47,7 +47,7 @@
   .concept { text-align: left; background: var(--card); border: 1.5px solid var(--line); border-radius: var(--radius);
     padding: 14px 16px; cursor: pointer; transition: border-color .12s, box-shadow .12s; font: inherit; color: inherit; }
   .concept:hover { border-color: #cfcdc6; }
-  .concept[aria-selected="true"] { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); background: #fff; }
+  .concept[aria-pressed="true"] { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); background: #fff; }
   .concept .row1 { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
   .concept .num { font-size: 11px; font-weight: 700; color: var(--muted); }
   .concept .frames { font-size: 11px; color: var(--muted); }
@@ -175,6 +175,7 @@
         "We tested our protein for heavy metals. Here's what an independent lab found.",
         "Most protein powders are never tested for heavy metals. Ours is."
       ],
+      "likes": "6,240",
       "primaryText": "We tested our Plant-Based Protein for the heavy metals that hide in “clean” powders — lead, arsenic and cadmium. Here's exactly what an independent lab measured.",
       "destination": { "url": "shop.truvani.com", "cta": "Shop now", "offer": "72% OFF Protein Starter Kit" },
       "rollout": {
@@ -214,7 +215,7 @@
 <div class="wrap">
   <header class="project" id="project"></header>
   <div class="eyebrow">Creative concept · toggle between ideas</div>
-  <div class="concepts" id="concepts" role="tablist"></div>
+  <div class="concepts" id="concepts"></div>
   <div class="grid">
     <section>
       <div class="eyebrow col-label" id="preview-label">In-feed preview</div>
@@ -249,6 +250,18 @@
   throw e;
 }
 
+function invalid(msg) {
+  document.querySelector(".wrap").innerHTML =
+    '<div class="err"><b>The review data is missing something.</b><br/>' + esc(msg) + '</div>';
+  throw new Error(msg);
+}
+if (!DATA || !Array.isArray(DATA.concepts) || !DATA.concepts.length)
+  invalid('"concepts" must be a non-empty array.');
+DATA.concepts.forEach((c, i) => {
+  if (!c || typeof c !== "object") invalid(`concepts[${i}] must be an object.`);
+  if (!Array.isArray(c.frames) || !c.frames.length) invalid(`concepts[${i}].frames must be a non-empty array.`);
+});
+
 const state = { concept: 0, frame: 0, platform: null, handle: 0, headline: 0 };
 const concept = () => DATA.concepts[state.concept];
 
@@ -273,7 +286,7 @@ <h1>${esc(line || "Ad creative")}</h1>${p.note ? `<div class="sub">${esc(p.note)
 
 function renderConcepts() {
   document.getElementById("concepts").innerHTML = DATA.concepts.map((c, i) => `
-    <button class="concept" role="tab" aria-selected="${i === state.concept}" data-i="${i}">
+    <button class="concept" aria-pressed="${i === state.concept}" data-i="${i}">
       <div class="row1"><span class="num">${String(i + 1).padStart(2, "0")}</span>
         <span class="frames">${c.frames.length} frame${c.frames.length === 1 ? "" : "s"}</span></div>
       <div class="name">${esc(c.name)}</div>
@@ -350,7 +363,7 @@ <h1>${esc(line || "Ad creative")}</h1>${p.note ? `<div class="sub">${esc(p.note)
   } else {
     chrome = `<div class="ig-cta"><span>${esc(dest.cta || "Learn more")}</span><span class="chev">›</span></div>
       <div class="ig-actions">${heart}${comment}${share}<span class="save">${bookmark}</span></div>
-      <div class="likes">6,240 likes</div>
+      ${c.likes ? `<div class="likes">${esc(c.likes)} likes</div>` : ""}
       <div class="caption"><span class="h">${esc(h.name)}</span> ${esc((c.primaryText || "").slice(0, 90))}<span class="more"> … more</span></div>`;
   }
 
```

**File**: `skills/ad-creative/references/creative-review-page.md` (modified, +1/-0)
```diff
@@ -51,6 +51,7 @@ The template renders entirely from a JSON block near the top of the file — `<s
         "Most protein powders are never tested for heavy metals. Ours is."
       ],
       primaryText: "The caption / body copy.",
+      likes: "6,240",                       // optional — Instagram like count; omit and no count is shown
       destination: { url: "shop.truvani.com", cta: "Shop now", offer: "72% OFF Protein Starter Kit" },
       rollout: {                            // optional — the mechanics of how this runs (whitelist, launch plan)
         title: "How the whitelist runs",
```

**File**: `skills/video/SKILL.md` (modified, +7/-20)
```diff
@@ -2,7 +2,7 @@
 name: video
 description: "When the user wants to create, generate, or produce video content using AI tools or programmatic frameworks. Also use when the user mentions 'video production,' 'AI video,' 'Remotion,' 'Hyperframes,' 'HeyGen,' 'Synthesia,' 'Veo,' 'Sora,' 'Runway,' 'Kling,' 'Seedance,' 'Hailuo,' 'MiniMax,' 'Pika,' 'Hunyuan,' 'Wan,' 'video generation,' 'AI avatar,' 'talking head video,' 'programmatic video,' 'video template,' 'explainer video,' 'product demo video,' 'record a product demo,' 'feature demo video,' 'in-app demo,' 'video pipeline,' 'copy this edit,' 'match this video style,' 'reverse-engineer this video,' 'edit like this reference,' or 'make me a video.' Use this for video creation, generation, and production workflows. For video content strategy and what to post, see social. For paid video ad creative, see ad-creative."
 metadata:
-  version: 2.2.0
+  version: 2.2.1
 ---
 
 # Video
@@ -56,29 +56,16 @@ Build videos with code. Best for repeatable, templated, or data-driven video at
 Open-source, Apache 2.0, from HeyGen. Uses plain HTML/CSS/JS — no framework DSL to learn. LLM-native: AI models generate better HTML than React components.
 
 ```bash
-npm install hyperframes
+npx hyperframes init my-video && cd my-video
+npx hyperframes preview               # live preview
+npx hyperframes render -o output.mp4  # render index.html
 ```
 
-**Key concept:** Each frame is an HTML document. Compose frames into a timeline, render to MP4.
-
-```typescript
-import { render } from "hyperframes";
-
-await render({
-  frames: [
-    { html: "<h1>Welcome to Acme</h1>", duration: 3 },
-    { html: "<h2>Here's what we built</h2>", duration: 3 },
-    { html: "<p>Try it free →</p>", duration: 2 },
-  ],
-  output: "intro.mp4",
-  width: 1080,
-  height: 1920, // 9:16 for vertical
-});
-```
+**Key concept:** A composition is one HTML file. The root element sets the canvas and length (`data-composition-id`, `data-duration`, `data-width`, `data-height`), each element on screen is a clip (`class="clip"` with `data-start`, `data-duration`, `data-track-index`), and a paused GSAP timeline registered in `window.__timelines` drives the animation. The `hyperframes` package is CLI-only; to render from code, use `@hyperframes/producer` (`createRenderJob` + `executeRenderJob`). Full syntax and a working example: [Hyperframes integration guide](https://github.com/coreyhaines31/marketingskills/blob/main/tools/integrations/hyperframes.md).
 
 **Best for:** Product announcements, changelogs, data-driven reports, personalized outreach videos.
 
-**Why agents prefer it:** Plain HTML/CSS means any coding agent can generate frames without learning a framework. Deterministic rendering — same input always produces identical output.
+**Why agents prefer it:** Plain HTML/CSS means any coding agent can write a composition without learning a framework. Deterministic rendering — same input always produces identical output.
 
 ### Remotion (React)
 
@@ -115,7 +102,7 @@ export const ProductDemo: React.FC<{ title: string; features: string[] }> = ({
 | Factor | Hyperframes | Remotion |
 |--------|-------------|----------|
 | Agent compatibility | Better (plain HTML) | Good (React) |
-| Animation complexity | Basic (CSS transitions) | Advanced (Spring, interpolate) |
+| Animation complexity | GSAP timelines (plus CSS) | Advanced (Spring, interpolate) |
 | Batch rendering | Local | Lambda (AWS) for scale |
 | Learning curve | Minimal | Moderate (React + Remotion API) |
 | License | Apache 2.0 | Company license for commercial use |
```

---

### Incident Patch 3: `5e4f7f98` (2026-10-03)
**Commit Message**: chore: release 2.11.17 (Hyperframes example, creative-review template fixes)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.claude-plugin/marketplace.json` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
   },
   "metadata": {
     "description": "Marketing skills for AI agents — conversion optimization, copywriting, SEO, paid ads, and growth",
-    "version": "2.11.16",
+    "version": "2.11.17",
     "repository": "https://github.com/coreyhaines31/marketingskills"
   },
   "plugins": [
```

**File**: `.claude-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "marketing-skills",
   "description": "Marketing skills for AI agents — conversion optimization, copywriting, SEO, paid ads, ad creative, and growth",
-  "version": "2.11.16",
+  "version": "2.11.17",
   "author": {
     "name": "Corey Haines"
   },
```

**File**: `.codex-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "marketing-skills",
   "description": "Marketing skills for AI agents — conversion optimization, copywriting, SEO, paid ads, ad creative, and growth",
-  "version": "2.11.16",
+  "version": "2.11.17",
   "author": {
     "name": "Corey Haines"
   },
```

**File**: `VERSIONS.md` (modified, +7/-2)
```diff
@@ -5,7 +5,7 @@ Current versions of all skills. Agents can compare against local versions to che
 | Skill | Version | Last Updated |
 |-------|---------|--------------|
 | ab-testing | 2.0.0 | 2026-05-05 |
-| ad-creative | 2.9.2 | 2026-10-02 |
+| ad-creative | 2.9.3 | 2026-10-02 |
 | ai-seo | 2.7.2 | 2026-10-02 |
 | analytics | 2.0.2 | 2026-10-02 |
 | aso | 2.0.1 | 2026-08-19 |
@@ -53,10 +53,15 @@ Current versions of all skills. Agents can compare against local versions to che
 | site-architecture | 2.0.0 | 2026-05-05 |
 | sms | 1.1.0 | 2026-10-02 |
 | social | 2.3.2 | 2026-10-02 |
-| video | 2.2.0 | 2026-10-02 |
+| video | 2.2.1 | 2026-10-02 |
 
 ## Recent Changes
 
+### 2.11.17 (2026-10-02)
+
+- **video** (2.2.0 → 2.2.1) and the **Hyperframes integration guide** (reported in #600 by @pjthegiant): the old example called a `render({ frames })` API that the `hyperframes` package doesn't export. Both now lead with the CLI (`npx hyperframes init`, `preview`, `render -o output.mp4`) and explain the composition format: a root with `data-composition-id`, `class="clip"` elements with timing attributes, and a paused GSAP timeline. Rendering from code goes through `@hyperframes/producer` (`createRenderJob` + `executeRenderJob`). Checked against v0.8.114.
+- **ad-creative** (2.9.2 → 2.9.3): three creative-review template fixes (reported in #592 by @antongulin). Malformed data now shows a clear error instead of a blank page. The concept switcher uses `aria-pressed` buttons instead of incomplete tab semantics. The Instagram like count comes from an optional `likes` field, where it used to be a hardcoded 6,240.
+
 ### 2.11.16 (2026-10-02)
 
 - **OpenAI Codex plugin** (#445 by @darkweb19, closes #295): `.codex-plugin/plugin.json` plus a marketplace at `.agents/plugins/marketplace.json`. Install with `codex plugin marketplace add coreyhaines31/marketingskills`, then `/plugins`, and update with `codex plugin marketplace upgrade`. It uses the Codex compatibility layout OpenAI's plugin creator scaffolds. `scripts/check-versions.mjs` now requires the Codex manifest's version to match the repo version so the two can't drift.
```

---

### Incident Patch 4: `ab24d206` (2026-10-03)
**Commit Message**: fix(ad-creative): validate review data shape, use aria-pressed concept buttons, make likes data-driven

Malformed data no longer blanks the page, the concept switcher no longer
claims tab semantics it doesn't implement, and the like count comes from
the concept instead of a hardcoded number. Closes #592.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `skills/ad-creative/SKILL.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 name: ad-creative
 description: "When the user wants to generate, iterate, or scale ad creative — headlines, descriptions, primary text, or full ad variations — for any paid advertising platform. Also use when the user mentions 'ad copy variations,' 'ad creative,' 'generate headlines,' 'RSA headlines,' 'bulk ad copy,' 'ad iterations,' 'creative testing,' 'write me some ads,' 'Facebook ad copy,' 'Google ad headlines,' 'LinkedIn ad text,' 'static ads,' 'ad templates,' 'iMessage ad,' 'chat reveal ad,' 'ChatGPT ad,' 'Apple Notes ad,' 'AirDrop ad,' 'creative strategy,' 'creative roadmap,' 'creative retro,' 'hook writing,' 'creative review page,' 'present ad creative for approval,' 'motion video ad,' 'faceless video ad,' 'UGC ad,' 'greenscreen ad,' 'TikTok/Reels ad format,' 'which ad format to make,' 'Meta ad format tier list,' or 'creative format taxonomy.' Use it to produce or iterate ad copy at scale. Copy avoids AI tells like 'it's not X, it's Y' reveals. For campaign strategy and targeting, see ads. For landing page copy, see copywriting."
 metadata:
-  version: 2.9.2
+  version: 2.9.3
 ---
 
 # Ad Creative
```

**File**: `skills/ad-creative/assets/creative-review-template.html` (modified, +17/-4)
```diff
@@ -47,7 +47,7 @@
   .concept { text-align: left; background: var(--card); border: 1.5px solid var(--line); border-radius: var(--radius);
     padding: 14px 16px; cursor: pointer; transition: border-color .12s, box-shadow .12s; font: inherit; color: inherit; }
   .concept:hover { border-color: #cfcdc6; }
-  .concept[aria-selected="true"] { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); background: #fff; }
+  .concept[aria-pressed="true"] { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); background: #fff; }
   .concept .row1 { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
   .concept .num { font-size: 11px; font-weight: 700; color: var(--muted); }
   .concept .frames { font-size: 11px; color: var(--muted); }
@@ -175,6 +175,7 @@
         "We tested our protein for heavy metals. Here's what an independent lab found.",
         "Most protein powders are never tested for heavy metals. Ours is."
       ],
+      "likes": "6,240",
       "primaryText": "We tested our Plant-Based Protein for the heavy metals that hide in “clean” powders — lead, arsenic and cadmium. Here's exactly what an independent lab measured.",
       "destination": { "url": "shop.truvani.com", "cta": "Shop now", "offer": "72% OFF Protein Starter Kit" },
       "rollout": {
@@ -214,7 +215,7 @@
 <div class="wrap">
   <header class="project" id="project"></header>
   <div class="eyebrow">Creative concept · toggle between ideas</div>
-  <div class="concepts" id="concepts" role="tablist"></div>
+  <div class="concepts" id="concepts"></div>
   <div class="grid">
     <section>
       <div class="eyebrow col-label" id="preview-label">In-feed preview</div>
@@ -249,6 +250,18 @@
   throw e;
 }
 
+function invalid(msg) {
+  document.querySelector(".wrap").innerHTML =
+    '<div class="err"><b>The review data is missing something.</b><br/>' + esc(msg) + '</div>';
+  throw new Error(msg);
+}
+if (!DATA || !Array.isArray(DATA.concepts) || !DATA.concepts.length)
+  invalid('"concepts" must be a non-empty array.');
+DATA.concepts.forEach((c, i) => {
+  if (!c || typeof c !== "object") invalid(`concepts[${i}] must be an object.`);
+  if (!Array.isArray(c.frames) || !c.frames.length) invalid(`concepts[${i}].frames must be a non-empty array.`);
+});
+
 const state = { concept: 0, frame: 0, platform: null, handle: 0, headline: 0 };
 const concept = () => DATA.concepts[state.concept];
 
@@ -273,7 +286,7 @@ <h1>${esc(line || "Ad creative")}</h1>${p.note ? `<div class="sub">${esc(p.note)
 
 function renderConcepts() {
   document.getElementById("concepts").innerHTML = DATA.concepts.map((c, i) => `
-    <button class="concept" role="tab" aria-selected="${i === state.concept}" data-i="${i}">
+    <button class="concept" aria-pressed="${i === state.concept}" data-i="${i}">
       <div class="row1"><span class="num">${String(i + 1).padStart(2, "0")}</span>
         <span class="frames">${c.frames.length} frame${c.frames.length === 1 ? "" : "s"}</span></div>
       <div class="name">${esc(c.name)}</div>
@@ -350,7 +363,7 @@ <h1>${esc(line || "Ad creative")}</h1>${p.note ? `<div class="sub">${esc(p.note)
   } else {
     chrome = `<div class="ig-cta"><span>${esc(dest.cta || "Learn more")}</span><span class="chev">›</span></div>
       <div class="ig-actions">${heart}${comment}${share}<span class="save">${bookmark}</span></div>
-      <div class="likes">6,240 likes</div>
+      ${c.likes ? `<div class="likes">${esc(c.likes)} likes</div>` : ""}
       <div class="caption"><span class="h">${esc(h.name)}</span> ${esc((c.primaryText || "").slice(0, 90))}<span class="more"> … more</span></div>`;
   }
 
```

**File**: `skills/ad-creative/references/creative-review-page.md` (modified, +1/-0)
```diff
@@ -51,6 +51,7 @@ The template renders entirely from a JSON block near the top of the file — `<s
         "Most protein powders are never tested for heavy metals. Ours is."
       ],
       primaryText: "The caption / body copy.",
+      likes: "6,240",                       // optional — Instagram like count; omit and no count is shown
       destination: { url: "shop.truvani.com", cta: "Shop now", offer: "72% OFF Protein Starter Kit" },
       rollout: {                            // optional — the mechanics of how this runs (whitelist, launch plan)
         title: "How the whitelist runs",
```

---

### Incident Patch 5: `6e5ef94a` (2026-10-03)
**Commit Message**: fix(video): replace invalid Hyperframes example with the working CLI flow

Closes #600.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `skills/video/SKILL.md` (modified, +7/-20)
```diff
@@ -2,7 +2,7 @@
 name: video
 description: "When the user wants to create, generate, or produce video content using AI tools or programmatic frameworks. Also use when the user mentions 'video production,' 'AI video,' 'Remotion,' 'Hyperframes,' 'HeyGen,' 'Synthesia,' 'Veo,' 'Sora,' 'Runway,' 'Kling,' 'Seedance,' 'Hailuo,' 'MiniMax,' 'Pika,' 'Hunyuan,' 'Wan,' 'video generation,' 'AI avatar,' 'talking head video,' 'programmatic video,' 'video template,' 'explainer video,' 'product demo video,' 'record a product demo,' 'feature demo video,' 'in-app demo,' 'video pipeline,' 'copy this edit,' 'match this video style,' 'reverse-engineer this video,' 'edit like this reference,' or 'make me a video.' Use this for video creation, generation, and production workflows. For video content strategy and what to post, see social. For paid video ad creative, see ad-creative."
 metadata:
-  version: 2.2.0
+  version: 2.2.1
 ---
 
 # Video
@@ -56,29 +56,16 @@ Build videos with code. Best for repeatable, templated, or data-driven video at
 Open-source, Apache 2.0, from HeyGen. Uses plain HTML/CSS/JS — no framework DSL to learn. LLM-native: AI models generate better HTML than React components.
 
 ```bash
-npm install hyperframes
+npx hyperframes init my-video && cd my-video
+npx hyperframes preview               # live preview
+npx hyperframes render -o output.mp4  # render index.html
 ```
 
-**Key concept:** Each frame is an HTML document. Compose frames into a timeline, render to MP4.
-
-```typescript
-import { render } from "hyperframes";
-
-await render({
-  frames: [
-    { html: "<h1>Welcome to Acme</h1>", duration: 3 },
-    { html: "<h2>Here's what we built</h2>", duration: 3 },
-    { html: "<p>Try it free →</p>", duration: 2 },
-  ],
-  output: "intro.mp4",
-  width: 1080,
-  height: 1920, // 9:16 for vertical
-});
-```
+**Key concept:** A composition is one HTML file. The root element sets the canvas and length (`data-composition-id`, `data-duration`, `data-width`, `data-height`), each element on screen is a clip (`class="clip"` with `data-start`, `data-duration`, `data-track-index`), and a paused GSAP timeline registered in `window.__timelines` drives the animation. The `hyperframes` package is CLI-only; to render from code, use `@hyperframes/producer` (`createRenderJob` + `executeRenderJob`). Full syntax and a working example: [Hyperframes integration guide](https://github.com/coreyhaines31/marketingskills/blob/main/tools/integrations/hyperframes.md).
 
 **Best for:** Product announcements, changelogs, data-driven reports, personalized outreach videos.
 
-**Why agents prefer it:** Plain HTML/CSS means any coding agent can generate frames without learning a framework. Deterministic rendering — same input always produces identical output.
+**Why agents prefer it:** Plain HTML/CSS means any coding agent can write a composition without learning a framework. Deterministic rendering — same input always produces identical output.
 
 ### Remotion (React)
 
@@ -115,7 +102,7 @@ export const ProductDemo: React.FC<{ title: string; features: string[] }> = ({
 | Factor | Hyperframes | Remotion |
 |--------|-------------|----------|
 | Agent compatibility | Better (plain HTML) | Good (React) |
-| Animation complexity | Basic (CSS transitions) | Advanced (Spring, interpolate) |
+| Animation complexity | GSAP timelines (plus CSS) | Advanced (Spring, interpolate) |
 | Batch rendering | Local | Lambda (AWS) for scale |
 | Learning curve | Minimal | Moderate (React + Remotion API) |
 | License | Apache 2.0 | Company license for commercial use |
```

---

### Incident Patch 6: `23d1e06f` (2026-10-03)
**Commit Message**: docs(hyperframes): rewrite guide around the real CLI and composition format

The guide showed a render({ frames }) API that the hyperframes package
doesn't export. Verified against v0.8.114 (#600).

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `tools/integrations/hyperframes.md` (modified, +44/-108)
```diff
@@ -9,7 +9,7 @@ Open-source programmatic video framework from HeyGen. Create videos from HTML/CS
 | API | - | Library, not a hosted service |
 | MCP | - | - |
 | CLI | Yes | `npx hyperframes render` |
-| SDK | Yes | Node.js/TypeScript package |
+| SDK | Yes | `@hyperframes/producer` for rendering from code; the `hyperframes` package itself is CLI-only |
 
 ## Why Hyperframes
 
@@ -21,133 +21,69 @@ Open-source programmatic video framework from HeyGen. Create videos from HTML/CS
 ## Install
 
 ```bash
-npm install hyperframes
+npx hyperframes <command>          # or: npm install -g hyperframes
 ```
 
-Requires: Node.js 22+, Chrome/Chromium (for rendering)
+Requires Node.js 22+ and FFmpeg. The `hyperframes` package is a **CLI only**; it has no importable API. For rendering from your own code, use `@hyperframes/producer` (below). Checked against v0.8.114, Oct 2026.
 
-## Quick Start
+## Quick Start (CLI)
 
-```typescript
-import { render } from "hyperframes";
-
-await render({
-  frames: [
-    {
-      html: `
-        <div style="display:flex; align-items:center; justify-content:center;
-                    height:100%; background:#000; color:#fff; font-family:system-ui;">
-          <h1 style="font-size:64px;">Welcome to Acme</h1>
-        </div>
-      `,
-      duration: 3,
-    },
-    {
-      html: `
-        <div style="display:flex; flex-direction:column; align-items:center;
-                    justify-content:center; height:100%; background:#000; color:#fff;
-                    font-family:system-ui;">
-          <h2 style="font-size:48px;">Ship faster with AI</h2>
-          <p style="font-size:24px; color:#888;">Try it free today</p>
-        </div>
-      `,
-      duration: 3,
-    },
-  ],
-  output: "intro.mp4",
-  width: 1080,
-  height: 1920, // 9:16 vertical
-  fps: 30,
-});
-```
-
-## Core Concepts
-
-### Frames
-
-Each frame is an HTML document rendered at a specific point in the timeline. Think of it as a slide with a duration.
-
-```typescript
-{
-  html: "<div>...</div>",  // Full HTML content
-  duration: 3,              // Seconds to display
-  css?: "body { ... }",     // Optional external CSS
-}
+```bash
+npx hyperframes init my-video        # scaffold a project from a template
+cd my-video
+npx hyperframes preview              # live preview in the Studio (localhost:3002)
+npx hyperframes render -o output.mp4 # render the project's index.html
+npx hyperframes render -c ./promo.html -o promo.mp4   # render a specific composition
+npx hyperframes lint .               # catch composition errors before rendering
 ```
 
-### Transitions
+## How a Composition Works
 
-CSS transitions and animations work between frames:
+A composition is an HTML file. The root element declares the canvas and total length, each visible element is a **clip** with its own start, duration, and track, and animation runs on a paused GSAP timeline that Hyperframes drives frame by frame. This is the shape of the package's own `blank` template:
 
 ```html
-<div style="animation: fadeIn 0.5s ease-in;">
-  <h1>Slide In</h1>
-</div>
-<style>
-  @keyframes fadeIn {
-    from { opacity: 0; transform: translateY(20px); }
-    to { opacity: 1; transform: translateY(0); }
-  }
-</style>
-```
+<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
 
-### Data-Driven Videos
-
-Generate frames from data for batch production:
+<div id="root" data-composition-id="main"
+     data-start="0" data-duration="8" data-width="1080" data-height="1920">
+  <h1 id="title" class="clip" data-start="0" data-duration="4" data-track-index="0">Welcome to Acme</h1>
+  <p id="cta" class="clip" data-start="4" data-duration="4" data-track-index="0">Try it free</p>
+</div>
 
-```typescript
-const features = ["Analytics", "Automation", "AI Insights"];
-
-const frames = features.map((feature) => ({
-  html: `
-    <div style="display:flex; align-items:center; justify-content:center;
-                height:100%; background:linear-gradient(135deg, #667eea, #764ba2);
-                color:#fff; font-family:system-ui;">
-      <h1 style="font-size:56px;">${feature}</h1>
-    </div>
-  `,
-  duration: 2.5,
-}));
-
-await render({ frames, output: "features.mp4", width: 1080, height: 1920 });
+<script>
+  const tl = gsap.timeline({ paused: true });
+  tl.fromTo("#title", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6 }, 0);
+  tl.fromTo("#cta", { opacity: 0 }, { opacity: 1, duration: 0.4 }, 4);
+  window.__timelines["main"] = tl;
+  tl.seek(0);
+</script>
 ```
 
-## Common Marketing Templates
+- **Timing** lives in `data-start` and `data-duration` (seconds). `data-track-index` layers clips that overlap.
+- **Size** comes from `data-width` and `data-height` on the root; set the page's `html, body` to the same size in CSS.
+- **Animation** goes on the GSAP timeline, keyed to the same start times. Register it under the composition's id.
+- Run `npx hyperframes lint` after editing; it catches missing attributes and timi
```

---

### Incident Patch 7: `4a4564ef` (2026-10-03)
**Commit Message**: fix: correct WhatsApp pricing windows, market-sizing math, and cookie advice

Codex review, checked against Meta's live pricing page: the free entry
point window lasts up to 7 days (not a fixed 72 hours), service messages
get 1,000 free a month per number, general business opt-in is allowed,
and verification doesn't guarantee the 2,000 tier. Market sizing compared
a search-only figure with total SOM; the cookie gotcha ignored localhost.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `skills/marketing-plan/references/market-sizing.md` (modified, +3/-2)
```diff
@@ -82,11 +82,12 @@ Put each method's result side by side for the same layer (usually SOM or SAM):
 | Method | SOM estimate (Year 1) | Key assumption | Confidence |
 |---|---|---|---|
 | Bottom-up | $0.4M-$0.9M | 1-2% capture | Medium |
-| Search-led | $0.2M-$0.4M | 10-20% click share | Medium |
+| Search-led | $0.2M-$0.4M (search channel only) | 10-20% click share | Medium |
 | Channel-led | ~$0.45M | $80 CPL holds at scale | Low |
 
 How to read the comparison:
-- **Estimates overlap** → the overlap is your working range. Here, roughly $0.4M-$0.5M.
+- **Compare like with like.** The search-led figure covers one channel, so it's a floor for SOM rather than a competing estimate. Here, bottom-up and channel-led agree around $0.4M-$0.5M, and search alone gets about halfway there, which is consistent.
+- **Estimates overlap** → the overlap is your working range.
 - **Estimates differ by more than ~3×** → one assumption is broken. Find it before presenting any number.
 - **Bottom-up far exceeds channel-led** → demand exists but the plan can't reach it yet. That points to a budget or channel constraint, which belongs in Section 10 (funding-stage unlocks).
 - **Channel-led far exceeds bottom-up** → the reachable-buyer count is probably too low, or the channel assumptions are optimistic.
```

**File**: `skills/sms/evals/evals.json` (modified, +3/-3)
```diff
@@ -99,12 +99,12 @@
     {
       "id": 7,
       "prompt": "We sell fashion accessories in Brazil and Mexico and get about 1,500 abandoned carts a week. Most customers use WhatsApp, not SMS. Can we send cart reminders on WhatsApp an hour after they leave, and what will it cost?",
-      "expected_output": "Should check for product-marketing.md first. Should confirm WhatsApp fits better than SMS for Brazil and Mexico and reference references/whatsapp.md. Should explain that a reminder 1 hour after abandonment falls outside the 24-hour customer service window, so it must be a Meta-approved template, and that cart reminders are classified as marketing templates (submitting as utility gets recategorized). Should require WhatsApp-specific opt-in that names the business, captured at checkout or in chat, plus an opt-out button or STOP footer on every marketing template. Should explain current per-message pricing (since July 1, 2025): every delivered marketing template is charged at a per-country rate, with no free window for these reminders, and recommend modeling cost per recovered order using current Meta or BSP rate cards rather than old per-conversation pricing. Should warn that blocks and reports lower the quality rating, can flag the number and cut the messaging limit, and recommend warming up a new number, business verification, and limiting to 1-2 cart touches with exit on purchase or opt-out. Should design the template with name, product, and checkout URL button, holding any discount for a later touch.",
+      "expected_output": "Should check for product-marketing.md first. Should confirm WhatsApp fits better than SMS for Brazil and Mexico and reference references/whatsapp.md. Should explain that a reminder 1 hour after abandonment falls outside the 24-hour customer service window, so it must be a Meta-approved template, and that cart reminders are classified as marketing templates (submitting as utility gets recategorized). Should require WhatsApp-specific opt-in that names the business, captured at checkout or in chat, plus an opt-out button or STOP footer on every marketing template. Should explain current per-message pricing (since July 1, 2025): every delivered marketing template is charged at a per-country rate, with no free window unless the customer recently messaged for these reminders, and recommend modeling cost per recovered order using current Meta or BSP rate cards rather than old per-conversation pricing. Should warn that blocks and reports lower the quality rating, can flag the number and cut the messaging limit, and recommend warming up a new number, business verification, and limiting to 1-2 cart touches with exit on purchase or opt-out. Should design the template with name, product, and checkout URL button, holding any discount for a later touch.",
       "assertions": [
         "Checks for product-marketing.md",
-        "States the reminder falls outside the 24-hour window and needs an approved template",
+        "Checks whether a 24-hour service window (or a click-to-WhatsApp free window) is open from the customer's messaging history, and uses an approved template when it isn't",
         "Classifies cart reminders as marketing templates",
-        "Requires WhatsApp opt-in naming the business",
+        "Requires opt-in that names the business (and ideally WhatsApp), compliant with local law",
         "Includes an opt-out button or STOP footer",
         "Explains per-message pricing with marketing templates charged per delivery",
         "Does not quote per-conversation pricing as current",
```

**File**: `skills/sms/references/whatsapp.md` (modified, +8/-12)
```diff
@@ -16,7 +16,7 @@ WhatsApp is the default messaging app in most of Latin America, Europe, Africa,
 | Customers mostly in the US | **SMS** | Meta does not currently deliver marketing templates to US (+1) numbers |
 | Rich product messages (images, buttons, lists) | **WhatsApp** | Native interactive formats, no MMS surcharge |
 | Two-way sales or support conversations | **WhatsApp** | Threaded chat, reply buttons, human handoff |
-| Paid social is a major acquisition channel | **WhatsApp** | Click-to-WhatsApp ads open a free 72-hour window |
+| Paid social is a major acquisition channel | **WhatsApp** | Click-to-WhatsApp ads open a free window |
 | Simple one-way alerts, auth codes, US-heavy list | **SMS** | Simpler setup, universal reach |
 | Multi-country program | **Both** | WhatsApp where adoption is high, SMS as fallback |
 
@@ -67,11 +67,7 @@ Rules that trip people up:
 
 ## Opt-In and Opt-Out
 
-Meta requires opt-in before you message someone. The opt-in must:
-
-1. Clearly state the person is opting in to receive messages **on WhatsApp**
-2. Clearly name **your business**
-3. Comply with local law (GDPR, LGPD, India's DPDP Act, TCPA, and so on)
+Meta requires opt-in before you message someone. The opt-in should clearly tell the person they'll get messages from **your business**, and it must comply with local law (GDPR, LGPD, India's DPDP Act, TCPA, and so on). Meta allows a general business opt-in, but naming WhatsApp explicitly is the safer practice and what many laws effectively expect, so do it unless you have a reason not to.
 
 You can collect it through a website form, checkout checkbox, SMS, IVR, in person, or inside a WhatsApp chat. Meta recommends separate opt-ins (or one opt-in that names the categories) for order updates vs offers.
 
@@ -126,7 +122,7 @@ Meta also caps how many marketing templates **one person** receives from all bus
 
 ### Warming up a new number
 
-1. Get business verification done first so you start at 2,000
+1. Get business verification done first. It makes the account eligible to scale toward 2,000, but Meta still approves or denies the increase after a quality review, so check the actual limit before scheduling sends
 2. Send your first templates to recent, high-intent opt-ins (buyers from the last 30 days, people who messaged you)
 3. Scale volume over 1-2 weeks as the number stays green
 4. Spread big sends over hours instead of firing everything at once
@@ -162,31 +158,31 @@ Meta moved from conversation-based pricing to **per-message pricing on July 1, 2
 |--------------|-----------------|
 | **Marketing template** | Charged on every delivery, inside or outside a service window |
 | **Utility template** | Charged outside a window. Inside an open window it was free from July 1, 2025 until **October 1, 2026**, when Meta began charging for it |
-| **Authentication template** | Charged outside a window |
-| **Service message** (free-form reply) | Free from November 1, 2024. Charged per message from **October 1, 2026**, at the same rate as utility/authentication in that market, no volume tiers |
+| **Authentication template** | Charged per delivery; check the current rate card for in-window treatment in your market |
+| **Service message** (free-form reply) | Free from November 1, 2024. From **October 1, 2026**, each business phone number gets **1,000 free service messages a month** (no rollover); after that, they're charged per message at the same rate as utility/authentication in that market, with no volume tiers |
 | **Meta Business Agent** (Meta's AI agent) | Charged per token from August 1, 2026, about $2 per 1M tokens. Never free |
 | **Anything in a free entry point window** | Free (see below) |
 
 **Volume tiers**: utility and authentication rates drop as monthly volume grows, measured across your whole portfolio per market. Tiers reset each calendar month. Marketing has no volume tiers, but the Marketing Messages API lets you set a max price per delivery.
 
 **Practical math**: rates differ a lot by country. Marketing is the most expensive category in every market, often several times the utility rate. Pull current rates from Meta's rate cards (or your BSP's, which include their markup) and model cost per recovered order before launching a flow.
 
-The October 2026 changes mean support conversations and in-window order updates now cost money. If your old business case assumed "replies are free," redo it.
+The October 2026 changes mean support conversations beyond the first 1,000 a month per number, and in-window order updates, now cost money. If your old business case assumed "replies are free," redo it.
 
 ---
 
 ## Click-to-WhatsApp Ads
 
 Click-to-WhatsApp (CTWA) ads run on Facebook and Instagram and open a WhatsApp chat with your business when tapped.
 
-**Free entry point window**: when someone messages you from a CTWA ad or a Facebook Page call-to-action button, and you reply within 24 hours, a **72-hour free window** opens. Inside it, Meta doesn't charge 
```

**File**: `skills/video/references/product-demo-recording.md` (modified, +2/-2)
```diff
@@ -130,7 +130,7 @@ Narration clips usually run 3-7 seconds, while actions take 1.5-2 seconds. With
 
 ### `Secure; SameSite=None` cookies are rejected over HTTP
 
-Chromium won't set `Secure` cookies on plain HTTP, so the session never sticks and every navigation bounces to login. Either switch the session cookie to `SameSite=Lax` for the recording run (often an env flag) or serve HTTPS with a self-signed cert and `ignoreHTTPSErrors: true`.
+Browsers won't set `Secure` cookies over plain HTTP on a non-localhost host (for example a LAN IP or a custom dev domain), so the session never sticks and every navigation bounces to login. `http://localhost` is usually treated as secure and is fine. Otherwise, either drop the `Secure` flag for the recording run (`SameSite=None` requires `Secure`, so switch to `SameSite=Lax` at the same time; often an env flag), or serve HTTPS with a self-signed cert and `ignoreHTTPSErrors: true`.
 
 ### Strict CSP blocks the overlay
 
@@ -161,7 +161,7 @@ Narration reuses the subtitle captions as the script.
 3. **Narrate the title card** with a one-sentence intro in the same voice.
 4. **Mux with ffmpeg** — delay each clip to its subtitle offset (`adelay`), push back any clip that would overlap the previous one, mix with `amix`, and pad the video tail (`tpad=stop_mode=clone`) if audio runs past the visuals.
 
-**API keys:** the TTS key belongs in an environment variable (e.g. `ELEVENLABS_API_KEY`) or a secret manager, loaded by the script at runtime. Never ask the user to paste a key into chat, and never write one into the repo or a committed `.env` file. If the key isn't set, tell the user which variable to set in their own shell and fall back to a silent recording in the meantime.
+**API keys:** the TTS key belongs in an environment variable (e.g. `ELEVENLABS_API_KEY`) or a secret manager, loaded by the script at runtime. Never ask the user to paste a key into chat, and never write one into the repo or a committed `.env` file. If the key isn't set, tell the user which variable to set in their own shell and fall back to a silent recording in the meantime. If a user pastes a key into chat anyway, don't use it: tell them to rotate it, since chat logs aren't a safe place for secrets.
 
 ## Delivery Checklist
 
```

---

### Incident Patch 8: `7350b699` (2026-10-03)
**Commit Message**: Merge pull request #658 from coreyhaines31/community/batch-c-tools-guides

chore: land community tool and guide contributions (2.11.14)

**File**: `.claude-plugin/marketplace.json` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
   },
   "metadata": {
     "description": "Marketing skills for AI agents — conversion optimization, copywriting, SEO, paid ads, and growth",
-    "version": "2.11.13",
+    "version": "2.11.14",
     "repository": "https://github.com/coreyhaines31/marketingskills"
   },
   "plugins": [
```

**File**: `.claude-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "marketing-skills",
   "description": "Marketing skills for AI agents — conversion optimization, copywriting, SEO, paid ads, ad creative, and growth",
-  "version": "2.11.13",
+  "version": "2.11.14",
   "author": {
     "name": "Corey Haines"
   },
```

**File**: `VERSIONS.md` (modified, +13/-2)
```diff
@@ -14,7 +14,7 @@ Current versions of all skills. Agents can compare against local versions to che
 | co-marketing | 2.0.2 | 2026-10-02 |
 | cold-email | 2.1.0 | 2026-10-02 |
 | community-marketing | 2.0.1 | 2026-08-23 |
-| competitor-profiling | 2.1.0 | 2026-10-01 |
+| competitor-profiling | 2.1.1 | 2026-10-02 |
 | competitors | 2.3.0 | 2026-10-01 |
 | content-strategy | 2.1.2 | 2026-10-02 |
 | copy-editing | 2.1.0 | 2026-10-02 |
@@ -52,11 +52,22 @@ Current versions of all skills. Agents can compare against local versions to che
 | signup | 2.0.0 | 2026-05-05 |
 | site-architecture | 2.0.0 | 2026-05-05 |
 | sms | 1.0.1 | 2026-10-02 |
-| social | 2.3.1 | 2026-10-02 |
+| social | 2.3.2 | 2026-10-02 |
 | video | 2.1.2 | 2026-10-02 |
 
 ## Recent Changes
 
+### 2.11.14 (2026-10-02)
+
+Community tool and guide contributions. Lands #642, #400, #586, #366, #461, and #397 with contributor credit.
+
+- **Ahrefs CLI v3 parameters** (#642 by @rudycelekli): sends the `date` and `select` parameters Ahrefs v3 requires. Both now default (today's date, Ahrefs' documented keyword and top-page columns) instead of being mandatory, and the tests moved to `tests/clis/`.
+- **Firecrawl CLI and v2 docs** (#400 by @rakshith48): a new zero-dependency Firecrawl CLI on the v2 API, with competitor-profiling's tool reference updated to v2 (structured extraction is now JSON mode on scrape). It shows usage without credentials like the other CLIs.
+- **Glasser integration guide** (#586 by @adriansurething): a pay-per-call data API broker, now with an in-guide maker disclosure and provider-access claims framed as subject to each provider's terms.
+- **Alternative stack for competitor-profiling** (#366 by @4thoughtmarketing-mktg): WebFetch plus whichever SEO data source is connected (Ahrefs or Semrush MCP, Ubersuggest, or similar) when Firecrawl or DataForSEO is unavailable. Missing metrics are marked unavailable, never estimated.
+- **Publishing from your agent** (#461 by @josiahcoad): a draft-first, approval-gated workflow for scheduling posts through a connected tool. The tool list is neutral, and the Typefully claim is corrected.
+- **X algorithm reference** (#397 by @benjaminard): how xAI's open-sourced For You ranker scores posts, with each rule tagged verified or reported.
+
 ### 2.11.13 (2026-10-02)
 
 Community content fixes. Lands #595, #572, #508, #401, and #481 with contributor credit.
```

**File**: `skills/competitor-profiling/SKILL.md` (modified, +21/-4)
```diff
@@ -2,7 +2,7 @@
 name: competitor-profiling
 description: "When the user wants to research, profile, or analyze competitors from their URLs. Also use when the user mentions 'competitor profile,' 'competitor research,' 'competitor analysis,' 'profile this competitor,' 'analyze competitor,' 'competitive intelligence,' 'competitor deep dive,' 'who are my competitors,' 'competitor landscape,' 'competitor dossier,' 'competitive audit,' or 'research these competitors.' Input is a list of competitor URLs. Output is structured competitor profile markdown files. For creating comparison/alternative pages from profiles, see competitors. For sales-specific battle cards, see sales-enablement."
 metadata:
-  version: 2.1.0
+  version: 2.1.1
 ---
 
 # Competitor Profiling
@@ -25,6 +25,21 @@ If the user provides URLs and context is available, proceed without asking.
 
 ---
 
+## Tool Stack Selection
+
+This skill supports two data source stacks. Check which MCPs are active before starting and select accordingly.
+
+| Stack | Scraping | SEO & Market Data | When to use |
+|---|---|---|---|
+| **Primary** | Firecrawl MCP | DataForSEO MCP | Preferred — richer data, site mapping, structured extraction |
+| **Alternative** | WebFetch (built-in) | Whatever SEO data source is connected: Ahrefs or Semrush MCP, Ubersuggest MCP, or similar | When Firecrawl or DataForSEO are unavailable |
+
+If neither Firecrawl nor DataForSEO is available but another SEO data source is, use the alternative stack; most cover the core profile fields. If no SEO data source is available, mark those metrics unavailable (never estimate them) and proceed with qualitative observations only.
+
+For full tool documentation, execution order, and error handling for both stacks, see [references/tool-reference.md](references/tool-reference.md).
+
+---
+
 ## Core Principles
 
 ### 1. Facts Over Opinions
@@ -84,10 +99,12 @@ The synthesized profile (`<competitor-slug>.md`) should reference the raw data f
 
 ## Research Process
 
-### Phase 1: Site Scraping (Firecrawl)
+### Phase 1: Site Scraping (Firecrawl or WebFetch)
 
 For each competitor URL, scrape key pages to extract positioning, features, pricing, and messaging.
 
+**If Firecrawl is unavailable**, use WebFetch in place of all Firecrawl calls. Skip the site-mapping step and instead probe common page paths manually (see [references/tool-reference.md](references/tool-reference.md) — Alternative Stack section). Fetch the homepage first; its navigation links usually reveal the actual paths for pricing, features, and about pages.
+
 #### Step 1: Map the site
 
 Use **Firecrawl Map** to discover the competitor's site structure and identify key pages:
@@ -140,9 +157,9 @@ Save each scraped review page to `competitor-profiles/raw/<competitor-slug>/<YYY
 
 ---
 
-### Phase 2: SEO & Market Data (DataForSEO)
+### Phase 2: SEO & Market Data (DataForSEO or Ubersuggest)
 
-Use DataForSEO MCP tools to gather quantitative competitive intelligence. Save each raw response as JSON to `competitor-profiles/raw/<competitor-slug>/<YYYY-MM-DD>/seo/<endpoint-name>.json` before parsing it into the profile. For the full list of MCP tools used in this skill (Firecrawl + DataForSEO) and example calls, see [references/tool-reference.md](references/tool-reference.md).
+Use DataForSEO MCP tools to gather quantitative competitive intelligence. **If DataForSEO is unavailable**, use whichever SEO data source is connected (Ahrefs or Semrush MCP, Ubersuggest MCP, or similar). Most cover domain traffic, keyword rankings, backlinks, referring domains, top pages, and organic competitors. [references/tool-reference.md](references/tool-reference.md) maps the Ubersuggest tools as a worked example. Save each raw response as JSON to `competitor-profiles/raw/<competitor-slug>/<YYYY-MM-DD>/seo/<endpoint-name>.json` before parsing it into the profile. For the full list of MCP tools used in this skill (Firecrawl + DataForSEO) and example calls, see [references/tool-reference.md](references/tool-reference.md).
 
 #### Domain Authority & Backlinks
 
```

**File**: `skills/competitor-profiling/references/tool-reference.md` (modified, +140/-5)
```diff
@@ -24,6 +24,11 @@ Quick reference for the Firecrawl and DataForSEO MCP tools used in competitor pr
 **Key output**: Page content in markdown format — headlines, body text, structured data.
 **Tip**: Scrape homepage first — it reveals positioning, audience, and social proof in one shot.
 
+**Structured data (JSON mode)**
+**Purpose**: Extract structured data from a page using a schema — request the `json` format on the scrape call.
+**When to use**: When you need specific data points in a consistent format (e.g., pricing tier details, feature lists).
+**Tip**: Define a clear schema for what you want extracted — more reliable than parsing raw markdown.
+
 ### firecrawl_search
 **Purpose**: Search the web for specific content about a competitor.
 **When to use**: Finding review pages, press coverage, or competitor mentions not on their own site.
@@ -37,11 +42,6 @@ Quick reference for the Firecrawl and DataForSEO MCP tools used in competitor pr
 **When to use**: Deep profiles where you want to analyze many pages (e.g., all feature pages, all blog posts). More expensive — use selectively.
 **Tip**: Set page limits to avoid crawling entire sites. Target specific URL patterns.
 
-### firecrawl_extract
-**Purpose**: Extract structured data from a page using a schema.
-**When to use**: When you need specific data points in a consistent format (e.g., pricing tier details, feature lists).
-**Tip**: Define a clear schema for what you want extracted — more reliable than parsing raw markdown.
-
 ---
 
 ## DataForSEO MCP Tools
@@ -177,3 +177,138 @@ Quick reference for the Firecrawl and DataForSEO MCP tools used in competitor pr
 | DataForSEO returns no data for domain | Domain may be too new or too small — note "insufficient data" in profile |
 | Rate limits hit | Space out requests; prioritize highest-value data first |
 | Review page scraping blocked | Use `firecrawl_search` to find cached or alternative review sources |
+
+---
+
+## Alternative Stack: Another SEO Data Source + WebFetch
+
+If Firecrawl or DataForSEO are not available, use whichever SEO data source is connected (Ahrefs or Semrush MCP, Ubersuggest MCP, or similar) for SEO and market data, and **WebFetch** for page scraping. The tool mapping below uses Ubersuggest MCP as the worked example; the same fields map onto the others. Coverage is slightly less comprehensive — no site mapping, no structured extraction, no technology detection — but sufficient for quick scans and most competitive profiling needs.
+
+### When to use each stack
+
+| Capability | Primary (preferred) | Alternative |
+|---|---|---|
+| Page scraping | Firecrawl MCP | WebFetch (built into Claude Code) |
+| Site URL discovery | `firecrawl_map` | Manually probe common paths |
+| SEO metrics | DataForSEO MCP | Ubersuggest MCP |
+| Backlink data | DataForSEO backlinks tools | Ubersuggest `backlinks_overview` + `linking_domains` |
+| Technology detection | `domain_analytics_technologies_domain_technologies` | Not available in alternative stack |
+| Review mining | `firecrawl_search` → G2/Capterra | WebFetch G2/Capterra URLs directly |
+
+Check which MCPs are available at the start of each session and select the stack accordingly. If both are available, prefer the primary stack.
+
+---
+
+### WebFetch (alternative to Firecrawl)
+
+**Purpose**: Fetch and read any public web page as text.
+**Built into**: Claude Code — no MCP required.
+**Limitation vs. Firecrawl**: No site mapping (URL discovery); no structured extraction; may not render JavaScript-heavy pages well.
+
+Since WebFetch does not map a site's URLs, probe common paths manually for each competitor:
+
+| Page type | Paths to try |
+|---|---|
+| Homepage | `https://[domain]/` |
+| Pricing | `/pricing`, `/plans`, `/packages`, `/pricing-plans` |
+| About | `/about`, `/about-us`, `/company`, `/team` |
+| Features / Product | `/features`, `/product`, `/platform`, `/solutions` |
+| Customers | `/customers`, `/case-studies`, `/clients`, `/success-stories` |
+| Integrations | `/integrations`, `/apps`, `/connect` |
+| Blog | `/blog`, `/resources`, `/insights` |
+
+Fetch the homepage first. Its nav links often reveal the actual paths for pricing, features, and about pages — use those instead of guessing.
+
+---
+
+### Ubersuggest MCP Tools (alternative to DataForSEO)
+
+Mapping from DataForSEO equivalents:
+
+#### domain_overview
+**DataForSEO equivalent**: `dataforseo_labs_google_domain_rank_overview`
+**Purpose**: Domain-level organic traffic estimate, keyword count, domain score, and backlink summary in one call.
+**Input**: `root_domain` (e.g. `competitor.com`), `country` (default: `us`)
+**Key metrics**: `domain_score`, `organic_monthly_traffic`, `organic_keywords`, `paid_keywords`
+
+#### backlinks_overview
+**DataForSEO equivalent**: `backlinks_summary`
+**Purpose**: Domain authority, total backlinks, referring domains count.
+**Input**: `root_domain`
+**Key metrics**: `domain_authority`, `total_backlinks`, `referring_domains`
+
+#### lin
```

**File**: `skills/social/SKILL.md` (modified, +24/-1)
```diff
@@ -2,13 +2,15 @@
 name: social
 description: "When the user wants help creating, scheduling, or optimizing social media content for LinkedIn, Twitter/X, Instagram, TikTok, or Facebook, or wants to do social listening and engagement triage. Also use when the user mentions 'LinkedIn post,' 'Twitter thread,' 'social media,' 'content calendar,' 'social scheduling,' 'engagement,' 'viral content,' 'what should I post,' 'repurpose this content,' 'tweet ideas,' 'LinkedIn carousel,' 'social media strategy,' 'grow my following,' 'TikTok video,' 'Reels,' 'Shorts,' 'video script,' 'video hook,' 'short-form video,' 'create a reel,' 'social listening,' 'brand mentions,' 'competitor monitoring,' 'top posts to comment on,' 'find people asking for,' 'carousel,' 'slide-by-slide,' or 'document post.' Use this for social content, repurposing, scheduling, video scripts, and listening. Posts avoid AI tells like 'it's not X, it's Y' reveals and broetry. For broader content strategy, see content-strategy. For paid ads, see ad-creative. For earned media, see public-relations."
 metadata:
-  version: 2.3.1
+  version: 2.3.2
 ---
 
 # Social Content
 
 You are an expert social media strategist. Your goal is to help create engaging content that builds audience, drives engagement, and supports business goals.
 
+Whatever the platform, storytelling and connecting with your audience come first. The better the user can share their story, the better their posts will perform — platform tactics and algorithm mechanics amplify a good story; they never replace one. Keep this at the center of every recommendation below.
+
 ## Before Creating Content
 
 **Check for product marketing context first:**
@@ -52,6 +54,8 @@ Gather this context (ask if not provided):
 
 **For hashtag limits and character counts**: See [references/platform-limits.md](references/platform-limits.md)
 
+**For X (Twitter) ranking mechanics** — the For You feed signals from xAI's open-sourced algorithm, and the 10 posting rules they imply: See [references/x-algorithm.md](references/x-algorithm.md). Use it whenever the task involves posting on X.
+
 ---
 
 ## Content Pillars Framework
@@ -316,6 +320,25 @@ Extract "content atoms" — self-contained moments from any long-form content th
 - Leave gaps for spontaneous posts
 - Adjust timing based on performance data
 
+### Publishing From Your Agent
+
+Everything above produces drafts and a calendar — actually getting posts onto
+accounts still needs a scheduling tool. If the user has one with an MCP server
+or API, you can execute the plan directly instead of handing them copy-paste
+work:
+
+1. **Check what's connected.** Ask the user what they schedule with. Many
+   scheduling tools (Typefully, Buffer, Marky, and others) expose drafting and
+   scheduling through an MCP server or an API, so you can create and schedule
+   posts directly. Check the [tools registry](https://github.com/coreyhaines31/marketingskills/blob/main/tools/REGISTRY.md) for guides.
+2. **Create posts as drafts first** — the user approves before anything is
+   scheduled. Never auto-publish without an explicit go-ahead.
+3. **Schedule per the calendar you built** (spacing and platform rules from
+   this skill still apply), then report back the queue with review links.
+4. **Close the loop.** If the tool exposes post-level stats, pull them next
+   session and feed real engagement data back into the "adjust timing based on
+   performance" step instead of guessing.
+
 ---
 
 ## Reverse Engineering Viral Content
```

**File**: `skills/social/evals/evals.json` (modified, +30/-0)
```diff
@@ -115,6 +115,36 @@
       ],
       "files": [],
       "id": 8
+    },
+    {
+      "id": 9,
+      "prompt": "I'm posting on X 5 times every morning between 9 and 10am and my reach keeps dropping. I mostly post quick thoughts and hot takes. What am I doing wrong?",
+      "expected_output": "Should apply the X algorithm reference (references/x-algorithm.md). Should identify post clustering as the primary problem: the author-diversity scorer decays scores of repeated authors within a feed response, so 5 posts in an hour cannibalize each other — recommend spacing original posts ~60 minutes apart or spreading across the day. Should also check hook mechanics (specific claim in the first 8 words, topic named early so topic-based distribution can route the post) and presence (staying available to reply for the first 30 minutes after each post rather than batch-firing and leaving). Should reframe goals toward DM-shares, follows, and profile clicks rather than likes, since those are separately scored signals. Should note weight values are unpublished and recommendations are directional.",
+      "assertions": [
+        "References X algorithm mechanics from x-algorithm.md",
+        "Identifies post clustering / author-diversity decay as the main issue",
+        "Recommends ~60 minute spacing between original posts",
+        "Addresses hook structure (specific claim in first 8 words)",
+        "Mentions topic-anchoring for topic-based distribution",
+        "Recommends being present to reply after posting",
+        "Reframes toward shares/follows/profile clicks over likes"
+      ],
+      "files": []
+    },
+    {
+      "id": 10,
+      "prompt": "Write an X post announcing our new AI feature. Draft: 'We're so excited to announce something HUGE is coming... 🔥🔥 You won't want to miss this. Like and retweet if you're ready!!'",
+      "expected_output": "Should rewrite rather than lightly edit, and explain why using X ranking mechanics: the draft has no specific claim in the first 8 words, doesn't name the topic (so topic-based distribution can't route it), names nothing specific (no product, no capability), and 'like and retweet if you're ready' is engagement bait — the algorithm predicts negative actions (not interested, mute, block) and subtracts them, and baity phrasing risks muted-keyword filtering. Rewrite should open with the specific capability and name the product/tools involved, make the post DM-forwardable (specific, useful claim), and optionally suggest posting mechanics: don't cluster with other posts, stay present for the first 30 minutes, and if including video make it 8+ seconds with captions.",
+      "assertions": [
+        "Rewrites the post rather than approving it",
+        "Flags the missing specific claim in the first 8 words",
+        "Flags engagement bait and explains predicted negative-action penalties",
+        "Names the specific feature/product in the rewrite",
+        "Explains topic-anchoring for distribution",
+        "Optimizes for shareability over like-solicitation",
+        "Includes posting mechanics guidance (spacing, first-30-minutes presence)"
+      ],
+      "files": []
     }
   ]
 }
```

**File**: `skills/social/references/platforms.md` (modified, +15/-9)
```diff
@@ -2,6 +2,8 @@
 
 Detailed strategies for each major social platform.
 
+One thing holds on every platform below: storytelling and connecting with your audience are always key. Formats, cadences, and algorithm mechanics differ platform to platform, but the better you share your story, the better the posts perform — the platform-specific tactics amplify a story worth telling; they don't substitute for one.
+
 ## Contents
 - LinkedIn
 - Twitter/X
@@ -69,17 +71,21 @@ Detailed strategies for each major social platform.
 - Scheduling everything (no real-time presence)
 
 **Format tips:**
-- Tweets under 100 characters get more engagement
+- Open with a specific claim in the first 8 words — the hook is the post
+- Name your topic in the first 10 words (enables topic-based distribution)
+- Name specific tools, companies, and numbers instead of vague nouns
 - Threads: Hook in tweet 1, promise value, deliver
-- Quote tweets with added insight beat plain retweets
-- Use visuals to stop the scroll
+- Quote tweets with added insight beat plain retweets — quote engagement scores twice
+- Video needs ~8+ seconds and captions to earn video credit
 
-**Algorithm tips:**
-- Replies and quote tweets build authority
-- Threads keep people on platform (rewarded)
-- Images and video get more reach
-- Engagement in first 30 min matters
-- Twitter Blue/Premium may boost reach
+**Algorithm tips** (from xAI's open-sourced For You algorithm):
+- Write for the DM-share and the follow, not the like — both are separately scored signals
+- Profile clicks boost the post: make readers curious, keep bio and pinned post strong
+- Wait ~60 minutes between original posts — same-author posts decay each other's scores
+- Be present for the first 30 minutes after posting; early replies compound
+- Avoid engagement-bait phrasing — predicted mutes/blocks/"not interested" subtract from your score, and muted keywords filter you out entirely
+
+**For ranking signals and the full playbook**: See [x-algorithm.md](x-algorithm.md)
 
 ---
 
```

---

### Incident Patch 9: `38258bd0` (2026-10-03)
**Commit Message**: chore: release 2.11.14 (community tool and guide contributions)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.claude-plugin/marketplace.json` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
   },
   "metadata": {
     "description": "Marketing skills for AI agents — conversion optimization, copywriting, SEO, paid ads, and growth",
-    "version": "2.11.13",
+    "version": "2.11.14",
     "repository": "https://github.com/coreyhaines31/marketingskills"
   },
   "plugins": [
```

**File**: `.claude-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "marketing-skills",
   "description": "Marketing skills for AI agents — conversion optimization, copywriting, SEO, paid ads, ad creative, and growth",
-  "version": "2.11.13",
+  "version": "2.11.14",
   "author": {
     "name": "Corey Haines"
   },
```

**File**: `VERSIONS.md` (modified, +13/-2)
```diff
@@ -14,7 +14,7 @@ Current versions of all skills. Agents can compare against local versions to che
 | co-marketing | 2.0.2 | 2026-10-02 |
 | cold-email | 2.1.0 | 2026-10-02 |
 | community-marketing | 2.0.1 | 2026-08-23 |
-| competitor-profiling | 2.1.0 | 2026-10-01 |
+| competitor-profiling | 2.1.1 | 2026-10-02 |
 | competitors | 2.3.0 | 2026-10-01 |
 | content-strategy | 2.1.2 | 2026-10-02 |
 | copy-editing | 2.1.0 | 2026-10-02 |
@@ -52,11 +52,22 @@ Current versions of all skills. Agents can compare against local versions to che
 | signup | 2.0.0 | 2026-05-05 |
 | site-architecture | 2.0.0 | 2026-05-05 |
 | sms | 1.0.1 | 2026-10-02 |
-| social | 2.3.1 | 2026-10-02 |
+| social | 2.3.2 | 2026-10-02 |
 | video | 2.1.2 | 2026-10-02 |
 
 ## Recent Changes
 
+### 2.11.14 (2026-10-02)
+
+Community tool and guide contributions. Lands #642, #400, #586, #366, #461, and #397 with contributor credit.
+
+- **Ahrefs CLI v3 parameters** (#642 by @rudycelekli): sends the `date` and `select` parameters Ahrefs v3 requires. Both now default (today's date, Ahrefs' documented keyword and top-page columns) instead of being mandatory, and the tests moved to `tests/clis/`.
+- **Firecrawl CLI and v2 docs** (#400 by @rakshith48): a new zero-dependency Firecrawl CLI on the v2 API, with competitor-profiling's tool reference updated to v2 (structured extraction is now JSON mode on scrape). It shows usage without credentials like the other CLIs.
+- **Glasser integration guide** (#586 by @adriansurething): a pay-per-call data API broker, now with an in-guide maker disclosure and provider-access claims framed as subject to each provider's terms.
+- **Alternative stack for competitor-profiling** (#366 by @4thoughtmarketing-mktg): WebFetch plus whichever SEO data source is connected (Ahrefs or Semrush MCP, Ubersuggest, or similar) when Firecrawl or DataForSEO is unavailable. Missing metrics are marked unavailable, never estimated.
+- **Publishing from your agent** (#461 by @josiahcoad): a draft-first, approval-gated workflow for scheduling posts through a connected tool. The tool list is neutral, and the Typefully claim is corrected.
+- **X algorithm reference** (#397 by @benjaminard): how xAI's open-sourced For You ranker scores posts, with each rule tagged verified or reported.
+
 ### 2.11.13 (2026-10-02)
 
 Community content fixes. Lands #595, #572, #508, #401, and #481 with contributor credit.
```

**File**: `skills/competitor-profiling/SKILL.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 name: competitor-profiling
 description: "When the user wants to research, profile, or analyze competitors from their URLs. Also use when the user mentions 'competitor profile,' 'competitor research,' 'competitor analysis,' 'profile this competitor,' 'analyze competitor,' 'competitive intelligence,' 'competitor deep dive,' 'who are my competitors,' 'competitor landscape,' 'competitor dossier,' 'competitive audit,' or 'research these competitors.' Input is a list of competitor URLs. Output is structured competitor profile markdown files. For creating comparison/alternative pages from profiles, see competitors. For sales-specific battle cards, see sales-enablement."
 metadata:
-  version: 2.1.0
+  version: 2.1.1
 ---
 
 # Competitor Profiling
```

**File**: `skills/social/SKILL.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 name: social
 description: "When the user wants help creating, scheduling, or optimizing social media content for LinkedIn, Twitter/X, Instagram, TikTok, or Facebook, or wants to do social listening and engagement triage. Also use when the user mentions 'LinkedIn post,' 'Twitter thread,' 'social media,' 'content calendar,' 'social scheduling,' 'engagement,' 'viral content,' 'what should I post,' 'repurpose this content,' 'tweet ideas,' 'LinkedIn carousel,' 'social media strategy,' 'grow my following,' 'TikTok video,' 'Reels,' 'Shorts,' 'video script,' 'video hook,' 'short-form video,' 'create a reel,' 'social listening,' 'brand mentions,' 'competitor monitoring,' 'top posts to comment on,' 'find people asking for,' 'carousel,' 'slide-by-slide,' or 'document post.' Use this for social content, repurposing, scheduling, video scripts, and listening. Posts avoid AI tells like 'it's not X, it's Y' reveals and broetry. For broader content strategy, see content-strategy. For paid ads, see ad-creative. For earned media, see public-relations."
 metadata:
-  version: 2.3.1
+  version: 2.3.2
 ---
 
 # Social Content
```

---

### Incident Patch 10: `83d14861` (2026-10-03)
**Commit Message**: fix(social): neutralize the publishing tool list and fix the Typefully claim

#461 linked only its author's tool and called Typefully API-only, though
Typefully has an MCP server. The step now names several tools and points
to the registry.

Refs #461

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `skills/social/SKILL.md` (modified, +4/-4)
```diff
@@ -327,10 +327,10 @@ accounts still needs a scheduling tool. If the user has one with an MCP server
 or API, you can execute the plan directly instead of handing them copy-paste
 work:
 
-1. **Check what's connected.** Ask the user what they schedule with. Tools with
-   MCP servers (e.g., [Marky](https://www.mymarky.ai/agents)) expose
-   create/schedule/publish as agent tools; others (Buffer, Typefully) have APIs
-   you can call from a script.
+1. **Check what's connected.** Ask the user what they schedule with. Many
+   scheduling tools (Typefully, Buffer, Marky, and others) expose drafting and
+   scheduling through an MCP server or an API, so you can create and schedule
+   posts directly. Check the [tools registry](https://github.com/coreyhaines31/marketingskills/blob/main/tools/REGISTRY.md) for guides.
 2. **Create posts as drafts first** — the user approves before anything is
    scheduled. Never auto-publish without an explicit go-ahead.
 3. **Schedule per the calendar you built** (spacing and platform rules from
```

---

### Incident Patch 11: `681a2c87` (2026-10-03)
**Commit Message**: fix(competitor-profiling): make the fallback SEO source multi-vendor

#366 named Ubersuggest as the only drop-in fallback. Now any connected
SEO data source works, with Ubersuggest kept as the worked mapping, and
missing metrics are marked unavailable instead of estimated.

Refs #366

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `skills/competitor-profiling/SKILL.md` (modified, +3/-3)
```diff
@@ -32,9 +32,9 @@ This skill supports two data source stacks. Check which MCPs are active before s
 | Stack | Scraping | SEO & Market Data | When to use |
 |---|---|---|---|
 | **Primary** | Firecrawl MCP | DataForSEO MCP | Preferred — richer data, site mapping, structured extraction |
-| **Alternative** | WebFetch (built-in) | Ubersuggest MCP | When Firecrawl or DataForSEO are unavailable |
+| **Alternative** | WebFetch (built-in) | Whatever SEO data source is connected: Ahrefs or Semrush MCP, Ubersuggest MCP, or similar | When Firecrawl or DataForSEO are unavailable |
 
-If neither Firecrawl nor DataForSEO is available but Ubersuggest MCP is, use the alternative stack — it covers all core profile fields. If nothing is available, note the gap and proceed with qualitative observations only.
+If neither Firecrawl nor DataForSEO is available but another SEO data source is, use the alternative stack; most cover the core profile fields. If no SEO data source is available, mark those metrics unavailable (never estimate them) and proceed with qualitative observations only.
 
 For full tool documentation, execution order, and error handling for both stacks, see [references/tool-reference.md](references/tool-reference.md).
 
@@ -159,7 +159,7 @@ Save each scraped review page to `competitor-profiles/raw/<competitor-slug>/<YYY
 
 ### Phase 2: SEO & Market Data (DataForSEO or Ubersuggest)
 
-Use DataForSEO MCP tools to gather quantitative competitive intelligence. **If DataForSEO is unavailable**, use Ubersuggest MCP as a drop-in alternative — it covers domain traffic, keyword rankings, backlinks, referring domains, top pages, and organic competitors. See [references/tool-reference.md](references/tool-reference.md) for the full tool mapping and execution order. Save each raw response as JSON to `competitor-profiles/raw/<competitor-slug>/<YYYY-MM-DD>/seo/<endpoint-name>.json` before parsing it into the profile. For the full list of MCP tools used in this skill (Firecrawl + DataForSEO) and example calls, see [references/tool-reference.md](references/tool-reference.md).
+Use DataForSEO MCP tools to gather quantitative competitive intelligence. **If DataForSEO is unavailable**, use whichever SEO data source is connected (Ahrefs or Semrush MCP, Ubersuggest MCP, or similar). Most cover domain traffic, keyword rankings, backlinks, referring domains, top pages, and organic competitors. [references/tool-reference.md](references/tool-reference.md) maps the Ubersuggest tools as a worked example. Save each raw response as JSON to `competitor-profiles/raw/<competitor-slug>/<YYYY-MM-DD>/seo/<endpoint-name>.json` before parsing it into the profile. For the full list of MCP tools used in this skill (Firecrawl + DataForSEO) and example calls, see [references/tool-reference.md](references/tool-reference.md).
 
 #### Domain Authority & Backlinks
 
```

**File**: `skills/competitor-profiling/references/tool-reference.md` (modified, +2/-2)
```diff
@@ -180,9 +180,9 @@ Quick reference for the Firecrawl and DataForSEO MCP tools used in competitor pr
 
 ---
 
-## Alternative Stack: Ubersuggest MCP + WebFetch
+## Alternative Stack: Another SEO Data Source + WebFetch
 
-If Firecrawl or DataForSEO are not available, use **Ubersuggest MCP** (for SEO and market data) and **WebFetch** (for page scraping). Coverage is slightly less comprehensive — no site mapping, no structured extraction, no technology detection — but sufficient for quick scans and most competitive profiling needs.
+If Firecrawl or DataForSEO are not available, use whichever SEO data source is connected (Ahrefs or Semrush MCP, Ubersuggest MCP, or similar) for SEO and market data, and **WebFetch** for page scraping. The tool mapping below uses Ubersuggest MCP as the worked example; the same fields map onto the others. Coverage is slightly less comprehensive — no site mapping, no structured extraction, no technology detection — but sufficient for quick scans and most competitive profiling needs.
 
 ### When to use each stack
 
```

---

### Incident Patch 12: `f7932179` (2026-10-03)
**Commit Message**: fix(firecrawl cli): show usage without credentials like the other CLIs

Refs #400

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `tools/clis/firecrawl.js` (modified, +3/-2)
```diff
@@ -1,9 +1,10 @@
 #!/usr/bin/env node
 
 const API_KEY = process.env.FIRECRAWL_API_KEY
+const rawArgs = process.argv.slice(2)
 const BASE_URL = 'https://api.firecrawl.dev'
 
-if (!API_KEY) {
+if (!API_KEY && rawArgs.length > 0) {
   console.error(JSON.stringify({ error: 'FIRECRAWL_API_KEY environment variable required' }))
   process.exit(1)
 }
@@ -52,7 +53,7 @@ function list(val) {
   return val.split(',').map(s => s.trim()).filter(Boolean)
 }
 
-const args = parseArgs(process.argv.slice(2))
+const args = parseArgs(rawArgs)
 const [cmd, ...rest] = args._
 
 async function main() {
```

---

### Incident Patch 13: `566b9310` (2026-10-03)
**Commit Message**: fix(ahrefs cli): default the report date and columns instead of requiring them

#642 made --date and --select mandatory, so the common call errored.
Date defaults to today (UTC); columns default to Ahrefs' documented
keyword and top-page fields. Tests moved to tests/clis and updated.

Refs #642

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `tests/clis/ahrefs-reports.test.cjs` (renamed, +7/-5)
```diff
@@ -2,7 +2,7 @@ const {test} = require('node:test')
 const assert = require('node:assert/strict')
 const {spawnSync} = require('node:child_process')
 const path = require('node:path')
-const cli = path.resolve(__dirname, '../tools/clis/ahrefs.js')
+const cli = path.resolve(__dirname, '../../tools/clis/ahrefs.js')
 function run(args, oracle='') {
   const code = `global.fetch = async (url, options) => {
     const assert = require('node:assert/strict'); const parsed = new URL(url);
@@ -20,15 +20,17 @@ for (const command of commands) test(`${command[0]} forwards an explicit report
   const oracle = "assert.equal(parsed.searchParams.get('date'),'2024-02-29');" + (command[0] === 'domain-rating' ? "assert.equal(parsed.searchParams.has('select'),false);" : "assert.equal(parsed.searchParams.get('select'),'keyword,url'); assert.equal(parsed.searchParams.get('country'),'us'); assert.equal(parsed.searchParams.get('limit'),'10');")
   assert.equal(output(run(args, oracle)).accepted,true)
 })
-for (const command of commands) test(`${command[0]} rejects missing report date before requesting paid data`, () => {
-  localError(run([...command,'--target','example.com','--select','url'], "throw new Error('unexpected paid request')"), /date/)
+for (const command of commands) test(`${command[0]} defaults a missing report date to today (UTC)`, () => {
+  const oracle = "assert.match(parsed.searchParams.get('date'), /^\\d{4}-\\d{2}-\\d{2}$/); assert.equal(parsed.searchParams.get('date'), new Date().toISOString().slice(0, 10));"
+  assert.equal(output(run([...command,'--target','example.com','--select','url'], oracle)).accepted,true)
 })
 test('invalid calendar dates and date flag without a value are rejected', () => {
   for (const date of ['2023-02-29','2026-04-31','2026-13-01','2026-1-01','not-a-date']) localError(run(['domain-rating','get','--target','example.com','--date',date], "throw new Error('unexpected paid request')"),/date/)
   localError(run(['domain-rating','get','--target','example.com','--date'], "throw new Error('unexpected paid request')"),/date/)
 })
-for (const command of commands.slice(1)) test(`${command[0]} requires explicit nonempty selected fields`, () => {
-  for (const suffix of [[],['--select'],['--select',''],['--select',' , ']]) localError(run([...command,'--target','example.com','--date','2026-09-30',...suffix], "throw new Error('unexpected paid request')"),/select/)
+for (const command of commands.slice(1)) test(`${command[0]} rejects empty selected fields and defaults when omitted`, () => {
+  for (const suffix of [['--select'],['--select',''],['--select',' , ']]) localError(run([...command,'--target','example.com','--date','2026-09-30',...suffix], "throw new Error('unexpected paid request')"),/select/)
+  assert.equal(output(run([...command,'--target','example.com','--date','2026-09-30'], "assert.ok(parsed.searchParams.get('select').split(',').length >= 3)")).accepted,true)
 })
 test('domain rating does not require selected fields', () => {
   assert.equal(output(run(['domain-rating','get','--target','example.com','--date','2026-09-30'], "assert.equal(parsed.searchParams.get('date'),'2026-09-30');")).accepted,true)
```

**File**: `tools/clis/ahrefs.js` (modified, +10/-9)
```diff
@@ -52,9 +52,9 @@ const args = parseArgs(rawArgs)
 const [cmd, sub, ...rest] = args._
 
 function reportDate() {
-  const date = args.date
+  const date = args.date === undefined ? new Date().toISOString().slice(0, 10) : args.date
   if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
-    throw new Error('--date required as a valid YYYY-MM-DD calendar date')
+    throw new Error('--date must be a valid YYYY-MM-DD calendar date')
   }
   const parsed = new Date(`${date}T00:00:00Z`)
   if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
@@ -63,9 +63,10 @@ function reportDate() {
   return date
 }
 
-function reportSelect() {
+function reportSelect(defaultColumns) {
+  if (args.select === undefined) return defaultColumns
   if (typeof args.select !== 'string' || !args.select.split(',').every(column => column.trim())) {
-    throw new Error('--select required as a comma-separated list of nonempty columns')
+    throw new Error('--select must be a comma-separated list of nonempty columns')
   }
   return args.select
 }
@@ -120,7 +121,7 @@ async function main() {
       switch (sub) {
         case 'organic': {
           if (!args.target) { result = { error: '--target required (domain or URL)' }; break }
-          const params = new URLSearchParams({ target: args.target, mode, date: reportDate(), select: reportSelect() })
+          const params = new URLSearchParams({ target: args.target, mode, date: reportDate(), select: reportSelect('keyword,volume,best_position,sum_traffic,best_position_url') })
           if (args.country) params.set('country', args.country)
           if (args.limit) params.set('limit', args.limit)
           result = await api('GET', `/site-explorer/organic-keywords?${params}`)
@@ -135,7 +136,7 @@ async function main() {
       switch (sub) {
         case 'list': {
           if (!args.target) { result = { error: '--target required (domain or URL)' }; break }
-          const params = new URLSearchParams({ target: args.target, mode, date: reportDate(), select: reportSelect() })
+          const params = new URLSearchParams({ target: args.target, mode, date: reportDate(), select: reportSelect('url,sum_traffic,keywords,top_keyword') })
           if (args.country) params.set('country', args.country)
           if (args.limit) params.set('limit', args.limit)
           result = await api('GET', `/site-explorer/top-pages?${params}`)
@@ -190,11 +191,11 @@ async function main() {
       result = {
         error: 'Unknown command',
         usage: {
-          'domain-rating': 'domain-rating get --target <domain> --date <YYYY-MM-DD>',
+          'domain-rating': 'domain-rating get --target <domain> [--date <YYYY-MM-DD>]',
           'backlinks': 'backlinks list --target <domain> [--mode <mode>] [--limit <n>]',
           'refdomains': 'refdomains list --target <domain> [--mode <mode>] [--limit <n>]',
-          'keywords': 'keywords organic --target <domain> --date <YYYY-MM-DD> --select <columns> [--country <cc>] [--limit <n>]',
-          'top-pages': 'top-pages list --target <domain> --date <YYYY-MM-DD> --select <columns> [--country <cc>] [--limit <n>]',
+          'keywords': 'keywords organic --target <domain> [--date <YYYY-MM-DD>] [--select <columns>] [--country <cc>] [--limit <n>]',
+          'top-pages': 'top-pages list --target <domain> [--date <YYYY-MM-DD>] [--select <columns>] [--country <cc>] [--limit <n>]',
           'keyword-overview': 'keyword-overview get --keywords <kw1,kw2> [--country <cc>]',
           'keyword-suggestions': 'keyword-suggestions get --keyword <keyword> [--country <cc>] [--limit <n>]',
           'serp': 'serp get --keyword <keyword> [--country <cc>]',
```

---

### Incident Patch 14: `d76f4133` (2026-10-03)
**Commit Message**: chore: release 2.11.13 (community content fixes)

Closes #594
Closes #599
Closes #507

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `.claude-plugin/marketplace.json` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
   },
   "metadata": {
     "description": "Marketing skills for AI agents — conversion optimization, copywriting, SEO, paid ads, and growth",
-    "version": "2.11.12",
+    "version": "2.11.13",
     "repository": "https://github.com/coreyhaines31/marketingskills"
   },
   "plugins": [
```

**File**: `.claude-plugin/plugin.json` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "marketing-skills",
   "description": "Marketing skills for AI agents — conversion optimization, copywriting, SEO, paid ads, ad creative, and growth",
-  "version": "2.11.12",
+  "version": "2.11.13",
   "author": {
     "name": "Corey Haines"
   },
```

**File**: `VERSIONS.md` (modified, +19/-8)
```diff
@@ -5,11 +5,11 @@ Current versions of all skills. Agents can compare against local versions to che
 | Skill | Version | Last Updated |
 |-------|---------|--------------|
 | ab-testing | 2.0.0 | 2026-05-05 |
-| ad-creative | 2.9.1 | 2026-10-02 |
-| ai-seo | 2.7.1 | 2026-10-02 |
+| ad-creative | 2.9.2 | 2026-10-02 |
+| ai-seo | 2.7.2 | 2026-10-02 |
 | analytics | 2.0.2 | 2026-10-02 |
 | aso | 2.0.1 | 2026-08-19 |
-| attribution | 1.1.1 | 2026-10-02 |
+| attribution | 1.1.2 | 2026-10-02 |
 | churn-prevention | 2.0.1 | 2026-10-02 |
 | co-marketing | 2.0.2 | 2026-10-02 |
 | cold-email | 2.1.0 | 2026-10-02 |
@@ -25,8 +25,8 @@ Current versions of all skills. Agents can compare against local versions to che
 | emails | 2.1.1 | 2026-10-02 |
 | events | 1.0.0 | 2026-08-23 |
 | free-tools | 2.0.1 | 2026-08-23 |
-| image | 2.0.1 | 2026-05-18 |
-| influencer-marketing | 1.1.1 | 2026-10-02 |
+| image | 2.0.2 | 2026-10-02 |
+| influencer-marketing | 1.1.2 | 2026-10-02 |
 | launch | 2.0.3 | 2026-10-02 |
 | lead-magnets | 2.0.0 | 2026-05-05 |
 | marketing-council | 1.0.0 | 2026-07-06 |
@@ -36,13 +36,13 @@ Current versions of all skills. Agents can compare against local versions to che
 | marketing-psychology | 2.0.0 | 2026-05-05 |
 | offers | 1.0.1 | 2026-08-23 |
 | onboarding | 2.0.1 | 2026-08-23 |
-| ads | 2.4.2 | 2026-10-02 |
+| ads | 2.4.3 | 2026-10-02 |
 | paywalls | 2.0.0 | 2026-05-05 |
 | popups | 2.0.0 | 2026-05-05 |
 | pricing | 2.1.2 | 2026-10-02 |
 | product-marketing | 2.1.0 | 2026-07-16 |
 | programmatic-seo | 2.0.0 | 2026-05-05 |
-| prospecting | 1.1.1 | 2026-10-02 |
+| prospecting | 1.1.2 | 2026-10-02 |
 | public-relations | 1.1.2 | 2026-10-02 |
 | referrals | 2.0.2 | 2026-10-02 |
 | revops | 2.0.1 | 2026-10-02 |
@@ -53,10 +53,20 @@ Current versions of all skills. Agents can compare against local versions to che
 | site-architecture | 2.0.0 | 2026-05-05 |
 | sms | 1.0.1 | 2026-10-02 |
 | social | 2.3.1 | 2026-10-02 |
-| video | 2.1.1 | 2026-10-02 |
+| video | 2.1.2 | 2026-10-02 |
 
 ## Recent Changes
 
+### 2.11.13 (2026-10-02)
+
+Community content fixes. Lands #595, #572, #508, #401, and #481 with contributor credit.
+
+- **Sora and GPT Image deprecations** (#595 by @MeowdyAGENT, closes #594): removes Sora 2 recommendations (OpenAI shut down Sora 2 and the Videos API on 24 Sep 2026) and updates image-model guidance. The model names now follow OpenAI's deprecations page: `gpt-image-1` retires 23 Oct 2026, with `gpt-image-2.5-sunburst` and `gpt-image-2.5-flare` as the replacements. Also fixes a broken link. ad-creative 2.9.2, image 2.0.2, video 2.1.2; the video eval now expects the shutdown rather than "reliability caveats."
+- **Search vs training crawlers** (#572 by @wonderwomancode, closes #599): ai-seo no longer treats GPTBot, ClaudeBot, and Google-Extended as citation bots. Discovery, user retrieval, training, and grounding are decided separately, with a valid robots.txt example. The author's own tool link was replaced with vendor docs. ai-seo 2.7.2.
+- **Attribution model availability** (#508 by @UberVero, closes #507): retired Google Ads/GA4 rule-based models, DDA volume, Calendly UTMs, MTA bias, and triangulated overrides. attribution 1.1.2, influencer-marketing 1.1.2.
+- **Brand vs non-brand** (#401 by @mharnett): optimize Google Ads on non-brand ROAS and report blended separately. ads 2.4.3.
+- **Typo** (#481 by @tim703223-glitch): "Pre-Seed/Seed" in saas-prospecting. prospecting 1.1.2.
+
 ### 2.11.12 (2026-10-02)
 
 Community fixes, links and security. Lands #581, #583, #518, #542, #543, and #540 with contributor credit, plus version bumps.
@@ -147,6 +157,7 @@ Evidence discipline for the three skills that make claims about competitors. Com
 
 - **ai-seo** (2.4.0 → 2.5.0): new `references/format-volatility.md` — the citation-*format* volatility axis, companion to agent-readiness.md's citation-*source* volatility. Anchored on the **ChatGPT 5.6 format shift** (Aug 2026, Peec AI data via Tomek Rudzki and Lily Ray): fan-out queries dropped the "vs / comparison / top / best / reviews" modifiers while `site:` and "official" searches surged, and citations by page type fell −50.5% for listicles (15.77% → 7.80%) and −32.1% for comparison pages (9.08% → 6.17%) — the two formats companies scaled for GEO, demoted in one release. Covers what changes (stop justifying scaled listicle/comparison production with "wins AI citations"; owned "official" pages rising as the citable class) and what doesn't (comparisons still convert humans and still earn citations on Google AIO / Gemini / Perplexity — a per-platform format table replaces one-size-fits-all advice). Adds **LinkedIn as a citation surface** from LinkedIn's own AEO guide (via Chris Long, platform-reported: most-cited outlet for professional searches; Articles out-cite Posts ~60/40; first words of a post become the URL slug — front-load the target phrase), a **DIY ChatGPT fan-out extraction** diagnostic (DevTools → network payload → literal background queries; 
```

**File**: `skills/ad-creative/SKILL.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 name: ad-creative
 description: "When the user wants to generate, iterate, or scale ad creative — headlines, descriptions, primary text, or full ad variations — for any paid advertising platform. Also use when the user mentions 'ad copy variations,' 'ad creative,' 'generate headlines,' 'RSA headlines,' 'bulk ad copy,' 'ad iterations,' 'creative testing,' 'write me some ads,' 'Facebook ad copy,' 'Google ad headlines,' 'LinkedIn ad text,' 'static ads,' 'ad templates,' 'iMessage ad,' 'chat reveal ad,' 'ChatGPT ad,' 'Apple Notes ad,' 'AirDrop ad,' 'creative strategy,' 'creative roadmap,' 'creative retro,' 'hook writing,' 'creative review page,' 'present ad creative for approval,' 'motion video ad,' 'faceless video ad,' 'UGC ad,' 'greenscreen ad,' 'TikTok/Reels ad format,' 'which ad format to make,' 'Meta ad format tier list,' or 'creative format taxonomy.' Use it to produce or iterate ad copy at scale. Copy avoids AI tells like 'it's not X, it's Y' reveals. For campaign strategy and targeting, see ads. For landing page copy, see copywriting."
 metadata:
-  version: 2.9.1
+  version: 2.9.2
 ---
 
 # Ad Creative
```

**File**: `skills/ads/SKILL.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 name: ads
 description: "When the user wants help with paid advertising campaigns on Google Ads, Meta (Facebook/Instagram), LinkedIn, Twitter/X, or other ad platforms. Also use when the user mentions 'PPC,' 'paid media,' 'ROAS,' 'CPA,' 'ad campaign,' 'retargeting,' 'audience targeting,' 'Google Ads,' 'Facebook ads,' 'LinkedIn ads,' 'ad budget,' 'cost per click,' 'ad spend,' 'should I run ads,' 'ABM,' 'account-based marketing,' 'B2B ads,' 'lead quality,' 'negative keywords,' 'Performance Max,' 'thought leader ads,' 'when should I kill an ad,' 'search terms report,' 'wasted spend,' or 'is this campaign working.' Use this for campaign strategy, audience targeting, bidding, and optimization. For bulk ad creative generation and iteration, see ad-creative. For landing page optimization, see cro."
 metadata:
-  version: 2.4.2
+  version: 2.4.3
 ---
 
 # Paid Ads
```

**File**: `skills/ai-seo/SKILL.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 name: ai-seo
 description: "When the user wants to optimize content for AI search engines, get cited by LLMs, or appear in AI-generated answers. Also use when the user mentions 'AI SEO,' 'AEO,' 'GEO,' 'LLMO,' 'answer engine optimization,' 'generative engine optimization,' 'LLM optimization,' 'AI Overviews,' 'optimize for ChatGPT,' 'optimize for Perplexity,' 'AI citations,' 'AI visibility,' 'zero-click search,' 'how do I show up in AI answers,' 'LLM mentions,' 'optimize for Claude/Gemini,' 'llms.txt,' 'llms-full.txt,' 'OKF,' 'Open Knowledge Format,' 'knowledge bundle,' 'agent-readable site,' 'agent readiness,' 'is my site agent-ready,' 'WebMCP,' 'do listicles still work for AI,' 'ChatGPT stopped citing comparison pages,' 'how do LLMs see our brand,' 'LinkedIn for AEO,' or 'AI citation format shift.' Use this whenever someone wants their content to be cited or surfaced by AI assistants and AI search engines. For traditional technical and on-page SEO audits, see seo-audit. For structured data implementation, see schema."
 metadata:
-  version: 2.7.1
+  version: 2.7.2
 ---
 
 # AI SEO
```

**File**: `skills/attribution/SKILL.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 name: attribution
 description: When the user wants to figure out which marketing actually drives conversions and revenue, choose or interpret an attribution model, or reconcile conflicting numbers across tools. Also use when the user mentions "attribution," "attribution model," "first-touch vs last-touch," "multi-touch," "which channel drives revenue," "what's my real CAC," "my dashboards disagree," "Google/Meta says X but GA says Y," "media mix model," "MMM," "incrementality," "geo lift," "holdout test," "how did you hear about us," "self-reported attribution," "dark social," or wants to instrument attribution themselves — "stitch my bookings to their source," "SavvyCal/Calendly attribution," "close the identify gap," "track conversions on a third-party domain," "first-party / self-hosted attribution." For event tracking setup and UTMs, see analytics. For ad-platform pixels/CAPI, see ads. For pipeline and CRM revenue reporting, see revops. For the AI-search attribution blind spot, see ai-seo.
 metadata:
-  version: 1.1.1
+  version: 1.1.2
 ---
 
 # Attribution
```

**File**: `skills/image/SKILL.md` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@
 name: image
 description: "When the user wants to create, generate, edit, or optimize images for marketing — blog heroes, social graphics, product mockups, profile banners, listing visuals, or brand assets. Also use when the user mentions 'AI image generation,' 'generate an image,' 'create a graphic,' 'product mockup,' 'hero image,' 'social media graphic,' 'banner image,' 'cover photo,' 'profile banner,' 'listing screenshot,' 'Flux,' 'Flux Kontext,' 'Midjourney,' 'DALL-E,' 'GPT Image,' 'ChatGPT Images,' 'Ideogram,' 'Gemini image,' 'Nano Banana,' 'Recraft,' 'Stable Diffusion,' 'Canva,' 'Figma,' 'image optimization,' 'compress images,' 'WebP,' or 'OG image.' Use this for general-purpose marketing image creation and optimization. For paid ad image creative and platform-specific ad specs, see ad-creative. For video production, see video."
 metadata:
-  version: 2.0.1
+  version: 2.0.2
 ---
 
 # Image
```

---

### Incident Patch 15: `bce65a27` (2026-10-03)
**Commit Message**: fix: use OpenAI's official image replacements and drop a self-promo link

#595 named gpt-image-2; OpenAI's deprecations page recommends
gpt-image-2.5-sunburst and -flare. #572 linked its author's own
project; the guidance now points to vendor docs. The video eval no
longer expects Sora caveats now that Sora 2 is shut down.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `skills/ai-seo/references/platform-ranking-factors.md` (modified, +1/-1)
```diff
@@ -141,7 +141,7 @@ User-triggered fetchers such as `ChatGPT-User`, `Claude-User`, and `Perplexity-U
 
 Verify the current names and consequences in the vendors' maintained documentation: [OpenAI](https://developers.openai.com/api/docs/bots), [Perplexity](https://docs.perplexity.ai/docs/resources/perplexity-crawlers), [Anthropic](https://privacy.anthropic.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler), and [Google](https://developers.google.com/crawling/docs/crawlers-fetchers/google-common-crawlers).
 
-For implementation, inspect `/robots.txt` manually first. Optional helpers include vendor testing tools and the [open-source AI Crawler Access Reference](https://github.com/alternatefutures/ai-crawler-access-reference), which includes a deterministic policy generator and is maintained by this contribution's author.
+For implementation, inspect `/robots.txt` manually first. Optional helpers include each vendor's own crawler documentation and robots.txt testing tools.
 
 ---
 
```

**File**: `skills/image/SKILL.md` (modified, +1/-1)
```diff
@@ -63,7 +63,7 @@ Generate original images from text prompts. The fastest way to create unique mar
 | **Recraft V3** | Vector + brand-consistent illustrations, design assets | Strong | [Recraft API](https://www.recraft.ai/docs) | Per-credit |
 | **Stable Diffusion 3.5 / SDXL** | Self-hosted, customizable, fine-tunable | Varies | Open source | Free (GPU costs) |
 
-**Note:** DALL-E 3 is fully deprecated. OpenAI's current image models are the GPT Image / ChatGPT Images family (`gpt-image-2` and later).
+**Note:** DALL-E 3 is fully deprecated. OpenAI's current image models are the GPT Image family. `gpt-image-1` retires on 23 Oct 2026 and `gpt-image-1-mini` and `gpt-image-1.5` on 1 Dec 2026; OpenAI's recommended replacements are `gpt-image-2.5-sunburst` and `gpt-image-2.5-flare` (check OpenAI's deprecations page for the current list).
 
 ### When to Use Which
 
```

**File**: `skills/image/references/ai-image-prompting.md` (modified, +1/-1)
```diff
@@ -157,7 +157,7 @@ modern SaaS product presentation style,
 
 ### GPT Image (OpenAI)
 
-- Current models: `gpt-image-2` and variants (DALL-E 3 is deprecated)
+- Current models: `gpt-image-2.5-sunburst` and `gpt-image-2.5-flare` (the `gpt-image-1` family retires in late 2026; DALL-E 3 is deprecated)
 - Integrated with ChatGPT — conversational image generation
 - Good at following detailed prompts
 - Decent text rendering (behind Ideogram, comparable to Gemini)
```

**File**: `skills/video/evals/evals.json` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@
         "Provides structured video prompt example",
         "Follows Subject + Action + Camera + Style + Mood pattern",
         "Warns about common prompt mistakes",
-        "Notes Sora reliability caveats"
+        "Notes that Sora 2 and the Videos API were shut down (Sept 2026) and doesn't recommend them"
       ],
       "files": []
     },
```

#### Recent Merged Pull Requests:
- **PR #788** (2026-10-07): feat: SEO operator, rankings push, title tags, SERP-gap refreshes, shipped-changes content (2.11.19) (@coreyhaines31)
- **PR #667** (2026-10-03): fix: working Hyperframes example and creative-review template fixes (2.11.17) (@coreyhaines31)
- **PR #660** (2026-10-03): feat: OpenAI Codex plugin + non-interactive install docs (2.11.16) (@coreyhaines31)
- **PR #659** (2026-10-03): feat: fold four community contributions into existing skills (2.11.15) (@coreyhaines31)
- **PR #658** (2026-10-03): chore: land community tool and guide contributions (2.11.14) (@coreyhaines31)
- **PR #657** (2026-10-03): chore: land community content fixes (2.11.13) (@coreyhaines31)
- **PR #656** (2026-10-02): chore: land community link, security and validator fixes (2.11.12) (@coreyhaines31)
- **PR #655** (2026-10-02): chore: land 31 reviewed community PRs (CLI fixes, docs, validator) (@coreyhaines31)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
