# Verification Protocol: Verification Protocol: Empirical Defect Shield for feder/cr/jobs_applier_ai_agent_aihawk

<!-- PROVENANCE_START
{
  "source_repository": "feder/cr/jobs_applier_ai_agent_aihawk",
  "source_url": "https://github.com/feder/cr/jobs_applier_ai_agent_aihawk",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [feder/cr/jobs_applier_ai_agent_aihawk](https://github.com/feder/cr/jobs_applier_ai_agent_aihawk) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `feder/cr/jobs_applier_ai_agent_aihawk` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/feder-cr-jobs_applier_ai_agent_aihawk-learnings.md`  
> **Source**: github ([https://github.com/feder-cr/Jobs_Applier_AI_Agent_AIHawk](https://github.com/feder-cr/Jobs_Applier_AI_Agent_AIHawk))  
> **Source Version**: `da1c7ff1`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-04T09:17:49.969Z  
> **Learning ID**: `learn-github-feder-cr-jobs_applier_ai_agent_aihawk`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): feder-cr/Jobs_Applier_AI_Agent_AIHawk

> **Canonical Artifact**: `07_PROJECT_LEARNING/feder-cr-jobs_applier_ai_agent_aihawk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/feder-cr/Jobs_Applier_AI_Agent_AIHawk](https://github.com/feder-cr/Jobs_Applier_AI_Agent_AIHawk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-04T09:17:49.099Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `feder-cr/Jobs_Applier_AI_Agent_AIHawk`
- **Description**: Open-source, self-hosted alternative to OpenAI Dots, Grok Bot. Built to be undetectable by anti-bot systems.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 32385 stars

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
import { applyGuestEvent, dotStatusForAgent, type AppliedGuestEvent } from "./guest-events.js";
import { abortableSleep, ControlPlaneError, errorMessage, type Clock, type Logger } from "@invisible-dots/shared";
import { BackgroundWork, KeyedMutex } from "./support.js";

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
  readonly #background: BackgroundWork;
  #closed = false;

  constructor(deps: LifecycleDeps) {
    this.#db = deps.db;
    this.#events = deps.events;
    this.#driver = deps.driver;
    this.#clock = deps.clock;
    this.#log = deps.logger;
    this.#background = new BackgroundWork(this.#log);
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
  ): Pro
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

from nanobot.dots.conversations import CONVERSATIONS_DIR
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
        memory_index: str = "",
        skills: Sequence[Skill] = (),
        browser_instructions: str = "",
        mcp_servers: Sequence[Any] = (),
    ) -> None:
        """`dot_prompt` says whose Dot this is and what it is for (projection.py).

        `memory_notes` are the names of the most recently changed notes in `memory_dir`, `memory_index` the
        text of its MEMORY.md (what the Dot always knows); `skills` are the Dot's
        skills (nanobot/dots/skills.py), named in the prompt with their descriptions and paths.
        `browser_instructions` are invisible-playwright-mcp's own, carried as an MCP host carries a server's
        when its page tools are offered (browser_tools.server_instructions); empty when they are not.
        `mcp_servers` are the MCP servers the person declared whose tools may be offered, each with its `name`, its
        `instructions` and, when it is not connected, the `error` that says why (nanobot/dots/mcp_servers.py).
        """
        self.dot_prompt = dot_prompt
        self.workspace = workspace
        self.memory_dir = memory_dir
        self.memory_notes = memory_notes
        self.memory_index = memory_index
        self.skills = skills
        self.browser_instructions = browser_instructions
        self.mcp_servers = mcp_servers
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
                memory_index=self.memory_index,
                conversations_dir=CONVERSATIONS_DIR,
                skills=list(self.skills),
                dot_skills_dir=DOT_SKILLS_DIR,
                browser_instructions=self.browser_instructions,
                mcp_servers=list(self.mcp_servers),
                # The day, not the minute: the prompt then stays the same all day, so the provider's cache of it
                # and its count of the prompt (prompt_count.py) hold from one turn to the next.
                today=self.now.strftime("%Y-%m-%d (%A) %Z").strip(),
            ),
        ]
        if session_summary and session_summary["text"] != "(nothing)":
            parts.append(
                "[Archived Context Summary]\n\n"
                # Codex's summary prefix (Apache-2.0: github.com/openai/codex, codex-rs/prompts/templates/compact).
                "Another model started this work and wrote this summary of it before its context was compacted "
                f"(last active {session_summary['last_active']}). The tools and files it used are still yours: "
                "build on what it did and do not repeat work already done.\n\n"
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
messages, but it must not mutate an existing session history list in place.
"""

from __future__ import annotations

import re
from collections.abc import Awaitable, Callable
from copy import deepcopy
from dataclasses import dataclass, replace
from datetime import datetime
from typing import TYPE_CHECKING, Any, cast

from loguru import logger

from nanobot.agent.context import TranscriptInput
from nanobot.providers.base import CONTEXT_SAFETY_BUFFER, LLMUsage
from nanobot.session.history_visibility import is_hidden_history_message
from nanobot.session.summary import (
    SUMMARY_CONTINUATION_TEXT,
    SessionSummaryCheckpoint,
)
from nanobot.utils.helpers import (
    estimate_message_tokens,
    estimate_prompt_tokens_chain,
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

BACKFILL_CONTENT = "[Tool result unavailable - call was interrupted or lost]"
# A request is compacted only when it reaches its model's own window, less the room kept for the answer: 20000
# tokens, or the model's longest answer when that is shorter (opencode's rule, MIT:
# github.com/anomalyco/opencode, packages/opencode/src/session/overflow.ts).
ANSWER_ROOM_TOKENS = 20_000
# Compacting starts by clearing old tool results, which needs no model call and, measured on SWE-bench, costs
# half as much as summarizing for the same solve rate (JetBrains, "The Complexity Trap", arXiv 2508.21433). The
# newest 40000 tokens of results stay, and the older ones are cleared only when that frees 20000 tokens or more
# (opencode's PRUNE_PROTECT and PRUNE_MINIMUM). Unlike opencode, the results of the last user turns are not
# kept whole: a task is one user turn, so that rule would never clear anything in the long work it is for.
CLEAR_PROTECT_TOKENS = 40_000
CLEAR_MINIMUM_TOKENS = 20_000
CLEARED_TOOL_RESULT = "[Old tool result cleared to save context; call the tool again if you need it.]"
# The note at the end of a result cut to fit the window (ContextGovernor._cut_note): what was kept, of how much.
_CUT_NOTE = re.compile(r"\n\n\[Cut here: the first (\d+) of (\d+) characters\. [^\n]*\]\Z")
PLACEHOLDER_TEXTS = frozenset({
    "[Previous assistant message omitted.]",
})


def prompt_budget(context_window_tokens: int | None, max_tokens: int | None) -> int:
    """The tokens a prompt may take: the model's window less the room kept for the answer (ANSWER_ROOM_TOKENS, or
    the model's longest answer when that is shorter) and the estimate's safety margin; 0 when the window is not
    known, which leaves the request as it is."""
    if not context_window_tokens:
        return 0
    answer_room = ANSWER_ROOM_TOKENS if max_tokens is None else min(ANSWER_ROOM_TOKENS, max_tokens)
    return max(0, context_window_tokens - answer_room - CONTEXT_SAFETY_BUFFER)


def answer_limit(context_window_tokens: int | None, max_tokens: int | None, prompt_tokens: int) -> int | None:
    """The answer limit a request sends: the model's longest answer, or what its window leaves after the prompt
    when that is less (a provider refuses more); None when the model publishes no longest answer."""
    if max_tokens is None:
        return None
    if not context_window_tokens:
        return max_tokens
    return max(1, min(max_tokens, context_window_tokens - prompt_tokens - CONTEXT_SAFETY_BUFFER))


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
    session_key: str | None
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
    summary_checkpoint: SessionSummaryCheckpoint | None = None

    @classmethod
    def from_transcript(
        cls,
        transcript_input: TranscriptInput,
        transcript_builder: TranscriptBuilder,
        consolidate_history: HistoryConsolidator,
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
    compaction: ContextCompactionState
    usage: LLMUsage | None = None
    messages: list[dict[str, Any]] | None = None
    tool_definitions: list[dict[str, Any]] | None = None
    # The answer limit of the request prepare_request prepared last (None: no limit is known, none is sent).
    answer_tokens: int | None = None


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
                and pr
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1332** (2026-09-18): **[BUG]: Potential AI Response Handling Issue in Core Module**
  *Symptoms*: ### Describe the bug  During routine testing and integration with AIHawk core modules, inconsistencies were observed in AI response handling when processing edge cases with complex prompts and varied LLM configurations.  ### Steps to reproduce  1. Use branch named 'main' 2. Go to file containing AI response handler 3. Process a complex multi-turn conversation prompt 4. Execute with various LLM providers 5. Run program using command 'python -m aihawk' 6. Observe inconsistent response parsing behavior  ### Expected behavior  AI responses should be consistently parsed and handled regardless of complexity level and LLM provider, with proper error handling for edge cases.  ### Actual behavior  Occasional parsing failures and inconsistent handling of responses from different LLM providers, particularly with longer or more complex prompts.  ### Branch  main  ### Branch name  _No response_  ### Python version  3.10+  ### LLM Used  Multiple (ChatGPT, Claude, Gemini)  ### Model used  GPT-4, Claude-3, Gemini-Pro  ### Additional context  This issue impacts the reliability of AIHawk when used with different LLM providers and prompt complexities. A comprehensive review of response handling and parsing logic is recommended to ensure robustness across all supported configurations.

- **Issue #1145** (2026-01-16): **[BUG]: <Provide a clear, descriptive title>**
  *Symptoms*: ### Describe the bug  _No response_  ### Steps to reproduce  _No response_  ### Expected behavior  _No response_  ### Actual behavior  _No response_  ### Branch  main  ### Branch name  _No response_  ### Python version  _No response_  ### LLM Used  _No response_  ### Model used  _No response_  ### Additional context  _No response_

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

### Incident Patch 1: `440e43a1` (2026-10-12)
**Commit Message**: engine: no fixed cap on a tool's result; the cut is the model's window, read from OpenRouter on every turn

A result comes back whole. exec, glob/grep and read_file lose their fixed caps (10000/50000, 12000 and 2000
per line, 128000) and the general 12000-character cut is gone. A request that outgrows the model's window is
compacted first, as before; only if it still does not fit are the results of its latest round cut to what the
window leaves, measured with the estimate that judges the request, and the cut says how many characters came
through of how many and how to ask for less. A result is stored cut only beyond what no compaction could make
room for.

The window is read on every turn from the providers OpenRouter lists for the model
(GET /models/{model}/endpoints), not once per process from the whole list: of the providers serving it, the
widest window and the longest answer at that window.

**File**: `docs/architecture.md` (modified, +19/-11)
```diff
@@ -1386,8 +1386,14 @@ The tool calls of one response run one at a time, in the order the model
 gave them. Only the response's `tool_calls` count: a call written in the
 assistant's text runs nothing. The registry validates a call's arguments
 before the policy sees it: an unknown tool or invalid arguments never reach
-the gate and never run, and the model gets the error. A result longer than
-12000 characters is cut, once.
+the gate and never run, and the model gets the error. A result comes back
+whole: no tool has a fixed cap. A request that outgrows the model's window is
+compacted first (old results cleared, then the history summarized, section
+8.5); only if it still does not fit are the results of its latest round cut,
+to what the window leaves (`ContextGovernor.fit_latest_round`), and the cut says
+how many characters came through of how many and how to ask for less. A result
+is stored cut only beyond what no compaction could make room for: the window
+less the system prompt and the tool definitions.
 
 ### 8.4 Policy
 
@@ -1415,11 +1421,13 @@ the OpenAI format, `tool_choice: "auto"`, every request streamed (with
 `stream_options.include_usage`, so the final chunk carries the usage and the
 cost, section 8.2).
 
-Every request uses the whole of what its model can do. The engine reads each
-model's limits once from OpenRouter's list of models (`GET /models`): the
-context window and the longest answer of the provider OpenRouter routes the
-model to by default (`top_provider`). A model OpenRouter does not list fails
-the turn in words; a router that publishes no limits gets none. Each request
+Every request uses the whole of what its model can do. The engine reads the
+model's limits at the start of every turn from the providers OpenRouter lists
+for it (`GET /models/{model}/endpoints`), not once: an engine runs for weeks and
+OpenRouter changes a model's providers meanwhile. Of the providers serving it,
+the widest window and the longest answer at that window are the model's. A
+model OpenRouter does not know fails the turn in words; a router, which lists
+no provider, gets no limits. Each request
 sends the longest answer as `max_tokens`, or what the window leaves after the
 prompt when that is less (OpenRouter refuses more, and without a `max_tokens`
 each provider applies a default of its own), so no answer is cut shorter than
@@ -1428,8 +1436,9 @@ the model allows. A response cut there all the same (`finish_reason:
 them and the model is asked to go on, a bounded number of times; a response cut
 before any text (the budget went to a call that never finished) is told that
 nothing ran and to do the work in smaller steps. Retries with exponential backoff on 429 and 5xx (at most 4
-attempts, honouring `Retry-After`). Tool results longer than 12000 characters
-are cut with a marker.
+attempts, honouring `Retry-After`). A tool result is cut only where the
+model's window ends (section 8.3), with a marker that says how much came
+through.
 
 ### 8.6 Memory
 
@@ -1699,8 +1708,7 @@ Before it serves it checks that no other engine owns the state.
   the zod schema), stored in `dots_kv` and projected in process
   (`projection.py`): the OpenRouter model id, the tools offered (those of the
   table whose permission is `allow` or `ask`), `max_steps_per_task` as the
-  step limit, the 12000-character
-  result cap, and the Dot's section of
+  step limit, and the Dot's section of
   the system prompt (its name and instructions, then nanobot's tool
   contract, a short note on its computer, the memory notes, MEMORY.md, where the past conversations are,
   and the day).
```

**File**: `docs/wiki/compacting-at-the-models-window.md` (modified, +3/-2)
```diff
@@ -25,8 +25,9 @@ continue from, the model made the same call again until the task failed. A
 model with a one-million-token window was being summarized at 32,000.
 
 So the limits went, all of them: a Dot has no token setting. Every request uses
-its model's own limits, read once from OpenRouter's list of models (the window
-and the longest answer of the provider OpenRouter routes to by default), and
+its model's own limits, read from OpenRouter at the start of every turn (the
+widest window of the providers serving the model, and the longest answer at
+that window), and
 asks for the longest answer the window leaves room for. Without `max_tokens`
 each provider would apply a default of its own, often far lower. A response
 cut before it delivered anything is now told that nothing ran and to work in
```

**File**: `guest/image-builder/test/smoke/fake_openrouter.py` (modified, +16/-23)
```diff
@@ -188,29 +188,22 @@ def _handle(self) -> None:
                         "lastUser": text_of(last_user.get("content") if last_user else None)[-400:],
                     },
                 )
-        if self.command == "GET" and "/models" in self.path:
-            # Each model with the window and the longest answer of its default provider, which the engine reads
-            # its limits from. smoke/small's window is small enough for a thread of the run to outgrow it.
-            def model(model_id: str, window: int, answer: int) -> dict:
-                return {
-                    "id": model_id,
-                    "name": "stand-in",
-                    "context_length": window,
-                    "top_provider": {"context_length": window, "max_completion_tokens": answer},
-                    "pricing": {"prompt": "0", "completion": "0"},
-                    "supported_parameters": ["tools", "tool_choice", "max_tokens"],
-                }
-
-            self._send_json(
-                200,
-                {
-                    "data": [
-                        model("openai/gpt-4o-mini", 128000, 16384),
-                        model("smoke/small", 24000, 4096),
-                        model("smoke/summarizer", 24000, 4096),
-                    ]
-                },
-            )
+        if self.command == "GET" and "/models/" in self.path and self.path.endswith("/endpoints"):
+            # The providers of a model, each with its window and longest answer, which the engine reads the
+            # model's limits from on every turn. smoke/small's window is small enough for a thread of the run to
+            # outgrow it.
+            limits = {
+                "openai/gpt-4o-mini": (128000, 16384),
+                "smoke/small": (24000, 4096),
+                "smoke/summarizer": (24000, 4096),
+            }
+            model_id = self.path.split("/models/", 1)[1][: -len("/endpoints")]
+            if model_id not in limits:
+                self._send_json(404, {"error": {"message": "Not Found", "code": 404}})
+                return
+            window, answer = limits[model_id]
+            provider = {"provider_name": "stand-in", "context_length": window, "max_completion_tokens": answer, "status": 0}
+            self._send_json(200, {"data": {"id": model_id, "endpoints": [provider]}})
             return
         if "/chat/completions" not in self.path:
             self.send_response(404)
```

**File**: `invisible_engine_dots/UPSTREAM.md` (modified, +2/-3)
```diff
@@ -188,8 +188,6 @@ body or the exception's message. The provider's own handling and the base class'
 
 Kept on purpose, with the reason, for the next cut to decide:
 
-- `_BoundedOutputBuffer.retained_chars`: the invariant that an unpolled session holds
-  at most its bound is asserted through it.
 - `AgentHook`'s lifecycle methods the Dot's hook does not override: they are exercised
   by upstream tests that pin their behavior, and none is reachable from the Dot.
 
@@ -211,7 +209,8 @@ Kept on purpose, with the reason, for the next cut to decide:
   `Tool.read_only`, `concurrency_safe` and `exclusive`); the calls of a response run one
   at a time, each decided by the gate before it runs.
 - the spill of a long tool result to a file (`maybe_persist_tool_result`, its buckets,
-  `AgentRunSpec.workspace`): a long result is cut to `max_tool_result_chars`.
+  `AgentRunSpec.workspace`): a result is cut only where the model's window ends,
+  once compaction did what it could (`ContextGovernor.fit_latest_round`).
 - agent/tools/mcp.py: a call that hit a connection error was repeated once after 1 s,
   so a call an HTTP server had already received could run twice; it is not repeated
   now. The reconnect machinery and `MCPServerConfig.enabled_tools` are gone:
```

**File**: `invisible_engine_dots/nanobot/agent/context_governance.py` (modified, +155/-42)
```diff
@@ -7,6 +7,7 @@
 
 from __future__ import annotations
 
+import re
 from collections.abc import Awaitable, Callable
 from copy import deepcopy
 from dataclasses import dataclass, replace
@@ -25,7 +26,6 @@
 from nanobot.utils.helpers import (
     estimate_message_tokens,
     estimate_prompt_tokens_chain,
-    truncate_text,
 )
 from nanobot.utils.runtime import ensure_nonempty_tool_result
 
@@ -40,8 +40,6 @@
     Awaitable[str | None],
 ]
 
-# read_file has its own bound, so its result is not cut to max_tool_result_chars.
-TOOL_RESULT_CUT_EXEMPT_TOOLS = frozenset({"read_file"})
 BACKFILL_CONTENT = "[Tool result unavailable - call was interrupted or lost]"
 # A request is compacted only when it reaches its model's own window, less the room kept for the answer: 20000
 # tokens, or the model's longest answer when that is shorter (opencode's rule, MIT:
@@ -55,6 +53,8 @@
 CLEAR_PROTECT_TOKENS = 40_000
 CLEAR_MINIMUM_TOKENS = 20_000
 CLEARED_TOOL_RESULT = "[Old tool result cleared to save context; call the tool again if you need it.]"
+# The note at the end of a result cut to fit the window (ContextGovernor._cut_note): what was kept, of how much.
+_CUT_NOTE = re.compile(r"\n\n\[Cut here: the first (\d+) of (\d+) characters\. [^\n]*\]\Z")
 PLACEHOLDER_TEXTS = frozenset({
     "[Previous assistant message omitted.]",
 })
@@ -122,7 +122,6 @@ class ContextGovernanceConfig:
     model: str
     tools: ToolRegistry
     session_key: str | None
-    max_tool_result_chars: int
     context_window_tokens: int | None = None
     max_tokens: int | None = None
 
@@ -283,7 +282,9 @@ def prepare_for_model(
         updated = self.strip_malformed_tool_calls(updated)
         updated = self.drop_orphan_tool_results(updated)
         updated = self.backfill_missing_tool_results(updated)
-        return self.apply_tool_result_budget(config, updated)
+        # No result is cut here: a request that does not fit is compacted first, and only then are the results of
+        # its latest round cut to what the window leaves (`fit_latest_round`).
+        return self.ensure_nonempty_results(updated)
 
     def ensure_request_fits(
         self,
@@ -361,7 +362,7 @@ async def _compact_request_history(
         tool_definitions: list[dict[str, Any]] | None,
     ) -> list[dict[str, Any]]:
         """Replace accepted history H with a checkpoint while preserving delta."""
-        measured, _source = pressure
+        measured, source = pressure
         delta_messages = compaction.delta_after_accepted(messages)
         consolidation_prefix = self.prepare_messages_for_model(
             state.config,
@@ -372,12 +373,17 @@ async def _compact_request_history(
             compaction.active_summary,
         )
         if not summary:
-            raise ContextWindowExceededError(
-                session_key=state.config.session_key,
-                estimated_tokens=measured,
-                input_budget=self.input_budget(state.config),
-                source=_source,
-            )
+            # Nothing older to summarize: what is left to give way is the latest round's results, if it has any.
+            current = self.prepare_messages_for_model(state.config, messages)
+            fitted = self.fit_latest_round(state.config, current, tool_definitions)
+            if fitted is current:
+                raise ContextWindowExceededError(
+                    session_key=state.config.session_key,
+                    estimated_tokens=measured,
+                    input_budget=self.input_budget(state.config),
+                    source=source,
+                )
+            return self.ensure_request_fits(state.config, fitted, tool_definitions=tool_definitions)
 
         compaction.active_summary = summary
         # Fresh user input defines the next task. Only ongoing work without
@@ -398,7 +404,7 @@ async def _compact_request_history(
         state.usage = None
         prepared = self.ensure_request_fits(
             state.config,
-            prepared,
+            self.fit_latest_round(state.config, prepared, tool_definitions),
             tool_definitions=tool_definitions,
         )
         compaction.summary_checkpoint = SessionSummaryCheckpoint(
@@ -509,18 +515,75 @@ def clear_old_tool_results(messages: list[dict[str, Any]]) -> list[dict[str, Any
             updated[index] = {**messages[index], "content": CLEARED_TOOL_RESULT}
         return updated
 
+    def result_room(self, config: ContextGovernanceConfig, messages: list[dict[str, Any]]) -> int | None:
+        """The most the content of the last of `messages`, a tool result with none yet, could ever take: the
+        model's prompt budget less what no compaction removes (the system prompt, the tool definitions) and the
+        result's own framing. A result is stored cut there because beyond it nothing of it could reach the model;
+        whether it fits a given request is `fit_latest_round`'s to say, after compaction. None when the window is
+        not know
```

**File**: `invisible_engine_dots/nanobot/agent/runner.py` (modified, +8/-7)
```diff
@@ -79,7 +79,6 @@ class AgentRunSpec:
     tools: ToolRegistry
     runtime: LLMRuntime
     max_iterations: int
-    max_tool_result_chars: int
     # The policy every tool call crosses before it runs: there is no run without one.
     gate: ToolGate
     # The turn's inputs, and how they become the transcript the model reads.
@@ -323,7 +322,6 @@ async def _run_core(
             model=spec.runtime.model,
             tools=spec.tools,
             session_key=spec.session_key,
-            max_tool_result_chars=spec.max_tool_result_chars,
             context_window_tokens=spec.runtime.context_window_tokens,
             max_tokens=spec.runtime.generation.max_tokens,
         )
@@ -417,12 +415,15 @@ async def commit_tool_result(
                         "role": "tool",
                         "tool_call_id": tool_call.id,
                         "name": tool_call.name,
-                        "content": self.context_governor.normalize_tool_result(
-                            governance_config,
-                            tool_call.name,
-                            result,
-                        ),
+                        "content": "",
                     }
+                    # The room is measured with this message in place, so its own framing counts.
+                    tool_message["content"] = self.context_governor.normalize_tool_result(
+                        governance_config,
+                        tool_call.name,
+                        result,
+                        self.context_governor.result_room(governance_config, [*messages, tool_message]),
+                    )
                     if event["status"] == "error":
                         tool_message[METADATA_KEY] = {IS_ERROR: True}
                     await self._commit(spec, messages, tool_message, "tool_result")
```

**File**: `invisible_engine_dots/nanobot/agent/tools/_search_content.py` (modified, +23/-72)
```diff
@@ -1,12 +1,12 @@
-"""Build one bounded grep page from streams of source lines."""
+"""Build one page of grep matches from streams of source lines."""
 
 from __future__ import annotations
 
 import re
 from collections import deque
 from dataclasses import dataclass, field
 from itertools import chain, islice
-from typing import Iterable, Literal
+from typing import Iterable
 
 
 @dataclass(frozen=True, slots=True)
@@ -17,30 +17,9 @@ class SourceLine:
     line_no: int
 
 
-class MatchTooLargeError(ValueError):
-    """A match and its line number cannot fit in an empty page."""
-
-
-def _clip_line(text: str, limit: int, match_start: int | None) -> str:
-    if len(text) <= limit:
-        return text
-    marker = "..."
-    available = limit - len(marker)
-    if match_start is None:
-        return text[:available] + marker
-    start = min(max(0, match_start - available // 3), len(text) - available)
-    end = start + available
-    prefix = marker if start else ""
-    suffix = marker if end < len(text) else ""
-    visible = text[start:end]
-    if prefix and suffix:
-        visible = visible[: available - len(marker)]
-    return prefix + visible + suffix
-
-
-def _format_line(line: SourceLine, start: int | None, limit: int) -> str:
-    marker = ">" if start is not None else " "
-    return f"{marker} {line.line_no}| {_clip_line(line.text, limit, start)}"
+def _format_line(line: SourceLine, is_match: bool) -> str:
+    marker = ">" if is_match else " "
+    return f"{marker} {line.line_no}| {line.text}"
 
 
 def _format_header(path: str, line: SourceLine) -> str:
@@ -53,13 +32,10 @@ class ContentPage:
 
     limit: int | None
     offset: int
-    max_chars: int
-    line_limit: int
     blocks: list[list[str]] = field(default_factory=list, init=False)
     seen: int = field(default=0, init=False)
     returned: int = field(default=0, init=False)
-    chars: int = field(default=0, init=False)
-    stopped: Literal["limit", "size"] | None = field(default=None, init=False)
+    stopped: bool = field(default=False, init=False)
 
     def scan(
         self, path: str, lines: Iterable[SourceLine], regex: re.Pattern[str],
@@ -75,64 +51,39 @@ def scan(
                 self.seen += 1
                 if self.seen > self.offset:
                     if self.limit is not None and self.returned >= self.limit:
-                        self.stopped = "limit"
-                        return
-                    self._append_match(path, history, following, match.start(), positions)
-                    if self.stopped:
+                        self.stopped = True
                         return
+                    self._append_match(path, history, following, positions)
             history.append(following.popleft())
             if (line := next(source, None)) is not None:
                 following.append(line)
 
     def _append_match(
         self, path: str, history: deque[SourceLine],
-        following: deque[SourceLine], start: int, positions: dict[int, int],
+        following: deque[SourceLine], positions: dict[int, int],
     ) -> None:
         match = following[0]
         last_line = next(reversed(positions), 0)
         first_line = history[0] if history else match
         merge = bool(positions and first_line.line_no <= last_line)
-        header = "" if merge else _format_header(path, match)
-        replacement = _format_line(match, start, self.line_limit)
-        additions = [
-            (line.line_no, replacement if line is match else _format_line(line, None, self.line_limit))
-            for line in chain(history, following)
-            if not merge or line.line_no > last_line
-        ]
-        replace_at = positions.get(match.line_no) if merge else None
-        replacement_chars = (
-            len(replacement) - len(self.blocks[-1][replace_at]) if replace_at is not None else 0
-        )
-        header_chars = len(header) + (2 if self.blocks else 0) if not merge else 0
-        added_chars = header_chars + sum(len(text) + 1 for _, text in additions) + replacement_chars
-        if self.chars + added_chars > self.max_chars:
-            self.stopped = "size"
-            if self.blocks:
-                return
-            # Even an oversized first context must return a match and advance the offset.
-            additions = [(match.line_no, replacement)]
-            added_chars = header_chars + len(replacement) + 1
-            if added_chars > self.max_chars:
-                raise MatchTooLargeError("match exceeds output budget; narrow path or pattern")
         if not merge:
-            self.blocks.append([header])
+            self.blocks.append([_format_header(path, match)])
             positions.clear()
         block = self.blocks[-1]
-        if replace_at is not None:
-            block[replace_at] = replacement
-        for line_number, text in additions:
-            positions[line_number] = len(block)
-            block.append(text)
-        self.chars += added
```

**File**: `invisible_engine_dots/nanobot/agent/tools/exec_session.py` (modified, +20/-88)
```diff
@@ -7,7 +7,6 @@
 import shlex
 import time
 import uuid
-from collections import deque
 from contextlib import suppress
 from dataclasses import dataclass
 from typing import TYPE_CHECKING, Any
@@ -34,8 +33,6 @@
 DEFAULT_WAIT_FOR_MS = 10_000
 DEFAULT_UNTIL_EXIT_MS = 600_000
 MAX_WAIT_FOR_MS = 600_000
-DEFAULT_MAX_OUTPUT_CHARS = 10_000
-MAX_OUTPUT_CHARS = 50_000
 OUTPUT_DRAIN_GRACE_S = 0.1
 
 
@@ -156,7 +153,6 @@ class _SessionPoll:
     timed_out: bool = False
     terminated: bool = False
     stdin_closed: bool = False
-    truncated_chars: int = 0
 
 
 @dataclass(slots=True)
@@ -172,65 +168,24 @@ class ExecSessionInfo:
     tty: bool = False
 
 
-class _BoundedOutputBuffer:
-    """Keep the first and most recent characters within a fixed budget."""
+class _OutputBuffer:
+    """What a stream wrote since the last poll, kept whole until the poll drains it."""
 
-    def __init__(self, max_chars: int) -> None:
-        self.max_chars = max_chars
-        self._content = ""
-        self._tail: deque[str] = deque()
-        self._tail_chars = 0
-        self._total_chars = 0
-        self._truncated = False
+    def __init__(self) -> None:
+        self._chunks: list[str] = []
 
     @property
     def has_output(self) -> bool:
-        return self._total_chars > 0
-
-    @property
-    def retained_chars(self) -> int:
-        """How much the buffer holds now: never more than its bound, whatever was appended."""
-        return len(self._content) + self._tail_chars
+        return bool(self._chunks)
 
     def append(self, text: str) -> None:
-        if not text:
-            return
-        self._total_chars += len(text)
-        if not self._truncated:
-            combined = self._content + text
-            if len(combined) <= self.max_chars:
-                self._content = combined
-                return
-            head_chars = self.max_chars // 2
-            tail_chars = self.max_chars - head_chars
-            self._content = combined[:head_chars]
-            self._tail.append(combined[-tail_chars:])
-            self._tail_chars = tail_chars
-            self._truncated = True
-            return
+        if text:
+            self._chunks.append(text)
 
-        tail_chars = self.max_chars - len(self._content)
-        self._tail.append(text)
-        self._tail_chars += len(text)
-        while self._tail_chars > tail_chars:
-            excess = self._tail_chars - tail_chars
-            first = self._tail[0]
-            if len(first) <= excess:
-                self._tail.popleft()
-                self._tail_chars -= len(first)
-            else:
-                self._tail[0] = first[excess:]
-                self._tail_chars -= excess
-
-    def drain(self) -> tuple[str, int]:
-        output = self._content + "".join(self._tail)
-        truncated_chars = self._total_chars - len(output)
-        self._content = ""
-        self._tail.clear()
-        self._tail_chars = 0
-        self._total_chars = 0
-        self._truncated = False
-        return output, truncated_chars
+    def drain(self) -> str:
+        output = "".join(self._chunks)
+        self._chunks.clear()
+        return output
 
 
 class _ExecSession:
@@ -258,8 +213,8 @@ def __init__(
         # timeout None/0 means no limit; an infinite deadline is never reached.
         self.deadline = time.monotonic() + timeout if timeout else float("inf")
         self.last_access = time.monotonic()
-        self._stdout = _BoundedOutputBuffer(MAX_OUTPUT_CHARS)
-        self._stderr = _BoundedOutputBuffer(MAX_OUTPUT_CHARS)
+        self._stdout = _OutputBuffer()
+        self._stderr = _OutputBuffer()
         self._lock = asyncio.Lock()
         self._timed_out = False
         self._kill_task: asyncio.Task[None] | None = None
@@ -284,7 +239,7 @@ async def _watch_timeout(self) -> None:
     async def _read_stream(
         self,
         stream: asyncio.StreamReader | None,
-        buffer: _BoundedOutputBuffer,
+        buffer: _OutputBuffer,
     ) -> None:
         if stream is None:
             return
@@ -322,7 +277,6 @@ async def close_stdin(self) -> str | None:
     async def poll(
         self,
         yield_time_ms: int,
-        max_output_chars: int,
         *,
         terminated: bool = False,
         stdin_closed: bool = False,
@@ -362,8 +316,8 @@ async def poll(
             await self._wait_for_buffered_output()
 
         async with self._lock:
-            stdout, stdout_truncated = self._stdout.drain()
-            stderr, stderr_truncated = self._stderr.drain()
+            stdout = self._stdout.drain()
+            stderr = self._stderr.drain()
             if self.tty:
                 # One stream: the relay reads the terminal's master, so stderr only carries the
                 # relay's own messages, plain text. The stream's end flushes a cut sequence.
@@ -375,17 +329,14 @@ async def poll(
         output_parts = [stdout] if stdout else []
         if stderr:
             output_parts.append(f"STDER
```

---

### Incident Patch 2: `9151ce33` (2026-10-12)
**Commit Message**: docs: the README animation is built from photos in the tree, with new characters

The six hero GIFs were rendered from pages that lived only in a scratch folder, so
changing one character meant editing frames. docs/hero/ now holds every piece, in
three layers, each made from the one before:

  photos/  characters.png as an image model draws it, on white; cut_out.py turns
           it into one cut-out per theme (shadows kept on light, removed on dark,
           and only the white connected to the edge touched, so the eyes stay)
  html/    wide, mobile and small pages that compose the photos; renderLoop(t)
           draws the frame at second t, and opened in a browser each page plays
           its own loop
  build.mjs  photos -> frames (Chromium, 12 a second) -> docs/images/hero-*.gif,
           with the same palette and dither as before

A fourth page, html/social.html, builds docs/images/social-preview.png, the
repository's social preview, from the same photos.

The characters are new: the same four, colours inverted, each with a role it can
carry (a hard hat, sunglasses, a beret, a magnifying glass), all still angry. The
scenes, their words and their timing are unchanged.

**File**: `.gitignore` (modified, +3/-0)
```diff
@@ -30,3 +30,6 @@ vitest-report.json
 # Editor and Python leftovers of the gates
 __pycache__/
 .venv/
+
+# The README animation's frames: docs/hero/build.mjs writes them on every run, from the pages and photos beside it
+/docs/hero/frames/
```

**File**: `docs/hero/README.md` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+# The README animation
+
+The six `docs/images/hero-*.gif` are built from this folder, in three layers, each
+made from the one before:
+
+| layer | where | what it is |
+|---|---|---|
+| photos | `photos/` | the pictures the animation shows |
+| frames | `html/` | one page per layout that composes the photos; `renderLoop(t)` draws the frame at second `t` |
+| GIFs | `docs/images/` | the frames, 12 a second, one palette per loop |
+
+The repository's social preview, `docs/images/social-preview.png`, comes from the
+same photos through one more page, `html/social.html`, as a single frame.
+
+```sh
+node docs/hero/build.mjs              # all six GIFs and the social preview
+node docs/hero/build.mjs wide         # only hero-light.gif and hero-dark.gif
+node docs/hero/build.mjs social       # only the social preview
+```
+
+The social preview is not read from the tree: after a build it is uploaded by hand,
+in the repository's Settings, under Social preview.
+
+It needs the repository's `node_modules` (Playwright comes with `apps/web`), Python
+with Pillow, NumPy and SciPy, and `ffmpeg` on `PATH`. The pages use Segoe UI and
+Consolas, so the GIFs come out identical only on Windows. The frames land in
+`docs/hero/frames/`, which is not tracked.
+
+## The photos
+
+| file | what it is | edit it? |
+|---|---|---|
+| `photos/characters.png` | the four characters on a white background | yes: this is the one to replace |
+| `photos/characters-light.png` | the same, cut out for the light theme, shadows kept | no, `cut_out.py` writes it |
+| `photos/characters-dark.png` | the same, cut out for the dark theme, shadows removed | no, `cut_out.py` writes it |
+| `photos/trending.png` | the GitHub Trending page in the last scene's third card | yes |
+
+New characters are a new `characters.png`, drawn on plain white, all four in one
+row and about the same height. The build cuts them out again on every run.
+
+## The pages
+
+| page | builds | size |
+|---|---|---|
+| `html/wide.html` | `hero-light.gif`, `hero-dark.gif` | 1280 x 470 |
+| `html/mobile.html` | `hero-mobile-light.gif`, `hero-mobile-dark.gif` | 720 x 620 |
+| `html/small.html` | `hero-small-light.gif`, `hero-small-dark.gif` | 720 x 620 |
+| `html/social.html` | `social-preview.png` | 1280 x 640 |
+
+The three animated pages read `?theme=light` or `?theme=dark` and, opened in a browser, play
+the whole loop as the GIF will: the scenes, their words and their timing are all
+in the page. With `&frames` they stay still and wait for `renderLoop(t)`, which is
+how the build takes one frame at a time. A change to a scene is a change to the
+three pages, then a build.
+
+The README picks the GIF by the reader's width and theme, in its `<picture>` at
+the top.
```

**File**: `docs/hero/build.mjs` (added, +97/-0)
```diff
@@ -0,0 +1,97 @@
+// The README animation, rebuilt from its pieces: photos -> frames -> GIFs.
+//
+//   1. photos  cut_out.py turns photos/characters.png into one cut-out per theme
+//   2. frames  each page in html/ composes the photos; renderLoop(t) draws the
+//              frame at second t, and Chromium takes a screenshot of it, 12 a second
+//   3. GIFs    ffmpeg turns each run of frames into docs/images/hero-*.gif
+//
+// html/social.html is a page of one frame: the repository's social preview, written
+// to docs/images/social-preview.png.
+//
+//   node docs/hero/build.mjs                 everything
+//   node docs/hero/build.mjs wide social     only those pieces (wide, mobile, small, social)
+//
+// Needs the repository's node_modules (Playwright comes with apps/web), Python with
+// Pillow, NumPy and SciPy, and ffmpeg on PATH. The pages use Segoe UI and Consolas,
+// so the GIFs come out identical only on Windows.
+import { spawnSync } from "node:child_process";
+import { mkdirSync, rmSync } from "node:fs";
+import { createRequire } from "node:module";
+import path from "node:path";
+import { fileURLToPath, pathToFileURL } from "node:url";
+
+const HERE = path.dirname(fileURLToPath(import.meta.url));
+const ROOT = path.resolve(HERE, "..", "..");
+const { chromium } = createRequire(path.join(ROOT, "package.json"))("@playwright/test");
+
+const FPS = 12;
+const LAYOUTS = {
+  wide: { page: "wide.html", width: 1280, height: 470, gif: "hero" },
+  mobile: { page: "mobile.html", width: 720, height: 620, gif: "hero-mobile" },
+  small: { page: "small.html", width: 720, height: 620, gif: "hero-small" },
+};
+const THEMES = ["light", "dark"];
+// Pictures of one frame. The social preview is uploaded by hand in the repository's
+// Settings, so it is written where it can be found for that.
+const STILLS = {
+  social: { page: "social.html", width: 1280, height: 640, out: "social-preview.png" },
+};
+
+function run(cmd, args) {
+  const r = spawnSync(cmd, args, { stdio: "inherit" });
+  if (r.status !== 0) throw new Error(`${cmd} failed (${r.error ? r.error.message : `exit ${r.status}`})`);
+}
+
+const wanted = process.argv.slice(2);
+const known = [...Object.keys(LAYOUTS), ...Object.keys(STILLS)];
+for (const name of wanted) if (!known.includes(name)) throw new Error(`unknown piece ${name}: ${known.join(", ")}`);
+const layouts = (wanted.length ? wanted : Object.keys(LAYOUTS)).filter((n) => LAYOUTS[n]);
+const stills = (wanted.length ? wanted : Object.keys(STILLS)).filter((n) => STILLS[n]);
+
+// 1. photos
+run(process.platform === "win32" ? "python" : "python3", [path.join(HERE, "cut_out.py")]);
+
+const browser = await chromium.launch();
+try {
+  for (const name of layouts) {
+    const { page: file, width, height, gif } = LAYOUTS[name];
+    for (const theme of THEMES) {
+      // 2. frames
+      const dir = path.join(HERE, "frames", `${name}-${theme}`);
+      rmSync(dir, { recursive: true, force: true });
+      mkdirSync(dir, { recursive: true });
+      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
+      // ?frames stops the page's own playback: every frame is the one renderLoop(t) drew
+      await page.goto(`${pathToFileURL(path.join(HERE, "html", file)).href}?theme=${theme}&frames`);
+      await page.waitForLoadState("load");
+      const seconds = await page.evaluate(() => window.LOOP_SECONDS);
+      const count = Math.round(seconds * FPS);
+      for (let i = 0; i < count; i++) {
+        await page.evaluate((t) => window.renderLoop(t), i / FPS);
+        await page.screenshot({ path: path.join(dir, `f${String(i).padStart(5, "0")}.png`) });
+      }
+      await page.close();
+
+      // 3. GIF: one palette for the whole loop, built from every frame
+      const out = path.join(ROOT, "docs", "images", `${gif}-${theme}.gif`);
+      run("ffmpeg", [
+        "-v", "error", "-y", "-framerate", String(FPS), "-i", path.join(dir, "f%05d.png"),
+        "-vf", "split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle",
+        "-loop", "0", out,
+      ]);
+      console.log(`${path.relative(ROOT, out)}: ${count} frames, ${seconds}s`);
+    }
+  }
+  for (const name of stills) {
+    const { page: file, width, height, out: picture } = STILLS[name];
+    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
+    await page.goto(pathToFileURL(path.join(HERE, "html", file)).href);
+    await page.waitForLoadState("load");
+    const out = path.join(ROOT, "docs", "images", picture);
+    await page.screenshot({ path: out });
+    await page.close();
+    console.log(`${path.relative(ROOT, out)}: ${width}x${height}`);
+  }
+} finally {
+  await browser.close();
+}
```

**File**: `docs/hero/cut_out.py` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+"""photos/characters.png -> photos/characters-light.png and photos/characters-dark.png.
+
+The four characters arrive as one picture on a white background, the way an image
+model draws them. The animation needs them without it, and differently per theme:
+
+  light  only the white connected to the picture's edge turns transparent, through
+         the edge's own shades, so the soft shadows under the feet stay and the
+         fur fades into the page the way it faded into the white;
+  dark   the same, and the pale grey of those shadows goes too, since a light
+         shadow on a dark page reads as a stain.
+
+Only background CONNECTED TO THE EDGE is touched: the whites of the eyes and a lens
+are as white as the background and stay opaque. Both outputs are cropped to the
+characters, so the pages size them by width alone.
+
+    python docs/hero/cut_out.py
+"""
+from pathlib import Path
+
+import numpy as np
+from PIL import Image
+from scipy import ndimage
+
+HERE = Path(__file__).parent
+SRC = HERE / "photos" / "characters.png"
+
+#: How far from pure white a pixel may be and still be background (0-255, on the
+#: channel furthest from white). Covers the paper-white of the picture and its
+#: anti-aliased edge; fur is far past it.
+PALE = 60
+#: A pale pixel with less colour than this is a shadow, not fur fading into white.
+GREY = 18
+#: How many pixels past the background the fur still carries some of its white.
+BAND = 3
+#: How far from pure white the paper may be: within this it is no picture at all.
+PAPER = 6
+
+
+def cut(rgb: np.ndarray, keep_shadows: bool) -> np.ndarray:
+    a = rgb.astype(np.float64)
+    far = (255.0 - a).max(axis=2)                     # 0 = pure white
+    spread = a.max(axis=2) - a.min(axis=2)            # 0 = no colour at all
+    labels, _ = ndimage.label(far <= PALE)
+    edge = np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))
+    bg = np.isin(labels, edge[edge > 0])
+    # The fur's outermost pixels are part fur, part white, and past PALE: left
+    # opaque they draw a thin light outline on a dark page. They are the band just
+    # outside the background, and colour to alpha is exact for them too.
+    band = ndimage.binary_dilation(bg, iterations=BAND)
+
+    # Colour to alpha against white: the least alpha that explains the pixel as
+    # some colour over white, and that colour with the white taken out.
+    alpha = np.where(band, far / 255.0, 1.0)
+    # The paper itself is not pure white (an image model draws it at 253-254), and
+    # colour to alpha turns that into an opacity of 1 or 2 out of 255 with made-up
+    # colours: a faint box around the characters on any page that is not white.
+    alpha = np.where(bg & (far <= PAPER), 0.0, alpha)
+    if not keep_shadows:
+        alpha = np.where(bg & (spread < GREY), 0.0, alpha)
+    safe = np.maximum(alpha, 1e-6)[..., None]
+    colour = np.where(band[..., None], 255.0 - (255.0 - a) / safe, a)
+    out = np.dstack([np.clip(colour, 0, 255), alpha * 255.0]).round().astype(np.uint8)
+    out[out[..., 3] == 0, :3] = 0
+    return out
+
+
+def box(rgba: np.ndarray, margin: int = 8) -> tuple:
+    """The characters' bounding box. ONE box for both themes: cropped apart, the
+    light one (shadows included) would be taller, and at the same width on the
+    page the characters would change size between the two themes."""
+    ys, xs = np.nonzero(rgba[..., 3] > 8)
+    return (max(0, ys.min() - margin), min(rgba.shape[0], ys.max() + margin + 1),
+            max(0, xs.min() - margin), min(rgba.shape[1], xs.max() + margin + 1))
+
+
+def main() -> None:
+    rgb = np.asarray(Image.open(SRC).convert("RGB"))
+    cuts = {"light": cut(rgb, keep_shadows=True), "dark": cut(rgb, keep_shadows=False)}
+    y0, y1, x0, x1 = box(cuts["light"])
+    for theme, rgba in cuts.items():
+        out = rgba[y0:y1, x0:x1]
+        path = HERE / "photos" / f"characters-{theme}.png"
+        Image.fromarray(out, "RGBA").save(path, optimize=True)
+        print(f"{path.name}: {out.shape[1]}x{out.shape[0]}")
+
+
+if __name__ == "__main__":
+    main()
```

**File**: `docs/hero/html/mobile.html` (added, +225/-0)
```diff
@@ -0,0 +1,225 @@
+<!doctype html>
+<html>
+<head>
+<meta charset="utf-8">
+<style>
+  /* The phone version: 720x760, shown about 324-350 px wide, so nothing is smaller than 28 px here (~13 px there). */
+  :root.light { --bg:#ffffff; --card:#ffffff; --line:#d0d7de; --ink:#1f2328; --muted:#59636e; --green:#1a7f37; --bubble:#eef1f4;
+                --detail:#f6f8fa; --primary:#1f2328; --primary-ink:#ffffff; }
+  :root.dark  { --bg:#0d1117; --card:#161b22; --line:#30363d; --ink:#e6edf3; --muted:#8d96a0; --green:#3fb950; --bubble:#21262d;
+                --detail:#0d1117; --primary:#e6edf3; --primary-ink:#0d1117; }
+  * { box-sizing:border-box; margin:0; padding:0; }
+  html, body { width:720px; height:620px; overflow:hidden; background:var(--bg); font-family:"Segoe UI", system-ui, sans-serif; color:var(--ink); }
+  .abs { position:absolute; }
+  .card { background:var(--card); border:2px solid var(--line); border-radius:24px; }
+  #name { left:0; width:720px; top:150px; text-align:center; font-size:100px; font-weight:800; letter-spacing:-.01em; }
+  #tag { display:none; left:40px; width:640px; top:190px; text-align:center; font-size:33px; font-weight:700; color:var(--muted); line-height:1.3; }
+  #four { left:80px; width:560px; top:300px; }
+  #green { display:none; left:0; width:720px; top:338px; text-align:center; font-size:33px; font-weight:800; color:var(--green); }
+  #head { left:40px; top:34px; width:640px; }
+  #step { font-size:28px; font-weight:800; color:var(--green); letter-spacing:.05em; }
+  #line { font-size:52px; font-weight:800; line-height:1.12; margin-top:10px; }
+  #chat { left:40px; top:156px; width:640px; height:440px; }
+  #bubble { right:26px; top:30px; width:520px; background:var(--bubble); border-radius:22px; padding:22px 26px; font-size:32px; font-weight:600; line-height:1.35; }
+  #composer { left:24px; right:24px; bottom:24px; min-height:84px; border:2px solid var(--line); border-radius:18px; padding:18px 22px; font-size:30px; font-weight:600; line-height:1.3; }
+  #thinking { left:26px; top:250px; font-size:30px; font-weight:600; color:var(--muted); }
+  .caret { display:inline-block; width:3px; height:32px; background:var(--ink); vertical-align:-6px; margin-left:2px; }
+  #computer { left:30px; top:150px; width:660px; height:400px; overflow:hidden; }
+  #computer .bar { height:52px; display:flex; align-items:center; padding:0 22px; border-bottom:2px solid var(--line); font-size:28px; font-weight:700; color:var(--muted); }
+  #screen { left:14px; top:66px; width:628px; height:320px; border-radius:12px; overflow:hidden; border:2px solid var(--line); background:#fff; }
+  #screen img { width:150%; margin-left:-25%; }
+  #badge { left:60px; top:540px; width:600px; text-align:center; background:var(--card); border:3px solid var(--green); color:var(--green); padding:12px 0; border-radius:999px; font-size:30px; font-weight:800; }
+  #approval { left:40px; top:170px; width:640px; padding:34px 34px; }
+  #approval .what { font-size:42px; font-weight:800; }
+  #approval .detail { margin-top:20px; font-size:32px; font-weight:600; background:var(--detail); border:2px solid var(--line); border-radius:16px; padding:20px 24px; line-height:1.35; }
+  #approval .btns { display:flex; gap:20px; margin-top:28px; }
+  .btn { flex:1; text-align:center; padding:18px 0; border-radius:16px; font-size:32px; font-weight:800; border:2px solid var(--line); }
+  .btn.primary { background:var(--primary); color:var(--primary-ink); border-color:var(--primary); }
+  #ripple { width:24px; height:24px; border-radius:50%; border:4px solid var(--ink); }
+  .msg { position:absolute; left:40px; width:600px; background:#182533; border-radius:24px 24px 24px 8px; padding:20px 26px; font-size:30px; line-height:1.35; color:#e9eef3; font-weight:600; }
+  .msg b { color:#7cc4ff; }
+  .msg .t { display:block; text-align:right; font-size:28px; color:#8fa3b6; margin-top:6px; }
+  #cursor { width:40px; height:40px; }
+</style>
+</head>
+<body>
+<div id="head" class="abs"><div id="step"></div><div id="line"></div></div>
+
+<div id="chat" class="abs card">
+  <div id="bubble" class="abs"></div>
+  <div id="thinking" class="abs">Thinking...</div>
+  <div id="composer" class="abs"><span id="typed"></span><span class="caret" id="caret"></span></div>
+</div>
+
+<div id="computer" class="abs card">
+  <div class="bar">its computer · Firefox</div>
+  <div id="screen" class="abs"><img src="../photos/trending.png"></div>
+</div>
+<div id="badge" class="abs">built to be undetectable by anti-bots</div>
+
+<div id="approval" class="abs card">
+  <div class="what">Add an automation?</div>
+  <div class="detail">Monthly: the shop's invoices, the total to Telegram</div>
+  <div class="btns"><div class="btn primary" id="allow">Allow</div><div class="btn">Reject</div></div>
+</div>
+<div id="ripple" class="abs"></div>
+
+<div class="msg" id="m1"></div><div class="msg" id="m2"></div>
+
+<svg id="cursor" class="abs" viewBox="0 0 22 22"><path d="M
```

**File**: `docs/hero/html/small.html` (added, +226/-0)
```diff
@@ -0,0 +1,226 @@
+<!doctype html>
+<html>
+<head>
+<meta charset="utf-8">
+<style>
+  /* The phone version: 720x760, shown about 324-350 px wide, so nothing is smaller than 28 px here (~13 px there). */
+  :root.light { --bg:#ffffff; --card:#ffffff; --line:#d0d7de; --ink:#1f2328; --muted:#59636e; --green:#1a7f37; --bubble:#eef1f4;
+                --detail:#f6f8fa; --primary:#1f2328; --primary-ink:#ffffff; }
+  :root.dark  { --bg:#0d1117; --card:#161b22; --line:#30363d; --ink:#e6edf3; --muted:#8d96a0; --green:#3fb950; --bubble:#21262d;
+                --detail:#0d1117; --primary:#e6edf3; --primary-ink:#0d1117; }
+  * { box-sizing:border-box; margin:0; padding:0; }
+  html, body { width:720px; height:620px; overflow:hidden; background:var(--bg); font-family:"Segoe UI", system-ui, sans-serif; color:var(--ink); }
+  .abs { position:absolute; }
+  .card { background:var(--card); border:2px solid var(--line); border-radius:24px; }
+  #name { left:0; width:720px; top:150px; text-align:center; font-size:100px; font-weight:800; letter-spacing:-.01em; }
+  #tag { display:none; left:40px; width:640px; top:190px; text-align:center; font-size:33px; font-weight:700; color:var(--muted); line-height:1.3; }
+  #four { left:80px; width:560px; top:300px; }
+  #green { display:none; left:0; width:720px; top:338px; text-align:center; font-size:33px; font-weight:800; color:var(--green); }
+  #head { left:40px; top:24px; width:640px; }
+  #step { font-size:36px; font-weight:800; color:var(--green); letter-spacing:.05em; }
+  #line { font-size:52px; font-weight:800; line-height:1.12; margin-top:4px; }
+  #chat { left:40px; top:156px; width:640px; height:440px; }
+  #bubble { right:24px; top:26px; width:560px; background:var(--bubble); border-radius:22px; padding:20px 24px; font-size:37px; font-weight:600; line-height:1.35; }
+  #composer { left:24px; right:24px; bottom:24px; min-height:84px; border:2px solid var(--line); border-radius:18px; padding:16px 20px; font-size:36px; font-weight:600; line-height:1.3; }
+  #thinking { left:26px; top:300px; font-size:36px; font-weight:600; color:var(--muted); }
+  .caret { display:inline-block; width:3px; height:32px; background:var(--ink); vertical-align:-6px; margin-left:2px; }
+  #computer { left:30px; top:150px; width:660px; height:400px; overflow:hidden; }
+  #computer .bar { height:52px; display:flex; align-items:center; padding:0 22px; border-bottom:2px solid var(--line); font-size:28px; font-weight:700; color:var(--muted); }
+  #screen { left:14px; top:66px; width:628px; height:320px; border-radius:12px; overflow:hidden; border:2px solid var(--line); background:#fff; }
+  #screen img { width:150%; margin-left:-25%; }
+  #badge { left:60px; top:540px; width:600px; text-align:center; background:var(--card); border:3px solid var(--green); color:var(--green); padding:12px 0; border-radius:999px; font-size:30px; font-weight:800; }
+  #approval { left:40px; top:160px; width:640px; padding:28px 30px; }
+  #approval .what { font-size:42px; font-weight:800; }
+  #approval .detail { margin-top:18px; font-size:37px; font-weight:600; background:var(--detail); border:2px solid var(--line); border-radius:16px; padding:20px 24px; line-height:1.35; }
+  #approval .btns { display:flex; gap:20px; margin-top:22px; }
+  .btn { flex:1; text-align:center; padding:14px 0; border-radius:16px; font-size:38px; font-weight:800; border:2px solid var(--line); }
+  .btn.primary { background:var(--primary); color:var(--primary-ink); border-color:var(--primary); }
+  #ripple { width:24px; height:24px; border-radius:50%; border:4px solid var(--ink); }
+  .msg { position:absolute; left:40px; width:640px; background:#182533; border-radius:24px 24px 24px 8px; padding:18px 24px; font-size:36px; line-height:1.35; color:#e9eef3; font-weight:600; }
+  .msg b { color:#7cc4ff; }
+  .msg .t { display:block; text-align:right; font-size:35px; color:#8fa3b6; margin-top:6px; }
+  #cursor { width:40px; height:40px; }
+</style>
+</head>
+<body>
+<div id="head" class="abs"><div id="step"></div><div id="line"></div></div>
+
+<div id="chat" class="abs card">
+  <div id="bubble" class="abs"></div>
+  <div id="thinking" class="abs">Thinking...</div>
+  <div id="composer" class="abs"><span id="typed"></span><span class="caret" id="caret"></span></div>
+</div>
+
+<div id="computer" class="abs card">
+  <div class="bar">its computer · Firefox</div>
+  <div id="screen" class="abs"><img src="../photos/trending.png"></div>
+</div>
+<div id="badge" class="abs">built to be undetectable by anti-bots</div>
+
+<div id="approval" class="abs card">
+  <div class="what">Add an automation?</div>
+  <div class="detail">Monthly: the shop's invoices, the total to Telegram</div>
+  <div class="btns"><div class="btn primary" id="allow">Allow</div><div class="btn">Reject</div></div>
+</div>
+<div id="ripple" class="abs"></div>
+
+<div class="msg" id="m1"></div><div class="msg" id="m2"></div>
+
+<svg id="cursor" class="abs" viewBox="0 0 22 22"><path d="M2
```

**File**: `docs/hero/html/social.html` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+<!doctype html>
+<html lang="en">
+<head>
+<meta charset="utf-8">
+<title>invisible_dots social preview</title>
+<style>
+  /* The repository's social preview, 1280 x 640: the picture GitHub, X and chat apps
+     show beside a link to the repository. It is uploaded by hand in the repository's
+     Settings, so build.mjs writes it to docs/images/social-preview.png for that. */
+  html, body { margin: 0; }
+  body { width: 1280px; height: 640px; overflow: hidden; position: relative;
+         background: #fafaf9; font-family: "Segoe UI", system-ui, sans-serif; color: #171717; }
+  .abs { position: absolute; }
+  #dots { left: 64px; top: 46px; display: flex; gap: 9px; }
+  #dots i { width: 21px; height: 21px; border-radius: 50%; background: #171717; }
+  #dots i:last-child { background: #c8c8c6; }
+  #name { left: 64px; top: 86px; font-size: 80px; font-weight: 700; line-height: 1; }
+  #line { left: 64px; top: 189px; font-size: 28px; font-weight: 700; line-height: 1.2; }
+  #green { left: 64px; top: 230px; font-size: 25px; font-weight: 700; line-height: 1.2; color: #16803d; }
+  #four { left: 160px; width: 960px; bottom: 11px; }
+</style>
+</head>
+<body>
+  <div id="dots" class="abs"><i></i><i></i><i></i></div>
+  <div id="name" class="abs">invisible_dots</div>
+  <div id="line" class="abs">Open-source, self-hosted alternative to OpenAI Dots, Manus, Claude Cowork &amp; co.</div>
+  <div id="green" class="abs">AI agents with a computer of their own. Built to be undetectable by anti-bots.</div>
+  <img id="four" class="abs" src="../photos/characters-light.png" alt="">
+</body>
+</html>
```

**File**: `docs/hero/html/wide.html` (added, +288/-0)
```diff
@@ -0,0 +1,288 @@
+<!doctype html>
+<html>
+<head>
+<meta charset="utf-8">
+<style>
+  /* GitHub's own page colours, so the first and last frame sit on the page with no box: ?theme=light|dark */
+  :root.light { --bg:#ffffff; --card:#ffffff; --line:#d0d7de; --ink:#1f2328; --muted:#59636e; --green:#1a7f37; --bubble:#eef1f4;
+                --shadow:0 18px 50px rgba(31,35,40,.14); --detail:#f6f8fa; --primary:#1f2328; --primary-ink:#ffffff; }
+  :root.dark  { --bg:#0d1117; --card:#161b22; --line:#30363d; --ink:#e6edf3; --muted:#8d96a0; --green:#3fb950; --bubble:#21262d;
+                --shadow:0 24px 60px rgba(0,0,0,.55); --detail:#0d1117; --primary:#e6edf3; --primary-ink:#0d1117; }
+  * { box-sizing:border-box; margin:0; padding:0; }
+  html, body { width:1280px; height:470px; overflow:hidden; background:var(--bg); font-family:"Segoe UI", system-ui, sans-serif; color:var(--ink); }
+  .abs { position:absolute; }
+  .card { background:var(--card); border:1px solid var(--line); border-radius:16px; box-shadow:var(--shadow); }
+  .avatar { width:32px; height:32px; border-radius:50%; border:2px solid #e8a33d; display:flex; align-items:center; justify-content:center; font-size:14px; font-weight:600; }
+  /* the logo card */
+  #logo { inset:0; }
+  #name { left:0; width:1280px; top:84px; text-align:center; font-size:96px; font-weight:800; letter-spacing:-.01em; }
+  #tag { display:none; left:0; width:1280px; top:176px; text-align:center; font-size:23px; font-weight:600; color:var(--muted); }
+  #four { left:320px; width:640px; top:206px; }
+  /* the scenes */
+  #brand { left:56px; top:22px; display:flex; align-items:center; gap:9px; font-size:20px; font-weight:700; }
+  .dot { width:11px; height:11px; border-radius:50%; background:var(--ink); display:inline-block; }
+  .dot.dim { background:var(--line); }
+  #caption { left:56px; top:96px; width:446px; }
+  #step { font-size:20px; font-weight:700; color:var(--green); letter-spacing:.05em; margin-bottom:12px; }
+  #line { font-size:46px; font-weight:800; line-height:1.18; }
+  #sub { font-size:24px; font-weight:600; color:var(--muted); margin-top:14px; line-height:1.45; }
+  #chat { left:520px; top:36px; width:690px; height:396px; }
+  #chat .head { height:56px; border-bottom:1px solid var(--line); display:flex; align-items:center; gap:12px; padding:0 20px; font-weight:600; font-size:19px; }
+  #bubble { right:22px; top:76px; max-width:480px; background:var(--bubble); border-radius:14px; padding:14px 18px; font-size:21px; line-height:1.45; }
+  #thinking { left:22px; top:210px; display:flex; align-items:center; gap:10px; font-size:20px; color:var(--muted); }
+  #composer { left:18px; right:18px; bottom:18px; height:50px; border:1px solid var(--line); border-radius:12px; padding:12px 16px; font-size:20px; }
+  .caret { display:inline-block; width:2px; height:19px; background:var(--ink); vertical-align:-4px; margin-left:1px; }
+  #computer { left:540px; top:30px; width:680px; height:404px; overflow:hidden; }
+  #computer .bar { height:38px; display:flex; align-items:center; gap:8px; padding:0 14px; border-bottom:1px solid var(--line); font-size:17px; color:var(--muted); }
+  .light-dot { width:11px; height:11px; border-radius:50%; background:var(--line); }
+  #screen { left:12px; top:50px; width:656px; height:342px; border-radius:8px; overflow:hidden; background:#fff; border:1px solid var(--line); }
+  #screen img { width:100%; }
+  #badge { left:880px; top:414px; display:flex; align-items:center; gap:10px; background:var(--card); border:1px solid var(--green); color:var(--green); padding:10px 18px; border-radius:999px; font-size:20px; font-weight:700; box-shadow:var(--shadow); }
+  #approval { left:560px; top:90px; width:600px; padding:24px 26px; }
+  #approval .who { font-size:19px; color:var(--muted); }
+  #approval .what { font-size:30px; font-weight:800; margin-top:6px; }
+  #approval .detail { margin-top:14px; font-size:21px; background:var(--detail); border:1px solid var(--line); border-radius:10px; padding:13px 15px; line-height:1.5; }
+  #approval .btns { display:flex; gap:12px; margin-top:20px; }
+  .btn { padding:12px 22px; border-radius:10px; font-size:20px; font-weight:600; border:1px solid var(--line); }
+  .btn.primary { background:var(--primary); color:var(--primary-ink); border-color:var(--primary); }
+  #ripple { width:16px; height:16px; border-radius:50%; border:3px solid var(--ink); }
+  #phone { left:820px; top:8px; width:330px; height:454px; border-radius:38px; background:#0e1621; border:10px solid #1c1c22; overflow:hidden; }
+  #phone .top { height:60px; background:#17212b; display:flex; align-items:center; gap:12px; padding:0 16px; font-weight:600; font-size:19px; color:#e9eef3; }
+  #phone .clock { position:absolute; right:16px; top:19px; font-size:19px; color:#9fb3c8; font-weight:600; }
+  .msg { position:absolute; left:12px; right:22px; background:#182533; border-radius:14px 14px 14px 4px; padding:11px 14px; font-size:20px; line-height:1.
```

---

### Incident Patch 3: `fe03ee63` (2026-10-12)
**Commit Message**: floors: the engine suite at the 2493 tests CI measured on this branch

**File**: `.github/test-floors.json` (modified, +1/-1)
```diff
@@ -16,7 +16,7 @@
     "win32": { "min_passed": 70, "allow_skipped": "^agentd (TestSystemRoute|TestPowerOffStartsTheCommandAndAnswers202)$" }
   },
   "pytest": {
-    "linux": { "min_passed": 2483, "allow_skipped": "" }
+    "linux": { "min_passed": 2493, "allow_skipped": "" }
   },
   "playwright": {
     "linux": { "min_passed": 88, "allow_skipped": "" },
```

#### Recent Merged Pull Requests:
- **PR #1458** (closed): feat: suggest current MiniMax models through OpenRouter (@octo-patch)
- **PR #1456** (2026-11-04): guest: install.sh alone starts the Dot's units, after the VM proxy (@feder-cr)
- **PR #1455** (closed): browser: every Dot follows the newest release, and install.sh alone starts the Dot's units (@feder-cr)
- **PR #1454** (2026-10-15): browser: never pinned; the image takes the newest release and the engine reads the server it finds (@feder-cr)
- **PR #1450** (2026-10-13): image: the browser is invisible-playwright-mcp 0.72.2 (invisible-playwright 0.35.7, invisible-core 45.39.0, firefox-45) (@feder-cr)
- **PR #1448** (2026-10-12): engine: no fixed cap on a tool's result; the cut and the routing follow the model's window, read from OpenRouter on every turn (@feder-cr)

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

## X. engine: no fixed cap on a tool's result; the cut is the model's window, read fro

**RULE**:
When implementing operations in `docs/architecture.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in feder-cr/Jobs_Applier_AI_Agent_AIHawk. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `440e43a1`: engine: no fixed cap on a tool's result; the cut is the model's window, read from OpenRouter on every turn. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/architecture.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
the gate and never run, and the model gets the error. A result comes back
whole: no tool has a fixed cap. A request that outgrows the model's window is
compacted first (old results cleared, then the history summarized, section
8.5); only if it still does not fit are the results of its latest round cut,
to what the window leaves (`ContextGovernor.fit_latest_round`), and the cut says
how many characters came through of how many and how to ask for less. A result
is stored cut only beyond what no compaction could make room for: the window
less the system prompt and the tool definitions.
Every request uses the whole of what its model can do. The engine reads the
model's limits at the start of every turn from the providers OpenRouter lists
for it (`GET /models/{model}/endpoints`), not once: an engine runs for weeks and
OpenRouter changes a model's providers meanwhile. Of the providers serving it,
the widest window and the longest answer at that window are the model's. A
model OpenRouter does not know fails the turn in words; a router, which lists
no provider, gets no limits. Each request
attempts, honouring `Retry-After`). A tool result is cut only where the
model's window ends (section 
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
the gate and never run, and the model gets the error. A result longer than
12000 characters is cut, once.
Every request uses the whole of what its model can do. The engine reads each
model's limits once from OpenRouter's list of models (`GET /models`): the
context window and the longest answer of the provider OpenRouter routes the
model to by default (`top_provider`). A model OpenRouter does not list fails
the turn in words; a router that publishes no limits gets none. Each request
attempts, honouring `Retry-After`). Tool results longer than 12000 characters
are cut with a marker.
  step limit, the 12000-character
  result cap, and the Dot's section of
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `440e43a1` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.
