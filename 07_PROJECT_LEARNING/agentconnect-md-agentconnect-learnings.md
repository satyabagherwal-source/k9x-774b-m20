# Forensic Learning Record (Deep Inspection): agentconnect-md/agentconnect

> **Canonical Artifact**: `07_PROJECT_LEARNING/agentconnect-md-agentconnect-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/agentconnect-md/agentconnect](https://github.com/agentconnect-md/agentconnect))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:59:33.694Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agentconnect-md/agentconnect`
- **Description**: The open-source, multi-agent alternative to Claude Tag.  @ any agent, wherever work happens, they work alongside your team, learning as they go.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 1445 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `evals/games/engine.ts`
```
/**
 * The Collaboration Arena engine for the same-room counting milestone
 * (docs/designs/collaboration-arena.md §8/§14 step 3).
 *
 * Composes a compiled topology, an Arena world, and the counting referee into
 * one runnable game against a REAL daemon: virtual connections installed into
 * the production connection maps, real-path ingress, real routing/gating, real
 * SessionManager + serial gate, scripted ACP hosts. Deterministic mode is
 * environment-deterministic (§8.1); with scripted hosts the OUTCOME is the
 * reproducible CI gate of the engine itself. Within a wave, "first valid
 * arrival wins" still follows runtime turn scheduling — the world records
 * every admission and `sequence`-stamped effect so any run is explainable.
 */
import { CollaborationGameRunner, type CollaborationGameResult } from '../../packages/daemon/src/evaluation/index.js'
import { NO_RESPONSE_SENTINEL } from '../../packages/daemon/src/session/no-response.js'
import { CountingGame, type CountingVariant } from './counting.js'
import { CrossRoomCountingGame } from './cross-room-counting.js'
import { callDaemonTool, daemonMcpBinding, type DaemonMcpBinding } from './mcp-client.js'
import { QuotaCountingGame } from './quota-counting.js'
import { assignWerewolfRoles, WerewolfGame } from './werewolf.js'
import {
  prepareGameSubject,
  prepareScriptedSubject,
  preflightRealSubject,
  type GameSubjectSpec,
  type PreparedGameSubject
} from './subject.js'
import { compileTopology } from './topology.js'
import type { CompiledTopology, GameTopologyManifest } from './types.js'
import { ArenaWorld } from './world.js'

export { prepareScriptedSubject as scaffoldSubject }

/**
 * Materialize the subject and — for a REAL one — prove its runtimes can start
 * before a single wave is injected.
 *
 * A runtime that cannot launch does not fail the game; it makes the game
 * silent. Every wave is admitted, no agent ever produces an effect, and the run
 * burns its whole deadline before writing an empty world. That failure mode has
 * happened for something as mundane as a corrupted npx cache, so the real-subject
 * path pays a few seconds to turn it into one actionable error.
 */
async function prepareSubjectForRun(topology: CompiledTopology, spec: GameSubjectSpec): Promise<PreparedGameSubject> {
  const subject = prepareGameSubject(topology, spec)
  if (spec.kind !== 'real') return subject
  try {
    await preflightRealSubject(subject.root)
  } catch (error) {
    subject.cleanup()
    throw error
  }
  return subject
}

export interface CountingGameRunOptions {
  seed?: number
  target?: number
  /** Agent aliases in the counting room (default four). */
  agents?: string[]
  artifactDir: string
  maxSteps?: number
  timeoutMs?: number
  /** What drives the waves: §10.1 referee announcements (default) or §3.3
   *  peer-message relays with a silent referee. */
  variant?: CountingVariant
  /** Who plays (§8.1): scripted hosts (default; the reproducible engine gate)
   *  or a real-runtime subject template — the identical game either way. */
  subject?: GameSubjectSpec
  /** Preserve the disposable subject root for debugging. */
  keepSubject?: boolean
}

export function countingManifest(options: { seed: number; agents: string[] }): GameTopologyManifest {
  return {
    game: 'same-room-counting',
    seed: options.seed,
    agents: options.agents.map((alias) => ({ id: alias })),
    rooms: [{ id: 'counting-room', platform: 'slack', members: options.agents }]
  }
}

/**
 * Scripted PEER-DRIVEN counting policy (§3.3): there is no referee announcer,
 * so each host learns the count purely from PEER messages in its prompt
 * (`[<bot sender>] 7` provider-snapshot rows), replies with the next number, prefers not to post twice in
 * a row, and goes quiet once the target has been posted. Because peer relays
 * arrive DURING other turns, a host that already decided on a number can be
 * regenerated by the daemon's turn-final fence with the peer message included
 * — this policy then recomputes from the fresher prompt and posts the next
 * number instead of the stale one.
 */
export function scriptedPeerCountingHostFactory(): (
  agent: { id: string },
  onUpdate: (sessionId: string, update: unknown) => void
) => unknown {
  return (agent, onUpdate) => {
    let sessions = 0
    const lastMineBySession = new Map<string, number>()
    return {
      start: async () => {},
      newSession: async () => `scripted-${agent.id.slice(0, 8)}-${(sessions += 1)}`,
      hasSession: () => true,
      modelOptions: () => ({ current: 'scripted-peer-counting', models: ['scripted-peer-counting'] }),
      prompt: async (sessionId: string, blocks: { text?: string }[]) => {
        const text = blocks.map((block) => block.text ?? '').join('\n')
        const target = Number(/count from 1 to (\d+)/i.exec(text)?.[1] ?? 0)
        // Numbers posted by PEERS: bracketed-sender lines carrying only digits.
        const posted: number[] = []
        for (const line of text.matchAll(/\[[^\]\n]+\]\s*(-?\d+)\s*$/gm)) posted.push(Number(line[1]))
        const lastMine = lastMineBySession.get(sessionId)
        const maxSeen = Math.max(0, ...posted, lastMine ?? 0)
        const reply = (value: string) =>
          onUpdate(sessionId, { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: value } })
        if (target > 0 && maxSeen >= target) {
          reply('the count is complete.')
          return { stopReason: 'end_turn' }
        }
        // Never two in a row myself — unless a peer already matched that number
        // (a race), in which case the earlier post scored and I may continue.
        if (lastMine !== undefined && lastMine === maxSeen && !posted.includes(maxSeen)) {
          reply('waiting.')
          return { stopReason: 'end_turn' }
        }
        const next = maxSeen + 1
        lastMineBySession.set(sessionId, next)
        reply(String(next))
        return { stopReason: 'end_turn' }
      },
      cancel: async () => {},
      stop: async () => {}
    }
  }
}

/**
 * Scripted counting policy: parse the referee's latest "Next expected number"
 * from the prompt and reply with exactly that number — every member proposes
 * every round, exercising collisions, atomic acceptance, and the
 * no-consecutive-scorer rule deterministically.
 *
 * The announcement is remembered per session because peer numbers arrive DURING
 * other turns: the daemon's turn-final fence then replaces the prompt with just
 * that delta and discards the draft, and a real runtime would still have the
 * referee's call in its own session history. Without the memory a regenerated
 * invocation answers "waiting" and the round stalls with nobody proposing.
 */
export function scriptedCountingHostFactory(): (
  agent: { id: string },
  onUpdate: (sessionId: string, update: unknown) => void
) => unknown {
  return (agent, onUpdate) => {
    let sessions = 0
    const expectedBySession = new Map<string, string>()
    return {
      start: async () => {},
      newSession: async () => `scripted-${agent.id.slice(0, 8)}-${(sessions += 1)}`,
      hasSession: () => true,
      modelOptions: () => ({ current: 'scripted-counting', models: ['scripted-counting'] }),
      prompt: async (sessionId: string, blocks: { text?: string }[]) => {
        const text = blocks.map((block) => block.text ?? '').join('\n')
        const matches = [...text.matchAll(/Next expected number:\s*(\d+)/g)]
        const announced = matches.at(-1)?.[1]
        if (announced) expectedBySession.set(sessionId, announced)
        const candidate = announced ?? expectedBySession.get(sessionId)
        onUpdate(sessionId, {
          sessionUpdate: 'agent_message_chunk',
          content: { type: 'text', text: candidate ?? 'waiting' }
        })
        return { stopReason: 'end_turn' }
      },
      cancel: async () => {},
      stop: async () => {}
    }
  }
}

/**
 * Scripted QUOTA policy — deterministic round-robin: participants come from the
 * start message; agent k posts number n iff (n-1) mod N == k and it still has
 * quota. Rules and observed numbers PERSIST per session (later prompts carry
 * only the new peer messages). Completes with exact quotas, perfect
 * alternation, and a termination acknowledgment from every non-final agent.
 */
export function scriptedQuotaHostFactory(): (
  agent: { id: string; name?: string },
  onUpdate: (sessionId: string, update: unknown) => void
) => unknown {
  return (agent, onUpdate) => {
    let sessions = 0
    interface QuotaSession {
      participants: string[]
      quota: number
      target: number
      seen: Set<number>
      mine: number
    }
    const state = new Map<string, QuotaSession>()
    return {
      start: async () => {},
      newSession: async () => {
        const sessionId = `scripted-${agent.id.slice(0, 8)}-${(sessions += 1)}`
        state.set(sessionId, { participants: [], quota: 0, target: 0, seen: new Set(), mine: 0 })
        return sessionId
      },
      hasSession: () => true,
      modelOptions: () => ({ current: 'scripted-quota', models: ['scripted-quota'] }),
      prompt: async (sessionId: string, blocks: { text?: string }[]) => {
        const session = state.get(sessionId) ?? {
          participants: [],
          quota: 0,
          target: 0,
          seen: new Set<number>(),
          mine: 0
        }
        state.set(sessionId, session)
        const text = blocks.map((block) => block.text ?? '').join('\n')
        const participants = /Participants: ([^.]+)\./.exec(text)?.[1]
        if (participants) session.participants = participants.split(',').map((alias) => alias.trim())
        const quota = /exactly (\d+) numbers/.exec(text)
        if (quota) session.quota = Number(quota[1])
        const target = /ends at (\d+)/.exec(text)
        if (target) session.target = Number(target[1])
        for (const line of text.matchAll(/\[[^\]\n]+\]\s*(-?\d+)\s*$/gm)) session.seen.add(Number(line[1]))
        const myInd
```

### Core Architecture Module: `packages/cli/src/node-engines.ts`
```
/**
 * Minimal `engines.node` range check (cli-daemon-split.md §5.1 step 3) — enough
 * for the simple ranges npm packages actually use (`>=24.12.0`, `24 || 25`)
 * without pulling in a full semver dependency. Comparators within a group are
 * ANDed; `||` separates OR groups. Pre-release tags on the Node version are
 * ignored. An unparseable range returns `true` (accept) rather than blocking on
 * an exotic spec the caller never emits.
 */
function parseVersion(v: string): [number, number, number] | null {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(v.trim())
  if (!m) return null
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)]
}

function cmp(a: [number, number, number], b: [number, number, number]): number {
  for (let i = 0; i < 3; i++) {
    if (a[i]! !== b[i]!) return a[i]! < b[i]! ? -1 : 1
  }
  return 0
}

function satisfiesComparator(comparator: string, version: [number, number, number]): boolean {
  const m = /^(>=|<=|>|<|=|\^|~)?\s*(.+)$/.exec(comparator.trim())
  if (!m) return true
  const op = m[1] ?? '='
  const target = parseVersion(m[2]!)
  if (!target) return true
  const c = cmp(version, target)
  switch (op) {
    case '>=':
      return c >= 0
    case '>':
      return c > 0
    case '<=':
      return c <= 0
    case '<':
      return c < 0
    case '^': // caret: same major, >= target
      return version[0] === target[0] && c >= 0
    case '~': // tilde: same major.minor, >= target
      return version[0] === target[0] && version[1] === target[1] && c >= 0
    default:
      return c === 0
  }
}

/** Whether `nodeVersion` satisfies the `engines.node` `range`. */
export function nodeSatisfies(range: string | undefined, nodeVersion: string): boolean {
  if (!range || range.trim() === '' || range.trim() === '*') return true
  const version = parseVersion(nodeVersion)
  if (!version) return true
  return range.split('||').some((group) => {
    const comparators = group.trim().split(/\s+/).filter(Boolean)
    if (comparators.length === 0) return true
    return comparators.every((c) => satisfiesComparator(c, version))
  })
}

```

### Core Architecture Module: `packages/control-plane/src/agents/agent-icon-render.ts`
```
/**
 * Server-side SVG composition for the public agent-icon endpoint
 * (`GET /v1/agents/:id/icon`). The composed square SVG is rasterized to PNG by
 * the route so Slack can use it as a per-message `icon_url` (Slack does not render
 * SVG avatars), and reused when platform profile APIs require raster bytes. The
 * console renders the same descriptor client-side.
 *
 * Glyph inner-SVGs are derived at load from the framework-agnostic `lucide` core
 * package — the same icon data (and version) the web console renders via
 * `lucide-react`, so the PNG and the console match without any hand-copied paths.
 * Keep the `lucide` dependency pinned to the same version as web's `lucide-react`.
 * The 3 runtime marks mirror `packages/web/src/components/marks.tsx` (`AgentMark`).
 */
import type { AgentIcon } from '@agentconnect.md/protocol'
import { AGENT_ICON_GLYPHS } from '@agentconnect.md/protocol'
import { icons, type IconNode } from 'lucide'
import { HEX_COLOR_RE, AGENT_ICON_DARK_PLATE as DARK_PLATE } from './agent-icon.js'

/** lucide's `icons` is typed with literal PascalCase keys; view it as a plain lookup
 *  so a computed glyph name resolves to its node data (or `undefined` if absent). */
const LUCIDE_ICONS = icons as unknown as Record<string, IconNode | undefined>

/** kebab-case glyph name (the enum/wire form) → PascalCase key in lucide's `icons` map. */
function toPascalCase(name: string): string {
  return name
    .split('-')
    .map((s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s))
    .join('')
}

/** Serialize a lucide `IconNode` ([tag, attrs][]) to inner SVG markup — the 24×24,
 *  stroke-based children our composed `<svg>` wraps. Drops lucide's `key` attr. */
function serializeIconNode(node: IconNode): string {
  return node
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .filter(([k, v]) => k !== 'key' && v !== undefined)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ')
      return `<${tag} ${a}/>`
    })
    .join('')
}

/** The AgentConnect brand diamond (24×24 fills) — the built-in preset agents'
 *  fixed identity. NOT a Lucide stroke glyph: it carries its own facet fills, so
 *  the composer renders it without the white-stroke group treatment. Mirrors web
 *  `LogoMark` (marks.tsx) at half scale (48-box → 24-box). */
export const BRAND_GLYPH_INNER =
  '<polygon points="12,2.5 21.5,12 12,12" fill="#f2c64a"/>' +
  '<polygon points="21.5,12 12,21.5 12,12" fill="#f4793a"/>' +
  '<polygon points="12,21.5 2.5,12 12,12" fill="#7c3ca2"/>' +
  '<polygon points="2.5,12 12,2.5 12,12" fill="#d83f96"/>'

/** Inner Lucide markup for each curated glyph, derived from `lucide` core keyed by
 *  {@link AGENT_ICON_GLYPHS}. The brand diamond is hand-carried (lucide has no such
 *  icon). Any other name lucide doesn't ship is skipped here and degrades to the
 *  `bot` fallback at render (a test asserts every enum glyph is present). */
export const GLYPH_SVG_INNER: Record<string, string> = Object.fromEntries(
  AGENT_ICON_GLYPHS.flatMap((g): [string, string][] => {
    if (g === 'agentconnect') return [[g, BRAND_GLYPH_INNER]]
    const node = LUCIDE_ICONS[toPascalCase(g)]
    return node ? [[g, serializeIconNode(node)]] : []
  })
)

/** Runtime brand marks (24×24), mirroring web `AgentMark`. Each fills its box. */
function runtimeMarkInner(runtime: string): string {
  const m = (runtime || '').toLowerCase()
  if (m.includes('codex') || m.includes('gpt') || m.includes('openai'))
    return '<circle cx="12" cy="12" r="11" fill="#10A37F"/><path d="M12 6.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zm0 2a3.5 3.5 0 110 7 3.5 3.5 0 010-7z" fill="#fff"/>'
  if (m.includes('opencode'))
    return '<rect x="1" y="1" width="22" height="22" rx="6" fill="#c62a78"/><path d="M7 9l3.2 3-3.2 3M12.5 15.4H17" stroke="#fff" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
  // Claude (default / fallback runtime): the starburst.
  return '<path d="M12 2C12.8 8 16 11.2 22 12 16 12.8 12.8 16 12 22 11.2 16 8 12.8 2 12 8 11.2 11.2 8 12 2Z" fill="#D97757"/>'
}

/** A full-bleed 64×64 group placing a 24×24 mark centered at ~`fraction` of the box. */
function centered(inner24: string, fraction: number, extraGroupAttrs = ''): string {
  const target = 64 * fraction
  const scale = target / 24
  const offset = (64 - target) / 2
  return `<g transform="translate(${offset.toFixed(2)} ${offset.toFixed(2)}) scale(${scale.toFixed(3)})"${extraGroupAttrs}>${inner24}</g>`
}

/**
 * Compose the square SVG for an agent icon. `runtime`/`glyph` render to a plate;
 * `image`/null map elsewhere (image → redirect at the route; null → runtime mark).
 * `runtime` may be null (an unplaced deferred-config agent): the mark falls back
 * to the default starburst — presets carry a glyph icon and never reach it.
 */
export function buildAgentIconSvg(icon: AgentIcon | null, runtime: string | null): string {
  const open = '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">'
  if (icon?.kind === 'glyph') {
    if (icon.glyph === 'agentconnect') {
      // Brand diamond: the native logo, plateless — transparent background,
      // `color` inert, no white-stroke treatment (it carries its own facet fills).
      return `${open}${centered(BRAND_GLYPH_INNER, 1)}</svg>`
    }
    const color = HEX_COLOR_RE.test(icon.color) ? icon.color : DARK_PLATE
    const glyph = GLYPH_SVG_INNER[icon.glyph] ?? GLYPH_SVG_INNER.bot ?? ''
    const stroke = ' fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
    return `${open}<rect width="64" height="64" fill="${color}"/>${centered(glyph, 0.56, stroke)}</svg>`
  }
  // runtime kind (and null/legacy default): the brand mark on a dark plate.
  return `${open}<rect width="64" height="64" fill="${DARK_PLATE}"/>${centered(runtimeMarkInner(runtime ?? ''), 0.62)}</svg>`
}

/** Composed icon SVGs are shapes only, never `<text>`, so skip resvg's system-font scan — it costs ~180ms of every render. */
export const ICON_RENDER_FONT = { loadSystemFonts: false }

/** Rasterize the console descriptor for consumers that require uploaded image
 * bytes rather than an SVG or public URL (the icon endpoint and bot profile setup).
 * Keep the native module lazy so a load failure degrades only the calling feature,
 * never Control Plane boot. */
export async function renderAgentIconPng(icon: AgentIcon | null, runtime: string | null, width = 128): Promise<Buffer> {
  const { Resvg } = await import('@resvg/resvg-js')
  const svg = buildAgentIconSvg(icon, runtime)
  return Buffer.from(
    new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: ICON_RENDER_FONT }).render().asPng()
  )
}

```

### Core Architecture Module: `packages/control-plane/src/gitea/binding-state.ts`
```
/**
 * The pure lifecycle rules of a Gitea repository binding (gitea-integration.md §4.3, §4.4, §5, §6):
 * which states serve runtime credentials, which one authorizes a collaborator lookup, and how a
 * rejected token or an unverified test delivery moves a binding. Kept free of I/O so the saga, the
 * grant path and the authorization arm read one answer.
 */
import type { GiteaBindingState } from '../persistence/ports.js'

/** The reason a rejected token leaves on every binding of its connection (§4.3). */
export const TOKEN_REJECTED_REASON = 'token_rejected' as const
/** The reason a bot demoted below `admin` leaves on its binding (§4.4). */
export const ADMIN_LOST_REASON = 'admin_lost' as const
/** The warning a binding whose test delivery never reached the relay carries (§6 step 4). */
export const WEBHOOK_UNVERIFIED_REASON = 'webhook_unverified' as const
/** The subscription Gitea stored is missing names the union asked for (§7 read-back). */
export const WEBHOOK_EVENTS_UNSUPPORTED_REASON = 'webhook_events_unsupported' as const
/** A removal refused because a trigger, workspace or grant still names the repository (§6). */
export const REPOSITORY_IN_USE_REASON = 'repository_in_use' as const

/** Runtime keeps serving through an admin-plane fault; a rejected token or cleanup stops it (§4.4, §6). */
export function servesRuntime(state: GiteaBindingState): boolean {
  return state === 'provisioning' || state === 'ready' || state === 'admin_degraded'
}

/** The collaborator gate needs repository `admin`, so only a fully converged binding answers it (§4.4, §8). */
export function authorizesMembership(state: GiteaBindingState): boolean {
  return state === 'ready'
}

/** A binding entering cleanup leaves the relay pool; every other state's rule stays verifiable. */
export function compilesHookRule(state: GiteaBindingState): boolean {
  return state !== 'cleanup_pending'
}

/** A rejected token degrades every binding still owed convergence; cleanup keeps its own obligation (§4.3). */
export function afterTokenRejection(state: GiteaBindingState): GiteaBindingState {
  return state === 'cleanup_pending' ? state : 'runtime_degraded'
}

/** The outcome a converged webhook earns: `ready`, with the unverified warning when the relay never saw the test (§6). */
export function readyOutcome(deliveryVerified: boolean): { state: 'ready'; stateReason: string | null } {
  return { state: 'ready', stateReason: deliveryVerified ? null : WEBHOOK_UNVERIFIED_REASON }
}

/** A verified delivery clears exactly the unverified warning; every other reason is a fact it does not change. */
export function afterDeliveryVerified(
  state: GiteaBindingState,
  stateReason: string | null
): { state: GiteaBindingState; stateReason: string | null } {
  if (state === 'ready' && stateReason === WEBHOOK_UNVERIFIED_REASON) return { state, stateReason: null }
  return { state, stateReason }
}

```

### Core Architecture Module: `packages/control-plane/src/gitea/webhook-events.ts`
```
// Union trigger and author-feedback subscriptions; the relay filters each consumer's events.
import type { HookRecord } from '../persistence/ports.js'
import type { GiteaInstanceVersion } from './version.js'

/** Every subscription name the product ever asks for; anything else Gitea silently drops (§16). */
export const GITEA_WEBHOOK_EVENTS = [
  'issues',
  'issue_comment',
  'pull_request',
  'pull_request_sync',
  'pull_request_label',
  'pull_request_review_request',
  'pull_request_comment',
  'pull_request_review',
  'push',
  'release',
  'status',
  'workflow_run'
] as const
export type GiteaWebhookEvent = (typeof GITEA_WEBHOOK_EVENTS)[number]

// `issues` expands to its label variant on Gitea's side; `pull_request` does not, so the label filter's entry event is asked for by name.
const ISSUE_EVENTS: readonly GiteaWebhookEvent[] = ['issues', 'issue_comment']
const MERGE_REQUEST_EVENTS: readonly GiteaWebhookEvent[] = [
  'pull_request',
  'pull_request_sync',
  'pull_request_label',
  'pull_request_review_request',
  'pull_request_review',
  'issue_comment',
  'pull_request_comment'
]
const PULL_REQUEST_COMMENT_EVENTS: readonly GiteaWebhookEvent[] = [
  'issue_comment',
  'pull_request_comment',
  'pull_request_review'
]

/** Null means neither triggers nor writable workspaces need ingress. */
export function unionGiteaWebhookEvents(
  hooks: Pick<HookRecord, 'enabled' | 'kind' | 'repoId' | 'events' | 'commentFamilies'>[],
  repoId: bigint,
  feedback = false,
  version?: GiteaInstanceVersion
): GiteaWebhookEvent[] | null {
  const relevant = hooks.filter((hook) => hook.enabled && hook.kind === 'gitea' && hook.repoId === repoId)
  if (relevant.length === 0 && !feedback) return null
  const events = new Set<GiteaWebhookEvent>()
  if (feedback) {
    for (const event of PULL_REQUEST_COMMENT_EVENTS) events.add(event)
    if (
      version?.product === 'gitea' &&
      version.major !== null &&
      version.minor !== null &&
      (version.major > 1 || (version.major === 1 && version.minor >= 25))
    ) {
      events.add('status')
      events.add('workflow_run')
    }
  }
  for (const hook of relevant) {
    for (const pattern of hook.events) {
      if (pattern.startsWith('issues:')) for (const event of ISSUE_EVENTS) events.add(event)
      else if (pattern.startsWith('merge_request:')) for (const event of MERGE_REQUEST_EVENTS) events.add(event)
      else if (pattern.startsWith('push:')) events.add('push')
      else if (pattern.startsWith('release:')) events.add('release')
    }
    for (const family of hook.commentFamilies) {
      if (family === 'issues') events.add('issue_comment')
      if (family === 'merge_request') for (const event of PULL_REQUEST_COMMENT_EVENTS) events.add(event)
    }
  }
  // Stable order, so the desired-events hash compares by content and not by insertion.
  return GITEA_WEBHOOK_EVENTS.filter((event) => events.has(event))
}

/** The desired names the stored webhook does NOT carry — compared by subset, because Gitea expands umbrella names (§7). */
export function giteaWebhookEventsMissing(desired: readonly string[], stored: readonly string[]): string[] {
  const present = new Set(stored)
  return desired.filter((event) => !present.has(event))
}

/** The hash the binding records the converged subscription under. */
export function giteaWebhookEventsHash(events: readonly string[]): string {
  return JSON.stringify([...events].sort())
}

```

### Core Architecture Module: `packages/control-plane/src/github/hook-run-subject.ts`
```
import type { CodeHostHookMetadata } from '@agentconnect.md/protocol'
import type { HookDeliveryInput } from '../persistence/ports.js'

/** The GitHub subject columns a HookRun row records off a delivery's trusted member. */
export type GithubHookRunSubject = Pick<
  HookDeliveryInput,
  | 'repoId'
  | 'repoFullName'
  | 'sourceInstallationId'
  | 'subjectKind'
  | 'pullNumber'
  | 'headSha'
  | 'baseSha'
  | 'reportSha'
  | 'isDraft'
  | 'baseChanged'
>

/** The row's subject columns for this delivery; the columns are GitHub-shaped, so another host's member records none. */
export function githubHookRunSubject(host: CodeHostHookMetadata | undefined): GithubHookRunSubject {
  if (host?.provider !== 'github') return {}
  const github = host.metadata
  return {
    repoId: BigInt(github.repoId),
    repoFullName: github.repoFullName,
    sourceInstallationId: BigInt(github.sourceInstallationId),
    subjectKind: github.subjectKind,
    ...(github.pullNumber !== undefined ? { pullNumber: github.pullNumber } : {}),
    ...(github.headSha ? { headSha: github.headSha } : {}),
    ...(github.baseSha ? { baseSha: github.baseSha } : {}),
    ...(github.reportSha ? { reportSha: github.reportSha } : {}),
    ...(github.isDraft !== undefined ? { isDraft: github.isDraft } : {}),
    ...(github.baseChanged !== undefined ? { baseChanged: github.baseChanged } : {})
  }
}

```

### Core Architecture Module: `packages/control-plane/src/github/install-state.ts`
```
/**
 * One-shot signed `state` for the GitHub install deep link / setup callback.
 *
 * The setup callback is unauthenticated (GitHub redirects a browser), so the
 * org being claimed rides inside a signed state: HMAC-SHA256 under a subkey
 * DOMAIN-SEPARATED from API_KEY_PEPPER (never the pepper itself — the pepper
 * already keys api_key hashing, and cross-purpose key reuse entangles two
 * rotation lifecycles). Payload = orgId + expiry + a random nonce; the nonce is
 * persisted and consumed exactly once (replay ⇒ reject), and expiry is inside
 * the signature so a stale row can never be resurrected.
 *
 * GitHub's state passthrough to the Setup URL is undocumented behavior that has
 * regressed before (community #61291). A missing state cannot safely bind an
 * App-wide installation to a tenant; callers redirect to the console and ask
 * the user to restart the signed install flow.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Clock } from '../domain/clock.js'

export const INSTALL_STATE_TTL_MS = 15 * 60 * 1000

/** Domain-separated signing subkey; the pepper itself never signs states. */
export function deriveInstallStateKey(pepper: string): Buffer {
  return createHmac('sha256', pepper).update('github-install-state-v1').digest()
}

export interface InstallState {
  orgId: string
  nonce: string
  expiresAt: Date
}

interface StatePayload {
  o: string // orgId
  e: number // expiry, epoch seconds
  n: string // nonce (persisted, one-shot)
}

function mac(key: Buffer, payload: string): Buffer {
  return createHmac('sha256', key).update(payload).digest()
}

/** `<base64url payload>.<base64url mac>` + the nonce/expiry to persist. */
export function mintInstallState(key: Buffer, orgId: string, clock: Clock): { state: string } & InstallState {
  const nonce = randomBytes(16).toString('base64url')
  const expiresAt = new Date(clock.now() + INSTALL_STATE_TTL_MS)
  const payload: StatePayload = { o: orgId, e: Math.floor(expiresAt.getTime() / 1000), n: nonce }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = mac(key, encoded).toString('base64url')
  return { state: `${encoded}.${sig}`, orgId, nonce, expiresAt }
}

/** Null on ANY defect: malformed, bad signature, expired. Constant-time compare. */
export function verifyInstallState(key: Buffer, state: string, clock: Clock): InstallState | null {
  const dot = state.indexOf('.')
  if (dot <= 0 || dot === state.length - 1) return null
  const encoded = state.slice(0, dot)
  const sig = Buffer.from(state.slice(dot + 1), 'base64url')
  const expected = mac(key, encoded)
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null
  let payload: StatePayload
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as StatePayload
  } catch {
    return null
  }
  if (typeof payload.o !== 'string' || typeof payload.e !== 'number' || typeof payload.n !== 'string') return null
  if (payload.e * 1000 <= clock.now()) return null
  return { orgId: payload.o, nonce: payload.n, expiresAt: new Date(payload.e * 1000) }
}

```

