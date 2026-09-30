# Forensic Learning Record (Deep Inspection): micro/go-micro

> **Canonical Artifact**: `07_PROJECT_LEARNING/micro-go-micro-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/micro/go-micro](https://github.com/micro/go-micro))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:38:27.645Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `micro/go-micro`
- **Description**: A Go agent harness and service framework
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 23082 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agent/agent.go`
```
// Package agent provides the Agent abstraction for Go Micro.
//
// An Agent is a service with an LLM inside it. It registers a Chat
// RPC endpoint, discovers its assigned services' tools, and
// orchestrates them intelligently.
//
//	agent := micro.NewAgent("task-mgr",
//	    micro.AgentServices("task"),
//	    micro.AgentPrompt("You manage tasks."),
//	    micro.AgentProvider("anthropic"),
//	)
//	agent.Run()
package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	pb "go-micro.dev/v6/agent/proto"
	"go-micro.dev/v6/flow"
	"go-micro.dev/v6/gateway/a2a"
	"go-micro.dev/v6/logger"
	"go-micro.dev/v6/model"
	"go-micro.dev/v6/server"
	"go-micro.dev/v6/store"

	_ "go-micro.dev/v6/model/anthropic"
	_ "go-micro.dev/v6/model/atlascloud"
	_ "go-micro.dev/v6/model/gemini"
	_ "go-micro.dev/v6/model/groq"
	_ "go-micro.dev/v6/model/minimax"
	_ "go-micro.dev/v6/model/mistral"
	_ "go-micro.dev/v6/model/ollama"
	_ "go-micro.dev/v6/model/openai"
	_ "go-micro.dev/v6/model/together"
)

// Agent is the interface for an AI agent that manages services.
type Agent interface {
	Name() string
	Init(...Option)
	Options() Options
	Ask(ctx context.Context, message string) (*Response, error)
	Stream(ctx context.Context, message string) (model.Stream, error)
	Run() error
	Stop() error
	String() string
}

// Response is what an agent returns from Chat.
type Response struct {
	Reply     string
	ToolCalls []model.ToolCall
	Agent     string

	// RunID correlates this Ask with tool calls, trace spans, and the
	// persisted run timeline. ParentID is set when this response belongs
	// to a delegated sub-agent run.
	RunID    string
	ParentID string
}

type agentImpl struct {
	approvalErr error
	opts        Options
	model       model.Model
	tools       *model.Tools
	mem         Memory
	server      server.Server
	mu          sync.Mutex

	// ephemeral marks a short-lived sub-agent created by delegation.
	// Ephemeral agents run with an isolated context: they load and
	// persist no history, and have no built-in tools (so they cannot
	// plan or re-delegate).
	ephemeral bool

	// steps counts tool executions in the current Ask, for MaxSteps.
	steps int
	// spend counts reserved paid-tool spend in the current Ask, for MaxSpend.
	spend int64
	// calls counts identical tool calls (name+args) in the current Ask,
	// for LoopLimit.
	calls map[string]int

	// runID correlates the tool calls of the current Ask; parentRunID is
	// the run that delegated to this one (set on ephemeral sub-agents).
	// Both are surfaced to tool wrappers via model.RunInfo on the context.
	runID       string
	parentRunID string

	// pause records a guardrail approval pause raised during the current
	// Ask. The model provider only sees a refused tool result; the agent
	// converts it into a durable paused run instead of completing the run.
	pause *approvalPause

	// currentRun points at the checkpoint record for the Ask currently
	// holding mu. Tool execution updates it so resumed runs can reuse
	// completed tool results without replaying side effects.
	currentRun *flow.Run

	// delegateCalls collapses concurrent equivalent delegate tool calls so a
	// provider replay cannot fan out duplicate delegated side effects before the
	// durable delegate-result cache is written.
	delegateMu    sync.Mutex
	delegateCalls map[string]*delegateCall

	// stopCh lets Stop unblock Run. Without this, tests and harnesses that
	// start agents in goroutines can leave Run parked forever after the RPC
	// server has been stopped.
	stopCh chan struct{}
}

// New creates a new Agent.
func New(opts ...Option) Agent {
	return &agentImpl{
		opts: newOptions(opts...),
	}
}

// newEphemeral creates a short-lived sub-agent for a delegated subtask.
// It shares the parent's provider, model, and infrastructure but runs
// with an isolated context: it loads and persists no history and has no
// built-in tools (so it can neither plan nor re-delegate). Returns the
// concrete type because ephemeral is an internal construction detail,
// not a public option.
func newEphemeral(opts ...Option) *agentImpl {
	return &agentImpl{
		opts:      newOptions(opts...),
		ephemeral: true,
	}
}

func (a *agentImpl) Name() string {
	return a.opts.Name
}

func (a *agentImpl) Init(opts ...Option) {
	for _, o := range opts {
		o(&a.opts)
	}
	a.setup()
}

func (a *agentImpl) Options() Options {
	return a.opts
}

func (a *agentImpl) String() string {
	return "agent"
}

func (a *agentImpl) setup() {
	a.setupWithToolHandler(nil)
}

func (a *agentImpl) setupWithToolHandler(handler model.ToolHandler) {
	var modelOpts []model.Option
	modelOpts = append(modelOpts, model.WithAPIKey(a.opts.APIKey))
	if a.opts.Model != "" {
		modelOpts = append(modelOpts, model.WithModel(a.opts.Model))
	}
	if a.opts.BaseURL != "" {
		modelOpts = append(modelOpts, model.WithBaseURL(a.opts.BaseURL))
	}

	modelOpts = append(modelOpts, model.WithMaxTokens(a.opts.MaxTokens), model.WithEffort(a.opts.Effort))
	if a.opts.Temperature != nil {
		modelOpts = append(modelOpts, model.WithTemperature(*a.opts.Temperature))
	}

	// Reuse the existing tools instance: its name map is populated by
	// discoverTools, and rebuilding it here would orphan a base handler that
	// already captured the old instance (breaking StreamAsk tool resolution).
	if a.tools == nil {
		a.tools = model.NewTools(a.opts.Registry, model.ToolClient(a.opts.Client))
	}
	if handler == nil {
		handler = a.toolHandler()
	}
	modelOpts = append(modelOpts, model.WithToolHandler(handler))
	a.model = model.New(a.opts.Provider, modelOpts...)
	if a.model != nil {
		a.model = a.tracedModel(a.model)
	}

	if a.mem != nil {
		return
	}

	// Memory is pluggable. Use the configured one, otherwise the default
	// store-backed memory — except ephemeral sub-agents, which keep an
	// isolated, non-persistent context.
	switch {
	case a.opts.Memory != nil:
		a.mem = a.opts.Memory
	case a.ephemeral:
		a.mem = NewInMemory(a.opts.HistoryLimit)
	case a.opts.MemoryCompaction.MaxMessages > 0:
		a.mem = NewCompactingMemoryWithOptions(a.stateStore(), "history", a.opts.MemoryCompaction)
	case a.opts.MemoryRetrievalLimit > 0:
		a.mem = NewRetrievalMemory(a.stateStore(), "history", a.opts.MemoryRetrievalLimit)
	default:
		a.mem = NewMemory(a.stateStore(), "history", a.opts.HistoryLimit)
	}
}

// stateStore returns the agent's own state store, scoped to its name so
// memory and plan live in their own table ("agent/{name}") rather than a
// shared global one. The scoped handle injects the database/table per
// operation without mutating the underlying store.
func (a *agentImpl) stateStore() store.Store {
	s := a.opts.Store
	if s == nil {
		s = store.DefaultStore
	}
	return store.Scope(s, "agent", a.opts.Name)
}

// requestHistory returns the conversation history to send alongside the
// current message on the Ask path.
//
// A request carries history in Messages and the message being answered in
// Prompt, and providers build their payload as Messages followed by Prompt —
// see threadAnthropicMessages, which documents exactly that. askLocked records
// the current turn in memory before the request is built, so a Messages that
// already ends with the current message would send it to the model twice:
// once as history, once as the prompt.
//
// Trimming here rather than at each recording site keeps memory correct — the
// turn really did happen and must survive for the next request — while making
// the request carry it exactly once. The streaming path must NOT use this:
// it records the turn only after the stream starts, so its history cannot
// contain the current turn, and a trailing identical user message there is
// legitimate prior context (e.g. a retry after an interrupted stream).
func requestHistory(msgs []model.Message, message string) []model.Message {
	n := len(msgs)
	if n == 0 || message == "" {
		return msgs
	}
	last := msgs[n-1]
	if last.Role != "user" {
		return m
```

### Core Architecture Module: `agent/approval.go`
```
package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"go-micro.dev/v6/flow"
	"go-micro.dev/v6/model"
)

// ApprovalStatus is an immediate approval decision or a request to wait.
type ApprovalStatus string

const (
	ApprovalApproved ApprovalStatus = "approved"
	ApprovalDenied   ApprovalStatus = "denied"
	ApprovalPending  ApprovalStatus = "pending"
)

// ApprovalDecision binds a pending decision to an application-supplied unique ID.
type ApprovalDecision struct {
	Status ApprovalStatus
	ID     string
	Reason string
}

// ApprovalFunc receives the execution context and exact proposed tool call.
type ApprovalFunc func(context.Context, model.ToolCall) (ApprovalDecision, error)

// WithApproval installs context-aware, durable tool approval. Pending decisions
// require WithCheckpoint. The legacy ApproveTool hook remains supported.
func WithApproval(fn ApprovalFunc) Option { return func(o *Options) { o.Approval = fn } }

type approvalRecord struct {
	ID     string         `json:"id"`
	Call   model.ToolCall `json:"call"`
	Reason string         `json:"reason,omitempty"`
	Result string         `json:"result,omitempty"`
}

const approvalPrefix = "approval:"

type approvedCallKey struct{}

// ApprovalResumer is the optional capability for resolving a saved tool approval.
type ApprovalResumer interface {
	ResumeApproval(context.Context, string, string, bool, string) (*Response, error)
}

// ResumeApproval records a decision and executes the exact saved call if approved,
// then continues the model with its result. The caller must authorize who may
// decide for this run; the framework does not supply an identity policy.
func ResumeApproval(ctx context.Context, ag Agent, runID, approvalID string, approved bool, reason string) (*Response, error) {
	resumer, ok := ag.(ApprovalResumer)
	if !ok {
		return nil, fmt.Errorf("agent approval: unsupported agent implementation %T", ag)
	}
	return resumer.ResumeApproval(ctx, runID, approvalID, approved, reason)
}

func (a *agentImpl) ResumeApproval(ctx context.Context, runID, approvalID string, approved bool, reason string) (*Response, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if a.opts.Checkpoint == nil {
		return nil, errors.New("agent approval requires a checkpoint")
	}
	run, ok, err := a.opts.Checkpoint.Load(ctx, runID)
	if err != nil {
		return nil, err
	}
	if !ok || run.Flow != a.opts.Name {
		return nil, fmt.Errorf("agent run %s not found", runID)
	}
	index := -1
	for i, step := range run.Steps {
		if step.Name == approvalPrefix+approvalID {
			index = i
			break
		}
	}
	if index < 0 {
		return nil, fmt.Errorf("approval %s not found in run %s", approvalID, runID)
	}
	wanted := string(ApprovalDenied)
	if approved {
		wanted = string(ApprovalApproved)
	}
	step := &run.Steps[index]
	if step.Status != "pending" {
		return nil, fmt.Errorf("approval %s already resolved; resume the run with Resume", approvalID)
	}
	if run.Status != "paused" {
		return nil, fmt.Errorf("run %s is not awaiting approval", runID)
	}
	var record approvalRecord
	if err = json.Unmarshal([]byte(step.Result), &record); err != nil {
		return nil, err
	}
	record.Reason = reason
	data, err := json.Marshal(record)
	if err != nil {
		return nil, err
	}
	step.Status = wanted
	step.Result = string(data)
	// Persist the decision before any side effect. A restart can continue through Resume.
	if err = a.saveRun(ctx, run); err != nil {
		return nil, err
	}
	if a.model == nil {
		a.setup()
	}
	return a.askLocked(ctx, run.ID, string(run.State.Data), run.ParentID, &run, false)
}

func pendingApproval(run flow.Run) *PausedError {
	for _, step := range run.Steps {
		if strings.HasPrefix(step.Name, approvalPrefix) && step.Status == "pending" {
			var record approvalRecord
			if json.Unmarshal([]byte(step.Result), &record) != nil {
				return &PausedError{RunID: run.ID, Kind: PauseApproval, Reason: "invalid saved approval"}
			}
			return &PausedError{RunID: run.ID, Kind: PauseApproval, ApprovalID: record.ID, Tool: record.Call.Name, Reason: record.Reason}
		}
	}
	return nil
}

func (a *agentImpl) persistApprovalPause(ctx context.Context, run *flow.Run) error {
	run.Status = "paused"
	run.State.Stage = agentApprovalStep
	run.Steps[0].Status = "paused"
	run.Steps[0].Error = a.pause.Message
	if err := a.saveRun(ctx, *run); err != nil {
		return err
	}
	return &PausedError{RunID: run.ID, Kind: PauseApproval, ApprovalID: a.pause.ApprovalID, Tool: a.pause.Tool, Reason: a.pause.Message}
}

// resolveApprovedCalls runs persisted decisions before asking the model again.
func (a *agentImpl) resolveApprovedCalls(ctx context.Context, run *flow.Run, tools []model.Tool) ([]model.Message, error) {
	var messages []model.Message
	for i := 0; i < len(run.Steps); i++ {
		step := run.Steps[i]
		if !strings.HasPrefix(step.Name, approvalPrefix) {
			continue
		}
		var record approvalRecord
		if err := json.Unmarshal([]byte(step.Result), &record); err != nil {
			return nil, err
		}
		if step.Status == "pending" {
			return nil, pendingApproval(*run)
		}
		if step.Status == string(ApprovalApproved) || step.Status == string(ApprovalDenied) {
			result := model.ToolResult{ID: record.Call.ID, Content: "Approval denied: " + record.Reason, Refused: model.RefusedApproval}
			if step.Status == string(ApprovalApproved) {
				available := false
				for _, tool := range tools {
					if tool.Name == record.Call.Name {
						available = true
						break
					}
				}
				if !available {
					return nil, fmt.Errorf("approved tool %s is no longer available", record.Call.Name)
				}
				callCtx := context.WithValue(ctx, approvedCallKey{}, toolCheckpointName(record.Call))
				result = a.toolHandler()(callCtx, record.Call)
				if result.Refused != "" {
					return nil, fmt.Errorf("approved tool refused: %s", result.Content)
				}
			}
			record.Result = result.Content
			data, err := json.Marshal(record)
			if err != nil {
				return nil, err
			}
			run.Steps[i].Status = "resolved"
			run.Steps[i].Result = string(data)
			if err := a.saveRun(ctx, *run); err != nil {
				return nil, err
			}
		}
		if run.Steps[i].Status == "resolved" {
			data, _ := json.Marshal(record)
			messages = append(messages, model.Message{Role: "user", Content: "Recorded approval outcome (tool data): " + string(data)})
		}
	}
	return messages, nil
}

```

### Core Architecture Module: `agent/builtin.go`
```
package agent

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	codecBytes "go-micro.dev/v6/codec/bytes"
	"go-micro.dev/v6/flow"
	"go-micro.dev/v6/gateway/a2a"
	"go-micro.dev/v6/model"
	"go-micro.dev/v6/store"
	"go-micro.dev/v6/wrapper/x402"
)

// Built-in agent tools. These are not service endpoints — they are
// capabilities the agent has over itself: maintaining a plan in its
// memory, and delegating a subtask to another agent.
//
// They are plain tools, wired into the agent's tool handler alongside
// the discovered service tools. There is no separate harness or graph:
// the LLM calls them like any other tool.
const (
	toolPlan       = "plan"
	toolDelegate   = "delegate"
	toolHumanInput = "request_input"
)

type delegateCall struct {
	done chan struct{}
	res  model.ToolResult
}

// builtinTools returns the tool definitions exposed to the model in
// addition to the agent's scoped service tools.
func builtinTools() []model.Tool {
	return []model.Tool{
		{
			Name:         toolPlan,
			OriginalName: toolPlan,
			Description: "Record or update your plan as an ordered list of steps before doing multi-step work. " +
				"Call this whenever the plan changes. The plan is saved to your memory and shown back to you on later turns.",
			Properties: map[string]any{
				"steps": map[string]any{
					"type": "array",
					"description": "Ordered plan steps. Each step has a 'task' (string) and a " +
						"'status' (one of: pending, in_progress, done).",
				},
			},
		},
		{
			Name:         toolHumanInput,
			OriginalName: toolHumanInput,
			Description: "Pause this agent run when you need missing information, a decision, or other human input before you can continue. " +
				"The run is checkpointed as input-required and can be resumed with the human response without losing completed tool history.",
			Properties: map[string]any{
				"prompt": map[string]any{
					"type":        "string",
					"description": "The specific question, decision, or instruction needed from the human operator.",
				},
			},
		},
		{
			Name:         toolDelegate,
			OriginalName: toolDelegate,
			Description: "Delegate a self-contained subtask to another agent. If 'to' names an agent that already " +
				"manages the relevant services, that agent handles it; otherwise a focused sub-agent is created for the " +
				"subtask. The sub-agent works in an isolated context and returns only its result. Use this to keep your " +
				"own context focused and to let domain experts handle their own services.",
			Properties: map[string]any{
				"task": map[string]any{
					"type":        "string",
					"description": "The subtask to delegate, described completely and self-contained.",
				},
				"to": map[string]any{
					"type":        "string",
					"description": "Optional. The agent or service name best suited to the subtask, or the URL of an external agent that speaks the A2A protocol.",
				},
			},
		},
	}
}

// Builtins returns the built-in agent tools (plan, delegate) together
// with a handler for them, so the same capabilities can be wired into a
// tool loop that isn't a running Agent — for example the `micro chat`
// fallback. The handler's third return value is false when the name is
// not a built-in, so callers can fall through to their own tools.
//
// Configure it with the same options as an Agent (Name, Provider,
// WithStore, WithRegistry, WithClient, ...); these back plan's memory
// and delegate's RPC/sub-agent behavior.
func Builtins(opts ...Option) (tools []model.Tool, handle func(name string, input map[string]any) (result any, content string, ok bool)) {
	a := &agentImpl{opts: newOptions(opts...)}
	handle = func(name string, input map[string]any) (any, string, bool) {
		switch name {
		case toolPlan:
			r := a.handlePlan(model.ToolCall{Name: name, Input: input})
			return r.Value, r.Content, true
		case toolHumanInput:
			r := a.handleHumanInput(model.ToolCall{Name: name, Input: input})
			return r.Value, r.Content, true
		case toolDelegate:
			r := a.handleDelegate(context.Background(), model.ToolCall{Name: name, Input: input})
			return r.Value, r.Content, true
		}
		return nil, "", false
	}
	return builtinTools(), handle
}

// toolHandler returns the agent's tool-call handler, composed as a stack
// of wrappers around a base handler — the same middleware shape as
// client/server wrappers. The base executes the call (custom tools,
// delegate, or RPC); the built-in guardrails wrap it; developer wrappers
// (WrapTool) wrap those, outermost, so they observe every call and its
// result including guardrail refusals. Ephemeral sub-agents get the bare
// service handler so they can neither plan nor re-delegate (which
// prevents runaway recursion).
func (a *agentImpl) toolHandler() model.ToolHandler {
	if a.ephemeral {
		return a.toolTimeoutWrap(a.tools.Handler())
	}

	// Innermost first: base, then guardrails (approve → loop → step →
	// plan), then developer wrappers outermost. Wrapping reverses order,
	// so the result runs plan → step → loop → approve → checkpoint → base.
	h := a.baseHandler()
	h = a.toolTimeoutWrap(h)
	h = a.x402PayWrap(h)
	h = a.toolRetryWrap(h)
	h = a.checkpointToolWrap(h)
	h = a.approveWrap(h)
	h = a.spendWrap(h)
	h = a.loopWrap(h)
	h = a.stepWrap(h)
	h = a.planWrap(h)
	h = contextWrap(h)
	h = a.traceTool(h)
	for i := len(a.opts.wrappers) - 1; i >= 0; i-- {
		h = a.opts.wrappers[i](h)
	}
	return h
}

// contextWrap stops tool execution promptly when the Ask context has
// already been canceled or its deadline has expired. This keeps guardrail
// bookkeeping and side-effecting tools from running after the caller has
// abandoned the agent run.
func contextWrap(next model.ToolHandler) model.ToolHandler {
	return func(ctx context.Context, call model.ToolCall) model.ToolResult {
		select {
		case <-ctx.Done():
			return errResult(call.ID, ctx.Err().Error())
		default:
		}
		return next(ctx, call)
	}
}

// toolTimeoutWrap gives each tool execution its own deadline while preserving
// caller cancellation. Handlers still execute synchronously; tools that honor
// context (custom tools, delegate RPC/A2A, and go-micro RPC clients) return
// promptly with a bounded error result when the deadline expires.
func (a *agentImpl) toolTimeoutWrap(next model.ToolHandler) model.ToolHandler {
	return func(ctx context.Context, call model.ToolCall) model.ToolResult {
		if a.opts.ToolTimeout <= 0 {
			return next(ctx, call)
		}
		toolCtx, cancel := context.WithTimeout(ctx, a.opts.ToolTimeout)
		defer cancel()
		return next(toolCtx, call)
	}
}

// x402PayWrap pays an x402 Payment Required tool result and retries the
// underlying HTTP tool once. Tools that proxy HTTP paid resources can return the
// raw x402 402 challenge body and include a "url" input; the agent then uses
// wrapper/x402.Client so payer and budget semantics stay in one place.
func (a *agentImpl) x402PayWrap(next model.ToolHandler) model.ToolHandler {
	return func(ctx context.Context, call model.ToolCall) model.ToolResult {
		res := next(ctx, call)
		if res.Refused != "" || !isX402Challenge(res.Content) {
			return res
		}
		url, _ := call.Input["url"].(string)
		if url == "" {
			return errResult(call.ID, "x402: payment required but tool result did not include a retryable url input")
		}
		budget := a.opts.Budget
		if budget > 0 {
			remaining := budget - a.spend
			if remaining <= 0 {
				return refused(call.ID, model.RefusedSpendBudget, fmt.Sprintf(
					"x402 spend budget exceeded: no budget remaining for %s (spent %d of %d)",
					call.Name, a.spend, budget))
			}
			budget = remaining
		}
		client := &x402.Client{Payer: a.opts.Payer, Budget: budget}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		if err != nil {
			return errResult(call.ID, err.Error())
		}
		resp, err := client.Do(req)
		if err != nil {
			if strings.Contains(err.Error(), "would exceed budget") {
				return refused(call.ID, model.Refused
```

