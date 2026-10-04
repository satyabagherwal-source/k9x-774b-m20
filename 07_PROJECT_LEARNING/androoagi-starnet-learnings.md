# Forensic Learning Record (Deep Inspection): androoAGI/starnet

> **Canonical Artifact**: `07_PROJECT_LEARNING/androoagi-starnet-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/androoAGI/starnet](https://github.com/androoAGI/starnet))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:43:42.738Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `androoAGI/starnet`
- **Description**: A living pixel-art station where real AI agents do real work. Local-first desktop agent harness - bring your own key, watch your crew actually run.
- **Primary Language / Ecosystem**: JavaScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1059 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bin/lib/cli-core.js`
```
/* bin/lib/cli-core.js — the PURE decisions behind the `starnet` command-line surface.

   `bin/starnet.js` is the composition root (argv, env, sockets, child processes, stdout/stderr). Everything
   that can be decided without ambient I/O lives here so it is unit-testable in isolation (test/cli.test.js):
   argument parsing, the attach-vs-spawn choice, the run-event reducer that decides what the CLI is allowed to
   claim, exit codes, the desktop port-discovery parsers, and the non-interactive bootstrap documents.

   TRUTHFUL-TELEMETRY LAW, applied to a terminal: the CLI prints only what the station's own event stream
   proves. A stream that ends without agent.run.end is reported as an error, never as "done"; text is the
   concatenation of real agent.token deltas; tool lines mirror agent.tool_call / agent.tool_result one-to-one.
   No function here ever fabricates a reason, a cost, or a reply. */
'use strict';

const EXIT = Object.freeze({
  OK: 0,          // agent.run.end{reason:'done'}
  RUN_FAILED: 1,  // agent.run.end{reason:'error'} or the stream dropped before a terminal event
  USAGE: 2,       // bad arguments
  STATION: 3,     // no station reachable / could not boot one / nothing runnable configured
  CANCELLED: 4,   // Ctrl-C or --timeout (POST /api/cancel was sent)
  STOPPED: 5      // the run ended early for a reason that is not 'done': refusal, budget, max_iters, empty, clarifying
});

const RUN_STOP_REASONS = Object.freeze(['done', 'max_iters', 'budget', 'cancelled', 'error', 'refusal', 'empty', 'clarifying']);

// The coding office: every placed capability object a headless run may draw on. Identical to what the ACP
// bridge grants an editor session (sidecar/acp/serve.js) — files, shell + verify, web/browser, memory, on top
// of the compute-only interactive office. Consent for mutations still rides the station's own gate.
const HEADLESS_PLACED = Object.freeze([
  { objectType: 'computer' }, { objectType: 'cabinet' },
  { objectType: 'workbench' }, { objectType: 'dish' }, { objectType: 'notebook' }
]);

const DEFAULT_PORT = 8787;
const DEFAULT_AGENT_ID = 'agent';

// ---- argv --------------------------------------------------------------------------------------
const USAGE = [
  'starnet — run StarNet agents from a terminal (no station UI required)',
  '',
  'Usage:',
  '  starnet -p "<prompt>"                run one task and stream the answer to stdout',
  '  starnet run "<prompt>"               same as -p',
  '  starnet -p -                         read the prompt from stdin',
  '  starnet status                       is a station reachable? version, workspace, providers (names only)',
  '  starnet doctor                       the station\'s static diagnostics report (no live probes)',
  '  starnet init                         create the default workspace + one full-power agent (no run)',
  '',
  'Run options:',
  '  --agent <id>       roster agent to run (default: "agent", else the first roster entry)',
  '  --model <slug>     override the agent\'s model',
  '  --provider <id>    override the agent\'s provider (openrouter, openai, anthropic, codex, …)',
  '  --json             print one JSON object (result + run receipt) instead of streaming text',
  '  --cwd <dir>        project root for the run (folder trust is asked through the consent gate)',
  '  --timeout <sec>    cancel the run after N seconds (exit 4)',
  '  --yes              approve consent prompts automatically (non-interactive default is DENY)',
  '',
  'Station options:',
  '  --port <n>         attach to a station on this port (env STARNET_PORT)',
  '  --host <h>         station host (default 127.0.0.1)',
  '  --token <t>        station API token (env STARNET_TOKEN); otherwise read from the served page',
  '  --workspace <dir>  workspace to boot when no station is reachable (env STARNET_WORKSPACES)',
  '  --name <NAME>      agent name used by a first-time bootstrap (default OVERSEER)',
  '  --no-spawn         never boot a station; fail (exit 3) if none is reachable',
  '  --spawn            always boot a private station for this run (never attach to a running one)',
  '',
  'Exit codes: 0 done · 1 run failed · 2 usage · 3 no station / not configured · 4 cancelled · 5 stopped early',
  '',
  'Credentials are never taken on the command line. A spawned station reads them from the environment',
  '(STARNET_OPENROUTER_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, …) or from a ChatGPT/Codex sign-in already',
  'stored in the workspace; an attached station uses whatever it already has.'
].join('\n');

function parseArgs(argv, env) {
  const args = Array.isArray(argv) ? argv.slice() : [];
  const e = env || {};
  const out = {
    cmd: '', prompt: '', promptFromStdin: false,
    agent: '', model: '', provider: '', json: false, cwd: '', timeoutSec: 0, yes: false,
    port: 0, host: '', token: '', workspace: '', name: '', noSpawn: false, spawn: false, help: false, version: false
  };
  const takeValue = (flag, i) => {
    if (i + 1 >= args.length) throw new Error(flag + ' needs a value');
    return args[i + 1];
  };
  let i = 0;
  while (i < args.length) {
    const a = args[i];
    let m;
    if (a === '-h' || a === '--help' || a === 'help') { out.help = true; i++; continue; }
    if (a === '-v' || a === '--version') { out.version = true; i++; continue; }
    if (a === '-p' || a === '--prompt') {
      out.cmd = out.cmd || 'run';
      const v = takeValue(a, i);
      if (v === '-') out.promptFromStdin = true; else out.prompt = v;
      i += 2; continue;
    }
    if ((m = /^--prompt=(.*)$/.exec(a))) { out.cmd = out.cmd || 'run'; out.prompt = m[1]; i++; continue; }
    if (!out.cmd && (a === 'run' || a === 'status' || a === 'doctor' || a === 'init')) {
      out.cmd = a; i++;
      if (a === 'run' && i < args.length && args[i][0] !== '-') { out.prompt = args[i]; i++; }
      else if (a === 'run' && i < args.length && args[i] === '-') { out.promptFromStdin = true; i++; }
      continue;
    }
    const flagVal = (name) => {
      const eq = new RegExp('^--' + name + '=(.*)$').exec(a);
      if (eq) { i++; return eq[1]; }
      if (a === '--' + name) { const v = takeValue(a, i); i += 2; return v; }
      return undefined;
    };
    let v;
    if ((v = flagVal('agent')) !== undefined) { out.agent = v; continue; }
    if ((v = flagVal('model')) !== undefined) { out.model = v; continue; }
    if ((v = flagVal('provider')) !== undefined) { out.provider = v; continue; }
    if ((v = flagVal('cwd')) !== undefined) { out.cwd = v; continue; }
    if ((v = flagVal('timeout')) !== undefined) {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) throw new Error('--timeout must be a positive number of seconds');
      out.timeoutSec = n; continue;
    }
    if ((v = flagVal('port')) !== undefined) {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error('--port must be 1–65535');
      out.port = n; continue;
    }
    if ((v = flagVal('host')) !== undefined) { out.host = v; continue; }
    if ((v = flagVal('token')) !== undefined) { out.token = v; continue; }
    if ((v = flagVal('workspace')) !== undefined) { out.workspace = v; continue; }
    if ((v = flagVal('name')) !== undefined) { out.name = v; continue; }
    if (a === '--json') { out.json = true; i++; continue; }
    if (a === '--yes' || a === '-y') { out.yes = true; i++; continue; }
    if (a === '--no-spawn') { out.noSpawn = true; i++; continue; }
    if (a === '--spawn') { out.spawn = true; i++; continue; }
    if (a[0] === '-') throw new Error('unknown option ' + a);
    // a bare word after `run "<prompt>"` or a stray positional
    if (out.cmd === 'run' && !out.prompt && !out.promptFromStdin) { out.prompt = a; i++; continue; }
    throw new Error('unexpected argument ' + JSON.stringify(a));
  }
  if (!out.cmd && !out.help && !out.version) out.help = true;
  if (out.cmd === 'run' && !out.prompt && !out.promptFromStdin) throw new Error('run needs a prompt (starnet -p "…")');
  if (out.spawn && out.noSpawn) throw new Error('--spawn and --no-spawn contradict each other');
  // env fallbacks (flags win)
  if (!out.port) {
    const ep = String(e.STARNET_PORT || e.SKYNET_PORT || '').trim();
    if (/^\d+$/.test(ep)) out.port = Number(ep);
  }
  if (!out.host) out.host = String(e.STARNET_HOST || e.SKYNET_HOST || '127.0.0.1');
  if (!out.token) out.token = String(e.STARNET_TOKEN || e.STARNET_API_TOKEN || e.SKYNET_API_TOKEN || '');
  if (!out.workspace) out.workspace = String(e.STARNET_WORKSPACES || e.SKYNET_WORKSPACES || '');
  if (!out.name) out.name = 'OVERSEER';
  out.name = String(out.name).slice(0, 40);
  return out;
}

// ---- attach vs spawn ---------------------------------------------------------------------------
/* Decide where the run goes. `candidates` are probe results in PRIORITY order, each { source, port, reachable }
   (source: 'flag' | 'env' | 'default' | 'desktop'). `desktop` describes what the desktop-app workspace's owner
   claim proved: { ownerAlive, port } (port 0 when the OS could not tell us which port that pid listens on).

   Rules, in order:
     1. the first REACHABLE candidate wins → attach (never spawn a second station beside a live one);
     2. an explicit --port/env port that is NOT reachable is an error, not a spawn (the operator named a station);
     3. a live desktop owner whose port we could not resolve → refuse to spawn INTO that workspace (one
        sidecar per WORKSPACES dir is a hard invariant) — unless the operator picked another workspace;
     4. --no-spawn → refuse; otherwise → spawn. */
function chooseStation(input) {
  const o = input || {};
  if (o.forceSpawn) return o.noSpawn ? { mode: 'refuse', reason: '--spawn and --no-spawn contradict each other' } : { mode: 'spawn', forced: true };
  const cands = Array.isArray(o.candidates) ? o.candidates : [];
  const hit = cands.find(c => c && c.reachable);
  if (hit) return { mode: 'attach', port: hit.port, source: hit.source };
  const n
```

### Core Architecture Module: `dev/computer-eval/live-loop.js`
```
'use strict';
// Replay chooses one read-only action; the tool, pixels and run loop are real.
const assert = require('node:assert/strict');
const { connect, makeDriver } = require('./cua-driver.js');
const { makeComputerTools } = require('../../sidecar/tools/builtin/computer.js');
const { makeImageWire } = require('../../sidecar/tools/builtin/imagewire.js');
const { makeReplayProvider } = require('../../sidecar/providers/replay.js');
const { makeCostEngine } = require('../../sidecar/cost.js');
const { runAgentLoop } = require('../../sidecar/loop.js');

async function run(binary, pid, windowId) {
  const conn = await connect({ binary, fullPower: true });
  try {
    const driver = makeDriver(conn, { pid, window_id: windowId });
    const tool = makeComputerTools({ driver, allowPhysicalInput: true, imageWire: makeImageWire() }).useTool;
    await assert.rejects(tool.run({ action: 'screenshot' }, {}), /Full Power/);
    const provider = makeReplayProvider({ turns: [[
      { type: 'tool_start', index: 0, id: 'capture-proof', name: 'computer.use' },
      { type: 'tool_args', index: 0, chunk: '{"action":"screenshot"}' },
      { type: 'done', finishReason: 'tool_calls' }
    ], [{ type: 'text', delta: 'Capture returned.' }, { type: 'done', finishReason: 'stop' }]] });
    const messages = [{ role: 'user', content: 'Capture the selected disposable evaluation document.' }];
    const events = [];
    const context = { unrestrictedHost: true, inputMode: 'full-power' };
    await runAgentLoop({
      messages, provider, emit: (name, data) => events.push({ name, data }),
      cost: makeCostEngine({ priceOf: provider.priceOf }), model: 'replay/model', agentId: 'cua-eval', runId: 'cua-eval',
      tools: [tool], limits: { maxIters: 4, grace: false }, toolImages: true,
      capCtx: { canRun: () => true, canUse: () => ({ ok: true }), agentId: 'cua-eval', room: 'office' },
      dispatch: async call => ({ ok: true, ...await tool.run(call.args || JSON.parse(call.argsRaw), context) })
    });
    const images = messages.filter(m => m.role === 'user' && Array.isArray(m.content)).flatMap(m => m.content).filter(p => p.type === 'image_url');
    assert.equal(images.length, 1, 'actual CUA screenshot must reach model transcript');
    const results = messages.filter(m => m.role === 'tool');
    assert.equal(results.length, 1);
    assert.match(results[0].content, /capture_after/);
    return { passed: true, imageTurns: images.length, toolResults: results.length, restrictedContextRejected: true, eventNames: events.map(e => e.name) };
  } finally { await conn.close(); }
}
if (require.main === module) run(process.argv[2], Number(process.argv[3]), Number(process.argv[4])).then(r => console.log(JSON.stringify(r))).catch(e => { console.error(e); process.exitCode = 1; });
module.exports = { run };

```

### Core Architecture Module: `dev/user-study-loop-proof.mjs`
```
// USER-STUDY LOOP live proof — real Chrome over CDP, a real seeded sidecar, a deterministic local mock model.
//   interview → confirmed first path → quests planned for THAT step → START QUEST runs real work (a real fs.write
//   tool call) → the artifact contract completes → the Commander reports the other quest → the sidecar settles the
//   step and the plan moves on → restart → what the station learned while the window was closed is offered.
// Owns only its child processes and a fresh scratch workspace. No paid service is called.
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';
import assert from 'node:assert/strict';
import { launchChrome, connectCDP, evalJS, collectDiagnostics, sleep } from '../scripts/lib/cdp.mjs';
import { waitUp, waitDevReady } from '../scripts/lib/seed.mjs';

const port = Number(process.env.USL_PROOF_PORT || 9187), cdpPort = Number(process.env.USL_PROOF_CDP || 9587);
const url = `http://127.0.0.1:${port}/`, out = resolve('dev/.scratch-workspace-usl-proof');
const ws = join(out, 'ws'), profile = join(out, 'profile');
rmSync(out, { recursive: true, force: true }); mkdirSync(profile, { recursive: true });
let seed, chrome, cdp, log = '';
const requests = [];
const model = 'usl-proof/model';
const STEPS = ['Pick the newsletter niche', 'Write issue one', 'Get ten subscribers'];
const AGENT_Q = 'Draft the niche shortlist', HUMAN_Q = 'Ask three readers which niche';
const ARTIFACT = 'notes/niche-shortlist.md';

