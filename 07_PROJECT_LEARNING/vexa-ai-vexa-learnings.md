# Forensic Learning Record (Deep Inspection): Vexa-ai/vexa

> **Canonical Artifact**: `07_PROJECT_LEARNING/vexa-ai-vexa-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Vexa-ai/vexa](https://github.com/Vexa-ai/vexa))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:06:29.445Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Vexa-ai/vexa`
- **Description**: Open-source meeting transcription API for Google Meet, Microsoft Teams & Zoom. Auto-join bots, real-time WebSocket transcripts, MCP server for AI agents. Self-host or use hosted SaaS.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2852 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `clients/extension/src/transcript-rendering/dedup.ts`
```
import type { TranscriptSegment } from './types';
import { parseUTCTimestamp } from './timestamps';

function normalizeText(t: string): string {
  let s = (t || '').trim().toLowerCase();
  // Strip trailing punctuation with a scan: transcript text is model output of
  // unbounded length, so no backtracking regex may run over its tail.
  let end = s.length;
  while (end > 0 && '.,!?;:'.includes(s[end - 1])) end--;
  return s.slice(0, end).replace(/\s+/g, ' ');
}

/**
 * Deduplicate overlapping transcript segments.
 *
 * **Speaker-aware:** segments from different speakers are NEVER deduped against
 * each other, even if their timestamps overlap. This is critical for per-speaker
 * pipelines where concurrent speakers produce legitimately overlapping time ranges.
 *
 * Within the same speaker, handles:
 * - Adjacent duplicates (same text, gap ≤1s)
 * - Full containment (shorter segment inside longer)
 * - Expansion (partial → full text, e.g., draft → confirmed)
 * - Tail-repeat fragments (tiny echo already present in previous)
 *
 * Segments must be sorted by absolute_start_time before calling.
 *
 * @param segments - Array of segments sorted by absolute_start_time
 * @returns Deduplicated array preserving all original properties
 */
export function deduplicateSegments<T extends TranscriptSegment>(segments: T[]): T[] {
  if (segments.length === 0) return segments;

  const deduped: T[] = [];

  for (const seg of segments) {
    if (deduped.length === 0) {
      deduped.push(seg);
      continue;
    }

    const last = deduped[deduped.length - 1];

    // Different speakers: never dedup — overlapping timestamps are legitimate
    if ((seg.speaker || '') !== (last.speaker || '')) {
      deduped.push(seg);
      continue;
    }

    // Same speaker — apply dedup heuristics
    const segStart = parseUTCTimestamp(seg.absolute_start_time).getTime();
    const segEnd = parseUTCTimestamp(seg.absolute_end_time).getTime();
    const lastStart = parseUTCTimestamp(last.absolute_start_time).getTime();
    const lastEnd = parseUTCTimestamp(last.absolute_end_time).getTime();

    const segStartSec = segStart / 1000;
    const segEndSec = segEnd / 1000;
    const lastStartSec = lastStart / 1000;
    const lastEndSec = lastEnd / 1000;

    const sameText = (seg.text || '').trim() === (last.text || '').trim();
    const overlaps = Math.max(segStartSec, lastStartSec) < Math.min(segEndSec, lastEndSec);
    const gapSec = (segStart - lastEnd) / 1000;

    // Adjacent duplicate: same text within 1s gap
    if (!overlaps && sameText && gapSec >= 0 && gapSec <= 1) {
      // Prefer completed over draft, then longer duration
      if (preferSeg(seg, last)) {
        deduped[deduped.length - 1] = seg;
      }
      continue;
    }

    if (overlaps) {
      const segFullyInsideLast = segStartSec >= lastStartSec && segEndSec <= lastEndSec;
      const lastFullyInsideSeg = lastStartSec >= segStartSec && lastEndSec <= segEndSec;

      if (sameText) {
        if (preferSeg(seg, last)) {
          deduped[deduped.length - 1] = seg;
        }
        continue;
      }

      // Different text: containment.
      // Prefer the confirmed segment over a same-speaker draft regardless of
      // which one has the wider time range — Vexa routinely trims the
      // boundary tighter when confirming, which left the draft wider than
      // its own confirmed version and caused the pending-stuck bug.
      if (segFullyInsideLast) {
        if (seg.completed && !last.completed) {
          deduped[deduped.length - 1] = seg;
        }
        continue;
      }
      if (lastFullyInsideSeg) {
        // seg is wider. Keep it unless it's a draft while last is confirmed.
        if (last.completed && !seg.completed) {
          continue;
        }
        deduped[deduped.length - 1] = seg;
        continue;
      }

      // Partial overlap heuristics
      const segTextClean = normalizeText(seg.text || '');
      const lastTextClean = normalizeText(last.text || '');
      const segDuration = segEndSec - segStartSec;
      const lastDuration = lastEndSec - lastStartSec;
      const overlapStart = Math.max(segStartSec, lastStartSec);
      const overlapEnd = Math.min(segEndSec, lastEndSec);
      const overlapDuration = overlapEnd - overlapStart;
      const overlapRatioSeg = segDuration > 0 ? overlapDuration / segDuration : 0;
      const overlapRatioLast = lastDuration > 0 ? overlapDuration / lastDuration : 0;

      // Expansion: seg contains last's text and is longer
      const segExpandsLast =
        Boolean(lastTextClean) &&
        Boolean(segTextClean) &&
        segTextClean.includes(lastTextClean) &&
        segTextClean.length > lastTextClean.length;

      if (segExpandsLast && overlapRatioLast >= 0.5 && (seg.completed || !last.completed)) {
        deduped[deduped.length - 1] = seg;
        continue;
      }

      // Tail-repeat: seg text already inside last, and seg is tiny
      const segIsTailRepeat =
        Boolean(segTextClean) &&
        Boolean(lastTextClean) &&
        lastTextClean.includes(segTextClean);

      if (segIsTailRepeat) {
        const segWordCount = segTextClean.split(/\s+/).filter(w => w.length > 0).length;
        if (segDuration <= 1.5 && segWordCount <= 2 && overlapRatioSeg >= 0.25) {
          continue;
        }
      }
    }

    deduped.push(seg);
  }

  return deduped;
}

/** Return true if seg should replace last (prefer completed, then longer). */
function preferSeg<T extends TranscriptSegment>(seg: T, last: T): boolean {
  if (seg.completed && !last.completed) return true;
  if (!seg.completed && last.completed) return false;
  const segDur =
    parseUTCTimestamp(seg.absolute_end_time).getTime() -
    parseUTCTimestamp(seg.absolute_start_time).getTime();
  const lastDur =
    parseUTCTimestamp(last.absolute_end_time).getTime() -
    parseUTCTimestamp(last.absolute_start_time).getTime();
  return segDur > lastDur;
}

/**
 * Upsert segments into an existing map, handling draft→confirmed transitions.
 *
 * This is the core merge logic used by WS consumers (dashboard). Given a map
 * of existing segments (keyed by segment_id or absolute_start_time) and new
 * incoming segments, it:
 *
 * - Inserts new segments
 * - Updates existing segments when text or completed status changes
 * - Removes drafts when a confirmed segment from the same speaker arrives
 * - Deduplicates same-speaker same-text entries with different IDs
 *
 * @param existing - Map of existing segments (segment_id → segment)
 * @param incoming - New segments from WS or REST
 * @returns Updated map (mutates and returns `existing` for efficiency)
 */
export function upsertSegments<T extends TranscriptSegment>(
  existing: Map<string, T>,
  incoming: T[],
): Map<string, T> {
  for (const seg of incoming) {
    if (!seg.absolute_start_time || !(seg.text || '').trim()) continue;

    const key = seg.segment_id || seg.absolute_start_time;
    const prev = existing.get(key);

    // When a confirmed segment arrives, remove drafts from same speaker
    if (seg.completed && seg.speaker) {
      for (const [k, v] of existing.entries()) {
        if (k === key) continue;
        if (!v.completed && v.speaker === seg.speaker && k.includes(':draft:')) {
          existing.delete(k);
        }
      }
    }

    if (prev) {
      const prevText = (prev.text || '').trim();
      const newText = (seg.text || '').trim();
      const completedChanged = Boolean(prev.completed) !== Boolean(seg.completed);

      if (prevText !== newText || completedChanged) {
        existing.set(key, seg);
        continue;
      }

      // Same text — keep newer by updated_at
      if (prev.updated_at && seg.updated_at && prev.updated_at >= seg.updated_at) {
        continue;
      }
    }

    existing.set(key, seg);
  }

  // Remove draft→confirmed duplicates (same speaker + same text, different IDs)
  const textIndex = new Map<string, string>();
  for (const [key, seg] of existing.entries()) {
    const textKey = `${seg.speaker || ''}:${(seg.text || '').trim()}`;
    const existingKey = textIndex.get(textKey);

    if (existingKey && existingKey !== key) {
      const prev = existing.get(existingKey);
      if (prev) {
        if (seg.completed && !prev.completed) {
          existing.delete(existingKey);
        } else if (!seg.completed && prev.completed) {
          existing.delete(key);
          continue;
        }
      }
    }

    textIndex.set(textKey, key);
  }

  return existing;
}

/**
 * Sort segments by absolute_start_time (string comparison, ISO format).
 */
export function sortSegments<T extends TranscriptSegment>(segments: T[]): T[] {
  return [...segments].sort((a, b) =>
    a.absolute_start_time.localeCompare(b.absolute_start_time)
  );
}

/**
 * Sort segments by speech time (`start_time` seconds), not buffer confirmation time.
 *
 * `start_time` is relative to meeting start and reflects when speech occurred.
 * `absolute_start_time` reflects when the buffer was processed, which can be
 * out of order for different speakers with independent audio buffers.
 *
 * Falls back to `absolute_start_time` string comparison for segments with the
 * same `start_time`.
 */
export function sortByStartTime<T extends TranscriptSegment>(segments: T[]): T[] {
  return [...segments].sort((a, b) => {
    const aStart = a.start_time ?? 0;
    const bStart = b.start_time ?? 0;
    if (aStart !== bStart) return aStart - bStart;
    return a.absolute_start_time.localeCompare(b.absolute_start_time);
  });
}

/**
 * Deduplicate segments by identity key (`segment_id` or `absolute_start_time`).
 *
 * When two segments share the same key, the one with the newer `updated_at`
 * timestamp wins. This is a lightweight, identity-only dedup — it does not
 * inspect text overlap or time containment (use `deduplicateSegments` for that).
 *
 * Returns a new array in **encounter order** (not sorted).
 */
export function deduplicateByIdentity<T extends TranscriptSegment>(segments: T[]): T[] 
```

### Core Architecture Module: `clients/extension/src/transcript-rendering/grouping.ts`
```
import type { TranscriptSegment, SegmentGroup, GroupingOptions } from './types';

const DEFAULT_MAX_CHARS = 512;

function defaultGetGroupKey(segment: TranscriptSegment): string {
  return segment.speaker || 'Unknown';
}

/**
 * Group consecutive segments by a configurable key (default: speaker).
 *
 * Consecutive segments with the same key are merged into a single group.
 * Long groups are split into chunks at segment boundaries when combined text
 * exceeds `maxCharsPerGroup`.
 *
 * @param segments - Array of segments (will be sorted by absolute_start_time)
 * @param options - Grouping configuration
 * @returns Array of segment groups
 */
export function groupSegments<T extends TranscriptSegment>(
  segments: T[],
  options: GroupingOptions = {},
): SegmentGroup<T>[] {
  if (!segments || segments.length === 0) return [];

  const getGroupKey = options.getGroupKey ?? defaultGetGroupKey;
  const maxChars = options.maxCharsPerGroup ?? DEFAULT_MAX_CHARS;

  const sorted = [...segments].sort((a, b) =>
    a.absolute_start_time.localeCompare(b.absolute_start_time),
  );

  // Collect raw groups of consecutive same-key segments
  const rawGroups: { key: string; segments: T[] }[] = [];
  let current: { key: string; segments: T[] } | null = null;

  for (const seg of sorted) {
    const text = (seg.text || '').trim();
    if (!text) continue;

    const key = getGroupKey(seg);
    if (current && current.key === key) {
      current.segments.push(seg);
    } else {
      if (current) rawGroups.push(current);
      current = { key, segments: [seg] };
    }
  }
  if (current) rawGroups.push(current);

  // Split large groups at segment boundaries
  const groups: SegmentGroup<T>[] = [];

  for (const raw of rawGroups) {
    if (raw.segments.length === 0) continue;

    let chunkSegments: T[] = [];
    let chunkText = '';

    const flushChunk = () => {
      if (chunkSegments.length === 0) return;
      const first = chunkSegments[0];
      const last = chunkSegments[chunkSegments.length - 1];
      groups.push({
        key: raw.key,
        startTime: first.absolute_start_time,
        endTime: last.absolute_end_time || last.absolute_start_time,
        startTimeSeconds: first.start_time ?? 0,
        endTimeSeconds: last.end_time ?? 0,
        combinedText: chunkText.trim(),
        segments: chunkSegments,
      });
      chunkSegments = [];
      chunkText = '';
    };

    for (const seg of raw.segments) {
      const segText = (seg.text || '').trim();
      if (!segText) continue;

      const candidate = chunkText ? `${chunkText} ${segText}` : segText;
      if (chunkSegments.length > 0 && candidate.length > maxChars) {
        flushChunk();
      }
      chunkSegments.push(seg);
      chunkText = chunkText ? `${chunkText} ${segText}` : segText;
    }
    flushChunk();
  }

  return groups;
}

```

### Core Architecture Module: `clients/extension/src/transcript-rendering/index.ts`
```
export type { TranscriptSegment, SegmentGroup, GroupingOptions, TranscriptState } from './types';
export { deduplicateSegments, upsertSegments, sortSegments, sortByStartTime, deduplicateByIdentity } from './dedup';
export { groupSegments } from './grouping';
export { parseUTCTimestamp } from './timestamps';
export {
  createTranscriptState,
  bootstrapConfirmed,
  applyTranscriptTick,
  recomputeTranscripts,
  retractSegments,
  addSegment,
  bootstrapSegments,
} from './state';
export type { TranscriptManager, TranscriptMessage, TranscriptRetractMessage, TranscriptWireMessage } from './manager';
export { createTranscriptManager } from './manager';

```

### Core Architecture Module: `clients/extension/src/transcript-rendering/manager.ts`
```
import type { TranscriptSegment, TranscriptState } from './types';
import { createTranscriptState, bootstrapConfirmed, applyTranscriptTick, recomputeTranscripts, retractSegments } from './state';
import { deduplicateByIdentity, deduplicateSegments, sortSegments, sortByStartTime } from './dedup';

/**
 * Raw WebSocket transcript message from the Vexa gateway.
 *
 * Format: `{ type: "transcript", speaker, confirmed: [...], pending: [...] }`
 */
export interface TranscriptMessage {
  type: 'transcript';
  meeting?: { id?: number };
  speaker?: string;
  confirmed?: TranscriptSegment[];
  pending?: TranscriptSegment[];
  ts?: string;
}

/**
 * Withdrawal of previously-delivered segments, by id.
 *
 * Format: `{ type: "transcript_retract", segment_ids: [...] }`. The producer sends it
 * alongside any pending snapshot, because a snapshot replaces only one speaker's drafts
 * and cannot reach a confirmed row.
 */
export interface TranscriptRetractMessage {
  type: 'transcript_retract';
  meeting?: { id?: number };
  segment_ids?: string[];
  ts?: string;
}

/** Anything the gateway's mutable channel delivers to the rendering pipeline. */
export type TranscriptWireMessage = TranscriptMessage | TranscriptRetractMessage;

/**
 * High-level transcript manager that encapsulates the full pipeline.
 *
 * Consumers feed it raw WS messages or REST bootstrap data and get back
 * deduplicated, sorted segments ready for rendering.
 *
 * ```ts
 * const manager = createTranscriptManager();
 *
 * // Bootstrap from REST
 * const segments = manager.bootstrap(restSegments);
 * render(segments);
 *
 * // On each WS message
 * ws.onmessage = (e) => {
 *   const segments = manager.handleMessage(JSON.parse(e.data));
 *   if (segments) render(segments);
 * };
 * ```
 */
export interface TranscriptManager<T extends TranscriptSegment = TranscriptSegment> {
  /** Load initial segments from REST. Clears previous state. Returns ready-to-render segments. */
  bootstrap(segments: T[]): T[];
  /** Process a raw WS message. Returns updated segments if state changed, null otherwise. */
  handleMessage(message: TranscriptWireMessage): T[] | null;
  /** Get current deduplicated, sorted segments without processing a new message. */
  getSegments(): T[];
  /** Access the underlying state (for advanced use cases). */
  getState(): TranscriptState<T>;
  /** Reset all state. */
  clear(): void;
}

/**
 * Create a transcript manager that handles the full pipeline:
 * WS message parsing → confirmed/pending state → dedup → sort.
 */
export function createTranscriptManager<
  T extends TranscriptSegment = TranscriptSegment,
>(): TranscriptManager<T> {
  let state: TranscriptState<T> = createTranscriptState<T>();

  function finalize(segments: T[]): T[] {
    // 1. Identity dedup (by segment_id, keeps newer by updated_at)
    // 2. Sort by absolute_start_time (required input for overlap dedup)
    // 3. Overlap dedup (same speaker: adjacent duplicates, containment, expansion, tail-repeat)
    // 4. Sort by speech time for display
    return sortByStartTime(deduplicateSegments(sortSegments(deduplicateByIdentity(segments))));
  }

  return {
    bootstrap(segments: T[]): T[] {
      return finalize(bootstrapConfirmed(state, segments));
    },

    handleMessage(message: TranscriptWireMessage): T[] | null {
      if (message.type === 'transcript_retract') {
        const result = retractSegments(state, message.segment_ids || []);
        return result ? finalize(result) : null;
      }
      if (message.type !== 'transcript') return null;

      const confirmed = (message.confirmed || []) as T[];
      const pending = (message.pending || []) as T[];
      const speaker = message.speaker ?? undefined;

      const result = applyTranscriptTick(state, confirmed, pending, speaker);
      return result ? finalize(result) : null;
    },

    getSegments(): T[] {
      return finalize(recomputeTranscripts(state));
    },

    getState(): TranscriptState<T> {
      return state;
    },

    clear(): void {
      state = createTranscriptState<T>();
    },
  };
}

```

### Core Architecture Module: `clients/extension/src/transcript-rendering/state.ts`
```
import type { TranscriptSegment, TranscriptState } from './types';

/**
 * Create an empty transcript state container.
 */
export function createTranscriptState<T extends TranscriptSegment = TranscriptSegment>(): TranscriptState<T> {
  return { confirmed: new Map(), pendingBySpeaker: new Map() };
}

/**
 * Segment key used for identity throughout the state functions.
 */
function segKey<T extends TranscriptSegment>(seg: T): string {
  return seg.segment_id || seg.absolute_start_time;
}

// ---------------------------------------------------------------------------
// Two-map model (confirmed + pending per speaker)
// ---------------------------------------------------------------------------

/**
 * Bootstrap confirmed segments from a REST response (or any initial load).
 *
 * Clears both maps, populates `confirmed` from `segments`, and returns the
 * recomputed sorted transcript array.
 *
 * Segments without `absolute_start_time` or with empty text are filtered out.
 */
export function bootstrapConfirmed<T extends TranscriptSegment>(
  state: TranscriptState<T>,
  segments: T[],
): T[] {
  state.confirmed.clear();
  state.pendingBySpeaker.clear();

  for (const seg of segments) {
    if (!seg.absolute_start_time || !(seg.text || '').trim()) continue;
    state.confirmed.set(segKey(seg), seg);
  }

  return recomputeTranscripts(state);
}

/**
 * Apply a single WebSocket tick.
 *
 * - Appends `confirmed` segments to the confirmed map (keyed by segment_id).
 * - If `speaker` is provided, fully replaces that speaker's pending array.
 *
 * Returns the recomputed sorted transcript array, or `null` if nothing changed
 * (callers can skip a state update in that case).
 */
export function applyTranscriptTick<T extends TranscriptSegment>(
  state: TranscriptState<T>,
  confirmed: T[],
  pending?: T[],
  speaker?: string | null,
): T[] | null {
  let changed = false;

  for (const seg of confirmed) {
    if (!seg.absolute_start_time || !(seg.text || '').trim()) continue;
    state.confirmed.set(segKey(seg), seg);
    changed = true;
  }

  if (speaker !== undefined && speaker !== null) {
    const validPending = (pending || []).filter(
      s => s.absolute_start_time && (s.text || '').trim(),
    );
    if (validPending.length > 0) {
      state.pendingBySpeaker.set(speaker, validPending);
    } else {
      state.pendingBySpeaker.delete(speaker);
    }
    changed = true;
  }

  if (!changed) return null;

  return recomputeTranscripts(state);
}

/**
 * Withdraw segments by id, in both lanes.
 *
 * The producer retracts an id when the row behind it is gone — a draft superseded
 * under a new id, or a confirmed row a later ownership check refused. A pending
 * snapshot can only ever withdraw drafts, so the id-addressed retraction is the
 * only thing that clears a confirmed row without a reload.
 *
 * Returns the recomputed sorted transcript array, or `null` if no id matched
 * (callers can skip a state update in that case).
 */
export function retractSegments<T extends TranscriptSegment>(
  state: TranscriptState<T>,
  segmentIds: string[],
): T[] | null {
  if (!segmentIds || segmentIds.length === 0) return null;
  const ids = new Set(segmentIds);
  let changed = false;

  for (const [key, seg] of state.confirmed) {
    if (!ids.has(key) && !ids.has(segKey(seg))) continue;
    state.confirmed.delete(key);
    changed = true;
  }

  for (const [speaker, segs] of state.pendingBySpeaker) {
    const kept = segs.filter(s => !ids.has(segKey(s)));
    if (kept.length === segs.length) continue;
    if (kept.length > 0) state.pendingBySpeaker.set(speaker, kept);
    else state.pendingBySpeaker.delete(speaker);
    changed = true;
  }

  if (!changed) return null;

  return recomputeTranscripts(state);
}

/**
 * Recompute the merged transcript array from confirmed + pending maps.
 *
 * Confirmed segments are always included. Pending segments are included only
 * if they are **not stale** — a pending segment is stale when its text matches,
 * starts with, or is a prefix of any confirmed text for the same speaker.
 *
 * Result is sorted by `absolute_start_time`.
 */
export function recomputeTranscripts<T extends TranscriptSegment>(
  state: TranscriptState<T>,
): T[] {
  // Build confirmed-text index per speaker
  const confirmedBySpeaker = new Map<string, Set<string>>();
  for (const seg of state.confirmed.values()) {
    const speaker = seg.speaker || '';
    if (!confirmedBySpeaker.has(speaker)) confirmedBySpeaker.set(speaker, new Set());
    confirmedBySpeaker.get(speaker)!.add((seg.text || '').trim());
  }

  const all: T[] = [...state.confirmed.values()];

  for (const [speaker, segs] of state.pendingBySpeaker) {
    const confirmedTexts = confirmedBySpeaker.get(speaker);
    for (const seg of segs) {
      const pt = (seg.text || '').trim();
      let isStale = false;
      if (confirmedTexts) {
        for (const ct of confirmedTexts) {
          if (pt === ct || pt.startsWith(ct) || ct.startsWith(pt)) {
            isStale = true;
            break;
          }
        }
      }
      if (isStale) continue;
      all.push(seg);
    }
  }

  all.sort((a, b) => a.absolute_start_time.localeCompare(b.absolute_start_time));
  return all;
}

// ---------------------------------------------------------------------------
// Additive model (simple array, used for lightweight live-session stores)
// ---------------------------------------------------------------------------

/**
 * Add or update a segment in an existing array.
 *
 * - If a segment with the same identity already exists, it is replaced in place.
 * - If it's new **and** confirmed, same-speaker drafts that overlap in time are
 *   removed (prevents the "show, disappear, come back" flash).
 *
 * Returns a **new** array (does not mutate the input). Does **not** sort — the
 * caller should chain with the desired sort (e.g. `sortByStartTime`).
 */
export function addSegment<T extends TranscriptSegment>(
  segments: readonly T[],
  segment: T,
): T[] {
  const key = segKey(segment);
  const existingIndex = segments.findIndex(t => segKey(t) === key);

  let updated: T[];

  if (existingIndex !== -1) {
    // Same segment — update in place (latest version wins)
    updated = [...segments];
    updated[existingIndex] = segment;
  } else {
    updated = [...segments, segment];

    // When a confirmed segment arrives, remove same-speaker overlapping drafts
    if (segment.completed && segment.speaker) {
      const segStart = segment.start_time ?? 0;
      const segEnd = segment.end_time ?? segStart;
      updated = updated.filter(t => {
        if (t === segment) return true;
        if (t.completed) return true;
        if (t.speaker !== segment.speaker) return true;
        const tStart = t.start_time ?? 0;
        const tEnd = t.end_time ?? tStart;
        const overlaps = tStart < segEnd && tEnd > segStart;
        return !overlaps;
      });
    }
  }

  return updated;
}

/**
 * Bootstrap an array of segments: filter out invalid entries and deduplicate
 * by segment identity (last occurrence wins).
 *
 * Does **not** sort — the caller should chain with the desired sort.
 */
export function bootstrapSegments<T extends TranscriptSegment>(
  segments: T[],
): T[] {
  const valid = segments.filter(
    seg => seg.absolute_start_time && (seg.text || '').trim(),
  );

  const map = new Map<string, T>();
  for (const seg of valid) {
    map.set(segKey(seg), seg);
  }

  return Array.from(map.values());
}

```

### Core Architecture Module: `clients/extension/src/transcript-rendering/timestamps.ts`
```
/**
 * Parse a timestamp string as UTC.
 *
 * Many transcription APIs return timestamps without timezone suffix
 * (e.g., "2025-12-11T14:20:25.222296") which JavaScript interprets as local time.
 * This function ensures UTC interpretation by appending 'Z' when no timezone is present.
 */
export function parseUTCTimestamp(timestamp: string): Date {
  const hasZone = /[zZ]$/.test(timestamp) || /[+-]\d{2}:\d{2}$/.test(timestamp);
  return new Date(hasZone ? timestamp : `${timestamp}Z`);
}

```

### Core Architecture Module: `clients/extension/src/transcript-rendering/types.ts`
```
/**
 * Minimal segment interface required by the rendering pipeline.
 * Consumers extend this with their own fields — extra properties pass through untouched.
 */
export interface TranscriptSegment {
  text: string;
  speaker?: string;
  absolute_start_time: string;
  absolute_end_time: string;
  completed?: boolean;
  /** Stable segment identity (e.g., "speakerA:3" or "inject-0-10.5") */
  segment_id?: string;
  /** Relative start time in seconds (used by grouping) */
  start_time?: number;
  /** Relative end time in seconds (used by grouping) */
  end_time?: number;
  /** ISO timestamp of last update */
  updated_at?: string;
}

/**
 * A group of consecutive segments merged together (e.g., by speaker).
 */
export interface SegmentGroup<T extends TranscriptSegment = TranscriptSegment> {
  /** Grouping key (e.g., speaker name) */
  key: string;
  /** ISO absolute timestamp of the first segment */
  startTime: string;
  /** ISO absolute timestamp of the last segment */
  endTime: string;
  /** Relative start time in seconds */
  startTimeSeconds: number;
  /** Relative end time in seconds */
  endTimeSeconds: number;
  /** Combined text from all segments in the group */
  combinedText: string;
  /** Original segments that make up this group */
  segments: T[];
}

/**
 * Mutable state container for the two-map transcript model.
 *
 * - `confirmed`: segments keyed by segment_id (or absolute_start_time fallback).
 *   Append-only — each confirmed segment upserts by key.
 * - `pendingBySpeaker`: per-speaker array of draft segments, fully replaced on
 *   each WebSocket tick for that speaker.
 *
 * Passed to `bootstrapConfirmed`, `applyTranscriptTick`, and `recomputeTranscripts`.
 */
export interface TranscriptState<T extends TranscriptSegment = TranscriptSegment> {
  confirmed: Map<string, T>;
  pendingBySpeaker: Map<string, T[]>;
}

/**
 * Configuration for segment grouping.
 */
export interface GroupingOptions {
  /**
   * Returns the grouping key for a segment.
   * Consecutive segments with the same key are grouped together.
   * Default: groups by speaker.
   */
  getGroupKey?: (segment: TranscriptSegment) => string;
  /**
   * Maximum characters in a single group's combined text before splitting.
   * Default: 512
   */
  maxCharsPerGroup?: number;
}

```

### Core Architecture Module: `clients/extension/src/webrtc-hook.ts`
```
/**
 * DISABLED — the WebRTC remote-audio hook mirrored each remote participant's
 * track into a hidden <audio> for per-participant capture on Zoom/Teams. We do
 * NOT use that: Zoom can't expose per-participant audio (WASM) and Teams MUST
 * follow Zoom's mixed path exactly (one diarized tab-audio channel, 999). Leaving
 * the hook on would (a) re-introduce per-participant channels for Teams and
 * (b) double Teams audio (the mirrored <audio> elements play the remote track a
 * second time). Per-participant capture is Google Meet only (native elements).
 *
 * Kept as a no-op content script so the manifest/build stays stable; the shared
 * `installRemoteAudioHook` still lives in @vexa/capture for the bot's own use.
 *
 * It is registered at document_start in the MAIN world (the slot a future
 * re-enable would need) for Zoom/Teams only, mirroring the shipped manifest.
 */
export {};

```

### Core Architecture Module: `clients/terminal/src/app/onboardingState.ts`
```
/** Per-user onboarding flag — persisted in localStorage so onboarding fires EXACTLY ONCE per user and
 *  its state survives reloads (never re-triggered by a page refresh). Keyed by the user's identity so
 *  switching users is clean. */

const KEY = (uid: string) => `vexa.terminal.onboarded.${uid}`;

/** Has this user already been onboarded? */
export function isOnboarded(uid: string): boolean {
  try { return localStorage.getItem(KEY(uid)) === "1"; } catch { return false; }
}

/** Mark this user onboarded (the durable bool — set once the onboarding kickoff has run). */
export function setOnboarded(uid: string, done: boolean): void {
  try {
    if (done) localStorage.setItem(KEY(uid), "1");
    else localStorage.removeItem(KEY(uid));
  } catch { /* storage unavailable — onboarding just re-fires, harmless */ }
}

```

