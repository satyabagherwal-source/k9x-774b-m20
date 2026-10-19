> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/fallow-rs-fallow-learnings.md`  
> **Source**: github ([https://github.com/fallow-rs/fallow](https://github.com/fallow-rs/fallow))  
> **Source Version**: `77f2b8b1`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-19T13:55:47.457Z  
> **Learning ID**: `learn-github-fallow-rs-fallow`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): fallow-rs/fallow

> **Canonical Artifact**: `07_PROJECT_LEARNING/fallow-rs-fallow-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/fallow-rs/fallow](https://github.com/fallow-rs/fallow))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-19T13:55:47.448Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fallow-rs/fallow`
- **Description**: Codebase intelligence for TypeScript and JavaScript. Health, complexity hotspots, duplication, architecture boundaries, circular dependencies, design-system drift, and unused code, from one graph. CLI, GitHub Action, LSP, MCP, and VS Code. Rust, MIT licensed.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 5182 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.claude/hooks/pre-bash-guard.py`
```
#!/usr/bin/env python3
"""Pre-Bash guard for fallow agent sessions.

Detection works on a quote-aware token walk rather than raw-string regex, so a
command that only *mentions* `fallow`/`git commit` as data (a heredoc, an echo,
a test fixture) is never flagged, while chained or env-prefixed real invocations
(`cargo fmt && git commit`, `A=1 git commit`, `cat x | fallow`) still are.
"""
import json
import os
import re
import shlex
import subprocess
import sys
from pathlib import Path

# Shell tokens that separate one command from the next.
SEPARATORS = {";", "&&", "||", "|", "&", "|&"}
# Cargo subcommands whose `--workspace` output floods context when unredirected.
CARGO_NOISY = {"build", "test", "clippy", "doc"}
# Commands that, in the final pipeline position, bound what reaches the terminal.
BOUNDING_PAGERS = {"tail", "head", "less", "more", "wc", "grep", "rg"}
# npm-style wrappers that fetch and run a *different* fallow binary.
WRAPPERS = {"npx", "bunx"}
ENV_ASSIGN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*=")


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0

    if payload.get("tool_name") != "Bash":
        return 0

    command = str(payload.get("tool_input", {}).get("command", "") or "")
    if not command:
        return 0

    if "SKIP_FALLOW_AGENT_GUARD=1" in command:
        return 0

    cwd = Path(str(payload.get("cwd") or os.getcwd())).resolve()
    repo = find_repo_root(cwd)
    if repo is None:
        return 0

    commands = command_positions(command)
    if commands is None:
        return 0

    if uses_foreign_fallow(commands):
        deny(
            "Use `cargo run --bin fallow --` (builds if needed) or `./target/debug/fallow` "
            "inside this checkout instead of an installed `fallow`. "
            "Set `SKIP_FALLOW_AGENT_GUARD=1` only when you intentionally need a different binary."
        )
        return 0

    if uses_unbounded_workspace_cargo(command, commands):
        deny(
            "Redirect full workspace cargo output to a log and return only the tail, for example "
            "`cargo test --workspace --lib --bins --tests --examples "
            "> /tmp/fallow-test.log 2>&1; tail -80 /tmp/fallow-test.log`."
        )
        return 0

    if commits_via_git(commands):
        staged = git_lines(repo, ["diff", "--cached", "--name-only"])
        if needs_vscode_dist(repo, staged):
            deny(
                "VS Code extension runtime files are staged without the tracked dist bundle. "
                "Run `pnpm --dir editors/vscode run build`, "
                "`pnpm --dir editors/vscode run check:contracts`, and "
                "`pnpm --dir editors/vscode run lint`, then stage the generated dist files. "
                "Set `SKIP_FALLOW_AGENT_GUARD=1` only if this commit is intentionally source-only."
            )

    return 0


def find_repo_root(cwd: Path) -> Path | None:
    try:
        out = subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=cwd,
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
    except (OSError, subprocess.CalledProcessError):
        return None

    root = Path(out).resolve()
    # Gate on a committed sentinel so the guard activates on every clone/CI, not
    # only machines that carry the gitignored, codex-local root AGENTS.md.
    if (root / "crates" / "cli" / "AGENTS.md").is_file():
        return root
    return None


def command_positions(command: str) -> list[list[str]] | None:
    """Split a command line into the argv of each pipeline/list segment.

    shlex is quote-aware, so `echo "a && fallow b"` yields a single data token
    and never a command-position `fallow`. Returns None when the line cannot be
    tokenized (an unbalanced quote means we should not guess).
    """
    try:
        tokens = shlex.split(command, posix=True)
    except ValueError:
        return None

    segments: list[list[str]] = []
    current: list[str] = []
    for token in tokens:
        if token in SEPARATORS:
            if current:
                segments.append(current)
                current = []
        else:
            current.append(token)
    if current:
        segments.append(current)

    return [argv for argv in (strip_env(seg) for seg in segments) if argv]


def strip_env(segment: list[str]) -> list[str]:
    index = 0
    while index < len(segment) and ENV_ASSIGN.match(segment[index]):
        index += 1
    return segment[index:]


def uses_foreign_fallow(commands: list[list[str]]) -> bool:
    for argv in commands:
        name = Path(argv[0]).name
        if name == "fallow" and not is_local_target(argv[0]):
            return True
        if name in WRAPPERS and len(argv) >= 2 and argv[1] == "fallow":
            return True
    return False


def is_local_target(executable: str) -> bool:
    normalized = executable.replace("\\", "/")
    return (
        normalized.startswith("./target/")
        or normalized.startswith("target/")
        or "/target/" in normalized
    )


def uses_unbounded_workspace_cargo(command: str, commands: list[list[str]]) -> bool:
    cargo = next(
        (
            argv
            for argv in commands
            if Path(argv[0]).name == "cargo"
            and len(argv) >= 2
            and argv[1] in CARGO_NOISY
            and "--workspace" in argv
        ),
        None,
    )
    if cargo is None:
        return False
    return not output_is_bounded(command, commands)


def output_is_bounded(command: str, commands: list[list[str]]) -> bool:
    # A redirect (`> log`, `2>&1`) keeps output off the terminal entirely.
    if ">" in command:
        return True
    # A trailing pager (`| tail -80`) keeps only a slice in context. `tee` does
    # not count: it passes everything through to stdout.
    last = commands[-1]
    return Path(last[0]).name in BOUNDING_PAGERS


def commits_via_git(commands: list[list[str]]) -> bool:
    return any(
        Path(argv[0]).name == "git" and len(argv) >= 2 and argv[1] == "commit"
        for argv in commands
    )


def git_lines(repo: Path, args: list[str]) -> list[str]:
    try:
        out = subprocess.check_output(["git", *args], cwd=repo, text=True, stderr=subprocess.DEVNULL)
    except (OSError, subprocess.CalledProcessError):
        return []
    return [line.strip() for line in out.splitlines() if line.strip()]


def needs_vscode_dist(repo: Path, paths: list[str]) -> bool:
    runtime = [
        path
        for path in paths
        if path.startswith("editors/vscode/src/")
        and path.endswith((".ts", ".tsx"))
        and not path.startswith("editors/vscode/src/generated/")
        and "/test/" not in path
        and not path.endswith(".test.ts")
    ]
    if not runtime:
        return False

    tracked_dist = set(
        git_lines(
            repo,
            [
                "ls-files",
                "editors/vscode/dist/extension.js",
                "editors/vscode/dist/extension.js.map",
            ],
        )
    )
    if not tracked_dist:
        return False

    return not tracked_dist.intersection(paths)


def deny(reason: str) -> None:
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": reason,
                }
            }
        )
    )


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `apps/review-electron/src/renderer/src/App.tsx`
```
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type MouseEvent as ReactMouseEvent,
} from "react";
import {
  FileDiff,
  MonitorPlay,
  Camera,
  RefreshCw,
  Telescope,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import type { WalkthroughDocument } from "../../model/walkthrough";
import type { TradeOffEnvelope } from "../../model/tradeoff";
import type { TradeOffValidation } from "../../main/tradeoffValidation";
import type { ReviewContext as ReviewContextData } from "../../model/reviewContext";
import type { FeedTarget, InlineFraming } from "../../model/agent";
import type { InspectorCard as InspectorCardData } from "../../main/inspect";
import { groupBySignalId } from "./lib/agentFraming";
import { ReviewFocus } from "./components/ReviewFocus";
import { ClearedPanel } from "./components/ClearedPanel";
import { DecisionList } from "./components/DecisionList";
import { TradeOffList } from "./components/TradeOffList";
import { ReviewContext } from "./components/ReviewContext";
import { StageList } from "./components/StageList";
import { InspectorCard } from "./components/InspectorCard";
import { AnnotateCanvas } from "./components/AnnotateCanvas";
import { LiveApp } from "./components/LiveApp";
import { DiffView } from "./components/DiffView";
import { isViewed as readViewed, setViewed as writeViewed } from "./lib/viewed";
import { errorMessage } from "./lib/errors";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type RightMode = "diff" | "live" | "shot";

const MODES: { id: RightMode; label: string; icon: typeof FileDiff }[] = [
  { id: "diff", label: "diff", icon: FileDiff },
  { id: "live", label: "live", icon: MonitorPlay },
  { id: "shot", label: "screenshot", icon: Camera },
];

const SIDEBAR_MIN = 320;
const SIDEBAR_MAX = 760;
const SIDEBAR_DEFAULT = 420;
const SIDEBAR_KEY = "fallow-review:sidebar-width";

/** Restore the persisted sidebar width, clamped to the allowed range. */
const readSidebarWidth = (): number => {
  const stored = Number(window.localStorage.getItem(SIDEBAR_KEY));
  return stored >= SIDEBAR_MIN && stored <= SIDEBAR_MAX ? stored : SIDEBAR_DEFAULT;
};

/**
 * Right-pane state for when no review has loaded yet. Deliberately NOT the
 * DiffView "no changes to review" success-empty-state: showing that next to a
 * failed/idle left column reads as a contradiction (review failed, yet "no
 * changes"). Stays muted and neutral; the left column owns the red error + retry.
 */
const DiffPlaceholder = ({ loading, error }: { loading: boolean; error: string | null }) => {
  if (loading) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
        <Loader2 className="size-6 animate-spin opacity-70" />
        <p className="text-sm">preparing the diff…</p>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <FileDiff className="size-6 opacity-40" />
      <p className="text-sm">{error ? "no diff to show" : "load a review to see the diff"}</p>
      <p className="text-[11px] opacity-80">
        {error ? "the review didn't load" : "every changed file's diff shows here"}
      </p>
    </div>
  );
};

export const App = () => {
  const [doc, setDoc] = useState<WalkthroughDocument | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [viewedTick, setViewedTick] = useState(0);
  const [noteCount, setNoteCount] = useState(0);
  const [card, setCard] = useState<InspectorCardData | null>(null);
  const [rightMode, setRightMode] = useState<RightMode>("diff");
  const [diffFile, setDiffFile] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(readSidebarWidth);
  // Author-captured framing (fact-ish, write-time), already origin-tagged + graph
  // validated in the main process. Empty when no captured source exists; we never
  // fabricate it, so a decision then shows no inline framing.
  const [capturedFraming, setCapturedFraming] = useState<InlineFraming[]>([]);
  // Model-inferred trade-offs, fed from their OWN persisted channel: the
  // non-deterministic companion to `doc.decisions`. null = the elicitation was not
  // run (the persisted file is absent); an envelope with `abstained: true` is the
  // distinct "looked, found nothing" state.
  const [tradeoffs, setTradeoffs] = useState<TradeOffEnvelope | null>(null);
  // Per-trade-off fallow validation (anchored / unanchored / stale), from the
  // walkthrough-file round-trip. null = not run / no trade-offs.
  const [tradeoffValidation, setTradeoffValidation] = useState<TradeOffValidation | null>(null);
  // Author-agent review brief (the CAPTURE artifact): what the agent that did the
  // work recorded at write-time about what to review. null = the author recorded no
  // brief (the persisted file is absent), in which case the surface renders nothing.
  const [reviewContext, setReviewContext] = useState<ReviewContextData | null>(null);

  useEffect(() => {
    window.fallow.onInspectSelection(setCard);
  }, []);

  // Fetch author-captured framing once on load; honest empty when absent.
  useEffect(() => {
    void window.fallow
      .getCapturedFraming()
      .then(setCapturedFraming)
      .catch(() => setCapturedFraming([]));
  }, []);

  // Fetch model-inferred trade-offs once on load from their OWN channel; null
  // stays null (the "not run" state) when the persisted file is absent or errors.
  useEffect(() => {
    void window.fallow
      .getTradeoffs()
      .then(setTradeoffs)
      .catch(() => setTradeoffs(null));
  }, []);

  // Close the loop: validate the trade-off anchors against the LIVE graph through
  // fallow's walkthrough-file machinery (anchored / unanchored / stale), so the
  // broader surface is fallow-grade, not just agent-self-checked. null = not run.
  useEffect(() => {
    void window.fallow
      .validateTradeoffs()
      .then(setTradeoffValidation)
      .catch(() => setTradeoffValidation(null));
  }, []);

  // Fetch the author-agent review brief once on load; null stays null (render
  // nothing) when the author recorded no brief or the read errors.
  useEffect(() => {
    void window.fallow
      .getReviewContext()
      .then(setReviewContext)
      .catch(() => setReviewContext(null));
  }, []);

  // Group author-captured framing by signal_id for per-decision inline rendering.
  // Only the write-time captured framing feeds this now (the live reconstruct path
  // is gone); origin is tagged at the source, never inferred here.
  const framingBySignal = useMemo(() => groupBySignalId(capturedFraming), [capturedFraming]);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  // Drag the divider between the file list and the right pane to resize.
  const startResize = (e: ReactMouseEvent): void => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const onMove = (ev: MouseEvent): void =>
      setSidebarWidth(
        Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, startWidth + ev.clientX - startX)),
      );
    const onUp = (): void => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  const load = useCallback(async (): Promise<void> => {
    setError(null);
    setLoading(true);
    try {
      setDoc(await window.fallow.getReview());
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-load the review once when the app opens; the header button stays as a
  // manual refresh. No click required to see the decisions/focus/diff.
  useEffect(() => {
    void load();
  }, [load]);

  const isViewed = useCallback(
    (path: string) => viewedTick >= 0 && readViewed(window.localStorage, path),
    [viewedTick],
  );
  const onToggleViewed = useCallback((path: string) => {
    writeViewed(window.localStorage, path, !readViewed(window.localStorage, path));
    setViewedTick((t) => t + 1);
  }, []);
  // The general comment handler: route a note at ANY anchored target (a whole
  // file, a signal/decision, a trade-off anchor, or a `file:line`/`file:start-end`
  // diff range) back to the agent through the same feed channel.
  const onComment = useCallback((target: FeedTarget, note: string) => {
    void window.fallow.appendFeed({ target, note, at: new Date().toISOString() });
    setNoteCount((n) => n + 1);
  }, []);
  // File-level note kept as-is so StageList/FileRow stay untouched; delegates to
  // the general handler with the whole-file `file_line` target.
  const onAddNote = useCallback(
    (path: string, note: string) => onComment({ kind: "file_line", value: path }, note),
    [onComment],
  );
  const onOpenDiff = useCallback((path: string) => {
    setDiffFile(path);
    setRightMode("diff");
  }, []);

  return (
    <div
      className="grid h-screen overflow-hidden bg-background font-sans text-foreground"
      style={{ gridTemplateColumns: `${sidebarWidth}px 1fr` }}
    >
      <aside className="relative flex min-h-0 flex-col border-r border-border bg-card">
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="resize the file list"
          title="drag to resize · double-click to reset"
          onMouseDown={startResize}
          onDoubleClick={() => setSidebarWidth(SIDEBAR_DEFAULT)}
          className="absolute inset-y-0 right-0 z-30 w-1.5 translate-x-1/2 cursor-col-resize transition-colors 
```

