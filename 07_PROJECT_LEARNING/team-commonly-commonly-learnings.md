# Forensic Learning Record (Deep Inspection): Team-Commonly/commonly

> **Canonical Artifact**: `07_PROJECT_LEARNING/team-commonly-commonly-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Team-Commonly/commonly](https://github.com/Team-Commonly/commonly))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:14:12.228Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Team-Commonly/commonly`
- **Description**: Open-source room for humans + cross-vendor AI agents. Every agent gets its own name, memory, skills, and workstation. Any runtime, your infra — no per-agent fees.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1358 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/controllers/threadStateController.ts`
```
/**
 * Per-user, per-thread state — follow and collapse (W-T, TASK-029, 2/4).
 *
 * Two independent booleans on ONE record, per the threading surface ruling
 * (docs/design/threading-surface-ruling.md, "One state record, two booleans").
 * They are written by SEPARATE endpoints even so: following never implies
 * expanded, and one PATCH taking both invites a client to send the pair and
 * clobber the half the user did not touch.
 *
 * Following is a SUBSCRIPTION, deliberately not an addressing edge. Nothing
 * here writes reply_to_message_id and nothing here enqueues a mention — 3/4
 * consumes this state in the wake path, ambient-only per the #1045 ruling. If
 * a future change makes following a thread ping anyone directly, that is the
 * bug this separation exists to prevent.
 *
 * You may follow from ANY message in a thread, not only its root: the root is
 * resolved server-side via COALESCE(thread_root_id, id), matching the write
 * path's derivation in models/pg/Message. A client should never have to know
 * whether the message it is looking at happens to be a root.
 */
/* eslint-disable @typescript-eslint/no-require-imports, global-require */
const ThreadUserState = require('../models/pg/ThreadUserState');
const { getCallerId, callerHasPodWriteAccess } = require('../services/podWriteAccessService');
const { pool } = require('../config/db-pg');
const { THREADING_BACKFILL_MIGRATION: MIGRATION_NAME } = require('../constants/migrations');

interface Req {
  params: { messageId?: string };
  query: { podId?: string };
  body?: { collapsed?: unknown };
  user?: { _id?: unknown };
  userId?: unknown;
  agentUser?: { _id?: unknown };
}
interface Res {
  status: (n: number) => Res;
  json: (d: unknown) => void;
}

/**
 * Resolve the thread root for any message id, and return the pod so the
 * caller's membership can be checked against the pod that actually owns the
 * message rather than one supplied by the client.
 */
async function resolveRoot(messageId: number): Promise<{ rootId: number; podId: string } | null> {
  const { rows } = await pool.query(
    'SELECT COALESCE(thread_root_id, id) AS root_id, pod_id FROM messages WHERE id = $1',
    [messageId],
  );
  if (!rows.length) return null;
  return { rootId: Number(rows[0].root_id), podId: String(rows[0].pod_id) };
}

/**
 * The threading cutoff from the migration ledger, and whether it is knowable.
 *
 * Final shape per the merged ruling (docs/design/threading-surface-ruling.md,
 * "Pre-cutoff roots default to expanded"), which went further than my first
 * two attempts and is worth restating because both were wrong in the same
 * direction — toward collapsing:
 *
 *   row exists  -> the cutoff governs. Roots at or before it render expanded.
 *   row missing -> UNKNOWN, and unknown resolves to EXPAND EVERYTHING.
 *
 * Not "no pre-cutoff roots". Collapsed hides history and the user cannot tell
 * anything is missing; expanded is merely noisy and one click fixes it. An
 * ambiguous state must resolve to the non-destructive side.
 *
 * The un-rooted probe I had here is GONE. It tried to distinguish "fresh
 * instance" from "backfill not yet run" by counting un-rooted edges, and the
 * ruling retires it for two reasons. It cannot work: after a backfill the old
 * threads are rooted and indistinguishable from new ones, so zero un-rooted
 * means "no history" OR "already backfilled", and the row that would tell them
 * apart is the one that is missing. And it counted ORPHANS — a reply whose
 * parent is gone stays un-rooted by design, so one dead row would have pinned
 * the whole instance to expand forever.
 *
 * The backfill now always writes the row, even when it roots zero edges, so a
 * migrated instance can never present a missing row. That is what makes
 * "missing means unknown" safe rather than permanent.
 */
async function readThreadingCutoff(): Promise<{ cutoff: string | null; cutoffUnknown: boolean }> {
  try {
    const { rows } = await pool.query(
      "SELECT details->>'threadingCutoff' AS cutoff FROM migration_records WHERE name = $1",
      [MIGRATION_NAME],
    );
    // A row with a NULL cutoff still counts as written: the backfill ran and
    // found nothing to root, which is knowledge, not absence.
    if (rows.length > 0) return { cutoff: rows[0].cutoff ?? null, cutoffUnknown: false };
    return { cutoff: null, cutoffUnknown: true };
  } catch {
    // Fails toward unknown, i.e. toward expanding. Same reasoning: the
    // recoverable error is the noisy one.
    return { cutoff: null, cutoffUnknown: true };
  }
}

async function authorize(req: Req, res: Res): Promise<{ rootId: number; podId: string; userId: string } | null> {
  const userId = getCallerId(req);
  if (!userId) {
    res.status(401).json({ msg: 'auth required' });
    return null;
  }
  const messageId = Number(req.params.messageId);
  if (!Number.isInteger(messageId) || messageId <= 0) {
    res.status(400).json({ msg: 'messageId must be a positive integer' });
    return null;
  }
  const resolved = await resolveRoot(messageId);
  if (!resolved) {
    res.status(404).json({ msg: 'message not found' });
    return null;
  }
  if (!(await callerHasPodWriteAccess(resolved.podId, userId, req))) {
    // 403 and not 404: the caller named a real message. Membership on chat
    // pods is not a secret the way DM existence is.
    res.status(403).json({ msg: 'not a member of this pod' });
    return null;
  }
  return { ...resolved, userId };
}

export async function followThread(req: Req, res: Res): Promise<void> {
  try {
    const ctx = await authorize(req, res);
    if (!ctx) return;
    const row = await ThreadUserState.follow(ctx.rootId, ctx.userId, ctx.podId);
    // 200 rather than 201 on both create and re-follow. The client asked for a
    // state, it has that state; distinguishing "already following" would make
    // a double-click look like a failure for no gain to any caller.
    res.status(200).json({ threadRootId: ctx.rootId, podId: ctx.podId, following: true, followedAt: row?.followed_at });
  } catch (err: any) {
    res.status(500).json({ msg: 'failed to follow thread', error: err?.message });
  }
}

export async function unfollowThread(req: Req, res: Res): Promise<void> {
  try {
    const ctx = await authorize(req, res);
    if (!ctx) return;
    await ThreadUserState.unfollow(ctx.rootId, ctx.userId, ctx.podId);
    // Same reasoning: unfollowing what you do not follow is the state you
    // asked for, so it is a 200 and not a 404.
    res.status(200).json({ threadRootId: ctx.rootId, following: false });
  } catch (err: any) {
    res.status(500).json({ msg: 'failed to unfollow thread', error: err?.message });
  }
}

/**
 * The render path's question: my state for every thread in this pod, in one
 * query, with `collapsed` ALREADY RESOLVED — @ux-lead's ruling (56996).
 *
 * The client never sees absence and never learns the threading cutoff. Both
 * used to be its job: notice that a root has no row, then compare that root's
 * createdAt against a migration timestamp it had to be told. That is a
 * migration detail in every client's model of the system, permanently, for one
 * boolean. The row is storage; the payload is meaning.
 *
 * `following` is deliberately NOT resolved the same way. Its absence is a
 * VALUE — `null` means "defer to participation", which the wake path computes
 * against live authorship (threadWakeScopeService). Collapsing it to a boolean
 * here would either lie or force this endpoint to recompute participation on
 * the read path. Flagged to @ux-lead, whose 56996 assumed following was
 * already effective; it is not, and the asymmetry is intentional rather than
 * an oversight to be tidied.
 */
export async function listThreadState(req: Req, res: Res): Promise<void> {
  try {
    const userId = getCallerId(req);
    if (!userId) {
      res.status(401).json({ msg: 'auth required' });
      return;
    }
    const podId = String(req.query.podId || '');
    if (!podId) {
      res.status(400).json({ msg: 'podId is required' });
      return;
    }
    if (!(await callerHasPodWriteAccess(podId, userId, req))) {
      res.status(403).json({ msg: 'not a member of this pod' });
      return;
    }
    const { cutoff, cutoffUnknown } = await readThreadingCutoff();
    const rows = await ThreadUserState.effectiveStateForPod(userId, podId, cutoff, cutoffUnknown);
    res.status(200).json({
      podId,
      // `following: null` is still a value the client must interpret, so its
      // default stays stated at the wire. `collapsed` no longer appears here
      // because there is no case left in which the client supplies it.
      defaults: {
        following: null,
      },
      // Mapped, not passed through. The model speaks the table's language
      // (`thread_root_id`); the wire has said `threadRootId` since 2/4 shipped
      // and no ruling changed that. Handing the rows straight out silently
      // renamed a public field — caught by threadStateReadContract, which is
      // the reason that suite reads through the controller rather than the
      // model.
      threads: rows.map((r: { thread_root_id: number; following: boolean | null; collapsed: boolean }) => ({
        threadRootId: r.thread_root_id,
        following: r.following,
        collapsed: r.collapsed,
      })),
    });
  } catch (err: any) {
    res.status(500).json({ msg: 'failed to list thread state', error: err?.message });
  }
}

/**
 * The expand/collapse gesture — the only writer of `collapsed`.
 *
 * Separate from follow on purpose: following never implies expanded, so a
 * single "thread state" PATCH taking both booleans would invite a client to
 * send the pair and silently overwrite the one the user did not touch.
 */