### Core Architecture Module: `packages/control-plane/src/github/projection-state.ts`
```
import {
  HOOK_DELIVERY_REASON_REVIEW_REQUEST_REQUIRED,
  HOOK_REPORT_REASON_AGENT_HANDOVER,
  HOOK_REPORT_REASON_PROVIDER_AUTH_REQUIRED,
  HOOK_REPORT_REASON_PROVIDER_QUOTA_EXHAUSTED,
  isRetryableHookDeliveryReason
} from '@agentconnect.md/protocol'
import type { HookRunRecord } from '../persistence/ports.js'

export type ProjectionDesiredState =
  | 'queued'
  | 'preparing'
  | 'in_progress'
  | 'success'
  | 'action_required'
  | 'neutral'
  | 'skipped'
  | 'failure'
  | 'timed_out'

/** A completed review turn without a formal verdict cannot pass a required Check. */
export function hookRuntimeProjectionState(outcome: {
  status: 'running' | 'success' | 'failed'
  reason?: string | null
}): 'failure' | null {
  return outcome.status === 'running' ? null : 'failure'
}

function reviewDesiredState(run: HookRunRecord): ProjectionDesiredState | null {
  if (run.reviewEvent === 'REQUEST_CHANGES') return 'action_required'
  if (run.verdict === 'pass') return 'success'
  if (run.verdict === 'fail') return 'action_required'
  if (run.projectionIntent === 'review_action_only') return null
  if (run.verdict === 'neutral') return 'neutral'
  return null
}

/** Recompute projection authority from the locked current HookRun. Callers use
 * this to reject lifecycle edges captured before a concurrent recovery/result. */
export function authoritativeHookProjectionState(run: HookRunRecord): ProjectionDesiredState | null {
  const reviewState = run.reviewAttemptState === 'submitted' ? reviewDesiredState(run) : null
  if (reviewState) return reviewState
  if (run.projectionIntent === 'review_action_only') return null
  if (run.projectionIntent !== 'revision_event') return null
  if (run.reviewErrorCode) return 'failure'
  if (run.orphanedAt) return 'timed_out'
  const runtimeState = hookRuntimeProjectionState(run)
  if (runtimeState) return runtimeState
  return run.turnStartedAt ? 'in_progress' : run.preparingAt ? 'preparing' : 'queued'
}

/** Give an incomplete review a useful title without exposing internal topology. */
export function hookIncompleteCheckLabel(reason?: string | null, appSlug?: string): string | null {
  if (isRetryableHookDeliveryReason(reason)) return 'Agent unavailable'
  if (reason === HOOK_DELIVERY_REASON_REVIEW_REQUEST_REQUIRED)
    return appSlug ? `Comment @${appSlug} to start the review` : 'Review requires a maintainer request'
  if (reason === HOOK_REPORT_REASON_AGENT_HANDOVER)
    return appSlug ? `Comment @${appSlug} to retry the interrupted review` : 'Review was interrupted before it finished'
  if (reason === HOOK_REPORT_REASON_PROVIDER_QUOTA_EXHAUSTED)
    return 'Review could not be completed: provider usage limit reached'
  if (!reason || reason === HOOK_REPORT_REASON_PROVIDER_AUTH_REQUIRED) return null
  return 'Review could not be completed'
}

/** Tell maintainers how to retry an incomplete review on the Check details page. */
export function hookIncompleteCheckGuidance(reason?: string | null, appSlug?: string): string | null {
  const mention = appSlug ? `comment \`@${appSlug}\` on this pull request, or ` : ''
  if (reason === HOOK_REPORT_REASON_AGENT_HANDOVER) {
    return [
      '### How to run this review again',
      'The agent stopped serving this repository before it finished — a restart, an upgrade, or a handover — ' +
        'so no review was produced and nothing in this pull request has been judged. ' +
        `To run it again, ${mention}use the **Request review** button above. ` +
        'Starting a review needs triage, write, or admin access to this repository.'
    ].join('\n\n')
  }
  if (reason !== HOOK_DELIVERY_REASON_REVIEW_REQUEST_REQUIRED) return null
  return [
    '### How to start this review',
    'This pull request was opened by someone who cannot start a review here, so no agent ran. ' +
      `To review it, ${mention}use the **Request review** button above. ` +
      'Either path needs triage, write, or admin access to this repository. GitHub Actions ' +
      '**Approve and run workflows** also starts the waiting review when the pull-request workflow begins.'
  ].join('\n\n')
}

```

### Core Architecture Module: `packages/control-plane/src/gitlab/webhook-events.ts`
```
import type { HookRecord } from '../persistence/ports.js'
import type { GitlabWebhookEvents } from './api.js'

// Union trigger and author-feedback subscriptions; null means no consumer needs ingress.
export function unionGitlabWebhookEvents(
  hooks: Pick<HookRecord, 'enabled' | 'kind' | 'repoId' | 'events' | 'commentFamilies'>[],
  projectId: bigint,
  feedback = false
): GitlabWebhookEvents | null {
  const relevant = hooks.filter((hook) => hook.enabled && hook.kind === 'gitlab' && hook.repoId === projectId)
  if (relevant.length === 0 && !feedback) return null
  const events: GitlabWebhookEvents = {
    push_events: false,
    issues_events: false,
    merge_requests_events: feedback,
    note_events: feedback,
    pipeline_events: feedback,
    releases_events: false
  }
  for (const hook of relevant) {
    for (const pattern of hook.events) {
      if (pattern.startsWith('issues:')) events.issues_events = true
      else if (pattern.startsWith('merge_request:')) events.merge_requests_events = true
      else if (pattern.startsWith('push:')) events.push_events = true
      else if (pattern.startsWith('release:')) events.releases_events = true
    }
    if (events.issues_events || events.merge_requests_events || hook.commentFamilies.length > 0) {
      events.note_events = true
    }
  }
  return events
}

```

### Core Architecture Module: `packages/control-plane/src/hooks/hook-family.ts`
```
/**
 * `hooks/hook-family.ts` — the per-family shape of a code-host hook row
 * (webhook-triggers-and-github-events.md).
 *
 * A github/gitlab HookDef row covers exactly ONE subject family, so each family
 * carries its own cadence and its own mention gate. These are pure predicates:
 * the routes call them before any I/O, and the database's
 * (agent, kind, repo, family) uniqueness owns the duplicate rule.
 */

import type { CodeHostProvider } from '@agentconnect.md/protocol'

/** Every subject family the code hosts between them subscribe to. */
export type HookFamily = 'issues' | 'pull_request' | 'merge_request' | 'push' | 'deployment' | 'release'

/** The families a row of each kind may declare. */
export const GITHUB_FAMILIES = ['pull_request', 'issues', 'push', 'deployment', 'release'] as const
export const GITLAB_FAMILIES = ['merge_request', 'issues', 'push', 'release'] as const

/** Reviews and run reporting exist only on a change-proposal subject. */
const REVIEW_FAMILIES = new Set<HookFamily>(['pull_request', 'merge_request'])

/** Whether the review/reporting axes may be non-default on this row. */
export function familyCarriesReviews(family: HookFamily): boolean {
  return REVIEW_FAMILIES.has(family)
}

/** The family a stored `family:action` pattern names, or null when it names none
 *  (GitHub's `issue_comment` covers both thread families, so alone it names no
 *  subject; the pattern's own scope comes from `commentFamilies`). */
export function familyOfEventPattern(pattern: string): HookFamily | null {
  const prefix = pattern.split(':', 1)[0]
  switch (prefix) {
    case 'issues':
    case 'pull_request':
    case 'merge_request':
    case 'push':
    case 'deployment':
    case 'release':
      return prefix
    case 'pull_request_review_comment':
      return 'pull_request'
    case 'deployment_status':
      return 'deployment'
    default:
      return null
  }
}

/** Whether one stored pattern belongs on a row of this kind and family. */
export function eventPatternFitsFamily(kind: CodeHostProvider, family: HookFamily, pattern: string): boolean {
  const prefix = pattern.split(':', 1)[0]
  if (prefix === 'issue_comment') {
    return kind === 'github' && (family === 'issues' || family === 'pull_request')
  }
  if (prefix === 'pull_request_review_comment') return kind === 'github' && family === 'pull_request'
  // A status is posted against a deployment, so it rides the deployment row (GitHub only).
  if (prefix === 'deployment_status') return kind === 'github' && family === 'deployment'
  return prefix === family
}

/** Whether any pattern rides GitHub's shared issue_comment subscription. */
export function hasSharedCommentPattern(events: readonly string[]): boolean {
  return events.some((pattern) => pattern.split(':', 1)[0] === 'issue_comment')
}

/** The per-row subscription block a write proposes. */
export interface HookFamilyShape {
  kind: CodeHostProvider
  family: HookFamily
  events: readonly string[]
  commentFamilies: readonly string[]
  reviewPolicy: string
  reportingMode: string
  gateMode: string
}

/**
 * The 400 reason this row shape is not a single-family subscription, or null.
 * Every check is a statement about ONE row: the sibling comparisons (identical
 * anchoring, one row per family) live with the route that can read siblings.
 */
export function hookFamilyShapeError(shape: HookFamilyShape): string | null {
  const offending = shape.events.find((pattern) => !eventPatternFitsFamily(shape.kind, shape.family, pattern))
  if (offending !== undefined) {
    return `event "${offending}" does not belong to the ${shape.family} family — subscribe to it on that family's own trigger`
  }
  const strayComment = shape.commentFamilies.find((candidate) => candidate !== shape.family)
  if (strayComment !== undefined) {
    return `commentFamilies may only scope this row's own ${shape.family} family, not ${strayComment}`
  }
  // GitHub narrows its shared issue_comment subscription with commentFamilies;
  // leaving it empty is the legacy repo-wide meaning, which would double-fire
  // against the sibling row that owns the other thread family.
  if (shape.kind === 'github' && hasSharedCommentPattern(shape.events) && shape.commentFamilies.length === 0) {
    return `an issue_comment subscription must set commentFamilies to ["${shape.family}"]`
  }
  if (!familyCarriesReviews(shape.family)) {
    if (shape.reviewPolicy !== 'off' || shape.reportingMode !== 'off' || shape.gateMode !== 'informational') {
      return 'reviews and run reporting apply to pull-request/merge-request rows'
    }
  }
  return null
}

/** The anchoring/session block sibling rows of one (agent, repo) must agree on:
 *  they answer the same thread, so a divergent anchor would split its replies. */
export interface HookSiblingShape {
  targetPlatform: string
  targetChannel: string | null
  targetIntegrationId: string | null
  sessionMode: string
}

/** The 409 reason this row disagrees with its siblings on that block, or null. */
export function hookSiblingShapeError(
  siblings: readonly HookSiblingShape[],
  proposed: HookSiblingShape,
  repoLabel: string
): string | null {
  const differs = siblings.find(
    (sibling) =>
      sibling.targetPlatform !== proposed.targetPlatform ||
      sibling.targetChannel !== proposed.targetChannel ||
      sibling.targetIntegrationId !== proposed.targetIntegrationId ||
      sibling.sessionMode !== proposed.sessionMode
  )
  if (!differs) return null
  return `this agent's other ${repoLabel} triggers post somewhere else — change them together, or they would answer one thread in two places`
}

```

### Core Architecture Module: `packages/control-plane/src/hooks/hook-routing.service.ts`
```
import { DECISION_CHAIN_V1_FEATURE } from '@agentconnect.md/protocol'
import type { AgentId, DaemonId, OrgId } from '../domain/ids.js'
import type {
  AgentRecord,
  CodeHostDecisionRoutingRepo,
  CodeHostRoutingScope,
  DaemonRecord,
  HookRecord,
  HookRepo
} from '../persistence/ports.js'
import type { PlacementResolver } from '../orchestrator/placementResolver.js'
import { codeHostProviders } from '../codehost/registry.js'
import { chooseEvaluationAgent, routingMembers, routingScopeOf, type HostCandidate } from './hook-routing.js'
import type { HookRoutingReconciler, HookService } from './hook.service.js'

export interface HookRoutingServiceDeps {
  routings: CodeHostDecisionRoutingRepo
  hooks: Pick<HookRepo, 'listForOrgKind' | 'listForAgent'>
  agents: { getUnscoped(agentId: AgentId): Promise<AgentRecord | null> }
  daemons: { getUnscoped(daemonId: DaemonId): Promise<DaemonRecord | null> }
  placement: Pick<PlacementResolver, 'routableDaemon'>
  /** A connected daemon's advertised features; undefined while it is not connected. */
  daemonFeatures(daemonId: string): readonly string[] | undefined
  hookService: Pick<HookService, 'broadcast'>
  /** Push one agent's re-assembled spec (its hookRoutings changed). */
  projectAgentSpec(orgId: OrgId, agentId: AgentId): Promise<void>
  log?: { warn(obj: unknown, msg?: string): void }
}

const scopeKey = (s: CodeHostRoutingScope) => `${s.orgId}\u0000${s.provider}\u0000${s.repoId}\u0000${s.family}`

/** Keeps each code-host routing scope converged (code-host-decisions.md §3.2): its host, its rules, its hosts' specs. */
export class HookRoutingService implements HookRoutingReconciler {
  constructor(private readonly deps: HookRoutingServiceDeps) {}

  /** Re-choose the scope's host, push the affected hosts' specs, then rebroadcast every rule in the scope. */
  async reconcile(
    scope: CodeHostRoutingScope,
    opts: { formerHost?: AgentId | null; membersChanged?: boolean; onlyIfHostMoves?: boolean } = {}
  ): Promise<void> {
    const record = await this.deps.routings.get(scope)
    const scopeHooks = (await this.deps.hooks.listForOrgKind(scope.orgId, scope.provider)).filter(
      (h) => h.repoId === scope.repoId && h.family === scope.family
    )
    const hosts = new Set<AgentId>()
    if (opts.formerHost) hosts.add(opts.formerHost)
    if (record) {
      const current = record.evaluationAgentId
      const next = chooseEvaluationAgent(current, await this.candidates(routingMembers(scopeHooks, scope)), [
        ...codeHostProviders[scope.provider].routing.requiredFeatures,
        ...(record.config?.steps?.length ? [DECISION_CHAIN_V1_FEATURE] : [])
      ])
      if (next !== current) {
        if (!(await this.deps.routings.setEvaluationAgent(record.id, current, next as AgentId | null))) {
          // A concurrent reconcile moved it first; its own pass converges the scope.
          return
        }
        if (current) hosts.add(current)
        if (next) hosts.add(next as AgentId)
      } else {
        if (opts.onlyIfHostMoves) return
        if (opts.membersChanged) await this.deps.routings.touchHost(record.id)
        if (current) hosts.add(current)
      }
    } else if (opts.onlyIfHostMoves) return
    // The host learns the scope before any relay names it.
    for (const agentId of hosts) await this.deps.projectAgentSpec(scope.orgId, agentId)
    for (const hook of scopeHooks) await this.deps.hookService.broadcast(hook)
  }

  async reconcileHooks(
    hooks: ReadonlyArray<Pick<HookRecord, 'orgId' | 'kind' | 'repoId' | 'family'> | null | undefined>,
    opts: { membersChanged?: boolean } = {}
  ): Promise<void> {
    for (const scope of this.scopesOf(hooks)) {
      // An unrouted scope has nothing beyond the hook's own broadcast.
      if (!(await this.deps.routings.get(scope))) continue
      await this.guard(scope, () => this.reconcile(scope, opts))
    }
  }

  async reconcileForAgent(agentId: AgentId): Promise<void> {
    const hosted = await this.deps.routings.listForHost(agentId)
    const scopes = new Map<string, CodeHostRoutingScope>()
    for (const s of [...this.scopesOf(await this.deps.hooks.listForAgent(agentId)), ...hosted]) {
      scopes.set(scopeKey(s), { orgId: s.orgId, provider: s.provider, repoId: s.repoId, family: s.family })
    }
    for (const scope of scopes.values()) {
      if (!(await this.deps.routings.get(scope))) continue
      await this.guard(scope, () => this.reconcile(scope))
    }
  }

  /** A daemon (re)connected with its features: move any scope whose better host it now is. */
  async daemonReady(daemonId: string): Promise<void> {
    for (const scope of await this.deps.routings.listScopesForDaemon(daemonId as DaemonId)) {
      await this.guard(scope, () => this.reconcile(scope, { onlyIfHostMoves: true }))
    }
  }

  private scopesOf(
    hooks: ReadonlyArray<Pick<HookRecord, 'orgId' | 'kind' | 'repoId' | 'family'> | null | undefined>
  ): CodeHostRoutingScope[] {
    const scopes = new Map<string, CodeHostRoutingScope>()
    for (const h of hooks) {
      const scope = h ? routingScopeOf(h) : null
      if (scope) scopes.set(scopeKey(scope), scope)
    }
    return [...scopes.values()]
  }

  private async candidates(members: ReadonlyArray<{ agentId: AgentId }>): Promise<HostCandidate[]> {
    const out: HostCandidate[] = []
    for (const agentId of new Set(members.map((m) => m.agentId))) {
      const agent = await this.deps.agents.getUnscoped(agentId)
      if (!agent) continue
      // A paused agent's rules leave the pool, so a relay could not address its host copy.
      const daemonId = agent.pause === true ? null : await this.deps.placement.routableDaemon(agent)
      const daemon = daemonId ? await this.deps.daemons.getUnscoped(daemonId) : null
      out.push({
        agentId,
        agentCreatedAt: agent.createdAt.getTime(),
        daemonId,
        ...(daemon ? { daemonCreatedAt: daemon.createdAt.getTime() } : {}),
        ...(daemonId ? { features: this.deps.daemonFeatures(daemonId) } : {})
      })
    }
    return out
  }

  private async guard(scope: CodeHostRoutingScope, run: () => Promise<void>): Promise<void> {
    try {
      await run()
    } catch (err) {
      this.deps.log?.warn(
        { err, orgId: scope.orgId, provider: scope.provider, repoId: scope.repoId.toString(), family: scope.family },
        'hook routing: scope reconcile deferred'
      )
    }
  }
}

```

### Core Architecture Module: `packages/control-plane/src/hooks/hook-routing.ts`
```
import {
  HOOK_DECISION_ROUTING_V1_FEATURE,
  decisionChainIds,
  decisionRoutingIssues,
  isCodeHostRoutingScope,
  supportsDecision,
  type CodeHostRoutingFamily,
  type CodeHostRoutingProvider,
  type DecisionValidationIssue,
  type HookRoutingProjection
} from '@agentconnect.md/protocol'
import type { OrgId } from '../domain/ids.js'
import type { CodeHostDecisionRoutingRecord, CodeHostRoutingScope, HookRecord } from '../persistence/ports.js'

/** The projection's member bound (HookRoutingProjection.members). */
export const HOOK_ROUTING_MAX_MEMBERS = 64

export type HookRoutingStatus = 'enabled' | 'needs_review' | 'access_revoked'

/** Whether (provider, family) names a routable scope, narrowing both. */
export function isRoutingScope(provider: string, family: string | null | undefined): family is CodeHostRoutingFamily {
  return isCodeHostRoutingScope(provider, family)
}

type RoutingConfig = Pick<
  CodeHostDecisionRoutingRecord,
  'orgId' | 'decisionId' | 'config' | 'needsReview' | 'definition' | 'definitions'
>

function routingDefinitions(record: RoutingConfig) {
  return new Map(
    [...(record.definitions ?? []), ...(record.definition ? [record.definition] : [])].map((d) => [d.id, d])
  )
}

/** The routing scope a hook row belongs to; null for a generic webhook or a family its provider does not route. */
export function routingScopeOf(
  hook: Pick<HookRecord, 'orgId' | 'kind' | 'repoId' | 'family'>
): CodeHostRoutingScope | null {
  if (hook.repoId === null || !isRoutingScope(hook.kind, hook.family)) return null
  return {
    orgId: hook.orgId as OrgId,
    provider: hook.kind as CodeHostRoutingProvider,
    repoId: hook.repoId,
    family: hook.family
  }
}

type MemberHook = Pick<HookRecord, 'id' | 'agentId' | 'kind' | 'enabled' | 'repoId' | 'family'>

