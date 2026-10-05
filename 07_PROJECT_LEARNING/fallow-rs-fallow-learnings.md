# Forensic Learning Record (Deep Inspection): fallow-rs/fallow

> **Canonical Artifact**: `07_PROJECT_LEARNING/fallow-rs-fallow-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/fallow-rs/fallow](https://github.com/fallow-rs/fallow))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:51:53.793Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fallow-rs/fallow`
- **Description**: Codebase intelligence for TypeScript and JavaScript. Health, complexity hotspots, duplication, architecture boundaries, circular dependencies, design-system drift, and unused code, from one graph. CLI, GitHub Action, LSP, MCP, and VS Code. Rust, MIT licensed.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 5005 stars

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

### Core Architecture Module: `apps/review-electron/src/renderer/src/components/ReviewContext.tsx`
```
import { NotebookPen } from "lucide-react";
import type {
  ReviewContext as ReviewContextData,
  ReviewContextItem,
} from "../../../model/reviewContext";
import { shortAnchor } from "@/lib/anchor";

/**
 * The AUTHOR-AGENT review brief: the CAPTURE artifact, rendered prominently at the
 * TOP of the orientation area as the first thing the human reads. This is the agent
 * that DID the work recording, at write-time, "what the change is + the specific
 * things that need your taste".
 *
 * It is fact-ish (the author SAID it), so it is NOT fenced as hard model-inference
 * the way {@link import("./TradeOffList").TradeOffList} is; it is presented calmly as
 * the author's recorded context. Distinct from the live "Agent Review" reconstruct
 * panel, which re-derives framing after the fact rather than reading what the author
 * wrote down.
 *
 * Honesty rule: when `context === null` the author recorded no brief, so this renders
 * NOTHING (no "not run" chrome). The surface is simply absent.
 */
export const ReviewContext = ({
  context,
  onOpenDiff,
}: {
  context: ReviewContextData | null;
  onOpenDiff: (path: string) => void;
}) => {
  // No author brief: render nothing. The orientation surface is simply absent.
  if (context === null) return null;
  return (
    <section
      aria-label="from the author agent"
      className="space-y-2 rounded-md border border-border border-l-2 border-l-primary/60 bg-muted/10 p-3"
    >
      {/* Header: muted label + author attribution as a small mono chip. */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <NotebookPen className="size-3.5 shrink-0 text-muted-foreground" />
        <h3 className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          from the author agent
        </h3>
        {context.author && (
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
            {context.author}
          </span>
        )}
      </div>

      {/* The brief reads as ONE short narrative, not a bulleted list: the overview
          first, then a flowing paragraph per thing to review, each ending with its
          anchor as a subtle inline clickable reference (no margin bullets). */}
      <div className="space-y-2 text-sm leading-relaxed text-foreground">
        {context.summary && <p>{context.summary}</p>}
        {context.items.map((item, i) => (
          <ReviewContextParagraph key={`${item.anchor}:${i}`} item={item} onOpenDiff={onOpenDiff} />
        ))}
      </div>

      {/* Provenance footer: anchored author prose, never graph-validated content. */}
      <p className="text-[11px] text-muted-foreground">
        recorded by the author agent at write time; anchored, not graph-validated content.
      </p>
    </section>
  );
};

const ReviewContextParagraph = ({
  item,
  onOpenDiff,
}: {
  item: ReviewContextItem;
  onOpenDiff: (path: string) => void;
}) => {
  // An empty anchor is a general note: render the note alone, no dead link.
  const linkable = item.anchor.length > 0;
  const [anchorFile] = item.anchor.split(":");
  return (
    <p className="break-words">
      {item.note}
      {linkable && (
        <>
          {" "}
          <button
            type="button"
            title={item.anchor}
            className="break-all font-mono text-[12px] text-primary/80 hover:underline"
            onClick={() => onOpenDiff(anchorFile ?? item.anchor)}
          >
            ({shortAnchor(item.anchor)})
          </button>
        </>
      )}
    </p>
  );
};

```

### Core Architecture Module: `apps/review-electron/src/renderer/src/components/ReviewFocus.tsx`
```
import type { ReactNode } from "react";
import { GitCommitHorizontal, MessageSquarePlus } from "lucide-react";
import type { ReviewFocus as Focus } from "../../../model/walkthrough";
import { cn } from "@/lib/utils";

const verdictTone = (v: string): string =>
  v === "fail"
    ? "border-fallow-red/30 bg-fallow-red/10 text-fallow-red"
    : v === "pass"
      ? "border-fallow-green/30 bg-fallow-green/10 text-fallow-green"
      : "border-border bg-muted text-muted-foreground";

const riskTone = (r: string): string =>
  r === "high" ? "text-fallow-red" : r === "medium" ? "text-fallow-amber" : "text-fallow-green";

const Stat = ({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) => (
  <div className="min-w-0">
    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
    <dd className={cn("mt-0.5 truncate font-mono text-sm tabular-nums lowercase", className)}>
      {children}
    </dd>
  </div>
);

export const ReviewFocus = ({ focus, noteCount }: { focus: Focus; noteCount: number }) => (
  <section data-testid="review-loaded" className="space-y-3">
    <div className="flex items-center justify-between gap-2">
      <span
        className={cn(
          "rounded-full border px-2.5 py-0.5 text-xs font-semibold lowercase",
          verdictTone(focus.verdict),
        )}
      >
        {focus.verdict}
      </span>
      <span className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
        <GitCommitHorizontal className="size-3.5" />
        {focus.baseRef.slice(0, 9)}
      </span>
    </div>
    <dl className="grid grid-cols-3 gap-3">
      <Stat label="files" className="text-foreground">
        {focus.changedFiles}
      </Stat>
      <Stat label="risk" className={cn("font-medium", riskTone(focus.riskClass))}>
        {focus.riskClass}
      </Stat>
      <Stat label="effort" className="text-foreground">
        {focus.reviewEffort.replace(/_/g, " ")}
      </Stat>
    </dl>
    {noteCount > 0 && (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <MessageSquarePlus className="size-3.5" />
        <span className="font-mono tabular-nums">{noteCount}</span> note(s) sent to the agent
      </p>
    )}
  </section>
);

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3186** (2026-10-02): **Fallow documentation website is down when publishing a new version of the software**
  *Symptoms*: ### What happened?  The documentation website goes down and 404's whenever fallow pushes a new version to main.  <img width="1328" height="801" alt="Image" src="https://github.com/user-attachments/assets/6950448e-4e8e-4fff-afdf-c3f90c865c63" />  ### Reproduction  1. Publish a new version of the tool 2. go to the documentation website: https://fallow.mintlify.app/ 3. See the website's content 404  ### Expected behavior  I would expect to be able to reference the documentation when an update to the software is building/publishing.  ### Fallow version  Whichever one that was minted at around 17:15 Eastern time on 2026-10-02  ### Operating system  Linux  ### Configuration  ```toml  ```
  **Post-Mortem & Fix Analysis**:
  > Thanks for reporting this! We moved the documentation to https://fallow.tools/docs/ on October 1. The old Mintlify URL now returns 404. The current documentation is available, and https://docs.fallow.tools/ also redirects there. 

- **Issue #2954** (2026-09-29): **Formatter and linter targets are treated as entry points, hiding unused files**
  *Symptoms*: ### What happened?  Fallow treats formatting and linting targets as entry points in both `package.json` scripts and GitHub Actions `run` steps. Using `oxfmt` means the tool is used, but does not mean the files it formats are used by the application.  This also reproduces with oxlint 1.69.0 and ESLint 9.39.1; oxfmt is used below as the minimal example.  ### Reproduction  [Reproduction repository](https://github.com/azu/fallow-issues/blob/main/repros/script-file-entries/README.md): run `pnpm install --frozen-lockfile` and `pnpm repro:script-file-entries` from the repository root.  Tested with Fallow 3.30.0 and oxfmt 0.51.0.  ```jsonc // package.json {   "name": "repro",   "private": true,   "type": "module",   "main": "src/index.ts",   "scripts": { "fmt": "oxfmt --check \"**/*.ts\"" },   "devDependencies": { "oxfmt": "0.51.0" } } ```  ```ts // src/index.ts export {}; ```  ```ts // src/dead.ts export const dead = 1; ```  Install dependencies, then run `fallow dead-code --no-cache`:  - With the `fmt` script: `No issues found` (exit 0). - Without the `fmt` script: `src/dead.ts` is unused (exit 1).  The formatter never needs to run. An explicit path (`oxfmt --check src/dead.ts`) also reproduces the problem.  GitHub Actions also reproduces this independently: remove the `fmt` script and add a workflow step with `run: npx oxfmt --check "**/*.ts"`. Fallow still stops reporting `src/dead.ts` as unused.  ### Expected behavior  Keep recognizing `oxfmt` as a used dependency and tracking i
  **Post-Mortem & Fix Analysis**:
  > Your `fmt` script no longer hides `src/dead.ts`. After `npm install fallow@3.31.0`, `fallow dead-code` reports the file as unused with or without the script.  Fallow now ignores the file arguments of formatters and linters, `oxfmt` included, in `package.json` scripts, CI files and Dockerfiles. This covers the GitHub Actions `run` step from your report. `oxfmt` still counts as a used dependency, and fallow still tracks its `--config` file. A command that executes a file, such as `node src/dead.ts`, still makes an entry point.  For other commands that read files as data, the new `ignoreCommandEntries` option takes a list of command names, for example `["my-codegen"]`. `["*"]` turns off entry points from all commands, so you can declare the real entries in `entry`.  Thank you for the reproduction repository. 

- **Issue #2952** (2026-09-28): **Workspace dependency used only through a package.json imports alias is reported as unused**
  *Symptoms*: ### What happened?  When a package imports a workspace package only through a package.json `imports` (`#...`) alias, the import resolves correctly and the imported export is treated as used, but the workspace package itself is reported as an unused dependency.  ### Possible cause  In [`try_package_imports_fallback` in v3.30.0](https://github.com/fallow-rs/fallow/blob/v3.30.0/crates/graph/src/resolve/fallbacks.rs#L475-L504), external targets become `NpmPackage`, while internal targets become `InternalPackageModule` using the importing manifest's name. This appears to lose the target workspace package identity needed to credit the dependency.  ### Additional context  We import every workspace package through an `imports` alias (`"#acme/log/*": "@acme/lib-log/*"`) so that application code does not depend on package names. In our monorepo this reports 99 workspace dependencies as unused. The workaround is to list each package in `ignoreDependencies`, which only accepts exact names.  We are also requesting glob support in `ignoreDependencies` in #2953 to reduce the maintenance cost of this workaround. That is a separate configuration enhancement; this issue asks for the used workspace dependency to be recognized without an ignore.  Related: #56 (support for package.json `imports` aliases; resolution itself works in this reproduction).  ### Reproduction  Create the following files in a new directory:  ```text package.json   { "name": "root", "private": true }  pnpm-workspace.yaml  
  **Post-Mortem & Fix Analysis**:
  > `@repro/lib` no longer shows as an unused dependency in fallow 3.31.0. The `#lib/hello` import resolves through the install symlink to the source of `@repro/lib`, and fallow now credits that workspace package, the same as a direct `@repro/lib/hello` import. The graph cache version changes, so the next run rebuilds the cached import resolution.  A related change is in the same release. When a package imports an undeclared workspace package, directly or through an alias, fallow now reports an unlisted dependency.  Install it with `npm install fallow@3.31.0`. Thank you for the report and the minimal reproduction. 

- **Issue #2942** (2026-09-29): **Overzealous duplicate code detection**
  *Symptoms*: ### What happened?  React component with multiple sub components that have the same event handlers are incorrectly detected as duplicate code.  ### Reproduction  A React component with the following code:  ``` typescript export default function HexOffsetView({   offset,   datasource,   mouseCallback, }: HexOffsetViewProps): JSX.Element {   return (     <div className="he-column-sticky" data-testid="hex-offset-view">       <table className="he-table he-table-sticky" data-testid="hex-offset-table">         <thead           className="he-table-header"           onMouseOver={(e: MouseEvent) => mouseCallback("Over", (e.target as Element).id)}           onMouseLeave={(e: MouseEvent) => mouseCallback("Leave", (e.target as Element).id)}         >           <OffsetHeader />         </thead>         <tbody           data-testid="hex-offset-body"           onMouseOver={(e: MouseEvent) => mouseCallback("Over", (e.target as Element).id)}           onMouseLeave={(e: MouseEvent) => mouseCallback("Leave", (e.target as Element).id)}         >           <OffsetValues offset={offset} datasource={datasource} />         </tbody>       </table>     </div>   ); } ```  The onMouseOver/onMouseLeave blocks are detected as duplicate code, when they are not.  ### Expected behavior  These lines of code should not be detected as duplicate.  ### Fallow version   3.29.0  ### Operating system  Windows  ### Configuration  ```toml  ```
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report!  The two `onMouseOver`/`onMouseLeave` pairs are identical token for token, so a token-based clone detector reports them when the thresholds allow it. With the default settings (`minTokens` 50, `minLines` 5) this snippet gives no finding: each pair is 48 tokens.  Do you use lower thresholds or `--mode semantic`? Can you share your config?  To keep these lines as they are, add `// fallow-ignore-next-line code-duplication` above the element, or raise `duplicates.minTokens`. 
  > I should have added that I'm using fallow from VSCode.  However, now that I've taken a better look at what Fallow is detecting (there are actually three instances of duplication) and it's making sense to me now.  fallow is correct and the settings work as I would expect.  I initially thought there was no way to de-dup the code, but there is and all is good now.  You can close this and attribute to user error.
  > Ah thanks for checking @BarryNolte 👍 

- **Issue #2896** (2026-09-25): **fallow crashes (SIGABRT) parsing a Dockerfile line with an escaped quote immediately followed by non-ASCII text**
  *Symptoms*: ### What happened?  `fallow` panics and exits with `SIGABRT` when a `Dockerfile` (any `Dockerfile*`-named file it recognizes) contains a line where a `\'` (backslash + single quote, 2 bytes) is immediately followed by a multi-byte UTF-8 character. This is a common shape for shell-heredoc SQL seed scripts embedded in a Dockerfile, e.g. `INSERT INTO ... VALUES (\'非ASCII文字列\', ...)`.  ### Reproduction  When the following is executed,  ```bash mkdir /tmp/fallow-bug && cd /tmp/fallow-bug printf "      \\'あいうえお\\',\n" > Dockerfile npx fallow@3.28.0 dead-code ```  I got this:  ```bash thread 'main' (1966796) panicked at crates/core/src/discover/infrastructure.rs:181:47: end byte index 4 is not a char boundary; it is inside 'あ' (bytes 2..5 of string) note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace fallow binary terminated by signal SIGABRT ```  ### Expected behavior  _No response_  ### Fallow version  3.28.0  ### Operating system  macOS  ### Configuration  ```toml  ```
  **Post-Mortem & Fix Analysis**:
  > Fixed in v3.29.0: `npm install fallow@3.29.0` or `cargo install fallow-cli@3.29.0`.  Fallow no longer panics on your reproduction (`\'あいうえお\'` in a `Dockerfile`). It cut a short line at the length of the `RUN`, `CMD` or `ENTRYPOINT` keyword, and that cut fell inside a multi-byte character. Such a line now counts as an ordinary line, so `fallow dead-code` completes.  Thanks for the exact reproduction and the stack trace. 

- **Issue #2847** (2026-09-24): **Nuxt: @nuxt/content components report as unused files with autoImports on**
  *Symptoms*: ## Problem  With `autoImports` on, `fallow dead-code` reports the global components of `@nuxt/content` as unused files.  `@nuxt/content` registers each `components/content/` directory as a directory of global components. Markdown content renders these components, for example `::alert` renders `components/content/Alert.vue`. No template tag or import in a script names them. Fallow does not read Markdown, so it cannot see this usage.  On `nuxt/ui` (commit `032a152`), with `autoImports` on:  - `fallow@3.28.0` reports no file under `docs/app/components/content/`. - The current `main` reports 388 files under `docs/app/components/content/` as unused.  With `autoImports` off, both versions give the same result.  ## Cause  Before the change that reads the surface keys from the config object, a `routeRules` key such as `'/pro/components'` in `docs/nuxt.config.ts` matched the `components` key pattern. That match kept the component entry patterns of the `docs` workspace. Now fallow reads only the top-level keys, so the patterns go away with `autoImports` on. The `components/content/` files had no other credit.  ## Expected  When `@nuxt/content` is registered, the `components/content/` files of the project and of each local layer are entry points, with `autoImports` on and off.  Nuxt also registers `components/global/` and `*.global.vue` files as global components. A string reference, such as `resolveComponent('Name')` or `<component is="Name">`, can render them. Fallow does not resolve 
  **Post-Mortem & Fix Analysis**:
  > Released in v3.29.0.

- **Issue #2782** (2026-09-23): **GitHub annotations show unused exports as warnings despite error configuration**
  *Symptoms*: ### What happened?  I configured unused exports as errors:  ```json {   "rules": {     "unused-exports": "error"   } } ```  Fallow correctly fails the audit, but the GitHub annotation labels the unused export as a warning. The summary reports an error, while the finding appears as a warning.  I encountered this with Fallow 3.16.0 in GitHub Actions.  I can put together a PR for this if you're interested in fixing it, but wanted to start with this issue.  ### Reproduction  Create these files:  ```ts // index.ts import { used } from "./helpers"; console.log(used); ```  ```ts // helpers.ts export const used = 1; export const unused = 2; ```  Use this `.fallowrc.json`:  ```json {   "entry": ["index.ts"],   "rules": {     "unused-exports": "error"   } } ```  Run:  ```sh fallow dead-code --format github-annotations ```  The unused export produces a `::warning` annotation even though the command fails.  ### Expected behavior  GitHub annotations should respect the configured severity, including per-file overrides. An unused export configured as an error should produce an `::error` annotation.  The renderer's [`push_each` helper](https://github.com/fallow-rs/fallow/blob/v3.16.0/crates/cli/src/report/github_annotations.rs#L184) appears to hardcode the warning level.  ### Fallow version  3.16.0  ### Operating system  macOS  ### Configuration  ```toml {   "entry": ["index.ts"],   "rules": {     "unused-exports": "error"   } } ```
  **Post-Mortem & Fix Analysis**:
  > Thanks for the report. Fixed in #2814: each dead-code finding now carries its rule severity, so GitHub annotations, SARIF and CodeClimate follow `error` and `warn`, including `overrides[].rules`. It ships in the next release. The CRAP and complexity side from #2783 follows in a separate change.
  > Released in v3.29.0 (`npm install fallow@3.29.0`). Error annotations now also come before warnings, so the `max-annotations` cap keeps them on a large run. Thanks for the report and the offer of a PR. 

- **Issue #2757** (2026-09-24): **The Module Federation reader misses common option shapes and stays silent**
  *Symptoms*: I checked every reference below against main at `c3197ecf8cd63e1a3ea094d88f36d5c0ca9b88ba` on 2026-09-22. Re-check before you start.  Found while landing #2750. Each item below reproduces in a webpack project that declares `@module-federation/enhanced` and exposes `./src/Button.tsx`. The inline object literal is the control, and it credits the exposed file.  ### 1. Options that an import holds stay unread and record nothing  `read_plugin_call` resolves the first argument through `resolve_object_expression` (`crates/core/src/plugins/module_federation.rs:359`). That resolver reads an object literal or a top-level binding of the same file (`crates/core/src/plugins/config_parser.rs:1366`). Options from another file resolve to nothing, and the reader returns without a diagnostic.  Minimal input:  ```js // webpack.config.js const { ModuleFederationPlugin } = require('@module-federation/enhanced'); const mfConfig = require('./mf.config'); module.exports = { plugins: [new ModuleFederationPlugin(mfConfig)] }; ```  The run reports `src/Button.tsx` as `unused-file`, and no plugin diagnostic names the config. The tracked fixtures and the `cra/*` and `unit-test/*` examples of the upstream project use this shape.  Wanted: follow a relative import or require of a config file in the same project. Record `plugin-config-unreadable` when the target cannot be read.  ### 2. A spread options object stays unread and records nothing  The resolver returns the object literal, and `declares_federation_
  **Post-Mortem & Fix Analysis**:
  > Released in v3.29.0.

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

### Incident Patch 1: `7960c061` (2026-10-05)
**Commit Message**: Merge pull request #3206 from fallow-rs/fix/health-hotspot-penalty-3203

fix(health): count thresholded hotspots and guard formula changes

**File**: `.agents/skills/fallow/references/cli-reference.md` (modified, +16/-10)
```diff
@@ -869,15 +869,19 @@ All `health` JSON output includes a `vital_signs` object with project-wide metri
 }
 ```
 
-Fields are `null` when the corresponding data source is not available (e.g., `hotspot_count` is null without `--hotspots` or when git is not available). Health score formula v2 also uses scale-invariant density/tail fields: `critical_complexity_pct`, `hotspot_top_pct_count`, `maintainability_low_pct`, `unused_deps_per_k_files`, `circular_deps_per_k_files`, and `functions_over_60_loc_per_k`. The `unit_size_profile` and `unit_interfacing_profile` are risk distribution histograms (low risk / medium risk / high risk / very high risk as percentages). `p95_fan_in` is the 95th percentile of incoming dependencies. `coupling_high_pct` is the percentage of files above the effective coupling threshold.
+Fields are `null` when the corresponding data source is not available (e.g., `hotspot_count` is null without `--hotspots` or when git is not available).
+
+Health score formula v3 retains the scale-invariant density and tail fields: `critical_complexity_pct`, `maintainability_low_pct`, `unused_deps_per_k_files`, `circular_deps_per_k_files`, and `functions_over_60_loc_per_k`. The hotspot penalty is `hotspot_count / max(ceil(total_files × 0.01), 1) × 10`, capped at 10. Only files with a hotspot score of at least 50 enter `hotspot_count`; an empty scope has no hotspot penalty. `hotspot_top_pct_count` remains a rank diagnostic and does not determine the penalty.
+
+The `unit_size_profile` and `unit_interfacing_profile` are risk distribution histograms (low risk / medium risk / high risk / very high risk as percentages). `p95_fan_in` is the 95th percentile of incoming dependencies. `coupling_high_pct` is the percentage of files above the effective coupling threshold.
 
 With `--score`, the JSON output includes a `health_score` object:
 
 ```json
 {
   "health_score": {
-    "formula_version": 2,
-    "score": 76.9,
+    "formula_version": 3,
+    "score": 72.9,
     "grade": "B",
     "penalties": {
       "dead_files": 3.1,
@@ -895,7 +899,7 @@ With `--score`, the JSON output includes a `health_score` object:
 }
 ```
 
-Score is reproducible: `100 - sum(penalties) == score`. `formula_version` identifies the scoring formula; version 2 uses scale-invariant density and tail metrics for monorepo-safe scoring. Penalty fields are absent when the pipeline didn't run. `--score` automatically runs duplication analysis; add `--hotspots` (or combine `--score --targets`) when the score should include the churn-backed hotspot penalty. Grades: A (>= 85), B (70-84), C (55-69), D (40-54), F (< 40).
+Score is reproducible: `100 - sum(penalties) == score`. `formula_version` identifies the scoring formula; version 3 retains the density and tail metrics from version 2 and corrects the hotspot penalty to use the thresholded count. Penalty fields are absent when the pipeline didn't run. `--score` automatically runs duplication analysis; add `--hotspots` (or combine `--score --targets`) when the score should include the churn-backed hotspot penalty. Grades: A (>= 85), B (70-84), C (55-69), D (40-54), F (< 40).
 
 ### Health Trend
 
