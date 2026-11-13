# Agent Contract: Agent Contract: milind/soni/openmausbot Autonomous Specialist Persona

<!-- PROVENANCE_START
{
  "source_repository": "milind/soni/openmausbot",
  "source_url": "https://github.com/milind/soni/openmausbot",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "agent_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [milind/soni/openmausbot](https://github.com/milind/soni/openmausbot) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Agent Role & Persona Contract
- **Role Identifier**: `milind-soni-openmausbot-specialist`
- **Governing Capability**: Autonomous execution and domain-specialized problem resolution.
- **Trust Boundary**: Reads and modifies only authorized workspace resources.

## 2. Operational Capabilities
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/milind-soni-openmausbot-learnings.md`  
> **Source**: github ([https://github.com/milind-soni/OpenMausBot](https://github.com/milind-soni/OpenMausBot))  
> **Source Version**: `fb31cb7d`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-06T13:27:08.130Z  
> **Learning ID**: `learn-github-milind-soni-openmausbot`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): milind-soni/OpenMausBot

> **Canonical Artifact**: `07_PROJECT_LEARNING/milind-soni-openmausbot-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/milind-soni/OpenMausBot](https://github.com/milind-soni/OpenMausBot))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-06T13:27:07.127Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `milind-soni/OpenMausBot`
- **Description**: Open-source Grok Bot alternative with a virtual machine that bots can use
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 14386 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `companion/src/state.ts`
```
// The sidecar's own state directory, never the harness's ~/.openmausbot.
import { randomUUID } from "node:crypto";
import {
  chmodSync,
  closeSync,
  fsyncSync,
  mkdirSync,
  openSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** OMB_COMPANION_DIR isolates a test rig from a real paired fleet. */
export const DATA_DIR = process.env.OMB_COMPANION_DIR ?? join(homedir(), ".openmausbot-companion");

/** The paired fleet's hashes are an offline target, and the 0755/0644 defaults
 * would publish which phones someone owns to every account on the machine. */
const DIR_MODE = 0o700;
export const FILE_MODE = 0o600;

export function ensureDataDir(): void {
  mkdirSync(DATA_DIR, { recursive: true, mode: DIR_MODE });
  // mkdirSync's mode applies only to a directory it creates.
  try {
    chmodSync(DATA_DIR, DIR_MODE);
  } catch {
  }
}

/**
 * Temp sibling, fsync, rename over the target: rename(2) is atomic on one
 * filesystem, so a crash never leaves a truncated device file, which would
 * read as empty and sign every phone out.
 */
export function writeFileAtomic(path: string, data: string): void {
  const tmp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  let fd: number | null = null;
  try {
    // The mode goes on at creation, so the contents are never readable meanwhile.
    fd = openSync(tmp, "w", FILE_MODE);
    writeFileSync(fd, data);
    fsyncSync(fd);
    closeSync(fd);
    fd = null;
    renameSync(tmp, path);
  } catch (e) {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
      }
    }
    try {
      unlinkSync(tmp);
    } catch {
    }
    throw e;
  }
}

```

### Core Architecture Module: `connector/src/state.ts`
```
// The connector's state volume: small JSON files, each written whole (temp file, then rename) and readable by root only,
// in a folder only root may enter. The agent token and the home's environment live here and nowhere else.
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface AgentRecord {
  version: 1;
  admin: string;
  serverId: string;
  cloudId: string;
  agentToken: string;
  enrolledAt: number;
}

/** A step of a job that changes the home or its data, written before the step starts, so a restart can finish it. */
export interface Operation {
  jobId: string;
  type: "start" | "update" | "restore" | "import-disk" | "backup" | "export-disk";
  phase: string;
  previousImage: string | null;
  nextImage: string | null;
  /** What the job makes or reads besides the home: a backup's volume, an archive's file name in the state folder. */
  target: string | null;
  /** The safety copy holds the data as it was: a restart while this is true puts it back. */
  dataAtRisk: boolean;
  /** The home was running before the job and should run after it. */
  wasRunning: boolean;
  startedAt: number;
}

export interface HomeRecord {
  version: 1;
  /** What the Admin asked for last; the connector keeps the home that way. */
  desired: "running" | "stopped";
  image: string | null;
  /** The image before the last update, kept on the server so a rollback needs no download. */
  previousImage: string | null;
  operation: Operation | null;
}

export interface StatusRecord {
  connected: boolean;
  unauthorized: boolean;
  lastConnectedAt: number | null;
  lastHeartbeatAt: number | null;
  lastError: string | null;
}

export interface SelfUpdateRecord {
  jobId: string;
  from: string | null;
  to: string;
  /** The id of the container that started the update; the new one removes it once it has connected. */
  previousContainer: string;
  candidateContainer: string;
  /** The new connector's MAUSBOT_INSTANCE: how each side knows which one it is. */
  candidateInstance: string;
  deadline: number;
}

const FILES = {
  agent: "agent.json",
  home: "home.json",
  env: "home-env.json",
  status: "status.json",
  selfUpdate: "self-update.json",
} as const;

export class StateStore {
  readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (process.platform !== "win32" && (statSync(dir).mode & 0o077) !== 0) chmodSync(dir, 0o700);
  }

  path(name: string): string {
    return join(this.dir, name);
  }

  read<T>(name: string): T | null {
    const file = this.path(name);
    if (!existsSync(file)) return null;
    try {
      return JSON.parse(readFileSync(file, "utf8")) as T;
    } catch {
      throw new Error(`The connector's state file ${name} is unreadable. Run the install command again to repair it.`);
    }
  }

  write(name: string, value: unknown): void {
    const file = this.path(name);
    const temp = `${file}.${process.pid}.tmp`;
    writeFileSync(temp, `${JSON.stringify(value, null, 1)}\n`, { mode: 0o600 });
    if (process.platform !== "win32") chmodSync(temp, 0o600);
    renameSync(temp, file);
  }

  remove(name: string): void {
    rmSync(this.path(name), { force: true });
  }

  agent(): AgentRecord | null {
    return this.read<AgentRecord>(FILES.agent);
  }

  saveAgent(record: AgentRecord): void {
    this.write(FILES.agent, record);
  }

  home(): HomeRecord {
    return this.read<HomeRecord>(FILES.home) ?? { version: 1, desired: "stopped", image: null, previousImage: null, operation: null };
  }

  saveHome(record: HomeRecord): void {
    this.write(FILES.home, record);
  }

  homeEnv(): Record<string, string> | null {
    return this.read<Record<string, string>>(FILES.env);
  }

  saveHomeEnv(env: Record<string, string>): void {
    this.write(FILES.env, env);
  }

  status(): StatusRecord {
    return this.read<StatusRecord>(FILES.status) ?? { connected: false, unauthorized: false, lastConnectedAt: null, lastHeartbeatAt: null, lastError: null };
  }

  saveStatus(patch: Partial<StatusRecord>): void {
    this.write(FILES.status, { ...this.status(), ...patch });
  }

  selfUpdate(): SelfUpdateRecord | null {
    return this.read<SelfUpdateRecord>(FILES.selfUpdate);
  }

  saveSelfUpdate(record: SelfUpdateRecord): void {
    this.write(FILES.selfUpdate, record);
  }

  /** Decides a self-update once: the first of the two connectors to rename the record wins; the other learns which. */
  settleSelfUpdate(outcome: "confirmed" | "aborted"): "confirmed" | "aborted" {
    try {
      renameSync(this.path(FILES.selfUpdate), this.path(`self-update.${outcome}.json`));
      return outcome;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      return existsSync(this.path("self-update.confirmed.json")) ? "confirmed" : "aborted";
    }
  }

  selfUpdateOutcome(): { outcome: "confirmed" | "aborted"; record: SelfUpdateRecord } | null {
    for (const outcome of ["confirmed", "aborted"] as const) {
      const record = this.read<SelfUpdateRecord>(`self-update.${outcome}.json`);
      if (record) return { outcome, record };
    }
    return null;
  }

  clearSelfUpdateOutcome(): void {
    this.remove("self-update.confirmed.json");
    this.remove("self-update.aborted.json");
  }
}

```

### Core Architecture Module: `electron/cloud-sync-engine.mjs`
```
// One folder's pass of Files: read both sides, plan (cloud-sync-plan.mjs), carry each action out, and record the base
// only once both sides hold the same bytes. A shared folder goes this computer → My Cloud; a bot's work My Cloud → this
// computer. A per-file failure is retried next pass; a signed-out or offline Cloud stops the whole pass.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { RESERVE_BYTES, clashPath, neverFromCloud, validWirePath, windowsProblem } from "./cloud-sync-rules.mjs";
import { planOutputs, planShare } from "./cloud-sync-plan.mjs";
import { scanPc, sha256File } from "./cloud-sync-scan.mjs";
import { SyncAuthError } from "./cloud-sync-client.mjs";
import { CloudAsleepError } from "./cloud-power.mjs";

const TEMP_TAG = ".omb-sync-";
const TEMP_STALE_MS = 24 * 60 * 60_000;
const CONCURRENCY = 2;

export function newReport() {
  return { folders: new Map(), outputsProblem: null };
}

/** True when the whole pass should stop (signed out, offline, asleep), not just this file. */
export function passStopper(error) {
  return error instanceof SyncAuthError || error instanceof CloudAsleepError || error?.name === "AbortError" || error?.name === "TimeoutError"
    || (error?.name === "TypeError" && /fetch/i.test(String(error.message)));
}

const defaultFree = (dir) => { const stats = fs.statfsSync(dir); return stats.bavail * stats.bsize; };

