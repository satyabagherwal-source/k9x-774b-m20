# Forensic Learning Record (Deep Inspection): trpc-group/trpc-agent-go

> **Canonical Artifact**: `07_PROJECT_LEARNING/trpc-group-trpc-agent-go-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/trpc-group/trpc-agent-go](https://github.com/trpc-group/trpc-agent-go))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:11:33.898Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `trpc-group/trpc-agent-go`
- **Description**: A Go framework for building production agent systems with graph workflows, tools, memory, A2A, AG-UI, MCP, evaluation, and observability.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 1845 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agent/extension/goal/state.go`
```
//
// Tencent is pleased to support the open source community by making trpc-agent-go available.
//
// Copyright (C) 2025 Tencent.  All rights reserved.
//
// trpc-agent-go is licensed under the Apache License Version 2.0.
//
//

package goal

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"trpc.group/trpc-go/trpc-agent-go/agent"
	"trpc.group/trpc-go/trpc-agent-go/session"
)

const (
	stateKeyRetryCount      = "goal:retry_count"
	stateKeyReminderPending = "goal:reminder_pending"
)

// GoalStatus is the persisted status of a session goal.
type GoalStatus string

const (
	// GoalStatusActive means the goal still needs work.
	GoalStatusActive GoalStatus = "active"
	// GoalStatusBlocked means progress depends on external input.
	GoalStatusBlocked GoalStatus = "blocked"
	// GoalStatusComplete means the objective has been achieved.
	GoalStatusComplete GoalStatus = "complete"
)

// Goal is a session-scoped objective.
type Goal struct {
	ID             string     `json:"id"`
	Objective      string     `json:"objective"`
	Status         GoalStatus `json:"status"`
	CreatedAtUnix  int64      `json:"created_at_unix"`
	UpdatedAtUnix  int64      `json:"updated_at_unix"`
	TerminalAtUnix *int64     `json:"terminal_at_unix,omitempty"`
}

// NewActiveGoal constructs an active goal.
func NewActiveGoal(objective string) (*Goal, error) {
	objective = strings.TrimSpace(objective)
	if objective == "" {
		return nil, errors.New("goal objective is required")
	}
	now := time.Now().UTC().Unix()
	return &Goal{
		ID:            uuid.NewString(),
		Objective:     objective,
		Status:        GoalStatusActive,
		CreatedAtUnix: now,
		UpdatedAtUnix: now,
	}, nil
}

// GetGoal reads the default goal state from sess.
func GetGoal(sess *session.Session) (*Goal, bool, error) {
	return GetGoalWithStateKey(sess, DefaultStateKey)
}

// GetGoalWithStateKey reads goal state from sess using stateKey.
func GetGoalWithStateKey(sess *session.Session, stateKey string) (*Goal, bool, error) {
	if sess == nil {
		return nil, false, nil
	}
	if stateKey == "" {
		stateKey = DefaultStateKey
	}
	raw, ok := sess.GetState(stateKey)
	if !ok || len(bytes.TrimSpace(raw)) == 0 || bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
		return nil, false, nil
	}
	var g Goal
	if err := json.Unmarshal(raw, &g); err != nil {
		return nil, false, fmt.Errorf("goal: decode state: %w", err)
	}
	if g.ID == "" || g.Status == "" {
		return nil, false, nil
	}
	return &g, true, nil
}

// Start creates or replaces the goal in session state for an existing session.
// Applications can use this from their own command layer, for example after
// parsing "/goal ...".
func Start(
	ctx context.Context,
	service session.Service,
	key session.Key,
	objective string,
	options ...StartOption,
) (*Goal, error) {
	if service == nil {
		return nil, errors.New("goal: session service is required")
	}
	if err := key.CheckSessionKey(); err != nil {
		return nil, err
	}
	cfg := startOptions{stateKey: DefaultStateKey}
	for _, opt := range options {
		if opt != nil {
			opt(&cfg)
		}
	}
	g, err := NewActiveGoal(objective)
	if err != nil {
		return nil, err
	}
	raw, err := encodeGoal(g)
	if err != nil {
		return nil, err
	}
	state := session.StateMap{cfg.stateKey: raw}
	sess, getErr := service.GetSession(ctx, key)
	if getErr != nil {
		return nil, getErr
	}
	if sess != nil {
		sess.SetState(cfg.stateKey, raw)
		return g, service.UpdateSessionState(ctx, key, state)
	}
	if _, err := service.CreateSession(ctx, key, state); err != nil {
		return nil, err
	}
	return g, nil
}

type startOptions struct {
	stateKey string
}

// StartOption configures Start.
type StartOption func(*startOptions)

// WithStartStateKey sets the state key used by Start.
func WithStartStateKey(key string) StartOption {
	return func(o *startOptions) {
		if key != "" {
			o.stateKey = key
		}
	}
}

func encodeGoal(g *Goal) ([]byte, error) {
	if g == nil {
		return []byte("null"), nil
	}
	raw, err := json.Marshal(g)
	if err != nil {
		return nil, fmt.Errorf("goal: encode state: %w", err)
	}
	return raw, nil
}

func writeGoalToSession(sess *session.Session, stateKey string, g *Goal) error {
	if sess == nil {
		return errors.New("goal: invocation session is required")
	}
	raw, err := encodeGoal(g)
	if err != nil {
		return err
	}
	sess.SetState(stateKey, raw)
	return nil
}

func retryCount(inv *agent.Invocation) int {
	if inv == nil {
		return 0
	}
	v, _ := agent.GetStateValue[int](inv, stateKeyRetryCount)
	return v
}

func incRetryCount(inv *agent.Invocation) int {
	if inv == nil {
		return 0
	}
	n := retryCount(inv) + 1
	inv.SetState(stateKeyRetryCount, n)
	return n
}

func resetRetryCount(inv *agent.Invocation) {
	if inv == nil {
		return
	}
	inv.DeleteState(stateKeyRetryCount)
}

func reminderPending(inv *agent.Invocation) bool {
	if inv == nil {
		return false
	}
	v, _ := agent.GetStateValue[bool](inv, stateKeyReminderPending)
	return v
}

func setReminderPending(inv *agent.Invocation, pending bool) {
	if inv == nil {
		return
	}
	if pending {
		inv.SetState(stateKeyReminderPending, true)
		return
	}
	inv.DeleteState(stateKeyReminderPending)
}

```

### Core Architecture Module: `agent/extension/todoenforcer/state.go`
```
//
// Tencent is pleased to support the open source community by making trpc-agent-go available.
//
// Copyright (C) 2025 Tencent.  All rights reserved.
//
// trpc-agent-go is licensed under the Apache License Version 2.0.
//
//

package todoenforcer

import "trpc.group/trpc-go/trpc-agent-go/agent"

// Invocation-state keys owned by todoenforcer.
//
// All keys live on agent.Invocation (set via inv.SetState, read
// via agent.GetStateValue) so that retries and blocker
// declarations are strictly per-run. Concurrent runs that happen
// to share a Session each get their own Invocation and therefore
// their own counter and flags. The keys are namespaced under
// "todoenforcer:" to stay easy to grep for and to prevent
// collisions with other extensions.
//
// All entries here die with the Invocation that owns them. When
// the user submits a follow-up turn the runner constructs a fresh
// Invocation, so a previously declared blocker does NOT carry
// over — the model gets a clean slate to attempt the work again
// once the missing precondition has been supplied.
const (
	// stateKeyRetryCount counts how many times AfterModel has
	// blocked a final response on the current invocation. Bounded
	// by Options.MaxRetries.
	stateKeyRetryCount = "todoenforcer:retry_count"

	// stateKeyReminderPending is set by AfterModel when a response
	// is blocked, and consumed by BeforeModel on the next turn to
	// trigger nudge-injection.
	stateKeyReminderPending = "todoenforcer:reminder_pending"

	// stateKeyBlockerDeclared latches to true once
	// todo_declare_blocker has been invoked. Subsequent final
	// responses on this invocation are then allowed through
	// regardless of the open-items state — the model has formally
	// signalled that it cannot make further progress without
	// user-supplied input, and forcing it back into the loop
	// would be exactly the bullying behaviour this extension is
	// designed to avoid.
	stateKeyBlockerDeclared = "todoenforcer:blocker_declared"

	// stateKeyBlockerReason holds the operator-readable reason
	// the model supplied to todo_declare_blocker. Surfaced
	// through EnforceEvent.BlockerReason for OnEnforce observers
	// and kept on the invocation for trace-export consumers.
	stateKeyBlockerReason = "todoenforcer:blocker_reason"
)

// retryCount returns the current counter (0 if unset / nil inv).
func retryCount(inv *agent.Invocation) int {
	if inv == nil {
		return 0
	}
	v, _ := agent.GetStateValue[int](inv, stateKeyRetryCount)
	return v
}

// incRetryCount increments and returns the new value. Inlining
// the read avoids a separate Get → Set round-trip and keeps the
// AfterModel hot path small.
func incRetryCount(inv *agent.Invocation) int {
	if inv == nil {
		return 0
	}
	n := retryCount(inv) + 1
	inv.SetState(stateKeyRetryCount, n)
	return n
}

// resetRetryCount zeroes the counter. Called whenever the
// retry budget is fully consumed (fail-open path) so that any
// downstream code that re-reads the counter sees a stable
// "no enforcement attempts pending" value. The Invocation itself
// will be discarded shortly afterwards, so this is mostly for
// observability cleanliness rather than correctness.
func resetRetryCount(inv *agent.Invocation) {
	if inv == nil {
		return
	}
	inv.DeleteState(stateKeyRetryCount)
}

// reminderPending reports whether AfterModel asked the next
// BeforeModel to inject a nudge.
func reminderPending(inv *agent.Invocation) bool {
	if inv == nil {
		return false
	}
	v, _ := agent.GetStateValue[bool](inv, stateKeyReminderPending)
	return v
}

// setReminderPending sets / clears the flag. We DeleteState on
// false rather than writing a zero value so introspection tools
// see "no key" instead of "key set to false" — slightly less
// noisy in trace dumps.
func setReminderPending(inv *agent.Invocation, pending bool) {
	if inv == nil {
		return
	}
	if pending {
		inv.SetState(stateKeyReminderPending, true)
		return
	}
	inv.DeleteState(stateKeyReminderPending)
}

// blockerDeclared reports whether todo_declare_blocker has been
// called on this invocation.
func blockerDeclared(inv *agent.Invocation) bool {
	if inv == nil {
		return false
	}
	v, _ := agent.GetStateValue[bool](inv, stateKeyBlockerDeclared)
	return v
}

// markBlockerDeclared latches the flag and stores the reason
// atomically from the caller's viewpoint (two SetState calls,
// but the AfterModel decision tree only inspects the flag and
// reason in strict order so a torn read is safe).
func markBlockerDeclared(inv *agent.Invocation, reason string) {
	if inv == nil {
		return
	}
	inv.SetState(stateKeyBlockerDeclared, true)
	inv.SetState(stateKeyBlockerReason, reason)
}

// blockerReason returns the stored reason, or "" when no blocker
// has been declared on this invocation.
func blockerReason(inv *agent.Invocation) string {
	if inv == nil {
		return ""
	}
	v, _ := agent.GetStateValue[string](inv, stateKeyBlockerReason)
	return v
}

```

### Core Architecture Module: `agent/extension/toolpipe/engine.go`
```
//
// Tencent is pleased to support the open source community by making trpc-agent-go available.
//
// Copyright (C) 2025 Tencent.  All rights reserved.
//
// trpc-agent-go is licensed under the Apache License Version 2.0.
//
//

package toolpipe

import (
	"bytes"
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"mvdan.cc/sh/v3/syntax"
)

// Engine parses and executes filter expressions against tool output.
// It validates that only allowed operations are used and enforces
// size and timeout limits.
type Engine struct {
	cfg *config
}

// NewEngine creates a filter engine with the given configuration.
func NewEngine(cfg *config) *Engine {
	return &Engine{cfg: cfg}
}

// Apply parses the filter expression and applies it to the tool result.
func (e *Engine) Apply(ctx context.Context, result any, filterExpr string) (*ToolResult, error) {
	if filterExpr == "" {
		return &ToolResult{
			Content: resultToString(result),
		}, nil
	}

	pipeline, err := e.parse(filterExpr)
	if err != nil {
		return nil, fmt.Errorf("parse filter: %w", err)
	}

	return e.applyPipeline(ctx, result, pipeline)
}

// applyPipeline executes a pre-parsed pipeline against a tool result.
func (e *Engine) applyPipeline(ctx context.Context, result any, pipeline *Pipeline) (*ToolResult, error) {
	input := resultToString(result)
	inputTotalBytes := len(input)

	// Enforce max input size (UTF-8 safe).
	inputTruncated := false
	if e.cfg.maxInput > 0 && int64(len(input)) > e.cfg.maxInput {
		input = truncateUTF8(input, int(e.cfg.maxInput))
		inputTruncated = true
	}

	// Apply pipeline with timeout.
	execCtx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	output, err := pipeline.Execute(execCtx, input)
	if err != nil {
		return nil, fmt.Errorf("execute filter: %w", err)
	}

	truncated := false
	totalFilteredBytes := len(output)
	if e.cfg.maxOutput > 0 && int64(len(output)) > e.cfg.maxOutput {
		output = windowOutput(output, int(e.cfg.maxOutput))
		truncated = true
	}

	tr := &ToolResult{
		Filter:    pipeline.expr,
		Truncated: truncated,
		Content:   output,
	}
	if truncated {
		tr.TotalBytes = totalFilteredBytes
	}
	if inputTruncated {
		tr.InputTruncated = true
		tr.InputTotalBytes = inputTotalBytes
	}
	return tr, nil
}

// Pipeline is a sequence of operations parsed from a shell-like expression.
type Pipeline struct {
	Ops  []Op
	expr string // original filter expression for metadata
}

// Execute runs the pipeline over input sequentially.
func (p *Pipeline) Execute(ctx context.Context, input string) (string, error) {
	current := input
	for _, op := range p.Ops {
		select {
		case <-ctx.Done():
			return "", ctx.Err()
		default:
		}
		var err error
		current, err = op.Apply(ctx, current)
		if err != nil {
			return "", err
		}
	}
	return current, nil
}

// parse uses mvdan.cc/sh/v3/syntax to parse the filter expression,
// then validates and converts it to our internal Pipeline.
func (e *Engine) parse(expr string) (*Pipeline, error) {
	reader := strings.NewReader(expr)
	parser := syntax.NewParser()
	file, err := parser.Parse(reader, "filter")
	if err != nil {
		return nil, fmt.Errorf("shell parse error: %w", err)
	}

	if len(file.Stmts) == 0 {
		return nil, fmt.Errorf("empty filter expression")
	}
	if len(file.Stmts) > 1 {
		return nil, fmt.Errorf("only single pipeline expressions are supported, got %d statements", len(file.Stmts))
	}

	stmt := file.Stmts[0]

	// Reject redirections.
	if len(stmt.Redirs) > 0 {
		return nil, fmt.Errorf("redirections are not allowed in filter expressions")
	}

	// Reject background, negation, coprocess — these are shell execution
	// modifiers that have no meaning in our filter DSL.
	if stmt.Negated {
		return nil, fmt.Errorf("negation (!) is not allowed in filter expressions")
	}
	if stmt.Background {
		return nil, fmt.Errorf("background (&) is not allowed in filter expressions")
	}
	if stmt.Coprocess {
		return nil, fmt.Errorf("coprocess is not allowed in filter expressions")
	}

	// The command must be a pipeline (or single call command).
	var calls []*syntax.CallExpr
	switch cmd := stmt.Cmd.(type) {
	case *syntax.CallExpr:
		calls = append(calls, cmd)
	case *syntax.BinaryCmd:
		if cmd.Op != syntax.Pipe {
			return nil, fmt.Errorf("only pipe (|) operator is allowed, got %v", cmd.Op)
		}
		collected, err := collectPipelineCalls(cmd)
		if err != nil {
			return nil, err
		}
		calls = collected
	default:
		return nil, fmt.Errorf("unsupported command type %T; only simple commands and pipes are allowed", cmd)
	}

	// Limit pipeline length.
	if len(calls) > 10 {
		return nil, fmt.Errorf("pipeline too long: %d stages (max 10)", len(calls))
	}

	ops := make([]Op, 0, len(calls))
	for _, call := range calls {
		op, err := e.callToOp(call)
		if err != nil {
			return nil, err
		}
		ops = append(ops, op)
	}
	return &Pipeline{Ops: ops, expr: expr}, nil
}

// collectPipelineCalls recursively collects CallExpr nodes from a
// BinaryCmd pipeline tree.
func collectPipelineCalls(bin *syntax.BinaryCmd) ([]*syntax.CallExpr, error) {
	var result []*syntax.CallExpr

	// Left side.
	switch left := bin.X.Cmd.(type) {
	case *syntax.CallExpr:
		result = append(result, left)
	case *syntax.BinaryCmd:
		if left.Op != syntax.Pipe {
			return nil, fmt.Errorf("only pipe (|) operator is allowed")
		}
		sub, err := collectPipelineCalls(left)
		if err != nil {
			return nil, err
		}
		result = append(result, sub...)
	default:
		return nil, fmt.Errorf("unsupported command type %T in pipeline", left)
	}

	// Right side.
	switch right := bin.Y.Cmd.(type) {
	case *syntax.CallExpr:
		result = append(result, right)
	case *syntax.BinaryCmd:
		if right.Op != syntax.Pipe {
			return nil, fmt.Errorf("only pipe (|) operator is allowed")
		}
		sub, err := collectPipelineCalls(right)
		if err != nil {
			return nil, err
		}
		result = append(result, sub...)
	default:
		return nil, fmt.Errorf("unsupported command type %T in pipeline", right)
	}
	return result, nil
}

// callToOp converts a parsed shell CallExpr into an internal Op.
func (e *Engine) callToOp(call *syntax.CallExpr) (Op, error) {
	if len(call.Args) == 0 {
		return nil, fmt.Errorf("empty command in pipeline")
	}

	// Reject assignments and redirections at call level.
	if len(call.Assigns) > 0 {
		return nil, fmt.Errorf("variable assignments are not allowed")
	}

	// Extract command name and arguments.
	parts := make([]string, 0, len(call.Args))
	for _, word := range call.Args {
		s, err := wordToString(word)
		if err != nil {
			return nil, err
		}
		parts = append(parts, s)
	}

	cmdName := parts[0]
	cmdArgs := parts[1:]

	opType := OpType(cmdName)
	if !e.cfg.allowedOps[opType] {
		return nil, fmt.Errorf("operation %q is not allowed; allowed: %s", cmdName, e.allowedOpsString())
	}

	switch opType {
	case OpGrep:
		return parseGrepOp(cmdArgs)
	case OpHead:
		return parseHeadOp(cmdArgs)
	case OpTail:
		return parseTailOp(cmdArgs)
	case OpJQ:
		return parseJQOp(cmdArgs)
	default:
		return nil, fmt.Errorf("unknown operation: %q", cmdName)
	}
}

// wordToString converts a syntax.Word to a plain string.
// Returns an error for unsupported shell constructs (variable expansion,
// command substitution, process substitution, etc.) — fail closed.
func wordToString(word *syntax.Word) (string, error) {
	var buf bytes.Buffer
	for _, part := range word.Parts {
		switch p := part.(type) {
		case *syntax.Lit:
			buf.WriteString(p.Value)
		case *syntax.SglQuoted:
			buf.WriteString(p.Value)
		case *syntax.DblQuoted:
			for _, sub := range p.Parts {
				switch s := sub.(type) {
				case *syntax.Lit:
					buf.WriteString(s.Value)
				default:
					return "", fmt.Errorf("unsupported shell construct in double-quoted string: %T", sub)
				}
			}
		default:
			return "", fmt.Errorf("unsupported shell construct: %T (only literals and quoted strings are allowed)", part)
		}
	}
	return buf.String(), nil
}

func (e *Engine) allowedOpsString() string {
	ops := make([]string, 0, len(e.cfg.allowedOps))
	for op := range e.cfg.allowedOps {
		ops = append(ops, string(op))
	}
	sort.Strings(ops)
	return strings.Join(ops, ", ")
}

// windowOutput applies head+tail windowing to output that exceeds maxBytes.
// The marker is included in the budget so the total content never exceeds maxBytes.
func windowOutput(content string, maxBytes int) string {
	// The marker format is "\n\n...(NNNNN bytes omitted)...\n\n".
	// Max realistic omitted count is ~10 digits. Marker overhead ≈ 38 chars.
	// Use a conservative estimate; post-verify and trim if needed.
	markerOverhead := len("\n\n...(1234567890 bytes omitted)...\n\n") // 38
	if maxBytes <= markerOverhead*2 {
		// Extremely small budget — just prefix-truncate.
		return truncateUTF8(content, maxBytes)
	}

	usable := maxBytes - markerOverhead
	headBudget := usable / 2
	tailBudget := usable - headBudget

	head := truncateUTF8(content, headBudget)
	tail := content[len(content)-tailBudget:]
	// Ensure tail starts at a UTF-8 boundary.
	for len(tail) > 0 && !isRuneStart(tail[0]) {
		tail = tail[1:]
	}

	omitted := len(content) - len(head) - len(tail)
	middle := fmt.Sprintf("\n\n...(%d bytes omitted)...\n\n", omitted)
	result := head + middle + tail

	// Post-verify: if actual marker was longer than estimate, trim tail from
	// its FRONT (not back) to preserve the "end of output" semantics.
	// Loop until within budget (marker digit count may shift on each iteration).
	for len(result) > maxBytes {
		excess := len(result) - maxBytes
		newTailLen := len(tail) - excess
		if newTailLen <= 0 {
			tail = ""
		} else {
			tail = suffixUTF8(tail, newTailLen)
		}
		omitted = len(content) - len(head) - len(tail)
		middle = fmt.Sprintf("\n\n...(%d bytes omitted)...\n\n", omitted)
		result = head + middle + tail
	}
	return result
}

```

### Core Architecture Module: `evaluation/evaluator/llm/operator/responsescorer/boolean/boolean.go`
```
//
// Tencent is pleased to support the open source community by making trpc-agent-go available.
//
// Copyright (C) 2025 Tencent.  All rights reserved.
//
// trpc-agent-go is licensed under the Apache License Version 2.0.
//

// Package boolean scores JSON judge outputs shaped as {passed, reason}.
package boolean

import (
	"context"
	"fmt"

	"trpc.group/trpc-go/trpc-agent-go/evaluation/evaluator"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/evaluator/llm/operator/responsescorer"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/evaluator/llm/operator/responsescorer/internal/responsejson"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/metric"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/score"
	"trpc.group/trpc-go/trpc-agent-go/model"
)

type booleanResponse struct {
	Passed *bool   `json:"passed"`
	Reason *string `json:"reason"`
}

type booleanResponseScorer struct {
}

// New returns a response scorer for boolean JSON outputs.
func New() responsescorer.ResponseScorer {
	return &booleanResponseScorer{}
}

// ScoreBasedOnResponse parses the structured judge response.
func (s *booleanResponseScorer) ScoreBasedOnResponse(ctx context.Context, response *model.Response,
	_ *metric.EvalMetric) (*evaluator.ScoreResult, error) {
	var payload booleanResponse
	if err := responsejson.UnmarshalContent(response, &payload); err != nil {
		return nil, err
	}
	if payload.Passed == nil {
		return nil, fmt.Errorf("passed is required")
	}
	if payload.Reason == nil {
		return nil, fmt.Errorf("reason is required")
	}
	scoreValue := 0.0
	if *payload.Passed {
		scoreValue = 1.0
	}
	return &evaluator.ScoreResult{
		Score:  scoreValue,
		Value:  &score.Value{Kind: score.KindBoolean, Boolean: payload.Passed},
		Reason: *payload.Reason,
	}, nil
}

```

### Core Architecture Module: `evaluation/evaluator/llm/operator/responsescorer/categorical/categorical.go`
```
//
// Tencent is pleased to support the open source community by making trpc-agent-go available.
//
// Copyright (C) 2025 Tencent.  All rights reserved.
//
// trpc-agent-go is licensed under the Apache License Version 2.0.
//

// Package categorical scores JSON judge outputs shaped as {category, reason}.
package categorical

import (
	"context"
	"fmt"

	"trpc.group/trpc-go/trpc-agent-go/evaluation/evaluator"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/evaluator/llm/operator/internal/category"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/evaluator/llm/operator/responsescorer"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/evaluator/llm/operator/responsescorer/internal/responsejson"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/metric"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/score"
	"trpc.group/trpc-go/trpc-agent-go/model"
)

type categoricalResponse struct {
	Category *string `json:"category"`
	Reason   *string `json:"reason"`
}

type categoricalResponseScorer struct {
}

// New returns a response scorer for categorical JSON outputs.
func New() responsescorer.ResponseScorer {
	return &categoricalResponseScorer{}
}

// ScoreBasedOnResponse parses the structured judge response.
func (s *categoricalResponseScorer) ScoreBasedOnResponse(ctx context.Context, response *model.Response,
	evalMetric *metric.EvalMetric) (*evaluator.ScoreResult, error) {
	categoryScores, err := category.Scores(evalMetric)
	if err != nil {
		return nil, err
	}
	var payload categoricalResponse
	if err := responsejson.UnmarshalContent(response, &payload); err != nil {
		return nil, err
	}
	if payload.Category == nil {
		return nil, fmt.Errorf("category is required")
	}
	if payload.Reason == nil {
		return nil, fmt.Errorf("reason is required")
	}
	value := &score.Value{Kind: score.KindCategorical, Categorical: *payload.Category}
	categoryScore, ok := categoryScores[*payload.Category]
	if !ok {
		return &evaluator.ScoreResult{
			Score:  0,
			Value:  value,
			Reason: fmt.Sprintf("unknown categorical label %q: %s", *payload.Category, *payload.Reason),
		}, nil
	}
	return &evaluator.ScoreResult{
		Score:  categoryScore,
		Value:  value,
		Reason: *payload.Reason,
	}, nil
}

```

### Core Architecture Module: `evaluation/evaluator/llm/operator/responsescorer/finalresponse/finalresponse.go`
```
//
// Tencent is pleased to support the open source community by making trpc-agent-go available.
//
// Copyright (C) 2025 Tencent.  All rights reserved.
//
// trpc-agent-go is licensed under the Apache License Version 2.0.
//
//

// Package finalresponse converts judge feedback into validity scores for final responses.
package finalresponse

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"trpc.group/trpc-go/trpc-agent-go/evaluation/evaluator"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/evaluator/llm/operator/responsescorer"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/metric"
	scorepkg "trpc.group/trpc-go/trpc-agent-go/evaluation/score"
	"trpc.group/trpc-go/trpc-agent-go/model"
)

const labelValid string = "valid" // labelValid marks a valid agent response.

// finalResponseBlockRegex extracts the reasoning and validity label from the judge response.
var finalResponseBlockRegex = regexp.MustCompile(
	`(?ms)reasoning:\s*(.*?)\s*` + // 1: reasoning text
		`is_the_agent_response_valid:\s*(.*?)\s*$`, // 2: validity label
)

type finalResponseResponseScorer struct {
}

// New returns a response scorer for final responses.
func New() responsescorer.ResponseScorer {
	return &finalResponseResponseScorer{}
}

// ScoreBasedOnResponse converts judge feedback to a numeric score.
func (e *finalResponseResponseScorer) ScoreBasedOnResponse(ctx context.Context, response *model.Response,
	_ *metric.EvalMetric) (*evaluator.ScoreResult, error) {
	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}
	content := response.Choices[0].Message.Content
	if content == "" {
		return nil, fmt.Errorf("empty response text")
	}
	reasoning, label, err := extractReasoningAndLabel(content)
	if err != nil {
		return nil, fmt.Errorf("extract reasoning and label: %w", err)
	}
	score := 0.0
	if label == labelValid {
		score = 1.0
	}
	return &evaluator.ScoreResult{
		Score:  score,
		Value:  &scorepkg.Value{Kind: scorepkg.KindNumeric, Numeric: &score},
		Reason: reasoning,
	}, nil
}

// extractReasoningAndLabel parses judge output in text form.
func extractReasoningAndLabel(content string) (string, string, error) {
	matches := finalResponseBlockRegex.FindAllStringSubmatch(content, -1)
	if len(matches) < 1 {
		return "", "", fmt.Errorf("no final response blocks found in response")
	}
	reasoning := strings.TrimSpace(matches[0][1])
	label := strings.TrimSpace(matches[0][2])
	label = strings.ToLower(label)
	return reasoning, label, nil
}

```

### Core Architecture Module: `evaluation/evaluator/llm/operator/responsescorer/hallucination/hallucination.go`
```
//
// Tencent is pleased to support the open source community by making trpc-agent-go available.
//
// Copyright (C) 2025 Tencent.  All rights reserved.
//
// trpc-agent-go is licensed under the Apache License Version 2.0.
//

// Package hallucination scores sentence-level hallucination judgments.
package hallucination

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"trpc.group/trpc-go/trpc-agent-go/evaluation/evalresult"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/evaluator"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/evaluator/llm/operator/responsescorer"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/metric"
	scorepkg "trpc.group/trpc-go/trpc-agent-go/evaluation/score"
	"trpc.group/trpc-go/trpc-agent-go/model"
)

const (
	positiveVerdict    = "yes"
	labelSupported     = "supported"
	labelUnsupported   = "unsupported"
	labelContradictory = "contradictory"
	labelDisputed      = "disputed"
	labelNotApplicable = "not_applicable"
)

var sentenceBlockRegex = regexp.MustCompile(
	`(?ms)ID:\s*(.*?)\s*` +
		`Reason:\s*(.*?)\s*` +
		`Label:\s*(.*?)\s*` +
		`Verdict:\s*(.*?)(?:\n\s*\n|\z)`,
)

type hallucinationResponseScorer struct {
}

// New returns a response scorer for hallucination judgments.
func New() responsescorer.ResponseScorer {
	return &hallucinationResponseScorer{}
}

// ScoreBasedOnResponse scores hallucination judgments by averaging sentence verdicts.
func (e *hallucinationResponseScorer) ScoreBasedOnResponse(ctx context.Context, response *model.Response,
	evalMetric *metric.EvalMetric) (*evaluator.ScoreResult, error) {
	if response == nil {
		return nil, fmt.Errorf("response is nil")
	}
	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}
	content := response.Choices[0].Message.Content
	matches := sentenceBlockRegex.FindAllStringSubmatch(content, -1)
	if len(matches) == 0 {
		return nil, fmt.Errorf("no sentence blocks found in response")
	}
	result := &evaluator.ScoreResult{}
	reasons := make([]string, 0, len(matches))
	total := 0.0
	for i, match := range matches {
		id := strings.TrimSpace(match[1])
		if id == "" {
			id = fmt.Sprintf("%d", i+1)
		}
		reason := strings.TrimSpace(match[2])
		label := normalizeLabel(match[3])
		verdict := strings.ToLower(strings.TrimSpace(match[4]))
		score, err := scoreForLabel(label, verdict)
		if err != nil {
			return nil, fmt.Errorf("score sentence %s: %w", id, err)
		}
		annotatedReason := reason
		if label != "" {
			annotatedReason = fmt.Sprintf("[%s] %s", label, reason)
		}
		result.RubricScores = append(result.RubricScores, &evalresult.RubricScore{
			ID:     id,
			Reason: strings.TrimSpace(annotatedReason),
			Score:  score,
		})
		total += score
		reasons = append(reasons, strings.TrimSpace(annotatedReason))
	}
	result.Score = total / float64(len(matches))
	result.Value = &scorepkg.Value{Kind: scorepkg.KindNumeric, Numeric: &result.Score}
	result.Reason = strings.Join(reasons, "\n")
	return result, nil
}

func normalizeLabel(label string) string {
	normalized := strings.ToLower(strings.TrimSpace(label))
	normalized = strings.ReplaceAll(normalized, " ", "_")
	return normalized
}

func scoreForLabel(label, verdict string) (float64, error) {
	switch label {
	case labelSupported, labelNotApplicable:
		return 1.0, nil
	case labelUnsupported, labelContradictory, labelDisputed:
		return 0.0, nil
	case "":
		if verdict == positiveVerdict {
			return 1.0, nil
		}
		return 0.0, nil
	default:
		return 0, fmt.Errorf("unexpected label %q", label)
	}
}

```

### Core Architecture Module: `evaluation/evaluator/llm/operator/responsescorer/internal/responsejson/decoder.go`
```
//
// Tencent is pleased to support the open source community by making trpc-agent-go available.
//
// Copyright (C) 2025 Tencent.  All rights reserved.
//
// trpc-agent-go is licensed under the Apache License Version 2.0.
//

// Package responsejson decodes structured JSON judge responses.
package responsejson

import (
	"encoding/json"
	"fmt"
	"strings"

	"trpc.group/trpc-go/trpc-agent-go/model"
)

// UnmarshalContent decodes the first response choice content as JSON into dst.
func UnmarshalContent(resp *model.Response, dst any) error {
	if resp == nil {
		return fmt.Errorf("response is nil")
	}
	if len(resp.Choices) == 0 {
		return fmt.Errorf("no choices in response")
	}
	content := strings.TrimSpace(resp.Choices[0].Message.Content)
	if content == "" {
		return fmt.Errorf("empty response text")
	}
	content = trimCodeFence(content)
	if err := json.Unmarshal([]byte(content), dst); err != nil {
		return fmt.Errorf("unmarshal response json: %w", err)
	}
	return nil
}

func trimCodeFence(content string) string {
	if !strings.HasPrefix(content, "```") {
		return content
	}
	content = strings.TrimPrefix(content, "```json")
	content = strings.TrimPrefix(content, "```JSON")
	content = strings.TrimPrefix(content, "```")
	content = strings.TrimSuffix(content, "```")
	return strings.TrimSpace(content)
}

```

### Core Architecture Module: `evaluation/evaluator/llm/operator/responsescorer/responsescorer.go`
```
//
// Tencent is pleased to support the open source community by making trpc-agent-go available.
//
// Copyright (C) 2025 Tencent.  All rights reserved.
//
// trpc-agent-go is licensed under the Apache License Version 2.0.
//
//

// Package responsescorer extracts numeric scores from judge model outputs.
package responsescorer

import (
	"context"

	"trpc.group/trpc-go/trpc-agent-go/evaluation/evaluator"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/metric"
	"trpc.group/trpc-go/trpc-agent-go/model"
)

// ResponseScorer defines the interface for scoring judge responses.
type ResponseScorer interface {
	// ScoreBasedOnResponse extracts a score from the judge response.
	ScoreBasedOnResponse(ctx context.Context, resp *model.Response,
		evalMetric *metric.EvalMetric) (*evaluator.ScoreResult, error)
}