const reply = (parsed) => {
  const msgs = parsed.messages || [];
  const all = msgs.map(m => typeof m.content === 'string' ? m.content : JSON.stringify(m.content || '')).join('\n');
  const lastUser = msgs.map(m => m.role).lastIndexOf('user');
  const user = lastUser >= 0 ? String(msgs[lastUser].content || '') : '';
  const calledNames = msgs.slice(lastUser + 1).filter(m => m.role === 'assistant').flatMap(m => m.tool_calls || []).map(t => t.function && t.function.name);
  if (user.includes('Help me with this quest')) {
    const names = (parsed.tools || []).map(t => t.function && t.function.name);
    const write = names.find(n => /^fs.?write$/.test(n || '')), brief = names.find(n => /^brief.?proceed$/.test(n || ''));
    // behave like a real model under the harness's Task Brief gate: settle the brief, then do the work.
    if (brief && !calledNames.includes(brief)) return { tool: { name: brief, args: { objective: 'Draft the niche shortlist', deliverable: ARTIFACT } } };
    if (write && !calledNames.includes(write)) return { tool: { name: write, args: { path: ARTIFACT, content: '# Niche shortlist\n- indie games\n- AI tools\n- local food\n' } } };
    return { text: 'Wrote the shortlist to ' + ARTIFACT + '.' };
  }
  // route on the LAST user message: evidence blocks quote earlier prompts, so a whole-transcript match misroutes.
  if (all.includes('quest master')) {
    if (user.includes('THE STEP YOU ARE PLANNING NOW: ' + STEPS[0])) return { text: [
      'NORTH_STAR: Launch a weekly newsletter about indie games',
      'QUEST: ' + AGENT_Q, 'DESC: Write a shortlist of three candidate niches.', 'REWARD: A concrete niche to choose from',
      'EXECUTION: agent', 'WHY_NOW: The first step is picking the niche.', 'DOMAIN: planning', 'CONTRACT: artifact ' + ARTIFACT,
      'WHY: The Commander wants to launch a newsletter about indie games',
      'QUEST: ' + HUMAN_Q, 'DESC: Message three readers and ask which niche they would read.', 'REWARD: Real reader signal',
      'EXECUTION: commander', 'WHY_NOW: The niche should be validated by readers.', 'DOMAIN: research', 'CONTRACT: attest',
      'WHY: The Commander wants to launch a newsletter about indie games'].join('\n') };
    return { text: 'NONE' };
  }
  if (user.includes('GOAL DECOMPOSITION')) return { text: STEPS.map((s, i) => (i + 1) + '. ' + s).join('\n') };
  if (all.includes('THE READ')) return { text: 'READ: you want a newsletter about indie games off the ground.\nPURPOSE: Launch a weekly newsletter about indie games\nSTACK: NONE' };
  if (all.includes('THE TUESDAY')) return { text: 'ACK: a newsletter — good, that is concrete.\nASK: NONE' };
  return { text: 'Ready.' };
};
const mock = createServer((req, res) => {
  if (req.url.includes('/models')) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ data: [{ id: model, context_length: 32000, pricing: { prompt: '0', completion: '0' }, supported_parameters: ['tools'] }] })); return; }
  let raw = ''; req.on('data', b => raw += b); req.on('end', () => {
    let parsed = {}; try { parsed = JSON.parse(raw); } catch {}
    requests.push(raw);
    const r = reply(parsed);
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    if (r.tool) res.write('data: ' + JSON.stringify({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_' + requests.length, type: 'function', function: { name: r.tool.name, arguments: JSON.stringify(r.tool.args) } }] } }] }) + '\n\n');
    else res.write('data: ' + JSON.stringify({ choices: [{ delta: { content: r.text } }] }) + '\n\n');
    res.write('data: ' + JSON.stringify({ choices: [{ delta: {}, finish_reason: r.tool ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 8, completion_tokens: 8 } }) + '\n\n'); res.end('data: [DONE]\n\n');
  });
});
await new Promise(r => mock.listen(0, '127.0.0.1', r));
const env = { ...process.env, SKYNET_PORT: String(port), SKYNET_DEFAULT_MODEL: model, APPDATA: profile, LOCALAPPDATA: profile, XDG_DATA_HOME: profile,
  SKYNET_OPENROUTER_KEY: 'usl-proof-local-key', SKYNET_OPENROUTER_BASE: `http://127.0.0.1:${mock.address().port}/api/v1`,
  SKYNET_REFLECTION: '0', SKYNET_NIGHTSHIFT: '0', SKYNET_CRON_ENABLED: '0' };
const boot = async () => {
  seed = spawn(process.execPath, ['dev/seed.js', '--keep', '--workspace', ws], { cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'] });
  seed.stdout.on('data', b => log += b); seed.stderr.on('data', b => log += b);
  assert(await waitUp(url), 'seeded sidecar did not start: ' + log.slice(-1500));
};
const stopSeed = async () => {
  if (!seed || seed.exitCode != null) return;
  if (process.platform === 'win32') await new Promise(r => { const k = spawn('taskkill', ['/PID', String(seed.pid), '/T', '/F'], { stdio: 'ignore' }); k.on('exit', r); });
  else seed.kill('SIGTERM');
  await sleep(700);
};
const ev = s => evalJS(cdp, s);
const until = async (expr, msg, tries = 100) => { for (let i = 0; i < tries; i++) { if (await ev(expr)) return; await sleep(250); } throw Error(msg); };
const api = (path, body) => ev(`(async () => { const r = await fetch(${JSON.stringify(path)}, ${body ? `{method:'POST',headers:{'Content-Type':'application/json'},body:${JSON.stringify(JSON.stringify(body))}}` : `{cache:'no-store'}`}); return r.json(); })()`);
const receipt = { steps: {} };
try {
  await boot();
  chrome = launchChrome({ cdpPort, profileDir: join(out, 'chrome') });
  cdp = await connectCDP(cdpPort); const diag = collectDiagnostics(cdp);
  await cdp.send('Runtime.enable'); await cdp.send('Page.enable'); await cdp.send('Page.navigate', { url });
  assert(await waitDevReady(cdp, evalJS, { url }), 'dev station did not enter game');

  // STEP 4 — a new station proposes by default (the sidecar owns the posture).
  receipt.steps.defaultPosture = (await api('/api/autonomy/posture')).summary;
  assert.equal(receipt.steps.defaultPosture.initiative, 'propose'); assert.equal(receipt.steps.defaultPosture.actsUnattended, false);

  // STEP 2 — the real interview (the deferred-interview door runs the same runLeadMeeting the awakening uses).
  await ev(`localStorage.setItem('starnet.interview.deferred.v1','1')`);
  await cdp.send('Page.reload'); assert(await waitDevReady(cdp, evalJS, { url }), 'reload failed');
  await until(`[...document.querySelectorAll('button')].some(b => /do it now/i.test(b.textContent))`, 'deferred interview offer did not appear', 320);
  await ev(`[...document.querySelectorAll('button')].find(b => /do it now/i.test(b.textContent)).click()`);
  const seen = []; let pathLines = null, done = false;
  for (let i = 0; i < 900 && !done; i++) {
    const s = JSON.parse(await ev(`JSON.stringify((() => { const p = document.querySelector('.fnv-dialogue.show'); if (!p) return { closed: true };
      return { line: (p.querySelector('.fnv-line') || {}).textContent || '', more: !!p.querySelector('.fnv-more.show'),
        opts: [...p.querySelectorAll('.fnv-opts .fnv-opt')].map(b => b.textContent.trim()), ta: !!p.querySelector('.fnv-custom-in') }; })())`));
    const has = re => s.opts && s.opts.findIndex(o => re.test(o));
    const clickOpt = async re => { await ev(`[...document.querySelectorAll('.fnv-dialogue.show .fnv-opts .fnv-opt')].find(b => ${re}.test(b.textContent)).click()`); seen.push(String(re)); };
    if (s.closed) { if (await ev(`!!(GoalStore.activeGoal && GoalStore.activeGoal())`)) done = true; await sleep(250); continue; }
    if (has(/A short conversation/) >= 0) await clickOpt(/A short conversation/);
    else if (s.ta && !seen.includes('opening answered') && /what made you want to set up an agent/.test(s.line)) {
      const sent = await ev(`(() => { const t = document.querySelector('.fnv-dialogue.show .fnv-custom-in'), b = document.querySelector('.fnv-dialogue.show .fnv-custom-send'); if (!t || !b) return false; t.value = 'I want to launch a weekly newsletter about indie games.'; t.dispatchEvent(new Event('input', {bubbles:true})); b.click(); return true; })()`);
      if (sent) seen.push('opening answered');
    }
    else if (has(/that’s me/) >= 0) await clickOpt(/that’s me/);
    else if (has(/Line up suggestions/) >= 0) await clickOpt(/Line up suggestions/);
    else if (has(/Confirm the path/) >= 0) {
      pathLines = await ev(`[...document.querySelectorAll('.fnv-dialogue.show .fnv-line, .fnv-dialogue.show .fnv-ink')].map(e => e.textContent).join(' | ')`);
      await
```

### Core Architecture Module: `dev/value-loop-replay.mjs`
```
#!/usr/bin/env node
/* Local-only deterministic provider for exercising the real first-value run and deliverable path.
 * Run from the candidate checkout: node dev/value-loop-replay.mjs [--port=8964] [--resume=<scratchRoot>]
 * Open the printed URL, Work → first draft, paste SAMPLE below or approve the printed source folder.
 * This is labeled fixture evidence, not a model-quality evaluation. No external account is used.
 */
import http from 'node:http';
import { mkdtempSync, mkdirSync, writeFileSync, lstatSync, realpathSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { materializeSeedWorkspace, bootSeededSidecar, waitUp } from '../scripts/lib/seed.mjs';
import { messageContentText } from '../scripts/lib/message-content.mjs';

export const MODEL = 'replay/value-loop-fixture';
export const SAMPLE = 'VALUE_LOOP_FIXTURE — synthetic client notes\nCompleted: homepage draft delivered.\nBlocker: client approval is pending.\nNext step: revise the draft after client feedback.\nOwner and deadline: not recorded.';
export const DRAFT = '# Weekly client update — replay fixture\n\n## Progress\nThe homepage draft was delivered.\n\n## Blocker\nClient approval is pending.\n\n## Next step\nRevise the draft after client feedback.\n\n## Missing facts\nOwner and deadline were not recorded. The source does not establish a reporting date range.\n\n## Evidence\nSynthetic source: “Completed: homepage draft delivered.” “Blocker: client approval is pending.” “Next step: revise the draft after client feedback.”\n\nThis draft was produced by a deterministic local replay for application verification.\n';

// Read-only validation. A resume must retain the exact station state and source bytes being tested.
export function validateResume(input) {
  if (typeof input !== 'string' || !isAbsolute(input)) throw new Error('Resume requires an absolute replay scratch root.');
  const scratch = resolve(input), workspace = join(scratch, 'workspace'), source = join(scratch, 'client-notes');
  const same = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
  for (const dir of [scratch, workspace, source]) {
    const stat = lstatSync(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink() || !same(realpathSync(dir), dir)) throw new Error('Resume requires real replay folders, not links.');
  }
  for (const file of [join(workspace, 'agent.save.json'), join(workspace, 'agent.roster.json'), join(source, 'weekly-notes.md')]) {
    const stat = lstatSync(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink > 1 || !same(realpathSync(file), file)) throw new Error('Resume requires real replay state and source files.');
    if (stat.size > 20 * 1024 * 1024) throw new Error('Resume state exceeds the replay validation limit.');
  }
  const roster = JSON.parse(readFileSync(join(workspace, 'agent.roster.json'), 'utf8'));
  const save = JSON.parse(readFileSync(join(workspace, 'agent.save.json'), 'utf8'));
  if (!save.doc || !Array.isArray(roster.agents) || !roster.agents.length || roster.agents.some(a => a.model !== MODEL)) throw new Error('Resume requires a station configured for the local replay model.');
  if (!readFileSync(join(source, 'weekly-notes.md'), 'utf8').includes('VALUE_LOOP_FIXTURE')) throw new Error('Resume source is not the replay fixture.');
  return { scratch, workspace, source };
}

export function replayTurn(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const user = [...messages].reverse().find(m => m.role === 'user');
  const text = messageContentText(user?.content);
  if (!text.includes('Task: Draft a weekly client update')) return { text: 'Local replay fixture: no background suggestion.' };
  const tools = (body.tools || []).map(t => t.function?.name).filter(Boolean);
  const named = pattern => tools.find(t => pattern.test(t));
  const priorCalls = messages.flatMap(m => m.role === 'assistant' && Array.isArray(m.tool_calls) ? m.tool_calls : []);
  const called = pattern => priorCalls.some(t => pattern.test(t.function?.name || ''));
  const results = messages.filter(m => m.role === 'tool');
  const lastResult = results.length ? messageContentText(results[results.length - 1].content) : '';
  // A rejected real tool call is never narrated as a successful write by this fixture.
  if (/"(?:ok|success)"\s*:\s*false|"error"\s*:|^Error:/i.test(lastResult)) return { text: 'Local replay stopped after a tool error: ' + lastResult.slice(0, 600) };
  const proceed = named(/^brief[_.]proceed$/);
  if (proceed && !called(/^brief[_.]proceed$/)) return { tool: proceed, args: { objective: 'Draft a weekly client update from the supplied replay fixture notes.' } };
  const folderMatch = text.match(/approved folder: ("(?:[^"\\]|\\.)*")/);
  if (folderMatch) {
    const read = named(/^fs[_.]read$/);
    if (!called(/^fs[_.]read$/)) {
      if (!read) return { text: 'Local replay needs the real file-read tool for a folder source. No file was read.' };
      return { tool: read, args: { path: join(JSON.parse(folderMatch[1]), 'weekly-notes.md') } };
    }
    if (!results.some(m => messageContentText(m.content).includes('VALUE_LOOP_FIXTURE'))) return { text: 'The selected folder did not return the replay fixture. No draft was fabricated.' };
  } else if (!text.includes('VALUE_LOOP_FIXTURE')) return { text: 'Paste the printed VALUE_LOOP_FIXTURE notes to exercise this deterministic provider.' };
  const write = named(/^fs[_.]write$/);
  if (write && !called(/^fs[_.]write$/)) return { tool: write, args: { path: 'weekly-client-update.md', content: DRAFT } };
  return { text: DRAFT + (called(/^fs[_.]write$/) ? '\nSaved deliverable: weekly-client-update.md' : '\nThe file-write tool was unavailable; the complete draft is above.') };
}

export function startReplayProvider() {
  return new Promise(resolveProvider => {
    const requests = [];
    const server = http.createServer((req, res) => {
      if (req.url?.includes('/models')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ data: [{ id: MODEL, name: 'Local replay fixture', context_length: 32768, pricing: { prompt: '0', completion: '0' }, supported_parameters: ['tools'] }] }));
      }
      if (!req.url?.includes('/chat/completions')) { res.writeHead(404); return res.end(); }
      let raw = '';
      req.on('data', chunk => { raw += chunk; if (raw.length > 2 * 1024 * 1024) req.destroy(); });
      req.on('end', () => {
        let body;
        try { body = JSON.parse(raw); } catch { res.writeHead(400); return res.end(); }
        const turn = replayTurn(body);
        requests.push({ at: Date.now(), model: body.model, tool: turn.tool || null, result: turn.tool ? 'tool-request' : 'text' });
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' });
        const delta = turn.tool ? { tool_calls: [{ index: 0, id: 'fixture_' + requests.length, type: 'function', function: { name: turn.tool, arguments: JSON.stringify(turn.args) } }] } : { content: turn.text };
        res.write('data: ' + JSON.stringify({ choices: [{ delta }] }) + '\n\n');
        res.write('data: ' + JSON.stringify({ choices: [{ delta: {}, finish_reason: turn.tool ? 'tool_calls' : 'stop' }], usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 } }) + '\n\n');
        res.end('data: [DONE]\n\n');
      });
    });
    server.listen(0, '127.0.0.1', () => resolveProvider({ server, requests, base: 'http://127.0.0.1:' + server.address().port + '/api/v1' }));
  });
}

async function main() {
  const arg = process.argv.find(v => v.startsWith('--port='));
  const port = Number(arg ? arg.slice(7) : 8964);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Choose an unprivileged local port.');
  const url = 'http://127.0.0.1:' + port + '/';
  // Refuse an occupied port: verification must not quietly attach to somebody else's running station.
  try { const res = await fetch(url, { signal: AbortSignal.timeout(700) }); if (res) throw new Error('PORT_OCCUPIED'); }
  catch (e) { if (e.message === 'PORT_OCCUPIED') throw new Error('Port ' + port + ' is already in use.'); }
  const resumeArg = process.argv.find(v => v.startsWith('--resume='));
  let scratch, workspace, source;
  if (resumeArg) ({ scratch, workspace, source } = validateResume(resumeArg.slice(9)));
  else {
    scratch = mkdtempSync(join(tmpdir(), 'starnet-value-replay-'));
    workspace = join(scratch, 'workspace'); source = join(scratch, 'client-notes');
    materializeSeedWorkspace(workspace, MODEL);
    mkdirSync(source); writeFileSync(join(source, 'weekly-notes.md'), SAMPLE + '\n');
  }
  const mock = await startReplayProvider();
  const child = bootSeededSidecar({ port, model: MODEL, key: 'local-replay-placeholder-not-a-credential', scratchDir: workspace, env: {
    SKYNET_OPENROUTER_BASE: mock.base, STARNET_OPENROUTER_BASE: mock.base,
    STARNET_OPENROUTER_KEY: 'local-replay-placeholder-not-a-credential',
    SKYNET_QUEST_REFRESH: '0', SKYNET_SCOUT: '0'
  } });
  let stopping = false;
  function stop() { if (stopping) return; stopping = true; child.kill(); mock.server.close(); }
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  child.once('exit', () => { stop(); });
  if (!await waitUp(url)) { stop(); throw new Error('Seeded sidecar did not start.'); }
  console.log('LOCAL REPLAY FIXTURE — not a production model or quality evaluation');
  if (resumeArg) console.log('RESUME — existing state and source retained without reseeding.');
  console.log('App: ' + url + '\nSource folder (approve explicitly in app): ' + source + '\nWorkspace: ' + workspace);
  console.log('Sample to paste:\n' + SAMPLE);
  console.log('Stop with Ctrl+C. The scratch workspace is retained for inspection.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(res
```

### Core Architecture Module: `dev/voice-loopback.js`
```
/* dev/voice-loopback.js — prove the OFFLINE voice engine end to end without a microphone.
 *
 *   node dev/voice-loopback.js [--bundle-root <dir>] [--wav <output.wav>]
 *
 * Kokoro synthesizes a known phrase, we decode that WAV, and Whisper transcribes it back. If the text
 * survives the round trip, both halves of the local engine are genuinely working — which is the one claim
 * that cannot be made from unit tests, because they never load a model.
 *
 * Run it from a SIMULATED BUNDLE (a dir holding sidecar/ beside node_modules/) to prove the packaged
 * layout resolves, which is how the resource wiring in tauri.conf.json was verified.
 *
 * GOTCHA: Kokoro emits 32-bit FLOAT wav at 24 kHz, not 16-bit PCM. Decoding it as int16 yields noise, and
 * Whisper answers noise with the word "You" — which reads exactly like a broken engine. */
const fs = require('fs');
const os = require('os');
const path = require('path');
const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const bundleRoot = path.resolve(arg('--bundle-root', path.join(__dirname, '..')));
const wavOutput = path.resolve(arg('--wav', path.join(os.tmpdir(), 'starnet-voice-loopback.wav')));
const lv = require(path.join(bundleRoot, 'sidecar', 'local-voice.js'));

function decodeWav(wav) {
  const dv = new DataView(wav.buffer, wav.byteOffset, wav.byteLength);
  let pos = 12, fmt = null, dataOff = 0, dataLen = 0;
  while (pos < wav.length - 8) {
    const id = String.fromCharCode(wav[pos], wav[pos + 1], wav[pos + 2], wav[pos + 3]);
    const sz = dv.getUint32(pos + 4, true);
    if (id === 'fmt ') fmt = { fmtTag: dv.getUint16(pos + 8, true), ch: dv.getUint16(pos + 10, true), rate: dv.getUint32(pos + 12, true), bits: dv.getUint16(pos + 22, true) };
    if (id === 'data') { dataOff = pos + 8; dataLen = sz; break; }
    pos += 8 + sz + (sz % 2);
  }
  const bytesPer = fmt.bits / 8;
  const n = Math.floor(dataLen / bytesPer / fmt.ch);
  const mono = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const off = dataOff + i * bytesPer * fmt.ch;
    mono[i] = fmt.bits === 32 ? dv.getFloat32(off, true) : dv.getInt16(off, true) / 32768;
  }
  return { fmt, mono };
}

function resampleTo16k(mono, rate) {
  if (rate === 16000) return mono;
  const ratio = rate / 16000;
  const out = new Float32Array(Math.floor(mono.length / ratio));
  for (let i = 0; i < out.length; i++) {
    const s = Math.floor(i * ratio), e = Math.min(mono.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = s; j < e; j++) sum += mono[j];
    out[i] = sum / Math.max(1, e - s);
  }
  return out;
}

const norm = s => String(s || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const sameWords = (a, b) => {
  const left = norm(a), right = norm(b);
  // ASR may split or join a compound ("taskboard" ↔ "task board"). That is the same letter
  // sequence and command meaning; do not forgive substitutions, omissions, or extra words.
  return left === right || left.replace(/ /g, '') === right.replace(/ /g, '');
};

(async () => {
  const t0 = Date.now();
  await lv.warm();
  console.log('warm ok in ' + ((Date.now() - t0) / 1000).toFixed(1) + 's | asr=' + lv.status().asr + ' tts=' + lv.status().tts);

  const PHRASES = [
    'open the taskboard and start the build',
    'stop the night shift',
    'what did you finish while I was away'
  ];

  let pass = 0;
  for (const phrase of PHRASES) {
    const wav = await lv.synthesize(phrase, { voice: 'af_heart', speed: 1 });
    const decoded = decodeWav(wav);
    const pcm = resampleTo16k(decoded.mono, decoded.fmt.rate);
    let peak = 0;
    for (let i = 0; i < pcm.length; i++) peak = Math.max(peak, Math.abs(pcm[i]));
    const heard = await lv.transcribe(Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength));
    const ok = sameWords(heard, phrase);
    if (ok) pass++;
    console.log('\n  said : "' + phrase + '"');
    console.log('  heard: "' + heard + '"');
    console.log('  wav  : ' + wav.length + 'B ' + decoded.fmt.rate + 'Hz ' + decoded.fmt.bits + 'bit | peak ' + peak.toFixed(3) +
      ' | ' + (pcm.length / 16000).toFixed(2) + 's | tts ' + lv.status().lastTtsMs + 'ms asr ' + lv.status().lastAsrMs + 'ms');
    console.log('  ' + (ok ? 'MATCH' : 'MISMATCH'));
  }
  fs.mkdirSync(path.dirname(wavOutput), { recursive: true });
  fs.writeFileSync(wavOutput, await lv.synthesize(PHRASES[0], { voice: 'af_heart', speed: 1 }));
  console.log('proof wav: ' + wavOutput);
  console.log('\nRESULT: ' + pass + '/' + PHRASES.length + ' round-trips matched');
  process.exit(pass === PHRASES.length ? 0 : 2);
})().catch(e => { console.error('FAILED:', (e && e.message) || e); process.exit(1); });

```

### Core Architecture Module: `frontend/app/backdrop-bake-worker.js`
```
'use strict';
const motion = { matches: false };
const window = { devicePixelRatio: 1, screen: {}, matchMedia: () => motion };
const document = { createElement: tag => {
  if (tag !== 'canvas') throw new Error('Backdrop baking only creates canvases');
  return new OffscreenCanvas(1, 1);
} };
let loaded = false;
self.onmessage = ({ data }) => {
  const { kind, token, id, width, height } = data;
  try {
    if (!['sky', 'ground'].includes(kind) || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 8192 || height > 8192 || width * height > 20000000) throw new Error('Invalid bake dimensions');
    window.devicePixelRatio = data.dpr || 1; window.screen = data.screen || {}; motion.matches = !!data.reduced;
    if (!loaded) { importScripts('spacebg.js', 'terrain.js'); loaded = true; }
    if (kind === 'ground') {
      if (!Terrain.GROUNDS[id] || !Number.isFinite(data.scale) || data.scale <= 0) throw new Error('Invalid ground');
      Terrain.setGround(id);
      const canvas = new OffscreenCanvas(width, height), ctx = canvas.getContext('2d');
      const cam = { scale: data.scale, panX: -data.left * data.scale, panY: -data.top * data.scale };
      ctx.imageSmoothingEnabled = false;
      ctx.setTransform(cam.scale, 0, 0, cam.scale, cam.panX, cam.panY);
      Terrain.draw(ctx, cam, width, height, data.station);
      const bitmap = canvas.transferToImageBitmap();
      self.postMessage({ token, bitmap }, [bitmap]);
      return;
    }
    const built = SpaceBG.bake(id, width, height), transfers = [], seen = new Map();
    // THE VOID's additional animation plates are generators in the direct renderer.
    // Finish them here; generator closures cannot cross the worker boundary.
    while (built.state.nebJobs?.length) {
      let result;
      do { result = built.state.nebJobs[0].next(); } while (!result.done);
      built.state.nebPlates.push(result.value);
      built.state.nebJobs.shift();
    }
    function pack(value) {
      if (!value || typeof value !== 'object') return value;
      if (seen.has(value)) return seen.get(value);
      if (value instanceof OffscreenCanvas) {
        const bitmap = value.transferToImageBitmap(); seen.set(value, bitmap); transfers.push(bitmap); return bitmap;
      }
      if (ArrayBuffer.isView(value)) return value;
      const out = Array.isArray(value) ? [] : {}; seen.set(value, out);
      for (const [key, child] of Object.entries(value)) out[key] = pack(child);
      return out;
    }
    self.postMessage({ token, ...pack(built) }, transfers);
  } catch (_) { self.postMessage({ token, failed: true }); }
};

```

### Core Architecture Module: `frontend/app/backdrop-preview-worker.js`
```
/* The same deterministic sky/ground sample functions, with scratch OffscreenCanvases.
   No station state is imported or modified. Only finished thumbnail pixels cross threads. */
'use strict';
const motion = { matches: false };
const window = { devicePixelRatio: 1, screen: {}, matchMedia: () => motion };
const document = { createElement: tag => {
  if (tag !== 'canvas') throw new Error('Backdrop samples only create canvases');
  return new OffscreenCanvas(1, 1);
} };
let loaded = false;
self.onmessage = ({ data }) => {
  const { token, id, width, height } = data;
  try {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 512 || height > 256) throw new Error('Invalid sample size');
    window.devicePixelRatio = data.dpr || 1; window.screen = data.screen || {}; motion.matches = !!data.reduced;
    if (!loaded) { importScripts('terrain.js', 'spacebg.js'); loaded = true; }
    const canvas = new OffscreenCanvas(width, height), ctx = canvas.getContext('2d');
    if (Terrain.GROUNDS[id]) Terrain.paintSample(ctx, width, height, id);
    else SpaceBG.paintSample(ctx, width, height, id, 8000);
    const bitmap = canvas.transferToImageBitmap();
    self.postMessage({ token, bitmap }, [bitmap]);
  } catch (_) { self.postMessage({ token, failed: true }); }
};

```

### Core Architecture Module: `frontend/app/cloudsavecore.js`
```
/* STARNET — cloudsavecore.js : the pure, testable brain of the durable-mirror sync.

   cloudsave.js does the I/O (fetch/beacon/timers); THIS module holds the state machine that
   decides "when do we retry?" and "is the durable mirror stale?" — no browser globals, no
   fetch, no DOM — so it can be unit-tested in Node exactly like updatecore.js.

   Two concerns:
     • Backoff schedule — after a failed flush, WHEN is the next attempt due? Capped exponential
       (5s → 30s → 2m, cap 5m), reset to base on the first success.
     • Health record — lastPushOkAt / lastPushFailAt / consecutiveFailures, plus a derived
       `stale` verdict the save-dot reads: persists are happening but the durable mirror hasn't
       accepted a write in a while AND at least one failure has occurred since. That verdict is
       what makes the UI TRUTHFUL — the dot only claims "backed up" when the backend can prove it.

   Every function is pure: give it the prior state + a clock reading, get the next state back. */
'use strict';

const CloudSaveCore = (() => {
  // backoff ladder: 5s, then double each failure, capped at 5m.
  const RETRY_BASE_MS = 5_000;
  const RETRY_MAX_MS = 5 * 60_000;      // 5 minutes
  // staleness: the durable mirror is "stale" once it has gone this long without a confirmed push
  // WHILE at least one failure has happened since the last success (a healthy quiet period is NOT stale).
  const STALE_AFTER_MS = 60 * 60_000;   // 60 minutes
  // early-warning threshold (EL-11 FIX 4): a live streak of this many consecutive failed pushes flips the
  // save-dot to a warn state IMMEDIATELY — a broken disk (EPERM/full) must not get a 60-minute blind window.
  const WARN_AFTER_FAILURES = 3;

  function num(v) { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : 0; }

  // a fresh health record: nothing pushed yet, no failures.
  function freshHealth() {
    return { lastPushOkAt: 0, lastPushFailAt: 0, consecutiveFailures: 0, nextRetryAt: 0 };
  }

  // normalize any prior health (from another module / a partial object) into the full shape.
  function hydrate(h) {
    h = (h && typeof h === 'object') ? h : {};
    return {
      lastPushOkAt: num(h.lastPushOkAt),
      lastPushFailAt: num(h.lastPushFailAt),
      consecutiveFailures: Number.isFinite(h.consecutiveFailures) && h.consecutiveFailures > 0 ? Math.floor(h.consecutiveFailures) : 0,
      nextRetryAt: num(h.nextRetryAt)
    };
  }

  // the delay before the Nth consecutive failure's retry: base * 2^(n-1), capped. n is 1-based.
  function backoffFor(consecutiveFailures) {
    const n = Math.max(1, Math.floor(consecutiveFailures || 1));
    // 2^(n-1) can overflow for huge n; cap the exponent so we never produce Infinity before the min().
    const exp = Math.min(n - 1, 30);
    return Math.min(RETRY_BASE_MS * Math.pow(2, exp), RETRY_MAX_MS);
  }

  // record a SUCCESSFUL push at `now`: clears the failure streak + retry timer, stamps lastPushOkAt.
  function recordSuccess(h, now) {
    h = hydrate(h);
    return { lastPushOkAt: num(now), lastPushFailAt: h.lastPushFailAt, consecutiveFailures: 0, nextRetryAt: 0 };
  }

  // record a FAILED push at `now`: bumps the streak, stamps lastPushFailAt, schedules the next retry.
  function recordFailure(h, now) {
    h = hydrate(h);
    const streak = h.consecutiveFailures + 1;
    return { lastPushOkAt: h.lastPushOkAt, lastPushFailAt: num(now), consecutiveFailures: streak, nextRetryAt: num(now) + backoffFor(streak) };
  }

  // is a queued doc allowed to attempt a flush now, or is it still inside its backoff window?
  // (No failures yet → always allowed.)
  function retryDue(h, now) {
    h = hydrate(h);
    if (h.consecutiveFailures <= 0) return true;
    return num(now) >= h.nextRetryAt;
  }

  // TRUTHFUL staleness verdict for the save-dot. Stale ONLY when there is a live failure streak
  // AND the last confirmed push is older than STALE_AFTER_MS (or there has NEVER been one while
  // failures are accruing). A clean record — or a quiet period with no failures — is never stale.
  function isStale(h, now) {
    h = hydrate(h);
    if (h.consecutiveFailures <= 0) return false;            // nothing failing right now
    now = num(now);
    if (h.lastPushOkAt <= 0) return true;                    // never once succeeded, yet failing → stale
    return (now - h.lastPushOkAt) >= STALE_AFTER_MS;
  }

  // EARLY-WARNING verdict (EL-11 FIX 4): true once the live failure streak reaches WARN_AFTER_FAILURES,
  // regardless of how recent the last success was. Truthful and cheap: the streak IS the proof (a repeatedly
  // refused/erroring POST — disk full, EPERM, refused write), so the dot may advise within minutes, not after
  // the 60-minute stale line. Cleared by the first success (recordSuccess zeroes the streak).
  function isWarn(h) {
    h = hydrate(h);
    return h.consecutiveFailures >= WARN_AFTER_FAILURES;
  }

  // a stable, JSON-friendly snapshot for CloudSave.health() consumers (UI + tests).
  function snapshot(h, now) {
    h = hydrate(h);
    return {
      lastPushOkAt: h.lastPushOkAt,
      lastPushFailAt: h.lastPushFailAt,
      consecutiveFailures: h.consecutiveFailures,
      nextRetryAt: h.nextRetryAt,
      warn: isWarn(h),
      stale: isStale(h, now)
    };
  }

  return {
    RETRY_BASE_MS, RETRY_MAX_MS, STALE_AFTER_MS, WARN_AFTER_FAILURES,
    freshHealth, hydrate, backoffFor, recordSuccess, recordFailure, retryDue, isStale, isWarn, snapshot
  };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = CloudSaveCore;

```

### Core Architecture Module: `frontend/app/goalloop.js`
```
/* STARNET — goalloop.js : the PURE GOAL-LOOP state machine (StarNet's "Ralph loop").

   The autonomous engine behind /goal: the Commander sets a standing goal on a workstream; after each turn
   lands, an auxiliary JUDGE model is asked "is this goal satisfied by the agent's last response?" and returns
   a one-line JSON verdict {done, reason}. If not done, a CONTINUATION prompt (goal + subgoals + judge reason)
   is auto-queued as the next turn. The loop ends when the judge says done, the continuation budget is spent,
   a real user message preempts it, or the Commander pauses/clears it. Mirrors the reference CLI's goal loop, minus
   the wait-barrier (StarNet's /goal has no async-process registry to park on).

   PURE + node-testable (a `GoalLoop` global in the browser, module.exports under node), mirroring goals.js /
   dossier.js: NO Date.now / Math.random — the clock is ALWAYS injected. This file owns ONLY the deterministic
   verdict-parse + the continuation/preemption/budget state machine over a plain serializable state object; the
   browser wiring (chat.js) supplies the clock, the aux model call, and persistence (the state rides on the
   workstream record so it survives a reload exactly like the thread history).

   The state object (serializable; lives at ws.goalLoop):
     { goal, status, turnsUsed, maxTurns, subgoals:[…], lastVerdict, lastReason,
       pausedReason, parseFails, createdAt, lastTurnAt }
   status: 'active' | 'paused' | 'done' | 'cleared'

   Fail-open by construction: an unparseable judge reply → CONTINUE (a broken judge must never wedge progress;
   the turn budget + the consecutive-parse-failure auto-pause are the backstops). A station with no goalloop.js
   loaded is byte-identical to before (additive-only). */
'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.GoalLoop = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DEFAULT_MAX_TURNS = 20;                 // the continuation budget: a hard backstop against a runaway loop
  const MAX_PARSE_FAILS = 3;                     // N consecutive unparseable judge replies → auto-pause (weak judge model)
  const GOAL_CHARS = 2000, SUB_CHARS = 400, REASON_CHARS = 300;   // caps on stored/echoed strings (bound the prompt)
  const RESP_SNIPPET = 4000;                     // how much of the last reply we hand the judge

  const clamp = (s, n) => { s = String(s == null ? '' : s).trim(); return s.length > n ? s.slice(0, n) : s; };

  /* ============================ VERDICT PARSE (pure, fail-open) ============================
     Read the judge's reply into { verdict:'done'|'continue', reason, parseFailed }. parseFailed is true ONLY
     when the call returned a body we could not interpret as the JSON contract (empty / prose / malformed) — the
     caller counts those toward the auto-pause. Accepts the {done:<bool>} shape AND a {verdict:'done'|'continue'}
     shape, tolerates a ```json fence and prose around the object, and always fails open to CONTINUE. */
  const JSON_OBJ = /\{[\s\S]*?\}/;
  function parseVerdict(raw) {
    if (raw == null || !String(raw).trim()) return { verdict: 'continue', reason: 'judge returned empty response', parseFailed: true };
    let text = String(raw).trim();
    if (text.indexOf('```') === 0) {                       // strip a leading markdown code fence + its lang tag
      text = text.replace(/^```[a-zA-Z]*\s*/, '').replace(/```\s*$/, '').trim();
    }
    let data = null;
    try { data = JSON.parse(text); } catch (_) {
      const m = JSON_OBJ.exec(text);                        // pull the first {…} object out of surrounding prose
      if (m) { try { data = JSON.parse(m[0]); } catch (_2) { data = null; } }
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return { verdict: 'continue', reason: 'judge reply was not JSON', parseFailed: true };
    }
    const reason = clamp(data.reason, REASON_CHARS) || 'no reason given';
    let verdict;
    if (typeof data.verdict === 'string') {
      verdict = data.verdict.trim().toLowerCase();
    } else {
      const dv = data.done;
      const done = (typeof dv === 'string') ? (['true', 'yes', '1', 'done'].indexOf(dv.trim().toLowerCase()) >= 0) : !!dv;
      verdict = done ? 'done' : 'continue';
    }
    if (verdict !== 'done' && verdict !== 'continue') verdict = 'continue';   // any unknown verdict → keep going
    return { verdict: verdict, reason: reason, parseFailed: false };
  }

  /* ============================ STATE FACTORY + NORMALIZE ============================ */

  function create(goal, opts) {
    opts = opts || {};
    const g = clamp(goal, GOAL_CHARS);
    if (!g) return null;                                   // an empty goal is not a loop
    const t = +opts.now || 0;
    let mt = parseInt(opts.maxTurns, 10);
    if (!(mt > 0)) mt = DEFAULT_MAX_TURNS;
    return {
      goal: g, status: 'active', turnsUsed: 0, maxTurns: mt,
      subgoals: [], lastVerdict: null, lastReason: null, pausedReason: null,
      parseFails: 0, createdAt: t, lastTurnAt: 0
    };
  }

  // re-normalize a persisted/foreign state object into a safe shape (fail-open on a corrupt row); null if unusable.
  function normalize(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const g = clamp(raw.goal, GOAL_CHARS);
    if (!g) return null;
    const st = ['active', 'paused', 'done', 'cleared'].indexOf(raw.status) >= 0 ? raw.status : 'active';
    let mt = parseInt(raw.maxTurns, 10); if (!(mt > 0)) mt = DEFAULT_MAX_TURNS;
    const subs = Array.isArray(raw.subgoals) ? raw.subgoals.map(s => clamp(s, SUB_CHARS)).filter(Boolean).slice(0, 20) : [];
    return {
      goal: g, status: st, turnsUsed: Math.max(0, parseInt(raw.turnsUsed, 10) || 0), maxTurns: mt,
      subgoals: subs, lastVerdict: raw.lastVerdict || null, lastReason: raw.lastReason || null,
      pausedReason: raw.pausedReason || null, parseFails: Math.max(0, parseInt(raw.parseFails, 10) || 0),
      createdAt: +raw.createdAt || 0, lastTurnAt: +raw.lastTurnAt || 0
    };
  }

  const isActive = s => !!(s && s.status === 'active');
  const hasGoal = s => !!(s && (s.status === 'active' || s.status === 'paused'));

  /* ============================ MUTATIONS (all return the state for chaining) ============================ */

  function addSubgoal(s, text) {
    if (!hasGoal(s)) return null;
    const t = clamp(text, SUB_CHARS);
    if (!t) return null;
    if (s.subgoals.length >= 20) return null;              // a sane ceiling on criteria
    s.subgoals.push(t);
    return t;
  }
  function pause(s, reason) {
    if (!s || s.status === 'cleared' || s.status === 'done') return s;
    s.status = 'paused'; s.pausedReason = clamp(reason, REASON_CHARS) || 'paused';
    return s;
  }
  function resume(s, opts) {
    opts = opts || {};
    if (!s || (s.status !== 'paused')) return s;
    s.status = 'active'; s.pausedReason = null;
    if (opts.resetBudget !== false) { s.turnsUsed = 0; s.parseFails = 0; }   // a fresh window on resume (reference-harness parity)
    return s;
  }
  function clear(s) { if (s) { s.status = 'cleared'; } return s; }

  /* ============================ CONTINUATION PROMPT ============================
     The next-turn message fed back to the agent — a plain user-role directive, NO system-prompt mutation and NO
     toolset swap (prompt caching + the moat's real-prop reach stay intact). Carries the goal, any subgoals, and
     the judge's reason so the agent knows why it's still going. */
  function continuationPrompt(s) {
    if (!isActive(s)) return null;
    let p = '[Continuing toward your standing goal]\nGoal: ' + s.goal + '\n\n';
    if (s.subgoals.length) {
      p += 'Additional criteria the Commander added:\n'
        + s.subgoals.map((t, i) => '- ' + (i + 1) + '. ' + t).join('\n') + '\n\n'
        + 'Continue working toward the goal AND every criterion. Take the next concrete step. '
        + 'If the goal and all criteria are complete, say so explicitly and stop. '
        + 'If you are blocked and need input, say so clearly and stop.';
    } else {
      p += 'Continue working toward this goal. Take the next concrete step. '
        + 'If you believe the goal is complete, state so explicitly and stop. '
        + 'If you are blocked and need input from the user, say so clearly and stop.';
    }
    return p;
  }

  /* ============================ THE JUDGE PROMPT ============================
     A reason-only aux call (chat.js runs it through the same internal:true Harness.chat path pitchstore/goalstore
     use). System + user text are pure functions of the state + the last reply so they're deterministic + testable. */
  const JUDGE_SYSTEM =
    'You are a strict judge deciding whether an autonomous agent has achieved a user\'s stated goal. '
    + 'You receive the goal text and the agent\'s most recent response. Decide one verdict.\n\n'
    + 'DONE — the goal is fully satisfied: the response confirms completion, shows the final deliverable was '
    + 'produced, OR explains the goal is unachievable / blocked / needs user input (treat a genuine block as DONE '
    + 'with a reason describing it).\n'
    + 'CONTINUE — not done, and there is a concrete next step the agent can take right now. This is the default '
    + 'when in doubt.\n\n'
    + 'Reply ONLY with a single JSON object on one line, no prose, no code fence:\n'
    + '{"verdict": "done", "reason": "<one sentence>"}  or  {"verdict": "continue", "reason": "<one sentence>"}';

  function judgeUser(s, lastResponse, opts) {
    opts = opts || {};
    const resp = clamp(lastResponse, RESP_SNIPPET);
    let u = 'Goal:\n' + s.goal + '\n\n';
    if (s.subgoals.length) {
      u += 'Additional criteria the user added (ALL must also be satisfied for DONE):\n'
        + s.subgoals.map((t, i) => '- ' + (i + 1) + '. ' + t).join('\n') + '\n\n';
```

### Core Architecture Module: `frontend/app/lifecycle.js`
```
/* Lifecycle: desktop bridge for Lane 4D — launch-at-login, tray start/close preferences, and the live "what
   keeps running when you close the window" summary. In browser preview Tauri commands are absent, so calls use an
   honest no-op shape (supervised:false, autostart unavailable) — the Settings panel stays truthful without
   branching everywhere. The tray supervisor (Rust) owns the real close-to-tray decision; this module only reads
   its state and toggles the login setting. */
'use strict';

const Lifecycle = (() => {
  const AUTOSTART_STATUS = 'starnet_autostart_status';
  const AUTOSTART_SET = 'starnet_set_autostart';
  const LIFECYCLE_STATUS = 'starnet_lifecycle_status';
  const START_MINIMIZED_SET = 'starnet_set_start_minimized';
  const CLOSE_TO_TRAY_SET = 'starnet_set_close_to_tray';

  function currentWindow() {
    return (typeof window !== 'undefined') ? window : null;
  }

  function tauriCore(win) {
    return win && win.__TAURI__ && win.__TAURI__.core && typeof win.__TAURI__.core.invoke === 'function'
      ? win.__TAURI__.core
      : null;
  }

  function isDesktop(win) {
    return !!tauriCore(win || currentWindow());
  }

  // Launch-at-login: OFF by default, opt-in. Returns { desktop, enabled } — enabled reflects the REAL OS state
  // (read back after any change), never an assumed value. In the browser it's { desktop:false, enabled:false }.
  async function autostartStatus(opts) {
    opts = opts || {};
    const core = tauriCore(opts.win || currentWindow());
    if (!core) return { desktop: false, enabled: false };
    try {
      const raw = await core.invoke(AUTOSTART_STATUS, {});
      return { desktop: !!(raw && raw.desktop), enabled: !!(raw && raw.enabled) };
    } catch (_) {
      return { desktop: true, enabled: false };
    }
  }

  async function setAutostart(enabled, opts) {
    opts = opts || {};
    const core = tauriCore(opts.win || currentWindow());
    if (!core) return { desktop: false, enabled: false };
    const raw = await core.invoke(AUTOSTART_SET, { enabled: !!enabled });
    return { desktop: !!(raw && raw.desktop), enabled: !!(raw && raw.enabled) };
  }

  function preferenceShape(raw) {
    return {
      startMinimized: !!(raw && raw.startMinimized),
      closeToTray: !!(raw && raw.closeToTray)
    };
  }

  async function setStartMinimized(enabled, opts) {
    opts = opts || {};
    const core = tauriCore(opts.win || currentWindow());
    if (!core) return preferenceShape(null);
    return preferenceShape(await core.invoke(START_MINIMIZED_SET, { enabled: !!enabled }));
  }

  async function setCloseToTray(enabled, opts) {
    opts = opts || {};
    const core = tauriCore(opts.win || currentWindow());
    if (!core) return preferenceShape(null);
    return preferenceShape(await core.invoke(CLOSE_TO_TRAY_SET, { enabled: !!enabled }));
  }

  // The live armed-work summary: { supervised, armed, reasons[] }. `supervised` is true only in the desktop tray
  // build — the ONLY build where closing the window can keep the station running. Browser => supervised:false.
  async function status(opts) {
    opts = opts || {};
    const core = tauriCore(opts.win || currentWindow());
    if (!core) return { supervised: false, armed: false, reasons: [], startMinimized: false, closeToTray: false };
    try {
      const raw = await core.invoke(LIFECYCLE_STATUS, {});
      return Object.assign({
        supervised: !!(raw && raw.supervised),
        armed: !!(raw && raw.armed),
        reasons: (raw && Array.isArray(raw.reasons)) ? raw.reasons.slice() : []
      }, preferenceShape(raw));
    } catch (_) {
      return { supervised: false, armed: false, reasons: [], startMinimized: false, closeToTray: false };
    }
  }

  return {
    isDesktop,
    autostartStatus,
    setAutostart,
    setStartMinimized,
    setCloseToTray,
    status,
    _internals: { AUTOSTART_STATUS, AUTOSTART_SET, LIFECYCLE_STATUS, START_MINIMIZED_SET, CLOSE_TO_TRAY_SET, tauriCore, preferenceShape }
  };
})();

if (typeof window !== 'undefined') window.Lifecycle = Lifecycle;
if (typeof module !== 'undefined') module.exports = Lifecycle;

```

### Core Architecture Module: `frontend/app/loop-templates.js`
```
/* STARNET — loop-templates.js : the LOOP SHAPES a beginner picks instead of writing a loop from scratch.

   THE PROBLEM THIS SOLVES. A blank "what should it keep doing?" box is the reason loops are confusing: it
   asks someone who has never run one to invent the cycle, the stopping condition, and the guard rails all at
   once. A template supplies all three and leaves two blanks. Picking BUILD · TEST · VERIFY and typing a goal
   should produce a loop that is already shaped correctly.

   Deliberately modelled on recipes.js (`params[]` + token-filled template + a frozen catalog), because that
   pattern is proven here and the marketplace already knows how to render it. The difference is what a loop
   template additionally carries: the CYCLE (`shape`), what ENDS it (`exitOn`), and how strong that ending
   actually is (`rigor`).

   RIGOR IS NOT DECORATION. Only a loop whose exit condition is a real process exit code has a HARD guarantee:
   the station runs the project's own check and reads the code. Everything else — "keep sweeping until you stop
   finding things", "research until nothing new turns up" — rests on the model honestly reporting an empty
   digest each pass, which is a convention, not a proof. Both are useful; presenting them as equally rigorous
   would be a truthful-telemetry violation, so `rigor` rides on the record and the UI must show it.

   PURE: no DOM, no fetch, no clock. Headless-testable (test/loop-templates.test.js).

   Surface:
     list()                          -> Template[]
     get(id)                         -> Template | null
     fillTokens(str, values)         -> string
     requiredMissing(id, values)     -> string[]           // keys still blank
     buildSpec(id, values)           -> spec               // the POST /api/loops body
     rigorNote(t)                    -> string             // the honest one-liner about how this loop ends
*/
'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.LoopTemplates = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* THE DIGEST RULE — lifted from the QA crew's own loop directives (loops/README.md rule 4), because it is
     already proven to work on this project's real 24/7 loops:

       "One digest line minimum per tick, even if 'no findings' — silence is indistinguishable from a dead session."

     This is the convergence mechanism for every SOFT loop, and it is deliberately not a request to concede.
     Asking a model to declare itself finished fails, because models are trained to be helpful and will invent
     work rather than admit there is none. Asking it to FILE A REPORT — including an empty one — is something
     models do reliably. The loop then counts empty reports; three in a row and it parks itself. */
  const DIGEST_RULE =
    'End every single pass with one line in exactly this form:\n' +
    '  DIGEST: <n> findings — <one sentence on what you did, or "nothing new">\n' +
    'File it even when n is 0. An honest "DIGEST: 0 findings" is a correct and valued answer — it is how this ' +
    'loop knows it is finished. Never invent work to avoid reporting zero.';

  const CATALOG = [
    {
      id: 'build-test-verify',
      name: 'Build · Test · Verify',
      emoji: '⊹',
      tagline: 'Work until the project\'s own check passes',
      blurb: 'Each pass makes a change, then the station runs YOUR check command and reads the real exit code. ' +
        'A red check is fed straight back into the next pass with its output. The loop ends when the check ' +
        'genuinely passes — and it can prove the tests were not edited to get there.',
      shape: ['MAKE A CHANGE', 'RUN YOUR CHECK', 'GREEN → REVIEW'],
      rigor: 'hard',
      needsProject: true,
      params: [
        { key: 'goal', label: 'What should it get working?', placeholder: 'make the failing auth tests pass without changing the API', required: true },
        { key: 'check', label: 'The command you run to check it', placeholder: 'npm test', required: true, default: 'npm test' }
      ],
      objective:
        'Work in this project until its check passes.\n\nGOAL: {goal}\n\n' +
        'The station runs the check itself after every pass and tells you the real result — you do not run it, ' +
        'and you cannot see or change the command. Work in SMALL steps: one coherent change per pass, then stop ' +
        'and let the check speak. If the check comes back red you will be given its output; fix that before ' +
        'anything else.',
      check: '{check}',
      exitOn: 'check-green',
      gate: 'review',
      queueCap: 2,
      redStopAfter: 10
    },
    {
      id: 'sweep-and-fix',
      name: 'Sweep & Fix',
      emoji: '⌗',
      tagline: 'Hunt one class of problem until there are none left',
      blurb: 'Each pass finds ONE instance, fixes it, and reports. Small, reviewable changes rather than a ' +
        'giant sweep you cannot read. Ends when three passes in a row come back empty.',
      shape: ['FIND ONE', 'FIX IT', 'REPORT'],
      rigor: 'soft',
      needsProject: true,
      params: [
        { key: 'hunting', label: 'What is it hunting?', placeholder: 'unhandled promise rejections', required: true },
        { key: 'where', label: 'Where should it look?', placeholder: 'the src/ folder', required: false, default: 'the whole project' }
      ],
      objective:
        'Sweep this project for one specific class of problem and fix them one at a time.\n\n' +
        'HUNTING: {hunting}\nSCOPE: {where}\n\n' +
        'Each pass: find ONE real instance, fix that one, and stop. Do not batch a dozen fixes into a single ' +
        'pass — small changes are reviewable, large ones are not. If you cannot find a real instance, say so ' +
        'rather than stretching the definition to keep busy.\n\n' + DIGEST_RULE,
      check: null,
      exitOn: 'empty-digests',
      gate: 'review',
      queueCap: 3,
      dryStopAfter: 3
    },
    {
      id: 'research',
      name: 'Research Loop',
      emoji: '◈',
      tagline: 'Dig into a question until it stops yielding',
      blurb: 'Each pass gathers new material on one question, skipping everything already covered, and writes ' +
        'up what is genuinely new. Ends when three passes in a row turn up nothing new.',
      shape: ['GATHER', 'GO DEEPER', 'WRITE IT UP'],
      rigor: 'soft',
      needsProject: false,
      params: [
        { key: 'question', label: 'What are you trying to find out?', placeholder: 'how are competitors pricing AI agent products?', required: true },
        { key: 'angle', label: 'Anything to focus on or avoid?', placeholder: 'focus on self-serve pricing; skip enterprise', required: false, default: 'no particular constraint' }
      ],
      objective:
        'Research one question, going deeper each pass.\n\nQUESTION: {question}\nFOCUS: {angle}\n\n' +
        'Each pass must add something GENUINELY NEW — a source, an angle, or a contradiction you had not ' +
        'already recorded. Do not restate earlier findings in fresh words; the ledger above already has them. ' +
        'Say plainly when a line of enquiry is exhausted.\n\n' + DIGEST_RULE,
      check: null,
      exitOn: 'empty-digests',
      gate: 'review',
      queueCap: 3,
      dryStopAfter: 3
    }
  ];

  const FROZEN = CATALOG.map(t => Object.freeze(Object.assign({}, t, {
    params: Object.freeze((t.params || []).map(p => Object.freeze(Object.assign({ required: true, default: '' }, p)))),
    shape: Object.freeze((t.shape || []).slice())
  })));

  function list() { return FROZEN.slice(); }
  function get(id) { return FROZEN.find(t => t.id === id) || null; }

  /* fillTokens — substitute {key} from `values`, falling back to a param default. An unfilled token whose
     param is optional AND has no default resolves to empty and the surrounding literal's trailing space is
     trimmed, so the prompt never reads "SCOPE:  \n". A token with no matching param is left verbatim rather
     than silently deleted — an authoring mistake should be visible, not swallowed. */
  function fillTokens(str, values, params) {
    values = values || {};
    const byKey = {};
    for (const p of (params || [])) byKey[p.key] = p;
    return String(str == null ? '' : str).replace(/\{(\w+)\}/g, (m, key) => {
      if (!Object.prototype.hasOwnProperty.call(byKey, key) && values[key] === undefined) return m;
      const raw = values[key];
      const v = (raw == null || String(raw).trim() === '') ? ((byKey[key] && byKey[key].default) || '') : String(raw);
      return v;
    }).replace(/[ \t]+\n/g, '\n');
  }

  function requiredMissing(id, values) {
    const t = typeof id === 'string' ? get(id) : id;
    if (!t) return [];
    values = values || {};
    return t.params.filter(p => p.required && String(values[p.key] == null ? '' : values[p.key]).trim() === '').map(p => p.key);
  }

  /* rigorNote — the honest sentence about how this loop ends. The UI shows it next to the template, because
     "runs until the tests pass" and "runs until it stops finding things" are different promises and a
     beginner has no way to tell them apart from the name alone. */
  function rigorNote(t) {
    t = typeof t === 'string' ? get(t) : t;
    if (!t) return '';
    return t.rigor === 'hard'
      ? 'Ends on a real result: the station runs your check and reads its exit code. It will not call itself finished on a check it cannot verify.'
      : 'Ends on the agent\'s own report: three passes in a row finding nothing new. That is a convention, not a proof — read what it produced before trusting it.';
  }

  /* buildSpec — the POST /api/loops body for this template + the Commander's answers. Everything the loop
     needs is decided HERE, once, at creation: the objective text, the check command, the exit condition and
     the guard rails. Nothing about the loop's sha
```

### Core Architecture Module: `frontend/app/queststate.js`
```
/* STARNET — queststate.js : the PURE durable-quest-memory engine behind the quest log.

   quests.js projects the CURRENT truth (open/done) and is deliberately stateless; this engine gives that
   projection a PAST. It folds successive projections into a small durable record:
     • firstSeenAt / completedAt per quest id — when a quest entered the log and when it REALLY finished
       (the future TROPHY CASE reads completedAt, so it is recorded from day one).
     • dismissal — the Commander waved a quest off. Dismissed = STOP FOREVER (the anti-nag law, same as
       curiosity questions): it never re-renders and never re-fires, even if the underlying thing later
       completes. Only suggestion-class quests are dismissible (dossier "get to know you" asks); milestones
       are achievements — an achievement can't nag, so it can't be dismissed.
     • completion detection = a STATUS DIFF between projections: a quest last seen open that is now done
       has genuinely completed (the real thing happened), and that edge is worth exactly one celebration.
       A quest FIRST seen already done is backfilled (completedAt recorded); whether it ALSO celebrates
       turns on ONE discriminator — was the whole state fresh (seen empty) before this fold?
         · FRESH state (first ever sync): backfill SILENTLY. Resuming a save / a first boot must not fire a
           celebration storm for old history (and a brand-new quest kind that ships already-earned lands here).
         · EXISTING state: a quest that appears already-done is a completion the Commander earned WHILE AWAY
           (an open→done edge we never got to observe live) — celebrate it exactly once. The persistent notify
           record is its receipt; an away completion must never vanish unseen.

   THE LAW (inherited from xp.js): quests never mint XP. A completion pays out sound + toast + flourish
   (the store's job) — leveling stays locked to user feedback on real built work.

   PURE + node-testable (mirrors quests.js): no Date.now / Math.random — the caller injects the clock. */
'use strict';
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.QuestState = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function fresh() { return { v: 1, seen: {}, dismissed: {} }; }

  // defensively rebuild a persisted slice: every entry re-validated, junk dropped (never a crash on a bad save).
  function hydrate(raw) {
    const s = fresh();
    if (!raw || typeof raw !== 'object') return s;
    const seen = (raw.seen && typeof raw.seen === 'object') ? raw.seen : {};
    for (const id of Object.keys(seen)) {
      const r = seen[id];
      if (!id || !r || typeof r !== 'object') continue;
      const first = Number(r.firstSeenAt);
      if (!Number.isFinite(first)) continue;
      // null/undefined must round-trip as null — Number(null) is 0 (finite!), which would resurrect a
      // never-completed quest as "completed at epoch" (a 1969 trophy). Guard the null case before coercing,
      // mirroring stationquests.js's hydrate. A stored 0 from the pre-fix bug window ALSO reads as null here:
      // the trophy case then renders it "completed, date unknown" rather than 1969 (the migration choice —
      // an honest completion with no knowable date beats a fabricated one).
      const comp = (r.completedAt == null || r.completedAt === 0) ? NaN : Number(r.completedAt);
      s.seen[id] = {
        firstSeenAt: first,
        completedAt: Number.isFinite(comp) ? comp : null,
        lastStatus: r.lastStatus === 'done' ? 'done' : 'open'
      };
    }
    const dis = (raw.dismissed && typeof raw.dismissed === 'object') ? raw.dismissed : {};
    for (const id of Object.keys(dis)) {
      const t = Number(dis[id]);
      if (id && Number.isFinite(t)) s.dismissed[id] = t;
    }
    return s;
  }

  // which quests QuestState MAY wave off (GB-24 — dismiss everywhere). QuestState is the denylist for every
  // kind that has NO external per-store denylist of its own: the dossier "get to know you" asks, milestone
  // achievements, and the station-arc rows all fall to it. The kinds EXCLUDED here are excluded on purpose:
  //   • station-gap / work / maintenance / ledger own their OWN durable denylist (their store's dismiss) — the
  //     panel routes those there, never here, so a double-denylist can't disagree.
  //   • idea — its cadence is owned by SuggestStore in COMMS; dismissing it here would fight that store's budget.
  //   • arc-goal / arc-step — a coupled, persisted GOAL PATH (retires only on real drift), not a standalone nag,
  //     and it carries no dismiss affordance; waving off one step would fracture the chain.
  function dismissible(q) {
    if (!q || !q.kind) return false;
    switch (q.kind) {
      case 'station-gap': case 'work': case 'maintenance': case 'ledger': return false;
      case 'idea': case 'arc-goal': case 'arc-step': return false;
      default: return true;   // dossier, milestone, station — QuestState is their permanent denylist
    }
  }

  // fold ONE projection into the state (in place, like Dossier.upsert). Returns the quests that made an
  // open→done transition THIS fold — the celebratable completions. A quest already done when first seen
  // backfills completedAt; it ALSO celebrates iff the state pre-existed (an away completion we never saw),
  // and stays silent iff the state was fresh (first-boot history must not storm — see the header note).
  function fold(state, quests, now) {
    const completions = [];
    if (!state || !state.seen) return { state, completions };
    // the D3 discriminator, sampled ONCE before the loop: a truly-fresh state (no prior seen entries) is a
    // first sync — its already-done quests are old history and backfill silently. A pre-existing state that
    // now shows a first-seen-done quest is an AWAY completion (open→done we never got to observe) → celebrate.
    const wasFresh = Object.keys(state.seen).length === 0;
    const arr = Array.isArray(quests) ? quests : [];
    for (const q of arr) {
      if (!q || !q.id) continue;
      if (state.dismissed[q.id] != null) continue;   // dismissed = stop forever: no tracking, no celebration
      const status = q.status === 'done' ? 'done' : 'open';
      const rec = state.seen[q.id];
      if (!rec) {
        state.seen[q.id] = { firstSeenAt: now, completedAt: status === 'done' ? now : null, lastStatus: status };
        // first-seen-already-done on an EXISTING state = a completion the Commander earned while away — the
        // fold never saw the open→done edge, but it IS a completion (the notify record is the receipt).
        if (status === 'done' && !wasFresh) completions.push(q);
        continue;
      }
      if (rec.lastStatus !== 'done' && status === 'done') { rec.completedAt = now; completions.push(q); }
      rec.lastStatus = status;   // done→open regressions (e.g. a forgotten belief) keep the LAST completedAt; a later re-completion is a genuinely new edge and celebrates again
    }
    return { state, completions };
  }

  // wave a quest off forever. Returns true only when the dismissal actually took (dismissible kind).
  function dismiss(state, quest, now) {
    if (!state || !state.dismissed || !quest || !quest.id || !dismissible(quest)) return false;
    if (state.dismissed[quest.id] != null) return false;   // already gone — idempotent
    state.dismissed[quest.id] = now;
    return true;
  }

  const isDismissed = (state, id) => !!(state && state.dismissed && id && state.dismissed[id] != null);

  // the render filter: a dismissed quest NEVER re-renders.
  function visible(state, quests) {
    const arr = Array.isArray(quests) ? quests : [];
    if (!state || !state.dismissed) return arr;
    return arr.filter(q => q && q.id && state.dismissed[q.id] == null);
  }

  // the per-quest durable record (or null): { firstSeenAt, completedAt, lastStatus, dismissedAt }.
  function stateOf(state, id) {
    if (!state || !id) return null;
    const rec = state.seen && state.seen[id];
    const dismissedAt = (state.dismissed && state.dismissed[id] != null) ? state.dismissed[id] : null;
    if (!rec && dismissedAt == null) return null;
    return {
      firstSeenAt: rec ? rec.firstSeenAt : null,
      completedAt: rec ? rec.completedAt : null,
      lastStatus: rec ? rec.lastStatus : null,
      dismissedAt: dismissedAt
    };
  }

  return { fresh, hydrate, fold, dismiss, dismissible, isDismissed, visible, stateOf };
});

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #32** (2026-09-23): **[Bug]: "thinking.type.disabled" not supported for Claude Opus 5.5 (persists on v0.12.4)**
  *Symptoms*: ### StarNet version  0.12.4  ### Platform  Windows  ### Reproduction steps  1. Set an agent's model to Claude Opus 5.5 (claude-opus-5-5) 2. Send it a simple message with no other context, e.g. "pwd" 3. Run fails immediately with:  anthropic http 400 - "thinking.type.disabled" is not supported for this model. Use "thinking.type.adaptive" and "output_config.effort" to control thinking behavior.  This happens on a fresh, isolated run with no prior context. Confirmed on v0.12.3, and persists identically after updating to v0.12.4 (full reinstall via Update Center, confirmed new version and source commit hash before retesting).  It looks like the harness is sending Claude Opus 5.5 an outdated "thinking.type.disabled" parameter that this model no longer supports, instead of the newer "thinking.type.adaptive" + "output_config.effort" format the error message itself points to.  ### Expected behavior  The agent should execute the command normally on Claude Opus 5.5, or StarNet should send a thinking-mode parameter this model actually supports (e.g. "thinking.type.adaptive" with "output_config.effort") instead of the deprecated "thinking.type.disabled" value.  ### Sanitized diagnostics  --- StarNet diagnostics --- App version:   0.12.4 Harness:       v0.12.4 Node:          v22.23.2 Platform:      win32 (x64) Mode:          desktop Provider:      anthropic Model:         claude-opus-5-5 Credential:    configured Proxy:         none configured Agents:        9 Uptime:        4m 14s Worksp
  **Post-Mortem & Fix Analysis**:
  > **Update: found the root cause and a workaround.**  Root cause: `claude-opus-5-5` isn't in the `ALWAYS_THINKING_CLAUDE` list in `sidecar/providers/anthropic.js`. So when reasoning effort is set to OFF, StarNet sends `thinking: {type: "disabled"}`, which Opus 5.5 rejects.  Workaround: changing the model's reasoning effort from OFF to LOW in the model picker fixed it. The agent runs normally now.  Suggested fix: add Opus 5.x (and likely newer model families) to `ALWAYS_THINKING_CLAUDE` so OFF isn't offered for those models.

- **Issue #31** (2026-09-23): **[Bug]: Silent startup freeze, fixed only by running as administrator (WebView2 Manager spins, no window ever appears)**
  *Symptoms*: ### StarNet version  0.12.4  ### Platform  Windows  ### Reproduction steps  What happened in order:   StarNet had been working normally for about a week.  During one launch, the built in updater applied an update from 0.11.2 to 0.12.4 (visible in startup.log as a webview cache purge tied to that version change).  From that point on, launches began failing. The bundled sidecar (node.exe) kept exiting within seconds of starting, with exit codes 73 and 1, and once a very large code (1073807364). The built in watchdog kept retrying with increasing delay, gave up after 6 attempts in a window, and the app showed "StarNet could not start its local engine."  Repeated launch attempts led to a growing pile of orphaned node.exe sidecar processes needing cleanup on each new launch, at one point 7 at once, and at times two copies of skynet desktop.exe appeared to start within the same second.  A full uninstall through Windows Settings, Apps, followed by reinstalling the latest official installer, did not fix it.   Same symptom: WebView2 Manager climbing past 2GB memory with zero window ever rendering, while the node sidecar sat idle at 0%.  Renaming the EBWebView cache folder under AppData Local ai.skynet.harness, to force a rebuild, also did not fix it.  Confirmed with Windows key plus Tab and Alt plus Tab that no window was hidden or offscreen. Nothing was rendering at all.  Right clicking the shortcut and choosing "Run as administrator" launched it cleanly on the first attempt. Setting

- **Issue #24** (2026-09-30): **[Bug]: BYOK OpenRouter works for direct agent calls but delegated runs fail “Out of managed credit”**
  *Symptoms*: ### StarNet version  0.12.4  ### Platform  Windows  ### Reproduction steps  Environment  StarNet desktop v0.12.4 Harness v0.12.4 Windows x64 Node v22.23.2 Provider: OpenRouter Credential: configured  Problem  OpenRouter BYOK works correctly for a direct COMMS request, but delegated/crew runs immediately fail with:  Out of managed credit — add credits in the STORE to keep running (or connect your own provider key).  My StarNet managed-credit balance is $0.00, but I have a funded OpenRouter account and a configured OpenRouter API key.  What I've verified  OpenRouter is selected as the active provider. Direct requests successfully reach OpenRouter. OpenRouter's activity page records the requests, token usage, and charges. StarNet diagnostics report:  Provider: openrouter Credential: configured  All specialist agents were changed from individually pinned models to Follow station default. A minimal test asking the lead agent to delegate a tiny text-only task to one specialist still fails instantly (0s) with the managed-credit error. The failed delegated run produces no new OpenRouter request, suggesting it is being blocked before the BYOK provider call. Update Center reports v0.12.4 is up to date.  Expected behavior  A delegated agent using the station default OpenRouter/BYOK configuration should run against my OpenRouter account even when StarNet managed credits are $0.  Actual behavior  Delegated runs appear to hit a StarNet managed-credit preflight check and terminate before Op
  **Post-Mortem & Fix Analysis**:
  > Additional reproduction: I also tested Media Studio directly from the lead agent, explicitly disabling delegation and requesting one image through the active OpenRouter/BYOK configuration. This also fails immediately at 0s with the same “Out of managed credit” error. This suggests the managed-credit preflight occurs before either task delegation or Media Studio/tool execution, rather than being specific to delegated specialist agents.
  > found it, thanks for the super detailed report, the "0s and nothing in openrouter activity" bit was the key clue.  it wasn't the credit check itself, it was the app sending the wrong provider. when you open a session with an agent, the app writes that agent's pinned model/provider into the station-wide setting every run uses. your specialists were summoned while the station was on starnet credits, so they got pinned to starnet. when you switched them to "follow station default", the pin got cleared on the agent but the station setting kept the old starnet value, so runs from that session (delegation, media studio, everything) still went out as starnet and got refused against the $0 balance before openrouter was ever called. the same stale value also leaked into routines/channel runs and your save.  fixed on trunk: "station default" now always means the overseer's own model + provider, so unpinning an agent (or opening a session with an unpinned one) snaps back to openrouter right away.
  > 0.12.5 is out with the fix for this. unpinned agents now follow the station default (the overseers provider) everywhere, chat, workflow lines, run a sample and channels, and switching provider in settings moves the station default with it. if a specialist still says out of managed credit after updating, open its dossier, pick follow station default and hit save model once. closing, reopen if it still happens

- **Issue #18** (2026-09-27): **[Bug]: Cannot rate interactive replies in a conversation containing scheduled routine activity**
  *Symptoms*: ### StarNet version  StarNet app 0.11.2, harness v0.11.2, commit 69baf91a5b2c22230f87e614da6a72882278bc6c  ### Platform  Windows  ### Reproduction steps  Open a conversation containing a result from a scheduled routine, continue chatting with the agent through normal interactive messages, then try to rate one of those new replies.  The rating fails with ‘This task is not in the saved run history, so it cannot be rated.’ This happened repeatedly on subsequent interactive replies.  ### Expected behavior  Interactive replies with saved run records should remain eligible for rating, even when the conversation originated from or contains scheduled routine activity. Rating eligibility should be determined from the individual reply’s run record, not the conversation’s origin. If a reply is intentionally ineligible, the message should explain that restriction accurately rather than state that the task is missing from saved run history.  If a rating cannot be submitted, the message should explain why and provide an actionable next step, such as retrying or reporting the issue with a non-sensitive diagnostic reference. If no user action can resolve it, the message should say so clearly.   ### Sanitized diagnostics  StarNet app 0.11.2, harness v0.11.2; rating interactive replies in a conversation containing scheduled work repeatedly displays ‘This task is not in the saved run history, so it cannot be rated’; no rating-specific log was available from the live diagnostic snapshot, and the
  **Post-Mortem & Fix Analysis**:
  > Looks like this one is already fixed on `feat/harness-backend` — flagging it so this can be closed rather than worked on.  The durable bug register already tracks it, and the record points back here:  - `qa/bugs/09f0e9fa-interactive-replies-in-scheduled-conversations-c.md` — `status: fixed`, `fix: da0658486`, `origin: customer`, and `report:` set to this issue - `fix: rate interactive replies by their saved run origin` (`da0658486`, 2026-09-16) — changes `sidecar/index.js`, `sidecar/runstore.js` and `frontend/app/xpstore.js`, and extends `test/growth-rating-upgrade.e2e.test.js` - `git` says that commit is already an ancestor of `feat/harness-backend` (969 ahead / 0 behind), so it is in the branch, not just on a side branch  The cause recorded there matches the diagnosis in this report: `handleGrowthRatings` and `withRunTruth` were applying `contextpack.isInternalStream` to every run, including new interactive continuations, because the durable row never kept the host-selected surface. 
  > fixed and shipped in v0.12.4 (da0658486), thanks @wippa-studios for flagging it. ratings now look up each reply by the run that actually produced it, so interactive replies in a conversation that also has scheduled routine results rate fine. update to 0.12.4 and you're good. closing

- **Issue #17** (2026-09-27): **[Bug]: Main agent: complex overuse of information**
  *Symptoms*: ### StarNet version  v0.11.2  ### Platform  Windows  ### Reproduction steps  Operating system: I7 Core  Ram: 64 GB Graphics: Intel Iris Xe  I've woke my main agent with the [LLM Ollama](llama3.2:3b) and have given it the instructions to do market research at 7:00 am, and to repeat away work (research) every 6 hours. There is a current goal loop to do market research. When I attempt speaking to my main agent in the comms, like a simple "hello," it takes 2 1/2 minutes to respond, then takes 10 minutes typing out a large technical response.    ### Expected behavior  How do I generate simple, speedy small talk with the main agent? Beyond that, my goal is to give my main agent an instant, simple brain (ollama), a normal interaction brain (Claude 'Haiku'), and a difficult reasoning brain (Claude 'Sonnet'). Is it possible to optimize my agent to be powerful for the right reasons, and cheap, if not - free when possible?   Furthermore, how do I assign llama3.2:3b to worker agents and avoid the complex overuse of information problem again?   ### Sanitized diagnostics  _No response_
  **Post-Mortem & Fix Analysis**:
  > @tylersneed2000-coder   I am learning the Starnet UI at the moment myself, so take my advice with a grain of salt please... Having a main agent is great for interaction between you and the system, but when your main agent's context becomes too long, then tokenization efficiency may be reduced. Your "Main Agent" should be the one you work hands on with (From my experience).  Creating a "sub-agent" that performs the work at the request of your main agent is more optimal. (Think CEO hands the daily work requirements over to the employee). This Agent UI system works fundamentally as a company so you need to treat it as such. (Again from my experience)   Also, keep in mind: You are still very limited by your hardware with the spec's you gave. Using Ollama is great for localization, but context flow isn't optimized for local context transcription (Context loops your hardware needs to send back and forth to communicate) when it comes to a third party UI. Ollama is itself a UI, so essentially 
  > > [@tylersneed2000-coder](https://github.com/tylersneed2000-coder) >  > I am learning the Starnet UI at the moment myself, so take my advice with a grain of salt please... Having a main agent is great for interaction between you and the system, but when your main agent's context becomes too long, then tokenization efficiency may be reduced. Your "Main Agent" should be the one you work hands on with (From my experience). Creating a "sub-agent" that performs the work at the request of your main agent is more optimal. (Think CEO hands the daily work requirements over to the employee). This Agent UI system works fundamentally as a company so you need to treat it as such. (Again from my experience) >  > Also, keep in mind: You are still very limited by your hardware with the spec's you gave. Using Ollama is great for localization, but context flow isn't optimized for local context transcription (Context loops your hardware needs to send back and forth to communicate) when it comes to a thir
  > @tylersneed2000-coder   I was on here reporting my own bug when I seen your reply, so I'm glad my response was helpful. Keep in mind I am a user myself, not the developer. That may be obvious but with how you worded your reply I wanted to make sure there was no confusion there.  Based on what you said this would be my recommendation: In Starnet, click "System"-"Field Manual". That will be a good start. You can also ask your agent about things directly. Your agent has some configuration context built in so it can help more than you'd think.  Other than that, I really can't help explain much more since there is a vast amount of situational scenarios that I am not qualified to speak on.... I apologize.   Good luck with things though! I hope ya get it all figured out... Its been a journey for myself figuring the whole ai thing out as well! 

- **Issue #13** (2026-09-11): **[Bug]: Delegated agent cannot access MCP connector tools available in live session**
  *Symptoms*: ### StarNet version  v0.11.1  ### Platform  Windows  ### Reproduction steps  1. Connect Close CRM through ABILITIES → DISCOVER using the official Close OAuth integration. 2. Grant Maintain Access, Read Data through MCP, and Write Safe Operations through MCP. 3. Create two agents: Michael (orchestrator) and Victor (specialist operator). 4. In a direct live session with Victor, ask Victor to access Close CRM and retrieve a test lead. 5. Victor successfully accesses the Close MCP tools and reads the lead. 6. Victor can also successfully perform safe write operations to Close in the direct live session. 7. In a live session with Michael, ask Michael to delegate the same Close CRM lookup to Victor. 8. Michael successfully delegates the task to Victor, but Victor's delegated run cannot access the Close MCP tools. 9. Victor reports that Close is configured, connected, enabled and OAuth authenticated at station level, but no callable Close CRM MCP tools are available inside the delegated run. Direct Victor → Close read/write: WORKS Michael → Victor delegation: WORKS Michael → delegated Victor → Close MCP: DOES NOT WORK The delegated run also attempted a browser fallback, but Close required authentication and the unattended delegated run could not perform interactive login. Question: Is this expected permission behaviour for delegated runs, or should an operator invoked through team delegation retain access to its connected MCP tools?  ### Expected behavior  When Michael delegates a t

- **Issue #12** (2026-09-11): **[Bug]: Cross-provider fallback keeps Codex provider when switching to OpenRouter model**
  *Symptoms*: ### StarNet version  0.11.0 — source commit 58dc520de6db835c0cf917908ee9e6a5501cba81  ### Platform  Windows  ### Reproduction steps  1. Configure a Codex/ChatGPT model as the active/primary model. 2. Configure an OpenRouter-backed model, in my case z-ai/glm-5.3-flash, as a fallback. 3. Run the primary model until its usage/quota limit is reached and StarNet attempts automatic fallback. 4. StarNet selects z-ai/glm-5.3-flash as the fallback model, but does not switch the provider from Codex to OpenRouter. 5. The request is then sent through the Codex provider and fails with:  codex http 400 — {"detail":"The 'z-ai/glm-5.3-flash' model is not supported when using Codex with a ChatGPT account."}  This is reproducible across multiple runs.  Manually switching the active chat/model to GLM works correctly, so the OpenRouter credential and GLM model itself are functional. The problem appears specific to automatic cross-provider fallback.  ### Expected behavior  When automatic fallback selects a model that is configured through a different provider, StarNet should switch both the model and the provider/credential route.  In this case, when falling back from a Codex/ChatGPT model to z-ai/glm-5.3-flash, the resulting state should use the OpenRouter provider rather than retaining Codex.  The fallback request should then continue normally using the configured OpenRouter credential.  ### Sanitized diagnostics  --- StarNet diagnostics --- App version:   0.11.0 Harness:       v0.11.0 Node:   

- **Issue #6** (2026-09-30): **[Bug]: Stuck on agent resume screen**
  *Symptoms*: ### StarNet version  0.10.9  ### Platform  Windows  ### Reproduction steps  I am stuck on the resume screen (add credits), i pick a custom provider but no matter what i choose... when i click resume. it just continues to ask me to add credits as seen in the image/link below  <img width="1832" height="1013" alt="Image" src="https://github.com/user-attachments/assets/6b07bceb-daf1-41fd-8089-35a400c4ba1a" />  ### Expected behavior  it should accept my chosen provider key and resume.  ### Sanitized diagnostics  _No response_
  **Post-Mortem & Fix Analysis**:
  > thanks for the report — found it and fixed it. the bug: once your station is linked to a starnet account, the sidecar was checking your starnet credit balance before EVERY wake, even when you picked your own provider key (your gemini key pays google directly, so it should never have looked at the starnet wallet). with $0 credits that check refused the wake and looped you back to the add-credits screen no matter what provider you chose.  the fix is merged and ships in the next release (after 0.10.12).  **workaround until then:** unlink your starnet account (SYSTEM > SETTINGS, or just don't link one), then wake with your gemini key — it'll go through. relinking after the update is fine, byok keys won't touch the credit gate anymore.
  > Thank you! I was having the same problem!
  > Also I am addicted to this! Thank you!

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

### Incident Patch 1: `a5f29a5d` (2026-10-04)
**Commit Message**: docs(release): v0.13.1 notes — group chat, spend/provider/delegation sections, fact-check fixes

**File**: `RELEASE_NOTES.md` (modified, +15/-6)
```diff
@@ -1,6 +1,6 @@
 # StarNet v0.13.1
 
-A repair update: web requests work again, group chats save and show who is in them, COMMS reads like a conversation, crew no longer freeze in the halls, each floor OUTBOX shows only its own line's work, and schedules let you pick who they run as.
+A repair update: web requests work again, group chats save and show who is in them, COMMS reads like a conversation, crew no longer freeze in the halls, each floor OUTBOX shows only its own line's work, schedules let you pick who they run as, and spending limits hold during retries.
 
 ## Fixed
 
@@ -11,7 +11,16 @@ A repair update: web requests work again, group chats save and show who is in th
 
 ### Group chats
 
-- TODO: group chat fixes (pending merge of the group chat repair).
+- **Adding an agent saves at once.** + ADD and REMOVE now save the moment you press them. Before, an add was only staged until a save key that could sit below the window's edge, so minimizing StarNet lost it. IN THIS CHAT lists only members the station has confirmed.
+- **@ works in every chat.** Type @ in any chat to pick an agent from a menu over the message box (arrow keys, Enter or Tab to pick, Esc to close, @all in a group). Picking an agent who is not in the chat adds them first: a direct chat becomes a group, and from General a new group opens beside it.
+- **Names with spaces.** "@RESEARCHER 2" now reaches RESEARCHER 2, not RESEARCHER. A crew agent outside the chat is named as "not in this chat yet", and an unknown @name tells you how to send it as plain text.
+- **You can tell it is a group.** Group rows carry a [GROUP] tag, the COMMS header leads with [ GROUP ] and lists the members in their colour (past two lines, the rest fold into +N), and the transcript speaks the same conversation style as COMMS.
+- **Groups you are not viewing still reach you.** Replies, questions and approvals in another group now show on its row (Working, Reply needed, Approval needed) and mark it unread. Before, an approval there could go unseen until it was automatically denied after 5 minutes.
+- **A steadier transcript.** Text you select stays selected while agents reply, every message has a copy key, and back-to-back replies from different agents each show their name.
+- **Pauses are explicit.** A paused group shows one CONTINUE, a reply the pause stopped is named under its message with a RETRY, and sending to a paused group no longer starts work queued before the pause ahead of your message.
+- **Approvals fit.** Approval keys sit on the first line of their row and rows that need you sort first, so ALLOW ONCE and DENY are no longer clipped in a short window.
+- **A group survives crew changes.** Deleting an agent that sat in a group no longer breaks the group: it leaves the group, @all and plain messages go to the members still on the crew, and if it led the group the lead passes on.
+- **Turning a chat into a group** no longer fails on one oversized or missing attachment; the readable files are shared and the message names the one that was not.
 
 ### COMMS readability
 
@@ -42,10 +51,10 @@ A repair update: web requests work again, group chats save and show who is in th
 
 ### Spending, providers & delegation
 
-- **Spending limits hold during retries.** A run now checks its per-run limit and the station's spending caps before every retry and recovery attempt, not only between turns, so retrying can no longer carry a run past a limit.
-- **Quest refresh respects spending caps.** Refreshing quests by hand is skipped, with the reason, when a spending cap has been reached.
-- **OpenRouter key check is real.** Checking OpenRouter now tests your current key against OpenRouter itself; before, a reachable model list alone could report it as working.
-- **Delegated work can be verified.** A lead asked to confirm work it dispatched can now look the run up, instead of concluding the worker never ran. The worker's Dossier RECORD tab shows that run up front as "delegated by" its lead.
+- **Spending limits hold during retries.** A run now checks its per-run limit and the station's spending caps before every retry and recovery attempt, not only between turns, so a run stops retrying once a limit is reached.
+- **Quest refresh respects spending caps.** Quest refresh, automatic or by hand, no longer calls a provider once a spending cap is reached; the Quests panel marks the cycle skipped.
+- **Provider status tells the truth about keys.** In Settings, OpenRouter now tests your saved key against OpenRouter itself and can show VERIFIED. A custom endpoint whose model list is public no longer shows VERIFIED for a key it never tested.
+- **Delegated work can be verified.** A lead asked to confirm work it dispatched can now look up the finished run, instead of concluding the worker never ran. The worker's Dossier RECORD tab shows that run up front as "delegated by" its lead.
 
 ## Known issues
 
```

---

### Incident Patch 2: `6b70b2a9` (2026-10-04)
**Commit Message**: qa(claims): re-lock the release surface after the group chat review fixes

**File**: `qa/product-perfect/claims.json` (modified, +9/-9)
```diff
@@ -18,7 +18,7 @@
   "expectedClaimCount": 37,
   "releaseSurface": {
     "algorithm": "sha256",
-    "sourceCommit": "b4f3b258582dc4b16124cbc53d3e72a947d8db49",
+    "sourceCommit": "2f29ee92669bf222992c503892d5357a154bbd25",
     "pathSetSha256": "fac5552f81f0dd00ab64856cfdfc9f107fcb0517a3ef0449f4018b13e983e609",
     "files": [
       {
@@ -173,8 +173,8 @@
       },
       {
         "path": "frontend/app/app.js",
-        "bytes": 424805,
-        "sha256": "c2d92cfc0ae4bb68c55cbe8fa37537dff55e79a9d022761c9061380896e501c8"
+        "bytes": 424873,
+        "sha256": "cfdc5bedae2b6923d470aafa820f1350f00c5eab58d3c84e797db445baba17e5"
       },
       {
         "path": "frontend/app/approved-sheet-effects.js",
@@ -338,8 +338,8 @@
       },
       {
         "path": "frontend/app/chat.js",
-        "bytes": 716320,
-        "sha256": "bdfd41cdfdf49c64a6bd23919f8d4221533090ba961ca1d111daafef7781da3c"
+        "bytes": 716435,
+        "sha256": "fdb44e9f6f4081f5a02a2e893f329ec87795f9cba62ccb08c871bd47fb77790e"
       },
       {
         "path": "frontend/app/chatresize.js",
@@ -543,8 +543,8 @@
       },
       {
         "path": "frontend/app/group-chat.js",
-        "bytes": 66517,
-        "sha256": "20b12ca9aa77a983d5f3e2f6da8bdd9385c6230e5c186751537881c16c4a5320"
+        "bytes": 68643,
+        "sha256": "472b83adc131697a1661d024af0fd0cc44a8fa6e5b6ddfe067f4488d37494248"
       },
       {
         "path": "frontend/app/harness.js",
@@ -1498,8 +1498,8 @@
       },
       {
         "path": "frontend/css/app.css",
-        "bytes": 415800,
-        "sha256": "f6fe7de502fd85f0123570f2afd5e6a81903bc8bf0776be9603ac51e662a66ac"
+        "bytes": 415830,
+        "sha256": "bd02ba556d0bc53b741c626b06f467d3a1f400b3a64df780d8be3e6b5015ed55"
       },
       {
         "path": "frontend/css/asciifx.css",
```

---

### Incident Patch 3: `2f29ee92` (2026-10-04)
**Commit Message**: website: mirror the group chat review fixes (npm run sync:website)

**File**: `website/app/app/app.js` (modified, +6/-6)
```diff
@@ -4114,10 +4114,9 @@ const App = (() => {
       return groupHead + '<li class="' + rowClass(w, st, activeId) + '" data-id="' + U.esc(w.id) + '" tabindex="' + (w.id === railFocusId ? '0' : '-1') + '" role="option" aria-selected="' + (w.id === activeId ? 'true' : 'false') + '" aria-posinset="' + (index + 1) + '" aria-setsize="' + rows.length + '" aria-label="' + U.esc(railRowLabel(w, st)) + '" aria-keyshortcuts="Shift+F10" title="' + U.esc(tip) + '">' +
         '<span class="' + st.dot + '" aria-hidden="true"></span>' +
         (w.pinned ? '<span class="ws-pin" aria-hidden="true">★</span>' : '') +
-        // a group chat says so on the row itself: the COMPACT rail hides the agent line that names its members
-        (w.conversationMode === 'group' ? '<span class="ws-gc" aria-hidden="true">GROUP</span>' : '') +
         '<span class="ws-agent" aria-hidden="true"' + railAgentColorAttr(w) + '>' + U.esc(railAgentName(w)) + '</span>' +
-        '<span class="ws-title">' + U.esc(title) + '</span>' +
+        // a group chat says so on the row itself, inside the title cell so every rail layout places it (compact, attention, inbox)
+        '<span class="ws-title">' + (w.conversationMode === 'group' ? '<span class="ws-gc" aria-hidden="true">GROUP</span>' : '') + U.esc(title) + '</span>' +
         '<span class="ws-meta">' + U.esc(st.meta) + '</span>' +
         '<span class="ws-receipt" aria-hidden="true">' + U.esc(railReceipt(w)) + '</span>' +
         '<button class="ws-kebab" tabindex="-1" aria-label="session actions" title="session actions">⋯</button>' +
@@ -4318,6 +4317,8 @@ const App = (() => {
   // instead we switch to the agent's most-recent live workstream, or MINT a fresh one bound to that agentId
   // (the same Workstreams.create({agentId}) seam summon uses). switchWorkstream then repoints the focused agent
   // (its model/provider/effort) + Chat.load. Returns the target workstream id, or null for an unknown agent.
+  // a 1:1 agent pick never lands in (or rebinds) a GROUP that agent happens to lead: a group's agentId is only its lead
+  function isGroupWs(w) { return !!w && w.conversationMode === 'group'; }
   function selectAgent(agentId) {
     const id = String(agentId || '');
     const a = agents.get(id); if (!a) return null;
@@ -4327,7 +4328,7 @@ const App = (() => {
     // law above only protects conversations with content. General (the hero's home) and any stream with
     // history / runs / a live run keep their binding and fall through to the switch-or-mint path.
     const cur = Workstreams.active();
-    if (cur && cur.id !== Workstreams.generalId() && cur.conversationMode !== 'group' && (cur.agentId || 'agent') !== id
+    if (cur && cur.id !== Workstreams.generalId() && !isGroupWs(cur) && (cur.agentId || 'agent') !== id
         && !(cur.history && cur.history.length) && !(cur.runIds && cur.runIds.length)
         && !(typeof Channels !== 'undefined' && Channels.isBusy(cur.id))
         && Workstreams.setAgent(cur.id, id)) {
@@ -4339,8 +4340,7 @@ const App = (() => {
     // prefer this agent's existing streams (most-recently-active first — Workstreams.list() is already sorted
     // pinned>recent); the General default stream (title==null) is only NOVA/hero's home, so a specialist that
     // has no stream yet gets a fresh one titled with its name (mirrors summon's Workstreams.create).
-    // a 1:1 pick never lands in a GROUP that agent happens to lead (a group's agentId is only its lead)
-    const mine = Workstreams.list().filter(w => (w.agentId || 'agent') === id && w.conversationMode !== 'group');
+    const mine = Workstreams.list().filter(w => (w.agentId || 'agent') === id && !isGroupWs(w));
     let ws = mine[0] || null;
     if (!ws) ws = Workstreams.create(a.name, { agentId: id, activate: false });
     if (!ws) return null;
```

**File**: `website/app/app/chat.js` (modified, +1/-0)
```diff
@@ -1053,6 +1053,7 @@ const Chat = (() => {
       const ws = g && Workstreams.get(g.id);
       if (!ws || activeWs?.id !== ws.id) return;
       if (hasStaged) await settleAttachments();
+      if (activeWs?.id !== ws.id) return;   // you moved on while the files uploaded: the message stays in the box
       const atts = pendingAtts.filter(entry => entry.status === 'ready' && entry.ref).map(entry => entry.ref);
       const sent = await GroupChat.sendText(t, { attachments: atts, attachmentAgent: ws.agentId });
       if (sent && activeWs?.id === ws.id) { takeAttachments(); if (input.value.trim() === t) input.value = ''; closeSlash(); autoGrowInput(); }
```

**File**: `website/app/app/group-chat.js` (modified, +35/-14)
```diff
@@ -145,7 +145,9 @@ const GroupChat = (() => {
       body #chat-panel #gc-log>.gc-message.cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable)+.gc-message.cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable):not(.gc-cont){margin-top:6px}
       body #chat-panel #gc-log>.gc-message.cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable)+.gc-message.cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable):not(.gc-cont)>.cmsg-head{display:flex;justify-content:flex-start;margin:0 2px 4px}
       body #chat-panel #gc-log>.gc-message.cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable)+.gc-message.cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable):not(.gc-cont)>.cmsg-head>.who{display:inline-block}
-      #gc-log>.gc-masthead{flex:0 0 auto}#gc-log .gc-masthead .bc-name{margin:0 2px}#gc-log .gc-masthead .gc-how{text-transform:none;letter-spacing:.4px;opacity:.75}
+      #gc-log>.gc-masthead{flex:0 0 auto}#gc-log .gc-masthead .bc-name{margin:0 2px}
+      body #chat-panel #gc-log .cmsg.broadcast.gc-masthead .bc-line.gc-how{text-transform:none;letter-spacing:.4px;opacity:.75}
+      body #chat-panel #gc-log .gc-message.agent .who.gc-who:is(:hover,:focus-visible){color:var(--ph-bright);text-shadow:0 0 5px var(--ph-glow)}
       .gc-message.draft .body{opacity:.85}.gc-message.draft .body::after{content:'▌';color:var(--ph);animation:1s steps(1) infinite comms-blink}
       .gc-message .gc-partial{display:block;margin-top:4px;font-size:12px;letter-spacing:.5px;color:var(--gold)}
       #gc-recipients:not(:empty){padding:4px 12px;font-size:12px;letter-spacing:.8px;text-transform:uppercase;color:var(--ph-dim);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
@@ -191,7 +193,7 @@ const GroupChat = (() => {
       .gc-picker-footer{flex:0 0 auto;position:sticky;bottom:0;display:flex;align-items:center;gap:8px;padding:10px 0 0;border-top:1px solid var(--ph-faint);background:var(--panel)}.gc-picker-footer .gc-delta{flex:1 1 auto;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:var(--ph-dim)}
       .gc-picker-footer .gc-delta.ok{color:var(--ph)}.gc-picker-footer .bb.primary{color:var(--ph-bright);border-color:var(--ph-dim)}
     `; document.head.append(css);
-    discover().catch(showError);
+    discover().catch(e => { notice = e.message || String(e); });   // quiet: nobody asked yet (and the website embed has no sidecar)
     watch();
   }
   /* A group you are not looking at still owes you its news: replies land, questions wait, approvals expire in 5 minutes.
@@ -508,6 +510,8 @@ const GroupChat = (() => {
     if (!origin) throw new Error('Open a chat first');
     if (origin.conversationMode === 'group') throw new Error('This chat is already a group');
     const lead = origin.agentId || 'agent', general = isGeneral(origin);
+    // the words in THIS chat's box, taken now: if you switch chats while it is created, the box holds another chat's words
+    const box = $('chat-input'), draft = box && active?.id === origin.id ? box.value : (composerDrafts.get(origin.id) || '');
     const members = [lead, ...ids.filter(id => id !== lead)];
     if (!general && typeof Chat !== 'undefined' && Chat.isBusy && active?.id === origin.id && Chat.isBusy()) throw new Error(name(lead) + ' is still working in this chat. Let the run finish (or stop it), then add agents.');
     if (typeof App !== 'undefined' && App.pushRoster) await App.pushRoster();   // the backend must know every agent it seats
@@ -516,10 +520,12 @@ const GroupChat = (() => {
     const g = await api(general ? { op: 'create', id, members, leadId: lead, title }
       : { op: 'create', id, conversionKey: origin.id, history: origin.history, originalAgentId: lead, members, leadId: lead, title });
     adopt(g); save();
-    // the words in the message box travel with the conversation (General's box is left empty: they moved)
-    const input = $('chat-input'), draft = input ? input.value : '';
-    composerDrafts.set(g.id, draft); if (general) composerDrafts.set(origin.id, '');
+    const still = !active || active.id === origin.id;
+    // the words in the message box travel with the conversation — what is in it NOW if you stayed (you may have kept
+    // typing), the snapshot if you left (the box holds another chat's words). General's box is left empty: they moved.
+    composerDrafts.set(g.id, still && box ? box.value : draft); if (general) composerDrafts.set(origin.id, '');
     if (pickerFor === origin.id) pickerFor = g.id;
+    if (!still) return g;   // you moved on while it was created: it waits in the rail, you are not pulled back
     active = null;   // a same-id conversion must rebind COMMS (bind returns early for the session it already shows)
     if (typeof App !== 'undefined' && App.openWorkstream) App.openWorkstream(g.id);
     if (typeof Chat !== 'undefined' && Chat.load) Chat.load(Works
```

**File**: `website/app/css/app.css` (modified, +4/-5)
```diff
@@ -631,7 +631,7 @@ body.no-curve #stage-wrap::before { background: none; box-shadow: none; }
    drag-select never smears button captions / speaker chips / timestamps into the copied prose. */
 #chat-log { user-select: text; }
 #chat-log .cmsg .body { cursor: text; }
-#chat-log button, #chat-log .who, #chat-log .cmsg-ts { user-select: none; }
+:is(#chat-log, #gc-log) :is(button, .who, .cmsg-ts, .tb-when) { user-select: none; }
 
 /* COPY — a hover-revealed ⧉ button at the top-right of an agent MESSAGE row (CSS keeps it off the work-log
    beats, which aren't prose). Flashes to ✓ on a successful copy. Touch/keyboard-focus reveal it too. */
@@ -3191,12 +3191,11 @@ body.rows-inbox #workstreams .ws-kebab { grid-area: meta; }
 .ws-arch-row.on { color: var(--ph); }
 /* pinned rows sort to the top AND carry a small gold star so the "kept" state is legible at a glance */
 .ws-pin { flex: 0 0 auto; font-size: 10px; line-height: 1; color: var(--gold); text-shadow: 0 0 6px rgba(var(--gold-rgb),.5); }
-/* a GROUP chat row says so before its title: the COMPACT row hides the agent line that names its members.
-   The INBOX row (a grid) already names every member on that line, so the tag stays out of its grid. */
-.ws-gc { flex: 0 0 auto; font-size: 10px; line-height: 1; letter-spacing: 1px; color: var(--ph); white-space: nowrap; text-shadow: var(--pg-glow-soft, none); }
+/* a GROUP chat row says so before its title. It lives INSIDE .ws-title, so the compact flex row, the attention grid and
+   the INBOX grid all place it with the title (a sibling span had no grid cell and was auto-placed onto the badge). */
+.ws-gc { display: inline-block; margin-right: 6px; vertical-align: 1px; font-size: 10px; line-height: 1; letter-spacing: 1px; color: var(--ph); white-space: nowrap; text-shadow: var(--pg-glow-soft, none); }
 .ws-gc::before { content: '['; margin-right: 2px; opacity: .6; }
 .ws-gc::after { content: ']'; margin-left: 2px; opacity: .6; }
-body.rows-inbox #workstreams .ws-gc { display: none; }
 /* the ⋯ button is the discoverable twin of right-click: hidden until the row is hovered, where it takes the meta slot */
 .ws-kebab {
   display: none; flex: 0 0 auto; font-family: inherit; font-size: 15px; line-height: 1; letter-spacing: 1px;
```

---

### Incident Patch 4: `645ba3dd` (2026-10-04)
**Commit Message**: fix(group chat): close the gaps an adversarial review of this branch found

A read-only review of f245a03cd..HEAD (8 agents, every finding re-verified) confirmed 17; all fixed:
- selectAgent grew past test/agent-model-select's source-lock windows (fast gate red at 535/1053): the group check is
  a one-line helper above it now, the rationale moved with it.
- @ resolution: the backend reads the LONGEST name across the whole crew ("@SCOUT 2" with only SCOUT here is
  refused as not-in-chat, never sent to SCOUT; a longer name beats a bare id token), the @ menu never writes a
  one-word handle another crew name extends (it writes the id), and a direct chat's typed handle resolves the same way.
- A departed member's open question closed only on configure: invite now retires their turns and questions too
  (one retire() for both), and REMOVE works when the picker names a lead that has left the crew.
- Two Enters during one conversion made two groups (General): one conversion per chat is in flight at a time.
- Leaving a chat while it became a group pulled you back and carried the other chat's words; you stay where you are,
  the group waits in the rail, and the box text is the right chat's

**File**: `frontend/app/app.js` (modified, +6/-6)
```diff
@@ -4114,10 +4114,9 @@ const App = (() => {
       return groupHead + '<li class="' + rowClass(w, st, activeId) + '" data-id="' + U.esc(w.id) + '" tabindex="' + (w.id === railFocusId ? '0' : '-1') + '" role="option" aria-selected="' + (w.id === activeId ? 'true' : 'false') + '" aria-posinset="' + (index + 1) + '" aria-setsize="' + rows.length + '" aria-label="' + U.esc(railRowLabel(w, st)) + '" aria-keyshortcuts="Shift+F10" title="' + U.esc(tip) + '">' +
         '<span class="' + st.dot + '" aria-hidden="true"></span>' +
         (w.pinned ? '<span class="ws-pin" aria-hidden="true">★</span>' : '') +
-        // a group chat says so on the row itself: the COMPACT rail hides the agent line that names its members
-        (w.conversationMode === 'group' ? '<span class="ws-gc" aria-hidden="true">GROUP</span>' : '') +
         '<span class="ws-agent" aria-hidden="true"' + railAgentColorAttr(w) + '>' + U.esc(railAgentName(w)) + '</span>' +
-        '<span class="ws-title">' + U.esc(title) + '</span>' +
+        // a group chat says so on the row itself, inside the title cell so every rail layout places it (compact, attention, inbox)
+        '<span class="ws-title">' + (w.conversationMode === 'group' ? '<span class="ws-gc" aria-hidden="true">GROUP</span>' : '') + U.esc(title) + '</span>' +
         '<span class="ws-meta">' + U.esc(st.meta) + '</span>' +
         '<span class="ws-receipt" aria-hidden="true">' + U.esc(railReceipt(w)) + '</span>' +
         '<button class="ws-kebab" tabindex="-1" aria-label="session actions" title="session actions">⋯</button>' +
@@ -4318,6 +4317,8 @@ const App = (() => {
   // instead we switch to the agent's most-recent live workstream, or MINT a fresh one bound to that agentId
   // (the same Workstreams.create({agentId}) seam summon uses). switchWorkstream then repoints the focused agent
   // (its model/provider/effort) + Chat.load. Returns the target workstream id, or null for an unknown agent.
+  // a 1:1 agent pick never lands in (or rebinds) a GROUP that agent happens to lead: a group's agentId is only its lead
+  function isGroupWs(w) { return !!w && w.conversationMode === 'group'; }
   function selectAgent(agentId) {
     const id = String(agentId || '');
     const a = agents.get(id); if (!a) return null;
@@ -4327,7 +4328,7 @@ const App = (() => {
     // law above only protects conversations with content. General (the hero's home) and any stream with
     // history / runs / a live run keep their binding and fall through to the switch-or-mint path.
     const cur = Workstreams.active();
-    if (cur && cur.id !== Workstreams.generalId() && cur.conversationMode !== 'group' && (cur.agentId || 'agent') !== id
+    if (cur && cur.id !== Workstreams.generalId() && !isGroupWs(cur) && (cur.agentId || 'agent') !== id
         && !(cur.history && cur.history.length) && !(cur.runIds && cur.runIds.length)
         && !(typeof Channels !== 'undefined' && Channels.isBusy(cur.id))
         && Workstreams.setAgent(cur.id, id)) {
@@ -4339,8 +4340,7 @@ const App = (() => {
     // prefer this agent's existing streams (most-recently-active first — Workstreams.list() is already sorted
     // pinned>recent); the General default stream (title==null) is only NOVA/hero's home, so a specialist that
     // has no stream yet gets a fresh one titled with its name (mirrors summon's Workstreams.create).
-    // a 1:1 pick never lands in a GROUP that agent happens to lead (a group's agentId is only its lead)
-    const mine = Workstreams.list().filter(w => (w.agentId || 'agent') === id && w.conversationMode !== 'group');
+    const mine = Workstreams.list().filter(w => (w.agentId || 'agent') === id && !isGroupWs(w));
     let ws = mine[0] || null;
     if (!ws) ws = Workstreams.create(a.name, { agentId: id, activate: false });
     if (!ws) return null;
```

**File**: `frontend/app/chat.js` (modified, +1/-0)
```diff
@@ -1053,6 +1053,7 @@ const Chat = (() => {
       const ws = g && Workstreams.get(g.id);
       if (!ws || activeWs?.id !== ws.id) return;
       if (hasStaged) await settleAttachments();
+      if (activeWs?.id !== ws.id) return;   // you moved on while the files uploaded: the message stays in the box
       const atts = pendingAtts.filter(entry => entry.status === 'ready' && entry.ref).map(entry => entry.ref);
       const sent = await GroupChat.sendText(t, { attachments: atts, attachmentAgent: ws.agentId });
       if (sent && activeWs?.id === ws.id) { takeAttachments(); if (input.value.trim() === t) input.value = ''; closeSlash(); autoGrowInput(); }
```

**File**: `frontend/app/group-chat.js` (modified, +35/-14)
```diff
@@ -145,7 +145,9 @@ const GroupChat = (() => {
       body #chat-panel #gc-log>.gc-message.cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable)+.gc-message.cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable):not(.gc-cont){margin-top:6px}
       body #chat-panel #gc-log>.gc-message.cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable)+.gc-message.cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable):not(.gc-cont)>.cmsg-head{display:flex;justify-content:flex-start;margin:0 2px 4px}
       body #chat-panel #gc-log>.gc-message.cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable)+.gc-message.cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable):not(.gc-cont)>.cmsg-head>.who{display:inline-block}
-      #gc-log>.gc-masthead{flex:0 0 auto}#gc-log .gc-masthead .bc-name{margin:0 2px}#gc-log .gc-masthead .gc-how{text-transform:none;letter-spacing:.4px;opacity:.75}
+      #gc-log>.gc-masthead{flex:0 0 auto}#gc-log .gc-masthead .bc-name{margin:0 2px}
+      body #chat-panel #gc-log .cmsg.broadcast.gc-masthead .bc-line.gc-how{text-transform:none;letter-spacing:.4px;opacity:.75}
+      body #chat-panel #gc-log .gc-message.agent .who.gc-who:is(:hover,:focus-visible){color:var(--ph-bright);text-shadow:0 0 5px var(--ph-glow)}
       .gc-message.draft .body{opacity:.85}.gc-message.draft .body::after{content:'▌';color:var(--ph);animation:1s steps(1) infinite comms-blink}
       .gc-message .gc-partial{display:block;margin-top:4px;font-size:12px;letter-spacing:.5px;color:var(--gold)}
       #gc-recipients:not(:empty){padding:4px 12px;font-size:12px;letter-spacing:.8px;text-transform:uppercase;color:var(--ph-dim);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
@@ -191,7 +193,7 @@ const GroupChat = (() => {
       .gc-picker-footer{flex:0 0 auto;position:sticky;bottom:0;display:flex;align-items:center;gap:8px;padding:10px 0 0;border-top:1px solid var(--ph-faint);background:var(--panel)}.gc-picker-footer .gc-delta{flex:1 1 auto;font-size:12px;letter-spacing:1px;text-transform:uppercase;color:var(--ph-dim)}
       .gc-picker-footer .gc-delta.ok{color:var(--ph)}.gc-picker-footer .bb.primary{color:var(--ph-bright);border-color:var(--ph-dim)}
     `; document.head.append(css);
-    discover().catch(showError);
+    discover().catch(e => { notice = e.message || String(e); });   // quiet: nobody asked yet (and the website embed has no sidecar)
     watch();
   }
   /* A group you are not looking at still owes you its news: replies land, questions wait, approvals expire in 5 minutes.
@@ -508,6 +510,8 @@ const GroupChat = (() => {
     if (!origin) throw new Error('Open a chat first');
     if (origin.conversationMode === 'group') throw new Error('This chat is already a group');
     const lead = origin.agentId || 'agent', general = isGeneral(origin);
+    // the words in THIS chat's box, taken now: if you switch chats while it is created, the box holds another chat's words
+    const box = $('chat-input'), draft = box && active?.id === origin.id ? box.value : (composerDrafts.get(origin.id) || '');
     const members = [lead, ...ids.filter(id => id !== lead)];
     if (!general && typeof Chat !== 'undefined' && Chat.isBusy && active?.id === origin.id && Chat.isBusy()) throw new Error(name(lead) + ' is still working in this chat. Let the run finish (or stop it), then add agents.');
     if (typeof App !== 'undefined' && App.pushRoster) await App.pushRoster();   // the backend must know every agent it seats
@@ -516,10 +520,12 @@ const GroupChat = (() => {
     const g = await api(general ? { op: 'create', id, members, leadId: lead, title }
       : { op: 'create', id, conversionKey: origin.id, history: origin.history, originalAgentId: lead, members, leadId: lead, title });
     adopt(g); save();
-    // the words in the message box travel with the conversation (General's box is left empty: they moved)
-    const input = $('chat-input'), draft = input ? input.value : '';
-    composerDrafts.set(g.id, draft); if (general) composerDrafts.set(origin.id, '');
+    const still = !active || active.id === origin.id;
+    // the words in the message box travel with the conversation — what is in it NOW if you stayed (you may have kept
+    // typing), the snapshot if you left (the box holds another chat's words). General's box is left empty: they moved.
+    composerDrafts.set(g.id, still && box ? box.value : draft); if (general) composerDrafts.set(origin.id, '');
     if (pickerFor === origin.id) pickerFor = g.id;
+    if (!still) return g;   // you moved on while it was created: it waits in the rail, you are not pulled back
     active = null;   // a same-id conversion must rebind COMMS (bind returns early for the session it already shows)
     if (typeof App !== 'undefined' && App.openWorkstream) App.openWorkstream(g.id);
     if (typeof Chat !== 'undefined' && Chat.load) Chat.load(Works
```

**File**: `frontend/css/app.css` (modified, +4/-5)
```diff
@@ -631,7 +631,7 @@ body.no-curve #stage-wrap::before { background: none; box-shadow: none; }
    drag-select never smears button captions / speaker chips / timestamps into the copied prose. */
 #chat-log { user-select: text; }
 #chat-log .cmsg .body { cursor: text; }
-#chat-log button, #chat-log .who, #chat-log .cmsg-ts { user-select: none; }
+:is(#chat-log, #gc-log) :is(button, .who, .cmsg-ts, .tb-when) { user-select: none; }
 
 /* COPY — a hover-revealed ⧉ button at the top-right of an agent MESSAGE row (CSS keeps it off the work-log
    beats, which aren't prose). Flashes to ✓ on a successful copy. Touch/keyboard-focus reveal it too. */
@@ -3191,12 +3191,11 @@ body.rows-inbox #workstreams .ws-kebab { grid-area: meta; }
 .ws-arch-row.on { color: var(--ph); }
 /* pinned rows sort to the top AND carry a small gold star so the "kept" state is legible at a glance */
 .ws-pin { flex: 0 0 auto; font-size: 10px; line-height: 1; color: var(--gold); text-shadow: 0 0 6px rgba(var(--gold-rgb),.5); }
-/* a GROUP chat row says so before its title: the COMPACT row hides the agent line that names its members.
-   The INBOX row (a grid) already names every member on that line, so the tag stays out of its grid. */
-.ws-gc { flex: 0 0 auto; font-size: 10px; line-height: 1; letter-spacing: 1px; color: var(--ph); white-space: nowrap; text-shadow: var(--pg-glow-soft, none); }
+/* a GROUP chat row says so before its title. It lives INSIDE .ws-title, so the compact flex row, the attention grid and
+   the INBOX grid all place it with the title (a sibling span had no grid cell and was auto-placed onto the badge). */
+.ws-gc { display: inline-block; margin-right: 6px; vertical-align: 1px; font-size: 10px; line-height: 1; letter-spacing: 1px; color: var(--ph); white-space: nowrap; text-shadow: var(--pg-glow-soft, none); }
 .ws-gc::before { content: '['; margin-right: 2px; opacity: .6; }
 .ws-gc::after { content: ']'; margin-left: 2px; opacity: .6; }
-body.rows-inbox #workstreams .ws-gc { display: none; }
 /* the ⋯ button is the discoverable twin of right-click: hidden until the row is hovered, where it takes the meta slot */
 .ws-kebab {
   display: none; flex: 0 0 auto; font-family: inherit; font-size: 15px; line-height: 1; letter-spacing: 1px;
```

**File**: `sidecar/group-sessions.js` (modified, +28/-16)
```diff
@@ -60,6 +60,17 @@ function makeGroupSessions(d) {
   function liveLead(g) { const here = liveMembers(g); return here.includes(g.leadId) ? g.leadId : here.includes('agent') ? 'agent' : here[0]; }
   // the turn the group's worker is executing right now (a live worker can be asked to stop; anything else just stops)
   const workingTurn = new Map();
+  // anyone leaving (removed, or departed from the crew): their queued work stops and their questions close — a question
+  // left open by someone who can never answer it would block the whole group (pump waits on any pending question)
+  function retire(g, staying, reason) {
+    let abort = null;
+    for (const t of g.turns) if (!staying.includes(t.agentId)) {
+      if (['queued', 'held'].includes(t.state)) { t.state = 'stopped'; t.reason = reason; }
+      if (ACTIVE.has(t.state)) { const ac = stopTurn(g, t, reason); if (ac) abort = ac; }
+    }
+    cancelQuestions(g, q => !staying.includes(q.agentId));
+    return abort;
+  }
   function stopTurn(g, t, reason) {
     if (workingTurn.get(g.id) === t.id && controllers.has(g.id)) { t.state = 'stopping'; if (reason) t.reason = reason; return controllers.get(g.id); }
     t.state = 'stopped'; t.reason = reason || 'Stopped'; delete t.approval; return null;
@@ -152,17 +163,17 @@ function makeGroupSessions(d) {
     for (const m of plain.matchAll(/(?:^|\s)@(?=[\w-])/g)) {
       const rest = plain.slice(m.index + m[0].length), h = rest.match(/^[\w-]+/)[0];
       if (h.toLowerCase() === 'all') return here.slice();
-      const named = list => {
-        const hits = list.filter(a => rest.slice(0, a.name.length).toLowerCase() === a.name.toLowerCase() && !/[\w-]/.test(rest.charAt(a.name.length)));
-        const best = Math.max(0, ...hits.map(a => a.name.length));
-        return hits.filter(a => a.name.length === best);
-      };
-      const exact = mem.filter(a => a.id === h);
-      const choices = exact.length ? exact : named(mem);
-      if (choices.length === 1) { if (!ids.includes(choices[0].id)) ids.push(choices[0].id); continue; }
-      if (choices.length > 1) fail('Unknown or ambiguous @' + h + '; choose a participant from autocomplete');
-      const outside = crew.filter(a => !here.includes(a.id) && (a.id === h || named([a]).length));
+      // the longest NAME on the whole crew that the text starts with — so "@SCOUT 2" is SCOUT 2 even when only SCOUT
+      // sits in this chat (then it is refused as "not in this chat", never sent to SCOUT)
+      const hits = crew.filter(a => rest.slice(0, a.name.length).toLowerCase() === a.name.toLowerCase() && !/[\w-]/.test(rest.charAt(a.name.length)));
+      const best = Math.max(0, ...hits.map(a => a.name.length)), longest = hits.filter(a => a.name.length === best);
+      const exact = best > h.length ? [] : mem.filter(a => a.id === h);   // a longer name beats a bare id token
+      const inChat = exact.length ? exact : longest.filter(a => here.includes(a.id));
+      if (inChat.length === 1) { if (!ids.includes(inChat[0].id)) ids.push(inChat[0].id); continue; }
+      if (inChat.length > 1) fail('Unknown or ambiguous @' + h + '; choose a participant from autocomplete');
+      const outside = longest.length ? longest : crew.filter(a => a.id === h);
       if (outside.length === 1) fail(outside[0].name + ' is not in this chat yet. Add them from the @ list, then send.');
+      if (outside.length > 1) fail('Unknown or ambiguous @' + h + '; choose a participant from autocomplete');
       fail('Unknown @' + h + ': no one in this chat has that name. Pick an agent from the @ list, or wrap it in `backticks` to send it as text.');
     }
     if (ids.length) return ids;
@@ -214,11 +225,14 @@ function makeGroupSessions(d) {
   async function invite(id, b) {
     await ready;
     const agentId = identifier(b.agentId);
+    let abort = null;
     await update(id, g => {
       if (g.deleting) fail('Session is being deleted', 409);
       g.members = admit(g.members, [...new Set([...g.members, agentId])]);
+      abort = retire(g, g.members, 'Left the crew');
       if (!g.members.includes(g.leadId)) g.leadId = liveLead(g);
     });
+    if (abort) abort.abort();
     return publicGroup(get(id));
   }
   async function ask(id, turnId, fields, signal) {
@@ -282,13 +296,11 @@ function makeGroupSessions(d) {
       if (b.revision !== g.revision) fail('Session changed; refresh and try again', 409);
       const ids = admit(g.members, b.members || g.members);
       // an explicit lead must stay; a lead that LEFT (removed here, or deleted from the crew) hands over to who remains
-      const lead = b.leadId ? b.leadId : ids.includes(g.leadId) ? g.leadId : ids.includes('agent') ? 'agent' : ids[0];
+      // a lead that has LEFT the crew can't be honoured even when named (the picker names the lead it last saw)
+      const onCrew = new Set(roster().map(a => a.id)), named = b.leadId && onCrew.has(b.leadId) ? b.leadId : null;
+      const lead = named || (ids.includes(g.leadId
```

**File**: `test/group-chat-picker.test.js` (modified, +26/-2)
```diff
@@ -27,7 +27,7 @@ const deferred = () => { let resolve; const promise = new Promise(r => { resolve
 const roster = [{ id: 'agent', name: 'Lead' }, { id: 'peer', name: 'Peer' }, { id: 'third', name: 'Third' }];
 const ok = result => ({ status: 200, ok: true, json: async () => ({ ok: true, result }) });
 const success = () => ok({ roster, groups: [] });
-async function boot({ general = false } = {}) {
+async function boot({ general = false, crew = roster } = {}) {
   const body = new Element('body'); body.attached = true;
   const head = new Element('head'); head.attached = true;
   for (const id of ['comms-idbar', 'chat-input', 'chat-log', 'chat-queued', 'chat-inputrow']) { const e = new Element('div'); e.id = id; body.append(e); }
@@ -37,7 +37,7 @@ async function boot({ general = false } = {}) {
   const document = { body, head, createElement: tag => new Element(tag), createTextNode: t => Object.assign(new Element('#text'), { textContent: t }), getElementById: find };
   const ctx = vm.createContext({ document, console, crypto: { randomUUID: () => 'test' }, clearTimeout() {}, setTimeout() {}, queueMicrotask, Chat: {},
     fetch: (url, init) => { const b = init && init.body ? JSON.parse(init.body) : null; sent.push({ url, body: b }); return request(url, b); },
-    App: { pushRoster: () => push(), agents: () => roster, persist() {}, refreshRail() {}, openWorkstream: id => opened.push(id) },
+    App: { pushRoster: () => push(), agents: () => crew, persist() {}, refreshRail() {}, openWorkstream: id => opened.push(id) },
     StationUI: { toggleTerm(key, title, build, opts) { opens++; const shell = new Element('div'); shell.id = 'test-window'; body.append(shell); build(shell); onClose = opts.onClose; }, closeTerm() { onClose?.(); find('test-window')?.remove(); }, notify() {} },
     Workstreams: { get: id => workstreams.get(id), adopt: o => { const w = { ...o }; workstreams.set(o.id, w); return w; }, generalId: () => general ? 'direct' : 'general-home' } });
   vm.runInContext(source + '\nglobalThis.GroupChat = GroupChat;\nGroupChat.bind({id:"direct",agentId:"agent",history:[{role:"user",content:"hi"}],title:"Direct"});', ctx);
@@ -166,5 +166,29 @@ const group = (members, extra = {}) => ({ id: 'direct', title: 'Direct', members
   assert.deepEqual(T('`@peer` and\n> @third quoted'), [], 'code and quotes are not mentions');
   assert.deepEqual(T('@nobody hi'), [], 'an unknown handle is left alone');
   assert.deepEqual(T('@peer', { id: 'g', agentId: 'agent', conversationMode: 'group' }), [], 'a group resolves its own mentions on the backend');
+  // ---- a stale @ menu (the box was sent/cleared) closes and gives the key back: Esc must reach the run's interrupt ----
+  await at.type('ping @pe'); assert.ok(at.find('gc-mentions').children.length > 0);
+  at.find('chat-input').value = '';   // what a SEND-chip send leaves behind
+  assert.equal((await at.key('Escape')).handled, false, 'Esc on a stale menu falls through to the composer (interrupt)');
+  assert.equal(at.find('gc-mentions').children.length, 0, 'and the stale menu is gone');
+
+  // ---- "@SCOUT" is never written when another name extends it ("@SCOUT " + "2 more" would read as SCOUT 2) ----
+  const scouts = await boot({ crew: [{ id: 'agent', name: 'Lead' }, { id: 'scout', name: 'SCOUT' }, { id: 'scout-2', name: 'SCOUT 2' }] });
+  scouts.request((url, b) => Promise.resolve(!b ? success() : ok(group(b.members))));
+  await scouts.type('@scout');
+  const scoutRow = walk(scouts.find('gc-mentions')).find(e => e.attrs.role === 'option' && /^\s*SCOUT\s/.test(text(e)) && !/SCOUT 2/.test(text(e)));
+  assert.ok(scoutRow, 'SCOUT is offered'); scoutRow.events.click(); await settle();
+  assert.equal(scouts.find('chat-input').value, '@scout ', 'the stable id is written, not a name another name extends');
+  const S = t => [...scouts.ctx.GroupChat.mentionTargets(t, { id: 'x', agentId: 'agent' })];
+  assert.deepEqual(S('@SCOUT 2 more ideas'), ['scout-2'], 'a typed handle resolves to the LONGEST crew name, as the backend will');
+  assert.deepEqual(S('@SCOUT, then'), ['scout'], 'the shorter name still resolves on its own');
+
+  // ---- two Enters during one conversion make ONE group ----
+  const twice = await boot({ general: true });
+  let creates = 0; const gate = deferred();
+  twice.request((url, b) => { if (!b) return Promise.resolve(success()); if (b.op === 'create') { creates++; return gate.promise.then(() => ok({ ...group(b.members), id: b.id })); } throw new Error('unexpected ' + b.op); });
+  const one = twice.ctx.GroupChat.startWith(['peer']), two = twice.ctx.GroupChat.startWith(['peer']);
+  gate.resolve(); const [g1, g2] = await Promise.all([one, two]);
+  assert.equal(creates, 1, 'a second Enter joins the conversion in flight'); assert.equal(g1, g2);
   console.log('group-chat-picker: loading, failure, cancellation, + ADD/✕ REMOVE save at once, nothing claimed before the backend, General never converted, @ menu in a direct chat with keyboard pick,
```

**File**: `test/group-sessions.repair.test.js` (modified, +30/-0)
```diff
@@ -38,6 +38,12 @@ async function waitFor(fn) { for (let n = 0; n < 200; n++) { if (await fn()) ret
     await api.send(g.id, { key: 'code', text: 'install `@types/node` please' }); await api.idle(g.id);
     assert.equal(seen.at(-1).t.agentId, 'agent', 'a backticked @word is text and the lead answers');
 
+    // ---- the longest name is read across the whole CREW: "@RESEARCHER 2" with only RESEARCHER here is refused, not misrouted ----
+    const onlyOne = await api.create({ members: ['agent', 'researcher'] });
+    await assert.rejects(api.send(onlyOne.id, { key: 'r2out', text: '@RESEARCHER 2 look at this' }), /RESEARCHER 2 is not in this chat yet/);
+    assert.equal((await api.get(onlyOne.id)).messages.length, 0, 'nothing was sent to RESEARCHER');
+    await api.send(onlyOne.id, { key: 'r2case', text: '@researcher 2 is fine' }).catch(e => assert.match(e.message, /RESEARCHER 2 is not in this chat/));
+
     // ---- a member who LEFT the crew no longer breaks the group ----
     crew = crew.filter(a => a.id !== 'agent');   // the lead is gone from the roster (no dropAgent yet: the worst case)
     const before = seen.length;
@@ -113,6 +119,30 @@ async function waitFor(fn) { for (let n = 0; n < 200; n++) { if (await fn()) ret
     await api.send(f.id, { key: 'm3', text: '@engineer here it is', artifactIds: [orphan] }); await api.idle(f.id);
     assert.match(seen.at(-1).ctx.messages[0].content, /secret\.pdf/, 'once a message carries it, it is shared');
 
+    // ---- a departed member's open question closes when the membership is next written (it blocked the group for good) ----
+    const qq = await api.create({ members: ['agent', 'engineer', 'outside'] });
+    execute = async o => { if (o.t.agentId === 'engineer') await o.askCommander({ question: 'Which tone?', options: ['casual'] }); return finish('ok'); };
+    await api.send(qq.id, { key: 'ask2', text: '@engineer draft it' });
+    await waitFor(async () => ((await api.get(qq.id)).questions || []).some(x => x.state === 'pending'));
+    const crewBefore = crew; crew = crew.filter(a => a.id !== 'engineer');
+    await api.invite(qq.id, { agentId: 'researcher-2' }); await api.idle(qq.id);
+    let qqs = await api.get(qq.id);
+    assert.ok(!qqs.members.includes('engineer'), 'the departed member left on the next write');
+    assert.ok(!(qqs.questions || []).some(x => x.state === 'pending'), 'their question no longer blocks the group');
+    const blockedBefore = seen.length;
+    await api.send(qq.id, { key: 'after-q', text: '@outside are you there' }); await api.idle(qq.id);
+    assert.equal(seen.length, blockedBefore + 1, 'the group runs again');
+    // ---- REMOVE works when the picker names a lead that has left the crew ----
+    crew = crewBefore;
+    const led = await api.create({ members: ['engineer', 'outside', 'researcher-2'], leadId: 'engineer' });
+    crew = crew.filter(a => a.id !== 'engineer');
+    const ls = await api.get(led.id);
+    const removed = await api.configure(led.id, { revision: ls.revision, members: ['engineer', 'researcher-2'], leadId: 'engineer' });
+    assert.deepEqual(removed.members, ['researcher-2'], 'REMOVE saved (the departed lead quietly left)');
+    assert.equal(removed.leadId, 'researcher-2', 'the lead handed over to who remains');
+    await assert.rejects(api.configure(led.id, { revision: removed.revision, members: ['researcher-2'], leadId: 'outside' }), /lead who remains/, 'a live lead outside the chat is still refused');
+    crew = crewBefore;
+
     // ---- the station-wide list says what is waiting on the Commander ----
     const listed = (await api.list()).groups.find(x => x.id === q.id);
     for (const k of ['updatedAt', 'approvals', 'questions', 'busy', 'paused']) assert.ok(k in listed, 'list carries ' + k);
```

---

### Incident Patch 5: `9f27d001` (2026-10-04)
**Commit Message**: merge: trunk into the 0.13.1 release lane (spend-cap + dispatch issue fixes)

**File**: `frontend/app/windows/logbook.js` (modified, +7/-3)
```diff
@@ -24,7 +24,7 @@
     // #lb-insights) so a mid-fetch agent switch can't write into a sibling's list.
     const secLogbook =
       '<div class="sec"><span class="sec-l">RUNS</span><span class="sec-r"></span><span class="sec-nd"></span></div>' +
-      '<p class="sk-note">Real work by <b>' + esc(nm) + '</b>, newest first — runs that used tools, produced files, or failed. Chat-only replies are folded at the bottom.</p>' +
+      '<p class="sk-note">Real work by <b>' + esc(nm) + '</b>, newest first — runs that used tools, produced files, were delegated by another agent, or failed. Chat-only replies are folded at the bottom.</p>' +
       '<div id="lb-list" class="mc-list"><span class="loading pulse">loading…</span></div>' +
       '<div class="sec"><span class="sec-l">RUN ISSUES</span><span class="sec-r"></span><span class="sec-nd"></span></div>' +
       '<p class="sk-note">Review why a run ended without a result and what to try next.</p>' +
@@ -49,8 +49,10 @@
       // explicit ▸ toggle button for the transcript (keyboard-reachable), plus the whole row stays clickable —
       // but the row handler ignores clicks made while selecting text (so you can copy a title without collapsing).
       const txBtn = sid ? ' <button type="button" class="lb-tx-btn" aria-expanded="false" title="show / hide this run\'s transcript">▸ transcript</button>' : '';
+      // a delegated run names its lead and runId, so it can be matched to the runId the lead's team.dispatch reported.
+      const delegated = r.delegatedBy ? ' · ↳ delegated by ' + esc(r.delegatedBy) + ' · run ' + esc(String(r.runId || '').slice(0, 8)) : '';
       return '<div class="' + cls + '"' + attr + '><div class="mc-top"><b>' + title + '</b> <span class="dim">' + when + '</span>' + txBtn + '</div>' +
-        '<div class="mc-url dim">' + rl + ' · ' + model + ' · ' + (r.turns || 0) + ' turn' + (r.turns === 1 ? '' : 's') + '</div>' +
+        '<div class="mc-url dim">' + rl + ' · ' + model + ' · ' + (r.turns || 0) + ' turn' + (r.turns === 1 ? '' : 's') + delegated + '</div>' +
         (sid ? '<div class="lb-tx" hidden></div>' : '') + '</div>';
     }
     function insightsHtml(j) {
@@ -90,7 +92,9 @@
         // rows that bury the record that matters (away/cron runs, failures, real work). A row is CHATTER when the
         // run ended fine with ZERO successful tool calls and ZERO artifacts — provable from the row's own recorded
         // fields (toolsOk / artifacts), never a guess. Chatter folds behind an honest count; work renders up front.
-        const isChat = r => r.reason === 'done' && !(r.toolsOk > 0) && !(r.artifacts && r.artifacts.length);
+        // A DELEGATED run (delegatedBy: another agent's team.dispatch started it) is never chatter, even with no tools:
+        // it is assigned work, and folding it made a real dispatch look like it never reached this agent (#57).
+        const isChat = r => r.reason === 'done' && !r.delegatedBy && !(r.toolsOk > 0) && !(r.artifacts && r.artifacts.length);
         const work = runs.filter(r => !isChat(r));
         const chatter = runs.filter(isChat);
         const foldLabel = open => (open ? '▾ ' : '▸ ') + chatter.length + ' CHAT-ONLY ' + (chatter.length === 1 ? 'REPLY' : 'REPLIES') + ' — no tools, no files';
```

**File**: `qa/product-perfect/claims.json` (modified, +3/-3)
```diff
@@ -18,7 +18,7 @@
   "expectedClaimCount": 37,
   "releaseSurface": {
     "algorithm": "sha256",
-    "sourceCommit": "7be288d14168d71c4381ede742b1d35e2f2208b3",
+    "sourceCommit": "cd3920185bda8f32aa86914540a84e00ad03dc7e",
     "pathSetSha256": "fac5552f81f0dd00ab64856cfdfc9f107fcb0517a3ef0449f4018b13e983e609",
     "files": [
       {
@@ -1328,8 +1328,8 @@
       },
       {
         "path": "frontend/app/windows/logbook.js",
-        "bytes": 12636,
-        "sha256": "3281e8bdad42ea6b7a19388ae30d9c6b21712260ff1a018e77c2c4b39a49d4f3"
+        "bytes": 13198,
+        "sha256": "9d8b27bea140c1b918c5a07d9ce3047f2bd3955e345ed5baf6a0ae3fe561a436"
       },
       {
         "path": "frontend/app/windows/loops.js",
```

**File**: `sidecar/index.js` (modified, +39/-3)
```diff
@@ -8986,6 +8986,19 @@ async function runQuestRefreshCycle(why) {
       questRefreshNote({ outcome: 'skipped', reason: 'not enough is known yet (empty dossier, no goal, no activity) — the refresh waits for the station to learn more' });
       return;
     }
+    // Standalone auxiliary calls bypass runAgentLoop, so enforce its cross-run spending boundary here too.
+    // A manual refresh changes the cadence, not the spending authority; only an explicit budget resume does.
+    if (!((getProviderProfile(providerId) || {}).unmetered)) {
+      let blocked;
+      try { blocked = budget.check(null, 'station', 0, Date.now(), null); }
+      catch (_) { blocked = { unknown: true }; }
+      if (blocked) {
+        questRefreshNote({ outcome: 'skipped', reason: blocked.unknown
+          ? 'spend history is unavailable — restore accounting before refreshing quests'
+          : 'spending cap reached (' + blocked.scope + ') — resume spending or raise the cap before refreshing quests' });
+        return;
+      }
+    }
     // evidence exists → NOW pay for the provider (codex token fetch is a network hop; never spend it on a cold save).
     let provider = extraAccountProviderFor(providerId, baseUrl);   // subscription stacking: first live sign-in
     if (provider) { /* an extra sign-in carries the refresh */ }
@@ -18651,6 +18664,7 @@ async function runOnceCore(o) {
   // THIS SAME runOnce per worker; the roster supplies each worker's composed identity (system prompt + model).
   makeOrchestrationTools({
     runOnce, roster: () => agentRoster, key: runKey, model, provider: providerId, baseUrl, reasoningEffort, subagents,
+    runRecord: (id) => runStore.latest(id),   // team.subagents {runId}: verify a foreground dispatch against run history (#57)
     coordinateResults: require('./overseer.js').isCoordinatorRun({ ...o, agentId, surface }),
     classes: SPECIALIST_CLASSES,   // Class Loadouts S1: the summon-tool class list, composed from the shared catalog (no hardcoded prose)
     selfSystem: system,   // team.spawn clones the LEAD's OWN base identity into each ephemeral subagent (Meeseeks)
@@ -20934,7 +20948,7 @@ async function runOnceCore(o) {
         }
       }
       const runEndedAt = Date.now();
-      runStore.record({ runId, parentRunId: o.parentRunId || '', agentId, provider: activeProviderId, reason: ((result && result.reason) || 'done'), clarifying: taskQuestionAsked, turns: finalTurns, tokens: finalTokens, usd: finalUsd, title: title, streamId: o.streamId || '', sessionTitle: o.sessionTitle || '', deliveryPrompt: o.syntheticTrigger ? '' : (o.sessionPrompt || ''), deliveryText, recipeId: o.recipeId || '', projectRoot: o.projectRoot || '', deliverable: deliverableNotes.take(runId), model: finalModel, reasoningEffort, unmetered: runUnmetered && mediaUsd === 0, artifacts: execution.artifactList(), toolsOk: execution.toolsOk(), toolTrace: execution.toolTraceList(), failureStage: execution.failureStage(), failureCode: execution.failureCode(), uncertainMutations: execution.uncertainMutations(), completionEvidence: finalCompletionEvidence, recoveryAttempts: execution.recoveryAttempts(), startedAt: runStartedAt, endedAt: runEndedAt, durationMs: runEndedAt - runStartedAt, identityFallback, internal, surface, recoveryOf: o.recovery ? String(o.recovery.sourceRunId || '') : '', handoffEdited: o.handoffEdited === true, stepTest: o.stepTest === true, lineId: o.lineId || '', dockId: o.dockId || '', cronJobId: trigger === 'schedule' ? String(o.cronJobId || '') : '', taintedBy: execution.taintedBy() || '' });   // execution terminal stays separate from the neutral Task Brief outcome used by progression; recoveryOf links a continuation to the interrupted run it resumed
+      runStore.record({ runId, parentRunId: o.parentRunId || '', delegatedBy: o.delegatedBy || '', agentId, provider: activeProviderId, reason: ((result && result.reason) || 'done'), clarifying: taskQuestionAsked, turns: finalTurns, tokens: finalTokens, usd: finalUsd, title: title, streamId: o.streamId || '', sessionTitle: o.sessionTitle || '', deliveryPrompt: o.syntheticTrigger ? '' : (o.sessionPrompt || ''), deliveryText, recipeId: o.recipeId || '', projectRoot: o.projectRoot || '', deliverable: deliverableNotes.take(runId), model: finalModel, reasoningEffort, unmetered: runUnmetered && mediaUsd === 0, artifacts: execution.artifactList(), toolsOk: execution.toolsOk(), toolTrace: execution.toolTraceList(), failureStage: execution.failureStage(), failureCode: execution.failureCode(), uncertainMutations: execution.uncertainMutations(), completionEvidence: finalCompletionEvidence, recoveryAttempts: execution.recoveryAttempts(), startedAt: runStartedAt, endedAt: runEndedAt, durationMs: runEndedAt - runStartedAt, identityFallback, internal, surface, recoveryOf: o.recovery ? String(o.recovery.sourceRunId || '') : '', handoffEdited: o.handoffEdited === true, stepTest: o.stepTest === true, lineId: o.lineId || '', dockId: o.dockId || '', cronJobId: trigg
```

**File**: `sidecar/loop.js` (modified, +26/-15)
```diff
@@ -1475,6 +1475,27 @@
     }
 
     emit('agent.run.start', { agentId, runId, trigger, model });
+    // Reconcile each attempt before enforcing the same spending limits again. Retries and
+    // post-compaction calls are paid work too, even when the turn counter does not advance.
+    function stopForSpend() {
+      if (spentUsd >= maxCostUsd) return end('budget', { budgetScope: 'run', budgetCapUsd: maxCostUsd });   // per-RUN hard ceiling
+      // per-RUN token ceiling for turns nothing could price (the $ ceiling above is blind to them — see maxUnpricedTokens)
+      if (unpricedTokens >= maxUnpricedTokens) {
+        return end('budget', { budgetScope: 'run', unpricedModel: unpricedModel || model, unpricedTokens, unpricedCapTokens: maxUnpricedTokens });
+      }
+      // CROSS-RUN BUDGET: day/global pool over the ledger. check() emits any threshold crossing itself and
+      // returns a block descriptor when a soft cap is reached (no resume headroom left) -> stop as 'budget'.
+      if (budget) {
+        const b = budget.check(spentUsd);
+        if (b && b.unknown) {
+          emit('agent.run.error', { agentId, runId, message: 'Spend history is unavailable or not durably saved. Restore the ledger and restart StarNet before continuing with spending limits.', transient: false });
+          return end('error', { failureStage: 'budget', failureCode: 'spend_history_unavailable' });
+        }
+        if (b) return end('budget', { budgetScope: b.scope, budgetCapUsd: b.cap });
+      }
+      return null;
+    }
+
     // Admission may have promoted a Commander-configured fallback because the selected primary is definitively
     // tool-less. Emit it after run.start so the UI receives a truthful, ordered lifecycle receipt even though no
     // failed provider request was needed to discover the incompatibility.
@@ -1497,21 +1518,8 @@
         // fall through: the grace turn runs below. Tools stay ON THE WIRE (see GRACE TURN NEVER DISPATCHES after
         // the stream) — but any call it emits is dropped, never executed, and the run ends max_iters.
       }
-      if (spentUsd >= maxCostUsd) return end('budget', { budgetScope: 'run', budgetCapUsd: maxCostUsd });   // per-RUN hard ceiling
-      // per-RUN token ceiling for turns nothing could price (the $ ceiling above is blind to them — see maxUnpricedTokens)
-      if (unpricedTokens >= maxUnpricedTokens) {
-        return end('budget', { budgetScope: 'run', unpricedModel: unpricedModel || model, unpricedTokens, unpricedCapTokens: maxUnpricedTokens });
-      }
-      // CROSS-RUN BUDGET: day/global pool over the ledger. check() emits any threshold crossing itself and
-      // returns a block descriptor when a soft cap is reached (no resume headroom left) -> stop as 'budget'.
-      if (budget) {
-        const b = budget.check(spentUsd);
-        if (b && b.unknown) {
-          emit('agent.run.error', { agentId, runId, message: 'Spend history is unavailable or not durably saved. Restore the ledger and restart StarNet before continuing with spending limits.', transient: false });
-          return end('error', { failureStage: 'budget', failureCode: 'spend_history_unavailable' });
-        }
-        if (b) return end('budget', { budgetScope: b.scope, budgetCapUsd: b.cap });
-      }
+      const spendStop = stopForSpend();
+      if (spendStop) return spendStop;
       // COMPUTE GATE: a model turn needs a compute capability (a computer in the room).
       if (capCtx && typeof capCtx.canRun === 'function' && !capCtx.canRun()) {
         emit('capdenied', { agentId, need: 'compute', reason: capCtx.computeReason || 'no compute capability in room' });
@@ -1582,6 +1590,9 @@
       let retrySent = false;   // this attempt re-sends the turn after a provider.retry (its first heartbeat goes out at once)
       while (true) {
         bookUsage(usage, usageModel);   // a re-entry after retry/compress/fallback: book the partial attempt BEFORE the reset
+        if (signal.aborted) return end('cancelled');
+        const attemptSpendStop = stopForSpend();
+        if (attemptSpendStop) return attemptSpendStop;
         acc.text = ''; acc.toolCalls = {}; acc.reasoning = []; streamedTextChunks = []; usage = null; lastFinishReason = null;
         usageModel = model;
         let streamErr = null;
```

**File**: `sidecar/runstore.js` (modified, +4/-0)
```diff
@@ -286,6 +286,10 @@
         // other row stays byte-identical.
         ...(ID_RE.test(str(e.lineId)) ? { lineId: str(e.lineId) } : {}),
         ...(ID_RE.test(str(e.dockId)) ? { dockId: str(e.dockId) } : {}),
+        // DELEGATION (additive, #57): the LEAD agentId whose team.dispatch/spawn/resume started this worker run. Set only by
+        // orchestration — parentRunId alone also links overseer reviews and connector continuations, which are not
+        // delegated work. Present only when set, so every other row stays byte-identical.
+        ...(ID_RE.test(str(e.delegatedBy)) ? { delegatedBy: str(e.delegatedBy) } : {}),
         toolTrace: toolTraceList(e.toolTrace),
         failureStage: str(e.failureStage).trim().slice(0, FAILURE_FIELD_MAX),
         failureCode: str(e.failureCode).trim().slice(0, FAILURE_FIELD_MAX),
```

**File**: `sidecar/tools/builtin/orchestration.js` (modified, +45/-9)
```diff
@@ -346,6 +346,10 @@
     const baseUrl = deps.baseUrl || deps.base_url || '';
     const reasoningEffort = deps.reasoningEffort || 'medium';
     const subagents = deps.subagents || null;
+    /* runRecord(runId) -> the station's durable run-history row, or null (host injects runStore.latest). It is how a
+       lead VERIFIES a foreground team.dispatch: that path never enters the background registry, so team.subagents
+       used to answer [] for real, recorded worker runs and the lead reported them as never having happened (#57). */
+    const runRecord = (typeof deps.runRecord === 'function') ? deps.runRecord : null;
     // the LEAD's OWN base identity (system prompt), threaded from the run host so team.spawn can clone it. Empty
     // string when absent → a spawned subagent still runs, just without an inherited persona.
     const selfSystem = (typeof deps.selfSystem === 'string') ? deps.selfSystem : '';
@@ -673,7 +677,7 @@
               emit: o2.emit || childEmit,      // lifecycle/cost ride the lead/global stream -> the floor lights the worker
               signal: ac ? ac.signal : parentSignal,   // own controller when this worker has a wall clock (see above)
               runId: workerRunId, trigger: 'directive', surface: 'autonomous',
-              parentRunId: ctx && ctx.runId,
+              parentRunId: ctx && ctx.runId, delegatedBy: (ctx && ctx.agentId) || '',
               // SESSION TARGETING: the run host files a run under its streamId (runStore.record + the durable
               // transcript) and scopes its working memory to that stream. Absent -> undefined, byte-identical to
               // the pre-2026-07-30 call. This is the DURABLE half; deliverToSession is the visible one.
@@ -722,7 +726,7 @@
                 { role: 'user', content: '[STRUCTURED RESULT REPAIR] The prior result failed host validation:\n- ' + errors.slice(0, 20).join('\n- ') + '\nReturn ONLY strict JSON matching: ' + JSON.stringify(job.resultSchema) }],
               agentId: job.agentId, isTask: true, emit: o2.emit || childEmit,
               signal: ac ? ac.signal : parentSignal, runId: repairRunId, trigger: 'directive', surface: 'autonomous',
-              parentRunId: ctx && ctx.runId, streamId: job.streamId || undefined,
+              parentRunId: ctx && ctx.runId, delegatedBy: (ctx && ctx.agentId) || '', streamId: job.streamId || undefined,
               sessionTitle: job.streamId ? (job.sessionTitle || job.session || '') : undefined,
               consent: ctx && ctx.consent, extraObjects: WORKER_KIT,
               maxCostUsd: perWorker > 0 ? remaining : 0,
@@ -935,7 +939,7 @@
                 agentId: ephemeralId, isTask: true,
                 emit: (n, p) => { try { h.emit(n, p); } catch (_) {} childEmit(n, p); },   // durable record + lead stream
                 signal: h.signal, runId: h.runId,
-                parentRunId: ctx && ctx.runId,
+                parentRunId: ctx && ctx.runId, delegatedBy: (ctx && ctx.agentId) || '',
                 trigger: 'directive', surface: 'autonomous',
                 consent: ctx && ctx.consent,                // same approval posture as the orchestrator
                 extraObjects: WORKER_KIT,                   // WORKBENCH only — NO 'lead' → no orchestrator object →
@@ -977,7 +981,7 @@
                   { role: 'user', content: '[STRUCTURED RESULT REPAIR] The prior result failed host validation:\n- ' + errors.slice(0, 20).join('\n- ') + '\nReturn ONLY strict JSON matching: ' + JSON.stringify(task.resultSchema) }],
                 agentId: ephemeralId, isTask: true,
                 emit: (n, p) => { try { h.emit(n, p); } catch (_) {} childEmit(n, p); },
-                signal: h.signal, runId: repairRunId, parentRunId: ctx && ctx.runId,
+                signal: h.signal, runId: repairRunId, parentRunId: ctx && ctx.runId, delegatedBy: (ctx && ctx.agentId) || '',
                 trigger: 'directive', surface: 'autonomous', consent: ctx && ctx.consent,
                 extraObjects: WORKER_KIT, maxCostUsd: perWorker > 0 ? remaining : 0,
                 maxIters: lowerPositive(4, bounded ? lowerPositive(workerMaxIters, bounded.workerMaxIters) : workerMaxIters),
@@ -1077,19 +1081,51 @@
       }
     };
 
+    /* VERIFY A DELEGATED RUN (#57). The answer comes from the durable run history the Dossier RECORD reads, never from
+       the dispatch's own account of itself. Scoped to THIS lead: the run must have been dispatched by this lead's
+       current run, or by an earlier run recorded under this lead's agentId. A dispatch still in flight is recorded
+       when its worker ends, so "not found" says that instead of implying the work never happened. */
+    function verifyDelegatedRun(runId, leadId, ctx) {
+      if (!runRecord) return { content: 'The station\'s run history is not reachable from this run, so run ' + runId + ' cannot be checked here.', summary: 'unavailable' };
+      const read = (id) => { try { return runRecord(id) || null; } 
```

**File**: `test/e2e.dispatch-session.test.js` (modified, +1/-0)
```diff
@@ -214,6 +214,7 @@ await run('targeted',
     A.ok(workerRun, label + ": the worker's run is in the run ledger");
     A.eq(workerRun.streamId, 'ws_r1', label + ': and the ledger files it under the named session — not the lead\'s');
     A.eq(workerRun.runId, delivered[0].args.runId, label + ': the delivered runId is the SAME run the ledger recorded');
+    A.eq(workerRun.delegatedBy, 'agent', label + ': the ledger names the lead that delegated it (the Dossier RECORD keeps it out of the chat fold, #57)');
     A.eq(workerRun.sessionTitle, 'research', label + ': the stable target title is durable for cross-page recovery');
     A.eq(workerRun.deliveryPrompt, 'summarise the moons of Mars', label + ': the delegated instruction is durable');
     A.eq(workerRun.deliveryText, WORKER_TEXT, label + ': the finished answer is durable when no page can receive it');
```

**File**: `test/loop.retry-events.test.js` (modified, +31/-0)
```diff
@@ -53,7 +53,38 @@ async function run(provider, extra) {
 }
 
 (async () => {
+  // A recovery attempt is a new paid call, even though it stays in the same turn.
+  for (const scope of ['run', 'day', 'unpriced']) {
+    const p = scripted(() => ({ events: [
+      { type: 'usage', usage: { prompt_tokens: 12, completion_tokens: 12, total_tokens: 24, ...(scope === 'unpriced' ? {} : { cost: 1.25 }) } },
+      { type: 'text', delta: 'partial answer' },
+      { type: 'done', finishReason: null, truncated: true }
+    ] }));
+    const extra = scope === 'day' ? { budget: { check: spent => spent >= 1 ? { scope: 'day', cap: 1 } : null } }
+      : scope === 'unpriced' ? { cost: makeCostEngine({ priceOf: () => null }), limits: { maxUnpricedTokens: 20 } }
+      : { limits: { maxCostUsd: 1 } };
+    const { res, seq } = await run(p, extra);
+    A.eq(p.calls.length, 1, scope + ': no second paid request after the failed attempt exhausts the cap');
+    A.eq(res.reason, 'budget', scope + ': the recovery stops with truthful budget reason');
+    A.eq(res.budgetScope, scope === 'day' ? 'day' : 'run', scope + ': names the limiting scope');
+    A.eq(seq.filter(e => e.name === 'agent.cost').length, 1, scope + ': partial usage is booked exactly once');
+    A.eq(res.usd, scope === 'unpriced' ? 0 : 1.25, scope + ': no duplicate or discarded partial charge');
+  }
   // ---- 1. the ladder, pre-stream: 503, 503, answer ----
+  {
+    const p = scripted(() => ({ events: answer('should not be bought') }));
+    let folds = 0;
+    const { res } = await run(p, {
+      messages: [{ role: 'user', content: 'old question' }, { role: 'assistant', content: 'old answer' }, { role: 'user', content: 'new question' }],
+      context: require('../sidecar/context.js').makeContext({ contextLimit: 10, compactAt: 0.65, keepTail: 1 }),
+      summarize: async () => { folds++; return { summary: 'S', usd: 1.25, tokens: 10 }; },
+      limits: { maxCostUsd: 1 }
+    });
+    A.eq(folds, 1, 'preflight compaction consumes the run allowance');
+    A.eq(p.calls.length, 0, 'no generation after preflight compaction exhausts the cap');
+    A.eq(res.reason, 'budget', 'post-compaction exhaustion reports budget');
+    A.eq(res.usd, 1.25, 'compaction charge remains accounted');
+  }
   {
     const p = scripted(n => (n <= 2 ? { throw: httpErr(503, 'upstream overloaded') } : { events: answer('ok') }));
     const { res, seq, sleeps, recov, dropped, retries } = await run(p);
```

---

### Incident Patch 6: `49cdc625` (2026-10-04)
**Commit Message**: qa(claims): re-lock the release surface after the group chat fixes

**File**: `qa/product-perfect/claims.json` (modified, +19/-19)
```diff
@@ -18,7 +18,7 @@
   "expectedClaimCount": 37,
   "releaseSurface": {
     "algorithm": "sha256",
-    "sourceCommit": "7be288d14168d71c4381ede742b1d35e2f2208b3",
+    "sourceCommit": "b4f3b258582dc4b16124cbc53d3e72a947d8db49",
     "pathSetSha256": "fac5552f81f0dd00ab64856cfdfc9f107fcb0517a3ef0449f4018b13e983e609",
     "files": [
       {
@@ -173,8 +173,8 @@
       },
       {
         "path": "frontend/app/app.js",
-        "bytes": 423259,
-        "sha256": "ba70084744b504c258ef9c96a6764087441396c62290d49e70f1d0e454de04ec"
+        "bytes": 424805,
+        "sha256": "c2d92cfc0ae4bb68c55cbe8fa37537dff55e79a9d022761c9061380896e501c8"
       },
       {
         "path": "frontend/app/approved-sheet-effects.js",
@@ -338,8 +338,8 @@
       },
       {
         "path": "frontend/app/chat.js",
-        "bytes": 714977,
-        "sha256": "4d9415bd9bfedc8709c998b4ef91178b452158c46988fad112ee68c9ecb64ba3"
+        "bytes": 716320,
+        "sha256": "bdfd41cdfdf49c64a6bd23919f8d4221533090ba961ca1d111daafef7781da3c"
       },
       {
         "path": "frontend/app/chatresize.js",
@@ -543,8 +543,8 @@
       },
       {
         "path": "frontend/app/group-chat.js",
-        "bytes": 40272,
-        "sha256": "56681080cfa0b6bedcd904bc7f6bf3ebfe842b51439159750139bb99f308a813"
+        "bytes": 66517,
+        "sha256": "20b12ca9aa77a983d5f3e2f6da8bdd9385c6230e5c186751537881c16c4a5320"
       },
       {
         "path": "frontend/app/harness.js",
@@ -1498,8 +1498,8 @@
       },
       {
         "path": "frontend/css/app.css",
-        "bytes": 415246,
-        "sha256": "0c0567643cbc6c7925df5df8cd4f7e677233433d8b7b7d83b67fa1d09e677d12"
+        "bytes": 415800,
+        "sha256": "f6fe7de502fd85f0123570f2afd5e6a81903bc8bf0776be9603ac51e662a66ac"
       },
       {
         "path": "frontend/css/asciifx.css",
@@ -1528,8 +1528,8 @@
       },
       {
         "path": "frontend/css/comms-convo.css",
-        "bytes": 16868,
-        "sha256": "a91344c74c31e2c17acf349715ce515386049608a8144b8b26ae47b2e2075a5b"
+        "bytes": 18024,
+        "sha256": "dd4fd9192150c827b1de6577310e1bc4f4e84fee39a1921074d7da5f2274f84a"
       },
       {
         "path": "frontend/css/comms-layout.css",
@@ -1538,8 +1538,8 @@
       },
       {
         "path": "frontend/css/comms.css",
-        "bytes": 53614,
-        "sha256": "782b19c46d7ce047cc3778f58bd08ecbda504dc24cbb2137f84133854788f5e1"
+        "bytes": 53642,
+        "sha256": "2d0d1a1db5987084a49c6c4e2ee17fa9590b0944dc71fa9f5eea195b6dc0c6ae"
       },
       {
         "path": "frontend/css/crew-glass.css",
@@ -1553,8 +1553,8 @@
       },
       {
         "path": "frontend/css/glass-comms.css",
-        "bytes": 25250,
-        "sha256": "d298c5bd50b9d245cd2ddc84c775d16abe4d6a008d7a63a3e53d590ce37e9aa6"
+        "bytes": 25600,
+        "sha256": "502290a7e2d10633dff6189214adef659e14cb52d9553ba13e3cdffec4993293"
       },
       {
         "path": "frontend/css/glass-demo.css",
@@ -1568,8 +1568,8 @@
       },
       {
         "path": "frontend/css/interface.css",
-        "bytes": 33962,
-        "sha256": "9962c14a69b2c97b00997b60889f0aeb730f3ec4e9d4dc130dc96aba75b63c0b"
+        "bytes": 34046,
+        "sha256": "d56ab811268793cc1371a046f965f0e1f8bb4ced37285df5328714d722691374"
       },
       {
         "path": "frontend/css/linewatch.css",
@@ -1613,8 +1613,8 @@
       },
       {
         "path": "frontend/css/pipglass.css",
-        "bytes": 60777,
-        "sha256": "721e1fa64dbacbf8251f1f76e935e5edd16fa7b152c1d08f9e9861d5ac707d68"
+        "bytes": 60973,
+        "sha256": "fb12fe5fb10422814e07dc809d0909c2323a837d5d994b7dbfdeb1ca17f30d99"
       },
       {
         "path": "frontend/css/plugins.css",
```

---

### Incident Patch 7: `b4f3b258` (2026-10-04)
**Commit Message**: website: mirror the group chat fixes (npm run sync:website)

**File**: `website/app/app/app.js` (modified, +18/-4)
```diff
@@ -3930,7 +3930,11 @@ const App = (() => {
   // Pending consent belongs to a session. Multiple sessions on one agent remain distinct;
   // deleted/orphaned channels cannot contribute a count with nowhere to open.
   function railPendingIds() {
-    return new Set(typeof Channels === 'undefined' ? [] : Channels.pendingIds().filter(id => Workstreams.get(id)));
+    const ids = typeof Channels === 'undefined' ? [] : Channels.pendingIds().filter(id => Workstreams.get(id));
+    // a GROUP waiting on the Commander (a question, an approval that expires in 5 minutes) — read off the backend's
+    // group list (group-chat.js watch), since group runs never pass through Channels
+    if (typeof GroupChat !== 'undefined' && GroupChat.attentionIds) for (const id of GroupChat.attentionIds()) if (Workstreams.get(id) && !ids.includes(id)) ids.push(id);
+    return new Set(ids);
   }
   function syncRailAttention(pending) {
     railAttentionKey = [...pending].sort().join('\n');
@@ -3983,6 +3987,13 @@ const App = (() => {
       const question = pending.tool === 'brief.ask';
       return { dot: question ? 'ws-dot needsyou reply' : 'ws-dot needsyou approval', meta: question ? 'Reply needed' : 'Approval needed', busy: Channels.isBusy(w.id), attn: true, status: question ? 'waiting for your answer' : 'awaiting your approval' };
     }
+    // a GROUP's runs live in the group coordinator, not Channels: its row reads the backend group state instead
+    const gs = w.conversationMode === 'group' && typeof GroupChat !== 'undefined' && GroupChat.stateOf ? GroupChat.stateOf(w.id) : null;
+    if (gs && (gs.approvals || gs.questions)) {
+      const ask = !gs.approvals;
+      return { dot: ask ? 'ws-dot needsyou reply' : 'ws-dot needsyou approval', meta: ask ? 'Reply needed' : 'Approval needed', busy: !!gs.busy, attn: true, status: ask ? 'waiting for your answer' : 'awaiting your approval' };
+    }
+    if (gs && gs.busy) return { dot: 'ws-dot working', meta: 'Working', busy: true, attn: false, status: 'agents are working in this group' };
     if (typeof Channels !== 'undefined' && Channels.isBusy(w.id)) {
       if (!Channels.runIdOf(w.id)) {
         return { dot: 'ws-dot connecting', meta: 'Connecting', busy: true, attn: false, status: 'connecting to the model' };
@@ -4045,7 +4056,7 @@ const App = (() => {
   function railModelFull(w) { return (w.lastModel || '').trim(); }
   function railRowLabel(w, st, project = false) {
     const title = w.title || 'General', name = railAgentName(w);
-    return title + ' session' + (name === title ? '' : ', ' + name) + (st.status ? ', ' + st.status : '')
+    return title + (w.conversationMode === 'group' ? ' group chat' : ' session') + (name === title ? '' : ', ' + name) + (st.status ? ', ' + st.status : '')
       + (Workstreams.unread(w) && !st.dot.includes('unseen') ? ', unread activity' : '')
       + (project ? '; Enter to open' : '; Enter to open; Shift+F10 for actions');
   }
@@ -4103,6 +4114,8 @@ const App = (() => {
       return groupHead + '<li class="' + rowClass(w, st, activeId) + '" data-id="' + U.esc(w.id) + '" tabindex="' + (w.id === railFocusId ? '0' : '-1') + '" role="option" aria-selected="' + (w.id === activeId ? 'true' : 'false') + '" aria-posinset="' + (index + 1) + '" aria-setsize="' + rows.length + '" aria-label="' + U.esc(railRowLabel(w, st)) + '" aria-keyshortcuts="Shift+F10" title="' + U.esc(tip) + '">' +
         '<span class="' + st.dot + '" aria-hidden="true"></span>' +
         (w.pinned ? '<span class="ws-pin" aria-hidden="true">★</span>' : '') +
+        // a group chat says so on the row itself: the COMPACT rail hides the agent line that names its members
+        (w.conversationMode === 'group' ? '<span class="ws-gc" aria-hidden="true">GROUP</span>' : '') +
         '<span class="ws-agent" aria-hidden="true"' + railAgentColorAttr(w) + '>' + U.esc(railAgentName(w)) + '</span>' +
         '<span class="ws-title">' + U.esc(title) + '</span>' +
         '<span class="ws-meta">' + U.esc(st.meta) + '</span>' +
@@ -4314,7 +4327,7 @@ const App = (() => {
     // law above only protects conversations with content. General (the hero's home) and any stream with
     // history / runs / a live run keep their binding and fall through to the switch-or-mint path.
     const cur = Workstreams.active();
-    if (cur && cur.id !== Workstreams.generalId() && (cur.agentId || 'agent') !== id
+    if (cur && cur.id !== Workstreams.generalId() && cur.conversationMode !== 'group' && (cur.agentId || 'agent') !== id
         && !(cur.history && cur.history.length) && !(cur.runIds && cur.runIds.length)
         && !(typeof Channels !== 'undefined' && Channels.isBusy(cur.id))
         && Workstreams.setAgent(cur.id, id)) {
@@ -4326,7 +4339,8 @@ const App = (() => {
     // prefer this agent's existing streams (most-recently-active first — Workstreams.list() is already sorted
     // pinned>recent); the General default stream (title==null) is only NOVA/hero's home, so a special
```

**File**: `website/app/app/chat.js` (modified, +17/-1)
```diff
@@ -970,6 +970,8 @@ const Chat = (() => {
         if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSlash(); return; }
         // any other key falls through to normal typing → the 'input' listener re-filters the palette
       }
+      // @ MENU (group-chat.js) owns ↑ ↓ Enter Tab Esc while it lists agents over the message box
+      if (typeof GroupChat !== 'undefined' && GroupChat.mentionKey && GroupChat.mentionKey(e)) return;
       // INPUT HISTORY — recall starts only from an EMPTY box (a draft in progress is never hijacked);
       // once recalling, ArrowUp/ArrowDown walk the sent list, ArrowDown past the newest restores the draft.
       if (e.key === 'ArrowUp' && sentHistory.length && (histIdx >= 0 || input.value === '')) {
@@ -1042,6 +1044,20 @@ const Chat = (() => {
       return;
     }
     if (t) recordSent(t);
+    // "@finn take a look" from a DIRECT chat reaches FINN: the chat becomes a group with them first (General stays
+    // General — a fresh group opens beside it), then the message goes to that group. A refusal (the agent here is
+    // still mid-run, the backend said no) keeps the words in the box and says why.
+    const pulled = activeWs && activeWs.conversationMode !== 'group' && t && typeof GroupChat !== 'undefined' && GroupChat.mentionTargets ? GroupChat.mentionTargets(t, activeWs) : [];
+    if (pulled.length) {
+      const g = await GroupChat.startWith(pulled);
+      const ws = g && Workstreams.get(g.id);
+      if (!ws || activeWs?.id !== ws.id) return;
+      if (hasStaged) await settleAttachments();
+      const atts = pendingAtts.filter(entry => entry.status === 'ready' && entry.ref).map(entry => entry.ref);
+      const sent = await GroupChat.sendText(t, { attachments: atts, attachmentAgent: ws.agentId });
+      if (sent && activeWs?.id === ws.id) { takeAttachments(); if (input.value.trim() === t) input.value = ''; closeSlash(); autoGrowInput(); }
+      return;
+    }
     if (activeWs?.conversationMode === 'group' && typeof GroupChat !== 'undefined') {
       const ws = activeWs;
       if (hasStaged) await settleAttachments();
@@ -9784,5 +9800,5 @@ const Chat = (() => {
   // only" gate maybeStandaloneRate uses — so a pure-chat run is never bottle-offered. Used by App.runBottleInfo (R5).
   function runDidWork(id) { const w = id ? runWork.get(id) : null; return !!(w && ((w.toolsOk || 0) >= 1 || (w.delivered || 0) >= 1)); }
 
-  return { init, load, send, continuityDiagnostics, refreshStarters, sendOrQueue, continueConnectorTask, stopActive, status, localLine, broadcast, renderProse, setSystem, getHistory, contextRef, abort, isBusy, beatBusy: skillBeatBusy, beginInterview, endInterview, echoUser, prefill, autoGrowInput, choices, clearChoices, retireDeskPrompt, typeLine, nudge, clearNudge, offerCuriosity, offerFork, planGoalPath, briefingReceipt, isComposerEngaged, canFocusSession, runMeta, runDidWork, awayDigest, awayReview, awayRate, sampleCard, workshopReturn, refreshIdBar: renderIdBar, refreshGroupControls: updateControls, refreshAgentIdentity, setRosterStatus, askBudgetSpent, spendAsk };
+  return { init, load, send, continuityDiagnostics, refreshStarters, sendOrQueue, continueConnectorTask, stopActive, status, localLine, broadcast, renderProse, setSystem, getHistory, contextRef, abort, isBusy, beatBusy: skillBeatBusy, beginInterview, endInterview, echoUser, prefill, autoGrowInput, choices, clearChoices, retireDeskPrompt, typeLine, nudge, clearNudge, offerCuriosity, offerFork, planGoalPath, briefingReceipt, isComposerEngaged, canFocusSession, runMeta, runDidWork, awayDigest, awayReview, awayRate, sampleCard, workshopReturn, refreshIdBar: renderIdBar, refreshGroupControls: updateControls, refreshAgentIdentity, setRosterStatus, askBudgetSpent, spendAsk, clockLabel: fmtClock, breakLabel: fmtBreak };
 })();
```

**File**: `website/app/app/group-chat.js` (modified, +452/-119)
```diff
@@ -4,6 +4,11 @@ const GroupChat = (() => {
   let active = null, group = null, root, timer, busy = false, replyTo = null, roster = [], selected = [];
   let generation = 0, lastPaint = '', notice = '', draftKey = null;
   let openedFileUrl = null, openedFile = null;
+  // the ADD AGENTS window: which session it edits, and its repaint (so a member who joins by @mention shows in it)
+  let pickerFor = null, pickerRepaint = null;
+  // the @ menu over the composer: its rows, the highlighted one, and the "@que" being typed
+  let mentionItems = [], mentionSel = 0, mentionCtx = null, mentionBusy = false;
+  let basePlaceholder = null;
   const composerDrafts = new Map();
   const sharedAttachments = new Map();
   const $ = id => document.getElementById(id);
@@ -15,7 +20,11 @@ const GroupChat = (() => {
     return e;
   };
   const button = (label, fn) => h('button', { type: 'button', class: 'bb', onclick: () => Promise.resolve().then(fn).catch(showError) }, label);
-  function showError(e) { notice = e.message || String(e); if ($('gc-notice')) $('gc-notice').textContent = notice; }
+  function showError(e) {
+    notice = e.message || String(e); if ($('gc-notice')) $('gc-notice').textContent = notice;
+    // a direct chat has no group notice line on screen: say it where the Commander is looking
+    if (active?.conversationMode !== 'group' && typeof StationUI !== 'undefined' && StationUI.notify) StationUI.notify(notice, 'bad');
+  }
   async function api(body, query = '') {
     const r = await fetch('/api/groups' + query, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
     if (r.status === 401 || r.status === 403) throw new Error('Reconnect to this station by refreshing the page. Your conversation is saved.');
@@ -47,16 +56,41 @@ const GroupChat = (() => {
     }
     return ws;
   }
+  // the live crew: the station registry first (it is what CREW shows), the backend's roster as the fallback
+  function crew() {
+    const live = typeof App !== 'undefined' && App.agents ? (App.agents() || []) : [];
+    const list = live.length ? live : roster;
+    return list.filter(a => a && a.id).map(a => ({ id: a.id, name: String(a.name || a.id) }));
+  }
   function name(id) { return id === 'user' ? 'COMMANDER' : (roster.find(a => a.id === id)?.name || App.agents?.().find(a => a.id === id)?.name || id); }
   function colorOf(id) { const c = typeof App !== 'undefined' && App.agents ? App.agents().find(a => a.id === id)?.color : ''; return /^#[0-9a-f]{3,8}$/i.test(c || '') ? c : ''; }
-  function participantsHeader(element, ids, paused) {
-    element.replaceChildren(h('span', { class: 'gc-count' }, ids.length + (ids.length === 1 ? ' agent' : ' agents')));
-    /* One line, ellipsized — never a scrollbar. The count beside it says how many; the full list is
-       one hover (station tip) or one click (the picker) away. */
-    const people = h('button', { type: 'button', class: 'gc-people', title: ids.map(name).join(' · '), 'aria-label': 'Agents in this chat: ' + ids.map(name).join(', ') + '. Add or remove agents', onclick: () => picker(true) });
-    for (const id of ids) people.append(h('span', { class: 'gc-person' }, name(id)));
-    element.append(people);
+  /* The group header: a [ GROUP ] tag, then EVERY member by name in their roster colour (lead first), the count, and
+     the + key. Names wrap to a second line before anything is hidden; past two lines the rest fold into "+N", which
+     opens the full list (Andrew 10-04: "you cant even tell when the groupchat is there, it does not show all the agents"). */
+  function participantsHeader(element, ids, paused, leadId) {
+    const order = leadId && ids.includes(leadId) ? [leadId, ...ids.filter(id => id !== leadId)] : ids.slice();
+    const people = h('button', { type: 'button', class: 'gc-people', title: order.map(name).join(' · '), 'aria-label': 'Agents in this chat: ' + order.map(name).join(', ') + '. Add or remove agents', onclick: () => picker(true) });
+    for (const id of order) {
+      const p = h('span', { class: 'gc-person' + (id === leadId ? ' lead' : '') }, name(id));
+      const c = colorOf(id); if (c) p.style.color = c;
+      people.append(p);
+    }
+    const more = h('span', { class: 'gc-more', hidden: '' }); people.append(more);
+    element.replaceChildren(h('span', { class: 'gc-badge', 'aria-hidden': 'true' }, 'GROUP'), people, h('span', { class: 'gc-count' }, ids.length + (ids.length === 1 ? ' agent' : ' agents')));
     if (paused) element.append(h('small', {}, 'Paused'));
+    fitPeople(people);
+  }
+  // two lines of names at most: hide from the end until it fits, and say how many are folded away
+  function fitPeople(people) {
+    if (!people || typeof people.querySelectorAll !== 'function' || !people.isConnected) return;
+    const persons = [...people.querySelectorAll('.gc-person')], more = people.querySelector('.gc-more');
+    for (const p of per
```

**File**: `website/app/css/app.css` (modified, +6/-0)
```diff
@@ -3191,6 +3191,12 @@ body.rows-inbox #workstreams .ws-kebab { grid-area: meta; }
 .ws-arch-row.on { color: var(--ph); }
 /* pinned rows sort to the top AND carry a small gold star so the "kept" state is legible at a glance */
 .ws-pin { flex: 0 0 auto; font-size: 10px; line-height: 1; color: var(--gold); text-shadow: 0 0 6px rgba(var(--gold-rgb),.5); }
+/* a GROUP chat row says so before its title: the COMPACT row hides the agent line that names its members.
+   The INBOX row (a grid) already names every member on that line, so the tag stays out of its grid. */
+.ws-gc { flex: 0 0 auto; font-size: 10px; line-height: 1; letter-spacing: 1px; color: var(--ph); white-space: nowrap; text-shadow: var(--pg-glow-soft, none); }
+.ws-gc::before { content: '['; margin-right: 2px; opacity: .6; }
+.ws-gc::after { content: ']'; margin-left: 2px; opacity: .6; }
+body.rows-inbox #workstreams .ws-gc { display: none; }
 /* the ⋯ button is the discoverable twin of right-click: hidden until the row is hovered, where it takes the meta slot */
 .ws-kebab {
   display: none; flex: 0 0 auto; font-family: inherit; font-size: 15px; line-height: 1; letter-spacing: 1px;
```

**File**: `website/app/css/comms-convo.css` (modified, +78/-78)
```diff
@@ -4,7 +4,7 @@
 
    Loaded LAST (after pipglass.css) so it settles the transcript's reading layer in one place instead of adding a
    seventh tug-of-war between app / comms / interface / glass-comms / readability / beat-cards. Every rule is scoped
-   `body #chat-panel #chat-log …` (two ids) so it outranks the older class-heavy selectors by specificity, not by
+   `body #chat-panel :is(#chat-log, #gc-log) …` (two ids — the group transcript speaks the same language, Andrew 10-04) so it outranks the older class-heavy selectors by specificity, not by
    !important — the only !important here answers beat-cards' own !important on the broadcast block.
 
    The shape, top to bottom of one exchange:
@@ -23,175 +23,175 @@
    texture under text. Theme tokens only. */
 
 /* ---- rhythm: a new exchange opens with air, the answer sits close to its question ---- */
-body #chat-panel #chat-log { gap: 6px; }
-body #chat-panel #chat-log > .cmsg.user { margin-top: 12px; }
-body #chat-panel #chat-log > .cmsg-timebreak + .cmsg.user,
-body #chat-panel #chat-log > .cmsg.user:first-child { margin-top: 0; }
-body #chat-panel #chat-log > .cmsg.user + .cmsg.user { margin-top: 0; }
+body #chat-panel :is(#chat-log, #gc-log) { gap: 6px; }
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg.user { margin-top: 12px; }
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg-timebreak + .cmsg.user,
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg.user:first-child { margin-top: 0; }
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg.user + .cmsg.user { margin-top: 0; }
 
 /* ---- TIME BREAK — the day + clock where a conversation (re)starts ---- */
-body #chat-panel #chat-log > .cmsg-timebreak {
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg-timebreak {
   display: flex; align-items: center; gap: 10px;
   margin: 14px 2px 2px; flex: 0 0 auto;
 }
-body #chat-panel #chat-log > .cmsg-timebreak:first-child { margin-top: 2px; }
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg-timebreak:first-child { margin-top: 2px; }
 /* a Pip-Boy rule: a 1px line with a short END TICK dropping from each outer end */
-body #chat-panel #chat-log > .cmsg-timebreak::before,
-body #chat-panel #chat-log > .cmsg-timebreak::after {
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg-timebreak::before,
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg-timebreak::after {
   content: ""; flex: 1 1 auto; height: 4px; align-self: flex-start; margin-top: calc(.6em);
   border-top: 1px solid rgba(var(--ph-rgb), .28);
 }
-body #chat-panel #chat-log > .cmsg-timebreak::before { border-left: 1px solid rgba(var(--ph-rgb), .28); }
-body #chat-panel #chat-log > .cmsg-timebreak::after { border-right: 1px solid rgba(var(--ph-rgb), .28); }
-body #chat-panel #chat-log > .cmsg-timebreak .tb-when {
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg-timebreak::before { border-left: 1px solid rgba(var(--ph-rgb), .28); }
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg-timebreak::after { border-right: 1px solid rgba(var(--ph-rgb), .28); }
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg-timebreak .tb-when {
   flex: 0 0 auto; font-size: var(--sn-type-meta, 13px); letter-spacing: 1.2px; text-transform: uppercase;
   color: var(--ph); opacity: .72; white-space: nowrap; font-variant-numeric: tabular-nums;
   text-shadow: var(--pg-glow-soft, none);
 }
-body #chat-panel #chat-log > .cmsg-timebreak .tb-when::before { content: '[ '; opacity: .6; }
-body #chat-panel #chat-log > .cmsg-timebreak .tb-when::after { content: ' ]'; opacity: .6; }
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg-timebreak .tb-when::before { content: '[ '; opacity: .6; }
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg-timebreak .tb-when::after { content: ' ]'; opacity: .6; }
 
 /* ---- STAMPS — always readable (they were hover-only: "hard to see when you sent things") ---- */
-body #chat-panel #chat-log .cmsg:is(.agent, .user) .cmsg-ts { opacity: .62; color: var(--text); }
-body #chat-panel #chat-log .cmsg:is(.agent, .user):is(:hover, :focus-within) .cmsg-ts { opacity: .9; }
+body #chat-panel :is(#chat-log, #gc-log) .cmsg:is(.agent, .user) .cmsg-ts { opacity: .62; color: var(--text); }
+body #chat-panel :is(#chat-log, #gc-log) .cmsg:is(.agent, .user):is(:hover, :focus-within) .cmsg-ts { opacity: .9; }
 /* a same-speaker follow-up stamped the same minute as the row above: one message, one stamp */
-body #chat-panel #chat-log .cmsg.ts-repeat:is(.agent, .user) > .cmsg-head { display: none; }
+body #chat-panel :is(#chat-log, #gc-log) .cmsg.ts-repeat:is(.agent, .user) > .cmsg-head { display: none; }
 
 /* callsigns read as station type: the same RGB-fringe phosphor the CREW names wear */
-body #chat-panel #chat-log .cmsg:is(.agent, .user) > .cmsg-head > .who { text-shadow: var(--pg-glow-soft, none); letter-spacing: 1.4px; }
+body #chat-panel :is(#chat-log, #gc-log) .cmsg:is(.agent, .user) > .cmsg-head > .who { text-shadow: var(--pg-glow-soft, none); letter-spacing: 1.4px; }
 
 /* ---- THE DITHER FIELD — both speakers' text s
```

**File**: `website/app/css/comms.css` (modified, +2/-2)
```diff
@@ -76,8 +76,8 @@
 .cmsg.user  + .cmsg.user  > .cmsg-head { display: flex; justify-content: flex-end; margin: 4px 0 0; min-height: 0; }
 .cmsg.agent + .cmsg.agent > .cmsg-head > .who,
 .cmsg.user  + .cmsg.user  > .cmsg-head > .who { display: none; }
-body.glass-demo #chat-log .cmsg.agent + .cmsg.agent > .cmsg-head,
-body.glass-demo #chat-log .cmsg.user  + .cmsg.user  > .cmsg-head { margin: 2px 0 2px; min-height: 0; }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg.agent + .cmsg.agent > .cmsg-head,
+body.glass-demo :is(#chat-log, #gc-log) .cmsg.user  + .cmsg.user  > .cmsg-head { margin: 2px 0 2px; min-height: 0; }
 
 /* agent transmission card: the existing left phosphor rail + a faint recessed fill and hairline inset,
    airy not boxy. Keeps the base padding-left so grouped bodies still align under the rail. SCOPED to
```

**File**: `website/app/css/glass-comms.css` (modified, +25/-25)
```diff
@@ -213,51 +213,51 @@ body.glass-demo :is(#model-dock,#chat-slash,.gd-agent-menu)[hidden] { display: n
 @starting-style { body.glass-demo :is(#model-dock,#chat-slash,.gd-agent-menu):not([hidden]) { opacity: 0; transform: translateY(7px); } }
 /* Conversation rows pick up the same glass highlight as CREW on inspection. */
 body.glass-demo #chat-log { padding: 10px 8px; gap: 7px; background: transparent; }
-body.glass-demo #chat-log .cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable):not(.reply),
-body.glass-demo #chat-log .cmsg.user {
+body.glass-demo :is(#chat-log, #gc-log) .cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable):not(.reply),
+body.glass-demo :is(#chat-log, #gc-log) .cmsg.user {
   padding: 7px 9px 8px; border: 1px solid transparent; border-radius: 3px;
   border-left-color: var(--gd-message-left,transparent); border-right-color: var(--gd-message-right,transparent);
   background: linear-gradient(130deg,rgba(var(--ph-rgb),.025),transparent 70%);
   box-shadow: none;
   transition: border-color var(--t-fast) var(--ease-soft), background-color var(--t-fast) var(--ease-soft);
 }
-body.glass-demo #chat-log .cmsg.agent { --gd-message-left: rgba(var(--ph-rgb),.22); }
-body.glass-demo #chat-log .cmsg.user { --gd-message-right: rgba(var(--gold-rgb),.35); max-width: 90%; }
-body.glass-demo #chat-log .cmsg:is(.agent,.user):not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable):not(.reply):is(:hover,:focus-within) {
+body.glass-demo :is(#chat-log, #gc-log) .cmsg.agent { --gd-message-left: rgba(var(--ph-rgb),.22); }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg.user { --gd-message-right: rgba(var(--gold-rgb),.35); max-width: 90%; }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg:is(.agent,.user):not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable):not(.reply):is(:hover,:focus-within) {
   border-color: var(--gd-edge); background: var(--gd-hover); box-shadow: inset 0 1px 0 var(--gd-light);
   border-left-color: var(--gd-message-left,var(--gd-edge)); border-right-color: var(--gd-message-right,var(--gd-edge));
 }
-body.glass-demo #chat-log .cmsg.user:is(:hover,:focus-within) { --gd-message-right: var(--gold); }
-body.glass-demo #chat-log .cmsg .cmsg-head { margin: 1px 0 6px; min-height: 18px; }
-body.glass-demo #chat-log .cmsg .who { font-size: 15px; line-height: 1.2; letter-spacing: .7px; }
-body.glass-demo #chat-log .cmsg .cmsg-ts { font-size: 11px; letter-spacing: .5px; }
-body.glass-demo #chat-log .cmsg.agent .who { color: var(--ph); }
-body.glass-demo #chat-log .cmsg.user .who { opacity: .9; margin-right: 0; }
-body.glass-demo #chat-log .cmsg .body { line-height: 1.45; overflow-wrap: anywhere; }
-body.glass-demo #chat-log .cmsg.agent.err { --gd-message-left: var(--bad); }
-body.glass-demo #chat-log .cmsg.agent.err .body { color: var(--text); }
-body.glass-demo #chat-log .cmsg.agent.err .who { color: var(--bad); }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg.user:is(:hover,:focus-within) { --gd-message-right: var(--gold); }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg .cmsg-head { margin: 1px 0 6px; min-height: 18px; }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg .who { font-size: 15px; line-height: 1.2; letter-spacing: .7px; }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg .cmsg-ts { font-size: 11px; letter-spacing: .5px; }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg.agent .who { color: var(--ph); }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg.user .who { opacity: .9; margin-right: 0; }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg .body { line-height: 1.45; overflow-wrap: anywhere; }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg.agent.err { --gd-message-left: var(--bad); }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg.agent.err .body { color: var(--text); }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg.agent.err .who { color: var(--bad); }
 /* The existing clipboard result classes drive the icon; copying still owns its true state. */
-body.glass-demo #chat-log :is(.cmsg-copy,.md-copy) {
+body.glass-demo :is(#chat-log, #gc-log) :is(.cmsg-copy,.md-copy) {
   width: 26px; height: 24px; padding: 0; font-size: 0; line-height: 0;
   border: 1px solid var(--gd-edge); border-radius: 3px; color: var(--ph);
   background: var(--gd-face); box-shadow: inset 0 1px 0 var(--gd-light); text-shadow: none;
   transition: opacity var(--t-fast) var(--ease-soft), color var(--t-fast) var(--ease-soft), border-color var(--t-fast) var(--ease-soft);
 }
-body.glass-demo #chat-log .cmsg-copy { top: 5px; }
-body.glass-demo #chat-log :is(.cmsg-copy,.md-copy)::before {
+body.glass-demo :is(#chat-log, #gc-log) .cmsg-copy { top: 5px; }
+body.glass-demo :is(#chat-log, #gc-log) :is(.cmsg-copy,.md-copy)::before {
   content: ""; position: absolute; inset: 4px 5px; background: currentColor;
   mask: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20d%3D%22M5.5%205.
```

**File**: `website/app/css/interface.css` (modified, +6/-6)
```diff
@@ -85,14 +85,14 @@ body {
 .comms-identity .comms-agent-select:hover { background: var(--ph-faint); border-color: var(--ui-edge); }
 .comms-identity .comms-agent-model { flex: none; text-align: left; font-size: 12px; opacity: 1; }
 #chat-log { padding: 6px 7px 12px; gap: 9px; box-shadow: var(--ui-well); background-color: rgba(0,0,0,.14); }
-#chat-log .cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable):not(.reply) {
+:is(#chat-log, #gc-log) .cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable):not(.reply) {
   padding-block: 5px 10px; background: linear-gradient(90deg, rgba(var(--ph-rgb), .04), transparent 85%);
 }
-#chat-log .cmsg.user { padding-block: 5px 10px; background: rgba(var(--gold-rgb), .035); }
-#chat-log .cmsg .who { font-size: 12px; letter-spacing: 1.5px; }
-#chat-log .cmsg.agent .who { color: var(--ph); }
-#chat-log .cmsg.user .who { opacity: .85; }
-#chat-log .cmsg .cmsg-ts { font-size: 11px; }
+:is(#chat-log, #gc-log) .cmsg.user { padding-block: 5px 10px; background: rgba(var(--gold-rgb), .035); }
+:is(#chat-log, #gc-log) .cmsg .who { font-size: 12px; letter-spacing: 1.5px; }
+:is(#chat-log, #gc-log) .cmsg.agent .who { color: var(--ph); }
+:is(#chat-log, #gc-log) .cmsg.user .who { opacity: .85; }
+:is(#chat-log, #gc-log) .cmsg .cmsg-ts { font-size: 11px; }
 #chat-panel #chat-inputrow {
   display: flex; flex-direction: column; align-items: stretch; gap: 9px;
   margin-top: 10px; padding: 11px; background: var(--panel2);
```

---

### Incident Patch 8: `9dc63574` (2026-10-04)
**Commit Message**: fix(group chat): groups you are not viewing still tell you, the transcript holds still, and pauses are explicit

Frontend half of the 10-04 group-chat sweep:
- Groups you were not viewing were never polled: replies, questions and tool approvals there were invisible, and an
  approval auto-denied after 5 minutes unseen. A light station-wide watch (4 s, never while hidden, at once on
  restore) reads the backend list: the rail row says Working / Reply needed / Approval needed, joins the attention
  set, and new activity marks it unread.
- The transcript rebuilt every 900 ms poll, wiping any text you had selected while an agent streamed; it reconciles
  by key now (unchanged rows are never touched), and every message has the direct chat's copy key.
- Adjacent replies from DIFFERENT agents lost the second speaker's name (a 1:1 COMMS rule); only a true same-speaker
  follow-up continues a row.
- Paused work says so with one CONTINUE; replies a pause stopped are named under their message with a RETRY; a
  queued turn blocked by someone else's question says whose answer it waits for; a reply aimed at the asker answers
  the waiting question instead of posting a new turn.
- Approval keys s

**File**: `frontend/app/app.js` (modified, +15/-3)
```diff
@@ -3930,7 +3930,11 @@ const App = (() => {
   // Pending consent belongs to a session. Multiple sessions on one agent remain distinct;
   // deleted/orphaned channels cannot contribute a count with nowhere to open.
   function railPendingIds() {
-    return new Set(typeof Channels === 'undefined' ? [] : Channels.pendingIds().filter(id => Workstreams.get(id)));
+    const ids = typeof Channels === 'undefined' ? [] : Channels.pendingIds().filter(id => Workstreams.get(id));
+    // a GROUP waiting on the Commander (a question, an approval that expires in 5 minutes) — read off the backend's
+    // group list (group-chat.js watch), since group runs never pass through Channels
+    if (typeof GroupChat !== 'undefined' && GroupChat.attentionIds) for (const id of GroupChat.attentionIds()) if (Workstreams.get(id) && !ids.includes(id)) ids.push(id);
+    return new Set(ids);
   }
   function syncRailAttention(pending) {
     railAttentionKey = [...pending].sort().join('\n');
@@ -3983,6 +3987,13 @@ const App = (() => {
       const question = pending.tool === 'brief.ask';
       return { dot: question ? 'ws-dot needsyou reply' : 'ws-dot needsyou approval', meta: question ? 'Reply needed' : 'Approval needed', busy: Channels.isBusy(w.id), attn: true, status: question ? 'waiting for your answer' : 'awaiting your approval' };
     }
+    // a GROUP's runs live in the group coordinator, not Channels: its row reads the backend group state instead
+    const gs = w.conversationMode === 'group' && typeof GroupChat !== 'undefined' && GroupChat.stateOf ? GroupChat.stateOf(w.id) : null;
+    if (gs && (gs.approvals || gs.questions)) {
+      const ask = !gs.approvals;
+      return { dot: ask ? 'ws-dot needsyou reply' : 'ws-dot needsyou approval', meta: ask ? 'Reply needed' : 'Approval needed', busy: !!gs.busy, attn: true, status: ask ? 'waiting for your answer' : 'awaiting your approval' };
+    }
+    if (gs && gs.busy) return { dot: 'ws-dot working', meta: 'Working', busy: true, attn: false, status: 'agents are working in this group' };
     if (typeof Channels !== 'undefined' && Channels.isBusy(w.id)) {
       if (!Channels.runIdOf(w.id)) {
         return { dot: 'ws-dot connecting', meta: 'Connecting', busy: true, attn: false, status: 'connecting to the model' };
@@ -4316,7 +4327,7 @@ const App = (() => {
     // law above only protects conversations with content. General (the hero's home) and any stream with
     // history / runs / a live run keep their binding and fall through to the switch-or-mint path.
     const cur = Workstreams.active();
-    if (cur && cur.id !== Workstreams.generalId() && (cur.agentId || 'agent') !== id
+    if (cur && cur.id !== Workstreams.generalId() && cur.conversationMode !== 'group' && (cur.agentId || 'agent') !== id
         && !(cur.history && cur.history.length) && !(cur.runIds && cur.runIds.length)
         && !(typeof Channels !== 'undefined' && Channels.isBusy(cur.id))
         && Workstreams.setAgent(cur.id, id)) {
@@ -4328,7 +4339,8 @@ const App = (() => {
     // prefer this agent's existing streams (most-recently-active first — Workstreams.list() is already sorted
     // pinned>recent); the General default stream (title==null) is only NOVA/hero's home, so a specialist that
     // has no stream yet gets a fresh one titled with its name (mirrors summon's Workstreams.create).
-    const mine = Workstreams.list().filter(w => (w.agentId || 'agent') === id);
+    // a 1:1 pick never lands in a GROUP that agent happens to lead (a group's agentId is only its lead)
+    const mine = Workstreams.list().filter(w => (w.agentId || 'agent') === id && w.conversationMode !== 'group');
     let ws = mine[0] || null;
     if (!ws) ws = Workstreams.create(a.name, { agentId: id, activate: false });
     if (!ws) return null;
```

**File**: `frontend/app/group-chat.js` (modified, +120/-30)
```diff
@@ -122,7 +122,7 @@ const GroupChat = (() => {
     if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => fitPeople($('gc-header')?.querySelector?.('.gc-people'))).observe(header);
     const css = h('style'); css.textContent = `
       #group-chat{position:relative;display:flex;flex:1 1 0;min-width:0;min-height:0;flex-direction:column;overflow:hidden;color:var(--text);background:transparent;padding:0;gap:0}
-      #group-chat[hidden],#gc-header[hidden]{display:none}
+      #group-chat[hidden],#gc-header[hidden],#group-chat .gc-files[hidden]{display:none}
       #comms-idbar{flex:0 0 auto;flex-wrap:nowrap}#comms-idbar.gc-group>.comms-agent-wrap,#comms-idbar.gc-group>#comms-agent-model,#chat-panel #comms-idbar.gc-group>.comms-identity,#chat-panel #comms-idbar.gc-group>.comms-portrait{display:none}
       #gc-header{display:flex;align-items:center;gap:10px;flex:1;min-width:0;color:var(--ph)}
       .gc-badge{flex:0 0 auto;align-self:center;font-size:12px;line-height:18px;letter-spacing:1.5px;color:var(--ph-bright);text-shadow:var(--pg-glow-soft,none);white-space:nowrap}
@@ -142,6 +142,9 @@ const GroupChat = (() => {
       #gc-log .gc-message .who.gc-who{cursor:pointer;user-select:none;border:0;background:none;padding:0;font:inherit;text-transform:uppercase;text-align:left;width:auto;min-height:0;box-shadow:none}
       #gc-log .gc-message .who.gc-who:hover{color:var(--ph-bright)}
       #gc-log .gc-message .who.gc-who::after{content:' @';opacity:0;font-size:11px;letter-spacing:0;transition:opacity .12s}#gc-log .gc-message .who.gc-who:hover::after{opacity:.8}
+      body #chat-panel #gc-log>.gc-message.cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable)+.gc-message.cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable):not(.gc-cont){margin-top:6px}
+      body #chat-panel #gc-log>.gc-message.cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable)+.gc-message.cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable):not(.gc-cont)>.cmsg-head{display:flex;justify-content:flex-start;margin:0 2px 4px}
+      body #chat-panel #gc-log>.gc-message.cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable)+.gc-message.cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable):not(.gc-cont)>.cmsg-head>.who{display:inline-block}
       #gc-log>.gc-masthead{flex:0 0 auto}#gc-log .gc-masthead .bc-name{margin:0 2px}#gc-log .gc-masthead .gc-how{text-transform:none;letter-spacing:.4px;opacity:.75}
       .gc-message.draft .body{opacity:.85}.gc-message.draft .body::after{content:'▌';color:var(--ph);animation:1s steps(1) infinite comms-blink}
       .gc-message .gc-partial{display:block;margin-top:4px;font-size:12px;letter-spacing:.5px;color:var(--gold)}
@@ -163,13 +166,13 @@ const GroupChat = (() => {
       #gc-files .gc-file:hover,#gc-files .gc-file.open{border-color:var(--ph-dim);background:rgba(var(--ph-rgb),.055);color:var(--ph-bright)}#gc-files .gc-file .tc-glyph{color:var(--ph-dim)}#gc-files .gc-file span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
       #gc-preview{flex:0 1 auto;min-height:0;overflow:auto;padding:0 12px 8px}#gc-preview:empty{display:none}#gc-preview h4{margin:6px 0 2px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:var(--ph)}#gc-preview small{color:var(--ph-dim);font-size:11px;margin-right:10px}
       #gc-preview{white-space:pre-wrap;overflow-wrap:anywhere}#gc-preview a{color:var(--ph);font-size:11px;letter-spacing:1px}#gc-preview .gc-message{margin-top:6px}
-      #gc-states{flex:0 0 auto;max-height:25%;overflow:auto;padding:0 12px 4px}
+      #gc-states{flex:0 0 auto;max-height:45%;overflow:auto;padding:0 12px 4px}
       .gc-state{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap;margin:4px 0 2px;padding:6px 11px;border-left:2px solid var(--ph);border-radius:0 4px 4px 0;background:linear-gradient(180deg,var(--ph-faint),rgba(0,0,0,.25));font-size:13px;letter-spacing:.5px;color:var(--ph-bright)}
       .gc-state .gc-dot{flex:0 0 auto;color:var(--ph);text-shadow:0 0 6px var(--ph-glow);animation:1s steps(1) infinite comms-blink}.gc-state .gc-verb{letter-spacing:1.5px;text-transform:uppercase}.gc-state .gc-what{color:var(--ph-dim);font-size:12px;min-width:0;overflow:hidden;text-overflow:ellipsis}
       .gc-state.hold{border-left-color:var(--gold);background:linear-gradient(180deg,color-mix(in srgb,var(--gold) 14%,transparent),rgba(0,0,0,.25))}.gc-state.hold .gc-dot,.gc-state.hold .gc-verb{color:var(--gold);animation:none;text-shadow:none}
       .gc-state.bad{border-left-color:var(--bad)}.gc-state.bad .gc-dot,.gc-state.bad .gc-verb{color:var(--bad);animation:none;text-shadow:none}
       .gc-state .gc-approval{flex:1 0 100%;font-size:12px;color:var(--text);opacity:.9;overflow-wrap:anywhere}.gc-state .bb{margin-left:auto!important;font-size:11px!important;min-height:20px!important;padding:0 6px!important}
```

**File**: `test/group-chat-picker.test.js` (modified, +2/-0)
```diff
@@ -16,6 +16,8 @@ class Element {
   append(...nodes) { for (const n of nodes) { const e = typeof n === 'string' ? Object.assign(new Element('#text'), { textContent: n }) : n; e.parentElement = this; this.children.push(e); } }
   replaceChildren(...nodes) { for (const e of this.children) e.parentElement = null; this.children = []; this.textContent = ''; this.append(...nodes); }
   before(node) { this.parentElement.append(node); }
+  insertBefore(node, ref) { node.remove(); const i = ref ? this.children.indexOf(ref) : -1; node.parentElement = this; if (i < 0) this.children.push(node); else this.children.splice(i, 0, node); return node; }
+  get lastElementChild() { return this.children[this.children.length - 1] || null; }
   remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(e => e !== this); this.parentElement = null; }
 }
 const walk = e => [e, ...e.children.flatMap(walk)];
```

---

### Incident Patch 9: `515eaade` (2026-10-04)
**Commit Message**: fix(group sessions): a group survives its crew changing, pauses honestly, and never dispatches to the wrong agent

From a read-only, adversarially verified sweep of group chat (10-04; 24 confirmed, 0 refuted). Backend half:
- A member deleted from the crew broke the group for good: every invite / rename / remove re-validated ALL members
  ("no longer in the roster"), @all and — when it led — every plain message failed "Participant no longer exists".
  Membership writes now validate only the agents being added (a departed member quietly leaves), @all and the default
  recipient use the members still on the crew, a departed lead hands over (the overseer first), and agent delete
  calls dropAgent so it leaves every group it sat in.
- "@RESEARCHER 2" dispatched a paid turn to RESEARCHER (handles stopped at the first space). An @name is now the
  LONGEST member name the text starts with (names may hold spaces); a crew agent outside the chat is named
  ("not in this chat yet"); an unknown handle says how to send it as text. Ambiguity still never guesses.
- A send to a paused group (E-STOP, restart, PAUSE) lifted the pause BEFORE the message was validated, then replayed
  the stopped queu

**File**: `sidecar/group-sessions.js` (modified, +116/-37)
```diff
@@ -49,6 +49,24 @@ function makeGroupSessions(d) {
     if (out.some(id => !live.has(id))) fail('A selected participant is no longer in the roster');
     return out;
   }
+  // A membership write on an EXISTING group: only the agents being ADDED must be on the crew. A member deleted from the
+  // crew since quietly leaves (it can never run again); it must not make every later invite/rename/remove fail.
+  function admit(existing, next) {
+    const live = new Set(roster().map(a => a.id)), had = new Set(existing);
+    return members((Array.isArray(next) ? next : []).map(identifier).filter(id => live.has(id) || !had.has(id)));
+  }
+  // who can still answer: the members that are on the crew, and a lead that is one of them
+  function liveMembers(g) { const live = new Set(roster().map(a => a.id)); return g.members.filter(id => live.has(id)); }
+  function liveLead(g) { const here = liveMembers(g); return here.includes(g.leadId) ? g.leadId : here.includes('agent') ? 'agent' : here[0]; }
+  // the turn the group's worker is executing right now (a live worker can be asked to stop; anything else just stops)
+  const workingTurn = new Map();
+  function stopTurn(g, t, reason) {
+    if (workingTurn.get(g.id) === t.id && controllers.has(g.id)) { t.state = 'stopping'; if (reason) t.reason = reason; return controllers.get(g.id); }
+    t.state = 'stopped'; t.reason = reason || 'Stopped'; delete t.approval; return null;
+  }
+  // A Commander upload belongs to the message that carries it. One no message links (the send that carried it was
+  // refused, or never went out) is not shared: agents don't see it in context and group.read refuses it.
+  function shared(g, a) { return !(a.agentId === 'user' && a.attachmentKey && !g.messages.some(m => (m.artifactIds || []).includes(a.id))); }
   function publicGroup(g) {
     const out = clone(g);
     for (const t of out.turns) if (drafts.has(t.id)) t.draft = drafts.get(t.id);
@@ -75,25 +93,28 @@ function makeGroupSessions(d) {
     const existing = read().groups[id];
     if (existing && sameConversion(existing)) return publicGroup(existing);
     if (existing) fail('Session already exists', 409);
-    // Snapshot every referenced file before committing the conversion. If any read fails,
-    // no group is created and the caller retains the original direct session unchanged.
+    // Snapshot every referenced file before committing the conversion. A file that can't be shared (over the 1 MiB
+    // group cap, deleted since, unreadable) no longer blocks the whole conversion forever: its message keeps a visible
+    // note naming the file and why, and nothing pretends the peers can read it.
     const imported = [], artifacts = [], files = new Map();
     for (const m of (Array.isArray(b.history) ? b.history : [])) {
-      const artifactIds = [];
+      const artifactIds = [], missing = [];
       if (m.attachments != null && !Array.isArray(m.attachments)) fail('Invalid historical attachments');
       for (const a of m.attachments || []) {
-        if (!a || typeof a.path !== 'string') fail('Historical attachment has no readable path');
+        if (!a || typeof a.path !== 'string') { missing.push('[attachment not shared: ' + text((a && a.name) || 'file', 160) + ' (no readable path)]'); continue; }
         const owner = identifier(b.originalAgentId || leadId);
         const key = owner + ':' + a.path;
         let artifact = files.get(key);
         if (!artifact) {
-          const file = await d.readFile(owner, a.path);
+          let file;
+          try { file = await d.readFile(owner, a.path); }
+          catch (e) { missing.push('[attachment not shared: ' + text(a.name || a.path, 160) + ' (' + (e.code === 'ENOENT' ? 'file no longer exists' : String(e.message || e).slice(0, 120)) + ')]'); continue; }
           artifact = { ...file, id: d.id(), name: text(a.name || file.name, 160), agentId: 'user', messageSeq: imported.length + 1, createdAt: d.now() };
           files.set(key, artifact); artifacts.push(artifact);
         }
         if (!artifactIds.includes(artifact.id)) artifactIds.push(artifact.id);
       }
-      imported.push({ source: m, artifactIds });
+      imported.push({ source: m, artifactIds, missing });
     }
     await store.update('all', s => {
       s = s || { groups: {}, templates: [] };
@@ -105,46 +126,60 @@ function makeGroupSessions(d) {
         questions: [], instructions: text(b.instructions, 8000), maxTurns: 6, revision: 1, paused: false,
         messages: [], turns: [], artifacts, ...(conversionKey ? { conversionKey, conversionFingerprint } : {}), createdAt: d.now(), updatedAt: d.now() };
       // Explicit direct-session conversion: preserve historical author labels as context only.
-      for (const { source: m, artifactIds } of imported) {
+      for (const { source: m, artifactIds, missing } of imported) {
+        let body = String(m.content || '') + (missing.length ? (m.content ? '\n' : '') + missing.join('\n') : '');
+       
```

**File**: `sidecar/index.js` (modified, +6/-1)
```diff
@@ -16894,6 +16894,9 @@ async function handleAgentDelete(req, res) {
       return keep;
     });
   } catch (e) { console.warn('[agent.delete] cron cleanup failed:', (e && e.message) || e); }
+  // GROUP CHATS: a deleted agent leaves every group it sat in (a lead hands over to who remains). Left on record it
+  // made every later invite/rename/@all — and every plain message, when it led — fail in that group.
+  try { await groupSessions.dropAgent(agentId); } catch (e) { console.warn('[agent.delete] group cleanup failed:', (e && e.message) || e); }
   // clear any live in-RAM per-agent proposal/study queues so a gone agent can't land a turn-in later.
   try {
     for (const [rid, b] of proposalsByRun) { if (b && b.agentId === agentId) proposalsByRun.delete(rid); }
@@ -22314,7 +22317,9 @@ function saveNightshiftHalt(next) {
   nightshiftState = next;
 }
 function handleHalt(req, res) {
-  if (typeof groupSessions !== 'undefined') groupSessions.halt().catch(e => console.warn('[groups] halt persistence failed:', e.message));
+  // a group-store fault must never skip the rest of the E-STOP (killAll, the durable stand-down stamps)
+  try { if (typeof groupSessions !== 'undefined') groupSessions.halt().catch(e => console.warn('[groups] halt persistence failed:', e.message)); }
+  catch (e) { console.warn('[groups] halt failed:', (e && e.message) || e); }
   const tgInflight = (telegram && telegram.hub && telegram.hub._internals) ? telegram.hub._internals.inflight : null;
   const dcInflight = (discord && discord.hub && discord.hub._internals) ? discord.hub._internals.inflight : null;
   // EVERY connected channel's hub, not just the two bespoke slots — a Slack/Matrix/Signal run must die on E-STOP too.
```

**File**: `test/fast.list` (modified, +1/-0)
```diff
@@ -7,6 +7,7 @@ test/group-message-attachments.test.js
 test/bay-name-legibility.test.js
 test/group-sessions.edge.test.js
 test/group-chat-picker.test.js
+test/group-sessions.repair.test.js
 test/contract.test.js
 test/events-contract.test.js
 test/clock-rng.test.js
```

**File**: `test/group-message-attachments.test.js` (modified, +6/-2)
```diff
@@ -60,8 +60,12 @@ const deps = { fs, path, root, now: () => ++sequence, id: () => 'id' + (++sequen
     assert.equal((await api.file(converted.id, aid)).content, 'cHJvb2Y=');
     assert.deepEqual(await api.create(request), converted, 'lost conversion response is safe to retry');
     await assert.rejects(api.create({ ...request, history: [...history, { role: 'user', content: 'new work after the first conversion' }] }), /already exists/, 'changed retry history cannot be silently ignored');
-    await assert.rejects(api.create({ ...request, id: 'bad-conversion', history: [{ role: 'user', content: 'keep me', attachments: [{ path: '.attachments/proof' }, { path: '.attachments/missing' }] }] }), /unavailable/);
-    await assert.rejects(api.get('bad-conversion'), /not found/, 'failed file import creates no partial group');
+    // (10-04) one unreadable/oversized old attachment used to block the conversion FOREVER ("START GROUP CHAT" never
+    // worked for that chat). Now the readable files are shared and the message names the one that was not, and why.
+    const partial = await api.create({ ...request, id: 'partial-conversion', conversionKey: 'partial-conversion', history: [{ role: 'user', content: 'keep me', attachments: [{ path: '.attachments/proof' }, { path: '.attachments/missing', name: 'gone.png' }] }] });
+    assert.equal(partial.artifacts.length, 1, 'the readable file is still shared');
+    assert.deepEqual(partial.messages[0].artifactIds, [partial.artifacts[0].id]);
+    assert.equal(partial.messages[0].content, 'keep me\n[attachment not shared: gone.png (File unavailable)]', 'the unshared file is named on its message, never silently dropped');
     api.close(); api = makeGroupSessions(deps); await api.ready;
     assert.equal((await api.file(converted.id, aid)).content, 'cHJvb2Y=', 'imported file bytes survive restart');
     assert.deepEqual((await api.create(request)).messages[0].artifactIds, [aid], 'conversion retry survives restart');
```

**File**: `test/group-sessions.repair.test.js` (added, +133/-0)
```diff
@@ -0,0 +1,133 @@
+'use strict';
+// Group chat repairs (10-04 sweep): multi-word @names, crew members who left, resuming a paused group, E-STOP on a bad
+// store, turns with no worker, orphaned uploads, and the station-wide list the rail reads. Real module, fake deps.
+const assert = require('node:assert/strict');
+const fs = require('node:fs');
+const os = require('node:os');
+const path = require('node:path');
+const { makeGroupSessions } = require('../sidecar/group-sessions.js');
+const root = fs.mkdtempSync(path.join(os.tmpdir(), 'group-repair-'));
+let sequence = 0, execute = null, crew;
+const seen = [];
+const deps = { fs, path, root, now: () => ++sequence, id: () => 'r' + (++sequence), log: () => {},
+  roster: () => crew,
+  execute: async o => { seen.push(o); o.emit('agent.run.start', { runId: o.runId }); return execute(o); },
+  readFile: async () => ({ name: 'f.md', content: 'aGk=', bytes: 2, hash: 'h' }),
+  decodeFile: f => ({ text: Buffer.from(f.content, 'base64').toString() }), uploadFile: (name, content) => ({ name, content, hash: 'h' + content.length }) };
+const finish = content => ({ reason: 'done', messages: [{ role: 'assistant', content }] });
+async function waitFor(fn) { for (let n = 0; n < 200; n++) { if (await fn()) return; await new Promise(r => setTimeout(r, 10)); } throw new Error('timed out'); }
+(async () => {
+  let api;
+  try {
+    crew = [{ id: 'agent', name: 'Lead' }, { id: 'researcher', name: 'RESEARCHER' }, { id: 'researcher-2', name: 'RESEARCHER 2' }, { id: 'engineer', name: 'SAM ALTMAN' }, { id: 'outside', name: 'Outsider' }];
+    api = makeGroupSessions(deps); await api.ready;
+    execute = async () => finish('ok');
+
+    // ---- an @name is the LONGEST member name the text starts with; names may hold spaces ----
+    const g = await api.create({ members: ['agent', 'researcher', 'researcher-2', 'engineer'] });
+    await api.send(g.id, { key: 'r2', text: '@RESEARCHER 2 please review' }); await api.idle(g.id);
+    assert.equal(seen.at(-1).t.agentId, 'researcher-2', '"@RESEARCHER 2" reaches RESEARCHER 2, never RESEARCHER');
+    await api.send(g.id, { key: 'r1', text: '@researcher take this' }); await api.idle(g.id);
+    assert.equal(seen.at(-1).t.agentId, 'researcher', 'a stable id still resolves');
+    await api.send(g.id, { key: 'r1b', text: 'and @RESEARCHER, you too' }); await api.idle(g.id);
+    assert.equal(seen.at(-1).t.agentId, 'researcher', 'a one-word name followed by punctuation resolves');
+    await api.send(g.id, { key: 'sam', text: 'hey @sam altman, numbers?' }); await api.idle(g.id);
+    assert.equal(seen.at(-1).t.agentId, 'engineer', 'a two-word name can be typed');
+    await assert.rejects(api.send(g.id, { key: 'out', text: '@Outsider weigh in' }), /Outsider is not in this chat yet/, 'a crew agent outside the chat is named, not guessed');
+    await assert.rejects(api.send(g.id, { key: 'typo', text: '@RESEARCHERX hi' }), /Unknown @RESEARCHERX[\s\S]*backticks/, 'an unknown handle says how to send it as text');
+    await api.send(g.id, { key: 'code', text: 'install `@types/node` please' }); await api.idle(g.id);
+    assert.equal(seen.at(-1).t.agentId, 'agent', 'a backticked @word is text and the lead answers');
+
+    // ---- a member who LEFT the crew no longer breaks the group ----
+    crew = crew.filter(a => a.id !== 'agent');   // the lead is gone from the roster (no dropAgent yet: the worst case)
+    const before = seen.length;
+    await api.send(g.id, { key: 'nolead', text: 'anyone there?' }); await api.idle(g.id);
+    assert.equal(seen.length, before + 1, 'an unaddressed message still runs');
+    assert.notEqual(seen.at(-1).t.agentId, 'agent', 'it goes to a member who is still on the crew');
+    await api.send(g.id, { key: 'all', text: '@all status' }); await api.idle(g.id);
+    assert.ok(!seen.slice(-3).some(o => o.t.agentId === 'agent'), '@all skips the member who left');
+    const invited = await api.invite(g.id, { agentId: 'outside' });
+    assert.ok(invited.members.includes('outside') && !invited.members.includes('agent'), 'invite works and the departed member quietly leaves');
+    assert.notEqual(invited.leadId, 'agent', 'a departed lead hands over to someone who remains');
+    const renamed = await api.configure(g.id, { revision: (await api.get(g.id)).revision, title: 'Renamed' });
+    assert.equal(renamed.title, 'Renamed', 'a rename works with a departed member on record');
+    await assert.rejects(api.invite(g.id, { agentId: 'ghost' }), /no longer in the roster/, 'only the agent being ADDED must be on the crew');
+    crew.push({ id: 'agent', name: 'Lead' });
+
+    // ---- dropAgent: deleting an agent from the crew removes it from every group, the lead hands over ----
+    const d1 = await api.create({ members: ['researcher', 'engineer'], leadId: 'researcher' });
+    const solo = await api.create({ members: ['researcher'] });
+    await api.dropAgent('researcher');
+    const d1after = await api.get(d1.id);
+
```

---

### Incident Patch 10: `965fc2f6` (2026-10-04)
**Commit Message**: fix(group chat): adding an agent saves at once, @ works from any chat, and a group looks like one

Andrew 10-04: group chats "dont seem to be working right" — you can't tell a group is there, it doesn't show all the
agents, you can't @ them, and an agent added then StarNet minimized is gone on return.

Root causes (proven live on a 26-agent crew, and in the 0.13.0 station's own store: no group created since 09-09):
- ADD AGENTS only STAGED: + ADD moved the row under IN THIS CHAT and saved nothing until START GROUP CHAT / SAVE,
  which sat ~110px below the window's edge with a real crew. Minimize or close = the add was never sent. Now + ADD
  and REMOVE write to /api/groups immediately (create on the first add, invite after, configure with a fresh
  revision + retry on 409 for a removal); IN THIS CHAT lists only what the backend confirmed; the footer (status +
  DONE) is sticky and the two lists share the window's height.
- @ only existed inside an existing group, with no keyboard: typing @ in a normal chat did nothing, and "@fi" + Enter
  failed "Unknown or ambiguous @fi". The @ menu now sits over the message box in every chat (arrows move, Enter/Tab
  pick, Esc closes, @all in a g

**File**: `frontend/app/app.js` (modified, +3/-1)
```diff
@@ -4045,7 +4045,7 @@ const App = (() => {
   function railModelFull(w) { return (w.lastModel || '').trim(); }
   function railRowLabel(w, st, project = false) {
     const title = w.title || 'General', name = railAgentName(w);
-    return title + ' session' + (name === title ? '' : ', ' + name) + (st.status ? ', ' + st.status : '')
+    return title + (w.conversationMode === 'group' ? ' group chat' : ' session') + (name === title ? '' : ', ' + name) + (st.status ? ', ' + st.status : '')
       + (Workstreams.unread(w) && !st.dot.includes('unseen') ? ', unread activity' : '')
       + (project ? '; Enter to open' : '; Enter to open; Shift+F10 for actions');
   }
@@ -4103,6 +4103,8 @@ const App = (() => {
       return groupHead + '<li class="' + rowClass(w, st, activeId) + '" data-id="' + U.esc(w.id) + '" tabindex="' + (w.id === railFocusId ? '0' : '-1') + '" role="option" aria-selected="' + (w.id === activeId ? 'true' : 'false') + '" aria-posinset="' + (index + 1) + '" aria-setsize="' + rows.length + '" aria-label="' + U.esc(railRowLabel(w, st)) + '" aria-keyshortcuts="Shift+F10" title="' + U.esc(tip) + '">' +
         '<span class="' + st.dot + '" aria-hidden="true"></span>' +
         (w.pinned ? '<span class="ws-pin" aria-hidden="true">★</span>' : '') +
+        // a group chat says so on the row itself: the COMPACT rail hides the agent line that names its members
+        (w.conversationMode === 'group' ? '<span class="ws-gc" aria-hidden="true">GROUP</span>' : '') +
         '<span class="ws-agent" aria-hidden="true"' + railAgentColorAttr(w) + '>' + U.esc(railAgentName(w)) + '</span>' +
         '<span class="ws-title">' + U.esc(title) + '</span>' +
         '<span class="ws-meta">' + U.esc(st.meta) + '</span>' +
```

**File**: `frontend/app/chat.js` (modified, +17/-1)
```diff
@@ -970,6 +970,8 @@ const Chat = (() => {
         if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeSlash(); return; }
         // any other key falls through to normal typing → the 'input' listener re-filters the palette
       }
+      // @ MENU (group-chat.js) owns ↑ ↓ Enter Tab Esc while it lists agents over the message box
+      if (typeof GroupChat !== 'undefined' && GroupChat.mentionKey && GroupChat.mentionKey(e)) return;
       // INPUT HISTORY — recall starts only from an EMPTY box (a draft in progress is never hijacked);
       // once recalling, ArrowUp/ArrowDown walk the sent list, ArrowDown past the newest restores the draft.
       if (e.key === 'ArrowUp' && sentHistory.length && (histIdx >= 0 || input.value === '')) {
@@ -1042,6 +1044,20 @@ const Chat = (() => {
       return;
     }
     if (t) recordSent(t);
+    // "@finn take a look" from a DIRECT chat reaches FINN: the chat becomes a group with them first (General stays
+    // General — a fresh group opens beside it), then the message goes to that group. A refusal (the agent here is
+    // still mid-run, the backend said no) keeps the words in the box and says why.
+    const pulled = activeWs && activeWs.conversationMode !== 'group' && t && typeof GroupChat !== 'undefined' && GroupChat.mentionTargets ? GroupChat.mentionTargets(t, activeWs) : [];
+    if (pulled.length) {
+      const g = await GroupChat.startWith(pulled);
+      const ws = g && Workstreams.get(g.id);
+      if (!ws || activeWs?.id !== ws.id) return;
+      if (hasStaged) await settleAttachments();
+      const atts = pendingAtts.filter(entry => entry.status === 'ready' && entry.ref).map(entry => entry.ref);
+      const sent = await GroupChat.sendText(t, { attachments: atts, attachmentAgent: ws.agentId });
+      if (sent && activeWs?.id === ws.id) { takeAttachments(); if (input.value.trim() === t) input.value = ''; closeSlash(); autoGrowInput(); }
+      return;
+    }
     if (activeWs?.conversationMode === 'group' && typeof GroupChat !== 'undefined') {
       const ws = activeWs;
       if (hasStaged) await settleAttachments();
@@ -9784,5 +9800,5 @@ const Chat = (() => {
   // only" gate maybeStandaloneRate uses — so a pure-chat run is never bottle-offered. Used by App.runBottleInfo (R5).
   function runDidWork(id) { const w = id ? runWork.get(id) : null; return !!(w && ((w.toolsOk || 0) >= 1 || (w.delivered || 0) >= 1)); }
 
-  return { init, load, send, continuityDiagnostics, refreshStarters, sendOrQueue, continueConnectorTask, stopActive, status, localLine, broadcast, renderProse, setSystem, getHistory, contextRef, abort, isBusy, beatBusy: skillBeatBusy, beginInterview, endInterview, echoUser, prefill, autoGrowInput, choices, clearChoices, retireDeskPrompt, typeLine, nudge, clearNudge, offerCuriosity, offerFork, planGoalPath, briefingReceipt, isComposerEngaged, canFocusSession, runMeta, runDidWork, awayDigest, awayReview, awayRate, sampleCard, workshopReturn, refreshIdBar: renderIdBar, refreshGroupControls: updateControls, refreshAgentIdentity, setRosterStatus, askBudgetSpent, spendAsk };
+  return { init, load, send, continuityDiagnostics, refreshStarters, sendOrQueue, continueConnectorTask, stopActive, status, localLine, broadcast, renderProse, setSystem, getHistory, contextRef, abort, isBusy, beatBusy: skillBeatBusy, beginInterview, endInterview, echoUser, prefill, autoGrowInput, choices, clearChoices, retireDeskPrompt, typeLine, nudge, clearNudge, offerCuriosity, offerFork, planGoalPath, briefingReceipt, isComposerEngaged, canFocusSession, runMeta, runDidWork, awayDigest, awayReview, awayRate, sampleCard, workshopReturn, refreshIdBar: renderIdBar, refreshGroupControls: updateControls, refreshAgentIdentity, setRosterStatus, askBudgetSpent, spendAsk, clockLabel: fmtClock, breakLabel: fmtBreak };
 })();
```

**File**: `frontend/app/group-chat.js` (modified, +340/-97)
```diff
@@ -4,6 +4,11 @@ const GroupChat = (() => {
   let active = null, group = null, root, timer, busy = false, replyTo = null, roster = [], selected = [];
   let generation = 0, lastPaint = '', notice = '', draftKey = null;
   let openedFileUrl = null, openedFile = null;
+  // the ADD AGENTS window: which session it edits, and its repaint (so a member who joins by @mention shows in it)
+  let pickerFor = null, pickerRepaint = null;
+  // the @ menu over the composer: its rows, the highlighted one, and the "@que" being typed
+  let mentionItems = [], mentionSel = 0, mentionCtx = null, mentionBusy = false;
+  let basePlaceholder = null;
   const composerDrafts = new Map();
   const sharedAttachments = new Map();
   const $ = id => document.getElementById(id);
@@ -15,7 +20,11 @@ const GroupChat = (() => {
     return e;
   };
   const button = (label, fn) => h('button', { type: 'button', class: 'bb', onclick: () => Promise.resolve().then(fn).catch(showError) }, label);
-  function showError(e) { notice = e.message || String(e); if ($('gc-notice')) $('gc-notice').textContent = notice; }
+  function showError(e) {
+    notice = e.message || String(e); if ($('gc-notice')) $('gc-notice').textContent = notice;
+    // a direct chat has no group notice line on screen: say it where the Commander is looking
+    if (active?.conversationMode !== 'group' && typeof StationUI !== 'undefined' && StationUI.notify) StationUI.notify(notice, 'bad');
+  }
   async function api(body, query = '') {
     const r = await fetch('/api/groups' + query, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { cache: 'no-store' });
     if (r.status === 401 || r.status === 403) throw new Error('Reconnect to this station by refreshing the page. Your conversation is saved.');
@@ -47,16 +56,41 @@ const GroupChat = (() => {
     }
     return ws;
   }
+  // the live crew: the station registry first (it is what CREW shows), the backend's roster as the fallback
+  function crew() {
+    const live = typeof App !== 'undefined' && App.agents ? (App.agents() || []) : [];
+    const list = live.length ? live : roster;
+    return list.filter(a => a && a.id).map(a => ({ id: a.id, name: String(a.name || a.id) }));
+  }
   function name(id) { return id === 'user' ? 'COMMANDER' : (roster.find(a => a.id === id)?.name || App.agents?.().find(a => a.id === id)?.name || id); }
   function colorOf(id) { const c = typeof App !== 'undefined' && App.agents ? App.agents().find(a => a.id === id)?.color : ''; return /^#[0-9a-f]{3,8}$/i.test(c || '') ? c : ''; }
-  function participantsHeader(element, ids, paused) {
-    element.replaceChildren(h('span', { class: 'gc-count' }, ids.length + (ids.length === 1 ? ' agent' : ' agents')));
-    /* One line, ellipsized — never a scrollbar. The count beside it says how many; the full list is
-       one hover (station tip) or one click (the picker) away. */
-    const people = h('button', { type: 'button', class: 'gc-people', title: ids.map(name).join(' · '), 'aria-label': 'Agents in this chat: ' + ids.map(name).join(', ') + '. Add or remove agents', onclick: () => picker(true) });
-    for (const id of ids) people.append(h('span', { class: 'gc-person' }, name(id)));
-    element.append(people);
+  /* The group header: a [ GROUP ] tag, then EVERY member by name in their roster colour (lead first), the count, and
+     the + key. Names wrap to a second line before anything is hidden; past two lines the rest fold into "+N", which
+     opens the full list (Andrew 10-04: "you cant even tell when the groupchat is there, it does not show all the agents"). */
+  function participantsHeader(element, ids, paused, leadId) {
+    const order = leadId && ids.includes(leadId) ? [leadId, ...ids.filter(id => id !== leadId)] : ids.slice();
+    const people = h('button', { type: 'button', class: 'gc-people', title: order.map(name).join(' · '), 'aria-label': 'Agents in this chat: ' + order.map(name).join(', ') + '. Add or remove agents', onclick: () => picker(true) });
+    for (const id of order) {
+      const p = h('span', { class: 'gc-person' + (id === leadId ? ' lead' : '') }, name(id));
+      const c = colorOf(id); if (c) p.style.color = c;
+      people.append(p);
+    }
+    const more = h('span', { class: 'gc-more', hidden: '' }); people.append(more);
+    element.replaceChildren(h('span', { class: 'gc-badge', 'aria-hidden': 'true' }, 'GROUP'), people, h('span', { class: 'gc-count' }, ids.length + (ids.length === 1 ? ' agent' : ' agents')));
     if (paused) element.append(h('small', {}, 'Paused'));
+    fitPeople(people);
+  }
+  // two lines of names at most: hide from the end until it fits, and say how many are folded away
+  function fitPeople(people) {
+    if (!people || typeof people.querySelectorAll !== 'function' || !people.isConnected) return;
+    const persons = [...people.querySelectorAll('.gc-person')], more = people.querySelector('.gc-more');
+    for (const p of per
```

**File**: `frontend/css/app.css` (modified, +6/-0)
```diff
@@ -3191,6 +3191,12 @@ body.rows-inbox #workstreams .ws-kebab { grid-area: meta; }
 .ws-arch-row.on { color: var(--ph); }
 /* pinned rows sort to the top AND carry a small gold star so the "kept" state is legible at a glance */
 .ws-pin { flex: 0 0 auto; font-size: 10px; line-height: 1; color: var(--gold); text-shadow: 0 0 6px rgba(var(--gold-rgb),.5); }
+/* a GROUP chat row says so before its title: the COMPACT row hides the agent line that names its members.
+   The INBOX row (a grid) already names every member on that line, so the tag stays out of its grid. */
+.ws-gc { flex: 0 0 auto; font-size: 10px; line-height: 1; letter-spacing: 1px; color: var(--ph); white-space: nowrap; text-shadow: var(--pg-glow-soft, none); }
+.ws-gc::before { content: '['; margin-right: 2px; opacity: .6; }
+.ws-gc::after { content: ']'; margin-left: 2px; opacity: .6; }
+body.rows-inbox #workstreams .ws-gc { display: none; }
 /* the ⋯ button is the discoverable twin of right-click: hidden until the row is hovered, where it takes the meta slot */
 .ws-kebab {
   display: none; flex: 0 0 auto; font-family: inherit; font-size: 15px; line-height: 1; letter-spacing: 1px;
```

**File**: `frontend/css/comms-convo.css` (modified, +78/-78)
```diff
@@ -4,7 +4,7 @@
 
    Loaded LAST (after pipglass.css) so it settles the transcript's reading layer in one place instead of adding a
    seventh tug-of-war between app / comms / interface / glass-comms / readability / beat-cards. Every rule is scoped
-   `body #chat-panel #chat-log …` (two ids) so it outranks the older class-heavy selectors by specificity, not by
+   `body #chat-panel :is(#chat-log, #gc-log) …` (two ids — the group transcript speaks the same language, Andrew 10-04) so it outranks the older class-heavy selectors by specificity, not by
    !important — the only !important here answers beat-cards' own !important on the broadcast block.
 
    The shape, top to bottom of one exchange:
@@ -23,175 +23,175 @@
    texture under text. Theme tokens only. */
 
 /* ---- rhythm: a new exchange opens with air, the answer sits close to its question ---- */
-body #chat-panel #chat-log { gap: 6px; }
-body #chat-panel #chat-log > .cmsg.user { margin-top: 12px; }
-body #chat-panel #chat-log > .cmsg-timebreak + .cmsg.user,
-body #chat-panel #chat-log > .cmsg.user:first-child { margin-top: 0; }
-body #chat-panel #chat-log > .cmsg.user + .cmsg.user { margin-top: 0; }
+body #chat-panel :is(#chat-log, #gc-log) { gap: 6px; }
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg.user { margin-top: 12px; }
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg-timebreak + .cmsg.user,
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg.user:first-child { margin-top: 0; }
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg.user + .cmsg.user { margin-top: 0; }
 
 /* ---- TIME BREAK — the day + clock where a conversation (re)starts ---- */
-body #chat-panel #chat-log > .cmsg-timebreak {
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg-timebreak {
   display: flex; align-items: center; gap: 10px;
   margin: 14px 2px 2px; flex: 0 0 auto;
 }
-body #chat-panel #chat-log > .cmsg-timebreak:first-child { margin-top: 2px; }
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg-timebreak:first-child { margin-top: 2px; }
 /* a Pip-Boy rule: a 1px line with a short END TICK dropping from each outer end */
-body #chat-panel #chat-log > .cmsg-timebreak::before,
-body #chat-panel #chat-log > .cmsg-timebreak::after {
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg-timebreak::before,
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg-timebreak::after {
   content: ""; flex: 1 1 auto; height: 4px; align-self: flex-start; margin-top: calc(.6em);
   border-top: 1px solid rgba(var(--ph-rgb), .28);
 }
-body #chat-panel #chat-log > .cmsg-timebreak::before { border-left: 1px solid rgba(var(--ph-rgb), .28); }
-body #chat-panel #chat-log > .cmsg-timebreak::after { border-right: 1px solid rgba(var(--ph-rgb), .28); }
-body #chat-panel #chat-log > .cmsg-timebreak .tb-when {
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg-timebreak::before { border-left: 1px solid rgba(var(--ph-rgb), .28); }
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg-timebreak::after { border-right: 1px solid rgba(var(--ph-rgb), .28); }
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg-timebreak .tb-when {
   flex: 0 0 auto; font-size: var(--sn-type-meta, 13px); letter-spacing: 1.2px; text-transform: uppercase;
   color: var(--ph); opacity: .72; white-space: nowrap; font-variant-numeric: tabular-nums;
   text-shadow: var(--pg-glow-soft, none);
 }
-body #chat-panel #chat-log > .cmsg-timebreak .tb-when::before { content: '[ '; opacity: .6; }
-body #chat-panel #chat-log > .cmsg-timebreak .tb-when::after { content: ' ]'; opacity: .6; }
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg-timebreak .tb-when::before { content: '[ '; opacity: .6; }
+body #chat-panel :is(#chat-log, #gc-log) > .cmsg-timebreak .tb-when::after { content: ' ]'; opacity: .6; }
 
 /* ---- STAMPS — always readable (they were hover-only: "hard to see when you sent things") ---- */
-body #chat-panel #chat-log .cmsg:is(.agent, .user) .cmsg-ts { opacity: .62; color: var(--text); }
-body #chat-panel #chat-log .cmsg:is(.agent, .user):is(:hover, :focus-within) .cmsg-ts { opacity: .9; }
+body #chat-panel :is(#chat-log, #gc-log) .cmsg:is(.agent, .user) .cmsg-ts { opacity: .62; color: var(--text); }
+body #chat-panel :is(#chat-log, #gc-log) .cmsg:is(.agent, .user):is(:hover, :focus-within) .cmsg-ts { opacity: .9; }
 /* a same-speaker follow-up stamped the same minute as the row above: one message, one stamp */
-body #chat-panel #chat-log .cmsg.ts-repeat:is(.agent, .user) > .cmsg-head { display: none; }
+body #chat-panel :is(#chat-log, #gc-log) .cmsg.ts-repeat:is(.agent, .user) > .cmsg-head { display: none; }
 
 /* callsigns read as station type: the same RGB-fringe phosphor the CREW names wear */
-body #chat-panel #chat-log .cmsg:is(.agent, .user) > .cmsg-head > .who { text-shadow: var(--pg-glow-soft, none); letter-spacing: 1.4px; }
+body #chat-panel :is(#chat-log, #gc-log) .cmsg:is(.agent, .user) > .cmsg-head > .who { text-shadow: var(--pg-glow-soft, none); letter-spacing: 1.4px; }
 
 /* ---- THE DITHER FIELD — both speakers' text s
```

**File**: `frontend/css/comms.css` (modified, +2/-2)
```diff
@@ -76,8 +76,8 @@
 .cmsg.user  + .cmsg.user  > .cmsg-head { display: flex; justify-content: flex-end; margin: 4px 0 0; min-height: 0; }
 .cmsg.agent + .cmsg.agent > .cmsg-head > .who,
 .cmsg.user  + .cmsg.user  > .cmsg-head > .who { display: none; }
-body.glass-demo #chat-log .cmsg.agent + .cmsg.agent > .cmsg-head,
-body.glass-demo #chat-log .cmsg.user  + .cmsg.user  > .cmsg-head { margin: 2px 0 2px; min-height: 0; }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg.agent + .cmsg.agent > .cmsg-head,
+body.glass-demo :is(#chat-log, #gc-log) .cmsg.user  + .cmsg.user  > .cmsg-head { margin: 2px 0 2px; min-height: 0; }
 
 /* agent transmission card: the existing left phosphor rail + a faint recessed fill and hairline inset,
    airy not boxy. Keeps the base padding-left so grouped bodies still align under the rail. SCOPED to
```

**File**: `frontend/css/glass-comms.css` (modified, +25/-25)
```diff
@@ -213,51 +213,51 @@ body.glass-demo :is(#model-dock,#chat-slash,.gd-agent-menu)[hidden] { display: n
 @starting-style { body.glass-demo :is(#model-dock,#chat-slash,.gd-agent-menu):not([hidden]) { opacity: 0; transform: translateY(7px); } }
 /* Conversation rows pick up the same glass highlight as CREW on inspection. */
 body.glass-demo #chat-log { padding: 10px 8px; gap: 7px; background: transparent; }
-body.glass-demo #chat-log .cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable):not(.reply),
-body.glass-demo #chat-log .cmsg.user {
+body.glass-demo :is(#chat-log, #gc-log) .cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable):not(.reply),
+body.glass-demo :is(#chat-log, #gc-log) .cmsg.user {
   padding: 7px 9px 8px; border: 1px solid transparent; border-radius: 3px;
   border-left-color: var(--gd-message-left,transparent); border-right-color: var(--gd-message-right,transparent);
   background: linear-gradient(130deg,rgba(var(--ph-rgb),.025),transparent 70%);
   box-shadow: none;
   transition: border-color var(--t-fast) var(--ease-soft), background-color var(--t-fast) var(--ease-soft);
 }
-body.glass-demo #chat-log .cmsg.agent { --gd-message-left: rgba(var(--ph-rgb),.22); }
-body.glass-demo #chat-log .cmsg.user { --gd-message-right: rgba(var(--gold-rgb),.35); max-width: 90%; }
-body.glass-demo #chat-log .cmsg:is(.agent,.user):not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable):not(.reply):is(:hover,:focus-within) {
+body.glass-demo :is(#chat-log, #gc-log) .cmsg.agent { --gd-message-left: rgba(var(--ph-rgb),.22); }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg.user { --gd-message-right: rgba(var(--gold-rgb),.35); max-width: 90%; }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg:is(.agent,.user):not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable):not(.reply):is(:hover,:focus-within) {
   border-color: var(--gd-edge); background: var(--gd-hover); box-shadow: inset 0 1px 0 var(--gd-light);
   border-left-color: var(--gd-message-left,var(--gd-edge)); border-right-color: var(--gd-message-right,var(--gd-edge));
 }
-body.glass-demo #chat-log .cmsg.user:is(:hover,:focus-within) { --gd-message-right: var(--gold); }
-body.glass-demo #chat-log .cmsg .cmsg-head { margin: 1px 0 6px; min-height: 18px; }
-body.glass-demo #chat-log .cmsg .who { font-size: 15px; line-height: 1.2; letter-spacing: .7px; }
-body.glass-demo #chat-log .cmsg .cmsg-ts { font-size: 11px; letter-spacing: .5px; }
-body.glass-demo #chat-log .cmsg.agent .who { color: var(--ph); }
-body.glass-demo #chat-log .cmsg.user .who { opacity: .9; margin-right: 0; }
-body.glass-demo #chat-log .cmsg .body { line-height: 1.45; overflow-wrap: anywhere; }
-body.glass-demo #chat-log .cmsg.agent.err { --gd-message-left: var(--bad); }
-body.glass-demo #chat-log .cmsg.agent.err .body { color: var(--text); }
-body.glass-demo #chat-log .cmsg.agent.err .who { color: var(--bad); }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg.user:is(:hover,:focus-within) { --gd-message-right: var(--gold); }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg .cmsg-head { margin: 1px 0 6px; min-height: 18px; }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg .who { font-size: 15px; line-height: 1.2; letter-spacing: .7px; }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg .cmsg-ts { font-size: 11px; letter-spacing: .5px; }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg.agent .who { color: var(--ph); }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg.user .who { opacity: .9; margin-right: 0; }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg .body { line-height: 1.45; overflow-wrap: anywhere; }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg.agent.err { --gd-message-left: var(--bad); }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg.agent.err .body { color: var(--text); }
+body.glass-demo :is(#chat-log, #gc-log) .cmsg.agent.err .who { color: var(--bad); }
 /* The existing clipboard result classes drive the icon; copying still owns its true state. */
-body.glass-demo #chat-log :is(.cmsg-copy,.md-copy) {
+body.glass-demo :is(#chat-log, #gc-log) :is(.cmsg-copy,.md-copy) {
   width: 26px; height: 24px; padding: 0; font-size: 0; line-height: 0;
   border: 1px solid var(--gd-edge); border-radius: 3px; color: var(--ph);
   background: var(--gd-face); box-shadow: inset 0 1px 0 var(--gd-light); text-shadow: none;
   transition: opacity var(--t-fast) var(--ease-soft), color var(--t-fast) var(--ease-soft), border-color var(--t-fast) var(--ease-soft);
 }
-body.glass-demo #chat-log .cmsg-copy { top: 5px; }
-body.glass-demo #chat-log :is(.cmsg-copy,.md-copy)::before {
+body.glass-demo :is(#chat-log, #gc-log) .cmsg-copy { top: 5px; }
+body.glass-demo :is(#chat-log, #gc-log) :is(.cmsg-copy,.md-copy)::before {
   content: ""; position: absolute; inset: 4px 5px; background: currentColor;
   mask: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2016%2016%22%3E%3Cpath%20d%3D%22M5.5%205.
```

**File**: `frontend/css/interface.css` (modified, +6/-6)
```diff
@@ -85,14 +85,14 @@ body {
 .comms-identity .comms-agent-select:hover { background: var(--ph-faint); border-color: var(--ui-edge); }
 .comms-identity .comms-agent-model { flex: none; text-align: left; font-size: 12px; opacity: 1; }
 #chat-log { padding: 6px 7px 12px; gap: 9px; box-shadow: var(--ui-well); background-color: rgba(0,0,0,.14); }
-#chat-log .cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable):not(.reply) {
+:is(#chat-log, #gc-log) .cmsg.agent:not(.tool):not(.consent):not(.turnin):not(.nudge):not(.deliverable):not(.reply) {
   padding-block: 5px 10px; background: linear-gradient(90deg, rgba(var(--ph-rgb), .04), transparent 85%);
 }
-#chat-log .cmsg.user { padding-block: 5px 10px; background: rgba(var(--gold-rgb), .035); }
-#chat-log .cmsg .who { font-size: 12px; letter-spacing: 1.5px; }
-#chat-log .cmsg.agent .who { color: var(--ph); }
-#chat-log .cmsg.user .who { opacity: .85; }
-#chat-log .cmsg .cmsg-ts { font-size: 11px; }
+:is(#chat-log, #gc-log) .cmsg.user { padding-block: 5px 10px; background: rgba(var(--gold-rgb), .035); }
+:is(#chat-log, #gc-log) .cmsg .who { font-size: 12px; letter-spacing: 1.5px; }
+:is(#chat-log, #gc-log) .cmsg.agent .who { color: var(--ph); }
+:is(#chat-log, #gc-log) .cmsg.user .who { opacity: .85; }
+:is(#chat-log, #gc-log) .cmsg .cmsg-ts { font-size: 11px; }
 #chat-panel #chat-inputrow {
   display: flex; flex-direction: column; align-items: stretch; gap: 9px;
   margin-top: 10px; padding: 11px; background: var(--panel2);
```

---

### Incident Patch 11: `4e4df0cf` (2026-10-04)
**Commit Message**: qa(claims): re-lock the release surface after the #57 dispatch-visibility fix

**File**: `qa/product-perfect/claims.json` (modified, +3/-3)
```diff
@@ -18,7 +18,7 @@
   "expectedClaimCount": 37,
   "releaseSurface": {
     "algorithm": "sha256",
-    "sourceCommit": "7be288d14168d71c4381ede742b1d35e2f2208b3",
+    "sourceCommit": "cd3920185bda8f32aa86914540a84e00ad03dc7e",
     "pathSetSha256": "fac5552f81f0dd00ab64856cfdfc9f107fcb0517a3ef0449f4018b13e983e609",
     "files": [
       {
@@ -1328,8 +1328,8 @@
       },
       {
         "path": "frontend/app/windows/logbook.js",
-        "bytes": 12636,
-        "sha256": "3281e8bdad42ea6b7a19388ae30d9c6b21712260ff1a018e77c2c4b39a49d4f3"
+        "bytes": 13198,
+        "sha256": "9d8b27bea140c1b918c5a07d9ce3047f2bd3955e345ed5baf6a0ae3fe561a436"
       },
       {
         "path": "frontend/app/windows/loops.js",
```

---

### Incident Patch 12: `cd392018` (2026-09-29)
**Commit Message**: fix(dispatch): a real team.dispatch can be verified, and the worker's Dossier shows it (#57)

team.subagents only lists background workers, so after a normal dispatch it
answered [] and a lead asked to verify concluded the worker never ran. It now
says what it can't see, and team.subagents {runId} checks a dispatched run
against the station's run history (scoped to the lead that delegated it).

Worker runs now record delegatedBy (additive). The Dossier RECORD tab kept a
tool-less delegated run in the CHAT-ONLY fold, out of sight; it now shows it up
front as 'delegated by <lead> · run <id>', matching the runId dispatch returned.

**File**: `frontend/app/windows/logbook.js` (modified, +7/-3)
```diff
@@ -24,7 +24,7 @@
     // #lb-insights) so a mid-fetch agent switch can't write into a sibling's list.
     const secLogbook =
       '<div class="sec"><span class="sec-l">RUNS</span><span class="sec-r"></span><span class="sec-nd"></span></div>' +
-      '<p class="sk-note">Real work by <b>' + esc(nm) + '</b>, newest first — runs that used tools, produced files, or failed. Chat-only replies are folded at the bottom.</p>' +
+      '<p class="sk-note">Real work by <b>' + esc(nm) + '</b>, newest first — runs that used tools, produced files, were delegated by another agent, or failed. Chat-only replies are folded at the bottom.</p>' +
       '<div id="lb-list" class="mc-list"><span class="loading pulse">loading…</span></div>' +
       '<div class="sec"><span class="sec-l">RUN ISSUES</span><span class="sec-r"></span><span class="sec-nd"></span></div>' +
       '<p class="sk-note">Review why a run ended without a result and what to try next.</p>' +
@@ -49,8 +49,10 @@
       // explicit ▸ toggle button for the transcript (keyboard-reachable), plus the whole row stays clickable —
       // but the row handler ignores clicks made while selecting text (so you can copy a title without collapsing).
       const txBtn = sid ? ' <button type="button" class="lb-tx-btn" aria-expanded="false" title="show / hide this run\'s transcript">▸ transcript</button>' : '';
+      // a delegated run names its lead and runId, so it can be matched to the runId the lead's team.dispatch reported.
+      const delegated = r.delegatedBy ? ' · ↳ delegated by ' + esc(r.delegatedBy) + ' · run ' + esc(String(r.runId || '').slice(0, 8)) : '';
       return '<div class="' + cls + '"' + attr + '><div class="mc-top"><b>' + title + '</b> <span class="dim">' + when + '</span>' + txBtn + '</div>' +
-        '<div class="mc-url dim">' + rl + ' · ' + model + ' · ' + (r.turns || 0) + ' turn' + (r.turns === 1 ? '' : 's') + '</div>' +
+        '<div class="mc-url dim">' + rl + ' · ' + model + ' · ' + (r.turns || 0) + ' turn' + (r.turns === 1 ? '' : 's') + delegated + '</div>' +
         (sid ? '<div class="lb-tx" hidden></div>' : '') + '</div>';
     }
     function insightsHtml(j) {
@@ -90,7 +92,9 @@
         // rows that bury the record that matters (away/cron runs, failures, real work). A row is CHATTER when the
         // run ended fine with ZERO successful tool calls and ZERO artifacts — provable from the row's own recorded
         // fields (toolsOk / artifacts), never a guess. Chatter folds behind an honest count; work renders up front.
-        const isChat = r => r.reason === 'done' && !(r.toolsOk > 0) && !(r.artifacts && r.artifacts.length);
+        // A DELEGATED run (delegatedBy: another agent's team.dispatch started it) is never chatter, even with no tools:
+        // it is assigned work, and folding it made a real dispatch look like it never reached this agent (#57).
+        const isChat = r => r.reason === 'done' && !r.delegatedBy && !(r.toolsOk > 0) && !(r.artifacts && r.artifacts.length);
         const work = runs.filter(r => !isChat(r));
         const chatter = runs.filter(isChat);
         const foldLabel = open => (open ? '▾ ' : '▸ ') + chatter.length + ' CHAT-ONLY ' + (chatter.length === 1 ? 'REPLY' : 'REPLIES') + ' — no tools, no files';
```

**File**: `sidecar/index.js` (modified, +2/-1)
```diff
@@ -18664,6 +18664,7 @@ async function runOnceCore(o) {
   // THIS SAME runOnce per worker; the roster supplies each worker's composed identity (system prompt + model).
   makeOrchestrationTools({
     runOnce, roster: () => agentRoster, key: runKey, model, provider: providerId, baseUrl, reasoningEffort, subagents,
+    runRecord: (id) => runStore.latest(id),   // team.subagents {runId}: verify a foreground dispatch against run history (#57)
     coordinateResults: require('./overseer.js').isCoordinatorRun({ ...o, agentId, surface }),
     classes: SPECIALIST_CLASSES,   // Class Loadouts S1: the summon-tool class list, composed from the shared catalog (no hardcoded prose)
     selfSystem: system,   // team.spawn clones the LEAD's OWN base identity into each ephemeral subagent (Meeseeks)
@@ -20947,7 +20948,7 @@ async function runOnceCore(o) {
         }
       }
       const runEndedAt = Date.now();
-      runStore.record({ runId, parentRunId: o.parentRunId || '', agentId, provider: activeProviderId, reason: ((result && result.reason) || 'done'), clarifying: taskQuestionAsked, turns: finalTurns, tokens: finalTokens, usd: finalUsd, title: title, streamId: o.streamId || '', sessionTitle: o.sessionTitle || '', deliveryPrompt: o.syntheticTrigger ? '' : (o.sessionPrompt || ''), deliveryText, recipeId: o.recipeId || '', projectRoot: o.projectRoot || '', deliverable: deliverableNotes.take(runId), model: finalModel, reasoningEffort, unmetered: runUnmetered && mediaUsd === 0, artifacts: execution.artifactList(), toolsOk: execution.toolsOk(), toolTrace: execution.toolTraceList(), failureStage: execution.failureStage(), failureCode: execution.failureCode(), uncertainMutations: execution.uncertainMutations(), completionEvidence: finalCompletionEvidence, recoveryAttempts: execution.recoveryAttempts(), startedAt: runStartedAt, endedAt: runEndedAt, durationMs: runEndedAt - runStartedAt, identityFallback, internal, surface, recoveryOf: o.recovery ? String(o.recovery.sourceRunId || '') : '', handoffEdited: o.handoffEdited === true, stepTest: o.stepTest === true, lineId: o.lineId || '', dockId: o.dockId || '', cronJobId: trigger === 'schedule' ? String(o.cronJobId || '') : '', taintedBy: execution.taintedBy() || '' });   // execution terminal stays separate from the neutral Task Brief outcome used by progression; recoveryOf links a continuation to the interrupted run it resumed
+      runStore.record({ runId, parentRunId: o.parentRunId || '', delegatedBy: o.delegatedBy || '', agentId, provider: activeProviderId, reason: ((result && result.reason) || 'done'), clarifying: taskQuestionAsked, turns: finalTurns, tokens: finalTokens, usd: finalUsd, title: title, streamId: o.streamId || '', sessionTitle: o.sessionTitle || '', deliveryPrompt: o.syntheticTrigger ? '' : (o.sessionPrompt || ''), deliveryText, recipeId: o.recipeId || '', projectRoot: o.projectRoot || '', deliverable: deliverableNotes.take(runId), model: finalModel, reasoningEffort, unmetered: runUnmetered && mediaUsd === 0, artifacts: execution.artifactList(), toolsOk: execution.toolsOk(), toolTrace: execution.toolTraceList(), failureStage: execution.failureStage(), failureCode: execution.failureCode(), uncertainMutations: execution.uncertainMutations(), completionEvidence: finalCompletionEvidence, recoveryAttempts: execution.recoveryAttempts(), startedAt: runStartedAt, endedAt: runEndedAt, durationMs: runEndedAt - runStartedAt, identityFallback, internal, surface, recoveryOf: o.recovery ? String(o.recovery.sourceRunId || '') : '', handoffEdited: o.handoffEdited === true, stepTest: o.stepTest === true, lineId: o.lineId || '', dockId: o.dockId || '', cronJobId: trigger === 'schedule' ? String(o.cronJobId || '') : '', taintedBy: execution.taintedBy() || '' });   // execution terminal stays separate from the neutral Task Brief outcome used by progression; recoveryOf links a continuation to the interrupted run it resumed
 
       // P0.1/H1.1: persist the full DIALOGUE (not just the outcome) — a durable server-side transcript for EVERY
       // run, incl. headless ones (cron/Telegram/delegated). Append the triggering user directive, then EVERY new
```

**File**: `sidecar/runstore.js` (modified, +4/-0)
```diff
@@ -286,6 +286,10 @@
         // other row stays byte-identical.
         ...(ID_RE.test(str(e.lineId)) ? { lineId: str(e.lineId) } : {}),
         ...(ID_RE.test(str(e.dockId)) ? { dockId: str(e.dockId) } : {}),
+        // DELEGATION (additive, #57): the LEAD agentId whose team.dispatch/spawn/resume started this worker run. Set only by
+        // orchestration — parentRunId alone also links overseer reviews and connector continuations, which are not
+        // delegated work. Present only when set, so every other row stays byte-identical.
+        ...(ID_RE.test(str(e.delegatedBy)) ? { delegatedBy: str(e.delegatedBy) } : {}),
         toolTrace: toolTraceList(e.toolTrace),
         failureStage: str(e.failureStage).trim().slice(0, FAILURE_FIELD_MAX),
         failureCode: str(e.failureCode).trim().slice(0, FAILURE_FIELD_MAX),
```

**File**: `sidecar/tools/builtin/orchestration.js` (modified, +45/-9)
```diff
@@ -346,6 +346,10 @@
     const baseUrl = deps.baseUrl || deps.base_url || '';
     const reasoningEffort = deps.reasoningEffort || 'medium';
     const subagents = deps.subagents || null;
+    /* runRecord(runId) -> the station's durable run-history row, or null (host injects runStore.latest). It is how a
+       lead VERIFIES a foreground team.dispatch: that path never enters the background registry, so team.subagents
+       used to answer [] for real, recorded worker runs and the lead reported them as never having happened (#57). */
+    const runRecord = (typeof deps.runRecord === 'function') ? deps.runRecord : null;
     // the LEAD's OWN base identity (system prompt), threaded from the run host so team.spawn can clone it. Empty
     // string when absent → a spawned subagent still runs, just without an inherited persona.
     const selfSystem = (typeof deps.selfSystem === 'string') ? deps.selfSystem : '';
@@ -673,7 +677,7 @@
               emit: o2.emit || childEmit,      // lifecycle/cost ride the lead/global stream -> the floor lights the worker
               signal: ac ? ac.signal : parentSignal,   // own controller when this worker has a wall clock (see above)
               runId: workerRunId, trigger: 'directive', surface: 'autonomous',
-              parentRunId: ctx && ctx.runId,
+              parentRunId: ctx && ctx.runId, delegatedBy: (ctx && ctx.agentId) || '',
               // SESSION TARGETING: the run host files a run under its streamId (runStore.record + the durable
               // transcript) and scopes its working memory to that stream. Absent -> undefined, byte-identical to
               // the pre-2026-07-30 call. This is the DURABLE half; deliverToSession is the visible one.
@@ -722,7 +726,7 @@
                 { role: 'user', content: '[STRUCTURED RESULT REPAIR] The prior result failed host validation:\n- ' + errors.slice(0, 20).join('\n- ') + '\nReturn ONLY strict JSON matching: ' + JSON.stringify(job.resultSchema) }],
               agentId: job.agentId, isTask: true, emit: o2.emit || childEmit,
               signal: ac ? ac.signal : parentSignal, runId: repairRunId, trigger: 'directive', surface: 'autonomous',
-              parentRunId: ctx && ctx.runId, streamId: job.streamId || undefined,
+              parentRunId: ctx && ctx.runId, delegatedBy: (ctx && ctx.agentId) || '', streamId: job.streamId || undefined,
               sessionTitle: job.streamId ? (job.sessionTitle || job.session || '') : undefined,
               consent: ctx && ctx.consent, extraObjects: WORKER_KIT,
               maxCostUsd: perWorker > 0 ? remaining : 0,
@@ -935,7 +939,7 @@
                 agentId: ephemeralId, isTask: true,
                 emit: (n, p) => { try { h.emit(n, p); } catch (_) {} childEmit(n, p); },   // durable record + lead stream
                 signal: h.signal, runId: h.runId,
-                parentRunId: ctx && ctx.runId,
+                parentRunId: ctx && ctx.runId, delegatedBy: (ctx && ctx.agentId) || '',
                 trigger: 'directive', surface: 'autonomous',
                 consent: ctx && ctx.consent,                // same approval posture as the orchestrator
                 extraObjects: WORKER_KIT,                   // WORKBENCH only — NO 'lead' → no orchestrator object →
@@ -977,7 +981,7 @@
                   { role: 'user', content: '[STRUCTURED RESULT REPAIR] The prior result failed host validation:\n- ' + errors.slice(0, 20).join('\n- ') + '\nReturn ONLY strict JSON matching: ' + JSON.stringify(task.resultSchema) }],
                 agentId: ephemeralId, isTask: true,
                 emit: (n, p) => { try { h.emit(n, p); } catch (_) {} childEmit(n, p); },
-                signal: h.signal, runId: repairRunId, parentRunId: ctx && ctx.runId,
+                signal: h.signal, runId: repairRunId, parentRunId: ctx && ctx.runId, delegatedBy: (ctx && ctx.agentId) || '',
                 trigger: 'directive', surface: 'autonomous', consent: ctx && ctx.consent,
                 extraObjects: WORKER_KIT, maxCostUsd: perWorker > 0 ? remaining : 0,
                 maxIters: lowerPositive(4, bounded ? lowerPositive(workerMaxIters, bounded.workerMaxIters) : workerMaxIters),
@@ -1077,19 +1081,51 @@
       }
     };
 
+    /* VERIFY A DELEGATED RUN (#57). The answer comes from the durable run history the Dossier RECORD reads, never from
+       the dispatch's own account of itself. Scoped to THIS lead: the run must have been dispatched by this lead's
+       current run, or by an earlier run recorded under this lead's agentId. A dispatch still in flight is recorded
+       when its worker ends, so "not found" says that instead of implying the work never happened. */
+    function verifyDelegatedRun(runId, leadId, ctx) {
+      if (!runRecord) return { content: 'The station\'s run history is not reachable from this run, so run ' + runId + ' cannot be checked here.', summary: 'unavailable' };
+      const read = (id) => { try { return runRecord(id) || null; } 
```

**File**: `test/e2e.dispatch-session.test.js` (modified, +1/-0)
```diff
@@ -214,6 +214,7 @@ await run('targeted',
     A.ok(workerRun, label + ": the worker's run is in the run ledger");
     A.eq(workerRun.streamId, 'ws_r1', label + ': and the ledger files it under the named session — not the lead\'s');
     A.eq(workerRun.runId, delivered[0].args.runId, label + ': the delivered runId is the SAME run the ledger recorded');
+    A.eq(workerRun.delegatedBy, 'agent', label + ': the ledger names the lead that delegated it (the Dossier RECORD keeps it out of the chat fold, #57)');
     A.eq(workerRun.sessionTitle, 'research', label + ': the stable target title is durable for cross-page recovery');
     A.eq(workerRun.deliveryPrompt, 'summarise the moons of Mars', label + ': the delegated instruction is durable');
     A.eq(workerRun.deliveryText, WORKER_TEXT, label + ': the finished answer is durable when no page can receive it');
```

**File**: `test/orchestration.test.js` (modified, +46/-0)
```diff
@@ -1096,6 +1096,52 @@ const leadCtx = () => ({ agentId: 'agent', emit: () => {} });
   await dispatchTool.run({workers:[{agentId:'researcher',prompt:'Prepare the draft'}]}, {agentId:'lead',emit:()=>{},consent:{}});
   A.ok(ro.calls[0].system.includes(understanding),'worker receives the latest in-turn understanding at dispatch');
 }
+
+// ---- #57: a FOREGROUND dispatch is real but never in the background list — team.subagents must say so, and a runId
+//      must be checkable against the durable run history (the same rows the Dossier RECORD reads) ----
+{
+  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-orch-57-'));
+  try {
+    const subagents = makeSubagentManager({ fs, pathMod: path, file: path.join(root, 'subagents.json'), clock: { now: () => 1000 }, emit: () => {}, newId: counter() });
+    const history = new Map();   // stand-in for runStore.latest: the host records every worker run at run end
+    const ro = fakeRunOnce(async (o) => {
+      history.set(o.runId, { runId: o.runId, agentId: o.agentId, parentRunId: o.parentRunId || '', delegatedBy: o.delegatedBy || '', reason: 'done', model: 'x-ai/grok-4.6', usd: 0.02, durationMs: 4200, toolsOk: 0 });
+      return { reason: 'done', messages: [{ role: 'assistant', content: 'banana47' }], usd: 0.02, durationMs: 4200 };
+    });
+    const roster = new Map([['strategist-2', { system: 'S' }]]);
+    const { dispatchTool, subagentsTool } = makeOrchestrationTools({ runOnce: ro, roster: () => roster, key: 'k', model: 'm', newId: counter(), subagents, runRecord: id => history.get(id) || null });
+    const ctx = { agentId: 'strategist', runId: 'lead_run_1', emit: () => {} };
+    const row = JSON.parse((await dispatchTool.run({ workers: [{ agentId: 'strategist-2', prompt: "reply with exactly 'banana47'" }] }, ctx)).content)[0];
+    A.eq(ro.calls[0].delegatedBy, 'strategist', 'a worker run is stamped with the lead that delegated it (run history + Dossier read this)');
+    A.eq(row.result, 'banana47', 'the foreground dispatch returned the worker\'s real text');
+
+    const listed = await subagentsTool.run({ agentId: 'strategist-2' }, ctx);
+    A.ok(/only tracks BACKGROUND/.test(listed.content) && /runId/.test(listed.content), 'an empty team.subagents says it cannot see foreground dispatches and how to verify one');
+    A.ok(listed.content.trim() !== '[]', 'an empty list is never a bare [] a lead can read as "nothing ran"');
+
+    const verified = await subagentsTool.run({ runId: row.runId }, ctx);
+    const rec = JSON.parse(verified.content);
+    A.ok(rec.recorded === true && rec.agentId === 'strategist-2' && rec.runId === row.runId, 'team.subagents {runId} confirms the dispatched run from run history');
+    A.eq(rec.delegatedBy, 'strategist', 'the confirmation names who delegated it');
+
+    // a later lead run (e.g. the next Telegram message) can still verify it — the row carries delegatedBy
+    const later = JSON.parse((await subagentsTool.run({ runId: row.runId }, { agentId: 'strategist', runId: 'lead_run_2', emit: () => {} })).content);
+    A.eq(later.recorded, true, 'a later run of the same lead can still verify its earlier dispatch');
+
+    const stranger = await subagentsTool.run({ runId: row.runId }, { agentId: 'someone-else', runId: 'other_run', emit: () => {} });
+    A.eq(stranger.summary, 'not found', 'another lead cannot read this lead\'s delegated run');
+    const missing = await subagentsTool.run({ runId: 'never_ran' }, ctx);
+    A.eq(missing.summary, 'not found', 'an unknown runId is reported as not found, never as success');
+
+    // rows written before delegatedBy existed fall back to the parent run's owner
+    history.set('legacy_worker', { runId: 'legacy_worker', agentId: 'strategist-2', parentRunId: 'legacy_lead', reason: 'done' });
+    history.set('legacy_lead', { runId: 'legacy_lead', agentId: 'strategist', reason: 'done' });
+    A.eq(JSON.parse((await subagentsTool.run({ runId: 'legacy_worker' }, ctx)).content).recorded, true, 'a pre-delegatedBy row verifies through its parent run\'s owner');
+
+    const noHistory = makeOrchestrationTools({ runOnce: ro, roster: () => roster, key: 'k', model: 'm', newId: counter(), subagents }).subagentsTool;
+    A.eq((await noHistory.run({ runId: row.runId }, ctx)).summary, 'unavailable', 'without a run-history reader the lookup says so instead of guessing');
+  } finally { try { fs.rmSync(root, { recursive: true, force: true }); } catch (_) {} }
+}
 A.report('orchestration.test');
 
 })();
```

**File**: `test/runstore.test.js` (modified, +13/-0)
```diff
@@ -316,4 +316,17 @@ const clock = { now: () => clk };
   A.ok(!('cronJobId' in s.record({ runId: 'i1' })), 'a non-scheduled run has no cronJobId key');
 }
 
+// ---- #57: delegatedBy (additive) — who delegated a worker run; absent on every other row, survives a replay ----
+{
+  const io = memIo();
+  let s = makeRunStore({ io, clock });
+  const w = s.record({ runId: 'w1', parentRunId: 'lead1', delegatedBy: 'strategist', agentId: 'strategist-2', reason: 'done' });
+  A.eq(w.delegatedBy, 'strategist', 'a worker row records the lead that delegated it');
+  const plain = s.record({ runId: 'c1', parentRunId: 'w1', agentId: 'strategist', reason: 'done' });
+  A.ok(!('delegatedBy' in plain), 'a row without a delegator keeps its old shape (no empty field)');
+  A.ok(!('delegatedBy' in s.record({ runId: 'x1', delegatedBy: 'bad id!', reason: 'done' })), 'a malformed delegator id is dropped');
+  s = makeRunStore({ io, clock });
+  A.eq(s.latest('w1').delegatedBy, 'strategist', 'delegatedBy survives a replay from disk');
+}
+
 A.report('runstore.test');
```

**File**: `website/app/app/windows/logbook.js` (modified, +7/-3)
```diff
@@ -24,7 +24,7 @@
     // #lb-insights) so a mid-fetch agent switch can't write into a sibling's list.
     const secLogbook =
       '<div class="sec"><span class="sec-l">RUNS</span><span class="sec-r"></span><span class="sec-nd"></span></div>' +
-      '<p class="sk-note">Real work by <b>' + esc(nm) + '</b>, newest first — runs that used tools, produced files, or failed. Chat-only replies are folded at the bottom.</p>' +
+      '<p class="sk-note">Real work by <b>' + esc(nm) + '</b>, newest first — runs that used tools, produced files, were delegated by another agent, or failed. Chat-only replies are folded at the bottom.</p>' +
       '<div id="lb-list" class="mc-list"><span class="loading pulse">loading…</span></div>' +
       '<div class="sec"><span class="sec-l">RUN ISSUES</span><span class="sec-r"></span><span class="sec-nd"></span></div>' +
       '<p class="sk-note">Review why a run ended without a result and what to try next.</p>' +
@@ -49,8 +49,10 @@
       // explicit ▸ toggle button for the transcript (keyboard-reachable), plus the whole row stays clickable —
       // but the row handler ignores clicks made while selecting text (so you can copy a title without collapsing).
       const txBtn = sid ? ' <button type="button" class="lb-tx-btn" aria-expanded="false" title="show / hide this run\'s transcript">▸ transcript</button>' : '';
+      // a delegated run names its lead and runId, so it can be matched to the runId the lead's team.dispatch reported.
+      const delegated = r.delegatedBy ? ' · ↳ delegated by ' + esc(r.delegatedBy) + ' · run ' + esc(String(r.runId || '').slice(0, 8)) : '';
       return '<div class="' + cls + '"' + attr + '><div class="mc-top"><b>' + title + '</b> <span class="dim">' + when + '</span>' + txBtn + '</div>' +
-        '<div class="mc-url dim">' + rl + ' · ' + model + ' · ' + (r.turns || 0) + ' turn' + (r.turns === 1 ? '' : 's') + '</div>' +
+        '<div class="mc-url dim">' + rl + ' · ' + model + ' · ' + (r.turns || 0) + ' turn' + (r.turns === 1 ? '' : 's') + delegated + '</div>' +
         (sid ? '<div class="lb-tx" hidden></div>' : '') + '</div>';
     }
     function insightsHtml(j) {
@@ -90,7 +92,9 @@
         // rows that bury the record that matters (away/cron runs, failures, real work). A row is CHATTER when the
         // run ended fine with ZERO successful tool calls and ZERO artifacts — provable from the row's own recorded
         // fields (toolsOk / artifacts), never a guess. Chatter folds behind an honest count; work renders up front.
-        const isChat = r => r.reason === 'done' && !(r.toolsOk > 0) && !(r.artifacts && r.artifacts.length);
+        // A DELEGATED run (delegatedBy: another agent's team.dispatch started it) is never chatter, even with no tools:
+        // it is assigned work, and folding it made a real dispatch look like it never reached this agent (#57).
+        const isChat = r => r.reason === 'done' && !r.delegatedBy && !(r.toolsOk > 0) && !(r.artifacts && r.artifacts.length);
         const work = runs.filter(r => !isChat(r));
         const chatter = runs.filter(isChat);
         const foldLabel = open => (open ? '▾ ' : '▸ ') + chatter.length + ' CHAT-ONLY ' + (chatter.length === 1 ? 'REPLY' : 'REPLIES') + ' — no tools, no files';
```

---

### Incident Patch 13: `e34aefad` (2026-10-02)
**Commit Message**: fix: respect spending caps in standalone quest refresh

**File**: `sidecar/index.js` (modified, +13/-0)
```diff
@@ -8986,6 +8986,19 @@ async function runQuestRefreshCycle(why) {
       questRefreshNote({ outcome: 'skipped', reason: 'not enough is known yet (empty dossier, no goal, no activity) — the refresh waits for the station to learn more' });
       return;
     }
+    // Standalone auxiliary calls bypass runAgentLoop, so enforce its cross-run spending boundary here too.
+    // A manual refresh changes the cadence, not the spending authority; only an explicit budget resume does.
+    if (!((getProviderProfile(providerId) || {}).unmetered)) {
+      let blocked;
+      try { blocked = budget.check(null, 'station', 0, Date.now(), null); }
+      catch (_) { blocked = { unknown: true }; }
+      if (blocked) {
+        questRefreshNote({ outcome: 'skipped', reason: blocked.unknown
+          ? 'spend history is unavailable — restore accounting before refreshing quests'
+          : 'spending cap reached (' + blocked.scope + ') — resume spending or raise the cap before refreshing quests' });
+        return;
+      }
+    }
     // evidence exists → NOW pay for the provider (codex token fetch is a network hop; never spend it on a cold save).
     let provider = extraAccountProviderFor(providerId, baseUrl);   // subscription stacking: first live sign-in
     if (provider) { /* an extra sign-in carries the refresh */ }
```

**File**: `test/questrefresh.e2e.test.js` (modified, +34/-0)
```diff
@@ -113,6 +113,40 @@ const QUIET = { SKYNET_THREAD_MINE: '0', SKYNET_SKILL_REVIEW: '0', SKYNET_SKILL_
 const CRED = { SKYNET_OPENROUTER_KEY: 'sk-or-v1-questrefresh-fake', SKYNET_DEFAULT_MODEL: 'test/model' };
 
 (async () => {
+  // Automatic and manual auxiliary work share the station's persisted spending pools.
+  for (const scope of ['day', 'global', 'unknown']) {
+    const mock = await startMock('NONE');
+    const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'sk-qrefresh-budget-'));
+    seedEvidence(ws); seedAutonomy(ws, 'propose');
+    fs.writeFileSync(path.join(ws, 'ledger.jsonl'), scope === 'unknown' ? 'not valid ledger JSON\n'
+      : JSON.stringify({ runId: 'spent', agentId: 'station', usd: 1.25, turns: 1, tokens: 10, model: 'fixture', ts: Date.now() }) + '\n');
+    let child = null;
+    try {
+      const up = await boot(9280 + (process.pid % 10), Object.assign({}, CRED, QUIET, {
+        SKYNET_WORKSPACES: ws, SKYNET_OPENROUTER_BASE: mock.base,
+        SKYNET_BUDGET_PER_DAY: scope !== 'global' ? '1' : '0', SKYNET_BUDGET_GLOBAL: scope === 'global' ? '1' : '0'
+      }), 20); child = up.child;
+      const base = 'http://' + HOST + ':' + up.port, token = await bootToken(base, base);
+      const headers = { Origin: base, 'X-StarNet-Token': token, 'Content-Type': 'application/json' };
+      const post = async (route, body) => (await fetch(base + route, { method: 'POST', headers, body: JSON.stringify(body || {}) })).json();
+      const first = await pollRefresh(base, token, s => !s.inFlight && s.ledger.length > 0, 'budget boot decision');
+      A.eq(mock.calls.quest, 0, scope + ': boot refresh does not buy a request');
+      A.ok(first.ledger.some(e => e.outcome === 'skipped' && /spend|budget/i.test(e.reason)), scope + ': visible spending stand-down');
+      await post('/api/quests/refresh/run');
+      await pollRefresh(base, token, s => !s.inFlight && s.ledger.length > first.ledger.length, 'manual budget decision');
+      A.eq(mock.calls.quest, 0, scope + ': manual refresh is not a budget resume');
+      if (scope !== 'unknown') {
+        await post('/api/budget/resume', { scope });
+        await post('/api/quests/refresh/run');
+        await pollRefresh(base, token, s => !s.inFlight && s.ledger.some(e => e.outcome === 'none'), 'resumed refresh');
+        A.eq(mock.calls.quest, 1, scope + ': explicit budget resume restores the request');
+      }
+    } finally {
+      if (child) { child.kill(); await new Promise(resolve => child.once('exit', resolve)); }
+      await new Promise(resolve => mock.server.close(resolve));
+      fs.rmSync(ws, { recursive: true, force: true });
+    }
+  }
   /* ===== RESTART WAIT: no background provider call or quest mutation; manual refresh survives ===== */
   {
     const mock = await startMock([
```

---

### Incident Patch 14: `2b8b1fa4` (2026-10-02)
**Commit Message**: fix: enforce spending limits before recovery attempts

**File**: `sidecar/loop.js` (modified, +26/-15)
```diff
@@ -1475,6 +1475,27 @@
     }
 
     emit('agent.run.start', { agentId, runId, trigger, model });
+    // Reconcile each attempt before enforcing the same spending limits again. Retries and
+    // post-compaction calls are paid work too, even when the turn counter does not advance.
+    function stopForSpend() {
+      if (spentUsd >= maxCostUsd) return end('budget', { budgetScope: 'run', budgetCapUsd: maxCostUsd });   // per-RUN hard ceiling
+      // per-RUN token ceiling for turns nothing could price (the $ ceiling above is blind to them — see maxUnpricedTokens)
+      if (unpricedTokens >= maxUnpricedTokens) {
+        return end('budget', { budgetScope: 'run', unpricedModel: unpricedModel || model, unpricedTokens, unpricedCapTokens: maxUnpricedTokens });
+      }
+      // CROSS-RUN BUDGET: day/global pool over the ledger. check() emits any threshold crossing itself and
+      // returns a block descriptor when a soft cap is reached (no resume headroom left) -> stop as 'budget'.
+      if (budget) {
+        const b = budget.check(spentUsd);
+        if (b && b.unknown) {
+          emit('agent.run.error', { agentId, runId, message: 'Spend history is unavailable or not durably saved. Restore the ledger and restart StarNet before continuing with spending limits.', transient: false });
+          return end('error', { failureStage: 'budget', failureCode: 'spend_history_unavailable' });
+        }
+        if (b) return end('budget', { budgetScope: b.scope, budgetCapUsd: b.cap });
+      }
+      return null;
+    }
+
     // Admission may have promoted a Commander-configured fallback because the selected primary is definitively
     // tool-less. Emit it after run.start so the UI receives a truthful, ordered lifecycle receipt even though no
     // failed provider request was needed to discover the incompatibility.
@@ -1497,21 +1518,8 @@
         // fall through: the grace turn runs below. Tools stay ON THE WIRE (see GRACE TURN NEVER DISPATCHES after
         // the stream) — but any call it emits is dropped, never executed, and the run ends max_iters.
       }
-      if (spentUsd >= maxCostUsd) return end('budget', { budgetScope: 'run', budgetCapUsd: maxCostUsd });   // per-RUN hard ceiling
-      // per-RUN token ceiling for turns nothing could price (the $ ceiling above is blind to them — see maxUnpricedTokens)
-      if (unpricedTokens >= maxUnpricedTokens) {
-        return end('budget', { budgetScope: 'run', unpricedModel: unpricedModel || model, unpricedTokens, unpricedCapTokens: maxUnpricedTokens });
-      }
-      // CROSS-RUN BUDGET: day/global pool over the ledger. check() emits any threshold crossing itself and
-      // returns a block descriptor when a soft cap is reached (no resume headroom left) -> stop as 'budget'.
-      if (budget) {
-        const b = budget.check(spentUsd);
-        if (b && b.unknown) {
-          emit('agent.run.error', { agentId, runId, message: 'Spend history is unavailable or not durably saved. Restore the ledger and restart StarNet before continuing with spending limits.', transient: false });
-          return end('error', { failureStage: 'budget', failureCode: 'spend_history_unavailable' });
-        }
-        if (b) return end('budget', { budgetScope: b.scope, budgetCapUsd: b.cap });
-      }
+      const spendStop = stopForSpend();
+      if (spendStop) return spendStop;
       // COMPUTE GATE: a model turn needs a compute capability (a computer in the room).
       if (capCtx && typeof capCtx.canRun === 'function' && !capCtx.canRun()) {
         emit('capdenied', { agentId, need: 'compute', reason: capCtx.computeReason || 'no compute capability in room' });
@@ -1582,6 +1590,9 @@
       let retrySent = false;   // this attempt re-sends the turn after a provider.retry (its first heartbeat goes out at once)
       while (true) {
         bookUsage(usage, usageModel);   // a re-entry after retry/compress/fallback: book the partial attempt BEFORE the reset
+        if (signal.aborted) return end('cancelled');
+        const attemptSpendStop = stopForSpend();
+        if (attemptSpendStop) return attemptSpendStop;
         acc.text = ''; acc.toolCalls = {}; acc.reasoning = []; streamedTextChunks = []; usage = null; lastFinishReason = null;
         usageModel = model;
         let streamErr = null;
```

**File**: `test/loop.retry-events.test.js` (modified, +31/-0)
```diff
@@ -53,7 +53,38 @@ async function run(provider, extra) {
 }
 
 (async () => {
+  // A recovery attempt is a new paid call, even though it stays in the same turn.
+  for (const scope of ['run', 'day', 'unpriced']) {
+    const p = scripted(() => ({ events: [
+      { type: 'usage', usage: { prompt_tokens: 12, completion_tokens: 12, total_tokens: 24, ...(scope === 'unpriced' ? {} : { cost: 1.25 }) } },
+      { type: 'text', delta: 'partial answer' },
+      { type: 'done', finishReason: null, truncated: true }
+    ] }));
+    const extra = scope === 'day' ? { budget: { check: spent => spent >= 1 ? { scope: 'day', cap: 1 } : null } }
+      : scope === 'unpriced' ? { cost: makeCostEngine({ priceOf: () => null }), limits: { maxUnpricedTokens: 20 } }
+      : { limits: { maxCostUsd: 1 } };
+    const { res, seq } = await run(p, extra);
+    A.eq(p.calls.length, 1, scope + ': no second paid request after the failed attempt exhausts the cap');
+    A.eq(res.reason, 'budget', scope + ': the recovery stops with truthful budget reason');
+    A.eq(res.budgetScope, scope === 'day' ? 'day' : 'run', scope + ': names the limiting scope');
+    A.eq(seq.filter(e => e.name === 'agent.cost').length, 1, scope + ': partial usage is booked exactly once');
+    A.eq(res.usd, scope === 'unpriced' ? 0 : 1.25, scope + ': no duplicate or discarded partial charge');
+  }
   // ---- 1. the ladder, pre-stream: 503, 503, answer ----
+  {
+    const p = scripted(() => ({ events: answer('should not be bought') }));
+    let folds = 0;
+    const { res } = await run(p, {
+      messages: [{ role: 'user', content: 'old question' }, { role: 'assistant', content: 'old answer' }, { role: 'user', content: 'new question' }],
+      context: require('../sidecar/context.js').makeContext({ contextLimit: 10, compactAt: 0.65, keepTail: 1 }),
+      summarize: async () => { folds++; return { summary: 'S', usd: 1.25, tokens: 10 }; },
+      limits: { maxCostUsd: 1 }
+    });
+    A.eq(folds, 1, 'preflight compaction consumes the run allowance');
+    A.eq(p.calls.length, 0, 'no generation after preflight compaction exhausts the cap');
+    A.eq(res.reason, 'budget', 'post-compaction exhaustion reports budget');
+    A.eq(res.usd, 1.25, 'compaction charge remains accounted');
+  }
   {
     const p = scripted(n => (n <= 2 ? { throw: httpErr(503, 'upstream overloaded') } : { events: answer('ok') }));
     const { res, seq, sleeps, recov, dropped, retries } = await run(p);
```

---

### Incident Patch 15: `121e18b6` (2026-10-02)
**Commit Message**: fix: authenticate current credentials in provider health checks

**File**: `sidecar/index.js` (modified, +24/-2)
```diff
@@ -23074,8 +23074,30 @@ async function handleProviderProbe(req, res) {
     // stamping VERIFIED off its hardcoded fallback. Only live-fetched models count as evidence here.
     const liveModels = models.filter(m => !(m && m.fallback));
     const catalogAvailable = liveModels.length > 0;
-    const credentialVerified = catalogAvailable && (!providerRequiresKey(id) || profile.modelsRequireAuth !== false);
-    json({ provider: id, reachable: catalogAvailable, catalogAvailable, credentialVerified });
+    const key = providerRuntimeKey(id, String(body.key || ''));
+    // An optional custom key still needs proof: a public catalog cannot authenticate it.
+    // Keyless local endpoints retain their existing health semantics without buying inference.
+    let credentialVerified = catalogAvailable && (profile.modelsRequireAuth !== false || (!providerRequiresKey(id) && !key));
+    let credentialError = '';
+    if (profile.credentialProbePath && key) {
+      // Re-check the current credential at the same authenticated endpoint used when saving it.
+      // OpenRouter's public/cached catalog alone can never prove or disprove this key.
+      const baseUrl = providerRuntimeBaseUrl(id, body.baseUrl || body.base_url || '') || profile.baseUrl;
+      const ctrl = new AbortController();
+      const timer = setTimeout(() => ctrl.abort(), 15000); if (timer.unref) timer.unref();
+      try {
+        const response = await globalThis.fetch(String(baseUrl).replace(/\/$/, '') + profile.credentialProbePath, {
+          signal: ctrl.signal, redirect: 'error', headers: { Authorization: 'Bearer ' + key, Accept: 'application/json' }
+        });
+        credentialVerified = response.ok;
+        if (!response.ok) credentialError = 'credential probe HTTP ' + response.status;
+        if (response.body) await response.body.cancel();
+      } catch (_) {
+        credentialVerified = false;
+        credentialError = ctrl.signal.aborted ? 'credential verification timed out' : 'credential verification failed';
+      } finally { clearTimeout(timer); }
+    }
+    json({ provider: id, reachable: catalogAvailable, catalogAvailable, credentialVerified, ...(credentialError ? { error: credentialError } : {}) });
   } catch (e) {
     json({ provider: id, reachable: false, catalogAvailable: false, credentialVerified: false, error: (e && e.message) || 'provider probe failed', code: (e && e.code) || '' });
   }
```

**File**: `test/sidecar.http.test.js` (modified, +13/-0)
```diff
@@ -534,6 +534,10 @@ function boot(port, workspaces, attemptsLeft, extraEnv) {
     A.eq(offlineProbe.body.reachable, false, 'offline custom endpoint is not reachable');
     A.eq(offlineProbe.body.catalogAvailable, false, 'offline custom endpoint has no proven catalog');
     const probeServer = http.createServer((rq, rs) => {
+      if (rq.url.endsWith('/auth/key')) {
+        rs.writeHead(rq.headers.authorization === 'Bearer probe-good-key' ? 200 : 401, { 'Content-Type': 'application/json' });
+        return rs.end(JSON.stringify({ data: { label: 'credential probe fixture' } }));
+      }
       if (rq.url.indexOf('/chat/completions') >= 0) {
         if (rq.headers.authorization !== 'Bearer probe-good-key') { rs.writeHead(401); return rs.end('rejected'); }
         rs.writeHead(200, { 'Content-Type': 'text/event-stream' });
@@ -555,6 +559,15 @@ function boot(port, workspaces, attemptsLeft, extraEnv) {
       A.eq(wrongCandidate.body.credentialVerified, false, 'candidate-key validation rejects a key that fails the inference wire');
       const goodCandidate = await j('POST', '/api/providers/validate', { provider: 'custom', baseUrl: liveBase, key: 'probe-good-key', model: 'local/proven-model' });
       A.eq(goodCandidate.body.credentialVerified, true, 'candidate-key validation proves the exact key on the inference wire');
+      const routerCandidate = await j('POST', '/api/providers/validate', { provider: 'openrouter', baseUrl: liveBase, key: 'probe-good-key' });
+      A.eq(routerCandidate.body.credentialVerified, true, 'OpenRouter candidate validation proves the authenticated key endpoint');
+      const routerHealth = await j('POST', '/api/providers/probe', { provider: 'openrouter', baseUrl: liveBase, key: 'probe-good-key' });
+      A.eq(routerHealth.body.credentialVerified, true, 'saved-key health preserves the same authenticated OpenRouter proof');
+      const rejectedHealth = await j('POST', '/api/providers/probe', { provider: 'openrouter', baseUrl: liveBase, key: 'probe-wrong-key' });
+      A.eq(rejectedHealth.body.credentialVerified, false, 'replacing a valid key with an invalid key cannot reuse prior verification');
+      A.eq(rejectedHealth.body.catalogAvailable, true, 'rejected credential does not erase the independently reachable public catalog');
+      const customHealth = await j('POST', '/api/providers/probe', { provider: 'custom', baseUrl: liveBase, key: 'probe-wrong-key' });
+      A.eq(customHealth.body.credentialVerified, false, 'public custom catalog cannot verify a supplied key rejected by inference');
     } finally { await new Promise(resolve => probeServer.close(resolve)); }
 
     const pushOpenAi = await fetch(B + '/api/key', {
```

#### Recent Merged Pull Requests:
- **PR #54** (closed): Add path-aware skill registry discovery and reviewed registry updates (@Cinii05)
- **PR #52** (closed): test(voice): make cooldown check deterministic (@oodadoudou)
- **PR #51** (closed): init (@twyrostek)
- **PR #45** (closed): fix(ui): reload on a stale API token instead of failing quietly (@wippa-studios)
- **PR #44** (closed): test(mac): skip receipt probe when Python is unavailable (@oodadoudou)
- **PR #43** (closed): feat(linux): add a dedicated server account and systemd profile (@mvalancy)
- **PR #42** (closed): feat(linux): support x86_64 and ARM64 desktop builds (@mvalancy)
- **PR #37** (2026-09-23): fix(onboarding): retain the validated provider when resuming (@androoAGI)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