async function inPool(items, size, work) {
  let next = 0, stop = null;
  const runner = async () => {
    while (next < items.length && !stop) {
      const item = items[next++];
      try { await work(item); } catch (error) { stop ??= error; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, runner));
  if (stop) throw stop;
}

/** Each action once; a failure is this file's (three in a row show as the folder's problem), unless it stops the pass. */
async function carryOut(ctx, actions, work) {
  await inPool(actions, CONCURRENCY, async (action) => {
    try {
      await work(action);
      ctx.state.cleared(ctx.folder.id, action.path);
    } catch (error) {
      if (passStopper(error)) throw error;
      const message = String(error?.message ?? error);
      if (ctx.state.failed(ctx.folder.id, action.path, message) >= 3) ctx.result.problem ??= `${action.path}: ${message}`;
    }
  });
}

/**
 * A shared folder: this computer's files to My Cloud. Not on this computer (moved, renamed, a drive unplugged): nothing
 * is touched, and the person is asked where it went. Many files gone at once wait for the person (`approveDeletes`).
 */
export async function shareFolder({ client, state, folder, local, now = Date.now, approveDeletes = null, report }) {
  const result = { status: "synced", files: 0, done: 0, waitingBytes: 0, pendingDeletes: 0, problem: null };
  report.folders.set(folder.id, result);
  if (!fs.lstatSync(local, { throwIfNoEntry: false })?.isDirectory()) { result.status = "missing"; return result; }
  const base = state.base(folder.id);
  const { entries: pc, temps, keptDirs } = await scanPc(local, base, { now });
  for (const temp of temps) if (now() - temp.mtimeMs > TEMP_STALE_MS) fs.rmSync(temp.file, { force: true });
  const cloud = new Map((await client.files(folder.id)).filter((file) => validWirePath(file.path)).map((file) => [file.path, file]));
  const plan = planShare({ base, pc, cloud, keptDirs });
  const ctx = { client, state, folder, result };
  result.files = [...pc.values()].filter((file) => !file.kept).length;
  result.done = result.files - plan.uploads.length;
  for (const record of plan.records) state.setBase(folder.id, record.path, record);
  for (const { path: wire } of plan.forgets) state.dropBase(folder.id, wire);
  // Smallest first, so one file that does not fit cannot hold the small ones back.
  await carryOut(ctx, plan.uploads.sort((a, b) => a.size - b.size), async (action) => {
    const sent = await send(ctx, action);
    if (sent === "full") { result.waitingBytes += action.size; return; }
    state.setBase(folder.id, action.path, action);
    result.done++;
  });
  if (plan.deletes.length) {
    if (plan.ask && approveDeletes == null) result.pendingDeletes = plan.deletes.length;
    else if (plan.ask && approveDeletes === false) for (const { path: wire } of plan.deletes) state.dropBase(folder.id, wire);
    else await carryOut(ctx, plan.deletes, async ({ path: wire, baseSha256 }) => {
      const [answer] = await client.ops(folder.id, [{ op: "delete", path: wire, baseSha256 }]);
      if (answer?.ok || answer?.conflict) state.dropBase(folder.id, wire);
    });
  }
  result.status = result.pendingDeletes ? "confirm-deletes" : result.waitingBytes ? "waiting" : result.done < result.files ? "copying" : result.problem ? "problem" : "synced";
  return result;
}

/** This computer's version wins: a change a bot made on My Cloud since the listing is replaced too (its copy goes to the trash there). */
async function send(ctx, action, again = true) {
  const sent = await ctx.client.upload({ folderId: ctx.folder.id, path: action.path, file: action.file, size: action.size, sha256: action.sha256, baseSha256: action.baseSha256 });
  if (sent.ok) return "ok";
  if (sent.full) return "full";
  if (sent.conflict) {
    if (sent.current?.sha256 === action.sha256) return "ok";
    if (again) return send(ctx, { ...action, baseSha256: sent.current?.sha256 ?? null }, false);
    throw new Error("It kept changing on My Cloud; it will be sent again.");
  }
  throw new Error("My Cloud gave an answer this app does not understand.");
}

/**
 * A bot's work: My Cloud's files to this computer, in `local` (Documents/MausBot/<bot>/<conversation>). Never deletes here,
 * never writes a config an agent or tool would obey, and marks each file as downloaded (`markDownloaded`).
 */
export async function fetchOutputs({ client, state, folder, local, platform = process.platform, now = Date.now, trashItem, markDownloaded = async () => {}, freeBytes = defaultFree, report }) {
  const result = { status: "synced", files: 0, done: 0, waitingBytes: 0, pendingDeletes: 0, problem: null };
  report.folders.set(folder.id, result);
  fs.mkdirSync(local, { recursive: true });
  const base = state.base(folder.id);
  const { entries: pc, temps } = await scanPc(local, base, { now });
  for (const temp of temps) if (now() - temp.mtimeMs > TEMP_STALE_MS) fs.rmSync(temp.file, { force: true });
  const listed = (await client.files(folder.id)).filter((file) => validWirePath(file.path) && !neverFromCloud(file.path) && !(platform === "win32" && windowsProblem(file.path)));
  const cloud = new Map(listed.map((file) => [file.path, file]));
  const { downloads, records } = planOutputs({ base, pc, cloud });
  const ctx = { client, state, folder, local, pc, cloud, now, trashItem, markDownloaded, freeBytes, result };
  result.files = cloud.size;
  result.done = cloud.size - downloads.length;
  for (const record of records) state.setBase(folder.id, record.path, record);
  await carryOut(ctx, downloads, async (action) => {
    if (await receive(ctx, action) === "full") { result.waitingBytes += action.size; return; }
    result.done++;
  });
  result.status = result.waitingBytes ? "waiting" : result.done < result.files ? "copying" : result.problem ? "problem" : "synced";
  return result;
}

/** Where a wire path lives in this folder: never outside it, and never through a link or a file in the way. */
function localFile(ctx, wire) {
  if (!validWirePath(wire)) throw new Error("My Cloud sent a path this app will not write.");
  const parts = wire.split("/");
  let current = ctx.local;
  for (const part of parts.slice(0, -1)) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current, { throwIfNoEntry: false });
    if (stat && !stat.isDirectory()) throw new Error(`${wire} goes through a link or a file on this computer.`);
  }
  const file = path.join(ctx.local, ...parts);
  if (!file.startsWith(path.join(ctx.local, path.sep))) throw new Error("My Cloud sent a path outside this folder.");
  return file;
}