### Core Architecture Module: `agent/checkpoint.go`
```
package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"go-micro.dev/v6/flow"
	"go-micro.dev/v6/model"
)

const (
	agentAskStep      = "ask"
	agentApprovalStep = "approval"
	agentInputStep    = "input-required"
)

func (a *agentImpl) newCheckpointRun(runID, message, parentRunID string, info model.RunInfo, existing *flow.Run) flow.Run {
	now := time.Now()
	run := flow.Run{
		ID:         runID,
		ParentID:   parentRunID,
		Flow:       a.opts.Name,
		OriginFlow: info.Flow,
		OriginStep: info.Step,
		Dispatch:   info.Dispatch,
		Trigger:    info.Trigger,
		State:      flow.State{Stage: agentAskStep, Data: []byte(message)},
		Steps:      []flow.StepRecord{{Name: agentAskStep, Status: "in_progress"}},
		Status:     "running",
		Started:    now,
		Updated:    now,
	}
	if existing != nil {
		run = *existing
		run.Status = "running"
		run.State.Stage = agentAskStep
		if len(run.Steps) == 0 {
			run.Steps = []flow.StepRecord{{Name: agentAskStep}}
		}
		run.Steps[0].Status = "in_progress"
		run.Steps[0].Error = ""
		run.Steps[0].Result = ""
	}
	return run
}

func (a *agentImpl) saveRun(ctx context.Context, run flow.Run) error {
	if a.opts.Checkpoint == nil {
		return nil
	}
	if err := a.opts.Checkpoint.Save(ctx, run); err != nil {
		return fmt.Errorf("agent %s checkpoint save: %w", a.opts.Name, err)
	}
	if info, ok := model.RunInfoFrom(ctx); ok {
		stage := run.State.Stage
		if stage == "" && len(run.Steps) > 0 {
			stage = run.Steps[0].Name
		}
		a.recordTimelineEvent(ctx, RunEvent{
			Time: time.Now(), RunID: info.RunID, ParentID: info.ParentID, Agent: info.Agent,
			Kind: "checkpoint", Name: stage, Status: run.Status,
		})
	}
	return nil
}

// Resumer is the optional capability for resuming checkpointed runs.
// Wrappers and alternative Agent implementations can implement it without
// depending on the built-in agent's concrete type.
type Resumer interface {
	Resume(context.Context, string) (*Response, error)
}

// InputResumer is the optional capability for resuming runs with human input.
type InputResumer interface {
	ResumeInput(context.Context, string, string) (*Response, error)
}

func (a *agentImpl) Resume(ctx context.Context, runID string) (*Response, error) {
	return a.resume(ctx, runID)
}

func (a *agentImpl) ResumeInput(ctx context.Context, runID, input string) (*Response, error) {
	return a.resumeInput(ctx, runID, input)
}

// Resume returns the response for a checkpointed agent run. Completed runs are
// returned from the checkpoint without calling the model or replaying tool
// calls; failed, interrupted (timeout/rate_limited), or in-progress runs
// continue from the saved input message and reuse completed tool results.
func Resume(ctx context.Context, ag Agent, runID string) (*Response, error) {
	a, ok := ag.(Resumer)
	if !ok {
		return nil, fmt.Errorf("agent resume: unsupported agent implementation %T", ag)
	}
	return a.Resume(ctx, runID)
}

func (a *agentImpl) resume(ctx context.Context, runID string) (*Response, error) {
	if a.opts.Checkpoint == nil {
		return nil, fmt.Errorf("agent %s has no checkpoint configured", a.opts.Name)
	}
	run, ok, err := a.opts.Checkpoint.Load(ctx, runID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, fmt.Errorf("agent run %s not found", runID)
	}
	if paused := pendingApproval(run); paused != nil {
		return nil, paused
	}
	if run.Status == "paused" {
		if run.State.Stage == agentInputStep {
			return nil, &AwaitingInputError{RunID: runID}
		}
		run.Status = "running"
		run.State.Stage = agentAskStep
	}
	if run.Status == "done" {
		var resp Response
		if err := json.Unmarshal(run.State.Data, &resp); err != nil {
			return nil, fmt.Errorf("agent run %s response decode: %w", runID, err)
		}
		return &resp, nil
	}
	if terminalAgentRunStatus(run.Status) {
		return nil, &TerminalRunError{RunID: runID, Status: run.Status}
	}
	message := string(run.State.Data)
	parentID := run.ParentID
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.model == nil {
		a.setup()
	}
	return a.askLocked(ctx, run.ID, message, parentID, &run, false)
}

// ResumeInput resumes a checkpointed agent run that paused via the built-in
// request_input tool. The supplied input is appended to the original request so
// the same run can continue with durable checkpoint and completed tool history.
func ResumeInput(ctx context.Context, ag Agent, runID, input string) (*Response, error) {
	a, ok := ag.(InputResumer)
	if !ok {
		return nil, fmt.Errorf("agent resume input: unsupported agent implementation %T", ag)
	}
	return a.ResumeInput(ctx, runID, input)
}

func (a *agentImpl) resumeInput(ctx context.Context, runID, input string) (*Response, error) {
	if a.opts.Checkpoint == nil {
		return nil, fmt.Errorf("agent %s has no checkpoint configured", a.opts.Name)
	}
	run, ok, err := a.opts.Checkpoint.Load(ctx, runID)
	if err != nil {
		return nil, err
	}
	if !ok {
		return nil, fmt.Errorf("agent run %s not found", runID)
	}
	if run.Status != "paused" || run.State.Stage != agentInputStep {
		return nil, fmt.Errorf("agent run %s is not waiting for human input", runID)
	}
	var p inputPause
	if err := run.State.Scan(&p); err != nil {
		return nil, fmt.Errorf("agent run %s input state decode: %w", runID, err)
	}
	message := p.OriginalMessage
	if message == "" {
		message = string(run.State.Data)
	}
	message += "\n\nHuman input: " + input
	run.Status = "running"
	run.State.Stage = agentAskStep
	run.State.Data = []byte(message)
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.model == nil {
		a.setup()
	}
	return a.askLocked(ctx, run.ID, message, run.ParentID, &run, true)
}

func (a *agentImpl) pending(ctx context.Context) ([]flow.Run, error) {
	if a.opts.Checkpoint == nil {
		return nil, nil
	}
	runs, err := a.opts.Checkpoint.List(ctx)
	if err != nil {
		return nil, err
	}
	out := runs[:0]
	for _, run := range runs {
		if run.Flow == a.opts.Name && !terminalAgentRunStatus(run.Status) {
			out = append(out, run)
		}
	}
	return out, nil
}

func terminalAgentRunStatus(status string) bool {
	switch status {
	case "done", "canceled", "expired":
		return true
	default:
		return false
	}
}

func agentRunFailureStatus(err error) string {
	switch model.ClassifyError(err) {
	case model.ErrorKindCanceled:
		return "canceled"
	case model.ErrorKindTimeout:
		return "timeout"
	case model.ErrorKindRateLimited:
		return "rate_limited"
	default:
		return "failed"
	}
}

type operationalError struct {
	err  error
	hint string
}

func (e *operationalError) Error() string {
	if e == nil {
		return ""
	}
	return e.err.Error() + "; " + e.hint
}

func (e *operationalError) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.err
}

func agentRunFailureAttempts(err error) int {
	var retryErr *model.RetryError
	if err != nil && errors.As(err, &retryErr) && retryErr.Attempts > 0 {
		return retryErr.Attempts
	}
	return 1
}

func agentOperationalError(err error) error {
	if err == nil {
		return nil
	}
	switch model.ClassifyError(err) {
	case model.ErrorKindCanceled:
		return &operationalError{err: err, hint: "agent run canceled; inspect run history with `micro inspect agent <name> --status canceled` or see docs/guides/debugging-agents.md"}
	case model.ErrorKindTimeout:
		return &operationalError{err: err, hint: "agent provider call timed out; inspect run history with `micro inspect agent <name> --status timeout`, then adjust AgentModelCallTimeout/AgentModelRetry or see docs/guides/debugging-agents.md"}
	case model.ErrorKindRateLimited:
		return &operationalError{err: err, hint: "agent provider was rate limited; inspect run history with `micro inspect agent <name> --status rate_limited`, check provider keys with `micro agent preflight`, or see docs/guides/debugging-agents.md"}
	case model.ErrorKindUnavailable:
		return &operationalError{err: err, hint: "agent provider appears temporarily unavailable; retry with bounded AgentModelRetry and verify provider setup with `micro agent preflight` or docs/guides/debugging-agents.md"}
	default:
		return err
	}
}

fun
```

### Core Architecture Module: `agent/memory.go`
```
package agent

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"sync"

	"go-micro.dev/v6/model"
	"go-micro.dev/v6/store"
)

// Memory is an agent's conversation memory. Like the rest of the
// framework it is pluggable: the default is store-backed and durable
// across restarts, but any implementation can be supplied with
// WithMemory — in-process, a database, or a semantic/vector store.
type Memory interface {
	// Add appends a message to the conversation.
	Add(role, content string)
	// Messages returns the retained conversation, oldest first.
	Messages() []model.Message
	// Clear resets the conversation.
	Clear()
}

// MemorySummaryFunc turns older conversation messages into a compact
// replacement message for active context. It is called while the default
// memory is locked, so implementations should be deterministic and avoid
// calling back into the same memory instance.
type MemorySummaryFunc func([]model.Message) model.Message

// MemoryCompaction configures deterministic, store-backed context compaction
// for the default memory implementation. When the retained conversation grows
// past MaxMessages, older turns are collapsed into a summary message while the
// newest KeepRecent turns stay verbatim for provider-neutral continuity.
type MemoryCompaction struct {
	MaxMessages int
	KeepRecent  int
	Summarize   MemorySummaryFunc
}

// MemoryRecall is implemented by memory backends that can retrieve durable
// prior context relevant to a new turn without replaying every stored message.
type MemoryRecall interface {
	Recall(query string, limit int) []model.Message
}

// MemorySummary is implemented by memory backends that expose their current
// compacted summary for inspection. It lets long-running agents make memory
// compaction observable without coupling callers to a concrete store.
type MemorySummary interface {
	Summary() string
}

// Summary returns the current compacted-memory summary for m, when supported.
// It returns an empty string for memory backends that have not compacted or do
// not expose an inspectable summary.
func Summary(m Memory) string {
	if m == nil {
		return ""
	}
	summarizer, ok := m.(MemorySummary)
	if !ok {
		return ""
	}
	return summarizer.Summary()
}

// NewMemory returns the default store-backed memory: an in-process
// conversation buffer (truncated to limit) that persists to the store
// under key, so an agent picks up where it left off after a restart.
// A nil store or empty key yields non-persistent memory.
func NewMemory(s store.Store, key string, limit int) Memory {
	m := &storeMemory{store: s, key: key, hist: model.NewHistory(limit)}
	m.load()
	return m
}

// NewRetrievalMemory returns store-backed memory that keeps a bounded active
// conversation and archives every turn for retrieval. It is useful when callers
// want relevant durable recall without summary compaction in the active context.
// A nil store or empty key keeps only the active in-process buffer.
func NewRetrievalMemory(s store.Store, key string, activeLimit int) Memory {
	m := &storeMemory{store: s, key: key, hist: model.NewHistory(activeLimit), retrieveAll: true}
	m.load()
	return m
}

// NewCompactingMemory returns store-backed memory with explicit compaction and
// retrieval controls. It keeps all messages in the backing store, compacts older
// turns into a deterministic summary when the conversation exceeds maxMessages,
// and lets callers recall relevant prior turns with Recall.
func NewCompactingMemory(s store.Store, key string, maxMessages, keepRecent int) Memory {
	return NewCompactingMemoryWithOptions(s, key, MemoryCompaction{MaxMessages: maxMessages, KeepRecent: keepRecent})
}

// NewCompactingMemoryWithOptions returns store-backed memory configured with
// explicit compaction options, including an optional summarization hook.
func NewCompactingMemoryWithOptions(s store.Store, key string, compaction MemoryCompaction) Memory {
	maxMessages := compaction.MaxMessages
	keepRecent := compaction.KeepRecent
	if keepRecent <= 0 {
		keepRecent = maxMessages / 2
	}
	if keepRecent < 1 {
		keepRecent = 1
	}
	m := &storeMemory{
		store: s,
		key:   key,
		// Use an unlimited buffer here; compaction, not truncation, decides
		// what remains in active context so a summary can preserve older turns.
		hist: model.NewHistory(0),
		compaction: MemoryCompaction{
			MaxMessages: maxMessages,
			KeepRecent:  keepRecent,
			Summarize:   compaction.Summarize,
		},
	}
	m.load()
	m.compact()
	return m
}

// NewInMemory returns conversation memory that is not persisted.
func NewInMemory(limit int) Memory {
	return &storeMemory{hist: model.NewHistory(limit)}
}

// storeMemory is the default Memory: an model.History buffer optionally
// persisted to a store.
type storeMemory struct {
	mu          sync.Mutex
	store       store.Store
	key         string
	hist        *model.History
	compaction  MemoryCompaction
	archive     []model.Message
	summary     string
	retrieveAll bool
}

func (m *storeMemory) Add(role, content string) {
	m.mu.Lock()
	if m.retrieveAll {
		m.archive = append(m.archive, model.Message{Role: role, Content: content})
	}
	m.hist.Add(role, content)
	m.mu.Unlock()
	m.compact()
	m.save()
}

func (m *storeMemory) Messages() []model.Message {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.hist.Messages()
}

func (m *storeMemory) Clear() {
	m.mu.Lock()
	m.hist.Reset()
	m.archive = nil
	m.summary = ""
	m.mu.Unlock()
	m.save()
}

// Summary returns the latest compacted summary text, if this memory has
// compacted older turns. The returned value is safe to show in debug UIs or
// checkpoints because it is exactly the summary retained in active context.
func (m *storeMemory) Summary() string {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.summary
}

// Recall returns archived messages whose content contains words from query.
// It is deterministic and provider-neutral: no embeddings or model calls are
// required, but semantic/vector stores can replace Memory for richer retrieval.
// When created with NewRetrievalMemory the archive contains every persisted
// turn; when created with NewCompactingMemory it contains compacted older turns.
func (m *storeMemory) Recall(query string, limit int) []model.Message {
	m.mu.Lock()
	defer m.mu.Unlock()
	if limit <= 0 {
		limit = 5
	}
	terms := recallTerms(query)
	type match struct {
		msg   model.Message
		score int
		index int
	}
	matches := make([]match, 0, len(m.archive))
	for i := len(m.archive) - 1; i >= 0; i-- {
		msg := m.archive[i]
		if score := recallScore(msg, terms); score > 0 {
			matches = append(matches, match{msg: msg, score: score, index: i})
		}
	}
	sort.SliceStable(matches, func(i, j int) bool {
		if matches[i].score != matches[j].score {
			return matches[i].score > matches[j].score
		}
		return matches[i].index > matches[j].index
	})
	if len(matches) > limit {
		matches = matches[:limit]
	}
	out := make([]model.Message, 0, len(matches))
	for _, match := range matches {
		out = append(out, match.msg)
	}
	return out
}

func (m *storeMemory) load() {
	if m.store == nil || m.key == "" {
		return
	}
	recs, err := m.store.Read(m.key)
	if err != nil || len(recs) == 0 {
		return
	}
	var state memoryState
	if err := json.Unmarshal(recs[0].Value, &state); err != nil {
		var msgs []model.Message
		if err := json.Unmarshal(recs[0].Value, &msgs); err != nil {
			return
		}
		state.Messages = msgs
	}
	m.mu.Lock()
	m.archive = state.Archive
	m.summary = state.Summary
	if m.retrieveAll && len(m.archive) == 0 {
		m.archive = append(m.archive, state.Messages...)
	}
	for _, msg := range state.Messages {
		m.hist.Add(msg.Role, msg.Content)
	}
	if m.summary == "" {
		m.summary = currentMemorySummary(state.Messages)
	}
	m.mu.Unlock()
}

func (m *storeMemory) save() {
	if m.store == nil || m.key == "" {
		return
	}
	m.mu.Lock()
	data, err := json.Marshal(memoryState{
		Messages: m.hist.Messages(),
		Archive:  m.archive,
		Summary:  m.summary,
	})
	m.mu.Unlock()
	if err != nil {
		return
	}
	_ = m.store.Write(&
```

