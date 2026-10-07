# Forensic Learning Record (Deep Inspection): feder-cr/invisible_dots

> **Canonical Artifact**: `07_PROJECT_LEARNING/feder-cr-invisible_dots-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/feder-cr/invisible_dots](https://github.com/feder-cr/invisible_dots))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-07T14:58:08.035Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `feder-cr/invisible_dots`
- **Description**: Open-source, self-hosted alternative to OpenAI Dots, Meta Muse, Grok Bot, Manus Cue and Claude Cowork. AI agents that each own a computer on your PC and browse on a stealth Firefox undetected by anti-bots. Any model on OpenRouter.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 31788 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/cli/src/doctor/render.ts`
```
/** The doctor report as text: one line per check, a fix line under each that is not ok, and a count. */
import type { DoctorCheck } from "@invisible-dots/shared";

const STATUS_WIDTH = "missing".length + 2;

export function renderReport(results: readonly DoctorCheck[]): string {
  const labelWidth = Math.max(...results.map((r) => r.label.length)) + 2;
  const indent = " ".repeat(STATUS_WIDTH + labelWidth);
  const lines: string[] = [];
  for (const r of results) {
    lines.push(`${r.status.padEnd(STATUS_WIDTH)}${r.label.padEnd(labelWidth)}${r.detail}`);
    if (r.status !== "ok" && r.fix) lines.push(`${indent}fix: ${r.fix}`);
  }
  const count = (status: DoctorCheck["status"]) => results.filter((r) => r.status === status).length;
  const ok = count("ok");
  lines.push(
    ok === results.length
      ? `all ${results.length} checks ok`
      : `${results.length} checks: ${ok} ok, ${count("missing")} missing, ${count("failed")} failed`,
  );
  return `${lines.join("\n")}\n`;
}

```

### Core Architecture Module: `apps/scheduler/src/lifecycle.ts`
```
/**
 * The life of a Dot's computer on the host: create (section 9.4), the READY
 * procedure (9.3), sleep and wake (9.5), reboot, delete, the guest event
 * pump, and reconciliation with the running QEMU processes (found through
 * their pid files) after a control plane restart.
 *
 * Every operation that changes a computer's state runs under a per-Dot lock,
 * so a wake and an idle sleep of the same Dot can never interleave. A Dot is
 * in `#ready` only between a completed READY procedure and the moment an
 * operation under that lock takes it out again, so anything that skips the
 * lock because the Dot is READY (a delivery, a push) can only meet a stop
 * that has not started yet: every stop takes the Dot out of `#ready` first.
 */
import { VM_PROXY_NAME, type Database, type Repositories } from "@invisible-dots/database";
import type { EventLog } from "@invisible-dots/events";
import {
  COMPUTER_STOPPED,
  computerIsUp,
  computerResources,
  PREPARE_SLEEP_TIMEOUT_MS,
  toRuntimeConfig,
  type DotState,
  type HealthAnswer,
  type HostEventDataMap,
  type HostEventType,
  type OutboundEvent,
  type RefusedEvent,
  type StopReason,
  type StoredEvent,
  type VmState,
} from "@invisible-dots/shared";
import { guestErrorCode, guestErrorStatus, type ComputerDriver, type ComputerSpecInput, type ComputerState, type GuestApi } from "./driver.js";
import { applyGuestEvent, dotStatusForAgent } from "./guest-events.js";
import { ControlPlaneError, errorMessage, KeyedMutex, sleep, type Clock, type Logger } from "./support.js";

export interface LifecycleOptions {
  /** How long a started VM may take to pass the READY procedure. Default 10 minutes (a first boot runs cloud-init). */
  readyTimeoutMs: number;
  /** Interval between health polls while waiting for READY. Default 2 s. */
  healthPollMs: number;
  /** Per-request timeout of a health poll. Default 5 s. */
  healthRequestTimeoutMs: number;
  /** First retry delay of the event pump after a failure; doubles up to `pumpMaxRetryMs`. */
  pumpRetryMs: number;
  pumpMaxRetryMs: number;
  /** Time the agent gets to flush its state before a shutdown (section 9.5). Default PREPARE_SLEEP_TIMEOUT_MS of packages/shared, which the engine's own steps fit inside. */
  prepareSleepTimeoutMs: number;
  /**
   * How long before an automation is due a stopped computer is started, and how close to one a running computer is
   * kept awake (section 9.5). It is the time a start takes to reach READY with some to spare; the passes that look
   * for the Dots to start run every few seconds, so the computer is up between this long and a pass before the run.
   * Default 90 s.
   */
  automationWakeLeadMs: number;
}

export const DEFAULT_LIFECYCLE_OPTIONS: LifecycleOptions = {
  readyTimeoutMs: 10 * 60_000,
  healthPollMs: 2_000,
  healthRequestTimeoutMs: 5_000,
  pumpRetryMs: 1_000,
  pumpMaxRetryMs: 30_000,
  prepareSleepTimeoutMs: PREPARE_SLEEP_TIMEOUT_MS,
  automationWakeLeadMs: 90_000,
};

export interface LifecycleDeps {
  db: Database;
  events: EventLog;
  driver: ComputerDriver;
  clock: Clock;
  logger: Logger;
  options?: Partial<LifecycleOptions>;
  /** Called when a task reached a terminal state or a Dot became READY: the dispatcher may have work to hand out. */
  onWorkPossible?: () => void;
  /** Called every time a Dot becomes READY: what waits in its inbound outbox can go now. */
  onReady?: (dotId: string) => void;
}

/** Why a stop is asked for: the idle sleep, or the person (`exited` is only ever recorded, never asked for). */
export type StopRequest = Exclude<StopReason, "exited">;

/** Part of the error a Dot gets when READY failed only for want of a key; setting a key retries those Dots. */
export const MISSING_KEY_MESSAGE = "no OpenRouter API key is configured";

/** The READY procedure failed; the message says which step and why. */
export class NotReadyError extends ControlPlaneError {
  constructor(dotId: string, message: string) {
    super(503, "computer_not_ready", `Dot ${dotId}: ${message}`);
    this.name = "NotReadyError";
  }
}

/**
 * A failed guest call described by its status and code only. Used where the
 * request carried a secret: the error text of a guest or a proxy may echo
 * the body, and this message goes into logs, `dots.error` and the event log.
 */
function describeWithoutBody(error: unknown): string {
  const status = guestErrorStatus(error);
  const code = guestErrorCode(error) ?? (error as { code?: unknown })?.code;
  return status === 0 ? `the guest was not reached${typeof code === "string" ? ` (${code})` : ""}` : `status ${status}${typeof code === "string" ? `, ${code}` : ""}`;
}

/** Store a host event through the transaction a change is made in (`Lifecycle.#commit`). */
type HostLog = <K extends HostEventType>(dotId: string, type: K, data: HostEventDataMap[K]) => Promise<void>;

export class Lifecycle {
  readonly #db: Database;
  readonly #events: EventLog;
  readonly #driver: ComputerDriver;
  readonly #clock: Clock;
  readonly #log: Logger;
  readonly #opts: LifecycleOptions;
  readonly #onWorkPossible: () => void;
  readonly #onReady: (dotId: string) => void;
  readonly #mutex = new KeyedMutex();
  /** Pushes of the key and the config to a READY guest, one at a time per Dot, so the last one sent is the newest. */
  readonly #pushes = new KeyedMutex();
  /** Bumped by every change of what a guest must hold; READY completes only on an unchanged generation. */
  readonly #generation = new Map<string, number>();
  /** Dots whose READY procedure completed since their computer last started. */
  readonly #ready = new Set<string>();
  readonly #pumps = new Map<string, AbortController>();
  readonly #pumpDone = new Map<string, Promise<void>>();
  readonly #background = new Set<Promise<unknown>>();
  #closed = false;

  constructor(deps: LifecycleDeps) {
    this.#db = deps.db;
    this.#events = deps.events;
    this.#driver = deps.driver;
    this.#clock = deps.clock;
    this.#log = deps.logger;
    this.#opts = { ...DEFAULT_LIFECYCLE_OPTIONS, ...deps.options };
    this.#onWorkPossible = deps.onWorkPossible ?? (() => {});
    this.#onReady = deps.onReady ?? (() => {});
  }

  isReady(dotId: string): boolean {
    return this.#ready.has(dotId);
  }

  /** Whether a lifecycle operation is queued or running for the Dot. */
  isBusy(dotId: string): boolean {
    return this.#mutex.isBusy(dotId);
  }

  /**
   * The guest of a running computer, reached through the port recorded at its
   * start. The port is read for every call: it changes with every start.
   */
  async guest(dotId: string): Promise<GuestApi> {
    const computer = await this.#db.computers.get(dotId);
    if (!computer) throw new ControlPlaneError(404, "not_found", `Dot ${dotId} has no computer`);
    if (computer.guest_port === null) {
      throw new ControlPlaneError(409, COMPUTER_STOPPED, `the computer of Dot ${dotId} is ${computer.state}, it has no guest port`);
    }
    return this.#driver.guest({ dotId, port: computer.guest_port }, await this.#db.computers.token(dotId));
  }

  /**
   * Run `write` in one transaction, and publish what it logged after COMMIT, in order. A change of state and the host
   * events that tell it commit together or not at all: a control plane killed between two writes leaves the state it
   * was in before the change (which recovery knows how to finish), never a state nobody was told of. `log` stores a host
   * event through the transaction. Like every transaction that inserts events and changes other rows, `write` logs first
   * and writes its rows after (the event insert takes the event-order lock, database events.ts).
   */
  async #commit<T>(write: (tx: Repositories, log: HostLog) => Promise<T>): Promise<T> {
    const { value, logged } = await this.#db.transaction(async (tx) => {
      const logged: StoredEvent[] = [];
      const log: HostLog = async (dotId, type, data) => {
        logged.push(await this.#events.appendHostIn(tx, dotId, type, data));
      };
      return { value: await write(tx, log), logged };
    });
    for (const event of logged) this.#events.publish(event);
    return value;
  }

  /** Log `computer.state` when the computer's row holds another state now; the caller writes the row after its events. */
  async #logState(tx: Repositories, log: HostLog, dotId: string, state: VmState): Promise<void> {
    if ((await tx.computers.get(dotId))?.state !== state) await log(dotId, "computer.state", { state });
  }

  /** Log `dot.updated` for the status ERROR (the other statuses are told by the events of what caused them); the caller writes the row after its events. */
  async #logDotStatus(tx: Repositories, log: HostLog, dotId: string, status: DotState, error: string | null): Promise<void> {
    const dot = status === "ERROR" ? await tx.dots.get(dotId) : null;
    if (dot) await log(dotId, "dot.updated", { name: dot.name, status, error });
  }

  async #setVmState(dotId: string, state: VmState, lastError?: string | null, stopReason?: StopReason): Promise<void> {
    await this.#commit(async (tx, log) => {
      await this.#logState(tx, log, dotId, state);
      await tx.computers.setState(dotId, state, lastError, stopReason);
    });
  }

  async #setDotStatus(dotId: string, status: DotState, error: string | null = null): Promise<void> {
    await this.#commit(async (tx, log) => {
      await this.#logDotStatus(tx, log, dotId, status, error);
      await tx.dots.setStatus(dotId, status, error);
    });
  }

  /**
   * The computer is up: its process, its images and its state RUNNING, with `computer.state` and `computer.started`,
   * in one write. From here on the guest is reached through this port.
   */
  async #recordStarted(
    dotId: string,
    started: { guestPort: number; pid: number; runtimeImage: string },
    goldenImage: string,
    extra: Record<string, unknown>,
  ): Promise<void> {
    await this.#commit(async (tx, log) => {
      await this.#logState(tx, log, dotId, "RUNNING");
      await log(do
```

### Core Architecture Module: `apps/web/src/components/channels/state-chip.tsx`
```
import type { ChannelRecord } from "@invisible-dots/shared/browser";
import { channelState } from "../../lib/channels";
import { cn } from "../../lib/utils";
import { TONE_CLASS, TONE_DOT } from "../dot/tone";

/** A channel's connection as a pill: a dot in the tone's color and the word. */
export function ChannelStateChip({ record }: { record: Pick<ChannelRecord, "enabled" | "status"> }) {
  const { label, tone } = channelState(record);
  return (
    <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium", TONE_CLASS[tone])}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", TONE_DOT[tone])} />
      <span className="sr-only">Status: </span>
      {label}
    </span>
  );
}

```

### Core Architecture Module: `apps/web/src/lib/utils.ts`
```
// Derived from shadcn/ui apps/v4/registry/new-york-v4/lib/utils.ts at 0e3abd65, MIT; changed: written out, since the registry file re-exports it from a placeholder module.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Class names joined, with the Tailwind utility that comes last winning over the ones it conflicts with. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

```

### Core Architecture Module: `invisible_engine_dots/nanobot/__init__.py`
```
"""
invisible_dots engine: a hard fork of nanobot (see UPSTREAM.md).
"""

import tomllib
from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as _pkg_version
from pathlib import Path

_DISTRIBUTION = "invisible-dots-engine"


def _read_pyproject_version() -> str | None:
    """Read the source-tree version when package metadata is unavailable."""
    pyproject = Path(__file__).resolve().parent.parent / "pyproject.toml"
    if not pyproject.exists():
        return None
    data = tomllib.loads(pyproject.read_text(encoding="utf-8"))
    return data.get("project", {}).get("version")


def _resolve_version() -> str:
    try:
        return _pkg_version(_DISTRIBUTION)
    except PackageNotFoundError:
        # The engine runs from a source tree on the runtime ISO, without dist-info.
        return _read_pyproject_version() or "0.1.0"


__version__ = _resolve_version()

```

### Core Architecture Module: `invisible_engine_dots/nanobot/__main__.py`
```
from nanobot.dots.main import main

if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `invisible_engine_dots/nanobot/agent/__init__.py`
```
"""The agent loop: the runner, its hooks, the context it builds and the tools it calls."""

```

### Core Architecture Module: `invisible_engine_dots/nanobot/agent/context.py`
```
"""Context builder for assembling the Dot's prompts."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Any, cast

from nanobot.dots.skills import DOT_SKILLS_DIR, Skill
from nanobot.session.summary import SessionSummary
from nanobot.utils.prompt_templates import render_template


@dataclass(frozen=True, slots=True)
class TranscriptInput:
    """Raw turn inputs from which ``ContextBuilder`` assembles a transcript."""

    history: list[dict[str, Any]]
    current_message: str | None
    current_role: str = "user"
    session_summary: SessionSummary | None = None


class ContextBuilder:
    """Builds the context (system prompt + messages) of one turn of the Dot."""

    def __init__(
        self,
        dot_prompt: str,
        *,
        workspace: str,
        memory_dir: str,
        memory_notes: Sequence[str],
        now: datetime,
        skills: Sequence[Skill] = (),
    ) -> None:
        """`dot_prompt` says whose Dot this is and what it is for (projection.py).

        `memory_notes` are the names of the most recently changed notes in `memory_dir`; `skills` are the Dot's
        skills (nanobot/dots/skills.py), named in the prompt with their descriptions and paths.
        """
        self.dot_prompt = dot_prompt
        self.workspace = workspace
        self.memory_dir = memory_dir
        self.memory_notes = memory_notes
        self.skills = skills
        self.now = now

    def build_system_prompt(self, *, session_summary: SessionSummary | None = None) -> str:
        """Build the system prompt: the Dot, the tool contract, its computer and the summary."""
        parts = [
            self.dot_prompt,
            render_template("agent/tool_contract.md"),
            render_template(
                "agent/platform.md",
                workspace=self.workspace,
                memory_dir=self.memory_dir,
                memory_notes=list(self.memory_notes),
                skills=list(self.skills),
                dot_skills_dir=DOT_SKILLS_DIR,
                now=self.now.strftime("%Y-%m-%d %H:%M %Z").strip(),
            ),
        ]
        if session_summary and session_summary["text"] != "(nothing)":
            parts.append(
                "[Archived Context Summary]\n\n"
                f"Previous conversation summary (last active {session_summary['last_active']}):\n"
                f"{session_summary['text']}"
            )
        return "\n\n---\n\n".join(parts)

    @staticmethod
    def _merge_message_content(left: Any, right: Any) -> str | list[dict[str, Any]]:
        if isinstance(left, str) and isinstance(right, str):
            if not left:
                return right
            if not right:
                return left
            return f"{left}\n\n{right}"

        def _to_blocks(value: Any) -> list[dict[str, Any]]:
            if isinstance(value, list):
                return [
                    cast(dict[str, Any], item)
                    if isinstance(item, dict)
                    else {"type": "text", "text": str(item)}
                    for item in cast(list[Any], value)
                ]
            if value is None:
                return []
            return [{"type": "text", "text": str(value)}]

        return _to_blocks(left) + _to_blocks(right)

    def build_transcript(self, transcript: TranscriptInput) -> list[dict[str, Any]]:
        """Build a model transcript while preserving the fresh-turn boundary."""
        messages: list[dict[str, Any]] = [
            {
                "role": "system",
                "content": self.build_system_prompt(session_summary=transcript.session_summary),
            },
            *transcript.history,
        ]
        if transcript.current_message is not None:
            messages.append({"role": transcript.current_role, "content": transcript.current_message})
        return messages

```

### Core Architecture Module: `invisible_engine_dots/nanobot/agent/context_governance.py`
```
"""Model-message governance and compaction for agent runner requests.

This module owns model-facing message shaping, request pressure, H/delta
compaction state, and tool-result content normalization. It may return copied
messages or persisted-result placeholders, but it must not mutate an existing
session history list in place.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from copy import deepcopy
from dataclasses import dataclass, field, replace
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, cast
from uuid import uuid4

from loguru import logger

from nanobot.agent.context import TranscriptInput
from nanobot.events import NO_EVENTS, ContextCompactionEvent, EventSink
from nanobot.providers.base import (
    CONTEXT_SAFETY_BUFFER,
    LLMResponse,
    LLMUsage,
    ProviderCallContext,
    ProviderConversationState,
)
from nanobot.providers.conversation_state import (
    ProviderConversationStateController,
    allows_conversation_message_merge,
)
from nanobot.session.history_visibility import is_hidden_history_message
from nanobot.session.summary import (
    SUMMARY_CONTINUATION_TEXT,
    SessionSummaryCheckpoint,
)
from nanobot.utils.helpers import (
    estimate_prompt_tokens_chain,
    maybe_persist_tool_result,
    truncate_text,
)
from nanobot.utils.runtime import ensure_nonempty_tool_result

if TYPE_CHECKING:
    from nanobot.agent.tools.registry import ToolRegistry
    from nanobot.providers.base import LLMProvider

TranscriptBuilder = Callable[[TranscriptInput], list[dict[str, Any]]]
SummaryTranscriptBuilder = Callable[[str], list[dict[str, Any]]]
HistoryConsolidator = Callable[
    [list[dict[str, Any]], str | None],
    Awaitable[str | None],
]
ProviderCompactionConsolidator = Callable[
    [ProviderConversationState, list[dict[str, Any]], str | None],
    Awaitable[str | None],
]

# read_file has its own bound; exempt it to avoid persist->read->persist loops.
TOOL_RESULT_OFFLOAD_EXEMPT_TOOLS = frozenset({"read_file"})
BACKFILL_CONTENT = "[Tool result unavailable - call was interrupted or lost]"
PLACEHOLDER_TEXTS = frozenset({
    "[Previous assistant message omitted.]",
})


class ContextWindowExceededError(RuntimeError):
    """Raised before a request that exceeds its local context budget."""

    def __init__(
        self,
        *,
        session_key: str | None,
        estimated_tokens: int,
        input_budget: int,
        source: str,
    ) -> None:
        self.session_key = session_key
        self.estimated_tokens = estimated_tokens
        self.input_budget = input_budget
        self.source = source
        super().__init__(
            "Model input exceeds the local context budget "
            f"for {session_key or 'default'}: {estimated_tokens}/{input_budget} via {source}"
        )


def _tool_call_name_is_valid(tool_call: Any) -> bool:
    """Whether a persisted OpenAI-style tool_call carries a usable name.

    Mirrors ``ToolCallRequest.has_valid_name`` for the dict shape stored in
    message history: a degenerate call with ``name=None`` / ``""`` cannot be
    executed and is rejected by upstream APIs if replayed.
    """
    if not isinstance(tool_call, dict):
        return False
    tool_call_data = cast(dict[str, Any], tool_call)
    fn = tool_call_data.get("function")
    name = cast(dict[str, Any], fn).get("name") if isinstance(fn, dict) else tool_call_data.get("name")
    return isinstance(name, str) and bool(name)


@dataclass(slots=True)
class ContextGovernanceConfig:
    provider: LLMProvider
    model: str
    tools: ToolRegistry
    workspace: Path | None
    session_key: str | None
    max_tool_result_chars: int
    context_window_tokens: int | None = None
    max_tokens: int | None = None


@dataclass(slots=True)
class ContextCompactionState:
    """Track accepted provider input H separately from the unsent delta."""

    raw_messages: list[dict[str, Any]]
    accepted_messages: list[dict[str, Any]]
    raw_accepted_boundary: int
    active_summary: str | None
    summary_transcript_builder: SummaryTranscriptBuilder
    consolidate_history: HistoryConsolidator
    consolidate_provider_compaction: ProviderCompactionConsolidator | None
    summary_checkpoint: SessionSummaryCheckpoint | None = None

    @classmethod
    def from_transcript(
        cls,
        transcript_input: TranscriptInput,
        transcript_builder: TranscriptBuilder,
        consolidate_history: HistoryConsolidator,
        consolidate_provider_compaction: ProviderCompactionConsolidator | None,
    ) -> tuple[list[dict[str, Any]], ContextCompactionState]:
        """Build the raw transcript and its initial H/delta boundary."""
        messages = list(transcript_builder(transcript_input))
        accepted_history_boundary = 1 + len(transcript_input.history)

        def build_summary_transcript(summary: str) -> list[dict[str, Any]]:
            return transcript_builder(
                replace(
                    transcript_input,
                    history=[],
                    current_message=None,
                    session_summary={
                        "text": summary,
                        "last_active": datetime.now().astimezone().isoformat(),
                    },
                )
            )

        return messages, cls(
            raw_messages=messages,
            accepted_messages=deepcopy(messages[:accepted_history_boundary]),
            raw_accepted_boundary=accepted_history_boundary,
            active_summary=(
                transcript_input.session_summary["text"]
                if transcript_input.session_summary is not None
                else None
            ),
            summary_transcript_builder=build_summary_transcript,
            consolidate_history=consolidate_history,
            consolidate_provider_compaction=consolidate_provider_compaction,
        )

    def request_messages(
        self,
        raw_messages: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        return [
            *deepcopy(self.accepted_messages),
            *deepcopy(raw_messages[self.raw_accepted_boundary:]),
        ]

    def delta_after_accepted(
        self,
        request_messages: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        return deepcopy(request_messages[len(self.accepted_messages):])

    def accept_request(
        self,
        model_messages: list[dict[str, Any]],
        *,
        raw_boundary: int,
    ) -> None:
        """Advance H after the provider has received one request."""
        self.accepted_messages = deepcopy(model_messages)
        self.raw_accepted_boundary = raw_boundary


@dataclass(slots=True)
class ModelRequestState:
    """Context state shared by every provider request in one runner turn."""

    config: ContextGovernanceConfig
    conversation: ProviderConversationStateController
    compaction: ContextCompactionState
    usage: LLMUsage | None = None
    messages: list[dict[str, Any]] | None = None
    tool_definitions: list[dict[str, Any]] | None = None
    provider_compaction_applied: bool = False
    compacted_tool_results: set[str] = field(default_factory=set)
    events: EventSink = NO_EVENTS


class ContextGovernor:
    """Own model-request context while preserving persisted history."""

    @staticmethod
    def _merge_message_content(left: Any, right: Any) -> str | list[dict[str, Any]]:
        if isinstance(left, str) and isinstance(right, str):
            return f"{left}\n\n{right}" if left else right

        def _to_blocks(value: Any) -> list[dict[str, Any]]:
            if isinstance(value, list):
                return [
                    cast(dict[str, Any], item)
                    if isinstance(item, dict)
                    else {"type": "text", "text": str(item)}
                    for item in cast(list[Any], value)
                ]
            if value is None:
                return []
            return [{"type": "text", "text": str(value)}]

        return _to_blocks(left) + _to_blocks(right)

    @classmethod
    def _merge_adjacent_user_messages_for_model(
        cls,
        messages: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Merge adjacent visible user messages only in the model-facing copy."""
        prepared: list[dict[str, Any]] = []
        for source in messages:
            injection = deepcopy(source)
            if (
                prepared
                and injection.get("role") == "user"
                and prepared[-1].get("role") == "user"
                and injection.get("content") != SUMMARY_CONTINUATION_TEXT
                and prepared[-1].get("content") != SUMMARY_CONTINUATION_TEXT
                and not is_hidden_history_message(injection)
                and not is_hidden_history_message(prepared[-1])
                and allows_conversation_message_merge(injection)
                and allows_conversation_message_merge(prepared[-1])
            ):
                merged = dict(prepared[-1])
                merged["content"] = cls._merge_message_content(
                    merged.get("content"),
                    injection.get("content"),
                )
                prepared[-1] = merged
                continue
            prepared.append(injection)
        return prepared

    def prepare_messages_for_model(
        self,
        config: ContextGovernanceConfig,
        messages: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Build the normalized model-facing copy of a raw transcript."""
        governed = self.prepare_for_model(config, messages)
        return self._merge_adjacent_user_messages_for_model(governed)

    def prepare_for_model(
        self,
        config: ContextGovernanceConfig,
        messages: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        updated = self.strip_placeholder_assistant_messages(messages)
        updated = self.strip_malformed_tool_calls(up
```

