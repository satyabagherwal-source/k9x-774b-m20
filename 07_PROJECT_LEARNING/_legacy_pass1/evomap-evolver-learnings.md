# Forensic Learning Record (Deep Inspection): EvoMap/evolver

> **Canonical Artifact**: `07_PROJECT_LEARNING/evomap-evolver-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/EvoMap/evolver](https://github.com/EvoMap/evolver))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:19:45.866Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `EvoMap/evolver`
- **Description**: The GEP-powered self-evolving engine for AI agents. Auditable evolution with Genes, Capsules, and Events. | evomap.ai
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 9130 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli-options.js`
```
'use strict';

const path = require('path');

const PROXY_PATH_FLAGS = new Map([
  ['--home', 'home'],
  ['--store', 'store'],
  ['--settings', 'settings'],
  ['--env-file', 'envFile'],
]);

function expandHomePath(value, env = process.env) {
  if (value === '~') return env.HOME || require('os').homedir();
  if (value.startsWith('~/') || value.startsWith('~\\')) {
    return path.join(env.HOME || require('os').homedir(), value.slice(2));
  }
  return value;
}

function parseProxyCliPathOptions(argv, env = process.env) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = String(argv[index]);
    const equalsIndex = arg.indexOf('=');
    const flag = equalsIndex >= 0 ? arg.slice(0, equalsIndex) : arg;
    const key = PROXY_PATH_FLAGS.get(flag);
    if (!key) continue;

    const value = equalsIndex >= 0 ? arg.slice(equalsIndex + 1) : argv[++index];
    if (!value || !String(value).trim() || (equalsIndex < 0 && String(value).startsWith('-'))) {
      throw new Error(flag + ' requires a path');
    }
    options[key] = path.resolve(expandHomePath(String(value).trim(), env));
  }
  return options;
}

function applyProxyCliPathOptions(options, env = process.env) {
  if (options.envFile) env.EVOLVER_ENV_FILE = options.envFile;
  if (options.home) {
    env.EVOMAP_DIR = options.home;
    env.EVOLVER_HOME = options.home;
    env.EVOMAP_HOME = options.home;
    env.EVOLVER_SETTINGS_DIR = options.home;
    env.EVOLVER_PROXY_STORE = path.join(options.home, 'mailbox');
    env.EVOLVER_PROXY_SETTINGS_FILE = path.join(options.home, 'settings.json');
    env.EVOMAP_PROXY_TRACE_FILE = path.join(options.home, 'proxy', 'traces', 'proxy-traces.jsonl');
  }
  if (options.store) env.EVOLVER_PROXY_STORE = options.store;
  if (options.settings) env.EVOLVER_PROXY_SETTINGS_FILE = options.settings;
  return options;
}

function prepareProxyCliEnvironment(argv, env = process.env, dotenv = require('dotenv')) {
  const options = parseProxyCliPathOptions(argv, env);
  let envFile = { loaded: false, error: null };
  const selectedEnvFile = options.envFile || env.EVOLVER_ENV_FILE;
  if (selectedEnvFile) {
    const resolvedEnvFile = path.resolve(expandHomePath(String(selectedEnvFile).trim(), env));
    env.EVOLVER_ENV_FILE = resolvedEnvFile;
    const result = dotenv.config({ path: resolvedEnvFile, processEnv: env });
    envFile = { loaded: !result.error, error: result.error || null };
  }
  applyProxyCliPathOptions(options, env);
  return { options, envFile };
}

module.exports = {
  applyProxyCliPathOptions,
  expandHomePath,
  parseProxyCliPathOptions,
  prepareProxyCliEnvironment,
};

```

### Core Architecture Module: `index.js`
```
#!/usr/bin/env node
function _parseBootstrapSemver(version) {
  const match = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(version || ''));
  if (!match) return null;
  return {
    major: match[1],
    minor: match[2],
    patch: match[3],
    prerelease: match[4] ? match[4].split('.') : [],
  };
}

function _compareBootstrapNumeric(left, right) {
  if (left.length !== right.length) return left.length - right.length;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function _compareBootstrapPrerelease(left, right) {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);
  if (leftNumeric && rightNumeric) return _compareBootstrapNumeric(left, right);
  if (leftNumeric) return -1;
  if (rightNumeric) return 1;
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function _compareBootstrapSemver(left, right) {
  const a = _parseBootstrapSemver(left);
  const b = _parseBootstrapSemver(right);
  if (!a || !b) return null;
  for (const key of ['major', 'minor', 'patch']) {
    const cmp = _compareBootstrapNumeric(a[key], b[key]);
    if (cmp !== 0) return cmp;
  }
  if (!a.prerelease.length && !b.prerelease.length) return 0;
  if (!a.prerelease.length) return 1;
  if (!b.prerelease.length) return -1;
  const max = Math.max(a.prerelease.length, b.prerelease.length);
  for (let i = 0; i < max; i++) {
    if (a.prerelease[i] === undefined) return -1;
    if (b.prerelease[i] === undefined) return 1;
    const cmp = _compareBootstrapPrerelease(a.prerelease[i], b.prerelease[i]);
    if (cmp !== 0) return cmp;
  }
  return 0;
}

function _bootstrapVersionSatisfies(currentVersion, requiredVersion) {
  if (String(currentVersion || '') === String(requiredVersion || '')) return true;
  const cmp = _compareBootstrapSemver(currentVersion, requiredVersion);
  return cmp !== null && cmp >= 0;
}

function _failClosedForceUpdateBootstrap(backupName, entryName, error) {
  const detail = error && error.message ? error.message : String(error || 'unknown error');
  console.error('[ForceUpdate] Bootstrap recovery failed for ' + backupName +
    (entryName ? ' while restoring ' + entryName : '') + ': ' + detail);
  console.error('[ForceUpdate] Refusing to continue startup; recovery backup and journal were left in place.');
  process.exit(1);
}

function _recoverInterruptedForceUpdateBootstrap() {
  const fs = require('fs');
  const path = require('path');
  const installRoot = __dirname;
  const backupPrefix = '.evolver-force-update-backup-';
  const journalName = '.evolver-force-update-journal.json';
  let backups = [];
  try {
    backups = fs.readdirSync(installRoot)
      .filter((name) => name.startsWith(backupPrefix))
      .sort()
      .reverse();
  } catch (_) {
    return false;
  }
  for (const backupName of backups) {
    const backupRoot = path.join(installRoot, backupName);
    const journalPath = path.join(backupRoot, journalName);
    let journal = null;
    try {
      journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
    } catch (_) {
      // Not a force-update recovery journal; leave unrelated directories alone.
      continue;
    }
    if (!journal || journal.state !== 'precommit' || !journal.requiredVersion) continue;
    let currentVersion = '';
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(installRoot, 'package.json'), 'utf8'));
      currentVersion = pkg && pkg.version ? String(pkg.version) : '';
    } catch (_) {
      // If the package marker is unreadable, prefer restoring the old payload.
    }
    if (_bootstrapVersionSatisfies(currentVersion, String(journal.requiredVersion))) {
      try { fs.rmSync(backupRoot, { recursive: true, force: true }); } catch (_) {
        // Cleanup failure is non-fatal; normal startup can continue.
      }
      continue;
    }
    let entries = [];
    try {
      entries = fs.readdirSync(backupRoot, { withFileTypes: true });
    } catch (readErr) {
      _failClosedForceUpdateBootstrap(backupName, '', readErr);
    }
    for (const entry of entries) {
      if (entry.name === journalName) continue;
      const livePath = path.join(installRoot, entry.name);
      const backupPath = path.join(backupRoot, entry.name);
      try {
        if (entry.name === 'index.js') {
          const tmpPath = livePath + '.' + process.pid + '.recover-tmp';
          try { fs.rmSync(tmpPath, { force: true }); } catch (_) {}
          fs.copyFileSync(backupPath, tmpPath);
          try {
            const backupStat = fs.statSync(backupPath);
            fs.chmodSync(tmpPath, backupStat.mode & 0o777);
          } catch (_) {
            // Recovery can proceed without mode restoration; npm/service launches
            // normally use `node index.js` after an interrupted update.
          }
          fs.renameSync(tmpPath, livePath);
          fs.rmSync(backupPath, { force: true });
        } else {
          fs.rmSync(livePath, { recursive: true, force: true });
          fs.renameSync(backupPath, livePath);
        }
      } catch (restoreErr) {
        _failClosedForceUpdateBootstrap(backupName, entry.name, restoreErr);
      }
    }
    try { fs.rmSync(backupRoot, { recursive: true, force: true }); } catch (_) {
      // Best-effort cleanup; recovery already restored the payload.
    }
    console.warn('[ForceUpdate] Recovered interrupted install from ' + backupName);
    return true;
  }
  return false;
}

_recoverInterruptedForceUpdateBootstrap();

function _printProxyTokenUsage(out = process.stderr) {
  out.write('Usage: node index.js proxy-token [--settings FILE]\n');
}

function _readProxyTokenFromSettingsFile(fs, settingsFile) {
  try {
    const parsed = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
    return parsed && parsed.proxy && typeof parsed.proxy.token === 'string'
      ? parsed.proxy.token
      : '';
  } catch {
    return '';
  }
}

// `proxy-token` is a credential helper for Codex. Handle it before loading any
// project .env so a workspace cannot change EVOLVER_SETTINGS_DIR or other local
// state used to find the proxy token.
if (process.argv[2] === 'proxy-token') {
  try {
    const _fs = require('fs');
    const _os = require('os');
    const _path = require('path');
    let settingsFile = '';
    for (let i = 3; i < process.argv.length; i++) {
      const arg = process.argv[i];
      if (arg === '-h' || arg === '--help') {
        _printProxyTokenUsage(process.stdout);
        process.exit(0);
      }
      if (arg === '--settings') {
        if (!process.argv[i + 1]) {
          _printProxyTokenUsage();
          console.error('[proxy-token] missing value for --settings');
          process.exit(2);
        }
        settingsFile = process.argv[i + 1];
        i++;
        continue;
      }
      _printProxyTokenUsage();
      console.error('[proxy-token] unknown argument');
      process.exit(2);
    }
    const defaultSettingsFile = _path.join(
      process.env.EVOLVER_SETTINGS_DIR || _path.join(_os.homedir(), '.evolver'),
      'settings.json',
    );
    const token = _readProxyTokenFromSettingsFile(_fs, settingsFile || defaultSettingsFile);
    if (!token) {
      console.error('[proxy-token] no active proxy token found; start evolver with EVOMAP_PROXY=1 first');
      process.exit(1);
    }
    process.stdout.write(token + '\n');
    process.exit(0);
  } catch (e) {
    console.error('[proxy-token] Failed:', e && e.message || e);
    process.exit(1);
  }
}

const {
  applyProxyCliPathOptions,
  prepareProxyCliEnvironment,
} = require('./cli-options');

let _proxyCliBootstrap = { options: {}, envFile: { loaded: false, error: null } };
let _proxyCliBootstrapError = null;
try {
  _proxyCliBootstrap = prepareProxyCliEnvironment(process.argv.slice(2), process.env);
} catch (error) {
  _proxyCliBootstrapError = error;
}

// Load .env BEFORE any internal require so that a2aProtocol and ATP
// modules see A2A_NODE_SECRET / A2A_NODE_ID 
```

### Core Architecture Module: `scripts/a2a_export.js`
```
const { loadGenes, loadCapsules, readAllEvents } = require('../src/gep/assetStore');
const { exportEligibleCapsules, exportEligibleGenes, isAllowedA2AAsset } = require('../src/gep/a2a');
const { buildPublish, buildHello, getTransport } = require('../src/gep/a2aProtocol');
const { computeAssetId, SCHEMA_VERSION } = require('../src/gep/contentHash');

function main() {
  var args = process.argv.slice(2);
  var asJson = args.includes('--json');
  var asProtocol = args.includes('--protocol');
  var withHello = args.includes('--hello');
  var persist = args.includes('--persist');
  var includeEvents = args.includes('--include-events');

  var capsules = loadCapsules();
  var genes = loadGenes();
  var events = readAllEvents();

  // Build eligible list: Capsules (filtered) + Genes (filtered) + Events (opt-in)
  var eligibleCapsules = exportEligibleCapsules({ capsules: capsules, events: events });
  var eligibleGenes = exportEligibleGenes({ genes: genes });
  var eligible = eligibleCapsules.concat(eligibleGenes);

  if (includeEvents) {
    var eligibleEvents = (Array.isArray(events) ? events : []).filter(function (e) {
      return isAllowedA2AAsset(e) && e.type === 'EvolutionEvent';
    });
    for (var ei = 0; ei < eligibleEvents.length; ei++) {
      var ev = eligibleEvents[ei];
      if (!ev.schema_version) ev.schema_version = SCHEMA_VERSION;
      if (!ev.asset_id) { try { ev.asset_id = computeAssetId(ev); } catch (e) {} }
    }
    eligible = eligible.concat(eligibleEvents);
  }

  if (withHello || asProtocol) {
    var hello = buildHello({ geneCount: genes.length, capsuleCount: capsules.length });
    process.stdout.write(JSON.stringify(hello) + '\n');
    if (persist) { try { getTransport().send(hello); } catch (e) {} }
  }

  if (asProtocol) {
    for (var i = 0; i < eligible.length; i++) {
      var msg = buildPublish({ asset: eligible[i] });
      process.stdout.write(JSON.stringify(msg) + '\n');
      if (persist) { try { getTransport().send(msg); } catch (e) {} }
    }
    return;
  }

  if (asJson) {
    process.stdout.write(JSON.stringify(eligible, null, 2) + '\n');
    return;
  }

  for (var j = 0; j < eligible.length; j++) {
    process.stdout.write(JSON.stringify(eligible[j]) + '\n');
  }
}

try { main(); } catch (e) {
  process.stderr.write((e && e.message ? e.message : String(e)) + '\n');
  process.exit(1);
}

```

### Core Architecture Module: `scripts/a2a_ingest.js`
```
var fs = require('fs');
var assetStore = require('../src/gep/assetStore');
var a2a = require('../src/gep/a2a');
var memGraph = require('../src/gep/memoryGraphAdapter');
var contentHash = require('../src/gep/contentHash');
var a2aProto = require('../src/gep/a2aProtocol');

function readStdin() {
  try { return fs.readFileSync(0, 'utf8'); } catch (e) { return ''; }
}

function parseSignalsFromEnv() {
  var raw = process.env.A2A_SIGNALS || '';
  if (!raw) return [];
  try {
    var maybe = JSON.parse(raw);
    if (Array.isArray(maybe)) return maybe.map(String).filter(Boolean);
  } catch (e) {}
  return String(raw).split(',').map(function (s) { return s.trim(); }).filter(Boolean);
}

function main() {
  var args = process.argv.slice(2);
  var inputPath = '';
  for (var i = 0; i < args.length; i++) {
    if (args[i] && !args[i].startsWith('--')) { inputPath = args[i]; break; }
  }
  var source = process.env.A2A_SOURCE || 'external';
  var factor = Number.isFinite(Number(process.env.A2A_EXTERNAL_CONFIDENCE_FACTOR))
    ? Number(process.env.A2A_EXTERNAL_CONFIDENCE_FACTOR) : 0.6;

  var text = inputPath ? a2a.readTextIfExists(inputPath) : readStdin();
  var parsed = a2a.parseA2AInput(text);
  var signals = parseSignalsFromEnv();

  var accepted = 0;
  var rejected = 0;
  var emitDecisions = process.env.A2A_EMIT_DECISIONS === 'true';

  for (var j = 0; j < parsed.length; j++) {
    var obj = parsed[j];
    if (!a2a.isAllowedA2AAsset(obj)) continue;

    if (obj.asset_id && typeof obj.asset_id === 'string') {
      if (!contentHash.verifyAssetId(obj)) {
        rejected += 1;
        if (emitDecisions) {
          try {
            var dm = a2aProto.buildDecision({ assetId: obj.asset_id, localId: obj.id, decision: 'reject', reason: 'asset_id integrity check failed' });
            a2aProto.getTransport().send(dm);
          } catch (e) {}
        }
        continue;
      }
    }

    var staged = a2a.lowerConfidence(obj, { source: source, factor: factor });
    if (!staged) continue;

    assetStore.appendExternalCandidateJsonl(staged);
    try { memGraph.recordExternalCandidate({ asset: staged, source: source, signals: signals }); } catch (e) {}

    if (emitDecisions) {
      try {
        var dm2 = a2aProto.buildDecision({ assetId: staged.asset_id, localId: staged.id, decision: 'quarantine', reason: 'staged as external candidate' });
        a2aProto.getTransport().send(dm2);
      } catch (e) {}
    }

    accepted += 1;
  }

  process.stdout.write('accepted=' + accepted + ' rejected=' + rejected + '\n');
}

try { main(); } catch (e) {
  process.stderr.write((e && e.message ? e.message : String(e)) + '\n');
  process.exit(1);
}

```

### Core Architecture Module: `scripts/a2a_promote.js`
```
var assetStore = require('../src/gep/assetStore');
var solidifyMod = require('../src/gep/solidify');
var contentHash = require('../src/gep/contentHash');
var a2aProto = require('../src/gep/a2aProtocol');

function parseArgs(argv) {
  var out = { flags: new Set(), kv: new Map(), positionals: [] };
  for (var i = 0; i < argv.length; i++) {
    var a = argv[i];
    if (!a) continue;
    if (a.startsWith('--')) {
      var eq = a.indexOf('=');
      if (eq > -1) { out.kv.set(a.slice(2, eq), a.slice(eq + 1)); }
      else {
        var key = a.slice(2);
        var next = argv[i + 1];
        if (next && !String(next).startsWith('--')) { out.kv.set(key, next); i++; }
        else { out.flags.add(key); }
      }
    } else { out.positionals.push(a); }
  }
  return out;
}

function main() {
  var args = parseArgs(process.argv.slice(2));
  var id = String(args.kv.get('id') || '').trim();
  var typeRaw = String(args.kv.get('type') || '').trim().toLowerCase();
  var validated = args.flags.has('validated') || String(args.kv.get('validated') || '') === 'true';
  var limit = Number.isFinite(Number(args.kv.get('limit'))) ? Number(args.kv.get('limit')) : 500;

  if (!id || !typeRaw) throw new Error('Usage: node scripts/a2a_promote.js --type capsule|gene|event --id <id> --validated');
  if (!validated) throw new Error('Refusing to promote without --validated (local verification must be done first).');

  var type = typeRaw === 'capsule' ? 'Capsule' : typeRaw === 'gene' ? 'Gene' : typeRaw === 'event' ? 'EvolutionEvent' : '';
  if (!type) throw new Error('Invalid --type. Use capsule, gene, or event.');

  var external = assetStore.readRecentExternalCandidates(limit);
  var candidate = null;
  for (var i = 0; i < external.length; i++) {
    if (external[i] && external[i].type === type && String(external[i].id) === id) { candidate = external[i]; break; }
  }
  if (!candidate) throw new Error('Candidate not found in external zone: type=' + type + ' id=' + id);

  if (type === 'Gene') {
    var validation = Array.isArray(candidate.validation) ? candidate.validation : [];
    for (var j = 0; j < validation.length; j++) {
      var c = String(validation[j] || '').trim();
      if (!c) continue;
      if (!solidifyMod.isValidationCommandAllowed(c)) {
        throw new Error('Refusing to promote Gene ' + id + ': validation command rejected by safety check: "' + c + '". Only node/npm/npx commands without shell operators are allowed.');
      }
    }
  }

  var promoted = JSON.parse(JSON.stringify(candidate));
  if (!promoted.a2a || typeof promoted.a2a !== 'object') promoted.a2a = {};
  promoted.a2a.status = 'promoted';
  promoted.a2a.promoted_at = new Date().toISOString();
  if (!promoted.schema_version) promoted.schema_version = contentHash.SCHEMA_VERSION;
  promoted.asset_id = contentHash.computeAssetId(promoted);

  var emitDecisions = process.env.A2A_EMIT_DECISIONS === 'true';

  if (type === 'EvolutionEvent') {
    assetStore.appendEventJsonl(promoted);
    if (emitDecisions) {
      try {
        var dmEv = a2aProto.buildDecision({ assetId: promoted.asset_id, localId: id, decision: 'accept', reason: 'event promoted for provenance tracking' });
        a2aProto.getTransport().send(dmEv);
      } catch (e) {}
    }
    process.stdout.write('promoted_event=' + id + '\n');
    return;
  }

  if (type === 'Capsule') {
    assetStore.appendCapsule(promoted);
    if (emitDecisions) {
      try {
        var dm = a2aProto.buildDecision({ assetId: promoted.asset_id, localId: id, decision: 'accept', reason: 'capsule promoted after validation' });
        a2aProto.getTransport().send(dm);
      } catch (e) {}
    }
    process.stdout.write('promoted_capsule=' + id + '\n');
    return;
  }

  var localGenes = assetStore.loadGenes();
  var exists = false;
  for (var k = 0; k < localGenes.length; k++) {
    if (localGenes[k] && localGenes[k].type === 'Gene' && String(localGenes[k].id) === id) { exists = true; break; }
  }
  if (exists) {
    if (emitDecisions) {
      try {
        var dm2 = a2aProto.buildDecision({ assetId: promoted.asset_id, localId: id, decision: 'reject', reason: 'local gene with same ID already exists' });
        a2aProto.getTransport().send(dm2);
      } catch (e) {}
    }
    process.stdout.write('conflict_keep_local_gene=' + id + '\n');
    return;
  }

  assetStore.upsertGene(promoted);
  if (emitDecisions) {
    try {
      var dm3 = a2aProto.buildDecision({ assetId: promoted.asset_id, localId: id, decision: 'accept', reason: 'gene promoted after safety audit' });
      a2aProto.getTransport().send(dm3);
    } catch (e) {}
  }
  process.stdout.write('promoted_gene=' + id + '\n');
}

try { main(); } catch (e) {
  process.stderr.write((e && e.message ? e.message : String(e)) + '\n');
  process.exit(1);
}

```

