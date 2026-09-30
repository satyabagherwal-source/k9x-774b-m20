# Forensic Learning Record (Deep Inspection): rowboatlabs/rowboat

> **Canonical Artifact**: `07_PROJECT_LEARNING/rowboatlabs-rowboat-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rowboatlabs/rowboat](https://github.com/rowboatlabs/rowboat))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:48:11.176Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rowboatlabs/rowboat`
- **Description**: AI coworker with memory and collaboration
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 17991 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/harbor/examples/echo-agent.mjs`
```
// The smallest connector for the agent contract (SPEC.md §8, Invoking agent
// members; the wire in CONTRACT.md, "Agent invocations"). It runs as one
// agent member, on that agent's key: told live when it's mentioned, it also
// lists its pending invocations on start and every minute (the live frame is
// the fast path, the list the guarantee), acknowledges each one, reports
// progress, replies in the thread through the ordinary messages route, and
// reports done. It declares Stop and honors invocation_stop, and declares
// one option (Style: Plain or Shout) that the composer offers when you mention
// it. "slow" in a message makes it take 15 seconds, so a second mention in
// the same thread visibly waits its turn; "approve" makes it wait on you until
// a reply that mentions it arrives as the answer. A real connector (Hermes,
// OpenClaw) keeps this shape and swaps the echo for its agent.
//
// Try it against a dev Harbor: add an agent under Agents in the app, add it
// to a space, then
//
//   node apps/harbor/examples/echo-agent.mjs http://localhost:4272 rbk_...

const [, , base, key] = process.argv;
if (!base || !key) {
  console.error('usage: node apps/harbor/examples/echo-agent.mjs <harbor-url> <agent-key>');
  process.exit(1);
}

const api = async (method, path, body) => {
  const res = await fetch(base + path, {
    method,
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json)}`);
  return json;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const plain = (body) => body.replace(/\[@([^\]]+)\]\(#member:[^)]+\)/g, '@$1');

const me = (await api('GET', '/v1/me')).member;
console.log(`echo agent running as ${me.displayName} (${me.id})`);
await api('POST', '/v1/agent/capabilities', {
  stop: true,
  options: [{ type: 'select', key: 'style', label: 'Style', choices: [{ id: 'plain', label: 'Plain' }, { id: 'shout', label: 'Shout' }] }],
});

const seen = new Set();
const stopping = new Set();
/** Turns waiting on a person: invocation id → resolve with the answer's text. */
const waiting = new Map();
const report = (id, update) => api('POST', `/v1/agent/invocations/${id}/update`, update);

async function handle(invocation) {
  if (seen.has(invocation.id) || invocation.state !== 'pending') return;
  seen.add(invocation.id);
  const { spaceId, threadRootId } = invocation.conversation;
  const text = plain(invocation.trigger.body);
  console.log(`→ invoked by ${invocation.trigger.authorId}: ${text}`);
  // An answer to a turn that is waiting on a person: hand it over, and it's done.
  if (invocation.answers) {
    await api('POST', `/v1/agent/invocations/${invocation.id}/ack`);
    await report(invocation.id, { state: 'done' });
    waiting.get(invocation.answers)?.(text);
    return;
  }
  const say = (body) =>
    api('POST', `/v1/spaces/${spaceId}/messages`, {
      threadRoot: threadRootId,
      body: invocation.options?.style === 'shout' ? body.toUpperCase() : body,
      actingMode: 'direct',
    });
  try {
    await api('POST', `/v1/agent/invocations/${invocation.id}/ack`);
    if (/\bapprove\b/i.test(text)) {
      await report(invocation.id, { state: 'waiting', activity: 'Reply mentioning me to approve or reject' });
      const answer = await new Promise((resolve) => waiting.set(invocation.id, resolve));
      waiting.delete(invocation.id);
      await report(invocation.id, { state: 'working', activity: 'Carrying on' });
      await say(`Echo: you answered “${answer}” to “${text}”`);
      await report(invocation.id, { state: 'done' });
      console.log('  answered, done');
      return;
    }
    const slow = /\bslow\b/i.test(text);
    await api('POST', `/v1/agent/invocations/${invocation.id}/update`, { state: 'working', activity: slow ? 'Taking my time' : 'Thinking it over' });
    for (let waited = 0; waited < (slow ? 15_000 : 1_500); waited += 500) {
      if (stopping.has(invocation.id)) {
        await api('POST', `/v1/agent/invocations/${invocation.id}/update`, { state: 'cancelled' });
        console.log('  stopped');
        return;
      }
      await sleep(500);
    }
    await say(`Echo: ${text}`);
    await report(invocation.id, { state: 'done' });
    console.log('  replied, done');
  } catch (err) {
    console.error('  failed:', err.message);
    await api('POST', `/v1/agent/invocations/${invocation.id}/update`, { state: 'failed', error: err.message }).catch(() => {});
  }
}

// What a previous run acknowledged and never finished died with it (an echo
// can't resume): say so now, or its thread waits out Harbor's 30 minutes
// behind a turn that is gone (SPEC.md §8).
for (const invocation of (await api('GET', '/v1/agent/invocations')).invocations) {
  if (invocation.state !== 'pending') await report(invocation.id, { state: 'failed', error: 'The agent restarted before finishing this.' });
}

// The list is the guarantee: on start, and every minute.
async function sweep() {
  const { invocations } = await api('GET', '/v1/agent/invocations');
  for (const invocation of invocations) void handle(invocation);
}

// The live frame is the fast path.
function connect() {
  const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/v1/live?token=${encodeURIComponent(key)}`);
  ws.onmessage = (event) => {
    const frame = JSON.parse(String(event.data));
    if (frame.kind === 'invocation') void handle(frame.invocation);
    if (frame.kind === 'invocation_stop') stopping.add(frame.invocationId);
  };
  ws.onopen = () => void sweep();
  ws.onclose = () => setTimeout(connect, 2000);
}
connect();
setInterval(() => void sweep().catch((err) => console.error('sweep failed:', err.message)), 60_000);

```

### Core Architecture Module: `apps/harbor/packages/protocol/src/api.ts`
```
import { z } from 'zod';
import { BlobInfo } from './blob.js';
import {
  Asset,
  ChangeSet,
  CreateAsset,
  CreateAssetResult,
  DeleteAssetResult,
  MoveAssetResult,
  ProposeChange,
  ProposeChangeResult,
  ReadAssetResult,
  RestoreAssetResult,
} from './changeset.js';
import { ActingMode, AgentKey, AgentKeySecret, AgentListing, Attribution, Member, Membership, Message, ReactionEmoji, Space, SpaceKind, SpaceVisibility, Topic } from './core.js';
import { AssetId, AssetPath, BlobHash, ChangeSetId, MemberId, MessageId, SpaceId, StreamOffset, TopicId } from './ids.js';
import {
  AcceptInvite,
  AcceptInviteResult,
  CreateInvite,
  CreateInviteResult,
  ResolveInvite,
  ResolveInviteResult,
} from './invite.js';
import { StreamEvent } from './events.js';
import { ConnectorCapabilities, Invocation, InvocationId, InvocationOptionValues, InvocationUpdate } from './invocation.js';
import { SearchKind, SearchResults } from './search.js';

// The render face (spec §9): REST + the live stream in events.ts. Member token
// auth on every route. Shapes here are v0 — Latitude items (pagination, ETags,
// unread counters) may be added without a contract round as long as existing
// fields keep their meaning. The admin surface (/internal/*) is deliberately
// NOT in this package — it is control-plane-facing (spec §4).

/**
 * Poll creation (the Discord create-request asymmetry: a duration in, an
 * expiry out — the org stamps `expiresAt` from its own clock). Answer ids are
 * server-assigned. The message's `body` must carry a plain-markdown fallback
 * rendering of the poll (question + numbered options) so poll-blind clients
 * still show it; poll-aware clients render the card instead.
 */
export const NewPoll = z.object({
  question: z.string().trim().min(1).max(300),
  answers: z
    .array(z.object({ text: z.string().trim().min(1).max(55), emoji: ReactionEmoji.optional() }))
    .min(2)
    .max(10),
  /** Hours until the poll closes. Default 24, max 32 days — Discord's bounds. */
  durationHours: z.number().int().min(1).max(768).optional(),
  allowMultiselect: z.boolean().optional(),
});

const NewMessage = z.object({
  /**
   * Present = a reply into the flat thread under this root (the org
   * normalizes a reply's id to its root, Slack-style); absent = a new root
   * message in the space's one stream. Posting a message never creates a
   * container — a topic exists only via createTopic.
   */
  threadRoot: MessageId.optional(),
  /** Reply-to-activity-row provenance (root posts only): the change-set this message answers. */
  anchorChangeSetId: ChangeSetId.optional(),
  body: z.string().min(1).max(65_536),
  /** Present = this message carries a poll (immutable once posted; editMessage refuses). */
  poll: NewPoll.optional(),
  actingMode: ActingMode,
  agentName: z.string().max(64).optional(),
  /**
   * Options picked for agents this message mentions (spec §8 Invocation
   * options), keyed by the agent's member id. They land on that agent's
   * invocation, uninterpreted; values for an agent the message does not
   * mention are ignored.
   */
  agentOptions: z.record(MemberId, InvocationOptionValues).optional(),
});

/**
 * A listTopics entry: the row plus its root message (reply chips, parent
 * cards, unread anchors all need it) and the computed activity stamp the rail
 * sorts by (newest reply, else the root's post time). The rootMessage's
 * `reactions` are the at-post snapshot (not folded live) — this field is
 * title/parent material, not a message listing.
 */
export const TopicListing = Topic.extend({
  rootMessage: Message.nullable(),
  lastActivityAt: z.iso.datetime(),
});
export type TopicListing = z.infer<typeof TopicListing>;

/**
 * One space in the unread snapshot (read state, 2026-09-09). Counts exclude
 * the member's own messages and tombstones; `threads` lists only FOLLOWED
 * threads with live replies past the member's mark.
 */
export const UnreadSpace = z.object({
  spaceId: SpaceId,
  /** The space's current head offset. */
  head: StreamOffset,
  /** The member's stream mark (0 = never marked). */
  readOffset: StreamOffset,
  /** Roots after readOffset, not the member's, not deleted. */
  unreadRoots: z.number().int().nonnegative(),
  /**
   * Messages addressed to the member (a mention token naming them, or @here)
   * past the mark: unread roots plus the unread replies in followed threads.
   * The sidebar's number; `unreadRoots` is its bold.
   */
  unreadMentions: z.number().int().nonnegative(),
  threads: z.array(
    z.object({
      rootMessageId: MessageId,
      readOffset: StreamOffset,
      lastReplyOffset: StreamOffset,
      /** Live replies after readOffset, not the member's own. */
      unreadReplies: z.number().int().positive(),
      /** Of those, the ones addressed to the member. */
      unreadMentions: z.number().int().nonnegative(),
    }),
  ),
});
export type UnreadSpace = z.infer<typeof UnreadSpace>;

export const UnreadSnapshot = z.object({ spaces: z.array(UnreadSpace) });
export type UnreadSnapshot = z.infer<typeof UnreadSnapshot>;

/**
 * Activity (2026-09-10, the unread arc's layer 3): everything that involves
 * the member, across every space and DM they are in, newest first. Not a
 * table fanned out on write (Slack, Discord, GitHub) but a query over facts
 * the org already keeps — the stamped mentions, the follow rows, the DM
 * kind, the reactions (Zulip's Mentions/Inbox views work this way) — so
 * edits, deletes and the backfill stay consistent for free and there is no
 * second source of truth beside the read marks. Kinds, in the priority a
 * single message resolves to: `mention` (a token named you) > `here` >
 * `dm` (a message in your DM) > `reply` (in a thread you follow); plus
 * `reaction` (on a message of yours, folded per message and emoji).
 */
export const ActivityKind = z.enum(['mention', 'here', 'dm', 'reply', 'reaction']);
export type ActivityKind = z.infer<typeof ActivityKind>;

export const ActivityItem = z.object({
  /** Stable identity: `m:<messageId>` for message kinds, `r:<messageId>:<emoji>` for a reaction. */
  id: z.string(),
  kind: ActivityKind,
  spaceId: SpaceId,
  spaceKind: SpaceKind,
  spaceName: z.string(),
  /** The thread the message lives in (absent = a stream root). */
  threadRootId: MessageId.optional(),
  /** The message the item is about: theirs for message kinds, yours for a reaction. */
  message: Message,
  /** Who did it: the author for message kinds; every reactor, newest first, for a reaction. */
  actors: z.array(Attribution),
  emoji: z.string().optional(),
  at: z.iso.datetime(),
  /**
   * Message kinds: the message is past your stream mark (a root) or your
   * thread mark (a reply) — reading in place clears it, one read-state
   * truth. Reactions use their event offsets against that same mark.
   * Legacy activity-seen timestamps remain honored for older clients.
   */
  unread: z.boolean(),
});
export type ActivityItem = z.infer<typeof ActivityItem>;

export const ActivityPage = z.object({
  items: z.array(ActivityItem),
  /** Present when older items exist: pass it back as `cursor`. */
  nextCursor: z.string().optional(),
  /** Your activity-seen mark (reactions before it are read); null = never marked. */
  seenAt: z.iso.datetime().nullable(),
  /** Display names for every member on the page (actors and mention tokens), from the org roster the caller may see. */
  names: z.record(MemberId, z.string()),
});
export type ActivityPage = z.infer<typeof ActivityPage>;

export const routes = {
  // --- identity ------------------------------------------------------------
  /** Who am I on this org — the client's only source of its own memberId under OAuth. */
  me: {
    method: 'GET',
    path: '/v1/me',
    response: z.object({ member: Member }),
  },
  // --- spaces & membership -------------------------------------------------
  /**
   * The spaces you are a member of. Default = SHARED spaces only (today's
   * shape, unchanged). `inc
```

### Core Architecture Module: `apps/harbor/packages/protocol/src/blob.ts`
```
import { z } from 'zod';
import { BlobHash } from './ids.js';

// Spec §6: binary and large assets are content-addressed bytes held beside the
// database; version rows, change-sets, and messages carry {hash, size, mime} —
// never the bytes. Upload is a two-phase act: put the bytes (uploadBlob),
// then reference the hash (a message body's blob link, or proposeChange's
// blob variant). An unreferenced upload is an orphan awaiting GC (§12).

export const BlobInfo = z.object({
  hash: BlobHash,
  size: z.number().int().nonnegative(),
  /**
   * Determined at upload: the org sniffs magic bytes for well-known types and
   * falls back to the declared content-type. The stored value is authoritative
   * everywhere (serving headers, inline-vs-attachment) — never the client's
   * claim at read time, never the object store's metadata.
   */
  mime: z.string().min(1).max(255),
  /**
   * Pixel dimensions, parsed from the header bytes of sniffed images at
   * upload. A display hint for clients (reserve the exact box before the
   * bytes arrive — no layout shift), never a gate: absent for non-images,
   * unparseable headers, and blobs uploaded before this field existed.
   */
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
});
export type BlobInfo = z.infer<typeof BlobInfo>;

```

### Core Architecture Module: `apps/harbor/packages/protocol/src/changeset.ts`
```
import { z } from 'zod';
import { BlobInfo } from './blob.js';
import { Attribution, ActingMode } from './core.js';
import { AssetId, AssetPath, AssetVersion, BlobHash, ChangeSetId, MessageId, SpaceId, StreamOffset } from './ids.js';

