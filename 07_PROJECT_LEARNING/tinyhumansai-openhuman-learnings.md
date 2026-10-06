# Forensic Learning Record (Deep Inspection): tinyhumansai/openhuman

> **Canonical Artifact**: `07_PROJECT_LEARNING/tinyhumansai-openhuman-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/tinyhumansai/openhuman](https://github.com/tinyhumansai/openhuman))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:52:59.716Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `tinyhumansai/openhuman`
- **Description**: OpenHuman is the fastest, cheapest, most efficient open-source agent harness. Written in Rust
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 40853 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `app/src/components/EmptyStateCard.tsx`
```
import type { ReactNode } from 'react';

interface EmptyStateCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  /** `data-testid` for the action button, so callers can target it distinctly from other same-labeled buttons on the page. */
  actionTestId?: string;
  footer?: ReactNode;
  className?: string;
}

const EmptyStateCard = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionTestId,
  footer,
  className = '',
}: EmptyStateCardProps) => {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong bg-surface-muted/80 dark:bg-surface/80 px-6 py-16 text-center ${className}`.trim()}>
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-500/10">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-content">{title}</h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-content-muted">{description}</p>
      {actionLabel && onAction ? (
        <button
          type="button"
          data-testid={actionTestId}
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary-50 dark:bg-primary-500/10 px-3 py-1.5 text-xs font-medium text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-800/50 transition-colors hover:bg-primary-100 dark:hover:bg-primary-500/20">
          <span>{actionLabel}</span>
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      ) : null}
      {footer}
    </div>
  );
};

export default EmptyStateCard;

```

### Core Architecture Module: `app/src/components/assistant-ui/elements/connection-state.tsx`
```
'use client';

/**
 * The socket drops, the run keeps going on the server, and the stream is
 * picked back up.
 *
 * Vendored from the assistant-ui `elements-connection-state` registry item
 * (https://r.assistant-ui.com/styles/base-nova/elements-connection-state.json).
 * Changes from upstream:
 * - `cn` import path (`@/components/assistant-ui/lib/utils`).
 * - The "Connection lost…", "Reconnect", "Reconnecting", "Picked the stream
 *   back up.", "attempt N" and "+N tokens" captions are props with English
 *   defaults, for `useT()` — see `ConnectionStateBanner` in
 *   `features/conversations/aui/ConnectionStateBanner.tsx`, the only caller.
 */
import { cn } from '@/components/assistant-ui/lib/utils';
import { CheckIcon, CloudOffIcon, Loader2Icon } from 'lucide-react';
import type { ComponentProps } from 'react';

import { mono, paper } from './surfaces';

export type ConnectionPhase = 'online' | 'dropped' | 'reconnecting' | 'resumed';

export function ConnectionState({
  phase,
  attempt,
  resumedTokens,
  onRetry,
  droppedLabel = 'Connection lost. The run kept going on the server.',
  retryLabel = 'Reconnect',
  reconnectingLabel = 'Reconnecting',
  attemptLabel = (attempt: number) => `attempt ${attempt}`,
  resumedLabel = 'Picked the stream back up.',
  resumedTokensLabel = (tokens: number) => `+${tokens} tokens`,
  className,
  ...props
}: Omit<ComponentProps<'div'>, 'children' | 'phase' | 'attempt' | 'resumedTokens' | 'onRetry'> & {
  phase: ConnectionPhase;
  attempt?: number;
  resumedTokens?: number;
  onRetry?: () => void;
  droppedLabel?: string;
  retryLabel?: string;
  reconnectingLabel?: string;
  attemptLabel?: (attempt: number) => string;
  resumedLabel?: string;
  resumedTokensLabel?: (tokens: number) => string;
}) {
  if (phase === 'online') return null;

  return (
    <div
      data-slot="connection-state"
      className={cn(
        paper,
        'fade-in slide-in-from-top-1 animate-in flex w-full max-w-sm items-center gap-2.5 rounded-2xl px-3.5 py-2.5 duration-300',
        className
      )}
      {...props}>
      {phase === 'dropped' && (
        <>
          <CloudOffIcon className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="min-w-0 flex-1 text-[13px]">{droppedLabel}</span>
          <button
            type="button"
            onClick={onRetry}
            className="text-foreground/70 hover:bg-foreground/[0.06] hover:text-foreground/95 shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-[background-color,color,scale] duration-150 active:scale-[0.96]">
            {retryLabel}
          </button>
        </>
      )}

      {phase === 'reconnecting' && (
        <>
          <Loader2Icon className="text-foreground/40 size-3.5 shrink-0 animate-spin motion-reduce:animate-none" />
          <span className="min-w-0 flex-1 text-[13px]">{reconnectingLabel}</span>
          {attempt !== undefined && (
            <span className={cn(mono, 'text-foreground/30 shrink-0 tabular-nums')}>
              {attemptLabel(attempt)}
            </span>
          )}
        </>
      )}

      {phase === 'resumed' && (
        <>
          <CheckIcon className="size-3.5 shrink-0 text-emerald-500" />
          <span className="min-w-0 flex-1 text-[13px]">{resumedLabel}</span>
          {resumedTokens !== undefined && (
            <span className={cn(mono, 'text-foreground/30 shrink-0 tabular-nums')}>
              {resumedTokensLabel(resumedTokens)}
            </span>
          )}
        </>
      )}
    </div>
  );
}

```

### Core Architecture Module: `app/src/components/assistant-ui/elements/error-state.tsx`
```
'use client';

/**
 * Vendored from the assistant-ui `elements-error-state` registry item
 * (https://r.assistant-ui.com/styles/base-nova/elements-error-state.json).
 * Changes from upstream:
 * - `cn` import path (`@/components/assistant-ui/lib/utils`).
 * - "Retrying"/"Retry" are `retryingLabel`/`retryLabel` props with English
 *   defaults, for `useT()`.
 */
import { cn } from '@/components/assistant-ui/lib/utils';
import { CircleAlertIcon, RefreshCwIcon } from 'lucide-react';
import type { ComponentProps } from 'react';

import { ShimmerLabel } from './surfaces';

export interface ErrorStateProps extends Omit<ComponentProps<'div'>, 'children' | 'role'> {
  title: string;
  detail: string;
  retrying: boolean;
  onRetry?: () => void;
  retryingLabel?: string;
  retryLabel?: string;
}

export function ErrorState({
  title,
  detail,
  retrying,
  onRetry,
  retryingLabel = 'Retrying',
  retryLabel = 'Retry',
  className,
  ...props
}: ErrorStateProps) {
  if (retrying) {
    return (
      <div
        data-slot="error-state"
        key="retrying"
        role="status"
        className={cn(
          'fade-in animate-in flex w-full max-w-sm items-center gap-2.5 text-sm duration-300 motion-reduce:animate-none',
          className
        )}
        {...props}>
        <RefreshCwIcon className="text-foreground/45 size-3.5 shrink-0 animate-spin motion-reduce:animate-none" />
        <ShimmerLabel className="text-foreground/55 relative inline-block">
          {retryingLabel}
        </ShimmerLabel>
      </div>
    );
  }

  return (
    <div
      data-slot="error-state"
      key="error"
      role="alert"
      className={cn(
        'fade-in animate-in flex w-full max-w-sm items-start gap-2.5 rounded-2xl bg-red-500/[0.06] px-4 py-3 text-sm duration-300 motion-reduce:animate-none dark:bg-red-500/10',
        className
      )}
      {...props}>
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-red-500/80" />
      <div>
        <p className="font-medium text-red-600 dark:text-red-400">{title}</p>
        <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-snug text-red-600/60 dark:text-red-400/60">
          {detail}
        </p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ms-auto flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-500/10 dark:text-red-400">
          <RefreshCwIcon className="size-3" />
          {retryLabel}
        </button>
      )}
    </div>
  );
}

```

### Core Architecture Module: `app/src/components/assistant-ui/elements/loading-state.tsx`
```
'use client';

/**
 * Vendored from the assistant-ui `elements-loading-state` registry item
 * (https://r.assistant-ui.com/styles/base-nova/elements-loading-state.json).
 * Changes from upstream:
 * - `cn` import path (`@/components/assistant-ui/lib/utils`).
 */
import { cn } from '@/components/assistant-ui/lib/utils';
import type { ComponentProps } from 'react';

import { ShimmerLabel } from './surfaces';

export type GenerationLoaderVariant = 'dots' | 'squares' | 'rounded';

export interface GenerationLoaderProps extends Omit<ComponentProps<'div'>, 'children'> {
  label: string;
  tick: number;
  variant?: GenerationLoaderVariant;
}

const CELL_SHAPES: Record<GenerationLoaderVariant, string> = {
  dots: 'rounded-full',
  squares: 'rounded-[1px]',
  rounded: 'rounded-[3px]',
};

export function GenerationLoader({
  label,
  tick,
  variant = 'dots',
  className,
  ...props
}: GenerationLoaderProps) {
  const pixelOffset = Math.floor(tick / 3);

  return (
    <div
      data-slot="generation-loader"
      className={cn('flex flex-col items-center gap-4', className)}
      {...props}>
      <div aria-hidden className="grid grid-cols-3 gap-1">
        {Array.from({ length: 9 }, (_, index) => {
          const active = (index * 2 + pixelOffset) % 9 < 3;

          return (
            <span
              key={index}
              className={cn(
                'bg-foreground size-2 transition-opacity duration-300 motion-reduce:transition-none',
                CELL_SHAPES[variant],
                active ? 'opacity-90' : 'opacity-15'
              )}
            />
          );
        })}
      </div>
      <ShimmerLabel className="text-foreground/55 relative inline-block text-sm">
        {label}
      </ShimmerLabel>
    </div>
  );
}

```

### Core Architecture Module: `app/src/components/assistant-ui/elements/message-queue.tsx`
```
'use client';

/**
 * The running message and the messages queued behind it, each removable.
 *
 * Vendored from the assistant-ui `elements-message-queue` registry item
 * (https://r.assistant-ui.com/styles/base-nova/elements-message-queue.json).
 * Changes from upstream:
 * - `cn` import path (`@/components/assistant-ui/lib/utils`).
 * - The "running", "N queued" and "sends when this finishes" captions and the
 *   remove button's accessible name are props with English defaults, for
 *   `useT()` — see `ComposerMessageQueue` in
 *   `features/conversations/aui/ComposerMessageQueue.tsx`, the only caller.
 */
import { cn } from '@/components/assistant-ui/lib/utils';
import { ArrowUpIcon, XIcon } from 'lucide-react';
import type { ComponentProps } from 'react';

import { field, ghostButton, mono, paper } from './surfaces';

export interface QueuedMessage {
  id: string;
  text: string;
}

export function MessageQueue({
  running,
  queued,
  onCancel,
  runningLabel = 'running',
  queuedLabel = (count: number) => `${count} queued`,
  pendingHint = 'sends when this finishes',
  removeLabel = (text: string) => `Remove "${text}" from the queue`,
  className,
  ...props
}: Omit<ComponentProps<'div'>, 'children' | 'running' | 'queued' | 'onCancel'> & {
  running: string;
  queued: readonly QueuedMessage[];
  onCancel?: (id: string) => void;
  runningLabel?: string;
  queuedLabel?: (count: number) => string;
  pendingHint?: string;
  removeLabel?: (text: string) => string;
}) {
  return (
    <div
      data-slot="message-queue"
      className={cn('flex w-full max-w-sm flex-col gap-2', className)}
      {...props}>
      <div className={cn(paper, 'flex items-center gap-2.5 rounded-2xl p-3')}>
        <span className="relative flex size-2 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-blue-500/60 motion-reduce:hidden" />
          <span className="relative inline-flex size-2 rounded-full bg-blue-500 dark:bg-blue-400" />
        </span>
        <span className="text-foreground/90 min-w-0 flex-1 truncate text-[13.5px]">{running}</span>
        <span className={cn(mono, 'text-foreground/35 shrink-0')}>{runningLabel}</span>
      </div>

      {queued.length > 0 && (
        <div className="flex items-baseline justify-between px-1">
          <span className={cn(mono, 'text-foreground/35')}>{queuedLabel(queued.length)}</span>
          <span className={cn(mono, 'text-foreground/35')}>{pendingHint}</span>
        </div>
      )}

      <ul className="flex flex-col gap-1.5">
        {queued.map((message, index) => (
          <li
            key={message.id}
            className={cn(
              field,
              'fade-in slide-in-from-bottom-1 animate-in fill-mode-both flex items-center gap-2.5 rounded-2xl py-2 pr-2 pl-3 duration-300'
            )}>
            <span className={cn(mono, 'text-foreground/30 w-3 shrink-0 tabular-nums')}>
              {index + 1}
            </span>
            <span className="text-foreground/60 min-w-0 flex-1 truncate text-[13.5px]">
              {message.text}
            </span>
            <ArrowUpIcon className="text-foreground/25 size-3 shrink-0" />
            {onCancel && (
              <button
                type="button"
                aria-label={removeLabel(message.text)}
                onClick={() => onCancel(message.id)}
                className={cn(ghostButton, 'size-6 shrink-0')}>
                <XIcon className="size-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

```

### Core Architecture Module: `app/src/components/assistant-ui/lib/utils.ts`
```
export { cn } from '../../../lib/cn';

```

### Core Architecture Module: `app/src/components/assistant-ui/utils/range.ts`
```
// Vendored verbatim from the assistant-ui `elements-range` registry item
// (https://r.assistant-ui.com/elements-range.json).

/**
 * Range normalization for the numeric props the elements take.
 *
 * Elements are driven by a caller's state, so a prop can arrive negative, past
 * the end of its collection, or NaN. Left raw, those reach the DOM: a negative
 * percentage is an invalid CSS width that the browser drops, leaving a bar at
 * its natural full width, and a negative slice length counts from the end of
 * the array instead of returning nothing.
 */

/**
 * Constrains a value to `min…max`. NaN is decided first and maps to `min`.
 * For any other value, an empty collection can invert the bounds and `max`
 * wins there: `clamp(3, 1, 0)` is `0`, which is what lets a floor of one item
 * still yield none.
 */
export function clamp(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/** The first `count` items, for a `count` that may be out of range. */
export function take<T>(items: readonly T[], count: number) {
  return items.slice(0, Math.floor(clamp(count, 0, items.length)));
}

/** The position `index` names in `items`, for an `index` out of range. */
export function indexIn<T>(items: readonly T[], index: number) {
  return Math.floor(clamp(index, 0, Math.max(0, items.length - 1)));
}

/** The item at `index`, for an `index` that may be out of range. */
export function at<T>(items: readonly T[], index: number) {
  if (items.length === 0) return undefined;
  return items[indexIn(items, index)];
}

/** `value` as a share of `total`, as a percentage in `0…100`. */
export function pct(value: number, total: number) {
  if (!(total > 0)) return 0;
  return clamp((value / total) * 100, 0, 100);
}

/**
 * A `0…100` share as it should be announced. `pct` divides, so a share that
 * reads as a whole number on screen can still reach `aria-valuenow` carrying
 * float error, which a screen reader reads out in full.
 */
export function announced(share: number) {
  return Math.round(share * 10) / 10;
}

/** A count of completed items out of `total`, in `0…total`. */
export function progressOf(index: number, total: number) {
  if (!(total > 0)) return 0;
  return Math.floor(clamp(index, 0, total));
}

```

### Core Architecture Module: `app/src/components/assistant-ui/utils/task.ts`
```
'use client';

/**
 * Vendored verbatim from the assistant-ui `task-card` registry item's shared
 * util (https://r.assistant-ui.com/styles/base-nova/task-card.json,
 * `utils/task.ts` upstream). No local changes.
 */
import type { ToolCallMessagePart, ToolCallMessagePartStatus } from '@assistant-ui/react';
import { useEffect, useState } from 'react';

export type TaskViewState = 'working' | 'waiting' | 'done' | 'failed' | 'cancelled';

export type TaskTiming = NonNullable<ToolCallMessagePart['timing']>;

export const TASK_PAGE_SIZE = 4;

const LABEL_KEYS = ['description', 'task', 'title', 'name', 'prompt', 'query', 'instructions'];

const META_KEYS = ['subagent_type', 'subagentType', 'agent', 'model'];

function firstString(args: unknown, keys: readonly string[]) {
  if (typeof args !== 'object' || args === null) return undefined;
  const record = args as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return undefined;
}

export function taskStateOf(status: ToolCallMessagePartStatus, isError?: boolean): TaskViewState {
  if (status.type === 'running') return 'working';
  if (status.type === 'requires-action') return 'waiting';
  if (status.type === 'incomplete') {
    return status.reason === 'cancelled' ? 'cancelled' : 'failed';
  }
  if (isError) return 'failed';
  return 'done';
}

export function taskLabel(toolName: string, args: unknown) {
  return firstString(args, LABEL_KEYS) ?? toolName;
}

export function taskMeta(args: unknown) {
  return firstString(args, META_KEYS);
}

export function formatElapsed(ms: number) {
  if (ms < 1000) return '<1s';
  const seconds = ms / 1000;
  if (seconds < 10) return `${(Math.floor(seconds * 10) / 10).toFixed(1)}s`;
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.floor(seconds % 60)}s`;
}