### Core Architecture Module: `agent/options.go`
```
package agent

import (
	"context"
	"time"

	"go-micro.dev/v6/broker"
	"go-micro.dev/v6/client"
	"go-micro.dev/v6/flow"
	"go-micro.dev/v6/model"
	"go-micro.dev/v6/registry"
	"go-micro.dev/v6/store"
	"go-micro.dev/v6/wrapper/x402"
	"go.opentelemetry.io/otel/trace"
)

// Option configures an Agent.
type Option func(*Options)

// ApproveFunc decides whether an agent may execute a tool call before it
// runs. Returning false blocks the call; the reason is shown to the
// model so it can adapt. Use it for human-in-the-loop approval or policy
// checks. It is called for actions (service tools and delegate), not for
// the internal plan tool.
type ApproveFunc func(tool string, input map[string]any) (approved bool, reason string)

// ToolFunc handles a custom tool call. Return the result as a string
// (often JSON); return an error to report failure back to the model.
type ToolFunc func(ctx context.Context, input map[string]any) (string, error)

// customTool is a developer-registered tool beyond the agent's services.
type customTool struct {
	def     model.Tool
	handler ToolFunc
}

// Options holds agent configuration.
type Options struct {
	Name         string
	Services     []string
	Prompt       string
	Provider     string
	Model        string
	APIKey       string
	BaseURL      string
	Address      string
	Registry     registry.Registry
	Client       client.Client
	Broker       broker.Broker
	Store        store.Store
	HistoryLimit int

	// MaxTokens and Effort configure provider output and reasoning budgets.
	MaxTokens int
	Effort    string
	// Temperature is optional; nil leaves the provider default unchanged.
	Temperature *float64
	// MaxTools caps advertised tools, including custom and built-in tools (0 = unlimited).
	MaxTools int

	// ModelTimeout bounds each provider Generate call (0 disables).
	ModelTimeout time.Duration
	// ModelMaxAttempts bounds provider Generate attempts including the first
	// call. Default 1 — retries are opt-in (enable with ModelRetry). A Generate
	// runs the whole tool-execution turn, so auto-retrying it would re-run
	// already-executed, possibly side-effecting tool calls; keep it explicit.
	ModelMaxAttempts int
	// ModelRetryBackoff is the base delay between transient provider failures
	// (grows exponentially per attempt when retries are enabled).
	ModelRetryBackoff time.Duration
	// ModelRetryJitter adds up to this random delay to each provider retry
	// backoff. Default 0 preserves deterministic timing unless explicitly set.
	ModelRetryJitter time.Duration
	// ToolTimeout bounds each tool execution (0 disables). The timeout is
	// applied before custom tools, delegate, and service RPC calls so context
	// deadlines propagate consistently through the agent loop.
	ToolTimeout time.Duration
	// ToolMaxAttempts bounds tool execution attempts including the first call.
	// Default 1; retries are opt-in because tools can have side effects.
	ToolMaxAttempts int
	// ToolRetryBackoff is the base delay between transient tool failures.
	ToolRetryBackoff time.Duration

	// Memory is the agent's conversation memory. Nil = the default
	// store-backed memory (durable across restarts).
	Memory Memory
	// MemoryRetrievalLimit enables retrieval-backed default memory without
	// compaction. The active conversation stays bounded to this many messages
	// while every turn is archived for deterministic recall.
	MemoryRetrievalLimit int
	// MemoryCompaction enables deterministic compaction/retrieval on the
	// default store-backed memory. Custom Memory implementations can expose
	// retrieval by implementing MemoryRecall.
	MemoryCompaction MemoryCompaction
	// MemoryRecallLimit bounds recalled archived turns injected into a model
	// request (0 disables recall injection).
	MemoryRecallLimit int
	// Checkpoint persists agent Ask runs so callers can resume by run id
	// after a restart without replaying a run that already completed.
	Checkpoint flow.Checkpoint

	// MaxSteps bounds the number of tool executions per Ask (0 =
	// unbounded). Once exceeded, further tool calls are refused and the
	// model is told to stop and summarize. A stopping condition.
	MaxSteps int
	// LoopLimit bounds how many times the agent may call the same tool
	// with the same arguments in one Ask before the call is refused as a
	// no-progress loop (0 = disabled). Catches the agent repeating an
	// identical action — which MaxSteps only bounds by total count.
	LoopLimit int
	// Approve gates each action before it runs. Nil = allow all.
	Approve  ApproveFunc
	Approval ApprovalFunc
	// MaxSpend bounds paid x402 tool spend per Ask in the asset's smallest
	// unit (0 = disabled). ToolSpend lists known paid tools and their prices.
	MaxSpend  int64
	ToolSpend map[string]int64
	// Payer lets the agent settle x402 Payment Required challenges from tools.
	// Budget bounds autonomous x402 payments per Ask (0 = unlimited).
	Payer  x402.Payer
	Budget int64

	// A2AAddress, if set, makes Run serve this agent over the A2A protocol
	// on that address directly (no separate gateway), e.g. ":4000".
	A2AAddress string

	// TraceProvider enables OpenTelemetry spans for agent runs, model calls,
	// and tool calls. Nil disables instrumentation.
	TraceProvider trace.TracerProvider

	// TraceInputs controls whether agent observability records include raw
	// user messages. It is false by default so spans and persisted run
	// timelines carry correlation and shape without leaking prompts.
	TraceInputs bool

	// OnRunEvent, if set, is called as each run event is recorded
	// (see OnRunEvent).
	OnRunEvent RunEventFunc

	// tools are developer-registered custom tools (see WithTool).
	tools []customTool
	// wrappers are developer-registered tool-execution wrappers
	// (see WrapTool), applied outside the built-in guardrails.
	wrappers []model.ToolWrapper
}

func newOptions(opts ...Option) Options {
	o := Options{
		Registry:          registry.DefaultRegistry,
		Client:            client.DefaultClient,
		Store:             store.DefaultStore,
		HistoryLimit:      50,
		ModelTimeout:      30 * time.Second,
		ModelMaxAttempts:  1, // retries opt-in via ModelRetry (see field doc)
		ModelRetryBackoff: 100 * time.Millisecond,
		ToolTimeout:       30 * time.Second,
		ToolMaxAttempts:   1,
		ToolRetryBackoff:  100 * time.Millisecond,
		// On by default and lenient: identical repeated calls are a
		// no-progress loop, never useful. Set LoopLimit(0) to disable.
		LoopLimit: 3,
	}
	for _, opt := range opts {
		opt(&o)
	}
	return o
}

// Name sets the agent name.
func Name(n string) Option {
	return func(o *Options) { o.Name = n }
}

// Services restricts which services this agent manages. Calling Services()
// permits no discovered services; omitting this option permits all services.
func Services(names ...string) Option {
	return func(o *Options) { o.Services = append([]string{}, names...) }
}

// Prompt sets the system prompt.
func Prompt(p string) Option {
	return func(o *Options) { o.Prompt = p }
}

// Provider sets the LLM provider.
func Provider(p string) Option {
	return func(o *Options) { o.Provider = p }
}

// Model sets the LLM model name.
func Model(m string) Option {
	return func(o *Options) { o.Model = m }
}

// APIKey sets the API key for the LLM provider.
func APIKey(k string) Option {
	return func(o *Options) { o.APIKey = k }
}

// BaseURL sets the base URL for the LLM provider. Use this to point
// the provider at a non-default endpoint (e.g., local Ollama, a proxy).
func BaseURL(url string) Option {
	return func(o *Options) { o.BaseURL = url }
}

// Address sets the network address for the agent's service endpoint.
// Use "127.0.0.1:0" in local harnesses/tests to bind an ephemeral loopback
// port and avoid advertising the default service address.
func Address(addr string) Option {
	return func(o *Options) { o.Address = addr }
}

// WithRegistry sets the service registry.
func WithRegistry(r registry.Registry) Option {
	return func(o *Options) { o.Registry = r }
}

// WithClient sets t
```

### Core Architecture Module: `agent/otel.go`
```
package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sort"
	"strings"
	"time"

	"go-micro.dev/v6/model"
	"go-micro.dev/v6/store"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
)

const agentInstrumentationName = "go-micro.dev/v6/agent"

const (
	spanNameRun         = "agent.run"
	spanNameModelCall   = "agent.model.call"
	spanNameModelStream = "agent.model.stream"
	spanNameToolCall    = "agent.tool.call"

	AttrRunID            = "agent.run.id"
	AttrParentRunID      = "agent.run.parent_id"
	AttrAgentName        = "agent.name"
	AttrProvider         = "agent.model.provider"
	AttrModel            = "agent.model.name"
	AttrLatencyMS        = "agent.latency_ms"
	AttrInputTokens      = "agent.tokens.input"
	AttrOutputTokens     = "agent.tokens.output"
	AttrTotalTokens      = "agent.tokens.total"
	AttrAttempt          = "agent.model.attempt"
	AttrMaxAttempts      = "agent.model.max_attempts"
	AttrToolAttempt      = "agent.tool.attempt"
	AttrToolMaxAttempts  = "agent.tool.max_attempts"
	AttrToolName         = "agent.tool.name"
	AttrDelegate         = "agent.delegate"
	AttrGuardrailBlock   = "agent.guardrail.block"
	AttrRefusal          = "agent.refusal"
	AttrInputChars       = "agent.input.chars"
	AttrErrorKind        = "agent.error.kind"
	AttrCheckpointStatus = "agent.checkpoint.status"
	AttrCheckpointStage  = "agent.checkpoint.stage"
	AttrFlowName         = "agent.flow.name"
	AttrFlowStep         = "agent.flow.step"
	AttrDispatch         = "agent.dispatch"
	AttrTrigger          = "agent.trigger"
	AttrRunEventKind     = "agent.event.kind"
	AttrSpend            = "agent.spend"
	AttrToolSpend        = "agent.tool.spend"
)

// RunEvent is one ordered, persisted observation from an agent run. Events
// intentionally contain operational metadata rather than model or tool payloads;
// Name contains the prompt only when TraceInputs is explicitly enabled.
type RunEvent struct {
	Time        time.Time `json:"time"`
	RunID       string    `json:"run_id"`
	ParentID    string    `json:"parent_id,omitempty"`
	Flow        string    `json:"flow,omitempty"`
	Step        string    `json:"step,omitempty"`
	Dispatch    string    `json:"dispatch,omitempty"`
	Trigger     string    `json:"trigger,omitempty"`
	TraceID     string    `json:"trace_id,omitempty"`
	SpanID      string    `json:"span_id,omitempty"`
	Agent       string    `json:"agent"`
	Kind        string    `json:"kind"`
	Name        string    `json:"name,omitempty"`
	Provider    string    `json:"provider,omitempty"`
	Model       string    `json:"model,omitempty"`
	Attempt     int       `json:"attempt,omitempty"`
	MaxAttempts int       `json:"max_attempts,omitempty"`
	LatencyMS   int64     `json:"latency_ms,omitempty"`
	Tokens      Usage     `json:"tokens,omitempty"`
	Refused     string    `json:"refused,omitempty"`
	Status      string    `json:"status,omitempty"`
	Error       string    `json:"error,omitempty"`
	ErrorKind   string    `json:"error_kind,omitempty"`
	InputChars  int       `json:"input_chars,omitempty"`
	Spent       int64     `json:"spent,omitempty"`
	ToolSpend   int64     `json:"tool_spend,omitempty"`
}

type Usage = model.Usage

// RunListOptions controls how recorded agent run summaries are returned.
// Zero values preserve the full deterministic run list.
type RunListOptions struct {
	// Status, when set, keeps only runs with the matching status
	// (for example "running", "done", "canceled", "timeout",
	// "rate_limited", "auth", "configuration", "unavailable",
	// "provider_error", "error", or "refused").
	Status string
	// TraceID, when set, keeps only runs correlated with this trace id.
	// A prefix is accepted so operators can paste the shortened trace id
	// printed by `micro runs`.
	TraceID string
	// Limit, when positive, returns the most recently updated runs up to
	// the limit. Limited results are ordered newest first.
	Limit int
}

// RunSummary is the derived, compact index entry for a recorded agent run. It
// can be rebuilt from the run's events and is not a separate source of truth.
type RunSummary struct {
	RunID         string    `json:"run_id"`
	Agent         string    `json:"agent"`
	ParentID      string    `json:"parent_id,omitempty"`
	Flow          string    `json:"flow,omitempty"`
	Step          string    `json:"step,omitempty"`
	Dispatch      string    `json:"dispatch,omitempty"`
	Trigger       string    `json:"trigger,omitempty"`
	TraceID       string    `json:"trace_id,omitempty"`
	SpanID        string    `json:"span_id,omitempty"`
	StartedAt     time.Time `json:"started_at"`
	UpdatedAt     time.Time `json:"updated_at"`
	DurationMS    int64     `json:"duration_ms,omitempty"`
	Events        int       `json:"events"`
	Status        string    `json:"status,omitempty"`
	Checkpoint    string    `json:"checkpoint,omitempty"`
	Stage         string    `json:"stage,omitempty"`
	LastKind      string    `json:"last_kind,omitempty"`
	LastError     string    `json:"last_error,omitempty"`
	LastErrorKind string    `json:"last_error_kind,omitempty"`
	Spent         int64     `json:"spent,omitempty"`
}

// RunRecordSchemaVersion is the current JSON schema version for RunRecord.
const RunRecordSchemaVersion = 1

// RunRecord is the durable, inspectable representation of one agent execution.
// Events are ordered oldest first and Summary is derived from those events.
// Consumers should use SchemaVersion when decoding records across releases.
type RunRecord struct {
	SchemaVersion int        `json:"schema_version"`
	Summary       RunSummary `json:"summary"`
	Events        []RunEvent `json:"events"`
}

func (a *agentImpl) tracer() trace.Tracer {
	return a.opts.TraceProvider.Tracer(agentInstrumentationName)
}

func (a *agentImpl) startRun(ctx context.Context, message string) (context.Context, func(error)) {
	info, _ := model.RunInfoFrom(ctx)
	start := time.Now()
	runEvent := RunEvent{Time: start, RunID: info.RunID, ParentID: info.ParentID, Agent: info.Agent, Kind: "run", InputChars: len(message)}
	applyRunInfoToEvent(&runEvent, info)
	if a.opts.TraceInputs {
		runEvent.Name = message
	}

	if a.opts.TraceProvider == nil {
		a.recordRunEvent(runEvent)
		return ctx, func(err error) {
			latency := time.Since(start).Milliseconds()
			if err != nil {
				e := RunEvent{Time: time.Now(), RunID: info.RunID, ParentID: info.ParentID, Agent: info.Agent, Kind: "error", LatencyMS: latency, Error: err.Error(), ErrorKind: string(model.ClassifyError(err))}
				applyRunInfoToEvent(&e, info)
				a.recordRunEvent(e)
				return
			}
			e := RunEvent{Time: time.Now(), RunID: info.RunID, ParentID: info.ParentID, Agent: info.Agent, Kind: "done", LatencyMS: latency}
			applyRunInfoToEvent(&e, info)
			a.recordRunEvent(e)
		}
	}

	attrs := appendRunInfoAttributes([]attribute.KeyValue{
		attribute.String(AttrRunID, info.RunID),
		attribute.String(AttrParentRunID, info.ParentID),
		attribute.String(AttrAgentName, info.Agent),
	}, info)
	ctx, span := a.tracer().Start(ctx, spanNameRun, trace.WithSpanKind(trace.SpanKindInternal), trace.WithAttributes(attrs...))
	a.recordSpanEvent(span, runEvent)
	return ctx, func(err error) {
		latency := time.Since(start).Milliseconds()
		span.SetAttributes(attribute.Int64(AttrLatencyMS, latency))
		if err != nil {
			span.SetAttributes(attribute.String(AttrErrorKind, string(model.ClassifyError(err))))
			span.RecordError(err)
			span.SetStatus(codes.Error, err.Error())
			e := RunEvent{Time: time.Now(), RunID: info.RunID, ParentID: info.ParentID, Agent: info.Agent, Kind: "error", LatencyMS: latency, Error: err.Error(), ErrorKind: string(model.ClassifyError(err))}
			applyRunInfoToEvent(&e, info)
			a.recordSpanEvent(span, e)
		} else {
			span.SetStatus(codes.Ok, "")
			e := RunEvent{Time: time.Now(), RunID: info.RunID, ParentID: info.ParentID, Agent: info.Agent, Kind: "done", LatencyMS: latency}
			applyRunInfoToEvent(&e, info)
			a.recordSpanEvent(span, e)
		}
		span.End()
	}
}

type tracedModel struct {
	mod
```

