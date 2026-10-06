# Forensic Learning Record (Deep Inspection): fastclaw-ai/fastclaw

> **Canonical Artifact**: `07_PROJECT_LEARNING/fastclaw-ai-fastclaw-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/fastclaw-ai/fastclaw](https://github.com/fastclaw-ai/fastclaw))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:22:11.043Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `fastclaw-ai/fastclaw`
- **Description**: Multi-Agent Framework
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 1354 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `internal/agent/bundled_skills/skill-creator/scripts/run_loop.py`
```
#!/usr/bin/env python3
"""Run the eval + improve loop until all pass or max iterations reached.

Combines run_eval.py and improve_description.py in a loop, tracking history
and returning the best description found. Supports train/test split to prevent
overfitting.
"""

import argparse
import json
import random
import sys
import tempfile
import time
import webbrowser
from pathlib import Path

from scripts.generate_report import generate_html
from scripts.improve_description import improve_description
from scripts.run_eval import find_project_root, run_eval
from scripts.utils import parse_skill_md


def split_eval_set(eval_set: list[dict], holdout: float, seed: int = 42) -> tuple[list[dict], list[dict]]:
    """Split eval set into train and test sets, stratified by should_trigger."""
    random.seed(seed)

    # Separate by should_trigger
    trigger = [e for e in eval_set if e["should_trigger"]]
    no_trigger = [e for e in eval_set if not e["should_trigger"]]

    # Shuffle each group
    random.shuffle(trigger)
    random.shuffle(no_trigger)

    # Calculate split points
    n_trigger_test = max(1, int(len(trigger) * holdout))
    n_no_trigger_test = max(1, int(len(no_trigger) * holdout))

    # Split
    test_set = trigger[:n_trigger_test] + no_trigger[:n_no_trigger_test]
    train_set = trigger[n_trigger_test:] + no_trigger[n_no_trigger_test:]

    return train_set, test_set


def run_loop(
    eval_set: list[dict],
    skill_path: Path,
    description_override: str | None,
    num_workers: int,
    timeout: int,
    max_iterations: int,
    runs_per_query: int,
    trigger_threshold: float,
    holdout: float,
    model: str,
    verbose: bool,
    live_report_path: Path | None = None,
    log_dir: Path | None = None,
) -> dict:
    """Run the eval + improvement loop."""
    project_root = find_project_root()
    name, original_description, content = parse_skill_md(skill_path)
    current_description = description_override or original_description

    # Split into train/test if holdout > 0
    if holdout > 0:
        train_set, test_set = split_eval_set(eval_set, holdout)
        if verbose:
            print(f"Split: {len(train_set)} train, {len(test_set)} test (holdout={holdout})", file=sys.stderr)
    else:
        train_set = eval_set
        test_set = []

    history = []
    exit_reason = "unknown"

    for iteration in range(1, max_iterations + 1):
        if verbose:
            print(f"\n{'='*60}", file=sys.stderr)
            print(f"Iteration {iteration}/{max_iterations}", file=sys.stderr)
            print(f"Description: {current_description}", file=sys.stderr)
            print(f"{'='*60}", file=sys.stderr)

        # Evaluate train + test together in one batch for parallelism
        all_queries = train_set + test_set
        t0 = time.time()
        all_results = run_eval(
            eval_set=all_queries,
            skill_name=name,
            description=current_description,
            num_workers=num_workers,
            timeout=timeout,
            project_root=project_root,
            runs_per_query=runs_per_query,
            trigger_threshold=trigger_threshold,
            model=model,
        )
        eval_elapsed = time.time() - t0

        # Split results back into train/test by matching queries
        train_queries_set = {q["query"] for q in train_set}
        train_result_list = [r for r in all_results["results"] if r["query"] in train_queries_set]
        test_result_list = [r for r in all_results["results"] if r["query"] not in train_queries_set]

        train_passed = sum(1 for r in train_result_list if r["pass"])
        train_total = len(train_result_list)
        train_summary = {"passed": train_passed, "failed": train_total - train_passed, "total": train_total}
        train_results = {"results": train_result_list, "summary": train_summary}

        if test_set:
            test_passed = sum(1 for r in test_result_list if r["pass"])
            test_total = len(test_result_list)
            test_summary = {"passed": test_passed, "failed": test_total - test_passed, "total": test_total}
            test_results = {"results": test_result_list, "summary": test_summary}
        else:
            test_results = None
            test_summary = None

        history.append({
            "iteration": iteration,
            "description": current_description,
            "train_passed": train_summary["passed"],
            "train_failed": train_summary["failed"],
            "train_total": train_summary["total"],
            "train_results": train_results["results"],
            "test_passed": test_summary["passed"] if test_summary else None,
            "test_failed": test_summary["failed"] if test_summary else None,
            "test_total": test_summary["total"] if test_summary else None,
            "test_results": test_results["results"] if test_results else None,
            # For backward compat with report generator
            "passed": train_summary["passed"],
            "failed": train_summary["failed"],
            "total": train_summary["total"],
            "results": train_results["results"],
        })

        # Write live report if path provided
        if live_report_path:
            partial_output = {
                "original_description": original_description,
                "best_description": current_description,
                "best_score": "in progress",
                "iterations_run": len(history),
                "holdout": holdout,
                "train_size": len(train_set),
                "test_size": len(test_set),
                "history": history,
            }
            live_report_path.write_text(generate_html(partial_output, auto_refresh=True, skill_name=name))

        if verbose:
            def print_eval_stats(label, results, elapsed):
                pos = [r for r in results if r["should_trigger"]]
                neg = [r for r in results if not r["should_trigger"]]
                tp = sum(r["triggers"] for r in pos)
                pos_runs = sum(r["runs"] for r in pos)
                fn = pos_runs - tp
                fp = sum(r["triggers"] for r in neg)
                neg_runs = sum(r["runs"] for r in neg)
                tn = neg_runs - fp
                total = tp + tn + fp + fn
                precision = tp / (tp + fp) if (tp + fp) > 0 else 1.0
                recall = tp / (tp + fn) if (tp + fn) > 0 else 1.0
                accuracy = (tp + tn) / total if total > 0 else 0.0
                print(f"{label}: {tp+tn}/{total} correct, precision={precision:.0%} recall={recall:.0%} accuracy={accuracy:.0%} ({elapsed:.1f}s)", file=sys.stderr)
                for r in results:
                    status = "PASS" if r["pass"] else "FAIL"
                    rate_str = f"{r['triggers']}/{r['runs']}"
                    print(f"  [{status}] rate={rate_str} expected={r['should_trigger']}: {r['query'][:60]}", file=sys.stderr)

            print_eval_stats("Train", train_results["results"], eval_elapsed)
            if test_summary:
                print_eval_stats("Test ", test_results["results"], 0)

        if train_summary["failed"] == 0:
            exit_reason = f"all_passed (iteration {iteration})"
            if verbose:
                print(f"\nAll train queries passed on iteration {iteration}!", file=sys.stderr)
            break

        if iteration == max_iterations:
            exit_reason = f"max_iterations ({max_iterations})"
            if verbose:
                print(f"\nMax iterations reached ({max_iterations}).", file=sys.stderr)
            break

        # Improve the description based on train results
        if verbose:
            print(f"\nImproving description...", file=sys.stderr)

        t0 = time.time()
        # Strip test scores from history so improvement model can't see them
        blinded_history = [
            {k: v for k, v in h.items() if not k.startswith("test_")}
            for h in history
        ]
        new_description = improve_description(
            skill_name=name,
            skill_content=content,
            current_description=current_description,
            eval_results=train_results,
            history=blinded_history,
            model=model,
            log_dir=log_dir,
            iteration=iteration,
        )
        improve_elapsed = time.time() - t0

        if verbose:
            print(f"Proposed ({improve_elapsed:.1f}s): {new_description}", file=sys.stderr)

        current_description = new_description

    # Find the best iteration by TEST score (or train if no test set)
    if test_set:
        best = max(history, key=lambda h: h["test_passed"] or 0)
        best_score = f"{best['test_passed']}/{best['test_total']}"
    else:
        best = max(history, key=lambda h: h["train_passed"])
        best_score = f"{best['train_passed']}/{best['train_total']}"

    if verbose:
        print(f"\nExit reason: {exit_reason}", file=sys.stderr)
        print(f"Best score: {best_score} (iteration {best['iteration']})", file=sys.stderr)

    return {
        "exit_reason": exit_reason,
        "original_description": original_description,
        "best_description": best["description"],
        "best_score": best_score,
        "best_train_score": f"{best['train_passed']}/{best['train_total']}",
        "best_test_score": f"{best['test_passed']}/{best['test_total']}" if test_set else None,
        "final_description": current_description,
        "iterations_run": len(history),
        "holdout": holdout,
        "train_size": len(train_set),
        "test_size": len(test_set),
        "history": history,
    }


def main():
    parser = argparse.ArgumentParser(description="Run eval + improve loop")
    parser.add_argument("--eval-set", required=True, help="Path to eval set JSON file")
    parser.add_argument("--skill-path", required=True, help="Path to skill directory")
    parser.add_argument("--description", default=None, help="Override starting descriptio
```

### Core Architecture Module: `internal/agent/bundled_skills/skill-creator/scripts/utils.py`
```
"""Shared utilities for skill-creator scripts."""

from pathlib import Path



def parse_skill_md(skill_path: Path) -> tuple[str, str, str]:
    """Parse a SKILL.md file, returning (name, description, full_content)."""
    content = (skill_path / "SKILL.md").read_text()
    lines = content.split("\n")

    if lines[0].strip() != "---":
        raise ValueError("SKILL.md missing frontmatter (no opening ---)")

    end_idx = None
    for i, line in enumerate(lines[1:], start=1):
        if line.strip() == "---":
            end_idx = i
            break

    if end_idx is None:
        raise ValueError("SKILL.md missing frontmatter (no closing ---)")

    name = ""
    description = ""
    frontmatter_lines = lines[1:end_idx]
    i = 0
    while i < len(frontmatter_lines):
        line = frontmatter_lines[i]
        if line.startswith("name:"):
            name = line[len("name:"):].strip().strip('"').strip("'")
        elif line.startswith("description:"):
            value = line[len("description:"):].strip()
            # Handle YAML multiline indicators (>, |, >-, |-)
            if value in (">", "|", ">-", "|-"):
                continuation_lines: list[str] = []
                i += 1
                while i < len(frontmatter_lines) and (frontmatter_lines[i].startswith("  ") or frontmatter_lines[i].startswith("\t")):
                    continuation_lines.append(frontmatter_lines[i].strip())
                    i += 1
                description = " ".join(continuation_lines)
                continue
            else:
                description = value.strip('"').strip("'")
        i += 1

    return name, description, content

```

### Core Architecture Module: `internal/agent/goal_hook.go`
```
package agent

import (
	"context"
	"errors"
	"log/slog"

	"github.com/fastclaw-ai/fastclaw/internal/agent/goal"
	"github.com/fastclaw-ai/fastclaw/internal/bus"
)

// NewTokenAccountingHook returns an AfterModelCall hook that folds
// the call's Usage into the active goal for the in-flight session
// and persists the result. Returns nil when st is nil — callers can
// register the result unconditionally without a guard.
//
// Gates before doing any work:
//   - HookContext.GoalSessionKey must be non-empty (turn happened
//     inside a chat context)
//   - HookContext.Error must be nil (a failed call has no usage
//     worth folding, even when the provider helpfully returns one)
//   - Response.Usage must have at least one non-zero count (zero
//     value means the provider didn't report)
//
// Past those gates the call routes through goal.FoldUsage and then
// st.UpdateGoal. Errors are logged at warn and swallowed — a store
// failure should not leak into the agent's response path; the next
// call will see the same delta and retry.
//
// When the fold flips a goal to BudgetLimited, this hook publishes
// the budget_limit prompt directly. The transition is observed
// exactly once: FoldUsage's "non-active goals are skipped" gate
// prevents the next call from re-publishing.
func NewTokenAccountingHook(st goal.Store, mb *bus.MessageBus, agentID string) HookFunc {
	if st == nil {
		return nil
	}
	return func(ctx context.Context, hc *HookContext) {
		if hc.Point != AfterModelCall {
			return
		}
		if hc.Error != nil {
			return
		}
		if hc.GoalSessionKey == "" {
			return
		}
		if hc.Response == nil {
			return
		}
		// Treat the zero-value Usage as "provider didn't report" — same
		// as the old nil check before provider.Usage became a value
		// type. Budget enforcement is only meaningful when we have at
		// least one non-zero count.
		u := hc.Response.Usage
		if u.InputTokens == 0 && u.OutputTokens == 0 && u.CacheReadTokens == 0 && u.CacheCreationTokens == 0 {
			return
		}

		g, err := st.GetGoalBySession(ctx, agentID, hc.GoalSessionKey)
		if errors.Is(err, goal.ErrNotFound) {
			return
		}
		if err != nil {
			slog.Warn("goal accounting: load goal failed",
				"agent", agentID, "session_key", hc.GoalSessionKey, "error", err)
			return
		}
		if g.Status != goal.StatusActive {
			// Continuation turns for budget_limited / complete goals
			// still fire AfterModelCall; FoldUsage's own gate would
			// reject them anyway, but skipping here saves a store
			// round-trip and keeps the log line below honest.
			return
		}

		delta, exhausted := goal.FoldUsage(g, int64(u.InputTokens), int64(u.OutputTokens))
		if delta == 0 && !exhausted {
			// Nothing changed (e.g. all-cached prompt). Skip the
			// persist round-trip — we'd just rewrite the same row.
			return
		}

		if err := st.UpdateGoal(ctx, g); err != nil {
			slog.Warn("goal accounting: persist failed",
				"agent", agentID, "session_key", hc.GoalSessionKey,
				"delta", delta, "exhausted", exhausted, "error", err)
			return
		}
		if exhausted {
			slog.Info("goal budget exhausted",
				"agent", agentID, "session_key", hc.GoalSessionKey,
				"tokens_used", g.TokensUsed, "token_budget", *g.TokenBudget)
			prompt := goal.BudgetLimitPrompt(g)
			if !goal.Publish(mb, g, prompt) {
				slog.Warn("goal accounting: bus full, budget_limit prompt dropped",
					"agent", agentID, "session_key", hc.GoalSessionKey)
			}
		}
	}
}

```

### Core Architecture Module: `internal/agent/hooks.go`
```
package agent

import (
	"context"
	"log/slog"
	"time"

	"github.com/fastclaw-ai/fastclaw/internal/provider"
)

// HookPoint identifies where in the agent loop a hook fires.
type HookPoint int

const (
	BeforeSystemPrompt HookPoint = iota
	AfterSystemPrompt
	BeforeModelCall
	AfterModelCall
	BeforeToolCall
	AfterToolCall
	PostTurn // fires after a complete agent turn (response + all tool calls)
)

// HookContext carries data available to hooks at each hook point.
type HookContext struct {
	AgentName     string
	Point         HookPoint
	Messages      []provider.Message
	ToolName      string // for tool-related hooks
	ToolArgs      string // for BeforeToolCall
	ToolResult    string // for AfterToolCall
	Response      *provider.Response
	Error         error
	StartTime     time.Time // set at BeforeModelCall/BeforeToolCall for timing
	TurnCount     int       // incremented each agent turn (for PostTurn)
	ToolCallCount int       // total tool calls in this turn (for PostTurn)
	Workspace     string    // agent workspace path (for PostTurn)
	UserID        string    // owning user ID for multi-user namespace isolation
	ChatID        string    // used by the plugin hook adapter
	// Channel + AccountID complete the bus routing triple. Plugins
	// reading these in a hook.fire payload can echo them back to
	// chat.send so a follow-up message reaches the same chat that
	// just got the agent's reply.
	Channel   string
	AccountID string
	// Source mirrors bus.InboundMessage.Source so PostTurn hooks can
	// distinguish a real user turn from a cron / heartbeat / sub-agent
	// / goal-context turn. Empty means user. Hooks that should only
	// fire on user-originated turns (notably the goal trigger) gate
	// on this.
	Source string

	// GoalSessionKey is the persistent session_key for the in-flight
	// turn. The goal-accounting hook reads it to look up the active
	// goal (if any) for this session. Empty when the turn happened
	// outside a chat context.
	GoalSessionKey string

	// IsPlanMode reports whether this turn ran in plan-mode (model
	// emits a plan, doesn't act). Goal trigger hooks gate on this so
	// a plan-only turn doesn't auto-fire a continuation behind the
	// user's back — plan mode exists precisely to let the user review
	// before more work happens.
	IsPlanMode bool
}

// HookFunc is a function that runs at a hook point.
// It can inspect and modify the HookContext.
type HookFunc func(ctx context.Context, hc *HookContext)

// HookRegistry stores registered hooks per hook point.
type HookRegistry struct {
	hooks map[HookPoint][]HookFunc
}

// NewHookRegistry creates a new hook registry.
func NewHookRegistry() *HookRegistry {
	return &HookRegistry{
		hooks: make(map[HookPoint][]HookFunc),
	}
}

// Register adds a hook function for the given hook point.
func (hr *HookRegistry) Register(point HookPoint, fn HookFunc) {
	hr.hooks[point] = append(hr.hooks[point], fn)
}

// Run executes all hooks registered at the given point.
func (hr *HookRegistry) Run(ctx context.Context, hc *HookContext) {
	for _, fn := range hr.hooks[hc.Point] {
		fn(ctx, hc)
	}
}

// LoggingHook returns a hook function that logs timing information.
func LoggingHook() HookFunc {
	return func(ctx context.Context, hc *HookContext) {
		switch hc.Point {
		case BeforeModelCall:
			hc.StartTime = time.Now()
			slog.Info("hook: before model call", "agent", hc.AgentName)
		case AfterModelCall:
			elapsed := time.Since(hc.StartTime)
			hasTools := hc.Response != nil && hc.Response.HasToolCalls()
			slog.Info("hook: after model call",
				"agent", hc.AgentName,
				"elapsed", elapsed,
				"has_tool_calls", hasTools,
			)
		case BeforeToolCall:
			hc.StartTime = time.Now()
			slog.Info("hook: before tool call",
				"agent", hc.AgentName,
				"tool", hc.ToolName,
			)
		case AfterToolCall:
			elapsed := time.Since(hc.StartTime)
			slog.Info("hook: after tool call",
				"agent", hc.AgentName,
				"tool", hc.ToolName,
				"elapsed", elapsed,
				"error", hc.Error,
			)
		case BeforeSystemPrompt:
			slog.Debug("hook: before system prompt", "agent", hc.AgentName)
		case AfterSystemPrompt:
			slog.Debug("hook: after system prompt", "agent", hc.AgentName)
		}
	}
}

```

### Core Architecture Module: `internal/agent/loop.go`
```
package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"

	"github.com/codeany-ai/open-agent-sdk-go/costtracker"

	"github.com/fastclaw-ai/fastclaw/internal/agent/goal"
	"github.com/fastclaw-ai/fastclaw/internal/agent/tools"
	"github.com/fastclaw-ai/fastclaw/internal/buildinfo"
	"github.com/fastclaw-ai/fastclaw/internal/bus"
	"github.com/fastclaw-ai/fastclaw/internal/channels"
	"github.com/fastclaw-ai/fastclaw/internal/config"
	"github.com/fastclaw-ai/fastclaw/internal/mcp"
	"github.com/fastclaw-ai/fastclaw/internal/privacy"
	"github.com/fastclaw-ai/fastclaw/internal/provider"
	coderuntime "github.com/fastclaw-ai/fastclaw/internal/runtime"
	"github.com/fastclaw-ai/fastclaw/internal/sandbox"
	"github.com/fastclaw-ai/fastclaw/internal/scope"
	"github.com/fastclaw-ai/fastclaw/internal/session"
	"github.com/fastclaw-ai/fastclaw/internal/store"
	"github.com/fastclaw-ai/fastclaw/internal/toolproviders"
	"github.com/fastclaw-ai/fastclaw/internal/usage"
	"github.com/fastclaw-ai/fastclaw/internal/workspace"
)

// Agent is the ReAct agent loop.
type Agent struct {
	name                 string
	provider             provider.Provider
	registry             *tools.Registry
	sessions             *session.Manager
	memory               *Memory
	ctxBuilder           *ContextBuilder
	mcpMgr               *mcp.Manager
	hooks                *HookRegistry
	model                string
	maxTokens            int
	temperature          float64
	maxToolIterations    int
	maxParallelToolCalls int // 0 = unlimited
	thinking             string
	// promptMode is kept on Agent so ReloadWorkspaceFiles can re-apply it
	// when it rebuilds ctxBuilder — without this, every skill install /
	// dashboard reload silently drops the agent back to agent-mode prompt
	// even after the operator explicitly chose chatbot/customize.
	// PromptMode also drives the per-turn tool filter via
	// builtinAllowForMode below.
	promptMode    string
	homePath      string // agent's home: SOUL.md, sessions, memory, skills
	workspacePath string // working dir where agent creates user files
	homeDir       string // FastClaw root, ~/.fastclaw
	ownerUserID   string // the UserSpace user the agent runs for (hook / data namespacing)
	// agentOwnerID is agents.user_id — the account that actually owns the
	// agent. It differs from ownerUserID whenever the agent runs in another
	// user's space (an app's end-user, a public-link visitor, an admin
	// browsing). Owner/operator trust is decided against it.
	agentOwnerID string
	// admins is the per-channel allowlist of chatters who can run write-
	// mode slash commands (/new /undo /retry /compact /model /personality).
	// Keyed by channel name (e.g. "discord" → ["123...", "456..."]). Empty
	// or absent → no gate, anyone can run the command (legacy default).
	admins                  map[string][]string
	skillsCfg               config.SkillsConfig
	globalSkillsCfg         config.SkillsCfg
	messageBus              *bus.MessageBus
	subAgentSpawner         tools.SubAgentSpawner
	ftsStore                *store.FTSStore
	piiScrubEnabled         bool
	memoryCfg               config.MemoryCfg
	workspaceHistoryEnabled bool
	history                 *workspace.History
	// splitReplies is the per-agent multi-bubble toggle. Gates the
	// per-turn system-prompt hint that advertises SplitMessageMarker
	// to the LLM (see renderChannelHints) AND stamps
	// OutboundMessage.AllowSplit so the dispatcher splits the reply at
	// the marker before handing each chunk to the channel adapter.
	// Per-agent only — there's no system-level fallback.
	splitReplies bool
	// memoryStore is the optional Store-backed source of identity files
	// (SOUL.md, IDENTITY.md, ...). Kept on the Agent so ReloadWorkspaceFiles
	// can rewire a fresh ContextBuilder to keep reading from the Store
	// instead of silently falling back to pod-local filesystem.
	memoryStore MemoryStore
	// displayName mirrors agents.name (the operator-given name). Stamped
	// on the ContextBuilder for the IDENTITY.md fallback line — kept on
	// Agent too so ReloadWorkspaceFiles can re-apply after rebuilding
	// the ContextBuilder from scratch.
	displayName string
	// dataStore is the full relational Store (when wired by the
	// manager). Used for per-turn durable lookups that can't go through
	// the narrower MemoryStore — currently just the autoPersist gate
	// counting (chatter, agent) user-message rows so the cadence
	// survives daemon restarts / UserSpace invalidations / idle
	// evictions that all reset the in-memory turnCount.
	dataStore store.Store
	// workspaceStore is optional; when set, SkillsLoader hydrates per-agent
	// and global skill dirs from the object store on every turn so skills
	// uploaded post-boot or on a sibling replica become visible here.
	workspaceStore workspace.Store
	skillsLearner  *SkillsLearner
	turnCount      int
	turnCounter    *atomic.Int64
	engine         *sdkEngine
	costTracker    *costtracker.Tracker
	agentID        string
	// meter is the admin-level token meter. Non-nil only when the
	// gateway wires it in via SetMeter at boot — local-only dev runs
	// leave it nil and metering becomes a no-op via meterTokens().
	meter usage.Meter
	// quotaStore is the per-user billing quota store. When set, the
	// agent loop checks the owner's quota before processing a turn.
	// Nil means no quota enforcement (unlimited).
	quotaStore usage.QuotaStore
	// sandboxPool is the per-user (agent + session) sandbox pool. Set
	// once at boot/hot-reload by attachSandboxToAgents; bindSession
	// pulls a session-scoped executor from it at the top of every turn
	// so concurrent sessions of the same agent get isolated containers
	// + isolated /workspace mounts.
	sandboxPool sandbox.ExecutorPool

	// goalStore is the /goal feature's per-Agent state. Wired by
	// WireGoals; nil on agents whose Manager didn't provide a data
	// store (legacy single-user installs). When nil, the goal tools
	// and hook are simply not registered, so a missing store silently
	// degrades to "feature off" rather than crashing.
	goalStore goal.Store

	// projectRuntime, when non-nil, turns this agent into a coding agent:
	// it can scaffold a project from a template, boot a dev server, and
	// hand back a preview URL via the start_app_preview / app_preview_logs
	// tools. Wired by attachProjectRuntimeToAgents at boot. Nil for
	// ordinary agents, which then never see those tools and keep their
	// per-chat file isolation. See SetProjectRuntime.
	projectRuntime *coderuntime.Manager
}

// SetSandboxPool wires the per-(agent,session) executor pool. Called by
// attachSandboxToAgents on boot and by hot-reload's reloadSandbox after
// onboarding flips sandbox on. The pool is consulted by bindSession at
// the start of every chat turn — there's no eager Get at boot anymore
// because session IDs only exist once a chat starts.
//
// Also flips the context builder's sandbox flag so the system prompt's
// "Working Directory" / filesystem-layout description matches reality.
// Without this, an agent whose rc.Sandbox.Enabled=false but who got a
// pool reference (attachSandboxToAgents wires the pool to ALL agents
// once any one of them wants sandbox) ends up with exec routed through
// the container while the prompt still advertises host paths — model
// dutifully writes `/Users/.../workspaces/<id>/foo` which 404s inside
// the container. The two states must agree.
//
// The pool means two different things depending on the deploy mode
// (buildinfo.IsSandboxEnforced): enforced (hosted / opt-in env) locks
// ALL exec + file tools into the sandbox; optional (self-hosted
// default) keeps the host as the execution environment and merely makes
// the sandbox reachable per-call via exec(sandbox:true) — so the prompt
// keeps advertising host paths and the host-shell fallback stays legal.
func (a *Agent) SetSandboxPool(p sandbox.ExecutorPool) {
	a.sandboxPool = p
	enforced := p != nil && buildinfo.IsSandboxEnforced()
	if a.ctxBuilder != nil {
		a.ctxBuilder.sandboxEnabled = enforced
		a.ctxBuilder.sandboxOptional = p != nil && !enforced
	}
	// Tell the tool registry sandbox is required so its host-shell exec
	// fallback refuses to run when bindSession can't bind an executor.
	// The two states (system prompt advertising /workspace + /skills,
	// exec actually using sandbox) must agree — without this, a Docker
	// daemon hiccup turns into "sh: python: command not found" on the
	// host instead of a clear "sandbox required but unavailable" error.
	// Only in enforced mode: optional mode's host fallback is the point.
	if a.registry != nil {
		a.registry.SetSandboxRequired(enforced)
	}
}

