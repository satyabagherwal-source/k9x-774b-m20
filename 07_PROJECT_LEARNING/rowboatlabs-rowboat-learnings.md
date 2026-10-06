# Forensic Learning Record (Deep Inspection): rowboatlabs/rowboat

> **Canonical Artifact**: `07_PROJECT_LEARNING/rowboatlabs-rowboat-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/rowboatlabs/rowboat](https://github.com/rowboatlabs/rowboat))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:10:55.066Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `rowboatlabs/rowboat`
- **Description**: AI coworker with memory and collaboration
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 17995 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/harbor/packages/protocol/src/core.ts`
```
import { z } from 'zod';
import { Approval } from './approval.js';
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
   * added it and alone holds its keys. Absent for people.
   */
  ownerId: MemberId.optional(),
  /**
   * What an agent is underneath, and the path Harbor takes to reach it (spec
   * §4 Agent members, amended 2026-09-30). Set for every agent, absent for
   * people, fixed at creation. Open strings on the wire: a kind this client
   * doesn't know is drawn as a generic agent. AGENT_PAIRS is what Harbor accepts.
   */
  agentKind: z.string().min(1).max(32).optional(),
  agentConnection: z.string().min(1).max(32).optional(),
});
export type Member = z.infer<typeof Member>;

/**
 * The (kind, connection) pairs Harbor accepts when an agent is added (spec §4
 * Agent members, 2026-09-30). What Harbor does for an agent is looked up from
 * its pair, never stored: a pair whose connection is in HARBOR_RUN_CONNECTIONS
 * gets a connector Harbor runs; any other waits for whoever holds the agent's
 * key. A new pair is a line here, never a migration.
 */
export const REPLICAS_CODING_AGENTS = ['claude-code', 'codex', 'cursor', 'opencode', 'pi', 'muse-code'] as const;
export const AGENT_PAIRS: ReadonlyArray<{ kind: string; connection: string }> = [
  { kind: 'custom', connection: 'contract' },
  { kind: 'hermes', connection: 'plugin' },
  ...REPLICAS_CODING_AGENTS.map((kind) => ({ kind, connection: 'replicas' })),
];
/** Connections whose connector Harbor runs, calling the platform with a credential it holds (spec §8 Connectors). */
export const HARBOR_RUN_CONNECTIONS: readonly string[] = ['replicas'];

export function isAgentPair(kind: string, connection: string): boolean {
  return AGENT_PAIRS.some((pair) => pair.kind === kind && pair.connection === connection);
}

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

/**
 * The platform credential Harbor holds for an agent it reaches through that
 * platform (spec §8 Connectors, 2026-09-30), as its owner sees it: only its
 * last characters. The secret is sealed and never read back. `rejectedAt` is
 * set when the platform refused it, and cleared when it is replaced.
 */
export const AgentCredential = z.object({
  hint: z.string().max(16),
  setBy: MemberId,
  setAt: z.iso.datetime(),
  rejectedAt: z.iso.datetime().optional(),
  rejectedReason: z.string().max(280).optional(),
});
export type AgentCredential = z.infer<typeof AgentCredential>;

/** An agent with its keys, as the Agents screen lists them, and its platform credential when Harbor runs its connector. */
export const AgentListing = z.object({ agent: Member, keys: z.array(AgentKey), credential: AgentCredential.optional() });
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
  
```

### Core Architecture Module: `apps/harbor/packages/server/src/core/agents.ts`
```
import { HARBOR_RUN_CONNECTIONS, isAgentPair, type AgentCredential, type AgentKey, type AgentKeySecret, type AgentListing, type InvocationOptionValues, type Member } from '@rowboat/spaces-protocol';
import { hashAgentKey, mintAgentKeySecret } from '../agent-keys.js';
import { HarborError } from '../errors.js';
import { agentsManagedBy, canAddAgent, canCreateAgentKey, canRevokeAgentKey, enforce } from '../policy.js';
import type { StoredAgentKey } from '../store.js';
import type { Kernel, ActorCtx } from './kernel.js';
import type { Spaces } from './spaces.js';

// Agent members and their keys (spec §4 Agent members, 2026-09-29). Any
// person adds an agent and owns it; the owner alone creates its keys; the
// owner or an admin revokes them. A key is a bearer secret presented as the
// agent itself — auth.ts resolves it on every face — and the org keeps only
// its hash. Render face only: a secret never passes through a tool.
//
// An agent's kind and connection (2026-09-30) are set here and never change.
// A platform connection's credential is checked and stored by the connector
// host (connectors/host.ts), which seals it for this org; this module keeps
// the rules: who may set it, and that only a platform agent has one.

/** What the connector host does for agent creation. Absent = this org runs no connectors. */
export interface AgentConnectorHooks {
  verify(connection: string, secret: string): Promise<void>;
  save(agentId: string, secret: string, setBy: string): Promise<AgentCredential>;
  added(agent: Member): void;
}

export class Agents {
  private hooks: AgentConnectorHooks | undefined;

  constructor(
    private readonly k: Kernel,
    private readonly spaces: Spaces,
  ) {}

  attachConnectors(hooks: AgentConnectorHooks): void {
    this.hooks = hooks;
  }

  private async actor(ctx: ActorCtx): Promise<Member> {
    const member = await this.k.store.getMember(ctx.memberId);
    if (!member) throw new HarborError('not_a_member', 'not a member of this org');
    return member;
  }

  private async agent(agentId: string): Promise<Member> {
    const agent = await this.k.store.getMember(agentId);
    if (!agent || agent.kind !== 'agent') throw new HarborError('not_found', 'no such agent');
    return agent;
  }

  /** The agents the caller manages, each with its keys (never their secrets). */
  async list(ctx: ActorCtx): Promise<AgentListing[]> {
    const actor = await this.actor(ctx);
    const agents = await this.k.store.listAgents(agentsManagedBy(actor) === 'all' ? null : actor.id);
    const keys = await this.k.store.listAgentKeys(agents.map((a) => a.id));
    const credentials = await this.k.store.listAgentCredentials(agents.map((a) => a.id));
    return agents.map((agent) => {
      const stored = credentials.find((c) => c.agentId === agent.id);
      const { agentId: _agentId, sealed: _sealed, ...credential } = stored ?? ({} as never);
      return { agent, keys: keys.filter((k) => k.agentId === agent.id), ...(stored ? { credential } : {}) };
    });
  }

  /**
   * Add an agent: the caller owns it and gets its first key, shown this once.
   * A platform agent's credential is checked with the platform first, so a
   * refused key creates nothing.
   */
  async add(
    ctx: ActorCtx,
    input: { displayName: string; kind: string; connection: string; credential?: string },
  ): Promise<{ agent: Member; key: AgentKeySecret }> {
    enforce(canAddAgent(await this.actor(ctx)));
    if (!isAgentPair(input.kind, input.connection)) {
      throw new HarborError('invalid_request', `${input.kind} through ${input.connection} is not a kind of agent this Harbor knows`);
    }
    const platform = HARBOR_RUN_CONNECTIONS.includes(input.connection);
    if (platform && input.credential === undefined) throw new HarborError('invalid_request', `a ${input.connection} agent needs its ${input.connection} key`);
    if (!platform && input.credential !== undefined) throw new HarborError('invalid_request', 'only an agent Harbor reaches through a platform takes a credential');
    if (platform) {
      if (!this.hooks) throw new HarborError('invalid_request', `this Harbor runs no ${input.connection} connector`);
      await this.hooks.verify(input.connection, input.credential!);
    }
    const agent = await this.spaces.createAgent({
      displayName: input.displayName,
      ownerId: ctx.memberId,
      agentKind: input.kind,
      agentConnection: input.connection,
    });
    if (platform) await this.hooks!.save(agent.id, input.credential!, ctx.memberId);
    const key = await this.mint(ctx, agent.id);
    this.hooks?.added(agent);
    return { agent, key };
  }

  /** Replace a platform agent's credential: the owner only, checked with the platform first; clears a rejection. */
  async setCredential(ctx: ActorCtx, agentId: string, secret: string): Promise<AgentCredential> {
    const agent = await this.agent(agentId);
    enforce(canCreateAgentKey(await this.actor(ctx), agent));
    const connection = agent.agentConnection ?? '';
    if (!HARBOR_RUN_CONNECTIONS.includes(connection)) throw new HarborError('invalid_request', 'only an agent Harbor reaches through a platform has a credential');
    if (!this.hooks) throw new HarborError('invalid_request', `this Harbor runs no ${connection} connector`);
    this.k.guardWrite();
    await this.hooks.verify(connection, secret);
    return this.hooks.save(agentId, secret, ctx.memberId);
  }

  /**
   * Set the agent's option defaults (spec §8 Invocation options, 2026-10-01):
   * the owner only, like its keys; each for an option its connector declared,
   * a declared choice or a toggle's value. Replaces them all.
   */
  async setOptionDefaults(ctx: ActorCtx, agentId: string, defaults: InvocationOptionValues): Promise<InvocationOptionValues> {
    const agent = await this.agent(agentId);
    enforce(canCreateAgentKey(await this.actor(ctx), agent));
    this.k.guardWrite();
    const declared = (await this.k.store.getAgentCapabilities(agentId))?.options ?? [];
    for (const [key, value] of Object.entries(defaults)) {
      const option = declared.find((o) => o.key === key);
      if (!option) throw new HarborError('invalid_request', `${agent.displayName} has no option "${key}"`);
      const fits = option.type === 'toggle' ? typeof value === 'boolean' : typeof value === 'string' && option.choices.some((c) => c.id === value);
      if (!fits) throw new HarborError('invalid_request', `that is not one of ${option.label}'s choices`);
    }
    await this.k.store.putAgentOptionDefaults(agentId, defaults, ctx.memberId, this.k.now());
    return defaults;
  }

  /** Another key, for rotation: create, switch the agent over, revoke the old one. */
  async createKey(ctx: ActorCtx, agentId: string): Promise<AgentKeySecret> {
    enforce(canCreateAgentKey(await this.actor(ctx), await this.agent(agentId)));
    this.k.guardWrite();
    return this.mint(ctx, agentId);
  }

  /** Revoke a key. Idempotent: a revoked key keeps its first revocation time. */
  async revokeKey(ctx: ActorCtx, agentId: string, keyId: string): Promise<AgentKey> {
    enforce(canRevokeAgentKey(await this.actor(ctx), await this.agent(agentId)));
    const key = await this.k.store.getAgentKey(keyId);
    if (!key || key.agentId !== agentId) throw new HarborError('not_found', 'no such key for this agent');
    await this.k.store.revokeAgentKey(keyId, this.k.now());
    const { hash: _hash, ...revoked } = (await this.k.store.getAgentKey(keyId))!;
    return revoked;
  }

  private async mint(ctx: ActorCtx, agentId: string): Promise<AgentKeySecret> {
    const secret = mintAgentKeySecret();
    const key: StoredAgentKey = { id: this.k.ulid(), agentId, hash: hashAgentKey(secret), createdBy: ctx.memberId, createdAt: this.k.now() };
    await this.k.store.putAgentKey(key);
    const { hash: _hash, ...metadata } = key;
    return { ...metadata, secret };
  }
}

```

### Core Architecture Module: `apps/harbor/packages/server/src/core/approval-card.ts`
```
import { APPROVAL_CHOICE_LABELS, mentionsAsText, type ApprovalRequest } from '@rowboat/spaces-protocol';

// The text an approval card's message carries (spec §8 part 4, 2026-10-01):
// what clients that cannot show the card render, and what an agent reading
// the thread sees. The exact action goes in a code block, so a mention token
// in it is a cite, not an address; the title and reason are flattened for
// the same reason.