async function receive(ctx, { path: wire, sha256, size, replace, beside }) {
  const { client, folder, state } = ctx;
  if (ctx.freeBytes(ctx.local) - size < RESERVE_BYTES) return "full";
  let target = localFile(ctx, wire);
  const kept = fs.lstatSync(target, { throwIfNoEntry: false });
  // The person's own edit stays as it is: My Cloud's newer version lands beside it.
  if (beside && kept) {
    const taken = (candidate) => ctx.pc.has(candidate) || ctx.cloud.has(candidate) || fs.existsSync(localFile(ctx, candidate));
    target = localFile(ctx, clashPath(wire, ctx.now(), taken, "new from My Cloud"));
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tag = createHash("sha256").update(`${folder.id}\n${wire}`).digest("hex").slice(0, 8);
  const temporary = path.join(path.dirname(target), `.${path.basename(target).slice(0, 180)}${TEMP_TAG}${tag}`);
  const sent = await client.download(folder.id, wire, temporary, size);
  const got = await sha256File(temporary);
  if (got !== (sent.sha256 ?? sha256)) { fs.rmSync(temporary, { force: true }); throw new Error("The download was damaged; it will be fetched again."); }
  await ctx.markDownloaded(temporary);
  const now = fs.lstatSync(target, { throwIfNoEntry: false });
  if (now) {
    // Only a file still exactly as the plan saw it is replaced, and the one it replaces goes to the Recycle Bin first.
    if (!replace || !now.isFile() || now.size !== replace.size || now.mtimeMs !== replace.mtimeMs) { fs.rmSync(temporary, { force: true }); return "skipped"; }
    await ctx.trashItem(target);
  }
  fs.renameSync(temporary, target);
  const stat = fs.statSync(target);
  if (target === localFile(ctx, wire)) state.setBase(folder.id, wire, { sha256: got, size: stat.size, mtimeMs: stat.mtimeMs });
  else {
    const here = ctx.pc.get(wire);
    if (here && !here.unsettled) state.setBase(folder.id, wire, { sha256, size: her
```

### Core Architecture Module: `electron/cloud-sync-state.mjs`
```
// The desktop's record for Sync with My Cloud, one SQLite file in user data: each folder's base (every file as it was
// when last in step on both sides), where each bot output folder landed on this PC, per-file failures, and flags.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function openSyncState(file) {
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(file);
  db.exec(`CREATE TABLE IF NOT EXISTS base(folder TEXT NOT NULL, path TEXT NOT NULL, sha256 TEXT NOT NULL, size INTEGER NOT NULL, mtime REAL NOT NULL, PRIMARY KEY(folder, path));
    CREATE TABLE IF NOT EXISTS places(folder TEXT PRIMARY KEY, local TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS failures(folder TEXT NOT NULL, path TEXT NOT NULL, count INTEGER NOT NULL, error TEXT NOT NULL, PRIMARY KEY(folder, path));
    CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT NOT NULL);`);
  return {
    base(folder) {
      return new Map(db.prepare("SELECT path, sha256, size, mtime FROM base WHERE folder = ?").all(folder).map((row) => [row.path, { sha256: row.sha256, size: row.size, mtimeMs: row.mtime }]));
    },
    setBase(folder, path, row) { db.prepare("INSERT OR REPLACE INTO base VALUES (?, ?, ?, ?, ?)").run(folder, path, row.sha256, row.size, row.mtimeMs); },
    dropBase(folder, path) { db.prepare("DELETE FROM base WHERE folder = ? AND path = ?").run(folder, path); },
    dropFolder(folder) { db.prepare("DELETE FROM base WHERE folder = ?").run(folder); },
    place(folder) { return db.prepare("SELECT local FROM places WHERE folder = ?").get(folder)?.local ?? null; },
    setPlace(folder, local) { db.prepare("INSERT OR REPLACE INTO places VALUES (?, ?)").run(folder, local); },
    places() { return db.prepare("SELECT folder, local FROM places").all().map((row) => ({ folder: row.folder, local: row.local })); },
    failed(folder, path, error) {
      db.prepare("INSERT INTO failures VALUES (?, ?, 1, ?) ON CONFLICT(folder, path) DO UPDATE SET count = count + 1, error = excluded.error").run(folder, path, error);
      return db.prepare("SELECT count FROM failures WHERE folder = ? AND path = ?").get(folder, path).count;
    },
    cleared(folder, path) { db.prepare("DELETE FROM failures WHERE folder = ? AND path = ?").run(folder, path); },
    failures() { return db.prepare("SELECT folder, path, error FROM failures WHERE count >= 3 ORDER BY folder, path").all().map((row) => ({ folderId: row.folder, path: row.path, error: row.error })); },
    meta(key) { return db.prepare("SELECT value FROM meta WHERE key = ?").get(key)?.value ?? null; },
    setMeta(key, value) { db.prepare("INSERT OR REPLACE INTO meta VALUES (?, ?)").run(key, value); },
    reset() { db.exec("DELETE FROM base; DELETE FROM places; DELETE FROM failures; DELETE FROM meta;"); },
    close() { db.close(); },
  };
}

```

### Core Architecture Module: `electron/secure-credential-state.mjs`
```
const isPlainRecord = (value) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  try {
    const constructor = value.constructor;
    if (constructor === undefined || typeof constructor !== "function") return true;
    const prototype = constructor.prototype;
    return (
      typeof prototype === "object" &&
      prototype !== null &&
      Object.prototype.hasOwnProperty.call(prototype, "isPrototypeOf")
    );
  } catch {
    return false;
  }
};

/** Only enumerable string keys enter credentials.bin; prototypes and __proto__ never cross. */
const copy = (credentials) => {
  if (!isPlainRecord(credentials)) {
    throw new TypeError("Secure credentials must be a plain record");
  }
  const document = {};
  for (const key of Reflect.ownKeys(credentials)) {
    if (!Object.prototype.propertyIsEnumerable.call(credentials, key)) continue;
    if (typeof key !== "string") {
      throw new TypeError("Secure credential keys must be strings");
    }
    if (key === "__proto__") continue;
    document[key] = credentials[key];
  }
  return structuredClone(document);
};

/** Every caller derives its next document from the latest committed one in the same queue; a failed `afterPersist`
 * restores the encrypted file before another mutation begins. */
export function createSecureCredentialState(initialCredentials, persist, { writable = true } = {}) {
  let current = copy(initialCredentials);
  let transition = Promise.resolve();

  // A store that could not be read starts from {}: writing from it would replace every secret with nothing.
  const assertWritable = () => {
    if (writable) return;
    throw new Error("The credential store could not be read on this launch, so credentials cannot be saved");
  };

  const serialize = (work) => {
    const next = transition.then(work, work);
    transition = next.then(
      () => {},
      () => {},
    );
    return next;
  };

  return {
    read() {
      return copy(current);
    },

    update(derive, afterPersist) {
      return serialize(async () => {
        assertWritable();
        const previous = copy(current);
        const next = copy(await derive(copy(previous)));
        await persist(copy(next));
        try {
          const result = await afterPersist?.(copy(next));
          current = next;
          return result ?? copy(next);
        } catch (error) {
          await persist(copy(previous));
          current = previous;
          throw error;
        }
      });
    },
  };
}

```

### Core Architecture Module: `electron/window-state-file.mjs`
```
// The main window's size and place across launches: window-state.json under userData (window-state.cjs reads it).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { parseWindowState } = require("./window-state.cjs");

/** `file()`: where it is kept; `log`: main's log line. */
export function createWindowStateFile({ file, log = () => {} }) {
  function read() {
    try {
      return parseWindowState(fs.readFileSync(file(), "utf8"));
    } catch {
      return null;
    }
  }
  function write(win) {
    if (!win || win.isDestroyed()) return;
    const target = file();
    const temporary = `${target}.${process.pid}.tmp`;
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(temporary, JSON.stringify({ bounds: win.getNormalBounds(), maximized: win.isMaximized() }), { mode: 0o600 });
      fs.renameSync(temporary, target);
    } catch (error) {
      try { fs.rmSync(temporary, { force: true }); } catch {}
      log(`window state save failed: ${error?.message ?? error}`);
    }
  }
  /** Saves the window a quarter second after it moves or resizes, and as it closes; tells its page when it is maximized. */
  function install(win) {
    let timer = null;
    const flush = () => {
      if (timer) clearTimeout(timer);
      timer = null;
      write(win);
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, 250);
      timer.unref?.();
    };
    win.on("resize", schedule);
    win.on("move", schedule);
    const pushMaximized = () => {
      try {
        if (!win.isDestroyed()) win.webContents.send("window:maximized-changed", win.isMaximized());
      } catch {}
    };
    win.on("maximize", pushMaximized);
    win.on("unmaximize", pushMaximized);
    win.on("maximize", schedule);
    win.on("unmaximize", schedule);
    win.on("close", flush);
  }
  return { read, write, install };
}

```

### Core Architecture Module: `evals/scorers/assertions.ts`
```
import type { Assertion } from "../types.ts";
import type { WorldSnapshot } from "./snapshot.ts";
import { TURN_CLOCK_LEAD } from "../../server/turn-clock.ts";

/** Pure scorers: each assertion is evaluated against the world snapshot
 * the runner collected after the scenario steps finished. The snapshot is
 * frozen evidence; no scorer touches a server. */

export interface AssertionResult {
  assertion: Assertion;
  pass: boolean;
  detail: string;
}

const deepEqual = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

const fmt = (value: unknown): string => JSON.stringify(value, null, 2);

/** The per-turn clock line rides between the update and the person's text.
 * Only that one leading line is dropped. */
function withoutLeadingTurnClock(suffix: string): string {
  const lead = "\n\n" + TURN_CLOCK_LEAD;
  if (!suffix.startsWith(lead)) return suffix;
  const end = suffix.indexOf("\n\n", lead.length);
  return end === -1 ? suffix : suffix.slice(end);
}

/** Only a leading Claude update wrapped around captured raw user input is
 * an instruction surface. User copies and unproven inputs fail closed. */
function volatileInstructions(prompt: string, messages: WorldSnapshot["threads"][string]): string {
  try {
    const envelope = JSON.parse(prompt) as { type?: string; message?: { role?: string; content?: unknown } };
    const content = envelope?.message?.content;
    if (envelope?.type !== "user" || envelope.message?.role !== "user" || typeof content !== "string") return "";
    if (messages.some(message => message.role === "user" && message.text === content)) return "";
    const prefix = "<system-reminder>\nThis part of your instructions changed since this session started. It replaces the earlier copy:\n\n";
    if (!content.startsWith(prefix)) return "";
    const closing = "\n</system-reminder>";
    const end = content.indexOf(closing, prefix.length);
    if (end === -1) return "";
    const suffix = withoutLeadingTurnClock(content.slice(end + closing.length));
    if (!messages.some(message => message.role === "user" && typeof message.text === "string" && suffix === "\n\n" + message.text)) return "";
    return content.slice(prefix.length, end);
  } catch {
    return "";
  }
}

export function evaluateAssertions(assertions: Assertion[], world: WorldSnapshot): AssertionResult[] {
  return assertions.map((assertion) => {
    try {
      return { assertion, ...score(assertion, world) };
    } catch (error) {
      return { assertion, pass: false, detail: "scorer error: " + (error instanceof Error ? error.message : String(error)) };
    }
  });
}

function score(assertion: Assertion, world: WorldSnapshot): { pass: boolean; detail: string } {
  switch (assertion.kind) {
    case "sendNotQueued": {
      const receipts = world.sends.filter((send) => send.bot === assertion.bot);
      const queued = receipts.filter((send) => send.queued === true);
      return receipts.length === 0
        ? { pass: false, detail: "no sends were recorded for this bot" }
        : queued.length === 0
          ? { pass: true, detail: receipts.length + " send(s) all ran immediately" }
          : { pass: false, detail: "queued sends: " + fmt(queued) };
    }
    case "toolCalls": {
      const calls = world.turns
        .filter((turn) => turn.bot === assertion.bot)
        .flatMap((turn) => turn.toolCalls);
      const expected = assertion.equals.map((call) => ({
        tool: call.tool ?? "coordinate_bots",
        arguments: world.resolve(call.arguments),
        errored: call.expectError,
      }));
      // errored is only pinned when the fixture says expectError; otherwise
      // the comparison is on tool name and arguments alone.
      const mismatches = expected.flatMap((want, index) => {
        const got = calls[index];
        if (got === undefined) return ["missing call #" + (index + 1)];
        const sameTool = got.tool === want.tool;
        const sameArguments = deepEqual(got.arguments, want.arguments);
        const sameError = want.errored === undefined || got.errored === want.errored;
        return sameTool && sameArguments && sameError
          ? []
          : ["call #" + (index + 1) + " differs: expected " + fmt(want) + ", got " + fmt({ tool: got.tool, arguments: got.arguments, errored: got.errored })];
      });
      if (calls.length > expected.length) mismatches.push(calls.length - expected.length + " unexpected extra call(s)");
      return mismatches.length === 0
        ? { pass: true, detail: calls.length + " tool call(s) matched" }
        : { pass: false, detail: mismatches.join("; ") };
    }
    case "toolNames": {
      const names = world.turns
        .filter((turn) => turn.bot === assertion.bot)
        .flatMap((turn) => turn.toolCalls.map((call) => call.tool));
      const mismatches = assertion.equals.flatMap((want, index) =>
        names[index] === want ? [] : ["call #" + (index + 1) + ": expected " + want + ", got " + (names[index] ?? "nothing")],
      );
      if (names.length > assertion.equals.length) {
        mismatches.push(names.length - assertion.equals.length + " unexpected extra call(s): " + names.slice(assertion.equals.length).join(", "));
      }
      return mismatches.length === 0
        ? { pass: true, detail: names.length + " tool name(s) matched in order" }
        : { pass: false, detail: mismatches.join("; ") };
    }
    case "turnOrder": {
      const actual = world.turns.map((turn) => turn.bot);
      return deepEqual(actual, assertion.bots)
        ? { pass: true, detail: actual.join(" -> ") }
        : { pass: false, detail: "expected " + assertion.bots.join(" -> ") + ", got " + actual.join(" -> ") };
    }
    case "instructionsInclude":
    case "systemPromptIncludes": {
      const turn = world.turns.find((entry) => entry.bot === assertion.bot && entry.index === assertion.turn);
      return turn === undefined
        ? { pass: false, detail: "no evidence turn " + assertion.turn + " for this bot" }
        : turn.system.includes(assertion.includes) || assertion.kind === "instructionsInclude" && volatileInstructions(turn.prompt, world.threads[turn.threadId] ?? []).includes(assertion.includes)
          ? { pass: true, detail: assertion.kind === "instructionsInclude" ? "model instructions contain the pinned text" : "system prompt contains the pinned text" }
          : { pass: false, detail: assertion.kind === "instructionsInclude"
            ? "model instructions lacked: " + assertion.includes + "\nsystem:\n" + turn.system + "\nprompt:\n" + turn.prompt
            : "system prompt lacked: " + assertion.includes + "\n" + turn.system.slice(0, 2000) };
    }
    case "systemPromptOmits": {
      const turn = world.turns.find((entry) => entry.bot === assertion.bot && entry.index === assertion.turn);
      return turn === undefined
        ? { pass: false, detail: "no evidence turn " + assertion.turn + " for this bot" }
        : turn.system.includes(assertion.omits)
          ? { pass: false, detail: "system prompt unexpectedly contained: " + assertion.omits + "\n" + turn.system.slice(0, 2000) }
          : { pass: true, detail: "system prompt omits the pinned text" };
    }
    case "promptIncludes": {
      const turn = world.turns.find((entry) => entry.bot === assertion.bot && entry.index === assertion.turn);
      return turn === undefined
        ? { pass: false, detail: "no evidence turn " + assertion.turn + " for this bot" }
        : turn.prompt.includes(assertion.includes)
          ? { pass: true, detail: "user prompt contains the pinned text" }
          : { pass: false, detail: "prompt lacked: " + assertion.includes + "\n" + fmt(turn.prompt) };
    }
    case "handoffTree": {
      const actual = world.handoffs.map((node) => ({
        bot: node.bot,
        status: node.status,
        ...(node.hasParent === undefined ? {} : { hasParent: node.hasParent }),
      }));
      return deepEqual(actual, assertion.equals)
        ? { pass: true, detail: actual.length + " handoff node(s) matched" }
        : { pass: false, detail: "expected:\n" + fmt(assertion.equals) + "\nactual:\n" + fmt(actual) };
    }
    case "transcriptIncludes": {
      const thread = assertion.thread === "active"
        ? world.activeThreads[assertion.bot]
        : world.handoffs.find((node) => node.bot === assertion.bot)?.threadId;
      if (thread === undefined) return { pass: false, detail: "target thread not found" };
      const messages = world.threads[thread] ?? [];
      return messages.some((message) => (message.text ?? "").includes(assertion.text))
        ? { pass: true, detail: "transcript contains the pinned text" }
        : { pass: false, detail: "transcript lacked: " + assertion.text + "\n" + fmt(messages.map((message) => message.text)) };
    }
    case "gateAnswer": {
      const answer = world.observations[assertion.of] as { held?: boolean; blockedReason?: string; httpStatus?: number } | undefined;
      if (answer === undefined) return { pass: false, detail: "no saved gate answer \"" + assertion.of + "\"" };
      const checks = [
        assertion.held === undefined || answer.held === assertion.held,
        assertion.httpStatus === undefined || answer.httpStatus === assertion.httpStatus,
        assertion.blockedReasonIncludes === undefined ||
          (answer.blockedReason ?? "").includes(assertion.blockedReasonIncludes),
        assertion.blockedReasonOmits === undefined || !(answer.blockedReason ?? "").includes(assertion.blockedReasonOmits),
      ];
      return checks.every(Boolean)
        ? { pass: true, detail: fmt(answer) }
        : { pass: false, detail: "expected " + fmt(assertion) + ", got " + fmt(answer) };
    }
    case "routineRunSnapshot": {
      const snapshot = world.observations[assertion.of] as { status?: string; deferredAt?: number } | undefined;
      if (snapshot === undefined) return { pass: false, detail: "no saved routine snapshot \"" + assertion.of + "\"" };
      const deferred
```

### Core Architecture Module: `evals/scorers/skill-bench.ts`
```
import type { ScenarioResult } from "./snapshot.ts";
import type {
  SkillBenchArmRun,
  SkillBenchArmSummary,
  SkillBenchAssertionDelta,
  SkillBenchFixture,
  SkillBenchReport,
} from "../runners/run-skill-bench.ts";

/** Pure scorers for the skill bench. The runner only produces arm runs
 * (with-skill and without-skill ScenarioResults); every number in the
 * alpha report is computed here from frozen results, never from a live
 * server. */

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Sample standard deviation (n - 1). A single sample carries no variance
 * information, so n < 2 reports 0; the report separately states the
 * replicate count so a 0 is never read as "no variance observed". */
export function stddev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - m) ** 2, 0) / (values.length - 1));
}