// bindSession wires per-turn session state into the tool registry: the
// session-scoped sandbox executor (when a pool is configured), the
// sessionID workspace.Store calls use to namespace artifacts, and the
// (channel, accountID, chatID) bus address so deferred-work tools (create_cron_job)
// can stamp it onto persisted rows for later replay. Called at the top
// of HandleMessage / HandleMessageStream before any tool runs.
//
// HandleMessage and HandleMessageStream fork the registry before binding,
// so concurrent topics never mutate each other's tool or workspace scope.
func (a *Agent) bindSession(ctx context.Context, channel, accountID, sessionID, projectID string) {
	a.registry.SetSessionID(sessionID)
	a.registry.SetProjectID(projectID)
	// Coding agents (those with a project runtime wired) treat a project
	// as ONE shared app tree: file tools address the project root so the
	// agent's edits land where the dev server serves. Only when actually
	// inside a project; loose chats and non-coding agents are unaffected.
	a.registry.SetCodingRootScope(a.projectRuntime != nil && projectID != "")
	// If this scope already has a running app (a runtime record exists),
	// redirect file tools into its app subfolder so edits keep landing
	// where the
```

### Core Architecture Module: `internal/agent/tool_loop_detector.go`
```
package agent

import (
	"crypto/sha256"
	"strings"

	"github.com/fastclaw-ai/fastclaw/internal/provider"
)

const toolLoopDetectionThreshold = 3

type toolLoopDetector struct {
	last        toolLoopSignature
	consecutive int
}

type toolLoopSignature struct {
	name       string
	inputHash  [32]byte
	resultHash [32]byte
}

func (d *toolLoopDetector) Observe(tc provider.ToolCall, result string) bool {
	sig := toolLoopSignature{
		name:       tc.Function.Name,
		inputHash:  sha256.Sum256([]byte(tc.Function.Arguments)),
		resultHash: sha256.Sum256([]byte(strings.TrimSpace(result))),
	}
	if sig.name == d.last.name && sig.inputHash == d.last.inputHash && sig.resultHash == d.last.resultHash {
		d.consecutive++
	} else {
		d.consecutive = 1
		d.last = sig
	}
	return d.consecutive >= toolLoopDetectionThreshold
}

func repeatedToolCallWarning(content string) provider.Message {
	return provider.Message{Role: "system", Content: content}
}
```

### Core Architecture Module: `internal/plugin/hook_adapter.go`
```
package plugin

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/fastclaw-ai/fastclaw/internal/agent"
	"github.com/fastclaw-ai/fastclaw/internal/provider"
)

// hookPointName maps HookPoint constants to snake_case protocol names.
var hookPointName = map[agent.HookPoint]string{
	agent.BeforeModelCall: "before_model_call",
	agent.AfterModelCall:  "after_model_call",
	agent.BeforeToolCall:  "before_tool_call",
	agent.AfterToolCall:   "after_tool_call",
	agent.PostTurn:        "post_turn",
}

// hookPointFromName maps protocol snake_case names to HookPoint constants.
var hookPointFromName = map[string]agent.HookPoint{
	"before_model_call": agent.BeforeModelCall,
	"after_model_call":  agent.AfterModelCall,
	"before_tool_call":  agent.BeforeToolCall,
	"after_tool_call":   agent.AfterToolCall,
	"post_turn":         agent.PostTurn,
}

// syncHookPoints are hook points where we wait for the plugin response.
var syncHookPoints = map[agent.HookPoint]bool{
	agent.BeforeModelCall: true,
	agent.BeforeToolCall:  true,
}

const hookCallTimeout = 10 * time.Second

// RegisterPluginHooks queries a hook plugin for its desired hook points and
// registers HookFuncs in the agent's hook registry that forward events to the plugin.
func RegisterPluginHooks(ctx context.Context, mgr *Manager, pluginID string, registry *agent.HookRegistry, agentName string) error {
	inst := mgr.Plugin(pluginID)
	if inst == nil || inst.Process == nil || !inst.Process.IsRunning() {
		return fmt.Errorf("plugin %s not running", pluginID)
	}

	// Ask the plugin which hook points it wants
	result, err := inst.Process.Call(ctx, MethodHookRegister, nil)
	if err != nil {
		return fmt.Errorf("hook.register call to %s: %w", pluginID, err)
	}

	var reg HookRegisterResult
	if err := json.Unmarshal(result, &reg); err != nil {
		return fmt.Errorf("parse hook.register response from %s: %w", pluginID, err)
	}

	for _, pointName := range reg.Points {
		hp, ok := hookPointFromName[pointName]
		if !ok {
			slog.Warn("plugin: unknown hook point", "plugin", pluginID, "point", pointName)
			continue
		}

		// Capture loop variables
		capturedHP := hp
		capturedPointName := pointName
		proc := inst.Process

		registry.Register(capturedHP, func(ctx context.Context, hc *agent.HookContext) {
			params := buildHookFireParams(capturedPointName, hc)

			if syncHookPoints[capturedHP] {
				// Synchronous: call and wait for modified messages
				callCtx, cancel := context.WithTimeout(ctx, hookCallTimeout)
				defer cancel()

				raw, err := proc.Call(callCtx, MethodHookFire, params)
				if err != nil {
					slog.Warn("plugin: hook.fire call failed",
						"plugin", pluginID, "point", capturedPointName, "error", err)
					return
				}

				var fireResult HookFireResult
				if err := json.Unmarshal(raw, &fireResult); err != nil {
					slog.Warn("plugin: hook.fire result parse failed",
						"plugin", pluginID, "point", capturedPointName, "error", err)
					return
				}

				// If the plugin returned modified messages, apply them
				if len(fireResult.Messages) > 0 {
					hc.Messages = hookMessagesToProvider(fireResult.Messages)
				}
			} else {
				// Asynchronous: fire and forget
				if err := proc.Notify(MethodHookFire, params); err != nil {
					slog.Warn("plugin: hook.fire notify failed",
						"plugin", pluginID, "point", capturedPointName, "error", err)
				}
			}
		})

		slog.Info("plugin: registered hook",
			"plugin", pluginID, "point", capturedPointName, "agent", agentName)
	}

	return nil
}

// buildHookFireParams constructs HookFireParams from a HookContext.
func buildHookFireParams(pointName string, hc *agent.HookContext) HookFireParams {
	params := HookFireParams{
		Point:      pointName,
		AgentName:  hc.AgentName,
		Channel:    hc.Channel,
		AccountID:  hc.AccountID,
		ChatID:     hc.ChatID,
		UserID:     hc.UserID,
		ToolName:   hc.ToolName,
		ToolArgs:   hc.ToolArgs,
		ToolResult: hc.ToolResult,
	}

	// Serialize messages
	if len(hc.Messages) > 0 {
		msgs := make([]HookMessage, 0, len(hc.Messages))
		for _, m := range hc.Messages {
			hm := HookMessage{
				Role:       m.Role,
				Content:    m.Content,
				ToolCallID: m.ToolCallID,
				Name:       m.Name,
			}
			if len(m.ToolCalls) > 0 {
				if tc, err := json.Marshal(m.ToolCalls); err == nil {
					hm.ToolCalls = tc
				}
			}
			msgs = append(msgs, hm)
		}
		params.Messages = msgs
	}

	// Serialize response
	if hc.Response != nil {
		params.Response = &HookResponseData{
			Content:  hc.Response.Content,
			HasTools: hc.Response.HasToolCalls(),
		}
	}

	return params
}

// hookMessagesToProvider converts HookMessages back to provider.Messages.
func hookMessagesToProvider(msgs []HookMessage) []provider.Message {
	result := make([]provider.Message, 0, len(msgs))
	for _, hm := range msgs {
		pm := provider.Message{
			Role:       hm.Role,
			Content:    hm.Content,
			ToolCallID: hm.ToolCallID,
			Name:       hm.Name,
		}
		if len(hm.ToolCalls) > 0 {
			var tcs []provider.ToolCall
			if err := json.Unmarshal(hm.ToolCalls, &tcs); err == nil {
				pm.ToolCalls = tcs
			}
		}
		result = append(result, pm)
	}
	return result
}

```

### Core Architecture Module: `internal/policy/engine.go`
```
package policy

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

// Engine evaluates policy rules.
type Engine struct {
	policy *Policy
}

// NewEngine creates an engine with the given policy.
func NewEngine(p *Policy) *Engine {
	if p == nil {
		p = DefaultPolicy()
	}
	return &Engine{policy: p}
}

// Policy returns the current policy.
func (e *Engine) Policy() *Policy {
	return e.policy
}

// LoadFromFile parses a YAML policy file.
func LoadFromFile(path string) (*Policy, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read policy file: %w", err)
	}
	var p Policy
	if err := yaml.Unmarshal(data, &p); err != nil {
		return nil, fmt.Errorf("parse policy YAML: %w", err)
	}
	return &p, nil
}

// LoadPreset returns a named preset policy.
func LoadPreset(name string) *Policy {
	switch strings.ToLower(name) {
	case "restricted":
		return RestrictedPolicy()
	case "standard":
		return StandardPolicy()
	default:
		return DefaultPolicy()
	}
}

// CheckFilesystem checks whether a file path is allowed for read or write.
func (e *Engine) CheckFilesystem(path string, write bool) error {
	fs := e.policy.Filesystem

	if write {
		// Check deny first (deny wins)
		for _, pattern := range fs.DenyWrite {
			if matchGlob(pattern, path) {
				return fmt.Errorf("policy: write denied for %s (matches %s)", path, pattern)
			}
		}
		// If allow list is specified, path must match
		if len(fs.AllowWrite) > 0 {
			if !matchAny(fs.AllowWrite, path) {
				return fmt.Errorf("policy: write not allowed for %s", path)
			}
		}
	} else {
		// Check deny first
		for _, pattern := range fs.DenyRead {
			if matchGlob(pattern, path) {
				return fmt.Errorf("policy: read denied for %s (matches %s)", path, pattern)
			}
		}
		if len(fs.AllowRead) > 0 {
			if !matchAny(fs.AllowRead, path) {
				return fmt.Errorf("policy: read not allowed for %s", path)
			}
		}
	}
	return nil
}

// CheckNetwork checks whether a network request is allowed.
func (e *Engine) CheckNetwork(host string, port int, method string, path string) error {
	net := e.policy.Network

	switch net.Mode {
	case "none":
		return fmt.Errorf("policy: all network access denied")
	case "permissive", "":
		return nil
	case "allowlist":
		// Must match at least one outbound rule
		for _, rule := range net.Outbound {
			if !matchHost(rule.Host, host) {
				continue
			}
			if len(rule.Ports) > 0 && !containsInt(rule.Ports, port) {
				continue
			}
			if len(rule.Methods) > 0 && !containsStr(rule.Methods, strings.ToUpper(method)) {
				continue
			}
			if len(rule.Paths) > 0 && !matchAny(rule.Paths, path) {
				continue
			}
			return nil // matched
		}
		return fmt.Errorf("policy: network access denied for %s:%d", host, port)
	}
	return nil
}

// CheckTool checks whether a tool is allowed to be used.
func (e *Engine) CheckTool(toolName string) error {
	tools := e.policy.Tools

	// Deny always wins
	for _, d := range tools.Deny {
		if d == toolName || d == "*" {
			return fmt.Errorf("policy: tool %q denied", toolName)
		}
	}

	// If allow list is specified, must be in it
	if len(tools.Allow) > 0 {
		for _, a := range tools.Allow {
			if a == toolName || a == "*" {
				return nil
			}
		}
		return fmt.Errorf("policy: tool %q not allowed", toolName)
	}

	return nil
}

func matchGlob(pattern, path string) bool {
	matched, _ := filepath.Match(pattern, path)
	if matched {
		return true
	}
	// Also try matching against the base name
	matched, _ = filepath.Match(pattern, filepath.Base(path))
	return matched
}

func matchAny(patterns []string, path string) bool {
	for _, p := range patterns {
		if matchGlob(p, path) {
			return true
		}
		// Support prefix matching with trailing *
		if strings.HasSuffix(p, "*") && strings.HasPrefix(path, strings.TrimSuffix(p, "*")) {
			return true
		}
		// Support directory prefix (e.g. "/workspace" allows "/workspace/foo")
		if strings.HasPrefix(path, p) {
			return true
		}
	}
	return false
}

func matchHost(pattern, host string) bool {
	if pattern == "*" {
		return true
	}
	if strings.HasPrefix(pattern, "*.") {
		// Wildcard subdomain match
		suffix := pattern[1:] // ".example.com"
		return strings.HasSuffix(host, suffix) || host == pattern[2:]
	}
	return pattern == host
}

func containsInt(slice []int, val int) bool {
	for _, v := range slice {
		if v == val {
			return true
		}
	}
	return false
}

func containsStr(slice []string, val string) bool {
	for _, v := range slice {
		if strings.EqualFold(v, val) {
			return true
		}
	}
	return false
}

```

### Core Architecture Module: `internal/sandbox/lifecycle.go`
```
package sandbox

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"strings"
	"sync"
	"time"

	"github.com/fastclaw-ai/fastclaw/internal/workspace"
)

// bytesReader wraps a byte slice as an io.Reader — inlined helper so flush
// code doesn't clutter with bytes.NewReader calls.
func bytesReader(b []byte) io.Reader { return bytes.NewReader(b) }

// LifecyclePool wraps any ExecutorPool with two knobs that matter for cost
// in multi-tenant cloud deployments:
//
//  1. Lazy creation — sandboxes aren't spun up until the first tool call.
//     An agent that just chats (no exec/read_file/write_file) never starts
//     one, so idle users pay nothing for sandbox compute.
//  2. Idle eviction — a background sweeper Release()s sandboxes that have
//     been unused for IdleTTL. The next call recreates them; in the
//     meantime nothing is running.
//
// Backend-agnostic: works with DockerExecutorPool, E2B, or any future
// implementation. The inner pool still handles the actual create/destroy.
type LifecyclePool struct {
	inner   ExecutorPool
	idleTTL time.Duration
	sweep   time.Duration

	mu sync.Mutex
	// Both maps are keyed on poolKey(agentID, sessionID) so per-session
	// sandboxes are tracked independently. lastUsed drives idle eviction;
	// hydrated tracks whether we've already copied workspace.Store
	// contents into this sandbox (drops to false on eviction so the next
	// lazy-creation re-hydrates from the durable store).
	lastUsed map[string]time.Time
	hydrated map[string]bool
	// scopes maps the same composite key back to (agentID, sessionID) so
	// flush + release paths can talk to the right workspace scope without
	// re-parsing the key.
	scopes map[string]sandboxScope

	// workspace is the optional blob store that bootstraps /workspace on
	// sandbox creation. When nil, sandboxes start empty and rely on
	// write_file tool calls (which already write through workspace.Store)
	// to produce files the agent later reads via read_file.
	workspace workspace.Store

	stopCh chan struct{}
	done   chan struct{}
}

// sandboxScope is the (agentID, projectID, sessionID) tuple a sandbox
// belongs to. Stored alongside the composite map key so lifecycle code
// can call back into ExecutorPool.Get/Release with the right scope
// without re-parsing.
type sandboxScope struct {
	agentID   string
	projectID string
	sessionID string
}

// NewLifecyclePool wraps inner with idle tracking. idleTTL=0 disables
// eviction (everything stays alive); sweep=0 uses a sensible default.
func NewLifecyclePool(inner ExecutorPool, idleTTL, sweep time.Duration) *LifecyclePool {
	if sweep <= 0 {
		sweep = 30 * time.Second
	}
	return &LifecyclePool{
		inner:    inner,
		idleTTL:  idleTTL,
		sweep:    sweep,
		lastUsed: make(map[string]time.Time),
		hydrated: make(map[string]bool),
		scopes:   make(map[string]sandboxScope),
		stopCh:   make(chan struct{}),
		done:     make(chan struct{}),
	}
}

// SetWorkspace installs the durable blob store used to bootstrap each
// sandbox on first tool call. Pass nil to disable hydrate (sandboxes start
// with empty /workspace).
//
// Pools that hydrate themselves at create time (E2B uses one tar+exec
// round-trip for skills + workspace; see E2BExecutorPool.Get → Hydrate)
// receive the same store via SetWorkspace on the inner pool so they
// have a chance to fold it into the bulk upload — that's much faster
// and more reliable than the per-file fallback we still keep here for
// docker.
func (p *LifecyclePool) SetWorkspace(ws workspace.Store) {
	p.workspace = ws
	if sw, ok := p.inner.(workspaceAware); ok {
		sw.SetWorkspace(ws)
	}
}

// workspaceAware is implemented by inner pools that fold workspace
// hydration into their own create-time bulk upload (so LifecyclePool
// shouldn't double-hydrate via the per-file path).
type workspaceAware interface {
	SetWorkspace(ws workspace.Store)
}

// Start the idle sweep goroutine. Safe to call multiple times; only the
// first start actually kicks off the loop.
func (p *LifecyclePool) Start() {
	if p.idleTTL <= 0 {
		close(p.done) // nothing to do; keep Shutdown() cheap
		return
	}
	go p.loop()
}

func (p *LifecyclePool) loop() {
	defer close(p.done)
	t := time.NewTicker(p.sweep)
	defer t.Stop()
	for {
		select {
		case <-p.stopCh:
			return
		case <-t.C:
			p.evictIdle()
		}
	}
}

// evictIdle scans lastUsed and Release()s anything older than idleTTL.
// Held per-iteration lock; Release may be slow (destroys a container), so
// we release the map lock before the actual teardown to avoid blocking new
// Get()s on other agents.
func (p *LifecyclePool) evictIdle() {
	cutoff := time.Now().Add(-p.idleTTL)
	p.mu.Lock()
	toEvict := make([]sandboxScope, 0)
	for k, t := range p.lastUsed {
		if t.Before(cutoff) {
			toEvict = append(toEvict, p.scopes[k])
		}
	}
	// Remove from maps under lock so a racing Get doesn't mistake an
	// evicted sandbox for a live one. Clear hydrated too so the next
	// lazy-creation re-syncs from the workspace store.
	for _, sc := range toEvict {
		k := poolKey(sc.agentID, sc.projectID, sc.sessionID)
		delete(p.lastUsed, k)
		delete(p.hydrated, k)
		delete(p.scopes, k)
	}
	p.mu.Unlock()

	for _, sc := range toEvict {
		// Best-effort flush: if the executor implements
		// WorkspaceSnapshotter and we have a workspace store, upload
		// anything the sandbox wrote (that wasn't already written via
		// write_file) before destroying it.
		p.flushIfSupported(sc)

		if err := p.inner.Release(sc.agentID, sc.projectID, sc.sessionID); err != nil {
			slog.Warn("sandbox evict failed", "agent", sc.agentID, "session", sc.sessionID, "error", err)
			continue
		}
		slog.Info("sandbox evicted (idle)", "agent", sc.agentID, "session", sc.sessionID, "idleTTL", p.idleTTL)
	}
}

// flushIfSupported snapshots the sandbox workspace and uploads anything
// that isn't already in the durable store. Skips silently when the backend
// doesn't implement WorkspaceSnapshotter (docker is the only current
// implementer besides E2B) or when no workspace.Store is configured.
func (p *LifecyclePool) flushIfSupported(sc sandboxScope) {
	if p.workspace == nil {
		return
	}
	ex, err := p.inner.Get(context.Background(), sc.agentID, sc.projectID, sc.sessionID)
	if err != nil {
		return
	}
	p.syncSnapshot(context.Background(), sc, ex, "evict")
}

// syncSnapshot does the actual snapshot+diff+Put work. Pulled out of
// flushIfSupported so post-exec sync (lazyExecutor.Exec) can reuse it
// without re-fetching the executor through the inner pool. `cause` is a
// log tag so we can tell evict-flushes from per-exec syncs in slog.
func (p *LifecyclePool) syncSnapshot(ctx context.Context, sc sandboxScope, ex Executor, cause string) {
	if p.workspace == nil {
		return
	}
	snapper, ok := ex.(WorkspaceSnapshotter)
	if !ok {
		return
	}
	files, err := snapper.SnapshotWorkspace(ctx)
	if err != nil {
		slog.Warn("sandbox sync: snapshot failed", "agent", sc.agentID, "session", sc.sessionID, "cause", cause, "error", err)
		return
	}
	written := 0
	for path, data := range files {
		// Skip files that the store already has with identical size —
		// avoids rewriting every file every sync when nothing changed.
		// Content equality would be stricter but requires a full
		// round-trip per file; size is usually enough.
		if info, err := p.workspace.Stat(ctx, sc.agentID, sc.projectID, sc.sessionID, path); err == nil && info.Size == int64(len(data)) {
			continue
		}
		if err := p.workspace.Put(ctx, sc.agentID, sc.projectID, sc.sessionID, path, bytesReader(data), int64(len(data)), ""); err != nil {
			slog.Warn("sandbox sync: put failed", "agent", sc.agentID, "session", sc.sessionID, "cause", cause, "path", path, "error", err)
			continue
		}
		written++
	}
	if written > 0 {
		slog.Info("sandbox synced to workspace store", "agent", sc.agentID, "session", sc.sessionID, "cause", cause, "files", written)
	}
}

// Get returns a lazy proxy: tool calls on it will fetch the underlying
// executor from the inner pool on demand (creating a new sandbox if
// needed) and tick the last-used timestamp.
//
// Contract matches ExecutorPool.Get so LifecyclePool is a drop-in wrapper.
func (p *LifecyclePool) Get(ctx context.Context, agentID, projectID, sessionID string) (Executor, error) {
	return &lazyExecutor{pool: p, scope: sandboxScope{agentID: agentID, projectID: projectID, sessionID: sessionID}}, nil
}

// Release forwards to the inner pool and drops the lastUsed entry. Useful
// for explicit teardown (agent deletion) — normal flow relies on idle
// eviction.
func (p *LifecyclePool) Release(agentID, projectID, sessionID string) error {
	k := poolKey(agentID, projectID, sessionID)
	p.mu.Lock()
	delete(p.lastUsed, k)
	delete(p.hydrated, k)
	delete(p.scopes, k)
	p.mu.Unlock()
	return p.inner.Release(agentID, projectID, sessionID)
}

// CloseAll stops the sweeper and tears down every live sandbox. Called on
// gateway shutdown; skipping this would leak E2B instances that cost money
// until their max-TTL expires.
func (p *LifecyclePool) CloseAll() {
	select {
	case <-p.stopCh:
		// already stopped
	default:
		close(p.stopCh)
	}
	<-p.done
	p.inner.CloseAll()
	p.mu.Lock()
	p.lastUsed = make(map[string]time.Time)
	p.hydrated = make(map[string]bool)
	p.scopes = make(map[string]sandboxScope)
	p.mu.Unlock()
}

// inner fetches the underlying Executor, creating on first call. Separate
// from Get() so lazyExecutor can update lastUsed each time. On first
// creation (either fresh or post-eviction) it hydrates /workspace from the
// configured workspace.Store so exec'd commands see the files that
// write_file has produced in previous sessions.
func (p *LifecyclePool) getInner(ctx context.Context, sc sandboxScope) (Executor, error) {
	k := poolKey(sc.agentID, sc.projectID, sc.sessionID)
	p.mu.Lock()
	needsHydrate := !p.hydrated[k]
	p.lastUsed[k] = time.Now()
	p.scopes[k] = sc
	if needsHydrate {
		p.hydrated[k] = true // set eagerly so a concurrent second call doesn't double-hydrate
	}
	p.mu.Unlock()

	ex, err := p.inner.Get(ctx, 
```

### Core Architecture Module: `internal/setup/handlers_billing_hooks.go`
```
package setup

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/fastclaw-ai/fastclaw/internal/store"
)

// Billing hooks: the primitives an external billing system — e.g. a
// hosted FastClaw Cloud built on top of the open-source runtime — needs to
// charge for usage, without FastClaw itself knowing about prices, balances
// or payments. All routes are platform-admin only (super_admin session or
// an admin API key):
//
//	GET  /api/admin/usage/events?after=<id>&limit=<n>  incremental usage export
//	GET  /api/admin/users/{id}/billing-hold            read an account's hold
//	PUT  /api/admin/users/{id}/billing-hold            hold / release an account
//	POST /api/admin/users/{id}/login-link              one-time console sign-in link
//
// plus the public GET /auth/login-link that redeems a link.

const (
	defaultLoginLinkTTL = 5 * time.Minute
	maxLoginLinkTTL     = 30 * time.Minute
)

// handleUsageEvents exports model-call usage after a cursor. A billing
// system polls it, prices each event, debits the paying account
// (account_id) and stores next_after as its cursor. Events become visible
// a few seconds after the call, so polling never skips one.
func (s *Server) handleUsageEvents(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	after, err := strconv.ParseInt(strings.TrimSpace(q.Get("after")), 10, 64)
	if q.Get("after") != "" && (err != nil || after < 0) {
		jsonResponse(w, http.StatusBadRequest, map[string]any{"error": "after must be a non-negative integer"})
		return
	}
	limit := 500
	if v := q.Get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 || n > 1000 {
			jsonResponse(w, http.StatusBadRequest, map[string]any{"error": "limit must be 1-1000"})
			return
		}
		limit = n
	}
	events, err := s.dataStore.ListUsageEvents(r.Context(), after, limit)
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	if events == nil {
		events = []store.UsageEvent{}
	}
	next := after
	if len(events) > 0 {
		next = events[len(events)-1].ID
	}
	jsonResponse(w, http.StatusOK, map[string]any{
		"events":     events,
		"next_after": next,
		"has_more":   len(events) == limit,
	})
}

func (s *Server) handleGetBillingHold(w http.ResponseWriter, r *http.Request) {
	hold, reason, err := s.dataStore.GetBillingHold(r.Context(), r.PathValue("id"))
	if err != nil {
		writeStoreError(w, err)
		return
	}
	jsonResponse(w, http.StatusOK, map[string]any{"hold": hold, "reason": reason})
}

// handleSetBillingHold holds or releases an account. While held, its
// agents refuse new turns on every channel and /v1 chat returns
// 402 payment_required. Body: {"hold": true, "reason": "balance exhausted"}.
func (s *Server) handleSetBillingHold(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Hold   *bool  `json:"hold"`
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || req.Hold == nil {
		jsonResponse(w, http.StatusBadRequest, map[string]any{"error": `body must be {"hold": true|false, "reason": "..."}`})
		return
	}
	id := r.PathValue("id")
	if err := s.dataStore.SetBillingHold(r.Context(), id, *req.Hold, strings.TrimSpace(req.Reason)); err != nil {
		writeStoreError(w, err)
		return
	}
	hold, reason, _ := s.dataStore.GetBillingHold(r.Context(), id)
	jsonResponse(w, http.StatusOK, map[string]any{"hold": hold, "reason": reason})
}

// handleCreateLoginLink mints a single-use link that signs the browser
// into the console as the account — how a billing site sends its users
// to FastClaw without a second password. Body (optional):
// {"redirect": "/console/", "ttl_seconds": 300}.
func (s *Server) handleCreateLoginLink(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Redirect   string `json:"redirect"`
		TTLSeconds int    `json:"ttl_seconds"`
	}
	if r.ContentLength != 0 {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			jsonResponse(w, http.StatusBadRequest, map[string]any{"error": "invalid body"})
			return
		}
	}
	id := r.PathValue("id")
	u, err := s.dataStore.GetUser(r.Context(), id)
	if err != nil || u == nil {
		writeStoreError(w, store.ErrNotFound)
		return
	}
	if u.Role != "user" && u.Role != "super_admin" {
		jsonResponse(w, http.StatusBadRequest, map[string]any{"error": "only console accounts can sign in"})
		return
	}
	redirect := safeRedirect(req.Redirect)
	ttl := defaultLoginLinkTTL
	if req.TTLSeconds > 0 {
		ttl = time.Duration(req.TTLSeconds) * time.Second
		if ttl > maxLoginLinkTTL {
			ttl = maxLoginLinkTTL
		}
	}
	var buf [32]byte
	if _, err := rand.Read(buf[:]); err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	token := hex.EncodeToString(buf[:])
	expires := time.Now().UTC().Add(ttl)
	if err := s.dataStore.CreateLoginToken(r.Context(), hashLoginToken(token), id, expires); err != nil {
		jsonResponse(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}
	link := requestOrigin(r) + "/auth/login-link?" + url.Values{"token": {token}, "redirect": {redirect}}.Encode()
	jsonResponse(w, http.StatusOK, map[string]any{"url": link, "expires_at": expires})
}