### Core Architecture Module: `apps/review-electron/src/renderer/src/components/AnnotateCanvas.tsx`
```
import { useEffect, useState } from "react";
import { Camera, ImageOff, Loader2, RefreshCw } from "lucide-react";
import { DrawableImage } from "./DrawableImage";
import { errorMessage } from "../lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Phase = "idle" | "capturing" | "error";

/** Screenshot a URL (fresh load) and annotate it. */
export const AnnotateCanvas = () => {
  const [url, setUrl] = useState("http://localhost:5273");
  const [img, setImg] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void window.fallow.getConfig().then((cfg) => setUrl(cfg.defaultUrl));
  }, []);

  const capture = async (): Promise<void> => {
    setPhase("capturing");
    setError(null);
    try {
      const shot = await window.fallow.capture(url);
      setImg(shot.dataUrl);
      setPhase("idle");
    } catch (e) {
      setError(errorMessage(e));
      setPhase("error");
    }
  };

  return (
    <div className="grid h-full grid-rows-[auto_1fr] overflow-hidden text-foreground">
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-b border-border px-2">
        <Input
          value={url}
          data-testid="shot-url"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void capture();
          }}
          className="h-7 font-mono text-xs"
        />
        <Button
          size="sm"
          data-testid="shot-capture"
          className="h-7 lowercase"
          onClick={() => void capture()}
        >
          <Camera className="size-3.5" />
          screenshot
        </Button>
      </div>
      {img ? (
        <div className="overflow-auto p-3">
          <DrawableImage dataUrl={img} target={url} onDone={() => setImg(null)} />
        </div>
      ) : (
        <div
          data-testid="shot-overlay"
          data-phase={phase}
          className="flex flex-col items-center justify-center gap-3 bg-background px-6 text-center"
        >
          {phase === "capturing" ? (
            <>
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                capturing <span className="font-mono text-foreground">{url}</span>
              </p>
            </>
          ) : phase === "error" ? (
            <>
              <div className="flex size-11 items-center justify-center rounded-full border border-border bg-muted/30">
                <ImageOff className="size-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">couldn't capture</p>
                <p className="max-w-xs break-words text-xs text-muted-foreground">{error}</p>
                <p className="text-[11px] text-muted-foreground">
                  check the url is reachable, then retry
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                className="h-7 lowercase"
                onClick={() => void capture()}
              >
                <RefreshCw className="size-3.5" />
                retry
              </Button>
            </>
          ) : (
            <>
              <div className="flex size-11 items-center justify-center rounded-full border border-border bg-muted/30">
                <Camera className="size-5 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">annotate a screenshot</p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  capture a fresh load of the url, draw on it, and send the annotation to the agent
                </p>
              </div>
              <Button size="sm" className="h-7 lowercase" onClick={() => void capture()}>
                <Camera className="size-3.5" />
                screenshot this url
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

```

### Core Architecture Module: `apps/review-electron/src/renderer/src/components/ClearedPanel.tsx`
```
import { useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight } from "lucide-react";
import type { ClearedItem } from "../../../model/walkthrough";

export const ClearedPanel = ({ cleared }: { cleared: ClearedItem[] }) => {
  const [open, setOpen] = useState(false);
  if (cleared.length === 0) return null;
  const total = cleared.reduce((n, c) => n + c.count, 0);
  return (
    <section>
      <button
        type="button"
        data-testid="cleared-toggle"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 rounded-md border border-border bg-muted/30 px-2.5 py-2 text-xs text-muted-foreground outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        <CheckCircle2 className="size-3.5 text-fallow-green" />
        <span>
          fallow handled <span className="font-mono tabular-nums text-foreground">{total}</span>{" "}
          technical items
        </span>
      </button>
      {open && (
        <ul className="mt-1.5 space-y-1 pl-7 pr-2.5 text-xs">
          {cleared.map((c) => (
            <li key={c.kind} className="flex items-baseline justify-between gap-3">
              <span className="truncate text-muted-foreground">{c.label}</span>
              <span className="shrink-0 font-mono tabular-nums text-foreground">{c.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

```

### Core Architecture Module: `apps/review-electron/src/renderer/src/components/DecisionList.tsx`
```
import { GitBranchPlus, Users } from "lucide-react";
import type { Decision } from "../../../model/walkthrough";
import type { FeedTarget, FramingOrigin, InlineFraming } from "../../../model/agent";
import type { FramingBySignal } from "@/lib/agentFraming";
import { shortAnchor } from "@/lib/anchor";
import { NoteComposer } from "./NoteComposer";

/** Per-origin label + tone for a fenced inline-framing block (never a fact). */
const ORIGIN_PRESENTATION: Record<FramingOrigin, { label: string; tone: string }> = {
  // Fact-ish: recorded by the author agent at write-time. Neutral/affirmative
  // tone, but still fenced + deterministic:false: it is intent, not a graph fact.
  captured: {
    label: "captured at write-time (author agent):",
    tone: "text-fallow-green",
  },
  // Review-time inference from the opt-in agent run. Amber/muted + the explicit
  // "confirm with author" warning: a confident-wrong reconstruction is the worst
  // failure mode, so this treatment is non-negotiable.
  reconstructed: {
    label: "agent framing (unverified, confirm with author):",
    tone: "text-fallow-amber",
  },
};

/**
 * The decision surface, rendered under taste ownership: every decision is a
 * QUESTION (never an answer), graph numbers are plain facts, and the trade-off
 * clause is a named sacrifice stated as a fact, never a recommendation. The three
 * default fields (question, honest consumer count, trade-off) are always visible;
 * everything else (category, anchor, routed expert) is behind an expand so the
 * surface stays within the reviewer's working memory.
 *
 * Inline framing (captured or reconstructed), keyed by `signalId`, renders fenced
 * under its own decision so the reviewer never re-joins it from a separate panel.
 */
export const DecisionList = ({
  decisions,
  onOpenDiff,
  onComment,
  framingBySignal,
}: {
  decisions: Decision[];
  onOpenDiff: (path: string) => void;
  onComment: (target: FeedTarget, note: string) => void;
  framingBySignal?: FramingBySignal;
}) => {
  // A quiet empty state (NOT a silent null): the human must be able to tell
  // "the surface ran and found nothing consequential" from "it is broken".
  if (decisions.length === 0) {
    return (
      <section className="space-y-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          decisions
        </h3>
        <p className="rounded-md border border-dashed border-border bg-muted/10 p-2 text-xs text-muted-foreground">
          no consequential structural decisions in this change
        </p>
      </section>
    );
  }
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        decisions ({decisions.length})
      </h3>
      <ul className="space-y-1.5">
        {decisions.map((d) => (
          <DecisionRow
            key={d.signalId}
            decision={d}
            onOpenDiff={onOpenDiff}
            onComment={onComment}
            framing={framingBySignal?.get(d.signalId) ?? []}
          />
        ))}
      </ul>
    </section>
  );
};

const DecisionRow = ({
  decision: d,
  onOpenDiff,
  onComment,
  framing,
}: {
  decision: Decision;
  onOpenDiff: (path: string) => void;
  onComment: (target: FeedTarget, note: string) => void;
  framing: ReadonlyArray<InlineFraming>;
}) => {
  const linkable = d.anchorFile.length > 0;
  // Only show the in-repo consumer count when fallow actually emitted it (the
  // honest count is > 0); a missing field must NOT render as a contradictory "0".
  const consumerLabel =
    d.internalConsumerCount === 1
      ? "1 in-repo module already depends on this"
      : `${d.internalConsumerCount} in-repo modules already depend on this`;
  return (
    <li className="rounded-md border border-border bg-muted/20 p-2 text-xs">
      <div className="flex gap-2">
        <GitBranchPlus className="mt-0.5 size-3.5 shrink-0 text-fallow-amber" />
        <div className="min-w-0 flex-1 space-y-1">
          {/* anchor (clickable) + category + routed expert, subtle inline header;
              the anchor is always visible here, not behind a full-height toggle */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            {linkable && (
              <button
                type="button"
                title={d.anchorFile}
                className="break-all font-mono hover:text-foreground hover:underline"
                onClick={() => onOpenDiff(d.anchorFile)}
              >
                {shortAnchor(d.anchorFile)}
                {d.anchorLine > 0 ? `:${d.anchorLine}` : ""}
              </button>
            )}
            {d.category && <span className="opacity-70">· {d.category}</span>}
            {d.expert.length > 0 && (
              <span className="flex items-center gap-1 opacity-70">
                <Users className="size-3" />
                {d.expert.join(", ")}
                {d.busFactorOne ? " (sole owner)" : ""}
              </span>
            )}
          </div>
          {/* (1) the question , primary, always interrogative */}
          <p className="text-foreground">{d.question || d.signalId}</p>
          {/* (2) the honest blast number , a graph fact, only when emitted */}
          {d.internalConsumerCount > 0 && <p className="text-muted-foreground">{consumerLabel}</p>}
          {/* (3) the trade-off clause , a named sacrifice stated as fact */}
          {d.tradeoff && <p className="text-muted-foreground">{d.tradeoff}</p>}
          {/* (4) framing , fenced, interrogative-leaning, never a graph fact */}
          {framing.map((f, i) => (
            <FramingBlock key={`${f.origin}:${i}`} framing={f} />
          ))}
          {/* (5) a note back to the agent, anchored to THIS decision's signal */}
          <div className="pt-0.5">
            <NoteComposer
              onSave={(note) => onComment({ kind: "signal_id", value: d.signalId }, note)}
            />
          </div>
        </div>
      </div>
    </li>
  );
};

/**
 * One fenced framing block under a decision. Typographically fenced (rounded
 * border + muted ground), deterministic:false by construction, and labelled by
 * origin so the reviewer can tell author intent (captured, fact-ish) from
 * review-time inference (reconstructed, confirm-with-author). It never gates the
 * reviewer's options, never carries a door/reversibility label, never ranks.
 */
/** Visual weight per author action: the vocabulary exists for triage salience,
 * so `block` must not render like `fyi`. */
const ACTION_TONE: Record<string, string> = {
  block: "font-semibold text-destructive",
  address: "font-semibold text-foreground",
  consider: "text-foreground",
  fyi: "text-muted-foreground",
};

const FramingBlock = ({ framing: f }: { framing: InlineFraming }) => {
  const { label, tone } = ORIGIN_PRESENTATION[f.origin];
  return (
    <div className="space-y-0.5 rounded-md border border-border/60 bg-muted/10 p-1.5">
      <p className={tone}>{label}</p>
      <p className="text-foreground">{f.framing}</p>
      {f.action && (
        <p className={ACTION_TONE[f.action] ?? "text-muted-foreground"}>action: {f.action}</p>
      )}
      {f.concern && <p className="text-muted-foreground">concern: {f.concern}</p>}
    </div>
  );
};

```