/** The scripted provider makes no API calls, so there are no real token
 * counts to read. This is a deterministic chars/4 estimate of what rode
 * the prompt (system + user prompt + tool-call JSON per evidence turn);
 * the live tier is where measured usage replaces it. */
export function estimateTokens(result: ScenarioResult): number {
  let chars = 0;
  for (const turn of result.evidence.turns) {
    chars += turn.system.length + turn.prompt.length + JSON.stringify(turn.toolCalls).length;
  }
  return Math.ceil(chars / 4);
}

function armSummary(runs: SkillBenchArmRun[]): SkillBenchArmSummary {
  const assertionResults = runs.flatMap((run) => run.result.assertions);
  const durations = runs.map((run) => run.result.durationMs);
  const tokens = runs.map((run) => estimateTokens(run.result));
  return {
    runs: runs.length,
    passed: assertionResults.filter((assertion) => assertion.pass).length,
    total: assertionResults.length,
    passRate: assertionResults.length === 0 ? 0 : assertionResults.filter((a) => a.pass).length / assertionResults.length,
    durationMeanMs: mean(durations),
    durationStddevMs: stddev(durations),
    estimatedTokensMean: mean(tokens),
    estimatedTokensStddev: stddev(tokens),
  };
}

/** An assertion is non-discriminating when its pass rate is identical in
 * both arms: it pins something true regardless of the skill, so it cannot
 * attribute any change to the skill under test. Such assertions are still
 * useful as controls; the flag keeps them out of the effect story.
 * Deltas are computed per prompt from each run's own assertion list, so
 * prompts may assert different things without bleeding into each other. */
function assertionDeltas(bench: SkillBenchFixture, runs: SkillBenchArmRun[]): SkillBenchAssertionDelta[] {
  const deltas: SkillBenchAssertionDelta[] = [];
  for (const prompt of bench.prompts) {
    const promptRuns = runs.filter((run) => run.promptId === prompt.id);
    prompt.assertions.forEach((assertion, index) => {
      const withRuns = promptRuns.filter((run) => run.arm === "with");
      const withoutRuns = promptRuns.filter((run) => run.arm === "without");
      const withPasses = withRuns.filter((run) => run.result.assertions[index]?.pass === true).length;
      const withoutPasses = withoutRuns.filter((run) => run.result.assertions[index]?.pass === true).length;
      const withRate = withRuns.length === 0 ? 0 : withPasses / withRuns.length;
      const withoutRate = withoutRuns.length === 0 ? 0 : withoutPasses / withoutRuns.length;
      // High variance: within this prompt and arm, replicates of the same
      // run disagree about this assertion. Only assessable with n >= 2.
      let highVariance = false;
      for (const arm of ["with", "without"] as const) {
        const group = promptRuns.filter((run) => run.arm === arm);
        const verdicts = new Set(group.map((run) => run.result.assertions[index]?.pass === true));
        if (group.length >= 2 && verdicts.size > 1) highVariance = true;
      }
      const label = "#" + index + " " + assertion.kind + ("bot" in assertion ? " (" + assertion.bot + ")" : "");
      deltas.push({
        promptId: prompt.id,
        index,
        label,
        withPasses,
        withoutPasses,
        withRuns: withRuns.length,
        withoutRuns: withoutRuns.length,
        withRate,
        withoutRate,
        delta: withRate - withoutRate,
        nonDiscriminating: withRate === withoutRate,
        highVariance,
      });
    });
  }
  return deltas;
}

export function scoreSkillBench(bench: SkillBenchFixture, runs: SkillBenchArmRun[]): SkillBenchReport {
  const assertions = assertionDeltas(bench, runs);
  return {
    fixtureId: bench.id,
    title: bench.title,
    behavior: bench.behavior,
    generatedAt: new Date().toISOString(),
    replicates: bench.replicates,
    prompts: bench.prompts.map((prompt) => ({
      promptId: prompt.id,
      text: prompt.text,
      runs: runs
        .filter((run) => run.promptId === prompt.id)
        .map((run) => ({
          arm: run.arm,
          replicate: run.replicate,
          pass: run.result.pass,
          durationMs: run.result.durationMs,
          estimatedTokens: estimateTokens(run.result),
          failedAssertions: run.result.assertions
            .filter((assertion) => !assertion.pass)
            .map((assertion) => assertion.assertion.kind + ": " + assertion.detail.replaceAll("\n", " ")),
          error: run.result.error,
        })),
    })),
    assertions,
    summary: {
      withSkill: armSummary(runs.filter((run) => run.arm === "with")),
      withoutSkill: armSummary(runs.filter((run) => run.arm === "without")),
      flags: {
        nonDiscriminating: assertions.filter((assertion) => assertion.nonDiscriminating).length,
        highVariance: assertions.filter((assertion) => assertion.highVariance).length,
      },
    },
    errors: runs.filter((run) => run.result.error !== undefined).map((run) => run.promptId + "/" + run.arm + "#" + run.replicate + ": " + run.result.error),
  };
}

```

### Core Architecture Module: `evals/scorers/snapshot.ts`
```
import type { Assertion } from "../types.ts";
import type { AssertionResult } from "./assertions.ts";

/** The frozen evidence one scenario run leaves behind. Scorers see only
 * this object, never a live server, so assertions cannot be flattered by
 * re-reading mutable state. */

export interface EvidenceTurn {
  bot: string;
  index: number;
  threadId: string;
  system: string;
  prompt: string;
  toolCalls: Array<{ tool: string; arguments: Record<string, unknown>; errored: boolean }>;
}

export interface HandoffNodeView {
  bot: string;
  status: string;
  threadId: string;
  hasParent?: boolean;
}

export interface SendReceipt {
  bot: string;
  text: string;
  queued: boolean | undefined;
}

export interface WorldSnapshot {
  turns: EvidenceTurn[];
  handoffs: HandoffNodeView[];
  /** threadId of each bot's active chat thread, by bot key. */
  activeThreads: Record<string, string>;
  /** Messages collected at snapshot time, keyed by threadId. */
  threads: Record<string, Array<{ role?: string; text?: string; kind?: string; tool?: { name?: string } }>>;
  sends: SendReceipt[];
  /** Named observations recorded by steps (gate answers, routine snapshots). */
  observations: Record<string, unknown>;
  /** Activities for a bot, as tool names. */
  activities: (bot: string) => string[];
  /** Resolves "@botKey" references inside assertion arguments. */
  resolve: (value: unknown) => unknown;
}

export interface StepResult {
  step: unknown;
  ok: boolean;
  detail: string;
  durationMs: number;
}

export interface ScenarioResult {
  id: string;
  title: string;
  behavior: string;
  world: string;
  pass: boolean;
  startedAt: string;
  durationMs: number;
  steps: StepResult[];
  assertions: AssertionResult[];
  assertionsInput: Assertion[];
  /** The frozen serializable evidence the trace tiers diff: turns with
    * tool calls, the handoff tree, and send receipts. */
  evidence: {
    turns: EvidenceTurn[];
    handoffs: HandoffNodeView[];
    sends: SendReceipt[];
  };
  error?: string;
}

```

### Core Architecture Module: `evals/tool-choice/score.ts`
```
export interface ToolChoiceCase {
  id: string;
  /** Any of these counts: picking one directly, or reaching it through use_tool. */
  tools: string[];
  text: string;
  /** The real failure this came from, in neutral words. */
  why: string;
}

/** A tool name as a thread's activity row or a stream event gives it, without its server. */
export function bareToolName(name: string): string {
  return name.replace(/^mcp__[^_]+(?:_[^_]+)*?__/, "");
}

export interface CaseScore {
  pass: boolean;
  chosen: string | undefined;
  /** It looked the tool up first. */
  searched: boolean;
}

/** The first of the turn's tool calls that isn't a lookup decides the case; a later right tool still counts, since the tool list is what's on trial. */
export function scoreCase(testCase: Pick<ToolChoiceCase, "tools">, calls: readonly string[]): CaseScore {
  const names = calls.map(bareToolName);
  const lookups = new Set(["find_tool", "ToolSearch"]);
  const chosen = names.find((name) => testCase.tools.includes(name));
  return { pass: chosen !== undefined, chosen: chosen ?? names.find((name) => !lookups.has(name)), searched: names.some((name) => lookups.has(name)) };
}