// handleRedeemLoginLink signs the browser in with a login-link token and
// sends it on. Single use; an invalid or expired token lands on the
// sign-in page.
func (s *Server) handleRedeemLoginLink(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	redirect := safeRedirect(r.URL.Query().Get("redirect"))
	if token == "" || s.authResolver == nil {
		http.Redirect(w, r, "/", http.StatusFound)
		return
	}
	uid, err := s.dataStore.ConsumeLoginToken(r.Context(), hashLoginToken(token))
	if err != nil {
		http.Redirect(w, r, "/", http.StatusFound)
		return
	}
	cookie, err := s.authResolver.IssueSession(r.Context(), uid)
	if err != nil {
		http.Redirect(w, r, "/", http.StatusFound)
		return
	}
	http.SetCookie(w, cookie)
	w.Header().Set("Cache-Control", "no-store")
	http.Redirect(w, r, redirect, http.StatusFound)
}

func hashLoginToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// safeRedirect keeps a post-login redirect on this site: a path, never a
// URL or protocol-relative "//host".
func safeRedirect(p string) string {
	p = strings.TrimSpace(p)
	if p == "" || !strings.HasPrefix(p, "/") || strings.HasPrefix(p, "//") || strings.Contains(p, "\\") {
		return "/"
	}
	return p
}

// requestOrigin is the externally visible origin of a request, honoring
// the usual reverse-proxy headers.
func requestOrigin(r *http.Request) string {
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	if p := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-Proto"), ",")[0]); p == "http" || p == "https" {
		scheme = p
	}
	host := r.Host
	if h := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-Host"), ",")[0]); h != "" {
		host = h
	}
	return scheme + "://" + host
}

func writeStoreError(w http.ResponseWriter, err error) {
	if errors.Is(err, store.ErrNotFound) {
		jsonResponse(w, http.StatusNotFound, map[string]any{"error": "not found"})
		return
	}
	jsonResponse(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
}

```

### Core Architecture Module: `internal/taskqueue/queue.go`
```
package taskqueue

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/fastclaw-ai/fastclaw/internal/bus"
)

// TaskStatus represents the current state of a task.
type TaskStatus string

const (
	TaskPending TaskStatus = "pending"
	TaskRunning TaskStatus = "running"
	TaskDone    TaskStatus = "done"
	TaskFailed  TaskStatus = "failed"
)

// Task represents a unit of work to be processed.
type Task struct {
	ID          string
	AgentID     string
	OwnerUserID string // owner of the agent (for user-space lookup)
	ChatKey     string // channel:chatID — serialization key
	Message     bus.InboundMessage
	AccountID   string
	Status      TaskStatus
	CreatedAt   time.Time
	StartedAt   *time.Time
	DoneAt      *time.Time
	Result      string
	Error       error
}

// TaskHandler processes a task and returns a result or error.
type TaskHandler func(ctx context.Context, task *Task) (string, error)

// chatQueue is a per-chat FIFO queue with its own processing goroutine.
type chatQueue struct {
	ch       chan *Task
	lastUsed time.Time
}

// Queue manages task submission, per-chat serialization, and global concurrency.
type Queue struct {
	maxConcurrent int
	taskTimeout   time.Duration
	idleTimeout   time.Duration

	mu        sync.Mutex
	tasks     map[string]*Task      // taskID -> Task
	chatQueues map[string]*chatQueue // chatKey -> chatQueue
	sem       chan struct{}          // counting semaphore for global concurrency
	handler   TaskHandler
	seq       uint64 // task ID sequence
	ctx       context.Context
	cancel    context.CancelFunc
}

// NewQueue creates a new task queue.
func NewQueue(maxConcurrent int, taskTimeout time.Duration, handler TaskHandler) *Queue {
	if maxConcurrent <= 0 {
		maxConcurrent = 10
	}
	if taskTimeout <= 0 {
		taskTimeout = 5 * time.Minute
	}

	ctx, cancel := context.WithCancel(context.Background())

	q := &Queue{
		maxConcurrent: maxConcurrent,
		taskTimeout:   taskTimeout,
		idleTimeout:   5 * time.Minute,
		tasks:         make(map[string]*Task),
		chatQueues:    make(map[string]*chatQueue),
		sem:           make(chan struct{}, maxConcurrent),
		handler:       handler,
		ctx:           ctx,
		cancel:        cancel,
	}

	// Start idle cleanup goroutine
	go q.cleanupIdleQueues()

	return q
}

// Submit adds a task to the queue for processing.
func (q *Queue) Submit(agentID, chatKey string, msg bus.InboundMessage, accountID string) string {
	q.mu.Lock()

	q.seq++
	taskID := fmt.Sprintf("task-%d-%d", time.Now().UnixMilli(), q.seq)

	task := &Task{
		ID:          taskID,
		AgentID:     agentID,
		OwnerUserID: msg.OwnerUserID,
		ChatKey:     chatKey,
		Message:     msg,
		AccountID:   accountID,
		Status:      TaskPending,
		CreatedAt:   time.Now(),
	}
	q.tasks[taskID] = task

	cq, ok := q.chatQueues[chatKey]
	if !ok {
		cq = &chatQueue{
			ch:       make(chan *Task, 100),
			lastUsed: time.Now(),
		}
		q.chatQueues[chatKey] = cq
		// Start a processing goroutine for this chat
		go q.processChatQueue(chatKey, cq)
	}
	cq.lastUsed = time.Now()

	pendingCount := len(cq.ch)
	q.mu.Unlock()

	slog.Info("task submitted",
		"task_id", taskID,
		"chat_key", chatKey,
		"agent_id", agentID,
		"queue_depth", pendingCount+1,
	)

	if pendingCount > 100 {
		slog.Warn("queue depth high", "chat_key", chatKey, "depth", pendingCount+1)
	}

	cq.ch <- task
	return taskID
}

// processChatQueue drains tasks for a single chat, running them serially.
func (q *Queue) processChatQueue(chatKey string, cq *chatQueue) {
	for {
		select {
		case <-q.ctx.Done():
			return
		case task, ok := <-cq.ch:
			if !ok {
				return
			}
			q.executeTask(task)

			q.mu.Lock()
			cq.lastUsed = time.Now()
			q.mu.Unlock()
		}
	}
}

// executeTask runs a single task with concurrency control and timeout.
func (q *Queue) executeTask(task *Task) {
	// Acquire global semaphore
	select {
	case q.sem <- struct{}{}:
	case <-q.ctx.Done():
		return
	}
	defer func() { <-q.sem }()

	// Mark running
	now := time.Now()
	q.mu.Lock()
	task.Status = TaskRunning
	task.StartedAt = &now
	concurrent := len(q.sem)
	q.mu.Unlock()

	slog.Info("task started",
		"task_id", task.ID,
		"agent_id", task.AgentID,
		"chat_key", task.ChatKey,
		"concurrent_count", concurrent,
	)

	// Create timeout context
	ctx, cancel := context.WithTimeout(q.ctx, q.taskTimeout)
	defer cancel()

	result, err := q.handler(ctx, task)

	doneAt := time.Now()
	duration := doneAt.Sub(*task.StartedAt)

	q.mu.Lock()
	task.DoneAt = &doneAt
	task.Result = result
	task.Error = err
	if err != nil {
		task.Status = TaskFailed
	} else {
		task.Status = TaskDone
	}
	q.mu.Unlock()

	if err != nil {
		slog.Error("task failed",
			"task_id", task.ID,
			"agent_id", task.AgentID,
			"chat_key", task.ChatKey,
			"duration_ms", duration.Milliseconds(),
			"error", err,
		)
	} else {
		slog.Info("task completed",
			"task_id", task.ID,
			"agent_id", task.AgentID,
			"chat_key", task.ChatKey,
			"duration_ms", duration.Milliseconds(),
		)
	}
}

// cleanupIdleQueues removes chat queues that have been idle too long.
func (q *Queue) cleanupIdleQueues() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-q.ctx.Done():
			return
		case <-ticker.C:
			q.mu.Lock()
			now := time.Now()
			for key, cq := range q.chatQueues {
				if now.Sub(cq.lastUsed) > q.idleTimeout && len(cq.ch) == 0 {
					close(cq.ch)
					delete(q.chatQueues, key)
					slog.Debug("idle chat queue removed", "chat_key", key)
				}
			}
			q.mu.Unlock()
		}
	}
}

// RecentTasks returns recent tasks for observability, newest first.
func (q *Queue) RecentTasks(limit int) []*Task {
	q.mu.Lock()
	defer q.mu.Unlock()

	all := make([]*Task, 0, len(q.tasks))
	for _, t := range q.tasks {
		all = append(all, t)
	}

	// Sort newest first
	for i := 0; i < len(all); i++ {
		for j := i + 1; j < len(all); j++ {
			if all[j].CreatedAt.After(all[i].CreatedAt) {
				all[i], all[j] = all[j], all[i]
			}
		}
	}

	if limit > 0 && len(all) > limit {
		all = all[:limit]
	}

	// Prune old completed tasks (keep last 200)
	if len(q.tasks) > 200 {
		go q.pruneOldTasks()
	}

	return all
}

// pruneOldTasks removes completed tasks beyond the retention limit.
func (q *Queue) pruneOldTasks() {
	q.mu.Lock()
	defer q.mu.Unlock()

	if len(q.tasks) <= 200 {
		return
	}

	// Collect completed tasks sorted by creation time
	type entry struct {
		id        string
		createdAt time.Time
	}
	var completed []entry
	for id, t := range q.tasks {
		if t.Status == TaskDone || t.Status == TaskFailed {
			completed = append(completed, entry{id, t.CreatedAt})
		}
	}

	// Sort oldest first
	for i := 0; i < len(completed); i++ {
		for j := i + 1; j < len(completed); j++ {
			if completed[j].createdAt.Before(completed[i].createdAt) {
				completed[i], completed[j] = completed[j], completed[i]
			}
		}
	}

	// Remove oldest completed tasks to get below 200
	toRemove := len(q.tasks) - 200
	for i := 0; i < toRemove && i < len(completed); i++ {
		delete(q.tasks, completed[i].id)
	}
}

// Stop shuts down the queue.
func (q *Queue) Stop() {
	q.cancel()
}

```

### Core Architecture Module: `internal/tui/render.go`
```
package tui

import (
	"fmt"
	"strings"
	"time"

	"github.com/muesli/reflow/wordwrap"
)

const (
	chatIndent             = ""
	chatContinuationIndent = "  "
)

// blockKind discriminates displayBlock rendering.
type blockKind int

const (
	blockUser blockKind = iota
	blockAssistant
	blockTool
	blockSystem
	blockError
	blockCompletion
)

// toolState tracks one tool call's lifecycle inside a turn.
type toolState struct {
	ID      string
	Name    string
	Done    bool
	IsError bool
	Summary string
	Started time.Time
}

// displayBlock is one visual unit in the conversation transcript.
type displayBlock struct {
	Kind    blockKind
	Content string
	Tools   []*toolState
}

func renderUserBlock(content string, width int) string {
	var b strings.Builder
	b.WriteString(styleDim.Render(chatIndent+strings.Repeat("─", max(min(width-2, 60), 1))) + "\n")
	b.WriteString(chatIndent + styleUserPrompt.Render("•") + " ")

	if len(content) > 4000 {
		lines := strings.Count(content, "\n")
		content = content[:2000] + fmt.Sprintf("\n… +%d lines …", lines)
	}
	wrapped := wordwrap.String(content, max(width-4, 20))
	for idx, line := range strings.Split(wrapped, "\n") {
		if idx == 0 {
			b.WriteString(line + "\n")
		} else {
			b.WriteString(chatContinuationIndent + line + "\n")
		}
	}
	return b.String()
}

func renderAssistantBlock(content string, width int) string {
	if content == "" {
		return ""
	}
	var b strings.Builder
	for _, line := range strings.Split(RenderMarkdown(content, width-2), "\n") {
		b.WriteString(chatIndent + line + "\n")
	}
	return b.String()
}

func renderSystemBlock(content string, isErr bool) string {
	style := styleSystem
	prefix := ""
	if isErr {
		style = styleError
		prefix = "✗ "
	}
	var b strings.Builder
	for _, line := range strings.Split(content, "\n") {
		b.WriteString(chatIndent + style.Render(prefix+line) + "\n")
		prefix = "  "
	}
	return b.String()
}

// renderCompletionBlock gives the turn boundary a blank row above it. The
// composer's vertically-centred first row supplies the matching row below,
// avoiding two consecutive blank rows between the status and input text.
func renderCompletionBlock(content string) string {
	return "\n" + renderSystemBlock(content, false)
}

func renderToolBlock(tools []*toolState, spinnerView string) string {
	var b strings.Builder
	for _, t := range tools {
		switch {
		case !t.Done:
			b.WriteString(fmt.Sprintf("%s%s %s %s\n", chatIndent,
				spinnerView,
				styleToolName.Render(t.Name),
				styleDim.Render(fmt.Sprintf("(%s)", formatDuration(time.Since(t.Started))))))
		case t.IsError:
			b.WriteString(fmt.Sprintf("%s%s %s", chatIndent,
				styleError.Render("✗"), styleToolName.Render(t.Name)))
			if t.Summary != "" {
				b.WriteString(" " + styleMuted.Render(t.Summary))
			}
			b.WriteString("\n")
		default:
			b.WriteString(fmt.Sprintf("%s%s %s", chatIndent,
				styleSuccess.Render("✓"), styleToolName.Render(t.Name)))
			if t.Summary != "" {
				b.WriteString(" " + styleMuted.Render(t.Summary))
			}
			b.WriteString("\n")
		}
	}
	return b.String()
}

// toolResultSummary compresses a tool result into one dim line.
func toolResultSummary(result string) string {
	result = strings.Join(strings.Fields(result), " ")
	const maxLen = 96
	if len(result) > maxLen {
		return result[:maxLen-1] + "…"
	}
	return result
}

func formatDuration(d time.Duration) string {
	switch {
	case d < time.Second:
		return "0s"
	case d < time.Minute:
		return fmt.Sprintf("%ds", int(d.Seconds()))
	case d < time.Hour:
		return fmt.Sprintf("%dm%ds", int(d.Minutes()), int(d.Seconds())%60)
	default:
		return fmt.Sprintf("%dh%dm", int(d.Hours()), int(d.Minutes())%60)
	}
}

func formatRelativeTime(ts int64) string {
	if ts <= 0 {
		return ""
	}
	d := time.Since(time.UnixMilli(ts))
	switch {
	case d < time.Minute:
		return "just now"
	case d < time.Hour:
		return fmt.Sprintf("%dm ago", int(d.Minutes()))
	case d < 24*time.Hour:
		return fmt.Sprintf("%dh ago", int(d.Hours()))
	default:
		return fmt.Sprintf("%dd ago", int(d.Hours()/24))
	}
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #124** (2026-10-05): **docs(sandbox): cross-pod E2B lease registry — stop duplicate sandbox creation across pods**
  *Symptoms*: ## Problem  The sandbox pool is per gateway process. With N gateway replicas behind a round-robin service, one `(agent, project, session)` can be served by every pod in turn, and each pod lazily creates its **own** e2b instance for the same scope — observed: 10 pods → 10 e2b instances for one session.  ## Design (`docs/sandbox-pool-leases.md`)  Share the scope→sandbox mapping in Postgres. Each row is a **lease**:  ``` scope_key   PK — "agent[:p:proj][:s:sess]" owner       pod identity ("hostname:pid") sandbox_id  e2b instance id envd_token  short-lived e2b token (shared so other pods can adopt) state       "running" | "paused" (advisory) expires_at  unix seconds; expired = dead, next acquirer may replace epoch       fencing version (monotonic within one lease cycle) ```  The contract is one invariant written as three **separately falsifiable** clauses, each mapped to the mechanism that enforces it, the accepted window, and the tests that guard it:  | # | Clause | Violated when | |---|---|---| | **U** · unique | at most one live sandbox serves a scope | a second live instance exists for that scope | | **A** · available | a scope is servable without a rebuild per call | the row names a dead instance, or none can be produced | | **I** · isomorphic | the row names the instance the executor actually holds | in-memory identity != `sandbox_id` |  Every path through the pool is one of five operations — create, adopt, rebuild, release, expiry — so each clause is checkable operation by
  **Post-Mortem & Fix Analysis**:
  > 后面尝试推送一个版本的代码，但是我这边没有集成测试环境

- **Issue #115** (2026-08-28): **fix: fall back to execCommand for clipboard on insecure origins**
  *Symptoms*: ## Problem  When the dashboard is reached over plain `http://` (LAN deployments behind a gateway, default self-hosted setups that are not localhost), **every copy button silently does nothing**: chat message copy, agent link copy, API key token copy, and the upgrade-command copy on the About page.  ## Root cause  The browser only exposes `navigator.clipboard` in secure contexts. Over plain HTTP it is `undefined`, and all six call sites used `navigator.clipboard.writeText` directly with no fallback, so the click either threw (swallowed by catch blocks) or crashed the handler.  ## Fix  Add `web/src/lib/clipboard.ts` exporting `copyText()`:  - uses the async Clipboard API when `navigator.clipboard` exists and the context is secure; - otherwise falls back to a hidden `<textarea>` + `document.execCommand('copy')`; - returns a boolean so callers only flash the "copied" state on success.  Route all six call sites through it (`chat/page.tsx`, `chat-screen.tsx`, `agents/page.tsx`, `agent-profile-panel.tsx`, `apikeys/page.tsx`, `settings/about/page.tsx`).  ## Verification  - `npx tsc --noEmit` passes. - Manual: dashboard over plain HTTP — chat message, agent link, token, and upgrade-command copy buttons now work; behavior over HTTPS/localhost is unchanged.

- **Issue #114** (2026-08-28): **fix: maintain Mcp-Session-Id across MCP HTTP requests**
  *Symptoms*: ## Problem  MCP servers that enforce sessions (several Streamable HTTP implementations) accept FastClaw's `initialize` but then reject every follow-up request:  ``` HTTP 400: Missing mcp-session-id header. Send an initialize request first. ```  The server ends up skipped and its tools are unavailable.  ## Root cause  `internal/mcp/http.go` never stores the `Mcp-Session-Id` response header returned by `initialize`, and never sends it back on subsequent requests.  ## Fix  - Capture `Mcp-Session-Id` from the response headers (first non-empty value wins, guarded by the existing mutex). - Replay it as a request header on every subsequent `sendRequest`.  ## Verification  Against a session-requiring MCP server: `tools/list` went from HTTP 400 to a normal tool list. `go build`/`go vet` on `internal/mcp` pass.  Supersedes part of the Streamable HTTP compatibility work in #113 (the two changes are independent; this PR branches off `dev` directly).

- **Issue #113** (2026-08-28): **fix: handle SSE responses and send Accept header in MCP HTTP client**
  *Symptoms*: ## Problem  Connecting FastClaw to MCP servers that use Streamable HTTP with SSE responses fails with:  - `parse response: invalid character 'e' looking for beginning of value`, or - `HTTP 406 Not Acceptable` from stricter servers.  Affected servers include any implementation that answers JSON-RPC over SSE frames.  ## Root cause  `internal/mcp/http.go` `sendRequest`:  1. It never sends `Accept: application/json, text/event-stream`, which the [Streamable HTTP transport spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) requires clients to send — some servers reject the request with 406. 2. It unmarshals the response body as bare JSON, but the spec allows the server to return the JSON-RPC response as SSE frames (`event: message\ndata: {json}\n\n`). The leading `e` of `event:` breaks `json.Unmarshal`.  ## Fix  - Send the required `Accept` header. - When the response `Content-Type` is `text/event-stream`, extract the JSON-RPC payload from the last non-empty `data:` line (`extractSSEData`) before unmarshalling; plain-JSON responses keep the existing path and error text.  ## Verification  Against an SSE-responding MCP server (e.g. dbhub): connection went from failing at `initialize`/`tools/list` to a working tool list. `go build`/`go vet` on `internal/mcp` pass.  Fixes #117

- **Issue #112** (2026-08-28): **fix: accept SSE data lines without a space after the colon**
  *Symptoms*: ## Problem  When FastClaw is pointed at OpenAI/Anthropic-compatible streaming endpoints through an LLM gateway (DeepSeek, GLM, etc.), model replies are silently lost and the agent reports `model returned an empty response`.  ## Root cause  The SSE spec ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events#event_stream_format)) makes the single space after the `data:` field name **optional**. Many gateways emit `data:{...}` with no space, and all four stream parsers required the literal prefix `data: `, so every chunk was skipped and the assembled content ended up empty.  Affected parsers: - `internal/provider/openai.go` — `ChatStream` and `parseSSE` - `internal/provider/anthropic.go` — streaming loop and `parseSSE`  ## Fix  Accept `data:` with or without the trailing space in all four places and `TrimSpace` the payload:  ```go if !strings.HasPrefix(line, "data:") { 	continue } data := strings.TrimSpace(strings.TrimPrefix(line, "data:")) ```  ## Verification  - `curl -N` against the gateway confirmed it sends `data:{...}` without a space; chat responses are complete after the patch. - `go build ./internal/provider/` and `go test ./internal/provider/` pass.  Fixes #116

- **Issue #109** (2026-07-27): **Feat/wire spawn subagent**
  *Symptoms*: ### 改造目标和结果  FastClaw Web 原先虽然使用 `/api/chat/stream`，但 `HandleWebChatStream` 最终调用非流式 `HandleMessage`：工具进度走 SSE，DeepSeek 正文则在后端完整缓冲后一次性显示。本次已改成真正的 token streaming：  ```text DeepSeek SSE token → Provider StreamReader → 共享 Agent runTurn → ChatEvent content_delta → /api/chat/stream → Web 同一回答气泡持续增长 ```  流式与非流式入口现在复用同一套 ReAct Turn 内核；每个 ReAct round 只发起一次模型请求，不再存在最终轮先 `Chat`、再 `ChatStream` 重复生成的问题。  ### 后端核心改动  关键文件：  ```text fastclaw/internal/agent/loop.go fastclaw/internal/agent/events.go /fastclaw/internal/provider/provider.go /fastclaw/internal/provider/openai.go /fastclaw/internal/provider/anthropic.go /fastclaw/internal/session/manager.go /fastclaw/internal/setup/handlers.go /fastclaw/internal/api/openai.go ```  已完成：  1. `HandleMessage` 委托共享 `runTurn`，统一 session、hooks、PII、工具执行、PostTurn、媒体、错误和清理语义。 2. `runTurn` 每轮只调用一次 `Provider.ChatStream`，实时转发 token，并在流终止时读取完整 `Response` 判断 ToolCall 或最终回答。 3. `StreamReader` 增加同步安全的终态 `Result()` / `Complete()`；OpenAI-compatible 和 Anthropic Provider 的 `Chat`/`ChatStream` 共用同一套 SSE accumulator。 4. 完整保留 ToolCall、Thinking、Anthropic signature 和 `RawAssistant`，确保下一轮能够正确 replay。 5. ChatEvent 升级为 additive v2：新增 `content_delta`，并携带 `turnId`、`messageId`、`round`、`seq`。 6. 为兼容旧客户端，每轮仍双发一个 legacy `content` 完整快照；旧客户端忽略 delta，新客户端以快照校正内容。 7. `tool_call`/`tool_result` 使用相同 message/round 关联，工具结果继续严格按 ToolCall ID 配对。 8. 正常最终回答在完整 assistant 持久化并执行 session flush 后才发送 `done`。 9. SSE 请求重新继承 `r.Context()`；浏览器关闭连接或点击 Stop 会取消 P

- **Issue #104** (2026-07-21): **fix: before_model_call hook messages modification not taking effect (#103)**
  *Symptoms*: ## Problem  The `before_model_call` hook is designed to allow plugins to modify messages before sending to the LLM (e.g., mem0 injecting long-term memory). However, the modified messages were written to `hc.Messages` but never read back by the agent loop.  This caused plugins like mem0 (in `plugins/mem0/`) to silently fail—their modified messages were discarded and never sent to the LLM.  ## Changes  Added `messages = hcBefore.Messages` after `a.hooks.Run(ctx, hcBefore)` in: - `HandleMessage` (line ~2055) - `HandleMessageStream` (line ~2735)  ## Impact  - mem0 plugin now works correctly - No breaking changes to existing hooks  Fixes #103 

- **Issue #103** (2026-07-21): **Bug: before_model_call hook messages modification not taking effect**
  *Symptoms*: **Bug: `before_model_call` hook messages modification not taking effect**  The `before_model_call` hook is designed to allow plugins to modify messages before sending to the LLM (e.g., mem0 injecting long-term memory). However, the modified messages are written to `hc.Messages` but never read back by the agent loop.  **Code location**  `internal/agent/loop.go` around line 456-457 (`HandleMessage`) and similar in `HandleMessageStream`  **Current behavior**  ```go hcBefore := &HookContext{..., Messages: messages} a.hooks.Run(ctx, hcBefore)  // plugin modifies hc.Messages // BUG: messages variable NOT updated llmMessages := messages     // still uses original messages ```  **Expected behavior**  After `hooks.Run`, the `messages` variable should be updated from `hc.Messages` so that subsequent PII scrub and LLM call use the modified messages.  **Impact**  - mem0 plugin (shown in `plugins/mem0/`) does not actually inject memory into the request - Any sync `before_model_call` hook that modifies messages is silently ignored  **Proposed fix**  Add `messages = hcBefore.Messages` after `a.hooks.Run(ctx, hcBefore)` in both `HandleMessage` and `HandleMessageStream`.  **Checklist**  - [x] I have verified this with the mem0 example plugin - [x] I can submit a PR if this is accepted as a bug 

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

### Incident Patch 1: `efe809bf` (2026-10-05)
**Commit Message**: fix(setup): /chat/<sessionId> resolves API end-users' sessions for the agent owner

API sessions live under the end-user, so the owner's lookup missed them and
reloading one (or following an old link) would show "session not found".
The lookup now also matches a session on an agent the caller owns.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `internal/setup/handlers_chat_target.go` (modified, +4/-2)
```diff
@@ -30,8 +30,10 @@ func (s *Server) handleChatTarget(w http.ResponseWriter, r *http.Request) {
 	jsonResponse(w, http.StatusOK, target)
 }
 
-// resolveChatTarget looks the id up among the caller's own sessions:
-//   - a session keyed by the id → that agent's chat (loose or project);
+// resolveChatTarget looks the id up among the caller's sessions:
+//   - a session keyed by the id → that agent's chat (loose or project),
+//     including another user's session on an agent the caller owns (an
+//     API end-user's chat, which the owner opens from the agent panel);
 //   - group member sessions keyed "<id>-agent-<agent>" whose project is one
 //     of the caller's groups → that group's topic;
 //   - a group's default topic (its configured sessionId, or team-<team>), or
```

**File**: `internal/setup/handlers_chat_target_test.go` (modified, +12/-3)
```diff
@@ -25,6 +25,11 @@ func TestResolveChatTarget(t *testing.T) {
 	if err := st.Migrate(ctx); err != nil {
 		t.Fatal(err)
 	}
+	for _, a := range []store.AgentRecord{{ID: "agt_a", UserID: "u_alice"}, {ID: "agt_b", UserID: "u_alice"}, {ID: "agt_x", UserID: "u_bob"}} {
+		if err := st.SaveAgent(ctx, &a); err != nil {
+			t.Fatal(err)
+		}
+	}
 	if err := scope.SaveSetting(ctx, st, "u_alice", "", "teams", map[string]interface{}{
 		"tm-1": map[string]interface{}{"name": "g", "agents": []string{"agt_a", "agt_b"}},
 	}); err != nil {
@@ -37,6 +42,8 @@ func TestResolveChatTarget(t *testing.T) {
 		{"u_alice", "agt_b", "g-3-topic-agent-agt_b", "tm-1"},
 		{"u_alice", "agt_b", "group-inbox-tm-1", ""},
 		{"u_bob", "agt_x", "s-9-bobs", ""},
+		{"u_enduser", "agt_a", "snapok:edit-image:abc", ""}, // API end-user on alice's agent
+		{"u_enduser", "agt_x", "snapok:other", ""},          // end-user on bob's agent
 	} {
 		if err := st.SaveSession(ctx, sess.user, sess.agent, sess.key, &store.SessionRecord{Channel: "web", ChatID: sess.key, ProjectID: sess.project}); err != nil {
 			t.Fatal(err)
@@ -56,9 +63,11 @@ func TestResolveChatTarget(t *testing.T) {
 		{"g-3-topic", chatTarget{Kind: "team", TeamID: "tm-1"}, true},
 		{"group-inbox-tm-1", chatTarget{Kind: "agent", AgentID: "agt_b"}, true},
 		{"team-tm-1", chatTarget{Kind: "team", TeamID: "tm-1"}, true},
-		{"s-9-bobs", chatTarget{}, false},  // another user's session
-		{"g-3", chatTarget{}, false},       // a prefix of a topic id
-		{"g_3-topic", chatTarget{}, false}, // "_" is not a LIKE wildcard
+		{"s-9-bobs", chatTarget{}, false},                                            // another user's session
+		{"snapok:edit-image:abc", chatTarget{Kind: "agent", AgentID: "agt_a"}, true}, // alice owns agt_a
+		{"snapok:other", chatTarget{}, false},                                        // agt_x isn't alice's
+		{"g-3", chatTarget{}, false},                                                 // a prefix of a topic id
+		{"g_3-topic", chatTarget{}, false},                                           // "_" is not a LIKE wildcard
 		{"../etc/passwd", chatTarget{}, false},
 	}
 	for _, c := range cases {
```

**File**: `internal/store/database.go` (modified, +5/-3)
```diff
@@ -2795,9 +2795,11 @@ func (d *DBStore) FindSessionLocations(ctx context.Context, userID, sessionKey s
 	escaped := strings.NewReplacer(`\`, `\\`, "%", `\%`, "_", `\_`).Replace(sessionKey)
 	rows, err := d.db.QueryContext(ctx,
 		fmt.Sprintf(`SELECT agent_id, session_key, project_id FROM sessions
-			WHERE user_id = %s AND (session_key = %s OR session_key LIKE %s ESCAPE '\')
-			ORDER BY updated_at DESC`, d.ph(1), d.ph(2), d.ph(3)),
-		userID, sessionKey, escaped+"-agent-%")
+			WHERE (user_id = %s AND (session_key = %s OR session_key LIKE %s ESCAPE '\'))
+			   OR (session_key = %s AND user_id <> %s AND agent_id IN (SELECT id FROM agents WHERE user_id = %s))
+			ORDER BY (user_id = %s) DESC, updated_at DESC`,
+			d.ph(1), d.ph(2), d.ph(3), d.ph(4), d.ph(5), d.ph(6), d.ph(7)),
+		userID, sessionKey, escaped+"-agent-%", sessionKey, userID, userID, userID)
 	if err != nil {
 		return nil, err
 	}