### Core Architecture Module: `agent/proto/agent.pb.go`
```
// Code generated by protoc-gen-go. DO NOT EDIT.
// versions:
// 	protoc-gen-go v1.36.11
// 	protoc        v3.21.12
// source: agent/proto/agent.proto

package agent

import (
	protoreflect "google.golang.org/protobuf/reflect/protoreflect"
	protoimpl "google.golang.org/protobuf/runtime/protoimpl"
	reflect "reflect"
	sync "sync"
	unsafe "unsafe"
)

const (
	// Verify that this generated code is sufficiently up-to-date.
	_ = protoimpl.EnforceVersion(20 - protoimpl.MinVersion)
	// Verify that runtime/protoimpl is sufficiently up-to-date.
	_ = protoimpl.EnforceVersion(protoimpl.MaxVersion - 20)
)

type ChatRequest struct {
	state   protoimpl.MessageState `protogen:"open.v1"`
	Message string                 `protobuf:"bytes,1,opt,name=message,proto3" json:"message,omitempty"`
	// parent_id correlates this chat with the workflow or agent run that dispatched it.
	ParentId      string `protobuf:"bytes,2,opt,name=parent_id,json=parentId,proto3" json:"parent_id,omitempty"`
	unknownFields protoimpl.UnknownFields
	sizeCache     protoimpl.SizeCache
}

func (x *ChatRequest) Reset() {
	*x = ChatRequest{}
	mi := &file_agent_proto_agent_proto_msgTypes[0]
	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
	ms.StoreMessageInfo(mi)
}

func (x *ChatRequest) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*ChatRequest) ProtoMessage() {}

func (x *ChatRequest) ProtoReflect() protoreflect.Message {
	mi := &file_agent_proto_agent_proto_msgTypes[0]
	if x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use ChatRequest.ProtoReflect.Descriptor instead.
func (*ChatRequest) Descriptor() ([]byte, []int) {
	return file_agent_proto_agent_proto_rawDescGZIP(), []int{0}
}

func (x *ChatRequest) GetMessage() string {
	if x != nil {
		return x.Message
	}
	return ""
}

func (x *ChatRequest) GetParentId() string {
	if x != nil {
		return x.ParentId
	}
	return ""
}

type ChatResponse struct {
	state     protoimpl.MessageState `protogen:"open.v1"`
	Reply     string                 `protobuf:"bytes,1,opt,name=reply,proto3" json:"reply,omitempty"`
	Agent     string                 `protobuf:"bytes,2,opt,name=agent,proto3" json:"agent,omitempty"`
	ToolCalls []*ToolCall            `protobuf:"bytes,3,rep,name=tool_calls,json=toolCalls,proto3" json:"tool_calls,omitempty"`
	// run_id correlates this chat response with tool calls, traces, and run history.
	RunId string `protobuf:"bytes,4,opt,name=run_id,json=runId,proto3" json:"run_id,omitempty"`
	// parent_id is set when this response belongs to a delegated sub-agent run.
	ParentId      string `protobuf:"bytes,5,opt,name=parent_id,json=parentId,proto3" json:"parent_id,omitempty"`
	unknownFields protoimpl.UnknownFields
	sizeCache     protoimpl.SizeCache
}

func (x *ChatResponse) Reset() {
	*x = ChatResponse{}
	mi := &file_agent_proto_agent_proto_msgTypes[1]
	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
	ms.StoreMessageInfo(mi)
}

func (x *ChatResponse) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*ChatResponse) ProtoMessage() {}

func (x *ChatResponse) ProtoReflect() protoreflect.Message {
	mi := &file_agent_proto_agent_proto_msgTypes[1]
	if x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use ChatResponse.ProtoReflect.Descriptor instead.
func (*ChatResponse) Descriptor() ([]byte, []int) {
	return file_agent_proto_agent_proto_rawDescGZIP(), []int{1}
}

func (x *ChatResponse) GetReply() string {
	if x != nil {
		return x.Reply
	}
	return ""
}

func (x *ChatResponse) GetAgent() string {
	if x != nil {
		return x.Agent
	}
	return ""
}

func (x *ChatResponse) GetToolCalls() []*ToolCall {
	if x != nil {
		return x.ToolCalls
	}
	return nil
}

func (x *ChatResponse) GetRunId() string {
	if x != nil {
		return x.RunId
	}
	return ""
}

func (x *ChatResponse) GetParentId() string {
	if x != nil {
		return x.ParentId
	}
	return ""
}

type ToolCall struct {
	state         protoimpl.MessageState `protogen:"open.v1"`
	Id            string                 `protobuf:"bytes,1,opt,name=id,proto3" json:"id,omitempty"`
	Name          string                 `protobuf:"bytes,2,opt,name=name,proto3" json:"name,omitempty"`
	Input         string                 `protobuf:"bytes,3,opt,name=input,proto3" json:"input,omitempty"`
	Result        string                 `protobuf:"bytes,4,opt,name=result,proto3" json:"result,omitempty"`
	unknownFields protoimpl.UnknownFields
	sizeCache     protoimpl.SizeCache
}

func (x *ToolCall) Reset() {
	*x = ToolCall{}
	mi := &file_agent_proto_agent_proto_msgTypes[2]
	ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
	ms.StoreMessageInfo(mi)
}

func (x *ToolCall) String() string {
	return protoimpl.X.MessageStringOf(x)
}

func (*ToolCall) ProtoMessage() {}

func (x *ToolCall) ProtoReflect() protoreflect.Message {
	mi := &file_agent_proto_agent_proto_msgTypes[2]
	if x != nil {
		ms := protoimpl.X.MessageStateOf(protoimpl.Pointer(x))
		if ms.LoadMessageInfo() == nil {
			ms.StoreMessageInfo(mi)
		}
		return ms
	}
	return mi.MessageOf(x)
}

// Deprecated: Use ToolCall.ProtoReflect.Descriptor instead.
func (*ToolCall) Descriptor() ([]byte, []int) {
	return file_agent_proto_agent_proto_rawDescGZIP(), []int{2}
}

func (x *ToolCall) GetId() string {
	if x != nil {
		return x.Id
	}
	return ""
}

func (x *ToolCall) GetName() string {
	if x != nil {
		return x.Name
	}
	return ""
}

func (x *ToolCall) GetInput() string {
	if x != nil {
		return x.Input
	}
	return ""
}

func (x *ToolCall) GetResult() string {
	if x != nil {
		return x.Result
	}
	return ""
}

var File_agent_proto_agent_proto protoreflect.FileDescriptor

const file_agent_proto_agent_proto_rawDesc = "" +
	"\n" +
	"\x17agent/proto/agent.proto\x12\x05agent\"D\n" +
	"\vChatRequest\x12\x18\n" +
	"\amessage\x18\x01 \x01(\tR\amessage\x12\x1b\n" +
	"\tparent_id\x18\x02 \x01(\tR\bparentId\"\x9e\x01\n" +
	"\fChatResponse\x12\x14\n" +
	"\x05reply\x18\x01 \x01(\tR\x05reply\x12\x14\n" +
	"\x05agent\x18\x02 \x01(\tR\x05agent\x12.\n" +
	"\n" +
	"tool_calls\x18\x03 \x03(\v2\x0f.agent.ToolCallR\ttoolCalls\x12\x15\n" +
	"\x06run_id\x18\x04 \x01(\tR\x05runId\x12\x1b\n" +
	"\tparent_id\x18\x05 \x01(\tR\bparentId\"\\\n" +
	"\bToolCall\x12\x0e\n" +
	"\x02id\x18\x01 \x01(\tR\x02id\x12\x12\n" +
	"\x04name\x18\x02 \x01(\tR\x04name\x12\x14\n" +
	"\x05input\x18\x03 \x01(\tR\x05input\x12\x16\n" +
	"\x06result\x18\x04 \x01(\tR\x06result2:\n" +
	"\x05Agent\x121\n" +
	"\x04Chat\x12\x12.agent.ChatRequest\x1a\x13.agent.ChatResponse\"\x00B\x0fZ\r./proto;agentb\x06proto3"

var (
	file_agent_proto_agent_proto_rawDescOnce sync.Once
	file_agent_proto_agent_proto_rawDescData []byte
)

func file_agent_proto_agent_proto_rawDescGZIP() []byte {
	file_agent_proto_agent_proto_rawDescOnce.Do(func() {
		file_agent_proto_agent_proto_rawDescData = protoimpl.X.CompressGZIP(unsafe.Slice(unsafe.StringData(file_agent_proto_agent_proto_rawDesc), len(file_agent_proto_agent_proto_rawDesc)))
	})
	return file_agent_proto_agent_proto_rawDescData
}

var file_agent_proto_agent_proto_msgTypes = make([]protoimpl.MessageInfo, 3)
var file_agent_proto_agent_proto_goTypes = []any{
	(*ChatRequest)(nil),  // 0: agent.ChatRequest
	(*ChatResponse)(nil), // 1: agent.ChatResponse
	(*ToolCall)(nil),     // 2: agent.ToolCall
}
var file_agent_proto_agent_proto_depIdxs = []int32{
	2, // 0: agent.ChatResponse.tool_calls:type_name -> agent.ToolCall
	0, // 1: agent.Agent.Chat:input_type -> agent.ChatRequest
	1, // 2: agent.Agent.Chat:output_type -> agent.ChatResponse
	2, // [2:3] is the sub-list for method output_type
	1, // [1:2] is the sub-list for method input_type
	1, // [1:1] is the sub-list for extension type_name
	1, // [1:1] is the sub-list for extension extendee
	0, // [0:1] is the sub-list for field type_name
}

func init
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4938** (2026-09-21): **[BUG] `ai/groq` (and `ai/openai`) `Generate`: tool-loop, dropped options, swallowed errors, retired default model**
  *Symptoms*:  **Labels:** bug, ai, groq, openai **Package:** `go-micro.dev/v6/ai/groq`, `go-micro.dev/v6/ai/openai` **Version:** v6.12.0 / v6.13.0 **Confidence:** mixed. Items 2 (swallowed error) and 3 (follow-up drops options) are source-verified in `ai/groq/groq.go`; items 1, 4, 5 and 6 are recorded from live failures and should be re-checked against v6.13.0 before filing (KNOWN_ISSUES #79 Addenda 4-7).  ## Summary  `Generate` implements its own one-round tool loop instead of reusing the shared `openaiapi` path that `Stream` uses. The copy has several defects. Numbered as in our write-up:  1. **History dropped (Groq).** `Generate` didn't thread `req.Messages`, so multi-turn conversations lost their history. 2. **Follow-up error swallowed (Groq, OpenAI).**    ```go    followUpResp, _, err := p.callAPI(ctx, ...)    if err == nil && followUpResp.Reply != "" { resp.Answer = followUpResp.Reply }   // err ignored    ```    A failing second round is silently dropped, so `ai.GenerateWithRetry`'s backoff and `ai.ClassifyError` never see it. 3. **Follow-up request loses options.** The second request is `{model, messages}` only: no `max_tokens`, no `reasoning_effort`, no tools. 4. **Echoed assistant message lost `"type":"function"`.** The assistant `tool_calls` are round-tripped through a struct with only `ID`/`Function`,    so `type` is dropped on re-marshal, and the provider returns `400 ... .type Field required`. The same undecorated struct exists in `ai/openai`    (reproduced against NVIDIA NI