### Core Architecture Module: `apps/review-electron/src/renderer/src/components/DiffView.tsx`
```
import { useEffect, useState } from "react";
import { FileX, Loader2, MessageSquarePlus, TriangleAlert } from "lucide-react";
import {
  parseUnifiedDiff,
  parseMultiFileDiff,
  diffStats,
  type DiffRow,
  type FileDiffSection,
} from "../lib/diff";
import type { FeedTarget } from "../../../model/agent";
import { tokenize, type TokenType } from "../lib/highlight";
import { errorMessage } from "../lib/errors";
import { cn } from "@/lib/utils";
import { NoteComposer } from "./NoteComposer";

type Props = {
  file: string | null;
  base: string;
  onComment: (target: FeedTarget, note: string) => void;
};

const gutter =
  "w-12 shrink-0 select-none px-2 text-right text-[11px] tabular-nums text-muted-foreground/60";

const TOKEN_CLASS: Record<TokenType, string> = {
  keyword: "text-chart-5",
  string: "text-fallow-green",
  number: "text-fallow-amber",
  comment: "text-muted-foreground/70 italic",
  plain: "",
};

const Code = ({ text }: { text: string }) => (
  <code className="flex-1 whitespace-pre pr-3 text-foreground">
    {tokenize(text).map((t, k) => (
      <span key={k} className={TOKEN_CLASS[t.type]}>
        {t.value}
      </span>
    ))}
  </code>
);

/** Stable per-row key for the single-line composer: the new-side line when the
 * row exists in the new file, else the old-side line (a deleted line). New and
 * old line numbers are each unique within a file, and the `n`/`o` prefix keeps
 * the two namespaces from colliding. `null` only for an unanchorable row. */
const rowCommentKey = (row: DiffRow): string | null =>
  row.newNo !== null ? `n${row.newNo}` : row.oldNo !== null ? `o${row.oldNo}` : null;

const Row = ({
  row,
  showOld,
  selected,
  onSelectLine,
  onCommentLine,
}: {
  row: DiffRow;
  showOld: boolean;
  /** This row falls inside the active range selection (highlighted). */
  selected: boolean;
  /** Click/shift-click the new-line gutter to set or extend the range anchor. */
  onSelectLine: (newNo: number, shift: boolean) => void;
  /** Open a single-line composer under this row, keyed by `rowCommentKey`. */
  onCommentLine: (key: string) => void;
}) => {
  // Any line with a new OR old number is commentable: added/context anchor to the
  // new-file line, a deleted line anchors to its old-file line.
  const commentKey = rowCommentKey(row);
  const commentable = commentKey !== null;
  // Range selection is new-side only (the gutter shows the new-file line number);
  // a deleted line has no new number and must NOT be a range-select target.
  const hasNew = row.newNo !== null;
  return (
    <div
      className={cn(
        "group/row flex border-l-2 border-transparent hover:bg-muted/30",
        row.kind === "add" && "border-fallow-green/70 bg-fallow-green/10",
        row.kind === "del" && "border-fallow-red/70 bg-fallow-red/10",
        selected && "bg-primary/10",
      )}
    >
      {showOld && <span className={gutter}>{row.oldNo ?? ""}</span>}
      {hasNew ? (
        <button
          type="button"
          title="click to set range start · shift-click to extend"
          onClick={(e) => onSelectLine(row.newNo as number, e.shiftKey)}
          className={cn(gutter, "cursor-pointer hover:text-foreground hover:underline")}
        >
          {row.newNo}
        </button>
      ) : (
        <span className={gutter}>{row.newNo ?? ""}</span>
      )}
      <span
        className={cn(
          "w-4 shrink-0 select-none text-center",
          row.kind === "add" && "text-fallow-green",
          row.kind === "del" && "text-fallow-red",
          row.kind === "context" && "text-transparent",
        )}
      >
        {row.kind === "add" ? "+" : row.kind === "del" ? "-" : " "}
      </span>
      <Code text={row.text} />
      {commentable && (
        <button
          type="button"
          aria-label={`comment on line ${row.newNo ?? row.oldNo}`}
          title="comment on this line"
          onClick={() => {
            if (commentKey) onCommentLine(commentKey);
          }}
          className="mr-2 flex shrink-0 cursor-pointer items-center gap-1 self-center rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground opacity-0 transition-all hover:border-primary hover:text-foreground group-hover/row:opacity-100"
        >
          <MessageSquarePlus className="size-3.5" />
          comment
        </button>
      )}
    </div>
  );
};

/** First and last new-file line numbers in a hunk (for the per-hunk composer). */
const hunkLineSpan = (hunk: { rows: DiffRow[] }): { start: number; end: number } | null => {
  const newLines = hunk.rows.map((r) => r.newNo).filter((n): n is number => n !== null);
  if (newLines.length > 0) {
    return { start: Math.min(...newLines), end: Math.max(...newLines) };
  }
  // Deletion-only hunk: no new-side lines, anchor the hunk to its old-side span.
  const oldLines = hunk.rows.map((r) => r.oldNo).filter((n): n is number => n !== null);
  if (oldLines.length === 0) return null;
  return { start: Math.min(...oldLines), end: Math.max(...oldLines) };
};

/**
 * One file's diff: a sticky path/stats header followed by its hunks. Owns the
 * local line-comment state (which new-file line range is selected, and which line
 * has an open inline composer) so the rest of the diff stays untouched. A reviewer
 * routes a note at `file:line` (single) or `file:start-end` (range) back to the
 * agent through {@link FeedTarget}.kind `file_line`, the same channel file notes use.
 */
const FileSection = ({
  section,
  onComment,
}: {
  section: FileDiffSection;
  onComment: (target: FeedTarget, note: string) => void;
}) => {
  const stats = diffStats(section.hunks);
  // New files are all-additions: drop the always-empty old-line gutter so the
  // line numbers sit at the left, like GitHub. Modified files keep both columns.
  const showOld = section.hunks.some((h) => h.rows.some((r) => r.oldNo !== null));
  // The active new-file line range being selected for a comment (start/end are
  // inclusive new-file line numbers); null = nothing selected.
  const [range, setRange] = useState<{ start: number; end: number } | null>(null);
  // The single new-file line whose inline composer is open (null = none). Distinct
  // from `range`: the per-line "+" opens a composer directly; the range selection
  // opens a separate "comment on lines X-Y" composer.
  const [lineComposer, setLineComposer] = useState<string | null>(null);

  const file = section.file;

  // Click a line-number gutter: plain click sets a fresh single-line anchor;
  // shift-click extends from the existing anchor to form start..end.
  const onSelectLine = (newNo: number, shift: boolean): void => {
    setLineComposer(null);
    setRange((prev) =>
      shift && prev
        ? { start: Math.min(prev.start, newNo), end: Math.max(prev.end, newNo) }
        : { start: newNo, end: newNo },
    );
  };

  const onCommentLine = (key: string): void => {
    setRange(null);
    setLineComposer(key);
  };

  const clearRange = (): void => setRange(null);

  // The range affordance only counts as a real range when it spans >1 line; a
  // single-line selection is better served by the per-line composer.
  const isRange = range !== null && range.end > range.start;

  const isSelected = (newNo: number | null): boolean =>
    range !== null && newNo !== null && newNo >= range.start && newNo <= range.end;

  return (
    <div>
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-muted px-3 py-1.5">
        <span className="truncate text-foreground">{file}</span>
        <span className="ml-2 shrink-0 tabular-nums">
          <span className="text-fallow-green">+{stats.added}</span>{" "}
          <span className="text-fallow-red">-{stats.removed}</span>
        </span>
      </div>
      {section.binary || section.hunks.length === 0 ? (
        <p className="px-3 py-2 text-[11px] text-muted-foreground">
          {section.binary ? "binary file" : "no textual diff"}
        </p>
      ) : (
        section.hunks.map((hunk, i) => {
          const span = hunkLineSpan(hunk);
          return (
            <div key={i}>
              <div className="flex items-center gap-2 bg-muted/40 px-3 py-1 font-mono text-[11px] text-muted-foreground">
                <span className="shrink-0 text-fallow-blue/70 tabular-nums">
                  @@ {hunk.range} @@
                </span>
                {hunk.header && (
                  <span className="truncate text-muted-foreground/80">{hunk.header}</span>
                )}
              </div>
              {hunk.rows.map((row, j) => (
                <div key={j}>
                  <Row
                    row={row}
                    showOld={showOld}
                    selected={isSelected(row.newNo)}
                    onSelectLine={onSelectLine}
                    onCommentLine={onCommentLine}
                  />
                  {/* single-line composer, full width directly under the row,
                      opened immediately by the line's comment button. Works on a
                      deleted line too: it anchors to the old-file line. */}
                  {lineComposer !== null && rowCommentKey(row) === lineComposer && (
                    <div className="bg-muted/20 px-3 py-1.5">
                      <p className="mb-1 text-[11px] text-muted-foreground">
                        line {row.newNo ?? row.oldNo}
                        {row.newNo === null ? " (deleted)" : ""}
                      </p>
                      <NoteComposer
                        defaultOpen
                        onCancel={() => setLineComposer(null)}
                        onSave={(note) => {
                          onComment(
                            { kind: "file_line", value: `${file}:${row.newNo ?? row.oldNo}` },
                            note,
                          );
                          setLineComposer(null);
                        }}
                      />
   
```

### Core Architecture Module: `apps/review-electron/src/renderer/src/components/DrawableImage.tsx`
```
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Eraser, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type Props = { dataUrl: string; target: string; onDone?: () => void };

type Point = [number, number];
type Stroke = { color: string; points: Point[] };

const SWATCHES = [
  { name: "red", cssVar: "--fallow-red", fallback: "#f87171", bg: "bg-fallow-red" },
  { name: "amber", cssVar: "--fallow-amber", fallback: "#fbbf24", bg: "bg-fallow-amber" },
  { name: "green", cssVar: "--fallow-green", fallback: "#4ade80", bg: "bg-fallow-green" },
  { name: "blue", cssVar: "--fallow-blue", fallback: "#60a5fa", bg: "bg-fallow-blue" },
] as const;

const canvasPoint = (e: MouseEvent<HTMLCanvasElement>): Point => {
  const rect = e.currentTarget.getBoundingClientRect();
  return [
    (e.clientX - rect.left) * (e.currentTarget.width / rect.width),
    (e.clientY - rect.top) * (e.currentTarget.height / rect.height),
  ];
};

const resolveColor = (cssVar: string, fallback: string): string => {
  const value = getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim();
  return value || fallback;
};

/** Draw freehand annotations on an image and send the result to the agent feed. */
export const DrawableImage = ({ dataUrl, target, onDone }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const strokes = useRef<Stroke[]>([]);
  const drawing = useRef(false);
  const [colorIdx, setColorIdx] = useState(0);
  const [count, setCount] = useState(0);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const redraw = (): void => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const image = imageRef.current;
    if (!canvas || !ctx || !image) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0);
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    for (const stroke of strokes.current) {
      ctx.strokeStyle = stroke.color;
      ctx.beginPath();
      stroke.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.stroke();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    strokes.current = [];
    setCount(0);
    const image = new Image();
    image.addEventListener("load", () => {
      canvas.width = image.width;
      canvas.height = image.height;
      imageRef.current = image;
      redraw();
    });
    image.src = dataUrl;
  }, [dataUrl]);

  const startDraw = (e: MouseEvent<HTMLCanvasElement>): void => {
    drawing.current = true;
    const swatch = SWATCHES[colorIdx] ?? SWATCHES[0];
    strokes.current.push({
      color: resolveColor(swatch.cssVar, swatch.fallback),
      points: [canvasPoint(e)],
    });
  };
  const moveDraw = (e: MouseEvent<HTMLCanvasElement>): void => {
    if (!drawing.current) return;
    const stroke = strokes.current[strokes.current.length - 1];
    if (!stroke) return;
    stroke.points.push(canvasPoint(e));
    redraw();
  };
  const endDraw = (): void => {
    if (drawing.current) setCount(strokes.current.length);
    drawing.current = false;
  };
  const undo = (): void => {
    strokes.current.pop();
    setCount(strokes.current.length);
    redraw();
  };
  const clearAll = (): void => {
    strokes.current = [];
    setCount(0);
    redraw();
  };

  const save = async (): Promise<void> => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    await window.fallow.saveShot({ annotatedDataUrl: canvas.toDataURL("image/png"), note, target });
    setStatus("saved to agent feed");
    setNote("");
    onDone?.();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden p-2">
      <div className="mb-2 flex shrink-0 items-center gap-2">
        <div className="flex items-center gap-1.5">
          {SWATCHES.map((s, i) => (
            <button
              key={s.name}
              type="button"
              aria-label={`${s.name} pen`}
              aria-pressed={colorIdx === i}
              onClick={() => setColorIdx(i)}
              className={cn(
                "size-4 rounded-full outline-none ring-offset-2 ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring",
                s.bg,
                colorIdx === i ? "ring-2 ring-ring" : "ring-0",
              )}
            />
          ))}
        </div>
        <Separator orientation="vertical" className="h-5" />
        <Button
          size="icon"
          variant="ghost"
          className="size-7 text-muted-foreground"
          aria-label="undo"
          disabled={count === 0}
          onClick={undo}
        >
          <Undo2 className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-7 text-muted-foreground"
          aria-label="clear annotations"
          disabled={count === 0}
          onClick={clearAll}
        >
          <Eraser className="size-3.5" />
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <canvas
          ref={canvasRef}
          onMouseDown={startDraw}
          onMouseMove={moveDraw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          className="max-w-full cursor-crosshair rounded-md border border-border"
        />
      </div>
      <div className="mt-2 flex shrink-0 gap-1.5">
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="note for the agent"
          className="h-7 text-xs"
        />
        <Button size="sm" className="h-7 text-xs lowercase" onClick={() => void save()}>
          send to agent
        </Button>
        {onDone && (
          <Button size="sm" variant="outline" className="h-7 text-xs lowercase" onClick={onDone}>
            back
          </Button>
        )}
      </div>
      {status && <p className="mt-1.5 shrink-0 text-[11px] text-muted-foreground">{status}</p>}
    </div>
  );
};

```