// Decision 1 (CONTRACT.md): a proposal is full new content against a declared
// base version; the org performs a line-level three-way merge. No operation
// encoding on the wire. Decision 6: a conflict response carries everything a
// human draft UI or an agent retry needs — no second round trip.
//
// Binary variant (spec §6): a proposal may carry an uploaded blob's hash
// instead of text. One namespace, one log — `design.pdf` beside `README.md`,
// only the populated field differs. Binary staleness never merges: a stale
// binary base (or a binary head) is conflict-or-replace, never a three-way.

/**
 * A file, as every listing, read, search hit, and create result describes it
 * (2026-09-14): the id is the identity every operation addresses; the path is
 * its display name and tree position, changed only by moveAsset. Folders are
 * display: clients group paths on `/`.
 */
export const Asset = z.object({
  id: AssetId,
  path: AssetPath,
  version: AssetVersion,
  updatedAt: z.iso.datetime(),
  /** Present when the head version is binary. */
  blob: BlobInfo.optional(),
  /** Present only on trash entries (listAssets includeDeleted); absent = live. */
  state: z.literal('deleted').optional(),
});
export type Asset = z.infer<typeof Asset>;

/** The durable record of one applied change (spec §6). Content is fetched via read/history/diff, not carried here. */
export const ChangeSet = z.object({
  id: ChangeSetId,
  spaceId: SpaceId,
  /** The file this change belongs to — the lineage key history filters on. */
  assetId: AssetId,
  /** The file's path WHEN the change committed: a point-in-time record for rendering history, never an address. */
  assetPath: AssetPath,
  /** 0 means the change created the asset. */
  baseVersion: z.number().int().nonnegative(),
  resultVersion: AssetVersion,
  attribution: Attribution,
  /** Commit-message-style reasoning. Optional for humans; the MCP face requires it (mcp.ts). */
  reason: z.string().max(1_000).optional(),
  /** The thread the change was made from (its root message id), when it was made from one (provenance). */
  threadRootId: MessageId.optional(),
  /** Present when the change produced a binary version (proposeChange's blob variant). */
  blob: BlobInfo.optional(),
  /**
   * Namespace operations (absent = a content edit). Only content edits bump
   * the version — an op change-set carries baseVersion === resultVersion:
   * the version the file had when it was moved/deleted/restored.
   */
  op: z.enum(['move', 'delete', 'restore']).optional(),
  /** op 'move' only: where the file lived before (assetPath is where it lives now). */
  movedFrom: AssetPath.optional(),
  committedAt: z.iso.datetime(),
  offset: StreamOffset,
});
export type ChangeSet = z.infer<typeof ChangeSet>;

export const ProposeChange = z.object({
  assetId: AssetId,
  /** Version the proposer last read; stale values trigger merge or conflict. New files are born via createAsset. */
  baseVersion: z.number().int().positive(),
  /** Text variant: full desired content (inline cap 1MB — over that, or non-UTF-8, attach a blob instead). */
  newContent: z.string().max(1_048_576).optional(),
  /** Binary variant: the address of bytes already uploaded to this space (uploadBlob). Exactly one of newContent/blob. */
  blob: BlobHash.optional(),
  reason: z.string().max(1_000).optional(),
  /** Provenance: the thread this change was made from (root message id). Omitted by prompt-driven agents, which append "· thread:<id>" to the reason instead — the org derives threadRootId from that suffix (threadRootFromReason). */
  threadRootId: MessageId.optional(),
  actingMode: ActingMode,
  agentName: z.string().max(64).optional(),
}).superRefine((v, ctx) => {
  if ((v.newContent === undefined) === (v.blob === undefined)) {
    ctx.addIssue({ code: 'custom', message: 'exactly one of newContent or blob' });
  }
});
export type ProposeChange = z.infer<typeof ProposeChange>;

/**
 * Birth (2026-09-14): the one operation that addresses a file by name, because
 * the file has no id yet. The path must be free among the living (the trash
 * never blocks a name); the result carries the new id every later call uses.
 */
export const CreateAsset = z.object({
  path: AssetPath,
  /** Text variant: full content (inline cap 1MB — over that, or non-UTF-8, attach a blob instead). */
  newContent: z.string().max(1_048_576).optional(),
  /** Binary variant: the address of bytes already uploaded to this space (uploadBlob). Exactly one of newContent/blob. */
  blob: BlobHash.optional(),
  reason: z.string().max(1_000).optional(),
  threadRootId: MessageId.optional(),
  actingMode: ActingMode,
  agentName: z.string().max(64).optional(),
}).superRefine((v, ctx) => {
  if ((v.newContent === undefined) === (v.blob === undefined)) {
    ctx.addIssue({ code: 'custom', message: 'exactly one of newContent or blob' });
  }
});
export type CreateAsset = z.infer<typeof CreateAsset>;

/** Occupied path = invalid_request. Never a conflict: nothing existed to be stale against. */
export const CreateAssetResult = z.object({
  asset: Asset,
  changeSet: ChangeSet,
});
export type CreateAssetResult = z.infer<typeof CreateAssetResult>;

/**
 * The reason-suffix convention, owned here so both faces parse it identically:
 * a change made from a thread may carry "· thread:<root message id>" at the
 * end of its reason (legacy spelling "topic:<id>", which pre-011 servers
 * stamped as a topic id). The org stamps the parsed value into
 * ChangeSet.threadRootId at commit time.
 */
export function threadRootFromReason(reason: string | undefined): string | null {
  if (!reason) return null;
  const suffixed = /\s*·\s*(?:topic|thread):([0-9A-Za-z_-]+)\s*$/.exec(reason);
  if (suffixed) return suffixed[1]!;
  const bare = /^(?:topic|thread):([0-9A-Za-z_-]+)$/.exec(reason.trim());
  return bare ? bare[1]! : null;
}

/** A base-file line range where both sides changed. Line numbers are 1-based on the base version. */
export const ConflictRegion = z.object({
  baseStart: z.number().int().positive(),
  baseEnd: z.number().int().nonnegative(),
  /** What the current asset has for that region (the earlier writer won it, so far). */
  current: z.array(z.string()),
  /** What the stale proposal wanted there. */
  proposed: z.array(z.string()),
});
export type ConflictRegion = z.infer<typeof ConflictRegion>;

export const ProposeChangeResult = z.discriminatedUnion('outcome', [
  /** Base was current. Content stored verbatim. */
  z.object({
    outcome: z.literal('applied'),
    changeSet: ChangeSet,
    version: AssetVersion,
  }),
  /**
   * Base was stale but the three-way merge was clean. The org stored
   * `mergedContent` — the proposer MUST treat it, not `newContent`, as what
   * now exists (principle 5: no write is ever silently lost, in either direction).
   */
  z.object({
    outcome: z.literal('merged'),
    changeSet: ChangeSet,
    version: AssetVersion,
    mergedContent: z.string(),
  }),
  /**
   * Overlapping edits. NOTHING was written. The proposer adjusts against
   * `currentContent`/`currentVersion` and re-proposes (spec §6 merge-then-correct).
   * `recentHistory` is the read-before-write bundle for agent retries.
   *
   * Binary: when either side of a stale propose is binary there is nothing to
   * three-way-merge, so the conflict comes with `regions: []` — the current
   * head is `currentBlob` (binary, `currentContent` is '') or `currentContent`
   * (text). Re-proposing at `currentVersion` is the explicit replace.
   */
  z.object({
    outcome: z.literal('conflict'),
    currentVersion: AssetVersion,
    currentContent: z.string(),
    currentBlob: BlobInfo.optional(),
    regions: z.array(ConflictRegion),
    recentHistory: z.array(ChangeS
```

### Core Architecture Module: `apps/harbor/packages/protocol/src/core.ts`
```
import { z } from 'zod';
import { AssetId, ChangeSetId, MemberId, MessageId, SpaceId, StreamOffset, TopicId } from './ids.js';

// Core objects shared by both faces. Every act in a space belongs to a member
// (spec §2, principle 4); attribution carries the acting mode. An agent that
// acts as itself is a member of kind 'agent' (2026-09-29), never a label on
// someone else's attribution.

export const ActingMode = z.enum(['direct', 'agent', 'scheduled']);
export type ActingMode = z.infer<typeof ActingMode>;

export const Attribution = z.object({
  memberId: MemberId,
  actingMode: ActingMode,
  /** Display-only agent label, e.g. "Rowboat", "Claude Code". Never an identity. */
  agentName: z.string().max(64).optional(),
});
export type Attribution = z.infer<typeof Attribution>;

/**
 * The org-level admin bit (spec §4, amended 2026-08-19): admin powers are
 * membership and policy, never content — the content plane is role-flat.
 */
export const MemberRole = z.enum(['admin', 'member']);
export type MemberRole = z.infer<typeof MemberRole>;

/**
 * What a member IS (spec §4 Agent members, 2026-09-29): a person, or an agent
 * that is a member in its own right and acts as itself. Fixed at creation.
 * Distinct from `actingMode: 'agent'`, which is a person's own agent acting
 * as that person.
 */
export const MemberKind = z.enum(['human', 'agent']);
export type MemberKind = z.infer<typeof MemberKind>;

export const Member = z.object({
  id: MemberId,
  /** Display-only, org-scoped, not unique. Attribution keys on `id`, never on names. */
  displayName: z.string().min(1).max(128),
  avatarUrl: z.string().url().optional(),
  role: MemberRole.default('member'),
  /** Absent from servers before 2026-09-29, whose members are all people. */
  kind: MemberKind.default('human'),
  /**
   * An agent's owner (spec §4 Agent members, 2026-09-29): the person who
   * added it and alone holds its keys. Absent for people, and for an
   * org-owned agent such as Replicas, which admins manage.
   */
  ownerId: MemberId.optional(),
});
export type Member = z.infer<typeof Member>;

/**
 * A credential an agent member presents as itself (spec §4, 2026-09-29): a
 * bearer secret the org stores only as a hash. The secret is shown once, at
 * creation (AgentKeySecret); every other read is this metadata.
 */
export const AgentKey = z.object({
  id: z.string().min(1).max(64),
  agentId: MemberId,
  createdBy: MemberId,
  createdAt: z.iso.datetime(),
  lastUsedAt: z.iso.datetime().optional(),
  revokedAt: z.iso.datetime().optional(),
});
export type AgentKey = z.infer<typeof AgentKey>;

/** A key at the one moment its secret exists outside the agent: the response that created it. */
export const AgentKeySecret = AgentKey.extend({ secret: z.string().startsWith('rbk_') });
export type AgentKeySecret = z.infer<typeof AgentKeySecret>;

/** An agent with its keys, as the Agents screen lists them. */
export const AgentListing = z.object({ agent: Member, keys: z.array(AgentKey) });
export type AgentListing = z.infer<typeof AgentListing>;

/**
 * What a space IS at the org level (direct messages, 2026-09-07). `shared` =
 * the ordinary space: invites, leave, files, feed. `direct` = a DM: the SAME
 * container on the same substrate (stream, threads, files, offsets, agent
 * sessions all unchanged), with a FIXED membership — exactly `participants`,
 * no invites, no leave — and private forever: any later access path that
 * opens spaces to non-members (browse, self-join) MUST require `shared`.
 * Defaulted so payloads from pre-DM servers still parse as shared spaces.
 */
export const SpaceKind = z.enum(['shared', 'direct']);
export type SpaceKind = z.infer<typeof SpaceKind>;

export const SpaceVisibility = z.enum(['private', 'open']);
export type SpaceVisibility = z.infer<typeof SpaceVisibility>;

export const Space = z.object({
  id: SpaceId,
  /**
   * Display name of a shared space. A direct space carries a constant
   * placeholder — nothing is stored to go stale; clients label a DM by its
   * other participant's CURRENT display name (listMembers on the space).
   */
  name: z.string().min(1).max(128),
  createdAt: z.iso.datetime(),
  kind: SpaceKind.default('shared'),
  /** Old payloads and existing spaces stay private (spec §5, 2026-09-22). */
  visibility: SpaceVisibility.default('private'),
  /**
   * Direct spaces only: the fixed member set, sorted — the DM's identity.
   * Absent on shared spaces. ONE element = the member's self-DM (notes to
   * self, 2026-09-08): the same private space, reachable from every device
   * and by the member's own agent.
   */
  participants: z.array(MemberId).min(1).optional(),
});
export type Space = z.infer<typeof Space>;

export const Membership = z.object({
  spaceId: SpaceId,
  memberId: MemberId,
  joinedAt: z.iso.datetime(),
});
export type Membership = z.infer<typeof Membership>;

/**
 * The deliberate conversation object (spec §7, annotation model 2026-09-01):
 * one row POINTING AT a thread's root message, carrying the stated goal
 * (title) and the archived flag. It contains no messages — deleting it
 * ("convert back to thread") loses nothing, archiving it hides nothing.
 * At most one topic per root; durable identity (agent sessions, presence,
 * unread) keys on the root message, never on this row. "Topic" is the wire
 * and storage name on purpose — the UI label ("Discussions" today) may drift
 * without a contract round. A plain reply chain with no row is a "thread".
 */
export const Topic = z.object({
  id: TopicId,
  spaceId: SpaceId,
  /** The thread this annotates: a stream root message (never a reply). */
  rootMessageId: MessageId,
  /** The stated goal, required at creation — the one deliberate ceremony. */
  title: z.string().min(1).max(256),
  createdBy: Attribution,
  createdAt: z.iso.datetime(),
  /** Off the rail. Nothing else anywhere changes; a new reply revives (un-archives). */
  archived: z.boolean(),
  /**
   * The one file this discussion is about (2026-09-11): a space asset the
   * UI opens beside the thread, by id — a rename never touches the link, and
   * a trashed file is simply an id the live listing does not know until it
   * is restored. Set via createTopic.documentAssetId or manageTopic
   * attach_document/detach_document.
   */
  documentAssetId: AssetId.optional(),
});
export type Topic = z.infer<typeof Topic>;

/** The payload of `topic_removed`: the row is gone, the thread is untouched. */
export const TopicRemoval = z.object({
  spaceId: SpaceId,
  topicId: TopicId,
  rootMessageId: MessageId,
  by: Attribution,
  at: z.iso.datetime(),
});
export type TopicRemoval = z.infer<typeof TopicRemoval>;

/** The emoji itself ("👍", ZWJ sequences included), rendered verbatim — never a :name:. */
export const ReactionEmoji = z
  .string()
  .min(1)
  .max(32)
  .refine((e) => !/\s/.test(e), 'an emoji has no whitespace');
export type ReactionEmoji = z.infer<typeof ReactionEmoji>;

/**
 * One member's reaction to one message — a per-(member, emoji) toggle, Slack
 * semantics. Attribution follows the contract's one rule (principle 4): the
 * act belongs to a member, `by.actingMode` says how it happened. `threadRoot`
 * mirrors the message's (absent = a stream root) so live clients route the
 * event without a lookup.
 */
export const Reaction = z.object({
  spaceId: SpaceId,
  messageId: MessageId,
  threadRoot: MessageId.optional(),
  emoji: ReactionEmoji,
  by: Attribution,
  at: z.iso.datetime(),
});
export type Reaction = z.infer<typeof Reaction>;

/** Display aggregate: who reacted with one emoji, in first-reacted order. */
export const ReactionGroup = z.object({
  emoji: ReactionEmoji,
  memberIds: z.array(MemberId).min(1),
  /** Latest reaction event represented by this group; absent on older servers. */
  lastOffset: StreamOffset.optional(),
});
export type ReactionGroup = z.infer<typeof ReactionGroup>;

/**
 * One poll answer, immutable once posted. `id` is server-assigned (1..n in
 * creation ord
```

### Core Architecture Module: `apps/harbor/packages/protocol/src/errors.ts`
```
import { z } from 'zod';

// Decision 6 (CONTRACT.md), error half. Conflicts are NOT errors — a stale base
// returns ProposeChangeResult{outcome:'conflict'} with HTTP 200, because it is
// a normal outcome of the merge-then-correct model, not a failure.

export const ErrorCode = z.enum([
  /** Missing/expired/invalid token. Re-run the OAuth journey. */
  'unauthorized',
  /** Authenticated but not allowed (e.g. not a member of the space). */
  'forbidden',
  /**
   * Valid token, but the identity maps to no member of this org — the join
   * flow's entry point (spec §4: acceptance binds (issuer, subject) → member).
   * Distinct from `unauthorized` (re-auth won't help) and `forbidden`
   * (which presumes membership).
   */
  'not_a_member',
  /**
   * Org policy refused the bind (spec §4, amended 2026-08-19: all bind-time
   * gating is org policy — v1 is the email-domain rule). The message is the
   * human-readable reason ("this org admits only @acme.com accounts") —
   * never a cryptic 401.
   */
  'policy_refused',
  'not_found',
  /** Path failed AssetPath rules or org policy (e.g. non-text in v1). */
  'invalid_path',
  'payload_too_large',
  /** Org is over a limit knob: writes rejected, reads still work (spec §4: read-only, never lockout). */
  'read_only_limit',
  'rate_limited',
  /** Malformed request body — schema validation failed. */
  'invalid_request',
  'internal',
]);
export type ErrorCode = z.infer<typeof ErrorCode>;

export const ApiError = z.object({
  code: ErrorCode,
  message: z.string(),
  /** True where retrying the identical request later can succeed (rate_limited, internal). */
  retryable: z.boolean(),
});
export type ApiError = z.infer<typeof ApiError>;

```

### Core Architecture Module: `apps/harbor/packages/protocol/src/events.ts`
```
import { z } from 'zod';
import { ChangeSet } from './changeset.js';
import { Attribution, Membership, Message, MessageDeletion, MessageEdit, PollEnd, PollVote, Reaction, Space, SpaceKind, Topic, TopicRemoval } from './core.js';
import { AssetId, MemberId, MessageId, SpaceId, StreamOffset } from './ids.js';
import { Invocation, InvocationId } from './invocation.js';

// Decision 2 (CONTRACT.md): one WebSocket per org, per-space subscriptions,
// offset-based catch-up. Subscribing with `afterOffset` replays durable events
// after that offset, then goes live — the same resume pattern as the app's
// turn-event spine. Presence is ephemeral and carries no offset.

/** Someone joined, left, or was removed from the space. */
export const MembershipEvent = z.object({
  type: z.literal('membership'),
  membership: Membership,
  action: z.enum(['joined', 'left', 'removed']),
  /**
   * Who acted on someone else's membership (2026-09-29): on `joined`, the
   * member who added them (addMembers). Absent when the member acted
   * themselves — an accepted invite, a self-join, leaving. A field rather
   * than an `added` action, so older clients still parse the frame.
   */
  by: Attribution.optional(),
});
export type MembershipEvent = z.infer<typeof MembershipEvent>;

/**
 * A log event the stream shows as a line between its messages (listStream
 * `events`, 2026-09-29): membership only in v1, the Matrix model — the fact
 * stays in the log and the client draws it, never a system message. Carries
 * its offset so a client merges it with the messages in log order.
 */
export const StreamEvent = z.object({
  offset: StreamOffset,
  at: z.iso.datetime(),
  event: z.discriminatedUnion('type', [MembershipEvent]),
});
export type StreamEvent = z.infer<typeof StreamEvent>;

/** Durable, offsetted facts. The feed's activity strand renders these (spec §7). */
export const SpaceEvent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('change'), changeSet: ChangeSet }),
  z.object({ type: z.literal('message'), message: Message }),
  /**
   * A topic's lifecycle: created (promote or from-scratch), retitled,
   * archived, unarchived, document attached/detached — the full row plus
   * who did it, so clients can render attributed lifecycle lines in the
   * thread. Idempotent re-archives emit nothing; a reply reviving an
   * archived topic emits 'unarchived' attributed to the replier.
   */
  z.object({
    type: z.literal('topic'),
    topic: Topic,
    action: z.enum(['created', 'retitled', 'archived', 'unarchived', 'document_attached', 'document_detached']),
    by: Attribution,
  }),
  /** The row deleted ("convert back to thread") — the thread itself is untouched. */
  z.object({ type: z.literal('topic_removed'), removal: TopicRemoval }),
  MembershipEvent,
  /** A reaction toggled on or off a message. Idempotent re-adds/re-removes emit nothing. */
  z.object({
    type: z.literal('reaction'),
    reaction: Reaction,
    action: z.enum(['added', 'removed']),
  }),
  /**
   * A message tombstoned by its author. The stored `message` event is
   * redacted in place (body '', deletedAt set) — the one mutation the log
   * allows, because deletion's whole point is that the content is gone,
   * replay included. This event is what live/folding clients apply.
   * Re-deleting is an idempotent no-op and emits nothing.
   */
  z.object({
    type: z.literal('message_deleted'),
    deletion: MessageDeletion,
  }),
  /**
   * A message body rewritten by its author. The stored `message` event is
   * rewritten in place (body + editedAt) — same posture as deletion: the old
   * text must be unrecoverable, replay included. Live/folding clients apply
   * this event; an identical-body edit emits nothing.
   */
  z.object({
    type: z.literal('message_edited'),
    edit: MessageEdit,
  }),
  /**
   * A vote toggled on or off a poll answer — reaction semantics (idempotent
   * re-adds/re-removes emit nothing). On single-select polls a vote move is
   * two events (removed, then added) appended under one space lock.
   */
  z.object({
    type: z.literal('poll_vote'),
    vote: PollVote,
    action: z.enum(['added', 'removed']),
  }),
  /**
   * The author ended a poll early. Natural expiry emits NO event — a poll is
   * closed the moment `expiresAt` passes, computed from data already on the
   * wire (lazy expiry, no server job). The stored `message` event keeps its
   * at-post poll; folding clients apply this to set `endedAt`.
   */
  z.object({
    type: z.literal('poll_ended'),
    end: PollEnd,
  }),
  /**
   * The space was renamed (api.ts renameSpace) — the full row plus who did
   * it, so clients update their listings and the feed can render an
   * attributed "renamed the space" line. Identical-name renames emit nothing.
   */
  z.object({
    type: z.literal('space_renamed'),
    space: Space,
    by: Attribution,
  }),
]);
export type SpaceEvent = z.infer<typeof SpaceEvent>;