/** A scope's members: every enabled hook of the scope's provider on the repository whose one subject family is the scope's. */
export function routingMembers<H extends MemberHook>(
  hooks: readonly H[],
  scope: { provider: CodeHostRoutingProvider; repoId: bigint; family: CodeHostRoutingFamily }
): Array<H & { agentId: NonNullable<H['agentId']> }> {
  return hooks
    .filter(
      (h): h is H & { agentId: NonNullable<H['agentId']> } =>
        h.kind === scope.provider &&
        h.enabled &&
        h.agentId !== null &&
        h.repoId === scope.repoId &&
        h.family === scope.family
    )
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

/** Why a stored routing cannot execute as saved; empty when it can (pause aside). */
export function hookRoutingIssues(
  record: RoutingConfig,
  memberAgentIds: ReadonlySet<string>
): DecisionValidationIssue[] {
  const definition = record.definition
  if (!definition || definition.id !== record.decisionId || definition.orgId !== record.orgId)
    return [{ path: ['decisionId'], message: 'The Decision is unavailable.' }]
  if (!record.config) return [{ path: [], message: 'Save the routing configuration again.' }]
  const definitions = routingDefinitions(record)
  const issues = decisionRoutingIssues(
    definition.question,
    record.config,
    new Map([...definitions].map(([id, d]) => [id, d.question]))
  )
  if (record.needsReview) issues.push({ path: [], message: 'The Decision changed; review the routing rules.' })
  for (const [index, step] of [record.config, ...(record.config.steps ?? [])].entries()) {
    const path = index ? ['steps', index - 1] : []
    const d = definitions.get(step.decisionId)
    if (!d || d.orgId !== record.orgId || !supportsDecision(d))
      issues.push({ path: [...path, 'decisionId'], message: 'The Decision is unavailable or unsupported.' })
    step.rules.forEach((rule, i) => {
      if (rule.action.type === 'agent' && !memberAgentIds.has(rule.action.agentId))
        issues.push({ path: [...path, 'rules', i, 'action'], message: 'Choose an agent that watches this repository.' })
    })
  }
  return issues
}

/** The routing's executable state; pause is the config's own `enabled` and is not a status. */
export function hookRoutingStatus(record: RoutingConfig, memberAgentIds: ReadonlySet<string>): HookRoutingStatus {
  const definitions = routingDefinitions(record)
  if (decisionChainIds(record.config ?? record).some((id) => definitions.get(id)?.orgId !== record.orgId))
    return 'access_revoked'
  return hookRoutingIssues(record, memberAgentIds).length > 0 ? 'needs_review' : 'enabled'
}

/** The host's copy of one scope: none while paused or unresolvable, disabled while it needs review so the host holds. */
export function hookRoutingProjection(
  record: CodeHostDecisionRoutingRecord,
  members: ReadonlyArray<Pick<HookRecord, 'id'> & { agentId: string }>
): HookRoutingProjection | null {
  if (!record.enabled || !record.config || !record.definition) return null
  const status = hookRoutingStatus(record, new Set(members.map((m) => m.agentId)))
  if (status === 'access_revoked') return null
  return {
    routingId: record.id,
    provider: record.provider,
    repoId: record.repoId.toString(),
    repoFullName: record.repoFullName,
    family: record.family,
    config: status === 'enabled' ? record.config : { ...record.config, enabled: false },
    definition: record.definition,
    ...(record.definitions ? { definitions: record.definitions } : {}),
    members: members.slice(0, HOOK_ROUTING_MAX_MEMBERS).map((m) => ({ agentId: m.agentId, hookId: m.id }))
  }
}

/** One member the host choice weighs: its placement, the serving daemon's live features, and both creation times. */
export interface HostCandidate {
  agentId: string
  agentCreatedAt: number
  daemonId: string | null
  daemonCreatedAt?: number | undefined
  /** Undefined while the daemon is not connected: its support is unknown, not refused. */
  features?: readonly string[] | undefined
}

function earliest(candidates: readonly HostCandidate[]): HostCandidate | undefined {
  return [...candidates].sort(
    (a, b) =>
      (a.daemonCreatedAt ?? Number.POSITIVE_INFINITY) - (b.daemonCreatedAt ?? Number.POSITIVE_INFINITY) ||
      a.agentCreatedAt - b.agentCreatedAt ||
      (a.agentId < b.agentId ? -1 : a.agentId > b.agentId ? 1 : 0)
  )[0]
}

/** The host (§3.2): a live supporting incumbent, else the earliest supporting member, else an offline incumbent, else the earliest placed. */
export function chooseEvaluationAgent(
  current: string | null,
  candidates: readonly HostCandidate[],
  required: readonly string[] = [HOOK_DECISION_ROUTING_V1_FEATURE]
): string | null {
  const supports = (c: HostCandidate) => c.features !== undefined && required.every((f) => c.features!.includes(f))
  const placed = candidates.filter((c) => c.daemonId !== null)
  const incumbent = current ? placed.find((c) => c.agentId === current) : undefined
  if (incumbent && supports(incumbent)) return incumbent.agentId
  const supported = earliest(placed.filter(supports))
  if (supported) return supported.agentId
  if (incumbent && incumbent.features === undefined) return incumbent.agentId
  return earliest(placed)?.agentId ?? null
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2247** (2026-09-22): **A code-host review verdict is lost when the run outlives the 30-minute run reaper**
  *Symptoms*: ## What happens  A code-host review that runs longer than 30 minutes loses its verdict. The review finishes and submits APPROVE, but the Control Plane rejects it with `review dispatch fence does not match the accepted hook run`, and the check ends `neutral` without a review.  Seen on #2225: the review agent passed the change, but the run was past 30 minutes. The time went on a fresh checkout installing dependencies and a daemon-package typecheck, which also hit the review environment's 1 GB heap. Any large daemon PR can take that long.  ## Why  - Hook runs share the cron reaper: `hookRunReaper` in `packages/control-plane/src/container.ts` is a `CronRunReaper` with `ttlMs: CRON_RUN_TTL_SEC * 1000`, default 1800 s. It marks any run still `running` after that `failed` with `orphanedAt`, and the projection `timed_out`. - The reaper's own contract says this is safe: "a genuinely long turn whose completion arrives late still overwrites the reaped `failed` with its real outcome" (`cronRunReaper.ts`). - The review path breaks that contract. `CodeHostReviewBrokerService.authorize` (`packages/control-plane/src/codehost/review-lease.service.ts`) requires `run.status === 'running'`, so a verdict that arrives after the reap is denied, not written over the timeout.  ## Options  1. Let `authorize` accept a run the reaper orphaned (`orphanedAt` set, no other outcome), with the rest of the fence unchanged: same snapshot, same daemon, same organization. This restores the reaper's documented co

- **Issue #2246** (2026-09-22): **Session retention never frees some expired sessions, so review checkouts fill the disk**
  *Symptoms*: ## What happens  Session retention (`sessions.retention`, default `7d`) never frees some expired sessions. A daemon running a code-review agent keeps every review checkout until the disk fills.  On two self-hosted test daemons:  - **Machine A:** the review agent's `sessions/` directory is 94 GB and growing (82 GB when first measured, hours earlier). The root disk is at 92%, even after 66 GB of unrelated build cache was freed. When it filled completely, every review failed with ENOSPC and was reported as skipped. 35 session rows are past the 7-day window. - **Machine B:** 76 session rows are past the window, up to 52 days old. Every hourly sweep logs `removed 0/76 expired session(s), 76 still active`. The root disk is at 90%.  ## Three causes, from the daemons' own logs  **1. Merge-time cleanup is refused while the session's VM still runs a process.** When a PR merges, the code-host lifecycle removes that review's checkout. For a microsandbox agent this fails:  ``` github lifecycle: pull_request_merged worktree cleanup failed for <session> (microsandbox environment <agent>/session-<leaf> has 1 active executions) ```  `closeEnvironment` (`packages/daemon/src/microsandbox/driver.ts`) refuses while `state.active > 0`, and a long-lived process in the environment (the runtime or its shim) holds that count. Nothing retries the cleanup, so the checkout waits for retention. This appears for nearly every merged PR.  **2. Retention fails closed on a session directory that is no longer a

- **Issue #2245** (2026-09-22): **Daemon: a session row left in prompting by a killed process never recovers**
  *Symptoms*: ## What happens  A daemon session row written to `prompting` stays there forever if the daemon process dies mid-turn: a crash, SIGKILL, OOM kill or host reboot. Nothing resets it when the daemon starts again.  Seen on a self-hosted test daemon: five rows in `prompting`, 15 to 29 days old. Four were written within one 45-minute window, which looks like a single process death.  ## Why it sticks  - Every in-process failure path resets the row to `idle` (for example, the catch in `openSession`, `packages/daemon/src/daemon.ts`). A process death skips all of them. - No startup phase touches rows left in `prompting`, `resuming` or `cancelling`. - The idle close (`LocalStore.closeIdleSessions`) only closes `state = 'idle'` rows past `limits.agentIdleTimeoutMs`. - Session retention (`LocalStore.listExpiredSessions`) only considers `idle` and `closed` rows. Its comment treats the other three states as "live by definition".  A row heals only if its conversation gets another message. Until then it:  - never closes and is never collected, so it keeps its worktree or session directory; - reports a turn in flight to anything that reads session state; - was counted as a hosted session by the executor placement count before #2225.  ## Suggested direction  Repair a row the daemon provably is not running, rather than resetting at boot: in the periodic idle sweep, a `prompting`/`resuming`/`cancelling` row with no in-memory turn (`inflight`, `activeDispatchDoneByKey`, `pending`) and no update for

- **Issue #2199** (2026-09-22): **Merge-when-ready does nothing for a session running on a group member's executor**
  *Symptoms*: ## Problem  Merge-when-ready dispatches on the **agent's** placement, not the **session's**. `AutoMergeWatcher` (wired in `packages/daemon/src/daemon.ts`) gives a cluster agent's pod the shim's `automerge` channel and otherwise watches a path on the daemon's own disk. With session executors (#2111) a self-hosted holder can own an agent whose `session`-isolated session runs on another member of its group, and then neither arm is right: the checkout the watcher must read is on the executor, and the local path it watches does not exist there.  The executor plane also does not grant `automerge` on its pipe (`packages/daemon/src/execution/executor-plane.ts` takes the pool's grants minus that one, because §7 of `docs/designs/session-executors.md` keeps the watcher on the holder), so even a watcher that dispatched correctly has no channel to use.  The result is silent: arming merge-when-ready in a spread session appears to succeed and nothing ever merges.  ## Scope  - Dispatch the watcher on the session's placement, the way `WorkspaceManager` now answers every workspace question per scope after #2198 (`PlaneScope`, `fsFor(agentId, scope)`). - Decide and record which side runs it for a spread session. The two shapes are: the holder keeps the watcher and reads the checkout over the executor's pipe (needs the `automerge` grant, and §7's sentence stays true), or the executor runs the in-environment watcher as a pod does (§7 would need revising, and the executor would need the code-host 

- **Issue #2002** (2026-09-11): **Sandbox launches can reach skill preparation without duty ownership**
  *Symptoms*: With duty enforcement enabled, sandbox skill preparation requires the daemon to hold the agent's execution duty. This check also runs when there are no skills to install or remove.  `agent/launch` and tokened `agent/activate` can enter startup without first establishing duty ownership. During a duty gap, startup may therefore fail later with `cluster skill preparation authority is unavailable`.  Align launch admission with skill preparation: establish ownership or route to the holder before preparing the workspace, otherwise return a clear retryable response. Preserve the existing write fences.  This is a code-path finding in the shared Kubernetes/microsandbox flow; an end-to-end reproduction is still needed. Cover non-holder launch/activation, including an empty skill set.  Code: `cp/config-apply-handlers.ts` and `reconcileSandboxSkills` in `daemon.ts`, under `packages/daemon/src/`.  Deferred follow-up from #1996. 

- **Issue #2001** (2026-09-11): **Sandbox skill receipts reject otherwise valid skill sets**
  *Symptoms*: Sandbox skill installation and ownership records have different limits. The shared ledger accepts only 256 files total: six skills with 50 files each can be valid for the host installer but fail migration or sandbox preparation. Receipt paths are also capped at 512 characters instead of the host's 1024-byte limit, and reconcile messages must fit within 220 KiB.  Align installation and receipt limits across Kubernetes and microsandbox. Larger supported receipts need bounded paging; unsupported sets should fail clearly before workspace mutation. Raising the file-count limit alone is insufficient.  Code: `store/cluster-skill-ledger.ts`, `shim/skill-protocol.ts`, and `skills/sandbox-skill-ledger.ts` under `packages/daemon/src/`.  Deferred shared limitation from #1996. 

- **Issue #1969** (2026-09-28): **The console decides permission requests it never sees the options of, so Allow always means the first allow_once**
  *Symptoms*: Found while reviewing #1968 (the permission-card option cap). **Pre-existing — not introduced by that change**, and deliberately left alone there rather than swept in.  ## The defect  The console/Agent-page approval surface is binary Allow/Deny, and it decides an ACP permission request whose options it never sees:  - `AgentPermissionRequestRecord` (`packages/protocol/src/frames/agent.ts:601`) carries `command`,   `status`, requester and timestamps — **no `options`**. The console cannot render them because it   is never sent them. - `AgentPermissionDecision` is `decision: z.enum(['allow', 'deny'])`. - The daemon then maps that binary answer onto a real option   (`packages/daemon/src/permissions/coordinator.ts:1077`):  ```ts req.decision === 'allow'   ? (pending.params.options.find((o) => o.kind === 'allow_once') ??      pending.params.options.find((o) => o.kind === 'allow_always'))   : … ```  So **Allow resolves to the first `allow_once`**, and any other allow-shaped option is unreachable from the console.  ## Why it matters even for the standard option set  This is not only about exotic option lists. The ACP standard set is four — `allow_once` / `allow_always` / `reject_once` / `reject_always` — and the console cannot express the distinction that matters most in it: **"allow this once" vs "allow always"**. An editor clicking Allow gets `allow_once` and has no way to grant the persistent one, which is precisely the decision a human would want to make deliberately.  The chat ca

- **Issue #1121** (2026-08-17): **Every sandbox resume waits ~1.3s on a reconnect-sized backoff after the first dial is refused**
  *Symptoms*: ## What  Every sandbox resume pays a guaranteed ~1.3 s of pure waiting, because the duty holder dials the shim the instant the pod reports `Ready`, the shim is not accepting yet, and the failed dial is then retried on a backoff designed for reconnects rather than for a pod that just started.  Measured on a live resume:  ``` 02:27:51  pod Ready / container started 02:27:51.409  shim: sandbox dial failed, retrying in 1262ms (connect ECONNREFUSED …:8085) 02:27:52.684  shim: bound agent … generation 13 ```  The bind itself takes ~10 ms once the listener is up. Everything between is the backoff overshooting.  ## Why it happens  Two independent causes, and fixing either one removes the wait:  1. **`Ready` does not mean dialable.** The runtime container has no readiness probe, so the pod becomes `Ready` when the container process starts, not when the shim is accepting on its port. `awaitReady` therefore returns strictly too early, by however long the shim takes to listen — a few hundred ms. 2. **The first retry is sized for a reconnect.** `ShimDialer` uses the shared `Backoff` with its defaults (`packages/connection/src/backoff.ts`: `baseMs = 1000`, jitter adds 0–100%), so the first retry lands 1000–2000 ms out. That is a sensible first step when a peer has gone away and you do not know why; it is far too coarse for "the pod started 200 ms ago and its listener is coming up".  ## Why it is worth fixing  It is on **every** wake path, not just the console's: an inbound platform message

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

### Incident Patch 1: `758c16c0` (2026-10-06)
**Commit Message**: fix(daemon): remove a placed session's skills left at its session directory (#2804)

Since #2801 a placed session installs its skills into its checkout
under a ledger of their own. Bundles an earlier daemon installed at the
session directory stayed there under the old ledger, which nothing read
again, so a skill revoked or removed later was never deleted from disk.

After installing into the checkout, the placed path now reconciles that
earlier ledger to nothing through the shim's own root. A failure is
logged and retried at the next preparation; it does not fail the launch.

Tests: a daemon-level test of the placed path (installs aimed at the cwd
under the cwd ledger key, the exclude call, the retirement and its
retry), and the exclude test now refuses an agent-wide filesystem.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `packages/daemon/src/daemon.ts` (modified, +44/-3)
```diff
@@ -6229,14 +6229,55 @@ export class Daemon {
   ): Promise<ClusterSkillLedger | undefined> {
     const reported = plane?.workspaceIncarnationFor?.(pod)
     const shimGeneration = plane?.shimGenerationFor?.(pod)
-    return await this.reconcileSandboxSkills(agent, {
+    const isLaunchCurrent = () =>
+      plane?.workspaceIncarnationFor?.(pod) === reported && plane?.shimGenerationFor?.(pod) === shimGeneration
+    const ledger = await this.reconcileSandboxSkills(agent, {
       client: plane?.skillClientFor?.(pod, cwd),
       // Receipts are relative to the directory installed into, so installs into a cwd keep a ledger of their own.
       workspaceIncarnation: reported && cwd ? cwdWorkspaceIncarnation(reported, cwd) : reported,
       shimGeneration,
-      isLaunchCurrent: () =>
-        plane?.workspaceIncarnationFor?.(pod) === reported && plane?.shimGenerationFor?.(pod) === shimGeneration
+      isLaunchCurrent
     })
+    if (cwd !== undefined && reported && shimGeneration !== undefined) {
+      await this.retireShimRootSkills(agent, plane?.skillClientFor?.(pod), reported, shimGeneration, isLaunchCurrent)
+    }
+    return ledger
+  }
+
+  /** Remove the bundles an older daemon installed at a placed session's directory, above its checkout: no runtime scans there, and no other ledger owns them. */
+  private async retireShimRootSkills(
+    agent: Agent,
+    client: ClusterSkillClient | undefined,
+    workspaceIncarnation: string,
+    shimGeneration: number,
+    isLaunchCurrent: () => boolean
+  ): Promise<void> {
+    const prior = await this.store.clusterSkillLedger(agent.id, workspaceIncarnation)
+    if (!prior?.ledger.roots.length) return
+    const duty = this.duties.dutyForAgent(agent.id)
+    const skillsAgentId = this.runtimeCatalog.entries[agent.runtime]?.skillsAgentId
+    if (!client || !duty || !skillsAgentId || !this.cfg.daemonId) return
+    try {
+      await new ClusterSkillCoordinator(this.store).reconcile({
+        authority: {
+          groupId: duty.groupId,
+          term: duty.term,
+          daemonId: this.cfg.daemonId,
+          agentId: agent.id,
+          workspaceIncarnation
+        },
+        skillsAgentId,
+        shimGeneration,
+        sources: [],
+        client,
+        isLaunchCurrent
+      })
+    } catch (error) {
+      // Retried at the next preparation: the ledger still holds them.
+      this.log.warn(
+        `skills: could not remove ${agent.id}'s bundles at its session directory (${(error as Error).message})`
+      )
+    }
   }
 
   private async reconcileMicrosandboxSkills(agent: Agent, cwd: string): Promise<string[]> {
```

**File**: `packages/daemon/src/shim/skill-client.ts` (modified, +1/-2)
```diff
@@ -30,8 +30,7 @@ import {
   type ClusterSkillVerifyReply
 } from './skill-protocol.js'
 
-/** A shim's skills seam aimed at `cwd` rather than the shim's own workspace root: the runtimes scan for project skills
- *  from their cwd up to its repository root only, so bundles beside a checkout rather than in it are never found. */
+/** A shim's skills seam aimed at `cwd`, not its own root: runtimes scan for project skills only from cwd up to the repository root. */
 export function cwdSkillRequester(session: ShimRequester, cwd: string): ShimRequester {
   return { request: (capability, request, options) => session.request(capability, { cwd, request }, options) }
 }
```

**File**: `packages/daemon/test/daemon-lifecycle.test.ts` (modified, +80/-0)
```diff
@@ -11,7 +11,9 @@ import { buildCpClientDeps } from '../src/cp/cp-client-deps.js'
 import { ExecutorPlane } from '../src/execution/executor-plane.js'
 import { TaskViolationError } from '../src/cp/task-reader.js'
 import { configFilesDir } from '../src/shim/config-file-env.js'
+import { ClusterSkillCoordinator } from '../src/skills/cluster-skill-coordinator.js'
 import { readSkillLedger, skillLedgerLocation } from '../src/skills/skill-install-ledger.js'
+import { cwdWorkspaceIncarnation } from '../src/skills/workspace-incarnation.js'
 import { sessionKey, transcriptChannelKey } from '../src/store/local-store.js'
 import { NO_RESPONSE_SENTINEL } from '../src/session/no-response.js'
 import { localWorkspaceFiles } from '../src/workspace/workspace-files.js'
@@ -626,6 +628,84 @@ describe('Daemon session lifecycle (#118)', () => {
     }
   })
 