```

**File**: `internal/store/store.go` (modified, +5/-3)
```diff
@@ -82,9 +82,11 @@ type Store interface {
 	// Used to resolve the correct user_id for cross-user session reads.
 	LookupSessionOwner(ctx context.Context, agentID, sessionKey string) (string, error)
 	// FindSessionLocations finds where a URL session id lives for userID:
-	// sessions whose key is sessionKey, plus group-chat member sessions
-	// keyed "<sessionKey>-agent-<agentID>". Backs /chat/<sessionId>, whose
-	// URL no longer names the agent or group.
+	// their sessions whose key is sessionKey, their group-chat member
+	// sessions keyed "<sessionKey>-agent-<agentID>", and — as the agent's
+	// owner — another user's session on one of their agents (an API
+	// end-user's chat). The caller's own rows come first. Backs
+	// /chat/<sessionId>, whose URL no longer names the agent or group.
 	FindSessionLocations(ctx context.Context, userID, sessionKey string) ([]SessionLocation, error)
 	// HasChatSession reports whether userID has a session with agentID
 	// whose chat_id is chatID — the caller-chosen conversation id (e.g.
```

---

### Incident Patch 2: `72c7b485` (2026-10-05)
**Commit Message**: fix(setup): "open folder" opens the session's folder, not the agent root

Reveal resolved the session only under the caller, so for a session it
couldn't resolve (e.g. the owner viewing an API end-user's chat) it fell
back to the agent root. It now resolves the folder the way the file list
and zip do — caller's own session, else the owner's view of any session —
and returns 404 instead of widening. The unscoped agent root is
owner-only, matching the agent-wide file list.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `internal/setup/handlers_agents.go` (modified, +36/-15)
```diff
@@ -1310,21 +1310,10 @@ func (s *Server) handleAgentWorkspaceReveal(w http.ResponseWriter, r *http.Reque
 		return
 	}
 
-	rawSession := r.URL.Query().Get("sessionId")
-	rawProject := r.URL.Query().Get("projectId")
-
-	// Resolve to the same (project, chatID) the chat-side panel is
-	// scoped to. Empty rawSession + non-empty projectId means project
-	// landing — reveal the project root. Empty both means agent root
-	// (admin browser); we still allow it because requireAgentReadable
-	// has already gated access.
-	chatID := ""
-	projectID := rawProject
-	if rawSession != "" {
-		chatID = s.workspaceSessionScope(r.Context(), id, rawSession)
-		if pid := s.resolveSessionProject(r.Context(), r, id, rawSession); pid != "" {
-			projectID = pid
-		}
+	projectID, chatID, ok := s.revealScope(r, id, r.URL.Query().Get("sessionId"), r.URL.Query().Get("projectId"))
+	if !ok {
+		jsonResponse(w, http.StatusNotFound, map[string]any{"error": "session not found"})
+		return
 	}
 
 	dir, ok := scoper.LocalScopeDir(id, projectID, chatID)
@@ -1348,6 +1337,38 @@ func (s *Server) handleAgentWorkspaceReveal(w http.ResponseWriter, r *http.Reque
 	jsonResponse(w, http.StatusOK, map[string]any{"ok": true, "path": dir})
 }
 
+// revealScope resolves the (project, chat) folder to open, the same way
+// fileScopeForRequest scopes the file list and zip, so "open folder" shows
+// exactly the files the panel lists:
+//   - projectId alone: the project root (project landing page);
+//   - sessionId: that chat's folder — the caller's own session, or for the
+//     agent's owner any session of the agent (e.g. an API end-user's);
+//   - neither: the agent root, for the owner only.
+//
+// A session that doesn't resolve reports !ok rather than widening to the
+// agent root.
+func (s *Server) revealScope(r *http.Request, agentID, rawSession, rawProject string) (projectID, chatID string, ok bool) {
+	if rawSession == "" {
+		if rawProject != "" {
+			return rawProject, "", true
+		}
+		return "", "", s.callerOwnsAgent(r, agentID)
+	}
+	if chatID = s.workspaceSessionScope(r.Context(), agentID, rawSession); chatID != "" {
+		return s.resolveSessionProject(r.Context(), r, agentID, rawSession), chatID, true
+	}
+	if !s.callerOwnsAgent(r, agentID) || s.dataStore == nil {
+		return "", "", false
+	}
+	if chatID = s.foreignSessionChatID(r.Context(), agentID, rawSession); chatID == "" {
+		return "", "", false
+	}
+	if owner, err := s.dataStore.LookupSessionOwner(r.Context(), agentID, rawSession); err == nil {
+		projectID, _ = s.dataStore.LookupSessionProject(r.Context(), owner, agentID, rawSession)
+	}
+	return projectID, chatID, true
+}
+
 // openInFileBrowser shells out to the platform-appropriate "open"
 // command. macOS and Linux behave consistently (open the directory
 // in the default file manager); Windows uses explorer.exe. We
```

**File**: `internal/setup/new_chat_upload_scope_test.go` (modified, +54/-0)
```diff
@@ -55,3 +55,57 @@ func TestNewChatUploadScope(t *testing.T) {
 		}
 	}
 }