### Core Architecture Module: `invisible_engine_dots/nanobot/agent/hook.py`
```
"""Shared lifecycle hook primitives for agent runs."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from nanobot.providers.base import LLMResponse, LLMUsage, ToolCallRequest


@dataclass(slots=True)
class AgentHookContext:
    """Mutable per-iteration state exposed to runner hooks."""

    iteration: int
    messages: list[dict[str, Any]]
    response: LLMResponse | None = None
    usage: LLMUsage | None = None
    tool_calls: list[ToolCallRequest] = field(default_factory=list)
    tool_results: list[Any] = field(default_factory=list)
    tool_events: list[dict[str, str]] = field(default_factory=list)
    final_content: str | None = None
    stop_reason: str | None = None
    error: str | None = None
    session_key: str | None = None


@dataclass(slots=True)
class AgentRunHookContext:
    """Run-level state snapshot exposed to runner hooks."""

    messages: list[dict[str, Any]]
    final_content: str | None = None
    tools_used: list[str] = field(default_factory=list)
    usage: LLMUsage | None = None
    stop_reason: str | None = None
    error: str | None = None
    tool_events: list[dict[str, str]] = field(default_factory=list)
    had_injections: bool = False
    exception: BaseException | None = None


class AgentHook:
    """Minimal lifecycle surface of one run of the runner: the Dot has one, `DotsTurnHook`."""

    async def before_run(self, context: AgentRunHookContext) -> None:
        pass

    async def after_run(self, context: AgentRunHookContext) -> None:
        pass

    async def on_error(self, context: AgentRunHookContext) -> None:
        pass

    async def on_finally(self, context: AgentRunHookContext) -> None:
        pass

    async def before_iteration(self, context: AgentHookContext) -> None:
        pass

    async def before_execute_tools(self, context: AgentHookContext) -> None:
        pass

    async def before_execute_tool(
        self,
        context: AgentHookContext,
        tool_call: ToolCallRequest,
        tool: Any,
        params: Any,
    ) -> None:
        pass

    async def after_execute_tool(
        self,
        context: AgentHookContext,
        tool_call: ToolCallRequest,
        tool: Any,
        params: Any,
        result: Any,
    ) -> None:
        pass

    async def on_execute_tool_error(
        self,
        context: AgentHookContext,
        tool_call: ToolCallRequest,
        tool: Any,
        params: Any,
        error: Any,
    ) -> None:
        pass

    async def after_iteration(self, context: AgentHookContext) -> None:
        pass

    def finalize_content(self, context: AgentHookContext, content: str | None) -> str | None:
        return content

```

### Core Architecture Module: `invisible_engine_dots/nanobot/agent/memory.py`
```
"""Transcript summaries: the LLM checkpoint of older messages, with a mechanical fallback.

Context governance replaces an accepted prefix of the transcript with one
checkpoint when the next request would not fit. ``Consolidator`` writes that
checkpoint. It owns no files: the summary is returned to its caller, which
stores it with the session.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, cast

from loguru import logger

from nanobot.providers.base import LLMResponse, ProviderConversationState
from nanobot.providers.conversation_state import ProviderConversationStateController
from nanobot.utils.helpers import (
    build_assistant_message,
    content_with_media_breadcrumbs,
    estimate_prompt_tokens_chain,
    strip_think,
    truncate_text,
    truncate_text_to_tokens,
)
from nanobot.utils.prompt_templates import render_template

if TYPE_CHECKING:
    from nanobot.utils.llm_runtime import LLMRuntime

# The mechanical fallback (the model could not summarize) uses a tighter cap than
# a completed model summary, which scales with the generation budget. The hard cap
# is the emergency bound on pathological provider output.
_RAW_CHECKPOINT_MAX_CHARS = 16_000
_SUMMARY_HARD_CAP = 64_000
_ARCHIVE_TOOL_RESULT = (
    "Session archival does not execute tools. Use only the supplied conversation and "
    "return the requested compact checkpoint now; do not call another tool."
)


def _normalize_summary(entry: str, *, max_chars: int | None = None) -> str:
    """Return the bounded, model-safe text of a checkpoint."""
    limit = max_chars if max_chars is not None else _SUMMARY_HARD_CAP
    content = strip_think(entry.rstrip())
    if len(content) > limit:
        logger.warning("checkpoint exceeds {} chars ({}); truncating", limit, len(content))
        content = truncate_text(content, limit)
    return content


def _format_messages(messages: list[dict[str, Any]]) -> str:
    lines: list[str] = []
    for message in messages:
        content = content_with_media_breadcrumbs(
            message.get("role"),
            message.get("content", ""),
            message.get("media"),
        )
        if not content:
            continue
        tools_used = message.get("tools_used")
        tools = (
            f" [tools: {', '.join(cast(list[str], tools_used))}]"
            if tools_used
            else ""
        )
        raw_timestamp = message.get("timestamp")
        timestamp = str(raw_timestamp) if raw_timestamp is not None else "?"
        role = str(message.get("role") or "unknown")
        lines.append(f"[{timestamp[:16]}] {role.upper()}{tools}: {content}")
    return "\n".join(lines)


def _build_raw_checkpoint(messages: list[dict[str, Any]]) -> str:
    """The mechanical checkpoint: the messages themselves, formatted and bounded."""
    checkpoint = (
        f"[RAW] {len(messages)} messages\n"
        f"{_format_messages(messages)}"
    )
    return _normalize_summary(checkpoint, max_chars=_RAW_CHECKPOINT_MAX_CHARS)


def _combine_raw_checkpoint(
    raw: str,
    *,
    previous_summary: str | None,
    max_tokens: int,
) -> str:
    """Return a bounded checkpoint that preserves prior and newly archived context."""
    token_limit = max(1, max_tokens)
    if not previous_summary:
        return truncate_text_to_tokens(raw, token_limit)

    combined = (
        "[Previous archived context]\n"
        f"{previous_summary}\n\n"
        "[Newly archived raw context]\n"
        f"{raw}"
    )
    bounded = truncate_text_to_tokens(combined, token_limit)
    if bounded == combined:
        return combined

    # Keep evidence from both sides when their full concatenation cannot fit.
    section_limit = max(1, (token_limit - 32) // 2)
    return truncate_text_to_tokens(
        "[Previous archived context]\n"
        f"{truncate_text_to_tokens(previous_summary, section_limit)}\n\n"
        "[Newly archived raw context]\n"
        f"{truncate_text_to_tokens(raw, section_limit)}",
        token_limit,
    )


class Consolidator:
    """Summarize a transcript prefix into one replacement checkpoint."""

    _SAFETY_BUFFER = 1024  # extra headroom for tokenizer estimation drift

    async def summarize(
        self,
        source_messages: list[dict[str, Any]],
        *,
        runtime: LLMRuntime,
        session_key: str,
        history: list[dict[str, Any]],
        request_tools: list[dict[str, Any]],
        previous_summary: str | None = None,
        input_token_budget: int | None = None,
        fallback_max_tokens: int | None = None,
        provider_state: ProviderConversationState | None = None,
    ) -> str | None:
        """Generate a replacement checkpoint; fall back to a mechanical one."""
        if not source_messages:
            return None

        def raw_fallback() -> str:
            return _combine_raw_checkpoint(
                _build_raw_checkpoint(source_messages),
                previous_summary=previous_summary,
                max_tokens=(
                    fallback_max_tokens
                    if fallback_max_tokens is not None
                    else runtime.generation.max_tokens
                ),
            )

        prompt = render_template(
            "agent/consolidator_archive.md",
            strip=True,
            archive_count=len(source_messages),
        )
        prompt_message = {"role": "user", "content": prompt}
        provider_context = None
        state_controller: ProviderConversationStateController | None = None
        state_messages: list[dict[str, Any]] = []
        call_tools = request_tools
        if provider_state is not None:
            instruction_messages: list[dict[str, Any]] = []
            for message in history:
                if message.get("role") not in {"system", "developer"}:
                    break
                instruction_messages.append(dict(message))
            request_messages = [*instruction_messages, prompt_message]
            state_controller = ProviderConversationStateController(
                provider=runtime.provider,
                model=runtime.model,
                messages=state_messages,
                state=provider_state,
                session_id=session_key,
            )
            state_messages.append(dict(prompt_message))
            provider_context = state_controller.prepare_request(
                state_messages,
                context_window_tokens=runtime.context_window_tokens,
            )
            if provider_context is None or provider_context.conversation_state is None:
                return raw_fallback()
            call_tools = []
        else:
            request_messages = [
                *[dict(message) for message in history],
                prompt_message,
            ]
        if input_token_budget is not None and provider_context is None:
            estimated, source = estimate_prompt_tokens_chain(
                runtime.provider,
                runtime.model,
                request_messages,
                call_tools,
            )
            if input_token_budget <= 0 or estimated > input_token_budget:
                logger.debug(
                    "Summary input does not fit for {}: {}/{} via {}; "
                    "using raw checkpoint",
                    session_key,
                    estimated,
                    input_token_budget,
                    source,
                )
                return raw_fallback()

        response: LLMResponse | None = None
        for attempt in range(2):
            try:
                response = await runtime.provider.chat_stream_with_retry(
                    model=runtime.model,
                    messages=request_messages,
                    tools=call_tools,
                    temperature=runtime.generation.temperature,
                    max_tokens=runtime.generation.max_tokens,
                    reasoning_effort=runtime.generation.reasoning_effort,
                    provider_context=provider_context,
                )
            except Exception:
                phase = "provider call" if attempt == 0 else "tool-call recovery"
                logger.warning(
                    "Summary {} failed; using raw checkpoint",
                    phase,
                )
                return raw_fallback()
            if response.should_execute_tools is not True or attempt == 1:
                break

            logger.info(
                "Summary provider returned {} tool call(s); requesting checkpoint",
                len(response.tool_calls),
            )
            assistant_message = build_assistant_message(
                response.content,
                tool_calls=[call.to_openai_tool_call() for call in response.tool_calls],
                reasoning_content=response.reasoning_content,
                thinking_blocks=response.thinking_blocks,
            )
            tool_messages = [
                {
                    "role": "tool",
                    "tool_call_id": call.id,
                    "name": call.name,
                    "content": _ARCHIVE_TOOL_RESULT,
                }
                for call in response.tool_calls
            ]
            request_messages = [
                *request_messages,
                assistant_message,
                *tool_messages,
            ]
            if state_controller is not None:
                state_controller.observe_response(
                    response,
                    state_messages,
                )
                state_messages.extend([
                    state_controller.project_response_message(
                        dict(assistant_message),
                        response,
                    ),
                    *[dict(message) for message in tool_messages],
                ])
                provider_context = state_controller.prepare_request(
                    state_messages,
                    context_window_tokens=runtime.context_window_tokens
```

### Core Architecture Module: `invisible_engine_dots/nanobot/agent/runner.py`
```
"""Shared execution loop for tool-using agents."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable, Iterable
from copy import deepcopy
from dataclasses import dataclass, field, replace
from pathlib import Path
from typing import Any, cast

from loguru import logger

from nanobot.agent.context import TranscriptInput
from nanobot.agent.context_governance import (
    ContextCompactionState,
    ContextGovernanceConfig,
    ContextGovernor,
    HistoryConsolidator,
    ModelRequestState,
    ProviderCompactionConsolidator,
    TranscriptBuilder,
)
from nanobot.agent.hook import AgentHook, AgentHookContext, AgentRunHookContext
from nanobot.agent.tools.context import tool_log_content_allowed
from nanobot.agent.tools.execution import STATUS_PARKED, execute_tool_calls
from nanobot.agent.tools.gate_types import ToolGate
from nanobot.agent.tools.registry import ToolRegistry
from nanobot.agent.transcript_metadata import IS_ERROR, METADATA_KEY
from nanobot.events import NO_EVENTS, EventSink
from nanobot.providers.base import (
    LLMProvider,
    LLMResponse,
    LLMUsage,
    ProviderCallContext,
    ProviderConversationState,
    ToolCallRequest,
)
from nanobot.providers.conversation_state import ProviderConversationStateController
from nanobot.session.history_visibility import is_hidden_history_message
from nanobot.session.summary import SessionSummaryCheckpoint
from nanobot.utils.helpers import (
    build_assistant_message,
    estimate_message_tokens,
    estimate_prompt_tokens_chain,
    extract_reasoning,
)
from nanobot.utils.llm_runtime import LLMRuntime
from nanobot.utils.prompt_templates import render_template
from nanobot.utils.runtime import (
    EMPTY_FINAL_RESPONSE_MESSAGE,
    build_finalization_retry_message,
    build_length_recovery_message,
    is_blank_text,
)

CheckpointCallback = Callable[[dict[str, Any]], Awaitable[None]]
InjectionCallback = Callable[[], Awaitable[Iterable[Any] | None]]

_DEFAULT_ERROR_MESSAGE = "Sorry, I encountered an error calling the AI model."
_ARREARAGE_ERROR_MESSAGE = (
    "The AI provider rejected the request because the API key is out of quota or the "
    "account is in arrears. Please top up / check the billing status of your API key and try again."
)
_PERSISTED_MODEL_ERROR_PLACEHOLDER = "[Assistant reply unavailable due to model error.]"
_MAX_EMPTY_RETRIES = 2
_MAX_LENGTH_RECOVERIES = 3


def _restore_outer_whitespace(content: str, original: str | None) -> str:
    """Restore boundary whitespace stripped while cleaning one recovered segment."""
    if not original:
        return content
    leading_size = len(original) - len(original.lstrip())
    trailing_size = len(original) - len(original.rstrip())
    leading = original[:leading_size]
    trailing = original[-trailing_size:] if trailing_size else ""
    return f"{leading}{content}{trailing}"


@dataclass(slots=True)
class AgentRunSpec:
    """Configuration for a single agent execution."""

    tools: ToolRegistry
    runtime: LLMRuntime
    max_iterations: int
    max_tool_result_chars: int
    # The policy every tool call crosses before it runs: there is no run without one.
    gate: ToolGate
    # The turn's inputs, and how they become the transcript the model reads.
    transcript_input: TranscriptInput
    transcript_builder: TranscriptBuilder
    consolidate_history: HistoryConsolidator
    hook: AgentHook | None = None
    concurrent_tools: bool = False
    workspace: Path | None = None
    session_key: str | None = None
    checkpoint_callback: CheckpointCallback | None = None
    consolidate_provider_compaction: ProviderCompactionConsolidator | None = None
    injection_callback: InjectionCallback | None = None
    provider_state: ProviderConversationState | None = None
    events: EventSink = NO_EVENTS
    # Given the messages of a model request, returns the ones to send. For what the model must see
    # and the transcript must not keep (a screenshot): the result is made for that request, never stored
    # and never part of the history the next request starts from.
    request_attachments: Callable[[list[dict[str, Any]]], list[dict[str, Any]]] | None = None


@dataclass(slots=True)
class AgentRunResult:
    """Outcome of a shared agent execution."""

    final_content: str | None
    messages: list[dict[str, Any]]
    tools_used: list[str] = field(default_factory=list)
    usage: LLMUsage | None = None
    # One entry per runner-visible model round. Recovery dispatches needed to
    # produce that round's response are folded into the same usage value.
    round_usages: list[LLMUsage] = field(default_factory=list)
    stop_reason: str = "completed"
    error: str | None = None
    failure_error_kind: str | None = None
    tool_events: list[dict[str, str]] = field(default_factory=list)
    had_injections: bool = False
    provider_state: ProviderConversationState | None = field(default=None, repr=False)
    summary_checkpoint: SessionSummaryCheckpoint | None = field(default=None, repr=False)
    provider_compaction_applied: bool = field(default=False, repr=False)


class AgentRunner:
    """Run a tool-capable LLM loop without product-layer concerns."""

    def __init__(self) -> None:
        self.context_governor = ContextGovernor()

    async def _commit(
        self,
        spec: AgentRunSpec,
        messages: list[dict[str, Any]],
        message: dict[str, Any],
        phase: str,
    ) -> None:
        """Add one message to the transcript, then hand it to the checkpoint callback.

        Every message the runner adds goes through here, one at a time, and the
        runner goes on only after the callback returned: whatever it durably records
        is never behind the transcript. The callback gets {"phase", "message"}; the
        phases are assistant_tool_calls, tool_result, final_response, injected_user,
        length_segment, length_notice, error_placeholder, empty_final_response and
        max_iterations_fallback. The message may carry the engine's metadata under
        METADATA_KEY: the callback sees it, the transcript the model reads never does.
        The callback gets a snapshot: the runner goes on marking its own copy.
        """
        if METADATA_KEY in message:
            messages.append({key: value for key, value in message.items() if key != METADATA_KEY})
        else:
            messages.append(message)
        callback = spec.checkpoint_callback
        if callback is not None:
            await callback({"phase": phase, "message": deepcopy(message)})

    async def _commit_notice(
        self,
        spec: AgentRunSpec,
        messages: list[dict[str, Any]],
        content: str | None,
        phase: str,
    ) -> None:
        """Commit a closing assistant text, unless the transcript already ends with it."""
        if not content:
            return
        last = messages[-1] if messages else None
        if (
            last is not None
            and last.get("role") == "assistant"
            and not last.get("tool_calls")
            and last.get("content") == content
        ):
            return
        await self._commit(spec, messages, build_assistant_message(content), phase)

    async def _try_drain_injections(
        self,
        spec: AgentRunSpec,
        messages: list[dict[str, Any]],
        assistant_message: dict[str, Any] | None,
        injection_cycles: int,
        *,
        phase: str = "after error",
        drain_callback: bool = True,
    ) -> tuple[bool, int]:
        """Append one pending-input snapshot and return whether execution continues."""
        injections = await self._drain_injections(spec) if drain_callback else []
        if not injections:
            return False, injection_cycles
        injection_cycles += 1
        if assistant_message is not None:
            await self._commit(spec, messages, assistant_message, "final_response")
        for injection in injections:
            await self._commit(spec, messages, injection, "injected_user")
        preview = "[content hidden]"
        if tool_log_content_allowed():
            preview = "\n\n".join(
                message["content"] for message in injections
                if isinstance(message.get("content"), str)
                and not is_hidden_history_message(message)
            )
            preview = preview[:80] + "..." if len(preview) > 80 else preview
        logger.info(
            "Injected {} follow-up message(s) {} (snapshot {}): {}",
            len(injections), phase, injection_cycles, preview,
        )
        return True, injection_cycles

    async def _drain_injections(self, spec: AgentRunSpec) -> list[dict[str, Any]]:
        """Drain one pending-input snapshot via the injection callback."""
        callback = spec.injection_callback
        if callback is None:
            return []
        try:
            items = await callback()
        except Exception:
            logger.opt(exception=tool_log_content_allowed()).error("injection_callback failed")
            return []
        if not items:
            return []
        injected_messages: list[dict[str, Any]] = []
        for item in items:
            if item is None:
                continue
            if isinstance(item, dict):
                message_item = cast(dict[str, Any], item)
                if message_item.get("role") == "user" and "content" in message_item:
                    if self._has_injection_content(message_item.get("content")):
                        injected_messages.append(message_item)
                continue
            content = getattr(item, "content") if hasattr(item, "content") else str(item)
            if self._has_injection_content(content):
                injected_messages.append({"role": "user", "content": content})
        return injected_messages

    @staticmethod
    def _has_injection_content(content: Any) -> bool:
        if content is None:
            return False
        if isins
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #647** (2024-11-19): **[BUG]: from lib_resume_builder_AIHawk import Resume, FacadeManager, ResumeGenerator, StyleManager**
  *Symptoms*: ### Describe the bug  I did everything right but still getting this.  ### Steps to reproduce  _No response_  ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Branch  None  ### Branch name  _No response_  ### Python version  _No response_  ### LLM Used  _No response_  ### Model used  _No response_  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > Same 
  > I possibly found a solution for this, there is another repo named "lib_resume_builder_AIHawk", try cloning it.
  > I already did that but I'm still seeing the same error 

- **Issue #646** (2024-10-29): **[BUG]: ERROR    | __main__:main:220 - Runtime error: Error running the bot: 'exam'**
  *Symptoms*: could any one help resolve this issue  education_details:   - education_level: "Master's Degree"     institution: "GIET"     field_of_study: "Engineering"     final_evaluation_grade: "4.0"     year_of_completion: "2018"     start_date: "2016"     additional_info:       exam:         Civil: "A"         Structural: "A" 
  **Post-Mortem & Fix Analysis**:
  > I just created a clone in my machine and I changed it in my local machine. Could you please assign it to me.
  > > I just created a clone in my machine and I changed it in my local machine. Could you please assign it to me.  unable to assign

- **Issue #644** (2025-01-22): **[BUG]: CV Not Generating in Output Directory: generated_cv**
  *Symptoms*: ### Describe the bug  file is not created in the generated_cv directory. The process encounters an error due to missing logger attribute in LoggerChatModel, causing the resume generation to halt.  ### Steps to reproduce  we are using  ![xxx](https://github.com/user-attachments/assets/e44f668f-bf96-4ed2-b0f2-e06a8c73397c)   ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Branch  main  ### Branch name  _No response_  ### Python version  _No response_  ### LLM Used  ollama  ### Model used  llama3.2:latest  ### Additional context  All steps execute successfully until the final stage, where the CV generation fails during the submission process.
  **Post-Mortem & Fix Analysis**:
  > having same issue 
  > I kinda dugged deep and found something like this where the package of lib_resume_builder_AIHawk is directly trying to use chatgpt-40-mini  ![image](https://github.com/user-attachments/assets/0978129e-67e4-47c4-af0f-f43843cb0802) this could  be the reason maybe ?
  > Same issue I'm using Gemini model

- **Issue #636** (2024-11-07): **[BUG]: It doesn't exclude senior positions even though only entry and associate in experienceLevel have been specified**
  *Symptoms*: ### Describe the bug  The program still applies to senior positions even though the only fields in the `experienceLevel` scope in the `config.yaml` file that has been set to `true` are `entry` and `associate`.  ### Steps to reproduce  Just run the program with the following settings in the `experienceLevel` field in the `config.yaml` file:  ```yaml experienceLevel:   internship: false   entry: true   associate: true   mid-senior level: false   director: false   executive: false   ```  ### Expected behavior  That the program excludes senior positions  ### Actual behavior  It still applied to senior positions  ### Branch  main  ### Branch name  _No response_  ### Python version  Python 3.12.7 (64b)  ### LLM Used  OpenAI's ChatGPT  ### Model used  gtp-4o  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > I will have a look right now
  > @Axedyson Fixed. Please try the new main branch. If anything wrong, just let me know. Thx! (I forgot which PR fixed it, but for sure, it was fixed)

- **Issue #622** (2024-10-27): **[BUG]:how many years is hard coded to 0**
  *Symptoms*: ### Describe the bug  when question with how many years is aked the answer is alwys hard coded to 0  ### Steps to reproduce  ![image](https://github.com/user-attachments/assets/e869d627-3698-4c5e-a661-13ceb1f3e210)   ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Branch  None  ### Branch name  _No response_  ### Python version  _No response_  ### LLM Used  _No response_  ### Model used  _No response_  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > <img width="569" alt="2024-10-26_20h32_32" src="https://github.com/user-attachments/assets/b500f84c-bd3b-4ebb-83d3-4dad52e3cf27"> 
  > @sloganking can you review this MR.

- **Issue #620** (2024-10-27): **[BUG]: Keeps looping on same page on LinkedIn with page 0, page 1, page 2,....**
  *Symptoms*: ### Describe the bug  Not searching and navigating to the next title in the list. Seems stuck in a loop on the first title, duplicated entries in data.json  ### Steps to reproduce  _No response_  ### Expected behavior  Should move to the next title in the search list  ### Actual behavior  Keeps looping on the first title even though there are no matching jobs found  ### Branch  main  ### Branch name  _No response_  ### Python version  3.11.5  ### LLM Used  _No response_  ### Model used  _No response_  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > I have the same issue. Why the issue closed? Is the bug solved in a later commit?

- **Issue #619** (2024-10-27): **[BUG]: It is skipping job applications**
  *Symptoms*: ### Describe the bug  logs  ```zsh 2024-10-26 16:58:38.973 | DEBUG    | src.aihawk_job_manager:write_to_file:386 - Writing job application result to file: skipped 2024-10-26 16:58:39.003 | DEBUG    | src.aihawk_job_manager:write_to_file:413 - Job data appended to existing file: skipped 2024-10-26 16:58:39.004 | DEBUG    | src.aihawk_job_manager:apply_jobs:310 - Starting applicant for job: Java Developer at Cartney 2024-10-26 16:58:39.004 | DEBUG    | src.aihawk_job_manager:is_blacklisted:472 - Checking if job is blacklisted: Java Developer at Cartney in Denver, CO (On-site) 2024-10-26 16:58:39.004 | DEBUG    | src.aihawk_job_manager:is_blacklisted:479 - Job blacklisted status: False 2024-10-26 16:58:39.005 | DEBUG    | src.aihawk_job_manager:is_already_applied_to_company:502 - Already applied at Cartney (once per company policy), skipping... 2024-10-26 16:58:39.006 | DEBUG    | src.aihawk_job_manager:write_to_file:386 - Writing job application result to file: skipped 2024-10-26 16:58:39.036 | DEBUG    | src.aihawk_job_manager:write_to_file:413 - Job data appended to existing file: skipped 2024-10-26 16:58:39.036 | DEBUG    | src.aihawk_job_manager:apply_jobs:310 - Starting applicant for job: Senior Full Stack Developer at CoExperiences 2024-10-26 16:58:39.036 | DEBUG    | src.aihawk_job_manager:is_blacklisted:472 - Checking if job is blacklisted: Senior Full Stack Developer at CoExperiences in United States (Remote) 2024-10-26 16:58:39.036 | DEBUG    | src.aiha
  **Post-Mortem & Fix Analysis**:
  > added by mistake - skipped those as I am already applied to those companies.