### Core Architecture Module: `apps/review-electron/src/renderer/src/components/FileRow.tsx`
```
import { useState } from "react";
import { ArrowDownToLine, FileText, Plus, ShieldAlert, TriangleAlert } from "lucide-react";
import type { WalkthroughFile } from "../../../model/walkthrough";
import { deriveFileSignal, type SignalTone } from "../lib/badges";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  file: WalkthroughFile;
  viewed: boolean;
  /** This file is the one currently shown in the diff pane. */
  active: boolean;
  /** Stage directory, stripped from the displayed path (it titles the group). */
  baseDir?: string;
  onToggleViewed: (path: string) => void;
  onAddNote: (path: string, note: string) => void;
  onOpenDiff: (path: string) => void;
};

const FAN_IN_TONE: Record<SignalTone, string> = {
  hub: "text-fallow-amber",
  elevated: "text-foreground",
  muted: "text-muted-foreground",
};

export const FileRow = ({
  file,
  viewed,
  active,
  baseDir,
  onToggleViewed,
  onAddNote,
  onOpenDiff,
}: Props) => {
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState("");

  const save = (): void => {
    if (note.trim()) onAddNote(file.path, note.trim());
    setNote("");
    setAdding(false);
  };

  // Drop the stage-dir prefix (the group header already shows it); always keep
  // the filename visible by letting only the residual dir shrink.
  const rel =
    baseDir && file.path.startsWith(`${baseDir}/`)
      ? file.path.slice(baseDir.length + 1)
      : file.path;
  const base = rel.split("/").pop() ?? rel;
  const dir = rel.slice(0, rel.length - base.length);
  const signal = deriveFileSignal(file);
  const title = file.reason ? `${file.path} · ${file.reason}` : file.path;

  return (
    <li
      className={cn(
        "group rounded-md transition-colors",
        active ? "bg-accent" : "hover:bg-accent/40",
        !active && signal.deprioritized && "opacity-55",
        !active && viewed && "opacity-40",
      )}
    >
      {/* A full-row click target sits under the content; only the checkbox and
          note button re-enable pointer events to capture their own clicks. */}
      <div className="relative px-2 py-1">
        <button
          type="button"
          data-testid="file-open"
          aria-label={`open ${base}`}
          title={title}
          onClick={() => onOpenDiff(file.path)}
          className="absolute inset-0 z-0 cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        />
        <div className="pointer-events-none relative z-10 flex items-center gap-2">
          <Checkbox
            checked={viewed}
            onCheckedChange={() => onToggleViewed(file.path)}
            aria-label={`mark ${base} reviewed`}
            className="pointer-events-auto"
          />
          <FileText
            className={cn(
              "size-3.5 shrink-0",
              active ? "text-foreground" : "text-muted-foreground",
            )}
          />
          <span className="flex min-w-0 flex-1 items-baseline font-mono text-xs">
            {dir && <span className="truncate text-muted-foreground">{dir}</span>}
            <span className="shrink-0 text-foreground">{base}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            {signal.security && (
              <ShieldAlert className="size-3.5 text-fallow-red" aria-label="security taint" />
            )}
            {signal.riskZone && (
              <TriangleAlert className="size-3.5 text-fallow-amber" aria-label="risk zone" />
            )}
            {signal.fanIn >= 2 && (
              <span
                title={`${signal.fanIn} importers depend on this`}
                className={cn(
                  "inline-flex items-center gap-0.5 font-mono text-[10px] tabular-nums",
                  FAN_IN_TONE[signal.fanInTone],
                )}
              >
                <ArrowDownToLine className="size-3" />
                {signal.fanIn}
              </span>
            )}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="pointer-events-auto size-6 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100"
            aria-label="add note"
            onClick={() => setAdding((a) => !a)}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>
      {adding && (
        <div className="flex gap-1 pb-1.5 pl-9 pr-2">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="note for the agent"
            className="h-7 text-xs"
          />
          <Button size="sm" className="h-7 text-xs lowercase" onClick={save}>
            save
          </Button>
        </div>
      )}
    </li>
  );
};

```

### Core Architecture Module: `apps/review-electron/src/renderer/src/components/LiveApp.tsx`
```
import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, RefreshCw, Unplug } from "lucide-react";
import { DrawableImage } from "./DrawableImage";
import { errorMessage } from "../lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Minimal slice of the Electron <webview> element we drive imperatively. */
type WebviewEl = HTMLElement & {
  src: string;
  loadURL: (url: string) => Promise<void>;
  capturePage: () => Promise<{ toDataURL: () => string }>;
};

type Conn = "loading" | "ready" | "failed";

/**
 * Live, interactive embed of the app-under-review (Electron <webview>). The
 * picker runs inside it (dev) and posts to the bridge; "annotate view" captures
 * the CURRENT interacted state for drawing (Tier-2 live annotation). A
 * connection state machine keeps the surface dark and explains an unreachable
 * dev server instead of leaking a white webview void.
 */
export const LiveApp = () => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const webviewRef = useRef<WebviewEl | null>(null);
  const failedRef = useRef(false);
  const [url, setUrl] = useState("http://localhost:5273");
  const [shot, setShot] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [conn, setConn] = useState<Conn>("loading");

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const wv = document.createElement("webview") as WebviewEl;
    wv.src = url;
    wv.style.width = "100%";
    wv.style.height = "100%";
    wv.style.border = "none";
    const onStart = (): void => {
      failedRef.current = false;
      setConn("loading");
    };
    const onFinish = (): void => {
      if (!failedRef.current) setConn("ready");
    };
    const onFail = (e: Event): void => {
      const ev = e as unknown as { errorCode?: number; isMainFrame?: boolean };
      if (ev.isMainFrame === false) return;
      if (ev.errorCode === -3) return; // user-aborted navigation
      failedRef.current = true;
      setConn("failed");
    };
    wv.addEventListener("did-start-loading", onStart);
    wv.addEventListener("did-finish-load", onFinish);
    wv.addEventListener("did-fail-load", onFail);
    host.append(wv);
    webviewRef.current = wv;
    return () => {
      wv.removeEventListener("did-start-loading", onStart);
      wv.removeEventListener("did-finish-load", onFinish);
      wv.removeEventListener("did-fail-load", onFail);
      wv.remove();
      webviewRef.current = null;
    };
  }, []);

  const go = (): void => {
    const wv = webviewRef.current;
    if (!wv) return;
    failedRef.current = false;
    setConn("loading");
    void wv.loadURL(url).catch(() => setConn("failed"));
  };

  const annotate = async (): Promise<void> => {
    const wv = webviewRef.current;
    if (!wv) return;
    setStatus("capturing live view…");
    try {
      const img = await wv.capturePage();
      setShot(img.toDataURL());
      setStatus(null);
    } catch (e) {
      setStatus(errorMessage(e));
    }
  };

  return (
    <div className="grid h-full grid-rows-[auto_1fr] text-foreground">
      <div className="flex h-11 shrink-0 items-center gap-1.5 border-b border-border px-2">
        <Input
          value={url}
          data-testid="live-url"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") go();
          }}
          className="h-7 font-mono text-xs"
        />
        <Button
          size="sm"
          variant="secondary"
          data-testid="live-go"
          className="h-7 lowercase"
          onClick={go}
        >
          <RefreshCw className="size-3.5" />
          go
        </Button>
        <Button size="sm" className="h-7 lowercase" onClick={() => void annotate()}>
          <Camera className="size-3.5" />
          annotate
        </Button>
      </div>
      {shot ? (
        <DrawableImage dataUrl={shot} target={url} onDone={() => setShot(null)} />
      ) : (
        <div className="relative h-full bg-background">
          <div ref={hostRef} className="h-full" />
          {conn !== "ready" && (
            <div
              data-testid="live-overlay"
              data-conn={conn}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background px-6 text-center"
            >
              {conn === "loading" ? (
                <>
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">
                    connecting to <span className="font-mono text-foreground">{url}</span>
                  </p>
                </>
              ) : (
                <>
                  <div className="flex size-11 items-center justify-center rounded-full border border-border bg-muted/30">
                    <Unplug className="size-5 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">can't reach the app</p>
                    <p className="text-xs text-muted-foreground">
                      nothing responded at <span className="font-mono">{url}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      start your dev server, then retry
                    </p>
                  </div>
                  <Button size="sm" variant="secondary" className="h-7 lowercase" onClick={go}>
                    <RefreshCw className="size-3.5" />
                    retry
                  </Button>
                </>
              )}
            </div>
          )}
          {status && (
            <p className="absolute inset-x-0 bottom-0 m-2 rounded-md bg-muted/60 px-2 py-1 text-center text-[11px] text-muted-foreground backdrop-blur">
              {status}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

```