+
+// "Open folder" opens exactly the folder the panel lists: the session's
+// own folder (also for the owner looking at an API end-user's session),
+// never the agent root as a fallback, and the agent root only for the
+// owner.
+func TestRevealScope(t *testing.T) {
+	ctx := context.Background()
+	st, err := store.NewDBStore("sqlite", "file:"+filepath.Join(t.TempDir(), "s.db"))
+	if err != nil {
+		t.Fatal(err)
+	}
+	defer st.Close()
+	if err := st.Migrate(ctx); err != nil {
+		t.Fatal(err)
+	}
+	if err := st.SaveAgent(ctx, &store.AgentRecord{ID: "agt_1", UserID: "u_owner", Name: "a", IsPublic: true}); err != nil {
+		t.Fatal(err)
+	}
+	for _, sess := range []struct{ user, key, chat, project string }{
+		{"u_owner", "s-1-own", "s-1-own", ""},
+		{"u_owner", "s-2-proj", "s-2-proj", "p_1"},
+		{"u_enduser", "snapok:edit-image:abc", "edit-image-abc", ""},
+	} {
+		if err := st.SaveSession(ctx, sess.user, "agt_1", sess.key, &store.SessionRecord{Channel: "web", ChatID: sess.chat, ProjectID: sess.project}); err != nil {
+			t.Fatal(err)
+		}
+	}
+	s := &Server{dataStore: st}
+	as := func(uid string) *http.Request {
+		r := httptest.NewRequest(http.MethodPost, "/", nil)
+		return r.WithContext(auth.WithIdentity(r.Context(), auth.Identity{UserID: uid, Role: users.RoleUser, AuthMethod: "session"}))
+	}
+
+	cases := []struct {
+		name, user, session, project string
+		wantProject, wantChat        string
+		wantOK                       bool
+	}{
+		{"own loose session", "u_owner", "s-1-own", "", "", "s-1-own", true},
+		{"own project session", "u_owner", "s-2-proj", "", "p_1", "s-2-proj", true},
+		{"owner opens an end-user's session", "u_owner", "snapok:edit-image:abc", "", "", "edit-image-abc", true},
+		{"project landing", "u_owner", "", "p_1", "p_1", "", true},
+		{"agent root for the owner", "u_owner", "", "", "", "", true},
+		{"agent root for a viewer", "u_viewer", "", "", "", "", false},
+		{"viewer can't open someone else's session", "u_viewer", "snapok:edit-image:abc", "", "", "", false},
+		{"unknown session doesn't widen to the root", "u_owner", "s-9-missing", "", "", "", false},
+	}
+	for _, c := range cases {
+		pid, chat, ok := s.revealScope(as(c.user), "agt_1", c.session, c.project)
+		if ok != c.wantOK || pid != c.wantProject || chat != c.wantChat {
+			t.Errorf("%s: got (%q, %q, %v), want (%q, %q, %v)", c.name, pid, chat, ok, c.wantProject, c.wantChat, c.wantOK)
+		}
+	}
+}
```

---

### Incident Patch 3: `f5af55ee` (2026-10-05)
**Commit Message**: fix(setup): first upload of a new chat lands in that chat's folder

The web client uploads attachments before the chat request creates the
session, so the upload handler couldn't resolve the session and wrote the
files to the agent root: the agent's sandbox (sessions/<chat>/) didn't
see them and the chat's Files view listed nothing.

For an unclaimed web session key (s-<ms>-<rand>, no session of this agent
uses it under any user) the upload now uses the scope the chat request
will create: the key as the chat id, or the caller's own project when
?projectId= names one.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `internal/setup/handlers_agents.go` (modified, +36/-0)
```diff
@@ -13,6 +13,7 @@ import (
 	"os"
 	"os/exec"
 	"path/filepath"
+	"regexp"
 	"runtime"
 	"strings"
 
@@ -974,6 +975,36 @@ func (s *Server) workspaceSessionScope(ctx context.Context, agentID, urlToken st
 	return chatID
 }
 
+// newWebSessionKey matches the session ids the web client mints for a new
+// chat (`s-<unix ms>-<base36>`).
+var newWebSessionKey = regexp.MustCompile(`^s-[0-9]+-[a-z0-9]+$`)
+
+// newChatUploadScope places an upload for a chat that doesn't exist yet,
+// mirroring what the chat request will create: a new web session's chat id
+// is its session key (Agent.recoverWebTriple), and a new chat started in a
+// project lives in that project. Only for unclaimed web session keys — a
+// key some session of this agent already uses (any user's) gets no scope —
+// and only for the caller's own projects.
+func (s *Server) newChatUploadScope(r *http.Request, agentID, sessionKey, projectID string) (sessionID, projectOut string) {
+	if s.dataStore == nil || !newWebSessionKey.MatchString(sessionKey) {
+		return "", ""
+	}
+	if _, err := s.dataStore.LookupSessionOwner(r.Context(), agentID, sessionKey); !errors.Is(err, store.ErrNotFound) {
+		return "", ""
+	}
+	if projectID != "" {
+		ident, ok := auth.FromContext(r.Context())
+		if !ok || ident.EffectiveUserID() == "" {
+			return "", ""
+		}
+		if p, err := s.dataStore.GetProject(r.Context(), ident.EffectiveUserID(), agentID, projectID); err != nil || p == nil {
+			return "", ""
+		}
+		return "", projectID
+	}
+	return sessionKey, ""
+}
+
 // foreignSessionChatID resolves a session_key to its chat_id under the
 // session's own user. Only for callers already verified to own the agent.
 func (s *Server) foreignSessionChatID(ctx context.Context, agentID, sessionKey string) string {
@@ -1460,6 +1491,11 @@ func (s *Server) handleAgentFileUpload(w http.ResponseWriter, r *http.Request) {
 	sessionKey := r.URL.Query().Get("sessionId")
 	sessionID := s.workspaceSessionScope(r.Context(), id, sessionKey)
 	projectID := s.resolveSessionProject(r.Context(), r, id, sessionKey)
+	if sessionID == "" && projectID == "" {
+		// The first message of a new chat uploads before the chat request
+		// creates the session; land the files where that chat will look.
+		sessionID, projectID = s.newChatUploadScope(r, id, sessionKey, r.URL.Query().Get("projectId"))
+	}
 	if projectID != "" {
 		// Project sessions don't use the per-chat subdir — clear it so
 		// the workspace store routes to projects/<pid>/.
```

**File**: `internal/setup/new_chat_upload_scope_test.go` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+package setup
+
+import (
+	"context"
+	"net/http"
+	"net/http/httptest"
+	"path/filepath"
+	"testing"
+
+	"github.com/fastclaw-ai/fastclaw/internal/auth"
+	"github.com/fastclaw-ai/fastclaw/internal/store"
+	"github.com/fastclaw-ai/fastclaw/internal/users"
+)
+
+// The first message of a new chat uploads before the chat request creates
+// the session; the upload must land where that chat will look, without
+// letting a caller write into a session someone else already has.
+func TestNewChatUploadScope(t *testing.T) {
+	ctx := context.Background()
+	st, err := store.NewDBStore("sqlite", "file:"+filepath.Join(t.TempDir(), "s.db"))
+	if err != nil {
+		t.Fatal(err)
+	}
+	defer st.Close()
+	if err := st.Migrate(ctx); err != nil {
+		t.Fatal(err)
+	}
+	if err := st.SaveSession(ctx, "u_bob", "agt_1", "s-1700000000000-taken", &store.SessionRecord{Channel: "web", ChatID: "s-1700000000000-taken"}); err != nil {
+		t.Fatal(err)
+	}
+	if err := st.SaveProject(ctx, &store.ProjectRecord{UserID: "u_alice", AgentID: "agt_1", ID: "p_mine", Name: "mine"}); err != nil {
+		t.Fatal(err)
+	}
+	if err := st.SaveProject(ctx, &store.ProjectRecord{UserID: "u_bob", AgentID: "agt_1", ID: "p_bobs", Name: "bob's"}); err != nil {
+		t.Fatal(err)
+	}
+	s := &Server{dataStore: st}
+	alice := httptest.NewRequest(http.MethodPost, "/", nil)
+	alice = alice.WithContext(auth.WithIdentity(alice.Context(), auth.Identity{UserID: "u_alice", Role: users.RoleUser, AuthMethod: "session"}))
+
+	cases := []struct {
+		name, key, project, wantSession, wantProject string
+	}{
+		{"new loose chat", "s-1700000000001-abc123", "", "s-1700000000001-abc123", ""},
+		{"new chat in own project", "s-1700000000001-abc123", "p_mine", "", "p_mine"},
+		{"someone else's project", "s-1700000000001-abc123", "p_bobs", "", ""},
+		{"key already in use", "s-1700000000000-taken", "", "", ""},
+		{"not a web session key", "../../etc", "", "", ""},
+		{"empty key", "", "", "", ""},
+	}
+	for _, c := range cases {
+		sid, pid := s.newChatUploadScope(alice, "agt_1", c.key, c.project)
+		if sid != c.wantSession || pid != c.wantProject {
+			t.Errorf("%s: got (%q, %q), want (%q, %q)", c.name, sid, pid, c.wantSession, c.wantProject)
+		}
+	}
+}
```

---

### Incident Patch 4: `5d552535` (2026-10-05)
**Commit Message**: fix(web): Customize is 自定义 again in Chinese

Matches the page's own heading.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `web/src/components/locale-provider.tsx` (modified, +1/-1)
```diff
@@ -134,7 +134,7 @@ const zhCN: Record<MessageKey, string> = {
   "createBot.failed": "创建 Agent 失败",
   "createBot.missingId": "Agent 已创建，但接口没有返回 ID",
   "settings.tab.profile": "资料",
-  "settings.tab.customize": "个性化",
+  "settings.tab.customize": "自定义",
   "settings.tab.models": "模型",
   "settings.tab.context": "上下文",
   "settings.tab.knowledge": "知识库",
```

---

### Incident Patch 5: `3766a6fb` (2026-10-05)
**Commit Message**: fix(web): workspace panel no longer overflows with the sidebar open

The panel was shrink-0 and capped at 70% of the row, but at xl the chat
column keeps a 520px minimum; with the sidebar open the two no longer
fit and the panel's right side (toolbar, preview) went off-screen. Let
the panel shrink down to its 280px minimum instead.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `web/src/components/chat-screen.tsx` (modified, +8/-4)
```diff
@@ -5369,10 +5369,14 @@ function WorkspacePanel({
         // the viewport. A container-relative cap auto-shrinks the panel when the
         // sidebar expands (the container narrows, 70% narrows with it), so the
         // chat always keeps ≥30% and the page never scrolls horizontally. min()
-        // still bounds it to FILES_PANEL_MAX on very wide screens. overflow-
-        // hidden is the belt-and-suspenders against inner content overflow.
-        style={{ width, maxWidth: `min(${FILES_PANEL_MAX}px, 70%)` }}
-        className={`relative z-30 hidden md:flex shrink-0 flex-col overflow-hidden border-l border-border bg-background -mt-14 h-screen ${
+        // still bounds it to FILES_PANEL_MAX on very wide screens. The panel
+        // still shrinks (down to FILES_PANEL_MIN): at xl the chat column keeps
+        // a 520px minimum, and 70% + 520px is wider than the container once
+        // the sidebar is open, which used to push the panel off-screen.
+        // overflow-hidden is the belt-and-suspenders against inner content
+        // overflow.
+        style={{ width, maxWidth: `min(${FILES_PANEL_MAX}px, 70%)`, minWidth: FILES_PANEL_MIN }}
+        className={`relative z-30 hidden md:flex flex-col overflow-hidden border-l border-border bg-background -mt-14 h-screen ${
           resizing ? "" : "transition-[width] duration-200 ease-out motion-reduce:transition-none"
         }`}
       >
```

---

### Incident Patch 6: `c7d2abaa` (2026-10-05)
**Commit Message**: revert(web): back out chat-screen.tsx from dd137bb

dd137bb swept in uncommitted chat-screen work (the tabbed Agent panel,
message avatars) that depends on files not yet committed, so dev did not
build. Restore the previous version; the Files tab ships with that work.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `web/src/components/chat-screen.tsx` (modified, +285/-448)
```diff
@@ -11,8 +11,8 @@ import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
 import { Input } from "@/components/ui/input";
 import { Textarea } from "@/components/ui/textarea";
 import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
-import { createProject, deleteChatSession, fileUrl, getAgent, getAgentKnowledgeFile, getChangedFiles, getChatHistoryWithCursor, getChatSessions, getChatTodo, getMe, getScopePreview, getScopePreviewLogs, getSessionHistory, listAgentFiles, listProjects, renameChatSession, restoreSessionHistory, revealAgentWorkspace, sendChatStream, steerChat, updateAgent, updateProject, uploadAgentFiles, getSkills, type AgentDetail, type ChatHistoryMessage, type ChatStreamEvent, type KnowledgeSource, type MeResponse, type ProjectEntry, type ScopePreview, type SkillInfo, type TodoItem, type ToolResultMetadata, type WorkspaceFile, type WorkspaceHistoryEntry } from "@/lib/api";
-import { ArrowLeft, ArrowUp, BookOpen, Brain, Check, ChevronDown, ChevronRight, ChevronUp, CircleAlert, CircleCheck, CirclePause, Clock, Code2, Copy, Download, Eye, ExternalLink, File, FileCode, FileText, Film, Folder, FolderOpen, FolderPlus, FolderSearch, Globe2, Image as ImageIcon, Link2, ListChecks, LoaderCircle, LockKeyhole, MoreHorizontal, Music, PanelLeftClose, PanelLeftOpen, PanelRight, Paperclip, Pencil, Plus, Puzzle, Radio, RefreshCw, RotateCcw, Settings, Share2, ShieldCheck, SlidersHorizontal, Sparkles, Square, SquarePen, Terminal, Trash2, Wrench, X } from "lucide-react";
+import { createProject, deleteChatSession, fileUrl, getAgent, getAgentKnowledgeFile, getChangedFiles, getChatHistoryWithCursor, getChatSessions, getChatTodo, getMe, getScopePreview, getScopePreviewLogs, getSessionHistory, listAgentFiles, listProjects, renameChatSession, restoreSessionHistory, revealAgentWorkspace, sendChatStream, steerChat, updateAgent, updateProject, uploadAgentFiles, getSkills, type AgentDetail, type ChatHistoryMessage, type ChatStreamEvent, type KnowledgeSource, type ProjectEntry, type ScopePreview, type SkillInfo, type TodoItem, type ToolResultMetadata, type WorkspaceFile, type WorkspaceHistoryEntry } from "@/lib/api";
+import { ArrowLeft, ArrowUp, BookOpen, Brain, Check, ChevronDown, ChevronRight, ChevronUp, ChevronsRight, CircleAlert, CircleCheck, CirclePause, Clock, Code2, Copy, Download, Eye, ExternalLink, File, FileCode, FileText, Film, Folder, FolderOpen, FolderPlus, FolderSearch, Globe2, Image as ImageIcon, Link2, ListChecks, LoaderCircle, LockKeyhole, MoreHorizontal, Music, PanelLeftClose, PanelLeftOpen, PanelRight, Paperclip, Pencil, Plus, Puzzle, Radio, RefreshCw, RotateCcw, Settings, Share2, ShieldCheck, SlidersHorizontal, Sparkles, Square, SquarePen, Terminal, Trash2, Wrench, X } from "lucide-react";
 import Link from "next/link";
 import { ChatMarkdown } from "@/components/chat-markdown";
 import type { AgentSettingsTab } from "@/components/agent-settings-dialog";
@@ -107,7 +107,7 @@ function renderContentWithDataImages(
 
 import { usePageHeader } from "@/components/sidebar";
 import { useSidebarOptional } from "@/components/ui/sidebar";
-import { ChannelIcon, channelLabel, hasChannelIcon } from "@/components/channel-icon";
+import { ChannelIcon, channelLabel } from "@/components/channel-icon";
 import { BotAvatar } from "@/components/bot-avatar";
 import { useLocale, type Locale, type MessageKey } from "@/components/locale-provider";
 
@@ -693,11 +693,6 @@ export function ChatScreen() {
   const selectedAgent = useAgentIdFromURL();
   const [agentName, setAgentName] = useState<string>("");
   const [agentDetail, setAgentDetail] = useState<AgentDetail | null>(null);
-  // Signed-in user, for the avatar beside their own bubbles.
-  const [me, setMe] = useState<MeResponse | null>(null);
-  useEffect(() => {
-    getMe().then(setMe).catch(() => {});
-  }, []);
   const [projects, setProjects] = useState<ProjectEntry[]>([]);
   const [sessionId, setSessionId] = useState<string>(
     () => routeSessionId || generateSessionId(),
@@ -740,8 +735,6 @@ export function ChatScreen() {
   const [filesSheetOpen, setFilesSheetOpen] = useState(false);
   const [botPanelOpen, setBotPanelOpen] = useState(false);
   const [workspaceReturnsToBotPanel, setWorkspaceReturnsToBotPanel] = useState(false);
-  // File picked in the Agent panel's Files tab; the workspace opens on it.
-  const [workspaceInitialFile, setWorkspaceInitialFile] = useState<ProducedFile | null>(null);
   const [knowledgePreview, setKnowledgePreview] = useState<KnowledgeSource | null>(null);
   // The compact workspace is only a file navigator, so it can coexist with
   // the platform sidebar. Collapse that sidebar only while a file/app preview
@@ -773,8 +766,7 @@ export function ChatScreen() {
     setBotPanelOpen(false);
     setFilesSheetOpen(true);
   }, []);
-  const openWorkspaceFromBotPanel = useCallback((file?: ProducedFile) => {
-    setWorkspaceInitialFile(file ?? null);
+  const openWorkspaceFromBotPa
```

---

### Incident Patch 7: `35917ec3` (2026-10-05)
**Commit Message**: feat(web): chat sidebar search opens a quick switcher

Search and create move to the right of the Chat title. Search (or Cmd/Ctrl+K)
opens a dialog that filters group chats and Agents; arrow keys + Enter or
Cmd/Ctrl+1-9 open one.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `web/src/components/chat-search-dialog.tsx` (added, +165/-0)
```diff
@@ -0,0 +1,165 @@
+"use client";
+
+import * as React from "react";
+import { Search } from "lucide-react";
+import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
+import { BotAvatar } from "@/components/bot-avatar";
+import { TeamAvatarStack } from "@/components/team-avatar-stack";
+import { useLocale } from "@/components/locale-provider";
+import { cn } from "@/lib/utils";
+import type { ConsumerAgentItem, ConsumerTeamItem } from "@/components/consumer-chat-sidebar";
+
+type Entry =
+  | { kind: "team"; team: ConsumerTeamItem; members: ConsumerAgentItem[]; label: string }
+  | { kind: "agent"; agent: ConsumerAgentItem };
+
+const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
+
+// ChatSearchDialog is the chat sidebar's quick switcher: type to filter
+// group chats and Agents, ↑/↓ + Enter or ⌘1–9 to open one.
+export function ChatSearchDialog({
+  open,
+  onOpenChange,
+  agents,
+  teams,
+  unreadAgentIds,
+  onPickAgent,
+  onPickTeam,
+}: {
+  open: boolean;
+  onOpenChange: (open: boolean) => void;
+  agents: ConsumerAgentItem[];
+  teams: ConsumerTeamItem[];
+  unreadAgentIds: Set<string>;
+  onPickAgent: (agent: ConsumerAgentItem) => void;
+  onPickTeam: (team: ConsumerTeamItem) => void;
+}) {
+  const { t, tr } = useLocale();
+  const [query, setQuery] = React.useState("");
+  const [active, setActive] = React.useState(0);
+  const listRef = React.useRef<HTMLDivElement>(null);
+
+  const entries = React.useMemo<Entry[]>(() => {
+    const q = query.trim().toLocaleLowerCase();
+    const out: Entry[] = [];
+    for (const team of teams) {
+      const members = team.agents
+        .map((id) => agents.find((agent) => agent.id === id))
+        .filter((agent): agent is ConsumerAgentItem => !!agent);
+      const label = members.map((member) => member.name).join("、");
+      if (!q || `${team.name} ${label}`.toLocaleLowerCase().includes(q)) {
+        out.push({ kind: "team", team, members, label });
+      }
+    }
+    for (const agent of agents) {
+      if (!q || `${agent.name} ${agent.description || ""}`.toLocaleLowerCase().includes(q)) {
+        out.push({ kind: "agent", agent });
+      }
+    }
+    return out;
+  }, [agents, query, teams]);
+
+  React.useEffect(() => {
+    if (open) {
+      setQuery("");
+      setActive(0);
+    }
+  }, [open]);
+
+  React.useEffect(() => {
+    listRef.current
+      ?.querySelector(`[data-index="${active}"]`)
+      ?.scrollIntoView({ block: "nearest" });
+  }, [active]);
+
+  const pick = (entry: Entry | undefined) => {
+    if (!entry) return;
+    onOpenChange(false);
+    if (entry.kind === "team") onPickTeam(entry.team);
+    else onPickAgent(entry.agent);
+  };
+
+  const onKeyDown = (event: React.KeyboardEvent) => {
+    if ((event.metaKey || event.ctrlKey) && /^[1-9]$/.test(event.key)) {
+      event.preventDefault();
+      pick(entries[Number(event.key) - 1]);
+      return;
+    }
+    if (event.key === "ArrowDown") {
+      event.preventDefault();
+      setActive((i) => Math.min(i + 1, entries.length - 1));
+    } else if (event.key === "ArrowUp") {
+      event.preventDefault();
+      setActive((i) => Math.max(i - 1, 0));
+    } else if (event.key === "Enter" && !event.nativeEvent.isComposing) {
+      event.preventDefault();
+      pick(entries[active]);
+    }
+  };
+
+  return (
+    <Dialog open={open} onOpenChange={onOpenChange}>
+      <DialogContent
+        showCloseButton={false}
+        className="top-[20%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
+        onKeyDown={onKeyDown}
+      >
+        <DialogTitle className="sr-only">{tr("Search", "搜索")}</DialogTitle>
+        <div className="flex items-center gap-2.5 border-b px-4">
+          <Search className="size-4 shrink-0 text-muted-foreground" />
+          <input
+            autoFocus
+            value={query}
+            onChange={(event) => {
+              setQuery(event.target.value);
+              setActive(0);
+            }}
+            placeholder={tr("Search", "搜索")}
+            aria-label={t("sidebar.searchBots")}
+            className="h-12 w-full bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
+          />
+        </div>
+        <div ref={listRef} className="max-h-[min(60vh,480px)] overflow-y-auto p-2">
+          {entries.length === 0 ? (
+            <p className="px-3 py-8 text-center text-sm text-muted-foreground">{t("sidebar.noMatches")}</p>
+          ) : (
+            entries.map((entry, index) => {
+              const name = entry.kind === "team" ? entry.team.name : entry.agent.name || t("sidebar.untitledBot");
+              const sub = entry.kind === "team" ? entry.label : entry.agent.description;
+              const unread = entry.kind === "agent" && unreadAgentIds.has(entry.agent.id);
+              return (
+                <button
+                  key={entry.kind === "team" ? `team-${entry.team.id}` : entry.agent.id}
+           
```

**File**: `web/src/components/consumer-chat-sidebar.tsx` (modified, +40/-53)
```diff
@@ -2,7 +2,7 @@
 
 import * as React from "react";
 import { useRouter, usePathname } from "next/navigation";
-import { Bot, Check, ChevronDown, ChevronsLeft, ChevronsRight, ImagePlus, Plus, Search, UsersRound } from "lucide-react";
+import { Bot, Check, ChevronDown, ImagePlus, Plus, Search, UsersRound } from "lucide-react";
 import {
   Sidebar,
   SidebarContent,
@@ -12,7 +12,6 @@ import {
   SidebarMenuButton,
   SidebarMenuItem,
   SidebarRail,
-  useSidebar,
 } from "@/components/ui/sidebar";
 import { Button } from "@/components/ui/button";
 import {
@@ -36,6 +35,7 @@ import { BotAvatar } from "@/components/bot-avatar";
 import { TeamAvatarStack } from "@/components/team-avatar-stack";
 import { NavUser } from "@/components/nav-user";
 import { SidebarTitle } from "@/components/sidebar-title";
+import { ChatSearchDialog } from "@/components/chat-search-dialog";
 import { useLocale, type Locale } from "@/components/locale-provider";
 import { apiFetch, createAgent, updateConfig, getTeamInbox, type TeamInboxNotice, type MeResponse, type TeamEntry } from "@/lib/api";
 import { rememberAgentAccess } from "@/lib/agent-access-cache";
@@ -154,35 +154,32 @@ export function ConsumerChatSidebar({
     void refresh();
     return () => { cancelled = true; clearTimeout(timer); };
   }, [me?.user?.id, pathname]);
-  const { state: sidebarState, toggleSidebar } = useSidebar();
   const { locale, t, tr } = useLocale();
-  const [query, setQuery] = React.useState("");
+  const [searchOpen, setSearchOpen] = React.useState(false);
   const [visibleCount, setVisibleCount] = React.useState(AGENT_PAGE_SIZE);
   const [createOpen, setCreateOpen] = React.useState(false);
   const [createTeamOpen, setCreateTeamOpen] = React.useState(false);
 
-  const filtered = React.useMemo(() => {
-    const q = query.trim().toLocaleLowerCase();
-    if (!q) return agents;
-    return agents.filter((agent) =>
-      `${agent.name} ${agent.description || ""} ${agent.preview || ""}`.toLocaleLowerCase().includes(q),
-    );
-  }, [query, agents]);
+  // ⌘K / Ctrl+K opens the search dialog.
+  React.useEffect(() => {
+    const onKey = (event: KeyboardEvent) => {
+      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
+        event.preventDefault();
+        setSearchOpen(true);
+      }
+    };
+    window.addEventListener("keydown", onKey);
+    return () => window.removeEventListener("keydown", onKey);
+  }, []);
+
+  const filtered = agents;
+  const filteredTeams = teams;
   const visibleAgents = React.useMemo(
-    () => filtered.slice(0, visibleCount),
-    [filtered, visibleCount],
+    () => agents.slice(0, visibleCount),
+    [agents, visibleCount],
   );
-  const hasMoreAgents = visibleAgents.length < filtered.length;
-  const filteredTeams = React.useMemo(() => {
-    const q = query.trim().toLocaleLowerCase();
-    if (!q) return teams;
-    return teams.filter((team) => {
-      const memberNames = team.agents
-        .map((id) => agents.find((agent) => agent.id === id)?.name || id)
-        .join(" ");
-      return `${team.name} ${memberNames}`.toLocaleLowerCase().includes(q);
-    });
-  }, [agents, query, teams]);
+  const hasMoreAgents = visibleAgents.length < agents.length;
+  const unreadAgentIds = React.useMemo(() => new Set(inbox.map((notice) => notice.agentId)), [inbox]);
 
   const openAgent = (agent: ConsumerAgentItem) => {
     const base = `/agents/${encodeURIComponent(agent.id)}/chat/`;
@@ -213,46 +210,27 @@ export function ConsumerChatSidebar({
         className="border-r border-black/8 bg-[#f7f7f7] dark:border-white/8 dark:bg-[#171717]"
       >
       {/* Same header box as the Console / Admin sidebars (SidebarHeader's
-          p-2 + SidebarTitle), with the search row below. */}
-      <SidebarHeader className="pb-5 group-data-[collapsible=icon]:pb-2">
+          p-2 + SidebarTitle); search and create sit right of the title. */}
+      <SidebarHeader className="pb-3 group-data-[collapsible=icon]:pb-2">
         <SidebarTitle
           title={tr("Chat", "对话")}
           className="group-data-[collapsible=icon]:justify-center"
         >
           <button
             type="button"
-            onClick={toggleSidebar}
-            className="group/sidebar-toggle relative ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-black/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:ml-0 group-data-[collapsible=icon]:size-10 dark:hover:bg-white/8"
-            aria-label={sidebarState === "collapsed" ? t("sidebar.expandContacts") : t("sidebar.collapseContacts")}
-            title={sidebarState === "collapsed" ? t("sidebar.expandContacts") : t("sidebar.collapseContacts")}
+            onClick={() => setSearchOpen(true)}
+            className="ml-auto inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-black/5 hover:t
```

---

### Incident Patch 8: `b581ff85` (2026-10-05)
**Commit Message**: fix(web): drop the icon from skill cards

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `web/src/components/skills-manager.tsx` (modified, +0/-9)
```diff
@@ -254,9 +254,6 @@ export function SkillsManager({ target }: { target: SkillsTarget }) {
             >
               <div className="flex items-start justify-between mb-3">
                 <div className="flex items-center gap-2.5">
-                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
-                    <Sparkles className="h-4 w-4 text-primary" />
-                  </div>
                   <div>
                     <p className="text-sm font-medium">{skill.name}</p>
                     <Badge variant="outline" className="mt-1 text-[10px]">
@@ -315,9 +312,6 @@ export function SkillsManager({ target }: { target: SkillsTarget }) {
               >
                 <div className="flex items-start justify-between mb-3">
                   <div className="flex items-center gap-2.5">
-                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
-                      <Sparkles className="h-4 w-4 text-muted-foreground" />
-                    </div>
                     <div>
                       <p className="text-sm font-medium">{skill.name}</p>
                       <Badge variant="secondary" className="mt-1 text-[10px]">
@@ -671,9 +665,6 @@ function InstallSkillDialog({
                       key={r.id}
                       className="flex items-center gap-3 rounded-md border border-border bg-card p-3 hover:bg-muted/40 transition-colors"
                     >
-                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
-                        <Sparkles className="h-4 w-4 text-primary" />
-                      </div>
                       <div className="flex-1 min-w-0">
                         <div className="flex items-center gap-2">
                           <p className="text-sm font-medium truncate">{r.skillId}</p>
```

---

### Incident Patch 9: `3df28700` (2026-10-05)
**Commit Message**: fix(web): collapsing the console sidebar hides it fully

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `web/src/components/app-sidebar.tsx` (modified, +1/-1)
```diff
@@ -383,7 +383,7 @@ export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
   }
 
   return (
-    <Sidebar collapsible="icon" {...props}>
+    <Sidebar collapsible="offcanvas" {...props}>
       <SidebarHeader>
         <SidebarTitle
           title={isAdminRoute(pathname) ? tr("Admin", "管理后台") : tr("Console", "控制台")}
```

---

### Incident Patch 10: `51e9d3d6` (2026-10-04)
**Commit Message**: fix(agent): operator trust follows the agent's real owner

isAdminChatter treated a web / API chatter as the operator when their
user id equalled the agent's ownerUserID — but that is the UserSpace the
agent runs in, not its owner. Any agent attached into another user's
space therefore made that user the operator, with host-shell exec and
host file access on self-hosted installs:

- /v1 calls with an end-user (the end-user's app_user space, where the
  chat's UserID is that same app_user since the end-user namespace
  change);
- public-link visitors and admins chatting with someone else's agent.

The agent now records agents.user_id (SetAgentOwnerID, from rc.UserID)
and owner checks compare against it; legacy agents without one keep the
old rule. Such chatters are guests: exec goes to the sandbox, or is
refused when none is configured.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `internal/agent/loop.go` (modified, +19/-1)
```diff
@@ -60,7 +60,12 @@ type Agent struct {
 	homePath      string // agent's home: SOUL.md, sessions, memory, skills
 	workspacePath string // working dir where agent creates user files
 	homeDir       string // FastClaw root, ~/.fastclaw
-	ownerUserID   string // the user that owns this agent (for hook namespacing)
+	ownerUserID   string // the UserSpace user the agent runs for (hook / data namespacing)
+	// agentOwnerID is agents.user_id — the account that actually owns the
+	// agent. It differs from ownerUserID whenever the agent runs in another
+	// user's space (an app's end-user, a public-link visitor, an admin
+	// browsing). Owner/operator trust is decided against it.
+	agentOwnerID string
 	// admins is the per-channel allowlist of chatters who can run write-
 	// mode slash commands (/new /undo /retry /compact /model /personality).
 	// Keyed by channel name (e.g. "discord" → ["123...", "456..."]). Empty
@@ -700,6 +705,19 @@ func (a *Agent) SetOwnerUserID(uid string) {
 	a.ownerUserID = uid
 }
 
+// SetAgentOwnerID records agents.user_id, the account that owns the agent.
+func (a *Agent) SetAgentOwnerID(uid string) { a.agentOwnerID = uid }
+
+// trustOwnerID is the user treated as the agent's owner for operator
+// trust: the real owner, or — on legacy installs without one — the
+// UserSpace user.
+func (a *Agent) trustOwnerID() string {
+	if a.agentOwnerID != "" {
+		return a.agentOwnerID
+	}
+	return a.ownerUserID
+}
+
 // OwnerUserID returns the agent's owning user ID — the user that
 // created / owns this agent. Exposed so callers that mint records
 // on the user's behalf (e.g. /goal slash) can stamp ownership
```

**File**: `internal/agent/manager.go` (modified, +1/-0)
```diff
@@ -218,6 +218,7 @@ func (m *Manager) buildAgentWithSkillsCfg(rc config.ResolvedAgent, prov provider
 	// were never reaching the sandbox.
 	ag := NewAgentWithSkillsCfg(rc, providerForAgent(rc, prov), mb, homeDir, skillsCfg)
 	ag.SetOwnerUserID(m.uid)
+	ag.SetAgentOwnerID(rc.UserID)
 	// Per-user skills bucket: chat-time `skills/...` writes route to
 	// ~/.fastclaw/users/<uid>/, where SkillsLoader's "personal" layer
 	// also scans (see SkillsLoader.WithUserID). Set userID on the
```

**File**: `internal/agent/slash.go` (modified, +8/-4)
```diff
@@ -174,8 +174,12 @@ func slashRequiresAdmin(cmd string, msg bus.InboundMessage) bool {
 // slash command on this channel.
 //
 // Web / api: the chatter's UserID is the FastClaw user UUID — owner is
-// identified by direct equality with the agent's ownerUserID. No
-// per-platform allowlist needed.
+// identified by direct equality with the agent's real owner
+// (agents.user_id, trustOwnerID). Not the UserSpace user: an agent
+// attached into someone else's space (an app's end-user, a public-link
+// visitor) runs with that user as ownerUserID, and comparing against it
+// would make every such chatter the operator. No per-platform allowlist
+// needed.
 //
 // IM channels (discord, telegram, slack, ...): UserID is the platform's
 // own user ID (Discord snowflake, Telegram numeric ID, ...), which has
@@ -188,7 +192,7 @@ func slashRequiresAdmin(cmd string, msg bus.InboundMessage) bool {
 func (a *Agent) isAdminChatter(msg bus.InboundMessage) bool {
 	// Web / api carry FastClaw UUIDs directly; owner check is sufficient.
 	if msg.Channel == "web" || msg.Channel == "api" {
-		return msg.UserID != "" && msg.UserID == a.ownerUserID
+		return msg.UserID != "" && msg.UserID == a.trustOwnerID()
 	}
 	// Shared-identity channels rewrite EVERY speaker's UserID to the
 	// channel owner's id (routing.processInbound), which makes the
@@ -208,7 +212,7 @@ func (a *Agent) isAdminChatter(msg bus.InboundMessage) bool {
 		// user_id matches the agent owner, they're admin. Otherwise
 		// deny — an unconfigured allowlist should NOT grant admin
 		// to every anonymous chatter on a public-facing IM channel.
-		return msg.UserID != "" && msg.UserID == a.ownerUserID
+		return msg.UserID != "" && msg.UserID == a.trustOwnerID()
 	}
 	for _, id := range list {
 		if id == msg.UserID {
```

**File**: `internal/agent/trust_owner_test.go` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+package agent
+
+import (
+	"testing"
+
+	"github.com/fastclaw-ai/fastclaw/internal/bus"
+)
+
+// An agent attached into another user's space (an app's end-user, a
+// public-link visitor) runs with that user as ownerUserID. That user must
+// not become the operator: trust follows the agent's real owner.
+func TestOperatorTrustFollowsRealOwner(t *testing.T) {
+	a := &Agent{ownerUserID: "u_enduser", agentOwnerID: "u_owner"}
+	for _, ch := range []string{"api", "web"} {
+		if a.isAdminChatter(bus.InboundMessage{Channel: ch, UserID: "u_enduser"}) {
+			t.Fatalf("%s: the space user was treated as the operator", ch)
+		}
+		if !a.isAdminChatter(bus.InboundMessage{Channel: ch, UserID: "u_owner"}) {
+			t.Fatalf("%s: the real owner lost operator trust", ch)
+		}
+	}
+	if a.isAdminChatter(bus.InboundMessage{Channel: "api", UserID: "api-user"}) {
+		t.Fatal("anonymous API callers must not be the operator")
+	}
+	// Legacy installs without agents.user_id keep the space-user rule.
+	legacy := &Agent{ownerUserID: "u_owner"}
+	if !legacy.isAdminChatter(bus.InboundMessage{Channel: "web", UserID: "u_owner"}) {
+		t.Fatal("legacy owner lost operator trust")
+	}
+}
```

---

### Incident Patch 11: `beedca9e` (2026-10-04)
**Commit Message**: feat: serve the integration guide at /skills/agent-integration/SKILL.md

The guide is a skill, so it is served at the same path it has in the
repository; agents can read or install it from there. /integration.md
redirects to it. The console Integration page and its prompt use the new
address.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -42,7 +42,7 @@ agent ID will now get a 404 instead of a reply from some other agent.
   `skills/agent-integration/SKILL.md` is the integration guide — configuring
   `FASTCLAW_BASE_URL` / `FASTCLAW_API_KEY`, agent-scope keys for fixed
   agents, user-scope keys to create and manage agents, chat, usage and
-  errors. Every FastClaw serves it at `/integration.md` (public). The
+  errors. Every FastClaw serves it at `/skills/agent-integration/SKILL.md` (public). The
   console's new **Integration** page links it and builds a ready-to-paste
   prompt for the coding agent wiring another app to FastClaw. It replaces
   `skills/fastclaw-api-integration`; `docs/upstream-api.md` now points to it.
```

**File**: `Makefile` (modified, +1/-1)
```diff
@@ -37,7 +37,7 @@ bundle-skills:
 	@echo "==> bundled skills synced"
 
 # bundle-docs copies docs served by the binary into its embed tree
-# (/integration.md). TestIntegrationDocMatchesSkill fails when it's stale.
+# (/skills/agent-integration/SKILL.md). TestIntegrationDocMatchesSkill fails when it's stale.
 bundle-docs:
 	@cp skills/agent-integration/SKILL.md internal/setup/apidocs/agent-integration.md
 	@echo "==> bundled docs synced"
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -151,7 +151,7 @@ table and is edited through the dashboard or `fastclaw agents config`.
 - OpenAI-compatible `/v1/chat/completions` (streaming)
 - Agent Communication Protocol (ACP) 0.2 at `/acp` — agent discovery,
   manifests, sync/async/stream runs, events, cancellation, and sessions
-- App integration guide (also served at `/integration.md`): [`skills/agent-integration/SKILL.md`](skills/agent-integration/SKILL.md)
+- App integration guide (also served at `/skills/agent-integration/SKILL.md`): [`skills/agent-integration/SKILL.md`](skills/agent-integration/SKILL.md)
 - ACP integration guide: [`docs/acp.md`](docs/acp.md)
 - Web chat `/api/chat/stream` (SSE)
 - Live agent push via `/api/chat/subscribe` (SSE) — surfaces cron-fired and other async replies into the open chat panel without a refresh
```

**File**: `docs/upstream-api.md` (modified, +1/-1)
```diff
@@ -11,6 +11,6 @@ covers:
   with agents on demand;
 - chat sessions, end-users, files, usage, quotas and error codes.
 
-Every FastClaw serves the same guide at `<base URL>/integration.md` (public,
+Every FastClaw serves the same guide at `<base URL>/skills/agent-integration/SKILL.md` (public,
 no key needed), and the console's **Integration** page gives a ready-to-paste
 prompt for the coding agent.
```

**File**: `internal/setup/integration_doc.go` (modified, +5/-1)
```diff
@@ -12,7 +12,11 @@ import (
 //go:embed apidocs/agent-integration.md
 var integrationDoc string
 
-// handleIntegrationDoc serves GET /integration.md: the integration guide for
+// IntegrationDocPath is where the integration skill is served — the same
+// path it has in the repository, so agents can install it as a skill.
+const IntegrationDocPath = "/skills/agent-integration/SKILL.md"
+
+// handleIntegrationDoc serves GET /skills/agent-integration/SKILL.md: the integration guide for
 // the coding agent (or developer) wiring an app to FastClaw. It is public —
 // documentation only, no secrets — so an agent can read it from a link
 // before it has a key. It is served verbatim: the base URL and API key are
```

**File**: `internal/setup/integration_doc_test.go` (modified, +20/-1)
```diff
@@ -23,9 +23,28 @@ func TestIntegrationDocMatchesSkill(t *testing.T) {
 func TestIntegrationDocServedVerbatim(t *testing.T) {
 	s := NewServer(0)
 	rec := httptest.NewRecorder()
-	s.handleIntegrationDoc(rec, httptest.NewRequest(http.MethodGet, "/integration.md", nil))
+	s.handleIntegrationDoc(rec, httptest.NewRequest(http.MethodGet, IntegrationDocPath, nil))
 	if rec.Code != http.StatusOK || rec.Body.String() != integrationDoc ||
 		!strings.HasPrefix(rec.Header().Get("Content-Type"), "text/markdown") {
 		t.Fatalf("unexpected response: %d %q", rec.Code, rec.Header().Get("Content-Type"))
 	}
 }
+
+func TestIntegrationDocRoutes(t *testing.T) {
+	s := NewServer(0)
+	mux := http.NewServeMux()
+	mux.HandleFunc("GET "+IntegrationDocPath, s.handleIntegrationDoc)
+	mux.HandleFunc("GET /integration.md", func(w http.ResponseWriter, r *http.Request) {
+		http.Redirect(w, r, IntegrationDocPath, http.StatusMovedPermanently)
+	})
+	rec := httptest.NewRecorder()
+	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/skills/agent-integration/SKILL.md", nil))
+	if rec.Code != http.StatusOK || !strings.HasPrefix(rec.Body.String(), "---\nname: agent-integration") {
+		t.Fatalf("skill path: %d", rec.Code)
+	}
+	rec = httptest.NewRecorder()
+	mux.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/integration.md", nil))
+	if rec.Code != http.StatusMovedPermanently || rec.Header().Get("Location") != IntegrationDocPath {
+		t.Fatalf("old path: %d %q", rec.Code, rec.Header().Get("Location"))
+	}
+}
```

**File**: `internal/setup/server.go` (modified, +6/-2)
```diff
@@ -259,8 +259,12 @@ func (s *Server) Run(ctx context.Context) error {
 	mux.HandleFunc("POST /api/register", s.handleRegister)
 	mux.HandleFunc("GET /api/public/agents", s.handlePublicAgents)
 	mux.HandleFunc("GET /api/public/skills", s.handlePublicSkills)
-	// The integration guide for apps (and their coding agents); public.
-	mux.HandleFunc("GET /integration.md", s.handleIntegrationDoc)
+	// The integration guide for apps (and their coding agents), served as
+	// the skill it is; public. /integration.md is its earlier address.
+	mux.HandleFunc("GET /skills/agent-integration/SKILL.md", s.handleIntegrationDoc)
+	mux.HandleFunc("GET /integration.md", func(w http.ResponseWriter, r *http.Request) {
+		http.Redirect(w, r, IntegrationDocPath, http.StatusMovedPermanently)
+	})
 	mux.HandleFunc("GET /api/admin/registration", admin(s.handleGetRegistration))
 	mux.HandleFunc("PUT /api/admin/registration", admin(s.handleSetRegistration))
 	mux.HandleFunc("GET /api/admin/chats", admin(s.handleAdminChats))
```

**File**: `web/src/app/console/integration/page.tsx` (modified, +4/-4)
```diff
@@ -10,7 +10,7 @@ import { useLocale } from "@/components/locale-provider";
 type Scenario = "fixed" | "manage";
 
 // The integration page hands the coding agent working on another app what
-// it needs: the public guide at /integration.md (skills/agent-integration)
+// it needs: the public agent-integration skill at /skills/agent-integration/SKILL.md
 // and a prompt naming the scenario, this FastClaw's base URL and — for
 // fixed agents — the agents to call. The API key stays a placeholder: the
 // guide tells the agent to read it from configuration and ask for it.
@@ -36,15 +36,15 @@ export default function IntegrationPage() {
       .catch(() => {});
   }, []);
 
-  const guideURL = `${origin}/integration.md`;
+  const guideURL = `${origin}/skills/agent-integration/SKILL.md`;
   const keysURL = `${origin}/console/apikeys/`;
   // The prompt is for an agent, so it stays in English regardless of the
   // UI language.
   const prompt = useMemo(() => {
     const lines = [
       "Integrate this project's backend with FastClaw cloud agents.",
       "",
-      `Read and follow the integration guide first: ${guideURL}`,
+      `Read and follow the agent-integration skill first (install it if you support skills): ${guideURL}`,
       "",
     ];
     if (scenario === "fixed") {
@@ -103,7 +103,7 @@ export default function IntegrationPage() {
             <Button size="sm" variant="outline" onClick={() => copy("url", guideURL)} title={tr("Copy", "复制")}>
               {copied === "url" ? <Check className="size-4" /> : <Copy className="size-4" />}
             </Button>
-            <Button size="sm" variant="outline" onClick={() => window.open("/integration.md", "_blank")} title={tr("Open", "打开")}>
+            <Button size="sm" variant="outline" onClick={() => window.open("/skills/agent-integration/SKILL.md", "_blank")} title={tr("Open", "打开")}>
               <ExternalLink className="size-4" />
             </Button>
           </div>
```

---

### Incident Patch 12: `65e30252` (2026-10-04)
**Commit Message**: docs: agent-integration skill as the single integration guide

skills/agent-integration/SKILL.md replaces skills/fastclaw-api-integration
and the long docs/upstream-api.md (now a pointer). Written for the coding
agent doing an integration:

- configure FASTCLAW_BASE_URL / FASTCLAW_API_KEY from server-side config,
  asking the user and pointing at where to find them; verify the key;
- scenario A: an agent-scope key for one or more fixed agents;
- scenario B: a user-scope key (on a dedicated account) to create, list,
  update, delete and chat with agents;
- chat, sessions, end-users, files, usage, quotas, error codes, checklist.

/integration.md now serves the skill verbatim (no injected base URL).
The console Integration page drops the full preview and builds the prompt
per scenario (multi-select agents for scenario A), with the base URL filled
in and the key left for the user to issue.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +8/-5)
```diff
@@ -38,11 +38,14 @@ agent ID will now get a 404 instead of a reply from some other agent.
   stable `code` (including 401s and rate limits).
 - **`agent` keys** default to their only granted agent when a request
   names none.
-- **Integration guide for coding agents:** every FastClaw serves the
-  integration contract (`docs/upstream-api.md`) at `/integration.md`, public
-  and prefixed with that deployment's base URL. The console's new
-  **Integration** page links it and builds a ready-to-paste prompt for the
-  agent wiring another app to a chosen FastClaw agent.
+- **Integration guide for coding agents:** the skill
+  `skills/agent-integration/SKILL.md` is the integration guide — configuring
+  `FASTCLAW_BASE_URL` / `FASTCLAW_API_KEY`, agent-scope keys for fixed
+  agents, user-scope keys to create and manage agents, chat, usage and
+  errors. Every FastClaw serves it at `/integration.md` (public). The
+  console's new **Integration** page links it and builds a ready-to-paste
+  prompt for the coding agent wiring another app to FastClaw. It replaces
+  `skills/fastclaw-api-integration`; `docs/upstream-api.md` now points to it.
 - **On-demand agent loading:** accounts with more than 50 agents
   (`FASTCLAW_EAGER_AGENT_LIMIT`) load agents on first use and drop idle ones.
   Agents bound to IM channels or with enabled cron jobs are still loaded at
```

**File**: `Makefile` (modified, +2/-2)
```diff
@@ -37,9 +37,9 @@ bundle-skills:
 	@echo "==> bundled skills synced"
 
 # bundle-docs copies docs served by the binary into its embed tree
-# (/integration.md). TestIntegrationDocMatchesDocs fails when it's stale.
+# (/integration.md). TestIntegrationDocMatchesSkill fails when it's stale.
 bundle-docs:
-	@cp docs/upstream-api.md internal/setup/apidocs/upstream-api.md
+	@cp skills/agent-integration/SKILL.md internal/setup/apidocs/agent-integration.md
 	@echo "==> bundled docs synced"
 
 build: build-web bundle-skills bundle-docs
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -151,7 +151,7 @@ table and is edited through the dashboard or `fastclaw agents config`.
 - OpenAI-compatible `/v1/chat/completions` (streaming)
 - Agent Communication Protocol (ACP) 0.2 at `/acp` — agent discovery,
   manifests, sync/async/stream runs, events, cancellation, and sessions
-- Upstream app integration contract: [`docs/upstream-api.md`](docs/upstream-api.md)
+- App integration guide (also served at `/integration.md`): [`skills/agent-integration/SKILL.md`](skills/agent-integration/SKILL.md)
 - ACP integration guide: [`docs/acp.md`](docs/acp.md)
 - Web chat `/api/chat/stream` (SSE)
 - Live agent push via `/api/chat/subscribe` (SSE) — surfaces cron-fired and other async replies into the open chat panel without a refresh
```

**File**: `docs/upstream-api.md` (modified, +14/-381)
```diff
@@ -1,383 +1,16 @@
 # FastClaw Upstream App Integration API
 
-> Every FastClaw serves this guide at `<base URL>/integration.md` (public, no
-> key needed) — point a coding agent there. The console's **Integration** page
-> also gives a ready-to-paste prompt naming the agent to call.
-
-This is the integration contract for applications that use FastClaw as their
-agent runtime.
-
-FastClaw is split into two layers:
-
-- **The agent runtime** (this API) stores agent configuration, runs the agent
-  loop, sandbox and tools, stores sessions and memory, and meters usage.
-- **Your app** owns everything about its users: sign-in, which user may use
-  which agent, chat records, billing rules, IM channels, and session IDs.
-
-Data flows one way: your app calls the runtime; the runtime never calls your
-app back and never knows who your users are. FastClaw's own console and IM
-channels are apps in the same sense — they serve users who registered with
-FastClaw directly.
-
-## Which Interface To Use
-
-| Need | Interface | Notes |
-|---|---|---|
-| Create and manage your app's agents | `/v1/agents` | Create, list, read, update, delete; write identity files. |
-| Chat with an agent | `POST /v1/chat/completions` | OpenAI-compatible, plus FastClaw extensions. |
-| Query usage / token spend | `GET /v1/usage` | By agent and by end-user, for your billing. |
-| Set per-user limits | `/v1/quota` | For subscription and entitlement enforcement. |
-| Provision an end-user up front | `POST /v1/users` | Optional; chat provisions lazily. |
-| Admin/dashboard automation | `/api/*` or `fastclaw ...` CLI | Serves the FastClaw console. No stability promise for integrators. |
-| Coding-agent live preview runtime | `docs/coding-agent-runtime.md` | Documented separately. |
-
-Integrations should depend on `/v1/*` only.
-
-## Accounts, Keys And Agents
-
-| Object | Meaning |
-|---|---|
-| Account | The tenant: the FastClaw account your integration runs under. Use one account per integration environment that must be isolated, e.g. `douchat-prod`, `douchat-dev`. |
-| API key | Belongs to the account. May have several (rotation, revocation). A `user` key operates on every agent of the account; an `agent` key only on the agents granted to it. |
-| Agent | Belongs to the account. Created in the console or through `POST /v1/agents`. The runtime does not record which of your users an agent "belongs to" — keep that in your app (optionally mirrored into `metadata`). |
-| `session_key` | One conversation's history. Generated by your app. |
-| `end_user` | Optional data namespace: your user's ID. Decides where personal data lives; never decides which agents can be used. |
-
-**Your app must check "may this user use this agent?" before every call.** The
-runtime only guarantees isolation between accounts: account A's keys can never
-see or use account B's agents.
-
-**Which key?** An integration that talks to fixed agents (e.g. one image
-editing agent) needs an `agent` key granted just those agents. An integration
-that creates its own agents through the API needs a `user` key — give it its
-own account, so its keys can't reach agents you use elsewhere.
-
-### Where data lives
-
-| Data | Keyed by |
-|---|---|
-| Agent persona, skills, tool config (SOUL.md, IDENTITY.md, …) | account + agent |
-| Session history | account + agent + `session_key` (+ `end_user` when given) |
-| Personal profile and memory (USER.md, MEMORY.md) | account + agent + `end_user` — created only when `end_user` is given |
-| The agent's own memory when no `end_user` is given | account + agent, shared by every such call |
-| Usage | account + agent + `end_user` + day |
-
-### Typical calls
-
-| Scenario | `session_key` | `end_user` |
-|---|---|---|
-| A user chats with their own agent (Douchat DM) | `douchat:<conversation id>:<topic id>` | not set |
-| Several people talk to one agent in a group | `douchat:<group id>:<topic id>` | not set; the speaker goes in `params.speaker` |
-| Many people each privately chat with one public agent (weclaw, support bot) | `weclaw:<user id>:<agent id>` | the user's ID |
-
-## Authentication
-
-Every request carries an API key of your account:
-
-```http
-Authorization: Bearer fcak_...
-```
-
-| Key type | Use |
-|---|---|
-| `user` | Can manage and use every agent of the account, including ones created later. |
-| `agent` | Scoped to explicit agent IDs; cannot create or delete agents. A request that names no agent uses the key's only agent. |
-| `admin` | Platform automation. On `/v1` it is still limited to its own account's agents. |
-
-Never expose a FastClaw API key to browsers or mobile apps.
-
-`X-Fastclaw-End-User` (or the chat body field `user`) names the end-user. It
-selects the data namespace only; agents are always resolved from the account.
-
-## Agents
-
-### `POST /v1/agents`
-
-Creates an agent owned by the account.
-
-```http
-POST /v1/agents
-Authorization: Bearer fcak_...
-Content-Type: application/json
-
-{
-  "name": "周报助
```

**File**: `internal/setup/apidocs/agent-integration.md` (added, +229/-0)
```diff
@@ -0,0 +1,229 @@
+---
+name: agent-integration
+description: Integrate an application's backend with FastClaw cloud agents over the FastClaw API. Use when a project needs to chat with one or more existing FastClaw agents (agent-scope API key), or to create, update, delete and chat with agents on demand (user-scope API key) — e.g. "connect this app to FastClaw", "call my FastClaw agent from the backend", "let each user create their own agent".
+---
+
+# FastClaw Agent Integration
+
+FastClaw is an agent runtime. It stores agent configuration, runs the agent
+loop with its tools and sandbox, keeps sessions and memory, and meters usage.
+**Your application** owns everything about its users: sign-in, which user may
+use which agent, chat records, billing. Your backend calls FastClaw; FastClaw
+never calls your app back and never knows your users.
+
+Follow this guide over guesses from other FastClaw code (the dashboard's
+`/api/*` endpoints are internal and change without notice). Integrations use
+`/v1/*` only.
+
+## 1. Configure the connection first
+
+The integration needs two values. Never hardcode them; read them on the
+server side from configuration (environment variables or the app's secret
+store):
+
+| Setting | What it is | Where the user finds it |
+|---|---|---|
+| `FASTCLAW_BASE_URL` | The FastClaw address, e.g. `https://claw.example.com` (no trailing slash). | The address the user opens the FastClaw console at. The console's **Integration** page shows it. |
+| `FASTCLAW_API_KEY` | A FastClaw API key (`fc_...`), sent as `Authorization: Bearer <key>`. | FastClaw console → **API Keys** → **Add API key**. The token is shown once. |
+
+If either is missing, **stop and ask the user** for it — tell them where to
+find it (table above) and which key type the integration needs (section 2).
+Add both to the project's environment template (`.env.example` or similar)
+without real values.
+
+Then verify the connection:
+
+```bash
+curl -s "$FASTCLAW_BASE_URL/v1/agents" -H "Authorization: Bearer $FASTCLAW_API_KEY"
+```
+
+A `200` lists the agents the key may use; `401 unauthorized` means a wrong or
+revoked key.
+
+**Never expose the key to browsers or mobile apps.** Clients talk to your
+backend; your backend talks to FastClaw.
+
+## 2. Pick the scenario
+
+| | A. Fixed agents | B. Manage agents |
+|---|---|---|
+| Use when | The app talks to agents that already exist in FastClaw — one or several (e.g. an image-editing agent, a support bot). | The app creates agents itself, e.g. one per user or per workspace, and manages them over time. |
+| Key type | **Agent** key, granted exactly those agents. | **User** key. |
+| Can | List and read its granted agents, update their settings, chat with them. | Create, list, read, update and delete agents; chat with any agent of the account. |
+| Cannot | Create or delete agents; see any other agent. | — |
+
+A user key reaches **every** agent of its FastClaw account. For scenario B,
+use a FastClaw account dedicated to this integration (and one per
+environment, e.g. `myapp-prod` / `myapp-dev`) so the key can't touch agents
+used elsewhere.
+
+Whichever scenario: **your app must check "may this user use this agent?"
+before every call.** FastClaw only isolates accounts and API keys from each
+other.
+
+## 3. Scenario A — chat with fixed agents
+
+1. The user creates the agent(s) in the FastClaw console and issues an
+   **Agent** API key granted to them.
+2. Find the agents the key may use:
+
+   ```bash
+   curl -s "$FASTCLAW_BASE_URL/v1/agents" -H "Authorization: Bearer $FASTCLAW_API_KEY"
+   ```
+
+   ```json
+   { "agents": [ { "id": "agt_2834a7a1e660d509b83d", "display_name": "Image Editor", "description": "…", "model": "…", "metadata": {}, "created_at": "…", "updated_at": "…" } ], "has_more": false }
+   ```
+
+3. Keep the agent ids in configuration (e.g. `FASTCLAW_AGENT_ID`, or a map
+   from your feature to an agent id when there are several). With a single
+   granted agent, chat requests may omit `agent_id`; name it anyway once the
+   app may use more than one.
+4. Chat (section 5).
+
+## 4. Scenario B — manage agents
+
+Agents created with the API belong to the key's FastClaw account. FastClaw
+does not record which of your users an agent is for — keep that mapping in
+your database (and mirror it into `metadata` if you want to filter by it).
+
+### Create — `POST /v1/agents`
+
+```bash
+curl -s "$FASTCLAW_BASE_URL/v1/agents" \
+  -H "Authorization: Bearer $FASTCLAW_API_KEY" -H "Content-Type: application/json" \
+  -d '{
+    "name": "Weekly Report Assistant",
+    "description": "Summarizes the team every Friday",
+    "instructions": "You write concise weekly reports.",
+    "model": "anthropic/claude-sonnet-5-5",
+    "metadata": { "app_user": "user-123" }
+  }'
+```
+
+```json
+{ "agent": { "id": "agt_2834a7a1e660d509b83d", "display_name": "Weekly Report Assistant", "name": "agt_2834a7a1e660d509b83d", "description": "Summarizes the team every Friday", "mo
```

**File**: `internal/setup/apidocs/upstream-api.md` (removed, +0/-383)
```diff
@@ -1,383 +0,0 @@
-# FastClaw Upstream App Integration API
-
-> Every FastClaw serves this guide at `<base URL>/integration.md` (public, no
-> key needed) — point a coding agent there. The console's **Integration** page
-> also gives a ready-to-paste prompt naming the agent to call.
-
-This is the integration contract for applications that use FastClaw as their
-agent runtime.
-
-FastClaw is split into two layers:
-
-- **The agent runtime** (this API) stores agent configuration, runs the agent
-  loop, sandbox and tools, stores sessions and memory, and meters usage.
-- **Your app** owns everything about its users: sign-in, which user may use
-  which agent, chat records, billing rules, IM channels, and session IDs.
-
-Data flows one way: your app calls the runtime; the runtime never calls your
-app back and never knows who your users are. FastClaw's own console and IM
-channels are apps in the same sense — they serve users who registered with
-FastClaw directly.
-
-## Which Interface To Use
-
-| Need | Interface | Notes |
-|---|---|---|
-| Create and manage your app's agents | `/v1/agents` | Create, list, read, update, delete; write identity files. |
-| Chat with an agent | `POST /v1/chat/completions` | OpenAI-compatible, plus FastClaw extensions. |
-| Query usage / token spend | `GET /v1/usage` | By agent and by end-user, for your billing. |
-| Set per-user limits | `/v1/quota` | For subscription and entitlement enforcement. |
-| Provision an end-user up front | `POST /v1/users` | Optional; chat provisions lazily. |
-| Admin/dashboard automation | `/api/*` or `fastclaw ...` CLI | Serves the FastClaw console. No stability promise for integrators. |
-| Coding-agent live preview runtime | `docs/coding-agent-runtime.md` | Documented separately. |
-
-Integrations should depend on `/v1/*` only.
-
-## Accounts, Keys And Agents
-
-| Object | Meaning |
-|---|---|
-| Account | The tenant: the FastClaw account your integration runs under. Use one account per integration environment that must be isolated, e.g. `douchat-prod`, `douchat-dev`. |
-| API key | Belongs to the account. May have several (rotation, revocation). A `user` key operates on every agent of the account; an `agent` key only on the agents granted to it. |
-| Agent | Belongs to the account. Created in the console or through `POST /v1/agents`. The runtime does not record which of your users an agent "belongs to" — keep that in your app (optionally mirrored into `metadata`). |
-| `session_key` | One conversation's history. Generated by your app. |
-| `end_user` | Optional data namespace: your user's ID. Decides where personal data lives; never decides which agents can be used. |
-
-**Your app must check "may this user use this agent?" before every call.** The
-runtime only guarantees isolation between accounts: account A's keys can never
-see or use account B's agents.
-
-**Which key?** An integration that talks to fixed agents (e.g. one image
-editing agent) needs an `agent` key granted just those agents. An integration
-that creates its own agents through the API needs a `user` key — give it its
-own account, so its keys can't reach agents you use elsewhere.
-
-### Where data lives
-
-| Data | Keyed by |
-|---|---|
-| Agent persona, skills, tool config (SOUL.md, IDENTITY.md, …) | account + agent |
-| Session history | account + agent + `session_key` (+ `end_user` when given) |
-| Personal profile and memory (USER.md, MEMORY.md) | account + agent + `end_user` — created only when `end_user` is given |
-| The agent's own memory when no `end_user` is given | account + agent, shared by every such call |
-| Usage | account + agent + `end_user` + day |
-
-### Typical calls
-
-| Scenario | `session_key` | `end_user` |
-|---|---|---|
-| A user chats with their own agent (Douchat DM) | `douchat:<conversation id>:<topic id>` | not set |
-| Several people talk to one agent in a group | `douchat:<group id>:<topic id>` | not set; the speaker goes in `params.speaker` |
-| Many people each privately chat with one public agent (weclaw, support bot) | `weclaw:<user id>:<agent id>` | the user's ID |
-
-## Authentication
-
-Every request carries an API key of your account:
-
-```http
-Authorization: Bearer fcak_...
-```
-
-| Key type | Use |
-|---|---|
-| `user` | Can manage and use every agent of the account, including ones created later. |
-| `agent` | Scoped to explicit agent IDs; cannot create or delete agents. A request that names no agent uses the key's only agent. |
-| `admin` | Platform automation. On `/v1` it is still limited to its own account's agents. |
-
-Never expose a FastClaw API key to browsers or mobile apps.
-
-`X-Fastclaw-End-User` (or the chat body field `user`) names the end-user. It
-selects the data namespace only; agents are always resolved from the account.
-
-## Agents
-
-### `POST /v1/agents`
-
-Creates an agent owned by the account.
-
-```http
-POST /v1/agents
-Authorization: Bearer fcak_...
-Content-Type: application/json
-
-{
-  "name": "周报助手
```

**File**: `internal/setup/integration_doc.go` (modified, +11/-34)
```diff
@@ -3,46 +3,23 @@ package setup
 import (
 	_ "embed"
 	"net/http"
-	"strings"
 )
 
-// integrationDoc is docs/upstream-api.md, the contract for applications
-// that use FastClaw as their agent runtime. `make bundle-docs` copies it
-// here; TestIntegrationDocMatchesDocs keeps the two in sync.
+// integrationDoc is skills/agent-integration/SKILL.md, the guide for
+// applications that use FastClaw as their agent runtime. `make bundle-docs`
+// copies it here; TestIntegrationDocMatchesSkill keeps the two in sync.
 //
-//go:embed apidocs/upstream-api.md
+//go:embed apidocs/agent-integration.md
 var integrationDoc string
 
-// handleIntegrationDoc serves GET /integration.md: the integration guide
-// for the coding agent (or developer) wiring an app to this FastClaw. It is
-// public — documentation only, no secrets — so an agent can read it from a
-// URL before it has a key. The header names this deployment's base URL so
-// the guide is ready to follow as-is.
+// handleIntegrationDoc serves GET /integration.md: the integration guide for
+// the coding agent (or developer) wiring an app to FastClaw. It is public —
+// documentation only, no secrets — so an agent can read it from a link
+// before it has a key. It is served verbatim: the base URL and API key are
+// configured by the integrating app, and the guide tells it where to find
+// them.
 func (s *Server) handleIntegrationDoc(w http.ResponseWriter, r *http.Request) {
-	base := requestBaseURL(r)
-	var b strings.Builder
-	b.WriteString("<!-- Served by this FastClaw at " + base + "/integration.md -->\n\n")
-	b.WriteString("> **This FastClaw:** base URL `" + base + "`. Send `Authorization: Bearer <API key>`;\n")
-	b.WriteString("> keys are issued in the console under **API Keys** (" + base + "/console/apikeys/).\n\n")
-	b.WriteString(integrationDoc)
 	w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
 	w.Header().Set("Access-Control-Allow-Origin", "*")
-	_, _ = w.Write([]byte(b.String()))
-}
-
-// requestBaseURL reconstructs the externally visible origin of a request,
-// honoring the usual reverse-proxy headers.
-func requestBaseURL(r *http.Request) string {
-	scheme := "http"
-	if r.TLS != nil {
-		scheme = "https"
-	}
-	if p := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-Proto"), ",")[0]); p == "http" || p == "https" {
-		scheme = p
-	}
-	host := r.Host
-	if h := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-Host"), ",")[0]); h != "" {
-		host = h
-	}
-	return scheme + "://" + host
+	_, _ = w.Write([]byte(integrationDoc))
 }
```

**File**: `internal/setup/integration_doc_test.go` (modified, +10/-17)
```diff
@@ -8,31 +8,24 @@ import (
 	"testing"
 )
 
-// The served guide is a build-time copy of docs/upstream-api.md; run
-// `make bundle-docs` after editing the doc.
-func TestIntegrationDocMatchesDocs(t *testing.T) {
-	src, err := os.ReadFile("../../docs/upstream-api.md")
+// The served guide is a build-time copy of skills/agent-integration/SKILL.md;
+// run `make bundle-docs` after editing the skill.
+func TestIntegrationDocMatchesSkill(t *testing.T) {
+	src, err := os.ReadFile("../../skills/agent-integration/SKILL.md")
 	if err != nil {
 		t.Fatal(err)
 	}
 	if string(src) != integrationDoc {
-		t.Fatal("internal/setup/apidocs/upstream-api.md is stale: run `make bundle-docs`")
+		t.Fatal("internal/setup/apidocs/agent-integration.md is stale: run `make bundle-docs`")
 	}
 }
 
-func TestIntegrationDocNamesBaseURL(t *testing.T) {
+func TestIntegrationDocServedVerbatim(t *testing.T) {
 	s := NewServer(0)
-	req := httptest.NewRequest(http.MethodGet, "http://internal:18953/integration.md", nil)
-	req.Header.Set("X-Forwarded-Proto", "https")
-	req.Header.Set("X-Forwarded-Host", "claw.example.com")
 	rec := httptest.NewRecorder()
-	s.handleIntegrationDoc(rec, req)
-	body := rec.Body.String()
-	if rec.Code != http.StatusOK || !strings.Contains(body, "base URL `https://claw.example.com`") ||
-		!strings.Contains(body, "# FastClaw Upstream App Integration API") {
-		t.Fatalf("unexpected doc: %d %.300s", rec.Code, body)
-	}
-	if !strings.HasPrefix(rec.Header().Get("Content-Type"), "text/markdown") {
-		t.Fatalf("content type %q", rec.Header().Get("Content-Type"))
+	s.handleIntegrationDoc(rec, httptest.NewRequest(http.MethodGet, "/integration.md", nil))
+	if rec.Code != http.StatusOK || rec.Body.String() != integrationDoc ||
+		!strings.HasPrefix(rec.Header().Get("Content-Type"), "text/markdown") {
+		t.Fatalf("unexpected response: %d %q", rec.Code, rec.Header().Get("Content-Type"))
 	}
 }
```

---

### Incident Patch 13: `49d9f649` (2026-10-04)
**Commit Message**: feat: integration guide for coding agents at /integration.md

Every FastClaw now serves the app integration contract
(docs/upstream-api.md) at GET /integration.md: public (documentation, no
keys) and prefixed with this deployment's base URL, so a coding agent in
another project can read it from a link before it has a key.

- The doc is embedded from internal/setup/apidocs; `make bundle-docs`
  (part of build) copies it and a test fails when the copy is stale.
- Console: new Integration page (sidebar) with the guide link, a
  ready-to-paste prompt for the coding agent naming the selected agent's
  id, and a rendered preview of the guide.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -38,6 +38,11 @@ agent ID will now get a 404 instead of a reply from some other agent.
   stable `code` (including 401s and rate limits).
 - **`agent` keys** default to their only granted agent when a request
   names none.
+- **Integration guide for coding agents:** every FastClaw serves the
+  integration contract (`docs/upstream-api.md`) at `/integration.md`, public
+  and prefixed with that deployment's base URL. The console's new
+  **Integration** page links it and builds a ready-to-paste prompt for the
+  agent wiring another app to a chosen FastClaw agent.
 - **On-demand agent loading:** accounts with more than 50 agents
   (`FASTCLAW_EAGER_AGENT_LIMIT`) load agents on first use and drop idle ones.
   Agents bound to IM channels or with enabled cron jobs are still loaded at
```

**File**: `Makefile` (modified, +8/-2)
```diff
@@ -36,7 +36,13 @@ bundle-skills:
 	@cp -R skills/find-skills internal/agent/bundled_skills/find-skills
 	@echo "==> bundled skills synced"
 
-build: build-web bundle-skills
+# bundle-docs copies docs served by the binary into its embed tree
+# (/integration.md). TestIntegrationDocMatchesDocs fails when it's stale.
+bundle-docs:
+	@cp docs/upstream-api.md internal/setup/apidocs/upstream-api.md
+	@echo "==> bundled docs synced"
+
+build: build-web bundle-skills bundle-docs
 	CGO_ENABLED=0 go build -ldflags "$(LDFLAGS)" -o bin/fastclaw ./cmd/fastclaw
 
 install: build
@@ -59,7 +65,7 @@ clean:
 	rm -rf bin/ dist/ tmp/
 
 # Build all platforms
-release-local: build-web bundle-skills
+release-local: build-web bundle-skills bundle-docs
 	@mkdir -p dist
 	@# macOS
 	GOOS=darwin  GOARCH=arm64 CGO_ENABLED=0 go build -ldflags "$(LDFLAGS)" -o dist/fastclaw_darwin_arm64/fastclaw  ./cmd/fastclaw
```

**File**: `docs/upstream-api.md` (modified, +4/-0)
```diff
@@ -1,5 +1,9 @@
 # FastClaw Upstream App Integration API
 
+> Every FastClaw serves this guide at `<base URL>/integration.md` (public, no
+> key needed) — point a coding agent there. The console's **Integration** page
+> also gives a ready-to-paste prompt naming the agent to call.
+
 This is the integration contract for applications that use FastClaw as their
 agent runtime.
 
```

**File**: `internal/setup/apidocs/upstream-api.md` (added, +383/-0)
```diff
@@ -0,0 +1,383 @@
+# FastClaw Upstream App Integration API
+
+> Every FastClaw serves this guide at `<base URL>/integration.md` (public, no
+> key needed) — point a coding agent there. The console's **Integration** page
+> also gives a ready-to-paste prompt naming the agent to call.
+
+This is the integration contract for applications that use FastClaw as their
+agent runtime.
+
+FastClaw is split into two layers:
+
+- **The agent runtime** (this API) stores agent configuration, runs the agent
+  loop, sandbox and tools, stores sessions and memory, and meters usage.
+- **Your app** owns everything about its users: sign-in, which user may use
+  which agent, chat records, billing rules, IM channels, and session IDs.
+
+Data flows one way: your app calls the runtime; the runtime never calls your
+app back and never knows who your users are. FastClaw's own console and IM
+channels are apps in the same sense — they serve users who registered with
+FastClaw directly.
+
+## Which Interface To Use
+
+| Need | Interface | Notes |
+|---|---|---|
+| Create and manage your app's agents | `/v1/agents` | Create, list, read, update, delete; write identity files. |
+| Chat with an agent | `POST /v1/chat/completions` | OpenAI-compatible, plus FastClaw extensions. |
+| Query usage / token spend | `GET /v1/usage` | By agent and by end-user, for your billing. |
+| Set per-user limits | `/v1/quota` | For subscription and entitlement enforcement. |
+| Provision an end-user up front | `POST /v1/users` | Optional; chat provisions lazily. |
+| Admin/dashboard automation | `/api/*` or `fastclaw ...` CLI | Serves the FastClaw console. No stability promise for integrators. |
+| Coding-agent live preview runtime | `docs/coding-agent-runtime.md` | Documented separately. |
+
+Integrations should depend on `/v1/*` only.
+
+## Accounts, Keys And Agents
+
+| Object | Meaning |
+|---|---|
+| Account | The tenant: the FastClaw account your integration runs under. Use one account per integration environment that must be isolated, e.g. `douchat-prod`, `douchat-dev`. |
+| API key | Belongs to the account. May have several (rotation, revocation). A `user` key operates on every agent of the account; an `agent` key only on the agents granted to it. |
+| Agent | Belongs to the account. Created in the console or through `POST /v1/agents`. The runtime does not record which of your users an agent "belongs to" — keep that in your app (optionally mirrored into `metadata`). |
+| `session_key` | One conversation's history. Generated by your app. |
+| `end_user` | Optional data namespace: your user's ID. Decides where personal data lives; never decides which agents can be used. |
+
+**Your app must check "may this user use this agent?" before every call.** The
+runtime only guarantees isolation between accounts: account A's keys can never
+see or use account B's agents.
+
+**Which key?** An integration that talks to fixed agents (e.g. one image
+editing agent) needs an `agent` key granted just those agents. An integration
+that creates its own agents through the API needs a `user` key — give it its
+own account, so its keys can't reach agents you use elsewhere.
+
+### Where data lives
+
+| Data | Keyed by |
+|---|---|
+| Agent persona, skills, tool config (SOUL.md, IDENTITY.md, …) | account + agent |
+| Session history | account + agent + `session_key` (+ `end_user` when given) |
+| Personal profile and memory (USER.md, MEMORY.md) | account + agent + `end_user` — created only when `end_user` is given |
+| The agent's own memory when no `end_user` is given | account + agent, shared by every such call |
+| Usage | account + agent + `end_user` + day |
+
+### Typical calls
+
+| Scenario | `session_key` | `end_user` |
+|---|---|---|
+| A user chats with their own agent (Douchat DM) | `douchat:<conversation id>:<topic id>` | not set |
+| Several people talk to one agent in a group | `douchat:<group id>:<topic id>` | not set; the speaker goes in `params.speaker` |
+| Many people each privately chat with one public agent (weclaw, support bot) | `weclaw:<user id>:<agent id>` | the user's ID |
+
+## Authentication
+
+Every request carries an API key of your account:
+
+```http
+Authorization: Bearer fcak_...
+```
+
+| Key type | Use |
+|---|---|
+| `user` | Can manage and use every agent of the account, including ones created later. |
+| `agent` | Scoped to explicit agent IDs; cannot create or delete agents. A request that names no agent uses the key's only agent. |
+| `admin` | Platform automation. On `/v1` it is still limited to its own account's agents. |
+
+Never expose a FastClaw API key to browsers or mobile apps.
+
+`X-Fastclaw-End-User` (or the chat body field `user`) names the end-user. It
+selects the data namespace only; agents are always resolved from the account.
+
+## Agents
+
+### `POST /v1/agents`
+
+Creates an agent owned by the account.
+
+```http
+POST /v1/agents
+Authorization: Bearer fcak_...
+Content-Type: application/json
+
+{
+  "name": "周报助手
```

**File**: `internal/setup/integration_doc.go` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+package setup
+
+import (
+	_ "embed"
+	"net/http"
+	"strings"
+)
+
+// integrationDoc is docs/upstream-api.md, the contract for applications
+// that use FastClaw as their agent runtime. `make bundle-docs` copies it
+// here; TestIntegrationDocMatchesDocs keeps the two in sync.
+//
+//go:embed apidocs/upstream-api.md
+var integrationDoc string
+
+// handleIntegrationDoc serves GET /integration.md: the integration guide
+// for the coding agent (or developer) wiring an app to this FastClaw. It is
+// public — documentation only, no secrets — so an agent can read it from a
+// URL before it has a key. The header names this deployment's base URL so
+// the guide is ready to follow as-is.
+func (s *Server) handleIntegrationDoc(w http.ResponseWriter, r *http.Request) {
+	base := requestBaseURL(r)
+	var b strings.Builder
+	b.WriteString("<!-- Served by this FastClaw at " + base + "/integration.md -->\n\n")
+	b.WriteString("> **This FastClaw:** base URL `" + base + "`. Send `Authorization: Bearer <API key>`;\n")
+	b.WriteString("> keys are issued in the console under **API Keys** (" + base + "/console/apikeys/).\n\n")
+	b.WriteString(integrationDoc)
+	w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
+	w.Header().Set("Access-Control-Allow-Origin", "*")
+	_, _ = w.Write([]byte(b.String()))
+}
+
+// requestBaseURL reconstructs the externally visible origin of a request,
+// honoring the usual reverse-proxy headers.
+func requestBaseURL(r *http.Request) string {
+	scheme := "http"
+	if r.TLS != nil {
+		scheme = "https"
+	}
+	if p := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-Proto"), ",")[0]); p == "http" || p == "https" {
+		scheme = p
+	}
+	host := r.Host
+	if h := strings.TrimSpace(strings.Split(r.Header.Get("X-Forwarded-Host"), ",")[0]); h != "" {
+		host = h
+	}
+	return scheme + "://" + host
+}
```

**File**: `internal/setup/integration_doc_test.go` (added, +38/-0)
```diff
@@ -0,0 +1,38 @@
+package setup
+
+import (
+	"net/http"
+	"net/http/httptest"
+	"os"
+	"strings"
+	"testing"
+)
+
+// The served guide is a build-time copy of docs/upstream-api.md; run
+// `make bundle-docs` after editing the doc.
+func TestIntegrationDocMatchesDocs(t *testing.T) {
+	src, err := os.ReadFile("../../docs/upstream-api.md")
+	if err != nil {
+		t.Fatal(err)
+	}
+	if string(src) != integrationDoc {
+		t.Fatal("internal/setup/apidocs/upstream-api.md is stale: run `make bundle-docs`")
+	}
+}
+
+func TestIntegrationDocNamesBaseURL(t *testing.T) {
+	s := NewServer(0)
+	req := httptest.NewRequest(http.MethodGet, "http://internal:18953/integration.md", nil)
+	req.Header.Set("X-Forwarded-Proto", "https")
+	req.Header.Set("X-Forwarded-Host", "claw.example.com")
+	rec := httptest.NewRecorder()
+	s.handleIntegrationDoc(rec, req)
+	body := rec.Body.String()
+	if rec.Code != http.StatusOK || !strings.Contains(body, "base URL `https://claw.example.com`") ||
+		!strings.Contains(body, "# FastClaw Upstream App Integration API") {
+		t.Fatalf("unexpected doc: %d %.300s", rec.Code, body)
+	}
+	if !strings.HasPrefix(rec.Header().Get("Content-Type"), "text/markdown") {
+		t.Fatalf("content type %q", rec.Header().Get("Content-Type"))
+	}
+}
```

**File**: `internal/setup/server.go` (modified, +2/-0)
```diff
@@ -259,6 +259,8 @@ func (s *Server) Run(ctx context.Context) error {
 	mux.HandleFunc("POST /api/register", s.handleRegister)
 	mux.HandleFunc("GET /api/public/agents", s.handlePublicAgents)
 	mux.HandleFunc("GET /api/public/skills", s.handlePublicSkills)
+	// The integration guide for apps (and their coding agents); public.
+	mux.HandleFunc("GET /integration.md", s.handleIntegrationDoc)
 	mux.HandleFunc("GET /api/admin/registration", admin(s.handleGetRegistration))
 	mux.HandleFunc("PUT /api/admin/registration", admin(s.handleSetRegistration))
 	mux.HandleFunc("GET /api/admin/chats", admin(s.handleAdminChats))
```

**File**: `skills/fastclaw-api-integration/SKILL.md` (modified, +2/-1)
```diff
@@ -3,7 +3,8 @@
 Use this skill when integrating an upstream application with FastClaw as an
 agent runtime.
 
-The canonical reference is `docs/upstream-api.md` in the FastClaw repository.
+The canonical reference is `docs/upstream-api.md` in the FastClaw repository;
+every FastClaw also serves it at `<base URL>/integration.md`.
 Follow that document over guesses from existing dashboard code.
 
 ## Integration Boundary
```

---

### Incident Patch 14: `38340104` (2026-09-08)
**Commit Message**: fix chat navigation and history loading

**File**: `internal/setup/chat_history_pagination_test.go` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+package setup
+
+import "testing"
+
+func TestPaginateChatHistoryKeepsTurnsWhole(t *testing.T) {
+	history := []map[string]any{
+		{"role": "user", "content": "one"},
+		{"role": "assistant", "content": "reply one"},
+		{"role": "user", "content": "two"},
+		{"role": "assistant", "toolCalls": []any{"call"}},
+		{"role": "tool", "content": "result"},
+		{"role": "assistant", "content": "reply two"},
+		{"role": "user", "content": "three"},
+		{"role": "assistant", "content": "reply three"},
+	}
+
+	latest, start, hasMore := paginateChatHistory(history, 3, len(history))
+	if start != 6 || !hasMore || len(latest) != 2 {
+		t.Fatalf("latest page = start %d, hasMore %v, len %d; want 6, true, 2", start, hasMore, len(latest))
+	}
+	if latest[0]["role"] != "user" {
+		t.Fatalf("latest page starts with %v; want user", latest[0]["role"])
+	}
+
+	older, olderStart, olderHasMore := paginateChatHistory(history, 3, start)
+	if olderStart != 2 || !olderHasMore || len(older) != 4 {
+		t.Fatalf("older page = start %d, hasMore %v, len %d; want 2, true, 4", olderStart, olderHasMore, len(older))
+	}
+	if older[0]["role"] != "user" || older[len(older)-1]["role"] != "assistant" {
+		t.Fatalf("older page did not preserve a complete turn: %#v", older)
+	}
+
+	oldest, oldestStart, oldestHasMore := paginateChatHistory(history, 3, olderStart)
+	if oldestStart != 0 || oldestHasMore || len(oldest) != 2 {
+		t.Fatalf("oldest page = start %d, hasMore %v, len %d; want 0, false, 2", oldestStart, oldestHasMore, len(oldest))
+	}
+}
```

**File**: `internal/setup/handlers.go` (modified, +39/-1)
```diff
@@ -1681,7 +1681,21 @@ func (s *Server) handleChatHistory(w http.ResponseWriter, r *http.Request) {
 		jsonResponse(w, http.StatusNotFound, map[string]any{"error": "agent not found"})
 		return
 	}
-	resp := map[string]any{"history": ag.WebChatHistory(sessionID)}
+	history := ag.WebChatHistory(sessionID)
+	historyStart := 0
+	hasMoreHistory := false
+	if limit, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && limit > 0 {
+		before := len(history)
+		if value, parseErr := strconv.Atoi(r.URL.Query().Get("before")); parseErr == nil {
+			before = value
+		}
+		history, historyStart, hasMoreHistory = paginateChatHistory(history, limit, before)
+	}
+	resp := map[string]any{
+		"history":        history,
+		"historyStart":   historyStart,
+		"hasMoreHistory": hasMoreHistory,
+	}
 	// latestEventSeq is the resume cursor for /api/chat/subscribe — the
 	// client opens that endpoint with `since=<latestEventSeq>` so a
 	// fresh page load picks up only deltas it hasn't already rendered.
@@ -1699,6 +1713,30 @@ func (s *Server) handleChatHistory(w http.ResponseWriter, r *http.Request) {
 	jsonResponse(w, http.StatusOK, resp)
 }
 
+// paginateChatHistory returns one ascending page ending at before. The start
+// is aligned to a user message so an assistant tool-call followed by its tool
+// results is never split across two browser requests.
+func paginateChatHistory(history []map[string]any, limit, before int) ([]map[string]any, int, bool) {
+	limit = max(1, min(limit, 100))
+	before = max(0, min(before, len(history)))
+	start := max(0, before-limit)
+	aligned := false
+	for index := start; index < before; index++ {
+		role, _ := history[index]["role"].(string)
+		if role == "user" {
+			start = index
+			aligned = true
+			break
+		}
+	}
+	for !aligned && start > 0 {
+		start--
+		role, _ := history[start]["role"].(string)
+		aligned = role == "user"
+	}
+	return history[start:before], start, start > 0
+}
+
 func (s *Server) handleChatSessions(w http.ResponseWriter, r *http.Request) {
 	agentID := r.URL.Query().Get("agentId")
 	ag := s.resolveAgent(r, agentID)
```

**File**: `web/src/components/agent-access-gate.tsx` (modified, +16/-9)
```diff
@@ -5,6 +5,10 @@ import { usePathname } from "next/navigation";
 import { Bot } from "lucide-react";
 import { getAgentStatus } from "@/lib/api";
 import { useLocale } from "@/components/locale-provider";
+import {
+  hasRememberedAgentAccess,
+  rememberAgentAccess,
+} from "@/lib/agent-access-cache";
 
 // Pull the agent id straight from the URL. Under output:'export' the
 // HTML served for /agents/agt_xxx/chat/ is actually the prebuilt
@@ -42,30 +46,33 @@ export default function AgentAccessGate({
   const { tr } = useLocale();
   const pathname = usePathname();
   const agentId = agentIdFromPath(pathname);
-  const [state, setState] = useState<"checking" | "ok" | "denied">("checking");
+  const [results, setResults] = useState<Partial<Record<string, "ok" | "denied">>>({});
+  const state: "checking" | "ok" | "denied" =
+    !agentId || agentId === "default" || hasRememberedAgentAccess(agentId)
+      ? "ok"
+      : results[agentId] || "checking";
 
   useEffect(() => {
     // The "default" id is the prebuilt static-export placeholder, not
     // a real agent — skip the probe and let children render. The real
     // /agents/default/* route is super_admin's local-mode dashboard
     // which has its own server-side gating already.
-    if (!agentId || agentId === "default") {
-      setState("ok");
-      return;
-    }
+    if (!agentId || agentId === "default" || hasRememberedAgentAccess(agentId)) return;
     let aborted = false;
-    setState("checking");
     getAgentStatus(agentId)
       .then(({ status, agent }) => {
         if (aborted) return;
         if (status === 200 && agent) {
-          setState("ok");
+          rememberAgentAccess(agentId);
+          setResults((current) => ({ ...current, [agentId]: "ok" }));
           return;
         }
-        setState("denied");
+        setResults((current) => ({ ...current, [agentId]: "denied" }));
       })
       .catch(() => {
-        if (!aborted) setState("denied");
+        if (!aborted) {
+          setResults((current) => ({ ...current, [agentId]: "denied" }));
+        }
       });
     return () => {
       aborted = true;
```

**File**: `web/src/components/app-sidebar.tsx` (modified, +7/-1)
```diff
@@ -50,6 +50,7 @@ import {
   type StatusResponse,
 } from "@/lib/api";
 import { useLocale } from "@/components/locale-provider";
+import { rememberAgentAccess } from "@/lib/agent-access-cache";
 
 // Extract agent ID from pathname like /agents/default/chat/. The second
 // capture is an explicit allow-list of sub-routes so the bare /agents/
@@ -216,11 +217,13 @@ export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
   React.useEffect(() => {
     getAgents()
       .then((list) => {
+        rememberAgentAccess(list.map((agent) => agent.id));
         setAgents(
           list.map((a) => ({
             id: a.id,
             name: a.name,
             model: a.model,
+            description: a.description,
             avatarUrl: a.avatarUrl,
           })),
         );
@@ -256,6 +259,7 @@ export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
           return {
             id: agent.id,
             name: agent.name || agent.id,
+            description: agent.description,
             avatarUrl: agent.avatarUrl,
             preview: latest?.lastMessage || latest?.preview,
             updatedAt: latest?.lastMessageAt || latest?.updatedAt || latest?.createdAt,
@@ -279,6 +283,7 @@ export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
               agents.map((agent) => ({
                 id: agent.id,
                 name: agent.name || agent.id,
+                description: agent.description,
                 avatarUrl: agent.avatarUrl,
               })),
             );
@@ -307,11 +312,12 @@ export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
     getAgent(activeAgentId)
       .then((a) => {
         if (aborted || !a) return;
+        rememberAgentAccess(a.id);
         setAgents((prev) =>
           prev.some((x) => x.id === a.id)
             ? prev
             : [
-                { id: a.id, name: a.name, model: a.model, avatarUrl: a.avatarUrl },
+                { id: a.id, name: a.name, model: a.model, description: a.description, avatarUrl: a.avatarUrl },
                 ...prev,
               ],
         );
```

**File**: `web/src/components/chat-screen.tsx` (modified, +193/-28)
```diff
@@ -1,6 +1,6 @@
 "use client";
 
-import { useEffect, useState, useRef, useCallback, useMemo } from "react";
+import { useEffect, useState, useRef, useCallback, useMemo, useLayoutEffect } from "react";
 import { useRouter, usePathname, useSearchParams } from "next/navigation";
 import { useAgentIdFromURL } from "@/hooks/use-agent-id";
 import { Button } from "@/components/ui/button";
@@ -11,7 +11,7 @@ import { Input } from "@/components/ui/input";
 import { Textarea } from "@/components/ui/textarea";
 import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
 import { createProject, deleteChatSession, fileUrl, getAgent, getAgentKnowledgeFile, getChangedFiles, getChatHistoryWithCursor, getChatSessions, getChatTodo, getMe, getScopePreview, getScopePreviewLogs, getSessionHistory, listAgentFiles, listProjects, renameChatSession, restoreSessionHistory, revealAgentWorkspace, sendChatStream, steerChat, updateAgent, updateProject, uploadAgentFiles, getSkills, type AgentDetail, type ChatHistoryMessage, type ChatStreamEvent, type KnowledgeSource, type ProjectEntry, type ScopePreview, type SkillInfo, type TodoItem, type ToolResultMetadata, type WorkspaceFile, type WorkspaceHistoryEntry } from "@/lib/api";
-import { ArrowLeft, ArrowUp, BookOpen, Brain, Check, ChevronDown, ChevronRight, ChevronsRight, Clock, Code2, Copy, Download, Eye, ExternalLink, File, FileCode, FileText, Film, Folder, FolderOpen, FolderPlus, FolderSearch, Globe2, Image as ImageIcon, Link2, ListChecks, LockKeyhole, MoreHorizontal, Music, PanelLeftClose, PanelLeftOpen, PanelRight, Paperclip, Pencil, Plus, Puzzle, Radio, RefreshCw, RotateCcw, Settings, Share2, ShieldCheck, SlidersHorizontal, Sparkles, Square, SquarePen, Terminal, Trash2, Wrench, X } from "lucide-react";
+import { ArrowLeft, ArrowUp, BookOpen, Brain, Check, ChevronDown, ChevronRight, ChevronUp, ChevronsRight, Clock, Code2, Copy, Download, Eye, ExternalLink, File, FileCode, FileText, Film, Folder, FolderOpen, FolderPlus, FolderSearch, Globe2, Image as ImageIcon, Link2, ListChecks, LockKeyhole, MoreHorizontal, Music, PanelLeftClose, PanelLeftOpen, PanelRight, Paperclip, Pencil, Plus, Puzzle, Radio, RefreshCw, RotateCcw, Settings, Share2, ShieldCheck, SlidersHorizontal, Sparkles, Square, SquarePen, Terminal, Trash2, Wrench, X } from "lucide-react";
 import Link from "next/link";
 import { ChatMarkdown } from "@/components/chat-markdown";
 import type { AgentSettingsTab } from "@/components/agent-settings-dialog";
@@ -188,6 +188,7 @@ interface ChatMessage {
 // outbound text on this marker into separate platform messages; the
 // web UI renders one bubble per split chunk so the experience matches.
 const SPLIT_MARKER = "<|split|>";
+const CHAT_HISTORY_PAGE_SIZE = 20;
 
 // splitOnMarker breaks `s` on SPLIT_MARKER, trims each chunk, and
 // drops the empty ones. Used at render time so a streamed assistant
@@ -324,8 +325,9 @@ function namePastedImage(file: File, pasteId: number, index: number): File {
 }
 
 /** Convert raw history messages into UI ChatMessages, grouping tool calls with results. */
-function buildChatMessages(history: ChatHistoryMessage[]): ChatMessage[] {
+function buildChatMessages(history: ChatHistoryMessage[], historyOffset = 0): ChatMessage[] {
   const msgs: ChatMessage[] = [];
+  const historyId = (index: number) => historyOffset + index;
   let i = 0;
   while (i < history.length) {
     const h = history[i];
@@ -351,7 +353,7 @@ function buildChatMessages(history: ChatHistoryMessage[]): ChatMessage[] {
             channel: h.senderChannel,
           }
         : undefined;
-      msgs.push({ id: `h-${i}`, role: "user", content: h.content || "", timestamp: 0, attachments, sender });
+      msgs.push({ id: `h-${historyId(i)}`, role: "user", content: h.content || "", timestamp: 0, attachments, sender });
       i++;
     } else if (h.role === "assistant" && h.toolCalls && h.toolCalls.length > 0) {
       // Group: assistant tool_calls + following tool results + final assistant content
@@ -390,10 +392,10 @@ function buildChatMessages(history: ChatHistoryMessage[]): ChatMessage[] {
       // block; split, the model's actual answer stands as a first-class
       // reply.
       if (h.content) {
-        msgs.push({ id: `h-pre-${i}`, role: "agent", content: h.content, timestamp: 0, metadata: h.metadata });
+        msgs.push({ id: `h-pre-${historyId(i)}`, role: "agent", content: h.content, timestamp: 0, metadata: h.metadata });
       }
       msgs.push({
-        id: `h-tool-${i}`,
+        id: `h-tool-${historyId(i)}`,
         role: "tool-group",
         content: "",
         timestamp: 0,
@@ -411,11 +413,11 @@ function buildChatMessages(history: ChatHistoryMessage[]): ChatMessage[] {
         history[i].content &&
         !(history[i].toolCalls && history[i].toolCalls!.length > 0)
       ) {
-        msgs.push({ id: `h-${i}`, role: "agent", content: history[i].content || "", timestamp: 0, metadata: history[i].metadata });
+        msgs.push({
```

**File**: `web/src/components/consumer-chat-sidebar.tsx` (modified, +75/-6)
```diff
@@ -2,7 +2,7 @@
 
 import * as React from "react";
 import { useRouter } from "next/navigation";
-import { ChevronsLeft, ChevronsRight, ImagePlus, Plus, Search } from "lucide-react";
+import { ChevronDown, ChevronsLeft, ChevronsRight, ImagePlus, Plus, Search } from "lucide-react";
 import {
   Sidebar,
   SidebarContent,
@@ -30,16 +30,52 @@ import { BotAvatar } from "@/components/bot-avatar";
 import { NavUser } from "@/components/nav-user";
 import { useLocale, type Locale } from "@/components/locale-provider";
 import { apiFetch, createAgent, type MeResponse } from "@/lib/api";
+import { rememberAgentAccess } from "@/lib/agent-access-cache";
 
 export interface ConsumerAgentItem {
   id: string;
   name: string;
+  description?: string;
   preview?: string;
   avatarUrl?: string;
   sessionId?: string;
   updatedAt?: number;
 }
 
+const AGENT_PAGE_SIZE = 20;
+const INLINE_MARKDOWN_TOKEN = /(\*\*[^*\n]+?\*\*|__[^_\n]+?__|~~[^~\n]+?~~|`[^`\n]+?`|\[[^\]\n]+?\]\([^)]+\)|\*[^*\n]+?\*|_[^_\n]+?_)/g;
+
+// Sidebar summaries are deliberately one line, so a full block Markdown
+// renderer would introduce invalid nested controls and list/table layout.
+// Render the inline subset descriptions and message previews actually use,
+// preserving emphasis while keeping links non-interactive inside the row.
+function renderInlineMarkdown(text: string, keyPrefix = "md"): React.ReactNode[] {
+  const normalized = text.replace(/\s*\n+\s*/g, " ").trim();
+  return normalized
+    .split(INLINE_MARKDOWN_TOKEN)
+    .filter(Boolean)
+    .map((part, index) => {
+      const key = `${keyPrefix}-${index}`;
+      if ((part.startsWith("**") && part.endsWith("**")) || (part.startsWith("__") && part.endsWith("__"))) {
+        return <strong key={key}>{renderInlineMarkdown(part.slice(2, -2), key)}</strong>;
+      }
+      if (part.startsWith("~~") && part.endsWith("~~")) {
+        return <del key={key}>{renderInlineMarkdown(part.slice(2, -2), key)}</del>;
+      }
+      if (part.startsWith("`") && part.endsWith("`")) {
+        return <code key={key} className="rounded bg-black/[0.05] px-0.5 font-mono text-[0.92em] dark:bg-white/[0.08]">{part.slice(1, -1)}</code>;
+      }
+      const link = /^\[([^\]]+)\]\([^)]+\)$/.exec(part);
+      if (link) {
+        return <span key={key} className="underline decoration-current/35 underline-offset-2">{renderInlineMarkdown(link[1], key)}</span>;
+      }
+      if ((part.startsWith("*") && part.endsWith("*")) || (part.startsWith("_") && part.endsWith("_"))) {
+        return <em key={key}>{renderInlineMarkdown(part.slice(1, -1), key)}</em>;
+      }
+      return <React.Fragment key={key}>{part}</React.Fragment>;
+    });
+}
+
 function relativeSessionTime(updatedAt: number | undefined, locale: Locale) {
   if (!updatedAt) return "";
   const date = new Date(updatedAt);
@@ -78,19 +114,34 @@ export function ConsumerChatSidebar({
   const { state: sidebarState, toggleSidebar } = useSidebar();
   const { locale, t, tr } = useLocale();
   const [query, setQuery] = React.useState("");
+  const [visibleCount, setVisibleCount] = React.useState(AGENT_PAGE_SIZE);
   const [createOpen, setCreateOpen] = React.useState(false);
 
   const filtered = React.useMemo(() => {
     const q = query.trim().toLocaleLowerCase();
     if (!q) return agents;
     return agents.filter((agent) =>
-      `${agent.name} ${agent.preview || ""}`.toLocaleLowerCase().includes(q),
+      `${agent.name} ${agent.description || ""} ${agent.preview || ""}`.toLocaleLowerCase().includes(q),
     );
   }, [query, agents]);
+  const visibleAgents = React.useMemo(
+    () => filtered.slice(0, visibleCount),
+    [filtered, visibleCount],
+  );
+  const hasMoreAgents = visibleAgents.length < filtered.length;
 
   const openAgent = (agent: ConsumerAgentItem) => {
     const base = `/agents/${encodeURIComponent(agent.id)}/chat/`;
-    router.push(agent.sessionId ? `${base}${encodeURIComponent(agent.sessionId)}/` : base);
+    const target = agent.sessionId ? `${base}${encodeURIComponent(agent.sessionId)}/` : base;
+    // This row came from the caller's authenticated agent list, so the access
+    // gate can safely keep the current shell visible during the route swap.
+    rememberAgentAccess(agent.id);
+    // Dynamic agent ids are served through the static-export fallback. A
+    // router navigation can remount that fallback and briefly replace the
+    // persistent Bot list with its loading state. Next patches pushState into
+    // its reactive router, so this swaps only the active conversation while
+    // the left list stays mounted and visually stable.
+    window.history.pushState(null, "", target);
   };
 
   return (
@@ -143,7 +194,10 @@ export function ConsumerChatSidebar({
             <Search className="pointer-events-none absolute left-2.5 top-1/2 size-[15px] -translate-y-1/2 text-muted-foreground" />
             <input
               value={query}
-              onChange={(event) => setQuery(event.target.value)}

```

**File**: `web/src/components/locale-provider.tsx` (modified, +2/-0)
```diff
@@ -37,6 +37,7 @@ const en = {
   "sidebar.noMatches": "No matching Agents",
   "sidebar.noBots": "No Agents yet",
   "sidebar.manageBots": "Manage Agents",
+  "sidebar.loadMore": "Load more",
   "sidebar.untitledBot": "Untitled Agent",
   "sidebar.greeting": "Hey, I'm {{name}}. What should we start with?",
   "sidebar.quickApi": "API",
@@ -116,6 +117,7 @@ const zhCN: Record<MessageKey, string> = {
   "sidebar.noMatches": "没有匹配的 Agent",
   "sidebar.noBots": "还没有 Agent",
   "sidebar.manageBots": "管理 Agent",
+  "sidebar.loadMore": "加载更多",
   "sidebar.untitledBot": "未命名 Agent",
   "sidebar.greeting": "Hey，我是{{name}}。想先从哪件事开始？",
   "sidebar.quickApi": "API",
```

**File**: `web/src/components/team-switcher.tsx` (modified, +1/-0)
```diff
@@ -78,6 +78,7 @@ export interface AgentSwitcherItem {
   id: string;
   name?: string;
   model?: string;
+  description?: string;
   avatarUrl?: string;
 }
 
```

---

### Incident Patch 15: `9f1e0e35` (2026-09-07)
**Commit Message**: fix chat sidebar recent session experience

**File**: `internal/session/manager.go` (modified, +51/-24)
```diff
@@ -683,8 +683,13 @@ type WebSession struct {
 	ProjectID string `json:"projectId,omitempty"`
 	Title     string `json:"title"`
 	Preview   string `json:"preview"`
-	CreatedAt int64  `json:"createdAt"` // unix ms
-	UpdatedAt int64  `json:"updatedAt"` // unix ms
+	// LastMessage is the most recent user-visible user/assistant message,
+	// independent of Preview (which intentionally remains the opening user
+	// turn and is used as the default conversation title).
+	LastMessage   string `json:"lastMessage,omitempty"`
+	LastMessageAt int64  `json:"lastMessageAt,omitempty"` // unix ms
+	CreatedAt     int64  `json:"createdAt"`               // unix ms
+	UpdatedAt     int64  `json:"updatedAt"`               // unix ms
 	// ThumbnailURL is the first image_url attached to the FIRST user
 	// turn of the session, surfaced so the sidebar can show "image +
 	// text" instead of just the text label for multimodal chats.
@@ -723,9 +728,12 @@ func (m *Manager) ListWebSessions() []WebSession {
 			continue
 		}
 
-		// Read first user message as preview
+		// Read the first user message as the conversation preview, while also
+		// tracking the latest user-visible message for contact-list summaries.
 		preview := ""
 		thumb := ""
+		lastMessage := ""
+		var lastMessageAt int64
 		fh, err := os.Open(f)
 		if err != nil {
 			continue
@@ -742,13 +750,19 @@ func (m *Manager) ListWebSessions() []WebSession {
 				Role         string                 `json:"role"`
 				Content      string                 `json:"content"`
 				ContentParts []provider.ContentPart `json:"content_parts"`
+				Timestamp    int64                  `json:"timestamp"`
+				Origin       string                 `json:"origin"`
 			}
-			if json.Unmarshal(scanner.Bytes(), &msg) != nil || msg.Role != "user" {
+			if json.Unmarshal(scanner.Bytes(), &msg) != nil || msg.Origin != provider.OriginUser {
 				continue
 			}
-			text := msg.Content
+			if msg.Role != "user" && msg.Role != "assistant" {
+				continue
+			}
+
+			text := strings.TrimSpace(msg.Content)
 			img := ""
-			if text == "" {
+			if msg.Role == "user" && text == "" {
 				var parts []string
 				for _, p := range msg.ContentParts {
 					if p.Type == "text" && p.Text != "" {
@@ -757,31 +771,42 @@ func (m *Manager) ListWebSessions() []WebSession {
 				}
 				text = strings.Join(parts, "\n")
 			}
-			text = provider.StripAttachedPrefix(text)
-			for _, p := range msg.ContentParts {
-				if p.Type == "image_url" && p.ImageURL != nil && p.ImageURL.URL != "" {
-					img = p.ImageURL.URL
-					break
+			if msg.Role == "user" {
+				text = provider.StripAttachedPrefix(text)
+				for _, p := range msg.ContentParts {
+					if p.Type == "image_url" && p.ImageURL != nil && p.ImageURL.URL != "" {
+						img = p.ImageURL.URL
+						break
+					}
 				}
 			}
 			if text == "" && img == "" {
 				continue
 			}
-			preview = text
-			if preview == "" {
-				preview = "[image]"
+
+			messagePreview := compactMessagePreview(text)
+			if messagePreview == "" {
+				messagePreview = "[image]"
 			}
-			if len(preview) > 100 {
-				preview = preview[:100] + "..."
+			lastMessage = messagePreview
+			lastMessageAt = msg.Timestamp
+
+			if msg.Role == "user" && preview == "" {
+				preview = messagePreview
+				thumb = img
 			}
-			thumb = img
-			break
 		}
 		fh.Close()
 
 		if preview == "" {
 			continue // skip empty sessions
 		}
+		if lastMessage == "" {
+			lastMessage = preview
+		}
+		if lastMessageAt == 0 {
+			lastMessageAt = info.ModTime().UnixMilli()
+		}
 
 		// Read title from metadata file, fallback to preview
 		title := m.readSessionTitle(sessionId)
@@ -793,12 +818,14 @@ func (m *Manager) ListWebSessions() []WebSession {
 		}
 
 		sessions = append(sessions, WebSession{
-			ID:           sessionId,
-			Title:        title,
-			Preview:      preview,
-			ThumbnailURL: thumb,
-			CreatedAt:    info.ModTime().UnixMilli(),
-			UpdatedAt:    info.ModTime().UnixMilli(),
+			ID:            sessionId,
+			Title:         title,
+			Preview:       preview,
+			LastMessage:   lastMessage,
+			LastMessageAt: lastMessageAt,
+			ThumbnailURL:  thumb,
+			CreatedAt:     info.ModTime().UnixMilli(),
+			UpdatedAt:     info.ModTime().UnixMilli(),
 		})
 	}
 
```

**File**: `internal/session/store_adapter.go` (modified, +56/-0)
```diff
@@ -325,6 +325,13 @@ func (a *StoreAdapter) BuildWebSession(ctx context.Context, m store.SessionMeta)
 	if preview == "" {
 		return nil
 	}
+	lastMessage, lastMessageAt := latestMessagePreview(source)
+	if lastMessage == "" {
+		lastMessage = preview
+	}
+	if lastMessageAt == 0 {
+		lastMessageAt = m.UpdatedAt.UnixMilli()
+	}
 	title := displaySessionTitle(m.Title, m.Key, m.ChatID, preview)
 	return &WebSession{
 		ID:            m.Key,
@@ -334,13 +341,62 @@ func (a *StoreAdapter) BuildWebSession(ctx context.Context, m store.SessionMeta)
 		ProjectID:     m.ProjectID,
 		Title:         title,
 		Preview:       preview,
+		LastMessage:   lastMessage,
+		LastMessageAt: lastMessageAt,
 		ThumbnailURL:  thumb,
 		CreatedAt:     m.UpdatedAt.UnixMilli(),
 		UpdatedAt:     m.UpdatedAt.UnixMilli(),
 		ChatterUserID: m.ChatterUserID,
 	}
 }
 
+// latestMessagePreview returns the newest user-visible message in a session
+// and the timestamp of that same message. Tool rows and runtime-injected
+// prompts are deliberately excluded so contact previews match chat history.
+func latestMessagePreview(source []store.SessionMessage) (string, int64) {
+	for i := len(source) - 1; i >= 0; i-- {
+		msg := source[i]
+		if msg.Origin != provider.OriginUser {
+			continue
+		}
+
+		var text string
+		switch msg.Role {
+		case "assistant":
+			text = msg.Content
+		case "user":
+			text = userText(msg)
+			if text == "" && userImage(msg) != "" {
+				text = "[image]"
+			}
+		default:
+			continue
+		}
+
+		text = compactMessagePreview(text)
+		if text == "" {
+			continue
+		}
+		var timestamp int64
+		if !msg.Timestamp.IsZero() {
+			timestamp = msg.Timestamp.UnixMilli()
+		}
+		return text, timestamp
+	}
+	return "", 0
+}
+
+// compactMessagePreview makes multi-line Markdown suitable for the single-line
+// contact row and caps the API payload without splitting UTF-8 characters.
+func compactMessagePreview(text string) string {
+	text = strings.Join(strings.Fields(text), " ")
+	runes := []rune(text)
+	if len(runes) > 100 {
+		return string(runes[:100]) + "..."
+	}
+	return text
+}
+
 // displaySessionTitle normalizes legacy rows that persisted the opaque
 // session_key as their title.  Treating that value as a real custom title
 // prevents the UI's otherwise-correct title -> preview -> id fallback from
```

**File**: `internal/session/store_adapter_test.go` (modified, +46/-1)
```diff
@@ -1,6 +1,11 @@
 package session
 
-import "testing"
+import (
+	"testing"
+	"time"
+
+	"github.com/fastclaw-ai/fastclaw/internal/store"
+)
 
 func TestDisplaySessionTitle(t *testing.T) {
 	tests := []struct {
@@ -68,3 +73,43 @@ func TestDisplaySessionTitle(t *testing.T) {
 		})
 	}
 }
+
+func TestLatestMessagePreviewUsesNewestVisibleExchangeAndMatchingTime(t *testing.T) {
+	first := time.Date(2026, 9, 7, 10, 0, 0, 0, time.UTC)
+	last := first.Add(2 * time.Minute)
+	messages := []store.SessionMessage{
+		{Role: "user", Content: "hello", Timestamp: first},
+		{Role: "tool", Content: "internal tool output", Timestamp: first.Add(time.Minute)},
+		{Role: "assistant", Content: "  first line\n\nsecond line  ", Timestamp: last},
+		{Role: "user", Content: "hidden goal prompt", Origin: "goal_context", Timestamp: last.Add(time.Minute)},
+	}
+
+	gotText, gotAt := latestMessagePreview(messages)
+	if gotText != "first line second line" {
+		t.Fatalf("latest message = %q, want %q", gotText, "first line second line")
+	}
+	if gotAt != last.UnixMilli() {
+		t.Fatalf("latest message timestamp = %d, want %d", gotAt, last.UnixMilli())
+	}
+}
+
+func TestLatestMessagePreviewFallsBackToImageUserTurn(t *testing.T) {
+	when := time.Date(2026, 9, 7, 10, 0, 0, 0, time.UTC)
+	messages := []store.SessionMessage{
+		{
+			Role: "user",
+			ContentParts: []map[string]any{
+				{"type": "image_url", "image_url": map[string]any{"url": "https://example.com/image.png"}},
+			},
+			Timestamp: when,
+		},
+	}
+
+	gotText, gotAt := latestMessagePreview(messages)
+	if gotText != "[image]" {
+		t.Fatalf("latest message = %q, want [image]", gotText)
+	}
+	if gotAt != when.UnixMilli() {
+		t.Fatalf("latest message timestamp = %d, want %d", gotAt, when.UnixMilli())
+	}
+}
```

**File**: `web/src/app/agents/[id]/chats/page.tsx` (modified, +6/-400)
```diff
@@ -1,402 +1,8 @@
-"use client";
-
-import { useEffect, useMemo, useState } from "react";
-import { useRouter } from "next/navigation";
-import {
-  MessagesSquare,
-  PencilIcon,
-  Trash2,
-  ChevronLeft,
-  ChevronRight,
-} from "lucide-react";
-import { Button } from "@/components/ui/button";
-import { Input } from "@/components/ui/input";
-import { Card, CardContent } from "@/components/ui/card";
-import {
-  Table,
-  TableBody,
-  TableCell,
-  TableHead,
-  TableHeader,
-  TableRow,
-} from "@/components/ui/table";
-import {
-  Dialog,
-  DialogContent,
-  DialogDescription,
-  DialogFooter,
-  DialogHeader,
-  DialogTitle,
-} from "@/components/ui/dialog";
-import {
-  AlertDialog,
-  AlertDialogAction,
-  AlertDialogCancel,
-  AlertDialogContent,
-  AlertDialogDescription,
-  AlertDialogFooter,
-  AlertDialogHeader,
-  AlertDialogTitle,
-} from "@/components/ui/alert-dialog";
-import { useAgentIdFromURL } from "@/hooks/use-agent-id";
-import { useAgentName } from "@/hooks/use-agent-name";
-import {
-  getChatSessions,
-  renameChatSession,
-  deleteChatSession,
-} from "@/lib/api";
-import { ChannelIcon, channelLabel } from "@/components/channel-icon";
-import { useLocale } from "@/components/locale-provider";
-
-type Session = {
-  id: string;
-  channel?: string;
-  accountId?: string;
-  chatId?: string;
-  title?: string;
-  preview: string;
-  thumbnailUrl?: string;
-  createdAt?: number;
-  updatedAt?: number;
-};
-
-const PAGE_SIZE = 20;
-
+// /agents/<aid>/chats — full conversation list in ChatScreen's right panel.
+// The parent agent layout owns the persistent ChatScreen instance; this file
+// only gives Next's static export a route to match. Keeping the route page
+// empty is important: browser-history navigation between /chats and
+// /chat/<session> must never leave a second page tree below the chat canvas.
 export default function AgentChatsPage() {
-  const { locale, tr } = useLocale();
-  const router = useRouter();
-  const agentId = useAgentIdFromURL();
-  const agentName = useAgentName(agentId);
-
-  const [sessions, setSessions] = useState<Session[]>([]);
-  const [error, setError] = useState("");
-  const [page, setPage] = useState(1);
-  const [editTarget, setEditTarget] = useState<Session | null>(null);
-  const [deleteTarget, setDeleteTarget] = useState<Session | null>(null);
-
-  async function refresh() {
-    if (!agentId) return;
-    setError("");
-    try {
-      const list = await getChatSessions(agentId);
-      setSessions(list);
-    } catch (e) {
-      setError(e instanceof Error ? e.message : tr("Failed to load chats", "加载对话失败"));
-    }
-  }
-  useEffect(() => {
-    refresh();
-    // eslint-disable-next-line react-hooks/exhaustive-deps
-  }, [agentId]);
-
-  // Server returns sessions in some order — sort by updatedAt desc here so
-  // the page is deterministic regardless of backend behavior.
-  const sorted = useMemo(
-    () =>
-      [...sessions].sort(
-        (a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0),
-      ),
-    [sessions],
-  );
-
-  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
-  // Clamp the page when sessions shrink below the previous count (e.g.
-  // after deleting the last row on the current page).
-  const safePage = Math.min(page, totalPages);
-  const pageStart = (safePage - 1) * PAGE_SIZE;
-  const pageRows = sorted.slice(pageStart, pageStart + PAGE_SIZE);
-
-  function broadcastChange() {
-    if (typeof window !== "undefined") {
-      window.dispatchEvent(
-        new CustomEvent("fastclaw:sessions-changed", {
-          detail: { agentId },
-        }),
-      );
-    }
-  }
-
-  return (
-    <div className="p-6 space-y-6 max-w-5xl mx-auto">
-      <div className="flex items-center justify-between">
-        <div>
-          <div className="flex items-center gap-2">
-            <MessagesSquare className="size-5 text-muted-foreground" />
-            <h2 className="text-2xl font-semibold tracking-tight">{tr("Chats", "对话")}</h2>
-          </div>
-          <p className="text-sm text-muted-foreground mt-1">
-            {tr("All conversations with {{agent}}.", "与 {{agent}} 的全部对话。", {
-              agent: agentName || tr("this agent", "此 Agent"),
-            })}
-          </p>
-        </div>
-      </div>
-
-      {error && (
-        <Card className="border-destructive/40 bg-destructive/5">
-          <CardContent className="pt-6">
-            <p className="text-sm text-destructive">{error}</p>
-          </CardContent>
-        </Card>
-      )}
-
-      {sorted.length === 0 ? (
-        <div className="rounded-lg border border-border bg-card">
-          <div className="flex flex-col items-center justify-center py-16">
-            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
-              <MessagesSquare className="h-7 w-7 text-primary" />
-            </div>
-            <p className="text-sm text-muted-foreground mb-1">
-              {tr(
```

**File**: `web/src/app/agents/[id]/layout-client.tsx` (modified, +5/-4)
```diff
@@ -5,7 +5,7 @@ import AgentAccessGate from "@/components/agent-access-gate";
 import { ChatScreen } from "@/components/chat-screen";
 
 // AgentLayoutClient owns the single ChatScreen instance for everything
-// under /agents/<id>/{chat,project}. Previously each chat route
+// under /agents/<id>/{chat,project,chats}. Previously each chat route
 // segment (chat/, chat/[session], project/[pid]) rendered its own
 // <ChatScreen/>, so navigating between sidebar links unmounted and
 // remounted the whole chat surface — losing scroll, blanking messages,
@@ -26,13 +26,14 @@ function isChatRoute(pathname: string, agentId: string): boolean {
   if (!agentId) return false;
   const base = `/agents/${agentId}`;
   if (pathname === base || pathname === `${base}/`) return true;
-  // Match `/chat` (with or without trailing segments) but NOT `/chats` —
-  // the chats list is a sibling route that must render on its own,
-  // without ChatScreen sitting underneath it.
+  // Keep legacy `/chats` URLs inside the persistent chat shell. The current
+  // UI expands recent conversations in place instead of navigating there.
   const tail = pathname.slice(base.length);
   return (
     tail === "/chat" ||
     tail.startsWith("/chat/") ||
+    tail === "/chats" ||
+    tail === "/chats/" ||
     tail === "/project" ||
     tail.startsWith("/project/")
   );
```

**File**: `web/src/components/app-sidebar.tsx` (modified, +18/-5)
```diff
@@ -145,6 +145,7 @@ export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
   const [me, setMe] = React.useState<MeResponse | null>(null);
   const [agents, setAgents] = React.useState<AgentSwitcherItem[]>([]);
   const [consumerAgents, setConsumerAgents] = React.useState<ConsumerAgentItem[]>([]);
+  const [consumerAgentsLoading, setConsumerAgentsLoading] = React.useState(true);
   // role flag per agent the caller can see — owner vs viewer (read-only
   // shared from another user). Drives whether the AGENT_NAV exposes
   // configuration tabs.
@@ -242,25 +243,35 @@ export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
     }
 
     let aborted = false;
+    setConsumerAgentsLoading(true);
     const refresh = () => {
       Promise.all(
         agents.map(async (agent) => {
           const list = await getChatSessions(agent.id).catch(() => []);
           const latest = [...list].sort(
-            (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0),
+            (a, b) =>
+              (b.lastMessageAt || b.updatedAt || b.createdAt || 0) -
+              (a.lastMessageAt || a.updatedAt || a.createdAt || 0),
           )[0];
           return {
             id: agent.id,
             name: agent.name || agent.id,
             avatarUrl: agent.avatarUrl,
-            preview: latest?.preview,
-            updatedAt: latest?.updatedAt || latest?.createdAt,
+            preview: latest?.lastMessage || latest?.preview,
+            updatedAt: latest?.lastMessageAt || latest?.updatedAt || latest?.createdAt,
             sessionId: latest?.id,
           } satisfies ConsumerAgentItem;
         }),
       )
         .then((items) => {
-          if (!aborted) setConsumerAgents(items);
+          if (!aborted) {
+            setConsumerAgents(
+              [...items].sort(
+                (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
+              ),
+            );
+            setConsumerAgentsLoading(false);
+          }
         })
         .catch(() => {
           if (!aborted) {
@@ -271,6 +282,7 @@ export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
                 avatarUrl: agent.avatarUrl,
               })),
             );
+            setConsumerAgentsLoading(false);
           }
         });
     };
@@ -405,14 +417,15 @@ export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
 
   const isConsumerChat =
     !!activeAgentId &&
-    /^\/agents\/[^/]+\/(chat|project)(?:\/|$)/.test(pathname);
+    /^\/agents\/[^/]+\/(chat|project|chats)(?:\/|$)/.test(pathname);
 
   if (isConsumerChat && activeAgentId) {
     return (
       <>
         <ConsumerChatSidebar
           activeAgentId={activeAgentId}
           agents={consumerAgents}
+          loading={consumerAgentsLoading}
           me={me}
         />
         <AgentSettingsDialog
```

**File**: `web/src/components/channel-icon.tsx` (modified, +3/-4)
```diff
@@ -11,10 +11,9 @@ const ASSETS: Record<string, string> = {
 };
 
 // ChannelIcon renders the per-channel brand mark next to a chat title.
-// Returns null for web / unknown channels — web is the default place a
-// chat lives in this UI, so a generic globe glyph next to every web
-// session adds noise without information. IM rows still get their
-// brand mark to disambiguate.
+// Web / legacy / unknown channels intentionally return null: a plain web
+// conversation needs no decorative prefix. Callers can still replace it
+// with an image thumbnail when the web chat actually contains media.
 //
 // Images carry their own colors; we don't apply a text-* class. WeChat's
 // source artwork is non-square (50×40) — object-contain letterboxes it
```

**File**: `web/src/components/chat-screen.tsx` (modified, +146/-37)
```diff
@@ -106,7 +106,7 @@ function renderContentWithDataImages(
 
 import { usePageHeader } from "@/components/sidebar";
 import { useSidebarOptional } from "@/components/ui/sidebar";
-import { channelLabel } from "@/components/channel-icon";
+import { ChannelIcon, channelLabel } from "@/components/channel-icon";
 import { BotAvatar } from "@/components/bot-avatar";
 import { useLocale, type Locale, type MessageKey } from "@/components/locale-provider";
 
@@ -288,6 +288,7 @@ interface ChatSession {
   preview: string;
   createdAt?: number;
   updatedAt?: number;
+  thumbnailUrl?: string;
   // channel/accountId/chatId travel with the listing so the chat
   // page can decide whether composing into this session is allowed
   // (only `web` is — IM channels have no reverse-send path).
@@ -587,6 +588,7 @@ export function ChatScreen() {
   const pathname = usePathname();
   const searchParams = useSearchParams();
   const { locale, t, tr } = useLocale();
+  const isChatsPage = /^\/agents\/[^/]+\/chats\/?$/.test(pathname || "");
   // When `?actAs=<uid>` is in the URL, this chat is being opened by a
   // super_admin viewing another user's session (read-only by middleware).
   // Forces the composer into a disabled state and surfaces a banner so
@@ -597,6 +599,12 @@ export function ChatScreen() {
     () => parseAgentRoute(pathname || ""),
     [pathname],
   );
+  // A Chats route can be reconstructed by the static-export router even
+  // though it visually behaves like a right-panel view. Carry the active
+  // session in the query so the central conversation can be restored after
+  // that reconstruction instead of falling back to a fresh welcome screen.
+  const chatsSessionId = isChatsPage ? searchParams?.get("session") || "" : "";
+  const routeSessionId = urlSessionId || chatsSessionId;
   // Reactive: re-derives from pathname so switching agents (sidebar
   // dropdown, browser back/forward) immediately updates downstream
   // fetches. The previous useState(() => ...) flavor froze the id at
@@ -607,7 +615,7 @@ export function ChatScreen() {
   const [agentDetail, setAgentDetail] = useState<AgentDetail | null>(null);
   const [projects, setProjects] = useState<ProjectEntry[]>([]);
   const [sessionId, setSessionId] = useState<string>(
-    () => urlSessionId || generateSessionId(),
+    () => routeSessionId || generateSessionId(),
   );
   const [sessions, setSessions] = useState<ChatSession[]>([]);
   const [messages, setMessages] = useState<ChatMessage[]>([]);
@@ -787,6 +795,11 @@ export function ChatScreen() {
   // keeps the gate honest if sessionId changes again before history
   // catches up.
   const [loadedSessionId, setLoadedSessionId] = useState<string | null>(null);
+  const isConversationLoading = Boolean(
+    selectedAgent
+      && routeSessionId
+      && (routeSessionId !== sessionId || loadedSessionId !== routeSessionId),
+  );
 
   // Slash-command menu state. The menu opens when the textarea holds a
   // token beginning with `/` at the caret; selecting a skill swaps that
@@ -1178,31 +1191,34 @@ export function ChatScreen() {
   // fetch is in flight.
   const prevHadSessionRef = useRef(false);
   useEffect(() => {
-    if (urlSessionId) {
+    if (routeSessionId) {
       prevHadSessionRef.current = true;
-      if (urlSessionId !== sessionId) {
-        resetTodoScope(selectedAgent, urlSessionId);
-        setSessionId(urlSessionId);
+      if (routeSessionId !== sessionId) {
+        resetTodoScope(selectedAgent, routeSessionId);
+        setSessionId(routeSessionId);
         setMessages([]);
       }
       return;
     }
+    // `/chats` with no selected session only replaces the right-side panel.
+    // Do not mint a new central conversation while that route is active.
+    if (isChatsPage) return;
     if (prevHadSessionRef.current) {
       prevHadSessionRef.current = false;
       const nextSessionId = generateSessionId();
       resetTodoScope(selectedAgent, nextSessionId);
       setSessionId(nextSessionId);
       setMessages([]);
     }
-  }, [urlSessionId, sessionId, selectedAgent, resetTodoScope]);
+  }, [isChatsPage, routeSessionId, sessionId, selectedAgent, resetTodoScope]);
 
   // Switching conversations (sidebar chat click, New chat, opening a project)
   // changes the URL ids — close the workspace panel so the previous chat's
   // files don't linger over a different conversation. Keyed on the URL ids,
   // not every render, so the user can still re-open it within the SAME chat.
   useEffect(() => {
     setFilesSheetOpen(false);
-  }, [urlSessionId, urlProjectId]);
+  }, [routeSessionId, urlProjectId]);
 
   // Channel of the currently-open session, derived from the sessions
   // list. Brand-new web chats don't have a row yet — the fallback to
@@ -1219,7 +1235,7 @@ export function ChatScreen() {
   const isReadOnlyChannel = currentChannel !== "web";
   const isReadOnlyView = isReadOnlyChannel || isActAsView;
   const inputIsReadOnlySafeSlashCommand = isReadOnl
```

#### Recent Merged Pull Requests:
- **PR #124** (2026-10-05): docs(sandbox): cross-pod E2B lease registry — stop duplicate sandbox creation across pods (@mengmengmengqiang)
- **PR #115** (closed): fix: fall back to execCommand for clipboard on insecure origins (@pengzh1)
- **PR #114** (closed): fix: maintain Mcp-Session-Id across MCP HTTP requests (@pengzh1)
- **PR #113** (closed): fix: handle SSE responses and send Accept header in MCP HTTP client (@pengzh1)
- **PR #112** (closed): fix: accept SSE data lines without a space after the colon (@pengzh1)
- **PR #109** (closed): Feat/wire spawn subagent (@M0yuW)
- **PR #104** (2026-07-21): fix: before_model_call hook messages modification not taking effect (#103) (@cxxCoolStar)
- **PR #102** (2026-07-21): fix(setup): resolve masked skill secrets to stored originals on confi… (@cxxCoolStar)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