- **Issue #612** (2025-01-22): **[BUG]: duplicates in answers.json again**
  *Symptoms*: ### Describe the bug  duplicates should not be written to answers.json  ### Steps to reproduce  _No response_  ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Branch  None  ### Branch name  _No response_  ### Python version  _No response_  ### LLM Used  _No response_  ### Model used  _No response_  ### Additional context  Looks like @cjbbb commented out the code that prevents duplicates in `answers.json` yesterday in 63318f214f1712e35477e7f3acce6c9a6e473298 and then they later deleted the code in daa9e8532b6bc0280a3043fb19ad63ab9a9ec2f7 . This has caused `answers.json` to have duplicates again, causing the bot to not have answers assignable by the user. Effectively reverting and re-opening issue #557. @cjbbb what gives?
  **Post-Mortem & Fix Analysis**:
  > Thanks for your reminder! Yesterday merge was a temporary fix to ensure the script could at least function properly (fill in the form). Today, I’ll review why the previous commit caused the bug that prevented the form from being filled out, and I’ll test it. Once it’s working, I’ll submit a PR.
  > @cjbbb thabks bro
  > Hi @sloganking  it is not commit 59aebe1 raised Error "Formed can not be filled". It is commit 33f1826 in line 847 to 849.   `if self.current_job.company in item['answer']:                 logger.debug(f"Answer contains the Company name. Aborting save of: {item['question']}")                 return`  Since sometimes item['answer'] is only one number and can not be iterated.  I will recover commit 59aebe1 and create a PR. THX!

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

### Incident Patch 1: `6402a753` (2026-10-07)
**Commit Message**: README: a one-minute page like the projects people know, not a stub: what it is, quickstart, what a Dot has, which one fits, how it works, security

**File**: `README.md` (modified, +134/-17)
```diff
@@ -1,13 +1,16 @@
-<h1 align="center">invisible_dots</h1>
+<div align="center">
+<h1>invisible_dots</h1>
+<h3>AI agents that each own a computer.</h3>
+<p>A virtual machine on your PC with a desktop, a shell, files, memory and skills that stay,<br>
+and a browser that does not look automated. You decide what each one may do.</p>
 
-<p align="center"><b>AI agents that each own a computer.</b></p>
-
-<p align="center">
 <a href="https://github.com/feder-cr/dots/actions/workflows/tests.yml"><img alt="tests" src="https://github.com/feder-cr/dots/actions/workflows/tests.yml/badge.svg"></a>
 <a href="LICENSE"><img alt="license: MIT" src="https://img.shields.io/badge/license-MIT-blue"></a>
 <img alt="status: alpha" src="https://img.shields.io/badge/status-alpha-orange">
 <img alt="hosts: Linux and Windows" src="https://img.shields.io/badge/hosts-Linux%20%7C%20Windows-lightgrey">
-</p>
+
+<p><a href="#quickstart"><b>Quickstart</b></a> · <a href="docs/guide.md"><b>Guide</b></a> · <a href="docs/architecture.md"><b>Architecture</b></a> · <a href="docs/guide.md#security-model-and-known-limits"><b>Security</b></a> · <a href="docs/guide.md#privacy"><b>Privacy</b></a></p>
+</div>
 
 <p align="center">
   <picture>
@@ -16,28 +19,142 @@
   </picture>
 </p>
 
-A **Dot** is an AI agent with its own virtual machine on your PC: a desktop, a
-shell, files, memory and skills that stay, and a browser that does not look
-automated ([invisible_playwright_mcp](https://github.com/feder-cr/invisible_playwright_mcp)).
-You decide what it may do. Any model on [OpenRouter](https://openrouter.ai).
+A **Dot** is a persistent AI agent with a QEMU virtual machine of its own, on your own PC. Its disk, files, memory,
+skills and browser logins outlast every task. You talk to it from a web UI, the command line, an HTTP API or
+Telegram, and it runs on any model on [OpenRouter](https://openrouter.ai), with your key.
 
 ## Quickstart
 
-Node 24+, Go 1.25+, Git, hardware virtualization (Linux or Windows, x86-64).
+You need Node 24+, Go 1.25+, Git and hardware virtualization (x86-64), plus an OpenRouter key.
+
+**Windows** (PowerShell):
+
+```powershell
+winget install -e --id OpenJS.NodeJS.LTS; winget install -e --id GoLang.Go; winget install -e --id Git.Git
+git clone https://github.com/feder-cr/dots; cd dots
+npm ci; npm run build --workspace @invisible-dots/cli
+node apps/cli/dist/invisible-dots.mjs setup --all
+node apps/cli/dist/invisible-dots.mjs server
+```
+
+**Linux** (Ubuntu 24.04):
 
-```sh
+```bash
+curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt-get install -y nodejs git && sudo snap install go --classic
 git clone https://github.com/feder-cr/dots && cd dots
 npm ci && npm run build --workspace @invisible-dots/cli
 node apps/cli/dist/invisible-dots.mjs setup --all
 node apps/cli/dist/invisible-dots.mjs server
 ```
 