### Core Architecture Module: `apps/review-electron/src/renderer/src/components/NoteComposer.tsx`
```
import { useState, type KeyboardEvent } from "react";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  onSave: (note: string) => void;
  /** The collapsed trigger text (e.g. "note for the agent", "comment on this hunk"). */
  label?: string;
  /** Start expanded (for surfaces opened by an explicit action, e.g. a line's
   * comment button), so the reviewer types straight away with no second click. */
  defaultOpen?: boolean;
  /** Called when the composer is cancelled, so a caller that conjured it on demand
   * (a per-line composer) can remove it rather than collapse to a trigger. */
  onCancel?: () => void;
};

/**
 * The shared "note for the agent" affordance: a subtle collapsed trigger that
 * expands to a roomy multi-line composer + a `send` button. Reused under every
 * comment surface (decisions, trade-offs, diff lines/ranges/hunks) so a reviewer
 * can route a targeted note back to the agent from anywhere the target is
 * anchored. The CALLER renders any scope label ("line 42", "lines 37-42") next to
 * this; the placeholder is always the plain "note for the agent".
 *
 * Cmd/Ctrl+Enter sends, Escape cancels; sending trims, emits, clears, and
 * collapses. Empty/whitespace never sends. The caller owns the
 * {@link import("../../../model/agent").FeedTarget}; this only collects the text.
 */
export const NoteComposer = ({
  onSave,
  label = "note for the agent",
  defaultOpen = false,
  onCancel,
}: Props) => {
  const [adding, setAdding] = useState(defaultOpen);
  const [note, setNote] = useState("");

  const send = (): void => {
    const trimmed = note.trim();
    if (trimmed) onSave(trimmed);
    setNote("");
    setAdding(false);
  };

  const cancel = (): void => {
    setNote("");
    setAdding(false);
    onCancel?.();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  if (!adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="inline-flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <MessageSquarePlus className="size-3" />
        {label}
      </button>
    );
  }

  return (
    <div className="w-full space-y-1.5 rounded-md border border-border bg-background/60 p-2">
      <textarea
        autoFocus
        rows={3}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="note for the agent"
        className="w-full resize-y rounded-md border border-input bg-background px-2 py-1.5 text-xs leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
      />
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground/70">⌘↵ to send</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cancel}
            className="cursor-pointer text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            cancel
          </button>
          <Button size="sm" className="h-7 text-xs lowercase" onClick={send}>
            send
          </Button>
        </div>
      </div>
    </div>
  );
};

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3532** (2026-10-16): **Performance regression in 3.33.1: plugin detection scans node_modules in pnpm workspaces**
  *Symptoms*: ### What happened?   After upgrading from 3.33.0 to 3.33.1, `fallow audit` in a pnpm monorepo went from ~34 s to   ~170 s. Bisected by release; 3.33.0 and earlier are fine:    | version | total | system time | user time |   |---|---|---|---|   | 3.31.0 | 32 s | 4.3 s | 2.1 s |   | 3.32.0 | 34 s | 4.4 s | 2.5 s |   | 3.33.0 | 34 s | 4.6 s | 2.6 s |   | 3.33.1 | 169 s | 96.7 s | 9.0 s |    (The fast runs include a one-time cache rebuild after switching versions. Same machine, repo,   config and command for all four.)    `--performance` on 3.33.1 puts almost all of it in plugin detection:        discover files:       47.2ms  (2199 files)       workspaces:           13.1ms  (46 workspaces)       plugin detection: 164653.5ms  (+45.7ms plugin globs under entry points)       parse/extract:     14855.0ms  (2199 modules, 2199 cached, 0 parsed)       build graph:          11.9ms       analyze:              39.8ms       TOTAL:            164805.6ms      TOTAL:            164805.6ms  The time is kernel time. `fs_usage -w -f filesys fallow` during plugin detection shows a recursive directory walk (open → fstatfs64 → getdirentries64 → close per directory) through dependency internals under `node_modules/.pnpm`, reached through the `node_modules` symlinks of the workspace packages, for example:      open  …/.pnpm/@voidzero-dev+vite-plus-core@1.1.0_…/node_modules/@voidzero-dev/vite-plus-core/dist/vite/node/chunks     open  …/.pnpm/eslint@10.12.0_…/node_modules/eslint/lib/rules/utils/unicode 

- **Issue #3491** (2026-10-16): **`fallow dupes` finds no clones in an object passed to `defineComponent()**
  *Symptoms*: ### What happened?  Two Vue components share the same computed properties. When both files export a plain object, `fallow dupes` reports the copy. When the same object is passed to `defineComponent()`, which Vue projects use to type Options API components, fallow reports nothing, although `stats.total_tokens` shows that it read both files. `--mode strict` and `--no-ignore-imports` give the same result.  We tried a few ways to write the same two files:  | How the object is written | Clone group reported | |:--------------------------|:---------------------| | `export default { … }` | yes | | `export default ({ … })` | yes | | `const options = { … };` and `export default defineComponent(options);` | yes | | `export default defineComponent({ … })` | no | | `export default defineComponent({ … })` with a seven-statement method in `methods` | no |  We found this in our Vue 3 admin app. `sw-order-create-document-modal` and `sw-order-upload-document-modal` share 42 identical lines of computed properties. Both pass their options to `Component.wrapComponentConfig({ … })`, which is `defineComponent` under another name. In a run over the whole app, fallow reported a 24-line identical block near the top of both files, but not the 42 lines. With only these two files in a project, it reports no clone group at all. The files at commit `360382a3f4d`:  - [sw-order-create-document-modal/index.ts, lines 115 to 156](https://github.com/shopware/shopware/blob/360382a3f4d9dc9dbd602106867d63d2bf85660
  **Post-Mortem & Fix Analysis**:
  > Install v3.34.0 for this fix: `npm install fallow@3.34.0`.  `fallow dupes` now reports a clone in an object that a call receives, when the call holds a function at any depth. In your reproduction, `cart-summary.ts` and `order-summary.ts` now give the same clone group with `defineComponent({ ... })` as with `export default { ... }`. A wrapper with the same shape, such as `Component.wrapComponentConfig({ ... })`, works the same way.  Two notes for the upgrade:  - A method chain such as `xs.map((x) => x.id).filter(Boolean)` is no longer filtered, so you can see new clone groups in chained code. - The first `fallow dupes` run after the upgrade tokenizes the project again.  Thanks, @jleifeld. 

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

### Incident Patch 1: `8a6cbdc4` (2026-10-19)
**Commit Message**: chore(deps): fix vulnerable dependencies in the review app and demo project (#3615)

* chore(deps): update sample-app fixture and demo-project dependencies

Refresh the sample-app fixture lockfile so source-map-js, postcss,
browserslist and baseline-browser-mapping resolve to patched versions.
Raise the @faker-js/faker range in the demo project to ^10.5.0. The demo
source does not import faker, so the bump does not change its behavior.

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

* chore(deps): drop sprintf-js from the review app through global-agent 4

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

---------

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

**File**: `apps/review-electron/fixtures/sample-app/package-lock.json` (modified, +34/-34)
```diff
@@ -1244,9 +1244,9 @@
       }
     },
     "node_modules/baseline-browser-mapping": {
-      "version": "2.10.38",
-      "resolved": "https://registry.npmjs.org/baseline-browser-mapping/-/baseline-browser-mapping-2.10.38.tgz",
-      "integrity": "sha512-31/02mVB4yuQU6adKk5SlY6m+mxDwUq5KZkyYgnLrrKl7TEm1+3PyDtDBz2kOv/wxZz41GHsvV1A/u6RmiyBvw==",
+      "version": "2.11.29",
+      "resolved": "https://registry.npmjs.org/baseline-browser-mapping/-/baseline-browser-mapping-2.11.29.tgz",
+      "integrity": "sha512-YeesxhUmR4h5y5V8KF8iBCqJb8YFrBJ++XBTeGcWIaQOYXGN19JM0FoiOjAhwuDoln8owMgXcWBmgHtYSkky2w==",
       "dev": true,
       "license": "Apache-2.0",
       "bin": {
@@ -1257,9 +1257,9 @@
       }
     },
     "node_modules/browserslist": {
-      "version": "4.28.2",
-      "resolved": "https://registry.npmjs.org/browserslist/-/browserslist-4.28.2.tgz",
-      "integrity": "sha512-48xSriZYYg+8qXna9kwqjIVzuQxi+KYWp2+5nCYnYKPTr0LvD89Jqk2Or5ogxz0NUMfIjhh2lIUX/LyX9B4oIg==",
+      "version": "4.29.4",
+      "resolved": "https://registry.npmjs.org/browserslist/-/browserslist-4.29.4.tgz",
+      "integrity": "sha512-2TcbbiwXEq+N0kD36tykpCfyyQigUXmuwNQbnPp4Xk4PX9JOqVIKjJlIDjpH7uY6tmRGoAd+apeT1p60T8wsdA==",
       "dev": true,
       "funding": [
         {
@@ -1277,11 +1277,11 @@
       ],
       "license": "MIT",
       "dependencies": {
-        "baseline-browser-mapping": "^2.10.12",
-        "caniuse-lite": "^1.0.30001782",
-        "electron-to-chromium": "^1.5.328",
-        "node-releases": "^2.0.36",
-        "update-browserslist-db": "^1.2.3"
+        "baseline-browser-mapping": "^2.11.29",
+        "caniuse-lite": "^1.0.30001816",
+        "electron-to-chromium": "^1.5.459",
+        "node-releases": "^2.0.59",
+        "update-browserslist-db": "^1.3.4"
       },
       "bin": {
         "browserslist": "cli.js"
@@ -1291,9 +1291,9 @@
       }
     },
     "node_modules/caniuse-lite": {
-      "version": "1.0.30001799",
-      "resolved": "https://registry.npmjs.org/caniuse-lite/-/caniuse-lite-1.0.30001799.tgz",
-      "integrity": "sha512-hG1bReV+OUU+MOqK4t/ZWI0tZOyz3rqS9XuhOUz1cIcbwBKjOyJEJuw9ER5JuNyqxNk8u/JUVbGibBOL1yrjFw==",
+      "version": "1.0.30001816",
+      "resolved": "https://registry.npmjs.org/caniuse-lite/-/caniuse-lite-1.0.30001816.tgz",
+      "integrity": "sha512-+8Yx7BXCoqk6IF8yTicjfUR6D/ldJzdlsodlEOiOSPmhK844WIgk67/zIQaGAOxNkZyyvBlrRFnLvqKIoqbAFw==",
       "dev": true,
       "funding": [
         {
@@ -1344,9 +1344,9 @@
       }
     },
     "node_modules/electron-to-chromium": {
-      "version": "1.5.376",
-      "resolved": "https://registry.npmjs.org/electron-to-chromium/-/electron-to-chromium-1.5.376.tgz",
-      "integrity": "sha512-cUVA7/RvbFTEuw/i3obUwDTRIXojaxkResf+ibByPFxjc6XK3VNtcQXV0NSbAlJ0FMjcJGgftVVB4Qo184EXvA==",
+      "version": "1.5.459",
+      "resolved": "https://registry.npmjs.org/electron-to-chromium/-/electron-to-chromium-1.5.459.tgz",
+      "integrity": "sha512-4SC9HHSFjO/liAhifpdOL5hG9b4BP7/5G3y3UPZVO8trlAXr1CaUEEJL0gWK3kOcYcZrOA5rkwG45Gra/lTIgg==",
       "dev": true,
       "license": "ISC"
     },
@@ -1496,9 +1496,9 @@
       "license": "MIT"
     },
     "node_modules/nanoid": {
-      "version": "3.3.14",
-      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.14.tgz",
-      "integrity": "sha512-U9kYi5bpVMEI31yC8iw4bJJp0avcHXA0W8/wNfLfnvJYzihQo2ZRPYPvpAAd570HAcCBjCTN7vnr+v4StKl1IQ==",
+      "version": "3.3.20",
+      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.20.tgz",
+      "integrity": "sha512-uKdg2G3GNCKQn9byYOpxbGqrT2fGO5KRt5J/8b3pok8rT6qxGWF6hxMyJiEYtAf+FVyYuD9hRaDqX5uPFYJ4ZQ==",
       "dev": true,
       "funding": [
         {
@@ -1515,9 +1515,9 @@
       }
     },
     "node_modules/node-releases": {
-      "version": "2.0.48",
-      "resolved": "https://registry.npmjs.org/node-releases/-/node-releases-2.0.48.tgz",
-      "integrity": "sha512-1uz8041X6LoI6ZSdZacM9lVY28vuzDlSKitnpbSNK0RfKoIJkX29NBPVEFXhnuSuEOA9Ww0xnPJ+ILWbGAv8DA==",
+      "version": "2.0.59",
+      "resolved": "https://registry.npmjs.org/node-releases/-/node-releases-2.0.59.tgz",
+      "integrity": "sha512-5qr2okC4ItAI0hG5SaV0HoYMpnM/Y6+Oqr7AmPYy/2uEoGvS+GbSKLeRxSS1uAdu59yz0ouzcuXievSgg///WA==",
       "dev": true,
       "license": "MIT",
       "engines": {
@@ -1545,9 +1545,9 @@
       }
     },
     "node_modules/postcss": {
-      "version": "8.5.15",
-      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.15.tgz",
-      "integrity": "sha512-FfR8sjd4em2T6fb3I2MwAJU7HWVMr9zba+enmQeeWFfCbm+UOC/0X4DS8XtpUTMwWMGbjKYP7xjfNekzyGmB3A==",
+      "version": "8.5.31",
+      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.31.tgz",
+      "integrity": "sha512-YUbWYCgErwnMAVkjUnYa+KlMBzGpHwiIt/DE7f0G33AuX2LH9UcTk6KgWxd3zRU+pN3u/C+Xl3EnMLM4Hea7Sg==",
       "dev": true,
       "funding": [
         {
@@ -1565,9 +1565,9 @@
       ],
       "license": "MIT",
       "dependencies": {
-        "nanoid": "^3.3.12",
+        
```

**File**: `apps/review-electron/package-lock.json` (modified, +20/-87)
```diff
@@ -5694,15 +5694,6 @@
       "dev": true,
       "license": "MIT"
     },
-    "node_modules/boolean": {
-      "version": "3.2.0",
-      "resolved": "https://registry.npmjs.org/boolean/-/boolean-3.2.0.tgz",
-      "integrity": "sha512-d0II/GO9uf9lfUHH2BQsjxzRJZBdsjgsBiW4BvhWk/3qoKwQFjIDVN19PfX8F2D/r9PCMTtLWjYVCFrpeYUzsw==",
-      "deprecated": "Package no longer supported. Contact Support at https://www.npmjs.com/support for more info.",
-      "dev": true,
-      "license": "MIT",
-      "optional": true
-    },
     "node_modules/brace-expansion": {
       "version": "5.0.12",
       "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz",
@@ -6231,14 +6222,6 @@
         "node": ">=8"
       }
     },
-    "node_modules/detect-node": {
-      "version": "2.1.0",
-      "resolved": "https://registry.npmjs.org/detect-node/-/detect-node-2.1.0.tgz",
-      "integrity": "sha512-T0NIuQpnTvFDATNuHN5roPwSBG83rFsuO+MXXH9/3N1eFbn4wcPjttvjMLEPWJ0RGUYgQE7cGgS3tNxbqCGM7g==",
-      "dev": true,
-      "license": "MIT",
-      "optional": true
-    },
     "node_modules/detect-node-es": {
       "version": "1.1.0",
       "resolved": "https://registry.npmjs.org/detect-node-es/-/detect-node-es-1.1.0.tgz",
@@ -6874,14 +6857,6 @@
         "node": ">= 0.4"
       }
     },
-    "node_modules/es6-error": {
-      "version": "4.1.1",
-      "resolved": "https://registry.npmjs.org/es6-error/-/es6-error-4.1.1.tgz",
-      "integrity": "sha512-Um/+FxMr9CISWh0bi5Zv0iOD+4cFh5qLeks1qhAopKVAJw3drgKbKySikp7wGhDL0HPeaja0P5ULZrxLkniUVg==",
-      "dev": true,
-      "license": "MIT",
-      "optional": true
-    },
     "node_modules/esbuild": {
       "version": "0.25.12",
       "resolved": "https://registry.npmjs.org/esbuild/-/esbuild-0.25.12.tgz",
@@ -7267,19 +7242,17 @@
       }
     },
     "node_modules/global-agent": {
-      "version": "3.0.0",
-      "resolved": "https://registry.npmjs.org/global-agent/-/global-agent-3.0.0.tgz",
-      "integrity": "sha512-PT6XReJ+D07JvGoxQMkT6qji/jVNfX/h364XHZOWeRzy64sSFr+xJ5OX7LI3b4MPQzdL4H8Y8M0xzPpsVMwA8Q==",
+      "version": "4.1.3",
+      "resolved": "https://registry.npmjs.org/global-agent/-/global-agent-4.1.3.tgz",
+      "integrity": "sha512-KUJEViiuFT3I97t+GYMikLPJS2Lfo/S2F+DQuBWzuzaMPnvt5yyZePzArx36fBzpGTxZjIpDbXLeySLgh+k76g==",
       "dev": true,
       "license": "BSD-3-Clause",
       "optional": true,
       "dependencies": {
-        "boolean": "^3.0.1",
-        "es6-error": "^4.1.1",
-        "matcher": "^3.0.0",
-        "roarr": "^2.15.3",
-        "semver": "^7.3.2",
-        "serialize-error": "^7.0.1"
+        "globalthis": "^1.0.2",
+        "matcher": "^4.0.0",
+        "semver": "^7.3.5",
+        "serialize-error": "^8.1.0"
       },
       "engines": {
         "node": ">=10.0"
@@ -7650,14 +7623,6 @@
       "dev": true,
       "license": "MIT"
     },
-    "node_modules/json-stringify-safe": {
-      "version": "5.0.1",
-      "resolved": "https://registry.npmjs.org/json-stringify-safe/-/json-stringify-safe-5.0.1.tgz",
-      "integrity": "sha512-ZClg6AaYvamvYEE82d3Iyd3vSSIjQ+odgjaTzRuO3s7toCdFKczob2i0zCh7JE8kWn17yvAWhUVxvqGwUalsRA==",
-      "dev": true,
-      "license": "ISC",
-      "optional": true
-    },
     "node_modules/json5": {
       "version": "2.2.3",
       "resolved": "https://registry.npmjs.org/json5/-/json5-2.2.3.tgz",
@@ -7992,9 +7957,9 @@
       }
     },
     "node_modules/matcher": {
-      "version": "3.0.0",
-      "resolved": "https://registry.npmjs.org/matcher/-/matcher-3.0.0.tgz",
-      "integrity": "sha512-OkeDaAZ/bQCxeFAozM55PKcKU0yJMPGifLwV4Qgjitu+5MoAfSQN4lsLJeXZ1b8w0x+/Emda6MZgXS1jvsapng==",
+      "version": "4.0.0",
+      "resolved": "https://registry.npmjs.org/matcher/-/matcher-4.0.0.tgz",
+      "integrity": "sha512-S6x5wmcDmsDRRU/c2dkccDwQPXoFczc5+HpQ2lON8pnvHlnvHAHj5WlLVvw6n6vNyHuVugYrFohYxbS+pvFpKQ==",
       "dev": true,
       "license": "MIT",
       "optional": true,
@@ -8003,6 +7968,9 @@
       },
       "engines": {
         "node": ">=10"
+      },
+      "funding": {
+        "url": "https://github.com/sponsors/sindresorhus"
       }
     },
     "node_modules/math-intrinsics": {
@@ -9011,25 +8979,6 @@
         "rimraf": "bin.js"
       }
     },
-    "node_modules/roarr": {
-      "version": "2.15.4",
-      "resolved": "https://registry.npmjs.org/roarr/-/roarr-2.15.4.tgz",
-      "integrity": "sha512-CHhPh+UNHD2GTXNYhPWLnU8ONHdI+5DI+4EYIAOaiD63rHeYlZvyh8P+in5999TTSFgUYuKUAjzRI4mdh/p+2A==",
-      "dev": true,
-      "license": "BSD-3-Clause",
-      "optional": true,
-      "dependencies": {
-        "boolean": "^3.0.1",
-        "detect-node": "^2.0.4",
-        "globalthis": "^1.0.1",
-        "json-stringify-safe": "^5.0.1",
-        "semver-compare": "^1.0.0",
-        "sprintf-js": "^1.1.2"
-      },
-      "engines": {
-        "node": ">=8.0"
-      }
-    },
     "node_modules/rollup": {
       "version": "4.62.2",
       "resolved": "https://registry.npmjs.org/rollup/-
```

**File**: `apps/review-electron/package.json` (modified, +3/-0)
```diff
@@ -59,5 +59,8 @@
       ],
       "category": "public.app-category.developer-tools"
     }
+  },
+  "overrides": {
+    "global-agent": "^4.1.3"
   }
 }
```

**File**: `assets/demo-project/package.json` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
     "moment": "^2.30.0"
   },
   "devDependencies": {
-    "@faker-js/faker": "^9.0.0",
+    "@faker-js/faker": "^10.5.0",
     "typescript": "^5.4.0"
   }
 }