export function useTaskElapsed(timing: TaskTiming | undefined, running: boolean) {
  const ticking = timing !== undefined && timing.completedAt === undefined && running;
  const [now, setNow] = useState(() => Date.now());
  const [wasTicking, setWasTicking] = useState(ticking);
  if (wasTicking !== ticking) {
    setWasTicking(ticking);
    if (ticking) setNow(Date.now());
  }

  useEffect(() => {
    if (!ticking) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  if (timing === undefined) return undefined;
  if (timing.completedAt !== undefined) {
    return Math.max(0, timing.completedAt - timing.startedAt);
  }
  if (!ticking) return undefined;
  return Math.max(0, now - timing.startedAt);
}

```

### Core Architecture Module: `app/src/components/flows/canvas/nodeConfig/loopFields.tsx`
```
/**
 * `loop` node config form (15th tinyflows `NodeKind`). A bounded loop head:
 * it emits its input on the `body` port until either its iteration cap or its
 * optional condition says stop, then emits on `done`. The loop itself is drawn
 * on the canvas — wiring the body's last node back to this one is what makes
 * the section repeat.
 *
 * Field keys mirror what the engine actually reads at runtime:
 *  - `max_iterations` — required, positive. How many passes the body may run.
 *  - `on_exceeded` — `error` (default, fails the run naming this node) or
 *    `continue` (stop looping and leave through `done` with partial results).
 *  - `condition` — optional `=`-expression. While truthy the loop continues;
 *    the first falsey result exits without consuming an iteration.
 */
import { useT } from '../../../../lib/i18n/I18nContext';
import {
  configNumber,
  configString,
  ExpressionField,
  NumberField,
  SelectField,
} from './nodeConfigFields';
import type { UpstreamExpressionOption } from './upstreamOptions';

/**
 * Deliberately narrower than `NodeConfigFormProps` (`nodeConfigForms.tsx`) —
 * a loop node uses no credential picker, so `connections` is not imported here
 * just to keep the shape identical. A component typed against this subset is
 * still assignable into `NODE_CONFIG_FORMS`'s `NodeConfigForm` slot.
 */
export interface LoopFormProps {
  config: Record<string, unknown>;
  onChange: (patch: Record<string, unknown>) => void;
  upstreamOptions?: UpstreamExpressionOption[];
}

export function LoopForm({ config, onChange, upstreamOptions }: LoopFormProps) {
  const { t } = useT();
  // The engine's own default when the key is absent, shown so the field is
  // never blank and the effective bound is always visible.
  const maxIterations = configNumber(config, 'max_iterations') ?? 25;
  const onExceeded = configString(config, 'on_exceeded') || 'error';

  return (
    <div className="space-y-3">
      <NumberField
        label={t('flows.nodeConfig.loop.maxIterationsLabel')}
        hint={t('flows.nodeConfig.loop.maxIterationsHint')}
        value={maxIterations}
        // The engine's domain is a positive integer, so the control is held to
        // the same one: without these the spinner walks into 0 and negatives,
        // and the editor happily builds a graph the core then refuses to save.
        min={1}
        step={1}
        onChange={v => onChange({ max_iterations: v })}
        testId="node-config-loop-max-iterations"
      />
      <SelectField
        label={t('flows.nodeConfig.loop.onExceededLabel')}
        hint={t('flows.nodeConfig.loop.onExceededHint')}
        value={onExceeded}
        onChange={v => onChange({ on_exceeded: v })}
        testId="node-config-loop-on-exceeded"
        options={[
          { value: 'error', label: t('flows.nodeConfig.loop.onExceeded_error') },
          { value: 'continue', label: t('flows.nodeConfig.loop.onExceeded_continue') },
        ]}
      />
      <ExpressionField
        label={t('flows.nodeConfig.loop.conditionLabel')}
        hint={t('flows.nodeConfig.loop.conditionHint')}
        value={configString(config, 'condition')}
        onChange={v => onChange({ condition: v })}
        placeholder="=item.needs_another_pass"
        upstreamOptions={upstreamOptions}
        testId="node-config-loop-condition"
      />
    </div>
  );
}

```

### Core Architecture Module: `app/src/components/intelligence/utils.ts`
```
import type { ActionableItem, TimeGroup } from '../../types/intelligence';

/**
 * Groups actionable items by time periods (Today, Yesterday, This Week, Older)
 */
export function groupItemsByTime(items: ActionableItem[]): TimeGroup[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const oneWeekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

  const groups: Record<string, ActionableItem[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    older: [],
  };

  items.forEach(item => {
    const itemDate = new Date(item.createdAt);
    const itemDateOnly = new Date(itemDate.getFullYear(), itemDate.getMonth(), itemDate.getDate());

    if (itemDateOnly >= today) {
      groups.today.push(item);
    } else if (itemDateOnly >= yesterday) {
      groups.yesterday.push(item);
    } else if (itemDateOnly >= oneWeekAgo) {
      groups.thisWeek.push(item);
    } else {
      groups.older.push(item);
    }
  });

  // Sort items within each group by priority and then by date (newest first)
  const sortItems = (items: ActionableItem[]) => {
    const priorityOrder = { critical: 0, important: 1, normal: 2 };
    return items.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  };

  const timeGroups: TimeGroup[] = [];

  if (groups.today.length > 0) {
    timeGroups.push({ label: 'Today', items: sortItems(groups.today), count: groups.today.length });
  }

  if (groups.yesterday.length > 0) {
    timeGroups.push({
      label: 'Yesterday',
      items: sortItems(groups.yesterday),
      count: groups.yesterday.length,
    });
  }

  if (groups.thisWeek.length > 0) {
    timeGroups.push({
      label: 'This Week',
      items: sortItems(groups.thisWeek),
      count: groups.thisWeek.length,
    });
  }

  if (groups.older.length > 0) {
    timeGroups.push({ label: 'Older', items: sortItems(groups.older), count: groups.older.length });
  }

  return timeGroups;
}

/**
 * Filters items based on various criteria
 */
export function filterItems(
  items: ActionableItem[],
  options: { source?: string; priority?: string; status?: string; searchTerm?: string }
): ActionableItem[] {
  let filtered = [...items];

  if (options.source && options.source !== 'all') {
    filtered = filtered.filter(item => item.source === options.source);
  }

  if (options.priority && options.priority !== 'all') {
    filtered = filtered.filter(item => item.priority === options.priority);
  }

  if (options.status && options.status !== 'all') {
    filtered = filtered.filter(item => item.status === options.status);
  }

  if (options.searchTerm) {
    const term = options.searchTerm.toLowerCase();
    filtered = filtered.filter(
      item =>
        item.title.toLowerCase().includes(term) ||
        item.description?.toLowerCase().includes(term) ||
        item.sourceLabel?.toLowerCase().includes(term)
    );
  }

  return filtered;
}

/**
 * Gets summary statistics for actionable items
 */
export function getItemStats(items: ActionableItem[]) {
  const total = items.length;
  const byPriority = items.reduce(
    (acc, item) => {
      acc[item.priority]++;
      return acc;
    },
    { critical: 0, important: 0, normal: 0 }
  );

  const bySource = items.reduce(
    (acc, item) => {
      acc[item.source] = (acc[item.source] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const newItems = items.filter(item => {
    const diff = Date.now() - item.createdAt.getTime();
    return diff < 5 * 60 * 1000; // Less than 5 minutes
  }).length;

  const expiringSoon = items.filter(item => {
    if (!item.expiresAt) return false;
    const diff = item.expiresAt.getTime() - Date.now();
    return diff < 24 * 60 * 60 * 1000 && diff > 0; // Expires within 24 hours
  }).length;

  return { total, byPriority, bySource, newItems, expiringSoon };
}

```

### Core Architecture Module: `app/src/components/memory/MemoryEngineConnectDialog.tsx`
```
/**
 * "Connect {engine}" — where a self-hosted engine's endpoint and API key are
 * typed (CortexDB at launch). Mirrors the web-search connect dialog: keys are
 * entered rarely, so they live in a dialog rather than inline in the list.
 */
import { useId, useState } from 'react';

import { useT } from '../../lib/i18n/I18nContext';
import type { EngineDescriptor, EngineSetRequest } from '../../services/api/memoryApi';
import { Button, Label, ModalShell, TextField } from '../ui';
import { fill } from './memoryFormat';

interface MemoryEngineConnectDialogProps {
  engine: EngineDescriptor;
  /** The endpoint currently configured for this engine, when it is active. */
  currentEndpoint?: string;
  /** A key is already stored for this engine. */
  keySaved: boolean;
  saving: boolean;
  /** Persist the selection; resolves true when the core accepted it. */
  onSubmit: (req: EngineSetRequest) => Promise<boolean>;
  onClose: () => void;
}

export default function MemoryEngineConnectDialog({
  engine,
  currentEndpoint,
  keySaved,
  saving,
  onSubmit,
  onClose,
}: MemoryEngineConnectDialogProps) {
  const { t } = useT();
  const baseId = useId();
  const [endpoint, setEndpoint] = useState(currentEndpoint || engine.default_endpoint || '');
  const [apiKey, setApiKey] = useState('');

  // A self-hosted engine always takes an endpoint, even one with a default
  // (CortexDB defaults to its cloud): otherwise a local server is unreachable.
  const showEndpoint = engine.needs_endpoint || !engine.hosted;
  const keyRequired = engine.needs_key && !keySaved;
  const canSubmit =
    !saving &&
    (!showEndpoint || endpoint.trim().length > 0) &&
    (!keyRequired || apiKey.trim().length > 0);

  const submit = async () => {
    if (!canSubmit) return;
    const req: EngineSetRequest = { engine: engine.id };
    if (showEndpoint) req.endpoint = endpoint.trim();
    if (apiKey.trim()) req.api_key = apiKey.trim();
    if (await onSubmit(req)) onClose();
  };

  return (
    <ModalShell
      title={fill(t('memoryPage.engine.connectTitle'), { engine: engine.label })}
      titleId={`${baseId}-title`}
      subtitle={engine.description}
      onClose={onClose}
      maxWidthClassName="max-w-md"
      testId={`memory-engine-connect-${engine.id}`}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            data-testid={`memory-engine-connect-${engine.id}-submit`}
            disabled={!canSubmit}
            onClick={() => void submit()}>
            {t('memoryPage.engine.connect')}
          </Button>
        </div>
      }>
      <form
        className="flex flex-col gap-4"
        onSubmit={event => {
          event.preventDefault();
          void submit();
        }}>
        {showEndpoint && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${baseId}-endpoint`} className="text-xs text-content-secondary">
              {t('memoryPage.engine.endpoint')}
            </Label>
            <TextField
              id={`${baseId}-endpoint`}
              data-testid={`memory-engine-connect-${engine.id}-endpoint`}
              type="url"
              mono
              spellCheck={false}
              value={endpoint}
              disabled={saving}
              placeholder={engine.default_endpoint ?? 'https://'}
              onChange={e => setEndpoint(e.target.value)}
            />
          </div>
        )}
        {engine.needs_key && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`${baseId}-key`} className="text-xs text-content-secondary">
              {t('memoryPage.engine.apiKey')}
            </Label>
            <TextField
              id={`${baseId}-key`}
              data-testid={`memory-engine-connect-${engine.id}-key`}
              type="password"
              mono
              autoComplete="off"
              spellCheck={false}
              data-lpignore="true"
              data-1p-ignore="true"
              value={apiKey}
              disabled={saving}
              placeholder={keySaved ? t('memoryPage.engine.keySavedPlaceholder') : ''}
              onChange={e => setApiKey(e.target.value)}
            />
            {keySaved && (
              <p className="text-[11px] leading-4 text-content-muted">
                {t('memoryPage.engine.keySavedHint')}
              </p>
            )}
          </div>
        )}
      </form>
    </ModalShell>
  );
}

```

### Core Architecture Module: `app/src/components/memory/MemoryEngineSetup.tsx`
```
/**
 * The Engine picker on its own, loading its own engine state — for hosts that
 * are not the Memory page (the onboarding wizard's memory step).
 *
 * debug logging: DEBUG=openhuman:memory:engine-setup
 */
import debug from 'debug';
import { useEffect, useState } from 'react';

import { type EngineState, memoryEngineGet } from '../../services/api/memoryApi';
import MemoryEngineTab from './MemoryEngineTab';

const log = debug('openhuman:memory:engine-setup');

const OFF: EngineState = { engine: null, has_key: false, status: 'off', fetch_modes: [] };

export default function MemoryEngineSetup() {
  const [state, setState] = useState<EngineState | null>(null);

  useEffect(() => {
    let cancelled = false;
    memoryEngineGet()
      .then(next => {
        if (!cancelled) setState(next);
      })
      .catch(err => {
        log('engine_get failed: %o', err);
        if (!cancelled) setState(OFF);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <MemoryEngineTab state={state} onStateChange={setState} embedded />;
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6962** (2026-10-04): **openhuman: mid-turn system messages (stored-results list, validation and no-progress nudges) reset DeepSeek's prompt cache to the static prefix**
  *Symptoms*: > Found running OpenHuman on DeepSWE in tinyhumansai/openhuman-benchmarks (model `deepseek/deepseek-v4.1-flash`, reasoning high). The runs used builds older than main: about `7aebeb2af0` / `da7ad3156e`, with tinyagents `3c411b44`. Each code reference below was re-checked on main `bbf1dd5809`, and the links point there. Overview of all failures: tinyhumansai/openhuman-benchmarks#17. Re-run commands are run from an openhuman-benchmarks checkout with `vendor/openhuman` at the fix.  Each time OpenHuman inserts a **new** `role: system` message partway through a turn, DeepSeek's prompt cache falls back to the roughly 5k-token static prefix, and the whole conversation is billed again uncached. Examples are the stored-results list, the "last call failed validation" nudge, and the no-progress nudge.  ## Seen in OpenHuman main-agent calls across all DeepSWE runs in openhuman-benchmarks `results/meter.jsonl` (`deepswe10-x86-2`, `deepswe10-oh-cap`, the anko runs), using `deepseek/deepseek-v4.1-flash` via OpenRouter, provider DeepSeek: | Change between consecutive calls | Calls where the cache collapsed (cached < 50% of previous prompt) | |---|---| | System text added that this task had **never sent before** | **53 of 71** | | Switching back to system text sent earlier | 0 of 39 | | No system change | 7 of 2,421 |  That added up to **1.88M prompt tokens billed again uncached**. Examples: - `deepswe10-oh-cap/anko` seq 49: "The last call failed validation…" was added. 80,299 prompt tokens, 
  **Post-Mortem & Fix Analysis**:
  > <!-- tinysweeper:issue-triage -->  Mid-turn system messages reset DeepSeek's prompt cache to static prefix, causing repeated billing of large uncached prompt tokens (~1.88M tokens observed). This is a core cost/performance regression on the DeepSeek route with no current workaround except a code/config change (flipping a flag).  Labelled `priority: p1`. 

- **Issue #6961** (2026-10-03): **openhuman: shell sandbox writes .sandbox_stdout/.sandbox_stderr into the user's project root**
  *Symptoms*: > Found running OpenHuman on DeepSWE in tinyhumansai/openhuman-benchmarks (model `deepseek/deepseek-v4.1-flash`, reasoning high). The runs used builds older than main: about `7aebeb2af0` / `da7ad3156e`, with tinyagents `3c411b44`. Each code reference below was re-checked on main `bbf1dd5809`, and the links point there. Overview of all failures: tinyhumansai/openhuman-benchmarks#17. Re-run commands are run from an openhuman-benchmarks checkout with `vendor/openhuman` at the fix.  The shell sandbox captures command output in `.sandbox_stdout` / `.sandbox_stderr` files at the workspace root. On a coding turn that root is the user's git checkout, so the files show up in `git status` and in any `git add -A` or commit. #6947 moved oversized tool outputs out of the project; these two files are still written there on main.  ## Seen in - [`results/deepswe10-oh-cap`](https://github.com/tinyhumansai/openhuman-benchmarks/tree/main/results/deepswe10-oh-cap): `git status` in the task repos shows `?? .sandbox_stderr ?? .sandbox_stdout` next to the agent's edits. - Terminal-Bench (`tb2-sample5`, db-wal-recovery): `ls -la /app` listed `.sandbox_stderr` and `.sandbox_stdout` in the task directory.  ## Where [`crates/openhuman-core/src/sandbox/ops.rs:257-258`](https://github.com/tinyhumansai/openhuman/blob/bbf1dd5809/crates/openhuman-core/src/sandbox/ops.rs#L257-L258): `policy.workspace_root.join(".sandbox_stdout")` / `.sandbox_stderr`.  ## Suggested fix Write the capture files to OpenHuman's o

- **Issue #6960** (2026-10-04): **openhuman: mid-turn compaction drops the task's user message and labels the in-progress plan "STALE — do not act", so autonomous turns lose their goal**
  *Symptoms*: > Found running OpenHuman on DeepSWE in tinyhumansai/openhuman-benchmarks (model `deepseek/deepseek-v4.1-flash`, reasoning high). The runs used builds older than main: about `7aebeb2af0` / `da7ad3156e`, with tinyagents `3c411b44`. Each code reference below was re-checked on main `bbf1dd5809`, and the links point there. Overview of all failures: tinyhumansai/openhuman-benchmarks#17. Re-run commands are run from an openhuman-benchmarks checkout with `vendor/openhuman` at the fix.  After a mid-turn compaction, the request holds only the system prompt, the summary and the last 8 messages. The turn's own user message (the task) is gone, and the summarizer's template marks all outstanding work "STALE — do not act unless a live message asks". In a single autonomous turn no later message ever arrives, so the agent loses its goal and re-reads files until it runs out of time or calls.  The separate bug where compaction re-summarized before every call has **already been fixed on main** (tinyagents compaction-fold work, 2026-10-03). This issue is about what the agent gets back after any compaction, which is unchanged on main.  ## Seen in [`results/deepswe10-oh-cap`](https://github.com/tinyhumansai/openhuman-benchmarks/tree/main/results/deepswe10-oh-cap): | task | outcome | after compaction | |---|---|---| | koota-pair-relation-tracking | killed at 60 min, 38/38 tests fail, **no source file ever edited** | re-read `query.ts` 23×; `cat /bench/task/prompt.txt` 3× plus `find / -iname "*task*
  **Post-Mortem & Fix Analysis**:
  > <!-- tinysweeper:issue-triage -->  Mid-turn compaction drops the task's user message and marks the in-progress plan as stale, causing autonomous turns to lose their goal and fail to make progress. The root cause is in tinyagents' summarization logic and the summarizer prompt, which treat mid-turn compactions like end-of-turn summaries.  Labelled `priority: p1`. 

- **Issue #6959** (2026-10-03): **openhuman: web research budget clears every tool and forces a final answer, ending coding turns with no edits**
  *Symptoms*: > Found running OpenHuman on DeepSWE in tinyhumansai/openhuman-benchmarks (model `deepseek/deepseek-v4.1-flash`, reasoning high). The runs used builds older than main: about `7aebeb2af0` / `da7ad3156e`, with tinyagents `3c411b44`. Each code reference below was re-checked on main `bbf1dd5809`, and the links point there. Overview of all failures: tinyhumansai/openhuman-benchmarks#17. Re-run commands are run from an openhuman-benchmarks checkout with `vendor/openhuman` at the fix.  When the web-read budget runs out, `ResearchBudgetMiddleware` removes **all** tools, not just the web tools, and forces the model to answer. A coding turn then ends before any edit is made.  ## Seen in [`results/deepswe10-oh-cap`](https://github.com/tinyhumansai/openhuman-benchmarks/tree/main/results/deepswe10-oh-cap), **ytt-jsonpath-query-api**: empty patch after 13 LLM calls (2.9 min), with no "stopped early" message.  ## What happened The agent read code with `shell`, then made 9 web reads looking for an upstream implementation (1 `web_search_tool`, 8 `web_fetch`). The results were GitHub API 403, sourcegraph, and grep.app 429. The next request carried this instruction: > The direct web research budget for this turn is exhausted. Answer the user's latest request now using the results already available…  The request was sent with **`tool_count 0`** (captures 01614/01615). The model spent its whole output budget reasoning, then wrote its next `shell` call as DeepSeek markup text. That text became the

- **Issue #6958** (2026-10-04): **openhuman: orchestrator iteration cap is invisible to the model, overrides config, and its final-write round can't deliver a multi-file code change**
  *Symptoms*: > Found running OpenHuman on DeepSWE in tinyhumansai/openhuman-benchmarks (model `deepseek/deepseek-v4.1-flash`, reasoning high). The runs used builds older than main: about `7aebeb2af0` / `da7ad3156e`, with tinyagents `3c411b44`. Each code reference below was re-checked on main `bbf1dd5809`, and the links point there. Overview of all failures: tinyhumansai/openhuman-benchmarks#17. Re-run commands are run from an openhuman-benchmarks checkout with `vendor/openhuman` at the fix.  The orchestrator's iteration cap ends coding turns before the work is done. The model never sees the budget until its last two calls. The cap can't be raised through config. Its forced "final write" round asks for a one-shot file write, so a multi-file code change either produces nothing or ends up as a notes file in the user's repo.  ## Seen in - [`results/deepswe10-x86-2`](https://github.com/tinyhumansai/openhuman-benchmarks/tree/main/results/deepswe10-x86-2): OpenHuman resolved **0/10**, and **every task stopped at exactly 15 LLM calls** (about 2 min). 9/10 tasks made no source edit. (4 "patches" contained only spilled tool-output files, which #6947 has since fixed.) On the same tasks other harnesses used 52–180 calls (claude-code) and 26–187 (hermes). - [`results/deepswe10-oh-cap`](https://github.com/tinyhumansai/openhuman-benchmarks/tree/main/results/deepswe10-oh-cap) (cap raised to 200 by patching `agent.toml` in the bench Dockerfile): **narwhals-rolling-window-suite** hit the cap with no source
  **Post-Mortem & Fix Analysis**:
  > <!-- tinysweeper:issue-triage -->  Orchestrator iteration cap is invisible to the model, overrides config, and its final-write round can't deliver a multi-file code change, causing tasks to fail silently with zero output.  Labelled `priority: p1`. 

- **Issue #6956** (2026-10-03): **openhuman: goal_complete is offered in headless sessions but always fails (no active chat thread)**
  *Symptoms*: > Moved from tinyhumansai/openhuman-benchmarks. Found by running OpenHuman ([`cbbe80208a`](https://github.com/tinyhumansai/openhuman/tree/cbbe80208a0ae3edaf2a48bcd5c721832748f90e)) on Terminal-Bench in tinyhumansai/openhuman-benchmarks#1. Overview of all failures: tinyhumansai/openhuman-benchmarks#17. Source links are pinned to that commit, or to the submodule commit it records. Evidence under `results/` is in the benchmarks repo; the full request captures (`results/<run>/captures/`) stay on the bench host. `run-tbench.sh` commands run from an openhuman-benchmarks checkout.  `goal_complete` (and `goal_get`/`goal_set`) is offered to the model in headless JSON-RPC sessions, the path the benchmark uses, but every call fails with `thread goal tools require an active chat thread`. Models call it as their natural last step, so each task wastes a turn on an error.  ## Seen in (`tb4-sample5`, PR tinyhumansai/openhuman-benchmarks#1) - **atrx-vep-crispr**: the last tool call was `goal_complete` → `thread goal tools require an active chat thread`. - **payments-pipeline-fix**: the same error at message [319].  ## Where - Error returned at [`vendor/tinyagents/crates/tinyagents-graph/src/goals/tool.rs:314-330`](https://github.com/tinyhumansai/tinyagents/blob/3c411b4408de2ceb5b5d3f6df93703ec3b61c1cb/crates/tinyagents-graph/src/goals/tool.rs#L314-L330) - Exposed via [`crates/openhuman-core/src/tools/ops.rs:1159`](https://github.com/tinyhumansai/openhuman/blob/cbbe80208a0ae3edaf2a48bcd5c72183
  **Post-Mortem & Fix Analysis**:
  > <!-- tinysweeper:issue-triage -->  goal_complete is offered in headless sessions but always fails with 'no active chat thread', causing wasted turns in benchmarks  Labelled `priority: p1`. 
  > <!-- tinysweeper:issue-triage -->  goal_complete (and goal_get/goal_set) is offered in headless sessions but always fails with 'no active chat thread', causing wasted turns in benchmarks  Labelled `priority: p1`. 

- **Issue #6955** (2026-10-03): **openhuman: tinyjuice discards a tool-output summary that finished just past its 8s timeout**
  *Symptoms*: > Moved from tinyhumansai/openhuman-benchmarks. Found by running OpenHuman ([`cbbe80208a`](https://github.com/tinyhumansai/openhuman/tree/cbbe80208a0ae3edaf2a48bcd5c721832748f90e)) on Terminal-Bench in tinyhumansai/openhuman-benchmarks#1. Overview of all failures: tinyhumansai/openhuman-benchmarks#17. Source links are pinned to that commit, or to the submodule commit it records. Evidence under `results/` is in the benchmarks repo; the full request captures (`results/<run>/captures/`) stay on the bench host. `run-tbench.sh` commands run from an openhuman-benchmarks checkout.  tinyjuice throws away a tool-output summary that finished just after its 8 s deadline. The model gets `[summarization timed out — the tool output follows…]` with only the head and tail of the output, and re-reads the file piece by piece.  ## Seen in (`tb4-sample5`, PR tinyhumansai/openhuman-benchmarks#1) - **payments-pipeline-fix**: summarizing a 25 KB `cat -n worker.py` took **9,452 ms** and produced 2,413 tokens (capture `00131`, about $0.0025 paid). The timeout dropped the result (message [277]). The agent then spent **6 extra `sed -n` calls** re-reading the file. - **batched-eval-parity**: the first full source dump (68 KB) came back as `[summarization timed out — …]` (msg 5), forcing a re-read file by file.  Neither caused a reward loss, but both cost turns and tokens. The summary call is paid for and then discarded.  ## Where - [`vendor/tinyjuice/src/summarize/mod.rs:197-210`](https://github.com/tin
  **Post-Mortem & Fix Analysis**:
  > <!-- tinysweeper:issue-triage -->  tinyjuice discards summarization results that arrive just after the 8s timeout, causing wasted turns and token cost  Labelled `priority: p2`. 
  > Related failure mode, from a DeepSWE anko run: the timeout can never be met for large payloads, even though they are still sent and billed.  - The agent ran `grep -rn "invalid default argument" /`, which matched OpenHuman's own run journal under `$HOME/oh-workspace/workspace/tinyagents_store/journal/`. The output was 1.24 MB. - tinyjuice sent the whole output to the summarizer as **one request of 418,590 prompt tokens** ($0.0645, first token at 19.5 s), against the 8 s timeout. The summary was billed and thrown away. That one call was 13% of the attempt's spend.  The cause is a default mismatch. `summarizer_max_payload_tokens` defaults to **2,000,000** ([`config/schema/context.rs:75-82`](https://github.com/tinyhumansai/openhuman/blob/bbf1dd5809/crates/openhuman-core/src/config/schema/context.rs#L75-L82)), while `llm_summary_timeout_ms` is 8,000. Prefilling more than about 50–100k tokens can't finish in 8 s.  Suggested fixes: - Cap the payload at what the timeout can process (32–64k, or

- **Issue #6954** (2026-10-03): **openhuman: credential_scrub redacts ordinary source code (eos_token =, previous_token:, ...) in tool output**
  *Symptoms*: > Moved from tinyhumansai/openhuman-benchmarks. Found by running OpenHuman ([`cbbe80208a`](https://github.com/tinyhumansai/openhuman/tree/cbbe80208a0ae3edaf2a48bcd5c721832748f90e)) on Terminal-Bench in tinyhumansai/openhuman-benchmarks#1. Overview of all failures: tinyhumansai/openhuman-benchmarks#17. Source links are pinned to that commit, or to the submodule commit it records. Evidence under `results/` is in the benchmarks repo; the full request captures (`results/<run>/captures/`) stay on the bench host. `run-tbench.sh` commands run from an openhuman-benchmarks checkout.  The credential scrubber redacts ordinary source code in tool output. Any identifier *containing* `token`/`secret`/`password` followed by `:`/`=` gets mangled, and the model loses turns working around it.  ## Seen in `tb4-sample5` (PR tinyhumansai/openhuman-benchmarks#1), **batched-eval-parity**. 17 tool results were redacted, e.g.: ``` self.eos_token = "<eos*[REDACTED]" token = self*[REDACTED][int(token_id)] if token =*[REDACTED] self.unk_token: previous_token: *[REDACTED] retu*[REDACTED] score / max(token_count, 1) "mean_logprob_per_token": -4.7*[REDACTED], ``` Each came with a notice telling the model to "tell the user which values were withheld". The agent spent about 10 turns (msgs 12–36) re-printing files with `<`→`«`, `>`→`»`, `=`→`≡` substitutions to read its own code. This didn't cause the reward 0, but it costs turns on any codebase that talks about tokens (tokenizers, auth code, LLM code).  ## W
  **Post-Mortem & Fix Analysis**:
  > <!-- tinysweeper:issue-triage -->  credential_scrub redacts ordinary source code (eos_token =, previous_token:, ...) in tool output  Labelled `priority: p2`. 
  > Also seen on DeepSWE (`deepswe10-oh-cap`, anko-default-function-arguments): `credential_scrub` redacted generated Go parser code in tool output, e.g. `token = yyTo*[REDACTED][0]`, with 12 redactions at seq 105. The agent recognised them as false positives this time.

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

### Incident Patch 1: `852abb0d` (2026-10-06)
**Commit Message**: Merge pull request #7015 from CodeGhost21/fix/ci-rust-cov-node-deps

ci(lanes): install node deps for rust-core-coverage on a core-only change

**File**: `scripts/__tests__/self-hosted-lanes.test.mjs` (modified, +32/-0)
```diff
@@ -97,6 +97,38 @@ test("ex63 runs the core's unit tests under nextest; hosted keeps cargo's runner
   );
 });
 
+test("a core-only change still installs the node deps rust-core-coverage's mock backend imports", () => {
+  const coreOnly = { ...NONE, rustCore: true };
+  for (const plan of [
+    buildPlan({ profile: "ex63", areas: coreOnly, env: EX63_ENV }),
+    buildPlan({ profile: "hosted", areas: coreOnly }),
+  ]) {
+    const checks = new Map(
+      plan.lanes.flatMap((l) =>
+        l.checks.map((c) => [`${l.name}:${c.name}`, c]),
+      ),
+    );
+    const cov = checks.get("rust-cov:rust-core-coverage");
+    const install = cov.needs
+      .map((n) => checks.get(n.includes(":") ? n : `rust-cov:${n}`))
+      .find((c) => c.run === "pnpm install --frozen-lockfile");
+    assert.ok(
+      install,
+      `${plan.profile}: rust-core-coverage needs a pnpm install`,
+    );
+    assert.equal(install.when, true, `${plan.profile}: that install runs`);
+    // Exactly one install per profile: ex63 lanes share one checkout.
+    const installs = [...checks.values()].filter(
+      (c) => c.when && c.run === "pnpm install --frozen-lockfile",
+    );
+    assert.equal(installs.length, 1, plan.profile);
+  }
+  const hosted = buildPlan({ profile: "hosted", areas: coreOnly });
+  const sub = selectLanes(hosted, ["rust-cov"]);
+  assert.deepEqual(validatePlan(sub), []);
+  assert.deepEqual(orderProblems(sub), []);
+});
+
 test("doctests, tui coverage and module-gated tests are outside the PR lane", () => {
   for (const plan of plans()) {
     const cov = plan.lanes
```

**File**: `scripts/ci/self-hosted/lanes-plan.mjs` (modified, +15/-2)
```diff
@@ -204,7 +204,10 @@ export function buildPlan({ profile, areas, env = {}, isPullRequest = true }) {
       checks: [
         {
           name: "pnpm-install",
-          when: areas.frontend || areas.i18n || areas.scripts,
+          // ex63: also for a core change, so rust-core-coverage's mock backend
+          // (scripts/mock-api-server.mjs imports `ws`) can start when no
+          // frontend file changed. One install per VM: lanes share a checkout.
+          when: areas.frontend || areas.i18n || areas.scripts || (ex63 && core),
           run: "pnpm install --frozen-lockfile",
         },
         {
@@ -288,6 +291,13 @@ export function buildPlan({ profile, areas, env = {}, isPullRequest = true }) {
       targetDir: targetDir("cov"),
       env: covEnv,
       checks: [
+        // hosted: rust-cov has a runner of its own, so it installs the node
+        // deps the mock backend needs itself (ex63 reuses frontend's install).
+        {
+          name: "pnpm-install",
+          when: !ex63 && core,
+          run: "pnpm install --frozen-lockfile",
+        },
         {
           name: "test-modules",
           when: core,
@@ -303,7 +313,10 @@ export function buildPlan({ profile, areas, env = {}, isPullRequest = true }) {
         {
           name: "rust-core-coverage",
           when: core,
-          needs: ["test-modules"],
+          needs: [
+            "test-modules",
+            ex63 ? "frontend:pnpm-install" : "pnpm-install",
+          ],
           // Doctests and tui coverage run on pushes to main instead (see above).
           // ex63: the core's unit tests run under cargo-nextest, one process
           // per test and in parallel (the guest image ships cargo-nextest).
```

---

### Incident Patch 2: `d717fbfc` (2026-10-06)
**Commit Message**: Merge pull request #7014 from CodeGhost21/fix/6718-memory-deriving

fix(memory): say beliefs are still building instead of showing an empty memory (#6718)

**File**: `app/src/components/memory/MemoryLearningsTab.test.tsx` (modified, +59/-1)
```diff
@@ -5,15 +5,31 @@ import type { Hit } from '../../services/api/memoryApi';
 import { renderWithProviders } from '../../test/test-utils';
 import MemoryLearningsTab from './MemoryLearningsTab';
 
-const hoisted = vi.hoisted(() => ({ list: vi.fn(), learn: vi.fn(), forget: vi.fn() }));
+const hoisted = vi.hoisted(() => ({
+  list: vi.fn(),
+  learn: vi.fn(),
+  forget: vi.fn(),
+  jobs: vi.fn(),
+}));
 
 vi.mock('../../services/api/memoryApi', async importOriginal => ({
   ...(await importOriginal<typeof import('../../services/api/memoryApi')>()),
   memoryItemsList: (...a: unknown[]) => hoisted.list(...a),
   memoryLearn: (...a: unknown[]) => hoisted.learn(...a),
   memoryForget: (...a: unknown[]) => hoisted.forget(...a),
+  memoryJobsList: (...a: unknown[]) => hoisted.jobs(...a),
 }));
 
+function pendingBuild(id: string) {
+  return {
+    id,
+    root: 'default',
+    job: { job: 'build_beliefs' },
+    queued_at: '2026-10-06T00:00:00Z',
+    attempts: 0,
+  };
+}
+
 function learning(id: string, text: string): Hit {
   return { id, kind: 'learning', text, meta: {}, score: 0 };
 }
@@ -22,6 +38,8 @@ beforeEach(() => {
   hoisted.list.mockReset();
   hoisted.learn.mockReset();
   hoisted.forget.mockReset();
+  hoisted.jobs.mockReset();
+  hoisted.jobs.mockResolvedValue({ pending: [], history: [] });
 });
 
 describe('MemoryLearningsTab', () => {
@@ -55,6 +73,46 @@ describe('MemoryLearningsTab', () => {
     hoisted.list.mockResolvedValue({ items: [] });
     renderWithProviders(<MemoryLearningsTab />);
     expect(await screen.findByTestId('memory-learnings-empty')).toBeInTheDocument();
+    await waitFor(() => expect(hoisted.jobs).toHaveBeenCalled());
+    expect(screen.queryByTestId('memory-learnings-deriving')).not.toBeInTheDocument();
+  });
+
+  it('says beliefs are still building when the list is empty and a build is pending', async () => {
+    hoisted.list.mockResolvedValue({ items: [] });
+    hoisted.jobs.mockResolvedValue({
+      pending: [pendingBuild('j1'), { ...pendingBuild('j2'), job: { job: 'ingest_brain' } }],
+      history: [],
+    });
+    renderWithProviders(<MemoryLearningsTab />);
+    expect(await screen.findByTestId('memory-learnings-deriving')).toHaveTextContent(
+      'still building beliefs'
+    );
+    expect(screen.queryByTestId('memory-learnings-empty')).not.toBeInTheDocument();
+  });
+
+  it('keeps the plain empty state when only other jobs are pending or the queue cannot be read', async () => {
+    hoisted.list.mockResolvedValue({ items: [] });
+    hoisted.jobs.mockResolvedValue({
+      pending: [{ ...pendingBuild('j2'), job: { job: 'ingest_brain' } }],
+      history: [],
+    });
+    const { unmount } = renderWithProviders(<MemoryLearningsTab />);
+    expect(await screen.findByTestId('memory-learnings-empty')).toBeInTheDocument();
+    await waitFor(() => expect(hoisted.jobs).toHaveBeenCalled());
+    expect(screen.queryByTestId('memory-learnings-deriving')).not.toBeInTheDocument();
+    unmount();
+
+    hoisted.jobs.mockRejectedValue(new Error('core offline'));
+    renderWithProviders(<MemoryLearningsTab />);
+    expect(await screen.findByTestId('memory-learnings-empty')).toBeInTheDocument();
+    expect(screen.queryByTestId('memory-learnings-deriving')).not.toBeInTheDocument();
+  });
+
+  it('does not read the job queue when there are learnings', async () => {
+    hoisted.list.mockResolvedValue({ items: [learning('l1', 'Prefers dark mode')] });
+    renderWithProviders(<MemoryLearningsTab />);
+    await screen.findByTestId('memory-learning-l1');
+    expect(hoisted.jobs).not.toHaveBeenCalled();
   });
 
   it('pages with the cursor', async () => {
```

**File**: `app/src/components/memory/MemoryLearningsTab.tsx` (modified, +35/-1)
```diff
@@ -4,6 +4,10 @@
  * adds one with `memory_learn`, and deletes with `memory_forget`. Beliefs the
  * background builder distilled (tagged `belief`) carry a "Built belief" badge.
  *
+ * Beliefs are built by a queued background job minutes behind the writes, so
+ * an empty list while a build is pending reads as "still building", never as
+ * "no memory" (#6718).
+ *
  * debug logging: DEBUG=openhuman:memory:learnings
  */
 import debug from 'debug';
@@ -18,6 +22,7 @@ import {
   memoryErrorMessage,
   memoryForget,
   memoryItemsList,
+  memoryJobsList,
   memoryLearn,
 } from '../../services/api/memoryApi';
 import { Alert, AlertDescription, Button, Card, Label, NativeSelect, TextArea } from '../ui';
@@ -38,6 +43,7 @@ export default function MemoryLearningsTab() {
   const [kind, setKind] = useState<LearningKind>('fact');
   const [adding, setAdding] = useState(false);
   const [deleting, setDeleting] = useState<string | null>(null);
+  const [buildsPending, setBuildsPending] = useState(false);
 
   const kindLabel = (k: LearningKind): string => {
     switch (k) {
@@ -64,6 +70,28 @@ export default function MemoryLearningsTab() {
     return page;
   }, []);
 
+  // Only asked when the list is empty; a failure leaves the plain empty state.
+  const empty = items !== null && items.length === 0;
+  useEffect(() => {
+    if (!empty) return;
+    let cancelled = false;
+    memoryJobsList()
+      .then(jobs => {
+        if (cancelled) return;
+        const pending = (jobs.pending ?? []).filter(job => job.job?.job === 'build_beliefs');
+        log('empty list: %d belief build(s) pending', pending.length);
+        setBuildsPending(pending.length > 0);
+      })
+      .catch(err => {
+        if (cancelled) return;
+        log('jobs list failed: %o', err);
+        setBuildsPending(false);
+      });
+    return () => {
+      cancelled = true;
+    };
+  }, [empty]);
+
   const reload = useCallback(async () => {
     setError(null);
     try {
@@ -196,7 +224,13 @@ export default function MemoryLearningsTab() {
         <CenteredLoadingState label={t('memoryPage.loading')} />
       ) : (
         <Card title={t('memoryPage.learnings.listTitle')} data-testid="memory-learnings-list">
-          {items.length === 0 ? (
+          {items.length === 0 && buildsPending ? (
+            <p
+              className="px-4 py-3 text-sm text-content-muted"
+              data-testid="memory-learnings-deriving">
+              {t('memoryPage.learnings.deriving')}
+            </p>
+          ) : items.length === 0 ? (
             <p
               className="px-4 py-3 text-sm text-content-muted"
               data-testid="memory-learnings-empty">
```

**File**: `app/src/lib/i18n/ar.ts` (modified, +2/-0)
```diff
@@ -4914,6 +4914,8 @@ const messages: TranslationMap = {
   'memoryPage.learnings.listTitle': 'المعلومات المكتسبة',
   'memoryPage.learnings.empty':
     'لا توجد معلومات مكتسبة بعد. أضف واحدة أعلاه، أو سيضيفها وكيلك أثناء عمله معك.',
+  'memoryPage.learnings.deriving':
+    'لا شيء هنا بعد. لا تزال الذاكرة تبني المعتقدات من محادثاتك الأخيرة؛ ستظهر هنا بعد التشغيل التالي في الخلفية.',
   'memoryPage.learnings.delete': 'حذف المعلومة',
   'memoryPage.conversations.turns': '{count} أدوار',
   'memoryPage.documents.listDescription': 'تُبقيها الذاكرة متزامنة وتجيب اعتمادًا على محتواها.',
```

**File**: `app/src/lib/i18n/bn.ts` (modified, +2/-0)
```diff
@@ -5007,6 +5007,8 @@ const messages: TranslationMap = {
   'memoryPage.learnings.listTitle': 'শেখা বিষয়',
   'memoryPage.learnings.empty':
     'এখনও কোনো শেখা বিষয় নেই। উপরে একটি যোগ করুন, অথবা আপনার সঙ্গে কাজ করতে করতে আপনার এজেন্ট নিজেই যোগ করবে।',
+  'memoryPage.learnings.deriving':
+    'এখনও এখানে কিছু নেই। মেমরি এখনও আপনার সাম্প্রতিক কথোপকথন থেকে ধারণা তৈরি করছে; পরবর্তী ব্যাকগ্রাউন্ড রানের পরে সেগুলো এখানে দেখা যাবে।',
   'memoryPage.learnings.delete': 'শেখা বিষয় মুছুন',
   'memoryPage.conversations.turns': '{count}টি টার্ন',
   'memoryPage.documents.listDescription':
```

**File**: `app/src/lib/i18n/de.ts` (modified, +2/-0)
```diff
@@ -5147,6 +5147,8 @@ const messages: TranslationMap = {
   'memoryPage.learnings.listTitle': 'Erkenntnisse',
   'memoryPage.learnings.empty':
     'Noch keine Erkenntnisse. Füge oben eine hinzu, oder dein Agent ergänzt sie bei der Zusammenarbeit mit dir.',
+  'memoryPage.learnings.deriving':
+    'Noch nichts da. Das Gedächtnis baut noch Überzeugungen aus deinen letzten Unterhaltungen auf; sie erscheinen hier nach dem nächsten Hintergrundlauf.',
   'memoryPage.learnings.delete': 'Erkenntnis löschen',
   'memoryPage.conversations.turns': '{count} Runden',
   'memoryPage.documents.listDescription':
```

**File**: `app/src/lib/i18n/en.ts` (modified, +2/-0)
```diff
@@ -5285,6 +5285,8 @@ const en: TranslationMap = {
   'memoryPage.learnings.listTitle': 'Learnings',
   'memoryPage.learnings.empty':
     'No learnings yet. Add one above, or your agent will add them as it works with you.',
+  'memoryPage.learnings.deriving':
+    'Nothing here yet. Memory is still building beliefs from your recent conversations; they appear here after the next background run.',
   'memoryPage.learnings.delete': 'Delete learning',
   'memoryPage.conversations.turns': '{count} turns',
   'memoryPage.documents.listDescription':
```

**File**: `app/src/lib/i18n/es.ts` (modified, +2/-0)
```diff
@@ -5100,6 +5100,8 @@ const messages: TranslationMap = {
   'memoryPage.learnings.listTitle': 'Aprendizajes',
   'memoryPage.learnings.empty':
     'Aún no hay aprendizajes. Añade uno arriba o tu agente los añadirá a medida que trabaje contigo.',
+  'memoryPage.learnings.deriving':
+    'Aún no hay nada. La memoria todavía está construyendo creencias a partir de tus conversaciones recientes; aparecerán aquí tras la próxima ejecución en segundo plano.',
   'memoryPage.learnings.delete': 'Eliminar aprendizaje',
   'memoryPage.conversations.turns': '{count} turnos',
   'memoryPage.documents.listDescription':
```

**File**: `app/src/lib/i18n/fr.ts` (modified, +2/-0)
```diff
@@ -5125,6 +5125,8 @@ const messages: TranslationMap = {
   'memoryPage.learnings.listTitle': 'Acquis',
   'memoryPage.learnings.empty':
     "Aucun acquis pour l'instant. Ajoutez-en un ci-dessus, ou votre agent en ajoutera au fil de votre travail commun.",
+  'memoryPage.learnings.deriving':
+    "Rien pour l'instant. La mémoire construit encore des croyances à partir de vos conversations récentes ; elles apparaîtront ici après la prochaine exécution en arrière-plan.",
   'memoryPage.learnings.delete': "Supprimer l'acquis",
   'memoryPage.conversations.turns': '{count} échanges',
   'memoryPage.documents.listDescription':
```

---

### Incident Patch 3: `041c75c6` (2026-10-05)
**Commit Message**: Merge pull request #7012 from CodeGhost21/chore/bump-tinymemory-legacy-taint

chore(vendor): bump tinymemory for the legacy import taint fix

**File**: `vendor/tinymemory` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 4b1832311fce41152ce143e7ce209e62f82c6add
+Subproject commit 8d9a24f7a9f6eda23c80f14b4c3c0656218d1208
```

---

### Incident Patch 4: `fcd0fd7a` (2026-10-05)
**Commit Message**: Merge pull request #7011 from CodeGhost21/fix/7005-memory-import-credits

fix(memory): stop a v1 import on credits or outage instead of skipping every item

**File**: `app/src/components/memory/MemoryImportBanner.test.tsx` (modified, +26/-0)
```diff
@@ -84,6 +84,32 @@ describe('MemoryImportBanner', () => {
     );
   });
 
+  it('resumes a failed import through the consent dialog', async () => {
+    hoisted.status.mockResolvedValue({
+      state: { phase: 'error', imported: 2, total: 9, error: 'not enough credits to import' },
+    });
+    hoisted.start.mockResolvedValue({ state: { phase: 'running', imported: 2, total: 9 } });
+    renderWithProviders(<MemoryImportBanner engineLabel="TinyHumans" />);
+
+    fireEvent.click(await screen.findByTestId('memory-import-resume'));
+    expect(screen.getByTestId('memory-import-consent')).toBeInTheDocument();
+    expect(hoisted.start).not.toHaveBeenCalled();
+
+    fireEvent.click(screen.getByTestId('memory-import-confirm'));
+    expect(await screen.findByTestId('memory-import-running')).toHaveTextContent(
+      '2 of 9 items imported'
+    );
+    expect(hoisted.start).toHaveBeenCalledTimes(1);
+    expect(screen.queryByTestId('memory-import-resume')).not.toBeInTheDocument();
+  });
+
+  it('offers no resume while an import is running', async () => {
+    hoisted.status.mockResolvedValue({ state: { phase: 'running', imported: 1, total: 9 } });
+    renderWithProviders(<MemoryImportBanner engineLabel="TinyHumans" />);
+    expect(await screen.findByTestId('memory-import-running')).toBeInTheDocument();
+    expect(screen.queryByTestId('memory-import-resume')).not.toBeInTheDocument();
+  });
+
   it('shows a start failure', async () => {
     hoisted.start.mockRejectedValue(new Error('UNAUTHORIZED: sign in again'));
     renderWithProviders(<MemoryImportBanner engineLabel="TinyHumans" />);
```

**File**: `app/src/components/memory/MemoryImportBanner.tsx` (modified, +12/-0)
```diff
@@ -153,6 +153,18 @@ export default function MemoryImportBanner({ engineLabel }: MemoryImportBannerPr
                     total: state.total,
                   })}
             </AlertDescription>
+            {state.phase === 'error' && (
+              // The core keeps the checkpoint, so starting again resumes where
+              // the import stopped; it still goes through the consent dialog.
+              <Button
+                type="button"
+                size="sm"
+                variant="primary"
+                data-testid="memory-import-resume"
+                onClick={() => setConsentOpen(true)}>
+                {t('memoryPage.import.resume')}
+              </Button>
+            )}
           </div>
         </Alert>
       )}
```

**File**: `app/src/lib/i18n/ar.ts` (modified, +1/-0)
```diff
@@ -5085,6 +5085,7 @@ const messages: TranslationMap = {
   'memoryPage.import.running': 'جارٍ استيراد الذاكرة السابقة…',
   'memoryPage.import.done': 'تم استيراد الذاكرة السابقة',
   'memoryPage.import.failed': 'فشل الاستيراد',
+  'memoryPage.import.resume': 'استئناف الاستيراد',
   'memoryPage.import.progress': 'تم استيراد {imported} من {total} عنصر',
 };
 
```

**File**: `app/src/lib/i18n/bn.ts` (modified, +1/-0)
```diff
@@ -5182,6 +5182,7 @@ const messages: TranslationMap = {
   'memoryPage.import.running': 'আগের মেমোরি ইমপোর্ট হচ্ছে…',
   'memoryPage.import.done': 'আগের মেমোরি ইমপোর্ট হয়েছে',
   'memoryPage.import.failed': 'ইমপোর্ট ব্যর্থ হয়েছে',
+  'memoryPage.import.resume': 'ইমপোর্ট আবার চালু করুন',
   'memoryPage.import.progress': '{total}টির মধ্যে {imported}টি আইটেম ইমপোর্ট হয়েছে',
 };
 
```

**File**: `app/src/lib/i18n/de.ts` (modified, +1/-0)
```diff
@@ -5325,6 +5325,7 @@ const messages: TranslationMap = {
   'memoryPage.import.running': 'Früheres Gedächtnis wird importiert…',
   'memoryPage.import.done': 'Früheres Gedächtnis importiert',
   'memoryPage.import.failed': 'Import fehlgeschlagen',
+  'memoryPage.import.resume': 'Import fortsetzen',
   'memoryPage.import.progress': '{imported} von {total} Elementen importiert',
 };
 
```

**File**: `app/src/lib/i18n/en.ts` (modified, +1/-0)
```diff
@@ -5459,6 +5459,7 @@ const en: TranslationMap = {
   'memoryPage.import.running': 'Importing previous memory…',
   'memoryPage.import.done': 'Previous memory imported',
   'memoryPage.import.failed': 'Import failed',
+  'memoryPage.import.resume': 'Resume import',
   'memoryPage.import.progress': '{imported} of {total} items imported',
 };
 
```

**File**: `app/src/lib/i18n/es.ts` (modified, +1/-0)
```diff
@@ -5278,6 +5278,7 @@ const messages: TranslationMap = {
   'memoryPage.import.running': 'Importando memoria anterior…',
   'memoryPage.import.done': 'Memoria anterior importada',
   'memoryPage.import.failed': 'Error al importar',
+  'memoryPage.import.resume': 'Reanudar importación',
   'memoryPage.import.progress': '{imported} de {total} elementos importados',
 };
 
```

**File**: `app/src/lib/i18n/fr.ts` (modified, +1/-0)
```diff
@@ -5303,6 +5303,7 @@ const messages: TranslationMap = {
   'memoryPage.import.running': "Importation de l'ancienne mémoire…",
   'memoryPage.import.done': 'Ancienne mémoire importée',
   'memoryPage.import.failed': "Échec de l'importation",
+  'memoryPage.import.resume': "Reprendre l'importation",
   'memoryPage.import.progress': '{imported} éléments sur {total} importés',
 };
 
```

---

### Incident Patch 5: `3d23a5cd` (2026-10-05)
**Commit Message**: style(memory): prettier the memoryApi refusal test from #7013

**File**: `app/src/services/api/memoryApi.test.ts` (modified, +1/-3)
```diff
@@ -211,9 +211,7 @@ describe('helpers', () => {
     );
     // A rejected key and an engine fault keep their own message, and without
     // `t` nothing changes.
-    expect(memoryErrorMessage(new Error('UNAUTHORIZED: bad key'), t)).toBe(
-      'UNAUTHORIZED: bad key'
-    );
+    expect(memoryErrorMessage(new Error('UNAUTHORIZED: bad key'), t)).toBe('UNAUTHORIZED: bad key');
     expect(memoryErrorMessage({ message: 'boom', data: { code: 'ENGINE' } }, t)).toBe('boom');
     expect(memoryErrorMessage(credits)).toBe(credits.message);
   });
```

---

### Incident Patch 6: `a981a766` (2026-10-05)
**Commit Message**: fix(memory): say beliefs are still building instead of showing an empty memory (#6718)

Explicit writes are visible on return, but beliefs are built by a queued
job at least build_delay_secs behind them. An empty Learnings list while a
build_beliefs job was pending read as "No learnings yet". It now says
beliefs are still being built, in all 14 locales. The job queue is read only
when the list is empty, and a failed read keeps the plain empty state.

**File**: `app/src/components/memory/MemoryLearningsTab.test.tsx` (modified, +59/-1)
```diff
@@ -5,15 +5,31 @@ import type { Hit } from '../../services/api/memoryApi';
 import { renderWithProviders } from '../../test/test-utils';
 import MemoryLearningsTab from './MemoryLearningsTab';
 
-const hoisted = vi.hoisted(() => ({ list: vi.fn(), learn: vi.fn(), forget: vi.fn() }));
+const hoisted = vi.hoisted(() => ({
+  list: vi.fn(),
+  learn: vi.fn(),
+  forget: vi.fn(),
+  jobs: vi.fn(),
+}));
 
 vi.mock('../../services/api/memoryApi', async importOriginal => ({
   ...(await importOriginal<typeof import('../../services/api/memoryApi')>()),
   memoryItemsList: (...a: unknown[]) => hoisted.list(...a),
   memoryLearn: (...a: unknown[]) => hoisted.learn(...a),
   memoryForget: (...a: unknown[]) => hoisted.forget(...a),
+  memoryJobsList: (...a: unknown[]) => hoisted.jobs(...a),
 }));
 
+function pendingBuild(id: string) {
+  return {
+    id,
+    root: 'default',
+    job: { job: 'build_beliefs' },
+    queued_at: '2026-10-06T00:00:00Z',
+    attempts: 0,
+  };
+}
+
 function learning(id: string, text: string): Hit {
   return { id, kind: 'learning', text, meta: {}, score: 0 };
 }
@@ -22,6 +38,8 @@ beforeEach(() => {
   hoisted.list.mockReset();
   hoisted.learn.mockReset();
   hoisted.forget.mockReset();
+  hoisted.jobs.mockReset();
+  hoisted.jobs.mockResolvedValue({ pending: [], history: [] });
 });
 
 describe('MemoryLearningsTab', () => {
@@ -55,6 +73,46 @@ describe('MemoryLearningsTab', () => {
     hoisted.list.mockResolvedValue({ items: [] });
     renderWithProviders(<MemoryLearningsTab />);
     expect(await screen.findByTestId('memory-learnings-empty')).toBeInTheDocument();
+    await waitFor(() => expect(hoisted.jobs).toHaveBeenCalled());
+    expect(screen.queryByTestId('memory-learnings-deriving')).not.toBeInTheDocument();
+  });
+
+  it('says beliefs are still building when the list is empty and a build is pending', async () => {
+    hoisted.list.mockResolvedValue({ items: [] });
+    hoisted.jobs.mockResolvedValue({
+      pending: [pendingBuild('j1'), { ...pendingBuild('j2'), job: { job: 'ingest_brain' } }],
+      history: [],
+    });
+    renderWithProviders(<MemoryLearningsTab />);
+    expect(await screen.findByTestId('memory-learnings-deriving')).toHaveTextContent(
+      'still building beliefs'
+    );
+    expect(screen.queryByTestId('memory-learnings-empty')).not.toBeInTheDocument();
+  });
+
+  it('keeps the plain empty state when only other jobs are pending or the queue cannot be read', async () => {
+    hoisted.list.mockResolvedValue({ items: [] });
+    hoisted.jobs.mockResolvedValue({
+      pending: [{ ...pendingBuild('j2'), job: { job: 'ingest_brain' } }],
+      history: [],
+    });
+    const { unmount } = renderWithProviders(<MemoryLearningsTab />);
+    expect(await screen.findByTestId('memory-learnings-empty')).toBeInTheDocument();
+    await waitFor(() => expect(hoisted.jobs).toHaveBeenCalled());
+    expect(screen.queryByTestId('memory-learnings-deriving')).not.toBeInTheDocument();
+    unmount();
+
+    hoisted.jobs.mockRejectedValue(new Error('core offline'));
+    renderWithProviders(<MemoryLearningsTab />);
+    expect(await screen.findByTestId('memory-learnings-empty')).toBeInTheDocument();
+    expect(screen.queryByTestId('memory-learnings-deriving')).not.toBeInTheDocument();
+  });
+
+  it('does not read the job queue when there are learnings', async () => {
+    hoisted.list.mockResolvedValue({ items: [learning('l1', 'Prefers dark mode')] });
+    renderWithProviders(<MemoryLearningsTab />);
+    await screen.findByTestId('memory-learning-l1');
+    expect(hoisted.jobs).not.toHaveBeenCalled();
   });
 
   it('pages with the cursor', async () => {
```

**File**: `app/src/components/memory/MemoryLearningsTab.tsx` (modified, +35/-1)
```diff
@@ -4,6 +4,10 @@
  * adds one with `memory_learn`, and deletes with `memory_forget`. Beliefs the
  * background builder distilled (tagged `belief`) carry a "Built belief" badge.
  *
+ * Beliefs are built by a queued background job minutes behind the writes, so
+ * an empty list while a build is pending reads as "still building", never as
+ * "no memory" (#6718).
+ *
  * debug logging: DEBUG=openhuman:memory:learnings
  */
 import debug from 'debug';
@@ -18,6 +22,7 @@ import {
   memoryErrorMessage,
   memoryForget,
   memoryItemsList,
+  memoryJobsList,
   memoryLearn,
 } from '../../services/api/memoryApi';
 import { Alert, AlertDescription, Button, Card, Label, NativeSelect, TextArea } from '../ui';
@@ -38,6 +43,7 @@ export default function MemoryLearningsTab() {
   const [kind, setKind] = useState<LearningKind>('fact');
   const [adding, setAdding] = useState(false);
   const [deleting, setDeleting] = useState<string | null>(null);
+  const [buildsPending, setBuildsPending] = useState(false);
 
   const kindLabel = (k: LearningKind): string => {
     switch (k) {
@@ -64,6 +70,28 @@ export default function MemoryLearningsTab() {
     return page;
   }, []);
 
+  // Only asked when the list is empty; a failure leaves the plain empty state.
+  const empty = items !== null && items.length === 0;
+  useEffect(() => {
+    if (!empty) return;
+    let cancelled = false;
+    memoryJobsList()
+      .then(jobs => {
+        if (cancelled) return;
+        const pending = (jobs.pending ?? []).filter(job => job.job?.job === 'build_beliefs');
+        log('empty list: %d belief build(s) pending', pending.length);
+        setBuildsPending(pending.length > 0);
+      })
+      .catch(err => {
+        if (cancelled) return;
+        log('jobs list failed: %o', err);
+        setBuildsPending(false);
+      });
+    return () => {
+      cancelled = true;
+    };
+  }, [empty]);
+
   const reload = useCallback(async () => {
     setError(null);
     try {
@@ -196,7 +224,13 @@ export default function MemoryLearningsTab() {
         <CenteredLoadingState label={t('memoryPage.loading')} />
       ) : (
         <Card title={t('memoryPage.learnings.listTitle')} data-testid="memory-learnings-list">
-          {items.length === 0 ? (
+          {items.length === 0 && buildsPending ? (
+            <p
+              className="px-4 py-3 text-sm text-content-muted"
+              data-testid="memory-learnings-deriving">
+              {t('memoryPage.learnings.deriving')}
+            </p>
+          ) : items.length === 0 ? (
             <p
               className="px-4 py-3 text-sm text-content-muted"
               data-testid="memory-learnings-empty">
```

**File**: `app/src/lib/i18n/ar.ts` (modified, +2/-0)
```diff
@@ -4914,6 +4914,8 @@ const messages: TranslationMap = {
   'memoryPage.learnings.listTitle': 'المعلومات المكتسبة',
   'memoryPage.learnings.empty':
     'لا توجد معلومات مكتسبة بعد. أضف واحدة أعلاه، أو سيضيفها وكيلك أثناء عمله معك.',
+  'memoryPage.learnings.deriving':
+    'لا شيء هنا بعد. لا تزال الذاكرة تبني المعتقدات من محادثاتك الأخيرة؛ ستظهر هنا بعد التشغيل التالي في الخلفية.',
   'memoryPage.learnings.delete': 'حذف المعلومة',
   'memoryPage.conversations.turns': '{count} أدوار',
   'memoryPage.documents.listDescription': 'تُبقيها الذاكرة متزامنة وتجيب اعتمادًا على محتواها.',
```

**File**: `app/src/lib/i18n/bn.ts` (modified, +2/-0)
```diff
@@ -5007,6 +5007,8 @@ const messages: TranslationMap = {
   'memoryPage.learnings.listTitle': 'শেখা বিষয়',
   'memoryPage.learnings.empty':
     'এখনও কোনো শেখা বিষয় নেই। উপরে একটি যোগ করুন, অথবা আপনার সঙ্গে কাজ করতে করতে আপনার এজেন্ট নিজেই যোগ করবে।',
+  'memoryPage.learnings.deriving':
+    'এখনও এখানে কিছু নেই। মেমরি এখনও আপনার সাম্প্রতিক কথোপকথন থেকে ধারণা তৈরি করছে; পরবর্তী ব্যাকগ্রাউন্ড রানের পরে সেগুলো এখানে দেখা যাবে।',
   'memoryPage.learnings.delete': 'শেখা বিষয় মুছুন',
   'memoryPage.conversations.turns': '{count}টি টার্ন',
   'memoryPage.documents.listDescription':
```

**File**: `app/src/lib/i18n/de.ts` (modified, +2/-0)
```diff
@@ -5147,6 +5147,8 @@ const messages: TranslationMap = {
   'memoryPage.learnings.listTitle': 'Erkenntnisse',
   'memoryPage.learnings.empty':
     'Noch keine Erkenntnisse. Füge oben eine hinzu, oder dein Agent ergänzt sie bei der Zusammenarbeit mit dir.',
+  'memoryPage.learnings.deriving':
+    'Noch nichts da. Das Gedächtnis baut noch Überzeugungen aus deinen letzten Unterhaltungen auf; sie erscheinen hier nach dem nächsten Hintergrundlauf.',
   'memoryPage.learnings.delete': 'Erkenntnis löschen',
   'memoryPage.conversations.turns': '{count} Runden',
   'memoryPage.documents.listDescription':
```

**File**: `app/src/lib/i18n/en.ts` (modified, +2/-0)
```diff
@@ -5285,6 +5285,8 @@ const en: TranslationMap = {
   'memoryPage.learnings.listTitle': 'Learnings',
   'memoryPage.learnings.empty':
     'No learnings yet. Add one above, or your agent will add them as it works with you.',
+  'memoryPage.learnings.deriving':
+    'Nothing here yet. Memory is still building beliefs from your recent conversations; they appear here after the next background run.',
   'memoryPage.learnings.delete': 'Delete learning',
   'memoryPage.conversations.turns': '{count} turns',
   'memoryPage.documents.listDescription':
```

**File**: `app/src/lib/i18n/es.ts` (modified, +2/-0)
```diff
@@ -5100,6 +5100,8 @@ const messages: TranslationMap = {
   'memoryPage.learnings.listTitle': 'Aprendizajes',
   'memoryPage.learnings.empty':
     'Aún no hay aprendizajes. Añade uno arriba o tu agente los añadirá a medida que trabaje contigo.',
+  'memoryPage.learnings.deriving':
+    'Aún no hay nada. La memoria todavía está construyendo creencias a partir de tus conversaciones recientes; aparecerán aquí tras la próxima ejecución en segundo plano.',
   'memoryPage.learnings.delete': 'Eliminar aprendizaje',
   'memoryPage.conversations.turns': '{count} turnos',
   'memoryPage.documents.listDescription':
```

**File**: `app/src/lib/i18n/fr.ts` (modified, +2/-0)
```diff
@@ -5125,6 +5125,8 @@ const messages: TranslationMap = {
   'memoryPage.learnings.listTitle': 'Acquis',
   'memoryPage.learnings.empty':
     "Aucun acquis pour l'instant. Ajoutez-en un ci-dessus, ou votre agent en ajoutera au fil de votre travail commun.",
+  'memoryPage.learnings.deriving':
+    "Rien pour l'instant. La mémoire construit encore des croyances à partir de vos conversations récentes ; elles apparaîtront ici après la prochaine exécution en arrière-plan.",
   'memoryPage.learnings.delete': "Supprimer l'acquis",
   'memoryPage.conversations.turns': '{count} échanges',
   'memoryPage.documents.listDescription':
```

---

### Incident Patch 7: `07683d80` (2026-10-05)
**Commit Message**: ci: retrigger after a mock-backend startup timeout

memory_v2_e2e failed in CI Fast before any test ran: the Node mock
backend did not become healthy within 20s. The same 15 tests pass locally
on this pin.



---

### Incident Patch 8: `17082cc0` (2026-10-05)
**Commit Message**: Merge pull request #7013 from CodeGhost21/fix/6718-memory-stabilise

fix(memory): tell a credit refusal and an outage apart from an empty memory (#6718)

**File**: `app/src/components/memory/MemoryAskTab.tsx` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ export default function MemoryAskTab({ fetchModes }: MemoryAskTabProps) {
       }
     } catch (err) {
       log('%s failed: %o', raw ? 'fetch' : 'recall', err);
-      setError(memoryErrorMessage(err));
+      setError(memoryErrorMessage(err, t));
     } finally {
       setBusy(false);
     }
```

**File**: `app/src/components/memory/MemoryBackgroundTab.tsx` (modified, +5/-5)
```diff
@@ -44,12 +44,12 @@ export default function MemoryBackgroundTab() {
       setError(null);
     } catch (err) {
       log('jobs_list failed: %o', err);
-      setError(memoryErrorMessage(err));
+      setError(memoryErrorMessage(err, t));
       setJobs(prev => prev ?? { pending: [], history: [] });
     } finally {
       setRefreshing(false);
     }
-  }, []);
+  }, [t]);
 
   useEffect(() => {
     let cancelled = false;
@@ -60,13 +60,13 @@ export default function MemoryBackgroundTab() {
       .catch(err => {
         if (cancelled) return;
         log('jobs_list failed: %o', err);
-        setError(memoryErrorMessage(err));
+        setError(memoryErrorMessage(err, t));
         setJobs({ pending: [], history: [] });
       });
     return () => {
       cancelled = true;
     };
-  }, []);
+  }, [t]);
 
   const run = async (id?: string) => {
     const key = id ?? '*';
@@ -80,7 +80,7 @@ export default function MemoryBackgroundTab() {
       await reload();
     } catch (err) {
       log('jobs_run failed: %o', err);
-      setError(memoryErrorMessage(err));
+      setError(memoryErrorMessage(err, t));
     } finally {
       setRunning(prev => {
         const next = new Set(prev);
```

**File**: `app/src/components/memory/MemoryBrainSearch.tsx` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ export default function MemoryBrainSearch({ sources }: MemoryBrainSearchProps) {
       setHits(res.hits ?? []);
     } catch (err) {
       log('search failed: %o', err);
-      setError(memoryErrorMessage(err));
+      setError(memoryErrorMessage(err, t));
     } finally {
       setBusy(false);
     }
```

**File**: `app/src/components/memory/MemoryBrainTab.tsx` (modified, +6/-6)
```diff
@@ -51,10 +51,10 @@ export default function MemoryBrainTab() {
       setError(null);
     } catch (err) {
       log('brain_sources failed: %o', err);
-      setError(memoryErrorMessage(err));
+      setError(memoryErrorMessage(err, t));
       setBrain(prev => prev ?? { root: '', sources: [], unfiled: 0 });
     }
-  }, []);
+  }, [t]);
 
   useEffect(() => {
     let cancelled = false;
@@ -67,13 +67,13 @@ export default function MemoryBrainTab() {
       .catch(err => {
         if (cancelled) return;
         log('brain_sources failed: %o', err);
-        setError(memoryErrorMessage(err));
+        setError(memoryErrorMessage(err, t));
         setBrain({ root: '', sources: [], unfiled: 0 });
       });
     return () => {
       cancelled = true;
     };
-  }, []);
+  }, [t]);
 
   const ingest = async (req: BrainIngestRequest): Promise<boolean> => {
     setSaving(true);
@@ -91,7 +91,7 @@ export default function MemoryBrainTab() {
       return true;
     } catch (err) {
       log('brain_ingest failed: %o', err);
-      setAddError(memoryErrorMessage(err));
+      setAddError(memoryErrorMessage(err, t));
       return false;
     } finally {
       setSaving(false);
@@ -117,7 +117,7 @@ export default function MemoryBrainTab() {
       await reload();
     } catch (err) {
       log('brain_forget failed: %o', err);
-      setError(memoryErrorMessage(err));
+      setError(memoryErrorMessage(err, t));
       setForgetTarget(null);
     } finally {
       setSaving(false);
```

**File**: `app/src/components/memory/MemoryConversationsBackfill.tsx` (modified, +5/-5)
```diff
@@ -47,9 +47,9 @@ export default function MemoryConversationsBackfill() {
       setView(next);
     } catch (err) {
       log('status failed: %o', err);
-      setError(memoryErrorMessage(err));
+      setError(memoryErrorMessage(err, t));
     }
-  }, []);
+  }, [t]);
 
   useEffect(() => {
     let cancelled = false;
@@ -60,12 +60,12 @@ export default function MemoryConversationsBackfill() {
       .catch(err => {
         if (cancelled) return;
         log('status failed: %o', err);
-        setError(memoryErrorMessage(err));
+        setError(memoryErrorMessage(err, t));
       });
     return () => {
       cancelled = true;
     };
-  }, []);
+  }, [t]);
 
   const running = view?.state.phase === 'running';
   useEffect(() => {
@@ -83,7 +83,7 @@ export default function MemoryConversationsBackfill() {
       setView(next);
     } catch (err) {
       log('start failed: %o', err);
-      setError(memoryErrorMessage(err));
+      setError(memoryErrorMessage(err, t));
     } finally {
       setStarting(false);
       setConsentOpen(false);
```

**File**: `app/src/components/memory/MemoryConversationsTab.tsx` (modified, +26/-23)
```diff
@@ -50,21 +50,21 @@ export default function MemoryConversationsTab() {
         setPolicy(got.value);
       } else {
         log('policy_get failed: %o', got.reason);
-        setError(memoryErrorMessage(got.reason));
+        setError(memoryErrorMessage(got.reason, t));
       }
       if (list.status === 'fulfilled') {
         log('agents: %d', list.value.agents?.length ?? 0);
         setAgents(list.value.agents ?? []);
       } else {
         log('agents_list failed: %o', list.reason);
-        setError(prev => prev ?? memoryErrorMessage(list.reason));
+        setError(prev => prev ?? memoryErrorMessage(list.reason, t));
         setAgents([]);
       }
     });
     return () => {
       cancelled = true;
     };
-  }, []);
+  }, [t]);
 
   const setLogging = async (next: boolean) => {
     setSaving(true);
@@ -74,31 +74,34 @@ export default function MemoryConversationsTab() {
       setPolicy(await memoryPolicySet({ log_conversations: next }));
     } catch (err) {
       log('policy_set failed: %o', err);
-      setError(memoryErrorMessage(err));
+      setError(memoryErrorMessage(err, t));
     } finally {
       setSaving(false);
     }
   };
 
-  const loadItems = useCallback(async (agentId: string, after: string | null) => {
-    setLoadingItems(true);
-    try {
-      const page = await memoryItemsList({
-        filter: { kinds: ['conversation'], agent_id: agentId },
-        limit: PAGE_SIZE,
-        cursor: after ?? undefined,
-      });
-      log('items: agent=%s n=%d more=%s', agentId, page.items?.length ?? 0, !!page.next_cursor);
-      setItems(prev => [...(after ? (prev ?? []) : []), ...(page.items ?? [])]);
-      setCursor(page.next_cursor ?? null);
-    } catch (err) {
-      log('items_list failed: %o', err);
-      setError(memoryErrorMessage(err));
-      setItems(prev => prev ?? []);
-    } finally {
-      setLoadingItems(false);
-    }
-  }, []);
+  const loadItems = useCallback(
+    async (agentId: string, after: string | null) => {
+      setLoadingItems(true);
+      try {
+        const page = await memoryItemsList({
+          filter: { kinds: ['conversation'], agent_id: agentId },
+          limit: PAGE_SIZE,
+          cursor: after ?? undefined,
+        });
+        log('items: agent=%s n=%d more=%s', agentId, page.items?.length ?? 0, !!page.next_cursor);
+        setItems(prev => [...(after ? (prev ?? []) : []), ...(page.items ?? [])]);
+        setCursor(page.next_cursor ?? null);
+      } catch (err) {
+        log('items_list failed: %o', err);
+        setError(memoryErrorMessage(err, t));
+        setItems(prev => prev ?? []);
+      } finally {
+        setLoadingItems(false);
+      }
+    },
+    [t]
+  );
 
   const toggleAgent = (agentId: string) => {
     if (openAgent === agentId) {
```

**File**: `app/src/components/memory/MemoryEngineTab.tsx` (modified, +4/-4)
```diff
@@ -64,12 +64,12 @@ export default function MemoryEngineTab({ state, onStateChange, embedded }: Memo
       .catch(err => {
         if (cancelled) return;
         log('engines list failed: %o', err);
-        setLoadError(memoryErrorMessage(err));
+        setLoadError(memoryErrorMessage(err, t));
       });
     return () => {
       cancelled = true;
     };
-  }, []);
+  }, [t]);
 
   const select = useCallback(
     async (req: EngineSetRequest): Promise<boolean> => {
@@ -82,13 +82,13 @@ export default function MemoryEngineTab({ state, onStateChange, embedded }: Memo
         return true;
       } catch (err) {
         log('engine set failed: %o', err);
-        setSaveError(memoryErrorMessage(err));
+        setSaveError(memoryErrorMessage(err, t));
         return false;
       } finally {
         setSaving(false);
       }
     },
-    [onStateChange]
+    [onStateChange, t]
   );
 
   const activeId = state?.engine ?? null;
```

**File**: `app/src/components/memory/MemoryExplorerTab.tsx` (modified, +5/-5)
```diff
@@ -72,12 +72,12 @@ export default function MemoryExplorerTab() {
       .catch(err => {
         if (cancelled) return;
         log('explore failed: %o', err);
-        setError(memoryErrorMessage(err));
+        setError(memoryErrorMessage(err, t));
       });
     return () => {
       cancelled = true;
     };
-  }, [facet, path, reloadKey]);
+  }, [facet, path, reloadKey, t]);
 
   useEffect(() => {
     let cancelled = false;
@@ -90,13 +90,13 @@ export default function MemoryExplorerTab() {
       .catch(err => {
         if (cancelled) return;
         log('list failed: %o', err);
-        setError(memoryErrorMessage(err));
+        setError(memoryErrorMessage(err, t));
         setItems([]);
       });
     return () => {
       cancelled = true;
     };
-  }, [path, reloadKey]);
+  }, [path, reloadKey, t]);
 
   const goTo = useCallback((next: PathStep[]) => {
     setError(null);
@@ -114,7 +114,7 @@ export default function MemoryExplorerTab() {
       setItems(prev => [...(prev ?? []), ...(next.items ?? [])]);
       setCursor(next.next_cursor ?? null);
     } catch (err) {
-      setError(memoryErrorMessage(err));
+      setError(memoryErrorMessage(err, t));
     } finally {
       setLoadingMore(false);
     }
```

---

### Incident Patch 9: `f64de712` (2026-10-05)
**Commit Message**: Merge pull request #7008 from YellowSnnowmann/fix/7000-computer-phase0

fix(computer): make TinyComputer browser tasks runnable from the app

**File**: `.env.example` (modified, +10/-0)
```diff
@@ -140,6 +140,16 @@ OPENHUMAN_TEMPERATURE=0.7
 # ---------------------------------------------------------------------------
 # [optional] Default: 0
 OPENHUMAN_BROWSER_ALLOW_ALL=0
+# [optional] Trace TinyComputer runs, as `[computer] trace = true` does: every
+# browser task records its decisions and keeps its full report, and desktop
+# commands are traced, under <workspace>/state/computer/. Reports hold page
+# text. Default: 0
+OPENHUMAN_COMPUTER_TRACE=0
+# [optional] TinyComputer's own debug journal, read by the module inside this
+# process: every Jev call with its latency, and the wall time of each decision,
+# action and step, written under this directory (1 = ./.jev-journal). Read it
+# with tinycomputer's `jev_journal` example. Off when unset.
+# TINYCOMPUTER_JEV_JOURNAL=
 # [optional] Default: 0
 OPENHUMAN_LOG_PROMPTS=0
 # [optional] Enable reasoning mode
```

**File**: `app/src/components/settings/panels/BrowserConnectionsPanel.test.tsx` (modified, +53/-3)
```diff
@@ -64,7 +64,7 @@ describe('BrowserConnectionsPanel', () => {
       )
     );
     await waitFor(() => expect(screen.getByText('connections.browser.testBrowser')).toBeEnabled());
-    mocks.rpc.mockResolvedValueOnce({ result: { module_ready: true, chrome_ready: true } });
+    mocks.rpc.mockResolvedValueOnce({ module_ready: true, chrome_ready: true });
     fireEvent.click(screen.getByText('connections.browser.testBrowser'));
     await waitFor(() =>
       expect(mocks.rpc).toHaveBeenCalledWith({
@@ -131,10 +131,58 @@ describe('BrowserConnectionsPanel', () => {
     );
   });
 
+  it('sends only the accepted fields when the config carries legacy browser keys', async () => {
+    mocks.getConfig.mockResolvedValue({
+      result: {
+        config: {
+          browser: {
+            enabled: false,
+            headless: true,
+            viewport_width: 1280,
+            viewport_height: 800,
+            profile_mode: 'fresh',
+            max_task_steps: 20,
+            task_timeout_secs: 120,
+            chrome_path: null,
+            allowed_domains: [],
+            session_name: null,
+            backend: 'auto',
+            native_headless: true,
+            native_webdriver_url: 'http://127.0.0.1:9515',
+            native_chrome_path: null,
+            computer_use: { endpoint: 'http://127.0.0.1:8787/v1/actions', timeout_ms: 15000 },
+          },
+          http_request: { allowed_domains: ['selenium.dev'] },
+        },
+      },
+    });
+    renderWithProviders(<BrowserConnectionsPanel />);
+    await screen.findByText('selenium.dev');
+    fireEvent.click(screen.getByLabelText('connections.browser.enabled'));
+    fireEvent.click(screen.getByText('connections.browser.save'));
+    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
+    const sent = mocks.update.mock.calls[0][0] as Record<string, unknown>;
+    expect(Object.keys(sent).sort()).toEqual(
+      [
+        'chrome_path',
+        'download_dir',
+        'enabled',
+        'headless',
+        'max_task_steps',
+        'profile_mode',
+        'profile_path',
+        'task_timeout_secs',
+        'viewport_height',
+        'viewport_width',
+      ].sort()
+    );
+    expect(sent).toMatchObject({ enabled: true, viewport_height: 800 });
+  });
+
   it('checks Chrome by opening and closing a core browser session', async () => {
     renderWithProviders(<BrowserConnectionsPanel />);
     await screen.findByText('selenium.dev');
-    mocks.rpc.mockResolvedValueOnce({ result: { module_ready: true, chrome_ready: true } });
+    mocks.rpc.mockResolvedValueOnce({ module_ready: true, chrome_ready: true, error: null });
     fireEvent.click(screen.getByText('connections.browser.testBrowser'));
     await waitFor(() =>
       expect(mocks.rpc).toHaveBeenCalledWith({
@@ -148,7 +196,9 @@ describe('BrowserConnectionsPanel', () => {
     renderWithProviders(<BrowserConnectionsPanel />);
     await screen.findByText('selenium.dev');
     mocks.rpc.mockResolvedValueOnce({
-      result: { module_ready: true, chrome_ready: false, error: 'Chrome unavailable' },
+      module_ready: true,
+      chrome_ready: false,
+      error: 'Chrome unavailable',
     });
     fireEvent.click(screen.getByText('connections.browser.testBrowser'));
     expect(await screen.findByText('connections.browser.chromeNotReady')).toBeInTheDocument();
```

**File**: `app/src/components/settings/panels/BrowserConnectionsPanel.tsx` (modified, +26/-8)
```diff
@@ -50,6 +50,24 @@ const defaults: BrowserSettings = {
   task_timeout_secs: 120,
 };
 
+/** The fields this panel edits, all accepted by `config.update_browser_settings`. */
+const SETTING_KEYS = Object.keys(defaults) as (keyof BrowserSettings)[];
+
+/**
+ * Keep only the panel's own fields. The `[browser]` config block also carries
+ * legacy keys (`allowed_domains`, `native_*`, `computer_use`, ...), and the
+ * core rejects any unknown param, so sending the whole block fails every save.
+ */
+function pickSettings(source: Partial<Record<keyof BrowserSettings, unknown>>): BrowserSettings {
+  const picked: Partial<Record<keyof BrowserSettings, unknown>> = {};
+  for (const key of SETTING_KEYS) {
+    if (source[key] !== undefined) picked[key] = source[key];
+  }
+  return { ...defaults, ...(picked as Partial<BrowserSettings>) };
+}
+
+type BrowserReadiness = { module_ready: boolean; chrome_ready: boolean; error?: string | null };
+
 export interface BrowserConnectionsPanelProps {
   /** Render only the body, for hosting inside the Computer panel's chip tabs. */
   embedded?: boolean;
@@ -68,8 +86,7 @@ export default function BrowserConnectionsPanel({
   const refresh = useCallback(async () => {
     const configResponse = await openhumanGetConfig();
     const config = configResponse.result.config;
-    const browser = (config.browser ?? {}) as Partial<BrowserSettings>;
-    setSettings({ ...defaults, ...browser });
+    setSettings(pickSettings((config.browser ?? {}) as Partial<BrowserSettings>));
     const httpRequest = (config.http_request ?? {}) as { allowed_domains?: string[] };
     setAllowedDomains(httpRequest.allowed_domains ?? []);
   }, []);
@@ -100,7 +117,7 @@ export default function BrowserConnectionsPanel({
         setMessage(t('connections.browser.boundsRequired'));
         return;
       }
-      await openhumanUpdateBrowserSettings(settings);
+      await openhumanUpdateBrowserSettings(pickSettings(settings));
       setChromeReady(null);
       await refresh();
       setMessage(t('connections.browser.saved'));
@@ -115,11 +132,12 @@ export default function BrowserConnectionsPanel({
     setBusy(true);
     setMessage('');
     try {
-      const response = await callCoreRpc<{
-        result: { module_ready: boolean; chrome_ready: boolean; error?: string };
-      }>({ method: 'openhuman.modules_browser_check_readiness' });
-      setChromeReady(response.result.chrome_ready);
-      setMessage(response.result.error ?? t('connections.browser.readinessChecked'));
+      // callCoreRpc already unwraps the JSON-RPC `result`.
+      const response = await callCoreRpc<BrowserReadiness>({
+        method: 'openhuman.modules_browser_check_readiness',
+      });
+      setChromeReady(response.chrome_ready);
+      setMessage(response.error ?? t('connections.browser.readinessChecked'));
     } catch (error) {
       setChromeReady(false);
       setMessage(error instanceof Error ? error.message : String(error));
```

**File**: `crates/openhuman-core/src/config/schema/computer.rs` (modified, +5/-0)
```diff
@@ -45,6 +45,11 @@ pub struct ComputerConfig {
     /// How many times one task may be rescued; `0` turns rescue off and
     /// `None` keeps the module's default (5, also its maximum).
     pub max_rescues: Option<u32>,
+    /// Record every decision of a browser task and keep each task's full
+    /// report, and trace desktop commands, under `<workspace>/state/computer/`.
+    /// Off by default: reports hold page text. `OPENHUMAN_COMPUTER_TRACE=1`
+    /// turns it on for one run without editing the config.
+    pub trace: bool,
 }
 
 #[cfg(test)]
```

**File**: `crates/openhuman-core/src/modules/browser.rs` (modified, +21/-4)
```diff
@@ -20,6 +20,21 @@ use crate::config::Config;
 
 pub const MODULE_ID: &str = super::desktop::MODULE_ID;
 
+/// What the agent is told when TinyComputer finds no Chrome. The module looks
+/// in its own cache, the standard install locations, and the Puppeteer and
+/// Playwright caches, so a Chrome kept anywhere else (`~/Applications`, the
+/// Desktop) needs its path set. Left without this, an agent tried to install
+/// a browser itself (`npx agent-browser install`, then `sudo`).
+pub(crate) const CHROME_NOT_FOUND_HINT: &str = "Chrome was not found. Ask the user to set \
+    the full path to the Chrome program under Connections > Computer Control > Browser > \
+    Chrome path (for example /Applications/Google Chrome.app/Contents/MacOS/Google Chrome), \
+    then try again. Do not install or download a browser yourself.";
+
+/// Whether a module error or task failure says Chrome could not be found.
+pub(crate) fn chrome_not_found(text: &str) -> bool {
+    text.to_ascii_lowercase().contains("chrome not found")
+}
+
 #[derive(Debug, thiserror::Error)]
 pub enum BrowserCallError {
     #[error("TinyComputer browser unavailable: {0}")]
@@ -55,10 +70,12 @@ impl BrowserCallError {
             .and_then(serde_json::Value::as_str)
             .map(|name| name.rsplit('.').next().unwrap_or(name).to_owned())
             .unwrap_or_else(|| error.code.clone());
-        Self::Bus {
-            name,
-            message: error.message.clone(),
-        }
+        let message = if chrome_not_found(&error.message) {
+            format!("{} {CHROME_NOT_FOUND_HINT}", error.message)
+        } else {
+            error.message.clone()
+        };
+        Self::Bus { name, message }
     }
 }
 
```

**File**: `crates/openhuman-core/src/modules/browser_task.rs` (modified, +28/-4)
```diff
@@ -67,6 +67,7 @@ pub fn start_request(config: &Config, task: &BrowserTask) -> StartTaskRequest {
             max_rescues: config.computer.max_rescues,
             ..TaskBudget::default()
         },
+        trace: super::computer_config::tracing_enabled(config),
         ..StartTaskRequest::default()
     }
 }
@@ -89,7 +90,7 @@ pub async fn start(config: &Config, task: &BrowserTask) -> Result<TaskView, Stri
         "[browser-task] starting"
     );
     let view: TaskView = call(config, methods::START_TASK, request, true).await?;
-    follow(config, view).await
+    settle(config, view).await
 }
 
 /// Answer a paused task and follow it again.
@@ -100,7 +101,7 @@ pub async fn start(config: &Config, task: &BrowserTask) -> Result<TaskView, Stri
 pub async fn resume(config: &Config, request: ContinueTaskRequest) -> Result<TaskView, String> {
     tracing::debug!(task = %request.id, approve = ?request.approve, "[browser-task] continuing");
     let view: TaskView = call(config, methods::CONTINUE_TASK, request, true).await?;
-    follow(config, view).await
+    settle(config, view).await
 }
 
 /// Keep following a task that was still running when the last call returned.
@@ -119,7 +120,7 @@ pub async fn wait(config: &Config, id: TaskId) -> Result<TaskView, String> {
         false,
     )
     .await?;
-    follow(config, view).await
+    settle(config, view).await
 }
 
 /// Cancel a task.
@@ -140,15 +141,38 @@ pub async fn cancel(config: &Config, id: TaskId) -> Result<TaskView, String> {
 ///
 /// Returns a module or transport error.
 pub async fn report(config: &Config, id: TaskId) -> Result<TaskReport, String> {
+    report_with(config, id, false).await
+}
+
+/// The task's record, with every Jev exchange when `trace` is set and the
+/// task was started with `StartTask.trace`. A traced report can run to
+/// megabytes, so only the tracing path asks for it.
+///
+/// # Errors
+///
+/// Returns a module or transport error.
+pub(crate) async fn report_with(
+    config: &Config,
+    id: TaskId,
+    trace: bool,
+) -> Result<TaskReport, String> {
     call(
         config,
         methods::TASK_REPORT,
-        TaskReportRequest { id, trace: false },
+        TaskReportRequest { id, trace },
         true,
     )
     .await
 }
 
+/// Follow `view` until it stops or the host deadline passes, then record
+/// how it stopped (see [`super::browser_task_report`]).
+async fn settle(config: &Config, view: TaskView) -> Result<TaskView, String> {
+    let view = follow(config, view).await?;
+    super::browser_task_report::record(config, &view).await;
+    Ok(view)
+}
+
 async fn follow(config: &Config, mut view: TaskView) -> Result<TaskView, String> {
     let deadline = Instant::now() + Duration::from_secs(config.browser.task_timeout_secs.max(1));
     while matches!(view.status, tinycomputer_bus::agent::TaskStatus::Running) {
```

**File**: `crates/openhuman-core/src/modules/browser_task_report.rs` (added, +315/-0)
```diff
@@ -0,0 +1,315 @@
+//! What the host keeps from a browser task once it stops: a content-free
+//! summary in the log when the task stopped short (failed, or needs a person
+//! or a plan), and — with tracing on — the module's full report under
+//! `<workspace>/state/computer/tasks/`.
+//!
+//! A report holds page text (step notes, records and, when traced, every Jev
+//! exchange), so it is written only to the workspace, readable by its owner
+//! alone, and never logged: the log gets counts, the failed step's position
+//! and kind, and the module's own one-line reason.
+
+use std::collections::VecDeque;
+use std::future::Future;
+#[cfg(unix)]
+use std::os::unix::fs::PermissionsExt;
+use std::path::{Path, PathBuf};
+use std::pin::Pin;
+use std::sync::{Mutex, MutexGuard, OnceLock};
+use std::time::{SystemTime, UNIX_EPOCH};
+
+use tinycomputer_bus::agent::{RescueOutcome, TaskId, TaskReport, TaskStatus, TaskView};
+use tinycomputer_bus::flow::StepOutcome;
+use tokio::io::AsyncWriteExt;
+
+use crate::config::Config;
+
+#[cfg(test)]
+#[path = "browser_task_report_tests.rs"]
+mod tests;
+
+/// How many stopped tasks are remembered, so a view followed again does not
+/// record the same stop twice.
+const REMEMBERED: usize = 64;
+/// The most characters of a failure reason written to the log.
+const REASON_CHARS: usize = 240;
+
+/// A pending `TaskReport` call.
+type ReportFetch<'a> = Pin<Box<dyn Future<Output = Result<TaskReport, String>> + Send + 'a>>;
+
+/// Records `view` once per task and state: a log summary when it stopped
+/// short, and the full report on disk when tracing is on and it settled.
+/// Never fails the caller; a report that cannot be fetched is only logged,
+/// and the next settle of the same state tries again.
+pub(crate) async fn record(config: &Config, view: &TaskView) {
+    let traced = super::computer_config::tracing_enabled(config);
+    record_with(config, view, traced, |id, trace| {
+        Box::pin(super::browser_task::report_with(config, id, trace))
+    })
+    .await;
+}
+
+/// [`record`] with tracing on or off as `traced` says, and the module's
+/// `TaskReport` call passed in as `fetch`.
+async fn record_with<'a>(
+    config: &'a Config,
+    view: &TaskView,
+    traced: bool,
+    fetch: impl FnOnce(TaskId, bool) -> ReportFetch<'a>,
+) {
+    if !worth_recording(&view.status, traced) {
+        return;
+    }
+    let key = record_key(view);
+    let claimed = recorded().claim(&key);
+    if !claimed {
+        return;
+    }
+    let report = match fetch(view.id.clone(), traced).await {
+        Ok(report) => report,
+        Err(error) => {
+            // Give the claim back, so the next settle of this state tries again.
+            recorded().release(&key);
+            tracing::warn!(task = %view.id, %error, "[browser-task] report unavailable");
+            return;
+        }
+    };
+    if stopped_short(&view.status) {
+        let summary = Summary::of(&view.status, &report);
+        tracing::warn!(
+            task = %view.id,
+            state = status_name(&view.status),
+            step = ?summary.failed_step,
+            kind = summary.failed_kind.unwrap_or("-"),
+            steps = summary.steps,
+            jev_calls = summary.jev_calls,
+            actions = summary.actions,
+            rescues = summary.rescues,
+            recovered = summary.recovered,
+            reason = %reason(&view.status),
+            "[browser-task] task stopped short"
+        );
+    }
+    if traced {
+        write(config, &report).await;
+    }
+}
+
+/// A task that ended without doing what it was asked.
+fn stopped_short(status: &TaskStatus) -> bool {
+    matches!(
+        status,
+        TaskStatus::Failed { .. } | TaskStatus::NeedsHuman { .. } | TaskStatus::NeedsPlan { .. }
+    )
+}
+
+/// Whether a stop in `status` is recorded: always when it stopped short, and
+/// any settled stop when `traced`.
+fn worth_recording(status: &TaskStatus, traced: bool) -> bool {
+    stopped_short(status) || (traced && !matches!(status, TaskStatus::Running))
+}
+
+/// What a task's stop is remembered by: the task, its state and its progress.
+fn record_key(view: &TaskView) -> String {
+    format!(
+        "{}|{}|{:.3}",
+        view.id,
+        status_name(&view.status),
+        view.progress
+    )
+}
+
+/// The stops this process has recorded, or is recording.
+fn recorded() -> MutexGuard<'static, Recorded> {
+    static RECORDED: OnceLock<Mutex<Recorded>> = OnceLock::new();
+    RECORDED
+        .get_or_init(|| Mutex::new(Recorded::new(REMEMBERED)))
+        .lock()
+        .unwrap_or_else(std::sync::PoisonError::into_inner)
+}
+
+/// Stops claimed for recording, oldest first, at most `cap` of them.
+#[derive(Debug)]
+struct Recorded {
+    keys: VecDeque<String>,
+    cap: usize,
+}
+
+impl Recorded {
+    /// Remembers at most `cap` stops.
+    fn new(cap: usize) -> Self {
+        Self {
+            keys: VecDeque::new(),
+            cap,
+        }
+    
```

**File**: `crates/openhuman-core/src/modules/browser_task_report_tests.rs` (added, +472/-0)
```diff
@@ -0,0 +1,472 @@
+//! A stopped task is summarised without page content, recorded once per
+//! state (and again when its report could not be fetched), and its full
+//! report is written inside the workspace, readable by its owner alone.
+
+use std::sync::atomic::{AtomicUsize, Ordering};
+use std::sync::Arc;
+
+use super::*;
+use serde_json::{json, Value};
+
+/// Log lines written on this thread while the guard from [`capture_logs`]
+/// lives.
+#[derive(Clone, Default)]
+struct Capture(Arc<std::sync::Mutex<Vec<u8>>>);
+
+impl Capture {
+    /// Everything logged so far.
+    fn text(&self) -> String {
+        String::from_utf8(self.0.lock().unwrap().clone()).unwrap()
+    }
+}
+
+impl std::io::Write for Capture {
+    fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
+        self.0.lock().unwrap().extend_from_slice(bytes);
+        Ok(bytes.len())
+    }
+
+    fn flush(&mut self) -> std::io::Result<()> {
+        Ok(())
+    }
+}
+
+impl<'a> tracing_subscriber::fmt::MakeWriter<'a> for Capture {
+    type Writer = Self;
+
+    fn make_writer(&'a self) -> Self::Writer {
+        self.clone()
+    }
+}
+
+/// Captures this thread's log lines, at every level, until the guard drops.
+fn capture_logs() -> (Capture, tracing::subscriber::DefaultGuard) {
+    let capture = Capture::default();
+    let subscriber = tracing_subscriber::fmt()
+        .with_writer(capture.clone())
+        .with_ansi(false)
+        .with_max_level(tracing::Level::TRACE)
+        .finish();
+    (capture, tracing::subscriber::set_default(subscriber))
+}
+
+/// A config whose workspace is inside `dir`.
+fn workspace_config(dir: &tempfile::TempDir) -> Config {
+    let mut config = Config::default();
+    config.workspace_dir = dir.path().join("workspace");
+    config
+}
+
+/// A `fetch` for [`record_with`] that counts its calls and answers `reply`.
+fn fetch_counted<'a>(
+    calls: &'a AtomicUsize,
+    reply: Result<TaskReport, String>,
+) -> impl FnOnce(TaskId, bool) -> ReportFetch<'a> {
+    move |_, _| {
+        calls.fetch_add(1, Ordering::SeqCst);
+        Box::pin(async move { reply })
+    }
+}
+
+/// A view of task `id` in `status`.
+fn view(id: &str, status: Value, progress: f32) -> TaskView {
+    serde_json::from_value(json!({
+        "id": id,
+        "status": status,
+        "summary": "searching",
+        "progress": progress,
+        "next": []
+    }))
+    .unwrap()
+}
+
+/// A failed status at step 2, with the module's one-line reason.
+fn failed() -> Value {
+    json!({
+        "state": "failed",
+        "step": 2,
+        "reason": "the last three actions changed nothing on screen",
+        "hint": "",
+        "recoverable": true
+    })
+}
+
+/// A report of three steps, the last one failed, with one rescue.
+fn report(view: &TaskView) -> TaskReport {
+    serde_json::from_value(json!({
+        "view": view,
+        "steps": [
+            {"path": "0", "kind": "browse", "text": "open the site", "outcome": "done",
+             "turns": 0, "jev_calls": 0, "actions": [], "loops": [], "note": ""},
+            {"path": "1", "kind": "enter", "text": "type Asha", "outcome": "done",
+             "turns": 2, "jev_calls": 14, "actions": [{"action": "fill", "ok": true}],
+             "loops": [], "note": ""},
+            {"path": "2", "kind": "do", "text": "search for trains", "outcome": "failed",
+             "turns": 3, "jev_calls": 21,
+             "actions": [{"action": "click", "ok": true}, {"action": "click", "ok": false}],
+             "loops": [], "note": "nothing changed"}
+        ],
+        "records": {},
+        "artifacts": [],
+        "learned": [],
+        "trace": [],
+        "rescues": [
+            {"step": 2, "failure": "nothing changed", "reason": "timed out", "outcome": "gave_up"}
+        ]
+    }))
+    .unwrap()
+}
+
+#[test]
+fn a_task_that_stopped_short_is_summarised_with_counts_not_page_text() {
+    let view = view("t-summary", failed(), 0.33);
+    let summary = Summary::of(&view.status, &report(&view));
+    assert_eq!(
+        summary,
+        Summary {
+            steps: 3,
+            jev_calls: 35,
+            actions: 3,
+            rescues: 1,
+            recovered: 0,
+            failed_step: Some(2),
+            failed_kind: Some("do"),
+        }
+    );
+}
+
+#[test]
+fn only_a_task_that_stopped_short_or_a_traced_settled_one_is_recorded() {
+    let done = view(
+        "t-done",
+        json!({"state": "done", "answer": "found", "records": {}}),
+        1.0,
+    );
+    let running = view("t-running", json!({"state": "running"}), 0.5);
+    let human = view(
+        "t-human",
+        json!({"state": "needs_human", "reason": "log in"}),
+        0.5,
+    );
+    let plan = view("t-plan", json!({"state": "needs_plan", "guide": "…"}), 0.0);
+    let failed = view("t-failed", failed(), 0.3);
+
+    assert!(worth_recording(&failed.status, false));
+    assert!(worth_recording(&human.status, false));
+    assert!(worth_record
```

---

### Incident Patch 10: `d557701e` (2026-10-05)
**Commit Message**: Merge pull request #7004 from obchain/fix/6991-search-tool-unavailable

fix(search): stop re-offering search a session cannot use

**File**: `crates/openhuman-core/src/search/tools.rs` (modified, +96/-6)
```diff
@@ -6,7 +6,9 @@
 //! through `modules::search::execute_tool`, so a provider or login change is
 //! honoured on the next call without rebuilding the session.
 
-use std::sync::Arc;
+use std::collections::hash_map::DefaultHasher;
+use std::hash::{Hash, Hasher};
+use std::sync::{Arc, Mutex};
 
 use async_trait::async_trait;
 use serde_json::Value;
@@ -17,12 +19,35 @@ use crate::config::Config;
 
 /// One TinySearch tool (a role tool such as `web_search_tool`, or a provider
 /// tool in `all_tools` presentation).
+/// What a call reports once every provider has already answered
+/// "unavailable" in this session. It tells the model to stop rather than to
+/// wait, because nothing about the session will change the answer (#6991).
+pub const SEARCH_EXHAUSTED_MESSAGE: &str =
+    "Web search is not available with this setup: no provider could answer. Do not call \
+     it again \u{2014} answer from the material you already have.";
+
 pub struct TinySearchTool {
     spec: ToolSpec,
     /// Spawn-time config. `None` for a deferred instance rebuilt from a
     /// recorded transcript, which resolves the live config per call.
     config: Option<Arc<Config>>,
     exposure: ToolExposure,
+    /// The provider configuration a call last found nothing usable under.
+    ///
+    /// A credential alone makes the managed route look reachable
+    /// (`providers::backend_credential_available`), so a deployment that is
+    /// offline, firewalled, out of balance or holding a dead key offers this
+    /// tool on every turn and fails every call. The agent then spends turns on
+    /// a tool that cannot work, at the moment it is least sure what to do.
+    ///
+    /// Keyed by configuration rather than latched outright, because this
+    /// module's contract is that every call re-reads the live config so a
+    /// provider or login change is honoured without rebuilding the session. A
+    /// call whose signature differs from the recorded one tries again; only a
+    /// repeat under the same configuration is refused. The signature is this
+    /// tool's own view — its role order and the resolved providers — so one
+    /// tool's dead providers never answer for another's.
+    exhausted_for: Mutex<Option<u64>>,
 }
 
 impl TinySearchTool {
@@ -31,6 +56,7 @@ impl TinySearchTool {
             spec,
             config: Some(config),
             exposure: ToolExposure::Direct,
+            exhausted_for: Mutex::new(None),
         }
     }
 
@@ -41,7 +67,46 @@ impl TinySearchTool {
             spec,
             config: None,
             exposure: ToolExposure::Direct,
+            exhausted_for: Mutex::new(None),
+        }
+    }
+
+    /// Whether this tool already found nothing usable under `signature`.
+    pub(crate) fn is_exhausted_for(&self, signature: u64) -> bool {
+        self.exhausted_for
+            .lock()
+            .map(|recorded| *recorded == Some(signature))
+            .unwrap_or(false)
+    }
+
+    /// Record that no provider could answer under `signature`. Replaces any
+    /// earlier one, so the refusal always describes the current configuration.
+    pub(crate) fn mark_exhausted_for(&self, signature: u64) {
+        if let Ok(mut recorded) = self.exhausted_for.lock() {
+            *recorded = Some(signature);
+        }
+    }
+
+    /// What this tool's providers look like right now: the order its role
+    /// draws from, and every provider's resolved reachability. Two calls agree
+    /// only while nothing a user could change — a key, a route, a provider
+    /// selection, a login — has moved.
+    pub(crate) fn provider_signature(&self, config: &Config) -> u64 {
+        let mut hasher = DefaultHasher::new();
+        if let Some(role) = tinysearch_bus::role_for_tool(&self.spec.name) {
+            for provider in super::providers::role_order(config, role) {
+                provider.hash(&mut hasher);
+            }
         }
+        for provider in super::providers::resolve(config) {
+            provider.id.hash(&mut hasher);
+            provider.enabled.hash(&mut hasher);
+            provider.usable.hash(&mut hasher);
+            provider.key_configured.hash(&mut hasher);
+            provider.managed_available.hash(&mut hasher);
+            matches!(provider.route, crate::config::SearchRoute::Managed).hash(&mut hasher);
+        }
+        hasher.finish()
     }
 
     pub fn spec(&self) -> &ToolSpec {
@@ -71,10 +136,7 @@ pub fn user_facing_error(error: &str) -> String {
         Some(code) if code == errors::RATE_LIMITED => {
             "Web search is rate limited right now. Wait a moment and try again.".to_string()
         }
-        Some(code) if code == errors::UNAVAILABLE => {
-            "Every configured search provider for this request is unavailable right now."
-                .to_string()
-        }
+        Some(code) if code == errors::UNAVAILABLE => SEARCH_EXHAUSTED_MESSAGE.to_string(),
         Some(code) if code == errors::INVALID_ARGUMENTS => {

```

**File**: `crates/openhuman-core/src/search/tools_tests.rs` (modified, +136/-1)
```diff
@@ -19,7 +19,10 @@ fn classified_errors_become_actionable_messages() {
     let balance = user_facing_error("tinysearch.insufficient_balance: 402 from backend");
     assert!(balance.contains("balance is too low"));
     assert!(user_facing_error("tinysearch.rate_limited: slow down").contains("rate limited"));
-    assert!(user_facing_error("tinysearch.provider_unavailable: all down").contains("unavailable"));
+    assert_eq!(
+        user_facing_error("tinysearch.provider_unavailable: all down"),
+        SEARCH_EXHAUSTED_MESSAGE
+    );
     assert_eq!(
         user_facing_error(
             "search ExecuteTool failed: tinysearch.invalid_arguments: urls must not be empty"
@@ -100,3 +103,135 @@ fn standard_privacy_mode_allows_search_tool_dispatch() {
 
     assert!(local_only_search_block("web_search_tool").is_none());
 }
+
+// ---------------------------------------------------------------------------
+// #6991: a credential alone makes the managed route look reachable, so a
+// deployment that is offline, firewalled, out of balance or holding a dead key
+// offers these tools on every turn and fails every call. The old message ended
+// "unavailable right now", which reads as "retry later": in the DeepSWE-10 run
+// the agent called search three times on one task, then guessed, and the guess
+// was what the hidden test rejected.
+// ---------------------------------------------------------------------------
+
+fn spec(name: &str) -> ToolSpec {
+    ToolSpec {
+        name: name.to_string(),
+        description: "search".into(),
+        parameters: serde_json::json!({"type": "object"}),
+    }
+}
+
+/// A config whose managed providers are selected but whose direct keys are
+/// absent, which is the shape that offers the tools and cannot serve them.
+fn nothing_usable_config() -> Config {
+    let mut config = Config::default();
+    config.search.providers = [("brave".to_string(), SearchProviderSettings::direct())]
+        .into_iter()
+        .collect();
+    config
+}
+
+#[test]
+fn the_unavailable_verdict_tells_the_model_to_stop_rather_than_wait() {
+    let message = user_facing_error("tinysearch.provider_unavailable: all down");
+
+    assert!(
+        message.contains("Do not call it again"),
+        "the model must be told to stop, got: {message}"
+    );
+    assert!(
+        !message.contains("right now"),
+        "nothing the model can do will change the answer, so it must not read as a retry hint: {message}"
+    );
+}
+
+#[test]
+fn only_the_exhaustion_verdict_is_treated_as_final() {
+    // A rate limit clears on its own; a low balance and a rejected argument
+    // each have a message naming what to change. None of them may latch.
+    assert!(exhausts_providers(
+        "tinysearch.provider_unavailable: all down"
+    ));
+    assert!(!exhausts_providers("tinysearch.rate_limited: slow down"));
+    assert!(!exhausts_providers("tinysearch.insufficient_balance: 402"));
+    assert!(!exhausts_providers(
+        "tinysearch.invalid_arguments: urls must not be empty"
+    ));
+    assert!(!exhausts_providers("boom"));
+}
+
+#[test]
+fn a_tool_starts_with_nothing_recorded() {
+    let config = nothing_usable_config();
+    let tool = TinySearchTool::recorded(spec("web_search_tool"));
+
+    assert!(!tool.is_exhausted_for(tool.provider_signature(&config)));
+}
+
+#[test]
+fn the_refusal_answers_only_for_the_configuration_that_failed() {
+    // The contract this module documents is that every call re-reads the live
+    // config, so a provider or login change is honoured without rebuilding the
+    // session. A refusal that outlived a config change would break it: the user
+    // adds a key and search stays dead until the thread is abandoned.
+    let dead = nothing_usable_config();
+    let tool = TinySearchTool::recorded(spec("web_search_tool"));
+    let dead_signature = tool.provider_signature(&dead);
+
+    tool.mark_exhausted_for(dead_signature);
+    assert!(tool.is_exhausted_for(dead_signature));
+
+    let mut fixed = dead.clone();
+    fixed.search.brave.api_key = Some("added-after-the-failure".into());
+
+    assert_ne!(
+        tool.provider_signature(&fixed),
+        dead_signature,
+        "adding a provider key must change what the tool sees"
+    );
+    assert!(
+        !tool.is_exhausted_for(tool.provider_signature(&fixed)),
+        "adding a key must clear the refusal"
+    );
+}
+
+#[test]
+fn one_tools_dead_providers_do_not_answer_for_another() {
+    // `build_search_tools` can offer provider-specific tools beside the role
+    // tools, and the roles draw on different provider orders, so a shared
+    // verdict would let one provider's outage disable unrelated ones.
+    let config = nothing_usable_config();
+    let failed = TinySearchTool::recorded(spec("web_search_tool"));
+    let other = TinySearchTool::recorded(spec("web_answer_tool"));
+
+    failed.mark_exhausted_for(failed.provider_signature(&config));
+
+    assert!(!other.is_exhausted_for
```

---

### Incident Patch 11: `40c8d366` (2026-10-05)
**Commit Message**: fix(memory): an automatic resume rechecks the pause before every batch

The pause was checked once before an automatic resume started, so a pause
(or sign-out) landing just after the check let the import run anyway.
The resume now carries a pause check into the run, which asks before
every batch it stores; once paused it stops, keeps the import Running
with its checkpoint, and the next unpaused tick resumes it. An import the
user starts is unaffected.

Tests: a pause that lands after the check stops the run before anything
is stored and the next tick finishes it; the refused-item fixture
matches the document by title rather than its Debug text. The coverage
matrix row names the test behind each claim.

**File**: `crates/openhuman-core/src/memory/import.rs` (modified, +56/-18)
```diff
@@ -15,7 +15,7 @@
 
 use std::collections::HashSet;
 use std::path::{Path, PathBuf};
-use std::sync::{LazyLock, Mutex};
+use std::sync::{Arc, LazyLock, Mutex};
 
 use serde::{Deserialize, Serialize};
 use tinymemory_api::ItemKind;
@@ -224,28 +224,40 @@ pub fn status(config: &Config) -> ImportState {
     state
 }
 
+/// Whether background work is paused right now. An automatic resume asks
+/// before it starts and again before every batch it stores.
+pub(crate) type PauseCheck = Arc<dyn Fn() -> bool + Send + Sync>;
+
+/// The scheduler's pause, which includes being signed out.
+fn scheduler_paused() -> bool {
+    matches!(
+        crate::cron::scheduler_gate::current_policy(),
+        crate::cron::scheduler_gate::Policy::Paused { .. }
+    )
+}
+
 /// Resumes an import the app quit in the middle of, if there is one, under
-/// the scheduler's current policy ([`resume_interrupted_with`]). Called from
-/// memory's background job.
+/// the scheduler's pause ([`resume_interrupted_with`]). Called from memory's
+/// background job.
 pub async fn resume_interrupted(config: &Config) -> bool {
-    resume_interrupted_with(config, crate::cron::scheduler_gate::current_policy()).await
+    resume_interrupted_with(config, Arc::new(scheduler_paused)).await
 }
 
-/// Resumes an interrupted import under `policy`.
+/// Resumes an interrupted import unless `paused` says background work is
+/// paused.
 ///
 /// Only a `Running` state with no live run counts: the user consented when
 /// it started, and quitting the app is not a decision to stop. Nothing
 /// resumes while background work is paused (which includes being signed
-/// out); the state stays `Running`, so a later tick resumes it. An import
+/// out), and a resumed run asks `paused` again before every batch, so a pause
+/// that lands after the check stops it at the next batch. Either way the state
+/// stays `Running` with its checkpoint, so a later tick resumes it. An import
 /// that stopped on an error (credits exhausted, engine unreachable) stays
 /// stopped until the user starts it again, and so does one whose automatic
 /// resume could not start: that failure is persisted as `Error`, so a
 /// failure that would recur does not loop. Returns whether a run was
 /// started.
-pub(crate) async fn resume_interrupted_with(
-    config: &Config,
-    policy: crate::cron::scheduler_gate::Policy,
-) -> bool {
+pub(crate) async fn resume_interrupted_with(config: &Config, paused: PauseCheck) -> bool {
     if read_file(&config.workspace_dir).state.phase != ImportPhase::Running {
         return false;
     }
@@ -256,14 +268,11 @@ pub(crate) async fn resume_interrupted_with(
     if live {
         return false;
     }
-    if let crate::cron::scheduler_gate::Policy::Paused { reason } = policy {
-        tracing::debug!(
-            ?reason,
-            "[memory:import] background paused; interrupted import left for later"
-        );
+    if paused() {
+        tracing::debug!("[memory:import] background paused; interrupted import left for later");
         return false;
     }
-    match start(config, true).await {
+    match start_with(config, true, Some(paused)).await {
         Ok(state) => {
             tracing::info!(
                 imported = state.imported,
@@ -291,6 +300,16 @@ pub(crate) async fn resume_interrupted_with(
 
 /// `memory_import_start`: requires `consent`, memory on, and a legacy store.
 pub async fn start(config: &Config, consent: bool) -> MemoryResult<ImportState> {
+    start_with(config, consent, None).await
+}
+
+/// [`start`], with the pause an automatic resume honors (`None` for an import
+/// the user started, which runs to the end).
+async fn start_with(
+    config: &Config,
+    consent: bool,
+    paused: Option<PauseCheck>,
+) -> MemoryResult<ImportState> {
     if !consent {
         return Err(MemoryError::invalid(
             "importing uploads local memory to the selected engine; pass consent: true",
@@ -328,7 +347,7 @@ pub async fn start(config: &Config, consent: bool) -> MemoryResult<ImportState>
     let state = file.state.clone();
     tracing::info!(total = state.total, "[memory:import] import started");
     tokio::spawn(async move {
-        run(&workspace_dir, &bound, file).await;
+        run(&workspace_dir, &bound, file, paused).await;
         RUNNING
             .lock()
             .unwrap_or_else(std::sync::PoisonError::into_inner)
@@ -337,7 +356,12 @@ pub async fn start(config: &Config, consent: bool) -> MemoryResult<ImportState>
     Ok(state)
 }
 
-async fn run(workspace_dir: &Path, bound: &BoundEngine, mut file: ImportFile) {
+async fn run(
+    workspace_dir: &Path,
+    bound: &BoundEngine,
+    mut file: ImportFile,
+    paused: Option<PauseCheck>,
+) {
     let (tx, mut rx) = tokio::sync::mpsc::channel::<Result<ImportedItem, String>>(16);
     let reader_dir = workspace_dir.to_path_buf();
     let checkpoint = file.checkpoint.clone();
@@ -359,6 +383,7 @@ async fn run(workspace_dir: &Path, bound:
```

**File**: `crates/openhuman-core/src/memory/import_tests.rs` (modified, +53/-11)
```diff
@@ -382,8 +382,7 @@ async fn an_item_the_engine_refuses_is_skipped_and_the_rest_imported() {
     legacy_workspace(&config.workspace_dir);
     // Refuses the "Ideas" document (d2) as malformed, stores the rest.
     let engine = bind_failing(&config, |item| {
-        format!("{item:?}")
-            .contains("oolong")
+        matches!(item, tinymemory_api::StoreItem::Document { title: Some(title), .. } if title == "Ideas")
             .then(|| tinymemory_api::Error::InvalidRequest("item too large".into()))
     });
 
@@ -489,28 +488,72 @@ async fn the_background_job_resumes_an_interrupted_import() {
 
 #[tokio::test]
 async fn nothing_resumes_while_background_work_is_paused() {
-    use crate::cron::scheduler_gate::{PauseReason, Policy};
     let tmp = tempfile::tempdir().unwrap();
     let config = config_in(&tmp);
     legacy_workspace(&config.workspace_dir);
     let engine = bind_reference(&config);
     quit_mid_import(&config);
 
-    let paused = Policy::Paused {
-        reason: PauseReason::UserDisabled,
-    };
-    assert!(!resume_interrupted_with(&config, paused).await);
+    assert!(!resume_interrupted_with(&config, always(true)).await);
     assert!(stored(&engine, MetaFilter::default()).await.is_empty());
     assert_eq!(
         read_file(&config.workspace_dir).state.phase,
         ImportPhase::Running,
         "left resumable for a later, unpaused tick"
     );
 
-    assert!(resume_interrupted_with(&config, Policy::Normal).await);
+    assert!(resume_interrupted_with(&config, always(false)).await);
     assert_eq!(wait_until_settled(&config).await.phase, ImportPhase::Done);
 }
 
+/// A pause check that always answers `paused`.
+fn always(paused: bool) -> PauseCheck {
+    Arc::new(move || paused)
+}
+
+/// Waits until no import run is live for `config`'s workspace.
+async fn wait_until_no_live_run(config: &Config) {
+    for _ in 0..400 {
+        let live = RUNNING.lock().unwrap().contains(&config.workspace_dir);
+        if !live {
+            return;
+        }
+        tokio::time::sleep(std::time::Duration::from_millis(25)).await;
+    }
+    panic!("the import run never ended");
+}
+
+#[tokio::test]
+async fn a_pause_that_lands_after_the_check_stops_the_run_at_the_next_batch() {
+    use std::sync::atomic::{AtomicUsize, Ordering};
+    let tmp = tempfile::tempdir().unwrap();
+    let config = config_in(&tmp);
+    legacy_workspace(&config.workspace_dir);
+    let engine = bind_reference(&config);
+    quit_mid_import(&config);
+
+    // Not paused when the resume checks, paused by the time the run asks.
+    let asked = Arc::new(AtomicUsize::new(0));
+    let counter = asked.clone();
+    let paused: PauseCheck = Arc::new(move || counter.fetch_add(1, Ordering::SeqCst) > 0);
+
+    assert!(resume_interrupted_with(&config, paused).await);
+    wait_until_no_live_run(&config).await;
+    assert!(asked.load(Ordering::SeqCst) >= 2, "the run asked again");
+    assert!(
+        stored(&engine, MetaFilter::default()).await.is_empty(),
+        "nothing uploaded once paused"
+    );
+    let file = read_file(&config.workspace_dir);
+    assert_eq!(file.state.phase, ImportPhase::Running, "left resumable");
+    assert_eq!(file.checkpoint.documents.as_deref(), Some("d1"));
+
+    // Unpaused, the next tick finishes it from the checkpoint.
+    assert!(resume_interrupted_with(&config, always(false)).await);
+    assert_eq!(wait_until_settled(&config).await.phase, ImportPhase::Done);
+    assert_eq!(stored(&engine, MetaFilter::default()).await.len(), 4);
+}
+
 #[tokio::test]
 async fn an_automatic_resume_that_cannot_start_is_stopped_not_retried() {
     let tmp = tempfile::tempdir().unwrap();
@@ -519,8 +562,7 @@ async fn an_automatic_resume_that_cannot_start_is_stopped_not_retried() {
     // No engine bound: memory is off, so `start` fails before any run.
     quit_mid_import(&config);
 
-    let policy = crate::cron::scheduler_gate::Policy::Normal;
-    assert!(!resume_interrupted_with(&config, policy).await);
+    assert!(!resume_interrupted_with(&config, always(false)).await);
     let state = read_file(&config.workspace_dir).state;
     assert_eq!(state.phase, ImportPhase::Error);
     assert_eq!(state.imported, 1, "progress is kept");
@@ -529,7 +571,7 @@ async fn an_automatic_resume_that_cannot_start_is_stopped_not_retried() {
         "{state:?}"
     );
     // The next tick does not try again; the user resumes it.
-    assert!(!resume_interrupted_with(&config, policy).await);
+    assert!(!resume_interrupted_with(&config, always(false)).await);
     assert_eq!(
         read_file(&config.workspace_dir)
             .checkpoint
```

**File**: `docs/TEST-COVERAGE-MATRIX.md` (modified, +1/-1)
```diff
@@ -365,7 +365,7 @@ Spec: `docs/specs/memory-v2.md` (host) and `vendor/tinymemory/docs/specs/memory-
 | 8.2.5 | Document sources: add, sync, list, remove | RU+RI+WD | `crates/openhuman-core/src/memory/sources/sync_tests.rs`, `crates/openhuman-core/src/memory/sources/composio_tests.rs`, `crates/openhuman-core/src/memory/sources/mod_tests.rs`, `tests/memory_v2_e2e.rs` (`sources_add_sync_list_and_remove`), `app/test/playwright/specs/memory-v2.spec.ts` | ✅ | folder, file, link, github, rss, composio |
 | 8.2.6 | Folder-source path picker                | RU+VU | `crates/openhuman-app/src/directory_picker.rs`, `app/src/utils/tauriCommands/directoryPicker.test.ts` | ✅ | |
 | 8.2.7 | Pack preview (Ask tab) and brain views | RU+RI+WD | `crates/openhuman-core/src/memory/lifecycle/views_tests.rs`, `crates/openhuman-core/src/memory/brain_tests.rs`, `tests/memory_v2_e2e.rs`, `app/test/playwright/specs/memory-v2.spec.ts` | ✅ | No `context.md`; pack never persisted in the transcript |
-| 8.2.8 | One-time import of previous (v1) memory  | RU+RI+WD | `crates/openhuman-core/src/memory/import_tests.rs`, `tests/memory_v2_e2e.rs`, `app/test/playwright/specs/memory-v2.spec.ts` (`importing previous memory needs explicit consent`, `a stopped import resumes only after consent`), `app/src/components/memory/MemoryImportBanner.test.tsx` | ✅ | Refused without consent; stops (not skips) on exhausted credits or an unreachable engine; resumes on its own after the app quits (unless background work is paused; a resume that cannot start is stopped, not retried); Resume button after an error |
+| 8.2.8 | One-time import of previous (v1) memory  | RU+RI+WD | `crates/openhuman-core/src/memory/import_tests.rs`, `tests/memory_v2_e2e.rs`, `app/test/playwright/specs/memory-v2.spec.ts` (`importing previous memory needs explicit consent`, `a stopped import resumes only after consent`), `app/src/components/memory/MemoryImportBanner.test.tsx` | ✅ | Refused without consent; stops (not skips) on exhausted credits or an unreachable engine (`exhausted_credits_stop_the_import_instead_of_skipping_everything`, `an_unreachable_engine_stops_the_import_and_a_retry_resumes_it`); the background job resumes an import the app quit during (`the_background_job_resumes_an_interrupted_import`), never while paused, including a pause mid-run (`nothing_resumes_while_background_work_is_paused`, `a_pause_that_lands_after_the_check_stops_the_run_at_the_next_batch`); a resume that cannot start is stopped, not retried (`an_automatic_resume_that_cannot_start_is_stopped_not_retried`); Resume button after an error, behind consent (`a stopped import resumes only after consent`) |
 | 8.2.9 | MCP memory tools                         | RU | `crates/openhuman-core/src/mcp/server/tools/` | ✅ | `memory.recall`, `memory.fetch`, `memory.list`, `memory.learn`, `memory.forget` |
 | 8.2.10 | Memory UI chips and legacy redirects    | VU+WD | `app/src/components/memory/*.test.tsx`, `app/test/playwright/specs/memory-v2.spec.ts` | ✅ | Engine, Ask, Explorer, Learnings, Conversations, Brain, Background, Settings; `/brain` and `/settings/memory-engine` redirect |
 
```

---

### Incident Patch 12: `a8ca386f` (2026-10-05)
**Commit Message**: chore(vendor): bump tinymemory for the legacy import taint fix

Move vendor/tinymemory to the commit of tinyhumansai/tinymemory#201: the
v1 importer now tags items from externally synced memory_docs rows with
taint:external_sync (import::EXTERNAL_SYNC_TAG) instead of dropping the
v1 taint. The other 25 commits since the old pin are memory-eval
examples, docs and scripts; no library API changes.

Part of #7005.

**File**: `vendor/tinymemory` (modified, +1/-1)
```diff
@@ -1 +1 @@
-Subproject commit 4b1832311fce41152ce143e7ce209e62f82c6add
+Subproject commit 8d9a24f7a9f6eda23c80f14b4c3c0656218d1208
```

---

### Incident Patch 13: `5ae945d2` (2026-10-05)
**Commit Message**: fix(memory): re-read import state before recording a failed resume

Only the phase and reason change; the persisted progress and checkpoint
stay as they were. The test now also resumes after the failure and checks
the import continues from the checkpoint without re-sending stored items.

**File**: `crates/openhuman-core/src/memory/import.rs` (modified, +5/-2)
```diff
@@ -246,8 +246,7 @@ pub(crate) async fn resume_interrupted_with(
     config: &Config,
     policy: crate::cron::scheduler_gate::Policy,
 ) -> bool {
-    let mut file = read_file(&config.workspace_dir);
-    if file.state.phase != ImportPhase::Running {
+    if read_file(&config.workspace_dir).state.phase != ImportPhase::Running {
         return false;
     }
     let live = RUNNING
@@ -278,6 +277,10 @@ pub(crate) async fn resume_interrupted_with(
                 code = error.code(),
                 "[memory:import] interrupted import could not resume; stopped"
             );
+            // Re-read so only the phase and reason change: the progress and
+            // the checkpoint stay exactly as persisted, and the user's Resume
+            // continues from there.
+            let mut file = read_file(&config.workspace_dir);
             file.state.phase = ImportPhase::Error;
             file.state.error = Some(format!("the import could not resume: {error}"));
             write_file(&config.workspace_dir, &file);
```

**File**: `crates/openhuman-core/src/memory/import_tests.rs` (modified, +14/-1)
```diff
@@ -535,6 +535,19 @@ async fn an_automatic_resume_that_cannot_start_is_stopped_not_retried() {
             .checkpoint
             .documents
             .as_deref(),
-        Some("d1")
+        Some("d1"),
+        "the checkpoint read back from disk survives the failure"
+    );
+
+    // And the user's Resume continues from that checkpoint, not the start.
+    let engine = bind_reference(&config);
+    start(&config, true).await.unwrap();
+    let done = wait_until_settled(&config).await;
+    assert_eq!(done.phase, ImportPhase::Done, "{done:?}");
+    assert_eq!(done.imported, 5);
+    assert_eq!(
+        stored(&engine, MetaFilter::default()).await.len(),
+        4,
+        "d1 is not re-sent"
     );
 }
```

---

### Incident Patch 14: `3b4415f2` (2026-10-05)
**Commit Message**: fix(memory): tell a credit refusal and an outage apart from an empty memory (#6718)

Memory v2 folded the hosted engine's 402 and every transport fault into the
generic ENGINE code, and a refused pre-turn recall only logged a warning, so
a user out of credits got turns that read as "nothing is stored". Both were
fixed for the old memory module in #6841 and did not survive the rewrite.

- MemoryError gains INSUFFICIENT_CREDITS (via tinymemory's
  is_insufficient_credits) and UNAVAILABLE, plus is_account_wide().
- pre_turn: when nothing was recalled because the engine refused the account,
  the turn gets a short notice saying memory is unavailable and why. The
  refusal is read from the hook's errors and from holistic recall's skipped
  sections, which is where a section's engine error ends up.
- Source sync stops on any account-wide refusal instead of failing each item.
- Background jobs: an account-wide refusal no longer uses up an attempt, so a
  belief build waits for credits instead of being dropped after five runs;
  the run that does drop a job says so.
- UI: memoryErrorMessage(err, t) shows translated text for the two new codes
  in all 14 locales.

**File**: `app/src/components/memory/MemoryAskTab.tsx` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ export default function MemoryAskTab({ fetchModes }: MemoryAskTabProps) {
       }
     } catch (err) {
       log('%s failed: %o', raw ? 'fetch' : 'recall', err);
-      setError(memoryErrorMessage(err));
+      setError(memoryErrorMessage(err, t));
     } finally {
       setBusy(false);
     }
```

**File**: `app/src/components/memory/MemoryBackgroundTab.tsx` (modified, +5/-5)
```diff
@@ -44,12 +44,12 @@ export default function MemoryBackgroundTab() {
       setError(null);
     } catch (err) {
       log('jobs_list failed: %o', err);
-      setError(memoryErrorMessage(err));
+      setError(memoryErrorMessage(err, t));
       setJobs(prev => prev ?? { pending: [], history: [] });
     } finally {
       setRefreshing(false);
     }
-  }, []);
+  }, [t]);
 
   useEffect(() => {
     let cancelled = false;
@@ -60,13 +60,13 @@ export default function MemoryBackgroundTab() {
       .catch(err => {
         if (cancelled) return;
         log('jobs_list failed: %o', err);
-        setError(memoryErrorMessage(err));
+        setError(memoryErrorMessage(err, t));
         setJobs({ pending: [], history: [] });
       });
     return () => {
       cancelled = true;
     };
-  }, []);
+  }, [t]);
 
   const run = async (id?: string) => {
     const key = id ?? '*';
@@ -80,7 +80,7 @@ export default function MemoryBackgroundTab() {
       await reload();
     } catch (err) {
       log('jobs_run failed: %o', err);
-      setError(memoryErrorMessage(err));
+      setError(memoryErrorMessage(err, t));
     } finally {
       setRunning(prev => {
         const next = new Set(prev);
```

**File**: `app/src/components/memory/MemoryBrainSearch.tsx` (modified, +1/-1)
```diff
@@ -47,7 +47,7 @@ export default function MemoryBrainSearch({ sources }: MemoryBrainSearchProps) {
       setHits(res.hits ?? []);
     } catch (err) {
       log('search failed: %o', err);
-      setError(memoryErrorMessage(err));
+      setError(memoryErrorMessage(err, t));
     } finally {
       setBusy(false);
     }
```

**File**: `app/src/components/memory/MemoryBrainTab.tsx` (modified, +6/-6)
```diff
@@ -51,10 +51,10 @@ export default function MemoryBrainTab() {
       setError(null);
     } catch (err) {
       log('brain_sources failed: %o', err);
-      setError(memoryErrorMessage(err));
+      setError(memoryErrorMessage(err, t));
       setBrain(prev => prev ?? { root: '', sources: [], unfiled: 0 });
     }
-  }, []);
+  }, [t]);
 
   useEffect(() => {
     let cancelled = false;
@@ -67,13 +67,13 @@ export default function MemoryBrainTab() {
       .catch(err => {
         if (cancelled) return;
         log('brain_sources failed: %o', err);
-        setError(memoryErrorMessage(err));
+        setError(memoryErrorMessage(err, t));
         setBrain({ root: '', sources: [], unfiled: 0 });
       });
     return () => {
       cancelled = true;
     };
-  }, []);
+  }, [t]);
 
   const ingest = async (req: BrainIngestRequest): Promise<boolean> => {
     setSaving(true);
@@ -91,7 +91,7 @@ export default function MemoryBrainTab() {
       return true;
     } catch (err) {
       log('brain_ingest failed: %o', err);
-      setAddError(memoryErrorMessage(err));
+      setAddError(memoryErrorMessage(err, t));
       return false;
     } finally {
       setSaving(false);
@@ -117,7 +117,7 @@ export default function MemoryBrainTab() {
       await reload();
     } catch (err) {
       log('brain_forget failed: %o', err);
-      setError(memoryErrorMessage(err));
+      setError(memoryErrorMessage(err, t));
       setForgetTarget(null);
     } finally {
       setSaving(false);
```

**File**: `app/src/components/memory/MemoryConversationsBackfill.tsx` (modified, +5/-5)
```diff
@@ -47,9 +47,9 @@ export default function MemoryConversationsBackfill() {
       setView(next);
     } catch (err) {
       log('status failed: %o', err);
-      setError(memoryErrorMessage(err));
+      setError(memoryErrorMessage(err, t));
     }
-  }, []);
+  }, [t]);
 
   useEffect(() => {
     let cancelled = false;
@@ -60,12 +60,12 @@ export default function MemoryConversationsBackfill() {
       .catch(err => {
         if (cancelled) return;
         log('status failed: %o', err);
-        setError(memoryErrorMessage(err));
+        setError(memoryErrorMessage(err, t));
       });
     return () => {
       cancelled = true;
     };
-  }, []);
+  }, [t]);
 
   const running = view?.state.phase === 'running';
   useEffect(() => {
@@ -83,7 +83,7 @@ export default function MemoryConversationsBackfill() {
       setView(next);
     } catch (err) {
       log('start failed: %o', err);
-      setError(memoryErrorMessage(err));
+      setError(memoryErrorMessage(err, t));
     } finally {
       setStarting(false);
       setConsentOpen(false);
```

**File**: `app/src/components/memory/MemoryConversationsTab.tsx` (modified, +26/-23)
```diff
@@ -50,21 +50,21 @@ export default function MemoryConversationsTab() {
         setPolicy(got.value);
       } else {
         log('policy_get failed: %o', got.reason);
-        setError(memoryErrorMessage(got.reason));
+        setError(memoryErrorMessage(got.reason, t));
       }
       if (list.status === 'fulfilled') {
         log('agents: %d', list.value.agents?.length ?? 0);
         setAgents(list.value.agents ?? []);
       } else {
         log('agents_list failed: %o', list.reason);
-        setError(prev => prev ?? memoryErrorMessage(list.reason));
+        setError(prev => prev ?? memoryErrorMessage(list.reason, t));
         setAgents([]);
       }
     });
     return () => {
       cancelled = true;
     };
-  }, []);
+  }, [t]);
 
   const setLogging = async (next: boolean) => {
     setSaving(true);
@@ -74,31 +74,34 @@ export default function MemoryConversationsTab() {
       setPolicy(await memoryPolicySet({ log_conversations: next }));
     } catch (err) {
       log('policy_set failed: %o', err);
-      setError(memoryErrorMessage(err));
+      setError(memoryErrorMessage(err, t));
     } finally {
       setSaving(false);
     }
   };
 
-  const loadItems = useCallback(async (agentId: string, after: string | null) => {
-    setLoadingItems(true);
-    try {
-      const page = await memoryItemsList({
-        filter: { kinds: ['conversation'], agent_id: agentId },
-        limit: PAGE_SIZE,
-        cursor: after ?? undefined,
-      });
-      log('items: agent=%s n=%d more=%s', agentId, page.items?.length ?? 0, !!page.next_cursor);
-      setItems(prev => [...(after ? (prev ?? []) : []), ...(page.items ?? [])]);
-      setCursor(page.next_cursor ?? null);
-    } catch (err) {
-      log('items_list failed: %o', err);
-      setError(memoryErrorMessage(err));
-      setItems(prev => prev ?? []);
-    } finally {
-      setLoadingItems(false);
-    }
-  }, []);
+  const loadItems = useCallback(
+    async (agentId: string, after: string | null) => {
+      setLoadingItems(true);
+      try {
+        const page = await memoryItemsList({
+          filter: { kinds: ['conversation'], agent_id: agentId },
+          limit: PAGE_SIZE,
+          cursor: after ?? undefined,
+        });
+        log('items: agent=%s n=%d more=%s', agentId, page.items?.length ?? 0, !!page.next_cursor);
+        setItems(prev => [...(after ? (prev ?? []) : []), ...(page.items ?? [])]);
+        setCursor(page.next_cursor ?? null);
+      } catch (err) {
+        log('items_list failed: %o', err);
+        setError(memoryErrorMessage(err, t));
+        setItems(prev => prev ?? []);
+      } finally {
+        setLoadingItems(false);
+      }
+    },
+    [t]
+  );
 
   const toggleAgent = (agentId: string) => {
     if (openAgent === agentId) {
```

**File**: `app/src/components/memory/MemoryEngineTab.tsx` (modified, +4/-4)
```diff
@@ -64,12 +64,12 @@ export default function MemoryEngineTab({ state, onStateChange, embedded }: Memo
       .catch(err => {
         if (cancelled) return;
         log('engines list failed: %o', err);
-        setLoadError(memoryErrorMessage(err));
+        setLoadError(memoryErrorMessage(err, t));
       });
     return () => {
       cancelled = true;
     };
-  }, []);
+  }, [t]);
 
   const select = useCallback(
     async (req: EngineSetRequest): Promise<boolean> => {
@@ -82,13 +82,13 @@ export default function MemoryEngineTab({ state, onStateChange, embedded }: Memo
         return true;
       } catch (err) {
         log('engine set failed: %o', err);
-        setSaveError(memoryErrorMessage(err));
+        setSaveError(memoryErrorMessage(err, t));
         return false;
       } finally {
         setSaving(false);
       }
     },
-    [onStateChange]
+    [onStateChange, t]
   );
 
   const activeId = state?.engine ?? null;
```

**File**: `app/src/components/memory/MemoryExplorerTab.tsx` (modified, +5/-5)
```diff
@@ -72,12 +72,12 @@ export default function MemoryExplorerTab() {
       .catch(err => {
         if (cancelled) return;
         log('explore failed: %o', err);
-        setError(memoryErrorMessage(err));
+        setError(memoryErrorMessage(err, t));
       });
     return () => {
       cancelled = true;
     };
-  }, [facet, path, reloadKey]);
+  }, [facet, path, reloadKey, t]);
 
   useEffect(() => {
     let cancelled = false;
@@ -90,13 +90,13 @@ export default function MemoryExplorerTab() {
       .catch(err => {
         if (cancelled) return;
         log('list failed: %o', err);
-        setError(memoryErrorMessage(err));
+        setError(memoryErrorMessage(err, t));
         setItems([]);
       });
     return () => {
       cancelled = true;
     };
-  }, [path, reloadKey]);
+  }, [path, reloadKey, t]);
 
   const goTo = useCallback((next: PathStep[]) => {
     setError(null);
@@ -114,7 +114,7 @@ export default function MemoryExplorerTab() {
       setItems(prev => [...(prev ?? []), ...(next.items ?? [])]);
       setCursor(next.next_cursor ?? null);
     } catch (err) {
-      setError(memoryErrorMessage(err));
+      setError(memoryErrorMessage(err, t));
     } finally {
       setLoadingMore(false);
     }
```

---

### Incident Patch 15: `a9b47c2b` (2026-10-05)
**Commit Message**: fix(memory): honor the scheduler pause and stop a resume that cannot start

Review follow-up on the automatic resume of an interrupted v1 import.

- resume_interrupted_with(config, policy): nothing resumes while background
  work is paused (which includes being signed out); the state stays
  Running so a later tick resumes it. The background job passes the
  scheduler's current policy.
- a resume whose start fails (memory off, store gone) is persisted as
  Error with the reason, so it is not retried every tick; progress is kept
  and the user resumes it from the banner.
- tests: the memory background job dispatches the resume; paused leaves
  it resumable; a failed start is stopped, not retried.
- Playwright: a stopped import shows its reason and resumes only after
  consent, from its stored progress.

**File**: `app/test/playwright/specs/memory-v2.spec.ts` (modified, +42/-2)
```diff
@@ -58,6 +58,8 @@ interface FakeOptions {
   engineOn: boolean;
   /** `memory_import_scan` finds v1 data to import. */
   importFound?: boolean;
+  /** An earlier import stopped with this error (e.g. credits ran out) after 7 of 20 items. */
+  importStoppedWith?: string;
 }
 
 interface RpcCall {
@@ -95,7 +97,9 @@ async function installMemoryFake(page: Page, opts: FakeOptions): Promise<MemoryF
   ];
   const sources: Array<Record<string, unknown>> = [];
   let nextId = 1;
-  let importState = { phase: 'idle', imported: 0, total: 0, error: null as string | null };
+  let importState = opts.importStoppedWith
+    ? { phase: 'error', imported: 7, total: 20, error: opts.importStoppedWith as string | null }
+    : { phase: 'idle', imported: 0, total: 0, error: null as string | null };
 
   const policy = {
     log_conversations: true,
@@ -263,7 +267,8 @@ async function installMemoryFake(page: Page, opts: FakeOptions): Promise<MemoryF
           ? { found: true, counts: { documents: 12, conversations: 3, learnings: 5 } }
           : { found: false, counts: null };
       case 'memory_import_start':
-        importState = { phase: 'running', imported: 0, total: 20, error: null };
+        // A restart resumes from the persisted progress.
+        importState = { phase: 'running', imported: importState.imported, total: 20, error: null };
         return { state: importState };
       case 'memory_import_status': {
         const current = importState;
@@ -433,6 +438,41 @@ test.describe('Memory v2 — engine active', () => {
     await expect(page.getByTestId('memory-import-done')).toBeVisible({ timeout: 15_000 });
   });
 
+  test('a stopped import resumes only after consent', async ({ page }) => {
+    const stopped =
+      'not enough credits to import your memory; top up, then resume the import to continue where it stopped';
+    const fake = await installMemoryFake(page, {
+      engineOn: true,
+      importFound: true,
+      importStoppedWith: stopped,
+    });
+    await bootAuthenticatedPage(page, 'pw-memory-v2-import-resume');
+    await openMemory(page, '&brain=ask');
+
+    // The stopped import shows its reason and a Resume control, not the fresh offer.
+    const failed = page.getByTestId('memory-import-error');
+    await expect(failed).toBeVisible({ timeout: 20_000 });
+    await expect(failed).toContainText('not enough credits');
+    await expect(page.getByTestId('memory-import-open')).toHaveCount(0);
+
+    // Resume asks again; nothing restarts until the user confirms.
+    await page.getByTestId('memory-import-resume').click();
+    const consent = page.getByTestId('memory-import-consent');
+    await expect(consent).toBeVisible();
+    expect(fake.paramsOf('memory_import_start')).toEqual([]);
+
+    await page.getByTestId('memory-import-confirm').click();
+    await expect(consent).toBeHidden();
+    expect(fake.paramsOf('memory_import_start')).toEqual([{ consent: true }]);
+
+    // It picks up from the stored progress and finishes.
+    await expect(
+      page.getByTestId('memory-import-running').or(page.getByTestId('memory-import-done'))
+    ).toBeVisible();
+    await expect(page.getByTestId('memory-import-done')).toBeVisible({ timeout: 15_000 });
+    await expect(page.getByTestId('memory-import-resume')).toHaveCount(0);
+  });
+
   test('legacy Brain and settings links land on their v2 chips', async ({ page }) => {
     await installMemoryFake(page, { engineOn: true });
     await bootAuthenticatedPage(page, 'pw-memory-v2-legacy');
```

**File**: `crates/openhuman-core/src/memory/import.rs` (modified, +34/-9)
```diff
@@ -224,15 +224,30 @@ pub fn status(config: &Config) -> ImportState {
     state
 }
 
-/// Resumes an import the app quit in the middle of, if there is one.
+/// Resumes an import the app quit in the middle of, if there is one, under
+/// the scheduler's current policy ([`resume_interrupted_with`]). Called from
+/// memory's background job.
+pub async fn resume_interrupted(config: &Config) -> bool {
+    resume_interrupted_with(config, crate::cron::scheduler_gate::current_policy()).await
+}
+
+/// Resumes an interrupted import under `policy`.
 ///
 /// Only a `Running` state with no live run counts: the user consented when
-/// it started, and quitting the app is not a decision to stop. An import that
-/// stopped on an error (credits exhausted, signed out) stays stopped until the
-/// user starts it again, so a failure that would recur does not loop. Returns
-/// whether a run was started. Called from memory's background job.
-pub async fn resume_interrupted(config: &Config) -> bool {
-    if read_file(&config.workspace_dir).state.phase != ImportPhase::Running {
+/// it started, and quitting the app is not a decision to stop. Nothing
+/// resumes while background work is paused (which includes being signed
+/// out); the state stays `Running`, so a later tick resumes it. An import
+/// that stopped on an error (credits exhausted, engine unreachable) stays
+/// stopped until the user starts it again, and so does one whose automatic
+/// resume could not start: that failure is persisted as `Error`, so a
+/// failure that would recur does not loop. Returns whether a run was
+/// started.
+pub(crate) async fn resume_interrupted_with(
+    config: &Config,
+    policy: crate::cron::scheduler_gate::Policy,
+) -> bool {
+    let mut file = read_file(&config.workspace_dir);
+    if file.state.phase != ImportPhase::Running {
         return false;
     }
     let live = RUNNING
@@ -242,6 +257,13 @@ pub async fn resume_interrupted(config: &Config) -> bool {
     if live {
         return false;
     }
+    if let crate::cron::scheduler_gate::Policy::Paused { reason } = policy {
+        tracing::debug!(
+            ?reason,
+            "[memory:import] background paused; interrupted import left for later"
+        );
+        return false;
+    }
     match start(config, true).await {
         Ok(state) => {
             tracing::info!(
@@ -252,10 +274,13 @@ pub async fn resume_interrupted(config: &Config) -> bool {
             true
         }
         Err(error) => {
-            tracing::debug!(
+            tracing::warn!(
                 code = error.code(),
-                "[memory:import] interrupted import not resumed"
+                "[memory:import] interrupted import could not resume; stopped"
             );
+            file.state.phase = ImportPhase::Error;
+            file.state.error = Some(format!("the import could not resume: {error}"));
+            write_file(&config.workspace_dir, &file);
             false
         }
     }
```

**File**: `crates/openhuman-core/src/memory/import_tests.rs` (modified, +87/-0)
```diff
@@ -451,3 +451,90 @@ async fn a_stopped_or_finished_import_is_not_resumed_on_its_own() {
     }
     assert!(stored(&engine, MetaFilter::default()).await.is_empty());
 }
+
+/// A persisted `Running` import with no live run: what the app leaves behind
+/// when it quits mid-import after storing d1.
+fn quit_mid_import(config: &Config) {
+    write_file(
+        &config.workspace_dir,
+        &ImportFile {
+            state: ImportState {
+                phase: ImportPhase::Running,
+                imported: 1,
+                total: 5,
+                error: None,
+            },
+            checkpoint: Checkpoint {
+                documents: Some("d1".into()),
+                ..Checkpoint::default()
+            },
+        },
+    );
+}
+
+#[tokio::test]
+async fn the_background_job_resumes_an_interrupted_import() {
+    let tmp = tempfile::tempdir().unwrap();
+    let config = config_in(&tmp);
+    legacy_workspace(&config.workspace_dir);
+    let engine = bind_reference(&config);
+    quit_mid_import(&config);
+
+    crate::memory::bus::run_system_job(&config, crate::memory::lifecycle::jobs::BACKGROUND_JOB)
+        .await;
+    let done = wait_until_settled(&config).await;
+    assert_eq!(done.phase, ImportPhase::Done, "{done:?}");
+    assert_eq!(stored(&engine, MetaFilter::default()).await.len(), 4);
+}
+
+#[tokio::test]
+async fn nothing_resumes_while_background_work_is_paused() {
+    use crate::cron::scheduler_gate::{PauseReason, Policy};
+    let tmp = tempfile::tempdir().unwrap();
+    let config = config_in(&tmp);
+    legacy_workspace(&config.workspace_dir);
+    let engine = bind_reference(&config);
+    quit_mid_import(&config);
+
+    let paused = Policy::Paused {
+        reason: PauseReason::UserDisabled,
+    };
+    assert!(!resume_interrupted_with(&config, paused).await);
+    assert!(stored(&engine, MetaFilter::default()).await.is_empty());
+    assert_eq!(
+        read_file(&config.workspace_dir).state.phase,
+        ImportPhase::Running,
+        "left resumable for a later, unpaused tick"
+    );
+
+    assert!(resume_interrupted_with(&config, Policy::Normal).await);
+    assert_eq!(wait_until_settled(&config).await.phase, ImportPhase::Done);
+}
+
+#[tokio::test]
+async fn an_automatic_resume_that_cannot_start_is_stopped_not_retried() {
+    let tmp = tempfile::tempdir().unwrap();
+    let config = config_in(&tmp);
+    legacy_workspace(&config.workspace_dir);
+    // No engine bound: memory is off, so `start` fails before any run.
+    quit_mid_import(&config);
+
+    let policy = crate::cron::scheduler_gate::Policy::Normal;
+    assert!(!resume_interrupted_with(&config, policy).await);
+    let state = read_file(&config.workspace_dir).state;
+    assert_eq!(state.phase, ImportPhase::Error);
+    assert_eq!(state.imported, 1, "progress is kept");
+    assert!(
+        state.error.as_deref().unwrap().contains("could not resume"),
+        "{state:?}"
+    );
+    // The next tick does not try again; the user resumes it.
+    assert!(!resume_interrupted_with(&config, policy).await);
+    assert_eq!(
+        read_file(&config.workspace_dir)
+            .checkpoint
+            .documents
+            .as_deref(),
+        Some("d1")
+    );
+}
```

**File**: `docs/TEST-COVERAGE-MATRIX.md` (modified, +1/-1)
```diff
@@ -365,7 +365,7 @@ Spec: `docs/specs/memory-v2.md` (host) and `vendor/tinymemory/docs/specs/memory-
 | 8.2.5 | Document sources: add, sync, list, remove | RU+RI+WD | `crates/openhuman-core/src/memory/sources/sync_tests.rs`, `crates/openhuman-core/src/memory/sources/composio_tests.rs`, `crates/openhuman-core/src/memory/sources/mod_tests.rs`, `tests/memory_v2_e2e.rs` (`sources_add_sync_list_and_remove`), `app/test/playwright/specs/memory-v2.spec.ts` | ✅ | folder, file, link, github, rss, composio |
 | 8.2.6 | Folder-source path picker                | RU+VU | `crates/openhuman-app/src/directory_picker.rs`, `app/src/utils/tauriCommands/directoryPicker.test.ts` | ✅ | |
 | 8.2.7 | Pack preview (Ask tab) and brain views | RU+RI+WD | `crates/openhuman-core/src/memory/lifecycle/views_tests.rs`, `crates/openhuman-core/src/memory/brain_tests.rs`, `tests/memory_v2_e2e.rs`, `app/test/playwright/specs/memory-v2.spec.ts` | ✅ | No `context.md`; pack never persisted in the transcript |
-| 8.2.8 | One-time import of previous (v1) memory  | RU+RI+WD | `crates/openhuman-core/src/memory/import_tests.rs`, `tests/memory_v2_e2e.rs`, `app/test/playwright/specs/memory-v2.spec.ts` (`importing previous memory needs explicit consent`), `app/src/components/memory/MemoryImportBanner.test.tsx` | ✅ | Refused without consent; stops (not skips) on exhausted credits or an unreachable engine; resumes on its own after the app quits; Resume button after an error |
+| 8.2.8 | One-time import of previous (v1) memory  | RU+RI+WD | `crates/openhuman-core/src/memory/import_tests.rs`, `tests/memory_v2_e2e.rs`, `app/test/playwright/specs/memory-v2.spec.ts` (`importing previous memory needs explicit consent`, `a stopped import resumes only after consent`), `app/src/components/memory/MemoryImportBanner.test.tsx` | ✅ | Refused without consent; stops (not skips) on exhausted credits or an unreachable engine; resumes on its own after the app quits (unless background work is paused; a resume that cannot start is stopped, not retried); Resume button after an error |
 | 8.2.9 | MCP memory tools                         | RU | `crates/openhuman-core/src/mcp/server/tools/` | ✅ | `memory.recall`, `memory.fetch`, `memory.list`, `memory.learn`, `memory.forget` |
 | 8.2.10 | Memory UI chips and legacy redirects    | VU+WD | `app/src/components/memory/*.test.tsx`, `app/test/playwright/specs/memory-v2.spec.ts` | ✅ | Engine, Ask, Explorer, Learnings, Conversations, Brain, Background, Settings; `/brain` and `/settings/memory-engine` redirect |
 
```

#### Recent Merged Pull Requests:
- **PR #7015** (2026-10-06): ci(lanes): install node deps for rust-core-coverage on a core-only change (@CodeGhost21)
- **PR #7014** (2026-10-06): fix(memory): say beliefs are still building instead of showing an empty memory (#6718) (@CodeGhost21)
- **PR #7013** (2026-10-05): fix(memory): tell a credit refusal and an outage apart from an empty memory (#6718) (@CodeGhost21)
- **PR #7012** (2026-10-05): chore(vendor): bump tinymemory for the legacy import taint fix (@CodeGhost21)
- **PR #7011** (2026-10-05): fix(memory): stop a v1 import on credits or outage instead of skipping every item (@CodeGhost21)
- **PR #7009** (2026-10-05): feat(onboarding): cut the local path to three steps and stop it lying (@graycyrus)
- **PR #7008** (2026-10-05): fix(computer): make TinyComputer browser tasks runnable from the app (@YellowSnnowmann)
- **PR #7004** (2026-10-05): fix(search): stop re-offering search a session cannot use (@obchain)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