### Core Architecture Module: `clients/terminal/src/canvas/LiveTranscriptEngine.tsx`
```
"use client";
/** The ONE live-transcript render engine (P23: the terminal RENDERS, it does not re-derive). It paints a
 *  list of segments — CONFIRMED text is stable + append-only (consecutive same-speaker segments merge into
 *  one flowing block) and the in-flight PENDING text is a single dimmed "live" tail — so the body never
 *  flickers while the unconfirmed window re-forms. Fed RAW segments (transcript) or PROCESSED segments
 *  (the cleaned mirror, which also carry keyword `tags` to research) by exactly the same code; the toggle
 *  picks the source, not the engine.
 *
 *  PROCESSED v2 rendering: when `entities` is supplied, entity mentions are highlighted INLINE (colored
 *  by kind, clickable → Research · Open entity doc) and copilot `signals` render as small
 *  actionable badges under the relevant block. RAW mode passes neither, so it stays plain text. */

import { useEffect, useRef, useState } from "react";
import { splitTextIntoSpans, type SpanEntity } from "./inlineSpans";
import { entityColor } from "../ui-kit/docLinks";

export interface EngineTag { label: string; kind: string }
export interface EngineEntity { id?: string; label: string; kind: string; docPath?: string }
export interface EngineSignal { id: string; kind: string; label: string }
export interface EngineSegment { speaker?: string; text: string; tsMs?: number; id?: string; completed?: boolean; tags?: EngineTag[] }

export interface EngineActions {
  research?(entity: { id?: string; name: string; kind: string }): void;
  openEntityDoc?(entity: { id?: string; name: string; kind: string; docPath?: string }): void;
  onSignal?(signal: EngineSignal): void;
}

// Entity hues come from the ONE client-wide map (ui-kit/docLinks ENTITY_CHIP) so inline
// transcript highlights match [[wikilink]] chips exactly. Signals use semantic tokens.
const SIGNAL_HUE: Record<string, string> = { decision: "var(--violet)", "action-item": "var(--green)", action: "var(--green)", question: "var(--blue)", claim: "var(--warn)" };

function hueFor(kind: string): string {
  return entityColor(kind) ?? "var(--t2)";
}

/** An inline entity mention: colored, keyboard-focusable, opens a small action menu on click/Enter. */
function EntityMention({ entity, actions }: { entity: SpanEntity; actions?: EngineActions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const hue = hueFor(entity.kind);
  const arg = { id: entity.id, name: entity.label, kind: entity.kind, docPath: entity.docPath };

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); } };  // consume: close-topmost beats nav.back
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const run = (fn?: (a: typeof arg) => void) => () => { setOpen(false); fn?.(arg); };

  return (
    <span ref={ref} style={{ position: "relative", display: "inline" }}>
      <span
        role="button"
        tabIndex={0}
        aria-haspopup="menu"
        aria-expanded={open}
        title={`${entity.kind}: ${entity.label}`}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen((v) => !v); } }}
        style={{
          color: hue, cursor: "pointer", borderBottom: `1px dotted ${hue}`,
          background: open ? "color-mix(in srgb, currentColor 12%, transparent)" : "transparent",
          borderRadius: 3, padding: "0 1px", outlineColor: hue,
        }}
      >
        {entity.label}
      </span>
      {open && (
        <span
          role="menu"
          style={{
            position: "absolute", top: "100%", left: 0, zIndex: 20, marginTop: 4, minWidth: 150,
            display: "flex", flexDirection: "column", background: "var(--bg)", border: "1px solid var(--line2)",
            borderRadius: 8, boxShadow: "0 6px 20px rgba(0,0,0,0.18)", padding: 4, fontSize: 12, fontWeight: 500,
          }}
        >
          <button type="button" role="menuitem" onClick={run(actions?.research)} style={menuItemStyle}>Research</button>
          <button type="button" role="menuitem" onClick={run(actions?.openEntityDoc)} style={menuItemStyle}>Open entity doc</button>
        </span>
      )}
    </span>
  );
}

const menuItemStyle: React.CSSProperties = {
  textAlign: "left", background: "transparent", border: "none", color: "var(--t1)",
  cursor: "pointer", padding: "5px 8px", borderRadius: 5, fontSize: 12, lineHeight: 1.3,
};

function ContestedText({ text }: { text: string }): React.ReactElement | null {
  const pattern = /⟦([^⟧]+)⟧\{([^}]+)\}/g;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) != null) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));
    parts.push(
      <span
        key={`contest-${match.index}`}
        data-contested="true"
        aria-label="Unresolved live transcript"
        style={{
          display: "inline",
          color: "var(--t3)",
          fontStyle: "italic",
        }}
      >
        {match[1]}
      </span>,
    );
    cursor = pattern.lastIndex;
  }
  if (!parts.length) return null;
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

/** Render a block's text. With `entities` → inline highlights; without → plain text (raw mode). */
function BlockText({ text, entities, actions }: { text: string; entities?: EngineEntity[]; actions?: EngineActions }) {
  if (/⟦[^⟧]+⟧\{[^}]+\}/.test(text)) return <ContestedText text={text} />;
  if (!entities || !entities.length) return <>{text}</>;
  const spans = splitTextIntoSpans(text, entities);
  return (
    <>
      {spans.map((span, i) =>
        span.entity
          ? <EntityMention key={`e${i}`} entity={span.entity} actions={actions} />
          : <span key={`t${i}`}>{span.text}</span>,
      )}
    </>
  );
}

export function LiveTranscriptEngine({
  segments,
  emptyLabel = "Waiting for transcript…",
  entities,
  signals,
  actions,
}: {
  segments: EngineSegment[];
  emptyLabel?: string;
  entities?: EngineEntity[];
  signals?: EngineSignal[];
  actions?: EngineActions;
}) {
  // Confirmed (completed !== false) = stable. Merge consecutive same-speaker confirmed segments into
  // flowing blocks; keyword tags accumulate per block. Pending (completed === false) = the live edge.
  const blocks: { speaker?: string; tsMs?: number; text: string; key: string; tags: EngineTag[] }[] = [];
  for (const s of segments) {
    if (s.completed === false) continue;
    const last = blocks[blocks.length - 1];
    if (last && last.speaker === s.speaker) { last.text += " " + s.text; if (s.tags) last.tags.push(...s.tags); }
    else blocks.push({ speaker: s.speaker, tsMs: s.tsMs, text: s.text, key: s.id ?? `b${blocks.length}`, tags: [...(s.tags ?? [])] });
  }
  const lastPending = [...segments].reverse().find((s) => s.completed === false);
  const live = (lastPending?.text ?? "").trim();
  const liveSpeaker = lastPending?.speaker;

  const lastBlock = blocks[blocks.length - 1];
  const liveJoinsLast = !!live && !!lastBlock && lastBlock.speaker === liveSpeaker;
  const liveOwnBlock = !!live && !liveJoinsLast;

  if (!blocks.length && !live) {
    return <div style={{ color: "var(--t3)", fontSize: 13, padding: "8px 2px" }}>{emptyLabel}</div>;
  }

  const head = (speaker?: string, tsMs?: number) =>
    speaker ? (
      <div style={{ fontSize: 12, fontWeight: 700, color: "var(--t2)", marginBottom: 3 }}>
        {speaker}
        {typeof tsMs === "number" && (
          <span style={{ fontWeight: 400, color: "var(--t3)", marginLeft: 8 }}>{new Date(tsMs).toLocaleTimeString()}</span>
        )}
      </div>
    ) : null;

  // dedupe tags by lowercased label (a keyword mentioned twice in a block shows once)
  const chips = (tags: EngineTag[]) => {
    const seen = new Set<string>();
    const uniq = tags.filter((t) => t.label && !seen.has(t.label.toLowerCase()) && seen.add(t.label.toLowerCase()));
    if (!uniq.length) return null;
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        {uniq.map((t, i) => {
          const hue = hueFor(t.kind);
          return (
            <span key={`${t.label}-${i}`} title={`research ${t.label}`}
              style={{ fontSize: 11, color: hue, border: `1px solid ${hue}`, background: "transparent", borderRadius: 999, padding: "1px 8px", lineHeight: 1.5, opacity: 0.9 }}>
              {t.label}
            </span>
          );
        })}
      </div>
    );
  };

  // Signal badges attach to the LAST confirmed block (the running edge of the conversation). Only in
  // processed mode (signals supplied). Clickable → onSignal (create task / fact-check via useActions).
  const signalBadges = (forLastBlock: boolean) => {
    if (!forLastBlock || !signals || !signals.length) return null;
    return (
      <div role="group" aria-label="signals" style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        {signals.map((sig) => {
          const hue = SIGNAL_HUE[sig.kind] ?? "var(--t2)";
          return (
            <button key={sig.id} type="button" title={`${sig.kind}: ${sig.label}`}
              onClick={() => actions?.onSignal?.(sig)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: 11,
                color: hue, border: `1px solid ${hue}`, background: "transparent", borderRadius: 6,
                padding: "1px 7px", lineHeight: 1.5, fontWeight: 600,
              }}>
              <span style={{ width: 6, 
```

### Core Architecture Module: `clients/terminal/src/canvas/hooks.ts`
```
export { useEntities, useMeeting, useMeetingDocs, useSignals, useSpeakers, useTranscript } from "./useMeeting";
export { useMeetingNotes } from "./notes";
export type { MeetingNote, NoteTag, NoteTagKind } from "./notes";
export { useActions } from "./actions";
export type { CanvasEntity, EntityItem, EntityKind, MeetingDocLink, MeetingState, SpeakerSummary, TranscriptSegment } from "./types";

```

### Core Architecture Module: `clients/terminal/src/platform/core.ts`
```
/**
 * Core platform primitives shared by browser-facing React hooks and service leaf modules.
 */

// ── DI ───────────────────────────────────────────────────────────────────────
export interface ServiceId<T> { readonly _t?: T; readonly id: string }
export function createServiceId<T>(id: string): ServiceId<T> { return { id }; }

export interface ServiceContainer {
  get<T>(id: ServiceId<T>): T;
  tryGet<T>(id: ServiceId<T>): T | undefined;
  /** Dispose every instantiated service that exposes a `dispose()`. */
  dispose(): void;
}
export interface ServiceRegistration<T> { id: ServiceId<T>; factory: (c: ServiceContainer) => T; }
export function reg<T>(id: ServiceId<T>, factory: (c: ServiceContainer) => T): ServiceRegistration<T> {
  return { id, factory };
}

export function createContainer(regs: ServiceRegistration<unknown>[]): ServiceContainer {
  const factories = new Map<string, (c: ServiceContainer) => unknown>();
  const instances = new Map<string, unknown>();
  for (const r of regs) factories.set(r.id.id, r.factory);
  const container: ServiceContainer = {
    get<T>(id: ServiceId<T>): T {
      if (instances.has(id.id)) return instances.get(id.id) as T;
      const f = factories.get(id.id);
      if (!f) throw new Error(`[term-platform] no service registered for "${id.id}"`);
      const inst = f(container);
      instances.set(id.id, inst);
      return inst as T;
    },
    tryGet<T>(id: ServiceId<T>): T | undefined {
      try { return container.get(id); } catch { return undefined; }
    },
    dispose() {
      for (const inst of instances.values()) {
        const d = inst as { dispose?: () => void };
        if (d && typeof d.dispose === "function") {
          try { d.dispose(); } catch { /* a failed dispose must not block the rest */ }
        }
      }
      instances.clear();
    },
  };
  return container;
}

export interface ObservableStore<S> { getState(): S; subscribe(cb: (s: S) => void): () => void; }

/** Make a minimal observable store from an initial value. */
export function createStore<S>(initial: S): ObservableStore<S> & { set(next: S | ((s: S) => S)): void } {
  let state = initial;
  const subs = new Set<(s: S) => void>();
  return {
    getState: () => state,
    subscribe(cb) { subs.add(cb); return () => subs.delete(cb); },
    set(next) {
      state = typeof next === "function" ? (next as (s: S) => S)(state) : next;
      subs.forEach((cb) => cb(state));
    },
  };
}

// ── Context keys (when-clause gating) ──────────────────────────────────────────
export interface ContextKeyService {
  set(key: string, value: boolean | string): void;
  evaluate(when?: string): boolean;
  store: ObservableStore<Record<string, boolean | string>>;
}
export const ContextKeyServiceId = createServiceId<ContextKeyService>("contextKey");
export function createContextKeyService(): ContextKeyService {
  const store = createStore<Record<string, boolean | string>>({});
  return {
    store,
    set(key, value) { store.set((s) => ({ ...s, [key]: value })); },
    evaluate(when) {
      if (!when) return true;
      const s = store.getState();
      return when.split("||").some((orPart) =>
        orPart.split("&&").every((part) => {
          const t = part.trim();
          const eq = t.match(/^(\S+)\s*(==|!=)\s*(.+)$/);
          if (eq) {
            const [, k, op, raw] = eq;
            const want = raw.trim().replace(/^["']|["']$/g, "");
            const cur = String(s[k.trim()] ?? "");
            return op === "==" ? cur === want : cur !== want;
          }
          const neg = t.startsWith("!");
          const key = neg ? t.slice(1).trim() : t;
          const v = !!s[key];
          return neg ? !v : v;
        }),
      );
    },
  };
}

// ── Commands (the /-skill palette source) ──────────────────────────────────────
export interface CommandContribution {
  id: string; title: string; skill?: `/${string}`; when?: string;
  run(ctx: { container: ServiceContainer; args?: string }): void | Promise<void>;
}
export interface CommandService {
  register(cmd: CommandContribution): void;
  all(): CommandContribution[];
  skills(): CommandContribution[];
  querySkills(input: string): CommandContribution[];
  execute(id: string, args?: string): Promise<void>;
}
export const CommandServiceId = createServiceId<CommandService>("command");
export function createCommandService(container: ServiceContainer): CommandService {
  const cmds = new Map<string, CommandContribution>();
  const ctxKeys = () => container.tryGet(ContextKeyServiceId);
  const visible = (c: CommandContribution) => ctxKeys()?.evaluate(c.when) ?? true;
  return {
    register(cmd) { cmds.set(cmd.id, cmd); },
    all() { return [...cmds.values()].filter(visible); },
    skills() { return this.all().filter((c) => c.skill); },
    querySkills(input) {
      const q = input.replace(/^\//, "").toLowerCase();
      return this.skills().filter((c) => c.skill!.slice(1).toLowerCase().startsWith(q));
    },
    async execute(id, args) { const c = cmds.get(id); if (c && visible(c)) await c.run({ container, args }); },
  };
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1767** (2026-10-03): **release: prepare v0.12.28 installation repair**
  *Symptoms*: Prepare v0.12.28 to deliver the merged installation recovery in #1760 / #1759. Advance package, Helm appVersion and documentation stamps, bump the chart to 0.12.2, and assemble the four pending changelog fragments.  The founder selected v0.12.28 because the release workflows reject four-part 0.12.27.1. This PR prepares the source; release artifact validation, combined-value witness and stable publication remain pending.  Validation: `node scripts/gates.mjs docs-version`, changelog collector followed by `--check`, and `git diff --check` pass. 
  **Post-Mortem & Fix Analysis**:
  > <!-- merge-card --> ### 🃏 Merge card — #1767  | check | | what it needs | |---|---|---| | **Value** | ✅ | value-fsm green + value-signed | | **Diff** | ✅ | maintainer self-review — @DmitriyG228 holds the commit bit (no separate non-author review required) |  **Ready to merge** — every row above is accepted.  <sub>How a PR reaches merge: [the merge bar](https://docs.vexa.ai/governance/delivery#integration-—-the-merge-bar).</sub>  ✓ merge-card — card accepted for: #1767

- **Issue #1765** (2026-10-03): **main stays green: the rights verdict lives on the evaluated PR, rights declared once per contributor**
  *Symptoms*: **Delivers issue:** #1764 (Part of #1764)  ## What this is  `main` showed red although nothing on it was broken. A comment on any pull request runs the contribution-rights job, and GitHub attaches comment and check-result runs to `main`'s newest commit. The job failed whenever the commented PR had no rights selection, and runs that shared one concurrency group cancelled each other, so `main` collected red and cancelled marks for other PRs' state. This PR makes `main` stay green and takes the "declare once per contributor" change.  - **Taken from #1746 (by @DmitriyG228), cherry-picked with authorship and sign-off intact:**   contribution rights are declared once per contributor, not per PR (registry for the maintainer's   standing and corporate authorizations; an earlier merged PR where the author ticked Independent   themselves carries forward; template and governance docs say "first contribution only"). - **New here:**   - The rights job never fails on a verdict. The published `contribution-rights` check run on the     PR head (or the merge-group head) is the only verdict, and it still fails closed.   - A failed GitHub read while evaluating a PR is published on that PR's head as a failing verdict     naming the error, instead of failing the job and leaving an earlier verdict standing.   - `issue_comment` and `check_run` runs each get their own concurrency group, so they never     cancel each other on `main`. PR and merge-group runs still supersede earlier runs for the same  
  **Post-Mortem & Fix Analysis**:
  > <!-- merge-card --> ### 🃏 Merge card — #1765  | check | | what it needs | |---|---|---| | **Value** | ✅ | non-runtime + value-signed | | **Diff** | ✅ | maintainer self-review — @DmitriyG228 holds the commit bit (no separate non-author review required) |  **Ready to merge** — every row above is accepted.  <sub>How a PR reaches merge: [the merge bar](https://docs.vexa.ai/governance/delivery#integration-—-the-merge-bar).</sub>  ✓ merge-card — card accepted for: #1765

- **Issue #1764** (2026-10-03): **main stays green: comments on other PRs stop marking it red, and factory commits are signed**
  *Symptoms*: <!-- decision:start --> **What this is:** `main` shows red although nothing on it is broken. Comments on any PR, even one targeting another branch, run the rights check on `main`'s code, and that check fails its own job whenever the commented PR has no rights selection, so the failure is pinned to `main`'s newest commit. The last merge also shows DCO "action required" because factory commits carried no sign-off.  **Done means:** after this merges, `main`'s newest commit shows every check green — and stays green when someone comments on any PR. <!-- decision:end -->  ## Definition of done (founder, 2026-10-03: "fix the dco and stuff to have it clean main now") 1. The rights check publishes its verdict on the PR it evaluates and never fails its own job; a comment on a PR targeting any branch leaves `main` green. 2. Contribution rights are declared once per contributor, not per PR (the change prepared in #1746 — take it). 3. Every commit the factory makes carries the maintainer's `Signed-off-by`; DCO is green on the PR and on the merged commit. 4. After the merge, `main`'s newest commit has no failing and no "action required" check, verified after at least one comment on another PR.  ## For the factory - Scope: CI workflows, `scripts/contribution-rights-gate.mjs` and its tests, governance docs. No runtime change. - Raw material: #1746 (rights once per contributor, all checks green except the sign-off label). Sweep for anything else touching `.github/workflows/contribution-rights
  **Post-Mortem & Fix Analysis**:
  > ## Workpad — Vexa-ai/vexa#1764 — Cycle 1  **Type:** fresh pickup **Branch:** factory/Vexa-ai-vexa-1764 **Delivery PR:** https://github.com/Vexa-ai/vexa/pull/1765 **Cycle opened:** 2026-10-03T10:02:21Z · **Trigger:** issue moved to Ready; outcome item, no delivery PR named  ### Status Transitions  - 2026-10-03T10:02:40Z · `Ready` → `In progress` · fresh pickup (cycle 1 open) - 2026-10-03T10:12:50Z · `In progress` → `Proving` · Completion Bar met on edd3d256 (cycle 1 close)  ### Plan  - [x] 1. Sweep open PRs/issues touching the rights check and DCO; substrate table - [x] 2. Compose: take #1746 (rights once per contributor); rights check never fails its own job, verdict published on the evaluated PR; factory commits signed off - [x] 3. Targeted local validation; push; open PR (Part of #1764) - [x] 4. CI on the new head; fix what blocks gates / docs-current - [x] 5. Wrap-up: re-verify the issue · Completion Bar · PR ready · decision card · Proving  ### Substrate  - #1746 · DmitriyG228 · ri
  > 🔁 Status: `Ready` → `In progress`  Reason: Fresh pickup; the definition of done is clear and in scope (CI workflows, rights gate script, governance docs). Cycle: 1 open  <!-- vexa-agent -->
  > 🔁 Status: `In progress` → `Proving`  **What changes for a user:** nothing in the product. For contributors: rights are declared once, not on every PR. For everyone reading `main`: a comment on any PR no longer leaves a failed or cancelled rights run on `main`'s newest commit. The verdict shows only as the `contribution-rights` check on the PR it evaluates.  **Proof:** `gates` ✅ · `docs-current` ✅ · `contribution-rights` ✅ · DCO ✅ · merge-card ✅ · CodeQL ✅ · GitGuardian ✅. Head `edd3d25`, https://github.com/Vexa-ai/vexa/pull/1765/checks. PR description: all claims checked against the diff and `main`. Evidence: the gate tests pass 43/43. The 2 new tests fail when run against the old gate and workflow. Root cause, read from `main` `c63ddda0`: 4 comment runs FAILED (the job failed whenever the commented PR had no selection), and 4 check-result runs were CANCELLED (all of them shared one concurrency group). DCO showed "action required" for two #1760 commits with no sign-off. All 4 commits 

- **Issue #1760** (2026-10-02): **storage: MinIO removed — versitygw for Lite and Compose, your own S3 for Helm (#1759)**
  *Symptoms*: **Delivers issue:** Part of #1759. Refs #1671 (item 1), #1741, #1742.  MinIO removed its images from Docker Hub (`minio/minio`, `minio/mc`), so every fresh self-hosted install of Vexa fails at the first pull. This PR removes MinIO from every install path: Lite and Compose store recordings in versitygw, and the Helm chart stores them in your own S3. Existing installs keep their recordings and get a verified copy command. It also fixes the two first-run failures that the missing MinIO images used to hide (found by the proving station).  **Taken from:** #1740 by @DmitriyG228 — all 13 commits, unchanged, authorship preserved. It was already current with `main` (`dba990b4`), so nothing was adapted. #1740 itself absorbed #1685 (closed) and the MinIO part of #1679. This PR supersedes #1740. Decision record: [ADR-0038](docs/adr/0038-storage-s3-everywhere-versitygw-on-single-machine-installs.md). Two commits added on top in proving rework: `ce49a292` (Compose first-run secrets) and `f54ead0b` (Lite first-run check).  ## Contribution rights <!-- Select exactly ONE. This is a legal certification: an agent may explain the choices but      must not select one for you. See CONTRIBUTOR_RIGHTS.md. -->  - [x] **Independent:** I created this contribution, or otherwise have the right to submit it   under Apache-2.0, and it is not owned or controlled by an employer, client, or other entity.   <!-- rights:independent --> - [ ] **Employer/client authorization required:** an employer, client, or ot
  **Post-Mortem & Fix Analysis**:
  > <!-- merge-card --> ### 🃏 Merge card — #1760  | check | | what it needs | |---|---|---| | **Value** | ✅ | value-fsm green + value-signed | | **Diff** | ✅ | maintainer self-review — @DmitriyG228 holds the commit bit (no separate non-author review required) |  **Ready to merge** — every row above is accepted.  <sub>How a PR reaches merge: [the merge bar](https://docs.vexa.ai/governance/delivery#integration-—-the-merge-bar).</sub>  ✓ merge-card — card accepted for: #1760

- **Issue #1756** (2026-10-02): **factory: land #1746 — contributors declare rights once, not per PR**
  *Symptoms*: **Delivery PR:** #1746 — prepared outside the factory; land it as-is (no replacement PR).  ## Goal Contributors declare contribution rights once, not on every pull request (founder ruling, 2026-10-02). After this lands, our own PRs and contributors who already declared on an earlier merged PR pass the `contribution-rights` check with no box to tick.  ## Acceptance criteria - [x] The gate passes a PR without a selection when its author is the maintainer, or declared Independent themselves on an earlier merged PR (`node --test scripts/contribution-rights-gate.test.mjs`: 41 pass, 0 fail). - [x] Corporate authorization never carries forward from an earlier PR; a box ticked by someone other than the author does not count (tests above). - [x] Read-only dry run over the open PRs: 91 move from fail to pass, none from pass to fail. - [x] The registry holds only the maintainer; nobody maintains contributor entries by hand.  Factory pilot — DmitriyG228/biz#504.  <!-- vexa-agent --> 
  **Post-Mortem & Fix Analysis**:
  > 🔁 Status: → `In review`  **What changes for a user:** contributors are asked about contribution rights once, on their first PR, instead of on every PR. Our own PRs, and contributors who already declared on an earlier merged PR, stop failing the rights check.  **Proof:** gate tests 41/41 · dry run over open PRs: 91 fail→pass, 0 pass→fail · `contribution-rights` ✅ and DCO ✅ on the PR head — https://github.com/Vexa-ai/vexa/pull/1746/checks  **Risk and rollback:** public governance text changes (contributor-rights docs, ADR-0034 addendum); someone whose earlier box was ticked by a maintainer is asked once more. Roll back by reverting the squash commit.  **Recommendation:** Land.  **Moving to Land is your sign-off.** The agent then records it as `state: value-signed` on #1746, waits for the required checks, adds it to the merge queue, waits until it merges, and moves this card to Done.  <!-- vexa-agent --> 
  > ## Workpad — Vexa-ai/vexa#1756 — Cycle 1  **Type:** fresh pickup **Branch:** factory/Vexa-ai-vexa-1756 **Delivery PR:** https://github.com/Vexa-ai/vexa/pull/1746 (source PR; no replacement — no commits needed, see Plan 2) **Cycle opened:** 2026-10-02T11:17:30Z · **Trigger:** issue in `Ready`, no prior factory workpad  ### Status Transitions  - 2026-10-02T11:17:54Z · `Ready` → `In progress` · Fresh pickup of #1746; verification can start (cycle 1 open) - 2026-10-02T11:18:35Z · `In progress` → `In review` · Completion Bar met on 02fb44b1; founder decides (cycle 1 close)  ### Plan  - [x] 1. Verify PR claims against the diff and current main; check already-on-main / superseded - [x] 2. Merge origin/main — not needed: `origin/main` (dba990b4) is already an ancestor of the head 02fb44b1, so nothing to commit or publish and no replacement PR is opened - [x] 3. CI on the head — `gates`, `docs-current`, `contribution-rights` already green on 02fb44b1 - [x] 4. Correct the PR description — no cor
  > 🔁 Status: `Ready` → `In progress`  Reason: Fresh pickup of #1746; verification can start Cycle: 1 open  <!-- vexa-agent --> 

- **Issue #1755** (2026-10-02): **feat(transcript): incremental `?since=` reads, and a typed refusal for parameters we don't honour**
  *Symptoms*: **Delivers issue:** #1219  ## Contribution rights  <!-- Left unticked deliberately: this is a legal certification and an agent must not select it.      @DmitriyG228 — please tick the box that applies before merge. -->  - [ ] **Independent:** I created this contribution, or otherwise have the right to submit it   under Apache-2.0, and it is not owned or controlled by an employer, client, or other entity.   <!-- rights:independent --> - [ ] **Employer/client authorization required:** an employer, client, or other entity owns or   may control this contribution. I am requesting Vexa's private corporate-authorization process.   <!-- rights:corporate --> - [ ] **Unsure:** I need a private rights review before merge.   <!-- rights:uncertain -->  Every commit carries `Signed-off-by: DmitriyG228 <2280905@gmail.com>` (the repo-local identity, matching this repo's existing history).  ## What this delivers  `GET /transcripts/{platform}/{native_meeting_id}` returned the **entire** transcript on every poll and accepted-then-dropped every parameter that would have narrowed it. Both are fixed:  1. **`?since=` — an incremental read.** Returns only segments **created or changed** at/after the    cursor. Every response carries **`next_since`** (the watermark for the next poll) and, on a    cursor read, **`retracted_segment_ids`** (what to drop) and **`resynced`**. 2. **Unsupported query parameters return `400` naming them**, listing what the endpoint accepts.  ### Why a change watermark and not
  **Post-Mortem & Fix Analysis**:
  > <!-- merge-card --> ### 🃏 Merge card — #1755  | check | | what it needs | |---|---|---| | **Value** | ❌ | missing `state: value-signed` (the value sign-off) | | **Diff** | ✅ | maintainer self-review — @DmitriyG228 holds the commit bit (no separate non-author review required) | | **Acceptance** | ❌ | issue #1751 has 1 undelivered acceptance leg(s) — deliver them, mark them delivered with evidence on the issue, or re-link as Part of #1751 |  **Not mergeable yet** — every row above must be accepted before merge (choke point 1). Fill in what's ❌ above, then this clears automatically.  <sub>How a PR reaches merge: [the merge bar](https://docs.vexa.ai/governance/delivery#integration-—-the-merge-bar).</sub>
  > Withdrawn: factory pilot reset by the founder (2026-10-02). The work stays in the source PR, which the factory now treats as raw material. <!-- vexa-agent -->

- **Issue #1754** (2026-10-02): **fix(meetings): require explicit selection for ambiguous native writes**
  *Symptoms*: Recurring native meeting IDs can match several owned sessions. Native-keyed writes now return `409` with candidate IDs, creation times and statuses; `?meeting_id=<id>` selects the exact session. Unknown or unowned selections return `404`.  The rule covers delete, patch, annotate, workspace binding, share minting, document changes and intent updates. Read-only routes and the sealed API schema are unchanged.  ## Contribution rights  - [ ] **Independent:** I created this contribution, or otherwise have the right to submit it under Apache-2.0, and it is not owned or controlled by an employer, client, or other entity. <!-- rights:independent --> - [ ] **Employer/client authorization required:** an employer, client, or other entity owns or may control this contribution. I am requesting Vexa's private corporate-authorization process. <!-- rights:corporate --> - [ ] **Unsure:** I need a private rights review before merge. <!-- rights:uncertain -->  ## Observation bundle  - Meeting-api: **1,429 passed, 6 skipped**. Cases cover ambiguity, selecting an older session, invalid selection, ownership, unchanged single-row deletion and every native write consuming the selected row ID. - Production SQL lookup: **1 passed**, using the existing identity-service SQLAlchemy dependency. Asserts owner/platform/native predicates, complete candidate enumeration and stable ordering; database transport is mocked. - Fourteen static gates passed, checked by exit status and failure markers. Independent age
  **Post-Mortem & Fix Analysis**:
  > <!-- merge-card --> ### 🃏 Merge card — #1754  | check | | what it needs | |---|---|---| | **Value** | ❌ | missing `state: value-signed` (the value sign-off) | | **Diff** | ✅ | maintainer self-review — @DmitriyG228 holds the commit bit (no separate non-author review required) | | **Acceptance** | ❌ | issue #1749 has 1 undelivered acceptance leg(s) — deliver them, mark them delivered with evidence on the issue, or re-link as Part of #1749 |  **Not mergeable yet** — every row above must be accepted before merge (choke point 1). Fill in what's ❌ above, then this clears automatically.  <sub>How a PR reaches merge: [the merge bar](https://docs.vexa.ai/governance/delivery#integration-—-the-merge-bar).</sub>
  > Withdrawn: factory pilot reset by the founder (2026-10-02). The work stays in the source PR, which the factory now treats as raw material. <!-- vexa-agent -->

- **Issue #1753** (2026-10-02): **share: restrict the fields a delivered payload serializes**
  *Symptoms*: `meeting.data` is an open multi-producer blob. The read edge learned that in #1243/#1244 and now projects it per viewer (`collector/projection.py`). The **write** edge did not: `clean_meeting_data` dropped delivery-specific noise and the webhook config, and shipped everything else.  That is the weaker of the two edges, not the stronger one. A delivered body leaves the trust boundary completely — it is POSTed to an operator-configured system endpoint, or to an arbitrary URL a user typed into their settings, and lands in a request log we do not run and cannot revoke.  ## The change  `clean_meeting_data` now drops the union of three rules instead of one:  | Rule | What it covers | |---|---| | `_INTERNAL_DATA_KEYS` (unchanged) | container ids, the webhook config, its own delivery bookkeeping, the internal rating input | | `collector.projection.RESPONSE_OMIT_KEYS` | everything an API response to a non-owner omits | | `collector.projection.is_sensitive_key` | the credential-**shaped** name rule (`*_secret`, `*_token`, `*_api_key`, …) |  Three key classes stop riding a delivery as a result — all three already withheld on the read edge:  - **`share_grants`** — per-link `secret_hash` plus the allow-list and expiry. - **`transcript_viewers`** — the reader roster: other people's identities, which the endpoint's   operator has no claim to. - **`auth_userdata_path`** — the S3 pointer to a stored authenticated browser session.  The name rule matters more than the three names. A key a futur
  **Post-Mortem & Fix Analysis**:
  > <!-- merge-card --> ### 🃏 Merge card — #1753  | check | | what it needs | |---|---|---| | **Value** | ❌ | missing `state: value-signed` (the value sign-off) | | **Diff** | ✅ | maintainer self-review — @DmitriyG228 holds the commit bit (no separate non-author review required) | | **Acceptance** | ✅ | every acceptance leg delivered on #1750 |  **Not mergeable yet** — every row above must be accepted before merge (choke point 1). Fill in what's ❌ above, then this clears automatically.  <sub>How a PR reaches merge: [the merge bar](https://docs.vexa.ai/governance/delivery#integration-—-the-merge-bar).</sub>
  > Withdrawn: factory pilot reset by the founder (2026-10-02). The work stays in the source PR, which the factory now treats as raw material. <!-- vexa-agent -->

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