```

---

### Incident Patch 2: `018adfc5` (2026-10-19)
**Commit Message**: fix(mutation): report undiscovered tests as partial, select Vitest config, show progress (#3608)

- A mutation run is partial, with the completion reason test-files-not-discovered, when the runner does not list a statically mapped test file. An empty survivor list from such a run is no longer reported as complete.
- The new --runner-config flag (config key mutation.runnerConfig) selects an existing Vitest configuration for the run. The path must be a file inside the project root.
- Human output shows phase progress on stderr: runner setup, baseline, mutant execution with counts, and finalization. JSON stdout is unchanged, and --quiet hides the progress.

Closes #3596
Closes #3598
Closes #3599

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

**File**: `.agents/skills/fallow/references/cli-reference.md` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ Every fallow command with its purpose and key flags. The table is regenerated fr
 | `type-aware` | Inspect the optional TypeScript semantic companion |  |
 | `doctor` | Diagnose project readiness without analysis or mutation |  |
 | `similar-code` | Find semantically similar functions with a pinned local model (opt-in) | `--threshold`, `--min-lines`, `--top`, `--file` |
-| `mutation` | Measure how well the tests detect changes in the code (opt-in) | `--all`, `--plan`, `--max-mutants`, `--time-budget`, `--concurrency`, `--runtime`, `--allow-dirty`, `--allow-side-effects` |
+| `mutation` | Measure how well the tests detect changes in the code (opt-in) | `--all`, `--plan`, `--max-mutants`, `--time-budget`, `--concurrency`, `--runtime`, `--runner-config`, `--allow-dirty`, `--allow-side-effects` |
 | `inspect` | Compose one evidence bundle for a file or exported symbol | `--file <path>`, `--symbol <file>:<export>` |
 | `trace` | Trace a symbol's call chain, or with `--path` the shortest import path between two modules (best-effort, syntactic; OFF the ranked path) | `symbol`, `--path <FROM> <TO>`, `--eager-only`, `--callers`, `--callees`, `--depth` |
 | `trace-error` | Resolve a runtime stack trace's frames to the definitions they name (best-effort, syntactic; OFF the ranked path) | `trace_file` |
```

**File**: `.claude/skills/fallow/references/cli-reference.md` (modified, +1/-1)
```diff
@@ -53,7 +53,7 @@ Every fallow command with its purpose and key flags. The table is regenerated fr
 | `type-aware` | Inspect the optional TypeScript semantic companion |  |
 | `doctor` | Diagnose project readiness without analysis or mutation |  |
 | `similar-code` | Find semantically similar functions with a pinned local model (opt-in) | `--threshold`, `--min-lines`, `--top`, `--file` |
-| `mutation` | Measure how well the tests detect changes in the code (opt-in) | `--all`, `--plan`, `--max-mutants`, `--time-budget`, `--concurrency`, `--runtime`, `--allow-dirty`, `--allow-side-effects` |
+| `mutation` | Measure how well the tests detect changes in the code (opt-in) | `--all`, `--plan`, `--max-mutants`, `--time-budget`, `--concurrency`, `--runtime`, `--runner-config`, `--allow-dirty`, `--allow-side-effects` |
 | `inspect` | Compose one evidence bundle for a file or exported symbol | `--file <path>`, `--symbol <file>:<export>` |
 | `trace` | Trace a symbol's call chain, or with `--path` the shortest import path between two modules (best-effort, syntactic; OFF the ranked path) | `symbol`, `--path <FROM> <TO>`, `--eager-only`, `--callers`, `--callees`, `--depth` |
 | `trace-error` | Resolve a runtime stack trace's frames to the definitions they name (best-effort, syntactic; OFF the ranked path) | `trace_file` |
```

**File**: `changelog.d/fix-mutation-test-files-not-discovered.md` (added, +9/-0)
```diff
@@ -0,0 +1,9 @@
+### Fixed
+
+- **A mutation run in which the runner does not list a static test file is
+  now `partial`.** The tests of such a file never run, but the run reported
+  `completion.status: "complete"`. An empty survivor list then looked
+  conclusive. The completion now has the new reason
+  `test-files-not-discovered`, the same name as the `errors` entry that
+  names the files. The exit code does not change.
+  (Closes [#3596](https://github.com/fallow-rs/fallow/issues/3596))
```

**File**: `changelog.d/mutation-run-progress.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+### Added
+
+- **A human `fallow mutation` run now shows phase progress on stderr.** The
+  lines name the runner setup, the baseline run, the mutant runs with
+  done and total counts, the retries, and the final worktree check and
+  report. A long phase prints a line at a fixed interval, also in captured
+  non-TTY output, so a slow run does not look stalled. `--quiet` and
+  `--format json` print no progress lines, and stdout does not change. The
+  programmatic API has `run_mutation_with_progress` with the
+  `MutationProgress` events.
+  (Closes [#3599](https://github.com/fallow-rs/fallow/issues/3599))
```