+  it("installs a placed session's skills into its checkout and retires those at its session directory", async () => {
+    const daemon = new Daemon({ root: scaffold(), hostFactory: () => quietHost() as never })
+    try {
+      await daemon.start()
+      const d = daemon as any
+      const agent = d.agents.get('bot-a')
+      d.runtimeCatalog.entries.claude = { ...d.runtimeCatalog.entries.claude, skillsAgentId: 'claude' }
+      const cwd = '/srv/executor/sessions/leaf/workspace'
+      const reported = 'workspace:reported'
+      const atCwd = cwdWorkspaceIncarnation(reported, cwd)
+      const root = (path: string) => ({
+        path,
+        sourceId: 'managed:a',
+        sourceKind: 'managed' as const,
+        digest: 'a'.repeat(64),
+        files: []
+      })
+      const clients = new Map<string | undefined, unknown>([
+        [undefined, { manifestLimits: { maxFiles: 1, maxTotalBytes: 1 } }],
+        [cwd, { manifestLimits: { maxFiles: 1, maxTotalBytes: 1 } }]
+      ])
+      d.executorPlane = {
+        placementOf: (key: string) =>
+          key === KEY ? { agentId: 'bot-a', sessionKey: KEY, subject: 'bot-a/leaf' } : undefined,
+        withEnvironment: (_subject: string, work: () => Promise<unknown>) => work(),
+        mountFor: () => '/srv/executor',
+        skillClientFor: (_subject: string, at?: string) => clients.get(at),
+        workspaceIncarnationFor: () => reported,
+        shimGenerationFor: () => 1,
+        planeFor: () => undefined,
+        launched: () => [],
+        releaseAgent: () => {},
+        stop: async () => {}
+      }
+      vi.spyOn(d.workspaces, 'prepareExecutorWorkspace').mockResolvedValue(cwd)
+      const exclude = vi.spyOn(d.workspaces, 'excludePlacedSessionSkills').mockResolvedValue(undefined)
+      vi.spyOn(d.duties, 'dutyForAgent').mockReturnValue({ groupId: 'group-a', term: '1' })
+      // An older daemon installed at the shim's root, the session directory; the checkout holds nothing yet.
+      const ledgers = new Map([[reported, { revision: 1, ledger: { roots: [root('.claude/skills/a')] } }]])
+      vi.spyOn(d.store, 'clusterSkillLedger').mockImplementation((async (_id: string, key: string) =>
+        ledgers.get(key)) as never)
+      let retirementFails = true
+      const reconcile = vi.spyOn(ClusterSkillCoordinator.prototype, 'reconcile').mockImplementation(async (input) => {
+        const at = input.authority.workspaceIncarnation
+        if (at === reported && retirementFails) {
+          retirementFails = false
+          throw new Error('shim busy')
+        }
+        const roots = at === atCwd ? [root('.claude/skills/a')] : []
+        ledgers.set(at, { revision: 2, ledger: { roots } })
+        return { roots }
+      })
+      const request = { sessionKey: KEY, isolation: 'session' }
+
+      // A failed retirement leaves the launch alone; the next preparation retries it.
+      expect(await d.runAgentWorkspacePreparation(agent, request)).toBe(cwd)
+      expect(reconcile.mock.calls.map(([input]) => [input.authority.workspaceIncarnation, input.client])).toEqual([
+        [atCwd, clients.get(cwd)],
+        [reported, clients.get(undefined)]
+      ])
+      expect(reconcile.mock.calls[1]![0].sources).toEqual([])
+      expect(exclude).toHaveBeenCalledWith(agent, cwd, ['.claude/skills/a', '.agentconnect/cluster-skill-state'])
+
+      reconcile.mockClear()
+      await d.runAgentWorkspacePreparation(agent, request)
+      expect(reconcile.mock.calls.map(([input]) => input.authority.workspaceIncarnation)).toEqual([atCwd, reported])
+      expect(ledgers.get(reported)?.ledger.roots).toEqual([])
+
+      // Nothing is left there, so later preparations ask nothing of the session directory.
+      reconcile.mockClear()
+      await d.runAgentWorkspacePreparation(agent, request)
+      expect(reconcile.mock.calls.map(([input]) => input.authority.workspaceIncarnation)).toEqual([atCwd])
+    } finally {
+      vi.restoreAllMocks()
+      await daemon.stop()
+    }
+  })
+
   it.each([true, false])('installs a host runtime only for local execution (runInSandbox=%s)', async (runInSandbox) => {
   
```

**File**: `packages/daemon/test/executor-plane.test.ts` (modified, +1/-2)
```diff
@@ -254,8 +254,7 @@ describe('the skills a placed session installs', () => {
     return { executor, request }
   }
 
-  // The shim is rooted at the session directory, above the checkout the runtime scans for project skills (Codex
-  // stops at the repository root), so installs are aimed at the runtime's cwd.
+  // The shim is rooted at the session directory, above the checkout where runtimes scan for project skills.
   it('aims every request at the cwd it is given', async () => {
     const { executor, request } = bound()
     await executor.skillClientFor(SUBJECT, CWD)!.verify([])
```

**File**: `packages/daemon/test/git-exclude.test.ts` (modified, +8/-1)
```diff
@@ -248,11 +248,18 @@ describe('the workspace manager recording the bundles its skills step installs',
       mkdir: async () => {},
       writeFile: async (path: string, content: string) => void written.push({ path, content })
     }
+    const unscoped = {
+      readFileBytes: async () => {
+        throw new Error('asked without the path that names the session')
+      }
+    }
     const workspaces = new WorkspaceManager()
     wireTestPlane(workspaces, {
       workspacesOffDisk: true,
       gitRunnerFor: () => runner,
-      workspaceFsFor: () => ({ fs, mount: '/srv/executor' }) as never
+      // A placed session's filesystem is found by its path; an agent-wide question would reach the holder's own disk.
+      workspaceFsFor: (_agentId, scope) =>
+        ({ fs: scope?.path === cwd ? fs : unscoped, mount: '/srv/executor' }) as never
     })
     await workspaces.excludePlacedSessionSkills(agent, cwd, [BUNDLE, '.agentconnect/cluster-skill-state'])
     // The exclude file is the checkout's own, on the executor: nothing is written on this disk.
```

---

### Incident Patch 2: `1195ce8b` (2026-10-06)
**Commit Message**: fix(daemon): skip a locally edited installed skill instead of failing every turn (#2803)

An agent that edited one of its own installed skills wedged the workspace:
the next reinstall planned a replacement of the edited bundle, the confined
helper refused it, and recovery then failed verifying the same bundle, so the
ledger stayed in `applying` and every later turn hit the same error.

Planning now checks each recorded bundle against its receipt. One that no
longer matches is given up and left in place: skipped and reported as a
conflict like a foreign bundle when still desired, left alone rather than
removed when not. Recovery gives up a prior edited where it stands, with no
quarantine or tombstone of its operation beside it, instead of discarding or
restoring it, so a workspace already stuck in `applying` recovers on its own.

Refs #2802

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `packages/daemon/src/skills/skill-install-ledger.ts` (modified, +39/-8)
```diff
@@ -294,8 +294,14 @@ export async function recoverSkillLedger(
 
     const priorByPath = new Map(ledger.prior.map((entry) => [entry.relativeRoot, entry]))
     const vanished = new Set<string>()
+    const operationRoots = new Set(ledger.operations.map((operation) => operation.relativeRoot))
     for (const operation of [...ledger.operations].reverse()) {
       const prior = priorByPath.get(operation.relativeRoot)
+      // Edited where it stands and never moved, so nothing of ours is there to discard or restore: give it up and leave it.
+      if (prior && (await editedInPlace(cwd, prior, operation))) {
+        vanished.add(prior.relativeRoot)
+        continue
+      }
       await mutate(
         {
           action: 'discard',
@@ -337,9 +343,11 @@ export async function recoverSkillLedger(
         )
       }
     }
-    const operationRoots = new Set(ledger.operations.map((operation) => operation.relativeRoot))
     for (const prior of ledger.prior) {
-      if (!operationRoots.has(prior.relativeRoot) && !(await destinationOccupied(cwd, prior.relativeRoot))) {
+      if (
+        !operationRoots.has(prior.relativeRoot) &&
+        (!(await destinationOccupied(cwd, prior.relativeRoot)) || (await editedInPlace(cwd, prior)))
+      ) {
         vanished.add(prior.relativeRoot)
       }
     }
@@ -410,6 +418,17 @@ async function destinationOccupied(cwd: string, relativeRoot: string): Promise<b
   }
 }
 
+/** Whether a prior still at its own path, with no artifact of its operation beside it, no longer matches its receipt. */
+async function editedInPlace(cwd: string, prior: OwnedSkillBundle, operation?: JournalOperation): Promise<boolean> {
+  if (operation) {
+    const parent = operation.relativeRoot.split('/').slice(0, -1).join('/')
+    for (const name of [operation.quarantineName, operation.tombstoneName]) {
+      if (await destinationOccupied(cwd, `${parent}/${name}`)) return false
+    }
+  }
+  return (await destinationOccupied(cwd, prior.relativeRoot)) && !(await installedBundlesIntact(cwd, [prior]))
+}
+
 /** Whether an operation's prior bundle is at neither of the two addresses recovery can find it at: its own path, or the quarantine a mutation moves it to. */
 async function priorHasNoAddress(cwd: string, operation: JournalOperation): Promise<boolean> {
   const parent = operation.relativeRoot.split('/').slice(0, -1).join('/')
@@ -483,9 +502,17 @@ async function reconcileSkillBundlesLocked(
     const recorded = await canonicalizeOwned(options.cwd, ledger?.owned ?? [])
     // An absent recorded bundle is not stale executable content — nothing to quarantine, nothing foreign to protect — so plan its path as a first install.
     const prior: OwnedSkillBundle[] = []
+    const modified = new Set<string>()
     for (const entry of recorded) {
-      if (await destinationOccupied(options.cwd, entry.relativeRoot)) prior.push(entry)
-      else options.warn?.(`skills: recorded bundle ${entry.relativeRoot} is gone from the workspace; reinstalling`)
+      if (!(await destinationOccupied(options.cwd, entry.relativeRoot))) {
+        options.warn?.(`skills: recorded bundle ${entry.relativeRoot} is gone from the workspace; reinstalling`)
+      } else if (await installedBundlesIntact(options.cwd, [entry])) {
+        prior.push(entry)
+      } else {
+        // Edited since install, so no longer ours to replace or remove: give it up and leave it in place.
+        modified.add(entry.relativeRoot)
+        options.warn?.(`skills: recorded bundle ${entry.relativeRoot} was modified in the workspace; leaving it as is`)
+      }
     }
     const priorByPath = new Map(prior.map((entry) => [entry.relativeRoot, entry]))
     const legacyHints = new Set<string>()
@@ -518,9 +545,11 @@ async function reconcileSkillBundlesLocked(
           continue
         }
       }
-      const detail = legacyHints.has(candidate.relativeRoot)
-        ? 'legacy workspace marker is not trusted; remove or migrate it explicitly'
-        : 'the path is not owned by this daemon ledger'
+      const detail = modified.has(candidate.relativeRoot)
+        ? 'it was modified after installation; remove it to reinstall'
+        : legacyHints.has(candidate.relativeRoot)
+          ? 'legacy workspace marker is not trusted; remove or migrate it explicitly'
+          : 'the path is not owned by this daemon ledger'
       // Skipping leaves the path untouched, which is what refusing wanted; one foreign bundle must not stop every other skill.
       conflicts.push(candidate.relativeRoot)
       options.warn?.(`skills: skipped unowned skill ${candidate.relativeRoot}: ${detail}`)
@@ -688,7 +717,9 @@ async function reconcileSkillBundlesLocked(
     return {
       installed: candidates.map((entry) => entry.relativeRoot),
       // Replaced and vanished prior bundles count as removed; untouched bundles do not.
-      removed: recorded.filter((entry) => !kept.has(entry.relativeRoot)).map((entry) => entry.relativeRoot),
+      removed: recor
```

**File**: `packages/daemon/test/skill-install-ledger.test.ts` (modified, +135/-16)
```diff
@@ -1,5 +1,5 @@
 import { createHash, randomUUID } from 'node:crypto'
-import { existsSync, readFileSync } from 'node:fs'
+import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
 import { lstat, mkdir, mkdtemp, readdir, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises'
 import { tmpdir } from 'node:os'
 import { dirname, join } from 'node:path'
@@ -533,38 +533,139 @@ describe.skipIf(process.platform === 'win32')('skill install ledger over a re-ch
     expect(existsSync(join(cwd, ...BUNDLE.split('/'), 'SKILL.md'))).toBe(true)
   })
 
-  it('still refuses a recorded path that now holds content it does not own', async () => {
+  it('skips a recorded path that now holds content it does not own', async () => {
     await reconcile('v1')
     const target = join(cwd, ...BUNDLE.split('/'))
     await rm(target, { recursive: true, force: true })
     await mkdir(target, { recursive: true })
     await writeFile(join(target, 'manual'), 'do not delete')
 
-    await expect(reconcile('v1')).rejects.toThrow(SkillLedgerSafetyError)
+    const skipped = await reconcile('v1')
+
+    expect(skipped.conflicts).toEqual([BUNDLE])
+    expect(skipped.owned).toEqual([])
     expect(await readFile(join(target, 'manual'), 'utf8')).toBe('do not delete')
+    expect((await readSkillLedger(await skillLedgerLocation(cwd, stateDir)))?.phase).toBe('ready')
   })
 
   // The recorded inode is not proof on its own: a filesystem that recycles inode numbers can seat a
   // re-checked-out directory on the recorded one, and then only the receipt walk tells the two apart.
-  it('refuses a recorded path whose identity still matches but whose content no longer does', async () => {
+  it('skips a recorded path whose identity still matches but whose content no longer does', async () => {
     await reconcile('v1')
     const target = join(cwd, ...BUNDLE.split('/'))
     const recorded = await pathIdentity(target)
     await writeFile(join(target, 'manual'), 'do not delete')
     expect(await pathIdentity(target)).toEqual(recorded)
 
-    await expect(reconcile('v1')).rejects.toThrow(/installation failure: .*refusing to replace unowned skill/)
+    const skipped = await reconcile('v1')
+
+    expect(skipped.conflicts).toEqual([BUNDLE])
+    expect(skipped.owned).toEqual([])
     expect(await readFile(join(target, 'manual'), 'utf8')).toBe('do not delete')
   })
 
-  it('names the installation failure alongside the recovery failure', async () => {
+  it('skips an installed skill the agent edited and still updates the others', async () => {
+    const editedRoot = '.claude/skills/edited'
+    const options = { cwd, stateDir, agentId: 'a1', runtime: 'claude', cliVersion: '1.5.21' }
+    await reconcileSkillBundles({
+      ...options,
+      fingerprint: 'v1',
+      candidates: [
+        { ...oneFileReceipt(BUNDLE, 'fixture:v1'), sourceDir },
+        { ...oneFileReceipt(editedRoot, 'edited:v1'), sourceDir }
+      ]
+    })
+    const edited = join(cwd, ...editedRoot.split('/'))
+    await writeFile(join(edited, 'SKILL.md'), `${BODY}Local notes\n`)
+    await mkdir(join(edited, 'references'))
+    await writeFile(join(edited, 'references/notes.md'), 'kept')
+    const nextSource = join(root, 'next-source')
+    const nextBody = `${BODY}Updated content\n`
+    await mkdir(nextSource)
+    await writeFile(join(nextSource, 'SKILL.md'), nextBody)
+    const files = [{ path: 'SKILL.md', mode: 0o600, size: Buffer.byteLength(nextBody), sha256: sha256(nextBody) }]
+    const next = (root: string, sourceKey: string) => ({
+      relativeRoot: root,
+      sourceKey,
+      sourceDir: nextSource,
+      files,
+      treeDigest: treeDigest(files)
+    })
+    const warnings: string[] = []
+
+    const result = await reconcileSkillBundles({
+      ...options,
+      fingerprint: 'v2',
+      candidates: [next(BUNDLE, 'fixture:v2'), next(editedRoot, 'edited:v2')],
+      warn: (message) => warnings.push(message)
+    })
+
+    expect(result.installed).toEqual([BUNDLE])
+    expect(result.removed).toEqual([BUNDLE])
+    expect(result.conflicts).toEqual([editedRoot])
+    expect(result.owned.map((entry) => entry.relativeRoot)).toEqual([BUNDLE])
+    expect(warnings).toContainEqual(expect.stringMatching(/skipped unowned skill .*edited: it was modified/))
+    expect(await readFile(join(cwd, BUNDLE, 'SKILL.md'), 'utf8')).toBe(nextBody)
+    expect(await readFile(join(edited, 'SKILL.md'), 'utf8')).toBe(`${BODY}Local notes\n`)
+    expect(await readFile(join(edited, 'references/notes.md'), 'utf8')).toBe('kept')
+    const location = await skillLedgerLocation(cwd, stateDir)
+    expect((await readSkillLedger(location))?.phase).toBe('ready')
+    expect(
+      (await reconcileSkillBundles({ ...options, fingerprint: 'v2', candidates: [next(BUNDLE, 'fixture:v2')] }))
+        .conflicts
+    ).toEqual([])
+    expect(await readFile(join(edited, 'references/notes.md'), 'utf8')).toBe('kept')
+  })
+
+  it('leaves an edited skill 
```

**File**: `packages/daemon/test/unified-skills.test.ts` (modified, +11/-4)
```diff
@@ -565,7 +565,7 @@ describe.skipIf(!hasBwrap)('unified isolated skill installation', () => {
     expect(await readFile(join(cwd, '.runtime/skills/recreated/SKILL.md'), 'utf8')).toBe('manual replacement')
   })
 
-  it('checks installed bytes rather than trusting a matching plan fingerprint and preserves tampering', async () => {
+  it('checks installed bytes rather than trusting a matching plan fingerprint and skips a tampered skill', async () => {
     const sourceDir = await writeSkill(sources, 'repair', 'expected')
     const cli = fakeCli(() => '.runtime')
     const localSkills: LocalSkillSource[] = [{ kind: 'dream', key: 'dream:repair', name: 'repair', sourceDir }]
@@ -580,9 +580,16 @@ describe.skipIf(!hasBwrap)('unified isolated skill installation', () => {
     expect(cli.calls).toHaveLength(1)
 
     await writeFile(join(cwd, '.runtime/skills/repair/SKILL.md'), 'tampered')
-    await expect(
-      installSkills({ id: 'a1', runtime: 'claude', skills: [] }, cwd, { stateDir, localSkills, runCli: cli.run })
-    ).rejects.toThrow(/could not be restored|mutation was refused/i)
+    // An edited skill is skipped as a conflict rather than failing the whole preparation.
+    const skipped = await installSkills({ id: 'a1', runtime: 'claude', skills: [] }, cwd, {
+      stateDir,
+      localSkills,
+      runCli: cli.run
+    })
+    expect(skipped.errors).toEqual([
+      { source: '.runtime/skills/repair', error: 'destination is not owned by this daemon ledger; skill skipped' }
+    ])
+    expect(skipped.owned).toEqual([])
     expect(cli.calls).toHaveLength(2)
     expect(await readFile(join(cwd, '.runtime/skills/repair/SKILL.md'), 'utf8')).toBe('tampered')
   }, 120_000)
```

---

### Incident Patch 3: `e21ec4ba` (2026-10-06)
**Commit Message**: fix(daemon): install a placed session's skills into its checkout (#2801)

A session placed on another daemon in its group installed its skills at
the session directory, above its checkout. Codex scans for project skills
only from its cwd up to the repository root, and Claude listed none of
them either, so a placed session saw no installed skills.

The placed path now passes the prepared cwd to the executor's skills
seam, which wraps each request as `{ cwd, request }`, the shape the
microsandbox path already sends. Installs into a cwd keep their own
ledger key, and the bundles and the skill state directory are added to
the checkout's `info/exclude` through the executor's plane.

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `docs/designs/session-executors.md` (modified, +3/-1)
```diff
@@ -141,7 +141,9 @@ answers exactly that sentence; the pool's resumes a Sandbox and waits for its po
 driver, and its `resolve` is the `prepare` of §6. Above it the path is
 indistinguishable from the pool's: ACP is spawned through the shim, Git and
 workspace reads cross the shim's exec and fs channels, skills are published through
-it, and the credential and MCP tunnels ride the same channel in the direction §6 of
+it into the session's checkout (the runtime's cwd, where runtimes scan for project
+skills; the shim's own root is the session directory above it, and Codex stops at
+the repository root), and the credential and MCP tunnels ride the same channel in the direction §6 of
 [cluster-spawn-and-shim.md](cluster-spawn-and-shim.md) already fixes. Where a
 session's workspace operations land is an `ExecutionPlane`
 (`packages/daemon/src/execution/plane.ts`), resolved per scope rather than per
```

**File**: `packages/daemon/src/daemon.ts` (modified, +16/-9)
```diff
@@ -412,6 +412,7 @@ import {
   retainedAfterTracking
 } from './skills/install-skills.js'
 import { GitSkillRefTracker } from './skills/git-skill-ref-tracker.js'
+import { cwdWorkspaceIncarnation } from './skills/workspace-incarnation.js'
 import {
   ClusterSkillCoordinator,
   clusterSkillSupportRequired,
@@ -6147,7 +6148,12 @@ export class Daemon {
           ...request!,
           confined: true
         })
-        await this.reconcileClusterSkills(agent, placed.subject, plane)
+        // Into the checkout, where the runtime scans for project skills, and kept out of its `git status` like a local install.
+        const ledger = await this.reconcileClusterSkills(agent, placed.subject, plane, cwd)
+        await this.workspaces.excludePlacedSessionSkills(agent, cwd, [
+          ...(ledger?.roots.map((root) => root.path) ?? []),
+          '.agentconnect/cluster-skill-state'
+        ])
         return cwd
       })
     }
@@ -6218,17 +6224,18 @@ export class Daemon {
     agent: Agent,
     pod: SandboxSubject,
     plane: Pick<K8sRuntimePlane, 'skillClientFor' | 'workspaceIncarnationFor' | 'shimGenerationFor'> | undefined = this
-      .k8sPlane
-  ): Promise<void> {
-    const workspaceIncarnation = plane?.workspaceIncarnationFor?.(pod)
+      .k8sPlane,
+    cwd?: string
+  ): Promise<ClusterSkillLedger | undefined> {
+    const reported = plane?.workspaceIncarnationFor?.(pod)
     const shimGeneration = plane?.shimGenerationFor?.(pod)
-    await this.reconcileSandboxSkills(agent, {
-      client: plane?.skillClientFor?.(pod),
-      workspaceIncarnation,
+    return await this.reconcileSandboxSkills(agent, {
+      client: plane?.skillClientFor?.(pod, cwd),
+      // Receipts are relative to the directory installed into, so installs into a cwd keep a ledger of their own.
+      workspaceIncarnation: reported && cwd ? cwdWorkspaceIncarnation(reported, cwd) : reported,
       shimGeneration,
       isLaunchCurrent: () =>
-        plane?.workspaceIncarnationFor?.(pod) === workspaceIncarnation &&
-        plane?.shimGenerationFor?.(pod) === shimGeneration
+        plane?.workspaceIncarnationFor?.(pod) === reported && plane?.shimGenerationFor?.(pod) === shimGeneration
     })
   }
 
```

**File**: `packages/daemon/src/execution/executor-plane.ts` (modified, +5/-4)
```diff
@@ -17,7 +17,7 @@ import { ShimFileSink } from '../shim/channels.js'
 import type { ShimTransport } from '../shim/client.js'
 import { ShimDialer } from '../shim/dialer.js'
 import { ShimGitRunner } from '../shim/git-exec.js'
-import { ClusterSkillClient } from '../shim/skill-client.js'
+import { ClusterSkillClient, cwdSkillRequester } from '../shim/skill-client.js'
 import type { ShimCapability } from '../shim/protocol.js'
 import { shimPaths } from '../shim/sandbox-paths.js'
 import type { ShimSession } from '../shim/session.js'
@@ -290,12 +290,13 @@ export class ExecutorPlane implements ExecutionPlane {
     return leaf === undefined || mount === undefined ? undefined : sessionHomeIn(sessionDirIn(mount, leaf))
   }
 
-  /** The skills seam over one session's shim, as the pool's is over a pod's; undefined until its channel is bound. */
-  skillClientFor(subject: string): ClusterSkillClient | undefined {
+  /** The skills seam over one session's shim, installing into the runtime's cwd (its checkout) when one is named; undefined until its channel is bound. */
+  skillClientFor(subject: string, cwd?: string): ClusterSkillClient | undefined {
     const session = this.boundSession(subject)
     if (!session?.hasCapability('skills')) return undefined
     return new ClusterSkillClient(
-      session,
+      // The shim's own root is the session directory, above the checkout the runtime scans for project skills.
+      cwd === undefined ? session : cwdSkillRequester(session, cwd),
       session.hasCapability('skills-wide'),
       false,
       session.hasCapability('skills-receipts')
```

**File**: `packages/daemon/src/k8s/runtime-plane.ts` (modified, +2/-1)
```diff
@@ -204,7 +204,8 @@ export interface K8sRuntimePlane extends ExecutionPlane {
   workspaceRootFor: (subject: string) => string | undefined
   /** The session directory of one confined session, in the coordinates of ITS pod (§11). */
   sessionDirFor: (agentId: string, leaf: string) => string
-  skillClientFor?: (subject: string) => ClusterSkillClient | undefined
+  /** `cwd` aims the installs at the runtime's checkout (a placed session); the pool's pods take none and install at their workspace root. */
+  skillClientFor?: (subject: string, cwd?: string) => ClusterSkillClient | undefined
   workspaceIncarnationFor?: (subject: string) => string | undefined
   shimGenerationFor?: (subject: string) => number | undefined
   /** Subjects this daemon holds a Sandbox for, and since when — the idle sweep's candidates. Read from
```

**File**: `packages/daemon/src/microsandbox/shim.ts` (modified, +2/-2)
```diff
@@ -7,7 +7,7 @@ import type { Sandbox } from 'microsandbox'
 import { z } from 'zod'
 import type { Logger } from '../log.js'
 import type { ShimSession } from '../shim/session.js'
-import { ClusterSkillClient } from '../shim/skill-client.js'
+import { ClusterSkillClient, cwdSkillRequester } from '../shim/skill-client.js'
 import { workspaceIncarnationOf } from '../skills/workspace-incarnation.js'
 import { DEFAULT_SHIM_RUNTIME_ROOT, SANDBOX_SKILL_STAGING_DIR } from '../shim/sandbox-paths.js'
 import {
@@ -80,7 +80,7 @@ export async function microsandboxSkillTarget(session: Pick<ShimSession, 'reques
   return {
     workspaceIncarnation: await workspaceIncarnationOf(cwd),
     client: new ClusterSkillClient(
-      { request: (capability, request, options) => session.request(capability, { cwd, request }, options) },
+      cwdSkillRequester(session, cwd),
       session.hasCapability('skills-wide'),
       true,
       session.hasCapability('skills-receipts')
```

**File**: `packages/daemon/src/shim/skill-client.ts` (modified, +6/-0)
```diff
@@ -30,6 +30,12 @@ import {
   type ClusterSkillVerifyReply
 } from './skill-protocol.js'
 
+/** A shim's skills seam aimed at `cwd` rather than the shim's own workspace root: the runtimes scan for project skills
+ *  from their cwd up to its repository root only, so bundles beside a checkout rather than in it are never found. */
+export function cwdSkillRequester(session: ShimRequester, cwd: string): ShimRequester {
+  return { request: (capability, request, options) => session.request(capability, { cwd, request }, options) }
+}
+
 export class ClusterSkillClient {
   /** `wide` mirrors the peer's `cluster-skills-v2` grant. */
   constructor(
```

**File**: `packages/daemon/src/skills/workspace-incarnation.ts` (modified, +7/-0)
```diff
@@ -8,3 +8,10 @@ export async function workspaceIncarnationOf(dir: string): Promise<string> {
   const identity = [await realpath(dir), String(stat.dev), String(stat.ino)]
   return `workspace:${createHash('sha256').update(JSON.stringify(identity)).digest('hex')}`
 }
+
+/** The ledger key for installs into `cwd` below a workspace whose identity is `incarnation`. */
+export function cwdWorkspaceIncarnation(incarnation: string, cwd: string): string {
+  return `workspace:${createHash('sha256')
+    .update(JSON.stringify([incarnation, cwd]))
+    .digest('hex')}`
+}
```

**File**: `packages/daemon/src/workspace/workspace-manager.ts` (modified, +10/-5)
```diff
@@ -533,18 +533,23 @@ export class WorkspaceManager {
   private async excludeInstalledSkills(agent: Agent, acpCwd: string, owned: string[]): Promise<void> {
     // Off-disk bundles live OUTSIDE the checkout and never dirty a worktree; worse, the shim would answer rev-parse with its own paths, which this local write would then create on daemon disk.
     if (this.offDisk({ agentId: agent.id, path: acpCwd })) return
+    await this.recordExcludedSkills(agent, acpCwd, owned, this.fsFor(agent.id))
+  }
+
+  /** A placed session's bundles are installed INTO its checkout on the executor, so its exclude file is written there, through the plane whose shim answered rev-parse. */
+  async excludePlacedSessionSkills(agent: Agent, acpCwd: string, owned: string[]): Promise<void> {
+    await this.recordExcludedSkills(agent, acpCwd, owned, this.fsFor(agent.id, { path: acpCwd }))
+  }
+
+  private async recordExcludedSkills(agent: Agent, acpCwd: string, owned: string[], fs: WorkspaceFs): Promise<void> {
     try {
       const git = this.runnerFor(agent.id, acpCwd).withEnv(workspaceGitLocalEnv())
       const [commonDir = '', checkoutRoot = ''] = (await git.raw(['rev-parse', '--git-common-dir', '--show-toplevel']))
         .split('\n')
         .map((line) => line.trim())
       if (commonDir === '' || checkoutRoot === '') return
       const roots = bundlePathsFromCheckoutRoot(checkoutRoot, acpCwd, owned)
-      await excludeManagedSkillBundles(
-        isAbsolute(commonDir) ? commonDir : join(acpCwd, commonDir),
-        roots,
-        this.fsFor(agent.id)
-      )
+      await excludeManagedSkillBundles(isAbsolute(commonDir) ? commonDir : join(acpCwd, commonDir), roots, fs)
     } catch (err) {
       // A from-scratch workspace has no repository to exclude in, and bookkeeping must not fail a launch.
       skillsLog.debug(`skills: could not record managed bundles as ignored: ${(err as Error).message}`)
```

---

### Incident Patch 4: `5b5f52e8` (2026-10-05)
**Commit Message**: fix(daemon): let a Codex first turn wait for slow MCP servers (#2800)

Codex builds a turn's tool list after waiting at most 1 s for MCP
servers that are still starting, and leaves the rest out of that turn.
A remote HTTP server that takes a second or more to answer `initialize`
therefore misses the first turn of every new or loaded session, and the
agent reports the tool as missing.

Every Codex spawn now sets `mcp_optional_startup_grace_ms` to 10 s in
CODEX_CONFIG, unless the runtime config already chose a value. The wait
ends as soon as the servers are ready; a server that never starts costs
the first turn at most the grace, after which the turn runs without it.
The setting is applied in AcpHost, so local and cluster launches both
receive it.

Refs #2770

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `packages/daemon/src/acp/acp-host.ts` (modified, +11/-2)
```diff
@@ -31,7 +31,7 @@ import {
   ULTRACODE_EFFORT
 } from '../runtime-defs/claude-runtime.js'
 import { isCodexRuntimeDef, runtimeExecutableHints } from '../runtime-defs/executable-hints.js'
-import { codexConfigWithUserInputTool } from '../runtimes/codex-config.js'
+import { codexConfigWithMcpStartupGrace, codexConfigWithUserInputTool } from '../runtimes/codex-config.js'
 import {
   LocalDriver,
   type AcpSandboxLaunch,
@@ -757,14 +757,23 @@ export class AcpHost {
           `signed-in account apps/connectors may be inherited${detail}`
       )
     }
+    const isCodex = this.opts.runtimeId === 'codex-acp' || isCodexRuntimeDef(this.runtime)
     // Codex offers `request_user_input` only when configured on; enable it exactly when this host services session elicitations.
-    if (this.opts.onElicit && (this.opts.runtimeId === 'codex-acp' || isCodexRuntimeDef(this.runtime))) {
+    if (this.opts.onElicit && isCodex) {
       try {
         env.CODEX_CONFIG = codexConfigWithUserInputTool(env.CODEX_CONFIG)
       } catch (err) {
         this.opts.log?.warn(`acp: leaving Codex's request_user_input tool off — ${(err as Error).message}`)
       }
     }
+    // Codex leaves an MCP server still starting after 1 s out of the turn, so a remote server misses the first turn.
+    if (isCodex) {
+      try {
+        env.CODEX_CONFIG = codexConfigWithMcpStartupGrace(env.CODEX_CONFIG)
+      } catch (err) {
+        this.opts.log?.warn(`acp: leaving Codex's MCP startup grace at its default — ${(err as Error).message}`)
+      }
+    }
     // The memory-backend env arrives in `opts.env` from memoryProviderFor at spawn; a host built without it keeps the runtime's default memory.
     // appendArgs carries any account-app-isolation flags (e.g. Copilot's
     // --disable-builtin-mcps) that must reach the adapter as CLI args.
```

**File**: `packages/daemon/src/runtimes/codex-config.ts` (modified, +10/-0)
```diff
@@ -82,6 +82,16 @@ export function codexConfigWithBaseUrlFillIn(raw: string | undefined, baseUrl: s
   return codexConfigWithBaseUrl(raw, baseUrl)
 }
 
+// How long a turn's tool list waits for a still-starting MCP server; Codex's own 1 s drops most remote HTTP servers from the first turn.
+export const CODEX_MCP_STARTUP_GRACE_MS = 10_000
+
+/** Sets Codex's optional-MCP startup grace unless the caller's CODEX_CONFIG already chose one. */
+export function codexConfigWithMcpStartupGrace(raw: string | undefined): string {
+  const config = objectFromJson(raw, 'CODEX_CONFIG')
+  if (config.mcp_optional_startup_grace_ms !== undefined) return JSON.stringify(config)
+  return JSON.stringify({ ...config, mcp_optional_startup_grace_ms: CODEX_MCP_STARTUP_GRACE_MS })
+}
+
 // Codex offers `request_user_input` — the only path from a Codex turn to our ACP form elicitation — in
 // Default mode only behind this feature; verified against @openai/codex-linux-x64 bundled with
 // codex-acp@1.10.0 (the `[tools] experimental_request_user_input` knob alone changes nothing there).
```

**File**: `packages/daemon/test/acp-host.test.ts` (modified, +27/-5)
```diff
@@ -13,6 +13,7 @@ import {
   turnFailureReason
 } from '../src/acp/acp-host.js'
 import { RuntimeSessionFailure, sessionFailureFromMeta } from '../src/acp/session-failure.js'
+import { CODEX_MCP_STARTUP_GRACE_MS } from '../src/runtimes/codex-config.js'
 
 const here = dirname(fileURLToPath(import.meta.url))
 const fakeAgent = join(here, 'fixtures', 'fake-acp-agent.mjs')
@@ -597,7 +598,8 @@ describe('AcpHost — account-bound app isolation', () => {
     const echoed = out.find((line) => line.startsWith('env:'))?.slice('env:'.length)
     expect(JSON.parse(echoed ?? '')).toEqual({
       model: 'gpt-test',
-      features: { fast_mode: true, apps: false }
+      features: { fast_mode: true, apps: false },
+      mcp_optional_startup_grace_ms: CODEX_MCP_STARTUP_GRACE_MS
     })
   })
 
@@ -609,7 +611,10 @@ describe('AcpHost — account-bound app isolation', () => {
     })
 
     const echoed = out.find((line) => line.startsWith('env:'))?.slice('env:'.length)
-    expect(JSON.parse(echoed ?? '')).toEqual({ features: { apps: false } })
+    expect(JSON.parse(echoed ?? '')).toEqual({
+      features: { apps: false },
+      mcp_optional_startup_grace_ms: CODEX_MCP_STARTUP_GRACE_MS
+    })
     expect(warns.join('\n')).toContain('ignoring unsafe inherited CODEX_CONFIG')
   })
 
@@ -620,15 +625,28 @@ describe('AcpHost — account-bound app isolation', () => {
     const echoed = out.find((line) => line.startsWith('env:'))?.slice('env:'.length)
     expect(JSON.parse(echoed ?? '')).toEqual({
       model: 'gpt-test',
-      features: { apps: false, default_mode_request_user_input: true }
+      features: { apps: false, default_mode_request_user_input: true },
+      mcp_optional_startup_grace_ms: CODEX_MCP_STARTUP_GRACE_MS
     })
   })
 
   it('leaves it off for a headless Codex host that would decline the question', async () => {
     const out = await runIsolatedFixture('codex-acp', 'CODEX_CONFIG', JSON.stringify({ model: 'gpt-test' }))
 
     const echoed = out.find((line) => line.startsWith('env:'))?.slice('env:'.length)
-    expect(JSON.parse(echoed ?? '')).toEqual({ model: 'gpt-test', features: { apps: false } })
+    expect(JSON.parse(echoed ?? '')).toEqual({
+      model: 'gpt-test',
+      features: { apps: false },
+      mcp_optional_startup_grace_ms: CODEX_MCP_STARTUP_GRACE_MS
+    })
+  })
+
+  it('keeps a Codex MCP startup grace the runtime config already chose', async () => {
+    const raw = JSON.stringify({ mcp_optional_startup_grace_ms: 0 })
+    const out = await runIsolatedFixture('codex-acp', 'CODEX_CONFIG', raw)
+
+    const echoed = out.find((line) => line.startsWith('env:'))?.slice('env:'.length)
+    expect(JSON.parse(echoed ?? '')).toEqual({ features: { apps: false }, mcp_optional_startup_grace_ms: 0 })
   })
 
   it('forces Claude.ai MCP servers off in the spawned process', async () => {
@@ -654,7 +672,11 @@ describe('AcpHost — account-bound app isolation', () => {
     )
 
     const echoed = out.find((line) => line.startsWith('env:'))?.slice('env:'.length)
-    expect(JSON.parse(echoed ?? '')).toEqual({ model: 'gpt-test', features: { apps: true } })
+    expect(JSON.parse(echoed ?? '')).toEqual({
+      model: 'gpt-test',
+      features: { apps: true },
+      mcp_optional_startup_grace_ms: CODEX_MCP_STARTUP_GRACE_MS
+    })
     expect(warns.join('\n')).toContain('account-app isolation disabled by daemon config')
   })
 
```

**File**: `packages/daemon/test/codex-config.test.ts` (modified, +28/-0)
```diff
@@ -1,6 +1,8 @@
 import { describe, expect, it } from 'vitest'
 import {
   CODEX_DEFAULT_ENDPOINT,
+  CODEX_MCP_STARTUP_GRACE_MS,
+  codexConfigWithMcpStartupGrace,
   codexConfigWithUserInputTool,
   codexGatewayAuthRequest
 } from '../src/runtimes/codex-config.js'
@@ -46,3 +48,29 @@ describe('codexConfigWithUserInputTool', () => {
     )
   })
 })
+
+describe('codexConfigWithMcpStartupGrace', () => {
+  it('raises the grace a first turn waits for a still-starting MCP server', () => {
+    expect(JSON.parse(codexConfigWithMcpStartupGrace(undefined))).toEqual({
+      mcp_optional_startup_grace_ms: CODEX_MCP_STARTUP_GRACE_MS
+    })
+  })
+
+  it('keeps every other field', () => {
+    const raw = JSON.stringify({ model: 'gpt-test', features: { apps: false } })
+    expect(JSON.parse(codexConfigWithMcpStartupGrace(raw))).toEqual({
+      model: 'gpt-test',
+      features: { apps: false },
+      mcp_optional_startup_grace_ms: CODEX_MCP_STARTUP_GRACE_MS
+    })
+  })
+
+  it('leaves a grace the caller already chose', () => {
+    const raw = JSON.stringify({ mcp_optional_startup_grace_ms: 0 })
+    expect(JSON.parse(codexConfigWithMcpStartupGrace(raw))).toEqual({ mcp_optional_startup_grace_ms: 0 })
+  })
+
+  it('rejects a malformed config rather than silently dropping it', () => {
+    expect(() => codexConfigWithMcpStartupGrace('not-json')).toThrow('CODEX_CONFIG must be a valid JSON object')
+  })
+})
```

---

### Incident Patch 5: `24b28741` (2026-10-05)
**Commit Message**: fix(daemon): run a sandbox git credential helper through sh (#2799)

#2794 ships dist/bin/git-credential with the daemon, but npm packs every non-bin
file as 0644 and only the CLI's repairDaemonBundleModes restores modes. The CLI is
installed separately and not upgraded with the daemon, so on rc.41 git still fails,
now with 'Permission denied'. Reading the helper with sh makes its mode irrelevant.

**File**: `docs/designs/daemon-sandbox-backends.md` (modified, +2/-1)
```diff
@@ -1163,7 +1163,8 @@ network listener.
   directory that holds `shim/index.js`, which resolves the MCP bridge, the
   merge-when-ready watcher, the `gh` token entry and the git-credential wrapper
   (`bin/git-credential`, emitted by the build beside `shim/`) from the daemon's own
-  bundle. The `gh` wrapper directory and the DeepSeek preset have no counterpart
+  bundle. Git runs a sandbox helper through `sh`, because npm ships that wrapper
+  without its executable bit. The `gh` wrapper directory and the DeepSeek preset have no counterpart
   in an installation; the launcher reports them in `missingHelpers` rather than
   naming a path that is not there.
 
```

**File**: `packages/daemon/src/workspace/git-injection.ts` (modified, +4/-1)
```diff
@@ -609,7 +609,10 @@ export function gitCredentialEnv(
 
 function quotedHelper(agentId: string, target: GitCredentialTarget = targetOf(agentId)): string {
   const { helper } = target
-  return `!'${helper.replaceAll("'", "'\\''")}' ${agentId}`
+  const quoted = `'${helper.replaceAll("'", "'\\''")}'`
+  // A sandbox helper is read by `sh` rather than executed, so its mode does not matter: npm packs every non-`bin`
+  // file as 0644, and the installed CLI that would restore the bit is not upgraded along with the daemon.
+  return target.kind === 'sandbox' ? `!sh ${quoted} ${agentId}` : `!${quoted} ${agentId}`
 }
 
 /** The three host-scoped config pairs both channels share. The host defaults to
```

**File**: `packages/daemon/test/git-injection.test.ts` (modified, +34/-4)
```diff
@@ -23,6 +23,7 @@ import {
   workspaceGitRemoteTarget,
   writeRepoHelperConfig
 } from '../src/workspace/git-injection.js'
+import { INSTALLATION_GIT_CREDENTIAL_WRAPPER } from '../src/shim/git-credential-wrapper.js'
 import { SANDBOX_GIT_CONFIG_DIR, SANDBOX_GIT_CREDENTIAL_HELPER } from '../src/shim/sandbox-paths.js'
 import { SANDBOX_TUNNEL_PATHS } from '../src/shim/tunnel.js'
 
@@ -78,10 +79,13 @@ beforeAll(() => {
   initGitInjection({
     // Per agent, as the daemon's own resolver is: an agent whose git runs in a pod gets the
     // image's paths, and one that runs here gets this daemon's. `pod-` ids pick the former.
+    // `installed-` ids get a daemon installation as their helper root, as the host and srt strategies do.
     targetFor: (agentId) =>
       agentId.startsWith('pod-')
         ? sandboxGitCredentialTarget()
-        : daemonGitCredentialTarget({ shimPath: join(tmpRun, 'helper.sh'), runDir: tmpRun }),
+        : agentId.startsWith('installed-')
+          ? sandboxGitCredentialTarget(join(tmpRun, 'hs'), join(tmpRun, 'installation'))
+          : daemonGitCredentialTarget({ shimPath: join(tmpRun, 'helper.sh'), runDir: tmpRun }),
     preWarm: async () => undefined,
     capabilityFor: (agentId) => `cap-${agentId}`
   })
@@ -829,7 +833,7 @@ describe.skipIf(process.platform === 'win32')('pointers for an agent whose git r
     const pairs = configPairs(cloneGitEnv('pod-agent', 'https://github.com/acme/repo.git'))
     expect(pairs).toContainEqual([
       'credential.https://github.com.helper',
-      `!'${SANDBOX_GIT_CREDENTIAL_HELPER}' pod-agent`
+      `!sh '${SANDBOX_GIT_CREDENTIAL_HELPER}' pod-agent`
     ])
     // The helper has no daemon root to derive a socket from, so the tunnel's path travels with it.
     expect(cloneGitEnv('pod-agent')[GITCRED_SOCKET_ENV]).toBe(SANDBOX_TUNNEL_PATHS.gitcred)
@@ -866,7 +870,7 @@ describe.skipIf(process.platform === 'win32')('pointers for an agent whose git r
     expect(pod.path).toBe(`${SANDBOX_GIT_CONFIG_DIR}/agent-1.gitconfig`)
     expect(pod.env.GIT_CONFIG_GLOBAL).toBe(pod.path)
     expect(pod.env[GITCRED_SOCKET_ENV]).toBe(SANDBOX_TUNNEL_PATHS.gitcred)
-    expect(pod.content).toContain(`!'${SANDBOX_GIT_CREDENTIAL_HELPER}' agent-1`)
+    expect(pod.content).toContain(`!sh '${SANDBOX_GIT_CREDENTIAL_HELPER}' agent-1`)
     expect(pod.content).not.toContain(homedir())
   })
 
@@ -877,6 +881,32 @@ describe.skipIf(process.platform === 'win32')('pointers for an agent whose git r
     expect(existsSync(join(SANDBOX_GIT_CONFIG_DIR, 'pod-agent.gitconfig'))).toBe(false)
   })
 
+  it('runs an installation helper that npm shipped without its executable bit', () => {
+    // npm packs every non-`bin` file as 0644 and only the CLI restores modes, so a daemon installation's
+    // `bin/git-credential` arrives non-executable on any host whose CLI predates the fix.
+    const installation = join(tmpRun, 'installation')
+    mkdirSync(join(installation, 'bin'), { recursive: true })
+    mkdirSync(join(installation, 'shim'), { recursive: true })
+    writeFileSync(join(installation, 'bin', 'git-credential'), INSTALLATION_GIT_CREDENTIAL_WRAPPER)
+    chmodSync(join(installation, 'bin', 'git-credential'), 0o644)
+    // A stand-in for the built helper bundle that echoes its argv back as the password.
+    writeFileSync(
+      join(installation, 'shim', 'git-credential.js'),
+      "process.stdout.write(`username=x-access-token\\npassword=${process.argv.slice(2).join('+')}\\n`)\n"
+    )
+    const out = execFileSync('git', ['credential', 'fill'], {
+      input: 'protocol=https\nhost=github.com\npath=acme/repo.git\n\n',
+      encoding: 'utf8',
+      env: {
+        PATH: process.env.PATH ?? '',
+        HOME: tmpRun,
+        GIT_TERMINAL_PROMPT: '0',
+        ...cloneGitEnv('installed-agent', 'https://github.com/acme/repo.git')
+      }
+    })
+    expect(out).toContain('password=installed-agent+get')
+  })
+
   it('writes the repo-local helper in the coordinates of the git that will read it', async () => {
     const argv: string[][] = []
     const runner = {
@@ -893,7 +923,7 @@ describe.skipIf(process.platform === 'win32')('pointers for an agent whose git r
       'config',
       '--add',
       'credential.https://github.com.helper',
-      `!'${SANDBOX_GIT_CREDENTIAL_HELPER}' pod-agent`
+      `!sh '${SANDBOX_GIT_CREDENTIAL_HELPER}' pod-agent`
     ])
   })
 })
```

---

### Incident Patch 6: `3c42dc96` (2026-10-04)
**Commit Message**: fix(daemon): stop retention failing forever on an agent pod with no primary checkout (#2796)

Retention judged a session's legacy worktrees against the agent's primary
checkout even on a volume that never received it, which is the normal state
of a pool agent whose sessions all run in pods of their own. Git was asked to
run in a directory that does not exist, the cleanup failed, and the session
was kept and its pods woken again on every hourly pass.

A root without a checkout now owns no worktree, the rule secondary roots
already followed. A Dream row is no longer judged at all: its runner works in
its own staging and never prepares a session workspace, so no pod is woken to
look for one.

Refs #2780

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `docs/designs/git-workspace-model.md` (modified, +4/-1)
```diff
@@ -492,7 +492,10 @@ markers say is due, or the one-time moves above for a session or clone that
 predates its own record. A worktree a session left on the agent pod before this
 tier is judged by retention only while the agent pod is bound, never woken for it,
 unless the session has no pod of its own, whose workspace can only be there; a row
-that goes first leaves such a worktree in place, unjudged and never removed.
+that goes first leaves such a worktree in place, unjudged and never removed. An agent
+pod that never received the primary checkout — its agent's sessions all ran in pods of
+their own — holds no such worktree, so retention reads that root as absent instead of
+running Git where there is no repository.
 
 **Every Git of this tier runs inside the pod's closed inventory.** On a pool
 member the daemon does not spawn Git at all: each invocation crosses the shim's
```

**File**: `packages/daemon/src/daemon.ts` (modified, +2/-0)
```diff
@@ -21147,6 +21147,8 @@ export class Daemon {
 
   /** Whether retention has a directory of this session's to judge: its on-demand clones beside the agent's roots (decision 20) — recorded on its row once handed, so later rows cannot hide them — shared or not, else an isolated one's worktrees or clones. */
   private sessionMayOwnDirectories(agent: Agent, rec: SessionRecord): boolean {
+    // A Dream works in its runner's staging and never prepares a session workspace, so no pod is woken to judge one.
+    if (rec.platform === 'dream') return false
     if (rec.onDemandClones === 1 || this.workspaces.mayOwnOnDemandClones(agent, rec.key)) return true
     return rec.workspaceIsolation !== 'shared' && this.workspaces.mayOwnSessionWorktrees(agent)
   }
```

**File**: `packages/daemon/src/workspace/workspace-manager.ts` (modified, +7/-7)
```diff
@@ -1831,16 +1831,16 @@ export class WorkspaceManager {
     return join(root.worktreesPath, this.sessionWorktreeId(sessionKey))
   }
 
-  /** Every root that can hold a per-session worktree: the primary when there is one, plus every
-   *  MATERIALIZED secondary subtree on disk — a retired root's worktrees are this session's too
-   *  (decision 12), while a subtree a failed clone left behind owns none and has no checkout for
-   *  Git to run in, which would fail the whole session's cleanup forever. */
+  /** Every root on this volume with a checkout, retired secondaries included (decision 12); one without — a failed clone, a pod never given the primary — owns no worktree and leaves Git nowhere to run. */
   async sessionWorktreeRoots(agent: Agent): Promise<SessionRootLocator[]> {
     const fs = this.fsFor(agent.id)
-    const roots: SessionRootLocator[] = agent.workspace.mode === 'git-repo' ? [this.primaryLocator(agent)] : []
+    const candidates: SessionRootLocator[] = agent.workspace.mode === 'git-repo' ? [this.primaryLocator(agent)] : []
     for (const { path, worktreesPath, subtreeName } of await this.secondarySubtreesFor(agent)) {
-      if ((await fs.stat(join(path, '.git'))) === 'missing') continue
-      roots.push({ path, worktreesPath, subtreeName })
+      candidates.push({ path, worktreesPath, subtreeName })
+    }
+    const roots: SessionRootLocator[] = []
+    for (const root of candidates) {
+      if ((await fs.stat(join(root.path, '.git'))) !== 'missing') roots.push(root)
     }
     return roots
   }
```

**File**: `packages/daemon/test/daemon-lifecycle.test.ts` (modified, +35/-0)
```diff
@@ -3244,6 +3244,41 @@ describe('Daemon session retention GC (#485)', () => {
     await daemon.stop()
   })
 
+  it('purges an expired Dream row without judging a directory, since its runner never prepares one', async () => {
+    const clock = new FakeClock()
+    const daemon = new Daemon({
+      slackAppFactory: fakeSlackAppFactory(),
+      root: scaffold(),
+      hostFactory: () => quietHost() as any,
+      clock
+    })
+    await daemon.start()
+    await sweepRetention(daemon)
+    // An agent that may own worktrees, so only the Dream rule keeps the row out of the directory judgement.
+    vi.spyOn((daemon as any).workspaces, 'mayOwnSessionWorktrees').mockReturnValue(true)
+    const judge = vi.spyOn(daemon as any, 'judgeSessionDirectories')
+    await (daemon as any).store.upsertSession({
+      key: 'dream:memory:drm-1:bot-a',
+      agentId: 'bot-a',
+      platform: 'dream',
+      channel: 'memory',
+      thread: 'drm-1',
+      acpSessionId: 'acp-dream',
+      state: 'idle',
+      lastDeliveredTs: null,
+      updatedAt: 0
+    })
+
+    clock.advance(8 * 24 * 3_600_000)
+    await vi.waitFor(
+      async () => expect(await (daemon as any).store.getSession('dream:memory:drm-1:bot-a')).toBeUndefined(),
+      WAIT
+    )
+    expect(judge).not.toHaveBeenCalled()
+
+    await daemon.stop()
+  })
+
   it('keeps the session row until VM destruction succeeds, retries the next sweep, then collects images', async () => {
     const daemon = new Daemon({
       slackAppFactory: fakeSlackAppFactory(),
```

**File**: `packages/daemon/test/workspace-secondary-roots.test.ts` (modified, +8/-0)
```diff
@@ -1745,6 +1745,14 @@ describe('removeSessionWorktree across every root (decision 4)', () => {
     expect(await workspaces.removeSessionWorktree(agent, 'session-a')).toEqual({ outcome: 'removed' })
   })
 
+  it('ignores a primary checkout this volume never received instead of failing the whole cleanup', async () => {
+    // A pool agent pod whose sessions all ran in pods of their own never clones the primary.
+    const agent = agentFixture([])
+
+    expect(await workspaces.hasSessionWorktreeRoots(agent)).toBe(false)
+    expect(await workspaces.removeSessionWorktree(agent, 'session-a', 'worktrees')).toEqual({ outcome: 'absent' })
+  })
+
   it('removes a scratch agent’s secondary worktrees, which have no primary beside them', async () => {
     const agent = agentFixture([{ repoFullName: 'acme/infra', repoId: '42' }], { mode: 'from-scratch' })
     serveAll(agent, { 'acme/infra': 'trunk' })
```

---

### Incident Patch 7: `fb733e4f` (2026-10-04)
**Commit Message**: fix(daemon): idle sweep takes over running pods no launch tracks (#2797)

A member owns a pod's idleness only once it records a launch for it, and it
records one only when it launches the pod or when a duty gain re-derives the
agent's pods from the cluster. A pod that comes up after that read, such as a
fenced acquisition's pod, or one a release leaves without a duty change to
follow, stays Running with no member examining it.

Every ten minutes the idle sweep now lists the namespace's Sandboxes and takes
over each Running pod of an agent this member holds that no launch records,
through the same claim -> Sandbox -> mode takeover a duty gain uses. Agents whose
duty-gain takeover is still running or retrying are left to it, a daemon outside
a member set never does this, and a Role without list on Sandboxes is reported
once.

Every sweep skip was logged at debug only, so a pod held up by a busy lease, an
in-use session, a hold or a duty elsewhere looked the same as one the sweep never
saw. A pod still up after four idle timeouts now has its skip reason logged at
info, at most once an hour.

Refs #2780

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `docs/designs/k8s-daemon-pool.md` (modified, +10/-0)
```diff
@@ -262,6 +262,16 @@ not yet recorded locally. Takeover deduplication is scoped to the current owners
 fence: regaining an agent starts a new attempt without reusing the departed ownership's
 promise.
 
+A duty gain is not the only takeover. Every ten minutes the idle sweep also lists
+the namespace's Sandboxes and takes over each Running pod of an agent this member
+holds that no launch records — one that came up after the takeover read its claim,
+such as a fenced acquisition's pod, or one a release left without a duty change to
+follow. An agent whose duty-gain takeover is still running or retrying is left to
+it, and a member outside a member set never does this, since before its first
+authentication it cannot tell its agents from a peer's. A pod the sweep still skips
+after four idle timeouts has the reason logged at info once an hour, so a pod that
+never suspends names what holds it.
+
 Before publishing a launch, the member stamps its durable binding generation onto
 the Sandbox's `agentconnect.md/launch-generation` annotation. A resourceVersion CAS
 prevents an older allocation from overwriting a successor. Every suspend or resume
```

**File**: `packages/daemon/src/daemon.ts` (modified, +55/-5)
```diff
@@ -924,6 +924,8 @@ import {
   FEISHU_STREAM_FLUSH_MS,
   SLACK_STREAM_FLUSH_MS,
   IDLE_FLUSH_MS,
+  LONG_IDLE_SKIP_AFTER_TTLS,
+  LONG_IDLE_SKIP_REPORT_INTERVAL_MS,
   MAX_BG_TASK_WAKE_REARMS,
   MAX_BG_TASK_WAKES_PER_SESSION,
   MAX_DRAIN_TEXT_CHARS,
@@ -933,7 +935,8 @@ import {
   MAX_TURN_CONTEXT_REGENERATION_MS,
   MAX_TURN_CONTEXT_REGENERATIONS,
   PROBE_ROOT_SWEEP_INTERVAL_MS,
-  SESSION_RETENTION_SWEEP_INTERVAL_MS
+  SESSION_RETENTION_SWEEP_INTERVAL_MS,
+  UNTRACKED_SANDBOX_ADOPTION_INTERVAL_MS
 } from './daemon/constants.js'
 import {
   observeStartup,
@@ -1798,6 +1801,11 @@ export class Daemon {
   private lastProbeRootSweepAt = 0
   // Last session-retention GC pass (#485); rides the idle sweep at its own cadence.
   private lastSessionRetentionSweepAt = 0
+  // Last look for Running pods no launch here tracks, and the one still in flight, off the sweep's critical path.
+  private lastUntrackedSandboxAdoptionAt = 0
+  private untrackedSandboxAdoption?: Promise<void>
+  // When each long-quiet pod's skip reason was last logged at info, per subject.
+  private readonly longIdleSkipReportedAt = new Map<string, number>()
   // Single-flight for the retention pass — a slow git cleanup must not overlap
   // the next sweep's pass (the sweep itself is synchronous, the GC is not).
   private sessionRetentionSweepInFlight = false
@@ -21873,11 +21881,15 @@ export class Daemon {
     for (const [agentId, running] of this.k8sAdoptions) {
       if (!running) this.adoptClusterSandbox(agentId)
     }
+    this.adoptUntrackedSandboxes(plane, now)
     const launched = plane.launched()
     this.log.debug(`idle: examining ${launched.length} held sandbox launch(es)`)
+    const held = new Set(launched.map(({ subject }) => subject))
+    for (const subject of this.longIdleSkipReportedAt.keys()) {
+      if (!held.has(subject)) this.longIdleSkipReportedAt.delete(subject)
+    }
     const sessionActivity = new Map<string, Map<string, number>>()
     for (const { subject, agentId, since } of launched) {
-      const skip = (reason: string): void => this.log.debug(`idle: skipping sandbox "${subject}" — ${reason}`)
       const leaf = sandboxSubjectSessionLeaf(subject)
       let activity: number | null
       if (leaf === undefined) {
@@ -21896,6 +21908,10 @@ export class Daemon {
         }
         activity = sessions.get(leaf) ?? null
       }
+      // Shared-store activity, floored at when this member took the launch: a full window, not epoch-idle.
+      const last = Math.max(activity ?? 0, since)
+      const quiet = now - last > ttl
+      const skip = (reason: string): void => this.reportIdleSkip(subject, reason, now - last, ttl, now)
       // Recheck duty and admission after reading the store, before asking the pod to suspend.
       if (this.dutyCoordinator.dutyEnforced() && !this.duties.holdsAgent(agentId)) {
         skip('duty held elsewhere')
@@ -21906,9 +21922,6 @@ export class Daemon {
         skip(inUse)
         continue
       }
-      // Shared-store activity, floored at when this member took the launch: a full window, not epoch-idle.
-      const last = Math.max(activity ?? 0, since)
-      const quiet = now - last > ttl
       // A lease on THIS pod defers the suspend: an open page's dirty volume or armed watcher, or this daemon's own on a watcher it saw armed; each lapses within one TTL (§11).
       if (this.sandboxHolds.holds(subject)) {
         skip(`held by ${this.sandboxHolds.reasons(subject).join(', ')}`)
@@ -21930,6 +21943,43 @@ export class Daemon {
     }
   }
 
+  /** One sweep skip, at debug unless the pod has stayed quiet several timeouts, when it is logged at info once an hour so a pod that never suspends names what holds it. */
+  private reportIdleSkip(subject: string, reason: string, quietMs: number, ttl: number, now: number): void {
+    const reportedAt = this.longIdleSkipReportedAt.get(subject)
+    if (
+      quietMs <= LONG_IDLE_SKIP_AFTER_TTLS * ttl ||
+      (reportedAt !== undefined && now - reportedAt < LONG_IDLE_SKIP_REPORT_INTERVAL_MS)
+    ) {
+      this.log.debug(`idle: skipping sandbox "${subject}" — ${reason}`)
+      return
+    }
+    this.longIdleSkipReportedAt.set(subject, now)
+    this.log.info(
+      `idle: the sandbox "${subject}" is still up after ${Math.round(quietMs / 60_000)} min without recorded activity — ${reason}`
+    )
+  }
+
+  /** Take over Running pods no launch here tracks, at most once per interval and never awaited, since otherwise only a duty change would. */
+  private adoptUntrackedSandboxes(plane: K8sRuntimePlane, now: number): void {
+    // Duty alone decides, as at a duty gain: before its first auth a member cannot tell its agents from a peer's.
+    if (!this.dutyCoordinator.dutyEnforced() || this.duties.agents().size === 0) return
+    if (this.untrackedSandboxAdoption) return
+    if (now - this.lastUntrackedSandboxAdoptionAt < UNTRACKED_SANDBOX_ADOPTION_INTERVAL_MS) return
+    this.lastUntrackedSandboxAdoptionAt = now

```

**File**: `packages/daemon/src/daemon/constants.ts` (modified, +7/-0)
```diff
@@ -27,6 +27,13 @@ export const PROBE_ROOT_SWEEP_INTERVAL_MS = 60_000
  *  expired rows and may run several git commands per candidate. */
 export const SESSION_RETENTION_SWEEP_INTERVAL_MS = 60 * 60_000
 
+// How often the idle sweep looks for Running pods no launch here tracks, which a duty change alone would re-adopt.
+export const UNTRACKED_SANDBOX_ADOPTION_INTERVAL_MS = 10 * 60_000
+
+// A pod quiet for this many idle timeouts yet still up has its skip reason logged at info, once per interval.
+export const LONG_IDLE_SKIP_AFTER_TTLS = 4
+export const LONG_IDLE_SKIP_REPORT_INTERVAL_MS = 60 * 60_000
+
 /** Receipts per `event/session-purged` frame. Matches the protocol schema's cap,
  *  which sits far under the frame budget (a batch of ACP ids is tiny). */
 export const MAX_SESSION_PURGE_BATCH = 200
```

**File**: `packages/daemon/src/k8s/driver.ts` (modified, +30/-0)
```diff
@@ -86,6 +86,8 @@ export class K8sDriver implements SpawnDriver {
   private readonly clock: Clock
   /** So a Role without `patch` on claims says so once, not on every admission it degrades. */
   private stampRefusalReported = false
+  /** So a Role without `list` on Sandboxes says so once, not on every sweep that looks for untracked pods. */
+  private sandboxListRefusalReported = false
 
   constructor(private readonly deps: K8sDriverDeps) {
     this.clock = deps.clock ?? systemClock
@@ -356,6 +358,34 @@ export class K8sDriver implements SpawnDriver {
     return adopted
   }
 
+  /** Take over every Running pod of an agent `serves` admits that no launch here tracks — otherwise only a duty change would. */
+  async adoptUntracked(serves: (agentId: string) => boolean): Promise<SandboxSubject[]> {
+    const sandboxes = await this.deps.api.listSandboxes().catch((err: unknown) => {
+      if (!(err instanceof K8sApiError) || err.status !== 403) throw err
+      if (!this.sandboxListRefusalReported)
+        this.deps.log.warn(`cluster: listing sandboxes is not permitted — only a duty change takes over a running pod`)
+      this.sandboxListRefusalReported = true
+      return []
+    })
+    const adopted: SandboxSubject[] = []
+    for (const sandbox of sandboxes) {
+      if ((sandbox.spec?.operatingMode ?? 'Running') !== 'Running') continue
+      const labels = sandbox.spec?.podTemplate?.metadata?.labels
+      const agentId = labels?.[AC_LABEL_AGENT]
+      if (!agentId || !serves(agentId)) continue
+      const leaf = labels?.[AC_LABEL_SESSION]
+      const subject = leaf ? sessionSandboxSubject(agentId, leaf) : agentSandboxSubject(agentId)
+      if (this.ownedLaunch(subject)) continue
+      // Adoption reads the claim, so a Sandbox its claim no longer names is left for the orphan reconciler.
+      const launch = await this.adopt(subject).catch((err: unknown) => {
+        this.deps.log.warn(`cluster: could not take over the running sandbox ${subject} — ${(err as Error).message}`)
+        return undefined
+      })
+      if (launch) adopted.push(subject)
+    }
+    return adopted
+  }
+
   /** The subjects of every session claim the cluster holds for the agent, whether or not this member launched them. */
   async sessionClaimSubjects(agentId: string): Promise<SandboxSubject[]> {
     const claims = await this.deps.api.listClaims(`${AC_LABEL_AGENT}=${agentId},${AC_LABEL_SESSION}`)
```

**File**: `packages/daemon/src/k8s/runtime-plane.ts` (modified, +3/-0)
```diff
@@ -212,6 +212,8 @@ export interface K8sRuntimePlane extends ExecutionPlane {
   launched: () => Array<{ subject: SandboxSubject; agentId: string; since: number }>
   /** Take over an agent's pods from the cluster (claim → Sandbox → mode) so this member can suspend them. */
   adoptAgent: (agentId: string) => Promise<void>
+  /** Take over the Running pods of agents `serves` admits that no launch here tracks; resolves the subjects it took. */
+  adoptUntracked: (serves: (agentId: string) => boolean) => Promise<string[]>
   /** No longer served here: launches, channels, tunnels and loss watches of every pod of the agent go; claims and volumes stay. */
   releaseAgent: (agentId: string) => void
   /** Stop every pod of an agent this member is handing over, keeping the claims and volumes. What
@@ -558,6 +560,7 @@ export async function startK8sRuntimePlane(options: K8sRuntimePlaneOptions): Pro
       // orphan sweep's version fence would have nothing to refuse a collection in flight with.
       await driver.markServed(agentId)
     },
+    adoptUntracked: (serves) => driver.adoptUntracked(serves),
     releaseAgent,
     suspendAgent: async (agentId) => {
       // Adoption records only Running pods and creates nothing, so this wakes none and skips the rest.
```

**File**: `packages/daemon/test/daemon-k8s-mode.test.ts` (modified, +98/-0)
```diff
@@ -9,6 +9,11 @@ import {
   RUNTIME_PROBE_FEATURE
 } from '@agentconnect.md/protocol'
 import { Daemon } from '../src/daemon.js'
+import {
+  LONG_IDLE_SKIP_AFTER_TTLS,
+  LONG_IDLE_SKIP_REPORT_INTERVAL_MS,
+  UNTRACKED_SANDBOX_ADOPTION_INTERVAL_MS
+} from '../src/daemon/constants.js'
 import { agentHostKey, sessionHostKey, sessionKeyDirName } from '../src/acp/host-key.js'
 import { wireWorkspacePlane } from '../src/execution/plane.js'
 import { SANDBOX_HOLD_TTL_MS, SandboxHolds } from '../src/k8s/sandbox-hold.js'
@@ -127,6 +132,7 @@ function daemon(opts: {
               workspacesOffDisk: true,
               gitRunnerFor: () => undefined,
               launched: () => [],
+              adoptUntracked: async () => [],
               armedIn: async () => false,
               suspendIdle: async () => 'absent',
               suspendStalled: async () => 'absent',
@@ -1020,6 +1026,98 @@ describe('daemon --k8s mode', () => {
     }
   })
 
+  it('takes over a running pod no launch here tracks, only for agents whose duty it holds and once per interval', async () => {
+    const adoptUntracked = vi.fn(async (_serves: (agentId: string) => boolean) => ['held:session-x'])
+    const k8sDaemon = daemon({ root: root(), k8s: true, plane: { adoptUntracked } })
+    try {
+      await k8sDaemon.start()
+      const inner = k8sDaemon as any
+      const info = vi.spyOn(inner.log, 'info')
+      const ttl = inner.cfg.limits.agentIdleTimeoutMs
+      const now = Date.now()
+      // Outside a member set nothing tells this member's agents from a peer's.
+      await inner.sweepIdleSandboxes(now, ttl)
+      expect(adoptUntracked).not.toHaveBeenCalled()
+      inner.cpClient = {
+        organizationScope: () => 'frame',
+        memberSet: () => ({ setId: '9f11e5e7-0000-4000-8000-000000000001', name: 'Cloud' }),
+        stop: async () => {}
+      }
+      inner.duties.applyGrant([
+        {
+          groupId: '11111111-1111-4111-8111-111111111111',
+          orgId: 'org-1',
+          term: '1',
+          members: [{ kind: 'agent', refId: 'held' }]
+        }
+      ])
+      await inner.sweepIdleSandboxes(now, ttl)
+      await vi.waitFor(() =>
+        expect(info).toHaveBeenCalledWith(
+          'idle: took over the running sandbox "held:session-x", which no launch here tracked'
+        )
+      )
+      await vi.waitFor(() => expect(inner.untrackedSandboxAdoption).toBeUndefined())
+      const serves = adoptUntracked.mock.calls[0]![0]
+      expect([serves('held'), serves('moved')]).toEqual([true, false])
+      // A duty-gain takeover still running or retrying keeps its agent.
+      inner.k8sAdoptions.set('held', undefined)
+      expect(serves('held')).toBe(false)
+      inner.k8sAdoptions.delete('held')
+      await inner.sweepIdleSandboxes(now + UNTRACKED_SANDBOX_ADOPTION_INTERVAL_MS - 1, ttl)
+      expect(adoptUntracked).toHaveBeenCalledOnce()
+      await inner.sweepIdleSandboxes(now + UNTRACKED_SANDBOX_ADOPTION_INTERVAL_MS, ttl)
+      expect(adoptUntracked).toHaveBeenCalledTimes(2)
+    } finally {
+      ;(k8sDaemon as any).cpClient = undefined
+      await k8sDaemon.stop()
+    }
+  })
+
+  it('names what keeps a long-quiet pod up at info once an hour, and at debug before and in between', async () => {
+    let launched = [{ subject: 'bot-a', agentId: 'bot-a', since: 0 }]
+    const k8sDaemon = daemon({
+      root: root(),
+      k8s: true,
+      plane: { launched: () => launched, suspendIdle: async () => 'busy' }
+    })
+    try {
+      await k8sDaemon.start()
+      const inner = k8sDaemon as any
+      const info = vi.spyOn(inner.log, 'info')
+      const debug = vi.spyOn(inner.log, 'debug')
+      const ttl = inner.cfg.limits.agentIdleTimeoutMs
+      const stillUp = (): number =>
+        info.mock.calls.filter(([line]) => String(line).startsWith('idle: the sandbox "bot-a" is still up after'))
+          .length
+      const skipped = (): number =>
+        debug.mock.calls.filter(([line]) => String(line).startsWith('idle: skipping sandbox "bot-a" — busy')).length
+      const longQuiet = (LONG_IDLE_SKIP_AFTER_TTLS + 1) * ttl
+      await inner.sweepIdleSandboxes(LONG_IDLE_SKIP_AFTER_TTLS * ttl, ttl)
+      await vi.waitFor(() => expect(skipped()).toBe(1))
+      expect(stillUp()).toBe(0)
+      await inner.sweepIdleSandboxes(longQuiet, ttl)
+      await vi.waitFor(() => expect(stillUp()).toBe(1))
+      expect(info).toHaveBeenCalledWith(
+        `idle: the sandbox "bot-a" is still up after ${Math.round(longQuiet / 60_000)} min without recorded activity — ` +
+          `busy; idle ${Math.round(longQuiet / 1000)}s, timeout ${Math.round(ttl / 1000)}s`
+      )
+      await inner.sweepIdleSandboxes(longQuiet + LONG_IDLE_SKIP_REPORT_INTERVAL_MS - 1, ttl)
+      await vi.waitFor(() => expect(skipped()).toBe(2))
+      expect(stillUp()).toBe(1)
+      await inner.sweepIdleSandboxes(longQuiet + LONG_IDLE_SKIP_REPORT_INTERVAL_MS, ttl)
+      await vi.waitFor(() => expect(stillUp()).toBe(2))
+ 
```

**File**: `packages/daemon/test/k8s-driver-takeover.test.ts` (modified, +56/-4)
```diff
@@ -7,6 +7,7 @@ import { K8sHttp } from '@agentconnect.md/k8s-client'
 import { closeFakeApiServers, fakeApiServer } from '@agentconnect.md/k8s-client/testing'
 import { K8sDriver } from '../src/k8s/driver.js'
 import { SANDBOX_LAUNCH_GENERATION, SandboxApi } from '../src/k8s/sandbox-api.js'
+import { AC_LABEL_AGENT } from '../src/k8s/sandbox-identity.js'
 import { LocalStore } from '../src/store/local-store.js'
 import type { SpawnRecord } from '../src/shim/binding.js'
 import type { ShimConnection } from '../src/shim/connection.js'
@@ -28,7 +29,8 @@ async function cluster() {
     ready: true,
     modeWrites: [] as string[],
     resourceVersion: 1,
-    annotations: {} as Record<string, string>
+    annotations: {} as Record<string, string>,
+    sandboxListDenied: false
   }
   const sandbox = () => ({
     metadata: {
@@ -39,7 +41,10 @@ async function cluster() {
     },
     spec: {
       operatingMode: state.mode,
-      podTemplate: { spec: { containers: [{ name: 'runtime', image: 'runtime:1' }] } }
+      podTemplate: {
+        metadata: { labels: { [AC_LABEL_AGENT]: AGENT } },
+        spec: { containers: [{ name: 'runtime', image: 'runtime:1' }] }
+      }
     },
     status: { conditions: [{ type: 'Ready', status: state.ready ? 'True' : 'False' }], podIPs: ['10.0.0.8'] }
   })
@@ -95,6 +100,10 @@ async function cluster() {
       }
       return { json: sandbox() }
     }
+    if (path.endsWith('/sandboxes') && method === 'GET') {
+      if (state.sandboxListDenied) return { status: 403, json: { kind: 'Status', reason: 'Forbidden' } }
+      return { json: { items: [sandbox()] } }
+    }
     return { status: 404, json: { kind: 'Status', reason: 'NotFound' } }
   })
   const api = new SandboxApi(new K8sHttp(config), 'agent-sandboxes')
@@ -117,7 +126,13 @@ function stubConnection(record: SpawnRecord): ShimConnection {
   } as unknown as ShimConnection
 }
 
-function member(api: SandboxApi, store: LocalStore, clock: FakeClock, servesAgent?: (agentId: string) => boolean) {
+function member(
+  api: SandboxApi,
+  store: LocalStore,
+  clock: FakeClock,
+  servesAgent?: (agentId: string) => boolean,
+  warn: (line: string) => void = () => {}
+) {
   const dialed: SpawnRecord[] = []
   const revoked: string[] = []
   const driver = new K8sDriver({
@@ -132,7 +147,7 @@ function member(api: SandboxApi, store: LocalStore, clock: FakeClock, servesAgen
       return stubConnection(record)
     },
     revokeChannel: (agentId) => revoked.push(agentId),
-    log: { info: () => {}, warn: () => {}, debug: () => {} }
+    log: { info: () => {}, warn, debug: () => {} }
   })
   return { driver, dialed, revoked }
 }
@@ -384,6 +399,43 @@ describe('sandbox launches follow the duty', () => {
     await store.close()
   })
 
+  it('takes back a Running pod no launch tracks, so the idle sweep can suspend it again', async () => {
+    const { api, state } = await cluster()
+    const store = await sharedStore()
+    const { driver } = member(api, store, new FakeClock())
+    await driver.ensureBoundChannel(AGENT)
+    expect(await driver.adoptUntracked(() => true)).toEqual([])
+    // Released without a suspend, as a handoff leaves it: only a duty change would look at this pod again.
+    driver.release(AGENT)
+    expect(driver.launched()).toEqual([])
+    expect(await driver.adoptUntracked((agentId) => agentId !== AGENT)).toEqual([])
+    expect(driver.launched()).toEqual([])
+    expect(await driver.adoptUntracked(() => true)).toEqual([AGENT])
+    expect(await driver.adoptUntracked(() => true)).toEqual([])
+    expect(await driver.suspendIfIdle(AGENT)).toBe('suspended')
+    expect(state.mode).toBe('Suspended')
+    // A suspended pod needs no launch until its next turn claims one.
+    expect(await driver.adoptUntracked(() => true)).toEqual([])
+    expect(driver.launched()).toEqual([])
+    await store.close()
+  })
+
+  it('says once that a Role without list on Sandboxes leaves the takeover to a duty change', async () => {
+    const { api, state } = await cluster()
+    const store = await sharedStore()
+    const warn = vi.fn()
+    const { driver } = member(api, store, new FakeClock(), undefined, warn)
+    await driver.ensureSandbox(AGENT)
+    driver.release(AGENT)
+    state.sandboxListDenied = true
+    expect(await driver.adoptUntracked(() => true)).toEqual([])
+    expect(await driver.adoptUntracked(() => true)).toEqual([])
+    expect(warn).toHaveBeenCalledOnce()
+    expect(warn.mock.calls[0]![0]).toMatch(/listing sandboxes is not permitted/)
+    expect(driver.launched()).toEqual([])
+    await store.close()
+  })
+
   it('a single member keeps its own launch across the same calls', async () => {
     const { api, state } = await cluster()
     const store = await sharedStore()
```

**File**: `packages/daemon/test/k8s-isolated-session-one-pod.test.ts` (modified, +1/-0)
```diff
@@ -309,6 +309,7 @@ function planeOver(
     sessionDirFor: (_agentId: string, leaf: string) => `${MOUNT}/sessions/${leaf}`,
     launched: () => driver.launched(),
     adoptAgent: async () => {},
+    adoptUntracked: async () => [],
     releaseAgent: () => {},
     suspendAgent: async () => {},
     suspendIdle: (subject: string) => driver.suspendIfIdle(subject),
```

---

### Incident Patch 8: `698a5b8c` (2026-10-03)
**Commit Message**: fix(daemon): ship the git credential helper with a daemon installation (#2794)

The host and srt strategies use the daemon's own dist as a session's helper root,
and sandboxGitCredentialTarget points git at <helperRoot>/bin/git-credential. Only
the runtime image built that wrapper, so every credentialed clone of a session placed
on another daemon failed with 'git-credential: not found' (exit 128).

The daemon build now emits dist/bin/git-credential, which runs the shim's
git-credential.js beside it.

**File**: `docs/designs/daemon-sandbox-backends.md` (modified, +5/-4)
```diff
@@ -1161,10 +1161,11 @@ network listener.
   second shim over a session directory an earlier life's shim still runs in.
 - **Helpers from the daemon's installation.** `AC_SHIM_HELPER_ROOT` is the
   directory that holds `shim/index.js`, which resolves the MCP bridge, the
-  merge-when-ready watcher and the `gh` token entry from the daemon's own bundle.
-  The git-credential wrapper, the `gh` wrapper directory and the DeepSeek preset
-  have no counterpart in an installation; the launcher reports them in
-  `missingHelpers` rather than naming a path that is not there.
+  merge-when-ready watcher, the `gh` token entry and the git-credential wrapper
+  (`bin/git-credential`, emitted by the build beside `shim/`) from the daemon's own
+  bundle. The `gh` wrapper directory and the DeepSeek preset have no counterpart
+  in an installation; the launcher reports them in `missingHelpers` rather than
+  naming a path that is not there.
 
 The launcher returns the socket path, the runtime root, the helper root, the
 workspace root, the identity token, the missing helpers, an exit promise and
```

**File**: `packages/daemon/package.json` (modified, +1/-1)
```diff
@@ -28,7 +28,7 @@
     "agent:run": "tsx src/index.ts --agents-dir ./test/fixtures/sample-agent run",
     "build": "pnpm --filter \"{.}...\" build:package",
     "build:package": "tsdown && pnpm run build:shim && node scripts/prepare-bundled-skills.mjs && node scripts/prepare-release-image.mjs && node scripts/assert-self-contained.mjs",
-    "build:shim": "tsdown --config tsdown.shim.config.ts && node scripts/prepare-shim-skills.mjs && node scripts/emit-shim-gh-wrapper.mjs",
+    "build:shim": "tsdown --config tsdown.shim.config.ts && node scripts/prepare-shim-skills.mjs && node scripts/emit-shim-gh-wrapper.mjs && node scripts/emit-shim-git-credential-wrapper.mjs",
     "clean": "rm -rf dist",
     "dev": "tsx watch src/index.ts run",
     "prepack": "pnpm run build",
```

**File**: `packages/daemon/scripts/assert-self-contained.mjs` (modified, +11/-1)
```diff
@@ -8,7 +8,7 @@
 //
 // This check turns that silent degradation into a hard build failure. It runs
 // after tsdown in the daemon's `build` script; it ships nowhere (files: ["dist"]).
-import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
+import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
 import { spawnSync } from 'node:child_process'
 import { builtinModules } from 'node:module'
 import { tmpdir } from 'node:os'
@@ -156,5 +156,15 @@ if (!readFileSync(ghWrapper, 'utf8').includes('/opt/agentconnect/shim/gh-token.j
   process.exit(1)
 }
 
+// The host and srt strategies hand git `<helperRoot>/bin/git-credential` with this `dist` as the helper root, so a
+// build that skipped the emit step would fail every credentialed clone of a session placed on this installation.
+const gitCredentialWrapper = new URL('../dist/bin/git-credential', import.meta.url)
+if (!existsSync(gitCredentialWrapper) || (statSync(gitCredentialWrapper).mode & 0o111) === 0) {
+  console.error(
+    '✗ the installation git credential helper is missing — `node scripts/emit-shim-git-credential-wrapper.mjs` did not run'
+  )
+  process.exit(1)
+}
+
 console.log('✓ daemon bundle is self-contained (including skills CLI 1.5.21 and SRT seccomp helpers)')
 console.log('✓ shim bundles are self-contained (channel + credential helper + gh token, Node builtins only)')
```

**File**: `packages/daemon/scripts/emit-shim-git-credential-wrapper.mjs` (added, +15/-0)
```diff
@@ -0,0 +1,15 @@
+// Emit `dist/bin/git-credential` — the credential helper git runs when this installation is a session's helper root
+// (the host and srt strategies). Without it every credentialed clone of a session placed here fails.
+import { mkdirSync, writeFileSync } from 'node:fs'
+import { fileURLToPath } from 'node:url'
+import { INSTALLATION_GIT_CREDENTIAL_WRAPPER } from '../src/shim/git-credential-wrapper.ts'
+
+mkdirSync(fileURLToPath(new URL('../dist/bin', import.meta.url)), { recursive: true })
+writeFileSync(
+  fileURLToPath(new URL('../dist/bin/git-credential', import.meta.url)),
+  INSTALLATION_GIT_CREDENTIAL_WRAPPER,
+  {
+    mode: 0o755
+  }
+)
+console.log('✓ emitted the installation git credential helper at dist/bin/git-credential')
```

**File**: `packages/daemon/src/shim/git-credential-wrapper.ts` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+/**
+ * The `bin/git-credential` a daemon installation ships beside its `shim/` bundle.
+ *
+ * The host and srt strategies use the installation's `dist` as a session's helper root, and `shimPaths` names
+ * `<helperRoot>/bin/git-credential` there as it names `/opt/agentconnect/bin/git-credential` in the image. It finds
+ * the helper bundle relative to itself, so the build machine's paths are never baked in.
+ */
+export const INSTALLATION_GIT_CREDENTIAL_WRAPPER =
+  '#!/bin/sh\n# agentconnect git credential helper — see src/shim/git-credential.ts.\nexec node "$(dirname "$0")/../shim/git-credential.js" "$@"\n'
```

**File**: `packages/daemon/test/sandbox-credential-helper.test.ts` (modified, +25/-1)
```diff
@@ -1,11 +1,12 @@
 import { afterEach, describe, expect, it } from 'vitest'
 import { execFile } from 'node:child_process'
-import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
+import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
 import { createRequire } from 'node:module'
 import { createServer, type Server } from 'node:net'
 import { tmpdir } from 'node:os'
 import { dirname, join } from 'node:path'
 import { fileURLToPath } from 'node:url'
+import { INSTALLATION_GIT_CREDENTIAL_WRAPPER } from '../src/shim/git-credential-wrapper.js'
 
 /**
  * REAL git, asking the in-sandbox helper for a credential, over a real socket.
@@ -236,3 +237,26 @@ describe('the credential helper the runtime image ships', () => {
     expect(server.seen).toEqual([])
   }, 60_000)
 })
+
+describe('the credential helper a daemon installation ships', () => {
+  // The host and srt strategies hand git `<helperRoot>/bin/git-credential` with an installation's `dist` as the root.
+  it('runs the helper bundle beside it with the arguments git passes', async () => {
+    const installation = scratchDir()
+    mkdirSync(join(installation, 'bin'))
+    mkdirSync(join(installation, 'shim'))
+    writeFileSync(join(installation, 'bin', 'git-credential'), INSTALLATION_GIT_CREDENTIAL_WRAPPER, { mode: 0o755 })
+    // A stand-in for the built helper bundle that echoes its argv back as the password.
+    writeFileSync(
+      join(installation, 'shim', 'git-credential.js'),
+      "process.stdout.write(`username=x-access-token\\npassword=${process.argv.slice(2).join('+')}\\n`)\n"
+    )
+    const result = await gitCredentialFill({
+      helper: join(installation, 'bin', 'git-credential'),
+      socketPath: join(installation, 'unused.sock'),
+      agentId: 'agent-a',
+      request: 'protocol=https\nhost=github.com\npath=acme/private.git\n\n'
+    })
+    expect(result.status).toBe(0)
+    expect(result.stdout).toContain('password=agent-a+get')
+  }, 60_000)
+})
```

---

### Incident Patch 9: `13c87d2b` (2026-10-03)
**Commit Message**: fix(relay): a gated agent its routing can select is reachable in that routed conversation (#2790)

* fix(relay): a gated agent its routing can select is reachable in that routed conversation

On a shared bot only a conversation's owner holds a channel-scoped route, and the relay admits a gated
(restricted) agent only where it holds one. A By decision router that selected any other restricted
agent therefore always settled it as not_member, although saving that routing needs edit rights on
every target, and the daemon already gives every gated member a decision rule for a routed row.

The CP now sends each routed conversation's selectable agents (RcRoutedConversation.targetAgentIds,
optional), and the relay counts a gated agent named there as enabled in that conversation: a routing
candidate, and a participant that thread follow-ups and agent calls still reach. Elsewhere the gate
is unchanged.

* test(control-plane): routed conversations carry the routing's target agents

**File**: `docs/designs/resource-visibility.md` (modified, +4/-1)
```diff
@@ -797,7 +797,10 @@ gate executes depends on the transport:
   thread-continuity rung honours a binding to a gated agent only while it still
   has a channel-scoped route in the conversation (`gatedAgentIds` rides
   `rc/bot-assign`/`rc/routes`), and the CP's `rc/thread-lookup` backstop applies
-  the same check; (2) **backstop — the daemon's `handleRelayIm` admission
+  the same check. In a By decision routed conversation, a gated agent its routing
+  can select counts as enabled there too (`RcRoutedConversation.targetAgentIds`):
+  saving that routing needs edit rights on every target, the same people who could
+  enable the conversation, and only the owner holds a channel-scoped route; (2) **backstop — the daemon's `handleRelayIm` admission
   check**: the shared spec carries the gated install's conversation-scoped
   bindRules + `gated`, and the last hop refuses (with the one-time notice) any
   conversation those rules don't cover, so a stale relay route snapshot cannot
```

**File**: `packages/control-plane/src/orchestrator/httpBot.test.ts` (modified, +7/-3)
```diff
@@ -2048,7 +2048,9 @@ describe('HttpBotOrchestrator — attributed route compilation (§10)', () => {
       dutyHolders = { [BOB]: [D3] }
       await makeOrch().syncBot(BOT)
       const assign = lastOf(modern, 'rc/bot-assign')!
-      expect(assign.routedConversations).toEqual([{ channel: 'C1', decisionId: DECISION, evaluationDaemonId: D1 }])
+      expect(assign.routedConversations).toEqual([
+        { channel: 'C1', decisionId: DECISION, evaluationDaemonId: D1, targetAgentIds: [ALICE, BOB] }
+      ])
       expect(assign.routes.filter((r) => r.scope?.channel === 'C1')).toEqual([
         {
           agentId: BOB,
@@ -2094,7 +2096,9 @@ describe('HttpBotOrchestrator — attributed route compilation (§10)', () => {
       await orch.daemonReady(D1)
       const routes = lastOf(modern, 'rc/routes')!
       expect(routes.mutedChannels).not.toContain('C1')
-      expect(routes.routedConversations).toEqual([{ channel: 'C1', decisionId: DECISION, evaluationDaemonId: D1 }])
+      expect(routes.routedConversations).toEqual([
+        { channel: 'C1', decisionId: DECISION, evaluationDaemonId: D1, targetAgentIds: [ALICE, BOB] }
+      ])
     })
 
     it('moves the host to the earliest-created live candidate when it goes offline, and back', async () => {
@@ -2104,7 +2108,7 @@ describe('HttpBotOrchestrator — attributed route compilation (§10)', () => {
       upserts = []
       await orch.daemonOffline(D1)
       expect(lastOf(modern, 'rc/routes')!.routedConversations).toEqual([
-        { channel: 'C1', decisionId: DECISION, evaluationDaemonId: D2 }
+        { channel: 'C1', decisionId: DECISION, evaluationDaemonId: D2, targetAgentIds: [ALICE, BOB] }
       ])
       expect(pushedTo(D2)?.core.decisions.sharedBotRouting?.channels).toEqual([{ channel: 'C1', defaultAgentId: BOB }])
       expect(pushedTo(D1)?.core.decisions.sharedBotRouting).toBeUndefined()
```

**File**: `packages/control-plane/src/orchestrator/httpBot.ts` (modified, +4/-1)
```diff
@@ -1489,6 +1489,8 @@ export class HttpBotOrchestrator {
     // A routed conversation is held unless its plan names a supported, live evaluation host.
     const routing = await this.planRouting(bot, integrations, chans, placed)
     const routedPlan = new Map((routing?.plan ?? []).map((entry) => [entry.channel, entry]))
+    // The agents the routing can select: saving it needed edit rights on each, so a gated one is enabled where it routes.
+    const routingTargets = routing?.record ? decisionRoutingAgentIds(routing.record.config).slice(0, 64) : []
     for (const c of chans) {
       if (!isRoutedChannel(c)) continue
       const entry = routedPlan.get(c.channelId)
@@ -1538,7 +1540,8 @@ export class HttpBotOrchestrator {
           routedConversations.push({
             channel: c.channelId,
             decisionId: entry.decisionId,
-            evaluationDaemonId: entry.evaluationDaemonId
+            evaluationDaemonId: entry.evaluationDaemonId,
+            ...(routingTargets.length > 0 ? { targetAgentIds: routingTargets } : {})
           })
           continue
         }
```

**File**: `packages/control-plane/test/integration/bot-decision-routing.route.test.ts` (modified, +5/-3)
```diff
@@ -227,8 +227,8 @@ describe('PUT /bots/:id/decision-routing', () => {
     })
     const routes = lastRoutes(relay!)
     expect(routes.routedConversations).toEqual([
-      { channel: 'C1', decisionId, evaluationDaemonId: DAEMON },
-      { channel: 'C2', decisionId, evaluationDaemonId: DAEMON }
+      { channel: 'C1', decisionId, evaluationDaemonId: DAEMON, targetAgentIds: [a.agentId, b.agentId] },
+      { channel: 'C2', decisionId, evaluationDaemonId: DAEMON, targetAgentIds: [a.agentId, b.agentId] }
     ])
     expect(routes.routes).toContainEqual(
       expect.objectContaining({ agentId: a.agentId, scope: { channel: 'C1' }, match: { kind: 'decision' }, decisionId })
@@ -355,7 +355,9 @@ describe('PUT /bots/:id/decision-routing', () => {
     for (const row of rows)
       expect(row).toMatchObject({ trigger: 'decision', decisionBinding: { type: 'shared_bot_routing' } })
     const routes = lastRoutes(relay!)
-    expect(routes.routedConversations).toEqual([{ channel: 'C3', decisionId, evaluationDaemonId: DAEMON }])
+    expect(routes.routedConversations).toEqual([
+      { channel: 'C3', decisionId, evaluationDaemonId: DAEMON, targetAgentIds: [a.agentId, b.agentId] }
+    ])
     expect(routes.mutedChannels ?? []).not.toContain('C3')
   })
 
```

**File**: `packages/protocol/src/frames/relay-cp.ts` (modified, +4/-1)
```diff
@@ -923,7 +923,10 @@ export type RcConversationDefault = z.infer<typeof RcConversationDefault>
 export const RcRoutedConversation = z.object({
   channel: z.string().min(1),
   decisionId: z.string().min(1).max(128),
-  evaluationDaemonId: z.string().uuid()
+  evaluationDaemonId: z.string().uuid(),
+  // The agents its routing can select. Saving the routing needs edit rights on each, so it enables a gated (§14)
+  // one in this conversation as a channel-scoped route does; absent ⇒ an older CP, only routes enable one
+  targetAgentIds: z.array(z.string().uuid()).max(64).optional()
 })
 export type RcRoutedConversation = z.infer<typeof RcRoutedConversation>
 
```

**File**: `packages/relay/src/bot-arbitration.test.ts` (modified, +34/-0)
```diff
@@ -1044,6 +1044,40 @@ describe('By decision candidate routes (decisions.md §7.1)', () => {
     })
   })
 
+  describe('a gated agent its routing can select (§14)', () => {
+    const gatedTarget = (): BotAssignment => ({
+      ...decisionAssignment(),
+      agents: [
+        { agentId: ALICE, name: 'Alice', daemonId: D1, integrationId: 'iA' },
+        { agentId: BOB, name: 'Bob', daemonId: D2, integrationId: 'iB' }
+      ],
+      gatedAgentIds: [BOB],
+      routedConversations: [{ channel: 'C9', decisionId: 'dec-1', evaluationDaemonId: D2, targetAgentIds: [BOB] }]
+    })
+
+    it('is a candidate in that routed conversation, and stays reachable there once it joins', () => {
+      const r = new BotArbitrationRouter()
+      r.upsert(gatedTarget())
+      expect(r.routedCandidates('bot-1', 'C9').map((t) => t.agentId)).toEqual([ALICE, BOB])
+      // A participant is re-resolved through the same gate on every follow-up.
+      r.setAffinity('bot-1', 'C9/ts1', { agentId: BOB, daemonId: D2, integrationId: 'iB' })
+      expect(r.conversationParticipants('bot-1', 'C9/ts1', 'C9').map((t) => t.agentId)).toEqual([BOB])
+    })
+
+    it('stays gated in every other conversation, in a muted one, and where the routing does not name it', () => {
+      const r = new BotArbitrationRouter()
+      r.upsert(gatedTarget())
+      expect(r.agentTarget('bot-1', BOB, 'C1')).toBeNull()
+      r.upsert({ ...gatedTarget(), mutedChannels: ['C9'] })
+      expect(r.routedCandidates('bot-1', 'C9')).toEqual([])
+      r.upsert({
+        ...gatedTarget(),
+        routedConversations: [{ channel: 'C9', decisionId: 'dec-1', evaluationDaemonId: D2, targetAgentIds: [ALICE] }]
+      })
+      expect(r.routedCandidates('bot-1', 'C9').map((t) => t.agentId)).toEqual([ALICE])
+    })
+  })
+
   it('drops a routed conversation whose channel has no decision route with the same Decision', () => {
     const base = decisionAssignment()
     const a = toBotAssignment({
```

**File**: `packages/relay/src/bot-arbitration.ts` (modified, +5/-2)
```diff
@@ -718,9 +718,12 @@ export class BotArbitrationRouter {
     if (!daemonId) return null
     // A conversation-GATED agent (§14) is reachable only while it still holds a
     // channel-scoped route here — a binding made before the gate was applied must not keep
-    // routing a private agent into a now-Off conversation.
+    // routing a private agent into a now-Off conversation — or is a target of this routed
+    // conversation's routing, which only an editor of that agent could have saved.
     if (a.gatedAgentIds?.includes(agentId)) {
-      const scoped = a.routes.some((r) => r.agentId === agentId && r.scope?.channel === channelId)
+      const scoped =
+        a.routes.some((r) => r.agentId === agentId && r.scope?.channel === channelId) ||
+        !!a.routedConversations?.find((c) => c.channel === channelId)?.targetAgentIds?.includes(agentId)
       if (!scoped) return null
     }
     const integrationId = route?.integrationId ?? a.agents.find((x) => x.agentId === agentId)?.integrationId
```

---

### Incident Patch 10: `5aed462f` (2026-10-03)
**Commit Message**: fix(daemon): bind a new session's source before the cold fence (#2789)

A cancel or pause that lands while session/new is still running trips the
'initialized' cold fence. The fence keeps the new row (idle, ACP id cleared),
but classification ran after it, in announceTurnStart, so the row was left
without its external source binding. bindSessionSource then treats every
later turn in that conversation as a source mismatch and posts "This thread
already belongs to a session created from another source" on each message.

Classify a created session right after sessions.handle(), before the fence.
Classification only writes the local store, so it still lands before the
first milestone.

**File**: `packages/daemon/src/daemon.ts` (modified, +11/-9)
```diff
@@ -13939,6 +13939,16 @@ export class Daemon {
       this.log.debug(`dispatch: skipped already-delivered Slack event ${msg.msgId}`)
       return null
     }
+    if (created) {
+      // Classify for session visibility BEFORE the first milestone: the CP's
+      // ingest is first-wins, and the daemon's own capture gate must be closed
+      // from turn one for anything that could be private (session-visibility.md
+      // §4.1/§5.1). Persisted on the session row so later re-emits — including
+      // after a restart, when `msg` is long gone — still carry the same facts.
+      // Also BEFORE the cold fence below: a cancel there keeps the new row, and a row
+      // without its source binding rejects every later turn as a source mismatch.
+      await this.classifyNewSession(agentId, key, sessionId, msg, callMeta, hookContext, webchat?.evaluation === true)
+    }
     // A cold session can spend time booting/materializing inside sessions.handle(). If
     // pause landed in that window, no Pending existed for the transition hook to cancel.
     // Re-check before publishing metadata or prompting, restore the new row to idle, and
@@ -14751,7 +14761,7 @@ export class Daemon {
    *  metadata snapshot, observed-channel discovery, and the caller's session-ready callback. */
   private async announceTurnStart(run: TurnRun, sessionId: string, created: boolean): Promise<void> {
     const { entry, key, plan, replyConn } = run
-    const { agentId, msg, callMeta, hookContext, webchat, onSessionReady } = entry
+    const { agentId, msg, onSessionReady } = entry
     // sessions.handle() booted the host — surface any spawn-time config warnings
     // (config-file secret conflicts / write failures) into this session.
     await this.flushSpawnNotices(agentId, {
@@ -14762,14 +14772,6 @@ export class Daemon {
       statusThread: plan.statusThread,
       sessionKey: plan.sessionKey
     })
-    if (created) {
-      // Classify for session visibility BEFORE the first milestone: the CP's
-      // ingest is first-wins, and the daemon's own capture gate must be closed
-      // from turn one for anything that could be private (session-visibility.md
-      // §4.1/§5.1). Persisted on the session row so later re-emits — including
-      // after a restart, when `msg` is long gone — still carry the same facts.
-      await this.classifyNewSession(agentId, key, sessionId, msg, callMeta, hookContext, webchat?.evaluation === true)
-    }
     // The row exists now, so the birth verdict this turn reached lands before the milestone that reports it (§7).
     await this.flushSessionExecutorVerdict(key)
     // Turn-start metadata snapshot — EVERY turn, not only `created`. The row is
```

**File**: `packages/daemon/test/daemon-transcript.test.ts` (modified, +39/-0)
```diff
@@ -307,6 +307,45 @@ describe('Daemon transcript records the agent reply', () => {
     await daemon.stop()
   })
 
+  // A cancel that lands while session/new is still running keeps the new row (state idle, no
+  // ACP id). That row must still carry its Slack binding, or every later message in the
+  // thread is rejected as a source mismatch.
+  it('keeps the Slack source binding on a new session cancelled before its first prompt', async () => {
+    const { factory, host } = replyingHost('here is my answer')
+    let releaseSession!: () => void
+    const sessionBlocked = new Promise<void>((resolve) => (releaseSession = resolve))
+    host.newSession.mockImplementationOnce(async () => {
+      await sessionBlocked
+      return 'acp-1'
+    })
+    const daemon = new Daemon({
+      slackAppFactory: fakeSlackAppFactory(),
+      root: scaffold('medium'),
+      hostFactory: factory
+    })
+    await daemon.start()
+    const conn = makeRoutable(daemon)
+    const agent = (daemon as any).agents.get('bot-a')
+
+    const cancelled = (daemon as any).dispatch('bot-a', channelMsg('100', 'first'), 'int-a')
+    await vi.waitFor(() => expect(host.newSession).toHaveBeenCalledOnce(), WAIT)
+    agent.pause = true
+    releaseSession()
+    await cancelled
+    expect(host.prompt).not.toHaveBeenCalled()
+
+    agent.pause = false
+    await (daemon as any).dispatch('bot-a', channelMsg('200', 'follow-up'), 'int-a')
+
+    expect(conn.postMessage).not.toHaveBeenCalledWith(
+      'C1',
+      expect.stringContaining('already belongs to a session created from another source'),
+      'T1'
+    )
+    expect(host.prompt).toHaveBeenCalledOnce()
+    await daemon.stop()
+  })
+
   it('reuses an external runtime only for the same inherited Slack source', async () => {
     const { factory, host } = replyingHost('here is my answer')
     const daemon = new Daemon({
```

---

### Incident Patch 11: `f43eac2d` (2026-10-03)
**Commit Message**: fix(daemon): wait out a busy skill lock database on open instead of failing (#2784)

* fix(daemon): wait out a busy skill lock database on open instead of failing

Opening the workspace skill lock database reads its schema, which SQLite
refuses while a peer holds the write lock to commit. On a slow disk that
commit can outlast the 1s busy timeout, and the open was the one step
outside the retry loop: the acquire transaction and every lease update
already retry a busy database until the 60s deadline. A second process
contending for the same workspace therefore crashed with "workspace skill
lock database is unavailable" instead of queueing.

Retry the open on a busy database under the same deadline, and close the
half-open connection on each failure. The new test holds the database
exclusively past the busy timeout and fails on the old code with the same
error the Sandbox (Linux) job hit.

The lock test's waitForMessage now reports a worker that already exited
instead of timing out after 60s with no exit event left to observe.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

* test(daemon): drop the lock database case's restated timeout

The configured default already grants 30s,

**File**: `packages/daemon/src/skills/skill-install-ledger.ts` (modified, +31/-23)
```diff
@@ -962,7 +962,7 @@ async function acquireExternalWorkspaceLock(workspaceKey: string, stateDir: stri
   await ensureLockDatabaseFile(databaseFile, lockRoot)
   const token = randomUUID()
   const deadline = Date.now() + EXTERNAL_LOCK_WAIT_MS
-  const database = openLockDatabase(databaseFile)
+  const database = await openLockDatabase(databaseFile, deadline)
 
   try {
     for (;;) {
@@ -1068,28 +1068,36 @@ async function acquireExternalWorkspaceLock(workspaceKey: string, stateDir: stri
   }
 }
 
-function openLockDatabase(path: string): DatabaseSync {
-  try {
-    const database = new DatabaseSync(path, {
-      timeout: EXTERNAL_LOCK_BUSY_MS,
-      allowExtension: false,
-      enableDoubleQuotedStringLiterals: false
-    })
-    database.enableDefensive(true)
-    database.exec(`
-      PRAGMA synchronous = FULL;
-      PRAGMA trusted_schema = OFF;
-      CREATE TABLE IF NOT EXISTS workspace_skill_leases (
-        workspace_key TEXT PRIMARY KEY NOT NULL,
-        owner_pid INTEGER NOT NULL,
-        owner_token TEXT NOT NULL,
-        helper_pgid INTEGER,
-        updated_at INTEGER NOT NULL
-      ) WITHOUT ROWID;
-    `)
-    return database
-  } catch (error) {
-    throw safety('workspace skill lock database is unavailable', error)
+async function openLockDatabase(path: string, deadline: number): Promise<DatabaseSync> {
+  for (;;) {
+    let database: DatabaseSync | undefined
+    try {
+      database = new DatabaseSync(path, {
+        timeout: EXTERNAL_LOCK_BUSY_MS,
+        allowExtension: false,
+        enableDoubleQuotedStringLiterals: false
+      })
+      database.enableDefensive(true)
+      database.exec(`
+        PRAGMA synchronous = FULL;
+        PRAGMA trusted_schema = OFF;
+        CREATE TABLE IF NOT EXISTS workspace_skill_leases (
+          workspace_key TEXT PRIMARY KEY NOT NULL,
+          owner_pid INTEGER NOT NULL,
+          owner_token TEXT NOT NULL,
+          helper_pgid INTEGER,
+          updated_at INTEGER NOT NULL
+        ) WITHOUT ROWID;
+      `)
+      return database
+    } catch (error) {
+      database?.close()
+      // A peer's commit can outlast the busy timeout on a slow disk; wait it out as the acquire loop does.
+      if (!isSqliteBusy(error) || Date.now() >= deadline) {
+        throw safety('workspace skill lock database is unavailable', error)
+      }
+    }
+    await new Promise((resolveWait) => setTimeout(resolveWait, 50))
   }
 }
 
```

**File**: `packages/daemon/test/skill-workspace-lock.test.ts` (modified, +33/-0)
```diff
@@ -2,9 +2,11 @@ import { fork, spawn, type ChildProcess } from 'node:child_process'
 import { mkdir, mkdtemp, rm } from 'node:fs/promises'
 import { tmpdir } from 'node:os'
 import { dirname, join } from 'node:path'
+import { DatabaseSync } from 'node:sqlite'
 import { fileURLToPath } from 'node:url'
 import { afterEach, beforeEach, describe, expect, it } from 'vitest'
 import { detectSandbox } from '../src/acp/sandbox.js'
+import { withSkillWorkspaceLock } from '../src/skills/skill-install-ledger.js'
 
 const workerFile = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/skill-workspace-lock-worker.ts')
 
@@ -115,6 +117,32 @@ describe.skipIf(!hasBwrap)('cross-process skill workspace lock', () => {
   }, 120_000)
 })
 
+describe('skill workspace lock database', () => {
+  let root: string
+
+  beforeEach(async () => {
+    root = await mkdtemp(join(tmpdir(), 'ac-skill-lock-db-'))
+  })
+
+  afterEach(async () => {
+    await rm(root, { recursive: true, force: true })
+  })
+
+  it('waits for a peer whose write outlasts the busy timeout instead of failing to open', async () => {
+    const cwd = join(root, 'workspace')
+    const stateDir = join(root, 'state')
+    await mkdir(cwd)
+    await withSkillWorkspaceLock(cwd, async () => undefined, stateDir)
+
+    // Hold the database exclusively past the 1s busy timeout, as a slow-disk commit would.
+    const peer = new DatabaseSync(join(stateDir, 'workspace-skill-locks', 'leases.sqlite3'))
+    peer.exec('BEGIN EXCLUSIVE')
+    setTimeout(() => peer.close(), 1_500)
+
+    await expect(withSkillWorkspaceLock(cwd, async () => 'locked', stateDir)).resolves.toBe('locked')
+  })
+})
+
 function workerStderr(child: ChildProcess): string {
   const captured = (child as unknown as { capturedStderr?: string[] }).capturedStderr ?? []
   const text = captured.join('').trim()
@@ -140,6 +168,11 @@ function waitForMessage(child: ChildProcess, type: string, timeoutMs = 60_000):
       if (error) reject(error)
       else resolve(message!)
     }
+    // A worker that died before this wait began has no exit event left to report it.
+    if (child.exitCode !== null || child.signalCode !== null) {
+      onExit(child.exitCode, child.signalCode)
+      return
+    }
     child.on('message', onMessage)
     child.on('exit', onExit)
   })
```

---

### Incident Patch 12: `be5fc3a5` (2026-10-03)
**Commit Message**: fix(daemon): treat a config value already in effect as applied (#2783)

Every scheduled dream failed its read-only gate: the configured runtime
settings switch the session into plan/read-only first, and the gate's
second setSessionPermissionMode then hit the "already set" skip, which
setSessionConfig reported as false. The same false negative would fail the
memory-extraction and commit-message gates on a runtime whose sessions
start in a read-only mode.

planConfigSelection now returns { current: true } for a value the session
already holds, and the live setters report it as in effect.

Refs #2774

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `packages/daemon/src/acp/acp-host.ts` (modified, +6/-8)
```diff
@@ -164,7 +164,7 @@ export type { AcpSandboxLaunch, SpawnDriver, SpawnedRuntime } from './spawn-driv
 export type { SteeringIdleBehavior, SteeringOutcome } from './steering.js'
 
 /** The `session/set_config_option` call that applies a desired value, or the reason none is needed. */
-export type ConfigSelectionPlan = { configId: string; value: string } | { skip: string }
+export type ConfigSelectionPlan = { configId: string; value: string } | { current: true } | { skip: string }
 
 /**
  * Distill the human-actionable reason from a failed ACP request. Adapters wrap
@@ -376,11 +376,7 @@ export function turnFailureCode(err: unknown): TurnFailureCode {
     : 'turn_failed'
 }
 
-/**
- * Resolve how to apply `desired` to the select config option tagged `category`.
- * `{skip}` (with the reason) means nothing should be sent: the runtime
- * advertises no such selector, doesn't offer the value, or already has it set.
- */
+/** Resolve `desired` for the `category` select: send it, it is already `current`, or `skip` (not offered). */
 export function planConfigSelection(
   configOptions: SessionConfigOption[] | null | undefined,
   category: string,
@@ -392,7 +388,7 @@ export function planConfigSelection(
   if (!values.includes(desired)) {
     return { skip: `value "${desired}" not offered (available: ${values.join(', ')})` }
   }
-  if (opt.currentValue === desired) return { skip: `already "${desired}"` }
+  if (opt.currentValue === desired) return { current: true }
   return { configId: opt.id, value: desired }
 }
 
@@ -1097,6 +1093,8 @@ export class AcpHost {
     value: string
   ): Promise<SessionConfigOption[] | undefined> {
     const plan = planConfigSelection(options, category, value)
+    // Already in effect is success: read-only gates re-assert a mode the session may already hold (#2774).
+    if ('current' in plan) return options ?? undefined
     if ('skip' in plan) {
       const models = category === 'model' ? modelOptionsFrom(options) : null
       if (models && models.current !== value) throw new ModelSelectionError(value, new Error(plan.skip))
@@ -1120,7 +1118,7 @@ export class AcpHost {
     }
   }
 
-  /** Apply a live selection and refresh caches; false means no request was needed or supported. */
+  /** Apply a live selection and refresh caches; true once the value is in effect, false when it is not offered. */
   private async setSessionConfig(sessionId: string, category: string, value: string): Promise<boolean> {
     if (!this.live.has(sessionId)) return false
     const options = await this.selectSessionConfig(sessionId, this.sessionConfigs.get(sessionId), category, value)
```

**File**: `packages/daemon/test/acp-config.test.ts` (modified, +4/-4)
```diff
@@ -105,8 +105,8 @@ describe('planConfigSelection', () => {
     expect((plan as { skip: string }).skip).toContain('default, low, medium, high, xhigh, max')
   })
 
-  it('skips when the value is already current', () => {
-    expect(planConfigSelection(claudeLike({ effort: 'high' }), 'thought_level', 'high')).toHaveProperty('skip')
+  it('reports a value that is already current without planning a request', () => {
+    expect(planConfigSelection(claudeLike({ effort: 'high' }), 'thought_level', 'high')).toEqual({ current: true })
   })
 
   it('ignores non-select options in the category', () => {
@@ -141,8 +141,8 @@ describe('planConfigSelection', () => {
       configId: 'fast-mode',
       value: 'off'
     })
-    // already current / model without fast support (no option) → skip
-    expect(planConfigSelection(fastSelect('fast', 'on'), 'model_config', 'on')).toHaveProperty('skip')
+    // already current → no request; model without fast support (no option) → skip
+    expect(planConfigSelection(fastSelect('fast', 'on'), 'model_config', 'on')).toEqual({ current: true })
     expect(planConfigSelection(claudeLike(), 'model_config', 'on')).toHaveProperty('skip')
   })
 })
```

**File**: `packages/daemon/test/acp-host.test.ts` (modified, +18/-2)
```diff
@@ -198,6 +198,21 @@ describe('AcpHost (against a fake ACP agent)', () => {
     expect(mode()?.currentValue).toBe('agent-full-access')
     await host.stop()
   })
+
+  // The dream gate re-asserts the read-only mode the configured settings just applied (#2774).
+  it('reports a mode the session already holds as in effect, and an unoffered one as not', async () => {
+    const host = new AcpHost(
+      { command: process.execPath, args: [fakeAgent], env: [] },
+      { onUpdate: () => {}, env: { AC_PERMISSION_MODES: 'agent,read-only' } }
+    )
+    await host.start()
+    const sessionId = await host.newSession('/tmp')
+    await expect(host.setSessionPermissionMode(sessionId, 'read-only')).resolves.toBe(true)
+    await expect(host.setSessionPermissionMode(sessionId, 'read-only')).resolves.toBe(true)
+    expect(host.permissionModeOptions(sessionId)?.current).toBe('read-only')
+    await expect(host.setSessionPermissionMode(sessionId, 'plan')).resolves.toBe(false)
+    await host.stop()
+  })
 })
 
 describe('AcpHost.mcpCapabilities (MCP transports from initialize)', () => {
@@ -462,8 +477,9 @@ describe('AcpHost.setSessionModel (mid-session model switch)', () => {
     expect(host.modelOptions(sid2)?.current).toBe('model-a')
     expect(host.modelOptions('s-unknown')).toBeNull()
 
-    // An unavailable model is an error; unchanged and unknown sessions are no-ops.
-    expect(await host.setSessionModel(sid, 'model-b')).toBe(false)
+    // An unchanged model is already in effect; an unavailable one is an error; unknown sessions are no-ops.
+    expect(await host.setSessionModel(sid, 'model-b')).toBe(true)
+    expect(host.modelOptions(sid)?.current).toBe('model-b')
     await expect(host.setSessionModel(sid, 'nope')).rejects.toBeInstanceOf(ModelSelectionError)
     expect(await host.setSessionModel('s-unknown', 'model-a')).toBe(false)
     await host.stop()
```

---

### Incident Patch 13: `eed682da` (2026-10-03)
**Commit Message**: fix(daemon): keep a runtime's private state read-only to its tools, deny only its credentials (#2773)

* fix(daemon): let a sandboxed Codex session exec its own linux-sandbox helper

A session-tier Codex launch under the srt strategy denies `<session HOME>/.codex`, where
Codex extracts its `codex-linux-sandbox` helper (`$CODEX_HOME/tmp/arg0`) and execs it through
its own bwrap. Codex's bwrap masks a denied directory and reopens only writable descendants,
so thread creation failed with `bwrap: execvp …/.codex/tmp/arg0/…/codex-linux-sandbox:
Permission denied`. Reopen that one subtree for write; the rest of `.codex`, including the
`auth.json` link to the shared host credential, stays denied.

* fix(daemon): reopen the Codex helper subtree in the read-only profile too

Codex runs automatic approval review under the read-only profile, which denies every protected
root, including the session's `.codex` on an executor launch. The review then fails the same way
(`Automatic approval review failed: … codex-linux-sandbox: Permission denied`). Every profile
that denies the session's `.codex` now reopens `.codex/tmp/arg0` for write; another protected
`.codex` (the host's own) stays denied whol

**File**: `docs/designs/git-workspace-model.md` (modified, +24/-4)
```diff
@@ -420,10 +420,30 @@ time on shared filesystems.
   it from the runtime ([session-executors.md](session-executors.md) §5). The
   session's `home/` is writable in both layers as well — a runtime's inner policy pins writes to the cwd, and HOME is its _sibling_, so
   the grant is named there too or no package manager can write the caches below
-  it. `home/.codex` is carved back out of that grant and stays denied: its
-  `auth.json` is a link to the shared host credential the outer layer keeps
-  writable for the ACP parent, and the rest is that parent's own state, written
-  from outside the inner sandbox. When the clones are not on this daemon's disk
+  it. The runtime's private state directory below it (`home/.codex`,
+  `home/.claude`) is carved back out of that grant as **read-only** to the
+  model's tools, in every profile, and only what can hold a secret is denied:
+  each top-level file seeded from the host (the `isRuntimeHomeSeedFile` rule that
+  copied it), the shared host credential a link there points at (denied at its
+  target: the link sits under the writable HOME, and Codex's bwrap refuses to
+  mask a path that crosses a symlink the sandboxed process could swap), and the
+  named surfaces in `runtimes/private-runtime-state.ts` (`.codex/config.toml`,
+  Claude's `backups/`). Read-only, not denied, because each runtime stores there
+  what its own tools read back: Codex execs its linux-sandbox helper from
+  `$CODEX_HOME/tmp/arg0` through a bwrap that masks a denied directory, including
+  under the read-only profile automatic approval review runs under; Claude saves
+  an oversized tool result under `.claude/projects/…/tool-results/` and tells the
+  model to read it there. Writes stay denied for the whole directory, so the model
+  cannot plant settings or hooks the parent would load. This rule is
+  open-world: what a runtime writes there itself (its transcripts, rollouts,
+  logs, synced skills) is readable unless classified a secret, so a runtime
+  release that adds a credential-bearing file there needs its name added to that
+  module's secret list; a newly seeded top-level file is denied without one. An
+  executor's HOME is classified by the executor, since the holder can list neither
+  it nor the target of its credential link: it reports the split with its
+  `prepare` reply, and the holder applies it when it launches in that HOME. From
+  an executor that reports none, `home/.codex` stays denied whole and Codex's
+  helper is reopened below it for write, so its approval review still fails. When the clones are not on this daemon's disk
   (a pool pod's, or a session placed on another machine of its group), the daemon
   lists them through that filesystem before the launch, refusing a `.git` that is
   a link there just as it does here, and names them in that filesystem's
```

**File**: `packages/daemon/src/acp/acp-host.ts` (modified, +23/-9)
```diff
@@ -449,6 +449,8 @@ export interface AcpToolSandbox {
   claudeProtectedSettings?: ClaudeProtectedSettings
   /** Writable mount targets reopened in the runtime-native tool sandbox. */
   sharedWriteRoots?: string[]
+  /** The runtime's private state (a session HOME's `.claude`): model-authored tools may read it, never change it. */
+  readOnlyStateRoots?: string[]
 }
 
 interface ClaudeSessionSettings {
@@ -470,7 +472,8 @@ export function claudeSessionMeta(
   protectedSettings?: ClaudeProtectedSettings,
   allowModelToolUnixSockets = false,
   extraDisallowedTools: readonly string[] = [],
-  sharedWriteRoots: readonly string[] = []
+  sharedWriteRoots: readonly string[] = [],
+  readOnlyStateRoots: readonly string[] = []
 ):
   | {
       claudeCode: {
@@ -489,11 +492,15 @@ export function claudeSessionMeta(
   // Append the system prompt and memory together, omitting an empty result.
   const append = [systemPrompt, memoryAppend].filter(Boolean).join('\n\n')
   const ultracode = reasoningEffort === ULTRACODE_EFFORT
-  const deny = [...new Set(protectedCredentialRoots)].flatMap((root) => {
-    // Claude uses gitignore patterns with // for absolute paths; cover the root and its descendants.
-    const pattern = `/${root.replace(/\/+$/, '').replace(/[\\*?[\] ]/g, (char) => `\\${char}`)}`
-    return ['Read', 'Edit'].flatMap((tool) => [`${tool}(${pattern})`, `${tool}(${pattern}/**)`])
-  })
+  // Claude uses gitignore patterns with // for absolute paths; cover the root and its descendants.
+  const rules = (roots: readonly string[] | undefined, tools: readonly string[]): string[] =>
+    [...new Set(roots)].flatMap((root) => {
+      const pattern = `/${root.replace(/\/+$/, '').replace(/[\\*?[\] ]/g, (char) => `\\${char}`)}`
+      return tools.flatMap((tool) => [`${tool}(${pattern})`, `${tool}(${pattern}/**)`])
+    })
+  // Credentials are neither read nor changed; the runtime's own state is read back (its saved tool results, its
+  // synced skills) but never changed, so the model cannot plant settings or hooks the trusted parent would load.
+  const deny = [...rules(protectedCredentialRoots, ['Read', 'Edit']), ...rules(readOnlyStateRoots, ['Edit'])]
   const settings: ClaudeSessionSettings = {
     ...(protectedSettings ?? {}),
     // Claude requires custom plans inside the workspace; its default HOME/.claude/plans is protected above.
@@ -508,7 +515,12 @@ export function claudeSessionMeta(
         disallowedTools: [...CLAUDE_DISALLOWED_BUILTIN_TOOLS, ...extraDisallowedTools],
         ...(protectedCredentialRoots
           ? {
-              sandbox: claudeInnerSandboxSettings(protectedCredentialRoots, allowModelToolUnixSockets, sharedWriteRoots)
+              sandbox: claudeInnerSandboxSettings(
+                protectedCredentialRoots,
+                allowModelToolUnixSockets,
+                sharedWriteRoots,
+                readOnlyStateRoots
+              )
             }
           : {}),
         ...(protectedSettings || ultracode || deny.length > 0 ? { settings } : {})
@@ -984,7 +996,8 @@ export class AcpHost {
       this.opts.toolSandbox?.claudeProtectedSettings,
       this.opts.toolSandbox?.allowModelToolUnixSockets,
       extraDisallowedTools,
-      this.opts.toolSandbox?.sharedWriteRoots
+      this.opts.toolSandbox?.sharedWriteRoots,
+      this.opts.toolSandbox?.readOnlyStateRoots
     )
     const activeAdditionalDirectories = this.canUseAdditionalDirectories ? additionalDirectories : []
     const res = await this.conn!.agent.request(methods.agent.session.new, {
@@ -1242,7 +1255,8 @@ export class AcpHost {
         this.opts.toolSandbox?.claudeProtectedSettings,
         this.opts.toolSandbox?.allowModelToolUnixSockets,
         [],
-        this.opts.toolSandbox?.sharedWriteRoots
+        this.opts.toolSandbox?.sharedWriteRoots,
+        this.opts.toolSandbox?.readOnlyStateRoots
       )
       const activeAdditionalDirectories = this.canUseAdditionalDirectories ? additionalDirectories : []
       const res = await this.conn!.agent.request(methods.agent.session.load, {
```

**File**: `packages/daemon/src/acp/codex-permission-profiles.ts` (modified, +30/-9)
```diff
@@ -14,7 +14,10 @@ export interface CodexPermissionProfileConfig {
 }
 
 export interface CodexPermissionProfileOptions {
+  /** Denied outright: credentials, and the files and links that hold them. */
   protectedRoots: readonly string[]
+  /** Runtime state the model's tools read back but must not change (a private `.codex`): `read` in every profile. */
+  readOnlyRoots?: readonly string[]
   /** Owner checkouts' `.git`, whose `worktrees/**` hold the session worktrees' admin dirs. */
   writableGitMetadataRoots?: readonly string[]
   /** A session's own clones' `.git` (git-workspace-model §11): exact entries, nothing hangs off them. */
@@ -65,8 +68,19 @@ export function codexPermissionProfileConfig(
   const sessionGitMetadataRoots = [...new Set((opts.sessionGitMetadataRoots ?? []).map((root) => normalize(root)))]
   const sessionHomeRoot = opts.sessionHomeRoot === undefined ? undefined : normalize(opts.sessionHomeRoot)
   const sharedWriteRoots = [...new Set((opts.sharedWriteRoots ?? []).map((root) => normalize(root)))]
+  // The session's own `.codex` is read-only by default, whatever the caller names: its HOME is writable, and the
+  // ACP parent's state below it must not be. Read-only and not denied, because Codex execs its linux-sandbox helper
+  // from `$CODEX_HOME/tmp/arg0` through its own bwrap, which masks a denied directory — in every profile, including
+  // the read-only one automatic approval review runs under.
+  const readOnlyRoots = [
+    ...new Set([
+      ...(opts.readOnlyRoots ?? []).map((root) => normalize(root)),
+      ...(sessionHomeRoot === undefined ? [] : [join(sessionHomeRoot, '.codex')])
+    ])
+  ]
   const policyRoots = [
     ...protectedRoots,
+    ...readOnlyRoots,
     ...writableGitMetadataRoots,
     ...sessionGitMetadataRoots,
     ...(sessionHomeRoot === undefined ? [] : [sessionHomeRoot]),
@@ -77,6 +91,15 @@ export function codexPermissionProfileConfig(
     throw new Error('Codex permission roots must be absolute paths')
   }
 
+  // A caller that cannot list the session's `.codex` (an executor's HOME, on another machine) denies it whole; Codex
+  // then finds its linux-sandbox helper only through a WRITABLE carve-out, since its bwrap masks a denied directory
+  // and reopens writable descendants alone. The read-only derivative approval review runs under keeps no write, so
+  // only the read-only state directory above serves that review.
+  const deniedCodexHome = sessionHomeRoot === undefined ? undefined : join(sessionHomeRoot, '.codex')
+  const helperCarveOut: Array<[string, string]> =
+    deniedCodexHome !== undefined && protectedRoots.includes(deniedCodexHome)
+      ? [[join(deniedCodexHome, 'tmp', 'arg0'), 'write']]
+      : []
   const readOnlyFilesystem =
     protectedRoots.length > 0
       ? [
@@ -98,24 +121,22 @@ export function codexPermissionProfileConfig(
       [join(root, 'hooks'), 'read'],
       [join(root, 'config'), 'read']
     ]),
-    // §11's per-session HOME holds the package caches and runtime state; `.codex` is carved back whole because its `auth.json` LINKS to the shared host credential and the rest is the ACP parent's state, written outside this sandbox.
-    ...(sessionHomeRoot === undefined
-      ? []
-      : ([
-          [sessionHomeRoot, 'write'],
-          [join(sessionHomeRoot, '.codex'), 'deny']
-        ] as Array<[string, string]>)),
+    // §11's per-session HOME holds the package caches and runtime state.
+    ...(sessionHomeRoot === undefined ? [] : ([[sessionHomeRoot, 'write']] as Array<[string, string]>)),
+    // Most specific wins: the private state is read-only below the writable HOME, and its credentials are denied below that.
+    ...readOnlyRoots.map((root): [string, string] => [root, 'read']),
     // A shared store sits outside the cwd, so `:workspace` alone would refuse the very install it exists for; the read-only mode keeps refusing it.
     ...sharedWriteRoots.map((root): [string, string] => [root, 'write']),
-    ...protectedRoots.map((root): [string, string] => [root, 'deny'])
+    ...protectedRoots.map((root): [string, string] => [root, 'deny']),
+    ...helperCarveOut
   ]
   const agentFilesystem =
     agentFilesystemEntries.length > 0
       ? [`permissions.${PROFILE_IDS.agent}.filesystem=${tomlInlineTable(agentFilesystemEntries)}`]
       : []
   // A writable `:root` beside a deny takes Codex's restricted Linux sandbox, whose root rebind remounts `/dev` nodev (openai/codex#16451), so with a deny full access keeps the workspace profile's writes.
   const fullAccessFilesystem =
-    protectedRoots.length > 0
+    protectedRoots.length > 0 || readOnlyRoots.length > 0
       ? [
           `permissions.${PROFILE_IDS['agent-full-access']}.extends=":workspace"`,
           ...(agentFilesystemEntries.length > 0
```

**File**: `packages/daemon/src/daemon.ts` (modified, +6/-1)
```diff
@@ -6703,6 +6703,9 @@ export class Daemon {
     const remoteHome = remoteSession && this.executorPlane?.homeFor(remoteSession.subject)
     // The roots its `prepare` named, where the session gitconfig and config files land in that machine's environment (§5).
     const remoteRoots = remoteSession && this.executorPlane?.rootsFor(remoteSession.sessionKey)
+    // Its `.codex` as that machine classified it, which this one cannot list (prepareExecutorLaunch).
+    const remoteCodexState =
+      remoteSession && remoteHome ? this.executorPlane?.codexStateFor(remoteSession.subject, remoteHome) : undefined
     if (remoteSession && (!remoteHome || !remoteRoots)) {
       throw new Error(
         `session ${remoteSession.leaf} has no environment on daemon ${remoteSession.executorDaemonId} to launch in — its next turn prepares one`
@@ -6856,7 +6859,9 @@ export class Daemon {
               }
             }
           : {}),
-        ...(remoteHome ? { executor: { home: remoteHome } } : {}),
+        ...(remoteHome
+          ? { executor: { home: remoteHome, ...(remoteCodexState ? { codexState: remoteCodexState } : {}) } }
+          : {}),
         ...(opts.sessionGitDirs ? { sessionGitDirs: opts.sessionGitDirs } : {}),
         ...(srtShim ? { srtShim: { runtimeRoot: srtShim.runtimeRoot } } : {}),
         runtimeId: runtimeEntry?.aliasOf ?? agent.runtime,
```

**File**: `packages/daemon/src/execution/executor-facet.ts` (modified, +5/-0)
```diff
@@ -30,6 +30,7 @@ import type { Logger } from '../log.js'
 import { ownCredentialEnv } from '../microsandbox/secrets.js'
 import { prepareSharedRuntimeCredentials } from '../runtimes/runtime-credentials.js'
 import { prepareRuntimeHome } from '../runtimes/runtime-home.js'
+import { CODEX_STATE_SECRETS, privateRuntimeState } from '../runtimes/private-runtime-state.js'
 import { workspaceIncarnationOf } from '../skills/workspace-incarnation.js'
 import { PIPE_KEY_BYTES, startPipeListener, type PipeListener, type PipeListenerOptions } from './executor-pipe.js'
 import { hostedEnvironment } from './executor-vm.js'
@@ -400,6 +401,9 @@ class Facet implements ExecutorFacet {
     // The skill ledger's key: this directory outlives the launch, so its next launch must find the receipts this one leaves.
     const workspaceIncarnation = await workspaceIncarnationOf(join(this.sessionsDir, env.leaf)).catch(() => undefined)
     if (env.generation !== generation || !env.shim || !this.listener) return refused('launch_retired')
+    // The holder cannot list this HOME nor the shared file its credential link points at: this machine classifies it.
+    const codexHome = join(this.sessionsDir, env.leaf, 'home')
+    const codexState = privateRuntimeState(join(codexHome, '.codex'), CODEX_STATE_SECRETS)
     env.key = randomBytes(PIPE_KEY_BYTES)
     env.reply = {
       status: 'ready',
@@ -410,6 +414,7 @@ class Facet implements ExecutorFacet {
       ...(env.shim.helperRoot === undefined ? {} : { helperRoot: env.shim.helperRoot }),
       ...(env.shim.missingHelpers.length > 0 ? { missingHelpers: env.shim.missingHelpers } : {}),
       ...(runtimeLaunch ? { runtimeLaunch } : {}),
+      ...(codexState.readOnly.length > 0 ? { codexState: { home: codexHome, ...codexState } } : {}),
       ...(workspaceIncarnation ? { workspaceIncarnation } : {}),
       liveCount: this.liveCount()
     }
```

**File**: `packages/daemon/src/execution/executor-plane.ts` (modified, +7/-0)
```diff
@@ -3,6 +3,7 @@ import { randomUUID } from 'node:crypto'
 import type { Socket } from 'node:net'
 import { ClientTransport, systemClock, type Clock } from '@agentconnect.md/connection'
 import type { ExecutorPrepareResult, ExecutorReleaseResult } from '@agentconnect.md/protocol'
+import type { PrivateRuntimeState } from '../runtimes/private-runtime-state.js'
 import { sessionKeyDirName } from '../acp/host-key.js'
 import type { RuntimeDef } from '../config/config-schema.js'
 import { clusterMetrics } from '../metrics/cluster-metrics.js'
@@ -307,6 +308,12 @@ export class ExecutorPlane implements ExecutionPlane {
     return launch?.ready?.workspaceIncarnation ?? launch?.sandboxUid
   }
 
+  /** The session `.codex` split its executor reported (prepareExecutorLaunch), for the HOME the holder launches in; undefined for an executor that reports none, or classified another HOME. */
+  codexStateFor(subject: SandboxSubject, home: string): PrivateRuntimeState | undefined {
+    const reported = this.registry.currentLaunch(subject)?.ready?.codexState
+    return reported?.home === home ? { readOnly: reported.readOnly, secret: reported.secret } : undefined
+  }
+
   shimGenerationFor(subject: string): number | undefined {
     return this.registry.currentLaunch(subject)?.generation
   }
```

**File**: `packages/daemon/src/launch/assemble.ts` (modified, +2/-1)
```diff
@@ -5,6 +5,7 @@ import type { SandboxMechanism } from '../acp/sandbox.js'
 import type { HostKey } from '../acp/host-key.js'
 import type { MemoryProviderKind } from '../memory/provider.js'
 import type { RuntimeDef, SandboxMount } from '../config/config-schema.js'
+import type { PrivateRuntimeState } from '../runtimes/private-runtime-state.js'
 
 /** The config-file plan plus the pre-strip env it came from, which the idle sweep re-materializes this disk's files from. */
 export interface AssembledConfigFiles extends MaterializeResult {
@@ -64,7 +65,7 @@ export interface AssembleRuntimeLaunchOptions {
     trustedMounts?: SandboxMount[]
   }
   /** A session placed on another machine: its HOME in that machine's coordinates. */
-  executor?: { home: string }
+  executor?: { home: string; codexState?: PrivateRuntimeState }
   /** A session whose clones are off this disk: their `.git` where they are (see prepareRuntimeLaunch). */
   sessionGitDirs?: string[]
   /** A confined session launched through the SRT-wrapped shim rooted here (see prepareRuntimeLaunch). */
```

**File**: `packages/daemon/src/launch/compose.ts` (modified, +2/-1)
```diff
@@ -15,6 +15,7 @@ import {
 } from '../memory/runtime/capabilities.js'
 import { MemoryProviderUnavailableError, type MemoryProviderKind } from '../memory/provider.js'
 import type { RuntimeDef, SandboxMount } from '../config/config-schema.js'
+import type { PrivateRuntimeState } from '../runtimes/private-runtime-state.js'
 import { CLAUDE_PROFILE_ENV, isClaudeRuntimeDef } from '../runtime-defs/claude-runtime.js'
 import { runtimeExecutableHints } from '../runtime-defs/executable-hints.js'
 import { resolveCommandPath } from '../runtimes/probe.js'
@@ -177,7 +178,7 @@ export function composeRuntimeLaunch(opts: {
     trustedMounts?: SandboxMount[]
   }
   /** A session placed on another machine: its HOME there (see prepareRuntimeLaunch). */
-  executor?: { home: string }
+  executor?: { home: string; codexState?: PrivateRuntimeState }
   /** A session whose clones are off this disk: their `.git` where they are (see prepareRuntimeLaunch). */
   sessionGitDirs?: string[]
   /** A confined session launched through the SRT-wrapped shim rooted here (see prepareRuntimeLaunch). */
```

---

### Incident Patch 14: `83023e02` (2026-10-03)
**Commit Message**: fix(control-plane): let daemon-group members on one shared store serve each other's sessions (#2772)

A daemon group whose members all run a `postgres` store (#2188) shares session rows,
as daemon-groups.md §5 describes, but the control plane only counted the org-less pool
as a shared store. Every session therefore stayed bound to the member that recorded it:
once the next turn resolved to another member (an idle agent, a failover, a restart), a
resume answered 409 "the agent moved since this conversation ran".

- The daemon's data-plane schema gains a one-row `store_identity` (one id per database),
  reported as `capabilities.contentStore` on register; absent on a private store.
- A session is stamped with its recorder's store id (`session_meta.contentStoreId`), and
  `contentSetId` is now stamped for an org set too when the recorder reports one.
- `sharedStoreMemberIdsOf` takes the session: every member of the pool as before, and in
  an org set only the members still reporting the session's store id.

**File**: `docs/designs/daemon-groups.md` (modified, +4/-1)
```diff
@@ -286,7 +286,10 @@ These are the operator's, not the code's:
   a webchat turn that reaches another member is refused rather than answered blind.
   Members that set `store: { "backend": "postgres", "configFile": … }` against one
   database share those rows, the same way pool members do
-  ([cloud-data-plane-postgres.md](cloud-data-plane-postgres.md)). A session that ran on
+  ([cloud-data-plane-postgres.md](cloud-data-plane-postgres.md)). Each such member reports
+  its store's id (one per database) on register, and a session is stamped with its
+  recorder's; another member reads it, or takes its next turn, only while it reports that
+  same id. A session recorded before its recorder reported one stays with the recorder. A session that ran on
   its holder still keeps its runtime state on that machine; one placed on an executor
   resumes from the successor. On a member's own store, the rows a moved duty leaves
   behind are that member's alone, so its retention sweep ages them out like any others
```

**File**: `packages/control-plane/prisma/migrations/20261107000000_session_content_store_id/migration.sql` (added, +7/-0)
```diff
@@ -0,0 +1,7 @@
+-- Which shared store a session's rows went to, as the recorder reported it (`capabilities.contentStore`).
+--
+-- `contentSetId` was stamped only for the org-less pool, whose members provably share one store. A
+-- daemon group's members may run a `postgres` store too (#2188), but each machine chooses its own, so
+-- the set alone proves nothing: two members share rows only when they report the same store id.
+-- Existing rows stay null; the pool keeps answering for them as before.
+ALTER TABLE "session_meta" ADD COLUMN "contentStoreId" UUID;
```

**File**: `packages/control-plane/prisma/schema.prisma` (modified, +4/-0)
```diff
@@ -1361,6 +1361,10 @@ model SessionMeta {
   /// nobody else can read. Session-bound on purpose: the agent's CURRENT placement is no evidence
   /// about where a past session ran (`domain/session-content.ts`).
   contentSetId        String?             @db.Uuid
+  /// The recorder's shared store id (`capabilities.contentStore`), stamped beside `contentSetId`. In an
+  /// org set only the members still reporting this id hold the rows; null for the pool's older rows,
+  /// where every member does.
+  contentStoreId      String?             @db.Uuid
   // Session-pinned checkout choice. Null is a legacy row whose daemon never
   // reported it; `session` identifies a daemon-local worktree eligible for the
   // authorized Workspace viewer.
```

**File**: `packages/control-plane/src/codehost/session-pull-request-feedback.service.ts` (modified, +1/-3)
```diff
@@ -229,9 +229,7 @@ export class SessionPullRequestFeedbackService {
     if (!(await this.deps.validate(item, agent))) return true
     const daemonId = await this.deps.placement.dispatchDaemon(agent)
     if (!daemonId) return false
-    const sharedStoreMembers = session.contentSetId
-      ? await this.deps.memberSets.sharedStoreMemberIdsOf(session.contentSetId)
-      : []
+    const sharedStoreMembers = await this.deps.memberSets.sharedStoreMemberIdsOf(session)
     if (!servesSessionContent({ recordedDaemonId: session.daemonId, sharedStoreMembers }, daemonId)) return false
     const daemon = this.deps.daemon(daemonId)
     const feature =
```

**File**: `packages/control-plane/src/domain/session-content.ts` (modified, +4/-1)
```diff
@@ -5,7 +5,10 @@
  * `SessionMeta.daemonId` names the daemon that FIRST reported the session, and for a
  * self-hosted daemon that is also the only machine holding the rows — its store is local.
  * A cluster pool member is different: its store is the install-wide data-plane Postgres
- * every member shares, so the content outlives the pod that recorded it. Pool members are
+ * every member shares, so the content outlives the pod that recorded it. A daemon group's
+ * members can share one too (a `postgres` store, #2188), but each machine picks its own, so
+ * there a member counts only while it reports the store id the session was stamped with
+ * (`SessionMeta.contentStoreId`). Pool members are
  * bound to a Pod UID and reaped 15 minutes after they go silent, which SetNulls `daemonId`
  * on every session they recorded — so routing by that column alone loses transcripts that
  * are still fully there.
```

**File**: `packages/control-plane/src/http/routes/sessions.ts` (modified, +2/-4)
```diff
@@ -589,14 +589,12 @@ export function sessionRoutes(deps: HttpDeps) {
     type ContentRead<T> = { ok: true; value: T } | { ok: false; reason: 'unplaced' | 'offline' }
     const readSessionContent = async <T>(
       req: FastifyRequest,
-      session: { daemonId: string | null; contentSetId: string | null },
+      session: { daemonId: string | null; contentSetId: string | null; contentStoreId: string | null },
       read: (daemonId: string) => Promise<T>
     ): Promise<ContentRead<T>> => {
       const readers = sessionContentReaders({
         recordedDaemonId: session.daemonId,
-        sharedStoreMembers: session.contentSetId
-          ? await deps.repos.memberSet.sharedStoreMemberIdsOf(session.contentSetId)
-          : []
+        sharedStoreMembers: await deps.repos.memberSet.sharedStoreMemberIdsOf(session)
       })
       if (readers.length === 0) return { ok: false, reason: session.daemonId ? 'offline' : 'unplaced' }
       // EVERY failure moves to the next holder of the same store, not just an unreachable socket:
```

**File**: `packages/control-plane/src/http/session-continuation.ts` (modified, +3/-4)
```diff
@@ -6,6 +6,7 @@ import {
 import { servesSessionContent } from '../domain/session-content.js'
 import type { ResolvableAgent } from '../orchestrator/placementResolver.js'
 import type { HttpDeps } from './deps.js'
+import type { SessionContentStore } from '../persistence/ports.js'
 
 /** Why no daemon can host a session continuation right now — the detail view's reason vocabulary. */
 export type ContinuationHostRefusal = 'agent_moved' | 'daemon_offline' | 'unavailable'
@@ -15,15 +16,13 @@ export type ContinuationHost = { ok: true; daemonId: string } | { ok: false; rea
 /** The ONE answer to "which daemon continues this session" — the detail projection (`canContinue`) and the session-target mint both read it, so they cannot disagree. The daemon a turn reaches (`dispatchDaemon`) must be the recorder or a holder of the shared store the rows went to (`domain/session-content.ts`); keying on `session.daemonId` alone read as "agent moved" for every pooled agent once its recorder pod rolled. */
 export async function resolveContinuationHost(
   deps: Pick<HttpDeps, 'placementResolver' | 'daemonConns' | 'repos' | 'config'>,
-  session: { platform: string | null; daemonId: string | null; contentSetId: string | null },
+  session: { platform: string | null; daemonId: string | null } & SessionContentStore,
   agent: ResolvableAgent
 ): Promise<ContinuationHost> {
   const daemonId = await deps.placementResolver.dispatchDaemon(agent)
   // A machine placement always names its daemon; only a set with no live member resolves to nobody.
   if (!daemonId) return { ok: false, reason: 'daemon_offline' }
-  const sharedStoreMembers = session.contentSetId
-    ? await deps.repos.memberSet.sharedStoreMemberIdsOf(session.contentSetId)
-    : []
+  const sharedStoreMembers = await deps.repos.memberSet.sharedStoreMemberIdsOf(session)
   if (!servesSessionContent({ recordedDaemonId: session.daemonId, sharedStoreMembers }, daemonId)) {
     return { ok: false, reason: 'agent_moved' }
   }
```

**File**: `packages/control-plane/src/persistence/ports.ts` (modified, +13/-4)
```diff
@@ -1322,6 +1322,8 @@ export interface SessionMetaRecord {
   /** The member set whose shared store holds this session's content; null ⇒ the recorder kept a
    *  private one. Session-bound provenance that outlives `daemonId` (domain/session-content.ts). */
   contentSetId: string | null
+  /** The recorder's shared store id, stamped beside `contentSetId`; null ⇒ none reported. */
+  contentStoreId: string | null
   workspaceIsolation: 'shared' | 'session' | null
   /** Birth verdict (session-executors.md §7): the group member executing this session, or the reason
    *  it stayed with its holder. At most one is ever set; both null on a session born before the feature. */
@@ -7444,6 +7446,12 @@ export interface OrgInviteLinkRepo {
 // MemberSetRepo — the sets a duty may be claimed within (daemon-groups.md §2)
 // ───────────────────────────────────────────────────────────────────────────
 
+/** Where a session's rows were written: its content set, and the store id its recorder reported. */
+export interface SessionContentStore {
+  contentSetId: string | null
+  contentStoreId: string | null
+}
+
 /** A member set. `orgId` null means CROSS-ORG (the install-wide pool), never "unassigned". */
 export interface MemberSetRecord {
   id: string
@@ -7463,10 +7471,11 @@ export interface MemberSetRepo {
   setOf(daemonId: DaemonId): Promise<MemberSetRecord | null>
   /** The set's members, sorted. The read path for "who could serve a `set`-placed agent". */
   memberIdsOf(setId: string): Promise<string[]>
-  /** The set's members, sorted, but ONLY for a set whose members share one content store — the
-   *  org-less install-wide pool. An org set answers `[]`: its machines may keep private stores, so
-   *  none of them can stand in for another's transcripts (domain/session-content.ts). */
-  sharedStoreMemberIdsOf(setId: string): Promise<string[]>
+  /** The members of a session's content set that hold the store it was written to, sorted: every
+   *  member of the org-less install-wide pool, and in an org set only those reporting the session's
+   *  `contentStoreId` — its machines may keep private stores, which none of them can read for
+   *  another (domain/session-content.ts). `[]` for a session with no content set. */
+  sharedStoreMemberIdsOf(session: SessionContentStore): Promise<string[]>
   /** Record a membership under the set's tenancy invariant; throws MemberSetTenancyMismatch.
    *  The automatic path (a pool Pod on auth) — no operator precondition. */
   enroll(setId: string, daemonId: DaemonId): Promise<void>
```

---

### Incident Patch 15: `620983da` (2026-10-03)
**Commit Message**: fix(daemon): key a placed session's skill ledger on its directory, not its launch (#2775)

A session placed on an executor keeps its directory across launches: the holder's idle close,
or a restart of either daemon, ends the launch and the next turn starts a new one over the same
directory. The holder keyed the cluster skill ledger on the launch's sandbox uid, so a relaunched
session found no ledger, the skills its first launch installed counted as unowned, and every
turn failed with `cluster skill ownership conflict`.

The executor now reports the session directory's identity (path, device, inode — the key a local
VM's workspace already uses) as `workspaceIncarnation` in its `ready` reply, and the holder keys
the ledger on it. An executor that reports none keeps the launch as the key. The shim binding
stays fenced on the launch.

**File**: `packages/daemon/src/execution/executor-facet.ts` (modified, +5/-0)
```diff
@@ -30,6 +30,7 @@ import type { Logger } from '../log.js'
 import { ownCredentialEnv } from '../microsandbox/secrets.js'
 import { prepareSharedRuntimeCredentials } from '../runtimes/runtime-credentials.js'
 import { prepareRuntimeHome } from '../runtimes/runtime-home.js'
+import { workspaceIncarnationOf } from '../skills/workspace-incarnation.js'
 import { PIPE_KEY_BYTES, startPipeListener, type PipeListener, type PipeListenerOptions } from './executor-pipe.js'
 import { hostedEnvironment } from './executor-vm.js'
 import { sweepStaleHostShims } from './host-shim.js'
@@ -396,6 +397,9 @@ class Facet implements ExecutorFacet {
     if (env.generation !== generation || !env.shim || !this.listener) return refused('launch_retired')
     const host = this.deps.endpointHost()
     if (!host) throw new Error('the control connection has no local address to publish')
+    // The skill ledger's key: this directory outlives the launch, so its next launch must find the receipts this one leaves.
+    const workspaceIncarnation = await workspaceIncarnationOf(join(this.sessionsDir, env.leaf)).catch(() => undefined)
+    if (env.generation !== generation || !env.shim || !this.listener) return refused('launch_retired')
     env.key = randomBytes(PIPE_KEY_BYTES)
     env.reply = {
       status: 'ready',
@@ -406,6 +410,7 @@ class Facet implements ExecutorFacet {
       ...(env.shim.helperRoot === undefined ? {} : { helperRoot: env.shim.helperRoot }),
       ...(env.shim.missingHelpers.length > 0 ? { missingHelpers: env.shim.missingHelpers } : {}),
       ...(runtimeLaunch ? { runtimeLaunch } : {}),
+      ...(workspaceIncarnation ? { workspaceIncarnation } : {}),
       liveCount: this.liveCount()
     }
     return env.reply
```

**File**: `packages/daemon/src/execution/executor-plane.ts` (modified, +3/-2)
```diff
@@ -301,9 +301,10 @@ export class ExecutorPlane implements ExecutionPlane {
     )
   }
 
-  /** The environment incarnation a skill receipt is fenced on: the launch, which is one environment life. */
+  /** The incarnation a skill receipt is fenced on: the session directory the executor reported, which outlives a launch (an idle close, a restart), else the launch for an executor that reports none. */
   workspaceIncarnationFor(subject: string): string | undefined {
-    return this.registry.currentLaunch(subject)?.sandboxUid
+    const launch = this.registry.currentLaunch(subject)
+    return launch?.ready?.workspaceIncarnation ?? launch?.sandboxUid
   }
 
   shimGenerationFor(subject: string): number | undefined {
```

**File**: `packages/daemon/src/microsandbox/shim.ts` (modified, +4/-6)
```diff
@@ -1,5 +1,5 @@
-import { createHash, randomBytes } from 'node:crypto'
-import { lstat, readFile, realpath } from 'node:fs/promises'
+import { randomBytes } from 'node:crypto'
+import { readFile } from 'node:fs/promises'
 import { dirname, join } from 'node:path'
 import { fileURLToPath } from 'node:url'
 import type { Duplex } from 'node:stream'
@@ -8,6 +8,7 @@ import { z } from 'zod'
 import type { Logger } from '../log.js'
 import type { ShimSession } from '../shim/session.js'
 import { ClusterSkillClient } from '../shim/skill-client.js'
+import { workspaceIncarnationOf } from '../skills/workspace-incarnation.js'
 import { DEFAULT_SHIM_RUNTIME_ROOT, SANDBOX_SKILL_STAGING_DIR } from '../shim/sandbox-paths.js'
 import {
   DEFAULT_SHIM_LISTEN_PORT,
@@ -76,11 +77,8 @@ print(root, flush=True)
 /** A local VM's skills seam over its bound shim, fenced on the workspace's own identity. */
 export async function microsandboxSkillTarget(session: Pick<ShimSession, 'request' | 'hasCapability'>, cwd: string) {
   // VM replacement preserves bind-mounted storage; replacing that storage must revoke its receipts.
-  const stat = await lstat(cwd, { bigint: true })
-  if (!stat.isDirectory()) throw new Error('skill workspace root is unsafe')
-  const identity = [await realpath(cwd), String(stat.dev), String(stat.ino)]
   return {
-    workspaceIncarnation: `workspace:${createHash('sha256').update(JSON.stringify(identity)).digest('hex')}`,
+    workspaceIncarnation: await workspaceIncarnationOf(cwd),
     client: new ClusterSkillClient(
       { request: (capability, request, options) => session.request(capability, { cwd, request }, options) },
       session.hasCapability('skills-wide'),
```

**File**: `packages/daemon/src/skills/workspace-incarnation.ts` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+import { createHash } from 'node:crypto'
+import { lstat, realpath } from 'node:fs/promises'
+
+/** The key a workspace's skill ledger is kept under: the directory itself (path, device, inode), so a later launch over the same directory finds its receipts and a replaced directory starts clean. */
+export async function workspaceIncarnationOf(dir: string): Promise<string> {
+  const stat = await lstat(dir, { bigint: true })
+  if (!stat.isDirectory()) throw new Error('skill workspace root is unsafe')
+  const identity = [await realpath(dir), String(stat.dev), String(stat.ino)]
+  return `workspace:${createHash('sha256').update(JSON.stringify(identity)).digest('hex')}`
+}
```

**File**: `packages/daemon/test/executor-facet.test.ts` (modified, +9/-2)
```diff
@@ -20,6 +20,7 @@ import {
 import { PIPE_TLS } from '../src/execution/executor-pipe.js'
 import type { EnvironmentDescriptor, StrategyLauncher } from '../src/execution/strategies.js'
 import { DEFAULT_SHIM_RUNTIME_ROOT } from '../src/shim/sandbox-paths.js'
+import { workspaceIncarnationOf } from '../src/skills/workspace-incarnation.js'
 import { WAIT } from './wait-support.js'
 
 const AGENT = '11111111-1111-4111-8111-111111111111'
@@ -296,6 +297,8 @@ describe('executor facet', () => {
         runtimeRoot: join(root!, 'hs', '1'),
         helperRoot: '/opt/example/dist',
         missingHelpers: ['gitCredentialHelper'],
+        // The session directory's own identity, which its skill ledger is kept under across launches.
+        workspaceIncarnation: await workspaceIncarnationOf(join(root!, 'sessions', LEAF)),
         liveCount: 1
       })
       expect(Buffer.from(reply.psk, 'base64url')).toHaveLength(32)
@@ -456,15 +459,19 @@ describe('executor facet', () => {
 
     it('remembers the generation and the launch across a restart, and gives the interrupted launch no second key', async () => {
       const first = await start()
-      expect(ready(await first.facet.prepare(req(5))).generation).toBe(1)
+      const before = ready(await first.facet.prepare(req(5)))
+      expect(before.generation).toBe(1)
       await first.facet.stop()
       facets = []
       const { facet } = await start()
       // The reply died with the process, and minting a second key at the same generation would arm whoever replayed it.
       expect(await facet.prepare(req(5))).toEqual({ status: 'refused', reason: 'launch_retired' })
       expect(starts).toHaveLength(1)
       // The holder answers a retired launch with a new one, which starts the environment again past the generation on disk.
-      expect(ready(await facet.prepare(req(6))).generation).toBe(2)
+      const after = ready(await facet.prepare(req(6)))
+      expect(after.generation).toBe(2)
+      // The same directory under the new launch: the skills the first one installed stay its own.
+      expect(after.workspaceIncarnation).toBe(before.workspaceIncarnation)
       expect(starts).toHaveLength(2)
       expect(record()).toMatchObject({ generation: 2, launchId: LAUNCH(6) })
     })
```

**File**: `packages/daemon/test/executor-plane.test.ts` (modified, +24/-0)
```diff
@@ -197,6 +197,30 @@ describe('the session life', () => {
   })
 })
 
+describe('the key a placed session keeps its skill ledger under', () => {
+  const WORKSPACE = 'workspace:5e7b6f7c0d0a4c1f9a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f'
+
+  it('is the session directory the executor reported, the same after an idle close relaunches it', async () => {
+    const { executor, sent } = plane([
+      ready(2, { workspaceIncarnation: WORKSPACE }),
+      ready(3, { workspaceIncarnation: WORKSPACE })
+    ])
+    await executor.prepareAt(AGENT, KEY, [HOST])
+    expect(executor.workspaceIncarnationFor(SUBJECT)).toBe(WORKSPACE)
+    await executor.suspendIdle(SUBJECT)
+    await executor.prepareAt(AGENT, KEY, [HOST])
+    // A new launch over the same directory: its skills are the ones the ledger already records, not foreign ones.
+    expect(sent[0]!.launchId).not.toBe(sent[1]!.launchId)
+    expect(executor.workspaceIncarnationFor(SUBJECT)).toBe(WORKSPACE)
+  })
+
+  it('is the launch for an executor that reports no directory', async () => {
+    const { executor, sent } = plane([ready(2)])
+    await executor.prepareAt(AGENT, KEY, [HOST])
+    expect(executor.workspaceIncarnationFor(SUBJECT)).toBe(sent[0]!.launchId)
+  })
+})
+
 describe('the adapter a placed session starts', () => {
   // What this machine's own store would launch: its node and a tree only it has.
   const own = { command: '/opt/holder/node', args: ['/srv/holder/runtimes/adapter@1.0.0/bin.js', '--acp'], env: [] }
```

**File**: `packages/protocol/src/frames/executor.test.ts` (modified, +1/-0)
```diff
@@ -311,6 +311,7 @@ describe('executor/prepare', () => {
         runtimeRoot: '/home/agent/workspace/hs/0a1b2c3d4e5f',
         helperRoot: '/opt/agentconnect',
         missingHelpers: ['ghWrapperDir'],
+        workspaceIncarnation: 'workspace:0a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9',
         liveCount: 4
       },
       { status: 'full', liveCount: 32 },
```

**File**: `packages/protocol/src/frames/executor.ts` (modified, +1/-0)
```diff
@@ -141,6 +141,7 @@ export const ExecutorPrepareResult = z.discriminatedUnion('status', [
     helperRoot: z.string().min(1).max(4096).optional(), // a `host` executor's own bundle; absent ⇒ the image's default
     missingHelpers: z.array(z.string().min(1).max(64)).optional(), // `shimPaths` keys the executor has nothing at
     runtimeLaunch: ExecutorRuntimeLaunch.optional(), // how this machine starts the runtime `prepare` named; absent ⇒ not asked, or it has none
+    workspaceIncarnation: z.string().min(1).max(256).optional(), // the session directory's identity on the executor, the same across its launches: the key its skill ledger is kept under; absent ⇒ an older executor, keyed on the launch
     liveCount: z.number().int().min(0) // environments live on the executor now, this one included
   }),
   z.object({ status: z.literal('full'), liveCount: z.number().int().min(0).optional() }),
```

#### Recent Merged Pull Requests:
- **PR #2805** (2026-10-06): chore(runtime): pin Claude ACP 0.86.0 (@agentconnect-md-test[bot])
- **PR #2804** (2026-10-06): fix(daemon): remove a placed session's skills left at its session directory (@zfy0701)
- **PR #2803** (2026-10-06): fix(daemon): skip a locally edited installed skill instead of failing every turn (@zfy0701)
- **PR #2801** (2026-10-06): fix(daemon): install a placed session's skills into its checkout (@joerideturck)
- **PR #2800** (2026-10-05): fix(daemon): let a Codex first turn wait for slow MCP servers (@zfy0701)
- **PR #2799** (2026-10-05): fix(daemon): run a sandbox git credential helper through sh (@joerideturck)
- **PR #2798** (2026-10-04): chore(acp): update DeepSeek runtime and SDK (@agentconnect-md-test[bot])
- **PR #2797** (2026-10-04): fix(daemon): idle sweep takes over running pods no launch tracks (@zfy0701)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