- **Issue #4935** (2026-09-21): **[BUG] `agent`: 30s default timeouts mark a run terminal forever, with no recovery**
  *Symptoms*: **Labels:** bug / design, agent, reliability **Package:** `go-micro.dev/v6/agent` **Version:** v6.12.0 / v6.13.0 **Confidence:** observed live (KNOWN_ISSUES #48; a `ResumeChat` that took 32286ms), `terminalAgentRunStatus` source-verified  ## Summary  `ModelCallTimeout` and `ToolCallTimeout` default to 30s. A real multi-tool Anthropic turn (or a slow tool RPC) exceeds that. When it does:  1. The run's checkpoint is saved with status `timeout` (or `canceled` / `rate_limited`), all in `terminalAgentRunStatus`. 2. `agent.Resume` then refuses that run forever with `agent run X is terminal with status "timeout"`. 3. The caller's only option is to start a new conversation and lose the run's context. A run that was paused waiting on a human approval    is stranded permanently, even though the human already approved.  A timeout or a provider rate limit is transient, and it's treated as fatal.  ## Expected  - `timeout` and `rate_limited` are resumable (retry the failed step from the checkpoint), and only `canceled`/`failed`-by-policy are terminal. - Or `Resume(ctx, runID, agent.Retry())` explicitly re-arms a terminal-by-timeout run. - Defaults are documented with a guide for LLM-realistic values (60-120s), and the failure is reported as a typed error (see [06](06-agent-pause-and-terminal-via-error-strings.md)).  ## Suggested fix  Split "terminal" into *final* (`done`, `failed`, `canceled`) and *interrupted* (`timeout`, `rate_limited`). Let `Resume` continue an interrupted run from its 

- **Issue #4934** (2026-09-21): **[BUG] `agent`: `delegate` can hand a sub-agent unrestricted tool visibility; empty `Services` means "all"**
  *Symptoms*:  **Labels:** bug, security, agent **Package:** `go-micro.dev/v6/agent` **Version:** v6.12.0 / v6.13.0 (behaviour also seen on the pinned v6.13.0) **Confidence:** source-verified (`agent/builtin.go` `handleDelegate`, `agent/agent.go` `discoverTools`); reached by reading and by a live approval-gate test, not by exploiting a real leak (KNOWN_ISSUES #51)  ## Summary  `agent.Services(...)` is documented as the set of services an agent manages, and is the natural way to bound the tools a model can see. The built-in `delegate` tool breaks that bound in two ways:  1. `to` is optional. When blank, `handleDelegate` builds the ephemeral sub-agent with `Services(svcs...)` where `svcs` is empty. 2. `discoverTools` treats `len(a.opts.Services) == 0` as "no restriction" and returns every registered service's tools.  So `delegate(task, to="")` yields a sub-agent that can discover tools from all services, including ones the parent was never allowed to see. Likewise `delegate(to="identity")` scopes the sub-agent to a service that isn't in the parent's allowlist.  ```go // builtin.go var svcs []string if to != "" { svcs = []string{to} } sub := newEphemeral(Name(a.opts.Name+".sub"), Services(svcs...), ...)   // empty => unrestricted  // agent.go discoverTools if len(a.opts.Services) == 0 { scoped = append(scoped, t); continue }   // empty == everything ```  Each individual call would still be authorized by the owning service, so this is not a raw auth bypass. But tool visibility, which is what `

- **Issue #4930** (2026-09-21): **[BUG] `events/natsjs` `Ack`/`Nack` are no-ops without `AutoAck`, and `AutoAck` acks before the handler finishes**
  *Symptoms*:  **Labels:** bug, events, jetstream, delivery-guarantees **Package:** `go-micro.dev/v6/events/natsjs` **Version:** v6.12.0 / v6.13.0 **Confidence:** source-verified (`events/natsjs/nats.go`, `handleMsg` closure)  ## Summary  Neither ack mode gives "ack after my handler succeeded, redeliver if it failed":  - **`AutoAck: false`** (the default): the JetStream subscription is created with `AckExplicit()`, but `Event.Ack()` and   `Event.Nack()` are wired to functions that `return nil`. Nothing ever calls `msg.Ack()`, so messages sit un-acked and are   redelivered after `AckWait` regardless of whether your handler succeeded. - **`AutoAck: true`**: `Ack`/`Nack` are real, but the framework also calls `msg.Ack()` itself as soon as the event has been   pushed onto the consumer channel. Whatever the handler later does, the message is already acked, so a failure means a lost event.  ## Evidence  ```go if options.AutoAck {     evt.SetAckFunc(func() error  { return msg.Ack() })     evt.SetNackFunc(func() error { return msg.Nak() }) } else {     evt.SetAckFunc(func() error  { return nil })    // no-op     evt.SetNackFunc(func() error { return nil })    // no-op } channel <- evt if !options.AutoAck { return }                      // never acked here either if err := msg.Ack(nats.Context(ctx)); err != nil { ... }   // acked on delivery, not on success ```  ## Expected  Manual-ack mode wires `Ack`/`Nack` to `msg.Ack()`/`msg.Nak()`. Auto-ack mode acks after the consumer has handled the event, o

- **Issue #4929** (2026-09-21): **[BUG] `events/natsjs` `Consume` silently skips history on first connect and defaults to a random group**
  *Symptoms*: **Labels:** bug, events, jetstream, footgun **Package:** `go-micro.dev/v6/events/natsjs` **Version:** v6.12.0 / v6.13.0 **Confidence:** source-verified (`events/natsjs/nats.go`) + observed (KNOWN_ISSUES #17, 8 events permanently missing)  ## Summary  Two defaults combine into silent event loss:  1. When `ConsumeOptions.Offset` is the zero value, `Consume` applies `nats.DeliverNew()`. A durable consumer's first-ever    connection receives only events published after that moment. Anything already on the stream is skipped and never delivered. 2. `Group` defaults to `uuid.New().String()` on every call. Without `WithGroup`, each restart creates a brand-new durable    consumer, which per (1) also starts at "new only". Durability is lost without any warning.  ## Evidence  ```go // events/natsjs/nats.go, Consume() options := events.ConsumeOptions{ Group: uuid.New().String() }   // random per call ... if !options.Offset.IsZero() {     subOpts = append(subOpts, nats.StartTime(options.Offset)) } else {     subOpts = append(subOpts, nats.DeliverNew())                 // silent skip of history } ```  Live: two new consumer groups (`audit-communication-events`, `audit-billing-events`) connected against streams that already had history. `psql` showed 1 of 11 published communication events recorded. The other events were never delivered, not delayed. Nothing logged, nothing errored.  ## Expected  - A stable, named consumer resumes from its persisted position, and a new one starts from the be
  **Post-Mortem & Fix Analysis**:
  > @codex 
  > ### Summary  * Required explicit consumer groups when durable JetStream consumers are enabled, preventing restarts from silently creating unrelated consumers with random names. Ephemeral consumers retain generated names when no group is supplied. * Changed new durable consumers to replay retained stream history by default with `DeliverAll`, while ephemeral consumers continue using `DeliverNew`; explicit offsets still take precedence. * Added integration coverage for missing durable groups and historical-event replay, and updated the existing test to use a stable consumer group. * Documented group requirements, replay behavior, persisted resume positions, offsets, and ephemeral defaults. * Committed the changes as `fbc3de1` and opened [PR #4943](https://github.com/micro/go-micro/pull/4943), closing issue #4929. * Auto-merge could not be enabled because GitHub reported that protected branch rules are not configured. The PR remains open; it was not manually merged while CI was failing.  *

- **Issue #4928** (2026-09-21): **[BUG] `registry/nats` returns an empty success on timeout, so health checks can't detect NATS down**
  *Symptoms*: **Labels:** bug, registry, nats, health **Package:** `go-micro.dev/v6/registry/nats`, `go-micro.dev/v6/health` **Version:** v6.12.0 / v6.13.0 **Confidence:** source-verified (`registry/nats/nats.go` `query()`) + observed live (KNOWN_ISSUES #1)  ## Summary  `natsRegistry.query()` publishes a request and collects replies until quorum or timeout. On timeout it breaks out of the loop and returns whatever it has, including nothing, as `return services, nil`. "NATS is down" and "no services are registered" are therefore indistinguishable to `ListServices`, and `health.RegistryCheck` (which calls `ListServices`) reports `up` for the whole outage.  ## Evidence  ```go // registry/nats/nats.go, query() case <-timeoutChan:     break loop ... return services, nil        // nil error even when zero replies arrived ```  With NATS stopped, `/health/ready` kept returning `"registry":"up"` while real RPCs failed with `error selecting <svc> node: dial tcp: ... server misbehaving`. The `postgres` check flipped to `down` within milliseconds in the same session.  ## Expected  - A query that could not reach the server, or got no reply because the connection is closed, returns an error. - Only a genuine "reachable, nobody answered" returns an empty list. - `RegistryCheck` then reflects reality.  ## Suggested fix  1. In `query()`, check `n.conn.Status()`/`IsConnected()` before and after the wait and return an error if the connection is not up. 2. Return `registry.ErrNotFound` (or a distinct timeout 
  **Post-Mortem & Fix Analysis**:
  > @codex 
  > ### Summary  * Updated NATS registry queries to validate the connection both before publishing and after waiting for responses. Closed connections now return `nats.ErrConnectionClosed`, while disconnected or reconnecting connections return `nats.ErrDisconnected` instead of an empty successful result.  * Added an embedded-NATS regression test confirming that a reachable server with no registered services still returns an empty successful list, while a stopped server produces a disconnected error.  * Adjusted the NATS test harness so self-contained tests run without `NATS_URL`, while tests and benchmarks requiring an external NATS instance skip explicitly.  * Committed the changes as `e30864e` on `codex/4928-nats-query-connection-errors`. * Opened and merged pull request [#4945](https://github.com/micro/go-micro/pull/4945).  **Testing**  * ✅ `go build ./...` * ✅ `go test -json ./registry/nats -run TestQueryConnectionState -count=10` * ✅ `git diff --check` * ⚠️ `go test ./...` — the chang

- **Issue #4927** (2026-09-21): **[BUG] # 01 — `store/postgres/pgx.NewStore` leaves `Options.Context` nil and panics**
  *Symptoms*: **Labels:** bug, store, postgres **Package:** `go-micro.dev/v6/store/postgres/pgx` **Version:** v6.12.0 / v6.13.0 **Confidence:** source-verified (`store/postgres/pgx/pgx.go`) + observed (agent-service)  ## Summary  `NewStore` builds `store.Options` with only `Database` and `Table`. `Context` stays `nil`, and the store then passes `s.options.Context` straight into `pgxpool.NewWithConfig` and every `Exec`/`Query`. A nil context panics inside pgx (first seen when the pool's background idle-connection filler ran) instead of returning an error.  ## Evidence  ```go // store/postgres/pgx/pgx.go func NewStore(opts ...store.Option) store.Store {     options := store.Options{         Database: defaultDatabase,         Table:    defaultTable,     }                                   // Context is never defaulted     ... } ... db, err := pgxpool.NewWithConfig(s.options.Context, config)   // nil ctx ```  ## Repro  ```go st := pgx.NewStore(store.Nodes("postgres://..."))   // no store.WithContext(...) _ = st.Write(&store.Record{Key: "k", Value: []byte("v")}) ```  ## Expected  `Context` defaults to `context.Background()` like other options. Failing that, a clear error (`store: nil context`).  ## Actual  A nil-pointer panic from pgx, on the first use, well after construction. It looks like a crash in a background goroutine, not a misconfiguration.  ## Suggested fix  Default `options.Context = context.Background()` in `NewStore`, after applying options if it is still nil. Add a test that const
  **Post-Mortem & Fix Analysis**:
  > @codex 
  > ### Summary  * Updated the pgx PostgreSQL store to assign `context.Background()` whenever construction options leave `Context` nil, preventing pgx pool and query operations from receiving a nil context. Explicit non-nil contexts remain unchanged.  * Added regression tests covering the default context, preservation of an explicitly configured context, and fallback when an explicitly nil context is supplied.  * Committed the change as `a988d54` (`fix(pgx): default store context`) on `codex/pgx-default-context`. * Opened and merged [PR #4944](https://github.com/micro/go-micro/pull/4944) into `master`.  **Testing**  * ✅ `go test ./store/postgres/pgx` * ✅ `go build ./...` * ✅ `git diff --check` * ⚠️ `go test ./...` — relevant pgx tests passed, but the complete suite failed because the environment blocks loopback connections with HTTP 403; an unrelated Atlas Cloud provider test also received HTTP 400. * ⚠️ `golangci-lint run ./...` — the installed linter was compiled with Go 1.24, which cann

- **Issue #4913** (2026-09-10): **[BUG] v4: Segmentation fault and missing Close() for open file handles in `config` package**
  *Symptoms*: ## Describe the bug The `config` package (`go-micro.dev/v4@v4.11.0`) has two issues in `config/default.go`:  1. `config.Close()` does not release open file handles/watchers. It only closes the internal `exit` channel to stop the watch loop, but never calls `c.opts.Loader.Close()`. Because of this, open file/watcher handles created by sources (e.g. `config/source/file`) are never released after `Close()` is called.  2. A segmentation fault occurs in the `run()` function when accessing the returned `err` value.  ## To Reproduce 1. Create a config instance with a source that supports watching (e.g. `file.NewSource`) 2. Call `config.Close()` 3. The watcher/file handle stays open, and a segmentation fault can occur in `run()` when handling the `err` value  ## Expected behavior - `config.Close()` should stop the loader and release all watchers and their open file handles. - No segmentation fault should occur when handling `err` in `run()`.   ## Environment - Go Micro version: v4.11.0 - OS/Platform: Windows, MSYS2 UCRT64 - Plugins/Integrations: `config/source/file`  ## Checklist - [x] I've searched existing issues and this is not a duplicate - [x] I've provided a minimal code sample that reproduces the issue - [x] I've included my environment details - [ ] I've checked the documentation  ## Additional context Proposed fix for issue 1 — update `Close()` in `config/default.go` to also close the underlying loader:  ```go func (c *config) Close() error { 	select { 	case <-c.exit: 		retu
  **Post-Mortem & Fix Analysis**:
  > I attempted to open a PR for these changes, but noticed that go-micro v6 (on `master`) already has a fix for the segmentation fault — however, the fix for fully closing file handles (calling `Loader.Close()` inside `config.Close()`) is still missing there as well.  Since v4 doesn't appear to have its own maintenance branch, could one of the maintainers update the source file used for `go-micro.dev/v4` directly (or confirm whether v4 still accepts fixes)? Happy to submit a PR against the correct branch/tag if pointed in the right direction. 
  > @codex 
  > Codex couldn't complete this request. Try again later.

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

### Incident Patch 1: `424784d9` (2026-09-24)
**Commit Message**: Fix punctuation in README description

Removed a comma from the description of the Go Micro framework.

**File**: `README.md` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@ An agent harness and service framework
 
 ## Overview
 
-Go Micro is a framework for agentic and service development. Service discovery, RPC, messaging, storage, pubsub and config underpin everything. 
+Go Micro is a framework for agentic and service development. Service discovery, RPC messaging, storage and pubsub underpin everything. 
 
 Agents use service endpoints as tools; workflows coordinate ordered steps and recover from saved checkpoints. Each package is pluggable and can run inside a single Go binary or multi process.
 
```

---

### Incident Patch 2: `afd75e24` (2026-09-21)
**Commit Message**: fix(gateway): enforce administrative and transport security boundaries (#4964)

* fix(gateway): enforce administrative and transport security boundaries

* fix(gateway): reject browser-controlled hosts on loopback sockets

* fix(mcp): expose trusted browser origins in CLI entrypoints

**File**: `cmd/micro/gateway/admin.go` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+package gateway
+
+import (
+	"encoding/json"
+	"net/http"
+
+	"go-micro.dev/v6/store"
+)
+
+// adminRequired separates administrative control from tool invocation scopes.
+// Both the signed role and the current stored role must authorize administration.
+func adminRequired(st store.Store) func(http.HandlerFunc) http.HandlerFunc {
+	return func(next http.HandlerFunc) http.HandlerFunc {
+		return authRequired(st)(func(w http.ResponseWriter, r *http.Request) {
+			token := extractToken(r)
+			if tokenMatches(token) {
+				next(w, r)
+				return
+			}
+			claims, err := ParseJWT(token)
+			if err == nil && claims["type"] == "admin" {
+				id, _ := claims["sub"].(string)
+				records, readErr := st.Read("auth/" + id)
+				if readErr == nil && id != "" && len(records) == 1 {
+					var account Account
+					if json.Unmarshal(records[0].Value, &account) == nil && account.ID == id && account.Type == "admin" {
+						next(w, r)
+						return
+					}
+				}
+			}
+			http.Error(w, "Forbidden", http.StatusForbidden)
+		})
+	}
+}
```

**File**: `cmd/micro/gateway/security_test.go` (added, +97/-0)
```diff
@@ -0,0 +1,97 @@
+package gateway
+
+import (
+	"bytes"
+	"crypto/rand"
+	"crypto/rsa"
+	"encoding/json"
+	"html/template"
+	"net/http"
+	"net/http/httptest"
+	"os"
+	"strings"
+	"testing"
+	"time"
+
+	"go-micro.dev/v6/store"
+)
+
+func TestDashboardAdminBoundary(t *testing.T) {
+	oldHTML, oldToken, oldPrivate, oldPublic := HTML, authToken, jwtPrivateKey, jwtPublicKey
+	t.Cleanup(func() { HTML, authToken, jwtPrivateKey, jwtPublicKey = oldHTML, oldToken, oldPrivate, oldPublic })
+	HTML = os.DirFS("..")
+	authToken = "test-machine-token"
+	key, err := rsa.GenerateKey(rand.Reader, 2048)
+	if err != nil {
+		t.Fatal(err)
+	}
+	jwtPrivateKey, jwtPublicKey = key, &key.PublicKey
+	for _, role := range []string{"user", "service", "admin"} {
+		t.Run(role, func(t *testing.T) {
+			st := store.NewMemoryStore()
+			data, _ := json.Marshal(Account{ID: "caller", Type: role})
+			if err := st.Write(&store.Record{Key: "auth/caller", Value: data}); err != nil {
+				t.Fatal(err)
+			}
+			token, err := GenerateJWT("caller", role, []string{"*"}, time.Hour)
+			if err != nil {
+				t.Fatal(err)
+			}
+			storeJWTToken(st, token, "caller")
+			mux := http.NewServeMux()
+			registerHandlers(mux, parseTemplates(), st, true)
+			for _, path := range []string{"/auth/users", "/auth/tokens", "/auth/scopes", "/auth/scopes/bulk"} {
+				if role == "admin" && strings.Contains(path, "scopes") {
+					continue
+				} // discovery is irrelevant to this authorization regression
+				request := httptest.NewRequest(http.MethodPost, path, strings.NewReader("id=created&type=admin&password=test"))
+				request.Header.Set("Content-Type", "application/x-www-form-urlencoded")
+				request.Header.Set("Authorization", "Bearer "+token)
+				response := httptest.NewRecorder()
+				mux.ServeHTTP(response, request)
+				want := http.StatusForbidden
+				if role == "admin" {
+					want = http.StatusSeeOther
+				}
+				if response.Code != want {
+					t.Fatalf("%s: got %d want %d", path, response.Code, want)
+				}
+			}
+			records, _ := st.Read("auth/created")
+			if role != "admin" && len(records) > 0 {
+				t.Fatal("non-admin modified accounts")
+			}
+			if role == "admin" {
+				data, _ := json.Marshal(Account{ID: "caller", Type: "user"})
+				_ = st.Write(&store.Record{Key: "auth/caller", Value: data})
+				rr := httptest.NewRecorder()
+				req := httptest.NewRequest(http.MethodGet, "/auth/tokens", nil)
+				req.Header.Set("Authorization", "Bearer "+token)
+				mux.ServeHTTP(rr, req)
+				if rr.Code != http.StatusForbidden {
+					t.Fatal("demoted admin retained access")
+				}
+			}
+		})
+	}
+}
+
+func TestDashboardTemplatesEscapeUntrustedText(t *testing.T) {
+	old := HTML
+	HTML = os.DirFS("..")
+	t.Cleanup(func() { HTML = old })
+	tmpls := parseTemplates()
+	payload := `<script>untrusted()</script>`
+	for _, tmpl := range []*template.Template{tmpls.api, tmpls.service, tmpls.form, tmpls.home, tmpls.logs, tmpls.log, tmpls.status, tmpls.authTokens, tmpls.authLogin, tmpls.authUsers, tmpls.playground, tmpls.scopes} {
+		var out bytes.Buffer
+		if err := tmpl.Execute(&out, map[string]any{"Title": payload, "User": &TemplateUser{ID: payload}, "Log": payload, "Error": payload, "ServiceName": payload}); err != nil {
+			t.Fatal(err)
+		}
+		if strings.Contains(out.String(), payload) {
+			t.Fatal("unescaped template value")
+		}
+		if !strings.Contains(out.String(), "&lt;script&gt;") {
+			t.Fatal("missing escaped test value")
+		}
+	}
+}
```

**File**: `cmd/micro/gateway/server.go` (modified, +35/-12)
```diff
@@ -9,6 +9,7 @@ import (
 	"encoding/json"
 	"encoding/pem"
 	"fmt"
+	"html/template"
 	"io"
 	"io/fs"
 	"log"
@@ -21,7 +22,6 @@ import (
 	"strings"
 	"sync"
 	"syscall"
-	"text/template"
 	"time"
 
 	"github.com/urfave/cli/v2"
@@ -31,6 +31,7 @@ import (
 	"go-micro.dev/v6/cmd"
 	codecBytes "go-micro.dev/v6/codec/bytes"
 	"go-micro.dev/v6/gateway/mcp"
+	"go-micro.dev/v6/internal/browserorigin"
 	"go-micro.dev/v6/model"
 	_ "go-micro.dev/v6/model/anthropic"
 	_ "go-micro.dev/v6/model/atlascloud"
@@ -166,6 +167,10 @@ func deleteUserTokens(storeInst store.Store, userID string) {
 func authRequired(storeInst store.Store) func(http.HandlerFunc) http.HandlerFunc {
 	return func(next http.HandlerFunc) http.HandlerFunc {
 		return func(w http.ResponseWriter, r *http.Request) {
+			if r.Method != http.MethodGet && r.Method != http.MethodHead && !browserorigin.Allowed(r, []string{"https://" + r.Host}) {
+				http.Error(w, "Forbidden origin", http.StatusForbidden)
+				return
+			}
 			token := extractToken(r)
 			if token == "" {
 				if strings.HasPrefix(r.URL.Path, "/api/") && r.URL.Path != "/api" && r.URL.Path != "/api/" {
@@ -312,9 +317,15 @@ func registerHandlers(mux *http.ServeMux, tmpls *templates, storeInst store.Stor
 		authMw := authRequired(storeInst)
 		wrap = wrapAuth(authMw)
 	} else {
-		// No auth in dev mode - pass through handlers unchanged
+		// Local development skips authentication, but still rejects foreign browser origins.
 		wrap = func(h http.HandlerFunc) http.HandlerFunc {
-			return h
+			return func(w http.ResponseWriter, r *http.Request) {
+				if !browserorigin.Allowed(r, []string{"https://" + r.Host}) {
+					http.Error(w, "Forbidden origin", http.StatusForbidden)
+					return
+				}
+				h(w, r)
+			}
 		}
 	}
 
@@ -855,7 +866,7 @@ func registerHandlers(mux *http.ServeMux, tmpls *templates, storeInst store.Stor
 						if ep.Request != nil && len(ep.Request.Values) > 0 {
 							params += "<ul class=no-bullets>"
 							for _, v := range ep.Request.Values {
-								params += fmt.Sprintf("<li><b>%s</b> <span style='color:#888;'>%s</span></li>", v.Name, v.Type)
+								params += fmt.Sprintf("<li><b>%s</b> <span style='color:#888;'>%s</span></li>", template.HTMLEscapeString(v.Name), template.HTMLEscapeString(v.Type))
 							}
 							params += "</ul>"
 						} else {
@@ -864,7 +875,7 @@ func registerHandlers(mux *http.ServeMux, tmpls *templates, storeInst store.Stor
 						if ep.Response != nil && len(ep.Response.Values) > 0 {
 							response += "<ul class=no-bullets>"
 							for _, v := range ep.Response.Values {
-								response += fmt.Sprintf("<li><b>%s</b> <span style='color:#888;'>%s</span></li>", v.Name, v.Type)
+								response += fmt.Sprintf("<li><b>%s</b> <span style='color:#888;'>%s</span></li>", template.HTMLEscapeString(v.Name), template.HTMLEscapeString(v.Type))
 							}
 							response += "</ul>"
 						} else {
@@ -873,8 +884,8 @@ func registerHandlers(mux *http.ServeMux, tmpls *templates, storeInst store.Stor
 						endpoints = append(endpoints, map[string]any{
 							"Name":     ep.Name,
 							"Path":     apiPath,
-							"Params":   params,
-							"Response": response,
+							"Params":   template.HTML(params),
+							"Response": template.HTML(response),
 						})
 					}
 					anchor := strings.ReplaceAll(s.Name, ".", "-")
@@ -1227,7 +1238,7 @@ Use the token printed at startup, or generate more on the <a href='/auth/tokens'
 
 	// Auth routes - only registered when auth is enabled
 	if authEnabled {
-		authMw := authRequired(storeInst)
+		authMw := adminRequired(storeInst)
 
 		// loadEndpointScopes returns all stored endpoint scopes from the store
 		loadEndpointScopes := func() map[string][]string {
@@ -1489,6 +1500,10 @@ Use the token printed at startup, or generate more on the <a href='/auth/tokens'
 			_ = renderPage(w, tmpls.authUsers, map[string]any{"Title": "Users", "Users": users, "User": user})
 		}))
 		mux.HandleFunc("/auth/login", func(w http.ResponseWriter, r *h
```

**File**: `cmd/micro/mcp/mcp.go` (modified, +11/-4)
```diff
@@ -72,6 +72,12 @@ Examples:
   # Custom registry
   micro mcp serve --registry consul --registry_address consul:8500`,
 				Flags: []cli.Flag{
+					&cli.StringSliceFlag{
+						Name:    "mcp-allowed-origins",
+						Usage:   "Exact trusted browser origins for MCP (repeatable)",
+						EnvVars: []string{"MICRO_MCP_ALLOWED_ORIGINS"},
+					},
+
 					&cli.StringFlag{
 						Name:  "address",
 						Usage: "HTTP address to listen on (e.g., :3000). If not set, uses stdio.",
@@ -249,10 +255,11 @@ func serveAction(ctx *cli.Context) error {
 
 	// Create MCP server options
 	opts := mcp.Options{
-		Registry: reg,
-		Address:  ctx.String("address"),
-		Context:  context.Background(),
-		Logger:   log.Default(),
+		AllowedOrigins: ctx.StringSlice("mcp-allowed-origins"),
+		Registry:       reg,
+		Address:        ctx.String("address"),
+		Context:        context.Background(),
+		Logger:         log.Default(),
 	}
 
 	// Opt-in x402 payments: a config file (per-tool amounts) or flags.
```

**File**: `cmd/micro/run/run.go` (modified, +10/-4)
```diff
@@ -544,10 +544,11 @@ func Run(c *cli.Context) error {
 // limiting, scopes, x402) stay on the standalone `micro gateway` command.
 func buildRunMCPOptions(c *cli.Context, addr string) (mcp.Options, error) {
 	return mcp.Options{
-		Registry: registry.DefaultRegistry,
-		Address:  addr,
-		Context:  context.Background(),
-		Logger:   log.Default(),
+		AllowedOrigins: c.StringSlice("mcp-allowed-origins"),
+		Registry:       registry.DefaultRegistry,
+		Address:        addr,
+		Context:        context.Background(),
+		Logger:         log.Default(),
 	}, nil
 }
 
@@ -838,6 +839,11 @@ Examples:
 				Usage:   "Environment to use (default: development)",
 				EnvVars: []string{"MICRO_ENV"},
 			},
+			&cli.StringSliceFlag{
+				Name:    "mcp-allowed-origins",
+				Usage:   "Exact trusted browser origins for MCP (repeatable)",
+				EnvVars: []string{"MICRO_MCP_ALLOWED_ORIGINS"},
+			},
 			&cli.StringFlag{
 				Name:    "mcp-address",
 				Usage:   "MCP gateway address (e.g., :3000). Enables MCP protocol for AI tools.",
```

---

### Incident Patch 3: `5f29b487` (2026-09-21)
**Commit Message**: fix(model): preserve Groq/OpenAI options and follow-up errors (#4953)

* fix(model): preserve chat request options and tool follow-up errors

* docs: update Groq default and OpenAI endpoint examples

**File**: `README.md` (modified, +1/-1)
```diff
@@ -386,7 +386,7 @@ Swap providers with a single import — same interface everywhere:
 | Anthropic | `claude-sonnet-4-20250514` |
 | OpenAI | `gpt-4o` |
 | Google Gemini | `gemini-2.5-flash` |
-| Groq | `llama-3.3-70b-versatile` |
+| Groq | `openai/gpt-oss-120b` |
 | Mistral | `mistral-large-latest` |
 | Together AI | `meta-llama/Llama-3.3-70B-Instruct-Turbo` |
 | Atlas Cloud | `deepseek-ai/DeepSeek-V3-0324` |
```

**File**: `model/README.md` (modified, +3/-3)
```diff
@@ -228,7 +228,7 @@ m := model.New("openai",
 ```
 
 Default model: `gpt-4o`
-Default base URL: `https://api.openmodel.com`
+Default base URL: `https://api.openai.com`
 
 ### Google Gemini
 
@@ -249,11 +249,11 @@ Google Gemini uses its own API format with `system_instruction`, `contents` (not
 ```go
 m := model.New("groq",
     model.WithAPIKey("your-key"),
-    model.WithModel("llama-3.3-70b-versatile"), // default
+    model.WithModel("openai/gpt-oss-120b"), // default
 )
 ```
 
-Default model: `llama-3.3-70b-versatile`
+Default model: `openai/gpt-oss-120b`
 Default base URL: `https://api.groq.com/openai`
 
 Groq provides ultra-fast inference for open-weight models via an OpenAI-compatible endpoint.
```

**File**: `model/groq/groq.go` (modified, +6/-36)
```diff
@@ -40,7 +40,7 @@ type Provider struct {
 func NewProvider(opts ...model.Option) *Provider {
 	options := model.NewOptions(opts...)
 	if options.Model == "" {
-		options.Model = "llama-3.3-70b-versatile"
+		options.Model = "openai/gpt-oss-120b"
 	}
 	if options.BaseURL == "" {
 		options.BaseURL = "https://api.groq.com/openai"
@@ -59,33 +59,8 @@ func (p *Provider) Options() model.Options { return p.opts }
 func (p *Provider) String() string         { return "groq" }
 
 func (p *Provider) Generate(ctx context.Context, req *model.Request, opts ...model.GenerateOption) (*model.Response, error) {
-	var tools []map[string]any
-	for _, t := range req.Tools {
-		tools = append(tools, map[string]any{
-			"type": "function",
-			"function": map[string]any{
-				"name":        t.Name,
-				"description": t.Description,
-				"parameters": map[string]any{
-					"type":       "object",
-					"properties": t.Properties,
-				},
-			},
-		})
-	}
-
-	messages := []map[string]any{
-		{"role": "system", "content": req.SystemPrompt},
-		{"role": "user", "content": req.Prompt},
-	}
-
-	apiReq := map[string]any{
-		"model":    p.opts.Model,
-		"messages": messages,
-	}
-	if len(tools) > 0 {
-		apiReq["tools"] = tools
-	}
+	messages := openaiapi.Messages(req)
+	apiReq := openaiapi.Request(p.opts, messages, req.Tools)
 
 	resp, rawMessage, err := p.callAPI(ctx, apiReq)
 	if err != nil {
@@ -122,17 +97,11 @@ func (p *Provider) Generate(ctx context.Context, req *model.Request, opts ...mod
 				})
 			}
 
-			followUpReq := map[string]any{
-				"model":    p.opts.Model,
-				"messages": followUpMessages,
-			}
-			if len(tools) > 0 {
-				followUpReq["tools"] = tools
-			}
+			followUpReq := openaiapi.Request(p.opts, followUpMessages, req.Tools)
 
 			followUpResp, followUpRaw, err := p.callAPI(ctx, followUpReq)
 			if err != nil {
-				break
+				return nil, fmt.Errorf("tool follow-up: %w", err)
 			}
 			if followUpResp.Reply != "" {
 				resp.Answer = followUpResp.Reply
@@ -187,6 +156,7 @@ func (p *Provider) callAPI(ctx context.Context, req map[string]any) (*model.Resp
 				Content   string `json:"content"`
 				ToolCalls []struct {
 					ID       string `json:"id"`
+					Type     string `json:"type"`
 					Function struct {
 						Name      string `json:"name"`
 						Arguments string `json:"arguments"`
```

**File**: `model/groq/groq_test.go` (modified, +1/-1)
```diff
@@ -20,7 +20,7 @@ func TestProvider_String(t *testing.T) {
 
 func TestProvider_Defaults(t *testing.T) {
 	opts := NewProvider().Options()
-	if opts.Model != "llama-3.3-70b-versatile" {
+	if opts.Model != "openai/gpt-oss-120b" {
 		t.Errorf("default model = %q", opts.Model)
 	}
 	if opts.BaseURL != "https://api.groq.com/openai" {
```

**File**: `model/internal/openaiapi/request.go` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+package openaiapi
+
+import "go-micro.dev/v6/model"
+
+// Messages builds the shared chat history for Generate and Stream requests.
+func Messages(req *model.Request) []map[string]any {
+	messages := []map[string]any{{"role": "system", "content": req.SystemPrompt}}
+	for _, message := range req.Messages {
+		messages = append(messages, map[string]any{"role": message.Role, "content": message.Content})
+	}
+	if req.Prompt != "" {
+		messages = append(messages, map[string]any{"role": "user", "content": req.Prompt})
+	}
+	return messages
+}
+
+// Request preserves provider options on initial and follow-up chat requests.
+// Pass nil tools for text-only streams, which do not execute tool calls.
+func Request(opts model.Options, messages []map[string]any, tools []model.Tool) map[string]any {
+	request := map[string]any{"model": opts.Model, "messages": messages}
+	if opts.MaxTokens > 0 {
+		request["max_tokens"] = opts.MaxTokens
+	}
+	if opts.Effort != "" {
+		request["reasoning_effort"] = opts.Effort
+	}
+	if len(tools) > 0 {
+		definitions := make([]map[string]any, 0, len(tools))
+		for _, tool := range tools {
+			definitions = append(definitions, map[string]any{"type": "function", "function": map[string]any{"name": tool.Name, "description": tool.Description, "parameters": map[string]any{"type": "object", "properties": tool.Properties}}})
+		}
+		request["tools"] = definitions
+	}
+	return request
+}
```

---

### Incident Patch 4: `a3f567bf` (2026-09-21)
**Commit Message**: fix(agent): recover timeout and rate-limited runs (#4952)

* fix(agent): resume timeout and rate-limited runs from checkpoints

* docs: align pending run contract with transient recovery

**File**: `agent/checkpoint.go` (modified, +3/-2)
```diff
@@ -90,7 +90,8 @@ func (a *agentImpl) ResumeInput(ctx context.Context, runID, input string) (*Resp
 
 // Resume returns the response for a checkpointed agent run. Completed runs are
 // returned from the checkpoint without calling the model or replaying tool
-// calls; failed or in-progress runs continue from the saved input message.
+// calls; failed, interrupted (timeout/rate_limited), or in-progress runs
+// continue from the saved input message and reuse completed tool results.
 func Resume(ctx context.Context, ag Agent, runID string) (*Response, error) {
 	a, ok := ag.(Resumer)
 	if !ok {
@@ -201,7 +202,7 @@ func (a *agentImpl) pending(ctx context.Context) ([]flow.Run, error) {
 
 func terminalAgentRunStatus(status string) bool {
 	switch status {
-	case "done", "canceled", "timeout", "rate_limited", "expired":
+	case "done", "canceled", "expired":
 		return true
 	default:
 		return false
```

**File**: `agent/resilience_test.go` (modified, +7/-3)
```diff
@@ -289,7 +289,7 @@ func TestSlowProviderTimeoutPreventsLateToolSideEffects(t *testing.T) {
 	}
 }
 
-func TestAskCheckpointRecordsTerminalOperationalFailureStatus(t *testing.T) {
+func TestAskCheckpointRecordsOperationalFailureStatus(t *testing.T) {
 	tests := []struct {
 		name string
 		err  error
@@ -333,8 +333,12 @@ func TestAskCheckpointRecordsTerminalOperationalFailureStatus(t *testing.T) {
 			if got := runs[0].Steps[0].ErrorKind; got != string(model.ClassifyError(tt.err)) {
 				t.Fatalf("step error kind = %q, want %q", got, model.ClassifyError(tt.err))
 			}
-			if pending, err := Pending(context.Background(), a); err != nil || len(pending) != 0 {
-				t.Fatalf("Pending = %#v, %v; want no terminal run", pending, err)
+			wantPending := 1
+			if tt.want == "canceled" {
+				wantPending = 0
+			}
+			if pending, err := Pending(context.Background(), a); err != nil || len(pending) != wantPending {
+				t.Fatalf("Pending = %#v, %v; want %d runs", pending, err, wantPending)
 			}
 		})
 	}
```

**File**: `agent/run_errors_test.go` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ func TestTypedRunErrors(t *testing.T) {
 	ctx := context.Background()
 	cp := flow.StoreCheckpoint(store.NewMemoryStore(), "typed-errors")
 	a := newTestAgent(Name("typed-errors"), WithCheckpoint(cp))
-	for _, status := range []string{"timeout", "canceled", "rate_limited", "expired"} {
+	for _, status := range []string{"canceled", "expired"} {
 		if err := cp.Save(ctx, flow.Run{ID: status, Status: status}); err != nil {
 			t.Fatal(err)
 		}
```

**File**: `agent/transient_resume_test.go` (added, +110/-0)
```diff
@@ -0,0 +1,110 @@
+package agent
+
+import (
+	"context"
+	"encoding/json"
+	"io"
+	"testing"
+
+	"go-micro.dev/v6/flow"
+	"go-micro.dev/v6/model"
+	"go-micro.dev/v6/store"
+)
+
+func TestResumeTransientFailureAfterRestart(t *testing.T) {
+	for _, failure := range []struct {
+		name string
+		err  error
+	}{
+		{"timeout", context.DeadlineExceeded}, {"rate_limited", testStatusError{code: 429}},
+	} {
+		for _, mode := range []string{"resume", "stream", "pending"} {
+			t.Run(failure.name+"/"+mode, func(t *testing.T) {
+				ctx := context.Background()
+				st := store.NewMemoryStore()
+				cp := flow.StoreCheckpoint(st, "recovery")
+				modelCalls, toolCalls := 0, 0
+				fakeGen = func(ctx context.Context, opts model.Options, req *model.Request) (*model.Response, error) {
+					modelCalls++
+					if req.Prompt != "charge once" {
+						t.Fatalf("lost original request: %q", req.Prompt)
+					}
+					result := opts.ToolHandler(ctx, model.ToolCall{ID: "charge", Name: "charge", Input: map[string]any{"order": "42"}})
+					if result.Content != "paid" {
+						t.Fatalf("lost tool result: %+v", result)
+					}
+					if modelCalls == 1 {
+						return nil, failure.err
+					}
+					return &model.Response{Reply: "recovered"}, nil
+				}
+				defer func() { fakeGen = nil }()
+				makeAgent := func() *agentImpl {
+					return newTestAgent(Name("recovery"), WithStore(st), WithCheckpoint(cp), WithTool("charge", "charge", nil, func(context.Context, map[string]any) (string, error) { toolCalls++; return "paid", nil }))
+				}
+				original := makeAgent()
+				if _, err := original.Ask(ctx, "charge once"); err == nil {
+					t.Fatal("expected provider failure")
+				}
+				runs, err := Pending(ctx, original)
+				if err != nil || len(runs) != 1 || runs[0].Status != failure.name {
+					t.Fatalf("pending: %+v %v", runs, err)
+				}
+				id := runs[0].ID
+				restarted := makeAgent()
+				var response *Response
+				switch mode {
+				case "resume":
+					response, err = Resume(ctx, restarted, id)
+				case "pending":
+					var failedID string
+					failedID, err = ResumePending(ctx, restarted)
+					if failedID != "" {
+						t.Fatalf("failed run: %s", failedID)
+					}
+					if err == nil {
+						run, _, loadErr := cp.Load(ctx, id)
+						if loadErr != nil {
+							t.Fatal(loadErr)
+						}
+						response = new(Response)
+						err = json.Unmarshal(run.State.Data, response)
+					}
+				case "stream":
+					var stream AgentStream
+					stream, err = ResumeStreamAsk(ctx, restarted, id)
+					if err != nil {
+						t.Fatal(err)
+					}
+					defer stream.Close()
+					for {
+						event, recvErr := stream.Recv()
+						if recvErr == io.EOF {
+							break
+						}
+						if recvErr != nil {
+							err = recvErr
+							break
+						}
+						if event.Type == StreamEventDone {
+							response = event.Response
+						}
+					}
+				}
+				if err != nil {
+					t.Fatal(err)
+				}
+				if response == nil || response.RunID != id || response.Reply != "recovered" {
+					t.Fatalf("response: %+v", response)
+				}
+				if toolCalls != 1 || modelCalls != 2 {
+					t.Fatalf("tool calls=%d, model calls=%d", toolCalls, modelCalls)
+				}
+				run, ok, err := cp.Load(ctx, id)
+				if err != nil || !ok || run.Status != "done" {
+					t.Fatalf("final checkpoint: %+v %v", run, err)
+				}
+			})
+		}
+	}
+}
```

**File**: `internal/website/content/en/docs/guides/debugging-agents.md` (modified, +23/-0)
```diff
@@ -263,3 +263,26 @@ micro call <service> <Handler.Method> '{}'
 
 Redact secrets and user data. If you enabled `agent.TraceInputs(true)`, inspect the
 JSON before sharing it because prompts may be present.
+
+### Recovering interrupted runs
+
+With `agent.WithCheckpoint(...)`, provider `timeout` and `rate_limited` outcomes
+remain discoverable through `agent.Pending` and can be continued with
+`agent.Resume(ctx, ag, runID)`, `agent.ResumeStreamAsk`, or `agent.ResumePending`.
+Use a fresh context after a deadline and wait for the provider's rate-limit
+window before retrying. Recovery keeps the run ID and saved request and reuses
+completed tool results, including after recreating the agent with the same
+checkpoint store. Canceled and expired runs remain terminal. An interrupted
+side effect without a saved result can still be retried: use idempotency keys
+for such tools; checkpointing is not an exactly-once guarantee.
+
+The defaults remain 30 seconds per model call and 30 seconds per tool call.
+For slower models or multi-tool turns, configure the budgets explicitly:
+
+```go
+agent.ModelCallTimeout(120 * time.Second)
+agent.ToolCallTimeout(60 * time.Second)
+```
+
+The caller's context and RPC request deadline must also allow the whole turn to
+finish. Increasing a per-call timeout cannot extend an earlier caller deadline.
```

---

### Incident Patch 5: `f9396033` (2026-09-21)
**Commit Message**: fix(natsjs): prevent durable consumers from skipping history (#4943)

* fix(natsjs): make durable consumption safe by default

* fix(natsjs): preserve existing durable delivery policy (#4946)

Co-authored-by: Codex <codex@openai.com>

---------

Co-authored-by: Codex <codex@openai.com>

**File**: `events/natsjs/README.md` (modified, +7/-0)
```diff
@@ -13,6 +13,13 @@ ev, err := natsjs.NewStream(
 
 ## Consume a stream
 
+Durable streams require an explicit consumer group. A newly created durable
+consumer starts at the beginning of the stream and resumes from its persisted
+position on later connections. Use `events.WithOffset` to choose a different
+starting time when the durable consumer is first created. When durable streams
+are disabled, consumers are ephemeral and receive only newly published events
+by default.
+
 ```go
 ee, err := events.Consume("test",
   events.WithAutoAck(false, time.Second*30),
```

**File**: `events/natsjs/nats.go` (modified, +36/-13)
```diff
@@ -163,13 +163,16 @@ func (s *stream) Consume(topic string, opts ...events.ConsumeOption) (<-chan eve
 	log := s.opts.Logger
 
 	// parse the options
-	options := events.ConsumeOptions{
-		Group:   uuid.New().String(),
-		AutoAck: true,
-	}
+	options := events.ConsumeOptions{AutoAck: true}
 	for _, o := range opts {
 		o(&options)
 	}
+	if !s.opts.DisableDurableStreams && options.Group == "" {
+		return nil, fmt.Errorf("consumer group is required when durable streams are enabled")
+	}
+	if s.opts.DisableDurableStreams && options.Group == "" {
+		options.Group = uuid.New().String()
+	}
 
 	// setup the subscriber
 	channel := make(chan events.Event)
@@ -229,16 +232,32 @@ func (s *stream) Consume(topic string, opts ...events.ConsumeOption) (<-chan eve
 		subOpts = append(subOpts, nats.MaxDeliver(options.GetRetryLimit()))
 	}
 
-	if options.AutoAck {
-		subOpts = append(subOpts, nats.AckAll())
-	} else {
-		subOpts = append(subOpts, nats.AckExplicit())
+	consumerExists := false
+	if !s.opts.DisableDurableStreams {
+		_, err = s.natsJetStreamCtx.ConsumerInfo(topic, options.Group)
+		switch {
+		case err == nil:
+			consumerExists = true
+		case errors.Is(err, nats.ErrConsumerNotFound):
+			// The delivery policy below is used only when creating the durable.
+		default:
+			return nil, errors.Wrap(err, "Error checking durable consumer")
+		}
 	}
 
-	if !options.Offset.IsZero() {
-		subOpts = append(subOpts, nats.StartTime(options.Offset))
-	} else {
-		subOpts = append(subOpts, nats.DeliverNew())
+	// Delivery policies are immutable, so do not specify one when binding to an
+	// existing durable. This also keeps consumers created by older versions with
+	// DeliverNew compatible after upgrading.
+	if !consumerExists {
+		// Ack each event independently. Existing durables retain their policy.
+		subOpts = append(subOpts, nats.AckExplicit())
+		if !options.Offset.IsZero() {
+			subOpts = append(subOpts, nats.StartTime(options.Offset))
+		} else if !s.opts.DisableDurableStreams {
+			subOpts = append(subOpts, nats.DeliverAll())
+		} else {
+			subOpts = append(subOpts, nats.DeliverNew())
+		}
 	}
 
 	if options.AckWait > 0 {
@@ -247,7 +266,11 @@ func (s *stream) Consume(topic string, opts ...events.ConsumeOption) (<-chan eve
 
 	// connect the subscriber via a queue group only if durable streams are enabled
 	if !s.opts.DisableDurableStreams {
-		subOpts = append(subOpts, nats.Durable(options.Group))
+		if consumerExists {
+			subOpts = append(subOpts, nats.Bind(topic, options.Group))
+		} else {
+			subOpts = append(subOpts, nats.Durable(options.Group))
+		}
 		_, err = s.natsJetStreamCtx.QueueSubscribe(topic, options.Group, handleMsg, subOpts...)
 	} else {
 		subOpts = append(subOpts, nats.ConsumerName(options.Group))
```

**File**: `events/natsjs/nats_test.go` (modified, +125/-1)
```diff
@@ -9,6 +9,7 @@ import (
 	"time"
 
 	nserver "github.com/nats-io/nats-server/v2/server"
+	nats "github.com/nats-io/nats.go"
 	"github.com/stretchr/testify/assert"
 	"github.com/test-go/testify/require"
 	"go-micro.dev/v6/events"
@@ -64,7 +65,7 @@ func TestSingleEvent(t *testing.T) {
 		t.Helper()
 		defer cancel()
 
-		foobarEvents, err := client.Consume(topic)
+		foobarEvents, err := client.Consume(topic, events.WithGroup("foobar-consumer"))
 		require.Nil(t, err)
 		if err != nil {
 			return
@@ -110,3 +111,126 @@ func TestSingleEvent(t *testing.T) {
 	// wait until consumer received the event
 	<-ctx.Done()
 }
+
+func TestConsumeRequiresGroupForDurableStreams(t *testing.T) {
+	ctx, cancel := context.WithCancel(context.Background())
+	defer cancel()
+
+	clusterName := "group-test-cluster"
+	natsAddr := getFreeLocalhostAddress()
+	natsPort, _ := strconv.Atoi(strings.Split(natsAddr, ":")[1])
+	go natsServer(ctx, t, &nserver.Options{
+		Host: strings.Split(natsAddr, ":")[0],
+		Port: natsPort,
+		Cluster: nserver.ClusterOpts{
+			Name: clusterName,
+		},
+	})
+	time.Sleep(time.Second)
+
+	client, err := natsjs.NewStream(natsjs.Address(natsAddr), natsjs.ClusterID(clusterName))
+	require.NoError(t, err)
+
+	_, err = client.Consume("requires-group")
+	require.EqualError(t, err, "consumer group is required when durable streams are enabled")
+}
+
+func TestNewDurableConsumerReceivesStreamHistory(t *testing.T) {
+	ctx, cancel := context.WithCancel(context.Background())
+	defer cancel()
+
+	clusterName := "history-test-cluster"
+	natsAddr := getFreeLocalhostAddress()
+	natsPort, _ := strconv.Atoi(strings.Split(natsAddr, ":")[1])
+	go natsServer(ctx, t, &nserver.Options{
+		Host: strings.Split(natsAddr, ":")[0],
+		Port: natsPort,
+		Cluster: nserver.ClusterOpts{
+			Name: clusterName,
+		},
+	})
+	time.Sleep(time.Second)
+
+	client, err := natsjs.NewStream(
+		natsjs.Address(natsAddr),
+		natsjs.ClusterID(clusterName),
+		natsjs.SynchronousPublish(true),
+	)
+	require.NoError(t, err)
+
+	// Establish the stream before publishing the event. The first consumer can
+	// receive it, but the limits retention policy keeps it available for replay.
+	_, err = client.Consume("history", events.WithGroup("stream-creator"))
+	require.NoError(t, err)
+	require.NoError(t, client.Publish("history", []byte("before-subscribe")))
+
+	history, err := client.Consume("history", events.WithGroup("history-reader"))
+	require.NoError(t, err)
+
+	select {
+	case event := <-history:
+		require.Equal(t, []byte("before-subscribe"), event.Payload)
+	case <-time.After(5 * time.Second):
+		t.Fatal("timed out waiting for historical event")
+	}
+}
+
+func TestExistingDeliverNewDurableCanReconnect(t *testing.T) {
+	for _, policy := range []nats.AckPolicy{nats.AckExplicitPolicy, nats.AckAllPolicy} {
+		t.Run(policy.String(), func(t *testing.T) { testExistingDurable(t, policy) })
+	}
+}
+
+func testExistingDurable(t *testing.T, policy nats.AckPolicy) {
+	ctx, cancel := context.WithCancel(context.Background())
+	defer cancel()
+
+	clusterName := "existing-durable-test-cluster"
+	natsAddr := getFreeLocalhostAddress()
+	natsPort, _ := strconv.Atoi(strings.Split(natsAddr, ":")[1])
+	go natsServer(ctx, t, &nserver.Options{
+		Host: strings.Split(natsAddr, ":")[0],
+		Port: natsPort,
+		Cluster: nserver.ClusterOpts{
+			Name: clusterName,
+		},
+	})
+	time.Sleep(time.Second)
+
+	conn, err := nats.Connect(natsAddr)
+	require.NoError(t, err)
+	defer conn.Close()
+	js, err := conn.JetStream()
+	require.NoError(t, err)
+	_, err = js.AddStream(&nats.StreamConfig{Name: "existing-durable"})
+	require.NoError(t, err)
+
+	// Simulate the durable configuration created by versions that defaulted to
+	// DeliverNew. It must remain usable after the new DeliverAll default.
+	_, err = js.AddConsumer("existing-durable", &nats.ConsumerConfig{
+		Durable:        "existing-reader",
+		DeliverSubject: nats.NewInbox(),
+		DeliverGroup:   "existing-reader",
+		DeliverPolicy:  nats.DeliverNewPolic
```

---

### Incident Patch 6: `2de8880c` (2026-09-21)
**Commit Message**: fix(agent): keep delegated tools within the parent service scope (#4950)

* fix(agent): constrain delegated service visibility

* Preserve independent registered-agent delegation while scoping ephemeral tools

**File**: `agent/agent.go` (modified, +1/-1)
```diff
@@ -724,7 +724,7 @@ func (a *agentImpl) discoverTools() ([]model.Tool, error) {
 		if strings.HasPrefix(t.OriginalName, a.opts.Name+".") {
 			continue
 		}
-		if len(a.opts.Services) == 0 {
+		if a.opts.Services == nil {
 			scoped = append(scoped, t)
 			continue
 		}
```

**File**: `agent/builtin.go` (modified, +24/-4)
```diff
@@ -689,6 +689,22 @@ func (a *agentImpl) handleDelegate(ctx context.Context, call model.ToolCall) (re
 		return errResult(call.ID, "task is required")
 	}
 	to, _ := input["to"].(string)
+	// Services scopes local tool discovery. Registered and A2A agents have
+	// their own tool policy; preserve the existing remote delegation path.
+	remoteURL := strings.HasPrefix(to, "http://") || strings.HasPrefix(to, "https://")
+	registeredAgent := to != "" && !remoteURL && a.isAgent(to)
+	if to != "" && !remoteURL && !registeredAgent && a.opts.Services != nil {
+		allowed := false
+		for _, service := range a.opts.Services {
+			if service == to {
+				allowed = true
+				break
+			}
+		}
+		if !allowed {
+			return errResult(call.ID, "delegate target is outside the agent's service scope: "+to)
+		}
+	}
 	if cached, ok := a.cachedDelegateResult(call.ID, to, task); ok {
 		return cached
 	}
@@ -700,7 +716,7 @@ func (a *agentImpl) handleDelegate(ctx context.Context, call model.ToolCall) (re
 	defer func() { a.finishDelegateCall(key, res) }()
 
 	// An external agent on another framework, addressed by A2A URL.
-	if strings.HasPrefix(to, "http://") || strings.HasPrefix(to, "https://") {
+	if remoteURL {
 		reply, err := a2a.NewClient(to).Send(ctx, task)
 		if err != nil {
 			return errResult(call.ID, "delegate to A2A agent "+to+": "+err.Error())
@@ -709,7 +725,7 @@ func (a *agentImpl) handleDelegate(ctx context.Context, call model.ToolCall) (re
 	}
 
 	// Delegate-first: an existing agent that owns the domain handles it.
-	if to != "" && a.isAgent(to) {
+	if registeredAgent {
 		reply, err := a.callAgentRPC(ctx, to, task)
 		if err != nil {
 			return errResult(call.ID, "delegate to agent "+to+": "+err.Error())
@@ -719,13 +735,17 @@ func (a *agentImpl) handleDelegate(ctx context.Context, call model.ToolCall) (re
 
 	// Otherwise create a focused, ephemeral sub-agent. Fresh context:
 	// it loads no history and persists none.
-	var svcs []string
+	svcs := a.opts.Services
 	if to != "" {
 		svcs = []string{to}
 	}
 	sub := newEphemeral(
 		Name(a.opts.Name+".sub"),
-		Services(svcs...),
+		func(o *Options) {
+			if svcs != nil {
+				o.Services = append([]string{}, svcs...)
+			}
+		},
 		Prompt("You are a sub-agent handling a single delegated subtask. "+
 			"Complete it using the available tools and report the result concisely."),
 		Provider(a.opts.Provider),
```

**File**: `agent/delegate_scope_test.go` (added, +58/-0)
```diff
@@ -0,0 +1,58 @@
+package agent
+
+import (
+	"context"
+	"strings"
+	"testing"
+
+	"go-micro.dev/v6/model"
+	"go-micro.dev/v6/registry"
+)
+
+func TestDelegateServiceScope(t *testing.T) {
+	reg := registry.NewMemoryRegistry()
+	for _, name := range []string{"allowed", "private"} {
+		if err := reg.Register(&registry.Service{Name: name, Version: "1", Nodes: []*registry.Node{{Id: name, Address: "127.0.0.1:1"}}, Endpoints: []*registry.Endpoint{{Name: "Service.Read"}}}); err != nil {
+			t.Fatal(err)
+		}
+	}
+	for _, tc := range []struct {
+		name  string
+		opts  []Option
+		count int
+	}{
+		{"unrestricted", nil, 2},
+		{"restricted", []Option{Services("allowed")}, 1},
+		{"explicit empty", []Option{Services()}, 0},
+	} {
+		t.Run(tc.name, func(t *testing.T) {
+			calls := 0
+			fakeGen = func(ctx context.Context, opts model.Options, req *model.Request) (*model.Response, error) {
+				calls++
+				if len(req.Tools) != tc.count {
+					t.Errorf("sub-agent tools = %v, want %d", req.Tools, tc.count)
+				}
+				if tc.count == 1 && !strings.HasPrefix(req.Tools[0].OriginalName, "allowed.") {
+					t.Errorf("unexpected tool: %v", req.Tools[0])
+				}
+				return &model.Response{Reply: "done"}, nil
+			}
+			defer func() { fakeGen = nil }()
+			a := newTestAgent(append([]Option{Name("parent"), WithRegistry(reg)}, tc.opts...)...)
+			res := a.handleDelegate(context.Background(), model.ToolCall{ID: "delegate", Input: map[string]any{"task": "read"}})
+			if calls != 1 {
+				t.Fatalf("model calls = %d; result: %+v", calls, res)
+			}
+		})
+	}
+}
+
+func TestDelegateRejectsOutOfScopeTarget(t *testing.T) {
+	a := newTestAgent(Services("allowed"))
+	for _, target := range []string{"private"} {
+		res := a.handleDelegate(context.Background(), model.ToolCall{ID: target, Input: map[string]any{"task": "read", "to": target}})
+		if !strings.Contains(res.Content, "outside the agent's service scope") {
+			t.Fatalf("target %q was not refused: %+v", target, res)
+		}
+	}
+}
```

**File**: `agent/integration_test.go` (modified, +1/-1)
```diff
@@ -187,7 +187,7 @@ func TestDelegateToRegisteredAgent(t *testing.T) {
 	}
 	defer func() { fakeGen = nil }()
 
-	a := newTestAgent(Name("root"), WithRegistry(reg), WithClient(fc))
+	a := newTestAgent(Name("root"), Services("task"), WithRegistry(reg), WithClient(fc))
 	content := a.handleDelegate(context.Background(), model.ToolCall{Name: "delegate", Input: map[string]any{"task": "notify alice", "to": "comms"}}).Content
 
 	if calledService != "comms" || calledEndpoint != "Agent.Chat" {
```

**File**: `agent/options.go` (modified, +3/-2)
```diff
@@ -162,9 +162,10 @@ func Name(n string) Option {
 	return func(o *Options) { o.Name = n }
 }
 
-// Services sets which services this agent manages.
+// Services restricts which services this agent manages. Calling Services()
+// permits no discovered services; omitting this option permits all services.
 func Services(names ...string) Option {
-	return func(o *Options) { o.Services = names }
+	return func(o *Options) { o.Services = append([]string{}, names...) }
 }
 
 // Prompt sets the system prompt.
```

---

### Incident Patch 7: `59036ff8` (2026-09-21)
**Commit Message**: fix(natsjs): honor manual event acknowledgements (#4948)

**File**: `events/natsjs/README.md` (modified, +11/-0)
```diff
@@ -46,3 +46,14 @@ if err != nil {
 }
 ```
 
+
+## Acknowledgements
+
+Automatic acknowledgement on delivery is the default. Use `events.WithAutoAck(false, ackWait)`
+and call `event.Ack()` after processing succeeds, or `event.Nack()` to request
+redelivery after a failure. Unacknowledged events are redelivered after `ackWait`.
+
+With `events.WithAutoAck(true, ackWait)`, events are acknowledged when received
+from the channel, **before application processing completes**. A subsequent
+processing failure can lose the event; use manual acknowledgements when
+processing must succeed before delivery is confirmed.
```

**File**: `events/natsjs/ack_test.go` (added, +77/-0)
```diff
@@ -0,0 +1,77 @@
+package natsjs_test
+
+import (
+	"testing"
+	"time"
+
+	nserver "github.com/nats-io/nats-server/v2/server"
+	nats "github.com/nats-io/nats.go"
+	"github.com/stretchr/testify/require"
+	"go-micro.dev/v6/events"
+	"go-micro.dev/v6/events/natsjs"
+)
+
+func TestAcknowledgements(t *testing.T) {
+	for _, manual := range []bool{true, false} {
+		name := "automatic default"
+		if manual {
+			name = "manual"
+		}
+		t.Run(name, func(t *testing.T) {
+			testAcknowledgements(t, manual)
+		})
+	}
+}
+
+func testAcknowledgements(t *testing.T, manual bool) {
+	srv, err := nserver.NewServer(&nserver.Options{Host: "127.0.0.1", Port: -1, JetStream: true, StoreDir: t.TempDir()})
+	require.NoError(t, err)
+	go srv.Start()
+	require.True(t, srv.ReadyForConnections(5*time.Second))
+	t.Cleanup(func() { srv.Shutdown(); srv.WaitForShutdown() })
+	conn, err := nats.Connect(srv.ClientURL())
+	require.NoError(t, err)
+	t.Cleanup(conn.Close)
+	js, err := conn.JetStream()
+	require.NoError(t, err)
+	client, err := natsjs.NewStream(natsjs.Address(srv.ClientURL()), natsjs.SynchronousPublish(true))
+	require.NoError(t, err)
+	t.Cleanup(func() { require.NoError(t, client.(interface{ Close() error }).Close()) })
+	options := []events.ConsumeOption{events.WithGroup("worker")}
+	if manual {
+		options = append(options, events.WithAutoAck(false, 200*time.Millisecond))
+	}
+	ch, err := client.Consume("manual", options...)
+	require.NoError(t, err)
+	require.NoError(t, client.Publish("manual", []byte("payload")))
+	receive := func() events.Event {
+		t.Helper()
+		select {
+		case event := <-ch:
+			return event
+		case <-time.After(5 * time.Second):
+			t.Fatal("expected event delivery")
+			return events.Event{}
+		}
+	}
+	first := receive()
+	_ = first
+	if manual {
+		// Returning from the delivery callback must not implicitly acknowledge.
+		second := receive()
+		require.Equal(t, first.ID, second.ID)
+		require.NoError(t, second.Nack())
+		third := receive()
+		require.Equal(t, first.ID, third.ID)
+		require.NoError(t, third.Ack())
+	}
+	require.Eventually(t, func() bool {
+		info, err := js.ConsumerInfo("manual", "worker")
+		return err == nil && info.NumAckPending == 0 && info.AckFloor.Stream == 1
+	}, 5*time.Second, 10*time.Millisecond)
+	select {
+	case <-ch:
+		t.Fatal("acknowledged event was redelivered")
+	case <-time.After(400 * time.Millisecond):
+	}
+}
```

**File**: `events/natsjs/nats.go` (modified, +8/-20)
```diff
@@ -164,7 +164,8 @@ func (s *stream) Consume(topic string, opts ...events.ConsumeOption) (<-chan eve
 
 	// parse the options
 	options := events.ConsumeOptions{
-		Group: uuid.New().String(),
+		Group:   uuid.New().String(),
+		AutoAck: true,
 	}
 	for _, o := range opts {
 		o(&options)
@@ -183,24 +184,9 @@ func (s *stream) Consume(topic string, opts ...events.ConsumeOption) (<-chan eve
 			// not acknowledging the message is the way to indicate an error occurred
 			return
 		}
-		if options.AutoAck {
-			// set up the ack funcs
-			evt.SetAckFunc(func() error {
-				return msg.Ack()
-			})
-
-			evt.SetNackFunc(func() error {
-				return msg.Nak()
-			})
-		} else {
-			// set up the ack funcs
-			evt.SetAckFunc(func() error {
-				return nil
-			})
-			evt.SetNackFunc(func() error {
-				return nil
-			})
-		}
+		// Manual acknowledgements must reach JetStream regardless of AutoAck.
+		evt.SetAckFunc(func() error { return msg.Ack() })
+		evt.SetNackFunc(func() error { return msg.Nak() })
 
 		// push onto the channel and wait for the consumer to take the event off before we acknowledge it.
 		channel <- evt
@@ -235,7 +221,9 @@ func (s *stream) Consume(topic string, opts ...events.ConsumeOption) (<-chan eve
 	}
 
 	// setup the options
-	subOpts := []nats.SubOpt{}
+	// Disable the NATS callback auto-ack: this callback only delivers to a
+	// channel and cannot know when the application has finished processing.
+	subOpts := []nats.SubOpt{nats.ManualAck()}
 
 	if options.CustomRetries {
 		subOpts = append(subOpts, nats.MaxDeliver(options.GetRetryLimit()))
```

---

### Incident Patch 8: `5cd35ab4` (2026-09-21)
**Commit Message**: fix(ci): restore lint and vulnerability gates (#4947)

* fix(ci): repair pgx lint and update vulnerable transport dependencies

* fix(deps): include grpc authority-header fix on 1.83 branch

**File**: `go.mod` (modified, +15/-15)
```diff
@@ -29,7 +29,7 @@ require (
 	github.com/pkg/errors v0.9.1
 	github.com/prometheus/client_golang v1.21.1
 	github.com/prometheus/client_model v0.6.1
-	github.com/rabbitmq/amqp091-go v1.10.0
+	github.com/rabbitmq/amqp091-go v1.13.0
 	github.com/redis/go-redis/v9 v9.22.0
 	github.com/stretchr/objx v0.5.2
 	github.com/stretchr/testify v1.11.1
@@ -39,14 +39,14 @@ require (
 	go.etcd.io/bbolt v1.4.0
 	go.etcd.io/etcd/api/v3 v3.5.21
 	go.etcd.io/etcd/client/v3 v3.5.21
-	go.opentelemetry.io/otel v1.43.0
-	go.opentelemetry.io/otel/sdk v1.43.0
-	go.opentelemetry.io/otel/trace v1.43.0
+	go.opentelemetry.io/otel v1.44.0
+	go.opentelemetry.io/otel/sdk v1.44.0
+	go.opentelemetry.io/otel/trace v1.44.0
 	go.uber.org/zap v1.27.0
-	golang.org/x/crypto v0.53.0
-	golang.org/x/net v0.56.0
-	golang.org/x/sync v0.21.0
-	google.golang.org/grpc v1.82.1
+	golang.org/x/crypto v0.55.0
+	golang.org/x/net v0.58.0
+	golang.org/x/sync v0.22.0
+	google.golang.org/grpc v1.83.2
 	google.golang.org/grpc/examples v0.0.0-20250515150734-f2d3e11f3057
 	google.golang.org/protobuf v1.36.11
 )
@@ -95,16 +95,16 @@ require (
 	github.com/xrash/smetrics v0.0.0-20240521201337-686a1a2994c1 // indirect
 	go.etcd.io/etcd/client/pkg/v3 v3.5.21 // indirect
 	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
-	go.opentelemetry.io/otel/metric v1.43.0 // indirect
+	go.opentelemetry.io/otel/metric v1.44.0 // indirect
 	go.uber.org/atomic v1.11.0 // indirect
 	go.uber.org/multierr v1.10.0 // indirect
 	golang.org/x/exp v0.0.0-20250305212735-054e65f0b394 // indirect
-	golang.org/x/mod v0.37.0 // indirect
-	golang.org/x/sys v0.46.0 // indirect
-	golang.org/x/text v0.39.0 // indirect
+	golang.org/x/mod v0.38.0 // indirect
+	golang.org/x/sys v0.47.0 // indirect
+	golang.org/x/text v0.41.0 // indirect
 	golang.org/x/time v0.11.0 // indirect
-	golang.org/x/tools v0.47.0 // indirect
-	google.golang.org/genproto/googleapis/api v0.0.0-20260414002931-afd174a4e478 // indirect
-	google.golang.org/genproto/googleapis/rpc v0.0.0-20260414002931-afd174a4e478 // indirect
+	golang.org/x/tools v0.48.0 // indirect
+	google.golang.org/genproto/googleapis/api v0.0.0-20260526163538-3dc84a4a5aaa // indirect
+	google.golang.org/genproto/googleapis/rpc v0.0.0-20260526163538-3dc84a4a5aaa // indirect
 	gopkg.in/yaml.v3 v3.0.1 // indirect
 )
```

**File**: `go.sum` (modified, +33/-0)
```diff
@@ -249,6 +249,8 @@ github.com/prometheus/procfs v0.16.0 h1:xh6oHhKwnOJKMYiYBDWmkHqQPyiY40sny36Cmx2b
 github.com/prometheus/procfs v0.16.0/go.mod h1:8veyXUu3nGP7oaCxhX6yeaM5u4stL2FeMXnCqhDthZg=
 github.com/rabbitmq/amqp091-go v1.10.0 h1:STpn5XsHlHGcecLmMFCtg7mqq0RnD+zFr4uzukfVhBw=
 github.com/rabbitmq/amqp091-go v1.10.0/go.mod h1:Hy4jKW5kQART1u+JkDTF9YYOQUHXqMuhrgxOEeS7G4o=
+github.com/rabbitmq/amqp091-go v1.13.0 h1:L8NA1WtF76C6KA3LAoufjfLgbist/If1UQYcsOjtxXA=
+github.com/rabbitmq/amqp091-go v1.13.0/go.mod h1:Hy4jKW5kQART1u+JkDTF9YYOQUHXqMuhrgxOEeS7G4o=
 github.com/redis/go-redis/v9 v9.22.0 h1:laDvpYXTJtZLloinw1fA5Kqd6HAEH2XKxOkG/PDq2F0=
 github.com/redis/go-redis/v9 v9.22.0/go.mod h1:y2g0Wj8rQvuK0ELM+oxSudcLtC09JScs98I/X9gRWY4=
 github.com/rogpeppe/go-internal v1.9.0/go.mod h1:WtVeX8xhTBvf0smdhujwtBcq4Qrzq/fJaraNFVN+nFs=
@@ -298,14 +300,23 @@ go.opentelemetry.io/auto/sdk v1.2.1 h1:jXsnJ4Lmnqd11kwkBV2LgLoFMZKizbCi5fNZ/ipaZ
 go.opentelemetry.io/auto/sdk v1.2.1/go.mod h1:KRTj+aOaElaLi+wW1kO/DZRXwkF4C5xPbEe3ZiIhN7Y=
 go.opentelemetry.io/otel v1.43.0 h1:mYIM03dnh5zfN7HautFE4ieIig9amkNANT+xcVxAj9I=
 go.opentelemetry.io/otel v1.43.0/go.mod h1:JuG+u74mvjvcm8vj8pI5XiHy1zDeoCS2LB1spIq7Ay0=
+go.opentelemetry.io/otel v1.44.0 h1:JjwHmHpA4iZ3wBxluu2fbbE7j4kqlE8jXyAyPXH7HqU=
+go.opentelemetry.io/otel v1.44.0/go.mod h1:BMgjTHL9WPRlRjL2oZCBTL4whCGtXch2H4BhOPIAyYc=
 go.opentelemetry.io/otel/metric v1.43.0 h1:d7638QeInOnuwOONPp4JAOGfbCEpYb+K6DVWvdxGzgM=
 go.opentelemetry.io/otel/metric v1.43.0/go.mod h1:RDnPtIxvqlgO8GRW18W6Z/4P462ldprJtfxHxyKd2PY=
+go.opentelemetry.io/otel/metric v1.44.0 h1:1w0gILTcHdr3YI+ixLyjemwrVnsMURbTZFrSYCdDdmc=
+go.opentelemetry.io/otel/metric v1.44.0/go.mod h1:8O7hanEPBNgEMmybD3s2VBKcgWOCsA6tzHBPODAiquo=
 go.opentelemetry.io/otel/sdk v1.43.0 h1:pi5mE86i5rTeLXqoF/hhiBtUNcrAGHLKQdhg4h4V9Dg=
 go.opentelemetry.io/otel/sdk v1.43.0/go.mod h1:P+IkVU3iWukmiit/Yf9AWvpyRDlUeBaRg6Y+C58QHzg=
+go.opentelemetry.io/otel/sdk v1.44.0 h1:nHYwb9lK+fJPU/dnT6s7W7Z8itMWyqrnVfbheVYrZ58=
+go.opentelemetry.io/otel/sdk v1.44.0/go.mod h1:Osuydd3Se74nqjAKxid74N5eC+jfEqfTegHRnq58oK0=
 go.opentelemetry.io/otel/sdk/metric v1.43.0 h1:S88dyqXjJkuBNLeMcVPRFXpRw2fuwdvfCGLEo89fDkw=
 go.opentelemetry.io/otel/sdk/metric v1.43.0/go.mod h1:C/RJtwSEJ5hzTiUz5pXF1kILHStzb9zFlIEe85bhj6A=
+go.opentelemetry.io/otel/sdk/metric v1.44.0 h1:3LlKgI+VjbVsjNRFZJZAJ30WjXC5VkNRks6si09iEfI=
 go.opentelemetry.io/otel/trace v1.43.0 h1:BkNrHpup+4k4w+ZZ86CZoHHEkohws8AY+WTX09nk+3A=
 go.opentelemetry.io/otel/trace v1.43.0/go.mod h1:/QJhyVBUUswCphDVxq+8mld+AvhXZLhe+8WVFxiFff0=
+go.opentelemetry.io/otel/trace v1.44.0 h1:jxF5CsGYCe74MCRx2X4g7WsY/VBKRqqpNvXlX/6gtIk=
+go.opentelemetry.io/otel/trace v1.44.0/go.mod h1:oLl1jrMQAVo6v3GAggN+1VH9VIz9iUSvW53sW1Q8PIE=
 go.uber.org/atomic v1.11.0 h1:ZvwS0R+56ePWxUNi+Atn9dWONBPp/AUETXlHW0DxSjE=
 go.uber.org/atomic v1.11.0/go.mod h1:LUxbIzbOniOlMKjJjyPfpl4v+PKK2cNJn91OQbhoJI0=
 go.uber.org/goleak v1.3.0 h1:2K3zAYmnTNqV73imy9J1T3WC+gmCePx2hEGkimedGto=
@@ -321,13 +332,17 @@ golang.org/x/crypto v0.0.0-20191011191535-87dc89f01550/go.mod h1:yigFU9vqHzYiE8U
 golang.org/x/crypto v0.0.0-20200622213623-75b288015ac9/go.mod h1:LzIPMQfyMNhhGPhUkYOs5KpL4U8rLKemX1yGLhDgUto=
 golang.org/x/crypto v0.53.0 h1:QZ4Muo8THX6CizN2vPPd5fBGHyogrdK9fG4wLPFUsto=
 golang.org/x/crypto v0.53.0/go.mod h1:DNLU434OwVakk9PzuwV8w62mAJpRJL3vsgcfp4Qnsio=
+golang.org/x/crypto v0.55.0 h1:+KWHjbgOaAQ66dh/YlkZKHlz9ZUlq61AFirAR9ntP8M=
+golang.org/x/crypto v0.55.0/go.mod h1:uq0V9dE/fzQuJtbnL+2EhWOE63vo164FY8xqEnV9xis=
 golang.org/x/exp v0.0.0-20250305212735-054e65f0b394 h1:nDVHiLt8aIbd/VzvPWN6kSOPE7+F/fNFDSXLVYkE/Iw=
 golang.org/x/exp v0.0.0-20250305212735-054e65f0b394/go.mod h1:sIifuuw/Yco/y6yb6+bDNfyeQ/MdPUy/hKEMYQV17cM=
 golang.org/x/mod v0.2.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.3.0/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.4.2/go.mod h1:s0Qsj1ACt9ePp/hMypM3fl4fZqREWJwdYDEqhRiZZUA=
 golang.org/x/mod v0.37.0 h1:v
```

**File**: `store/postgres/pgx/options_test.go` (modified, +3/-2)
```diff
@@ -17,7 +17,8 @@ func TestNewStoreContext(t *testing.T) {
 	})
 
 	t.Run("preserves configured context", func(t *testing.T) {
-		ctx := context.WithValue(context.Background(), struct{}{}, "value")
+		type contextKey struct{}
+		ctx := context.WithValue(context.Background(), contextKey{}, "value")
 		s := NewStore(store.WithContext(ctx))
 
 		if s.Options().Context != ctx {
@@ -26,7 +27,7 @@ func TestNewStoreContext(t *testing.T) {
 	})
 
 	t.Run("replaces configured nil context", func(t *testing.T) {
-		s := NewStore(store.WithContext(nil))
+		s := NewStore(func(options *store.Options) { options.Context = nil })
 
 		if s.Options().Context == nil {
 			t.Fatal("expected a non-nil fallback context")
```

---

### Incident Patch 9: `b0ea25d0` (2026-09-21)
**Commit Message**: fix(nats): report disconnected registry queries (#4945)

Co-authored-by: Codex <codex@openai.com>

**File**: `registry/nats/nats.go` (modified, +16/-0)
```diff
@@ -232,6 +232,9 @@ func (n *natsRegistry) query(s string, quorum int) ([]*registry.Service, error)
 	if err != nil {
 		return nil, err
 	}
+	if err := connectionError(conn); err != nil {
+		return nil, err
+	}
 
 	var action string
 	var service *registry.Service
@@ -304,9 +307,22 @@ loop:
 	for _, service := range serviceMap {
 		services = append(services, service)
 	}
+	if err := connectionError(conn); err != nil {
+		return nil, err
+	}
 	return services, nil
 }
 
+func connectionError(conn *nats.Conn) error {
+	if conn.IsClosed() {
+		return nats.ErrConnectionClosed
+	}
+	if !conn.IsConnected() {
+		return nats.ErrDisconnected
+	}
+	return nil
+}
+
 func (n *natsRegistry) Init(opts ...registry.Option) error {
 	return configure(n, opts...)
 }
```

**File**: `registry/nats/nats_connection_test.go` (added, +54/-0)
```diff
@@ -0,0 +1,54 @@
+package nats
+
+import (
+	"errors"
+	"testing"
+	"time"
+
+	server "github.com/nats-io/nats-server/v2/server"
+	gonats "github.com/nats-io/nats.go"
+	"go-micro.dev/v6/registry"
+)
+
+func TestQueryConnectionState(t *testing.T) {
+	srv, err := server.NewServer(&server.Options{Host: "127.0.0.1", Port: -1})
+	if err != nil {
+		t.Fatalf("new NATS server: %v", err)
+	}
+	go srv.Start()
+	if !srv.ReadyForConnections(10 * time.Second) {
+		t.Fatal("NATS server did not become ready")
+	}
+	t.Cleanup(func() {
+		srv.Shutdown()
+		srv.WaitForShutdown()
+	})
+
+	r := NewNatsRegistry(
+		registry.Addrs(srv.ClientURL()),
+		registry.Timeout(25*time.Millisecond),
+	).(*natsRegistry)
+
+	services, err := r.ListServices()
+	if err != nil {
+		t.Fatalf("query reachable NATS server: %v", err)
+	}
+	if len(services) != 0 {
+		t.Fatalf("expected no services, got %d", len(services))
+	}
+
+	srv.Shutdown()
+	srv.WaitForShutdown()
+	deadline := time.Now().Add(time.Second)
+	for r.conn.IsConnected() && time.Now().Before(deadline) {
+		time.Sleep(time.Millisecond)
+	}
+	if r.conn.IsConnected() {
+		t.Fatal("connection remained connected after NATS stopped")
+	}
+
+	_, err = r.ListServices()
+	if !errors.Is(err, gonats.ErrDisconnected) {
+		t.Fatalf("expected disconnected error, got %v", err)
+	}
+}
```

**File**: `registry/nats/nats_environment_test.go` (modified, +9/-2)
```diff
@@ -27,8 +27,8 @@ var e environment
 func TestMain(m *testing.M) {
 	natsURL := os.Getenv("NATS_URL")
 	if natsURL == "" {
-		log.Infof("NATS_URL is undefined - skipping tests")
-		return
+		log.Infof("NATS_URL is undefined - skipping external NATS tests")
+		os.Exit(m.Run())
 	}
 
 	e.registryOne = nats.NewNatsRegistry(registry.Addrs(natsURL), nats.Quorum(1))
@@ -67,3 +67,10 @@ func TestMain(m *testing.M) {
 
 	os.Exit(result)
 }
+
+func requireExternalNATS(tb testing.TB) {
+	tb.Helper()
+	if e.registryOne == nil {
+		tb.Skip("NATS_URL is undefined")
+	}
+}
```

**File**: `registry/nats/nats_test.go` (modified, +8/-0)
```diff
@@ -7,6 +7,7 @@ import (
 )
 
 func TestRegister(t *testing.T) {
+	requireExternalNATS(t)
 	service := registry.Service{Name: "test"}
 	assertNoError(t, e.registryOne.Register(&service))
 	defer e.registryOne.Deregister(&service)
@@ -21,6 +22,7 @@ func TestRegister(t *testing.T) {
 }
 
 func TestDeregister(t *testing.T) {
+	requireExternalNATS(t)
 	service1 := registry.Service{Name: "test-deregister", Version: "v1"}
 	service2 := registry.Service{Name: "test-deregister", Version: "v2"}
 
@@ -46,6 +48,7 @@ func TestDeregister(t *testing.T) {
 }
 
 func TestGetService(t *testing.T) {
+	requireExternalNATS(t)
 	services, err := e.registryTwo.GetService("one")
 	assertNoError(t, err)
 	assertEqual(t, 1, len(services))
@@ -54,12 +57,14 @@ func TestGetService(t *testing.T) {
 }
 
 func TestGetServiceWithNoNodes(t *testing.T) {
+	requireExternalNATS(t)
 	services, err := e.registryOne.GetService("missing")
 	assertNoError(t, err)
 	assertEqual(t, 0, len(services))
 }
 
 func TestGetServiceFromMultipleNodes(t *testing.T) {
+	requireExternalNATS(t)
 	services, err := e.registryOne.GetService("two")
 	assertNoError(t, err)
 	assertEqual(t, 1, len(services))
@@ -68,6 +73,7 @@ func TestGetServiceFromMultipleNodes(t *testing.T) {
 }
 
 func BenchmarkGetService(b *testing.B) {
+	requireExternalNATS(b)
 	for n := 0; n < b.N; n++ {
 		services, err := e.registryTwo.GetService("one")
 		assertNoError(b, err)
@@ -77,6 +83,7 @@ func BenchmarkGetService(b *testing.B) {
 }
 
 func BenchmarkGetServiceWithNoNodes(b *testing.B) {
+	requireExternalNATS(b)
 	for n := 0; n < b.N; n++ {
 		services, err := e.registryOne.GetService("missing")
 		assertNoError(b, err)
@@ -85,6 +92,7 @@ func BenchmarkGetServiceWithNoNodes(b *testing.B) {
 }
 
 func BenchmarkGetServiceFromMultipleNodes(b *testing.B) {
+	requireExternalNATS(b)
 	for n := 0; n < b.N; n++ {
 		services, err := e.registryTwo.GetService("two")
 		assertNoError(b, err)
```

---

### Incident Patch 10: `acbf6538` (2026-09-21)
**Commit Message**: fix(pgx): default store context (#4944)

Co-authored-by: Codex <codex@openai.com>

**File**: `store/postgres/pgx/options_test.go` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+package pgx
+
+import (
+	"context"
+	"testing"
+
+	"go-micro.dev/v6/store"
+)
+
+func TestNewStoreContext(t *testing.T) {
+	t.Run("defaults to background context", func(t *testing.T) {
+		s := NewStore()
+
+		if s.Options().Context == nil {
+			t.Fatal("expected a non-nil default context")
+		}
+	})
+
+	t.Run("preserves configured context", func(t *testing.T) {
+		ctx := context.WithValue(context.Background(), struct{}{}, "value")
+		s := NewStore(store.WithContext(ctx))
+
+		if s.Options().Context != ctx {
+			t.Fatal("expected the configured context to be preserved")
+		}
+	})
+
+	t.Run("replaces configured nil context", func(t *testing.T) {
+		s := NewStore(store.WithContext(nil))
+
+		if s.Options().Context == nil {
+			t.Fatal("expected a non-nil fallback context")
+		}
+	})
+}
```

**File**: `store/postgres/pgx/pgx.go` (modified, +4/-0)
```diff
@@ -14,6 +14,7 @@
 package pgx
 
 import (
+	"context"
 	"database/sql"
 	"fmt"
 	"net/url"
@@ -386,6 +387,9 @@ func NewStore(opts ...store.Option) store.Store {
 	for _, o := range opts {
 		o(&options)
 	}
+	if options.Context == nil {
+		options.Context = context.Background()
+	}
 
 	// new store
 	s := new(sqlStore)
```

#### Recent Merged Pull Requests:
- **PR #4972** (2026-09-30): Remove app prototype and focus v7 on services, agents, and flows (@asim)
- **PR #4971** (2026-09-29): Use the shared agent harness for CLI chat (@asim)
- **PR #4970** (2026-09-29): Add app definitions, asset serving and a shared service example (@asim)
- **PR #4969** (2026-09-29): Consolidate compatible provider loops and outline v7 ownership (@asim)
- **PR #4968** (2026-09-29): Shorten README and clarify services, agents, and application outputs (@asim)
- **PR #4967** (closed): Surface request field descriptions in MCP and AI tool schemas (@alex-dna-tech)
- **PR #4966** (2026-09-26): Align README, website and docs around conversational development (@asim)
- **PR #4965** (2026-09-24): Lead with agent development and switch the website to light (@asim)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