### Incident Patch 1: `71321ad0` (2026-09-06)
**Commit Message**: release: unbind the v0.12.27-rc.3 packet — superseded by the Zoom fix (#1631), rc.5 rebuilds the set (#1633)

With releases/v0.12.27/candidate-images.json bound to rc.3, release-images' planner reads the
delta from that map's build_source and allows only a full rebuild or the Bot+Lite delta; the
#1631 change (mcp) surfaces as mcp + bot + lite and preflight refuses
(run 34050271135 on v0.12.27-rc.4: 'unsupported partial candidate build'). Remove the rc.3 map,
its resolve-table arm and its canonical test so the next tag builds the full set from source;
rc.5 is bound, validated and frozen in its place. The rc.3 identity stays in git history and in
the seq-32..34 ledger entries; rc.4 stands as an attempt that never built.

Signed-off-by: DmitriyG228 <[REDACTED_EMAIL]>

**File**: `.github/workflows/release-validate.yml` (modified, +0/-7)
```diff
@@ -249,13 +249,6 @@ jobs:
               EXPECTED_TOP_DESCRIPTORS=10
               EXPECTED_PLATFORM_IDENTITIES=19
               ;;
-            v0.12.27-rc.3|v0.12.27)
-              CANDIDATE_MAP=releases/v0.12.27/candidate-images.json
-              EXPECTED_MAP_STABLE_TAG=v0.12.27
-              EXPECTED_MAP_SHA256=dd4e9ad62cf327a0320262329a8eb55a58116415a0f3615e8c5d8ae84f4eb055
-              EXPECTED_TOP_DESCRIPTORS=11
-              EXPECTED_PLATFORM_IDENTITIES=21
-              ;;
             v0.12.26-rc.1|v0.12.26)
               CANDIDATE_MAP=releases/v0.12.26/candidate-images.json
               EXPECTED_MAP_STABLE_TAG=v0.12.26
```

**File**: `release/candidate-image-map.test.mjs` (modified, +0/-23)
```diff
@@ -357,29 +357,6 @@ test("v0.12.25 canonical packet binds the rc.1 train candidate", () => {
   );
 });
 
-test("v0.12.27 canonical packet binds the rc.3 train candidate (schema 2, eleven images)", () => {
-  const raw = readFileSync(
-    new URL("../releases/v0.12.27/candidate-images.json", import.meta.url),
-  );
-  assert.equal(
-    createHash("sha256").update(raw).digest("hex"),
-    "dd4e9ad62cf327a0320262329a8eb55a58116415a0f3615e8c5d8ae84f4eb055",
-  );
-  const map = validateCandidateMap(JSON.parse(raw), "v0.12.27");
-  assert.equal(map.schema_version, 2);
-  assert.equal(map.candidate_tag, "v0.12.27-rc.3");
-  assert.equal(map.build_source, "78be718f940a68253a8cd0188e7cfe8edd51d41c");
-  assert.equal(map.images["vexaai/vexa-bot"].digest, "sha256:e4be25d82b29b3bda1a50a33bd7fcc7db1b715dbfa887dc991819e7b1f581537");
-  assert.equal(Object.keys(map.images).length, 11);
-  assert.equal(
-    Object.values(map.images).reduce(
-      (count, image) => count + Object.keys(image.platform_manifests).length,
-      0,
-    ),
-    21,
-  );
-});
-
 test("v0.12.26 canonical packet binds the rc.1 train candidate", () => {
   const raw = readFileSync(
     new URL("../releases/v0.12.26/candidate-images.json", import.meta.url),
```

**File**: `releases/v0.12.27/RELEASE-NOTES.draft.md` (modified, +2/-2)
```diff
@@ -137,8 +137,8 @@ deployment relies on.
 
 ---
 
-**Images (eleven — `vexaai/v012-flows` joins the release set with this version):** `vexaai/v012-admin-api@sha256:bd43f2928c5c60096715383c9ed0dc33e88202630b5ff02c9685751c06b64aa6`, `vexaai/v012-runtime@sha256:ccbd50e384acf4fec6c7666794166af1f58968ad4b48c26831611c865825c4ea`, `vexaai/v012-agent-worker@sha256:75914538982acd7c703a8433e41cca976567b47163908f20c4222ee311306754`, `vexaai/v012-agent-api@sha256:cc8000bfb87eadf2b16aa3e8a00f729ab9a230d3cc07eece4cdebebc7e28d98a`, `vexaai/v012-meeting-api@sha256:bc3025f54b6c0452bda310e8a4d21f779951ef6437bb4de9330dc04d02e7d421`, `vexaai/v012-gateway@sha256:4f22de622093aeb77740df8d57b2a11b766c39dea7766663c3cf2ee36af14ec4`, `vexaai/v012-mcp@sha256:9ddd958646dd51be4b9fffe1c425ad742e754e7bef502d749fed58e3f5e66c32`, `vexaai/v012-terminal@sha256:02858350ca39862d57f81a16d645f8cfbb8404a2e1a6fbed6b1ad560ab5347c2`, `vexaai/vexa-bot@sha256:e4be25d82b29b3bda1a50a33bd7fcc7db1b715dbfa887dc991819e7b1f581537`, `vexaai/vexa-lite@sha256:65dc0fd1781ea7c15a064b66074dabaa3f304776188fe254d603654d4a559d85`, `vexaai/v012-flows@sha256:6ec683e4ff1570f7bb7a0c0134f8722264ce159f266e8b5ba377f8258b083df7`, published from the reviewed candidate packet
-`releases/v0.12.27/candidate-images.json` and validated by [run 33993759054](https://github.com/Vexa-ai/vexa/actions/runs/33993759054).
+**Images (eleven — `vexaai/v012-flows` joins the release set with this version):** <images>, published from the reviewed candidate packet
+`releases/v0.12.27/candidate-images.json` and validated by <validation run>.
 
 **In production:** this release is what vexa.ai runs, pinned as channel entry <channel entry> and
 re-verified against the cluster after the pin.
```

**File**: `releases/v0.12.27/candidate-images.json` (removed, +0/-226)
```diff
@@ -1,226 +0,0 @@
-{
- "schema_version": 2,
- "release": "v0.12.27",
- "stable_tag": "v0.12.27",
- "candidate_tag": "v0.12.27-rc.3",
- "build_source": "78be718f940a68253a8cd0188e7cfe8edd51d41c",
- "validation_source": "7ba34a301c7672c179d469fe56b75887775103b8",
- "build_run": "https://github.com/Vexa-ai/vexa/actions/runs/33985945402",
- "validation_run": "https://github.com/Vexa-ai/vexa/actions/runs/33993759054",
- "images": {
-  "vexaai/v012-admin-api": {
-   "class": "prod_deployed",
-   "digest": "sha256:bd43f2928c5c60096715383c9ed0dc33e88202630b5ff02c9685751c06b64aa6",
-   "platforms": [
-    "linux/amd64",
-    "linux/arm64"
-   ],
-   "platform_manifests": {
-    "linux/amd64": {
-     "manifest_digest": "sha256:f901c90d642372bd4d6d93a668381b098fc95eb96fa2593b82497aff011047f5",
-     "config_digest": "sha256:1f859168a6f40c00f006ecb2f28872e13cca0148bf1a912fb44a999639a4e3ab"
-    },
-    "linux/arm64": {
-     "manifest_digest": "sha256:e5f0d53b41c8dd0efcc246e4673fb44db9a99a685a1ce0e51dde73fed1a2e055",
-     "config_digest": "sha256:e5d0430499f552c8b82e20d14842952693e455910897fe75a59d0d5a8c9a98b2"
-    }
-   },
-   "attestations": true,
-   "evidence": "candidate build run 33985945402 at 78be718f; exact registry identities collected after the image job completed"
-  },
-  "vexaai/v012-runtime": {
-   "class": "prod_deployed",
-   "digest": "sha256:ccbd50e384acf4fec6c7666794166af1f58968ad4b48c26831611c865825c4ea",
-   "platforms": [
-    "linux/amd64",
-    "linux/arm64"
-   ],
-   "platform_manifests": {
-    "linux/amd64": {
-     "manifest_digest": "sha256:a6f62fa2209f4210d646e859185514f5c588893b366e957bd0be4b81776bf0bf",
-     "config_digest": "sha256:ed1fa17a8180b3bbf15e6783d5f2ef576894d9e022a21441f9bdda58ee708147"
-    },
-    "linux/arm64": {
-     "manifest_digest": "sha256:e24b2a310c0d63332880193d2ced86b5d26ecb58b3d72f1351b9d21a5856dd25",
-     "config_digest": "sha256:3c1cc0ac3821bc5251308ecb26d80855d04e2346c4da21ca876189bcad017556"
-    }
-   },
-   "attestations": true,
-   "evidence": "candidate build run 33985945402 at 78be718f; exact registry identities collected after the image job completed"
-  },
-  "vexaai/v012-agent-worker": {
-   "class": "oss_only",
-   "digest": "sha256:75914538982acd7c703a8433e41cca976567b47163908f20c4222ee311306754",
-   "platforms": [
-    "linux/amd64",
-    "linux/arm64"
-   ],
-   "platform_manifests": {
-    "linux/amd64": {
-     "manifest_digest": "sha256:3594150db20a606635d37a7c0746fb6cf3fad4fa9523e11821b056924d4f59b3",
-     "config_digest": "sha256:9fd33925563d679fbd0282d465283c9a9c9ace1fe831250dd787f90b849ae51a"
-    },
-    "linux/arm64": {
-     "manifest_digest": "sha256:e5e5529a85d28727cef58f910346670cc96acc215a3e61f10a0984c2028e24a9",
-     "config_digest": "sha256:06f47ac632e754452819746d69d4e4982231227c63522d1b9cb0e9b8dec5a280"
-    }
-   },
-   "attestations": true,
-   "evidence": "candidate build run 33985945402 at 78be718f; exact registry identities collected after the image job completed"
-  },
-  "vexaai/v012-agent-api": {
-   "class": "oss_only",
-   "digest": "sha256:cc8000bfb87eadf2b16aa3e8a00f729ab9a230d3cc07eece4cdebebc7e28d98a",
-   "platforms": [
-    "linux/amd64",
-    "linux/arm64"
-   ],
-   "platform_manifests": {
-    "linux/amd64": {
-     "manifest_digest": "sha256:85208c1d49c3b7695427c322832856ee0bf3a0075da69dd756b5de28d3cd68b6",
-     "config_digest": "sha256:7120079a415def96ccf53d58d2b19c46fb2a9e52d3b1d40d88a189d3b42e06eb"
-    },
-    "linux/arm64": {
-     "manifest_digest": "sha256:b192dc868f993c836138caadbbd8b65c12d6e9fa39a3c9a21dfb92773e3185d1",
-     "config_digest": "sha256:a7c0b0d66079a5912cae56878c1e97ddfeab341228c5f2b14be1edb2d655d2fc"
-    }
-   },
-   "attestations": true,
-   "evidence": "candidate build run 33985945402 at 78be718f; exact registry identities collected after the image job completed"
-  },
-  "vexaai/v012-meeting-api": {
-   "class": "prod_deployed",
-   "digest": "sha256:bc3025f54b6c0452bda310e8a4d21f779951ef6437bb4de9330dc04d02e7d421",
-   "platforms": [
-    "linux/amd64",
-    "linux/arm64"
-   ],
-   "platform_manifests": {
-    "linux/amd64": {
-     "manifest_digest": "sha256:8f52ddaecb44b05a8deba9b914416d6e18d566f91e0a7a995007b45511bcbb14",
-     "config_digest": "sha256:322fa2c133af24f1a7875ee8524f772e5ca4baa09be633160ade21d57833678c"
-    },
-    "linux/arm64": {
-     "manifest_digest": "sha256:ba0cf1104663f4313286a818aa776c219c154e91cd2331719380556cb2dd666e",
-     "config_digest": "sha256:2d3e230928dad6406ea6a3c9af59eb2024f32cc1ff7a5ce67acad99b121d865c"
-    }
-   },
-   "attestations": true,
-   "evidence": "candidate build run 33985945402 at 78be718f; exact registry identities collected after the image job completed"
-  },
-  "vexaai/v012-gateway": {
-   "class": "prod_deployed",
-   "digest": "sha256:4f22de622093aeb77740df8d57b2a11b766c39dea7766663c3cf2ee36af14ec4",
-   "platforms": [
-    "linux/amd64",
-    "linux/arm64"
-   ],
-   "platform_manifests": {
-    "linux/amd64": {
```

---

### Incident Patch 2: `91d1cc8a` (2026-09-05)
**Commit Message**: release-images: build the gateway from the repository root, as its Dockerfile requires (#1572)

The gateway Dockerfile moved to a root build context when the edge stopped owning its route
table: it COPYs core/gateway/services/gateway/{pyproject.toml,uv.lock,src} plus the five
routes.v1.json manifests of the domains it fronts (compose already builds it from ../..).
release/candidate-image-map.mjs still handed release-images the service directory as context,
so every COPY failed: run 33981148748 on v0.12.27-rc.1, 'build gateway' —
"/core/agent/routes.v1.json": not found. Context → "."; the image's declared runtime inputs
gain .dockerignore and the four out-of-tree manifests so a change to any of them invalidates
the candidate; the drift test lists the gateway among root-context images.

Signed-off-by: DmitriyG228 <[REDACTED_EMAIL]>

**File**: `release/candidate-image-map.mjs` (modified, +6/-1)
```diff
@@ -56,7 +56,12 @@ export const RUNTIME_INPUTS_BY_IMAGE = {
     "core/runtime/contracts/schedule.v1/schedule.schema.json",
   ],
   "vexaai/v012-gateway": [
+    ".dockerignore",
     "core/gateway/services/gateway",
+    "core/meetings/routes.v1.json",
+    "core/meetings/services/mcp/routes.v1.json",
+    "core/identity/routes.v1.json",
+    "core/agent/routes.v1.json",
   ],
   "vexaai/v012-mcp": [
     "core/meetings/services/mcp",
@@ -122,7 +127,7 @@ export const BUILD_MATRIX_BY_IMAGE = {
   "vexaai/v012-gateway": {
     name: "gateway",
     repository: "v012-gateway",
-    context: "core/gateway/services/gateway",
+    context: ".",
     dockerfile: "core/gateway/services/gateway/Dockerfile",
   },
   "vexaai/v012-mcp": {
```

**File**: `release/candidate-image-map.test.mjs` (modified, +1/-0)
```diff
@@ -208,6 +208,7 @@ test("a root .dockerignore-only change invalidates every affected candidate", (t
     "vexaai/v012-agent-worker: .dockerignore",
     "vexaai/v012-agent-api: .dockerignore",
     "vexaai/v012-meeting-api: .dockerignore",
+    "vexaai/v012-gateway: .dockerignore",
     "vexaai/vexa-bot: .dockerignore",
   ]);
 });
```

---

### Incident Patch 3: `5f4e3e43` (2026-09-04)
**Commit Message**: deps: clear the residual Dependabot alerts in the Python and transcript-rendering lockfiles (#1542)

Signed-off-by: DmitriyG228 <[REDACTED_EMAIL]>

**File**: `core/gateway/services/gateway/uv.lock` (modified, +102/-102)
```diff
@@ -13,7 +13,7 @@ wheels = [
 
 [[package]]
 name = "aiohttp"
-version = "3.14.1"
+version = "3.14.3"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "aiohappyeyeballs" },
@@ -25,108 +25,108 @@ dependencies = [
     { name = "typing-extensions", marker = "python_full_version < '3.13'" },
     { name = "yarl" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/82/78/8ea7308cac6934de8c74a14f3d5f65d1c89287426688be79538d0e5c013d/aiohttp-3.14.1.tar.gz", hash = "sha256:307f2cff90a764d329e77040603fa032db89c5c24fdad50c4c15334cba744035", size = 7955794, upload-time = "2026-06-07T21:09:35.529Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/58/d9/22ce5786ac0c1653ae8b6c23bded02c1686d11f0dbb45b31ce128e0df985/aiohttp-3.14.3.tar.gz", hash = "sha256:9491196535a88924a60afd5b5f434b5b203b6cc616250878dbdb223a8f7844bc", size = 7971213, upload-time = "2026-07-23T01:57:27.037Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/26/dd/bf526e6f0a1120dd6f2df2e97bacfe4d358f13d17a0ff5847301a1375a51/aiohttp-3.14.1-cp311-cp311-macosx_10_9_universal2.whl", hash = "sha256:aa00140699487bd435fde4342d85c94cb256b7cd3a5b9c3396c67f19922afda2", size = 765225, upload-time = "2026-06-07T21:06:07.957Z" },
-    { url = "https://files.pythonhosted.org/packages/8f/e1/a2872aa55495a70f61310d411541c6ee23812d9a884e000c716e1bc3edbf/aiohttp-3.14.1-cp311-cp311-macosx_10_9_x86_64.whl", hash = "sha256:1c1af67559445498b502030c35c59db59966f47041ca9de5b4e707f86bd10b5f", size = 518743, upload-time = "2026-06-07T21:06:09.749Z" },
-    { url = "https://files.pythonhosted.org/packages/5b/e7/c60c7b209e509cc787de3cea0550a518538cfc08003e1c1e14c1c63fff71/aiohttp-3.14.1-cp311-cp311-macosx_11_0_arm64.whl", hash = "sha256:d44ec478e713ee7f29b439f7eb8dc2b9d4079e11ae114d2c2ac3d5daf30516c8", size = 514139, upload-time = "2026-06-07T21:06:11.26Z" },
-    { url = "https://files.pythonhosted.org/packages/5b/8d/614ace2f579702c9840ab1e1447fd8509e35b0b904f7196418fa2f57b25d/aiohttp-3.14.1-cp311-cp311-manylinux2014_aarch64.manylinux_2_17_aarch64.manylinux_2_28_aarch64.whl", hash = "sha256:d3b1a184a9a8f548a6b73f1e26b96b052193e4b3175ed7342aaf1151a1f00a04", size = 1784088, upload-time = "2026-06-07T21:06:12.887Z" },
-    { url = "https://files.pythonhosted.org/packages/49/e0/726e90f99542bf292f81a96a12cc4847deb86f3ccf62c6f4014a201f4d33/aiohttp-3.14.1-cp311-cp311-manylinux2014_armv7l.manylinux_2_17_armv7l.manylinux_2_31_armv7l.whl", hash = "sha256:5f2504bc0322437c9a1ff6d3333ca56c7477b727c995f036b976ae17b98372c8", size = 1737835, upload-time = "2026-06-07T21:06:14.564Z" },
-    { url = "https://files.pythonhosted.org/packages/0b/4b/d176d5c4db9d33dacf0543102ea59503bc1d528af4cfd0b719949ca49389/aiohttp-3.14.1-cp311-cp311-manylinux2014_ppc64le.manylinux_2_17_ppc64le.manylinux_2_28_ppc64le.whl", hash = "sha256:73f05ea02013e02512c3bf42714f1208c57168c779cc6fe23516e4543089d0a6", size = 1842801, upload-time = "2026-06-07T21:06:16.228Z" },
-    { url = "https://files.pythonhosted.org/packages/dc/d6/5a99b563690ea0cbed912ae94a2ce33993a5709a651a3a4fe761e7dd973a/aiohttp-3.14.1-cp311-cp311-manylinux2014_s390x.manylinux_2_17_s390x.manylinux_2_28_s390x.whl", hash = "sha256:797457503c2d426bee06eef808d07b31ede30b65e054444e7de64cad0061b7af", size = 1929992, upload-time = "2026-06-07T21:06:17.947Z" },
-    { url = "https://files.pythonhosted.org/packages/76/7f/a987b14a3859094b3cea3f4825219c3e5536242564af6e3f9c2f6c994eb2/aiohttp-3.14.1-cp311-cp311-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl", hash = "sha256:b821a1f7dedf7e37450654e620038ac3b2e81e8fa6ea269337e97101978ec730", size = 1786989, upload-time = "2026-06-07T21:06:19.677Z" },
-    { url = "https://files.pythonhosted.org/packages/f1/1a/420e5c85a3e73349372ed22ce0b6af86bfa6ce16a4b20a64a2e94608c781/aiohttp-3.14.1-cp311-cp311-manylinux_2_31_riscv64.manylinux_2_39_riscv64.whl", hash = "sha256:4cd96b5ba05d67ed0cf00b5b405c8cd99586d8e3481e8ee0a831057591af7621", size = 1640129, upload-time = "2026-06-07T21:06:22.558Z" },
-    { url = "https://files.pythonhosted.org/packages/a7/80/18a592ed3be0a402cc03670bd72ee1f8563ddbe1d8d5542dbf868f274136/aiohttp-3.14.1-cp311-cp311-musllinux_1_2_aarch64.whl", hash = "sha256:1d459b98a932296c6f0e94f87511a0b1b90a8a02c30a50e60a297619cd5a58ee", size = 1756576, upload-time = "2026-06-07T21:06:24.8Z" },
-    { url = "https://files.pythonhosted.org/packages/ec/0b/8b3d5713373858ff71a617daf6e3b0e81ad63e79d09a3cf2f6b6b983939c/aiohttp-3.14.1-cp311-cp311-musllinux_1_2_armv7l.whl", hash = "sha256:764457a7be60825fb770a644852ff717bcbb5042f189f2bd16df61a81b3f6573", size = 1754668, upload-time = "2026-06-07T21:06:26.528Z" },
-    { url = "https://files.pythonhosted.org/packages/9f/49/fd564575cf225821d7ba5a117cb8bc27213d8a7e1811162afb43ae077039/aiohttp-3.14.1-cp311-cp311-musllinux_1_2_ppc64le.whl", hash = "sha256:f7a16ef45b081454ef844502d87a848876c490c4cb5c650c230f6ec79ed2c1e7", size = 1817019, upload-time = "2026-06-07T21:06:28.297Z" },
-    { url =
```

**File**: `core/meetings/services/mcp/uv.lock` (modified, +47/-47)
```diff
@@ -239,58 +239,58 @@ wheels = [
 
 [[package]]
 name = "cryptography"
-version = "49.0.0"
+version = "50.0.1"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "cffi", marker = "platform_python_implementation != 'PyPy'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/1f/99/d1c90d6041656cc6ee229dc99cd67fd0cd5aec3c5f7d72fffc27cc750054/cryptography-49.0.0.tar.gz", hash = "sha256:f89660a348f4f78a92366240a61404e337586ef7f5909a2fef59ca88ef505493", size = 854345, upload-time = "2026-06-12T20:02:30.512Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/bb/ad/5d6702db60b1e40b41ef513b6967ff5848f307d50f8449baf1634f5908f1/cryptography-50.0.1.tar.gz", hash = "sha256:5dd9bda1c12b4162f6ff568eeb5e0ff956c28d14406e875cfe8a63a2d414ff20", size = 880381, upload-time = "2026-08-25T19:45:45.499Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/9b/22/adf66990e63584a68dfb50c24f48a125c07b1699899381c8151e63ed458c/cryptography-49.0.0-cp311-abi3-macosx_11_0_arm64.whl", hash = "sha256:966fe0e9c67490071f14c0d2b1cb2dfb3023c5ce39457343931415f08382f2db", size = 4032100, upload-time = "2026-06-12T20:02:32.143Z" },
-    { url = "https://files.pythonhosted.org/packages/09/41/3797cfaf69cae04a13ee78ebd83f0678d9c02b4779d21ce24445326f1a69/cryptography-49.0.0-cp311-abi3-manylinux2014_aarch64.manylinux_2_17_aarch64.whl", hash = "sha256:36d1709f992593689b45bda411498d62c6e365f2ca00b84657d4dadd24de16db", size = 4692978, upload-time = "2026-06-12T20:01:21.305Z" },
-    { url = "https://files.pythonhosted.org/packages/e6/8b/43011f7ebe515a8aa20d61f290a326cd890c2e738e16e59eaff8d9c3a412/cryptography-49.0.0-cp311-abi3-manylinux2014_x86_64.manylinux_2_17_x86_64.whl", hash = "sha256:0e959b578856a3924bc0cbb710fc12c387b9412a951389f3ca61704a9e25f325", size = 4716422, upload-time = "2026-06-12T20:01:48.566Z" },
-    { url = "https://files.pythonhosted.org/packages/4a/91/01ce7303a4579e6d3a6abef01bd322848e9ea7a219adcabc5048b9033571/cryptography-49.0.0-cp311-abi3-manylinux_2_28_aarch64.whl", hash = "sha256:53ecee2e23f7169b6117e99fc8a944e5e50f79e69758a83b52a00cb98ab2b2d2", size = 4700503, upload-time = "2026-06-12T20:02:47.091Z" },
-    { url = "https://files.pythonhosted.org/packages/62/99/a2c95cf8293f07491e9e27c20cc4dcd18176d944e674679adeb1d0173fd6/cryptography-49.0.0-cp311-abi3-manylinux_2_28_ppc64le.whl", hash = "sha256:2eda353d8a27bcbcaa4cbed18994a74ab4d19a2ca897db188ea269ab9b71419b", size = 5309779, upload-time = "2026-06-12T20:02:08.987Z" },
-    { url = "https://files.pythonhosted.org/packages/20/2c/0622f20ff02b2ef32558733443805dc82fd4c275be01b2d19d14676f3a1b/cryptography-49.0.0-cp311-abi3-manylinux_2_28_x86_64.whl", hash = "sha256:2afe9051da7ae7bd5905da5a949280c7d2bb75682e188f650a9d0f2756b834c6", size = 4749683, upload-time = "2026-06-12T20:02:03.335Z" },
-    { url = "https://files.pythonhosted.org/packages/a3/5b/c5246635d5fd3b64e0d45ae10e99fd32fe9676a79915ccfe5a61ba9af1a5/cryptography-49.0.0-cp311-abi3-manylinux_2_31_armv7l.whl", hash = "sha256:0b82e28ee398a386f0807bba7884d30f25218855690f45115831bcce5d90822c", size = 4337874, upload-time = "2026-06-12T20:02:54.323Z" },
-    { url = "https://files.pythonhosted.org/packages/6d/88/05563c7fe2e914e87d1a536d06fe83e66b4e1d95cb593e05aea375531da8/cryptography-49.0.0-cp311-abi3-manylinux_2_34_aarch64.whl", hash = "sha256:ccac2bfebc306b862133e3bb71f3f6ee8bb525240089b2d952e4144b3a6d5da7", size = 4700283, upload-time = "2026-06-12T20:01:34.822Z" },
-    { url = "https://files.pythonhosted.org/packages/c4/b6/d7696e4e890d6ae1469935164c9e5215c557671cb78d6e3f458ccceaa632/cryptography-49.0.0-cp311-abi3-manylinux_2_34_ppc64le.whl", hash = "sha256:d0527ce944105f257f605a827d6ebead966c752038b6e8656abb9c5edee6fc68", size = 5265844, upload-time = "2026-06-12T20:01:24.09Z" },
-    { url = "https://files.pythonhosted.org/packages/a9/3c/f3ad17eecc1a57b0ba236dc01f90e783c51f4a2f35f64777cc4f47a184b2/cryptography-49.0.0-cp311-abi3-manylinux_2_34_x86_64.whl", hash = "sha256:cbc77da8c523d5abd028635ba850a6966fcee2c82e2bf65a41d1d8afe0f98be9", size = 4749290, upload-time = "2026-06-12T20:01:30.848Z" },
-    { url = "https://files.pythonhosted.org/packages/4f/01/339573cf1023163a400b0b5d16f6d507de413b9f60be6fd1b77feeaf6737/cryptography-49.0.0-cp311-abi3-musllinux_1_2_aarch64.whl", hash = "sha256:b87e65d263b3e5d3bb92a57e2a6638e2f31110fa7aa890c7b2dbba42248d0a3f", size = 4834612, upload-time = "2026-06-12T20:01:29.246Z" },
-    { url = "https://files.pythonhosted.org/packages/71/fd/577302e213a1be9468f92d1afef66fcf1ef83d516819d9992ca547f592bd/cryptography-49.0.0-cp311-abi3-musllinux_1_2_x86_64.whl", hash = "sha256:66ec79c3904820572d7e987abdf304281f141d37ad9a489b8e97066e7b9b6459", size = 4980804, upload-time = "2026-06-12T20:01:42.853Z" },
-    { url = "https://files.pythonhosted.org/packages/1f/09/f42b1d190c5ba75f72062a387f8030d1d75f6ab035788f1d9c4b01de6525/cryptography-49.0.0-cp311-abi3-win_amd64.whl", hash = "sha256:e5dfc1e64de5677cec922ffa8da89c546d0415bf6efdf081842
```

**File**: `core/meetings/services/transcription/uv.lock` (modified, +3/-3)
```diff
@@ -774,11 +774,11 @@ wheels = [
 
 [[package]]
 name = "setuptools"
-version = "82.0.1"
+version = "84.0.0"
 source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/4f/db/cfac1baf10650ab4d1c111714410d2fbb77ac5a616db26775db562c8fab2/setuptools-82.0.1.tar.gz", hash = "sha256:7d872682c5d01cfde07da7bccc7b65469d3dca203318515ada1de5eda35efbf9", size = 1152316, upload-time = "2026-03-09T12:47:17.221Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/6d/44/f5da03a8ef95d369145c5bb53050e7877c9f3d312e128605fd9504829143/setuptools-84.0.0.tar.gz", hash = "sha256:f4695c21257f0d9b537ec2692c941d02ee143b7cc1276941349a546573b2ef73", size = 1168449, upload-time = "2026-08-08T18:27:58.365Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/9d/76/f789f7a86709c6b087c5a2f52f911838cad707cc613162401badc665acfe/setuptools-82.0.1-py3-none-any.whl", hash = "sha256:a59e362652f08dcd477c78bb6e7bd9d80a7995bc73ce773050228a348ce2e5bb", size = 1006223, upload-time = "2026-03-09T12:47:15.026Z" },
+    { url = "https://files.pythonhosted.org/packages/95/9c/c510029fc6ef33a6275cd2c5d3cecd6613dfd6aa401d57c54f1c18852ccf/setuptools-84.0.0-py3-none-any.whl", hash = "sha256:51a52592b3b99e102b609654876bd65f19f999935166d1352678931132b0c670", size = 818216, upload-time = "2026-08-08T18:27:56.719Z" },
 ]
 
 [[package]]
```

**File**: `packages/transcript-rendering/package-lock.json` (modified, +44/-10)
```diff
@@ -16,9 +16,9 @@
       }
     },
     "node_modules/@emnapi/wasi-threads": {
-      "version": "1.2.2",
-      "resolved": "https://registry.npmjs.org/@emnapi/wasi-threads/-/wasi-threads-1.2.2.tgz",
-      "integrity": "sha512-c95qOXkHdydNKhscBTebqEC1CVAZpyqOfVfBzQ1qgzyl3gfeldUjIggDbIZgDKsHLgnsM+igH7TJ/eAasaVuMA==",
+      "version": "1.2.3",
+      "resolved": "https://registry.npmjs.org/@emnapi/wasi-threads/-/wasi-threads-1.2.3.tgz",
+      "integrity": "sha512-ELEBe8PsLvvJ6QMr0zLt8ffvOHW/dc1m3CEzNMg7aJUv3bMaoDtw2TXyDAwkYBuroxxuHEwhRTLJSe5sya547g==",
       "dev": true,
       "license": "MIT",
       "optional": true,
@@ -759,6 +759,40 @@
         "node": "^20.19.0 || >=22.12.0"
       }
     },
+    "node_modules/@rolldown/binding-wasm32-wasi/node_modules/@emnapi/core": {
+      "version": "1.11.1",
+      "resolved": "https://registry.npmjs.org/@emnapi/core/-/core-1.11.1.tgz",
+      "integrity": "sha512-RSvbQmHzdKzNsLYa/wHrbc3KN4sYLKAdPZxqiM2HATqv/SBk2/ENSHpvXGaLOMcsAyz0poEGqkmmKYG3OWiJEQ==",
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "dependencies": {
+        "@emnapi/wasi-threads": "1.2.2",
+        "tslib": "^2.4.0"
+      }
+    },
+    "node_modules/@rolldown/binding-wasm32-wasi/node_modules/@emnapi/runtime": {
+      "version": "1.11.1",
+      "resolved": "https://registry.npmjs.org/@emnapi/runtime/-/runtime-1.11.1.tgz",
+      "integrity": "sha512-vgj7R3y3Wgx24IQaGPA/R6YFXLHVMOZ0uVEyIQPaWs+rd1AzfEMXlAC22FYwO1XkKR6NPsq7mUandH8oIRdZFw==",
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "dependencies": {
+        "tslib": "^2.4.0"
+      }
+    },
+    "node_modules/@rolldown/binding-wasm32-wasi/node_modules/@emnapi/wasi-threads": {
+      "version": "1.2.2",
+      "resolved": "https://registry.npmjs.org/@emnapi/wasi-threads/-/wasi-threads-1.2.2.tgz",
+      "integrity": "sha512-c95qOXkHdydNKhscBTebqEC1CVAZpyqOfVfBzQ1qgzyl3gfeldUjIggDbIZgDKsHLgnsM+igH7TJ/eAasaVuMA==",
+      "dev": true,
+      "license": "MIT",
+      "optional": true,
+      "dependencies": {
+        "tslib": "^2.4.0"
+      }
+    },
     "node_modules/@rolldown/binding-win32-arm64-msvc": {
       "version": "1.1.5",
       "resolved": "https://registry.npmjs.org/@rolldown/binding-win32-arm64-msvc/-/binding-win32-arm64-msvc-1.1.5.tgz",
@@ -1920,9 +1954,9 @@
       }
     },
     "node_modules/nanoid": {
-      "version": "3.3.12",
-      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.12.tgz",
-      "integrity": "sha512-ZB9RH/39qpq5Vu6Y+NmUaFhQR6pp+M2Xt76XBnEwDaGcVAqhlvxrl3B2bKS5D3NH3QR76v3aSrKaF/Kiy7lEtQ==",
+      "version": "3.3.18",
+      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.18.tgz",
+      "integrity": "sha512-DTg4MJbGMWkfi6VZFdNt2/caMbQy4Ou+Op/hJQvGEWcnVfoA1QA+xzRKAzw9jD6+GVOOeYr/mIcuDSdug6F6+w==",
       "dev": true,
       "funding": [
         {
@@ -2010,9 +2044,9 @@
       }
     },
     "node_modules/postcss": {
-      "version": "8.5.17",
-      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.17.tgz",
-      "integrity": "sha512-J7EF+8X+CzRPaJPOv9Ck2wNWJvGnnl3PcNPAdGg6GTLjyVpyQ0yATMSXRFRV01BviT/9Gwuc3rjEyJbDJG9a4w==",
+      "version": "8.5.28",
+      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.28.tgz",
+      "integrity": "sha512-RRuzqDtt5Y9h3quz5hWhK+TPnsmVs6WwSU6LkJMeY4HstUEDuYTG8UJSdawMRzmzAtV+KEoG8N3Qg2qLy5vM/A==",
       "dev": true,
       "funding": [
         {
@@ -2031,7 +2065,7 @@
       "license": "MIT",
       "peer": true,
       "dependencies": {
-        "nanoid": "^3.3.12",
+        "nanoid": "^3.3.18",
         "picocolors": "^1.1.1",
         "source-map-js": "^1.2.1"
       },
```

**File**: `packages/transcript-rendering/package.json` (modified, +3/-1)
```diff
@@ -45,7 +45,9 @@
     "vitest": "^4.1.7"
   },
   "overrides": {
-    "esbuild": "^0.28.1"
+    "esbuild": "^0.28.1",
+    "postcss": ">=8.5.23",
+    "nanoid": "^3.3.18"
   },
   "license": "Apache-2.0"
 }
```

---

### Incident Patch 4: `6dd9cb27` (2026-08-31)
**Commit Message**: train 0.12.26 — one drain: Zoom per-track attribution, popup sweep, typed join evidence, probe + noble build fixes (#1371)

* docs(changelog): #1011 fragment — say what the change does, not what was already true

The fragment claimed the images "now run the Python interpreter as a non-root
user." They already did: the agent worker execs its venv as a non-root
per-subject uid in core/runtime/src/runtime_kernel/isolation.py, which predates
this PR. What #1011 changes is the traverse bit on /root, so that existing
non-root exec can actually reach its uv-managed interpreter — plus the single
Noble base shared by Lite and the full bot.

Fragments reach the public release notes; this one would have shipped a
hardening claim we did not make.

Signed-off-by: DmitriyG228 <[REDACTED_EMAIL]>

* fix(speaker-split): recognize Zoom's speaker-view active tile

Zoom's active-speaker container moved to the single-view family (single-suspension/single-main); match it so mixed-lane speaker hints cross again. Includes the live speaking-tile diagnostics used to find it (Teams + Zoom).

Signed-off-by: Jacob Schooley <[REDACTED_EMAIL]>
Signed-off-by: DmitriyG228 <[REDACTED_EMAIL]>

* fix(mixed): stamp mi

**File**: `core/meetings/contracts/lifecycle.v1/README.md` (modified, +42/-0)
```diff
@@ -36,4 +36,46 @@ ownership remains unresolved for downstream billing. An admitted mixed-version s
 lifecycle event lacks a producer timestamp is likewise unresolved: receiver time remains useful
 for operations, but retry latency makes it invalid for rating.
 
+## `join_evidence` — typed join-failure evidence (#1059, #1058)
+
+An **additive** field on a terminal `failed` event, riding this contract's liberal ingestion
+(`additionalProperties: true`) exactly as `infra_fault` and `stt_fault` do — **no schema change, no
+seal bump**. The sealed `CompletionReason` enum is deliberately untouched: it is the retry
+classifier's input (`lifecycle/retry.py`), and this is a diagnostic axis, not a retry input.
+
+It exists because `completion_reason` alone could not answer either question an operator asks of a
+failed join. In hosted production, every one of 83 consecutive `join_failure` meetings carried
+`data.reason = None`, and a ~20s Teams refusal shared its label with a ~13min Google Meet lobby
+expiry — two different owners, two different fixes, one number.
+
+```jsonc
+"join_evidence": {
+  "reason":      "awaiting_admission_timeout",
+                                        // WHAT: awaiting_admission_rejected · awaiting_admission_timeout ·
+                                        //   auth_session_missing · never_reached_lobby ·
+                                        //   navigation_failure · stopped_while_joining · unknown
+                                        //   (the first three are the SEALED enum's own words: one
+                                        //    word per fact, so the axes layer instead of competing)
+  "attribution": "host_action",         // WHO:  system_fault · user_action · host_action ·
+                                        //   exogenous_platform · unknown
+  "source":      "bot",                 // bot (first-hand) · reconcile · runtime_destroy · derived
+  "stage":       "awaiting_admission",
+  "detail":      "…the platform's own signal that triggered the classification (capped)…",
+  "timings":     { "time_to_lobby_ms": 7000, "time_in_lobby_ms": 780000, "total_ms": 787000 },
+  "lobby_budget_ms": 600000             // the deadline the control plane itself issued
+}
+```
+
+The producer (`services/bot/src/join-evidence.ts`) classifies at the source, where the platform
+signal and the clock actually are; meeting-api (`lifecycle/join_evidence.py`) validates that verdict
+and **derives** one when a producer sends none, so reconcile-driven and runtime-destroy terminals —
+and any bot too old to classify — are evidenced too. Persisted at `meeting.data.join_evidence`,
+alongside a top-level `meeting.data.reason`.
+
+`attribution` is the axis the reliability gate reads:
+`system_failure_rate = failures(attribution = system_fault) / fair-chance meetings`, per release and
+per platform. An absent timing is **absent**, never zero — "nobody measured" and "zero ms" are
+different facts. Producing this evidence is **fail-open**: it describes a run that has already
+ended, and no fault in it may alter the terminal being recorded.
+
 No auth token (transport-layer), no tenancy fields (deferred). Goldens validated by `gate:schema`.
```

**File**: `core/meetings/contracts/lifecycle.v1/golden/LifecycleEvent.failed-join-evidence.json` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+{
+  "connection_id": "sess-uid",
+  "status": "failed",
+  "timestamp": "2026-08-08T10:23:07.000Z",
+  "exit_code": 1,
+  "failure_stage": "awaiting_admission",
+  "completion_reason": "awaiting_admission_timeout",
+  "reason": "Bot is still in the Google Meet waiting room after timeout — host did not admit",
+  "join_evidence": {
+    "reason": "awaiting_admission_timeout",
+    "attribution": "host_action",
+    "source": "bot",
+    "stage": "awaiting_admission",
+    "detail": "Bot is still in the Google Meet waiting room after timeout — host did not admit",
+    "timings": {
+      "time_to_lobby_ms": 7000,
+      "time_in_lobby_ms": 780000,
+      "total_ms": 787000
+    },
+    "lobby_budget_ms": 600000
+  }
+}
```

**File**: `core/meetings/modules/join/src/zoom/leave.ts` (modified, +13/-0)
```diff
@@ -21,6 +21,19 @@ export async function dismissZoomPopups(page: Page): Promise<void> {
     // Doesn't block joining but spams logs and remains on screen
     // until manually dismissed. Click any of OK / Dismiss / Got it / Continue.
     { selector: '.zm-modal:has-text("mic is muted") button:has-text("OK"), .zm-modal:has-text("mic is muted") button:has-text("Got it"), .zm-modal:has-text("mic is muted") button:has-text("Dismiss"), .zm-modal:has-text("mic is muted") button:has-text("Continue")', label: 'mic-muted advisory' },
+    // Zoom advisory toast (confirmed live, in the recording frame): "For a better meeting
+    // experience, enable the option 'Use graphics/hardware acceleration' under browser system
+    // settings. Learn more". A dark non-blocking bar pinned top-center over the meeting — so it
+    // lands in the recording — dismissed only by an ✕ close control (NOT a text button), with a
+    // "Learn more" link we must never click. Anchored on the distinctive word "acceleration"
+    // (the wrapper class drifts across client builds) inside any of Zoom's notification/toast/modal
+    // shapes, then the close control by aria-label or a "close" class — never "Learn more".
+    { selector: [
+        ':is([class*="notification"], [class*="toast"], [class*="alert"], [class*="tip"], .zm-modal, [role="alert"], [role="dialog"]):has-text("acceleration") [aria-label*="close" i]',
+        ':is([class*="notification"], [class*="toast"], [class*="alert"], [class*="tip"], .zm-modal, [role="alert"], [role="dialog"]):has-text("acceleration") [class*="close" i]',
+        ':is([class*="notification"], [class*="toast"], [class*="alert"], [class*="tip"], .zm-modal, [role="alert"], [role="dialog"]):has-text("acceleration") :is(button, [role="button"]):has-text("Dismiss")',
+        ':is([class*="notification"], [class*="toast"], [class*="alert"], [class*="tip"], .zm-modal, [role="alert"], [role="dialog"]):has-text("acceleration") :is(button, [role="button"]):has-text("Got it")',
+      ].join(', '), label: 'hardware-acceleration advisory' },
   ];
 
   for (const { selector, label } of dismissTargets) {
```

**File**: `core/meetings/modules/join/src/zoom/removal.ts` (modified, +7/-0)
```diff
@@ -1,6 +1,7 @@
 import { Page } from "playwright";
 import { log } from "../_host";
 import { zoomLeaveButtonSelector, zoomMeetingEndedModalSelector, zoomRemovalTexts } from "./selectors";
+import { dismissZoomPopups } from "./leave";
 
 /**
  * Starts polling for removal/end-of-meeting events.
@@ -86,6 +87,12 @@ export function startZoomRemovalMonitor(
     if (stopped || !page || page.isClosed()) return;
 
     try {
+      // Sweep benign Zoom popups off the meeting on every poll — the "mic is muted" advisory, the AI
+      // Companion notice, feature tips — so they don't linger over the call or the server-side recording.
+      // dismissZoomPopups is text/selector-anchored + instant (timeout:0), no-ops when absent, and never
+      // touches the removal/end modal (that's detected below). Was previously only run on leave.
+      await dismissZoomPopups(page).catch(() => {});
+
       // Check for end-of-meeting modal (zm-modal-body-title)
       const modalEl = page.locator(zoomMeetingEndedModalSelector).first();
       const modalVisible = await modalEl.isVisible({ timeout: 300 }).catch(() => false);
```

**File**: `core/meetings/modules/mixed-capture-core/src/mixed-audio.ts` (modified, +12/-2)
```diff
@@ -36,7 +36,7 @@ export interface MixedAudioOptions {
 
 export async function createMixedAudioCapture(
   stream: MediaStream,
-  onPcm: (pcm: Float32Array) => void,
+  onPcm: (pcm: Float32Array, tsMs?: number) => void,
   opts: MixedAudioOptions = {},
 ): Promise<MixedAudioCapture> {
   const SR = opts.sampleRate ?? 16000;
@@ -47,11 +47,21 @@ export async function createMixedAudioCapture(
   const ctx = new AudioContext({ sampleRate: SR });
   const source = ctx.createMediaStreamSource(stream);
   const proc = ctx.createScriptProcessor(4096, 1, 1);
+  // Accumulated-audio-time clock: stamp each frame with the wall-clock of the AUDIO it holds
+  // (anchor + samples-so-far / rate), NOT Date.now() at callback time. The ScriptProcessor fires a
+  // buffer-length (~256ms) AFTER the audio was captured, and that latency + event-loop jitter is
+  // exactly what pushed frames out of the speaker-hint binder's match window (misattribution). Count
+  // ALL processed samples — silent frames included — so the clock never drifts from real time. It's
+  // the same page clock the active-speaker hints carry, so the binder can align them.
+  const startMs = Date.now();
+  let processedSamples = 0;
   proc.onaudioprocess = (e: AudioProcessingEvent) => {
     const input = e.inputBuffer.getChannelData(0);
+    const tsMs = startMs + (processedSamples / SR) * 1000;   // wall-clock of this frame's first sample
+    processedSamples += input.length;
     let maxVal = 0;
     for (let i = 0; i < input.length; i++) { const a = Math.abs(input[i]); if (a > maxVal) maxVal = a; }
-    if (maxVal > SILENCE) onPcm(new Float32Array(input));   // copy — the buffer is reused
+    if (maxVal > SILENCE) onPcm(new Float32Array(input), tsMs);   // copy — the buffer is reused
   };
   source.connect(proc);
   proc.connect(ctx.destination);                           // pull the processor (outputs silence)
```

**File**: `core/meetings/modules/remote-browser/package.json` (modified, +3/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "@vexa/remote-browser",
   "version": "0.1.0",
-  "description": "Remote browser as container: persistent-context launch (VNC/CDP), browser-session persistence + retrieval (cookies/localStorage), and logged-in validation \u2014 so the join layer can join authenticated.",
+  "description": "Remote browser as container: persistent-context launch (VNC/CDP), browser-session persistence + retrieval (cookies/localStorage), and logged-in validation — so the join layer can join authenticated.",
   "type": "commonjs",
   "main": "dist/index.js",
   "types": "dist/index.d.ts",
@@ -22,7 +22,8 @@
   },
   "dependencies": {
     "playwright": "1.56.0",
-    "playwright-extra": "^4.3.6"
+    "playwright-extra": "^4.3.6",
+    "puppeteer-extra-plugin-stealth": "^2.11.2"
   },
   "devDependencies": {
     "@types/node": "^20.0.0",
```

**File**: `core/meetings/modules/remote-browser/src/browser.ts` (modified, +46/-0)
```diff
@@ -7,9 +7,18 @@
  * the index.ts authenticated branch) — same options, single source of truth.
  */
 import { chromium } from 'playwright-extra';
+import StealthPlugin from 'puppeteer-extra-plugin-stealth';
 import type { BrowserContext, Page } from 'playwright';
 import { BROWSER_DATA_DIR } from './session-store';
 
+// Anti-detection: register the stealth evasions ONCE at module load — playwright-extra's `chromium`
+// then applies them to every launchPersistentContext below. The two launch flags we already set
+// (--disable-blink-features=AutomationControlled + stripping --enable-automation) only mask
+// navigator.webdriver; the stealth plugin patches the rest of the fingerprint surface Google Meet's
+// anti-abuse reads to bucket a bot into "With potential risks" — navigator.plugins/languages,
+// WebGL vendor/renderer, chrome.runtime, permissions, iframe.contentWindow, and more.
+chromium.use(StealthPlugin());
+
 export interface LaunchPersistentOptions {
   /** Chromium profile dir — the durable session lives here. Defaults to BROWSER_DATA_DIR. */
   dataDir?: string;
@@ -35,6 +44,43 @@ export async function launchPersistentBrowser(
     viewport: null,
     locale,
   });
+  // Anti-detection the stealth plugin misses under playwright-extra. Measured live (with stealth
+  // active) that the bot's browser still leaks the tells below; patch them on every frame/navigation.
+  await context.addInitScript(() => {
+    const g: any = globalThis;
+    // WebGL: the container has NO GPU, so ANGLE falls back to SwiftShader — a strong "server/VM/bot"
+    // signal Google Meet's anti-abuse reads (and the reason toggling hardware-acceleration can't help:
+    // there is no device to accelerate onto). Report a plausible real Intel/Mesa GPU consistent with
+    // the Linux UA for the UNMASKED vendor (37445) / renderer (37446) parameters. Covers WebGL1+2.
+    const spoof: Record<number, string> = {
+      37445: 'Google Inc. (Intel)',
+      37446: 'ANGLE (Intel, Mesa Intel(R) UHD Graphics 630 (CFL GT2), OpenGL 4.6)',
+    };
+    const patchGL = (proto: any): void => {
+      if (!proto || !proto.getParameter) return;
+      const orig = proto.getParameter;
+      const wrapped = function (this: any, param: number): any {
+        return param in spoof ? spoof[param] : orig.call(this, param);
+      };
+      try { (wrapped as any).toString = orig.toString.bind(orig); } catch { /* keep going */ }
+      proto.getParameter = wrapped;
+    };
+    patchGL(g.WebGLRenderingContext && g.WebGLRenderingContext.prototype);
+    patchGL(g.WebGL2RenderingContext && g.WebGL2RenderingContext.prototype);
+    // navigator.deviceMemory: real Chrome exposes it; absent on the bot.
+    try {
+      if (g.navigator && g.navigator.deviceMemory === undefined) {
+        Object.defineProperty(g.navigator, 'deviceMemory', { get: () => 8, configurable: true });
+      }
+    } catch { /* best-effort */ }
+    // chrome.runtime: window.chrome is present (stealth) but runtime is missing — a headless tell.
+    try {
+      if (g.chrome && !g.chrome.runtime) {
+        g.chrome.runtime = { id: undefined, connect: () => {}, sendMessage: () => {} };
+      }
+    } catch { /* best-effort */ }
+  });
+
   const pages = context.pages();
   const page = pages.length > 0 ? pages[0] : await context.newPage();
   return { context: context as BrowserContext, page: page as Page };
```

**File**: `core/meetings/modules/zoom-capture/README.md` (modified, +16/-4)
```diff
@@ -14,16 +14,28 @@ no audio of its own:
   The downstream [`@vexa/mixed-pipeline`](../mixed-pipeline/) namer window-matches these hints against
   segmentation turns. `getState()` surfaces matched selectors + a tile survey for live selector tuning.
 - `createZoomChat` — reads the chat panel (content tier); emits each new message as `{ sender, text }`.
+- `createTrackNameResolver` — the **per-track** lane's channel↔name correlator. Zoom in fact delivers
+  one WebRTC track per participant (witnessed live: 5 streams / 5 speakers, 0 remaps), so the bot can
+  capture each participant on their own channel and skip the mix entirely. That makes the audio
+  trustworthy and the NAME the unreliable part, which is the same shape Teams has and the opposite of
+  Meet's (Meet hands the name over at turn onset). This is the resolver for it: vote/argmax binding,
+  margin hysteresis, 1:1 by identity with a purity co-hold for genuinely duplicate names, idle release
+  on rejoin, a sticky **self-exclusion** backstop, and stable **`Speaker A/B/C`** labels for channels
+  that never earn a name. **Pure logic — no DOM, no audio** — so it is golden-testable offline, the
+  way [`GmeetChannelBinder`](../gmeet-capture/) and [`TrackNamer`](../mixed-pipeline/) are.
 
 **Two hosts, one brick** — the [bot](../../services/) reads `window.__vexaZoomSpeakers` (bundled into
 its browser globals); the [extension](../../../clients/) imports it to label the mixed `tabCapture`
 track. Selectors mirror the bot's Zoom `selectors.ts` and are defensive (Zoom's DOM shifts across builds).
 
 ## Surface
-`createZoomSpeakers` · `createZoomChat` (+ types `ZoomSpeakers`, `ZoomChat`, `ZoomChatMessage`).
-Front door: [`src/index.ts`](src/index.ts).
+`createZoomSpeakers` · `createZoomChat` · `createTrackNameResolver` · `speakerLabel` ·
+`TRACK_NAME_DEFAULTS` (+ types `ZoomSpeakers`, `ZoomChat`, `ZoomChatMessage`, `TrackNameResolver`,
+`TrackNameResolverOptions`). Front door: [`src/index.ts`](src/index.ts).
 
 ## Verify
-`pnpm --filter @vexa/zoom-capture run build` — `tsc` clean. The DOM scraping (active-speaker + chat) is
-validated **live** in a real Zoom (extension/bot) — consistent with how the lane has always been tested.
+`pnpm --filter @vexa/zoom-capture run build` — `tsc` clean; `run test` chains the chat/active-speaker
+unit and the resolver goldens. The DOM scraping (active-speaker + chat) is
+validated **live** in a real Zoom (extension/bot) — consistent with how the lane has always been tested;
+the resolver, being pure, is proved offline against its goldens instead.
 `tsconfig` adds the `DOM` lib. Covered by `gate:node`, `gate:isolation`, `gate:exports`, `gate:readme`.
```

---

### Incident Patch 5: `76723d23` (2026-08-31)
**Commit Message**: build: noble base image + non-root interpreter exec (lite + full) (#1011)

deploy/lite/Dockerfile.lite (all stages) and the full bot's meet-join-env base
(core/meetings/modules/join/Dockerfile.env) build on
mcr.microsoft.com/playwright:v1.56.0-noble — one base for both.

Grant the sandbox uid traverse into /root (chmod o+x /root): the agent worker
runs as a non-root per-subject uid and execs its uv-managed CPython under /root,
but /root is 0700, so each dispatch died "Permission denied" (exit 126) and
respawned forever. Traverse-only — /root stays unlistable.

Signed-off-by: Jacob Schooley <[REDACTED_EMAIL]>

**File**: `core/meetings/modules/join/Dockerfile.env` (modified, +1/-1)
```diff
@@ -10,7 +10,7 @@
 #   - the live lens: x11vnc + novnc + websockify
 #
 # Build:  docker build -f Dockerfile.env -t vexa/meet-join-env:dev .
-FROM mcr.microsoft.com/playwright:v1.56.0-jammy
+FROM mcr.microsoft.com/playwright:v1.56.0-noble
 ENV DEBIAN_FRONTEND=noninteractive
 RUN apt-get update && apt-get install -y --no-install-recommends \
       xvfb x11vnc websockify novnc xdotool xclip \
```

**File**: `deploy/lite/Dockerfile.lite` (modified, +19/-8)
```diff
@@ -22,7 +22,7 @@
 # Mirrors core/meetings/services/bot/Dockerfile (builder), but on the official Playwright
 # image instead of the published meet-join-env base. Browsers come from /ms-playwright.
 # -----------------------------------------------------------------------------
-FROM mcr.microsoft.com/playwright:v1.56.0-jammy AS bot-builder
+FROM mcr.microsoft.com/playwright:v1.56.0-noble AS bot-builder
 ENV PNPM_HOME=/pnpm \
     PATH=/pnpm:$PATH \
     PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
@@ -52,7 +52,7 @@ RUN cd /build && node core/meetings/services/bot/warm-hf-cache.mjs || echo "[bot
 # runtime node_modules (npm prune --omit=dev) rather than a standalone trace. Built on the SAME
 # Playwright base as the final stage so any native addon (ws' bufferutil) is ABI-compatible.
 # -----------------------------------------------------------------------------
-FROM mcr.microsoft.com/playwright:v1.56.0-jammy AS terminal-builder
+FROM mcr.microsoft.com/playwright:v1.56.0-noble AS terminal-builder
 WORKDIR /app/terminal
 COPY clients/terminal/package.json clients/terminal/package-lock.json ./
 RUN npm ci --no-audit --no-fund
@@ -61,14 +61,14 @@ COPY clients/terminal/ ./
 RUN npm run build && npm prune --omit=dev
 
 # -----------------------------------------------------------------------------
-# Stage 2c: valkey-builder — build valkey-server + valkey-cli from source on the SAME jammy glibc
+# Stage 2c: valkey-builder — build valkey-server + valkey-cli from source on the SAME glibc
 # as the final stage. Valkey (Linux Foundation BSD-3 fork of Redis 7.2.4) gives XAUTOCLAIM parity
 # with compose/helm and keeps Lite off BOTH ends of the #653 gap: jammy apt's stale redis 6.0.16
 # (no XAUTOCLAIM — the v0.12.5 witness root) AND source-available Redis ≥7.4 (RSALv2/SSPLv1). Built
 # from the pinned git tag, so: no external apt-repo trust (the issue verified redis's apt license
 # metadata is wrong), and no glibc mismatch — an alpine/musl binary can't run on this glibc base.
 # -----------------------------------------------------------------------------
-FROM mcr.microsoft.com/playwright:v1.56.0-jammy AS valkey-builder
+FROM mcr.microsoft.com/playwright:v1.56.0-noble AS valkey-builder
 ARG VALKEY_VERSION=8.1.9
 # Pinned SHA-256 of the tag tarball (supply-chain, production-grade R16): the build verifies the bytes,
 # not just the version. `sha256sum -c` fails LOUD on any mismatch — a tampered or drifted tarball stops
@@ -89,7 +89,7 @@ RUN curl -fsSL "https://github.com/valkey-io/valkey/archive/refs/tags/${VALKEY_V
 # -----------------------------------------------------------------------------
 # Stage 3: final — assemble the all-in-one runtime image on the same Playwright base.
 # -----------------------------------------------------------------------------
-FROM mcr.microsoft.com/playwright:v1.56.0-jammy AS final
+FROM mcr.microsoft.com/playwright:v1.56.0-noble AS final
 ENV DEBIAN_FRONTEND=noninteractive
 
 # System stack: Python (the 5 services) · supervisor · X11/audio (Xvfb/fluxbox/pulse) ·
@@ -112,8 +112,10 @@ COPY --from=valkey-builder /opt/valkey/bin/valkey-server /opt/valkey/bin/valkey-
 COPY --from=valkey-builder /valkey-COPYING /usr/local/share/valkey/LICENSE
 RUN valkey-server --version && command -v valkey-cli
 
-# uv (the per-service venvs are resolved from each service's own pyproject + uv.lock).
-RUN pip3 install --no-cache-dir uv==0.9.22
+# uv — the per-service venvs resolve from each service's pyproject + uv.lock. Standalone installer
+# (version-pinned), on PATH at /usr/local/bin.
+RUN curl -LsSf https://astral.sh/uv/0.9.22/install.sh | env UV_INSTALL_DIR=/usr/local/bin UV_NO_MODIFY_PATH=1 sh \
+ && uv --version
 
 ENV UV_LINK_MODE=copy \
     PYTHONUNBUFFERED=1 \
@@ -126,7 +128,7 @@ RUN mkdir -p /var/log/supervisor /var/lib/redis /var/run/redis /workspaces
 # ── Python venvs — one per service (avoids cross-service dependency-pin conflicts). Each mirrors
 #    that service's Dockerfile (uv sync --frozen + the production-only ASGI/DB extras). ────────────
 #    `--python 3.12` pins the interpreter to match every compose image's `FROM python:3.12-slim`.
-#    The jammy base ships only system python3.10 (< requires-python >=3.11), so an unpinned
+#    The base's system python can lag requires-python >=3.11, so an unpinned
 #    `uv venv` would auto-download the newest managed CPython (3.14) — whose stack fails at boot
 #    (SQLAlchemy's psycopg dialect import). Pinning keeps Lite on the same interpreter as compose/helm.
 # admin-api
@@ -155,6 +157,15 @@ RUN cd /tmp/agent && uv venv --python 3.12 /opt/venvs/agent \
  && UV_PROJECT_ENVIRONMENT=/opt/venvs/agent uv sync --frozen --no-install-project --no-default-groups --group control-plane
 RUN rm -rf /tmp/admin /tmp/runtime /tmp/meeting /tmp/gateway /tmp/agent
 
+# The agent worker is the ONE venv exec'd as a NON-ROOT per-subject uid (the runtime process
+# backend's POSIX tenant isolation — core/runtime/src/runtime_kernel/isolation.py). Its interpreter
+#
```

**File**: `docs/changelog.d/1011-noble-base.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+- **The bot and Lite images now build on Ubuntu 24.04 (Noble) (#1011).** The meeting-bot image and
+  the Vexa Lite single-container image moved from the Jammy to the Noble Playwright base and run the
+  Python interpreter as a non-root user, keeping both current and hardened.
```

**File**: `scripts/gates.test.mjs` (modified, +3/-3)
```diff
@@ -230,7 +230,7 @@ test("image-licenses RED: an undeclared structured Helm repository/tag pin reds"
 });
 
 test("image-licenses RED: an undeclared Dockerfile FROM pin reds", () => {
-  const base = "FROM mcr.microsoft.com/playwright:v1.56.0-jammy AS bot-builder";
+  const base = "FROM mcr.microsoft.com/playwright:v1.56.0-noble AS bot-builder";
   const injected = `FROM somevendor/unaudited:1.2 AS review-probe\n${base}`;
   const r = withEdited(LITE, base, injected, () => runGate("image-licenses"));
   assert.equal(r.green, false, "an undeclared Dockerfile FROM image pin sailed through");
@@ -240,8 +240,8 @@ test("image-licenses RED: an undeclared Dockerfile FROM pin reds", () => {
 
 test("runtime-parity RED: the bare `apt install` form (not just apt-get) is caught too", () => {
   // A contributor who writes `apt install redis-server` (no -get) must not bypass the #636 guard.
-  const inject = "RUN apt install -y redis-server\nFROM mcr.microsoft.com/playwright:v1.56.0-jammy AS final";
-  const r = withEdited(LITE, "FROM mcr.microsoft.com/playwright:v1.56.0-jammy AS final", inject,
+  const inject = "RUN apt install -y redis-server\nFROM mcr.microsoft.com/playwright:v1.56.0-noble AS final";
+  const r = withEdited(LITE, "FROM mcr.microsoft.com/playwright:v1.56.0-noble AS final", inject,
     () => runGate("runtime-parity"));
   assert.equal(r.green, false, "`apt install redis-server` (no -get) bypassed the parity guard");
   assert.match(r.out, /lite/);
```

---

### Incident Patch 6: `ad7311bc` (2026-08-30)
**Commit Message**: fix(mixed): preserve text-only custom STT results (#1149)

Signed-off-by: shopkueche <[REDACTED_EMAIL]>
Signed-off-by: Dmitry Grankin <[REDACTED_EMAIL]>
Co-authored-by: Dmitry Grankin <[REDACTED_EMAIL]>
Co-authored-by: Dmitry Grankin <[REDACTED_EMAIL]>

**File**: `core/meetings/modules/mixed-pipeline/README.md` (modified, +2/-0)
```diff
@@ -82,6 +82,8 @@ loaded and there is no network:
 - `ending-context.smoke.test.ts` — speech-end cuts send a small trailing context pad
   to STT so final words survive, while transcript timestamps stay clipped to the
   committed speech boundary.
+- `text-only-stt.smoke.test.ts` — the minimum custom-STT response (`text` without
+  provider timestamps) spans the submitted speech window and remains publishable.
 - `short-ui-switch.smoke.test.ts` — a short isolated Zoom/Teams UI speaker switch
   right after a different speaker stays provisional rather than stamping a wrong name;
   a longer turn by the new speaker still binds.
```

**File**: `core/meetings/modules/mixed-pipeline/package.json` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 {
   "name": "@vexa/mixed-pipeline",
   "version": "0.1.0",
-  "description": "Platform-specific mixed transcription: Teams routes CSRC-owned virtual channels through the shared GMeet window; Zoom/Jitsi retain the legacy Pyannote cut-only lane. No diarization, clustering, embeddings, or voiceprints.",
+  "description": "The mixed lane: one mixed audio stream \u2192 pyannote segmenter (cut-only, the only ONNX) + shared buffer/whisper + hints namer \u2192 transcript segments. Names from time-windowed hints; no diarization/clustering.",
   "type": "module",
   "main": "dist/index.js",
   "types": "dist/index.d.ts",
@@ -16,7 +16,7 @@
   ],
   "scripts": {
     "build": "tsc && rm -rf dist/hallucinations && cp -R src/hallucinations dist/hallucinations",
-    "test": "node eval-ui/safe-resource-url.test.mjs && node eval-ui/teams-contested-word-detector.test.mjs && node eval-ui/teams-csrc-timeline.test.mjs && node eval-ui/teams-csrc-live-transcript.test.mjs && node eval-ui/server.test.mjs && tsx src/teams-contested-word-marker.test.ts && tsx src/teams-csrc-channelizer.test.ts && tsx src/teams-csrc-gmeet-pipeline.test.ts && tsx src/confirm-loop.golden.test.ts && tsx src/pending-stability.test.ts && tsx src/naming.smoke.test.ts && tsx src/claim.smoke.test.ts && tsx src/priority.smoke.test.ts && tsx src/concurrency.smoke.test.ts && tsx src/flicker.smoke.test.ts && tsx src/hint-evidence.smoke.test.ts && tsx src/hint-outcome.smoke.test.ts && tsx src/ending-context.smoke.test.ts && tsx src/short-ui-switch.smoke.test.ts && tsx src/reattribute.smoke.test.ts && tsx src/claim-contested.smoke.test.ts && tsx src/never-lose-tail.test.ts && tsx src/gap-reclaim.test.ts && tsx src/hallucination-gate.test.ts && tsx src/hallucinations-are-subset.test.ts && tsx src/turn-source.smoke.test.ts && tsx src/track-namer.smoke.test.ts && tsx src/source-name-correlator.test.ts && tsx src/csrc-spine.smoke.test.ts && tsx src/virtual-time-equivalence.test.ts",
+    "test": "node eval-ui/safe-resource-url.test.mjs && node eval-ui/teams-contested-word-detector.test.mjs && node eval-ui/teams-csrc-timeline.test.mjs && node eval-ui/teams-csrc-live-transcript.test.mjs && node eval-ui/server.test.mjs && tsx src/teams-contested-word-marker.test.ts && tsx src/teams-csrc-channelizer.test.ts && tsx src/teams-csrc-gmeet-pipeline.test.ts && tsx src/confirm-loop.golden.test.ts && tsx src/pending-stability.test.ts && tsx src/naming.smoke.test.ts && tsx src/claim.smoke.test.ts && tsx src/priority.smoke.test.ts && tsx src/concurrency.smoke.test.ts && tsx src/flicker.smoke.test.ts && tsx src/hint-evidence.smoke.test.ts && tsx src/hint-outcome.smoke.test.ts && tsx src/ending-context.smoke.test.ts && tsx src/short-ui-switch.smoke.test.ts && tsx src/reattribute.smoke.test.ts && tsx src/claim-contested.smoke.test.ts && tsx src/never-lose-tail.test.ts && tsx src/gap-reclaim.test.ts && tsx src/hallucination-gate.test.ts && tsx src/hallucinations-are-subset.test.ts && tsx src/turn-source.smoke.test.ts && tsx src/track-namer.smoke.test.ts && tsx src/source-name-correlator.test.ts && tsx src/csrc-spine.smoke.test.ts && tsx src/virtual-time-equivalence.test.ts && tsx src/text-only-stt.smoke.test.ts",
     "check:isolation": "node scripts/check-isolation.js"
   },
   "dependencies": {
```

**File**: `core/meetings/modules/mixed-pipeline/src/chunked-transcriber.ts` (modified, +9/-3)
```diff
@@ -1048,9 +1048,15 @@ export class ChunkedTranscriber {
     // Map whisper segments (relative to spanStart) to audio time.
     const lang = this.cb.language || result!.language || 'en';
     const mapped = gated.map((ws) => {
-      const startMs = spanStart + (ws.start || 0) * 1000;
-      const rawEndMs = spanStart + (ws.end || 0) * 1000;
-      const endMs = Math.min(publishEnd, rawEndMs || publishEnd) || publishEnd;
+      const relativeStart = ws.start || 0;
+      const relativeEnd = ws.end || 0;
+      const startMs = spanStart + relativeStart * 1000;
+      // Provider timestamps are optional. A segment without a positive relative
+      // span represents the submitted speech window and ends at its committed edge.
+      const rawEndMs = relativeEnd > relativeStart
+        ? spanStart + relativeEnd * 1000
+        : publishEnd;
+      const endMs = Math.min(publishEnd, rawEndMs) || publishEnd;
       return {
         text: ws.text.trim(),
         startMs,
```

**File**: `core/meetings/modules/mixed-pipeline/src/text-only-stt.smoke.test.ts` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+/**
+ * text-only-stt.smoke — an OpenAI-compatible endpoint may return only text.
+ * The mixed lane assigns that text to the submitted speech window so the
+ * minimum custom-STT response remains publishable without provider timestamps.
+ */
+import { ChunkedTranscriber, type BoundarySource } from './index.js';
+import type { BoundaryEvent } from './pyannote-segmenter.js';
+
+const SAMPLE_RATE = 16_000;
+const BASE_MS = 10_000;
+const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
+let emit: (event: BoundaryEvent) => void = () => {};
+const published: Array<{ text: string; startMs: number; endMs: number }> = [];
+
+const transcriber = await ChunkedTranscriber.create({
+  language: 'en',
+  transcribe: async () => ({
+    text: 'text-only custom STT response',
+    language: 'en',
+    duration: 2,
+    segments: [],
+  }),
+  publish: (_speaker, confirmed) => { published.push(...confirmed); },
+  publishPending: () => {},
+  clearPending: () => {},
+  rename: () => {},
+  makeSegmenter: async (onBoundary): Promise<BoundarySource> => {
+    emit = onBoundary;
+    return { appendFrame: async () => {}, reset: () => {} };
+  },
+});
+
+emit({ tMs: BASE_MS, kind: 'silence→speaker', confidence: 0.9 });
+await sleep(25);
+
+const halfSecond = new Float32Array(SAMPLE_RATE / 2).fill(0.1);
+for (let t = BASE_MS; t < BASE_MS + 2_000; t += 500) transcriber.feedAudio(halfSecond, t);
+emit({ tMs: BASE_MS + 2_000, kind: 'speaker→silence', confidence: 0.9 });
+await sleep(150);
+await transcriber.dispose();
+
+const segment = published.find((item) => item.text === 'text-only custom STT response');
+const hasSpeechSpan = Boolean(segment && segment.endMs > segment.startMs);
+
+console.log(`published=${JSON.stringify(published)}`);
+if (!hasSpeechSpan) {
+  console.error('❌ text-only STT response was not published with a positive speech span');
+  process.exit(1);
+}
+
+console.log('✅ text-only STT response spans the submitted speech window');
```

**File**: `docs/changelog.d/1148-text-only-stt.md` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+- **Text-only custom STT responses now reach the transcript (#1148).** OpenAI-compatible
+  endpoints may return only `text`; the mixed pipeline now assigns that text to the submitted
+  speech window instead of discarding it for missing provider timestamps. See
+  [Custom STT endpoints](/how-to/custom-stt).
```

---

### Incident Patch 7: `ae2f7ba6` (2026-08-30)
**Commit Message**: fix(transcription): support JSON-only STT backends (#1343)

Refs #1342

Signed-off-by: Patrick Wegerer <[REDACTED_EMAIL]>
Co-authored-by: Dmitry Grankin <[REDACTED_EMAIL]>

**File**: `core/meetings/modules/whisper/src/errors.test.ts` (modified, +7/-0)
```diff
@@ -52,6 +52,13 @@ async function run() {
     const f = await faultOf(() => client.transcribe(pcm, 'en'));
     check('401 → kind=unauthorized, non-retryable', f?.kind === 'unauthorized' && f?.retryable === false);
   }
+  // An unrelated 400 remains a non-retryable provider fault; only explicit verbose_json rejection negotiates.
+  {
+    const calls = stubFetch(400, 'unsupported audio encoding');
+    const client = new TranscriptionClient({ serviceUrl: 'http://stt.test', maxRetries: 3, retryDelayMs: 1 });
+    const f = await faultOf(() => client.transcribe(pcm, 'en'));
+    check('unrelated 400 → bad_request without format fallback', f?.kind === 'bad_request' && calls() === 1, `calls=${calls()}`);
+  }
 
   (globalThis as any).fetch = realFetch;
   if (failed) { console.error(`\n❌ stt errors: ${failed} check(s) FAILED.`); process.exit(1); }
```

**File**: `core/meetings/modules/whisper/src/model.test.ts` (modified, +24/-1)
```diff
@@ -29,6 +29,11 @@ function modelPartOf(body: string): string | null {
   const m = body.match(/name="model"\r\n\r\n([^\r]*)\r\n/);
   return m ? m[1] : null;
 }
+/** The value of the `response_format` form part in a captured multipart body. */
+function responseFormatPartOf(body: string): string | null {
+  const m = body.match(/name="response_format"\r\n\r\n([^\r]*)\r\n/);
+  return m ? m[1] : null;
+}
 
 async function run() {
   const pcm = new Float32Array(1600).fill(0.05); // 0.1s of audio
@@ -47,9 +52,27 @@ async function run() {
     await client.transcribe(pcm, 'en');
     check('unconfigured → default whisper-1 (no behavior change)', modelPartOf(body()) === 'whisper-1', `got ${JSON.stringify(modelPartOf(body()))}`);
   }
+  // Backends such as Voxtral reject verbose_json but accept the same OpenAI endpoint with json.
+  {
+    const formats: Array<string | null> = [];
+    (globalThis as any).fetch = async (_url: unknown, init: { body: Buffer }) => {
+      formats.push(responseFormatPartOf(Buffer.from(init.body).toString('latin1')));
+      if (formats.length === 1) {
+        return new Response(JSON.stringify({ message: 'Currently do not support verbose_json for Voxtral' }), { status: 400 });
+      }
+      return new Response(JSON.stringify({ text: 'voxtral ok' }), { status: 200 });
+    };
+    const client = new TranscriptionClient({ serviceUrl: 'http://stt.test', model: 'voxtral', maxRetries: 0 });
+    const first = await client.transcribe(pcm, 'en');
+    await client.transcribe(pcm, 'en');
+    check('verbose_json rejection falls back once, then caches json',
+      JSON.stringify(formats) === JSON.stringify(['verbose_json', 'json', 'json']),
+      `formats=${JSON.stringify(formats)}`);
+    check('json-only response remains a valid transcription result', first.text === 'voxtral ok', `text=${JSON.stringify(first.text)}`);
+  }
 
   (globalThis as any).fetch = realFetch;
   if (failed) { console.error(`\n❌ stt model: ${failed} check(s) FAILED.`); process.exit(1); }
-  console.log('\n✅ stt model (P5, #522): the wire carries the configured model id; unset stays whisper-1.');
+  console.log('\n✅ stt model (P5, #522): configured model ids reach the wire; json-only OpenAI-compatible backends negotiate once.');
 }
 run().catch((e) => { console.error(e); process.exit(1); });
```

**File**: `core/meetings/modules/whisper/src/transcription-client.ts` (modified, +8/-1)
```diff
@@ -102,6 +102,7 @@ export class TranscriptionClient {
   private maxSpeechDurationSec: number | undefined;
   private minSilenceDurationMs: number | undefined;
   private model: string;
+  private responseFormat: 'verbose_json' | 'json' = 'verbose_json';
   constructor(config: TranscriptionClientConfig) {
     // Ensure serviceUrl ends with the transcriptions endpoint
     this.serviceUrl = config.serviceUrl.replace(/\/+$/, '');
@@ -136,6 +137,12 @@ export class TranscriptionClient {
         const fault: TranscriptionError = err instanceof TranscriptionError
           ? err
           : new TranscriptionError(err?.name === 'AbortError' ? 'timeout' : 'unavailable', undefined, err?.message, true);
+        if (fault.kind === 'bad_request' && this.responseFormat === 'verbose_json' && /verbose_json/i.test(fault.detail ?? '')) {
+          log('[TranscriptionClient] backend rejected verbose_json; falling back to json for this and later requests');
+          this.responseFormat = 'json';
+          attempt--; // Capability negotiation does not consume a configured retry.
+          continue;
+        }
         const isLastAttempt = attempt === this.maxRetries;
 
         if (fault.retryable && !isLastAttempt) {
@@ -184,7 +191,7 @@ export class TranscriptionClient {
     parts.push(Buffer.from(
       `--${boundary}\r\n` +
       `Content-Disposition: form-data; name="response_format"\r\n\r\n` +
-      `verbose_json\r\n`
+      `${this.responseFormat}\r\n`
     ));
 
     // Language part (if specified)
```

**File**: `docs/changelog.d/1342-voxtral-json.md` (added, +3/-0)
```diff
@@ -0,0 +1,3 @@
+- **Custom STT: JSON-only Voxtral models now transcribe meetings.** Vexa negotiates down from
+  `verbose_json` to `json` once when a backend rejects verbose output, while Whisper backends keep
+  their richer segment metadata. See [Use a custom STT endpoint](/how-to/custom-stt).
```

**File**: `docs/docs/how-to/custom-stt.mdx` (modified, +11/-0)
```diff
@@ -50,6 +50,17 @@ that path.
 If the backend ignores the `model` form part, leave `TRANSCRIPTION_MODEL` unset. If it validates model
 ids, set the exact served name.
 
+For JSON-only models such as Voxtral, Vexa first requests `verbose_json`, then falls back to `json`
+when the backend explicitly rejects the verbose format. The client remembers that choice for later
+audio windows, while Whisper-compatible backends retain segment and word metadata.
+
+```bash
+TRANSCRIPTION_MODEL=mistralai/Voxtral-Mini-4B-Realtime-2602
+```
+
+Use the exact model id returned by your gateway's `GET /v1/models`; deployments may expose a
+different Voxtral checkpoint or served name.
+
 ## Example: FunASR or SenseVoice
 
 <Note>
```

---

### Incident Patch 8: `6d6d38a2` (2026-08-29)
**Commit Message**: fix(terminal): honor DEFAULT_BOT_NAME without a terminal rebuild (#1259)

The terminal hardcoded bot_name: "Vexa" on every join, so the compose/helm/Lite
DEFAULT_BOT_NAME already wired into meeting-api never took effect. Omit the field
when unset, keep stock deploy defaults as Vexa, and wire NEXT_PUBLIC_DEFAULT_BOT_NAME
as a real terminal build arg for intentional bake-ins.

Signed-off-by: PrBart <[REDACTED_EMAIL]>
Co-authored-by: Dmitry Grankin <[REDACTED_EMAIL]>

**File**: `clients/terminal/Dockerfile` (modified, +6/-0)
```diff
@@ -32,6 +32,12 @@ ENV NEXT_PUBLIC_GA_MEASUREMENT_ID=$NEXT_PUBLIC_GA_MEASUREMENT_ID
 # agent-api paths (404). Empty (default) keeps every surface. NEXT_PUBLIC_* → set BEFORE `next build`.
 ARG NEXT_PUBLIC_TERMINAL_MODE=""
 ENV NEXT_PUBLIC_TERMINAL_MODE=$NEXT_PUBLIC_TERMINAL_MODE
+# Bot display name baked into the client bundle (src/surfaces/defaultBotName.ts). Empty (default) →
+# the terminal omits bot_name on join and meeting-api's DEFAULT_BOT_NAME decides at RUNTIME, which is
+# the knob operators should use. Set this only to pin a name into the image; it then wins over the
+# deployment's DEFAULT_BOT_NAME and a rename costs a rebuild.
+ARG NEXT_PUBLIC_DEFAULT_BOT_NAME=""
+ENV NEXT_PUBLIC_DEFAULT_BOT_NAME=$NEXT_PUBLIC_DEFAULT_BOT_NAME
 # Regular build (not standalone): produces .next served by the custom server in production.
 RUN npm run build
 
```

**File**: `clients/terminal/src/surfaces/__tests__/defaultBotName.test.ts` (modified, +7/-5)
```diff
@@ -10,16 +10,18 @@ describe('defaultBotName', () => {
     delete process.env.NEXT_PUBLIC_DEFAULT_BOT_NAME;
   });
 
-  it('returns "Vexa" when env is unset', () => {
-    expect(defaultBotName()).toBe('Vexa');
+  it('returns undefined when env is unset (JSON.stringify will omit bot_name)', () => {
+    expect(defaultBotName()).toBeUndefined();
+    expect(JSON.stringify({ platform: 'google_meet', bot_name: defaultBotName() })).toBe(
+      '{"platform":"google_meet"}',
+    );
   });
 
-  it('reads env at call time', () => {
-    expect(defaultBotName()).toBe('Vexa');
+  it('reads NEXT_PUBLIC_DEFAULT_BOT_NAME at call time when set', () => {
     process.env.NEXT_PUBLIC_DEFAULT_BOT_NAME = 'MyBot';
     expect(defaultBotName()).toBe('MyBot');
     delete process.env.NEXT_PUBLIC_DEFAULT_BOT_NAME;
-    expect(defaultBotName()).toBe('Vexa');
+    expect(defaultBotName()).toBeUndefined();
   });
 
   it('trims whitespace', () => {
```

**File**: `clients/terminal/src/surfaces/__tests__/meetingActions.test.tsx` (modified, +1/-1)
```diff
@@ -76,7 +76,7 @@ describe("actionsFor — each action fires the correct endpoint+body", () => {
     const { url, init, body } = lastFetch();
     expect(url).toBe("/api/bots");
     expect(init.method).toBe("POST");
-    expect(body).toEqual({ platform: "google_meet", native_meeting_id: NATIVE, meeting_url: `https://meet.google.com/${NATIVE}`, bot_name: "Vexa" });
+    expect(body).toEqual({ platform: "google_meet", native_meeting_id: NATIVE, meeting_url: `https://meet.google.com/${NATIVE}` });
   });
 
   it("active→Stop DELETEs the bot by platform+native (the gateway /api/bots route)", () => {
```

**File**: `clients/terminal/src/surfaces/__tests__/meetingCookbook.test.ts` (modified, +2/-2)
```diff
@@ -31,9 +31,9 @@ describe("agentOnMeeting — cookbook composition over two domain contracts", ()
     const [bot, proc] = calls();
     expect(bot.url).toBe("/api/bots");
     expect(bot.init.method).toBe("POST");
-    expect(bodyOf(bot.init)).toMatchObject({
+    expect(bodyOf(bot.init)).toEqual({
       platform: "google_meet", native_meeting_id: "abc-defg-hij",
-      meeting_url: "https://meet.google.com/abc-defg-hij", bot_name: "Vexa",
+      meeting_url: "https://meet.google.com/abc-defg-hij",
     });
     expect(proc.url).toBe("/api/meeting/process");
     expect(bodyOf(proc.init)).toEqual({ native_id: "abc-defg-hij", platform: "google_meet", on: true });
```

**File**: `clients/terminal/src/surfaces/defaultBotName.ts` (modified, +9/-8)
```diff
@@ -1,12 +1,13 @@
-/** Default bot name shown in the terminal surfaces.
+/** Default bot name for terminal join requests.
  *
- *  NEXT_PUBLIC_DEFAULT_BOT_NAME sets the meeting bot name the terminal sends to the API
- *  when joining meetings. In client-bundled code Next.js inlines NEXT_PUBLIC_* at build time,
- *  so the knob takes effect per deployment build — which matches this feature's intent
- *  (a per-deployment default), and the call-time function keeps tests correct.
+ *  Returns `undefined` when unset so `JSON.stringify({ bot_name: defaultBotName() })` omits the field
+ *  and meeting-api names the bot from `DEFAULT_BOT_NAME` — the knob operators can change with a
+ *  restart. An explicit `bot_name` in a request still wins over both.
  *
- *  Read via a function (not a module constant) so tests that set the env after load observe it.
+ *  `NEXT_PUBLIC_DEFAULT_BOT_NAME` is inlined into the bundle at build time (the Dockerfile takes it as
+ *  a build arg), so setting it pins a name into the image and makes a rename cost a rebuild.
  */
-export function defaultBotName(): string {
-  return process.env.NEXT_PUBLIC_DEFAULT_BOT_NAME?.trim() || "Vexa";
+export function defaultBotName(): string | undefined {
+  const name = process.env.NEXT_PUBLIC_DEFAULT_BOT_NAME?.trim();
+  return name || undefined;
 }
```

**File**: `deploy/compose/.env.example` (modified, +2/-1)
```diff
@@ -52,7 +52,8 @@ MINIO_SECURE=false
 # admin-api auth; `make all` mints your API key with this
 ADMIN_TOKEN=dev-admin-token
 INTERNAL_API_SECRET=vexa-internal-secret
-# Optional server-side fallback when POST /bots omits bot_name.
+# The bot's display name in the meeting — the terminal omits bot_name on join, so this names every
+# bot it sends. Empty → Vexa. Restart meeting-api after changing; the terminal needs no rebuild.
 DEFAULT_BOT_NAME=
 VEXA_DISPATCH_SIGNING_KEY=dev-dispatch-signing-key
 NEXTAUTH_SECRET=dev-nextauth-secret
```

**File**: `deploy/compose/docker-compose.yml` (modified, +7/-1)
```diff
@@ -299,7 +299,9 @@ services:
       - REDIS_URL=redis://redis:6379/0
       - RUNTIME_API_URL=http://runtime:8090
       - INTERNAL_API_SECRET=${INTERNAL_API_SECRET:-vexa-internal-secret}
-      - DEFAULT_BOT_NAME=${DEFAULT_BOT_NAME:-}
+      # The bot's display name in the meeting. The terminal omits bot_name on join, so this is what
+      # participants see; set DEFAULT_BOT_NAME in .env and restart meeting-api (no terminal rebuild).
+      - DEFAULT_BOT_NAME=${DEFAULT_BOT_NAME:-Vexa}
       # The background sweeps' internal lookups: auto-join fetches per-user spawn context
       # (/internal/users/{id}/bot-context) and calendar sync discovers connected ICS feeds
       # (/internal/calendar-configs). Unset -> calendar sync no-ops, auto-join spawns uncapped.
@@ -483,6 +485,10 @@ services:
         # API-tokens surface load, and the server proxy refuses agent-api paths (404). Uncomment
         # (or set TERMINAL_MODE=meetings in .env) and REBUILD the terminal image to enable:
         # NEXT_PUBLIC_TERMINAL_MODE: ${TERMINAL_MODE:-meetings}
+        # Bot display name baked into the bundle. Leave commented: the terminal then omits bot_name and
+        # meeting-api's DEFAULT_BOT_NAME (above) names the bot at runtime, renameable with a restart.
+        # Uncomment + REBUILD only to pin a name into the image, which then wins over DEFAULT_BOT_NAME:
+        # NEXT_PUBLIC_DEFAULT_BOT_NAME: ${TERMINAL_BOT_NAME:-}
         # Runtime node_modules flavor (clients/terminal/Dockerfile): prod (default, pruned) or
         # dev (full tree). Set TERMINAL_RUNTIME_DEPS=dev in .env on hosts that run the terminal
         # under the hot overlay's NODE_ENV=development — dev-mode Next needs the dev toolchain at
```

**File**: `deploy/helm/charts/vexa/values.yaml` (modified, +2/-1)
```diff
@@ -184,7 +184,8 @@ meetingApi:
   service:
     type: ClusterIP
     port: 8080
-  defaultBotName: ""        # server-side fallback when POST /bots omits bot_name
+  defaultBotName: "Vexa"    # the bot's display name; the terminal omits bot_name so this is what
+                            # participants see. Blank it to get the service's VexaBot-{random}.
   transcriptionServiceUrl: ""   # STT endpoint the spawned bot transcribes against (empty ⇒ capture only)
   # Optional service-authority.v1 adapter JSON. Empty preserves stock OSS allow-all. A configured
   # authority must use failure_policy=closed and mode=enforce|observe; the secret lives under
```

---

### Incident Patch 9: `3fbdb3d2` (2026-08-29)
**Commit Message**: Fix/claude code effort flag (#1337)

* agent: pass VEXA_AGENT_EFFORT through to the claude-code CLI as --effort

Backends that validate the OpenAI-compatible reasoning_effort field (vLLM/LiteLLM
model groups) reject the CLI's default high when it is outside their allowlist
(400 Unexpected reasoning effort high). An explicit effort pin overrides that
default; unset keeps the argv byte-identical to before.

Signed-off-by: Patrick Wegerer <[REDACTED_EMAIL]>

* agent+settings: make the claude-code reasoning effort user-configurable

Settings → Models gains a 'Reasoning effort' select (low|medium|high|xhigh).
The effective value crosses the internal model-config edge, is stamped into
the worker env as VEXA_AGENT_EFFORT at dispatch, and the claude-code harness
passes it through as --effort — overriding the CLI's default high, which
backends that validate the OpenAI-compatible reasoning_effort field (vLLM/
LiteLLM model groups) reject with 400 when outside their allowlist. Unset
keeps every argv byte-identical to before.

Signed-off-by: Patrick Wegerer <[REDACTED_EMAIL]>

---------

Signed-off-by: Patrick Wegerer <[REDACTED_EMAIL]>
Co-authored-by: Patrick Wegerer <[REDACTED_EMAIL]>

**File**: `clients/terminal/src/surfaces/settings.tsx` (modified, +7/-0)
```diff
@@ -148,6 +148,13 @@ function ModelsSection() {
     { key: "api_key", label: "API key", placeholder: "unchanged unless typed", secret: true, showIf: (v: Record<string, string>) => v.mode === "custom" },
     { key: "model", label: "Chat model", placeholder: "deployment default (e.g. sonnet)" },
     { key: "meeting_model", label: "Meeting model", placeholder: "defaults to chat model" },
+    { key: "effort", label: "Reasoning effort", placeholder: "CLI default (e.g. medium)", options: [
+      { value: "", label: "CLI default" },
+      { value: "low", label: "low" },
+      { value: "medium", label: "medium" },
+      { value: "high", label: "high" },
+      { value: "xhigh", label: "xhigh" },
+    ] },
   ];
   const transcriptionFields = [
     { key: "url", label: "Service URL", placeholder: "deployment default" },
```

**File**: `clients/terminal/src/surfaces/settingsApi.ts` (modified, +1/-0)
```diff
@@ -8,6 +8,7 @@ export type ModelPrefs = {
   mode?: "subscription" | "custom" | null;
   model?: string | null;
   meeting_model?: string | null;
+  effort?: string | null; // reasoning-effort pin (low|medium|high|xhigh) for the agent harness
   base_url?: string | null;
   api_key_set?: boolean;
   api_key?: string | null; // masked on read (********abcd) — write-only in the clear
```

**File**: `core/agent/control_plane/dispatch.py` (modified, +8/-0)
```diff
@@ -168,6 +168,14 @@ def overlay_model_config(env: dict[str, str], config: dict, *, allowlist: str =
     elif meeting_model:
         logger.warning("meeting model %r not in VEXA_MODEL_ALLOWLIST — using deployment default",
                        meeting_model)
+    # Reasoning-effort pin for the claude-code harness (Settings → Models "effort"). Empty ⇒ unset ⇒
+    # the CLI's own default (no flag on the argv); an explicit value reaches the worker env and the
+    # harness passes it through as --effort. Backends that validate the OpenAI-compatible
+    # reasoning_effort field (vLLM/LiteLLM groups) reject the CLI's default high when it is outside
+    # their allowlist; the pin overrides that default.
+    effort = (config.get("effort") or "").strip()
+    if effort:
+        env["VEXA_AGENT_EFFORT"] = effort
     if (config.get("mode") or "").strip() != "custom":
         return
     base_url = (config.get("base_url") or "").strip()
```

**File**: `core/agent/llm/claude_code.py` (modified, +9/-0)
```diff
@@ -110,6 +110,7 @@ def build_argv(
     session: Optional[str] = None,
     model: Optional[str] = None,
     mcp_config: Optional[str] = None,
+    effort: Optional[str] = None,
 ) -> list[str]:
     """The headless Claude Code argv — `claude -p <prompt> --output-format stream-json [...]`.
 
@@ -118,6 +119,11 @@ def build_argv(
     does the git commit). `--mcp-config <file>` + `--strict-mcp-config` attach EXACTLY the unit's
     granted MCP tools (the toolbelt) and nothing else. The container sandbox is the other
     enforcement layer.
+
+    `effort` — when set — pins the session's reasoning effort (`--effort low|medium|high|xhigh`).
+    Backends that validate the OpenAI-compatible `reasoning_effort` field (e.g. vLLM/LiteLLM model
+    groups) reject the CLI's default `high` when it is outside their allowlist; an explicit value
+    overrides that default. Unset ⇒ no flag ⇒ the CLI's own behaviour, unchanged.
     """
     argv = ["claude", "-p", prompt, "--output-format", "stream-json", "--verbose",
             "--include-partial-messages", "--permission-mode", "acceptEdits"]
@@ -130,6 +136,8 @@ def build_argv(
         argv += ["--resume", session]
     if model:
         argv += ["--model", model]
+    if effort:
+        argv += ["--effort", effort]
     return argv
 
 
@@ -218,6 +226,7 @@ def run_turn(self, work: Path, prompt: str, *, allowed_tools: Iterable[str] = ()
                  session: Optional[str] = None, model: Optional[str] = None,
                  mcp_config: Optional[str] = None) -> Iterator[dict]:
         argv = build_argv(prompt, allowed_tools=allowed_tools, session=session, model=model,
+                          effort=(os.environ.get("VEXA_AGENT_EFFORT") or None),
                           mcp_config=mcp_config)
         yield from parse_stream_json(self._exec(argv, str(work)))
 
```

**File**: `core/agent/tests/test_llm_claude_code.py` (modified, +7/-0)
```diff
@@ -118,8 +118,15 @@ def test_build_argv_core_flags_and_session_model():
     assert "--allowedTools" in argv and "Read" in argv
     assert "--resume" in argv and "s1" in argv
     assert "--model" in argv and "m1" in argv
+    # unset effort ⇒ NO --effort flag (the CLI's own default behaviour is preserved byte-for-byte)
+    assert "--effort" not in argv
 
 
+def test_build_argv_effort_pin():
+    argv = build_argv("hi", effort="medium")
+    assert "--effort" in argv and "medium" in argv
+    assert argv[argv.index("--effort") + 1] == "medium"
+
 # ── the untrusted-subprocess env scrub (data-plane tenancy) ──────────────────
 # The model-driven harness CLI exposes a Bash tool. It must NOT inherit the worker's REDIS_URL (which
 # reaches the SHARED redis — another tenant's tc:meeting:* / unit:*:in) nor the minted per-dispatch
```

**File**: `core/agent/tests/test_unit_foundation.py` (modified, +18/-0)
```diff
@@ -364,6 +364,24 @@ def test_dispatcher_model_config_overrides_deployment_models():
     assert env["VEXA_MEETING_MODEL"] == "my-meeting"
 
 
+def test_dispatcher_model_config_stamps_reasoning_effort():
+    """Settings → Models effort pin reaches the worker env as VEXA_AGENT_EFFORT (the claude-code
+    harness passes it through as --effort). Absent ⇒ no env key ⇒ the CLI's own default."""
+    rt = _FakeRuntime()
+    mc = _FakeModelConfig({"model": "my-model", "effort": "medium"})
+    d = dispatch.Dispatcher(load_settings(), rt, _FakeIdentity(), model_config=mc)
+    d.dispatch(VALID_INV)
+    _, _profile, env = rt.spawned[0]
+    assert env["VEXA_AGENT_EFFORT"] == "medium"
+    # no effort configured ⇒ no env key at all (unset must mean "don't touch the CLI default")
+    rt2 = _FakeRuntime()
+    d2 = dispatch.Dispatcher(load_settings(), rt2, _FakeIdentity(),
+                           model_config=_FakeModelConfig({"model": "my-model"}))
+    d2.dispatch(VALID_INV)
+    _, _profile2, env2 = rt2.spawned[0]
+    assert "VEXA_AGENT_EFFORT" not in env2
+
+
 def test_dispatcher_model_config_custom_mode_stamps_both_call_shapes():
     """mode:custom points the harness (ANTHROPIC_*) AND the completion adapters (VEXA_LLM_*) at
     the supplied gateway. Dispatch-stamped keys WIN downstream (docker_backend copies its own env
```

**File**: `core/identity/services/admin-api/src/admin_api/app/main.py` (modified, +3/-1)
```diff
@@ -232,7 +232,7 @@ class CalendarPatch(BaseModel):
 # resolves FIELD-BY-FIELD user > platform; the process env stays the bottom fallback downstream
 # (dispatch/bot_spawn only override what is set here).
 MODEL_MODES = ("subscription", "custom")
-_MODELS_FIELDS = ("mode", "model", "meeting_model", "base_url", "api_key")
+_MODELS_FIELDS = ("mode", "model", "meeting_model", "base_url", "api_key", "effort")
 _TRANSCRIPTION_FIELDS = ("url", "token")
 # "setup" tracks the admin first-run wizard: per-step state ("done" / "skipped") + overall
 # completion — the terminal re-surfaces the wizard until it reads completed. Plain strings,
@@ -256,6 +256,7 @@ class ModelPrefsUpdate(BaseModel):
     meeting_model: Optional[str] = None
     base_url: Optional[str] = None
     api_key: Optional[str] = None
+    effort: Optional[str] = None  # claude-code reasoning-effort pin (low|medium|high|xhigh); empty = unset
 
 
 class TranscriptionPrefsUpdate(BaseModel):
@@ -699,6 +700,7 @@ async def get_user_models(user: User = Depends(get_current_user)):
             "model": prefs.get("model"),
             "meeting_model": prefs.get("meeting_model"),
             "base_url": prefs.get("base_url"),
+            "effort": prefs.get("effort"),
             "api_key_set": bool(prefs.get("api_key")),
             "api_key": _mask_secret(prefs.get("api_key")),
         }
```

---

### Incident Patch 10: `15bf8b3e` (2026-08-29)
**Commit Message**: fix(mixed): the virtual-time speed check measured the runner, not the tier (#1300)

`virtualMs < realMs` compared two numbers that scale differently. The 1x run's
wall clock is FLOORED by the tape (~8.5 s, ~2% variance across CI runs); the
virtual run is pure compute — and strictly MORE compute than the 1x run, because
every event and every heartbeat awaits a drain that `--realtime` never performs.
On a fast machine that costs ~1 s and the comparison looks comfortable; on a
2-core CI runner it stretches past the floor and the comparison inverts. It has
been red-lighting PRs whose entire diff is one Markdown file: 10035 vs 8672 ms on
#1288, and 14687 vs 8496 ms on an unrelated release recut.

Assert the mechanism rather than a side effect of it. VirtualClock gains
advancedMs(); tape-replay reports it beside the heartbeat count it already
printed; the test asserts (a) a heartbeat fired for every second of lane clock —
which the old check never tested at all, since a tier that fired NO heartbeats
would have been fast and passed — and (b) the run came in under the lane time it
replaced, the boundary a clock that genuinely slept cannot cross. realMs is still
measured and printed for rea

**File**: `core/meetings/modules/mixed-pipeline/src/tape-replay.ts` (modified, +1/-1)
```diff
@@ -397,7 +397,7 @@ async function main(): Promise<void> {
     // Let the tail play out: the lane's TTL finalize and its roll are heartbeat-driven, and a tape
     // that simply stops would leave the last turn's pending tail unexamined.
     await clock.advanceTo(evs.length ? evs[evs.length - 1].t + 30_000 : clock.now());
-    console.log(`virtual time: ${clock.heartbeatsFired()} heartbeat(s) fired across the tape`);
+    console.log(`virtual time: ${clock.heartbeatsFired()} heartbeat(s) fired, ${clock.advancedMs()}ms of lane clock advanced, across the tape`);
   }
   await tc.dispose();
 
```

**File**: `core/meetings/modules/mixed-pipeline/src/virtual-clock.ts` (modified, +10/-0)
```diff
@@ -37,6 +37,16 @@ export class VirtualClock {
   now(): number { return this.t; }
   heartbeatsFired(): number { return this.fired; }
 
+  /**
+   * How far the lane's clock has been moved since the tape's first timestamp — that is, the real
+   * waiting this tier replaced. Paired with `heartbeatsFired()` it states the tier's whole claim as
+   * two numbers the run can report about ITSELF: this much lane time passed, this many heartbeats
+   * fired inside it. `virtual-time-equivalence.test.ts` asserts against these rather than against
+   * how long a 1x run happened to take on the same machine, so the check measures the mechanism and
+   * not the runner.
+   */
+  advancedMs(): number { return this.t - this.opts.startMs; }
+
   setHeartbeat(fn: () => void, everyMs: number): () => void {
     const beat: Heartbeat = { fn, everyMs, nextAt: this.t + everyMs, cancelled: false };
     this.beats.push(beat);
```

**File**: `core/meetings/modules/mixed-pipeline/src/virtual-time-equivalence.test.ts` (modified, +44/-8)
```diff
@@ -14,6 +14,23 @@
  * introduced the tier. Even so this pays a few seconds of real time ONCE, which is the point: every
  * other replay in the loop no longer pays any.
  *
+ * WHY THE SPEED CHECK DOES NOT COMPARE THE TWO RUNS. It used to assert `virtualMs < realMs`, and
+ * that assertion measured the runner rather than the tier. The 1x run's wall clock is FLOORED by
+ * the tape — ~8.5 s, and it barely moves under load — while the virtual run is pure compute, and it
+ * is strictly MORE compute than the 1x run does, because every event and every heartbeat awaits a
+ * drain that `--realtime` never performs. On a fast machine that costs ~1.5 s and the comparison
+ * looks comfortable; on a 2-core CI runner it stretches past 8.5 s and the comparison inverts. It
+ * inverted on PRs whose entire diff was one Markdown file (10035 vs 8672 ms, and 14687 vs 8496 ms),
+ * which is the signature of a check that is not testing its own subject.
+ *
+ * So the speed claim is now stated against the thing it is actually about: the virtual run reports
+ * how much LANE CLOCK it advanced, and must come in under that. A clock that genuinely slept could
+ * not — it would need at least 1x, and the two CI runs above sit at 0.27x and 0.39x of the budget.
+ * The companion check asserts the mechanism ran at all (a heartbeat for every second of lane time),
+ * which the old wall-clock comparison never tested: a tier that fired NO heartbeats would have been
+ * fast, and would have passed. `realMs` is still measured and printed, because it is useful when
+ * reading a failure — it is simply never asserted on.
+ *
  * Run: npx tsx src/virtual-time-equivalence.test.ts
  */
 import { execFileSync } from 'node:child_process';
@@ -32,6 +49,7 @@ const here = dirname(fileURLToPath(import.meta.url));
 const dir = mkdtempSync(join(tmpdir(), 'vexa-vt-'));
 const T0 = 1786470000000;
 const SR = 16000;
+const TAPE_MS = 8000;
 
 // Two speakers on the transport, alternating, long enough that the heartbeat fires several times
 // within a turn — which is the only way a growing-window submission (and therefore a draft, and
@@ -45,7 +63,7 @@ const tape: string[] = [JSON.stringify({
   type: 'captured_signal_header', v: 1, platform: 'teams', native_meeting_id: 'vt',
   language: null, lane: 'mixed', sample_rate: SR, started_at: new Date(T0).toISOString(), trace_id: 'vt',
 })];
-for (let ms = 0; ms < 8000; ms += 100) {
+for (let ms = 0; ms < TAPE_MS; ms += 100) {
   const tr = activeAt(ms);
   if (tr === null) continue;
   const n = SR / 10;
@@ -60,12 +78,16 @@ writeFileSync(join(dir, 'vt.csrc.jsonl'), runs.flatMap(([tr, a, b]) => [
   JSON.stringify({ type: 'csrc', t: T0 + b, csrc: tr, active: false, lane: 'mixed' }),
 ]).join('\n') + '\n');
 
-const run = (mode: string, tag: string): { rows: string; writes: string } => {
-  execFileSync('npx', ['tsx', join(here, 'tape-replay.ts'),
+const run = (mode: string, tag: string): { rows: string; writes: string; stdout: string } => {
+  const stdout = execFileSync('npx', ['tsx', join(here, 'tape-replay.ts'),
     '--tape', join(dir, 'vt.captured-signal.jsonl'), '--turn-source', 'csrc', mode,
     '--out-json', join(dir, `${tag}.json`), '--out-writes', join(dir, `${tag}.writes.jsonl`)],
-    { stdio: 'pipe', cwd: join(here, '..') });
-  return { rows: readFileSync(join(dir, `${tag}.json`), 'utf8'), writes: readFileSync(join(dir, `${tag}.writes.jsonl`), 'utf8') };
+    { stdio: 'pipe', cwd: join(here, '..'), encoding: 'utf8' });
+  return {
+    rows: readFileSync(join(dir, `${tag}.json`), 'utf8'),
+    writes: readFileSync(join(dir, `${tag}.writes.jsonl`), 'utf8'),
+    stdout,
+  };
 };
 
 const t0 = Date.now();
@@ -75,15 +97,29 @@ const t1 = Date.now();
 const real = run('--realtime', 'rt');
 const realMs = Date.now() - t1;
 
+// The virtual run reports its own mechanism — how far it moved the lane's clock, and how many
+// heartbeats fired inside that span. Both assertions below read THOSE numbers; see the header for
+// why neither one is allowed to look at how long the 1x run next to it happened to take.
+const report = /virtual time: (\d+) heartbeat\(s\) fired, (\d+)ms of lane clock advanced/.exec(virtual.stdout);
+const heartbeats = report ? Number(report[1]) : -1;
+const advancedMs = report ? Number(report[2]) : -1;
+
 check('the virtual run reproduces the real run\'s durable rows exactly',
   virtual.rows === real.rows, `virtual ${virtual.rows.length}B vs real ${real.rows.length}B`);
 check('…and its whole publish stream, drafts and retractions included',
   virtual.writes === real.writes,
   `virtual ${virtual.writes.split('\n').length} calls vs real ${real.writes.split('\n').length}`);
 check('the run actually exercised the draft/confirm cycle (otherwise it proves nothing)',
   real.writes.includes('"completed":false'), 'no draft was ever published — the tape is too short');
-check(`and it did so without paying the wall clock (${virtualMs}ms vs ${realMs}ms)`,
-  virtualMs < realMs, `${virtual
```

---

### Incident Patch 11: `c461ca22` (2026-08-29)
**Commit Message**: fix(transcription): stop a CPU worker admitting a GPU-sized concurrency default (#1156)

* fix(transcription): stop a CPU worker admitting a GPU-sized concurrency default

MAX_ACTIVE_REQUESTS defaulted to 20, a figure benchmarked on an RTX 4090. On a CPU device each of those 20 admitted jobs only gets 1/20th of the cores, so none finish in bounded time, the semaphore never releases, and with FAIL_FAST_WHEN_BUSY every later request 503s. The worker keeps answering /health with 200 the whole time and never self-recovers. Observed on a 12-core CPU deployment: 503 on every POST for hours, a 51-minute meeting force-completed as stt_degraded with zero transcript rows, cleared only by a container restart.

- default MAX_ACTIVE_REQUESTS is now device-aware: 20 only for an explicit cuda device, 2 otherwise. Inverted deliberately so faster-whisper's "auto" (which can resolve to CPU at runtime) does not inherit the GPU default. An operator-set env var still wins.
- DEVICE is normalized once at read time, so every comparison in the file tolerates casing and stray whitespace.
- bound the whole request with TRANSCRIPTION_TIMEOUT_S (120s) so a call that never returns cannot hold its semaphore per

**File**: `core/meetings/services/transcription/src/transcription/main.py` (modified, +184/-77)
```diff
@@ -33,7 +33,10 @@
 
 # Device detection: Use environment variable or default to cuda for GPU containers
 # CTranslate2 (used by faster-whisper) will automatically detect and use CUDA if available
-DEVICE = os.getenv("DEVICE", "cuda")
+# Normalized once here so every later `DEVICE == "..."` comparison in this file (health check,
+# CPU thread setup, the concurrency default below) sees a clean value regardless of stray
+# whitespace or casing (e.g. "CUDA", " cpu ") in the operator-set env var.
+DEVICE = os.getenv("DEVICE", "cuda").strip().lower()
 
 # Compute type optimization: Use INT8 for optimal VRAM efficiency
 # Research shows: large-v3-turbo + INT8 = ~2.1 GB VRAM (validated)
@@ -164,11 +167,26 @@ async def verify_api_token(
 
 # Load management: Global concurrency limit and bounded queue
 # These settings control how many transcription requests can be processed concurrently.
-# CTranslate2 serializes CUDA ops, so concurrent requests queue on the GPU.
-# RTX 4090 benchmarks (2026-03-08): 20 concurrent handles fine, latency ~3s worst case.
-# Set high enough to avoid artificial bottlenecks, low enough to bound queue latency.
+# CTranslate2 serializes ops per device, so concurrent requests queue on it.
+# RTX 4090 benchmarks (2026-03-08): 20 concurrent handles fine, latency ~3s worst case - that
+# number is GPU-specific. On CPU each admitted job only gets 1/Nth of the cores, so the same
+# 20 means every job runs proportionally slower, none finish in bounded time, the semaphore
+# never releases, and every request after that 503s forever (2026-08-13 CPU deadlock incident).
+# Default is therefore device-aware; an operator-set env var always wins over the default.
 # MAX_ACTIVE_REQUESTS is the preferred name; MAX_CONCURRENT_TRANSCRIPTIONS is kept for compatibility.
-MAX_CONCURRENT_TRANSCRIPTIONS = _env_int("MAX_ACTIVE_REQUESTS", _env_int("MAX_CONCURRENT_TRANSCRIPTIONS", 20))
+def _default_max_concurrent(device: str) -> int:
+    """Only an explicit "cuda" gets the RTX-4090-benchmarked 20; everything else (cpu, auto, mps,
+    or any other faster-whisper device string) gets the small CPU-safe cap. Inverted on purpose:
+    faster-whisper's "auto" resolves to whatever CTranslate2 finds at runtime - which can be CPU -
+    so it must not silently inherit the GPU default just because it isn't the literal "cpu". 2
+    lets a couple of requests overlap without each one starving for cores on a typical (8-16
+    core) CPU box - tune via MAX_ACTIVE_REQUESTS if your hardware differs."""
+    return 20 if device == "cuda" else 2
+
+
+MAX_CONCURRENT_TRANSCRIPTIONS = _env_int(
+    "MAX_ACTIVE_REQUESTS", _env_int("MAX_CONCURRENT_TRANSCRIPTIONS", _default_max_concurrent(DEVICE))
+)
 MAX_QUEUE_SIZE = _env_int("MAX_QUEUE_SIZE", 10)  # Max requests waiting in queue
 
 # Backpressure strategy:
@@ -178,11 +196,61 @@ async def verify_api_token(
 BUSY_RETRY_AFTER_S = _env_int("BUSY_RETRY_AFTER_S", 1)
 REALTIME_RESERVED_SLOTS = _env_int("REALTIME_RESERVED_SLOTS", 1)
 
+# Bound on the ENTIRE per-request transcription work - all temperature-fallback attempts
+# together (see the for-loop below), not each attempt individually. The semaphore permit for a
+# request is only released in the handler's `finally`, which only runs once this awaited work
+# returns - so work that never returns (pathological input, a hang inside
+# CTranslate2/faster-whisper, thread contention under load) would hold its permit forever
+# regardless of how small MAX_CONCURRENT_TRANSCRIPTIONS is. This is a backstop independent of the
+# concurrency default above.
+#
+# What this DOES guarantee: the semaphore permit is always reclaimed within TRANSCRIPTION_TIMEOUT_S.
+# What it does NOT guarantee: asyncio.wait_for only cancels the await - concurrent.futures.Future
+# .cancel() is a no-op once a thread has started, so the underlying thread keeps running the real
+# call to completion (or forever) and keeps occupying its transcription_executor slot. A reclaimed
+# permit is only useful because that executor is sized with headroom over MAX_CONCURRENT_TRANSCRIPTIONS
+# (see below) - without that headroom the next admitted request just queues behind the zombie
+# thread and reclaiming the permit buys nothing. A genuinely hung native call still burns one
+# thread and its CPU core for good; actually killing it would need subprocess isolation, which is
+# deliberately out of scope here - this is a mitigation, not a hard kill switch.
+#
+# This is a HANG BACKSTOP, not a latency governor. Its only job is to guarantee the semaphore
+# permit above is eventually reclaimed when model.transcribe() itself never returns; it is not
+# meant to bound how long a legitimate transcription is allowed to run, and should fire rarely or
+# never in normal operation. Do NOT align it under the bot's own 30s per-attempt
+# AbortController (core/meetings/modules/whisper/src/transcription-client.ts:241-242): a bound
+# below real worst-case work turns every full-size chunk into a guar
```

**File**: `core/meetings/services/transcription/tests/test_load_management.py` (added, +254/-0)
```diff
@@ -0,0 +1,254 @@
+"""MAX_CONCURRENT_TRANSCRIPTIONS device-aware default + TRANSCRIPTION_TIMEOUT_S.
+
+Regression coverage for the 2026-08-13 CPU deadlock incident: a GPU-sized default (20) was
+admitted on a CPU-only worker, none of the 20 concurrent jobs finished in bounded time, the
+semaphore that gates admission was never released, and the worker answered 200 on /health while
+503-ing every /v1/audio/transcriptions request for hours until it was restarted by hand.
+
+Three independent fixes, three independent test groups:
+- the concurrency default is device-aware (20 only for an explicit "cuda", the conservative
+  cap for everything else - including "auto", which can resolve to CPU at runtime), normalized
+  (stripped/lowercased) before comparison, and an operator-set MAX_ACTIVE_REQUESTS/
+  MAX_CONCURRENT_TRANSCRIPTIONS still wins over the default either way.
+- a bounded per-request timeout on the blocking model.transcribe() call guarantees the semaphore
+  permit is always reclaimed, even if that call itself never returns - the concurrency default
+  alone does not guarantee this (see the comment on TRANSCRIPTION_TIMEOUT_S).
+- the executor is sized with headroom over the semaphore, because reclaiming the permit alone
+  does not free up a thread to run the next request in (the reclaimed permit is otherwise
+  useless - see the comment on transcription_executor).
+"""
+from __future__ import annotations
+
+import importlib
+import io
+import os
+import threading
+import time
+from contextlib import contextmanager
+
+import numpy as np
+import soundfile as sf
+
+import transcription.main as svc
+
+_ENV_KEYS = ("DEVICE", "MAX_ACTIVE_REQUESTS", "MAX_CONCURRENT_TRANSCRIPTIONS", "TRANSCRIPTION_TIMEOUT_S")
+
+
+@contextmanager
+def _reloaded_with_env(**env: str):
+    """Reload transcription.main with only the given env vars of interest set, then reload again
+    on the way out so later tests see the module in its original (ambient-env) state."""
+    saved = {k: os.environ.get(k) for k in _ENV_KEYS}
+    try:
+        for k in _ENV_KEYS:
+            os.environ.pop(k, None)
+        os.environ.update(env)
+        importlib.reload(svc)
+        yield svc
+    finally:
+        for k, v in saved.items():
+            if v is None:
+                os.environ.pop(k, None)
+            else:
+                os.environ[k] = v
+        importlib.reload(svc)
+
+
+# --- default selection: pure function, no env/import gymnastics needed -----------------------
+
+def test_default_max_concurrent_is_small_on_cpu():
+    assert svc._default_max_concurrent("cpu") == 2
+
+
+def test_default_max_concurrent_is_twenty_on_cuda():
+    assert svc._default_max_concurrent("cuda") == 20
+
+
+def test_default_max_concurrent_treats_unknown_device_as_cpu_like():
+    # Inverted on purpose: only the exact literal "cuda" gets the GPU-benchmarked default.
+    # "auto" (faster-whisper's runtime-resolved device, which can land on CPU) and anything else
+    # unrecognized must NOT silently inherit the GPU default just for not being "cpu".
+    assert svc._default_max_concurrent("mps") == 2
+    assert svc._default_max_concurrent("auto") == 2
+
+
+def test_default_max_concurrent_requires_exact_lowercase_cuda():
+    # The function itself does no normalization - normalization happens once at DEVICE's
+    # assignment (see test_device_env_is_normalized below). A caller that passes an unnormalized
+    # string does not get the GPU default.
+    assert svc._default_max_concurrent("CUDA") == 2
+    assert svc._default_max_concurrent(" cuda ") == 2
+
+
+# --- the same default, wired end to end through the module's env parsing ----------------------
+
+def test_module_default_is_two_on_cpu():
+    with _reloaded_with_env(DEVICE="cpu") as m:
+        assert m.MAX_CONCURRENT_TRANSCRIPTIONS == 2
+
+
+def test_module_default_is_twenty_on_cuda():
+    with _reloaded_with_env(DEVICE="cuda") as m:
+        assert m.MAX_CONCURRENT_TRANSCRIPTIONS == 20
+
+
+def test_explicit_env_overrides_default_on_cpu():
+    with _reloaded_with_env(DEVICE="cpu", MAX_ACTIVE_REQUESTS="7") as m:
+        assert m.MAX_CONCURRENT_TRANSCRIPTIONS == 7
+
+
+def test_explicit_env_overrides_default_on_cuda():
+    with _reloaded_with_env(DEVICE="cuda", MAX_ACTIVE_REQUESTS="3") as m:
+        assert m.MAX_CONCURRENT_TRANSCRIPTIONS == 3
+
+
+def test_legacy_env_name_still_honored():
+    # MAX_CONCURRENT_TRANSCRIPTIONS is the back-compat name; MAX_ACTIVE_REQUESTS takes priority
+    # when both are set (unchanged precedence, just re-asserted here since the default it falls
+    # back to is no longer a bare literal).
+    with _reloaded_with_env(DEVICE="cpu", MAX_CONCURRENT_TRANSCRIPTIONS="9") as m:
+        assert m.MAX_CONCURRENT_TRANSCRIPTIONS == 9
+    with _reloaded_with_env(DEVICE="cpu", MAX_ACTIVE_REQUESTS="5", MAX_CONCURRENT_TRANSCRIPTIONS="9") as m:
+        assert m.MAX_CONCURRENT_TRANSCRIPTIONS == 5
+
+
+def test_module_default_is_two_on_auto():
+    # "auto
```

**File**: `deploy/transcription/nginx.conf` (modified, +5/-2)
```diff
@@ -56,8 +56,11 @@ http {
             proxy_set_header X-Forwarded-Proto $scheme;
             proxy_set_header X-Worker-ID $upstream_addr;
             
-            # Automatic failover to next worker on errors (fast timeout for quick failover)
-            proxy_next_upstream error timeout http_500 http_502 http_503;
+            # Automatic failover to next worker on errors (fast timeout for quick failover).
+            # http_504 included: the transcription app itself returns 504 as a hang backstop
+            # when a request wedges past TRANSCRIPTION_TIMEOUT_S (see main.py) - a wedged worker
+            # is the worst case to keep sending traffic to, so it must fail over like the rest.
+            proxy_next_upstream error timeout http_500 http_502 http_503 http_504;
             proxy_next_upstream_tries 3;
             proxy_next_upstream_timeout 3s;
         }
```

**File**: `docs/docs/deployment.mdx` (modified, +5/-0)
```diff
@@ -94,6 +94,11 @@ docker compose -f docker-compose.cpu.yml up -d
 curl http://localhost:8083/health   # waits on the model load
 ```
 
+**CPU concurrency:** the worker's admission cap (`MAX_ACTIVE_REQUESTS`) defaults to `20` only when
+`DEVICE=cuda` (sized on an RTX 4090); on any other device (`cpu`, `auto`, `mps`) it defaults to `2`,
+because 20 CPU jobs sharing the cores never finish and the worker deadlocks while still reporting
+healthy. Set `MAX_ACTIVE_REQUESTS` explicitly if your hardware differs; an explicit value always wins.
+
 Then point the main stack at it in `deploy/compose/.env`:
 
 ```bash
```

---

### Incident Patch 12: `3e0d5ef2` (2026-08-29)
**Commit Message**: fix(gates): parse the rights declaration section, not the whole body (#1099)

Follows #1095, which fixed the line-shape half of this. One case remains.

selectedRights matches the FIRST line anywhere in the body containing the marker.
A PR that merely MENTIONS a marker -- quoting the template, or documenting this
gate -- puts prose ahead of its own declaration, so the gate reads the prose and
reports zero selections. Explaining the bug requires quoting the thing being
explained, so the PR that fixed the line shape could not declare anything.

Scoped to the last '## Contribution rights' heading onward, which is exactly what
the gate's own error message tells contributors to edit. #1095's blank-line guard
and walk-back are preserved unchanged.

Signed-off-by: DmitriyG228 <[REDACTED_EMAIL]>

**File**: `scripts/contribution-rights-gate.mjs` (modified, +7/-1)
```diff
@@ -11,7 +11,13 @@ const DECISION_MARKER = "<!-- vexa-contribution-rights-decision:v1 -->";
 // back to the checkbox of the item it belongs to. Matching only the marker's own line silently
 // reports zero selections for every correctly filled template.
 function selectedRights(body = "") {
-  const lines = body.split("\n");
+  // Parse ONLY the declaration section. A body may legitimately MENTION these markers -- quoting the
+  // template, or documenting this gate itself -- and matching the first occurrence anywhere leaves
+  // such a body unable to declare anything, because the prose sits above the real checkbox. The
+  // gate's own error message already points at "the Contribution rights section"; read exactly that.
+  const all = body.split("\n");
+  const heading = all.reduce((last, line, i) => (/^#{1,6}\s+contribution\s+rights\b/i.test(line) ? i : last), -1);
+  const lines = heading >= 0 ? all.slice(heading) : all;
   return RIGHTS.filter((right) => {
     const marker = `<!-- rights:${right} -->`;
     const markerIndex = lines.findIndex((candidate) => candidate.includes(marker));
```

**File**: `scripts/contribution-rights-gate.test.mjs` (modified, +19/-0)
```diff
@@ -70,6 +70,25 @@ test("does not attribute an orphaned marker to an earlier list item", () => {
   assert.equal(evaluatePullRequest(pr({ body: orphan }), [], config).ok, false);
 });
 
+test("a body that MENTIONS the markers can still declare", () => {
+  // Found by the PR that fixed the line-shape bug failing its own gate: explaining the bug
+  // required quoting the template, which put a marker occurrence above the declaration. Any
+  // PR documenting this gate could not declare anything. Parse the declaration section only.
+  const prose = [
+    "## What broke",
+    "The parser matched `<!-- rights:independent -->` wherever it appeared, including here:",
+    "",
+    "  <!-- rights:independent -->",
+    "",
+    "## Contribution rights",
+    "- [x] I own this contribution. <!-- rights:independent -->",
+    "- [ ] An employer or client owns or controls it. <!-- rights:corporate -->",
+    "- [ ] I am unsure. <!-- rights:uncertain -->",
+  ].join("\n");
+  assert.equal(evaluatePullRequest(pr({ body: prose }), [], config).ok, true,
+    "prose above the declaration swallowed the declaration");
+});
+
 test("independent path passes without a CLA", () => {
   const verdict = evaluatePullRequest(pr(), [], config);
   assert.equal(verdict.ok, true);
```

---

### Incident Patch 13: `31005b15` (2026-08-29)
**Commit Message**: fix(gates): report the failure instead of swallowing it (#1107) (#1114)

* fix(gates): report the failure instead of swallowing it (#1107)

Every gate in gates.mjs reported its own failures through

    (e.stdout || e.stderr || e).toString()

Under stdio: 'pipe' a child that writes only to stderr leaves e.stdout as a
ZERO-LENGTH Buffer. An empty Buffer is an object, so it is truthy, so the || chain
short-circuits on it and returns the empty string. The operator sees the gate's
name, a colon, and nothing:

    ▶ gates: schema
      ✗ schema core/agent/contracts/event.v1:

    ❌ gates failed
    ✗ pre-push: gate:schema FAILED — push aborted (fix it, or bypass with: --no-verify)

A gate that cannot say why it failed is worse than one that does not run: the only
remaining move is the --no-verify the hook itself suggests, which is exactly the
habit these hooks exist to prevent. Found when gate:schema aborted a docs-only push
and the message was blank; the underlying cause turned out to be a missing ajv in a
fresh worktree, invisible behind the empty string.

Replaces all 22 sites with one errText() helper that chooses on LENGTH rather than
truthiness, preferring stdout, falling back to 

**File**: `docs/changelog.d/1107-gate-error-text.md` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+fix(gates): every gate failure now prints its diagnostic — an empty stdout Buffer is truthy, so `(e.stdout || e.stderr || e)` was discarding the real error at all 21 call sites (#1107). A gate that fails because the worktree has no dependencies installed now says so.
```

**File**: `scripts/gate-error-text.test.mjs` (added, +129/-0)
```diff
@@ -0,0 +1,129 @@
+// Regression test for the error-text swallow in gates.mjs (#1107).
+//
+// The bug was not in a gate's logic but in how every gate REPORTED its own failure:
+// `(e.stdout || e.stderr || e).toString()`. Under `stdio: "pipe"`, a child that writes
+// only to stderr leaves `e.stdout` a zero-length Buffer — an object, therefore TRUTHY —
+// so the `||` chain short-circuits on it and returns "". The operator saw the gate's name,
+// a colon, and nothing at all, with `--no-verify` the only move left.
+//
+// This test drives a REAL execSync failure rather than a hand-built object, because the
+// defect lives in what Node actually attaches to the thrown error. A test that asserted
+// against `{stdout: Buffer.alloc(0), stderr: Buffer.from("boom")}` would pass against a
+// wrong implementation that happened to check `!= null` instead of `.length`.
+//
+// Run: node --test scripts/gate-error-text.test.mjs
+import test from "node:test";
+import assert from "node:assert/strict";
+import { execSync } from "node:child_process";
+import { readFileSync } from "node:fs";
+import { dirname, join } from "node:path";
+import { fileURLToPath } from "node:url";
+
+const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
+
+// The implementation under test, lifted from gates.mjs by source so the test cannot drift
+// from it silently: if the helper is edited, this reads the edited version.
+function loadErrText() {
+  const src = readFileSync(join(ROOT, "scripts", "gates.mjs"), "utf8");
+  const m = src.match(/const errText = \(e\) => \{[\s\S]*?\n\};/);
+  assert(m, "gates.mjs no longer defines errText — the swallow guard has been removed");
+  return new Function(`${m[0]}; return errText;`)();
+}
+
+function realFailure(script) {
+  try {
+    execSync(`node -e ${JSON.stringify(script)}`, { stdio: "pipe" });
+    assert.fail("expected the child to exit non-zero");
+  } catch (e) {
+    return e;
+  }
+}
+
+test("stderr-only failure: the message survives (this is the bug)", () => {
+  const errText = loadErrText();
+  const e = realFailure('process.stderr.write("BOOM-stderr"); process.exit(1)');
+
+  // The precondition that made the old code wrong — assert it, so the test still means
+  // something if Node ever changes what it attaches.
+  assert.equal(e.stdout.length, 0, "precondition: stdout is empty");
+  assert(Boolean(e.stdout), "precondition: an empty Buffer is truthy — this is why || failed");
+  assert.equal((e.stdout || e.stderr || e).toString(), "", "the old expression returns nothing");
+
+  assert.match(errText(e), /BOOM-stderr/);
+});
+
+test("stdout-only failure: stdout is preferred", () => {
+  const errText = loadErrText();
+  const e = realFailure('process.stdout.write("BOOM-stdout"); process.exit(1)');
+  assert.match(errText(e), /BOOM-stdout/);
+});
+
+test("both streams: stdout wins, and nothing throws", () => {
+  const errText = loadErrText();
+  const e = realFailure('process.stdout.write("OUT"); process.stderr.write("ERR"); process.exit(1)');
+  assert.match(errText(e), /OUT/);
+});
+
+test("neither stream (spawn failure): falls back to the error itself, never empty", () => {
+  const errText = loadErrText();
+  let e;
+  try {
+    execSync("definitely-not-a-real-binary-1107", { stdio: "pipe" });
+  } catch (err) {
+    e = err;
+  }
+  assert(errText(e).length > 0, "a failure must never report an empty message");
+});
+
+test("no swallow sites remain in gates.mjs", () => {
+  const src = readFileSync(join(ROOT, "scripts", "gates.mjs"), "utf8");
+  assert.equal(
+    (src.match(/e\.stdout \|\| e\.stderr/g) || []).length, 0,
+    "a gate is back to `e.stdout || e.stderr` and will report empty failures again",
+  );
+});
+
+// ── The fresh-worktree hint (#1107, second defect) ───────────────────────────────────────────
+// Restoring the message was half the fix. The message a fresh worktree produces is a Node
+// module-resolution stack trace, which still does not tell the operator that the fix is one
+// install command. The hint is asserted here — including that it names THIS repo's package
+// manager, because a hint pointing at the wrong one sends the operator down a wrong path that
+// also corrupts the lockfile.
+
+function loadFail() {
+  const src = readFileSync(join(ROOT, "scripts", "gates.mjs"), "utf8");
+  const m = src.match(/const DEPS_MISSING = [^\n]*\nconst fail = \(msgs\) => \{[\s\S]*?\n\};/);
+  assert(m, "gates.mjs no longer defines fail() alongside DEPS_MISSING — the hint has no home");
+  return new Function(`${m[0]}; return fail;`)();
+}
+
+function captureStderr(fn) {
+  const lines = [];
+  const original = console.error;
+  console.error = (...args) => lines.push(args.join(" "));
+  try { fn(); } finally { console.error = original; }
+  return lines.join("\n");
+}
+
+test("a missing dependency earns the install hint", () => {
+  const fail = loadFail();
+  const e = realFailure('process.stderr.write("Error [ERR_MODULE_NOT_FOUND]: Cannot find package
```

**File**: `scripts/gates.mjs` (modified, +51/-22)
```diff
@@ -16,7 +16,36 @@ const ROOT = process.cwd();
 const SKIP = new Set(["node_modules", "dist", ".turbo", "__pycache__", "test-results", "playwright-report", "coverage"]);
 const skippable = (name) => name.startsWith(".") || SKIP.has(name);
 const rel = (p) => p.slice(ROOT.length + 1) || ".";
-const fail = (msgs) => { for (const m of msgs) console.error("  ✗ " + m); return false; };
+// Every gate's errors print through here, so the missing-dependency hint lives here too: it is
+// appended AFTER each caller's .slice(), so the one line that tells the operator what to actually
+// do can never be the part that gets truncated, and no individual gate has to remember to say it.
+// A fresh worktree has no node_modules, and a gate failing for that reason reads like a code
+// defect until something names the real fix (Vexa-ai/vexa#1107).
+const DEPS_MISSING = /ERR_MODULE_NOT_FOUND|Cannot find (?:module|package)/;
+const fail = (msgs) => {
+  for (const m of msgs) console.error("  ✗ " + m);
+  if (msgs.some((m) => DEPS_MISSING.test(String(m))))
+    console.error("  → hint: did you run `pnpm install` in this worktree? A fresh worktree has no node_modules.");
+  return false;
+};
+
+// Text of a failed execSync, for the operator who has to act on it.
+//
+// The obvious `errText(e)` is wrong, and wrong in the worst
+// possible direction: with `stdio: "pipe"` a child that writes only to stderr leaves
+// `e.stdout` as a ZERO-LENGTH Buffer, and an empty Buffer is an object, so it is TRUTHY.
+// The `||` chain short-circuits on it and the real diagnostic is discarded — the gate prints
+// its own name, a colon, and nothing. Measured on 2026-08-10: every gate:schema failure had
+// been silent since the gate was written, and the only move left to the operator is
+// `--no-verify`, which is precisely the habit these hooks exist to prevent
+// (Vexa-ai/vexa#1107).
+//
+// Prefer stdout, fall back to stderr, then to the error itself — choosing on LENGTH, never
+// on truthiness.
+const errText = (e) => {
+  const out = e?.stdout?.length ? e.stdout : (e?.stderr?.length ? e.stderr : e);
+  return (out ?? "").toString();
+};
 
 function walkDirs(dir = ROOT, acc = []) {
   for (const name of readdirSync(dir)) {
@@ -121,7 +150,7 @@ function gateIsolation() {
     .filter(([, s]) => existsSync(s));
   for (const [d, s] of found) {
     try { execSync(`node ${JSON.stringify(s)}`, { stdio: "pipe" }); }
-    catch (e) { return fail([`isolation failed in ${rel(d)}: ${(e.stdout || e.stderr || e).toString().slice(0, 300)}`]); }
+    catch (e) { return fail([`isolation failed in ${rel(d)}: ${errText(e).slice(0, 300)}`]); }
   }
   console.log(`  ✓ gate:isolation — ${found.length} brick(s) checked`);
   return true;
@@ -133,7 +162,7 @@ function gateGraph() {
   const targets = ["core", "integrations", "clients", "sdks", "schemas", "tools"]
     .filter((d) => existsSync(join(ROOT, d)));
   try { execSync(`npx depcruise --config .dependency-cruiser.cjs --no-progress ${targets.join(" ")}`, { stdio: "pipe" }); }
-  catch (e) { return fail([`dependency-cruiser:\n${(e.stdout || e.stderr || e).toString()}`]); }
+  catch (e) { return fail([`dependency-cruiser:\n${errText(e)}`]); }
   console.log("  ✓ gate:graph — acyclic + allowed-edges");
   return true;
 }
@@ -146,7 +175,7 @@ function gateGraph() {
 function gateIsolationPy() {
   const s = join(ROOT, "scripts", "check-isolation-py.mjs");
   try { execSync(`node ${JSON.stringify(s)} --mode=isolation`, { stdio: "pipe" }); }
-  catch (e) { return fail([`python isolation:\n${(e.stdout || e.stderr || e).toString().slice(0, 1200)}`]); }
+  catch (e) { return fail([`python isolation:\n${errText(e).slice(0, 1200)}`]); }
   console.log("  ✓ gate:isolation-py — every Python sibling import is own-module, declared, or an allowed edge");
   return true;
 }
@@ -159,7 +188,7 @@ function gateIsolationPy() {
 function gateGraphPy() {
   const s = join(ROOT, "scripts", "check-isolation-py.mjs");
   try { execSync(`node ${JSON.stringify(s)} --mode=graph`, { stdio: "pipe" }); }
-  catch (e) { return fail([`python graph:\n${(e.stdout || e.stderr || e).toString().slice(0, 1200)}`]); }
+  catch (e) { return fail([`python graph:\n${errText(e).slice(0, 1200)}`]); }
   console.log("  ✓ gate:graph-py — Python cross-package edges acyclic + allow-listed");
   return true;
 }
@@ -172,7 +201,7 @@ function gateGraphPy() {
 function gateTestIsolation() {
   const s = join(ROOT, "scripts", "check-isolation-py.mjs");
   try { execSync(`node ${JSON.stringify(s)} --mode=test-isolation`, { stdio: "pipe" }); }
-  catch (e) { return fail([`python test-isolation:\n${(e.stdout || e.stderr || e).toString().slice(0, 1200)}`]); }
+  catch (e) { return fail([`python test-isolation:\n${errText(e).slice(0, 1200)}`]); }
   console.log("  ✓ gate:test-isolation — no Python test imports a sibling module's internals (test lane gated, P2)");
   return true;
 }
@@ -185,7 +214,7 @@ function gateArchReport() {
   const s = join(ROOT, "scripts", 
```

---

### Incident Patch 14: `b87d7832` (2026-08-29)
**Commit Message**: fix(teams,api): carry the separate passcode into the real join URL, refuse password aliases (#1201)

`POST /bots` with a Teams meeting id and its documented separate `passcode` returned 201
and sent the bot to a URL that could not join: `construct_meeting_url` had one Teams
template, `/l/meetup-join/{id}`, which is the THREAD-id deep link. A caller holding a
separate passcode is holding the SHORT numeric id, whose join path is `/meet/<id>?p=<passcode>`.
So the id went into the wrong path and the passcode had no seam to arrive through at all.

The #910 guard that refuses a passcode glued onto the id shipped and works; it points
callers at the separate-passcode path, and that path had never been proven past its 201.
The delivered positive control asserted only `status_code == 201`, so it could not see the
URL. That is why this issue could be closed twice and still be broken in production.

Teams URL construction is now chosen by id SHAPE at the point of introduction: a 10-15
digit id joins at `/meet/<id>`, everything else keeps `/l/meetup-join/`. The passcode is
applied to the INVOCATION url only (`apply_join_passcode`), so the bot receives a joinable
address while `data.constructed_

**File**: `core/meetings/modules/join/package.json` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
   "files": ["dist"],
   "scripts": {
     "build": "tsc",
-    "test": "tsx src/shared/selector-validity.test.ts && tsx src/googlemeet/admission.test.ts && tsx src/googlemeet/join-cta.test.ts && tsx src/googlemeet/session.test.ts && tsx src/googlemeet/leave.test.ts && tsx src/googlemeet/humanized/humanized.test.ts && tsx src/msteams/modals.test.ts && tsx src/msteams/admission.test.ts && tsx src/msteams/leave.test.ts && tsx src/msteams/removal.test.ts && tsx src/msteams/auth-redirect.test.ts && tsx src/zoom/join.test.ts && tsx src/zoom/admission.test.ts && tsx src/jitsi/join.test.ts && tsx src/jitsi/password.test.ts && tsx src/jitsi/admission.test.ts && tsx src/__tests__/defaultBotName.test.ts && tsx src/__tests__/unknownPlatform.test.ts && tsx src/__tests__/localePin.test.ts",
+    "test": "tsx src/shared/selector-validity.test.ts && tsx src/googlemeet/admission.test.ts && tsx src/googlemeet/join-cta.test.ts && tsx src/googlemeet/session.test.ts && tsx src/googlemeet/leave.test.ts && tsx src/googlemeet/humanized/humanized.test.ts && tsx src/msteams/modals.test.ts && tsx src/msteams/admission.test.ts && tsx src/msteams/leave.test.ts && tsx src/msteams/removal.test.ts && tsx src/msteams/auth-redirect.test.ts && tsx src/msteams/join-passcode.test.ts && tsx src/zoom/join.test.ts && tsx src/zoom/admission.test.ts && tsx src/jitsi/join.test.ts && tsx src/jitsi/password.test.ts && tsx src/jitsi/admission.test.ts && tsx src/__tests__/defaultBotName.test.ts && tsx src/__tests__/unknownPlatform.test.ts && tsx src/__tests__/localePin.test.ts",
     "check:isolation": "node scripts/check-isolation.js"
   },
   "dependencies": {
```

**File**: `core/meetings/modules/join/src/msteams/join-passcode.test.ts` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+/**
+ * The Teams join URL carries the meeting passcode; the Teams join LOGS must not (#892 A4).
+ *
+ * A Teams meeting addressed by its short id joins at `…/meet/<id>?p=<passcode>` — the credential
+ * is IN the URL, because that is where Teams puts it. `page.goto` therefore has to receive the
+ * whole thing. Everything else that touches that string is read by humans and shipped off-box:
+ * container logs, `last_error`, triage dashboards. So the two live in tension and the split has
+ * to be proven, not asserted in a comment — the pre-#892 code logged `meetingUrl` verbatim, which
+ * was harmless only for as long as no constructed URL had a query.
+ *
+ * This drives the SHIPPED `joinMicrosoftTeams` against a page that reports the Microsoft sign-in
+ * host, so the flow terminates at step 1b — after the navigation and its log line, before the
+ * pre-join hunt. The assertions are a matched pair on purpose: the passcode must be in what the
+ * browser was told to open AND absent from what was written down. A one-sided version of this
+ * test would pass if the passcode simply went missing everywhere, which is the bug it guards.
+ *
+ * Run: npx tsx src/msteams/join-passcode.test.ts
+ */
+
+import { joinMicrosoftTeams } from './join';
+
+let passed = 0, failed = 0;
+function check(name: string, ok: boolean, detail = '') {
+  if (ok) { console.log(`  \x1b[32mPASS\x1b[0m  ${name}`); passed++; }
+  else { console.log(`  \x1b[31mFAIL\x1b[0m  ${name}${detail ? ` — ${detail}` : ''}`); failed++; }
+}
+
+const PASSCODE = 'X8hcQVTnGNpGelJLSv';
+const MEETING_URL = `https://teams.microsoft.com/meet/397421056486982?p=${PASSCODE}`;
+// A sign-in landing ends the flow at step 1b, right after the navigation we are inspecting.
+const LOGIN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?redirect_uri=x';
+
+/** A Page that records where it was sent and then claims to be on the sign-in host. */
+function fakePage() {
+  const navigated: string[] = [];
+  const page: any = {
+    goto: async (url: string) => { navigated.push(url); },
+    waitForTimeout: async () => {},
+    url: () => LOGIN_URL,
+    locator: () => ({ first: () => ({ waitFor: async () => { throw new Error('absent'); }, click: async () => {} }) }),
+  };
+  return { page, navigated };
+}
+
+(async () => {
+  console.log('\n=== #892 A4: the passcode reaches the browser, never the log ===');
+
+  const { page, navigated } = fakePage();
+  const logs: string[] = [];
+  const realLog = console.log;
+  console.log = (...args: unknown[]) => { logs.push(args.map(String).join(' ')); };
+  let threw = false;
+  try {
+    await joinMicrosoftTeams(page, MEETING_URL, 'Vexa', { platform: 'teams', passcode: PASSCODE });
+  } catch { threw = true; } finally { console.log = realLog; }
+
+  check('the flow terminated on the sign-in host (step 1b reached)', threw);
+  check(
+    'the browser was sent to the passcode-bearing URL',
+    navigated.length === 1 && navigated[0] === MEETING_URL,
+    JSON.stringify(navigated),
+  );
+
+  const leaked = logs.filter((l) => l.includes(PASSCODE));
+  check('no log line carries the passcode', leaked.length === 0, JSON.stringify(leaked));
+
+  // The redaction must not have swallowed the line — triage still needs to see WHERE the bot went.
+  const navLine = logs.find((l) => l.includes('Navigating to Teams meeting'));
+  check(
+    'the navigation is still logged, as origin + path',
+    !!navLine && navLine.includes('https://teams.microsoft.com/meet/397421056486982'),
+    String(navLine),
+  );
+
+  console.log(`\n${passed} passed, ${failed} failed`);
+  if (failed > 0) process.exit(1);
+})();
```

**File**: `core/meetings/modules/join/src/msteams/join.ts` (modified, +7/-3)
```diff
@@ -19,6 +19,7 @@ import {
   classifyNonMeetingUrl,
   isMicrosoftLoginUrl,
   meetingOriginHost,
+  redactUrl,
 } from "./auth-redirect";
 
 // NOTE vs the monolith: the WebRTC remote-audio hook and the voice-agent
@@ -153,7 +154,7 @@ async function waitForTeamsPreJoinReadiness(
   const finalUrl = page.url();
   const offMeeting = classifyNonMeetingUrl(finalUrl, requestedHost);
   if (offMeeting) throw offMeeting;
-  log(`⚠️ Timed out waiting for Teams pre-join readiness after ${timeoutMs}ms (url=${finalUrl})`);
+  log(`⚠️ Timed out waiting for Teams pre-join readiness after ${timeoutMs}ms (url=${redactUrl(finalUrl)})`);
   return false;
 }
 
@@ -163,8 +164,11 @@ export async function joinMicrosoftTeams(
   botName: string,
   botConfig: BotConfig
 ): Promise<void> {
-  // Step 1: Navigate to Teams meeting
-  log(`Step 1: Navigating to Teams meeting: ${meetingUrl}`);
+  // Step 1: Navigate to Teams meeting.
+  // Logged REDACTED (origin + path): a Teams short link carries the meeting passcode in its
+  // `?p=` query, and bot logs are read by humans and shipped off-box. Same rule the redirect
+  // errors already follow — the query is dropped whole rather than filtered key by key.
+  log(`Step 1: Navigating to Teams meeting: ${redactUrl(meetingUrl)}`);
   await page.goto(meetingUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
   await page.waitForTimeout(500);
 
```

**File**: `core/meetings/services/mcp/src/vexa_mcp/link_parser.py` (modified, +12/-2)
```diff
@@ -22,7 +22,7 @@ class ParseMeetingLinkResponse(BaseModel):
     native_meeting_id: str
     passcode: Optional[str] = None
     meeting_url: Optional[str] = None       # raw URL for long Teams /l/meetup-join/ links
-    teams_base_host: Optional[str] = None   # non-default Teams host (e.g. teams.microsoft.com)
+    teams_base_host: Optional[str] = None   # Teams web client this short link is served by
     warnings: List[str] = Field(default_factory=list)
 
 
@@ -83,7 +83,17 @@ def parse_meeting_url(meeting_url: str) -> ParseMeetingLinkResponse:
         passcode = (query.get("p") or [None])[0]
         if not passcode:
             warnings.append("Teams meeting link has no ?p= passcode. Many Teams meetings require it.")
-        return ParseMeetingLinkResponse(platform="teams", native_meeting_id=native_id, passcode=passcode, warnings=warnings)
+        # The host rides along like every other short-link parse: a personal meeting id addresses
+        # a meeting on teams.live.com, and the id alone does not say so. Whoever rebuilds the join
+        # URL from (id, passcode) — bot_spawn's construct_meeting_url — would otherwise default to
+        # the world-wide enterprise host and send the bot to a different Teams entirely.
+        return ParseMeetingLinkResponse(
+            platform="teams",
+            native_meeting_id=native_id,
+            passcode=passcode,
+            teams_base_host=host,
+            warnings=warnings,
+        )
 
     # Teams enterprise: teams.microsoft.com, gov.teams.microsoft.us, dod.teams.microsoft.us, etc.
     if _is_teams_enterprise_host(host):
```

**File**: `core/meetings/services/mcp/tests/test_parse_meeting_link.py` (modified, +5/-1)
```diff
@@ -65,7 +65,11 @@ def test_standard_with_passcode(self):
         assert r.platform == "teams"
         assert r.native_meeting_id == "9361792952021"
         assert r.passcode == "abc12345"
-        assert r.teams_base_host is None
+        # The host rides along, like every other short-link parse. A personal meeting id lives on
+        # teams.live.com and the id alone does not say so, so whoever rebuilds the join URL from
+        # (id, passcode) — bot_spawn's construct_meeting_url — would default to the world-wide
+        # enterprise host and send the bot to a different Teams (#892).
+        assert r.teams_base_host == "teams.live.com"
         assert r.meeting_url is None
 
     def test_no_passcode_warns(self):
```

**File**: `core/meetings/services/meeting-api/src/meeting_api/bot_spawn/router.py` (modified, +66/-1)
```diff
@@ -38,7 +38,12 @@
     TranscriptionNotConfigured,
 )
 from .invocation import SPAWNABLE_PLATFORMS
-from .service import DuplicateMeeting, construct_meeting_url, request_bot
+from .service import (
+    DuplicateMeeting,
+    construct_meeting_url,
+    request_bot,
+    resolve_teams_base_host,
+)
 
 #: Max length of a native meeting id, mirroring the `meetings.platform_specific_id`
 #: varchar(255) column. Bounded at the request boundary so an over-long id is a typed
@@ -54,6 +59,28 @@
 #: short ids, and Jitsi rooms all exclude `? # & = /` and whitespace (see collector.meeting_link).
 NATIVE_MEETING_ID_URL_CHARS = "?#&=/"
 
+#: Top-level body keys that MEAN "passcode" but are not the api.v1 field. A caller who reaches for
+#: one of these is asking for a credential to be used; accepting the request and ignoring the key
+#: hands them a bot that joins nothing and a 201 that says it worked — the failure mode a hosted
+#: integrator reported after spending hours on it (#892 A2). Named and refused, with the real
+#: field in the message.
+#:
+#: Deliberately a NAMED FAMILY rather than a blanket unknown-key guard. The api.v1 ``POST /bots``
+#: request body is OPEN by contract (no ``additionalProperties: false``; ``continue_meeting`` and
+#: ``teams_base_host`` both ride on it), so refusing every undeclared key would be a contract
+#: break that 422s working integrations — including the ones this refusal exists to protect. The
+#: silent-drop class this closes is the one where the DROPPED FIELD IS A CREDENTIAL.
+PASSCODE_ALIASES = (
+    "password",
+    "meeting_password",
+    "meetingPassword",
+    "meeting_passcode",
+    "meetingPasscode",
+    "passCode",
+    "pass_code",
+    "pwd",
+)
+
 
 
 def _resolve_recording_enabled(value: Optional[object]) -> bool:
@@ -255,6 +282,24 @@ async def create_bot(
         if not isinstance(body, dict):
             raise HTTPException(status_code=422, detail="body must be an object")
 
+        # A passcode sent under a name we do not read is a credential DROPPED — refuse before any
+        # DB, runtime or network work, and name the field that works. Only a NON-EMPTY alias is
+        # refused: a caller whose client emits `"password": null` for an unset field asked for
+        # nothing, and 422-ing them would break working integrations over an absent value.
+        supplied_aliases = [
+            k for k in PASSCODE_ALIASES
+            if isinstance(body.get(k), str) and body.get(k).strip()
+        ]
+        if supplied_aliases:
+            raise HTTPException(
+                status_code=422,
+                detail=(
+                    f"{', '.join(repr(a) for a in supplied_aliases)} is not a recognized field and "
+                    "the meeting passcode it carries would be ignored — send the passcode as "
+                    "'passcode', or supply the full 'meeting_url' with the passcode in its query"
+                ),
+            )
+
         platform = str(body.get("platform", "")).strip()
         native_meeting_id = str(body.get("native_meeting_id", "")).strip()
         meeting_url = body.get("meeting_url")
@@ -263,6 +308,25 @@ async def create_bot(
         if meeting_url is not None:
             meeting_url = _validate_meeting_url(meeting_url)
         passcode = body.get("passcode")
+        # api.v1's `teams_base_host` — WHICH Teams web client a constructed URL is built on. The
+        # MCP link parser fills it from the link it parsed (gov./dod. clouds, teams.live.com for
+        # personal meetings); without it every constructed URL lands on the world-wide host, so a
+        # GCC-High caller's bot browses to a meeting that is not theirs. The bot navigates this
+        # host, so an unrecognized one is a typed 422 here, never a passthrough (same SSRF rule
+        # `_validate_meeting_url` applies to the URL path).
+        teams_base_host = body.get("teams_base_host")
+        if teams_base_host is not None:
+            if not isinstance(teams_base_host, str):
+                raise HTTPException(status_code=422, detail="teams_base_host must be a string")
+            if resolve_teams_base_host(teams_base_host) is None:
+                raise HTTPException(
+                    status_code=422,
+                    detail=(
+                        f"teams_base_host '{teams_base_host}' is not a Teams web client host — "
+                        "use teams.microsoft.com, teams.live.com, gov.teams.microsoft.us or "
+                        "dod.teams.microsoft.us"
+                    ),
+                )
         # api.v1 promise: a meeting_url provided WITHOUT native_meeting_id is parsed to extract
         # platform, native_meeting_id, and passcode (collector.meeting_link — the same parser the
         # planned-meeting routes use). An underivable URL is a typed 422, NEVER a persisted ''
@@ -383,6 +447,7 @@ async def create_bot(
                 bot_name=body.get("bot_name"),
                 passcode=passcode,
         
```

**File**: `core/meetings/services/meeting-api/src/meeting_api/bot_spawn/service.py` (modified, +131/-7)
```diff
@@ -24,8 +24,10 @@
 from __future__ import annotations
 
 import os
+import re
 import uuid
 from typing import Any, Optional
+from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse
 
 from ..config_preflight import CONFIG_FAULT_KINDS, cached_probe_verdict
 from ..obs import log_event
@@ -54,8 +56,15 @@
 # Re-exported here (defined in ports.py to avoid an adapters→service circular import) so callers that
 # already do ``from .service import DuplicateMeeting`` (the router) keep working.
 __all__ = [
-    "request_bot", "construct_meeting_url", "DuplicateMeeting", "MeetingStopped",
-    "LOBBY_BUDGET_MS", "DEFAULT_LOBBY_BUDGET_S", "lobby_budget_ms",
+    "request_bot",
+    "construct_meeting_url",
+    "apply_join_passcode",
+    "resolve_teams_base_host",
+    "DuplicateMeeting",
+    "MeetingStopped",
+    "LOBBY_BUDGET_MS",
+    "DEFAULT_LOBBY_BUDGET_S",
+    "lobby_budget_ms",
 ]
 
 # The waiting-room budget the control plane ISSUES to every bot it spawns (``automatic_leave
@@ -106,11 +115,76 @@ def lobby_budget_ms() -> int:
 # one), so constructing a URL from the bare id would silently join the public room of that name —
 # the wrong meeting, on someone else's deployment. jitsi callers pass an explicit ``meeting_url``
 # (same passthrough zoom uses); the UI, MCP, and calendar paths all carry it.
+#
+# Teams is NOT one template: see ``_teams_url`` — its two id shapes join over two different paths.
 _URL_TEMPLATES = {
     "google_meet": "https://meet.google.com/{native_meeting_id}",
-    "teams": "https://teams.microsoft.com/l/meetup-join/{native_meeting_id}",
 }
 
+# The two Teams meeting-id shapes, and why one template cannot serve both.
+#
+#   * THREAD id — ``19:meeting_…@thread.v2``, the id inside a classic ``/l/meetup-join/`` deep
+#     link. It joins at ``/l/meetup-join/<thread>`` and carries no separate passcode: the deep
+#     link's own query string is the credential, so a caller holding this id holds the whole URL.
+#   * SHORT id — the 10–15 digit meeting id Teams prints next to "Meeting ID / Passcode" and
+#     hands out as ``…/meet/<id>?p=<passcode>``. It joins at ``/meet/<id>``, and the passcode is
+#     a SEPARATE value by construction — this is the ONLY shape for which a bare id plus its own
+#     ``passcode`` field is a complete address.
+#
+# Only the SHORT shape is matched: it is the one that needs a different path from the one every
+# Teams id used to get, and its 10–15 digit range mirrors the SSOT parsers that produce these ids
+# (``collector.meeting_link``, the MCP ``link_parser``). Everything else — thread ids included —
+# stays on ``/l/meetup-join/``. Interpolating a SHORT id into that path builds
+# ``/l/meetup-join/397421056486982``: the wrong path for that id, and with nowhere for the
+# passcode to go (#892).
+_TEAMS_SHORT_ID = re.compile(r"^\d{10,15}$")
+
+#: Teams web-client host SUFFIXES a constructed URL may be built on — the same set the join
+#: layer recognizes as "this page IS Teams" (``join/src/msteams/auth-redirect.ts``
+#: ``TEAMS_HOST_SUFFIXES``): world-wide, personal, the GCC-High/DoD clouds, and the
+#: cloud.microsoft rename. A host is accepted when it equals a suffix or is a subdomain of one.
+#:
+#: The caller names the host through the api.v1 ``teams_base_host`` field (the MCP link parser
+#: fills it from the link it parsed) and the bot's browser then navigates it — so this is an
+#: ALLOWLIST, not a passthrough. An arbitrary host here is the same SSRF surface
+#: ``_validate_meeting_url`` guards on the URL path, and it would also aim an anonymous join at a
+#: look-alike page. ``teams.microsoft.com`` is the default when the caller names nothing.
+_TEAMS_HOST_SUFFIXES = (
+    "teams.microsoft.com",
+    "teams.live.com",
+    "teams.microsoft.us",
+    "teams.cloud.microsoft",
+)
+_TEAMS_DEFAULT_HOST = "teams.microsoft.com"
+
+
+def resolve_teams_base_host(teams_base_host: Optional[str]) -> Optional[str]:
+    """The Teams host to build a constructed URL on, or ``None`` when the caller named a host
+    that is not a Teams web client (the caller's error — the router turns it into a 422).
+
+    Absent/blank resolves to the world-wide default, so every existing caller keeps today's host.
+    """
+    host = (teams_base_host or "").strip().lower().rstrip("/")
+    if not host:
+        return _TEAMS_DEFAULT_HOST
+    if any(host == suffix or host.endswith(f".{suffix}") for suffix in _TEAMS_HOST_SUFFIXES):
+        return host
+    return None
+
+
+def _teams_url(native_meeting_id: str, teams_base_host: Optional[str]) -> str:
+    """The join URL for a Teams id, chosen by the id's SHAPE (see ``_TEAMS_SHORT_ID`` above).
+
+    An id matching neither shape keeps the classic ``/l/meetup-join/`` path: that is what every
+    such id resolved to before this rule existed, and shape does not predict joinability here
+    (a bare-numeric id outside the 10–15 range has transcribed real meetings), so an unrecognized
+    id is left on its establis
```

**File**: `core/meetings/services/meeting-api/tests/test_bot_spawn.py` (modified, +204/-2)
```diff
@@ -967,8 +967,13 @@ def test_native_meeting_id_with_url_chars_is_422_not_join_failure(monkeypatch):
         )
         assert repo._meetings == {}, f"refused spawn wrote a meeting row: {repo._meetings}"
 
-    # POSITIVE CONTROL — the bare id + a separate passcode still spawns (the meeting-13564 pattern:
-    # pass the passcode in its own field, not glued onto the id).
+    # POSITIVE CONTROL — the id the refusal RECOMMENDS is accepted: a bare id plus a separate
+    # passcode is not itself refused by this guard.
+    #
+    # This control proves acceptance and NOTHING MORE, which is exactly how far it should be read:
+    # it asserts an HTTP status, so it cannot see the URL the bot is handed. The refusal above
+    # sends callers down this path, so the path's real end — a passcode-bearing Teams URL in the
+    # invocation — is proven where it actually lives, one test below.
     repo = InMemoryMeetingRepo()
     ok = _client(repo).post("/bots", headers=HEADERS, json={
         "platform": "teams", "native_meeting_id": "397421056486982",
@@ -977,6 +982,203 @@ def test_native_meeting_id_with_url_chars_is_422_not_join_failure(monkeypatch):
     assert ok.status_code == 201, f"bare id + separate passcode was refused: {ok.text}"
 
 
+# ── #892: the separate Teams passcode, from the request body to the URL the bot navigates ────────
+#
+# The seam these tests hold is route → invocation: what `POST /bots` puts in BOT_CONFIG.meetingUrl,
+# which is the string `joinMicrosoftTeams` calls `page.goto` with. A 201 says the request was
+# accepted; only this says the bot was given an address it can join.
+
+TEAMS_SHORT_ID = "397421056486982"
+TEAMS_PASSCODE = "X8hcQVTnGNpGelJLSv"
+TEAMS_THREAD_ID = "19:meeting_AbC-dEf_123@thread.v2"
+
+
+def _spawned_invocation(runtime) -> dict:
+    """The invocation the spawn actually handed the runtime (BOT_CONFIG)."""
+    return json.loads(runtime.specs[0]["env"]["BOT_CONFIG"])
+
+
+def test_teams_short_id_plus_passcode_builds_the_passcode_bearing_join_url(monkeypatch):
+    """#892 A1 — a bare Teams meeting id + its separate `passcode` reaches the bot as the URL
+    Teams itself would hand out: `…/meet/<id>?p=<passcode>`.
+
+    PRE-FIX this asserted-nothing path produced `https://teams.microsoft.com/l/meetup-join/
+    397421056486982` — wrong on both counts. `/l/meetup-join/` is the THREAD-id deep link, not the
+    short id's path, and `construct_meeting_url` took no passcode at all, so there was no seam for
+    the credential to arrive through. The old positive control saw none of that because it stopped
+    at the 201."""
+    monkeypatch.setenv("ADMIN_TOKEN", SECRET)
+    runtime = FakeRuntimeClient()
+    r = _client(InMemoryMeetingRepo(), runtime).post("/bots", headers=HEADERS, json={
+        "platform": "teams", "native_meeting_id": TEAMS_SHORT_ID, "passcode": TEAMS_PASSCODE,
+    })
+    assert r.status_code == 201, r.text
+    inv = _spawned_invocation(runtime)
+    assert inv["meetingUrl"] == f"https://teams.microsoft.com/meet/{TEAMS_SHORT_ID}?p={TEAMS_PASSCODE}", (
+        f"the bot was handed {inv['meetingUrl']!r}"
+    )
+    # The passcode still rides the invocation's own field too — zoom/jitsi read it from there, and
+    # dropping it would trade one silent loss for another.
+    assert inv["passcode"] == TEAMS_PASSCODE
+
+
+def test_teams_thread_id_keeps_the_meetup_join_deep_link(monkeypatch):
+    """#892 A- — the OTHER Teams id shape is untouched. A `19:…@thread.v2` id joins at
+    `/l/meetup-join/`, carries no separate passcode, and must not be rerouted by the short-id
+    rule."""
+    monkeypatch.setenv("ADMIN_TOKEN", SECRET)
+    runtime = FakeRuntimeClient()
+    r = _client(InMemoryMeetingRepo(), runtime).post("/bots", headers=HEADERS, json={
+        "platform": "teams", "native_meeting_id": TEAMS_THREAD_ID,
+    })
+    assert r.status_code == 201, r.text
+    assert _spawned_invocation(runtime)["meetingUrl"] == (
+        f"https://teams.microsoft.com/l/meetup-join/{TEAMS_THREAD_ID}"
+    )
+
+
+def test_teams_passcode_never_reaches_meeting_readback(monkeypatch):
+    """#892 A4 — the passcode is on the URL the BOT gets and on nothing that is stored or read
+    back. `constructed_meeting_url` is persisted in `meeting.data` and returned on every
+    MeetingResponse (and re-sent verbatim by the dashboard's send-bot), so a credential there
+    would leak on a path nobody is looking at."""
+    monkeypatch.setenv("ADMIN_TOKEN", SECRET)
+    repo, runtime = InMemoryMeetingRepo(), FakeRuntimeClient()
+    r = _client(repo, runtime).post("/bots", headers=HEADERS, json={
+        "platform": "teams", "native_meeting_id": TEAMS_SHORT_ID, "passcode": TEAMS_PASSCODE,
+    })
+    assert r.status_code == 201, r.text
+    assert r.json()["constructed_meeting_url"] == f"https://teams.microsoft.com/meet/{TEAMS_SHORT_ID}"
+    # …and nowhere in the persisted row either.
+    assert TEAMS_PASSCODE not in json.dumps(repo._meetings, default=str)
+    # 
```

---

### Incident Patch 15: `12769637` (2026-08-29)
**Commit Message**: fix(runtime): spawned Pods declare CPU/memory requests and limits (#1005) (#1093)

* fix(runtime): spawned Pods declare CPU/memory requests and limits (#1005)

A namespace whose policy requires every container to declare CPU and memory
requests AND limits rejected both workload classes the runtime creates
dynamically, so no meeting bot and no agent worker could start there. The
runtime.v1 contract already carried the intent — the kernel accepted
`WorkloadSpec.resources` and then dropped it before calling the backend.

Resource intent now crosses the Backend port. The kernel resolves the effective
sizing (the spec's own, else the profile's deployment default) and hands it to
`Backend.start`. The Kubernetes backend submits a COMPLETE Pod manifest via
`kubectl create -f -` instead of `kubectl run --overrides`: a partial
`containers` entry in an override is a JSON merge patch that replaces the
generated container wholesale, so the image, env and command vanish and the API
server answers `spec.containers[0].image: Required value`. Owning the object
makes the merge ours and deterministic — resources, workspace volumeMounts,
image, command, env, labels and scheduling all coexist on the sa

**File**: `MARVIN-TEST-KIT-1005.md` (added, +315/-0)
```diff
@@ -0,0 +1,315 @@
+# Test kit — #1005 on a quota-controlled cluster
+
+For the validator running this on a real quota-enforcing namespace (OpenShift dev cluster included).
+Branch `1005-runtime-resources`, based on `616778fe`.
+
+**What you are proving:** the two Pods the runtime creates *dynamically* — the meeting bot and the
+agent worker — now declare CPU and memory requests **and** limits, so your namespace admits them
+instead of rejecting them. Nothing else about the release changes.
+
+**What has already been proven, and where** — so you can skip re-doing it:
+
+| Already green | Where |
+|---|---|
+| Both profiles admitted under a `ResourceQuota` requiring all four values, sized independently | k3d v1.35.5, namespace `vexa-quota` — see `OBSERVATION-BUNDLE-1005.md` A1/A2 |
+| Image, command, env, labels, tolerations, nodeSelector, workspace mounts all survive | same, A3 |
+| Removing one dimension reds admission; restoring it greens the same spawn | same, A4 |
+| Offline runtime suite, Helm render, Compose stack, all 34 repo gates | same, A- |
+
+**What only your cluster can prove:** OpenShift SCC behaviour on the spawned Pods, your real quota
+headroom, and whether the real bot image lives inside the memory ceiling you set. Read
+[the honest caveats](#honest-caveats) before you start — one of them is likely to bite.
+
+---
+
+## 1 · Install
+
+Two values blocks matter. The first is the new one.
+
+```yaml
+# values-quota.yaml
+runtime:
+  backend: k8s
+  # Sizing for the Pods the runtime SPAWNS. NOT runtime.resources (which sizes the runtime
+  # Deployment itself). One value per dimension sets BOTH the request and the limit.
+  workloadResources:
+    meetingBot:
+      cpu: 2                 # → requests/limits cpu: 2000m
+      memoryMb: 4096         # → requests/limits memory: 4096Mi
+    agentWorker:
+      cpu: 0.5               # → requests/limits cpu: 500m
+      memoryMb: 1024         # → requests/limits memory: 1024Mi
+```
+
+```bash
+helm upgrade --install vexa deploy/helm/charts/vexa \
+  -n <your-namespace> --create-namespace \
+  -f values-quota.yaml \
+  --set global.imageTag=<TAG> \
+  --set secrets.adminApiToken=$ADMIN_TOKEN \
+  --set secrets.internalApiSecret=$INTERNAL_API_SECRET
+```
+
+Confirm the sizing reached the runtime before you spawn anything:
+
+```bash
+kubectl -n <your-namespace> get deploy vexa-runtime -o json \
+  | jq '.spec.template.spec.containers[0].env[]
+        | select(.name|test("^RUNTIME_(BOT|AGENT_WORKER)_"))'
+```
+
+Expected — four entries, non-empty:
+
+```json
+{"name":"RUNTIME_BOT_CPU","value":"2"}
+{"name":"RUNTIME_BOT_MEMORY_MB","value":"4096"}
+{"name":"RUNTIME_AGENT_WORKER_CPU","value":"0.5"}
+{"name":"RUNTIME_AGENT_WORKER_MEMORY_MB","value":"1024"}
+```
+
+If they are empty strings, the chart values did not land — the spawned Pods will declare nothing and
+your namespace will reject them exactly as before. Fix this before going further.
+
+> **Sizing note, not a formality.** `memoryMb` is a **hard ceiling**: a workload exceeding it is
+> OOM-killed. Before this change nothing was enforced, so bots ran unbounded and we have no measured
+> figure to hand you. `4096` above is deliberately more generous than the chart default (`2048`).
+> Start high, watch actual usage, then tighten — do not start at the default and discover the ceiling
+> as a dropped meeting.
+
+---
+
+## 2 · Spawn both profiles and watch
+
+Trigger one meeting bot (your normal `POST /bots` path) and one agent dispatch. Then, for each:
+
+```bash
+kubectl -n <your-namespace> get pods -l runtime.managed=true
+kubectl -n <your-namespace> get pod <pod> -o json | jq '{
+  qos:        .status.qosClass,
+  phase:      .status.phase,
+  resources:  .spec.containers[0].resources,
+  image:      .spec.containers[0].image,
+  command:    .spec.containers[0].command,
+  envCount:   (.spec.containers[0].env|length),
+  labels:     .metadata.labels
+}'
+```
+
+### Expected observations
+
+| Pod | Name shape | Expect |
+|---|---|---|
+| meeting bot | `vexa-<meeting-workload-id>` | `resources.requests` **and** `.limits` = `{cpu: 2, memory: 4096Mi}`; `qosClass: Guaranteed`; `phase: Running`; **no** `command` (the bot image's own ENTRYPOINT boots it); `labels` carry `runtime.managed=true` + `runtime.workload_id` |
+| agent worker | `vexa-agent-…` | `resources` = `{cpu: 500m, memory: 1Gi}` — **different from the bot**; `qosClass: Guaranteed`; `command: ["python","-m","worker"]` |
+
+`2000m`/`500m` display as `2`/`500m` — the API server normalizes; either spelling is the same value.
+
+Quota consumption should move:
+
+```bash
+kubectl -n <your-namespace> describe resourcequota
+```
+
+Both classes should appear in `requests.cpu` / `limits.memory` usage while running, and drop back when
+the workloads finish.
+
+### The one-line red control (optional, 30 seconds)
+
+Proves the quota is really enforcing and that the values came from Vexa, not from a LimitRange:
+
+```bash
+kubectl -n <your-namespace> 
```

**File**: `OBSERVATION-BUNDLE-1005.md` (added, +460/-0)
```diff
@@ -0,0 +1,460 @@
+# Observation bundle — #1005 · runtime workloads carry CPU/memory requests and limits
+
+**Issue:** [Vexa-ai/vexa#1005](https://github.com/Vexa-ai/vexa/issues/1005) — *Quota-controlled
+clusters start every runtime workload — apply resources to bot and agent-worker Pods*
+**Branch:** `1005-runtime-resources` · **base:** `616778fe394919f871d792fd6214ea23d0aeac6e` (origin/main)
+**Implementation commit (the anchor for every row below):** `b3bed7b8` — *fix(runtime): spawned Pods
+declare CPU/memory requests and limits (#1005)*. Not pushed; the founder opens the PR (the
+contribution-rights declaration is a human decision, per `CONTRIBUTOR_RIGHTS.md`).
+**Validation cluster:** k3d `k3d-vexa1005`, Kubernetes **v1.35.5+k3s1**, single server node, Docker 29.1.3
+**Quota namespace:** `vexa-quota` with a `ResourceQuota` naming `requests.cpu`, `requests.memory`,
+`limits.cpu`, `limits.memory` — the shape that forces every container to declare all four.
+
+Facts first; my reading is labelled and lives at the end.
+
+---
+
+## The acceptance table
+
+| # | Observation | Verdict | Evidence |
+|---|---|---|---|
+| **A1** | Meeting-bot Pod carries configured CPU/memory requests and limits and is admitted under quota | **GREEN** | [A1](#a1--meeting-bot-admitted-under-quota) |
+| **A2** | Agent-worker Pod carries **independently** configured requests and limits and is admitted under the same quota | **GREEN** | [A2](#a2--agent-worker-admitted-independently-sized) |
+| **A3** | Image, command, env, labels, scheduling and workspace mounts survive resource injection | **GREEN** (live + offline, with the negative control shown red) | [A3](#a3--every-generated-field-survives) |
+| **A4** | Omitting one required request or limit makes admission red; restoring it makes the same spawn green | **GREEN** | [A4](#a4--red-green-on-one-missing-dimension) |
+| **A5** | Both profiles reach truthful bounded terminal states on a real API server | **GREEN** | [A5](#a5--truthful-bounded-terminal-states) |
+| **A-** | Runtime, Helm, docs-current, architecture and repository gates green at head | **GREEN** | [A-](#a---gates) |
+
+**Coverage caveat carried through every live row:** the live legs ran with `busybox:1.36`
+substituted for the meeting-bot and agent-worker images (`BROWSER_IMAGE` / `AGENT_WORKER_IMAGE`),
+so what is proven is the **resource declaration and admission path through the real kernel, the real
+profile registry and a real API server** — not that the 3.6 GB bot image boots inside those limits.
+Sizing the real images for real meetings is the operator decision the chart now exposes; see
+[Honest limits](#what-was-not-checked).
+
+---
+
+## A1 · Meeting-bot admitted under quota
+
+**Expected:** with `RUNTIME_BOT_CPU=1` / `RUNTIME_BOT_MEMORY_MB=512`, a `meeting-bot` workload created
+through the real `Runtime` + `K8sBackend` is admitted into `vexa-quota`, and the accepted Pod object
+carries `requests` **and** `limits` for cpu and memory.
+
+**Negative control (current head, pre-change shape):** unset all four sizing knobs — the same spawn is
+rejected because it declares nothing. Run first:
+
+```
+=== MODE: red-unsized ===
+--- profile=meeting-bot workloadId=mtg-red-unsized ---
+SPAWN REJECTED: StartFailed: kubectl create -f - -n vexa-quota failed: Error from server (Forbidden):
+error when creating "STDIN": pods "vexa-mtg-red-unsized" is forbidden: failed quota:
+require-requests-and-limits: must specify limits.cpu for: vexa-mtg-red-unsized;
+limits.memory for: vexa-mtg-red-unsized; requests.cpu for: vexa-mtg-red-unsized;
+requests.memory for: vexa-mtg-red-unsized
+```
+
+**Actual (sized):**
+
+```
+=== MODE: green ===
+--- profile=meeting-bot workloadId=mtg-green ---
+kernel state: running
+ADMITTED. container.resources = {"limits": {"cpu": "1", "memory": "512Mi"},
+                                 "requests": {"cpu": "1", "memory": "512Mi"}}
+image = busybox:1.36 | command = ['sleep', '120']
+labels = {"runtime.managed": "true", "runtime.workload_id": "mtg-green"}
+env names = ['VEXA_X']
+phase = Running | qosClass = Guaranteed
+terminal: destroyed
+```
+
+**Verdict: GREEN.** Red→green on the same spawn, same namespace, same quota. (`1000m` is normalized to
+`1` by the API server; the submitted manifest carries `1000m`.)
+
+---
+
+## A2 · Agent-worker admitted, independently sized
+
+**Expected:** in the SAME run and SAME namespace, `profile=agent` is admitted carrying a **different**
+size, sourced from its own knobs (`RUNTIME_AGENT_WORKER_CPU=0.25` / `RUNTIME_AGENT_WORKER_MEMORY_MB=256`).
+
+**Negative control:** same `red-unsized` run —
+
+```
+--- profile=agent workloadId=agent-red-unsized ---
+SPAWN REJECTED: StartFailed: … pods "vexa-agent-red-unsized" is forbidden: failed quota:
+require-requests-and-limits: must specify limits.cpu …; limits.memory …; requests.cpu …;
+requests.memory for: vexa-agent-red-unsized
+```
+
+**Actual:**
+
+```
+--- profile=agent workloadId=agent-green ---
+kernel state
```

**File**: `core/runtime/src/runtime_kernel/backend.py` (modified, +17/-1)
```diff
@@ -4,6 +4,7 @@
 
 from typing import Optional, Protocol
 
+from .models import Resources
 from .profiles import Runnable
 
 
@@ -19,7 +20,22 @@ def __init__(self, id: str, impl: object) -> None:
 class Backend(Protocol):
     name: str
 
-    def start(self, workload_id: str, runnable: Runnable, env: dict[str, str]) -> WorkloadHandle: ...
+    def start(
+        self,
+        workload_id: str,
+        runnable: Runnable,
+        env: dict[str, str],
+        resources: Optional[Resources] = None,
+    ) -> WorkloadHandle:
+        """Start the workload. ``resources`` is the effective sizing the kernel resolved (the spec's
+        own, else the profile's deployment default); ``None`` means unsized — today's behaviour.
+
+        ENFORCEMENT IS PER-SUBSTRATE and deliberately NOT claimed at parity: only the k8s backend
+        acts on it (a namespace ResourceQuota can require every container to declare requests and
+        limits). docker/process accept it and do not enforce — there is no quota admission on those
+        substrates, and a silently-introduced memory limit would OOM-kill live workloads that run
+        unbounded today."""
+        ...
     def exit_code(self, h: WorkloadHandle) -> Optional[int]:
         """None while running; the exit code once exited."""
         ...
```

**File**: `core/runtime/src/runtime_kernel/config.v1.json` (modified, +36/-0)
```diff
@@ -107,6 +107,42 @@
     "helm"
    ]
   },
+  {
+   "key": "RUNTIME_BOT_CPU",
+   "class": "defaulted",
+   "default": "(unset — the meeting-bot class declares no cpu, preserving runtime.v1's optional resources)",
+   "description": "k8s backend: CPU cores every SPAWNED meeting-bot Pod declares. runtime.v1 carries one value per dimension, so it sets BOTH the container's request and its limit (Guaranteed QoS) — the declaration a namespace ResourceQuota admits on (#1005). Unset/empty ⇒ no cpu declared (the pre-#1005 unbounded spawn); a non-numeric value is fatal at boot",
+   "targets": [
+    "helm"
+   ]
+  },
+  {
+   "key": "RUNTIME_BOT_MEMORY_MB",
+   "class": "defaulted",
+   "default": "(unset — the meeting-bot class declares no memory, preserving runtime.v1's optional resources)",
+   "description": "k8s backend: memory (MiB) every SPAWNED meeting-bot Pod declares, as BOTH request and limit. A HARD ceiling — a bot exceeding it is OOM-killed mid-meeting — so size it for real meetings, not for the smallest node. Unset/empty ⇒ no memory declared; a non-numeric value is fatal at boot (#1005)",
+   "targets": [
+    "helm"
+   ]
+  },
+  {
+   "key": "RUNTIME_AGENT_WORKER_CPU",
+   "class": "defaulted",
+   "default": "(unset — the agent-worker class declares no cpu, preserving runtime.v1's optional resources)",
+   "description": "k8s backend: CPU cores every SPAWNED agent-worker Pod declares, as BOTH request and limit. Sized INDEPENDENTLY of the meeting bot — a code harness is not a browser — so an operator can right-size each class alone (#1005). Unset/empty ⇒ no cpu declared; a non-numeric value is fatal at boot",
+   "targets": [
+    "helm"
+   ]
+  },
+  {
+   "key": "RUNTIME_AGENT_WORKER_MEMORY_MB",
+   "class": "defaulted",
+   "default": "(unset — the agent-worker class declares no memory, preserving runtime.v1's optional resources)",
+   "description": "k8s backend: memory (MiB) every SPAWNED agent-worker Pod declares, as BOTH request and limit. Unset/empty ⇒ no memory declared; a non-numeric value is fatal at boot (#1005)",
+   "targets": [
+    "helm"
+   ]
+  },
   {
    "key": "BROWSER_IMAGE",
    "class": "capability",
```

**File**: `core/runtime/src/runtime_kernel/docker_backend.py` (modified, +14/-1)
```diff
@@ -19,6 +19,7 @@
 import requests_unixsocket
 
 from .backend import WorkloadHandle
+from .models import Resources
 from .mounts import workspace_binds
 from .profiles import Runnable
 
@@ -174,7 +175,19 @@ def ensure_worker_image(self, target: str) -> str:
             )
         return target
 
-    def start(self, workload_id: str, runnable: Runnable, env: dict[str, str]) -> WorkloadHandle:
+    def start(
+        self,
+        workload_id: str,
+        runnable: Runnable,
+        env: dict[str, str],
+        resources: Optional[Resources] = None,
+    ) -> WorkloadHandle:
+        """``resources`` is accepted and NOT enforced here — the enforcement boundary is k8s-only,
+        and this backend claims no parity with it. Compose/Lite have no admission controller
+        demanding a declared request+limit, and translating the intent into ``HostConfig.Memory``
+        would introduce an OOM-kill ceiling on live meeting bots that run unbounded today: a
+        behaviour change on the most-used substrate, bought for no admission benefit. A deployment
+        that wants Docker enforcement adds it as its own change, with its own live evidence."""
         if not runnable.image:
             raise ValueError("docker backend requires an image")
         name = self._cname(workload_id)
```

**File**: `core/runtime/src/runtime_kernel/k8s_backend.py` (modified, +152/-34)
```diff
@@ -1,7 +1,12 @@
 """K8sBackend — runs a workload as a real Kubernetes Pod (the cluster substrate). Uses the kubectl CLI
 via subprocess (no client lib), matching the DockerBackend approach. Implements the same Backend port,
 so the kernel's runtime.v1 lifecycle is identical to process/docker. A workload is a bare Pod with
-restart=Never; the kernel owns restart policy, so the Pod must not resurrect itself."""
+restart=Never; the kernel owns restart policy, so the Pod must not resurrect itself.
+
+The spawn submits a COMPLETE Pod manifest (``build_pod`` → ``kubectl create -f -``). Owning the whole
+object is what lets a container carry CPU/memory requests and limits — the declaration a namespace
+ResourceQuota admits on — WITHOUT a partial ``kubectl run --overrides`` containers entry, whose JSON
+merge replaces the generated container wholesale and strips its image, env and command."""
 from __future__ import annotations
 
 import json
@@ -10,12 +15,18 @@
 from typing import Optional
 
 from .backend import WorkloadHandle
+from .models import Resources
 from .mounts import k8s_volume_mounts
 from .profiles import Runnable
 
 MANAGED_LABEL = "runtime.managed"
 WORKLOAD_ID_LABEL = "runtime.workload_id"
 
+# The extended-resource name a GPU request carries. Kubernetes requires extended resources on the
+# LIMITS side; the request is set equal to the limit automatically, and a requests-side entry that
+# differs is rejected — so runtime.v1's single `gpu` count maps to limits only.
+GPU_RESOURCE = "nvidia.com/gpu"
+
 # The runtime's OWN scheduling constraints, serialized as JSON by the chart from
 # global.tolerations / global.nodeSelector (see deployment-runtime.yaml). A spawned workload is a bare
 # `kubectl run` Pod — NOT a Deployment child — so it inherits none of the runtime Deployment's
@@ -54,8 +65,8 @@ def _runtime_scheduling_env() -> dict[str, str]:
     return {k: os.environ[k] for k in (TOLERATIONS_ENV, NODE_SELECTOR_ENV) if os.environ.get(k)}
 
 
-def _kubectl(*args: str, check: bool = True) -> subprocess.CompletedProcess:
-    r = subprocess.run(["kubectl", *args], capture_output=True, text=True)
+def _kubectl(*args: str, check: bool = True, stdin: Optional[str] = None) -> subprocess.CompletedProcess:
+    r = subprocess.run(["kubectl", *args], capture_output=True, text=True, input=stdin)
     if check and r.returncode != 0:
         raise RuntimeError(f"kubectl {' '.join(args)} failed: {r.stderr.strip()}")
     return r
@@ -73,7 +84,7 @@ def _stop_grace_sec() -> int:
 
 
 def pod_overrides(env: dict[str, str], *, container_name: str) -> Optional[dict]:
-    """The ``kubectl run --overrides`` spec for a spawned Pod, built from the SAME env. It carries two
+    """The env-derived OVERLAY ``build_pod`` merges onto a spawned Pod's spec. It carries two
     independent seams:
 
       * the workspace store mount set (WP-A1.1): the store PVC (``VEXA_WORKSPACE_MOUNT_SOURCE`` = the
@@ -82,22 +93,21 @@ def pod_overrides(env: dict[str, str], *, container_name: str) -> Optional[dict]
         so the bare ``kubectl run`` Pod — which inherits none of the runtime Deployment's scheduling —
         lands where the runtime itself is allowed to run instead of stranding Pending on a tainted pool.
 
-    The spec is built whenever EITHER seam is present; returns None only when neither is (no override
-    needed). Building it for scheduling alone is load-bearing: a plain meeting bot has no workspace PVC,
-    so a volumes-only early return would silently drop its tolerations and re-create the bug. Pure/
-    env-driven → unit-tested offline (no kubectl)."""
+    The overlay is built whenever EITHER seam is present; returns None only when neither is (nothing
+    to merge). Building it for scheduling alone is load-bearing: a plain meeting bot has no workspace
+    PVC, so a volumes-only early return would silently drop its tolerations and re-create the bug.
+    Pure/env-driven → unit-tested offline (no kubectl)."""
     pvc = env.get("VEXA_WORKSPACE_MOUNT_SOURCE")
     root = env.get("VEXA_WORKSPACE_MOUNT_TARGET")
     volumes, volume_mounts = k8s_volume_mounts(env, pvc_name=pvc or "", store_target=root or "")
     tolerations = _scheduling_json(env, TOLERATIONS_ENV, list)
     node_selector = _scheduling_json(env, NODE_SELECTOR_ENV, dict)
     if not volumes and not tolerations and not node_selector:
         return None
-    # ``kubectl run --overrides`` merges the containers LIST by replacement (json-merge, not
-    # strategic), so a containers entry here wipes the generated container — image, env, command —
-    # and the API server rejects the Pod (`spec.containers[0].image: Required value`), killing the
-    # spawn instantly. Emit ``containers`` ONLY when volumeMounts force it (the workspace-store
-    # seam); pod-level fields (tolerations/nodeSelector) merge fine without touching the list.
+    # ``containers`` is emitted ONLY when volumeMounts force it (the workspace-store seam);
+    # pod-level fields (t
```

**File**: `core/runtime/src/runtime_kernel/kernel.py` (modified, +19/-8)
```diff
@@ -19,7 +19,7 @@
 from .clock import Clock, SystemClock
 from .models import RuntimeEvent, RuntimeState, StopReason, WorkloadSpec, WorkloadStatus
 from .process_backend import ProcessBackend
-from .profiles import ProfileRegistry, Runnable, default_registry
+from .profiles import Profile, ProfileRegistry, Runnable, default_registry
 from .store import (
     InMemoryStore,
     OwnerResolver,
@@ -196,7 +196,14 @@ def create(self, spec: WorkloadSpec) -> WorkloadStatus:
             # layered on top so an explicit spec value always wins. Without this merge the base_env
             # never reaches the spawned pod and chart-set tuning is dead config (issue #771).
             effective_env = {**profile.base_env, **spec.env}
-            self._handles[spec.workloadId] = self.backend.start(spec.workloadId, runnable, effective_env)
+            # Resource intent must cross the Backend port or it is dead contract: the schema accepts
+            # `resources`, and a quota-controlled namespace rejects every container that declares
+            # none. The spec's own sizing wins; otherwise the profile's deployment default (the
+            # chart's per-class sizing) applies; neither ⇒ None, today's unsized spawn.
+            effective_resources = spec.resources or profile.resources
+            self._handles[spec.workloadId] = self.backend.start(
+                spec.workloadId, runnable, effective_env, effective_resources,
+            )
         except Exception as exc:
             # Record the honest terminal state (persist + emit) FIRST — GET /workloads and the
             # callback stream must still see stopped/start_failed — THEN raise so the API answers a
@@ -289,12 +296,16 @@ def _coerce_registry(profiles) -> ProfileRegistry:
         return default_registry()
     if isinstance(profiles, ProfileRegistry):
         return profiles
-    runnables: dict[str, Runnable] = {}
+    resolved: dict[str, object] = {}
     for name, value in profiles.items():
-        if isinstance(value, Runnable):
-            runnables[name] = value
+        # A full Profile carries the deployment defaults (timeouts, base env, per-class sizing); a
+        # bare Runnable or command list is the shorthand for "how to run it, nothing configured".
+        if isinstance(value, (Profile, Runnable)):
+            resolved[name] = value
         elif isinstance(value, list):
-            runnables[name] = Runnable(command=value)
+            resolved[name] = Runnable(command=value)
         else:
-            raise TypeError(f"profile {name!r}: expected Runnable or command list, got {type(value)}")
-    return ProfileRegistry(runnables)
+            raise TypeError(
+                f"profile {name!r}: expected Profile, Runnable or command list, got {type(value)}"
+            )
+    return ProfileRegistry(resolved)
```

**File**: `core/runtime/src/runtime_kernel/models.py` (modified, +8/-4)
```diff
@@ -5,7 +5,7 @@
 from enum import Enum
 from typing import Optional
 
-from pydantic import BaseModel
+from pydantic import BaseModel, Field
 
 
 class RuntimeState(str, Enum):
@@ -33,10 +33,14 @@ class BackendKind(str, Enum):
 
 
 class Resources(BaseModel):
+    """The workload's resource intent. ONE value per dimension: on Kubernetes ``cpu``/``memoryMb``
+    set BOTH the container's request and its limit (Guaranteed QoS) — sealed v1 models no separate
+    request/limit semantics. The floors mirror the JSON Schema's ``minimum: 0``, so a negative
+    value is rejected at parse time and never reaches a backend."""
     model_config = {"extra": "forbid"}
-    cpu: Optional[float] = None
-    memoryMb: Optional[int] = None
-    gpu: Optional[int] = None
+    cpu: Optional[float] = Field(default=None, ge=0)
+    memoryMb: Optional[int] = Field(default=None, ge=0)
+    gpu: Optional[int] = Field(default=None, ge=0)
 
 
 class WorkloadSpec(BaseModel):
```

#### Recent Merged Pull Requests:
- **PR #1767** (2026-10-03): release: prepare v0.12.28 installation repair (@DmitriyG228)
- **PR #1765** (2026-10-03): main stays green: the rights verdict lives on the evaluated PR, rights declared once per contributor (@DmitriyG228)
- **PR #1760** (2026-10-02): storage: MinIO removed — versitygw for Lite and Compose, your own S3 for Helm (#1759) (@DmitriyG228)
- **PR #1755** (closed): feat(transcript): incremental `?since=` reads, and a typed refusal for parameters we don't honour (@DmitriyG228)
- **PR #1754** (closed): fix(meetings): require explicit selection for ambiguous native writes (@DmitriyG228)
- **PR #1753** (closed): share: restrict the fields a delivered payload serializes (@DmitriyG228)
- **PR #1752** (closed): promote: the packet population belongs in the packet's own case arm (@DmitriyG228)
- **PR #1746** (closed): contribution-rights: declare once per contributor, not per PR (@DmitriyG228)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