-Open http://127.0.0.2:3000, paste your OpenRouter key, create a Dot.
+`setup --all` installs QEMU and turns on the accelerator (KVM, or the Windows Hypervisor Platform), then builds or
+downloads the Dot's images; run it again after a restart and it carries on. Then open **http://127.0.0.2:3000**,
+paste your OpenRouter key and create your first Dot. Every step and its failure modes:
+[the guide's quickstart](docs/guide.md#quickstart).
 
-## Docs
+## What to ask a Dot
 
-- [Guide](docs/guide.md): install, the web UI, the command line, the browser, channels, configuration
-- [Architecture](docs/architecture.md)
-- [Security and privacy](docs/guide.md#security-model-and-known-limits)
+Anything that needs a computer and a person's judgement, for as long as it takes:
 
-Alpha: nothing is packaged yet. MIT [license](LICENSE).
+> Open a browser identity called research, go to https://example.com and tell me the page's title and its first
+> sentence. Leave the browser open.
+
+> Every morning, check one-way fares from Milan to Lisbon for the next two weeks, write them to
+> ~/workspace/fares.csv and tell me the cheapest day.
+
+> Log in to the shop with the shopping identity, download this month's invoices to ~/documents, and remember where
+> the invoices page is for next time.
+
+## What a Dot has
+
+| | |
+|---|---|
+| **[A computer of its own](docs/guide.md#what-a-dot-can-do)** | A hardware-accelerated VM with a Linux desktop and a persistent disk. It sleeps when idle and wakes for the next message, task or automation. |
+| **[A browser that is not blocked](docs/guide.md#the-browser)** | [invisible_playwright_mcp](https://github.com/feder-cr/invisible_playwright_mcp): Firefox patched in C++, the fingerprint set inside the engine. Each identity keeps its own cookies and logins. |
+| **[Memory and skills](docs/guide.md#what-a-dot-can-do)** | It writes its own notes and how-tos in its home folder, as Claude Code does, and reads them on the next task. |
+| **[Permissions you set](docs/guide.md#approvals)** | Every tool belongs to a permission: allow, ask or deny. An ask waits in your Inbox, survives
```

---

### Incident Patch 2: `28d925f6` (2026-10-07)
**Commit Message**: README: short, with the long form moved to docs/guide.md and its facts still checked there

**File**: `README.md` (modified, +14/-797)
```diff
@@ -1,8 +1,6 @@
 <h1 align="center">invisible_dots</h1>
 
-<p align="center"><b>AI agents that each own a computer.</b><br>
-A virtual machine on your PC with a desktop, a browser built not to look automated,<br>
-files, memory and skills that outlast every task, and permissions you set.</p>
+<p align="center"><b>AI agents that each own a computer.</b></p>
 
 <p align="center">
 <a href="https://github.com/feder-cr/dots/actions/workflows/tests.yml"><img alt="tests" src="https://github.com/feder-cr/dots/actions/workflows/tests.yml/badge.svg"></a>
@@ -11,816 +9,35 @@ files, memory and skills that outlast every task, and permissions you set.</p>
 <img alt="hosts: Linux and Windows" src="https://img.shields.io/badge/hosts-Linux%20%7C%20Windows-lightgrey">
 </p>
 
-<p align="center">
-<a href="#quickstart"><b>Quickstart</b></a> ·
-<a href="#what-to-ask-a-dot"><b>What to ask</b></a> ·
-<a href="#how-it-works"><b>How it works</b></a> ·
-<a href="docs/architecture.md"><b>Architecture</b></a> ·
-<a href="#security-model-and-known-limits"><b>Security</b></a> ·
-<a href="#privacy"><b>Privacy</b></a>
-</p>
-
 <p align="center">
   <picture>
     <source media="(prefers-color-scheme: dark)" srcset="docs/images/hero-dark.png">
     <img alt="A Dot's chat beside its computer: asked to open a browser identity and read example.com, the Dot answers with the page's title and first sentence, and the desktop shows the browser open on that page." src="docs/images/hero-light.png" width="100%">
   </picture>
 </p>
 
-A **Dot** is a persistent AI agent with a computer of its own. You give it a
-name, a model and a set of permissions; invisible_dots gives it a QEMU virtual
-machine on your own PC, with a disk that persists, a Linux desktop, a shell, its
-own files, memory and skills, and browser identities that keep their cookies and
-logins from one task to the next. You talk to it from a web UI, the command
-line, an HTTP API, Telegram, or (opt-in) WhatsApp. The model is any model on
-OpenRouter, paid with your key.
-
-## Highlights
-
-- **A computer, not a sandbox for one command.** Each Dot has a
-  hardware-accelerated VM (KVM on Linux, Windows Hypervisor Platform on
-  Windows) with a persistent disk. It powers off after a quiet spell
-  (`idle_timeout`, 15 minutes in the sample) and starts again for the next
-  message, the next task or one of its own automations; disk, identities,
-  memory and skills stay.
-- **A browser built not to look automated.** The only browser of a Dot is
-  [invisible-playwright-mcp](https://github.com/feder-cr/invisible_playwright_mcp),
-  on [invisible_playwright](https://github.com/feder-cr/invisible_playwright): a
-  Firefox patched in C++, with the fingerprint set inside the engine instead of
-  injected into the page. Each identity keeps its own profile and fingerprint.
-- **It learns, as Claude Code does.** The Dot keeps its own memory, notes in
-  `/home/dot/memory`, and its own skills, how it does a kind of task, in
-  `/home/dot/skills`. There is nothing to set: it writes them with its file
-  tools, and its prompt names them.
-- **You set what it may do.** Every tool belongs to a permission, and each
-  permission is allow, ask or deny. An ask waits for your answer, survives a
-  restart, and lets that one call run once.
-- **A crash loses nothing you saw accepted.** A restart of the server, a crash
-  of the Dot's engine or a `kill -9` keeps every message and task you were told
-  was accepted, and a tool call cut short is never run twice: the model is told
-  its outcome is unknown and checks before trying again.
-- **Local and private.** The reasoning happens inside the Dot's VM; the control
-  plane on your PC runs the VMs, the queue, the events, the approvals and the
-  channels. invisible_dots has no server of its own and no telemetry.
-
-> [!IMPORTANT]
-> invisible_dots is alpha. No package or hosted service is published: the one
-> thing published is the golden image, built by CI from this repository's pinned
-> inputs and downloaded by `image build` when its inputs are yours; everything
-> else you build on your own machine. The acceptance run (`tests/e2e/run.ts`) is
-> written but has never been completed on a machine with an accelerated QEMU. On
-> Windows a Dot's VM boots under the Windows Hypervisor Platform with the CPU
-> model `host,-vmx,-svm` (measured; plain `-cpu host` pauses it), and the rest
-> of the lifecycle there is not measured yet
-> ([architecture: VM definition](docs/architecture.md#34-vm-definition)).
-
-**On this page:** [Quickstart](#quickstart) · [What to ask a Dot](#what-to-ask-a-dot) ·
-[What a Dot can do](#what-a-dot-can-do) · [The web UI](#the-web-ui) ·
-[The command line](#the-command-line) · [Approvals](#approvals) ·
-[The browser](#the-browser) · [Talk to it from your phone](#talk-to-it-from-your-phone) ·
-[How it works](#how-it-works) · [Security](#security-model-and-known-limits) ·
-[Privacy](#privacy) · [Configuration](#configuration) ·
-[Troubl
```

**File**: `docs/guide.md` (added, +802/-0)
```diff
@@ -0,0 +1,802 @@
+# The invisible_dots guide
+
+Everything about running invisible_dots, in one page. The short version is the [README](../README.md).
+
+A **Dot** is a persistent AI agent with a computer of its own. You give it a
+name, a model and a set of permissions; invisible_dots gives it a QEMU virtual
+machine on your own PC, with a disk that persists, a Linux desktop, a shell, its
+own files, memory and skills, and browser identities that keep their cookies and
+logins from one task to the next. You talk to it from a web UI, the command
+line, an HTTP API, Telegram, or (opt-in) WhatsApp. The model is any model on
+OpenRouter, paid with your key.
+
+## Highlights
+
+- **A computer, not a sandbox for one command.** Each Dot has a
+  hardware-accelerated VM (KVM on Linux, Windows Hypervisor Platform on
+  Windows) with a persistent disk. It powers off after a quiet spell
+  (`idle_timeout`, 15 minutes in the sample) and starts again for the next
+  message, the next task or one of its own automations; disk, identities,
+  memory and skills stay.
+- **A browser built not to look automated.** The only browser of a Dot is
+  [invisible-playwright-mcp](https://github.com/feder-cr/invisible_playwright_mcp),
+  on [invisible_playwright](https://github.com/feder-cr/invisible_playwright): a
+  Firefox patched in C++, with the fingerprint set inside the engine instead of
+  injected into the page. Each identity keeps its own profile and fingerprint.
+- **It learns, as Claude Code does.** The Dot keeps its own memory, notes in
+  `/home/dot/memory`, and its own skills, how it does a kind of task, in
+  `/home/dot/skills`. There is nothing to set: it writes them with its file
+  tools, and its prompt names them.
+- **You set what it may do.** Every tool belongs to a permission, and each
+  permission is allow, ask or deny. An ask waits for your answer, survives a
+  restart, and lets that one call run once.
+- **A crash loses nothing you saw accepted.** A restart of the server, a crash
+  of the Dot's engine or a `kill -9` keeps every message and task you were told
+  was accepted, and a tool call cut short is never run twice: the model is told
+  its outcome is unknown and checks before trying again.
+- **Local and private.** The reasoning happens inside the Dot's VM; the control
+  plane on your PC runs the VMs, the queue, the events, the approvals and the
+  channels. invisible_dots has no server of its own and no telemetry.
+
+> [!IMPORTANT]
+> invisible_dots is alpha. No package or hosted service is published: the one
+> thing published is the golden image, built by CI from this repository's pinned
+> inputs and downloaded by `image build` when its inputs are yours; everything
+> else you build on your own machine. The acceptance run (`tests/e2e/run.ts`)
+> passes its 15 steps on a Linux host with KVM (the linux-host container on
+> WSL). On Windows a Dot's VM boots under the Windows Hypervisor Platform with the CPU
+> model `host,-vmx,-svm` (measured; plain `-cpu host` pauses it), and the rest
+> of the lifecycle there was driven by hand through the web client, not by an
+> automated run ([architecture: VM definition](architecture.md#34-vm-definition)).
+
+**On this page:** [Quickstart](#quickstart) · [What to ask a Dot](#what-to-ask-a-dot) ·
+[What a Dot can do](#what-a-dot-can-do) · [The web UI](#the-web-ui) ·
+[The command line](#the-command-line) · [Approvals](#approvals) ·
+[The browser](#the-browser) · [Talk to it from your phone](#talk-to-it-from-your-phone) ·
+[How it works](#how-it-works) · [Security](#security-model-and-known-limits) ·
+[Privacy](#privacy) · [Configuration](#configuration) ·
+[Troubleshooting](#troubleshooting) · [Updating](#updating-and-uninstalling) ·
+[Status](#status-and-what-is-not-done-yet) · [Development](#development-and-tests)
+
+## Quickstart
+
+Install Node, Go and Git, clone, build the command line, run `setup --all`, run
+`server`, and open the web UI to make the first Dot.
+
+### Requirements
+
+- Linux or Windows, on x86-64, with hardware virtualization on. macOS is not
+  supported.
+- Node 24 or newer, Git, and Go 1.25 or newer (to build the guest daemon).
+- QEMU 8.2 or newer; `setup --all` installs it and enables the accelerator.
+- At least 20 GiB free for the data directory (`doctor` checks it). Each Dot's
+  disk is a copy-on-write overlay that grows as it writes, up to its
+  `computer.disk` (40 GB in the sample).
+- Memory: `image build` boots a builder VM with 2 vCPUs and 4 GiB, and each
+  running Dot takes its `computer.memory` (4 GB in the sample). Inside a Dot,
+  each open browser takes roughly 0.8 GB, and at most `max_open` (default 3)
+  are open at once.
+- A data directory path in plain ASCII with no comma. The default is
+  `~/.invisible-dots`, under your account name, so an account named `José`
+  fails at `doctor`; set `INVISIBLE_DOTS_HOME` to a path such as
+  `C:\invisible-dots` before every command, the server included.
+- An [OpenRouter](
```

**File**: `tests/repo/architecture-engine.test.ts` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@ function read(path: string): string {
   return readFileSync(join(repo, path), "utf8").replace(/\r\n/g, "\n");
 }
 
-const DOCS = ["docs/architecture.md", "README.md", "THIRD_PARTY_NOTICES.md", "guest/image-builder/README.md"];
+const DOCS = ["docs/architecture.md", "README.md", "docs/guide.md", "THIRD_PARTY_NOTICES.md", "guest/image-builder/README.md"];
 
 /** The section of the architecture document that starts at `heading`, up to the next heading of the same level. */
 function section(text: string, heading: string): string {
```

**File**: `tests/repo/readme.test.ts` (modified, +28/-15)
```diff
@@ -1,5 +1,6 @@
 /**
- * What the README states as facts must stay the facts of the code. The prose gates cannot tell that a command was
+ * What the guide (docs/guide.md, the long form of the README) states as facts must stay the facts of the code.
+ * The README itself is short and points into the guide; its links are checked here too. The prose gates cannot tell that a command was
  * renamed, a default moved or a section was retitled, so the statements that name something the code owns are
  * compared with it here: the links into the architecture and within the page, the commands of the table and their
  * flags, the environment variables, and the numbers (defaults, limits, lead times) the text gives.
@@ -16,6 +17,7 @@ import { PRESET_IDS, PRESETS } from "../../apps/web/src/lib/permission-presets.j
 const repo = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
 const read = (path: string): string => readFileSync(join(repo, path), "utf8").replace(/\r\n/g, "\n");
 const readme = read("README.md");
+const guide = read("docs/guide.md");
 const architecture = read("docs/architecture.md");
 
 /** GitHub's anchor of a heading: lower case, punctuation dropped, spaces to hyphens. */
@@ -39,29 +41,40 @@ function anchorsOf(markdown: string): Set<string> {
 }
 
 describe("the README's links", () => {
+  it("to files of the repository name files that exist, and those into the guide land on a heading of it", () => {
+    const links = [...readme.matchAll(/(?:\]\(|(?:href|src|srcset)=")(?!https?:|#)([^)"#\s]+)(?:#([\w-]+))?/g)];
+    expect(links.length).toBeGreaterThan(3);
+    for (const [, path, anchor] of links) {
+      expect(() => readFileSync(join(repo, path!)), path).not.toThrow();
+      if (anchor && path === "docs/guide.md") expect(anchorsOf(guide).has(anchor), `docs/guide.md has no heading for #${anchor}`).toBe(true);
+    }
+  });
+});
+
+describe("the guide's links", () => {
   it("into docs/architecture.md land on a heading that exists", () => {
     const anchors = anchorsOf(architecture);
-    const links = [...readme.matchAll(/docs\/architecture\.md#([\w-]+)/g)].map((match) => match[1]!);
+    const links = [...guide.matchAll(/\(architecture\.md#([\w-]+)/g)].map((match) => match[1]!);
     expect(links.length).toBeGreaterThan(10);
     for (const link of links) expect(anchors.has(link), `docs/architecture.md has no heading for #${link}`).toBe(true);
   });
 
   it("within the page land on a heading that exists", () => {
-    const anchors = anchorsOf(readme);
-    const links = [...readme.matchAll(/\]\(#([\w-]+)\)|href="#([\w-]+)"/g)].map((match) => (match[1] ?? match[2])!);
+    const anchors = anchorsOf(guide);
+    const links = [...guide.matchAll(/\]\(#([\w-]+)\)|href="#([\w-]+)"/g)].map((match) => (match[1] ?? match[2])!);
     expect(links.length).toBeGreaterThan(10);
-    for (const link of links) expect(anchors.has(link), `README.md has no heading for #${link}`).toBe(true);
+    for (const link of links) expect(anchors.has(link), `docs/guide.md has no heading for #${link}`).toBe(true);
   });
 
   it("to files of the repository name files that exist", () => {
-    const paths = [...readme.matchAll(/\]\((?!https?:|#)([^)#\s]+)(?:#[^)\s]*)?\)/g)].map((match) => match[1]!);
+    const paths = [...guide.matchAll(/\]\((?!https?:|#)([^)#\s]+)(?:#[^)\s]*)?\)/g)].map((match) => match[1]!);
     expect(paths.length).toBeGreaterThan(5);
-    for (const path of paths) expect(() => readFileSync(join(repo, path)), path).not.toThrow();
+    for (const path of paths) expect(() => readFileSync(join(repo, "docs", path)), path).not.toThrow();
   });
 });
 
-describe("the README's table of commands", () => {
-  const rows = readme
+describe("the guide's table of commands", () => {
+  const rows = guide
     .split("\n")
     .filter((line) => /^\| `invisible-dots /.test(line))
     .map((line) => /^\| `([^`]+)`/.exec(line)![1]!);
@@ -80,8 +93,8 @@ describe("the README's table of commands", () => {
   });
 });
 
-describe("the README's environment variables", () => {
-  const table = readme.slice(readme.indexOf("<summary>The environment variables the host reads</summary>"));
+describe("the guide's environment variables", () => {
+  const table = guide.slice(guide.indexOf("<summary>The environment variables the host reads</summary>"));
   const listed = [...table.matchAll(/^\| `([A-Z_]+)` \|/gm)].map((match) => match[1]!);
 
   it("are every one the host reads from its environment, except the one it sets for its own child", () => {
@@ -103,19 +116,19 @@ describe("the README's environment variables", () => {
   });
 });
 
-describe("the README's account of the web UI", () => {
+describe("the guide's account of the web UI", () => {
   it("gives each permission preset of the Create a Dot page with the words the page uses", () => {
     for (const id of PRESET_IDS) {
       const { label, description } = PRESETS[id];
-      expect(readme, id).toContain(`| ${label} | ${description} |`);
+      expect(
```

**File**: `tests/repo/whatsapp-optin.test.ts` (modified, +2/-2)
```diff
@@ -96,8 +96,8 @@ describe("the WhatsApp client is installed by one command, from its own pinned l
     expect(whatsappClientDir("/repo")).toBe(join("/repo", ...CLIENT_FOLDER.split("/")));
   });
 
-  it("is the command the README, the architecture document and the notices tell a person to run", () => {
-    for (const path of ["README.md", "docs/architecture.md", "THIRD_PARTY_NOTICES.md"]) expect(read(path), path).toContain("npm run whatsapp:install");
+  it("is the command the guide, the architecture document and the notices tell a person to run", () => {
+    for (const path of ["docs/guide.md", "docs/architecture.md", "THIRD_PARTY_NOTICES.md"]) expect(read(path), path).toContain("npm run whatsapp:install");
   });
 
   it("has its types checked and its tests run by commands of their own, which the default ones leave out", () => {
```

---

### Incident Patch 3: `3ce01717` (2026-10-07)
**Commit Message**: Merge pull request #3 from feder-cr/dots-ui-browser-channels

invisible_dots: a leaner first version, run end to end on real VMs

**File**: `.gitattributes` (modified, +29/-4)
```diff
@@ -1,5 +1,30 @@
-# The pre-push hook is a shell script, and git must never hand it to a POSIX
-# shell with CRLF line endings: `/bin/sh^M: bad interpreter` is how a gate stops
-# running on a machine where nothing else looks wrong. Git-for-Windows' sh is
-# the one that runs it on a Windows clone with core.autocrlf=true.
+# Everything text is stored and checked out with LF. Shell scripts, systemd
+# units, cloud-init templates and the pre-push hook all end up on Linux, where a
+# CRLF turns `#!/bin/sh` into `/bin/sh^M: bad interpreter` and a unit file into
+# one systemd silently misreads. Git-for-Windows with core.autocrlf=true would
+# otherwise convert them on checkout.
+* text=auto eol=lf
+
 .githooks/** text eol=lf
+*.sh text eol=lf
+*.service text eol=lf
+*.timer text eol=lf
+*.socket text eol=lf
+*.target text eol=lf
+*.env text eol=lf
+# Guest files the image builder copies verbatim onto the runtime ISO or into
+# the cloud-init seed, and the Go sources whose gofmt check rejects a CR.
+*.tmpl text eol=lf
+*.yaml text eol=lf
+*.go text eol=lf
+*.sql text eol=lf
+guest/image-builder/** text eol=lf
+
+*.png binary
+*.jpg binary
+*.ico binary
+*.iso binary
+*.img binary
+*.qcow2 binary
+*.woff binary
+*.woff2 binary
```

**File**: `.githooks/pre-push` (modified, +123/-31)
```diff
@@ -1,55 +1,147 @@
 #!/bin/sh
-# Pre-push gate. THE POLICY IS NOT IN THIS FILE - it is `invisible_core.hooks`,
-# and this stub exists only to find an interpreter and hand over stdin.
+# Pre-push gate. Two halves:
 #
-# It used to be here, in three repositories, as 743 lines of shell that were 207
-# identical lines out of 211 between two of them. Nine of the eleven differences
-# were accidental: the core ran no pytest, the core set a variable three times
-# that only the other two ever read, the core resolved an interpreter and then
-# called bare `python` anyway. Every fix landed in whichever copy was open.
-#
-# What this repository wants gated is declared in its own pyproject, under
-# [tool.invisible.hooks]. That is the only per-repo part, and it is data.
+# 1. This repository's own suites, which the shared policy knows nothing
+#    about: the typecheck and vitest over the TypeScript workspace, and go
+#    test over dot-agentd, each counted against .github/test-floors.json.
+# 2. The shared policy, `invisible_core.hooks` from the pinned invisible-core
+#    (.github/gates-requirements.txt): English, identity and the other checks
+#    declared in pyproject.toml under [tool.invisible.hooks]. That pyproject
+#    is configuration only; nothing here is a Python package.
 #
 # Install once with:
 #   git config core.hooksPath .githooks
-# A test in this repo fails in an uninstalled checkout, so nobody has to
-# remember. Bypass a known-broken WIP push with `git push --no-verify`; that is
-# the only escape hatch, and never for a branch that feeds a release.
+# Bypass a known-broken WIP push with `git push --no-verify`; that is the only
+# escape hatch, and never for a branch that feeds a release.
 
 # No `set -e`: exit codes here have to be READ and explained, not turned into a
 # silent abort. A gate that dies without a message is the worst shape of all.
 
 # Run from the repository root regardless of where `git push` was invoked.
 cd "$(dirname "$0")/.." || exit 1
 
+refuse() {
+    for line in "$@"; do
+        echo "[pre-push] $line" >&2
+    done
+    exit 1
+}
+
+# git runs a hook with GIT_DIR, GIT_INDEX_FILE and friends pointing at this
+# repository. A test that creates its own scratch repository would then
+# address this one instead. Each suite runs in a subshell without them, and
+# with stdin from /dev/null, because stdin is the list of refs being pushed
+# and belongs to the policy in step 2.
+without_git_env() {
+    (
+        for name in $(env | sed -n 's/^\(GIT_[A-Za-z0-9_]*\)=.*/\1/p'); do
+            unset "$name"
+        done
+        "$@"
+    ) </dev/null
+}
+
+# 1a. The TypeScript workspace. node_modules must exist: installing is a
+# decision for the person, not something a hook does behind their back.
+if ! command -v npm >/dev/null 2>&1; then
+    refuse "REFUSED - npm is not on PATH, so the TypeScript suites cannot run." \
+           "Install Node 24 and run 'npm ci' once, then push again."
+fi
+if [ ! -d node_modules ]; then
+    refuse "REFUSED - node_modules is missing. Run 'npm ci' once, then push again."
+fi
+# The same three gates as CI's node job: types first (vitest strips them, so
+# a type error passes every test), then vitest with its report, then the
+# guard that counts what ran against .github/test-floors.json, because a run
+# that collected too few tests or skipped some still exits 0.
+mkdir -p tmp
+echo "[pre-push] npm run typecheck"
+without_git_env npm run typecheck
+status=$?
+if [ "$status" -ne 0 ]; then
+    refuse "REFUSED - npm run typecheck exited with $status. Nothing is pushed past a type error."
+fi
+echo "[pre-push] vitest"
+without_git_env npx vitest run --reporter=default --reporter=json --outputFile=tmp/vitest-report.json
+status=$?
+if [ "$status" -ne 0 ]; then
+    refuse "REFUSED - vitest exited with $status. Nothing is pushed past a red suite."
+fi
+without_git_env node .github/scripts/test-guard.mjs tmp/vitest-report.json --suite vitest
+status=$?
+if [ "$status" -ne 0 ]; then
+    refuse "REFUSED - the vitest run did not reach this host's floor in .github/test-floors.json (see above)."
+fi
+
+# 1b. dot-agentd. Without Go its tests cannot run here, and a push that no
+# one tested is refused rather than waved through on the strength of CI.
+if ! command -v go >/dev/null 2>&1; then
+    refuse "REFUSED - go is not on PATH, so the dot-agentd tests cannot run." \
+           "Install Go (1.25 or newer, see guest/dot-agentd/go.mod) and push again."
+fi
+# The same checks, in the same order, as the go job in tests.yml: a file gofmt
+# would rewrite, or code go vet rejects, is refused here instead of in CI.
+echo "[pre-push] gofmt and go vet (guest/dot-agentd)"
+unformatted=$(cd guest/dot-agentd && gofmt -l .)
+if [ -n "$unformatted" ]; then
+    refuse "REFUSED - gofmt would rewrite these dot-agentd files:" "$unformatted" \
+           "Run gofmt -w on them and push again."
+fi
+(cd guest/dot-agentd && without_git_env go vet ./... && without_
```

**File**: `.github/gates-requirements.txt` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+invisible-core==34.31.0
```

**File**: `.github/scripts/golden-release.mjs` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+#!/usr/bin/env node
+// Puts the golden image `image build --compress` made into the shape of a release (guest/image-builder/src/prebuilt.ts):
+// its manifest, the image cut in parts under the 2 GiB a release asset may hold, and release.json naming each part with
+// its size and SHA-256. Prints the tag, golden-<inputs digest>.
+//
+//   node .github/scripts/golden-release.mjs <images directory> <output directory>
+import { createHash } from "node:crypto";
+import { createReadStream } from "node:fs";
+import { copyFile, mkdir, open, readdir, readFile, writeFile } from "node:fs/promises";
+import { basename, join } from "node:path";
+
+const PART_BYTES = 1900 * 1024 * 1024;
+
+const [imagesDir, outDir] = process.argv.slice(2);
+if (!imagesDir || !outDir) {
+  console.error("usage: golden-release.mjs <images directory> <output directory>");
+  process.exit(2);
+}
+
+const manifests = (await readdir(imagesDir)).filter((name) => /^golden-.+\.json$/.test(name));
+if (manifests.length !== 1) {
+  console.error(`expected one golden manifest in ${imagesDir}, found ${manifests.length}`);
+  process.exit(1);
+}
+const manifestName = manifests[0];
+const manifest = JSON.parse(await readFile(join(imagesDir, manifestName), "utf8"));
+const image = join(imagesDir, manifest.file);
+await mkdir(outDir, { recursive: true });
+await copyFile(join(imagesDir, manifestName), join(outDir, manifestName));
+
+const parts = [];
+let out;
+let hash;
+let written = 0;
+const whole = createHash("sha256");
+async function closePart() {
+  if (!out) return;
+  await out.close();
+  parts[parts.length - 1].size = written;
+  parts[parts.length - 1].sha256 = hash.digest("hex");
+  out = undefined;
+}
+for await (let chunk of createReadStream(image, { highWaterMark: 8 * 1024 * 1024 })) {
+  whole.update(chunk);
+  while (chunk.length > 0) {
+    if (!out) {
+      const name = `${basename(manifest.file)}.part${String(parts.length).padStart(2, "0")}`;
+      parts.push({ name, size: 0, sha256: "" });
+      out = await open(join(outDir, name), "w");
+      hash = createHash("sha256");
+      written = 0;
+    }
+    const take = chunk.subarray(0, PART_BYTES - written);
+    await out.write(take);
+    hash.update(take);
+    written += take.length;
+    chunk = chunk.subarray(take.length);
+    if (written === PART_BYTES) await closePart();
+  }
+}
+await closePart();
+
+const sha256 = whole.digest("hex");
+if (sha256 !== manifest.sha256) {
+  console.error(`${image} hashes to ${sha256}, its manifest says ${manifest.sha256}`);
+  process.exit(1);
+}
+await writeFile(join(outDir, "release.json"), `${JSON.stringify({ inputs_digest: manifest.inputs_digest, manifest: manifestName, parts }, null, 2)}\n`);
+console.log(`golden-${manifest.inputs_digest}`);
```

**File**: `.github/scripts/test-guard.mjs` (added, +193/-0)
```diff
@@ -0,0 +1,193 @@
+// Reads a test run's report and refuses a run that only looks green.
+//
+// vitest, `go test` and pytest exit 0 when nothing failed, which is also what they do
+// when a whole file stopped being collected, when a suite skipped itself
+// because a tool or a database was missing, or when a build constraint left
+// a file out. Each of those reads exactly like a pass. So the count of tests
+// that really ran is checked against a floor, and every skipped test must be
+// one this host is known to skip.
+//
+//   node .github/scripts/test-guard.mjs <report> --suite <name> [--floors <file>]
+//
+// <report>  vitest's JSON report (--reporter=json --outputFile) for the
+//           vitest suites, the output of `go test -json` for "go", and a
+//           JUnit XML report (a file ending in .xml: pytest --junitxml for
+//           the Python engine, Playwright's junit reporter for the web
+//           client's browser tests).
+// --suite   the entry of the floors file to apply: vitest, postgres, whatsapp,
+//           go, pytest or playwright.
+// --floors  default .github/test-floors.json. The entry is chosen by the
+//           host this runs on (linux, win32), so CI and the pre-push hook
+//           read the same numbers from the same file.
+//
+// A floor entry: min_passed, allow_skipped (a regex over a skipped test's
+// full name, "" for none), and require ({ regex: n }: at least n passed
+// tests whose full name matches, e.g. the suites parametrized on pg).
+//
+// Raise the floors when tests are added; lowering one is a decision to write
+// down in the commit that does it.
+import { readFileSync } from "node:fs";
+
+function fail(message) {
+  console.error(`test-guard: REFUSED - ${message}`);
+  process.exit(1);
+}
+
+const args = process.argv.slice(2);
+const reportPath = args.shift();
+const usage = "usage: test-guard.mjs <report> --suite <vitest|postgres|whatsapp|go|pytest|playwright> [--floors <file>]";
+if (!reportPath) fail(usage);
+let suite;
+let floorsPath = ".github/test-floors.json";
+while (args.length > 0) {
+  const flag = args.shift();
+  const value = args.shift();
+  if (value === undefined) fail(`${flag} needs a value`);
+  if (flag === "--suite") suite = value;
+  else if (flag === "--floors") floorsPath = value;
+  else fail(`unknown option ${flag}; ${usage}`);
+}
+if (!suite) fail(usage);
+
+let floors;
+try {
+  floors = JSON.parse(readFileSync(floorsPath, "utf8"));
+} catch (error) {
+  fail(`cannot read ${floorsPath}: ${error.message}`);
+}
+// The host this runs on picks the floor, because each host runs a different
+// set (a test that needs a real Windows PowerShell, a Go file built only on
+// unix). This script is a check of the test run, not product code.
+const host = process.platform;
+const floor = floors[suite]?.[host];
+if (!floor) fail(`${floorsPath} has no "${suite}" floor for ${host}`);
+const minPassed = floor.min_passed;
+if (!Number.isInteger(minPassed) || minPassed <= 0) fail(`${floorsPath} ${suite}.${host}.min_passed must be a positive integer`);
+const allowSkipped = floor.allow_skipped ? new RegExp(floor.allow_skipped) : undefined;
+const required = Object.entries(floor.require ?? {}).map(([pattern, min]) => ({ pattern: new RegExp(pattern), min }));
+
+let text;
+try {
+  text = readFileSync(reportPath, "utf8");
+} catch (error) {
+  fail(`cannot read ${reportPath}: ${error.message}`);
+}
+
+/** Every test of the run as { fullName, status, file }, status passed | failed | skipped. */
+function vitestTests() {
+  let report;
+  try {
+    report = JSON.parse(text);
+  } catch (error) {
+    fail(`${reportPath} is not vitest's JSON report (${error.message}); run vitest with --reporter=json --outputFile`);
+  }
+  const tests = report.testResults.flatMap((file) =>
+    file.assertionResults.map((test) => ({
+      fullName: test.fullName,
+      status: test.status === "passed" || test.status === "failed" ? test.status : "skipped",
+      file: file.name,
+    })),
+  );
+  // A file that failed to load has no failed test of its own, only an error.
+  const broken = report.testResults
+    .filter((file) => file.status === "failed" && file.assertionResults.every((test) => test.status !== "failed"))
+    .map((file) => `${file.name} failed outside any test: ${(file.message ?? "").split("\n")[0]}`);
+  return { tests, broken, files: report.testResults.length };
+}
+
+/** The text an XML attribute value stands for. */
+function xmlText(value) {
+  return value
+    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
+    .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
+    .replace(/&lt;/g, "<")
+    .replace(/&gt;/g, ">")
+    .replace(/&quot;/g, '"')
+    .replace(/&apos;/g, "'")
+    .replace(/&amp;/g, "&");
+}
+
+/** The attributes of one start tag, as an object. */
+function xmlAttributes(tag) {
+  const attributes = {};
+  for (const match of tag.matchAll(/([\w:.-]+)="
```

**File**: `.github/test-floors.json` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+{
+  "//": "What each suite must reach on each host, read by .github/scripts/test-guard.mjs in CI (tests.yml) and in the pre-push hook. Raise a floor when tests are added; lowering one is a decision to write down in the commit that does it. Linux skips only the tests that drive a real Windows PowerShell; a Windows host compiles dot-agentd's unix-only test files out and skips the two Go tests that need a Linux guest. The playwright floor is the web client's browser tests (the web job of tests.yml; the same eighty-seven run on a Windows host, which is where they are developed). The pytest floor is the Python engine's (invisible_engine_dots, the engine job of tests.yml, Linux only, nothing may skip). The whatsapp floor is the suite that needs the real WhatsApp client, an opt-in install (npm run test:whatsapp, the whatsapp-client job of tests.yml, which installs the client and runs it with PostgreSQL, so the pg runs of the auth state count); a host without PostgreSQL reaches the win32 number.",
+  "vitest": {
+    "linux": { "min_passed": 2099, "allow_skipped": "^generated PowerShell on a real Windows PowerShell " },
+    "win32": { "min_passed": 2102, "allow_skipped": "" }
+  },
+  "postgres": {
+    "linux": { "min_passed": 699, "allow_skipped": "", "require": { "\\bpg\\b": 272 } }
+  },
+  "whatsapp": {
+    "linux": { "min_passed": 25, "allow_skipped": "", "require": { "\\bpg\\b": 9 } },
+    "win32": { "min_passed": 16, "allow_skipped": "" }
+  },
+  "go": {
+    "linux": { "min_passed": 120, "allow_skipped": "" },
+    "win32": { "min_passed": 70, "allow_skipped": "^agentd (TestSystemRoute|TestPowerOffStartsTheCommandAndAnswers202)$" }
+  },
+  "pytest": {
+    "linux": { "min_passed": 2223, "allow_skipped": "" }
+  },
+  "playwright": {
+    "linux": { "min_passed": 87, "allow_skipped": "" },
+    "win32": { "min_passed": 87, "allow_skipped": "" }
+  }
+}
```

**File**: `.github/workflows/golden-image.yml` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+name: golden image
+
+# Builds the golden image once, here, and publishes it as the release golden-<inputs digest>, which
+# `invisible-dots image build` downloads instead of building (guest/image-builder/src/prebuilt.ts). The digest is the
+# one every host computes from the pinned inputs, so a host only ever takes the image of its own inputs. A digest that
+# already has its release is not built again.
+on:
+  push:
+    branches: [main]
+    paths:
+      - guest/image-builder/**
+      - virtualization/images/**
+  workflow_dispatch:
+
+permissions:
+  contents: write
+
+concurrency:
+  group: golden-image
+  cancel-in-progress: false
+
+defaults:
+  run:
+    shell: bash
+
+jobs:
+  build:
+    name: build and publish the golden image
+    runs-on: ubuntu-latest
+    timeout-minutes: 180
+    env:
+      INVISIBLE_DOTS_HOME: ${{ github.workspace }}/../idots-home
+      GH_TOKEN: ${{ github.token }}
+    steps:
+      - uses: actions/checkout@v4
+      - uses: actions/setup-node@v4
+        with:
+          node-version: "24"
+          cache: npm
+      - uses: actions/setup-go@v5
+        with:
+          go-version-file: guest/dot-agentd/go.mod
+      - name: KVM for the builder VM, and QEMU
+        run: |
+          echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' | sudo tee /etc/udev/rules.d/99-kvm4all.rules
+          sudo udevadm control --reload-rules
+          sudo udevadm trigger --name-match=kvm
+          sudo apt-get update -qq
+          sudo apt-get install -y -qq --no-install-recommends qemu-system-x86 qemu-utils
+      - run: npm ci --no-audit --no-fund
+      - run: npm run build --workspace @invisible-dots/cli
+      # The runtime ISO, which `image build` makes first, carries dot-agentd.
+      - run: CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go -C guest/dot-agentd build -trimpath -o bin/dot-agentd ./cmd/dot-agentd
+      - name: the image (downloaded instead when its release exists already)
+        id: build
+        run: |
+          node apps/cli/dist/invisible-dots.mjs image build --compress | tee build.log
+          tag=$(node .github/scripts/golden-release.mjs "$INVISIBLE_DOTS_HOME/images" "$RUNNER_TEMP/release")
+          echo "tag=$tag" >> "$GITHUB_OUTPUT"
+      - name: publish
+        run: |
+          tag='${{ steps.build.outputs.tag }}'
+          if gh release view "$tag" >/dev/null 2>&1; then
+            echo "$tag is published already"
+            exit 0
+          fi
+          gh release create "$tag" "$RUNNER_TEMP"/release/* \
+            --title "Golden image $tag" \
+            --notes "The golden image of the inputs ${tag#golden-}, built by the golden image workflow from ${GITHUB_SHA}. invisible-dots image build downloads it when a checkout's inputs have this digest. It holds Ubuntu 24.04 and the software guest/image-builder/pins.json and the locks name, each under its own license (THIRD_PARTY_NOTICES.md)."
```

**File**: `.github/workflows/tests.yml` (modified, +271/-62)
```diff
@@ -14,16 +14,260 @@ concurrency:
   group: ${{ github.workflow }}-${{ github.ref }}
   cancel-in-progress: true
 
-# `gate` is the ONLY context the branch protection requires: it depends on every
-# job, so its name never drifts when the matrix changes. Unlike its siblings it
-# accepts nothing but success, because no job here is ever skipped on purpose:
-# a skip would mean a job that did not run, which reads exactly like one that
-# passed.
 defaults:
   run:
     shell: bash
 
+# `gate` is the ONLY context the branch protection requires: it depends on every
+# job, so its name never drifts when the jobs change. It accepts nothing but
+# success, because no job here is ever skipped on purpose and none has a paths
+# filter: a skip would mean a job that did not run, which reads exactly like
+# one that passed.
 jobs:
+  node:
+    name: typecheck, vitest and the bundle (${{ matrix.os }})
+    runs-on: ${{ matrix.os }}
+    strategy:
+      fail-fast: false
+      matrix:
+        # The floors each host must reach live in .github/test-floors.json,
+        # which the pre-push hook reads too.
+        os: [ubuntu-latest, windows-latest]
+    steps:
+      - uses: actions/checkout@v4
+      - uses: actions/setup-node@v4
+        with:
+          node-version: "24"
+          cache: npm
+      - run: npm ci --no-audit --no-fund
+      - run: npm run typecheck
+      - name: the pre-push hook parses
+        run: sh -n .githooks/pre-push
+      - name: vitest
+        run: npx vitest run --reporter=default --reporter=json --outputFile=vitest-report.json
+      # vitest's exit code cannot tell "everything passed" from "half of it
+      # was never collected" or "a suite skipped itself": count what ran.
+      - name: refuse a run with too few tests or an unexpected skip
+        if: always()
+        run: node .github/scripts/test-guard.mjs vitest-report.json --suite vitest
+      - name: bundle (the command, which carries the server)
+        run: npm run build --workspace @invisible-dots/cli
+      # The bundled command on a fresh home: doctor must run end to end and
+      # create nothing. Its exit code is not 0 here (no QEMU, no images), so
+      # only "it ran and printed every check" is asserted.
+      - name: the bundled doctor runs and creates nothing
+        env:
+          INVISIBLE_DOTS_HOME: ${{ runner.temp }}/idots-home
+        run: |
+          set +e
+          node apps/cli/dist/invisible-dots.mjs doctor > doctor.txt 2>&1
+          code=$?
+          set -e
+          cat doctor.txt
+          echo "doctor exit code: $code"
+          grep -q "checks:" doctor.txt
+          test ! -e "$INVISIBLE_DOTS_HOME"
+
+  postgres:
+    name: the pg adapter against PostgreSQL
+    runs-on: ubuntu-latest
+    services:
+      postgres:
+        image: postgres:18.4-alpine3.23
+        env:
+          POSTGRES_PASSWORD: test
+        ports:
+          - 5432:5432
+        options: >-
+          --health-cmd "pg_isready -U postgres"
+          --health-interval 2s
+          --health-timeout 5s
+          --health-retries 30
+    env:
+      # With DATABASE_URL set, every suite parametrized with testAdapters()
+      # runs on pg as well as on PGlite.
+      DATABASE_URL: postgres://postgres:test@127.0.0.1:5432/postgres
+    steps:
+      - uses: actions/checkout@v4
+      - uses: actions/setup-node@v4
+        with:
+          node-version: "24"
+          cache: npm
+      - run: npm ci --no-audit --no-fund
+      - name: vitest on both adapters
+        run: npx vitest run packages/database packages/events packages/channels apps/api apps/scheduler --reporter=default --reporter=json --outputFile=vitest-report.json
+      - name: refuse a run in which the pg suites did not run
+        if: always()
+        run: node .github/scripts/test-guard.mjs vitest-report.json --suite postgres
+
+  # The WhatsApp client (Baileys) is an opt-in install: it depends on libsignal, which is GPL-3.0, and the default
+  # npm install holds nothing GPL. The jobs above never install it. This one does, with the command a person runs
+  # (npm run whatsapp:install), to prove the adapter against the real library: the types (the real module has the
+  # shape the adapter writes down) and the tests that need it, on PGlite and on PostgreSQL.
+  whatsapp-client:
+    name: the WhatsApp client, opt-in (types and tests on the real library)
+    runs-on: ubuntu-latest
+    services:
+      postgres:
+        image: postgres:18.4-alpine3.23
+        env:
+          POSTGRES_PASSWORD: test
+        ports:
+          - 5432:5432
+        options: >-
+          --health-cmd "pg_isready -U postgres"
+          --health-interval 2s
+          --health-timeout 5s
+          --health-retries 30
+    env:
+      DATABASE_URL: postgres://postgres:test@127.0.0.1:5432/postgres
+    steps:
+      - uses: actions/checkout@v4
+      - uses: actions/setup-node@v4
+        with:
+          node-version: "24"
+          cache: npm
+      - run: npm
```

---

### Incident Patch 4: `71953801` (2026-10-07)
**Commit Message**: cli test: serve's tests wait for what they check instead of a fixed 20 ms

serve starts the control plane, then listens for the stop signal, then starts the web client, each asynchronously. The tests slept 20 ms and then asserted, which a loaded machine loses: the soak run read webOptions[0] before the web start had happened. Each now waits (vi.waitFor) for its own condition: the start it checks, the SIGINT listener, or the web start having begun before Ctrl+C.

**File**: `apps/cli/test/serve.test.ts` (modified, +12/-11)
```diff
@@ -2,7 +2,7 @@ import { EventEmitter } from "node:events";
 import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
 import { tmpdir } from "node:os";
 import { join } from "node:path";
-import { afterEach, beforeEach, describe, expect, it } from "vitest";
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
 import { parseListen } from "@invisible-dots/api";
 import type { HostPaths } from "@invisible-dots/shared";
 import { serve, type ServeDeps } from "../src/serve.js";
@@ -70,15 +70,15 @@ function harness(over: { webStart?: (options: WebServerOptions) => Promise<WebSe
   return { run, log, lines, signals, webOptions, release: () => stopped?.() };
 }
 
-const tick = () => new Promise((resolve) => setTimeout(resolve, 20));
+/** Waits until the check holds: serve starts its parts asynchronously, and a fixed wait loses that race on a loaded machine. */
+const until = (check: () => void) => vi.waitFor(check, { timeout: 5_000, interval: 5 });
 
 describe("serve", () => {
   it("starts the control plane, then the web client on the default address pointed at it, and stops them in the other order", async () => {
     await buildWeb();
     const h = harness();
     const running = h.run({ web: true });
-    await tick();
-    expect(h.log).toEqual(["server start env=given", "web start"]);
+    await until(() => expect(h.log).toEqual(["server start env=given", "web start"]));
     expect(h.webOptions[0]).toMatchObject({ listen: { host: "127.0.0.2", port: 3000 }, apiUrl: "http://127.0.0.1:8787" });
     expect(h.webOptions[0]!.build.missing).toBeUndefined();
     expect(h.lines).toContain("info API token in /home/x/.invisible-dots/config/api.token; stop with Ctrl+C (Dots keep running)");
@@ -92,8 +92,7 @@ describe("serve", () => {
     await buildWeb();
     const h = harness();
     const running = h.run({ web: true, env: { INVISIBLE_DOTS_WEB_LISTEN: "127.0.0.1:3100" } });
-    await tick();
-    expect(h.webOptions[0]!.listen).toEqual({ host: "127.0.0.1", port: 3100 });
+    await until(() => expect(h.webOptions[0]?.listen).toEqual({ host: "127.0.0.1", port: 3100 }));
     h.signals.emit("SIGINT");
     await running;
   });
@@ -123,7 +122,8 @@ describe("serve", () => {
     await buildWeb();
     const h = harness();
     const running = h.run({ web: false, env: { INVISIBLE_DOTS_WEB_LISTEN: "garbage" } });
-    await tick();
+    // Running: it waits for the stop signal.
+    await until(() => expect(h.signals.listenerCount("SIGINT")).toBe(1));
     h.signals.emit("SIGINT");
     await running;
     expect(h.log).toEqual(["server start env=given", "server close"]);
@@ -136,8 +136,7 @@ describe("serve", () => {
       },
     });
     const running = h.run({ web: true });
-    await tick();
-    expect(h.lines).toContain("warn web client not started: http://127.0.0.1:3000 is already in use; the control plane keeps running");
+    await until(() => expect(h.lines).toContain("warn web client not started: http://127.0.0.1:3000 is already in use; the control plane keeps running"));
     expect(h.log).toEqual(["server start env=given"]);
     h.signals.emit("SIGINT");
     await running;
@@ -146,9 +145,11 @@ describe("serve", () => {
 
   it("closes the control plane on Ctrl+C while the web client is still starting, and ends that start", async () => {
     let aborted = false;
+    let starting = false;
     const h = harness({
       webStart: (options) =>
         new Promise((_resolve, reject) => {
+          starting = true;
           options.signal!.addEventListener("abort", () => {
             aborted = true;
             reject(new Error("stopped while the web client was starting"));
@@ -157,7 +158,7 @@ describe("serve", () => {
     });
     await buildWeb();
     const running = h.run({ web: true });
-    await tick();
+    await until(() => expect(starting).toBe(true));
     h.signals.emit("SIGINT");
     await running;
     expect(aborted).toBe(true);
@@ -169,7 +170,7 @@ describe("serve", () => {
   it("names the missing build in the web start it hands over, so the warning carries the fix", async () => {
     const h = harness();
     const running = h.run({ web: true });
-    await tick();
+    await until(() => expect(h.webOptions).toHaveLength(1));
     expect(h.webOptions[0]!.build.missing).toBe(h.webOptions[0]!.build.entry);
     h.signals.emit("SIGINT");
     await running;
```

---

### Incident Patch 5: `d4a3870e` (2026-10-07)
**Commit Message**: tests: the forced-colors outline is read once settled, and the Linux host's copy leaves the web client's test output out

shell.spec.ts read the focused button's outline right after the Tab, and its transition-all eases the outline in from the default medium width (3px) to 2px over 150 ms: on a loaded machine it read 3px every time (measured: 3px at once, 2px 300 ms later). It now polls until 2px. prepare.sh copied apps/web/test-results and playwright-report.xml, which no clone has, and tar failed when a browser test run wrote there during the copy.

**File**: `apps/web/e2e/shell.spec.ts` (modified, +3/-1)
```diff
@@ -141,6 +141,8 @@ test("a focused control keeps an outline under forced colors, where box shadows
   await expect(page.getByRole("heading", { name: "Create a Dot" })).toBeVisible();
   const forced = await focused();
   expect(forced.outlineStyle).toBe("solid");
-  expect(forced.outlineWidth).toBe("2px");
+  // The button's transition-all eases its outline in from the default width (medium, 3px) over 150 ms: it is read
+  // once settled, or a loaded machine reads it on the way.
+  await expect.poll(() => page.evaluate(() => getComputedStyle(document.activeElement!).outlineWidth)).toBe("2px");
   expect(forced.outlineColor).not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
 });
```

**File**: `tests/e2e/linux-host/prepare.sh` (modified, +1/-0)
```diff
@@ -20,6 +20,7 @@ tar -C "$src" \
   --exclude=./node_modules --exclude='./*/node_modules' --exclude='./*/*/node_modules' \
   --exclude=.next --exclude=./tmp --exclude=.git \
   --exclude=./apps/cli/dist --exclude=./invisible_engine_dots/.venv \
+  --exclude=./apps/web/test-results --exclude=./apps/web/playwright-report.xml \
   -cf - . | tar -C "$dest" -xf -
 
 cd "$dest"
```

---

### Incident Patch 6: `b69184e1` (2026-10-07)
**Commit Message**: tests: the vitest floors are what the pre-push gate measured, 2099 on Windows and 2096 on Linux

The floors lowered with the Memory tab, the browser's view and the goal were worked out from the lines of vitest list, which shows an it.each once: the deleted files (memory, memory-view, notes, automations, identity, browser-activity, login, session) took more runs than that. The gate's run on Windows: 2099 passed, 0 failed, 0 skipped, in 149 files. Linux stays three below, the generated PowerShell tests it skips.

**File**: `.github/test-floors.json` (modified, +2/-2)
```diff
@@ -1,8 +1,8 @@
 {
   "//": "What each suite must reach on each host, read by .github/scripts/test-guard.mjs in CI (tests.yml) and in the pre-push hook. Raise a floor when tests are added; lowering one is a decision to write down in the commit that does it. Linux skips only the tests that drive a real Windows PowerShell; a Windows host compiles dot-agentd's unix-only test files out and skips the two Go tests that need a Linux guest. The playwright floor is the web client's browser tests (the web job of tests.yml; the same eighty-six run on a Windows host, which is where they are developed). The pytest floor is the Python engine's (invisible_engine_dots, the engine job of tests.yml, Linux only, nothing may skip). The whatsapp floor is the suite that needs the real WhatsApp client, an opt-in install (npm run test:whatsapp, the whatsapp-client job of tests.yml, which installs the client and runs it with PostgreSQL, so the pg runs of the auth state count); a host without PostgreSQL reaches the win32 number.",
   "vitest": {
-    "linux": { "min_passed": 2121, "allow_skipped": "^generated PowerShell on a real Windows PowerShell " },
-    "win32": { "min_passed": 2124, "allow_skipped": "" }
+    "linux": { "min_passed": 2096, "allow_skipped": "^generated PowerShell on a real Windows PowerShell " },
+    "win32": { "min_passed": 2099, "allow_skipped": "" }
   },
   "postgres": {
     "linux": { "min_passed": 699, "allow_skipped": "", "require": { "\\bpg\\b": 272 } }
```

---

### Incident Patch 7: `07cb4560` (2026-10-06)
**Commit Message**: memory: the Dot keeps it itself, as Claude Code does; the Memory tab and everything it set are gone

The notes stay what they were, files in /home/dot/memory, but nothing about them is a setting any more. The prompt
always says where they are, that the Dot saves there what a later conversation will need and changes a note that is
no longer true, and names the newest; the Dot reads and writes them with its file tools (grep, find_files,
read_file, write_file, edit_file). Gone: the memory_search and memory_get tools and their memory.read permission,
the memory.enabled switch, the memory.written event and the chat's "Remembered" chip, the Memory page with its notes
and its automations views, and the routes that listed, paused and deleted automations (engine, guest client,
scheduler, API, SDK). The automations themselves stay the Dot's: it makes and removes them with its cron tool, and
the host still hears when the next one is due.

Migration 0009 takes memory and memory.read out of the configs already saved (moving their version on) and the
memory.written rows out of the log; an engine file made before keeps its old intents column, which its default fills.

Two defects found on the way

**File**: `.github/test-floors.json` (modified, +7/-7)
```diff
@@ -1,11 +1,11 @@
 {
-  "//": "What each suite must reach on each host, read by .github/scripts/test-guard.mjs in CI (tests.yml) and in the pre-push hook. Raise a floor when tests are added; lowering one is a decision to write down in the commit that does it. Linux skips only the tests that drive a real Windows PowerShell; a Windows host compiles dot-agentd's unix-only test files out and skips the two Go tests that need a Linux guest. The playwright floor is the web client's browser tests (the web job of tests.yml; the same ninety-six run on a Windows host, which is where they are developed). The pytest floor is the Python engine's (invisible_engine_dots, the engine job of tests.yml, Linux only, nothing may skip). The whatsapp floor is the suite that needs the real WhatsApp client, an opt-in install (npm run test:whatsapp, the whatsapp-client job of tests.yml, which installs the client and runs it with PostgreSQL, so the pg runs of the auth state count); a host without PostgreSQL reaches the win32 number.",
+  "//": "What each suite must reach on each host, read by .github/scripts/test-guard.mjs in CI (tests.yml) and in the pre-push hook. Raise a floor when tests are added; lowering one is a decision to write down in the commit that does it. Linux skips only the tests that drive a real Windows PowerShell; a Windows host compiles dot-agentd's unix-only test files out and skips the two Go tests that need a Linux guest. The playwright floor is the web client's browser tests (the web job of tests.yml; the same eighty-six run on a Windows host, which is where they are developed). The pytest floor is the Python engine's (invisible_engine_dots, the engine job of tests.yml, Linux only, nothing may skip). The whatsapp floor is the suite that needs the real WhatsApp client, an opt-in install (npm run test:whatsapp, the whatsapp-client job of tests.yml, which installs the client and runs it with PostgreSQL, so the pg runs of the auth state count); a host without PostgreSQL reaches the win32 number.",
   "vitest": {
-    "linux": { "min_passed": 2224, "allow_skipped": "^generated PowerShell on a real Windows PowerShell " },
-    "win32": { "min_passed": 2227, "allow_skipped": "" }
+    "linux": { "min_passed": 2151, "allow_skipped": "^generated PowerShell on a real Windows PowerShell " },
+    "win32": { "min_passed": 2154, "allow_skipped": "" }
   },
   "postgres": {
-    "linux": { "min_passed": 701, "allow_skipped": "", "require": { "\\bpg\\b": 272 } }
+    "linux": { "min_passed": 699, "allow_skipped": "", "require": { "\\bpg\\b": 272 } }
   },
   "whatsapp": {
     "linux": { "min_passed": 25, "allow_skipped": "", "require": { "\\bpg\\b": 9 } },
@@ -16,10 +16,10 @@
     "win32": { "min_passed": 70, "allow_skipped": "^agentd (TestSystemRoute|TestPowerOffStartsTheCommandAndAnswers202)$" }
   },
   "pytest": {
-    "linux": { "min_passed": 2299, "allow_skipped": "" }
+    "linux": { "min_passed": 2221, "allow_skipped": "" }
   },
   "playwright": {
-    "linux": { "min_passed": 96, "allow_skipped": "" },
-    "win32": { "min_passed": 96, "allow_skipped": "" }
+    "linux": { "min_passed": 86, "allow_skipped": "" },
+    "win32": { "min_passed": 86, "allow_skipped": "" }
   }
 }
```

**File**: `README.md` (modified, +7/-8)
```diff
@@ -274,9 +274,6 @@ History lists the answered ones.
   browser identities and shows the window of an open one. Files is a read-only
   walk through `/home/dot`. Usage shows what the computer was given and what it
   uses, the model spend today and in total, and Start, Reboot and Stop.
-- **Memory**: the notes the Dot wrote (read only) and its automations, each with
-  its schedule in words, its next and last run, a switch that pauses it and a
-  delete. You cannot create one there: an automation is the Dot's own act.
 - **Channels**: Telegram and WhatsApp, below.
 - **Activity**: the whole event log as readable lines, filtered by kind,
   searchable, and exportable as JSON Lines.
@@ -339,10 +336,12 @@ Its tools, each behind a permission
 - **Run commands** on its own computer: a shell with a timeout, background
   jobs, and programs on a pseudo-terminal that it reads as a screen of text.
 - **Read and write files**: read, list, find, grep, write, edit, apply a patch.
-- **Keep notes**: one file per note in `/home/dot/memory`, found again with a
-  keyword search; the newest ones are named in its prompt.
+- **Keep its memory**: one file per note in `/home/dot/memory`, kept by the Dot
+  itself as Claude Code keeps its own: there is nothing to set. It finds them
+  again with its file tools, and the newest ones are named in its prompt.
 - **Schedule itself**: add, list and remove its own automations (at a time,
-  every interval, or a cron expression). This one asks you first by default.
+  every interval, or a cron expression). This one asks you first by default;
+  to pause or remove one, ask the Dot.
 - **Use its browsers**: create, launch and close identities; navigate (http
   and https only), read the page, take screenshots, click, type, select,
   scroll, go back and forward.
@@ -385,7 +384,7 @@ talks to chats.
   the model no, `ask` stops the turn and records the call with its arguments
   ([architecture: policy](docs/architecture.md#84-policy)).
 - The defaults are permissive for the Dot's own computer: running commands,
-  files, the browser and memory are allowed, except deleting a browser
+  files and the browser are allowed, except deleting a browser
   identity, which asks; automations ask; anything unknown is denied. Set any
   permission to `ask` or `deny` in the YAML to be asked first or to forbid it.
 - An approval can be answered in the web UI, the command line, a Telegram
@@ -637,7 +636,7 @@ The full contract every part is written against:
 
 A Dot is one YAML file, checked by one schema: name, goal, instructions,
 model, computer (cpu, memory, disk, idle timeout), browser identities,
-permissions, memory and limits. Every field and its range is in
+permissions and limits. Every field and its range is in
 [architecture: Dot configuration](docs/architecture.md#7-dot-configuration);
 `invisible-dots init` writes a sample.
 
```

**File**: `THIRD_PARTY_NOTICES.md` (modified, +1/-2)
```diff
@@ -456,8 +456,7 @@ SOFTWARE.
 
 ## assistant-ui
 
-`apps/web/src/components/elements/approval-card.tsx`,
-`schedule-card.tsx` and `memory-chips.tsx` in the same folder, and
+`apps/web/src/components/elements/approval-card.tsx` and
 `apps/web/src/lib/range.ts` derive from assistant-ui
 (https://github.com/assistant-ui/assistant-ui, commit 0bdf050); each file's first
 comment says what was changed.
```

**File**: `apps/api/src/server.ts` (modified, +2/-17)
```diff
@@ -33,7 +33,6 @@ import {
   MAX_EVENT_PAGE,
   TASK_LIST_LIMIT,
   type ApprovalStatus,
-  type AutomationListAnswer,
   type ChannelKind,
   type DoctorCheck,
   type ListOrder,
@@ -60,7 +59,7 @@ export interface ServerOptions {
   heartbeatMs?: number;
 }
 
-type Params = { id: string; identityId: string; automationId: string; kind: string; peer: string };
+type Params = { id: string; identityId: string; kind: string; peer: string };
 type Body = Record<string, unknown> | undefined;
 
 function digest(value: string): Buffer {
@@ -323,21 +322,7 @@ export function buildServer(options: ServerOptions): FastifyInstance {
     return reply.code(204).send();
   });
 
-  // Automations (the Dot's cron jobs) and tools (its table): both are the engine's, so they need the computer running
-
-  app.get<{ Params: Params }>(
-    "/api/dots/:id/automations",
-    async (request): Promise<AutomationListAnswer> => ({ automations: await scheduler.listAutomations(request.params.id) }),
-  );
-
-  app.patch<{ Params: Params }>("/api/dots/:id/automations/:automationId", async (request) =>
-    scheduler.setAutomationEnabled(request.params.id, request.params.automationId, bodyOf(request).enabled),
-  );
-
-  app.delete<{ Params: Params }>("/api/dots/:id/automations/:automationId", async (request, reply) => {
-    await scheduler.deleteAutomation(request.params.id, request.params.automationId);
-    return reply.code(204).send();
-  });
+  // The tools (its table) are the engine's, so they need the computer running
 
   app.get<{ Params: Params }>(
     "/api/dots/:id/tools",
```

**File**: `apps/api/test/api.test.ts` (modified, +15/-55)
```diff
@@ -6,7 +6,7 @@ import { createTestDatabase, testAdapters, type TestDatabase } from "@invisible-
 import { Scheduler } from "@invisible-dots/scheduler";
 import { FakeDriver, ManualClock, waitFor, waitUntilSettledReady } from "@invisible-dots/scheduler/testing";
 import { ApiError, InvisibleDotsClient } from "@invisible-dots/sdk";
-import { MAX_EVENT_PAGE, OPENROUTER_KEY_RULE, type Automation, type DoctorCheck, type StoredEvent } from "@invisible-dots/shared";
+import { MAX_EVENT_PAGE, OPENROUTER_KEY_RULE, type DoctorCheck, type StoredEvent } from "@invisible-dots/shared";
 import { afterAll, beforeAll, describe, expect, it } from "vitest";
 import { API_VERSION, buildServer, type FastifyInstance } from "../src/index.js";
 import { hostFacts } from "./host-facts.js";
@@ -185,12 +185,12 @@ describe.each(testAdapters())("control-plane API (%s)", (kind) => {
     const call = { tool: "exec", permission: "exec.run", decision: "allow", ok: true, duration_ms: 5 } as const;
     guest.emit("tool.called", { task_id: one.id, ...call, target: "ls" });
     guest.emit("tool.called", { ...call, target: "date" });
-    guest.emit("memory.written", { key: "fares.md" });
-    await waitFor(async () => (await api.events(dot.id, { types: ["memory.written"] })).length === 1, "events stored");
+    guest.emit("browser.identity.created", { identity_id: "bi_shop", name: "shop" });
+    await waitFor(async () => (await api.events(dot.id, { types: ["browser.identity.created"] })).length === 1, "events stored");
 
     const types = (events: StoredEvent[]) => events.map((e) => e.type);
     expect(types(await api.events(dot.id, { types: ["tool.called"] }))).toEqual(["tool.called", "tool.called"]);
-    expect(types(await api.events(dot.id, { types: ["tool.called", "memory.written"] }))).toEqual(["tool.called", "tool.called", "memory.written"]);
+    expect(types(await api.events(dot.id, { types: ["tool.called", "browser.identity.created"] }))).toEqual(["tool.called", "tool.called", "browser.identity.created"]);
     // A task's events: the host's own and the guest's, in id order; the chat's tool call belongs to no task.
     const ofOne = await api.events(dot.id, { taskId: one.id });
     expect(types(ofOne)).toEqual(expect.arrayContaining(["task.created", "task.started", "task.completed", "tool.called"]));
@@ -210,7 +210,9 @@ describe.each(testAdapters())("control-plane API (%s)", (kind) => {
     };
     expect((await get("types=")).body.events!.length).toBeGreaterThan(5);
     expect(await get("types=tool.called,tool.calls")).toMatchObject({ status: 400, body: { error: "invalid_request", message: "unknown event type: tool.calls" } });
-    expect((await get("types=tool.called&types=memory.written")).status).toBe(400);
+    expect((await get("types=tool.called&types=browser.identity.created")).status).toBe(400);
+    // The Dot keeps its notes itself: a note written is no event, and asking for one is asking for a type nobody emits.
+    expect(await get("types=memory.written")).toMatchObject({ status: 400, body: { message: "unknown event type: memory.written" } });
     expect((await get("task_id=a&task_id=b")).status).toBe(400);
     expect((await get("task_id=")).status).toBe(400);
 
@@ -224,7 +226,7 @@ describe.each(testAdapters())("control-plane API (%s)", (kind) => {
     expect(newest.map((e) => e.data.target)).toEqual(["whoami", "pwd"]);
     const browserCalls = await api.events(dot.id, { types: ["tool.called"], tools: ["browser_navigate", "browser_click"], order: "desc", limit: 1 });
     expect(browserCalls.map((e) => e.data.target)).toEqual(["x-1: https://example.com/"]);
-    expect((await api.events(dot.id, { types: ["tool.called", "memory.written"], tools: ["browser_click"] })).map((e) => e.type)).toEqual(["memory.written"]);
+    expect((await api.events(dot.id, { types: ["tool.called", "browser.identity.created"], tools: ["browser_click"] })).map((e) => e.type)).toEqual(["browser.identity.created"]);
     // `before` goes on, older, from the oldest event of a newest-first page, and only there.
     const calls = await api.events(dot.id, { types: ["tool.called"], order: "desc", limit: 2 });
     expect((await api.events(dot.id, { types: ["tool.called"], order: "desc", limit: 2, before: calls.at(-1)!.id })).map((e) => e.data.target)).toEqual(["x-1: https://example.com/", "date"]);
@@ -337,43 +339,9 @@ describe.each(testAdapters())("control-plane API (%s)", (kind) => {
     await expect(api.readFile("no-such-dot", "a")).rejects.toMatchObject({ status: 404 });
   });
 
-  it("automations: list, pause, resume and remove over HTTP, and a tool table that follows the permissions", async () => {
+  it("a tool table that follows the permissions, and no automations route: the jobs are the Dot's own", async () => {
     const dot = await readyDot("automations");
-    const guest = driver.guestOf(dot.id);
-    const job = (over: Partial<Automation>): Automation => ({
-      id: "job_1",
-      name: "daily fares",
-      enab
```

**File**: `apps/cli/src/cli.ts` (modified, +0/-2)
```diff
@@ -146,8 +146,6 @@ browser:
 permissions:
   computer.exec: allow
   browser.identity.delete: ask
-memory:
-  enabled: true
 limits:
   max_steps_per_task: 60
   context_tokens: 32000
```

**File**: `apps/cli/test/cli.test.ts` (modified, +8/-3)
```diff
@@ -3,6 +3,7 @@ import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
 import type { AddressInfo } from "node:net";
 import { tmpdir } from "node:os";
 import { join } from "node:path";
+import { parseDotConfig } from "@invisible-dots/shared";
 import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
 import { commandOf, EXIT, interruptIsAsked, run, SAMPLE_DOT, type CliIo, type HostCommands } from "../src/index.js";
 
@@ -74,8 +75,8 @@ const channel = {
 const events = Array.from({ length: 5 }, (_, i) => ({
   id: i + 1,
   dot_id: dot.id,
-  type: i % 2 ? "agent.state" : "memory.written",
-  data: i % 2 ? { state: "IDLE", guest_event_id: "x", guest_ts: now } : { key: `k${i}` },
+  type: i % 2 ? "agent.state" : "automation.next_run",
+  data: i % 2 ? { state: "IDLE", guest_event_id: "x", guest_ts: now } : { next_run_at_ms: null },
   source: "guest",
   guest_seq: i + 1,
   created_at: now,
@@ -290,6 +291,10 @@ describe("commands", () => {
     expect((await cli(["init", "sample.yaml", "--force"])).code).toBe(EXIT.ok);
   });
 
+  it("writes a sample the host accepts as it is: every key of it is one the schema knows", () => {
+    expect(parseDotConfig(SAMPLE_DOT).name).toBe("my-first-dot");
+  });
+
   it("create sends the YAML text and prints validation details on 400", async () => {
     await writeFile(join(configDir, "good.yaml"), SAMPLE_DOT);
     const ok = await cli(["create", "good.yaml"]);
@@ -559,7 +564,7 @@ describe("commands", () => {
       signal: controller.signal,
     };
     expect(await run(["logs", "fare-watch", "--tail", "1"], io)).toBe(EXIT.ok);
-    expect(output).toMatch(/#5 memory\.written/);
+    expect(output).toMatch(/#5 automation\.next_run/);
     expect(output).toMatch(/#6 task\.completed/);
     const stream = requests.find((r) => r.path === "/api/stream");
     expect(stream?.query.get("after")).toBe("5");
```

**File**: `apps/scheduler/src/driver.ts` (modified, +0/-5)
```diff
@@ -5,8 +5,6 @@
  */
 import type {
   AgentStateAnswer,
-  Automation,
-  AutomationListAnswer,
   BrowserIdentity,
   BrowserIdentityListAnswer,
   ComputerResources,
@@ -44,9 +42,6 @@ export interface GuestApi {
   getBrowserIdentityFrame(id: string): Promise<Uint8Array>;
   /** End the identity's browser and keep its profile; closing a closed identity is not an error. */
   closeBrowserIdentity(id: string): Promise<void>;
-  listAutomations(): Promise<AutomationListAnswer>;
-  setAutomationEnabled(id: string, enabled: boolean): Promise<Automation>;
-  deleteAutomation(id: string): Promise<void>;
   listTools(): Promise<ToolListAnswer>;
   prepareSleep(timeoutMs?: number): Promise<void>;
   screenshot(): Promise<Uint8Array>;
```

---

### Incident Patch 8: `111b6648` (2026-10-06)
**Commit Message**: image: the seed and the runtime ISO are virtio drives, and the golden is built on Ubuntu's minimal cloud image

Measured: the minimal image's kernel has no SATA CD-ROM driver, so on the q35 machine the builder VM never saw the
seed and cloud-init never ran. A read-only virtio drive is seen by every cloud image (vdb, vdc), and cloud-init and
the runtime's mount find the ISOs by their labels as before. The golden built on it is 1.96 GB instead of 3.0-3.4,
and a Dot from it boots in about 12 s.

**File**: `apps/vm-manager/src/qemu-args.ts` (modified, +8/-5)
```diff
@@ -99,11 +99,14 @@ export function diskDriveArg(path: string): string {
 }
 
 /**
- * The `-drive` value of a read-only CD-ROM (a seed or the runtime ISO).
+ * The `-drive` value of a read-only ISO (a seed or the runtime ISO), as a virtio disk: every Ubuntu cloud kernel has
+ * virtio-blk built in, where a CD-ROM needs the SATA controller's and the CD's modules, which the minimal cloud image
+ * does not load (measured: its builder VM never saw the seed, so cloud-init never ran). The guest finds both by their
+ * labels (cidata, IDOTS-RT), whatever device they are.
  * format=raw: an ISO is raw, and naming it stops QEMU probing the format.
  */
-export function cdromDriveArg(label: string, path: string): string {
-  return `media=cdrom,file=${qemuPathArg(label, path)},format=raw,readonly=on`;
+export function isoDriveArg(label: string, path: string): string {
+  return `if=virtio,file=${qemuPathArg(label, path)},format=raw,readonly=on`;
 }
 
 /**
@@ -142,9 +145,9 @@ export function qemuArgs(spec: QemuArgsSpec): string[] {
     "-drive",
     diskDriveArg(spec.diskPath),
     "-drive",
-    cdromDriveArg("seed ISO", spec.seedPath),
+    isoDriveArg("seed ISO", spec.seedPath),
     "-drive",
-    cdromDriveArg("runtime ISO", spec.runtimeIsoPath),
+    isoDriveArg("runtime ISO", spec.runtimeIsoPath),
     ...deviceArgs(`user,id=net0,hostfwd=tcp:127.0.0.1:${port}-:${GUEST_PORT}`, spec.serialLogPath),
   ];
 }
```

**File**: `apps/vm-manager/test/qemu-args.test.ts` (modified, +2/-2)
```diff
@@ -20,8 +20,8 @@ describe("qemuArgs", () => {
       "-machine", "q35", "-accel", "kvm", "-cpu", "host,-vmx,-svm",
       "-smp", "2", "-m", "4096",
       "-drive", "if=virtio,file=/home/u/.invisible-dots/vms/dot_01k6/disk.qcow2,format=qcow2,discard=unmap",
-      "-drive", "media=cdrom,file=/home/u/.invisible-dots/vms/dot_01k6/seed.iso,format=raw,readonly=on",
-      "-drive", "media=cdrom,file=/home/u/.invisible-dots/images/runtime-7.iso,format=raw,readonly=on",
+      "-drive", "if=virtio,file=/home/u/.invisible-dots/vms/dot_01k6/seed.iso,format=raw,readonly=on",
+      "-drive", "if=virtio,file=/home/u/.invisible-dots/images/runtime-7.iso,format=raw,readonly=on",
       "-netdev", "user,id=net0,hostfwd=tcp:127.0.0.1:40123-:1024",
       "-device", "virtio-net-pci,netdev=net0",
       "-device", "virtio-rng-pci",
```

**File**: `apps/vm-manager/test/vm-manager.test.ts` (modified, +1/-1)
```diff
@@ -170,7 +170,7 @@ describe("start", () => {
     const args = host.spawned[0]!.args;
     expect(argAfter(args, "-smp")).toBe("4");
     expect(argAfter(args, "-m")).toBe("8192");
-    expect(args).toContain(`media=cdrom,file=${runtime2},format=raw,readonly=on`);
+    expect(args).toContain(`if=virtio,file=${runtime2},format=raw,readonly=on`);
   });
 
   it("retries with another port when QEMU cannot bind the forward", async () => {
```

**File**: `docs/architecture.md` (modified, +3/-3)
```diff
@@ -185,7 +185,7 @@ host (`%USERPROFILE%\.invisible-dots` on Windows):
   db/                                   the embedded PostgreSQL (PGlite) data directory
   server.lock                           { pid, host_uptime_s } of the one server running on this home
   images/
-    noble-server-cloudimg-amd64.img     pinned by SHA-256 (virtualization/images/base.json)
+    noble-minimal-cloudimg-amd64.img     pinned by SHA-256 (virtualization/images/base.json)
     golden-<version>.qcow2              immutable, read-only
     golden-<version>.json               its manifest: inputs, versions, SHA-256
     runtime-<version>.iso               our code: agent bundle + dot-agentd + units
@@ -312,8 +312,8 @@ qemu-system-x86_64
   -machine q35 -accel <kvm|whpx> -cpu host,-vmx,-svm
   -smp <cpu> -m <memory MiB>
   -drive if=virtio,file=<vms/id/disk.qcow2>,format=qcow2,discard=unmap
-  -drive media=cdrom,file=<vms/id/seed.iso>,readonly=on
-  -drive media=cdrom,file=<images/runtime-<v>.iso>,readonly=on
+  -drive if=virtio,file=<vms/id/seed.iso>,format=raw,readonly=on
+  -drive if=virtio,file=<images/runtime-<v>.iso>,format=raw,readonly=on
   -netdev user,id=net0,hostfwd=tcp:127.0.0.1:<guest_port>-:1024
   -device virtio-net-pci,netdev=net0
   -device virtio-rng-pci
```

**File**: `guest/image-builder/src/qemu.ts` (modified, +2/-2)
```diff
@@ -6,7 +6,7 @@
  * later boots it on; it leaves out what a builder has no use for (the port
  * forward, the runtime ISO) and adds only what is its own (below).
  */
-import { cdromDriveArg, deviceArgs, diskDriveArg, machineArgs, type Accelerator } from "@invisible-dots/vm-manager";
+import { deviceArgs, diskDriveArg, isoDriveArg, machineArgs, type Accelerator } from "@invisible-dots/vm-manager";
 
 export type { Accelerator };
 
@@ -37,7 +37,7 @@ export function builderQemuArgs(spec: BuilderVmSpec): string[] {
     "-drive",
     diskDriveArg(spec.disk),
     "-drive",
-    cdromDriveArg("seed ISO", spec.seed),
+    isoDriveArg("seed ISO", spec.seed),
     // No forward: nothing on the host talks to the builder. The serial
     // console is the only channel back from the provisioner: its progress
     // lines and the final result marker are read from that file.
```

**File**: `guest/image-builder/test/golden.test.ts` (modified, +5/-4)
```diff
@@ -46,14 +46,14 @@ beforeEach(async () => {
   home = mkdtempSync(join(tmpdir(), "idots-golden-"));
   paths = hostPaths({ INVISIBLE_DOTS_HOME: home });
   base = {
-    name: "ubuntu-24.04-server-cloudimg-amd64",
+    name: "ubuntu-24.04-minimal-cloudimg-amd64",
     release: "24.04",
     serial: "20260926",
     url: http.url("/noble/base.img"),
     sha256sums_url: http.url("/noble/SHA256SUMS"),
     sha256sums_entry: "base.img",
     sha256: sha256(BASE),
-    local_name: "noble-server-cloudimg-amd64.img",
+    local_name: "noble-minimal-cloudimg-amd64.img",
   };
   pins = {
     uv: { version: "0.12.22", url: http.url(`/uv/${UV_FILE}`), shasums_url: http.url(`/uv/${UV_FILE}.sha256`), shasums_entry: UV_FILE, sha256: sha256(UV) },
@@ -93,7 +93,8 @@ describe("buildGoldenImage", () => {
     const { runner, opts } = options({ console: OK_CONSOLE, exit: 0 });
     let seedSize = 0;
     runner.onSpawn = async (args) => {
-      const seed = args.find((arg) => arg.startsWith("media=cdrom,file="))!.replace(/^media=cdrom,file=/, "").replace(/,format=raw,readonly=on$/, "");
+      // The seed is the builder's one read-only ISO drive; the system disk is a virtio drive too, but qcow2.
+      const seed = args.find((arg) => arg.startsWith("if=virtio,file=") && arg.endsWith(",format=raw,readonly=on"))!.replace(/^if=virtio,file=/, "").replace(/,format=raw,readonly=on$/, "");
       seedSize = (await stat(seed)).size;
     };
     const result = await buildGoldenImage(opts);
@@ -145,7 +146,7 @@ describe("buildGoldenImage", () => {
     // The guest's progress reached the person; the work directory and the lock are gone.
     expect(logs).toEqual(expect.arrayContaining(["guest: installing packages: xvfb", "guest: installing uv 0.12.22"]));
     expect((await readdir(paths.imagesDir)).sort()).toEqual(
-      [".cache", "noble-server-cloudimg-amd64.img", `golden-${result.version}.json`, `golden-${result.version}.qcow2`].sort(),
+      [".cache", "noble-minimal-cloudimg-amd64.img", `golden-${result.version}.json`, `golden-${result.version}.qcow2`].sort(),
     );
     expect((await readdir(join(paths.imagesDir, ".cache"))).sort()).toEqual([TUNNEL_FILE, UV_FILE].sort());
   });
```

**File**: `guest/image-builder/test/pins.test.ts` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ describe("the pins in this checkout", () => {
     expect(BASE_IMAGE.sha256sums_url).toContain(`/release-${BASE_IMAGE.serial}/SHA256SUMS`);
     expect(BASE_IMAGE.url.endsWith(`/${BASE_IMAGE.sha256sums_entry}`)).toBe(true);
     // The name architecture section 3.2 gives the downloaded image.
-    expect(BASE_IMAGE.local_name).toBe("noble-server-cloudimg-amd64.img");
+    expect(BASE_IMAGE.local_name).toBe("noble-minimal-cloudimg-amd64.img");
   });
 
   it("pin uv and the browser layer exactly, and no Node: nothing in the guest runs it", () => {
```

**File**: `guest/image-builder/test/qemu.test.ts` (modified, +3/-3)
```diff
@@ -32,7 +32,7 @@ describe("builderQemuArgs", () => {
     expect(values(args, "-m")).toEqual(["4096"]);
     expect(values(args, "-drive")).toEqual([
       `if=virtio,file=${spec.disk},format=qcow2,discard=unmap`,
-      `media=cdrom,file=${spec.seed},format=raw,readonly=on`,
+      `if=virtio,file=${spec.seed},format=raw,readonly=on`,
     ]);
     expect(values(args, "-netdev")).toEqual(["user,id=net0"]);
     expect(values(args, "-device")).toEqual(["virtio-net-pci,netdev=net0", "virtio-rng-pci"]);
@@ -61,7 +61,7 @@ describe("builderQemuArgs", () => {
       serialLogPath: spec.serialLog,
     });
     // The Dot's argv after its name, without the runtime ISO drive, and with the forward taken off the netdev.
-    const runtime = dot.indexOf("media=cdrom,file=/images/runtime-1.iso,format=raw,readonly=on");
+    const runtime = dot.indexOf("if=virtio,file=/images/runtime-1.iso,format=raw,readonly=on");
     const rest = [...dot.slice(2, runtime - 1), ...dot.slice(runtime + 1)].map((arg) => (arg.startsWith("user,id=net0,hostfwd") ? "user,id=net0" : arg));
     expect(builder).toEqual(["-name", "invisible-dots-image-builder", ...rest, "-monitor", "none", "-no-reboot"]);
   });
@@ -77,7 +77,7 @@ describe("builderQemuArgs", () => {
   it("passes Windows paths with spaces through unchanged", () => {
     const args = builderQemuArgs({ ...spec, accelerator: "whpx", disk: "C:\\Users\\A B\\disk.qcow2", seed: "C:\\Users\\A B\\seed.iso", serialLog: "C:\\Users\\A B\\serial.log" });
     expect(values(args, "-drive")[0]).toBe("if=virtio,file=C:\\Users\\A B\\disk.qcow2,format=qcow2,discard=unmap");
-    expect(values(args, "-drive")[1]).toBe("media=cdrom,file=C:\\Users\\A B\\seed.iso,format=raw,readonly=on");
+    expect(values(args, "-drive")[1]).toBe("if=virtio,file=C:\\Users\\A B\\seed.iso,format=raw,readonly=on");
     expect(values(args, "-serial")).toEqual(["file:C:\\Users\\A B\\serial.log"]);
   });
 
```

---

### Incident Patch 9: `0c967dcf` (2026-10-06)
**Commit Message**: image test: the golden build tests build, without looking for a published image

**File**: `guest/image-builder/test/golden.test.ts` (modified, +2/-0)
```diff
@@ -86,6 +86,8 @@ function options(script: VmScript, extra: Partial<GoldenBuildOptions> = {}) {
     log: (line) => logs.push(line),
     now: () => new Date("2026-10-02T12:34:56Z"),
     serialPollMs: 5,
+    // A prebuilt image is looked for in the release of these inputs on GitHub; these tests build.
+    prebuilt: false,
     ...extra,
   };
   return { runner, opts };
```

---

### Incident Patch 10: `51385e45` (2026-10-06)
**Commit Message**: image: the golden image is built once by CI and downloaded, built here only when none is published for these inputs

CI (golden-image.yml) builds it compressed and publishes the release
golden-<inputs digest> with its manifest, the image in parts under 2 GiB and
release.json. image build looks for the release of the checkout's own digest,
checks each part and the whole image against their SHA-256, and builds the
image itself when there is none (--no-download always builds).

**File**: `.github/scripts/golden-release.mjs` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+#!/usr/bin/env node
+// Puts the golden image `image build --compress` made into the shape of a release (guest/image-builder/src/prebuilt.ts):
+// its manifest, the image cut in parts under the 2 GiB a release asset may hold, and release.json naming each part with
+// its size and SHA-256. Prints the tag, golden-<inputs digest>.
+//
+//   node .github/scripts/golden-release.mjs <images directory> <output directory>
+import { createHash } from "node:crypto";
+import { createReadStream } from "node:fs";
+import { copyFile, mkdir, open, readdir, readFile, writeFile } from "node:fs/promises";
+import { basename, join } from "node:path";
+
+const PART_BYTES = 1900 * 1024 * 1024;
+
+const [imagesDir, outDir] = process.argv.slice(2);
+if (!imagesDir || !outDir) {
+  console.error("usage: golden-release.mjs <images directory> <output directory>");
+  process.exit(2);
+}
+
+const manifests = (await readdir(imagesDir)).filter((name) => /^golden-.+\.json$/.test(name));
+if (manifests.length !== 1) {
+  console.error(`expected one golden manifest in ${imagesDir}, found ${manifests.length}`);
+  process.exit(1);
+}
+const manifestName = manifests[0];
+const manifest = JSON.parse(await readFile(join(imagesDir, manifestName), "utf8"));
+const image = join(imagesDir, manifest.file);
+await mkdir(outDir, { recursive: true });
+await copyFile(join(imagesDir, manifestName), join(outDir, manifestName));
+
+const parts = [];
+let out;
+let hash;
+let written = 0;
+const whole = createHash("sha256");
+async function closePart() {
+  if (!out) return;
+  await out.close();
+  parts[parts.length - 1].size = written;
+  parts[parts.length - 1].sha256 = hash.digest("hex");
+  out = undefined;
+}
+for await (let chunk of createReadStream(image, { highWaterMark: 8 * 1024 * 1024 })) {
+  whole.update(chunk);
+  while (chunk.length > 0) {
+    if (!out) {
+      const name = `${basename(manifest.file)}.part${String(parts.length).padStart(2, "0")}`;
+      parts.push({ name, size: 0, sha256: "" });
+      out = await open(join(outDir, name), "w");
+      hash = createHash("sha256");
+      written = 0;
+    }
+    const take = chunk.subarray(0, PART_BYTES - written);
+    await out.write(take);
+    hash.update(take);
+    written += take.length;
+    chunk = chunk.subarray(take.length);
+    if (written === PART_BYTES) await closePart();
+  }
+}
+await closePart();
+
+const sha256 = whole.digest("hex");
+if (sha256 !== manifest.sha256) {
+  console.error(`${image} hashes to ${sha256}, its manifest says ${manifest.sha256}`);
+  process.exit(1);
+}
+await writeFile(join(outDir, "release.json"), `${JSON.stringify({ inputs_digest: manifest.inputs_digest, manifest: manifestName, parts }, null, 2)}\n`);
+console.log(`golden-${manifest.inputs_digest}`);
```

**File**: `.github/workflows/golden-image.yml` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+name: golden image
+
+# Builds the golden image once, here, and publishes it as the release golden-<inputs digest>, which
+# `invisible-dots image build` downloads instead of building (guest/image-builder/src/prebuilt.ts). The digest is the
+# one every host computes from the pinned inputs, so a host only ever takes the image of its own inputs. A digest that
+# already has its release is not built again.
+on:
+  push:
+    branches: [main]
+    paths:
+      - guest/image-builder/**
+      - virtualization/images/**
+  workflow_dispatch:
+
+permissions:
+  contents: write
+
+concurrency:
+  group: golden-image
+  cancel-in-progress: false
+
+defaults:
+  run:
+    shell: bash
+
+jobs:
+  build:
+    name: build and publish the golden image
+    runs-on: ubuntu-latest
+    timeout-minutes: 180
+    env:
+      INVISIBLE_DOTS_HOME: ${{ github.workspace }}/../idots-home
+      GH_TOKEN: ${{ github.token }}
+    steps:
+      - uses: actions/checkout@v4
+      - uses: actions/setup-node@v4
+        with:
+          node-version: "24"
+          cache: npm
+      - uses: actions/setup-go@v5
+        with:
+          go-version-file: guest/dot-agentd/go.mod
+      - name: KVM for the builder VM, and QEMU
+        run: |
+          echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' | sudo tee /etc/udev/rules.d/99-kvm4all.rules
+          sudo udevadm control --reload-rules
+          sudo udevadm trigger --name-match=kvm
+          sudo apt-get update -qq
+          sudo apt-get install -y -qq --no-install-recommends qemu-system-x86 qemu-utils
+      - run: npm ci --no-audit --no-fund
+      - run: npm run build --workspace @invisible-dots/cli
+      # The runtime ISO, which `image build` makes first, carries dot-agentd.
+      - run: CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go -C guest/dot-agentd build -trimpath -o bin/dot-agentd ./cmd/dot-agentd
+      - name: the image (downloaded instead when its release exists already)
+        id: build
+        run: |
+          node apps/cli/dist/invisible-dots.mjs image build --compress | tee build.log
+          tag=$(node .github/scripts/golden-release.mjs "$INVISIBLE_DOTS_HOME/images" "$RUNNER_TEMP/release")
+          echo "tag=$tag" >> "$GITHUB_OUTPUT"
+      - name: publish
+        run: |
+          tag='${{ steps.build.outputs.tag }}'
+          if gh release view "$tag" >/dev/null 2>&1; then
+            echo "$tag is published already"
+            exit 0
+          fi
+          gh release create "$tag" "$RUNNER_TEMP"/release/* \
+            --title "Golden image $tag" \
+            --notes "The golden image of the inputs ${tag#golden-}, built by the golden image workflow from ${GITHUB_SHA}. invisible-dots image build downloads it when a checkout's inputs have this digest. It holds Ubuntu 24.04 and the software guest/image-builder/pins.json and the locks name, each under its own license (THIRD_PARTY_NOTICES.md)."
```

**File**: `README.md` (modified, +9/-6)
```diff
@@ -58,8 +58,10 @@ What sets it apart:
   was accepted, and a tool call cut short is never run twice: the model is told
   its outcome is unknown and checks before trying again.
 
-No image, package or hosted service is published: you build everything on your
-own machine from this repository.
+No package or hosted service is published. The one thing published is the
+golden image, built by CI from this repository's pinned inputs and downloaded
+by `image build` when its inputs are yours; everything else you build on your
+own machine.
 
 > [!IMPORTANT]
 > invisible_dots is alpha and has not yet run end to end on real hardware: the
@@ -141,7 +143,7 @@ you can still run any of them alone:
 | 1. The guest daemon | Builds `dot-agentd`, the program that runs inside every Dot's VM, for Linux whatever your host is. It stops here, before changing anything, when Go is missing, and prints the command that installs it. | `go -C guest/dot-agentd build -trimpath -o bin/dot-agentd ./cmd/dot-agentd` with `CGO_ENABLED=0 GOOS=linux GOARCH=amd64` |
 | 2. QEMU and its accelerator | Checks the host and fixes only what is missing. On **Windows** it enables the Windows Hypervisor Platform and installs QEMU in one elevated step (one UAC prompt). On **Linux** it installs QEMU with `sudo apt-get` (sudo asks for your password). | `invisible-dots setup` |
 | 3. The web client | Builds it, with Next.js's anonymous telemetry turned off, unless it is built already. | `npm run build --workspace @invisible-dots/web` |
-| 4. The guest images | Builds the golden image (Ubuntu 24.04, the desktop, the browser) and the runtime disk (the daemon and the engine). It is the longest step, and a second run with unchanged inputs does nothing. | `invisible-dots image build` |
+| 4. The guest images | Builds the runtime disk (the daemon and the engine), and downloads the golden image (Ubuntu 24.04, the desktop, the browser) that CI built for exactly these inputs, or builds it here when none is published (a changed pin, a fork, no network). A second run with unchanged inputs does nothing. | `invisible-dots image build` (`--no-download` always builds) |
 
 Two things can stop it on purpose, and both end with the same advice: run the
 same command again and it carries on.
@@ -803,7 +805,7 @@ smokes fail on a skipped check, so a test that stops running fails the build.
 
 ## Status and what is not done yet
 
-Alpha. Nothing is released or published yet.
+Alpha. Nothing is released yet; the golden image is the one thing published.
 
 - **The real-VM acceptance run has not been run yet.** It exists
   (`tests/e2e/run.ts`: build, create, browse, approve, kill the VM, restart,
@@ -839,8 +841,9 @@ parts of this repository's history come from Open Multi-Agent, also MIT. Their
 notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). QEMU (GPL-2.0)
 is installed from its official installer or your distribution and only run as
 a separate program, never bundled. The guest operating system, the browser
-engine and the packages a host downloads keep their own licenses; whoever
-copies a golden image to another machine takes on those licenses
+engine and the packages in the golden image keep their own licenses; the
+published golden image is Ubuntu with those packages, and whoever copies it
+takes on those licenses
 ([architecture: licensing](docs/architecture.md#113-licensing)). Nothing under
 the GPL is installed by the default `npm install`; the WhatsApp client, which
 brings a GPL-3.0 dependency, is an opt-in install. The Dot's computer is
```

**File**: `apps/cli/src/cli.ts` (modified, +14/-3)
```diff
@@ -29,12 +29,18 @@ export const CLI_VERSION = "0.1.0";
  * discovery, the image builder and the whole control plane, so they are
  * imported only when one of them runs; tests pass fakes.
  */
+/** `image build`: whether the golden image may be downloaded instead of built, and whether it is written compressed. */
+export interface ImageBuildOptions {
+  download: boolean;
+  compress: boolean;
+}
+
 export interface HostCommands {
   doctor(options: { json: boolean }, io: CliIo): Promise<number>;
   setup(io: CliIo): Promise<number>;
   /** `setup --all`: setup, the builds and `image build` in one run that can be run again (setup/all.ts). */
   setupAll(io: CliIo): Promise<number>;
-  imageBuild(io: CliIo): Promise<number>;
+  imageBuild(io: CliIo, options?: ImageBuildOptions): Promise<number>;
   server(io: CliIo, options: { web: boolean }): Promise<number>;
 }
 
@@ -68,7 +74,10 @@ Getting this host ready (the same commands on Linux and Windows):
                                                 run it again after a restart or a failure and it carries on
   invisible-dots setup                          just QEMU and its accelerator (may ask for administrator rights once)
   invisible-dots doctor [--json]                check everything; one line per check and the command that fixes a failure
-  invisible-dots image build                    build the golden image and the runtime ISO
+  invisible-dots image build [--no-download] [--compress]
+                                                the runtime ISO, and the golden image: downloaded when one is published for
+                                                these inputs, built here otherwise (--no-download: always build; --compress:
+                                                a compressed qcow2, as the published one is)
   invisible-dots server [--no-web]              run the control plane and the web client in the foreground (--no-web: the control plane only)
 
 Using the server:
@@ -156,6 +165,8 @@ const OPTIONS = {
   tail: { type: "string" },
   "no-follow": { type: "boolean" },
   "no-web": { type: "boolean" },
+  "no-download": { type: "boolean" },
+  compress: { type: "boolean" },
   all: { type: "boolean" },
   clear: { type: "boolean" },
   help: { type: "boolean", short: "h" },
@@ -312,7 +323,7 @@ export async function run(argv: string[], io: CliIo): Promise<number> {
         const what = need(args, 0, "build");
         if (what !== "build") throw new UsageError(`unknown image subcommand "${what}": use build`);
         noArguments(args.slice(1), "image build");
-        return await (await host()).imageBuild(io);
+        return await (await host()).imageBuild(io, { download: values["no-download"] !== true, compress: values.compress === true });
       }
       case "server":
         noArguments(args, "server");
```

**File**: `apps/cli/src/host.ts` (modified, +5/-3)
```diff
@@ -40,7 +40,7 @@ import {
 } from "@invisible-dots/vm-manager";
 import windowsQemuPinJson from "../../../virtualization/qemu/windows.json" with { type: "json" };
 import { connectApi } from "./api-client.js";
-import type { CliIo, HostCommands } from "./cli.js";
+import type { CliIo, HostCommands, ImageBuildOptions } from "./cli.js";
 import { doctorCommand } from "./doctor/command.js";
 import { EXIT } from "./exit.js";
 import { runSetupAll } from "./setup/all.js";
@@ -137,7 +137,7 @@ const IMAGE_BUILDER_DIR = join(REPO_ROOT, "guest", "image-builder");
  * bundle or dot-agentd has not been built, before an hour of golden image
  * provisioning.
  */
-async function imageBuild(io: CliIo): Promise<number> {
+async function imageBuild(io: CliIo, options: ImageBuildOptions = { download: true, compress: false }): Promise<number> {
   const log = (line: string) => io.stdout(`${line}\n`);
   const paths = hostPaths(io.env);
   const runtime = await buildRuntimeIso({ paths, log, assetRoot: IMAGE_BUILDER_DIR, inputs: defaultRuntimeInputs(REPO_ROOT) });
@@ -150,10 +150,12 @@ async function imageBuild(io: CliIo): Promise<number> {
     paths,
     assetRoot: IMAGE_BUILDER_DIR,
     log,
+    ...(options.download ? {} : { prebuilt: false as const }),
+    ...(options.compress ? { compress: true } : {}),
     ...(io.fetch ? { fetch: io.fetch } : {}),
     ...(io.signal ? { signal: io.signal } : {}),
   });
-  log(`${golden.created ? "built" : "already built"}: ${golden.image}`);
+  log(`${golden.created ? "ready" : "already there"}: ${golden.image}`);
   return EXIT.ok;
 }
 
```

**File**: `apps/cli/src/setup/all.ts` (modified, +1/-1)
```diff
@@ -75,7 +75,7 @@ export async function runSetupAll(deps: SetupAllDeps): Promise<number> {
   for (const line of web.lines) out(`  ${line}\n`);
   if (interrupted()) return stopped(["interrupted"]);
 
-  heading(4, "the guest images (what `invisible-dots image build` does; the longest step)");
+  heading(4, "the guest images (what `invisible-dots image build` does: the golden image is downloaded when one is published for these inputs)");
   try {
     const code = await deps.images();
     if (code !== EXIT.ok) return stopped([`image build ended with exit code ${code}`]);
```

**File**: `docs/architecture.md` (modified, +8/-4)
```diff
@@ -2751,10 +2751,14 @@ shipped by this project. The guest operating system (the Ubuntu cloud image),
 Node, `uv`, the browser engine, `invisible-playwright-mcp` with its Python
 packages, and the Python packages the engine's lock
 (`guest/image-builder/builder/engine-requirements.lock`) names are
-downloaded from their publishers when a host builds its golden image, each
-under its own license, as the wheels the publishers released. This project publishes no image (section
-3.3); whoever copies a golden image to another machine takes on the license
-terms of the components inside it.
+downloaded from their publishers when the golden image is built, each under
+its own license, as the wheels the publishers released. The golden image is
+published as built by CI (the release `golden-<inputs digest>`, made by
+`.github/workflows/golden-image.yml`; `image build` downloads it when its
+inputs are the checkout's, `guest/image-builder/src/prebuilt.ts`, and builds the
+image itself otherwise); the sources of its Ubuntu packages are in Ubuntu's
+archive, and whoever copies it takes on the license terms of the components
+inside it.
 
 The default `npm install` holds nothing under the GPL (section 9.8, WhatsApp); that is a
 statement about the npm lock file and no more. The few LGPL packages of the lock file
```

**File**: `guest/image-builder/src/download.ts` (modified, +5/-0)
```diff
@@ -171,6 +171,11 @@ function asRetryable(url: string, error: unknown, signal: AbortSignal): Error {
   return new RetryableError(`${url}: ${(error as Error).message ?? String(error)}`, { cause: error });
 }
 
+/** A small text file, with the same retries as a download; an HTTP error answer is a DownloadError with its status. */
+export function fetchTextWithRetries(url: string, options: FetchVerifiedOptions = {}): Promise<string> {
+  return withRetries(options, () => fetchText(url, options));
+}
+
 async function fetchText(url: string, options: FetchVerifiedOptions): Promise<string> {
   const { response, done } = await openResponse(url, options);
   try {
```

---

### Incident Patch 11: `17030cc5` (2026-10-06)
**Commit Message**: image: the golden image starts from Ubuntu's minimal cloud image, and dpkg skips its fsyncs in the builder VM

The minimal image has the same generic kernel and cloud-init as the server one
at about 250 MB instead of 600; the few tools a model's commands use that only
the server image had (jq, file, less, nano, rsync, zstd, lsof, ping) are now
apt packages of pins.json.

**File**: `docs/architecture.md` (modified, +1/-1)
```diff
@@ -185,7 +185,7 @@ host (`%USERPROFILE%\.invisible-dots` on Windows):
   db/                                   the embedded PostgreSQL (PGlite) data directory
   server.lock                           { pid, host_uptime_s } of the one server running on this home
   images/
-    noble-server-cloudimg-amd64.img     pinned by SHA-256 (virtualization/images/base.json)
+    noble-minimal-cloudimg-amd64.img     pinned by SHA-256 (virtualization/images/base.json)
     golden-<version>.qcow2              immutable, read-only
     golden-<version>.json               its manifest: inputs, versions, SHA-256
     runtime-<version>.iso               our code: agent bundle + dot-agentd + units
```

**File**: `guest/image-builder/builder/provision.sh` (modified, +2/-1)
```diff
@@ -35,7 +35,8 @@ step "installing packages: $APT_PACKAGES"
 apt_wait=(-o DPkg::Lock::Timeout=600)
 apt-get "${apt_wait[@]}" update
 # shellcheck disable=SC2086
-apt-get "${apt_wait[@]}" install -y --no-install-recommends $APT_PACKAGES
+# unsafe-io: no fsync per package, the builder VM is thrown away if the build fails anyway.
+apt-get "${apt_wait[@]}" -o Dpkg::Options::=--force-unsafe-io install -y --no-install-recommends $APT_PACKAGES
 
 step "installing Node $NODE_VERSION"
 node_root=/usr/local/lib/nodejs
```

**File**: `guest/image-builder/pins.json` (modified, +9/-1)
```diff
@@ -35,6 +35,14 @@
     "curl",
     "git",
     "xz-utils",
-    "nftables"
+    "nftables",
+    "jq",
+    "file",
+    "less",
+    "nano",
+    "rsync",
+    "zstd",
+    "lsof",
+    "iputils-ping"
   ]
 }
```

**File**: `guest/image-builder/test/golden.test.ts` (modified, +3/-3)
```diff
@@ -50,14 +50,14 @@ beforeEach(async () => {
   home = mkdtempSync(join(tmpdir(), "idots-golden-"));
   paths = hostPaths({ INVISIBLE_DOTS_HOME: home });
   base = {
-    name: "ubuntu-24.04-server-cloudimg-amd64",
+    name: "ubuntu-24.04-minimal-cloudimg-amd64",
     release: "24.04",
     serial: "20260926",
     url: http.url("/noble/base.img"),
     sha256sums_url: http.url("/noble/SHA256SUMS"),
     sha256sums_entry: "base.img",
     sha256: sha256(BASE),
-    local_name: "noble-server-cloudimg-amd64.img",
+    local_name: "noble-minimal-cloudimg-amd64.img",
   };
   pins = {
     node: { version: "24.21.0", url: http.url(`/node/${NODE_FILE}`), shasums_url: http.url("/node/SHASUMS256.txt"), shasums_entry: NODE_FILE, sha256: sha256(NODE) },
@@ -149,7 +149,7 @@ describe("buildGoldenImage", () => {
     // The guest's progress reached the person; the work directory and the lock are gone.
     expect(logs).toEqual(expect.arrayContaining(["guest: installing packages: xvfb", "guest: installing Node 24.21.0"]));
     expect((await readdir(paths.imagesDir)).sort()).toEqual(
-      [".cache", "noble-server-cloudimg-amd64.img", `golden-${result.version}.json`, `golden-${result.version}.qcow2`].sort(),
+      [".cache", "noble-minimal-cloudimg-amd64.img", `golden-${result.version}.json`, `golden-${result.version}.qcow2`].sort(),
     );
     expect((await readdir(join(paths.imagesDir, ".cache"))).sort()).toEqual([NODE_FILE, TUNNEL_FILE, UV_FILE].sort());
   });
```

**File**: `guest/image-builder/test/pins.test.ts` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ describe("the pins in this checkout", () => {
     expect(BASE_IMAGE.sha256sums_url).toContain(`/release-${BASE_IMAGE.serial}/SHA256SUMS`);
     expect(BASE_IMAGE.url.endsWith(`/${BASE_IMAGE.sha256sums_entry}`)).toBe(true);
     // The name architecture section 3.2 gives the downloaded image.
-    expect(BASE_IMAGE.local_name).toBe("noble-server-cloudimg-amd64.img");
+    expect(BASE_IMAGE.local_name).toBe("noble-minimal-cloudimg-amd64.img");
   });
 
   it("pin Node 24, uv and the browser layer exactly", () => {
```

**File**: `packages/shared/test/paths.test.ts` (modified, +2/-2)
```diff
@@ -19,7 +19,7 @@ describe("hostPaths", () => {
     expect(paths.dbDir).toBe(join(home, "db"));
     expect(paths.serverLockPath).toBe(join(home, "server.lock"));
     expect(paths.imagesDir).toBe(join(home, "images"));
-    expect(paths.baseImagePath("noble-server-cloudimg-amd64.img")).toBe(join(home, "images", "noble-server-cloudimg-amd64.img"));
+    expect(paths.baseImagePath("noble-minimal-cloudimg-amd64.img")).toBe(join(home, "images", "noble-minimal-cloudimg-amd64.img"));
     expect(paths.goldenImagePath("3")).toBe(join(home, "images", "golden-3.qcow2"));
     expect(paths.runtimeIsoPath("0.1.0")).toBe(join(home, "images", "runtime-0.1.0.iso"));
     expect(paths.vmsDir).toBe(join(home, "vms"));
@@ -71,7 +71,7 @@ describe("image file names", () => {
   });
 
   it("ignore every other file of the images directory", () => {
-    for (const name of ["golden-1.json", "runtime-1.json", "golden-.qcow2", ".golden-1.work", "noble-server-cloudimg-amd64.img", "runtime-1.iso.tmp"]) {
+    for (const name of ["golden-1.json", "runtime-1.json", "golden-.qcow2", ".golden-1.work", "noble-minimal-cloudimg-amd64.img", "runtime-1.iso.tmp"]) {
       expect(imageVersionOf("golden", name)).toBeUndefined();
       expect(imageVersionOf("runtime", name)).toBeUndefined();
     }
```

**File**: `virtualization/images/base.json` (modified, +8/-8)
```diff
@@ -1,17 +1,17 @@
 {
-  "name": "ubuntu-24.04-server-cloudimg-amd64",
+  "name": "ubuntu-24.04-minimal-cloudimg-amd64",
   "distribution": "ubuntu",
   "release": "24.04",
   "codename": "noble",
   "arch": "amd64",
-  "serial": "20260926",
-  "url": "https://cloud-images.ubuntu.com/releases/noble/release-20260926/ubuntu-24.04-server-cloudimg-amd64.img",
-  "sha256sums_url": "https://cloud-images.ubuntu.com/releases/noble/release-20260926/SHA256SUMS",
-  "sha256sums_entry": "ubuntu-24.04-server-cloudimg-amd64.img",
-  "sha256": "6a81c37564db9b1ee84e141922625e1d7c5b389b99bb3c572e0243607d5bb4d2",
-  "local_name": "noble-server-cloudimg-amd64.img",
+  "serial": "20261001",
+  "url": "https://cloud-images.ubuntu.com/minimal/releases/noble/release-20261001/ubuntu-24.04-minimal-cloudimg-amd64.img",
+  "sha256sums_url": "https://cloud-images.ubuntu.com/minimal/releases/noble/release-20261001/SHA256SUMS",
+  "sha256sums_entry": "ubuntu-24.04-minimal-cloudimg-amd64.img",
+  "sha256": "a8eb6570f87a941f3de2e000c046b9367f8ab1423756a94830d454fae8ad80ff",
+  "local_name": "noble-minimal-cloudimg-amd64.img",
   "verification": [
-    "The release directory is dated, so the URL keeps naming the same bytes; the daily tree under /noble/<serial>/ is pruned after a few months.",
+    "The release directory is dated, so the URL keeps naming the same bytes; the daily tree under /noble/<serial>/ is pruned after a few months. It is the minimal cloud image: the same generic kernel and cloud-init as the server image, about 250 MB instead of 600, and none of the server tools a Dot does not use (pins.json adds the few a model's commands do).",
     "invisible-dots image build (guest/image-builder/src/golden.ts) downloads SHA256SUMS from sha256sums_url and refuses to continue unless its line for sha256sums_entry equals sha256 above, before it downloads the image.",
     "The downloaded image must hash to sha256 above (Node crypto, the same on every host); a cached copy is re-hashed before every build.",
     "The pin in this file is the trust anchor. The Ubuntu signature on SHA256SUMS (SHA256SUMS.gpg in the same directory) is not checked at build time, because no host is required to have gpgv; check it once when moving the pin: gpgv --keyring /usr/share/keyrings/ubuntu-cloudimage-keyring.gpg SHA256SUMS.gpg SHA256SUMS.",
```

---

### Incident Patch 12: `1cb4a219` (2026-10-06)
**Commit Message**: tests: floors set to what the suites measure after the cuts

Lowered on purpose: the tests of the removed layers went with them (GeoIP pin,
command masking, proxy scrub and stderr filter, engine start-up guards) and the
web sessions/CSP revert took two browser tests. Measured: vitest 2227 on
Windows (2224 on Linux, three PowerShell tests skip there), pytest 2299,
postgres 701, playwright 99.

**File**: `.github/test-floors.json` (modified, +7/-7)
```diff
@@ -1,11 +1,11 @@
 {
-  "//": "What each suite must reach on each host, read by .github/scripts/test-guard.mjs in CI (tests.yml) and in the pre-push hook. Raise a floor when tests are added; lowering one is a decision to write down in the commit that does it. Linux skips only the tests that drive a real Windows PowerShell; a Windows host compiles dot-agentd's unix-only test files out and skips the two Go tests that need a Linux guest. The playwright floor is the web client's browser tests (the web job of tests.yml; the same hundred and one run on a Windows host, which is where they are developed). The pytest floor is the Python engine's (invisible_engine_dots, the engine job of tests.yml, Linux only, nothing may skip). The whatsapp floor is the suite that needs the real WhatsApp client, an opt-in install (npm run test:whatsapp, the whatsapp-client job of tests.yml, which installs the client and runs it with PostgreSQL, so the pg runs of the auth state count); a host without PostgreSQL reaches the win32 number.",
+  "//": "What each suite must reach on each host, read by .github/scripts/test-guard.mjs in CI (tests.yml) and in the pre-push hook. Raise a floor when tests are added; lowering one is a decision to write down in the commit that does it. Linux skips only the tests that drive a real Windows PowerShell; a Windows host compiles dot-agentd's unix-only test files out and skips the two Go tests that need a Linux guest. The playwright floor is the web client's browser tests (the web job of tests.yml; the same ninety-nine run on a Windows host, which is where they are developed). The pytest floor is the Python engine's (invisible_engine_dots, the engine job of tests.yml, Linux only, nothing may skip). The whatsapp floor is the suite that needs the real WhatsApp client, an opt-in install (npm run test:whatsapp, the whatsapp-client job of tests.yml, which installs the client and runs it with PostgreSQL, so the pg runs of the auth state count); a host without PostgreSQL reaches the win32 number.",
   "vitest": {
-    "linux": { "min_passed": 2269, "allow_skipped": "^generated PowerShell on a real Windows PowerShell " },
-    "win32": { "min_passed": 2272, "allow_skipped": "" }
+    "linux": { "min_passed": 2224, "allow_skipped": "^generated PowerShell on a real Windows PowerShell " },
+    "win32": { "min_passed": 2227, "allow_skipped": "" }
   },
   "postgres": {
-    "linux": { "min_passed": 697, "allow_skipped": "", "require": { "\\bpg\\b": 272 } }
+    "linux": { "min_passed": 701, "allow_skipped": "", "require": { "\\bpg\\b": 272 } }
   },
   "whatsapp": {
     "linux": { "min_passed": 25, "allow_skipped": "", "require": { "\\bpg\\b": 9 } },
@@ -16,10 +16,10 @@
     "win32": { "min_passed": 70, "allow_skipped": "^agentd (TestSystemRoute|TestPowerOffStartsTheCommandAndAnswers202)$" }
   },
   "pytest": {
-    "linux": { "min_passed": 2799, "allow_skipped": "" }
+    "linux": { "min_passed": 2299, "allow_skipped": "" }
   },
   "playwright": {
-    "linux": { "min_passed": 101, "allow_skipped": "" },
-    "win32": { "min_passed": 101, "allow_skipped": "" }
+    "linux": { "min_passed": 99, "allow_skipped": "" },
+    "win32": { "min_passed": 99, "allow_skipped": "" }
   }
 }
```

---

### Incident Patch 13: `cf2931c6` (2026-10-06)
**Commit Message**: merge lane-quick: setup --all, the first run in one command

No conflicts; typecheck clean.

**File**: `README.md` (modified, +76/-63)
```diff
@@ -82,12 +82,16 @@ own machine from this repository.
 
 ## Quick start
 
+In short: install Node, Go and Git, clone, `npm ci`, build the command line,
+run `setup --all`, run `server`, and open the web UI to make the first Dot. That
+is eight lines to type on Windows and nine on Linux, then the browser.
+
 ### Requirements
 
 - Linux or Windows, on x86-64, with hardware virtualization on. macOS is not
   supported.
 - Node 24 or newer, Git, and Go 1.25 or newer (to build the guest daemon).
-- QEMU 8.2 or newer; `setup` installs it and enables the accelerator.
+- QEMU 8.2 or newer; `setup --all` installs it and enables the accelerator.
 - At least 20 GiB free for the data directory (`doctor` checks it). Each Dot's
   disk is a copy-on-write overlay that grows as it writes, up to its
   `computer.disk` (40 GB in the sample).
@@ -101,7 +105,10 @@ own machine from this repository.
   `C:\invisible-dots` before every command, the server included.
 - An [OpenRouter](https://openrouter.ai) key.
 
-### 1. Install the tools and build
+### 1. Get the tools and the code
+
+This is the part the repository's own command cannot do, because the command
+needs Node and the checkout to exist first.
 
 **Windows**, in PowerShell:
 
@@ -112,11 +119,6 @@ git clone https://github.com/feder-cr/dots
 cd dots
 npm ci
 npm run build --workspace @invisible-dots/cli
-$env:NEXT_TELEMETRY_DISABLED = "1"
-npm run build --workspace @invisible-dots/web
-$env:CGO_ENABLED = "0"; $env:GOOS = "linux"; $env:GOARCH = "amd64"
-go -C guest/dot-agentd build -trimpath -o bin/dot-agentd ./cmd/dot-agentd
-Remove-Item Env:CGO_ENABLED, Env:GOOS, Env:GOARCH
 ```
 
 **Linux** (Ubuntu 24.04), in bash:
@@ -129,48 +131,73 @@ git clone https://github.com/feder-cr/dots
 cd dots
 npm ci
 npm run build --workspace @invisible-dots/cli
-NEXT_TELEMETRY_DISABLED=1 npm run build --workspace @invisible-dots/web
-CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go -C guest/dot-agentd build -trimpath -o bin/dot-agentd ./cmd/dot-agentd
 ```
 
-`NEXT_TELEMETRY_DISABLED` keeps Next.js from sending its anonymous build
-telemetry while the web client is built.
+### 2. Get the host ready, in one command
 
-### 2. Get the host ready
-
-The same commands in PowerShell and bash, from the repository folder:
+The same command in PowerShell and bash, from the repository folder:
 
 ```sh
-node apps/cli/dist/invisible-dots.mjs setup
+node apps/cli/dist/invisible-dots.mjs setup --all
 ```
 
-`setup` checks the host and fixes only what is missing. Run it as yourself,
-not as root or administrator: it asks for the rights it needs once.
+Run it as yourself, not as root or administrator: it asks for the rights it
+needs once. It runs four steps in order, and each one skips what is already
+done. These are the commands the quick start used to have you type one by one;
+you can still run any of them alone:
+
+| step | what it does | by hand |
+|---|---|---|
+| 1. The guest daemon | Builds `dot-agentd`, the program that runs inside every Dot's VM, for Linux whatever your host is. It stops here, before changing anything, when Go is missing, and prints the command that installs it. | `go -C guest/dot-agentd build -trimpath -o bin/dot-agentd ./cmd/dot-agentd` with `CGO_ENABLED=0 GOOS=linux GOARCH=amd64` |
+| 2. QEMU and its accelerator | Checks the host and fixes only what is missing. On **Windows** it enables the Windows Hypervisor Platform and installs QEMU in one elevated step (one UAC prompt). On **Linux** it installs QEMU with `sudo apt-get` (sudo asks for your password). | `invisible-dots setup` |
+| 3. The web client | Builds it, with Next.js's anonymous telemetry turned off, unless it is built already. | `npm run build --workspace @invisible-dots/web` |
+| 4. The guest images | Builds the golden image (Ubuntu 24.04, the desktop, the browser) and the runtime disk (the daemon and the engine). It is the longest step, and a second run with unchanged inputs does nothing. | `invisible-dots image build` |
+
+Two things can stop it on purpose, and both end with the same advice: run the
+same command again and it carries on.
+
+- On **Windows**, if enabling the accelerator needs a restart, it says so and
+  exits with code 5 after step 2. Restart, come back to this folder and run it
+  again.
+- On **Linux**, if you are not in the `kvm` group yet it prints
+  `sudo usermod -aG kvm $USER`. Log out and in again, then run it again.
+
+Anything else that fails (a missing Go, a failed download, a build error)
+stops the run with the reason and with nothing after that step run. `doctor`
+prints one line per check and the command that fixes each failure; `setup
+--all` ends by telling you what to do next. Ctrl+C stops the image build
+cleanly, and a second Ctrl+C ends the command at once.
 
-- On **Windows** it enables the Windows Hypervisor Platform and installs QEMU
-  in one elevated step. If it says to restart (exit code 5), restart and come
-  back to this folder.
-- On **Linux** it installs QEMU with `sud
```

**File**: `apps/cli/src/cli.ts` (modified, +22/-4)
```diff
@@ -32,6 +32,8 @@ export const CLI_VERSION = "0.1.0";
 export interface HostCommands {
   doctor(options: { json: boolean }, io: CliIo): Promise<number>;
   setup(io: CliIo): Promise<number>;
+  /** `setup --all`: setup, the builds and `image build` in one run that can be run again (setup/all.ts). */
+  setupAll(io: CliIo): Promise<number>;
   imageBuild(io: CliIo): Promise<number>;
   server(io: CliIo, options: { web: boolean }): Promise<number>;
 }
@@ -61,8 +63,10 @@ class UsageError extends Error {}
 
 export const USAGE = `invisible-dots - control your Dots
 
-Getting this host ready (the same four commands on Linux and Windows):
-  invisible-dots setup                          get QEMU and its accelerator ready (may ask for administrator rights once)
+Getting this host ready (the same commands on Linux and Windows):
+  invisible-dots setup --all                    everything in one run, in order: the guest daemon, QEMU and its accelerator, the web client, the images;
+                                                run it again after a restart or a failure and it carries on
+  invisible-dots setup                          just QEMU and its accelerator (may ask for administrator rights once)
   invisible-dots doctor [--json]                check everything; one line per check and the command that fixes a failure
   invisible-dots image build                    build the golden image and the runtime ISO
   invisible-dots server [--no-web]              run the control plane and the web client in the foreground (--no-web: the control plane only)
@@ -108,7 +112,7 @@ Environment:
   ${ENV.TOKEN}      API token (default: the first line of <${ENV.HOME}>/config/api.token)
 
 Exit codes: 0 ok; 1 the server reported an error, a doctor check is not ok or a setup step failed;
-2 usage error; 3 server unreachable; 4 missing or refused token; 5 restart the computer, then run doctor.
+2 usage error; 3 server unreachable; 4 missing or refused token; 5 restart the computer, then run doctor (or setup --all again).
 `;
 
 export const SAMPLE_DOT = `# A Dot configuration (docs/architecture.md, section 7).
@@ -158,6 +162,20 @@ const OPTIONS = {
   version: { type: "boolean", short: "v" },
 } as const;
 
+/**
+ * Whether Ctrl-C asks the command to stop (through `io.signal`) instead of ending the process at once: `logs` ends
+ * cleanly, and `image build`, alone or as the last step of `setup --all`, kills its builder VM first. `server` installs
+ * its own handlers.
+ */
+export function interruptIsAsked(argv: string[]): boolean {
+  try {
+    const { positionals, values } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true, strict: false });
+    return positionals[0] === "logs" || positionals[0] === "image" || (positionals[0] === "setup" && values.all === true);
+  } catch {
+    return false;
+  }
+}
+
 /** The command word of an argument list, so main.ts can decide what Ctrl-C does before `run` starts. */
 export function commandOf(argv: string[]): string | undefined {
   try {
@@ -286,7 +304,7 @@ export async function run(argv: string[], io: CliIo): Promise<number> {
     switch (command) {
       case "setup":
         noArguments(args, "setup");
-        return await (await host()).setup(io);
+        return values.all === true ? await (await host()).setupAll(io) : await (await host()).setup(io);
       case "doctor":
         noArguments(args, "doctor");
         return await (await host()).doctor({ json: values.json === true }, io);
```

**File**: `apps/cli/src/host.ts` (modified, +31/-2)
```diff
@@ -43,10 +43,12 @@ import { connectApi } from "./api-client.js";
 import type { CliIo, HostCommands } from "./cli.js";
 import { doctorCommand } from "./doctor/command.js";
 import { EXIT } from "./exit.js";
+import { runSetupAll } from "./setup/all.js";
+import { buildAgent, buildWeb, type BuildDeps } from "./setup/build.js";
 import { currentUserIsRoot, type InstallDeps } from "./setup/install.js";
 import { parseWindowsQemuPin } from "./setup/qemu-pin.js";
 import { serve } from "./serve.js";
-import { runSetup } from "./setup/setup.js";
+import { prepareHost, runSetup, type SetupDeps } from "./setup/setup.js";
 import { locateWebBuild, startWebServer } from "./web.js";
 
 /**
@@ -81,6 +83,20 @@ function doctorDeps(io: CliIo): DoctorDeps {
   };
 }
 
+function setupDeps(io: CliIo): SetupDeps {
+  return { doctor: doctorDeps(io), install: installDeps(io), out: io.stdout };
+}
+
+function buildDeps(io: CliIo): BuildDeps {
+  return {
+    run: runProcess,
+    env: io.env,
+    repoRoot: REPO_ROOT,
+    node: process.execPath,
+    webBuilt: async () => (await locateWebBuild(REPO_ROOT)).missing === undefined,
+  };
+}
+
 function installDeps(io: CliIo): InstallDeps {
   const log = (line: string) => io.stdout(`${line}\n`);
   return {
@@ -144,7 +160,20 @@ async function imageBuild(io: CliIo): Promise<number> {
 export function realHostCommands(): HostCommands {
   return {
     doctor: (options, io) => doctorCommand(doctorDeps(io), options, io.stdout),
-    setup: (io) => runSetup({ doctor: doctorDeps(io), install: installDeps(io), out: io.stdout }),
+    setup: (io) => runSetup(setupDeps(io)),
+    setupAll: (io) => {
+      const builds = buildDeps(io);
+      return runSetupAll({
+        out: io.stdout,
+        agent: () => buildAgent(builds),
+        host: () => prepareHost(setupDeps(io)),
+        web: () => buildWeb(builds),
+        images: () => imageBuild(io),
+        env: io.env,
+        tokenPath: hostPaths(io.env).apiTokenPath,
+        ...(io.signal ? { signal: io.signal } : {}),
+      });
+    },
     imageBuild,
     server: async (io, options) => {
       await serve(
```

**File**: `apps/cli/src/main.ts` (modified, +6/-5)
```diff
@@ -1,5 +1,5 @@
 /** The `invisible-dots` executable: wires `run` to the real process. */
-import { commandOf, run } from "./cli.js";
+import { commandOf, interruptIsAsked, run } from "./cli.js";
 import { readSecretLine } from "./secret-input.js";
 
 async function readStdin(): Promise<string> {
@@ -14,10 +14,11 @@ const command = commandOf(argv);
 const controller = new AbortController();
 
 // What Ctrl-C does depends on the command. `logs` ends cleanly. `image build`
-// is asked to stop, so it can kill its builder VM, and a second Ctrl-C exits
-// at once. `server` installs its own handlers (it closes the database before
-// exiting). Every other command keeps Node's default: exit immediately.
-if (command === "logs" || command === "image") {
+// (and `setup --all`, which ends with it) is asked to stop, so it can kill its
+// builder VM, and a second Ctrl-C exits at once. `server` installs its own
+// handlers (it closes the database before exiting). Every other command keeps
+// Node's default: exit immediately.
+if (interruptIsAsked(argv)) {
   process.on("SIGINT", () => {
     if (controller.signal.aborted) process.exit(130);
     controller.abort();
```

**File**: `apps/cli/src/setup/all.ts` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+/**
+ * `invisible-dots setup --all`: everything the quick start did by hand after `npm ci`, in order, as one command that
+ * can be run again. Each step is the code of the command that owns it (the guest daemon and web client builds in
+ * build.ts, QEMU and its accelerator in setup.ts, `image build` in host.ts) and skips what is already done, so a run
+ * that stopped, for a restart, a new login or a failure, is continued by running the same command again.
+ *
+ * The one step that needs administrator rights stays one step: it is `setup`'s, which asks once. It comes second,
+ * after the quick daemon build that finds a missing Go before anything is changed, and before the long builds, so a
+ * restart it asks for costs nothing already done.
+ */
+import { DEFAULT_WEB_LISTEN, ENV } from "@invisible-dots/shared";
+import { EXIT } from "../exit.js";
+import type { StepResult } from "./build.js";
+import type { HostOutcome } from "./setup.js";
+
+/** The command this prints wherever the person has to come back: the same one, which continues. */
+export const SETUP_ALL_COMMAND = "invisible-dots setup --all";
+
+export interface SetupAllDeps {
+  out(text: string): void;
+  /** Build dot-agentd. */
+  agent(): Promise<StepResult>;
+  /** Get QEMU and its accelerator ready (`setup`). */
+  host(): Promise<HostOutcome>;
+  /** Build the web client unless it is built. */
+  web(): Promise<StepResult>;
+  /** `image build`: the exit code, or a rejection with the reason. */
+  images(): Promise<number>;
+  env: Record<string, string | undefined>;
+  /** Where `invisible-dots server` writes the API token, which the web client asks for. */
+  tokenPath: string;
+  /** Aborted by Ctrl-C. Checked between steps: only `image build` can stop in the middle of one. */
+  signal?: AbortSignal;
+}
+
+/** The address the web client listens on: the setting, or its default. */
+export function webAddress(env: Record<string, string | undefined>): string {
+  return `http://${env[ENV.WEB_LISTEN]?.trim() || DEFAULT_WEB_LISTEN}`;
+}
+
+const STEPS = 4;
+
+export async function runSetupAll(deps: SetupAllDeps): Promise<number> {
+  const { out } = deps;
+  const heading = (n: number, text: string) => out(`\n[${n}/${STEPS}] ${text}\n`);
+  const interrupted = () => deps.signal?.aborted === true;
+  const stopped = (lines: readonly string[]) => {
+    for (const line of lines) out(`  ${line}\n`);
+    out(`\nStopped. Nothing after this step was run. Once it is fixed, run ${SETUP_ALL_COMMAND} again: it skips what is done.\n`);
+    return EXIT.failed;
+  };
+  out(`${SETUP_ALL_COMMAND}: ${STEPS} steps. Each skips what is already done, so run it again after anything that stops it.\n`);
+
+  heading(1, "the guest daemon dot-agentd (Go builds it)");
+  const agent = await deps.agent();
+  if (!agent.ok) return stopped(agent.lines);
+  for (const line of agent.lines) out(`  ${line}\n`);
+  if (interrupted()) return stopped(["interrupted"]);
+
+  heading(2, "QEMU and its accelerator (the `setup` command: it asks for administrator rights once, and only if something is missing)");
+  const host = await deps.host();
+  if (!host.ready) {
+    if (host.code === EXIT.restart) {
+      out(`\nRestart the computer now, then run ${SETUP_ALL_COMMAND} again from this folder: it carries on with step 3.\n`);
+    } else if (host.code !== EXIT.usage) {
+      out(`\nStopped. When what is listed above is done (log out and in again if it says so), run ${SETUP_ALL_COMMAND} again: it skips what is done.\n`);
+    }
+    return host.code;
+  }
+
+  if (interrupted()) return stopped(["interrupted"]);
+  heading(3, "the web client");
+  const web = await deps.web();
+  if (!web.ok) return stopped(web.lines);
+  for (const line of web.lines) out(`  ${line}\n`);
+  if (interrupted()) return stopped(["interrupted"]);
+
+  heading(4, "the guest images (what `invisible-dots image build` does; the longest step)");
+  try {
+    const code = await deps.images();
+    if (code !== EXIT.ok) return stopped([`image build ended with exit code ${code}`]);
+  } catch (error) {
+    return stopped([`image build stopped: ${(error as Error).message}`]);
+  }
+
+  out(`
+This computer is ready. To use it:
+  1. start the server and leave it running:   invisible-dots server
+  2. open ${webAddress(deps.env)} in your browser and sign in with the first line of
+     ${deps.tokenPath}
+     (the server creates that file the first time it starts)
+  3. the page asks for your OpenRouter key, then lets you create your first Dot.
+`);
+  return EXIT.ok;
+}
```

**File**: `apps/cli/src/setup/build.ts` (added, +84/-0)
```diff
@@ -0,0 +1,84 @@
+/**
+ * The two builds the quick start used to ask for by hand, as steps of `invisible-dots setup --all`: the guest
+ * daemon dot-agentd (Go) and the web client (Next). What each one runs is owned elsewhere (the image builder names the
+ * Go command, apps/web/scripts/build.mjs is the web build); this file runs it and says what happened. Both go
+ * through the host's one process runner, with an argument array and never a shell.
+ */
+import { agentdBuildCommand, defaultRuntimeInputs } from "@invisible-dots/image-builder";
+import { WEB_BUILD_COMMAND, type Runner, type RunResult } from "@invisible-dots/vm-manager";
+import { webBuildScript } from "../web.js";
+
+/** A step either went through (and says what it did) or stopped the run (and says what to do). */
+export interface StepResult {
+  ok: boolean;
+  lines: string[];
+}
+
+export interface BuildDeps {
+  run: Runner;
+  /** The environment the builds start from; the Go build adds its own variables, the web build turns Next's telemetry off. */
+  env: Record<string, string | undefined>;
+  repoRoot: string;
+  /** The program that runs the web build script: the node running this command. */
+  node: string;
+  /** Whether the web client is built completely (`locateWebBuild`). */
+  webBuilt(): Promise<boolean>;
+}
+
+/**
+ * How to get Go: both hosts' commands in one line, so that no platform check is needed to choose one. setup never
+ * runs it (the Windows installer and snap each ask for administrator rights of their own, and setup asks once).
+ */
+export const GO_INSTALL_HINT = "install it: on Windows `winget install -e --id GoLang.Go`, on Linux `sudo snap install go --classic`, or see https://go.dev/dl";
+
+/** Go downloads its toolchain when go.mod asks for a newer one, and compiles the daemon from a cold cache. */
+const AGENT_TIMEOUT_MS = 15 * 60_000;
+const WEB_TIMEOUT_MS = 30 * 60_000;
+const STDERR_LINES = 10;
+
+function why(answer: RunResult, limit: number): string {
+  if (answer.timedOut) return `it did not finish within ${limit / 60_000} minutes`;
+  return answer.startError?.message ?? `exit code ${answer.code ?? answer.signal}`;
+}
+
+/**
+ * Builds dot-agentd. Always run, never skipped: Go keeps its own build cache, so an unchanged daemon takes seconds,
+ * and the image builder turns the same bytes into "already built".
+ */
+export async function buildAgent(deps: BuildDeps): Promise<StepResult> {
+  const build = agentdBuildCommand(deps.repoRoot);
+  const answer = await deps.run(build.command, build.args, { env: { ...deps.env, ...build.env }, timeoutMs: AGENT_TIMEOUT_MS });
+  if (answer.startError?.code === "ENOENT") {
+    return {
+      ok: false,
+      lines: [
+        "Go is not installed, or is not on PATH: the guest daemon dot-agentd is written in Go",
+        GO_INSTALL_HINT,
+        "then open a new terminal (the installer changes PATH) and run: invisible-dots setup --all",
+      ],
+    };
+  }
+  if (answer.code !== 0 || answer.timedOut) {
+    const tail = answer.stderr.trim().split(/\r?\n/).slice(-STDERR_LINES);
+    return { ok: false, lines: [`building dot-agentd failed (${why(answer, AGENT_TIMEOUT_MS)}):`, ...tail.filter((line) => line.trim() !== "").map((line) => `  ${line}`)] };
+  }
+  return { ok: true, lines: [`built ${defaultRuntimeInputs(deps.repoRoot).agentdBinary}`] };
+}
+
+/** Builds the web client unless it is complete already (a rebuild after an update is the command this prints). */
+export async function buildWeb(deps: BuildDeps): Promise<StepResult> {
+  if (await deps.webBuilt()) return { ok: true, lines: [`already built; after an update, build it again with: ${WEB_BUILD_COMMAND}`] };
+  // The output is the person's to see: a Next build takes minutes and prints its progress.
+  const answer = await deps.run(deps.node, [webBuildScript(deps.repoRoot)], {
+    env: { ...deps.env, NEXT_TELEMETRY_DISABLED: "1" },
+    inheritStdio: true,
+    timeoutMs: WEB_TIMEOUT_MS,
+  });
+  if (answer.code !== 0 || answer.timedOut) {
+    return { ok: false, lines: [`building the web client failed (${why(answer, WEB_TIMEOUT_MS)}; its output is above)`, `after fixing it, run: invisible-dots setup --all`] };
+  }
+  if (!(await deps.webBuilt())) {
+    return { ok: false, lines: [`the web client build finished but its server files are not where invisible-dots looks (apps/web/.next/standalone); build it with: ${WEB_BUILD_COMMAND}`] };
+  }
+  return { ok: true, lines: ["built the web client"] };
+}
```

**File**: `apps/cli/src/setup/setup.ts` (modified, +42/-30)
```diff
@@ -51,12 +51,19 @@ function printOutcome(outcome: InstallOutcome, out: (text: string) => void): voi
   for (const line of outcome.lines) out(`${line}\n`);
 }
 
-export async function runSetup(deps: SetupDeps): Promise<number> {
+/** What `prepareHost` ends with: the doctor report once QEMU and the accelerator are ready, or the exit code of the run that could not get them ready. */
+export type HostOutcome = { ready: true; results: readonly DoctorCheck[] } | { ready: false; code: number };
+
+/**
+ * The work of `setup`, up to QEMU and its accelerator being ready: the one place that does it, run by `setup` itself
+ * and as a step of `setup --all`. It prints what it does; what to do next is the caller's to say.
+ */
+export async function prepareHost(deps: SetupDeps): Promise<HostOutcome> {
   const { out } = deps;
   const refusal = setupRefusal(deps.install);
   if (refusal) {
     out(`${refusal}\n`);
-    return EXIT.usage;
+    return { ready: false, code: EXIT.usage };
   }
   out("checking this host first (invisible-dots doctor):\n\n");
   const before = await runDoctor(deps.doctor);
@@ -71,40 +78,45 @@ export async function runSetup(deps: SetupDeps): Promise<number> {
 
   if (setupReady(before)) {
     out("QEMU and its accelerator are ready; nothing to install.\n");
-  } else if (!request.installQemu && !request.enableAccelerator) {
+    return { ready: true, results: before };
+  }
+  if (!request.installQemu && !request.enableAccelerator) {
     out("setup cannot fix this by installing something:\n");
     for (const id of SETUP_CHECKS) {
       const check = checks.get(id);
       if (check && check.status !== "ok") out(`  ${check.label}: ${check.detail}${check.fix ? `\n  fix: ${check.fix}` : ""}\n`);
     }
-    return EXIT.failed;
-  } else {
-    let outcome: InstallOutcome;
-    try {
-      outcome = await (deps.installPrerequisites ?? installHostPrerequisites)(request, deps.install);
-    } catch (error) {
-      outcome = { kind: "failed", lines: [(error as Error).message] };
-    }
-    printOutcome(outcome, out);
-    if (outcome.kind === "restart") return EXIT.restart;
-    if (outcome.kind === "failed") {
-      out("setup stopped; nothing after the failed step was run.\n");
-      return EXIT.failed;
-    }
-    if (outcome.kind === "manual") {
-      out("then run: invisible-dots doctor\n");
-      return EXIT.failed;
-    }
-    out("\nchecking again:\n\n");
-    const after = await runDoctor(deps.doctor);
-    out(`${renderReport(after)}\n`);
-    if (!setupReady(after)) {
-      out("QEMU or its accelerator is still not usable; see the fix lines above.\n");
-      return EXIT.failed;
-    }
-    return finish(after, out);
+    return { ready: false, code: EXIT.failed };
+  }
+  let outcome: InstallOutcome;
+  try {
+    outcome = await (deps.installPrerequisites ?? installHostPrerequisites)(request, deps.install);
+  } catch (error) {
+    outcome = { kind: "failed", lines: [(error as Error).message] };
+  }
+  printOutcome(outcome, out);
+  if (outcome.kind === "restart") return { ready: false, code: EXIT.restart };
+  if (outcome.kind === "failed") {
+    out("setup stopped; nothing after the failed step was run.\n");
+    return { ready: false, code: EXIT.failed };
+  }
+  if (outcome.kind === "manual") {
+    out("then run: invisible-dots doctor\n");
+    return { ready: false, code: EXIT.failed };
   }
-  return finish(before, out);
+  out("\nchecking again:\n\n");
+  const after = await runDoctor(deps.doctor);
+  out(`${renderReport(after)}\n`);
+  if (!setupReady(after)) {
+    out("QEMU or its accelerator is still not usable; see the fix lines above.\n");
+    return { ready: false, code: EXIT.failed };
+  }
+  return { ready: true, results: after };
+}
+
+export async function runSetup(deps: SetupDeps): Promise<number> {
+  const outcome = await prepareHost(deps);
+  return outcome.ready ? finish(outcome.results, deps.out) : outcome.code;
 }
 
 function finish(results: readonly DoctorCheck[], out: (text: string) => void): number {
```

**File**: `apps/cli/src/web.ts` (modified, +5/-0)
```diff
@@ -19,6 +19,11 @@ import { startProcess, WEB_BUILD_COMMAND, type StartedProcess, type StartProcess
 const ENTRY = ["apps", "web", ".next", "standalone", "apps", "web", "server.js"] as const;
 const STATIC = ["apps", "web", ".next", "standalone", "apps", "web", ".next", "static"] as const;
 
+/** The script `npm run build --workspace @invisible-dots/web` runs, which `setup --all` runs with node itself. */
+export function webBuildScript(repoRoot: string): string {
+  return join(repoRoot, "apps", "web", "scripts", "build.mjs");
+}
+
 export async function locateWebBuild(repoRoot: string): Promise<WebBuild> {
   const entry = join(repoRoot, ...ENTRY);
   for (const path of [entry, join(repoRoot, ...STATIC)]) {
```

---

### Incident Patch 14: `d9194a31` (2026-10-06)
**Commit Message**: tests: floors set to what the merged suites measure (M7)

Every floor is the measured count of the merged tree (HEAD 07812b36 for
the guest and container suites, run from a git archive; the Windows host
suites on this checkout):

  vitest      linux 2269, win32 2272   (was 2255 / 2258)
  postgres    linux 697, pg runs 272   (was 711 / 281, lowered: see below)
  whatsapp    linux 25 (9 pg), win32 16 (was 24 / 15)
  go          linux 120, win32 70      (unchanged since lane-sec)
  pytest      linux 2799               (was 2791)
  playwright  linux 101, win32 101     (unchanged)

The postgres floor is lowered, from 711 to 697 tests and from 281 to 272
runs on pg, and the reason is a move, not a loss. lane-lic took the tests
that need the real WhatsApp client out of the default suites because the
client is an opt-in install: the auth-state tests (18 tests, 9 of them on
pg) and the reading and connector tests of baileys.test.ts, plus the
final review's test that Baileys fetches no link of a text, now
packages/channels/test-optin/ (npm run test:whatsapp, the whatsapp floor,
which the whatsapp-client job counts with PostgreSQL: 25 passed, 9 of
them pg). The default suites gained the tests

**File**: `.github/test-floors.json` (modified, +5/-5)
```diff
@@ -1,15 +1,15 @@
 {
   "//": "What each suite must reach on each host, read by .github/scripts/test-guard.mjs in CI (tests.yml) and in the pre-push hook. Raise a floor when tests are added; lowering one is a decision to write down in the commit that does it. Linux skips only the tests that drive a real Windows PowerShell; a Windows host compiles dot-agentd's unix-only test files out and skips the two Go tests that need a Linux guest. The playwright floor is the web client's browser tests (the web job of tests.yml; the same hundred and one run on a Windows host, which is where they are developed). The pytest floor is the Python engine's (invisible_engine_dots, the engine job of tests.yml, Linux only, nothing may skip). The whatsapp floor is the suite that needs the real WhatsApp client, an opt-in install (npm run test:whatsapp, the whatsapp-client job of tests.yml, which installs the client and runs it with PostgreSQL, so the pg runs of the auth state count); a host without PostgreSQL reaches the win32 number.",
   "vitest": {
-    "linux": { "min_passed": 2258, "allow_skipped": "^generated PowerShell on a real Windows PowerShell " },
-    "win32": { "min_passed": 2261, "allow_skipped": "" }
+    "linux": { "min_passed": 2269, "allow_skipped": "^generated PowerShell on a real Windows PowerShell " },
+    "win32": { "min_passed": 2272, "allow_skipped": "" }
   },
   "postgres": {
-    "linux": { "min_passed": 711, "allow_skipped": "", "require": { "\\bpg\\b": 281 } }
+    "linux": { "min_passed": 697, "allow_skipped": "", "require": { "\\bpg\\b": 272 } }
   },
   "whatsapp": {
-    "linux": { "min_passed": 24, "allow_skipped": "", "require": { "\\bpg\\b": 9 } },
-    "win32": { "min_passed": 15, "allow_skipped": "" }
+    "linux": { "min_passed": 25, "allow_skipped": "", "require": { "\\bpg\\b": 9 } },
+    "win32": { "min_passed": 16, "allow_skipped": "" }
   },
   "go": {
     "linux": { "min_passed": 120, "allow_skipped": "" },
```

---

### Incident Patch 15: `9b1fd2fe` (2026-10-06)
**Commit Message**: tests: floors raised to what the suites reach now (final review)

Measured on this Windows host on the tree of d27601ef, after the work of the final
review; nothing is lowered.

- vitest: win32 2160 -> 2258 passed, 0 skipped; linux 2157 -> 2255 (the same three
  PowerShell tests skip there).
- postgres (the pg adapter, against postgres 18.4): 687 -> 711 passed, the "pg"
  tests 279 -> 281.
- pytest (engine, docker, python 3.12): 2778 -> 2791 passed, nothing skipped.
- playwright: 95 -> 101 passed.
- go (dot-agentd): unchanged, 64 passed on win32 (110 on linux).
- the engine smoke 238/238 and the browser smoke 75/75 passed on the git archive
  of d27601ef.

**File**: `.github/test-floors.json` (modified, +7/-7)
```diff
@@ -1,21 +1,21 @@
 {
-  "//": "What each suite must reach on each host, read by .github/scripts/test-guard.mjs in CI (tests.yml) and in the pre-push hook. Raise a floor when tests are added; lowering one is a decision to write down in the commit that does it. Linux skips only the tests that drive a real Windows PowerShell; a Windows host compiles dot-agentd's unix-only test files out and skips the two Go tests that need a Linux guest. The playwright floor is the web client's browser tests (the web job of tests.yml; the same ninety-five run on a Windows host, which is where they are developed). The pytest floor is the Python engine's (invisible_engine_dots, the engine job of tests.yml, Linux only, nothing may skip).",
+  "//": "What each suite must reach on each host, read by .github/scripts/test-guard.mjs in CI (tests.yml) and in the pre-push hook. Raise a floor when tests are added; lowering one is a decision to write down in the commit that does it. Linux skips only the tests that drive a real Windows PowerShell; a Windows host compiles dot-agentd's unix-only test files out and skips the two Go tests that need a Linux guest. The playwright floor is the web client's browser tests (the web job of tests.yml; the same hundred and one run on a Windows host, which is where they are developed). The pytest floor is the Python engine's (invisible_engine_dots, the engine job of tests.yml, Linux only, nothing may skip).",
   "vitest": {
-    "linux": { "min_passed": 2157, "allow_skipped": "^generated PowerShell on a real Windows PowerShell " },
-    "win32": { "min_passed": 2160, "allow_skipped": "" }
+    "linux": { "min_passed": 2255, "allow_skipped": "^generated PowerShell on a real Windows PowerShell " },
+    "win32": { "min_passed": 2258, "allow_skipped": "" }
   },
   "postgres": {
-    "linux": { "min_passed": 687, "allow_skipped": "", "require": { "\\bpg\\b": 279 } }
+    "linux": { "min_passed": 711, "allow_skipped": "", "require": { "\\bpg\\b": 281 } }
   },
   "go": {
     "linux": { "min_passed": 110, "allow_skipped": "" },
     "win32": { "min_passed": 64, "allow_skipped": "^agentd (TestSystemRoute|TestPowerOffStartsTheCommandAndAnswers202)$" }
   },
   "pytest": {
-    "linux": { "min_passed": 2778, "allow_skipped": "" }
+    "linux": { "min_passed": 2791, "allow_skipped": "" }
   },
   "playwright": {
-    "linux": { "min_passed": 95, "allow_skipped": "" },
-    "win32": { "min_passed": 95, "allow_skipped": "" }
+    "linux": { "min_passed": 101, "allow_skipped": "" },
+    "win32": { "min_passed": 101, "allow_skipped": "" }
   }
 }
```

#### Recent Merged Pull Requests:
- **PR #1415** (2026-10-07): Fixes from the soak: engine stop, task claim, Inbox after a delete, Home card on a phone (@feder-cr)
- **PR #1414** (2026-10-07): README: a one-minute page, not a stub (@feder-cr)
- **PR #1413** (2026-10-07): README: short, the long form in docs/guide.md (@feder-cr)
- **PR #1412** (2026-10-06): 0.70.12: the wrapper floor moves to 0.27.0, the language of the real Firefox of the egress country (@feder-cr)
- **PR #1411** (2026-10-05): 0.70.11: the wrapper floor moves to 0.26.0, the firefox-36 engine (@feder-cr)
- **PR #1410** (2026-10-04): 0.70.10: the file chooser pause is the wrapper's standard set_files (@feder-cr)
- **PR #1409** (closed): browser_navigate: no response while on another page is an error, not success (@richardpowellus)
- **PR #1407** (2026-10-03): 0.70.9: the wrapper floor moves to 0.25.9, the firefox-35 engine (@feder-cr)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