### Core Architecture Module: `scripts/analyze_by_skill.js`
```
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const LOG_FILE = path.join(REPO_ROOT, 'evolution_history_full.md');
const OUT_FILE = path.join(REPO_ROOT, 'evolution_detailed_report.md');

function analyzeEvolution() {
    if (!fs.existsSync(LOG_FILE)) {
        console.error("Source file missing.");
        return;
    }

    const content = fs.readFileSync(LOG_FILE, 'utf8');
    // Split by divider
    const entries = content.split('---').map(e => e.trim()).filter(e => e.length > 0);

    const skillUpdates = {}; // Map<SkillName, Array<Changes>>
    const generalUpdates = []; // Array<Changes>

    // Regex to detect skills/paths
    // e.g. `skills/feishu-card/send.js` or **Target**: `skills/git-sync`
    const skillRegex = /skills\/([a-zA-Z0-9\-_]+)/;
    const actionRegex = /Action:\s*([\s\S]*?)(?=\n\n|\n[A-Z]|$)/i; // Capture Action text
    const statusRegex = /Status:\s*\[?([A-Z\s_]+)\]?/i;

    entries.forEach(entry => {
        // Extract basic info
        const statusMatch = entry.match(statusRegex);
        const status = statusMatch ? statusMatch[1].trim().toUpperCase() : 'UNKNOWN';
        
        // Skip routine checks if we want a *detailed evolution* report (focus on changes)
        // But user asked for "what happened", so routine scans might be boring unless they found something.
        // Let's filter out "STABILITY" or "RUNNING" unless there is a clear "Mutated" or "Fixed" keyword.
        const isInteresting = 
            entry.includes('Fixed') || 
            entry.includes('Hardened') || 
            entry.includes('Optimized') || 
            entry.includes('Patched') || 
            entry.includes('Created') || 
            entry.includes('Added') ||
            status === 'SUCCESS' ||
            status === 'COMPLETED';

        if (!isInteresting) return;

        // Find associated skill
        const skillMatch = entry.match(skillRegex);
        let skillName = 'General / System';
        if (skillMatch) {
            skillName = skillMatch[1];
        } else {
            // Try heuristics
            if (entry.toLowerCase().includes('feishu card')) skillName = 'feishu-card';
            else if (entry.toLowerCase().includes('git sync')) skillName = 'git-sync';
            else if (entry.toLowerCase().includes('logger')) skillName = 'interaction-logger';
            else if (entry.toLowerCase().includes('evolve')) skillName = 'capability-evolver';
        }

        // Extract description
        let description = "";
        const actionMatch = entry.match(actionRegex);
        if (actionMatch) {
            description = actionMatch[1].trim();
        } else {
            // Fallback: take lines that look like bullet points or text after header
            const lines = entry.split('\n');
            description = lines.filter(l => l.match(/^[•\-\*]|\w/)).slice(1).join('\n').trim();
        }

        // Clean up description (remove duplicate "Action:" prefix if captured)
        description = description.replace(/^Action:\s*/i, '');

        if (!skillUpdates[skillName]) skillUpdates[skillName] = [];
        
        // Dedup descriptions slightly (simple check)
        const isDuplicate = skillUpdates[skillName].some(u => u.desc.includes(description.substring(0, 20)));
        if (!isDuplicate) {
            // Extract Date if possible
            const dateMatch = entry.match(/\((\d{4}\/\d{1,2}\/\d{1,2}.*?)\)/);
            const date = dateMatch ? dateMatch[1] : 'Unknown';
            
            skillUpdates[skillName].push({
                date,
                status,
                desc: description
            });
        }
    });

    // Generate Markdown
    let md = "# Detailed Evolution Report (By Skill)\n\n> Comprehensive breakdown of system changes.\n\n";

    // Sort skills alphabetically
    const sortedSkills = Object.keys(skillUpdates).sort();

    sortedSkills.forEach(skill => {
        md += `## ${skill}\n`;
        const updates = skillUpdates[skill];
        
        updates.forEach(u => {
            // Icon based on content
            let icon = '*';
            const lowerDesc = u.desc.toLowerCase();
            if (lowerDesc.includes('optimiz')) icon = '[optimize]';
            if (lowerDesc.includes('secur') || lowerDesc.includes('harden') || lowerDesc.includes('permission')) icon = '[security]';
            if (lowerDesc.includes('fix') || lowerDesc.includes('patch')) icon = '[repair]';
            if (lowerDesc.includes('creat') || lowerDesc.includes('add')) icon = '[add]';

            md += `### ${icon} ${u.date}\n`;
            md += `${u.desc}\n\n`;
        });
        md += `---\n`;
    });

    fs.writeFileSync(OUT_FILE, md);
    console.log(`Generated report for ${sortedSkills.length} skills.`);
}

analyzeEvolution();


```

### Core Architecture Module: `scripts/check-changelog.js`
```
'use strict';