export function approvalCardBody(agentName: string, request: ApprovalRequest): string {
  const plain = (text: string) => mentionsAsText(text, new Map()).replace(/\s+/g, ' ').trim();
  const longestTicks = Math.max(0, ...[...request.detail.matchAll(/`+/g)].map((m) => m[0].length));
  const fence = '`'.repeat(Math.max(3, longestTicks + 1));
  const parts = [`**${plain(request.title)}**`];
  if (request.detail.trim()) parts.push(`${fence}\n${request.detail}\n${fence}`);
  if (request.reason) parts.push(`Why: ${plain(request.reason)}`);
  const choices = request.choices.map((c) => APPROVAL_CHOICE_LABELS[c]).join(', ');
  parts.push(`_${plain(agentName)} is waiting for approval in Rowboat: ${choices}._`);
  return parts.join('\n\n');
}

```

### Core Architecture Module: `apps/harbor/packages/server/src/core/assets.ts`
```
import {
  threadRootFromReason,
  type Asset,
  type Attribution,
  type BlobInfo,
  type ChangeSet,
  type ConflictRegion,
  type CreateAsset,
  type CreateAssetResult,
  type DeleteAssetResult,
  type MoveAssetResult,
  type ProposeChange,
  type ProposeChangeResult,
  type ReadAssetResult,
  type RestoreAssetResult,
  type Routes,
} from '@rowboat/spaces-protocol';
import { createTwoFilesPatch } from 'diff';
import type { z } from 'zod';
import { blobHash, type BlobStore } from '../blobs.js';
import { HarborError } from '../errors.js';
import { merge3 } from '../merge.js';
import { dispositionFor, imageDimensions, resolveMime } from '../mime.js';
import type { AssetRecord, AssetVersionData } from '../store.js';
import { Kernel, type ActorCtx } from './kernel.js';

// Files: assets by id, versions and the change log, uploaded blobs, history
// and diff — the merge-then-correct write path (CONTRACT.md decisions 1 and 6).

/** BlobInfo's optional dimensions from a stored blob record — both or neither. */
function blobDims(stored: { width?: number; height?: number }): { width: number; height: number } | Record<string, never> {
  return stored.width !== undefined && stored.height !== undefined
    ? { width: stored.width, height: stored.height }
    : {};
}

const RECENT_HISTORY = 10;

export class Assets {
  constructor(
    private readonly k: Kernel,
    /** Absent = uploads unconfigured on this org (routes refuse loudly, everything else works). */
    private readonly blobs?: BlobStore,
  ) {}

  // --- assets ----------------------------------------------------------------
  // Files are addressed by id (2026-09-14): every operation takes an assetId;
  // the path is a display property of the record, set at birth (createAsset,
  // the one call that runs before an id exists) and changed by moveAsset.
  // Paths stay unique among the living so the tree reads like a file system
  // and relative links inside documents still resolve. History is a lineage
  // filter on the id; move/delete/restore are property updates that append
  // one op change-set each. Only content edits bump versions.

  toAsset(a: AssetRecord): Asset {
    return {
      id: a.id,
      path: a.path,
      version: a.version,
      updatedAt: a.updatedAt,
      ...(a.blob ? { blob: a.blob } : {}),
      ...(a.state === 'deleted' ? { state: 'deleted' as const } : {}),
    };
  }

  async listAssets(ctx: ActorCtx, spaceId: string, includeDeleted = false): Promise<Asset[]> {
    await this.k.requireReadableSpace(ctx, spaceId);
    const records = await this.k.store.listAssets(spaceId, includeDeleted);
    return records.map((a) => this.toAsset(a));
  }

  /** The asset row for `assetId`, live or trashed, else not_found. */
  private async requireAsset(spaceId: string, assetId: string): Promise<AssetRecord> {
    const asset = await this.k.store.getAssetById(spaceId, assetId);
    if (!asset) throw new HarborError('not_found', 'no such asset');
    return asset;
  }

  /** A LIVE asset for `assetId`; a trashed one names itself so the caller can restore it. */
  async requireLiveAsset(spaceId: string, assetId: string): Promise<AssetRecord> {
    const asset = await this.requireAsset(spaceId, assetId);
    if (asset.state !== 'live') {
      throw new HarborError('not_found', `${asset.path} was deleted — it can be restored from Trash`);
    }
    return asset;
  }

  private async recentHistory(spaceId: string, assetId: string, upToVersion?: number): Promise<ChangeSet[]> {
    const all = await this.k.store.listChangeSets(spaceId, { assetId, limit: 1_000 });
    const filtered = upToVersion === undefined ? all : all.filter((cs) => cs.resultVersion <= upToVersion);
    return filtered.slice(0, RECENT_HISTORY);
  }

  async readAsset(ctx: ActorCtx, spaceId: string, assetId: string, version?: number): Promise<ReadAssetResult> {
    await this.k.requireReadableSpace(ctx, spaceId);
    const asset = await this.requireLiveAsset(spaceId, assetId);
    const v = version ?? asset.version;
    const data = await this.k.store.getAssetVersion(spaceId, asset.id, v);
    if (data === undefined) throw new HarborError('not_found', `no version ${v} of ${asset.path}`);
    return {
      id: asset.id,
      path: asset.path,
      content: data.content ?? '',
      ...(data.blob ? { blob: data.blob } : {}),
      version: v,
      recentHistory: await this.recentHistory(spaceId, asset.id, v),
    };
  }

  /** Stale-base retry bundle for namespace ops — the propose conflict, minus merge regions. */
  private async staleAsset(spaceId: string, asset: AssetRecord) {
    const data = await this.k.store.getAssetVersion(spaceId, asset.id, asset.version);
    return {
      outcome: 'conflict' as const,
      currentVersion: asset.version,
      currentContent: data?.content ?? '',
      ...(data?.blob ? { currentBlob: data.blob } : {}),
      recentHistory: await this.recentHistory(spaceId, asset.id),
    };
  }

  /** The proposal's stored shape: text inline, or a blob that phase-1 landed in THIS space. */
  private async proposalData(spaceId: string, input: { newContent?: string; blob?: string }): Promise<AssetVersionData> {
    // Binary variant: the hash must be phase-1-uploaded to THIS space — a
    // version row can never point at nothing (and never at another space's
    // upload; the registry is the read gate).
    if (input.blob !== undefined) {
      const stored = await this.k.store.getSpaceBlob(spaceId, input.blob);
      if (!stored) {
        throw new HarborError('invalid_request', 'blob is not uploaded to this space — call uploadBlob first');
      }
      return { content: null, blob: { hash: stored.hash, size: stored.size, mime: stored.mime, ...blobDims(stored) } };
    }
    return { content: input.newContent ?? '', blob: null };
  }

  /**
   * Birth: the one operation that names a file by path, because it has no id
   * yet. The path must be free among the living; a trashed file with the same
   * name never blocks — it keeps its own record and the newcomer starts a
   * fresh lineage. Version 1, one change-set, one event.
   */
  async createAsset(ctx: ActorCtx, spaceId: string, input: CreateAsset): Promise<CreateAssetResult> {
    await this.k.requireMember(ctx, spaceId);
    this.k.guardWrite();
    if (input.threadRootId && !(await this.k.store.getMessage(spaceId, input.threadRootId))) {
      throw new HarborError('invalid_request', 'threadRootId does not exist in this space');
    }
    const data = await this.proposalData(spaceId, input);
    const attribution = this.k.attributionOf(ctx, input);
    return this.k.lockedAs(ctx, spaceId, async () => {
      const occupant = await this.k.store.getLiveAssetByPath(spaceId, input.path);
      if (occupant) {
        throw new HarborError('invalid_request', `a file already exists at ${input.path} (${occupant.id}) — read it and propose a change, or pick another name`);
      }
      const record: AssetRecord = { id: this.k.ulid(), path: input.path, version: 1, updatedAt: this.k.now(), state: 'live' };
      await this.k.store.createAsset(spaceId, record);
      const changeSet = await this.commit(spaceId, record, { baseVersion: 0, ...input }, attribution, 1, data);
      const asset = await this.requireAsset(spaceId, record.id);
      return { asset: this.toAsset(asset), changeSet };
    });
  }

  async moveAsset(
    ctx: ActorCtx,
    spaceId: string,
    input: z.infer<Routes['moveAsset']['request']>,
  ): Promise<MoveAssetResult> {
    await this.k.requireMember(ctx, spaceId);
    this.k.guardWrite();
    if (input.threadRootId && !(await this.k.store.getMessage(spaceId, input.threadRootId))) {
      throw new HarborError('invalid_request', 'threadRootId does not exist in this space');
    }
    const attribution = this.k.attributionOf(ctx, input);
    return this.k.lockedAs(ctx, spaceId, async () => {
      const asset = await this.requireLiveAsset(spaceId, input.assetId);
      if (input.toPath === asset.path) {
        throw new HarborError('invalid_request', 'destination is the same path');
      }
      if (input.baseVersion > asset.version) {
        throw new HarborError('invalid_request', `baseVersion ${input.baseVersion} is ahead of the asset (v${asset.version})`);
      }
      if (input.baseVersion !== asset.version) return this.staleAsset(spaceId, asset);
      if (await this.k.store.getLiveAssetByPath(spaceId, input.toPath)) {
        throw new HarborError('invalid_request', 'a file already exists at the destination — moves never overwrite, pick another name');
      }
      const at = this.k.now();
      await this.k.store.setAssetPath(spaceId, asset.id, input.toPath, at);
      const changeSet = await this.appendOpChangeSet(spaceId, asset.id, {
        assetPath: input.toPath,
        version: asset.version,
        attribution,
        op: 'move',
        movedFrom: asset.path,
        reason: input.reason,
        threadRootId: input.threadRootId,
        at,
      });
      return { outcome: 'moved' as const, changeSet, version: asset.version };
    });
  }

  async deleteAsset(
    ctx: ActorCtx,
    spaceId: string,
    input: z.infer<Routes['deleteAsset']['request']>,
  ): Promise<DeleteAssetResult> {
    await this.k.requireMember(ctx, spaceId);
    this.k.guardWrite();
    if (input.threadRootId && !(await this.k.store.getMessage(spaceId, input.threadRootId))) {
      throw new HarborError('invalid_request', 'threadRootId does not exist in this space');
    }
    const attribution = this.k.attributionOf(ctx, input);
    return this.k.lockedAs(ctx, spaceId, async () => {
      const asset = await this.requireLiveAsset(spaceId, input.assetId);
      if (input.baseVersion > asset.version) {
        throw new HarborError('invalid_request', `baseVersion ${input.baseVersion} is ahead of the asset (v${asset.version})`);
      }
      if (input.baseVersion !== asset.version) return this.staleAsset(spaceId, asset);
      const at = this.k.now();
      // Freeze in place: ro
```

### Core Architecture Module: `apps/harbor/packages/server/src/core/feed.ts`
```
import {
  parseMentions,
  stampsEqual,
  type Attribution,
  type Approval,
  type ApprovalRequest,
  type Invocation,
  type MembershipEvent,
  type MentionStamps,
  type Message,
  type Poll,
  type ReactionGroup,
  type Routes,
  type SearchKind,
  type SearchResults,
  type StreamEvent,
  type Topic,
  type TopicListing,
  type TopicRemoval,
} from '@rowboat/spaces-protocol';
import type { z } from 'zod';
import { HarborError } from '../errors.js';
import { legacyToTokens } from '../mentions-backfill.js';
import type { Notifier } from '../notify.js';
import { enforce, isAuthor } from '../policy.js';
import { parseSearchQuery } from '../search.js';
import type { MessageWindow, StoredPollVote, StoredReaction } from '../store.js';
import type { Assets } from './assets.js';
import type { InvocationOutbox, Invocations } from './invocations.js';
import { Kernel, type ActorCtx } from './kernel.js';

// The conversation (the annotation model, spec §7): one stream of root
// messages, flat threads, topics as annotation rows, reactions, polls, edits
// and tombstones, search, and the mention stamps every consumer reads.

/** listMessages window bounds — the default page and the per-request cap. */
const MESSAGES_PAGE_DEFAULT = 100;

const MESSAGES_PAGE_MAX = 200;

export type NewMessage = z.infer<Routes['postMessage']['request']>;

export type CreateTopicInput = z.infer<Routes['createTopic']['request']>;

/** A page request (protocol listStream / listThread query): at most one of the three offsets. */
export type PageOpts = { beforeOffset?: number; afterOffset?: number; aroundOffset?: number; limit?: number };
/** The log range a page answers for: offsets in (after, upTo], or to the head when upTo is null. */
type PageSpan = { after: number; upTo: number | null };

export type ManageTopicAction = z.infer<Routes['manageTopic']['request']>;

export type ReactInput = z.infer<Routes['reactToMessage']['request']>;

export type DeleteMessageInput = z.infer<Routes['deleteMessage']['request']>;

export type EditMessageInput = z.infer<Routes['editMessage']['request']>;

export type VotePollInput = z.infer<Routes['votePoll']['request']>;

export type EndPollInput = z.infer<Routes['endPoll']['request']>;

/** Poll duration when the create request names none — Discord's default. */
const DEFAULT_POLL_HOURS = 24;

/** The stamped addresses as they ride a Message (core.ts). */
function stampFields(stamps: MentionStamps): Pick<Message, 'mentions' | 'mentionsHere' | 'mentionsRowboat'> {
  return { mentions: [...stamps.members], mentionsHere: stamps.here, mentionsRowboat: stamps.rowboat };
}

function stampsOf(message: Message): MentionStamps {
  return { members: message.mentions, here: message.mentionsHere, rowboat: message.mentionsRowboat };
}

/** A message's thread pointer as an optional field — mirrored onto every event about the message so live clients route it without a lookup. */
function threadRootOf(message: Pick<Message, 'threadRoot'>): { threadRoot?: string } {
  return message.threadRoot !== undefined ? { threadRoot: message.threadRoot } : {};
}

export class Feed {
  constructor(
    private readonly k: Kernel,
    private readonly assets: Assets,
    /** Absent = no notifications on this org (notify.ts: frames + push). */
    private readonly notifier?: Notifier,
    /** Absent = no agent invocations (core/invocations.ts). */
    private readonly invocations?: Invocations,
  ) {}

  // --- mentions (protocol mentions.ts, 2026-09-10) -----------------------------
  // The org stamps who a message addresses from its mention TOKENS alone —
  // never from names — and only ids that are members of the space. Every
  // consumer (unread, Activity, push, chips) reads the stamp.

  private async stampsFor(spaceId: string, body: string): Promise<MentionStamps> {
    const parsed = parseMentions(body);
    const members: string[] = [];
    for (const id of parsed.members) {
      if (await this.k.store.getMembership(spaceId, id)) members.push(id);
    }
    return { members, here: parsed.here, rowboat: parsed.rowboat };
  }

  /** A mention follows you into the thread (the org's rule; @here follows nobody). */
  private async followMentioned(spaceId: string, rootMessageId: string, stamps: MentionStamps, authorId: string, at: string): Promise<void> {
    for (const id of stamps.members) {
      if (id === authorId) continue;
      await this.k.store.setThreadFollowing(spaceId, rootMessageId, id, true, at);
    }
  }

  // --- feed ------------------------------------------------------------------
  // The annotation model (spec §7, 2026-09-01): one stream of root messages,
  // flat threads behind reply chips (threadRoot, write-once), topics as
  // archivable annotation rows on threads. Posting never creates a container.

  /**
   * Live reaction and poll-vote state folded in — every read path carries
   * current truth. Both fields are at-post snapshots on the stored message
   * event; only reads are authoritative. Poll votes are fetched only when the
   * page actually carries a poll, so the common all-prose page costs nothing.
   */
  private async foldPage(spaceId: string, messages: Message[]): Promise<Message[]> {
    const byMessage = new Map<string, StoredReaction[]>();
    for (const r of await this.k.store.listReactionsForMessages(spaceId, messages.map((m) => m.id))) {
      byMessage.set(r.messageId, [...(byMessage.get(r.messageId) ?? []), r]);
    }
    const pollIds = messages.filter((m) => m.poll).map((m) => m.id);
    const votesByMessage = new Map<string, StoredPollVote[]>();
    if (pollIds.length > 0) {
      for (const v of await this.k.store.listPollVotesForMessages(spaceId, pollIds)) {
        votesByMessage.set(v.messageId, [...(votesByMessage.get(v.messageId) ?? []), v]);
      }
    }
    // An approval card shows its approval as it stands (spec §8 part 4), fetched only when the page carries one.
    const cardIds = messages.filter((m) => m.approval).map((m) => m.id);
    const approvals = new Map<string, Approval>();
    for (const a of await this.k.store.listApprovalsForMessages(spaceId, cardIds)) approvals.set(a.messageId, a);
    return messages.map((m) => ({
      ...m,
      reactions: foldReactions(byMessage.get(m.id) ?? []),
      ...(m.poll ? { poll: foldPollVotes(m.poll, votesByMessage.get(m.id) ?? []) } : {}),
      ...(m.approval && !m.deletedAt ? { approval: approvals.get(m.id) ?? m.approval } : {}),
    }));
  }

  private pageLimit(limit?: number): number {
    return Math.min(Math.max(limit ?? MESSAGES_PAGE_DEFAULT, 1), MESSAGES_PAGE_MAX);
  }

  async listTopics(ctx: ActorCtx, spaceId: string, includeArchived = false): Promise<TopicListing[]> {
    await this.k.requireReadableSpace(ctx, spaceId);
    const topics = await this.k.store.listTopics(spaceId, includeArchived);
    // Every consumer needs the root message (reply chips, parent cards,
    // unread anchors) — always folded in; activity computes from its denorm.
    // Folded like any page read: a root's reactions and poll votes are the
    // rail's business too (a poll root card with zero votes would lie).
    const roots: Message[] = [];
    for (const t of topics) {
      const root = await this.k.store.getMessage(spaceId, t.rootMessageId);
      if (root) roots.push(root);
    }
    const folded = new Map((await this.foldPage(spaceId, roots)).map((m) => [m.id, m]));
    const listings: TopicListing[] = topics.map((t) => {
      const root = folded.get(t.rootMessageId) ?? null;
      return { ...t, rootMessage: root, lastActivityAt: activityOf(root ?? undefined, t) };
    });
    // Newest activity first. Two activities in the same millisecond (a reply
    // and a root posted back to back) tie on the stamp — the event offset,
    // which is the order they actually happened in, breaks it.
    const activityOffset = (l: TopicListing) => l.rootMessage?.lastReplyOffset ?? l.rootMessage?.offset ?? 0;
    return listings.sort(
      (a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt) || activityOffset(b) - activityOffset(a) || b.id.localeCompare(a.id),
    );
  }

  /**
   * One page of a message list (protocol listStream / listThread windows):
   * the newest `limit` rows, the rows below `beforeOffset`, the rows above
   * `afterOffset`, or — `aroundOffset` — half the limit on each side of one
   * row, the row itself included. One extra row on each fetched side answers
   * hasMore / hasMoreAfter without a count query.
   */
  private async pageOf(
    fetch: (window: MessageWindow) => Promise<Message[]>,
    opts?: PageOpts,
  ): Promise<{ rows: Message[]; hasMore: boolean; hasMoreAfter: boolean; span: PageSpan }> {
    const given = [opts?.beforeOffset, opts?.afterOffset, opts?.aroundOffset].filter((v) => v !== undefined).length;
    if (given > 1) throw new HarborError('invalid_request', 'pass at most one of beforeOffset, afterOffset, aroundOffset');
    const limit = this.pageLimit(opts?.limit);
    if (opts?.aroundOffset !== undefined) {
      // Half the window below the anchor (exclusive); the rest from the anchor
      // up (inclusive: an exclusive edge one below it) — each side fetched one
      // row over its share to answer whether more lies beyond it.
      const belowShare = Math.floor(limit / 2);
      const aboveShare = limit - belowShare;
      const below = await fetch({ beforeOffset: opts.aroundOffset, limit: belowShare + 1 });
      const above = await fetch({ afterOffset: opts.aroundOffset - 1, limit: aboveShare + 1 });
      const hasMore = below.length > belowShare;
      const hasMoreAfter = above.length > aboveShare;
      const rows = [...(hasMore ? below.slice(1) : below), ...(hasMoreAfter ? above.slice(0, aboveShare) : above)];
      return {
        rows,
        hasMore,
        hasMoreAfter,
        span: { after: hasMore ? below[0]!.offset : 0, upTo: hasMoreAfter ? rows.at(-1)!.offset : null },
      };
    }
    if (opts?.afterOffset !== undefined) {
      const above = await fetch({ 
```

### Core Architecture Module: `apps/harbor/packages/server/src/core/images.ts`
```
import type { BlobInfo, Member } from '@rowboat/spaces-protocol';
import { blobHash, type BlobStore } from '../blobs.js';
import { HarborError } from '../errors.js';
import { imageDimensions, sniffMime } from '../mime.js';
import { canSetOrgLogo, enforce } from '../policy.js';
import { Kernel, type ActorCtx } from './kernel.js';

// Profile images (2026-10-02): a member's avatar and the org's logo. Unlike a
// space blob these are readable by every member of the org, so they get their
// own registry (org_images) instead of riding space_blobs: the bytes still
// live in the BlobStore under their sha256, and a hash is readable here only
// while this org has registered it. Images only, small, sniffed — a client's
// content-type is never trusted, and nothing is resized server-side (clients
// send a square of a few hundred pixels).

/** 1 MiB: a few-hundred-pixel square is tens of kilobytes; this is the abuse ceiling, not the target. */
export const MAX_PROFILE_IMAGE_BYTES = 1024 * 1024;
const PROFILE_IMAGE_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);

export class Images {
  constructor(
    private readonly k: Kernel,
    private readonly blobs?: BlobStore,
  ) {}

  private requireBlobStore(): BlobStore {
    if (!this.blobs) throw new HarborError('internal', 'file uploads are not configured on this org');
    return this.blobs;
  }

  /** Sniff, bound, store the bytes and register the hash on this org. */
  private async register(ctx: ActorCtx, bytes: Uint8Array): Promise<string> {
    if (bytes.byteLength === 0) throw new HarborError('invalid_request', 'the image is empty');
    if (bytes.byteLength > MAX_PROFILE_IMAGE_BYTES) {
      throw new HarborError('payload_too_large', `profile images are limited to ${MAX_PROFILE_IMAGE_BYTES} bytes`);
    }
    const mime = sniffMime(bytes);
    if (!mime || !PROFILE_IMAGE_MIMES.has(mime)) {
      throw new HarborError('invalid_request', 'profile images must be PNG, JPEG, WebP or GIF');
    }
    const blobs = this.requireBlobStore();
    const hash = blobHash(bytes);
    const dims = imageDimensions(bytes, mime);
    await blobs.put(bytes);
    await this.k.store.putOrgImage({
      hash,
      size: bytes.byteLength,
      mime,
      ...(dims ?? {}),
      uploadedBy: ctx.memberId,
      uploadedAt: this.k.now(),
    });
    return hash;
  }

  private async requireSelf(ctx: ActorCtx): Promise<Member> {
    const member = await this.k.store.getMember(ctx.memberId);
    if (!member) throw new HarborError('not_a_member', 'you are not a member of this org');
    return member;
  }

  /** Your own avatar. `origin` is the request's public origin: avatarUrl is an absolute URL on this org. */
  async setAvatar(ctx: ActorCtx, bytes: Uint8Array, origin: string): Promise<Member> {
    const member = await this.requireSelf(ctx);
    this.k.guardWrite();
    const hash = await this.register(ctx, bytes);
    const updated: Member = { ...member, avatarUrl: imageUrl(origin, hash) };
    await this.k.store.putMember(updated);
    return updated;
  }

  async clearAvatar(ctx: ActorCtx): Promise<Member> {
    const member = await this.requireSelf(ctx);
    if (member.avatarUrl === undefined) return member; // idempotent no-op: no write
    this.k.guardWrite();
    const { avatarUrl: _dropped, ...rest } = member;
    await this.k.store.putMember(rest);
    return rest;
  }

  /** The org's logo: an admin's to set (policy.ts). */
  async setOrgLogo(ctx: ActorCtx, bytes: Uint8Array, origin: string): Promise<{ logoUrl: string }> {
    enforce(canSetOrgLogo(await this.requireSelf(ctx)));
    this.k.guardWrite();
    const hash = await this.register(ctx, bytes);
    await this.k.store.setOrgLogo(hash, ctx.memberId, this.k.now());
    return { logoUrl: imageUrl(origin, hash) };
  }

  async clearOrgLogo(ctx: ActorCtx): Promise<Record<string, never>> {
    enforce(canSetOrgLogo(await this.requireSelf(ctx)));
    if ((await this.k.store.getOrgLogo()) === undefined) return {}; // idempotent no-op: no write
    this.k.guardWrite();
    await this.k.store.setOrgLogo(null, ctx.memberId, this.k.now());
    return {};
  }

  /** The org's logo as clients show it, or nothing. */
  async orgLogoUrl(ctx: ActorCtx, origin: string): Promise<string | undefined> {
    await this.k.requireOrgMember(ctx);
    const hash = await this.k.store.getOrgLogo();
    return hash ? imageUrl(origin, hash) : undefined;
  }

  /** The bytes back, to any member of the org: a presigned URL (S3-family) or the bytes (disk, memory). */
  async getImage(ctx: ActorCtx, hash: string): Promise<{ blob: BlobInfo; url?: string; bytes?: Uint8Array }> {
    await this.k.requireOrgMember(ctx);
    const blobs = this.requireBlobStore();
    const stored = await this.k.store.getOrgImage(hash);
    if (!stored) throw new HarborError('not_found', 'no such image on this org');
    const blob: BlobInfo = {
      hash: stored.hash,
      size: stored.size,
      mime: stored.mime,
      ...(stored.width !== undefined && stored.height !== undefined ? { width: stored.width, height: stored.height } : {}),
    };
    if (blobs.downloadUrl) {
      return { blob, url: await blobs.downloadUrl(hash, { expiresInSeconds: 300, responseContentType: stored.mime, responseContentDisposition: 'inline' }) };
    }
    const bytes = await blobs.get(hash);
    if (!bytes) throw new HarborError('internal', 'image registered but bytes are missing from storage');
    return { blob, bytes };
  }
}

/** Where an org image is served: the org's own origin, by hash. */
export function imageUrl(origin: string, hash: string): string {
  return `${origin}/v1/images/${hash}`;
}

```

### Core Architecture Module: `apps/harbor/packages/server/src/core/invocations.ts`
```
import {
  ConnectorCapabilities,
  type ActingMode,
  type Approval,
  type ApprovalClose,
  type ApprovalDecision,
  type ApprovalRequest,
  type Invocation,
  type InvocationOptionValues,
  type InvocationState,
  type InvocationUpdate,
  type Message,
  type ServerFrame,
  type Space,
} from '@rowboat/spaces-protocol';
import { HarborError } from '../errors.js';
import { canCancelQueuedInvocation, canDecideApproval, canStopInvocation, enforce, invocationRefusal } from '../policy.js';
import type { ActorCtx, Kernel } from './kernel.js';

// Invoking agent members (spec §8, 2026-09-30). Harbor decides and a
// connector carries out: a mention of an agent member, when policy allows it,
// becomes a durable invocation; Harbor holds one per (agent, conversation) at
// a time and queues the rest; the agent's connector acknowledges and reports
// state on the agent's own key. Every state change runs under the space lock
// of the invocation's space, so a post, an acknowledgement and a promotion out
// of the queue never interleave, and every frame leaves after the commit.

/** Delivered and not yet finished: at most one per (agent, conversation), plus answers to a waiting one. */
const LIVE: InvocationState[] = ['pending', 'working', 'waiting'];
const TERMINAL = new Set<InvocationState>(['done', 'failed', 'cancelled', 'refused']);

/**
 * A working invocation that has reported nothing for this long counts as
 * failed when its conversation next needs the turn. Connectors report
 * `working` again as a heartbeat. Pending (delivered to a connector that is
 * away) and waiting (on a person) never time out: durability is the point.
 */
const WORKING_TIMEOUT_MS = 30 * 60 * 1000;

/** How many of a space's invocations a listing returns, newest first. */
const LIST_LIMIT = 100;

/**
 * The owner's defaults that still fit what the connector declares (spec §8
 * Invocation options, 2026-10-01): a default for an option it no longer
 * declares, or a choice it no longer offers, is skipped rather than sent.
 */
export function applicableDefaults(capabilities: ConnectorCapabilities, defaults: InvocationOptionValues): InvocationOptionValues {
  const fit: InvocationOptionValues = {};
  for (const option of capabilities.options) {
    const value = defaults[option.key];
    if (value === undefined) continue;
    if (option.type === 'toggle' ? typeof value === 'boolean' : typeof value === 'string' && option.choices.some((c) => c.id === value)) {
      fit[option.key] = value;
    }
  }
  return fit;
}

/** Frames to send once the lock — the transaction — has returned. */
export type InvocationOutbox = Array<
  { to: 'agent'; memberId: string; frame: ServerFrame } | { to: 'space'; spaceId: string; frame: ServerFrame }
>;

export class Invocations {
  constructor(private readonly k: Kernel) {}

  // --- the trigger: Feed.postMessage calls this inside its space lock ------------

  /**
   * The agents a new message invokes (v1: mentions only). Each mentioned
   * agent member other than the author gets an invocation: refused (no
   * shared space, or past the hop limit), pending (its conversation is free,
   * or its turn is waiting on a person, which this answers), or queued.
   * Edits never invoke.
   */
  async onMessage(
    ctx: ActorCtx,
    space: Space,
    message: Message,
    agentOptions: Record<string, InvocationOptionValues> | undefined,
    out: InvocationOutbox,
  ): Promise<Invocation[]> {
    const created: Invocation[] = [];
    // The agents it mentions, and in a DM with an agent that agent, mention or
    // not (spec §8, amended 2026-09-30). The checks below keep a person's DMs
    // and a self-DM out: only an agent that is not the author is invoked.
    const invoked = new Set(message.mentions);
    if (space.kind === 'direct') for (const id of space.participants ?? []) invoked.add(id);
    for (const agentId of invoked) {
      if (agentId === message.author.memberId) continue;
      const agent = await this.k.store.getMember(agentId);
      if (agent?.kind !== 'agent') continue;
      const threadRootId = message.threadRoot ?? message.id;
      // An agent's post hands work on: one hop deeper than the deepest turn it is running (spec §8).
      const depth = ctx.agent ? 1 + (await this.deepestLive(ctx.memberId)) : 0;
      const shares = space.kind === 'shared' || (await this.k.store.sharesSharedSpace(message.author.memberId, agentId));
      const refusal = invocationRefusal(shares, depth);
      const now = this.k.now();
      // The owner's defaults fill what the invoker did not pick: a mention, a DM, an agent's hand-off alike.
      const options = { ...(await this.defaultsFor(agentId)), ...agentOptions?.[agentId] };
      const invocation: Invocation = {
        id: this.k.ulid(),
        agentId,
        conversation: { spaceId: space.id, threadRootId },
        trigger: { messageId: message.id, authorId: message.author.memberId, body: message.body },
        where: { spaceKind: space.kind, spaceName: space.name },
        depth,
        ...(options && Object.keys(options).length > 0 ? { options } : {}),
        state: 'refused',
        ...(refusal ? { refusal } : {}),
        createdAt: now,
        updatedAt: now,
      };
      if (!refusal) {
        const live = await this.settle(agentId, space.id, threadRootId, out);
        const turn = live.find((i) => !i.answers);
        if (!turn) invocation.state = 'pending';
        // One waiting on an approval is decided on its card: a mention queues (spec §8 part 4).
        else if (turn.state === 'waiting' && !(await this.hasOpenApproval(turn.id))) Object.assign(invocation, { state: 'pending', answers: turn.id });
        else invocation.state = 'queued';
      }
      await this.k.store.insertInvocation(invocation, message.offset);
      this.announce(invocation, out);
      created.push(invocation);
    }
    return created;
  }

  /** Send what the lock held back. */
  flush(out: InvocationOutbox): void {
    for (const item of out) {
      if (item.to === 'agent') this.k.hub.publishToMember(item.memberId, item.frame);
      else this.k.hub.publish(item.spaceId, item.frame);
    }
  }

  // --- the connector's operations: on an agent's own key, about its own invocations ---

  /** The agent's delivered, unfinished invocations: what a reconnecting connector picks up. */
  async listForAgent(ctx: ActorCtx): Promise<Invocation[]> {
    this.requireConnector(ctx);
    return this.k.store.listInvocationsForAgent(ctx.memberId, LIVE);
  }

  /** pending → working. Idempotent for one already acknowledged; a cancelled one must be dropped. */
  async acknowledge(ctx: ActorCtx, id: string): Promise<Invocation> {
    const found = await this.own(ctx, id);
    const out: InvocationOutbox = [];
    const result = await this.k.locked(found.conversation.spaceId, async () => {
      const current = (await this.k.store.getInvocation(id))!;
      if (current.state === 'working' || current.state === 'waiting') return current;
      if (current.state !== 'pending') throw new HarborError('invalid_request', `this invocation is ${current.state}: drop it`);
      const next: Invocation = { ...current, state: 'working', updatedAt: this.k.now() };
      await this.k.store.putInvocation(next);
      this.announce(next, out);
      return next;
    });
    this.flush(out);
    return result;
  }

  /** The connector's report: working (a heartbeat, with an activity line), waiting on a person, or an end state. */
  async update(ctx: ActorCtx, id: string, update: InvocationUpdate): Promise<Invocation> {
    const found = await this.own(ctx, id);
    const out: InvocationOutbox = [];
    const result = await this.k.locked(found.conversation.spaceId, async () => {
      const current = (await this.k.store.getInvocation(id))!;
      if (TERMINAL.has(current.state) || current.state === 'queued') {
        throw new HarborError('invalid_request', `this invocation is ${current.state}: it takes no reports`);
      }
      return this.apply(current, update, out);
    });
    this.flush(out);
    return result;
  }

  /**
   * The checked half of answering (Feed.postMessage `finishes`, spec §8
   * Connectors, 2026-09-30), run inside the answer's own transaction: the
   * invocation is this agent's, in this thread, and not finished. A replay of
   * an answer finds it done and posts nothing.
   */
  async assertFinishable(ctx: ActorCtx, id: string, spaceId: string, threadRootId: string): Promise<Invocation> {
    const current = await this.own(ctx, id);
    if (current.conversation.spaceId !== spaceId || current.conversation.threadRootId !== threadRootId) {
      throw new HarborError('invalid_request', 'an answer goes in its invocation\'s thread');
    }
    if (current.state !== 'working' && current.state !== 'waiting') {
      throw new HarborError('invalid_request', `this invocation is ${current.state}: it takes no answer`);
    }
    return current;
  }

  /** The other half: done, in the same transaction as the answer. */
  async finishWithin(current: Invocation, out: InvocationOutbox): Promise<Invocation> {
    return this.apply(current, { state: 'done' }, out);
  }

  private async apply(current: Invocation, update: InvocationUpdate, out: InvocationOutbox): Promise<Invocation> {
    // A heartbeat while an approval is open keeps it waiting: it shows waiting while any is (spec §8 part 4).
    if (update.state === 'working' && current.state === 'waiting' && (await this.hasOpenApproval(current.id))) {
      const held: Invocation = { ...current, ...(update.link ? { link: update.link } : {}), updatedAt: this.k.now() };
      await this.k.store.putInvocation(held);
      this.announce(held, out);
      return held;
    }
    const { activity: _activity, error: _error, ...rest } = current;
    const next: Invocation = { ...rest, state: update.state, updatedAt: this.k.now() };
    if (update.state === 'working' || update.state === 'waiting') {
      if (update.activity) next.activit
```

### Core Architecture Module: `apps/harbor/packages/server/src/core/kernel.ts`
```
import type { ActingMode, Attribution, Membership, ServerFrame, Space, SpaceEvent } from '@rowboat/spaces-protocol';
import { AsyncLocalStorage } from 'node:async_hooks';
import { monotonicFactory } from 'ulid';
import { HarborError } from '../errors.js';
import type { SpaceHub } from '../hub.js';
import { canAccessSpace, canReadSpace, canWrite, enforce } from '../policy.js';
import type { Store, StoredEvent } from '../store.js';

// The transactional core every aggregate is built on: the store and the hub,
// the org, the space lock with its publish-after-commit outbox, the log append
// and offset allocation, the access gate and the write guard, attribution.
// One instance per org; the aggregates (spaces, assets, feed, read-state) hold
// it as `k` and never reach around it — the invariant that every
// read-decide-write runs inside `locked` lives here and nowhere else.

export interface ActorCtx {
  memberId: string;
  /**
   * The caller is an agent member presenting its own key (2026-09-29): it
   * acts as itself, so attribution is always direct — never "via" anything.
   */
  agent?: boolean;
}

/** What bindInvite needs from an authenticated identity (auth.ts AuthIdentity satisfies this). */
export interface BindIdentity {
  iss: string;
  sub: string;
  email?: string;
  name?: string;
}

export interface OrgInfo {
  name: string;
  /** host[:port] — the org address links are minted on. Set once the listener knows its port. */
  address: string;
  /**
   * Org policy, v1 (spec §4, amended 2026-08-19): restrict membership to
   * these IdP-verified email domains, checked ONLY at invite bind. Empty or
   * absent = no restriction. Org-side by design — never on the wire.
   */
  allowedEmailDomains?: string[];
}

export class Kernel {

  readonly org: OrgInfo;

  /** Over-limit means read-only, never lockout (spec §4). Flip via the control plane; here a knob for tests. */
  readOnly = false;

  readonly ulid = monotonicFactory();

  constructor(
    readonly store: Store,
    readonly hub: SpaceHub,
    org: OrgInfo,
  ) {
    this.org = org;
  }

  now(): string {
    return new Date().toISOString();
  }

  guardWrite(): void {
    enforce(canWrite(this));
  }

  async requireSpace(spaceId: string): Promise<Space> {
    const space = await this.store.getSpace(spaceId);
    if (!space) throw new HarborError('not_found', `no such space`);
    return space;
  }

  async requireOrgMember(ctx: ActorCtx): Promise<void> {
    if (!(await this.store.getMember(ctx.memberId))) throw new HarborError('not_a_member', 'you are not a member of this org');
  }

  async requireReadableSpace(ctx: ActorCtx, spaceId: string): Promise<Space> {
    const space = await this.requireSpace(spaceId);
    const membership = await this.store.getMembership(spaceId, ctx.memberId);
    const orgMember = membership ? true : !!(await this.store.getMember(ctx.memberId));
    enforce(canReadSpace(space, membership, orgMember));
    return space;
  }

  /** The access gate: load the facts, let policy decide — THE rule is policy.ts canAccessSpace. */
  async requireMember(ctx: ActorCtx, spaceId: string): Promise<Space> {
    const space = await this.requireSpace(spaceId);
    const membership = await this.store.getMembership(spaceId, ctx.memberId);
    enforce(canAccessSpace(space, membership));
    return space;
  }

  /**
   * Publish after commit (2026-09-11). Inside the space lock — which on
   * Postgres IS the transaction — a frame must not reach the hub yet: a
   * subscriber arriving in that window would miss the event live (nobody
   * was listening) AND on replay (its catch-up read cannot see the
   * uncommitted row), and a rollback would leave phantoms on every socket.
   * So `append` parks frames in the lock's outbox and `locked` flushes them
   * once the lock — and the commit — has returned. Outside a lock the
   * outbox is empty and frames go straight out.
   */
  private readonly outbox = new AsyncLocalStorage<Array<{ spaceId: string; frame: ServerFrame }>>();

  /** The space lock, with the hub held back until the commit is durable; a thrown lock publishes nothing. */
  async locked<T>(spaceId: string, fn: () => Promise<T>): Promise<T> {
    const pending: Array<{ spaceId: string; frame: ServerFrame }> = [];
    const result = await this.store.withSpaceLock(spaceId, () => this.outbox.run(pending, fn));
    for (const { spaceId: target, frame } of pending) this.hub.publish(target, frame);
    return result;
  }

  /**
   * The space lock for a MEMBER'S act (2026-09-22): the access decision the
   * gate ran outside runs again inside the transaction, against the
   * membership as it stands now — so a write that passed the gate and then
   * waited behind a removal is refused instead of landing after the `left`
   * event. Same rule as the gate (policy.ts canAccessSpace), never a second
   * one. Acts that create the membership themselves (createSpace, openDirect,
   * acceptInvite) and operator passes use `locked`.
   */
  async lockedAs<T>(ctx: ActorCtx, spaceId: string, fn: (membership: Membership) => Promise<T>): Promise<T> {
    return this.locked(spaceId, async () => {
      const space = await this.requireSpace(spaceId);
      const membership = await this.store.getMembership(spaceId, ctx.memberId);
      enforce(canAccessSpace(space, membership));
      return fn(membership!);
    });
  }

  /** Append a durable event at `offset` (allocated by the caller inside the space lock) and fan it out after commit. */
  async append(spaceId: string, offset: number, at: string, event: SpaceEvent): Promise<void> {
    const stored: StoredEvent = { offset, at, event };
    await this.store.appendEvent(spaceId, stored);
    const frame: ServerFrame = { kind: 'event', spaceId, offset, at, event };
    const pending = this.outbox.getStore();
    if (pending) pending.push({ spaceId, frame });
    else this.hub.publish(spaceId, frame);
  }

  /** The next offset on the space's log — for a write that needs it before its event exists (message and change-set rows carry it). Inside the space lock only. */
  async nextOffset(spaceId: string): Promise<number> {
    return (await this.store.head(spaceId)) + 1;
  }

  /** Allocate and append in one step, for events nothing else needs the offset of first. Inside the space lock only. */
  async appendNext(spaceId: string, at: string, event: SpaceEvent): Promise<number> {
    const offset = await this.nextOffset(spaceId);
    await this.append(spaceId, offset, at, event);
    return offset;
  }

  /** Who did it and how (core.ts Attribution): the caller, in the mode the request declares, under its display label. */
  attributionOf(ctx: ActorCtx, input: { actingMode: ActingMode; agentName?: string }): Attribution {
    if (ctx.agent) return { memberId: ctx.memberId, actingMode: 'direct' };
    return { memberId: ctx.memberId, actingMode: input.actingMode, ...(input.agentName ? { agentName: input.agentName } : {}) };
  }
}

```

### Core Architecture Module: `apps/harbor/packages/server/src/core/read-state.ts`
```
import type { ActivityItem, ActivityKind, ActivityPage, Routes } from '@rowboat/spaces-protocol';
import type { z } from 'zod';
import { HarborError } from '../errors.js';
import type { Feed } from './feed.js';
import { Kernel, type ActorCtx } from './kernel.js';
import type { Spaces } from './spaces.js';

// Per-member cursors the org owns (read marks, follows), the unread snapshot,
// Activity, and mark-everything-read (the read-state arc, 2026-09-09).

export type MarkReadInput = z.infer<Routes['markRead']['request']>;

export type UnreadSnapshot = z.infer<Routes['unread']['response']>;

const DEFAULT_ACTIVITY_PAGE = 30;

// The activity cursor: the last item's instant and id, joined on a character
// neither contains (ISO instants and item ids are both `~`-free).
function encodeActivityCursor(row: { at: string; id: string }): string {
  return `${row.at}~${row.id}`;
}

function decodeActivityCursor(cursor: string): { at: string; id: string } {
  const i = cursor.indexOf('~');
  if (i <= 0 || i === cursor.length - 1) throw new HarborError('invalid_request', 'malformed activity cursor');
  return { at: cursor.slice(0, i), id: cursor.slice(i + 1) };
}

export class ReadState {
  constructor(
    private readonly k: Kernel,
    private readonly spaces: Spaces,
    private readonly feed: Feed,
  ) {}

  // --- read state ------------------------------------------------------------
  // Per-member cursors the org owns (read state, 2026-09-09) so every device
  // agrees. Offsets, never timestamps. Never on the log: a mark is private
  // member state, not a space fact — the member's other connections learn by
  // an ephemeral read_mark frame, and a reconnecting client refetches unread().

  /**
   * Advance the stream mark, or a thread's mark. Monotone; past head refuses.
   * A thread mark is recorded whether or not the member follows the thread
   * (2026-09-11): reading is what clears an Activity row, and @here in a
   * thread, a DM thread you never replied in, or a thread you unfollowed can
   * all put one there — following only governs badges and notifications.
   */
  async markRead(ctx: ActorCtx, spaceId: string, input: MarkReadInput): Promise<{ readOffset: number }> {
    await this.k.requireMember(ctx, spaceId);
    const head = await this.k.store.head(spaceId);
    if (input.offset > head) {
      throw new HarborError('invalid_request', `offset ${input.offset} is past the space's head (${head})`);
    }
    const at = this.k.now();
    let threadRootId: string | undefined;
    let readOffset: number;
    if (input.threadRootId !== undefined) {
      const root = await this.feed.resolveRoot(spaceId, input.threadRootId);
      threadRootId = root.id;
      readOffset = await this.k.store.advanceThreadReadMark(spaceId, root.id, ctx.memberId, input.offset, at);
    } else {
      readOffset = await this.k.store.advanceStreamReadMark(spaceId, ctx.memberId, input.offset, at);
    }
    this.k.hub.publishToMember(ctx.memberId, {
      kind: 'read_mark',
      spaceId,
      ...(threadRootId !== undefined ? { threadRootId } : {}),
      offset: readOffset,
      at,
    });
    return { readOffset };
  }

  /** Follow or unfollow a thread; the mark survives an unfollow. */
  async followThread(
    ctx: ActorCtx,
    spaceId: string,
    rootMessageId: string,
    following: boolean,
  ): Promise<{ following: boolean; readOffset: number }> {
    await this.k.requireMember(ctx, spaceId);
    const root = await this.feed.resolveRoot(spaceId, rootMessageId);
    const mark = await this.k.store.setThreadFollowing(spaceId, root.id, ctx.memberId, following, this.k.now());
    return { following: mark.following, readOffset: mark.readOffset };
  }

  // --- activity (2026-09-10) -------------------------------------------------
  // The member's feed is a query over facts the org already keeps (stamps,
  // follow rows, DM kind, reactions), never a second table: edits, deletes
  // and the backfill stay consistent for free, and unread is the read marks'
  // answer. Cursor = the last item's (at, id), opaque on the wire.

  async activity(
    ctx: ActorCtx,
    q: { kinds?: ActivityKind[]; spaceId?: string; unread?: boolean; cursor?: string; limit?: number },
  ): Promise<ActivityPage> {
    let spaces = await this.k.store.listSpacesFor(ctx.memberId, { includeDirect: true });
    if (q.spaceId !== undefined) {
      await this.k.requireMember(ctx, q.spaceId);
      spaces = spaces.filter((s) => s.id === q.spaceId);
    }
    const byId = new Map(spaces.map((s) => [s.id, s]));
    const limit = q.limit ?? DEFAULT_ACTIVITY_PAGE;
    const rows = await this.k.store.listActivity(ctx.memberId, {
      spaceIds: spaces.map((s) => s.id),
      ...(q.kinds ? { kinds: new Set(q.kinds) } : {}),
      ...(q.cursor !== undefined ? { before: decodeActivityCursor(q.cursor) } : {}),
      limit: limit + 1,
      unreadOnly: q.unread === true,
    });
    const page = rows.slice(0, limit);
    const items: ActivityItem[] = page.map((r) => {
      const space = byId.get(r.spaceId)!;
      return {
        id: r.id,
        kind: r.kind,
        spaceId: r.spaceId,
        spaceKind: space.kind,
        spaceName: space.name,
        ...(r.message.threadRoot !== undefined ? { threadRootId: r.message.threadRoot } : {}),
        message: r.message,
        actors: r.actors,
        ...(r.emoji !== undefined ? { emoji: r.emoji } : {}),
        at: r.at,
        unread: r.unread,
      };
    });
    const last = page[page.length - 1];
    // Names for everyone on the page, from the roster the caller may see —
    // actors and mention labels alike, so no client walks spaces for names.
    const wanted = new Set<string>();
    for (const item of items) {
      for (const actor of item.actors) wanted.add(actor.memberId);
      wanted.add(item.message.author.memberId);
      for (const id of item.message.mentions) wanted.add(id);
    }
    const names: Record<string, string> = {};
    if (wanted.size > 0) {
      for (const m of await this.spaces.listOrgMembers(ctx)) if (wanted.has(m.id)) names[m.id] = m.displayName;
    }
    return {
      items,
      ...(rows.length > limit && last ? { nextCursor: encodeActivityCursor(last) } : {}),
      seenAt: (await this.k.store.getActivitySeenAt(ctx.memberId)) ?? null,
      names,
    };
  }

  /**
   * Reactions through `at` read as seen. Monotone. The one instant a client
   * supplies is re-serialized first: marks are compared as text, which is
   * chronological only in the 24-character form the org itself writes.
   */
  async markActivitySeen(ctx: ActorCtx, at: string): Promise<{ seenAt: string }> {
    return { seenAt: await this.k.store.advanceActivitySeenAt(ctx.memberId, new Date(at).toISOString()) };
  }

  /**
   * "Mark everything read" (2026-09-11): every space the member is in (or the
   * one named) reads through its head, every thread holding an Activity row
   * for them reads through its newest reply, and reactions read as seen — so
   * Activity, the rail and every other device agree. Cheap: one stream mark
   * per space plus one statement for the threads. Marks only advance, so the
   * call is idempotent; each mark that moved echoes to the member's other
   * connections as a `read_mark` frame, the way single marks do.
   */
  async readAll(ctx: ActorCtx, input: { spaceId?: string }): Promise<{ spaces: Array<{ spaceId: string; readOffset: number }>; threads: number; seenAt: string }> {
    let spaces = await this.k.store.listSpacesFor(ctx.memberId, { includeDirect: true });
    if (input.spaceId !== undefined) {
      await this.k.requireMember(ctx, input.spaceId);
      spaces = spaces.filter((s) => s.id === input.spaceId);
    }
    const at = this.k.now();
    const out: Array<{ spaceId: string; readOffset: number }> = [];
    for (const space of spaces) {
      const head = await this.k.store.head(space.id);
      const before = await this.k.store.getStreamReadMark(space.id, ctx.memberId);
      const readOffset = head > before ? await this.k.store.advanceStreamReadMark(space.id, ctx.memberId, head, at) : before;
      out.push({ spaceId: space.id, readOffset });
      if (readOffset > before) this.k.hub.publishToMember(ctx.memberId, { kind: 'read_mark', spaceId: space.id, offset: readOffset, at });
    }
    const threads = await this.k.store.readAllThreads(ctx.memberId, spaces.map((s) => s.id), at);
    for (const t of threads) {
      this.k.hub.publishToMember(ctx.memberId, { kind: 'read_mark', spaceId: t.spaceId, threadRootId: t.rootMessageId, offset: t.readOffset, at });
    }
    const seenAt = await this.k.store.advanceActivitySeenAt(ctx.memberId, at);
    return { spaces: out, threads: threads.length, seenAt };
  }

  /** Every space the member is in (DMs included): cursor, unread roots, unread followed threads. */
  async unread(ctx: ActorCtx): Promise<UnreadSnapshot> {
    const spaces = await this.k.store.listSpacesFor(ctx.memberId, { includeDirect: true });
    const out: UnreadSnapshot['spaces'] = [];
    for (const space of spaces) {
      const head = await this.k.store.head(space.id);
      const readOffset = await this.k.store.getStreamReadMark(space.id, ctx.memberId);
      const threads = await this.k.store.listUnreadFollowedThreads(space.id, ctx.memberId);
      out.push({
        spaceId: space.id,
        head,
        readOffset,
        unreadRoots: await this.k.store.countUnreadRoots(space.id, ctx.memberId, readOffset),
        // The number on the space: mentions in unread roots plus mentions in the unread replies of followed threads.
        unreadMentions:
          (await this.k.store.countUnreadRootMentions(space.id, ctx.memberId, readOffset)) +
          threads.reduce((sum, t) => sum + t.unreadMentions, 0),
        threads,
      });
    }
    return { spaces: out };
  }
}

```

### Core Architecture Module: `apps/harbor/packages/server/src/core/spaces.ts`
```
import {
  inviteUrl,
  Member,
  type AcceptInviteResult,
  type CreateInviteResult,
  type Membership,
  type PresenceState,
  type ResolveInviteResult,
  type Routes,
  type Space,
} from '@rowboat/spaces-protocol';
import { randomBytes } from 'node:crypto';
import type { z } from 'zod';
import { HarborError } from '../errors.js';
import { canBind, canChangeMembership, canJoinSpace, canRenameSpace, enforce } from '../policy.js';
import { DIRECT_SPACE_NAME, directKeyFor, type PushLevel, type StoredEvent } from '../store.js';
import { Kernel, type ActorCtx, type BindIdentity } from './kernel.js';

// Spaces and membership: the org's containers and who is in them — spaces and
// direct messages, invites and the bind ceremony, the roster and its agent
// members, push registration, and the membership-gated live relays (presence,
// whiteboard, the subscribe-time replay).

function seedDisplayName(identity: BindIdentity): string {
  const name = identity.name?.trim();
  if (name) return name.slice(0, 128);
  const local = identity.email?.split('@')[0];
  if (local) return local.slice(0, 128);
  return identity.sub.slice(0, 24);
}

export type RenameSpaceInput = z.infer<Routes['renameSpace']['request']>;
export type AddMembersInput = z.infer<Routes['addMembers']['request']>;

const DEFAULT_INVITE_HOURS = 24 * 7;

export class Spaces {
  constructor(private readonly k: Kernel) {}

  // --- identity --------------------------------------------------------------

  /** The caller's own row — what /v1/me and whoami serve. */
  async me(ctx: ActorCtx): Promise<Member> {
    const member = await this.k.store.getMember(ctx.memberId);
    if (!member) throw new HarborError('not_found', 'member not found');
    return member;
  }

  /**
   * An agent member (spec §4 Agent members, 2026-09-29): a minted id, a
   * display name, never admin, and no identity binding, so no one signs in as
   * it. It joins spaces through ordinary membership. No route creates one on
   * its own: the integration that owns the agent calls this and gates who may.
   * The first is the Replicas coding agent (PR #1130).
   */
  async createAgent(input: { displayName: string; ownerId?: string; agentKind?: string; agentConnection?: string }): Promise<Member> {
    const displayName = input.displayName.trim();
    if (!Member.shape.displayName.safeParse(displayName).success) {
      throw new HarborError('invalid_request', 'an agent needs a display name of 1 to 128 characters');
    }
    this.k.guardWrite();
    // A member-added agent names its person (core/agents.ts); its kind and
    // connection default to custom/contract (spec §4 Agent members, 2026-09-30).
    const member: Member = {
      id: this.k.ulid(),
      displayName,
      role: 'member',
      kind: 'agent',
      ...(input.ownerId ? { ownerId: input.ownerId } : {}),
      agentKind: input.agentKind ?? 'custom',
      agentConnection: input.agentConnection ?? 'contract',
    };
    await this.k.store.putMember(member);
    return member;
  }

  // --- spaces & membership ---------------------------------------------------

  async listSpaces(ctx: ActorCtx, opts: { includeDirect?: boolean } = {}): Promise<Space[]> {
    return this.k.store.listSpacesFor(ctx.memberId, opts);
  }

  async browseSpaces(ctx: ActorCtx): Promise<Array<{ space: Space; joined: boolean }>> {
    await this.k.requireOrgMember(ctx);
    return this.k.store.browseSpaces(ctx.memberId);
  }

  async joinSpace(ctx: ActorCtx, spaceId: string): Promise<{ space: Space; membership: Membership }> {
    const result = await this.k.locked(spaceId, async () => {
      const space = await this.k.requireSpace(spaceId);
      await this.k.requireOrgMember(ctx);
      enforce(canJoinSpace(space));
      const existing = await this.k.store.getMembership(spaceId, ctx.memberId);
      if (existing) return { space, membership: existing, created: false };
      this.k.guardWrite();
      const membership: Membership = { spaceId, memberId: ctx.memberId, joinedAt: this.k.now() };
      await this.k.store.putMembership(membership);
      await this.k.appendNext(spaceId, membership.joinedAt, { type: 'membership', membership, action: 'joined' });
      return { space, membership, created: true };
    });
    if (result.created) this.k.hub.publishToMember(ctx.memberId, {
      kind: 'space_added', spaceId, spaceKind: 'shared', by: ctx.memberId, at: result.membership.joinedAt,
    });
    return { space: result.space, membership: result.membership };
  }

  async createSpace(ctx: ActorCtx, name: string, visibility: Space['visibility'] = 'private'): Promise<Space> {
    this.k.guardWrite();
    const now = this.k.now();
    const space: Space = { id: this.k.ulid(), name, createdAt: now, kind: 'shared', visibility };
    await this.k.store.putSpace(space);
    return this.k.locked(space.id, async () => {
      const membership: Membership = { spaceId: space.id, memberId: ctx.memberId, joinedAt: now };
      await this.k.store.putMembership(membership);
      await this.k.appendNext(space.id, now, { type: 'membership', membership, action: 'joined' });
      // The stream needs no object (annotation model): it is simply the
      // space's root messages, born empty.
      return space;
    });
  }

  /**
   * Rename a space (api.ts renameSpace): any member, Slack channel
   * semantics. Direct spaces refuse — their label derives from the
   * participants, not the stored name. Identical-name renames are an
   * idempotent no-op with no event; a real rename appends `space_renamed`
   * under the space lock so every follower updates its listing.
   */
  async renameSpace(ctx: ActorCtx, spaceId: string, input: RenameSpaceInput): Promise<Space> {
    const space = await this.k.requireMember(ctx, spaceId);
    enforce(canRenameSpace(space));
    this.k.guardWrite();
    const by = this.k.attributionOf(ctx, input);
    return this.k.lockedAs(ctx, spaceId, async () => {
      const current = (await this.k.store.getSpace(spaceId)) ?? space;
      if (current.name === input.name) return current; // idempotent, no event
      const updated: Space = { ...current, name: input.name };
      await this.k.store.putSpace(updated);
      await this.k.appendNext(spaceId, this.k.now(), { type: 'space_renamed', space: updated, by });
      return updated;
    });
  }

  /**
   * Direct messages (api.ts openDirect): get-or-create the one DM between
   * the caller and `otherMemberId`. Membership is written for both under the
   * new space's lock — two `joined` events are the whole membership history
   * of a DM, forever (no invites, no leave). The other participant is told
   * by a member-addressed `space_added` frame: the org is the trust
   * boundary, so there is no acceptance step. Two participants opening the
   * same DM at once both pass the lookup; the store's direct-key uniqueness
   * refuses the second row and that caller re-reads the winner's space.
   *
   * Your own id opens your SELF-DM (2026-09-08): one participant, one
   * membership, one `joined` event, nobody to tell. Notes to self that live
   * on the org — every device sees them, and so does your agent, through
   * the same face as any space.
   */
  async openDirect(ctx: ActorCtx, otherMemberId: string): Promise<{ space: Space; created: boolean }> {
    const self = otherMemberId === ctx.memberId;
    if (!self) {
      const other = await this.k.store.getMember(otherMemberId);
      if (!other) throw new HarborError('not_found', 'no such member on this org');
    }
    const participants = self ? [ctx.memberId] : [ctx.memberId, otherMemberId].sort();
    const key = directKeyFor(participants);
    const existing = await this.k.store.getDirectSpace(key);
    if (existing) return { space: existing, created: false };

    this.k.guardWrite();
    const now = this.k.now();
    const space: Space = { id: this.k.ulid(), name: DIRECT_SPACE_NAME, createdAt: now, kind: 'direct', visibility: 'private', participants };
    try {
      await this.k.store.putSpace(space);
    } catch (err) {
      const raced = await this.k.store.getDirectSpace(key);
      if (raced) return { space: raced, created: false };
      throw err;
    }
    await this.k.locked(space.id, async () => {
      let offset = await this.k.store.head(space.id);
      for (const memberId of participants) {
        const membership: Membership = { spaceId: space.id, memberId, joinedAt: now };
        await this.k.store.putMembership(membership);
        await this.k.append(space.id, ++offset, now, { type: 'membership', membership, action: 'joined' });
      }
    });
    if (!self) this.k.hub.publishToMember(otherMemberId, {
      kind: 'space_added',
      spaceId: space.id,
      spaceKind: 'direct',
      by: ctx.memberId,
      at: now,
    });
    return { space, created: true };
  }

  async listMembers(ctx: ActorCtx, spaceId: string): Promise<Member[]> {
    await this.k.requireReadableSpace(ctx, spaceId);
    return this.k.store.listSpaceMembers(spaceId);
  }

  /**
   * The org roster (api.ts listOrgMembers): every member, people and agents,
   * sorted by display name (case-insensitive, id breaks ties). Org-wide since
   * 2026-09-29 (spec §5 answer 4): inside one org the org is the trust
   * boundary, so anyone can find, DM, mention, or add anyone. It was bounded
   * to shared spaces until then; guests, when built, get that bound back.
   * Admins see nothing members do not.
   */
  async listOrgMembers(_ctx: ActorCtx): Promise<Member[]> {
    const members = await this.k.store.listAllMembers();
    return members.sort(
      (a, b) =>
        a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' }) || a.id.localeCompare(b.id),
    );
  }

  /**
   * Add existing org members, people or agents, to a shared space the caller
   * is in (spec §4 Roles: any member adds to spaces they are in; 2026-09-29).
   * All or nothing: every id must be an org member before anything is
   * written. Each one
```

### Core Architecture Module: `apps/x/apps/mobile/src/hooks/use-color-scheme.ts`
```
export { useColorScheme } from 'react-native';

```

### Core Architecture Module: `apps/x/apps/mobile/src/hooks/use-color-scheme.web.ts`
```
import { useEffect, useState } from 'react';
import { useColorScheme as useRNColorScheme } from 'react-native';

/**
 * To support static rendering, this value needs to be re-calculated on the client side for web
 */
export function useColorScheme() {
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    setHasHydrated(true);
  }, []);

  const colorScheme = useRNColorScheme();

  if (hasHydrated) {
    return colorScheme;
  }

  return 'light';
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1153** (2026-10-02): **Capy: its coding agent as an agent in Spaces**
  *Symptoms*: Adds Capy as a way to connect an agent: Harbor drives Capy's own coding agent through Capy's API, so it can be added to a space and mentioned like any agent (spec §8 Connectors). **Stacked on #1151 (Agent37)**, which it builds on (`connectors/thread-prompt.ts`, the platform hooks); merge that first.  ## What it does  **Harbor: a connector it runs** (`connectors/capy/`, built from Capy's [OpenAPI](https://docs.capy.ai/openapi.json)) - One Rowboat thread is one Capy thread in one Capy project. The first mention creates the thread; later mentions send into it. - **Nothing is sent twice.** Capy's API is idempotent:   - a thread is created with a `requestId` derived from the mention that starts it;   - a later mention is sent with its id as the `clientKey`;   - so after a restart the connector simply sends again, and Capy returns the same thread or reports the message deduplicated.   - It keeps one fact: which mention created the thread, because a create takes no client key. - **Queued, not interrupting:** messages go with `delivery: queue`, so they wait for work Capy is still finishing rather than interrupting it. Steering stays Deferred. - **Following a turn:** the thread's stream with `until=run` closes when the run ends. The thread's status and transcript then decide the outcome.   - The answer is Capy's last reply after the request, with its PR links.   - A failed run posts what Capy said and reports failed.   - Tool calls become the activity line. - **Stop** is Capy's interr

- **Issue #1152** (2026-10-02): **harbor: profile images — member avatars and the org logo**
  *Symptoms*: ## What  A member can set their own avatar, an admin can set the org's logo, and every member of the org can read both.  | Route | Who | Does | |---|---|---| | `PUT /v1/me/avatar` | you | body is the image; returns your `Member` with `avatarUrl` | | `DELETE /v1/me/avatar` | you | back to the initial (idempotent) | | `GET /v1/org/logo` | any member | `{ logoUrl? }` | | `PUT /v1/org/logo` | admin | sets the logo | | `DELETE /v1/org/logo` | admin | clears it (idempotent) | | `GET /v1/images/:hash` | any member of the org | the bytes (stream, or 302 to a presigned URL as `getBlob`) |  ## How  - Bytes ride the existing `BlobStore` under their sha256. `org_images` (migration 031) is the org-wide registry — the counterpart of `space_blobs` — and a hash is readable only while this org has registered it. `org_logos` holds the one logo. An avatar's URL uses the existing `members.avatar_url` / `Member.avatarUrl`. - Images only: the bytes must sniff as PNG, JPEG, WebP or GIF (the content-type is never trusted). At most 1 MiB. Stored as sent — no server-side resize, clients upload a small square. - `policy.canSetOrgLogo`: admins. A member's avatar is always their own. - New aggregate `core/images.ts`; one delegate each in `service.ts`; routes in `http.ts`. - Render face only, like `uploadBlob` — bytes don't pass through a tool. - No event is published; rosters and `me` carry the new value on the next read. - The dev seed no longer drops a member's avatar on restart.  ## Deploy  **Additive

- **Issue #1148** (2026-10-01): **Agent defaults and an agent page: set an agent's options once, see its setup any time**
  *Symptoms*: ## Why  The first mention of a Replicas agent in a thread, from a person, a DM or another agent handing work over, stopped at "Which Replicas environment should I use?". Nothing could set an environment ahead of time, and an agent couldn't pick one for a hand-off. Replicas's API has no default environment of its own; only its Slack bot keeps personal and org defaults.  Separately, an agent's setup steps (the MCP server, the skill, the settings) were shown only once, right after adding it or making a new key.  ## What changes  **Option defaults, per agent (SPEC §8 Invocation options).** - An agent's owner sets a default for any option its connector declares: Environment and Plan first for Replicas, or whatever a future connector declares. - Harbor fills those defaults into any invocation where the invoker picked nothing: a person's mention, a DM, or another agent's hand-off alike. Anything the invoker does pick wins. - A default for an option or choice the connector no longer offers is skipped. - **Wire:** `PUT /v1/agents/:agentId/option-defaults` is owner-only and app-only, and checked against the declared options. `GET /v1/agents/:agentId/capabilities` now also returns `defaults`. - **Storage:** migration 030 keeps defaults apart from what the connector declares, so a reconnect never loses them. - **Why per agent:** #1130 kept a default per agent per space instead, which leaves DMs with none. A team that wants different repositories adds one agent for each.  **The agent's pa

- **Issue #1147** (2026-10-01): **Agent approvals: a card in the thread, decided by a person**
  *Symptoms*: ## Why  Agents that act on someone's machine or accounts stop to ask before a risky step. Today Hermes's approval prompt can't be answered from a space at all: the plugin keeps the turn "working", so Harbor queues an `@Hermes /approve` behind the very turn that is waiting on it, and the command times out.  We checked how agents ask, from official docs, schemas and source. Hermes, OpenClaw, Codex (app-server), Claude Code (stream-json `can_use_tool`), OpenCode and ACP all send a **structured approval request**: the exact action, an optional reason, and a small set of choices. That request is separate from a question to the user. Replicas, Cursor's cloud agents, Capy and Agent37 have none; they run unattended. So an approval is its own record, not the waiting state.  ## What changes  SPEC §8 gains part 4. It holds every decision, made one concern at a time:  - **The record:** an approval belongs to an invocation and holds a title, the exact action as text, an optional reason, the choices the agent offers, and the agent's own request key (so a retry doesn't raise it twice). Its outcome is open → allowed / denied / expired / cancelled, plus who decided, when, and an optional note to the model. - **One set of choices for every agent:** Allow once, Allow in this thread, Always allow, Deny. Each connector maps its agent's own choices onto these. - **The card is a message in the thread.** The approval rides on the agent's reply the way a poll rides on its message. The body is a text 

- **Issue #1146** (2026-10-01): **Let a message name its Replicas environment, as [env:name]**
  *Symptoms*: ## Why  SPEC §8 says a coding agent's connector chooses where the work runs in this order: an option picked in the composer, then what the message names, then its own defaults. The Replicas connector never built the middle step. Without the composer, the only way to choose an environment was the follow-up question.  ## What changes  - **The connector reads `[env:backend]`**, the syntax of Replicas's own Slack bot (`@Replicas [env:backend] add a login page`, [docs](https://docs.replicas.dev/features/slack.md)). It matches a name in any case, or an id. The order is: the composer's pick, then the tag, then the only environment, then the question. - **The tag is removed from what the coding agent reads**, so a command after it still comes first: `@Claude [env:api] /plan …` reaches Replicas as `/plan …`. - **An environment name it doesn't have gets the question**, and the question now shows the syntax with the shortest environment name as the example: "Next time, you can name it in your message: [env:test]." - **SPEC §8** records the syntax. It also notes that over REST or MCP, `agentOptions` already chooses an environment by id, with no composer.  ## Verified  - Tests: a named environment is picked from several and the command still comes first; an unknown name gets the question, and the reply picks the environment. Harbor: 499 tests pass, typecheck clean. - Live against Replicas: `@ceecee [env:TEST] reply with just the word hi` ran in the `test` environment and answered "hi". `[

- **Issue #1145** (2026-10-01): **Agents see mention tokens, and learn Spaces from one skill**
  *Symptoms*: ## Why  In the first thread between Hermes and a Replicas agent, neither could reach the other. Both connectors flattened mention tokens into plain `@Name` before the agent saw them, so the agents answered with plain names, which reach no one. Harbor only ever acts on a token, and we keep it that way: no guessing mentions from names (Slack dropped that for apps in 2017).  ## What changes  - **Agents see the real tokens.** The Replicas connector keeps the tokens in what it sends, relabeled from the roster as the agent face already does, and writes every author and the person who asked as tokens. A mention of the agent itself is removed only before a `/command`. Anywhere else it stays, and the agent is told its own token ("You are [@ceecee](#member:…)"). - **One rule where the agent reads instructions** (the Replicas message here, Hermes's platform hint in the plugin): copy a token exactly to mention someone; agents see only messages that mention them; mention someone only to have them act or answer, and never to thank, acknowledge or sign off. - **The `rowboat-spaces` skill**, at `skills/rowboat-spaces/SKILL.md`, in the Agent Skills format: threads, mentions, handoffs and their limit, DMs, files, and the MCP tools. It is published once for every kind of agent.   - Hermes: `hermes skills install rowboatlabs/rowboat/skills/rowboat-spaces --yes`   - Replicas: add this repo as a skill registry on the environment   - Others: `npx skills add rowboatlabs/rowboat --skill rowboat-space

- **Issue #1142** (2026-09-30): **Replicas on the agent contract: agent kinds, connectors Harbor runs, and the Replicas connector**
  *Symptoms*: Redoes #1130's Replicas integration on the agent contract from #1140, and, along the way, gives every agent a kind and a connection. It was settled with Ramnique one decision at a time and written from Replicas's own API docs ([OpenAPI](https://docs.replicas.dev/openapi.json)), not from #1130's implementation.  ## Commits, one per layer  | # | Commit | What | |---|---|---| | 1 | **Spec and contract** | SPEC §4/§8: an agent's **kind** (what it is: `hermes`, a coding agent, `custom`) and **connection** (how Harbor reaches it: `plugin`, `contract`, or a platform Harbor calls, `replicas`). Both are fixed at creation, visible to everyone, and open strings on the wire, checked against `AGENT_PAIRS`. Connectors Harbor runs, sealed platform credentials, and a per-thread record. The DM rule: every message in a DM with an agent invokes it. "Files in a message". Agent-specific actions wait. SPEC §4 lists what must be addressed before running more than one Harbor instance. | | 2 | **Harbor core** | Migration 028 (existing agents → `custom`/`contract`; `agent_connection_credentials`; `agent_connection_threads`). `createAgent` takes kind, connection and, for a platform, its key, checked with the platform before anything is created and sealed (AES-256-GCM, from #1130's `credentials.ts`). `PUT /v1/agents/:id/credential`. `connectors/`: the host starts a connector per platform agent, at boot and on add. The DM rule. An answer is posted and its invocation marked done in one transaction. | | 3 

- **Issue #1141** (2026-09-30): **Require a work directory before offering the harness in chat**
  *Symptoms*: ## What  The assistant can only reach for Claude Code or Codex when the chat has a directory to run in. Two ways a chat gets one: the user picks it with the folder button beside the composer, or it is a Code session / Project, which comes with its cwd pinned.  Without a directory, `code_agent_run` is no longer in the assistant's resolved tool set. Previously the run fell back to "the user's default code repo", which is not a choice the user made in that chat.  ## How  - `RealAgentResolver` already resolves both directory sources per turn: `codeCwd` (a Code session's pin, via `sessionCompositionPins`) and `userWorkDir` (the composer's folder, keyed by `workDirId`). A new `harnessAvailable()` drops the harness when neither is set. The tool registry resolves only persisted descriptors, so an absent tool is never offered to the model. - The gate is keyed on the `workspaceContext` trait, so agents that resolve their repo elsewhere keep the tool: the to-do item agent (its threads either pin a code session or use the default repo, as documented in `todo/agent.ts`) and background tasks. - The same filter runs where active skills re-attach tools, so a disk skill declaring `code_agent_run` cannot route around it. - `launch-code-task` is untouched: its repo comes from a background task's configured code project, not from the chat's directory. - `HARNESS_TOOL` is named in `base-tools.ts` so the base list and the gate cannot drift. - The skill catalog is built once per app state and canno

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

### Incident Patch 1: `81930a73` (2026-10-01)
**Commit Message**: Build agent approvals in Harbor: raised with a card, decided by a person

An approval is its own record on an invocation (approval.ts, migration
029). The connector raises it with POST /v1/agent/invocations/:id/approvals;
Feed.postMessage posts the agent's card as a reply in the same
transaction, the approval riding on it as a poll does, and the
invocation waits. A person decides with POST
/v1/spaces/:spaceId/approvals/:id/decide: any member acting directly,
never an agent or a tool, first decision wins, a note only with a deny.
The decision reaches the connector as approval_decided and stays in its
listing until it confirms applying it; the connector closes ones its
agent gave up on. Every change is an approval event; reads fold the
current approval onto the card. While one is open the invocation stays
waiting through heartbeats and a mention queues; an invocation that
ends cancels its open approvals.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `apps/harbor/AGENTS.md` (modified, +2/-2)
```diff
@@ -6,15 +6,15 @@ Harbor is the Spaces server: orgs, spaces, members, an append-only log, three fa
 
 Two pnpm workspace packages under `packages/`:
 
-- **`protocol/`** — `@rowboat/spaces-protocol`, the contract: zod schemas imported by the server *and* the app, so drift is structurally impossible. `core.ts` (the objects), `ids.ts` (ids, the link grammar and its one parser), `changeset.ts`, `events.ts` (`SpaceEvent` and the live frames), `invocation.ts` (the agent contracts: `Invocation`, its states, `InvocationOption`, `InvocationUpdate`, `ConnectorCapabilities`), `api.ts` (`routes`), `mcp.ts` (`mcpTools`), `mentions.ts`, `search.ts`, `invite.ts`, `errors.ts`, `fixtures/merge/` (the golden merge cases every engine must pass).
+- **`protocol/`** — `@rowboat/spaces-protocol`, the contract: zod schemas imported by the server *and* the app, so drift is structurally impossible. `core.ts` (the objects), `ids.ts` (ids, the link grammar and its one parser), `changeset.ts`, `events.ts` (`SpaceEvent` and the live frames), `invocation.ts` (the agent contracts: `Invocation`, its states, `InvocationOption`, `InvocationUpdate`, `ConnectorCapabilities`), `approval.ts` (`Approval`, an agent's request for a person's OK, and its choices), `api.ts` (`routes`), `mcp.ts` (`mcpTools`), `mentions.ts`, `search.ts`, `invite.ts`, `errors.ts`, `fixtures/merge/` (the golden merge cases every engine must pass).
 - **`server/`** — `@rowboat/harbor`:
 
 | `src/` | Owns |
 |---|---|
 | `core/kernel.ts` | store, hub, org, the read-only knob, the space lock with its publish-after-commit outbox, `append` / `nextOffset` / `appendNext`, `requireSpace` / `requireReadableSpace` / `requireMember`, `guardWrite`, `attributionOf` |
 | `core/spaces.ts` | spaces, direct messages, invites and the bind ceremony, the roster, `me`, agent members (`createAgent`), push registration, the read-gated replay and membership-gated live relays |
 | `core/agents.ts` | agent members' owners and keys: add an agent, list the ones a member manages, create and revoke keys |
-| `core/invocations.ts` | invoking agent members (spec §8): the trigger `Feed.postMessage` runs in its transaction, the per-(agent, conversation) queue, the connector's operations, cancel and stop; its frames leave after the commit through its own outbox |
+| `core/invocations.ts` | invoking agent members (spec §8): the trigger `Feed.postMessage` runs in its transaction, the per-(agent, conversation) queue, the connector's operations, cancel and stop, and approvals (part 4: raised with their card in `Feed.postMessage`'s transaction, decided by a person, settled by the connector; `approval-card.ts` writes the card's text); its frames leave after the commit through its own outbox |
 | `core/assets.ts` | assets by id, versions, the change log, blobs, history, diff |
 | `core/feed.ts` | messages, threads, topics, reactions, polls, search, mention stamps and their backfill |
 | `core/read-state.ts` | read marks, follows, unread, Activity, read-all |
```

**File**: `apps/harbor/CONTRACT.md` (modified, +1/-0)
```diff
@@ -30,6 +30,7 @@ How the server is built — modules, invariants, the slice a capability cuts thr
 - **Any member adds existing members to a space they are in** (`addMembers`, `add_members`, the membership event's `by` — 2026-09-29, [spec §4](./SPEC.md#4-orgs-and-identity) Roles). `POST /v1/spaces/:spaceId/members {memberIds}` adds org members, people or agents, to a shared space the caller is a member of; browsing an open space is not enough, and direct spaces refuse (`invalid_request`). It is all or nothing: an id that is not an org member is `not_found` and nothing is written. Each member added gets the ordinary `membership` `joined` event, now carrying `by` (the adder's `Attribution`, so an agent's add reads "via"), and a `space_added` frame on their member channel after the commit. `by` is absent whenever the member acted themselves (accepting an invite, self-join, leaving), so an older client that drops it still reads "joined". Anyone already in is a no-op: `memberships` answers for every id asked, in the order asked, and a request that adds nobody writes nothing and passes a read-only org. The added member is not notified in v1 (no `notify` frame, no push, no Activity row): the space appears in their sidebar, and the stream's join line says who added them (the next bullet).
 - **The stream shows membership as lines between messages** (`listStream` `events`, `StreamEvent` — 2026-09-29). Each page carries, oldest first, the `membership` events (joined, left, removed, with `by` when someone else acted) whose offsets fall in the range the page answers for: an event belongs to the page holding the next message after it, and the newest page also takes the events after its newest message, so paging back, forward, or around a message shows each event exactly once, and a space nobody has posted in still shows its joins. This is the Matrix model, not Slack's: the fact stays in the log and the client draws the line, so no system message exists for unread counts, notifications, search, Activity, or agents to skip. Live, the same events arrive as ordinary `event` frames. Older orgs omit the field; it defaults to empty.
 - **Agent invocations** (`Invocation`, `InvocationUpdate`, `ConnectorCapabilities` in `invocation.ts`; the `invocation`, `invocation_stop` and `invocation_state` frames; migration 027 — 2026-09-30, [spec §8](./SPEC.md#8-agents-in-spaces) Invoking agent members). A posted message that mentions an agent member (not its author) invokes it, and so does every message a person posts in a direct space with an agent member, mention or not (2026-09-30), decided in the message's own transaction. `postMessage` answers with `invocations` for every agent it invoked, or was refused to: `refused` with `not_permitted` when the invoker shares no shared space with the agent (a DM alone does not count), or `hop_limit` when an agent's post would be the fourth hand-off (depth = 1 + the deepest live invocation of the posting agent; a person's mention is 0). The `post_message` tool returns the same as `invocations: [{agentId, state, refusal?}]`. `NewMessage.agentOptions` (keyed by agent id) lands on that agent's invocation uninterpreted; entries for agents the message does not invoke are dropped. Edits never invoke. Per (agent, conversation), where the conversation is the thread root, one invocation is live at a time: a new one is `pending` when the conversation is free, `pending` with `answers` when the live one is `waiting`, and otherwise `queued`, promoted to `pending` when the live one ends, in the order the triggering messages were posted (their stream offsets, assigned under the space lock, so the order holds across Harbor instances whatever their clocks say). Every state change runs in a transaction holding the space's Postgres advisory lock, so the queue is correct with any number of Harbor instances on one database. A `working` invocation that has reported nothing for 30 minutes is marked `failed` the next time its conversation needs the turn; `pending` and `waiting` never time out. **The connector's routes take an agent key and act only on that agent's own invocations** (a person is `forbidden`, another agent's invocation `not_found`): `GET /v1/agent/invocations` lists the pending, working and waiting ones for a reconnecting connector; `POST /v1/agent/invocations/:invocationId/ack` moves pending to working (idempotent; a cancelled one answers `invalid_request`, drop it); `POST /v1/agent/invocations/:invocationId/update` takes an `InvocationUpdate` (`working` as a heartbeat with an optional `activity` and `link`, `waiting` with the `activity` it needs, `done`, `failed` with an `error`, `cancelled`), refused once the invocation is finished; `POST /v1/agent/capabilities` declares `ConnectorCapabilities` (`stop`, up to 8 `options`), again whenever they change. An agent's connections get `invocation` when one becomes pending (new, or out of the queue) and `invocation_stop` when someone stops a running one; both are 
```

**File**: `apps/harbor/packages/protocol/src/api.ts` (modified, +43/-1)
```diff
@@ -23,6 +23,7 @@ import {
   ResolveInviteResult,
 } from './invite.js';
 import { StreamEvent } from './events.js';
+import { Approval, ApprovalClose, ApprovalDecision, ApprovalId, ApprovalRequest } from './approval.js';
 import { ConnectorCapabilities, Invocation, InvocationId, InvocationOptionValues, InvocationUpdate } from './invocation.js';
 import { SearchKind, SearchResults } from './search.js';
 
@@ -338,7 +339,8 @@ export const routes = {
   listAgentInvocations: {
     method: 'GET',
     path: '/v1/agent/invocations',
-    response: z.object({ invocations: z.array(Invocation) }),
+    /** `approvals`: decisions on the agent's approvals it has not yet confirmed applying (spec §8 part 4). */
+    response: z.object({ invocations: z.array(Invocation), approvals: z.array(Approval).default([]) }),
   },
   acknowledgeInvocation: {
     method: 'POST',
@@ -353,6 +355,34 @@ export const routes = {
     request: InvocationUpdate,
     response: z.object({ invocation: Invocation }),
   },
+  /**
+   * Raise an approval on one of the agent's working invocations (spec §8
+   * part 4, 2026-10-01): posts the agent's card in the invocation's thread,
+   * with the approval riding on it, and shows the invocation waiting. Raising
+   * the same requestKey again returns the first.
+   */
+  requestApproval: {
+    method: 'POST',
+    path: '/v1/agent/invocations/:invocationId/approvals',
+    params: z.object({ invocationId: InvocationId }),
+    request: ApprovalRequest,
+    response: z.object({ approval: Approval, message: Message }),
+  },
+  /** The connector passed a decision to its agent: it leaves the listing. Idempotent. */
+  applyApproval: {
+    method: 'POST',
+    path: '/v1/agent/approvals/:approvalId/applied',
+    params: z.object({ approvalId: ApprovalId }),
+    response: z.object({ approval: Approval }),
+  },
+  /** The connector closes an approval its agent no longer waits on (it expired, or the turn went). A settled one is returned as it is. */
+  closeApproval: {
+    method: 'POST',
+    path: '/v1/agent/approvals/:approvalId/close',
+    params: z.object({ approvalId: ApprovalId }),
+    request: ApprovalClose,
+    response: z.object({ approval: Approval }),
+  },
   declareCapabilities: {
     method: 'POST',
     path: '/v1/agent/capabilities',
@@ -374,6 +404,18 @@ export const routes = {
     query: z.object({ threadRootId: MessageId.optional() }),
     response: z.object({ invocations: z.array(Invocation) }),
   },
+  /**
+   * Decide an approval (spec §8 part 4): any person who can see it, acting
+   * directly. Never an agent and never a tool, so a person's assistant cannot
+   * either. The first decision wins; a deny may carry a note to the model.
+   */
+  decideApproval: {
+    method: 'POST',
+    path: '/v1/spaces/:spaceId/approvals/:approvalId/decide',
+    params: z.object({ spaceId: SpaceId, approvalId: ApprovalId }),
+    request: ApprovalDecision.extend({ actingMode: ActingMode }),
+    response: z.object({ approval: Approval }),
+  },
   /** Cancel a queued invocation (its invoker), or stop a running one (its invoker or an admin, when the connector can stop). */
   cancelInvocation: {
     method: 'POST',
```

**File**: `apps/harbor/packages/protocol/src/approval.ts` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+import { z } from 'zod';
+import { MemberId, MessageId, SpaceId } from './ids.js';
+
+// Approvals (spec §8 part 4, 2026-10-01). An agent that acts on someone's
+// machine or accounts stops to ask before a risky step; every agent protocol
+// that asks does it with a structured request of its own (Hermes, OpenClaw,
+// Codex, Claude Code, OpenCode, ACP), so an approval is its own record on an
+// invocation, not the waiting state. The card is the agent's message in the
+// thread, with the approval riding on it as a poll rides on its message. Kept
+// apart from invocation.ts so core.ts (Message) can import it without a cycle.
+
+export const ApprovalId = z.string().min(1).max(64);
+export type ApprovalId = z.infer<typeof ApprovalId>;
+
+/**
+ * One set of choices for every agent: Allow once, Allow in this thread (every
+ * connector maps a thread to one session of its agent), Always allow (the
+ * agent remembers it beyond the thread), Deny. A connector maps its agent's
+ * own choices onto these and offers the subset its agent takes. Ending the
+ * whole turn is Stop, not a choice.
+ */
+export const ApprovalChoice = z.enum(['allow_once', 'allow_session', 'allow_always', 'deny']);
+export type ApprovalChoice = z.infer<typeof ApprovalChoice>;
+
+/** What each choice says on the card, and in its text rendering. */
+export const APPROVAL_CHOICE_LABELS: Record<ApprovalChoice, string> = {
+  allow_once: 'Allow once',
+  allow_session: 'Allow in this thread',
+  allow_always: 'Always allow',
+  deny: 'Deny',
+};
+
+/** `open` until a person decides (`allowed`, `denied`) or the connector closes it (`expired`: the agent gave up; `cancelled`). */
+export const ApprovalState = z.enum(['open', 'allowed', 'denied', 'expired', 'cancelled']);
+export type ApprovalState = z.infer<typeof ApprovalState>;
+
+export const Approval = z.object({
+  id: ApprovalId,
+  /** The invocation it belongs to (an InvocationId). */
+  invocationId: z.string().min(1).max(64),
+  agentId: MemberId,
+  conversation: z.object({ spaceId: SpaceId, threadRootId: MessageId }),
+  /** The agent's card: the message this approval rides on. */
+  messageId: MessageId,
+  /** The agent's own id for the request: a connector raising it again gets this one back. */
+  requestKey: z.string().min(1).max(200),
+  /** One line: "Run a command", "Edit 3 files". */
+  title: z.string().min(1).max(200),
+  /** The exact action, as text: the command and its directory, a diff summary, a tool and its input. */
+  detail: z.string().max(8000),
+  /** Why the agent asks, when it says. */
+  reason: z.string().max(1000).optional(),
+  /** The choices this agent offers, in the card's order. */
+  choices: z.array(ApprovalChoice).min(1).max(4),
+  state: ApprovalState,
+  decision: ApprovalChoice.optional(),
+  decidedBy: MemberId.optional(),
+  decidedAt: z.iso.datetime().optional(),
+  /** A note back to the model, with a deny. */
+  note: z.string().max(1000).optional(),
+  /** When the connector confirmed it passed the decision to its agent. */
+  appliedAt: z.iso.datetime().optional(),
+  createdAt: z.iso.datetime(),
+  updatedAt: z.iso.datetime(),
+});
+export type Approval = z.infer<typeof Approval>;
+
+/** A connector raising an approval on one of its invocations. */
+export const ApprovalRequest = z.object({
+  requestKey: Approval.shape.requestKey,
+  title: Approval.shape.title,
+  detail: Approval.shape.detail,
+  reason: Approval.shape.reason,
+  choices: z
+    .array(ApprovalChoice)
+    .min(1)
+    .max(4)
+    .refine((choices) => new Set(choices).size === choices.length, 'each choice once'),
+});
+export type ApprovalRequest = z.infer<typeof ApprovalRequest>;
+
+/** A person's decision. Deciding is REST only, never a tool, and never by an agent (spec §8 part 4). */
+export const ApprovalDecision = z.object({
+  decision: ApprovalChoice,
+  /** Only with a deny: what the model is told. */
+  note: z.string().max(1000).optional(),
+});
+export type ApprovalDecision = z.infer<typeof ApprovalDecision>;
+
+/** The connector closing one its agent no longer waits on. */
+export const ApprovalClose = z.object({ state: z.enum(['expired', 'cancelled']) });
+export type ApprovalClose = z.infer<typeof ApprovalClose>;
```

**File**: `apps/harbor/packages/protocol/src/core.ts` (modified, +8/-0)
```diff
@@ -1,4 +1,5 @@
 import { z } from 'zod';
+import { Approval } from './approval.js';
 import { AssetId, ChangeSetId, MemberId, MessageId, SpaceId, StreamOffset, TopicId } from './ids.js';
 
 // Core objects shared by both faces. Every act in a space belongs to a member
@@ -384,6 +385,13 @@ export const Message = z.object({
    * the poll along with the body.
    */
   poll: Poll.optional(),
+  /**
+   * Present on an agent's approval card (spec §8 part 4, 2026-10-01), folded
+   * to its current state wherever messages are read; `approval` space events
+   * carry each change. `body` keeps a text rendering for clients that cannot
+   * show the card.
+   */
+  approval: Approval.optional(),
   /**
    * Who this message addresses — STAMPED by the org at post and edit from the
    * body's mention tokens (mentions.ts), never from names, and only ids that
```

**File**: `apps/harbor/packages/protocol/src/events.ts` (modified, +17/-0)
```diff
@@ -2,6 +2,7 @@ import { z } from 'zod';
 import { ChangeSet } from './changeset.js';
 import { Attribution, Membership, Message, MessageDeletion, MessageEdit, PollEnd, PollVote, Reaction, Space, SpaceKind, Topic, TopicRemoval } from './core.js';
 import { AssetId, MemberId, MessageId, SpaceId, StreamOffset } from './ids.js';
+import { Approval } from './approval.js';
 import { Invocation, InvocationId } from './invocation.js';
 
 // Decision 2 (CONTRACT.md): one WebSocket per org, per-space subscriptions,
@@ -104,6 +105,16 @@ export const SpaceEvent = z.discriminatedUnion('type', [
     type: z.literal('poll_ended'),
     end: PollEnd,
   }),
+  /**
+   * An approval changed (spec §8 part 4, 2026-10-01): decided, or closed by
+   * its connector. Carries the whole approval; the stored card message keeps
+   * the at-request one, and folding clients replace the card's `approval`
+   * with this, the way they fold poll votes.
+   */
+  z.object({
+    type: z.literal('approval'),
+    approval: Approval,
+  }),
   /**
    * The space was renamed (api.ts renameSpace) — the full row plus who did
    * it, so clients update their listings and the feed can render an
@@ -278,6 +289,12 @@ export const ServerFrame = z.discriminatedUnion('kind', [
   z.object({ kind: z.literal('invocation'), invocation: Invocation }),
   /** Addressed to an AGENT member's connections: stop this running invocation, then report it cancelled. */
   z.object({ kind: z.literal('invocation_stop'), invocationId: InvocationId }),
+  /**
+   * Addressed to an AGENT member's connections: a person decided one of its
+   * approvals (spec §8 part 4). Ephemeral like `invocation`: the connector's
+   * listing returns every decision it has not confirmed applying.
+   */
+  z.object({ kind: z.literal('approval_decided'), approval: Approval }),
   /**
    * To a space's subscribers, on every change of state of an invocation in
    * it: the working indicator, what it waits for, a refused line. Ephemeral,
```

**File**: `apps/harbor/packages/protocol/src/index.ts` (modified, +1/-0)
```diff
@@ -9,6 +9,7 @@ export * from './core.js';
 export * from './changeset.js';
 export * from './events.js';
 export * from './invocation.js';
+export * from './approval.js';
 export * from './invite.js';
 export * from './search.js';
 export * from './mentions.js';
```

**File**: `apps/harbor/packages/server/src/core/approval-card.ts` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+import { APPROVAL_CHOICE_LABELS, mentionsAsText, type ApprovalRequest } from '@rowboat/spaces-protocol';
+
+// The text an approval card's message carries (spec §8 part 4, 2026-10-01):
+// what clients that cannot show the card render, and what an agent reading
+// the thread sees. The exact action goes in a code block, so a mention token
+// in it is a cite, not an address; the title and reason are flattened for
+// the same reason.
+
+export function approvalCardBody(agentName: string, request: ApprovalRequest): string {
+  const plain = (text: string) => mentionsAsText(text, new Map()).replace(/\s+/g, ' ').trim();
+  const longestTicks = Math.max(0, ...[...request.detail.matchAll(/`+/g)].map((m) => m[0].length));
+  const fence = '`'.repeat(Math.max(3, longestTicks + 1));
+  const parts = [`**${plain(request.title)}**`];
+  if (request.detail.trim()) parts.push(`${fence}\n${request.detail}\n${fence}`);
+  if (request.reason) parts.push(`Why: ${plain(request.reason)}`);
+  const choices = request.choices.map((c) => APPROVAL_CHOICE_LABELS[c]).join(', ');
+  parts.push(`_${plain(agentName)} is waiting for approval in Rowboat: ${choices}._`);
+  return parts.join('\n\n');
+}
```

---

### Incident Patch 2: `ca790c9d` (2026-09-30)
**Commit Message**: Build agent kinds, platform credentials, and the connector host in Harbor

Commit 2 of redoing Replicas on the agent contract.

- Migration 028: members.agent_kind/agent_connection (existing agents become
  custom/contract; a check keeps them set exactly for agents),
  agent_connection_credentials (sealed, one per agent, with a rejection
  mark), and agent_connection_threads (a connector's record per thread).
- createAgent takes kind, connection and, for a platform connection, the
  platform's key: the pair must be listed, the key is checked with the
  platform before anything is created, and sealed (sealing.ts, carried
  over from #1130's credentials.ts). PUT /v1/agents/:id/credential
  replaces it (owner only) and clears a rejection; listAgents shows its
  hint and rejection, never the secret.
- connectors/: the host starts a connector for every platform agent, at
  boot (a deployment now warms the orgs that have one) and when one is
  added, and hands it the contract in-process as its agent. PLATFORMS is
  empty until the Replicas connector lands.
- In a DM with an agent, every message the person posts invokes it.
- A connector's answer is posted and its invocation marked done i

**File**: `apps/harbor/CONTRACT.md` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ How the server is built — modules, invariants, the slice a capability cuts thr
 - **An agent has a kind and a connection** (`Member.agentKind`, `Member.agentConnection`, `AGENT_PAIRS`, `HARBOR_RUN_CONNECTIONS`, `AgentCredential`, `setAgentCredential`, migration 028 — 2026-09-30, [spec §4](./SPEC.md#4-orgs-and-identity) Agent members and [§8](./SPEC.md#8-agents-in-spaces) Connectors). Both are set on every agent and absent on people, fixed at creation, and open strings on the wire, so a client draws a kind it doesn't know as a generic agent; migration 028 marks every existing agent `custom` / `contract`. `createAgent` takes `kind` and `connection` (absent: `custom` / `contract`, so older clients are unaffected), and a pair not in `AGENT_PAIRS` is `invalid_request`. A pair whose connection is in `HARBOR_RUN_CONNECTIONS` (`replicas`) also needs `credential`, the platform's key: Harbor checks it with the platform before anything is created (a refusal is `invalid_request` with the platform's reason, and nothing is written) and seals it; any other connection takes none. `PUT /v1/agents/:agentId/credential {secret}` replaces it, owner only, checked the same way, and clears a rejection. The secret is never returned: `listAgents` carries `credential` (`hint`, the last four characters; `setBy`; `setAt`; and `rejectedAt` with `rejectedReason` once the platform has refused it). Such an agent's keys work like any agent's; Harbor runs its connector, which acts as the agent in-process.
 - **Any member adds existing members to a space they are in** (`addMembers`, `add_members`, the membership event's `by` — 2026-09-29, [spec §4](./SPEC.md#4-orgs-and-identity) Roles). `POST /v1/spaces/:spaceId/members {memberIds}` adds org members, people or agents, to a shared space the caller is a member of; browsing an open space is not enough, and direct spaces refuse (`invalid_request`). It is all or nothing: an id that is not an org member is `not_found` and nothing is written. Each member added gets the ordinary `membership` `joined` event, now carrying `by` (the adder's `Attribution`, so an agent's add reads "via"), and a `space_added` frame on their member channel after the commit. `by` is absent whenever the member acted themselves (accepting an invite, self-join, leaving), so an older client that drops it still reads "joined". Anyone already in is a no-op: `memberships` answers for every id asked, in the order asked, and a request that adds nobody writes nothing and passes a read-only org. The added member is not notified in v1 (no `notify` frame, no push, no Activity row): the space appears in their sidebar, and the stream's join line says who added them (the next bullet).
 - **The stream shows membership as lines between messages** (`listStream` `events`, `StreamEvent` — 2026-09-29). Each page carries, oldest first, the `membership` events (joined, left, removed, with `by` when someone else acted) whose offsets fall in the range the page answers for: an event belongs to the page holding the next message after it, and the newest page also takes the events after its newest message, so paging back, forward, or around a message shows each event exactly once, and a space nobody has posted in still shows its joins. This is the Matrix model, not Slack's: the fact stays in the log and the client draws the line, so no system message exists for unread counts, notifications, search, Activity, or agents to skip. Live, the same events arrive as ordinary `event` frames. Older orgs omit the field; it defaults to empty.
-- **Agent invocations** (`Invocation`, `InvocationUpdate`, `ConnectorCapabilities` in `invocation.ts`; the `invocation`, `invocation_stop` and `invocation_state` frames; migration 027 — 2026-09-30, [spec §8](./SPEC.md#8-agents-in-spaces) Invoking agent members). A posted message that mentions an agent member (not its author) invokes it, and so does every message a person posts in a direct space with an agent member, mention or not (2026-09-30), decided in the message's own transaction. `postMessage` answers with `invocations` for every agent it invoked, or was refused to: `refused` with `not_permitted` when the invoker shares no shared space with the agent (a DM alone does not count), or `hop_limit` when an agent's post would be the fourth hand-off (depth = 1 + the deepest live invocation of the posting agent; a person's mention is 0). The `post_message` tool returns the same as `invocations: [{agentId, state, refusal?}]`. `NewMessage.agentOptions` (keyed by agent id) lands on that agent's invocation uninterpreted; entries for agents the message does not mention are dropped. Edits never invoke. Per (agent, conversation), where the conversation is the thread root, one invocation is live at a time: a new one is `pending` when the conversation is free, `pending` with `answers` when the live one is `waiting`, and otherwise `queued`, promoted to `pending` when the live one ends, in the order the triggering message
```

**File**: `apps/harbor/packages/protocol/src/api.ts` (modified, +2/-1)
```diff
@@ -69,7 +69,8 @@ const NewMessage = z.object({
    * Options picked for agents this message mentions (spec §8 Invocation
    * options), keyed by the agent's member id. They land on that agent's
    * invocation, uninterpreted; values for an agent the message does not
-   * mention are ignored.
+   * invoke are ignored (it invokes the agents it mentions, and in a DM with
+   * an agent, that agent: spec §8, 2026-09-30).
    */
   agentOptions: z.record(MemberId, InvocationOptionValues).optional(),
 });
```

**File**: `apps/harbor/packages/server/src/connectors/host.ts` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+import { HARBOR_RUN_CONNECTIONS, type AgentCredential, type Member } from '@rowboat/spaces-protocol';
+import { HarborError } from '../errors.js';
+import type { SpaceHub } from '../hub.js';
+import { assertSealingConfigured, credentialHint, seal, unseal } from '../sealing.js';
+import type { HarborService } from '../service.js';
+import type { Store } from '../store.js';
+import { PLATFORMS, type ConnectorEnv, type RunningConnector } from './platforms.js';
+
+// Runs one org's connectors (spec §8 Connectors, 2026-09-30): one per agent
+// whose connection is a platform Harbor calls. Started at boot for every such
+// agent, and when one is added. One instance only for now: two Harbor
+// instances would both start each connector and could act on the same
+// invocation; the ownership lease that fixes it is on the list in SPEC.md §4
+// "Running more than one instance".
+
+export class HostedConnectors {
+  private readonly running = new Map<string, RunningConnector>();
+
+  constructor(
+    private readonly deps: { store: Store; hub: SpaceHub; service: HarborService; orgId: string },
+  ) {}
+
+  /** Check a platform credential before anything is saved: that this Harbor can seal it, then with the platform. */
+  async verify(connection: string, secret: string): Promise<void> {
+    const platform = PLATFORMS[connection];
+    if (!platform) throw new HarborError('invalid_request', `this Harbor has no connector for ${connection}`);
+    assertSealingConfigured();
+    await platform.verify(secret);
+  }
+
+  /** Seal and store an agent's credential for this org (a replacement clears a rejection). */
+  async save(agentId: string, secret: string, setBy: string): Promise<AgentCredential> {
+    const credential = { hint: credentialHint(secret), setBy, setAt: this.deps.service.now() };
+    await this.deps.store.putAgentCredential({ agentId, sealed: seal(secret, this.deps.orgId, agentId), ...credential });
+    return credential;
+  }
+
+  async startAll(): Promise<void> {
+    for (const agent of await this.deps.store.listAgentsByConnection(HARBOR_RUN_CONNECTIONS)) this.ensure(agent);
+  }
+
+  /** Start the agent's connector if Harbor runs one for its connection and it isn't running yet. */
+  ensure(agent: Member): void {
+    if (this.running.has(agent.id) || !agent.agentConnection) return;
+    const platform = PLATFORMS[agent.agentConnection];
+    if (!platform) return;
+    this.running.set(agent.id, platform.start(this.env(agent)));
+  }
+
+  async stopAll(): Promise<void> {
+    const running = [...this.running.values()];
+    this.running.clear();
+    await Promise.allSettled(running.map((connector) => connector.stop()));
+  }
+
+  private env(agent: Member): ConnectorEnv {
+    const { store, hub, service, orgId } = this.deps;
+    const tag = `[harbor] connector ${agent.agentConnection} ${agent.id}:`;
+    return {
+      agent,
+      orgUrl: orgUrl(service.org.address),
+      service,
+      ctx: { memberId: agent.id, agent: true },
+      subscribe: (fn) => hub.subscribeMember(agent.id, fn),
+      credential: async () => {
+        const stored = await store.getAgentCredential(agent.id);
+        if (!stored) throw new HarborError('invalid_request', 'this agent has no platform key');
+        return unseal(stored.sealed, orgId, agent.id);
+      },
+      rejectCredential: (reason) => store.rejectAgentCredential(agent.id, service.now(), reason),
+      thread: {
+        get: (spaceId, threadRootId) => store.getConnectionThread(agent.id, spaceId, threadRootId),
+        put: (spaceId, threadRootId, data) => store.putConnectionThread(agent.id, spaceId, threadRootId, data, service.now()),
+      },
+      log: (message, detail) => (detail === undefined ? console.log(tag, message) : console.log(tag, message, detail)),
+    };
+  }
+}
+
+/** `host[:port]` → a URL: plain http only on this machine. */
+export function orgUrl(address: string): string {
+  return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(address) ? `http://${address}` : `https://${address}`;
+}
```

**File**: `apps/harbor/packages/server/src/connectors/platforms.ts` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+import type { Member, ServerFrame } from '@rowboat/spaces-protocol';
+import type { ActorCtx } from '../core/kernel.js';
+import type { HarborService } from '../service.js';
+
+// Connectors Harbor runs (spec §8 Connectors, 2026-09-30): for an agent whose
+// connection names a platform Harbor calls on its behalf (HARBOR_RUN_CONNECTIONS
+// in the protocol), Harbor starts that platform's connector. Each connector is
+// a client of the agent contract in-process: it acts as its agent through the
+// same service operations a connector outside Harbor calls over HTTP, and wakes
+// on the agent's own frames and the one-minute list. Each platform lives in its
+// own module beside this file, with its own tests.
+
+/** What Harbor hands a running connector: its agent, the contract, and the connector's own storage. */
+export interface ConnectorEnv {
+  agent: Member;
+  /** The org's public address, with its scheme: links in prompts, and what an agent's tools call. */
+  orgUrl: string;
+  service: HarborService;
+  /** The agent itself: `{ memberId: agent.id, agent: true }`, as its key would resolve. */
+  ctx: ActorCtx;
+  /** The agent's own frames (invocation, invocation_stop), as its live connection would get them. */
+  subscribe(fn: (frame: ServerFrame) => void): () => void;
+  /** The platform's credential, unsealed for this call. Never kept, logged, or put in a message. */
+  credential(): Promise<string>;
+  /** The platform refused the credential: marks it rejected; true only the first time, until it is replaced. */
+  rejectCredential(reason: string): Promise<boolean>;
+  /** The connector's own record for one thread (spec §8: its platform session and what is in flight). */
+  thread: {
+    get(spaceId: string, threadRootId: string): Promise<unknown | undefined>;
+    put(spaceId: string, threadRootId: string, data: unknown): Promise<void>;
+  };
+  log(message: string, detail?: unknown): void;
+}
+
+export interface RunningConnector {
+  stop(): Promise<void>;
+}
+
+export interface ConnectorPlatform {
+  /**
+   * Check a credential with the platform before Harbor saves it. Throws a
+   * HarborError('invalid_request') carrying the platform's reason on refusal.
+   */
+  verify(secret: string): Promise<void>;
+  /** Run the connector for one agent until stopped. */
+  start(env: ConnectorEnv): RunningConnector;
+}
+
+/** One entry per connection in HARBOR_RUN_CONNECTIONS. */
+export const PLATFORMS: Record<string, ConnectorPlatform> = {};
```

**File**: `apps/harbor/packages/server/src/core/agents.ts` (modified, +66/-6)
```diff
@@ -1,4 +1,4 @@
-import type { AgentKey, AgentKeySecret, AgentListing, Member } from '@rowboat/spaces-protocol';
+import { HARBOR_RUN_CONNECTIONS, isAgentPair, type AgentCredential, type AgentKey, type AgentKeySecret, type AgentListing, type Member } from '@rowboat/spaces-protocol';
 import { hashAgentKey, mintAgentKeySecret } from '../agent-keys.js';
 import { HarborError } from '../errors.js';
 import { agentsManagedBy, canAddAgent, canCreateAgentKey, canRevokeAgentKey, enforce } from '../policy.js';
@@ -11,13 +11,31 @@ import type { Spaces } from './spaces.js';
 // owner or an admin revokes them. A key is a bearer secret presented as the
 // agent itself — auth.ts resolves it on every face — and the org keeps only
 // its hash. Render face only: a secret never passes through a tool.
+//
+// An agent's kind and connection (2026-09-30) are set here and never change.
+// A platform connection's credential is checked and stored by the connector
+// host (connectors/host.ts), which seals it for this org; this module keeps
+// the rules: who may set it, and that only a platform agent has one.
+
+/** What the connector host does for agent creation. Absent = this org runs no connectors. */
+export interface AgentConnectorHooks {
+  verify(connection: string, secret: string): Promise<void>;
+  save(agentId: string, secret: string, setBy: string): Promise<AgentCredential>;
+  added(agent: Member): void;
+}
 
 export class Agents {
+  private hooks: AgentConnectorHooks | undefined;
+
   constructor(
     private readonly k: Kernel,
     private readonly spaces: Spaces,
   ) {}
 
+  attachConnectors(hooks: AgentConnectorHooks): void {
+    this.hooks = hooks;
+  }
+
   private async actor(ctx: ActorCtx): Promise<Member> {
     const member = await this.k.store.getMember(ctx.memberId);
     if (!member) throw new HarborError('not_a_member', 'not a member of this org');
@@ -35,14 +53,56 @@ export class Agents {
     const actor = await this.actor(ctx);
     const agents = await this.k.store.listAgents(agentsManagedBy(actor) === 'all' ? null : actor.id);
     const keys = await this.k.store.listAgentKeys(agents.map((a) => a.id));
-    return agents.map((agent) => ({ agent, keys: keys.filter((k) => k.agentId === agent.id) }));
+    const credentials = await this.k.store.listAgentCredentials(agents.map((a) => a.id));
+    return agents.map((agent) => {
+      const stored = credentials.find((c) => c.agentId === agent.id);
+      const { agentId: _agentId, sealed: _sealed, ...credential } = stored ?? ({} as never);
+      return { agent, keys: keys.filter((k) => k.agentId === agent.id), ...(stored ? { credential } : {}) };
+    });
   }
 
-  /** Add an agent: the caller owns it and gets its first key, shown this once. */
-  async add(ctx: ActorCtx, displayName: string): Promise<{ agent: Member; key: AgentKeySecret }> {
+  /**
+   * Add an agent: the caller owns it and gets its first key, shown this once.
+   * A platform agent's credential is checked with the platform first, so a
+   * refused key creates nothing.
+   */
+  async add(
+    ctx: ActorCtx,
+    input: { displayName: string; kind: string; connection: string; credential?: string },
+  ): Promise<{ agent: Member; key: AgentKeySecret }> {
     enforce(canAddAgent(await this.actor(ctx)));
-    const agent = await this.spaces.createAgent({ displayName, ownerId: ctx.memberId });
-    return { agent, key: await this.mint(ctx, agent.id) };
+    if (!isAgentPair(input.kind, input.connection)) {
+      throw new HarborError('invalid_request', `${input.kind} through ${input.connection} is not a kind of agent this Harbor knows`);
+    }
+    const platform = HARBOR_RUN_CONNECTIONS.includes(input.connection);
+    if (platform && input.credential === undefined) throw new HarborError('invalid_request', `a ${input.connection} agent needs its ${input.connection} key`);
+    if (!platform && input.credential !== undefined) throw new HarborError('invalid_request', 'only an agent Harbor reaches through a platform takes a credential');
+    if (platform) {
+      if (!this.hooks) throw new HarborError('invalid_request', `this Harbor runs no ${input.connection} connector`);
+      await this.hooks.verify(input.connection, input.credential!);
+    }
+    const agent = await this.spaces.createAgent({
+      displayName: input.displayName,
+      ownerId: ctx.memberId,
+      agentKind: input.kind,
+      agentConnection: input.connection,
+    });
+    if (platform) await this.hooks!.save(agent.id, input.credential!, ctx.memberId);
+    const key = await this.mint(ctx, agent.id);
+    this.hooks?.added(agent);
+    return { agent, key };
+  }
+
+  /** Replace a platform agent's credential: the owner only, checked with the platform first; clears a rejection. */
+  async setCredential(ctx: ActorCtx, agentId: string, secret: string): Promise<AgentCredential> {
+    const agent = await this.agent(agentId);
+    enforce(canCreateAgentKey(await this.actor(ctx), agent));
+    const conne
```

**File**: `apps/harbor/packages/server/src/core/feed.ts` (modified, +21/-5)
```diff
@@ -308,7 +308,17 @@ export class Feed {
     return folded;
   }
 
-  async postMessage(ctx: ActorCtx, spaceId: string, input: NewMessage): Promise<{ message: Message; invocations: Invocation[] }> {
+  /**
+   * `finishes` (in-process only, never on the wire): this message is the
+   * answer to that invocation, which is marked done in the same transaction,
+   * or nothing is posted (spec §8 Connectors, 2026-09-30).
+   */
+  async postMessage(
+    ctx: ActorCtx,
+    spaceId: string,
+    input: NewMessage,
+    opts: { finishes?: string } = {},
+  ): Promise<{ message: Message; invocations: Invocation[] }> {
     const space = await this.k.requireMember(ctx, spaceId);
     this.k.guardWrite();
     const author = this.k.attributionOf(ctx, input);
@@ -318,11 +328,17 @@ export class Feed {
     // mention is never lost between the post and the queue (spec §8); their
     // frames leave with the rest, after the commit.
     const outbox: InvocationOutbox = [];
-    const invoke = async (message: Message): Promise<{ message: Message; invocations: Invocation[] }> => ({
-      message,
-      invocations: this.invocations ? await this.invocations.onMessage(ctx, space, message, input.agentOptions, outbox) : [],
-    });
+    let finishing: Invocation | undefined;
+    const invoke = async (message: Message): Promise<{ message: Message; invocations: Invocation[] }> => {
+      const invocations = this.invocations ? await this.invocations.onMessage(ctx, space, message, input.agentOptions, outbox) : [];
+      if (finishing && this.invocations) await this.invocations.finishWithin(finishing, outbox);
+      return { message, invocations };
+    };
     const result = await this.k.lockedAs(ctx, spaceId, async () => {
+      if (opts.finishes) {
+        if (!this.invocations || !input.threadRoot) throw new HarborError('invalid_request', 'an answer is a reply in its invocation\'s thread');
+        finishing = await this.invocations.assertFinishable(ctx, opts.finishes, spaceId, input.threadRoot);
+      }
       const at = this.k.now();
       // The org stamps the poll from its own clock: answer ids 1..n, a
       // duration in becomes an expiry out (the Discord create asymmetry).
```

**File**: `apps/harbor/packages/server/src/core/invocations.ts` (modified, +49/-12)
```diff
@@ -60,7 +60,12 @@ export class Invocations {
     out: InvocationOutbox,
   ): Promise<Invocation[]> {
     const created: Invocation[] = [];
-    for (const agentId of new Set(message.mentions)) {
+    // The agents it mentions, and in a DM with an agent that agent, mention or
+    // not (spec §8, amended 2026-09-30). The checks below keep a person's DMs
+    // and a self-DM out: only an agent that is not the author is invoked.
+    const invoked = new Set(message.mentions);
+    if (space.kind === 'direct') for (const id of space.participants ?? []) invoked.add(id);
+    for (const agentId of invoked) {
       if (agentId === message.author.memberId) continue;
       const agent = await this.k.store.getMember(agentId);
       if (agent?.kind !== 'agent') continue;
@@ -140,22 +145,49 @@ export class Invocations {
       if (TERMINAL.has(current.state) || current.state === 'queued') {
         throw new HarborError('invalid_request', `this invocation is ${current.state}: it takes no reports`);
       }
-      const { activity: _activity, error: _error, ...rest } = current;
-      const next: Invocation = { ...rest, state: update.state, updatedAt: this.k.now() };
-      if (update.state === 'working' || update.state === 'waiting') {
-        if (update.activity) next.activity = update.activity;
-      }
-      if (update.state === 'working' && update.link) next.link = update.link;
-      if (update.state === 'failed' && update.error) next.error = update.error;
-      await this.k.store.putInvocation(next);
-      this.announce(next, out);
-      if (TERMINAL.has(next.state)) await this.promote(next.agentId, next.conversation.spaceId, next.conversation.threadRootId, out);
-      return next;
+      return this.apply(current, update, out);
     });
     this.flush(out);
     return result;
   }
 
+  /**
+   * The checked half of answering (Feed.postMessage `finishes`, spec §8
+   * Connectors, 2026-09-30), run inside the answer's own transaction: the
+   * invocation is this agent's, in this thread, and not finished. A replay of
+   * an answer finds it done and posts nothing.
+   */
+  async assertFinishable(ctx: ActorCtx, id: string, spaceId: string, threadRootId: string): Promise<Invocation> {
+    const current = await this.own(ctx, id);
+    if (current.conversation.spaceId !== spaceId || current.conversation.threadRootId !== threadRootId) {
+      throw new HarborError('invalid_request', 'an answer goes in its invocation\'s thread');
+    }
+    if (current.state !== 'working' && current.state !== 'waiting') {
+      throw new HarborError('invalid_request', `this invocation is ${current.state}: it takes no answer`);
+    }
+    return current;
+  }
+
+  /** The other half: done, in the same transaction as the answer. */
+  async finishWithin(current: Invocation, out: InvocationOutbox): Promise<Invocation> {
+    return this.apply(current, { state: 'done' }, out);
+  }
+
+  private async apply(current: Invocation, update: InvocationUpdate, out: InvocationOutbox): Promise<Invocation> {
+    const { activity: _activity, error: _error, ...rest } = current;
+    const next: Invocation = { ...rest, state: update.state, updatedAt: this.k.now() };
+    if (update.state === 'working' || update.state === 'waiting') {
+      if (update.activity) next.activity = update.activity;
+    }
+    if (update.state === 'working' && update.link) next.link = update.link;
+    if (update.state === 'failed' && update.error) next.error = update.error;
+    await this.k.store.putInvocation(next);
+    this.announce(next, out);
+    if (TERMINAL.has(next.state)) await this.promote(next.agentId, next.conversation.spaceId, next.conversation.threadRootId, out);
+    return next;
+  }
+
+
   /** What the connector's agent can do: Stop, and the options the composer offers. Declared again whenever it changes. */
   async declareCapabilities(ctx: ActorCtx, capabilities: ConnectorCapabilities): Promise<ConnectorCapabilities> {
     this.requireConnector(ctx);
@@ -255,6 +287,11 @@ export class Invocations {
     return live.reduce((max, i) => Math.max(max, i.depth), 0);
   }
 
+  /** One of the calling agent's own invocations, as it stands. */
+  ownInvocation(ctx: ActorCtx, id: string): Promise<Invocation> {
+    return this.own(ctx, id);
+  }
+
   private requireConnector(ctx: ActorCtx): void {
     if (!ctx.agent) throw new HarborError('forbidden', 'only an agent, on its own key, can do this');
   }
```

**File**: `apps/harbor/packages/server/src/core/spaces.ts` (modified, +12/-3)
```diff
@@ -53,14 +53,23 @@ export class Spaces {
    * its own: the integration that owns the agent calls this and gates who may.
    * The first is the Replicas coding agent (PR #1130).
    */
-  async createAgent(input: { displayName: string; ownerId?: string }): Promise<Member> {
+  async createAgent(input: { displayName: string; ownerId?: string; agentKind?: string; agentConnection?: string }): Promise<Member> {
     const displayName = input.displayName.trim();
     if (!Member.shape.displayName.safeParse(displayName).success) {
       throw new HarborError('invalid_request', 'an agent needs a display name of 1 to 128 characters');
     }
     this.k.guardWrite();
-    // No owner = org-owned, managed by admins (Replicas); a member-added agent names its person (core/agents.ts).
-    const member: Member = { id: this.k.ulid(), displayName, role: 'member', kind: 'agent', ...(input.ownerId ? { ownerId: input.ownerId } : {}) };
+    // A member-added agent names its person (core/agents.ts); its kind and
+    // connection default to custom/contract (spec §4 Agent members, 2026-09-30).
+    const member: Member = {
+      id: this.k.ulid(),
+      displayName,
+      role: 'member',
+      kind: 'agent',
+      ...(input.ownerId ? { ownerId: input.ownerId } : {}),
+      agentKind: input.agentKind ?? 'custom',
+      agentConnection: input.agentConnection ?? 'contract',
+    };
     await this.k.store.putMember(member);
     return member;
   }
```

---

### Incident Patch 3: `3d0d4c75` (2026-09-30)
**Commit Message**: Require a work directory before offering the harness in chat (#1141)

**File**: `apps/x/packages/core/src/runtime/assembly/copilot/base-tools.ts` (modified, +7/-1)
```diff
@@ -7,6 +7,12 @@
 // code_agent_run and launch-code-task are here for the legacy code-mode path
 // (runs/), which shares buildCopilotAgent and cannot gain tools mid-run;
 // revisit once code-mode migrates to the turns runtime.
+
+// The harness: one Claude Code / Codex run inside a directory. Named on its
+// own because a chat only gets it once it HAS a directory — RealAgentResolver
+// drops it from work-directory agents that have none (2026-09-30).
+export const HARNESS_TOOL = "code_agent_run";
+
 export const COPILOT_BASE_TOOLS: readonly string[] = [
     "loadSkill",
     // Blocking user question (async, requiresHuman) — resolved as a special
@@ -40,6 +46,6 @@ export const COPILOT_BASE_TOOLS: readonly string[] = [
     "paste-at-cursor",
     "executeCommand",
     "spawn-agent",
-    "code_agent_run",
+    HARNESS_TOOL,
     "launch-code-task",
 ];
```

**File**: `apps/x/packages/core/src/runtime/assembly/skills/code-with-agents/skill.ts` (modified, +2/-0)
```diff
@@ -25,6 +25,8 @@ No chip is set, but code mode is enabled (this skill only loads when it is). **P
 
 ## STEP 2 — Resolve workdir, then run
 
+**First, check that you actually have \`code_agent_run\`.** In a chat the harness runs inside a work directory, so the tool is attached only once this chat has one. If it is NOT in your tools, do not improvise with \`executeCommand\` or your own file tools: tell the user to pick the folder to work in — the folder button beside the chat input ("Choose a folder…"), or opening the project from the Code section — and that you will run the coding agent as soon as they do.
+
 **Resolve the workdir** (in this priority order):
 1. A path the user named in their original message (e.g. \`G:/4th sem/CN\`).
 2. The path from a "# User Work Directory" block in your context.
```

**File**: `apps/x/packages/core/src/runtime/turns/bridges/real-agent-resolver.test.ts` (modified, +70/-0)
```diff
@@ -36,6 +36,11 @@ const fakeBuiltins = {
         inputSchema: z.object({ task: z.string() }),
         execute: async () => null,
     },
+    code_agent_run: {
+        description: "Run a coding agent",
+        inputSchema: z.object({ prompt: z.string() }),
+        execute: async () => null,
+    },
 } as unknown as typeof BuiltinTools;
 
 function makeResolver(agent: z.infer<typeof Agent>, deps: Partial<ConstructorParameters<typeof RealAgentResolver>[0]> = {}) {
@@ -227,6 +232,71 @@ describe("RealAgentResolver", () => {
     });
 });
 
+describe("harness gating (work directory)", () => {
+    const withHarness = () =>
+        makeAgent({
+            tools: {
+                code_agent_run: { type: "builtin", name: "code_agent_run" },
+                "file-list": { type: "builtin", name: "file-list" },
+            },
+        });
+
+    it("withholds the harness from a chat with no work directory", async () => {
+        const resolved = await makeResolver(withHarness()).resolve({
+            agentId: "copilot",
+            overrides: { composition: { workDirId: "sess-1" } },
+        });
+        expect(resolved.tools.map((t) => t.name)).toEqual(["file-list"]);
+    });
+
+    it("attaches the harness once the chat has a work directory", async () => {
+        const resolver = makeResolver(withHarness(), {
+            loadWorkDir: (id) => (id === "sess-1" ? "/Users/me/work" : null),
+        });
+        const resolved = await resolver.resolve({
+            agentId: "copilot",
+            overrides: { composition: { workDirId: "sess-1" } },
+        });
+        expect(resolved.tools.map((t) => t.name)).toEqual([
+            "code_agent_run",
+            "file-list",
+        ]);
+    });
+
+    it("attaches the harness for a Code session's pinned cwd", async () => {
+        const resolved = await makeResolver(withHarness()).resolve({
+            agentId: "copilot",
+            overrides: {
+                composition: { codeMode: "codex", codeCwd: "/repo/worktree" },
+            },
+        });
+        expect(resolved.tools.map((t) => t.name)).toContain("code_agent_run");
+    });
+
+    it("keeps the harness for agents that resolve their repo elsewhere", async () => {
+        // The to-do item agent has no work-directory concept: its coding
+        // work lands in the item's pinned session or the default repo.
+        const agent = withHarness();
+        agent.name = "todo-item-agent";
+        const resolved = await makeResolver(agent).resolve({
+            agentId: "todo-item-agent",
+        });
+        expect(resolved.tools.map((t) => t.name)).toContain("code_agent_run");
+    });
+
+    it("does not let an active skill re-attach the harness", async () => {
+        const resolver = makeResolver(
+            makeAgent({ tools: { "file-list": { type: "builtin", name: "file-list" } } }),
+            { skillTools: (id) => (id === "rogue" ? ["code_agent_run"] : []) },
+        );
+        const resolved = await resolver.resolve({
+            agentId: "copilot",
+            overrides: { composition: { activeSkills: ["rogue"] } },
+        });
+        expect(resolved.tools.map((t) => t.name)).toEqual(["file-list"]);
+    });
+});
+
 describe("active skills (skill-scoped tools)", () => {
     const skillTools = (skillId: string): string[] =>
         skillId === "organize-files"
```

**File**: `apps/x/packages/core/src/runtime/turns/bridges/real-agent-resolver.ts` (modified, +40/-3)
```diff
@@ -12,7 +12,12 @@ import {
     loadUserWorkDir,
     loadWorkspaceContext,
 } from "../../assembly/workspace-context.js";
-import { carriesSkillsForward, loadAgent } from "../../assembly/registry.js";
+import {
+    carriesSkillsForward,
+    hasWorkspaceContext,
+    loadAgent,
+} from "../../assembly/registry.js";
+import { HARNESS_TOOL } from "../../assembly/copilot/base-tools.js";
 import { BuiltinTools } from "../../tools/catalog.js";
 import { skillToolNames } from "../../assembly/skills/index.js";
 import { ModeFlags } from "../../assembly/capabilities/types.js";
@@ -107,6 +112,23 @@ const CompositionOverrides = ModeFlags.extend({
     activeSkills: z.array(z.string()).optional(),
 });
 
+// The harness (Claude Code / Codex) runs INSIDE a directory, so the
+// assistant is only offered it once this chat has one: a Code session's
+// pinned cwd, or the work directory the user picked beside the composer.
+// Without one the run would silently land in whatever repo happens to be
+// the default, which is not a choice the user made here (2026-09-30).
+// Agents with no work-directory concept (the to-do item agent, background
+// tasks) resolve their repo from their own pin and keep the tool.
+function harnessAvailable(
+    agentId: string | null | undefined,
+    context: { codeCwd: string | null; userWorkDir: string | null },
+): boolean {
+    if (!hasWorkspaceContext(agentId)) {
+        return true;
+    }
+    return Boolean(context.codeCwd ?? context.userWorkDir);
+}
+
 export interface RealAgentResolverDeps {
     load?: typeof loadAgent;
     builtins?: typeof BuiltinTools;
@@ -178,11 +200,16 @@ export class RealAgentResolver {
             ...modeFlags,
         });
 
+        const harness = harnessAvailable(requested.agentId, {
+            codeCwd: modeFlags.codeCwd,
+            userWorkDir: workspace.userWorkDir,
+        });
         const tools = await this.resolveTools(agent, {
             subagent: subagent ?? false,
+            harness,
         });
         if (carriesSkillsForward(requested.agentId) && activeSkills?.length) {
-            await this.appendSkillTools(tools, activeSkills);
+            await this.appendSkillTools(tools, activeSkills, { harness });
         }
         return ResolvedAgent.parse({
             agentId: requested.agentId,
@@ -201,13 +228,19 @@ export class RealAgentResolver {
     private async appendSkillTools(
         tools: Array<z.infer<typeof ToolDescriptor>>,
         activeSkills: string[],
+        options: { harness: boolean },
     ): Promise<void> {
         const attached = new Set(tools.map((tool) => tool.name));
         for (const skillId of activeSkills) {
             for (const name of this.skillTools(skillId)) {
                 if (attached.has(name)) {
                     continue;
                 }
+                // A skill declaring the harness must not route around the
+                // work-directory gate (disk skills declare their own tools).
+                if (!options.harness && name === HARNESS_TOOL) {
+                    continue;
+                }
                 const builtin = this.builtins[name];
                 if (!builtin) {
                     continue;
@@ -223,7 +256,7 @@ export class RealAgentResolver {
 
     private async resolveTools(
         agent: z.infer<typeof Agent>,
-        options: { subagent: boolean },
+        options: { subagent: boolean; harness: boolean },
     ): Promise<Array<z.infer<typeof ToolDescriptor>>> {
         const tools: Array<z.infer<typeof ToolDescriptor>> = [];
         for (const [name, attachment] of Object.entries(agent.tools ?? {})) {
@@ -255,6 +288,10 @@ export class RealAgentResolver {
             ) {
                 continue;
             }
+            // No work directory for this chat, no harness (see above).
+            if (!options.harness && attachment.name === HARNESS_TOOL) {
+                continue;
+            }
             const builtin = this.builtins[attachment.name];
             if (!builtin) {
                 continue;
```

---

### Incident Patch 4: `b59f022c` (2026-09-30)
**Commit Message**: Build agent invocations in Harbor

The server half of the agent contract (spec §8 Invoking agent members).

A posted message that mentions an agent member invokes it, decided in the
message's own transaction so a mention is never lost: refused when the
invoker shares no shared space with the agent or an agent hand-off passes
three hops (both returned in the post response and shown to the space);
otherwise pending, or queued behind the live turn of that agent in that
thread, or delivered at once as the answer to a turn waiting on a person.
Picked invocation options land on the invocation uninterpreted.

The queue is the invocations table: every state change runs in a transaction
holding the space's Postgres advisory lock, and queued turns run in the order
their messages were posted (stream offsets, allocated under that lock), never
by a machine's clock, so it stays correct with any number of Harbor
instances on one database.

The connector works on the agent's own key: it is told live when an
invocation is ready, lists its invocations when it connects and every minute
(the live frame is the fast path, the list the guarantee, including while
live delivery is per instance), acknowledg

**File**: `apps/harbor/AGENTS.md` (modified, +3/-0)
```diff
@@ -14,6 +14,7 @@ Two pnpm workspace packages under `packages/`:
 | `core/kernel.ts` | store, hub, org, the read-only knob, the space lock with its publish-after-commit outbox, `append` / `nextOffset` / `appendNext`, `requireSpace` / `requireReadableSpace` / `requireMember`, `guardWrite`, `attributionOf` |
 | `core/spaces.ts` | spaces, direct messages, invites and the bind ceremony, the roster, `me`, agent members (`createAgent`), push registration, the read-gated replay and membership-gated live relays |
 | `core/agents.ts` | agent members' owners and keys: add an agent, list the ones a member manages, create and revoke keys |
+| `core/invocations.ts` | invoking agent members (spec §8): the trigger `Feed.postMessage` runs in its transaction, the per-(agent, conversation) queue, the connector's operations, cancel and stop; its frames leave after the commit through its own outbox |
 | `core/assets.ts` | assets by id, versions, the change log, blobs, history, diff |
 | `core/feed.ts` | messages, threads, topics, reactions, polls, search, mention stamps and their backfill |
 | `core/read-state.ts` | read marks, follows, unread, Activity, read-all |
@@ -30,6 +31,8 @@ Two pnpm workspace packages under `packages/`:
 | `hub.ts`, `blobs*.ts`, `mime.ts`, `merge.ts`, `search.ts`, `mentions-backfill.ts` | in-process fan-out, blob drivers, sniffing, the three-way merge, query parsing, the mentions backfill |
 | `stats.ts`, `internal.ts` | the live-load counters (connections, subscriptions, frames per minute by kind, deliveries) and the operator face that reads them, `GET /internal/stats` behind `HARBOR_INTERNAL_KEY` |
 
+`examples/echo-agent.mjs` is the smallest connector for the agent contract (spec §8): one agent's key, the live frame plus a list every minute, acknowledge, report, reply in the thread. Run it against a dev Harbor to watch invocations end to end, and start a real connector from its shape.
+
 `test/` has one file per feature, every one on in-process Postgres. `helpers.ts` gives `startTestHarbor` (a harbor over a fresh database, closed with it), `restClient`, `agentClient`, `liveClient`, `startFakeAs` (a fake authorization server: discovery, JWKS, minted JWTs). `day-in-the-life.test.ts` is spec §11 as code; `mcp-parity.test.ts` proves the agent face; `policy.test.ts` pins every rule without a store.
 
 ## Invariants
```

**File**: `apps/harbor/CONTRACT.md` (modified, +1/-0)
```diff
@@ -28,6 +28,7 @@ How the server is built — modules, invariants, the slice a capability cuts thr
 - **An agent member has an owner and its own keys** (`Member.ownerId`, `AgentKey`, `listAgents`, `createAgent`, `createAgentKey`, `revokeAgentKey`, migration 026 — 2026-09-29, [spec §4](./SPEC.md#4-orgs-and-identity) Agent members). `POST /v1/agents {displayName}` adds an agent owned by the caller, who must be a person, and returns it with its first key: `AgentKeySecret` carries `secret` (`rbk_` plus 43 base64url characters) this once, and every later read is `AgentKey` metadata (`createdBy`, `createdAt`, `lastUsedAt`, `revokedAt`). The org stores only a SHA-256 of the secret. `POST /v1/agents/:agentId/keys` adds a key, owner only, and an admin is refused. `POST /v1/agents/:agentId/keys/:keyId/revoke` is the owner's or any admin's, and is idempotent: the first revocation time stands. `GET /v1/agents` lists the agents the caller manages with their keys: their own, or every agent for an admin. A new agent, which is in no space yet, is on the org roster like every member (the next bullet), so anyone can find it and add it to a space. An agent with no `ownerId` (org-owned, such as Replicas) takes no keys. A key is accepted as the bearer on every face (REST, the live face's `token`, MCP) and resolves to the agent. Its acts are always `actingMode: 'direct'`: a body's `actingMode`/`agentName` and MCP's `x-acting-mode`/`x-agent-name` are ignored. `lastUsedAt` is recorded at most hourly. An unknown or revoked key is `unauthorized`. There are no agent tools for any of this: a secret never passes through a tool.
 - **Any member adds existing members to a space they are in** (`addMembers`, `add_members`, the membership event's `by` — 2026-09-29, [spec §4](./SPEC.md#4-orgs-and-identity) Roles). `POST /v1/spaces/:spaceId/members {memberIds}` adds org members, people or agents, to a shared space the caller is a member of; browsing an open space is not enough, and direct spaces refuse (`invalid_request`). It is all or nothing: an id that is not an org member is `not_found` and nothing is written. Each member added gets the ordinary `membership` `joined` event, now carrying `by` (the adder's `Attribution`, so an agent's add reads "via"), and a `space_added` frame on their member channel after the commit. `by` is absent whenever the member acted themselves (accepting an invite, self-join, leaving), so an older client that drops it still reads "joined". Anyone already in is a no-op: `memberships` answers for every id asked, in the order asked, and a request that adds nobody writes nothing and passes a read-only org. The added member is not notified in v1 (no `notify` frame, no push, no Activity row): the space appears in their sidebar, and the stream's join line says who added them (the next bullet).
 - **The stream shows membership as lines between messages** (`listStream` `events`, `StreamEvent` — 2026-09-29). Each page carries, oldest first, the `membership` events (joined, left, removed, with `by` when someone else acted) whose offsets fall in the range the page answers for: an event belongs to the page holding the next message after it, and the newest page also takes the events after its newest message, so paging back, forward, or around a message shows each event exactly once, and a space nobody has posted in still shows its joins. This is the Matrix model, not Slack's: the fact stays in the log and the client draws the line, so no system message exists for unread counts, notifications, search, Activity, or agents to skip. Live, the same events arrive as ordinary `event` frames. Older orgs omit the field; it defaults to empty.
+- **Agent invocations** (`Invocation`, `InvocationUpdate`, `ConnectorCapabilities` in `invocation.ts`; the `invocation`, `invocation_stop` and `invocation_state` frames; migration 027 — 2026-09-30, [spec §8](./SPEC.md#8-agents-in-spaces) Invoking agent members). A posted message that mentions an agent member (not its author) invokes it, decided in the message's own transaction. `postMessage` answers with `invocations` for every agent it invoked, or was refused to: `refused` with `not_permitted` when the invoker shares no shared space with the agent (a DM alone does not count), or `hop_limit` when an agent's post would be the fourth hand-off (depth = 1 + the deepest live invocation of the posting agent; a person's mention is 0). The `post_message` tool returns the same as `invocations: [{agentId, state, refusal?}]`. `NewMessage.agentOptions` (keyed by agent id) lands on that agent's invocation uninterpreted; entries for agents the message does not mention are dropped. Edits never invoke. Per (agent, conversation), where the conversation is the thread root, one invocation is live at a time: a new one is `pending` when the conversation is free, `pending` with `answers` when the live one is `waiting`, and otherwise `queued`, promoted to `pending` when the live one ends, in the order the triggering messag
```

**File**: `apps/harbor/SPEC.md` (modified, +3/-3)
```diff
@@ -500,14 +500,14 @@ Every agent member, whatever runs it (a Hermes or OpenClaw gateway, Claude Code,
 **1. Invocation (Harbor → agent)**
 
 - **A conversation is a thread.** Every top-level message starts one, in a channel or a DM alike, and its replies continue it. The key is (space, thread root), and each connector maps it to one session of its own. The agent answers inside the thread, never at the top level: a top-level answer would start a new conversation.
-- **A mention invokes, and in v1 only a mention.** A message that mentions the agent invokes it; nothing else does, including a DM message or a thread follow-up without a mention. An agent's own posts never invoke itself. The rule is one decision in Harbor, beside the notification decision, over the same mention stamps. A connector must switch off its agent's own gating (Hermes's and OpenClaw's mention and DM policies) and answer every invocation, or the agent's rule would silently override this one. Invoking on every DM message, or on thread follow-ups, is a later change to this rule alone. Most chat integrations already do both (Hermes, OpenClaw, Replicas, Devin), so it is the first rule to revisit once a connector is live; Cursor and Codex require a mention each time, as v1 does.
+- **A mention invokes, and in v1 only a mention.** A message that mentions the agent invokes it; nothing else does, including a DM message or a thread follow-up without a mention. An agent's own posts never invoke itself, and editing a mention into a message invokes no one. The rule is one decision in Harbor, beside the notification decision, over the same mention stamps. A connector must switch off its agent's own gating (Hermes's and OpenClaw's mention and DM policies) and answer every invocation, or the agent's rule would silently override this one. Invoking on every DM message, or on thread follow-ups, is a later change to this rule alone. Most chat integrations already do both (Hermes, OpenClaw, Replicas, Devin), so it is the first rule to revisit once a connector is live; Cursor and Codex require a mention each time, as v1 does.
 - **You may invoke an agent you share a space with** (`canInvokeAgent`, v1 for every agent; #1130's rule for Replicas, generalized). A DM alone does not count. A refused mention creates no work and says why. Anyone may add an agent to a space (§4 Agent members), so anyone may widen who can invoke it; the owner's backstop is revoking its keys. A per-agent "only me" setting is Deferred.
 - **Agents may invoke agents, three hops deep.** Every invocation carries a depth, and a person's mention has depth 0. When an agent posts a message that mentions another agent, the new invocation's depth is one more than the deepest invocation its author is working on (1 if none). Harbor infers this from the key and the running invocations, so nothing passes an id around. Past three, the invocation is recorded as refused ("too many agent hand-offs"), shown under the message, and returned to the posting agent. The limit is one constant in `policy.ts`.
 - **An invocation carries a pointer, not a copy:** the conversation key; the message that invoked it (id, text, and author, who is the invoker); where it happened (channel or DM, and the space's name); its depth; and the values of any options the invoker picked. The agent reads the thread through the actions contract, as it stands now, edits included. Threads can be long, and a copy would be stale by the time it was read. This is Slack's model for agents too; a connector whose agent expects the recent messages copied in (as Hermes's and OpenClaw's Slack adapters do) fetches them itself.
 - **Invocation options.** A connector may declare a few options on its invocations, each a choice list or a toggle, such as Environment, Plan first, or Model, and declares them again whenever they change. When a person mentions the agent, the composer offers its options; the picked values travel with the message and land on its invocation. Harbor passes them through without interpreting them: nothing in Harbor is specific to coding. The equivalents elsewhere are Cursor's `repo=` options and Replicas' environment picker.
 - **Where a coding agent's work runs is its connector's to resolve, not Harbor's.** A coding agent needs an environment or repository before it starts, because its sandbox must exist first. Its connector resolves one in its own order: an option picked in the composer, then what the message names, then its own defaults (for the space, the person, the org). It says which it chose in its first reply, and the choice holds for the conversation. Changing it means a new thread. This is how the Slack integrations of Cursor, Codex, Replicas, Claude and Devin all work: each resolves the environment in its own bot, from its own catalog of environments and its own defaults. General agents such as Hermes and OpenClaw have no per-message workspace at all; it is part of the agent's configuration. So Harbor models no works
```

**File**: `apps/harbor/examples/echo-agent.mjs` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+// The smallest connector for the agent contract (SPEC.md §8, Invoking agent
+// members; the wire in CONTRACT.md, "Agent invocations"). It runs as one
+// agent member, on that agent's key: told live when it's mentioned, it also
+// lists its pending invocations on start and every minute (the live frame is
+// the fast path, the list the guarantee), acknowledges each one, reports
+// progress, replies in the thread through the ordinary messages route, and
+// reports done. It declares Stop and honors invocation_stop. "slow" in a
+// message makes it take 15 seconds, so a second mention in the same thread
+// visibly waits its turn. A real connector (Hermes, OpenClaw) keeps this
+// shape and swaps the echo for its agent.
+//
+// Try it against a dev Harbor: add an agent under Agents in the app, add it
+// to a space, then
+//
+//   node apps/harbor/examples/echo-agent.mjs http://localhost:4272 rbk_...
+
+const [, , base, key] = process.argv;
+if (!base || !key) {
+  console.error('usage: node apps/harbor/examples/echo-agent.mjs <harbor-url> <agent-key>');
+  process.exit(1);
+}
+
+const api = async (method, path, body) => {
+  const res = await fetch(base + path, {
+    method,
+    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
+    ...(body ? { body: JSON.stringify(body) } : {}),
+  });
+  const json = await res.json();
+  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(json)}`);
+  return json;
+};
+const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
+const plain = (body) => body.replace(/\[@([^\]]+)\]\(#member:[^)]+\)/g, '@$1');
+
+const me = (await api('GET', '/v1/me')).member;
+console.log(`echo agent running as ${me.displayName} (${me.id})`);
+await api('POST', '/v1/agent/capabilities', { stop: true });
+
+const seen = new Set();
+const stopping = new Set();
+
+async function handle(invocation) {
+  if (seen.has(invocation.id) || invocation.state !== 'pending') return;
+  seen.add(invocation.id);
+  const { spaceId, threadRootId } = invocation.conversation;
+  const text = plain(invocation.trigger.body);
+  console.log(`→ invoked by ${invocation.trigger.authorId}: ${text}`);
+  try {
+    await api('POST', `/v1/agent/invocations/${invocation.id}/ack`);
+    const slow = /\bslow\b/i.test(text);
+    await api('POST', `/v1/agent/invocations/${invocation.id}/update`, { state: 'working', activity: slow ? 'Taking my time' : 'Thinking it over' });
+    for (let waited = 0; waited < (slow ? 15_000 : 1_500); waited += 500) {
+      if (stopping.has(invocation.id)) {
+        await api('POST', `/v1/agent/invocations/${invocation.id}/update`, { state: 'cancelled' });
+        console.log('  stopped');
+        return;
+      }
+      await sleep(500);
+    }
+    await api('POST', `/v1/spaces/${spaceId}/messages`, { threadRoot: threadRootId, body: `Echo: ${text}`, actingMode: 'direct' });
+    await api('POST', `/v1/agent/invocations/${invocation.id}/update`, { state: 'done' });
+    console.log('  replied, done');
+  } catch (err) {
+    console.error('  failed:', err.message);
+    await api('POST', `/v1/agent/invocations/${invocation.id}/update`, { state: 'failed', error: err.message }).catch(() => {});
+  }
+}
+
+// The list is the guarantee: on start, and every minute.
+async function sweep() {
+  const { invocations } = await api('GET', '/v1/agent/invocations');
+  for (const invocation of invocations) void handle(invocation);
+}
+
+// The live frame is the fast path.
+function connect() {
+  const ws = new WebSocket(`${base.replace(/^http/, 'ws')}/v1/live?token=${encodeURIComponent(key)}`);
+  ws.onmessage = (event) => {
+    const frame = JSON.parse(String(event.data));
+    if (frame.kind === 'invocation') void handle(frame.invocation);
+    if (frame.kind === 'invocation_stop') stopping.add(frame.invocationId);
+  };
+  ws.onopen = () => void sweep();
+  ws.onclose = () => setTimeout(connect, 2000);
+}
+connect();
+setInterval(() => void sweep().catch((err) => console.error('sweep failed:', err.message)), 60_000);
```

**File**: `apps/harbor/packages/protocol/src/api.ts` (modified, +62/-1)
```diff
@@ -23,6 +23,7 @@ import {
   ResolveInviteResult,
 } from './invite.js';
 import { StreamEvent } from './events.js';
+import { ConnectorCapabilities, Invocation, InvocationId, InvocationOptionValues, InvocationUpdate } from './invocation.js';
 import { SearchKind, SearchResults } from './search.js';
 
 // The render face (spec §9): REST + the live stream in events.ts. Member token
@@ -64,6 +65,13 @@ const NewMessage = z.object({
   poll: NewPoll.optional(),
   actingMode: ActingMode,
   agentName: z.string().max(64).optional(),
+  /**
+   * Options picked for agents this message mentions (spec §8 Invocation
+   * options), keyed by the agent's member id. They land on that agent's
+   * invocation, uninterpreted; values for an agent the message does not
+   * mention are ignored.
+   */
+  agentOptions: z.record(MemberId, InvocationOptionValues).optional(),
 });
 
 /**
@@ -296,6 +304,58 @@ export const routes = {
     params: z.object({ agentId: MemberId, keyId: z.string().min(1).max(64) }),
     response: z.object({ key: AgentKey }),
   },
+  /**
+   * The connector's operations (spec §8 Invoking agent members, 2026-09-30):
+   * called on an agent's own key, about that agent's invocations only. Not
+   * tools for the model — the connector acknowledges and reports; the agent
+   * acts through the ordinary routes and tools.
+   */
+  listAgentInvocations: {
+    method: 'GET',
+    path: '/v1/agent/invocations',
+    response: z.object({ invocations: z.array(Invocation) }),
+  },
+  acknowledgeInvocation: {
+    method: 'POST',
+    path: '/v1/agent/invocations/:invocationId/ack',
+    params: z.object({ invocationId: InvocationId }),
+    response: z.object({ invocation: Invocation }),
+  },
+  updateInvocation: {
+    method: 'POST',
+    path: '/v1/agent/invocations/:invocationId/update',
+    params: z.object({ invocationId: InvocationId }),
+    request: InvocationUpdate,
+    response: z.object({ invocation: Invocation }),
+  },
+  declareCapabilities: {
+    method: 'POST',
+    path: '/v1/agent/capabilities',
+    request: ConnectorCapabilities,
+    response: z.object({ capabilities: ConnectorCapabilities }),
+  },
+  /** What an agent's connector declared — the composer's options, whether Stop is offered. Any org member. */
+  getAgentCapabilities: {
+    method: 'GET',
+    path: '/v1/agents/:agentId/capabilities',
+    params: z.object({ agentId: MemberId }),
+    response: z.object({ capabilities: ConnectorCapabilities }),
+  },
+  /** A space's invocations, newest first (a thread's, with threadRootId): the working indicators and refused lines. */
+  listInvocations: {
+    method: 'GET',
+    path: '/v1/spaces/:spaceId/invocations',
+    params: z.object({ spaceId: SpaceId }),
+    query: z.object({ threadRootId: MessageId.optional() }),
+    response: z.object({ invocations: z.array(Invocation) }),
+  },
+  /** Cancel a queued invocation (its invoker), or stop a running one (its invoker or an admin, when the connector can stop). */
+  cancelInvocation: {
+    method: 'POST',
+    path: '/v1/invocations/:invocationId/cancel',
+    params: z.object({ invocationId: InvocationId }),
+    response: z.object({ invocation: Invocation }),
+  },
   /**
    * Add existing org members, people or agents, to a shared space the caller
    * is in (spec §4 Roles, 2026-09-29). Each one added gets a `joined` event
@@ -602,7 +662,8 @@ export const routes = {
     path: '/v1/spaces/:spaceId/messages',
     params: z.object({ spaceId: SpaceId }),
     request: NewMessage,
-    response: z.object({ message: Message }),
+    /** `invocations`: the agents this message invoked, or refused to (spec §8) — absent from older orgs. */
+    response: z.object({ message: Message, invocations: z.array(Invocation).default([]) }),
   },
   /**
    * Author-only tombstone (the content plane is role-flat, so deleter ==
```

**File**: `apps/harbor/packages/protocol/src/events.ts` (modified, +17/-0)
```diff
@@ -2,6 +2,7 @@ import { z } from 'zod';
 import { ChangeSet } from './changeset.js';
 import { Attribution, Membership, Message, MessageDeletion, MessageEdit, PollEnd, PollVote, Reaction, Space, SpaceKind, Topic, TopicRemoval } from './core.js';
 import { AssetId, MemberId, MessageId, SpaceId, StreamOffset } from './ids.js';
+import { Invocation, InvocationId } from './invocation.js';
 
 // Decision 2 (CONTRACT.md): one WebSocket per org, per-space subscriptions,
 // offset-based catch-up. Subscribing with `afterOffset` replays durable events
@@ -268,6 +269,22 @@ export const ServerFrame = z.discriminatedUnion('kind', [
     at: z.iso.datetime(),
     payload: z.unknown(),
   }),
+  /**
+   * Addressed to an AGENT member's connections (spec §8 Invoking agent
+   * members, 2026-09-30): an invocation is ready for it — new, or next out of
+   * its conversation's queue. Ephemeral: a connector that was away lists the
+   * pending ones (listAgentInvocations), so nothing depends on this arriving.
+   */
+  z.object({ kind: z.literal('invocation'), invocation: Invocation }),
+  /** Addressed to an AGENT member's connections: stop this running invocation, then report it cancelled. */
+  z.object({ kind: z.literal('invocation_stop'), invocationId: InvocationId }),
+  /**
+   * To a space's subscribers, on every change of state of an invocation in
+   * it: the working indicator, what it waits for, a refused line. Ephemeral,
+   * never replayed; listInvocations is the snapshot. Older clients ignore
+   * unknown frame kinds by contract.
+   */
+  z.object({ kind: z.literal('invocation_state'), spaceId: SpaceId, invocation: Invocation }),
 ]);
 export type ServerFrame = z.infer<typeof ServerFrame>;
 
```

**File**: `apps/harbor/packages/protocol/src/invocation.ts` (modified, +8/-2)
```diff
@@ -52,6 +52,10 @@ export const InvocationOption = z.discriminatedUnion('type', [
 ]);
 export type InvocationOption = z.infer<typeof InvocationOption>;
 
+/** Values picked for a connector's declared options: a choice's id, or a toggle's on/off. */
+export const InvocationOptionValues = z.record(InvocationOptionKey, z.union([z.string().max(256), z.boolean()]));
+export type InvocationOptionValues = z.infer<typeof InvocationOptionValues>;
+
 export const Invocation = z.object({
   id: InvocationId,
   /** The agent member invoked. */
@@ -64,8 +68,8 @@ export const Invocation = z.object({
   where: z.object({ spaceKind: SpaceKind, spaceName: z.string() }),
   /** Agent hand-offs that led here: 0 for a person's mention. Harbor refuses past its limit. */
   depth: z.number().int().nonnegative(),
-  /** The values the invoker picked for the connector's declared options: a choice's id, or a toggle's on/off. */
-  options: z.record(InvocationOptionKey, z.union([z.string().max(256), z.boolean()])).optional(),
+  /** The values the invoker picked for the connector's declared options. */
+  options: InvocationOptionValues.optional(),
   /** Set when this invocation is a person's answer to one that is waiting in the same conversation. */
   answers: InvocationId.optional(),
   state: InvocationState,
@@ -75,6 +79,8 @@ export const Invocation = z.object({
   link: z.string().url().optional(),
   error: z.string().max(1000).optional(),
   refusal: InvocationRefusal.optional(),
+  /** Someone asked to stop it while it ran; the connector stops and reports cancelled. */
+  stopRequested: z.boolean().optional(),
   createdAt: z.iso.datetime(),
   updatedAt: z.iso.datetime(),
 });
```

**File**: `apps/harbor/packages/protocol/src/mcp.ts` (modified, +32/-1)
```diff
@@ -14,6 +14,7 @@ import {
 import { Attribution, Member, Membership, Message, ReactionEmoji, Space, SpaceKind, SpaceVisibility, Topic } from './core.js';
 import { AssetId, AssetPath, BlobHash, MemberId, MessageId, SpaceId, TopicId } from './ids.js';
 import { CreateInviteResult } from './invite.js';
+import { Invocation, InvocationId, InvocationOptionValues, InvocationRefusal, InvocationState } from './invocation.js';
 import { SearchKind, SearchLimit, SearchResults } from './search.js';
 
 // Decision 5 (CONTRACT.md): the agent face — direct projections of the core
@@ -293,8 +294,35 @@ export const postMessage = tool({
     threadRoot: MessageId.optional(),
     body: z.string().min(1).max(65_536),
     poll: NewPoll.optional(),
+    /** Options for agents the message mentions, keyed by agent member id (their declared options; see get_invocations). */
+    agentOptions: z.record(MemberId, InvocationOptionValues).optional(),
   }),
-  output: z.object({ messageId: MessageId, threadRoot: MessageId.optional() }),
+  output: z.object({
+    messageId: MessageId,
+    threadRoot: MessageId.optional(),
+    /** Agents this message invoked, or was refused (spec §8): say so if a hand-off was refused. */
+    invocations: z.array(z.object({ agentId: MemberId, state: InvocationState, refusal: InvocationRefusal.optional() })).optional(),
+  }),
+});
+
+/** Agent invocations in a space (spec §8), for "is it still working?" and "why didn't it answer?". */
+export const getInvocations = tool({
+  name: 'get_invocations',
+  description:
+    'Agent invocations in a space, newest first: which agent was asked, by whom, and its state ' +
+    '(queued, pending, working, waiting on a person, done, failed, cancelled, refused), with any ' +
+    'activity line. Pass threadRootId for one thread.',
+  input: z.object({ spaceId: SpaceId, threadRootId: MessageId.optional() }),
+  output: z.object({ invocations: z.array(Invocation) }),
+});
+
+export const stopInvocation = tool({
+  name: 'stop_invocation',
+  description:
+    'Cancel an agent invocation your person queued, or stop a running one (your person invoked it, ' +
+    'or is an admin) when the agent can be stopped. Only when they asked for it.',
+  input: z.object({ invocationId: InvocationId }),
+  output: z.object({ invocation: Invocation }),
 });
 
 export const editMessage = tool({
@@ -646,6 +674,8 @@ export const mcpTools = [
   markAllRead,
   searchSpace,
   postMessage,
+  getInvocations,
+  stopInvocation,
   editMessage,
   deleteMessage,
   react,
@@ -679,4 +709,5 @@ export const readOnlyMcpToolNames: ReadonlySet<string> = new Set([
   readAsset.name,
   assetHistory.name,
   diff.name,
+  getInvocations.name,
 ]);
```

---

### Incident Patch 5: `bddffa41` (2026-09-29)
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
@@ -478,7 +530,8 @@ const CodeFences = Extension.create({
 export function composerExtensions(getPlaceholder: () => string) {
     return [
         ChatStarterKit.configure({ link: false }),
-        Link.configure({ openOnClick: false, autolink: true }),
+        // 2026-09-29: Typing after a pasted link must start ordinary text.
+        Link.extend({ inclusive: false }).configure({ openOnClick: false, autolink: true }),
         MentionNode,
         // Pasted GIF/image links become the image itself (matches what the
         // message will show); serializes back to ![](url).
```

---

### Incident Patch 6: `0132479b` (2026-09-22)
**Commit Message**: harbor: give tests that boot Postgres in-process a realistic timeout

CI failed a push test with "timed out in 5000ms": several suites boot a
fresh PGlite database inside the test body, ~0.6s alone and several
seconds when every file's worker boots one at once on a loaded runner.
Vitest's 5s default was tuned for pure functions. 30s per test, 60s per
hook; the suite still finishes in ~10s locally.

Co-Authored-By: Claude Fable 5.1 <[REDACTED_EMAIL]>

**File**: `apps/harbor/packages/server/vitest.config.ts` (added, +12/-0)
```diff
@@ -0,0 +1,12 @@
+import { defineConfig } from 'vitest/config';
+
+// Every test runs on Postgres in-process (sql-pglite.ts), and several boot a
+// fresh database inside the test itself — about 0.6s alone, several seconds
+// on a loaded CI runner with every file's worker booting at once. Vitest's
+// default 5s per test was tuned for pure functions; these are not.
+export default defineConfig({
+  test: {
+    testTimeout: 30_000,
+    hookTimeout: 60_000,
+  },
+});
```

---

### Incident Patch 7: `4b3d62a6` (2026-09-21)
**Commit Message**: harbor: one buildOrgRuntime for both roots; one authenticateRequest for every face

Two composition roots built the same org graph differently, and had
already drifted: the single-org server's push sender carried the org's
display name where the deployment's carried the org id; the deployment
built one OIDC driver (and JWKS cache) per org for a single issuer; and
apex.ts assembled a third, degraded HarborService — no blob store, no
notifier — just to seed a new org's landing space. Seventeen test files
exercised the single-org root; one exercised the one that ships.

- runtime.ts: buildOrgRuntime(input) → { service, auth, handle, live } —
  service core, notifier + push, store-bound auth, the render and agent
  faces behind one handle(req, res), the live face's deps. The mentions
  backfill runs inside it, before the faces serve.
- server.ts: startHarbor = buildOrgRuntime + seedOrg (the dev/test seed,
  now its own function) + one server. Its push sender carries
  DEFAULT_ORG_ID ('org-default') — the one visible change, dev-only.
- deployment.ts: one runtime per org id (a Promise, so concurrent first
  requests share the build; a failed build is not cached), one token
  verifier pe

**File**: `apps/harbor/CONTRACT.md` (modified, +7/-2)
```diff
@@ -32,7 +32,9 @@ slate), or on durable Postgres with `DATABASE_URL`.
   fixtures (`test/merge.test.ts` is the conformance harness — it loads the
   fixture files directly). This exact engine ships in the real Harbor.
 - **Auth is a driver boundary** (`auth.ts`): `authenticate(token) → identity
-  (iss, sub)` then `resolveMember(identity) → member`. Two drivers: `dev`
+  (iss, sub)` then `resolveMember(identity) → member` — one function,
+  `authenticateRequest`, that every face runs, with the RFC 9728 header and
+  metadata document spelled once beside it (2026-09-21). Two drivers: `dev`
   (bearer `dev-<memberId>`; first sight creates the member — local dev and
   tests only) and `oidc` (`auth-oidc.ts`: pinned issuer, RFC 8414 discovery,
   JWKS-verified JWTs via jose, and an (iss, sub) → member lookup that NEVER
@@ -63,7 +65,10 @@ slate), or on durable Postgres with `DATABASE_URL`.
 - **Multi-org deployment** (`deployment.ts` + `directory.ts`, spec §4
   tenancy): `startHarborDeployment` serves 1..N orgs from one process over
   one Postgres — Host (X-Forwarded-Host wins) → org → a cached per-org
-  runtime (service + faces + per-org issuer/policy). `HarborService` stayed
+  runtime — assembled by `buildOrgRuntime` (`runtime.ts`), the one wiring
+  `startHarbor` uses too (2026-09-21); the apex seeds a new org's landing
+  space through it, and orgs on one issuer share one token verifier.
+  `HarborService` stayed
   single-org by design; migration 003 org-scopes members/spaces/identities
   (`member_identities` keys `(org_id, iss, sub)` — the same identity is a
   different member per org); space-scoped tables are untouched (globally
```

**File**: `apps/harbor/packages/server/src/apex.ts` (modified, +12/-13)
```diff
@@ -1,12 +1,11 @@
 import { Hono } from 'hono';
-import type { AuthDriver } from './auth.js';
+import { protectedResourceMetadata, wwwAuthenticate, type AuthDriver } from './auth.js';
 import { consentPageHtml } from './consent.js';
-import type { OrgDirectory } from './directory.js';
+import type { OrgConfig, OrgDirectory } from './directory.js';
 import { HarborError } from './errors.js';
 import { publicOrigin } from './origin.js';
-import type { SpaceHub } from './hub.js';
 import { PgStore } from './pg-store.js';
-import { HarborService } from './service.js';
+import type { HarborService } from './service.js';
 import type { SqlDb } from './sql.js';
 
 // The deployment face, served on the APEX domain (spaces.rowboatlabs.com) —
@@ -31,8 +30,12 @@ export interface ApexDeps {
   db: SqlDb;
   directory: OrgDirectory;
   auth: AuthDriver;
-  /** Shared event hub — the seeded space's events flow like any other. */
-  hub: SpaceHub;
+  /**
+   * The org's assembled service (runtime.ts, through the deployment's
+   * per-org cache): a new org's landing space is seeded on the exact wiring
+   * that will serve it, and its runtime is warm before its first request.
+   */
+  serviceFor(org: OrgConfig): Promise<HarborService>;
   /** e.g. spaces.rowboatlabs.com — org domains are `<slug>.<apexDomain>`. */
   apexDomain: string;
   /** The deployment's AS — every created org pins this issuer. */
@@ -52,10 +55,7 @@ export function buildApexApp(deps: ApexDeps): Hono {
   app.onError((err, c) => {
     const e = err instanceof HarborError ? err : new HarborError('internal', 'unexpected error');
     if (!(err instanceof HarborError)) console.error('[harbor] apex error:', err);
-    if (e.code === 'unauthorized') {
-      const origin = publicOrigin(c);
-      c.header('WWW-Authenticate', `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`);
-    }
+    if (e.code === 'unauthorized') c.header('WWW-Authenticate', wwwAuthenticate(publicOrigin(c)));
     return c.json(e.toBody(), e.status as 400);
   });
 
@@ -71,8 +71,7 @@ export function buildApexApp(deps: ApexDeps): Hono {
   // Same discovery shape as an org, so the app's existing OAuth dance works
   // against the apex unchanged.
   app.get('/.well-known/oauth-protected-resource', (c) => {
-    const origin = publicOrigin(c);
-    return c.json({ resource: origin, authorization_servers: [deps.issuer], bearer_methods_supported: ['header'] });
+    return c.json(protectedResourceMetadata(publicOrigin(c), [deps.issuer]));
   });
 
   /** Create an org: {name, slug} → org at slug.<apexDomain>, caller = first admin. */
@@ -108,7 +107,7 @@ export function buildApexApp(deps: ApexDeps): Hono {
     // place rather than an empty list. Attributed to the founder — every act
     // belongs to a member, and this is theirs.
     if (member) {
-      const service = new HarborService(store, deps.hub, { name: org.name, address: domain });
+      const service = await deps.serviceFor(org);
       const space = await service.createSpace({ memberId: member.id }, 'general');
       await service.createAsset({ memberId: member.id }, space.id, {
         path: 'README.md',
```

**File**: `apps/harbor/packages/server/src/auth.ts` (modified, +54/-0)
```diff
@@ -59,6 +59,60 @@ export function bindAuth(driver: AuthDriver, store: Store): OrgAuth {
   };
 }
 
+/** What a request's credentials resolve to on an org. */
+export interface Principal {
+  identity: AuthIdentity;
+  member: Member;
+}
+
+export interface RequestCredentials {
+  authorization: string | undefined;
+  /** The WS face's substitute for the header (browsers cannot set headers on upgrades). */
+  queryToken?: string | null;
+}
+
+/**
+ * The two-step dance every face runs, in one place: bearer → identity →
+ * member of THIS org. Throws the driver's HarborErrors (unauthorized,
+ * not_a_member). `allowUnmapped` is for the one route whose caller may be
+ * authenticated-but-not-yet-a-member — accept-invite — where the identity
+ * comes back with no member instead of not_a_member.
+ */
+export async function authenticateRequest(auth: OrgAuth, credentials: RequestCredentials): Promise<Principal>;
+export async function authenticateRequest(
+  auth: OrgAuth,
+  credentials: RequestCredentials,
+  opts: { allowUnmapped: true },
+): Promise<{ identity: AuthIdentity; member?: Member }>;
+export async function authenticateRequest(
+  auth: OrgAuth,
+  credentials: RequestCredentials,
+  opts?: { allowUnmapped: true },
+): Promise<{ identity: AuthIdentity; member?: Member }> {
+  const identity = await auth.authenticate(credentials.authorization, credentials.queryToken);
+  try {
+    return { identity, member: await auth.resolveMember(identity) };
+  } catch (err) {
+    if (opts?.allowUnmapped && err instanceof HarborError && err.code === 'not_a_member') return { identity };
+    throw err;
+  }
+}
+
+// --- RFC 9728, spelled once for every face -------------------------------------
+
+/** The 401's pointer at the resource metadata, so MCP-style clients find the OAuth dance mechanically. */
+export function wwwAuthenticate(origin: string): string {
+  return `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`;
+}
+
+/** The protected-resource metadata document: the org (or the apex) names its authorization server(s). */
+export function protectedResourceMetadata(
+  origin: string,
+  authorizationServers: string[],
+): { resource: string; authorization_servers: string[]; bearer_methods_supported: string[] } {
+  return { resource: origin, authorization_servers: authorizationServers, bearer_methods_supported: ['header'] };
+}
+
 // --- dev driver --------------------------------------------------------------
 
 export const DEV_ISSUER = 'dev';
```

**File**: `apps/harbor/packages/server/src/deployment.ts` (modified, +72/-72)
```diff
@@ -1,29 +1,27 @@
-import { Notifier } from './notify.js';
-import { PushSender } from './push.js';
-import { createServer, type IncomingMessage, type Server as HttpServer, type ServerResponse } from 'node:http';
+import { createServer, type IncomingMessage, type Server as HttpServer } from 'node:http';
 import type { AddressInfo } from 'node:net';
 import { getRequestListener } from '@hono/node-server';
 import { buildApexApp } from './apex.js';
-import { bindAuth, DevAuthDriver, type AuthDriver, type OrgAuth } from './auth.js';
+import { DevAuthDriver, type AuthDriver } from './auth.js';
 import { OidcAuthDriver } from './auth-oidc.js';
 import type { BlobStore } from './blobs.js';
 import { OrgDirectory, normalizeDomain, type CreateOrgInput, type OrgConfig } from './directory.js';
-import { buildHttpApp } from './http.js';
+import { HarborError } from './errors.js';
 import { SpaceHub } from './hub.js';
-import { handleMcpRequest } from './mcp.js';
 import { migrate } from './migrations.js';
 import { PgStore } from './pg-store.js';
-import { HarborService } from './service.js';
+import { buildOrgRuntime, type OrgRuntime } from './runtime.js';
 import type { SqlDb } from './sql.js';
 import { attachLive } from './ws.js';
 
 // The multi-org deployment (spec §4 "Deployment and tenancy"): one process,
 // 1..N orgs, resolved from the Host header (X-Forwarded-Host wins — every
 // supported platform proxies). HarborService stays single-org; this layer
-// holds one cached runtime (service + faces + auth) per org over one shared
-// SqlDb and one shared hub (space ids are globally unique, so a shared hub
-// cannot cross-deliver). startHarbor (server.ts) remains the single-org
-// self-host/dev path — one org, one config, no directory.
+// maps Host → org and caches one runtime per org — assembled by
+// buildOrgRuntime (runtime.ts), the same wiring startHarbor (server.ts) uses
+// for its one org — over one shared SqlDb and one shared hub (space ids are
+// globally unique, so a shared hub cannot cross-deliver). One token verifier
+// per issuer: every org on the deployment's AS shares one JWKS cache.
 
 export interface DeploymentOptions {
   db: SqlDb;
@@ -66,12 +64,6 @@ export interface RunningDeployment {
   close(): Promise<void>;
 }
 
-interface OrgRuntime {
-  service: HarborService;
-  auth: OrgAuth;
-  hono: (req: IncomingMessage, res: ServerResponse) => void;
-}
-
 export async function startHarborDeployment(options: DeploymentOptions): Promise<RunningDeployment> {
   await migrate(options.db);
   // Derived-index repair rides boot on BOTH boot paths (this one and the
@@ -81,7 +73,61 @@ export async function startHarborDeployment(options: DeploymentOptions): Promise
   await new PgStore(options.db).backfillAssetSearch();
   const directory = new OrgDirectory(options.db);
   const hub = new SpaceHub();
-  const runtimes = new Map<string, OrgRuntime>();
+  // One runtime per org, built on first sight — a Promise, so concurrent first
+  // requests share the build — and one token verifier per issuer.
+  const runtimes = new Map<string, Promise<OrgRuntime | undefined>>();
+  const orgByDomain = new Map<string, OrgConfig>();
+  const drivers = new Map<string, AuthDriver>();
+  const driverFor = (issuer: string | undefined): AuthDriver => {
+    if (!issuer) return new DevAuthDriver();
+    let driver = drivers.get(issuer);
+    if (!driver) {
+      driver = new OidcAuthDriver({ issuer });
+      drivers.set(issuer, driver);
+    }
+    return driver;
+  };
+
+  function runtimeForOrg(org: OrgConfig): Promise<OrgRuntime | undefined> {
+    let pending = runtimes.get(org.id);
+    if (!pending) {
+      // An issuer-less org runs dev auth only where the deployment allows it:
+      // on a public deployment that is a misconfiguration, not a fallback.
+      pending =
+        !org.issuer && !options.allowDevOrgs
+          ? Promise.resolve(undefined)
+          : buildOrgRuntime({
+              store: new PgStore(options.db, org.id),
+              hub,
+              org: {
+                name: org.name,
+                address: org.domains[0] ?? org.id,
+                ...(org.allowedEmailDomains ? { allowedEmailDomains: org.allowedEmailDomains } : {}),
+              },
+              orgId: org.id,
+              auth: driverFor(org.issuer),
+              ...(options.blobs ? { blobs: options.blobs(org.id) } : {}),
+              ...(org.issuer && options.consentPublishableKey ? { consentPublishableKey: options.consentPublishableKey } : {}),
+              ...(options.maxBlobBytes !== undefined ? { maxBlobBytes: options.maxBlobBytes } : {}),
+            });
+      runtimes.set(org.id, pending);
+      // A failed build is not cached — the next request tries again.
+      pending.catch(() => runtimes.delete(org.id));
+    }
+    return pending;
+  }
+
+  async function runtimeFor(host: string | undefined): Promise<OrgRuntime | undefined> {
+    if (!host) return undefined;
+    const domain = 
```

**File**: `apps/harbor/packages/server/src/http.ts` (modified, +7/-19)
```diff
@@ -1,7 +1,7 @@
 import { Hono, type Context } from 'hono';
 import { routes } from '@rowboat/spaces-protocol';
 import type { z } from 'zod';
-import type { AuthIdentity, OrgAuth } from './auth.js';
+import { authenticateRequest, protectedResourceMetadata, wwwAuthenticate, type AuthIdentity, type OrgAuth } from './auth.js';
 import { consentPageHtml } from './consent.js';
 import { HarborError } from './errors.js';
 import { publicOrigin } from './origin.js';
@@ -65,10 +65,7 @@ export function buildHttpApp(deps: {
     if (!(err instanceof HarborError)) console.error('[harbor] internal error:', err);
     // RFC 9728: 401s point clients at the resource metadata so any MCP-style
     // client can find the OAuth dance mechanically.
-    if (e.code === 'unauthorized' && auth.metadata()) {
-      const origin = publicOrigin(c);
-      c.header('WWW-Authenticate', `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource"`);
-    }
+    if (e.code === 'unauthorized' && auth.metadata()) c.header('WWW-Authenticate', wwwAuthenticate(publicOrigin(c)));
     return c.json(e.toBody(), e.status as 400);
   });
 
@@ -78,12 +75,7 @@ export function buildHttpApp(deps: {
   app.get('/.well-known/oauth-protected-resource', (c) => {
     const meta = auth.metadata();
     if (!meta) throw new HarborError('not_found', 'no authorization server configured (dev auth)');
-    const origin = publicOrigin(c);
-    return c.json({
-      resource: origin,
-      authorization_servers: meta.authorizationServers,
-      bearer_methods_supported: ['header'],
-    });
+    return c.json(protectedResourceMetadata(publicOrigin(c), meta.authorizationServers));
   });
 
   // The human moment of the OAuth dance (pre-auth by nature — the person is
@@ -101,18 +93,14 @@ export function buildHttpApp(deps: {
   // the handler runs the bind ceremony instead.
   app.use('/v1/*', async (c, next) => {
     if (c.req.path === routes.resolveInvite.path || c.req.path === '/v1/health') return next();
-    const identity = await auth.authenticate(c.req.header('authorization'), new URL(c.req.url).searchParams.get('token'));
+    const credentials = { authorization: c.req.header('authorization'), queryToken: new URL(c.req.url).searchParams.get('token') };
     if (c.req.path === routes.acceptInvite.path) {
+      const { identity, member } = await authenticateRequest(auth, credentials, { allowUnmapped: true });
       c.set('identity', identity);
-      try {
-        c.set('memberId', (await auth.resolveMember(identity)).id);
-      } catch (err) {
-        if (!(err instanceof HarborError) || err.code !== 'not_a_member') throw err;
-      }
+      if (member) c.set('memberId', member.id);
       return next();
     }
-    const member = await auth.resolveMember(identity);
-    c.set('memberId', member.id);
+    c.set('memberId', (await authenticateRequest(auth, credentials)).member.id);
     return next();
   });
 
```

**File**: `apps/harbor/packages/server/src/index.ts` (modified, +4/-2)
```diff
@@ -23,8 +23,10 @@ export type { MergeResult, MergeConflictRegion } from './merge.js';
 export { HarborError } from './errors.js';
 export { enforce, canAccessSpace, canWrite, canChangeMembership, canRenameSpace, isAuthor, canBind } from './policy.js';
 export type { Decision } from './policy.js';
-export { DevAuthDriver, ensureMember, bindAuth, DEV_ISSUER } from './auth.js';
-export type { AuthDriver, AuthIdentity, OrgAuth } from './auth.js';
+export { DevAuthDriver, ensureMember, bindAuth, authenticateRequest, wwwAuthenticate, protectedResourceMetadata, DEV_ISSUER } from './auth.js';
+export type { AuthDriver, AuthIdentity, OrgAuth, Principal, RequestCredentials } from './auth.js';
+export { buildOrgRuntime } from './runtime.js';
+export type { OrgRuntime, OrgRuntimeInput } from './runtime.js';
 export { OidcAuthDriver } from './auth-oidc.js';
 export type { OidcOptions } from './auth-oidc.js';
 export { consentPageHtml } from './consent.js';
```

**File**: `apps/harbor/packages/server/src/mcp.ts` (modified, +4/-8)
```diff
@@ -4,8 +4,9 @@ import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/
 import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
 import { mcpTools, NewPoll, type ActingMode, type ActivityItem, type ActivityKind, type SearchKind, relabelMentions, type Message } from '@rowboat/spaces-protocol';
 import { z } from 'zod';
-import type { OrgAuth } from './auth.js';
+import { authenticateRequest, wwwAuthenticate, type OrgAuth } from './auth.js';
 import { HarborError } from './errors.js';
+import { publicOriginOf } from './origin.js';
 import type { ActorCtx, HarborService } from './service.js';
 
 // The agent face (CONTRACT.md decision 5): the protocol tools served over
@@ -34,8 +35,7 @@ interface McpActor {
 export async function handleMcpRequest(req: IncomingMessage, res: ServerResponse, deps: Deps): Promise<void> {
   let actor: McpActor;
   try {
-    const identity = await deps.auth.authenticate(req.headers.authorization);
-    const member = await deps.auth.resolveMember(identity);
+    const { member } = await authenticateRequest(deps.auth, { authorization: req.headers.authorization });
     actor = {
       memberId: member.id,
       actingMode: req.headers['x-acting-mode'] === 'scheduled' ? 'scheduled' : 'agent',
@@ -45,11 +45,7 @@ export async function handleMcpRequest(req: IncomingMessage, res: ServerResponse
     const e = err instanceof HarborError ? err : new HarborError('unauthorized', 'unauthorized');
     const headers: Record<string, string> = { 'content-type': 'application/json' };
     // RFC 9728: MCP clients discover the OAuth dance from this header.
-    if (e.code === 'unauthorized' && deps.auth.metadata()) {
-      const proto = typeof req.headers['x-forwarded-proto'] === 'string' ? req.headers['x-forwarded-proto'] : 'http';
-      headers['WWW-Authenticate'] =
-        `Bearer resource_metadata="${proto}://${req.headers.host}/.well-known/oauth-protected-resource"`;
-    }
+    if (e.code === 'unauthorized' && deps.auth.metadata()) headers['WWW-Authenticate'] = wwwAuthenticate(publicOriginOf(req));
     res.writeHead(e.status, headers).end(
       JSON.stringify({ jsonrpc: '2.0', error: { code: -32001, message: e.message }, id: null }),
     );
```

**File**: `apps/harbor/packages/server/src/origin.ts` (modified, +23/-4)
```diff
@@ -1,3 +1,4 @@
+import type { IncomingMessage } from 'node:http';
 import type { Context } from 'hono';
 
 /**
@@ -6,11 +7,29 @@ import type { Context } from 'hono';
  * metadata, WWW-Authenticate pointers) must trust the proxy's
  * X-Forwarded-Proto/-Host — otherwise a deployed Harbor describes itself as
  * http:// and strict clients that compare resource identifiers exactly
- * mismatch.
+ * mismatch. One rule, two entry points: a Hono context, or the raw node
+ * request the MCP face holds.
  */
+function compose(h: { forwardedProto: string | undefined; forwardedHost: string | undefined; protocol: string; host: string }): string {
+  return `${h.forwardedProto ?? h.protocol}://${h.forwardedHost ?? h.host}`;
+}
+
 export function publicOrigin(c: Context): string {
   const url = new URL(c.req.url);
-  const proto = c.req.header('x-forwarded-proto') ?? url.protocol.replace(/:$/, '');
-  const host = c.req.header('x-forwarded-host') ?? url.host;
-  return `${proto}://${host}`;
+  return compose({
+    forwardedProto: c.req.header('x-forwarded-proto'),
+    forwardedHost: c.req.header('x-forwarded-host'),
+    protocol: url.protocol.replace(/:$/, ''),
+    host: url.host,
+  });
+}
+
+export function publicOriginOf(req: IncomingMessage): string {
+  const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);
+  return compose({
+    forwardedProto: first(req.headers['x-forwarded-proto']),
+    forwardedHost: first(req.headers['x-forwarded-host']),
+    protocol: 'http',
+    host: req.headers.host ?? 'localhost',
+  });
 }
```

---

### Incident Patch 8: `0cd2aca4` (2026-09-21)
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
-3. ~~Postgres storage~~ — done: `pg-store.ts` implements the Store boundary over a minimal SQL adapter (`sql.ts`; node-postgres for deployments, in-process PGlite for hermetic tests). `withSpaceLock` = one transaction holding a per-space advisory lock, with every store call inside riding that transaction (AsyncLocalStorage). **The §11 day-in-the-life suite runs twice — memory and Postgres — with identical assertions**; that dual run is the storage-swap gate, permanently. `DATABASE_URL` flips `pnpm dev` to durable storage (seeding is restart-idempotent). Postgres-only on purpose: no S3 in v1 — ≤1MB text contents ride in the log rows; state/history/feed/stream are projections.
+3. ~~Postgres storage~~ — done: `pg-store.ts` implements the Store boundary over a minimal SQL adapter (`sql.ts`; node-postgres for deployments, in-process PGlite for hermetic tests). `withSpaceLock` = one transaction holding a per-space advisory lock, with every store call inside riding that transaction (AsyncLocalStorage). The §11 day-in-the-life suite ran twice — memory and Postgres — as the storage-swap gate until 2026-09-21, when the memory driver was retired and every test moved to PGlite (Storage, above). `DATABASE_URL` flips `pnpm dev` to durable storage (seeding is restart-idempotent). Postgres-only on purpose: no S3 in v1 — ≤1MB text contents ride in the log rows; state/history/feed/stream are projections.
 4. ~~Real OAuth~~ — **DONE end to end, live-verified against Supabase Auth**: the `oidc` auth driver, the login/consent page (buttons derived from the AS's /settings), the invite-binding ceremony, and the app side — 
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

**File**: `apps/harbor/packages/server/src/main.ts` (modified, +14/-12)
```diff
@@ -8,12 +8,12 @@ import { S3BlobStore } from './blobs-s3.js';
 import { PgStore } from './pg-store.js';
 import { startHarbor } from './server.js';
 import { postgresDb } from './sql.js';
-import type { Store } from './store.js';
 
 // Dev entry: a seeded single-org Harbor for dogfooding. The seed is the
 // Roadboard slice from spec §11 — the team, the space, the roadmap.
-// In-memory by default (restart = clean slate); set DATABASE_URL for durable
-// Postgres storage (seeding is idempotent across restarts). Set AUTH_ISSUER
+// PGlite in-memory by default — the Postgres store, in-process; restart =
+// clean slate — or durable Postgres with DATABASE_URL (seeding is idempotent
+// across restarts). Set AUTH_ISSUER
 // to a pinned AS issuer URL for real OAuth (dev tokens otherwise — never
 // expose those publicly). Until the invite ceremony lands, oidc members are
 // seeded by inserting (iss, sub) rows into member_identities directly.
@@ -57,7 +57,7 @@ const port = Number(process.env.PORT ?? 4272);
 //   BLOBS_S3_BUCKET (+ BLOBS_S3_ENDPOINT/REGION/FORCE_PATH_STYLE,
 //     credentials via the AWS provider chain or BLOBS_S3_ACCESS_KEY_ID/SECRET)
 //   BLOBS_DIR — disk driver (self-hosted single-node)
-// Neither set: dev mode falls back to in-memory (restart = clean slate);
+// Neither set: dev mode keeps blob bytes in memory (restart = clean slate);
 // deployment mode leaves uploads unconfigured and the routes refuse loudly.
 function blobStoreFactory(): ((orgId: string) => BlobStore) | undefined {
   const bucket = process.env.BLOBS_S3_BUCKET;
@@ -127,12 +127,14 @@ if (process.env.HARBOR_MODE === 'deployment') {
 }
 
 async function startDevHarbor(): Promise<void> {
-let store: Store | undefined;
-if (process.env.DATABASE_URL) {
-  const pgStore = new PgStore(postgresDb(process.env.DATABASE_URL, poolOpts));
-  await pgStore.init();
-  store = pgStore;
-}
+// Durable Postgres via DATABASE_URL; otherwise the same store in-process on
+// PGlite (restart = clean slate). The WASM engine is loaded here and only
+// here — deployment mode never imports it.
+const db = process.env.DATABASE_URL
+  ? postgresDb(process.env.DATABASE_URL, poolOpts)
+  : await (await import('./sql-pglite.js')).pgliteDb();
+const store = new PgStore(db);
+await store.init();
 
 let auth: AuthDriver | undefined;
 if (process.env.AUTH_ISSUER) {
@@ -146,7 +148,7 @@ const blobFactory = blobStoreFactory();
 
 const harbor = await startHarbor({
   port,
-  ...(store ? { store } : {}),
+  store,
   ...(blobFactory ? { blobs: blobFactory('org-default') } : {}),
   ...(maxBlobBytes !== undefined ? { maxBlobBytes } : {}),
   ...(auth ? { auth } : {}),
@@ -172,7 +174,7 @@ const harbor = await startHarbor({
 
 const spaces = await harbor.service.listSpaces({ memberId: 'ramnique' });
 
-console.log(`Harbor (single org, ${store ? 'Postgres via DATABASE_URL' : 'in-memory — restart = clean slate'})`);
+console.log(`Harbor (single org, ${process.env.DATABASE_URL ? 'Postgres via DATABASE_URL' : 'PGlite in-memory — restart = clean slate'})`);
 console.log(
   `  blobs      ${process.env.BLOBS_S3_BUCKET ? `s3 bucket ${process.env.BLOBS_S3_BUCKET}` : process.env.BLOBS_DIR ? `disk ${process.env.BLOBS_DIR}` : 'in-memory (set BLOBS_DIR or BLOBS_S3_BUCKET for durable uploads)'}`,
 );
```

**File**: `apps/harbor/packages/server/src/memory-store.ts` (removed, +0/-821)
```diff
@@ -1,821 +0,0 @@
-import type { ActivityKind } from '@rowboat/spaces-protocol';
-import type { ActivityQuery, ActivityRow } from './store.js';
-import { olderThan, sortActivity } from './activity-sort.js';
-import type {
-  ChangeSet,
-  Member,
-  Membership,
-  MentionStamps,
-  Message,
-  Space,
-  Topic,
-} from '@rowboat/spaces-protocol';
-import { extractSearchText, matchesAllTerms, searchTextFor, snippetAround, type SearchQuery } from './search.js';
-import {
-  type MessageWindow, type PushLevel, directKeyFor } from './store.js';
-import type {
-  AssetRecord,
-  AssetSearchRow,
-  AssetVersionData,
-  MessageSearchRow,
-  Store,
-  StoredEvent,
-  StoredInvite,
-  StoredPollVote,
-  StoredReaction,
-  StoredSpaceBlob,
-  ThreadReadMark,
-  UnreadThreadRow,
-} from './store.js';
-
-interface SpaceState {
-  space: Space;
-  memberships: Map<string, Membership>;
-  assets: Map<string, AssetRecord>; // assetId → record (inode model; path is a property)
-  assetVersions: Map<string, AssetVersionData>; // `${assetId}@${version}`
-  blobs: Map<string, StoredSpaceBlob>; // hash → registration (first write wins)
-  changeSets: ChangeSet[]; // append order == offset order
-  changeSetsById: Map<string, ChangeSet>;
-  topics: Map<string, Topic>; // annotation rows (id → row, never carrying documentAssetId); messages never reference them
-  topicDocuments: Map<string, string>; // topicId → linked assetId (migration 019)
-  messages: Message[]; // the one stream, roots and replies interleaved, oldest first
-  messagesById: Map<string, Message>;
-  reactions: Map<string, StoredReaction[]>; // messageId → oldest first
-  pollVotes: Map<string, StoredPollVote[]>; // messageId → oldest first
-  events: StoredEvent[]; // offsets start at 1; events[i].offset === i + 1
-  streamMarks: Map<string, { readOffset: number; updatedAt: string }>; // memberId → stream mark
-  threadMarks: Map<string, { following: boolean; readOffset: number; updatedAt: string }>; // `${root}\n${member}`
-  lock: Promise<void>;
-}
-
-export class MemoryStore implements Store {
-  private members = new Map<string, Member>();
-  private identities = new Map<string, string>(); // `${iss}\n${sub}` → memberId
-  private spaces = new Map<string, SpaceState>();
-  private activitySeen = new Map<string, string>();
-  private directKeys = new Map<string, string>(); // direct key → spaceId (the unique index, in memory)
-  private invites = new Map<string, StoredInvite>();
-  private backfills = new Set<string>();
-  private pushTokens = new Map<string, { memberId: string; updatedAt: string }>(); // token → owner
-  private pushLevels = new Map<string, PushLevel>();
-
-  private state(spaceId: string): SpaceState | undefined {
-    return this.spaces.get(spaceId);
-  }
-
-  private must(spaceId: string): SpaceState {
-    const s = this.spaces.get(spaceId);
-    if (!s) throw new Error(`unknown space ${spaceId}`);
-    return s;
-  }
-
-  async getMember(id: string): Promise<Member | undefined> {
-    return this.members.get(id);
-  }
-
-  async putMember(member: Member): Promise<void> {
-    this.members.set(member.id, member);
-  }
-
-  async listAllMembers(): Promise<Member[]> {
-    return [...this.members.values()];
-  }
-
-  async getMemberByIdentity(iss: string, sub: string): Promise<Member | undefined> {
-    const memberId = this.identities.get(`${iss}\n${sub}`);
-    return memberId === undefined ? undefined : this.members.get(memberId);
-  }
-
-  async putIdentity(iss: string, sub: string, memberId: string): Promise<void> {
-    this.identities.set(`${iss}\n${sub}`, memberId);
-  }
-
-  async putSpace(space: Space): Promise<void> {
-    const existing = this.spaces.get(space.id);
-    if (existing) {
-      existing.space = space;
-      return;
-    }
-    if (space.kind === 'direct') {
-      const key = directKeyFor(space.participants ?? []);
-      const holder = this.directKeys.get(key);
-      if (holder !== undefined && holder !== space.id) {
-        throw new Error(`direct space ${holder} already holds key ${key}`);
-      }
-      this.directKeys.set(key, space.id);
-    }
-    this.spaces.set(space.id, {
-      space,
-      memberships: new Map(),
-      assets: new Map(),
-      assetVersions: new Map(),
-      blobs: new Map(),
-      changeSets: [],
-      changeSetsById: new Map(),
-      topics: new Map(),
-      topicDocuments: new Map(),
-      messages: [],
-      messagesById: new Map(),
-      reactions: new Map(),
-      pollVotes: new Map(),
-      events: [],
-      streamMarks: new Map(),
-      threadMarks: new Map(),
-      lock: Promise.resolve(),
-    });
-  }
-
-  async getSpace(id: string): Promise<Space | undefined> {
-    return this.state(id)?.space;
-  }
-
-  async listSpacesFor(memberId: string, opts: { includeDirect?: boolean } = {}): Promise<Space[]> {
-    return [...this.spaces.values()]
-      .filter((s) => s.memberships.has(memberId))
-      .map((s) => s.space)
-      .filter((s) => opts.includeD
```

**File**: `apps/harbor/packages/server/src/pg-store.ts` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ import type {
 } from '@rowboat/spaces-protocol';
 import { migrate } from './migrations.js';
 import { sortActivity } from './activity-sort.js';
-import { extractSearchText, matchesAllTerms, searchTextFor, snippetAround, toPathPatterns, toTsQueryString, type SearchQuery } from './search.js';
+import { extractSearchText, searchTextFor, snippetAround, toPathPatterns, toTsQueryString, type SearchQuery } from './search.js';
 import type { SqlDb, SqlExecutor } from './sql.js';
 import {
   type MessageWindow, type PushLevel,
```

---

### Incident Patch 9: `2fdae425` (2026-09-17)
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
+- **Main and child server** (esbuild via `apps/main/bundle.mjs` and `bundle-config.mjs`): the same key, host, and app version are inlined into both `main.cjs` and `rowboat-server.cjs`. Setting build-time values only for main does not configure the child process. Unbundled dev servers read credentials from `process.env`.
+- **Standalone/headless builds**: continue to use runtime environment variables; the desktop packaging defaults do not change their configuration.
+
+The child server flushes its PostHog queue before exiting on SIGINT/SIGTERM or parent loss, within its existing five-second shutdown deadline.
 
 For GitHub Actions / packaged builds: set both as workflow env vars (from secrets) on the step that runs `npm run package` or `npm run make`. They'll be baked in.
 
-If unset, analytics no-op silently — you'll see `[Analytics] POSTHOG_KEY not set; analytics disabled` in main-process logs.
+If unset, analytics no-op silently — you'll see `[Analytics] POSTHOG_KEY not set; analytics disabled` in the process hosting core.
 
 `installationId`: stored in `~/.rowboat/config/installation.json`, generated on first run.
 
@@ -308,8 +311,9 @@ If unset, analytics no-op silently — you'll see `[Analytics] POSTHOG_KEY not s
 | `pa
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
+    for (const event of ['spaces_rowboat_invoked', 'spaces_rowboat_message_posted']) {
+      expect(events.filter((entry) => entry.event === event)).toEqual([
+        expect.objectContaining({ distinct_id: 'test-user', properties: expect.objectContaining({ app_version: '9.8.7', platform: 'desktop' }) }),
+      ]);
+    }
+    expect(events.find((entry) => entry.event === 'after_sign_out').distinct_id).toBe('test-installation');
+    expect(events).toContainEqual(expect.objectContaining({ event: '$identify', distinct_id: 'test-user' }));
+  } finally {
+    await new Promise((resolve) => receiver.close(resolve));
+    await rm(directory, { recursive: true, force: true });
+  }
+}, 15000);
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

### Incident Patch 10: `c771b824` (2026-09-15)
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
                 onStartRecordingForTab={(id) => { switchChatTab(id); handleStartRecording(chatIdForTab(id)) }}
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
   } catch { return fallback }
 }
 
```

---

### Incident Patch 11: `90233786` (2026-09-15)
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
+- **Main and child server** (esbuild via `apps/main/bundle.mjs` and `bundle-config.mjs`): the same key, host, and app version are inlined into both `main.cjs` and `rowboat-server.cjs`. Setting build-time values only for main does not configure the child process. Unbundled dev servers read credentials from `process.env`.
+- **Standalone/headless builds**: continue to use runtime environment variables; the desktop packaging defaults do not change their configuration.
+
+The child server flushes its PostHog queue before exiting on SIGINT/SIGTERM or parent loss, within its existing five-second shutdown deadline.
 
 For GitHub Actions / packaged builds: set both as workflow env vars (from secrets) on the step that runs `npm run package` or `npm run make`. They'll be baked in.
 
-If unset, analytics no-op silently — you'll see `[Analytics] POSTHOG_KEY not set; analytics disabled` in main-process logs.
+If unset, analytics no-op silently — you'll see `[Analytics] POSTHOG_KEY not set; analytics disabled` in the process hosting core.
 
 `installationId`: stored in `~/.rowboat/config/installation.json`, generated on first run.
 
@@ -308,8 +311,9 @@ If unset, analytics no-op silently — you'll see `[Analytics] POSTHOG_KEY not s
 | `pa
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
+    for (const event of ['spaces_rowboat_invoked', 'spaces_rowboat_message_posted']) {
+      expect(events.filter((entry) => entry.event === event)).toEqual([
+        expect.objectContaining({ distinct_id: 'test-user', properties: expect.objectContaining({ app_version: '9.8.7', platform: 'desktop' }) }),
+      ]);
+    }
+    expect(events.find((entry) => entry.event === 'after_sign_out').distinct_id).toBe('test-installation');
+    expect(events).toContainEqual(expect.objectContaining({ event: '$identify', distinct_id: 'test-user' }));
+  } finally {
+    await new Promise((resolve) => receiver.close(resolve));
+    await rm(directory, { recursive: true, force: true });
+  }
+}, 15000);
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

### Incident Patch 12: `09e2ec7c` (2026-09-15)
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
+      if (channel === 'spaces:proposeChange') return { outcome: 'conflict' }
+      throw new Error(`Unexpected channel ${channel}`)
+    })
+    render(file())
+    const checkbox = await screen.findByRole('checkbox', { name: 'Task item checkbox for Last task' })
+    fireEvent.click(checkbox)
+    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.stringContaining('Someone changed this line'), 'error'))
+    expect(checkbox).not.toBeChecked()
+    expect(onChanged).not.toHaveBeenCalled()
+  })
+
+  it('keeps viewers without a save callback read-only', async () => {
+    render(<RichMarkdownViewer content="- [ ] Read only" />)
+    const checkbox = await screen.findByRole('checkbox')
+    fireEvent.click(checkbox)
+    expect(checkbox).not.toBeChecked()
+    expect(invoke).not.toHaveBeenCalled()
+  })
+})
```

---

### Incident Patch 13: `283abd28` (2026-09-15)
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

### Incident Patch 14: `7b3c7f2c` (2026-09-15)
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

### Incident Patch 15: `16ff0c33` (2026-09-15)
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

#### Recent Merged Pull Requests:
- **PR #1153** (2026-10-02): Capy: its coding agent as an agent in Spaces (@replicas-connector[bot])
- **PR #1152** (2026-10-02): harbor: profile images — member avatars and the org logo (@Gagancreates)
- **PR #1148** (2026-10-01): Agent defaults and an agent page: set an agent's options once, see its setup any time (@ramnique)
- **PR #1147** (2026-10-01): Agent approvals: a card in the thread, decided by a person (@ramnique)
- **PR #1146** (2026-10-01): Let a message name its Replicas environment, as [env:name] (@ramnique)
- **PR #1145** (2026-10-01): Agents see mention tokens, and learn Spaces from one skill (@ramnique)
- **PR #1142** (2026-09-30): Replicas on the agent contract: agent kinds, connectors Harbor runs, and the Replicas connector (@ramnique)
- **PR #1141** (2026-09-30): Require a work directory before offering the harness in chat (@arkml)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