export async function setThreadCollapsed(req: Req, res: Res): Promise<void> {
  try {
    const collapsedRaw = (req.body || {}).collapsed;
    if (typeof collapsedRaw !== 'boolean') {
      res.status(400).json({ msg: 'collapsed (boolean) i
```

### Core Architecture Module: `backend/models/AgentEnsembleState.ts`
```
import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type EnsembleStatus = 'pending' | 'active' | 'paused' | 'completed' | 'failed';
export type EnsembleParticipantRole = 'starter' | 'responder' | 'synthesizer' | 'observer';
export type EnsembleCompletionReason =
  | 'max_messages'
  | 'max_rounds'
  | 'max_duration'
  | 'consensus'
  | 'keyword'
  | 'manual'
  | 'scheduled_restart'
  | 'error';

export interface IEnsembleParticipant {
  agentType: string;
  instanceId: string;
  displayName?: string;
  role: EnsembleParticipantRole;
}

export interface IKeyPoint {
  content?: string;
  agentType?: string;
  turnNumber?: number;
  extractedAt?: Date;
}

export interface IAgentEnsembleState extends Document {
  podId: Types.ObjectId;
  lastProcessedMessageId?: string | null;
  status: EnsembleStatus;
  topic: string;
  participants: IEnsembleParticipant[];
  turnState: {
    currentAgent?: { agentType?: string; instanceId?: string };
    turnNumber: number;
    roundNumber: number;
    turnStartedAt?: Date;
    waitingForResponse: boolean;
    lastResponseTime?: Date | null;
    responseTimeouts: number;
  };
  stopConditions: {
    maxMessages: number;
    maxRounds: number;
    maxDurationMinutes: number;
    stopOnConsensus: boolean;
    stopKeywords: string[];
  };
  stats: {
    totalMessages: number;
    startedAt?: Date;
    completedAt?: Date;
    pausedAt?: Date;
    lastActivityAt?: Date;
    completionReason?: EnsembleCompletionReason;
  };
  keyPoints: IKeyPoint[];
  checkpoint: {
    lastMessageId?: string;
    contextSnapshot?: unknown;
    recentHistory?: Array<{ agentType?: string; content?: string; timestamp?: Date }>;
    savedAt?: Date;
  };
  summary?: {
    content?: string;
    keyInsights?: string[];
    generatedBy?: string;
    generatedAt?: Date;
  };
  schedule: {
    enabled: boolean;
    cronExpression?: string;
    timezone: string;
    lastScheduledAt?: Date;
    nextScheduledAt?: Date;
  };
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  // virtuals
  canContinue: boolean;
  // methods
  getSpeakingParticipants(): IEnsembleParticipant[];
  getNextAgent(): IEnsembleParticipant | null;
  advanceTurn(): IAgentEnsembleState;
  saveCheckpoint(data: Partial<IAgentEnsembleState['checkpoint']>): IAgentEnsembleState;
  complete(reason: EnsembleCompletionReason, summaryContent?: string): IAgentEnsembleState;
}

export interface IAgentEnsembleStateModel extends Model<IAgentEnsembleState> {
  findActiveForPod(podId: Types.ObjectId): mongoose.Query<IAgentEnsembleState | null, IAgentEnsembleState>;
  findPausedForResume(): mongoose.Query<IAgentEnsembleState[], IAgentEnsembleState>;
  findScheduledDue(): mongoose.Query<IAgentEnsembleState[], IAgentEnsembleState>;
}

const AgentEnsembleStateSchema = new Schema<IAgentEnsembleState>(
  {
    podId: { type: Schema.Types.ObjectId, ref: 'Pod', required: true, index: true },
    lastProcessedMessageId: { type: String, default: null },
    status: {
      type: String,
      enum: ['pending', 'active', 'paused', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    topic: { type: String, required: true },
    participants: [
      {
        agentType: { type: String, required: true },
        instanceId: { type: String, default: 'default' },
        displayName: String,
        role: { type: String, enum: ['starter', 'responder', 'synthesizer', 'observer'], default: 'responder' },
      },
    ],
    turnState: {
      currentAgent: { agentType: String, instanceId: String },
      turnNumber: { type: Number, default: 0 },
      roundNumber: { type: Number, default: 0 },
      turnStartedAt: Date,
      waitingForResponse: { type: Boolean, default: false },
      lastResponseTime: { type: Date, default: null },
      responseTimeouts: { type: Number, default: 0 },
    },
    stopConditions: {
      maxMessages: { type: Number, default: 20 },
      maxRounds: { type: Number, default: 5 },
      maxDurationMinutes: { type: Number, default: 60 },
      stopOnConsensus: { type: Boolean, default: false },
      stopKeywords: [String],
    },
    stats: {
      totalMessages: { type: Number, default: 0 },
      startedAt: Date,
      completedAt: Date,
      pausedAt: Date,
      lastActivityAt: Date,
      completionReason: {
        type: String,
        enum: ['max_messages', 'max_rounds', 'max_duration', 'consensus', 'keyword', 'manual', 'scheduled_restart', 'error'],
      },
    },
    keyPoints: [
      {
        content: String,
        agentType: String,
        turnNumber: Number,
        extractedAt: Date,
      },
    ],
    checkpoint: {
      lastMessageId: String,
      contextSnapshot: { type: Schema.Types.Mixed },
      recentHistory: [{ agentType: String, content: String, timestamp: Date }],
      savedAt: Date,
    },
    summary: {
      content: String,
      keyInsights: [String],
      generatedBy: String,
      generatedAt: Date,
    },
    schedule: {
      enabled: { type: Boolean, default: false },
      cronExpression: String,
      timezone: { type: String, default: 'UTC' },
      lastScheduledAt: Date,
      nextScheduledAt: Date,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

AgentEnsembleStateSchema.index({ podId: 1, status: 1 });
AgentEnsembleStateSchema.index({ status: 1, 'schedule.nextScheduledAt': 1 });

AgentEnsembleStateSchema.virtual('canContinue').get(function (this: IAgentEnsembleState) {
  if (this.status !== 'active') return false;
  const { stopConditions, stats, turnState } = this;
  if (stats.totalMessages >= stopConditions.maxMessages) return false;
  if (turnState.roundNumber >= stopConditions.maxRounds) return false;
  if (stopConditions.maxDurationMinutes > 0 && stats.startedAt) {
    const elapsed = (Date.now() - stats.startedAt.getTime()) / 1000 / 60;
    if (elapsed >= stopConditions.maxDurationMinutes) return false;
  }
  return true;
});

AgentEnsembleStateSchema.methods.getSpeakingParticipants = function (): IEnsembleParticipant[] {
  return (this.participants || []).filter((p: IEnsembleParticipant) => p.role !== 'observer');
};

AgentEnsembleStateSchema.methods.getNextAgent = function (): IEnsembleParticipant | null {
  const speaking = this.getSpeakingParticipants();
  if (!speaking.length) return null;
  const nextIndex = (this.turnState.turnNumber + 1) % speaking.length;
  return speaking[nextIndex];
};

AgentEnsembleStateSchema.methods.advanceTurn = function () {
  const { turnState } = this;
  const speaking = this.getSpeakingParticipants();
  if (!speaking.length) { turnState.waitingForResponse = false; return this; }

  turnState.turnNumber += 1;
  turnState.turnStartedAt = new Date();
  turnState.waitingForResponse = true;

  if (turnState.turnNumber % speaking.length === 0) turnState.roundNumber += 1;

  const current = speaking[turnState.turnNumber % speaking.length];
  turnState.currentAgent = { agentType: current.agentType, instanceId: current.instanceId };
  this.stats.lastActivityAt = new Date();
  return this;
};

AgentEnsembleStateSchema.methods.saveCheckpoint = function (data: Partial<IAgentEnsembleState['checkpoint']>) {
  this.checkpoint = { ...this.checkpoint, ...data, savedAt: new Date() };
  return this;
};

AgentEnsembleStateSchema.methods.complete = function (reason: EnsembleCompletionReason, summaryContent?: string) {
  this.status = 'completed';
  this.stats.completedAt = new Date();
  this.stats.completionReason = reason;
  if (summaryContent) this.summary = { content: summaryContent, generatedAt: new Date() };
  return this;
};

AgentEnsembleStateSchema.statics.findActiveForPod = function (podId: Types.ObjectId) {
  return this.findOne({ podId, status: 'active' }).sort({ createdAt: -1 });
};

AgentEnsembleStateSchema.statics.findPausedForResume = function () {
  return this.find({ status: 'paused' }).sort({ 'stats.pausedAt': 1 });
};

AgentEnsembleStateSchema.statics.findScheduledDue = function () {
  return this.find({
    status: { $in: ['pending', 'completed'] },
    'schedule.enabled': true,
    'schedule.nextScheduledAt': { $lte: new Date() },
  });
};

export default mongoose.model<IAgentEnsembleState, IAgentEnsembleStateModel>('AgentEnsembleState', AgentEnsembleStateSchema);
// CJS compat: let require() return the default export directly
// eslint-disable-next-line @typescript-eslint/no-require-imports
module.exports = exports["default"]; Object.assign(module.exports, exports);

```

### Core Architecture Module: `backend/models/HookLedgerEvent.ts`
```
import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IHookLedgerEvent extends Document {
  podId: string;
  agentId: string;
  agentName: string;
  eventId: string;
  event: string;
  tool?: string;
  argsDigest?: string;
  paths: string[];
  permissionDecision: 'allow' | 'deny';
  reason?: string;
  holder?: string;
  createdAt: Date;
}

const HookLedgerEventSchema = new Schema<IHookLedgerEvent>(
  {
    podId: { type: String, required: true },
    // Runtime agent user id is the seat identity.  agentName is retained only
    // as a human-readable label and for installation lookup compatibility.
    agentId: { type: String, required: true },
    agentName: { type: String, required: true, lowercase: true },
    eventId: { type: String, required: true },
    event: { type: String, required: true },
    tool: { type: String },
    argsDigest: { type: String, match: /^[a-f0-9]{64}$/i },
    // Resolved paths are safe metadata; raw tool arguments are intentionally
    // not represented in this ledger schema.
    paths: { type: [String], default: [] },
    permissionDecision: { type: String, enum: ['allow', 'deny'], required: true },
    reason: { type: String },
    holder: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

HookLedgerEventSchema.index({ podId: 1, agentId: 1, eventId: 1 }, { unique: true });

const HookLedgerEvent: Model<IHookLedgerEvent> = (
  mongoose.models.HookLedgerEvent as Model<IHookLedgerEvent>
) || mongoose.model<IHookLedgerEvent>('HookLedgerEvent', HookLedgerEventSchema);

export default HookLedgerEvent;
module.exports = HookLedgerEvent;

```

### Core Architecture Module: `backend/models/OAuthLoginState.ts`
```
import mongoose, { Document, Schema, Types } from 'mongoose';

// One row per social-login attempt. Lives for the length of the OAuth
// round-trip and is deliberately separate from OAuthState (the X/Twitter
// integration model) — that flow authorizes an existing user's integration,
// this one authenticates a possibly-not-yet-existing user.
//
// Lifecycle: created at /oauth/:provider/start (state minted) → validated +
// marked used at /oauth/:provider/callback (userId + one-time exchangeCode
// stamped) → consumed at /oauth/exchange (JWT issued, exchangedAt stamped).
// The TTL index reaps abandoned attempts.

export type OAuthLoginProvider = 'github' | 'google';

export interface IOAuthLoginState extends Document {
  provider: OAuthLoginProvider;
  state: string;
  // Optional invite code captured at /start so an OAuth signup can satisfy
  // the invite-only gate without a form round-trip.
  invitationCode?: string;
  // Frontend path to land on after login completes. Must be app-relative.
  next?: string;
  userId?: Types.ObjectId | null;
  exchangeCode?: string | null;
  exchangeExpiresAt?: Date | null;
  usedAt?: Date | null;
  exchangedAt?: Date | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OAuthLoginStateSchema = new Schema<IOAuthLoginState>(
  {
    provider: { type: String, required: true, enum: ['github', 'google'], index: true },
    state: { type: String, required: true, unique: true, index: true },
    invitationCode: { type: String, default: '' },
    next: { type: String, default: '/v2' },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    // NO default here — a sparse unique index skips MISSING fields but still
    // indexes explicit nulls, so `default: null` made every pending state row
    // collide on exchangeCode:null and 500'd the second /start ever served
    // (2026-07-03 incident). The field stays absent until the callback stamps
    // it; uniqueness is enforced by the partial index below.
    exchangeCode: { type: String },
    exchangeExpiresAt: { type: Date, default: null },
    usedAt: { type: Date, default: null },
    exchangedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true, collection: 'oauth_login_states' },
);

// Unique only over rows that actually carry a code (post-callback). If this
// index shape ever changes, drop the old `exchangeCode_1` index in Mongo by
// hand — createIndex won't replace an existing index with different options.
OAuthLoginStateSchema.index(
  { exchangeCode: 1 },
  { unique: true, partialFilterExpression: { exchangeCode: { $type: 'string' } } },
);

export default mongoose.model<IOAuthLoginState>('OAuthLoginState', OAuthLoginStateSchema);
// CJS compat: let require() return the default export directly
// eslint-disable-next-line @typescript-eslint/no-require-imports
module.exports = exports["default"]; Object.assign(module.exports, exports);

```

### Core Architecture Module: `backend/models/OAuthState.ts`
```
import mongoose, { Document, Schema, Types } from 'mongoose';

export type OAuthProvider = 'x';

export interface IOAuthState extends Document {
  provider: OAuthProvider;
  state: string;
  userId: Types.ObjectId;
  codeVerifier: string;
  redirectPath: string;
  expiresAt: Date;
  usedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const OAuthStateSchema = new Schema<IOAuthState>(
  {
    provider: { type: String, required: true, enum: ['x'], index: true },
    state: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    codeVerifier: { type: String, required: true },
    redirectPath: { type: String, default: '/admin/integrations/global' },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'oauth_states' },
);

export default mongoose.model<IOAuthState>('OAuthState', OAuthStateSchema);
// CJS compat: let require() return the default export directly
// eslint-disable-next-line @typescript-eslint/no-require-imports
module.exports = exports["default"]; Object.assign(module.exports, exports);

```

### Core Architecture Module: `backend/models/WebhookDelivery.ts`
```
import mongoose, { Document, Schema } from 'mongoose';

// Atomic claim-based webhook dedup (connector hardening, 2026-08-31 study §gap 2).
// Providers redeliver: Telegram re-sends an update until it gets a 200, Slack
// retries on slow acks. Without a claim on the provider's delivery id, every
// redelivery of an already-processed update becomes a duplicate pod message and
// a duplicate agent wake (admitted in the bridge's own comments).
//
// Contract (claim-before-run, route-specific error policy):
//   1. On receipt, atomically create {provider, deliveryId}. A duplicate-key
//      error means another delivery of the same update is processing or done —
//      ack 200 and stop.
//   2. If processing THROWS before relay starts, a route may release the claim
//      before its non-2xx response so the provider's redelivery retries. Once
//      relay starts, retain the claim through downstream errors: a post-write
//      failure must not release and duplicate the pod message.
// The TTL bounds the table: a delivery id only needs to be remembered for as
// long as the provider keeps redelivering it.
//
// Key scope: {provider, deliveryId}. Provider routes that serve more than one
// account namespace their deliveryId with the account identity (for example,
// Slack `team:event` and Discord `webhook:event`). Telegram serves one bot and
// retains its sequential update_id as-is.
export interface IWebhookDelivery extends Document {
  provider: string;
  deliveryId: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WebhookDeliverySchema = new Schema<IWebhookDelivery>(
  {
    provider: { type: String, required: true },
    deliveryId: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: true, collection: 'webhook_deliveries' },
);

WebhookDeliverySchema.index({ provider: 1, deliveryId: 1 }, { unique: true });

export default mongoose.model<IWebhookDelivery>('WebhookDelivery', WebhookDeliverySchema);
// CJS compat: let require() return the default export directly
// eslint-disable-next-line @typescript-eslint/no-require-imports
module.exports = exports["default"]; Object.assign(module.exports, exports);

```

### Core Architecture Module: `backend/models/pg/ThreadUserState.ts`
```
/**
 * ThreadUserState — per-user, per-thread state (W-T, TASK-029).
 *
 * ONE record carrying both `following` and `collapsed`, per the ruling in
 * docs/design/threading-surface-ruling.md, section "One state record, two
 * booleans".
 *
 * Cited by DOC AND SECTION, never by commit sha. #1107 and #1112 were both
 * squash-merged, which rewrote every sha discussed in the pod — 5e7060fd,
 * 392b86e5 and 41707609 all resolve in a working clone that still has the
 * branches and are on NONE of main. A sha citation to a squashed PR is a
 * dangling pointer the moment anyone clones fresh (@ux-lead 56830, who hit
 * the same thing checking their own work): they share the key (user, pod, thread root), so two tables would
 * mean two writes for one gesture. The collapse column ships here rather than
 * in the render PR because the key already exists.
 *
 * A row means "this user has non-default state on this thread". Row PRESENCE
 * carries no meaning on its own — a collapse write creates rows for users who
 * are not following, so `following` has to be a column. If presence meant
 * following, expanding a thread would subscribe you to it.
 *
 * `following` is TRI-STATE on purpose:
 *   NULL  — no explicit choice; defer to the participation default (posted in
 *           the thread or was @-mentioned => following). Resolving that
 *           default is 3/4's job, in the wake path.
 *   TRUE  — explicitly followed.
 *   FALSE — explicitly unfollowed. For a participant this is a MUTE and must
 *           outrank the participation default, which is exactly why a
 *           NOT NULL DEFAULT false would be a bug rather than a simplification.
 */
/* eslint-disable @typescript-eslint/no-require-imports, global-require */
const { pool } = require('../../config/db-pg');

interface PgPool {
  query: (text: string, values?: unknown[]) => Promise<{ rows: any[]; rowCount: number }>;
}

export interface ThreadUserStateRow {
  id: number;
  thread_root_id: number;
  user_id: string;
  pod_id: string;
  following: boolean | null;
  collapsed: boolean;
  followed_at: string;
  updated_at: string;
}

/**
 * Upsert exactly ONE column, leaving the other at whatever it already was (or
 * at its schema default if the row is new). Every writer here is a single
 * gesture — a follow toggle must not silently re-collapse an expanded thread,
 * and an expand must not silently subscribe you.
 */
async function upsertOne(
  column: 'following' | 'collapsed',
  threadRootId: number,
  userId: string,
  podId: string,
  value: boolean | null,
): Promise<ThreadUserStateRow> {
  // `column` is never caller-supplied — it is one of two literals chosen by
  // the call sites below, so the interpolation cannot carry user input.
  //
  // The UPDATE set names EXACTLY the target column plus updated_at, per
  // ux-lead's ruling. It previously also wrote
  // `pod_id = EXCLUDED.pod_id`, which was both a deviation and inconsistent
  // with followByParticipation, which never rewrote it. A thread root's pod
  // cannot change — the root implies it — so that write could only ever be a
  // no-op or a bug quietly papered over. If a row's pod_id ever disagrees with
  // the caller's, that is a fact worth surfacing rather than overwriting.
  //
  // On INSERT the other column is not supplied at all, so it takes its schema
  // default: `following` → NULL (defer to participation), `collapsed` → TRUE.
  const { rows } = await (pool as PgPool).query(
    `INSERT INTO thread_user_state (thread_root_id, user_id, pod_id, ${column})
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (thread_root_id, user_id)
     DO UPDATE SET ${column} = EXCLUDED.${column},
                   updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [threadRootId, userId, podId, value],
  );
  return rows[0];
}

class ThreadUserState {
  /** Explicit follow. Idempotent — following twice is the state you asked for. */
  static async follow(threadRootId: number, userId: string, podId: string): Promise<ThreadUserStateRow> {
    return upsertOne('following', threadRootId, userId, podId, true);
  }

  /**
   * Explicit unfollow. Writes FALSE rather than deleting the row: for a thread
   * participant, "no row" means following-by-participation, so a delete would
   * re-subscribe them on the next reply. Deleting would also discard their
   * collapse state.
   */
  static async unfollow(threadRootId: number, userId: string, podId: string): Promise<ThreadUserStateRow> {
    return upsertOne('following', threadRootId, userId, podId, false);
  }

  /** Clear the explicit choice and fall back to the participation default. */
  static async clearFollowChoice(threadRootId: number, userId: string, podId: string): Promise<ThreadUserStateRow> {
    return upsertOne('following', threadRootId, userId, podId, null);
  }

  /**
   * Follow because you participated — posted in the thread, or were mentioned
   * in it (55854: "implicit by participation").
   *
   * Writes TRUE only where `following IS NULL`. An explicit FALSE is a MUTE and
   * outranks participation, so this must never flip it: otherwise a mute is one
   * @mention away from being silently revoked, and the user never asked for
   * that. Muting a thread and then being mentioned in it is the ordinary case,
   * not an edge one.
   *
   * The mention still WAKES the muted user — a mute scopes ambient activity,
   * never addressing. That is the wake path's job (3/4); this only decides
   * whether the subscription gets created.
   *
   * Returns the resulting state by re-reading, NOT by trusting rowCount: a
   * conditional DO UPDATE that matches nothing is not distinguishable from one
   * that wrote, across drivers.
   */
  static async followByParticipation(
    threadRootId: number, userId: string, podId: string,
  ): Promise<boolean | null> {
    await (pool as PgPool).query(
      `INSERT INTO thread_user_state (thread_root_id, user_id, pod_id, following)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (thread_root_id, user_id)
       DO UPDATE SET following = TRUE, updated_at = CURRENT_TIMESTAMP
       WHERE thread_user_state.following IS NULL`,
      [threadRootId, userId, podId],
    );
    const { rows } = await (pool as PgPool).query(
      'SELECT following FROM thread_user_state WHERE thread_root_id = $1 AND user_id = $2',
      [threadRootId, userId],
    );
    return rows[0]?.following ?? null;
  }

  /** The expand/collapse gesture. The ONLY writer of `collapsed`. */
  static async setCollapsed(
    threadRootId: number, userId: string, podId: string, collapsed: boolean,
  ): Promise<ThreadUserStateRow> {
    return upsertOne('collapsed', threadRootId, userId, podId, collapsed);
  }

  /**
   * Users who have EXPLICITLY followed. Deliberately does not include
   * participation-default followers — resolving that default needs the thread's
   * participant set, which lives in `messages`, and 3/4 owns that join. A
   * caller that treats this as "everyone who should wake" will under-notify;
   * the name says so, because `followerIds` would have made that read correct.
   */
  static async explicitFollowerIds(threadRootId: number): Promise<string[]> {
    const { rows } = await (pool as PgPool).query(
      'SELECT user_id FROM thread_user_state WHERE thread_root_id = $1 AND following IS TRUE',
      [threadRootId],
    );
    return rows.map((r) => String(r.user_id));
  }

  /** Users who have explicitly MUTED — these outrank the participation default. */
  static async mutedUserIds(threadRootId: number): Promise<string[]> {
    const { rows } = await (pool as PgPool).query(
      'SELECT user_id FROM thread_user_state WHERE thread_root_id = $1 AND following IS FALSE',
      [threadRootId],
    );
    return rows.map((r) => String(r.user_id));
  }

  /**
   * Everything the render path needs for one pod, with `collapsed` ALREADY
   * RESOLVED for every root in the pod — @ux-lead's ruling (56996).
   *
   * The sparse version below returns only rows that exist, which pushes two
   * jobs onto the client: notice absence, and know the threading cutoff to
   * interpret it (`collapsed = row?.collapsed ?? (root.createdAt >= cutoff)`).
   * That makes the cutoff part of every client's model of the system for the
   * sake of one boolean. The row is storage; the payload is meaning.
   *
   * So this enumerates the pod's roots and left-joins the caller's state. A
   * root is a message something else points at, which is exactly when a thread
   * starts existing. Written as an uncorrelated `IN (SELECT DISTINCT …)`
   * rather than a correlated `EXISTS`: pg-mem cannot resolve the outer alias
   * inside a correlated subquery here ("column root.id does not exist"), and
   * the uncorrelated form is equivalent, runs on both, and keeps this query
   * exercisable at the unit tier instead of only against a real server.
   *
   * The three-state cutoff is resolved here rather than at the wire, and the
   * ORDER of the CASE arms is the whole #1115 ruling:
   *   cutoffUnknown          -> false. Never collapse on an unknown.
   *   cutoff NULL, known     -> true. The backfill ran and rooted nothing, so
   *                             there is no pre-cutoff history to protect.
   *   otherwise              -> created_at >= cutoff.
   *
   * Cost, since a comment on the old shape argued against paying it: this is
   * one extra join bounded by the pod's THREAD count, not its message count,
   * and the caller is already rendering those messages. The argument that it
   * "duplicates data the client already has" was mine and it was the wrong
   * trade — it bought an O(1) payload by making every future client carry a
   * migration detail.
   */
  static async effectiveStateForPod(
    userId: string,
    podId: string,
    cutoff: Date | string | null,
    cutoffUnknown: boolean,
  ): Promise<Array<{ thread_root_id: number; following: boolean | null; collapsed: boolean }>> {
    const { rows } = await (pool as PgPool).query(
      `SELECT 
```

### Core Architecture Module: `backend/routes/agentHooks.ts`
```
export {};

import rateLimit from 'express-rate-limit';
import { cloudflareIpRateLimitKeyGenerator } from '../middleware/ipRateLimit';
import { createHash } from 'crypto';

const express = require('express');
const agentRuntimeAuth = require('../middleware/agentRuntimeAuth');
const { AgentInstallation } = require('../models/AgentRegistry');
const {
  HOOK_EVENT_TYPES,
  isHookEventType,
  processHookEvent,
} = require('../services/agentHookService');

const router = express.Router();

// CodeQL anchors on the first middleware in the chain.  Keep the limiter
// before agentRuntimeAuth: authentication performs a database lookup and a
// malformed/compromised token must not turn that lookup into a DoS primitive.
const hookRateLimit = rateLimit({
  windowMs: 60_000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    const token = String(req.header('x-commonly-agent-token') || req.header('authorization') || '').trim();
    return token
      ? `token:${createHash('sha256').update(token).digest('hex')}`
      : cloudflareIpRateLimitKeyGenerator(req as never);
  },
  handler: (_req: any, res: any) => res.status(429).json({
    code: 'rate_limited',
    message: 'hook rate limit exceeded',
  }),
});

const normalize = (value: unknown): string => String(value || '').trim().toLowerCase();

const resolveIdentity = (req: any): { agentId: string; agentName: string; instanceId: string } => ({
  agentId: String(req.agentUser?._id || req.agentUser?.id || '').trim(),
  agentName: normalize(
    req.agentUser?.botMetadata?.agentName
      || req.agentInstallation?.agentName
      || req.agentUser?.username,
  ),
  instanceId: String(
    req.agentUser?.botMetadata?.instanceId
      || req.agentInstallation?.instanceId
      || 'default',
  ),
});

const readLean = async (query: any): Promise<any> => {
  if (query && typeof query.lean === 'function') return query.lean();
  return query;
};

const eventName = (body: any): unknown => body?.event || body?.hook_event_name || body?.event_name;

const hasControlCharacter = (value: string): boolean => Array.from(value)
  .some((character) => character.charCodeAt(0) < 0x20);

const sanitizeHookBody = (body: any, event: string, eventId: string) => ({
  event,
  eventId,
  ...(typeof body?.tool === 'string' ? { tool: body.tool } : {}),
  ...(typeof body?.tool_name === 'string' ? { tool: body.tool_name } : {}),
  ...(typeof body?.argsDigest === 'string' ? { argsDigest: body.argsDigest } : {}),
  ...(typeof body?.args_digest === 'string' ? { argsDigest: body.args_digest } : {}),
  ...(Array.isArray(body?.paths) ? { paths: body.paths.filter((value: any) => typeof value === 'string') } : {}),
});

/**
 * Claude/Codex hook ingress.  The endpoint returns the same decision for a
 * replayed (pod, agent, eventId) tuple and never echoes the event payload.
 */
router.post('/pods/:podId/hooks', hookRateLimit, agentRuntimeAuth, async (req: any, res: any) => {
  const podId = String(req.params.podId || '').trim();
  const body = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body
    : null;
  const event = eventName(body);
  const eventId = typeof body?.eventId === 'string'
    ? body.eventId.trim()
    : (typeof body?.event_id === 'string' ? body.event_id.trim() : '');

  if (!podId || !body) {
    return res.status(400).json({ code: 'invalid_hook', message: 'a JSON object and podId are required' });
  }
  if (!isHookEventType(event)) {
    return res.status(400).json({
      code: 'invalid_event',
      message: `event must be one of ${HOOK_EVENT_TYPES.join(', ')}`,
    });
  }
  if (!eventId || eventId.length > 200 || hasControlCharacter(eventId)) {
    return res.status(400).json({ code: 'invalid_event_id', message: 'eventId is required' });
  }

  const { agentId, agentName, instanceId } = resolveIdentity(req);
  if (!agentId || !agentName) return res.status(401).json({ code: 'agent_identity_unresolved' });

  try {
    // agentRuntimeAuth authorizes a token globally.  This second lookup is
    // intentional: a token for pod A must not submit a hook for pod B.
    const installationQuery = AgentInstallation.findOne({
      agentName,
      instanceId,
      podId,
      status: 'active',
    });
    const installation = await readLean(installationQuery);
    if (!installation) {
      return res.status(403).json({ code: 'not_installed', message: 'agent is not installed in this pod' });
    }

    // Hook bodies are an ingress contract, not an event archive.  Keep only
    // the tool name, digest, and already-resolved paths; in particular never
    // pass Claude's raw tool_input (which may contain Write contents) onward.
    const payload = sanitizeHookBody(body, String(event), eventId);
    const result = await processHookEvent({
      podId,
      agentId,
      agentName,
      event,
      eventId,
      payload,
    });
    return res.status(result.statusCode).json(result.response);
  } catch {
    // Do not include body/tool_input in diagnostics: hook payloads may carry
    // source, credentials, or command arguments. D7 is fail-open at this
    // runtime edge, so an unavailable ledger cannot invent a deny decision.
    return res.status(200).json({
      eventId,
      event,
      permissionDecision: 'allow',
      reason: 'hook_unavailable',
    });
  }
});

module.exports = router;

```

### Core Architecture Module: `backend/routes/webhooks/discord.ts`
```
const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const DiscordService = require('../../services/discordService');
const DiscordIntegration = require('../../models/DiscordIntegration');
const {
  WEBHOOK_DELIVERY_TTL_MS,
  claimDelivery,
  releaseDelivery,
} = require('../../services/webhookDeliveryService');
const { verifyDiscordSignature } = require('../../services/webhookVerificationService');
const { cloudflareIpRateLimitKeyGenerator } = require('../../middleware/ipRateLimit');

// webhook_id is supplied by the caller before signature verification, so keep
// a coarse Cloudflare-aware IP ceiling ahead of the per-webhook bucket.
const discordWebhookIpRateLimit = rateLimit({
  windowMs: 60_000,
  max: 3_000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: (req: any) => `discord-ip:${cloudflareIpRateLimitKeyGenerator(req)}`,
  handler: (_req: unknown, res: any) => res.status(429).json({ error: 'Too many Discord webhook requests from this IP' }),
});

const discordWebhookRateLimit = rateLimit({
  windowMs: 60_000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: (req: any) => {
    const webhookId = String(req.query?.webhook_id || req.headers?.['x-discord-webhook-id'] || '')
      .replace(/[^a-zA-Z0-9_-]/g, '');
    return webhookId ? `discord:${webhookId}` : `discord:${cloudflareIpRateLimitKeyGenerator(req)}`;
  },
  handler: (_req: unknown, res: any) => res.status(429).json({ error: 'Too many Discord webhook requests' }),
});

const header = (req: any, name: string): string => String(req.get?.(name) || req.headers?.[name.toLowerCase()] || '');

export const verifyDiscordWebhookRequest = (req: any): boolean => {
  if (process.env.DISCORD_WEBHOOK_ALLOW_UNVERIFIED === 'true') return true;
  const rawBody = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body || {});
  return verifyDiscordSignature({
    publicKey: process.env.DISCORD_PUBLIC_KEY,
    timestamp: header(req, 'x-signature-timestamp'),
    signature: header(req, 'x-signature-ed25519'),
    rawBody,
  });
};

// Discord webhook endpoint
router.post('/', discordWebhookIpRateLimit, discordWebhookRateLimit, async (req: any, res: any) => {
  let deliveryId: string | null = null;
  try {
    const event = req.body;

    if (!event || typeof event !== 'object') {
      return res.status(400).json({ error: 'Invalid Discord event' });
    }

    if (!verifyDiscordWebhookRequest(req)) {
      return res.status(401).json({ error: 'Invalid Discord signature' });
    }

    // Handle Discord webhook verification
    if (event.type === 1) {
      // PING
      return res.json({ type: 1 }); // PONG
    }

    // Extract webhook ID from the request
    const webhookId = req.query.webhook_id || req.headers['x-discord-webhook-id'];

    if (!webhookId) {
      console.error('No webhook ID provided');
      return res.status(400).json({ error: 'Missing webhook ID' });
    }

    // Find the Discord integration by webhook ID
    const discordIntegration = await DiscordIntegration.findOne({
      webhookId,
      isActive: true,
    });

    if (!discordIntegration) {
      console.error('Discord integration not found for webhook ID:', webhookId);
      return res.status(404).json({ error: 'Integration not found' });
    }

    const eventId = event.id;
    if (!eventId) return res.status(400).json({ error: 'Missing Discord event id' });
    deliveryId = `${String(webhookId)}:${String(eventId)}`;
    const claim = await claimDelivery('discord', deliveryId, WEBHOOK_DELIVERY_TTL_MS);
    if (claim === 'unavailable') {
      return res.status(503).json({ error: 'Discord delivery unavailable' });
    }
    if (claim !== 'claimed') {
      return res.json({ success: true, duplicate: true });
    }

    // Create Discord service instance
    const service = new DiscordService(discordIntegration.integrationId);

    // Handle the webhook event
    try {
      await service.handleWebhook(event);
    } catch (error) {
      await releaseDelivery('discord', deliveryId);
      deliveryId = null;
      throw error;
    }

    res.json({ success: true });
  } catch (error) {
    if (deliveryId) await releaseDelivery('discord', deliveryId);
    console.error('Error handling Discord webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
module.exports.verifyDiscordWebhookRequest = verifyDiscordWebhookRequest;
// LEGACY: in-platform webhook. External provider service will replace this route.

export {};

```

### Core Architecture Module: `backend/routes/webhooks/groupme.ts`
```
const express = require('express');
// eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
const rateLimit = require('express-rate-limit');
const Integration = require('../../models/Integration');
const registry = require('../../integrations');
const {
  WEBHOOK_DELIVERY_TTL_MS,
  claimDelivery,
  releaseDelivery,
} = require('../../services/webhookDeliveryService');
// eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
const { cloudflareIpRateLimitKeyGenerator } = require('../../middleware/ipRateLimit');

const router = express.Router({ mergeParams: true });

const groupMeWebhookIpRateLimit = rateLimit({
  windowMs: 60_000,
  max: 3_000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: (req: any) => `groupme-ip:${cloudflareIpRateLimitKeyGenerator(req)}`,
  handler: (_req: unknown, res: any) => res.status(429).json({ error: 'Too many GroupMe webhook requests from this IP' }),
});

const groupMeWebhookRateLimit = rateLimit({
  windowMs: 60_000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: (req: any) => {
    const integrationId = String(req.params?.integrationId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    return integrationId ? `groupme:${integrationId}` : `groupme:${cloudflareIpRateLimitKeyGenerator(req)}`;
  },
  handler: (_req: unknown, res: any) => res.status(429).json({ error: 'Too many GroupMe webhook requests' }),
});

// GroupMe callbacks are V3 messages. They carry group_id and id, but not the
// bot_id that is used by the outbound `/bots/post` API.
router.post('/:integrationId', groupMeWebhookIpRateLimit, groupMeWebhookRateLimit, async (req: any, res: any) => {
  let deliveryId: string | null = null;
  try {
    const { integrationId } = req.params;
    const integration = await Integration.findById(integrationId);
    if (!integration || integration.type !== 'groupme') {
      return res.status(404).json({ error: 'Integration not found' });
    }

    const body = req.body || {};
    const expectedGroupId = String(integration.config?.groupId || '').trim();
    const actualGroupId = String(body.group_id || '').trim();
    const allowUnverified = process.env.GROUPME_WEBHOOK_ALLOW_UNVERIFIED === 'true';
    // GroupMe has no callback signature. The callback's group_id is a routing
    // key, so require it to match this integration. This does not authenticate
    // the sender; a per-integration callback URL secret is a follow-up. The
    // bot_id belongs to the outbound API and is not present in V3 callbacks.
    if (actualGroupId && expectedGroupId && actualGroupId !== expectedGroupId) {
      return res.status(401).send('invalid GroupMe group');
    }
    if ((!expectedGroupId || !actualGroupId) && !allowUnverified) {
      return res.status(401).send('unverified GroupMe webhook');
    }
    const eventId = body.id;
    if (!eventId) return res.status(400).send('missing GroupMe message id');
    deliveryId = `${actualGroupId || expectedGroupId || 'unverified'}:${String(eventId)}`;
    const claim = await claimDelivery('groupme', deliveryId, WEBHOOK_DELIVERY_TTL_MS);
    if (claim === 'unavailable') {
      return res.status(503).json({ error: 'GroupMe delivery unavailable' });
    }
    if (claim !== 'claimed') {
      return res.sendStatus(200);
    }

    const provider = registry.get('groupme', integration);
    const { events } = provider.getWebhookHandlers();
    try {
      return await events(req, res);
    } catch (error) {
      await releaseDelivery('groupme', deliveryId);
      deliveryId = null;
      throw error;
    }
  } catch (error) {
    if (deliveryId) await releaseDelivery('groupme', deliveryId);
    console.error('GroupMe webhook error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
// LEGACY: in-platform webhook. External provider service will replace this route.

export {};

```

### Core Architecture Module: `backend/routes/webhooks/slack.ts`
```
// eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
const express = require('express');
// eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
const rateLimit = require('express-rate-limit');
// eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
const Integration = require('../../models/Integration');
// eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
const registry = require('../../integrations');
// eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
const {
  WEBHOOK_DELIVERY_TTL_MS,
  claimDelivery,
  releaseDelivery,
} = require('../../services/webhookDeliveryService');
const { verifySlackSignature: verifySlackRequestSignature } = require('../../services/webhookVerificationService');
// eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
const { relaySlackMessageToPod } = require('../../services/slackBridgeService');
// eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
const { cloudflareIpRateLimitKeyGenerator } = require('../../middleware/ipRateLimit');

const router = express.Router({ mergeParams: true });
const PROVIDER = 'slack';

// Keep a coarse source-IP ceiling before the account bucket. The team id in a
// request body is sender-controlled until HMAC verification, so it cannot be
// the only abuse key.
const slackWebhookIpRateLimit = rateLimit({
  windowMs: 60_000,
  max: 3_000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: (req: any) => `slack-ip:${cloudflareIpRateLimitKeyGenerator(req)}`,
  handler: (_req: unknown, res: any) => res.status(429).json({ error: 'Too many Slack webhook requests from this IP' }),
});

// Slack retries delivery aggressively, so this account budget leaves room for
// a busy workspace while still bounding verified-account bursts.
const slackWebhookRateLimit = rateLimit({
  windowMs: 60_000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: (req: any) => {
    const accountId = String(req.params?.integrationId || req.body?.team_id || '').replace(/[^a-zA-Z0-9_-]/g, '');
    return accountId ? `slack:${accountId}` : `slack:${cloudflareIpRateLimitKeyGenerator(req)}`;
  },
  handler: (_req: unknown, res: any) => res.status(429).json({ error: 'Too many Slack webhook requests' }),
});

const header = (req: any, name: string): string => String(req.get?.(name) || req.headers?.[name.toLowerCase()] || '');

export const verifySlackSignature = (req: any, now = Date.now()): boolean => {
  const timestamp = header(req, 'x-slack-request-timestamp');
  const signature = header(req, 'x-slack-signature');
  // server.ts captures rawBody before JSON/form parsing. The fallback makes
  // the narrow unit router testable; production never signs a reserialized body.
  const rawBody = typeof req.rawBody === 'string' ? req.rawBody : JSON.stringify(req.body || {});
  return verifySlackRequestSignature({
    signingSecret: process.env.SLACK_SIGNING_SECRET,
    timestamp,
    signature,
    rawBody,
    now,
  });
};

const signed = (req: any, res: any, next: () => void) => {
  if (!verifySlackSignature(req)) return res.status(401).json({ error: 'Invalid Slack signature' });
  return next();
};

const finishEvent = async (deliveryId: string, teamId: string, event: any): Promise<void> => {
  let relayStarted = false;
  try {
    // Keep provider input scalar before it reaches Mongoose. The direct
    // String/strip form is intentionally adjacent to the selector so both
    // the runtime boundary and CodeQL's NoSQL-injection model see the fence.
    const safeTeamId = String(teamId || '').replace(/[^a-zA-Z0-9_-]/g, '');
    const channelId = String(event?.channel || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!safeTeamId || !channelId) {
      return;
    }
    const integration = await Integration.findOne({
      type: 'slack',
      isActive: true,
      'config.teamId': safeTeamId,
      'config.chatId': channelId,
      'config.chatType': 'im',
      'config.liveRelay': true,
      'config.adminPause': { $exists: false },
      status: { $ne: 'error' },
    }).lean();
    if (integration) {
      relayStarted = true;
      await relaySlackMessageToPod({ integration, event });
    }
  } catch (error) {
    console.error('[slack-events] processing failed:', (error as Error).message);
    // Once relay starts it may already have written the pod message. Keep the
    // claim on every downstream throw; only pre-relay lookup failures are safe
    // to release for a provider retry.
    if (!relayStarted) {
      await releaseDelivery(PROVIDER, deliveryId);
    }
  }
};

/**
 * Installable Slack Events API endpoint. It is intentionally separate from
 * the legacy /:integrationId provider route below: one Slack app has one
 * global request URL and resolves its target by team + DM channel.
 */
router.post('/events', slackWebhookIpRateLimit, slackWebhookRateLimit, signed, async (req: any, res: any) => {
  const body = req.body || {};
  if (body.type === 'url_verification') return res.status(200).json({ challenge: body.challenge });
  const event = body.event;
  if (!event || event.type !== 'message') return res.status(200).json({ ok: true });
  if (!body.event_id) return res.status(400).json({ error: 'Missing Slack event id' });
  // D8/private-chat gate in Slack spelling. Do this before a DB lookup or a
  // receipt: group/channel traffic must not create either side effect.
  if (event.channel_type !== 'im' || event.subtype) return res.status(200).json({ ok: true });
  const teamId = String(body.team_id || event.team || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!teamId) return res.status(400).json({ error: 'Missing Slack team id' });
  const eventId = String(body.event_id);
  const deliveryId = `${teamId}:${eventId}`;
  let claimed: string;
  try {
    claimed = await claimDelivery(PROVIDER, deliveryId, WEBHOOK_DELIVERY_TTL_MS);
  } catch (error) {
    // claimDelivery normally degrades to an unclaimed delivery when Mongo is
    // unavailable; retain a defensive 503 if a replacement store throws.
    console.error('[slack-events] delivery claim failed:', (error as Error).message);
    return res.status(503).json({ error: 'Slack event delivery unavailable' });
  }
  if (claimed === 'unavailable') return res.status(503).json({ error: 'Slack event delivery unavailable' });
  if (claimed !== 'claimed') return res.status(200).json({ ok: true });
  // Ack before the bridge's database/PG work. Slack's 3s deadline is a
  // transport concern; WebhookDelivery carries the work claim.
  res.status(200).json({ ok: true });
  setImmediate(() => { void finishEvent(deliveryId, teamId, event); });
  return undefined;
});

const commandHelp = 'Use /commonly status, mode mirror|attention, mute [minutes], or unmute.';

router.post('/commands', slackWebhookIpRateLimit, slackWebhookRateLimit, signed, async (req: any, res: any) => {
  const body = req.body || {};
  const teamId = String(body.team_id || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const channelId = String(body.channel_id || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const slackUserId = String(body.user_id || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!teamId || !channelId || !slackUserId) {
    return res.status(400).json({ response_type: 'ephemeral', text: 'Invalid Slack command context.' });
  }
  const integration = await Integration.findOne({
    type: 'slack',
    isActive: true,
    'config.teamId': teamId,
    'config.chatId': channelId,
    'config.chatType': 'im',
    'config.slackUserId': slackUserId,
    'config.adminPause': { $exists: false },
    status: { $ne: 'error' },
  });
  if (!integration) {
    return res.status(404).json({
      response_type: 'ephemeral',
      text: 'This Slack DM is not connected to Commonly.',
    });
  }
  const [command, argument] = String(body.text || '').trim().split(/\s+/, 2);
  const normalized = command?.toLowerCase() || 'help';
  if (normalized === 'mode') {
    if (argument !== 'mirror' && argument !== 'attention') {
      return res.json({ response_type: 'ephemeral', text: 'Usage: /commonly mode mirror|attention' });
    }
    await Integration.updateOne(
      { _id: integration._id },
      { $set: { 'config.relayAllAgentMessages': argument === 'mirror' } },
    );
    return res.json({ response_type: 'ephemeral', text: `Relay mode: ${argument}.` });
  }
  if (normalized === 'mute') {
    const minutes = Math.min(Math.max(parseInt(argument || '60', 10) || 60, 1), 24 * 60);
    await Integration.updateOne(
      { _id: integration._id },
      { $set: { 'config.relayMutedUntil': new Date(Date.now() + minutes * 60_000) } },
    );
    return res.json({ response_type: 'ephemeral', text: `Muted for ${minutes} minutes.` });
  }
  if (normalized === 'unmute') {
    await Integration.updateOne({ _id: integration._id }, { $unset: { 'config.relayMutedUntil': 1 } });
    return res.json({ response_type: 'ephemeral', text: 'Relay unmuted.' });
  }
  if (normalized === 'status') {
    const mode = integration.config?.relayAllAgentMessages ? 'mirror' : 'attention';
    return res.json({ response_type: 'ephemeral', text: `Relay is ${mode}.` });
  }
  return res.json({ response_type: 'ephemeral', text: commandHelp });
});

// Legacy per-row Slack integrations preserve their old provider path. It is
// intentionally last so /events and /commands cannot be swallowed as an id.
router.post('/:integrationId', slackWebhookIpRateLimit, slackWebhookRateLimit, async (req: any, res: any) => {
  let deliveryId: string | null = null;
  try {
    const { integrationId } = req.params;
    const integration = await Integration.findById(integrationId);
    // An inactive row answers like an unknown id. This route takes no auth, so a
    // row's own verification key would otherwise outlive the access that plan
```

### Core Architecture Module: `backend/routes/webhooks/telegram.ts`
```
const express = require('express');
// eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
const rateLimit = require('express-rate-limit');
const Integration = require('../../models/Integration');
const Pod = require('../../models/Pod');
const Summary = require('../../models/Summary');
const registry = require('../../integrations');
const IntegrationSummaryService = require('../../services/integrationSummaryService');
const AgentEventService = require('../../services/agentEventService');
const telegramService = require('../../services/telegramService');
const { escapeHtml } = telegramService;
const deliveryFailures = require('../../services/connectorDeliveryFailureService');
const {
  isConnectCodeShape, isConnectCodeExpired, registerEnableAttempt,
} = require('../../services/telegramConnectCode');
const {
  claimDelivery: claimWebhookDelivery,
  releaseDelivery: releaseWebhookDelivery,
} = require('../../services/webhookDeliveryService');
// eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
const { cloudflareIpRateLimitKeyGenerator } = require('../../middleware/ipRateLimit');

const router = express.Router({ mergeParams: true });

const telegramWebhookRateLimit = rateLimit({
  windowMs: 60_000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  keyGenerator: (req: any) => `telegram:${cloudflareIpRateLimitKeyGenerator(req)}`,
  handler: (_req: unknown, res: any) => res.status(429).json({ error: 'Too many Telegram webhook requests' }),
});

const ENABLE_COMMAND = '/commonly-enable';
// Underscore alias: Telegram's registered-command menu forbids hyphens, so
// the menu carries /commonly_enable while typed /commonly-enable keeps working.
const ENABLE_COMMAND_ALIAS = '/commonly_enable';
const SUMMARY_COMMAND = '/summary';
const POD_SUMMARY_COMMAND = '/pod_summary';
const TLDR_COMMAND = '/tldr';
const MODE_COMMAND = '/mode';
const STATUS_COMMAND = '/status';
const MUTE_COMMAND = '/mute';
const UNMUTE_COMMAND = '/unmute';
const HELP_COMMAND = '/help';

const normalizeCommand = (raw = '') => raw.split('@')[0].toLowerCase();

const getMessageFromUpdate = (update: any) => update?.message || update?.channel_post || null;

const getChatTitle = (chat: any) => (
  chat?.title
  || chat?.username
  || [chat?.first_name, chat?.last_name].filter(Boolean).join(' ').trim()
  || 'Telegram chat'
);

// Fail CLOSED (hardening study 2026-08-31, gap 4): with no TELEGRAM_SECRET_TOKEN
// configured this used to accept anything — anyone who found the URL could post
// updates that wake agents and drive /mode //mute. Now a missing secret rejects,
// unless the operator explicitly opts out (TELEGRAM_WEBHOOK_ALLOW_UNVERIFIED=true,
// for local dev only). Deploy note: set TELEGRAM_SECRET_TOKEN and re-register the
// webhook with setWebhook(secret_token=...) BEFORE shipping this to an env with a
// live bridge, or Telegram's deliveries (sent without the header) will 401.
let warnedUnverified = false;
const verifyTelegramHeader = (req: any) => {
  const expectedToken = process.env.TELEGRAM_SECRET_TOKEN;
  if (!expectedToken) {
    if (process.env.TELEGRAM_WEBHOOK_ALLOW_UNVERIFIED === 'true') {
      if (!warnedUnverified) {
        warnedUnverified = true;
        console.warn('Telegram webhook: TELEGRAM_SECRET_TOKEN unset and verification explicitly disabled — accepting unverified updates');
      }
      return true;
    }
    if (!warnedUnverified) {
      warnedUnverified = true;
      console.error('Telegram webhook: TELEGRAM_SECRET_TOKEN is not set — rejecting all updates (set the secret and re-register via setWebhook, or set TELEGRAM_WEBHOOK_ALLOW_UNVERIFIED=true for local dev)');
    }
    return false;
  }
  const headerToken = req.headers['x-telegram-bot-api-secret-token'];
  return headerToken && headerToken === expectedToken;
};

const handleEnableCommand = async (chat: any, code: any) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = chat?.id?.toString();
  if (!botToken || !chatId) return;

  if (!code) {
    await telegramService.sendMessage(
      botToken,
      chatId,
      'Usage: /commonly-enable &lt;code&gt; (get the code from Commonly)',
    );
    return;
  }

  // A malformed code is a typo, and a typo must not cost one of the chat's five
  // tries — so this sits BEFORE the attempt counter, which is the whole point of
  // the check. It does not make guessing free: only a well-formed code can ever
  // match a minted one, and a well-formed guess still spends an attempt.
  // Malformed input is left to the route's outer rate limiter
  // (telegramWebhookRateLimit), because input that costs a regex is not worth a
  // per-chat counter.
  if (!isConnectCodeShape(code)) {
    await telegramService.sendMessage(
      botToken,
      chatId,
      "That doesn't look like a connect code — copy it from Commonly.",
    );
    return;
  }

  // The code is the only proof of ownership this path has (the redeemer is
  // unauthenticated), so guessing is rate-limited per chat and codes expire.
  if (!registerEnableAttempt(chatId)) {
    await telegramService.sendMessage(
      botToken,
      chatId,
      '⚠️ Too many attempts. Wait a few minutes and request a fresh code from Commonly.',
    );
    return;
  }

  const integration = await Integration.findOne({
    type: 'telegram',
    isActive: true,
    'config.connectCode': code,
  });

  if (!integration || isConnectCodeExpired(integration.config)) {
    await telegramService.sendMessage(
      botToken,
      chatId,
      '❌ Invalid or expired code. Please request a fresh code from Commonly.',
    );
    return;
  }

  const existingChatId = integration.config?.chatId;
  if (existingChatId && `${existingChatId}` !== `${chatId}`) {
    await telegramService.sendMessage(
      botToken,
      chatId,
      '⚠️ This code is already linked to another chat. Request a new code.',
    );
    return;
  }

  const chatClaim = await Integration.findOne({
    type: 'telegram',
    isActive: true,
    'config.chatId': chatId,
  });

  if (chatClaim && chatClaim._id.toString() !== integration._id.toString()) {
    await telegramService.sendMessage(
      botToken,
      chatId,
      '⚠️ This chat is already linked to another Commonly pod.',
    );
    return;
  }

  const chatTitle = getChatTitle(chat);
  const chatType = chat?.type || null;

  // Live relay authors inbound as the linked user and streams the pod's
  // escalations outbound; both are only honest in a private 1:1 chat.
  if (integration.config?.liveRelay && chatType !== 'private') {
    await telegramService.sendMessage(
      botToken,
      chatId,
      '⚠️ Live relay only works from a private chat with this bot. Open a direct chat and send the code there.',
    );
    return;
  }

  // `errorMessage: null` because the working bind is the other state of the
  // field the failure writes, and only a bind knows the connector works again
  // (wren 73779). `new: true` is what the confirmation below classifies against:
  // the chat id it compares is the one this update just stored.
  const bound = await Integration.findByIdAndUpdate(integration._id, {
    status: 'connected',
    errorMessage: null,
    // The flag goes with the message it describes: a bind clears the reason, so
    // it clears the claim that the reason was written for a person.
    errorMessageUserFacing: false,
    $set: {
      'config.chatId': chatId,
      'config.chatTitle': chatTitle,
      'config.chatType': chatType,
      'config.webhookListenerEnabled': true,
    },
    $unset: {
      'config.connectCode': '',
      'config.connectCodeExpiresAt': '',
    },
  }, { new: true });

  const pod = await Pod.findById(integration.podId).lean();
  const podName = pod?.name || 'your pod';

  // Escaped because parse_mode is HTML: a pod named `A <b>` made Telegram reject
  // this send with 400 "can't parse entities", which is a content failure and
  // must never undo a bind (wren 73778).
  const confirmation = await telegramService.sendMessage(
    botToken,
    chatId,
    `✅ Connected this chat to <b>${escapeHtml(podName)}</b> in Commonly.\n`
    + 'Agent messages from the pod will appear here. Too chatty? Send '
    + '/mode attention to only get what needs you. /help lists the rest.',
  );
  // The one receive-side send that may flip: it targets the chat that was just
  // bound, so a permanent failure means this bind is unusable. Undoing it clears
  // the chat id, which is what lets the user mint a fresh code and reconnect.
  await deliveryFailures.noteBoundChatDeliveryFailure(bound, chatId, confirmation);
};

const handleSummaryCommand = async (chat: any, integration: any) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken || !chat?.id) return;
  const chatId = chat.id.toString();

  if (!integration) {
    await telegramService.sendMessage(
      botToken,
      chatId,
      'This chat is not linked. Use /commonly-enable &lt;code&gt; first.',
    );
    return;
  }
  if (!integration.podId) {
    await telegramService.sendMessage(botToken, chatId, 'This connector has no active pod. Choose one in Commonly first.');
    return;
  }

  const latest = await Integration.findById(integration._id).lean();
  const buffer = latest?.config?.messageBuffer || [];
  if (!buffer.length) {
    await telegramService.sendMessage(
      botToken,
      chatId,
      'No recent Telegram activity to summarize.',
    );
    return;
  }

  const summary = await IntegrationSummaryService.createSummary(
    latest,
    buffer,
  );

  const { AgentInstallation } = require('../../models/AgentRegistry');
  let installations = [];
  try {
    installations = await AgentInstallation.find({
      agentName: 'commonly-bot',
      podId: latest.podId,
      status: 'active',
    }).lean();
  } catch (err: unknown) {
    console.warn('telegram agent lookup failed', (err as Error).message);
  }

  const targets =
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #667** (2026-07-10): **stats: /api/stats/public messageCount24h reads Mongo Message (fallback store) — undercounts vs PostgreSQL**
  *Symptoms*: While building #661 we confirmed the primary message store is PostgreSQL (`PGMessage.create`), with Mongo `Message` only written on a fallback path — production Mongo has ~3 messages in the last 7 days while PG carries the real traffic. `/api/stats/public` computes `messageCount24h` from Mongo, so the public live-stats number is drastically undercounted.  Fix: count from PG (`SELECT count(*) FROM messages WHERE created_at >= now() - interval '24 hours'`) with the Mongo count as fallback when PG is unavailable, mirroring the dual-DB convention. Add a regression test.

- **Issue #654** (2026-07-12): **backend Deployment uses Recreate + 1 replica — every deploy is a ~90s API outage**
  *Symptoms*: Observed live during the 2026-07-06 night deploys: the health probe caught `api.commonly.me` returning 503 for ~60–90s during each backend rollout. Cause: `deploy/backend` uses `strategy: Recreate` with `replicas: 1`, so the old pod is killed before the new one is ready.  Backend already schedules on the spot pool, which per ADR-015 requires it to be stateless (spot VMs get reclaimed with 30s notice) — so it should tolerate `RollingUpdate` with `maxUnavailable: 0, maxSurge: 1`. Socket.io reconnects already have to handle the spot-eviction case.  Not changing it during launch week without testing; until then, avoid deploys while Show HN traffic is live.
  **Post-Mortem & Fix Analysis**:
  > `RollingUpdate` with `maxUnavailable: 0` and a real readiness probe should remove the rollout gap, but it is worth testing application-level compatibility between old and new pods before switching. Database migrations and Socket.io/session behavior need to tolerate both versions during the surge window. A PodDisruptionBudget with `minAvailable: 1` and a rollout timeout/automatic rollback would also cover voluntary disruptions and a new pod that never becomes ready, not just normal deploys. 

- **Issue #652** (2026-07-07): **express-rate-limit config warnings: permissive 'trust proxy' + IPv6 keyGenerator bypass on GA auth endpoints**
  *Symptoms*: Backend logs show two `express-rate-limit` ValidationErrors at runtime:  1. `ERR_ERL_PERMISSIVE_TRUST_PROXY` — Express `trust proxy` is `true`, which lets anyone spoof `X-Forwarded-For` and trivially bypass IP-based rate limiting. Behind Cloudflare tunnel + nginx we should set a hop count or trusted-CIDR list instead of `true`. 2. `ERR_ERL_KEY_GEN_IPV6` — a custom `keyGenerator` uses the raw request IP without the `ipKeyGenerator` helper, so IPv6 users can rotate within their /64 to bypass limits.  These rate limiters guard the GA auth/login/register endpoints (the NoSQL-injection + rate-limit hardening from #614/#617), so bypassability partially undoes that work. Docs: https://express-rate-limit.github.io/ERR_ERL_PERMISSIVE_TRUST_PROXY / https://express-rate-limit.github.io/ERR_ERL_KEY_GEN_IPV6

- **Issue #651** (2026-07-07): **Pod-skill synthesis spams backend logs with Gemini 401 (~1,600/day) — dead GEMINI_API_KEY, feature silently broken**
  *Symptoms*: Backend logs show ~1,632 `Failed to synthesize pod skills with LLM: GoogleGenerativeAIError [401 Unauthorized]` entries in 24h (~once/min). The `GEMINI_API_KEY` in the cluster is the known-dead key (project where the Generative Language API isn't enabled), so pod-skill synthesis has been silently broken and is the single largest noise source in the logs — it buries real errors during incident triage.  Options: 1. Route synthesis through LiteLLM like everything else (preferred — one auth surface). 2. Guard: detect the permanent 401 and disable synthesis for the process lifetime (log once). 3. Remove/park the feature if it's not on the GA path.  At minimum, stop retrying a permanently-failing credential every minute.

- **Issue #646** (2026-07-07): **Reply quote missing on optimistic/socket render (appears only after reload)**
  *Symptoms*: From the reply-threading work (#639–641): sending a reply shows the message immediately but WITHOUT the quoted-context block; the quote renders correctly after a page reload.  **Cause:** the Socket.io `newMessage` broadcast (and possibly the optimistic-add dedupe race in `useV2PodDetail.sendMessage`) delivers a message shape without the `replyTo` / `reply_*` fields, while the GET list includes them.  **Fix direction:** include reply fields in the broadcast payload (backend, wherever `newMessage` is emitted after createMessage), or have the optimistic path prefer the POST response (which does include `replyTo`) over the socket copy in the dedupe.  Cosmetic — self-corrects on reload. Verified live 2026-07-05.

- **Issue #610** (2026-07-06): **BYO/local agents can't see or read pod files & images**
  *Symptoms*: ## Found in BYO smoke test (2026-07-03)  Sam's question: "can locally attached agents read the files, pictures, etc uploaded/shared via a Commonly pod?" Answer today: **no.**  ### Repro 1. Human uploads a `.txt` and a `.png` to a pod (`POST /api/uploads` with `podId` — the UI's real path). 2. `GET /api/pods/:podId/files` (human) returns both. ✅ 3. Agent `GET /api/agents/runtime/pods/:podId/context?assetLimit=40` → `assets: []` — **empty**. 4. A real local Claude Code agent with `@commonlyai/mcp`: "no commonly tool lists or reads uploaded file/asset contents."  ### Two sub-gaps - **(a) data source**: the agent pod-context `assets` builder does not include `File`-model uploads bound to the pod, so the agent can't even *learn a file exists*. - **(b) no fetch tool**: there is no `commonly_get_file` / download tool in the MCP surface, so even a listed file's bytes/text are unreadable. (Note: `commonly_attach_file` exists for agents to *post* files, but nothing to *read* them.)  ### Fix direction - Include pod `File` uploads in the agent-context `assets` (name, contentType, size, a fetchable signed URL). - Add a `commonly_get_file`/`commonly_read_attachment` MCP tool that returns text content or a signed URL; for images, return the URL so vision-capable local agents can fetch.
  **Post-Mortem & Fix Analysis**:
  > Shipped 2026-07-05: agents now read pod files end-to-end. Backend GET /pods/:podId/files + /files/:fileName/content (rate-limited, pod-scoped, path-guarded); files surfaced in get_context; MCP tools commonly_list_files + commonly_read_file (0.1.6) and commonly_attach_file for producing files back (0.1.7). Live-verified: a wrapper agent proactively read an uploaded brief and generated+attached its own .md deliverable. Images/binary return metadata + note (text ≤256KB inlined) — image *content* understanding would be a separate follow-up if ever needed.

- **Issue #609** (2026-07-04): **CRITICAL: BYO agent identity + memory collide globally on name — cross-account leak**
  *Symptoms*: ## Severity: launch blocker for open registration  Found in a fresh-user BYO smoke test (2026-07-03).  ### Repro 1. User A installs a BYO agent named `smoke-claude` (any pod). 2. User B (a *different* account) installs a BYO agent, also names it `smoke-claude`. 3. B's agent now **is** A's agent: same bot `User` row, same memory, both `AgentInstallation` rows point at the one bot user. B's runtime token reads A's private agent memory.  Verified live: a brand-new user's `smoke-claude` install resolved to the bot User created months earlier by a *different real account* (`xcjsam`), and read that account's agent memory back verbatim.  ### Root cause - `agentIdentityService.getOrCreateAgentUser` looks up the bot User by `username = buildAgentUsername(agentName, instanceId)` — **global, no owner**. B's install finds and reuses A's bot user. - `resolveMemoryIdentity` (`routes/agentsRuntime.ts:1688`) keys memory on `(agentName, instanceId)` only — same collision on the memory doc. - `AgentInstallation` rows *are* per-user (`installedBy` differs), but nothing downstream uses `installedBy` for identity/memory.  ### Fix direction Namespace BYO agent identity per owner — e.g. internal `username = f(ownerUserId, name)`, display stays the bare name. Memory identity gains the owner. Needs a migration of existing `users` (bot) + `agentmemories` docs and touches identity resolution broadly. First-party/official agents (`instanceId: default` + typeConfig) can keep global names; only user-origi

- **Issue #517** (2026-06-29): **Flaky CI: mongodb-memory-server lock race fails two-way-integration-e2e on main**
  *Symptoms*: **Recurs intermittently** (most recently the push-to-main "Tests" run on `bf619e9e`, 2026-06-29 — passed on the PR, flaked on push, green on re-run).  One service E2E suite (`backend/__tests__/service/two-way-integration-e2e.test.js`) fails *as a whole* when `mongodb-memory-server` can't start:  ``` Cannot unlock file ".../mongodb-binaries/7.0.11.lock", because it is not locked by this process MongooseError: Operation `agentinstallations.deleteMany()` buffering timed out after 10000ms   at MongoMemoryServer._startUpInstance (.../MongoMemoryServer.ts) ```  The in-memory Mongo never comes up (binary-cache **lock race** between parallel Jest suites downloading/locking the shared `7.0.11` binary), so every test in the suite then hits the 10s mongoose buffering timeout. ~23 tests fail, all in that one suite; everything else passes. `gh run rerun --failed` reliably goes green.  **Why it matters:** false-red on main after a clean merge → looks like a regression, costs a diagnose+rerun cycle every time, and erodes trust in CI signal.  **Direction (any of):** - Pre-download/cache the Mongo binary once before Jest runs (e.g. a setup step that warms `~/.cache/mongodb-binaries`), so parallel suites never race the download/lock. - Pin `MONGOMS_SYSTEM_BINARY` / a prebuilt binary in CI. - Run the heavy service-E2E suites in a single worker / serially (`--runInBand` for that project) so they don't contend on the lock. - Add a retry around `MongoMemoryServer.create` in `__tests__/utils/testUt
  **Post-Mortem & Fix Analysis**:
  > Completed via https://github.com/Team-Commonly/commonly/pull/518

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

### Incident Patch 1: `d01bb0c7` (2026-10-06)
**Commit Message**: fix(deps): proxy-addr 2.0.8 in both commonly-mcp lockfiles (critical advisory 2026-10-05) (#2082)

proxy-addr >=1.1.0 <2.0.8 is critical at runtime scope in commonly-mcp/ and packages/commonly-mcp/
(backend done in #2081). Lockfile-only: npm update proxy-addr --package-lock-only. commonly-mcp's
lockfile root also resyncs to its package.json version (0.3.10 -> 0.3.13, metadata only). No src
change, so no version bump (package-version-guard reads src/).


Claude-Session: https://claude.ai/code/session_013geJsV4RJMujdvpf3JV2Cv

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `commonly-mcp/package-lock.json` (modified, +10/-5)
```diff
@@ -1,12 +1,13 @@
 {
   "name": "@commonlyai/mcp",
-  "version": "0.3.10",
+  "version": "0.3.13",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "@commonlyai/mcp",
-      "version": "0.3.10",
+      "version": "0.3.13",
+      "license": "Apache-2.0",
       "dependencies": {
         "@modelcontextprotocol/sdk": "^1.0.4"
       },
@@ -3845,16 +3846,20 @@
       }
     },
     "node_modules/proxy-addr": {
-      "version": "2.0.7",
-      "resolved": "https://registry.npmjs.org/proxy-addr/-/proxy-addr-2.0.7.tgz",
-      "integrity": "sha512-llQsMLSUDUPT44jdrU/O37qlnifitDP+ZwrmmZcoSKyLKvtZxpyV0n2/bD/N4tBAAZ/gJEdZU7KMraoK1+XYAg==",
+      "version": "2.0.8",
+      "resolved": "https://registry.npmjs.org/proxy-addr/-/proxy-addr-2.0.8.tgz",
+      "integrity": "sha512-5nnx0yGyVUcY6t9RnWcARWtwT9F1D8O9rt08htPvnd49W1IgZtmLkhu9WfMzQj1cFxjHIO6connUNVW5k7AVyQ==",
       "license": "MIT",
       "dependencies": {
         "forwarded": "0.2.0",
         "ipaddr.js": "1.9.1"
       },
       "engines": {
         "node": ">= 0.10"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/express"
       }
     },
     "node_modules/pure-rand": {
```

**File**: `packages/commonly-mcp/package-lock.json` (modified, +7/-3)
```diff
@@ -3250,16 +3250,20 @@
       }
     },
     "node_modules/proxy-addr": {
-      "version": "2.0.7",
-      "resolved": "https://registry.npmjs.org/proxy-addr/-/proxy-addr-2.0.7.tgz",
-      "integrity": "sha512-llQsMLSUDUPT44jdrU/O37qlnifitDP+ZwrmmZcoSKyLKvtZxpyV0n2/bD/N4tBAAZ/gJEdZU7KMraoK1+XYAg==",
+      "version": "2.0.8",
+      "resolved": "https://registry.npmjs.org/proxy-addr/-/proxy-addr-2.0.8.tgz",
+      "integrity": "sha512-5nnx0yGyVUcY6t9RnWcARWtwT9F1D8O9rt08htPvnd49W1IgZtmLkhu9WfMzQj1cFxjHIO6connUNVW5k7AVyQ==",
       "license": "MIT",
       "dependencies": {
         "forwarded": "0.2.0",
         "ipaddr.js": "1.9.1"
       },
       "engines": {
         "node": ">= 0.10"
+      },
+      "funding": {
+        "type": "opencollective",
+        "url": "https://opencollective.com/express"
       }
     },
     "node_modules/proxy-from-env": {
```

---

### Incident Patch 2: `c73218e3` (2026-10-06)
**Commit Message**: fix(deps): clear backend runtime Dependabot alerts (#2081)

Update vulnerable backend runtime dependencies and scoped transitive copies. Keep the change lockfile-led with no application refactors.

Current-main Dependabot baseline on 2026-10-06 at 89579a687c50cbfe8fefd5cda82824ad37c201a6 for backend/package-lock.json runtime: 168 open alerts (5 critical, 77 high, 75 medium, 11 low). The five criticals are form-data, jsonpath-plus, protobufjs, tar, and the newly published proxy-addr alert #645. Record the same filtered count after merge; it is not available from the default branch until the merge and Dependabot refresh.

Set jsonpath-plus to 10.3.0, which fixes both the critical and separate high RCE advisory. Pin proxy-addr to 2.0.8 for GHSA-jqcg-44mw-7w3h, newly published 2026-10-05; both Express 4 and 5 resolve that patched release.

Local Node 26 verification: clean npm ci passed; npm audit --omit=dev reports 0 critical and 11 high in other packages; build, typecheck and lint pass. An earlier full local test:ci run had 500 passed, 6 skipped, and two failures in slack.webhook.signature.test.js; that suite passed 9/9 when run alone. GitHub's required Test & Coverage workflow uses 

**File**: `backend/package-lock.json` (modified, +383/-406)
```diff
@@ -18,7 +18,7 @@
         "@socket.io/redis-adapter": "^8.3.0",
         "@types/adm-zip": "^0.5.8",
         "adm-zip": "^0.5.17",
-        "axios": "^1.10.0",
+        "axios": "^1.20.0",
         "bcryptjs": "^2.4.3",
         "cors": "^2.8.5",
         "discord.js": "^14.20.0",
@@ -30,7 +30,7 @@
         "mongodb": "^6.3.0",
         "mongoose": "^7.0.3",
         "morgan": "^1.10.0",
-        "multer": "^1.4.5-lts.1",
+        "multer": "^2.4.0",
         "node-cron": "^3.0.3",
         "node-fetch": "^2.7.0",
         "openai": "^4.104.0",
@@ -1566,6 +1566,30 @@
         "url": "https://opencollective.com/js-sdsl"
       }
     },
+    "node_modules/@jsep-plugin/assignment": {
+      "version": "1.3.0",
+      "resolved": "https://registry.npmjs.org/@jsep-plugin/assignment/-/assignment-1.3.0.tgz",
+      "integrity": "sha512-VVgV+CXrhbMI3aSusQyclHkenWSAm95WaiKrMxRFam3JSUiIaQjoMIw2sEs/OX4XifnqeQUN4DYbJjlA8EfktQ==",
+      "license": "MIT",
+      "engines": {
+        "node": ">= 10.16.0"
+      },
+      "peerDependencies": {
+        "jsep": "^0.4.0||^1.0.0"
+      }
+    },
+    "node_modules/@jsep-plugin/regex": {
+      "version": "1.0.4",
+      "resolved": "https://registry.npmjs.org/@jsep-plugin/regex/-/regex-1.0.4.tgz",
+      "integrity": "sha512-q7qL4Mgjs1vByCaTnDFcBnV9HS7GVPJX5vyVoCgZHNSC9rjwIlmbXG5sUuorR5ndfHAIlJ8pVStxvjXHbNvtUg==",
+      "license": "MIT",
+      "engines": {
+        "node": ">= 10.16.0"
+      },
+      "peerDependencies": {
+        "jsep": "^0.4.0||^1.0.0"
+      }
+    },
     "node_modules/@kubernetes/client-node": {
       "version": "0.21.0",
       "resolved": "https://registry.npmjs.org/@kubernetes/client-node/-/client-node-0.21.0.tgz",
@@ -2264,25 +2288,24 @@
       "license": "BSD-3-Clause"
     },
     "node_modules/@protobufjs/codegen": {
-      "version": "2.0.4",
-      "resolved": "https://registry.npmjs.org/@protobufjs/codegen/-/codegen-2.0.4.tgz",
-      "integrity": "sha512-YyFaikqM5sH0ziFZCN3xDC7zeGaB/d0IUb9CATugHWbd1FRFwWwt4ld4OYMPWu5a3Xe01mGAULCdqhMlPl29Jg==",
+      "version": "2.0.5",
+      "resolved": "https://registry.npmjs.org/@protobufjs/codegen/-/codegen-2.0.5.tgz",
+      "integrity": "sha512-zgXFLzW3Ap33e6d0Wlj4MGIm6Ce8O89n/apUaGNB/jx+hw+ruWEp7EwGUshdLKVRCxZW12fp9r40E1mQrf/34g==",
       "license": "BSD-3-Clause"
     },
     "node_modules/@protobufjs/eventemitter": {
-      "version": "1.1.0",
-      "resolved": "https://registry.npmjs.org/@protobufjs/eventemitter/-/eventemitter-1.1.0.tgz",
-      "integrity": "sha512-j9ednRT81vYJ9OfVuXG6ERSTdEL1xVsNgqpkxMsbIabzSo3goCjDIveeGv5d03om39ML71RdmrGNjG5SReBP/Q==",
+      "version": "1.1.1",
+      "resolved": "https://registry.npmjs.org/@protobufjs/eventemitter/-/eventemitter-1.1.1.tgz",
+      "integrity": "sha512-vW1GmwMZNnL+gMRaovlh9yZX74kc+TTU3FObkkurpMaRtBfLP3ldjS9KQWlwZgraRE0+dheEEoAxdzcJQ8eXZg==",
       "license": "BSD-3-Clause"
     },
     "node_modules/@protobufjs/fetch": {
-      "version": "1.1.0",
-      "resolved": "https://registry.npmjs.org/@protobufjs/fetch/-/fetch-1.1.0.tgz",
-      "integrity": "sha512-lljVXpqXebpsijW71PZaCYeIcE5on1w5DlQy5WH6GLbFryLUrBD4932W/E2BSpfRJWseIL4v/KPgBFxDOIdKpQ==",
+      "version": "1.1.1",
+      "resolved": "https://registry.npmjs.org/@protobufjs/fetch/-/fetch-1.1.1.tgz",
+      "integrity": "sha512-GpptLrs57adMSuHi3VNj0mAF8dwh36LMaYF6XyJ6JMWlVsc+t42tm1HSEDmOs3A8fC9yyeisgLhsTVQokOZ0zw==",
       "license": "BSD-3-Clause",
       "dependencies": {
-        "@protobufjs/aspromise": "^1.1.1",
-        "@protobufjs/inquire": "^1.1.0"
+        "@protobufjs/aspromise": "^1.1.1"
       }
     },
     "node_modules/@protobufjs/float": {
@@ -2291,12 +2314,6 @@
       "integrity": "sha512-Ddb+kVXlXst9d+R9PfTIxh1EdNkgoRe5tOX6t01f1lYWOvJnSPDBlG241QLzcyPdoNTsblLUdujGSE4RzrTZGQ==",
       "license": "BSD-3-Clause"
     },
-    "node_modules/@protobufjs/inquire": {
-      "version": "1.1.0",
-      "resolved": "https://registry.npmjs.org/@protobufjs/inquire/-/inquire-1.1.0.tgz",
-      "integrity": "sha512-kdSefcPdruJiFMVSbn801t4vFK7KB/5gd2fYvrxhuJYg8ILrmn9SKSX2tZdV6V+ksulWqS7aXjBcRXl3wHoD9Q==",
-      "license": "BSD-3-Clause"
-    },
     "node_modules/@protobufjs/path": {
       "version": "1.1.2",
       "resolved": "https://registry.npmjs.org/@protobufjs/path/-/path-1.1.2.tgz",
@@ -2310,9 +2327,9 @@
       "license": "BSD-3-Clause"
     },
     "node_modules/@protobufjs/utf8": {
-      "version": "1.1.0",
-      "resolved": "https://registry.npmjs.org/@protobufjs/utf8/-/utf8-1.1.0.tgz",
-      "integrity": "sha512-Vvn3zZrhQZkkBE8LSuW3em98c0FwgO4nxzv6OdSxPKJIEKY2bGbHn+mhGIPerzI4twdxaP8/0+06HBpwf345Lw==",
+      "version": "1.1.2",
+      "resolved": "https://registry.npmjs.org/@protobufjs/utf8/-/utf8-1.1.2.tgz",
+      "integrity": "sha512-b1UQwcEZ4yCnMCD8DAL1VlbvBJE9/IX4FTIp7BG1xYpf29SLazLSrqUkj4w7Y5y7cCVP6E5tcqqcI0xemPkHug==",
       "license": "BSD-3-Clause"
     },
     "node_modules/@redis/bloom": {
@@ -2428,13 +2445,22 @@
       }
     },
     "node_
```

**File**: `backend/package.json` (modified, +18/-2)
```diff
@@ -42,7 +42,7 @@
     "@socket.io/redis-adapter": "^8.3.0",
     "@types/adm-zip": "^0.5.8",
     "adm-zip": "^0.5.17",
-    "axios": "^1.10.0",
+    "axios": "^1.20.0",
     "bcryptjs": "^2.4.3",
     "cors": "^2.8.5",
     "discord.js": "^14.20.0",
@@ -54,7 +54,7 @@
     "mongodb": "^6.3.0",
     "mongoose": "^7.0.3",
     "morgan": "^1.10.0",
-    "multer": "^1.4.5-lts.1",
+    "multer": "^2.4.0",
     "node-cron": "^3.0.3",
     "node-fetch": "^2.7.0",
     "openai": "^4.104.0",
@@ -65,6 +65,22 @@
     "tweetnacl": "^1.0.3",
     "tweetnacl-util": "^0.15.1"
   },
+  "overrides": {
+    "@sendgrid/client": {
+      "axios": "0.34.0"
+    },
+    "fast-uri": "3.1.8",
+    "jsonpath-plus": "10.3.0",
+    "protobufjs": "7.6.6",
+    "request": {
+      "form-data": "2.5.6"
+    },
+    "socket.io-parser": "4.2.7",
+    "tar": "7.5.22",
+    "undici": "6.29.0",
+    "ws": "8.22.0",
+    "proxy-addr": "2.0.8"
+  },
   "devDependencies": {
     "@jest/globals": "^29.7.0",
     "@types/bcryptjs": "^2.4.6",
```

---

### Incident Patch 3: `0f760398` (2026-10-06)
**Commit Message**: fix(frontend): clear runtime critical and high advisories (#2080)

**File**: `frontend/package-lock.json` (modified, +81/-208)
```diff
@@ -35,8 +35,7 @@
         "react-i18next": "^17.0.10",
         "react-markdown": "^10.1.0",
         "react-router-dom": "^6.11.0",
-        "socket.io-client": "^4.7.2",
-        "xlsx": "^0.18.5"
+        "socket.io-client": "^4.7.2"
       },
       "devDependencies": {
         "@babel/core": "^7.24.0",
@@ -4430,9 +4429,10 @@
       }
     },
     "node_modules/@remix-run/router": {
-      "version": "1.23.0",
-      "resolved": "https://registry.npmjs.org/@remix-run/router/-/router-1.23.0.tgz",
-      "integrity": "sha512-O3rHJzAQKamUz1fvE0Qaw0xSFqsA/yafi2iqeE0pvdFtCO1viYx8QL6f3Ln/aCCTLxs68SLf0KPM9eSeM8yBnA==",
+      "version": "1.23.4",
+      "resolved": "https://registry.npmjs.org/@remix-run/router/-/router-1.23.4.tgz",
+      "integrity": "sha512-q7j5geK7xs3UJSdm9/iytUNclBnLmYx1EnSeCFXHPeutdqgIMeFeHtUZgS3EhlKxdBEAu8OwtJCwmLrEzpSs7Q==",
+      "license": "MIT",
       "engines": {
         "node": ">=14.0.0"
       }
@@ -5786,9 +5786,9 @@
       }
     },
     "node_modules/@xmldom/xmldom": {
-      "version": "0.8.13",
-      "resolved": "https://registry.npmjs.org/@xmldom/xmldom/-/xmldom-0.8.13.tgz",
-      "integrity": "sha512-KRYzxepc14G/CEpEGc3Yn+JKaAeT63smlDr+vjB8jRfgTBBI9wRj/nkQEO+ucV8p8I9bfKLWp37uHgFrbntPvw==",
+      "version": "0.8.15",
+      "resolved": "https://registry.npmjs.org/@xmldom/xmldom/-/xmldom-0.8.15.tgz",
+      "integrity": "sha512-/5NV/vDALVFDXgLmfsy9TRCBlKwO2LNBFzpzvb9iIj+jR+eSc6DLYYvVOdivT/jm7MtU6TebYuRmzEOI7w40UA==",
       "license": "MIT",
       "engines": {
         "node": ">=10.0.0"
@@ -5846,20 +5846,10 @@
         "node": ">=0.4.0"
       }
     },
-    "node_modules/adler-32": {
-      "version": "1.3.1",
-      "resolved": "https://registry.npmjs.org/adler-32/-/adler-32-1.3.1.tgz",
-      "integrity": "sha512-ynZ4w/nUUv5rrsR8UUGoe1VC9hZj6V5hU9Qw1HlMDJGEJw5S7TfTErWTjMys6M7vr0YWcPqs3qAr4ss0nDfP+A==",
-      "license": "Apache-2.0",
-      "engines": {
-        "node": ">=0.8"
-      }
-    },
     "node_modules/agent-base": {
       "version": "6.0.2",
       "resolved": "https://registry.npmjs.org/agent-base/-/agent-base-6.0.2.tgz",
       "integrity": "sha512-RZNwNclF7+MS/8bDg70amg32dyeZGZxiDuQmZxKLAlQjr3jGyLx+4Kkk58UO7D2QdgFIQCovuSuZESne6RG6XQ==",
-      "dev": true,
       "license": "MIT",
       "dependencies": {
         "debug": "4"
@@ -6155,13 +6145,15 @@
       }
     },
     "node_modules/axios": {
-      "version": "1.9.0",
-      "resolved": "https://registry.npmjs.org/axios/-/axios-1.9.0.tgz",
-      "integrity": "sha512-re4CqKTJaURpzbLHtIi6XpDv20/CnpXOtjRY5/CU32L8gU8ek9UIivcfvSWvmKEngmVbrUtPpdDwWDWL7DNHvg==",
+      "version": "1.20.0",
+      "resolved": "https://registry.npmjs.org/axios/-/axios-1.20.0.tgz",
+      "integrity": "sha512-r8aOh8j9cGKpgQAqpzrUHnSIc6a59Y3Xf/cv8sy1DrHCkZHzQGEuoq1tARk6qSyDdtQGSDgpb9kFlruzPvrgwg==",
+      "license": "MIT",
       "dependencies": {
-        "follow-redirects": "^1.15.6",
-        "form-data": "^4.0.0",
-        "proxy-from-env": "^1.1.0"
+        "follow-redirects": "^1.16.0",
+        "form-data": "^4.0.6",
+        "https-proxy-agent": "^5.0.1",
+        "proxy-from-env": "^2.1.0"
       }
     },
     "node_modules/axobject-query": {
@@ -6391,12 +6383,6 @@
       ],
       "license": "MIT"
     },
-    "node_modules/bluebird": {
-      "version": "3.4.7",
-      "resolved": "https://registry.npmjs.org/bluebird/-/bluebird-3.4.7.tgz",
-      "integrity": "sha512-iD3898SR7sWVRHbiQv+sHUtHnMvC1o3nW5rAcqnq3uOn07DSAppZYUkIGslDz6gXC7HfunPe7YVBgoEJASPcHA==",
-      "license": "MIT"
-    },
     "node_modules/brace-expansion": {
       "version": "1.1.11",
       "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-1.1.11.tgz",
@@ -6562,19 +6548,6 @@
         "url": "https://github.com/sponsors/wooorm"
       }
     },
-    "node_modules/cfb": {
-      "version": "1.2.2",
-      "resolved": "https://registry.npmjs.org/cfb/-/cfb-1.2.2.tgz",
-      "integrity": "sha512-KfdUZsSOw19/ObEWasvBP/Ac4reZvAGauZhs6S/gqNhXhI7cKwvlH7ulj+dOEYnca4bm4SGo8C1bTAQvnTjgQA==",
-      "license": "Apache-2.0",
-      "dependencies": {
-        "adler-32": "~1.3.0",
-        "crc-32": "~1.2.0"
-      },
-      "engines": {
-        "node": ">=0.8"
-      }
-    },
     "node_modules/chalk": {
       "version": "4.1.2",
       "resolved": "https://registry.npmjs.org/chalk/-/chalk-4.1.2.tgz",
@@ -6706,15 +6679,6 @@
         "node": ">= 0.12.0"
       }
     },
-    "node_modules/codepage": {
-      "version": "1.15.0",
-      "resolved": "https://registry.npmjs.org/codepage/-/codepage-1.15.0.tgz",
-      "integrity": "sha512-3g6NUTPd/YtuuGrhMnOMRjFc+LJw/bnMp3+0r/Wcz3IXUuCosKRJvMphm5+Q+bvTVGcJJuRvVLuYba+WojaFaA==",
-      "license": "Apache-2.0",
-      "engines": {
-        "node": ">=0.8"
-      }
-    },
     "node_modules/collect-v8-coverage": {
       "version": "1.0.2",
       "resolved": "https://registry.npmjs.org/collect-v8-coverage/-/collect-v8-coverage-1.0.2.tgz",
@@ -6811,18 +6775,6 @@
         "node": "
```

**File**: `frontend/package.json` (modified, +1/-2)
```diff
@@ -30,8 +30,7 @@
     "react-i18next": "^17.0.10",
     "react-markdown": "^10.1.0",
     "react-router-dom": "^6.11.0",
-    "socket.io-client": "^4.7.2",
-    "xlsx": "^0.18.5"
+    "socket.io-client": "^4.7.2"
   },
   "scripts": {
     "start": "vite",
```

---

### Incident Patch 4: `89579a68` (2026-10-06)
**Commit Message**: fix(tasks): track offered revisions for board wakes (#2079)

**File**: `backend/__tests__/service/taskEventService.offeredAt.test.js` (added, +287/-0)
```diff
@@ -0,0 +1,287 @@
+/**
+ * offeredAt is a revision marker, not a delivery timestamp. These probes use
+ * Mongo's real CAS and aggregation semantics because either error is silent:
+ * a stale stamp can lose a wake, and a future stamp can hide one.
+ */
+/* eslint-disable import/no-unresolved, import/extensions */
+const mongoose = require('mongoose');
+const {
+  setupMongoDb,
+  closeMongoDb,
+  clearMongoDb,
+} = require('../utils/testUtils');
+
+jest.mock('../../models/AgentRegistry', () => ({
+  AgentInstallation: {
+    find: jest.fn(),
+    findOne: jest.fn(),
+  },
+}));
+
+jest.mock('../../models/AgentEvent', () => ({
+  findOneAndUpdate: jest.fn(),
+  updateOne: jest.fn(),
+}));
+
+jest.mock('../../services/agentEventService', () => ({
+  enqueue: jest.fn(),
+}));
+
+const mockBoardWakeEnabled = jest.fn(() => true);
+jest.mock('../../services/agentMentionService', () => ({
+  boardWakeEnabled: (...args) => mockBoardWakeEnabled(...args),
+}));
+
+const Task = require('../../models/Task');
+const { AgentInstallation } = require('../../models/AgentRegistry');
+const AgentEventService = require('../../services/agentEventService');
+const AgentEvent = require('../../models/AgentEvent');
+const { notifyPodAgents } = require('../../services/taskEventService');
+const KernelWorkSweepService = require('../../services/kernelWorkSweepService');
+
+const POD_ID = new mongoose.Types.ObjectId();
+const NOW = new Date('2026-08-20T20:00:00.000Z');
+const SINCE = new Date(NOW.getTime() - 10 * 60 * 1000);
+
+const install = (agentName = 'scout') => ({
+  agentName,
+  instanceId: 'default',
+  podId: POD_ID.toString(),
+  status: 'active',
+  config: { boardWake: { enabled: true } },
+});
+
+const setInstalls = (installs) => {
+  AgentInstallation.find.mockReturnValue({
+    lean: jest.fn().mockResolvedValue(installs),
+  });
+};
+
+let taskNum = 0;
+async function createTask({
+  taskId,
+  updatedAt,
+  offeredAt,
+  assignee = null,
+  status = 'pending',
+  claimedBy = null,
+  claimExpiresAt = null,
+}) {
+  taskNum += 1;
+  const created = await Task.create({
+    podId: POD_ID,
+    taskNum,
+    taskId,
+    title: taskId,
+    status,
+    assignee,
+    claimedBy,
+    claimExpiresAt,
+  });
+  const set = { updatedAt };
+  if (offeredAt) set.offeredAt = offeredAt;
+  await Task.updateOne({ _id: created._id }, { $set: set }, { timestamps: false });
+  return Task.findById(created._id).lean();
+}
+
+beforeAll(async () => {
+  await setupMongoDb();
+  await Task.init();
+});
+
+beforeEach(async () => {
+  await clearMongoDb();
+  jest.clearAllMocks();
+  taskNum = 0;
+  setInstalls([install()]);
+  AgentEvent.findOneAndUpdate.mockResolvedValue(null);
+  AgentEvent.updateOne.mockResolvedValue({});
+  AgentEventService.enqueue.mockResolvedValue({});
+  mockBoardWakeEnabled.mockReturnValue(true);
+  AgentInstallation.findOne.mockReturnValue({
+    select: jest.fn().mockReturnValue({
+      lean: jest.fn().mockResolvedValue(null),
+    }),
+  });
+});
+
+afterAll(async () => {
+  await clearMongoDb();
+  await closeMongoDb();
+});
+
+describe('kernel sweep offeredAt filter', () => {
+  it('keeps starter rows due until a Guide installation can receive them', async () => {
+    const starter = await createTask({
+      taskId: 'TASK-STARTER',
+      updatedAt: new Date(NOW.getTime() - 30000),
+    });
+    setInstalls([]);
+
+    const beforeInstall = await KernelWorkSweepService.wakeForFoundWork(NOW);
+    expect(beforeInstall).toEqual({ woken: 0, skippedNoWork: 1, scannedPods: 1 });
+    expect(AgentEventService.enqueue).not.toHaveBeenCalled();
+    expect((await Task.findById(starter._id).lean()).offeredAt).toBeUndefined();
+
+    setInstalls([install('guide')]);
+    const afterInstall = await KernelWorkSweepService.wakeForFoundWork(NOW);
+    expect(afterInstall).toEqual({ woken: 1, skippedNoWork: 0, scannedPods: 1 });
+    expect(AgentEventService.enqueue).toHaveBeenCalledTimes(1);
+    const [{ payload: { content } }] = AgentEventService.enqueue.mock.calls[0];
+    expect(content).toContain('TASK-STARTER');
+    const afterOffer = await Task.findById(starter._id).lean();
+    expect(afterOffer.offeredAt).toEqual(afterOffer.updatedAt);
+  });
+
+  it('retries a swallowed enqueue while the unchanged revision remains in the scan window', async () => {
+    const task = await createTask({
+      taskId: 'TASK-RETRY',
+      updatedAt: new Date(NOW.getTime() - 30000),
+    });
+    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
+    AgentEventService.enqueue.mockRejectedValueOnce(new Error('event store unavailable'));
+
+    const first = await KernelWorkSweepService.wakeForFoundWork(NOW);
+    warn.mockRestore();
+
+    expect(first.woken).toBe(0);
+    expect((await Task.findById(task._id).lean()).offeredAt).toBeUndefined();
+    AgentEventService.enqueue.mockResolvedValueOnce({});
+
+    const retry = await KernelWorkSweepService.wakeForFoundWork(NOW);
+
+    expect(retry.woken).toBe(
```

**File**: `backend/__tests__/unit/services/kernelWorkSweepService.test.js` (modified, +24/-8)
```diff
@@ -338,29 +338,45 @@ describe('sweep', () => {
     expect(result.woken).toBe(1);
   });
 
-  it('matches only NEWLY actionable rows — standing stock is never re-nagged', async () => {
-    // fable's gate one. Without the updatedAt window, a pod with one unloved
-    // unassigned task gets a kernel wake EVERY pass forever — the turn-burner
-    // reborn. A task every seat declined once is deliberately unclaimed.
+  it('matches due revisions within the 10-minute scan bound', async () => {
     Task.aggregate.mockResolvedValue([]);
 
     await KernelWorkSweepService.sweep(NOW);
 
     const [pipeline] = Task.aggregate.mock.calls[0];
     const match = pipeline[0].$match;
-    expect(match.updatedAt).toBeDefined();
     expect(match.updatedAt.$gte).toEqual(new Date(NOW.getTime() - 10 * 60 * 1000));
     expect(match.status).toBe('pending');
+    expect(match.$expr).toEqual({ $lt: ['$offeredAt', '$updatedAt'] });
+    expect(match.$or).toEqual([
+      { assignee: null },
+      { assignee: '' },
+      { assignee: { $exists: false } },
+    ]);
+    const group = pipeline[1].$group;
+    expect(group.tasks.$push).toMatchObject({
+      _id: '$_id',
+      updatedAt: '$updatedAt',
+    });
   });
 
-  it('names at most five items inline — a longer wake is a report, not a wake', async () => {
-    const many = Array.from({ length: 9 }, (_, i) => ({ taskId: `TASK-${i}`, title: `t${i}` }));
+  it('passes every due row for stamping, including rows beyond the five named in the wake', async () => {
+    const many = Array.from({ length: 9 }, (_, i) => ({
+      _id: new mongoose.Types.ObjectId(),
+      taskId: `TASK-${i}`,
+      title: `t${i}`,
+      updatedAt: new Date(NOW.getTime() - i),
+    }));
     Task.aggregate.mockResolvedValue([{ _id: POD_A, tasks: many, count: 9 }]);
 
     await KernelWorkSweepService.sweep(NOW);
 
     const [, items, count] = mockNotifyFoundWork.mock.calls[0];
-    expect(items).toHaveLength(5);
+    expect(items).toHaveLength(9);
+    expect(items[8]).toMatchObject({
+      _id: many[8]._id,
+      updatedAt: many[8].updatedAt,
+    });
     expect(count).toBe(9);
   });
 
```

**File**: `backend/__tests__/unit/services/taskEventService.notifyPodAgents.test.js` (modified, +123/-1)
```diff
@@ -23,10 +23,15 @@ jest.mock('../../../models/AgentEvent', () => ({
   updateOne: jest.fn(),
 }));
 
+const mockTaskUpdateOne = jest.fn();
+jest.mock('../../../models/Task', () => ({
+  updateOne: (...args) => mockTaskUpdateOne(...args),
+}));
+
 const { AgentInstallation } = require('../../../models/AgentRegistry');
 const AgentEventService = require('../../../services/agentEventService');
 const AgentEvent = require('../../../models/AgentEvent');
-const { notifyPodAgents } = require('../../../services/taskEventService');
+const { notifyPodAgents, notifyFoundWork } = require('../../../services/taskEventService');
 
 const POD_ID = new mongoose.Types.ObjectId().toString();
 const HUMAN_ID = new mongoose.Types.ObjectId().toString();
@@ -64,9 +69,73 @@ beforeEach(() => {
   // unless it explicitly seeds a pending wake.
   AgentEvent.findOneAndUpdate.mockResolvedValue(null);
   AgentEvent.updateOne.mockResolvedValue({});
+  mockTaskUpdateOne.mockResolvedValue({ matchedCount: 1 });
 });
 
 describe('notifyPodAgents', () => {
+  it('stamps the offered task revision only after every eligible seat succeeds', async () => {
+    mockInstalls([install('scout', HUMAN_ID), install('sprint-impl', HUMAN_ID)]);
+    const offeredAt = new Date('2026-08-20T20:00:00.000Z');
+    const offeredTask = task({ _id: 'task-1', updatedAt: offeredAt });
+
+    await notifyPodAgents(POD_ID, offeredTask, 'created', { userId: HUMAN_ID, isAgent: false });
+
+    expect(mockTaskUpdateOne).toHaveBeenCalledTimes(1);
+    expect(mockTaskUpdateOne).toHaveBeenCalledWith(
+      { _id: 'task-1', updatedAt: offeredAt },
+      { $set: { offeredAt } },
+      { timestamps: false },
+    );
+  });
+
+  it('leaves the task revision due when any eligible seat fails', async () => {
+    mockInstalls([install('scout', HUMAN_ID), install('sprint-impl', HUMAN_ID)]);
+    AgentEventService.enqueue
+      .mockRejectedValueOnce(new Error('event store unavailable'))
+      .mockResolvedValueOnce({});
+
+    await notifyPodAgents(
+      POD_ID,
+      task({ _id: 'task-1', updatedAt: new Date('2026-08-20T20:00:00.000Z') }),
+      'created',
+      { userId: HUMAN_ID, isAgent: false },
+    );
+
+    expect(AgentEventService.enqueue).toHaveBeenCalledTimes(2);
+    expect(mockTaskUpdateOne).not.toHaveBeenCalled();
+  });
+
+  it('leaves the task revision due if a folded wake stops being pending before its content rewrite', async () => {
+    mockInstalls([install('scout', HUMAN_ID)]);
+    AgentEvent.findOneAndUpdate.mockResolvedValueOnce({
+      _id: 'event-1',
+      payload: { boardChanges: 1 },
+    });
+    AgentEvent.updateOne.mockResolvedValueOnce({ matchedCount: 0 });
+
+    await notifyPodAgents(
+      POD_ID,
+      task({ _id: 'task-1', updatedAt: new Date('2026-08-20T20:00:00.000Z') }),
+      'updated',
+      { userId: HUMAN_ID, isAgent: false },
+    );
+
+    expect(mockTaskUpdateOne).not.toHaveBeenCalled();
+  });
+
+  it('does not mark work offered before any eligible seat is installed', async () => {
+    mockInstalls([]);
+
+    await notifyPodAgents(
+      POD_ID,
+      task({ _id: 'task-1', updatedAt: new Date('2026-08-20T20:00:00.000Z') }),
+      'created',
+      { userId: HUMAN_ID, isAgent: false },
+    );
+
+    expect(mockTaskUpdateOne).not.toHaveBeenCalled();
+  });
+
   it('rides message.posted, because a bespoke task.* type reaches neither runtime', async () => {
     mockInstalls([install('scout', HUMAN_ID)]);
 
@@ -300,3 +369,56 @@ describe('notifyPodAgents', () => {
     ).resolves.toBeUndefined();
   });
 });
+
+describe('notifyFoundWork', () => {
+  const offerRows = (count) => Array.from({ length: count }, (_, index) => ({
+    _id: `row-${index + 1}`,
+    taskId: `TASK-${index + 1}`,
+    title: `Task ${index + 1}`,
+    updatedAt: new Date(`2026-08-20T20:00:${String(index).padStart(2, '0')}.000Z`),
+  }));
+
+  it('names five rows but stamps every aggregate row, including rows 6+', async () => {
+    mockInstalls([install('scout', HUMAN_ID)]);
+    const rows = offerRows(9);
+
+    await notifyFoundWork(POD_ID, rows, rows.length, new Date('2026-08-20T20:00:00.000Z'));
+
+    const { payload: { content } } = AgentEventService.enqueue.mock.calls[0][0];
+    expect(content).toContain('TASK-1');
+    expect(content).toContain('TASK-5');
+    expect(content).not.toContain('TASK-6');
+    expect(content).toContain('…and 4 more on the board.');
+    expect(mockTaskUpdateOne).toHaveBeenCalledTimes(9);
+    rows.forEach((row) => {
+      expect(mockTaskUpdateOne).toHaveBeenCalledWith(
+        { _id: row._id, updatedAt: row.updatedAt },
+        { $set: { offeredAt: row.updatedAt } },
+        { timestamps: false },
+      );
+    });
+  });
+
+  it('leaves every aggregate row due when one seat enqueue fails', async () => {
+    mockInstalls([install('scout', HUMAN_ID), install('sprint-impl', HUMAN_ID)]);
+    AgentEventService.enqueue
+      .mockRejectedValueOnce(new Error('event store unavailable'))
+      .mockResolv
```

**File**: `backend/models/Task.ts` (modified, +4/-0)
```diff
@@ -24,6 +24,8 @@ export interface ITask extends Document {
   // ADR-018 D4: a claim is a lease, never permanent. Null on legacy claims —
   // readers derive their effective expiry from claimedAt + the route's lease.
   claimExpiresAt?: Date | null;
+  // The updatedAt revision most recently offered to eligible pod agents.
+  offeredAt?: Date | null;
   // Fable's #1080 ruling, part 2: a lapsed lease held by a PROVABLY LIVE seat
   // is deferred rather than rescued, at most three times. The counter lives on
   // the row so the sweep stays stateless; it resets on every claim, so a seat
@@ -62,6 +64,8 @@ const TaskSchema = new Schema<ITask>(
     claimedBy: { type: String, default: null },
     claimedAt: { type: Date, default: null },
     claimExpiresAt: { type: Date, default: null },
+    // No default: missing means this revision has not been offered.
+    offeredAt: { type: Date },
     rescueDeferrals: { type: Number, default: 0 },
     lapsedFrom: { type: String, default: null },
     completedAt: { type: Date, default: null },
```

**File**: `backend/services/kernelWorkSweepService.ts` (modified, +34/-19)
```diff
@@ -73,16 +73,11 @@ const LIVE_STATES = new Set(['listening']);
 const MAX_RESCUE_DEFERRALS = 3;
 
 // MUST match the cron cadence in schedulerService ('4,14,24,... * * * *' =
-// every 10 minutes). The newly-actionable window is one sweep period: wider
-// re-wakes standing stock, narrower drops rows that landed between passes.
-// If the cron cadence changes, this changes with it — they are one decision.
+// every 10 minutes). This is only a scan bound now; offeredAt vs updatedAt
+// records whether a revision was delivered. One cadence window catches rows
+// changed between passes without scanning older standing stock.
 const SWEEP_INTERVAL_MS = 10 * 60 * 1000;
 
-// How many found items a wake names inline. More than this and the wake stops
-// being "here is your work" and becomes a report; the seat can list the board
-// itself once it knows there is a reason to.
-const MAX_NAMED_ITEMS = 5;
-
 interface SweepResult {
   scannedPods: number;
   rescued: number;
@@ -305,35 +300,55 @@ class KernelWorkSweepService {
     // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
     const { notifyFoundWork } = require('./taskEventService');
 
-    // NEWLY actionable only — fable's gate one on this PR. Without the window,
-    // newly-actionable is indistinguishable from standing stock, and a pod with
-    // one unloved unassigned task gets a kernel wake EVERY pass, forever: the
-    // turn-burner this service exists to kill, reborn one layer down. A task
-    // every seat declined once is deliberately unclaimed; re-nagging is not
-    // discovery. Rescued rows enter the window because the rescue's
-    // findOneAndUpdate bumps updatedAt (Task has timestamps: true), so they
-    // still need no separate channel.
+    // updatedAt bounds the scan to the current sweep window; offeredAt records
+    // whether this exact revision was sent. A missing offeredAt sorts below a
+    // Date and is due. Rescue writes advance updatedAt as well.
     const since = new Date(now.getTime() - SWEEP_INTERVAL_MS);
     const actionable = await Task.aggregate([
       {
         $match: {
           status: 'pending',
           updatedAt: { $gte: since },
+          $expr: { $lt: ['$offeredAt', '$updatedAt'] },
           $or: [{ assignee: null }, { assignee: '' }, { assignee: { $exists: false } }],
         },
       },
       // `lapsedFrom` rides along so the wake can name who it lapsed from
       // (#1080 part 3). The wake is the surface where the near-duplicate of
       // #1078 nearly happened: a row advertised as unassigned, with its
       // finished PR invisible because the rescue had cleared the assignee.
-      { $group: { _id: '$podId', tasks: { $push: { taskId: '$taskId', title: '$title', lapsedFrom: '$lapsedFrom' } }, count: { $sum: 1 } } },
-    ]) as Array<{ _id: unknown; tasks: Array<{ taskId?: string; title?: string; lapsedFrom?: string | null }>; count: number }>;
+      {
+        $group: {
+          _id: '$podId',
+          tasks: {
+            $push: {
+              _id: '$_id',
+              taskId: '$taskId',
+              title: '$title',
+              lapsedFrom: '$lapsedFrom',
+              updatedAt: '$updatedAt',
+            },
+          },
+          count: { $sum: 1 },
+        },
+      },
+    ]) as Array<{
+      _id: unknown;
+      tasks: Array<{
+        _id?: unknown;
+        taskId?: string;
+        title?: string;
+        lapsedFrom?: string | null;
+        updatedAt?: unknown;
+      }>;
+      count: number;
+    }>;
 
     let woken = 0;
     let skippedNoWork = 0;
     for (const pod of actionable) {
       // eslint-disable-next-line no-await-in-loop
-      const result = await notifyFoundWork(pod._id, pod.tasks.slice(0, MAX_NAMED_ITEMS), pod.count, now);
+      const result = await notifyFoundWork(pod._id, pod.tasks, pod.count, now);
       if (result.woken > 0) woken += result.woken; else skippedNoWork += 1;
     }
     return { woken, skippedNoWork, scannedPods: actionable.length };
```

**File**: `backend/services/taskEventService.ts` (modified, +61/-9)
```diff
@@ -61,6 +61,39 @@ export function emitPodFocusUpdated(podId: unknown, revision: number): void {
   }
 }
 
+type OfferRevision = {
+  _id?: unknown;
+  taskId?: unknown;
+  updatedAt?: unknown;
+};
+
+/**
+ * Stamp only the exact task revisions offered. A concurrent board edit leaves
+ * its newer updatedAt unmatched and due for the next sweep.
+ */
+async function stampOfferedRevisions(revisions: OfferRevision[]): Promise<void> {
+  const candidates = revisions.filter((revision) => revision._id && revision.updatedAt);
+  if (!candidates.length) return;
+
+  // eslint-disable-next-line global-require, @typescript-eslint/no-require-imports
+  const Task = require('../models/Task');
+  await Promise.all(candidates.map(async (revision) => {
+    try {
+      await Task.updateOne(
+        { _id: revision._id, updatedAt: revision.updatedAt },
+        { $set: { offeredAt: revision.updatedAt } },
+        { timestamps: false },
+      );
+    } catch (err) {
+      console.warn(
+        '[task-event] offered-at stamp failed for '
+          + String(revision.taskId || revision._id) + ':',
+        (err as Error).message,
+      );
+    }
+  }));
+}
+
 /**
  * Wake the pod's agents on a board change (ADR-024 D1, "producer parity").
  *
@@ -207,9 +240,9 @@ export async function notifyPodAgents(
     const actorKey = actor?.isAgent && actor?.agentName
       ? `${String(actor.agentName).toLowerCase()}::${String(actor.instanceId || 'default')}`
       : null;
-    await Promise.all(installs.map(async (install: Record<string, unknown>) => {
+    const outcomes = await Promise.all(installs.map(async (install: Record<string, unknown>) => {
       const installKey = `${String(install.agentName || '').toLowerCase()}::${String(install.instanceId || 'default')}`;
-      if (actorKey && installKey === actorKey) return;
+      if (actorKey && installKey === actorKey) return null;
       const agentName = install.agentName;
       const instanceId = install.instanceId || 'default';
       try {
@@ -239,11 +272,12 @@ export async function notifyPodAgents(
           // Rewrite the content to reflect the true count. Separate from the
           // $inc because the summary line needs the POST-increment value.
           const extra = Number(folded.payload?.boardChanges || 1);
-          await AgentEvent.updateOne(
+          const rewrite = await AgentEvent.updateOne(
             { _id: folded._id, status: 'pending' },
             { $set: { 'payload.content': buildContent(extra) } },
           );
-          return;
+          if (rewrite?.matchedCount === 0) return undefined;
+          return true;
         }
 
         await AgentEventService.enqueue({
@@ -264,16 +298,24 @@ export async function notifyPodAgents(
             dmKind,
           },
         });
+        return true;
       } catch (err) {
         console.warn(`[task-event] enqueue failed for ${agentName}:`, (err as Error).message);
       }
     }));
+    const failed = outcomes.some((outcome) => outcome === undefined);
+    const offered = outcomes.some((outcome) => outcome === true);
+    if (offered && !failed) {
+      await stampOfferedRevisions([task]);
+    }
   } catch (err) {
     // A board change must never fail because the agent fan-out did.
     console.warn('[task-event] agent notify failed:', (err as Error).message);
   }
 }
 
+const MAX_NAMED_ITEMS = 5;
+
 /**
  * Kernel-sweep wake (#1044): the pod has actionable work — pending, unassigned
  * — and the kernel found it, so no model turn was spent discovering it.
@@ -294,10 +336,13 @@ export async function notifyPodAgents(
  *   Known bounded leak, recorded not fixed (same stance as fable's 55846): an
  *   agent change folding into a pending kernel wake rides under kernel
  *   pricing — at most one per drain.
+ * - The sweep passes every due row for stamping, though only five are named in
+ *   the wake. Revisions are stamped only after every eligible seat succeeds;
+ *   one failure leaves the batch due for the next pass.
  */
 export async function notifyFoundWork(
   podId: unknown,
-  items: Array<{ taskId?: string; title?: string; lapsedFrom?: string | null }>,
+  items: Array<OfferRevision & { title?: string; lapsedFrom?: string | null }>,
   totalCount: number,
   now: Date = new Date(),
 ): Promise<{ woken: number }> {
@@ -320,13 +365,16 @@ export async function notifyFoundWork(
     // thing standing between that and a duplicate implementation is whether a
     // peer happens to be reading the pod. Two reviewers hand-warned the room
     // about exactly this on TASK-015 within one minute of each other.
-    const listed = items
+    const namedItems = items.slice(0, MAX_NAMED_ITEMS);
+    const listed = namedItems
       .map((t) => {
         const line = `- ${t.taskId || '?'} — ${String(t.title || '(untitled)').slice(0, 80)}`;
         return t.lapsedFrom ? `${line}  [lapsed from ${t.lapsedFrom} — check their work before starting]` : line;
       })
       .join('\n');
-    con
```

---

### Incident Patch 5: `4cddaae3` (2026-10-01)
**Commit Message**: fix(connectors): keep tool grants out of channels (#2073)

* fix(connectors): keep tool grants out of channels

* test(connectors): model hosted row without installation id

* test(connectors): witness tool-only channel filter

**File**: `frontend/src/v2/__tests__/V2ConnectorsPage.test.tsx` (modified, +26/-0)
```diff
@@ -959,6 +959,32 @@ describe('V2ConnectorsPage', () => {
       expect(screen.getAllByRole('button', { name: 'Add' })).toHaveLength(1);
     });
 
+    it('keeps tool-only connections out of Channels and refuses an unknown type as a row title', async () => {
+      mockCatalog([entry()], [
+        {
+          // Real hosted-MCP rows have no installationId; filter them by type.
+          _id: 'i-hosted-linear', type: 'hosted-mcp', status: 'connected',
+          config: { entryId: 'linear' },
+        },
+        {
+          _id: 'i-github-app', installationId: 'github-install', type: 'github-app', status: 'connected',
+        },
+        {
+          _id: 'i-unknown-channel', type: 'custom-messaging-platform', status: 'connected',
+        },
+      ]);
+      renderPage();
+
+      await waitFor(() => expect(screen.getByRole('button', { name: 'View Telegram' })).toBeInTheDocument());
+      expect(screen.queryByRole('button', { name: /hosted-mcp|github-app/i })).toBeNull();
+      expect(screen.queryByRole('button', { name: 'View Custom Messaging Platform' })).toBeNull();
+      expect(screen.queryByText('hosted-mcp')).toBeNull();
+      expect(screen.queryByText('github-app')).toBeNull();
+      expect(screen.queryByText('Hosted tool')).toBeNull();
+      expect(screen.queryByText('GitHub App')).toBeNull();
+      expect(screen.queryByText('custom-messaging-platform')).toBeNull();
+    });
+
     // TASK-024. Discord is a shipping connector (routes/discord.ts: install
     // link, callback, binding, uninstall) that read as "we don't build this"
     // because its manifest declared no readiness(), which is what the catalog
```

**File**: `frontend/src/v2/components/V2ConnectorsPage.tsx` (modified, +20/-5)
```diff
@@ -163,8 +163,16 @@ const TYPE_LABELS: Record<string, string> = {
   groupme: 'GroupMe',
   x: 'X',
   instagram: 'Instagram',
+  // Human-readable fallback only. These tool connections are still excluded
+  // from Channels by type in allItems below.
+  'github-app': 'GitHub App',
+  'hosted-mcp': 'Hosted tool',
 };
 
+const TOOL_ONLY_CONNECTION_TYPES = new Set(['github-app', 'hosted-mcp']);
+
+const mappedTypeLabel = (type: string): string | null => TYPE_LABELS[type] || null;
+
 // The onboarding sentence for a provider you can connect right now. Keyed by
 // provider and deliberately without a default: an unmapped provider renders no
 // detail line at all. The two-branch ternary this replaces gave every provider
@@ -1076,7 +1084,7 @@ const V2ConnectorsPage: React.FC = () => {
   };
 
   const catalogTypes = new Set((catalog || []).map((entry) => entry.installableId));
-  const items: ListItem[] = [
+  const allItems: ListItem[] = [
     ...(catalog || []).map((entry): ListItem => ({
       kind: 'catalog',
       key: `catalog:${entry.installableId}`,
@@ -1086,20 +1094,27 @@ const V2ConnectorsPage: React.FC = () => {
     // Rows the catalog does not describe: legacy pod-scoped connectors, and
     // installable rows only while the catalog itself cannot be read.
     ...connectors
-      .filter((connector) => !(connector.installationId && catalogTypes.has(connector.type)))
+      .filter((connector) => (
+        !TOOL_ONLY_CONNECTION_TYPES.has(connector.type)
+        && !(connector.installationId && catalogTypes.has(connector.type))
+      ))
       .map((connector): ListItem => ({ kind: 'legacy', key: `legacy:${connector._id}`, connector })),
   ];
 
   const rowForItem = (item: ListItem): ConnectorRow => (
     item.kind === 'catalog' ? rowForEntry(item.entry, item.connector) : rowFor(item.connector)
   );
 
-  const itemLabel = (item: ListItem): string => (
+  const itemLabel = (item: ListItem): string | null => (
     item.kind === 'catalog'
-      ? (item.entry.label || TYPE_LABELS[item.entry.installableId] || item.entry.installableId)
-      : (TYPE_LABELS[item.connector.type] || item.connector.type)
+      ? (item.entry.label?.trim() || mappedTypeLabel(item.entry.installableId))
+      : mappedTypeLabel(item.connector.type)
   );
 
+  // A backend type is an identifier, not a customer-facing name. Unknown types
+  // have no Channels row until the catalog provides a label or this map does.
+  const items = allItems.filter((item) => Boolean(itemLabel(item)));
+
   const itemType = (item: ListItem): string => (item.kind === 'catalog' ? item.entry.installableId : item.connector.type);
 
   // Direction A rule 3: every row's kicker is `pod · verb age` in mono. The verb
```

---

### Incident Patch 6: `4e489916` (2026-10-01)
**Commit Message**: fix(hosted-mcp): withdraw prior account token on reconnect (#2072)

* fix(hosted-mcp): withdraw prior account token on reconnect

* fix(hosted-mcp): name manual revoke notice

* test(hosted-mcp): wait for revoke target before asserting

**File**: `backend/__tests__/unit/routes/hostedMcpConnect.callback.test.js` (modified, +240/-1)
```diff
@@ -121,6 +121,10 @@ const okTokenResponse = {
 
 beforeEach(() => {
   jest.clearAllMocks();
+  delete FIXTURE_ENTRY.revoke.endpoint;
+  connectorSecrets.get.mockReset();
+  connectorSecrets.put.mockReset();
+  connectorSecrets.revoke.mockReset();
   intake.discoverAuthorizationServer.mockResolvedValue({
     // §3.3's required claim, so the stub matches what real discovery returns.
     issuer: 'https://mcp.linear.app',
@@ -148,7 +152,16 @@ const setStoredRow = (overrides = {}) => {
 
 const outcome = (res) => {
   const url = new URL(res.headers.location, 'https://commonly.me');
-  return { status: res.status, hostedMcp: url.searchParams.get('hostedMcp'), code: url.searchParams.get('code') };
+  const result = {
+    status: res.status,
+    hostedMcp: url.searchParams.get('hostedMcp'),
+    code: url.searchParams.get('code'),
+  };
+  const entryId = url.searchParams.get('entryId');
+  const revokeAt = url.searchParams.get('revokeAt');
+  if (entryId) result.entryId = entryId;
+  if (revokeAt) result.revokeAt = revokeAt;
+  return result;
 };
 
 describe('hosted-mcp connect: callback', () => {
@@ -360,16 +373,242 @@ describe('hosted-mcp connect: callback', () => {
     expect(revokeOrder).toBeLessThan(connectorSecrets.put.mock.invocationCallOrder[0]);
   });
 
+  it('a reconnect as a different provider account withdraws the old refresh token before either new secret overwrites it', async () => {
+    FIXTURE_ENTRY.revoke.endpoint = 'https://mcp.linear.app/revoke';
+    setStoredRow({
+      credentialRef: 'ref-old-access',
+      refreshTokenRef: 'ref-old-refresh',
+      providerSubject: 'acct-old',
+      clientId: intake.hostedMcpClientMetadataUrl('linear'),
+    });
+    const secretValues = new Map([
+      ['ref-old-access', 'old-access-token'],
+      ['ref-old-refresh', 'old-refresh-token'],
+    ]);
+    connectorSecrets.get.mockImplementation(async (ref) => secretValues.get(String(ref)));
+    connectorSecrets.put.mockReset();
+    connectorSecrets.put.mockImplementation(async (_rowId, kind, value) => {
+      const ref = kind.kind === 'hosted-mcp-refresh-token' ? 'ref-old-refresh' : 'ref-old-access';
+      secretValues.set(ref, value);
+      return ref;
+    });
+    global.fetch.mockReset();
+    global.fetch
+      .mockResolvedValueOnce(okTokenResponse)
+      .mockResolvedValueOnce({ ok: true, status: 200 });
+
+    const res = await callback();
+
+    expect(outcome(res).hostedMcp).toBe('connected');
+    expect(outcome(res).revokeAt).toBeUndefined();
+    expect(global.fetch).toHaveBeenCalledTimes(2);
+    expect(global.fetch.mock.calls[1][0]).toBe(FIXTURE_ENTRY.revoke.endpoint);
+    const revokeBody = new URLSearchParams(String(global.fetch.mock.calls[1][1].body));
+    expect(revokeBody.get('token')).toBe('old-refresh-token');
+    expect(revokeBody.get('token')).not.toBe('refresh-1');
+    expect(revokeBody.get('token_type_hint')).toBe('refresh_token');
+    // This is the ordering contract: connectorSecrets.put updates the old ref
+    // in place, so moving the get below either put sends the newly authorized
+    // token to the revocation endpoint instead.
+    expect(connectorSecrets.get.mock.invocationCallOrder[0])
+      .toBeLessThan(connectorSecrets.put.mock.invocationCallOrder[0]);
+    expect(secretValues.get('ref-old-refresh')).toBe('refresh-1');
+    expect(Integration.findOneAndUpdate).toHaveBeenCalledTimes(2);
+  });
+
+  it.each([
+    ['the stored subject is missing', { credentialRef: 'ref-old-access', refreshTokenRef: 'ref-old-refresh' }, idToken('acct-new')],
+    ['the exchanged subject is missing', {
+      credentialRef: 'ref-old-access',
+      refreshTokenRef: 'ref-old-refresh',
+      providerSubject: 'acct-old',
+    }, undefined],
+  ])('a reconnect whose subjects cannot be compared sends nothing and names the revoke page when %s', async (_label, oldConfig, newIdToken) => {
+    FIXTURE_ENTRY.revoke.endpoint = 'https://mcp.linear.app/revoke';
+    setStoredRow(oldConfig);
+    global.fetch.mockResolvedValue({
+      ok: true,
+      json: async () => ({
+        access_token: 'access-1',
+        refresh_token: 'refresh-1',
+        ...(newIdToken ? { id_token: newIdToken } : {}),
+      }),
+    });
+
+    const res = await callback();
+
+    expect(outcome(res)).toEqual({
+      status: 302,
+      hostedMcp: 'connected',
+      code: null,
+      entryId: 'linear',
+      revokeAt: FIXTURE_ENTRY.revoke.page,
+    });
+    expect(global.fetch).toHaveBeenCalledTimes(1);
+    expect(connectorSecrets.get).not.toHaveBeenCalled();
+    expect(connectorSecrets.put).toHaveBeenCalledTimes(2);
+    expect(Integration.findOneAndUpdate).toHaveBeenCalledTimes(2);
+  });
+
+  it('a refused provider withdrawal still finishes the reconnect and names the revoke page', async () => {
+    FIXTURE_ENTRY.revoke.endpoint = 'https://mcp.linear.app/revoke';
+    setStoredRow({
+      credentialRef: 'ref-old-access',
+      refreshTokenRef: 'ref-old-refresh',
+      providerSu
```

**File**: `backend/routes/hostedMcpConnect.ts` (modified, +69/-6)
```diff
@@ -31,6 +31,8 @@ const { HOSTED_MCP_ACCESS_TOKEN, HOSTED_MCP_REFRESH_TOKEN } = require('../servic
 // eslint-disable-next-line global-require
 const { revokeConnectionGrants } = require('../services/roomGrantService');
 // eslint-disable-next-line global-require
+const { revokeTokenAtVendor } = require('../services/connectionRemovalService');
+// eslint-disable-next-line global-require
 const { HOSTED_MCP_ENTRIES, findHostedMcpEntry, hostedMcpRevokeTarget } = require('../integrations/hostedMcp/entries');
 // eslint-disable-next-line global-require
 const {
@@ -71,9 +73,18 @@ const publicAppUrl = (): string => {
   return (configured || 'https://commonly.me').replace(/\/+$/, '');
 };
 
-const callbackRedirect = (res: Response, status: string, code?: string) => {
+const callbackRedirect = (
+  res: Response,
+  status: string,
+  code?: string,
+  manualRevoke?: { entryId: string; revokeAt: string },
+) => {
   const query = new URLSearchParams({ hostedMcp: status });
   if (code) query.set('code', code);
+  if (manualRevoke) {
+    query.set('entryId', manualRevoke.entryId);
+    query.set('revokeAt', manualRevoke.revokeAt);
+  }
   return res.redirect(302, `${publicAppUrl()}/v2/connectors?${query.toString()}`);
 };
 
@@ -398,16 +409,65 @@ router.get('/:entryId/callback', callbackRateLimit, async (req: Request, res: Re
   // never be dropped. The arms below read the same shape.
   const previousSubject = consumed.config?.providerSubject || undefined;
   const providerSubject = idTokenSubject(tokens.id_token);
+  const hasPreviousCredential = Boolean(
+    consumed.config?.credentialRef || consumed.config?.refreshTokenRef,
+  );
+  const subjectsComparable = Boolean(previousSubject && providerSubject);
+  const subjectChanged = subjectsComparable && previousSubject !== providerSubject;
   // §2: a grant was made against the reach of the account connected at the
   // time, and the row's `createdAt` survives a reconnect, so the broker's
-  // TASK-148 guard cannot see this one. An unknowable subject revokes too —
-  // assuming the account is unchanged is the assumption that costs the most.
-  const accountChanged = Boolean(consumed.config?.credentialRef)
-    && (!providerSubject || !previousSubject || providerSubject !== previousSubject);
+  // TASK-148 guard cannot see this one. An unknowable subject is not proof of a
+  // same-account reconnect, so its grants are revoked and the person gets the
+  // vendor page to decide whether an older authorization still needs removing.
+  const accountChanged = hasPreviousCredential && (!subjectsComparable || subjectChanged);
   if (accountChanged) {
     await revokeConnectionGrants({ connection: consumed, revokedBy: owner });
   }
 
+  let manualRevokeAt: string | undefined;
+  if (hasPreviousCredential && !subjectsComparable) {
+    // Never send an uncomparable token: it may be the same account that just
+    // authorized the new pair, and some vendors revoke all grants for that
+    // account/client together.
+    manualRevokeAt = hostedMcpRevokeTarget(entry)?.page;
+  } else if (hasPreviousCredential && subjectChanged) {
+    const revokeTarget = hostedMcpRevokeTarget(entry);
+    const recordedClientId = consumed.config?.clientId;
+    const clientMatches = !recordedClientId || recordedClientId === client.clientId;
+    const previousTokenRef = consumed.config?.refreshTokenRef || consumed.config?.credentialRef;
+    let withdrawn = false;
+
+    if (revokeTarget?.endpoint && clientMatches && previousTokenRef) {
+      let previousToken: unknown;
+      try {
+        // This read must precede the first put below. connectorSecrets.put
+        // replaces the ciphertext under this same kind/ref on reconnect.
+        previousToken = await connectorSecrets.get(String(previousTokenRef));
+      } catch {
+        // The callback still finishes; the provider page is the only recovery
+        // once the new token pair overwrites this one.
+      }
+
+      if (typeof previousToken === 'string' && previousToken) {
+        try {
+          await revokeTokenAtVendor({
+            entry,
+            clientId: client.clientId,
+            ...(client.clientSecret ? { clientSecret: client.clientSecret } : {}),
+            token: previousToken,
+            tokenTypeHint: consumed.config?.refreshTokenRef ? 'refresh_token' : 'access_token',
+          });
+          withdrawn = true;
+        } catch {
+          // Do not stop the successful reconnect or expose provider details.
+          // The old token cannot be retried after the secret ref is overwritten.
+        }
+      }
+    }
+
+    if (!withdrawn) manualRevokeAt = revokeTarget?.page;
+  }
+
   const credentialRef = await connectorSecrets.put(String(consumed._id), HOSTED_MCP_ACCESS_TOKEN, tokens.access_token);
   let refreshTokenRef = consumed.config?.refreshTokenRef || undefined;
   if (tokens.refresh_token) {
@@ -459,7 +519,10 @@ router.get('/:entryId/callback', callbackRateLimit, async (req: Request
```

**File**: `frontend/src/i18n/locales/en.json` (modified, +2/-0)
```diff
@@ -1907,6 +1907,8 @@
     "gateOff": "off",
     "gateSwitch": "Relay {{pod}}",
     "gatesTitle": "Pods that reach this channel",
+    "hostedMcpManualRevoke": "{{provider}} may still list your previous account.",
+    "hostedMcpReviewAuthorization": "Open {{provider}}'s connected apps",
     "installInProgress": "Still setting up — try again in a moment.",
     "installInProgressForPod": "Still setting up for {{pod}} — try again in a moment.",
     "leadAny": "Any agent leads",
```

**File**: `frontend/src/i18n/locales/zh-CN.json` (modified, +2/-0)
```diff
@@ -1899,6 +1899,8 @@
     "gateOff": "已关闭",
     "gateSwitch": "转发 {{pod}}",
     "gatesTitle": "接入此频道的 Pod",
+    "hostedMcpManualRevoke": "{{provider}} 仍可能列出你之前的账户。",
+    "hostedMcpReviewAuthorization": "打开 {{provider}} 的已连接应用",
     "installInProgress": "仍在设置中，请稍后再试。",
     "installInProgressForPod": "{{pod}} 仍在设置中，请稍后再试。",
     "leadAny": "任一智能体都可主导",
```

**File**: `frontend/src/v2/__tests__/V2ConnectorsPage.test.tsx` (modified, +57/-1)
```diff
@@ -62,9 +62,10 @@ const connectors = [
   },
 ];
 
-const mockGets = (list = connectors) => {
+const mockGets = (list = connectors, installables = null) => {
   axios.get.mockImplementation((url) => {
     if (url === '/api/integrations/user/all') return Promise.resolve({ data: list });
+    if (url === '/api/installables' && installables) return Promise.resolve({ data: { installables } });
     if (url === '/api/pods') {
       return Promise.resolve({
         data: [
@@ -77,6 +78,20 @@ const mockGets = (list = connectors) => {
   });
 };
 
+const hostedLinearCatalogEntry = (connectionId = 'i-linear') => ({
+  installableId: 'linear',
+  list: 'tools',
+  label: 'Linear',
+  description: 'Read Linear issues and projects.',
+  connectionType: 'hosted-mcp',
+  entryId: 'linear',
+  available: true,
+  tools: [],
+  connections: [{ connectionId, owner: 'sam', repo: '' }],
+  installation: null,
+  integration: null,
+});
+
 const renderPage = () => render(
   <AuthContext.Provider value={authValue}>
     <MemoryRouter>
@@ -666,6 +681,47 @@ describe('V2ConnectorsPage', () => {
     expect(window.location.search).toBe('');
   });
 
+  it('shows the server-owned provider revoke page after a hosted-MCP reconnect needs manual withdrawal', async () => {
+    const revokePage = 'https://linear.app/settings/security';
+    window.history.replaceState(
+      {},
+      '',
+      `/v2/connectors?hostedMcp=connected&entryId=linear&revokeAt=${encodeURIComponent(revokePage)}`,
+    );
+    mockGets([{
+      _id: 'i-linear', type: 'hosted-mcp', status: 'connected',
+      config: { entryId: 'linear', revokePage },
+    }], [hostedLinearCatalogEntry()]);
+    renderPage();
+
+    const reviewLink = await screen.findByRole('link', { name: "Open Linear's connected apps" });
+    expect(reviewLink).toHaveAttribute('href', revokePage);
+    expect(reviewLink).toHaveAttribute('target', '_blank');
+    expect(reviewLink).toHaveAttribute('rel', 'noopener noreferrer');
+    const notice = screen.getByRole('status');
+    expect(notice).toHaveTextContent('Linear may still list your previous account.');
+    expect(notice.closest('.v2-connector-row')).toHaveTextContent('Linear');
+    expect(window.location.search).toBe('');
+  });
+
+  it('does not turn a callback query into a provider link unless it matches the row', async () => {
+    window.history.replaceState(
+      {},
+      '',
+      '/v2/connectors?hostedMcp=connected&entryId=linear&revokeAt=https%3A%2F%2Fevil.example%2F',
+    );
+    mockGets([{
+      _id: 'i-linear', type: 'hosted-mcp', status: 'connected',
+      config: { entryId: 'linear', revokePage: 'https://linear.app/settings/security' },
+    }], [hostedLinearCatalogEntry()]);
+    renderPage();
+
+    const linearDescription = await screen.findByText('Read Linear issues and projects.');
+    expect(linearDescription.closest('.v2-connector-row')).toBeInTheDocument();
+    await waitFor(() => expect(window.location.search).toBe(''));
+    expect(screen.queryByRole('link', { name: "Open Linear's connected apps" })).toBeNull();
+  });
+
   it('shows the error reconnect action and retains the separate removal action', async () => {
     mockGets([{
       _id: 'i-slack-error', installationId: 'install-slack-u1', type: 'slack', status: 'error',
```

**File**: `frontend/src/v2/components/V2ConnectorTools.tsx` (modified, +38/-1)
```diff
@@ -83,10 +83,18 @@ export interface ToolCatalogEntry {
   connections: Array<{ connectionId: string; owner: string; repo: string }>;
 }
 
+export interface HostedMcpManualRevokeNotice {
+  connectionId: string;
+  entryId: string;
+  provider: string;
+  revokePage: string;
+}
+
 interface PodSeat { userId: string | null; displayName?: string; name: string; internal?: boolean }
 
 interface Props {
   pods: V2Pod[];
+  manualRevokeNotice?: HostedMcpManualRevokeNotice | null;
 }
 
 interface DraftGrant {
@@ -181,7 +189,7 @@ const ModeGlyph: React.FC<{ mode: GrantWriteMode }> = ({ mode }) => {
   return <G><path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></G>;
 };
 
-const V2ConnectorTools: React.FC<Props> = ({ pods }) => {
+const V2ConnectorTools: React.FC<Props> = ({ pods, manualRevokeNotice = null }) => {
   const { t } = useTranslation();
   const api = useV2Api();
   // Revoke and Change access are the granter's (Vera 67912 / Wren 67913): the route 403s anyone else.
@@ -270,6 +278,28 @@ const V2ConnectorTools: React.FC<Props> = ({ pods }) => {
   const entryFor = (grant: ToolGrant): ToolCatalogEntry | null => (
     catalog.find((entry) => entryCovers(entry, grant)) || null
   );
+  const noticeMatchesEntry = (entry: ToolCatalogEntry | null): boolean => Boolean(
+    manualRevokeNotice
+    && entry?.entryId === manualRevokeNotice.entryId
+    && entry.connections.some((connection) => connection.connectionId === manualRevokeNotice.connectionId),
+  );
+  const renderManualRevokeNotice = (entry: ToolCatalogEntry | null) => {
+    if (!manualRevokeNotice || !noticeMatchesEntry(entry)) return null;
+    return (
+      <p className="v2-connector-row__refusal" role="status">
+        {t('connectors.hostedMcpManualRevoke', {
+          defaultValue: '{{provider}} may still list your previous account.',
+          provider: manualRevokeNotice.provider,
+        })}{' '}
+        <a href={manualRevokeNotice.revokePage} target="_blank" rel="noopener noreferrer">
+          {t('connectors.hostedMcpReviewAuthorization', {
+            defaultValue: "Open {{provider}}'s connected apps",
+            provider: manualRevokeNotice.provider,
+          })}
+        </a>
+      </p>
+    );
+  };
   const toolLabel = (grant: ToolGrant): string => entryFor(grant)?.label
     || t('tools.unknownConnector', { defaultValue: 'Unknown connector' });
 
@@ -552,6 +582,11 @@ const V2ConnectorTools: React.FC<Props> = ({ pods }) => {
     const isSelected = selectedId === grant.grantId;
     const entry = entryFor(grant);
     const label = toolLabel(grant);
+    const noticeGrantId = noticeMatchesEntry(entry)
+      ? (grants || []).find((candidate) => (
+        !isDead(candidate, now) && entryFor(candidate)?.installableId === entry?.installableId
+      ))?.grantId
+      : null;
     // What the grant was given TO, which is a seat when the target is a seat. It
     // is not the row's location: the kicker and the accessible name both name the
     // pod the row lives in, so a seat grant under Ops has a sentence reading
@@ -634,6 +669,7 @@ const V2ConnectorTools: React.FC<Props> = ({ pods }) => {
             <ActGlyph name="manage" />
           </button>
         )}
+        {noticeGrantId === grant.grantId && renderManualRevokeNotice(entry)}
       </article>
     );
   };
@@ -685,6 +721,7 @@ const V2ConnectorTools: React.FC<Props> = ({ pods }) => {
             {t('tools.installGitHubApp', { defaultValue: 'Install GitHub App' })}
           </button>
         )}
+        {renderManualRevokeNotice(entry)}
       </article>
     );
   };
```

**File**: `frontend/src/v2/components/V2ConnectorsPage.tsx` (modified, +68/-5)
```diff
@@ -12,7 +12,7 @@ import { useRelativeNow } from '../hooks/useRelativeNow';
 import { V2Pod, V2PodMember } from '../hooks/useV2Pods';
 import { PlatformGlyph } from '../icons/platforms';
 import { ActGlyph, MarkGlyph, MarkName } from '../icons/glyphs';
-import V2ConnectorTools from './V2ConnectorTools';
+import V2ConnectorTools, { type HostedMcpManualRevokeNotice } from './V2ConnectorTools';
 import { localizeRelativeTime } from '../utils/localizeRelativeTime';
 
 interface ConnectorGate {
@@ -23,6 +23,8 @@ interface ConnectorGate {
 }
 
 interface ConnectorConfig {
+  entryId?: string;
+  revokePage?: string;
   chatTitle?: string;
   // A linked Slack stores its workspace name here (slackOAuthService), never in
   // chatTitle — so without this the row read "Slack · linked to …" beside the
@@ -83,6 +85,7 @@ interface CatalogEntry {
   // Two lists (tools plan, Sam's option A): this page draws channels; the
   // Tools page draws tool Installables, so a `tools` row never renders here.
   list?: 'channels' | 'tools';
+  connectionType?: 'github-app' | 'hosted-mcp';
   label?: string;
   description?: string;
   available: boolean;
@@ -95,6 +98,8 @@ interface CatalogEntry {
   // restoring what this page did before the field existed.
   offered?: boolean;
   unavailableReason?: string;
+  // Tool entries provide the provider name for the hosted connection row.
+  entryId?: string;
   installation: CatalogInstallation | null;
   integration: Connector | null;
 }
@@ -258,6 +263,16 @@ const claimIsStale = (installation: CatalogInstallation): boolean => {
   return Date.now() - claimedAt >= INSTALL_LOCK_TTL_MS;
 };
 
+const safeProviderRevokePage = (value: unknown): value is string => {
+  if (typeof value !== 'string') return false;
+  try {
+    const url = new URL(value);
+    return url.protocol === 'https:' && !url.username && !url.password;
+  } catch {
+    return false;
+  }
+};
+
 const projectionMissing = (entry: CatalogEntry): boolean => (
   !entry.integration
   || entry.integration.isActive === false
@@ -276,6 +291,7 @@ const V2ConnectorsPage: React.FC = () => {
   const navigate = useNavigate();
   const [connectors, setConnectors] = useState<Connector[]>([]);
   const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null);
+  const [hostedCatalog, setHostedCatalog] = useState<CatalogEntry[] | null>(null);
   // `null` means membership is not available yet (or the read failed).  An
   // empty array is the only confirmed zero-pod state, so it alone may replace
   // the existing picker with the create-a-pod path.
@@ -290,6 +306,7 @@ const V2ConnectorsPage: React.FC = () => {
   const [expandedGate, setExpandedGate] = useState<string | null>(null);
   const [copied, setCopied] = useState<string | null>(null);
   const [error, setError] = useState<string | null>(null);
+  const [hostedMcpManualRevoke, setHostedMcpManualRevoke] = useState<HostedMcpManualRevokeNotice | null>(null);
   // Row C: a refusal raised by a row's own button belongs on that row, not
   // only in the page-level slot at the foot of the page.
   const [rowRefusal, setRowRefusal] = useState<{ key: string; message: string } | null>(null);
@@ -328,13 +345,20 @@ const V2ConnectorsPage: React.FC = () => {
         // be read the legacy list still renders and the picker falls back.
         api.get<CatalogResponse>('/api/installables').catch(() => null),
       ]);
-      setConnectors(Array.isArray(rows) ? rows : []);
-      setCatalog(catalogResponse && Array.isArray(catalogResponse.installables)
-        ? catalogResponse.installables.filter((entry) => entry.list !== 'tools')
+      const connectorRows = Array.isArray(rows) ? rows : [];
+      const installables = catalogResponse && Array.isArray(catalogResponse.installables)
+        ? catalogResponse.installables
+        : null;
+      setConnectors(connectorRows);
+      setCatalog(installables ? installables.filter((entry) => entry.list !== 'tools') : null);
+      setHostedCatalog(installables
+        ? installables.filter((entry) => entry.list === 'tools' && entry.connectionType === 'hosted-mcp')
         : null);
       setError(null);
+      return connectorRows;
     } catch {
       setError(t('connectors.loadError', { defaultValue: 'Could not load connectors.' }));
+      return [];
     } finally {
       setLoading(false);
     }
@@ -371,6 +395,45 @@ const V2ConnectorsPage: React.FC = () => {
     );
   }, [load, t]);
 
+  // The hosted-MCP callback says when a previous provider authorization may
+  // need manual attention. Resolve its page from the authenticated connection
+  // row and match the callback copy to that server-owned value; never turn an
+  // arbitrary query parameter into a provider link.
+  useEffect(() => {
+    const query = new URLSearchParams(window.location.search);
+    if (query.get('hostedMcp') !== 'connected') return;
+    // Let the ordinary page load finish first; its authenticated row is the
+    // authority for the provider lin
```

---

### Incident Patch 7: `050d3cd3` (2026-10-01)
**Commit Message**: docs(plans): matrix — Linear walked live; Google Calendar built, not offered (#2071)

* docs(plans): matrix — Linear walked live (C1–C4, C8 green; C9 open), Google Calendar built but not offered

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_013geJsV4RJMujdvpf3JV2Cv

* docs(plans): matrix — narrow Linear cells to what was measured (Rhea 76225/76226, Vera 76227)

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_013geJsV4RJMujdvpf3JV2Cv

---------

Co-authored-by: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `docs/plans/integration-readiness-matrix.md` (modified, +3/-1)
```diff
@@ -53,7 +53,9 @@ The matrix below is the definition of "ready". A row is ready when every cell is
 | GroupMe | yes | **red**: TASK-101 |
 | X | yes (admin OAuth callback + feed) | unverified |
 | GitHub (app) | yes | Walked 2026-09-25 and re-walked 2026-09-26 on `5561a1dd` (both below). Live on our own repository since 09-18. **red** in C1 until per-person GitHub: a team cannot connect its own repository. C2 at 390 is green since #1874, shown on `5561a1dd`. C3 (a hosted agent gets the broker, #1880) shipped and has not been walked. C8 was green on `9a32fca5`. A new grant from the connection's owner, `grant_3c4d6ad5` (2026-09-29, on Sam's approval), has the same scope as the lapsed 09-18 one: pod "C4 run 2026-09-18"; `list_issues`, `create_issue` and `close_issue`; write-with-confirm; audience Sam, `c3stranger0912` and `c4-smoke`. It runs to 2026-10-06, so C3, C4 and C8 are walkable again. None has been walked on the current build |
-| Hosted MCP (generic type, TASK-172) | no entry yet | **Steps 1–6 live, step 7 open, nothing offered.** Steps 1–6 of `hosted-mcp-connection-scope.md` §10 are live on `e96bb8f4` (backend started 2026-09-30 06:41:43Z); step 7, the first entry with its live walk and revocation check, remains open: the connection row (#1976); catalogue entry, projection and drift (#1993, #2014, #2023); intake with browser-bound OAuth and rate-limited public routes (#1995, #1999, #2006, #2007); credential and refresh fence (#2001, #2004, #2009); mint and broker (#2002, #2005, #2010); the owner-credential trail (#2028); the banned/missing/bot-owner refusal (#2029, TASK-181); and removal: the sequence (#2035, step 6a), then step 6b (#2047): the admin account delete refuses 409 `hosted_mcp_connection_owned` while the person owns any hosted row (the code is present in the live `admin/users` build; the behaviour is proven by the service arms, not walked), TASK-147's witnesses on the other row-removing paths (the integration `PATCH` refuses a hosted row by its kind; pod delete, the legacy Discord uninstall, the installable reconciler and admin pause each leave it alone; the sweep tripwire says it cannot trace the writer while the catalogue is empty), the entry's revoke page copied onto the row so a removal can finish after the entry leaves the catalogue, and the revoked-at-vendor mark declared on the model so it persists (#2035's first version dropped it silently). The catalogue is empty, so no vendor is reachable: an unknown entry's callback redirects to the Connectors page with `unknown_entry`, verified on the live build. **First entry is open for Sam:** Linear qualifies only if its authenticated `tools/list` carries `readOnlyHint` (Wren's ruling: no hint, no entry), and that needs one real Linear OAuth. Sentry qualifies by construction, since its source requires all three hints. Vera gates the entry, and C0–C10 are walked once end to end on it |
+| Hosted MCP (generic type, TASK-172) | yes | **Built and live, with one follow-up open.** Steps 1–6 of `hosted-mcp-connection-scope.md` §10, and step 8's prerequisites (the client record, expand phase, and the pre-registered client; #2063), are live. **Open:** the reconnect withdrawal #2069 added to step 3 (withdraw the old account's token at the vendor before dropping our copy) is not built yet, and `hostedMcpConnect.ts:406–420` does not do it. The bar every entry must meet (Wren 76043): a credential that cannot write. Notion, Sentry and Stripe wait for a vendor read scope. Entries are offered one by one; the rows below walk them |
+| Linear (hosted MCP) | yes | Partly walked live 2026-10-01 (Sam's account, Chrome). **C1 open**: Sam's own operator-led connect succeeded on `cf9b6abf`, through CIMD with scope `read openid`, and the row records its client and the Linear subject. That doesn't prove a stranger connects unaided, and no stranger has tried. **C2 partly observed**: on `cf9b6abf` the grant rendered as GitHub, because the catalogue projected 0 Linear tools. #2068 (`207c68d5`) fixed it, and on the deployed `e370fe9b` (its descendant) the row reads Linear, with its mark and the read eye, at 1200. 390, a failure reaching Activity, and revoke reachability are unwalked. **C3 green**: Scout listed the team and three issues through `grant_c6af31b8` in the C4 run pod; the trail shows the calls ok, with Sam as credential owner. **C4 provisional**: c4-smoke, a public local seat, called `linear.list_teams` through its broker, and the trail shows it ok. But its daemon process started 2026-09-27 20:58Z, before the current global cli 0.1.81 was published (2026-09-28 06:39Z). So it isn't running a current build, and the freshness requirement is unmet. **C8 open**: in a pod with no grant, Scout is offered no `linear.*` tools. That's confinement by projection. An attempted out-of-pod call, refused and recorded in the trail, hasn't been made. **C9 open**: Linear's revoke is page-only, and every linear.app settings URL redirects to the workspace's unfinished welcome flo
```

---

### Incident Patch 8: `f9940361` (2026-10-01)
**Commit Message**: fix(cli): keep Claude broker tokens out of env (#2067)

Route Commonly token placeholders in Claude HTTP MCP headers through a headersHelper. The helper reads the per-spawn 0600 credential file on each invocation; Claude can refresh it on its documented 401/403 retry without exposing the token in Claude or MCP child environments.

Add coverage for HTTP and streamable HTTP headers, mixed stdio/HTTP declarations, token-free Claude env/config, and a rotated file across one 401 retry. Update the environment test that asserted the old token-in-env behavior. Bump the CLI package version to 0.1.84 for the source-version guard.

Written by sprint-impl, a Commonly agent. Pod thread: https://commonly.me/v2/pods/6a692a1be833c668acdb84cf#message-76155.

**File**: `cli/__tests__/adapters.claude.credential-channel.test.mjs` (modified, +91/-26)
```diff
@@ -18,6 +18,7 @@
  */
 
 import { jest } from '@jest/globals';
+import { execFileSync } from 'node:child_process';
 import { EventEmitter } from 'events';
 import os from 'os';
 import path from 'path';
@@ -69,16 +70,18 @@ const fakeChild = ({ stdout = '', code = 0 } = {}) => {
   return proc;
 };
 
-const captureImpl = () => {
+const captureImpl = ({ onSpawn } = {}) => {
   const calls = [];
   const impl = (cmd, args, opts) => {
     const i = args.indexOf('--mcp-config');
     const configPath = i === -1 ? null : args[i + 1];
     const config = configPath ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : null;
     const declared = config?.mcpServers?.commonly?.env || {};
     const fileVar = declared.COMMONLY_TOKEN_FILE;
-    const resolved = fileVar && opts.env?.['COMMONLY_TOKEN_FILE'];
-    calls.push({
+    const hasHeadersHelper = Object.values(config?.mcpServers || {})
+      .some((entry) => typeof entry.headersHelper === 'string');
+    const resolved = (fileVar || hasHeadersHelper) && opts.env?.['COMMONLY_TOKEN_FILE'];
+    const call = {
       cmd,
       args,
       env: opts.env,
@@ -89,7 +92,9 @@ const captureImpl = () => {
       tokenInEnv: opts.env?.['COMMONLY_AGENT_TOKEN'],
       fileText: resolved && fs.existsSync(resolved) ? fs.readFileSync(resolved, 'utf8') : null,
       fileMode: resolved && fs.existsSync(resolved) ? fs.statSync(resolved).mode & 0o777 : null,
-    });
+    };
+    calls.push(call);
+    if (onSpawn) onSpawn(call);
     return fakeChild({ stdout: 'ok', code: 0 });
   };
   return { calls, impl };
@@ -210,10 +215,10 @@ describe('claude: the seat credential arrives as a path, never as a value (TASK-
   });
 });
 
-describe('claude: the carve-out for a reference the rewrite cannot move (TASK-082/TASK-083)', () => {
-  const spawnWithImpl = async (mcp) => {
+describe('claude: HTTP token headers use the per-spawn credential file (TASK-228)', () => {
+  const spawnWithImpl = async (mcp, onSpawn) => {
     const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'kai-claude-carve-'));
-    const { calls, impl } = captureImpl();
+    const { calls, impl } = captureImpl({ onSpawn });
     let warned = [];
     const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
     try {
@@ -235,27 +240,84 @@ describe('claude: the carve-out for a reference the rewrite cannot move (TASK-08
     return { call: calls[0], warned };
   };
 
-  test('a header reference keeps the value in the environment, and the seat is told', async () => {
-    // Measured shape, and the reason this carve-out exists at all: an HTTP entry
-    // hands claude a header string to substitute. There is no file channel for a
-    // bearer header, so refusing would take the broker away from every seat that
-    // has one. The value is supplied, and the warning names the trade.
+  const runHeadersHelper = (call, serverName = 'github-grant') => {
+    const command = call.config.mcpServers[serverName].headersHelper;
+    return JSON.parse(execFileSync('/bin/sh', ['-c', command], {
+      encoding: 'utf8',
+      env: call.env,
+    }));
+  };
+
+  test('a broker header uses a helper and keeps the token out of Claude env and MCP config', async () => {
+    let headers;
     const { call, warned } = await spawnWithImpl([{
+      name: 'github-grant',
+      transport: 'http',
+      url: 'https://api.commonly.me/api/mcp/grants/grant-live',
+      headers: {
+        Authorization: 'Bearer ${COMMONLY_AGENT_TOKEN}',
+        'X-Commonly-Instance': 'prod',
+      },
+    }], (spawnCall) => { headers = runHeadersHelper(spawnCall); });
+    const entry = call.config.mcpServers['github-grant'];
+    expect(call.tokenInEnv).toBeUndefined();
+    expect(Object.keys(call.env)).not.toContain('COMMONLY_AGENT_TOKEN');
+    expect(call.env.COMMONLY_TOKEN_FILE).toBe(call.resolvedFile);
+    expect(entry.headers).toEqual({ 'X-Commonly-Instance': 'prod' });
+    expect(entry.headersHelper).toContain(path.dirname(call.configPath));
+    expect(JSON.stringify(call.config)).not.toContain('${COMMONLY_AGENT_TOKEN}');
+    expect(JSON.stringify(call.config)).not.toContain(TOKEN);
+    expect(warned.join('\n')).not.toMatch(/COMMONLY_AGENT_TOKEN/);
+    expect(headers).toEqual({ Authorization: `Bearer ${TOKEN}` });
+  });
+
+  test('a 401 retry reruns the helper and reads a rotated token during one spawn', async () => {
+    const rotated = 'cm_agent_'.padEnd(73, 'R');
+    const headers = [];
+    const statuses = [];
+    await spawnWithImpl([{
       name: 'github-grant',
       transport: 'http',
       url: 'https://api.commonly.me/api/mcp/grants/grant-live',
       headers: { Authorization: 'Bearer ${COMMONLY_AGENT_TOKEN}' },
-    }]);
-    expect(call.tokenInEnv).toBe(TOKEN);
-    expect(call.config.mcpServers['github-grant'].headers.Authorization).toBe('Bearer ${COMMONLY_AGENT_TOKEN}');
-    // The value kept is THIS spawn's credential, not whatever the launcher
-    // exported: those are different strings, so the car
```

**File**: `cli/__tests__/adapters.claude.environment.test.mjs` (modified, +5/-3)
```diff
@@ -715,7 +715,7 @@ describe('claude adapter — ctx.environment', () => {
     expect(calls[0].opts.env.COMMONLY_API_URL).toBe('https://api-dev.commonly.me');
   });
 
-  test('projected broker headers stay placeholder-based while the token is supplied to Claude', async () => {
+  test('projected broker headers use a helper while the token stays out of Claude env', async () => {
     const { impl, calls } = makeSpawnImpl();
     await claude.spawn('hi', {
       sessionId: null,
@@ -734,9 +734,11 @@ describe('claude adapter — ctx.environment', () => {
 
     const server = calls[0].config.mcpServers['github-grant'];
     expect(server.url).toBe('https://api.commonly.me/api/mcp/grants/grant-live');
-    expect(server.headers.Authorization).toBe('Bearer ${COMMONLY_AGENT_TOKEN}');
+    expect(server.headers).toBeUndefined();
+    expect(typeof server.headersHelper).toBe('string');
     expect(JSON.stringify(calls[0].config)).not.toContain('cm_agent_test');
-    expect(calls[0].opts.env.COMMONLY_AGENT_TOKEN).toBe('cm_agent_test');
+    expect(calls[0].opts.env.COMMONLY_AGENT_TOKEN).toBeUndefined();
+    expect(calls[0].opts.env.COMMONLY_TOKEN_FILE).toMatch(/\/token$/);
   });
 
   test('${COMMONLY_INSTANCE_URL} alias is supplied to native expansion', async () => {
```

**File**: `cli/package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "@commonlyai/cli",
-  "version": "0.1.83",
+  "version": "0.1.84",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "@commonlyai/cli",
-      "version": "0.1.83",
+      "version": "0.1.84",
       "license": "Apache-2.0",
       "dependencies": {
         "commander": "^12.0.0"
```

**File**: `cli/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@commonlyai/cli",
-  "version": "0.1.83",
+  "version": "0.1.84",
   "license": "Apache-2.0",
   "description": "The Commonly CLI — connect agents, manage pods, iterate fast",
   "type": "module",
```

**File**: `cli/src/lib/adapters/claude.js` (modified, +89/-12)
```diff
@@ -91,6 +91,22 @@ const DEFAULT_TIMEOUT_MS = (() => {
 })();
 
 const buildPrompt = buildMemoryPreamble;
+const RUNTIME_CREDENTIAL_PLACEHOLDER = '${COMMONLY_AGENT_TOKEN}';
+
+const QUOTE_SHELL_ARGUMENT = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;
+
+const HEADER_TOKEN_HELPER_SOURCE = `import { readFileSync } from 'node:fs';
+
+const credentialFile = process.env.${CREDENTIAL_FILE_VAR};
+if (!credentialFile) throw new Error('missing ${CREDENTIAL_FILE_VAR}');
+const token = readFileSync(credentialFile, 'utf8').trim();
+if (!token) throw new Error('empty ${CREDENTIAL_FILE_VAR}');
+const templates = JSON.parse(readFileSync(process.argv[2], 'utf8'));
+const headers = Object.fromEntries(
+  Object.entries(templates).map(([name, parts]) => [name, parts.join(token)]),
+);
+process.stdout.write(JSON.stringify(headers) + '\\n');
+`;
 
 const PUBLIC_DENIED_TOOLS = [
   'WebSearch',
@@ -290,9 +306,9 @@ const runClaude = ({ cmd, args, cwd, env, timeoutMs, credentials = [], spawnImpl
 
 // Keep Commonly placeholders in the MCP JSON and expose their values only in
 // Claude's per-spawn environment. Claude Code natively expands ${VAR} in MCP
-// command/args/env/url/headers fields. Substituting here used to materialize the raw
-// cm_agent_* bearer token in a transient JSON file, which made the token
-// readable to any co-confined child allowed to read that config directory.
+// command/args/env/url/header fields. Token-bearing HTTP headers are routed
+// through headersHelper below, because a literal expansion would put the
+// credential in Claude's environment and every MCP child's environment.
 //
 // Recognised placeholders:
 //   ${COMMONLY_TOKEN_FILE}    — the PATH of this spawn's credential file
@@ -324,20 +340,67 @@ const buildMcpExpansionEnv = (mcpConfig, ctx) => {
     // added only when the value is non-empty AND the declaration still references
     // it — and `serialized` is the config AFTER the credential rewrite, which is
     // what moves the default declaration off this value and onto the file. A
-    // reference the rewrite cannot move (args, url, headers, or a string that
-    // merely contains the placeholder) keeps the value for that spawn, because
-    // claude substitutes those literally and there is no file channel for them.
-    // That is the measured carve-out, and createMcpConfig warns when it applies
-    // so the seat still carrying the value is named rather than assumed fixed.
+    // reference that cannot use the file channel (args, url, unsupported or
+    // non-HTTP headers, or a string that merely contains the placeholder) keeps
+    // the value for that spawn. createMcpConfig warns when this carve-out applies.
     COMMONLY_AGENT_TOKEN: ctx.runtimeToken || '',
   };
   const output = {};
   for (const [key, value] of Object.entries(values)) {
-    if (value && serialized.includes(`\${${key}}`)) output[key] = value;
+    const referenced = serialized.includes(`\${${key}}`)
+      || (key === CREDENTIAL_FILE_VAR && ctx.headersHelperUsesCredentialFile === true);
+    if (value && referenced) output[key] = value;
   }
   return output;
 };
 
+const isHttpTransport = (server) => {
+  const transport = String(server?.transport || server?.type || '').trim().toLowerCase();
+  return transport === 'http' || transport === 'streamable-http';
+};
+
+const getTokenHeaderTemplates = (server) => {
+  if (!isHttpTransport(server) || !server.headers || typeof server.headers !== 'object') return null;
+  const templates = Object.fromEntries(
+    Object.entries(server.headers)
+      .filter(([, value]) => typeof value === 'string' && value.includes(RUNTIME_CREDENTIAL_PLACEHOLDER))
+      .map(([name, value]) => [name, value.split(RUNTIME_CREDENTIAL_PLACEHOLDER)]),
+  );
+  return Object.keys(templates).length > 0 ? templates : null;
+};
+
+const writePrivateFile = async (path, contents) => {
+  await writeFile(path, contents, { encoding: 'utf8', mode: 0o600 });
+  await chmod(path, 0o600);
+};
+
+// Claude's headersHelper is invoked when an HTTP connection is established and
+// again after an authentication retry. Keep the token out of its config and
+// environment: the helper reads the current per-spawn file on every invocation.
+const createTokenHeaderHelpers = async (mcpServers, dir) => {
+  const servers = mcpServers
+    .map((server, index) => ({ server, index, templates: getTokenHeaderTemplates(server) }))
+    .filter((item) => item.templates);
+  if (servers.length === 0) return new Map();
+
+  const scriptPath = join(dir, 'headers-helper.mjs');
+  await writePrivateFile(scriptPath, HEADER_TOKEN_HELPER_SOURCE);
+  const helpers = new Map();
+  for (const { server, index, templates } of servers) {
+    const templatesPath = join(dir, `headers-${index}.json`);
+    await writePrivateFile(templatesPath, JSON.stringify(templates));
+    helpers.set(server.name, {
+      command: [
+        QUOTE_SHELL_ARGUMENT(process.execPath),
+        QUOTE_SHELL_ARGUMENT(scriptPath),

```

---

### Incident Patch 9: `e9c40481` (2026-10-01)
**Commit Message**: fix(cli): stream attribution census history (#2070)

The first main-wide run exceeded execFileSync's 1 MiB buffer. Stream NUL-delimited git-log records so the census remains bounded by a commit at a time, and cover output beyond the old limit.

Written by sprint-impl, a Commonly agent.
Pod thread: https://commonly.me/v2/pods/6a692a1be833c668acdb84cf

Agent-Model: codex/gpt-6/default

Co-authored-by: Sprint Impl <[REDACTED_EMAIL]>

**File**: `cli/__tests__/agent-commit-census.test.mjs` (modified, +34/-0)
```diff
@@ -127,4 +127,38 @@ describe('agent-commit-census', () => {
       rmSync(root, { recursive: true, force: true });
     }
   });
+
+  test('streams commit history larger than the child-process buffer', () => {
+    const root = mkdtempSync(join(tmpdir(), 'commonly-agent-census-large-'));
+    const messageFile = join(root, 'message.txt');
+    const seatTrailer = 'Co-authored-by: Seat Large <WyJzZWF0LWxhcmdlIiwiZGVmYXVsdCJd@agents.commonly.invalid>';
+    try {
+      execFileSync('git', ['init', '--quiet', '-b', 'main'], { cwd: root });
+      execFileSync('git', ['config', 'user.name', 'Fixture Author'], { cwd: root });
+      execFileSync('git', ['config', 'user.email', 'fixture@example.test'], { cwd: root });
+      writeFileSync(join(root, 'file'), 'fixture\n');
+      execFileSync('git', ['add', 'file'], { cwd: root });
+      writeFileSync(messageFile, [
+        'large-history fixture',
+        '',
+        'Agent-Model: codex/model-large/high',
+        '',
+        'x'.repeat(1024 * 1024 + 64),
+        '',
+        seatTrailer,
+        '',
+      ].join('\n'));
+      execFileSync('git', ['commit', '-F', messageFile], { cwd: root });
+
+      const result = spawnSync(process.execPath, [censusScript, 'main'], {
+        cwd: root,
+        encoding: 'utf8',
+      });
+      expect(result.status).toBe(0);
+      expect(result.stdout).toContain('1\tWyJzZWF0LWxhcmdlIiwiZGVmYXVsdCJd\tSeat Large');
+      expect(result.stdout).toContain('1\t1\tcodex/model-large/high');
+    } finally {
+      rmSync(root, { recursive: true, force: true });
+    }
+  });
 });
```

**File**: `scripts/agent-commit-census` (modified, +82/-47)
```diff
@@ -1,7 +1,8 @@
 #!/usr/bin/env node
 'use strict';
 
-const { execFileSync, spawnSync } = require('node:child_process');
+const { spawn, spawnSync } = require('node:child_process');
+const { StringDecoder } = require('node:string_decoder');
 
 const refExists = (ref) => spawnSync('git', ['rev-parse', '--verify', '--quiet', ref], {
   stdio: 'ignore',
@@ -19,18 +20,6 @@ if (!refExists(ref)) {
   process.exit(1);
 }
 
-let log;
-try {
-  log = execFileSync(
-    'git',
-    ['log', '--format=%H%x00%(trailers:key=Co-authored-by)%x00%B%x00', ref],
-    { encoding: 'utf8' },
-  );
-} catch (error) {
-  process.stderr.write(`Could not read commits from ${ref}: ${error.message}\n`);
-  process.exit(1);
-}
-
 const counts = new Map();
 const models = new Map();
 const attributionWarnings = [];
@@ -43,13 +32,9 @@ const parseSeatLine = (line) => {
     seatId: match[2].slice(0, match[2].indexOf('@')),
   };
 };
-const fields = log.split('\0');
-for (let index = 0; index + 2 < fields.length; index += 3) {
-  const commitId = fields[index].trim();
-  const coAuthors = fields[index + 1];
-  const message = fields[index + 2];
-  if (!commitId) continue;
-
+const processCommit = (commitId, coAuthors, message) => {
+  const normalizedCommitId = commitId.trim();
+  if (!normalizedCommitId) return;
   const parsedSeatIds = new Set();
   const seatsInCommit = new Map();
   for (const line of coAuthors.split(/\r?\n/)) {
@@ -72,7 +57,7 @@ for (let index = 0; index + 2 < fields.length; index += 3) {
   const bodyOnlySeatIds = [...bodySeatIds].filter((seatId) => !parsedSeatIds.has(seatId));
   if (bodyOnlySeatIds.length > 0) {
     attributionWarnings.push(
-      `${commitId.slice(0, 12)}: ${bodyOnlySeatIds.length} Commonly seat line(s) did not parse as trailers; counted the exact message-body line(s).`,
+      `${normalizedCommitId.slice(0, 12)}: ${bodyOnlySeatIds.length} Commonly seat line(s) did not parse as trailers; counted the exact message-body line(s).`,
     );
   }
 
@@ -94,46 +79,96 @@ for (let index = 0; index + 2 < fields.length; index += 3) {
     const model = match[1].trim();
     const row = models.get(model) || { lines: 0, commits: new Set() };
     row.lines += 1;
-    row.commits.add(commitId);
+    row.commits.add(normalizedCommitId);
     models.set(model, row);
   }
 
   if (modelLinesInCommit > 0 && parsedSeatIds.size === 0) {
     if (seatsInCommit.size > 0) {
       attributionWarnings.push(
-        `${commitId.slice(0, 12)}: ${modelLinesInCommit} Agent-Model line(s) have no parsed seat trailer; counting ${seatsInCommit.size} seat(s) from message-body lines.`,
+        `${normalizedCommitId.slice(0, 12)}: ${modelLinesInCommit} Agent-Model line(s) have no parsed seat trailer; counting ${seatsInCommit.size} seat(s) from message-body lines.`,
       );
     } else {
       unattributedModelCommits += 1;
       attributionWarnings.push(
-        `${commitId.slice(0, 12)}: ${modelLinesInCommit} Agent-Model line(s) have no parsed seat trailer or Commonly seat line in the body; possible co-author lift failure.`,
+        `${normalizedCommitId.slice(0, 12)}: ${modelLinesInCommit} Agent-Model line(s) have no parsed seat trailer or Commonly seat line in the body; possible co-author lift failure.`,
       );
     }
   }
-}
+};
+
+const readCommits = (gitRef) => new Promise((resolve, reject) => {
+  const child = spawn(
+    'git',
+    ['log', '--format=%H%x00%(trailers:key=Co-authored-by)%x00%B%x00', gitRef],
+    { stdio: ['ignore', 'pipe', 'pipe'] },
+  );
+  const decoder = new StringDecoder('utf8');
+  let remainder = '';
+  let fields = [];
+  let stderr = '';
+
+  const acceptField = (field) => {
+    fields.push(field);
+    if (fields.length === 3) {
+      processCommit(fields[0], fields[1], fields[2]);
+      fields = [];
+    }
+  };
 
-if (counts.size === 0) {
-  process.stdout.write(`No Commonly seat attribution found on ${ref}.\n`);
-} else {
-  process.stdout.write(`Commonly seat-attributed commits on ${ref}\n`);
-  process.stdout.write('COMMITS\tSEAT ID\tDISPLAY NAME(S)\n');
-  for (const [seatId, row] of [...counts.entries()].sort((left, right) => (
-    right[1].commits - left[1].commits || left[0].localeCompare(right[0])
-  ))) {
-    process.stdout.write(`${row.commits}\t${seatId}\t${[...row.displayNames].sort().join(', ')}\n`);
+  const acceptText = (text) => {
+    remainder += text;
+    let boundary = remainder.indexOf('\0');
+    while (boundary !== -1) {
+      acceptField(remainder.slice(0, boundary));
+      remainder = remainder.slice(boundary + 1);
+      boundary = remainder.indexOf('\0');
+    }
+  };
+
+  child.stdout.on('data', (chunk) => acceptText(decoder.write(chunk)));
+  child.stdout.on('end', () => acceptText(decoder.end()));
+  child.stderr.on('data', (chunk) => { stderr += chunk.toString('utf8'); });
+  child.on('error', reject);
+  child.on('close', (code) => {
+    if (remainder.trim()) acceptField(remainder);
+    if (code !== 0) {
+      reject(new Error(stderr.trim
```

---

### Incident Patch 10: `207c68d5` (2026-10-01)
**Commit Message**: Fix hosted MCP catalogue projection and grant labels (#2068)

* Fix hosted MCP catalogue projection

* Keep hosted catalogue projection import-light

**File**: `backend/__tests__/unit/services/installableCatalogService.test.js` (modified, +12/-4)
```diff
@@ -5,8 +5,6 @@ jest.mock('../../../services/toolBrokerService', () => ({
   getToolDefinitions: () => [
     { name: 'github.list_issues', description: 'List issues', requiredWriteMode: 'read', connectionType: 'github-app' },
     { name: 'github.create_issue', description: 'Create an issue', requiredWriteMode: 'write-with-confirm', connectionType: 'github-app', irreversible: true },
-    { name: 'linear.list_issues', description: 'List issues', requiredWriteMode: 'read', connectionType: 'hosted-mcp', entryId: 'linear' },
-    { name: 'acme.list_tickets', description: 'List tickets', requiredWriteMode: 'read', connectionType: 'hosted-mcp', entryId: 'acme' },
   ],
 }));
 jest.mock('../../../services/roomGrantService', () => ({
@@ -24,6 +22,7 @@ const InstallableInstallation = require('../../../models/InstallableInstallation
 const Integration = require('../../../models/Integration');
 const { catalogFor } = require('../../../services/installable/installableCatalogService');
 const { HOSTED_MCP_ENTRIES } = require('../../../integrations/hostedMcp/entries');
+const { buildHostedMcpToolInstallable } = require('../../../services/installable/toolInstallables');
 
 const userId = '64b64c48c4f37a6b2f34c111';
 const installationId = '64b64c48c4f37a6b2f34c222';
@@ -255,9 +254,11 @@ it("a hosted entry's tool row carries its connect descriptor and only its own co
   const shipped = [...HOSTED_MCP_ENTRIES];
   HOSTED_MCP_ENTRIES.push(acme);
   try {
+    const linearEntry = HOSTED_MCP_ENTRIES.find((entry) => entry.id === 'linear');
+    expect(linearEntry).toBeDefined();
     mockInstallables([], [
-      { ...githubTool(), installableId: 'linear', name: 'Linear', description: 'Issues, projects and cycles.', components: [{ name: 'commonly-grant-broker', type: 'mcp-server', enabledTools: ['linear.list_issues'] }] },
-      { ...githubTool(), installableId: 'acme', name: 'Acme', description: 'Tickets.', components: [{ name: 'commonly-grant-broker', type: 'mcp-server', enabledTools: ['acme.list_tickets'] }] },
+      buildHostedMcpToolInstallable(linearEntry),
+      buildHostedMcpToolInstallable(acme),
     ]);
     InstallableInstallation.find.mockReturnValue(lean([]));
     Integration.find.mockReturnValue(lean([
@@ -287,6 +288,13 @@ it("a hosted entry's tool row carries its connect descriptor and only its own co
     expect(acmeRow.connections).toEqual([
       { connectionId: 'conn-acme', owner: '', repo: '' },
     ]);
+    expect(linear.tools).toEqual(linearEntry.tools.map((tool) => expect.objectContaining({
+      name: `linear.${tool.name}`,
+      description: tool.description,
+      requiredWriteMode: 'read',
+      irreversible: Boolean(tool.irreversible),
+    })));
+    expect(acmeRow.tools).toEqual([{ name: 'acme.list_tickets', description: 'List tickets', requiredWriteMode: 'read', irreversible: false }]);
     expect(Integration.find).toHaveBeenCalledWith(expect.objectContaining({
       type: { $in: ['hosted-mcp'] }, createdBy: userId, status: 'connected', revokedAt: null,
     }));
```

**File**: `backend/services/hostedMcpToolDefinitions.ts` (modified, +4/-1)
```diff
@@ -20,7 +20,6 @@
  * this module receives carries the row's ID rather than a token.
  */
 import { randomUUID } from 'crypto';
-import Integration from '../models/Integration';
 import { HOSTED_MCP_ENTRIES, findHostedMcpEntry } from '../integrations/hostedMcp/entries';
 import { RoomGrantError } from './roomGrantService';
 import {
@@ -59,6 +58,10 @@ const defaultDeps = (): HostedMcpToolDeps => ({
     // A grant's connection id is an ObjectId string by construction, but an
     // untrusted value must not reach a BSON `_id` selector as a CastError.
     if (!/^[a-f\d]{24}$/i.test(connectionId)) return null;
+    // This module also provides the pure catalogue projection. Keep mongoose
+    // (and the Integration model) out of import-time consumers such as the
+    // frontend glyph-catalogue test; only an actual hosted tool call needs it.
+    const { default: Integration } = await import('../models/Integration');
     const row = await Integration.findById(connectionId).lean();
     return (row as unknown as HostedMcpRow | null) || null;
   },
```

**File**: `backend/services/installable/installableCatalogService.ts` (modified, +6/-1)
```diff
@@ -10,6 +10,8 @@ const { toPublicIntegration, withoutConnectCode } = require('../../models/integr
 const { manifests } = require('../../integrations/manifests');
 // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
 const { mcpComponentOf, projectTools, toolInstallableMetas } = require('./toolInstallables');
+// eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
+const { HOSTED_MCP_ENTRIES, findHostedMcpEntry } = require('../../integrations/hostedMcp/entries');
 
 type ProviderReadiness = { available: boolean; reason?: 'not_configured' };
 
@@ -139,6 +141,9 @@ const toolEntriesFor = async (userId: string): Promise<unknown[]> => {
   return rows.map((row) => {
     const meta = metas[row.installableId];
     const component = mcpComponentOf(row);
+    const hostedEntry = meta.connectionType === 'hosted-mcp'
+      ? findHostedMcpEntry(HOSTED_MCP_ENTRIES, meta.entryId || '') || null
+      : undefined;
     const readiness = meta.readiness();
     return {
       installableId: row.installableId,
@@ -150,7 +155,7 @@ const toolEntriesFor = async (userId: string): Promise<unknown[]> => {
       available: readiness.available,
       ...(readiness.available ? {} : { unavailableReason: readiness.reason }),
       broker: { id: String(component?.name || '') },
-      tools: projectTools(component),
+      tools: projectTools(component, hostedEntry),
       connections: connections
         // Two vendors' rows share one connection type, so an entry-scoped meta
         // matches its own rows only: without the entryId half, a person
```

**File**: `backend/services/installable/toolInstallables.ts` (modified, +18/-4)
```diff
@@ -16,7 +16,11 @@ import {
   assertHostedMcpEntries,
   findHostedMcpEntry,
 } from '../../integrations/hostedMcp/entries';
-import { hostedMcpToolName, type HostedMcpEntry } from '../hostedMcpEntryService';
+import {
+  hostedMcpToolName,
+  type HostedMcpEntry,
+} from '../hostedMcpEntryService';
+import { hostedToolDefinitions } from '../hostedMcpToolDefinitions';
 import { isHostedMcpClientConfigured } from '../hostedMcpIntakeService';
 
 // Resolved on first use, not at import: the broker module loads
@@ -191,10 +195,20 @@ export const mcpComponentOf = (installable: { components?: McpComponentLike[] }
 );
 
 /** The tools a component exposes, in the shape the page draws. Absent `enabledTools` means all; empty means none. */
-export const projectTools = (component: McpComponentLike | null): ProjectedTool[] => {
-  if (!component) return [];
+export const projectTools = (
+  component: McpComponentLike | null,
+  hostedEntry?: HostedMcpEntry | null,
+): ProjectedTool[] => {
+  // `null` is a defensive fail-closed input. Catalogue rows are filtered
+  // against HOSTED_MCP_ENTRIES before reaching this projector, so a removed
+  // entry cannot currently reach this branch through the production path.
+  if (!component || hostedEntry === null) return [];
   const enabled = Array.isArray(component.enabledTools) ? new Set(component.enabledTools) : null;
-  return toolDefinitions()
+  // Include only this entry's namespaced broker definitions. A GitHub
+  // component still reads the GitHub-only map above, and its own enabledTools
+  // remains the final allow-list for either source.
+  const definitions = hostedEntry ? hostedToolDefinitions([hostedEntry]) : toolDefinitions();
+  return definitions
     .filter((definition) => !enabled || enabled.has(definition.name))
     .map((definition) => ({
       name: definition.name,
```

**File**: `frontend/src/i18n/locales/en.json` (modified, +2/-0)
```diff
@@ -2074,6 +2074,8 @@
     "notEnabled": "not enabled on this instance · ask your operator",
     "notGranted": "not granted",
     "nothingMatches": "Nothing matches.",
+    "unknownConnector": "Unknown connector",
+    "unknownWritePolicy": "write policy unavailable",
     "outcomeFailed": "failed",
     "outcomeOk": "ok",
     "outcomeRefused": "refused",
```

**File**: `frontend/src/i18n/locales/zh-CN.json` (modified, +2/-0)
```diff
@@ -2066,6 +2066,8 @@
     "notEnabled": "此实例尚未启用 · 联系实例管理员",
     "notGranted": "未授权",
     "nothingMatches": "没有匹配项。",
+    "unknownConnector": "未知连接器",
+    "unknownWritePolicy": "写入策略不可用",
     "outcomeFailed": "失败",
     "outcomeOk": "成功",
     "outcomeRefused": "已拒绝",
```

**File**: `frontend/src/v2/__tests__/V2ConnectorTools.test.tsx` (modified, +37/-5)
```diff
@@ -62,11 +62,12 @@ const githubEntry = {
 
 const linearEntry = {
   installableId: 'linear', list: 'tools', label: 'Linear', description: 'Issues in Linear.', available: true,
+  connectionType: 'hosted-mcp', entryId: 'linear',
   broker: { id: 'commonly-grant-broker' },
-  tools: [{ name: 'linear.create_issue', requiredWriteMode: 'write', irreversible: true }],
+  tools: [{ name: 'linear.list_issues', requiredWriteMode: 'read', irreversible: false }],
   connections: [{ connectionId: 'conn-2', owner: 'Team-Commonly', repo: 'linear' }],
 };
-const grantLinear = { ...grantLive, grantId: 'grant_lin', installationId: 'inst-2', tools: ['linear.create_issue'] };
+const grantLinear = { ...grantLive, grantId: 'grant_lin', installationId: 'inst-2', writeMode: 'read', tools: ['linear.list_issues'] };
 
 // Two tools entries and one grant: the shape the page has to survive once a
 // second tool Installable ships. The old single-entry accounting hid the entry
@@ -103,7 +104,7 @@ const renderTools = (props = {}) => render(
   </AuthContext.Provider>,
 );
 
-beforeEach(() => { jest.clearAllMocks(); mockApi(); });
+beforeEach(() => { jest.clearAllMocks(); mockApi([githubEntry]); });
 
 test('TASK-131: a grant age advances in place, and a returning tab re-reads, without a reload', async () => {
   jest.useFakeTimers();
@@ -169,10 +170,11 @@ test('rows carry the states table: a live grant pulses when used in the last 10
   expect(within(gone).getByText('revoked by sam 10m ago')).toBeInTheDocument();
   expect(gone.closest('.v2-connector-row')).toHaveClass('v2-connector-row--dead');
   expect(gone.querySelector('.v2-connector-row__dot')).toHaveClass('v2-connector-row__dot--empty');
-  // No not-yet row and no Add without a catalogue: nothing the server does not enforce.
+  // Every catalogue entry is granted, so there is no not-yet row or Add action.
   expect(screen.queryByText('not granted')).not.toBeInTheDocument();
   expect(screen.queryByRole('button', { name: 'Add' })).not.toBeInTheDocument();
-  expect(screen.getAllByRole('button', { name: 'Manage' })).toHaveLength(2);
+  expect(screen.getAllByRole('button', { name: 'Manage' })).toHaveLength(1);
+  expect(screen.getByRole('button', { name: 'Grant again' })).toBeInTheDocument();
   // Direction A: Manage is the gear (word in title + aria-label), and the age rides the kicker.
   for (const manage of screen.getAllByRole('button', { name: 'Manage' })) {
     expect(manage).toHaveClass('v2-connector-row__action--icon');
@@ -595,6 +597,36 @@ test('TASK-133: with every entry granted the header carries no "more"', async ()
   expect(container.querySelectorAll('.v2-connector-row--not-yet')).toHaveLength(0);
 });
 
+test('a hosted grant whose entry is missing stays unknown and never falls back to GitHub', async () => {
+  const orphanedLinearGrant = { ...grantLinear, grantId: 'grant_orphan', writeMode: 'write', tools: ['linear.list_issues'] };
+  mockTwoEntries({ catalog: [githubEntry], grants: { p1: [orphanedLinearGrant], p2: [] } });
+  renderTools();
+
+  const row = await screen.findByRole('button', { name: 'View Unknown connector in Launch pod' });
+  expect(row).toBeInTheDocument();
+  expect(row).not.toHaveTextContent('GitHub');
+  expect(row).toHaveTextContent('write policy unavailable');
+  expect(row.querySelector('.v2-connector-row__glyph svg')).toBeNull();
+});
+
+test('Linear exposes only its pinned read mode in the not-yet row and Add form', async () => {
+  mockTwoEntries({ grants: { p1: [grantLive], p2: [] } });
+  const { container } = renderTools();
+  await screen.findByText('1 granted · 1 more');
+
+  const linearRow = Array.from(container.querySelectorAll('.v2-connector-row--not-yet'))
+    .find((candidate) => candidate.textContent.includes('Linear'));
+  expect(linearRow).toBeTruthy();
+  expect(linearRow).toHaveTextContent('read');
+  expect(linearRow).not.toHaveTextContent('read, or read and write');
+
+  fireEvent.click(within(linearRow).getByRole('button', { name: 'Add' }));
+  const form = await screen.findByRole('complementary', { name: 'Add Linear' });
+  const modeGroup = within(form).getByRole('group', { name: 'what it may do' });
+  expect(within(modeGroup).getAllByRole('button')).toHaveLength(1);
+  expect(within(modeGroup).getByRole('button', { name: 'read' })).toHaveAttribute('aria-pressed', 'true');
+});
+
 test('search filters by tool name and the segment hides not-yet rows; with no grants and no catalogue it renders nothing', async () => {
   renderTools();
   await screen.findByRole('heading', { name: 'Tools' });
```

**File**: `frontend/src/v2/components/V2ConnectorTools.tsx` (modified, +31/-13)
```diff
@@ -264,15 +264,14 @@ const V2ConnectorTools: React.FC<Props> = ({ pods }) => {
     return () => { cancelled = true; };
   }, [api, selectedId]);
 
-  // Grants on main are GitHub App connections; the catalogue entry carries the label and what it does.
-  // The entry a grant belongs to, by the tools it names. The github fallback is
-  // for a grant whose tools the catalogue no longer describes: a label beats none.
-  const entryFor = (grant?: ToolGrant | null): ToolCatalogEntry | null => (
-    (grant ? catalog.find((entry) => entryCovers(entry, grant)) : null)
-    || catalog.find((entry) => entry.installableId === 'github')
-    || null
+  // The entry a grant belongs to is the one whose namespaced tools it carries.
+  // If the catalogue no longer has that entry, keep the row visibly unknown;
+  // assigning it to GitHub would misstate who owns the grant and its policy.
+  const entryFor = (grant: ToolGrant): ToolCatalogEntry | null => (
+    catalog.find((entry) => entryCovers(entry, grant)) || null
   );
-  const toolLabel = (grant?: ToolGrant | null): string => entryFor(grant)?.label || 'GitHub';
+  const toolLabel = (grant: ToolGrant): string => entryFor(grant)?.label
+    || t('tools.unknownConnector', { defaultValue: 'Unknown connector' });
 
   const podName = (podId: string): string => pods.find((pod) => String(pod._id) === podId)?.name || t('tools.aPod', { defaultValue: 'a pod' });
   const memberName = (userId: string | null): string | null => {
@@ -314,7 +313,9 @@ const V2ConnectorTools: React.FC<Props> = ({ pods }) => {
     if (grant.writeMode === 'read') return t('tools.asksNothing', { defaultValue: 'nothing asks first' });
     if (grant.writeMode === 'write-with-confirm') return t('tools.asksEveryWrite', { defaultValue: 'every write asks first' });
     // Under `write` the floor is the tool's own irreversible flag (piece 2b): the list is the catalogue's.
-    const list = irreversibleTools(entryFor(grant), grant.tools);
+    const entry = entryFor(grant);
+    if (!entry) return t('tools.unknownWritePolicy', { defaultValue: 'write policy unavailable' });
+    const list = irreversibleTools(entry, grant.tools);
     return list.length
       ? t('tools.asksList', { defaultValue: '{{tools}} ask first', tools: joinList(list) })
       : t('tools.asksNothing', { defaultValue: 'nothing asks first' });
@@ -332,6 +333,20 @@ const V2ConnectorTools: React.FC<Props> = ({ pods }) => {
     write: t('tools.modeWrite', { defaultValue: 'read and write' }),
   })[mode];
 
+  const entryGrantModes = (entry: ToolCatalogEntry): GrantWriteMode[] => {
+    if (entry.connectionType !== 'hosted-mcp') return WRITE_MODES;
+    return entry.tools.some((tool) => tool.requiredWriteMode !== 'read')
+      ? ['read', 'write-with-confirm']
+      : ['read'];
+  };
+
+  const entryModeCopy = (entry: ToolCatalogEntry): string => {
+    const modes = entryGrantModes(entry);
+    return modes.length === 1
+      ? modeLabel(modes[0])
+      : t('tools.readOrWrite', { defaultValue: 'read, or read and write' });
+  };
+
   const usedRecently = (grant: ToolGrant): boolean => {
     const at = lastUse[grant.grantId];
     return Boolean(at) && Date.now() - new Date(at as string).getTime() < USED_RECENTLY_MS;
@@ -363,11 +378,12 @@ const V2ConnectorTools: React.FC<Props> = ({ pods }) => {
 
   const openDraft = (entry: ToolCatalogEntry, from?: ToolGrant) => {
     const podId = from ? (grantPodId(from) || podIds[0] || '') : (podIds[0] || '');
+    const modes = entryGrantModes(entry);
     setDraft({
       installableId: entry.installableId,
       podId,
       connectionId: entry.connections[0]?.connectionId || '',
-      writeMode: from?.writeMode || 'read',
+      writeMode: from && modes.includes(from.writeMode) ? from.writeMode : modes[0] || 'read',
       audience: from ? from.effectiveAudience : (seats[podId] || []).map((seat) => seat.userId).filter((id): id is string => Boolean(id)),
       expiryDays: 7,
       replaces: from && !isDead(from) ? from.grantId : null,
@@ -574,7 +590,9 @@ const V2ConnectorTools: React.FC<Props> = ({ pods }) => {
         >
           <span className="v2-connector-row__name">
             <span className={`v2-connector-row__dot ${dead ? 'v2-connector-row__dot--empty' : `v2-connector-row__dot--live${usedRecently(grant) ? ' v2-connector-row__dot--pulse' : ''}`}`} aria-hidden="true" />
-            <span className="v2-connector-row__glyph" aria-hidden="true"><PlatformGlyph type={entry?.installableId || 'github'} /></span>
+            <span className="v2-connector-row__glyph" aria-hidden="true">
+              {entry && <PlatformGlyph type={entry.installableId} />}
+            </span>
             <span>{label}</span>
           </span>
           <span className="v2-connector-row__details">
@@ -644,7 +662,7 @@ const V2ConnectorTools: React.FC<Props> = ({ pods }) => {
                 ? (isHosted
                   ? t('tools.connectOwn', { defaultValue: 'connect your own {{label}} acco
```

---

### Incident Patch 11: `0933f776` (2026-10-01)
**Commit Message**: fix(cli): forward attribution to public Codex shell (#2061)

Codex core inheritance drops explicit attribution variables before its include_only filter. Attribution-active public spawns now inherit all under an exact allowlist, keep default secret filters enabled, and restore only the exact GIT_CONFIG_KEY_n names with shell_environment_policy.set. Caller config values stay in the filtered environment. The exact key names ride argv; their values do not.

Codex 0.159.3/macOS sandbox measurement: the shipped policy commits successfully with no trailers; this policy commits with both trailers, preserves the caller author, and omits planted token, provider-key, secret, and unlisted variables.

Reproduced the review finding independently: prepareCommitAttribution() given caller GIT_CONFIG_COUNT=2 with user.name and http.extraheader returns a public sandboxEnv sealed to count=1 and only KEY_0=core.hooksPath; the credential-bearing caller value is absent. Corrected the public Codex adapter fixture to model that production shape instead of the unsandboxed attribution env. Adapter suite passed 31/31 after the correction.

Written by sprint-impl, a Commonly agent.

Pod thread: https://commonl

**File**: `cli/__tests__/adapters.codex.test.mjs` (modified, +42/-5)
```diff
@@ -397,6 +397,9 @@ describe('codex adapter — spawn()', () => {
     await mkdir(originalHooksPath, { recursive: true });
     const originalHookPath = join(originalHooksPath, 'pre-commit');
     await writeFile(originalHookPath, '#!/bin/sh\nexit 0\n', { mode: 0o700 });
+    // Public Codex receives prepareCommitAttribution().sandboxEnv from
+    // commands/agent.js: the sealed Git config contains only the hook path.
+    // Caller config values are intentionally absent at this boundary.
     const commitAttributionEnv = {
       GIT_CONFIG_COUNT: '1',
       GIT_CONFIG_KEY_0: 'core.hooksPath',
@@ -418,7 +421,14 @@ describe('codex adapter — spawn()', () => {
       environment: {
         sandbox: { mode: 'workspace', trust: 'public' },
       },
-      env: { ...process.env, CODEX_HOME: operatorHome },
+      env: {
+        ...process.env,
+        CODEX_HOME: operatorHome,
+        COMMONLY_AGENT_TOKEN: 'dummy-seat-token',
+        COMMONLY_TOKEN_FILE: '/private/tmp/dummy-token-file',
+        OPENAI_API_KEY: 'dummy-provider-key',
+        SOME_SECRET: 'dummy-secret',
+      },
       commitAttributionEnv,
       agentName: 'public-test-agent',
       _publicCodexHome: publicHome,
@@ -464,13 +474,40 @@ describe('codex adapter — spawn()', () => {
       expect(filesystem).toContain(`"${secretPath}"="deny"`);
     }
     expect(cFlags).toContain('permissions.commonly_public.network.enabled=false');
+    expect(cFlags).toContain('shell_environment_policy.inherit="all"');
+    expect(cFlags).toContain('shell_environment_policy.ignore_default_excludes=false');
     const shellEnvironment = cFlags.find((flag) => (
       flag.startsWith('shell_environment_policy.include_only=')
     ));
-    expect(shellEnvironment).toContain('"GIT_CONFIG_COUNT"');
-    expect(shellEnvironment).toContain('"GIT_CONFIG_KEY_0"');
-    expect(shellEnvironment).toContain('"COMMONLY_AGENT_SEAT_NAME"');
-    expect(shellEnvironment).toContain('"COMMONLY_AGENT_ORIGINAL_HOOKS_PATH"');
+    const allowedShellEnvironment = JSON.parse(shellEnvironment.slice(
+      'shell_environment_policy.include_only='.length,
+    ));
+    expect(allowedShellEnvironment).toEqual(expect.arrayContaining([
+      'GIT_CONFIG_COUNT',
+      'GIT_CONFIG_KEY_0',
+      'GIT_CONFIG_VALUE_0',
+      'COMMONLY_AGENT_SEAT_NAME',
+      'COMMONLY_AGENT_ORIGINAL_HOOKS_PATH',
+    ]));
+    expect(allowedShellEnvironment).not.toEqual(expect.arrayContaining([
+      'GIT_CONFIG_KEY_1',
+      'GIT_CONFIG_VALUE_1',
+    ]));
+    expect(allowedShellEnvironment).not.toEqual(expect.arrayContaining([
+      'COMMONLY_AGENT_TOKEN',
+      'COMMONLY_TOKEN_FILE',
+      'OPENAI_API_KEY',
+      'SOME_SECRET',
+    ]));
+    const shellEnvironmentSet = cFlags.find((flag) => (
+      flag.startsWith('shell_environment_policy.set=')
+    ));
+    expect(shellEnvironmentSet).toContain('"GIT_CONFIG_KEY_0"="core.hooksPath"');
+    expect(shellEnvironmentSet).not.toContain('user.name');
+    expect(shellEnvironmentSet).not.toContain('GIT_CONFIG_VALUE_0');
+    expect(shellEnvironmentSet).not.toContain('COMMONLY_AGENT_TOKEN');
+    expect(calls[0].opts.env.GIT_CONFIG_COUNT).toBe('1');
+    expect(calls[0].opts.env.GIT_CONFIG_KEY_0).toBe('core.hooksPath');
     expect(calls[0].opts.env.GIT_CONFIG_VALUE_0).toBe(hookPath);
   });
 
```

**File**: `cli/package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "@commonlyai/cli",
-  "version": "0.1.82",
+  "version": "0.1.83",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "@commonlyai/cli",
-      "version": "0.1.82",
+      "version": "0.1.83",
       "license": "Apache-2.0",
       "dependencies": {
         "commander": "^12.0.0"
```

**File**: `cli/package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "@commonlyai/cli",
-  "version": "0.1.82",
+  "version": "0.1.83",
   "license": "Apache-2.0",
   "description": "The Commonly CLI — connect agents, manage pods, iterate fast",
   "type": "module",
```

**File**: `cli/src/lib/adapters/codex.js` (modified, +24/-10)
```diff
@@ -300,15 +300,16 @@ const preparePublicCodexHome = async (ctx) => {
 
 const publicPermissionProfileFlags = (
   mode,
-  commitHooksPath = null,
-  originalHooksPath = null,
+  commitAttributionEnv = null,
 ) => {
   if (!PUBLIC_SANDBOX_MODES.has(mode)) {
     throw new Error(
       `public codex agents require sandbox.mode=workspace or read-only, got ${mode || 'unset'}`,
     );
   }
   const workspaceAccess = mode === 'read-only' ? 'read' : 'write';
+  const commitHooksPath = commitAttributionEnv?.COMMONLY_AGENT_HOOKS_PATH || null;
+  const originalHooksPath = commitAttributionEnv?.COMMONLY_AGENT_ORIGINAL_HOOKS_PATH || null;
   const originalHookPaths = originalHooksPath
     ? supportedGitHooks()
       .map((hookName) => join(originalHooksPath, hookName))
@@ -321,6 +322,14 @@ const publicPermissionProfileFlags = (
         }
       })
     : [];
+  // Preserve caller-supplied git config entries alongside the appended
+  // hooksPath entry. The explicit allowlist below admits only these concrete
+  // variable names, not arbitrary environment variables.
+  const gitConfigEnv = Object.keys(commitAttributionEnv || {})
+    .filter((name) => /^GIT_CONFIG_(?:COUNT|KEY_\d+|VALUE_\d+)$/.test(name));
+  const gitConfigKeySet = Object.entries(commitAttributionEnv || {})
+    .filter(([name]) => /^GIT_CONFIG_KEY_\d+$/.test(name))
+    .map(([name, value]) => `${toml(name)}=${toml(value)}`);
   const filesystem = [
     '":minimal"="read"',
     '"~/.commonly"="deny"',
@@ -337,9 +346,7 @@ const publicPermissionProfileFlags = (
   const shellEnvironment = [
     'PATH', 'HOME', 'TMPDIR', 'LANG', 'LC_*',
     ...(commitHooksPath ? [
-      'GIT_CONFIG_COUNT',
-      'GIT_CONFIG_KEY_0',
-      'GIT_CONFIG_VALUE_0',
+      ...gitConfigEnv,
       'COMMONLY_AGENT_GIT_CONFIG_INDEX',
       'COMMONLY_AGENT_GIT_CONFIG_BASE_COUNT',
       'COMMONLY_AGENT_HOOKS_PATH',
@@ -356,11 +363,19 @@ const publicPermissionProfileFlags = (
     '-c', `permissions.${PUBLIC_PERMISSION_PROFILE}.filesystem={${filesystem}}`,
     '-c', `permissions.${PUBLIC_PERMISSION_PROFILE}.network.enabled=false`,
     // The MCP launcher receives explicitly forwarded env_vars separately.
-    // Model-generated shell commands inherit a small non-secret core plus
-    // Commonly's per-spawn Git hook metadata when attribution is active.
-    '-c', 'shell_environment_policy.inherit="core"',
+    // `core` drops explicit GIT_CONFIG_* and hook metadata before include_only
+    // can admit them. When attribution is active, inherit all then constrain
+    // model shells to the exact allowlist below; keep Codex's default secret
+    // filters enabled.
+    '-c', `shell_environment_policy.inherit="${commitHooksPath ? 'all' : 'core'}"`,
     '-c', 'shell_environment_policy.ignore_default_excludes=false',
     '-c', `shell_environment_policy.include_only=${JSON.stringify(shellEnvironment)}`,
+    // Codex's default name filter treats GIT_CONFIG_KEY_n as sensitive. Set
+    // only those key names after filtering; their corresponding values stay
+    // in the allowlisted environment instead of riding argv.
+    ...(gitConfigKeySet.length
+      ? ['-c', `shell_environment_policy.set={${gitConfigKeySet.join(',')}}`]
+      : []),
   ];
 };
 
@@ -397,8 +412,7 @@ const buildArgs = ({
       '--ignore-rules',
       ...publicPermissionProfileFlags(
         publicSandboxMode,
-        commitAttributionEnv?.COMMONLY_AGENT_HOOKS_PATH || null,
-        commitAttributionEnv?.COMMONLY_AGENT_ORIGINAL_HOOKS_PATH || null,
+        commitAttributionEnv,
       ),
     ]
     : ['--dangerously-bypass-approvals-and-sandbox'];
```

---

### Incident Patch 12: `91cc32af` (2026-09-30)
**Commit Message**: docs(review): rule 50 — a fixture supplying only the input where two things are equal (TASK-181) (#2055)

* docs(review): rule 50 — a fixture supplying only the input where two things are equal (TASK-181)

Written by sprint-review, a Commonly agent.
Pod thread: https://commonly.me/v2/pods/6a692a1be833c668acdb84cf (message 75951)

Filed by sprint-impl from my own generalisation in #1982's artifact loop,
with the rider-or-rule call left to me. It earns its own number: rule 41's
test asks whether every check the adjacent rule sends you to run passes
here, and for rule 17 all of them do — the fixture calls the real function
with a real catalog, so the shape is genuine and only the discriminating
value is missing.

Demonstrated rather than argued, two arms on `localizeWindow`:
  A. clamp removed, test as it stands  -> 1 failed / 3 total (line 31)
  B. same mutant, only `minutes(1)` cut -> 3 passed / 3 total, GREEN
30s is 0.5min and Math.round(0.5) === 1, so the fixture's only sub-minute
input cannot see the deletion. Totals hold at 3, so neither is a rule-46
collapse. BASE 3/3, RESTORED 3/3.

Two citations in the filed row were wrong and are corrected here: the clamp
landed in #1981 (79

**File**: `docs/development/review-checklist.md` (modified, +12/-0)
```diff
@@ -193,3 +193,15 @@ And then note where the fix landed. Someone hit the audience gap, felt it, and b
 ## The tree behind a head
 
 49. **A green run measures the tree it ran on, not the commit you cite — every instrument in the loop reads the working tree, so a head can carry a message describing a fix whose bytes are not under it while each check passes.** `git status` is not a step in the loop: jest, `tsc`, `grep` and your own mutation script all read files from disk, and none of them reads a commit. So the green is a fact about a tree, the citation is a fact about a commit, and nothing in the run ties the two together. Three ways they separate, and the middle one is this rule's incident: edits left unstaged while the suite runs green over them; `git commit --amend -F <message>` run with those edits STILL unstaged, which rewrites the MESSAGE and keeps the old tree (without `-a` or `--only` the index is untouched); and a worktree whose HEAD is not the sha you push. The check is the one a consumer runs rather than the one the author ran — **at the moment of the run, `git status --porcelain` is empty and `git rev-parse HEAD` is the sha you will cite** — and after the fact, `git show <head>:<file> | grep '<the change>'`, which is how this rule's incident was refuted from outside the author's own instruments. Where both trees exist as objects the identity assertion is one line and stronger: `git rev-parse <head>^{tree}` compared against the tree you measured. Identical trees mean the artifact really is the one you tested, which is also why a message-only amend is a legitimate no-re-gate move — rule 32's carry by identity, and a different question from the merge-fidelity claim it says tree equality cannot answer once the base has moved. Neighbours: 44 asks whether a clearance EXISTS at the pressed head and cannot see that an author's green was taken somewhere else; 32 compares what landed against what was gated; 39 and 46 read what a run's aggregate says. Its own entry rather than a rider on 39 or 46, by rule 41's test: every check those send you to run passes here — the invocation is named, the count is read, the total matches its base — and the defect survives all of them, because they ask what the run said and this asks what the run enumerated. *(Earned: 2026-09-30, TASK-193/#2019, row B of the five. Two gate findings were edited in the worktree and the FULL frontend suite run over them — 119 suites / 1073 tests green — and then `git commit --amend -F <message>` was run with those edits unstaged, so the pushed head `8a692533` kept the PRE-FIX tree under a message describing both fixes, and "both findings fixed at 8a692533" was published on the PR, in the pod, and on the row. sprint-review refuted it from the ref — `gh pr view`, `git ls-remote refs/pull/2019/head`, and the PR-scoped diff — while every instrument on this side had read the working tree and agreed with the claim, which is the whole reason the class needs its own rule: nothing on the author's side can see it. The remedy is mechanical — stage before amending (`git add -A`, or `git commit --amend --only <file>`), and cite a head only after reading that head. The mirror case was measured the same day on #2049, where the same verb over a CLEAN index left tree `537f3d8394ed0434173ad647cfea54e00ada04b9` identical across a head move: the verb was never the defect, the unstaged index was.)*
+
+## The input that makes them differ
+
+50. **A fixture that supplies only the input where two things are EQUAL greens every mutation that erases the difference between them — so a mutation report on that hunk is vacuous, not clean.** Rule 17 says a mutation only reports which terms the chosen input shape *reaches*; this is the failure one level in, where the shape is reached in every exercised case and only the *distinguishing* case is missing. The mutant and the original agree on the fixture's value, so the arm is green, the line looks unpinned-but-harmless, and nothing in the run says which input was never tried. **The review move is to name the input that makes the two sides differ, before running anything: for a clamp, the value on the far side of the clamp; for a comparison, one where the sides are unequal; for an extraction, a case where the extracted string and its source diverge.** If the suite has no such input, say so — *no distinguishing input, result vacuous* — rather than reporting the hunk as covered or as dead code. And the corollary that costs the most: **when both sides of a comparison can be ABSENT, `null == null` and `None == None` read as agreement**, so assert that each side resolved to a real value before comparing them at all.
+
+    Measured on the incident, at `faf43bb20`, and the demonstration is two arms rather than one. `localizeWindow` (`frontend/src/v2/utils/localizeRelativeTime.ts:101`) clamps with `Math.max(1, Math.round(windowMs / 60_000))`. Arm A, clamp removed with the pinning test as it stands: **1 failed / 3 total**, failing at
```

---

### Incident Patch 13: `c58d8b55` (2026-09-30)
**Commit Message**: fix(v2): clip-path joins the visually-hidden REQUIRED set (TASK-220) (#2052)

The census discovers copies by the defect's precondition — an absolutely
positioned 1px box that clips its own content — and then asserts REQUIRED
against every copy it finds. `clip-path` was deliberately held out of
REQUIRED while three rows were mid-flight and the family was non-uniform
(#2024, #2042, #2046). All three have landed, so the hold-out is what is
now costing coverage: the declaration that actually clips in current
engines was unpinned on every copy that already carried it.

Two edits:

- `.v2-board__focus-live` (v2/v2.css) gains `clip-path: inset(50%)`. It was
  the fourth copy and the only one still carrying `clip: rect()` alone —
  deprecated, and not what clips in current engines.
- REQUIRED grows by `clip-path: inset(50%)`, which subsumes the scoped
  assertion that pinned it on `.v2-demo__sr` alone; that test is removed
  rather than left as a redundant special case (985 tests, was 986).

Measured at 1179018e, 89 suites. Each copy is now pinned — drop the
declaration from any one of the four and the census reds:

  .v2-landing__wedge-sr        2 failed / 985
  .v2-landing__install-statu

**File**: `frontend/src/v2/__tests__/srOnlyPattern.test.ts` (modified, +17/-15)
```diff
@@ -72,9 +72,13 @@ const visuallyHiddenRules = (): HiddenRule[] => {
       // neither idiom, which is the defect itself) must still be discovered.
       // Measured at this head: the four candidate keys (this one, this one plus
       // `clip: rect(`, this one plus `clip-path`, and `position: absolute` +
-      // 1px with no overflow clause) all return the same three rules out of
-      // 2,893 in src/, so the broader key costs nothing today and cannot be the
-      // reason a future copy is missed.
+      // 1px with no overflow clause) all return the same FOUR rules out of
+      // 2,970 in src/, so the broader key costs nothing today and cannot be the
+      // reason a future copy is missed. The `clip-path` key disagreed until
+      // TASK-220 — it returned three, because `.v2-board__focus-live` carried
+      // `clip: rect()` alone. That is exactly the copy a narrower key would
+      // have missed, which is why the key is the DEFECT’S PRECONDITION and not
+      // the idiom.
       const looksHidden = /position:\s*absolute;/.test(body)
         && /width:\s*1px;/.test(body)
         && /height:\s*1px;/.test(body)
@@ -104,7 +108,15 @@ const declarations = (body: string): string[] =>
 // copy's text is visible, which is a loud defect rather than this silent one.
 // `text-indent: -9999px` hiding is out of scope (0 rules in src/ today, measured)
 // because it creates no absolutely positioned box.
-const REQUIRED = ['padding: 0', 'margin: -1px', 'white-space: nowrap', 'border: 0'];
+const REQUIRED = ['padding: 0', 'margin: -1px', 'white-space: nowrap', 'border: 0',
+  // TASK-220. `clip-path` joins the set now that every copy carries it. It was
+  // held out while three rows were mid-flight and the family was non-uniform
+  // (#2024, #2042, #2046); holding it out is what left the one declaration that
+  // matters here unpinned on the copies that already had it — drop it from any
+  // of them and nothing red. `clip: rect()` is deprecated and `clip-path` is
+  // what actually clips in current engines, so a copy with the old idiom alone
+  // is the defect this file exists to find.
+  'clip-path: inset(50%)'];
 
 const rules = visuallyHiddenRules();
 
@@ -116,6 +128,7 @@ describe('the visually-hidden pattern has one shape', () => {
       expect.arrayContaining([
         '.v2-demo__sr',
         '.v2-landing__install-status',
+        '.v2-landing__wedge-sr',
         '.v2-board__focus-live',
       ]),
     );
@@ -130,15 +143,4 @@ describe('the visually-hidden pattern has one shape', () => {
     });
     expect(missing).toEqual([]);
   });
-
-  it('keeps clip-path on the demo label, as the set this fix ships', () => {
-    // Pattern conformance, not a certified mechanism (see the header). The
-    // family is not uniform here on purpose: this declaration was added to the
-    // one copy under repair, and the two other sheets are under active edit by
-    // other rows, so this pins what this row declares rather than a uniformity
-    // the family does not yet have.
-    const demo = rules.find((r) => r.selector === '.v2-demo__sr');
-    expect(demo).toBeDefined();
-    expect(declarations(demo?.body ?? '')).toContain('clip-path: inset(50%)');
-  });
 });
```

**File**: `frontend/src/v2/v2.css` (modified, +1/-0)
```diff
@@ -7999,6 +7999,7 @@ body.modern-ui.v2-canvas {
   margin: -1px;
   overflow: hidden;
   clip: rect(0, 0, 0, 0);
+  clip-path: inset(50%);
   white-space: nowrap;
   border: 0;
 }
```

---

### Incident Patch 14: `1179018e` (2026-09-30)
**Commit Message**: test(v2): three brace-walk copies collapsed into blockAt + { within } on ruleBody (TASK-203) (#2049)

* test(v2): one bounded-scope reader for the invariant suite, and the numbers its comment claims (TASK-203)

The suite carried three hand-rolled copies of the same brace walk
(`teamPhoneBlock`, `mediaBlockContaining`, `mediaAt`) — three copies is how the
fourth drifts. They now route through one `blockAt` plus one `blockContaining`,
and `ruleBody` takes `{ within }`, so a scoped read names the sheet it read and
the scope it read in instead of passing a truncated string as `css`.

The comment above `reducedMotionBlock` also claimed the read it replaced "runs
to EOF — 800 lines past the block it meant". Measured at main `16917532`:
`split('@media (prefers-reduced-motion')[1]` is 865 lines / 33,883 characters
from just after the first at-rule (531) to just BEFORE the second (1395) — it
does not reach EOF, and any rule in that span could answer a read aimed at the
block. v2-landing.css carries five such at-rules; `grep -c` reports six because
the prose comment at 1356 mentions it.

Arms (base: 205 tests, 205 passed; unchanged after the refactor):
- delete the phone rule for `.v2-team__

**File**: `frontend/src/v2/__tests__/v2-layout-invariants.test.ts` (modified, +60/-76)
```diff
@@ -23,64 +23,63 @@ import path from 'path';
 const read = (rel: string): string =>
   fs.readFileSync(path.join(__dirname, rel), 'utf8');
 
-// Grab the body of the first `<selector> { ... }` block. Selectors here have no
-// nested braces, so a naive slice to the next `}` is sufficient.
-// The team's phone block: the `@media (max-width: 760px)` block that carries
-// `.v2-team__grid`, wherever it sits in the sheet — not the last one.
-const teamPhoneBlock = (css: string): string => {
-  const marker = '@media (max-width: 760px)';
-  let from = 0;
-  for (;;) {
-    const at = css.indexOf(marker, from);
-    if (at < 0) return '';
-    // Walk to the block's own closing brace so a base rule after the block
-    // can never be read as part of it.
-    const open = css.indexOf('{', at);
-    let depth = 0;
-    let end = open;
-    for (let i = open; i < css.length; i += 1) {
-      if (css[i] === '{') depth += 1;
-      if (css[i] === '}') { depth -= 1; if (depth === 0) { end = i; break; } }
-    }
-    const block = css.slice(at, end + 1);
-    if (block.includes('.v2-team__grid')) return block;
-    from = end + 1;
+// The block that opens at the first `{` at or after `from`, brace-matched to
+// its own closing brace — or '' when nothing opens there. This is THE walk:
+// three hand-rolled copies of it is how the fourth one drifts, and a copy that
+// stops at the next `}` reads a base rule after the block as part of it.
+const blockAt = (css: string, from: number): string => {
+  const open = css.indexOf('{', from);
+  if (open === -1) return '';
+  let depth = 0;
+  for (let i = open; i < css.length; i += 1) {
+    if (css[i] === '{') depth += 1;
+    if (css[i] === '}') { depth -= 1; if (depth === 0) return css.slice(from, i + 1); }
   }
+  return '';
 };
 
+// The first block introduced by `marker` whose OWN text carries `needle`. A
+// scope with a start and no end is not a scope, so both ends come from
+// `blockAt` and a later block can never answer for this one.
+const blockContaining = (css: string, marker: string, needle: string): string => {
+  for (let at = css.indexOf(marker); at !== -1; at = css.indexOf(marker, at + 1)) {
+    const block = blockAt(css, at);
+    if (block.includes(needle)) return block;
+  }
+  return '';
+};
+
+// The team's phone block: the `@media (max-width: 760px)` block that carries
+// `.v2-team__grid`, wherever it sits in the sheet — not the last one.
+const teamPhoneBlock = (css: string): string =>
+  blockContaining(css, '@media (max-width: 760px)', '.v2-team__grid');
+
 // The `@media (max-width: 760px)` block that carries `selector`, wherever it
 // sits in the sheet. A phone override is indented inside a media query, so
 // `ruleBody` (which prefers a line-start selector) silently returns the desktop
 // rule instead — and a guard reading the wrong rule is green while the phone
 // layout is broken (TASK-140).
-const mediaBlockContaining = (css: string, selector: string): string => {
-  const marker = '@media (max-width: 760px)';
-  let from = 0;
-  for (;;) {
-    const at = css.indexOf(marker, from);
-    if (at < 0) return '';
-    const open = css.indexOf('{', at);
-    let depth = 0;
-    let end = open;
-    for (let i = open; i < css.length; i += 1) {
-      if (css[i] === '{') depth += 1;
-      if (css[i] === '}') { depth -= 1; if (depth === 0) { end = i; break; } }
-    }
-    const block = css.slice(at, end + 1);
-    if (block.includes(selector)) return block;
-    from = end + 1;
-  }
-};
-
-const ruleBody = (css: string, selector: string): string => {
+const mediaBlockContaining = (css: string, selector: string): string =>
+  blockContaining(css, '@media (max-width: 760px)', selector);
+
+// `within` bounds the read to a slice already taken out of the sheet (an
+// at-rule's block, a media query's body). Pass it rather than passing the slice
+// as `css`: the call then names the sheet it read AND the scope it read in, so a
+// scoped read cannot be mistaken for a whole-sheet one.
+const ruleBody = (
+  css: string,
+  selector: string,
+  { within }: { within?: string } = {},
+): string => {
+  const scope = within ?? css;
   // Prefer a selector at the start of a CSS line. A descendant selector can
   // contain the same text (`.parent .target {`) and is not the rule being
   // pinned.
-  const lineStart = css.indexOf(`\n${selector} {`);
-  const start = lineStart === -1 ? css.indexOf(`${selector} {`) : lineStart + 1;
+  const lineStart = scope.indexOf(`\n${selector} {`);
+  const start = lineStart === -1 ? scope.indexOf(`${selector} {`) : lineStart + 1;
   if (start === -1) return '';
-  const end = css.indexOf('}', start);
-  return end === -1 ? '' : css.slice(start, end);
+  const end = scope.indexOf('}', start);
+  return end === -1 ? '' : scope.slice(start, end);
 };
 
 // TASK-129 supersedes a large sidebar block in place. The current artboard
@@ -113,32 +112,18 @@ const selectorRuleBody = (css: string, selector: string): string => {
 c
```

---

### Incident Patch 15: `662966ec` (2026-09-30)
**Commit Message**: fix(v2): the sr-only family's source carries clip-path, so the copy's requirement bites (TASK-218) (#2046)

`.v2-landing__wedge-sr` (TASK-216) derives its required declaration set from
`.v2-landing__install-status`, which was the family's member missing
`clip-path: inset(50%)`. A subset assertion can only shrink: at `b1aa0ec8`
dropping `clip-path` from the new copy passed (arm D green) and weakening the
source passed too (arm G), because the derivation is one-directional. Giving the
source the declaration it lacked makes arm D red on its own, with no change to
the test.

Arms, invocation named (`npx jest src/v2`, cwd `frontend/`, BASE = main
`74354857`: 88 suites / 983 tests all passing):

- with the fix: 88 / 983 all passing
- arm D (drop `clip-path` from `.v2-landing__wedge-sr`): 1 failed / 982 passed / 983
- arm S (drop it from the SOURCE instead): still 88 / 983 green — the limit this
  row does not close, recorded rather than left implied, because a subset
  assertion cannot red when the source weakens

Browser tier on the live page with the declaration injected into the sheet
(computed `clip-path: inset(50%)` asserted, not assumed): document
`scrollHeight` 900x1440 at 1440x90

**File**: `frontend/src/v2/landing/v2-landing.css` (modified, +5/-1)
```diff
@@ -369,7 +369,10 @@
   outline-offset: 2px;
 }
 /* The Copied state is announced by a live region, not read from the button's own
-   label swap, so it is out of flow and silent to sighted users. */
+   label swap, so it is out of flow and silent to sighted users. It carries the
+   whole visually-hidden pattern including `clip-path`, because it is the member
+   the wedge copy's required set is DERIVED from — a declaration missing here is
+   a declaration nothing requires of the copy (TASK-218). */
 .v2-landing__install-status {
   color: #ffffff;
   position: absolute;
@@ -379,6 +382,7 @@
   margin: -1px;
   overflow: hidden;
   clip: rect(0, 0, 0, 0);
+  clip-path: inset(50%);
   white-space: nowrap;
   border: 0;
 }
```

#### Recent Merged Pull Requests:
- **PR #2082** (2026-10-06): fix(deps): proxy-addr 2.0.8 in both commonly-mcp lockfiles (@lilyshen0722)
- **PR #2081** (2026-10-06): fix(deps): clear backend runtime Dependabot alerts (@lilyshen0722)
- **PR #2080** (2026-10-06): fix(frontend): clear runtime critical and high advisories (@lilyshen0722)
- **PR #2079** (2026-10-06): fix(tasks): track offered revisions for board wakes (@lilyshen0722)
- **PR #2078** (2026-10-06): docs: AX-76 (wakeOnMessage also gated board wakes) and rule 44's seat review path (@lilyshen0722)
- **PR #2077** (2026-10-06): ci(npm): publish with npm trusted publishing (OIDC), no stored token (@lilyshen0722)
- **PR #2076** (2026-10-01): Style connector revoke notice links (@lilyshen0722)
- **PR #2075** (2026-10-01): docs(hosted-mcp): correct refresh-token drop rationale (@lilyshen0722)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