/**
 * A member holds two independent leases per conversation: a human one
 * (viewing / typing, ended by `idle`) and an agent one (`agent_working`,
 * ended by `agent_idle`). Both frames carry the same memberId — the agent
 * acts as the member — so the end states must be distinct for receivers to
 * know which lease an `idle` closes.
 */
export const PresenceState = z.enum(['viewing', 'typing', 'agent_working', 'agent_idle', 'idle']);
export type PresenceState = z.infer<typeof PresenceState>;

/**
 * Why the org is telling you about a message (notifications, 2026-09-10):
 * a token named you, `@here` named everyone, it landed in your DM, or it is
 * a reply in a thread you follow. Priority in that order when several hold.
 * GitHub's inbox reasons, cut to what the org can decide today.
 */
export const NotifyReason = z.enum(['mention', 'here', 'dm', 'reply']);
export type NotifyReason = z.infer<typeof NotifyReason>;

/** Server → client frames. */
export const ServerFrame = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('event'),
    spaceId: SpaceId,
    offset: StreamOffset,
    at: z.iso.datetime(),
    event: SpaceEvent,
  }),
  /** Ephemeral; never replayed; no offset. */
  z.object({
    kind: z.literal('presence'),
    spaceId: SpaceId,
    memberId: MemberId,
    state: PresenceState,
    /** Scopes the state to one thread (its root message id); absent = the stream / space-wide. */
    threadRootId: MessageId.optional(),
    at: z.iso.datetime(),
  }),
  /** Acknowledges a subscription; replay (if any) starts immediately after this frame. */
  z.object({
    kind: z.literal('subscribed'),
    spaceId: SpaceId,
    /** The offset replay starts after — echo of `afterOffset`, or the current head when omitted. */
    fromOffset: StreamOffset,
  }),
  z.object({
    kind: z.literal('error'),
    spaceId: SpaceId.optional(),
    code: z.string(),
    message: z.string(),
  }),
  /**
   * Liveness beacon, sent to every connection every ~25s regardless of
   * subscriptions. Carries no state — its arrival IS the signal: clients
   * treat prolonged silence as a half-open socket (laptop sleep, network
   * change, a proxy vanishing without FIN) and bounce the connection, which
   * replays from the last seen offset. Pre-ping clients ignore unknown frame
   * kinds by contract, so this is a v0-legal addition.
   */
  z.object({ kind: z.literal('ping'), at: z.iso.datetime() }),
  /**
   * Addressed to a MEMBER, not a space: refresh joined-space listings when
   * someone adds you to a DM, or you self-join on another device (spec §5,
   * 2026-09-23). Ephemeral and never replayed: the membership row and joined
   * event are the durable truth. On receipt, refresh the listing and resume
   * the space subscription from the client's known offset, or 0 if unknown.
   * Pre-DM clients ignore unknown frame kinds by contract.
   */
  z.object({
    kind: z.literal('space_added'),
    spaceId: SpaceId,
    spaceKind: SpaceKind,
    /** Who put you here. */
    by: MemberId,
   
```

### Core Architecture Module: `apps/harbor/packages/protocol/src/fixtures.ts`
```
import { z } from 'zod';

// Golden merge fixtures (fixtures/merge/*.json). A conforming merge engine —
// stub or real — MUST produce exactly these outcomes. The engine is line-level
// three-way merge: base = the proposal's declared base version's content,
// current = the asset now (the earlier writer's result), proposed = the stale
// proposal's newContent. Outcome semantics match ProposeChangeResult.

export const MergeFixtureExpectation = z.discriminatedUnion('outcome', [
  z.object({
    outcome: z.literal('merged'),
    /** Exact content the engine must produce and store. */
    content: z.string(),
  }),
  z.object({
    outcome: z.literal('conflict'),
    /** 1-based inclusive line ranges of the BASE that collide. Order matters. */
    regions: z.array(
      z.object({
        baseStart: z.number().int().positive(),
        baseEnd: z.number().int().nonnegative(),
      }),
    ),
  }),
]);

export const MergeFixture = z.object({
  name: z.string(),
  description: z.string(),
  base: z.string(),
  /** Content as it exists now — the earlier, already-applied change-set's result. */
  current: z.string(),
  /** The stale proposal's full newContent (declared against `base`). */
  proposed: z.string(),
  expected: MergeFixtureExpectation,
});
export type MergeFixture = z.infer<typeof MergeFixture>;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1141** (2026-09-30): **Require a work directory before offering the harness in chat**
  *Symptoms*: ## What  The assistant can only reach for Claude Code or Codex when the chat has a directory to run in. Two ways a chat gets one: the user picks it with the folder button beside the composer, or it is a Code session / Project, which comes with its cwd pinned.  Without a directory, `code_agent_run` is no longer in the assistant's resolved tool set. Previously the run fell back to "the user's default code repo", which is not a choice the user made in that chat.  ## How  - `RealAgentResolver` already resolves both directory sources per turn: `codeCwd` (a Code session's pin, via `sessionCompositionPins`) and `userWorkDir` (the composer's folder, keyed by `workDirId`). A new `harnessAvailable()` drops the harness when neither is set. The tool registry resolves only persisted descriptors, so an absent tool is never offered to the model. - The gate is keyed on the `workspaceContext` trait, so agents that resolve their repo elsewhere keep the tool: the to-do item agent (its threads either pin a code session or use the default repo, as documented in `todo/agent.ts`) and background tasks. - The same filter runs where active skills re-attach tools, so a disk skill declaring `code_agent_run` cannot route around it. - `launch-code-task` is untouched: its repo comes from a background task's configured code project, not from the chat's directory. - `HARNESS_TOOL` is named in `base-tools.ts` so the base list and the gate cannot drift. - The skill catalog is built once per app state and canno

- **Issue #1140** (2026-09-30): **Agent members: the invocation contract and its implementation**
  *Symptoms*: ## What this is  This PR is the agent contract, together with its implementation, built one layer per commit and to be merged in one go. Replicas (#1130) will be redone on top of it afterwards.  | Commit | Layer | Status | |---|---|---| | 1 | **The contract:** SPEC §8 "Invoking agent members" and `invocation.ts` | done | | 2 | **Harbor:** invocations, the trigger, the queue, and the connector's routes, tested against a reference connector | done | | 3 | **App:** thread status, the waiting and refused lines, Stop, and the composer's options | done | | 4 | **Hermes connector:** the Rowboat plugin for Hermes (its own repo), and the Agents dialog that sets it up | done |  **Harbor decides; a connector carries out.** A connector is the adapter between Harbor and one kind of agent. It never re-decides a rule, so any rule here can change in Harbor without touching a connector.  The shape follows what agent integrations in chat already do. We checked the docs for the Slack integrations of Cursor, Codex, Replicas, Claude (Claude Code / Claude Tag), Devin, Hermes and OpenClaw, and Slack's own agent APIs. The product rules are in `apps/harbor/SPEC.md` §8, "Invoking agent members". The objects are in `packages/protocol/src/invocation.ts`.  ## 1. Invocation (Harbor → agent)  | Rule | v1 | Precedent | |---|---|---| | What a conversation is | A thread. Every top-level message starts one, in channels and DMs alike. The agent answers in the thread. | Every integration studied, and Slack's own

- **Issue #1139** (2026-09-29): **Make the Spaces roster the whole org**
  *Symptoms*: ## What changes  Everyone in an org can now find everyone else, people and agents, in "New message", "Add people" and mentions. Until now you could only find members you already shared a Space with. That made a new agent, which is in no Space yet, or a teammate you hadn't met in a Space, impossible to find, DM, mention or add.  This is Slack parity item 3, following [SPEC §5 answer 4](https://github.com/rowboatlabs/rowboat/blob/main/apps/harbor/SPEC.md#5-the-space): inside one org, the org is the trust boundary, as inside one Slack workspace.  ## Harbor  - **`listOrgMembers`** (`GET /v1/members`, and `list_members` without a Space) returns every member of the org, sorted by display name case-insensitively, with the id breaking ties. Every caller gets the same answer. It's still one statement: it uses the existing `listAllMembers`. - **The old "shares a Space with the caller" query is deleted.** It had no other caller. Guests, when built, bring that limit back. - **#1138's "owners see their own agents" clause** is no longer needed; this covers it. - **Nothing else widens:**   - DMs to any org member were already allowed   - mentions of a non-member are still dropped when the message is saved, and don't notify   - a Space's own member list (`listMembers`) is unchanged - **`list_members`**'s tool description now says "the whole org roster".  ## App  No structural change: the pickers already read this list, so they now reach the whole org. Out-of-date wording is updated: - the Ne

- **Issue #1138** (2026-09-29): **Give agent members owners and their own keys**
  *Symptoms*: ## What changes  Any person can now add an agent to an org, own it, and give it its own key. With that key, the agent reads, posts and listens in Spaces as itself, over REST, the live socket or MCP. This is the second step toward agents as members, after #1135 (agent members) and #1137 (Add people), and it's what a Hermes or OpenClaw bridge will connect with.  For example, Ramnique opens **Agents** in the server menu, adds "Hermes", and copies its key along with the server and MCP URLs. He adds Hermes to #payments with **Add people**, then points Claude Code at `/mcp` with the key. Claude Code's posts appear as Hermes, marked as an agent, not "Ramnique via …".  ## Harbor  - **Owner:** `Member.ownerId`, set when a person adds an agent. It's absent for people and for org-owned agents such as Replicas, which admins manage. - **Keys:** `rbk_` plus 256 random bits. The secret is returned once (`AgentKeySecret`), and the org keeps only its SHA-256. An agent can hold several keys, so rotation has no downtime. Last use is recorded at most hourly. - **One door for every face:** `bindAuth` resolves `rbk_` bearers ahead of the auth driver, so REST, the live face and MCP take the key with no face-specific code. A request on an agent key always acts as the agent, `direct`: the body's `actingMode`/`agentName` and MCP's `x-acting-mode`/`x-agent-name` are ignored. - **Rules** (`policy.ts`, pinned in `policy.test.ts`):   - Any person may add an agent; an agent may not.   - Only the owner crea

- **Issue #1137** (2026-09-29): **Add members to a space, and show join lines in the stream**
  *Symptoms*: ## What changes  Any member can now add existing members, people or agents, to a shared Space they're in. The stream now shows who joined, who left, and who added whom. This is Slack parity item 2b in `slack-parity.md`, and it's how agents will get into Spaces from the app.  For example, Ramnique opens #payments, clicks **Add people**, and picks Harsh and the Replicas agent. Both appear in the member list at once, #payments shows up in their sidebars, and the stream shows "Ramnique added Harsh" and "Ramnique added Replicas" between the messages.  ## Adding members  - **Route:** `POST /v1/spaces/:spaceId/members {memberIds}`, plus the `add_members` agent tool (gated as `prompt` in the app, like other writes). - **Who and where:** the caller must be a member of the Space. Browsing an open Space isn't enough. DMs refuse, because their membership is fixed. - **All or nothing:** an id that isn't an org member is `not_found`, and nothing is written. - **The log:** each member added gets the ordinary `membership` `joined` event. It now carries an optional `by`, the adder's `Attribution`, so an agent's add reads "via". `by` is absent when members act for themselves (accepting an invite, self-join, leaving), so older apps still read "joined". A new `added` action was rejected because older apps reject unknown values on live frames. - **Idempotent:** anyone already in is a no-op, and a request that adds nobody writes nothing, so it also passes a read-only org. - **No notification in v1

- **Issue #1135** (2026-09-29): **Add agent members to Harbor and mark them in the app**
  *Symptoms*: ## What changes  An agent can now be a member in its own right: marked as an agent, acting as itself, and joining Spaces the way a person does. It's the first step toward agents as members that teams can mention and DM, and the base Arjun's Replicas agent (#1130) builds on.  For example, an admin connects Replicas. The integration calls `createAgent({ displayName: 'Replicas' })` and adds the new member to #payments through ordinary membership. In the app, Replicas shows with a round avatar and an "agent" label. Its posts are attributed to its own member id, not to the admin who set it up.  ## Harbor  - **`Member.kind`** is `human | agent`. It defaults to `human`, so payloads from older servers still parse as people. - **Migration `024-agent-members`** adds the column and marks every existing member `human`. It also adds a check that an agent is never an admin: admin powers are membership and policy, so an admin agent could add itself to Spaces past the people who invoke it. - **Kind is fixed at creation.** `putMember` never updates it on conflict. - **`createAgent({ displayName })`** in `core/spaces.ts` mints an id, trims and validates the name, and respects the org's read-only limit. No route calls it yet: the integration that owns the agent does, and gates who may.  Left out on purpose, to be decided with the routes that need them: owner, the agent's own key, where it runs, and who may invoke it. Each is additive later.  ## App  Agents get a round avatar (people are square 

- **Issue #1134** (2026-09-29): **Fix link and code block boundaries in Spaces composer**
  *Symptoms*: Pasting a link in the Spaces composer kept subsequent typing inside the link, and applying a code block converted prose separated by Shift+Enter along with the code.  Stop inheriting link formatting at link boundaries. Isolate code blocks to the selection or current line, preserving surrounding prose; when the caret is in a paragraph without line breaks, insert an empty code block at the caret. The toolbar and keyboard shortcut use the same behavior in both the composer and message edit box.  Validation: - Composer editor and message edit-box suites: 59 tests passed, including new regression coverage for link pastes, mixed prose/code, keyboard shortcuts, and undo. - Renderer TypeScript check passed. - `git diff --check` passed. 

- **Issue #1124** (2026-09-24): **Spaces: Auto-route stream drafts with Jev (TypeSafe), with Preview and corrections**
  *Symptoms*: ## Summary  Adds Jev (TypeSafe's System One model) as a decision model and an **Auto** toggle on the Spaces stream composer. With Auto on, one request asks Jev where a draft belongs: the stream, or the recent message or open thread it continues. Code owns the thresholds; Jev never sees a thread id.  - **Jev integration**: core client for `POST /v1/systemone` (key in `~/.rowboat/config/typesafe.json` or `TYPESAFE_API_KEY`, 429/529 backoff, key verified on save), a pure question builder with unit tests, and IPC channels handled in both hosts. Settings card under Models > Decision Models, since Jev is a model but not a chat provider and never enters the pickers. - **Auto toggle** with two modes. **Preview** (the default) never posts on a first send: a thread pick opens the thread with the reply staged in its composer; a stream verdict stays in the stream composer under a notice, and sending again (or the notice's button) posts it. **Post** sends thread replies after a five-second Undo toast; Undo lands in the Preview flow. - **Corrections** live in the thread, not in a toast: a banner above the composer offers post to the stream instead, try another thread (Jev again with rejected threads excluded; nothing fitting leaves the reply where it is), or keep it as a draft. "Pick a thread" on a stream verdict opens a searchable picker of the same candidates Auto sees.  Routing thresholds: a thread wins only when Jev's probability for it and its "continues a conversation" judgment both 

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

### Incident Patch 1: `bddffa41` (2026-09-29)
**Commit Message**: Fix link and code block boundaries in Spaces composer (#1134)

**File**: `apps/x/apps/renderer/src/components/spaces/composer-editor.test.ts` (modified, +61/-0)
```diff
@@ -173,6 +173,67 @@ const nodeNames = (e: Editor) => e.state.doc.content.content.map((n) => n.type.n
 /** Keystrokes at the caret. (Any transaction lets StarterKit's TrailingNode add its empty paragraph after a trailing block.) */
 const type = (e: Editor, text: string) => e.view.dispatch(e.state.tr.insertText(text))
 
+describe('formatting boundaries', () => {
+    it.each(['text', 'html'])('typing after a pasted %s link stays outside the link', (format) => {
+        const e = makeEditor('')
+        e.commands.focus('end')
+        if (format === 'text') e.view.pasteText('https://example.com', pasteEvent())
+        else e.view.pasteHTML('<a href="https://example.com">docs</a>', pasteEvent())
+        type(e, ' normal text')
+        expect(e.state.doc.firstChild!.lastChild!.marks).toEqual([])
+        expect(e.view.dom.querySelector('a')?.textContent).toBe(format === 'text' ? 'https://example.com' : 'docs')
+    })
+
+    it('editing inside a link preserves its formatting', () => {
+        const e = makeEditor('[docs](https://example.com)')
+        e.commands.setTextSelection(3)
+        type(e, 'X')
+        expect(composerMarkdown(e)).toBe('[doXcs](https://example.com)')
+    })
+
+    it('opens an empty code block after prose and allows prose after it', () => {
+        const e = makeEditor('intro')
+        e.chain().focus('end').toggleCodeBlock().run()
+        type(e, 'code')
+        e.commands.exitCode()
+        type(e, 'after')
+        expect(composerMarkdown(e)).toBe('intro\n\n```\ncode\n```\n\nafter')
+    })
+
+    it('formats only the current line after Shift+Enter', () => {
+        const e = makeEditor('intro')
+        e.chain().focus('end').setHardBreak().run()
+        type(e, 'code')
+        e.commands.toggleCodeBlock()
+        expect(composerMarkdown(e)).toBe('intro\n\n```\ncode\n```')
+        e.commands.toggleCodeBlock()
+        expect(composerMarkdown(e)).toBe('intro\n\ncode')
+    })
+
+    it('opens an empty code block on a blank line after Shift+Enter', () => {
+        const e = makeEditor('intro')
+        e.chain().focus('end').setHardBreak().toggleCodeBlock().run()
+        type(e, 'code')
+        expect(composerMarkdown(e)).toBe('intro\n\n```\ncode\n```')
+    })
+
+    it('the code block shortcut preserves prose above and below the current line', () => {
+        const e = makeEditor('**intro**\ncode\n*after*')
+        e.commands.setTextSelection(9)
+        e.commands.keyboardShortcut('Mod-Alt-Shift-c')
+        expect(composerMarkdown(e)).toBe('**intro**\n\n```\ncode\n```\n\n*after*')
+    })
+
+    it('converts selected text while preserving surrounding prose', () => {
+        const e = makeEditor('intro\ncode\nafter')
+        e.commands.setTextSelection({ from: 7, to: 11 })
+        e.commands.toggleCodeBlock()
+        expect(composerMarkdown(e)).toBe('intro\n\n```\ncode\n```\n\nafter')
+        e.commands.undo()
+        expect(composerMarkdown(e)).toBe('intro\ncode\nafter')
+    })
+})
+
 describe('fenced code', () => {
     it('a plain-text paste with a fence becomes a code block — lines, blank lines and the language kept, the prose around it literal', () => {
         const e = makeEditor('')
```

**File**: `apps/x/apps/renderer/src/components/spaces/composer-editor.ts` (modified, +62/-9)
```diff
@@ -1,4 +1,4 @@
-import { Extension, Node, mergeAttributes, type Editor } from '@tiptap/core'
+import { Extension, Node, mergeAttributes, type Editor, type Command } from '@tiptap/core'
 import { Fragment, Slice, type Mark, type Node as ProseMirrorNode, type NodeType, type Schema } from '@tiptap/pm/model'
 import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
 import StarterKit from '@tiptap/starter-kit'
@@ -60,18 +60,70 @@ function serializeHardBreak(
     }
 }
 
-/**
- * StarterKit owns the hardBreak node and doesn't re-export it, so the kit is
- * re-wrapped to hand that one extension the markdown spec above —
- * tiptap-markdown reads an extension's own spec before falling back to its
- * default, and everything else in the kit passes through untouched.
- */
+// 2026-09-29: Chat newlines are hard breaks; isolate code from surrounding
+// prose instead of letting the block command convert the entire paragraph.
+function chatCodeBlock(fallback: Command, attrs?: { language: string }): Command {
+    return (props) => {
+        const { state, tr, dispatch } = props
+        const { $from, $to, empty } = state.selection
+        if ($from.depth !== 1 || !$from.sameParent($to) || $from.parent.type.name !== 'paragraph') {
+            return fallback(props)
+        }
+        const paragraph = $from.parent
+        let from = $from.parentOffset
+        let to = $to.parentOffset
+        if (empty) {
+            let lineStart = 0
+            let lineEnd = paragraph.content.size
+            let hasBreak = false
+            paragraph.forEach((child, offset) => {
+                if (child.type.name !== 'hardBreak') return
+                hasBreak = true
+                if (offset < from) lineStart = offset + child.nodeSize
+                else if (lineEnd === paragraph.content.size) lineEnd = offset
+            })
+            if (hasBreak) {
+                from = lineStart
+                to = lineEnd
+            }
+        }
+        const code = paragraph.textBetween(from, to, '\n', '\n')
+        let before = paragraph.content.cut(0, from)
+        let after = paragraph.content.cut(to)
+        if (before.lastChild?.type.name === 'hardBreak') before = before.cut(0, before.size - 1)
+        if (after.firstChild?.type.name === 'hardBreak') after = after.cut(1)
+        const blocks: ProseMirrorNode[] = []
+        if (before.size) blocks.push(paragraph.copy(before))
+        const codeAt = $from.before() + blocks.reduce((size, node) => size + node.nodeSize, 0)
+        blocks.push(state.schema.nodes.codeBlock!.create(attrs, code ? state.schema.text(code) : null))
+        if (after.size) blocks.push(paragraph.copy(after))
+        if (dispatch) {
+            tr.replaceWith($from.before(), $from.after(), blocks)
+            tr.setSelection(TextSelection.create(tr.doc, codeAt + 1 + code.length))
+            tr.setStoredMarks([])
+        }
+        return true
+    }
+}
+
+// 2026-09-29: Override the kit-owned nodes so chat line boundaries and
+// Markdown serialization agree without registering duplicate extensions.
 const ChatStarterKit = StarterKit.extend({
     addExtensions() {
         return (this.parent?.() ?? []).map((extension) =>
             extension.name === 'hardBreak'
                 ? extension.extend({ addStorage: () => ({ markdown: { serialize: serializeHardBreak, parse: {} } }) })
-                : extension,
+                : extension.name === 'codeBlock'
+                    ? extension.extend({
+                        addCommands() {
+                            const parent = this.parent!()
+                            return {
+                                ...parent,
+                                toggleCodeBlock: (attrs) => chatCodeBlock(parent.toggleCodeBlock!(attrs), attrs),
+                            }
+                        },
+                    })
+                    : extension,
         )
     },
 })
@@ -478,7 +530,8 @@ const CodeFences = Extension.cr
```

---

### Incident Patch 2: `0cd2aca4` (2026-09-21)
**Commit Message**: harbor: retire the memory store — one Postgres driver, PGlite for dev and tests

The Store interface has 80 methods. pg-store.ts implemented them in SQL;
memory-store.ts implemented them again in 821 lines of TypeScript that
re-derived SQL semantics by hand (listActivity's kind priority + cursor +
unread join, readAllThreads, listUnreadFollowedThreads, refreshReplyStats,
searchAssets). Every store change was written twice, and the broadest
tests — api, ws, mcp, auth-oidc, consent, push — ran only on the driver
that never ships. The publish-after-commit test faked its commit counter
on the memory mutex; no transaction was ever opened.

PGlite is Postgres compiled to WASM, in-process, ~0.6s to boot with the
real migrations. It was already the store of 16 test files.

- memory-store.ts deleted. `startHarbor` requires `store`; nothing defaults
  silently.
- src/sql-pglite.ts (moved from test/pglite.ts): the SqlDb boundary over
  PGlite. `pnpm dev` without DATABASE_URL boots on it — same "restart =
  clean slate" — loaded by dynamic import on that path only, so deployment
  mode never touches the WASM. @electric-sql/pglite becomes a dependency
  because main.ts imports it at runtime. Th

**File**: `apps/harbor/CONTRACT.md` (modified, +15/-10)
```diff
@@ -12,9 +12,10 @@
 
 ## The stub Harbor (`packages/server`)
 
-The in-memory reference implementation that unblocks client work. One process =
-one org; restart = clean slate. `pnpm dev` boots it on port 4272 seeded with the
-team and a Roadboard space (`src/main.ts`).
+The server. One process = one org (`startHarbor`) or one deployment of many
+(`deployment.ts`). `pnpm dev` boots a single seeded org on port 4272 — the team
+and a Roadboard space (`src/main.ts`) — on PGlite in-memory (restart = clean
+slate), or on durable Postgres with `DATABASE_URL`.
 
 - **One core, three doors.** `service.ts` is the single implementation; `http.ts`
   (every route in `api.ts`), `ws.ts` (`/v1/live`, subscribe/replay/live frames),
@@ -81,12 +82,16 @@ team and a Roadboard space (`src/main.ts`).
   at the org address (consent redirect target = site_url +
   authorization_url_path). Live-verified: a real DCR + PKCE authorize 302s
   onto this route, and the page's exact fetch sequence completes the dance.
-- **Storage**: `store.ts` is the data-access boundary, `memory-store.ts` the
-  stub driver. The real Harbor lands a **Postgres-only** driver — no S3 in v1:
-  contents are ≤1MB text riding in the change-set log rows; current state,
-  history, feed, and the event stream are all projections of that log.
-  `withSpaceLock` becomes a transaction; the hub becomes LISTEN/NOTIFY when we
-  ever scale past one node (deferred).
+- **Storage**: `store.ts` is the data-access boundary and `pg-store.ts` its
+  one driver — Postgres, no S3 for text in v1: contents are ≤1MB text riding in
+  the change-set log rows; current state, history, feed, and the event stream
+  are all projections of that log. `withSpaceLock` is a transaction holding a
+  per-space advisory lock. The same driver runs in-process on PGlite
+  (`sql-pglite.ts`) for `pnpm dev` and for every test — real migrations, real
+  SQL, real transactions. The memory driver was retired 2026-09-21: two
+  implementations of an 80-method interface meant every store change written
+  twice, and the broadest tests proving the driver that never shipped. The hub
+  becomes LISTEN/NOTIFY when we ever scale past one node (deferred).
 - **Blob store primitive** (`blobs.ts` + `blobs-disk.ts` + `blobs-s3.ts`):
   the spec §6 storage shape for binary/large assets, built ahead of the
   feature. Content-addressed (sha256), four-method interface, two drivers —
@@ -303,6 +308,6 @@ Amended 2026-09-07 (push notifications, PUSH_PLAN.md): phones register an **Expo
 
 1. ~~`packages/server`: the **in-memory stub Harbor**~~ — done: every route in `api.ts`, the WS frames in `events.ts`, the MCP tools, a merge engine passing the fixtures, fake single-org auth, and spec §11 running as an automated acceptance test.
 2. ~~`apps/x`: the client chain against the stub~~ — done: `packages/core/src/spaces/` (SpacesClient + SpacesLive + org registry, tested against the real stub), `spaces:*` IPC, functional renderer surfaces (design pass pending), and org-add auto-registering the MCP face in `mcp.json` so the user's own agent gets the spaces tools. Note: consumption ended up as `link:` (not `file:`) — pnpm copies `file:` deps at install time, which goes stale during active co-development. **zod must stay version-identical across apps/x and apps/harbor** (pinned 4.2.1) or type identity breaks across the link.
-3. ~~Postgres storage~~ — done: `pg-store.ts` implements the Store boundary over a minimal SQL adapter (`sql.ts`; node-postgres for deployments, in-process PGlite for hermetic tests). `withSpaceLock` = one transaction holding a per-space advisory lock, with every store call inside riding that transaction (AsyncLocalStorage). **The §11 day-in-the-life suite runs twice — memory and Postgres — with identical assertions**; that dual run is the storage-swap gate, permanently. `DATABASE_URL` flips `pnpm dev` to durable storage (seeding is restart-idempotent). Postgres-only on purpose: no S3 in v1 — ≤1MB text contents ride in t
```

**File**: `apps/harbor/packages/server/package.json` (modified, +1/-1)
```diff
@@ -17,6 +17,7 @@
   "dependencies": {
     "@aws-sdk/client-s3": "^3.1116.0",
     "@aws-sdk/s3-request-presigner": "^3.1116.0",
+    "@electric-sql/pglite": "^0.5.5",
     "@hono/node-server": "^1.14.0",
     "@modelcontextprotocol/sdk": "^1.25.1",
     "@rowboat/spaces-protocol": "workspace:*",
@@ -29,7 +30,6 @@
     "zod": "4.2.1"
   },
   "devDependencies": {
-    "@electric-sql/pglite": "^0.5.5",
     "@types/node": "^24.0.0",
     "@types/pg": "^8.21.0",
     "@types/ws": "^8.18.1",
```

**File**: `apps/harbor/packages/server/src/activity-sort.ts` (modified, +0/-6)
```diff
@@ -4,9 +4,3 @@ import type { ActivityRow } from './store.js';
 export function sortActivity(rows: ActivityRow[]): ActivityRow[] {
   return rows.sort((a, b) => (a.at === b.at ? (a.id < b.id ? 1 : a.id > b.id ? -1 : 0) : a.at < b.at ? 1 : -1));
 }
-
-/** Is the row strictly older than the cursor, in that same order? */
-export function olderThan(row: { at: string; id: string }, before: { at: string; id: string } | undefined): boolean {
-  if (!before) return true;
-  return row.at < before.at || (row.at === before.at && row.id < before.id);
-}
```

**File**: `apps/harbor/packages/server/src/blobs.ts` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ export interface BlobStore {
   ): Promise<string>;
 }
 
-/** In-memory driver — tests and the dev stub (restart = clean slate, matching MemoryStore). */
+/** In-memory driver — tests and `pnpm dev` (restart = clean slate). */
 export class MemoryBlobStore implements BlobStore {
   private blobs = new Map<string, Uint8Array>();
 
```

**File**: `apps/harbor/packages/server/src/index.ts` (modified, +5/-4)
```diff
@@ -1,19 +1,20 @@
-// @rowboat/harbor — the spaces server. Currently the in-memory stub that
-// unblocks client work (CONTRACT.md "Next" step 1); the real Harbor grows here
-// behind the same contract, starting with a Postgres Store.
+// @rowboat/harbor — the spaces server: one service core behind the
+// @rowboat/spaces-protocol contract, three faces (REST, live, MCP), one
+// Postgres store — node-postgres in deployments, in-process PGlite for dev and tests.
 
 export { startHarbor } from './server.js';
 export type { HarborOptions, RunningHarbor, SeedMember, SeedSpace } from './server.js';
 export { HarborService } from './service.js';
 export type { ActorCtx, OrgInfo } from './service.js';
-export { MemoryStore } from './memory-store.js';
 export { PgStore } from './pg-store.js';
 export { blobHash, BLOB_HASH_RE } from './blobs.js';
 export type { BlobStore } from './blobs.js';
 export { DiskBlobStore } from './blobs-disk.js';
 export { S3BlobStore } from './blobs-s3.js';
 export type { S3BlobStoreOptions } from './blobs-s3.js';
 export { postgresDb } from './sql.js';
+/** Postgres in-process — the store dev and tests run on, this package's and its consumers' (apps/x core). */
+export { pgliteDb } from './sql-pglite.js';
 export type { SqlDb, SqlExecutor } from './sql.js';
 export type { Store, StoredEvent, StoredInvite, AssetRecord } from './store.js';
 export { SpaceHub } from './hub.js';
```

---

### Incident Patch 3: `2fdae425` (2026-09-17)
**Commit Message**: Merge pull request #1089 from rowboatlabs/fix/child-server-posthog

fix(analytics): configure PostHog in packaged child server

**File**: `apps/x/ANALYTICS.md` (modified, +15/-11)
```diff
@@ -1,18 +1,18 @@
 # Analytics
 
-> PostHog instrumentation for `apps/x`. We capture LLM token usage (broken down by feature) and identity/auth events. Renderer (`posthog-js`) and main (`posthog-node`) share one stable distinct_id and one identified user, so events from either process resolve to the same person.
+> PostHog instrumentation for `apps/x`. We capture LLM token usage (broken down by feature) and identity/auth events. Renderer (`posthog-js`), main, and the local child server (`posthog-node`) share the installation identity. Each Node process has its own PostHog client; the process hosting core identifies the user for agent events.
 
 ## Identity model
 
 - **Anonymous distinct_id** = `installationId` from `~/.rowboat/config/installation.json` (auto-generated on first run; see `packages/core/src/analytics/installation.ts`).
 - Renderer fetches it from main on startup via the `analytics:bootstrap` IPC channel and passes it as PostHog's `bootstrap.distinctID`. Main uses it directly in `posthog-node`.
-- **On rowboat sign-in**: `posthog.identify(rowboatUserId)` runs in **both** processes.
-  - Main does it from `apps/main/src/oauth-handler.ts:285` (after `getBillingInfo()` resolves) — this is the load-bearing call, since main always runs.
+- **On rowboat sign-in**: core identifies the user in the process hosting agent work (the child server by default).
+  - `packages/core/src/auth/oauth-flows.ts` calls `identify` after `getBillingInfo()` resolves.
   - Renderer mirrors via `apps/renderer/src/hooks/useAnalyticsIdentity.ts` listening on the `oauth:didConnect` IPC event.
-  - Main also calls `alias()` so events emitted under the anonymous installation_id are linked to the identified user retroactively.
-- **On every app startup**: main re-identifies if rowboat tokens exist (`packages/core/src/analytics/identify.ts`, called from `apps/main/src/main.ts` whenReady). Idempotent — PostHog merges person properties on duplicate identifies. This catches users who installed before analytics existed, and refreshes person properties (plan/status) on every launch.
-- **On rowboat sign-out**: `posthog.reset()` in both processes; future events resolve to the installation_id again.
-- **`email`** is set on `identify` from main only (sourced from `/v1/me`). Person properties are server-side, so the renderer's events resolve to the same record without redundantly setting it.
+  - The core PostHog client also calls `alias()` so events emitted under the anonymous installation_id are linked to the identified user retroactively.
+- **On every app startup**: main and the child server each call `identifyIfSignedIn()` from `packages/core/src/analytics/identify.ts`. The child calls it after config initialization without blocking boot. Idempotent — PostHog merges person properties on duplicate identifies. This catches users who installed before analytics existed, and refreshes person properties (plan/status) on every launch.
+- **On rowboat sign-out**: the renderer resets identity and core OAuth resets its local PostHog identity; future core events resolve to the installation_id again.
+- **`email`** is set on `identify` by the Node PostHog client (sourced from `/v1/me`). Person properties are server-side, so the renderer's events resolve to the same record without redundantly setting it.
 
 ## Event catalog
 
@@ -289,11 +289,14 @@ PostHog credentials live in two env vars (also baked into the binary at packagin
 
 Where they're consumed:
 - **Renderer** (Vite): `import.meta.env.VITE_PUBLIC_POSTHOG_*` — inlined at build time.
-- **Main** (esbuild via `apps/main/bundle.mjs`): inlined into `main.cjs` at packaging time using esbuild `define`. In dev (`npm run dev`), main reads them from `process.env` at runtime.
+- **Main and child server** (esbuild via `apps/main/bundle.mjs` and `bundle-config.mjs`): the same key, host, and app version are inlined into both `main.cjs` and `rowboat-server.cjs`. Setting build-time values only for main does not configur
```

**File**: `apps/x/apps/main/bundle-config.mjs` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+// Shared by both desktop processes: installed apps do not inherit CI's env.
+export function desktopBundleDefines(appVersion) {
+  return {
+    'process.env.POSTHOG_KEY': JSON.stringify(process.env.VITE_PUBLIC_POSTHOG_KEY ?? ''),
+    'process.env.POSTHOG_HOST': JSON.stringify(process.env.VITE_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'),
+    'process.env.ROWBOAT_APP_VERSION': JSON.stringify(appVersion ?? ''),
+  };
+}
+
+export function childServerBundleOptions(appVersion) {
+  return {
+    entryPoints: ['../server/dist/standalone.js'],
+    bundle: true,
+    platform: 'node',
+    target: 'node20',
+    format: 'cjs',
+    outfile: './.package/dist/rowboat-server.cjs',
+    // Core modules resolve asset paths through import.meta.url at module init.
+    banner: { js: `var __import_meta_url = require('url').pathToFileURL(__filename).href;` },
+    define: {
+      'import.meta.url': '__import_meta_url',
+      ...desktopBundleDefines(appVersion),
+    },
+    external: ['electron', 'node-pty', 'uiohook-napi', 'bun:sqlite'],
+  };
+}
```

**File**: `apps/x/apps/main/bundle.mjs` (modified, +3/-20)
```diff
@@ -10,6 +10,7 @@
  */
 
 import * as esbuild from 'esbuild';
+import { desktopBundleDefines, childServerBundleOptions } from './bundle-config.mjs';
 import { readFile } from 'node:fs/promises';
 import { execSync } from 'node:child_process';
 import fs from 'node:fs';
@@ -42,12 +43,7 @@ await esbuild.build({
   // Replace import.meta.url directly with our polyfill variable
   define: {
     'import.meta.url': '__import_meta_url',
-    // Inject PostHog credentials at build time. Reuse the renderer's
-    // VITE_PUBLIC_* envs so packaging only needs one set of values.
-    // Empty strings disable analytics gracefully.
-    'process.env.POSTHOG_KEY': JSON.stringify(process.env.VITE_PUBLIC_POSTHOG_KEY ?? ''),
-    'process.env.POSTHOG_HOST': JSON.stringify(process.env.VITE_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'),
-    'process.env.ROWBOAT_APP_VERSION': JSON.stringify(pkg.version ?? ''),
+    ...desktopBundleDefines(pkg.version),
   },
 });
 
@@ -162,20 +158,7 @@ if (process.platform === 'darwin') {
 // Bundle the standalone rowboat-server (spawned as a child with
 // ELECTRON_RUN_AS_NODE in child-server mode). node-pty stays external like
 // in the main bundle and ships from .package/node_modules.
-await esbuild.build({
-  entryPoints: ['../server/dist/standalone.js'],
-  bundle: true,
-  platform: 'node',
-  target: 'node20',
-  format: 'cjs',
-  outfile: './.package/dist/rowboat-server.cjs',
-  // Same import.meta.url polyfill as main.cjs — core modules resolve asset
-  // paths through it at module init; without the define the CJS bundle sees
-  // undefined and crashes before the server can boot.
-  banner: { js: cjsBanner },
-  define: { 'import.meta.url': '__import_meta_url' },
-  external: ['electron', 'node-pty', 'uiohook-napi', 'bun:sqlite'],
-});
+await esbuild.build(childServerBundleOptions(pkg.version));
 console.log('✅ rowboat-server bundled to .package/dist/rowboat-server.cjs');
 
 // Bundle the vendored agent-slack CLI into a single self-contained script next
```

**File**: `apps/x/apps/server/src/child-analytics.test.js` (added, +94/-0)
```diff
@@ -0,0 +1,94 @@
+import { execFile } from 'node:child_process';
+import { once } from 'node:events';
+import { mkdtemp, rm } from 'node:fs/promises';
+import { createServer } from 'node:http';
+import { tmpdir } from 'node:os';
+import path from 'node:path';
+import { fileURLToPath } from 'node:url';
+import { promisify } from 'node:util';
+import { build } from 'esbuild';
+import { afterEach, expect, it, vi } from 'vitest';
+import { childServerBundleOptions } from '../../main/bundle-config.mjs';
+
+const execFileAsync = promisify(execFile);
+const analyticsDir = fileURLToPath(new URL('../../../packages/core/src/analytics/', import.meta.url));
+afterEach(() => vi.unstubAllEnvs());
+
+it.each([true, false])('packaged child delivers analytics without runtime credentials (enabled=%s)', async (enabled) => {
+  const batches = [];
+  const receiver = createServer(async (req, res) => {
+    const chunks = [];
+    for await (const chunk of req) chunks.push(chunk);
+    if (req.url === '/batch/') batches.push(JSON.parse(Buffer.concat(chunks).toString()));
+    res.writeHead(200, { 'Content-Type': 'application/json' });
+    res.end('{}');
+  });
+  receiver.listen(0, '127.0.0.1');
+  await once(receiver, 'listening');
+  const directory = await mkdtemp(path.join(tmpdir(), 'rowboat-child-analytics-'));
+  try {
+    vi.stubEnv('VITE_PUBLIC_POSTHOG_KEY', enabled ? 'phc_packaging_test' : '');
+    vi.stubEnv('VITE_PUBLIC_POSTHOG_HOST', `http://127.0.0.1:${receiver.address().port}`);
+    // Production child bundle settings and real PostHog SDK; account/disk
+    // dependencies are fixtures so no app data or real API is used.
+    const options = childServerBundleOptions('9.8.7');
+    delete options.entryPoints;
+    const outfile = path.join(directory, 'analytics.cjs');
+    await build({
+      ...options,
+      outfile,
+      stdin: {
+        resolveDir: analyticsDir,
+        contents: `
+          import { identifyIfSignedIn } from './identify.ts';
+          import { capture, reset, shutdown } from './posthog.ts';
+          async function main() {
+            await identifyIfSignedIn();
+            capture('spaces_rowboat_invoked', { queued: false });
+            capture('spaces_rowboat_message_posted');
+            reset();
+            capture('after_sign_out');
+            await shutdown();
+            process.exit(0);
+          }
+          main().catch((err) => { console.error(err); process.exit(1); });
+        `,
+      },
+      plugins: [{
+        name: 'isolated-account',
+        setup(builder) {
+          const fixtures = {
+            './installation.js': "export const getInstallationId = () => 'test-installation';",
+            '../config/env.js': "export const API_URL = 'https://api.example.test';",
+            '../account/account.js': 'export const isSignedIn = async () => true;',
+            '../billing/billing.js': "export const getBillingInfo = async () => ({ userId: 'test-user', userEmail: 'test@example.test' });",
+          };
+          builder.onResolve({ filter: /(?:installation|env|account|billing)\.js$/ }, (args) =>
+            fixtures[args.path] ? { path: args.path, namespace: 'fixture' } : undefined);
+          builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({ contents: fixtures[args.path] }));
+        },
+      }],
+    });
+    const env = { ...process.env };
+    for (const key of ['POSTHOG_KEY', 'POSTHOG_HOST', 'VITE_PUBLIC_POSTHOG_KEY', 'VITE_PUBLIC_POSTHOG_HOST', 'ROWBOAT_APP_VERSION', 'npm_package_version']) delete env[key];
+    const { stderr } = await execFileAsync(process.execPath, [outfile], { env, timeout: 8000 });
+    expect(stderr).toBe('');
+    if (!enabled) {
+      expect(batches).toEqual([]);
+      return;
+    }
+    expect(batches.length).toBeGreaterThan(0);
+    expect(batches.every((batch) => batch.api_key === 'phc_packaging_test')).toBe(true);
+    const events = batches.flatMap((batch) => batch.batch);
+    for (const event of ['spac
```

**File**: `apps/x/apps/server/src/standalone.ts` (modified, +11/-2)
```diff
@@ -1,4 +1,6 @@
 import process from 'node:process';
+import { identifyIfSignedIn } from '@x/core/dist/analytics/identify.js';
+import { shutdown as shutdownAnalytics } from '@x/core/dist/analytics/posthog.js';
 import { WorkDir } from '@x/core/dist/config/config.js';
 import { initConfigs } from '@x/core/dist/config/initConfigs.js';
 import container, {
@@ -34,6 +36,9 @@ async function main(): Promise<void> {
   // The workdir lock is acquired by createRowboatServer itself — a live
   // Electron-hosted transport makes this boot fail loudly, as it must.
   await initConfigs();
+  // Core analytics lives in this process. Restore identity on cold starts;
+  // sign-in/out changes are already handled by core's OAuth flows.
+  void identifyIfSignedIn();
   // Client capabilities route over the WS as reverse calls (RFC Q14): the
   // connected client that advertises each capability performs it.
   const broker = capabilityBroker();
@@ -109,8 +114,12 @@ async function main(): Promise<void> {
   const shutdown = async () => {
     // Never let a stuck teardown keep the process alive — exit regardless.
     setTimeout(() => process.exit(0), 5000).unref();
-    await server.close();
-    process.exit(0);
+    try {
+      await server.close();
+    } finally {
+      await shutdownAnalytics();
+      process.exit(0);
+    }
   };
   process.on('SIGINT', () => void shutdown());
   process.on('SIGTERM', () => void shutdown());
```

---

### Incident Patch 4: `c771b824` (2026-09-15)
**Commit Message**: fix(renderer): preserve chat when sidebar is hidden

**File**: `apps/x/apps/renderer/src/App.tsx` (modified, +12/-7)
```diff
@@ -5463,13 +5463,17 @@ function App() {
   }, [bindChatToRun, showChatInSidebar])
   openRunInSidebarRef.current = openRunInSidebar
 
-  // Cmd+L: the sidebar container. Occupied → its chat goes away (history
-  // keeps it); on the Assistant page → that chat moves over; else a fresh one.
+  // Cmd+L hides the sidebar without closing its chat. The same tab and session
+  // return when it is reopened, just as the Assistant page does after navigation.
   const toggleChatSidebar = useCallback(() => {
-    if (assistantLayout.sidebar) closeAssistantChat(assistantLayout.sidebar)
+    if (assistantLayout.sidebar && assistantLayout.sidebarVisible) dispatchAssistantLayout({ type: 'hide-sidebar' })
+    else if (assistantLayout.sidebar) {
+      dispatchAssistantLayout({ type: 'show-sidebar' })
+      switchChatTab(assistantLayout.sidebar)
+    }
     else if (isFullScreenChat && assistantLayout.assistant) moveAssistantChat(assistantLayout.assistant, 'sidebar')
     else newChatAt('sidebar')
-  }, [assistantLayout.sidebar, assistantLayout.assistant, isFullScreenChat, closeAssistantChat, moveAssistantChat, newChatAt])
+  }, [assistantLayout.sidebar, assistantLayout.sidebarVisible, assistantLayout.assistant, isFullScreenChat, switchChatTab, moveAssistantChat, newChatAt, dispatchAssistantLayout])
 
   const selectChatAt = useCallback((id: string, location: ChatLocation, replacing?: string) => {
     let tab = chatTabsRef.current.find((entry) => entry.id === id || entry.runId === id)
@@ -7217,7 +7221,7 @@ function App() {
     return () => observer.disconnect()
   }, [projectViewActive])
   const projectDocumentOnly = projectViewActive && !!selectedPath && projectContentWidth < 840
-  const chatPaneOpen = projectViewActive ? !!projectChatId && !projectDocumentOnly : isCodeOpen ? codeChatMain : !!assistantLayout.sidebar
+  const chatPaneOpen = projectViewActive ? !!projectChatId && !projectDocumentOnly : isCodeOpen ? codeChatMain : !!assistantLayout.sidebar && assistantLayout.sidebarVisible
   // The document pane shares the window with a docked chat (not maximized
   // over it, not floating above it). The editor reads this to step its
   // headings down so they sit level with chat prose.
@@ -7491,7 +7495,7 @@ function App() {
                   </Tooltip>
                 )}
                 {isWorkspaceOpen && selectedPath && <button aria-label="Close document" title="Close document" className="titlebar-no-drag rounded p-2 hover:bg-accent" onClick={() => { void navigateToView({ type: 'workspace', path: workspaceInitialPath ?? undefined, runId: projectChatId ?? undefined }) }}><X className="size-4" /></button>}
-                {!assistantLayout.sidebar && (
+                {!assistantLayout.sidebarVisible && (
                   <Tooltip>
                     <TooltipTrigger asChild>
                       <button
@@ -8046,7 +8050,8 @@ function App() {
               <AssistantWorkspace
                 layout={assistantLayout} dispatch={dispatchAssistantLayout} pageHost={assistantPageHost} pageVisible={activeMiddle === 'chat'}
                 legacyPane={projectViewActive || isCodeOpen} workspaceSessionId={projectViewActive ? projectChatId : activeCodeSession?.session.id ?? null}
-                onMoveChat={moveAssistantChat} onNewChatAt={newChatAt} onSelectChatAt={selectChatAt} onFocusChat={switchChatTab} onCloseChat={closeAssistantChat}
+                onMoveChat={moveAssistantChat} onNewChatAt={newChatAt} onSelectChatAt={selectChatAt} onFocusChat={switchChatTab}
+                onHideSidebar={() => dispatchAssistantLayout({ type: 'hide-sidebar' })} onCloseChat={closeAssistantChat}
                 onSubmitForTab={(id, message, mentions, attachments, search, mode, permission) => handlePromptSubmit(message, mentions, attachments, search, mode, permission, id)}
                 voiceOwner={voiceOwner} callChatId={hoverRunId}
                 onStartRecordingForTab={(id) => { switchChatTab(id); handleStartRecording(chatIdForTab(i
```

**File**: `apps/x/apps/renderer/src/components/assistant/assistant-workspace.test.tsx` (modified, +10/-2)
```diff
@@ -32,12 +32,14 @@ function Harness({ onResize }: { onResize?: (size: WindowSize) => void } = {}) {
   return <>
     <div ref={setHost} aria-label="Assistant page" />
     {['b', 'c'].map((id) => <button key={id} onClick={() => dispatch({ type: 'place', id, location: 'floating', size })}>Float {id}</button>)}
+    <button onClick={() => dispatch({ type: 'show-sidebar' })}>Show sidebar</button>
     <AssistantWorkspace {...services} layout={layout} dispatch={(action) => {
       if (action.type === 'resize') onResize?.(action.size)
       dispatch(action)
     }} pageHost={host} pageVisible legacyPane={false}
-      onMoveChat={(id, location) => dispatch({ type: 'place', id, location, size })} onCloseChat={(id) => dispatch({ type: 'close', id })}
-      onNewChatAt={vi.fn()} onSelectChatAt={vi.fn()} onFocusChat={vi.fn()} />
+    onMoveChat={(id, location) => dispatch({ type: 'place', id, location, size })} onCloseChat={(id) => dispatch({ type: 'close', id })}
+    onHideSidebar={() => dispatch({ type: 'hide-sidebar' })}
+    onNewChatAt={vi.fn()} onSelectChatAt={vi.fn()} onFocusChat={vi.fn()} />
   </>
 }
 afterEach(cleanup)
@@ -69,6 +71,12 @@ describe('assistant workspace containers', () => {
     expect(closeSidebar).toBeVisible()
     expect(closeSidebar.closest('[data-chat-header]')).not.toBeNull()
     expect(screen.queryByLabelText('Close chat')).not.toBeInTheDocument()
+    fireEvent.click(closeSidebar)
+    expect(screen.queryByLabelText('Chat sidebar')).not.toBeInTheDocument()
+    // Restoring the container retains the portal and its local draft state.
+    fireEvent.click(screen.getByText('Show sidebar'))
+    expect(screen.getByLabelText('Draft')).toBe(input)
+    expect(screen.getByLabelText('Draft')).toHaveValue('Keep my unsent draft')
     fireEvent.click(screen.getByText('Move to floating'))
     expect(screen.queryByLabelText('Chat sidebar')).not.toBeInTheDocument()
     expect(screen.getByLabelText('Draft')).toBe(input)
```

**File**: `apps/x/apps/renderer/src/components/assistant/assistant-workspace.tsx` (modified, +4/-3)
```diff
@@ -21,6 +21,7 @@ interface AssistantWorkspaceProps extends ChatServices {
   onNewChatAt: (location: ChatLocation, replacing?: string) => void
   onSelectChatAt: (id: string, location: ChatLocation, replacing?: string) => void
   onFocusChat: (id: string) => void
+  onHideSidebar: () => void
   onCloseChat: (id: string) => void
 }
 
@@ -141,7 +142,7 @@ export function AssistantWorkspace(p: AssistantWorkspaceProps) {
   const close = p.onCloseChat
   return <>
     {p.legacyPane && <WorkspaceChatAdapter services={p} sessionId={p.workspaceSessionId ?? null} onFocus={p.onFocusChat} />}
-    {layout.sidebar && <aside aria-label="Chat sidebar" className="order-4 flex min-h-0 shrink-0 flex-col border-l border-border bg-background" style={{ width: sidebarWidth, maxWidth: '65vw' }}>
+    {layout.sidebar && layout.sidebarVisible && <aside aria-label="Chat sidebar" className="order-4 flex min-h-0 shrink-0 flex-col border-l border-border bg-background" style={{ width: sidebarWidth, maxWidth: '65vw' }}>
       {/* The pane is its own container, so its divider runs the full height,
           title bar included. Its top row is the title bar's continuation: the
           same 40px and bottom rule as the main content header, titled like the
@@ -186,12 +187,12 @@ export function AssistantWorkspace(p: AssistantWorkspaceProps) {
       const location = chatLocation(layout, tab.id)
       if (!location) return []
       const floating = layout.floating.find((entry) => entry.id === tab.id)
-      const visible = location === 'assistant' ? p.pageVisible : location === 'sidebar' || !floating?.minimized
+      const visible = location === 'assistant' ? p.pageVisible : location === 'sidebar' ? layout.sidebarVisible : !floating?.minimized
       const host = location === 'assistant' ? p.pageHost : location === 'sidebar' ? hosts.sidebar : hosts[tab.id]
       // Closing is the sidebar's job, not the chat's: the container hands its
       // button into the chat's header row rather than stacking a strip above it.
       const controls = location === 'sidebar'
-        ? <button type="button" aria-label="Close sidebar" title="Close - conversation stays in history" onClick={() => close(tab.id)}
+        ? <button type="button" aria-label="Close sidebar" title="Close" onClick={p.onHideSidebar}
           className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><X className="size-4" /></button>
         : undefined
       return [<MountedChat key={tab.chatId} host={host ?? null}>
```

**File**: `apps/x/apps/renderer/src/lib/assistant-layout.test.ts` (modified, +15/-1)
```diff
@@ -6,7 +6,16 @@ const place = (state: AssistantLayout, id: string, location: ChatLocation, repla
 
 describe('assistant container ownership', () => {
   it('starts with one Assistant conversation and a hidden sidebar', () => {
-    expect(initialAssistantLayout('draft')).toEqual({ assistant: 'draft', sidebar: null, floating: [], focused: 'draft' })
+    expect(initialAssistantLayout('draft')).toEqual({ assistant: 'draft', sidebar: null, sidebarVisible: false, floating: [], focused: 'draft' })
+  })
+
+  it('hides and reopens the sidebar without releasing its conversation', () => {
+    let state = place(initialAssistantLayout('a'), 'b', 'sidebar')
+    state = reduce(state, { type: 'hide-sidebar' })
+    expect(state).toMatchObject({ sidebar: 'b', sidebarVisible: false })
+    expect(chatLocation(state, 'b')).toBe('sidebar')
+    state = reduce(state, { type: 'show-sidebar' })
+    expect(state).toMatchObject({ sidebar: 'b', sidebarVisible: true, focused: 'b' })
   })
 
   it('moves the same identity through every pair of locations without duplicates', () => {
@@ -74,4 +83,9 @@ describe('assistant container ownership', () => {
     expect(result.floating[0]).toMatchObject({ id: 'b', minimized: true })
     expect(restoreAssistantLayout('{', ['a'])).toEqual(initialAssistantLayout('a'))
   })
+
+  it('starts with a remembered sidebar chat hidden after relaunch', () => {
+    const saved = { assistant: 'a', sidebar: 'b', sidebarVisible: true, floating: [], focused: 'b' }
+    expect(restoreAssistantLayout(JSON.stringify(saved), ['a', 'b'])).toMatchObject({ sidebar: 'b', sidebarVisible: false })
+  })
 })
```

**File**: `apps/x/apps/renderer/src/lib/assistant-layout.ts` (modified, +16/-3)
```diff
@@ -9,19 +9,23 @@ export interface FloatingChat extends WindowSize { id: string; minimized: boolea
 export interface AssistantLayout {
   assistant: string | null
   sidebar: string | null
+  /** The sidebar can be hidden while retaining the conversation it owns. */
+  sidebarVisible: boolean
   floating: FloatingChat[]
   focused: string | null
 }
 export type LayoutAction =
   | { type: 'place'; id: string; location: ChatLocation; replacing?: string; size: WindowSize }
   | { type: 'close'; id: string }
   | { type: 'focus'; id: string }
+  | { type: 'hide-sidebar' }
+  | { type: 'show-sidebar' }
   | { type: 'minimize'; id: string }
   | { type: 'resize'; id: string; size: WindowSize }
   | { type: 'reorder'; id: string; index: number }
 
 export function initialAssistantLayout(id: string): AssistantLayout {
-  return { assistant: id, sidebar: null, floating: [], focused: id }
+  return { assistant: id, sidebar: null, sidebarVisible: false, floating: [], focused: id }
 }
 
 export function chatLocation(layout: AssistantLayout, id: string): ChatLocation | null {
@@ -39,6 +43,7 @@ export function assistantLayoutReducer(state: AssistantLayout, action: LayoutAct
         ...state,
         assistant: state.assistant === action.id ? null : state.assistant,
         sidebar: state.sidebar === action.id ? null : state.sidebar,
+        sidebarVisible: state.sidebar === action.id ? false : state.sidebarVisible,
         floating: state.floating.filter((entry) => entry.id !== action.id && entry.id !== action.replacing),
         focused: action.id,
       }
@@ -47,17 +52,23 @@ export function assistantLayoutReducer(state: AssistantLayout, action: LayoutAct
         const entry = { id: action.id, width, height, minimized: false, layer }
         const index = previous ? state.floating.indexOf(previous) : next.floating.length
         next.floating.splice(Math.min(index, next.floating.length), 0, entry)
-      } else next[action.location] = action.id
+      } else {
+        next[action.location] = action.id
+        if (action.location === 'sidebar') next.sidebarVisible = true
+      }
       return next
     }
     case 'close': return {
       ...state,
       assistant: state.assistant === action.id ? null : state.assistant,
       sidebar: state.sidebar === action.id ? null : state.sidebar,
+      sidebarVisible: state.sidebar === action.id ? false : state.sidebarVisible,
       floating: state.floating.filter((entry) => entry.id !== action.id),
       focused: state.focused === action.id ? null : state.focused,
     }
     case 'focus': return { ...state, focused: action.id, floating: state.floating.map((entry) => entry.id === action.id ? { ...entry, minimized: false, layer } : entry) }
+    case 'hide-sidebar': return { ...state, sidebarVisible: false }
+    case 'show-sidebar': return state.sidebar ? { ...state, sidebarVisible: true, focused: state.sidebar } : state
     case 'minimize': return { ...state, focused: state.focused === action.id ? null : state.focused, floating: state.floating.map((entry) => entry.id === action.id ? { ...entry, minimized: true } : entry) }
     case 'resize': return { ...state, floating: state.floating.map((entry) => entry.id === action.id ? { ...entry, ...action.size } : entry) }
     case 'reorder': {
@@ -104,7 +115,9 @@ export function restoreAssistantLayout(raw: string | null, ids: string[]): Assis
       if (id) floating.push({ id, width: entry.width, height: entry.height, layer: entry.layer, minimized: !!entry.minimized })
     }
     const focused = [assistant, sidebar, ...floating.filter((entry) => !entry.minimized).map((entry) => entry.id)].includes(saved.focused) ? saved.focused : assistant
-    return { assistant, sidebar, floating, focused }
+    // The sidebar starts hidden on every app launch. Its remembered chat stays
+    // assigned so an explicit open can restore that same conversation.
+    return { assistant, sidebar, sidebarVisible: false, floating, focused }
   } catch { ret
```

---

### Incident Patch 5: `90233786` (2026-09-15)
**Commit Message**: fix(analytics): configure PostHog in packaged child server

**File**: `apps/x/ANALYTICS.md` (modified, +15/-11)
```diff
@@ -1,18 +1,18 @@
 # Analytics
 
-> PostHog instrumentation for `apps/x`. We capture LLM token usage (broken down by feature) and identity/auth events. Renderer (`posthog-js`) and main (`posthog-node`) share one stable distinct_id and one identified user, so events from either process resolve to the same person.
+> PostHog instrumentation for `apps/x`. We capture LLM token usage (broken down by feature) and identity/auth events. Renderer (`posthog-js`), main, and the local child server (`posthog-node`) share the installation identity. Each Node process has its own PostHog client; the process hosting core identifies the user for agent events.
 
 ## Identity model
 
 - **Anonymous distinct_id** = `installationId` from `~/.rowboat/config/installation.json` (auto-generated on first run; see `packages/core/src/analytics/installation.ts`).
 - Renderer fetches it from main on startup via the `analytics:bootstrap` IPC channel and passes it as PostHog's `bootstrap.distinctID`. Main uses it directly in `posthog-node`.
-- **On rowboat sign-in**: `posthog.identify(rowboatUserId)` runs in **both** processes.
-  - Main does it from `apps/main/src/oauth-handler.ts:285` (after `getBillingInfo()` resolves) — this is the load-bearing call, since main always runs.
+- **On rowboat sign-in**: core identifies the user in the process hosting agent work (the child server by default).
+  - `packages/core/src/auth/oauth-flows.ts` calls `identify` after `getBillingInfo()` resolves.
   - Renderer mirrors via `apps/renderer/src/hooks/useAnalyticsIdentity.ts` listening on the `oauth:didConnect` IPC event.
-  - Main also calls `alias()` so events emitted under the anonymous installation_id are linked to the identified user retroactively.
-- **On every app startup**: main re-identifies if rowboat tokens exist (`packages/core/src/analytics/identify.ts`, called from `apps/main/src/main.ts` whenReady). Idempotent — PostHog merges person properties on duplicate identifies. This catches users who installed before analytics existed, and refreshes person properties (plan/status) on every launch.
-- **On rowboat sign-out**: `posthog.reset()` in both processes; future events resolve to the installation_id again.
-- **`email`** is set on `identify` from main only (sourced from `/v1/me`). Person properties are server-side, so the renderer's events resolve to the same record without redundantly setting it.
+  - The core PostHog client also calls `alias()` so events emitted under the anonymous installation_id are linked to the identified user retroactively.
+- **On every app startup**: main and the child server each call `identifyIfSignedIn()` from `packages/core/src/analytics/identify.ts`. The child calls it after config initialization without blocking boot. Idempotent — PostHog merges person properties on duplicate identifies. This catches users who installed before analytics existed, and refreshes person properties (plan/status) on every launch.
+- **On rowboat sign-out**: the renderer resets identity and core OAuth resets its local PostHog identity; future core events resolve to the installation_id again.
+- **`email`** is set on `identify` by the Node PostHog client (sourced from `/v1/me`). Person properties are server-side, so the renderer's events resolve to the same record without redundantly setting it.
 
 ## Event catalog
 
@@ -289,11 +289,14 @@ PostHog credentials live in two env vars (also baked into the binary at packagin
 
 Where they're consumed:
 - **Renderer** (Vite): `import.meta.env.VITE_PUBLIC_POSTHOG_*` — inlined at build time.
-- **Main** (esbuild via `apps/main/bundle.mjs`): inlined into `main.cjs` at packaging time using esbuild `define`. In dev (`npm run dev`), main reads them from `process.env` at runtime.
+- **Main and child server** (esbuild via `apps/main/bundle.mjs` and `bundle-config.mjs`): the same key, host, and app version are inlined into both `main.cjs` and `rowboat-server.cjs`. Setting build-time values only for main does not configur
```

**File**: `apps/x/apps/main/bundle-config.mjs` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+// Shared by both desktop processes: installed apps do not inherit CI's env.
+export function desktopBundleDefines(appVersion) {
+  return {
+    'process.env.POSTHOG_KEY': JSON.stringify(process.env.VITE_PUBLIC_POSTHOG_KEY ?? ''),
+    'process.env.POSTHOG_HOST': JSON.stringify(process.env.VITE_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'),
+    'process.env.ROWBOAT_APP_VERSION': JSON.stringify(appVersion ?? ''),
+  };
+}
+
+export function childServerBundleOptions(appVersion) {
+  return {
+    entryPoints: ['../server/dist/standalone.js'],
+    bundle: true,
+    platform: 'node',
+    target: 'node20',
+    format: 'cjs',
+    outfile: './.package/dist/rowboat-server.cjs',
+    // Core modules resolve asset paths through import.meta.url at module init.
+    banner: { js: `var __import_meta_url = require('url').pathToFileURL(__filename).href;` },
+    define: {
+      'import.meta.url': '__import_meta_url',
+      ...desktopBundleDefines(appVersion),
+    },
+    external: ['electron', 'node-pty', 'uiohook-napi', 'bun:sqlite'],
+  };
+}
```

**File**: `apps/x/apps/main/bundle.mjs` (modified, +3/-20)
```diff
@@ -10,6 +10,7 @@
  */
 
 import * as esbuild from 'esbuild';
+import { desktopBundleDefines, childServerBundleOptions } from './bundle-config.mjs';
 import { readFile } from 'node:fs/promises';
 import { execSync } from 'node:child_process';
 import fs from 'node:fs';
@@ -42,12 +43,7 @@ await esbuild.build({
   // Replace import.meta.url directly with our polyfill variable
   define: {
     'import.meta.url': '__import_meta_url',
-    // Inject PostHog credentials at build time. Reuse the renderer's
-    // VITE_PUBLIC_* envs so packaging only needs one set of values.
-    // Empty strings disable analytics gracefully.
-    'process.env.POSTHOG_KEY': JSON.stringify(process.env.VITE_PUBLIC_POSTHOG_KEY ?? ''),
-    'process.env.POSTHOG_HOST': JSON.stringify(process.env.VITE_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com'),
-    'process.env.ROWBOAT_APP_VERSION': JSON.stringify(pkg.version ?? ''),
+    ...desktopBundleDefines(pkg.version),
   },
 });
 
@@ -162,20 +158,7 @@ if (process.platform === 'darwin') {
 // Bundle the standalone rowboat-server (spawned as a child with
 // ELECTRON_RUN_AS_NODE in child-server mode). node-pty stays external like
 // in the main bundle and ships from .package/node_modules.
-await esbuild.build({
-  entryPoints: ['../server/dist/standalone.js'],
-  bundle: true,
-  platform: 'node',
-  target: 'node20',
-  format: 'cjs',
-  outfile: './.package/dist/rowboat-server.cjs',
-  // Same import.meta.url polyfill as main.cjs — core modules resolve asset
-  // paths through it at module init; without the define the CJS bundle sees
-  // undefined and crashes before the server can boot.
-  banner: { js: cjsBanner },
-  define: { 'import.meta.url': '__import_meta_url' },
-  external: ['electron', 'node-pty', 'uiohook-napi', 'bun:sqlite'],
-});
+await esbuild.build(childServerBundleOptions(pkg.version));
 console.log('✅ rowboat-server bundled to .package/dist/rowboat-server.cjs');
 
 // Bundle the vendored agent-slack CLI into a single self-contained script next
```

**File**: `apps/x/apps/server/src/child-analytics.test.js` (added, +94/-0)
```diff
@@ -0,0 +1,94 @@
+import { execFile } from 'node:child_process';
+import { once } from 'node:events';
+import { mkdtemp, rm } from 'node:fs/promises';
+import { createServer } from 'node:http';
+import { tmpdir } from 'node:os';
+import path from 'node:path';
+import { fileURLToPath } from 'node:url';
+import { promisify } from 'node:util';
+import { build } from 'esbuild';
+import { afterEach, expect, it, vi } from 'vitest';
+import { childServerBundleOptions } from '../../main/bundle-config.mjs';
+
+const execFileAsync = promisify(execFile);
+const analyticsDir = fileURLToPath(new URL('../../../packages/core/src/analytics/', import.meta.url));
+afterEach(() => vi.unstubAllEnvs());
+
+it.each([true, false])('packaged child delivers analytics without runtime credentials (enabled=%s)', async (enabled) => {
+  const batches = [];
+  const receiver = createServer(async (req, res) => {
+    const chunks = [];
+    for await (const chunk of req) chunks.push(chunk);
+    if (req.url === '/batch/') batches.push(JSON.parse(Buffer.concat(chunks).toString()));
+    res.writeHead(200, { 'Content-Type': 'application/json' });
+    res.end('{}');
+  });
+  receiver.listen(0, '127.0.0.1');
+  await once(receiver, 'listening');
+  const directory = await mkdtemp(path.join(tmpdir(), 'rowboat-child-analytics-'));
+  try {
+    vi.stubEnv('VITE_PUBLIC_POSTHOG_KEY', enabled ? 'phc_packaging_test' : '');
+    vi.stubEnv('VITE_PUBLIC_POSTHOG_HOST', `http://127.0.0.1:${receiver.address().port}`);
+    // Production child bundle settings and real PostHog SDK; account/disk
+    // dependencies are fixtures so no app data or real API is used.
+    const options = childServerBundleOptions('9.8.7');
+    delete options.entryPoints;
+    const outfile = path.join(directory, 'analytics.cjs');
+    await build({
+      ...options,
+      outfile,
+      stdin: {
+        resolveDir: analyticsDir,
+        contents: `
+          import { identifyIfSignedIn } from './identify.ts';
+          import { capture, reset, shutdown } from './posthog.ts';
+          async function main() {
+            await identifyIfSignedIn();
+            capture('spaces_rowboat_invoked', { queued: false });
+            capture('spaces_rowboat_message_posted');
+            reset();
+            capture('after_sign_out');
+            await shutdown();
+            process.exit(0);
+          }
+          main().catch((err) => { console.error(err); process.exit(1); });
+        `,
+      },
+      plugins: [{
+        name: 'isolated-account',
+        setup(builder) {
+          const fixtures = {
+            './installation.js': "export const getInstallationId = () => 'test-installation';",
+            '../config/env.js': "export const API_URL = 'https://api.example.test';",
+            '../account/account.js': 'export const isSignedIn = async () => true;',
+            '../billing/billing.js': "export const getBillingInfo = async () => ({ userId: 'test-user', userEmail: 'test@example.test' });",
+          };
+          builder.onResolve({ filter: /(?:installation|env|account|billing)\.js$/ }, (args) =>
+            fixtures[args.path] ? { path: args.path, namespace: 'fixture' } : undefined);
+          builder.onLoad({ filter: /.*/, namespace: 'fixture' }, (args) => ({ contents: fixtures[args.path] }));
+        },
+      }],
+    });
+    const env = { ...process.env };
+    for (const key of ['POSTHOG_KEY', 'POSTHOG_HOST', 'VITE_PUBLIC_POSTHOG_KEY', 'VITE_PUBLIC_POSTHOG_HOST', 'ROWBOAT_APP_VERSION', 'npm_package_version']) delete env[key];
+    const { stderr } = await execFileAsync(process.execPath, [outfile], { env, timeout: 8000 });
+    expect(stderr).toBe('');
+    if (!enabled) {
+      expect(batches).toEqual([]);
+      return;
+    }
+    expect(batches.length).toBeGreaterThan(0);
+    expect(batches.every((batch) => batch.api_key === 'phc_packaging_test')).toBe(true);
+    const events = batches.flatMap((batch) => batch.batch);
+    for (const event of ['spac
```

**File**: `apps/x/apps/server/src/standalone.ts` (modified, +11/-2)
```diff
@@ -1,4 +1,6 @@
 import process from 'node:process';
+import { identifyIfSignedIn } from '@x/core/dist/analytics/identify.js';
+import { shutdown as shutdownAnalytics } from '@x/core/dist/analytics/posthog.js';
 import { WorkDir } from '@x/core/dist/config/config.js';
 import { initConfigs } from '@x/core/dist/config/initConfigs.js';
 import container, {
@@ -34,6 +36,9 @@ async function main(): Promise<void> {
   // The workdir lock is acquired by createRowboatServer itself — a live
   // Electron-hosted transport makes this boot fail loudly, as it must.
   await initConfigs();
+  // Core analytics lives in this process. Restore identity on cold starts;
+  // sign-in/out changes are already handled by core's OAuth flows.
+  void identifyIfSignedIn();
   // Client capabilities route over the WS as reverse calls (RFC Q14): the
   // connected client that advertises each capability performs it.
   const broker = capabilityBroker();
@@ -109,8 +114,12 @@ async function main(): Promise<void> {
   const shutdown = async () => {
     // Never let a stuck teardown keep the process alive — exit regardless.
     setTimeout(() => process.exit(0), 5000).unref();
-    await server.close();
-    process.exit(0);
+    try {
+      await server.close();
+    } finally {
+      await shutdownAnalytics();
+      process.exit(0);
+    }
   };
   process.on('SIGINT', () => void shutdown());
   process.on('SIGTERM', () => void shutdown());
```

---

### Incident Patch 6: `09e2ec7c` (2026-09-15)
**Commit Message**: fix(spaces): restore Markdown checkbox toggles

**File**: `apps/x/apps/renderer/src/components/rich-markdown-viewer.tsx` (modified, +18/-3)
```diff
@@ -1,5 +1,6 @@
 import { useEffect, useRef } from 'react'
 import { EditorContent, useEditor, type Editor } from '@tiptap/react'
+import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
 import StarterKit from '@tiptap/starter-kit'
 import Link from '@tiptap/extension-link'
 import Image from '@tiptap/extension-image'
@@ -50,6 +51,7 @@ export function RichMarkdownViewer({ content, onToggleTask, onOpenLink }: {
   const onOpenLinkRef = useRef(onOpenLink)
   onOpenLinkRef.current = onOpenLink
   const editorRef = useRef<Editor | null>(null)
+  const taskPositionsRef = useRef(new WeakMap<ProseMirrorNode, () => number | undefined>())
   const editor = useEditor({
     editable: false,
     extensions: [
@@ -91,7 +93,18 @@ export function RichMarkdownViewer({ content, onToggleTask, onOpenLink }: {
       MermaidBlockExtension,
       WikiLink,
       TaskList,
-      TaskItem.configure({
+      TaskItem.extend({
+        addNodeView() {
+          const render = this.parent?.()
+          if (!render) return null
+          return (props) => {
+            // TipTap's checkbox callback retains the node from creation even
+            // when setContent reuses its view with a new node. getPos stays live.
+            taskPositionsRef.current.set(props.node, props.getPos)
+            return render(props)
+          }
+        },
+      }).configure({
         nested: true,
         // Only when a handler is mounted: otherwise read-only checkboxes stay
         // disabled (configuring this at all makes TipTap enable them).
@@ -101,11 +114,13 @@ export function RichMarkdownViewer({ content, onToggleTask, onOpenLink }: {
                 const cb = onToggleTaskRef.current
                 const instance = editorRef.current
                 if (!cb || !instance) return false
+                const position = taskPositionsRef.current.get(node)?.()
+                if (position === undefined) return false
                 let index = -1
                 let seen = 0
-                instance.state.doc.descendants((n) => {
+                instance.state.doc.descendants((n, pos) => {
                   if (n.type.name === 'taskItem') {
-                    if (n === node) index = seen
+                    if (pos === position) index = seen
                     seen += 1
                   }
                   return true
```

**File**: `apps/x/apps/renderer/src/components/spaces/checkbox-toggle.test.tsx` (added, +99/-0)
```diff
@@ -0,0 +1,99 @@
+import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
+import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
+import type { spaces } from '@x/shared'
+import type { OrgWithSpaces } from '@/hooks/use-spaces'
+import { RichMarkdownViewer } from '@/components/rich-markdown-viewer'
+import { toast } from '@/lib/toast'
+import { FileColumn } from './files-tab'
+
+vi.mock('@/components/markdown-editor', () => ({ MarkdownEditor: () => null }))
+vi.mock('./document-viewer', () => ({ SpaceDocumentViewer: () => null }))
+vi.mock('@/lib/toast', () => ({ toast: vi.fn() }))
+vi.mock('react-tweet', () => ({ Tweet: () => null }))
+
+const org = { id: 'org', address: 'spaces.example.com' } as OrgWithSpaces
+const space = { id: 'space', name: 'Team' } as spaces.Space
+const invoke = vi.fn()
+const onChanged = vi.fn()
+const original = '# Tasks\n\n- [ ] Same task\n  - [ ] Same task\n\n```md\n- [ ] Example only\n```\n\n- [ ] Last task'
+let asset: spaces.ReadAssetResult
+
+beforeEach(() => {
+  vi.clearAllMocks()
+  asset = { id: 'file', path: 'tasks.md', version: 3, content: original, recentHistory: [] }
+  invoke.mockImplementation(async (channel, args) => {
+    if (channel === 'spaces:readAsset') return { ...asset }
+    if (channel === 'spaces:proposeChange') {
+      asset = { ...asset, content: args.input.newContent, version: asset.version + 1 }
+      return { outcome: 'applied', version: asset.version }
+    }
+    throw new Error(`Unexpected channel ${channel}`)
+  })
+  window.ipc = { ...window.ipc, invoke } as typeof window.ipc
+})
+afterEach(cleanup)
+
+function file(refreshTick = 0) {
+  return <FileColumn org={org} space={space} assetId="file" memberNames={new Map()}
+    refreshTick={refreshTick} onChanged={onChanged} />
+}
+
+describe('Spaces Markdown checkboxes', () => {
+  it('proposes the selected nested task against the current version, then can untick it', async () => {
+    render(file())
+    const nested = (await screen.findAllByRole('checkbox'))[1]
+    fireEvent.click(nested)
+    const checked = original.replace('  - [ ] Same task', '  - [x] Same task')
+    await waitFor(() => expect(invoke).toHaveBeenCalledWith('spaces:proposeChange', {
+      orgId: 'org', spaceId: 'space',
+      input: { assetId: 'file', baseVersion: 3, newContent: checked },
+    }))
+    await waitFor(() => expect(nested).toBeChecked())
+
+    fireEvent.click(nested)
+    await waitFor(() => expect(invoke).toHaveBeenCalledWith('spaces:proposeChange', {
+      orgId: 'org', spaceId: 'space',
+      input: { assetId: 'file', baseVersion: 4, newContent: original },
+    }))
+    await waitFor(() => expect(nested).not.toBeChecked())
+    expect(onChanged).toHaveBeenCalledTimes(2)
+  })
+
+  it('targets the current task after a remote edit changes positions and task order', async () => {
+    const view = render(file())
+    await screen.findByRole('checkbox', { name: 'Task item checkbox for Last task' })
+    asset = { ...asset, version: 8, content: `Remote update\n\n- [ ] New task\n\n${original}` }
+    view.rerender(file(1))
+    await screen.findByRole('checkbox', { name: 'Task item checkbox for New task' })
+
+    const checked = asset.content.replace('- [ ] Last task', '- [x] Last task')
+    fireEvent.click(screen.getByRole('checkbox', { name: 'Task item checkbox for Last task' }))
+    await waitFor(() => expect(invoke).toHaveBeenCalledWith('spaces:proposeChange', {
+      orgId: 'org', spaceId: 'space',
+      input: { assetId: 'file', baseVersion: 8, newContent: checked },
+    }))
+    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Task item checkbox for Last task' })).toBeChecked())
+  })
+
+  it('keeps the saved checkbox state when the service reports a conflict', async () => {
+    invoke.mockImplementation(async (channel) => {
+      if (channel === 'spaces:readAsset') return { ...asset }
+      if (channel === 'spaces:proposeChange') return { outcom
```

---

### Incident Patch 7: `283abd28` (2026-09-15)
**Commit Message**: Merge pull request #1082 from rowboatlabs/fix/light-sidebar-activity-surface

fix(renderer): soften sidebar activity cards

**File**: `apps/x/apps/renderer/src/components/spaces-sidebar-section.tsx` (modified, +4/-2)
```diff
@@ -67,8 +67,10 @@ export function SpacesSidebarSection({ active, onOpenSpaces, onOpenMessage }: {
                                     <button type="button" onClick={() => onOpenMessage(targetOf(orgId, item))}
                                         title={`${org.name} · ${who} ${reason}\n${excerpt}\n${new Date(item.at).toLocaleString()}`}
                                         className={cn(
-                                            'w-full min-w-0 rounded-lg bg-black/20 px-2 py-1.5 text-left shadow-sm ring-1 ring-white/[0.035] transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring dark:bg-black/25',
-                                            item.unread && 'bg-sidebar-accent/60 ring-sidebar-border/60 dark:bg-sidebar-accent/50',
+                                            'w-full min-w-0 rounded-lg px-2 py-1.5 text-left ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
+                                            item.unread
+                                                ? 'bg-sidebar-accent/65 ring-sidebar-border/50 hover:bg-sidebar-accent dark:bg-sidebar-accent/50'
+                                                : 'bg-sidebar-accent/30 ring-sidebar-border/30 hover:bg-sidebar-accent/60 dark:bg-black/20 dark:ring-white/[0.035]',
                                         )}>
                                         <span className="flex items-baseline gap-2 text-[11px] text-muted-foreground">
                                             <span className="min-w-0 flex-1 truncate">{org.name}</span>
```

---

### Incident Patch 8: `7b3c7f2c` (2026-09-15)
**Commit Message**: fix(renderer): soften sidebar activity cards

**File**: `apps/x/apps/renderer/src/components/spaces-sidebar-section.tsx` (modified, +4/-2)
```diff
@@ -67,8 +67,10 @@ export function SpacesSidebarSection({ active, onOpenSpaces, onOpenMessage }: {
                                     <button type="button" onClick={() => onOpenMessage(targetOf(orgId, item))}
                                         title={`${org.name} · ${who} ${reason}\n${excerpt}\n${new Date(item.at).toLocaleString()}`}
                                         className={cn(
-                                            'w-full min-w-0 rounded-lg bg-black/20 px-2 py-1.5 text-left shadow-sm ring-1 ring-white/[0.035] transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring dark:bg-black/25',
-                                            item.unread && 'bg-sidebar-accent/60 ring-sidebar-border/60 dark:bg-sidebar-accent/50',
+                                            'w-full min-w-0 rounded-lg px-2 py-1.5 text-left ring-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring',
+                                            item.unread
+                                                ? 'bg-sidebar-accent/65 ring-sidebar-border/50 hover:bg-sidebar-accent dark:bg-sidebar-accent/50'
+                                                : 'bg-sidebar-accent/30 ring-sidebar-border/30 hover:bg-sidebar-accent/60 dark:bg-black/20 dark:ring-white/[0.035]',
                                         )}>
                                         <span className="flex items-baseline gap-2 text-[11px] text-muted-foreground">
                                             <span className="min-w-0 flex-1 truncate">{org.name}</span>
```

---

### Incident Patch 9: `16ff0c33` (2026-09-15)
**Commit Message**: fix(harbor): name initial space general

**File**: `apps/harbor/packages/server/src/apex.ts` (modified, +3/-3)
```diff
@@ -109,7 +109,7 @@ export function buildApexApp(deps: ApexDeps): Hono {
     // belongs to a member, and this is theirs.
     if (member) {
       const service = new HarborService(store, deps.hub, { name: org.name, address: domain });
-      const space = await service.createSpace({ memberId: member.id }, 'Main');
+      const space = await service.createSpace({ memberId: member.id }, 'general');
       await service.createAsset({ memberId: member.id }, space.id, {
         path: 'README.md',
         newContent: welcomeReadme(org.name),
@@ -150,7 +150,7 @@ export function buildApexApp(deps: ApexDeps): Hono {
 function welcomeReadme(orgName: string): string {
   return `# Welcome to ${orgName}
 
-This is your team's shared corner. **Main** is its first space — talk and files in one place, for you, your teammates, and everyone's agents.
+This is your team's shared corner. **general** is its first space — talk and files in one place, for you, your teammates, and everyone's agents.
 
 ## What happens here
 
@@ -161,7 +161,7 @@ This is your team's shared corner. **Main** is its first space — talk and file
 
 ## When to make more spaces
 
-Start here in Main. When one project or team-area grows its own steady stream of talk and files, give it a space of its own — spaces are cheap, attention isn't.
+Start here in general. When one project or team-area grows its own steady stream of talk and files, give it a space of its own — spaces are cheap, attention isn't.
 `;
 }
 
```

**File**: `apps/harbor/packages/server/test/multi-org.test.ts` (modified, +2/-2)
```diff
@@ -224,9 +224,9 @@ describe('apex face (self-serve org creation)', () => {
     expect(me.body.member.role).toBe('admin');
     expect(me.body.member.id).toBe(created.body.member.id);
 
-    // Landing area: a Main space with a welcome README, attributed to the founder.
+    // Landing area: a general space with a welcome README, attributed to the founder.
     const spaces = (await http('roadboard.spaces.test', token).get('/v1/spaces')).body.spaces;
-    expect(spaces.map((s: any) => s.name)).toEqual(['Main']);
+    expect(spaces.map((s: any) => s.name)).toEqual(['general']);
     const entries = (await http('roadboard.spaces.test', token).get(`/v1/spaces/${spaces[0].id}/assets`)).body.entries;
     expect(entries.map((e: any) => e.path)).toEqual(['README.md']);
     const readme = await http('roadboard.spaces.test', token).get(
```

---

### Incident Patch 10: `6e98d53d` (2026-09-15)
**Commit Message**: Merge pull request #1078 from rowboatlabs/fix/macos-renderer-build-heap

fix(x): increase heap for renderer packaging build

**File**: `apps/x/apps/main/forge.config.cjs` (modified, +8/-0)
```diff
@@ -411,6 +411,14 @@ module.exports = {
             console.log('Building renderer...');
             execSync('pnpm run build', {
                 cwd: path.join(__dirname, '../renderer'),
+                // The production renderer bundle exceeds Node's default heap on
+                // GitHub's macOS ARM runners while Vite renders/compresses chunks.
+                // Keep this scoped to the memory-intensive child process instead
+                // of changing the heap for Forge or the rest of the build.
+                env: {
+                    ...process.env,
+                    NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --max-old-space-size=4096`.trim(),
+                },
                 stdio: 'inherit'
             });
 
```

#### Recent Merged Pull Requests:
- **PR #1141** (2026-09-30): Require a work directory before offering the harness in chat (@arkml)
- **PR #1140** (2026-09-30): Agent members: the invocation contract and its implementation (@ramnique)
- **PR #1139** (2026-09-29): Make the Spaces roster the whole org (@ramnique)
- **PR #1138** (2026-09-29): Give agent members owners and their own keys (@ramnique)
- **PR #1137** (2026-09-29): Add members to a space, and show join lines in the stream (@ramnique)
- **PR #1135** (2026-09-29): Add agent members to Harbor and mark them in the app (@ramnique)
- **PR #1134** (2026-09-29): Fix link and code block boundaries in Spaces composer (@arkml)
- **PR #1124** (2026-09-24): Spaces: Auto-route stream drafts with Jev (TypeSafe), with Preview and corrections (@arkml)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