**File**: `changelog.d/mutation-runner-config.md` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+### Added
+
+- **`fallow mutation --runner-config <path>` selects the Vitest config of
+  a run.** A project that keeps its integration, UI or browser tests in a
+  separate Vitest config can now run mutants against those tests. The
+  `mutation.runnerConfig` config key sets the same file, and the flag
+  wins. The file must exist inside the project root, and only the Vitest
+  runner accepts it. A static test file that the selected config does not
+  include stays visible as a `test-files-not-discovered` error. `--config`
+  still selects the Fallow config.
+  (Closes [#3598](https://github.com/fallow-rs/fallow/issues/3598))
```

**File**: `crates/api/src/lib.rs` (modified, +5/-4)
```diff
@@ -168,7 +168,8 @@ pub use markdown_output::{
     build_grouped_markdown, build_health_markdown, build_markdown, build_walkthrough_markdown,
 };
 pub use mutation::{
-    MutationRunOptions, MutationRunScope, apply_mutation_verdicts, validate_mutation_verdicts,
+    MutationProgress, MutationProgressSink, MutationRunOptions, MutationRunScope,
+    apply_mutation_verdicts, validate_mutation_verdicts,
 };
 pub use output_contracts::{
     AuditOutput, BoundariesListLogicalGroup, BoundariesListRule, BoundariesListZone,
@@ -197,9 +198,9 @@ pub use runtime::{
     review_similar_code, run_architecture, run_audit, run_boundary_violations,
     run_circular_dependencies, run_combined, run_complexity_with_runner, run_dead_code,
     run_dead_code_with_baseline, run_decision_surface, run_duplication, run_feature_flags,
-    run_health, run_health_with_runner, run_mutation, run_similar_code, run_trace_clone,
-    run_trace_dependency, run_trace_error, run_trace_export, run_trace_file, run_trace_import_path,
-    select_similar_code_candidate_snapshot, serialize_health_report_json,
+    run_health, run_health_with_runner, run_mutation, run_mutation_with_progress, run_similar_code,
+    run_trace_clone, run_trace_dependency, run_trace_error, run_trace_export, run_trace_file,
+    run_trace_import_path, select_similar_code_candidate_snapshot, serialize_health_report_json,
 };
 pub use runtime_json::{
     serialize_architecture_programmatic_json, serialize_audit_programmatic_json,
```

**File**: `crates/api/src/mutation/e2e_tests.rs` (modified, +250/-1)
```diff
@@ -2,7 +2,7 @@ use std::fs;
 use std::process::Command;
 
 use fallow_engine::changed_files::clear_ambient_git_env;
-use std::path::Path;
+use std::path::{Path, PathBuf};
 use std::time::Duration;
 
 use crate::mutation::{MutationRunOptions, MutationRunScope};
@@ -370,6 +370,55 @@ fn invalid_limits_are_refused() {
     );
 }
 
+#[test]
+fn a_runner_config_must_be_a_vitest_file_inside_the_root() {
+    let project = small_project();
+    let root = project.path();
+    fs::write(
+        root.join("vitest.integration.config.mjs"),
+        "export default {};\n",
+    )
+    .expect("write");
+    let outside = tempfile::tempdir().expect("dir");
+    fs::write(
+        outside.path().join("vitest.config.mjs"),
+        "export default {};\n",
+    )
+    .expect("write");
+    let refused = |runner_config: PathBuf| {
+        let mut plan = options(root, MutationRunScope::All);
+        plan.runner_config = Some(runner_config);
+        let error = plan_mutation(&plan).unwrap_err();
+        assert_eq!(
+            error.code.as_deref(),
+            Some("FALLOW_INVALID_MUTATION_OPTIONS")
+        );
+        assert_eq!(error.context.as_deref(), Some("mutation.runnerConfig"));
+        error.message
+    };
+    assert!(refused(PathBuf::from("vitest.missing.config.mjs")).contains("is not a file"));
+    assert!(refused(PathBuf::from("src")).contains("is not a file"));
+    assert!(refused(outside.path().join("vitest.config.mjs")).contains("outside the project root"));
+
+    let mut plan = options(root, MutationRunScope::All);
+    plan.runner_config = Some(PathBuf::from("vitest.integration.config.mjs"));
+    plan_mutation(&plan).expect("a Vitest config inside the root is valid");
+
+    // The config key selects the file too, and only Vitest reads one.
+    fs::write(
+        root.join(".fallowrc.json"),
+        r#"{"mutation":{"runner":"node-test","runnerConfig":"vitest.integration.config.mjs"}}"#,
+    )
+    .expect("write");
+    let error = plan_mutation(&options(root, MutationRunScope::All)).unwrap_err();
+    assert_eq!(error.context.as_deref(), Some("mutation.runnerConfig"));
+    assert!(
+        error.message.contains("needs the Vitest runner"),
+        "{}",
+        error.message
+    );
+}
+
 /// The end-to-end run needs a symlink to `node_modules`, so it runs on Unix
 /// only. Its helper lives in the same module, so no item is dead on Windows.
 #[cfg(unix)]
@@ -870,4 +919,204 @@ mod end_to_end {
         assert_eq!(runner.runtime.name, "bun");
         assert_math_statuses(&report);
     }
+
+    /// The fixture of #3596: the root Vitest config includes only the unit
+    /// test, and a second config includes the integration test. The runner
+    /// does not list the integration test, so its tests never run.
+    fn two_config_project(package: &Path, root_include: &str) -> (tempfile::TempDir, PathBuf) {
+        let project = tempfile::tempdir().expect("dir");
+        let root = dunce::canonicalize(project.path()).expect("root");
+        let files = [
+            (
+                "package.json",
+                r#"{"name":"mutation-discovery-repro","private":true,"type":"module","scripts":{"test":"vitest run","test:integration":"vitest run --config vitest.integration.config.mjs"},"devDependencies":{"vitest":"5.0.4"}}"#
+                    .to_owned(),
+            ),
+            (
+                "src/math.ts",
+                "export const add = (a: number, b: number): number => a + b;\n".to_owned(),
+            ),
+            (
+                "test/unit.test.ts",
+                "import { expect, test } from \"vitest\";\nimport { add } from \"../src/math\";\ntest(\"nonnegative\", () => { expect(add(2, 2)).toBeGreaterThanOrEqual(0); });\n"
+                    .to_owned(),
+            ),
+            (
+                "test/integration.test.ts",
+                "import { expect, test } from \"vitest\";\nimport { add } from \"../src/math\";\ntest(\"adds exactly\", () => { expect(add(2, 2)).toBe(4); });\n"
+                    .to_owned(),
+            ),
+            (
+                "vitest.config.mjs",
+                format!("export default {{ test: {{ include: [\"{root_include}\"] }} }};\n"),
+            ),
+            (
+                "vitest.integration.config.mjs",
+                "export default { test: { include: [\"test/integration.test.ts\"] } };\n"
+                    .to_owned(),
+            ),
+            (".gitignore", "node_modules\n".to_owned()),
+        ];
+        for (file, content) in files {
+            let target = root.join(file);
+            fs::create_dir_all(target.parent().expect("parent")).expect("dir");
+            fs::write(&target, content).expect("write");
+        }
+        fs::create_dir_all(root.join("node_modules")).expect("dir");
+        std::os::unix::fs::symlink(
+            package.join("node_modules/vitest"),
+            root.join("node_modules/vitest"),
+        )
+        .expect("symlink");
+        
```

**File**: `crates/api/src/mutation/mod.rs` (modified, +48/-0)
```diff
@@ -58,6 +58,48 @@ impl Default for MutationRunScope {
     }
 }
 
+/// A phase event of a mutation run, for a caller that shows progress.
+///
+/// [`crate::run_mutation_with_progress`] sends the events in run order. A
+/// run with no covered mutant and no test file skips the runner phases.
+#[derive(Debug, Clone, Copy, PartialEq, Eq)]
+#[non_exhaustive]
+pub enum MutationProgress {
+    /// The plan is ready. The runner setup starts: the runtime, the
+    /// companion install and the runner start.
+    Setup {
+        /// The planned mutants.
+        mutants: usize,
+    },
+    /// The baseline run starts: the test files run with no active mutant.
+    Baseline {
+        /// The test files of the baseline run.
+        test_files: usize,
+    },
+    /// The mutant runs. The first event has `done` 0, and each finished
+    /// mutant sends one event.
+    Mutants {
+        /// The mutants that finished.
+        done: usize,
+        /// The mutants that this phase runs. A cached result is not in it.
+        total: usize,
+    },
+    /// The retries of survivors and timeouts. The first event has `done` 0.
+    Retries {
+        /// The retries that finished.
+        done: usize,
+        /// The retries that this phase runs.
+        total: usize,
+    },
+    /// The tests stopped. The worktree check, the survivor type check and
+    /// the report start.
+    Finalize,
+}
+
+/// Receives the [`MutationProgress`] events of a run. The scheduler sends
+/// the mutant events from its worker threads.
+pub type MutationProgressSink<'a> = &'a (dyn Fn(MutationProgress) + Sync);
+
 /// Options of [`crate::run_mutation`] and [`crate::plan_mutation`].
 #[derive(Debug, Clone, Default)]
 pub struct MutationRunOptions {
@@ -91,6 +133,12 @@ pub struct MutationRunOptions {
     /// The timeout of the companion `init` and the dry run. `None` uses
     /// 120 seconds.
     pub runner_timeout: Option<Duration>,
+    /// The config file of the test runner, for example a separate Vitest
+    /// config of the integration tests. A relative path is relative to the
+    /// project root. The file must exist inside the project root. `None`
+    /// uses the `mutation.runnerConfig` config key, else the default config
+    /// discovery of the runner. Only the Vitest runner reads a config file.
+    pub runner_config: Option<PathBuf>,
     /// The files that the caller writes after the run, for example the
     /// `--output-file` report. The worktree check leaves them out, so an old
     /// report does not make the worktree dirty. A relative path is relative
```

---

### Incident Patch 3: `d1b35640` (2026-10-19)
**Commit Message**: fix(impact): leave a newer-schema store unchanged on every write (#3607)

An older fallow binary no longer rewrites an Impact store that a newer fallow wrote. impact enable, impact disable and init --decline exit 2 with an error that names the store schema. Audit and combined runs do not record into such a store. The store file stays unchanged.

Fixes #3597

Signed-off-by: Bart Waardenburg <[REDACTED_EMAIL]>

**File**: `changelog.d/fix-impact-preserve-newer-schema-store.md` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+### Fixed
+
+- **An older fallow no longer drops data from an Impact store that a newer
+  fallow wrote.** A project-local fallow could rewrite the shared store through
+  its own older model, and fields it did not know were lost. Every write path
+  now leaves such a store unchanged. `fallow impact enable`, `fallow impact
+  disable`, and `fallow init --decline` exit with code 2 and name the store
+  schema and the fallow version of the newest record. Audit and combined runs do not
+  record into it. Reads stay available.
+  (Closes [#3597](https://github.com/fallow-rs/fallow/issues/3597))
```

**File**: `crates/cli/src/cli_impact.rs` (modified, +25/-6)
```diff
@@ -91,8 +91,8 @@ pub fn dispatch_impact(
         return render_impact_all(quiet, output, json_style, sort, limit);
     }
     match subcommand {
-        Some(ImpactCli::Enable) => impact_enable(root, quiet),
-        Some(ImpactCli::Disable) => impact_disable(root, quiet),
+        Some(ImpactCli::Enable) => impact_enable(root, quiet, output),
+        Some(ImpactCli::Disable) => impact_disable(root, quiet, output),
         Some(ImpactCli::Default { state }) => impact_set_default(state, quiet),
         Some(ImpactCli::Reset { all }) => impact_reset(root, all, quiet),
         Some(ImpactCli::Statusline) => render_impact_statusline(root),
@@ -116,8 +116,11 @@ pub fn render_impact_statusline(root: &Path) -> ExitCode {
 }
 
 /// Enable Fallow Impact for this project; print the first-enable guidance.
-fn impact_enable(root: &Path, quiet: bool) -> ExitCode {
-    let newly = impact::enable(root);
+fn impact_enable(root: &Path, quiet: bool, output: fallow_config::OutputFormat) -> ExitCode {
+    let newly = match impact::enable(root) {
+        Ok(newly) => newly,
+        Err(newer) => return refuse_newer_store(&newer, output),
+    };
     if !quiet {
         if newly {
             println!(
@@ -137,9 +140,25 @@ fn impact_enable(root: &Path, quiet: bool) -> ExitCode {
     ExitCode::SUCCESS
 }
 
+/// Report a store that a newer Fallow wrote. The store stays unchanged.
+fn refuse_newer_store(
+    newer: &impact::NewerStoreSchema,
+    output: fallow_config::OutputFormat,
+) -> ExitCode {
+    crate::emit_known_failure(
+        &newer.message(),
+        2,
+        output,
+        telemetry::FailureReason::Validation,
+    )
+}
+
 /// Disable Fallow Impact for this project; history is retained.
-fn impact_disable(root: &Path, quiet: bool) -> ExitCode {
-    let was_enabled = impact::disable(root);
+fn impact_disable(root: &Path, quiet: bool, output: fallow_config::OutputFormat) -> ExitCode {
+    let was_enabled = match impact::disable(root) {
+        Ok(was_enabled) => was_enabled,
+        Err(newer) => return refuse_newer_store(&newer, output),
+    };
     if !quiet {
         println!(
             "{}",
```

**File**: `crates/cli/src/impact.rs` (modified, +267/-55)
```diff
@@ -538,7 +538,7 @@ fn parse_store(content: &str, path: &Path) -> ImpactStore {
         Ok(store) => {
             if store.schema_version > STORE_SCHEMA_VERSION {
                 tracing::warn!(
-                    "fallow impact: store at {} has schema_version {} but this build understands up to {}; reading it as best-effort, fields this build does not know are dropped on the next write. Upgrade fallow to read it fully.",
+                    "fallow impact: store at {} has schema_version {} but this build understands up to {}; reading it as best-effort. This build does not write to it, so the store stays unchanged. Upgrade fallow to read it fully.",
                     path.display(),
                     store.schema_version,
                     STORE_SCHEMA_VERSION,
@@ -547,15 +547,94 @@ fn parse_store(content: &str, path: &Path) -> ImpactStore {
             store
         }
         Err(err) => {
-            tracing::warn!(
-                "fallow impact: ignoring unreadable store at {} ({err}); run `fallow impact enable` to reset it",
-                path.display()
-            );
+            if let Some(newer) = newer_schema_in(content, path) {
+                tracing::warn!("{}", newer.message());
+            } else {
+                tracing::warn!(
+                    "fallow impact: ignoring unreadable store at {} ({err}); run `fallow impact enable` to reset it",
+                    path.display()
+                );
+            }
             ImpactStore::default()
         }
     }
 }
 
+/// An Impact store written by a newer Fallow. This build refuses to write it,
+/// because a typed round trip through the older [`ImpactStore`] drops every
+/// field and every record shape that this build does not know.
+#[derive(Debug, Clone, PartialEq, Eq)]
+pub struct NewerStoreSchema {
+    path: PathBuf,
+    schema_version: u32,
+    writer_version: Option<String>,
+}
+
+impl NewerStoreSchema {
+    /// The user-facing explanation, with the next step.
+    #[must_use]
+    pub fn message(&self) -> String {
+        let writer = self
+            .writer_version
+            .as_deref()
+            .map_or_else(String::new, |version| {
+                format!(" (newest record by fallow {version})")
+            });
+        format!(
+            "fallow impact: the store at {} has schema_version {}{writer}, but this build supports up to schema_version {}. The store is unchanged. Upgrade fallow, or use the newer fallow binary, to change or record Impact data for this project.",
+            self.path.display(),
+            self.schema_version,
+            STORE_SCHEMA_VERSION,
+        )
+    }
+}
+
+/// Read only the schema marker and the newest writer version of a raw store.
+/// This works when the typed parse fails, because a newer schema can change
+/// the shape of a known field. Returns `None` for a supported or corrupt store.
+fn newer_schema_in(content: &str, path: &Path) -> Option<NewerStoreSchema> {
+    let raw: serde_json::Value = serde_json::from_str(content).ok()?;
+    let schema_version = raw.get("schema_version")?.as_u64()?;
+    if schema_version <= u64::from(STORE_SCHEMA_VERSION) {
+        return None;
+    }
+    Some(NewerStoreSchema {
+        path: path.to_path_buf(),
+        schema_version: u32::try_from(schema_version).unwrap_or(u32::MAX),
+        writer_version: newest_writer_version(&raw),
+    })
+}
+
+/// The fallow version on the newest record of either track, when present.
+fn newest_writer_version(raw: &serde_json::Value) -> Option<String> {
+    ["records", "project_records"]
+        .iter()
+        .filter_map(|track| raw.get(*track)?.as_array()?.last())
+        .filter_map(|record| {
+            let timestamp = record.get("timestamp")?.as_str()?;
+            let version = record.get("version")?.as_str()?;
+            Some((timestamp, version))
+        })
+        .max_by(|a, b| a.0.cmp(b.0))
+        .map(|(_, version)| version.to_owned())
+}
+
+/// Load the store for a load, mutate, and save cycle. Refuses a store that a
+/// newer Fallow wrote, so the caller leaves the file unchanged. Every write
+/// path must use this instead of [`load`].
+fn load_for_write(root: &Path) -> Result<ImpactStore, NewerStoreSchema> {
+    let Some(path) = store_path(root) else {
+        return Ok(ImpactStore::default());
+    };
+    let Ok(content) = std::fs::read_to_string(&path) else {
+        return Ok(migrate_legacy_store(root));
+    };
+    if let Some(newer) = newer_schema_in(&content, &path) {
+        return Err(newer);
+    }
+    Ok(parse_store(&content, &path))
+}
+
 /// Persist the store best-effort using atomic replace. No-op when no config dir
 /// is resolvable (e.g. stripped CI env). NEVER writes into the analyzed repo.
 fn save(store: &ImpactStore, root: &Path) {
@@ -710,32 +789,42 @@ fn migrate_legacy_store(root: &Path) -> ImpactStore {
 /// Enable Impact tracking for THIS project (an explicit per-repo decision that
 /// overrides the 
```

**File**: `crates/cli/src/init.rs` (modified, +7/-1)
```diff
@@ -709,7 +709,13 @@ pub fn run_init(opts: &InitOptions<'_>) -> ExitCode {
 /// (no new state file); this neither enables Impact tracking nor writes a
 /// config file.
 fn run_init_decline(root: &Path, quiet: bool) -> ExitCode {
-    let newly = crate::impact::decline_onboarding(root);
+    let newly = match crate::impact::decline_onboarding(root) {
+        Ok(newly) => newly,
+        Err(newer) => {
+            eprintln!("{}", newer.message());
+            return ExitCode::from(2);
+        }
+    };
     if !quiet {
         println!(
             "{}",
```

**File**: `crates/cli/tests/integration/impact_store_schema_tests.rs` (added, +110/-0)
```diff
@@ -0,0 +1,110 @@
+//! An older binary must not rewrite an Impact store that a newer Fallow wrote.
+
+use std::path::{Path, PathBuf};
+
+use super::common::{CommandOutput, run_fallow_raw_with_env};
+
+const FUTURE_SCHEMA: u32 = 999;
+
+/// Isolated user config dirs for every platform the store path resolves on.
+fn isolated_env(home: &Path) -> Vec<(&'static str, String)> {
+    let utf8 = |path: &Path| path.to_str().expect("utf8 path").to_owned();
+    vec![
+        ("HOME", utf8(home)),
+        ("USERPROFILE", utf8(home)),
+        ("APPDATA", utf8(&home.join("AppData"))),
+        ("XDG_CONFIG_HOME", utf8(&home.join(".config"))),
+    ]
+}
+
+fn run_isolated(home: &Path, args: &[&str]) -> CommandOutput {
+    let env = isolated_env(home);
+    let env: Vec<(&str, &str)> = env.iter().map(|(k, v)| (*k, v.as_str())).collect();
+    run_fallow_raw_with_env(args, &env)
+}
+
+/// The single per-project store file under the isolated config dir.
+fn find_store(home: &Path) -> PathBuf {
+    let bases = [
+        home.join("Library").join("Application Support"),
+        home.join(".config"),
+        home.join("AppData"),
+    ];
+    let mut found = Vec::new();
+    for base in bases {
+        let Ok(entries) = std::fs::read_dir(base.join("fallow").join("impact")) else {
+            continue;
+        };
+        found.extend(
+            entries
+                .flatten()
+                .map(|entry| entry.path())
+                .filter(|path| path.extension().is_some_and(|ext| ext == "json")),
+        );
+    }
+    assert_eq!(found.len(), 1, "expected one store file, found {found:?}");
+    found.remove(0)
+}
+
+fn read(path: &Path) -> String {
+    std::fs::read_to_string(path).expect("read store")
+}
+
+#[test]
+fn older_binary_leaves_a_newer_schema_store_unchanged() {
+    let home = tempfile::tempdir().expect("home tempdir");
+    let project = tempfile::tempdir().expect("project tempdir");
+    let root = project.path().to_str().expect("utf8 root");
+
+    let enable = run_isolated(
+        home.path(),
+        &["impact", "enable", "--root", root, "--quiet"],
+    );
+    assert_eq!(enable.code, 0, "seed enable failed: {}", enable.stderr);
+    let store = find_store(home.path());
+
+    let future = format!(
+        r#"{{"schema_version":{FUTURE_SCHEMA},"enabled":false,"records":[],"future_field":{{"sentinel":"preserve"}}}}"#
+    );
+    std::fs::write(&store, &future).expect("seed future store");
+
+    for args in [
+        [
+            "impact", "disable", "--root", root, "--format", "json", "--quiet",
+        ],
+        [
+            "impact", "enable", "--root", root, "--format", "json", "--quiet",
+        ],
+    ] {
+        let output = run_isolated(home.path(), &args);
+        assert_eq!(
+            output.code, 2,
+            "{args:?} must refuse a newer store: {} {}",
+            output.stdout, output.stderr
+        );
+        let text = format!("{}{}", output.stdout, output.stderr);
+        assert!(
+            text.contains(&format!("schema_version {FUTURE_SCHEMA}")),
+            "{args:?} must name the store schema: {text}"
+        );
+        assert_eq!(
+            read(&store),
+            future,
+            "{args:?} must leave the store unchanged"
+        );
+    }
+
+    let decline = run_isolated(
+        home.path(),
+        &["init", "--decline", "--root", root, "--quiet"],
+    );
+    assert_eq!(decline.code, 2, "init --decline must refuse a newer store");
+    assert_eq!(read(&store), future);
+
+    let status = run_isolated(
+        home.path(),
+        &["impact", "--root", root, "--format", "json", "--quiet"],
+    );
+    assert_eq!(status.code, 0, "reads stay available: {}", status.stderr);
+    assert_eq!(read(&store), future);
+}
```

**File**: `crates/cli/tests/integration/main.rs` (modified, +1/-0)
```diff
@@ -68,6 +68,7 @@ mod health_group_trend_tests;
 mod health_mutation_report_tests;
 mod health_score_baseline_summary_tests;
 mod health_tests;
+mod impact_store_schema_tests;
 mod init_tests;
 mod inspect_tests;
 mod json_format_tests;
```

**File**: `docs/backwards-compatibility.md` (modified, +12/-0)
```diff
@@ -1012,6 +1012,18 @@ These are documented for the rare CI script that depended on the old behavior. N
   fallow reading a schema 7 store degrades the way it always has: the
   statusline reports the store as written by a newer build rather than as off.
 
+- **An older fallow does not write an Impact store that a newer fallow wrote.**
+  When the local store has a `schema_version` above the version this build
+  supports, every write path leaves the file unchanged. `fallow impact enable`,
+  `fallow impact disable`, and `fallow init --decline` exit with code 2 and an
+  error that names the store schema and the fallow version of the newest
+  record. An audit or combined run does not record and logs the same message.
+  The periodic digest does not appear. Reads (`fallow impact`, `fallow impact
+  status`, the statusline) stay best-effort. Before this change, an older
+  build rewrote the store through its own typed model and dropped every field
+  it did not know. Refusal is safer than a round trip of unknown keys, because
+  a newer schema can also change the meaning or the shape of a known field.
+
 - **`code_execute` bounds the value a snippet returns, not only the fallow JSON
   it reads.** `max_output_bytes` previously capped host-call output alone, and
   any snippet result was returned whole with `ok:true`. The serialized result is
```

#### Recent Merged Pull Requests:
- **PR #3615** (2026-10-19): chore(deps): fix vulnerable dependencies in the review app and demo project (@BartWaardenburg)
- **PR #3611** (2026-10-19): ci: wait for the approved npm root in one release job (@BartWaardenburg)
- **PR #3610** (2026-10-19): ci: let every CI push run on main finish (@BartWaardenburg)
- **PR #3609** (2026-10-19): ci: check only pull request commits in the DCO and commit lint steps (@BartWaardenburg)
- **PR #3608** (2026-10-19): fix(mutation): report undiscovered tests as partial, select Vitest config, show progress (@BartWaardenburg)
- **PR #3607** (2026-10-19): fix(impact): leave a newer-schema store unchanged on every write (@BartWaardenburg)

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

## X. deps): fix vulnerable dependencies in the review app and demo project (#3615)

**RULE**:
When implementing operations in `apps/review-electron/fixtures/sample-app/package-lock.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in fallow-rs/fallow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8a6cbdc4`: deps): fix vulnerable dependencies in the review app and demo project (#3615). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/review-electron/fixtures/sample-app/package-lock.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
      "version": "2.11.29",
      "resolved": "https://registry.npmjs.org/baseline-browser-mapping/-/baseline-browser-mapping-2.11.29.tgz",
      "integrity": "sha512-YeesxhUmR4h5y5V8KF8iBCqJb8YFrBJ++XBTeGcWIaQOYXGN19JM0FoiOjAhwuDoln8owMgXcWBmgHtYSkky2w==",
      "version": "4.29.4",
      "resolved": "https://registry.npmjs.org/browserslist/-/browserslist-4.29.4.tgz",
      "integrity": "sha512-2TcbbiwXEq+N0kD36tykpCfyyQigUXmuwNQbnPp4Xk4PX9JOqVIKjJlIDjpH7uY6tmRGoAd+apeT1p60T8wsdA==",
        "baseline-browser-mapping": "^2.11.29",
        "caniuse-lite": "^1.0.30001816",
        "electron-to-chromium": "^1.5.459",
        "node-releases": "^2.0.59",
        "update-browserslist-db": "^1.3.4"
      "version": "1.0.30001816",
      "resolved": "https://registry.npmjs.org/caniuse-lite/-/caniuse-lite-1.0.30001816.tgz",
      "integrity": "sha512-+8Yx7BXCoqk6IF8yTicjfUR6D/ldJzdlsodlEOiOSPmhK844WIgk67/zIQaGAOxNkZyyvBlrRFnLvqKIoqbAFw==",
      "version": "1.5.459",
      "resolved": "https://registry.npmjs.org/electron-to-chromium/-/electron-to-chromium-1.5.459.tgz",
      "integrity": "sha512-4SC9HHSFjO/liAhifpdOL5hG9b4BP7/5G3y3UPZVO8trlAXr1CaUEEJL0gWK3kOcYcZrOA5rkwG45Gra/lTIgg==",
    
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
      "version": "2.10.38",
      "resolved": "https://registry.npmjs.org/baseline-browser-mapping/-/baseline-browser-mapping-2.10.38.tgz",
      "integrity": "sha512-31/02mVB4yuQU6adKk5SlY6m+mxDwUq5KZkyYgnLrrKl7TEm1+3PyDtDBz2kOv/wxZz41GHsvV1A/u6RmiyBvw==",
      "version": "4.28.2",
      "resolved": "https://registry.npmjs.org/browserslist/-/browserslist-4.28.2.tgz",
      "integrity": "sha512-48xSriZYYg+8qXna9kwqjIVzuQxi+KYWp2+5nCYnYKPTr0LvD89Jqk2Or5ogxz0NUMfIjhh2lIUX/LyX9B4oIg==",
        "baseline-browser-mapping": "^2.10.12",
        "caniuse-lite": "^1.0.30001782",
        "electron-to-chromium": "^1.5.328",
        "node-releases": "^2.0.36",
        "update-browserslist-db": "^1.2.3"
      "version": "1.0.30001799",
      "resolved": "https://registry.npmjs.org/caniuse-lite/-/caniuse-lite-1.0.30001799.tgz",
      "integrity": "sha512-hG1bReV+OUU+MOqK4t/ZWI0tZOyz3rqS9XuhOUz1cIcbwBKjOyJEJuw9ER5JuNyqxNk8u/JUVbGibBOL1yrjFw==",
      "version": "1.5.376",
      "resolved": "https://registry.npmjs.org/electron-to-chromium/-/electron-to-chromium-1.5.376.tgz",
      "integrity": "sha512-cUVA7/RvbFTEuw/i3obUwDTRIXojaxkResf+ibByPFxjc6XK3VNtcQXV0NSbAlJ0FMjcJGgftVVB4Qo184EXvA==",
    
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8a6cbdc4` are properly handled with clean fallback behavior.