```

### Core Architecture Module: `evaluation/evaluator/llm/operator/responsescorer/rubricresponse/rubricresponse.go`
```
//
// Tencent is pleased to support the open source community by making trpc-agent-go available.
//
// Copyright (C) 2025 Tencent.  All rights reserved.
//
// trpc-agent-go is licensed under the Apache License Version 2.0.
//
//

// Package rubricresponse scores rubric-graded judge outputs.
package rubricresponse

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"trpc.group/trpc-go/trpc-agent-go/evaluation/evalresult"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/evaluator"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/evaluator/llm/operator/responsescorer"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/metric"
	scorepkg "trpc.group/trpc-go/trpc-agent-go/evaluation/score"
	"trpc.group/trpc-go/trpc-agent-go/model"
)

const passedVerdict = "yes"

// rubricBlockRegex extracts rubric ID, property, evidence, reason, and verdict blocks.
var rubricBlockRegex = regexp.MustCompile(
	`(?ms)ID:\s*(.*?)\s*` + // 1: rubric id
		`Rubric:\s*(.*?)\s*` + // 2: rubric text
		`Evidence:\s*(.*?)\s*` + // 3: evidence text
		`Reason:\s*(.*?)\s*` + // 4: reason text
		`Verdict:\s*(.*?)\s*$`, // 5: verdict yes/no
)

type rubricResponseScorer struct {
}

// New returns a response scorer for rubric responses.
func New() responsescorer.ResponseScorer {
	return &rubricResponseScorer{}
}

// ScoreBasedOnResponse scores rubric responses.
func (e *rubricResponseScorer) ScoreBasedOnResponse(ctx context.Context, response *model.Response,
	evalMetric *metric.EvalMetric) (*evaluator.ScoreResult, error) {
	if response == nil {
		return nil, fmt.Errorf("response is nil")
	}
	if len(response.Choices) == 0 {
		return nil, fmt.Errorf("no choices in response")
	}
	content := response.Choices[0].Message.Content
	matches := rubricBlockRegex.FindAllStringSubmatch(content, -1)
	if len(matches) == 0 {
		return nil, fmt.Errorf("no rubric blocks found in response")
	}
	expectedRubrics := configuredRubricCount(evalMetric)
	if expectedRubrics > 0 && len(matches) != expectedRubrics {
		return nil, fmt.Errorf("parsed rubric blocks count %d does not match configured rubric count %d",
			len(matches), expectedRubrics)
	}
	averageScore := 0.0
	reasons := make([]string, 0, len(matches))
	result := &evaluator.ScoreResult{}
	for _, match := range matches {
		rubricID := strings.TrimSpace(match[1])
		reason := strings.TrimSpace(match[4])
		verdict := strings.ToLower(strings.TrimSpace(match[5]))
		var score float64
		if verdict == passedVerdict {
			score = 1.0
		} else {
			score = 0.0
		}
		result.RubricScores = append(result.RubricScores, &evalresult.RubricScore{
			ID:     rubricID,
			Reason: reason,
			Score:  score,
		})
		averageScore += score
		reasons = append(reasons, reason)
	}
	averageScore /= float64(len(matches))
	result.Score = averageScore
	result.Value = &scorepkg.Value{Kind: scorepkg.KindNumeric, Numeric: &result.Score}
	result.Reason = strings.Join(reasons, "\n")
	return result, nil
}

func configuredRubricCount(evalMetric *metric.EvalMetric) int {
	if evalMetric == nil || evalMetric.Criterion == nil || evalMetric.Criterion.LLMJudge == nil {
		return 0
	}
	count := 0
	for _, rubric := range evalMetric.Criterion.LLMJudge.Rubrics {
		if rubric == nil || rubric.Content == nil {
			continue
		}
		count++
	}
	return count
}

```

### Core Architecture Module: `evaluation/evaluator/llm/operator/responsescorer/rubricscores/rubricscores.go`
```
//
// Tencent is pleased to support the open source community by making trpc-agent-go available.
//
// Copyright (C) 2025 Tencent.  All rights reserved.
//
// trpc-agent-go is licensed under the Apache License Version 2.0.
//

// Package rubricscores scores JSON judge outputs shaped as {rubricScores: [...]}.
package rubricscores

import (
	"context"
	"fmt"
	"strings"

	"trpc.group/trpc-go/trpc-agent-go/evaluation/evalresult"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/evaluator"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/evaluator/llm/operator/internal/rubrics"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/evaluator/llm/operator/responsescorer"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/evaluator/llm/operator/responsescorer/internal/responsejson"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/metric"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/score"
	"trpc.group/trpc-go/trpc-agent-go/model"
)

type rubricScoreItem struct {
	ID     *string  `json:"id"`
	Score  *float64 `json:"score"`
	Reason *string  `json:"reason"`
}

type rubricScoresResponse struct {
	RubricScores []rubricScoreItem `json:"rubricScores"`
}

type rubricScoresResponseScorer struct {
}

// New returns a response scorer for rubric scores JSON outputs.
func New() responsescorer.ResponseScorer {
	return &rubricScoresResponseScorer{}
}

// ScoreBasedOnResponse parses the structured judge response.
func (s *rubricScoresResponseScorer) ScoreBasedOnResponse(ctx context.Context, response *model.Response,
	evalMetric *metric.EvalMetric) (*evaluator.ScoreResult, error) {
	var payload rubricScoresResponse
	if err := responsejson.UnmarshalContent(response, &payload); err != nil {
		return nil, err
	}
	if len(payload.RubricScores) == 0 {
		return nil, fmt.Errorf("rubricScores is empty")
	}
	expectedIDs, err := expectedRubricIDs(evalMetric)
	if err != nil {
		return nil, err
	}
	result := &evaluator.ScoreResult{
		RubricScores: make([]*evalresult.RubricScore, 0, len(payload.RubricScores)),
	}
	reasons := make([]string, 0, len(payload.RubricScores))
	seenIDs := make(map[string]struct{}, len(payload.RubricScores))
	total := 0.0
	for _, item := range payload.RubricScores {
		if item.ID == nil || strings.TrimSpace(*item.ID) == "" {
			return nil, fmt.Errorf("rubric score id is empty")
		}
		id := strings.TrimSpace(*item.ID)
		if err := validateRubricScoreID(id, seenIDs, expectedIDs); err != nil {
			return nil, err
		}
		if item.Score == nil {
			return nil, fmt.Errorf("rubric score is required")
		}
		if item.Reason == nil {
			return nil, fmt.Errorf("rubric score reason is required")
		}
		if *item.Score < 0 || *item.Score > 1 {
			return nil, fmt.Errorf("rubric score must be between 0 and 1")
		}
		result.RubricScores = append(result.RubricScores, &evalresult.RubricScore{
			ID:     id,
			Score:  *item.Score,
			Reason: *item.Reason,
		})
		total += *item.Score
		reasons = append(reasons, *item.Reason)
	}
	if expectedIDs != nil {
		if missing := missingRubricScoreID(seenIDs, expectedIDs); missing != "" {
			return nil, fmt.Errorf("missing rubric score id %q", missing)
		}
	}
	result.Score = total / float64(len(payload.RubricScores))
	result.Value = &score.Value{Kind: score.KindNumeric, Numeric: &result.Score}
	result.Reason = strings.Join(reasons, "\n")
	return result, nil
}

func expectedRubricIDs(evalMetric *metric.EvalMetric) (map[string]struct{}, error) {
	if rubrics.Count(evalMetric) == 0 {
		return nil, nil
	}
	visibleRubrics, err := rubrics.ValidateStructured(evalMetric)
	if err != nil {
		return nil, err
	}
	expected := make(map[string]struct{}, len(visibleRubrics))
	for _, rubric := range visibleRubrics {
		expected[rubric.ID] = struct{}{}
	}
	return expected, nil
}

func validateRubricScoreID(id string, seen, expected map[string]struct{}) error {
	if _, ok := seen[id]; ok {
		return fmt.Errorf("duplicate rubric score id %q", id)
	}
	if expected != nil {
		if _, ok := expected[id]; !ok {
			return fmt.Errorf("unexpected rubric score id %q", id)
		}
	}
	seen[id] = struct{}{}
	return nil
}

func missingRubricScoreID(seen, expected map[string]struct{}) string {
	for id := range expected {
		if _, ok := seen[id]; !ok {
			return id
		}
	}
	return ""
}

```

### Core Architecture Module: `evaluation/evaluator/llm/operator/responsescorer/singlescore/singlescore.go`
```
//
// Tencent is pleased to support the open source community by making trpc-agent-go available.
//
// Copyright (C) 2025 Tencent.  All rights reserved.
//
// trpc-agent-go is licensed under the Apache License Version 2.0.
//

// Package singlescore scores JSON judge outputs shaped as {score, reason}.
package singlescore

import (
	"context"
	"fmt"

	"trpc.group/trpc-go/trpc-agent-go/evaluation/evaluator"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/evaluator/llm/operator/responsescorer"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/evaluator/llm/operator/responsescorer/internal/responsejson"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/metric"
	"trpc.group/trpc-go/trpc-agent-go/evaluation/score"
	"trpc.group/trpc-go/trpc-agent-go/model"
)

type singleScoreResponse struct {
	Score  *float64 `json:"score"`
	Reason *string  `json:"reason"`
}

type singleScoreResponseScorer struct {
}

// New returns a response scorer for single score JSON outputs.
func New() responsescorer.ResponseScorer {
	return &singleScoreResponseScorer{}
}