@@ -907,15 +911,16 @@ With `--trend`, the JSON output includes a `health_trend` object comparing curre
     "compared_to": {
       "timestamp": "2026-03-25T14:30:00Z",
       "git_sha": "a1b2c3d",
-      "score": 74.2,
-      "grade": "B"
+      "score": 70.2,
+      "grade": "B",
+      "score_formula_version": 3
     },
     "metrics": [
       {
         "name": "score",
         "label": "Health Score",
-        "previous": 74.2,
-        "current": 76.9,
+        "previous": 70.2,
+        "current": 72.9,
         "delta": 2.7,
         "direction": "improving",
         "unit": ""
@@ -938,16 +943,17 @@ With `--trend`, the JSON output includes a `health_trend` object comparing curre
 }
 ```
 
-Metrics tracked: `score`, `dead_file_pct`, `dead_export_pct`, `avg_cyclomatic`, `maintainability_avg`, `unused_dep_count`, `circular_dep_count`, `hotspot_count`, `unit_size_very_high_pct`, `p95_fan_in`, `duplication_pct`. Each metric includes `direction` (`improving`, `declining`, `stable`). Percentage metrics include `previous_count`/`current_count` with raw numerator/denominator. `--trend` requires at least one saved snapshot in `.fallow/snapshots/`. When comparing against a snapshot from an older schema version (current: v8), the trend output warns that score deltas may reflect formula changes.
+Metrics tracked: `score`, `dead_file_pct`, `dead_export_pct`, `avg_cyclomatic`, `maintainability_avg`, `unused_dep_count`, `circular_dep_count`, `hotspot_count`, `unit_size_very_high_pct`, `p95_fan_in`, `duplication_pct`. Each metric includes `direction` (`improving`, `declining`, `stable`). Percentage metrics include `previous_count`/`current_count` with raw numerator and denominator. `--trend` requires at least one saved snapshot in `.fallow/snapshots/`. Current snapshots use schema version 12 and record `score_for
```

**File**: `.claude/skills/fallow/references/cli-reference.md` (modified, +16/-10)
```diff
@@ -869,15 +869,19 @@ All `health` JSON output includes a `vital_signs` object with project-wide metri
 }
 ```
 
-Fields are `null` when the corresponding data source is not available (e.g., `hotspot_count` is null without `--hotspots` or when git is not available). Health score formula v2 also uses scale-invariant density/tail fields: `critical_complexity_pct`, `hotspot_top_pct_count`, `maintainability_low_pct`, `unused_deps_per_k_files`, `circular_deps_per_k_files`, and `functions_over_60_loc_per_k`. The `unit_size_profile` and `unit_interfacing_profile` are risk distribution histograms (low risk / medium risk / high risk / very high risk as percentages). `p95_fan_in` is the 95th percentile of incoming dependencies. `coupling_high_pct` is the percentage of files above the effective coupling threshold.
+Fields are `null` when the corresponding data source is not available (e.g., `hotspot_count` is null without `--hotspots` or when git is not available).
+
+Health score formula v3 retains the scale-invariant density and tail fields: `critical_complexity_pct`, `maintainability_low_pct`, `unused_deps_per_k_files`, `circular_deps_per_k_files`, and `functions_over_60_loc_per_k`. The hotspot penalty is `hotspot_count / max(ceil(total_files × 0.01), 1) × 10`, capped at 10. Only files with a hotspot score of at least 50 enter `hotspot_count`; an empty scope has no hotspot penalty. `hotspot_top_pct_count` remains a rank diagnostic and does not determine the penalty.
+
+The `unit_size_profile` and `unit_interfacing_profile` are risk distribution histograms (low risk / medium risk / high risk / very high risk as percentages). `p95_fan_in` is the 95th percentile of incoming dependencies. `coupling_high_pct` is the percentage of files above the effective coupling threshold.
 
 With `--score`, the JSON output includes a `health_score` object:
 
 ```json
 {
   "health_score": {
-    "formula_version": 2,
-    "score": 76.9,
+    "formula_version": 3,
+    "score": 72.9,
     "grade": "B",
     "penalties": {
       "dead_files": 3.1,
@@ -895,7 +899,7 @@ With `--score`, the JSON output includes a `health_score` object:
 }
 ```
 
-Score is reproducible: `100 - sum(penalties) == score`. `formula_version` identifies the scoring formula; version 2 uses scale-invariant density and tail metrics for monorepo-safe scoring. Penalty fields are absent when the pipeline didn't run. `--score` automatically runs duplication analysis; add `--hotspots` (or combine `--score --targets`) when the score should include the churn-backed hotspot penalty. Grades: A (>= 85), B (70-84), C (55-69), D (40-54), F (< 40).
+Score is reproducible: `100 - sum(penalties) == score`. `formula_version` identifies the scoring formula; version 3 retains the density and tail metrics from version 2 and corrects the hotspot penalty to use the thresholded count. Penalty fields are absent when the pipeline didn't run. `--score` automatically runs duplication analysis; add `--hotspots` (or combine `--score --targets`) when the score should include the churn-backed hotspot penalty. Grades: A (>= 85), B (70-84), C (55-69), D (40-54), F (< 40).
 
 ### Health Trend
 
@@ -907,15 +911,16 @@ With `--trend`, the JSON output includes a `health_trend` object comparing curre
     "compared_to": {
       "timestamp": "2026-03-25T14:30:00Z",
       "git_sha": "a1b2c3d",
-      "score": 74.2,
-      "grade": "B"
+      "score": 70.2,
+      "grade": "B",
+      "score_formula_version": 3
     },
     "metrics": [
       {
         "name": "score",
         "label": "Health Score",
-        "previous": 74.2,
-        "current": 76.9,
+        "previous": 70.2,
+        "current": 72.9,
         "delta": 2.7,
         "direction": "improving",
         "unit": ""
@@ -938,16 +943,17 @@ With `--trend`, the JSON output includes a `health_trend` object comparing curre
 }
 ```
 
-Metrics tracked: `score`, `dead_file_pct`, `dead_export_pct`, `avg_cyclomatic`, `maintainability_avg`, `unused_dep_count`, `circular_dep_count`, `hotspot_count`, `unit_size_very_high_pct`, `p95_fan_in`, `duplication_pct`. Each metric includes `direction` (`improving`, `declining`, `stable`). Percentage metrics include `previous_count`/`current_count` with raw numerator/denominator. `--trend` requires at least one saved snapshot in `.fallow/snapshots/`. When comparing against a snapshot from an older schema version (current: v8), the trend output warns that score deltas may reflect formula changes.
+Metrics tracked: `score`, `dead_file_pct`, `dead_export_pct`, `avg_cyclomatic`, `maintainability_avg`, `unused_dep_count`, `circular_dep_count`, `hotspot_count`, `unit_size_very_high_pct`, `p95_fan_in`, `duplication_pct`. Each metric includes `direction` (`improving`, `declining`, `stable`). Percentage metrics include `previous_count`/`current_count` with raw numerator and denominator. `--trend` requires at least one saved snapshot in `.fallow/snapshots/`. Current snapshots use schema version 12 and record `score_for
```

**File**: `.github/workflows/ci.yml` (modified, +10/-0)
```diff
@@ -685,6 +685,15 @@ jobs:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
         with:
           persist-credentials: false
+      # The companion can pin a skill change only after main contains it.
+      - name: Check out public base skill contract
+        if: github.event_name == 'pull_request'
+        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
+        with:
+          repository: ${{ github.repository }}
+          ref: ${{ github.event.pull_request.base.sha }}
+          path: .fallow-skills-base
+          persist-credentials: false
       # The released product contract lives in this repository. The companion
       # skills repo packages it for agent hosts and may add host interface
       # files plus the declared plugin frontmatter transform.
@@ -697,6 +706,7 @@ jobs:
         with:
           node-version: '22'
       - name: Check public skill matches the Fallow source contract
+        working-directory: ${{ github.event_name == 'pull_request' && '.fallow-skills-base' || '.' }}
         env:
           FALLOW_SKILLS_DIR: ${{ github.workspace }}/.fallow-skills-src
         run: node scripts/vendor-skills.mjs --check
```

**File**: `CHANGELOG.md` (modified, +22/-0)
```diff
@@ -180,6 +180,28 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   known projects' entries. The graph cache version increases to invalidate
   entry classifications from older builds.
 
+- **The health score penalizes hotspots only when their score reaches 50.**
+  Previously, the top-one-percent rank bucket could apply the maximum
+  hotspot penalty even when every file was below that threshold. Formula
+  version 3 uses the thresholded hotspot count; the rank bucket remains a
+  diagnostic. Limiting the hotspot display with `--top` keeps the full
+  score and snapshot metrics. Snapshots record the score
+  formula used. Trends compare scores only when both formulas are known and
+  equal. Raw metric trends and historical scores remain available. Thanks to
+  [@PaulCailly](https://github.com/PaulCailly) for the report
+  ([#3203](https://github.com/fallow-rs/fallow/issues/3203)).
+
+- **Public skill updates can pass CI before companion publication.** Pull
+  requests check the published companion against their exact public base
+  commit. Candidate contracts and adapters retain their generation checks.
+  Pushes compare the current source, so landed drift fails until the
+  companion matches.
+
+- **The PR CI waiter uses the current GitHub check rollup.** A newer failed,
+  cancelled or pending check can no longer be hidden by an older success.
+  Required-only waits keep their scope, and superseded checks from the same
+  workflow use the newest run.
+
 - **An orphan module declaration file is now reported as an unused file.**
   Before, fallow made every `.d.ts`, `.d.mts` and `.d.cts` file an entry
   point and never reported one, so a stale declaration file and every module
```

**File**: `crates/api/src/compact_output.rs` (modified, +18/-0)
```diff
@@ -1011,6 +1011,24 @@ fn push_hotspots_compact(
 
 fn push_health_trend_compact(lines: &mut Vec<String>, report: &fallow_output::HealthReport) {
     if let Some(ref trend) = report.health_trend {
+        if let Some(current) = report.health_score.as_ref()
+            && trend.compared_to.score.is_some()
+            && !trend.metrics.iter().any(|metric| metric.name == "score")
+            && fallow_output::health_score_comparison_note(
+                trend.compared_to.score_formula_version,
+                Some(current.formula_version),
+            )
+            .is_some()
+        {
+            let previous_formula = trend
+                .compared_to
+                .score_formula_version
+                .map_or_else(|| "unknown".to_owned(), |version| version.to_string());
+            lines.push(format!(
+                "trend:score-omitted:previous_formula={previous_formula},current_formula={}",
+                current.formula_version,
+            ));
+        }
         lines.push(format!(
             "trend:overall:direction={}",
             trend.overall_direction.label()
```

**File**: `crates/api/src/markdown_output.rs` (modified, +10/-0)
```diff
@@ -1891,6 +1891,16 @@ fn write_trend_section(out: &mut String, report: &fallow_output::HealthReport) {
             .unwrap_or(&trend.compared_to.timestamp),
         sha_str,
     );
+    if let Some(current) = report.health_score.as_ref()
+        && trend.compared_to.score.is_some()
+        && !trend.metrics.iter().any(|metric| metric.name == "score")
+        && let Some(note) = fallow_output::health_score_comparison_note(
+            trend.compared_to.score_formula_version,
+            Some(current.formula_version),
+        )
+    {
+        let _ = writeln!(out, "*{note}*\n");
+    }
     out.push_str("| Metric | Previous | Current | Delta | Direction |\n");
     out.push_str("|:-------|:---------|:--------|:------|:----------|\n");
     for m in &trend.metrics {
```

**File**: `crates/cli/src/report/github_summary.rs` (modified, +20/-0)
```diff
@@ -1515,6 +1515,26 @@ fn health_score_header(score_env: &Value) -> String {
                 signed(f_or_zero(cx_delta, "delta")),
             );
         }
+    } else if let Some(compared) = score_env
+        .get("health_trend")
+        .and_then(|trend| trend.get("compared_to"))
+    {
+        let previous_formula = compared
+            .get("score_formula_version")
+            .and_then(Value::as_u64)
+            .and_then(|version| u32::try_from(version).ok());
+        let current_formula = score
+            .get("formula_version")
+            .and_then(Value::as_u64)
+            .and_then(|version| u32::try_from(version).ok());
+        let note = compared
+            .get("score")
+            .and_then(Value::as_f64)
+            .and_then(|_| {
+                fallow_output::health_score_comparison_note(previous_formula, current_formula)
+            })
+            .unwrap_or("Score comparison unavailable for this snapshot.");
+        let _ = write!(header, "\n> _{note}_");
     } else {
         header.push_str("\n> _Enable `save-snapshot: true` to track score trends over time._");
     }
```

**File**: `crates/cli/src/report/human/health.rs` (modified, +17/-3)
```diff
@@ -1385,12 +1385,22 @@ fn push_trend_header_line(lines: &mut Vec<String>, trend: &fallow_output::Health
     ));
 }
 
-/// Renders the optional CRAP-model-change and snapshot-schema-version notes.
+/// Renders score-formula, CRAP-model and snapshot-schema compatibility notes.
 fn push_trend_model_notes(
     lines: &mut Vec<String>,
     trend: &fallow_output::HealthTrend,
     report: &fallow_output::HealthReport,
 ) {
+    if let Some(current) = report.health_score.as_ref()
+        && trend.compared_to.score.is_some()
+        && !trend.metrics.iter().any(|metric| metric.name == "score")
+        && let Some(note) = fallow_output::health_score_comparison_note(
+            trend.compared_to.score_formula_version,
+            Some(current.formula_version),
+        )
+    {
+        lines.push(format!("  {}", note.yellow()));
+    }
     if let (Some(prev_model), Some(cur_model)) = (
         &trend.compared_to.coverage_model,
         &report.summary.coverage_model,
@@ -1415,8 +1425,7 @@ fn push_trend_model_notes(
         lines.push(format!(
             "  {}",
             format!(
-                "note: compared snapshot uses schema v{prev_version}, this run writes v{}; score comparison still valid",
-                fallow_output::SNAPSHOT_SCHEMA_VERSION
+                "note: compared snapshot uses schema v{prev_version}; available raw metrics remain comparable"
             )
             .yellow()
         ));
@@ -4535,6 +4544,7 @@ mod tests {
                 git_sha: Some("abc1234".into()),
                 score: Some(72.0),
                 grade: Some("B".into()),
+                score_formula_version: Some(fallow_output::HEALTH_SCORE_FORMULA_VERSION),
                 coverage_model: None,
                 snapshot_schema_version: None,
             },
@@ -4587,6 +4597,7 @@ mod tests {
                 git_sha: None,
                 score: None,
                 grade: None,
+                score_formula_version: None,
                 coverage_model: None,
                 snapshot_schema_version: None,
             },
@@ -4620,6 +4631,7 @@ mod tests {
                 git_sha: Some("def5678".into()),
                 score: Some(80.0),
                 grade: Some("B".into()),
+                score_formula_version: Some(fallow_output::HEALTH_SCORE_FORMULA_VERSION),
                 coverage_model: None,
                 snapshot_schema_version: None,
             },
@@ -4667,6 +4679,7 @@ mod tests {
                 git_sha: None,
                 score: None,
                 grade: None,
+                score_formula_version: None,
                 coverage_model: None,
                 snapshot_schema_version: None,
             },
@@ -4804,6 +4817,7 @@ mod tests {
                 git_sha: None,
                 score: None,
                 grade: None,
+                score_formula_version: None,
                 coverage_model: None,
                 snapshot_schema_version: None,
             },
```

---

### Incident Patch 2: `a70f1b86` (2026-10-05)
**Commit Message**: fix(ci): verify current PR checks and public skill parity

**File**: `.github/workflows/ci.yml` (modified, +10/-0)
```diff
@@ -685,6 +685,15 @@ jobs:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
         with:
           persist-credentials: false
+      # The companion can pin a skill change only after main contains it.
+      - name: Check out public base skill contract
+        if: github.event_name == 'pull_request'
+        uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
+        with:
+          repository: ${{ github.repository }}
+          ref: ${{ github.event.pull_request.base.sha }}
+          path: .fallow-skills-base
+          persist-credentials: false
       # The released product contract lives in this repository. The companion
       # skills repo packages it for agent hosts and may add host interface
       # files plus the declared plugin frontmatter transform.
@@ -697,6 +706,7 @@ jobs:
         with:
           node-version: '22'
       - name: Check public skill matches the Fallow source contract
+        working-directory: ${{ github.event_name == 'pull_request' && '.fallow-skills-base' || '.' }}
         env:
           FALLOW_SKILLS_DIR: ${{ github.workspace }}/.fallow-skills-src
         run: node scripts/vendor-skills.mjs --check
```

**File**: `CHANGELOG.md` (modified, +17/-6)
```diff
@@ -179,18 +179,29 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   Unknown project directories keep conventional test patterns without dropping
   known projects' entries. The graph cache version increases to invalidate
   entry classifications from older builds.
+
 - **The health score penalizes hotspots only when their score reaches 50.**
   Previously, the top-one-percent rank bucket could apply the maximum
   hotspot penalty even when every file was below that threshold. Formula
-  version 3 uses the thresholded hotspot count; the rank
-  bucket remains a diagnostic. Limiting the hotspot display with `--top`
-  keeps the full score and snapshot metrics. Snapshots record the score
-  formula used, and
-  trends compare scores only when both formulas are known and equal. Raw
-  metric trends and historical scores remain available. Thanks to
+  version 3 uses the thresholded hotspot count; the rank bucket remains a
+  diagnostic. Limiting the hotspot display with `--top` keeps the full
+  score and snapshot metrics. Snapshots record the score
+  formula used. Trends compare scores only when both formulas are known and
+  equal. Raw metric trends and historical scores remain available. Thanks to
   [@PaulCailly](https://github.com/PaulCailly) for the report
   ([#3203](https://github.com/fallow-rs/fallow/issues/3203)).
 
+- **Public skill updates can pass CI before companion publication.** Pull
+  requests check the published companion against their exact public base
+  commit. Candidate contracts and adapters retain their generation checks.
+  Pushes compare the current source, so landed drift fails until the
+  companion matches.
+
+- **The PR CI waiter uses the current GitHub check rollup.** A newer failed,
+  cancelled or pending check can no longer be hidden by an older success.
+  Required-only waits keep their scope, and superseded checks from the same
+  workflow use the newest run.
+
 - **An orphan module declaration file is now reported as an unused file.**
   Before, fallow made every `.d.ts`, `.d.mts` and `.d.cts` file an entry
   point and never reported one, so a stale declaration file and every module
```

**File**: `docs/development/knowledge-architecture.md` (modified, +4/-0)
```diff
@@ -73,6 +73,10 @@ Private consumers pin both values. The portable skill repository records the
 exact Fallow source commit, source root, target root, and declared transform.
 After a skill change lands on `main`, `node scripts/sync-skills-companion.mjs`
 prepares the signed companion commit. The maintainer pushes it.
+Pull requests compare the published companion with their exact public base
+commit, while required generation checks validate the candidate contracts and
+adapters. Pushes compare the current source and keep failing on landed drift
+until the companion is synchronized.
 Protocol consumers pin the public crate in their lockfile and verify published
 sidecar parity.
 
```

**File**: `scripts/generate-agent-docs.mjs` (modified, +3/-3)
```diff
@@ -740,9 +740,9 @@ export const formatCuratedSeedDrift = (comparison, { recording = false, recordPa
     "moved. Rewrite the curated cell in the skill tree when its prose no longer matches;",
     "`npm run generate:contracts` records the current seeds.",
     "A rewritten cell under npm/fallow/skills/fallow must also land in fallow-rs/fallow-skills:",
-    "the Public skills contract check compares the two. Merge a fallow-skills PR first, with",
-    "source-lock.json pinned to this branch's head commit; after the squash merge, pin it to",
-    "the merged commit.",
+    "merge the source change into main, then run `node scripts/sync-skills-companion.mjs`",
+    "and push the signed companion commit. PR checks compare the published skill with",
+    "the exact public base; push checks compare it with the current source.",
   );
   return lines.join("\n");
 };
```

**File**: `scripts/ship-wait-checks.mjs` (modified, +235/-9)
```diff
@@ -16,6 +16,9 @@ import { fileURLToPath } from "node:url";
 import { parseArgs } from "node:util";
 
 const GH_PENDING_EXIT = 8;
+const GH_FAILED_CHECK_EXIT = 1;
+const GITHUB_RUN_URL_PATTERN =
+  /^https:\/\/github\.com\/([\w.-]+)\/([\w.-]+)\/actions\/runs\/([1-9]\d*)(?:\/job\/[1-9]\d*)?$/u;
 // gh prints "no required checks reported" for `--required` when no required
 // check exists yet.
 const NO_CHECKS_PATTERN = /no (?:required )?checks reported/iu;
@@ -307,8 +310,9 @@ export const parseGhChecks = ({ error, status, stdout, stderr }) => {
   if (error) {
     return { ok: false, error: error.message };
   }
-  // gh exits with 8 while a check is pending. The JSON is still complete.
-  if (status === 0 || status === GH_PENDING_EXIT) {
+  // Pending and failed checks still have complete JSON for name selection.
+  const failedChecks = status === GH_FAILED_CHECK_EXIT && stdout.trim() !== "";
+  if (status === 0 || status === GH_PENDING_EXIT || failedChecks) {
     try {
       return { ok: true, checks: JSON.parse(stdout) };
     } catch (parseError) {
@@ -321,6 +325,195 @@ export const parseGhChecks = ({ error, status, stdout, stderr }) => {
   return { ok: false, error: stderr.trim() || `gh exited with ${status}` };
 };
 
+const rollupCheck = (entry) => {
+  if (
+    entry?.__typename === "CheckRun" &&
+    typeof entry.name === "string" &&
+    typeof entry.status === "string"
+  ) {
+    return {
+      name: entry.name,
+      bucket:
+        entry.status === "COMPLETED"
+          ? (RUN_BUCKETS.get(entry.conclusion?.toLowerCase()) ?? "fail")
+          : "pending",
+      link: entry.detailsUrl,
+    };
+  }
+  if (
+    entry?.__typename === "StatusContext" &&
+    typeof entry.context === "string" &&
+    typeof entry.state === "string"
+  ) {
+    const pending = entry.state === "PENDING" || entry.state === "EXPECTED";
+    return {
+      name: entry.context,
+      bucket: pending ? "pending" : entry.state === "SUCCESS" ? "pass" : "fail",
+      link: entry.targetUrl,
+    };
+  }
+  throw new Error("invalid statusCheckRollup entry");
+};
+
+const worstCheck = (checks) =>
+  checks.find(({ bucket }) => bucket === "pending") ??
+  checks.find(({ bucket }) => bucket === "fail") ??
+  checks.find(({ bucket }) => bucket === "cancel") ??
+  checks[0];
+
+const currentRollupChecks = (rollup, readRun, names) => {
+  const checks = rollup.map(rollupCheck);
+  const groups = new Map();
+  for (const [index, entry] of rollup.entries()) {
+    if (
+      entry.__typename !== "CheckRun" ||
+      typeof entry.workflowName !== "string" ||
+      entry.workflowName === "" ||
+      (names !== null && !names.has(entry.name))
+    ) {
+      continue;
+    }
+    const key = JSON.stringify([entry.workflowName, entry.name]);
+    const group = groups.get(key) ?? [];
+    group.push(index);
+    groups.set(key, group);
+  }
+  const removed = new Set();
+  for (const group of groups.values()) {
+    if (group.length < 2) {
+      continue;
+    }
+    const identities = new Map();
+    const unknown = [];
+    for (const index of group) {
+      const result = readRun === null ? { ok: true, run: null } : readRun(rollup[index].detailsUrl);
+      if (!result.ok) {
+        return result;
+      }
+      if (result.run === null) {
+        unknown.push(index);
+        continue;
+      }
+      const key = JSON.stringify([result.run.workflowId, result.run.head]);
+      const runs = identities.get(key) ?? [];
+      runs.push({ index, ...result.run });
+      identities.set(key, runs);
+    }
+    // Job start and completion order can differ from workflow creation order.
+    // Display names alone cannot distinguish different workflows or commits.
+    const representatives = [];
+    for (const runs of identities.values()) {
+      const newest = Math.max(...runs.map(({ createdAt }) => createdAt));
+      const latest = runs.filter(({ createdAt }) => createdAt === newest);
+      const active = latest.length === 1 ? latest : runs;
+      const first = runs[0].index;
+      checks[first] = worstCheck(active.map(({ index }) => checks[index]));
+      representatives.push(first);
+      for (const { index } of runs.slice(1)) {
+        removed.add(index);
+      }
+    }
+    // Unknown entries prove no additional identity, but must keep blocking.
+    if (unknown.length > 0) {
+      const first = representatives[0] ?? unknown[0];
+      const candidates = unknown.map((index) => checks[index]);
+      if (representatives.length > 0) {
+        candidates.unshift(checks[first]);
+      }
+      checks[first] = worstCheck(candidates);
+      for (const index of unknown) {
+        if (index !== first) {
+          removed.add(index);
+        }
+      }
+    }
+  }
+  return {
+    ok: true,
+    checks: checks.filter(
+      ({ name }, index) => !removed.has(index) && (names === null || names.has(name)),
+    ),
+  };
+};
+
+/**
+ * Read the authoritative current-head checks returned by `gh pr view`.
+ * Option
```

**File**: `scripts/ship-wait-checks.test.mjs` (modified, +520/-0)
```diff
@@ -1,5 +1,8 @@
 import assert from "node:assert/strict";
 import { spawnSync } from "node:child_process";
+import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
+import { tmpdir } from "node:os";
+import { delimiter, join } from "node:path";
 import { test } from "node:test";
 import { fileURLToPath } from "node:url";
 
@@ -245,6 +248,14 @@ test("parseGhChecks reads both gh messages for a pull request without checks", (
   }
 });
 
+test("parseGhChecks accepts failed-check JSON for required-name selection", () => {
+  const checks = [check("Commit messages", "fail")];
+  assert.deepEqual(parseGhChecks({ status: 1, stdout: JSON.stringify(checks), stderr: "" }), {
+    ok: true,
+    checks,
+  });
+});
+
 test("parseGhChecks reports a failed run, invalid JSON and a spawn error", () => {
   assert.deepEqual(parseGhChecks({ status: 1, stdout: "", stderr: "HTTP 502\n" }), {
     ok: false,
@@ -304,6 +315,515 @@ test("parseGhRuns turns each workflow run into a check", () => {
   );
 });
 
+const checkRun = (name, status, conclusion) => ({
+  __typename: "CheckRun",
+  name,
+  status,
+  conclusion,
+  detailsUrl: `https://example.invalid/current/${name}`,
+});
+
+const runWithFakeGh = ({ selected, rollups, runs = workflowRuns() }, args = []) => {
+  const root = mkdtempSync(join(tmpdir(), "ship-wait-checks-"));
+  try {
+    writeFileSync(join(root, "responses.json"), JSON.stringify({ selected, rollups, runs }));
+    writeFileSync(
+      join(root, "gh"),
+      [
+        "#!/usr/bin/env node",
+        'const fs = require("node:fs");',
+        'const path = require("node:path");',
+        'const responses = JSON.parse(fs.readFileSync(path.join(__dirname, "responses.json"), "utf8"));',
+        'const callsPath = path.join(__dirname, "calls.json");',
+        'const calls = fs.existsSync(callsPath) ? JSON.parse(fs.readFileSync(callsPath, "utf8")) : [];',
+        "const args = process.argv.slice(2);",
+        "calls.push(args);",
+        "fs.writeFileSync(callsPath, JSON.stringify(calls));",
+        'if (args[0] === "pr" && args[1] === "checks") {',
+        "  process.stdout.write(JSON.stringify(responses.selected));",
+        '} else if (args.some((arg) => arg.includes("statusCheckRollup"))) {',
+        '  const index = calls.filter((call) => call.some((arg) => arg.includes("statusCheckRollup"))).length - 1;',
+        "  const reply = responses.rollups[Math.min(index, responses.rollups.length - 1)];",
+        '  process.stdout.write(typeof reply === "string" ? reply : JSON.stringify(reply));',
+        '} else if (args[0] === "api") {',
+        "  const reply = responses.runs[args[1]];",
+        '  if (!reply || reply.error) { process.stderr.write(reply?.error ?? "missing workflow run"); process.exit(1); }',
+        "  process.stdout.write(JSON.stringify(reply));",
+        '} else if (args[0] === "pr" && args[1] === "view") {',
+        '  process.stdout.write(JSON.stringify({ mergeable: "MERGEABLE", mergeStateStatus: "BLOCKED" }));',
+        "} else {",
+        '  process.stderr.write("unexpected gh command");',
+        "  process.exit(1);",
+        "}",
+      ].join("\n"),
+      { mode: 0o755 },
+    );
+    const result = spawnSync(
+      process.execPath,
+      [SCRIPT, "--pr", "7", "--interval", "1", "--timeout", "1", ...args],
+      { env: { ...process.env, PATH: `${root}${delimiter}${process.env.PATH}` }, encoding: "utf8" },
+    );
+    const calls = existsSync(join(root, "calls.json"))
+      ? JSON.parse(readFileSync(join(root, "calls.json"), "utf8"))
+      : [];
+    return { ...result, calls };
+  } finally {
+    rmSync(root, { recursive: true, force: true });
+  }
+};
+
+const rollupReads = (calls) =>
+  calls.filter((args) => args.some((arg) => arg.includes("statusCheckRollup")));
+const fakeGhOptions = { skip: process.platform === "win32" };
+
+const EARLIER_START = "2026-10-05T11:05:44Z";
+const NEWER_START = "2026-10-05T11:05:51Z";
+const EARLIER_RUN = "200";
+const NEWER_RUN = "100";
+const RUN_ENDPOINT = "repos/example/project/actions/runs";
+const RUN_URL = "https://github.com/example/project/actions/runs";
+const workflowRuns = () =>
+  Object.fromEntries(
+    [
+      [EARLIER_RUN, EARLIER_START],
+      [NEWER_RUN, NEWER_START],
+    ].map(([id, created_at]) => [
+      `${RUN_ENDPOINT}/${id}`,
+      { created_at, html_url: `${RUN_URL}/${id}`, workflow_id: 7, head_sha: "a".repeat(40) },
+    ]),
+  );
+const attempt = (
+  conclusion,
+  startedAt,
+  workflowName = "Commitlint",
+  run = startedAt === EARLIER_START ? EARLIER_RUN : NEWER_RUN,
+) => ({
+  ...checkRun("Commit messages", "COMPLETED", conclusion),
+  startedAt,
+  workflowName,
+  detailsUrl: `${RUN_URL}/${run}/job/1`,
+});
+
+test(
+  "the CLI uses the newest same-workflow attempt in all-check and required modes",
+  fakeGhOptions,
+  () => {
+    for (const args of [[], ["--required"]]) {
+      for (const [older, newer] of [
+        ["CANCELLED", "SUCCESS"]
```

**File**: `scripts/vendor-skills.test.mjs` (modified, +63/-1)
```diff
@@ -8,7 +8,7 @@ import {
   symlinkSync,
   writeFileSync,
 } from "node:fs";
-import { execFileSync } from "node:child_process";
+import { execFileSync, spawnSync } from "node:child_process";
 import { realpathSync } from "node:fs";
 import { tmpdir } from "node:os";
 import { dirname, join } from "node:path";
@@ -290,3 +290,65 @@ test("a released skill without a published tree is drift", () => {
   assert.deepEqual(diffTrees(canonical, missing).missing, ["SKILL.md"]);
   assert.equal(runCheck(canonical, missing, { renderDiffs: false }), 1);
 });
+
+test("base parity permits candidate changes but rejects published drift and strict current drift", () => {
+  const sourceSkill = "---\nname: fallow\nmetadata:\n  version: 1.0.0\n---\n# Fallow\n";
+  const publishedSkill = stripUnsupportedMetadata(sourceSkill);
+  const baseReference = "The released command contract.\n";
+  const candidateReference = "The candidate command contract adds a documented fix.\n";
+  const scriptFiles = Object.fromEntries(
+    ["vendor-skills.mjs", "released-skills.mjs"].map((name) => [
+      `scripts/${name}`,
+      readFileSync(new URL(name, import.meta.url), "utf8"),
+    ]),
+  );
+  const sourceFiles = {
+    ...scriptFiles,
+    "npm/fallow/skills/fallow/SKILL.md": sourceSkill,
+  };
+  const fixture = makeTree({
+    ...Object.fromEntries(
+      Object.entries(sourceFiles).map(([path, text]) => [`base/${path}`, text]),
+    ),
+    ...Object.fromEntries(
+      Object.entries(sourceFiles).map(([path, text]) => [`candidate/${path}`, text]),
+    ),
+    "base/npm/fallow/skills/fallow/references/cli.md": baseReference,
+    "candidate/npm/fallow/skills/fallow/references/cli.md": candidateReference,
+    "companion/fallow/skills/fallow/SKILL.md": publishedSkill,
+    "companion/fallow/skills/fallow/references/cli.md": baseReference,
+  });
+  const check = (source, args = ["--check"]) =>
+    spawnSync(process.execPath, ["scripts/vendor-skills.mjs", ...args], {
+      cwd: join(fixture, source),
+      env: { ...gitEnv(), FALLOW_SKILLS_DIR: join(fixture, "companion") },
+      encoding: "utf8",
+    });
+  try {
+    const base = check("base");
+    assert.equal(base.status, 0, base.stderr);
+    const current = check("candidate");
+    assert.equal(current.status, 1, current.stderr);
+    assert.match(current.stderr, /differs: references\/cli\.md/u);
+    assert.equal(
+      readFileSync(join(fixture, "companion/fallow/skills/fallow/references/cli.md"), "utf8"),
+      baseReference,
+      "checks must not publish candidate content",
+    );
+
+    writeFileSync(
+      join(fixture, "companion/fallow/skills/fallow/references/cli.md"),
+      "stale content\n",
+    );
+    const publishedDrift = check("base");
+    assert.equal(publishedDrift.status, 1, publishedDrift.stderr);
+    assert.match(publishedDrift.stderr, /differs: references\/cli\.md/u);
+
+    const synchronized = check("candidate", []);
+    assert.equal(synchronized.status, 0, synchronized.stderr);
+    const currentAfterSync = check("candidate");
+    assert.equal(currentAfterSync.status, 0, currentAfterSync.stderr);
+  } finally {
+    rmSync(fixture, { recursive: true, force: true });
+  }
+});
```

**File**: `scripts/workflow-policy.test.mjs` (modified, +26/-0)
```diff
@@ -97,6 +97,32 @@ test("fuzz workflow runs every harness with bounded scheduled coverage", () => {
   }
 });
 
+test("public skill PR parity uses the exact base while push and candidate checks stay strict", () => {
+  const workflow = readWorkflow(".github/workflows/ci.yml");
+  const job = indentedBlock(workflow, "skills-vendor", 2);
+  const checkJob = indentedBlock(workflow, "check", 2);
+  const jsJob = indentedBlock(workflow, "js-lint", 2);
+  const aggregate = indentedBlock(workflow, "ci-ok", 2);
+  const rustPaths = listedPaths(indentedBlock(workflow, "rust", 12));
+
+  assert.match(
+    job,
+    /name: Check out public base skill contract\n\s+if: github\.event_name == 'pull_request'\n\s+uses: actions\/checkout@[^\n]+\n\s+with:\n\s+repository: \$\{\{ github\.repository \}\}\n\s+ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}\n\s+path: \.fallow-skills-base\n\s+persist-credentials: false/u,
+  );
+  assert.match(
+    job,
+    /working-directory: \$\{\{ github\.event_name == 'pull_request' && '\.fallow-skills-base' \|\| '\.' \}\}/u,
+  );
+  assert.match(job, /run: node scripts\/vendor-skills\.mjs --check/u);
+  assert.match(job, /FALLOW_SKILLS_DIR: \$\{\{ github\.workspace \}\}\/\.fallow-skills-src/u);
+  assert.doesNotMatch(job, /continue-on-error: true|contents: write|id-token: write/u);
+  assert.match(aggregate, /needs: \[[^\n]*skills-vendor/u);
+  assert.ok(rustPaths.includes("npm/fallow/skills/fallow/**"));
+  assert.ok(rustPaths.includes("npm/fallow/skills/fallow-setup/**"));
+  assert.match(checkJob, /run: CI=true npm run generate:contracts:check/u);
+  assert.match(jsJob, /run: npm run check:agent-adapters/u);
+});
+
 test("bundled skill validation uses the root lockfile without network fallback", () => {
   const workflow = readWorkflow(".github/workflows/ci.yml");
   const npmPackageJob = indentedBlock(workflow, "npm-package", 2);
```

---

### Incident Patch 3: `19508c3f` (2026-10-05)
**Commit Message**: fix(health): count thresholded hotspots and guard score trends

**File**: `.agents/skills/fallow/references/cli-reference.md` (modified, +16/-10)
```diff
@@ -869,15 +869,19 @@ All `health` JSON output includes a `vital_signs` object with project-wide metri
 }
 ```
 
-Fields are `null` when the corresponding data source is not available (e.g., `hotspot_count` is null without `--hotspots` or when git is not available). Health score formula v2 also uses scale-invariant density/tail fields: `critical_complexity_pct`, `hotspot_top_pct_count`, `maintainability_low_pct`, `unused_deps_per_k_files`, `circular_deps_per_k_files`, and `functions_over_60_loc_per_k`. The `unit_size_profile` and `unit_interfacing_profile` are risk distribution histograms (low risk / medium risk / high risk / very high risk as percentages). `p95_fan_in` is the 95th percentile of incoming dependencies. `coupling_high_pct` is the percentage of files above the effective coupling threshold.
+Fields are `null` when the corresponding data source is not available (e.g., `hotspot_count` is null without `--hotspots` or when git is not available).
+
+Health score formula v3 retains the scale-invariant density and tail fields: `critical_complexity_pct`, `maintainability_low_pct`, `unused_deps_per_k_files`, `circular_deps_per_k_files`, and `functions_over_60_loc_per_k`. The hotspot penalty is `hotspot_count / max(ceil(total_files × 0.01), 1) × 10`, capped at 10. Only files with a hotspot score of at least 50 enter `hotspot_count`; an empty scope has no hotspot penalty. `hotspot_top_pct_count` remains a rank diagnostic and does not determine the penalty.
+
+The `unit_size_profile` and `unit_interfacing_profile` are risk distribution histograms (low risk / medium risk / high risk / very high risk as percentages). `p95_fan_in` is the 95th percentile of incoming dependencies. `coupling_high_pct` is the percentage of files above the effective coupling threshold.
 
 With `--score`, the JSON output includes a `health_score` object:
 
 ```json
 {
   "health_score": {
-    "formula_version": 2,
-    "score": 76.9,
+    "formula_version": 3,
+    "score": 72.9,
     "grade": "B",
     "penalties": {
       "dead_files": 3.1,
@@ -895,7 +899,7 @@ With `--score`, the JSON output includes a `health_score` object:
 }
 ```
 
-Score is reproducible: `100 - sum(penalties) == score`. `formula_version` identifies the scoring formula; version 2 uses scale-invariant density and tail metrics for monorepo-safe scoring. Penalty fields are absent when the pipeline didn't run. `--score` automatically runs duplication analysis; add `--hotspots` (or combine `--score --targets`) when the score should include the churn-backed hotspot penalty. Grades: A (>= 85), B (70-84), C (55-69), D (40-54), F (< 40).
+Score is reproducible: `100 - sum(penalties) == score`. `formula_version` identifies the scoring formula; version 3 retains the density and tail metrics from version 2 and corrects the hotspot penalty to use the thresholded count. Penalty fields are absent when the pipeline didn't run. `--score` automatically runs duplication analysis; add `--hotspots` (or combine `--score --targets`) when the score should include the churn-backed hotspot penalty. Grades: A (>= 85), B (70-84), C (55-69), D (40-54), F (< 40).
 
 ### Health Trend
 
@@ -907,15 +911,16 @@ With `--trend`, the JSON output includes a `health_trend` object comparing curre
     "compared_to": {
       "timestamp": "2026-03-25T14:30:00Z",
       "git_sha": "a1b2c3d",
-      "score": 74.2,
-      "grade": "B"
+      "score": 70.2,
+      "grade": "B",
+      "score_formula_version": 3
     },
     "metrics": [
       {
         "name": "score",
         "label": "Health Score",
-        "previous": 74.2,
-        "current": 76.9,
+        "previous": 70.2,
+        "current": 72.9,
         "delta": 2.7,
         "direction": "improving",
         "unit": ""
@@ -938,16 +943,17 @@ With `--trend`, the JSON output includes a `health_trend` object comparing curre
 }
 ```
 
-Metrics tracked: `score`, `dead_file_pct`, `dead_export_pct`, `avg_cyclomatic`, `maintainability_avg`, `unused_dep_count`, `circular_dep_count`, `hotspot_count`, `unit_size_very_high_pct`, `p95_fan_in`, `duplication_pct`. Each metric includes `direction` (`improving`, `declining`, `stable`). Percentage metrics include `previous_count`/`current_count` with raw numerator/denominator. `--trend` requires at least one saved snapshot in `.fallow/snapshots/`. When comparing against a snapshot from an older schema version (current: v8), the trend output warns that score deltas may reflect formula changes.
+Metrics tracked: `score`, `dead_file_pct`, `dead_export_pct`, `avg_cyclomatic`, `maintainability_avg`, `unused_dep_count`, `circular_dep_count`, `hotspot_count`, `unit_size_very_high_pct`, `p95_fan_in`, `duplication_pct`. Each metric includes `direction` (`improving`, `declining`, `stable`). Percentage metrics include `previous_count`/`current_count` with raw numerator and denominator. `--trend` requires at least one saved snapshot in `.fallow/snapshots/`. Current snapshots use schema version 12 and record `score_for
```

**File**: `.claude/skills/fallow/references/cli-reference.md` (modified, +16/-10)
```diff
@@ -869,15 +869,19 @@ All `health` JSON output includes a `vital_signs` object with project-wide metri
 }
 ```
 
-Fields are `null` when the corresponding data source is not available (e.g., `hotspot_count` is null without `--hotspots` or when git is not available). Health score formula v2 also uses scale-invariant density/tail fields: `critical_complexity_pct`, `hotspot_top_pct_count`, `maintainability_low_pct`, `unused_deps_per_k_files`, `circular_deps_per_k_files`, and `functions_over_60_loc_per_k`. The `unit_size_profile` and `unit_interfacing_profile` are risk distribution histograms (low risk / medium risk / high risk / very high risk as percentages). `p95_fan_in` is the 95th percentile of incoming dependencies. `coupling_high_pct` is the percentage of files above the effective coupling threshold.
+Fields are `null` when the corresponding data source is not available (e.g., `hotspot_count` is null without `--hotspots` or when git is not available).
+
+Health score formula v3 retains the scale-invariant density and tail fields: `critical_complexity_pct`, `maintainability_low_pct`, `unused_deps_per_k_files`, `circular_deps_per_k_files`, and `functions_over_60_loc_per_k`. The hotspot penalty is `hotspot_count / max(ceil(total_files × 0.01), 1) × 10`, capped at 10. Only files with a hotspot score of at least 50 enter `hotspot_count`; an empty scope has no hotspot penalty. `hotspot_top_pct_count` remains a rank diagnostic and does not determine the penalty.
+
+The `unit_size_profile` and `unit_interfacing_profile` are risk distribution histograms (low risk / medium risk / high risk / very high risk as percentages). `p95_fan_in` is the 95th percentile of incoming dependencies. `coupling_high_pct` is the percentage of files above the effective coupling threshold.
 
 With `--score`, the JSON output includes a `health_score` object:
 
 ```json
 {
   "health_score": {
-    "formula_version": 2,
-    "score": 76.9,
+    "formula_version": 3,
+    "score": 72.9,
     "grade": "B",
     "penalties": {
       "dead_files": 3.1,
@@ -895,7 +899,7 @@ With `--score`, the JSON output includes a `health_score` object:
 }
 ```
 
-Score is reproducible: `100 - sum(penalties) == score`. `formula_version` identifies the scoring formula; version 2 uses scale-invariant density and tail metrics for monorepo-safe scoring. Penalty fields are absent when the pipeline didn't run. `--score` automatically runs duplication analysis; add `--hotspots` (or combine `--score --targets`) when the score should include the churn-backed hotspot penalty. Grades: A (>= 85), B (70-84), C (55-69), D (40-54), F (< 40).
+Score is reproducible: `100 - sum(penalties) == score`. `formula_version` identifies the scoring formula; version 3 retains the density and tail metrics from version 2 and corrects the hotspot penalty to use the thresholded count. Penalty fields are absent when the pipeline didn't run. `--score` automatically runs duplication analysis; add `--hotspots` (or combine `--score --targets`) when the score should include the churn-backed hotspot penalty. Grades: A (>= 85), B (70-84), C (55-69), D (40-54), F (< 40).
 
 ### Health Trend
 
@@ -907,15 +911,16 @@ With `--trend`, the JSON output includes a `health_trend` object comparing curre
     "compared_to": {
       "timestamp": "2026-03-25T14:30:00Z",
       "git_sha": "a1b2c3d",
-      "score": 74.2,
-      "grade": "B"
+      "score": 70.2,
+      "grade": "B",
+      "score_formula_version": 3
     },
     "metrics": [
       {
         "name": "score",
         "label": "Health Score",
-        "previous": 74.2,
-        "current": 76.9,
+        "previous": 70.2,
+        "current": 72.9,
         "delta": 2.7,
         "direction": "improving",
         "unit": ""
@@ -938,16 +943,17 @@ With `--trend`, the JSON output includes a `health_trend` object comparing curre
 }
 ```
 
-Metrics tracked: `score`, `dead_file_pct`, `dead_export_pct`, `avg_cyclomatic`, `maintainability_avg`, `unused_dep_count`, `circular_dep_count`, `hotspot_count`, `unit_size_very_high_pct`, `p95_fan_in`, `duplication_pct`. Each metric includes `direction` (`improving`, `declining`, `stable`). Percentage metrics include `previous_count`/`current_count` with raw numerator/denominator. `--trend` requires at least one saved snapshot in `.fallow/snapshots/`. When comparing against a snapshot from an older schema version (current: v8), the trend output warns that score deltas may reflect formula changes.
+Metrics tracked: `score`, `dead_file_pct`, `dead_export_pct`, `avg_cyclomatic`, `maintainability_avg`, `unused_dep_count`, `circular_dep_count`, `hotspot_count`, `unit_size_very_high_pct`, `p95_fan_in`, `duplication_pct`. Each metric includes `direction` (`improving`, `declining`, `stable`). Percentage metrics include `previous_count`/`current_count` with raw numerator and denominator. `--trend` requires at least one saved snapshot in `.fallow/snapshots/`. Current snapshots use schema version 12 and record `score_for
```

**File**: `CHANGELOG.md` (modified, +11/-0)
```diff
@@ -179,6 +179,17 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   Unknown project directories keep conventional test patterns without dropping
   known projects' entries. The graph cache version increases to invalidate
   entry classifications from older builds.
+- **The health score penalizes hotspots only when their score reaches 50.**
+  Previously, the top-one-percent rank bucket could apply the maximum
+  hotspot penalty even when every file was below that threshold. Formula
+  version 3 uses the thresholded hotspot count; the rank
+  bucket remains a diagnostic. Limiting the hotspot display with `--top`
+  keeps the full score and snapshot metrics. Snapshots record the score
+  formula used, and
+  trends compare scores only when both formulas are known and equal. Raw
+  metric trends and historical scores remain available. Thanks to
+  [@PaulCailly](https://github.com/PaulCailly) for the report
+  ([#3203](https://github.com/fallow-rs/fallow/issues/3203)).
 
 - **An orphan module declaration file is now reported as an unused file.**
   Before, fallow made every `.d.ts`, `.d.mts` and `.d.cts` file an entry
```

**File**: `crates/api/src/compact_output.rs` (modified, +18/-0)
```diff
@@ -1011,6 +1011,24 @@ fn push_hotspots_compact(
 
 fn push_health_trend_compact(lines: &mut Vec<String>, report: &fallow_output::HealthReport) {
     if let Some(ref trend) = report.health_trend {
+        if let Some(current) = report.health_score.as_ref()
+            && trend.compared_to.score.is_some()
+            && !trend.metrics.iter().any(|metric| metric.name == "score")
+            && fallow_output::health_score_comparison_note(
+                trend.compared_to.score_formula_version,
+                Some(current.formula_version),
+            )
+            .is_some()
+        {
+            let previous_formula = trend
+                .compared_to
+                .score_formula_version
+                .map_or_else(|| "unknown".to_owned(), |version| version.to_string());
+            lines.push(format!(
+                "trend:score-omitted:previous_formula={previous_formula},current_formula={}",
+                current.formula_version,
+            ));
+        }
         lines.push(format!(
             "trend:overall:direction={}",
             trend.overall_direction.label()
```

**File**: `crates/api/src/markdown_output.rs` (modified, +10/-0)
```diff
@@ -1891,6 +1891,16 @@ fn write_trend_section(out: &mut String, report: &fallow_output::HealthReport) {
             .unwrap_or(&trend.compared_to.timestamp),
         sha_str,
     );
+    if let Some(current) = report.health_score.as_ref()
+        && trend.compared_to.score.is_some()
+        && !trend.metrics.iter().any(|metric| metric.name == "score")
+        && let Some(note) = fallow_output::health_score_comparison_note(
+            trend.compared_to.score_formula_version,
+            Some(current.formula_version),
+        )
+    {
+        let _ = writeln!(out, "*{note}*\n");
+    }
     out.push_str("| Metric | Previous | Current | Delta | Direction |\n");
     out.push_str("|:-------|:---------|:--------|:------|:----------|\n");
     for m in &trend.metrics {
```

**File**: `crates/cli/src/report/github_summary.rs` (modified, +20/-0)
```diff
@@ -1515,6 +1515,26 @@ fn health_score_header(score_env: &Value) -> String {
                 signed(f_or_zero(cx_delta, "delta")),
             );
         }
+    } else if let Some(compared) = score_env
+        .get("health_trend")
+        .and_then(|trend| trend.get("compared_to"))
+    {
+        let previous_formula = compared
+            .get("score_formula_version")
+            .and_then(Value::as_u64)
+            .and_then(|version| u32::try_from(version).ok());
+        let current_formula = score
+            .get("formula_version")
+            .and_then(Value::as_u64)
+            .and_then(|version| u32::try_from(version).ok());
+        let note = compared
+            .get("score")
+            .and_then(Value::as_f64)
+            .and_then(|_| {
+                fallow_output::health_score_comparison_note(previous_formula, current_formula)
+            })
+            .unwrap_or("Score comparison unavailable for this snapshot.");
+        let _ = write!(header, "\n> _{note}_");
     } else {
         header.push_str("\n> _Enable `save-snapshot: true` to track score trends over time._");
     }
```

**File**: `crates/cli/src/report/human/health.rs` (modified, +17/-3)
```diff
@@ -1385,12 +1385,22 @@ fn push_trend_header_line(lines: &mut Vec<String>, trend: &fallow_output::Health
     ));
 }
 
-/// Renders the optional CRAP-model-change and snapshot-schema-version notes.
+/// Renders score-formula, CRAP-model and snapshot-schema compatibility notes.
 fn push_trend_model_notes(
     lines: &mut Vec<String>,
     trend: &fallow_output::HealthTrend,
     report: &fallow_output::HealthReport,
 ) {
+    if let Some(current) = report.health_score.as_ref()
+        && trend.compared_to.score.is_some()
+        && !trend.metrics.iter().any(|metric| metric.name == "score")
+        && let Some(note) = fallow_output::health_score_comparison_note(
+            trend.compared_to.score_formula_version,
+            Some(current.formula_version),
+        )
+    {
+        lines.push(format!("  {}", note.yellow()));
+    }
     if let (Some(prev_model), Some(cur_model)) = (
         &trend.compared_to.coverage_model,
         &report.summary.coverage_model,
@@ -1415,8 +1425,7 @@ fn push_trend_model_notes(
         lines.push(format!(
             "  {}",
             format!(
-                "note: compared snapshot uses schema v{prev_version}, this run writes v{}; score comparison still valid",
-                fallow_output::SNAPSHOT_SCHEMA_VERSION
+                "note: compared snapshot uses schema v{prev_version}; available raw metrics remain comparable"
             )
             .yellow()
         ));
@@ -4535,6 +4544,7 @@ mod tests {
                 git_sha: Some("abc1234".into()),
                 score: Some(72.0),
                 grade: Some("B".into()),
+                score_formula_version: Some(fallow_output::HEALTH_SCORE_FORMULA_VERSION),
                 coverage_model: None,
                 snapshot_schema_version: None,
             },
@@ -4587,6 +4597,7 @@ mod tests {
                 git_sha: None,
                 score: None,
                 grade: None,
+                score_formula_version: None,
                 coverage_model: None,
                 snapshot_schema_version: None,
             },
@@ -4620,6 +4631,7 @@ mod tests {
                 git_sha: Some("def5678".into()),
                 score: Some(80.0),
                 grade: Some("B".into()),
+                score_formula_version: Some(fallow_output::HEALTH_SCORE_FORMULA_VERSION),
                 coverage_model: None,
                 snapshot_schema_version: None,
             },
@@ -4667,6 +4679,7 @@ mod tests {
                 git_sha: None,
                 score: None,
                 grade: None,
+                score_formula_version: None,
                 coverage_model: None,
                 snapshot_schema_version: None,
             },
@@ -4804,6 +4817,7 @@ mod tests {
                 git_sha: None,
                 score: None,
                 grade: None,
+                score_formula_version: None,
                 coverage_model: None,
                 snapshot_schema_version: None,
             },
```

**File**: `crates/cli/tests/integration/health_group_trend_tests.rs` (modified, +368/-2)
```diff
@@ -277,19 +277,193 @@ fn top_applies_to_each_group_and_keeps_the_counts() {
     assert_eq!(top["findings"].as_array().map_or(0, Vec::len), 1);
 }
 
+#[test]
+fn top_zero_hides_hotspots_without_changing_nonzero_scores_or_saved_vitals() {
+    let dir = project();
+    let root = dir.path();
+    let timestamp = std::time::SystemTime::now()
+        .duration_since(std::time::UNIX_EPOCH)
+        .unwrap()
+        .as_secs();
+    let mut events = Vec::new();
+    for path in ["src/a/one.ts", "src/b/one.ts"] {
+        for _ in 0..3 {
+            events.push(serde_json::json!({
+                "path": path,
+                "timestamp": timestamp,
+                "author": "maintainer@example.com",
+                "added": 1,
+                "deleted": 0,
+            }));
+        }
+    }
+    std::fs::write(
+        root.join("churn.json"),
+        serde_json::to_vec(&serde_json::json!({ "schema": "fallow-churn/v1", "events": events }))
+            .unwrap(),
+    )
+    .unwrap();
+    for grouped in [false, true] {
+        let run = |extra: &[&str]| -> Value {
+            let mut args = vec![
+                "--score",
+                "--hotspots",
+                "--churn-file",
+                "churn.json",
+                "--format",
+                "json",
+                "--quiet",
+            ];
+            if grouped {
+                args.extend(["--group-by", "owner"]);
+            }
+            args.extend_from_slice(extra);
+            let output = run_fallow_in_root("health", root, &args);
+            assert!(matches!(output.code, 0 | 1), "{}", output.stderr);
+            parse_json(&output)
+        };
+        let full = run(&[]);
+        let snapshot = root.join("top-zero-snapshot.json");
+        let snapshot_arg = snapshot.display().to_string();
+        let hidden = run(&["--top", "0", "--save-snapshot", &snapshot_arg]);
+        assert_eq!(full["hotspots"].as_array().unwrap().len(), 2);
+        assert!(
+            full["hotspots"].as_array().unwrap().iter().all(|hotspot| {
+                hotspot["score"].as_f64().unwrap() >= fallow_output::HOTSPOT_SCORE_THRESHOLD
+            }),
+            "{full:#}"
+        );
+        assert_eq!(hidden["hotspots"].as_array().map_or(0, Vec::len), 0);
+        assert_eq!(full["vital_signs"]["hotspot_count"], 2);
+        assert_eq!(full["health_score"]["penalties"]["hotspots"], 10.0);
+        assert_eq!(hidden["vital_signs"], full["vital_signs"]);
+        assert_eq!(hidden["health_score"], full["health_score"]);
+        let stored: Value = serde_json::from_slice(&std::fs::read(&snapshot).unwrap()).unwrap();
+        assert_eq!(stored["vital_signs"], full["vital_signs"]);
+        assert_eq!(stored["score"], full["health_score"]["score"]);
+        if grouped {
+            for key in ["@team/a", "@team/b"] {
+                let full_group = group(&full, key);
+                let hidden_group = group(&hidden, key);
+                assert_eq!(full_group["vital_signs"]["hotspot_count"], 1);
+                assert_eq!(full_group["health_score"]["penalties"]["hotspots"], 10.0);
+                assert_eq!(hidden_group["hotspots"].as_array().map_or(0, Vec::len), 0);
+                assert_eq!(hidden_group["vital_signs"], full_group["vital_signs"]);
+                assert_eq!(hidden_group["health_score"], full_group["health_score"]);
+            }
+        }
+    }
+}
+
+#[test]
+fn subthreshold_hotspots_keep_rank_counts_without_penalizing_project_or_groups() {
+    let dir = project();
+    let root = dir.path();
+    let mut low_complexity =
+        String::from("export function bOne(x: number): number {\n  let n = x;\n");
+    for i in 0..100 {
+        let _ = writeln!(low_complexity, "  n += {i};");
+    }
+    low_complexity.push_str("  return n;\n}\n");
+    std::fs::write(root.join("src/b/one.ts"), low_complexity).unwrap();
+    let timestamp = std::time::SystemTime::now()
+        .duration_since(std::time::UNIX_EPOCH)
+        .unwrap()
+        .as_secs();
+    let mut events = Vec::new();
+    for (path, commits) in [("src/a/one.ts", 3), ("src/b/one.ts", 30)] {
+        for _ in 0..commits {
+            events.push(serde_json::json!({
+                "path": path,
+                "timestamp": timestamp,
+                "author": "maintainer@example.com",
+                "added": 1,
+                "deleted": 0,
+            }));
+        }
+    }
+    let churn = serde_json::json!({ "schema": "fallow-churn/v1", "events": events });
+    std::fs::write(root.join("churn.json"), serde_json::to_vec(&churn).unwrap()).unwrap();
+    let full = health_json(
+        root,
+        &["--score", "--hotspots", "--churn-file", "churn.json"],
+    );
+    let limited = health_json(
+        root,
+        &[
+            "--score",
+            "--hotspots",
+            "--churn-file",
+            "churn.json",
+            "--top",
+            "1",
+        ],
+    );
+    assert_eq!(full["hotspots"].
```

---

### Incident Patch 4: `3a487ecc` (2026-10-05)
**Commit Message**: Merge pull request #3202 from osazemeu/fix/directory-index-over-style-sibling

fix(resolve): preserve module precedence across resolution routes

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -159,6 +159,16 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- **Script directory imports no longer resolve to a sibling stylesheet or
+  component.** An import of `./Button` now reaches `Button/index.ts` before
+  an inferred `Button.css` or `Button.vue`. The same rule applies to aliases,
+  import maps and workspace package paths. Explicit asset targets, JSON
+  modules and stylesheet resolution keep their existing behavior. Cached
+  resolution graphs are rebuilt on upgrade. Thanks to
+  [@osazemeu](https://github.com/osazemeu) for the report and initial fix
+  ([#3201](https://github.com/fallow-rs/fallow/issues/3201),
+  [#3202](https://github.com/fallow-rs/fallow/pull/3202)).
+
 - **Playwright entries follow static `testDir` and `testMatch` settings.**
   Helpers outside the configured test directory can now report unused exports.
   Project overrides inherit top-level settings, and multiple configs keep
```

**File**: `crates/core/tests/integration_test.rs` (modified, +2/-0)
```diff
@@ -45,6 +45,8 @@ mod deno_workspace;
 mod dependencies;
 #[path = "integration_test/deprecated_exports.rs"]
 mod deprecated_exports;
+#[path = "integration_test/directory_resolution.rs"]
+mod directory_resolution;
 #[path = "integration_test/duplicate_prop_shape.rs"]
 mod duplicate_prop_shape;
 #[path = "integration_test/dynamic_import_then.rs"]
```

**File**: `crates/core/tests/integration_test/directory_resolution.rs` (added, +363/-0)
```diff
@@ -0,0 +1,363 @@
+use super::common::{create_config, create_config_with_cache};
+use fallow_types::cache_rejection::CacheRejection;
+use std::path::Path;
+
+const PRE_SCRIPT_EXTENSION_CACHE_VERSION: u32 = 67;
+const VITE_PACKAGE: &str =
+    r#"{"name":"directory-resolution","private":true,"devDependencies":{"vite":"*"}}"#;
+
+fn write(root: &Path, path: &str, source: &str) {
+    let path = root.join(path);
+    std::fs::create_dir_all(path.parent().expect("parent")).expect("directory");
+    std::fs::write(path, source).expect("fixture file");
+}
+
+fn project(files: &[(&str, &str)]) -> tempfile::TempDir {
+    let dir = tempfile::tempdir().expect("project");
+    write(
+        dir.path(),
+        "package.json",
+        r#"{"name":"directory-resolution","private":true}"#,
+    );
+    for (path, source) in files {
+        write(dir.path(), path, source);
+    }
+    dir
+}
+
+fn unused_files(root: &Path) -> Vec<String> {
+    let mut config = create_config(root.to_path_buf());
+    config.entry_patterns = vec!["src/index.*".to_string()];
+    fallow_core::analyze(&config)
+        .expect("analysis")
+        .unused_files
+        .iter()
+        .map(|file| {
+            file.file
+                .path
+                .strip_prefix(root)
+                .expect("project-relative finding")
+                .to_string_lossy()
+                .replace('\\', "/")
+        })
+        .collect()
+}
+
+fn assert_edge(root: &Path, from: &str, target: &str, expected: bool) {
+    let mut config = create_config(root.to_path_buf());
+    config.entry_patterns = vec!["src/index.*".to_string()];
+    let graph = fallow_core::analyze_with_trace(&config)
+        .expect("analysis with graph")
+        .graph
+        .expect("retained graph");
+    let source = graph
+        .modules
+        .iter()
+        .find(|module| module.path.ends_with(from))
+        .expect("importer discovered");
+    assert!(source.is_reachable(), "importer must be live: {from}");
+    let target = graph
+        .modules
+        .iter()
+        .find(|module| module.path.ends_with(target))
+        .expect("target discovered");
+    assert_eq!(
+        graph.edges_for(source.file_id).contains(&target.file_id),
+        expected,
+        "unexpected edge from {from} to {}",
+        target.path.display()
+    );
+}
+
+fn assert_vite_alias(root: &Path, prefix: &str, replacement: &str) {
+    let package: fallow_config::PackageJson = serde_json::from_str(
+        &std::fs::read_to_string(root.join("package.json")).expect("package source"),
+    )
+    .expect("package JSON");
+    let plugins = fallow_core::plugins::PluginRegistry::default()
+        .try_run(&package, root, &[root.join("vite.config.ts")])
+        .expect("plugin configuration");
+    assert!(
+        plugins.active_plugins.iter().any(|plugin| plugin == "vite"),
+        "Vite must be active for this alias fixture"
+    );
+    assert!(
+        plugins
+            .path_aliases
+            .iter()
+            .any(|(find, target)| { find == prefix && Path::new(target).ends_with(replacement) }),
+        "Vite must produce the requested alias: {:?}",
+        plugins.path_aliases
+    );
+}
+
+#[test]
+fn explicit_alias_and_package_maps_keep_asset_targets() {
+    for extension in ["vue", "css"] {
+        for mapping in ["tsconfig", "imports", "exports"] {
+            let component = format!("src/Widget.{extension}");
+            let (package, tsconfig, specifier) = match mapping {
+                "tsconfig" => (
+                    r#"{"name":"directory-resolution","private":true}"#.to_string(),
+                    format!(
+                        r#"{{"compilerOptions":{{"paths":{{"@app/Widget":["./{component}"]}}}},"include":["src"]}}"#
+                    ),
+                    "@app/Widget",
+                ),
+                "imports" => (
+                    format!(
+                        r##"{{"name":"directory-resolution","private":true,"imports":{{"#components/Widget":"./{component}"}}}}"##
+                    ),
+                    "{}".to_string(),
+                    "#components/Widget",
+                ),
+                _ => (
+                    format!(
+                        r#"{{"name":"directory-resolution","private":true,"exports":{{"./Widget":"./{component}"}}}}"#
+                    ),
+                    "{}".to_string(),
+                    "directory-resolution/Widget",
+                ),
+            };
+            let entry = format!("import '{specifier}';\n");
+            let dir = project(&[
+                ("package.json", &package),
+                ("tsconfig.json", &tsconfig),
+                ("src/index.ts", &entry),
+                (&component, "<template><div>widget</div></template>"),
+                ("src/Widget/index.ts", "export const unused = 1;"),
+            ]);
+            let unused = unused_files(dir.path());
+            assert!(
+                unused.contains(&"
```

**File**: `crates/core/tests/integration_test/false_positive_fixes.rs` (modified, +60/-0)
```diff
@@ -81,6 +81,66 @@ fn eslint_relative_extends_config_is_not_reported_unused() {
     );
 }
 
+#[test]
+fn extensionless_import_prefers_directory_index_over_non_module_sibling() {
+    for (index, sibling) in [
+        "tsx", "ts", "js", "jsx", "mts", "cts", "mjs", "cjs", "gts", "gjs",
+    ]
+    .into_iter()
+    .flat_map(|index| {
+        [
+            "css", "scss", "vue", "svelte", "astro", "mdx", "graphql", "gql",
+        ]
+        .map(move |sibling| (index, sibling))
+    }) {
+        let dir = tempfile::tempdir().expect("temp dir");
+        let root = dir.path();
+        std::fs::create_dir_all(root.join("src/Widget")).expect("src dir");
+        std::fs::write(
+            root.join("package.json"),
+            r#"{ "name": "directory-index-sibling", "private": true }"#,
+        )
+        .expect("package json");
+        std::fs::write(
+            root.join("src/index.ts"),
+            "import { Widget } from './Widget';\nconsole.log(Widget());\n",
+        )
+        .expect("entry");
+        std::fs::write(
+            root.join(format!("src/Widget/index.{index}")),
+            "export function Widget() { return 'widget'; }\n\
+             export function UnusedHelper() { return 'unused'; }\n",
+        )
+        .expect("directory index");
+        std::fs::write(root.join(format!("src/Widget.{sibling}")), "{}\n").expect("sibling");
+
+        let config = create_config(root.to_path_buf());
+        let results = fallow_core::analyze(&config).expect("analysis should succeed");
+
+        let unused_files: Vec<String> = results
+            .unused_files
+            .iter()
+            .map(|file| file.file.path.to_string_lossy().replace('\\', "/"))
+            .collect();
+        assert!(
+            !unused_files
+                .iter()
+                .any(|path| path.ends_with(&format!("Widget/index.{index}"))),
+            "./Widget must resolve to Widget/index.{index}, not Widget.{sibling}: {unused_files:?}"
+        );
+        let unused_exports: Vec<&str> = results
+            .unused_exports
+            .iter()
+            .map(|e| e.export.export_name.as_str())
+            .collect();
+        assert_eq!(
+            unused_exports,
+            ["UnusedHelper"],
+            "only UnusedHelper is unused in Widget/index.{index} with a Widget.{sibling} sibling"
+        );
+    }
+}
+
 #[test]
 fn type_only_bidirectional_import_not_reported_as_cycle() {
     let root = fixture_path("type-only-cycle");
```

**File**: `crates/graph/src/cache/mod.rs` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ pub use store::{GRAPH_CACHE_FILE, GraphCacheStore};
 /// Never reuse a version number that a published build wrote, even from a
 /// development commit. Git history and the CHANGELOG record the reason for
 /// each bump.
-pub const GRAPH_CACHE_VERSION: u32 = 67;
+pub const GRAPH_CACHE_VERSION: u32 = 68;
 
 /// Cached form of a resolved target.
 ///
```

**File**: `crates/graph/src/resolve/fallbacks.rs` (modified, +29/-8)
```diff
@@ -37,6 +37,7 @@ fn alias_match_remainder<'a>(specifier: &'a str, prefix: &str) -> Option<&'a str
 pub(super) fn try_path_alias_fallback(
     ctx: &ResolveContext<'_>,
     specifier: &str,
+    style_context: bool,
 ) -> Option<ResolveResult> {
     for (prefix, replacement) in ctx.path_aliases {
         let Some(remainder) = alias_match_remainder(specifier, prefix) else {
@@ -49,8 +50,12 @@ pub(super) fn try_path_alias_fallback(
             (false, false) => format!("./{replacement}/{remainder}"),
         };
 
-        super::work::note_oxc_resolve();
-        if let Ok(resolved) = ctx.resolver.resolve(ctx.root, &substituted) {
+        if let Ok(resolved) = super::specifier::resolve_with_extension_policy(
+            ctx,
+            ctx.root,
+            &substituted,
+            style_context,
+        ) {
             let resolved_path = resolved.path();
             if let Some(&file_id) = ctx.raw_path_to_id.get(resolved_path) {
                 return Some(ResolveResult::InternalModule(file_id));
@@ -1111,6 +1116,7 @@ pub(super) fn try_pnpm_workspace_fallback(
 pub(super) fn try_workspace_package_fallback(
     ctx: &ResolveContext<'_>,
     specifier: &str,
+    style_context: bool,
 ) -> Option<ResolveResult> {
     if !super::path_info::is_bare_specifier(specifier) {
         return None;
@@ -1136,7 +1142,7 @@ pub(super) fn try_workspace_package_fallback(
             *ctx.workspace_roots.get(pkg_name.as_str())?
         };
 
-    resolve_workspace_self_reference(ctx, ws_root, subpath, pkg_name)
+    resolve_workspace_self_reference(ctx, ws_root, subpath, pkg_name, style_context)
 }
 
 /// Outcome of attempting workspace resolution through a matching package
@@ -1244,16 +1250,27 @@ fn resolve_workspace_self_reference(
     ws_root: &Path,
     subpath: &str,
     package_name: String,
+    style_context: bool,
 ) -> Option<ResolveResult> {
-    let root_file = ws_root.join("__fallow_ws_self_resolve__");
     let rel_spec = if subpath.is_empty() {
         "./".to_string()
     } else {
         format!("./{subpath}")
     };
 
-    super::work::note_oxc_resolve();
-    let resolved = ctx.resolver.resolve_file(&root_file, &rel_spec).ok()?;
+    let root_file = ws_root.join("__fallow_ws_self_resolve__");
+    let super::specifier::ResolveFileAttempt::Resolved {
+        resolution: resolved,
+        ..
+    } = super::specifier::resolve_file_with_tsconfig_fallback(
+        ctx,
+        &root_file,
+        &rel_spec,
+        style_context,
+    )
+    else {
+        return None;
+    };
     let resolved_path = resolved.path();
 
     if let Some(&file_id) = ctx.raw_path_to_id.get(resolved_path) {
@@ -1333,8 +1350,10 @@ mod tests {
         let tsconfig_warned = std::sync::Mutex::new(FxHashSet::default());
         let tsconfig_cache = TsconfigCache::default();
         let canonicalize_cache = CanonicalizeCache::default();
+        let script_resolver = crate::resolve::specifier::create_script_resolver(&resolver);
         let ctx = ResolveContext {
             resolver: &resolver,
+            script_resolver: &script_resolver,
             style_resolver: &resolver,
             extensions: &[],
             path_to_id: &path_to_id,
@@ -2967,8 +2986,10 @@ mod tests {
         let tsconfig_cache = TsconfigCache::default();
         let canonicalize_cache = CanonicalizeCache::default();
         let root = PathBuf::from("/project");
+        let script_resolver = crate::resolve::specifier::create_script_resolver(&resolver);
         let ctx = ResolveContext {
             resolver: &resolver,
+            script_resolver: &script_resolver,
             style_resolver: &resolver,
             extensions: &[],
             path_to_id: &path_to_id,
@@ -3038,7 +3059,7 @@ mod tests {
         let root = PathBuf::from("/project");
         let pj = fallow_config::PackageJson::default();
         with_package_map_ctx(root, None, pj, &[], |ctx, _manifest, _r| {
-            let result = try_workspace_package_fallback(ctx, "./local/module");
+            let result = try_workspace_package_fallback(ctx, "./local/module", false);
             assert!(
                 result.is_none(),
                 "relative specifier should return None from workspace fallback"
@@ -3052,7 +3073,7 @@ mod tests {
         let root = PathBuf::from("/project");
         let pj = fallow_config::PackageJson::default();
         with_package_map_ctx(root, None, pj, &[], |ctx, _manifest, _r| {
-            let result = try_workspace_package_fallback(ctx, "/absolute/path");
+            let result = try_workspace_package_fallback(ctx, "/absolute/path", false);
             assert!(
                 result.is_none(),
                 "absolute path should return None from workspace fallback"
```

**File**: `crates/graph/src/resolve/mod.rs` (modified, +4/-0)
```diff
@@ -106,6 +106,7 @@ pub struct ResolveAllImportsInput<'a> {
 /// every resolution instead of rebuilding this state per call.
 pub struct ResolverSession {
     resolver: oxc_resolver::Resolver,
+    script_resolver: oxc_resolver::Resolver,
     style_resolver: oxc_resolver::Resolver,
     extensions: Vec<String>,
     condition_names: Vec<String>,
@@ -139,6 +140,7 @@ impl ResolverSession {
         let extensions = build_extensions(input.active_plugins);
         let condition_names = build_condition_names(input.active_plugins, input.extra_conditions);
         let resolver = create_resolver(input.root, input.active_plugins, input.extra_conditions);
+        let script_resolver = specifier::create_script_resolver(&resolver);
         let mut style_conditions = input.extra_conditions.to_vec();
         style_conditions.push("sass".to_string());
         style_conditions.push("style".to_string());
@@ -152,6 +154,7 @@ impl ResolverSession {
 
         Self {
             resolver,
+            script_resolver,
             style_resolver,
             extensions,
             condition_names,
@@ -211,6 +214,7 @@ pub fn resolve_all_imports_with_session(
 
     let ctx = ResolveContext {
         resolver: &session.resolver,
+        script_resolver: &session.script_resolver,
         style_resolver: &session.style_resolver,
         extensions: &session.extensions,
         path_to_id: &path_to_id,
```

**File**: `crates/graph/src/resolve/specifier.rs` (modified, +250/-21)
```diff
@@ -46,6 +46,51 @@ pub(super) fn create_resolver(
     ))
 }
 
+/// Derive script extension inference while sharing filesystem and PnP caches.
+///
+/// Fully specified asset targets remain valid; only extension inference excludes
+/// assets and component files so they cannot shadow script directory modules.
+pub(super) fn create_script_resolver(resolver: &Resolver) -> Resolver {
+    let mut options = resolver.options().clone();
+    options.extensions.retain(|extension| {
+        matches!(
+            extension.rsplit('.').next(),
+            Some(
+                "ts" | "tsx"
+                    | "mts"
+                    | "cts"
+                    | "gts"
+                    | "js"
+                    | "jsx"
+                    | "mjs"
+                    | "cjs"
+                    | "gjs"
+                    | "json"
+            )
+        )
+    });
+    resolver.clone_with_options(options)
+}
+
+/// Resolve a directory-relative request using the import's extension policy.
+///
+/// The broad fallback preserves implicit assets when no script module resolves.
+pub(super) fn resolve_with_extension_policy(
+    ctx: &ResolveContext<'_>,
+    directory: &Path,
+    specifier: &str,
+    style_context: bool,
+) -> Result<Resolution, ResolveError> {
+    if !style_context {
+        super::work::note_oxc_resolve();
+        if let Ok(resolved) = ctx.script_resolver.resolve(directory, specifier) {
+            return Ok(resolved);
+        }
+    }
+    super::work::note_oxc_resolve();
+    ctx.resolver.resolve(directory, specifier)
+}
+
 /// Build the [`ResolveOptions`] behind [`create_resolver`].
 ///
 /// Exposed so a second resolver with different conditions can be derived from
@@ -154,7 +199,7 @@ const fn is_tsconfig_error(err: &ResolveError) -> bool {
     )
 }
 
-enum ResolveFileAttempt {
+pub(super) enum ResolveFileAttempt {
     Resolved {
         resolution: Resolution,
         used_tsconfig_fallback: bool,
@@ -168,11 +213,53 @@ enum ResolveFileAttempt {
 /// tsconfig-loading failure, retry with `resolve(dir, specifier)` which skips
 /// tsconfig entirely. Emits a single `tracing::warn!` per unique error message
 /// so users get one actionable hint per broken tsconfig without log spam.
-fn resolve_file_with_tsconfig_fallback(
+pub(super) fn resolve_file_with_tsconfig_fallback(
     ctx: &ResolveContext<'_>,
     from_file: &Path,
     specifier: &str,
+    from_style: bool,
 ) -> ResolveFileAttempt {
+    if from_style || is_style_file(from_file) {
+        return resolve_file_with_resolver_and_tsconfig_fallback(
+            ctx,
+            ctx.resolver,
+            from_file,
+            specifier,
+        );
+    }
+    // Most Node-protocol requests resolve externally. One broad attempt
+    // preserves that path and tsconfig remaps, including implicit assets.
+    // Only successful remaps need the script lookup for directory priority.
+    if specifier.starts_with("node:") {
+        let broad = resolve_file_with_resolver_and_tsconfig_fallback(
+            ctx,
+            ctx.resolver,
+            from_file,
+            specifier,
+        );
+        if matches!(broad, ResolveFileAttempt::Failed { .. }) {
+            return broad;
+        }
+        let attempt = resolve_file_with_resolver_and_tsconfig_fallback(
+            ctx,
+            ctx.script_resolver,
+            from_file,
+            specifier,
+        );
+        if matches!(attempt, ResolveFileAttempt::Resolved { .. }) {
+            return attempt;
+        }
+        return broad;
+    }
+    let attempt = resolve_file_with_resolver_and_tsconfig_fallback(
+        ctx,
+        ctx.script_resolver,
+        from_file,
+        specifier,
+    );
+    if matches!(attempt, ResolveFileAttempt::Resolved { .. }) {
+        return attempt;
+    }
     resolve_file_with_resolver_and_tsconfig_fallback(ctx, ctx.resolver, from_file, specifier)
 }
 
@@ -237,23 +324,25 @@ fn try_root_relative_specifier(
     ctx: &ResolveContext<'_>,
     from_file: &Path,
     specifier: &str,
+    from_style: bool,
 ) -> Option<ResolveResult> {
     if !specifier.starts_with('/') || !is_root_relative_importer(from_file) {
         return None;
     }
 
     let relative = format!(".{specifier}");
     let source_dir = from_file.parent().unwrap_or(ctx.root);
-    if let Some(result) = resolve_root_relative_from_dir(ctx, source_dir, &relative) {
+    if let Some(result) = resolve_root_relative_from_dir(ctx, source_dir, &relative, from_style) {
         return Some(result);
     }
     if let Some(package_dir) = nearest_package_dir_below_root(ctx.root, source_dir)
-        && let Some(result) = resolve_root_relative_from_dir(ctx, package_dir, &relative)
+        && let Some(result) =
+            resolve_root_relative_from_dir(ctx, package_dir, &relative, from_style)
     {
         return Some(result);
     }
     if source_dir != ctx.root
-        && let Some(result) = resolve_root_relative_from_dir(ctx, ctx.root,
```

---

### Incident Patch 5: `9a3efdc4` (2026-10-05)
**Commit Message**: chore: merge main into resolver fix

**File**: `.github/actionlint.yaml` (modified, +2/-0)
```diff
@@ -1,3 +1,5 @@
 self-hosted-runner:
   labels:
+    # GitHub-hosted Ubuntu 26.04 is ahead of actionlint 1.7.12's runner catalog.
+    - ubuntu-26.04
     - codspeed-macro
```

**File**: `.github/workflows/bench-cli-instructions.yml` (modified, +2/-1)
```diff
@@ -42,7 +42,8 @@ jobs:
       github.event_name != 'pull_request' ||
       (contains(github.event.pull_request.labels.*.name, 'ci:perf') &&
       (github.event.action != 'labeled' || github.event.label.name == 'ci:perf'))
-    runs-on: ubuntu-latest
+    # CodSpeed simulation currently rejects Ubuntu 26.04.
+    runs-on: ubuntu-24.04
     timeout-minutes: 60
     permissions:
       contents: read
```

**File**: `.github/workflows/bench-type-aware.yml` (modified, +1/-1)
```diff
@@ -29,7 +29,7 @@ permissions:
 jobs:
   benchmark-type-aware:
     name: CodSpeed walltime (type-aware cold and warm)
-    runs-on: ubuntu-latest
+    runs-on: ubuntu-26.04
     permissions:
       contents: read
       id-token: write
```

**File**: `.github/workflows/bench.yml` (modified, +6/-4)
```diff
@@ -55,7 +55,7 @@ env:
 jobs:
   benchmark-harness:
     name: Benchmark harness
-    runs-on: ubuntu-latest
+    runs-on: ubuntu-26.04
     # On a pull request, run only with the "ci:perf" label. Skip a "labeled"
     # event for another label, so it does not start a second run.
     if: >-
@@ -76,7 +76,7 @@ jobs:
   determine-matrix:
     name: Determine benchmark matrix
     needs: benchmark-harness
-    runs-on: ubuntu-latest
+    runs-on: ubuntu-26.04
     permissions:
       contents: read
     timeout-minutes: 5
@@ -103,7 +103,8 @@ jobs:
       - benchmark-harness
       - determine-matrix
     if: needs.determine-matrix.outputs.fast_matrix != '[]'
-    runs-on: ubuntu-latest
+    # CodSpeed simulation currently rejects Ubuntu 26.04.
+    runs-on: ubuntu-24.04
     permissions:
       contents: read
       id-token: write
@@ -144,7 +145,8 @@ jobs:
     name: CodSpeed full simulation (${{ matrix.label }})
     needs: benchmark-harness
     if: github.event_name != 'pull_request'
-    runs-on: ubuntu-latest
+    # CodSpeed simulation currently rejects Ubuntu 26.04.
+    runs-on: ubuntu-24.04
     permissions:
       contents: read
       id-token: write
```

**File**: `.github/workflows/ci.yml` (modified, +30/-30)
```diff
@@ -25,7 +25,7 @@ env:
 jobs:
   changes:
     name: Detect changes
-    runs-on: ubuntu-latest
+    runs-on: ubuntu-26.04
     timeout-minutes: 5
     permissions:
       contents: read
@@ -308,7 +308,7 @@ jobs:
     name: Docker
     needs: changes
     if: needs.changes.outputs.docker == 'true' || (github.event_name == 'push' && needs.changes.outputs.main-full != 'false')
-    runs-on: ubuntu-latest
+    runs-on: ubuntu-26.04
     timeout-minutes: 10
     permissions:
       contents: read
@@ -387,12 +387,12 @@ jobs:
       github.actor != 'dependabot[bot]' &&
       ((github.event_name == 'push' && github.ref == 'refs/heads/main') ||
        (github.event_name == 'pull_request' && github.event.pull_request.head.repo.full_name == github.repository))
-    runs-on: ubuntu-latest
+    runs-on: ubuntu-26.04
     timeout-minutes: 5
     permissions:
       contents: read
     outputs:
-      runner: ${{ steps.runner.outcome == 'success' && steps.runner.outputs.runner || 'ubuntu-latest' }}
+      runner: ${{ steps.runner.outcome == 'success' && steps.runner.outputs.runner || 'ubuntu-26.04' }}
     steps:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
         with:
@@ -411,7 +411,7 @@ jobs:
           HEAVY_HEAD_REPOSITORY: ${{ github.event.pull_request.head.repo.full_name }}
         run: |
           if [ ! -f scripts/select-heavy-runner.mjs ]; then
-            echo 'runner=ubuntu-latest' >> "$GITHUB_OUTPUT"
+            echo 'runner=ubuntu-26.04' >> "$GITHUB_OUTPUT"
             echo 'Check uses GitHub: the trusted allocation helper is not available yet.' >> "$GITHUB_STEP_SUMMARY"
           else
             node scripts/select-heavy-runner.mjs
@@ -424,7 +424,7 @@ jobs:
     name: Check
     needs: [changes, heavy-runner]
     if: always() && !cancelled() && (needs.changes.outputs.rust == 'true' || (github.event_name == 'push' && needs.changes.outputs.main-full != 'false'))
-    runs-on: ${{ github.run_attempt == 1 && needs['heavy-runner'].result == 'success' && needs['heavy-runner'].outputs.runner == 'blacksmith-4vcpu-ubuntu-2404' && 'blacksmith-4vcpu-ubuntu-2404' || 'ubuntu-latest' }}
+    runs-on: ${{ github.run_attempt == 1 && needs['heavy-runner'].result == 'success' && needs['heavy-runner'].outputs.runner == 'blacksmith-4vcpu-ubuntu-2404' && 'blacksmith-4vcpu-ubuntu-2404' || 'ubuntu-26.04' }}
     # A cold Rust cache can leave the NAPI release build finishing just after
     # the previous 20-minute limit on merged commits.
     timeout-minutes: 30
@@ -537,7 +537,7 @@ jobs:
     name: Drift harness
     needs: changes
     if: needs.changes.outputs.rust == 'true' || (github.event_name == 'push' && needs.changes.outputs.main-full != 'false')
-    runs-on: ubuntu-latest
+    runs-on: ubuntu-26.04
     timeout-minutes: 30
     permissions:
       contents: read
@@ -677,7 +677,7 @@ jobs:
     name: Public skills contract
     needs: changes
     if: needs.changes.outputs.skills == 'true' || (github.event_name == 'push' && needs.changes.outputs.main-full != 'false')
-    runs-on: ubuntu-latest
+    runs-on: ubuntu-26.04
     timeout-minutes: 5
     permissions:
       contents: read
@@ -705,7 +705,7 @@ jobs:
     name: Documentation
     needs: changes
     if: needs.changes.outputs.rust == 'true' || (github.event_name == 'push' && needs.changes.outputs.main-full != 'false')
-    runs-on: ubuntu-latest
+    runs-on: ubuntu-26.04
     timeout-minutes: 15
     permissions:
       contents: read
@@ -719,7 +719,7 @@ jobs:
 
   typos:
     name: Typos
-    runs-on: ubuntu-latest
+    runs-on: ubuntu-26.04
     timeout-minutes: 5
     permissions:
       contents: read
@@ -737,7 +737,7 @@ jobs:
 
   js-lint:
     name: JS Lint and Format
-    runs-on: ubuntu-latest
+    runs-on: ubuntu-26.04
     timeout-minutes: 5
     permissions:
       contents: read
@@ -804,7 +804,7 @@ jobs:
     name: npm Package
     needs: changes
     if: needs.changes.outputs.npm-package == 'true' || (github.event_name == 'push' && needs.changes.outputs.main-full != 'false')
-    runs-on: ubuntu-latest
+    runs-on: ubuntu-26.04
     timeout-minutes: 10
     permissions:
       contents: read
@@ -928,7 +928,7 @@ jobs:
     name: Action with current binary
     needs: changes
     if: needs.changes.outputs.action-current == 'true' || (github.event_name == 'push' && needs.changes.outputs.main-full != 'false')
-    runs-on: ubuntu-latest
+    runs-on: ubuntu-26.04
     timeout-minutes: 15
     permissions:
       contents: read
@@ -978,7 +978,7 @@ jobs:
     name: Fallow Self Analysis
     needs: changes
     if: needs.changes.outputs.self-analyze == 'true' || (github.event_name == 'push' && needs.changes.outputs.main-full != 'false')
-    runs-on: ubuntu-latest
+    runs-on: ubuntu-26.04
     timeout-minutes: 15
     permissions:
       contents: read
@@ -1032,7 +1032,7 @@ jobs:
     name: VS Code Extension
     needs: changes
     if: needs.changes.outputs.vscode == 'true' || (github.event_name == 'p
```

**File**: `.github/workflows/commitlint.yml` (modified, +1/-1)
```diff
@@ -22,7 +22,7 @@ concurrency:
 jobs:
   commitlint:
     name: Commit messages
-    runs-on: ubuntu-latest
+    runs-on: ubuntu-26.04
     timeout-minutes: 5
     permissions:
       contents: read
```

**File**: `.github/workflows/coverage.yml` (modified, +3/-3)
```diff
@@ -26,7 +26,7 @@ env:
 jobs:
   changes:
     name: Detect coverage inputs
-    runs-on: ubuntu-latest
+    runs-on: ubuntu-26.04
     timeout-minutes: 5
     permissions:
       contents: read
@@ -49,7 +49,7 @@ jobs:
     name: Coverage
     needs: changes
     if: always() && !cancelled() && (needs.changes.result != 'success' || needs.changes.outputs.main-full != 'false')
-    runs-on: ubuntu-latest
+    runs-on: ubuntu-26.04
     permissions:
       contents: read
     outputs:
@@ -132,7 +132,7 @@ jobs:
       needs.coverage.result == 'success' &&
       ((github.event_name == 'push' && github.ref == 'refs/heads/main') ||
       github.event_name == 'workflow_dispatch')
-    runs-on: ubuntu-latest
+    runs-on: ubuntu-26.04
     permissions:
       contents: write
     env:
```

**File**: `.github/workflows/cross-arch.yml` (modified, +1/-1)
```diff
@@ -38,7 +38,7 @@ jobs:
   # repeated here.
   cross-compile:
     name: Compile (${{ matrix.target }})
-    runs-on: ubuntu-latest
+    runs-on: ubuntu-26.04
     permissions:
       contents: read
     strategy:
```

---

### Incident Patch 6: `5b872f5f` (2026-10-05)
**Commit Message**: fix(resolve): preserve module precedence across resolution routes

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -159,6 +159,16 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- **Script directory imports no longer resolve to a sibling stylesheet or
+  component.** An import of `./Button` now reaches `Button/index.ts` before
+  an inferred `Button.css` or `Button.vue`. The same rule applies to aliases,
+  import maps and workspace package paths. Explicit asset targets, JSON
+  modules and stylesheet resolution keep their existing behavior. Cached
+  resolution graphs are rebuilt on upgrade. Thanks to
+  [@osazemeu](https://github.com/osazemeu) for the report and initial fix
+  ([#3201](https://github.com/fallow-rs/fallow/issues/3201),
+  [#3202](https://github.com/fallow-rs/fallow/pull/3202)).
+
 - **An orphan module declaration file is now reported as an unused file.**
   Before, fallow made every `.d.ts`, `.d.mts` and `.d.cts` file an entry
   point and never reported one, so a stale declaration file and every module
```

**File**: `crates/core/tests/integration_test.rs` (modified, +2/-0)
```diff
@@ -45,6 +45,8 @@ mod deno_workspace;
 mod dependencies;
 #[path = "integration_test/deprecated_exports.rs"]
 mod deprecated_exports;
+#[path = "integration_test/directory_resolution.rs"]
+mod directory_resolution;
 #[path = "integration_test/duplicate_prop_shape.rs"]
 mod duplicate_prop_shape;
 #[path = "integration_test/dynamic_import_then.rs"]
```

**File**: `crates/core/tests/integration_test/directory_resolution.rs` (added, +363/-0)
```diff
@@ -0,0 +1,363 @@
+use super::common::{create_config, create_config_with_cache};
+use fallow_types::cache_rejection::CacheRejection;
+use std::path::Path;
+
+const PRE_SCRIPT_EXTENSION_CACHE_VERSION: u32 = 67;
+const VITE_PACKAGE: &str =
+    r#"{"name":"directory-resolution","private":true,"devDependencies":{"vite":"*"}}"#;
+
+fn write(root: &Path, path: &str, source: &str) {
+    let path = root.join(path);
+    std::fs::create_dir_all(path.parent().expect("parent")).expect("directory");
+    std::fs::write(path, source).expect("fixture file");
+}
+
+fn project(files: &[(&str, &str)]) -> tempfile::TempDir {
+    let dir = tempfile::tempdir().expect("project");
+    write(
+        dir.path(),
+        "package.json",
+        r#"{"name":"directory-resolution","private":true}"#,
+    );
+    for (path, source) in files {
+        write(dir.path(), path, source);
+    }
+    dir
+}
+
+fn unused_files(root: &Path) -> Vec<String> {
+    let mut config = create_config(root.to_path_buf());
+    config.entry_patterns = vec!["src/index.*".to_string()];
+    fallow_core::analyze(&config)
+        .expect("analysis")
+        .unused_files
+        .iter()
+        .map(|file| {
+            file.file
+                .path
+                .strip_prefix(root)
+                .expect("project-relative finding")
+                .to_string_lossy()
+                .replace('\\', "/")
+        })
+        .collect()
+}
+
+fn assert_edge(root: &Path, from: &str, target: &str, expected: bool) {
+    let mut config = create_config(root.to_path_buf());
+    config.entry_patterns = vec!["src/index.*".to_string()];
+    let graph = fallow_core::analyze_with_trace(&config)
+        .expect("analysis with graph")
+        .graph
+        .expect("retained graph");
+    let source = graph
+        .modules
+        .iter()
+        .find(|module| module.path.ends_with(from))
+        .expect("importer discovered");
+    assert!(source.is_reachable(), "importer must be live: {from}");
+    let target = graph
+        .modules
+        .iter()
+        .find(|module| module.path.ends_with(target))
+        .expect("target discovered");
+    assert_eq!(
+        graph.edges_for(source.file_id).contains(&target.file_id),
+        expected,
+        "unexpected edge from {from} to {}",
+        target.path.display()
+    );
+}
+
+fn assert_vite_alias(root: &Path, prefix: &str, replacement: &str) {
+    let package: fallow_config::PackageJson = serde_json::from_str(
+        &std::fs::read_to_string(root.join("package.json")).expect("package source"),
+    )
+    .expect("package JSON");
+    let plugins = fallow_core::plugins::PluginRegistry::default()
+        .try_run(&package, root, &[root.join("vite.config.ts")])
+        .expect("plugin configuration");
+    assert!(
+        plugins.active_plugins.iter().any(|plugin| plugin == "vite"),
+        "Vite must be active for this alias fixture"
+    );
+    assert!(
+        plugins
+            .path_aliases
+            .iter()
+            .any(|(find, target)| { find == prefix && Path::new(target).ends_with(replacement) }),
+        "Vite must produce the requested alias: {:?}",
+        plugins.path_aliases
+    );
+}
+
+#[test]
+fn explicit_alias_and_package_maps_keep_asset_targets() {
+    for extension in ["vue", "css"] {
+        for mapping in ["tsconfig", "imports", "exports"] {
+            let component = format!("src/Widget.{extension}");
+            let (package, tsconfig, specifier) = match mapping {
+                "tsconfig" => (
+                    r#"{"name":"directory-resolution","private":true}"#.to_string(),
+                    format!(
+                        r#"{{"compilerOptions":{{"paths":{{"@app/Widget":["./{component}"]}}}},"include":["src"]}}"#
+                    ),
+                    "@app/Widget",
+                ),
+                "imports" => (
+                    format!(
+                        r##"{{"name":"directory-resolution","private":true,"imports":{{"#components/Widget":"./{component}"}}}}"##
+                    ),
+                    "{}".to_string(),
+                    "#components/Widget",
+                ),
+                _ => (
+                    format!(
+                        r#"{{"name":"directory-resolution","private":true,"exports":{{"./Widget":"./{component}"}}}}"#
+                    ),
+                    "{}".to_string(),
+                    "directory-resolution/Widget",
+                ),
+            };
+            let entry = format!("import '{specifier}';\n");
+            let dir = project(&[
+                ("package.json", &package),
+                ("tsconfig.json", &tsconfig),
+                ("src/index.ts", &entry),
+                (&component, "<template><div>widget</div></template>"),
+                ("src/Widget/index.ts", "export const unused = 1;"),
+            ]);
+            let unused = unused_files(dir.path());
+            assert!(
+                unused.contains(&"
```

**File**: `crates/core/tests/integration_test/false_positive_fixes.rs` (modified, +9/-2)
```diff
@@ -83,8 +83,15 @@ fn eslint_relative_extends_config_is_not_reported_unused() {
 
 #[test]
 fn extensionless_import_prefers_directory_index_over_non_module_sibling() {
-    for (index, sibling) in ["tsx", "ts", "js", "jsx"].into_iter().flat_map(|index| {
-        ["css", "scss", "json", "vue", "graphql"].map(move |sibling| (index, sibling))
+    for (index, sibling) in [
+        "tsx", "ts", "js", "jsx", "mts", "cts", "mjs", "cjs", "gts", "gjs",
+    ]
+    .into_iter()
+    .flat_map(|index| {
+        [
+            "css", "scss", "vue", "svelte", "astro", "mdx", "graphql", "gql",
+        ]
+        .map(move |sibling| (index, sibling))
     }) {
         let dir = tempfile::tempdir().expect("temp dir");
         let root = dir.path();
```

**File**: `crates/graph/src/cache/mod.rs` (modified, +1/-1)
```diff
@@ -40,7 +40,7 @@ pub use store::{GRAPH_CACHE_FILE, GraphCacheStore};
 /// Never reuse a version number that a published build wrote, even from a
 /// development commit. Git history and the CHANGELOG record the reason for
 /// each bump.
-pub const GRAPH_CACHE_VERSION: u32 = 66;
+pub const GRAPH_CACHE_VERSION: u32 = 68;
 
 /// Cached form of a resolved target.
 ///
```

**File**: `crates/graph/src/resolve/fallbacks.rs` (modified, +29/-8)
```diff
@@ -37,6 +37,7 @@ fn alias_match_remainder<'a>(specifier: &'a str, prefix: &str) -> Option<&'a str
 pub(super) fn try_path_alias_fallback(
     ctx: &ResolveContext<'_>,
     specifier: &str,
+    style_context: bool,
 ) -> Option<ResolveResult> {
     for (prefix, replacement) in ctx.path_aliases {
         let Some(remainder) = alias_match_remainder(specifier, prefix) else {
@@ -49,8 +50,12 @@ pub(super) fn try_path_alias_fallback(
             (false, false) => format!("./{replacement}/{remainder}"),
         };
 
-        super::work::note_oxc_resolve();
-        if let Ok(resolved) = ctx.resolver.resolve(ctx.root, &substituted) {
+        if let Ok(resolved) = super::specifier::resolve_with_extension_policy(
+            ctx,
+            ctx.root,
+            &substituted,
+            style_context,
+        ) {
             let resolved_path = resolved.path();
             if let Some(&file_id) = ctx.raw_path_to_id.get(resolved_path) {
                 return Some(ResolveResult::InternalModule(file_id));
@@ -1111,6 +1116,7 @@ pub(super) fn try_pnpm_workspace_fallback(
 pub(super) fn try_workspace_package_fallback(
     ctx: &ResolveContext<'_>,
     specifier: &str,
+    style_context: bool,
 ) -> Option<ResolveResult> {
     if !super::path_info::is_bare_specifier(specifier) {
         return None;
@@ -1136,7 +1142,7 @@ pub(super) fn try_workspace_package_fallback(
             *ctx.workspace_roots.get(pkg_name.as_str())?
         };
 
-    resolve_workspace_self_reference(ctx, ws_root, subpath, pkg_name)
+    resolve_workspace_self_reference(ctx, ws_root, subpath, pkg_name, style_context)
 }
 
 /// Outcome of attempting workspace resolution through a matching package
@@ -1244,16 +1250,27 @@ fn resolve_workspace_self_reference(
     ws_root: &Path,
     subpath: &str,
     package_name: String,
+    style_context: bool,
 ) -> Option<ResolveResult> {
-    let root_file = ws_root.join("__fallow_ws_self_resolve__");
     let rel_spec = if subpath.is_empty() {
         "./".to_string()
     } else {
         format!("./{subpath}")
     };
 
-    super::work::note_oxc_resolve();
-    let resolved = ctx.resolver.resolve_file(&root_file, &rel_spec).ok()?;
+    let root_file = ws_root.join("__fallow_ws_self_resolve__");
+    let super::specifier::ResolveFileAttempt::Resolved {
+        resolution: resolved,
+        ..
+    } = super::specifier::resolve_file_with_tsconfig_fallback(
+        ctx,
+        &root_file,
+        &rel_spec,
+        style_context,
+    )
+    else {
+        return None;
+    };
     let resolved_path = resolved.path();
 
     if let Some(&file_id) = ctx.raw_path_to_id.get(resolved_path) {
@@ -1333,8 +1350,10 @@ mod tests {
         let tsconfig_warned = std::sync::Mutex::new(FxHashSet::default());
         let tsconfig_cache = TsconfigCache::default();
         let canonicalize_cache = CanonicalizeCache::default();
+        let script_resolver = crate::resolve::specifier::create_script_resolver(&resolver);
         let ctx = ResolveContext {
             resolver: &resolver,
+            script_resolver: &script_resolver,
             style_resolver: &resolver,
             extensions: &[],
             path_to_id: &path_to_id,
@@ -2967,8 +2986,10 @@ mod tests {
         let tsconfig_cache = TsconfigCache::default();
         let canonicalize_cache = CanonicalizeCache::default();
         let root = PathBuf::from("/project");
+        let script_resolver = crate::resolve::specifier::create_script_resolver(&resolver);
         let ctx = ResolveContext {
             resolver: &resolver,
+            script_resolver: &script_resolver,
             style_resolver: &resolver,
             extensions: &[],
             path_to_id: &path_to_id,
@@ -3038,7 +3059,7 @@ mod tests {
         let root = PathBuf::from("/project");
         let pj = fallow_config::PackageJson::default();
         with_package_map_ctx(root, None, pj, &[], |ctx, _manifest, _r| {
-            let result = try_workspace_package_fallback(ctx, "./local/module");
+            let result = try_workspace_package_fallback(ctx, "./local/module", false);
             assert!(
                 result.is_none(),
                 "relative specifier should return None from workspace fallback"
@@ -3052,7 +3073,7 @@ mod tests {
         let root = PathBuf::from("/project");
         let pj = fallow_config::PackageJson::default();
         with_package_map_ctx(root, None, pj, &[], |ctx, _manifest, _r| {
-            let result = try_workspace_package_fallback(ctx, "/absolute/path");
+            let result = try_workspace_package_fallback(ctx, "/absolute/path", false);
             assert!(
                 result.is_none(),
                 "absolute path should return None from workspace fallback"
```

**File**: `crates/graph/src/resolve/mod.rs` (modified, +4/-0)
```diff
@@ -106,6 +106,7 @@ pub struct ResolveAllImportsInput<'a> {
 /// every resolution instead of rebuilding this state per call.
 pub struct ResolverSession {
     resolver: oxc_resolver::Resolver,
+    script_resolver: oxc_resolver::Resolver,
     style_resolver: oxc_resolver::Resolver,
     extensions: Vec<String>,
     condition_names: Vec<String>,
@@ -139,6 +140,7 @@ impl ResolverSession {
         let extensions = build_extensions(input.active_plugins);
         let condition_names = build_condition_names(input.active_plugins, input.extra_conditions);
         let resolver = create_resolver(input.root, input.active_plugins, input.extra_conditions);
+        let script_resolver = specifier::create_script_resolver(&resolver);
         let mut style_conditions = input.extra_conditions.to_vec();
         style_conditions.push("sass".to_string());
         style_conditions.push("style".to_string());
@@ -152,6 +154,7 @@ impl ResolverSession {
 
         Self {
             resolver,
+            script_resolver,
             style_resolver,
             extensions,
             condition_names,
@@ -211,6 +214,7 @@ pub fn resolve_all_imports_with_session(
 
     let ctx = ResolveContext {
         resolver: &session.resolver,
+        script_resolver: &session.script_resolver,
         style_resolver: &session.style_resolver,
         extensions: &session.extensions,
         path_to_id: &path_to_id,
```

**File**: `crates/graph/src/resolve/specifier.rs` (modified, +250/-66)
```diff
@@ -46,6 +46,51 @@ pub(super) fn create_resolver(
     ))
 }
 
+/// Derive script extension inference while sharing filesystem and PnP caches.
+///
+/// Fully specified asset targets remain valid; only extension inference excludes
+/// assets and component files so they cannot shadow script directory modules.
+pub(super) fn create_script_resolver(resolver: &Resolver) -> Resolver {
+    let mut options = resolver.options().clone();
+    options.extensions.retain(|extension| {
+        matches!(
+            extension.rsplit('.').next(),
+            Some(
+                "ts" | "tsx"
+                    | "mts"
+                    | "cts"
+                    | "gts"
+                    | "js"
+                    | "jsx"
+                    | "mjs"
+                    | "cjs"
+                    | "gjs"
+                    | "json"
+            )
+        )
+    });
+    resolver.clone_with_options(options)
+}
+
+/// Resolve a directory-relative request using the import's extension policy.
+///
+/// The broad fallback preserves implicit assets when no script module resolves.
+pub(super) fn resolve_with_extension_policy(
+    ctx: &ResolveContext<'_>,
+    directory: &Path,
+    specifier: &str,
+    style_context: bool,
+) -> Result<Resolution, ResolveError> {
+    if !style_context {
+        super::work::note_oxc_resolve();
+        if let Ok(resolved) = ctx.script_resolver.resolve(directory, specifier) {
+            return Ok(resolved);
+        }
+    }
+    super::work::note_oxc_resolve();
+    ctx.resolver.resolve(directory, specifier)
+}
+
 /// Build the [`ResolveOptions`] behind [`create_resolver`].
 ///
 /// Exposed so a second resolver with different conditions can be derived from
@@ -154,7 +199,7 @@ const fn is_tsconfig_error(err: &ResolveError) -> bool {
     )
 }
 
-enum ResolveFileAttempt {
+pub(super) enum ResolveFileAttempt {
     Resolved {
         resolution: Resolution,
         used_tsconfig_fallback: bool,
@@ -168,11 +213,53 @@ enum ResolveFileAttempt {
 /// tsconfig-loading failure, retry with `resolve(dir, specifier)` which skips
 /// tsconfig entirely. Emits a single `tracing::warn!` per unique error message
 /// so users get one actionable hint per broken tsconfig without log spam.
-fn resolve_file_with_tsconfig_fallback(
+pub(super) fn resolve_file_with_tsconfig_fallback(
     ctx: &ResolveContext<'_>,
     from_file: &Path,
     specifier: &str,
+    from_style: bool,
 ) -> ResolveFileAttempt {
+    if from_style || is_style_file(from_file) {
+        return resolve_file_with_resolver_and_tsconfig_fallback(
+            ctx,
+            ctx.resolver,
+            from_file,
+            specifier,
+        );
+    }
+    // Most Node-protocol requests resolve externally. One broad attempt
+    // preserves that path and tsconfig remaps, including implicit assets.
+    // Only successful remaps need the script lookup for directory priority.
+    if specifier.starts_with("node:") {
+        let broad = resolve_file_with_resolver_and_tsconfig_fallback(
+            ctx,
+            ctx.resolver,
+            from_file,
+            specifier,
+        );
+        if matches!(broad, ResolveFileAttempt::Failed { .. }) {
+            return broad;
+        }
+        let attempt = resolve_file_with_resolver_and_tsconfig_fallback(
+            ctx,
+            ctx.script_resolver,
+            from_file,
+            specifier,
+        );
+        if matches!(attempt, ResolveFileAttempt::Resolved { .. }) {
+            return attempt;
+        }
+        return broad;
+    }
+    let attempt = resolve_file_with_resolver_and_tsconfig_fallback(
+        ctx,
+        ctx.script_resolver,
+        from_file,
+        specifier,
+    );
+    if matches!(attempt, ResolveFileAttempt::Resolved { .. }) {
+        return attempt;
+    }
     resolve_file_with_resolver_and_tsconfig_fallback(ctx, ctx.resolver, from_file, specifier)
 }
 
@@ -237,23 +324,25 @@ fn try_root_relative_specifier(
     ctx: &ResolveContext<'_>,
     from_file: &Path,
     specifier: &str,
+    from_style: bool,
 ) -> Option<ResolveResult> {
     if !specifier.starts_with('/') || !is_root_relative_importer(from_file) {
         return None;
     }
 
     let relative = format!(".{specifier}");
     let source_dir = from_file.parent().unwrap_or(ctx.root);
-    if let Some(result) = resolve_root_relative_from_dir(ctx, source_dir, &relative) {
+    if let Some(result) = resolve_root_relative_from_dir(ctx, source_dir, &relative, from_style) {
         return Some(result);
     }
     if let Some(package_dir) = nearest_package_dir_below_root(ctx.root, source_dir)
-        && let Some(result) = resolve_root_relative_from_dir(ctx, package_dir, &relative)
+        && let Some(result) =
+            resolve_root_relative_from_dir(ctx, package_dir, &relative, from_style)
     {
         return Some(result);
     }
     if source_dir != ctx.root
-        && let Some(result) = resolve_root_relative_from_dir(ctx, ctx.root,
```

---

### Incident Patch 7: `31430f35` (2026-10-05)
**Commit Message**: fix(plugins): respect Playwright test directories and matchers (#3207)

Use static Playwright test directories and matchers for entry discovery. Preserve conservative entries for dynamic configs and invalidate cached classifications.

**File**: `CHANGELOG.md` (modified, +11/-0)
```diff
@@ -159,6 +159,17 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- **Playwright entries follow static `testDir` and `testMatch` settings.**
+  Helpers outside the configured test directory can now report unused exports.
+  Project overrides inherit top-level settings, and multiple configs keep
+  each config's test entries. Filename matches are case insensitive, and
+  directory names containing glob characters are treated literally.
+  Regular expressions, extglobs and globs with
+  directory components conservatively keep scripts within `testDir`.
+  Unknown project directories keep conventional test patterns without dropping
+  known projects' entries. The graph cache version increases to invalidate
+  entry classifications from older builds.
+
 - **An orphan module declaration file is now reported as an unused file.**
   Before, fallow made every `.d.ts`, `.d.mts` and `.d.cts` file an entry
   point and never reported one, so a stale declaration file and every module
```

**File**: `crates/core/src/analyze/unused_exports.rs` (modified, +1/-0)
```diff
@@ -2965,6 +2965,7 @@ mod tests {
     ) -> crate::plugins::AggregatedPluginResult {
         crate::plugins::AggregatedPluginResult {
             entry_patterns: vec![],
+            replaced_entry_plugins: FxHashSet::default(),
             config_patterns: vec![],
             always_used: vec![],
             used_exports: used_exports
```

**File**: `crates/core/src/plugins/playwright.rs` (modified, +610/-6)
```diff
@@ -6,19 +6,37 @@ use std::path::{Path, PathBuf};
 
 use rustc_hash::FxHashMap;
 
+use oxc_ast::ast::{Expression, ObjectExpression, ObjectPropertyKind};
+
 use super::config_parser;
 use super::{Plugin, PluginResult};
 use crate::scripts;
 
+/// Test entry patterns for a project without a config, or with a config whose
+/// test locations are not statically known. The directory patterns also keep
+/// the helpers in the conventional test directories.
+const DEFAULT_TEST_ENTRY_PATTERNS: &[&str] = &[
+    "**/*.spec.{ts,tsx,js,jsx}",
+    "**/*.test.{ts,tsx,js,jsx}",
+    "tests/**/*.{ts,tsx,js,jsx}",
+    "e2e/**/*.{ts,tsx,js,jsx}",
+];
+
+/// The file-name patterns of [`DEFAULT_TEST_ENTRY_PATTERNS`]. A config with a
+/// static `testDir` keeps them, because other test runners (for example
+/// `node --test`) select files with the same names and do not always have
+/// their own plugin.
+const TEST_FILE_NAME_PATTERNS: &[&str] =
+    &["**/*.spec.{ts,tsx,js,jsx}", "**/*.test.{ts,tsx,js,jsx}"];
+
+/// The file extensions of the Playwright default `testMatch`,
+/// `**/*.@(spec|test).?(c|m)[jt]s?(x)`.
+const TEST_FILE_EXTENSIONS: &str = "{ts,tsx,js,jsx,mts,cts,mjs,cjs}";
+
 define_plugin!(
     struct PlaywrightPlugin => "playwright",
     enablers: &["@playwright/test"],
-    entry_patterns: &[
-        "**/*.spec.{ts,tsx,js,jsx}",
-        "**/*.test.{ts,tsx,js,jsx}",
-        "tests/**/*.{ts,tsx,js,jsx}",
-        "e2e/**/*.{ts,tsx,js,jsx}",
-    ],
+    entry_patterns: DEFAULT_TEST_ENTRY_PATTERNS,
     config_patterns: &["playwright.config.{ts,js}"],
     always_used: &["playwright.config.{ts,js}"],
     tooling_dependencies: &["@playwright/test", "playwright"],
@@ -59,10 +77,269 @@ define_plugin!(
         result.referenced_dependencies.extend(web_deps);
         result.setup_files.extend(web_setup);
 
+        // Every config states its full set of test entries, so that two
+        // configs in one project keep the entries of both. A config without
+        // static test locations restates the defaults.
+        match test_entry_patterns(source, config_path, root, config_dir) {
+            Some(test_dir_patterns) => {
+                result.extend_entry_patterns(TEST_FILE_NAME_PATTERNS.iter().copied());
+                result.extend_entry_patterns(test_dir_patterns);
+            }
+            None => result.extend_entry_patterns(DEFAULT_TEST_ENTRY_PATTERNS.iter().copied()),
+        }
+        result.replace_entry_patterns = true;
+
         result
     },
 );
 
+/// A `testDir` or `testMatch` value of one config scope.
+#[derive(Clone)]
+enum ScopeValue<T> {
+    Absent,
+    Static(T),
+    Dynamic,
+}
+
+impl<T: Clone> ScopeValue<T> {
+    /// The value of a project, which inherits the top-level value when it
+    /// does not set its own.
+    fn or_inherit(&self, top: &Self) -> Self {
+        match self {
+            Self::Absent => top.clone(),
+            other => other.clone(),
+        }
+    }
+}
+
+/// The test locations of the top-level config or of one project.
+#[derive(Clone)]
+struct TestScope {
+    test_dir: ScopeValue<String>,
+    test_match: ScopeValue<Vec<String>>,
+}
+
+/// Entry patterns for the test files that the config selects, as project-root
+/// relative globs.
+///
+/// Playwright collects test files only below `testDir`. Each scope (the
+/// top-level config, or each `projects[]` element) gives one directory. A
+/// project inherits `testDir` and `testMatch` from the top level. A glob
+/// `testMatch` applies below `testDir`, with a `**/` prefix as Playwright adds
+/// one. A regular expression or other non-static `testMatch` keeps every
+/// script file below `testDir`. Unknown scopes add the conventional test
+/// directories while preserving entry patterns from known scopes.
+fn test_entry_patterns(
+    source: &str,
+    config_path: &Path,
+    root: &Path,
+    config_dir: &Path,
+) -> Option<Vec<String>> {
+    let scopes = config_parser::extract_from_source(source, config_path, |program| {
+        let config = config_parser::find_config_object(program)?;
+        Some(config_test_scopes(config))
+    })?;
+
+    let mut patterns = Vec::new();
+    for scope in scopes {
+        let ScopeValue::Static(test_dir) = scope.test_dir else {
+            patterns.extend(
+                DEFAULT_TEST_ENTRY_PATTERNS
+                    .iter()
+                    .skip(TEST_FILE_NAME_PATTERNS.len())
+                    .map(|pattern| (*pattern).to_string()),
+            );
+            continue;
+        };
+        let Some(prefix) = test_dir_prefix(&test_dir, root, config_dir) else {
+            patterns.extend(
+                DEFAULT_TEST_ENTRY_PATTERNS
+                    .iter()
+                    .skip(TEST_FILE_NAME_PATTERNS.len())
+                    .map(|pattern| (*pattern).to_string()),
+            );
+            continue;
+        };
+        match scope.test_match {
+            ScopeValue::Absent => {
+                let glob =
+     
```

**File**: `crates/core/src/plugins/registry/helpers.rs` (modified, +4/-1)
```diff
@@ -672,7 +672,10 @@ fn merge_plugin_result_fields(
     plugin_result: PluginResult,
     result: &mut AggregatedPluginResult,
 ) {
-    if plugin_result.replace_entry_patterns && !plugin_result.entry_patterns.is_empty() {
+    if plugin_result.replace_entry_patterns
+        && !plugin_result.entry_patterns.is_empty()
+        && result.replaced_entry_plugins.insert(pname.to_string())
+    {
         result.entry_patterns.retain(|(_, name)| name != pname);
     }
     if plugin_result.replace_used_export_rules && !plugin_result.used_exports.is_empty() {
```

**File**: `crates/core/src/plugins/registry/mod.rs` (modified, +6/-0)
```diff
@@ -336,6 +336,10 @@ impl PluginToolingDependencies {
 pub struct AggregatedPluginResult {
     /// All entry point patterns from active plugins: (rule, plugin_name).
     pub entry_patterns: Vec<(PathRule, String)>,
+    /// Plugins whose config already replaced their static entry patterns.
+    /// A later config of the same plugin adds to the config patterns and does
+    /// not remove them.
+    pub replaced_entry_plugins: FxHashSet<String>,
     /// Coverage role for each plugin contributing entry point patterns.
     pub entry_point_roles: rustc_hash::FxHashMap<String, EntryPointRole>,
     /// All config file patterns from active plugins.
@@ -504,6 +508,8 @@ impl AggregatedPluginResult {
     pub(crate) fn merge_into(&mut self, other: Self) {
         let Self {
             entry_patterns,
+            // Only the config pass of one plugin run reads this field.
+            replaced_entry_plugins: _,
             entry_point_roles,
             config_patterns,
             always_used,
```

**File**: `crates/core/src/plugins/registry/tests.rs` (modified, +28/-0)
```diff
@@ -1406,6 +1406,34 @@ fn process_config_result_replace_entry_patterns_removes_static_defaults() {
     );
 }
 
+#[test]
+fn process_config_result_second_replacing_config_keeps_first_config_patterns() {
+    let mut aggregated = AggregatedPluginResult::default();
+    aggregated
+        .entry_patterns
+        .push((path_rule("**/*.spec.ts"), "playwright".to_string()));
+
+    for pattern in ["apps/one/ui/**/*.spec.ts", "apps/two/checks/**/*.spec.ts"] {
+        let config_result = PluginResult {
+            entry_patterns: vec![path_rule(pattern)],
+            replace_entry_patterns: true,
+            ..Default::default()
+        };
+        process_config_result("playwright", config_result, &mut aggregated, None).unwrap();
+    }
+
+    let patterns: Vec<&str> = aggregated
+        .entry_patterns
+        .iter()
+        .map(|(rule, _)| rule.pattern.as_str())
+        .collect();
+    assert_eq!(
+        patterns,
+        vec!["apps/one/ui/**/*.spec.ts", "apps/two/checks/**/*.spec.ts"],
+        "the static default goes, and the patterns of both configs stay"
+    );
+}
+
 #[test]
 fn process_config_result_replace_used_export_rules_removes_static_defaults() {
     let mut aggregated = AggregatedPluginResult::default();
```

**File**: `crates/core/tests/integration_test.rs` (modified, +2/-0)
```diff
@@ -511,6 +511,8 @@ mod issue_873_firebase_messaging_sw;
 mod issue_956_playwright_pnpm_exec;
 #[path = "integration_test/lexical_nodes.rs"]
 mod lexical_nodes;
+#[path = "integration_test/playwright_test_dir.rs"]
+mod playwright_test_dir;
 #[path = "integration_test/script_multiplexers.rs"]
 mod script_multiplexers;
 #[path = "integration_test/shell_command_substitution.rs"]
```

**File**: `crates/core/tests/integration_test/playwright_test_dir.rs` (added, +130/-0)
```diff
@@ -0,0 +1,130 @@
+use super::common::{create_config, fixture_path};
+
+struct Findings {
+    unused_exports: Vec<String>,
+    unused_files: Vec<String>,
+}
+
+fn analyze_fixture(name: &str) -> Findings {
+    let root = fixture_path(name);
+    let config = create_config(root);
+    let results = fallow_core::analyze(&config).expect("analysis should succeed");
+    Findings {
+        unused_exports: results
+            .unused_exports
+            .iter()
+            .map(|e| e.export.export_name.clone())
+            .collect(),
+        unused_files: results
+            .unused_files
+            .iter()
+            .map(|f| f.file.path.to_string_lossy().replace('\\', "/"))
+            .collect(),
+    }
+}
+
+fn assert_spec_reachable(findings: &Findings, spec: &str) {
+    assert!(
+        !findings.unused_files.iter().any(|p| p.ends_with(spec)),
+        "{spec} is inside the configured testDir and must stay an entry, got {:?}",
+        findings.unused_files
+    );
+}
+
+fn assert_helper_export_reported(findings: &Findings) {
+    assert!(
+        findings
+            .unused_exports
+            .iter()
+            .any(|name| name == "unusedHelper"),
+        "a helper outside the configured testDir is not a test entry, so its unused export must be reported, got {:?}",
+        findings.unused_exports
+    );
+}
+
+/// A top-level `testDir` replaces the default test directories. A helper
+/// under `e2e/` outside that directory is an ordinary module. A `*.test.ts`
+/// file outside `testDir` stays an entry, because another test runner can
+/// select it.
+#[test]
+fn top_level_test_dir_scopes_test_entries() {
+    let findings = analyze_fixture("playwright-test-dir");
+    assert_spec_reachable(&findings, "ui/a.pw.ts");
+    assert!(
+        !findings
+            .unused_files
+            .iter()
+            .any(|p| p.ends_with("unit/helper.test.ts")),
+        "a test file name outside testDir must stay an entry, got {:?}",
+        findings.unused_files
+    );
+    assert_helper_export_reported(&findings);
+}
+
+/// A config in a subdirectory resolves `testDir` against its own directory.
+#[test]
+fn nested_config_test_dir_resolves_from_config_dir() {
+    let findings = analyze_fixture("playwright-test-dir-nested");
+    assert_spec_reachable(&findings, "e2e/ui/a.pw.ts");
+    assert_helper_export_reported(&findings);
+}
+
+/// Each `projects[].testDir` contributes its own test entries.
+#[test]
+fn project_test_dirs_scope_test_entries() {
+    let findings = analyze_fixture("playwright-test-dir-projects");
+    assert_spec_reachable(&findings, "a/one.pw.ts");
+    assert_spec_reachable(&findings, "b/two.pw.ts");
+    assert_helper_export_reported(&findings);
+}
+
+/// Two config files in one project keep the test entries of both configs.
+#[test]
+fn multiple_configs_keep_each_test_dir() {
+    let findings = analyze_fixture("playwright-test-dir-multi-config");
+    assert_spec_reachable(&findings, "apps/one/ui/one.pw.ts");
+    assert_spec_reachable(&findings, "apps/two/checks/two.pw.ts");
+    assert_helper_export_reported(&findings);
+}
+
+#[test]
+fn unknown_project_test_dir_keeps_known_custom_entries() {
+    let findings = analyze_fixture("playwright-test-dir-mixed-projects");
+    assert_spec_reachable(&findings, "a/one.pw.ts");
+    assert!(
+        findings
+            .unused_files
+            .iter()
+            .any(|p| p.ends_with("b/two.pw.ts")),
+        "a custom file outside every known testDir must still be reported, got {:?}",
+        findings.unused_files
+    );
+}
+
+#[test]
+fn test_match_is_case_insensitive() {
+    let findings = analyze_fixture("playwright-test-dir-case-insensitive");
+    assert_spec_reachable(&findings, "ui/a.PW.ts");
+    assert_helper_export_reported(&findings);
+}
+
+#[test]
+fn test_dir_is_a_literal_path() {
+    let findings = analyze_fixture("playwright-test-dir-literal");
+    assert_spec_reachable(&findings, "ui[1]/a.pw.ts");
+    assert_helper_export_reported(&findings);
+}
+
+#[test]
+fn later_spread_does_not_narrow_to_an_overwritten_test_dir() {
+    let findings = analyze_fixture("playwright-test-dir-spread");
+    assert_spec_reachable(&findings, "tests/live.pw.ts");
+    assert!(
+        findings
+            .unused_files
+            .iter()
+            .any(|p| p.ends_with("orphan.ts")),
+        "unrelated files must still report, got {:?}",
+        findings.unused_files
+    );
+}
```

---

### Incident Patch 8: `5bee61da` (2026-10-05)
**Commit Message**: fix(docs): select npm package for MCP launcher

**File**: `README.md` (modified, +3/-1)
```diff
@@ -240,9 +240,11 @@ npx fallow agent install             # apply it
 To register only the [MCP server](https://fallow.tools/docs/integrations/mcp/):
 
 ```json
-{ "mcpServers": { "fallow": { "command": "npx", "args": ["fallow-mcp"] } } }
+{ "mcpServers": { "fallow": { "command": "npx", "args": ["--yes", "--package", "fallow", "fallow-mcp"] } } }
 ```
 
+`--package fallow` selects the npm package that provides the `fallow-mcp` launcher.
+
 Scripts and agents that call the CLI directly add `--format json --quiet`. Each command then writes one typed JSON document to stdout:
 
 - A root `kind` field names the analysis that made the document.
```

**File**: `npm/fallow/README.md` (modified, +4/-2)
```diff
@@ -81,13 +81,15 @@ The bundled `fallow-mcp` server lives in `node_modules/.bin/` when installed as
   "mcpServers": {
     "fallow": {
       "command": "npx",
-      "args": ["fallow-mcp"]
+      "args": ["--yes", "--package", "fallow", "fallow-mcp"]
     }
   }
 }
 ```
 
-Swap `npx` for `pnpm exec` or `yarn` to match your package manager; a globally installed `fallow-mcp` works as `"command": "fallow-mcp"` directly. See the [MCP integration guide](https://fallow.tools/docs/integrations/mcp/). `npx fallow agent install` writes this registration for you, together with the skill, an `AGENTS.md` task map, and the commit/push gate, for every harness it detects (Claude Code, Codex, Cursor); `--dry-run` shows the plan first.
+`--package fallow` selects the npm package that provides the `fallow-mcp` launcher. For a project-local install, use `"command": "pnpm"` with `"args": ["exec", "fallow-mcp"]`, or `"command": "yarn"` with `"args": ["fallow-mcp"]`. A globally installed `fallow-mcp` works as `"command": "fallow-mcp"` directly. See the [MCP integration guide](https://fallow.tools/docs/integrations/mcp/).
+
+For a verified project-local install, `npx fallow agent install` registers the MCP server with `npx --no fallow-mcp`. It also writes the skill, an `AGENTS.md` task map, and the commit/push gate for every harness it detects (Claude Code, Codex, Cursor); `--dry-run` shows the plan first.
 
 The package also ships two version-matched agent skills: `skills/fallow` for analysis and `skills/fallow-setup` for setting up code-quality tooling. `fallow/capabilities.json` mirrors `fallow schema` for tools that need CLI and issue-surface metadata without spawning the binary. TanStack Intent discovers the skills and the metadata from `node_modules`:
 
```

---

### Incident Patch 9: `6abeebd5` (2026-10-03)
**Commit Message**: fix(resolve): prefer a directory index over a non-module sibling file

An extensionless script import such as `./Widget` resolved to a sibling
`Widget.css` when `Widget/index.tsx` also existed, because the resolver's
extension list carries `.css`, `.scss`, `.json`, `.vue` and `.graphql` for
style and SFC imports and tries every extension on the file before loading
the path as a directory. The directory module then lost its importer and was
reported as an unused file, or its consumed exports as unused exports.

TypeScript and Node never consider those extensions for an extensionless
specifier. When the resolver appended a non-JS/TS extension for a script
importer and a directory of the same name resolves to a JS/TS module, the
import now resolves to that module. Stylesheet importers keep their Sass
resolution.

Fixes #3201

**File**: `crates/core/tests/integration_test/false_positive_fixes.rs` (modified, +51/-0)
```diff
@@ -81,6 +81,57 @@ fn eslint_relative_extends_config_is_not_reported_unused() {
     );
 }
 
+#[test]
+fn extensionless_import_prefers_directory_index_over_non_module_sibling() {
+    for sibling in ["css", "scss", "json", "vue", "graphql"] {
+        let dir = tempfile::tempdir().expect("temp dir");
+        let root = dir.path();
+        std::fs::create_dir_all(root.join("src/Widget")).expect("src dir");
+        std::fs::write(
+            root.join("package.json"),
+            r#"{ "name": "directory-index-sibling", "private": true }"#,
+        )
+        .expect("package json");
+        std::fs::write(
+            root.join("src/index.ts"),
+            "import { Widget } from './Widget';\nconsole.log(Widget());\n",
+        )
+        .expect("entry");
+        std::fs::write(
+            root.join("src/Widget/index.tsx"),
+            "export function Widget() { return 'widget'; }\n\
+             export function UnusedHelper() { return 'unused'; }\n",
+        )
+        .expect("directory index");
+        std::fs::write(root.join(format!("src/Widget.{sibling}")), "{}\n").expect("sibling");
+
+        let config = create_config(root.to_path_buf());
+        let results = fallow_core::analyze(&config).expect("analysis should succeed");
+
+        let unused_files: Vec<String> = results
+            .unused_files
+            .iter()
+            .map(|file| file.file.path.to_string_lossy().replace('\\', "/"))
+            .collect();
+        assert!(
+            !unused_files
+                .iter()
+                .any(|path| path.ends_with("Widget/index.tsx")),
+            "./Widget must resolve to Widget/index.tsx, not Widget.{sibling}: {unused_files:?}"
+        );
+        let unused_exports: Vec<&str> = results
+            .unused_exports
+            .iter()
+            .map(|e| e.export.export_name.as_str())
+            .collect();
+        assert_eq!(
+            unused_exports,
+            ["UnusedHelper"],
+            "only UnusedHelper is unused with a Widget.{sibling} sibling"
+        );
+    }
+}
+
 #[test]
 fn type_only_bidirectional_import_not_reported_as_cycle() {
     let root = fixture_path("type-only-cycle");
```

**File**: `crates/graph/src/resolve/specifier.rs` (modified, +45/-0)
```diff
@@ -1818,6 +1818,9 @@ fn resolve_resolved_specifier(
             return ResolveResult::Unresolvable(specifier.to_string());
         }
     }
+    let directory_index =
+        directory_index_shadowed_by_sibling(ctx, from_file, specifier, from_style, resolved_path);
+    let resolved_path = directory_index.as_deref().unwrap_or(resolved_path);
     let result = ResolvedPathContext {
         ctx,
         from_file,
@@ -1828,6 +1831,48 @@ fn resolve_resolved_specifier(
     credit_workspace_package_target(ctx, from_file, specifier, resolved_path, result)
 }
 
+/// Prefer a directory index over a sibling non-module file of the same name.
+///
+/// The resolver's extension list carries `.css`, `.scss`, `.json`, `.vue` and
+/// other non-JS/TS extensions so that style and SFC imports resolve, and it
+/// tries every extension on the file before it looks inside a directory. An
+/// extensionless `./X` from a script therefore lands on a sibling `X.css`
+/// even when `X/index.tsx` exists. TypeScript and Node never consider those
+/// extensions for an extensionless specifier: they try `X.ts`, `X.tsx` and
+/// the other module extensions, then the `X/index.*` entry. When the resolver
+/// appended a non-JS/TS extension and a directory of the same name resolves to
+/// a JS/TS module, that module is the real target.
+fn directory_index_shadowed_by_sibling(
+    ctx: &ResolveContext<'_>,
+    from_file: &Path,
+    specifier: &str,
+    from_style: bool,
+    resolved_path: &Path,
+) -> Option<PathBuf> {
+    if from_style
+        || is_style_file(from_file)
+        || is_js_ts_extension(resolved_path)
+        || is_node_modules_path(resolved_path)
+    {
+        return None;
+    }
+    let requested_name = specifier.rsplit('/').next()?;
+    let resolved_stem = resolved_path.file_stem()?.to_str()?;
+    if requested_name.is_empty() || resolved_stem != requested_name {
+        return None;
+    }
+    let directory = resolved_path.with_file_name(requested_name);
+    if !directory.is_dir() {
+        return None;
+    }
+    super::work::note_oxc_resolve();
+    let index = ctx
+        .resolver
+        .resolve(directory.parent()?, &format!("./{requested_name}/"))
+        .ok()?;
+    is_js_ts_extension(index.path()).then(|| index.path().to_path_buf())
+}
+
 /// Keep dependency credit for a workspace package import that resolved to the
 /// source file of the package.
 ///
```

---

### Incident Patch 10: `dd3e6661` (2026-10-03)
**Commit Message**: fix(deps): credit catalogue command-line tools only with a reference or config (#3196)

The tooling catalogue credited every entry in devDependencies by name, so
a command-line tool such as oxlint, tsx or npm-run-all that nothing runs
never reported as unused, while --trace-dependency called it unused.

Catalogue entries now mark command-line tools with cli = true. Such a
tool is credited when a package.json script, a CI workflow or a git hook
runs it, when a plugin credits it, or when its own config file exists: a
catalogue config pattern or a package.json key named after the tool.
Library entries keep the credit by name. --trace-dependency reports these
credits as known-tooling and known-tooling-config.

**File**: `CHANGELOG.md` (modified, +14/-0)
```diff
@@ -82,6 +82,20 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Changed
 
+- **A command-line tool from the tooling catalogue needs a reference to
+  count as used.** Before, a catalogue entry such as `oxlint`, `tsx`,
+  `npm-run-all` or `lint-staged` in `devDependencies` was credited by name,
+  so a tool that nothing runs never reported as unused, while
+  `--trace-dependency` called it unused. Now a catalogue entry marked as a
+  command-line tool is credited when a package.json script, a CI workflow
+  or a git hook runs it, when its own config file exists (a plugin config,
+  a catalogue `config` pattern such as `.jscpd.json`, or a package.json key
+  named after the tool), or when a plugin credits it. Catalogue entries
+  that are libraries rather than commands, such as `sass` or `jsdom`, keep
+  the credit by name, and `--trace-dependency` now reports that credit as
+  `known-tooling`, or `known-tooling-config` with the config file. Use
+  `ignoreDependencies` for a tool that the project runs in a way fallow
+  does not see, such as an editor integration.
 - **A `@types/X` devDependency needs a target or ambient globals to count
   as used.** Before, every `@types/` package in `devDependencies` was
   credited by name, so `@types/better-sqlite3` stayed silent in a project
```

**File**: `CONTRIBUTING.md` (modified, +2/-1)
```diff
@@ -197,7 +197,7 @@ before adding a new issue kind or framework-specific analyzer.
 
 ## Adding a known tooling dependency
 
-Some dev tools are used through the CLI or config rather than imported in source (`typescript`, `prettier`, `husky`, `@types/*`), so they should never be reported as unused devDependencies. These live in a data-driven catalogue at `crates/core/data/tooling.toml`. Adding one is a single-file, one-entry change with no regeneration step:
+Some dev tools are used through the CLI or config rather than imported in source (`typescript`, `prettier`, `husky`, `@types/*`), so an import is not what makes them used. These live in a data-driven catalogue at `crates/core/data/tooling.toml`. Adding one is a single-file, one-entry change with no regeneration step:
 
 ```toml
 # A whole package family (every member is tooling):
@@ -212,6 +212,7 @@ ecosystem = "core"
 ```
 
 - Use `[[prefix]]` when every package under a scope or name family is tooling (matched with `name.starts_with(pattern)`); use `[[exact]]` for a single package name. `notes` / `ecosystem` are optional, for human context only.
+- Add `cli = true` to an entry for a command-line tool. A command-line tool in `devDependencies` is credited only when a package.json script, a CI workflow or a git hook runs it, when a plugin credits it, or when its own config file exists. List the config files of a tool that no plugin covers in `config = ["..."]`, relative to the package root (for example `config = [".jscpd.json"]`). An entry without `cli` is a library and is credited by name.
 - A `@types/X` package is not credited by the `@types/` prefix alone. In `devDependencies` it is credited when the project declares `X`, imports `X` or names `X` in a tsconfig `types` entry. A type package that declares globals and is never imported (`@types/node`, `@types/jest`, `bun-types`) goes under `[[ambient_types]]` with its exact `name`; keep that list short.
 - Do **not** add framework-plugin packages (`vite-plugin-*`, `prettier-plugin-*`, `eslint-plugin-*`, `@rollup/plugin-*`, or scoped forms like `@ianvs/prettier-plugin-sort-imports`). Those must be credited by the relevant plugin's config parser when they actually appear in the config file; listing them here would hide a declared-but-unused plugin. The catalogue's parse tests reject such entries.
 - Run `cargo test -p fallow-core plugins::tooling` to validate the catalogue (it checks the TOML parses, has no empty/whitespace prefixes, no duplicates, and no framework-plugin entries). The file is embedded into the binary via `include_str!`, so a passing test means a working release.
```

**File**: `crates/cli/src/report/human/traces.rs` (modified, +30/-0)
```diff
@@ -529,6 +529,13 @@ fn describe_tooling_credit(credit: &fallow_types::trace::ToolingCredit) -> Strin
         ("types-config", _, _) => {
             "Credited because a config file, such as a tsconfig types entry, names it.".to_string()
         }
+        ("known-tooling", _, _) => {
+            "Credited as a known tooling package from the tooling catalogue.".to_string()
+        }
+        ("known-tooling-config", Some(config), _) => format!(
+            "Credited as a known command-line tool with its own config in {}.",
+            config.display()
+        ),
         (reason, _, _) => format!("Credited as tooling ({reason})."),
     }
 }
@@ -1065,6 +1072,29 @@ mod tests {
         assert!(rendered.contains(
             "Credited as the type package of lib, which the project declares or imports."
         ));
+
+        let mut cli_trace = DependencyTrace {
+            package_name: "tool-cli".to_string(),
+            imported_by: Vec::new(),
+            type_only_imported_by: Vec::new(),
+            used_in_scripts: false,
+            is_used: false,
+            import_count: 0,
+            peer_of: Vec::new(),
+            sources: Vec::new(),
+            tooling_credit: None,
+        };
+        cli_trace.apply_tooling_credit(Some(fallow_types::trace::ToolingCredit {
+            reason: "known-tooling-config".to_string(),
+            plugin: None,
+            config: Some(PathBuf::from(".toolrc")),
+            reference: None,
+        }));
+        let rendered = plain(&build_dependency_trace_human_lines(&cli_trace));
+        assert!(
+            rendered
+                .contains("Credited as a known command-line tool with its own config in .toolrc.")
+        );
     }
 
     #[test]
```

**File**: `crates/cli/tests/integration/trace_tooling_credit_tests.rs` (modified, +27/-0)
```diff
@@ -13,6 +13,7 @@ use serde_json::{Value, json};
 
 const FIXTURE: &str = "plugin-tooling-credit";
 const TYPES_FIXTURE: &str = "types-package-credit";
+const CATALOGUE_FIXTURE: &str = "catalogue-cli-credit";
 
 fn trace(package: &str) -> Value {
     trace_in(FIXTURE, package)
@@ -106,6 +107,31 @@ fn type_package_credits_name_their_evidence() {
     assert!(uuid.get("tooling_credit").is_none(), "{uuid:#}");
 }
 
+#[test]
+fn catalogue_credits_name_their_evidence() {
+    let sass = trace_in(CATALOGUE_FIXTURE, "sass");
+    assert_eq!(sass["is_used"], true, "{sass:#}");
+    assert_eq!(
+        sass["tooling_credit"],
+        json!({ "reason": "known-tooling" }),
+        "{sass:#}"
+    );
+
+    let jscpd = trace_in(CATALOGUE_FIXTURE, "jscpd");
+    assert_eq!(
+        jscpd["tooling_credit"],
+        json!({ "reason": "known-tooling-config", "config": ".jscpd.json" }),
+        "{jscpd:#}"
+    );
+
+    let lint_staged = trace_in(CATALOGUE_FIXTURE, "lint-staged");
+    assert_eq!(lint_staged["is_used"], true, "{lint_staged:#}");
+
+    let tsx = trace_in(CATALOGUE_FIXTURE, "tsx");
+    assert_eq!(tsx["is_used"], false, "{tsx:#}");
+    assert!(tsx.get("tooling_credit").is_none(), "{tsx:#}");
+}
+
 fn assert_trace_agrees_with_report(fixture: &str) {
     let root = fixture_path(fixture);
     let report = parse_json(&run_fallow_in_root(
@@ -143,4 +169,5 @@ fn assert_trace_agrees_with_report(fixture: &str) {
 fn the_trace_agrees_with_the_report_for_every_dev_dependency() {
     assert_trace_agrees_with_report(FIXTURE);
     assert_trace_agrees_with_report(TYPES_FIXTURE);
+    assert_trace_agrees_with_report(CATALOGUE_FIXTURE);
 }
```

**File**: `crates/core/data/tooling.toml` (modified, +74/-4)
```diff
@@ -1,9 +1,10 @@
 # Community-maintainable catalogue of known dev tooling packages.
 #
-# Packages listed here are never reported as unused devDependencies, because
-# they are used via the CLI or config files rather than imported in application
-# source. This complements the per-plugin `tooling_dependencies()` lists with
-# tooling that is not tied to any single framework plugin.
+# Packages listed here are tooling: they are used via the CLI or config files
+# rather than imported in application source. See `cli` and [[ambient_types]]
+# below for the entries that need a reference to count as used. This
+# complements the per-plugin `tooling_dependencies()` lists with tooling that
+# is not tied to any single framework plugin.
 #
 # This file is the single source of truth: it is embedded into the binary via
 # `include_str!` and parsed once at startup (see `crates/core/src/plugins/tooling.rs`).
@@ -24,6 +25,13 @@
 # `notes` (on prefix) and `ecosystem` (on exact) are optional, for human
 # context and grouping in the diff. They do not affect matching.
 #
+# `cli = true` marks a command-line tool. A command-line tool in
+# `devDependencies` is credited only when a package.json script, a CI workflow
+# or a git hook runs it, when its own config file exists, or when a plugin
+# credits it. `config` lists the config file patterns of a tool that no
+# plugin covers, relative to the package root or the project root. An entry
+# without `cli` is credited by name.
+#
 # The `@types/` prefix does not credit a type package in `devDependencies` on
 # its own. A `@types/X` package is credited there when the project declares X,
 # imports X or names X in a tsconfig `types` entry, or when it is listed under
@@ -37,9 +45,11 @@ notes = "TypeScript type definitions"
 
 [[prefix]]
 pattern = "husky"
+cli = true
 
 [[prefix]]
 pattern = "lint-staged"
+cli = true
 
 [[prefix]]
 pattern = "commitlint"
@@ -80,6 +90,7 @@ pattern = "@secretlint/"
 
 [[prefix]]
 pattern = "oxlint"
+cli = true
 
 [[prefix]]
 pattern = "@semantic-release/"
@@ -120,42 +131,52 @@ ecosystem = "core"
 [[exact]]
 name = "prettier"
 ecosystem = "formatting"
+cli = true
 
 [[exact]]
 name = "turbo"
 ecosystem = "monorepo"
+cli = true
 
 [[exact]]
 name = "concurrently"
 ecosystem = "scripts"
+cli = true
 
 [[exact]]
 name = "cross-env"
 ecosystem = "scripts"
+cli = true
 
 [[exact]]
 name = "rimraf"
 ecosystem = "scripts"
+cli = true
 
 [[exact]]
 name = "npm-run-all"
 ecosystem = "scripts"
+cli = true
 
 [[exact]]
 name = "npm-run-all2"
 ecosystem = "scripts"
+cli = true
 
 [[exact]]
 name = "nodemon"
 ecosystem = "scripts"
+cli = true
 
 [[exact]]
 name = "ts-node"
 ecosystem = "runtime"
+cli = true
 
 [[exact]]
 name = "tsx"
 ecosystem = "runtime"
+cli = true
 
 [[exact]]
 name = "knip"
@@ -164,18 +185,23 @@ ecosystem = "analysis"
 [[exact]]
 name = "fallow"
 ecosystem = "analysis"
+cli = true
+config = [".fallowrc.json", ".fallowrc.jsonc", "fallow.toml", ".fallow.toml"]
 
 [[exact]]
 name = "jest"
 ecosystem = "testing"
+cli = true
 
 [[exact]]
 name = "vitest"
 ecosystem = "testing"
+cli = true
 
 [[exact]]
 name = "tap"
 ecosystem = "testing"
+cli = true
 
 [[exact]]
 name = "happy-dom"
@@ -188,6 +214,7 @@ ecosystem = "testing"
 [[exact]]
 name = "vite"
 ecosystem = "bundler"
+cli = true
 
 [[exact]]
 name = "sass"
@@ -200,26 +227,33 @@ ecosystem = "styling"
 [[exact]]
 name = "webpack"
 ecosystem = "bundler"
+cli = true
 
 [[exact]]
 name = "webpack-cli"
 ecosystem = "bundler"
+cli = true
 
 [[exact]]
 name = "webpack-dev-server"
 ecosystem = "bundler"
+cli = true
 
 [[exact]]
 name = "esbuild"
 ecosystem = "bundler"
+cli = true
 
 [[exact]]
 name = "rollup"
 ecosystem = "bundler"
+cli = true
 
 [[exact]]
 name = "swc"
 ecosystem = "transpiler"
+cli = true
+config = [".swcrc"]
 
 [[exact]]
 name = "@swc/core"
@@ -244,14 +278,18 @@ ecosystem = "build"
 [[exact]]
 name = "release-it"
 ecosystem = "release"
+cli = true
 
 [[exact]]
 name = "lerna"
 ecosystem = "monorepo"
+cli = true
+config = ["lerna.json"]
 
 [[exact]]
 name = "dotenv-cli"
 ecosystem = "scripts"
+cli = true
 
 [[exact]]
 name = "dotenv-flow"
@@ -260,42 +298,56 @@ ecosystem = "scripts"
 [[exact]]
 name = "oxfmt"
 ecosystem = "formatting"
+cli = true
 
 [[exact]]
 name = "jscpd"
 ecosystem = "analysis"
+cli = true
+config = [".jscpd.json"]
 
 [[exact]]
 name = "npm-check-updates"
 ecosystem = "deps"
+cli = true
+config = [".ncurc.{json,yml,yaml,js,cjs,mjs}"]
 
 [[exact]]
 name = "markdownlint-cli"
 ecosystem = "linting"
+cli = true
 
 [[exact]]
 name = "npm-package-json-lint"
 ecosystem = "linting"
+cli = true
+config = [".npmpackagejsonlintrc.json", "npmpackagejsonlint.config.js"]
 
 [[exact]]
 name = "synp"
 ecosystem = "deps"
+cli = true
 
 [[exact]]
 name = "flow-bin"
 ecosystem = "types"
+cli = true
+config = [".flowconfig"]
 
 [[exact]]
 name = "i18next-parser"
 ecosystem = "i18n"
+cli = true
 
 [[exact]]
 name = "i18next-conv"
 ecosystem = "i18n"
+cli = true
 
 [[exact]]
 name = 
```

**File**: `crates/core/src/analyze/unused_deps.rs` (modified, +52/-4)
```diff
@@ -91,6 +91,9 @@ pub struct SharedDepSets<'a> {
     /// Every dependency name the project declares, in any manifest and any
     /// section. A declared `X` credits a `@types/X` devDependency.
     pub declared_packages: &'a FxHashSet<&'a str>,
+    /// The project root, where a command-line tool's own config file may
+    /// live for any package.
+    pub project_root: &'a Path,
     pub script_used: &'a FxHashSet<&'a str>,
     pub ignore_deps: &'a IgnoreDependencyMatcher,
 }
@@ -619,8 +622,10 @@ fn shared_dep_sets<'a>(
     plugin_tooling: &'a PluginToolingSets<'a>,
     script_used: &'a FxHashSet<&'a str>,
     ignore_deps: &'a IgnoreDependencyMatcher,
+    project_root: &'a Path,
 ) -> SharedDepSets<'a> {
     SharedDepSets {
+        project_root,
         plugin_referenced,
         package_plugin_referenced,
         plugin_tooling: &plugin_tooling.declared,
@@ -669,7 +674,13 @@ pub fn collect_unused_for_category(input: UnusedCategoryInput<'_>) -> Vec<Unused
         .filter(|dep| !input.category.check_implicit || !is_implicit_dependency(dep))
         .filter(|dep| {
             !input.category.check_known_tooling
-                || !is_credited_known_tooling(dep, input.shared, input.is_used)
+                || !is_credited_known_tooling(
+                    dep,
+                    input.shared,
+                    input.is_used,
+                    input.pkg_path,
+                    input.pkg_content,
+                )
         })
         .filter(|dep| {
             let tooling = if input.category.plugin_tooling_needs_evidence {
@@ -707,22 +718,57 @@ pub fn collect_unused_for_category(input: UnusedCategoryInput<'_>) -> Vec<Unused
 /// An ambient global type package (`@types/node`, `bun-types`) is always
 /// credited. Any other `@types/X` package is credited only when the project
 /// declares `X` or uses `X` where `is_used` looks. A tsconfig `types` entry
-/// credits it through the plugin-referenced set. Every other name falls back
-/// to the tooling catalogue.
+/// credits it through the plugin-referenced set. A command-line tool from the
+/// catalogue is credited here only when its own config file exists; a
+/// script, CI workflow or git hook reference credits it through the
+/// script-used set. Every other name falls back to the tooling catalogue.
 fn is_credited_known_tooling(
     dep: &str,
     shared: &SharedDepSets<'_>,
     is_used: &dyn Fn(&str) -> bool,
+    pkg_path: &Path,
+    pkg_content: Option<&str>,
 ) -> bool {
     if crate::plugins::is_ambient_types_package(dep) {
         return true;
     }
     if let Some(target) = crate::plugins::types_package_target(dep) {
         return shared.declared_packages.contains(target.as_str()) || is_used(&target);
     }
+    if let Some(config) = crate::plugins::cli_tooling_config_patterns(dep) {
+        return cli_tool_has_own_config(dep, config, shared.project_root, pkg_path, pkg_content);
+    }
     crate::plugins::is_known_tooling_dependency(dep)
 }
 
+/// Whether a command-line tool has a config file of its own next to the
+/// declaring package.json or at the project root, or its config under a
+/// package.json key named after it.
+fn cli_tool_has_own_config(
+    dep: &str,
+    config: &[String],
+    project_root: &Path,
+    pkg_path: &Path,
+    pkg_content: Option<&str>,
+) -> bool {
+    if pkg_content
+        .and_then(|content| serde_json::from_str::<serde_json::Value>(content).ok())
+        .is_some_and(|manifest| manifest.get(dep).is_some())
+    {
+        return true;
+    }
+    if config.is_empty() {
+        return false;
+    }
+    let package_root = pkg_path.parent().unwrap_or(project_root);
+    let roots: &[&Path] = if package_root == project_root {
+        &[project_root]
+    } else {
+        &[package_root, project_root]
+    };
+    crate::plugins::registry::find_config_file(config.iter().map(String::as_str), roots).is_some()
+}
+
 /// Build a reverse index from package name to workspace roots that import it.
 fn collect_package_workspace_usage(
     graph: &ModuleGraph,
@@ -950,7 +996,7 @@ struct UnusedDependencyScan<'a> {
 }
 
 impl<'a> UnusedDependencyScan<'a> {
-    fn root_shared(&'a self, config: &ResolvedConfig) -> SharedDepSets<'a> {
+    fn root_shared(&'a self, config: &'a ResolvedConfig) -> SharedDepSets<'a> {
         shared_dep_sets(
             &self.plugin_referenced,
             self.package_referenced
@@ -959,6 +1005,7 @@ impl<'a> UnusedDependencyScan<'a> {
             &self.plugin_tooling,
             &self.script_used,
             self.ignore_deps,
+            &config.root,
         )
     }
 
@@ -1203,6 +1250,7 @@ fn collect_workspace_unused_dependencies<'a>(
         inputs.plugin_tooling,
         inputs.script_used,
         inputs.ignore_deps,
+        &inputs.config.root,
     );
 
     let ws_root = ws.root.as_path();
```

**File**: `crates/core/src/analyze/unused_deps_tests/collect_unused.rs` (modified, +36/-6)
```diff
@@ -10,6 +10,7 @@ fn collect_unused_empty_deps_returns_empty() {
         plugin_tooling: &pt,
         credited_plugin_tooling: &pt,
         declared_packages: &pt,
+        project_root: Path::new("/project"),
         script_used: &su,
         ignore_deps: &id,
     };
@@ -41,6 +42,7 @@ fn collect_unused_all_used_returns_empty() {
         plugin_tooling: &pt,
         credited_plugin_tooling: &pt,
         declared_packages: &pt,
+        project_root: Path::new("/project"),
         script_used: &su,
         ignore_deps: &id,
     };
@@ -73,6 +75,7 @@ fn collect_unused_some_unused_are_flagged() {
         plugin_tooling: &pt,
         credited_plugin_tooling: &pt,
         declared_packages: &pt,
+        project_root: Path::new("/project"),
         script_used: &su,
         ignore_deps: &id,
     };
@@ -116,6 +119,7 @@ fn collect_unused_implicit_filter_skips_react_dom() {
         plugin_tooling: &pt,
         credited_plugin_tooling: &pt,
         declared_packages: &pt,
+        project_root: Path::new("/project"),
         script_used: &su,
         ignore_deps: &id,
     };
@@ -149,6 +153,7 @@ fn collect_unused_implicit_filter_disabled_keeps_react_dom() {
         plugin_tooling: &pt,
         credited_plugin_tooling: &pt,
         declared_packages: &pt,
+        project_root: Path::new("/project"),
         script_used: &su,
         ignore_deps: &id,
     };
@@ -174,14 +179,15 @@ fn collect_unused_implicit_filter_disabled_keeps_react_dom() {
 }
 
 #[test]
-fn collect_unused_known_tooling_filter_skips_jest() {
+fn collect_unused_known_tooling_filter_credits_library_and_needs_cli_reference() {
     let (pr, pt, su, id) = empty_shared_sets();
     let shared = SharedDepSets {
         plugin_referenced: &pr,
         package_plugin_referenced: &pr,
         plugin_tooling: &pt,
         credited_plugin_tooling: &pt,
         declared_packages: &pt,
+        project_root: Path::new("/project"),
         script_used: &su,
         ignore_deps: &id,
     };
@@ -192,18 +198,40 @@ fn collect_unused_known_tooling_filter_skips_jest() {
         check_plugin_tooling: false,
         plugin_tooling_needs_evidence: false,
     };
-    let deps = vec!["jest".to_string(), "my-lib".to_string()];
+    // `jsdom` is a catalogue library, credited by name. `jest` is a catalogue
+    // command-line tool, credited only by a reference or its own config.
+    let deps = vec![
+        "jsdom".to_string(),
+        "jest".to_string(),
+        "my-lib".to_string(),
+    ];
     let result = collect_unused_for_category(UnusedCategoryInput {
-        dep_names: deps,
+        dep_names: deps.clone(),
         category: &category,
         shared: &shared,
         is_used: &|_| false,
         used_in_workspaces: &|_| Vec::new(),
-        pkg_path: Path::new("/pkg.json"),
+        pkg_path: Path::new("/project/package.json"),
         pkg_content: None,
     });
-    assert_eq!(result.len(), 1);
-    assert_eq!(result[0].package_name, "my-lib");
+    let names: Vec<&str> = result.iter().map(|d| d.package_name.as_str()).collect();
+    assert_eq!(names, vec!["jest", "my-lib"]);
+
+    let result = collect_unused_for_category(UnusedCategoryInput {
+        dep_names: deps,
+        category: &category,
+        shared: &shared,
+        is_used: &|_| false,
+        used_in_workspaces: &|_| Vec::new(),
+        pkg_path: Path::new("/project/package.json"),
+        pkg_content: Some(r#"{ "jest": { "testEnvironment": "node" } }"#),
+    });
+    let names: Vec<&str> = result.iter().map(|d| d.package_name.as_str()).collect();
+    assert_eq!(
+        names,
+        vec!["my-lib"],
+        "a package.json key named after the tool is its own config"
+    );
 }
 
 #[test]
@@ -221,6 +249,7 @@ fn collect_unused_plugin_tooling_filter() {
         plugin_tooling: &pt,
         credited_plugin_tooling: &pt,
         declared_packages: &pt,
+        project_root: Path::new("/project"),
         script_used: &su,
         ignore_deps: &id,
     };
@@ -260,6 +289,7 @@ fn collect_unused_plugin_tooling_disabled_keeps_dep() {
         plugin_tooling: &pt,
         credited_plugin_tooling: &pt,
         declared_packages: &pt,
+        project_root: Path::new("/project"),
         script_used: &su,
         ignore_deps: &id,
     };
```

**File**: `crates/core/src/analyze/unused_deps_tests/unused_deps.rs` (modified, +17/-8)
```diff
@@ -22,21 +22,30 @@ fn unused_dep_flagged_when_never_imported() {
 }
 
 #[test]
-fn known_tooling_dev_deps_not_flagged_as_unused() {
+fn known_tooling_dev_deps_credit_libraries_and_referenced_cli_tools() {
     let (graph, _) = build_graph_with_npm_imports(&[]);
-    let pkg = make_pkg(&[], &["jest", "vitest"], &[]);
+    let pkg = make_pkg(&[], &["jsdom", "sass", "jest", "vitest"], &[]);
     let config = test_config(PathBuf::from("/project"));
 
     let (unused, unused_dev, _) = find_unused_dependencies(&graph, &pkg, &config, None, &[]);
-
     assert!(unused.is_empty());
-    assert!(
-        !unused_dev.iter().any(|d| d.package_name == "jest"),
-        "jest is a known tooling dep and should be filtered"
+    let mut names: Vec<&str> = unused_dev.iter().map(|d| d.package_name.as_str()).collect();
+    names.sort_unstable();
+    assert_eq!(
+        names,
+        vec!["jest", "vitest"],
+        "catalogue libraries keep their credit, command-line tools need a reference"
     );
+
+    let mut plugin_result = AggregatedPluginResult::default();
+    plugin_result
+        .script_used_packages
+        .extend(["jest".to_string(), "vitest".to_string()]);
+    let (_, unused_dev, _) =
+        find_unused_dependencies(&graph, &pkg, &config, Some(&plugin_result), &[]);
     assert!(
-        !unused_dev.iter().any(|d| d.package_name == "vitest"),
-        "vitest is a known tooling dep and should be filtered"
+        unused_dev.is_empty(),
+        "a script reference credits the command-line tools, found: {unused_dev:?}"
     );
 }
 
```

---

### Incident Patch 11: `c3a2c890` (2026-10-03)
**Commit Message**: fix(deps): credit @types devDependencies only with a target or ambient globals (#3195)

Every @types/ package in devDependencies was credited by name, so a type
package for a library the project neither declares nor imports never
reported as unused.

A @types/X package is now credited when the project declares X, imports
X or names X in a tsconfig types entry. A short catalogue list of type
packages that declare globals (node, bun, jest, mocha and similar) is
always credited. --trace-dependency names these credits with the
ambient-types, types-target and types-config reasons.

**File**: `CHANGELOG.md` (modified, +15/-0)
```diff
@@ -82,6 +82,21 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Changed
 
+- **A `@types/X` devDependency needs a target or ambient globals to count
+  as used.** Before, every `@types/` package in `devDependencies` was
+  credited by name, so `@types/better-sqlite3` stayed silent in a project
+  with no `better-sqlite3` dependency, import or tsconfig entry. Now a
+  `@types/X` package is credited when the project declares `X`, imports
+  `X` (a type-only import counts) or names `X` in a tsconfig `types`
+  entry. A short list of type packages that declare globals is always
+  credited: `@types/node`, `@types/bun`, `bun-types`, `@types/deno`,
+  `@types/jest`, `@types/mocha`, `@types/jasmine`, `@types/qunit`,
+  `@types/web`, `@types/webpack-env`, `@types/chrome` and
+  `@types/firefox-webext-browser`. `--trace-dependency` names the credit
+  with the `ambient-types`, `types-target` and `types-config` reasons.
+  Production dependencies keep the plain credit. A `/// <reference
+  types="X" />` directive is not read yet; use `ignoreDependencies` for a
+  type package that only such a directive or another global use needs.
 - **A plugin credits its own tooling devDependencies only with evidence
   that the project uses the tool.** Before, an active plugin credited every
   package it declares as tooling, and a declared package is enough to
```

**File**: `CONTRIBUTING.md` (modified, +1/-0)
```diff
@@ -212,6 +212,7 @@ ecosystem = "core"
 ```
 
 - Use `[[prefix]]` when every package under a scope or name family is tooling (matched with `name.starts_with(pattern)`); use `[[exact]]` for a single package name. `notes` / `ecosystem` are optional, for human context only.
+- A `@types/X` package is not credited by the `@types/` prefix alone. In `devDependencies` it is credited when the project declares `X`, imports `X` or names `X` in a tsconfig `types` entry. A type package that declares globals and is never imported (`@types/node`, `@types/jest`, `bun-types`) goes under `[[ambient_types]]` with its exact `name`; keep that list short.
 - Do **not** add framework-plugin packages (`vite-plugin-*`, `prettier-plugin-*`, `eslint-plugin-*`, `@rollup/plugin-*`, or scoped forms like `@ianvs/prettier-plugin-sort-imports`). Those must be credited by the relevant plugin's config parser when they actually appear in the config file; listing them here would hide a declared-but-unused plugin. The catalogue's parse tests reject such entries.
 - Run `cargo test -p fallow-core plugins::tooling` to validate the catalogue (it checks the TOML parses, has no empty/whitespace prefixes, no duplicates, and no framework-plugin entries). The file is embedded into the binary via `include_str!`, so a passing test means a working release.
 
```

**File**: `crates/cli/src/architecture_boundaries.rs` (modified, +3/-0)
```diff
@@ -1649,6 +1649,9 @@ fn core_backend_fallow_core_calls_are_explicitly_allowlisted() {
         "fallow_core::plugins::registry::builtin_config_patterns",
         "fallow_core::plugins::registry::builtin_plugin_names",
         "fallow_core::plugins::registry::is_external_plugin_active",
+        // The `@types/X` naming rule has one source, in fallow-core, so the
+        // dependency trace and the unused devDependency check agree on it.
+        "fallow_core::plugins::types_package_target",
         // The discovery walk has one implementation, in fallow-core, so its
         // config-candidate basenames stay derived from the plugin registry.
         "fallow_core::discover::DiscoveredSources",
```

**File**: `crates/cli/src/report/human/traces.rs` (modified, +31/-0)
```diff
@@ -520,6 +520,15 @@ fn describe_tooling_credit(credit: &fallow_types::trace::ToolingCredit) -> Strin
         ("plugin-reference", _, Some(reference)) => format!(
             "Credited as tooling of the {plugin} plugin: a package.json script, CI config or git hook runs {reference}."
         ),
+        ("ambient-types", _, _) => "Credited as a type package that declares globals.".to_string(),
+        ("types-target", _, Some(target)) => {
+            format!(
+                "Credited as the type package of {target}, which the project declares or imports."
+            )
+        }
+        ("types-config", _, _) => {
+            "Credited because a config file, such as a tsconfig types entry, names it.".to_string()
+        }
         (reason, _, _) => format!("Credited as tooling ({reason})."),
     }
 }
@@ -1034,6 +1043,28 @@ mod tests {
         }));
         let rendered = plain(&build_dependency_trace_human_lines(&config_trace));
         assert!(rendered.contains("found its config in .toolrc.json."));
+
+        let mut types_trace = DependencyTrace {
+            package_name: "@types/lib".to_string(),
+            imported_by: Vec::new(),
+            type_only_imported_by: Vec::new(),
+            used_in_scripts: false,
+            is_used: false,
+            import_count: 0,
+            peer_of: Vec::new(),
+            sources: Vec::new(),
+            tooling_credit: None,
+        };
+        types_trace.apply_tooling_credit(Some(fallow_types::trace::ToolingCredit {
+            reason: "types-target".to_string(),
+            plugin: None,
+            config: None,
+            reference: Some("lib".to_string()),
+        }));
+        let rendered = plain(&build_dependency_trace_human_lines(&types_trace));
+        assert!(rendered.contains(
+            "Credited as the type package of lib, which the project declares or imports."
+        ));
     }
 
     #[test]
```

**File**: `crates/cli/tests/integration/trace_tooling_credit_tests.rs` (modified, +53/-7)
```diff
@@ -12,11 +12,16 @@ use crate::common::{fixture_path, parse_json, run_fallow, run_fallow_in_root};
 use serde_json::{Value, json};
 
 const FIXTURE: &str = "plugin-tooling-credit";
+const TYPES_FIXTURE: &str = "types-package-credit";
 
 fn trace(package: &str) -> Value {
+    trace_in(FIXTURE, package)
+}
+
+fn trace_in(fixture: &str, package: &str) -> Value {
     parse_json(&run_fallow(
         "dead-code",
-        FIXTURE,
+        fixture,
         &[
             "--trace-dependency",
             package,
@@ -65,11 +70,44 @@ fn a_hook_invocation_traces_as_a_script_reference() {
     assert!(syncpack.get("tooling_credit").is_none(), "{syncpack:#}");
 }
 
-/// Every declared devDependency traces as unused exactly when the report
-/// flags it.
 #[test]
-fn the_trace_agrees_with_the_report_for_every_dev_dependency() {
-    let root = fixture_path(FIXTURE);
+fn type_package_credits_name_their_evidence() {
+    let node = trace_in(TYPES_FIXTURE, "@types/node");
+    assert_eq!(node["is_used"], true, "{node:#}");
+    assert_eq!(
+        node["tooling_credit"],
+        json!({ "reason": "ambient-types" }),
+        "{node:#}"
+    );
+
+    let react = trace_in(TYPES_FIXTURE, "@types/react");
+    assert_eq!(
+        react["tooling_credit"],
+        json!({ "reason": "types-target", "reference": "react" }),
+        "{react:#}"
+    );
+
+    let geojson = trace_in(TYPES_FIXTURE, "@types/geojson");
+    assert_eq!(
+        geojson["tooling_credit"],
+        json!({ "reason": "types-target", "reference": "geojson" }),
+        "{geojson:#}"
+    );
+
+    let ws = trace_in(TYPES_FIXTURE, "@types/ws");
+    assert_eq!(
+        ws["tooling_credit"],
+        json!({ "reason": "types-config" }),
+        "{ws:#}"
+    );
+
+    let uuid = trace_in(TYPES_FIXTURE, "@types/uuid");
+    assert_eq!(uuid["is_used"], false, "{uuid:#}");
+    assert!(uuid.get("tooling_credit").is_none(), "{uuid:#}");
+}
+
+fn assert_trace_agrees_with_report(fixture: &str) {
+    let root = fixture_path(fixture);
     let report = parse_json(&run_fallow_in_root(
         "dead-code",
         &root,
@@ -90,11 +128,19 @@ fn the_trace_agrees_with_the_report_for_every_dev_dependency() {
         .expect("devDependencies object");
     assert!(!reported.is_empty(), "the fixture must report something");
     for name in declared.keys() {
-        let traced = trace(name);
+        let traced = trace_in(fixture, name);
         assert_eq!(
             traced["is_used"].as_bool(),
             Some(!reported.contains(&name.as_str())),
-            "trace and report disagree on {name}: reported {reported:?}, trace {traced:#}"
+            "trace and report disagree on {name} in {fixture}: reported {reported:?}, trace {traced:#}"
         );
     }
 }
+
+/// Every declared devDependency traces as unused exactly when the report
+/// flags it.
+#[test]
+fn the_trace_agrees_with_the_report_for_every_dev_dependency() {
+    assert_trace_agrees_with_report(FIXTURE);
+    assert_trace_agrees_with_report(TYPES_FIXTURE);
+}
```

**File**: `crates/core/data/tooling.toml` (modified, +48/-0)
```diff
@@ -23,6 +23,11 @@
 #
 # `notes` (on prefix) and `ecosystem` (on exact) are optional, for human
 # context and grouping in the diff. They do not affect matching.
+#
+# The `@types/` prefix does not credit a type package in `devDependencies` on
+# its own. A `@types/X` package is credited there when the project declares X,
+# imports X or names X in a tsconfig `types` entry, or when it is listed under
+# [[ambient_types]] below.
 
 # ── Prefixes: package families where every member is tooling ──────────────
 
@@ -395,3 +400,46 @@ ecosystem = "build"
 [[exact]]
 name = "electron-vite"
 ecosystem = "build"
+
+# ── Ambient global type packages ──────────────────────────────────────────
+#
+# These packages declare globals (`process`, `describe`, `Bun`, `chrome`), so
+# a project uses them without importing anything. They are always credited.
+# Keep the list short: a type package that a project imports or whose target
+# it declares needs no entry.
+
+[[ambient_types]]
+name = "@types/node"
+
+[[ambient_types]]
+name = "@types/bun"
+
+[[ambient_types]]
+name = "bun-types"
+
+[[ambient_types]]
+name = "@types/deno"
+
+[[ambient_types]]
+name = "@types/jest"
+
+[[ambient_types]]
+name = "@types/mocha"
+
+[[ambient_types]]
+name = "@types/jasmine"
+
+[[ambient_types]]
+name = "@types/qunit"
+
+[[ambient_types]]
+name = "@types/web"
+
+[[ambient_types]]
+name = "@types/webpack-env"
+
+[[ambient_types]]
+name = "@types/chrome"
+
+[[ambient_types]]
+name = "@types/firefox-webext-browser"
```

**File**: `crates/core/src/analyze/unused_deps.rs` (modified, +52/-7)
```diff
@@ -88,6 +88,9 @@ pub struct SharedDepSets<'a> {
     pub plugin_tooling: &'a FxHashSet<&'a str>,
     /// The plugin tooling dependencies whose plugin found evidence of use.
     pub credited_plugin_tooling: &'a FxHashSet<&'a str>,
+    /// Every dependency name the project declares, in any manifest and any
+    /// section. A declared `X` credits a `@types/X` devDependency.
+    pub declared_packages: &'a FxHashSet<&'a str>,
     pub script_used: &'a FxHashSet<&'a str>,
     pub ignore_deps: &'a IgnoreDependencyMatcher,
 }
@@ -622,17 +625,22 @@ fn shared_dep_sets<'a>(
         package_plugin_referenced,
         plugin_tooling: &plugin_tooling.declared,
         credited_plugin_tooling: &plugin_tooling.credited,
+        declared_packages: &plugin_tooling.declared_packages,
         script_used,
         ignore_deps,
     }
 }
 
 /// The tooling dependencies of the active plugins: every declared one, and
 /// the subset whose plugin found evidence that the project uses it.
+///
+/// It also carries every declared dependency name, which the `@types/X`
+/// credit reads.
 #[derive(Default)]
 struct PluginToolingSets<'a> {
     declared: FxHashSet<&'a str>,
     credited: FxHashSet<&'a str>,
+    declared_packages: FxHashSet<&'a str>,
 }
 
 /// Collect unused dependencies for a single category (prod, dev, or optional).
@@ -660,7 +668,8 @@ pub fn collect_unused_for_category(input: UnusedCategoryInput<'_>) -> Vec<Unused
         .filter(|dep| !input.shared.script_used.contains(dep.as_str()))
         .filter(|dep| !input.category.check_implicit || !is_implicit_dependency(dep))
         .filter(|dep| {
-            !input.category.check_known_tooling || !crate::plugins::is_known_tooling_dependency(dep)
+            !input.category.check_known_tooling
+                || !is_credited_known_tooling(dep, input.shared, input.is_used)
         })
         .filter(|dep| {
             let tooling = if input.category.plugin_tooling_needs_evidence {
@@ -693,6 +702,27 @@ pub fn collect_unused_for_category(input: UnusedCategoryInput<'_>) -> Vec<Unused
         .collect()
 }
 
+/// Whether the unused devDependency check credits `dep` as known tooling.
+///
+/// An ambient global type package (`@types/node`, `bun-types`) is always
+/// credited. Any other `@types/X` package is credited only when the project
+/// declares `X` or uses `X` where `is_used` looks. A tsconfig `types` entry
+/// credits it through the plugin-referenced set. Every other name falls back
+/// to the tooling catalogue.
+fn is_credited_known_tooling(
+    dep: &str,
+    shared: &SharedDepSets<'_>,
+    is_used: &dyn Fn(&str) -> bool,
+) -> bool {
+    if crate::plugins::is_ambient_types_package(dep) {
+        return true;
+    }
+    if let Some(target) = crate::plugins::types_package_target(dep) {
+        return shared.declared_packages.contains(target.as_str()) || is_used(&target);
+    }
+    crate::plugins::is_known_tooling_dependency(dep)
+}
+
 /// Build a reverse index from package name to workspace roots that import it.
 fn collect_package_workspace_usage(
     graph: &ModuleGraph,
@@ -820,12 +850,23 @@ fn plugin_tooling_set(
 /// A plugin's tooling dependencies are credited for devDependencies only when
 /// the plugin found its own config file, or when a package.json script, a CI
 /// workflow or a git hook invokes one of its reference packages.
-fn plugin_tooling_sets(
-    plugin_result: Option<&crate::plugins::AggregatedPluginResult>,
-) -> PluginToolingSets<'_> {
+fn plugin_tooling_sets<'a>(
+    plugin_result: Option<&'a crate::plugins::AggregatedPluginResult>,
+    root_declared: &'a [String],
+) -> PluginToolingSets<'a> {
     let Some(plugin_result) = plugin_result else {
-        return PluginToolingSets::default();
+        return PluginToolingSets {
+            declared_packages: root_declared.iter().map(String::as_str).collect(),
+            ..PluginToolingSets::default()
+        };
     };
+    let declared_packages = plugin_result
+        .dependency_binaries
+        .declared_packages()
+        .iter()
+        .map(String::as_str)
+        .chain(root_declared.iter().map(String::as_str))
+        .collect();
     let credited = plugin_result
         .plugin_tooling
         .iter()
@@ -839,6 +880,7 @@ fn plugin_tooling_sets(
     PluginToolingSets {
         declared: plugin_tooling_set(Some(plugin_result)),
         credited,
+        declared_packages,
     }
 }
 
@@ -866,7 +908,9 @@ pub fn find_unused_dependencies(
     Vec<UnusedDependency>,
     Vec<UnusedDependency>,
 ) {
-    let scan = build_unused_dependency_scan(graph, config, plugin_result, workspaces);
+    let root_declared = pkg.all_dependency_names();
+    let scan =
+        build_unused_dependency_scan(graph, config, plugin_result, workspaces, &root_declared);
     let shared = scan.root_shared(config);
 
     let linked_workspaces = fallow_config::link_only_workspace_dependencies(
@@ -945,10 +989,11 @@ fn build_unused_dependency_scan<'a>(
     confi
```

**File**: `crates/core/src/analyze/unused_deps_tests/collect_unused.rs` (modified, +8/-0)
```diff
@@ -9,6 +9,7 @@ fn collect_unused_empty_deps_returns_empty() {
         package_plugin_referenced: &pr,
         plugin_tooling: &pt,
         credited_plugin_tooling: &pt,
+        declared_packages: &pt,
         script_used: &su,
         ignore_deps: &id,
     };
@@ -39,6 +40,7 @@ fn collect_unused_all_used_returns_empty() {
         package_plugin_referenced: &pr,
         plugin_tooling: &pt,
         credited_plugin_tooling: &pt,
+        declared_packages: &pt,
         script_used: &su,
         ignore_deps: &id,
     };
@@ -70,6 +72,7 @@ fn collect_unused_some_unused_are_flagged() {
         package_plugin_referenced: &pr,
         plugin_tooling: &pt,
         credited_plugin_tooling: &pt,
+        declared_packages: &pt,
         script_used: &su,
         ignore_deps: &id,
     };
@@ -112,6 +115,7 @@ fn collect_unused_implicit_filter_skips_react_dom() {
         package_plugin_referenced: &pr,
         plugin_tooling: &pt,
         credited_plugin_tooling: &pt,
+        declared_packages: &pt,
         script_used: &su,
         ignore_deps: &id,
     };
@@ -144,6 +148,7 @@ fn collect_unused_implicit_filter_disabled_keeps_react_dom() {
         package_plugin_referenced: &pr,
         plugin_tooling: &pt,
         credited_plugin_tooling: &pt,
+        declared_packages: &pt,
         script_used: &su,
         ignore_deps: &id,
     };
@@ -176,6 +181,7 @@ fn collect_unused_known_tooling_filter_skips_jest() {
         package_plugin_referenced: &pr,
         plugin_tooling: &pt,
         credited_plugin_tooling: &pt,
+        declared_packages: &pt,
         script_used: &su,
         ignore_deps: &id,
     };
@@ -214,6 +220,7 @@ fn collect_unused_plugin_tooling_filter() {
         package_plugin_referenced: &pr,
         plugin_tooling: &pt,
         credited_plugin_tooling: &pt,
+        declared_packages: &pt,
         script_used: &su,
         ignore_deps: &id,
     };
@@ -252,6 +259,7 @@ fn collect_unused_plugin_tooling_disabled_keeps_dep() {
         package_plugin_referenced: &pr,
         plugin_tooling: &pt,
         credited_plugin_tooling: &pt,
+        declared_packages: &pt,
         script_used: &su,
         ignore_deps: &id,
     };
```

---

### Incident Patch 12: `437e200a` (2026-10-03)
**Commit Message**: fix(deps): credit plugin tooling devDependencies only with evidence of use (#3194)

An active plugin credited every package it declares as tooling, and a
declared package is enough to activate the plugin. A devDependency such
as karma or commitizen with no config file and no script never reported
as unused.

The credit now needs a config file of the plugin, its config key in
package.json, or a package.json script, CI workflow or git hook that runs
one of the plugin's packages. Git hook commands (.husky scripts, lefthook,
simple-git-hooks and lint-staged configs) now credit the packages they
run. --trace-dependency reports the credit in a new tooling_credit field
and counts such a dependency as used, so the trace agrees with the report.

**File**: `CHANGELOG.md` (modified, +16/-0)
```diff
@@ -82,6 +82,22 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Changed
 
+- **A plugin credits its own tooling devDependencies only with evidence
+  that the project uses the tool.** Before, an active plugin credited every
+  package it declares as tooling, and a declared package is enough to
+  activate the plugin. So `karma` or `commitizen` in `devDependencies` with
+  no config file and no script never reported as unused. Now the credit
+  needs a config file of the plugin (`.c8rc.json`, `lefthook.yml`), its
+  config key in package.json, or a package.json script, CI workflow or git
+  hook that runs one of the plugin's packages. Git hooks are read for the
+  first time: commands in `.husky/` hook scripts, lefthook configs, and
+  simple-git-hooks and lint-staged configs (package.json key or own file)
+  now credit the packages they run. `--trace-dependency` names the credit
+  in a new `tooling_credit` field (`plugin-config` with the config file, or
+  `plugin-reference` with the package that a command runs) and reports such
+  a dependency as used, so the trace agrees with the report. Production
+  dependencies keep the plain credit. Use `ignoreDependencies` to keep a
+  tooling package that the project runs in a way fallow does not see.
 - **The Claude Code gate audits the install root from a subdirectory.**
   Before, the handler ran the gate script from the session directory. A
   session in a package directory then audited only that package and could
```

**File**: `crates/api/src/runtime/trace.rs` (modified, +5/-0)
```diff
@@ -241,6 +241,11 @@ pub fn run_trace_dependency(
         output.sources = artifacts
             .trace_provenance
             .dependency_sources(&options.package_name);
+        output.apply_tooling_credit(
+            artifacts
+                .trace_provenance
+                .tooling_credit(&options.package_name),
+        );
         Ok(TraceDependencyProgrammaticOutput { output })
     })
 }
```

**File**: `crates/cli/src/check/output.rs` (modified, +1/-0)
```diff
@@ -297,6 +297,7 @@ fn handle_trace_dependency(request: &TraceRequest<'_>, facts: &TraceFacts<'_>) -
         facts.script_used_packages,
     );
     trace.sources = facts.provenance.dependency_sources(pkg_name);
+    trace.apply_tooling_credit(facts.provenance.tooling_credit(pkg_name));
     report::print_dependency_trace(&trace, request.output, request.json_style);
     Some(ExitCode::SUCCESS)
 }
```

**File**: `crates/cli/src/report/human/traces.rs` (modified, +73/-2)
```diff
@@ -488,7 +488,7 @@ fn build_dependency_trace_human_lines(trace: &DependencyTrace) -> Vec<String> {
         lines.push(String::new());
         lines.push(format!(
             "  {}",
-            "Referenced from package.json scripts or CI configs.".dimmed()
+            "Referenced from package.json scripts, CI configs or git hooks.".dimmed()
         ));
     }
     if !trace.peer_of.is_empty() {
@@ -502,10 +502,28 @@ fn build_dependency_trace_human_lines(trace: &DependencyTrace) -> Vec<String> {
             "A used package lists this name as a peer and loads it at runtime.".dimmed()
         ));
     }
+    if let Some(credit) = &trace.tooling_credit {
+        lines.push(String::new());
+        lines.push(format!("  {}", describe_tooling_credit(credit).dimmed()));
+    }
     lines.push(String::new());
     lines
 }
 
+fn describe_tooling_credit(credit: &fallow_types::trace::ToolingCredit) -> String {
+    let plugin = credit.plugin.as_deref().unwrap_or("unknown");
+    match (credit.reason.as_str(), &credit.config, &credit.reference) {
+        ("plugin-config", Some(config), _) => format!(
+            "Credited as tooling of the {plugin} plugin, which found its config in {}.",
+            config.display()
+        ),
+        ("plugin-reference", _, Some(reference)) => format!(
+            "Credited as tooling of the {plugin} plugin: a package.json script, CI config or git hook runs {reference}."
+        ),
+        (reason, _, _) => format!("Credited as tooling ({reason})."),
+    }
+}
+
 fn build_clone_trace_human_lines(trace: &CloneTrace, root: &Path) -> Vec<String> {
     let mut lines = Vec::new();
     lines.push(String::new());
@@ -934,14 +952,17 @@ mod tests {
             import_count: 1,
             peer_of: Vec::new(),
             sources: Vec::new(),
+            tooling_credit: None,
         };
 
         let rendered = plain(&build_dependency_trace_human_lines(&trace));
 
         assert!(rendered.contains("USED zod (1 import(s))"));
         assert!(rendered.contains("Imported by:"));
         assert!(rendered.contains("-> src/schema.ts (type-only)"));
-        assert!(rendered.contains("Referenced from package.json scripts or CI configs."));
+        assert!(
+            rendered.contains("Referenced from package.json scripts, CI configs or git hooks.")
+        );
         assert!(!rendered.contains("Source:"));
     }
 
@@ -956,6 +977,7 @@ mod tests {
             import_count: 0,
             peer_of: vec!["host".to_string()],
             sources: Vec::new(),
+            tooling_credit: None,
         };
 
         let rendered = plain(&build_dependency_trace_human_lines(&trace));
@@ -966,6 +988,54 @@ mod tests {
         assert!(!rendered.contains("Imported by:"));
     }
 
+    #[test]
+    fn dependency_trace_explains_a_tooling_credit() {
+        let mut trace = DependencyTrace {
+            package_name: "tool-addon".to_string(),
+            imported_by: Vec::new(),
+            type_only_imported_by: Vec::new(),
+            used_in_scripts: false,
+            is_used: false,
+            import_count: 0,
+            peer_of: Vec::new(),
+            sources: Vec::new(),
+            tooling_credit: None,
+        };
+        trace.apply_tooling_credit(Some(fallow_types::trace::ToolingCredit {
+            reason: "plugin-reference".to_string(),
+            plugin: Some("tool".to_string()),
+            config: None,
+            reference: Some("tool".to_string()),
+        }));
+
+        let rendered = plain(&build_dependency_trace_human_lines(&trace));
+
+        assert!(rendered.contains("USED tool-addon (0 import(s))"));
+        assert!(rendered.contains(
+            "Credited as tooling of the tool plugin: a package.json script, CI config or git hook runs tool."
+        ));
+
+        let mut config_trace = DependencyTrace {
+            package_name: "tool".to_string(),
+            imported_by: Vec::new(),
+            type_only_imported_by: Vec::new(),
+            used_in_scripts: false,
+            is_used: false,
+            import_count: 0,
+            peer_of: Vec::new(),
+            sources: Vec::new(),
+            tooling_credit: None,
+        };
+        config_trace.apply_tooling_credit(Some(fallow_types::trace::ToolingCredit {
+            reason: "plugin-config".to_string(),
+            plugin: Some("tool".to_string()),
+            config: Some(PathBuf::from(".toolrc.json")),
+            reference: None,
+        }));
+        let rendered = plain(&build_dependency_trace_human_lines(&config_trace));
+        assert!(rendered.contains("found its config in .toolrc.json."));
+    }
+
     #[test]
     fn a_federation_remote_trace_names_its_config() {
         let trace = DependencyTrace {
@@ -982,6 +1052,7 @@ mod tests {
                 config: PathBuf::from("webpack.config.js"),
                 key: "remotes".to_string(),
             }],
+            tooling_credit: None,
         };
 
         let rendered = plain(&build_d
```

**File**: `crates/cli/tests/integration/main.rs` (modified, +1/-0)
```diff
@@ -92,5 +92,6 @@ mod telemetry_tests;
 mod trace_error_tests;
 mod trace_federation_tests;
 mod trace_path_tests;
+mod trace_tooling_credit_tests;
 mod type_aware_degradation_tests;
 mod unresolved_gitignored_target_tests;
```

**File**: `crates/cli/tests/integration/trace_tooling_credit_tests.rs` (added, +100/-0)
```diff
@@ -0,0 +1,100 @@
+//! `--trace-dependency` agrees with the unused devDependency report on plugin
+//! tooling: a dependency the report credits traces as used and names why, and
+//! a dependency the report flags traces as unused.
+
+#![allow(
+    clippy::unwrap_used,
+    clippy::expect_used,
+    reason = "tests and benches use unwrap and expect to keep fixture setup concise"
+)]
+
+use crate::common::{fixture_path, parse_json, run_fallow, run_fallow_in_root};
+use serde_json::{Value, json};
+
+const FIXTURE: &str = "plugin-tooling-credit";
+
+fn trace(package: &str) -> Value {
+    parse_json(&run_fallow(
+        "dead-code",
+        FIXTURE,
+        &[
+            "--trace-dependency",
+            package,
+            "--format",
+            "json",
+            "--quiet",
+            "--no-cache",
+        ],
+    ))
+}
+
+#[test]
+fn a_tooling_dependency_without_evidence_traces_as_unused() {
+    let karma = trace("karma");
+    assert_eq!(karma["is_used"], false, "{karma:#}");
+    assert!(karma.get("tooling_credit").is_none(), "{karma:#}");
+}
+
+#[test]
+fn a_plugin_config_credit_names_the_config_file() {
+    let c8 = trace("c8");
+    assert_eq!(c8["is_used"], true, "{c8:#}");
+    assert_eq!(
+        c8["tooling_credit"],
+        json!({ "reason": "plugin-config", "plugin": "c8", "config": ".c8rc.json" }),
+        "{c8:#}"
+    );
+}
+
+#[test]
+fn a_plugin_reference_credit_names_the_invoked_package() {
+    let companion = trace("ts-mocha");
+    assert_eq!(companion["is_used"], true, "{companion:#}");
+    assert_eq!(
+        companion["tooling_credit"],
+        json!({ "reason": "plugin-reference", "plugin": "mocha", "reference": "mocha" }),
+        "{companion:#}"
+    );
+}
+
+#[test]
+fn a_hook_invocation_traces_as_a_script_reference() {
+    let syncpack = trace("syncpack");
+    assert_eq!(syncpack["is_used"], true, "{syncpack:#}");
+    assert_eq!(syncpack["used_in_scripts"], true, "{syncpack:#}");
+    assert!(syncpack.get("tooling_credit").is_none(), "{syncpack:#}");
+}
+
+/// Every declared devDependency traces as unused exactly when the report
+/// flags it.
+#[test]
+fn the_trace_agrees_with_the_report_for_every_dev_dependency() {
+    let root = fixture_path(FIXTURE);
+    let report = parse_json(&run_fallow_in_root(
+        "dead-code",
+        &root,
+        &["--format", "json", "--quiet", "--no-cache"],
+    ));
+    let reported: Vec<&str> = report["unused_dev_dependencies"]
+        .as_array()
+        .expect("unused_dev_dependencies array")
+        .iter()
+        .map(|dep| dep["package_name"].as_str().expect("package name"))
+        .collect();
+    let manifest: Value = serde_json::from_str(
+        &std::fs::read_to_string(root.join("package.json")).expect("read package.json"),
+    )
+    .expect("parse package.json");
+    let declared = manifest["devDependencies"]
+        .as_object()
+        .expect("devDependencies object");
+    assert!(!reported.is_empty(), "the fixture must report something");
+    for name in declared.keys() {
+        let traced = trace(name);
+        assert_eq!(
+            traced["is_used"].as_bool(),
+            Some(!reported.contains(&name.as_str())),
+            "trace and report disagree on {name}: reported {reported:?}, trace {traced:#}"
+        );
+    }
+}
```

**File**: `crates/core/src/analyze/unused_deps.rs` (modified, +57/-7)
```diff
@@ -74,13 +74,20 @@ pub struct DepCategoryConfig {
     pub check_known_tooling: bool,
     /// Whether to check `plugin_tooling` set (prod + dev = true, optional = false).
     pub check_plugin_tooling: bool,
+    /// Whether a plugin tooling dependency needs evidence that the project
+    /// uses the plugin (dev = true): the plugin found its own config file, or
+    /// a script, CI workflow or git hook invokes its tool. When true, the
+    /// check reads `credited_plugin_tooling` instead of `plugin_tooling`.
+    pub plugin_tooling_needs_evidence: bool,
 }
 
 /// Shared sets used by `collect_unused_for_category` to filter dependencies.
 pub struct SharedDepSets<'a> {
     pub plugin_referenced: &'a FxHashSet<&'a str>,
     pub package_plugin_referenced: &'a FxHashSet<&'a str>,
     pub plugin_tooling: &'a FxHashSet<&'a str>,
+    /// The plugin tooling dependencies whose plugin found evidence of use.
+    pub credited_plugin_tooling: &'a FxHashSet<&'a str>,
     pub script_used: &'a FxHashSet<&'a str>,
     pub ignore_deps: &'a IgnoreDependencyMatcher,
 }
@@ -606,19 +613,28 @@ fn workspace_chain_installs(
 fn shared_dep_sets<'a>(
     plugin_referenced: &'a FxHashSet<&'a str>,
     package_plugin_referenced: &'a FxHashSet<&'a str>,
-    plugin_tooling: &'a FxHashSet<&'a str>,
+    plugin_tooling: &'a PluginToolingSets<'a>,
     script_used: &'a FxHashSet<&'a str>,
     ignore_deps: &'a IgnoreDependencyMatcher,
 ) -> SharedDepSets<'a> {
     SharedDepSets {
         plugin_referenced,
         package_plugin_referenced,
-        plugin_tooling,
+        plugin_tooling: &plugin_tooling.declared,
+        credited_plugin_tooling: &plugin_tooling.credited,
         script_used,
         ignore_deps,
     }
 }
 
+/// The tooling dependencies of the active plugins: every declared one, and
+/// the subset whose plugin found evidence that the project uses it.
+#[derive(Default)]
+struct PluginToolingSets<'a> {
+    declared: FxHashSet<&'a str>,
+    credited: FxHashSet<&'a str>,
+}
+
 /// Collect unused dependencies for a single category (prod, dev, or optional).
 ///
 /// Filters `dep_names` against usage data and category-specific rules, returning
@@ -647,8 +663,12 @@ pub fn collect_unused_for_category(input: UnusedCategoryInput<'_>) -> Vec<Unused
             !input.category.check_known_tooling || !crate::plugins::is_known_tooling_dependency(dep)
         })
         .filter(|dep| {
-            !input.category.check_plugin_tooling
-                || !input.shared.plugin_tooling.contains(dep.as_str())
+            let tooling = if input.category.plugin_tooling_needs_evidence {
+                input.shared.credited_plugin_tooling
+            } else {
+                input.shared.plugin_tooling
+            };
+            !input.category.check_plugin_tooling || !tooling.contains(dep.as_str())
         })
         .filter(|dep| !input.shared.plugin_referenced.contains(dep.as_str()))
         .filter(|dep| {
@@ -724,6 +744,7 @@ const fn prod_category() -> DepCategoryConfig {
         check_implicit: true,
         check_known_tooling: false,
         check_plugin_tooling: true,
+        plugin_tooling_needs_evidence: false,
     }
 }
 
@@ -733,6 +754,7 @@ const fn dev_category() -> DepCategoryConfig {
         check_implicit: false,
         check_known_tooling: true,
         check_plugin_tooling: true,
+        plugin_tooling_needs_evidence: true,
     }
 }
 
@@ -742,6 +764,7 @@ const fn optional_category() -> DepCategoryConfig {
         check_implicit: true,
         check_known_tooling: false,
         check_plugin_tooling: false,
+        plugin_tooling_needs_evidence: false,
     }
 }
 
@@ -792,6 +815,33 @@ fn plugin_tooling_set(
         .unwrap_or_default()
 }
 
+/// The plugin tooling sets for the unused-dependency check.
+///
+/// A plugin's tooling dependencies are credited for devDependencies only when
+/// the plugin found its own config file, or when a package.json script, a CI
+/// workflow or a git hook invokes one of its reference packages.
+fn plugin_tooling_sets(
+    plugin_result: Option<&crate::plugins::AggregatedPluginResult>,
+) -> PluginToolingSets<'_> {
+    let Some(plugin_result) = plugin_result else {
+        return PluginToolingSets::default();
+    };
+    let credited = plugin_result
+        .plugin_tooling
+        .iter()
+        .filter(|entry| {
+            entry
+                .evidence(&plugin_result.script_used_packages)
+                .is_some()
+        })
+        .flat_map(|entry| entry.dependencies.iter().map(String::as_str))
+        .collect();
+    PluginToolingSets {
+        declared: plugin_tooling_set(Some(plugin_result)),
+        credited,
+    }
+}
+
 fn script_used_set(
     plugin_result: Option<&crate::plugins::AggregatedPluginResult>,
 ) -> FxHashSet<&str> {
@@ -847,7 +897,7 @@ pub fn find_unused_dependencies(
 
 struct UnusedDependencyScan<'a> {
     plugin_referenced: FxHashSet<&'a str>,
-    plugin_tooling: FxHashSet<&'a str>,
+    plugi
```

**File**: `crates/core/src/analyze/unused_deps_tests/collect_unused.rs` (modified, +16/-0)
```diff
@@ -8,6 +8,7 @@ fn collect_unused_empty_deps_returns_empty() {
         plugin_referenced: &pr,
         package_plugin_referenced: &pr,
         plugin_tooling: &pt,
+        credited_plugin_tooling: &pt,
         script_used: &su,
         ignore_deps: &id,
     };
@@ -16,6 +17,7 @@ fn collect_unused_empty_deps_returns_empty() {
         check_implicit: true,
         check_known_tooling: false,
         check_plugin_tooling: true,
+        plugin_tooling_needs_evidence: false,
     };
     let result = collect_unused_for_category(UnusedCategoryInput {
         dep_names: vec![],
@@ -36,6 +38,7 @@ fn collect_unused_all_used_returns_empty() {
         plugin_referenced: &pr,
         package_plugin_referenced: &pr,
         plugin_tooling: &pt,
+        credited_plugin_tooling: &pt,
         script_used: &su,
         ignore_deps: &id,
     };
@@ -44,6 +47,7 @@ fn collect_unused_all_used_returns_empty() {
         check_implicit: false,
         check_known_tooling: false,
         check_plugin_tooling: false,
+        plugin_tooling_needs_evidence: false,
     };
     let deps = vec!["react".to_string(), "lodash".to_string()];
     let result = collect_unused_for_category(UnusedCategoryInput {
@@ -65,6 +69,7 @@ fn collect_unused_some_unused_are_flagged() {
         plugin_referenced: &pr,
         package_plugin_referenced: &pr,
         plugin_tooling: &pt,
+        credited_plugin_tooling: &pt,
         script_used: &su,
         ignore_deps: &id,
     };
@@ -73,6 +78,7 @@ fn collect_unused_some_unused_are_flagged() {
         check_implicit: false,
         check_known_tooling: false,
         check_plugin_tooling: false,
+        plugin_tooling_needs_evidence: false,
     };
     let deps = vec![
         "react".to_string(),
@@ -105,6 +111,7 @@ fn collect_unused_implicit_filter_skips_react_dom() {
         plugin_referenced: &pr,
         package_plugin_referenced: &pr,
         plugin_tooling: &pt,
+        credited_plugin_tooling: &pt,
         script_used: &su,
         ignore_deps: &id,
     };
@@ -113,6 +120,7 @@ fn collect_unused_implicit_filter_skips_react_dom() {
         check_implicit: true,
         check_known_tooling: false,
         check_plugin_tooling: false,
+        plugin_tooling_needs_evidence: false,
     };
     let deps = vec!["react-dom".to_string(), "lodash".to_string()];
     let result = collect_unused_for_category(UnusedCategoryInput {
@@ -135,6 +143,7 @@ fn collect_unused_implicit_filter_disabled_keeps_react_dom() {
         plugin_referenced: &pr,
         package_plugin_referenced: &pr,
         plugin_tooling: &pt,
+        credited_plugin_tooling: &pt,
         script_used: &su,
         ignore_deps: &id,
     };
@@ -143,6 +152,7 @@ fn collect_unused_implicit_filter_disabled_keeps_react_dom() {
         check_implicit: false,
         check_known_tooling: false,
         check_plugin_tooling: false,
+        plugin_tooling_needs_evidence: false,
     };
     let deps = vec!["react-dom".to_string()];
     let result = collect_unused_for_category(UnusedCategoryInput {
@@ -165,6 +175,7 @@ fn collect_unused_known_tooling_filter_skips_jest() {
         plugin_referenced: &pr,
         package_plugin_referenced: &pr,
         plugin_tooling: &pt,
+        credited_plugin_tooling: &pt,
         script_used: &su,
         ignore_deps: &id,
     };
@@ -173,6 +184,7 @@ fn collect_unused_known_tooling_filter_skips_jest() {
         check_implicit: false,
         check_known_tooling: true,
         check_plugin_tooling: false,
+        plugin_tooling_needs_evidence: false,
     };
     let deps = vec!["jest".to_string(), "my-lib".to_string()];
     let result = collect_unused_for_category(UnusedCategoryInput {
@@ -201,6 +213,7 @@ fn collect_unused_plugin_tooling_filter() {
         plugin_referenced: &pr,
         package_plugin_referenced: &pr,
         plugin_tooling: &pt,
+        credited_plugin_tooling: &pt,
         script_used: &su,
         ignore_deps: &id,
     };
@@ -209,6 +222,7 @@ fn collect_unused_plugin_tooling_filter() {
         check_implicit: false,
         check_known_tooling: false,
         check_plugin_tooling: true,
+        plugin_tooling_needs_evidence: false,
     };
     let deps = vec!["my-runtime".to_string(), "other".to_string()];
     let result = collect_unused_for_category(UnusedCategoryInput {
@@ -237,6 +251,7 @@ fn collect_unused_plugin_tooling_disabled_keeps_dep() {
         plugin_referenced: &pr,
         package_plugin_referenced: &pr,
         plugin_tooling: &pt,
+        credited_plugin_tooling: &pt,
         script_used: &su,
         ignore_deps: &id,
     };
@@ -245,6 +260,7 @@ fn collect_unused_plugin_tooling_disabled_keeps_dep() {
         check_implicit: true,
         check_known_tooling: false,
         check_plugin_tooling: false,
+        plugin_tooling_needs_evidence: false,
     };
     let deps = vec!["my-runtime".to_string()];
     let result = collect_unused_for_category(UnusedCategoryInput {
```

---

### Incident Patch 13: `5d377bd1` (2026-10-03)
**Commit Message**: fix(deps): credit a devDependency listed as the package's own peer (#3193)

A package that declares a peer often lists the same package in
devDependencies, so the peer is installed for its own build and tests.
The consumer supplies the peer at runtime, so the package source often
does not import it, and the unused-devDependency check reported that dev
copy.

The check now skips a devDependency that the same manifest lists in
peerDependencies, required or optional, in the root and in each
workspace package.json. This is the rule that
dev-dependency-in-production already applies to a dev and peer pair; both
checks now share one helper for it.

**File**: `CHANGELOG.md` (modified, +11/-0)
```diff
@@ -147,6 +147,17 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   `Peer dependency of:` section (human). Before, the trace printed `UNUSED`
   even for a required peer that the unused-dependency check credited.
 
+- **A devDependency that the same `package.json` lists in
+  `peerDependencies` is no longer reported as unused.** A package that
+  declares a peer often lists the same package in `devDependencies`, so the
+  peer is installed for its own build and tests. The consumer supplies the
+  peer at runtime, so the source of the package often does not import it.
+  Before, fallow reported that dev copy as an unused devDependency. Now
+  fallow credits it, for a required or an optional peer, in the root and in
+  each workspace `package.json`. This is the rule that the
+  `dev-dependency-in-production` check already applies to a dev and peer
+  pair. A devDependency with no peer entry stays reported.
+
 - **A `*` in a package `exports` target now matches files in nested
   directories.** Before, fallow expanded the `*` like a shell glob, so it
   matched only one path segment. With `"./*": "./src/*.ts"`, fallow did not
```

**File**: `crates/core/src/analyze/unused_deps.rs` (modified, +42/-21)
```diff
@@ -745,6 +745,19 @@ const fn optional_category() -> DepCategoryConfig {
     }
 }
 
+/// Names a manifest lists in `peerDependencies`, required or optional.
+///
+/// A devDependency with one of these names is the package's own peer,
+/// installed for local build and test. Its consumer supplies it at runtime, so
+/// it is neither an unused devDependency nor a devDependency in production.
+fn own_peer_dependency_names(pkg: &PackageJson) -> FxHashSet<&str> {
+    pkg.peer_dependencies
+        .as_ref()
+        .into_iter()
+        .flat_map(|deps| deps.keys().map(String::as_str))
+        .collect()
+}
+
 fn package_referenced_dependencies_by_path(
     plugin_result: &crate::plugins::AggregatedPluginResult,
 ) -> FxHashMap<PathBuf, FxHashSet<&str>> {
@@ -1017,21 +1030,32 @@ fn collect_root_unused_categories(
     root_pkg_content: Option<&str>,
 ) -> UnusedDependencyTriple {
     let no_workspace_context = |_dep: &str| Vec::new();
-    let category = |dep_names: Vec<String>, category: &DepCategoryConfig| {
-        collect_unused_for_category(UnusedCategoryInput {
-            dep_names,
-            category,
-            shared,
-            is_used: is_used_globally,
-            used_in_workspaces: &no_workspace_context,
-            pkg_path: root_pkg_path,
-            pkg_content: root_pkg_content,
-        })
-    };
+    let category =
+        |dep_names: Vec<String>, category: &DepCategoryConfig, is_used: &dyn Fn(&str) -> bool| {
+            collect_unused_for_category(UnusedCategoryInput {
+                dep_names,
+                category,
+                shared,
+                is_used,
+                used_in_workspaces: &no_workspace_context,
+                pkg_path: root_pkg_path,
+                pkg_content: root_pkg_content,
+            })
+        };
+    let own_peers = own_peer_dependency_names(pkg);
+    let is_dev_used = |dep: &str| own_peers.contains(dep) || is_used_globally(dep);
 
-    let unused_deps = category(pkg.production_dependency_names(), &prod_category());
-    let unused_dev_deps = category(pkg.dev_dependency_names(), &dev_category());
-    let unused_optional_deps = category(pkg.optional_dependency_names(), &optional_category());
+    let unused_deps = category(
+        pkg.production_dependency_names(),
+        &prod_category(),
+        is_used_globally,
+    );
+    let unused_dev_deps = category(pkg.dev_dependency_names(), &dev_category(), &is_dev_used);
+    let unused_optional_deps = category(
+        pkg.optional_dependency_names(),
+        &optional_category(),
+        is_used_globally,
+    );
     (unused_deps, unused_dev_deps, unused_optional_deps)
 }
 
@@ -1188,6 +1212,8 @@ fn collect_workspace_unused_categories(
 ) {
     let is_used_in_workspace = |dep: &str| usage.is_used_in_workspace(dep);
     let used_in_workspaces = |dep: &str| usage.used_in_other_workspaces(dep);
+    let own_peers = own_peer_dependency_names(ws_pkg);
+    let is_dev_used = |dep: &str| own_peers.contains(dep) || is_used_in_workspace(dep);
 
     let prod = collect_unused_for_category(UnusedCategoryInput {
         dep_names: ws_pkg.production_dependency_names(),
@@ -1202,7 +1228,7 @@ fn collect_workspace_unused_categories(
         dep_names: ws_pkg.dev_dependency_names(),
         category: &dev_category(),
         shared: ws_shared,
-        is_used: &is_used_in_workspace,
+        is_used: &is_dev_used,
         used_in_workspaces: &used_in_workspaces,
         pkg_path: ws_pkg_path,
         pkg_content: Some(ws_pkg_content),
@@ -1515,12 +1541,7 @@ pub fn find_dev_dependencies_in_production(
         .iter()
         .chain(optional_names.iter())
         .map(String::as_str)
-        .chain(
-            pkg.peer_dependencies
-                .as_ref()
-                .into_iter()
-                .flat_map(|deps| deps.keys().map(String::as_str)),
-        )
+        .chain(own_peer_dependency_names(pkg))
         .collect();
 
     let plugin_tooling = plugin_tooling_set(plugin_result);
```

**File**: `crates/core/src/analyze/unused_deps_tests/unused_deps.rs` (modified, +26/-0)
```diff
@@ -393,6 +393,32 @@ fn scoped_package_subpath_import_recognized_as_used() {
     );
 }
 
+/// A devDependency that the same manifest lists in `peerDependencies` installs
+/// the package's own peer for local build and test, so it is not unused. A
+/// devDependency with no peer entry stays reported.
+#[test]
+fn dev_dep_listed_as_own_peer_not_flagged() {
+    let (graph, _) = build_graph_with_npm_imports(&[]);
+    let pkg: PackageJson = serde_json::from_str(
+        r#"{
+  "name": "test-project",
+  "peerDependencies": {"react": "^18.0.0"},
+  "peerDependenciesMeta": {"react": {"optional": true}},
+  "devDependencies": {"react": "^18.3.1", "left-pad": "^1.0.0"}
+}"#,
+    )
+    .expect("pkg should deserialize");
+    let config = test_config(PathBuf::from("/project"));
+
+    let (_, unused_dev, _) = find_unused_dependencies(&graph, &pkg, &config, None, &[]);
+    let unused_dev_names: Vec<&str> = unused_dev
+        .iter()
+        .map(|dep| dep.package_name.as_str())
+        .collect();
+
+    assert_eq!(unused_dev_names, vec!["left-pad"]);
+}
+
 #[test]
 fn optional_dep_in_peer_deps_also_counts() {
     let (graph, _) = build_graph_with_npm_imports(&[("sharp", false)]);
```

**File**: `crates/core/tests/integration_test/dependencies.rs` (modified, +34/-0)
```diff
@@ -812,6 +812,40 @@ fn optional_peer_of_used_dependency_is_not_unused() {
     );
 }
 
+#[test]
+fn dev_dependency_listed_as_own_peer_is_not_unused() {
+    let root = fixture_path("dev-dependency-listed-as-own-peer");
+    let config = create_config(root.clone());
+    let results = fallow_core::analyze(&config).expect("analysis should succeed");
+    let mut unused_dev: Vec<(String, &str)> = results
+        .unused_dev_dependencies
+        .iter()
+        .map(|d| {
+            let manifest = d
+                .dep
+                .path
+                .strip_prefix(&root)
+                .unwrap_or(&d.dep.path)
+                .to_string_lossy()
+                .replace('\\', "/");
+            (manifest, d.dep.package_name.as_str())
+        })
+        .collect();
+    unused_dev.sort_unstable();
+
+    // `react` (root, optional peer) and `react-dom` (workspace, required peer)
+    // are dev copies of the package's own peer. `left-pad` and `is-odd` have no
+    // peer entry and stay reported.
+    assert_eq!(
+        unused_dev,
+        vec![
+            ("package.json".to_string(), "left-pad"),
+            ("packages/lib/package.json".to_string(), "is-odd"),
+        ],
+        "a devDependency listed as the same manifest's peer is credited"
+    );
+}
+
 #[test]
 fn subpath_imports_resolve_correctly() {
     let root = fixture_path("subpath-imports");
```

**File**: `tests/fixtures/dev-dependency-listed-as-own-peer/package.json` (added, +18/-0)
```diff
@@ -0,0 +1,18 @@
+{
+  "name": "dev-dependency-listed-as-own-peer",
+  "private": true,
+  "main": "src/index.ts",
+  "workspaces": ["packages/*"],
+  "peerDependencies": {
+    "react": "^18.0.0"
+  },
+  "peerDependenciesMeta": {
+    "react": {
+      "optional": true
+    }
+  },
+  "devDependencies": {
+    "react": "^18.3.1",
+    "left-pad": "1.3.0"
+  }
+}
```

**File**: `tests/fixtures/dev-dependency-listed-as-own-peer/packages/lib/package.json` (added, +11/-0)
```diff
@@ -0,0 +1,11 @@
+{
+  "name": "lib",
+  "main": "src/index.ts",
+  "peerDependencies": {
+    "react-dom": "^18.0.0"
+  },
+  "devDependencies": {
+    "react-dom": "^18.3.1",
+    "is-odd": "3.0.1"
+  }
+}
```

**File**: `tests/fixtures/dev-dependency-listed-as-own-peer/packages/lib/src/index.ts` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+export const lib = 2;
```

**File**: `tests/fixtures/dev-dependency-listed-as-own-peer/src/index.ts` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+export const value = 1;
```

---

### Incident Patch 14: `fe042b6a` (2026-10-03)
**Commit Message**: fix(deps): credit optional peers of used dependencies (#3192)

A project lists an optional peer (peerDependenciesMeta.<name>.optional) of
a package it uses to turn on a feature of that package, which loads the
peer at runtime where the import graph does not see it. The
unused-dependency check credited only required peers, so it reported such
a listed optional peer as unused.

The peer closure now follows required and optional peers. Only used
packages seed it, so the peers of an unused package stay reported.

--trace-dependency now reports a credited peer as used and names the used
packages that list it, in a new additive peer_of field (JSON) and a
"Peer dependency of:" section (human). Before, the trace printed UNUSED
even for a required peer that the check credited.

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ node_modules/
 !tests/fixtures/scss-node-modules-resolution/node_modules/
 !tests/fixtures/issue-754-eslint-meta-preset/node_modules/
 !tests/fixtures/node-modules-bin-path/node_modules/
+!tests/fixtures/optional-peer-of-used-dependency/node_modules/
 .DS_Store
 # macOS Spotlight index control markers (written into build output dirs)
 .metadata_never_index
```

**File**: `CHANGELOG.md` (modified, +13/-0)
```diff
@@ -134,6 +134,19 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   The extraction cache version changes, so the first run after the upgrade
   parses all files again.
 
+- **An optional peer of a used dependency is no longer reported as an
+  unused dependency.** A project lists an optional peer
+  (`peerDependenciesMeta.<name>.optional`) of a package it uses to turn on a
+  feature of that package, which then loads the peer at runtime where the
+  import graph does not see it. Before, fallow credited only the required
+  peers of a used package, so it reported such an optional peer as unused.
+  Now fallow credits required and optional peers alike. Only a used package
+  gives this credit, so the peers of an unused package stay reported.
+  `--trace-dependency` now reports a credited peer as used and names the
+  used packages that list it in a new `peer_of` field (JSON) and a
+  `Peer dependency of:` section (human). Before, the trace printed `UNUSED`
+  even for a required peer that the unused-dependency check credited.
+
 - **A `*` in a package `exports` target now matches files in nested
   directories.** Before, fallow expanded the `*` like a shell glob, so it
   matched only one path segment. With `"./*": "./src/*.ts"`, fallow did not
```

**File**: `crates/cli/src/architecture_boundaries.rs` (modified, +3/-0)
```diff
@@ -1669,6 +1669,9 @@ fn core_backend_fallow_core_calls_are_explicitly_allowlisted() {
         // The built-in module list has one source, in fallow-core, so the
         // entry weight report and the dependency detectors agree on it.
         "fallow_core::analyze::is_builtin_module",
+        // Peer-dependency credit has one implementation, in fallow-core, so
+        // `--trace-dependency` and the unused-dependency check agree on it.
+        "fallow_core::analyze::peer_dependency_hosts",
     ];
 
     for line in core_backend.lines() {
```

**File**: `crates/cli/src/report/human/traces.rs` (modified, +34/-0)
```diff
@@ -491,6 +491,17 @@ fn build_dependency_trace_human_lines(trace: &DependencyTrace) -> Vec<String> {
             "Referenced from package.json scripts or CI configs.".dimmed()
         ));
     }
+    if !trace.peer_of.is_empty() {
+        lines.push(String::new());
+        lines.push("  Peer dependency of:".to_string());
+        for host in &trace.peer_of {
+            lines.push(format!("    {} {host}", "->".dimmed()));
+        }
+        lines.push(format!(
+            "  {}",
+            "A used package lists this name as a peer and loads it at runtime.".dimmed()
+        ));
+    }
     lines.push(String::new());
     lines
 }
@@ -921,6 +932,7 @@ mod tests {
             used_in_scripts: true,
             is_used: true,
             import_count: 1,
+            peer_of: Vec::new(),
             sources: Vec::new(),
         };
 
@@ -933,6 +945,27 @@ mod tests {
         assert!(!rendered.contains("Source:"));
     }
 
+    #[test]
+    fn a_peer_credited_trace_names_the_packages_that_list_it() {
+        let trace = DependencyTrace {
+            package_name: "opt-peer".to_string(),
+            imported_by: Vec::new(),
+            type_only_imported_by: Vec::new(),
+            used_in_scripts: false,
+            is_used: true,
+            import_count: 0,
+            peer_of: vec!["host".to_string()],
+            sources: Vec::new(),
+        };
+
+        let rendered = plain(&build_dependency_trace_human_lines(&trace));
+
+        assert!(rendered.contains("USED opt-peer (0 import(s))"));
+        assert!(rendered.contains("Peer dependency of:"));
+        assert!(rendered.contains("-> host"));
+        assert!(!rendered.contains("Imported by:"));
+    }
+
     #[test]
     fn a_federation_remote_trace_names_its_config() {
         let trace = DependencyTrace {
@@ -942,6 +975,7 @@ mod tests {
             used_in_scripts: false,
             is_used: true,
             import_count: 1,
+            peer_of: Vec::new(),
             sources: vec![TraceSource {
                 kind: "module-federation".to_string(),
                 plugin: "webpack".to_string(),
```

**File**: `crates/cli/tests/integration/main.rs` (modified, +1/-0)
```diff
@@ -68,6 +68,7 @@ mod output_file_tests;
 mod package_baselines_tests;
 mod package_cycle_tests;
 mod parse_error_gate_tests;
+mod peer_dependency_credit_tests;
 mod plugin_diagnostic_tests;
 mod production_workspace_tests;
 mod reconcile_review_tests;
```

**File**: `crates/cli/tests/integration/peer_dependency_credit_tests.rs` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+//! A listed package that a used dependency declares as a peer, required or
+//! optional, is credited by the unused-dependency check, and
+//! `--trace-dependency` names the used package that lists it.
+
+#![allow(
+    clippy::unwrap_used,
+    clippy::expect_used,
+    reason = "tests and benches use unwrap and expect to keep fixture setup concise"
+)]
+
+use crate::common::{parse_json, run_fallow};
+use serde_json::{Value, json};
+
+const FIXTURE: &str = "optional-peer-of-used-dependency";
+
+fn trace(package_name: &str) -> Value {
+    parse_json(&run_fallow(
+        "dead-code",
+        FIXTURE,
+        &[
+            "--trace-dependency",
+            package_name,
+            "--format",
+            "json",
+            "--quiet",
+            "--no-cache",
+        ],
+    ))
+}
+
+#[test]
+fn an_optional_peer_of_a_used_dependency_is_not_reported() {
+    let output = parse_json(&run_fallow(
+        "dead-code",
+        FIXTURE,
+        &["--format", "json", "--quiet", "--no-cache"],
+    ));
+    let mut unused: Vec<&str> = output["unused_dependencies"]
+        .as_array()
+        .expect("unused_dependencies array")
+        .iter()
+        .map(|dep| dep["package_name"].as_str().expect("package_name"))
+        .collect();
+    unused.sort_unstable();
+
+    assert_eq!(unused, vec!["peer-of-unused", "unused-host"], "{output:#}");
+}
+
+#[test]
+fn the_trace_names_the_used_package_that_lists_the_peer() {
+    let credited = trace("opt-peer");
+    assert_eq!(credited["is_used"], true, "{credited:#}");
+    assert_eq!(credited["import_count"], 0, "{credited:#}");
+    assert_eq!(credited["peer_of"], json!(["host"]), "{credited:#}");
+
+    let uncredited = trace("peer-of-unused");
+    assert_eq!(uncredited["is_used"], false, "{uncredited:#}");
+    assert!(uncredited.get("peer_of").is_none(), "{uncredited:#}");
+}
```

**File**: `crates/config/src/workspace/package_json.rs` (modified, +7/-17)
```diff
@@ -241,27 +241,15 @@ impl PackageJson {
             .unwrap_or_default()
     }
 
-    /// Get required peer dependency names only.
+    /// Get every peer dependency name, required or optional.
     #[must_use]
-    pub fn required_peer_dependency_names(&self) -> Vec<String> {
+    pub fn peer_dependency_names(&self) -> Vec<String> {
         self.peer_dependencies
             .as_ref()
-            .map(|deps| {
-                deps.keys()
-                    .filter(|dep| !self.peer_dependency_is_optional(dep))
-                    .cloned()
-                    .collect()
-            })
+            .map(|deps| deps.keys().cloned().collect())
             .unwrap_or_default()
     }
 
-    fn peer_dependency_is_optional(&self, dep: &str) -> bool {
-        self.peer_dependencies_meta
-            .as_ref()
-            .and_then(|meta| meta.get(dep))
-            .is_some_and(|meta| meta.optional)
-    }
-
     /// Extract entry points from package.json fields.
     #[must_use]
     pub fn entry_points(&self) -> Vec<String> {
@@ -827,15 +815,17 @@ mod tests {
     }
 
     #[test]
-    fn package_json_required_peer_dependency_names_excludes_optional_peers() {
+    fn package_json_peer_dependency_names_include_optional_peers() {
         let pkg: PackageJson = serde_json::from_str(
             r#"{
             "peerDependencies": {"react": "^18", "typescript": "^5"},
             "peerDependenciesMeta": {"typescript": {"optional": true}}
         }"#,
         )
         .unwrap();
-        assert_eq!(pkg.required_peer_dependency_names(), vec!["react"]);
+        let mut names = pkg.peer_dependency_names();
+        names.sort_unstable();
+        assert_eq!(names, vec!["react", "typescript"]);
     }
 
     #[test]
```

**File**: `crates/core/src/analyze/mod.rs` (modified, +1/-0)
```diff
@@ -50,6 +50,7 @@ pub(crate) mod test_support;
 pub use predicates::is_builtin_module;
 #[cfg(test)]
 pub(crate) use unused_deps::matches_virtual_prefix;
+pub use unused_deps::peer_dependency_hosts;
 
 use rustc_hash::{FxHashMap, FxHashSet};
 
```

---

### Incident Patch 15: `37325b70` (2026-10-03)
**Commit Message**: fix(deps): drop the private-sibling credit when the consumer externalizes packages (#3191)

A workspace that depends on a private sibling was credited with every
package the sibling imports and ships, on the assumption that its build
inlines the sibling. No bundler config was read, so the credit also applied
when the consumer's build kept every package external and the sibling was
not inlined.

The credit is now removed for a consumer that gives an explicit
externalization signal: a workspace file that imports esbuild and sets
`packages: 'external'`, or a package script that runs
`bun build --packages=external` or `esbuild --packages=external`. Without a
signal the credit stays, so the private-sibling bundling case keeps its
current result.

**File**: `CHANGELOG.md` (modified, +12/-0)
```diff
@@ -816,6 +816,18 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   plugin and config credits of the root manifest do not change. This can
   report new unused root dependencies.
 
+- **A workspace that bundles with every package external gets no credit
+  for its private siblings' packages.** A private sibling workspace is
+  inlined into the bundle of the workspace that depends on it, so fallow
+  credits the sibling's packages to that workspace. Before, this credit also
+  applied when the build kept every package external, so the sibling was not
+  inlined. Now the credit is removed when the depending workspace gives an
+  explicit signal: a file that imports `esbuild` and sets
+  `packages: 'external'`, or a package script that runs
+  `bun build --packages=external` or `esbuild --packages=external`. Without
+  such a signal the credit stays. This can report new unused workspace
+  dependencies.
+
 ### Changed
 
 - **`fallow health --group-by --top N` applies the limit to each group.**
```

**File**: `crates/core/src/analyze/bundle_externalization.rs` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+//! Detect a build config that leaves every package external.
+//!
+//! esbuild's `packages: 'external'` option keeps every bare import out of the
+//! bundle, workspace siblings included. A workspace whose build sets it does
+//! not inline a private sibling's source, so the sibling's packages are not
+//! resolved from that workspace's manifest.
+
+use std::path::Path;
+
+use oxc_allocator::Allocator;
+use oxc_ast::ast::{Expression, ObjectProperty, PropertyKey};
+use oxc_ast_visit::{Visit, walk};
+use oxc_parser::Parser;
+use oxc_span::SourceType;
+
+/// Return `true` when `source` contains an object property
+/// `packages: 'external'` (a string or a template literal without
+/// expressions).
+pub(super) fn source_sets_packages_external(source: &str, path: &Path) -> bool {
+    if !source.contains("packages") || !source.contains("external") {
+        return false;
+    }
+    let source_type = SourceType::from_path(path).unwrap_or_default();
+    let allocator = Allocator::default();
+    let parsed = Parser::new(&allocator, source, source_type).parse();
+    let mut finder = PackagesExternalFinder { found: false };
+    finder.visit_program(&parsed.program);
+    finder.found
+}
+
+struct PackagesExternalFinder {
+    found: bool,
+}
+
+impl<'a> Visit<'a> for PackagesExternalFinder {
+    fn visit_object_property(&mut self, property: &ObjectProperty<'a>) {
+        if is_packages_key(&property.key) && is_external_value(&property.value) {
+            self.found = true;
+            return;
+        }
+        walk::walk_object_property(self, property);
+    }
+}
+
+fn is_packages_key(key: &PropertyKey<'_>) -> bool {
+    key.static_name().is_some_and(|name| name == "packages")
+}
+
+fn is_external_value(value: &Expression<'_>) -> bool {
+    match value {
+        Expression::StringLiteral(literal) => literal.value == "external",
+        Expression::TemplateLiteral(template) => template
+            .single_quasi()
+            .is_some_and(|quasi| quasi == "external"),
+        _ => false,
+    }
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    fn sets(source: &str) -> bool {
+        source_sets_packages_external(source, Path::new("build.mjs"))
+    }
+
+    #[test]
+    fn finds_packages_external_in_esbuild_build_call() {
+        assert!(sets(
+            r#"import * as esbuild from "esbuild";
+await esbuild.build({ entryPoints: ["src/index.ts"], bundle: true, packages: "external" });"#
+        ));
+        assert!(sets(
+            "const esbuild = require('esbuild');\nconst options = { bundle: true, 'packages': `external` };\nesbuild.build(options);"
+        ));
+    }
+
+    #[test]
+    fn ignores_other_packages_values_and_keys() {
+        assert!(!sets(
+            r#"import * as esbuild from "esbuild";
+await esbuild.build({ bundle: true, packages: "bundle", external: ["react"] });"#
+        ));
+        assert!(!sets(
+            r#"export const meta = { name: "packages", kind: "external" };"#
+        ));
+    }
+}
```

**File**: `crates/core/src/analyze/mod.rs` (modified, +1/-0)
```diff
@@ -1,6 +1,7 @@
 mod boundary;
 mod boundary_calls;
 mod boundary_coverage;
+mod bundle_externalization;
 mod deprecated_exports;
 mod duplicate_prop_shape;
 mod dynamic_segment_name_conflict;
```

**File**: `crates/core/src/analyze/unused_deps.rs` (modified, +56/-1)
```diff
@@ -15,6 +15,7 @@ use crate::results::{
 };
 use crate::suppress::{IssueKind, SuppressionContext};
 
+use super::bundle_externalization::source_sets_packages_external;
 use super::gitignored_targets::GitignoredTargets;
 use super::package_json_utils::{find_dep_line_in_json, read_pkg_json_content};
 use super::predicates::{
@@ -249,6 +250,9 @@ struct WorkspaceManifest<'a> {
     /// `devDependencies` are build-time needs of this workspace alone and are
     /// never inlined into a consumer, so they are deliberately excluded.
     shipped: FxHashSet<String>,
+    /// A package script bundles with every package external
+    /// (`bun build --packages=external`, `esbuild --packages=external`).
+    externalizes_packages: bool,
 }
 
 /// Names a workspace carries into anything that inlines its source.
@@ -291,6 +295,11 @@ fn read_workspace_manifests<'a>(
                     .chain(pkg.optional_dependency_names())
                     .collect(),
                 shipped: shipped_dependency_names(&pkg),
+                externalizes_packages: pkg.scripts.as_ref().is_some_and(|scripts| {
+                    scripts
+                        .values()
+                        .any(|script| crate::scripts::script_externalizes_packages(script))
+                }),
             })
         })
         .collect()
@@ -313,9 +322,13 @@ fn dependency_owning_workspace_roots<'a>(manifests: &[WorkspaceManifest<'a>]) ->
 /// package brings its own dependency tree and needs no hoisting. Crediting a
 /// published sibling's packages would suppress a genuine finding. Workspace
 /// graphs can be cyclic, so each walk carries a visited set.
+///
+/// A consumer in `externalizing` leaves every package out of its bundle, so it
+/// does not inline a sibling and gets no credit.
 fn collect_bundled_workspace_usage<'a>(
     manifests: &[WorkspaceManifest<'a>],
     workspace_used_packages: &FxHashMap<&'a Path, FxHashSet<&'a str>>,
+    externalizing: &FxHashSet<usize>,
 ) -> FxHashMap<&'a Path, FxHashSet<&'a str>> {
     let private_by_name: FxHashMap<&str, usize> = manifests
         .iter()
@@ -331,6 +344,7 @@ fn collect_bundled_workspace_usage<'a>(
     manifests
         .par_iter()
         .enumerate()
+        .filter(|(index, _)| !externalizing.contains(index))
         .map(|(index, consumer)| {
             let bundled = bundled_packages_for(
                 index,
@@ -390,6 +404,46 @@ fn bundled_packages_for<'a>(
     bundled
 }
 
+/// Indices of the workspaces whose build leaves every package external.
+///
+/// The signal is explicit: a package script that runs
+/// `bun build --packages=external` or `esbuild --packages=external`, or a file
+/// of the workspace that imports `esbuild` and sets `packages: 'external'`.
+/// Without it, a private sibling is assumed to be bundled.
+fn collect_externalizing_workspaces(
+    graph: &ModuleGraph,
+    manifests: &[WorkspaceManifest<'_>],
+    ownership: &WorkspaceOwnershipIndex,
+) -> FxHashSet<usize> {
+    let mut externalizing: FxHashSet<usize> = manifests
+        .iter()
+        .enumerate()
+        .filter(|(_, manifest)| manifest.externalizes_packages)
+        .map(|(index, _)| index)
+        .collect();
+    let Some(file_ids) = graph.package_usage.get("esbuild") else {
+        return externalizing;
+    };
+    let mut checked: FxHashSet<FileId> = FxHashSet::default();
+    for id in file_ids {
+        let Some(index) = ownership.workspace_index_for_file(*id) else {
+            continue;
+        };
+        if externalizing.contains(&index) || !checked.insert(*id) {
+            continue;
+        }
+        let Some(module) = graph.modules.get(id.0 as usize) else {
+            continue;
+        };
+        if std::fs::read_to_string(&module.path)
+            .is_ok_and(|source| source_sets_packages_external(&source, &module.path))
+        {
+            externalizing.insert(index);
+        }
+    }
+    externalizing
+}
+
 /// Reverse index: workspace root -> packages with ANY file under that root using
 /// them. Each module's deepest matching workspace root is pre-computed once in parallel so the
 /// package_usage walk costs O(packages * avg_files_per_package) instead of
@@ -857,8 +911,9 @@ fn collect_dependency_usage_indices<'a>(
     let ownership = WorkspaceOwnershipIndex::new(graph, &workspace_roots);
     let workspace_used_packages =
         collect_workspace_used_packages(graph, &workspace_roots, &ownership);
+    let externalizing = collect_externalizing_workspaces(graph, &manifests, &ownership);
     let bundled_workspace_usage =
-        collect_bundled_workspace_usage(&manifests, &workspace_used_packages);
+        collect_bundled_workspace_usage(&manifests, &workspace_used_packages, &externalizing);
     let ancestor_credited_packages =
         collect_ancestor_credited_packages(graph, config, &manifests, &ownership);
     let root_credited_packages = collect_root_credited_packages(graph, &manifests, &ownership);
```

**File**: `crates/core/src/analyze/unused_deps_tests/collect_unused.rs` (modified, +1/-0)
```diff
@@ -526,6 +526,7 @@ fn manifest<'a>(
         shipped: declared.clone(),
         installed: declared.clone(),
         declared,
+        externalizes_packages: false,
     }
 }
 
```

**File**: `crates/core/src/scripts/mod.rs` (modified, +83/-0)
```diff
@@ -206,6 +206,61 @@ fn file_target_tool(binary: &str) -> Option<&'static FileTargetTool> {
         .find(|tool| tool.names.contains(&name))
 }
 
+/// Return `true` when a script bundles with every package left external:
+/// `bun build --packages=external` or `esbuild --packages=external`, also with
+/// the value as a separate argument.
+///
+/// Such a build does not inline the source of a workspace sibling, so the
+/// sibling's own packages are not resolved from the bundling workspace.
+#[must_use]
+pub fn script_externalizes_packages(script: &str) -> bool {
+    shell::split_shell_operators(script)
+        .into_iter()
+        .any(|segment| {
+            let words = shell::split_words(segment);
+            let tokens: Vec<&str> = words.iter().map(|word| word.value.as_ref()).collect();
+            command_externalizes_packages(&tokens)
+        })
+}
+
+fn command_externalizes_packages(tokens: &[&str]) -> bool {
+    let Some(idx) = shell::skip_initial_wrappers(tokens, 0) else {
+        return false;
+    };
+    let args_start = if let Some(build_idx) = bun_build_subcommand(tokens, idx) {
+        build_idx + 1
+    } else {
+        let Some(binary_idx) = shell::advance_past_package_manager(tokens, idx) else {
+            return false;
+        };
+        if tool_name(tokens[binary_idx]) != "esbuild" {
+            return false;
+        }
+        binary_idx + 1
+    };
+    let args = tokens.get(args_start..).unwrap_or_default();
+    args.iter().enumerate().any(|(i, arg)| {
+        *arg == "--packages=external"
+            || (*arg == "--packages" && args.get(i + 1) == Some(&"external"))
+    })
+}
+
+/// The index of `build` in `bun [runtime flags] build`, or `None` when the
+/// command at `idx` is not a `bun build` call.
+fn bun_build_subcommand(tokens: &[&str], idx: usize) -> Option<usize> {
+    if tokens.get(idx) != Some(&"bun") {
+        return None;
+    }
+    let mut next = idx + 1;
+    while tokens
+        .get(next)
+        .is_some_and(|token| shell::BUN_RUNTIME_FLAGS.contains(token))
+    {
+        next += 1;
+    }
+    (tokens.get(next) == Some(&"build")).then_some(next)
+}
+
 /// Return `true` when `binary` only reads its file arguments (a formatter,
 /// linter, or checker), so those arguments must not become entry points.
 #[must_use]
@@ -2876,6 +2931,34 @@ fn is_builtin_command(cmd: &str) -> bool {
 mod tests {
     use super::*;
 
+    #[test]
+    fn script_externalizes_packages_reads_bun_build_and_esbuild() {
+        for script in [
+            "bun build ./src/index.ts --outdir dist --packages=external",
+            "bun build ./src/index.ts --packages external --target node",
+            "tsc --noEmit && bun build src/cli.ts --packages=external",
+            "NODE_ENV=production esbuild src/index.ts --bundle --packages=external",
+            "npx esbuild src/index.ts --bundle --packages external",
+            "bunx esbuild src/index.ts --bundle \"--packages=external\"",
+        ] {
+            assert!(script_externalizes_packages(script), "{script}");
+        }
+    }
+
+    #[test]
+    fn script_externalizes_packages_ignores_other_commands() {
+        for script in [
+            "bun build ./src/index.ts --outdir dist",
+            "bun build ./src/index.ts --external react",
+            "esbuild src/index.ts --bundle --external:react",
+            "bun run build --packages=external",
+            "node scripts/build.mjs --packages=external",
+            "echo bun build --packages=external",
+        ] {
+            assert!(!script_externalizes_packages(script), "{script}");
+        }
+    }
+
     /// Analyze every script value without dependency context.
     fn analyze_scripts(
         scripts: &HashMap<String, String>,
```

**File**: `crates/core/tests/integration_test/dependencies.rs` (modified, +22/-0)
```diff
@@ -1267,6 +1267,28 @@ fn private_sibling_bundled_dependency_is_credited_to_the_consumer() {
     );
 }
 
+/// A consumer whose build leaves every package external does not inline the
+/// private sibling, so the sibling's packages do not need the consumer's
+/// declaration. The signal is esbuild `packages: 'external'` in a build file
+/// or `bun build --packages=external` in a package script.
+#[test]
+fn externalizing_consumer_gets_no_bundled_credit() {
+    for fixture in [
+        "private-workspace-externalized-esbuild",
+        "private-workspace-externalized-bun-build",
+    ] {
+        let config = create_config(fixture_path(fixture));
+        let results = fallow_core::analyze(&config).expect("analysis should succeed");
+
+        let reported = unused_dependency_names_for(&results, "packages/consumer/package.json");
+        assert_eq!(
+            reported,
+            vec!["lodash-es".to_string()],
+            "{fixture}: the externalized sibling's lodash-es is not credited to the consumer"
+        );
+    }
+}
+
 /// A published sibling is installed from the registry with its own dependency
 /// tree, so the consumer never needs the sibling's packages hoisted. Crediting
 /// them there would hide a real finding.
```

**File**: `tests/fixtures/private-workspace-externalized-bun-build/package.json` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+{
+  "name": "private-workspace-externalized-bun-build",
+  "private": true,
+  "workspaces": ["packages/*"]
+}
```

#### Recent Merged Pull Requests:
- **PR #3207** (2026-10-05): fix(plugins): respect Playwright test directories and matchers (@BartWaardenburg)
- **PR #3206** (2026-10-05): fix(health): count thresholded hotspots and guard formula changes (@BartWaardenburg)
- **PR #3205** (2026-10-05): chore: pin Ubuntu CI runners to 26.04 (@BartWaardenburg)
- **PR #3204** (2026-10-05): fix(docs): select npm package for MCP launcher (@BartWaardenburg)
- **PR #3202** (2026-10-05): fix(resolve): preserve module precedence across resolution routes (@osazemeu)
- **PR #3199** (closed): fix(css): preserve unsuppressed Tailwind occurrences (@ppwasin)
- **PR #3198** (2026-10-03): docs: use a fictional project in the README audit example (@BartWaardenburg)
- **PR #3197** (closed): chore: integration check for #3187-#3196 (do not merge) (@BartWaardenburg)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