/** Pass rate, plus what a bridge or a shorter prompt has to beat. */
export function summarize(rows: ReadonlyArray<{ score: CaseScore; costUsd?: number; inputTokens?: number }>) {
  const passed = rows.filter((row) => row.score.pass).length;
  return {
    cases: rows.length,
    passed,
    searched: rows.filter((row) => row.score.searched).length,
    costUsd: Number(rows.reduce((sum, row) => sum + (row.costUsd ?? 0), 0).toFixed(4)),
    inputTokens: rows.reduce((sum, row) => sum + (row.inputTokens ?? 0), 0),
  };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4324** (2026-11-04): **Gmail draft-only request sends an email despite explicit “Do not send” instruction**
  *Symptoms*: ### Before filing  - [x] I searched existing issues and this isn't a duplicate  ### Area  Harness server / API (server/)  ### What happened  ## What happened  OpenMausBot sent a Gmail reply when explicitly instructed to create a draft and not send it. After acknowledging the unintended send, it created a draft and later incorrectly reported that no email had been sent.  The user confirmed that the email exists in Gmail’s Sent folder.  ## Steps to reproduce  1. Connect Gmail to OpenMausBot. 2. Ask the bot to reply to an existing conversation using a prompt such as:     > Find the existing Gmail conversation titled “[subject]” from [sender]. Read it and create exactly one reply draft attached to that original thread:    > [reply text]    > If a draft already exists, update it instead of creating another. Do not send the email, open any links, or change my account. 3. Inspect the bot’s tool calls and Gmail’s Sent folder.  ## Expected behavior  - Create one draft reply in the original conversation. - Never send an email for a draft-only request. - Report the actions actually performed, including any unintended send.  ## Actual behavior  The bot stated:  > The email was sent rather than saved as a draft.  It then created a reply draft, but its final summaries repeatedly claimed:  > The email has not been sent.  The user checked Gmail and confirmed that the email had been sent. Creating a draft afterward did not undo the send.  ## Related duplicate-draft behavior  During the same s

- **Issue #4200** (2026-11-04): **Copilot models fail to tool-call, change routines and use the built in browser**
  *Symptoms*: ### Before filing  - [x] I searched existing issues and this isn't a duplicate  ### Area  Provider drivers (claude / codex / grok)  ### What happened  1. I opened a chat with my Github Copilot models, and when I tell it to update routines, use the brower etc. it just replies with "I don't have access to automation controls". 2. When I switch to my ChatGPT plan, everything works fine, all tool-calls, routine making etc. works fine through chat.  ### Version and install  OpenMausBot - Windows 10/11  ### Logs  ```text  ```

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

### Incident Patch 1: `fb31cb7d` (2026-11-06)
**Commit Message**: Merge pull request #4643 from milind-soni/fix/edge-caddy-lf

Keep the edge's Caddy configs LF on Windows checkouts

**File**: `.gitattributes` (modified, +5/-0)
```diff
@@ -45,3 +45,8 @@ scripts/tighten-ratchets.mjs text eol=lf
 # on Windows fails every one of those checks for a reason that has nothing to do with the wire.
 companion/src/e2e/vectors/** text eol=lf
 relay/test/vectors/** text eol=lf
+
+# server/cloud-home.test.ts matches the edge's Caddy configs line by line with "\n", and Caddy reads them as written;
+# a CRLF checkout on Windows fails every match for a reason that has nothing to do with the edge.
+deploy/fly/Caddyfile* text eol=lf
+deploy/fly/*.caddy text eol=lf
```

---

### Incident Patch 2: `d71d3f41` (2026-11-06)
**Commit Message**: Merge pull request #4578 from milind-soni/fix/release-flakes-0142

Make four release-gate flakes reliable (one real data-interrupt bug)

**File**: `electron/device-link.node-test.mjs` (modified, +12/-2)
```diff
@@ -247,12 +247,11 @@ test("the link signs in like the poll, takes My Cloud's word for this computer's
   const stop = new AbortController();
   let opened = 0;
   const connects = [];
-  const running = runDeviceLink({ url: end.url, headers: { cookie: "omb_session=s", "x-omb-computer-secret": "a".repeat(64) }, signal: stop.signal, onOpen: () => opened++, openMs: 100,
+  const running = runDeviceLink({ url: end.url, headers: { cookie: "omb_session=s", "x-omb-computer-secret": "a".repeat(64) }, signal: stop.signal, onOpen: () => opened++,
     egress: { interfaces: () => ({}), resolve: async () => [{ address: SEEN_AS, family: 4 }], connect: (options) => { connects.push(options); return tcpConnect(1, "127.0.0.1"); } } });
   await until(() => end.sessions.length === 1 && opened === 1, "the link to open");
   assert.equal(end.sessions[0].headers.cookie, "omb_session=s");
   assert.equal(end.sessions[0].headers["x-omb-computer-secret"], "a".repeat(64));
-  await delay(250); // past the opening limit: a link that opened is not ended by it
   assert.deepEqual(await end.sessions[0].mux.open({ host: "home-router.test", port: 443 }), { refused: "home-network" }, "the home's own public address is home");
   assert.equal(connects.length, 0);
   stop.abort();
@@ -261,6 +260,17 @@ test("the link signs in like the poll, takes My Cloud's word for this computer's
   assert.equal(linkUrl("http://127.0.0.1:9", "/x"), "ws://127.0.0.1:9/x");
 });
 
+test("a link that opened is never ended by its opening limit", async () => {
+  class OpensAtOnce { constructor() { queueMicrotask(() => this.onopen?.()); } send() {} close() {} }
+  const stop = new AbortController();
+  let opened = 0;
+  const running = runDeviceLink({ url: "ws://127.0.0.1:9/link", WebSocket: OpensAtOnce, signal: stop.signal, openMs: 20, onOpen: () => opened++, egress: { interfaces: () => ({}) } });
+  await delay(100);
+  stop.abort();
+  assert.equal(opened, 1);
+  assert.deepEqual(await running, { code: 1000, reason: "stopped" });
+});
+
 test("a My Cloud that stops answering ends the link here within the silence limit, so nothing hangs on it", async (t) => {
   const end = await cloudEnd(t, { answerPings: false, greet: false });
   const started = Date.now();
```

**File**: `server/data/engine.test.ts` (modified, +33/-17)
```diff
@@ -515,41 +515,57 @@ describe("cancellation", () => {
     expect((await failure(db.run("SELECT 1", { ...bot, signal: early.signal }))).error.code).toBe("cancelled");
   });
 
-  it("cancels a statement whose abort landed before it dispatched", async () => {
-    let dispatched = false;
-    let delivered = 0;
+  /** A lane whose statement reaches the connection only on `dispatch()`; an interrupt before that is lost, as DuckDB's is,
+   * and one that is never delivered after it lets the statement finish half a second later. */
+  function undispatched(signal?: AbortSignal) {
+    const seen = { dispatched: false, delivered: 0 };
     let abandon: (() => void) | undefined;
-    const connection = {
+    const lane = new Lane({
       run: () => {
-        dispatched = true;
+        seen.dispatched = true;
         return new Promise<unknown>((resolve, reject) => {
           const finish = setTimeout(() => resolve("finished without an interrupt"), 500);
           abandon = () => { clearTimeout(finish); reject(new Error("INTERRUPT Error: Interrupted!")); };
         });
       },
       interrupt: () => {
-        delivered++;
+        seen.delivered++;
         abandon?.();
       },
-    };
-    const lane = new Lane(connection as never);
+    } as never);
     let parked!: () => void;
     const atWork = new Promise<void>((done) => { parked = done; });
-    let open!: () => void;
-    const gate = new Promise<void>((done) => { open = done; });
-    const controller = new AbortController();
-    const running = lane.run("SELECT 1", { signal: controller.signal, timeoutMs: 30_000 }, async (conn) => {
+    let dispatch!: () => void;
+    const gate = new Promise<void>((done) => { dispatch = done; });
+    const running = lane.run("SELECT 1", { signal, timeoutMs: 30_000 }, async (conn) => {
       parked();
       await gate;
       return conn.run("SELECT 1");
     });
-    await atWork;
+    return { seen, lane, atWork, dispatch, running };
+  }
+
+  it("cancels a statement whose abort landed before it dispatched", async () => {
+    const controller = new AbortController();
+    const statement = undispatched(controller.signal);
+    await statement.atWork;
     controller.abort();
-    open();
-    const error = await failure(running);
-    expect(dispatched).toBe(true);
+    statement.dispatch();
+    const error = await failure(statement.running);
+    expect(statement.seen.dispatched).toBe(true);
+    expect(error.error.code).toBe("cancelled");
+    expect(statement.seen.delivered).toBeGreaterThan(1);
+  });
+
+  it("cancels a statement whose interrupt landed before it dispatched", async () => {
+    const statement = undispatched();
+    await statement.atWork;
+    statement.lane.interrupt();
+    statement.dispatch();
+    const error = await failure(statement.running);
+    expect(statement.seen.dispatched).toBe(true);
     expect(error.error.code).toBe("cancelled");
-    expect(delivered).toBeGreaterThan(1);
+    expect(statement.seen.delivered).toBeGreaterThan(1);
   });
 
   it("interrupts one connection while the other keeps working, and queued statements still run", async () => {
```

**File**: `server/data/engine.ts` (modified, +21/-23)
```diff
@@ -165,7 +165,7 @@ function missingTableName(message: string): string | null {
 
 type InterruptCause = "timeout" | "cancelled";
 
-type RunState = { interrupted: InterruptCause | null; retry?: NodeJS.Timeout };
+type RunState = { interrupted: InterruptCause | null; deadline: number; retry?: NodeJS.Timeout };
 
 function failureFrom(error: unknown, sql: string, interrupted: InterruptCause | null, timeoutMs: number): DataFailure {
   if (error instanceof DataFailure) return error;
@@ -195,27 +195,10 @@ export class Lane {
   private async execute<T>(sql: string, options: { timeoutMs?: number; signal?: AbortSignal }, work: (connection: DuckDB.DuckDBConnection) => Promise<T>): Promise<T> {
     const timeoutMs = options.timeoutMs ?? DATA_LIMITS.sqlTimeoutMs;
     if (options.signal?.aborted) throw new DataFailure({ code: "cancelled", message: "Cancelled before it ran.", sql });
-    const state: RunState = { interrupted: null };
-    const deadline = Date.now() + timeoutMs;
+    const state: RunState = { interrupted: null, deadline: Date.now() + timeoutMs };
     this.running = state;
-    // DuckDB honours an interrupt only once its statement is dispatched, so a cause keeps re-delivering
-    // until the statement settles: one that lands first is not lost, and no cause blocks the next.
-    const interrupt = (cause: InterruptCause) => {
-      state.interrupted ??= cause;
-      this.connection.interrupt();
-      if (state.retry || Date.now() >= deadline) return;
-      const retry = setInterval(() => {
-        if (Date.now() >= deadline) {
-          clearInterval(retry);
-          state.retry = undefined;
-          return;
-        }
-        this.connection.interrupt();
-      }, INTERRUPT_DELIVERY_MS);
-      state.retry = retry;
-    };
-    const timer = setTimeout(() => interrupt("timeout"), timeoutMs);
-    const onAbort = () => interrupt("cancelled");
+    const timer = setTimeout(() => this.stop(state, "timeout"), timeoutMs);
+    const onAbort = () => this.stop(state, "cancelled");
     options.signal?.addEventListener("abort", onAbort, { once: true });
     try {
       return await work(this.connection);
@@ -230,9 +213,24 @@ export class Lane {
   }
 
   interrupt(): void {
-    if (!this.running) return;
-    this.running.interrupted ??= "cancelled";
+    if (this.running) this.stop(this.running, "cancelled");
+  }
+
+  // DuckDB honours an interrupt only once its statement is dispatched, so a cause keeps re-delivering
+  // until the statement settles: one that lands first is not lost, and no cause blocks the next.
+  private stop(state: RunState, cause: InterruptCause): void {
+    state.interrupted ??= cause;
     this.connection.interrupt();
+    if (state.retry || Date.now() >= state.deadline) return;
+    const retry = setInterval(() => {
+      if (Date.now() >= state.deadline) {
+        clearInterval(retry);
+        state.retry = undefined;
+        return;
+      }
+      this.connection.interrupt();
+    }, INTERRUPT_DELIVERY_MS);
+    state.retry = retry;
   }
 }
 
```

**File**: `server/memory-order.e2e.test.ts` (modified, +3/-2)
```diff
@@ -28,10 +28,10 @@ async function fixture(test: (f: any) => Promise<void>) {
 it("starts the person's own line ahead of a hand-off that was already waiting for memory, and the hand-off right after", () => fixture(async (f) => {
   const [chief, first, second, person] = [await f.bot("Clive"), await f.bot("First"), await f.bot("Second"), await f.bot("Person's bot")];
   await f.api(`/api/bots/${chief.id}`, { chiefOfStaff: true, managedSections: ["Team"], acknowledgePeerScope: true }, "PATCH");
-  const gate = join(f.dataDir, "first-may-finish");
+  const gate = join(f.dataDir, "first-may-finish"), firstRunning = join(f.dataDir, "first-is-running");
   writeFileSync(f.planPath, JSON.stringify({
     [chief.id]: { steps: [{ arguments: { bot_ids: [first.id], message: "First job" } }, { arguments: { bot_ids: [second.id], message: "Second job" } }], reply: "Sent", resumeReply: "Done" },
-    [first.id]: { gateFile: gate, reply: "First done" },
+    [first.id]: { readyFile: firstRunning, gateFile: gate, reply: "First done" },
     [second.id]: { reply: "Second done" },
     [person.id]: { reply: "Yours" },
   }));
@@ -46,6 +46,7 @@ it("starts the person's own line ahead of a hand-off that was already waiting fo
   try {
     expect((db.prepare("SELECT kind, detail FROM assignment_events WHERE assignment_id = ? AND kind = 'held'").all(held.id) as Array<{ detail: string }>).map((row) => row.detail)[0]).toMatch(/^memory: \d+ running, \d+ ahead$/);
   } finally { db.close(); }
+  await expect.poll(() => existsSync(firstRunning), { timeout: 30_000 }).toBe(true);
 
   await f.cli("send", "--bot", person.id, "--task", person.activeTaskId, "--text", "My own question.");
   await expect.poll(async () => (await f.messages(person.activeTaskId)).some((message: any) => message.tool?.name?.includes("Waiting for memory")), { timeout: 30_000 }).toBe(true);
```

**File**: `server/mistral-key-flow.test.ts` (modified, +2/-1)
```diff
@@ -4,6 +4,7 @@ import { join } from "node:path";
 import { expect, it } from "vitest";
 import { launchVerificationServer } from "../scripts/control-omb.ts";
 import { fixtureApi } from "../scripts/testing/preview-fixture.ts";
+import { hostTimeout } from "./testing/host-timeout.ts";
 import { openSse } from "./testing/sse.ts";
 
 it("Mistral keys persist, rotate, clear and reach real HTTP turns without leaking into public state", async () => {
@@ -91,4 +92,4 @@ it("Mistral keys persist, rotate, clear and reach real HTTP turns without leakin
     await fixture.close();
     await new Promise<void>((resolve) => provider.close(() => resolve()));
   }
-});
+}, hostTimeout(60_000));
```

---

### Incident Patch 3: `3faf84a5` (2026-11-06)
**Commit Message**: Merge pull request #4573 from milind-soni/fix/inline-page-height

A bot page that fills its window keeps a page's height in the chat

**File**: `.github/workflows/ci.yml` (modified, +2/-1)
```diff
@@ -579,7 +579,7 @@ jobs:
         env:
           OMB_UI_E2E: "1"
           OMB_UI_EVIDENCE_DIR: .omb-scratch/verify-evidence
-        run: pnpm exec vitest run scripts/testing/control-omb-ui.e2e.test.ts scripts/testing/bot-tools-ui.e2e.test.ts scripts/testing/thinking-timer-ui.e2e.test.ts scripts/testing/team-share-ui.e2e.test.ts scripts/testing/org-library-ui.e2e.test.ts scripts/testing/presets-ui.e2e.test.ts scripts/testing/browser-evidence.e2e.test.ts scripts/testing/browser-fill.e2e.test.ts scripts/testing/rich-table-composer-ui.e2e.test.ts scripts/testing/computer-panel-focus-ui.e2e.test.ts scripts/testing/mobile-code-blocks-ui.e2e.test.ts
+        run: pnpm exec vitest run scripts/testing/control-omb-ui.e2e.test.ts scripts/testing/bot-tools-ui.e2e.test.ts scripts/testing/thinking-timer-ui.e2e.test.ts scripts/testing/team-share-ui.e2e.test.ts scripts/testing/org-library-ui.e2e.test.ts scripts/testing/presets-ui.e2e.test.ts scripts/testing/browser-evidence.e2e.test.ts scripts/testing/browser-fill.e2e.test.ts scripts/testing/rich-table-composer-ui.e2e.test.ts scripts/testing/computer-panel-focus-ui.e2e.test.ts scripts/testing/mobile-code-blocks-ui.e2e.test.ts scripts/testing/inline-page-height-ui.e2e.test.ts
       - name: Upload the renderer screenshot
         uses: actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1
         if: always()
@@ -590,6 +590,7 @@ jobs:
             .omb-scratch/verify-evidence/thinking-timer-anchored.png
             .omb-scratch/verify-evidence/share-team-dialog.png
             .omb-scratch/verify-evidence/mobile-code-blocks/
+            .omb-scratch/verify-evidence/inline-page-height/
           if-no-files-found: warn
           retention-days: 7
 
```

**File**: `scripts/testing/inline-page-height-ui.e2e.test.ts` (added, +136/-0)
```diff
@@ -0,0 +1,136 @@
+// Bot pages in the real <App/> through `control-omb ui`: a page drawn to its window keeps a page's height in the chat,
+// and a page that flows keeps sizing to its content. Needs the pinned agent-browser binary: runs when one resolves or
+// OMB_UI_E2E=1 asks for the verified download; otherwise skipped.
+import { spawn } from "node:child_process";
+import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { join, resolve } from "node:path";
+import { fileURLToPath } from "node:url";
+import { afterAll, expect, it } from "vitest";
+
+import { resolveAgentBrowserBinary } from "../../server/browser-engine.ts";
+import { removeTempDir, waitForExit } from "../../server/testing/cleanup.ts";
+import { runControlOmb } from "../control-omb.ts";
+import { UI_TOOLS_DIR, agentBrowser, sessionEnv, type UiHandle } from "./control-omb-ui.ts";
+
+const ROOT = fileURLToPath(new URL("../..", import.meta.url));
+const forced = process.env.OMB_UI_E2E === "1";
+const enabled = forced || Boolean(resolveAgentBrowserBinary({ dataDir: UI_TOOLS_DIR, env: process.env }));
+if (!enabled) console.log("skipping inline page height UI e2e: set OMB_UI_E2E=1 to install the pinned browser");
+const LAUNCH_TIMEOUT_MS = forced ? 600_000 : 180_000;
+const evidenceDir = process.env.OMB_UI_EVIDENCE_DIR
+  ? join(resolve(ROOT, process.env.OMB_UI_EVIDENCE_DIR), "inline-page-height")
+  : mkdtempSync(join(tmpdir(), "omb-page-height-"));
+const ownsEvidenceDir = !process.env.OMB_UI_EVIDENCE_DIR;
+
+const SIZE_LABEL = "c.fillStyle='#1d3557';c.font='bold 13px sans-serif';c.fillText('frame '+w+' x '+h,w-150,22);";
+
+const MAP_LAYER = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
+html,body{height:100%;margin:0;overflow:hidden;font-family:var(--font-sans)}
+#map{position:absolute;inset:0}
+#map canvas{position:absolute;inset:0;width:100%;height:100%}
+.card{position:absolute;left:16px;bottom:16px;width:230px;padding:12px 14px;border-radius:12px;background:#fff;color:#1d1d1f;box-shadow:0 6px 20px rgba(0,0,0,.2);font-size:13px;line-height:18px}
+</style></head><body>
+<div id="map"><canvas></canvas></div>
+<div class="card"><strong>Harbour ferries</strong><br>Three routes. Next boat 14:20.</div>
+<script>
+var canvas=document.querySelector("canvas");
+var draw=function(){var w=innerWidth,h=innerHeight;canvas.width=w;canvas.height=h;var c=canvas.getContext("2d");
+c.fillStyle="#cfe3ee";c.fillRect(0,0,w,h);c.fillStyle="#a8cf9a";
+c.beginPath();c.ellipse(w*0.2,h*0.3,w*0.18,h*0.22,0,0,7);c.fill();c.beginPath();c.ellipse(w*0.78,h*0.68,w*0.2,h*0.25,0,0,7);c.fill();
+c.strokeStyle="rgba(29,53,87,.18)";for(var x=0;x<w;x+=40){c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke()}
+for(var y=0;y<h;y+=40){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke()}
+c.strokeStyle="#e63946";c.lineWidth=3;c.setLineDash([8,6]);c.beginPath();c.moveTo(w*0.25,h*0.35);c.lineTo(w*0.5,h*0.5);c.lineTo(w*0.75,h*0.62);c.stroke();
+${SIZE_LABEL}};
+addEventListener("resize",draw);draw();
+</script></body></html>`;
+
+const MAP_PERCENT = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
+html,body,#map{height:100%;margin:0}
+#map{position:relative;overflow:hidden;background:repeating-linear-gradient(45deg,#e9f1e4 0 24px,#dfeadb 24px 48px)}
+.pin{position:absolute;left:45%;top:40%;width:18px;height:18px;border-radius:50% 50% 50% 0;background:#e63946;transform:rotate(-45deg)}
+.label{position:absolute;left:12px;top:12px;font:bold 13px sans-serif;color:#1d3557}
+</style></head><body><div id="map"><div class="pin"></div><div class="label">html, body, #map { height: 100% }</div></div></body></html>`;
+
+const FLOWING = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
+body{margin:0;padding:16px;font-family:var(--font-sans);color:var(--color-text-primary)}
+h2{margin:0;height:40px;font-size:18px;line-height:24px}
+.row{height:56px;box-sizing:border-box;border-top:1px solid var(--color-border-primary);display:flex;align-items:center}
+</style></head><body><h2>This week</h2>
+<div class="row">Monday: design review</div><div class="row">Tuesday: ship the beta</div>
+<div class="row">Wednesday: customer calls</div><div class="row">Thursday: retro</div></body></html>`;
+const FLOWING_HEIGHT = 16 + 40 + 4 * 56 + 16;
+
+const PAGES = [
+  { key: "map-layer", input: { title: "Ferry map", html: MAP_LAYER } },
+  { key: "map-layer-400", input: { title: "Ferry map at 400", html: MAP_LAYER, height: 400 } },
+  { key: "map-percent", input: { title: "Percent map", html: MAP_PERCENT } },
+  { key: "flowing", input: { title: "This week", html: FLOWING } },
+] as const;
+
+const ui = (verb: string, handle: string, ...args: string[]) =>
+  runControlOmb(["ui", verb, "--ui", handle, ...args]) as Promise<Record<string, any>>;
+
+let child: ReturnType<typeof spawn> | undefined;
+afterAll(async () => {
+  if (child && child.exitCode === null && child.signalCode === null) await waitForExit(child, { sign
```

**File**: `server/drivers/agents-app-tools.ts` (modified, +1/-1)
```diff
@@ -2,7 +2,7 @@ export const APP_TOOL_DEFINITIONS = [
   {
     name: "show_html",
     description:
-      "Show a small self-contained web page in this chat, where the person watches it appear and can point at a part to change: a mini app, a game, a chart, a calculator, a report. For forms and choices use show_widget instead, and for plain data a markdown table. Send `html`, one HTML document (a fragment is wrapped) with inline style and script, or `jsx`, one React component file with a default export: it can import react, lucide-react icons, echarts, and Chart and useTheme from \"mausbot\", and style with Tailwind classes. Or send `path`, a folder in your working folder with index.html and its files (scripts, images, csv, geojson or parquet data; up to 5 MB). It runs in a locked sandbox: no network requests, cookies, storage, popups or form posts. Scripts, styles and fonts load only from cdnjs.cloudflare.com, cdn.jsdelivr.net, unpkg.com and Google Fonts; images must be data: URLs or come from those CDNs. Embed the data you need. Use the CSS variables --color-text-primary, --color-background-primary, --color-border-primary and --font-sans to match the person's theme. In the page, mausbot.send(text) sends text as the person's next message (only after they click in it), mausbot.open(url) opens a link, and mausbot.setContext(text) tells you what they see, with their next message. At most 256 KB. To replace a page you showed, in place, call this again with the app_id it returned and new html, jsx or path (was update_html); it reloads, so anything the person did in it is lost. Never put secrets in it. Not available in rooms. For a data dashboard, follow the data-dashboards skill.",
+      "Show a small self-contained web page in this chat, where the person watches it appear and can point at a part to change: a mini app, a game, a chart, a calculator, a report. For maps, canvases, games or anything that fills the window, pass `height`. For forms and choices use show_widget instead, and for plain data a markdown table. Send `html`, one HTML document (a fragment is wrapped) with inline style and script, or `jsx`, one React component file with a default export: it can import react, lucide-react icons, echarts, and Chart and useTheme from \"mausbot\", and style with Tailwind classes. Or send `path`, a folder in your working folder with index.html and its files (scripts, images, csv, geojson or parquet data; up to 5 MB). It runs in a locked sandbox: no network requests, cookies, storage, popups or form posts. Scripts, styles and fonts load only from cdnjs.cloudflare.com, cdn.jsdelivr.net, unpkg.com and Google Fonts; images must be data: URLs or come from those CDNs. Embed the data you need. Use the CSS variables --color-text-primary, --color-background-primary, --color-border-primary and --font-sans to match the person's theme. In the page, mausbot.send(text) sends text as the person's next message (only after they click in it), mausbot.open(url) opens a link, and mausbot.setContext(text) tells you what they see, with their next message. At most 256 KB. To replace a page you showed, in place, call this again with the app_id it returned and new html, jsx or path (was update_html); it reloads, so anything the person did in it is lost. Never put secrets in it. Not available in rooms. For a data dashboard, follow the data-dashboards skill.",
     inputSchema: {
       type: "object",
       additionalProperties: false,
```

**File**: `server/drivers/agents-catalog-goldens/full.tools-list.json` (modified, +1/-1)
```diff
@@ -441,7 +441,7 @@
     },
     {
       "name": "show_html",
-      "description": "Show a small self-contained web page in this chat, where the person watches it appear and can point at a part to change: a mini app, a game, a chart, a calculator, a report. For forms and choices use show_widget instead, and for plain data a markdown table. Send `html`, one HTML document (a fragment is wrapped) with inline style and script, or `jsx`, one React component file with a default export: it can import react, lucide-react icons, echarts, and Chart and useTheme from \"mausbot\", and style with Tailwind classes. Or send `path`, a folder in your working folder with index.html and its files (scripts, images, csv, geojson or parquet data; up to 5 MB). It runs in a locked sandbox: no network requests, cookies, storage, popups or form posts. Scripts, styles and fonts load only from cdnjs.cloudflare.com, cdn.jsdelivr.net, unpkg.com and Google Fonts; images must be data: URLs or come from those CDNs. Embed the data you need. Use the CSS variables --color-text-primary, --color-background-primary, --color-border-primary and --font-sans to match the person's theme. In the page, mausbot.send(text) sends text as the person's next message (only after they click in it), mausbot.open(url) opens a link, and mausbot.setContext(text) tells you what they see, with their next message. At most 256 KB. To replace a page you showed, in place, call this again with the app_id it returned and new html, jsx or path (was update_html); it reloads, so anything the person did in it is lost. Never put secrets in it. Not available in rooms. For a data dashboard, follow the data-dashboards skill.",
+      "description": "Show a small self-contained web page in this chat, where the person watches it appear and can point at a part to change: a mini app, a game, a chart, a calculator, a report. For maps, canvases, games or anything that fills the window, pass `height`. For forms and choices use show_widget instead, and for plain data a markdown table. Send `html`, one HTML document (a fragment is wrapped) with inline style and script, or `jsx`, one React component file with a default export: it can import react, lucide-react icons, echarts, and Chart and useTheme from \"mausbot\", and style with Tailwind classes. Or send `path`, a folder in your working folder with index.html and its files (scripts, images, csv, geojson or parquet data; up to 5 MB). It runs in a locked sandbox: no network requests, cookies, storage, popups or form posts. Scripts, styles and fonts load only from cdnjs.cloudflare.com, cdn.jsdelivr.net, unpkg.com and Google Fonts; images must be data: URLs or come from those CDNs. Embed the data you need. Use the CSS variables --color-text-primary, --color-background-primary, --color-border-primary and --font-sans to match the person's theme. In the page, mausbot.send(text) sends text as the person's next message (only after they click in it), mausbot.open(url) opens a link, and mausbot.setContext(text) tells you what they see, with their next message. At most 256 KB. To replace a page you showed, in place, call this again with the app_id it returned and new html, jsx or path (was update_html); it reloads, so anything the person did in it is lost. Never put secrets in it. Not available in rooms. For a data dashboard, follow the data-dashboards skill.",
       "inputSchema": {
         "type": "object",
         "additionalProperties": false,
```

**File**: `server/drivers/agents-catalog-goldens/profiles.json` (modified, +54/-54)
```diff
@@ -1,7 +1,7 @@
 {
   "default": {
-    "bytes": 59335,
-    "sha256": "bb1d91bb78f2231de50a2d9d23c6727cbde3939e1e696d43fa2ae5404c20102e",
+    "bytes": 59411,
+    "sha256": "92746f6c81a83ce92dc4ff786677d396366d2acd36d5391fae643ec0d900258f",
     "tools": [
       "tool_result_read",
       "list_room_targets",
@@ -51,8 +51,8 @@
     ]
   },
   "voice": {
-    "bytes": 60116,
-    "sha256": "8d6c2f704478ee6857b370e065083cf8f82078147defce0fb6f22521b31ff701",
+    "bytes": 60192,
+    "sha256": "39737fd096d648156b3fc1a72525b165e66960a60b54c513a3bbd8c323ced5e8",
     "tools": [
       "tool_result_read",
       "list_room_targets",
@@ -103,8 +103,8 @@
     ]
   },
   "shared": {
-    "bytes": 61600,
-    "sha256": "a404a6ee9252d45e088068e1a73ff300ae22602082eb7391b88dc663102449ba",
+    "bytes": 61676,
+    "sha256": "488aa058a44ca826f1af4328830236be670a148d432a37f0409ecdc1a9f61d75",
     "tools": [
       "tool_result_read",
       "list_shared_computers",
@@ -156,8 +156,8 @@
     ]
   },
   "shared+voice": {
-    "bytes": 62381,
-    "sha256": "d3255a56e24880bcc73ea940fa75b52195387a5c8cf51849eb500c30becb2d73",
+    "bytes": 62457,
+    "sha256": "1e3256702ed19ae0b429916c8eb6f32e085709a18e730bd41c81c2d5900ee932",
     "tools": [
       "tool_result_read",
       "list_shared_computers",
@@ -210,8 +210,8 @@
     ]
   },
   "skills": {
-    "bytes": 62262,
-    "sha256": "66cfaa37f07114d5c228403a011ad4a002e7dc241c8c8c3fb97cd402f35a43f9",
+    "bytes": 62338,
+    "sha256": "3a9c86f8eaf455cab5e599187d172856c300dab747ba3b4ddb882402ed8bcf43",
     "tools": [
       "tool_result_read",
       "list_room_targets",
@@ -263,8 +263,8 @@
     ]
   },
   "skills+voice": {
-    "bytes": 63043,
-    "sha256": "50627f02d6efb6e4a520017a155e5970ccdd435e13bead5b3bd5080b0a34a520",
+    "bytes": 63119,
+    "sha256": "1222c7a07f23660d63a08659df22985d79183c42f69ee7f7ccd50f61f76e7ea8",
     "tools": [
       "tool_result_read",
       "list_room_targets",
@@ -317,8 +317,8 @@
     ]
   },
   "skills+shared": {
-    "bytes": 64527,
-    "sha256": "2e993d2ae51a1dfc1fb39f621d0fd0a7866f5ef261c732f8c36a22f7d338c68c",
+    "bytes": 64603,
+    "sha256": "fa9f4d5e0056c3d297f03d15f9ec63d3496f2b48afa82ae684933531abc92d17",
     "tools": [
       "tool_result_read",
       "list_shared_computers",
@@ -372,8 +372,8 @@
     ]
   },
   "skills+shared+voice": {
-    "bytes": 65308,
-    "sha256": "9ef28fe5caed028538a4560bbfae791f28dae24f7948de8d691d10c0a937ffc0",
+    "bytes": 65384,
+    "sha256": "e2a98bfde725ce6507e0a7f03fbd173cb8256085df68cd443bff6ccca4d44484",
     "tools": [
       "tool_result_read",
       "list_shared_computers",
@@ -428,8 +428,8 @@
     ]
   },
   "non-chief": {
-    "bytes": 50119,
-    "sha256": "554726c315150eab42be820c4f0ed544b07a955b246178e82bc752815ebfacee",
+    "bytes": 50195,
+    "sha256": "c416529edad65a113fe6885dc0fc43f9836d040cbe177256a2ed85aeab37615b",
     "tools": [
       "tool_result_read",
       "list_room_targets",
@@ -472,8 +472,8 @@
     ]
   },
   "voice+non-chief": {
-    "bytes": 50900,
-    "sha256": "6064fc85e1bff66b698639c5fe6c36c2aa5068655cc1d46798364acc9c70405d",
+    "bytes": 50976,
+    "sha256": "243437fdbc5b76ad0ea4082dad5ca5845620bbb91b00d49fc3d73c0230df5382",
     "tools": [
       "tool_result_read",
       "list_room_targets",
@@ -517,8 +517,8 @@
     ]
   },
   "shared+non-chief": {
-    "bytes": 52384,
-    "sha256": "ad0e7d200a895f0e312b7f8726f253f3a5fcc6d93115cc9aa5397c3be707def0",
+    "bytes": 52460,
+    "sha256": "da825d7472f3c74b4d8f0a57abc7d7430b1a5bd20ef5a245b3164154875351cb",
     "tools": [
       "tool_result_read",
       "list_shared_computers",
@@ -563,8 +563,8 @@
     ]
   },
   "shared+voice+non-chief": {
-    "bytes": 53165,
-    "sha256": "b4ebb2e21440a76cb5e1a5f5bae40da396957a4bbb574b87235fe5f5eb9104df",
+    "bytes": 53241,
+    "sha256": "ddca5aa4d01dc838fe9d685265c7a49b42764370ecd99e3ff4ee85f801cd3f9e",
     "tools": [
       "tool_result_read",
       "list_shared_computers",
@@ -610,8 +610,8 @@
     ]
   },
   "skills+non-chief": {
-    "bytes": 53046,
-    "sha256": "c066a8d93ce53263a2b9e138f576b11cd312852a378192b0f249737b37a4cbc6",
+    "bytes": 53122,
+    "sha256": "4cc1ecd0c12d8e2f1807484a6bc5ed81a31923f23be5eb51de2f6156a4cd2650",
     "tools": [
       "tool_result_read",
       "list_room_targets",
@@ -656,8 +656,8 @@
     ]
   },
   "skills+voice+non-chief": {
-    "bytes": 53827,
-    "sha256": "d6b076820db28daf4456c6bf3df654afb2f7e23d73a3d577b1699625f74757fc",
+    "bytes": 53903,
+    "sha256": "bd1152c61fd04996d0b2f1905892398227979feb4902dd4b92b62fbe29405a2c",
     "tools": [
       "tool_result_read",
       "list_room_targets",
@@ -703,8 +703,8 @@
     ]
   },
   "skills+shared+non-chief": {
-    "bytes": 55311,
-    "sha256": "f0c2b29ae4695a3930885dcfef7119151d65b6ad76eef3f7a9c7202a16c4d123",
+    "bytes": 55387,
+    "sha256": "69b471ad769167d513c398017d52a211369348e5bd77aac7208915773b736ec3",
     "tools": [
       "tool_result_read",
  
```

**File**: `server/drivers/agents-catalog-wire.test.ts` (modified, +8/-8)
```diff
@@ -83,31 +83,31 @@ const FULL = "skills+shared+voice+escalations+x+team+images";
 
 /** Bytes when the budget was last set; a profile may move at most 2% either way (lower it to lock in a win). */
 const BUDGET_BASELINE: Record<string, number> = {
-  "default": 58250,
+  "default": 59416,
   "voice": 59031,
   "shared": 60515,
   "shared+voice": 61296,
-  "skills": 61069,
-  "skills+voice": 61850,
-  "skills+shared": 63334,
+  "skills": 62343,
+  "skills+voice": 63124,
+  "skills+shared": 64608,
   "skills+shared+voice": 64115,
   "non-chief": 49935,
   "voice+non-chief": 50716,
   "shared+non-chief": 52200,
   "shared+voice+non-chief": 52981,
   "skills+non-chief": 52754,
-  "skills+voice+non-chief": 52793,
+  "skills+voice+non-chief": 53908,
   "skills+shared+non-chief": 55212,
-  "skills+shared+voice+non-chief": 55058,
+  "skills+shared+voice+non-chief": 56173,
   "skills+shared+voice+cloud-home": 64782,
   "skills+shared+voice+non-chief+cloud-home": 55566,
-  "default+legacy-switches": 58250,
+  "default+legacy-switches": 59416,
   "default+mausbot": 58901,
   "skills+shared+voice+mausbot": 64766,
   "skills+shared+voice+escalations": 64945,
   "skills+shared+voice+escalations+x": 68784,
   "skills+shared+voice+escalations+x+team": 69416,
-  "default+no-computer-pick": 57038,
+  "default+no-computer-pick": 58204,
   "default+room": 50849,
   "non-chief+room": 41633,
   "skills+shared+voice+escalations+x+team+images": 70755,
```

**File**: `shared/app-frame/helper.test.ts` (modified, +132/-7)
```diff
@@ -16,25 +16,63 @@ type Listener = (event: { source: unknown; data: unknown }) => void;
 const pages: Window[] = [];
 afterEach(async () => { for (const page of pages.splice(0)) await page.happyDOM.close(); });
 
-function boot(engaged = true) {
+/** What the fake frame's layout answers: the page's flow when html and body are freed, at a frame of `height`, and the
+ * elements under the frame's middle. "window" follows the frame; `freed` is an element's height in the freed layout. */
+interface Scene {
+  flow: (height: number) => number;
+  under?: Array<{ position?: "absolute" | "fixed"; width: number | "window"; height: number | "window"; freed?: number }>;
+}
+
+function boot(engaged = true, options: { scene?: Scene; start?: number; loaded?: boolean } = {}) {
   const page = new Window();
   pages.push(page);
   const listeners = new Set<Listener>();
+  const loads = new Set<() => void>();
+  const observers = new Set<() => void>();
   let bridge: AppBridge;
   const parent = {
     postMessage(data: unknown) {
       const copy = structuredClone(data);
       setTimeout(() => bridge.handleMessage({ source: frame, data: copy }), 0);
     },
   };
+  const positions = new Map<unknown, string>();
   const frame: Record<string, unknown> = {
     parent,
-    addEventListener(type: string, listener: Listener) { if (type === "message") listeners.add(listener); },
+    innerWidth: 760,
+    innerHeight: options.start ?? 520,
+    addEventListener(type: string, listener: Listener) {
+      if (type === "message") listeners.add(listener);
+      if (type === "load") loads.add(listener as unknown as () => void);
+    },
     postMessage(data: unknown) {
       const copy = structuredClone(data);
       setTimeout(() => { for (const listener of listeners) listener({ source: parent, data: copy }); }, 0);
     },
+    getComputedStyle: (element: unknown) => ({ position: positions.get(element) ?? "static" }),
   };
+  const document = page.document;
+  const root = document.documentElement;
+  Object.defineProperty(document, "readyState", { configurable: true, get: () => (options.loaded === false ? "loading" : "complete") });
+  const scene = options.scene;
+  if (scene) {
+    const freed = () => root.style.getPropertyValue("height") === "max-content";
+    const size = (value: number | "window", window: number) => (value === "window" ? window : value);
+    const rect = (width: number, height: number) => ({ width, height, top: 0, left: 0, right: width, bottom: height, x: 0, y: 0, toJSON() {} }) as DOMRect;
+    root.getBoundingClientRect = () => rect(frame.innerWidth as number, freed() ? scene.flow(frame.innerHeight as number) : frame.innerHeight as number);
+    const under = (scene.under ?? []).map((layer) => {
+      const element = document.createElement("div");
+      document.body.appendChild(element);
+      if (layer.position) positions.set(element, layer.position);
+      element.getBoundingClientRect = () => {
+        const width = size(layer.width, frame.innerWidth as number);
+        const height = size(layer.height, frame.innerHeight as number);
+        return rect(width, freed() && layer.freed !== undefined ? layer.freed : height);
+      };
+      return element;
+    });
+    (document as unknown as { elementsFromPoint(): Element[] }).elementsFromPoint = () => [...under, document.body, root];
+  }
   const seen = { messages: [] as string[], links: [] as string[], contexts: [] as unknown[], heights: [] as number[] };
   bridge = createAppBridge({
     doc: DOC,
@@ -47,18 +85,43 @@ function boot(engaged = true) {
       sendMessage: async (text) => { seen.messages.push(text); },
       openLink: (url) => { seen.links.push(url); },
       setContext: (update) => { seen.contexts.push(update); },
-      resize: (height) => { seen.heights.push(height); },
+      resize: (height) => {
+        seen.heights.push(height);
+        frame.innerHeight = height;
+        for (const observed of observers) setTimeout(observed, 0);
+      },
       engaged: () => engaged,
       teardownRequested: () => {},
       now: () => Date.now(),
     },
   });
+  class FakeResizeObserver {
+    constructor(callback: () => void) { observers.add(callback); }
+    observe() {}
+  }
   // The helper's free names, bound to this fake frame: it runs exactly as written.
   const run = new Function("window", "document", "ResizeObserver", "requestAnimationFrame", APP_HELPER_SOURCE);
-  run(frame, page.document, undefined, (callback: () => void) => setTimeout(callback, 0));
-  return { bridge, seen, frame, root: page.document.documentElement, mausbot: () => frame.mausbot as {
-    send(text: string): Promise<void>; open(url: string): Promise<void>; setContext(text: string): Promise<void>; theme: string;
-  } };
+  run(frame, document, scene ? FakeResizeObserver : undefined, (callback: () => void) => setTimeout(callback, 0));
+  return {
+    bridge, seen, frame, root,
+    load: () => { options.loaded = true; for (const listener 
```

**File**: `shared/app-frame/helper.ts` (modified, +33/-5)
```diff
@@ -76,7 +76,7 @@ export const APP_HELPER_SOURCE = `(function () {
   // in it, which in a frame that sizes to its content only ever reports the
   // frame's current height while the content spills out above and below.
   // Both are freed for the measurement and put back before the next paint.
-  var measure = function () {
+  var freedHeights = function (elements) {
     var body = document.body;
     var boxes = body ? [root, body] : [root];
     var saved = boxes.map(function (box) { return [box.style.height, box.style.minHeight, box.style.maxHeight]; });
@@ -85,7 +85,7 @@ export const APP_HELPER_SOURCE = `(function () {
       box.style.setProperty("min-height", "0", "important");
       box.style.setProperty("max-height", "none", "important");
     });
-    var height = Math.ceil(root.getBoundingClientRect().height);
+    var heights = elements.map(function (element) { return element.getBoundingClientRect().height; });
     boxes.forEach(function (box, index) {
       box.style.removeProperty("height");
       box.style.removeProperty("min-height");
@@ -94,18 +94,46 @@ export const APP_HELPER_SOURCE = `(function () {
       if (saved[index][1]) box.style.minHeight = saved[index][1];
       if (saved[index][2]) box.style.maxHeight = saved[index][2];
     });
-    return height;
+    return heights;
+  };
+  var isLayer = function (element) {
+    var position = window.getComputedStyle(element).position;
+    return position === "absolute" || position === "fixed";
+  };
+  var drawsToWindow = function () {
+    var width = window.innerWidth;
+    var height = window.innerHeight;
+    if (!width || !height || typeof document.elementsFromPoint !== "function") return false;
+    var large = document.elementsFromPoint(width / 2, height / 2).filter(function (element) {
+      var box = element.getBoundingClientRect();
+      return element !== root && element !== document.body && box.width >= width / 2 && box.height >= height / 2;
+    });
+    if (large.some(isLayer)) return true;
+    // Sized from the window with no flow of its own: a map in html, body, #map { height: 100% }.
+    return large.length > 0 && freedHeights(large).some(function (freed) { return freed < 1; });
+  };
+  // A page drawn to its window keeps the frame's starting height until its
+  // flow needs more: its layers follow the frame, so what it reports must not.
+  var SHORT_FLOW = 120;
+  var start = 0;
+  var filling = false;
+  var heightToReport = function () {
+    var flow = Math.ceil(freedHeights([root])[0]);
+    if (!start) start = Math.round(window.innerHeight) || 0;
+    if (filling && flow < Math.max(start, SHORT_FLOW)) return start;
+    filling = start > 0 && flow < SHORT_FLOW && drawsToWindow();
+    return filling ? start : flow;
   };
   var watchSize = function () {
     var last = -1;
     var queued = false;
     var later = typeof requestAnimationFrame === "function" ? requestAnimationFrame : function (fn) { return setTimeout(fn, 16); };
     var report = function () {
-      if (queued) return;
+      if (queued || document.readyState !== "complete") return;
       queued = true;
       later(function () {
         queued = false;
-        var height = measure();
+        var height = heightToReport();
         if (height !== last) { last = height; notify("ui/notifications/size-changed", { height: height }); }
       });
     };
```

#### Recent Merged Pull Requests:
- **PR #4643** (2026-11-06): Keep the edge's Caddy configs LF on Windows checkouts (@milind-soni)
- **PR #4634** (2026-11-06): chore(release): bump version to 0.1.143 (@github-actions[bot])
- **PR #4631** (2026-11-06): Control plane: keep the relay signing key across deploys, list only relay1 (@milind-soni)
- **PR #4626** (2026-11-06): Team on your own server: a home with no open port runs its own Cloudflare tunnel (@milind-soni)
- **PR #4625** (2026-11-06): doctor --host asks the MausBot connector on a server that runs one (@milind-soni)
- **PR #4624** (2026-11-06): Add Command Code as a built-in ACP engine (@milind-soni)

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

## X. Merge pull request #4643 from milind-soni/fix/edge-caddy-lf

**RULE**:
When implementing operations in `.gitattributes`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in milind-soni/OpenMausBot. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `fb31cb7d`: Merge pull request #4643 from milind-soni/fix/edge-caddy-lf. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.gitattributes`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:

# server/cloud-home.test.ts matches the edge's Caddy configs line by line with "\n", and Caddy reads them as written;
# a CRLF checkout on Windows fails every match for a reason that has nothing to do with the edge.
deploy/fly/Caddyfile* text eol=lf
deploy/fly/*.caddy text eol=lf
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `fb31cb7d` are properly handled with clean fallback behavior.


## 3. Decision Protocol & Boundary Restrictions
- Must NOT delete canonical verification records without authorization.
- Must execute independent read-back verification after every mutation.