// ScoreBasedOnResponse parses the structured judge response.
func (s *singleScoreResponseScorer) ScoreBasedOnResponse(ctx context.Context, response *model.Response,
	_ *metric.EvalMetric) (*evaluator.ScoreResult, error) {
	var payload singleScoreResponse
	if err := responsejson.UnmarshalContent(response, &payload); err != nil {
		return nil, err
	}
	if payload.Score == nil {
		return nil, fmt.Errorf("score is required")
	}
	if payload.Reason == nil {
		return nil, fmt.Errorf("reason is required")
	}
	if *payload.Score < 0 || *payload.Score > 1 {
		return nil, fmt.Errorf("score must be between 0 and 1")
	}
	return &evaluator.ScoreResult{
		Score:  *payload.Score,
		Value:  &score.Value{Kind: score.KindNumeric, Numeric: payload.Score},
		Reason: *payload.Reason,
	}, nil
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2282** (2026-07-21): **telemetry/langfuse: avoid double-counting cached input tokens**
  *Symptoms*: ## What changed  Langfuse generation observations now report mutually exclusive input usage buckets. Cached input is no longer counted twice in displayed usage, totals, or inferred cost, while no-cache behavior and existing usage key names remain unchanged.  ## Why  Langfuse treats each flat `usage_details` key as a non-overlapping bucket and sums keys containing `input`. OpenAI-compatible and Gemini responses report cached tokens as a subset of their inclusive input count, so forwarding both values unchanged inflated input usage. Anthropic and Bedrock expose cache reads and cache creation separately; their compatibility cache alias must not be emitted as an additional bucket.  Fixes #2281  ## Testing  - `go test ./telemetry/langfuse -count=1` - `go test ./...` - `go build ./...` - Verified a synthetic Go exporter observation with input 100, cached input 30, and output 50 is stored as input 70 + cached 30 and aggregates to input 100, total 150. - Compared the result with Langfuse Python SDK flat-exclusive and OpenAI-schema observations. - Ran the Agent + Runner prompt-cache example against an OpenAI-compatible provider: all 6 turns completed, calculator and time tool calls succeeded, and 5 turns reported cache hits. A real sample with prompt 2495, cached 2304, and output 291 was stored as input 191 + cached 2304 and aggregated to input 2495, total 2786. Agent observations contributed no duplicate token usage.  ## Notes for reviewers  This intentionally changes externally obse
  **Post-Mortem & Fix Analysis**:
  > <!-- This is an auto-generated comment: summarize by coderabbit.ai --> <!-- review_stack_entry_start -->  [![Review Change Stack](https://storage.googleapis.com/coderabbit_public_assets/review-stack-in-coderabbit-ui.svg)](https://app.coderabbit.ai/change-stack/trpc-group/trpc-agent-go/pull/2282?utm_source=github_walkthrough&utm_medium=github&utm_campaign=change_stack)  <!-- review_stack_entry_end --> No actionable comments were generated in the recent review. 🎉  <details> <summary>ℹ️ Recent review info</summary>  <details> <summary>⚙️ Run configuration</summary>  **Configuration used**: Path: .coderabbit.yaml  **Review profile**: CHILL  **Plan**: Pro  **Run ID**: `af70a789-0b2f-4b4c-8b9c-8c2c0af90e6d`  </details>  <details> <summary>📥 Commits</summary>  Reviewing files that changed from the base of the PR and between 2f05cf99a24b490d5fa6bc20481a5e14adc35a90 and 9c7a4bb082b49166f7380d9f2c913b7bfe6c9e46.  </details>  <details> <summary>📒 Files selected for processing (4)</summary>  * 
  > ## [Codecov](https://app.codecov.io/gh/trpc-group/trpc-agent-go/pull/2282?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=trpc-group) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 89.86090%. Comparing base ([`2f05cf9`](https://app.codecov.io/gh/trpc-group/trpc-agent-go/commit/2f05cf99a24b490d5fa6bc20481a5e14adc35a90?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=trpc-group)) to head ([`9c7a4bb`](https://app.codecov.io/gh/trpc-group/trpc-agent-go/commit/9c7a4bb082b49166f7380d9f2c913b7bfe6c9e46?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=trpc-group)). :warning: Report is 2 commits behind head on main.  <details><summary>Additional details and impacted files</summary>    ```diff @@                 Co

- **Issue #2281** (2026-07-21): **telemetry/langfuse: avoid double-counting cached input tokens**
  *Symptoms*: **Describe the bug** The Langfuse exporter converts inclusive `gen_ai.usage.input_tokens` and its cached-token detail into flat `usage_details` without making the buckets mutually exclusive. Langfuse sums all usage keys containing `input`, so cached input is counted twice in the displayed usage and inferred cost.  **To Reproduce** 1. Export an LLM span with input tokens `100`, cached input tokens `30`, and output tokens `50`. 2. Inspect the generation observation in Langfuse. 3. The exporter stores `input=100`, `input_cached=30`, and `output=50`. 4. Langfuse reports input usage `130` and total usage `180`.  **Expected behavior** The flat usage buckets should be mutually exclusive: `input=70`, `input_cached=30`, and `output=50`. Langfuse should report input usage `100` and total usage `150`. Provider-specific cache-read/cache-creation buckets must also remain non-overlapping.  **Environment (please complete the following information):** - OS: Linux amd64 - Version: kernel 6.6 - Go version: go1.24.11 - tRPC-Agent-Go version: main at 0c777418  **Additional context** Langfuse documents that flat `usage_details` keys are mutually exclusive buckets: https://langfuse.com/docs/observability/features/token-and-cost-tracking
  **Post-Mortem & Fix Analysis**:
  >  用户反馈 langfuse 页面 token 的显示不合理，当前显示 input usage = input + input_cached， 但是实际的 input usage 应该为 input，其中 input_cache 应该是 input 的一部分。  <img width="635" height="394" alt="Image" src="https://github.com/user-attachments/assets/6f3b8be5-2ef1-46ca-b9ce-31cb16c06c56" />

- **Issue #993** (2026-01-05): **server/agui: respect the earlier of the request deadline and WithTimeout**
  *Symptoms*: Ensure AG-UI runs continue executing after the client request is canceled (for example, when the SSE connection is closed) while still respecting time limits by computing the execution deadline as the earlier of the request context deadline and the configured server-side timeout via agui.WithTimeout.  AG-UI runs now respect the earlier of the request deadline and agui.WithTimeout, while remaining resilient to SSE disconnects.
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/trpc-group/trpc-agent-go/pull/993?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=trpc-group) Report :white_check_mark: All modified and coverable lines are covered by tests. :white_check_mark: Project coverage is 90.25272%. Comparing base ([`6cc5903`](https://app.codecov.io/gh/trpc-group/trpc-agent-go/commit/6cc590389dac61131cfd06b737fd11780a260e66?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=trpc-group)) to head ([`cf76976`](https://app.codecov.io/gh/trpc-group/trpc-agent-go/commit/cf76976cedd94dd086f62e401712193ea539114a?dropdown=coverage&el=desc&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=trpc-group)). :warning: Report is 4 commits behind head on main.  <details><summary>Additional details and impacted files</summary>    ```diff @@                 Cov
  > https://github.com/trpc-group/trpc-agent-go/pull/980#discussion_r2659479122 <img width="822" height="316" alt="image" src="https://github.com/user-attachments/assets/fca2e82b-232b-47de-a8ec-d9a41e87435b" />  --- 确实存在语义变更，但感觉是合理变更，原因如下： 1. 本PR之前，若用户关闭浏览器页面，则本次agent run将会被终止。由于被终止时，session中的事件可能还未完整（例如以toolcall事件结尾，但没有对应的toolresponse事件），这会导致下一轮 agent run请求 llm 时报错 400 bad request，感觉这种行为是不合理的。 2. 根据用户反馈以及gpt web体验，关闭浏览器页面后，后端服务确实应该继续运行，不应该受到前端断连影响  关于原有的 timeout 进行了额外处理，最新实现只忽略前端主动cancel，真实超时时间=min(前端超时时间，后端超时时间)

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

### Incident Patch 1: `b546f839` (2026-09-22)
**Commit Message**: {event, runner, server/agui}: expose cancellation and timeout outcomes (#2574)

## What changed

Add run-level outcomes to runner completion events. AG-UI `/cancel` sets
`event.RunOutcome.Status` to `event.RunOutcomeStatusCancelled`, and
deadline-driven termination sets it to `event.RunOutcomeStatusTimedOut`.
Framework event consumers can inspect the field directly, including for
runs that produced no assistant content.

## Why

An AG-UI cancel is distinct from generic runner cancellation and
GraphAgent interrupt events. A unified run-level completion outcome
gives applications one stable event field for explicit cancellation and
timeout without synthesizing an assistant event or relying on context
state after persistence detaches cancellation.

## Testing

- `go test ./event ./runner`
- `go test ./...` in `server/agui`
- `go test ./...` in the root module; all packages pass except the
pre-existing `tool/duckduckgo` Unix socket test, which fails in this
environment with `bind: invalid argument`

## Notes for reviewers

The new cancellation marker is internal and shared between AG-UI and the
core runner. Generic `ManagedRunner.Cancel`, GraphAgent interrupts, and
AG-UI wire events ar

**File**: `docs/mkdocs/en/agui/cancel.md` (modified, +4/-0)
```diff
@@ -61,6 +61,10 @@ Typical responses:
 
 After cancellation succeeds, the framework still performs the required run finalization, fills in protocol closing events, and tries to write the aggregation cache to `SessionService`. A successful cancel response does not mean the same `SessionKey` can immediately start a new real-time conversation request. If you need to start the next run, wait for the original real-time conversation stream to return a terminal event. Therefore, when history is later read through `/history`, the result is a valid and consistent state after cancellation rather than an unfinished intermediate state. For finalization and timeout configuration, see [Session Storage and Event Aggregation](history.md#session-storage-and-event-aggregation).
 
+To determine whether a run was actively cancelled by `/cancel` from the framework event stream, inspect the `RunOutcome` field on the final runner completion event. When `RunOutcome` is non-nil and `Status` is `event.RunOutcomeStatusCancelled`, the run was actively cancelled by `/cancel`.
+
+When a run ends because its configured deadline is exceeded, the same field is set to `event.RunOutcomeStatusTimedOut`.
+
 ## Multi-Instance Distributed Cancel
 
 If a multi-instance deployment cannot guarantee that the real-time conversation request and cancel request for the same `SessionKey` hit the same instance, enable distributed cancel:
```

**File**: `docs/mkdocs/en/event.md` (modified, +6/-0)
```diff
@@ -16,6 +16,12 @@ Users obtain event streams through the `runner.Run()` method, then listen to eve
 type Event struct {
     // Response is the basic response structure of Event, carrying LLM responses.
     *model.Response
+
+    // RunOutcome describes runner completion outcomes such as explicit cancellation
+    // or deadline expiration. It is nil for non-completion events, normal
+    // completion, and generic cancellation.
+    RunOutcome *RunOutcome `json:"run_outcome,omitempty"`
+
     // RequestID The unique identifier for this request.
     // It can be passed via runner.Run using agent.WithRequestID.
 	RequestID string `json:"requestID,omitempty"`
```

**File**: `docs/mkdocs/zh/agui/cancel.md` (modified, +4/-0)
```diff
@@ -61,6 +61,10 @@ curl -X POST http://localhost:8080/cancel \
 
 取消成功后，框架仍会执行必要的运行结束收尾，补齐协议结束事件，并将聚合缓存尽量写入 `SessionService`。取消请求返回成功不表示同一个 `SessionKey` 已经可以立即发起新的实时对话请求；如果需要继续发起下一次运行，应等待原实时对话流返回终态事件。因此，后续通过 `/history` 读取历史时，拿到的是取消后的合法一致状态，而不是一段未收尾的中间状态。收尾流程和超时配置可参考 [Session 存储与事件聚合](history.md#session-存储与事件聚合)。
 
+如果需要从框架事件流判断本次是否由 `/cancel` 主动取消，可以检查最终 runner completion 事件的 `RunOutcome` 字段。当 `RunOutcome` 非空且 `Status` 为 `event.RunOutcomeStatusCancelled` 时，表示本次运行由 `/cancel` 主动取消。
+
+如果运行因配置的超时时间到达而结束，则同一字段的 `Status` 为 `event.RunOutcomeStatusTimedOut`。
+
 ## 多实例分布式取消
 
 如果多实例部署中无法保证同一个 `SessionKey` 的实时对话请求和取消请求落到同一个实例，可以开启分布式取消：
```

**File**: `docs/mkdocs/zh/event.md` (modified, +4/-0)
```diff
@@ -17,6 +17,10 @@ type Event struct {
     // Response 是 Event 的基础响应结构，承载 LLM 的响应
     *model.Response
 
+    // RunOutcome 描述 runner completion 结果，例如显式取消或超时。
+    // 非 completion 事件、正常完成和通用取消时为 nil。
+    RunOutcome *RunOutcome `json:"run_outcome,omitempty"`
+
     // RequestID 记录关联本次请求的ID，可由runner.Run通过agent.WithRequestID("request-ID")传递.
 	RequestID string `json:"requestID,omitempty"`
 
```

**File**: `event/event.go` (modified, +28/-0)
```diff
@@ -100,6 +100,12 @@ type Event struct {
 	// Response is the base struct for all LLM response functionality.
 	*model.Response
 
+	// RunOutcome describes the outcome of the run represented by this event.
+	// It is populated on runner completion events when the run was explicitly
+	// cancelled or exceeded its deadline. It is nil for non-completion events,
+	// normal completion, and generic cancellation.
+	RunOutcome *RunOutcome `json:"run_outcome,omitempty"`
+
 	// RequestID is the request ID of the event.
 	RequestID string `json:"requestID,omitempty"`
 
@@ -168,6 +174,23 @@ type Event struct {
 	Version int `json:"version,omitempty"`
 }
 
+// RunOutcome describes the outcome attached to a runner completion event.
+type RunOutcome struct {
+	Status RunOutcomeStatus `json:"status,omitempty"`
+}
+
+// RunOutcomeStatus identifies a runner execution outcome. Consumers should
+// ignore values they do not recognize so newer statuses remain compatible.
+type RunOutcomeStatus string
+
+const (
+	// RunOutcomeStatusCancelled indicates that the run was explicitly cancelled.
+	RunOutcomeStatusCancelled RunOutcomeStatus = "cancelled"
+	// RunOutcomeStatusTimedOut indicates that the run ended because its deadline
+	// was exceeded.
+	RunOutcomeStatusTimedOut RunOutcomeStatus = "timed_out"
+)
+
 // ContainsTag checks if the event contains the specified tag.
 func (e *Event) ContainsTag(tag string) bool {
 	if e.Tag == "" {
@@ -200,6 +223,11 @@ func (e *Event) Clone() *Event {
 	}
 	clone := *e
 	clone.Response = e.Response.Clone()
+	if e.RunOutcome != nil {
+		clone.RunOutcome = &RunOutcome{
+			Status: e.RunOutcome.Status,
+		}
+	}
 	clone.LongRunningToolIDs = make(map[string]struct{})
 	clone.Version = CurrentVersion
 	clone.ID = uuid.NewString()
```

**File**: `event/event_test.go` (modified, +16/-0)
```diff
@@ -93,6 +93,7 @@ func TestEvent_WithOptions_And_Clone(t *testing.T) {
 		WithStructuredOutputPayload(map[string]any{"x": 1}),
 		WithSkipSummarization(),
 	)
+	sevt.RunOutcome = &RunOutcome{Status: RunOutcomeStatusCancelled}
 
 	require.Equal(t, "b1", sevt.Branch)
 	require.Equal(t, "obj-x", sevt.Object)
@@ -110,6 +111,21 @@ func TestEvent_WithOptions_And_Clone(t *testing.T) {
 	clone := sevt.Clone()
 	require.NotNil(t, clone)
 	require.NotSame(t, sevt, clone)
+	require.NotNil(t, clone.RunOutcome)
+	require.NotSame(t, sevt.RunOutcome, clone.RunOutcome)
+	require.Equal(t, RunOutcomeStatusCancelled, clone.RunOutcome.Status)
+	raw, err := json.Marshal(sevt)
+	require.NoError(t, err)
+	var fields map[string]json.RawMessage
+	require.NoError(t, json.Unmarshal(raw, &fields))
+	_, hasRunOutcome := fields["run_outcome"]
+	require.True(t, hasRunOutcome)
+	_, hasLegacyExtensionKey := fields["trpc_agent.run_outcome"]
+	require.False(t, hasLegacyExtensionKey)
+	var roundTrip Event
+	require.NoError(t, json.Unmarshal(raw, &roundTrip))
+	require.NotNil(t, roundTrip.RunOutcome)
+	require.Equal(t, RunOutcomeStatusCancelled, roundTrip.RunOutcome.Status)
 	require.Equal(t, sevt.InvocationID, clone.InvocationID)
 	require.Equal(t, sevt.Author, clone.Author)
 	require.NotNil(t, clone.Response)
```

**File**: `internal/runoutcome/runoutcome.go` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+//
+// Tencent is pleased to support the open source community by making trpc-agent-go available.
+//
+// Copyright (C) 2026 Tencent.  All rights reserved.
+//
+// trpc-agent-go is licensed under the Apache License Version 2.0.
+//
+
+// Package runoutcome contains run outcome markers shared by runners.
+package runoutcome
+
+import (
+	"context"
+	"errors"
+)
+
+// ErrExplicitCancel marks a run cancelled through an explicit cancel API.
+//
+// The marker is intentionally shared internally so protocol adapters can
+// identify explicit cancellation when the run completion event is persisted.
+var ErrExplicitCancel = errors.New("run: explicit cancel")
+
+// IsExplicitCancel reports whether ctx was cancelled with ErrExplicitCancel.
+func IsExplicitCancel(ctx context.Context) bool {
+	return ctx != nil && errors.Is(context.Cause(ctx), ErrExplicitCancel)
+}
+
+// IsTimedOut reports whether ctx ended because its deadline was exceeded.
+func IsTimedOut(ctx context.Context) bool {
+	return ctx != nil && errors.Is(ctx.Err(), context.DeadlineExceeded)
+}
```

**File**: `internal/runoutcome/runoutcome_test.go` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+//
+// Tencent is pleased to support the open source community by making trpc-agent-go available.
+//
+// Copyright (C) 2026 Tencent.  All rights reserved.
+//
+// trpc-agent-go is licensed under the Apache License Version 2.0.
+//
+
+package runoutcome
+
+import (
+	"context"
+	"errors"
+	"testing"
+	"time"
+)
+
+func TestIsTimedOutReportsTimeoutWithCustomCause(t *testing.T) {
+	cause := errors.New("custom timeout cause")
+	ctx, cancel := context.WithTimeoutCause(context.Background(), time.Nanosecond, cause)
+	defer cancel()
+	<-ctx.Done()
+
+	if !errors.Is(ctx.Err(), context.DeadlineExceeded) {
+		t.Fatalf("ctx.Err() = %v, want %v", ctx.Err(), context.DeadlineExceeded)
+	}
+	if !errors.Is(context.Cause(ctx), cause) {
+		t.Fatalf("context.Cause(ctx) = %v, want %v", context.Cause(ctx), cause)
+	}
+	if !IsTimedOut(ctx) {
+		t.Fatal("IsTimedOut(ctx) = false, want true")
+	}
+}
+
+func TestIsTimedOutIgnoresManualDeadlineCause(t *testing.T) {
+	ctx, cancel := context.WithCancelCause(context.Background())
+	cancel(context.DeadlineExceeded)
+
+	if !errors.Is(ctx.Err(), context.Canceled) {
+		t.Fatalf("ctx.Err() = %v, want %v", ctx.Err(), context.Canceled)
+	}
+	if !errors.Is(context.Cause(ctx), context.DeadlineExceeded) {
+		t.Fatalf("context.Cause(ctx) = %v, want %v", context.Cause(ctx), context.DeadlineExceeded)
+	}
+	if IsTimedOut(ctx) {
+		t.Fatal("IsTimedOut(ctx) = true, want false")
+	}
+}
```

---

### Incident Patch 2: `28cb50c1` (2026-09-18)
**Commit Message**: model/openai: prevent panics on negative streaming tool indices (#2621)

## What changed

Streaming tool calls with negative indices can now complete without
panicking or mixing their arguments with calls that use valid indices.
Both channel and iterator APIs retain `openai-go v1.12.0`.

## Why

Some OpenAI-compatible providers return `tool_calls[].index: -1`. The
v1.12.0 accumulator uses that value as a slice index and panics with
`index out of range [-1]`, as reported in
[openai/openai-go#464](https://github.com/openai/openai-go/issues/464).

The adapter follows [openai-go's
fallback](https://github.com/openai/openai-go/commit/940e9a11d6d2063a350afaca02cd804fc17192fc)
for a single negative-index call. Mixed indices also need
provider-to-accumulator mappings across chunks: otherwise A at `-1` can
take B's index `0`, and B's later ID-less arguments get appended to A.
Mappings are scoped by choice. Calls displaced by negative-index
normalization retain that origin through subsequent collisions, keeping
declarations at distinct provider indices separate. IDs remain
authoritative when a provider reuses an index for different calls.

An index introduced as an alias by a known ID can la

**File**: `docs/mkdocs/en/model.md` (modified, +29/-0)
```diff
@@ -592,6 +592,35 @@ model := openai.New("deepseek-v4-flash",
 )
 ```
 
+##### Streaming Tool-Call Index Compatibility
+
+The OpenAI-compatible adapter normalizes negative `tool_calls[].index` values
+before accumulation, without upgrading the SDK. A single tool call with index
+`-1` uses zero, following the newer OpenAI Go SDK's fallback. For mixed or
+conflicting indices, the adapter assigns separate non-negative indices and
+retains provider-to-accumulator mappings for subsequent chunks. This keeps
+continuation chunks that omit IDs attached to the correct tool call, even when
+a valid index arrives after a negative one. Mappings are scoped to each choice.
+Valid indices are preserved when they do not conflict with an assigned index.
+Calls displaced by a negative-index call retain that distinction through later
+collisions, so subsequent declarations at distinct provider indices stay separate.
+A known ID can introduce an alias at a different index. If a new ID later
+declares a call at that alias, the new call takes over the alias. The original
+call keeps its assigned index and can still continue by ID.
+At an alias, a function-name delta without an ID uses the original explicit-index
+fallback. This keeps names that arrive before their IDs out of the alias owner's
+call; later IDs and argument chunks follow the new mapping. Argument-only deltas
+can still follow an alias until another call claims it.
+An omitted or null index does not establish a provider index mapping. After
+matching a known ID, the adapter attaches such a delta to the unique compatible
+call, even at a nonzero index; otherwise, it retains the zero fallback. For an
+explicit index with no provider mapping, compatible metadata or argument
+continuations can still use an already assigned non-negative index. This
+includes delayed names and IDs and function names split across chunks.
+Providers must still supply an unambiguous index or ID to distinguish
+interleaved calls; a missing ID combined with a missing or shared index does not
+contain enough information to recover the intended call among multiple candidates.
+
 ##### Custom Streaming Usage Aggregation
 
 The OpenAI-compatible adapter requests streaming usage and accumulates the
```

**File**: `docs/mkdocs/zh/model.md` (modified, +23/-0)
```diff
@@ -588,6 +588,29 @@ model := openai.New("deepseek-v4-flash",
 )
 ```
 
+##### 流式工具调用索引兼容
+
+OpenAI-compatible adapter 会在累积前修正负数 `tool_calls[].index`，无需
+升级 SDK。单个工具调用的 `-1` 索引会归零，与新版 OpenAI Go SDK 的兼容
+逻辑一致。混合或冲突索引会被分配到不同的非负索引，并通过服务方原始索引
+到累积索引的映射跟踪后续分片。因此，即使合法索引晚于负索引出现，省略 ID
+的续片也能归属到正确的工具调用。映射按 choice 隔离；合法索引不与已分配
+索引冲突时会保留。
+因负索引调用而发生重映射的调用，会在后续冲突中保留这一来源信息，避免将
+其他服务方索引的新调用误并入已有调用。
+已知 ID 可以在不同索引上建立别名。若新的 ID 随后使用该别名索引声明调用，
+新调用会接管该别名；原调用保留已分配索引，仍可通过 ID 续接。
+别名索引上的分片若携带函数名但没有 ID，会按原始显式索引回退处理，避免将
+先于 ID 到达的名称拼到别名所属的旧调用中；后续 ID 和参数续片沿用新映射。
+仅携带参数的续片在别名被其他调用接管前，仍可沿别名续接。
+缺失或为 null 的索引不会建立服务方索引映射。适配器优先匹配已知 ID；否则，
+若只有一个身份兼容的已有调用，续片会归入该调用，即使其索引不为零；无法
+唯一匹配时仍回退到零。对于显式索引，没有对应映射时，身份兼容的元数据或
+参数续片仍可沿用已分配的非负索引，包括延迟到达的名称、ID 和分片传输的
+函数名。
+对于交错的多个工具调用，服务方仍需提供能明确区分调用的索引或 ID；缺失 ID
+且索引缺失或由多个调用共用时，没有足够信息从多个候选中还原分片所属调用。
+
 ##### 自定义流式 Usage 聚合
 
 OpenAI-compatible adapter 默认会请求流式 usage，并聚合服务方返回的
```

**File**: `model/openai/openai.go` (modified, +174/-138)
```diff
@@ -1781,8 +1781,8 @@ func (m *Model) handleStreamingResponseWithEmitter(
 	extraFieldsMap := make(map[string]map[string]any)
 	// Aggregate reasoning deltas for final message fallback (some providers don't retain it in accumulator).
 	var reasoningBuf bytes.Buffer
-	// Track next available index for tool calls (for providers that don't set correct indices).
-	nextToolCallIndex := 0
+	// Keep provider-to-accumulator index mappings for anonymous continuations.
+	toolCallIndices := make(map[int64]*toolCallIndexState)
 
 	for stream.Next() {
 		chunk := stream.Current()
@@ -1792,9 +1792,9 @@ func (m *Model) handleStreamingResponseWithEmitter(
 			continue
 		}
 
-		// Fix tool call indices for providers that return all indices as 0.
+		// Fix negative or conflicting tool call indices from compatible providers.
 		// This must be done before updateToolCallIndexMapping and accumulation.
-		chunk = fixToolCallIndices(chunk, idToIndexMap, &nextToolCallIndex)
+		chunk = fixToolCallIndices(chunk, toolCallIndices)
 
 		// Collect ExtraFields from chunk tool_calls (SDK accumulator doesn't preserve ExtraFields).
 		m.collectExtraFieldsFromChunk(chunk, extraFieldsMap)
@@ -1929,170 +1929,206 @@ func hasAccumulatorPayloadBeyondReasoning(
 		chunk.Usage.TotalTokens > 0
 }
 
+// toolCallIndexState tracks provider indices separately from accumulator indices
+// for one choice in one stream. This preserves anonymous continuations when a
+// negative or conflicting provider index has to be remapped.
 type toolCallIndexState struct {
-	idToIndexMap map[string]int
-	indexToID    map[int64]string
-	nextIndex    *int
+	idToIndexMap  map[string]int
+	rawToIndexMap map[int64]toolCallIndexMapping
+	slots         map[int64]toolCallIndexSlot
+	nextIndex     int
 }
 
-func buildIndexToIDMap(
-	idToIndexMap map[string]int,
-	toolCalls []openai.ChatCompletionChunkChoiceDeltaToolCall,
-) map[int64]string {
-	indexToID := make(map[int64]string, len(toolCalls)+len(idToIndexMap))
-	for id, idx := range idToIndexMap {
-		indexToID[int64(idx)] = id
-	}
-	return indexToID
+// toolCallIndexMapping distinguishes an assigned provider index from an alias
+// introduced by a known ID at a different index. A new call may claim an alias.
+type toolCallIndexMapping struct {
+	index int64
+	alias bool
 }
 
-func checkIfIndexFixNeeded(
-	toolCalls []openai.ChatCompletionChunkChoiceDeltaToolCall,
-	idToIndexMap map[string]int,
-	indexToID map[int64]string,
-) bool {
-	for _, tc := range toolCalls {
-		if tc.ID == "" {
-			continue
-		}
-		if existingIndex, exists := idToIndexMap[tc.ID]; exists {
-			if tc.Index != int64(existingIndex) {
-				return true
-			}
-			indexToID[tc.Index] = tc.ID
-			continue
-		}
-		if existingID, exists := indexToID[tc.Index]; exists && existingID != tc.ID {
-			return true
-		}
-		indexToID[tc.Index] = tc.ID
-	}
-	return false
+// toolCallIndexSlot retains the identity and remapping origin of a slot.
+// negativeRemap also follows collisions with previously displaced calls, so a
+// new declaration cannot be mistaken for metadata of any call in that chain.
+type toolCallIndexSlot struct {
+	id            string
+	negativeRemap bool
 }
 
-func updateIDToIndexMapFromToolCalls(
-	toolCalls []openai.ChatCompletionChunkChoiceDeltaToolCall,
-	idToIndexMap map[string]int,
-	nextIndex *int,
-) {
-	for _, tc := range toolCalls {
-		if tc.ID == "" {
-			continue
-		}
-		if _, exists := idToIndexMap[tc.ID]; !exists {
-			idToIndexMap[tc.ID] = int(tc.Index)
-			if int(tc.Index) >= *nextIndex {
-				*nextIndex = int(tc.Index) + 1
-			}
-		}
+// canContinue accepts delayed metadata when the slot's identity is compatible.
+// Missing indices do not claim a provider index. Distinct explicit indices still
+// separate calls displaced by negative indices from new declarations; anonymous
+// arguments retain the assigned-index fallback.
+func (s toolCallIndexSlot) canContinue(tc openai.ChatCompletionChunkChoiceDeltaToolCall) bool {
+	if tc.Index < 0 {
+		return false
 	}
+	if tc.ID != "" && s.id != "" && tc.ID != s.id {
+		return false
+	}
+	if !tc.JSON.Index.Valid() || !s.negativeRemap {
+		return true
+	}
+	return tc.ID == "" && tc.Function.Name == ""
 }
 
-func createDeepCopyOfChunkForFix(
-	chunk openai.ChatCompletionChunk,
-	delta openai.ChatCompletionChunkChoiceDelta,
-) openai.ChatCompletionChunk {
-	fixedChunk := chunk
-	fixedChunk.Choices = make([]openai.ChatCompletionChunkChoice, len(chunk.Choices))
-	copy(fixedChunk.Choices, chunk.Choices)
-	fixedChunk.Choices[0].Delta.ToolCalls = make(
-		[]openai.ChatCompletionChunkChoiceDeltaToolCall,
-		len(delta.ToolCalls),
-	)
-	copy(fixedChunk.Choices[0].Delta.ToolCalls, delta.ToolCalls)
-	return fixedChunk
-}
-
-func buildUsedIndicesSet(idToIndexMap map[string]int) map[int64]struct{} {
-	usedIndices := make(map[int64]struct{}, len(idToIndexMap))
-	for _, idx := range idToIndexMap {
-		usedIndices[int64(idx)] = struct{}{}
+func newToolCallIndexState() *toolCallIndexState {
+	return &toolCallIn
```

**File**: `model/openai/openai_test.go` (modified, +46/-46)
```diff
@@ -8539,8 +8539,8 @@ func TestBuildThinkingOption(t *testing.T) {
 // calls when the provider returns all indices as 0.
 func TestFixToolCallIndices_ParallelToolCallsWithZeroIndex(t *testing.T) {
 	t.Run("fix indices for parallel tool calls with same index 0", func(t *testing.T) {
-		idToIndexMap := make(map[string]int)
-		nextIndex := 0
+		state := newToolCallIndexState()
+		states := map[int64]*toolCallIndexState{0: state}
 
 		// First tool call chunk with ID "call_1" and index 0.
 		chunk1 := openai.ChatCompletionChunk{
@@ -8561,10 +8561,10 @@ func TestFixToolCallIndices_ParallelToolCallsWithZeroIndex(t *testing.T) {
 			},
 		}
 
-		fixed1 := fixToolCallIndices(chunk1, idToIndexMap, &nextIndex)
+		fixed1 := fixToolCallIndices(chunk1, states)
 		assert.Equal(t, int64(0), fixed1.Choices[0].Delta.ToolCalls[0].Index)
-		assert.Equal(t, 0, idToIndexMap["call_1"])
-		assert.Equal(t, 1, nextIndex)
+		assert.Equal(t, 0, state.idToIndexMap["call_1"])
+		assert.Equal(t, 1, state.nextIndex)
 
 		// Second tool call chunk with ID "call_2" and index 0 (should be fixed to 1).
 		chunk2 := openai.ChatCompletionChunk{
@@ -8585,16 +8585,16 @@ func TestFixToolCallIndices_ParallelToolCallsWithZeroIndex(t *testing.T) {
 			},
 		}
 
-		fixed2 := fixToolCallIndices(chunk2, idToIndexMap, &nextIndex)
+		fixed2 := fixToolCallIndices(chunk2, states)
 		assert.Equal(t, int64(1), fixed2.Choices[0].Delta.ToolCalls[0].Index)
-		assert.Equal(t, 1, idToIndexMap["call_2"])
-		assert.Equal(t, 2, nextIndex)
+		assert.Equal(t, 1, state.idToIndexMap["call_2"])
+		assert.Equal(t, 2, state.nextIndex)
 	})
 
 	t.Run("fix indices for repeated chunks of the same tool call ID", func(t *testing.T) {
 		// This test covers providers that keep returning index 0 for subsequent chunks of a later tool call, which would otherwise corrupt the accumulator state.
-		idToIndexMap := make(map[string]int)
-		nextIndex := 0
+		state := newToolCallIndexState()
+		states := map[int64]*toolCallIndexState{0: state}
 		// Prepare streaming chunks.
 		chunk1 := openai.ChatCompletionChunk{
 			Choices: []openai.ChatCompletionChunkChoice{
@@ -8671,17 +8671,17 @@ func TestFixToolCallIndices_ParallelToolCallsWithZeroIndex(t *testing.T) {
 			},
 		}
 		// Apply index fixing per chunk.
-		fixed1 := fixToolCallIndices(chunk1, idToIndexMap, &nextIndex)
-		fixed2 := fixToolCallIndices(chunk2, idToIndexMap, &nextIndex)
-		fixed3 := fixToolCallIndices(chunk3, idToIndexMap, &nextIndex)
-		fixed4 := fixToolCallIndices(chunk4, idToIndexMap, &nextIndex)
+		fixed1 := fixToolCallIndices(chunk1, states)
+		fixed2 := fixToolCallIndices(chunk2, states)
+		fixed3 := fixToolCallIndices(chunk3, states)
+		fixed4 := fixToolCallIndices(chunk4, states)
 		// Verify fixed indices and mapping.
 		assert.Equal(t, int64(0), fixed1.Choices[0].Delta.ToolCalls[0].Index)
 		assert.Equal(t, int64(0), fixed2.Choices[0].Delta.ToolCalls[0].Index)
 		assert.Equal(t, int64(1), fixed3.Choices[0].Delta.ToolCalls[0].Index)
 		assert.Equal(t, int64(1), fixed4.Choices[0].Delta.ToolCalls[0].Index)
-		assert.Equal(t, map[string]int{"call_1": 0, "call_2": 1}, idToIndexMap)
-		assert.Equal(t, 2, nextIndex)
+		assert.Equal(t, map[string]int{"call_1": 0, "call_2": 1}, state.idToIndexMap)
+		assert.Equal(t, 2, state.nextIndex)
 		// Feed fixed chunks into the accumulator.
 		acc := openai.ChatCompletionAccumulator{}
 		acc.AddChunk(fixed1)
@@ -8701,8 +8701,8 @@ func TestFixToolCallIndices_ParallelToolCallsWithZeroIndex(t *testing.T) {
 
 	t.Run("fix indices for multiple tool calls in a single chunk with same index 0", func(t *testing.T) {
 		// This test covers providers that emit multiple tool calls in a single chunk with all indices set to 0.
-		idToIndexMap := make(map[string]int)
-		nextIndex := 0
+		state := newToolCallIndexState()
+		states := map[int64]*toolCallIndexState{0: state}
 		// Prepare a chunk containing two tool calls.
 		chunk := openai.ChatCompletionChunk{
 			Choices: []openai.ChatCompletionChunkChoice{
@@ -8733,11 +8733,11 @@ func TestFixToolCallIndices_ParallelToolCallsWithZeroIndex(t *testing.T) {
 			},
 		}
 		// Apply index fixing and verify mapping.
-		fixed := fixToolCallIndices(chunk, idToIndexMap, &nextIndex)
+		fixed := fixToolCallIndices(chunk, states)
 		assert.Equal(t, int64(0), fixed.Choices[0].Delta.ToolCalls[0].Index)
 		assert.Equal(t, int64(1), fixed.Choices[0].Delta.ToolCalls[1].Index)
-		assert.Equal(t, map[string]int{"call_1": 0, "call_2": 1}, idToIndexMap)
-		assert.Equal(t, 2, nextIndex)
+		assert.Equal(t, map[string]int{"call_1": 0, "call_2": 1}, state.idToIndexMap)
+		assert.Equal(t, 2, state.nextIndex)
 		// Verify accumulator output.
 		acc := openai.ChatCompletionAccumulator{}
 		acc.AddChunk(fixed)
@@ -8753,8 +8753,8 @@ func TestFixToolCallIndices_ParallelToolCallsWithZeroIndex(t *testing.T) {
 
 	t.Run("fix indices for multiple tool calls in a single chunk with colliding non-zero index", func(t *testing.T) {
 		// This test covers providers that emit multiple t
```

**File**: `model/openai/stream_tool_index_test.go` (added, +652/-0)
```diff
@@ -0,0 +1,652 @@
+//
+// Tencent is pleased to support the open source community by making trpc-agent-go available.
+//
+// Copyright (C) 2026 Tencent.  All rights reserved.
+//
+// trpc-agent-go is licensed under the Apache License Version 2.0.
+//
+//
+
+package openai
+
+import (
+	"context"
+	"fmt"
+	"net/http"
+	"net/http/httptest"
+	"testing"
+	"time"
+
+	openai "github.com/openai/openai-go"
+	"github.com/stretchr/testify/assert"
+	"github.com/stretchr/testify/require"
+
+	"trpc.group/trpc-go/trpc-agent-go/model"
+)
+
+func TestFixToolCallIndices_NegativeIndices(t *testing.T) {
+	tests := []struct {
+		name    string
+		choices string
+		indices [][]int64
+		mapping map[string]int
+	}{
+		{
+			name:    "first tool call",
+			choices: `[{"index":0,"delta":{"tool_calls":[{"index":-1,"id":"call_a","type":"function","function":{"name":"file_write","arguments":"{}"}}]}}]`,
+			indices: [][]int64{{0}},
+			mapping: map[string]int{"call_a": 0},
+		},
+		{
+			name:    "without ID",
+			choices: `[{"index":0,"delta":{"tool_calls":[{"index":-1,"function":{"arguments":"{}"}}]}}]`,
+			indices: [][]int64{{0}},
+			mapping: map[string]int{},
+		},
+		{
+			name:    "multiple IDs sharing a negative index",
+			choices: `[{"index":0,"delta":{"tool_calls":[{"index":-1,"id":"call_a","function":{"name":"first","arguments":"{}"}},{"index":-1,"id":"call_b","function":{"name":"second","arguments":"{}"}}]}}]`,
+			indices: [][]int64{{0, 1}},
+			mapping: map[string]int{"call_a": 0, "call_b": 1},
+		},
+		{
+			name:    "negative index outside first choice",
+			choices: `[{"index":0,"delta":{"content":"text"}},{"index":1,"delta":{"tool_calls":[{"index":-2,"id":"call_b","function":{"name":"second","arguments":"{}"}}]}}]`,
+			indices: [][]int64{nil, {0}},
+			mapping: map[string]int{},
+		},
+		{
+			name:    "valid sparse index is preserved",
+			choices: `[{"index":0,"delta":{"tool_calls":[{"index":3,"id":"call_a","function":{"name":"first","arguments":"{}"}}]}}]`,
+			indices: [][]int64{{3}},
+			mapping: map[string]int{"call_a": 3},
+		},
+		{
+			name:    "reserve valid index before negative index",
+			choices: `[{"index":0,"delta":{"tool_calls":[{"index":-1,"id":"call_a","function":{"name":"first","arguments":"{}"}},{"index":0,"id":"call_b","function":{"name":"second","arguments":"{}"}}]}}]`,
+			indices: [][]int64{{1, 0}},
+			mapping: map[string]int{"call_a": 1, "call_b": 0},
+		},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			raw := `{"id":"test","object":"chat.completion.chunk","choices":` + tt.choices + `}`
+			chunk := parseChunkWithExtraFields(t, raw)
+			original := parseChunkWithExtraFields(t, raw)
+			state := newToolCallIndexState()
+			states := map[int64]*toolCallIndexState{0: state}
+			fixed := fixToolCallIndices(chunk, states)
+			assert.Equal(t, original, chunk, "normalization must not mutate the input")
+			assert.Equal(t, tt.mapping, state.idToIndexMap)
+			for i, indices := range tt.indices {
+				for j, index := range indices {
+					assert.Equal(t, index, fixed.Choices[i].Delta.ToolCalls[j].Index)
+				}
+			}
+			var acc openai.ChatCompletionAccumulator
+			require.NotPanics(t, func() { require.True(t, acc.AddChunk(fixed)) })
+			// Finishing the delta also exercises the SDK's saved tool index.
+			finish := parseChunkWithExtraFields(t, `{"id":"test","choices":[{"index":0,"delta":{},"finish_reason":"tool_calls"}]}`)
+			require.NotPanics(t, func() {
+				require.True(t, acc.AddChunk(finish))
+				acc.JustFinishedToolCall()
+			})
+		})
+	}
+}
+
+func TestFixToolCallIndices_ChoiceScopedMappings(t *testing.T) {
+	states := make(map[int64]*toolCallIndexState)
+	chunks := []string{
+		`{"id":"test","choices":[{"index":0,"delta":{"tool_calls":[{"index":-1,"id":"shared","function":{"name":"first","arguments":""}}]}},{"index":1,"delta":{"tool_calls":[{"index":0,"id":"valid","function":{"name":"second","arguments":""}},{"index":-1,"id":"shared","function":{"name":"third","arguments":""}}]}}]}`,
+		`{"id":"test","choices":[{"index":1,"delta":{"tool_calls":[{"index":-1,"function":{"arguments":"{\"c\":3}"}},{"index":0,"function":{"arguments":"{\"b\":2}"}}]}},{"index":0,"delta":{"tool_calls":[{"index":-1,"function":{"arguments":"{\"a\":1}"}}]}}]}`,
+		`{"id":"test","choices":[{"index":1,"delta":{"tool_calls":[{"index":-1,"id":"shared","function":{"arguments":""}}]}}]}`,
+	}
+	var acc openai.ChatCompletionAccumulator
+	var m Model
+	mapping := make(map[string]int)
+	for _, raw := range chunks {
+		chunk := parseChunkWithExtraFields(t, raw)
+		original := parseChunkWithExtraFields(t, raw)
+		fixed := fixToolCallIndices(chunk, states)
+		assert.Equal(t, original, chunk)
+		m.updateToolCallIndexMapping(fixed, mapping)
+		require.True(t, acc.AddChunk(fixed))
+	}
+	require.Len(t, acc.Choices, 2)
+	require.Len(t, acc.Choices[0].Message.ToolCalls, 1)
+	require.Len(t, acc.Choices[1].Message.ToolCalls, 2)
+	assert.Equal(t, "shared", acc.Choices[0].Message.ToolCalls[0].ID)
+	assert.Eq
```

---

### Incident Patch 3: `40ea803f` (2026-09-16)
**Commit Message**: session/inmemory: preserve initialization errors during shutdown (#2611)

## What changed

In-memory session-state initialization now distinguishes service
shutdown from caller cancellation and deadlines consistently. A
successful initializer no longer intermittently turns service shutdown
into `context.Canceled`. Cancellation that becomes visible while waiting
for either commit lock aborts before writing the primary value or its
projections.

## Why

The initializer context is canceled by both the caller and shutdown.
Previously, the post-initializer check classified shutdown separately,
but the commit path returned the child context's error directly. It also
checked cancellation only before acquiring the coordination and storage
locks, allowing a call canceled during lock contention to commit
successfully.

The commit path now checks the original caller context separately from
the close notification, rechecks cancellation after acquiring the
coordination lock, and checks again before the state batch is written
under the storage lock.

These windows have existed since 760a6184 (#2406, related to #2260). The
shutdown error mismatch surfaced in [the CI run for
#2609](https://github.

**File**: `session/inmemory/state_initialization.go` (modified, +23/-8)
```diff
@@ -44,7 +44,14 @@ func (g *stateInitializationGate) release() {
 	g.once.Do(func() { close(g.done) })
 }
 
-// LoadOrInitializeSessionState implements session.StateInitializationService.
+// LoadOrInitializeSessionState returns a valid persisted value for stateKey.
+// If the current value is absent or invalid, it coordinates initialization and
+// commits the replacement with its projections to the same session generation.
+// See session.StateInitializationService for the complete callback contract.
+//
+// Close cancels in-flight initializers and prevents further initialization
+// commits. After a successful initializer, lifecycle checks give an already
+// canceled caller context precedence over service closure.
 func (s *SessionService) LoadOrInitializeSessionState(
 	ctx context.Context,
 	key session.Key,
@@ -234,14 +241,14 @@ func (s *SessionService) initializeSessionState(
 		}
 		return nil, false, callbackErr
 	}
-	if err := initializeCtx.Err(); err != nil {
-		select {
-		case <-s.stateInitializationClosed:
-			return nil, false, errStateInitializationClosed
-		default:
-		}
+	if err := ctx.Err(); err != nil {
 		return nil, false, err
 	}
+	select {
+	case <-s.stateInitializationClosed:
+		return nil, false, errStateInitializationClosed
+	default:
+	}
 	value = cloneStateInitializationValue(value)
 	if !validate(cloneStateInitializationValue(value)) {
 		return nil, false, errors.New("initialize session state: callback returned an invalid value")
@@ -251,7 +258,7 @@ func (s *SessionService) initializeSessionState(
 		return nil, false, err
 	}
 	if err := s.commitInitializedSessionState(
-		initializeCtx,
+		ctx,
 		key,
 		generation,
 		state,
@@ -352,11 +359,16 @@ func (s *SessionService) commitInitializedSessionState(
 	generation *sessionWithTTL,
 	state session.StateMap,
 ) error {
+	// Use the caller context here; service closure is checked separately under
+	// the commit lock so its cancellation of the initializer cannot mask it.
 	if err := ctx.Err(); err != nil {
 		return err
 	}
 	s.stateInitializationMu.Lock()
 	defer s.stateInitializationMu.Unlock()
+	if err := ctx.Err(); err != nil {
+		return err
+	}
 	select {
 	case <-s.stateInitializationClosed:
 		return errStateInitializationClosed
@@ -382,6 +394,9 @@ func (s *SessionService) commitInitializedSessionState(
 			"memory session service initialize session state failed: session generation changed",
 		)
 	}
+	if err := ctx.Err(); err != nil {
+		return err
+	}
 	for stateKey, value := range state {
 		stored.session.SetState(stateKey, value)
 	}
```

**File**: `session/inmemory/state_initialization_test.go` (modified, +281/-1)
```diff
@@ -11,6 +11,7 @@ package inmemory
 import (
 	"context"
 	"errors"
+	"runtime"
 	"sync"
 	"sync/atomic"
 	"testing"
@@ -534,7 +535,286 @@ func TestLoadOrInitializeSessionStateCloseCancelsOwner(t *testing.T) {
 	<-ownerStarted
 
 	require.NoError(t, service.Close())
-	require.ErrorIs(t, <-ownerDone, context.Canceled)
+	err = <-ownerDone
+	require.ErrorIs(t, err, context.Canceled)
+	require.ErrorIs(t, err, errStateInitializationClosed)
+}
+
+func TestLoadOrInitializeSessionStateLifecycleBeforeCommit(t *testing.T) {
+	for _, phase := range []string{"initializer", "projection"} {
+		t.Run(phase, func(t *testing.T) {
+			for _, test := range []struct {
+				name       string
+				callerErr  error
+				closeFirst bool
+				closeLast  bool
+			}{
+				{name: "service close", closeFirst: true},
+				{name: "caller cancellation", callerErr: context.Canceled},
+				{name: "caller deadline", callerErr: context.DeadlineExceeded},
+				{name: "caller cancellation then close", callerErr: context.Canceled, closeLast: true},
+				{name: "caller deadline then close", callerErr: context.DeadlineExceeded, closeLast: true},
+				{name: "close then caller cancellation", callerErr: context.Canceled, closeFirst: true},
+				{name: "close then caller deadline", callerErr: context.DeadlineExceeded, closeFirst: true},
+			} {
+				t.Run(test.name, func(t *testing.T) {
+					ctx := context.Background()
+					key := session.Key{AppName: "app", UserID: "user", SessionID: "session"}
+					service := NewSessionService()
+					t.Cleanup(func() { require.NoError(t, service.Close()) })
+					_, err := service.CreateSession(ctx, key, nil)
+					require.NoError(t, err)
+
+					var callCtx context.Context
+					var cancel context.CancelFunc
+					if test.callerErr == context.DeadlineExceeded {
+						callCtx, cancel = context.WithTimeout(ctx, time.Second)
+					} else {
+						callCtx, cancel = context.WithCancel(ctx)
+					}
+					t.Cleanup(cancel)
+
+					wait := func(done <-chan struct{}) {
+						t.Helper()
+						select {
+						case <-done:
+						case <-time.After(5 * time.Second):
+							t.Fatal("state initialization lifecycle did not complete")
+						}
+					}
+					reached := make(chan context.Context, 1)
+					release := make(chan struct{})
+					var releaseOnce sync.Once
+					unblock := func() { releaseOnce.Do(func() { close(release) }) }
+					type result struct {
+						value       []byte
+						initialized bool
+						err         error
+					}
+					results := make(chan result, 1)
+					ownerDone := make(chan struct{})
+					t.Cleanup(func() {
+						cancel()
+						unblock()
+						wait(ownerDone)
+					})
+					go func() {
+						defer close(ownerDone)
+						var initializeCtx context.Context
+						value, initialized, err := service.LoadOrInitializeSessionState(
+							callCtx, key, "canonical",
+							func(value []byte) bool { return string(value) == "value" },
+							func(ctx context.Context) ([]byte, error) {
+								initializeCtx = ctx
+								if phase == "initializer" {
+									reached <- ctx
+									<-release
+								}
+								return []byte("value"), nil
+							},
+							session.StateInitializationProjection{
+								StateKey: "projected",
+								Project: func([]byte) ([]byte, error) {
+									// Hold the public call between its context check and commit.
+									if phase == "projection" {
+										reached <- initializeCtx
+										<-release
+									}
+									return []byte("projection"), nil
+								},
+							},
+						)
+						results <- result{value: value, initialized: initialized, err: err}
+					}()
+
+					var initializeCtx context.Context
+					select {
+					case initializeCtx = <-reached:
+					case <-time.After(5 * time.Second):
+						t.Fatal("state initialization did not reach the barrier")
+					}
+					if test.closeFirst {
+						require.NoError(t, service.Close())
+						wait(initializeCtx.Done())
+					}
+					if test.callerErr != nil {
+						if test.callerErr == context.Canceled {
+							cancel()
+						}
+						wait(callCtx.Done())
+						require.ErrorIs(t, callCtx.Err(), test.callerErr)
+						wait(initializeCtx.Done())
+					}
+					if test.closeLast {
+						require.NoError(t, service.Close())
+					}
+					unblock()
+					wait(ownerDone)
+					got := <-results
+					wantErr := test.callerErr
+					if wantErr == nil {
+						wantErr = errStateInitializationClosed
+					}
+					require.ErrorIs(t, got.err, wantErr)
+					if test.callerErr != nil {
+						require.NotErrorIs(t, got.err, errStateInitializationClosed)
+					} else {
+						require.NotErrorIs(t, got.err, context.Canceled)
+					}
+					require.False(t, got.initialized)
+					require.Nil(t, got.value)
+					stored, err := service.GetSession(ctx, key)
+					require.NoError(t, err)
+					for _, stateKey := range []string{"canonical", "projected"} {
+						_, present := stored.GetState(stateKey)
+						require.False(t, present, "unexpected commit to %s", stateKey)
+					}
+					service.stateInitializationMu.L
```

---

### Incident Patch 4: `44921489` (2026-09-09)
**Commit Message**: docs: add Memory blog (#2589)

Add memory.md into docs

**File**: `docs/mkdocs.yml` (modified, +2/-0)
```diff
@@ -110,6 +110,7 @@ nav:
   - Ecosystem: ecosystem.md
   - Blog:
       - "A Go Agent Framework for Building Intelligent AI Applications": blog/trpcagentgo.md
+      - "tRPC-Agent-Go Memory: How Agent Memory Is Formed, Retrieved, and Connected to External Platforms": blog/memory.md
       - "Context Management Design and Evaluation for Long-Running Agents": blog/summary.md
       - "tRPC-Agent-Go Evolution: Online Learning, Offline Optimization, and Evaluation for Self-Improving Agents": blog/evolution.md
       - "Seeing the Agent Runtime: Observability Design in tRPC-Agent-Go": blog/observability.md
@@ -242,6 +243,7 @@ plugins:
             - 生态: ecosystem.md
             - 博客:
                 - "构建智能 AI 应用的 Go 语言 Agent 框架": blog/trpcagentgo.md
+                - "tRPC-Agent-Go Memory：Agent 记忆的形成、取回与外部记忆平台接入": blog/memory.md
                 - "长任务 Agent 上下文管理的设计与评测": blog/summary.md
                 - "tRPC-Agent-Go Evolution：Agent 自进化的在线学习、离线优化与评测": blog/evolution.md
                 - "看见 Agent 运行时：tRPC-Agent-Go 可观测的设计与取舍": blog/observability.md
```

**File**: `docs/mkdocs/assets/img/blog/memory/memory-preload-budget-en.svg` (added, +108/-0)
```diff
@@ -0,0 +1,108 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-labelledby="title desc">
+  <title id="title">preload Selects a Memory Read Path from Its Budget</title>
+  <desc id="desc">A zero preload disables reading, a negative value reads all Entries, and a positive value reads N+1 Entries before searching for the most relevant N when the budget is exceeded. The model call continues if reading fails.</desc>
+  <defs>
+    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
+      <path d="M32 0H0V32" fill="none" stroke="#D9E6F2" stroke-width="1" opacity="0.38"/>
+    </pattern>
+    <marker id="arrow-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#3478F6"/>
+    </marker>
+    <marker id="arrow-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#21A179"/>
+    </marker>
+    <marker id="arrow-gray" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#8EA6BA"/>
+    </marker>
+  </defs>
+
+  <rect width="1600" height="900" fill="#F8FBFE"/>
+  <rect width="1600" height="900" fill="url(#grid)"/>
+
+  <g font-family="Inter, Arial, sans-serif">
+    <text x="72" y="78" fill="#102E4A" font-size="38" font-weight="500">preload Chooses a Memory Read Path from Its Budget</text>
+    <text x="72" y="120" fill="#647B91" font-size="21">A positive N is this turn's Memory budget; N+1 only decides whether search is needed</text>
+
+    <!-- Root -->
+    <circle cx="132" cy="444" r="62" fill="#3478F6"/>
+    <text x="132" y="452" fill="#FFFFFF" font-size="24" font-weight="500" text-anchor="middle">preload</text>
+
+    <!-- Three mode branches -->
+    <path d="M194 420C245 420 244 250 320 250" fill="none" stroke="#8EA6BA" stroke-width="4" marker-end="url(#arrow-gray)"/>
+    <path d="M194 444H320" fill="none" stroke="#3478F6" stroke-width="4" marker-end="url(#arrow-blue)"/>
+    <path d="M194 468C245 468 244 646 320 646" fill="none" stroke="#21A179" stroke-width="4" marker-end="url(#arrow-teal)"/>
+
+    <circle cx="348" cy="250" r="28" fill="#E8EEF5"/>
+    <text x="348" y="258" fill="#425D73" font-size="23" font-weight="500" text-anchor="middle">0</text>
+    <text x="397" y="245" fill="#425D73" font-size="22" font-weight="500">Disable preload</text>
+    <text x="397" y="276" fill="#71879B" font-size="17">Do not access Memory</text>
+
+    <circle cx="348" cy="444" r="28" fill="#DCEBFF"/>
+    <text x="348" y="452" fill="#174A7C" font-size="21" font-weight="500" text-anchor="middle">&lt;0</text>
+    <rect x="397" y="400" width="254" height="88" rx="18" fill="#EAF2FF" stroke="#8FB4E8" stroke-width="2"/>
+    <text x="524" y="438" fill="#174A7C" font-size="20" font-weight="500" text-anchor="middle">Read(limit=0)</text>
+    <text x="524" y="468" fill="#597188" font-size="17" text-anchor="middle">Read all Entries</text>
+
+    <circle cx="348" cy="646" r="28" fill="#DFF5EC"/>
+    <text x="348" y="654" fill="#176A50" font-size="21" font-weight="500" text-anchor="middle">&gt;0</text>
+    <rect x="397" y="602" width="220" height="88" rx="18" fill="#E4F6F0" stroke="#70BEA0" stroke-width="2"/>
+    <text x="507" y="640" fill="#176A50" font-size="21" font-weight="500" text-anchor="middle">Read N+1 first</text>
+    <text x="507" y="670" fill="#527969" font-size="17" text-anchor="middle">Detect budget overflow</text>
+
+    <!-- Positive N decision -->
+    <path d="M617 646H686" stroke="#21A179" stroke-width="4" marker-end="url(#arrow-teal)"/>
+    <path d="M754 586 822 646 754 706 686 646Z" fill="#FFFFFF" stroke="#21A179" stroke-width="3"/>
+    <text x="754" y="640" fill="#176A50" font-size="18" font-weight="500" text-anchor="middle">Count</text>
+    <text x="754" y="665" fill="#176A50" font-size="18" font-weight="500" text-anchor="middle">&gt; N?</text>
+
+    <!-- No overflow -->
+    <path d="M754 586V530H925" fill="none" stroke="#3478F6" stroke-width="4" marker-end="url(#arrow-blue)"/>
+    <text x="786" y="555" fill="#2F68C4" font-size="17">No</text>
+    <rect x="937" y="493" width="214" height="74" rx="18" fill="#EAF2FF" stroke="#8FB4E8" stroke-width="2"/>
+    <text x="1044" y="524" fill="#174A7C" font-size="19" font-weight="500" text-anchor="middle">Inject directly</text>
+    <text x="1044" y="550" fill="#597188" font-size="17" text-anchor="middle">Existing Entries</text>
+
+    <!-- Overflow path -->
+    <path d="M822 646H882" stroke="#21A179" stroke-width="4" marker-end="url(#arrow-teal)"/>
+    <text x="850" y="629" fill="#177B5B" font-size="17">Yes</text>
+    <rect x="894" y="602" width="184" height="88" rx="18" fill="#E4F6F0" stroke="#70BEA0" stroke-width="2"/>
+    <text x="986" y="640" fill="#176A50" font-size="21" font-weight="500" text-anchor="middle">Search(N)</text>
+    <text x="98
```

**File**: `docs/mkdocs/assets/img/blog/memory/memory-preload-budget.svg` (added, +108/-0)
```diff
@@ -0,0 +1,108 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-labelledby="title desc">
+  <title id="title">preload 根据预算选择记忆读取路径</title>
+  <desc id="desc">preload 为零时不读取，小于零时读取全部，大于零时先读取 N 加一条，并在超过预算时搜索最相关的 N 条；读取失败时模型调用继续。</desc>
+  <defs>
+    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
+      <path d="M32 0H0V32" fill="none" stroke="#D9E6F2" stroke-width="1" opacity="0.38"/>
+    </pattern>
+    <marker id="arrow-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#3478F6"/>
+    </marker>
+    <marker id="arrow-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#21A179"/>
+    </marker>
+    <marker id="arrow-gray" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#8EA6BA"/>
+    </marker>
+  </defs>
+
+  <rect width="1600" height="900" fill="#F8FBFE"/>
+  <rect width="1600" height="900" fill="url(#grid)"/>
+
+  <g font-family="PingFang SC, Microsoft YaHei, Noto Sans CJK SC, Arial, sans-serif">
+    <text x="72" y="78" fill="#102E4A" font-size="38" font-weight="500">preload 先看预算，再决定怎样读取 Memory</text>
+    <text x="72" y="120" fill="#647B91" font-size="21">正数 N 是本轮的记忆预算，N+1 只用于判断是否需要搜索</text>
+
+    <!-- Root -->
+    <circle cx="132" cy="444" r="62" fill="#3478F6"/>
+    <text x="132" y="452" fill="#FFFFFF" font-size="24" font-weight="500" text-anchor="middle">preload</text>
+
+    <!-- Three mode branches -->
+    <path d="M194 420C245 420 244 250 320 250" fill="none" stroke="#8EA6BA" stroke-width="4" marker-end="url(#arrow-gray)"/>
+    <path d="M194 444H320" fill="none" stroke="#3478F6" stroke-width="4" marker-end="url(#arrow-blue)"/>
+    <path d="M194 468C245 468 244 646 320 646" fill="none" stroke="#21A179" stroke-width="4" marker-end="url(#arrow-teal)"/>
+
+    <circle cx="348" cy="250" r="28" fill="#E8EEF5"/>
+    <text x="348" y="258" fill="#425D73" font-size="23" font-weight="500" text-anchor="middle">0</text>
+    <text x="397" y="245" fill="#425D73" font-size="22" font-weight="500">关闭预加载</text>
+    <text x="397" y="276" fill="#71879B" font-size="17">不访问 Memory</text>
+
+    <circle cx="348" cy="444" r="28" fill="#DCEBFF"/>
+    <text x="348" y="452" fill="#174A7C" font-size="21" font-weight="500" text-anchor="middle">&lt;0</text>
+    <rect x="397" y="400" width="254" height="88" rx="18" fill="#EAF2FF" stroke="#8FB4E8" stroke-width="2"/>
+    <text x="524" y="438" fill="#174A7C" font-size="20" font-weight="500" text-anchor="middle">Read(limit=0)</text>
+    <text x="524" y="468" fill="#597188" font-size="17" text-anchor="middle">读取全部 Entry</text>
+
+    <circle cx="348" cy="646" r="28" fill="#DFF5EC"/>
+    <text x="348" y="654" fill="#176A50" font-size="21" font-weight="500" text-anchor="middle">&gt;0</text>
+    <rect x="397" y="602" width="220" height="88" rx="18" fill="#E4F6F0" stroke="#70BEA0" stroke-width="2"/>
+    <text x="507" y="640" fill="#176A50" font-size="21" font-weight="500" text-anchor="middle">先读 N+1 条</text>
+    <text x="507" y="670" fill="#527969" font-size="17" text-anchor="middle">探测是否超出预算</text>
+
+    <!-- Positive N decision -->
+    <path d="M617 646H686" stroke="#21A179" stroke-width="4" marker-end="url(#arrow-teal)"/>
+    <path d="M754 586 822 646 754 706 686 646Z" fill="#FFFFFF" stroke="#21A179" stroke-width="3"/>
+    <text x="754" y="640" fill="#176A50" font-size="18" font-weight="500" text-anchor="middle">数量</text>
+    <text x="754" y="665" fill="#176A50" font-size="18" font-weight="500" text-anchor="middle">超过 N？</text>
+
+    <!-- No overflow -->
+    <path d="M754 586V530H925" fill="none" stroke="#3478F6" stroke-width="4" marker-end="url(#arrow-blue)"/>
+    <text x="786" y="555" fill="#2F68C4" font-size="17">没有</text>
+    <rect x="937" y="493" width="214" height="74" rx="18" fill="#EAF2FF" stroke="#8FB4E8" stroke-width="2"/>
+    <text x="1044" y="524" fill="#174A7C" font-size="19" font-weight="500" text-anchor="middle">直接注入</text>
+    <text x="1044" y="550" fill="#597188" font-size="17" text-anchor="middle">已有 Entry</text>
+
+    <!-- Overflow path -->
+    <path d="M822 646H882" stroke="#21A179" stroke-width="4" marker-end="url(#arrow-teal)"/>
+    <text x="850" y="629" fill="#177B5B" font-size="17">超过</text>
+    <rect x="894" y="602" width="184" height="88" rx="18" fill="#E4F6F0" stroke="#70BEA0" stroke-width="2"/>
+    <text x="986" y="640" fill="#176A50" font-size="21" font-weight="500" text-anchor="middle">Search(N)</text>
+    <text x="986" y="670" fill="#527969" font-size="17" text-anchor="middle">按当前问题搜索</text>
+
+    <path d="M1078 646H1122" stroke="#21A179" stroke-width="4" marker-end="url(#arrow-teal)"/>
+    <path d="M1180 594 1238 646 1180 698 1122 646Z" fill="#FFFFFF" stroke="#21A179" stroke-width="3"/>
+    <text 
```

**File**: `docs/mkdocs/assets/img/blog/memory/memory-recall-checkpoints-en.svg` (added, +126/-0)
```diff
@@ -0,0 +1,126 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-labelledby="title desc">
+  <title id="title">Memory Passes Four Gates Before Reaching an Answer</title>
+  <desc id="desc">The same rule passes through a Session Event, Memory Entry, Reader, model request, and final answer. Formation, retrieval, injection, or use can fail independently.</desc>
+  <defs>
+    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
+      <path d="M32 0H0V32" fill="none" stroke="#D9E6F2" stroke-width="1" opacity="0.38"/>
+    </pattern>
+    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#3478F6"/>
+    </marker>
+  </defs>
+
+  <rect width="1600" height="900" fill="#F8FBFE"/>
+  <rect width="1600" height="900" fill="url(#grid)"/>
+
+  <g font-family="Inter, Arial, sans-serif">
+    <text x="72" y="78" fill="#102E4A" font-size="38" font-weight="500">An Agent Can Forget at Four Different Gates</text>
+    <text x="72" y="120" fill="#647B91" font-size="21">Trace the same information forward to find where the path broke</text>
+
+    <!-- One information token travels through the whole path -->
+    <rect x="610" y="164" width="380" height="62" rx="14" fill="#FFF2D9" stroke="#E7B65A" stroke-width="2"/>
+    <path d="M642 181h23l9 9v20h-32Z" fill="#FFFFFF" stroke="#D49B32" stroke-width="2"/>
+    <path d="M665 181v9h9" fill="none" stroke="#D49B32" stroke-width="2"/>
+    <text x="830" y="204" fill="#714C13" font-size="17" font-weight="500" text-anchor="middle">Rule moves through each stage</text>
+
+    <path d="M180 420H1392" fill="none" stroke="#BCD0E3" stroke-width="12" stroke-linecap="round"/>
+
+    <!-- Connectors -->
+    <g fill="none" stroke="#3478F6" stroke-width="5" marker-end="url(#arrow)">
+      <line x1="256" y1="420" x2="396" y2="420"/>
+      <line x1="546" y1="420" x2="686" y2="420"/>
+      <line x1="836" y1="420" x2="976" y2="420"/>
+      <line x1="1126" y1="420" x2="1266" y2="420"/>
+    </g>
+
+    <!-- Stage 1: Session Event -->
+    <g transform="translate(118 346)">
+      <path d="M20 0H104Q124 0 124 20V82Q124 102 104 102H58L30 126V102H20Q0 102 0 82V20Q0 0 20 0Z" fill="#EAF2FF" stroke="#76A7F5" stroke-width="3"/>
+      <path d="M27 31h70M27 52h56M27 73h64" stroke="#3478F6" stroke-width="4" stroke-linecap="round"/>
+    </g>
+    <text x="180" y="550" fill="#174A7C" font-size="23" font-weight="500" text-anchor="middle">Session Event</text>
+    <text x="180" y="582" fill="#657D92" font-size="18" text-anchor="middle">Original wording saved</text>
+
+    <!-- Stage 2: Memory Entry -->
+    <g transform="translate(418 355)">
+      <ellipse cx="53" cy="17" rx="53" ry="17" fill="#CFEEDF" stroke="#45A982" stroke-width="3"/>
+      <path d="M0 17v78c0 10 24 18 53 18s53-8 53-18V17" fill="#DFF5EC" stroke="#45A982" stroke-width="3"/>
+      <path d="M0 55c0 10 24 18 53 18s53-8 53-18" fill="none" stroke="#45A982" stroke-width="3"/>
+    </g>
+    <text x="470" y="550" fill="#176A50" font-size="23" font-weight="500" text-anchor="middle">Memory Entry</text>
+    <text x="470" y="582" fill="#657D92" font-size="18" text-anchor="middle">Long-term information formed</text>
+
+    <!-- Stage 3: Reader hit -->
+    <g transform="translate(704 352)">
+      <circle cx="49" cy="49" r="38" fill="#EAF2FF" stroke="#3478F6" stroke-width="4"/>
+      <line x1="77" y1="77" x2="108" y2="108" stroke="#3478F6" stroke-width="8" stroke-linecap="round"/>
+      <path d="M31 48h36M31 63h25" stroke="#3478F6" stroke-width="4" stroke-linecap="round"/>
+    </g>
+    <text x="760" y="550" fill="#174A7C" font-size="23" font-weight="500" text-anchor="middle">Reader hit</text>
+    <text x="760" y="582" fill="#657D92" font-size="18" text-anchor="middle">Retrieved this turn</text>
+
+    <!-- Stage 4: request -->
+    <g transform="translate(1001 342)">
+      <path d="M0 0h82l30 30v110H0Z" fill="#FFFFFF" stroke="#7DA9E7" stroke-width="3"/>
+      <path d="M82 0v30h30" fill="#DCEBFF" stroke="#7DA9E7" stroke-width="3"/>
+      <rect x="18" y="51" width="75" height="18" rx="5" fill="#FFF2D9"/>
+      <rect x="18" y="80" width="62" height="10" rx="5" fill="#CFE0F4"/>
+      <rect x="18" y="102" width="72" height="10" rx="5" fill="#CFE0F4"/>
+    </g>
+    <text x="1050" y="550" fill="#174A7C" font-size="23" font-weight="500" text-anchor="middle">Model request</text>
+    <text x="1050" y="582" fill="#657D92" font-size="18" text-anchor="middle">Relevant content injected</text>
+
+    <!-- Stage 5: answer -->
+    <g transform="translate(1284 348)">
+      <rect x="0" y="22" width="112" height="92" rx="28" fill="#DFF5EC" stroke="#45A982" stroke-width="3"/>
+      <circle cx="36" cy="65" r="8" fill="#16815D"/>
+      <circle cx="76" cy="65" r="8" fill="#16815D"/>
+      <path d="M34 88q22 18 44 0" fill="none" stroke="#16815D" stroke-width="4" stroke-linecap="round"
```

**File**: `docs/mkdocs/assets/img/blog/memory/memory-recall-checkpoints.svg` (added, +126/-0)
```diff
@@ -0,0 +1,126 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-labelledby="title desc">
+  <title id="title">记忆从会话进入回答要经过四个关口</title>
+  <desc id="desc">同一条规则依次经过 Session Event、Memory Entry、Reader、模型请求和最终回答。形成、取回、注入和采用中的任何一步都可能中断。</desc>
+  <defs>
+    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
+      <path d="M32 0H0V32" fill="none" stroke="#D9E6F2" stroke-width="1" opacity="0.38"/>
+    </pattern>
+    <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#3478F6"/>
+    </marker>
+  </defs>
+
+  <rect width="1600" height="900" fill="#F8FBFE"/>
+  <rect width="1600" height="900" fill="url(#grid)"/>
+
+  <g font-family="PingFang SC, Microsoft YaHei, Noto Sans CJK SC, Arial, sans-serif">
+    <text x="72" y="78" fill="#102E4A" font-size="38" font-weight="500">Agent 说「忘了」，信息可能停在四个关口</text>
+    <text x="72" y="120" fill="#647B91" font-size="21">沿着同一条信息向后检查，才能知道问题发生在哪一步</text>
+
+    <!-- One information token travels through the whole path -->
+    <rect x="610" y="164" width="380" height="62" rx="14" fill="#FFF2D9" stroke="#E7B65A" stroke-width="2"/>
+    <path d="M642 181h23l9 9v20h-32Z" fill="#FFFFFF" stroke="#D49B32" stroke-width="2"/>
+    <path d="M665 181v9h9" fill="none" stroke="#D49B32" stroke-width="2"/>
+    <text x="696" y="204" fill="#714C13" font-size="20" font-weight="500">同一条规则沿链路向右传递</text>
+
+    <path d="M180 420H1392" fill="none" stroke="#BCD0E3" stroke-width="12" stroke-linecap="round"/>
+
+    <!-- Connectors -->
+    <g fill="none" stroke="#3478F6" stroke-width="5" marker-end="url(#arrow)">
+      <line x1="256" y1="420" x2="396" y2="420"/>
+      <line x1="546" y1="420" x2="686" y2="420"/>
+      <line x1="836" y1="420" x2="976" y2="420"/>
+      <line x1="1126" y1="420" x2="1266" y2="420"/>
+    </g>
+
+    <!-- Stage 1: Session Event -->
+    <g transform="translate(118 346)">
+      <path d="M20 0H104Q124 0 124 20V82Q124 102 104 102H58L30 126V102H20Q0 102 0 82V20Q0 0 20 0Z" fill="#EAF2FF" stroke="#76A7F5" stroke-width="3"/>
+      <path d="M27 31h70M27 52h56M27 73h64" stroke="#3478F6" stroke-width="4" stroke-linecap="round"/>
+    </g>
+    <text x="180" y="550" fill="#174A7C" font-size="23" font-weight="500" text-anchor="middle">Session Event</text>
+    <text x="180" y="582" fill="#657D92" font-size="18" text-anchor="middle">原话已经保存</text>
+
+    <!-- Stage 2: Memory Entry -->
+    <g transform="translate(418 355)">
+      <ellipse cx="53" cy="17" rx="53" ry="17" fill="#CFEEDF" stroke="#45A982" stroke-width="3"/>
+      <path d="M0 17v78c0 10 24 18 53 18s53-8 53-18V17" fill="#DFF5EC" stroke="#45A982" stroke-width="3"/>
+      <path d="M0 55c0 10 24 18 53 18s53-8 53-18" fill="none" stroke="#45A982" stroke-width="3"/>
+    </g>
+    <text x="470" y="550" fill="#176A50" font-size="23" font-weight="500" text-anchor="middle">Memory Entry</text>
+    <text x="470" y="582" fill="#657D92" font-size="18" text-anchor="middle">长期信息已形成</text>
+
+    <!-- Stage 3: Reader hit -->
+    <g transform="translate(704 352)">
+      <circle cx="49" cy="49" r="38" fill="#EAF2FF" stroke="#3478F6" stroke-width="4"/>
+      <line x1="77" y1="77" x2="108" y2="108" stroke="#3478F6" stroke-width="8" stroke-linecap="round"/>
+      <path d="M31 48h36M31 63h25" stroke="#3478F6" stroke-width="4" stroke-linecap="round"/>
+    </g>
+    <text x="760" y="550" fill="#174A7C" font-size="23" font-weight="500" text-anchor="middle">Reader 命中</text>
+    <text x="760" y="582" fill="#657D92" font-size="18" text-anchor="middle">本轮已经取回</text>
+
+    <!-- Stage 4: request -->
+    <g transform="translate(1001 342)">
+      <path d="M0 0h82l30 30v110H0Z" fill="#FFFFFF" stroke="#7DA9E7" stroke-width="3"/>
+      <path d="M82 0v30h30" fill="#DCEBFF" stroke="#7DA9E7" stroke-width="3"/>
+      <rect x="18" y="51" width="75" height="18" rx="5" fill="#FFF2D9"/>
+      <rect x="18" y="80" width="62" height="10" rx="5" fill="#CFE0F4"/>
+      <rect x="18" y="102" width="72" height="10" rx="5" fill="#CFE0F4"/>
+    </g>
+    <text x="1050" y="550" fill="#174A7C" font-size="23" font-weight="500" text-anchor="middle">模型请求</text>
+    <text x="1050" y="582" fill="#657D92" font-size="18" text-anchor="middle">目标内容已注入</text>
+
+    <!-- Stage 5: answer -->
+    <g transform="translate(1284 348)">
+      <rect x="0" y="22" width="112" height="92" rx="28" fill="#DFF5EC" stroke="#45A982" stroke-width="3"/>
+      <circle cx="36" cy="65" r="8" fill="#16815D"/>
+      <circle cx="76" cy="65" r="8" fill="#16815D"/>
+      <path d="M34 88q22 18 44 0" fill="none" stroke="#16815D" stroke-width="4" stroke-linecap="round"/>
+      <path d="M56 22V4M43 4h26" stroke="#16815D" stroke-width="4" stroke-linecap="round"/>
+    </g>
+    <text x="1340" y="550" fill="#176A50" font-size="23" font-weight="500" text-anchor="middle">最终回答</text>
+    <text x="1340" y="582" fill="#657D92
```

**File**: `docs/mkdocs/assets/img/blog/memory/memory-session-boundary-en.svg` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-labelledby="title desc">
+  <title id="title">Paths for the Same Information After Switching Sessions</title>
+  <desc id="desc">Session history and Summary remain with the original Session. User- or App-scoped State, Session Recall results, and long-term Memory Entries can enter a new Session's model request through their respective read paths.</desc>
+  <defs>
+    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
+      <path d="M32 0H0V32" fill="none" stroke="#D9E6F2" stroke-width="1" opacity="0.38"/>
+    </pattern>
+    <marker id="arrow-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#3478F6"/>
+    </marker>
+    <marker id="arrow-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#21A179"/>
+    </marker>
+    <marker id="arrow-orange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#E6A433"/>
+    </marker>
+  </defs>
+
+  <rect width="1600" height="900" fill="#F8FBFE"/>
+  <rect width="1600" height="900" fill="url(#grid)"/>
+
+  <g font-family="Inter, Arial, sans-serif">
+    <text x="72" y="78" fill="#102E4A" font-size="38" font-weight="500">Where Does Past Information Go in a New Session?</text>
+    <text x="72" y="120" fill="#647B91" font-size="21">Different storage locations use different paths into the next model request</text>
+
+    <text x="94" y="188" fill="#174A7C" font-size="26" font-weight="500">Session A</text>
+    <text x="1344" y="188" fill="#174A7C" font-size="26" font-weight="500" text-anchor="middle">Session B</text>
+
+    <line x1="800" y1="165" x2="800" y2="824" stroke="#8EA6BA" stroke-width="3" stroke-dasharray="10 12"/>
+    <rect x="704" y="142" width="192" height="44" rx="22" fill="#E8EEF5"/>
+    <text x="800" y="172" fill="#425D73" font-size="20" font-weight="500" text-anchor="middle">Switch Session</text>
+
+    <path d="M102 228H516Q542 228 542 254V310Q542 336 516 336H184L132 374V336H102Q76 336 76 310V254Q76 228 102 228Z" fill="#EAF2FF" stroke="#9CC0FA" stroke-width="2"/>
+    <circle cx="126" cy="273" r="22" fill="#3478F6"/>
+    <path d="M116 274h20M126 264v20" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>
+    <text x="166" y="274" fill="#102E4A" font-size="22" font-weight="500">Migrations need rollback scripts</text>
+    <text x="166" y="307" fill="#597188" font-size="18">This becomes a Session Event</text>
+
+    <text x="112" y="442" fill="#425D73" font-size="21" font-weight="500">History / Summary</text>
+    <line x1="330" y1="432" x2="742" y2="432" stroke="#8EA6BA" stroke-width="4" stroke-linecap="round"/>
+    <circle cx="760" cy="432" r="16" fill="#FFFFFF" stroke="#D65B59" stroke-width="4"/>
+    <path d="M751 423 769 441M769 423 751 441" stroke="#D65B59" stroke-width="4" stroke-linecap="round"/>
+    <text x="330" y="474" fill="#71879B" font-size="18">Restored when the original Session resumes</text>
+    <text x="744" y="507" fill="#B04A4A" font-size="17" text-anchor="end">Does not cross automatically</text>
+
+    <g transform="translate(112 500)">
+      <path d="M0 15C0 7 20 0 48 0s48 7 48 15v52c0 8-20 15-48 15S0 75 0 67Z" fill="#FFF2D9" stroke="#E6AE45" stroke-width="2"/>
+      <ellipse cx="48" cy="15" rx="48" ry="15" fill="#FFE7B5" stroke="#E6AE45" stroke-width="2"/>
+      <text x="120" y="36" fill="#7A5313" font-size="21" font-weight="500">State</text>
+      <text x="120" y="66" fill="#7A6746" font-size="17">Exact application value</text>
+    </g>
+    <path d="M330 542H1160" fill="none" stroke="#E6A433" stroke-width="4" stroke-linecap="round" marker-end="url(#arrow-orange)"/>
+    <text x="830" y="525" fill="#7A6746" font-size="18">User / App scope · read by key</text>
+
+    <g transform="translate(112 620)">
+      <path d="M4 8h76l20 20v62H4Z" fill="#EAF2FF" stroke="#78A9F7" stroke-width="2"/>
+      <path d="M80 8v20h20" fill="none" stroke="#78A9F7" stroke-width="2"/>
+      <path d="M25 47h54M25 66h42" stroke="#78A9F7" stroke-width="3" stroke-linecap="round"/>
+      <text x="126" y="42" fill="#174A7C" font-size="21" font-weight="500">Session Recall</text>
+      <text x="126" y="72" fill="#597188" font-size="17">Past Event</text>
+    </g>
+    <path d="M360 665H1160" fill="none" stroke="#3478F6" stroke-width="4" stroke-linecap="round" marker-end="url(#arrow-blue)"/>
+    <text x="835" y="647" fill="#2F68C4" font-size="18">Search past Sessions</text>
+
+    <g transform="translate(112 748)">
+      <circle cx="50" cy="36" r="36" fill="#DFF5EC" stroke="#63BE9C" stroke-width="2"/>
+      <path d="M34 37c0-12 7-21 17-21 8 0 14 5 16 13 8 2 13 9 13 17 0 12-10 21-22 21H43c-12 0-22-9-22-21 0-8 5-15 13-17" fill="none" stroke="#16815D" stroke-width="3" 
```

**File**: `docs/mkdocs/assets/img/blog/memory/memory-session-boundary.svg` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-labelledby="title desc">
+  <title id="title">同一条信息在切换 Session 后的不同路径</title>
+  <desc id="desc">Session history 和 Summary 留在原会话，User 或 App State、Session Recall 结果和长期 Memory Entry 可以通过各自的读取方式进入新会话的模型请求。</desc>
+  <defs>
+    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
+      <path d="M32 0H0V32" fill="none" stroke="#D9E6F2" stroke-width="1" opacity="0.38"/>
+    </pattern>
+    <marker id="arrow-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#3478F6"/>
+    </marker>
+    <marker id="arrow-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#21A179"/>
+    </marker>
+    <marker id="arrow-orange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#E6A433"/>
+    </marker>
+  </defs>
+
+  <rect width="1600" height="900" fill="#F8FBFE"/>
+  <rect width="1600" height="900" fill="url(#grid)"/>
+
+  <g font-family="PingFang SC, Microsoft YaHei, Noto Sans CJK SC, Arial, sans-serif">
+    <text x="72" y="78" fill="#102E4A" font-size="38" font-weight="500">换一个 Session，过去的信息会走向哪里</text>
+    <text x="72" y="120" fill="#647B91" font-size="21">保存位置不同，进入下一次模型请求的方式也不同</text>
+
+    <text x="94" y="188" fill="#174A7C" font-size="26" font-weight="500">Session A</text>
+    <text x="1344" y="188" fill="#174A7C" font-size="26" font-weight="500" text-anchor="middle">Session B</text>
+
+    <line x1="800" y1="165" x2="800" y2="824" stroke="#8EA6BA" stroke-width="3" stroke-dasharray="10 12"/>
+    <rect x="704" y="142" width="192" height="44" rx="22" fill="#E8EEF5"/>
+    <text x="800" y="172" fill="#425D73" font-size="20" font-weight="500" text-anchor="middle">切换 Session</text>
+
+    <path d="M102 228H516Q542 228 542 254V310Q542 336 516 336H184L132 374V336H102Q76 336 76 310V254Q76 228 102 228Z" fill="#EAF2FF" stroke="#9CC0FA" stroke-width="2"/>
+    <circle cx="126" cy="273" r="22" fill="#3478F6"/>
+    <path d="M116 274h20M126 264v20" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>
+    <text x="166" y="274" fill="#102E4A" font-size="22" font-weight="500">迁移必须提供回滚脚本</text>
+    <text x="166" y="307" fill="#597188" font-size="18">这句话先成为 Session 中的一条 Event</text>
+
+    <text x="112" y="442" fill="#425D73" font-size="21" font-weight="500">History / Summary</text>
+    <line x1="330" y1="432" x2="742" y2="432" stroke="#8EA6BA" stroke-width="4" stroke-linecap="round"/>
+    <circle cx="760" cy="432" r="16" fill="#FFFFFF" stroke="#D65B59" stroke-width="4"/>
+    <path d="M751 423 769 441M769 423 751 441" stroke="#D65B59" stroke-width="4" stroke-linecap="round"/>
+    <text x="330" y="474" fill="#71879B" font-size="18">沿用原 Session 时自动恢复</text>
+    <text x="744" y="507" fill="#B04A4A" font-size="17" text-anchor="end">不会自动越过边界</text>
+
+    <g transform="translate(112 500)">
+      <path d="M0 15C0 7 20 0 48 0s48 7 48 15v52c0 8-20 15-48 15S0 75 0 67Z" fill="#FFF2D9" stroke="#E6AE45" stroke-width="2"/>
+      <ellipse cx="48" cy="15" rx="48" ry="15" fill="#FFE7B5" stroke="#E6AE45" stroke-width="2"/>
+      <text x="120" y="36" fill="#7A5313" font-size="21" font-weight="500">State</text>
+      <text x="120" y="66" fill="#7A6746" font-size="17">精确业务值</text>
+    </g>
+    <path d="M330 542H1160" fill="none" stroke="#E6A433" stroke-width="4" stroke-linecap="round" marker-end="url(#arrow-orange)"/>
+    <text x="830" y="525" fill="#7A6746" font-size="18">User / App 作用域 · 按 key 读取</text>
+
+    <g transform="translate(112 620)">
+      <path d="M4 8h76l20 20v62H4Z" fill="#EAF2FF" stroke="#78A9F7" stroke-width="2"/>
+      <path d="M80 8v20h20" fill="none" stroke="#78A9F7" stroke-width="2"/>
+      <path d="M25 47h54M25 66h42" stroke="#78A9F7" stroke-width="3" stroke-linecap="round"/>
+      <text x="126" y="42" fill="#174A7C" font-size="21" font-weight="500">Session Recall</text>
+      <text x="126" y="72" fill="#597188" font-size="17">旧 Event</text>
+    </g>
+    <path d="M360 665H1160" fill="none" stroke="#3478F6" stroke-width="4" stroke-linecap="round" marker-end="url(#arrow-blue)"/>
+    <text x="835" y="647" fill="#2F68C4" font-size="18">搜索历史会话</text>
+
+    <g transform="translate(112 748)">
+      <circle cx="50" cy="36" r="36" fill="#DFF5EC" stroke="#63BE9C" stroke-width="2"/>
+      <path d="M34 37c0-12 7-21 17-21 8 0 14 5 16 13 8 2 13 9 13 17 0 12-10 21-22 21H43c-12 0-22-9-22-21 0-8 5-15 13-17" fill="none" stroke="#16815D" stroke-width="3" stroke-linecap="round"/>
+      <text x="112" y="31" fill="#176A50" font-size="21" font-weight="500">长期 Memory</text>
+      <text x="112" y="61" fill="#527969" font-size="17">整理后的 Entry</text>
+    </g>
+    <path d="M360 786H1160" fill="none" stroke="#21A179" stroke-width="4" stroke-linecap="ro
```

**File**: `docs/mkdocs/assets/img/blog/memory/native-memory-options-en.svg` (added, +158/-0)
```diff
@@ -0,0 +1,158 @@
+<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" role="img" aria-labelledby="title desc">
+  <title id="title">tRPC-Agent-Go Built-in Memory Configuration Choices</title>
+  <desc id="desc">The diagram centers on memory.Service. The left side shows application code, Agentic, and Auto Memory write paths; the right side shows recent reads, relevant search, tools, and preload; the bottom shows keyword and vector backends. Policy, Assistant Episode, and background-job settings apply only to Auto Memory.</desc>
+  <defs>
+    <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
+      <path d="M32 0H0V32" fill="none" stroke="#D9E6F2" stroke-width="1" opacity="0.38"/>
+    </pattern>
+    <marker id="arrow-blue" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#3478F6"/>
+    </marker>
+    <marker id="arrow-teal" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#21A179"/>
+    </marker>
+    <marker id="arrow-orange" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
+      <path d="M0 0 10 5 0 10Z" fill="#E3A73A"/>
+    </marker>
+  </defs>
+
+  <rect width="1600" height="900" fill="#F8FBFE"/>
+  <rect width="1600" height="900" fill="url(#grid)"/>
+
+  <g font-family="Inter, Arial, sans-serif">
+    <text x="72" y="72" fill="#102E4A" font-size="38" font-weight="500">Built-in Memory Choices: Write, Store, and Retrieve</text>
+    <text x="72" y="114" fill="#647B91" font-size="21">Agent and Runner wiring stays the same; replace the Service or adjust Options on the relevant path</text>
+
+    <!-- Column headings -->
+    <path d="M80 166H116" stroke="#3478F6" stroke-width="6" stroke-linecap="round"/>
+    <text x="132" y="174" fill="#174A7C" font-size="24" font-weight="500">How to write</text>
+
+    <path d="M670 166H706" stroke="#21A179" stroke-width="6" stroke-linecap="round"/>
+    <text x="722" y="174" fill="#176A50" font-size="24" font-weight="500">One Service</text>
+
+    <path d="M1010 166H1046" stroke="#3478F6" stroke-width="6" stroke-linecap="round"/>
+    <text x="1062" y="174" fill="#174A7C" font-size="24" font-weight="500">How to retrieve</text>
+
+    <!-- Write path: direct -->
+    <circle cx="104" cy="238" r="24" fill="#DCEBFF" stroke="#3478F6" stroke-width="3"/>
+    <path d="M94 238h20M104 228v20" stroke="#3478F6" stroke-width="3" stroke-linecap="round"/>
+    <text x="146" y="233" fill="#174A7C" font-size="21" font-weight="500">Application code</text>
+    <text x="146" y="261" fill="#657D92" font-size="16">App owns content and errors</text>
+    <path d="M390 238H656" fill="none" stroke="#3478F6" stroke-width="4" marker-end="url(#arrow-blue)"/>
+    <text x="520" y="222" fill="#3D6388" font-size="16" text-anchor="middle">Add / Update / Delete</text>
+
+    <!-- Write path: agentic -->
+    <circle cx="104" cy="332" r="24" fill="#DCEBFF" stroke="#3478F6" stroke-width="3"/>
+    <path d="M94 326h20M94 338h14" stroke="#3478F6" stroke-width="3" stroke-linecap="round"/>
+    <text x="146" y="327" fill="#174A7C" font-size="21" font-weight="500">Agentic</text>
+    <text x="146" y="355" fill="#657D92" font-size="16">Model decides whether to call</text>
+    <path d="M390 332H656" fill="none" stroke="#3478F6" stroke-width="4" marker-end="url(#arrow-blue)"/>
+    <text x="520" y="316" fill="#3D6388" font-size="16" text-anchor="middle">memory_* Tool</text>
+
+    <!-- Write path: auto -->
+    <circle cx="104" cy="426" r="24" fill="#FFF2D9" stroke="#E3A73A" stroke-width="3"/>
+    <path d="M93 426l7 7 15-17" fill="none" stroke="#C98713" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
+    <text x="146" y="421" fill="#7A5313" font-size="21" font-weight="500">Auto Memory</text>
+    <text x="146" y="449" fill="#7A6746" font-size="16">Processes after response</text>
+    <path d="M336 426H380" fill="none" stroke="#E3A73A" stroke-width="4" marker-end="url(#arrow-orange)"/>
+
+    <rect x="394" y="398" width="104" height="56" rx="28" fill="#FFFFFF" stroke="#E3A73A" stroke-width="3"/>
+    <text x="446" y="434" fill="#7A5313" font-size="18" font-weight="500" text-anchor="middle">Checker</text>
+    <path d="M498 426H524" fill="none" stroke="#E3A73A" stroke-width="4" marker-end="url(#arrow-orange)"/>
+    <path d="M538 396H628L612 426l16 30H538Z" fill="#FFF7E8" stroke="#E3A73A" stroke-width="3"/>
+    <text x="580" y="433" fill="#7A5313" font-size="17" font-weight="500" text-anchor="middle">Extractor</text>
+    <path d="M628 426H656" fill="none" stroke="#E3A73A" stroke-width="4" marker-end="url(#arrow-orange)"/>
+
+    <!-- Auto-only settings -->
+    <path d="M394 480H628" stroke="#D9B66D" stroke-width="2"/>
+    <path d="M446 454V480M580 456V480" stroke="#D9B66D" stroke-width="2"/>
+    <g fill="#7A6746" font-size="15" text-an
```

---

### Incident Patch 5: `e737f583` (2026-09-03)
**Commit Message**: docs: fix A2A interaction guide links (#2575)

## What changed

Updated the A2A documentation links in the Chinese legacy and v1 guides
to use the published interaction guide URL, so the links remain
accessible after the source Markdown is synchronized to iWiki.

## Why

The relative links work within the MkDocs source tree but cannot be
resolved from the synchronized iWiki pages because the standalone
interaction guide is not published as a corresponding iWiki page.

## Testing

- `mkdocs build --strict -f docs/mkdocs.yml`
- Verified that the published A2A interaction guide URL returns HTTP
200.
- Verified that the built legacy and v1 pages contain the published
guide URL.

## Notes for reviewers

Documentation-only change; no public API or runtime behavior changes.

**File**: `docs/mkdocs/zh/a2a.md` (modified, +1/-1)
```diff
@@ -916,7 +916,7 @@ subAgent, _ := a2aagent.New(
 
 关于 A2A 协议中工具调用、代码执行、思考内容等事件的传递规范，以及 Metadata 字段定义、ADK 兼容模式、分布式追踪等详细说明，请参考独立文档：
 
-**[A2A 协议交互规范](a2a-interaction.md)**
+**[A2A 协议交互规范](https://trpc-group.github.io/trpc-agent-go/zh/a2a-interaction/)**
 
 该文档定义了 trpc-agent-go 在 A2A 协议之上的扩展规范，是 Client 和 Server 实现的标准参考。
 
```

**File**: `docs/mkdocs/zh/a2a_v1.md` (modified, +1/-1)
```diff
@@ -572,7 +572,7 @@ W3C trace context 会自动通过 HTTP header 传播。生产环境仍应通过
 
 旧版包还保留 `WithProcessorBuilder`、`WithTaskManagerBuilder`、`WithStreamingEventType`、`WithStreamingRespHandler` 和 `WithStructuredTaskErrors` 等兼容扩展点。它们用于维持既有 v0 应用行为，不代表 v1 的推荐设计；新代码应优先使用 v1 的统一 MessageProcessor、TaskManager 和 converter 扩展边界。
 
-工具调用、代码执行、reasoning 和 `state_delta` 使用的共享 metadata extension 见 [A2A 协议交互规范](a2a-interaction.md)。其中的 metadata key 与交互规范版本同时适用于旧版和 v1 包；`TextPart`、`DataPart`、小写 method 和流式 envelope 示例描述的是 v0.2.x wire model，v1 则通过统一 Part、Message、Artifact 和 Task update event 承载这些共享 metadata。
+工具调用、代码执行、reasoning 和 `state_delta` 使用的共享 metadata extension 见 [A2A 协议交互规范](https://trpc-group.github.io/trpc-agent-go/zh/a2a-interaction/)。其中的 metadata key 与交互规范版本同时适用于旧版和 v1 包；`TextPart`、`DataPart`、小写 method 和流式 envelope 示例描述的是 v0.2.x wire model，v1 则通过统一 Part、Message、Artifact 和 Task update event 承载这些共享 metadata。
 
 ### v0 Task 管理边界
 
```

---

### Incident Patch 6: `f632b234` (2026-09-03)
**Commit Message**: plugin/toolloopwarning: add request-local tool loop warnings (#2490)

Related to #2346.

## What changed

- Adds an opt-in Runner plugin that detects two adjacent, complete,
identical tool rounds at the end of the model request.
- Compares ordered tool names, canonical JSON arguments, and final
model-visible tool results; tool-call IDs are used only for correlation.
- Appends a temporary protocol user message to every new eligible
request while the loop continues, while remaining idempotent if
callbacks re-enter on the same request.
- Skips the first model request in each invocation so a repeated tail
restored from an earlier run does not trigger by itself.
- Provides WithWarningMessage and additive WithExcludedToolNames options
for localization and expected polling/background tools.

The implementation is confined to plugin/toolloopwarning and its
documentation. Existing defaults remain unchanged. It makes no
additional model or tool calls and does not stop or retry an invocation.

## Why

An exact repeated tool round is a narrow, deterministic signal that the
current strategy may not be making progress. The warning enters the next
model context and can change the trajectory, but 

**File**: `docs/mkdocs/en/plugin.md` (modified, +74/-4)
```diff
@@ -675,6 +675,76 @@ The output is one JSON debug message per line, for example:
 request. This is useful for organization-wide policies or shared behavior that
 should apply to all agents managed by a Runner.
 
+### ToolLoopWarning
+
+`toolloopwarning.New()` examines the two complete tool-call rounds at the end
+of each model request. When their tool names, canonical JSON arguments, and
+model-visible results are identical, it appends one temporary user-role
+instruction to that request. It does not append a duplicate while the warning
+is already present in the same request, but it appends the warning to each new
+eligible request while the repeated loop continues. A changed round or an
+intervening non-tool message does not match. The first model request in each
+invocation is deliberately skipped so a repeated tail restored from an earlier
+run cannot trigger a new warning by itself.
+
+Tool-call IDs are used to pair results with calls but are not part of the
+round fingerprint. A complete round requires exactly one trailing tool-result
+message per tool call. An incomplete or malformed round does not match. The
+plugin is opt-in, makes no additional model or tool calls, and does not stop or
+retry the invocation. It must be registered on a `Runner`; direct calls to
+`Agent.Run` do not install Runner plugins.
+
+The instruction's `user` role is a model-protocol shape, not a claim of human
+authorship. The instruction is request-local: it is not appended as a session
+event and is not restored as history on a later run. A standalone session
+summary reads persisted events and therefore does not receive it as source
+content. If cache-safe summary forking is enabled, however, the summarizer
+deliberately reuses the final model request; the instruction can then be part
+of the summarizer input and can indirectly affect the derived summary.
+Execution tracing likewise
+records the final request on the completion artifact rather than in session
+history. The model response produced from the request follows normal session
+behavior.
+
+Detection uses the request view available at `BeforeModel`, so history
+projection, result transformation, summary cutoffs, and context compaction are
+already reflected. If a later callback removes the instruction and the
+callback chain is re-entered on the same request, the plugin adds it again only
+when the trailing rounds still match. A warning already present at the end of
+the same request is not duplicated.
+
+Use `WithExcludedToolNames(...)` for polling or other tools whose repeated
+results are expected. Use `WithWarningMessage(...)` to localize or customize
+the synthetic instruction.
+
+```go
+import (
+	"trpc.group/trpc-go/trpc-agent-go/agent/llmagent"
+	"trpc.group/trpc-go/trpc-agent-go/model/openai"
+	"trpc.group/trpc-go/trpc-agent-go/plugin/toolloopwarning"
+	"trpc.group/trpc-go/trpc-agent-go/runner"
+)
+
+agentInstance := llmagent.New(
+	"my-agent",
+	llmagent.WithModel(openai.New("gpt-4o-mini")),
+)
+runnerInstance := runner.NewRunner(
+	"my-app",
+	agentInstance,
+	runner.WithPlugins(toolloopwarning.New(
+		toolloopwarning.WithExcludedToolNames("poll_status"),
+	)),
+)
+defer runnerInstance.Close()
+```
+
+For a complete, deterministic example that runs without an API key, see
+[examples/plugin/toolloopwarning](https://github.com/trpc-group/trpc-agent-go/tree/main/examples/plugin/toolloopwarning).
+The example uses a deterministic scripted model to produce two identical tool
+rounds while exercising the normal Runner, LLMAgent, tool, plugin, and session
+paths.
+
 ### ToolCallID
 
 `toolcallid.New()` from `plugin/toolcallid` rewrites the final `ToolCall.ID`
@@ -1189,10 +1259,10 @@ The example includes verified scenarios for:
 - A defensive analysis request that is allowed
 
 The repository currently includes Logging, DebugLog, GlobalInstruction,
-ToolCallID, ToolError, MessageMerger, ErrorMessage, and Guardrail as built-in
-plugins. Tool Approval, Prompt Injection, and Unsafe Intent are currently
-built-in capabilities under the Guardrail plugin. Additional plugins can be
-implemented as custom plugins.
+ToolCallID, ToolError, ToolLoopWarning, MessageMerger, ErrorMessage, and
+Guardrail as built-in plugins. Tool Approval, Prompt Injection, and Unsafe
+Intent are currently built-in capabilities under the Guardrail plugin.
+Additional plugins can be implemented as custom plugins.
 
 ## Writing Your Own Plugin
 
```

**File**: `docs/mkdocs/zh/plugin.md` (modified, +56/-1)
```diff
@@ -674,6 +674,61 @@ events, err := runnerInstance.Run(
 `plugin.NewGlobalInstruction(text)` 会在每一次模型请求前，统一追加一条 system
 message。适合用来实现全局策略或统一行为（例如安全约束、风格要求）。
 
+### ToolLoopWarning（工具循环提醒）
+
+`toolloopwarning.New()` 会在每次模型调用前，检查请求末尾两个相邻的完整工具轮次。当工具
+名称、规范化后的 JSON 参数以及模型可见结果都相同时，插件会在当前请求末尾临时追加一条
+`user` 角色提醒。同一个 request 被重复处理时不会追加多份提醒；但只要循环继续，每个新的
+匹配 request 都会收到提醒。轮次内容变化或中间出现非工具消息时不会匹配。每个 invocation
+的第一次模型请求会被明确跳过，避免仅因恢复了上一次 Run 的重复历史尾部就触发新的提醒。
+
+工具调用 ID 用于将结果与调用配对，但不参与轮次指纹比较。一个完整轮次要求每个工具
+调用恰好对应一条末尾工具结果消息；不完整或格式异常的轮次不会匹配。该插件默认关闭，
+不会额外发起模型调用或工具调用，也不会停止 invocation 或触发重试。插件必须注册到
+`Runner`；直接调用 `Agent.Run` 不会安装 Runner plugin。
+
+提醒的 `user` 角色只是模型协议形态，不表示文本由人类输入。提醒只存在于当前模型请求：
+它不会作为 session event 追加，也不会在后续 Run 中作为 history 恢复。普通 standalone
+summary 只读取已持久化 event，因此不会把提醒作为 source content；但显式启用 cache-safe
+summary forking 时，summarizer 会复用最终模型请求，提醒会进入 summarizer 输入，并可能间接
+影响最终持久化的派生 summary。Execution Trace 同样会在 completion artifact 上记录最终请求，
+但不会把它写成 session history。模型基于提醒生成的响应继续遵循正常的 session 行为。
+
+检测基于 `BeforeModel` 时可见的请求，因此 history projection、工具结果转换、summary
+cutoff 和 context compaction 已经反映在待比较内容中。如果后续 callback 移除了提醒，且同
+一个 request 再次进入 callback 链，只有在末尾工具轮次仍然匹配时插件才会重新追加；同一
+request 末尾已有提醒时不会重复追加。
+
+可使用 `WithExcludedToolNames(...)` 排除轮询等预期会重复的工具；可使用
+`WithWarningMessage(...)` 自定义或本地化提醒内容。
+
+```go
+import (
+	"trpc.group/trpc-go/trpc-agent-go/agent/llmagent"
+	"trpc.group/trpc-go/trpc-agent-go/model/openai"
+	"trpc.group/trpc-go/trpc-agent-go/plugin/toolloopwarning"
+	"trpc.group/trpc-go/trpc-agent-go/runner"
+)
+
+agentInstance := llmagent.New(
+	"my-agent",
+	llmagent.WithModel(openai.New("gpt-4o-mini")),
+)
+runnerInstance := runner.NewRunner(
+	"my-app",
+	agentInstance,
+	runner.WithPlugins(toolloopwarning.New(
+		toolloopwarning.WithExcludedToolNames("poll_status"),
+	)),
+)
+defer runnerInstance.Close()
+```
+
+无需 API Key 且可稳定复现的完整示例见
+[examples/plugin/toolloopwarning](https://github.com/trpc-group/trpc-agent-go/tree/main/examples/plugin/toolloopwarning)。
+该示例使用确定性的脚本模型（scripted model）生成两个相同工具轮次，同时仍然经过正常的
+Runner、LLMAgent、工具、插件和 session 路径。
+
 ### ToolCallID
 
 `plugin/toolcallid` 下的 `toolcallid.New()` 用于在模型返回最终 `ToolCall.ID` 后统一改写为框架使用的 tool call ID。当 provider / model 不能稳定保证 `ToolCall.ID` 足够唯一时，可以启用这个插件。
@@ -1136,7 +1191,7 @@ FinishReason：
 
 完整示例见 [examples/plugin/errormessage](https://github.com/trpc-group/trpc-agent-go/tree/main/examples/plugin/errormessage)。
 
-说明：目前仓库内置了 Logging、DebugLog、GlobalInstruction、ToolCallID、ToolError、MessageMerger、ErrorMessage、Guardrail 八类插件。其中 Guardrail 插件当前提供的内置 capability 包括工具审批、Prompt Injection 和 Unsafe Intent。更多插件可通过自定义插件实现。
+说明：目前仓库内置了 Logging、DebugLog、GlobalInstruction、ToolCallID、ToolError、ToolLoopWarning、MessageMerger、ErrorMessage、Guardrail 九类插件。其中 Guardrail 插件当前提供的内置 capability 包括工具审批、Prompt Injection 和 Unsafe Intent。更多插件可通过自定义插件实现。
 
 ## 如何扩展：写一个自己的插件
 
```

**File**: `examples/plugin/toolloopwarning/README.md` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+# Tool Loop Warning Plugin Example
+
+This example shows how to register `plugin/toolloopwarning` on a `Runner` and
+observe a request-local warning after two identical, complete tool rounds.
+
+It uses a deterministic scripted model so the repeated rounds occur on every
+run without an API key. The example still uses the normal `Runner`, `LLMAgent`,
+function-tool, plugin, and session paths.
+
+## What this example demonstrates
+
+- Install the opt-in plugin with `runner.WithPlugins(...)`.
+- Detect semantically identical JSON arguments despite key order and
+  whitespace differences.
+- Use tool-call IDs to pair results with calls while excluding the IDs from
+  the round fingerprint.
+- Add the warning to the third model request after two complete repeated
+  rounds.
+- Let the model change its trajectory after seeing the warning; the plugin
+  itself does not stop or retry the run.
+- Keep the warning out of persisted session events.
+
+## Run
+
+```bash
+cd examples
+go run ./plugin/toolloopwarning
+```
+
+No API key or network access is required.
+
+## Expected output
+
+```text
+model request 1: loop warning=false
+tool search_docs: query="trpc-agent-go" limit=3
+model request 2: loop warning=false
+tool search_docs: query="trpc-agent-go" limit=3
+model request 3: loop warning=true
+assistant: The repeated tool loop was detected, so I stopped calling the tool.
+tool calls: 2
+session contains loop warning: false
+```
+
+## Core integration
+
+Register the plugin when constructing the Runner:
+
+```go
+runnerInstance := runner.NewRunner(
+	"my-app",
+	agentInstance,
+	runner.WithPlugins(toolloopwarning.New(
+		toolloopwarning.WithWarningMessage(loopWarning),
+	)),
+)
+```
+
+`WithWarningMessage` is optional. Calling `toolloopwarning.New()` without
+options uses the default warning. Polling tools and other tools whose repeated
+results are expected can be excluded with `WithExcludedToolNames(...)`.
+
+## Why the model is scripted
+
+A provider-backed model cannot be expected to produce two exactly matching
+tool rounds on demand. The scripted model varies both the call ID and JSON
+formatting between its first two tool calls while keeping their semantics and
+tool results equal. On the third request it verifies that the warning is
+present and returns a final answer instead of calling the tool again.
+
+The scripted model exists only to make the trigger deterministic. It does not
+bypass the plugin or invoke its callbacks directly.
```

**File**: `examples/plugin/toolloopwarning/main.go` (added, +165/-0)
```diff
@@ -0,0 +1,165 @@
+//
+// Tencent is pleased to support the open source community by making
+// trpc-agent-go available.
+//
+// Copyright (C) 2025 Tencent.  All rights reserved.
+//
+// trpc-agent-go is licensed under the Apache License Version 2.0.
+//
+
+// Package main demonstrates the tool-loop warning plugin with a deterministic
+// model, a real LLMAgent tool loop, and a Runner-backed session.
+package main
+
+import (
+	"context"
+	"errors"
+	"fmt"
+	"os"
+
+	"trpc.group/trpc-go/trpc-agent-go/agent/llmagent"
+	"trpc.group/trpc-go/trpc-agent-go/event"
+	"trpc.group/trpc-go/trpc-agent-go/model"
+	"trpc.group/trpc-go/trpc-agent-go/plugin/toolloopwarning"
+	"trpc.group/trpc-go/trpc-agent-go/runner"
+	"trpc.group/trpc-go/trpc-agent-go/session"
+	sessioninmemory "trpc.group/trpc-go/trpc-agent-go/session/inmemory"
+	"trpc.group/trpc-go/trpc-agent-go/tool"
+	"trpc.group/trpc-go/trpc-agent-go/tool/function"
+)
+
+const (
+	appName     = "tool-loop-warning-example"
+	userID      = "example-user"
+	sessionID   = "tool-loop-warning-session"
+	searchTool  = "search_docs"
+	loopWarning = "The same tool loop repeated. Stop calling it and use another approach."
+)
+
+type searchInput struct {
+	Query string `json:"query"`
+	Limit int    `json:"limit"`
+}
+
+func main() {
+	if err := run(); err != nil {
+		fmt.Fprintf(os.Stderr, "tool-loop warning example failed: %v\n", err)
+		os.Exit(1)
+	}
+}
+
+func run() error {
+	ctx := context.Background()
+	modelInstance := &scriptedModel{}
+	toolCalls := 0
+	searchDocs := function.NewFunctionTool(
+		func(_ context.Context, input searchInput) (string, error) {
+			toolCalls++
+			fmt.Printf(
+				"tool %s: query=%q limit=%d\n",
+				searchTool,
+				input.Query,
+				input.Limit,
+			)
+			return "plugin/toolloopwarning contains the request-local loop warning plugin", nil
+		},
+		function.WithName(searchTool),
+		function.WithDescription("Search the tRPC-Agent-Go documentation."),
+	)
+
+	agentInstance := llmagent.New(
+		"tool-loop-warning-agent",
+		llmagent.WithModel(modelInstance),
+		llmagent.WithTools([]tool.Tool{searchDocs}),
+	)
+	sessionService := sessioninmemory.NewSessionService()
+	runnerInstance := runner.NewRunner(
+		appName,
+		agentInstance,
+		runner.WithSessionService(sessionService),
+		runner.WithPlugins(toolloopwarning.New(
+			toolloopwarning.WithWarningMessage(loopWarning),
+		)),
+	)
+	defer runnerInstance.Close()
+
+	events, err := runnerInstance.Run(
+		ctx,
+		userID,
+		sessionID,
+		model.NewUserMessage("Find the tool-loop warning plugin documentation."),
+	)
+	if err != nil {
+		return fmt.Errorf("run agent: %w", err)
+	}
+	finalResponse, err := collectFinalResponse(events)
+	if err != nil {
+		return err
+	}
+
+	sess, err := sessionService.GetSession(ctx, session.Key{
+		AppName:   appName,
+		UserID:    userID,
+		SessionID: sessionID,
+	})
+	if err != nil {
+		return fmt.Errorf("get session: %w", err)
+	}
+	if sess == nil {
+		return errors.New("session not found")
+	}
+
+	fmt.Printf("assistant: %s\n", finalResponse)
+	fmt.Printf("tool calls: %d\n", toolCalls)
+	fmt.Printf(
+		"session contains loop warning: %t\n",
+		sessionContainsWarning(sess),
+	)
+	return nil
+}
+
+func collectFinalResponse(events <-chan *event.Event) (string, error) {
+	finalResponse := ""
+	for evt := range events {
+		if evt == nil {
+			continue
+		}
+		if evt.Error != nil {
+			return "", errors.New(evt.Error.Message)
+		}
+		if evt.Response == nil {
+			continue
+		}
+		if evt.Response.Error != nil {
+			return "", errors.New(evt.Response.Error.Message)
+		}
+		for _, choice := range evt.Response.Choices {
+			if choice.Message.Role == model.RoleAssistant &&
+				choice.Message.Content != "" {
+				finalResponse = choice.Message.Content
+			}
+		}
+	}
+	if finalResponse == "" {
+		return "", errors.New("final assistant response not found")
+	}
+	return finalResponse, nil
+}
+
+func sessionContainsWarning(sess *session.Session) bool {
+	if sess == nil {
+		return false
+	}
+	for _, evt := range sess.Events {
+		if evt.Response == nil {
+			continue
+		}
+		for _, choice := range evt.Response.Choices {
+			if choice.Message.Content == loopWarning ||
+				choice.Delta.Content == loopWarning {
+				return true
+			}
+		}
+	}
+	return false
+}
```

**File**: `examples/plugin/toolloopwarning/model.go` (added, +125/-0)
```diff
@@ -0,0 +1,125 @@
+//
+// Tencent is pleased to support the open source community by making
+// trpc-agent-go available.
+//
+// Copyright (C) 2025 Tencent.  All rights reserved.
+//
+// trpc-agent-go is licensed under the Apache License Version 2.0.
+//
+
+package main
+
+import (
+	"context"
+	"errors"
+	"fmt"
+	"time"
+
+	"trpc.group/trpc-go/trpc-agent-go/model"
+)
+
+const (
+	firstArguments  = `{"query":"trpc-agent-go","limit":3}`
+	secondArguments = `{ "limit": 3, "query": "trpc-agent-go" }`
+	finalAnswer     = "The repeated tool loop was detected, so I stopped calling the tool."
+)
+
+// scriptedModel repeats one tool call twice, then verifies that the plugin
+// added its request-local warning before returning a final answer. A scripted
+// model keeps the example deterministic; the Runner, agent, tool, plugin, and
+// session paths are the same ones used with a provider-backed model.
+type scriptedModel struct {
+	step int
+}
+
+func (m *scriptedModel) Info() model.Info {
+	return model.Info{Name: "tool-loop-warning-scripted-model"}
+}
+
+func (m *scriptedModel) GenerateContent(
+	_ context.Context,
+	request *model.Request,
+) (<-chan *model.Response, error) {
+	if request == nil {
+		return nil, errors.New("scripted model received a nil request")
+	}
+	m.step++
+	warningPresent := requestContainsWarning(request)
+	fmt.Printf(
+		"model request %d: loop warning=%t\n",
+		m.step,
+		warningPresent,
+	)
+
+	var response *model.Response
+	switch m.step {
+	case 1:
+		if warningPresent {
+			return nil, errors.New("first model request unexpectedly contains the loop warning")
+		}
+		response = toolCallResponse("call-search-1", firstArguments)
+	case 2:
+		if warningPresent {
+			return nil, errors.New("second model request unexpectedly contains the loop warning")
+		}
+		response = toolCallResponse("call-search-2", secondArguments)
+	case 3:
+		if !warningPresent {
+			return nil, errors.New("third model request does not contain the loop warning")
+		}
+		response = assistantResponse(finalAnswer)
+	default:
+		return nil, fmt.Errorf("unexpected model request %d", m.step)
+	}
+
+	responses := make(chan *model.Response, 1)
+	responses <- response
+	close(responses)
+	return responses, nil
+}
+
+func requestContainsWarning(request *model.Request) bool {
+	if request == nil {
+		return false
+	}
+	for _, message := range request.Messages {
+		if message.Role == model.RoleUser && message.Content == loopWarning {
+			return true
+		}
+	}
+	return false
+}
+
+func toolCallResponse(id string, arguments string) *model.Response {
+	return &model.Response{
+		ID:      id,
+		Object:  model.ObjectTypeChatCompletion,
+		Created: time.Now().Unix(),
+		Done:    true,
+		Choices: []model.Choice{{
+			Message: model.Message{
+				Role: model.RoleAssistant,
+				ToolCalls: []model.ToolCall{{
+					Type: "function",
+					ID:   id,
+					Function: model.FunctionDefinitionParam{
+						Name:      searchTool,
+						Arguments: []byte(arguments),
+					},
+				}},
+			},
+		}},
+	}
+}
+
+func assistantResponse(content string) *model.Response {
+	return &model.Response{
+		ID:      "final-response",
+		Object:  model.ObjectTypeChatCompletion,
+		Created: time.Now().Unix(),
+		Done:    true,
+		Choices: []model.Choice{{
+			Message: model.NewAssistantMessage(content),
+		}},
+	}
+}
```

**File**: `plugin/toolloopwarning/detector.go` (added, +285/-0)
```diff
@@ -0,0 +1,285 @@
+//
+// Tencent is pleased to support the open source community by making trpc-agent-go available.
+//
+// Copyright (C) 2025 Tencent.  All rights reserved.
+//
+// trpc-agent-go is licensed under the Apache License Version 2.0.
+//
+
+package toolloopwarning
+
+import (
+	"bytes"
+	"crypto/sha256"
+	"encoding/hex"
+	"encoding/json"
+	"io"
+	"strconv"
+
+	"trpc.group/trpc-go/trpc-agent-go/model"
+)
+
+type toolRound struct {
+	toolCalls []model.ToolCall
+	results   []model.Message
+}
+
+type roundFingerprint struct {
+	ToolCalls []callFingerprint `json:"tool_calls"`
+}
+
+type callFingerprint struct {
+	ToolName  string        `json:"tool_name"`
+	Arguments string        `json:"arguments"`
+	Result    model.Message `json:"result"`
+}
+
+func matchingTrailingRoundFingerprint(
+	messages []model.Message,
+	excludedToolNames map[string]struct{},
+) (string, bool) {
+	latest, latestStart, ok := parseTrailingToolRound(messages, len(messages))
+	if !ok {
+		return "", false
+	}
+	previous, _, ok := parseTrailingToolRound(messages, latestStart)
+	if !ok || roundContainsExcludedTool(latest, excludedToolNames) ||
+		roundContainsExcludedTool(previous, excludedToolNames) {
+		return "", false
+	}
+	latestFingerprint, ok := fingerprintRound(latest.toolCalls, latest.results)
+	if !ok {
+		return "", false
+	}
+	previousFingerprint, ok := fingerprintRound(previous.toolCalls, previous.results)
+	if !ok || latestFingerprint != previousFingerprint {
+		return "", false
+	}
+	return latestFingerprint, true
+}
+
+func parseTrailingToolRound(
+	messages []model.Message,
+	end int,
+) (toolRound, int, bool) {
+	if end <= 0 || end > len(messages) {
+		return toolRound{}, 0, false
+	}
+	resultStart := end
+	for resultStart > 0 && messages[resultStart-1].Role == model.RoleTool {
+		resultStart--
+	}
+	if resultStart == end || resultStart == 0 {
+		return toolRound{}, 0, false
+	}
+	assistantIndex := resultStart - 1
+	assistant := messages[assistantIndex]
+	if assistant.Role != model.RoleAssistant || len(assistant.ToolCalls) == 0 {
+		return toolRound{}, 0, false
+	}
+
+	expected, ok := expectedToolCallIDs(assistant.ToolCalls)
+	if !ok {
+		return toolRound{}, 0, false
+	}
+	results, ok := orderedToolResults(
+		messages[resultStart:end],
+		assistant.ToolCalls,
+		expected,
+	)
+	if !ok {
+		return toolRound{}, 0, false
+	}
+	return toolRound{
+		toolCalls: assistant.ToolCalls,
+		results:   results,
+	}, assistantIndex, true
+}
+
+func expectedToolCallIDs(
+	toolCalls []model.ToolCall,
+) (map[string]struct{}, bool) {
+	expected := make(map[string]struct{}, len(toolCalls))
+	for _, toolCall := range toolCalls {
+		if toolCall.ID == "" || toolCall.Function.Name == "" {
+			return nil, false
+		}
+		if _, exists := expected[toolCall.ID]; exists {
+			return nil, false
+		}
+		expected[toolCall.ID] = struct{}{}
+	}
+	return expected, true
+}
+
+func orderedToolResults(
+	messages []model.Message,
+	toolCalls []model.ToolCall,
+	expected map[string]struct{},
+) ([]model.Message, bool) {
+	byID := make(map[string]model.Message, len(toolCalls))
+	for _, message := range messages {
+		if !validToolResult(message, expected) {
+			return nil, false
+		}
+		if _, exists := byID[message.ToolID]; exists {
+			return nil, false
+		}
+		byID[message.ToolID] = message
+	}
+	if len(byID) != len(toolCalls) {
+		return nil, false
+	}
+
+	results := make([]model.Message, 0, len(toolCalls))
+	for _, toolCall := range toolCalls {
+		result, exists := byID[toolCall.ID]
+		if !exists {
+			return nil, false
+		}
+		results = append(results, result)
+	}
+	return results, true
+}
+
+func validToolResult(
+	message model.Message,
+	expected map[string]struct{},
+) bool {
+	if message.Role != model.RoleTool || message.ToolID == "" ||
+		!model.HasPayload(message) {
+		return false
+	}
+	_, exists := expected[message.ToolID]
+	return exists
+}
+
+func roundContainsExcludedTool(
+	round toolRound,
+	excludedToolNames map[string]struct{},
+) bool {
+	for _, toolCall := range round.toolCalls {
+		if _, excluded := excludedToolNames[toolCall.Function.Name]; excluded {
+			return true
+		}
+	}
+	return false
+}
+
+func fingerprintRound(
+	toolCalls []model.ToolCall,
+	toolResultMessages []model.Message,
+) (string, bool) {
+	if len(toolCalls) == 0 || len(toolCalls) != len(toolResultMessages) {
+		return "", false
+	}
+	fingerprint := roundFingerprint{
+		ToolCalls: make([]callFingerprint, 0, len(toolCalls)),
+	}
+	for i, toolCall := range toolCalls {
+		if toolCall.Function.Name == "" {
+			return "", false
+		}
+		fingerprint.ToolCalls = append(fingerprint.ToolCalls, callFingerprint{
+			ToolName: toolCall.Function.Name,
+			Arguments: digestText(
+				canonicalArguments(toolCall.Function.Arguments),
+			),
+			Result: boundedResultMessage(toolResultMessages[i]),
+		})
+	}
+	encoded, err := json.Marshal(fingerprint)
+	if err != nil {
+		return "", false
+	}
+	digest := sha256.Sum256(encoded)
+	return hex.EncodeToString(digest[:]), true
+}
+
+
```

**File**: `plugin/toolloopwarning/detector_test.go` (added, +300/-0)
```diff
@@ -0,0 +1,300 @@
+//
+// Tencent is pleased to support the open source community by making trpc-agent-go available.
+//
+// Copyright (C) 2025 Tencent.  All rights reserved.
+//
+// trpc-agent-go is licensed under the Apache License Version 2.0.
+//
+
+package toolloopwarning
+
+import (
+	"bytes"
+	"strings"
+	"testing"
+
+	"github.com/stretchr/testify/require"
+	"trpc.group/trpc-go/trpc-agent-go/model"
+)
+
+func TestMatchingTrailingRoundFingerprintUsesRequestTail(t *testing.T) {
+	messages := []model.Message{model.NewUserMessage("run")}
+	messages = append(messages, roundMessages(
+		[]model.ToolCall{
+			newToolCall("search-1", "search", `{"query":"x","limit":9007199254740993}`),
+			newToolCall("read-1", "read", `{"path":"a.go"}`),
+		},
+		[]model.Message{
+			model.NewToolMessage("read-1", "read", "file"),
+			model.NewToolMessage("search-1", "search", "matches"),
+		},
+	)...)
+	messages = append(messages, roundMessages(
+		[]model.ToolCall{
+			newToolCall("search-2", "search", ` { "limit": 9007199254740993, "query": "x" } `),
+			newToolCall("read-2", "read", `{"path":"a.go"}`),
+		},
+		[]model.Message{
+			model.NewToolMessage("search-2", "search", "matches"),
+			model.NewToolMessage("read-2", "read", "file"),
+		},
+	)...)
+
+	fingerprint, ok := matchingTrailingRoundFingerprint(messages, nil)
+	require.True(t, ok)
+	require.NotEmpty(t, fingerprint)
+
+	messages = append(messages, model.NewUserMessage("intervene"))
+	_, ok = matchingTrailingRoundFingerprint(messages, nil)
+	require.False(t, ok)
+}
+
+func TestMatchingTrailingRoundFingerprintDetectsChangesAndExclusions(t *testing.T) {
+	base := []model.Message{model.NewUserMessage("run")}
+	base = append(base, roundMessages(
+		[]model.ToolCall{newToolCall("call-1", "search", `{"query":"x"}`)},
+		[]model.Message{model.NewToolMessage("call-1", "search", "same")},
+	)...)
+
+	tests := map[string]struct {
+		call     model.ToolCall
+		result   model.Message
+		excluded map[string]struct{}
+	}{
+		"tool": {
+			call:   newToolCall("call-2", "read", `{"query":"x"}`),
+			result: model.NewToolMessage("call-2", "read", "same"),
+		},
+		"arguments": {
+			call:   newToolCall("call-2", "search", `{"query":"y"}`),
+			result: model.NewToolMessage("call-2", "search", "same"),
+		},
+		"result": {
+			call:   newToolCall("call-2", "search", `{"query":"x"}`),
+			result: model.NewToolMessage("call-2", "search", "changed"),
+		},
+		"excluded": {
+			call:     newToolCall("call-2", "search", `{"query":"x"}`),
+			result:   model.NewToolMessage("call-2", "search", "same"),
+			excluded: map[string]struct{}{"search": {}},
+		},
+	}
+	for name, test := range tests {
+		t.Run(name, func(t *testing.T) {
+			messages := append([]model.Message(nil), base...)
+			messages = append(messages, roundMessages(
+				[]model.ToolCall{test.call},
+				[]model.Message{test.result},
+			)...)
+			_, ok := matchingTrailingRoundFingerprint(messages, test.excluded)
+			require.False(t, ok)
+		})
+	}
+}
+
+func TestParseTrailingToolRoundRejectsMalformedTranscripts(t *testing.T) {
+	validCall := newToolCall("call-1", "search", `{}`)
+	validResult := model.NewToolMessage("call-1", "search", "same")
+	tests := map[string][]model.Message{
+		"empty": nil,
+		"no result": {
+			model.NewAssistantMessage("done"),
+		},
+		"missing result": {
+			assistantToolMessage(
+				validCall,
+				newToolCall("call-2", "read", `{}`),
+			),
+			validResult,
+		},
+		"unknown result": {
+			assistantToolMessage(validCall),
+			model.NewToolMessage("other", "search", "same"),
+		},
+		"duplicate result": {
+			assistantToolMessage(validCall),
+			validResult,
+			validResult,
+		},
+		"empty result": {
+			assistantToolMessage(validCall),
+			{Role: model.RoleTool, ToolID: "call-1"},
+		},
+		"duplicate call id": {
+			assistantToolMessage(
+				validCall,
+				newToolCall("call-1", "read", `{}`),
+			),
+			validResult,
+		},
+		"missing call id": {
+			assistantToolMessage(newToolCall("", "search", `{}`)),
+			validResult,
+		},
+		"missing tool name": {
+			assistantToolMessage(newToolCall("call-1", "", `{}`)),
+			validResult,
+		},
+		"non-tool boundary": {
+			assistantToolMessage(validCall),
+			validResult,
+			model.NewAssistantMessage("done"),
+		},
+	}
+	for name, messages := range tests {
+		t.Run(name, func(t *testing.T) {
+			_, _, ok := parseTrailingToolRound(messages, len(messages))
+			require.False(t, ok)
+		})
+	}
+
+	round, start, ok := parseTrailingToolRound(
+		[]model.Message{
+			model.NewUserMessage("run"),
+			assistantToolMessage(validCall),
+			validResult,
+		},
+		3,
+	)
+	require.True(t, ok)
+	require.Equal(t, 1, start)
+	require.Equal(t, "call-1", round.toolCalls[0].ID)
+	require.Equal(t, "call-1", round.results[0].ToolID)
+}
+
+func TestFingerprintRoundCanonicalizesArgumentsAndIgnoresIDs(t *testing.T) {
+	callsA := []model.ToolCall{
+		newToolCall(
+			"call-search-a",
+			"search",
+			`{"query":"x","limit":9007199254740993}`,
+		),
+		newToolCall("call-read-a",
```

**File**: `plugin/toolloopwarning/doc.go` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+//
+// Tencent is pleased to support the open source community by making trpc-agent-go available.
+//
+// Copyright (C) 2025 Tencent.  All rights reserved.
+//
+// trpc-agent-go is licensed under the Apache License Version 2.0.
+//
+
+// Package toolloopwarning provides an opt-in, request-local warning for
+// identical consecutive tool rounds.
+//
+// Register the plugin with runner.WithPlugins(toolloopwarning.New()). The
+// plugin is inactive unless registered.
+//
+// Starting with the second model request in each invocation, the plugin
+// examines the two complete tool rounds at the end of the request. Skipping
+// the first request prevents an old session-history tail from triggering a
+// warning in a new run. Rounds match when their ordered tool names, canonical
+// JSON arguments, and model-visible results are identical. Tool-call IDs are
+// used only to pair results with calls. A malformed or interrupted transcript,
+// an intervening non-tool message, or a changed round breaks adjacency.
+//
+// On a match, the plugin appends one temporary user-role instruction to that
+// model request. It appends the instruction to each eligible request while the
+// repeated loop continues, without duplicating it when callbacks re-enter on
+// the same request. The instruction is not appended to session events and is
+// not restored from session history. A standalone summary built from persisted
+// session events does not receive the instruction as source content. When
+// cache-safe summary forking reuses a final request containing the instruction,
+// it can enter the summarizer input and indirectly affect the persisted derived
+// summary. Execution tracing records it as part of the actual model request.
+// WithExcludedToolNames can exclude polling or other tools whose repeated
+// results are expected.
+//
+// The plugin makes no additional model or tool calls. It does not stop or
+// retry the invocation.
+package toolloopwarning
```

---

### Incident Patch 7: `ec4b37b7` (2026-09-02)
**Commit Message**: {server/agui, docs}: support framework-supplied assistant messages (#2565)

## Summary

- Accept a tail `role=assistant` text message as a framework-supplied
external result.
- Persist the assistant message to the existing user-anchored session
and AG-UI track without invoking the underlying runner.
- Emit `RUN_STARTED` followed by `RUN_FINISHED` on success or
`RUN_ERROR` on persistence failure.
- Preserve existing user/tool handling and the user-start history
boundary; no `PushMessage` API is added.

## Notes

Assistant-only new sessions are rejected rather than fabricating a user
message. The assistant text is persisted for history and is not streamed
as text events in this run.

## Tests

- `go test ./...` (from `server/agui)`
- `go test -race ./runner -run 'Assistant|LastMessageUnsupportedRole'`

**File**: `docs/mkdocs/en/agui/chat.md` (modified, +7/-1)
```diff
@@ -23,7 +23,7 @@ type RunAgentInput struct {
 	RunID          string          // Run ID, used to correlate run lifecycle events.
 	ParentRunID    *string         // Parent run ID. Optional.
 	State          any             // Arbitrary state; object-shaped values are merged into RuntimeState by default.
-	Messages       []Message       // Message list used to pass the current user input or external tool results.
+	Messages       []Message       // Message list used to pass user input, external tool results, or framework-supplied assistant messages.
 	Tools          []Tool          // Tool definitions. Protocol field. Optional.
 	Context        []Context       // Context list. Protocol field. Optional.
 	ForwardedProps any             // Arbitrary forwarded fields, usually for business-specific parameters.
@@ -157,6 +157,12 @@ After the previous event stream returns a tool call that needs external executio
 
 Each `role=tool` message corresponds to one tool call result. `toolCallId` associates the result with the tool call from the previous event stream, `name` is the tool name, and `content` carries the tool output as a string. `id` becomes the message id when the server returns the `TOOL_CALL_RESULT` event.
 
+### Framework-supplied Assistant Messages
+
+When the backend has already generated the final reply and no model call is needed, the tail message in `messages` can use `role=assistant` with non-empty string `content`. The Runner appends it to an existing session that already contains a real `role=user` message, persists it to the session transcript and AG-UI track, and does not invoke the underlying Agent. On success, SSE returns only `RUN_STARTED` and `RUN_FINISHED`; persistence failures return `RUN_STARTED` and `RUN_ERROR`.
+
+An assistant-only new session fails instead of fabricating a user message, so the history start boundary remains the first real user message.
+
 ## RunAgentInput Hook
 
 `RunAgentInput Hook` runs before the AG-UI Runner handles a request. It is used to normalize or rewrite `RunAgentInput` consistently. The real-time conversation, message snapshot, and cancel routes all use the request body after Hook processing.
```

**File**: `docs/mkdocs/zh/agui/chat.md` (modified, +7/-1)
```diff
@@ -23,7 +23,7 @@ type RunAgentInput struct {
 	RunID          string          // 本次运行 ID，用于关联运行生命周期事件。
 	ParentRunID    *string         // 父运行 ID，可选。
 	State          any             // 任意状态；对象类型的值默认会合并到 RuntimeState。
-	Messages       []Message       // 消息列表，用于传递本次用户输入或外部工具结果。
+	Messages       []Message       // 消息列表，用于传递本次用户输入、外部工具结果或框架下发的 assistant 消息。
 	Tools          []Tool          // 工具定义列表，协议字段，可选。
 	Context        []Context       // 上下文列表，协议字段，可选。
 	ForwardedProps any             // 任意透传字段，通常用于携带业务自定义参数。
@@ -157,6 +157,12 @@ DATA 请求体示例：
 
 每条 `role=tool` 消息对应一个工具调用结果。`toolCallId` 用于关联上一轮事件流中的工具调用，`name` 表示工具名，`content` 使用字符串承载工具执行结果；`id` 会作为返回 `TOOL_CALL_RESULT` 事件时的 message id。
 
+### 框架下发的 Assistant 消息
+
+后台已经生成最终回复、无需再次调用大模型时，可以把 `messages` 尾部消息设为 `role=assistant`，并使用非空字符串 `content`。Runner 会将该消息追加到已有且包含真实 `role=user` 消息的会话，写入 session transcript 和 AG-UI track，不会调用底层 Agent。成功时 SSE 只返回 `RUN_STARTED` 和 `RUN_FINISHED`；持久化失败时返回 `RUN_STARTED` 和 `RUN_ERROR`。
+
+assistant-only 的新会话会失败，不会伪造 user 消息；因此 history 的起点逻辑仍然从真实 user 消息开始。
+
 ## RunAgentInput Hook
 
 `RunAgentInput Hook` 会在 AG-UI Runner 处理请求前执行，用于统一规范化或改写 `RunAgentInput`。实时对话、消息快照和取消路由都会使用 Hook 处理后的请求体。
```

**File**: `server/agui/runner/runner.go` (modified, +122/-2)
```diff
@@ -212,12 +212,31 @@ func inputMessagesFromRunAgentInput(input *adapter.RunAgentInput) (*runAgentMess
 		return nil, errors.New("no messages provided")
 	}
 	lastMessage := input.Messages[len(input.Messages)-1]
-	if lastMessage.Role != types.RoleUser && lastMessage.Role != types.RoleTool {
-		return nil, errors.New("last message role must be user or tool")
+	if lastMessage.Role != types.RoleUser &&
+		lastMessage.Role != types.RoleTool &&
+		lastMessage.Role != types.RoleAssistant {
+		return nil, errors.New("last message role must be user, assistant or tool")
 	}
 	if lastMessage.Role == types.RoleTool {
 		return toolMessagesFromRunAgentInput(input.Messages)
 	}
+	if lastMessage.Role == types.RoleAssistant {
+		content, ok := lastMessage.ContentString()
+		if !ok {
+			return nil, errors.New("assistant message content is not a string")
+		}
+		if content == "" {
+			return nil, errors.New("assistant message content is empty")
+		}
+		inputMessage := model.Message{
+			Role:    model.RoleAssistant,
+			Content: content,
+		}
+		return &runAgentMessages{
+			inputMessage: &inputMessage,
+			inputID:      lastMessage.ID,
+		}, nil
+	}
 	if content, ok := lastMessage.ContentString(); ok {
 		inputMessage := model.Message{
 			Role:    model.RoleUser,
@@ -517,6 +536,10 @@ func (r *runner) run(ctx context.Context, cancel context.CancelCauseFunc, key se
 	if !r.emitStartupEvent(ctx, events, aguievents.NewRunStartedEvent(threadID, runID), input) {
 		return
 	}
+	if input.messages.inputMessage.Role == model.RoleAssistant {
+		r.runExternalAssistantMessage(ctx, events, input)
+		return
+	}
 	if input.messages.inputMessage.Role == model.RoleTool {
 		if !r.emitToolResultEvents(ctx, events, input) {
 			return
@@ -546,6 +569,103 @@ func (r *runner) run(ctx context.Context, cancel context.CancelCauseFunc, key se
 	<-agentRunDone
 }
 
+// runExternalAssistantMessage records an assistant message supplied by the
+// caller without invoking the underlying model runner. This is intended for
+// framework/backend notifications that need to become part of an existing
+// conversation transcript.
+func (r *runner) runExternalAssistantMessage(
+	ctx context.Context,
+	events chan<- aguievents.Event,
+	input *runInput,
+) {
+	if err := r.persistExternalAssistantMessage(ctx, input); err != nil {
+		r.emitEvent(ctx, events, aguievents.NewRunErrorEvent(
+			fmt.Sprintf("persist assistant message: %v", err),
+			aguievents.WithRunID(input.runID),
+		), input)
+		return
+	}
+	// Persist the assistant message before notifying the caller that the run
+	// finished. closeTrack in the run defer flushes the terminal lifecycle event.
+	if err := r.flushTrack(ctx, input.key); err != nil {
+		r.emitEvent(ctx, events, aguievents.NewRunErrorEvent(
+			fmt.Sprintf("flush assistant track events: %v", err),
+			aguievents.WithRunID(input.runID),
+		), input)
+		return
+	}
+	if !r.emitEvent(ctx, events, aguievents.NewRunFinishedEvent(input.threadID, input.runID), input) {
+		return
+	}
+}
+
+// persistExternalAssistantMessage appends the supplied assistant message to
+// the core session transcript and AG-UI track. Assistant-only runs must target
+// an existing user-anchored session; creating a new assistant-only session
+// would be discarded by session history filtering and would violate the
+// history contract.
+func (r *runner) persistExternalAssistantMessage(ctx context.Context, input *runInput) error {
+	if r.sessionService == nil {
+		return errors.New("session service is nil")
+	}
+	if r.tracker == nil {
+		return errors.New("track service is not configured")
+	}
+	message := *input.messages.inputMessage
+	persistCtx, cancel := r.newTrackPersistenceContext(ctx)
+	defer cancel()
+	sess, err := r.sessionService.GetSession(persistCtx, input.key)
+	if err != nil {
+		return fmt.Errorf("get session: %w", err)
+	}
+	if sess == nil {
+		return errors.New("assistant message requires an existing user session")
+	}
+	hasUserMessage := false
+	for _, evt := range sess.Events {
+		if evt.IsUserMessage() {
+			hasUserMessage = true
+			break
+		}
+	}
+	if !hasUserMessage {
+		return errors.New("assistant message requires an existing user message")
+	}
+	messageID := input.messages.inputID
+	if messageID == "" {
+		messageID = uuid.NewString()
+		input.messages.inputID = messageID
+	}
+	evt := event.NewResponseEvent(
+		input.runID,
+		input.key.AppName,
+		&model.Response{
+			ID:     messageID,
+			Object: model.ObjectTypeChatCompletion,
+			Done:   true,
+			Choices: []model.Choice{{
+				Index:   0,
+				Message: message,
+			}},
+		},
+	)
+	evt.RequestID = input.runID
+	if err := r.sessionService.AppendEvent(persistCtx, sess, evt); err != nil {
+		return fmt.Errorf("append session event: %w", err)
+	}
+	trackEvents := []aguievents.Event{
+		aguievents.NewTextMessageStartEvent(messageID, aguievents.WithRole(model.RoleAssistant.String())),
+		aguievents.NewTextMessageContentEvent(messageID, message.Content),
+		aguievents.NewTextMessageEndEvent(
```

**File**: `server/agui/runner/runner_test.go` (modified, +319/-3)
```diff
@@ -1719,7 +1719,7 @@ func TestRunUserIDResolverError(t *testing.T) {
 	assert.Equal(t, 0, underlying.calls)
 }
 
-func TestRunLastMessageNotUser(t *testing.T) {
+func TestRunLastMessageUnsupportedRole(t *testing.T) {
 	underlying := &fakeRunner{}
 	fakeTrans := &fakeTranslator{}
 	r := &runner{
@@ -1734,12 +1734,328 @@ func TestRunLastMessageNotUser(t *testing.T) {
 	input := &adapter.RunAgentInput{
 		ThreadID: "thread",
 		RunID:    "run",
-		Messages: []types.Message{{Role: types.RoleAssistant, Content: "bot"}},
+		Messages: []types.Message{{Role: types.RoleSystem, Content: "system"}},
 	}
 	eventsCh, err := r.Run(context.Background(), input)
 	assert.Nil(t, eventsCh)
 	assert.ErrorContains(t, err, "build input message")
-	assert.ErrorContains(t, err, "last message role must be user or tool")
+	assert.ErrorContains(t, err, "last message role must be user, assistant or tool")
+	assert.Equal(t, 0, underlying.calls)
+}
+
+func TestRunAssistantMessagePersistsWithoutInvokingRunner(t *testing.T) {
+	ctx := context.Background()
+	service := inmemory.NewSessionService()
+	key := session.Key{AppName: "app", UserID: "user", SessionID: "thread"}
+	sess, err := service.CreateSession(ctx, key, nil)
+	require.NoError(t, err)
+	userEvent := agentevent.NewResponseEvent("seed", "user", &model.Response{
+		Choices: []model.Choice{{
+			Message: model.Message{Role: model.RoleUser, Content: "hello"},
+		}},
+	})
+	require.NoError(t, service.AppendEvent(ctx, sess, userEvent))
+
+	underlying := &fakeRunner{}
+	r := New(underlying,
+		WithAppName("app"),
+		WithSessionService(service),
+		WithFlushInterval(0),
+	)
+	eventsCh, err := r.Run(ctx, &adapter.RunAgentInput{
+		ThreadID: "thread",
+		RunID:    "run",
+		Messages: []types.Message{{
+			ID:      "assistant-1",
+			Role:    types.RoleAssistant,
+			Content: "后台通知",
+		}},
+	})
+	require.NoError(t, err)
+	events := collectEvents(t, eventsCh)
+	require.Len(t, events, 2)
+	assert.IsType(t, (*aguievents.RunStartedEvent)(nil), events[0])
+	assert.IsType(t, (*aguievents.RunFinishedEvent)(nil), events[1])
+	assert.Equal(t, 0, underlying.calls)
+
+	stored, err := service.GetSession(ctx, key)
+	require.NoError(t, err)
+	require.NotNil(t, stored)
+	var assistantFound bool
+	for _, event := range stored.Events {
+		if len(event.Choices) == 0 {
+			continue
+		}
+		message := event.Choices[0].Message
+		if message.Role == model.RoleAssistant && message.Content == "后台通知" {
+			assistantFound = true
+			break
+		}
+	}
+	assert.True(t, assistantFound)
+
+	trackEvents, err := service.GetTrackEvents(ctx, key, aguitrack.TrackAGUI)
+	require.NoError(t, err)
+	var trackAssistantFound bool
+	for _, trackEvent := range trackEvents.Events {
+		var payload map[string]any
+		require.NoError(t, json.Unmarshal(trackEvent.Payload, &payload))
+		if payload["type"] == string(aguievents.EventTypeTextMessageStart) &&
+			payload["messageId"] == "assistant-1" && payload["role"] == "assistant" {
+			trackAssistantFound = true
+		}
+	}
+	assert.True(t, trackAssistantFound)
+}
+
+func TestInputMessagesFromRunAgentInputAcceptsAssistantText(t *testing.T) {
+	got, err := inputMessagesFromRunAgentInput(&adapter.RunAgentInput{
+		Messages: []types.Message{{
+			ID:      "assistant-1",
+			Role:    types.RoleAssistant,
+			Content: "通知",
+		}},
+	})
+	require.NoError(t, err)
+	require.NotNil(t, got)
+	require.NotNil(t, got.inputMessage)
+	assert.Equal(t, model.RoleAssistant, got.inputMessage.Role)
+	assert.Equal(t, "通知", got.inputMessage.Content)
+	assert.Equal(t, "assistant-1", got.inputID)
+	assert.Nil(t, got.userMessage)
+}
+
+func TestInputMessagesFromRunAgentInputRejectsInvalidAssistantContent(t *testing.T) {
+	tests := []struct {
+		name    string
+		content any
+		errText string
+	}{
+		{name: "empty string", content: "", errText: "assistant message content is empty"},
+		{name: "non-string", content: []any{"通知"}, errText: "assistant message content is not a string"},
+	}
+	for _, tt := range tests {
+		t.Run(tt.name, func(t *testing.T) {
+			_, err := inputMessagesFromRunAgentInput(&adapter.RunAgentInput{
+				Messages: []types.Message{{
+					Role:    types.RoleAssistant,
+					Content: tt.content,
+				}},
+			})
+			assert.ErrorContains(t, err, tt.errText)
+		})
+	}
+}
+
+func TestRunAssistantMessageWithoutExistingUserSessionReturnsRunError(t *testing.T) {
+	service := inmemory.NewSessionService()
+	underlying := &fakeRunner{}
+	r := New(underlying,
+		WithAppName("app"),
+		WithSessionService(service),
+		WithFlushInterval(0),
+	)
+	eventsCh, err := r.Run(context.Background(), &adapter.RunAgentInput{
+		ThreadID: "thread",
+		RunID:    "run",
+		Messages: []types.Message{{Role: types.RoleAssistant, Content: "通知"}},
+	})
+	require.NoError(t, err)
+	events := collectEvents(t, eventsCh)
+	require.Len(t, events, 2)
+	assert.IsType(t, (*aguievents.RunStartedEvent)(nil), events[0])
+	assert.IsType(t, (*aguievents.RunErrorEvent)(nil), events[1])
+	assert.Contains(t, events[1].(*aguievents.RunErrorEvent).Me
```

---

### Incident Patch 8: `396360ce` (2026-08-31)
**Commit Message**: agent/llmagent: skip hidden child trace entries (#2498)

This keeps LLM execution trace reporting aligned with the exported
static structure by only creating child invocation trace steps and
applied surface IDs when the invocation maps to a static child node,
while preserving static child and team member traces.

**File**: `agent/llmagent/llm_agent.go` (modified, +16/-15)
```diff
@@ -1535,21 +1535,22 @@ func (a *LLMAgent) Run(ctx context.Context, invocation *agent.Invocation) (e <-c
 	a.setupInvocation(invocation)
 	var traceLease tracecapture.StepLease
 	if invocation.RunOptions.ExecutionTraceEnabled {
-		traceNodeID := agent.InvocationTraceNodeID(invocation)
-		traceCtx := agent.NewInvocationContext(ctx, invocation)
-		traceLease = tracecapture.EnsureInvocationStep(
-			traceCtx,
-			func() string {
-				return agent.StartExecutionTraceStep(
-					invocation,
-					traceNodeID,
-					llmAgentTraceInputSnapshot(invocation),
-					nil,
-				)
-			},
-		)
-		if traceLease.Owns {
-			tracecapture.SetStepNodeType(traceCtx, traceLease.StepID, "agent")
+		if traceNodeID := executionTraceStepNodeID(invocation); traceNodeID != "" {
+			traceCtx := agent.NewInvocationContext(ctx, invocation)
+			traceLease = tracecapture.EnsureInvocationStep(
+				traceCtx,
+				func() string {
+					return agent.StartExecutionTraceStep(
+						invocation,
+						traceNodeID,
+						llmAgentTraceInputSnapshot(invocation),
+						nil,
+					)
+				},
+			)
+			if traceLease.Owns {
+				tracecapture.SetStepNodeType(traceCtx, traceLease.StepID, "agent")
+			}
 		}
 	}
 	ctx = a.withWorkspace(ctx, invocation)
```

**File**: `agent/llmagent/surface_runtime.go` (modified, +58/-1)
```diff
@@ -10,6 +10,7 @@ package llmagent
 
 import (
 	"context"
+	"strings"
 
 	"trpc.group/trpc-go/trpc-agent-go/agent"
 	astructure "trpc.group/trpc-go/trpc-agent-go/agent/structure"
@@ -221,8 +222,9 @@ func (a *LLMAgent) skillToolFlagsForInvocation(
 }
 
 // ExecutionTraceAppliedSurfaceIDs reports the effective surfaces that affected one invocation step.
+// It returns nil when a shared-trace child invocation does not map to a static child node.
 func (a *LLMAgent) ExecutionTraceAppliedSurfaceIDs(inv *agent.Invocation) []string {
-	nodeID := agent.InvocationSurfaceRootNodeID(inv)
+	nodeID := executionTraceSurfaceNodeID(inv)
 	if nodeID == "" {
 		return nil
 	}
@@ -271,6 +273,61 @@ func (a *LLMAgent) ExecutionTraceAppliedSurfaceIDs(inv *agent.Invocation) []stri
 	return appliedSurfaceIDs
 }
 
+// executionTraceSurfaceNodeID returns the node id that can safely publish applied surfaces.
+func executionTraceSurfaceNodeID(inv *agent.Invocation) string {
+	if inv == nil {
+		return ""
+	}
+	nodeID := agent.InvocationSurfaceRootNodeID(inv)
+	if nodeID == "" {
+		return ""
+	}
+	if executionTraceUsesParentCapture(inv) && !executionTraceNodeIsUnderParent(inv) {
+		return ""
+	}
+	return nodeID
+}
+
+// executionTraceStepNodeID returns the static trace node id for an LLM step.
+func executionTraceStepNodeID(inv *agent.Invocation) string {
+	if inv == nil {
+		return ""
+	}
+	nodeID := agent.InvocationTraceNodeID(inv)
+	if nodeID == "" {
+		return ""
+	}
+	if executionTraceUsesParentCapture(inv) && !executionTraceNodeIsUnderParent(inv) {
+		return ""
+	}
+	return nodeID
+}
+
+// executionTraceUsesParentCapture reports whether an invocation participates in its parent's trace.
+func executionTraceUsesParentCapture(inv *agent.Invocation) bool {
+	parent := inv.GetParentInvocation()
+	return parent != nil &&
+		inv.RunOptions.ExecutionTraceEnabled &&
+		parent.RunOptions.ExecutionTraceEnabled
+}
+
+// executionTraceNodeIsUnderParent reports whether the invocation maps to a static child node.
+func executionTraceNodeIsUnderParent(inv *agent.Invocation) bool {
+	parent := inv.GetParentInvocation()
+	if parent == nil {
+		return false
+	}
+	parentNodeID := agent.InvocationTraceNodeID(parent)
+	nodeID := agent.InvocationTraceNodeID(inv)
+	if parentNodeID == "" || nodeID == "" || nodeID == parentNodeID {
+		return false
+	}
+	if rootNodeID := agent.InvocationTeamMemberTraceRoot(inv); rootNodeID != "" {
+		return nodeID == rootNodeID || strings.HasPrefix(nodeID, rootNodeID+"/")
+	}
+	return strings.HasPrefix(nodeID, parentNodeID+"/")
+}
+
 // InvocationToolSurface returns the invocation-scoped tool surface and user tool names.
 func (a *LLMAgent) InvocationToolSurface(
 	ctx context.Context,
```

**File**: `agent/llmagent/surface_runtime_test.go` (modified, +204/-0)
```diff
@@ -151,6 +151,210 @@ func TestLLMAgent_ExecutionTraceAppliedSurfaceIDs(t *testing.T) {
 	)
 }
 
+func TestLLMAgent_ExecutionTraceAppliedSurfaceIDs_SkipsNonStaticChildInvocation(t *testing.T) {
+	agt := New(
+		"router_intent_parser",
+		WithModel(newDummyModel()),
+		WithInstruction("route intent"),
+	)
+	parent := agent.NewInvocation(
+		agent.WithInvocationTraceNodeID("workflow/classify"),
+		agent.WithInvocationRunOptions(agent.NewRunOptions(
+			agent.WithExecutionTraceEnabled(true),
+		)),
+	)
+	agent.SetInvocationSurfaceRootNodeID(parent, "workflow/classify")
+	child := parent.Clone()
+	agt.setupInvocation(child)
+	require.Equal(t, "workflow/classify", agent.InvocationSurfaceRootNodeID(child))
+	require.Nil(t, agt.ExecutionTraceAppliedSurfaceIDs(child))
+}
+
+func TestLLMAgent_Run_NonStaticChildInvocationDoesNotCreateTraceStep(t *testing.T) {
+	m := &captureModel{}
+	agt := New(
+		"router_intent_parser",
+		WithModel(m),
+		WithInstruction("route intent"),
+	)
+	parent := agent.NewInvocation(
+		agent.WithInvocationTraceNodeID("workflow/classify"),
+		agent.WithInvocationMessage(model.NewUserMessage("hello")),
+		agent.WithInvocationRunOptions(agent.NewRunOptions(
+			agent.WithExecutionTraceEnabled(true),
+		)),
+	)
+	child := parent.Clone(
+		agent.WithInvocationMessage(model.NewUserMessage("route")),
+	)
+	ch, err := agt.Run(context.Background(), child)
+	require.NoError(t, err)
+	for range ch {
+	}
+	require.NotNil(t, m.got)
+	trace := agent.BuildExecutionTrace(parent, atrace.TraceStatusCompleted)
+	require.NotNil(t, trace)
+	require.Empty(t, trace.Steps)
+}
+
+func TestLLMAgent_Run_ChildWithOwnTraceCaptureReportsTraceStep(t *testing.T) {
+	m := &captureModel{}
+	agt := New(
+		"router_intent_parser",
+		WithModel(m),
+		WithInstruction("route intent"),
+	)
+	parent := agent.NewInvocation(
+		agent.WithInvocationTraceNodeID("workflow/classify"),
+		agent.WithInvocationMessage(model.NewUserMessage("hello")),
+	)
+	child := parent.Clone(
+		agent.WithInvocationRunOptions(agent.NewRunOptions(
+			agent.WithExecutionTraceEnabled(true),
+		)),
+		agent.WithInvocationMessage(model.NewUserMessage("route")),
+	)
+	ch, err := agt.Run(context.Background(), child)
+	require.NoError(t, err)
+	for range ch {
+	}
+	require.NotNil(t, m.got)
+	require.Nil(t, agent.BuildExecutionTrace(parent, atrace.TraceStatusCompleted))
+	trace := agent.BuildExecutionTrace(child, atrace.TraceStatusCompleted)
+	require.NotNil(t, trace)
+	require.Len(t, trace.Steps, 1)
+	require.Equal(t, "router_intent_parser", trace.Steps[0].NodeID)
+	require.Contains(t, trace.Steps[0].AppliedSurfaceIDs, "router_intent_parser#instruction")
+}
+
+func TestLLMAgent_Run_StaticChildInvocationReportsTraceStep(t *testing.T) {
+	m := &captureModel{}
+	agt := New(
+		"router_intent_parser",
+		WithModel(m),
+		WithInstruction("route intent"),
+	)
+	parent := agent.NewInvocation(
+		agent.WithInvocationTraceNodeID("workflow/classify"),
+		agent.WithInvocationMessage(model.NewUserMessage("hello")),
+		agent.WithInvocationRunOptions(agent.NewRunOptions(
+			agent.WithExecutionTraceEnabled(true),
+		)),
+	)
+	child := parent.Clone(
+		agent.WithInvocationTraceNodeID("workflow/classify/router"),
+		agent.WithInvocationMessage(model.NewUserMessage("route")),
+	)
+	ch, err := agt.Run(context.Background(), child)
+	require.NoError(t, err)
+	for range ch {
+	}
+	require.NotNil(t, m.got)
+	trace := agent.BuildExecutionTrace(parent, atrace.TraceStatusCompleted)
+	require.NotNil(t, trace)
+	require.Len(t, trace.Steps, 1)
+	require.Equal(t, "workflow/classify/router", trace.Steps[0].NodeID)
+	require.Contains(t, trace.Steps[0].AppliedSurfaceIDs, "workflow/classify/router#instruction")
+}
+
+func TestLLMAgent_ExecutionTraceAppliedSurfaceIDs_UsesStaticChildInvocation(t *testing.T) {
+	agt := New(
+		"router_intent_parser",
+		WithModel(newDummyModel()),
+		WithInstruction("route intent"),
+	)
+	parent := agent.NewInvocation(
+		agent.WithInvocationTraceNodeID("workflow/classify"),
+		agent.WithInvocationRunOptions(agent.NewRunOptions(
+			agent.WithExecutionTraceEnabled(true),
+		)),
+	)
+	child := parent.Clone(
+		agent.WithInvocationTraceNodeID("workflow/classify/router"),
+	)
+	agt.setupInvocation(child)
+	require.Contains(
+		t,
+		agt.ExecutionTraceAppliedSurfaceIDs(child),
+		"workflow/classify/router#instruction",
+	)
+}
+
+func TestLLMAgent_ExecutionTraceAppliedSurfaceIDs_UsesTeamMemberStaticInvocation(t *testing.T) {
+	agt := New(
+		"beta",
+		WithModel(newDummyModel()),
+		WithInstruction("member instruction"),
+	)
+	parent := agent.NewInvocation(
+		agent.WithInvocationTraceNodeID("swarm/alpha"),
+		agent.WithInvocationRunOptions(agent.NewRunOptions(
+			agent.WithExecutionTraceEnabled(true),
+		)),
+	)
+	agent.SetInvocationTeamMemberTraceRoot(parent, "swarm")
+	child := parent.Clone(
+		agent.WithInvocationTraceNodeID("swarm/beta"),
+	)
+	agt.setupInvocation(child)
+	require.Contains(
+		t,
+		agt.ExecutionTraceAppliedSurfaceIDs(child),
+		"swarm/beta#in
```

**File**: `internal/teamtrace/teamtrace.go` (modified, +94/-5)
```diff
@@ -10,12 +10,73 @@
 package teamtrace
 
 import (
+	"context"
+
 	"trpc.group/trpc-go/trpc-agent-go/agent"
 	istructure "trpc.group/trpc-go/trpc-agent-go/internal/structure"
 )
 
 const memberTraceRootConfigsKey = "__trpc_agent_internal_team_member_trace_root__"
 
+const memberSurfaceRootStateKey = "__trpc_agent_internal_team_member_surface_root_state__"
+
+type memberMountContextKey struct{}
+
+// CoordinatorLayout describes static coordinator-team node ids under one root.
+type CoordinatorLayout struct {
+	CoordinatorNodeID string
+	MemberNodeIDs     []string
+}
+
+// MemberMount carries the concrete node ids for one mounted Team member call.
+type MemberMount struct {
+	TraceNodeID       string
+	SurfaceRootNodeID string
+}
+
+// NewCoordinatorLayout allocates coordinator and member node ids like static export.
+func NewCoordinatorLayout(rootNodeID string, members []agent.Agent) CoordinatorLayout {
+	allocator := istructure.NewPathAllocator(rootNodeID)
+	layout := CoordinatorLayout{
+		CoordinatorNodeID: allocator.Next("coordinator"),
+	}
+	if len(members) == 0 {
+		return layout
+	}
+	layout.MemberNodeIDs = make([]string, 0, len(members))
+	for _, member := range members {
+		memberName := ""
+		if member != nil {
+			memberName = member.Info().Name
+		}
+		layout.MemberNodeIDs = append(layout.MemberNodeIDs, allocator.Next(memberName))
+	}
+	return layout
+}
+
+// ContextWithMemberMount stores one mounted Team member path in ctx.
+func ContextWithMemberMount(ctx context.Context, mount MemberMount) context.Context {
+	if ctx == nil {
+		ctx = context.Background()
+	}
+	if mount.TraceNodeID == "" || mount.SurfaceRootNodeID == "" {
+		return ctx
+	}
+	return context.WithValue(ctx, memberMountContextKey{}, mount)
+}
+
+// MemberMountFromContext returns one mounted Team member path from ctx.
+func MemberMountFromContext(ctx context.Context) (MemberMount, bool) {
+	if ctx == nil {
+		return MemberMount{}, false
+	}
+	mount, ok := ctx.Value(memberMountContextKey{}).(MemberMount)
+	if !ok || mount.TraceNodeID == "" || mount.SurfaceRootNodeID == "" {
+		return MemberMount{}, false
+	}
+	return mount, true
+}
+
 // RootNodeID returns the mounted surface lookup root node id for one team invocation.
 func RootNodeID(inv *agent.Invocation, teamName string) string {
 	if inv != nil {
@@ -46,7 +107,7 @@ func MemberNodeID(rootNodeID string, memberName string) string {
 	return istructure.JoinNodeID(rootNodeID, memberName)
 }
 
-// WithMemberTraceRoot stores the mounted team root in custom configs.
+// WithMemberTraceRoot stores the mounted execution-trace root in custom configs.
 func WithMemberTraceRoot(cfgs map[string]any, rootNodeID string) map[string]any {
 	if rootNodeID == "" {
 		return cfgs
@@ -56,7 +117,7 @@ func WithMemberTraceRoot(cfgs map[string]any, rootNodeID string) map[string]any
 	return out
 }
 
-// MemberTraceRoot returns the mounted team root from custom configs.
+// MemberTraceRoot returns the mounted execution-trace root from custom configs.
 func MemberTraceRoot(cfgs map[string]any) string {
 	if cfgs == nil {
 		return ""
@@ -69,20 +130,48 @@ func MemberTraceRoot(cfgs map[string]any) string {
 	return rootNodeID
 }
 
-// SetMemberTraceRootForInvocation stores the mounted team root on one invocation.
+// SetMemberTraceRootForInvocation stores the mounted execution-trace root.
 func SetMemberTraceRootForInvocation(
 	inv *agent.Invocation,
 	rootNodeID string,
 ) {
 	agent.SetInvocationTeamMemberTraceRoot(inv, rootNodeID)
 }
 
-// ClearMemberTraceRootForInvocation removes the mounted team root from one invocation.
+// ClearMemberTraceRootForInvocation removes the mounted execution-trace root.
 func ClearMemberTraceRootForInvocation(inv *agent.Invocation) {
 	agent.ClearInvocationTeamMemberTraceRoot(inv)
 }
 
-// MemberTraceRootForInvocation returns the mounted team root for one invocation.
+// SetMemberSurfaceRootForInvocation stores the mounted Team member surface root.
+func SetMemberSurfaceRootForInvocation(
+	inv *agent.Invocation,
+	rootNodeID string,
+) {
+	if inv == nil || rootNodeID == "" {
+		return
+	}
+	inv.SetState(memberSurfaceRootStateKey, rootNodeID)
+}
+
+// ClearMemberSurfaceRootForInvocation removes the mounted Team member surface root.
+func ClearMemberSurfaceRootForInvocation(inv *agent.Invocation) {
+	if inv == nil {
+		return
+	}
+	inv.DeleteState(memberSurfaceRootStateKey)
+}
+
+// MemberSurfaceRootForInvocation returns the mounted Team member surface root.
+func MemberSurfaceRootForInvocation(inv *agent.Invocation) string {
+	if inv == nil {
+		return ""
+	}
+	rootNodeID, _ := agent.GetStateValue[string](inv, memberSurfaceRootStateKey)
+	return rootNodeID
+}
+
+// MemberTraceRootForInvocation returns the mounted execution-trace root.
 func MemberTraceRootForInvocation(inv *agent.Invocation) string {
 	if inv == nil {
 		return ""
```

**File**: `internal/teamtrace/teamtrace_test.go` (modified, +99/-0)
```diff
@@ -9,13 +9,97 @@
 package teamtrace
 
 import (
+	"context"
 	"testing"
 
 	"github.com/stretchr/testify/require"
 	"trpc.group/trpc-go/trpc-agent-go/agent"
+	"trpc.group/trpc-go/trpc-agent-go/event"
 	"trpc.group/trpc-go/trpc-agent-go/internal/surfacepatch"
+	"trpc.group/trpc-go/trpc-agent-go/tool"
 )
 
+type layoutAgent string
+
+func (a layoutAgent) Run(
+	context.Context,
+	*agent.Invocation,
+) (<-chan *event.Event, error) {
+	ch := make(chan *event.Event)
+	close(ch)
+	return ch, nil
+}
+
+func (a layoutAgent) Tools() []tool.Tool { return nil }
+
+func (a layoutAgent) Info() agent.Info { return agent.Info{Name: string(a)} }
+
+func (a layoutAgent) SubAgents() []agent.Agent { return nil }
+
+func (a layoutAgent) FindSubAgent(string) agent.Agent { return nil }
+
+func TestNewCoordinatorLayout_UsesStaticExportOrder(t *testing.T) {
+	layout := NewCoordinatorLayout(
+		"workflow/team",
+		[]agent.Agent{
+			layoutAgent("member/one"),
+			layoutAgent("member~two"),
+		},
+	)
+	require.Equal(t, "workflow/team/coordinator", layout.CoordinatorNodeID)
+	require.Equal(t, []string{
+		"workflow/team/member~1one",
+		"workflow/team/member~0two",
+	}, layout.MemberNodeIDs)
+}
+
+func TestNewCoordinatorLayout_HandlesEmptyAndNilMembers(t *testing.T) {
+	empty := NewCoordinatorLayout("workflow/team", nil)
+	require.Equal(t, "workflow/team/coordinator", empty.CoordinatorNodeID)
+	require.Empty(t, empty.MemberNodeIDs)
+	layout := NewCoordinatorLayout(
+		"workflow/team",
+		[]agent.Agent{
+			nil,
+			layoutAgent(""),
+		},
+	)
+	require.Equal(t, []string{
+		"workflow/team/_",
+		"workflow/team/_~2",
+	}, layout.MemberNodeIDs)
+}
+
+func TestMemberMountContextHelpers(t *testing.T) {
+	mount := MemberMount{
+		TraceNodeID:       "trace/team/member",
+		SurfaceRootNodeID: "surface/team/member",
+	}
+	ctx := ContextWithMemberMount(context.Background(), mount)
+	got, ok := MemberMountFromContext(ctx)
+	require.True(t, ok)
+	require.Equal(t, mount, got)
+	ctx = ContextWithMemberMount(nil, mount)
+	got, ok = MemberMountFromContext(ctx)
+	require.True(t, ok)
+	require.Equal(t, mount, got)
+	ctx = ContextWithMemberMount(context.Background(), MemberMount{
+		TraceNodeID: "trace/team/member",
+	})
+	_, ok = MemberMountFromContext(ctx)
+	require.False(t, ok)
+	_, ok = MemberMountFromContext(context.WithValue(
+		context.Background(),
+		memberMountContextKey{},
+		MemberMount{TraceNodeID: "trace/team/member"},
+	))
+	require.False(t, ok)
+	_, ok = MemberMountFromContext(context.Background())
+	require.False(t, ok)
+	_, ok = MemberMountFromContext(nil)
+	require.False(t, ok)
+}
+
 func TestRootNodeID_PrefersMountedSurfaceRoot(t *testing.T) {
 	inv := agent.NewInvocation(
 		agent.WithInvocationTraceNodeID("trace/team"),
@@ -82,6 +166,21 @@ func TestMemberTraceRootForInvocation_PrefersInvocationStateAndFallsBackToConfig
 	require.Equal(t, "workflow/team/config", MemberTraceRootForInvocation(inv))
 }
 
+func TestMemberSurfaceRootForInvocation_StateHelpers(t *testing.T) {
+	var nilInv *agent.Invocation
+	SetMemberSurfaceRootForInvocation(nilInv, "workflow/team")
+	ClearMemberSurfaceRootForInvocation(nilInv)
+	require.Empty(t, MemberSurfaceRootForInvocation(nilInv))
+	inv := agent.NewInvocation()
+	require.Empty(t, MemberSurfaceRootForInvocation(inv))
+	SetMemberSurfaceRootForInvocation(inv, "workflow/team")
+	require.Equal(t, "workflow/team", MemberSurfaceRootForInvocation(inv))
+	SetMemberSurfaceRootForInvocation(inv, "")
+	require.Equal(t, "workflow/team", MemberSurfaceRootForInvocation(inv))
+	ClearMemberSurfaceRootForInvocation(inv)
+	require.Empty(t, MemberSurfaceRootForInvocation(inv))
+}
+
 func TestMemberTraceRootForInvocation_NilAndEmptyInput(t *testing.T) {
 	var nilInv *agent.Invocation
 	SetMemberTraceRootForInvocation(nilInv, "workflow/team")
```

**File**: `team/structure_export.go` (modified, +5/-5)
```diff
@@ -15,6 +15,7 @@ import (
 	"trpc.group/trpc-go/trpc-agent-go/agent"
 	"trpc.group/trpc-go/trpc-agent-go/agent/structure"
 	istructure "trpc.group/trpc-go/trpc-agent-go/internal/structure"
+	"trpc.group/trpc-go/trpc-agent-go/internal/teamtrace"
 )
 
 // Export exports the static structure of the team.
@@ -76,15 +77,14 @@ func exportCoordinatorTeam(
 	if coordinator == nil {
 		return snapshot, nil
 	}
-	memberAllocator := istructure.NewPathAllocator(rootNodeID)
+	layout := teamtrace.NewCoordinatorLayout(rootNodeID, members)
 	coordinatorSnapshot, err := exportChild(ctx, coordinator)
 	if err != nil {
 		return nil, err
 	}
-	coordinatorPath := memberAllocator.Next("coordinator")
 	rebasedCoordinator, err := istructure.RebaseSnapshot(
 		coordinatorSnapshot,
-		coordinatorPath,
+		layout.CoordinatorNodeID,
 	)
 	if err != nil {
 		return nil, err
@@ -96,12 +96,12 @@ func exportCoordinatorTeam(
 		FromNodeID: rootNodeID,
 		ToNodeID:   rebasedCoordinator.EntryNodeID,
 	})
-	for _, member := range members {
+	for i, member := range members {
 		memberSnapshot, exportErr := exportChild(ctx, member)
 		if exportErr != nil {
 			return nil, exportErr
 		}
-		memberPath := memberAllocator.Next(member.Info().Name)
+		memberPath := layout.MemberNodeIDs[i]
 		rebasedMember, rebaseErr := istructure.RebaseSnapshot(memberSnapshot, memberPath)
 		if rebaseErr != nil {
 			return nil, rebaseErr
```

**File**: `team/team.go` (modified, +82/-9)
```diff
@@ -198,18 +198,27 @@ func (t *Team) runCoordinator(
 	ctx context.Context,
 	invocation *agent.Invocation,
 ) (<-chan *event.Event, error) {
-	if t.coordinator == nil {
+	t.mu.RLock()
+	name := t.name
+	coordinator := t.coordinator
+	members := append([]agent.Agent(nil), t.members...)
+	t.mu.RUnlock()
+	if coordinator == nil {
 		return nil, errors.New("coordinator is nil")
 	}
-	rootNodeID := teamtrace.RootNodeID(invocation, t.name)
-	teamtrace.SetMemberTraceRootForInvocation(invocation, rootNodeID)
+	traceRootNodeID := teamtrace.TraceRootNodeID(invocation, name)
+	surfaceRootNodeID := teamtrace.RootNodeID(invocation, name)
+	surfaceLayout := teamtrace.NewCoordinatorLayout(surfaceRootNodeID, members)
+	teamtrace.SetMemberTraceRootForInvocation(invocation, traceRootNodeID)
+	teamtrace.SetMemberSurfaceRootForInvocation(invocation, surfaceRootNodeID)
 	agent.SetInvocationSurfaceRootNodeID(
 		invocation,
-		teamtrace.CoordinatorNodeID(rootNodeID),
+		surfaceLayout.CoordinatorNodeID,
 	)
-	coordinatorEventCh, err := t.coordinator.Run(ctx, invocation)
+	coordinatorEventCh, err := coordinator.Run(ctx, invocation)
 	if err != nil {
 		agent.ClearInvocationSurfaceRootNodeID(invocation)
+		teamtrace.ClearMemberSurfaceRootForInvocation(invocation)
 		teamtrace.ClearMemberTraceRootForInvocation(invocation)
 		return nil, err
 	}
@@ -223,13 +232,20 @@ func wrapCoordinatorInvocationState(
 	invocation *agent.Invocation,
 	src <-chan *event.Event,
 ) <-chan *event.Event {
-	if invocation == nil || src == nil {
+	if invocation == nil {
 		return src
 	}
+	if src == nil {
+		agent.ClearInvocationSurfaceRootNodeID(invocation)
+		teamtrace.ClearMemberSurfaceRootForInvocation(invocation)
+		teamtrace.ClearMemberTraceRootForInvocation(invocation)
+		return nil
+	}
 	out := make(chan *event.Event)
 	go func() {
 		defer close(out)
 		defer teamtrace.ClearMemberTraceRootForInvocation(invocation)
+		defer teamtrace.ClearMemberSurfaceRootForInvocation(invocation)
 		defer agent.ClearInvocationSurfaceRootNodeID(invocation)
 		for evt := range src {
 			out <- evt
@@ -476,15 +492,21 @@ func newMemberToolSet(
 	members []agent.Agent,
 ) tool.ToolSet {
 	scope := agentToolHistoryScope(cfg.historyScope)
+	memberList := append([]agent.Agent(nil), members...)
 	tools := make([]tool.Tool, 0, len(members))
-	for _, m := range members {
-		tools = append(tools, agenttool.NewTool(
+	for i, m := range members {
+		agentTool := agenttool.NewTool(
 			m,
 			agenttool.WithSkipSummarization(cfg.skipSummarization),
 			agenttool.WithStreamInner(cfg.streamInner),
 			agenttool.WithInnerTextMode(cfg.innerTextMode),
 			agenttool.WithHistoryScope(scope),
-		))
+		)
+		tools = append(tools, &mountedMemberTool{
+			Tool:        agentTool,
+			memberIndex: i,
+			members:     memberList,
+		})
 	}
 	return &staticToolSet{name: cfg.name, tools: tools}
 }
@@ -518,6 +540,57 @@ func (s *staticToolSet) Close() error { return nil }
 
 func (s *staticToolSet) Name() string { return s.name }
 
+type mountedMemberTool struct {
+	*agenttool.Tool
+	memberIndex int
+	members     []agent.Agent
+}
+
+func (t *mountedMemberTool) Call(ctx context.Context, jsonArgs []byte) (any, error) {
+	return t.Tool.Call(t.mountContext(ctx), jsonArgs)
+}
+
+func (t *mountedMemberTool) StreamableCall(
+	ctx context.Context,
+	jsonArgs []byte,
+) (*tool.StreamReader, error) {
+	return t.Tool.StreamableCall(t.mountContext(ctx), jsonArgs)
+}
+
+func (t *mountedMemberTool) mountContext(ctx context.Context) context.Context {
+	if ctx == nil {
+		ctx = context.Background()
+	}
+	mount, ok := t.memberMount(ctx)
+	if !ok {
+		return ctx
+	}
+	return teamtrace.ContextWithMemberMount(ctx, mount)
+}
+
+func (t *mountedMemberTool) memberMount(ctx context.Context) (teamtrace.MemberMount, bool) {
+	parentInv, ok := agent.InvocationFromContext(ctx)
+	if !ok || parentInv == nil {
+		return teamtrace.MemberMount{}, false
+	}
+	traceRootNodeID := teamtrace.MemberTraceRootForInvocation(parentInv)
+	surfaceRootNodeID := teamtrace.MemberSurfaceRootForInvocation(parentInv)
+	if traceRootNodeID == "" || surfaceRootNodeID == "" {
+		return teamtrace.MemberMount{}, false
+	}
+	traceLayout := teamtrace.NewCoordinatorLayout(traceRootNodeID, t.members)
+	surfaceLayout := teamtrace.NewCoordinatorLayout(surfaceRootNodeID, t.members)
+	if t.memberIndex < 0 ||
+		t.memberIndex >= len(traceLayout.MemberNodeIDs) ||
+		t.memberIndex >= len(surfaceLayout.MemberNodeIDs) {
+		return teamtrace.MemberMount{}, false
+	}
+	return teamtrace.MemberMount{
+		TraceNodeID:       traceLayout.MemberNodeIDs[t.memberIndex],
+		SurfaceRootNodeID: surfaceLayout.MemberNodeIDs[t.memberIndex],
+	}, true
+}
+
 func wireSwarmRoster(members []agent.Agent) error {
 	setters := make([]agent.SubAgentSetter, 0, len(members))
 	for _, m := range members {
```

**File**: `team/team_test.go` (modified, +135/-5)
```diff
@@ -13,6 +13,7 @@ package team
 import (
 	"context"
 	"errors"
+	"io"
 	"regexp"
 	"strings"
 	"sync"
@@ -860,7 +861,7 @@ func TestTeam_RunCoordinator_PreservesCustomInvocationState(t *testing.T) {
 	require.Equal(t, "value", value)
 }
 
-func TestTeam_RunCoordinator_MemberToolUsesMemberSurfaceRootNodeID(t *testing.T) {
+func TestTeam_RunCoordinator_MemberToolSeparatesTraceAndSurfaceRoots(t *testing.T) {
 	member := &traceRecordingAgent{name: testMemberNameOne}
 	coordinator := &testCoordinator{name: testCoordinatorName}
 	coordinator.runFunc = func(
@@ -882,6 +883,53 @@ func TestTeam_RunCoordinator_MemberToolUsesMemberSurfaceRootNodeID(t *testing.T)
 	}
 	tm, err := New(coordinator, []agent.Agent{member})
 	require.NoError(t, err)
+	inv := agent.NewInvocation(
+		agent.WithInvocationAgent(tm),
+		agent.WithInvocationSession(session.NewSession(testAppName, testUserID, testSessionID)),
+		agent.WithInvocationTraceNodeID("workflow/trace/team"),
+		agent.WithInvocationRunOptions(agent.RunOptions{
+			CustomAgentConfigs: surfacepatch.WithRootNodeID(
+				nil,
+				"workflow/surface/team",
+			),
+		}),
+		agent.WithInvocationMessage(model.NewUserMessage(testUserMessage)),
+	)
+	ctx := agent.NewInvocationContext(context.Background(), inv)
+	ch, err := tm.Run(ctx, inv)
+	require.NoError(t, err)
+	for range ch {
+	}
+	require.Equal(t, "workflow/trace/team", coordinator.gotTraceNodeID)
+	require.Equal(t, "workflow/surface/team/coordinator", coordinator.gotSurfaceRootNodeID)
+	require.Equal(t, "workflow/trace/team/member_one", member.gotTraceNodeID)
+	require.Equal(t, "workflow/surface/team/member_one", member.gotSurfaceRootNodeID)
+}
+
+func TestTeam_RunCoordinator_DoesNotMountOrdinaryAgentToolAsMember(t *testing.T) {
+	member := &traceRecordingAgent{name: testMemberNameOne}
+	helper := &traceRecordingAgent{name: "helper"}
+	helperTool := agenttool.NewTool(helper)
+	coordinator := &testCoordinator{name: testCoordinatorName}
+	coordinator.runFunc = func(
+		ctx context.Context,
+		_ *agent.Invocation,
+		toolSets []tool.ToolSet,
+	) (<-chan *event.Event, error) {
+		_, err := helperTool.Call(ctx, []byte(testToolArgs))
+		require.NoError(t, err)
+		tools := itool.NewNamedToolSet(toolSets[0]).Tools(ctx)
+		_, err = tools[0].(tool.CallableTool).Call(ctx, []byte(testToolArgs))
+		require.NoError(t, err)
+		ch := make(chan *event.Event, 1)
+		go func() {
+			defer close(ch)
+			ch <- event.New("done", coordinator.name)
+		}()
+		return ch, nil
+	}
+	tm, err := New(coordinator, []agent.Agent{member})
+	require.NoError(t, err)
 	inv := agent.NewInvocation(
 		agent.WithInvocationAgent(tm),
 		agent.WithInvocationSession(session.NewSession(testAppName, testUserID, testSessionID)),
@@ -893,10 +941,8 @@ func TestTeam_RunCoordinator_MemberToolUsesMemberSurfaceRootNodeID(t *testing.T)
 	require.NoError(t, err)
 	for range ch {
 	}
-	require.Equal(t, "workflow/team", coordinator.gotTraceNodeID)
-	require.Equal(t, "workflow/team/coordinator", coordinator.gotSurfaceRootNodeID)
-	require.Equal(t, testMemberNameOne, member.gotTraceNodeID)
-	require.Equal(t, "workflow/team/member_one", member.gotSurfaceRootNodeID)
+	require.Equal(t, "helper", helper.gotTraceNodeID)
+	require.Equal(t, "workflow/team/member_one", member.gotTraceNodeID)
 }
 
 func TestTeam_RunCoordinator_ClearsMountedRootsOnCoordinatorError(t *testing.T) {
@@ -908,6 +954,7 @@ func TestTeam_RunCoordinator_ClearsMountedRootsOnCoordinatorError(t *testing.T)
 	) (<-chan *event.Event, error) {
 		require.Equal(t, "workflow/team/coordinator", agent.InvocationSurfaceRootNodeID(inv))
 		require.Equal(t, "workflow/team", teamtrace.MemberTraceRootForInvocation(inv))
+		require.Equal(t, "workflow/team", teamtrace.MemberSurfaceRootForInvocation(inv))
 		return nil, errors.New("coordinator failed")
 	}
 	tm, err := New(coordinator, []agent.Agent{testAgent{name: testMemberNameOne}})
@@ -923,6 +970,7 @@ func TestTeam_RunCoordinator_ClearsMountedRootsOnCoordinatorError(t *testing.T)
 	require.EqualError(t, err, "coordinator failed")
 	require.Equal(t, "workflow/team", agent.InvocationSurfaceRootNodeID(inv))
 	require.Empty(t, teamtrace.MemberTraceRootForInvocation(inv))
+	require.Empty(t, teamtrace.MemberSurfaceRootForInvocation(inv))
 }
 
 func TestWrapCoordinatorInvocationState_Guards(t *testing.T) {
@@ -932,6 +980,72 @@ func TestWrapCoordinatorInvocationState_Guards(t *testing.T) {
 	require.Nil(t, wrapCoordinatorInvocationState(agent.NewInvocation(), nil))
 }
 
+func TestMountedMemberTool_MemberMountGuards(t *testing.T) {
+	member := testAgent{name: testMemberNameOne}
+	wrapped := &mountedMemberTool{
+		memberIndex: 0,
+		members:     []agent.Agent{member},
+	}
+	ctx := wrapped.mountContext(nil)
+	require.NotNil(t, ctx)
+	_, ok := teamtrace.MemberMountFromContext(ctx)
+	require.False(t, ok)
+	parent := agent.NewInvocation()
+	ctx = agent.NewInvocationContext(context.Background(), parent)
+	_, ok = wrapped.memberMount(ctx)
+	require.False(t, ok)
+	teamtrace.SetMemberTraceRootForInv
```

---

### Incident Patch 9: `0292ce84` (2026-08-28)
**Commit Message**: {runner, docs}: add runner execution trace default (#2553)

## Summary

- add a Runner-local `WithExecutionTraceEnabled` default;
- preserve per-run `agent.WithExecutionTraceEnabled` overrides;
- cover direct Runner and AgentFactory construction paths;
- document the explicit opt-in behavior in English and Chinese.

This change is intentionally separate from the process-wide global
AfterRun Hook API.

## Tests

- `go test ./runner -run
'TestRunnerExecutionTraceDefault(AndPerRunOverride|AppliesToAgentFactory)$'`
- `go test -race ./runner -run
'TestRunnerExecutionTraceDefault(AndPerRunOverride|AppliesToAgentFactory)$'`

**File**: `docs/mkdocs/en/runner.md` (modified, +25/-0)
```diff
@@ -2027,6 +2027,31 @@ if err != nil {
 
 The default path is `/trpc-agent/v1/apps/{appName}`. `Describe` requests the remote structure, and `Run` requests the remote runs endpoint and restores the response into the framework-standard `event.Event` stream. For complete code, see `examples/trpcagent`.
 
+## Execution Trace Default (opt-in)
+
+Execution trace recording is disabled by default. A service that wants every
+run on a specific Runner to produce an execution trace can enable it once when
+constructing that Runner:
+
+```go
+r := runner.NewRunner("my-app", myAgent,
+    runner.WithExecutionTraceEnabled(true),
+)
+```
+
+This is a Runner-local default; it does not affect other Runners or telemetry
+integrations in the process. A single run can override the default:
+
+```go
+eventChan, err := r.Run(
+    ctx,
+    userID,
+    sessionID,
+    message,
+    agent.WithExecutionTraceEnabled(false),
+)
+```
+
 ## 📝 Summary
 
 The Runner component is a core part of the tRPC-Agent-Go framework, providing complete conversation management and Agent orchestration capabilities. By properly using session management, tool integration, and event handling, you can build powerful intelligent conversational applications.
```

**File**: `docs/mkdocs/zh/runner.md` (modified, +24/-0)
```diff
@@ -1947,6 +1947,30 @@ if err != nil {
 
 默认路径为 `/trpc-agent/v1/apps/{appName}`。`Describe` 请求远端 structure，`Run` 请求远端 runs 接口并恢复为框架标准 `event.Event` 流。更多完整代码可参考 `examples/trpcagent`。
 
+## ExecutionTrace 默认策略（显式开启）
+
+ExecutionTrace 默认关闭。如果一个服务希望某个 Runner 的每次运行都生成
+ExecutionTrace，可以在构造该 Runner 时统一开启：
+
+```go
+r := runner.NewRunner("my-app", myAgent,
+    runner.WithExecutionTraceEnabled(true),
+)
+```
+
+这是 Runner 局部默认值，不会影响进程中的其他 Runner 或 telemetry 集成。单次
+运行仍可覆盖该默认值：
+
+```go
+eventChan, err := r.Run(
+    ctx,
+    userID,
+    sessionID,
+    message,
+    agent.WithExecutionTraceEnabled(false),
+)
+```
+
 ## 📝 总结
 
 Runner 组件是 tRPC-Agent-Go 框架的核心，提供了完整的对话管理和 Agent 编排能力。通过合理使用会话管理、工具集成和事件处理，可以构建强大的智能对话应用。
```

**File**: `runner/runner.go` (modified, +17/-1)
```diff
@@ -188,6 +188,15 @@ func WithAwaitUserReplyRouting(enabled bool) Option {
 	}
 }
 
+// WithExecutionTraceEnabled sets whether execution tracing is enabled by
+// default for every run on the Runner. The default is false. A single run can
+// override this default with agent.WithExecutionTraceEnabled.
+func WithExecutionTraceEnabled(enabled bool) Option {
+	return func(opts *Options) {
+		opts.executionTraceEnabledDefault = enabled
+	}
+}
+
 // WithPersistInterruptedAssistant sets the runner default for whether a
 // cancelled streaming run persists already-emitted assistant text as a final
 // assistant message.
@@ -332,6 +341,7 @@ type runner struct {
 	candidateSelector                  CandidateSelector
 	candidateSelectOptions             candidateSelectOptions
 	awaitUserReplyRouting              bool
+	executionTraceEnabledDefault       bool
 	persistInterruptedAssistantDefault bool
 
 	// Resource management fields.
@@ -364,6 +374,7 @@ type Options struct {
 	candidateSelector                  CandidateSelector
 	candidateSelectOptions             candidateSelectOptions
 	awaitUserReplyRouting              bool
+	executionTraceEnabledDefault       bool
 	persistInterruptedAssistantDefault bool
 }
 
@@ -421,6 +432,7 @@ func NewRunner(appName string, ag agent.Agent, opts ...Option) Runner {
 		candidateSelector:                  options.candidateSelector,
 		candidateSelectOptions:             options.candidateSelectOptions,
 		awaitUserReplyRouting:              options.awaitUserReplyRouting,
+		executionTraceEnabledDefault:       options.executionTraceEnabledDefault,
 		persistInterruptedAssistantDefault: options.persistInterruptedAssistantDefault,
 		ownedSessionService:                ownedSessionService,
 	}
@@ -477,6 +489,7 @@ func NewRunnerWithAgentFactory(
 		candidateSelector:                  options.candidateSelector,
 		candidateSelectOptions:             options.candidateSelectOptions,
 		awaitUserReplyRouting:              options.awaitUserReplyRouting,
+		executionTraceEnabledDefault:       options.executionTraceEnabledDefault,
 		persistInterruptedAssistantDefault: options.persistInterruptedAssistantDefault,
 		ownedSessionService:                ownedSessionService,
 	}
@@ -544,7 +557,10 @@ func (r *runner) Run(
 		message.Role = model.RoleUser
 	}
 
-	ro := agent.RunOptions{RequestID: uuid.NewString()}
+	ro := agent.RunOptions{
+		RequestID:             uuid.NewString(),
+		ExecutionTraceEnabled: r.executionTraceEnabledDefault,
+	}
 	for _, opt := range runOpts {
 		opt(&ro)
 	}
```

**File**: `runner/runner_test.go` (modified, +109/-1)
```diff
@@ -58,6 +58,19 @@ type mockAgent struct {
 	name string
 }
 
+type executionTraceCapturingAgent struct {
+	*mockAgent
+	executionTraceEnabled bool
+}
+
+func (a *executionTraceCapturingAgent) Run(
+	ctx context.Context,
+	invocation *agent.Invocation,
+) (<-chan *event.Event, error) {
+	a.executionTraceEnabled = invocation.RunOptions.ExecutionTraceEnabled
+	return a.mockAgent.Run(ctx, invocation)
+}
+
 type repositoryOnlyAgent struct {
 	*mockAgent
 }
@@ -85,6 +98,93 @@ func TestRunnerRejectsSkillLoadsForUnsupportedAgent(t *testing.T) {
 	require.True(t, errors.Is(err, agent.ErrSkillLoadingUnsupported))
 }
 
+func TestRunnerExecutionTraceDefaultAndPerRunOverride(t *testing.T) {
+	tests := []struct {
+		name          string
+		runnerOptions []Option
+		runOptions    []agent.RunOption
+		wantEnabled   bool
+	}{
+		{
+			name:        "default disabled",
+			wantEnabled: false,
+		},
+		{
+			name:          "runner default enabled",
+			runnerOptions: []Option{WithExecutionTraceEnabled(true)},
+			wantEnabled:   true,
+		},
+		{
+			name:          "single run disables runner default",
+			runnerOptions: []Option{WithExecutionTraceEnabled(true)},
+			runOptions:    []agent.RunOption{agent.WithExecutionTraceEnabled(false)},
+			wantEnabled:   false,
+		},
+		{
+			name:          "single run enables disabled runner",
+			runnerOptions: []Option{WithExecutionTraceEnabled(false)},
+			runOptions:    []agent.RunOption{agent.WithExecutionTraceEnabled(true)},
+			wantEnabled:   true,
+		},
+	}
+	for _, test := range tests {
+		t.Run(test.name, func(t *testing.T) {
+			ag := &executionTraceCapturingAgent{
+				mockAgent: &mockAgent{name: "trace-capture"},
+			}
+			r := NewRunner("app", ag, test.runnerOptions...)
+			t.Cleanup(func() { require.NoError(t, r.Close()) })
+
+			events, err := r.Run(
+				context.Background(),
+				"user",
+				"session",
+				model.NewUserMessage("hello"),
+				test.runOptions...,
+			)
+			require.NoError(t, err)
+			var completion *event.Event
+			for evt := range events {
+				if evt != nil && evt.IsRunnerCompletion() {
+					completion = evt
+				}
+			}
+			assert.Equal(t, test.wantEnabled, ag.executionTraceEnabled)
+			require.NotNil(t, completion)
+			if test.wantEnabled {
+				assert.NotNil(t, completion.ExecutionTrace)
+			} else {
+				assert.Nil(t, completion.ExecutionTrace)
+			}
+		})
+	}
+}
+
+func TestRunnerExecutionTraceDefaultAppliesToAgentFactory(t *testing.T) {
+	var got agent.RunOptions
+	r := NewRunnerWithAgentFactory(
+		"app",
+		"factory-agent",
+		func(_ context.Context, runOptions agent.RunOptions) (agent.Agent, error) {
+			got = runOptions
+			return &mockAgent{name: "factory-agent"}, nil
+		},
+		WithExecutionTraceEnabled(true),
+	)
+	t.Cleanup(func() { require.NoError(t, r.Close()) })
+
+	events, err := r.Run(
+		context.Background(),
+		"user",
+		"session",
+		model.NewUserMessage("hello"),
+	)
+	require.NoError(t, err)
+	for range events {
+	}
+	assert.True(t, got.ExecutionTraceEnabled)
+}
+
 func TestRunnerRejectsRepositoryProviderWithoutSkillLoadSupport(t *testing.T) {
 	ag := &repositoryOnlyAgent{mockAgent: &mockAgent{name: "repository-only"}}
 	r := NewRunner("app", ag)
@@ -9688,7 +9788,15 @@ func TestProcessAgentEvents_EmitEventErrorBranch_Direct(t *testing.T) {
 
 	agentCh := make(chan *event.Event)
 	flushCh := make(chan *flush.FlushRequest)
-	processed := rr.processAgentEvents(ctx, sess, inv, agentCh, flushCh, nil, nil)
+	processed := rr.processAgentEvents(
+		ctx,
+		sess,
+		inv,
+		agentCh,
+		flushCh,
+		nil,
+		nil,
+	)
 	// Send one event, then close agentCh
 	go func() {
 		agentCh <- &event.Event{Response: &model.Response{Done: true, Choices: []model.Choice{{Index: 0, Message: model.NewAssistantMessage("x")}}}}
```

---

### Incident Patch 10: `868bb400` (2026-08-28)
**Commit Message**: {server/agui, docs}: add best-effort history snapshots (#2548)

Persisted AG-UI history can contain missing, out-of-order, or duplicate
events after connection interruptions, frontend tool-call fallback,
storage write failures, or version switches, which currently makes
message snapshot replay stop at the first malformed event and return
RUN_ERROR. This adds an opt-in best-effort messages snapshot mode that
logs malformed events, skips them during reduction, and continues
restoring later messages while preserving strict mode by default, with
bilingual documentation for the new option.

**File**: `docs/mkdocs/en/agui/history.md` (modified, +24/-0)
```diff
@@ -277,3 +277,27 @@ server, err := agui.New(
 ```
 
 For the complete example, see [examples/agui/server/follow](https://github.com/trpc-group/trpc-agent-go/tree/main/examples/agui/server/follow). For the frontend, see [examples/agui/client/tdesign-chat](https://github.com/trpc-group/trpc-agent-go/tree/main/examples/agui/client/tdesign-chat).
+
+## Best-Effort History Loading
+
+By default, messages snapshots strictly validate pairing relationships between persisted AG-UI events. For example, `TEXT_MESSAGE_CONTENT` must be preceded by `TEXT_MESSAGE_START` for the same message, and `TOOL_CALL_RESULT` must match a tool call whose argument stream has completed. If historical data contains missing, out-of-order, or duplicate events, the snapshot route tries to return the `MESSAGES_SNAPSHOT` restored before the failure point, and then returns `RUN_ERROR`.
+
+If production history data may contain a small number of incomplete events because of connection interruptions, frontend tool-call fallback, storage write failures, or version switches, enable best-effort loading:
+
+```go
+import (
+	"trpc.group/trpc-go/trpc-agent-go/server/agui"
+)
+
+server, err := agui.New(
+    runner,
+    agui.WithAppName(appName),
+    agui.WithSessionService(sessionService),
+    agui.WithMessagesSnapshotEnabled(true),
+    agui.WithMessagesSnapshotBestEffortEnabled(true),
+)
+```
+
+After this is enabled, messages snapshots skip individual AG-UI events that cannot be decoded or paired while restoring history, and continue processing subsequent events. Skipped events are only written to warn logs and do not make the current `/history` request return `RUN_ERROR`. If later events can still form complete messages, they continue to appear in `MESSAGES_SNAPSHOT.messages`. This mode only affects history snapshot restoration. It does not change the real-time conversation route execution behavior, and it cannot restore historical event content that has already been lost.
+
+Best-effort loading only handles cases where event content can be read but cannot be restored as a valid message. If session storage reads fail, `SessionService` returns an error, or the messages snapshot route cannot locate the session, the server still returns `RUN_ERROR`.
```

**File**: `docs/mkdocs/zh/agui/history.md` (modified, +24/-0)
```diff
@@ -277,3 +277,27 @@ server, err := agui.New(
 ```
 
 完整示例可参考 [examples/agui/server/follow](https://github.com/trpc-group/trpc-agent-go/tree/main/examples/agui/server/follow)，前端可参考 [examples/agui/client/tdesign-chat](https://github.com/trpc-group/trpc-agent-go/tree/main/examples/agui/client/tdesign-chat)。
+
+## 尽力加载历史
+
+默认情况下，消息快照会严格校验已持久化 AG-UI 事件之间的配对关系。比如 `TEXT_MESSAGE_CONTENT` 需要先看到同一条消息的 `TEXT_MESSAGE_START`，`TOOL_CALL_RESULT` 需要匹配已经完成参数流的工具调用。如果历史数据中存在缺失、乱序或重复事件，快照路由会尽量返回出错位置之前已经还原出的 `MESSAGES_SNAPSHOT`，随后返回 `RUN_ERROR`。
+
+如果线上历史数据可能因为连接中断、前端工具调用降级、存储写入失败或版本切换而出现少量不完整事件，可以开启尽力加载模式：
+
+```go
+import (
+	"trpc.group/trpc-go/trpc-agent-go/server/agui"
+)
+
+server, err := agui.New(
+    runner,
+    agui.WithAppName(appName),
+    agui.WithSessionService(sessionService),
+    agui.WithMessagesSnapshotEnabled(true),
+    agui.WithMessagesSnapshotBestEffortEnabled(true),
+)
+```
+
+开启后，消息快照在还原历史时会跳过无法识别或无法配对的单条 AG-UI event，并继续处理后续事件。被跳过的事件只会写入 warn 日志，不会让本次 `/history` 请求返回 `RUN_ERROR`；如果后续事件仍然能组成完整消息，它们会继续出现在 `MESSAGES_SNAPSHOT.messages` 中。该模式只影响历史快照还原，不改变实时对话路由的执行行为，也不会修复已经缺失的历史事件内容。
+
+尽力加载只处理事件内容可读取但无法还原为合法消息的情况。如果会话存储读取失败、`SessionService` 返回错误，或者消息快照路由无法定位会话，服务端仍会返回 `RUN_ERROR`。
```

**File**: `server/agui/internal/reduce/options.go` (modified, +9/-0)
```diff
@@ -14,6 +14,7 @@ type Option func(*options)
 
 type options struct {
 	includeRunLifecycleEvents bool
+	bestEffort                bool
 }
 
 // WithRunLifecycleEvents controls whether RUN_* lifecycle events are included in the
@@ -23,3 +24,11 @@ func WithRunLifecycleEvents(include bool) Option {
 		o.includeRunLifecycleEvents = include
 	}
 }
+
+// WithBestEffort controls whether malformed track events are skipped while
+// reducing a message snapshot.
+func WithBestEffort(enabled bool) Option {
+	return func(o *options) {
+		o.bestEffort = enabled
+	}
+}
```

**File**: `server/agui/internal/reduce/reduce.go` (modified, +6/-0)
```diff
@@ -17,6 +17,7 @@ import (
 
 	aguievents "github.com/ag-ui-protocol/ag-ui/sdks/community/go/pkg/core/events"
 	"github.com/ag-ui-protocol/ag-ui/sdks/community/go/pkg/core/types"
+	"trpc.group/trpc-go/trpc-agent-go/log"
 	"trpc.group/trpc-go/trpc-agent-go/model"
 	"trpc.group/trpc-go/trpc-agent-go/server/agui/internal/multimodal"
 	"trpc.group/trpc-go/trpc-agent-go/session"
@@ -99,6 +100,11 @@ func Reduce(appName, userID string, events []session.TrackEvent, opt ...Option)
 	for _, trackEvent := range events {
 		if err = r.reduce(trackEvent); err != nil {
 			err = fmt.Errorf("reduce: %w", err)
+			if opts.bestEffort {
+				log.Warnf("agui reduce: skip malformed track event: err=%v", err)
+				err = nil
+				continue
+			}
 			break
 		}
 	}
```

**File**: `server/agui/internal/reduce/reduce_test.go` (modified, +47/-0)
```diff
@@ -275,6 +275,53 @@ func TestReduceReturnsMessagesOnReduceError(t *testing.T) {
 	assert.Equal(t, "hello", content)
 }
 
+func TestReduceBestEffortSkipsMalformedEvents(t *testing.T) {
+	t.Run("text event without start", func(t *testing.T) {
+		events := trackEventsFrom(
+			aguievents.NewTextMessageStartEvent("user-1", aguievents.WithRole("user")),
+			aguievents.NewTextMessageContentEvent("user-1", "hello"),
+			aguievents.NewTextMessageEndEvent("user-1"),
+			aguievents.NewTextMessageContentEvent("user-1", "!"),
+			aguievents.NewTextMessageStartEvent("assistant-1", aguievents.WithRole("assistant")),
+			aguievents.NewTextMessageContentEvent("assistant-1", "after"),
+			aguievents.NewTextMessageEndEvent("assistant-1"),
+		)
+
+		msgs, err := Reduce(testAppName, testUserID, events, WithBestEffort(true))
+
+		require.NoError(t, err)
+		require.Len(t, msgs, 2)
+		content, ok := msgs[0].ContentString()
+		require.True(t, ok)
+		assert.Equal(t, "hello", content)
+		content, ok = msgs[1].ContentString()
+		require.True(t, ok)
+		assert.Equal(t, "after", content)
+	})
+
+	t.Run("tool result without completed call", func(t *testing.T) {
+		events := trackEventsFrom(
+			aguievents.NewTextMessageStartEvent("user-1", aguievents.WithRole("user")),
+			aguievents.NewTextMessageContentEvent("user-1", "hello"),
+			aguievents.NewTextMessageEndEvent("user-1"),
+			aguievents.NewToolCallResultEvent("tool-msg-1", "missing-call", "orphan"),
+			aguievents.NewTextMessageStartEvent("assistant-1", aguievents.WithRole("assistant")),
+			aguievents.NewTextMessageContentEvent("assistant-1", "after"),
+			aguievents.NewTextMessageEndEvent("assistant-1"),
+		)
+
+		msgs, err := Reduce(testAppName, testUserID, events, WithBestEffort(true))
+
+		require.NoError(t, err)
+		require.Len(t, msgs, 2)
+		assert.Equal(t, types.RoleUser, msgs[0].Role)
+		assert.Equal(t, types.RoleAssistant, msgs[1].Role)
+		content, ok := msgs[1].ContentString()
+		require.True(t, ok)
+		assert.Equal(t, "after", content)
+	})
+}
+
 func TestReduceAllowsUnclosedTextMessage(t *testing.T) {
 	events := trackEventsFrom(
 		aguievents.NewTextMessageStartEvent("user-1", aguievents.WithRole("user")),
```

**File**: `server/agui/options.go` (modified, +8/-0)
```diff
@@ -304,6 +304,14 @@ func WithMessagesSnapshotRunLifecycleEventsEnabled(enabled bool) Option {
 	}
 }
 
+// WithMessagesSnapshotBestEffortEnabled controls whether malformed history
+// track events are skipped while building MESSAGES_SNAPSHOT.
+func WithMessagesSnapshotBestEffortEnabled(enabled bool) Option {
+	return func(o *options) {
+		o.aguiRunnerOptions = append(o.aguiRunnerOptions, aguirunner.WithMessagesSnapshotBestEffortEnabled(enabled))
+	}
+}
+
 // WithAppName sets the app name.
 func WithAppName(n string) Option {
 	return func(o *options) {
```

**File**: `server/agui/options_test.go` (modified, +6/-0)
```diff
@@ -207,6 +207,12 @@ func TestWithMessagesSnapshotRunLifecycleEventsEnabled(t *testing.T) {
 	assert.True(t, ro.MessagesSnapshotRunLifecycleEventsEnabled)
 }
 
+func TestWithMessagesSnapshotBestEffortEnabled(t *testing.T) {
+	opts := newOptions(WithMessagesSnapshotBestEffortEnabled(true))
+	ro := aguirunner.NewOptions(opts.aguiRunnerOptions...)
+	assert.True(t, ro.MessagesSnapshotBestEffortEnabled)
+}
+
 func TestWithCancelEnabled(t *testing.T) {
 	opts := newOptions(WithCancelEnabled(true))
 	assert.True(t, opts.cancelEnabled)
```

**File**: `server/agui/runner/messagessnapshot.go` (modified, +1/-0)
```diff
@@ -151,6 +151,7 @@ func (r *runner) getMessagesSnapshotEvent(ctx context.Context,
 		sessionKey.UserID,
 		eventsForReduce,
 		reduce.WithRunLifecycleEvents(r.messagesSnapshotRunLifecycleEventsEnabled),
+		reduce.WithBestEffort(r.messagesSnapshotBestEffortEnabled),
 	)
 	if err != nil {
 		err = fmt.Errorf("reduce track events: %w", err)
```

---

### Incident Patch 11: `eafe9949` (2026-08-27)
**Commit Message**: memory/redis: enforce memory limit atomically (#2535)

## What changed

`AddMemory` now enforces the per-user memory limit atomically during
concurrent writes.

Concurrent additions of different memory IDs cannot exceed the
configured limit. Overwriting an existing memory ID remains idempotent
and does not require additional capacity. The unlimited-memory path
remains unchanged.

## Why

The previous implementation performed `HLEN` and `HSET` as separate
Redis commands. Concurrent callers could observe the same available
capacity, pass the limit check, and then write different entries,
causing the final memory count to exceed the configured limit.

The capacity check and write are now performed in a single Lua script
using `HEXISTS`, `HLEN`, and `HSET`.

## Testing

- `go test ./...`
- `go test -race ./...`
- `go vet ./...`
- Added a concurrent regression test with eight callers and a limit of
one, verifying that only one new memory is stored.
- Verified that an existing memory ID can still be overwritten when the
limit is full.
- Covered script execution errors and unexpected script results.

## Notes for reviewers

- No exported API, Redis key format, or serialized data format ch

**File**: `docs/mkdocs/en/memory/redis.md` (modified, +15/-6)
```diff
@@ -28,12 +28,21 @@ if err != nil {
 
 **Note**: `WithRedisClientURL` takes priority over `WithRedisInstance`
 
-**Redis ACL requirement**: `UpdateMemory` uses a server-side Lua script to
-atomically validate and rotate memory IDs. ACL users must be allowed to run
-`EVALSHA` and `EVAL` (`EVAL` is required when the script is not yet cached), in
-addition to `HGET` and the script's `HEXISTS`, `HSET`, and `HDEL` commands and access to
-the configured memory-key pattern. Do not remove `EVAL` after warm-up because
-the Redis script cache can be cleared by a restart or `SCRIPT FLUSH`.
+**Redis ACL requirement**: The default per-user memory limit is `1000`. When the
+configured limit is positive, `AddMemory` uses a server-side Lua script to
+atomically check the capacity and write the memory. This script calls
+`HEXISTS`, `HLEN`, and `HSET`. `UpdateMemory` always uses a Lua script to
+atomically validate and rotate memory IDs; its update path uses `HGET`, and its
+script calls `HEXISTS`, `HSET`, and `HDEL`.
+
+ACL users must be allowed to run `EVALSHA` and `EVAL` (`EVAL` is required when
+a script is not yet cached), the commands used by both scripts, and access the
+configured memory-key pattern. Do not remove `EVAL` after warm-up because the
+Redis script cache can be cleared by a restart or `SCRIPT FLUSH`. Redis-compatible
+backends must support server-side Lua for these scripted paths.
+
+`WithMemoryLimit(0)` keeps `AddMemory` on the direct `HSET` path without a
+scripting dependency. `UpdateMemory` still uses Lua.
 
 **Key prefix example**:
 
```

**File**: `docs/mkdocs/zh/memory/redis.md` (modified, +13/-5)
```diff
@@ -27,11 +27,19 @@ if err != nil {
 
 **注意**：`WithRedisClientURL` 优先级高于 `WithRedisInstance`
 
-**Redis ACL 要求**：`UpdateMemory` 使用服务端 Lua 脚本，以原子方式校验并
-轮换记忆 ID。除 `HGET`、脚本使用的 `HEXISTS`、`HSET`、`HDEL` 命令和对应记忆 key
-访问权限外，ACL 用户还必须具有 `EVALSHA` 和 `EVAL` 权限；脚本尚未缓存时
-需要 `EVAL`。Redis 重启或执行 `SCRIPT FLUSH` 后脚本缓存可能被清除，因此
-不能只在预热阶段临时授予 `EVAL`。
+**Redis ACL 要求**：默认的每用户记忆上限为 `1000`。配置的上限为正数时，
+`AddMemory` 使用服务端 Lua 脚本，以原子方式检查容量并写入记忆；该脚本使用
+`HEXISTS`、`HLEN` 和 `HSET`。`UpdateMemory` 始终使用 Lua 脚本，以原子方式
+校验并轮换记忆 ID；其更新路径使用 `HGET`，脚本使用 `HEXISTS`、`HSET` 和
+`HDEL`。
+
+ACL 用户必须具有 `EVALSHA` 和 `EVAL` 权限（脚本尚未缓存时需要 `EVAL`）、
+两份脚本所用命令的权限，以及对应记忆 key 的访问权限。Redis 重启或执行
+`SCRIPT FLUSH` 后脚本缓存可能被清除，因此不能只在预热阶段临时授予 `EVAL`。
+在这些脚本路径下使用 Redis 兼容后端时，必须确认后端支持服务端 Lua。
+
+`WithMemoryLimit(0)` 会让 `AddMemory` 保持直接执行 `HSET` 的路径，不依赖
+Lua 脚本；`UpdateMemory` 仍然使用 Lua。
 
 **Key 前缀示例**：
 
```

**File**: `memory/redis/service.go` (modified, +44/-11)
```diff
@@ -31,13 +31,35 @@ const (
 	// defaultConnectionTimeout is the default timeout for Redis connection test.
 	defaultConnectionTimeout = 5 * time.Second
 
+	addMemoryResultSuccess = 0
+
 	updateMemoryResultNotFound = 0
 	updateMemoryResultSuccess  = 1
 	updateMemoryResultConflict = 2
 )
 
 var _ memory.Service = (*Service)(nil)
 
+// luaAddMemory atomically enforces the per-user limit for new memory IDs while
+// allowing an existing ID to be overwritten idempotently. A positive result is
+// the current memory count when the limit has been reached.
+var luaAddMemory = redis.NewScript(`
+local key = KEYS[1]
+local memoryID = ARGV[1]
+local entryJSON = ARGV[2]
+local memoryLimit = tonumber(ARGV[3])
+
+if redis.call('HEXISTS', key, memoryID) == 0 then
+    local count = redis.call('HLEN', key)
+    if count >= memoryLimit then
+        return count
+    end
+end
+
+redis.call('HSET', key, memoryID, entryJSON)
+return 0
+`)
+
 // luaUpdateMemory atomically updates a memory hash field and, when its
 // canonical ID changes, rejects an existing target before rotating the field.
 var luaUpdateMemory = redis.NewScript(`
@@ -156,17 +178,6 @@ func (s *Service) AddMemory(ctx context.Context, userKey memory.UserKey, memoryS
 	}
 	key := s.getUserMemKey(userKey)
 
-	if s.opts.memoryLimit > 0 {
-		count, err := s.redisClient.HLen(ctx, key).Result()
-		if err != nil && err != redis.Nil {
-			return fmt.Errorf("redis memory service check memory count failed: %w", err)
-		}
-		if int(count) >= s.opts.memoryLimit {
-			return fmt.Errorf("memory limit exceeded for user %s, limit: %d, current: %d",
-				userKey.UserID, s.opts.memoryLimit, count)
-		}
-	}
-
 	now := time.Now()
 	mem := &memory.Memory{
 		Memory:      memoryStr,
@@ -187,6 +198,28 @@ func (s *Service) AddMemory(ctx context.Context, userKey memory.UserKey, memoryS
 	if err != nil {
 		return fmt.Errorf("marshal memory entry failed: %w", err)
 	}
+	if s.opts.memoryLimit > 0 {
+		scriptResult, err := luaAddMemory.Run(
+			ctx,
+			s.redisClient,
+			[]string{key},
+			entry.ID,
+			string(bytes),
+			s.opts.memoryLimit,
+		).Int()
+		if err != nil {
+			return fmt.Errorf("store memory entry failed: %w", err)
+		}
+		switch {
+		case scriptResult == addMemoryResultSuccess:
+			return nil
+		case scriptResult > addMemoryResultSuccess:
+			return fmt.Errorf("memory limit exceeded for user %s, limit: %d, current: %d",
+				userKey.UserID, s.opts.memoryLimit, scriptResult)
+		default:
+			return fmt.Errorf("add memory entry returned unexpected result %d", scriptResult)
+		}
+	}
 	if err := s.redisClient.HSet(ctx, key, entry.ID, bytes).Err(); err != nil {
 		return fmt.Errorf("store memory entry failed: %w", err)
 	}
```

**File**: `memory/redis/service_test.go` (modified, +138/-7)
```diff
@@ -32,16 +32,60 @@ import (
 	"trpc.group/trpc-go/trpc-agent-go/tool"
 )
 
+// memoryLimitRaceHook makes legacy top-level HLEN calls observe the same
+// pre-write count. The atomic Lua path does not issue top-level HLEN commands.
+type memoryLimitRaceHook struct {
+	expected int
+	mu       sync.Mutex
+	seen     int
+	ready    chan struct{}
+}
+
 type rotationRaceHook struct {
 	once   sync.Once
 	inject func()
 }
 
-type updateMemoryScriptHook struct {
+type memoryScriptHook struct {
 	result int64
 	err    error
 }
 
+func (h *memoryLimitRaceHook) DialHook(next goredis.DialHook) goredis.DialHook {
+	return func(ctx context.Context, network, addr string) (net.Conn, error) {
+		return next(ctx, network, addr)
+	}
+}
+
+func (h *memoryLimitRaceHook) ProcessHook(next goredis.ProcessHook) goredis.ProcessHook {
+	return func(ctx context.Context, cmd goredis.Cmder) error {
+		err := next(ctx, cmd)
+		if err != nil || cmd.Name() != "hlen" {
+			return err
+		}
+
+		h.mu.Lock()
+		h.seen++
+		if h.seen == h.expected {
+			close(h.ready)
+		}
+		h.mu.Unlock()
+
+		select {
+		case <-h.ready:
+			return nil
+		case <-ctx.Done():
+			return ctx.Err()
+		}
+	}
+}
+
+func (h *memoryLimitRaceHook) ProcessPipelineHook(
+	next goredis.ProcessPipelineHook,
+) goredis.ProcessPipelineHook {
+	return next
+}
+
 func (h *rotationRaceHook) DialHook(next goredis.DialHook) goredis.DialHook {
 	return func(ctx context.Context, network, addr string) (net.Conn, error) {
 		return next(ctx, network, addr)
@@ -73,13 +117,13 @@ func (h *rotationRaceHook) ProcessPipelineHook(next goredis.ProcessPipelineHook)
 	}
 }
 
-func (h *updateMemoryScriptHook) DialHook(next goredis.DialHook) goredis.DialHook {
+func (h *memoryScriptHook) DialHook(next goredis.DialHook) goredis.DialHook {
 	return func(ctx context.Context, network, addr string) (net.Conn, error) {
 		return next(ctx, network, addr)
 	}
 }
 
-func (h *updateMemoryScriptHook) ProcessHook(next goredis.ProcessHook) goredis.ProcessHook {
+func (h *memoryScriptHook) ProcessHook(next goredis.ProcessHook) goredis.ProcessHook {
 	return func(ctx context.Context, cmd goredis.Cmder) error {
 		switch cmd.Name() {
 		case "eval", "evalsha":
@@ -98,7 +142,7 @@ func (h *updateMemoryScriptHook) ProcessHook(next goredis.ProcessHook) goredis.P
 	}
 }
 
-func (h *updateMemoryScriptHook) ProcessPipelineHook(
+func (h *memoryScriptHook) ProcessPipelineHook(
 	next goredis.ProcessPipelineHook,
 ) goredis.ProcessPipelineHook {
 	return next
@@ -630,7 +674,7 @@ func TestService_UpdateMemory_ScriptFailureLeavesResultUntouched(t *testing.T) {
 	require.NoError(t, err)
 	require.Len(t, entries, 1)
 
-	svc.redisClient.AddHook(&updateMemoryScriptHook{
+	svc.redisClient.AddHook(&memoryScriptHook{
 		err: fmt.Errorf("script failed"),
 	})
 	result := &memory.UpdateResult{MemoryID: "unchanged"}
@@ -698,7 +742,7 @@ func TestService_UpdateMemory_UnexpectedScriptResult(t *testing.T) {
 	require.NoError(t, err)
 	require.Len(t, entries, 1)
 
-	svc.redisClient.AddHook(&updateMemoryScriptHook{result: 99})
+	svc.redisClient.AddHook(&memoryScriptHook{result: 99})
 	result := &memory.UpdateResult{MemoryID: "unchanged"}
 	err = svc.UpdateMemory(
 		ctx,
@@ -779,12 +823,99 @@ func TestService_MemoryLimit(t *testing.T) {
 	ctx := context.Background()
 	userKey := memory.UserKey{AppName: "test-app", UserID: "u1"}
 
-	require.NoError(t, svc.AddMemory(ctx, userKey, "first", nil))
+	require.NoError(t, svc.AddMemory(ctx, userKey, "first", []string{"original"}))
+	require.NoError(t, svc.AddMemory(ctx, userKey, "first", []string{"updated"}))
+	entries, err := svc.ReadMemories(ctx, userKey, 10)
+	require.NoError(t, err)
+	require.Len(t, entries, 1)
+	assert.Equal(t, []string{"updated"}, entries[0].Memory.Topics)
+
 	err = svc.AddMemory(ctx, userKey, "second", nil)
 	require.Error(t, err)
 	assert.Contains(t, err.Error(), "memory limit exceeded")
 }
 
+func TestService_MemoryLimitConcurrentAddIsAtomic(t *testing.T) {
+	const concurrentAdds = 8
+
+	url, cleanup := setupTestRedis(t)
+	defer cleanup()
+	svc, err := NewService(WithRedisClientURL(url), WithMemoryLimit(1))
+	require.NoError(t, err)
+	defer func() { require.NoError(t, svc.Close()) }()
+
+	svc.redisClient.AddHook(&memoryLimitRaceHook{
+		expected: concurrentAdds,
+		ready:    make(chan struct{}),
+	})
+
+	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
+	defer cancel()
+	userKey := memory.UserKey{AppName: "test-app", UserID: "concurrent-user"}
+	start := make(chan struct{})
+	errorsCh := make(chan error, concurrentAdds)
+	var waitGroup sync.WaitGroup
+	for i := 0; i < concurrentAdds; i++ {
+		waitGroup.Add(1)
+		go func(index int) {
+			defer waitGroup.Done()
+			<-start
+			errorsCh <- svc.AddMemory(ctx, userKey, fmt.Sprintf("memory-%d", index), nil)
+		}(i)
+	}
+	close(start)
+	waitGroup.Wait()
+	close(errorsCh)
+
+	var successes int
+	for err := range errorsCh {
+		if err == nil {
+			successes++
+			continue
+		}
+		require.ErrorContains(t, err
```

---

### Incident Patch 12: `81b0f615` (2026-08-26)
**Commit Message**: tool: fix misleading mergeArrays doc comment and typo (#2536)

The mergeArrays doc comment claimed the function concatenates array
values into a new array, but the implementation returns only the first
element. Correct the comment to describe the actual behavior and fix the
'Plsease' typo.

<!-- markdownlint-disable MD041 -->

<!--
Write the pull request title and description in English.

The title must identify the primary affected package or repository area.

Preferred form:
  package: lowercase summary

For multiple equally affected packages:
  {package/a, package/b}: lowercase summary

For a coherent cross-cutting change spanning many packages with no
primary
package:
  lsc: lowercase summary
-->

## What changed

Summarize the outcome and its user or developer impact. Do not restate
the
implementation or enumerate changed files.

## Why

Explain the problem and any non-obvious design rationale.

## Testing

List the automated and manual validation that was actually performed. If
a
check is not applicable, explain why.

## Notes for reviewers

Optionally call out risks or design decisions that are not obvious from
the
diff, such as public API, compatibility, concurrency, persis

**File**: `tool/merge.go` (modified, +6/-2)
```diff
@@ -185,14 +185,18 @@ func mergeSlices[T any](ts []T) T {
 	return result.Interface().(T)
 }
 
-// mergeArrays concatenates array values into a new array
+// mergeArrays returns the first array in ts when ts is non-empty, or the zero
+// value of T otherwise. Arrays have a fixed length, so multiple arrays cannot
+// be concatenated into a single array of the same type without changing the
+// result's length; the remaining input arrays are therefore intentionally
+// discarded. Use slices instead when a variable-length result is required.
 func mergeArrays[T any](ts []T) T {
 	if len(ts) == 0 {
 		var zero T
 		return zero
 	}
 	// Note: Arrays are fixed size, so we assume all arrays in ts are of the same type and size.
-	// Plsease use slices if you need dynamic size.
+	// Please use slices if you need dynamic size.
 	return ts[0]
 }
 
```

---

### Incident Patch 13: `4ffda6cf` (2026-08-26)
**Commit Message**: session/mysql: fix async persistence log formatting (#2533)

## Fixes #2531 
## What changed

Summarize the outcome and its user or developer impact. Do not restate
the
implementation or enumerate changed files.

## Why

Explain the problem and any non-obvious design rationale.

## Testing

List the automated and manual validation that was actually performed. If
a
check is not applicable, explain why.

## Notes for reviewers

Optionally call out risks or design decisions that are not obvious from
the
diff, such as public API, compatibility, concurrency, persistence,
protocol, or
security concerns.

**File**: `session/mysql/service.go` (modified, +2/-2)
```diff
@@ -862,7 +862,7 @@ func (s *Service) startAsyncPersistWorker() {
 				if err := s.addEvent(ctx, eventPair.key, eventPair.event); err != nil {
 					log.ErrorfContext(
 						ctx,
-						"async persist event failed: %w",
+						"async persist event failed: %v",
 						err,
 					)
 				}
@@ -894,7 +894,7 @@ func (s *Service) startAsyncPersistWorker() {
 				if err := s.addTrackEvent(ctx, trackEventPair.key, trackEventPair.event); err != nil {
 					log.ErrorfContext(
 						ctx,
-						"async persist event failed: %w",
+						"async persist event failed: %v",
 						err,
 					)
 				}
```

---

### Incident Patch 14: `6d5ac4ba` (2026-08-26)
**Commit Message**: tool: return the first value instead of panicking when merging a nil interface (#2520)

Supersedes #2514 — same branch and same fix. That PR had to be closed
because the branch was force-pushed (to rewrite commit author emails to
GitHub's noreply format), which makes a closed PR non-reopenable. The
original review discussion is preserved there.

Fixes #2513.

## What

- `Merge` returns the first value unchanged when it is a nil interface,
instead of panicking inside `reflect.Value.Type`. This matches the
existing contract that a nil pointer field keeps the first value rather
than adopting a later non-nil one.
- Fixed the same panic through the `mergeStructs` recursion when a
struct's `any` field is nil in the first element.
- Follow-up to @Rememorio's P1 review in #2514:
`mergeInts`/`mergeUints`/`mergeFloats` now skip nil (invalid) interface
elements instead of panicking when a numeric first value is followed by
nil — e.g. `Merge([]any{1, nil})`, including via an `any`-typed struct
field — consistent with how `mergeStrings`/`mergeSlices`/`mergeMaps`
already skip non-matching elements.

## Tests

- `TestMerge_NilInterfaceElement` (table-driven): leading nil, trailing
nil, all nil, i

**File**: `tool/merge.go` (modified, +21/-0)
```diff
@@ -35,6 +35,12 @@ func Merge[T any](ts []T) T {
 	// Handle the first element to determine the type and operation
 	first := ts[0]
 	firstValue := reflect.ValueOf(first)
+	// A nil interface value carries no reflect type to drive merging, so return
+	// it unchanged instead of panicking. This matches how a nil pointer field
+	// keeps the first value rather than adopting a later non-nil one.
+	if !firstValue.IsValid() {
+		return first
+	}
 	firstType := firstValue.Type()
 
 	// Check if type implements Mergeable interface
@@ -95,6 +101,11 @@ func mergeInts[T any](ts []T) T {
 	var sum int64
 	for _, t := range ts {
 		val := reflect.ValueOf(t)
+		// Skip nil interface elements: they carry no numeric value to merge,
+		// and reflecting on them would panic.
+		if !val.IsValid() {
+			continue
+		}
 		sum += val.Int()
 	}
 
@@ -108,6 +119,11 @@ func mergeUints[T any](ts []T) T {
 	var sum uint64
 	for _, t := range ts {
 		val := reflect.ValueOf(t)
+		// Skip nil interface elements: they carry no numeric value to merge,
+		// and reflecting on them would panic.
+		if !val.IsValid() {
+			continue
+		}
 		sum += val.Uint()
 	}
 
@@ -121,6 +137,11 @@ func mergeFloats[T any](ts []T) T {
 	var sum float64
 	for _, t := range ts {
 		val := reflect.ValueOf(t)
+		// Skip nil interface elements: they carry no numeric value to merge,
+		// and reflecting on them would panic.
+		if !val.IsValid() {
+			continue
+		}
 		sum += val.Float()
 	}
 
```

**File**: `tool/merge_test.go` (modified, +104/-0)
```diff
@@ -596,6 +596,110 @@ func TestMerge_NilHandling(t *testing.T) {
 	}
 }
 
+func TestMerge_NilInterfaceElement(t *testing.T) {
+	for _, tt := range []struct {
+		name  string
+		input []any
+		want  any
+	}{
+		{name: "leading nil", input: []any{nil, "str"}, want: nil},
+		{name: "trailing nil", input: []any{"str", nil}, want: "str"},
+		{name: "all nil", input: []any{nil, nil}, want: nil},
+		{name: "int with trailing nil", input: []any{1, nil}, want: 1},
+		{name: "int with middle nil", input: []any{1, nil, 2}, want: 3},
+		{name: "int with leading nil", input: []any{nil, 1}, want: nil},
+		{name: "float with trailing nil", input: []any{1.5, nil}, want: 1.5},
+		{name: "uint with trailing nil", input: []any{uint(7), nil}, want: uint(7)},
+		{name: "slice with trailing nil", input: []any{[]int{1}, nil}, want: []int{1}},
+		{name: "map with trailing nil", input: []any{map[string]int{"a": 1}, nil}, want: map[string]int{"a": 1}},
+	} {
+		t.Run(tt.name, func(t *testing.T) {
+			var got any
+			require.NotPanics(t, func() {
+				got = Merge(tt.input)
+			}, "Merge should not panic on a nil interface element")
+			require.Equal(t, tt.want, got)
+		})
+	}
+}
+
+func TestMerge_Structs_NilInterfaceField(t *testing.T) {
+	type structWithAny struct {
+		Meta  any
+		Score int
+	}
+
+	structs := []structWithAny{
+		{Meta: nil, Score: 10},
+		{Meta: "second", Score: 20},
+	}
+
+	var result structWithAny
+	require.NotPanics(t, func() {
+		result = Merge(structs)
+	}, "Merge should not panic on a nil interface field")
+
+	if result.Score != 30 {
+		t.Errorf("Score: Expected 30, got %d", result.Score)
+	}
+	// Consistent with TestMerge_Structs_PointerField: the first value is kept.
+	if result.Meta != nil {
+		t.Errorf("Interface field: Expected nil (first value retained), got %+v", result.Meta)
+	}
+}
+
+// TestMerge_Structs_NumericThenNilInterfaceField covers the reversed order of
+// TestMerge_Structs_NilInterfaceField: a numeric any field followed by nil must
+// not panic inside numeric reflection and must merge the non-nil values only.
+func TestMerge_Structs_NumericThenNilInterfaceField(t *testing.T) {
+	type structWithAny struct {
+		Meta  any
+		Score int
+	}
+
+	for _, tt := range []struct {
+		name      string
+		structs   []structWithAny
+		wantMeta  any
+		wantScore int
+	}{
+		{
+			name:      "int field then nil field",
+			structs:   []structWithAny{{Meta: 1, Score: 10}, {Meta: nil, Score: 20}},
+			wantMeta:  1,
+			wantScore: 30,
+		},
+		{
+			name:      "float field then nil field",
+			structs:   []structWithAny{{Meta: 1.5, Score: 10}, {Meta: nil, Score: 20}},
+			wantMeta:  1.5,
+			wantScore: 30,
+		},
+		{
+			name:      "uint field then nil field",
+			structs:   []structWithAny{{Meta: uint(7), Score: 10}, {Meta: nil, Score: 20}},
+			wantMeta:  uint(7),
+			wantScore: 30,
+		},
+		{
+			name:      "int field, nil field, int field",
+			structs:   []structWithAny{{Meta: 1, Score: 10}, {Meta: nil, Score: 20}, {Meta: 2, Score: 30}},
+			wantMeta:  3,
+			wantScore: 60,
+		},
+	} {
+		t.Run(tt.name, func(t *testing.T) {
+			var result structWithAny
+			require.NotPanics(t, func() {
+				result = Merge(tt.structs)
+			}, "Merge should not panic when a numeric any field is followed by nil")
+
+			require.Equal(t, tt.wantMeta, result.Meta)
+			require.Equal(t, tt.wantScore, result.Score)
+		})
+	}
+}
+
 // Helper function for floating point comparison
 func abs64(x float64) float64 {
 	if x < 0 {
```

---

### Incident Patch 15: `900ea132` (2026-08-24)
**Commit Message**: tool/duckduckgo: capture loop variable in parallel table test (#2515)

## What changed

`TestDuckDuckGoTool_FilterSearchResponse` declares four table-driven
cases, but only the last one was
actually asserted. All four now assert their own case.

## Why

The root module targets Go 1.21, where a `range` loop reuses a single
iteration variable. The subtests
call `t.Parallel()`, so they suspend until the parent test function
returns — by which point the loop
has finished and `tc` holds the final case. Every subtest then reads
that same value, so the
`no patterns`, `no results` and `no matches` inputs were never verified
and the `empty summary` case was
verified four times.

This is invisible in test output because `t.Run(tc.name, ...)` evaluates
the name eagerly, while `tc`
is only dereferenced inside the parallel closure. All four subtests are
reported by their correct names
and pass.

`go vet ./...` reports it on the root module:

```text
tool/duckduckgo/duckduckgo_test.go:1482:11: loop variable tc captured by func literal
tool/duckduckgo/duckduckgo_test.go:1482:40: loop variable tc captured by func literal
tool/duckduckgo/duckduckgo_test.go:1483:21: loop variable tc captured by func

**File**: `tool/duckduckgo/duckduckgo_test.go` (modified, +1/-0)
```diff
@@ -1476,6 +1476,7 @@ func TestDuckDuckGoTool_FilterSearchResponse(t *testing.T) {
 	}
 
 	for _, tc := range tests {
+		tc := tc
 		t.Run(tc.name, func(t *testing.T) {
 			t.Parallel()
 
```

#### Recent Merged Pull Requests:
- **PR #2634** (2026-09-24): model/openai: make streaming accumulation linear (@mikemikimike)
- **PR #2629** (2026-09-23): {session/summary, internal/flow/llmflow}: honor configured summary token counters (@liuzengh)
- **PR #2626** (2026-09-21): session/summary: support explicit request input token budgets (@liuzengh)
- **PR #2623** (closed): fix(codeexecutor/local): collect workspace files on Windows (@vleij)
- **PR #2622** (2026-09-20): {session/summary, docs}: add context-aware skip recent callback (@Flash-LHR)
- **PR #2621** (2026-09-18): model/openai: prevent panics on negative streaming tool indices (@liuzengh)
- **PR #2620** (2026-09-18): session/mysql: avoid sorting event JSON during summary restore (@liuzengh)
- **PR #2618** (2026-09-18): tool/openapi: preserve options and isolate spec loader state (@gosomea)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