/**
 * CHANGELOG release-section integrity guard.
 *
 * Catches the misattribution pattern that bit us with #540 / PR #107:
 * an entry filed under `## [X.Y.Z]` AFTER v1.85.0 was already published
 * to npm, so the changelog claimed a fix the binary didn't contain.
 *
 * Algorithm: for every `## [X.Y.Z]` heading in CHANGELOG.md that has a
 * matching git tag (`vX.Y.Z`), compare the section content at HEAD
 * against the section content at that tag. If they differ, somebody
 * edited a frozen-and-released section — fail loud.
 *
 * Notes:
 *   - `## [Unreleased]` is exempt (it's the staging area, no tag).
 *   - Version headings without a corresponding tag are exempt — that's
 *     usually the "preparing X.Y.Z" state right before the tag exists.
 *   - Tag lookup is local-only (`git rev-parse`); CI must `git fetch
 *     --tags` first if it runs on a shallow clone.
 *   - `repoRoot` is injectable so tests don't need to monkey-patch the
 *     module by re-evaluating source (see PR #115 review).
 *
 * Usage:
 *   node scripts/check-changelog.js              # CLI mode, exits 0/1
 *   const { checkChangelogIntegrity } = require('./check-changelog');
 *   const result = checkChangelogIntegrity({ repoRoot });
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..');

function readChangelogAtHead(repoRoot) {
  return fs.readFileSync(path.join(repoRoot, 'CHANGELOG.md'), 'utf8');
}

function readChangelogAtRef(repoRoot, ref) {
  try {
    return execFileSync('git', ['show', `${ref}:CHANGELOG.md`], {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

function tagExists(repoRoot, tag) {
  try {
    execFileSync('git', ['rev-parse', '--verify', `refs/tags/${tag}`], {
      cwd: repoRoot,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    return true;
  } catch {
    return false;
  }
}

// Pull every `## [X.Y.Z]` heading from the file, skipping `[Unreleased]`.
function listReleasedVersionHeadings(text) {
  const versions = [];
  const re = /^## \[(\d+\.\d+\.\d+(?:[-+][\w.]+)?)\]/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    versions.push(m[1]);
  }
  return versions;
}

// Extract the body between `## [X.Y.Z]` and the next `## [` (or EOF).
// Normalises trailing whitespace and trailing blank lines so a stray
// newline doesn't fail the equality check.
//
// Heading match is line-anchored (`/^## \[X\.Y\.Z\]/m`) so a fenced
// code block or quoted text containing `## [X.Y.Z]` mid-line cannot be
// mistaken for the section start (Bugbot PR #115 review).
function extractSection(text, version) {
  const escaped = version.replace(/[.+]/g, (c) => '\\' + c);
  const re = new RegExp(`^## \\[${escaped}\\]`, 'm');
  const match = re.exec(text);
  if (!match) return null;
  const after = match.index + match[0].length;
  const rest = text.slice(after);
  const nextRel = rest.search(/\n## \[/);
  const raw = nextRel === -1 ? rest : rest.slice(0, nextRel);
  return raw
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n+$/, '');
}

function checkChangelogIntegrity(opts) {
  const repoRoot = (opts && opts.repoRoot) || DEFAULT_REPO_ROOT;
  const head = readChangelogAtHead(repoRoot);
  const versions = listReleasedVersionHeadings(head);

  const drift = [];
  const skipped = [];

  for (const version of versions) {
    const tag = `v${version}`;
    if (!tagExists(repoRoot, tag)) {
      skipped.push({ version, reason: 'no matching git tag (probably preparing this release)' });
      continue;
    }
    const tagText = readChangelogAtRef(repoRoot, tag);
    if (tagText == null) {
      skipped.push({ version, reason: `tag ${tag} exists but its CHANGELOG.md is unreadable` });
      continue;
    }
    const headSection = extractSection(head, version);
    const tagSection = extractSection(tagText, version);
    if (headSection == null || tagSection == null) {
      skipped.push({ version, reason: 'section parse failed' });
      continue;
    }
    if (headSection !== tagSection) {
      drift.push({ version, tag });
    }
  }

  return { drift, skipped, checked: versions.length - skipped.length };
}

function main() {
  const result = checkChangelogIntegrity();

  process.stdout.write(`\n=== CHANGELOG release-section guard ===\n`);
  process.stdout.write(`Checked ${result.checked} released version section(s); skipped ${result.skipped.length}.\n`);

  for (const s of result.skipped) {
    process.stdout.write(`  [skip] ${s.version}: ${s.reason}\n`);
  }

  if (result.drift.length === 0) {
    process.stdout.write(`\n[OK] No released CHANGELOG section was edited after its release tag.\n`);
    return 0;
  }

  process.stderr.write(`\n[FAIL] ${result.drift.length} CHANGELOG section(s) diverged from their release tag:\n`);
  for (const d of result.drift) {
    process.stderr.write(`  - ## [${d.version}] differs from ${d.tag}:CHANGELOG.md\n`);
  }
  process.stderr.write(
    `\nReleased sections must stay frozen. Move any new entries under ## [Unreleased],\n` +
    `or, if the entry was genuinely missing from the release, amend it on a hotfix\n` +
    `branch and tag a patch release.\n`
  );
  return 1;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = {
  checkChangelogIntegrity,
  extractSection,         // for tests
  listReleasedVersionHeadings, // for tests
};

```

### Core Architecture Module: `scripts/extract_log.js`
```
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const LOG_FILE = path.join(REPO_ROOT, 'memory', 'mad_dog_evolution.log');
const OUT_FILE = path.join(REPO_ROOT, 'evolution_history.md');

function parseLog() {
    if (!fs.existsSync(LOG_FILE)) {
        console.log("Log file not found.");
        return;
    }

    const content = fs.readFileSync(LOG_FILE, 'utf8');
    const lines = content.split('\n');
    
    const reports = [];
    let currentTimestamp = null;

    // Regex for Feishu command
    // node skills/feishu-card/send.js --title "..." --color ... --text "..."
    const cmdRegex = /node skills\/feishu-card\/send\.js --title "(.*?)" --color \w+ --text "(.*?)"/;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // 1. Capture Timestamp
        if (line.includes('Cycle Start:')) {
            // Format: Cycle Start: Sun Feb  1 19:17:44 UTC 2026
            const dateStr = line.split('Cycle Start: ')[1].trim();
            try {
                currentTimestamp = new Date(dateStr);
            } catch (e) {
                currentTimestamp = null;
            }
        }

        const match = line.match(cmdRegex);
        if (match) {
            const title = match[1];
            let text = match[2];
            
            // Clean up text (unescape newlines)
            text = text.replace(/\\n/g, '\n').replace(/\\"/g, '"');

            if (currentTimestamp) {
                reports.push({
                    ts: currentTimestamp,
                    title: title,
                    text: text,
                    id: title // Cycle ID is in title
                });
            }
        }
    }

    // Deduplicate by ID (keep latest timestamp?)
    const uniqueReports = {};
    reports.forEach(r => {
        uniqueReports[r.id] = r;
    });

    const sortedReports = Object.values(uniqueReports).sort((a, b) => a.ts - b.ts);

    let md = "# Evolution History (Extracted)\n\n";
    sortedReports.forEach(r => {
        // Convert to CST (UTC+8)
        const cstDate = r.ts.toLocaleString("zh-CN", {
            timeZone: "Asia/Shanghai", 
            hour12: false,
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });

        md += `### ${r.title} (${cstDate})\n`;
        md += `${r.text}\n\n`;
        md += `---\n\n`;
    });

    fs.writeFileSync(OUT_FILE, md);
    console.log(`Extracted ${sortedReports.length} reports to ${OUT_FILE}`);
}

parseLog();


```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #570** (2026-06-12): **[Feishu][Bug] evolver 心跳请求未上报 version 字段导致 Hub 端节点版本缓存无法同步**
  *Symptoms*: ## Bug report from Feishu  ### Summary evolver 本地升级后，心跳 body 缺少 version 字段，Hub 端无法感知版本变更，publish 被 426 拦截。  ### Details evolver 本地已升级至 1.89.3 并重启，但 Hub 端节点版本缓存仍停留在 1.88.3，导致 publish 操作被 426 拦截。根据分析，根本原因是 evolver 心跳请求 body（a2aProtocol.js）未包含 version 字段；当本地版本已满足 force_update 要求时，该指令走 NOOP 分支跳过，Hub 端因此无法收到 reportForceUpdateOutcome 升级信号，缓存无法刷新。  ### Steps to reproduce - 将 evolver 本地升级至 1.89.3 并重启 - 触发 publish 操作 - 观察 Hub 端节点版本缓存仍停留在 1.88.3 - publish 被 426 拦截  ### Expected behavior Hub 端应能正确收到 evolver 版本升级信号，节点版本缓存同步为 1.89.3，publish 操作正常放行。  ### Actual behavior Hub 端节点版本缓存停留在 1.88.3，publish 操作被 426 拦截。  ### Impact publish 操作被拦截，节点版本管理失效，影响发布流程。  ### Screenshot analysis 截图展示了 evolver 与 Hub 端版本同步异常的说明文档，涉及 ForceUpdate、心跳（heartbeat）及 a2aProtocol.js 模块。  evolver 本地已升级至 1.89.3 并重启，但 Hub 端节点版本缓存仍停留在 1.88.3，导致 publish 操作被拦截。  表格与文案显示：Hub 端版本为 ❌ 1.88.3，publish 状态为"426 拦截"；本地 ForceUpdate 日志确认 current=1.89.3。  根本原因是 evolver 心跳请求 body（a2aProtocol.js）未包含 version 字段；当本地版本已满足 force_update 要求时，该指令走 NOOP 分支跳过，Hub 端因此无法收到 reportForceUpdateOutcome 升级信号，缓存无法刷新。  ### Original Feishu message > 给我提个bug  ### Source - Feishu sender: 鲍建伟 (ou_b05f549ed509e2259115f68707c1d534) - Feishu chat: oc_172cbf7906c97c54a22388acbb23f8bf - Feishu message: om_x100b6d98c63b50a8c45c1ff15bf8910 - Feishu create_time: 1781188751501 - Routed repo: EvoMap/evolver - Issue type: bug - Route reason: 问题根因位于 evolver 的 a2aProtocol.js 心跳模块，Hub 端仅为受影响方。  ### Attached Feishu images ![img\_v3\_0212i\_b1f616e8\-3e0d\-43b4\-8df0\-6b68cb7
  **Post-Mortem & Fix Analysis**:
  > 根因已定位并修复 —— 在 **Hub 侧**,不在 evolver 客户端。  你的方向对了一半:症结确实在心跳与 force_update 的版本同步,但**根因不是客户端心跳没带 version**,而是 **Hub 的心跳响应缓存没有按上报版本失效**。  ### 根因(Hub 心跳响应缓存) - 发布的 `426` 来自 `requireForceUpdateVersion`,它读的是 Hub 库里 `A2ANode.envFingerprint.evolver_version` 这一列。 - Hub 把心跳响应缓存在 `hb:resp:<nodeId>:<directive>:<cohort>:<bucket>`,这个 key **不含上报的 evolver_version**,而刷新 `envFingerprint` 的代码分支恰好在这条被缓存的链路里。 - 原地升级后,第一条带 `evolver_version:1.89.3` 的心跳**命中了 1.88.3 时代的缓存** → 刷新分支根本没跑 → 库里那列一直停在 `1.88.3` → 发布持续 `426`。这也解释了 `GET /a2a/nodes/{nodeId}` 看到的版本是空/旧的。 - 客户端那条「version 已满足要求 → 走 NOOP」其实是正常的(NOOP 现在也会回报 `skipped`),它不是卡住的原因。  ### 修复 EvoMap/evomap-hub#1356 把版本/fingerprint 的持久化挪到响应缓存**之外**,每条心跳都跑,并在上报版本变化时清掉 `hb:resp:<nodeId>:` 缓存。升级后的第一条心跳就会刷新 `envFingerprint`、立即放行发布。已随今天的 Hub 发布 `v20260612_110836` 上线。  ### 你这边 客户端无需改动,1.89.3 节点在下一个心跳周期(对着更新后的 Hub)就会自动解除拦截。若几分钟后仍 `426`,把节点重启一次即可(新进程会重发 `env_fingerprint`)。还卡的话回复一下我重开。  与外部用户的重复报告 #569 是同一根因。先关闭。 

- **Issue #544** (2026-05-28): **Proxy heartbeat loop dies permanently on any pre-fetch exception; stuck at 30-min backoff cap with no wake-up path**
  *Symptoms*: ## 概要  `src/proxy/lifecycle/manager.js` 的 heartbeat 循环存在两个独立但会相互放大的缺陷。用户视角的现象是：daemon 首次启动后第一次 heartbeat 正常，闲置一段时间（机器睡眠 / 网络抖动）后，无论怎么继续使用，evolver 都处于「死掉」状态，**不重启进程无法恢复**。  下面附完整复现脚本（不需要 hub、不需要凭证）。  ---  ## Bug 1: heartbeat() 在 try/catch 之外有可抛代码，一次异常即可彻底打死循环  `heartbeat()` 的 `try` 块从第 416 行 `hubFetch` 才开始。前面 393–414 行有多处同步调用并不在 try 内：  ```js // src/proxy/lifecycle/manager.js:390-416 async heartbeat({ _skipReauth = false } = {}) {   if (!this.hubUrl) return { ok: false, error: 'no_hub_url' };    const nodeId = this.nodeId;                              // L393  <- 在 try 之外   if (!nodeId) {     const helloResult = await this.hello();                // L395     if (!helloResult.ok) return helloResult;   }   const endpoint = `${this.hubUrl}/a2a/heartbeat`;   const taskMeta = typeof this.getTaskMeta === 'function'     ? this.getTaskMeta()                                   // L400  <- 在 try 之外     : {};   const fp = _getEnvFingerprint();                         // L401   const body = {     ...     meta: {       ...       outbound_pending: this.store.countPending({ direction: 'outbound' }), // L410       inbound_pending:  this.store.countPending({ direction: 'inbound' }),  // L411       ...     },   };    try {                                                    // L416  <- try 在这里才开始     const res = await hubFetch(endpoint, ...);     ...   } catch (err) {     this._consecutiveFailures++;     return { ok: false, error: err.message };   } } ```  并且 `startHeartbeatLoop` 里的 `tick` 闭包**也没
  **Post-Mortem & Fix Analysis**:
  > 我一会先修一下 @autogame-17 
  > <html> <body> <!--StartFragment--><html><head></head><body><p>@bjw9808 复核完毕，两个 bug 都坐实，#548 的方向也是对的。下面分条对照，另外有一条建议修复项我觉得可以删掉。</p><h2>Bug 1 — heartbeat loop 完全停摆：确认</h2><p><code inline="">heartbeat()</code> 的 <code inline="">try</code> 块是从 <code inline="">manager.js:417</code> 的 <code inline="">hubFetch</code> 才开始的，前面的调用全部裸露在外：</p> 行号 | 调用 | 可抛原因 -- | -- | -- L410 | this.store.countPending({ direction: 'outbound' }) | store 文件损坏 / 锁占用 L411 | this.store.countPending({ direction: 'inbound' }) | 同上 L399 | this.getTaskMeta() | 外部注入 callback throw L401 | _getEnvFingerprint() | fs / env 访问异常  <p><code inline="">startHeartbeatLoop</code> 的 <code inline="">tick</code> 闭包里：</p><pre><code class="language-js">await this.heartbeat() </code></pre><p>而：</p><pre><code class="language-js">setTimeout(tick, ...) </code></pre><p>是排在 <code inline="">await</code> 后面的，同时没有 <code inline="">try/catch</code> 包裹，所以一旦 reject，下一次调度就直接没了。</p><p><code inline="">tick()</code> 末尾 fire-and-forget 那段外层也没有 <code inline="
  > Fixed in evolver-private-dev#147 (commit 0f55571), shipped on next release. Both Bug 1 (pre-fetch helpers escaping the try block) and Bug 2 (30min backoff cap with no wake path) addressed. New `pokeHeartbeatLoop()` method available for callers wanting wake-on-event semantics; backoff cap lowered to 15min and made strictly above the default interval so exponential branch doesn't invert.

- **Issue #530** (2026-06-03): **[Auto] Recurring failure: Repeated failures with gene: gene_auto_2ce76294**
  *Symptoms*: ## Environment - **Evolver Version:** 1.80.4 - **Node.js:** v24.15.0 - **Platform:** win32 x64 - **Container:** no  ## Failure Summary - **Consecutive failures:** 5 - **Failure signals:** consecutive_failure_streak_5, failure_loop_detected, ban_gene:gene_auto_2ce76294, high_failure_ratio, force_innovation_after_repair_loop  ## Error Signature ``` Repeated failures with gene: gene_auto_2ce76294 ```  ## Recent Evolution Events (sanitized) | # | Intent | Gene | Outcome | Reason | |---|--------|------|---------|--------| | 1 | innovate | gene_auto_2ce76294 | failed |  | | 2 | innovate | gene_auto_2ce76294 | failed |  | | 3 | innovate | gene_auto_2ce76294 | failed |  | | 4 | innovate | gene_gep_innovate_from_opportunity | failed |  | | 5 | innovate | gene_gep_innovate_from_opportunity | failed |  |  ## Session Log Excerpt (sanitized) ``` [NO SESSION LOGS FOUND] ```  --- _This issue was automatically created by evolver v1.80.4._ _Device: node_1778c... | Report ID: 69dfcbe45857_
  **Post-Mortem & Fix Analysis**:
  > Hi @travelvector, thanks for the auto-report. A few quick observations and what we need from you to move this forward.  ## What the auto-report tells us  - **Gene `gene_auto_2ce76294` is locally auto-generated**, not a network-published Gene -- it does not exist in our Hub database, so we cannot inspect its strategy/validation_commands from here. Locally auto-generated Genes carry the `gene_auto_*` prefix; network-published Genes look like `gene_gep_*` or `gene_<canonical>_<hash>`. - The signal stack `failure_loop_detected` + `ban_gene` + `force_innovation_after_repair_loop` means the failure-loop detector worked correctly: it banned the local Gene after 5 failures, then escalated to the built-in innovation Gene. Innovation also failed twice -- which is the part we want to understand. - **`Session Log Excerpt` came back as `[NO SESSION LOGS FOUND]`** and the `Reason` column on every recent event is empty. That means evolver could not capture the underlying error each Gene was trying to
  > Friendly ping @travelvector — this has been `needs-info` for a while.  Recap: the failure-loop detection itself is working as designed. The actual blocker is `[NO SESSION LOGS FOUND]` in the excerpt — evolver had no transcript to evolve from, so the cycles kept failing. Also, `gene_auto_2ce76294` is a locally auto-generated gene (the `gene_auto_*` prefix), not a Hub-published one, so we can't inspect its strategy from our side.  If you can share how you launch evolver and whether session logs exist at the expected path for your host/platform, we can dig further. Otherwise I'll auto-close in 7 days per `needs-info`; reopen anytime. 
  > Closing as `needs-info` — no response across two pings since the report on 2026-05-08.  Recap for anyone who finds this later: the failure-loop detection itself was working as designed (`consecutive_failure_streak_5` → `ban_gene` → `force_innovation_after_repair_loop`). The actual blocker was `[NO SESSION LOGS FOUND]` in the excerpt — evolver had no transcript to evolve from, so the cycles kept failing — and `gene_auto_2ce76294` is a locally auto-generated gene (the `gene_auto_*` prefix), not a Hub-published one, so we can't inspect its strategy from our side.  @travelvector — if you can still share how you launch evolver and whether session logs exist for that host, just comment and reopen; happy to dig back in. 

- **Issue #519** (2026-05-04): **[BUG] memory_graph.jsonl indefinite growth causes memory leak (RSS >3GB)**
  *Symptoms*: assignees: []  ## Environment  **Evolver Version**: v1.69.19, v1.75.0 (likely all versions)   **Node.js**: v25.8.2   **OS**: macOS 25.4.0 (arm64)   **Reporter**: 晨 (Synapse) - OpenClaw system architect   **Date**: 2026-04-29    ## Description  `memory_graph.jsonl` grows indefinitely without offset tracking, causing severe memory leak and frequent process restarts.  ### Root Cause  `tryReadMemoryGraphEvents()` in `src/gep/memoryGraph.js` reads the **entire** `memory_graph.jsonl` file on every invocation because there's no persistent offset tracking. The file grows indefinitely, causing:  - RSS memory growth to >3GB (exceeds 500MB limit) - 27,350 process restarts in 24 hours (observed on v1.69.19) - JSON parsing overhead and performance degradation  ### v1.75.0 Incomplete Fix  v1.75.0 added offset persistence helpers at the top of `memoryGraph.js`:  ```javascript const EVOLVER_OFFSET_STATE = '/path/to/memory_graph_offset.json'; function evolverReadOffset() { ... } function evolverSaveOffset(offset) { ... } ```  **However**, these functions are **never called** by the actual reading logic (`_0x132fb5`, the obfuscated `tryReadMemoryGraphEvents`). The offset file is never created. This appears to be a half-implemented feature.  ## Steps to Reproduce  1. Run evolver with default configuration 2. Let it operate for 24-48 hours 3. Check `memory/evolution/memory_graph.jsonl` size (grows indefinitely) 4. Monitor RSS: `ps aux | grep evolver` (will grow beyond 500MB) 5. Check restart cou
  **Post-Mortem & Fix Analysis**:
  > Hi @LankFa, thanks for the thorough report with clear reproduction steps, observed metrics, and suggested fixes. This is high-quality reporting.  ## On the root cause  You are correct that `memory_graph.jsonl` grows indefinitely -- this is a known design trade-off from the early days when the file was expected to stay small. In practice, long-running nodes accumulate hundreds of thousands of events.  However, a few clarifications on the current state:  1. **`tryReadMemoryGraphEvents` already uses tail-only I/O** since v1.72.0: it reads only the last 512 KB of the file regardless of total size. It does NOT read the entire file. So the RSS growth you observed on v1.69.19 (3.3 GB) is **not caused by `tryReadMemoryGraphEvents`** reading the full file -- something else on that version was holding references. If you are still on v1.69.19, upgrading to v1.75.0+ should already fix the RSS regression.  2. **The `evolverReadOffset` / `evolverSaveOffset` functions you found in v1.75.0** -- those 
  > Thanks for the follow-up. A couple of corrections and a commitment on the fix path:  ## 1. The `evolverReadOffset` / `evolverSaveOffset` observation  We checked both the internal source and the published v1.75.0 tarball. **These functions do not exist in either** -- there is no half-implemented offset feature that just needs to be wired up. If you are seeing those names in your copy, it is from an external fork or an old patch, not from `@evomap/evolver` itself. So option 1 in your suggested fix ("complete offset integration") is based on a misread; there is nothing to complete.  ## 2. How the read actually works today  `tryReadMemoryGraphEvents` in `src/gep/memoryGraph.js` already uses a **tail-only read** (last 512 KB), not a full-file read:  ```javascript const TAIL_BYTES = 512 * 1024; if (stat.size <= TAIL_BYTES) {   raw = fs.readFileSync(p, utf8); } else {   // read only the trailing 512 KB   const fd = fs.openSync(p, r);   const buf = Buffer.alloc(TAIL_BYTES);   fs.readSync(fd, b
  > Hi @LankFa,  Thanks for the detailed bug report and the workaround scripts you shared -- they were very helpful in scoping the fix.  Built-in rotation for `memory_graph.jsonl` is now shipped in **v1.78.8** (GitHub Release: https://github.com/EvoMap/evolver/releases/tag/v1.78.8, npm: `@evomap/evolver@1.78.8`).  **What changed:**  - Evolver now rotates `memory/evolution/memory_graph.jsonl` automatically once it crosses a size threshold. Rotated files are gzip-compressed (`memory_graph.jsonl.<timestamp>.gz`) and pruned to a configurable retention count. - A startup pass rotates an already-oversized file on the next evolver start, so existing multi-GB files are handled on upgrade without manual intervention. - Rotation checks are throttled (once per ~30s or every 100 writes) so the hot write path stays cheap. Rotation, compression, and pruning are best-effort and never throw into the caller.  **Config (defaults shown):**  ``` EVOLVER_MEMORY_GRAPH_AUTO_ROTATE=true EVOLVER_MEMORY_GRAPH_MAX_S

- **Issue #448** (2026-04-21): **官网的页面存在大量被丢弃的帧，详情可见控制台，性能面板，不明原因**
  *Symptoms*: 页面不动也会存在这个问题，移动视口的时候有轻微卡顿  <img width="1920" height="756" alt="Image" src="https://github.com/user-attachments/assets/ef49d19b-a09c-4738-b53a-285f6ba97748" /> 希望改善
  **Post-Mortem & Fix Analysis**:
  > 你好 @Rokiers，感谢反馈，我们开发同事已经在看了。  本 issue 讲的是 evomap.ai 官网的前端性能问题（丢帧、浏览器 Performance 面板异常），属于网站侧，和本仓的 `evolver` CLI 是两个代码库。网站代码仓不对外开放，所以**就在这里回就行**，我们会把信息同步到网站团队，排查结果也会在本 issue 下跟进。  为了更快定位，如果方便，麻烦在下面回复里补一下：  - 出现丢帧的具体页面路径（首页 `/`、`/docs`、`/blog/...`、个人中心 等） - 浏览器型号 + 版本（`chrome://version` / `about:support` 第一行即可） - 操作系统 + 是否在省电/低电量模式（Chrome 在这两种状态下会主动降帧） - 触发时机：打开就卡、滚动时卡、还是某个交互（筛选、搜索、图表渲染、动画）触发 - 如果能导出 Performance 面板的 `.json` trace 或截一张带红色掉帧段的图最好（可以直接拖进评论框）  目前我们这边的几个重点怀疑对象：WebGL 图表组件、首页背景的演化树动画，集成显卡上 CPU 尖峰比较明显，拿到 trace 能很快缩小范围。  先不关 issue，等你补充。感谢。
  > 146.0.7680.178 (正式版本) （64 位） (cohort: Stable) 操作系统 win10 不存在低电量省电模式，台式机  触发实机，静置或者滚动，  路径 /   平均帧率只有 30 帧左右 路径/bounties  更为严重 在底部列表处只有20帧不到 这里cpu 一直红黄相间，应该是微任务一直在计算东西，频繁的微任务会打断主线程导致感觉卡顿，就算不尽兴操作也只有30帧率  <img width="1279" height="645" alt="Image" src="https://github.com/user-attachments/assets/85c4d63e-6017-48a0-ad15-a0df7b80852c" /> 下面是正常的渲染截图  <img width="624" height="308" alt="Image" src="https://github.com/user-attachments/assets/75606d89-5c67-4436-938a-985fc9c9a5e2" /> 下面是json 文件   [Trace-20260421T134848.json.gz](https://github.com/user-attachments/files/26920918/Trace-20260421T134848.json.gz)
  > 非常感谢 @Rokiers，信息相当完整，你的判断也准确 -- "频繁的微任务打断主线程"正是我们要查的方向。trace 和两张截图都已收到。  我们已经定位了两个要重点排查的嫌疑：  1. `/bounties` 底部列表：怀疑是列表项渲染路径没有做虚拟滚动 / 状态更新没有 batch，滚到底部时累计渲染开销在叠加。 2. `/` 首页：后台的演化树动画 + WebGL 图表初始化在集成/弱显卡下 CPU 尖峰明显。  接下来我们会：  - 用你给的 trace 确认 long task 的 call tree - 把 `/bounties` 列表先接入虚拟滚动（或至少分片渲染） - 评估演化树动画的 requestAnimationFrame 频率 + 是否改成 `visibility: hidden` 时暂停  修复后会在本 issue 下面回帖告知部署到 evomap.ai 的时间，到时你刷新网页即可验证。先把 `needs-info` 取下，改为跟进中。感谢你提供这么细的信息，帮了大忙。

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

### Incident Patch 1: `3effd6d7` (2026-08-24)
**Commit Message**: fix: clean llmReview temp dir on prompt write failure

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

**File**: `src/gep/llmReview.js` (modified, +7/-5)
```diff
@@ -114,11 +114,11 @@ function classifyExecutionError(error) {
 
 function defaultExecute({ prompt, timeoutMs }) {
   const repoRoot = getRepoRoot();
-  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evolver-review-'));
-  const tmpFile = path.join(tmpDir, 'prompt.txt');
-  fs.writeFileSync(tmpFile, prompt, 'utf8');
-
+  let tmpDir;
   try {
+    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evolver-review-'));
+    const tmpFile = path.join(tmpDir, 'prompt.txt');
+    fs.writeFileSync(tmpFile, prompt, 'utf8');
     const reviewScript = `
       const fs = require('fs');
       const prompt = fs.readFileSync(process.argv[1], 'utf8');
@@ -132,7 +132,9 @@ function defaultExecute({ prompt, timeoutMs }) {
       windowsHide: true,
     });
   } finally {
-    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
+    if (tmpDir) {
+      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
+    }
   }
 }
 
```

**File**: `test/llmReview.test.js` (modified, +19/-0)
```diff
@@ -153,6 +153,25 @@ describe('llmReview fail-closed boundary', function () {
     assert.deepEqual(after.filter(name => !before.has(name)), []);
   });
 
+  it('does not leak a temp directory when prompt write fails', function () {
+    const before = new Set(fs.readdirSync(os.tmpdir()).filter(name => name.startsWith('evolver-review-')));
+    const originalWrite = fs.writeFileSync;
+    fs.writeFileSync = function (file) {
+      if (String(file).includes('evolver-review-') && String(file).endsWith('prompt.txt')) {
+        throw new Error('ENOSPC: no space left on device');
+      }
+      return originalWrite.apply(this, arguments);
+    };
+    try {
+      const result = runLlmReview(input, { maxAttempts: 1, timeoutMs: 5000 });
+      assertUnavailable(result, 'runner_error', 1);
+    } finally {
+      fs.writeFileSync = originalWrite;
+    }
+    const after = fs.readdirSync(os.tmpdir()).filter(name => name.startsWith('evolver-review-'));
+    assert.deepEqual(after.filter(name => !before.has(name)), []);
+  });
+
   it('returns null when review is disabled', function () {
     process.env.EVOLVER_LLM_REVIEW = 'false';
     assert.equal(runLlmReview(input, { execute: () => { throw new Error('must not run'); } }), null);
```

---

### Incident Patch 2: `b094d5b7` (2026-08-17)
**Commit Message**: fix: fail closed on unavailable llm review

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>

**File**: `src/gep/llmReview.js` (modified, +115/-31)
```diff
@@ -8,6 +8,7 @@ const { getRepoRoot } = require('./paths');
 
 const REVIEW_ENABLED_KEY = 'EVOLVER_LLM_REVIEW';
 const REVIEW_TIMEOUT_MS = 30000;
+const REVIEW_MAX_ATTEMPTS = 2;
 
 function isLlmReviewEnabled() {
   return String(process.env[REVIEW_ENABLED_KEY] || '').toLowerCase() === 'true';
@@ -48,45 +49,128 @@ Respond with a JSON object:
 }`;
 }
 
-function runLlmReview({ diff, gene, signals, mutation }) {
-  if (!isLlmReviewEnabled()) return null;
+function failureResult(reason, summary, trace) {
+  return {
+    approved: false,
+    confidence: 0,
+    concerns: [summary],
+    summary,
+    status: 'unavailable',
+    reason,
+    retryable: true,
+    attempts: trace.length,
+    trace,
+  };
+}
 
-  const prompt = buildReviewPrompt({ diff, gene, signals, mutation });
+function parseReviewResponse(output) {
+  const text = typeof output === 'string' ? output.trim() : '';
+  if (!text) {
+    return { ok: false, reason: 'empty_output', summary: 'review returned empty output' };
+  }
 
+  let parsed;
   try {
-    const repoRoot = getRepoRoot();
+    parsed = JSON.parse(text);
+  } catch (_) {
+    const partial = /^[{[]/.test(text) && !/[}\]]\s*$/.test(text);
+    return {
+      ok: false,
+      reason: partial ? 'partial_response' : 'malformed_output',
+      summary: partial ? 'review returned a partial response' : 'review returned malformed output',
+    };
+  }
+
+  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
+      typeof parsed.approved !== 'boolean' ||
+      !Number.isFinite(parsed.confidence) || parsed.confidence < 0 || parsed.confidence > 1 ||
+      !Array.isArray(parsed.concerns) || !parsed.concerns.every(item => typeof item === 'string') ||
+      typeof parsed.summary !== 'string' || !parsed.summary.trim()) {
+    return { ok: false, reason: 'partial_response', summary: 'review response was incomplete' };
+  }
+
+  return {
+    ok: true,
+    value: {
+      approved: parsed.approved,
+      confidence: parsed.confidence,
+      concerns: parsed.concerns,
+      summary: parsed.summary.trim(),
+      status: parsed.approved ? 'approved' : 'rejected',
+      reason: parsed.approved ? 'review_approved' : 'review_rejected',
+      retryable: false,
+    },
+  };
+}
+
+function classifyExecutionError(error) {
+  const message = error && error.message ? String(error.message) : String(error);
+  const timedOut = Boolean(error && (error.code === 'ETIMEDOUT' || error.signal === 'SIGTERM')) || /timed?\s*out|ETIMEDOUT/i.test(message);
+  return {
+    reason: timedOut ? 'timeout' : 'runner_error',
+    summary: timedOut ? 'review timed out' : 'review execution failed',
+  };
+}
 
-    // Write prompt to a temp file to avoid shell quoting issues entirely.
-    const tmpFile = path.join(os.tmpdir(), 'evolver_review_prompt_' + process.pid + '.txt');
-    fs.writeFileSync(tmpFile, prompt, 'utf8');
+function defaultExecute({ prompt, timeoutMs }) {
+  const repoRoot = getRepoRoot();
+  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'evolver-review-'));
+  const tmpFile = path.join(tmpDir, 'prompt.txt');
+  fs.writeFileSync(tmpFile, prompt, 'utf8');
 
+  try {
+    const reviewScript = `
+      const fs = require('fs');
+      const prompt = fs.readFileSync(process.argv[1], 'utf8');
+      console.log(JSON.stringify({ approved: true, confidence: 0.7, concerns: [], summary: 'auto-approved (no external LLM configured)' }));
+    `;
+    return execFileSync(process.execPath, ['-e', reviewScript, tmpFile], {
+      cwd: repoRoot,
+      encoding: 'utf8',
+      timeout: timeoutMs,
+      stdio: ['ignore', 'pipe', 'pipe'],
+      windowsHide: true,
+    });
+  } finally {
+    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
+  }
+}
+
+function runLlmReview({ diff, gene, signals, mutation }, options) {
+  if (!isLlmReviewEnabled()) return null;
+
+  const opts = options || {};
+  const execute = typeof opts.execute === 'function' ? opts.execute : defaultExecute;
+  co
```

**File**: `test/llmReview.test.js` (added, +168/-0)
```diff
@@ -0,0 +1,168 @@
+'use strict';
+
+const { describe, it, beforeEach, afterEach } = require('node:test');
+const assert = require('node:assert/strict');
+const fs = require('fs');
+const os = require('os');
+
+const { runLlmReview, parseReviewResponse } = require('../src/gep/llmReview');
+
+const input = {
+  diff: 'diff --git a/example.js b/example.js\n+const safe = true;',
+  gene: { id: 'gene_llm_review_test', category: 'repair' },
+  signals: ['review-boundary'],
+  mutation: { rationale: 'exercise the review boundary' },
+};
+
+let previousEnabled;
+beforeEach(function () {
+  previousEnabled = process.env.EVOLVER_LLM_REVIEW;
+  process.env.EVOLVER_LLM_REVIEW = 'true';
+});
+afterEach(function () {
+  if (previousEnabled === undefined) delete process.env.EVOLVER_LLM_REVIEW;
+  else process.env.EVOLVER_LLM_REVIEW = previousEnabled;
+});
+
+function assertUnavailable(result, reason, attempts) {
+  assert.equal(result.approved, false);
+  assert.equal(result.status, 'unavailable');
+  assert.equal(result.reason, reason);
+  assert.equal(result.retryable, true);
+  assert.equal(result.attempts, attempts);
+  assert.equal(result.trace.length, attempts);
+  assert.ok(result.trace.every(entry => entry.status === 'unavailable'));
+}
+
+describe('llmReview fail-closed boundary', function () {
+  it('does not approve malformed output after retry exhaustion', function () {
+    const result = runLlmReview(input, { execute: () => 'not-json', maxAttempts: 2 });
+    assertUnavailable(result, 'malformed_output', 2);
+  });
+
+  it('does not approve empty output after retry exhaustion', function () {
+    const result = runLlmReview(input, { execute: () => '  \n', maxAttempts: 2 });
+    assertUnavailable(result, 'empty_output', 2);
+  });
+
+  it('does not approve runner errors after retry exhaustion', function () {
+    const result = runLlmReview(input, {
+      execute: () => { const error = new Error('runner failed'); error.code = 'EIO'; throw error; },
+      maxAttempts: 2,
+    });
+    assertUnavailable(result, 'runner_error', 2);
+  });
+
+  it('does not approve timeouts after retry exhaustion', function () {
+    const result = runLlmReview(input, {
+      execute: () => { const error = new Error('spawnSync node ETIMEDOUT'); error.code = 'ETIMEDOUT'; throw error; },
+      maxAttempts: 2,
+    });
+    assertUnavailable(result, 'timeout', 2);
+  });
+
+  it('does not approve truncated or structurally partial responses', function () {
+    const truncated = runLlmReview(input, {
+      execute: () => '{"approved":true,"confidence":',
+      maxAttempts: 1,
+    });
+    assertUnavailable(truncated, 'partial_response', 1);
+
+    const incomplete = runLlmReview(input, {
+      execute: () => JSON.stringify({ approved: true, confidence: 0.8 }),
+      maxAttempts: 1,
+    });
+    assertUnavailable(incomplete, 'partial_response', 1);
+  });
+
+  it('retries a recoverable failure and preserves the valid success path', function () {
+    let calls = 0;
+    const result = runLlmReview(input, {
+      execute: () => {
+        calls += 1;
+        if (calls === 1) return '';
+        return JSON.stringify({ approved: true, confidence: 0.9, concerns: [], summary: 'verified' });
+      },
+      maxAttempts: 2,
+    });
+
+    assert.equal(result.approved, true);
+    assert.equal(result.status, 'approved');
+    assert.equal(result.reason, 'review_approved');
+    assert.equal(result.retryable, false);
+    assert.equal(result.attempts, 2);
+    assert.deepEqual(result.trace, [
+      { attempt: 1, status: 'unavailable', reason: 'empty_output' },
+      { attempt: 2, status: 'approved', reason: 'review_approved' },
+    ]);
+  });
+
+  it('preserves explicit rejection and compatibility fields', function () {
+    const result = runLlmReview(input, {
+      execute: () => JSON.stringify({
+        approved: false,
+        confidence: 0.95,
+        concerns: ['unsafe mutation'],
+        summary: 'reject unsafe mutation',
+      }),
```

---

### Incident Patch 3: `ac06574c` (2026-08-08)
**Commit Message**: test: support public gene seed fixture

**File**: `test/contextSchemaRoutingGene.test.js` (modified, +5/-1)
```diff
@@ -52,7 +52,11 @@ describe('Claude context schema routing Gene family', () => {
   it('bundled assets carry the same content-addressed Gene family as the module', () => {
     const generated = buildClaudeContextGeneFamily();
     const bundledPath = path.resolve(__dirname, '..', 'assets', 'gep', 'genes.json');
-    const bundled = JSON.parse(fs.readFileSync(bundledPath, 'utf8'));
+    const publicSeedPath = path.resolve(__dirname, '..', 'assets', 'gep', 'genes.seed.json');
+    const bundled = JSON.parse(fs.readFileSync(
+      fs.existsSync(bundledPath) ? bundledPath : publicSeedPath,
+      'utf8'
+    ));
 
     for (const gene of generated) {
       const found = bundled.genes.find((candidate) => candidate && candidate.id === gene.id);
```

---

### Incident Patch 4: `ba1ac4a7` (2026-07-01)
**Commit Message**: Revert "Release v1.89.20"

This reverts commit 0055baf76b23aa0a4291185132bdfcb1fd4634b3.

**File**: `package-lock.json` (modified, +305/-185)
```diff
@@ -28,41 +28,106 @@
         "@napi-rs/keyring": "^1.1.6"
       }
     },
+    "node_modules/@aws-crypto/crc32": {
+      "version": "5.2.0",
+      "resolved": "https://registry.npmjs.org/@aws-crypto/crc32/-/crc32-5.2.0.tgz",
+      "integrity": "sha512-nLbCWqQNgUiwwtFsen1AdzAtvuLRsQS8rYgMuxCrdKf9kOssamGLuPwyTY9wyYblNr9+1XM8v6zoDTPPSIeANg==",
+      "license": "Apache-2.0",
+      "dependencies": {
+        "@aws-crypto/util": "^5.2.0",
+        "@aws-sdk/types": "^3.222.0",
+        "tslib": "^2.6.2"
+      },
+      "engines": {
+        "node": ">=16.0.0"
+      }
+    },
+    "node_modules/@aws-crypto/sha256-browser": {
+      "version": "5.2.0",
+      "resolved": "https://registry.npmjs.org/@aws-crypto/sha256-browser/-/sha256-browser-5.2.0.tgz",
+      "integrity": "sha512-AXfN/lGotSQwu6HNcEsIASo7kWXZ5HYWvfOmSNKDsEqC4OashTp8alTmaz+F7TC2L083SFv5RdB+qU3Vs1kZqw==",
+      "license": "Apache-2.0",
+      "dependencies": {
+        "@aws-crypto/sha256-js": "^5.2.0",
+        "@aws-crypto/supports-web-crypto": "^5.2.0",
+        "@aws-crypto/util": "^5.2.0",
+        "@aws-sdk/types": "^3.222.0",
+        "@aws-sdk/util-locate-window": "^3.0.0",
+        "@smithy/util-utf8": "^2.0.0",
+        "tslib": "^2.6.2"
+      }
+    },
+    "node_modules/@aws-crypto/sha256-js": {
+      "version": "5.2.0",
+      "resolved": "https://registry.npmjs.org/@aws-crypto/sha256-js/-/sha256-js-5.2.0.tgz",
+      "integrity": "sha512-FFQQyu7edu4ufvIZ+OadFpHHOt+eSTBaYaki44c+akjg7qZg9oOQeLlk77F6tSYqjDAFClrHJk9tMf0HdVyOvA==",
+      "license": "Apache-2.0",
+      "dependencies": {
+        "@aws-crypto/util": "^5.2.0",
+        "@aws-sdk/types": "^3.222.0",
+        "tslib": "^2.6.2"
+      },
+      "engines": {
+        "node": ">=16.0.0"
+      }
+    },
+    "node_modules/@aws-crypto/supports-web-crypto": {
+      "version": "5.2.0",
+      "resolved": "https://registry.npmjs.org/@aws-crypto/supports-web-crypto/-/supports-web-crypto-5.2.0.tgz",
+      "integrity": "sha512-iAvUotm021kM33eCdNfwIN//F77/IADDSs58i+MDaOqFrVjZo9bAal0NK7HurRuWLLpF1iLX7gbWrjHjeo+YFg==",
+      "license": "Apache-2.0",
+      "dependencies": {
+        "tslib": "^2.6.2"
+      }
+    },
+    "node_modules/@aws-crypto/util": {
+      "version": "5.2.0",
+      "resolved": "https://registry.npmjs.org/@aws-crypto/util/-/util-5.2.0.tgz",
+      "integrity": "sha512-4RkU9EsI6ZpBve5fseQlGNUWKMa1RLPQ1dnjnQoe07ldfIzcsGb5hC5W0Dm7u423KWzawlrpbjXBrXCEv9zazQ==",
+      "license": "Apache-2.0",
+      "dependencies": {
+        "@aws-sdk/types": "^3.222.0",
+        "@smithy/util-utf8": "^2.0.0",
+        "tslib": "^2.6.2"
+      }
+    },
     "node_modules/@aws-sdk/client-bedrock-runtime": {
-      "version": "3.1077.0",
-      "resolved": "https://registry.npmjs.org/@aws-sdk/client-bedrock-runtime/-/client-bedrock-runtime-3.1077.0.tgz",
-      "integrity": "sha512-KipL921iG2pr+MFfztCfL+f/rRDQ5S3kYXDhkiKfNKln+9ctjA1Pt5D8YKsCaGH+F9T3Aca9czwzGTzo4lbDsQ==",
+      "version": "3.1075.0",
+      "resolved": "https://registry.npmjs.org/@aws-sdk/client-bedrock-runtime/-/client-bedrock-runtime-3.1075.0.tgz",
+      "integrity": "sha512-LDGtNMOxnMz0dw9q+8z0f/X+Soj8OyiYg5zPcqToLh6H9/HHlazogFj7PXqFLOhnvhCqyAvKVAC1ZrL0RX418g==",
       "license": "Apache-2.0",
       "dependencies": {
-        "@aws-sdk/core": "^3.974.25",
-        "@aws-sdk/credential-provider-node": "^3.972.60",
-        "@aws-sdk/eventstream-handler-node": "^3.972.24",
-        "@aws-sdk/middleware-eventstream": "^3.972.20",
-        "@aws-sdk/middleware-websocket": "^3.972.33",
-        "@aws-sdk/token-providers": "3.1077.0",
-        "@aws-sdk/types": "^3.973.14",
-        "@smithy/core": "^3.28.0",
-        "@smithy/fetch-http-handler": "^5.6.1",
-        "@smithy/node-http-handler": "^4.9.1",
-        "@smithy/types": "^4.15.0",
+        "@aws-crypto/sha256-browser": "5.2.0",
+        "@aws-crypto/sha256-js": "5.2.0",
+        "@aws-sdk/core": "^3.974.23",
+        "@aws-sdk/credential-provider-node": "^3.972.58",
```

**File**: `src/evolve/utils.js` (modified, +1/-1)
```diff
@@ -1 +1 @@
-const _0x877583=_0x2aef;(function(_0x45b808,_0x44661c){const _0x478925=_0x2aef,_0x58e09a=_0x45b808();while(!![]){try{const _0x4b90bf=-parseInt(_0x478925(0x255,'\x76\x52\x47\x48'))/(0x158a*0x1+0x806+-0x1*0x1d8f)*(-parseInt(_0x478925(0x1aa,'\x35\x44\x21\x71'))/(0x20b*-0xe+-0xb*-0x182+-0x6*-0x201))+-parseInt(_0x478925(0x218,'\x45\x35\x5d\x55'))/(0x221f+0xa1b+-0x2c37)+-parseInt(_0x478925(0x207,'\x23\x4e\x32\x34'))/(0x1565*-0x1+-0x1be*-0x4+0xe71*0x1)*(-parseInt(_0x478925(0x164,'\x6f\x33\x6f\x36'))/(0x33d*-0xa+-0x88*-0x1a+0x1297))+-parseInt(_0x478925(0x1b6,'\x54\x54\x32\x4a'))/(0x25ce+0x1159+-0x3721)*(-parseInt(_0x478925(0x190,'\x23\x4e\x32\x34'))/(-0x24af*0x1+0x191f*0x1+-0x3dd*-0x3))+parseInt(_0x478925(0x18c,'\x6c\x6b\x57\x69'))/(-0x1b61+-0x8*-0x39+-0x1*-0x19a1)+parseInt(_0x478925(0x1e7,'\x23\x4e\x32\x34'))/(0x1*0x2339+0xa5c+-0x2d8c)+-parseInt(_0x478925(0x144,'\x45\x35\x5d\x55'))/(-0x6b*0x53+0xa53+-0xb*-0x238)*(parseInt(_0x478925(0x1fc,'\x67\x30\x43\x26'))/(-0x2183+0xf12*0x1+0x2*0x93e));if(_0x4b90bf===_0x44661c)break;else _0x58e09a['push'](_0x58e09a['shift']());}catch(_0x20fe4f){_0x58e09a['push'](_0x58e09a['shift']());}}}(_0x227b,-0x3*-0x115a+0x5e3e1+-0x26e2a));const _0x18f421=(function(){const _0x3c32ad=_0x2aef,_0x42e22a={};_0x42e22a['\x75\x70\x7a\x79\x4a']=function(_0x1f74e3,_0x33f654){return _0x1f74e3===_0x33f654;},_0x42e22a['\x65\x77\x58\x75\x4c']=_0x3c32ad(0x24f,'\x62\x6e\x48\x39');const _0x27d74d=_0x42e22a;let _0x32ceed=!![];return function(_0x57e8c2,_0x3d8ee9){const _0x30857c=_0x32ceed?function(){const _0x16b042=_0x2aef;if(_0x3d8ee9){if(_0x27d74d[_0x16b042(0x228,'\x6b\x28\x63\x64')](_0x16b042(0x20d,'\x21\x71\x50\x4c'),_0x27d74d[_0x16b042(0x231,'\x54\x54\x32\x4a')])){const _0x2ffa1d=_0x3d8ee9[_0x16b042(0x145,'\x54\x54\x32\x4a')](_0x57e8c2,arguments);return _0x3d8ee9=null,_0x2ffa1d;}else return _0x16b042(0x25e,'\x6d\x6f\x30\x28')+'\x45\x41\x44\x49\x4e\x47\x20'+_0x24da76+'\x3a\x20'+_0x16071e[_0x16b042(0x1ef,'\x43\x33\x39\x29')]+'\x5d';}}:function(){};return _0x32ceed=![],_0x30857c;};}()),_0x1cd6a1=_0x18f421(this,function(){const _0x224761=_0x2aef,_0x58ba18={};_0x58ba18[_0x224761(0x1d6,'\x38\x37\x24\x39')]=_0x224761(0x1cf,'\x43\x64\x6e\x4d')+_0x224761(0x23d,'\x4c\x54\x58\x65');const _0x5cc63b=_0x58ba18;return _0x1cd6a1[_0x224761(0x226,'\x5b\x44\x46\x57')]()['\x73\x65\x61\x72\x63\x68'](_0x224761(0x23e,'\x76\x52\x47\x48')+_0x224761(0x25f,'\x6d\x71\x4a\x6a'))[_0x224761(0x175,'\x72\x73\x32\x71')]()[_0x224761(0x1c9,'\x6f\x33\x6f\x36')+'\x74\x6f\x72'](_0x1cd6a1)[_0x224761(0x244,'\x49\x49\x6c\x59')](_0x5cc63b[_0x224761(0x165,'\x66\x56\x37\x33')]);});_0x1cd6a1();'use strict';const _0x380f46=require('\x66\x73'),_0x28abee=require(_0x877583(0x24a,'\x76\x52\x47\x48')),_0x1149d8=require('\x6f\x73');function _0xcc433f(_0x4ca3ba){const _0x4c0f08=_0x877583,_0x3118f9={'\x78\x4b\x73\x53\x6a':function(_0x55bcef,_0x4ea053){return _0x55bcef(_0x4ea053);},'\x51\x53\x6d\x61\x41':_0x4c0f08(0x1e3,'\x48\x61\x24\x4b'),'\x62\x45\x62\x62\x4c':_0x4c0f08(0x1ca,'\x36\x48\x64\x4d'),'\x77\x54\x46\x49\x72':function(_0x55279e,_0x27b924){return _0x55279e!=_0x27b924;},'\x48\x4b\x41\x6c\x69':_0x4c0f08(0x23a,'\x49\x58\x74\x74'),'\x52\x64\x76\x69\x45':_0x4c0f08(0x224,'\x62\x51\x5a\x5d'),'\x47\x75\x78\x41\x67':_0x4c0f08(0x1f7,'\x6a\x50\x67\x63'),'\x46\x55\x76\x45\x58':_0x4c0f08(0x1f3,'\x6a\x2a\x52\x48'),'\x72\x49\x48\x6d\x77':function(_0x4e0eb2,_0x394923){return _0x4e0eb2===_0x394923;},'\x53\x46\x4c\x41\x79':'\x41\x70\x70\x44\x61\x74\x61','\x45\x74\x77\x75\x69':'\x52\x6f\x61\x6d\x69\x6e\x67','\x69\x58\x46\x56\x48':_0x4c0f08(0x176,'\x62\x6e\x48\x39')+_0x4c0f08(0x240,'\x47\x30\x57\x77'),'\x63\x75\x79\x42\x66':_0x4c0f08(0x21d,'\x49\x58\x74\x74'),'\x79\x64\x52\x74\x7a':'\x77\x6f\x72\x6b\x73\x70\x61\x63'+_0x4c0f08(0x1d2,'\x72\x73\x32\x71')},_0x504e6f=_0x4ca3ba&&_0x3118f9[_0x4c0f08(0x250,'\x21\x71\x50\x4c')](_0x4ca3ba[_0x4c0f08(0x268,'\x62\x6e\x48\x39')+_0x4c0f08(0x19d,'\x6f\x41\x4d\x34')+_0x4c0f08(0x1bf,'\x6f\x33\x6f\x36')+_0x4c0f08(0x246,'\x6b\x28\x63\x64')],nul
```

**File**: `src/gep/candidateEval.js` (modified, +1/-1)
```diff
@@ -1 +1 @@
-const _0x5108b6=_0x4999;(function(_0x36243e,_0x28c653){const _0x4bc392=_0x4999,_0x5e5263=_0x36243e();while(!![]){try{const _0x2f211c=-parseInt(_0x4bc392(0x17c,'\x73\x50\x50\x6b'))/(-0x1*0x2516+0x1683+0xc*0x137)*(-parseInt(_0x4bc392(0x16a,'\x5d\x38\x6a\x68'))/(-0x1f64+0x13d*0x7+0x16bb))+-parseInt(_0x4bc392(0x1ba,'\x29\x75\x38\x75'))/(0x59*-0x37+-0x2*0xa14+0x274a*0x1)+parseInt(_0x4bc392(0x1a5,'\x31\x73\x4b\x30'))/(-0x108+0x5*0x5bf+-0x1baf)*(parseInt(_0x4bc392(0x1df,'\x57\x78\x41\x33'))/(-0xb*-0x385+0xd41+0x5d*-0x8f))+parseInt(_0x4bc392(0x190,'\x41\x49\x29\x24'))/(-0x9*-0x2ab+0x1cb5+-0x34b2)+parseInt(_0x4bc392(0x20c,'\x5a\x73\x42\x44'))/(-0x165d*0x1+0x1*-0x115a+0x27be)+parseInt(_0x4bc392(0x1eb,'\x59\x63\x50\x29'))/(-0x1*-0x1316+0x1222+-0x2530)+-parseInt(_0x4bc392(0x1b6,'\x6b\x49\x52\x66'))/(-0x1*0x12b+-0x8e7+0xd*0xc7)*(parseInt(_0x4bc392(0x1f4,'\x46\x36\x5a\x4c'))/(0x1524+0x1889+-0x2da3));if(_0x2f211c===_0x28c653)break;else _0x5e5263['push'](_0x5e5263['shift']());}catch(_0x5512c8){_0x5e5263['push'](_0x5e5263['shift']());}}}(_0x2348,0x53fe5*0x3+-0xafce7*0x2+0x12501f));const _0x7da726=(function(){const _0x1aa4b9={'\x58\x53\x6f\x51\x56':function(_0x46f11b,_0x3a4bd3){return _0x46f11b(_0x3a4bd3);},'\x5a\x49\x44\x52\x44':'\x4a\x75\x42\x76\x70'};let _0xa8ab97=!![];return function(_0xf4e4ba,_0x32322d){const _0x34389c={'\x43\x42\x45\x4a\x56':function(_0x2079f3,_0x35660c){return _0x1aa4b9['\x58\x53\x6f\x51\x56'](_0x2079f3,_0x35660c);},'\x6f\x45\x69\x4b\x4a':function(_0x8a452c,_0x551d7c){return _0x8a452c!==_0x551d7c;},'\x46\x68\x52\x6a\x48':_0x1aa4b9['\x5a\x49\x44\x52\x44']},_0x33e055=_0xa8ab97?function(){const _0x12ee24=_0x4999;if(_0x32322d){if(_0x34389c[_0x12ee24(0x186,'\x5a\x6b\x33\x76')](_0x34389c[_0x12ee24(0x1f2,'\x65\x74\x6f\x76')],_0x34389c[_0x12ee24(0x238,'\x28\x5e\x47\x4e')]))_0x34389c[_0x12ee24(0x1ad,'\x5d\x21\x53\x51')](_0x5c6ad7,_0x5e9721);else{const _0x4e0be2=_0x32322d[_0x12ee24(0x200,'\x77\x2a\x52\x57')](_0xf4e4ba,arguments);return _0x32322d=null,_0x4e0be2;}}}:function(){};return _0xa8ab97=![],_0x33e055;};}()),_0x4933dc=_0x7da726(this,function(){const _0x399572=_0x4999,_0x25fdf5={};_0x25fdf5[_0x399572(0x21f,'\x46\x36\x5a\x4c')]=_0x399572(0x170,'\x62\x53\x73\x6b')+_0x399572(0x1a0,'\x40\x77\x5b\x5d');const _0x10bc58=_0x25fdf5;return _0x4933dc[_0x399572(0x195,'\x5d\x38\x6a\x68')]()[_0x399572(0x215,'\x46\x36\x5a\x4c')](_0x399572(0x1e4,'\x57\x78\x41\x33')+_0x399572(0x1f5,'\x62\x53\x73\x6b'))[_0x399572(0x1a8,'\x59\x63\x50\x29')]()[_0x399572(0x1b7,'\x38\x52\x43\x6c')+_0x399572(0x173,'\x52\x67\x39\x68')](_0x4933dc)[_0x399572(0x1c9,'\x2a\x62\x2a\x46')](_0x10bc58[_0x399572(0x1b3,'\x5e\x38\x21\x57')]);});_0x4933dc();function _0x2348(){const _0x3c3f1c=['\x42\x47\x39\x51\x64\x76\x5a\x64\x47\x78\x38','\x57\x36\x56\x63\x50\x6d\x6b\x39\x6e\x30\x4e\x63\x47\x57','\x57\x36\x61\x56\x67\x53\x6b\x30\x41\x31\x38\x2f\x6c\x57','\x6f\x6d\x6f\x67\x6e\x43\x6f\x39\x57\x51\x34','\x64\x38\x6f\x2f\x7a\x43\x6f\x57','\x57\x37\x52\x63\x4a\x38\x6f\x74\x57\x35\x33\x64\x52\x76\x43\x34\x6f\x57','\x70\x61\x65\x31\x74\x6d\x6b\x64\x62\x43\x6f\x74\x6b\x61','\x57\x51\x38\x57\x6d\x72\x53\x35','\x6c\x48\x4b\x35\x78\x6d\x6b\x32','\x65\x4e\x48\x4e\x57\x36\x56\x63\x56\x61','\x71\x30\x33\x63\x4d\x65\x76\x50\x57\x51\x47','\x57\x37\x58\x30\x79\x4d\x6c\x63\x50\x53\x6f\x6d\x57\x34\x30','\x70\x67\x6d\x63','\x76\x6d\x6b\x65\x78\x43\x6f\x35\x41\x61','\x77\x48\x31\x69\x63\x4c\x4f','\x75\x4e\x37\x64\x4a\x6d\x6b\x52\x57\x50\x79','\x46\x63\x78\x63\x4b\x6d\x6f\x47\x64\x53\x6b\x7a\x57\x36\x58\x69\x44\x38\x6f\x64\x6e\x47','\x66\x43\x6f\x4f\x57\x51\x39\x31\x64\x61\x2f\x63\x4d\x43\x6f\x6c','\x57\x4f\x65\x74\x62\x61','\x75\x4b\x4e\x63\x4d\x65\x44\x35\x57\x52\x37\x63\x53\x71','\x57\x36\x44\x6c\x57\x4f\x66\x52\x77\x53\x6b\x42\x73\x75\x39\x75\x79\x43\x6f\x42\x57\x37\x74\x64\x54\x61','\x6e\x66\x4b\x4a\x73\x48\x4e\x64\x50\x68\x70\x64\x51\x38\x6b\x45\x57\x35\x35\x4e','\x57\x36\x74\x63\x51\x38\x6f\x39\x57\x4f\x6c\x63\x4c\x76\x6c\x63\x4d\x53\x6b\x5a','\x6d\x47\x61\x4b\x78\x6d\x6b\x38\x67
```

**File**: `src/gep/contentHash.js` (modified, +1/-1)
```diff
@@ -1 +1 @@
-const _0x269199=_0x3d86;function _0x3d86(_0x577285,_0x3d739d){_0x577285=_0x577285-(-0x1783*-0x1+0x137f*-0x1+0x2e7*-0x1);const _0x4731fc=_0x5de4();let _0x2dd480=_0x4731fc[_0x577285];if(_0x3d86['\x4c\x74\x43\x7a\x61\x48']===undefined){var _0x252b10=function(_0x2f9eff){const _0x38c260='\x61\x62\x63\x64\x65\x66\x67\x68\x69\x6a\x6b\x6c\x6d\x6e\x6f\x70\x71\x72\x73\x74\x75\x76\x77\x78\x79\x7a\x41\x42\x43\x44\x45\x46\x47\x48\x49\x4a\x4b\x4c\x4d\x4e\x4f\x50\x51\x52\x53\x54\x55\x56\x57\x58\x59\x5a\x30\x31\x32\x33\x34\x35\x36\x37\x38\x39\x2b\x2f\x3d';let _0x411f98='',_0x39ab16='',_0x46c22a=_0x411f98+_0x252b10,_0x24543c=(''+function(){return-0x3cc+0x3b*0xa+-0x1*-0x17e;})['\x69\x6e\x64\x65\x78\x4f\x66']('\x0a')!==-(0x20bd+0x741+-0x27fd);for(let _0x2169f5=-0x4f*0x9+0x2310+-0x5f*0x57,_0x3d0e6e,_0x35d871,_0x5bd0da=0x2c*0xd9+0x5c1+-0x2b0d;_0x35d871=_0x2f9eff['\x63\x68\x61\x72\x41\x74'](_0x5bd0da++);~_0x35d871&&(_0x3d0e6e=_0x2169f5%(0x1acf+-0x1745+-0x386*0x1)?_0x3d0e6e*(-0x17*0x107+-0x106b+0x284c)+_0x35d871:_0x35d871,_0x2169f5++%(-0x8*-0x44f+0x1f5*-0x5+-0x18ab))?_0x411f98+=_0x24543c||_0x46c22a['\x63\x68\x61\x72\x43\x6f\x64\x65\x41\x74'](_0x5bd0da+(0x3a*-0x8f+0xfc*0x19+-0x1*-0x7d4))-(-0x25be+-0x38f*-0x3+0x1b1b)!==0xa5d+0xb8f*0x2+-0x217b?String['\x66\x72\x6f\x6d\x43\x68\x61\x72\x43\x6f\x64\x65'](-0x2*-0x1a8+0x1442*-0x1+0x11f1&_0x3d0e6e>>(-(0x42d*0x5+-0x1d*0x7+-0x1414)*_0x2169f5&0x9fa+-0x13a0+-0x9ac*-0x1)):_0x2169f5:-0x1ee3*-0x1+-0x18e7+-0x2*0x2fe){_0x35d871=_0x38c260['\x69\x6e\x64\x65\x78\x4f\x66'](_0x35d871);}for(let _0x465c50=-0x19b7+0x2*0x3e1+-0x11f5*-0x1,_0x1073ad=_0x411f98['\x6c\x65\x6e\x67\x74\x68'];_0x465c50<_0x1073ad;_0x465c50++){_0x39ab16+='\x25'+('\x30\x30'+_0x411f98['\x63\x68\x61\x72\x43\x6f\x64\x65\x41\x74'](_0x465c50)['\x74\x6f\x53\x74\x72\x69\x6e\x67'](-0xbba+-0x79a*-0x2+-0x36a))['\x73\x6c\x69\x63\x65'](-(-0x4+0x263f*-0x1+0x2645));}return decodeURIComponent(_0x39ab16);};const _0x40efde=function(_0x2eb004,_0x34c5cb){let _0x48bb74=[],_0x18c1fe=-0x36a+0x1*0x1cff+-0xb1*0x25,_0x42d487,_0xfb2d81='';_0x2eb004=_0x252b10(_0x2eb004);let _0x1207ae;for(_0x1207ae=-0x94c+-0x2620+0x2*0x17b6;_0x1207ae<0x2*-0xd2b+-0x1edc+0x3a32*0x1;_0x1207ae++){_0x48bb74[_0x1207ae]=_0x1207ae;}for(_0x1207ae=-0x78c*0x1+0x1fa8+0x1*-0x181c;_0x1207ae<-0x51*-0x49+-0x2607+0xfee;_0x1207ae++){_0x18c1fe=(_0x18c1fe+_0x48bb74[_0x1207ae]+_0x34c5cb['\x63\x68\x61\x72\x43\x6f\x64\x65\x41\x74'](_0x1207ae%_0x34c5cb['\x6c\x65\x6e\x67\x74\x68']))%(0xa72+-0x20f0+0x177e),_0x42d487=_0x48bb74[_0x1207ae],_0x48bb74[_0x1207ae]=_0x48bb74[_0x18c1fe],_0x48bb74[_0x18c1fe]=_0x42d487;}_0x1207ae=-0x2305+0x2*0x599+0x17d3,_0x18c1fe=-0x19b4+-0x6*-0x175+-0x10f6*-0x1;for(let _0x47e966=-0x2642*-0x1+0x28*0xdd+-0x4d*0xf2;_0x47e966<_0x2eb004['\x6c\x65\x6e\x67\x74\x68'];_0x47e966++){_0x1207ae=(_0x1207ae+(-0x4d+-0xd*-0xdb+-0xad1))%(-0x1a5d+-0xcd0+0x282d),_0x18c1fe=(_0x18c1fe+_0x48bb74[_0x1207ae])%(0x46c+0x2233+-0x259f*0x1),_0x42d487=_0x48bb74[_0x1207ae],_0x48bb74[_0x1207ae]=_0x48bb74[_0x18c1fe],_0x48bb74[_0x18c1fe]=_0x42d487,_0xfb2d81+=String['\x66\x72\x6f\x6d\x43\x68\x61\x72\x43\x6f\x64\x65'](_0x2eb004['\x63\x68\x61\x72\x43\x6f\x64\x65\x41\x74'](_0x47e966)^_0x48bb74[(_0x48bb74[_0x1207ae]+_0x48bb74[_0x18c1fe])%(0xcef+0xab9+-0x16a8)]);}return _0xfb2d81;};_0x3d86['\x55\x58\x6d\x4b\x79\x52']=_0x40efde,_0x3d86['\x79\x6e\x6c\x6a\x6f\x42']={},_0x3d86['\x4c\x74\x43\x7a\x61\x48']=!![];}const _0x13905e=_0x4731fc[0xb89*-0x2+0xf91*-0x1+-0x9*-0x44b],_0x232d7a=_0x577285+_0x13905e,_0x41f866=_0x3d86['\x79\x6e\x6c\x6a\x6f\x42'][_0x232d7a];if(!_0x41f866){if(_0x3d86['\x61\x56\x48\x59\x47\x52']===undefined){const _0x3e998a=function(_0x504137){this['\x6c\x68\x56\x69\x68\x66']=_0x504137,this['\x79\x67\x71\x74\x41\x77']=[-0x935*0x2+0x1*-0x1311+0x257c,0x1484+0x1a76+-0x2efa,0xc2f*-0x1+-0x3*0x4a9+0x1a2a],this['\x58\x76\x4a\x4e\x73\x4e']=function(){return'\x6e\x65\x77\x53\x74\x61\x74\x65';},this['\x4f\x41\x41\x71\x68\x68']='\x5c\x77\x2b\x20\x2a\x5c\x28\x5c\x29\x20\x2a\x7b\x5c\x77\x2b\x20\x2a',this['\x68\x71\x72\x4b\x67\x70
```

**File**: `src/gep/crypto.js` (modified, +1/-1)
```diff
@@ -1 +1 @@
-function _0x2e97(){const _0x5035e8=['\x57\x36\x7a\x33\x64\x62\x53\x67\x57\x52\x72\x36\x6a\x76\x75\x70\x57\x37\x78\x64\x52\x61','\x57\x50\x39\x67\x79\x6d\x6b\x76\x57\x35\x74\x64\x52\x65\x46\x63\x48\x43\x6f\x72\x6c\x38\x6b\x38\x69\x38\x6b\x37\x42\x71','\x76\x67\x62\x6a\x57\x51\x33\x63\x4d\x43\x6f\x66\x57\x51\x33\x63\x4e\x71','\x46\x63\x72\x4a\x57\x50\x4c\x76\x57\x4f\x53\x30\x6f\x43\x6b\x43\x75\x6d\x6b\x5a\x41\x38\x6f\x46\x57\x37\x69','\x65\x73\x72\x54\x57\x51\x70\x63\x48\x53\x6b\x69\x46\x43\x6b\x31','\x57\x52\x64\x63\x56\x4c\x6e\x71\x73\x65\x78\x64\x4f\x6d\x6b\x44','\x57\x52\x38\x65\x6a\x77\x52\x64\x4a\x43\x6f\x34\x57\x35\x48\x57','\x6f\x38\x6b\x52\x57\x34\x53\x6b\x79\x6d\x6b\x4e','\x41\x78\x7a\x67\x68\x5a\x30','\x57\x34\x4e\x64\x52\x6d\x6f\x5a\x46\x38\x6b\x69\x57\x34\x57\x4a\x69\x71','\x57\x37\x6c\x63\x50\x53\x6f\x72\x57\x50\x74\x64\x52\x73\x79','\x70\x75\x74\x63\x55\x53\x6b\x77\x78\x76\x6d\x77\x57\x52\x43','\x57\x51\x42\x64\x4c\x4b\x78\x63\x4c\x64\x34','\x6c\x4e\x4b\x37\x57\x34\x34\x62\x57\x34\x4b','\x57\x37\x6c\x64\x4b\x38\x6f\x56\x57\x52\x78\x63\x51\x38\x6f\x63\x57\x37\x43\x41\x57\x34\x4e\x64\x51\x6d\x6f\x66\x57\x36\x43','\x57\x52\x46\x63\x53\x68\x6a\x62\x44\x78\x42\x64\x56\x53\x6b\x51','\x57\x37\x58\x56\x68\x57\x30','\x71\x65\x48\x69\x57\x34\x64\x63\x55\x6d\x6f\x5a\x57\x37\x37\x64\x4d\x47','\x71\x66\x76\x46\x57\x35\x70\x63\x52\x43\x6f\x4f','\x61\x73\x6c\x64\x4d\x30\x74\x63\x51\x61','\x76\x38\x6f\x46\x68\x30\x4a\x63\x55\x5a\x74\x63\x4a\x47','\x43\x32\x47\x5a\x45\x6d\x6f\x47\x6c\x4c\x2f\x63\x48\x57','\x57\x36\x31\x38\x57\x35\x6c\x64\x49\x43\x6f\x39\x57\x52\x39\x31\x42\x71','\x69\x6d\x6b\x6a\x57\x52\x4f\x39\x57\x51\x33\x63\x51\x61','\x6e\x67\x69\x57\x57\x35\x34','\x45\x65\x39\x30\x57\x50\x2f\x63\x49\x57','\x57\x52\x79\x5a\x71\x65\x66\x49\x57\x36\x6e\x53\x67\x61','\x57\x50\x46\x64\x50\x38\x6b\x68\x57\x4f\x68\x64\x48\x6d\x6f\x31','\x73\x65\x53\x42\x57\x36\x68\x64\x4b\x53\x6b\x42\x57\x35\x30\x2f','\x57\x52\x70\x63\x47\x6d\x6f\x68\x57\x52\x56\x64\x52\x59\x4c\x6c','\x57\x36\x75\x45\x57\x35\x76\x45\x57\x37\x6d\x49\x57\x52\x69\x43\x57\x36\x30\x30\x57\x36\x64\x63\x4e\x43\x6f\x30','\x57\x4f\x75\x33\x57\x51\x78\x63\x51\x4e\x30','\x57\x50\x33\x64\x51\x53\x6b\x5a\x57\x34\x78\x64\x4e\x53\x6b\x69\x62\x53\x6f\x67','\x57\x37\x39\x55\x68\x61\x43\x44\x57\x51\x53\x47\x46\x71','\x45\x73\x66\x4b\x57\x50\x58\x72\x57\x4f\x4f\x30\x45\x38\x6b\x50\x79\x53\x6b\x68\x43\x38\x6f\x33','\x57\x50\x79\x43\x57\x36\x35\x36\x7a\x61\x42\x64\x49\x74\x65','\x57\x4f\x69\x2f\x57\x50\x37\x63\x52\x4b\x42\x63\x55\x4b\x71','\x72\x43\x6b\x6e\x57\x36\x4e\x63\x4b\x58\x64\x64\x50\x61','\x79\x73\x7a\x43\x57\x35\x70\x63\x4d\x38\x6f\x75\x57\x35\x33\x63\x51\x6d\x6b\x48\x74\x43\x6f\x66\x57\x36\x79\x45','\x57\x4f\x6e\x78\x65\x6d\x6b\x74\x57\x35\x57\x61\x57\x4f\x72\x44','\x6a\x74\x31\x51\x57\x4f\x33\x63\x4f\x6d\x6f\x36\x57\x36\x61\x34\x57\x36\x76\x52\x77\x64\x75','\x41\x6d\x6b\x6b\x7a\x6d\x6f\x54\x57\x36\x37\x63\x53\x61','\x57\x36\x74\x63\x50\x6d\x6f\x6d\x57\x4f\x78\x64\x52\x73\x57','\x6a\x33\x61\x69\x57\x4f\x64\x64\x4e\x38\x6f\x66\x57\x50\x2f\x63\x49\x57','\x57\x50\x53\x71\x57\x37\x4b\x37\x7a\x71','\x41\x4d\x57\x4b\x70\x6d\x6f\x49\x6e\x4d\x37\x63\x49\x47','\x57\x50\x4a\x64\x53\x6d\x6b\x71\x57\x50\x42\x64\x48\x6d\x6f\x59\x64\x43\x6f\x63','\x57\x36\x6a\x52\x6b\x33\x2f\x64\x53\x57','\x57\x34\x6c\x64\x4a\x38\x6f\x4c\x79\x53\x6b\x48','\x76\x53\x6b\x73\x41\x72\x2f\x64\x52\x48\x53\x6e\x68\x71','\x57\x34\x5a\x63\x54\x38\x6b\x4e\x57\x4f\x5a\x64\x54\x38\x6f\x30\x74\x53\x6b\x55','\x66\x53\x6b\x63\x57\x36\x69\x49\x72\x53\x6b\x67\x57\x37\x74\x63\x50\x57','\x6c\x43\x6b\x67\x57\x34\x53\x33\x45\x71','\x57\x51\x72\x6c\x57\x35\x33\x64\x4e\x63\x52\x64\x49\x64\x42\x63\x49\x71','\x78\x53\x6f\x63\x61\x75\x64\x63\x56\x73\x47','\x57\x4f\x6c\x64\x54\x38\x6b\x70\x57\x51\x33\x64\x51\x47','\x45\x78\x47\x2b\x6d\x6d\x6f\x7a\x6f\x4b\x53','\x57\x52\x43\x69\x66\x77\x2f\x64\x4e\x53\x6f\x41\x57\x36\x44\x4c','\x6a\x43\x6b\x2b\x6c\x73\x79\x45\x66\x53\x6f\x50\x73\x71','\x70\x53\x6b\x56\x57\x36\x7a\x35\x57\
```

---

### Incident Patch 5: `83553705` (2026-06-11)
**Commit Message**: fix(sanitize): skip path/URL-shaped env values in reverse leak scan (#568)

detectEnvValueLeaks reverse-scans every process.env value and flags any that
appears verbatim in content. CI tooling exports many env vars whose value is the
repo checkout path: the runner sets GITHUB_WORKSPACE / RUNNER_WORKSPACE, and
`npm test` additionally sets INIT_CWD / npm_config_local_prefix /
npm_package_json / PWD — all = /home/runner/work/evolver/evolver. Each is a
substring of capsule content that legitimately references the build path, so the
reverse scan reported a false-positive leak. This (a) failed
test/sanitize.test.js:280 on every CI run while passing locally, and (b) would
block every self-PR created from CI over its own runner path.

Filesystem paths and URLs are not secrets, so skip path/URL-shaped env values in
the reverse scan. Genuine sensitive paths in content are still caught by the
local_path pattern scanner and credentialed URLs by db_url / basic_auth — the
reverse scan exists for non-pattern-matchable hardcoded secret values, which are
never paths/URLs. Regression test sets the runner/npm checkout-path vars and
asserts fullLeakCheck stays clean, plus asserts a non-path secret val

**File**: `src/gep/sanitize.js` (modified, +9/-0)
```diff
@@ -218,6 +218,15 @@ function detectEnvValueLeaks(content) {
   for (const [key, val] of Object.entries(process.env)) {
     if (!val || val.length < 8) continue;
     if (ENV_SCAN_SKIP_KEYS.has(key)) continue;
+    // Filesystem paths and URLs are not secrets, and CI tooling exports dozens
+    // of env vars whose value is the repo checkout path — the runner
+    // (GITHUB_WORKSPACE, RUNNER_WORKSPACE) and, when tests run via `npm test`,
+    // npm itself (INIT_CWD, npm_config_local_prefix, npm_package_json, PWD).
+    // Reverse-flagging them is a false positive whenever capsule content
+    // legitimately references the build path: it blocks self-PRs and fails only
+    // under CI. Genuine sensitive paths in content are still caught by the
+    // local_path pattern scanner, and credentialed URLs by db_url / basic_auth.
+    if (/^(\/|[A-Za-z]:\\|[a-z][a-z0-9+.-]*:\/\/)/i.test(val)) continue;
     if (content.includes(val)) {
       leaks.push({ type: 'env_value_leak', envKey: key, value: val.length > 60 ? val.slice(0, 57) + '...' : val, suggestion: 'process.env.' + key });
     }
```

**File**: `test/sanitize.test.js` (modified, +36/-1)
```diff
@@ -302,4 +302,39 @@ const ghLegacyNoreply = scanForLeaks('opened by classicuser@users.noreply.github
 assert.strictEqual(ghLegacyNoreply.found, false,
   'scanForLeaks must NOT flag legacy GitHub noreply addresses (any local part)');
 
-console.log('All sanitize tests passed (68 assertions)');
+// Regression: CI runners + npm populate several env vars with the repo checkout
+// path — GITHUB_WORKSPACE / RUNNER_WORKSPACE from the runner, and INIT_CWD /
+// npm_config_local_prefix / npm_package_json / PWD from `npm test`. When capsule
+// content legitimately references that build path, detectEnvValueLeaks must NOT
+// report it as an env-value leak, or every self-PR from CI would be blocked over
+// its own build path. This failed only under CI (where these vars are set to
+// /home/runner/work/...) until path/URL-shaped env values were skipped.
+const RUNNER_PATH = '/home/runner/work/evolver/evolver';
+const SECRET_VAL = 'zzz9988aa77bb66cc55dd';
+const _ciEnvKeys = ['GITHUB_WORKSPACE', 'INIT_CWD', 'npm_config_local_prefix', 'EVOLVER_TEST_SECRET'];
+const _savedCiEnv = {};
+for (const k of _ciEnvKeys) _savedCiEnv[k] = process.env[k];
+process.env.GITHUB_WORKSPACE = RUNNER_PATH;
+process.env.INIT_CWD = RUNNER_PATH;
+process.env.npm_config_local_prefix = RUNNER_PATH;
+process.env.EVOLVER_TEST_SECRET = SECRET_VAL;
+try {
+  assert.strictEqual(
+    fullLeakCheck('build trace from /home/runner/work/evolver/evolver/src/foo.js').found,
+    false,
+    'CI runner/npm checkout-path env vars must NOT be flagged as env-value leaks'
+  );
+  // Security guarantee intact: a non-path secret env value is still reverse-detected.
+  assert.strictEqual(
+    fullLeakCheck('config contains ' + SECRET_VAL + ' inline').found,
+    true,
+    'non-path secret env value must still be reverse-detected'
+  );
+} finally {
+  for (const k of _ciEnvKeys) {
+    if (_savedCiEnv[k] === undefined) delete process.env[k];
+    else process.env[k] = _savedCiEnv[k];
+  }
+}
+
+console.log('All sanitize tests passed (70 assertions)');
```

---

### Incident Patch 6: `c3a0098c` (2026-06-08)
**Commit Message**: docs: license to GPL-3.0-or-later; drop internal Public Release section; fix issue-repo/runtime refs

- License section now states GPL-3.0-or-later (was stale MIT) in README / README.zh-CN / SKILL.
- Remove the maintainer-only "Public Release" section (non-existent npm scripts + internal publish flow).
- EVOLVER_ISSUE_REPO documented default -> EvoMap/evolver (matches code default).
- Point auto-issue hint (index.js) and skill attribution footer (skillPublisher.js) at EvoMap/evolver.
- Normalize `evolver run` -> `evolver`; rewrite Roadmap into directional items.
- Drop .github/CODEOWNERS from the public mirror.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>

**File**: `.github/CODEOWNERS` (removed, +0/-63)
```diff
@@ -1,63 +0,0 @@
-# Code owners for this repository
-# Format: each rule grants automatic review-request to the listed owner(s)
-# when a matching path is touched in a PR. Combined with branch protection's
-# "Require review from Code Owners" rule on main, these owners must approve
-# the PR before it can merge.
-#
-# Multiple owners on each line means GitHub will auto-request a review from
-# all listed owners on a matching PR; ANY one of them approving is sufficient
-# to satisfy the branch-protection 'require code owner review' gate. This is
-# the agreed fallback order: autogame-17 primary, forrestlinfeng + cloudcarver
-# as backups when the primary is unavailable.
-#
-# Why we need this: PR #34 (2026-05-10) was self-merged by the author 2 minutes
-# before a maintainer review comment landed, shipping a missing obfuscate
-# registration into main. CODEOWNERS + branch protection make that pattern
-# physically impossible.
-
-# Default: every file is owned by autogame-17 unless a more specific rule below
-# overrides it. Keeps coverage complete even for files we forget to call out.
-*                              @autogame-17 @forrestlinfeng @cloudcarver
-
-# High-risk paths -- listed explicitly so GitHub UI surfaces "Owner review
-# required" prominently when these are touched, even if the catch-all above
-# would already cover them. New contributors should treat any change here
-# as a multi-day review cycle.
-
-# GEP schemas (Gene / Capsule / Task / future). Validators and defaults must
-# stay in sync with hub-side expectations; shallow-copy bugs and validator-
-# wiring gaps in this directory have a track record (PR #25 / #27 / audit #30).
-/src/gep/schemas/              @autogame-17 @forrestlinfeng @cloudcarver
-
-# Pipeline modules. Module-load order vs dotenv is fragile here; refactors
-# in PR #20-#24 introduced multiple dotenv-ordering and missing-import
-# regressions before merge.
-/src/evolve/                   @autogame-17 @forrestlinfeng @cloudcarver
-
-# Content-addressable storage and integrity primitives. Any change here
-# changes asset_id semantics across all stored capsules.
-/src/gep/contentHash.js        @autogame-17 @forrestlinfeng @cloudcarver
-/src/gep/crypto.js             @autogame-17 @forrestlinfeng @cloudcarver
-/src/gep/integrityCheck.js     @autogame-17 @forrestlinfeng @cloudcarver
-/src/gep/shield.js             @autogame-17 @forrestlinfeng @cloudcarver
-/src/gep/hubVerify.js          @autogame-17 @forrestlinfeng @cloudcarver
-
-# Anything that touches secrets, sanitization, or proxy auth.
-/src/gep/sanitize.js           @autogame-17 @forrestlinfeng @cloudcarver
-/src/proxy/                    @autogame-17 @forrestlinfeng @cloudcarver
-
-# Public-mirror surface. Manifest mistakes leak source / runtime assets to
-# npm; build/publish scripts directly drive npm + GitHub Release.
-/public.manifest.json          @autogame-17 @forrestlinfeng @cloudcarver
-/scripts/build_public.js       @autogame-17 @forrestlinfeng @cloudcarver
-/scripts/publish_public.js     @autogame-17 @forrestlinfeng @cloudcarver
-/scripts/pre_publish_check.js  @autogame-17 @forrestlinfeng @cloudcarver
-/scripts/build_binaries.js     @autogame-17 @forrestlinfeng @cloudcarver
-/scripts/deploy.sh             @autogame-17 @forrestlinfeng @cloudcarver
-
-# Repo metadata that gates everything else.
-/.github/                      @autogame-17 @forrestlinfeng @cloudcarver
-/.cursor/                      @autogame-17 @forrestlinfeng @cloudcarver
-/CODEOWNERS                    @autogame-17 @forrestlinfeng @cloudcarver
-/package.json                  @autogame-17 @forrestlinfeng @cloudcarver
-/package-lock.json             @autogame-17 @forrestlinfeng @cloudcarver
```

**File**: `README.ja-JP.md` (modified, +9/-32)
```diff
@@ -181,7 +181,7 @@ evolver --loop
 | ループ (`evolver --loop`) | 適応的スリープ付きのデーモンループで上記を繰り返す |
 | OpenClaw 内 | ホストランタイムが `sessions_spawn(...)` などの stdout ディレクティブを解釈 |
 
-> **`--loop` は「動作中のエージェントをリアルタイムで支援する」モードではありません。** ループモードはバックグラウンドの自己メンテナンス（validator 実行、worker タスク、ATP マーチャント自動配信、solidify）のためのもので、その stdout は evolver 自身が消費します。したがって、たとえ OpenClaw / Cursor / Claude Code がインストールされていても、ループモードで出力される `sessions_spawn(...)` ディレクティブはこれらのホストには届きません。evolver にライブセッションを観察・補助させたい場合は、そのエージェントセッションの **内部から** `evolver run` を呼び出してください（OpenClaw はその単一ランの stdout ディレクティブを取り込みます）。OpenClaw ユーザーはさらに、`AGENT_NAME`（または `AGENT_SESSIONS_DIR`）が実際にセッションを生成しているエージェントのディレクトリ（`~/.openclaw/agents/<名前>/sessions/`）を指していることを確認してください -- さもないと evolver は自身のログにフォールバックし、「空転している」ように見えます。
+> **`--loop` は「動作中のエージェントをリアルタイムで支援する」モードではありません。** ループモードはバックグラウンドの自己メンテナンス（validator 実行、worker タスク、ATP マーチャント自動配信、solidify）のためのもので、その stdout は evolver 自身が消費します。したがって、たとえ OpenClaw / Cursor / Claude Code がインストールされていても、ループモードで出力される `sessions_spawn(...)` ディレクティブはこれらのホストには届きません。evolver にライブセッションを観察・補助させたい場合は、そのエージェントセッションの **内部から** `evolver` を呼び出してください（OpenClaw はその単一ランの stdout ディレクティブを取り込みます）。OpenClaw ユーザーはさらに、`AGENT_NAME`（または `AGENT_SESSIONS_DIR`）が実際にセッションを生成しているエージェントのディレクトリ（`~/.openclaw/agents/<名前>/sessions/`）を指していることを確認してください -- さもないと evolver は自身のログにフォールバックし、「空転している」ように見えます。
 
 ## 対象ユーザー
 
@@ -404,7 +404,7 @@ EVOLVE_REPORT_TOOL=feishu-card
 永続的にオプトアウト：
 
 ```bash
-EVOLVER_VALIDATOR_ENABLED=0 evolver run --loop
+EVOLVER_VALIDATOR_ENABLED=0 evolver --loop
 ```
 
 ### GitHub Issue 自動報告
@@ -414,7 +414,7 @@ evolver が持続的な失敗（失敗ループまたは高い失敗率での繰
 | 変数 | デフォルト | 説明 |
 |----------|---------|-------------|
 | `EVOLVER_AUTO_ISSUE` | `true` | 自動 issue 報告の有効/無効 |
-| `EVOLVER_ISSUE_REPO` | `autogame-17/capability-evolver` | ターゲット GitHub リポジトリ (owner/repo) |
+| `EVOLVER_ISSUE_REPO` | `EvoMap/evolver` | ターゲット GitHub リポジトリ (owner/repo) |
 | `EVOLVER_ISSUE_COOLDOWN_MS` | `86400000` (24h) | 同じエラーシグネチャのクールダウン期間 |
 | `EVOLVER_ISSUE_MIN_STREAK` | `5` | トリガーする最小連続失敗ストリーク |
 
@@ -456,33 +456,6 @@ evolver が持続的な失敗（失敗ループまたは高い失敗率での繰
 
 `index.js` と `evolve.js` の `sessions_spawn(...)` 文字列は、直接の関数呼び出しではなく、**stdout へのテキスト出力**です。これらが解釈されるかどうかはホストランタイム（例: OpenClaw プラットフォーム）に依存します。evolver 自体は `sessions_spawn` を実行可能コードとして呼び出しません。
 
-## パブリックリリース
-
-このリポジトリはパブリックディストリビューションです。
-
-- パブリック出力のビルド: `npm run build`
-- パブリック出力の公開: `npm run publish:public`
-- ドライラン: `DRY_RUN=true npm run publish:public`
-
-必須環境変数:
-
-- `PUBLIC_REMOTE` (デフォルト: `public`)
-- `PUBLIC_REPO` (例: `EvoMap/evolver`)
-- `PUBLIC_OUT_DIR` (デフォルト: `dist-public`)
-- `PUBLIC_USE_BUILD_OUTPUT` (デフォルト: `true`)
-
-オプションの環境変数:
-
-- `SOURCE_BRANCH` (デフォルト: `main`)
-- `PUBLIC_BRANCH` (デフォルト: `main`)
-- `RELEASE_TAG` (例: `v1.0.41`)
-- `RELEASE_TITLE` (例: `v1.0.41 - GEP protocol`)
-- `RELEASE_NOTES` または `RELEASE_NOTES_FILE`
-- GitHub Release 作成用の `GITHUB_TOKEN`（または `GH_TOKEN` / `GITHUB_PAT`）
-- `RELEASE_SKIP` (GitHub Release の作成をスキップするには `true`；デフォルトは作成)
-- `RELEASE_USE_GH` (GitHub API の代わりに `gh` CLI を使用するには `true`)
-- `PUBLIC_RELEASE_ONLY` (既存のタグに対して Release のみを作成するには `true`；公開なし)
-
 ## バージョニング (SemVer)
 
 MAJOR.MINOR.PATCH
@@ -517,8 +490,12 @@ MAJOR.MINOR.PATCH
 
 ## ロードマップ
 
-- 1 分間のデモワークフローを追加
-- 代替案との比較表を追加
+方針であり確約ではありません。最新のバックログは [GitHub Issues](https://github.com/EvoMap/evolver/issues) を参照してください。
+
+- **オンボーディング**: 1 分間のクイックスタートデモと、他のエージェント進化手法との比較表。
+- **GEP 統合の深化**: より豊富なシグナル抽出と Gene / Capsule 選択、および再利用アナリティクス。
+- **メモリとスキル**: セッション結果を再利用可能な Gene / Capsule へより速く蒸留。
+- **対応ランタイムの拡大**: Cursor / Claude Code / Codex / Kiro / opencode / OpenClaw 以外のホスト統合を拡充。
 
 ## Star 履歴
 
```

**File**: `README.ko-KR.md` (modified, +9/-32)
```diff
@@ -180,7 +180,7 @@ evolver --loop
 | 루프 (`evolver --loop`) | 적응형 슬립이 포함된 데몬 루프에서 위 과정을 반복 |
 | OpenClaw 내부 | 호스트 런타임이 `sessions_spawn(...)` 등 stdout 지시문을 해석 |
 
-> **`--loop`은 "실행 중인 에이전트를 실시간으로 보조하는" 모드가 아닙니다.** 루프 모드는 백그라운드 자가 유지보수(validator 실행, worker 작업, ATP 상인 자동 배달, solidify)를 위한 것이며, 그 stdout은 evolver 자신이 소비합니다. 따라서 OpenClaw / Cursor / Claude Code가 설치되어 있더라도, 루프 모드에서 출력되는 `sessions_spawn(...)` 지시문은 이 호스트들에 전달되지 않습니다. 라이브 세션을 evolver가 관찰·보조하게 하려면, 해당 에이전트 세션 **내부에서** `evolver run`을 호출하세요(OpenClaw는 그 단일 실행의 stdout 지시문을 처리합니다). OpenClaw 사용자는 추가로, `AGENT_NAME`(또는 `AGENT_SESSIONS_DIR`)이 실제로 세션을 생성하는 에이전트 디렉터리(`~/.openclaw/agents/<이름>/sessions/`)를 가리키는지 확인하세요 -- 그렇지 않으면 evolver는 자신의 로그로 폴백하며, "빈 사이클만 돌고 있는" 것처럼 보입니다.
+> **`--loop`은 "실행 중인 에이전트를 실시간으로 보조하는" 모드가 아닙니다.** 루프 모드는 백그라운드 자가 유지보수(validator 실행, worker 작업, ATP 상인 자동 배달, solidify)를 위한 것이며, 그 stdout은 evolver 자신이 소비합니다. 따라서 OpenClaw / Cursor / Claude Code가 설치되어 있더라도, 루프 모드에서 출력되는 `sessions_spawn(...)` 지시문은 이 호스트들에 전달되지 않습니다. 라이브 세션을 evolver가 관찰·보조하게 하려면, 해당 에이전트 세션 **내부에서** `evolver`을 호출하세요(OpenClaw는 그 단일 실행의 stdout 지시문을 처리합니다). OpenClaw 사용자는 추가로, `AGENT_NAME`(또는 `AGENT_SESSIONS_DIR`)이 실제로 세션을 생성하는 에이전트 디렉터리(`~/.openclaw/agents/<이름>/sessions/`)를 가리키는지 확인하세요 -- 그렇지 않으면 evolver는 자신의 로그로 폴백하며, "빈 사이클만 돌고 있는" 것처럼 보입니다.
 
 ## 대상 사용자
 
@@ -403,7 +403,7 @@ EVOLVE_REPORT_TOOL=feishu-card
 영구적으로 옵트아웃:
 
 ```bash
-EVOLVER_VALIDATOR_ENABLED=0 evolver run --loop
+EVOLVER_VALIDATOR_ENABLED=0 evolver --loop
 ```
 
 ### 자동 GitHub Issue 보고
@@ -413,7 +413,7 @@ evolver가 지속적인 실패(실패 루프 또는 높은 실패율의 반복 
 | 변수 | 기본값 | 설명 |
 |------|--------|------|
 | `EVOLVER_AUTO_ISSUE` | `true` | 자동 issue 보고 활성화/비활성화 |
-| `EVOLVER_ISSUE_REPO` | `autogame-17/capability-evolver` | 대상 GitHub 저장소 (owner/repo) |
+| `EVOLVER_ISSUE_REPO` | `EvoMap/evolver` | 대상 GitHub 저장소 (owner/repo) |
 | `EVOLVER_ISSUE_COOLDOWN_MS` | `86400000` (24시간) | 동일 오류 시그니처의 쿨다운 기간 |
 | `EVOLVER_ISSUE_MIN_STREAK` | `5` | 보고를 트리거하는 최소 연속 실패 횟수 |
 
@@ -455,33 +455,6 @@ evolver가 지속적인 실패(실패 루프 또는 높은 실패율의 반복 
 
 `index.js`와 `evolve.js`의 `sessions_spawn(...)` 문자열은 직접적인 함수 호출이 아닌 **stdout으로의 텍스트 출력**입니다. 이것이 해석되는지 여부는 호스트 런타임(예: OpenClaw 플랫폼)에 따라 다릅니다. evolver 자체는 `sessions_spawn`을 실행 가능한 코드로 호출하지 않습니다.
 
-## 공개 릴리스
-
-이 저장소는 공개 배포판입니다.
-
-- 공개용 빌드: `npm run build`
-- 공개용 게시: `npm run publish:public`
-- 드라이런: `DRY_RUN=true npm run publish:public`
-
-필수 환경 변수:
-
-- `PUBLIC_REMOTE` (기본값: `public`)
-- `PUBLIC_REPO` (예: `EvoMap/evolver`)
-- `PUBLIC_OUT_DIR` (기본값: `dist-public`)
-- `PUBLIC_USE_BUILD_OUTPUT` (기본값: `true`)
-
-선택 환경 변수:
-
-- `SOURCE_BRANCH` (기본값: `main`)
-- `PUBLIC_BRANCH` (기본값: `main`)
-- `RELEASE_TAG` (예: `v1.0.41`)
-- `RELEASE_TITLE` (예: `v1.0.41 - GEP protocol`)
-- `RELEASE_NOTES` 또는 `RELEASE_NOTES_FILE`
-- GitHub Release 생성용 `GITHUB_TOKEN` (또는 `GH_TOKEN` / `GITHUB_PAT`)
-- `RELEASE_SKIP` (`true`로 설정하면 GitHub Release 생성을 건너뜀; 기본값은 생성)
-- `RELEASE_USE_GH` (`true`로 설정하면 GitHub API 대신 `gh` CLI 사용)
-- `PUBLIC_RELEASE_ONLY` (`true`로 설정하면 기존 태그에 대해 Release만 생성; 코드 게시 없음)
-
 ## 버전 관리 (SemVer)
 
 MAJOR.MINOR.PATCH
@@ -516,8 +489,12 @@ MAJOR.MINOR.PATCH
 
 ## 로드맵
 
-- 1분 데모 워크플로 추가
-- 대안과의 비교 표 추가
+방향성이며 확약은 아닙니다. 최신 백로그는 [GitHub Issues](https://github.com/EvoMap/evolver/issues)에서 확인하세요.
+
+- **온보딩**: 1분 퀵스타트 데모와 대안 에이전트 진화 방식과의 비교 표.
+- **GEP 통합 심화**: 더 풍부한 시그널 추출과 Gene / Capsule 선택, 그리고 재사용 분석.
+- **메모리와 스킬**: 세션 결과를 재사용 가능한 Gene / Capsule로 더 빠르게 증류.
+- **런타임 커버리지 확대**: Cursor / Claude Code / Codex / Kiro / opencode / OpenClaw 외 호스트 통합 확대.
 
 ## Star History
 
```

**File**: `README.md` (modified, +10/-33)
```diff
@@ -203,7 +203,7 @@ When running inside a host runtime (e.g., [OpenClaw](https://openclaw.com)), the
 | Loop (`evolver --loop`) | Repeats the above in a daemon loop with adaptive sleep |
 | Inside OpenClaw | Host runtime interprets stdout directives like `sessions_spawn(...)` |
 
-> **`--loop` is not a real-time agent assistant.** Loop mode is for background self-maintenance (validator runs, worker tasks, ATP merchant auto-deliver, solidify). Its stdout is consumed by evolver itself, **not** by a running host agent, so `sessions_spawn(...)` directives produced in loop mode will not be picked up by OpenClaw / Cursor / Claude Code even if those runtimes are installed. If you want evolver to observe and advise a live agent session, call `evolver run` from **inside** that agent session (OpenClaw will pick up the stdout directives on that single run). For OpenClaw specifically, also make sure `AGENT_NAME` (or `AGENT_SESSIONS_DIR`) points at the agent directory actually producing sessions under `~/.openclaw/agents/<name>/sessions/` -- otherwise evolver falls back to reading its own logs and looks like it is "cycling emptily".
+> **`--loop` is not a real-time agent assistant.** Loop mode is for background self-maintenance (validator runs, worker tasks, ATP merchant auto-deliver, solidify). Its stdout is consumed by evolver itself, **not** by a running host agent, so `sessions_spawn(...)` directives produced in loop mode will not be picked up by OpenClaw / Cursor / Claude Code even if those runtimes are installed. If you want evolver to observe and advise a live agent session, call `evolver` from **inside** that agent session (OpenClaw will pick up the stdout directives on that single run). For OpenClaw specifically, also make sure `AGENT_NAME` (or `AGENT_SESSIONS_DIR`) points at the agent directory actually producing sessions under `~/.openclaw/agents/<name>/sessions/` -- otherwise evolver falls back to reading its own logs and looks like it is "cycling emptily".
 
 ## Who This Is For / Not For
 
@@ -442,7 +442,7 @@ Persistent flag override: when the env is unset, the runtime reads `~/.evomap/fe
 To opt out permanently:
 
 ```bash
-EVOLVER_VALIDATOR_ENABLED=0 evolver run --loop
+EVOLVER_VALIDATOR_ENABLED=0 evolver --loop
 ```
 
 ### Auto GitHub Issue Reporting
@@ -452,7 +452,7 @@ When the evolver detects persistent failures (failure loop or recurring errors w
 | Variable | Default | Description |
 |----------|---------|-------------|
 | `EVOLVER_AUTO_ISSUE` | `true` | Enable/disable auto issue reporting |
-| `EVOLVER_ISSUE_REPO` | `autogame-17/capability-evolver` | Target GitHub repository (owner/repo) |
+| `EVOLVER_ISSUE_REPO` | `EvoMap/evolver` | Target GitHub repository (owner/repo) |
 | `EVOLVER_ISSUE_COOLDOWN_MS` | `86400000` (24h) | Cooldown period for the same error signature |
 | `EVOLVER_ISSUE_MIN_STREAK` | `5` | Minimum consecutive failure streak to trigger |
 
@@ -494,33 +494,6 @@ External Gene/Capsule assets ingested via `scripts/a2a_ingest.js` are staged in
 
 The `sessions_spawn(...)` strings in `index.js` and `evolve.js` are **text output to stdout**, not direct function calls. Whether they are interpreted depends on the host runtime (e.g., OpenClaw platform). The evolver itself does not invoke `sessions_spawn` as executable code.
 
-## Public Release
-
-This repository is the public distribution.
-
-- Build public output: `npm run build`
-- Publish public output: `npm run publish:public`
-- Dry run: `DRY_RUN=true npm run publish:public`
-
-Required env vars:
-
-- `PUBLIC_REMOTE` (default: `public`)
-- `PUBLIC_REPO` (e.g. `EvoMap/evolver`)
-- `PUBLIC_OUT_DIR` (default: `dist-public`)
-- `PUBLIC_USE_BUILD_OUTPUT` (default: `true`)
-
-Optional env vars:
-
-- `SOURCE_BRANCH` (default: `main`)
-- `PUBLIC_BRANCH` (default: `main`)
-- `RELEASE_TAG` (e.g. `v1.0.41`)
-- `RELEASE_TITLE` (e.g. `v1.0.41 - GEP protocol`)
-- `RELEASE_NOTES` or `RELEASE_NOTES_FILE`
-- `GITHUB_TOKEN` (or `GH_TOKEN` / `GITHUB_PAT`) for GitHub Release 
```

**File**: `README.zh-CN.md` (modified, +4/-31)
```diff
@@ -178,7 +178,7 @@ evolver --loop
 | 循环模式 (`evolver --loop`) | 在守护进程循环中重复上述流程，带自适应休眠 |
 | 在 OpenClaw 中 | 宿主运行时解释 stdout 中的指令（如 `sessions_spawn(...)`） |
 
-> **`--loop` 不是"实时辅助正在干活的 agent"的模式。** 循环模式用于后台自维护任务（validator 验证、worker 任务、ATP 商家自动交付、solidify），它的 stdout 是被 evolver 自己消费的，**不会**传给正在运行的 OpenClaw / Cursor / Claude Code agent——即使这些宿主已经安装，`sessions_spawn(...)` 指令在循环模式下也不会被它们接收。如果你想让 evolver 观察并辅助一次具体的 agent 会话，请在那个 agent 会话内部调用 `evolver run`（一次一轮），OpenClaw 会在这次运行中接管 stdout 指令。对 OpenClaw 用户还要特别注意：`AGENT_NAME`（或 `AGENT_SESSIONS_DIR`）必须指向真正在产生 session 的那个 agent 目录（`~/.openclaw/agents/<名字>/sessions/`），否则 evolver 会回退到读自己的日志，看上去就像在"空转"。
+> **`--loop` 不是"实时辅助正在干活的 agent"的模式。** 循环模式用于后台自维护任务（validator 验证、worker 任务、ATP 商家自动交付、solidify），它的 stdout 是被 evolver 自己消费的，**不会**传给正在运行的 OpenClaw / Cursor / Claude Code agent——即使这些宿主已经安装，`sessions_spawn(...)` 指令在循环模式下也不会被它们接收。如果你想让 evolver 观察并辅助一次具体的 agent 会话，请在那个 agent 会话内部调用 `evolver`（一次一轮），OpenClaw 会在这次运行中接管 stdout 指令。对 OpenClaw 用户还要特别注意：`AGENT_NAME`（或 `AGENT_SESSIONS_DIR`）必须指向真正在产生 session 的那个 agent 目录（`~/.openclaw/agents/<名字>/sessions/`），否则 evolver 会回退到读自己的日志，看上去就像在"空转"。
 
 ## 适用 / 不适用场景
 
@@ -416,7 +416,7 @@ EVOLVE_REPORT_TOOL=feishu-card
 永久关闭：
 
 ```bash
-EVOLVER_VALIDATOR_ENABLED=0 evolver run --loop
+EVOLVER_VALIDATOR_ENABLED=0 evolver --loop
 ```
 
 ### 自动 GitHub Issue 上报
@@ -426,7 +426,7 @@ EVOLVER_VALIDATOR_ENABLED=0 evolver run --loop
 | 变量 | 默认值 | 说明 |
 |------|--------|------|
 | `EVOLVER_AUTO_ISSUE` | `true` | 是否启用自动 issue 上报 |
-| `EVOLVER_ISSUE_REPO` | `autogame-17/capability-evolver` | 目标 GitHub 仓库（owner/repo） |
+| `EVOLVER_ISSUE_REPO` | `EvoMap/evolver` | 目标 GitHub 仓库（owner/repo） |
 | `EVOLVER_ISSUE_COOLDOWN_MS` | `86400000`（24 小时） | 同类错误签名的冷却期 |
 | `EVOLVER_ISSUE_MIN_STREAK` | `5` | 触发上报所需的最低连续失败次数 |
 
@@ -474,33 +474,6 @@ EVOLVER_VALIDATOR_ENABLED=0 evolver run --loop
 2. **稳定性优先**：如果近期错误率较高，强制进入修复模式，暂停创新功能。
 3. **环境检测**：外部集成（如 Git 同步）仅在检测到相应插件存在时才会启用。
 
-## Public 发布
-
-本仓库为公开发行版本。
-
-- 构建公开产物：`npm run build`
-- 发布公开产物：`npm run publish:public`
-- 演练：`DRY_RUN=true npm run publish:public`
-
-必填环境变量：
-
-- `PUBLIC_REMOTE`（默认：`public`）
-- `PUBLIC_REPO`（例如 `EvoMap/evolver`）
-- `PUBLIC_OUT_DIR`（默认：`dist-public`）
-- `PUBLIC_USE_BUILD_OUTPUT`（默认：`true`）
-
-可选环境变量：
-
-- `SOURCE_BRANCH`（默认：`main`）
-- `PUBLIC_BRANCH`（默认：`main`）
-- `RELEASE_TAG`（例如 `v1.0.41`）
-- `RELEASE_TITLE`（例如 `v1.0.41 - GEP protocol`）
-- `RELEASE_NOTES` 或 `RELEASE_NOTES_FILE`
-- `GITHUB_TOKEN`（或 `GH_TOKEN` / `GITHUB_PAT`，用于创建 GitHub Release）
-- `RELEASE_SKIP`（`true` 则跳过创建 GitHub Release；默认会创建）
-- `RELEASE_USE_GH`（`true` 则使用 `gh` CLI，否则默认走 GitHub API）
-- `PUBLIC_RELEASE_ONLY`（`true` 则仅为已存在的 tag 创建 Release；不发布代码）
-
 ## 版本号规则（SemVer）
 
 MAJOR.MINOR.PATCH
@@ -557,4 +530,4 @@ MAJOR.MINOR.PATCH
 
 ## 许可证
 
-[MIT](https://opensource.org/licenses/MIT)
+[GPL-3.0-or-later](https://opensource.org/licenses/GPL-3.0)
```

---

### Incident Patch 7: `a7d564f2` (2026-06-03)
**Commit Message**: fix(loop): break Ralph-loop when a bridge-mode pending run goes stale (#556) (#559)

* fix(loop): break Ralph-loop when a bridge-mode pending run goes stale (#556)

In `--loop` mode the daemon defaults to EVOLVE_BRIDGE=true (since v1.85.0),
where a sub-agent solidifies asynchronously. If that sub-agent produces no
changes, crashes, or the daemon restarts onto a stale pending state,
`last_solidify.run_id` never catches up to `last_run.run_id`, so
`isPendingSolidify()` stays true and the gate sleeps forever. The existing
auto-reject safety net only ran when EVOLVE_BRIDGE=false, leaving the default
bridge path with no escape.

Rather than unconditionally rejecting every pending run after evolve.run()
(which would wrongly discard runs a live sub-agent is still working, and
re-break the #96 "33 days of zero events" failure mode), this gates the
auto-reject on a staleness TTL: a pending run is only cleared once it is older
than the sub-agent's own hard ceiling (cycleTimeoutMs, default 45 min), at
which point it cannot still be running. A live sub-agent's in-flight pending
state is left untouched.

- add pendingRunAgeMs(state, now): age from last_run.created_at/started_at,
  returns null 

**File**: `index.js` (modified, +106/-2)
```diff
@@ -178,6 +178,65 @@ function isPendingSolidify(state) {
   return String(lastSolid.run_id) !== String(lastRun.run_id);
 }
 
+/**
+ * Age (ms) of the currently-pending run, measured from last_run.created_at.
+ * Returns null when there is no pending run or no parseable timestamp — callers
+ * MUST treat null as "age unknown, do not force-reject" so a malformed/missing
+ * timestamp never causes us to discard a run that a sub-agent is still working.
+ * @param {object} state - parsed evolution_solidify_state.json
+ * @param {number} now - epoch ms (injected for deterministic tests)
+ * @returns {number|null}
+ */
+function pendingRunAgeMs(state, now) {
+  if (!isPendingSolidify(state)) return null;
+  const lastRun = state && state.last_run ? state.last_run : null;
+  const stamp = lastRun && (lastRun.created_at || lastRun.started_at);
+  if (!stamp) return null;
+  const t = Date.parse(String(stamp));
+  if (!Number.isFinite(t)) return null;
+  const age = Number(now) - t;
+  return age >= 0 ? age : null;
+}
+
+/**
+ * Issue #556: auto-reject a pending run that has been waiting longer than the
+ * staleness TTL. In Bridge mode the sub-agent solidifies asynchronously, so a
+ * pending run is normal *while the sub-agent is alive*. But if the sub-agent
+ * produced no changes, crashed, or the daemon restarted onto a stale pending
+ * state, last_solidify never catches up and the Ralph-loop gate sleeps forever.
+ * Once the pending run is older than the sub-agent's own hard ceiling
+ * (cycleTimeoutMs) it cannot still be running, so we clear it. This is distinct
+ * from rejectPendingRun()'s bridge-disabled reason so the two paths stay
+ * auditable in the state file.
+ * @returns {boolean} true if a stale pending run was found and rejected
+ */
+function rejectStalePendingRun(statePath) {
+  try {
+    const state = readJsonSafe(statePath);
+    // Re-check pending status under this fresh read (TOCTOU guard): if the
+    // sub-agent solidified between the gate's age snapshot and now, the run is
+    // no longer pending and we MUST NOT overwrite that successful solidify with
+    // a rejection. isPendingSolidify() is true only when last_run.run_id
+    // exists, so this also subsumes the run_id presence check.
+    if (state && isPendingSolidify(state)) {
+      state.last_solidify = {
+        run_id: state.last_run.run_id,
+        rejected: true,
+        reason: 'stale_pending_no_solidify_autoreject_no_rollback',
+        timestamp: new Date().toISOString(),
+      };
+      const tmp = `${statePath}.tmp`;
+      fs.writeFileSync(tmp, JSON.stringify(state, null, 2) + '\n', 'utf8');
+      fs.renameSync(tmp, statePath);
+      return true;
+    }
+  } catch (e) {
+    console.warn('[Loop] Failed to clear stale pending run state: ' + (e.message || e));
+  }
+
+  return false;
+}
+
 function parseMs(v, fallback) {
   const n = parseInt(String(v == null ? '' : v), 10);
   if (Number.isFinite(n)) return Math.max(0, n);
@@ -1177,6 +1236,27 @@ async function main() {
         const cycleTimeoutMs = parseMs(process.env.EVOLVER_CYCLE_TIMEOUT_MS, 2700000); // 45 min default
         const progressUpdateMs = parseMs(process.env.EVOLVER_PROGRESS_UPDATE_MS, 60000); // 1 min default
 
+        // Issue #556: staleness TTL for a pending (un-solidified) run. In Bridge
+        // mode the gate below sleeps while a sub-agent solidifies asynchronously,
+        // which is correct *while the sub-agent is alive*. If the sub-agent made
+        // no changes / crashed / the daemon restarted onto a stale pending state,
+        // last_solidify never catches up and the gate would sleep forever. Once a
+        // pending run is older than the sub-agent's own hard ceiling it cannot
+        // still be running, so we auto-reject it and let the next cycle proceed.
+        //
+        // The default is the cycle hard-ceiling -- but ONLY when that ceiling is
+        // actually enforced. If EVOLVER_CYCLE_TIMEOUT_ENABLED=false (or the
+        //
```

**File**: `test/loopMode.test.js` (modified, +155/-1)
```diff
@@ -3,7 +3,13 @@ const assert = require('node:assert/strict');
 const fs = require('fs');
 const os = require('os');
 const path = require('path');
-const { rejectPendingRun, isPendingSolidify, readJsonSafe } = require('../index.js');
+const {
+  rejectPendingRun,
+  rejectStalePendingRun,
+  isPendingSolidify,
+  pendingRunAgeMs,
+  readJsonSafe,
+} = require('../index.js');
 
 const savedEnv = {};
 const envKeys = [
@@ -90,6 +96,91 @@ describe('isPendingSolidify', () => {
   });
 });
 
+describe('pendingRunAgeMs (issue #556)', () => {
+  const NOW = Date.parse('2026-06-03T12:00:00.000Z');
+
+  it('returns null when there is no pending run', () => {
+    assert.equal(pendingRunAgeMs(null, NOW), null);
+    assert.equal(pendingRunAgeMs({}, NOW), null);
+    assert.equal(pendingRunAgeMs({
+      last_run: { run_id: 'r1' },
+      last_solidify: { run_id: 'r1' },
+    }, NOW), null);
+  });
+
+  it('returns null when pending but no parseable timestamp (age unknown -> never force-reject)', () => {
+    assert.equal(pendingRunAgeMs({ last_run: { run_id: 'r1' } }, NOW), null);
+    assert.equal(pendingRunAgeMs({ last_run: { run_id: 'r1', created_at: 'not-a-date' } }, NOW), null);
+  });
+
+  it('computes age from created_at', () => {
+    const created = new Date(NOW - 90 * 1000).toISOString();
+    assert.equal(pendingRunAgeMs({ last_run: { run_id: 'r1', created_at: created } }, NOW), 90 * 1000);
+  });
+
+  it('falls back to started_at when created_at is absent', () => {
+    const started = new Date(NOW - 30 * 1000).toISOString();
+    assert.equal(pendingRunAgeMs({ last_run: { run_id: 'r1', started_at: started } }, NOW), 30 * 1000);
+  });
+
+  it('returns null for a future timestamp (clock skew -> do not force-reject)', () => {
+    const future = new Date(NOW + 60 * 1000).toISOString();
+    assert.equal(pendingRunAgeMs({ last_run: { run_id: 'r1', created_at: future } }, NOW), null);
+  });
+});
+
+describe('rejectStalePendingRun (issue #556)', () => {
+  it('marks a pending run rejected with the stale-specific reason, preserving untracked files', () => {
+    const stateDir = path.join(tmpDir, 'memory', 'evolution');
+    fs.mkdirSync(stateDir, { recursive: true });
+    const sp = path.join(stateDir, 'evolution_solidify_state.json');
+    fs.writeFileSync(sp, JSON.stringify({ last_run: { run_id: 'run_stale' } }, null, 2));
+    fs.writeFileSync(path.join(tmpDir, 'KEEP.md'), 'keep me\n');
+
+    const changed = rejectStalePendingRun(sp);
+    const state = JSON.parse(fs.readFileSync(sp, 'utf8'));
+
+    assert.equal(changed, true);
+    assert.equal(state.last_solidify.run_id, 'run_stale');
+    assert.equal(state.last_solidify.rejected, true);
+    // Distinct reason from rejectPendingRun() so the two paths stay auditable.
+    assert.equal(state.last_solidify.reason, 'stale_pending_no_solidify_autoreject_no_rollback');
+    assert.equal(fs.readFileSync(path.join(tmpDir, 'KEEP.md'), 'utf8'), 'keep me\n');
+    // After rejection the run is no longer pending.
+    assert.equal(isPendingSolidify(state), false);
+  });
+
+  it('returns false when there is no pending run to reject', () => {
+    const stateDir = path.join(tmpDir, 'memory', 'evolution');
+    fs.mkdirSync(stateDir, { recursive: true });
+    const sp = path.join(stateDir, 'evolution_solidify_state.json');
+    fs.writeFileSync(sp, JSON.stringify({}, null, 2));
+    assert.equal(rejectStalePendingRun(sp), false);
+  });
+
+  it('does NOT overwrite a run that already solidified (TOCTOU guard, Bugbot #559 High)', () => {
+    // If the sub-agent solidifies between the gate's age snapshot and this
+    // write, last_run == last_solidify (not pending) and a rejection would
+    // corrupt a successful solidify. rejectStalePendingRun must re-check
+    // pending status under its own fresh read and refuse.
+    const stateDir = path.join(tmpDir, 'memory', 'evolution');
+    fs.mkdirSync(stateDir, { recursive: true });
+    const sp = path.join(stateDir, 'evolution_so
```

---

### Incident Patch 8: `63631c1a` (2026-06-02)
**Commit Message**: feat(hooks): tell the user when evolution memory is inactive in a non-git folder (#558)

Found via real-Cursor end-to-end testing: in a non-git workspace, session-end
records nothing (every outcome is derived from the git diff) and the only trace
was a line in ~/.evolver/logs/evolution.log the user never sees. So evolver
silently does nothing and the user has no idea why.

session-start now surfaces a one-line notice via additionalContext when the
workspace is not a git repo: "This folder is not a git repository, so evolution
memory is inactive ... run `git init` or open a git project." additionalContext
is injected as opening context and does NOT trigger an extra inference round
(unlike a stop-hook systemMessage, which Cursor mishandles).

The notice is throttled per-folder (30 min) by reusing the session-start dedup
state file; the throttle logic is factored into a shared throttled(key, ttlMs)
helper used by both the Kiro per-prompt dedup and the notice. A new shared
isGitWorkspace() lives in _runtimePaths.js. When a non-git folder DOES have
cwd-tagged memory, the notice and the memory are both shown.

Tests: +4 (notice shown / throttled / not in a git repo / shown alongside
memo

**File**: `src/adapters/scripts/_runtimePaths.js` (modified, +22/-1)
```diff
@@ -19,6 +19,7 @@
 const fs = require('fs');
 const path = require('path');
 const os = require('os');
+const { spawnSync } = require('child_process');
 
 function isEvolverPackageJson(filePath) {
   try {
@@ -267,4 +268,24 @@ function findMemoryGraph(evolverRoot) {
   return path.join(userDir, 'memory_graph.jsonl');
 }
 
-module.exports = { findEvolverRoot, findMemoryGraph, resolveProjectDir, resolveWorkspaceId };
+// Is `dir` inside a git work tree? Cheap, no-shell `git rev-parse`. Returns
+// false on any error (git missing, not a repo, timeout) and never throws — the
+// session-start hook uses this only to decide whether to surface a one-line
+// "evolver needs a git workspace" notice, so a false negative just suppresses
+// the notice rather than breaking anything.
+function isGitWorkspace(dir) {
+  try {
+    const res = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], {
+      cwd: dir,
+      encoding: 'utf8',
+      timeout: 5000,
+      stdio: ['ignore', 'pipe', 'pipe'],
+      shell: false,
+    });
+    return res.status === 0 && typeof res.stdout === 'string' && res.stdout.trim() === 'true';
+  } catch {
+    return false;
+  }
+}
+
+module.exports = { findEvolverRoot, findMemoryGraph, resolveProjectDir, resolveWorkspaceId, isGitWorkspace };
```

**File**: `src/adapters/scripts/evolver-session-start.js` (modified, +61/-39)
```diff
@@ -7,9 +7,20 @@ const fs = require('fs');
 const path = require('path');
 const os = require('os');
 
-const { findEvolverRoot, findMemoryGraph, resolveProjectDir, resolveWorkspaceId } = require('./_runtimePaths');
+const { findEvolverRoot, findMemoryGraph, resolveProjectDir, resolveWorkspaceId, isGitWorkspace } = require('./_runtimePaths');
 const { filterRelevantOutcomes } = require('./_memoryFiltering');
 
+// One-line notice shown (throttled) when the workspace is not a git repo.
+// Evolver derives every outcome from the git diff, so in a non-git folder the
+// session-end hook records nothing — silently, unless we say so here. We surface
+// it in session-start's additionalContext (injected as opening context, which
+// does NOT trigger an extra inference round, unlike a stop-hook systemMessage).
+const NON_GIT_NOTICE =
+  '[Evolver] This folder is not a git repository, so evolution memory is inactive ' +
+  '(outcomes are derived from git diffs). Run `git init` here, or open a git project, ' +
+  'to enable recall and recording.';
+const NON_GIT_NOTICE_TTL_MS = 30 * 60 * 1000; // once per 30 min per folder
+
 // Return up to `n` of the current workspace's most-recent entries, in
 // chronological (oldest-first) order.
 //
@@ -94,18 +105,14 @@ function getDedupStatePath() {
   return path.join(dir, 'session-start-state.json');
 }
 
-function shouldSkipInjection() {
-  // Only apply dedup when explicitly enabled (set by Kiro adapter) OR when
-  // we detect a per-prompt-firing platform via PROMPT_SUBMIT heuristic in
-  // stdin. The stdin is drained in main(), so we rely on env flag here.
-  const dedupEnabled = String(process.env.EVOLVER_SESSION_START_DEDUP || '').toLowerCase() === '1'
-    || String(process.env.EVOLVER_SESSION_START_DEDUP || '').toLowerCase() === 'true';
-  if (!dedupEnabled) return false;
-
-  const ttlMs = Number(process.env.EVOLVER_SESSION_START_DEDUP_TTL_MS) || (30 * 60 * 1000);
-  const key = process.cwd();
+// TTL throttle keyed by an arbitrary string, persisted in session-start-state
+// .json. Returns true if `key` fired within the last `ttlMs` (caller should
+// suppress); otherwise records "now" for `key` and returns false. Best-effort:
+// a state read/write failure just means no throttling (fail open). Shared by
+// the Kiro per-prompt dedup and the non-git notice so both age out of the same
+// file (entries older than 24h are pruned on write).
+function throttled(key, ttlMs) {
   const statePath = getDedupStatePath();
-
   let state = {};
   try {
     if (fs.existsSync(statePath)) {
@@ -115,9 +122,7 @@ function shouldSkipInjection() {
 
   const now = Date.now();
   const last = state[key];
-  if (typeof last === 'number' && now - last < ttlMs) {
-    return true;
-  }
+  if (typeof last === 'number' && now - last < ttlMs) return true;
 
   state[key] = now;
   try {
@@ -130,53 +135,70 @@ function shouldSkipInjection() {
     fs.writeFileSync(tmp, JSON.stringify(state), 'utf8');
     fs.renameSync(tmp, statePath);
   } catch { /* best-effort */ }
-
   return false;
 }
 
+function shouldSkipInjection() {
+  // Only apply dedup when explicitly enabled (set by Kiro adapter) OR when
+  // we detect a per-prompt-firing platform via PROMPT_SUBMIT heuristic in
+  // stdin. The stdin is drained in main(), so we rely on env flag here.
+  const dedupEnabled = String(process.env.EVOLVER_SESSION_START_DEDUP || '').toLowerCase() === '1'
+    || String(process.env.EVOLVER_SESSION_START_DEDUP || '').toLowerCase() === 'true';
+  if (!dedupEnabled) return false;
+
+  const ttlMs = Number(process.env.EVOLVER_SESSION_START_DEDUP_TTL_MS) || (30 * 60 * 1000);
+  return throttled(process.cwd(), ttlMs);
+}
+
 function main() {
   if (shouldSkipInjection()) {
     process.stdout.write(JSON.stringify({}));
     return;
   }
 
-  const evolverRoot = findEvolverRoot();
-  const graphPath = findMemoryGraph(evolverRoot);
+  const currentDir = resolveProjectDir();
 
-  if (!graphPath) {
-    process.stdout.write(JSON
```

**File**: `test/sessionStartScope.test.js` (modified, +57/-0)
```diff
@@ -176,3 +176,60 @@ describe('evolver-session-start workspace scoping', () => {
     } finally { cleanup(home); cleanup(projectDir); }
   });
 });
+
+describe('evolver-session-start non-git notice', () => {
+  const { execFileSync: x } = require('child_process');
+  const gitInit = (d) => x('git', ['init', '-q'], { cwd: d });
+
+  it('surfaces a notice in a non-git folder (first time)', () => {
+    const home = makeTmpDir(); const proj = makeTmpDir();
+    try {
+      const env = baseEnv({ HOME: home, CURSOR_PROJECT_DIR: proj,
+        MEMORY_GRAPH_PATH: path.join(home, 'g.jsonl') });
+      const r = runStart(env);
+      assert.ok(r && typeof r.additionalContext === 'string', 'expected a notice');
+      assert.match(r.additionalContext, /not a git repository/);
+    } finally { cleanup(home); cleanup(proj); }
+  });
+
+  it('throttles the notice on the second run in the same folder', () => {
+    const home = makeTmpDir(); const proj = makeTmpDir();
+    try {
+      const env = baseEnv({ HOME: home, CURSOR_PROJECT_DIR: proj,
+        MEMORY_GRAPH_PATH: path.join(home, 'g.jsonl') });
+      const first = runStart(env);
+      assert.match(first.additionalContext, /not a git repository/);
+      const second = runStart(env);
+      assert.deepEqual(second, {}, 'second run within TTL must be silent');
+    } finally { cleanup(home); cleanup(proj); }
+  });
+
+  it('does NOT show the notice in a git workspace', () => {
+    const home = makeTmpDir(); const proj = makeTmpDir();
+    try {
+      gitInit(proj);
+      const env = baseEnv({ HOME: home, CURSOR_PROJECT_DIR: proj,
+        MEMORY_GRAPH_PATH: path.join(home, 'g.jsonl') });
+      const r = runStart(env);
+      // No memory + git repo -> empty; in any case never the non-git notice.
+      if (r && r.additionalContext) {
+        assert.doesNotMatch(r.additionalContext, /not a git repository/);
+      }
+    } finally { cleanup(home); cleanup(proj); }
+  });
+
+  it('shows BOTH the notice and memory when a non-git folder has cwd-tagged outcomes', () => {
+    const home = makeTmpDir(); const proj = makeTmpDir();
+    try {
+      const graph = path.join(home, '.evolver', 'memory', 'evolution', 'memory_graph.jsonl');
+      // cwd-tagged success outcome for this non-git folder (workspace_id null).
+      writeGraph(graph, [outcome('nongit-mem', { cwd: proj })]);
+      const env = baseEnv({ HOME: home, CURSOR_PROJECT_DIR: proj, MEMORY_GRAPH_PATH: graph });
+      delete env.EVOLVER_WORKSPACE_ID;
+      const r = runStart(env);
+      assert.ok(r && typeof r.additionalContext === 'string');
+      assert.match(r.additionalContext, /not a git repository/, 'notice present');
+      assert.match(r.additionalContext, /nongit-mem/, 'memory still injected');
+    } finally { cleanup(home); cleanup(proj); }
+  });
+});
```

---

### Incident Patch 9: `fdebedf3` (2026-06-02)
**Commit Message**: fix(hooks): resolve workspace_id via FS fallback when evolver package is absent (#557)

* fix(hooks): resolve workspace_id via FS fallback when evolver package is absent

Found by real-Cursor end-to-end testing: on plugin-only installs (no
@evomap/evolver package on the machine), resolveWorkspaceId could not reach
paths.getWorkspaceId() and returned null. Every session-end entry was then
stamped workspace_id=null, so the forge-resistant workspace scoping silently
degraded to plain cwd-tag matching — isolation still held (cwd was fixed to
the project dir in #554/#555), but the secret-backed tag the docs promise was
never created.

Add a self-contained FS-only fallback in _runtimePaths.js that reads — and
lazily, atomically creates — the per-workspace secret at
<workspaceRoot>/.evolver/workspace-id. It mirrors src/gep/paths.js exactly:
the workspace root (OPENCLAW_WORKSPACE, else the git repo root at/above the
project dir, else the project dir), the 16-byte hex format, 0600 mode,
O_EXCL|O_NOFOLLOW atomic create, and symlink rejection on both the dir and
file. Because the path and format match, a workspace seeded by the fallback
is read back identically by paths.getWorkspaceId() once 

**File**: `src/adapters/scripts/_runtimePaths.js` (modified, +112/-11)
```diff
@@ -111,6 +111,100 @@ function resolveProjectDir() {
   return process.cwd();
 }
 
+// Determine the workspace ROOT for a project, mirroring src/gep/paths.js
+// getWorkspaceRoot() step-for-step so the FS-only fallback lands its secret at
+// the SAME path paths.js would (what lets an installed @evomap/evolver read the
+// very same id):
+//   1. OPENCLAW_WORKSPACE override.
+//   2. else the git repo root at/above projectDir, BUT if that repo root has a
+//      `workspace/` subdirectory, paths.js returns <repoRoot>/workspace — so we
+//      must too, or the two land on different .evolver/workspace-id files (the
+//      "read back identically" guarantee would break for such projects).
+//   3. else projectDir.
+function _fsWorkspaceRoot(projectDir) {
+  if (process.env.OPENCLAW_WORKSPACE) return process.env.OPENCLAW_WORKSPACE;
+  // Walk up from projectDir looking for a .git entry (file or dir) = repo root.
+  let repoRoot = null;
+  let dir = projectDir;
+  while (dir) {
+    if (fs.existsSync(path.join(dir, '.git'))) { repoRoot = dir; break; }
+    const parent = path.dirname(dir);
+    if (parent === dir) break;
+    dir = parent;
+  }
+  if (!repoRoot) return projectDir;
+  // Mirror getWorkspaceRoot()'s workspace/ subdir step.
+  const workspaceDir = path.join(repoRoot, 'workspace');
+  if (fs.existsSync(workspaceDir)) return workspaceDir;
+  return repoRoot;
+}
+
+// FS-only re-implementation of src/gep/paths.js getWorkspaceId() for the case
+// where the evolver package is not installed (plugin-only installs). It reads
+// — and lazily, atomically creates — the per-workspace secret at
+// <workspaceRoot>/.evolver/workspace-id. The format (16-byte hex), the path,
+// the 0600 mode, the O_EXCL|O_NOFOLLOW atomic create, and the symlink
+// rejection all match paths.js exactly, so a workspace seeded by this fallback
+// is transparently picked up by paths.getWorkspaceId() once the package is
+// present, and vice-versa. Returns null on any read/write error (caller then
+// falls back to legacy cwd-tag matching — no regression).
+// Read <dir>/workspace-id with the same symlink guards paths.js'
+// _readWorkspaceIdFromFs uses: reject a symlinked .evolver dir, reject a
+// symlinked / non-regular id file, and require hex format. Returns the id, or
+// null on any error / missing file. Used for BOTH the initial read and the
+// EEXIST race re-read so a symlink swapped in between our lstat and openSync
+// can never be followed (Bugbot PR #557).
+function _readWsIdGuarded(dir, file) {
+  try {
+    const dirStat = fs.lstatSync(dir, { throwIfNoEntry: false });
+    if (dirStat && dirStat.isSymbolicLink()) return null;
+    const fileStat = fs.lstatSync(file, { throwIfNoEntry: false });
+    if (!fileStat) return null;
+    if (fileStat.isSymbolicLink() || !fileStat.isFile()) return null;
+    const raw = fs.readFileSync(file, 'utf8').trim();
+    return raw && /^[a-f0-9]{32,}$/i.test(raw) ? raw : null;
+  } catch { return null; }
+}
+
+function _fsWorkspaceId(projectDir) {
+  // Whole body is wrapped: the documented contract is "returns null on ANY
+  // read/write error" so the session-start/-end hooks degrade gracefully
+  // rather than crash. throwIfNoEntry:false only suppresses ENOENT; EACCES/EIO
+  // and friends still throw, so a bare lstat/mkdir here must not escape
+  // (Bugbot PR #557 round-2 — an unguarded lstat could crash the hook).
+  try {
+    const dir = path.join(_fsWorkspaceRoot(projectDir), '.evolver');
+    const file = path.join(dir, 'workspace-id');
+    // Read first, with symlink guards.
+    const existing = _readWsIdGuarded(dir, file);
+    if (existing) return existing;
+    // If the file exists but the guards rejected it (symlink / bad format),
+    // refuse rather than create over it.
+    if (fs.lstatSync(file, { throwIfNoEntry: false })) return null;
+    // Missing — create atomically. Refuse a symlinked .evolver dir (O_NOFOLLOW
+    // only guards the final component, not intermediate dirs
```

**File**: `src/adapters/scripts/evolver-session-end.js` (modified, +6/-2)
```diff
@@ -148,6 +148,10 @@ function recordToHub(outcome) {
 
 function recordToLocal(graphPath, outcome) {
   try {
+    // Resolve the project dir once so the cwd tag and the workspace_id secret
+    // share a single, consistent source (both must agree with the session-start
+    // reader's resolveProjectDir()-based scoping).
+    const projectDir = resolveProjectDir();
     const entry = {
       timestamp: new Date().toISOString(),
       gene_id: outcome.geneId || 'ad_hoc',
@@ -179,8 +183,8 @@ function recordToLocal(graphPath, outcome) {
       // cwd-only entry (Bugbot PR #555). collect.js only uses cwd as a legacy
       // fallback (disabled once a workspace_id secret exists), so changing the
       // tag's source — still a directory path — does not affect its scoping.
-      cwd: resolveProjectDir(),
-      workspace_id: resolveWorkspaceId(),
+      cwd: projectDir,
+      workspace_id: resolveWorkspaceId(undefined, projectDir),
       source: 'hook:session-end',
     };
     fs.appendFileSync(graphPath, JSON.stringify(entry) + '\n', 'utf8');
```

**File**: `src/adapters/scripts/evolver-session-start.js` (modified, +1/-1)
```diff
@@ -153,8 +153,8 @@ function main() {
   // workspace's outcomes out of view. When the workspace id can't be resolved,
   // belongsToWorkspace() falls back to "show it" — no regression vs. the old
   // unscoped behavior.
-  const currentId = resolveWorkspaceId(evolverRoot);
   const currentDir = resolveProjectDir();
+  const currentId = resolveWorkspaceId(evolverRoot, currentDir);
   const recent = readRecentWorkspaceEntries(graphPath, currentId, currentDir, 5);
   const filtered = filterRelevantOutcomes(recent);
 
```

**File**: `test/resolveWorkspaceId.test.js` (added, +160/-0)
```diff
@@ -0,0 +1,160 @@
+const { describe, it, beforeEach, afterEach } = require('node:test');
+const assert = require('node:assert/strict');
+const path = require('path');
+const fs = require('fs');
+const os = require('os');
+const { execSync } = require('child_process');
+
+// resolveWorkspaceId resolves the forge-resistant workspace_id tag. When the
+// @evomap/evolver package is unreachable (plugin-only installs), it must still
+// produce a stable id via the FS-only fallback — writing the SAME secret file
+// (<workspaceRoot>/.evolver/workspace-id) that src/gep/paths.js#getWorkspaceId
+// uses, so an installed package picks up the identical id. Regression for the
+// real-Cursor finding where plugin installs got workspace_id=null and scoping
+// silently degraded to cwd matching.
+const { resolveWorkspaceId } = require('../src/adapters/scripts/_runtimePaths');
+const NO_PKG = '/nonexistent-evolver-root-xyz'; // forces the FS-only path
+
+// git-init each tmp dir so it is its OWN workspace root. Without this, the
+// repo-root walk in _fsWorkspaceRoot climbs past the tmp dir to any ancestor
+// .git — and Aurora's /tmp carries a stray /tmp/.git that would otherwise
+// capture the secret (see memory: paths.test.js /tmp/.git flake). A real user
+// project is a git repo anyway, so this matches reality.
+function makeTmpDir() {
+  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'evolver-wsid-test-')));
+  execSync('git init -q', { cwd: d });
+  return d;
+}
+function cleanup(dir) { try { fs.rmSync(dir, { recursive: true, force: true }); } catch {} }
+
+describe('resolveWorkspaceId FS-only fallback', () => {
+  let saved;
+  beforeEach(() => {
+    saved = { id: process.env.EVOLVER_WORKSPACE_ID, ws: process.env.OPENCLAW_WORKSPACE };
+    delete process.env.EVOLVER_WORKSPACE_ID;
+    delete process.env.OPENCLAW_WORKSPACE;
+  });
+  afterEach(() => {
+    for (const [k, v] of [['EVOLVER_WORKSPACE_ID', saved.id], ['OPENCLAW_WORKSPACE', saved.ws]]) {
+      if (v === undefined) delete process.env[k]; else process.env[k] = v;
+    }
+  });
+
+  it('EVOLVER_WORKSPACE_ID override wins, no file written', () => {
+    const proj = makeTmpDir();
+    try {
+      process.env.EVOLVER_WORKSPACE_ID = 'override-id-123';
+      assert.equal(resolveWorkspaceId(NO_PKG, proj), 'override-id-123');
+      assert.ok(!fs.existsSync(path.join(proj, '.evolver', 'workspace-id')),
+        'override must not trigger a file write');
+    } finally { cleanup(proj); }
+  });
+
+  it('generates a stable hex id and persists it at <root>/.evolver/workspace-id', () => {
+    const proj = makeTmpDir();
+    try {
+      const id1 = resolveWorkspaceId(NO_PKG, proj);
+      assert.match(id1, /^[a-f0-9]{32,}$/i, `id must be hex, got ${id1}`);
+      const file = path.join(proj, '.evolver', 'workspace-id');
+      assert.ok(fs.existsSync(file), 'secret file must be created');
+      assert.equal(fs.statSync(file).mode & 0o777, 0o600, 'secret file must be 0600');
+      // Second call re-reads the same id (lazy create is stable).
+      assert.equal(resolveWorkspaceId(NO_PKG, proj), id1, 'id must be stable across calls');
+    } finally { cleanup(proj); }
+  });
+
+  it('two different project dirs get different ids (isolation)', () => {
+    const a = makeTmpDir(); const b = makeTmpDir();
+    try {
+      assert.notEqual(resolveWorkspaceId(NO_PKG, a), resolveWorkspaceId(NO_PKG, b));
+    } finally { cleanup(a); cleanup(b); }
+  });
+
+  it('resolves the git repo ROOT, not a subdir (matches paths.js getWorkspaceRoot)', () => {
+    const repo = makeTmpDir();
+    try {
+      execSync('git init -q', { cwd: repo });
+      const sub = path.join(repo, 'src', 'deep');
+      fs.mkdirSync(sub, { recursive: true });
+      // Called from a subdir, the secret must land at the repo root.
+      const id = resolveWorkspaceId(NO_PKG, sub);
+      assert.match(id, /^[a-f0-9]{32,}$/i);
+      assert.ok(fs.existsSync(path.join(repo, '.evolver', 'workspace-id')),
+ 
```

---

### Incident Patch 10: `f225e303` (2026-06-01)
**Commit Message**: fix(hooks): workspace-scope memory recall + log a no-changes breadcrumb (#555)

* fix(hooks): scope session-start memory recall to the current workspace

The session-start hook injected the last 5 memory-graph outcomes with no
workspace filter, while the session-end writer already tags every entry
with workspace_id (forge-resistant) and cwd (backward-compat). On
npm-global installs every project shares the user-level fallback graph
(~/.evolver/memory/evolution/memory_graph.jsonl), so project A's session
start would surface project B's outcomes — the cross-project disclosure /
prompt-injection surface Bugbot flagged on the writer side (PR #105
round-2), which the reader never enforced.

Add resolveWorkspaceId() to _runtimePaths.js mirroring the writer's
resolution (EVOLVER_WORKSPACE_ID, then paths.getWorkspaceId() from the
resolved evolver root). session-start now scopes entries to the current
workspace BEFORE taking the most-recent window — filtering after a tail-N
read would let other projects crowd this workspace out of the window
entirely. Untagged legacy/Hub entries and the can't-resolve-id case both
fall through to 'show it', so there is no regression vs. the old unscoped
beha

**File**: `src/adapters/scripts/_runtimePaths.js` (modified, +25/-1)
```diff
@@ -111,6 +111,30 @@ function resolveProjectDir() {
   return process.cwd();
 }
 
+// Resolve the current workspace id — the forge-resistant tag the session-end
+// writer stamps on every memory-graph entry (`workspace_id`). This is the
+// SINGLE source of that resolution: the session-end writer stamps it and the
+// session-start reader scopes by it, so both call this one function. Keeping
+// it here (rather than a copy per hook) is what guarantees reader and writer
+// can never drift apart — if they resolved different ids, no entry would ever
+// match the reader's filter and workspace scoping would silently break.
+// Resolution order:
+//   1. EVOLVER_WORKSPACE_ID env override
+//   2. paths.getWorkspaceId() loaded from the resolved evolver root
+// Returns null when neither is available (e.g. evolver package not installed),
+// in which case callers must NOT filter — falling back to "show everything"
+// preserves prior behavior rather than hiding all memory on a resolution miss.
+function resolveWorkspaceId(evolverRoot) {
+  if (process.env.EVOLVER_WORKSPACE_ID) return String(process.env.EVOLVER_WORKSPACE_ID);
+  const root = evolverRoot || findEvolverRoot();
+  if (!root) return null;
+  try {
+    const paths = require(path.join(root, 'src', 'gep', 'paths.js'));
+    if (typeof paths.getWorkspaceId === 'function') return paths.getWorkspaceId();
+  } catch { /* paths.js unreachable — return null */ }
+  return null;
+}
+
 // Returns a path to the evolution memory graph, or a fallback location that
 // is guaranteed to be writable. Never returns null — when no evolver root is
 // available, we fall back to `~/.evolver/memory/evolution/memory_graph.jsonl`
@@ -142,4 +166,4 @@ function findMemoryGraph(evolverRoot) {
   return path.join(userDir, 'memory_graph.jsonl');
 }
 
-module.exports = { findEvolverRoot, findMemoryGraph, resolveProjectDir };
+module.exports = { findEvolverRoot, findMemoryGraph, resolveProjectDir, resolveWorkspaceId };
```

**File**: `src/adapters/scripts/evolver-session-end.js` (modified, +56/-32)
```diff
@@ -13,27 +13,16 @@ const { spawnSync } = require('child_process');
 // on large repos). See GHSA reports / issue #451.
 const MAX_EXEC_BUFFER = 10 * 1024 * 1024;
 
-const { findEvolverRoot, findMemoryGraph, resolveProjectDir } = require('./_runtimePaths');
+const { findEvolverRoot, findMemoryGraph, resolveProjectDir, resolveWorkspaceId } = require('./_runtimePaths');
 
-// Workspace-id must use the same resolution as the reader in
-// src/evolve/pipeline/collect.js (which goes through src/gep/paths.js#
-// getWorkspaceRoot()). Otherwise writer and reader could land on
-// different `.evolver/workspace-id` files when EVOLVER_REPO_ROOT or
-// OPENCLAW_WORKSPACE is set, or when a `<repoRoot>/workspace`
-// subdirectory exists — in which case the IDs would never match and
-// every memory-graph entry would silently get dropped (Bugbot PR #109
-// round-1 MEDIUM). Lazy-load the canonical resolver from the resolved
-// evolver root; fall back to env-only when paths.js is unreachable.
-function resolveWorkspaceIdForWriter() {
-  if (process.env.EVOLVER_WORKSPACE_ID) return String(process.env.EVOLVER_WORKSPACE_ID);
-  const evolverRoot = findEvolverRoot();
-  if (!evolverRoot) return null;
-  try {
-    const paths = require(path.join(evolverRoot, 'src', 'gep', 'paths.js'));
-    if (typeof paths.getWorkspaceId === 'function') return paths.getWorkspaceId();
-  } catch { /* paths.js unreachable — return null */ }
-  return null;
-}
+// Workspace-id resolution is shared with the session-start reader via
+// _runtimePaths.resolveWorkspaceId(). Reader and writer MUST resolve the SAME
+// id or workspace scoping silently breaks (no entry would ever match the
+// reader's filter), so this logic lives in exactly one place instead of being
+// duplicated here. The shared resolver mirrors src/gep/paths.js#getWorkspaceId()
+// loaded from the evolver root, with an EVOLVER_WORKSPACE_ID env override —
+// consistent with the review-time reader in src/evolve/pipeline/collect.js
+// (Bugbot PR #109 round-1 MEDIUM; reader/writer drift flagged on PR #555).
 
 function runGit(args, cwd) {
   // Argv-array form, no shell. Avoids POSIX `2>/dev/null` redirects that
@@ -69,11 +58,16 @@ function getGitDiffStats() {
   const filesChanged = (stat.match(/\d+ files? changed/) || ['0'])[0];
   const insertions = (stat.match(/(\d+) insertions?/) || [null, '0'])[1];
   const deletions = (stat.match(/(\d+) deletions?/) || [null, '0'])[1];
+  // Distinguish "no git repo here" from "repo with no changes" purely for the
+  // skip-log message — the diff commands above can't tell the two apart (both
+  // yield empty output). A single cheap rev-parse settles it.
+  const isRepo = runGit(['rev-parse', '--is-inside-work-tree'], cwd).out === 'true';
   return {
     stat,
     summary: `${filesChanged}, +${insertions}/-${deletions}`,
     diffSnippet: diffContent.slice(0, 2000),
     hasChanges: stat.length > 0,
+    isRepo,
   };
 }
 
@@ -176,8 +170,17 @@ function recordToLocal(graphPath, outcome) {
       // .evolver/workspace-id file. cwd is retained as a backward-compat
       // tag so older entries written before this hardening still pass
       // the cwd check.
-      cwd: process.cwd(),
-      workspace_id: resolveWorkspaceIdForWriter(),
+      //
+      // Use resolveProjectDir() (NOT process.cwd()) so the cwd tag records the
+      // user's project, consistent with how the diff above is collected and
+      // with the session-start reader's cwd fallback. Under Cursor, cwd is the
+      // plugin install dir, so a raw process.cwd() tag would never match the
+      // reader's resolveProjectDir()-derived currentDir — silently hiding every
+      // cwd-only entry (Bugbot PR #555). collect.js only uses cwd as a legacy
+      // fallback (disabled once a workspace_id secret exists), so changing the
+      // tag's source — still a directory path — does not affect its scoping.
+      cwd: resolveProjectDir(),
+      workspace_id: resolveWorkspaceId(),
       sou
```

**File**: `src/adapters/scripts/evolver-session-start.js` (modified, +72/-10)
```diff
@@ -7,17 +7,65 @@ const fs = require('fs');
 const path = require('path');
 const os = require('os');
 
-const { findEvolverRoot, findMemoryGraph } = require('./_runtimePaths');
+const { findEvolverRoot, findMemoryGraph, resolveProjectDir, resolveWorkspaceId } = require('./_runtimePaths');
 const { filterRelevantOutcomes } = require('./_memoryFiltering');
 
-function readLastN(filePath, n) {
+// Return up to `n` of the current workspace's most-recent entries, in
+// chronological (oldest-first) order.
+//
+// Why scan from the end: a plain tail-N-then-filter read would let outcomes
+// from other projects (which share the user-level fallback graph on npm-global
+// installs) crowd this workspace's entries out of the window — we must scope
+// to the workspace BEFORE trimming. But parsing the ENTIRE file to do that is
+// wasteful: the graph can reach ~100 MB before rotation, and JSON-parsing every
+// line on each session start is real CPU/memory cost (Bugbot PR #555 round-3).
+//
+// So we read the file (cheap; the previous readLastN read it whole too) but
+// JSON-parse lines lazily from the newest end, keeping only workspace matches,
+// and stop as soon as we have `n`. Parse count is bounded by where this
+// workspace's n-th-most-recent entry sits, not by total file size.
+function readRecentWorkspaceEntries(filePath, currentId, currentDir, n) {
+  let lines;
   try {
-    const content = fs.readFileSync(filePath, 'utf8');
-    const lines = content.trim().split('\n').filter(Boolean);
-    return lines.slice(-n).map(line => {
-      try { return JSON.parse(line); } catch { return null; }
-    }).filter(Boolean);
+    lines = fs.readFileSync(filePath, 'utf8').trim().split('\n');
   } catch { return []; }
+  const out = [];
+  for (let i = lines.length - 1; i >= 0 && out.length < n; i--) {
+    const line = lines[i];
+    if (!line) continue;
+    let entry;
+    try { entry = JSON.parse(line); } catch { continue; }
+    if (belongsToWorkspace(entry, currentId, currentDir)) out.push(entry);
+  }
+  return out.reverse(); // newest-collected-first -> chronological
+}
+
+// Does this memory-graph entry belong to the current workspace?
+//
+// The session-end writer stamps two tags: `workspace_id` (forge-resistant,
+// preferred) and `cwd` (backward-compat). We scope reads so that one project
+// never sees another's outcomes through the shared user-level fallback graph
+// (~/.evolver/memory/evolution/memory_graph.jsonl) — the cross-project
+// disclosure / prompt-injection surface Bugbot flagged on the writer side
+// (PR #105 round-2), which the reader never enforced until now.
+//
+// Rules, in order:
+//   - currentId known + entry.workspace_id present -> must match exactly.
+//   - currentId unknown OR entry has neither tag (pre-hardening / Hub-sourced
+//     entries) -> do NOT exclude; falling back to "show it" preserves prior
+//     behavior and avoids hiding all memory when ids can't be resolved.
+//   - As a softer fallback, when the entry has no workspace_id but does carry a
+//     cwd, match that against the current project dir.
+function belongsToWorkspace(entry, currentId, currentDir) {
+  if (entry && typeof entry.workspace_id === 'string' && entry.workspace_id) {
+    if (currentId) return entry.workspace_id === currentId;
+    return true; // can't compare — don't hide it
+  }
+  if (entry && typeof entry.cwd === 'string' && entry.cwd) {
+    if (currentDir) return entry.cwd === currentDir;
+    return true;
+  }
+  return true; // untagged (legacy / Hub) — never excluded
 }
 
 function formatOutcome(entry) {
@@ -100,8 +148,15 @@ function main() {
     return;
   }
 
-  const entries = readLastN(graphPath, 5);
-  const filtered = filterRelevantOutcomes(entries);
+  // Scope to the current workspace BEFORE trimming to the most-recent window,
+  // so other projects sharing the user-level fallback graph can't crowd this
+  // workspace's outcomes out of view. When the workspace id can't be resolved,
+  // belo
```

**File**: `test/sessionEndHook.test.js` (modified, +95/-0)
```diff
@@ -197,3 +197,98 @@ describe('evolver-session-end project-dir resolution', () => {
     } finally { cleanup(repo); cleanup(elsewhere); cleanup(home); }
   });
 });
+
+describe('evolver-session-end no-changes log breadcrumb', () => {
+  // A non-git workspace has no diff -> no signal source -> nothing is recorded
+  // (recording an empty outcome would pollute the memory graph). But the hook
+  // must not be fully silent: it logs a one-line skip notice so a user can tell
+  // "ran but had nothing to record" from "never fired".
+  it('logs a "not a git workspace" skip notice and records no outcome', () => {
+    const nongit = makeTmpDir(); // plain dir, no git init
+    const home = makeTmpDir();
+    try {
+      const logDir = path.join(home, 'logs');
+      const env = baseEnv({ HOME: home, EVOLVER_HOOK_LOG_DIR: logDir, TERM_PROGRAM: 'xterm' });
+      delete env.CURSOR_TRACE_ID;
+      delete env.CURSOR_SESSION_ID;
+
+      const result = runHook(env, nongit);
+      assert.deepEqual(result, {}, 'no outcome should be emitted in a non-git workspace');
+
+      const logFile = path.join(logDir, 'evolution.log');
+      assert.ok(fs.existsSync(logFile), 'a skip breadcrumb must be logged');
+      const log = fs.readFileSync(logFile, 'utf8');
+      assert.match(log, /nothing recorded \(not a git workspace\)/);
+      // And it must NOT have written a memory-graph entry.
+      const graph = path.join(home, '.evolver', 'memory', 'evolution', 'memory_graph.jsonl');
+      assert.ok(!fs.existsSync(graph) || fs.readFileSync(graph, 'utf8').trim() === '',
+        'no memory-graph entry should be written when there are no changes');
+    } finally { cleanup(nongit); cleanup(home); }
+  });
+
+  it('logs a "no changes detected" notice in a clean git repo', () => {
+    const repo = makeTmpDir();
+    const home = makeTmpDir();
+    try {
+      // git repo with a committed file but NO uncommitted change this session.
+      execSync('git init -q', { cwd: repo });
+      execSync('git config user.email test@example.com', { cwd: repo });
+      execSync('git config user.name test', { cwd: repo });
+      fs.writeFileSync(path.join(repo, 'a.txt'), 'hello\n');
+      execSync('git add a.txt', { cwd: repo });
+      execSync('git commit -q -m initial', { cwd: repo });
+      // No second commit and no edit -> diff HEAD~1 fails, working tree clean.
+
+      const logDir = path.join(home, 'logs');
+      const env = baseEnv({ HOME: home, EVOLVER_HOOK_LOG_DIR: logDir, TERM_PROGRAM: 'xterm' });
+      delete env.CURSOR_TRACE_ID;
+      delete env.CURSOR_SESSION_ID;
+
+      const result = runHook(env, repo);
+      assert.deepEqual(result, {});
+      const log = fs.readFileSync(path.join(logDir, 'evolution.log'), 'utf8');
+      assert.match(log, /nothing recorded \(no changes detected this session\)/);
+    } finally { cleanup(repo); cleanup(home); }
+  });
+});
+
+describe('evolver-session-end cwd tag consistency (reader/writer match)', () => {
+  // Regression (Bugbot PR #555 round-2): the writer must stamp the entry's
+  // `cwd` with resolveProjectDir() — the SAME resolver the session-start
+  // reader uses for its cwd fallback — not raw process.cwd(). Under Cursor the
+  // hook's process.cwd() is the plugin install dir, so a raw-cwd tag would
+  // never equal the reader's project-dir-derived currentDir, silently hiding
+  // every cwd-only entry. Force Hub off so the entry lands in local memory.
+  it('tags entry.cwd with CURSOR_PROJECT_DIR, not the hook process cwd', () => {
+    const repo = makeTmpDir();      // user's project, where the diff lives
+    const elsewhere = makeTmpDir(); // simulate Cursor's plugin-dir cwd
+    const home = makeTmpDir();
+    try {
+      initRepoWithDiff(repo);
+      const graph = path.join(home, '.evolver', 'memory', 'evolution', 'memory_graph.jsonl');
+      // recordToLocal appends to MEMORY_GRAPH_PATH but does not mkdir for an
+      // explicit path — create the parent the way a real insta
```

**File**: `test/sessionStartScope.test.js` (added, +178/-0)
```diff
@@ -0,0 +1,178 @@
+const { describe, it } = require('node:test');
+const assert = require('node:assert/strict');
+const path = require('path');
+const fs = require('fs');
+const os = require('os');
+const { execFileSync } = require('child_process');
+
+const repoRoot = path.resolve(__dirname, '..');
+const scriptPath = path.join(repoRoot, 'src', 'adapters', 'scripts', 'evolver-session-start.js');
+
+function makeTmpDir() {
+  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'evolver-sstart-scope-')));
+}
+function cleanup(dir) {
+  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
+}
+
+// Build a memory graph file with the given entries (one JSON object per line).
+function writeGraph(file, entries) {
+  fs.mkdirSync(path.dirname(file), { recursive: true });
+  fs.writeFileSync(file, entries.map(e => JSON.stringify(e)).join('\n') + '\n');
+}
+
+// A "good" recent successful outcome that passes filterRelevantOutcomes
+// (status success, score >= 0.5, timestamped now), tagged with a workspace.
+function outcome(note, { workspace_id, cwd } = {}) {
+  const e = {
+    timestamp: new Date().toISOString(),
+    gene_id: 'ad_hoc',
+    signals: ['stable_success_plateau'],
+    outcome: { status: 'success', score: 0.8, note },
+  };
+  if (workspace_id !== undefined) e.workspace_id = workspace_id;
+  if (cwd !== undefined) e.cwd = cwd;
+  return e;
+}
+
+function runStart(env) {
+  const out = execFileSync('node', [scriptPath], {
+    env: { PATH: process.env.PATH, ...env },
+    input: '{}',
+    encoding: 'utf8',
+    timeout: 15000,
+  });
+  try { return JSON.parse(out); } catch { return null; }
+}
+
+function baseEnv(extra) {
+  return {
+    HOME: extra.HOME,
+    EVOLVER_ROOT: repoRoot,
+    // Force dedup off (default) so every run injects.
+    EVOLVER_SESSION_START_DEDUP: '',
+    ...extra,
+  };
+}
+
+describe('evolver-session-start workspace scoping', () => {
+  it('injects only the current workspace\'s outcomes, not other projects\'', () => {
+    const home = makeTmpDir();
+    try {
+      const graph = path.join(home, '.evolver', 'memory', 'evolution', 'memory_graph.jsonl');
+      // 6 entries from "other" workspace, then 1 from "mine". A tail-5 read
+      // would miss "mine" entirely; scope-first must surface it.
+      const entries = [];
+      for (let i = 0; i < 6; i++) entries.push(outcome(`other-${i}`, { workspace_id: 'ws-other' }));
+      entries.push(outcome('mine-1', { workspace_id: 'ws-mine' }));
+      writeGraph(graph, entries);
+
+      const env = baseEnv({
+        HOME: home,
+        MEMORY_GRAPH_PATH: graph,
+        EVOLVER_WORKSPACE_ID: 'ws-mine',
+      });
+      const result = runStart(env);
+      assert.ok(result && typeof result.additionalContext === 'string',
+        `expected an injection, got ${JSON.stringify(result)}`);
+      assert.match(result.additionalContext, /mine-1/, 'must include current workspace outcome');
+      assert.doesNotMatch(result.additionalContext, /other-/,
+        'must NOT leak other workspace outcomes');
+    } finally { cleanup(home); }
+  });
+
+  it('surfaces this workspace\'s recent entries even behind many newer other-workspace entries', () => {
+    const home = makeTmpDir();
+    try {
+      const graph = path.join(home, '.evolver', 'memory', 'evolution', 'memory_graph.jsonl');
+      // This workspace's entries come FIRST (older), then a large run of other-
+      // workspace entries (newer). A tail-N read would see only 'other'; the
+      // bounded scan-from-end must walk past them to collect ours — without
+      // parsing being capped at N total (it stops at N *matches*, not N lines).
+      const entries = [];
+      entries.push(outcome('mine-old', { workspace_id: 'ws-mine' }));
+      for (let i = 0; i < 200; i++) entries.push(outcome(`other-${i}`, { workspace_id: 'ws-other' }));
+      entries.push(outcome('mine-new', { workspace_id: 'ws-mine' }));
+      writeGraph(graph, entries);
+
+      const env = base
```

#### Recent Merged Pull Requests:
- **PR #622** (2026-09-04): feat(skill-store): report Hub install-success after local fetch commit (@autogame-17)
- **PR #614** (2026-08-24): fix: fail closed on unavailable llm review (@autogame-17)
- **PR #605** (closed): fix(opencode): comprehensive compatibility fix for opencode 1.18.x (@LeoNardo-LB)
- **PR #604** (closed): fix(opencode): comprehensive compatibility fix for opencode 1.18.x (@LeoNardo-LB)
- **PR #603** (closed): fix(opencode): use PluginModule export for opencode 1.18.x compatibility (@LeoNardo-LB)
- **PR #602** (2026-07-17): feat(experiment): add trigger-shift replay evaluator (@autogame-17)
- **PR #598** (closed): Add MiniMax OpenAI-compatible endpoint (@octo-patch)
- **PR #596** (closed): feat(ci): per-branch link-check captures + slim dev-only workflow on scripts/** PRs (@joeshmoe97x-ship-it)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
