# Forensic Learning Record (Deep Inspection): openlit/openlit

> **Canonical Artifact**: `07_PROJECT_LEARNING/openlit-openlit-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/openlit/openlit](https://github.com/openlit/openlit))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:48:30.196Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `openlit/openlit`
- **Description**: OpenLIT is the open-source agent harness engineering platform: trace, evaluate, guard, and improve everything around the model in your AI agents, on OTEL.
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2817 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/internal/coding/hook/claudecode/claudecode.go`
```
// Package claudecode implements the Claude Code hook adapter.
//
// Claude Code invokes the hook by name (SessionStart, UserPromptSubmit,
// PreToolUse, PostToolUse, Stop, SubagentStop, SessionEnd) with a JSON
// payload on stdin. We additionally tail the per-session transcript
// file (`transcript_path` in the payload) for authoritative token
// usage and cost on SessionEnd, and for an early model attribution on
// SessionStart.
//
// Claude Code also exposes its own OTel exporter via
// `CLAUDE_CODE_ENABLE_TELEMETRY=1`. When the user has both paths on,
// the query layer dedupes per `session.id` (see
// `agent-guides/coding-agents-convention.md` §5). This adapter is
// responsible for the hook path only; it stamps
// `coding_agent.signal_source = "hook"` (via the resource attribute
// set in `cli/internal/otlp/exporter.go`) so the dual-path coalesce
// can tell them apart.
package claudecode

import (
	"context"

	"github.com/openlit/openlit/cli/internal/coding/normalize"
	"github.com/openlit/openlit/sdk/go/semconv"
)

// New returns a new Claude Code adapter.
func New() normalize.Adapter { return &adapter{} }

type adapter struct{}

func (a *adapter) Vendor() string { return semconv.CodingAgentVendorClaudeCode }

func (a *adapter) Handle(ctx context.Context, in normalize.Input) error {
	return handle(ctx, in)
}

```

### Core Architecture Module: `cli/internal/coding/hook/claudecode/handle.go`
```
package claudecode

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/openlit/openlit/cli/internal/coding/classify"
	"github.com/openlit/openlit/cli/internal/coding/detect"
	"github.com/openlit/openlit/cli/internal/coding/git"
	"github.com/openlit/openlit/cli/internal/coding/normalize"
	"github.com/openlit/openlit/cli/internal/coding/pricing"
	"github.com/openlit/openlit/cli/internal/coding/sessionstate"
	"github.com/openlit/openlit/cli/internal/coding/tailfile"
	"github.com/openlit/openlit/sdk/go/semconv"
)

// claudePayload covers the fields Claude Code sends across all hook
// events. Unknown fields are ignored. See
// https://code.claude.com/docs/en/hooks for the event-level schema and
// `agent-guides/coding-agents-convention.md` §4 for the mapping
// onto our canonical attributes.
type claudePayload struct {
	SessionID      string          `json:"session_id"`
	TranscriptPath string          `json:"transcript_path"`
	CWD            string          `json:"cwd"`
	HookEventName  string          `json:"hook_event_name"`
	PermissionMode string          `json:"permission_mode"`
	ToolName       string          `json:"tool_name"`
	ToolUseID      string          `json:"tool_use_id"`
	ToolInput      json.RawMessage `json:"tool_input"`
	ToolResponse   json.RawMessage `json:"tool_response"`
	StopHookActive bool            `json:"stop_hook_active"`
	Source         string          `json:"source"` // SessionStart subtypes (startup, resume, ...)
	Reason         string          `json:"reason"` // SessionEnd reason

	// UserPromptSubmit specific. Claude Code sends the entire user
	// prompt verbatim on this event. We only stamp the body when
	// content_capture_mode == "full" — otherwise just the length.
	Prompt string `json:"prompt"`

	// SubagentStop adds these (matcher + a short blurb). Documented
	// at https://code.claude.com/docs/en/hooks#subagentstop-input.
	SubagentType string `json:"subagent_type"`
	TaskID       string `json:"task_id"`
}

// handle is the per-invocation entry point. Claude Code passes events
// over stdin; we route each event to a span emitter using the same
// canonical types so the dashboard treats them uniformly.
func handle(ctx context.Context, in normalize.Input) error {
	var p claudePayload
	if err := json.Unmarshal(in.Payload, &p); err != nil {
		// Malformed payload — drop silently. The hook subcommand
		// already logs the parse error to stderr above us.
		return nil
	}

	event := in.Event
	if event == "" {
		event = p.HookEventName
	}

	vcs := git.Snapshot(ctx, p.CWD)
	// See cursor/handle.go for the rationale — v1 has no API-key
	// allowlist surface, so we flag the key signal as unknown.
	cls := classify.Classify(classify.Inputs{
		APIKeyAllowlistKnown: false,
		APIKeyOnAllowlist:    false,
		RepoURL:              vcs.RepoURL,
		RepoAllowlist:        classify.SplitAllowlist(os.Getenv("OPENLIT_CODING_REPO_ALLOWLIST")),
	})

	// Every event is a chance to drain new assistant turns from the
	// transcript. Stop fires after every assistant turn, so this gives
	// us per-turn LLM-turn spans (with output text + tokens) without
	// waiting for SessionEnd. PreToolUse / PostToolUse also drain so
	// long sessions don't accumulate unread tail.
	drainAssistantTurns(in, p)

	switch event {
	case "SessionStart":
		return emitSession(in, p, vcs, cls, "started", time.Time{})
	case "UserPromptSubmit":
		// Drain any leftover pending edits as rejections — Claude
		// Code skipped the matching PostToolUse, which most often
		// means the user denied the edit at the diff-review prompt
		// and the assistant moved on. This is the same heuristic
		// Anthropic's own monitoring docs describe under
		// `claude_code.code_edit_tool.decision = reject`.
		drainRejectedPendingEdits(in, p.SessionID)
		return emitUserPrompt(in, p)
	case "Stop":
		// Stop fires after every assistant turn — many times per
		// session. We emit a low-cost loop event here so dashboards
		// can count turns without inflating the session-span count.
		//
		// We also stamp `coding_agent.session.outcome = "completed"`
		// on this event-span so the sessions list reflects "agent
		// finished its loop" instead of remaining on the "running"
		// pill forever. Claude Code's `SessionEnd` only fires on
		// graceful exits (`/exit`, logout, clear) — closing VS Code
		// or starting a new chat skips it, leaving the row stuck.
		// The sessions rollup uses `argMaxIf(outcome, Timestamp,
		// non-empty)` so a later SessionEnd verdict (cancelled /
		// abandoned_with_change) still wins over this "completed"
		// stamp, which matches the user-visible truth: the chat
		// completed each turn, and the *terminal* outcome is
		// whatever SessionEnd reports.
		return in.Emit.EmitEvent(normalize.EventEmission{
			SessionID: p.SessionID,
			Name:      "coding_agent.session.loop.stop",
			At:        time.Now(),
			Attrs: map[string]any{
				"coding_agent.client":            in.Vendor,
				"coding_agent.hook.event":        event,
				"coding_agent.session.loop.kind": "assistant_turn_end",
				"coding_agent.session.outcome":   semconv.CodingAgentSessionOutcomeCompleted,
			},
		})
	case "SessionEnd":
		// Drain any leftover pending edits as rejections — see the
		// UserPromptSubmit branch for the rationale. Doing this both
		// places ensures we attribute rejections whether the session
		// ended gracefully or via a fresh user prompt.
		drainRejectedPendingEdits(in, p.SessionID)
		// Authoritative session-close. Emit the full session span
		// with token rollups, realized cost, and outcome.
		return emitSession(in, p, vcs, cls, "ended", time.Now())
	case "PreToolUse":
		// Stash the proposed edit for the rejection heuristic when
		// the tool is an edit tool. PostToolUse will either resolve
		// it as an accept (and remove the entry) or UserPromptSubmit /
		// SessionEnd will drain it as a reject. Bash invocations are
		// passed through to the standard compact event below; git
		// commit / PR detection happens at PostToolUse where we have
		// the tool's stdout.
		if isEditTool(p.ToolName) {
			stashPendingEdit(in, p)
		}
		// Cache Task tool spawns so the matching SubagentStop can
		// echo `gen_ai.tool.call.id`. Claude Code does not fire
		// PreToolUse / PostToolUse hooks for actions taken *inside*
		// a subagent, so the only handle we have to bracket
		// subagent activity is the (Task tool call, SubagentStop)
		// pair. The chat view uses the shared id to render the two
		// spans as one collapsible "Subagent" block.
		if p.ToolName == "Task" && p.ToolUseID != "" && p.SessionID != "" {
			st := sessionstate.Load(p.SessionID, "claude-code")
			if st == nil {
				st = &sessionstate.State{}
			}
			st.ActiveTaskToolUseID = p.ToolUseID
			sessionstate.Save(p.SessionID, "claude-code", st)
		}
		// Pre-event only; the full tool span is emitted at PostToolUse
		// time so we don't double-count. Still log a compact event so
		// dashboards can show the in-flight tool list.
		return in.Emit.EmitEvent(normalize.EventEmission{
			SessionID: p.SessionID,
			Name:      "coding_agent.tool.requested",
			At:        time.Now(),
			Attrs: map[string]any{
				"coding_agent.client": in.Vendor,
				"gen_ai.tool.name":    p.ToolName,
				"gen_ai.tool.call.id": p.ToolUseID,
				"code.cwd":            p.CWD,
			},
		})
	case "PostToolUse":
		return emitToolCall(in, p, vcs, cls)
	case "SubagentStop":
		// Echo the spawning Task tool-use id onto the subagent
		// span so the chat view can group (Task tool call,
		// subagent) into one block, then clear the cache. Best-effort
		// — if PreToolUse(Task) didn't fire for this session (e.g.
		// the user started in mid-stream or sessionstate was
		// missing), we still emit the span with the linkage
		// fields we do have.
		var toolUseID string
		if st := sessionstate.Load(p.SessionID, "claude-code"); st != nil {
			toolUseID = st.ActiveTaskToolUseID
			if toolUseID != "" {
				st.ActiveTaskToolUseID = ""
				sessionstate.Save(p.SessionID, "claude-code", st)
			}
		}
		return in.Emit.EmitSubagent(normalize.Subagent{
			SessionID:    p.SessionID,
			SubagentID:   p.TaskID,
			SubagentType: p.SubagentType,
			Vendor:       in.Vendor,
			ToolCallID:   toolUseID,
			Status:       "completed",
			StartedAt:    time.Now(),
			EndedAt:      time.Now(),
		})
	default:
		// Unknown event — emit a low-cost span event so we have a
		// record in case we need to debug a vendor change.
		return in.Emit.EmitEvent(normalize.EventEmission{
			SessionID: p.SessionID,
			Name:      "coding_agent.hook.unknown_event",
			At:        time.Now(),
			Attrs: map[string]any{
				"coding_agent.hook.event": event,
				"coding_agent.client":     in.Vendor,
			},
		})
	}
}

// drainAssistantTurns reads any new assistant turns from Claude Code's
// transcript JSONL since the last hook invocation and emits one
// `coding_agent.llm.turn` per *complete* turn (assistant message with a
// non-empty `stop_reason`). Streaming fragments sharing a RequestID are
// coalesced. Incomplete trailing turns leave the offset unchanged so the
// next invocation picks them up.

func drainAssistantTurns(in normalize.Input, p claudePayload) {
	sessionID := p.SessionID
	if sessionID == "" {
		return
	}

	transcriptPath := strings.TrimSpace(p.TranscriptPath)
	st := sessionstate.Load(sessionID, "claude-code")
	if transcriptPath == "" {
		transcriptPath = st.TranscriptPath
	}
	if transcriptPath == "" {
		return
	}
	if strings.HasPrefix(transcriptPath, "~/") {
		if home, err := os.UserHomeDir(); err == nil {
			transcriptPath = filepath.Join(home, strings.TrimPrefix(transcriptPath, "~/"))
		}
	}

	lines, newOffset, err := readTranscript(transcriptPath, st.TranscriptOffset)
	if err != nil || len(lines) == 0 {
		// Persist the path even if nothing new — later events without
		// a `transcript_path` field in the payload can still resume.
		if transcriptPath != st.TranscriptPath {
			st.TranscriptPath = transcriptPath
			sessionstate.Save(sessi
```

### Core Architecture Module: `cli/internal/coding/hook/claudecode/transcript.go`
```
package claudecode

// Transcript reader for Claude Code's per-session JSONL file.
//
// Each hook invocation reads only the new
// bytes since the last invocation, coalesces streaming assistant fragments
// by RequestID, and produces one "complete LLM turn" record per assistant
// message that finished cleanly (non-empty `stop_reason`).
//
// The transcript file is what gives us, on a per-turn basis:
//   - the assistant's text, thinking, and tool_use blocks (chat content)
//   - the user's prompt (text) and tool_result blocks (tool outputs)
//   - the model, request id, and authoritative usage (tokens + cache)
//
// SessionEnd alone would let us realize cost/tokens at the end, but the
// chat tab on the trace detail page expects per-turn spans with input +
// output messages — that's what Stop / PostToolUse drives once we read
// the new tail.

import (
	"bufio"
	"encoding/json"
	"io"
	"os"
	"strings"
)

// transcriptLine is a partial decoding of a single JSONL line.
type transcriptLine struct {
	Type        string          `json:"type"`
	UUID        string          `json:"uuid"`
	ParentUUID  string          `json:"parentUuid"`
	Timestamp   string          `json:"timestamp"`
	SessionID   string          `json:"sessionId"`
	Version     string          `json:"version"`
	GitBranch   string          `json:"gitBranch"`
	CWD         string          `json:"cwd"`
	Entrypoint  string          `json:"entrypoint"`
	RequestID   string          `json:"requestId"`
	IsSidechain bool            `json:"isSidechain"`
	Message     json.RawMessage `json:"message"`

	endOffset int64 // byte position immediately after this line
}

// assistantMessage is the decoded `message` field of an assistant line.
type assistantMessage struct {
	Model      string                  `json:"model"`
	ID         string                  `json:"id"`
	Content    []assistantContentBlock `json:"content"`
	StopReason string                  `json:"stop_reason"`
	Usage      assistantUsage          `json:"usage"`
}

type assistantContentBlock struct {
	Type     string          `json:"type"`
	Text     string          `json:"text,omitempty"`
	Thinking string          `json:"thinking,omitempty"`
	ID       string          `json:"id,omitempty"`
	Name     string          `json:"name,omitempty"`
	Input    json.RawMessage `json:"input,omitempty"`
}

type assistantUsage struct {
	InputTokens              int64 `json:"input_tokens"`
	OutputTokens             int64 `json:"output_tokens"`
	CacheCreationInputTokens int64 `json:"cache_creation_input_tokens"`
	CacheReadInputTokens     int64 `json:"cache_read_input_tokens"`
}

// skipTypes are line types the LLM-turn synthesiser ignores.
var skipTypes = map[string]bool{
	"file-history-snapshot": true,
	"queue-operation":       true,
	"attachment":            true,
	"permission-mode":       true,
	"last-prompt":           true,
	"ai-title":              true,
	"system":                true,
}

const maxScannerBuf = 10 * 1024 * 1024 // 10 MB — Claude Code emits multi-MB tool_result lines

// maxBytesPerInvocation caps how many transcript bytes a single hook
// process will scan. Claude Code transcripts grow to hundreds of MB
// over a long-running chat; on the very first hook event (offset == 0
// because sessionstate hasn't seen the session yet), an unbounded
// scan would happily read the entire file and starve the 5s hook
// timeout. The cap is a soft ceiling — we honour it by truncating the
// returned new-offset to (offset + cap) so the next invocation
// resumes from where we stopped. Set generous enough that a 1MB/sec
// transcript would still drain in real time across consecutive hook
// invocations.
const maxBytesPerInvocation = 8 * 1024 * 1024 // 8 MiB

// readTranscript reads JSONL lines from path starting at the supplied
// byte offset and returns the parsed lines plus the new offset.
// Unparseable lines are skipped silently — telemetry must never fail
// on a partial write.
func readTranscript(path string, offset int64) ([]transcriptLine, int64, error) {
	if path == "" {
		return nil, offset, nil
	}
	if strings.HasPrefix(path, "~/") {
		if home, err := os.UserHomeDir(); err == nil {
			path = home + path[1:]
		}
	}
	f, err := os.Open(path)
	if err != nil {
		return nil, offset, err
	}
	defer func() { _ = f.Close() }()

	if offset > 0 {
		if _, err := f.Seek(offset, io.SeekStart); err != nil {
			return nil, offset, err
		}
	}

	scanner := bufio.NewScanner(io.LimitReader(f, maxBytesPerInvocation))
	scanner.Buffer(make([]byte, 0, 64*1024), maxScannerBuf)

	var lastAdvance int
	scanner.Split(func(data []byte, atEOF bool) (int, []byte, error) {
		advance, token, err := bufio.ScanLines(data, atEOF)
		lastAdvance = advance
		return advance, token, err
	})

	var lines []transcriptLine
	pos := offset
	for scanner.Scan() {
		data := scanner.Bytes()
		lineLen := int64(lastAdvance)

		var line transcriptLine
		if err := json.Unmarshal(data, &line); err != nil {
			pos += lineLen
			continue
		}
		if skipTypes[line.Type] {
			pos += lineLen
			continue
		}
		line.endOffset = pos + lineLen
		lines = append(lines, line)
		pos += lineLen
	}
	return lines, pos, scanner.Err()
}

// coalescedTurn is one logical assistant turn after coalescing streaming
// fragments by RequestID. `lastSafeOffset` is the byte position we can
// commit to disk; trailing incomplete turns leave it unchanged so the
// next hook invocation re-reads them.
type coalescedTurn struct {
	line transcriptLine
	msg  assistantMessage
}

// coalesceAssistants merges consecutive assistant lines sharing the
// same RequestID into one turn, dropping anything that hasn't reached a
// `stop_reason`. Returns the safe turns plus the offset that lets the
// next reader resume immediately after them.
//
// User / tool_result lines from the transcript are intentionally NOT
// returned. We used to walk them to attach a `turnContext` to each
// assistant turn so the user-prompt that triggered the turn could be
// stamped onto the LLM-turn span — but Claude Code's transcript
// stores its *wrapped* prompt (prefixed with `<ide_opened_file>…` and
// similar IDE context envelopes), not the raw text the user typed.
// We rely on the UserPromptSubmit hook (`emitUserPrompt`) for the raw
// user-prompt and on `coding_agent.tool.call` spans for tool bodies,
// so the transcript reader only needs to surface assistant turns.
func coalesceAssistants(lines []transcriptLine) ([]coalescedTurn, int64) {
	var (
		turns          []coalescedTurn
		pending        []transcriptLine
		lastSafeOffset int64
		lastSafeLen    int
	)

	markSafe := func(off int64) {
		lastSafeOffset = off
		lastSafeLen = len(turns)
	}

	appendIfComplete := func(line transcriptLine) {
		var msg assistantMessage
		if err := json.Unmarshal(line.Message, &msg); err != nil || strings.TrimSpace(msg.StopReason) == "" {
			return
		}
		turns = append(turns, coalescedTurn{line: line, msg: msg})
		markSafe(line.endOffset)
	}

	flush := func() {
		if len(pending) == 0 {
			return
		}
		last := pending[len(pending)-1]
		var lastMsg assistantMessage
		if err := json.Unmarshal(last.Message, &lastMsg); err == nil && strings.TrimSpace(lastMsg.StopReason) != "" {
			merged := mergeAssistantGroup(pending)
			var msg assistantMessage
			if err := json.Unmarshal(merged.Message, &msg); err == nil {
				turns = append(turns, coalescedTurn{line: merged, msg: msg})
				markSafe(merged.endOffset)
			}
		}
		pending = nil
	}

	for _, line := range lines {
		if line.Type == "assistant" {
			if line.RequestID == "" {
				flush()
				appendIfComplete(line)
				continue
			}
			if len(pending) > 0 && pending[0].RequestID != line.RequestID {
				flush()
			}
			pending = append(pending, line)
			continue
		}
		flush()
	}
	flush()

	return turns[:lastSafeLen], lastSafeOffset
}

func mergeAssistantGroup(group []transcriptLine) transcriptLine {
	if len(group) == 1 {
		return group[0]
	}
	final := group[len(group)-1]
	var blocks []assistantContentBlock
	for _, l := range group {
		var m assistantMessage
		if err := json.Unmarshal(l.Message, &m); err != nil {
			continue
		}
		blocks = append(blocks, m.Content...)
	}
	var finalMsg assistantMessage
	if err := json.Unmarshal(final.Message, &finalMsg); err != nil {
		return final
	}
	finalMsg.Content = blocks
	if merged, err := json.Marshal(finalMsg); err == nil {
		final.Message = merged
	}
	return final
}

```

### Core Architecture Module: `cli/internal/coding/hook/codex/codex.go`
```
// Package codex implements the Codex CLI hook adapter.
//
// Codex emits hooks (SessionStart, UserPromptSubmit, PostToolUse, Stop)
// with a JSON payload, plus a rollout JSONL at
// ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl that carries token usage
// the hooks alone don't expose. Adapter logic lives in handle.go.
package codex

import (
	"context"

	"github.com/openlit/openlit/cli/internal/coding/normalize"
	"github.com/openlit/openlit/sdk/go/semconv"
)

// New returns a new Codex adapter.
func New() normalize.Adapter { return &adapter{} }

type adapter struct{}

func (a *adapter) Vendor() string { return semconv.CodingAgentVendorCodex }

func (a *adapter) Handle(ctx context.Context, in normalize.Input) error {
	return handle(ctx, in)
}

```

### Core Architecture Module: `cli/internal/coding/hook/codex/handle.go`
```
package codex

import (
	"context"
	"encoding/json"
	"os"
	"strings"
	"time"

	"github.com/openlit/openlit/cli/internal/coding/classify"
	"github.com/openlit/openlit/cli/internal/coding/detect"
	"github.com/openlit/openlit/cli/internal/coding/git"
	"github.com/openlit/openlit/cli/internal/coding/normalize"
	"github.com/openlit/openlit/cli/internal/coding/pricing"
	"github.com/openlit/openlit/cli/internal/coding/sessionstate"
	"github.com/openlit/openlit/sdk/go/semconv"
)

// codexPayload mirrors the JSON envelope OpenAI Codex sends to a hook
// command. Field naming follows the protocol as documented at
// https://developers.openai.com/codex/hooks. Unknown fields are
// ignored so Codex can add keys without breaking installs.
type codexPayload struct {
	HookEventName        string          `json:"hook_event_name"`
	SessionID            string          `json:"session_id"`
	TurnID               string          `json:"turn_id"`
	TranscriptPath       string          `json:"transcript_path"`
	Cwd                  string          `json:"cwd"`
	Model                string          `json:"model"`
	Source               string          `json:"source"`
	Prompt               string          `json:"prompt"`
	ToolName             string          `json:"tool_name"`
	ToolUseID            string          `json:"tool_use_id"`
	ToolInput            json.RawMessage `json:"tool_input"`
	ToolResponse         json.RawMessage `json:"tool_response"`
	ToolOutput           json.RawMessage `json:"tool_output"`
	ToolDurationMs       *float64        `json:"tool_duration_ms"`
	DurationMs           *float64        `json:"duration_ms"`
	Status               string          `json:"status"`
	Error                json.RawMessage `json:"error"`
	Timestamp            string          `json:"timestamp"`
	StopHookActive       bool            `json:"stop_hook_active"`
	LastAssistantMessage *string         `json:"last_assistant_message"`

	// ApprovalMode mirrors Codex's `--approval-mode` (`untrusted`,
	// `on-failure`, `on-request`, `never`). Codex doesn't always
	// stamp it, but when it does we treat it as the OTel-canonical
	// `coding_agent.policy.permission_mode`. Older builds called the
	// field `approval_mode`; we accept both.
	ApprovalMode   string `json:"approval_mode"`
	PermissionMode string `json:"permission_mode"`
}

// handle is the per-invocation entry point invoked by `openlit coding hook`.
func handle(ctx context.Context, in normalize.Input) error {
	var p codexPayload
	if err := json.Unmarshal(in.Payload, &p); err != nil {
		return nil
	}

	event := in.Event
	if event == "" {
		event = p.HookEventName
	}

	cwd := strings.TrimSpace(p.Cwd)
	if cwd == "" {
		if wd, err := os.Getwd(); err == nil {
			cwd = wd
		}
	}
	vcs := git.Snapshot(ctx, cwd)
	cls := classify.Classify(classify.Inputs{
		// v1: same posture as the Cursor / Claude Code adapters —
		// no API-key allowlist is wired up at the CLI surface, so
		// we let the classifier lean on the repo signal alone.
		APIKeyAllowlistKnown: false,
		APIKeyOnAllowlist:    false,
		RepoURL:              vcs.RepoURL,
		RepoAllowlist:        classify.SplitAllowlist(os.Getenv("OPENLIT_CODING_REPO_ALLOWLIST")),
	})

	permissionMode := nonEmpty(p.PermissionMode, p.ApprovalMode)

	// Surface subagent linkage as soon as we have it. Codex's
	// transcript carries this in the `session_meta` record, which is
	// at or near the top of the rollout JSONL.
	primeSubagentLink(p)

	switch event {
	case "SessionStart":
		return in.Emit.EmitSession(buildSession(in, p, vcs, cls, permissionMode, cwd, "started", time.Time{}))

	case "UserPromptSubmit":
		stampTurnFragment(p, in.ContentCapture, func(f *sessionstate.CodexTurnFragment) {
			if in.ContentCapture == semconv.CodingAgentContentCaptureFull && p.Prompt != "" {
				f.Prompt = p.Prompt
			}
			if f.StartedAt.IsZero() {
				f.StartedAt = parseEventTime(p.Timestamp)
			}
		})
		// Cheap event so the chat timeline can show "user submitted
		// a prompt" even before Stop fires. The full LLM-turn span
		// is emitted at Stop.
		return in.Emit.EmitEvent(normalize.EventEmission{
			SessionID: p.SessionID,
			Name:      "coding_agent.user_prompt.submit",
			At:        parseEventTime(p.Timestamp),
			Attrs: map[string]any{
				"coding_agent.client":  in.Vendor,
				"coding_agent.turn.id": p.TurnID,
				"code.cwd":             cwd,
				"gen_ai.request.model": p.Model,
			},
		})

	case "PreToolUse":
		// Pre-event only. The authoritative tool span fires at
		// PostToolUse to avoid double-counting.
		return in.Emit.EmitEvent(normalize.EventEmission{
			SessionID: p.SessionID,
			Name:      "coding_agent.tool.requested",
			At:        parseEventTime(p.Timestamp),
			Attrs: map[string]any{
				"coding_agent.client":  in.Vendor,
				"coding_agent.turn.id": p.TurnID,
				"gen_ai.tool.name":     p.ToolName,
				"gen_ai.tool.call.id":  p.ToolUseID,
				"code.cwd":             cwd,
				"gen_ai.request.model": p.Model,
			},
		})

	case "PostToolUse":
		t := buildToolCall(in, p, cwd)
		_ = in.Emit.EmitToolCall(t)
		// Detect agent-attributed git commits / PR creations from
		// shell-style tools. Codex emits `shell` and `local_shell`.
		// We only attribute when the tool completed successfully —
		// a failed git invocation does NOT count toward the commit
		// / PR rollups.
		if normalizeStatus(p) != "error" {
			emitGitArtifactsCodex(in, p, cwd)
		}
		// apply_patch is Codex's edit tool. Parse the patch body
		// into per-file LinesAdded / LinesRemoved counts and emit
		// one EditDecision per file. The decision is `auto_accepted`
		// because Codex applies patches without an interactive
		// review step (the diff is shown but the apply is the
		// default action) — matches today's auto_accept behavior on
		// Cursor's afterFileEdit.
		if isApplyPatchTool(p.ToolName) && normalizeStatus(p) != "error" {
			emitApplyPatchEditDecisions(in, p, cwd)
		}
		// Cache the call on the turn fragment so the Stop event can
		// render it as a `tool_call` / `tool_call_response` part in
		// `gen_ai.input.messages` + `gen_ai.output.messages`.
		stampTurnFragment(p, in.ContentCapture, func(f *sessionstate.CodexTurnFragment) {
			rec := sessionstate.CodexToolRecord{
				ToolName:    p.ToolName,
				ToolUseID:   p.ToolUseID,
				Status:      normalizeStatus(p),
				Cwd:         cwd,
				CompletedAt: p.Timestamp,
				DurationMs:  durationMsOr(p.ToolDurationMs, p.DurationMs),
			}
			if rec.Status == "error" {
				rec.ErrorMessage = errorMessage(p.Error)
			}
			if in.ContentCapture == semconv.CodingAgentContentCaptureFull {
				if len(p.ToolInput) > 0 {
					rec.ToolInput = string(p.ToolInput)
				}
				resp := p.ToolResponse
				if len(resp) == 0 {
					resp = p.ToolOutput
				}
				if len(resp) > 0 {
					rec.ToolResponse = string(resp)
				}
			}
			f.Tools = append(f.Tools, rec)
		})
		return nil

	case "Stop":
		// Stop closes one turn. Drain the turn fragment, tail the
		// transcript for authoritative token usage, and emit one
		// `coding_agent.llm.turn` span — the canonical
		// "generation" record per OTel GenAI.
		emitTurnOnStop(in, p, cwd, permissionMode)
		// Codex has NO `SessionEnd` event — the rollout just ends
		// when the user closes the Codex CLI. We periodically
		// re-emit the session-root span so the Sessions row lights
		// up with up-to-the-turn rollups. Deterministic SpanIDs
		// collapse all re-emits onto the same `otel_traces` row,
		// so this is purely a wire / CPU optimisation; throttle to
		// at most once per ~60s of wall-clock so long Codex
		// sessions (which can fire dozens of Stop events per
		// minute) don't ship a redundant session-root span per
		// turn.
		if shouldEmitCodexSessionRoot(p.SessionID) {
			s := buildSession(in, p, vcs, cls, permissionMode, cwd, "ended", parseEventTime(p.Timestamp))
			s.Outcome = semconv.CodingAgentSessionOutcomeCompleted
			_ = in.Emit.EmitSession(s)
			markCodexSessionRootEmitted(p.SessionID)
		}
		// Low-cost loop event so the Sessions tab can count turns
		// without scanning the LLM-turn span every time.
		return in.Emit.EmitEvent(normalize.EventEmission{
			SessionID: p.SessionID,
			Name:      "coding_agent.session.loop.stop",
			At:        parseEventTime(p.Timestamp),
			Attrs: map[string]any{
				"coding_agent.client":            in.Vendor,
				"coding_agent.hook.event":        event,
				"coding_agent.turn.id":           p.TurnID,
				"coding_agent.session.loop.kind": "assistant_turn_end",
				"coding_agent.session.outcome":   semconv.CodingAgentSessionOutcomeCompleted,
				"codex.stop_hook_active":         p.StopHookActive,
			},
		})

	default:
		return in.Emit.EmitEvent(normalize.EventEmission{
			SessionID: p.SessionID,
			Name:      "coding_agent.hook.unknown_event",
			At:        time.Now(),
			Attrs: map[string]any{
				"coding_agent.hook.event": event,
				"coding_agent.client":     in.Vendor,
			},
		})
	}
}

// codexSessionRootMinInterval is the minimum wall-clock between
// session-root re-emits during a Codex chat. Deterministic SpanIDs
// collapse repeated emissions onto the same `otel_traces` row, but
// the OTLP send still costs CPU + bytes on every Stop event. 60s is
// a sane middle ground: dashboards refresh fast enough that the
// Sessions row lights up within a single observation cycle, while
// dense back-and-forth sessions don't ship one duplicate root span
// per turn.
const codexSessionRootMinInterval = 60 * time.Second

// shouldEmitCodexSessionRoot reports whether enough wall-clock has
// passed since the last session-root emission for this session to
// justify another. Always allows the first emission (cache miss).
func shouldEmitCodexSessionRoot(sessionID string) bool {
	if sessionID == "" {
		return true
	}
	st := sessionstate.Load(sessionID, "codex")
	if st == nil || st.LastSessionRootEmitAt.IsZero() {
		return true
	}
	return time.Since(st.LastSessionRootEmitAt) >= codexSessionRootMinInterval
}

// markCodexSessionRootEmitted records that we just emitted the
// session-root s
```

### Core Architecture Module: `cli/internal/coding/hook/codex/transcript.go`
```
// Codex rollout/transcript JSONL reader.
//
// Codex writes one JSONL record per event under
// ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl. Every record has a
// `type` discriminator. The shapes we care about for telemetry are:
//
//	{"type":"session_meta",  "payload":{...}}
//	{"type":"turn_context",  "payload":{"turn_id":"..."}}
//	{"type":"response_item", "payload":{"type":"function_call"|"message"|"reasoning",...}}
//	{"type":"event_msg",     "payload":{"type":"token_count","info":{...}}}
//
// The token-count delta algorithm here: Codex's `token_count` events
// fire several times per turn and the `info.total_token_usage` field
// is a running cumulative counter for the entire session. To get
// *this* turn's usage we subtract the baseline (the value observed
// just before the assistant started producing model output for this
// turn) from the final (the value observed at end of turn).

package codex

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// maxTranscriptScan caps how many bytes of one rollout we'll read.
// Long sessions (hours of dense usage) can exceed our 4 MiB tail-file
// budget; we accept slight undercount on those rather than blow the
// 5s hook timeout.
const maxTranscriptScan = 32 * 1024 * 1024

// maxLineLen is the per-line scanner buffer ceiling. Codex's
// `response_item` records that wrap large tool outputs can be hundreds
// of KiB; 1 MiB is a comfortable safety margin.
const maxLineLen = 1 * 1024 * 1024

// codexLine is the outer JSON envelope every line in a rollout
// transcript shares.
type codexLine struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

// sessionMeta captures the subset of fields Codex's `session_meta`
// record exposes about subagent linkage. We collapse the legacy
// `parent_thread_id` / `Source.Subagent.ThreadSpawn.*` fallbacks
// into the same struct so both old and new transcript versions are
// handled.
type sessionMeta struct {
	SessionID       string
	ThreadSource    string
	ParentSessionID string
	AgentRole       string
	AgentNickname   string
	AgentDepth      int
}

// codexTokenUsage mirrors the per-turn token counters Codex emits in
// every `token_count` event. We use the same field names as the wire
// format so a JSON unmarshal in `parseTokenUsageInfo` is trivial.
type codexTokenUsage struct {
	InputTokens           int64 `json:"input_tokens"`
	CachedInputTokens     int64 `json:"cached_input_tokens"`
	OutputTokens          int64 `json:"output_tokens"`
	ReasoningOutputTokens int64 `json:"reasoning_output_tokens"`
	TotalTokens           int64 `json:"total_tokens"`
}

// codexTokenUsageInfo is the payload of a `token_count` event_msg. The
// `last_token_usage` is the most recent single-shot, and
// `total_token_usage` is the cumulative for the entire session — we
// subtract the baseline from the final cumulative to attribute usage
// to a specific turn.
type codexTokenUsageInfo struct {
	TotalTokenUsage    codexTokenUsage `json:"total_token_usage"`
	LastTokenUsage     codexTokenUsage `json:"last_token_usage"`
	ModelContextWindow int64           `json:"model_context_window"`
}

// codexTokenSnapshot is the result of scanning a transcript for a
// specific turn's token usage. `TurnUsage` is the attributed-to-turn
// delta we surface as `gen_ai.usage.*`. `TotalUsage` keeps the
// cumulative numbers so the session-root rollup is also possible.
type codexTokenSnapshot struct {
	TurnID             string
	TurnUsage          codexTokenUsage
	BaselineUsage      codexTokenUsage
	LastUsage          codexTokenUsage
	TotalUsage         codexTokenUsage
	ModelContextWindow int64
}

// readSessionMeta scans the head of a transcript for the first
// `session_meta` block. Returns ok=false when the file is missing or
// the block can't be parsed.
func readSessionMeta(path string) (sessionMeta, bool) {
	var found sessionMeta
	ok := false
	_ = scanCodexLines(path, func(raw []byte) (bool, error) {
		var l codexLine
		if err := json.Unmarshal(raw, &l); err != nil || l.Type != "session_meta" {
			return false, nil
		}
		meta, mok := parseSessionMeta(l.Payload)
		if !mok {
			return true, nil
		}
		found = meta
		ok = true
		return true, nil
	})
	return found, ok
}

// readTokenUsageForTurn scans `path` for the cumulative token-usage
// snapshots that bracket Codex's `turn_id`. Returns ok=false when:
//   - `path` or `turnID` are empty
//   - the transcript can't be opened or never contained the turn
//   - the delta would be non-positive (defensive guard against
//     out-of-order rollout writes)
//
// On success the returned snapshot's `TurnUsage` is the per-turn delta
// suitable for emitting as `gen_ai.usage.input_tokens`,
// `gen_ai.usage.output_tokens`, `gen_ai.usage.cache.read_input_tokens`,
// and `coding_agent.llm.reasoning_tokens`.
func readTokenUsageForTurn(path, turnID string) (codexTokenSnapshot, bool) {
	if path == "" || turnID == "" {
		return codexTokenSnapshot{}, false
	}

	var (
		activeTurnID      string
		seenAnyTurn       bool
		targetStarted     bool
		targetIsFirstTurn bool
		targetModelActive bool
		haveBaseline      bool
		baseline          codexTokenUsage
		haveLastTotal     bool
		lastTotal         codexTokenUsage
		haveFinal         bool
		finalInfo         codexTokenUsageInfo
	)

	err := scanCodexLines(path, func(raw []byte) (bool, error) {
		var l codexLine
		if err := json.Unmarshal(raw, &l); err != nil {
			return false, nil
		}
		switch l.Type {
		case "turn_context":
			nextTurnID := parseCodexTurnID(l.Payload)
			if nextTurnID == "" {
				return false, nil
			}
			if !seenAnyTurn {
				targetIsFirstTurn = nextTurnID == turnID
			}
			seenAnyTurn = true
			activeTurnID = nextTurnID
			if nextTurnID == turnID && !targetStarted {
				targetStarted = true
				targetModelActive = false
				if haveLastTotal {
					baseline = lastTotal
					haveBaseline = true
				}
			}
		case "response_item":
			if activeTurnID != turnID || !targetStarted {
				return false, nil
			}
			if isModelActivity(l.Payload) {
				targetModelActive = true
			}
		case "event_msg":
			info, ok := parseTokenUsageInfo(l.Payload)
			if !ok {
				return false, nil
			}
			if activeTurnID == turnID && targetStarted {
				if !targetModelActive {
					// pre-model snapshots roll forward the baseline
					baseline = info.TotalTokenUsage
					haveBaseline = true
					lastTotal = info.TotalTokenUsage
					haveLastTotal = true
					return false, nil
				}
				finalInfo = info
				haveFinal = true
			}
			lastTotal = info.TotalTokenUsage
			haveLastTotal = true
		}
		return false, nil
	})
	if err != nil || !targetStarted || !haveFinal {
		return codexTokenSnapshot{}, false
	}
	if !haveBaseline {
		if !targetIsFirstTurn {
			return codexTokenSnapshot{}, false
		}
		baseline = codexTokenUsage{}
	}
	turnUsage, ok := subtractCodexUsage(finalInfo.TotalTokenUsage, baseline)
	if !ok || !hasPositiveCodexUsage(turnUsage) {
		return codexTokenSnapshot{}, false
	}
	return codexTokenSnapshot{
		TurnID:             turnID,
		TurnUsage:          turnUsage,
		BaselineUsage:      baseline,
		LastUsage:          finalInfo.LastTokenUsage,
		TotalUsage:         finalInfo.TotalTokenUsage,
		ModelContextWindow: finalInfo.ModelContextWindow,
	}, true
}

// scanCodexLines reads the file line-by-line, invoking visit on each.
// Stops when visit returns done=true or the byte budget is exceeded.
// Best-effort: a corrupt line is skipped silently, never fatal.
func scanCodexLines(path string, visit func(raw []byte) (bool, error)) error {
	if strings.HasPrefix(path, "~/") {
		if home, err := os.UserHomeDir(); err == nil {
			path = filepath.Join(home, strings.TrimPrefix(path, "~/"))
		}
	}
	f, err := os.Open(path) //nolint:gosec // path comes from the codex hook payload
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()

	scanner := bufio.NewScanner(f)
	scanner.Buffer(make([]byte, 0, 64*1024), maxLineLen)
	var read int64
	for scanner.Scan() {
		read += int64(len(scanner.Bytes())) + 1
		if read > maxTranscriptScan {
			return fmt.Errorf("codex transcript byte budget exceeded")
		}
		done, err := visit(scanner.Bytes())
		if err != nil {
			return err
		}
		if done {
			return nil
		}
	}
	return scanner.Err()
}

// parseSessionMeta reads the session_meta envelope on a Codex
// transcript header. Only the current top-level layout is supported —
// older Codex builds shipped the fields under
// source.subagent.thread_spawn.*, which we no longer maintain.
// Returns ok=true only when at least one identifying field is
// non-empty.
func parseSessionMeta(raw json.RawMessage) (sessionMeta, bool) {
	var p struct {
		ID              string `json:"id"`
		ThreadSource    string `json:"thread_source"`
		ParentSessionID string `json:"parent_session_id"`
		AgentRole       string `json:"agent_role"`
		AgentNickname   string `json:"agent_nickname"`
		AgentDepth      int    `json:"agent_depth"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		return sessionMeta{}, false
	}
	meta := sessionMeta{
		SessionID:       p.ID,
		ThreadSource:    p.ThreadSource,
		ParentSessionID: p.ParentSessionID,
		AgentRole:       p.AgentRole,
		AgentNickname:   p.AgentNickname,
		AgentDepth:      p.AgentDepth,
	}
	if meta.ThreadSource == "" && meta.ParentSessionID != "" {
		meta.ThreadSource = "subagent"
	}
	if meta.SessionID == "" && meta.ParentSessionID == "" && meta.ThreadSource == "" {
		return sessionMeta{}, false
	}
	return meta, true
}

func parseCodexTurnID(raw json.RawMessage) string {
	var p struct {
		TurnID string `json:"turn_id"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		return ""
	}
	return p.TurnID
}

func parseTokenUsageInfo(raw json.RawMessage) (codexTokenUsageInfo, bool) {
	var p struct {
		Type string               `json:"type"`
		Info *codexTokenUsageInfo `json:"info"`
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		return codexTokenUsageInfo{}, false
	}
	if p.Type != "token_count" || p.Info == nil
```

### Core Architecture Module: `cli/internal/coding/hook/cursor/cursor.go`
```
// Package cursor implements the Cursor hook adapter.
//
// Cursor exposes 8 hook events; payloads are JSON on stdin. Cursor has
// no transcript file we can tail, so we rely entirely on the hooks +
// any LLM activity also flowing through OTel from the agent's own
// instrumentation (where available). Adapter logic lives in handle.go.
package cursor

import (
	"context"

	"github.com/openlit/openlit/cli/internal/coding/normalize"
	"github.com/openlit/openlit/sdk/go/semconv"
)

// New returns a new Cursor adapter.
func New() normalize.Adapter { return &adapter{} }

type adapter struct{}

func (a *adapter) Vendor() string { return semconv.CodingAgentVendorCursor }

func (a *adapter) Handle(ctx context.Context, in normalize.Input) error {
	return handle(ctx, in)
}

```

### Core Architecture Module: `cli/internal/coding/hook/cursor/handle.go`
```
package cursor

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/openlit/openlit/cli/internal/coding/classify"
	"github.com/openlit/openlit/cli/internal/coding/detect"
	"github.com/openlit/openlit/cli/internal/coding/git"
	"github.com/openlit/openlit/cli/internal/coding/normalize"
	"github.com/openlit/openlit/cli/internal/coding/sessionstate"
	"github.com/openlit/openlit/sdk/go/semconv"
)

// cursorPayload is a wide JSON struct that covers every field across
// all 13+ Cursor hook events we subscribe to. Each event populates a
// different subset; we union them so we don't have to multiplex on the
// event name at unmarshal time. Unknown fields are ignored, so if
// Cursor adds keys we silently keep working.
//
// Field reference: cursor.com/docs/hooks (2026-05).
type cursorPayload struct {
	HookEventName string `json:"hook_event_name"`

	// Common identifiers across most events.
	ConversationID string   `json:"conversation_id"`
	GenerationID   string   `json:"generation_id"`
	SessionID      string   `json:"session_id"`
	UserEmail      string   `json:"user_email"`
	CursorVersion  string   `json:"cursor_version"`
	WorkspaceRoots []string `json:"workspace_roots"`
	IsBackground   bool     `json:"is_background_agent"`
	ComposerMode   string   `json:"composer_mode"`
	Model          string   `json:"model"`

	// beforeSubmitPrompt
	Prompt      string             `json:"prompt"`
	Attachments []cursorAttachment `json:"attachments"`

	// afterAgentResponse / afterAgentThought
	Text       string `json:"text"`
	DurationMs int64  `json:"duration_ms"`

	// Token usage — Cursor ships these on afterAgentResponse and stop.
	// Absent on older builds and on beforeSubmitPrompt. We only trust
	// these fields on `stop` (full-turn counts including tools +
	// cache); we never invent tokens from text length. Pointers so we
	// can tell "missing" from an explicit zero.
	InputTokens      *int64 `json:"input_tokens"`
	OutputTokens     *int64 `json:"output_tokens"`
	CacheReadTokens  *int64 `json:"cache_read_tokens"`
	CacheWriteTokens *int64 `json:"cache_write_tokens"`
	Provider         string `json:"provider"`

	// preToolUse / postToolUse / postToolUseFailure
	ToolName     string          `json:"tool_name"`
	ToolUseID    string          `json:"tool_use_id"`
	ToolInput    json.RawMessage `json:"tool_input"`
	ToolOutput   string          `json:"tool_output"`
	ResultJSON   string          `json:"result_json"`
	AgentMessage string          `json:"agent_message"`
	ErrorMessage string          `json:"error_message"`
	FailureType  string          `json:"failure_type"`
	IsInterrupt  bool            `json:"is_interrupt"`
	Duration     int64           `json:"duration"` // postToolUse uses `duration`, not `duration_ms`

	// beforeShellExecution / afterShellExecution
	Command string `json:"command"`
	Output  string `json:"output"`
	Sandbox bool   `json:"sandbox"`
	CWD     string `json:"cwd"`

	// beforeReadFile
	FilePath string `json:"file_path"`
	Content  string `json:"content"`

	// afterFileEdit
	Edits []cursorEdit `json:"edits"`

	// preCompact
	Trigger           string `json:"trigger"`
	ContextUsagePct   int    `json:"context_usage_percent"`
	ContextTokens     int64  `json:"context_tokens"`
	ContextWindowSize int64  `json:"context_window_size"`
	MessageCount      int    `json:"message_count"`
	MessagesToCompact int    `json:"messages_to_compact"`
	IsFirstCompaction bool   `json:"is_first_compaction"`

	// stop / sessionEnd
	Status      string `json:"status"`
	LoopCount   int    `json:"loop_count"`
	Reason      string `json:"reason"`
	FinalStatus string `json:"final_status"`

	// subagentStart
	SubagentID           string `json:"subagent_id"`
	SubagentType         string `json:"subagent_type"`
	Task                 string `json:"task"`
	ParentConversationID string `json:"parent_conversation_id"`
	ToolCallID           string `json:"tool_call_id"`
	SubagentModel        string `json:"subagent_model"`
	IsParallelWorker     bool   `json:"is_parallel_worker"`
	GitBranch            string `json:"git_branch"`

	// subagentStop
	Description     string   `json:"description"`
	Summary         string   `json:"summary"`
	SubMessageCount int      `json:"message_count_subagent"` // alias avoidance — see normalize step
	ToolCallCount   int      `json:"tool_call_count"`
	ModifiedFiles   []string `json:"modified_files"`
	TranscriptPath  string   `json:"agent_transcript_path"`
}

type cursorAttachment struct {
	Type     string `json:"type"`
	FilePath string `json:"file_path"`
}

type cursorEdit struct {
	OldString string `json:"old_string"`
	NewString string `json:"new_string"`
	OldLine   string `json:"old_line"`
	NewLine   string `json:"new_line"`
}

func handle(ctx context.Context, in normalize.Input) error {
	var p cursorPayload
	if err := json.Unmarshal(in.Payload, &p); err != nil {
		fmt.Fprintf(os.Stderr, "openlit: cursor payload parse failed: %v\n", err)
		return nil
	}
	event := in.Event
	if event == "" {
		event = p.HookEventName
	}

	cwd := p.CWD
	if cwd == "" && len(p.WorkspaceRoots) > 0 {
		cwd = p.WorkspaceRoots[0]
	}
	if cwd == "" {
		// last resort — use process cwd
		if wd, err := os.Getwd(); err == nil {
			cwd = wd
		}
	}

	vcs := git.Snapshot(ctx, cwd)
	// v1: the CLI has no path to the org's API-key allowlist, so we
	// flag the API-key signal as unknown (APIKeyAllowlistKnown=false)
	// and let the classifier lean on the repo signal. The earlier
	// "OPENLIT_API_KEY != \"\"" heuristic was actively wrong — having
	// the env var set says nothing about whether the key is recognised
	// by the org and was producing spurious `personal` labels.
	cls := classify.Classify(classify.Inputs{
		APIKeyAllowlistKnown: false,
		APIKeyOnAllowlist:    false,
		RepoURL:              vcs.RepoURL,
		RepoAllowlist:        classify.SplitAllowlist(os.Getenv("OPENLIT_CODING_REPO_ALLOWLIST")),
	})

	// Chat-thread key. Cursor exposes two ids:
	//   - conversation_id: the composer / chat-thread id, stable for
	//     the life of the chat (survives Cursor restarts, plan-mode
	//     toggles, subagent spawns inside the same thread).
	//   - session_id: a per-process / per-invocation id that can be
	//     absent on some events and is not guaranteed stable across
	//     the lifetime of one chat.
	// We use conversation_id as the primary key so every span fired
	// by one chat (including subagents the chat spawns) folds into
	// one chat row. session_id is the fallback when conversation_id
	// is missing (early-lifecycle events on older Cursor builds).
	sessionID := p.ConversationID
	if sessionID == "" {
		sessionID = p.SessionID
	}

	// Mode + model transition events are now emitted centrally in
	// cli/internal/coding/hook/hook.go for ALL three coding agents
	// (Cursor / Claude Code / Codex), so we don't duplicate that
	// logic here. The cache update for the latest value still
	// happens via peekContext + sessionstate.Save in hook.go.

	switch event {
	case "sessionStart":
		return in.Emit.EmitSession(buildSession(in, p, sessionID, vcs, cls, "started", time.Time{}))

	case "sessionEnd":
		// sessionEnd is the authoritative session-closing event. We
		// stamp the outcome from the `reason` / `final_status` fields
		// rather than guessing.
		startedAt := time.Now().Add(-time.Duration(p.DurationMs) * time.Millisecond)
		s := buildSession(in, p, sessionID, vcs, cls, "ended", time.Now())
		if !startedAt.IsZero() && p.DurationMs > 0 {
			s.StartedAt = startedAt
			s.Duration = time.Duration(p.DurationMs) * time.Millisecond
		}
		s.Outcome = outcomeFromReason(p.Reason, p.FinalStatus)
		// Drain real token totals accumulated on each `stop`. Cursor
		// never sends USD; leave CostUSD at 0 rather than inventing
		// list-price estimates. Set on the session here so every
		// capture mode (not only minimal) gets session-root tokens.
		applyAccumulatedTokens(&s, sessionID, in.Vendor)
		return in.Emit.EmitSession(s)

	case "stop":
		// Cursor's `stop` fires when the agent loop terminates. We
		// emit a small event so dashboards can count loop turns; the
		// authoritative session end span comes from sessionEnd.
		//
		// Token accounting: stop is the only place we stamp usage.
		// Cursor's counts here cover the full turn (tools + cache).
		// We never invent tokens or USD — Cursor does not send cost.
		attrs := map[string]any{
			"coding_agent.client":              in.Vendor,
			"coding_agent.hook.event":          event,
			"coding_agent.session.loop.status": p.Status,
			"coding_agent.session.loop.count":  p.LoopCount,
		}
		if inTok, outTok, cacheRead, cacheWrite, ok := realTokenUsage(p); ok {
			attrs["gen_ai.usage.input_tokens"] = inTok
			attrs["gen_ai.usage.output_tokens"] = outTok
			attrs["gen_ai.usage.total_tokens"] = inTok + outTok
			if cacheRead > 0 {
				attrs["gen_ai.usage.cache.read_input_tokens"] = cacheRead
			}
			if cacheWrite > 0 {
				attrs["gen_ai.usage.cache.creation_input_tokens"] = cacheWrite
			}
			if p.Model != "" {
				attrs["gen_ai.request.model"] = p.Model
			}
			accumulateStopTokens(sessionID, in.Vendor, inTok, outTok)
		}
		return in.Emit.EmitEvent(normalize.EventEmission{
			SessionID: sessionID,
			Name:      "coding_agent.session.loop.stop",
			At:        time.Now(),
			Attrs:     attrs,
		})

	case "beforeSubmitPrompt":
		return in.Emit.EmitLLMTurn(buildPromptTurn(in, p, sessionID))

	case "afterAgentResponse":
		return in.Emit.EmitLLMTurn(buildResponseTurn(in, p, sessionID))

	case "afterAgentThought":
		// Thought text only — Cursor does not expose separate thought
		// token counters. Full-turn usage lands on `stop`.
		return in.Emit.EmitLLMTurn(normalize.LLMTurn{
			SessionID:      sessionID,
			ConversationID: p.ConversationID,
			Vendor:         in.Vendor,
			Model:          p.Model,
			StartedAt:      time.Now().Add(-time.Duration(p.DurationMs) * time.Millisecond),
			EndedAt:        time.Now(),
			ThoughtText:    p.Text,
			ThoughtMs:      p.DurationMs,
		})

	case "preToolUse":
		// Pre is int
```

### Core Architecture Module: `cli/internal/coding/hook/hook.go`
```
// Package hook implements `openlit coding hook --vendor=... --event=...`.
//
// This is the hot path: invoked once per agent event by the per-vendor
// host plugin manifests under plugins/<vendor>/. The subcommand reads
// the agent's payload from stdin, normalizes it into coding_agent.* OTel
// spans/events via the per-vendor adapters under hook/<vendor>/, and
// exports via internal/otlp.
//
// Crash isolation rules (non-negotiable):
//   - exits 0 on telemetry-path failure (a broken pipe never blocks the dev)
//   - 5s hard timeout on the entire invocation; 3s of that for OTLP flush
//   - panic-recover wraps the body
//   - never writes to stdout (Claude Code parses stdout for JSON)
package hook

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"runtime/debug"
	"strings"
	"time"

	"github.com/openlit/openlit/cli/internal/coding/git"
	"github.com/openlit/openlit/cli/internal/coding/hook/claudecode"
	"github.com/openlit/openlit/cli/internal/coding/hook/codex"
	"github.com/openlit/openlit/cli/internal/coding/hook/cursor"
	"github.com/openlit/openlit/cli/internal/coding/identity"
	"github.com/openlit/openlit/cli/internal/coding/normalize"
	"github.com/openlit/openlit/cli/internal/coding/sessionstate"
	"github.com/openlit/openlit/cli/internal/config"
	"github.com/openlit/openlit/cli/internal/otlp"
	"github.com/spf13/cobra"
)

const (
	// hardTimeout caps the entire hook invocation. Each adapter is
	// expected to finish well under this, but if any part hangs we'd
	// rather drop the data than wedge the agent.
	hardTimeout = 5 * time.Second
	// flushTimeout is reserved at the end for OTLP shutdown/flush.
	flushTimeout = 3 * time.Second
)

// NewCmd returns the cobra command for `openlit coding hook`.
func NewCmd() *cobra.Command {
	var (
		vendor string
		event  string
	)

	cmd := &cobra.Command{
		Use:   "hook",
		Short: "Process a coding-agent hook event (invoked by host plugin manifests)",
		Long: `Process a coding-agent hook event.

Reads the host plugin's payload from stdin, normalizes it to
coding_agent.* OTel spans/events, and exports via OTLP. The subcommand
always exits 0 on telemetry-path failure so a broken telemetry pipeline
never blocks a developer's prompt.`,
		SilenceUsage:  true,
		SilenceErrors: true,
		RunE: func(cmd *cobra.Command, _ []string) error {
			return run(cmd, vendor, event)
		},
	}

	cmd.Flags().StringVar(&vendor, "vendor", "", "Vendor: cc | claude-code | cursor | codex")
	cmd.Flags().StringVar(&event, "event", "", "Hook event name (vendor-specific; e.g. SessionStart, PreToolUse)")
	_ = cmd.MarkFlagRequired("vendor")

	return cmd
}

func run(cmd *cobra.Command, vendor, event string) (rerr error) {
	// Top-level recover — we promise to never crash the host agent.
	defer func() {
		if r := recover(); r != nil {
			logErrorf("hook panic: %v\n%s", r, debug.Stack())
			rerr = nil
		}
	}()

	// Canonicalize the vendor key once. Plugin manifests historically
	// invoked `--vendor=cc` (short alias) for Claude Code, while
	// sessionstate / adapters / queries.ts all use `claude-code`. The
	// split produced two on-disk caches per session (one under `cc`,
	// one under `claude-code`) that never merged, breaking identity
	// promotion + parent_id replay across consecutive hook events. We
	// no longer need the alias for back-compat, so collapse it here
	// before any downstream code sees the raw flag.
	vendor = canonicalVendor(vendor)

	ctx, cancel := context.WithTimeout(cmd.Context(), hardTimeout)
	defer cancel()

	// Read the entire payload up-front. Hooks send small JSON blobs
	// (a few KB at most), so buffering is fine and lets adapters work
	// against bytes instead of streaming readers.
	payload, err := io.ReadAll(io.LimitReader(os.Stdin, 8<<20)) // 8 MB cap
	if err != nil {
		logErrorf("hook stdin read: %v", err)
		return nil
	}

	// Optional debug tee. When OPENLIT_DEBUG_PAYLOAD_DIR is set we
	// append the raw inbound payload (with a header line) to
	// <dir>/<vendor>-<event>.jsonl. Off by default; exists for
	// "why isn't my prompt landing?" triage where the only way to
	// know what the vendor sent is to inspect the byte stream they
	// piped to stdin. Kept here rather than behind a flag because
	// it has zero cost when the env var is unset.
	if debugDir := strings.TrimSpace(os.Getenv("OPENLIT_DEBUG_PAYLOAD_DIR")); debugDir != "" {
		_ = teePayload(debugDir, vendor, event, payload)
	}

	// Host-mismatch guard.
	//
	// Cursor 3.4+ ships a Claude Code compatibility shim that reads
	// `~/.claude/plugins/<plugin>/hooks/hooks.json` (and Anthropic's
	// CLAUDE_PLUGIN_ROOT / CLAUDE_PROJECT_DIR env envelope) and
	// invokes those hook commands for ITS OWN agent turns, in
	// addition to firing the native `~/.cursor/plugins/*` hooks. So
	// a user who installed both
	// `openlit coding install --vendor=cursor` AND
	// `--vendor=claude-code` would otherwise get every Cursor chat
	// double-emitted: once with --vendor=cursor (the real Cursor
	// plugin) and once with --vendor=cc (Cursor masquerading as
	// Claude Code through the compat shim). The UI then shows the
	// same chat thread on both vendor detail pages, with the
	// Claude Code row carrying Cursor-shaped events
	// (sessionStart instead of SessionStart, etc.).
	//
	// `isRealClaudeCodeInvocation` returns true ONLY when
	// `CLAUDECODE=1` is set — that's the single env signal Claude
	// Code's own runtime sets on every hook subprocess. Cursor's
	// compat shim deliberately mimics CLAUDE_PROJECT_DIR /
	// CLAUDE_PLUGIN_ROOT but does NOT set CLAUDECODE=1 (because the
	// agent driving the turn is Cursor, not Claude Code). So this
	// guard suppresses every Cursor-shaped event reaching the
	// Claude Code adapter while letting real `claude` CLI events
	// through unchanged. Always exits 0 so the host doesn't notice.
	if isClaudeCodeVendor(vendor) && !isRealClaudeCodeInvocation() {
		return nil
	}

	// Surface allow-listed values from ~/.config/openlit/config.env
	// into the process environment BEFORE adapters read them. Per-vendor
	// adapters call os.Getenv directly (e.g. for the repo allowlist),
	// so without this step a value set in config.env would be invisible
	// to them. Existing env vars take precedence so a user's shell
	// override always wins.
	if err := config.PromoteFileToEnv(); err != nil {
		logErrorf("hook config-file env promote: %v", err)
		// non-fatal — the rest of the hook can still proceed without it
	}

	// Resolve the canonical user identity BEFORE the OTel SDK boots so
	// every resource attribute on every span the process emits carries
	// the same value. Without this, the hub's "Users" tab shows two
	// rows for the same human — one with the OAuth email (when
	// OPENLIT_USER is exported), one with the OS username (the last-
	// resort fallback in resolveLocalUser).
	//
	// Priority (highest first):
	//   1. OPENLIT_USER env var (explicit override, usually exported
	//      by the user's shell rc).
	//   2. Vendor's hook payload (Cursor's `user_email`, etc.).
	//   3. Per-session cache (vendor only emits identity on lifecycle
	//      events; cache survives between hook invocations).
	//   4. Per-vendor authoritative file: ~/.claude.json for Claude
	//      Code, ~/.codex/auth.json's JWT for Codex.
	//   5. `git config user.email` — cross-vendor canonical identity
	//      every developer has set.
	//   6. Falls through to OS username inside the OTel exporter.
	//
	// The resolved identity is also persisted to sessionstate so
	// follow-up events that lack an email field in their payload
	// still emit consistently-labeled spans.
	probe := peekContext(payload)
	sessionID := probe.SessionID
	// Cache is partitioned by (sessionID, vendor) — see sessionstate
	// docs for the cross-vendor poisoning case that motivates this.
	cached := sessionstate.Load(sessionID, vendor)
	resolvedUser := strings.TrimSpace(os.Getenv("OPENLIT_USER"))
	if resolvedUser == "" {
		resolvedUser = probe.User
	}
	if resolvedUser == "" {
		resolvedUser = cached.User
	}
	if resolvedUser == "" {
		resolvedUser = identity.ResolveForVendor(vendor)
	}
	if resolvedUser == "" {
		resolvedUser = identity.FromGitConfig()
	}
	if resolvedUser != "" {
		_ = os.Setenv("OPENLIT_USER", resolvedUser)
		cached.User = resolvedUser
	}

	// Working folder, permission mode, and VCS snapshot — sticky
	// session-level facts the trace-detail header expects on every
	// span, even on a tool-call or llm.turn that doesn't itself carry
	// them. We cache the first sighting and replay it as a resource
	// attribute so child spans inherit the session's context. The
	// CLI is short-lived (one process per hook event) so resource
	// attrs are scoped to a single event, which is what we want.
	if probe.CWD != "" {
		cached.CWD = probe.CWD
	}
	// Detect permission-mode and model transitions BEFORE we overwrite
	// the cached values, then emit a small change event so the UI can
	// chart "developer toggled from agent → plan" or "model swapped"
	// for any of the three coding agents (Cursor exposes this as
	// composer_mode, Claude Code as permission_mode, Codex as
	// approval_mode — all collapsed in peekContext into PermissionMode).
	// We need to emit BEFORE OTLP boots so we wait — see the
	// post-emitter detectModeChanges call below.
	prevMode := cached.PermissionMode
	prevModel := cached.Model
	if probe.PermissionMode != "" {
		cached.PermissionMode = probe.PermissionMode
	}
	if probe.Model != "" {
		cached.Model = probe.Model
	}
	if probe.ConversationID != "" {
		cached.ConversationID = probe.ConversationID
	}
	if probe.ParentConversationID != "" {
		cached.ParentConversationID = probe.ParentConversationID
	}
	if probe.IsBackgroundAgent {
		cached.IsBackgroundAgent = true
	}
	// Git snapshot is best-effort: we only run it if we have a CWD
	// (either from the payload or from the cache) AND the cache
	// hasn't already populated it. `git remote -v` per hook event
	// would be wasteful, so the first hook for a session pays the

```

### Core Architecture Module: `cli/internal/coding/sessionstate/flock_unix.go`
```
//go:build darwin || linux || freebsd || netbsd || openbsd

package sessionstate

import (
	"os"
	"path/filepath"
	"syscall"
)

// withFileLock — Unix implementation. See the godoc comment in
// sessionstate.go for the contract. Uses BSD flock so the lock is
// advisory and process-scoped; sufficient for the openlit hook
// pattern (one hook subprocess per agent event, never overlapping
// inside the same process).
func withFileLock(lockPath string, fn func()) {
	if err := os.MkdirAll(filepath.Dir(lockPath), 0o700); err != nil {
		fn()
		return
	}
	f, err := os.OpenFile(lockPath, os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		fn()
		return
	}
	defer f.Close()
	if err := syscall.Flock(int(f.Fd()), syscall.LOCK_EX); err != nil {
		fn()
		return
	}
	defer syscall.Flock(int(f.Fd()), syscall.LOCK_UN)
	fn()
}

```

### Core Architecture Module: `cli/internal/coding/sessionstate/flock_windows.go`
```
//go:build windows

package sessionstate

import (
	"os"
	"path/filepath"

	"golang.org/x/sys/windows"
)

// withFileLock — Windows implementation. See the godoc comment in
// sessionstate.go for the contract. Uses LockFileEx with LOCKFILE_EXCLUSIVE_LOCK
// (no LOCKFILE_FAIL_IMMEDIATELY) so the call blocks until the lock is acquired,
// matching the Unix flock behaviour. The lock is process-scoped and released
// either explicitly via UnlockFileEx or implicitly when the handle is closed —
// either way, a crashed hook cannot orphan the lock.
//
// On any setup failure (mkdir, open, lock acquisition) we fall back to running
// fn unlocked rather than dropping the event entirely: telemetry must never
// fail closed on an OS-level hiccup. The worst case is a single last-write-wins
// collision on the session-state file, which the in-process diskMu still
// guards against within a single process.
func withFileLock(lockPath string, fn func()) {
	if err := os.MkdirAll(filepath.Dir(lockPath), 0o700); err != nil {
		fn()
		return
	}
	f, err := os.OpenFile(lockPath, os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		fn()
		return
	}
	defer f.Close()

	// LockFileEx locks a byte range; pass a max range so we cover the
	// whole (currently-empty) lock file regardless of any future writes.
	// An overlapped structure with zeroed offsets locks from byte 0.
	var ol windows.Overlapped
	const exclusive = windows.LOCKFILE_EXCLUSIVE_LOCK
	if err := windows.LockFileEx(windows.Handle(f.Fd()), exclusive, 0, 0xFFFFFFFF, 0xFFFFFFFF, &ol); err != nil {
		fn()
		return
	}
	defer windows.UnlockFileEx(windows.Handle(f.Fd()), 0, 0xFFFFFFFF, 0xFFFFFFFF, &ol)
	fn()
}

```

### Core Architecture Module: `cli/internal/coding/sessionstate/sessionstate.go`
```
// Package sessionstate persists tiny per-session facts that the CLI
// needs to remember across hook invocations.
//
// Each hook invocation is a fresh process, so any state the host plugin
// doesn't replay on every event has to be cached on disk. We use this
// for two things today:
//
//  1. **User identity** (Cursor's `user_email`, etc.) — vendors only
//     emit it on a subset of events, so we cache it after the first
//     event and replay it as a resource attribute on every subsequent
//     hook invocation in the same session.
//  2. **Last-seen mode + model** — Cursor's composer_mode (agent / ask
//     / plan) and request model can change mid-session. We cache the
//     most recent value and let the per-vendor adapter compare it
//     against the new payload to emit a `coding_agent.permission_mode.changed`
//     event when the user toggles modes.
//
// The cache lives under $XDG_CACHE_HOME/openlit/sessions/<sid>.json.
// Files are bounded in size (a few hundred bytes each), are written
// 0600, and are best-effort: a corrupt or missing file falls through to
// the empty state and the hook proceeds without it.
package sessionstate

import (
	"encoding/json"
	"math/rand"
	"os"
	"path/filepath"
	"regexp"
	"sync"
	"time"
)

// gcMaxAge is the on-disk retention for a session cache entry.
// Entries older than this are reaped by GC() on a probabilistic
// schedule. Bumped well above any plausible chat thread length so
// resuming an idle conversation still finds its cached identity.
const gcMaxAge = 7 * 24 * time.Hour

// gcEvery controls the GC sampling probability. We run GC on roughly
// 1 in N hook invocations rather than every call (most hooks run in
// <50 ms; an unconditional readdir per hook would noticeably slow the
// hot path on machines with thousands of session files).
const gcEvery = 1000

// State holds the per-session facts we currently track. Add fields
// here when a vendor adds another sticky attribute we want to compare
// against on later hook events.
type State struct {
	// User is the identity to stamp on resource attrs when the
	// vendor's payload doesn't carry one.
	User string `json:"user,omitempty"`

	// PermissionMode is Cursor's composer_mode / Claude Code's
	// permission mode. Values: "agent" | "ask" | "plan" |
	// "acceptEdits" | "bypassPermissions" | "default" | "auto".
	PermissionMode string `json:"permission_mode,omitempty"`

	// Model is the most recently-seen model id (e.g.
	// "claude-opus-4-7-thinking-xhigh"). Cursor reports this on
	// every prompt-bearing event; tracking it lets us emit a
	// model-changed event mid-session.
	Model string `json:"model,omitempty"`

	// CWD is the working folder the agent runs in for this session.
	// Cached so spans emitted by hook events that lack a cwd in
	// their payload (e.g. afterAgentResponse / stop) still carry the
	// session's working folder as a resource attribute.
	CWD string `json:"cwd,omitempty"`

	// RepoURL / Branch are the VCS snapshot taken at session start.
	// Re-snapshotting on every hook event would mean a `git remote
	// -v` + `git rev-parse` per event; caching the first snapshot is
	// fine because branch changes mid-session are rare and the next
	// cold-start hook event re-runs git anyway.
	RepoURL string `json:"repo_url,omitempty"`
	Branch  string `json:"branch,omitempty"`

	// ConversationID is Cursor's `conversation_id` (or equivalent on
	// other vendors). Cached separately from SessionID because they
	// may differ when a subagent is running: the subagent's own
	// session_id is fresh but it inherits the parent's
	// conversation_id, which is what we want to roll up in the UI.
	ConversationID string `json:"conversation_id,omitempty"`

	// ParentConversationID points at the spawning agent's chat
	// thread, when this session is a subagent of another. Stamped
	// from Cursor's `parent_conversation_id` field — present on
	// subagentStart and (we hope) on subagent's own hook events.
	// The UI uses this to fold subagent rows under their parent
	// chat instead of listing them as standalone sessions.
	ParentConversationID string `json:"parent_conversation_id,omitempty"`

	// IsBackgroundAgent is true when Cursor's payload flags the
	// session as a background / parallel-worker agent. UI hides
	// these from the default Sessions list and shows them inside
	// the parent chat's trace detail instead.
	IsBackgroundAgent bool `json:"is_background_agent,omitempty"`

	// SessionRolledUp counters that Phase C's minimal mode emits on
	// sessionEnd in lieu of per-event spans. Always safe to populate;
	// only consumed when the active capture mode is "minimal".
	ToolCallCount int     `json:"tool_call_count,omitempty"`
	SubagentCount int     `json:"subagent_count,omitempty"`
	InputTokens   int64   `json:"input_tokens,omitempty"`
	OutputTokens  int64   `json:"output_tokens,omitempty"`
	CostUSD       float64 `json:"cost_usd,omitempty"`

	// Per-session code-change rollups accumulated across hook
	// invocations and stamped on the session-root span at
	// SessionEnd. All four line totals are absolute (not deltas).
	// Adapters bump these via the shared bumpCounters helper
	// regardless of content-capture mode — line counts are not
	// considered user content and are always safe to record.
	LinesAdded      int `json:"lines_added,omitempty"`
	LinesRemoved    int `json:"lines_removed,omitempty"`
	LinesAccepted   int `json:"lines_accepted,omitempty"`
	LinesRejected   int `json:"lines_rejected,omitempty"`
	EditAcceptCount int `json:"edit_accept_count,omitempty"`
	EditRejectCount int `json:"edit_reject_count,omitempty"`
	CommitCount     int `json:"commit_count,omitempty"`
	PRCount         int `json:"pr_count,omitempty"`

	// PendingEdits is the rejection-heuristic backing store for
	// vendors that emit a Pre+Post pair around their edit tool
	// (Claude Code's PreToolUse / PostToolUse for Edit / Write /
	// MultiEdit). Keyed by the vendor's tool-use id, value is the
	// proposed change we'd attribute as rejected if the Post never
	// fires for this turn. UserPromptSubmit / SessionEnd drain
	// leftover entries as rejections; PostToolUse resolves them as
	// accepts and removes the entry. Bounded to ~32 entries per
	// session so a runaway agent can't grow the cache unbounded.
	PendingEdits map[string]*PendingEdit `json:"pending_edits,omitempty"`

	// TerminalType is the resolved IDE/terminal hosting the agent
	// (e.g. `vscode`, `cursor`, `iterm`). Sourced from Claude Code's
	// transcript `entrypoint` (most reliable) or env / process-tree
	// detection (fallback). Cached so the session-root span and every
	// follow-up span agree on the value.
	TerminalType string `json:"terminal_type,omitempty"`

	// TranscriptPath is the absolute path to the vendor's transcript
	// JSONL (Claude Code's `transcript_path`). Cached so non-lifecycle
	// hook events (Stop / PostToolUse) can resume reading without the
	// payload re-shipping it.
	TranscriptPath string `json:"transcript_path,omitempty"`

	// TranscriptOffset is the byte position the transcript reader
	// last advanced to. Subsequent hook events resume reading from
	// here; only new assistant turns produce new LLM-turn spans.
	TranscriptOffset int64 `json:"transcript_offset,omitempty"`

	// EmittedAssistantTurnIDs records assistant `requestId`s we've
	// already emitted as LLM-turn spans. Defensive de-dup so a
	// retried hook event or a transcript rewrite (Claude Code's
	// streaming fragments) doesn't double-count tokens or chat
	// content. Bounded to the most recent ~256 ids.
	EmittedAssistantTurnIDs []string `json:"emitted_assistant_turn_ids,omitempty"`

	// CodexTurns holds per-turn fragments for the Codex adapter,
	// keyed by Codex's `turn_id`. Codex's hook protocol scopes
	// every event to a turn (UserPromptSubmit, PreToolUse,
	// PostToolUse, Stop all carry `turn_id`), and only `Stop`
	// gives us the assistant's final text + token totals. Adapters
	// accumulate the prompt and per-tool records on intermediate
	// events and drain the fragment into one `coding_agent.llm.turn`
	// span on Stop. Bounded to the most recent ~16 turn fragments
	// so a long session doesn't grow this map unbounded.
	CodexTurns map[string]*CodexTurnFragment `json:"codex_turns,omitempty"`

	// CodexSubagent caches the parent-session linkage we extracted
	// from Codex's transcript `session_meta` block at SessionStart.
	// Stamped on every subsequent span this session emits so the UI
	// can fold subagent runs under their spawning chat.
	CodexSubagent *CodexSubagentLink `json:"codex_subagent,omitempty"`

	// ActiveTaskToolUseID is the `tool_use_id` of the most recent
	// Claude Code Task tool invocation. Claude Code's subagents don't
	// fire intermediate hooks — only PreToolUse(Task) at spawn time
	// and SubagentStop at completion. Caching the spawning tool-use
	// id here lets us echo it onto the SubagentStop span as
	// `gen_ai.tool.call.id`, which the chat view uses to group the
	// Task tool call + subagent block into one collapsible item.
	// Cleared on SubagentStop.
	ActiveTaskToolUseID string `json:"active_task_tool_use_id,omitempty"`

	// SessionStartedAt is the wall-clock at which we first saw a
	// `SessionStart` (or equivalent) lifecycle event for this
	// (sessionID, vendor) pair. Cached so SessionEnd / sessionEnd can
	// compute a real duration without depending on the vendor to
	// re-ship the start time. Previously Claude Code rolled this in
	// as `StartedAt = time.Now()` at *both* events, producing ~0ms
	// session durations across the board.
	SessionStartedAt time.Time `json:"session_started_at,omitempty"`

	// LastSessionRootEmitAt is the wall-clock of the most recent
	// `coding_agent.session` span emission. Used by Codex (which has
	// no SessionEnd hook and would otherwise re-emit the session-
	// root span on EVERY Stop event) to throttle re-emits to once
	// every ~60s. Deterministic SpanIDs ensure all re-emits collapse
	// onto a single `otel_traces` row in Cl
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1519** (2026-09-11): **Bug: ClickHouse migrations report success after partially failing on an auth error, leaving the application schema incomplete**
  *Symptoms*: ### Component  OpenLIT  ### What happened?  When OpenLIT cannot authenticate to ClickHouse partway through initialisation, it creates the otel_* and openlit_controller_* tables, fails to create any application tables, and then reports success and continues — logging ClickHouse tables created, running the data migration, and reporting Seeding Dashboards Completed (seeded 4, skipped 0).  The failure only surfaces later as UNKNOWN_TABLE errors at runtime, in a component unrelated to the actual cause. This makes the root cause very difficult to identify.  ### Steps to reproduce  A ClickHouse container was first initialised without a .env file present, or with a path fail or other defect in .env.  So it took the compose fallback password. A .env with a different password was added afterwards. **_Because CLICKHOUSE_PASSWORD is only honoured on first initialisation of the data directory_**, OpenLIT was then configured with credentials ClickHouse did not have.  This is user error and I'm not reporting it as a bug. The bug is that OpenLIT's response to it was to report success making triage of the subsequent failure difficult.  SHOW TABLES FROM openlit at this point returned only the six openlit_controller_* tables and the nine otel_* tables — no application tables at all.   This led me to go back and repull the previously successful logs, and renumerate the chain of events, where I discovered the mismatch env.   [DB-Conn-Fail.txt](https://github.com/user-attachments/files/31821869/DB
  **Post-Mortem & Fix Analysis**:
  > Implemented in PR #1522. ClickHouse migration orchestration now fails on reported query errors or incomplete batches, preserves the underlying error, and prevents dependent migrations from continuing. Dashboard seeding now runs only after all four expected dashboard tables (openlit_folder, openlit_board, openlit_widget, openlit_board_widget) are verified; missing table names are reported. Added regression coverage for fail-fast orchestration, missing-table reporting, and seed suppression. Local focused tests, lint, and production build pass; the full Jest run had 3,209 passed tests, with the remaining failures limited to existing Windows/JSDOM baseline issues in path, locale, and Prisma/TextEncoder behavior. The PR is awaiting repository review and approval gates.

- **Issue #1518** (2026-09-08): **Bug: Onboarding in inescapable loop on :latest.. Step 3 renders no db config ui option.**
  *Symptoms*: ### Component  OpenLIT  ### What happened?  On a fresh Docker Compose deployment using ghcr.io/openlit/openlit:latest, the onboarding wizard skips step 2 and lands on step 3 ("connect a database") with no interactive elements at all — no "Add new config" button, no modal, no form. Every other route (/home, /dashboard, /requests) redirects back to /onboarding, so the instance is unusable.  Pinning to a tagged release, with an otherwise identical compose file, ClickHouse volume, and configuration, renders the same step correctly with an "Add new config" control available. This appears to be a regression in latest. Works great and as intended.   The backend is healthy throughout: ClickHouse contains the complete application schema, credentials authenticate, and OTLP ingestion works — traces from a LiteLLM proxy land in otel_traces the whole time the UI is inaccessible.  ### Steps to reproduce  Openlit latest Clickhouse 24.4.1 Host: Docker desktop, Windows 11, WSL2 Backend Deploy: Docker compose from repo's docker-compose.yml telemetry source: LiteLLM Latest:otel callback over http (local net)  Deviation from Norms:  Existing openwebui instance is pinned to tcp:3000 so openlit compose WAS changes to 3001 to avoid port conflict.  Wait for INIT_DB_* to seed ClickHouse connection.   Login, create account. Add an arbitrary org name 'My cool org'. UI Skips step 2, bypass step 3 DB onboard. Fails in an infinite loop.   Wiping the openlit-data volume and re-running does not help — onboa

- **Issue #1418** (2026-07-31): **Bug: x86_64 CUDA eBPF decodes cudaLaunchKernel arguments incorrectly (block size and core usage are zero)**
  *Symptoms*: ### Component  OpenTelemetry GPU Collector  ### What happened?  On Linux x86_64 with an NVIDIA Tesla T4 and CUDA 13, the OpenTelemetry GPU Collector successfully attaches to a dynamically linked libcudart.so and exports CUDA eBPF metrics. However:  - gpu.kernel.block.size_sum is always 0, although every test launch uses a block size of 256. - process.gpu.core.usage is always 0 under sustained load (about 90% GPU utilization). - cuda.kernel.name falls back to an ASLR-dependent 0x... address instead of the kernel symbol.  Other values from the same workload are correct:  - gpu.kernel.grid.size_sum / gpu.kernel.grid.size_count = 2048 - gpu.memory.allocations = 1073741824 bytes (1 GiB) - maximum gpu.memory.copies value = 16777216 bytes (16 MiB) - device GPU utilization reaches 0.91 - process GPU utilization reaches 0.90  This indicates that attachment, event transport, OTLP export, and metric aggregation are working, while cudaLaunchKernel argument decoding is incorrect.  The current x86 branch in opentelemetry-gpu-collector/internal/ebpf/bpf/gpuevent.c reads block_x from the high half of PT_REGS_PARM3. For the x86_64 SysV ABI, PT_REGS_PARM3 contains gridDim.z plus padding; blockDim.x/y are in PT_REGS_PARM4 and blockDim.z is in PT_REGS_PARM5. This explains the observed zero block-size product and the downstream zero core-usage estimate.  ### Steps to reproduce  1. Run the OpenTelemetry GPU Collector on Linux x86_64 with host PID visibility, NVIDIA GPU access, and the documented e

- **Issue #1319** (2026-07-12): **Bug: Disable metrics not working**
  *Symptoms*: ### Component  OpenLIT Python SDK  ### What happened?  The parameter disable_metrics is not working, even when setting it to True, my meter provider is still trying to export metrics  ### Steps to reproduce  openlit.init(disable_metrics=True_  ### Expected behavior  It should not create and try to export metrics  ### Environment  _No response_  ### Additional context  _No response_  ### Pre-submission checklist  - [x] I searched existing issues and didn't find a duplicate  ### Are you willing to submit PR?  _No response_
  **Post-Mortem & Fix Analysis**:
  > Hi, I would like to take this one!   I'll trace where disable_metrics is read in openlit.init() and check whether it gates meter provider initialization or just sets a flag that isn't checked before the provider starts. Will add a test confirming no meter provider is created when disable_metrics=True.  Could you please assign this to me?
  > @VanshikaMehta18 assigned this to you now

- **Issue #1316** (2026-07-02): **Bug: Agents dashboard: SDK-instrumented agents disappear ~10 min after last span, ignoring the selected time range (24H/7D/…)**
  *Symptoms*: ### Component  OpenLIT  ### What happened?  On the **Agents** dashboard, agents instrumented **via the SDK** (no OpenLIT controller / no eBPF auto-instrumentation) **drop off the list ~10 minutes after their last span**, even though the time-range selector is set to **24H** (or 7D/1M/3M). The spans are still in ClickHouse and well within the selected window.  The UI presents a 24H/7D/1M/3M selector, implying the list is bounded by that range, but SDK-source rows are actually bounded by a hardcoded 10-minute staleness guard.  **Root cause** — `src/client/src/lib/platform/agents/index.ts`, `loadAgents()`:      // Hide stale SDK-only rows... Controller-source rows are left untouched     // because they get refreshed every controller heartbeat (~10s).     where.push(`(s.source != 'sdk' OR s.last_seen >= now() - INTERVAL 10 MINUTE)`);  For `source = 'sdk'` rows this AND-s in a hardcoded 10-minute upper bound that overrides the user-selected `start`. Controller-managed rows bypass it (refreshed by ~10s heartbeats), so only SDK-only deployments are affected. (Related: `agents/materialize.ts` sets `SDK_DISCOVERY_LOOKBACK_MINUTES = 30`, but the 10-minute guard above is the tighter, binding one.)  **Evidence** (via ClickHouse `system.query_log` + hitting the internal API): - `GET /api/agents?start=<now-24h>` → **0 agents** when the newest span is ~17 min old (data present in ClickHouse, within 24h). - Immediately after emitting a fresh span → the same agents return.  ### Steps to repro

- **Issue #1287** (2026-06-29): **Bug: LangGraph instrumentation writes non-assistant messages (e.g. HumanMessage) to gen_ai.output.messages**
  *Symptoms*: ### Component  OpenLIT  ### What happened?  Summary  Two issues:  1. The LangGraph instrumentation in `sdk\python\src\openlit\instrumentation\langgraph\utils.py:196` incorrectly writes messages with non-assistant roles. Per the OTel GenAI semantic convention, only assistant/AI messages should appear in output—human/user messages belong exclusively in gen_ai.input.messages.  2. About the role, in Langchain we have a mapping - `openlit\sdk\python\src\openlit\instrumentation\langchain\utils.py:93`, but there's no such mapping in Langgraph.   ### Steps to reproduce  Instrument a LangGraph application with openlit Have a graph node return {"messages": [..., HumanMessage(content="...")]} as its result Observe the span for that node—[gen_ai.output.messages] will contain {"role": "human", "content": "..."}  ### Expected behavior  Only assistant/ai messages should be written to [gen_ai.output.messages] Human/user messages should only appear in [gen_ai.input.messages] LangChain-native roles should be mapped to OTel convention roles consistently across all instrumentations  FYR: https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-agent-spans.md#invoke-agent-client-span   ### Environment  the latest version.  ### Additional context  _No response_  ### Pre-submission checklist  - [x] I searched existing issues and didn't find a duplicate  ### Are you willing to submit PR?  None

- **Issue #1282** (2026-06-30): **Bug: VictoriaMetrics Stack should be renamed to Victoria Stack**
  *Symptoms*: ### Component  OpenLIT  ### What happened?  `VictoriaMetrics Stack` was incorrectly named when destination was initially added.  VictoriaMetrics will stick to `Victoria Stack` name in their docs and references, to reduce confisuon with metrics only.  ### Steps to reproduce  Check https://docs.openlit.io/latest/sdk/destinations/victoriametrics-stack  ### Expected behavior  The page should mention `Victoria Stack` instead of  `VictoriaMetrics Stack`.  ### Environment  _No response_  ### Additional context  _No response_  ### Pre-submission checklist  - [x] I searched existing issues and didn't find a duplicate  ### Are you willing to submit PR?  Yes, I am willing to submit a PR!
  **Post-Mortem & Fix Analysis**:
  > I checked the docs source. The term "VictoriaMetrics stack" appears in:  1. `docs/latest/sdk/destinations/victoriametrics-stack.mdx` — frontmatter title: "VictoriaMetrics stack" 2. `docs/snippets/destinations/victoriametrics-stack/intro.mdx` — heading and body text (3 occurrences) 3. File/directory names: `victoriametrics-stack.mdx` and `victoriametrics-stack/`  The rename to "Victoria Stack" needs to update:  - Frontmatter title in `.mdx` → `"Victoria Stack"` - All prose references in `intro.mdx` → "Victoria Stack" (lowercase "stack") - Any sidebar/nav configuration that references the old path  The file/directory rename (`victoriametrics-stack` → `victoria-stack`) is a separate concern — it would require updating internal cross-references and may be better as a follow-up PR to avoid breaking existing links.  Happy to open a PR covering the prose and frontmatter changes if there are no other in-flight changes to these files.
  > Hi @cschanhniem! Thanks for your reply! I have no intent on changing the directory name to keep links unchanged. See PR https://github.com/openlit/openlit/pull/1283

- **Issue #1251** (2026-06-03): **Bug: The GPU Collector does not build on native arm64**
  *Symptoms*: ### Component  OpenTelemetry GPU Collector  ### What happened?  For arm64 support, cross-compilation from amd64 using Linux header manipulated in the build process (https://github.com/openlit/openlit/pull/1213) was chosen over a clean build system using native runners (https://github.com/openlit/openlit/pull/1215). As a result native builds (`make all`) no longer work on an arm64 host as is.  The generated vmliunx.h file is fundamentally platform specific. Cross-compilation of arm64 on amd64 is currently "hacked" to work by manipulating that file. Unfortunately, this "shim" only works one way. I don't see a way how the "shim" could be made to work both ways based on how the structures are defined in the vmlinux.h header for the relevant platforms.  Two possibilities:  1. Commit pre-generated vmlinux.h headers to the repository and select the matching one at compile-time based on __TARGET_ARCH_x86/__TARGET_ARCH_arm64. Downside: committed headers may potentially go out of date. 2. Modify the code to only attempt cross-compilation on amd64 (where the vmlinux.h hack works) while on arm64 only the native build is performed. Cross-compilation is one way but at least native builds work.  Both approaches will still need native runners for CI to either generate the native vmlinux.h (or at least verify it) or to verify the native build on arm64 works.   ### Steps to reproduce  1. Run `cd openlit/opentelemetry-gpu-collector && make all` on an arm64 host  ### Expected behavior  1. Build 
  **Post-Mortem & Fix Analysis**:
  > @cbirkhold I kicked off a new release (0.0.6)
  > https://github.com/openlit/openlit/actions/runs/26869896895

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

### Incident Patch 1: `d6938906` (2026-09-29)
**Commit Message**: docs(sdk/typescript): fix broken docs.openlit.io links in README (#1678)

Co-authored-by: drgg <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>
Co-authored-by: Aman Agarwal <[REDACTED_EMAIL]>

**File**: `sdk/typescript/README.md` (modified, +35/-35)
```diff
@@ -34,52 +34,52 @@ This project proudly follows and maintains the [Semantic Conventions](https://gi
 
 | LLMs                                                                                        |
 | ------------------------------------------------------------------------------------------- |
-| [✅ OpenAI](https://docs.openlit.io/latest/integrations/openai)                             |
-| [✅ Anthropic](https://docs.openlit.io/latest/integrations/anthropic)                       |
-| [✅ Cohere](https://docs.openlit.io/latest/integrations/cohere)                             |
-| [✅ Groq](https://docs.openlit.io/latest/integrations/groq)                                 |
-| [✅ Mistral](https://docs.openlit.io/latest/integrations/mistral)                           |
-| [✅ Google AI Studio](https://docs.openlit.io/latest/integrations/google-ai-studio)         |
-| [✅ Google Vertex AI](https://docs.openlit.io/latest/integrations/vertex-ai) *(via `@google-cloud/vertexai`)* |
-| [✅ Together AI](https://docs.openlit.io/latest/integrations/together)                      |
-| [✅ Ollama](https://docs.openlit.io/latest/integrations/ollama)                             |
-| [✅ AWS Bedrock](https://docs.openlit.io/latest/integrations/bedrock)                        |
-| [✅ Hugging Face](https://docs.openlit.io/latest/integrations/huggingface) *(Inference API + local Transformers.js)* |
-| [✅ Replicate](https://docs.openlit.io/latest/integrations/replicate)                      |
-| [✅ Azure OpenAI](https://docs.openlit.io/latest/integrations/azure-openai) *(via OpenAI SDK)* |
+| [✅ OpenAI](https://docs.openlit.io/latest/sdk/integrations/openai)                         |
+| [✅ Anthropic](https://docs.openlit.io/latest/sdk/integrations/anthropic)                   |
+| [✅ Cohere](https://docs.openlit.io/latest/sdk/integrations/cohere)                         |
+| [✅ Groq](https://docs.openlit.io/latest/sdk/integrations/groq)                             |
+| [✅ Mistral](https://docs.openlit.io/latest/sdk/integrations/mistral)                       |
+| [✅ Google AI Studio](https://docs.openlit.io/latest/sdk/integrations/google-ai-studio)     |
+| [✅ Google Vertex AI](https://docs.openlit.io/latest/sdk/integrations/vertexai) *(via `@google-cloud/vertexai`)* |
+| [✅ Together AI](https://docs.openlit.io/latest/sdk/integrations/together)                  |
+| [✅ Ollama](https://docs.openlit.io/latest/sdk/integrations/ollama)                         |
+| [✅ AWS Bedrock](https://docs.openlit.io/latest/sdk/integrations/bedrock)                    |
+| [✅ Hugging Face](https://docs.openlit.io/latest/sdk/integrations/huggingface) *(Inference API + local Transformers.js)* |
+| [✅ Replicate](https://docs.openlit.io/latest/sdk/integrations/replicate)                  |
+| [✅ Azure OpenAI](https://docs.openlit.io/latest/sdk/integrations/azure-openai) *(via OpenAI SDK)* |
 
 | Audio / Speech                                                                              |
 | ------------------------------------------------------------------------------------------- |
 | [✅ ElevenLabs](https://docs.openlit.io/latest/sdk/integrations/elevenlabs)                   |
 
 | Vector Databases                                                                            |
 | ------------------------------------------------------------------------------------------- |
-| [✅ Chroma](https://docs.openlit.io/latest/integrations/chromadb)                           |
-| [✅ Pinecone](https://docs.openlit.io/latest/integrations/pinecone)                         |
-| [✅ Qdrant](https://docs.openlit.io/latest/integrations/qdrant)                             |
-| [✅ Milvus](https://docs.openlit.io/latest/integrations/milvus)                             |
+| [✅ Chroma](https://docs.openlit.io/latest/sdk/integrations/chromadb)                       |
+| [✅ Pinecone](https://docs.openlit.io/latest/sdk/integrations/pinecone)                     |
+| [✅ Qdrant](https://docs.openlit.io/latest/sdk/integrations/qdrant)                         |
+| [✅ Milvus](https://docs.openlit.io/latest/sdk/integrations/milvus)                         |
 
 | Frameworks                                                                                  |
 | ------------------------------------------------------------------------------------------- |
-| [✅ LangChain](https://docs.openlit.io/latest/integrations/langchain)                       |
-| [✅ LlamaIndex](https://docs.openlit.io/latest/integrations/llama-index)                    |
-| [✅ Vercel AI SDK](https://docs.openlit.io/latest/integrations/vercel-ai)                   |
+| [✅ LangChain](https://docs.openlit.io/latest/sdk/integrations/langchain)                   |
+| [✅ LlamaIndex](https://docs.openlit.io/latest/sdk/integrations/llama-index)                |
+| [✅ Vercel AI SDK](https://docs.openlit.io/latest/sdk/integrations/vercel-ai)               |
 
 ## Supported Destinations
 
-- [✅ OpenTelemetry Collector](https://docs
```

---

### Incident Patch 2: `c663b113` (2026-09-29)
**Commit Message**: feat(client): add Memcode memory connector (#1632)

Co-authored-by: amanagarwal042 <[REDACTED_EMAIL]>
Co-authored-by: AmanAgarwal041 <[REDACTED_EMAIL]>
Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `docs/latest/openlit/organisation/connectors.mdx` (added, +186/-0)
```diff
@@ -0,0 +1,186 @@
+---
+title: 'Connectors'
+sidebarTitle: 'Connectors'
+description: 'Connect OpenLIT to ClickHouse and OpenPlait-backed observability backends — atomic connectors, actions, and the roadmap for a unified connector registry'
+icon: 'plug'
+---
+
+**Connectors** are how OpenLIT attaches to data systems. Each connector is an **atomic** integration: one backend, one credential set, and a clear set of **actions** (test connection, validate AI telemetry, bind signals, manage secrets).
+
+Open the connectors experience from **Organisation → Project → Connectors** (Data sources). Always select the correct [project](/latest/openlit/organisation/projects) and [environment](/latest/openlit/organisation/environments) first — connectors belong to the project, not the organisation root.
+
+<Frame>
+  <img src="/images/organisation/connectors-list.png" alt="OpenLIT Connectors page showing configured connectors and the connector catalog" />
+</Frame>
+
+<Info>
+Connectors are the long-term integration point in OpenLIT: **data-source connectors** for telemetry, **memory connectors** for agent memory providers, with the same registry model expanding to notifications and other action types over time. Several read paths use portable [@openplait](https://github.com/openlit/openplait) adapters so query behavior stays consistent across backends.
+</Info>
+
+## Mental model
+
+```mermaid
+flowchart LR
+  subgraph org [Organisation]
+    proj[Project]
+  end
+  subgraph env [Environment]
+    bindT[traces binding]
+    bindL[logs binding]
+    bindM[metrics binding]
+  end
+  proj --> env
+  bindT --> C1[Connector A]
+  bindL --> C2[Connector B]
+  bindM --> C3[Connector C]
+  C1 --> Tempo[Tempo]
+  C2 --> Loki[Loki]
+  C3 --> Prom[Prometheus]
+```
+
+- **Atomic connectors** — never a multi-backend blob. One Tempo instance, one Loki instance, one Prometheus endpoint.
+- **Signal routing** — each of traces / logs / metrics is bound independently. See [Signal routing](/latest/openlit/organisation/signal-routing).
+- **Database Config** — ClickHouse lives as a Database Config and appears as the built-in connector. See [Database Config](/latest/openlit/organisation/database-config).
+
+## Supported connectors (OpenLIT + OpenPlait)
+
+These are the connectors available in open-source OpenLIT. OpenPlait packages power the portable query adapters for ClickHouse, Tempo, Loki, Prometheus, and Jaeger.
+
+### Built-in app store
+
+| Connector | Package / implementation | Signals | What it’s for |
+| --- | --- | --- | --- |
+| **ClickHouse** | Database Config + `@openplait/adapter-clickhouse` | traces, logs, metrics (+ intelligence) | Default store; full correlation, raw SQL, evals metadata, vault |
+
+### Data-source connectors
+
+| Connector | Package / implementation | Signals | What it’s for |
+| --- | --- | --- | --- |
+| **Grafana Tempo** | `@openplait/adapter-tempo` | traces | TraceQL search, trace tree, span events |
+| **Grafana Loki** | `@openplait/adapter-loki` | logs | LogQL logs; correlate by trace id / service |
+| **Prometheus** | `@openplait/adapter-prometheus` | metrics | PromQL HTTP API (also works with Prometheus-compatible endpoints such as Mimir when you point at their query URL) |
+| **Jaeger** | `@openplait/adapter-jaeger` | traces | Jaeger Query HTTP API; sampled in-process aggregates |
+
+<Tip>
+Prometheus-compatible APIs (for example Grafana Mimir’s PromQL endpoint) use the **Prometheus** connector — there is no separate Mimir connector type in open-source OpenLIT.
+</Tip>
+
+## Capability matrix
+
+| Connector | Signals | Trace tree | Span events | Server aggregation | Raw SQL | Cross-signal correlation |
+| --- | --- | --- | --- | --- | --- | --- |
+| ClickHouse | traces, logs, metrics | Yes | Yes | Yes | Yes | Full |
+| Tempo | traces | Yes | Yes | No* | No | trace / span / service |
+| Loki | logs | — | — | No | No | trace id, service |
+| Prometheus | metrics | — | — | Yes | No | — |
+| Jaeger | traces | Yes | Yes | No* | No | trace / span / service |
+
+\* Aggregate graphs are reconstructed in-process from a bounded sample of full traces when the backend cannot aggregate server-side.
+
+### Memory connectors
+
+Memory connectors store and search long-term agent memory. They use the same catalog, vault, and health-check actions as data-source connectors, but they are not bound to traces, logs, or metrics.
+
+| Connector | What it’s for | Auth |
+| --- | --- | --- |
+| **Mem0** | Hosted or self-hosted Mem0 memories (`add`, `search`, `get`, `list`, `update`, `delete`) | API key (`Authorization: Token …`) |
+| **Zep** | Zep Cloud or self-hosted session memory and graph search | API key (`Authorization: Api-Key …`) |
+
+To add a memory connector: open **Connectors**, choose **Mem0** or **Zep** from the catalog, set the endpoint (or keep the hosted default), paste the API key, and test the connection. Credentials are stored in Vault and never returned to the browser.
+
+## Add a Jaeger connector in Op
```

**File**: `src/client/src/__tests__/helpers/client/database-config.test.ts` (modified, +8/-0)
```diff
@@ -103,6 +103,14 @@ describe('fetchDatabaseConfigList', () => {
     expect(successCb).toHaveBeenCalledWith([{ id: 'db1' }]);
     expect(mockSetList).toHaveBeenCalledWith([{ id: 'db1' }]);
   });
+
+  it('coerces non-array payloads to an empty list', async () => {
+    (asaw as jest.Mock).mockResolvedValue([null, '<html>login</html>']);
+    const successCb = jest.fn();
+    await fetchDatabaseConfigList(successCb);
+    expect(successCb).toHaveBeenCalledWith([]);
+    expect(mockSetList).toHaveBeenCalledWith([]);
+  });
 });
 
 describe('pingActiveDatabaseConfig', () => {
```

**File**: `src/client/src/__tests__/lib/platform/connectors/coverage.test.ts` (modified, +28/-1)
```diff
@@ -1,13 +1,19 @@
 import { ensureAdaptersRegistered, __resetBootstrapForTests } from "@/lib/platform/connectors/datasource/bootstrap";
+import { ensureMemoryAdaptersRegistered, __resetMemoryBootstrapForTests } from "@/lib/platform/connectors/memory/bootstrap";
 import { __resetRegistryForTests, getAdapterFactory, listSourceTypeDescriptors } from "@/lib/platform/connectors/datasource/registry";
-import { listConnectorTypes } from "@/lib/platform/connectors/registry";
+import { __resetMemoryRegistryForTests, hasMemoryAdapterFactory } from "@/lib/platform/connectors/memory/registry";
+import { __resetConnectorRegistryForTests, listConnectorTypes } from "@/lib/platform/connectors/registry";
+import { connectorIconPath } from "@/lib/platform/connectors/icons";
 
 jest.mock("@/lib/session", () => ({ getCurrentUser: jest.fn() }));
 
 describe("connector coverage", () => {
 	afterEach(() => {
 		__resetBootstrapForTests();
 		__resetRegistryForTests();
+		__resetMemoryBootstrapForTests();
+		__resetMemoryRegistryForTests();
+		__resetConnectorRegistryForTests();
 	});
 
 	it("exposes every atomic collector through the adapter and connector registries", () => {
@@ -27,4 +33,25 @@ describe("connector coverage", () => {
 		const registeredTypes = new Set(connectorTypes.map((descriptor) => descriptor.type));
 		for (const descriptor of descriptors) expect(registeredTypes.has(descriptor.type)).toBe(true);
 	});
+
+	it("exposes memory connectors through the adapter and connector registries", () => {
+		ensureMemoryAdaptersRegistered();
+		expect(hasMemoryAdapterFactory("claude")).toBe(true);
+		expect(hasMemoryAdapterFactory("mem0")).toBe(true);
+		expect(hasMemoryAdapterFactory("memcode")).toBe(true);
+		expect(hasMemoryAdapterFactory("zep")).toBe(true);
+		expect(listConnectorTypes("memory").map((item) => item.type).sort()).toEqual([
+			"claude",
+			"mem0",
+			"memcode",
+			"zep",
+		]);
+	});
+
+	it("maps memory vendors to local brand assets", () => {
+		expect(connectorIconPath("claude")).toBe("/images/connectors/claude.svg");
+		expect(connectorIconPath("mem0")).toBe("/images/connectors/mem0.svg");
+		expect(connectorIconPath("memcode")).toBe("/images/connectors/memcode.png");
+		expect(connectorIconPath("zep")).toBe("/images/connectors/zep.svg");
+	});
 });
```

**File**: `src/client/src/__tests__/lib/platform/connectors/memory-adapters.test.ts` (modified, +604/-2)
```diff
@@ -26,19 +26,21 @@ const mockSafeFetch = jest.fn();
 
 import { ClaudeAdapter, claudeAdapterFactory } from "@/lib/platform/connectors/memory/claude/adapter";
 import { Mem0Adapter, mem0AdapterFactory } from "@/lib/platform/connectors/memory/mem0/adapter";
+import { MemcodeAdapter, memcodeAdapterFactory } from "@/lib/platform/connectors/memory/memcode/adapter";
 import { ZepAdapter, zepAdapterFactory } from "@/lib/platform/connectors/memory/zep/adapter";
 import { SourceResponseError } from "@/lib/platform/connectors/datasource/http/safe-fetch";
 import { resolveSourceSecret } from "@/lib/platform/connectors/datasource/http/secret";
 import type { MemorySourceDescriptor } from "@/lib/platform/connectors/memory/types";
 
-function defaultUrl(type: "claude" | "mem0" | "zep"): string {
+function defaultUrl(type: "claude" | "mem0" | "memcode" | "zep"): string {
 	if (type === "claude") return "https://api.anthropic.com";
 	if (type === "mem0") return "https://api.mem0.ai";
+	if (type === "memcode") return "https://memory.memcode.in";
 	return "https://api.getzep.com";
 }
 
 function descriptor(
-	type: "claude" | "mem0" | "zep",
+	type: "claude" | "mem0" | "memcode" | "zep",
 	settings: Record<string, unknown> = {}
 ): MemorySourceDescriptor {
 	return {
@@ -755,6 +757,606 @@ describe("Mem0 adapter", () => {
 	});
 });
 
+describe("Memcode adapter", () => {
+	it("describes list with no page filters at all", () => {
+		const described = memcodeAdapterFactory.describe();
+		expect(described.type).toBe("memcode");
+		expect(described.capabilities).toEqual({
+			add: true,
+			search: true,
+			get: false,
+			list: true,
+			update: false,
+			delete: false,
+			feedback: false,
+		});
+		expect(described.configFields.map((field) => field.key)).toEqual(
+			expect.arrayContaining(["url", "apiKey"])
+		);
+		// The API key is the tenant: Memory API v2 discards a client-sent user_id
+		// in production, so offering a user control would be a lie.
+		expect(described.filterFields).toEqual([]);
+		// v2 has no get-by-id route, so a listed record is the whole record and
+		// the detail sheet must not warn about a fetch it never needed.
+		expect(described.detailFromList).toBe(true);
+		expect(described.docsUrl).toBe("https://memcode.in/docs");
+	});
+
+	it("probes liveness then GET /v2/test, never the list route", async () => {
+		mockSafeFetch
+			.mockResolvedValueOnce({ status: "ok", data: { status: "ready" } })
+			.mockResolvedValueOnce({
+				status: "ok",
+				data: {
+					authenticated: true,
+					principal_type: "legacy_user",
+					user_id: "user-123",
+					username: "ishaan",
+				},
+			});
+		const adapter = new MemcodeAdapter(descriptor("memcode"));
+		await expect(adapter.healthCheck()).resolves.toEqual(
+			expect.objectContaining({ ok: true })
+		);
+		const urls = mockSafeFetch.mock.calls.map((call) => String(call[0]));
+		expect(urls).toEqual([
+			"https://memory.memcode.in/health",
+			"https://memory.memcode.in/v2/test",
+		]);
+		// A limit=1 list still materialises the whole account server-side, so it
+		// must never be the probe.
+		expect(urls.some((url) => url.includes("/v2/memory"))).toBe(false);
+		expect(mockSafeFetch.mock.calls[1][1].headers.Authorization).toBe(
+			"Bearer secret-key"
+		);
+	});
+
+	it("tells the operator when a deployment predates GET /v2/test", async () => {
+		mockSafeFetch
+			.mockResolvedValueOnce({ status: "ok", data: { status: "ready" } })
+			.mockRejectedValueOnce(new SourceResponseError(404, "Not Found"));
+		const adapter = new MemcodeAdapter(descriptor("memcode"));
+		await expect(adapter.healthCheck()).resolves.toEqual(
+			expect.objectContaining({
+				ok: false,
+				message: expect.stringMatching(/\/v2\/test/),
+			})
+		);
+	});
+
+	it("reports a rejected key instead of passing the connection", async () => {
+		mockSafeFetch
+			.mockResolvedValueOnce({ status: "ok", data: { status: "ready" } })
+			.mockRejectedValueOnce(new SourceResponseError(401, "invalid api key"));
+		const adapter = new MemcodeAdapter(descriptor("memcode"));
+		await expect(adapter.healthCheck()).resolves.toEqual(
+			expect.objectContaining({ ok: false, message: expect.stringMatching(/rejected/i) })
+		);
+	});
+
+	it("reports an out-of-credit account separately from a bad key", async () => {
+		mockSafeFetch
+			.mockResolvedValueOnce({ status: "ok", data: { status: "ready" } })
+			.mockRejectedValueOnce(new SourceResponseError(402, "insufficient credits"));
+		const adapter = new MemcodeAdapter(descriptor("memcode"));
+		await expect(adapter.healthCheck()).resolves.toEqual(
+			expect.objectContaining({ ok: false, message: expect.stringMatching(/credit/i) })
+		);
+	});
+
+	it("fails a base URL that is not a Memory API", async () => {
+		// A 404 is the credential probe's success answer, so without a decisive
+		// liveness check a host that 404s everything would pass.
+		mockSafeFetch.mockRejectedValue(new SourceResponseError(404, "not found"));
+		const adapter = new 
```

**File**: `src/client/src/__tests__/lib/platform/connectors/memory-bootstrap.test.ts` (modified, +4/-1)
```diff
@@ -24,15 +24,17 @@ beforeEach(() => {
 });
 
 describe("memory connector bootstrap", () => {
-	it("registers Claude, Mem0, and Zep exactly once", () => {
+	it("registers Claude, Mem0, MemCode, and Zep exactly once", () => {
 		ensureMemoryAdaptersRegistered();
 		ensureMemoryAdaptersRegistered();
 		expect(hasMemoryAdapterFactory("claude")).toBe(true);
 		expect(hasMemoryAdapterFactory("mem0")).toBe(true);
+		expect(hasMemoryAdapterFactory("memcode")).toBe(true);
 		expect(hasMemoryAdapterFactory("zep")).toBe(true);
 		expect(listMemoryTypeDescriptors().map((item) => item.type).sort()).toEqual([
 			"claude",
 			"mem0",
+			"memcode",
 			"zep",
 		]);
 	});
@@ -61,6 +63,7 @@ describe("memory connector bootstrap", () => {
 		expect(listConnectorTypes("memory").map((item) => item.type).sort()).toEqual([
 			"claude",
 			"mem0",
+			"memcode",
 			"zep",
 		]);
 		expect(listConnectorTypes("datasource")).toHaveLength(0);
```

**File**: `src/client/src/__tests__/lib/platform/connectors/memory-graph.test.ts` (modified, +90/-0)
```diff
@@ -1,8 +1,13 @@
 import {
+	MEMORY_CLUSTER_COLORS,
+	MEMORY_EDGE_TIER_MINIMUM,
 	buildMemoryGraph,
 	classifyEntityType,
 	classifyMemoryKind,
 	layoutMemoryGraph,
+	memoryClusterColor,
+	memoryEdgeDashPattern,
+	memoryEdgeTier,
 	radialEdgePoints,
 	summarizeMemoryStats,
 	type MemoryGraphModel,
@@ -428,3 +433,88 @@ describe("radialEdgePoints", () => {
 		);
 	});
 });
+
+describe("memoryEdgeTier", () => {
+	it("buckets a weight into strength tiers", () => {
+		expect(memoryEdgeTier(0.95)).toBe("strong");
+		expect(memoryEdgeTier(0.81)).toBe("strong");
+		// 0.8 itself is medium: strong uses an exclusive bound.
+		expect(memoryEdgeTier(0.8)).toBe("medium");
+		expect(memoryEdgeTier(0.6)).toBe("medium");
+		expect(memoryEdgeTier(0.59)).toBe("weak");
+		expect(memoryEdgeTier(0.51)).toBe("weak");
+		expect(memoryEdgeTier(0.5)).toBe("faint");
+		expect(memoryEdgeTier(0.3)).toBe("faint");
+	});
+
+	it("treats anything below the faint floor as noise", () => {
+		expect(memoryEdgeTier(0.29)).toBeNull();
+		expect(memoryEdgeTier(0)).toBeNull();
+	});
+
+	it("returns null for an unscored edge", () => {
+		expect(memoryEdgeTier(undefined)).toBeNull();
+		expect(memoryEdgeTier(Number.NaN)).toBeNull();
+		expect(memoryEdgeTier(Number.POSITIVE_INFINITY)).toBeNull();
+	});
+
+	it("keeps only edges at or above the selected threshold", () => {
+		const weights = [0.35, 0.55, 0.62, 0.91];
+		expect(
+			weights.filter((weight) => weight >= MEMORY_EDGE_TIER_MINIMUM.strong)
+		).toEqual([0.91]);
+		expect(
+			weights.filter((weight) => weight >= MEMORY_EDGE_TIER_MINIMUM.medium)
+		).toEqual([0.62, 0.91]);
+		expect(
+			weights.filter((weight) => weight >= MEMORY_EDGE_TIER_MINIMUM.weak)
+		).toEqual([0.55, 0.62, 0.91]);
+		expect(
+			weights.filter((weight) => weight >= MEMORY_EDGE_TIER_MINIMUM.faint)
+		).toEqual(weights);
+	});
+});
+
+describe("weighted graph styling", () => {
+	it("dashes edges by tier", () => {
+		expect(memoryEdgeDashPattern("strong")).toBeUndefined();
+		expect(memoryEdgeDashPattern("medium")).toBe("7 4");
+		expect(memoryEdgeDashPattern("weak")).toBe("4 6");
+		expect(memoryEdgeDashPattern("faint")).toBe("2 6");
+	});
+
+	it("maps a domain onto a stable cluster colour", () => {
+		const profile = memoryClusterColor("profile");
+		expect(MEMORY_CLUSTER_COLORS).toContain(profile);
+		expect(memoryClusterColor("profile")).toBe(profile);
+		expect(memoryClusterColor("temporal")).not.toBe(profile);
+		// An unknown or missing domain still resolves rather than throwing.
+		expect(MEMORY_CLUSTER_COLORS).toContain(memoryClusterColor(undefined));
+	});
+
+	it("lays a weighted graph out as a golden-angle constellation", () => {
+		const model: MemoryGraphModel = {
+			kind: "knowledge",
+			weighted: true,
+			nodes: Array.from({ length: 400 }, (_, index) => ({
+				id: `memory_${index}`,
+				type: "memory" as const,
+				label: `Memory ${index}`,
+				memoryId: `memory_${index}`,
+			})),
+			edges: [],
+		};
+		const laidOut = layoutMemoryGraph(model, 800, 480);
+		expect(laidOut).toHaveLength(400);
+		expect(laidOut.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(
+			true
+		);
+		// Phyllotaxis: distance from centre grows as sqrt(index), so later nodes
+		// sit strictly further out and nothing collapses onto one point.
+		const radius = (index: number) =>
+			Math.hypot(laidOut[index].x - 400, laidOut[index].y - 240);
+		expect(radius(0)).toBeLessThan(radius(50));
+		expect(radius(50)).toBeLessThan(radius(399));
+		expect(new Set(laidOut.map((node) => `${node.x},${node.y}`)).size).toBe(400);
+	});
+});
```

**File**: `src/client/src/__tests__/lib/platform/connectors/memory-read.test.ts` (modified, +244/-1)
```diff
@@ -484,7 +484,7 @@ describe("queryProjectMemories", () => {
 		});
 
 		await queryProjectMemories({ limit: 5000 });
-		expect(list).toHaveBeenCalledWith(expect.objectContaining({ limit: 100 }));
+		expect(list).toHaveBeenCalledWith(expect.objectContaining({ limit: 500 }));
 
 		await queryProjectMemories({ limit: -3 });
 		expect(list).toHaveBeenCalledWith(expect.objectContaining({ limit: 1 }));
@@ -493,6 +493,249 @@ describe("queryProjectMemories", () => {
 		expect(list).toHaveBeenCalledWith(expect.objectContaining({ limit: 12 }));
 	});
 
+	it("paginates and reports a backend total when the adapter exposes listPage", async () => {
+		const listPage = jest.fn().mockResolvedValue({
+			records: [{ id: "m1", content: "Lives in Berlin", metadata: {} }],
+			total: 1200,
+			hasMore: true,
+			nextOffset: 101,
+		});
+		const list = jest.fn();
+		mockListMemoryConnectors.mockResolvedValue([connector]);
+		mockGetMemoryRuntime.mockResolvedValue({
+			connector,
+			adapter: {
+				capabilities: () => ({
+					add: true,
+					search: true,
+					get: true,
+					list: true,
+					update: true,
+					delete: true,
+				}),
+				list,
+				listPage,
+				search: jest.fn(),
+			},
+		});
+
+		const result = await queryProjectMemories({ limit: 100, offset: 100 });
+		expect(listPage).toHaveBeenCalledWith(
+			expect.objectContaining({ limit: 100, offset: 100 })
+		);
+		expect(list).not.toHaveBeenCalled();
+		expect(result.offset).toBe(100);
+		expect(result.hasMore).toBe(true);
+		expect(result.total).toBe(1200);
+		// The durable total wins over the length of this page.
+		expect(result.stats.total).toBe(1200);
+	});
+
+	it("prefers the adapter graph over the derived one, and only on the first page", async () => {
+		const graph = jest.fn().mockResolvedValue({
+			nodes: [{ id: "memory_a", type: "memory", label: "A", memoryId: "memory_a" }],
+			edges: [],
+			kind: "knowledge",
+			weighted: true,
+		});
+		mockListMemoryConnectors.mockResolvedValue([connector]);
+		mockGetMemoryRuntime.mockResolvedValue({
+			connector,
+			adapter: {
+				capabilities: () => ({
+					add: true,
+					search: true,
+					get: true,
+					list: true,
+					update: true,
+					delete: true,
+				}),
+				list: jest.fn().mockResolvedValue([]),
+				graph,
+				search: jest.fn(),
+			},
+		});
+
+		const first = await queryProjectMemories({});
+		expect(graph).toHaveBeenCalledTimes(1);
+		expect(first.graph.kind).toBe("knowledge");
+		expect(first.graph.weighted).toBe(true);
+
+		// Paging must not refetch the graph; the page keeps the one it drew.
+		const second = await queryProjectMemories({ offset: 100 });
+		expect(graph).toHaveBeenCalledTimes(1);
+		expect(second.graph).toEqual({ nodes: [], edges: [] });
+	});
+
+	it("counts connections from real graph edges, not user/session pairs", async () => {
+		mockListMemoryConnectors.mockResolvedValue([connector]);
+		mockGetMemoryRuntime.mockResolvedValue({
+			connector,
+			adapter: {
+				capabilities: () => ({
+					add: true,
+					search: true,
+					get: false,
+					list: true,
+					update: false,
+					delete: false,
+				}),
+				// No userId or sessionId on any record: the pairing count would be 0.
+				list: jest.fn().mockResolvedValue([
+					{ id: "memory_a", content: "Lives in Berlin", metadata: {} },
+					{ id: "memory_b", content: "Moved in May", metadata: {} },
+				]),
+				graph: jest.fn().mockResolvedValue({
+					nodes: [
+						{ id: "memory_a", type: "memory", label: "A", memoryId: "memory_a" },
+						{ id: "memory_b", type: "memory", label: "B", memoryId: "memory_b" },
+					],
+					edges: [
+						{ from: "memory_a", to: "memory_b", weight: 0.9 },
+						{ from: "memory_b", to: "memory_a", weight: 0.4 },
+					],
+					kind: "knowledge",
+					weighted: true,
+				}),
+				search: jest.fn(),
+			},
+		});
+
+		const result = await queryProjectMemories({});
+		expect(result.stats.connections).toBe(2);
+	});
+
+	it("leaves the derived graph's connection count as user and session pairing", async () => {
+		mockListMemoryConnectors.mockResolvedValue([connector]);
+		mockGetMemoryRuntime.mockResolvedValue({
+			connector,
+			adapter: {
+				capabilities: () => ({
+					add: true,
+					search: true,
+					get: true,
+					list: true,
+					update: true,
+					delete: true,
+				}),
+				list: jest.fn().mockResolvedValue([
+					{ id: "m1", content: "One", userId: "ada", sessionId: "s1", metadata: {} },
+					{ id: "m2", content: "Two", userId: "ada", sessionId: "s2", metadata: {} },
+				]),
+				search: jest.fn(),
+			},
+		});
+
+		const result = await queryProjectMemories({});
+		expect(result.stats.connections).toBe(2);
+		expect(result.graph.kind).toBeUndefined();
+	});
+
+	it("falls back to the derived graph when the adapter graph call fails", async () => {
+		mockListMemoryConnectors.mockResolvedValue([connector]);
+		mockGetMemoryRuntime.mockResolvedValue({
+			connector,
+			adapter: {
+				capabilities: () => ({
+					add: true,
+					search: tr
```

**File**: `src/client/src/app/api/memory/route.ts` (modified, +17/-1)
```diff
@@ -21,6 +21,7 @@ import {
 	MEMORY_INVALID_JSON,
 	MEMORY_INVALID_LIMIT,
 	MEMORY_INVALID_METADATA,
+	MEMORY_INVALID_OFFSET,
 	MEMORY_LOAD_FAILED,
 } from "@/constants/messages/en";
 
@@ -37,15 +38,27 @@ function optionalFilter(value: string | null, max = FILTER_MAX): string | undefi
 	return trimmed;
 }
 
+const LIMIT_MAX = 500;
+const OFFSET_MAX = 1_000_000;
+
 function parseLimit(value: string | null): number | undefined {
 	if (value == null || !value.trim()) return undefined;
 	const parsed = Number(value);
-	if (!Number.isFinite(parsed) || parsed < 1 || parsed > 100) {
+	if (!Number.isFinite(parsed) || parsed < 1 || parsed > LIMIT_MAX) {
 		throw new Error(MEMORY_INVALID_LIMIT);
 	}
 	return Math.floor(parsed);
 }
 
+function parseOffset(value: string | null): number | undefined {
+	if (value == null || !value.trim()) return undefined;
+	const parsed = Number(value);
+	if (!Number.isFinite(parsed) || parsed < 0 || parsed > OFFSET_MAX) {
+		throw new Error(MEMORY_INVALID_OFFSET);
+	}
+	return Math.floor(parsed);
+}
+
 function parseConnectorId(value: string | null | undefined): string | undefined {
 	if (value == null) return undefined;
 	const trimmed = optionalFilter(String(value), 120);
@@ -87,6 +100,7 @@ async function GETHandler(request: NextRequest) {
 	let sessionId: string | undefined;
 	let query: string | undefined;
 	let limit: number | undefined;
+	let offset: number | undefined;
 	try {
 		const params = request.nextUrl.searchParams;
 		connectorId = parseConnectorId(params.get("connectorId"));
@@ -95,6 +109,7 @@ async function GETHandler(request: NextRequest) {
 		sessionId = optionalFilter(params.get("sessionId"));
 		query = optionalFilter(params.get("q"), QUERY_MAX);
 		limit = parseLimit(params.get("limit"));
+		offset = parseOffset(params.get("offset"));
 	} catch (error) {
 		return errorResponse(error, MEMORY_INVALID_FILTER, 400);
 	}
@@ -107,6 +122,7 @@ async function GETHandler(request: NextRequest) {
 			sessionId,
 			query,
 			limit,
+			offset,
 		})
 	);
 	if (err) {
```

---

### Incident Patch 3: `a098764f` (2026-09-28)
**Commit Message**: docs: send OpenLIT traces to Oodle from the collector (#1557)

Co-authored-by: Aman Agarwal <[REDACTED_EMAIL]>

**File**: `docs/latest/sdk/destinations/oodle.mdx` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 ---
 title: 'Oodle'
-description: 'Send OpenLIT AI observability data to Oodle for high-scale, cost-efficient LLM metrics and log storage'
+description: 'Send OpenLIT traces and metrics to Oodle for high-scale, cost-efficient agent observability'
 ---
 
 import Intro from '/snippets/destinations/oodle/intro.mdx';
```

**File**: `docs/snippets/destinations/oodle/intro.mdx` (modified, +9/-8)
```diff
@@ -1,10 +1,14 @@
-To send OpenTelemetry metrics generated by OpenLIT from your AI Application to Oodle, follow the below steps.
+<Frame>
+  <img src="/images/oodle-agent-observability.png" />
+</Frame>
+
+To send OpenTelemetry traces and metrics generated by OpenLIT from your AI Application to Oodle, follow the below steps.
 
 ### 1. Get your Oodle Credentials
 
 1. **Sign in to your Oodle account**
 2. **Get your Oodle credentials**:
-   - **OODLE_ENDPOINT**: Your Oodle metrics ingestion endpoint
+   - **OODLE_ENDPOINT**: Your Oodle OTLP ingestion endpoint
    - **INSTANCE_ID**: Your Oodle instance identifier
    - **API_KEY**: Your Oodle API key for authentication
 
@@ -30,13 +34,10 @@ processors:
 
 exporters:
   otlphttp/oodle:
-    metrics_endpoint: "https://OODLE_ENDPOINT/v1/otlp/metrics/INSTANCE_ID"
+    endpoint: "https://OODLE_ENDPOINT"
     headers:
+      X-OODLE-INSTANCE: "INSTANCE_ID"
       X-API-KEY: "API_KEY"
-  debug:
-    verbosity: detailed
-    sampling_initial: 5
-    sampling_thereafter: 200
 
 service:
   pipelines:
@@ -47,7 +48,7 @@ service:
     traces:
       receivers: [otlp]
       processors: [batch]
-      exporters: [debug]
+      exporters: [otlphttp/oodle]
 ```
 </Accordion>
 
```

---

### Incident Patch 4: `5c6b95d2` (2026-09-28)
**Commit Message**: fix(client): attribute Perplexity requests (#1628)

Co-authored-by: Aman Agarwal <[REDACTED_EMAIL]>

**File**: `src/client/src/__tests__/lib/platform/chat/stream.test.ts` (modified, +9/-0)
```diff
@@ -101,6 +101,15 @@ describe('getModelInstance', () => {
     expect(instance).toBeDefined();
   });
 
+  it('attributes Perplexity requests to OpenLIT', () => {
+    getModelInstance('perplexity', 'key', 'sonar');
+    expect(createOpenAI).toHaveBeenCalledWith({
+      baseURL: 'https://api.perplexity.ai',
+      apiKey: 'key',
+      headers: { 'X-Pplx-Integration': 'openlit' },
+    });
+  });
+
   it('supports all built-in providers including MiniMax', () => {
     const providers = [
       'openai', 'anthropic', 'google', 'mistral', 'cohere',
```

**File**: `src/client/src/__tests__/lib/platform/evaluation/run-evaluation.test.ts` (modified, +5/-1)
```diff
@@ -96,7 +96,11 @@ describe('runEvaluation — provider routing', () => {
 
   it('creates OpenAI-compatible model for provider=perplexity', async () => {
     await runEvaluation({ ...BASE_PARAMS, provider: 'perplexity' });
-    expect(createOpenAI).toHaveBeenCalledWith(expect.objectContaining({ baseURL: 'https://api.perplexity.ai' }));
+    expect(createOpenAI).toHaveBeenCalledWith({
+      baseURL: 'https://api.perplexity.ai',
+      apiKey: 'sk-test',
+      headers: { 'X-Pplx-Integration': 'openlit' },
+    });
   });
 
   it('creates OpenAI-compatible model for provider=deepseek', async () => {
```

**File**: `src/client/src/__tests__/lib/platform/openground/ai-sdk-adapter.test.ts` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+jest.mock('ai', () => ({ generateText: jest.fn() }));
+jest.mock('@ai-sdk/openai', () => ({ createOpenAI: jest.fn() }));
+jest.mock('@ai-sdk/anthropic', () => ({ createAnthropic: jest.fn() }));
+jest.mock('@ai-sdk/google', () => ({ google: jest.fn() }));
+jest.mock('@ai-sdk/mistral', () => ({ createMistral: jest.fn() }));
+jest.mock('@ai-sdk/cohere', () => ({ createCohere: jest.fn() }));
+
+import { generateText } from 'ai';
+import { createOpenAI } from '@ai-sdk/openai';
+import { AISdkAdapter } from '@/lib/platform/openground/ai-sdk-adapter';
+
+it('attributes Perplexity requests to OpenLIT', async () => {
+  const model = {};
+  (createOpenAI as jest.Mock).mockReturnValue(() => model);
+  (generateText as jest.Mock).mockResolvedValue({
+    text: 'response',
+    usage: { inputTokens: 1, outputTokens: 1 },
+    finishReason: 'stop',
+  });
+
+  await AISdkAdapter.generateCompletion({
+    provider: 'perplexity',
+    model: 'sonar',
+    apiKey: 'key',
+  });
+
+  expect(createOpenAI).toHaveBeenCalledWith({
+    baseURL: 'https://api.perplexity.ai',
+    apiKey: 'key',
+    headers: { 'X-Pplx-Integration': 'openlit' },
+  });
+});
```

**File**: `src/client/src/lib/platform/chat/stream.ts` (modified, +5/-1)
```diff
@@ -27,7 +27,11 @@ const providerFactories: Record<string, ProviderFactory> = {
 	mistral: (apiKey) => createMistral({ apiKey }),
 	cohere: (apiKey) => createCohere({ apiKey }),
 	groq: (apiKey) => createOpenAI({ baseURL: "https://api.groq.com/openai/v1", apiKey }),
-	perplexity: (apiKey) => createOpenAI({ baseURL: "https://api.perplexity.ai", apiKey }),
+	perplexity: (apiKey) => createOpenAI({
+		baseURL: "https://api.perplexity.ai",
+		apiKey,
+		headers: { "X-Pplx-Integration": "openlit" },
+	}),
 	azure: (apiKey) => createOpenAI({
 		baseURL: process.env.AZURE_OPENAI_ENDPOINT || "https://your-resource.openai.azure.com",
 		apiKey,
```

**File**: `src/client/src/lib/platform/evaluation/run-evaluation.ts` (modified, +1/-0)
```diff
@@ -87,6 +87,7 @@ function getModel(provider: string, model: string, apiKey: string) {
 			return createOpenAI({
 				baseURL: "https://api.perplexity.ai",
 				apiKey,
+				headers: { "X-Pplx-Integration": "openlit" },
 			})(model);
 		case "deepseek":
 			return createOpenAI({
```

**File**: `src/client/src/lib/platform/openground/ai-sdk-adapter.ts` (modified, +2/-1)
```diff
@@ -41,7 +41,8 @@ export class AISdkAdapter {
 		}),
 		perplexity: (apiKey: string) => createOpenAI({
 			baseURL: 'https://api.perplexity.ai',
-			apiKey
+			apiKey,
+			headers: { 'X-Pplx-Integration': 'openlit' },
 		}),
 		azure: (apiKey: string) => createOpenAI({
 			baseURL: process.env.AZURE_OPENAI_ENDPOINT || 'https://your-resource.openai.azure.com',
```

---

### Incident Patch 5: `73ffa6e5` (2026-09-28)
**Commit Message**: docs: surface content capture controls in the AI observability quickstart (#1652)

Co-authored-by: Aman Agarwal <[REDACTED_EMAIL]>

**File**: `docs/snippets/quickstart-observability.mdx` (modified, +3/-0)
```diff
@@ -57,6 +57,9 @@ flowchart TB;
     <Step title="Instrument your AI application">
       <Tabs>
         <Tab title="Python">
+          <Note>
+          OpenLIT captures prompt and completion content on spans by default (`capture_message_content=True`). Pass `capture_message_content=False` to keep that content out of your traces, `max_content_length` to truncate it, or `guards=[openlit.PII(action="redact")]` to redact sensitive values before a prompt is sent and recorded — today that rewrite only reaches single-message prompts, so do not rely on it for a multi-turn conversation. See [Disable Tracing of Content](/latest/sdk/features/tracing#disable-tracing-of-content), [Limit Content Length](/latest/sdk/features/tracing#limit-content-length), [Guardrails](/latest/sdk/features/guardrails) and the full [Configuration](/latest/sdk/configuration) reference.
+          </Note>
           <Tabs>
             <Tab title="Manual instrumentation">
               <Tabs>
```

---

### Incident Patch 6: `9cbcc324` (2026-09-15)
**Commit Message**: fix(vertexai): track reasoning tokens from thoughts_token_count (#1544)

**File**: `sdk/python/src/openlit/instrumentation/vertexai/async_vertexai.py` (modified, +1/-0)
```diff
@@ -59,6 +59,7 @@ def __init__(
             self._llmresponse = ""
             self._input_tokens = 0
             self._output_tokens = 0
+            self._reasoning_tokens = 0
             self._cache_read_input_tokens = 0
             self._cache_creation_input_tokens = 0
             self._kwargs = kwargs
```

**File**: `sdk/python/src/openlit/instrumentation/vertexai/utils.py` (modified, +23/-0)
```diff
@@ -229,6 +229,10 @@ def emit_inference_event(
                 attributes[SemanticConvention.GEN_AI_USAGE_INPUT_TOKENS] = value
             elif key == "output_tokens":
                 attributes[SemanticConvention.GEN_AI_USAGE_OUTPUT_TOKENS] = value
+            elif key == "reasoning_tokens":
+                # Vertex/Gemini: thoughts_token_count is separate from
+                # candidates_token_count, not a subset of output tokens.
+                attributes[SemanticConvention.GEN_AI_USAGE_REASONING_TOKENS] = value
             elif key == "cache_read_input_tokens":
                 attributes[SemanticConvention.GEN_AI_USAGE_CACHE_READ_INPUT_TOKENS] = (
                     value
@@ -277,6 +281,9 @@ def process_chunk(scope, chunk):
     scope._output_tokens = (
         getattr(usage_metadata, "candidates_token_count", 0) if usage_metadata else 0
     )
+    scope._reasoning_tokens = (
+        getattr(usage_metadata, "thoughts_token_count", 0) if usage_metadata else 0
+    ) or 0
     scope._cache_read_input_tokens = (
         getattr(usage_metadata, "cached_content_token_count", 0)
         if usage_metadata
@@ -424,6 +431,17 @@ def common_chat_logic(
     )
     scope._span.set_attribute(SemanticConvention.GEN_AI_USAGE_COST, cost)
 
+    # Reasoning tokens
+    if (
+        hasattr(scope, "_reasoning_tokens")
+        and scope._reasoning_tokens
+        and scope._reasoning_tokens > 0
+    ):
+        scope._span.set_attribute(
+            SemanticConvention.GEN_AI_USAGE_REASONING_TOKENS,
+            scope._reasoning_tokens,
+        )
+
     # OTel cached token attributes (set even when 0)
     if hasattr(scope, "_cache_read_input_tokens"):
         scope._span.set_attribute(
@@ -529,6 +547,8 @@ def common_chat_logic(
                 "output_tokens": output_tokens,
                 **version_extras,
             }
+            if hasattr(scope, "_reasoning_tokens") and scope._reasoning_tokens:
+                extra["reasoning_tokens"] = scope._reasoning_tokens
             if capture_message_content and system_instr:
                 extra["system_instructions"] = system_instr
             emit_inference_event(
@@ -642,6 +662,9 @@ def process_chat_response(
     scope._output_tokens = (
         getattr(usage_metadata, "candidates_token_count", 0) if usage_metadata else 0
     )
+    scope._reasoning_tokens = (
+        getattr(usage_metadata, "thoughts_token_count", 0) if usage_metadata else 0
+    ) or 0
     scope._cache_read_input_tokens = (
         getattr(usage_metadata, "cached_content_token_count", 0)
         if usage_metadata
```

**File**: `sdk/python/src/openlit/instrumentation/vertexai/vertexai.py` (modified, +1/-0)
```diff
@@ -59,6 +59,7 @@ def __init__(
             self._llmresponse = ""
             self._input_tokens = 0
             self._output_tokens = 0
+            self._reasoning_tokens = 0
             self._cache_read_input_tokens = 0
             self._cache_creation_input_tokens = 0
             self._kwargs = kwargs
```

**File**: `sdk/python/tests/test_vertexai_reasoning_tokens.py` (added, +253/-0)
```diff
@@ -0,0 +1,253 @@
+# pylint: disable=protected-access, missing-function-docstring
+"""Vertex AI thoughts_token_count is not a subset of output tokens.
+
+Gemini/Vertex report thinking separately from candidate output:
+
+  * ``candidates_token_count`` = visible output only
+  * ``thoughts_token_count`` = thinking tokens (an addend to total, not a
+    facet of output)
+  * ``total_token_count`` = prompt + candidates + thoughts (+ tool-use)
+
+That is the opposite of the OpenAI #1537 subset invariant, where reasoning
+is already inside ``output_tokens``. These tests lock the Vertex instrumentor
+to the google_ai_studio pattern: emit ``gen_ai.usage.reasoning_tokens`` when
+thoughts > 0, and leave ``gen_ai.usage.output_tokens`` as candidates only.
+"""
+
+import time
+from types import SimpleNamespace
+from unittest.mock import MagicMock
+
+from opentelemetry.sdk.trace import TracerProvider
+from opentelemetry.sdk.trace.export import SimpleSpanProcessor
+from opentelemetry.sdk.trace.export.in_memory_span_exporter import (
+    InMemorySpanExporter,
+)
+
+from openlit._config import OpenlitConfig
+from openlit.instrumentation.vertexai import utils as vertexai_utils
+from openlit.semcov import SemanticConvention
+
+PROMPT_TOKENS = 100
+CANDIDATE_TOKENS = 50
+THOUGHT_TOKENS = 25
+
+
+def _tracer_with_exporter():
+    OpenlitConfig.reset_to_defaults()
+    exporter = InMemorySpanExporter()
+    provider = TracerProvider()
+    provider.add_span_processor(SimpleSpanProcessor(exporter))
+    return provider.get_tracer(__name__), exporter
+
+
+def _usage(prompt=PROMPT_TOKENS, candidates=CANDIDATE_TOKENS, thoughts=None):
+    kwargs = {
+        "prompt_token_count": prompt,
+        "candidates_token_count": candidates,
+        "cached_content_token_count": 0,
+        "cache_creation_input_tokens": 0,
+    }
+    if thoughts is not None:
+        kwargs["thoughts_token_count"] = thoughts
+    return SimpleNamespace(**kwargs)
+
+
+def _candidate(finish_reason="STOP"):
+    return SimpleNamespace(finish_reason=finish_reason)
+
+
+def _response(usage, text="hello"):
+    return SimpleNamespace(
+        text=text,
+        usage_metadata=usage,
+        candidates=[_candidate()],
+        id="resp_vertex_1",
+        name=None,
+    )
+
+
+def _stream_scope(span):
+    """Mirrors TracedSyncStream.__init__ plus fields process_chunk writes."""
+    return SimpleNamespace(
+        _span=span,
+        _llmresponse="",
+        _finish_reason="",
+        _response_id="",
+        _input_tokens=0,
+        _output_tokens=0,
+        _reasoning_tokens=0,
+        _cache_read_input_tokens=0,
+        _cache_creation_input_tokens=0,
+        _response_model="gemini-2.5-pro",
+        _request_model="gemini-2.5-pro",
+        _tools=None,
+        _kwargs={"contents": [], "generation_config": {}},
+        _args=[[]],
+        _start_time=time.time(),
+        _end_time=None,
+        _timestamps=[],
+        _ttft=0,
+        _tbt=0,
+        _server_address="us-central1-aiplatform.googleapis.com",
+        _server_port=443,
+    )
+
+
+def _chunk(text="", usage=None, finish_reason=""):
+    return SimpleNamespace(
+        text=text,
+        usage_metadata=usage,
+        candidates=[_candidate(finish_reason)] if finish_reason else [],
+    )
+
+
+def _assert_thoughts_not_folded_into_output(attrs, thoughts=THOUGHT_TOKENS):
+    """Thoughts are recorded separately and must not change output_tokens."""
+    assert attrs[SemanticConvention.GEN_AI_USAGE_INPUT_TOKENS] == PROMPT_TOKENS
+    assert attrs[SemanticConvention.GEN_AI_USAGE_OUTPUT_TOKENS] == CANDIDATE_TOKENS
+    assert attrs[SemanticConvention.GEN_AI_USAGE_REASONING_TOKENS] == thoughts
+    # Total usage stays prompt + candidates, matching google_ai_studio.
+    assert (
+        attrs[SemanticConvention.GEN_AI_CLIENT_TOKEN_USAGE]
+        == PROMPT_TOKENS + CANDIDATE_TOKENS
+    )
+    # OpenAI #1537 subset attributes must not be applied to Vertex/Gemini.
+    assert SemanticConvention.GEN_AI_USAGE_REASONING_OUTPUT_TOKENS not in attrs
+    assert SemanticConvention.GEN_AI_USAGE_DERIVED_COMPLETED_OUTPUT_TOKENS not in attrs
+
+
+def test_non_streaming_records_thoughts_separately_from_candidates():
+    tracer, exporter = _tracer_with_exporter()
+    response = _response(_usage(thoughts=THOUGHT_TOKENS))
+    with tracer.start_as_current_span("vertexai.chat") as span:
+        vertexai_utils.process_chat_response(
+            response=response,
+            request_model="gemini-2.5-pro",
+            pricing_info={},
+            server_port=443,
+            server_address="us-central1-aiplatform.googleapis.com",
+            environment="test",
+            application_name="test",
+            metrics=None,
+            start_time=time.time(),
+            span=span,
+            capture_message_content=False,
+            disable_metrics=True,
+            version="1.0.0",
+            contents=[],
+        )
+    attrs = exporter.get_finished_spans()[0].attribut
```

---

### Incident Patch 7: `f806ffb7` (2026-09-15)
**Commit Message**: fix(openai): measured-zero reasoning vs unknown + derived completed tokens (#1537 chat-completions path) (#1543)

**File**: `sdk/python/src/openlit/instrumentation/openai/async_openai.py` (modified, +3/-1)
```diff
@@ -308,7 +308,9 @@ def __init__(
             self._finish_reason = ""
             self._input_tokens = 0
             self._output_tokens = 0
-            self._reasoning_tokens = 0
+            # Do not default _reasoning_tokens. Absence means no usage was
+            # received yet; a literal 0 is a measured zero and would be emitted
+            # as reported=true if the stream ends without response.completed.
             self._operation_type = "responses"
             self._service_tier = "default"
             self._tools = None
```

**File**: `sdk/python/src/openlit/instrumentation/openai/openai.py` (modified, +3/-1)
```diff
@@ -310,7 +310,9 @@ def __init__(
             self._finish_reason = ""
             self._input_tokens = 0
             self._output_tokens = 0
-            self._reasoning_tokens = 0
+            # Do not default _reasoning_tokens. Absence means no usage was
+            # received yet; a literal 0 is a measured zero and would be emitted
+            # as reported=true if the stream ends without response.completed.
             self._operation_type = "responses"
             self._service_tier = "default"
             self._tools = None
```

**File**: `sdk/python/src/openlit/instrumentation/openai/utils.py` (modified, +67/-26)
```diff
@@ -105,16 +105,67 @@ def extract_reasoning_content(payload):
 
 
 def extract_reasoning_tokens(usage, details_key):
-    """Return reasoning tokens (a subset of output tokens) from a usage dict.
+    """Return reasoning tokens (a subset of output tokens) from a usage dict,
+    or None when the provider did not report the details object.
 
     Works for both chat completions (``completion_tokens_details``) and the
-    responses API (``output_tokens_details``) and falls back to 0 whenever the
-    details object is missing or not a dict.
+    responses API (``output_tokens_details``). A missing or non-dict details
+    object means "unknown" and stays distinguishable from an explicit
+    ``reasoning_tokens: 0`` measurement (None vs 0): a reported 0 is a
+    measurement, an absent object is an unknown, and the two must not collapse
+    into the same value.
     """
-    details = (usage or {}).get(details_key) or {}
+    details = (usage or {}).get(details_key)
     if not isinstance(details, dict):
-        details = {}
-    return details.get("reasoning_tokens", 0) or 0
+        return None
+    value = details.get("reasoning_tokens")
+    if not isinstance(value, (int, float)) or isinstance(value, bool):
+        return None
+    return value
+
+
+def set_reasoning_subset_attributes(span, output_tokens, reasoning_tokens):
+    """Emit reasoning-token attributes under the subset invariant.
+
+    ``gen_ai.usage.reasoning.output_tokens`` is a facet of the output total,
+    never an addend. Three states stay distinguishable:
+
+    * provider reported a value (including an explicit 0): the facet is
+      emitted, ``...output_tokens.reported`` is true, and the derived
+      completed figure is available;
+    * provider sent no details object: no facet value, marker false
+      (unknown, not a guessed 0);
+    * no usage at all (stream without include_usage): nothing emitted.
+
+    The completed figure is output minus reasoning and lives under the
+    ``gen_ai.usage.derived.*`` namespace so it can never be mistaken for a
+    provider-reported number.
+    """
+    if reasoning_tokens is None:
+        span.set_attribute(
+            SemanticConvention.GEN_AI_USAGE_REASONING_OUTPUT_TOKENS_REPORTED,
+            False,
+        )
+        return
+    span.set_attribute(
+        SemanticConvention.GEN_AI_USAGE_REASONING_OUTPUT_TOKENS_REPORTED,
+        True,
+    )
+    span.set_attribute(
+        SemanticConvention.GEN_AI_USAGE_REASONING_OUTPUT_TOKENS,
+        reasoning_tokens,
+    )
+    # OpenLIT legacy alias (pre-OTel naming), kept for backward compat; only
+    # nonzero values so legacy consumers see no behavior change.
+    if reasoning_tokens > 0:
+        span.set_attribute(
+            SemanticConvention.GEN_AI_USAGE_REASONING_TOKENS,
+            reasoning_tokens,
+        )
+    span.set_attribute(
+        SemanticConvention.GEN_AI_USAGE_DERIVED_COMPLETED_OUTPUT_TOKENS,
+        max(output_tokens - reasoning_tokens, 0),
+    )
 
 
 def format_content(messages):
@@ -1076,16 +1127,11 @@ def common_response_logic(
 
     # Reasoning tokens. OTel: gen_ai.usage.reasoning.output_tokens is a subset
     # of gen_ai.usage.output_tokens (already set above), so it is recorded as a
-    # separate attribute and never added on top of the output total.
-    if hasattr(scope, "_reasoning_tokens") and scope._reasoning_tokens > 0:
-        scope._span.set_attribute(
-            SemanticConvention.GEN_AI_USAGE_REASONING_OUTPUT_TOKENS,
-            scope._reasoning_tokens,
-        )
-        # OpenLIT legacy alias (pre-OTel naming), kept for backward compat.
-        scope._span.set_attribute(
-            SemanticConvention.GEN_AI_USAGE_REASONING_TOKENS,
-            scope._reasoning_tokens,
+    # separate attribute and never added on top of the output total. Missing
+    # details surface as unknown (marker false), never as a guessed 0.
+    if hasattr(scope, "_reasoning_tokens"):
+        set_reasoning_subset_attributes(
+            scope._span, output_tokens, scope._reasoning_tokens
         )
 
     # OTel cached token attributes (set even when 0)
@@ -1591,16 +1637,11 @@ def common_chat_logic(
 
     # Reasoning tokens (OTel: gen_ai.usage.reasoning.output_tokens is a subset
     # of gen_ai.usage.output_tokens above, so it is recorded separately and
-    # never added on top of the output total / token-usage metric).
-    if hasattr(scope, "_reasoning_tokens") and scope._reasoning_tokens > 0:
-        scope._span.set_attribute(
-            SemanticConvention.GEN_AI_USAGE_REASONING_OUTPUT_TOKENS,
-            scope._reasoning_tokens,
-        )
-        # OpenLIT legacy alias (pre-OTel naming), kept for backward compat.
-        scope._span.set_attribute(
-            SemanticConvention.GEN_AI_USAGE_REASONING_TOKENS,
-            scope._reasoning_tokens,
+    # never added on top of the output total / token-usage metric). Missing
+    # details surface as unknown (marker false), never as a 
```

**File**: `sdk/python/src/openlit/semcov/__init__.py` (modified, +6/-0)
```diff
@@ -571,6 +571,12 @@ class SemanticConvention:
     GEN_AI_USAGE_COMPLETION_TOKENS_DETAILS_REASONING = (
         "gen_ai.usage.completion_tokens_details.reasoning_tokens"
     )
+    GEN_AI_USAGE_REASONING_OUTPUT_TOKENS_REPORTED = (
+        "gen_ai.usage.reasoning.output_tokens.reported"
+    )
+    GEN_AI_USAGE_DERIVED_COMPLETED_OUTPUT_TOKENS = (
+        "gen_ai.usage.derived.completed_output_tokens"
+    )
     # OTel GenAI semconv (experimental): reasoning output tokens are a subset of
     # gen_ai.usage.output_tokens and MUST NOT be added on top of it.
     GEN_AI_USAGE_REASONING_OUTPUT_TOKENS = "gen_ai.usage.reasoning.output_tokens"
```

**File**: `sdk/python/tests/test_openai_reasoning_subset_fixture.py` (added, +333/-0)
```diff
@@ -0,0 +1,333 @@
+"""Fixture tests for the reasoning-subset invariant (Issue #1537).
+
+Locks the invariant into a regression fixture for the OpenAI chat-completions
+path, in the exact shape proposed in #1537:
+
+    usage = {output_tokens: 1000, reasoning_tokens: 700}
+      -> recorded output = 1000 (provider total, unchanged)
+      -> reasoning emitted as a facet (700), never added on top
+      -> no downstream aggregate can reach 1700
+      -> a derived "completed tokens" figure equals output - reasoning and is
+         namespaced gen_ai.usage.derived.* so it reads as derived
+      -> a provider that stops sending *_tokens_details surfaces as unknown
+         (reported marker false, no facet value), never as a guessed 0
+      -> an explicit reasoning_tokens: 0 is a measurement: facet 0, marker true
+"""
+
+import time
+from types import SimpleNamespace
+from unittest.mock import MagicMock
+
+from opentelemetry.sdk.trace import TracerProvider
+from opentelemetry.sdk.trace.export import SimpleSpanProcessor
+from opentelemetry.sdk.trace.export.in_memory_span_exporter import (
+    InMemorySpanExporter,
+)
+
+from openlit._config import OpenlitConfig
+from openlit.instrumentation.openai.utils import (
+    process_chat_chunk,
+    process_chat_response,
+    process_response_chunk,
+    process_streaming_chat_response,
+    process_streaming_response_response,
+)
+from openlit.semcov import SemanticConvention
+
+
+def _tracer_and_exporter():
+    OpenlitConfig.reset_to_defaults()
+    exporter = InMemorySpanExporter()
+    tracer_provider = TracerProvider()
+    tracer_provider.add_span_processor(SimpleSpanProcessor(exporter))
+    return tracer_provider.get_tracer("test-openai-reasoning-fixture"), exporter
+
+
+def _metrics_dict():
+    return {
+        "genai_client_usage_tokens": MagicMock(),
+        "genai_client_operation_duration": MagicMock(),
+        "genai_client_time_to_first_chunk": MagicMock(),
+        "genai_client_time_per_output_chunk": MagicMock(),
+        "genai_server_tbt": MagicMock(),
+        "genai_server_ttft": MagicMock(),
+        "genai_server_request_duration": MagicMock(),
+        "genai_cost": MagicMock(),
+    }
+
+
+def _stream_scope(span):
+    return SimpleNamespace(
+        _span=span,
+        _llmresponse="",
+        _response_id="",
+        _response_model="",
+        _finish_reason="",
+        _system_fingerprint="",
+        _service_tier="auto",
+        _tools=None,
+        _kwargs={
+            "model": "o3-mini",
+            "messages": [{"role": "user", "content": "think step by step"}],
+        },
+        _start_time=time.time(),
+        _end_time=None,
+        _timestamps=[],
+        _ttft=0,
+        _tbt=0,
+        _server_address="api.openai.com",
+        _server_port=443,
+    )
+
+
+def _run_chat_response(exporter, tracer, metrics, usage):
+    response = {
+        "id": "chatcmpl_fixture",
+        "model": "o3-mini",
+        "choices": [
+            {
+                "message": {"role": "assistant", "content": "The answer is 42."},
+                "finish_reason": "stop",
+            }
+        ],
+        "usage": usage,
+    }
+    with tracer.start_as_current_span("chat fixture") as span:
+        process_chat_response(
+            response,
+            request_model="o3-mini",
+            pricing_info={},
+            server_port=443,
+            server_address="api.openai.com",
+            environment="test-env",
+            application_name="test-app",
+            metrics=metrics,
+            start_time=time.time(),
+            span=span,
+            capture_message_content=False,
+            disable_metrics=False,
+            version="test-version",
+            model="o3-mini",
+            messages=[{"role": "user", "content": "hi"}],
+        )
+    return exporter.get_finished_spans()[0].attributes
+
+
+def test_fixture_recorded_values_never_reach_the_sum():
+    """output 1000 / reasoning 700: facet 700, derived 300, no 1700 anywhere."""
+    tracer, exporter = _tracer_and_exporter()
+    metrics = _metrics_dict()
+    attrs = _run_chat_response(
+        tracer=tracer,
+        exporter=exporter,
+        metrics=metrics,
+        usage={
+            "prompt_tokens": 500,
+            "completion_tokens": 1000,
+            "completion_tokens_details": {
+                "reasoning_tokens": 700,
+                "text_tokens": 300,
+            },
+        },
+    )
+    assert attrs[SemanticConvention.GEN_AI_USAGE_OUTPUT_TOKENS] == 1000
+    assert attrs[SemanticConvention.GEN_AI_USAGE_REASONING_OUTPUT_TOKENS] == 700
+    assert (
+        attrs[SemanticConvention.GEN_AI_USAGE_REASONING_OUTPUT_TOKENS_REPORTED]
+        is True
+    )
+    assert (
+        attrs[SemanticConvention.GEN_AI_USAGE_DERIVED_COMPLETED_OUTPUT_TOKENS]
+        == 300
+    )
+    # No single recorded value may equal the forbidden aggregate.
+    forbidden = 1700
+    assert all(value != forbidden for value in attrs.valu
```

**File**: `sdk/python/tests/test_openai_reasoning_tokens.py` (modified, +174/-7)
```diff
@@ -30,8 +30,10 @@
 from openlit.instrumentation.openai.utils import (
     process_chat_chunk,
     process_chat_response,
+    process_response_chunk,
     process_response_response,
     process_streaming_chat_response,
+    process_streaming_response_response,
 )
 from openlit.semcov import SemanticConvention
 
@@ -98,6 +100,7 @@ def _assert_no_double_counting(attrs, metrics, output_tokens=1000, reasoning_tok
 
 
 def _stream_scope(span):
+    """Chat streaming scope. Matches production: no _reasoning_tokens until usage."""
     return SimpleNamespace(
         _span=span,
         _llmresponse="",
@@ -121,6 +124,41 @@ def _stream_scope(span):
     )
 
 
+def _responses_stream_scope(span):
+    """Responses streaming scope. Matches production: no _reasoning_tokens until usage."""
+    return SimpleNamespace(
+        _span=span,
+        _llmresponse="",
+        _response_id="",
+        _response_model="",
+        _finish_reason="",
+        _input_tokens=0,
+        _output_tokens=0,
+        _operation_type="responses",
+        _service_tier="default",
+        _tools=None,
+        _response_tools=None,
+        _kwargs={
+            "model": "o3-mini",
+            "input": "think step by step",
+        },
+        _start_time=time.time(),
+        _end_time=None,
+        _timestamps=[],
+        _ttft=0,
+        _tbt=0,
+        _server_address="api.openai.com",
+        _server_port=443,
+    )
+
+
+def _assert_no_reasoning_usage_attrs(attrs):
+    assert SemanticConvention.GEN_AI_USAGE_REASONING_OUTPUT_TOKENS not in attrs
+    assert SemanticConvention.GEN_AI_USAGE_REASONING_OUTPUT_TOKENS_REPORTED not in attrs
+    assert SemanticConvention.GEN_AI_USAGE_DERIVED_COMPLETED_OUTPUT_TOKENS not in attrs
+    assert SemanticConvention.GEN_AI_USAGE_REASONING_TOKENS not in attrs
+
+
 def test_chat_completions_reasoning_tokens_are_subset_of_output():
     """o1/o3-style chat completion: reasoning stays a subset of output tokens."""
     tracer, exporter = _tracer_and_exporter()
@@ -253,8 +291,113 @@ def test_responses_api_reasoning_tokens_are_subset_of_output():
     _assert_no_double_counting(exporter.get_finished_spans()[0].attributes, metrics)
 
 
-def test_no_reasoning_tokens_omits_reasoning_attribute():
-    """No completion_tokens_details: reasoning attribute absent, output intact."""
+def test_streaming_chat_without_usage_emits_no_reasoning_attrs():
+    """Chat stream without include_usage: no reasoning attributes at all."""
+    tracer, exporter = _tracer_and_exporter()
+    metrics = _metrics_dict()
+    span = tracer.start_span("chat no usage")
+    scope = _stream_scope(span)
+
+    process_chat_chunk(
+        scope,
+        {
+            "id": "chatcmpl_no_usage",
+            "model": "o3-mini",
+            "choices": [{"delta": {"content": "The answer is 42."}}],
+        },
+    )
+
+    with span:
+        process_streaming_chat_response(
+            scope,
+            pricing_info={},
+            environment="test-env",
+            application_name="test-app",
+            metrics=metrics,
+            capture_message_content=False,
+            disable_metrics=False,
+            version="test-version",
+        )
+
+    _assert_no_reasoning_usage_attrs(exporter.get_finished_spans()[0].attributes)
+
+
+def test_streaming_responses_without_completed_emits_no_reasoning_attrs():
+    """Responses stream with no response.completed: skip reasoning attrs entirely.
+
+    Production wrappers must not default _reasoning_tokens to 0; a literal 0 is
+    a measured zero and would emit reported=true plus a derived completed figure.
+    """
+    tracer, exporter = _tracer_and_exporter()
+    metrics = _metrics_dict()
+    span = tracer.start_span("responses no completed")
+    scope = _responses_stream_scope(span)
+
+    process_response_chunk(
+        scope,
+        {"type": "response.output_text.delta", "delta": "The answer is 42."},
+    )
+
+    with span:
+        process_streaming_response_response(
+            scope,
+            pricing_info={},
+            environment="test-env",
+            application_name="test-app",
+            metrics=metrics,
+            capture_message_content=False,
+            disable_metrics=False,
+            version="test-version",
+        )
+
+    _assert_no_reasoning_usage_attrs(exporter.get_finished_spans()[0].attributes)
+
+
+def test_streaming_responses_with_usage_keeps_subset():
+    """Responses stream with response.completed usage: reasoning stays a subset."""
+    tracer, exporter = _tracer_and_exporter()
+    metrics = _metrics_dict()
+    span = tracer.start_span("responses stream o3-mini")
+    scope = _responses_stream_scope(span)
+
+    process_response_chunk(
+        scope,
+        {"type": "response.output_text.delta", "delta": "The answer is 42."},
+    )
+    process_response_chunk(
+        scope,
+        {
+            "type": "response.completed",
+            "response": {
+                "id": "resp_stream_o1
```

---

### Incident Patch 8: `d921e530` (2026-09-15)
**Commit Message**: fix(python-sdk): capture streamed tool calls (#1542)

**File**: `sdk/python/src/openlit/instrumentation/ai21/utils.py` (modified, +28/-6)
```diff
@@ -285,15 +285,37 @@ def process_chunk(scope, chunk):
     chunked = response_as_dict(chunk)
 
     # Collect message IDs and aggregated response from events
-    if (
-        len(chunked.get("choices", [])) > 0
-        and "delta" in chunked.get("choices")[0]
-        and "content" in chunked.get("choices")[0].get("delta", {})
-    ):
-        content = chunked.get("choices")[0].get("delta").get("content")
+    choices = chunked.get("choices", [])
+    if choices and "delta" in choices[0]:
+        delta = choices[0].get("delta", {})
+        content = delta.get("content")
         if content:
             scope._llmresponse += content
 
+        delta_tools = delta.get("tool_calls")
+        if delta_tools:
+            scope._tools = scope._tools or []
+            for tool in delta_tools:
+                index = tool.get("index", 0)
+                scope._tools.extend([{}] * (index + 1 - len(scope._tools)))
+                function = tool.get("function") or {}
+                if tool.get("id"):
+                    scope._tools[index] = {
+                        "id": tool["id"],
+                        "function": {
+                            # `or ""` handles explicit None from OpenAI-compatible SDKs
+                            "name": function.get("name") or "",
+                            "arguments": function.get("arguments") or "",
+                        },
+                        "type": tool.get("type", "function"),
+                    }
+                elif scope._tools[index] and "function" in tool:
+                    new_args = function.get("arguments") or ""
+                    if scope._tools[index]["function"]["arguments"] is None:
+                        scope._tools[index]["function"]["arguments"] = new_args
+                    else:
+                        scope._tools[index]["function"]["arguments"] += new_args
+
     # Handle token usage including reasoning tokens and cached tokens
     if chunked.get("usage"):
         usage = chunked.get("usage", {})
```

**File**: `sdk/python/src/openlit/instrumentation/groq/utils.py` (modified, +24/-0)
```diff
@@ -287,6 +287,30 @@ def process_chunk(scope, chunk):
             scope._llmresponse += content
         append_scope_reasoning(scope, extract_reasoning_content(delta, "reasoning"))
 
+        delta_tools = delta.get("tool_calls")
+        if delta_tools:
+            scope._tools = scope._tools or []
+            for tool in delta_tools:
+                index = tool.get("index", 0)
+                scope._tools.extend([{}] * (index + 1 - len(scope._tools)))
+                function = tool.get("function") or {}
+                if tool.get("id"):
+                    scope._tools[index] = {
+                        "id": tool["id"],
+                        "function": {
+                            # `or ""` handles explicit None from OpenAI-compatible SDKs
+                            "name": function.get("name") or "",
+                            "arguments": function.get("arguments") or "",
+                        },
+                        "type": tool.get("type", "function"),
+                    }
+                elif scope._tools[index] and "function" in tool:
+                    new_args = function.get("arguments") or ""
+                    if scope._tools[index]["function"]["arguments"] is None:
+                        scope._tools[index]["function"]["arguments"] = new_args
+                    else:
+                        scope._tools[index]["function"]["arguments"] += new_args
+
     if chunked.get("x_groq") is not None:
         if chunked.get("x_groq").get("usage") is not None:
             # Handle token usage including reasoning tokens and cached tokens
```

**File**: `sdk/python/src/openlit/instrumentation/together/utils.py` (modified, +28/-5)
```diff
@@ -66,14 +66,37 @@ def process_chunk(scope, chunk):
 
     chunked = response_as_dict(chunk)
     # Collect message IDs and aggregated response from events
-    if len(chunked.get("choices")) > 0 and (
-        "delta" in chunked.get("choices")[0]
-        and "content" in chunked.get("choices")[0].get("delta")
-    ):
-        content = chunked.get("choices")[0].get("delta").get("content")
+    choices = chunked.get("choices", [])
+    if choices and "delta" in choices[0]:
+        delta = choices[0].get("delta", {})
+        content = delta.get("content")
         if content:
             scope._llmresponse += content
 
+        delta_tools = delta.get("tool_calls")
+        if delta_tools:
+            scope._tools = scope._tools or []
+            for tool in delta_tools:
+                index = tool.get("index", 0)
+                scope._tools.extend([{}] * (index + 1 - len(scope._tools)))
+                function = tool.get("function") or {}
+                if tool.get("id"):
+                    scope._tools[index] = {
+                        "id": tool["id"],
+                        "function": {
+                            # `or ""` handles explicit None from OpenAI-compatible SDKs
+                            "name": function.get("name") or "",
+                            "arguments": function.get("arguments") or "",
+                        },
+                        "type": tool.get("type", "function"),
+                    }
+                elif scope._tools[index] and "function" in tool:
+                    new_args = function.get("arguments") or ""
+                    if scope._tools[index]["function"]["arguments"] is None:
+                        scope._tools[index]["function"]["arguments"] = new_args
+                    else:
+                        scope._tools[index]["function"]["arguments"] += new_args
+
     if chunked.get("usage"):
         scope._response_id = chunked.get("id")
         scope._response_model = chunked.get("model")
```

**File**: `sdk/python/tests/test_streaming_tool_calls.py` (added, +194/-0)
```diff
@@ -0,0 +1,194 @@
+# pylint: disable=missing-function-docstring
+"""Regression tests: streamed tool-call deltas must populate scope._tools.
+
+Groq, AI21, and Together only assigned scope._tools on the non-streaming path.
+process_chunk ignored delta.tool_calls (and AI21/Together skipped tool-only
+deltas that had no content), so common_chat_logic never emitted tool span
+attributes. These tests drive the real process_chunk helpers with synthetic
+OpenAI-compatible chunks.
+
+Fixes: https://github.com/openlit/openlit/issues/1540
+"""
+
+from types import SimpleNamespace
+
+import pytest
+
+from openlit.instrumentation.ai21 import utils as ai21_utils
+from openlit.instrumentation.groq import utils as groq_utils
+from openlit.instrumentation.together import utils as together_utils
+
+PROVIDERS = [groq_utils, ai21_utils, together_utils]
+
+
+def _scope():
+    return SimpleNamespace(
+        _timestamps=[],
+        _start_time=0,
+        _llmresponse="",
+        _tools=None,
+    )
+
+
+@pytest.mark.parametrize("utils", PROVIDERS)
+def test_streaming_tool_calls_are_accumulated(utils):
+    scope = _scope()
+
+    utils.process_chunk(
+        scope,
+        {
+            "choices": [
+                {
+                    "delta": {
+                        "tool_calls": [
+                            {
+                                "index": 0,
+                                "id": "call_1",
+                                "type": "function",
+                                "function": {
+                                    "name": "lookup",
+                                    "arguments": '{"q":"',
+                                },
+                            }
+                        ]
+                    }
+                }
+            ]
+        },
+    )
+    utils.process_chunk(
+        scope,
+        {
+            "choices": [
+                {
+                    "delta": {
+                        "tool_calls": [
+                            {
+                                "index": 0,
+                                "function": {"arguments": "weather"},
+                            }
+                        ]
+                    }
+                }
+            ]
+        },
+    )
+
+    assert scope._tools == [
+        {
+            "id": "call_1",
+            "type": "function",
+            "function": {"name": "lookup", "arguments": '{"q":"weather'},
+        }
+    ]
+
+
+@pytest.mark.parametrize("utils", PROVIDERS)
+def test_streaming_tool_calls_tolerate_null_arguments(utils):
+    """OpenAI-compatible SDKs often send arguments=None on the first delta."""
+    scope = _scope()
+
+    utils.process_chunk(
+        scope,
+        {
+            "choices": [
+                {
+                    "delta": {
+                        "tool_calls": [
+                            {
+                                "index": 0,
+                                "id": "call_1",
+                                "type": "function",
+                                "function": {"name": "lookup", "arguments": None},
+                            }
+                        ]
+                    }
+                }
+            ]
+        },
+    )
+    utils.process_chunk(
+        scope,
+        {
+            "choices": [
+                {
+                    "delta": {
+                        "tool_calls": [
+                            {
+                                "index": 0,
+                                "function": {"arguments": '{"q":"weather"}'},
+                            }
+                        ]
+                    }
+                }
+            ]
+        },
+    )
+
+    assert scope._tools[0]["function"]["name"] == "lookup"
+    assert scope._tools[0]["function"]["arguments"] == '{"q":"weather"}'
+
+
+@pytest.mark.parametrize("utils", PROVIDERS)
+def test_streaming_parallel_tool_calls_use_index(utils):
+    scope = _scope()
+
+    utils.process_chunk(
+        scope,
+        {
+            "choices": [
+                {
+                    "delta": {
+                        "tool_calls": [
+                            {
+                                "index": 0,
+                                "id": "call_1",
+                                "type": "function",
+                                "function": {
+                                    "name": "get_weather",
+                                    "arguments": None,
+                                },
+                            },
+                            {
+                                "index": 1,
+                                "id": "call_2",
+                                "type": "function",
+                                "function": {"name": "get_time", "arguments": ""},
+                            },
+                        ]
+                    }
+                }
+            ]
+        },
+    )
+    utils.process_chunk(
+        scope,
+        {

```

---

### Incident Patch 9: `2e5cd2d9` (2026-09-15)
**Commit Message**: fix(python-sdk): support mistralai 2.x instrumentation paths (#1539)

**File**: `sdk/python/src/openlit/guard/_integration.py` (modified, +12/-0)
```diff
@@ -251,6 +251,18 @@ def _extract_generic_output(response: Any) -> str:
         _extract_generic_input,
         _extract_generic_output,
     ),
+    (
+        "mistralai.client.chat",
+        "Chat.complete",
+        _extract_generic_input,
+        _extract_generic_output,
+    ),
+    (
+        "mistralai.client.chat",
+        "Chat.complete_async",
+        _extract_generic_input,
+        _extract_generic_output,
+    ),
     # Cohere
     (
         "cohere.client_v2",
```

**File**: `sdk/python/src/openlit/instrumentation/mistral/__init__.py` (modified, +123/-94)
```diff
@@ -1,5 +1,6 @@
 """Initializer of Auto Instrumentation of Mistral Functions"""
 
+import logging
 from typing import Collection
 import importlib.metadata
 from opentelemetry import _logs
@@ -17,6 +18,32 @@
 
 _instruments = ("mistralai >= 1.0.0",)
 
+logger = logging.getLogger(__name__)
+
+# 1.x keeps chat/embeddings at the package root. 2.x moved them under
+# mistralai.client. Both layouts expose the same class and method names.
+_CHAT_MODULES = ("mistralai.chat", "mistralai.client.chat")
+_EMBEDDINGS_MODULES = ("mistralai.embeddings", "mistralai.client.embeddings")
+
+
+def _safe_wrap(module, class_method, wrapper):
+    """Wrap a function, skipping SDK module layouts that are not installed.
+
+    wrapt 2.x imports the target module immediately, so wrapping the 1.x
+    path on mistralai 2.x (and vice versa) raises ``ModuleNotFoundError``.
+    wrapt 2.4+ wraps that as ``TargetModuleNotFoundError``, a
+    ``ModuleNotFoundError`` subclass, so catching the base exception covers
+    both. wrapt 1.x registers a post-import hook instead and does not raise.
+    """
+    try:
+        wrap_function_wrapper(module, class_method, wrapper)
+    except (ModuleNotFoundError, AttributeError):
+        logger.debug(
+            "Skipping %s.%s - not available in this mistralai version",
+            module,
+            class_method,
+        )
+
 
 class MistralInstrumentor(BaseInstrumentor):
     """
@@ -37,105 +64,107 @@ def _instrument(self, **kwargs):
         event_provider = _logs.get_logger_provider().get_logger(__name__)
         version = importlib.metadata.version("mistralai")
 
-        # sync chat completions
-        wrap_function_wrapper(
-            "mistralai.chat",
-            "Chat.complete",
-            complete(
-                version,
-                environment,
-                application_name,
-                tracer,
-                pricing_info,
-                capture_message_content,
-                metrics,
-                disable_metrics,
-                event_provider,
-            ),
-        )
+        for chat_module in _CHAT_MODULES:
+            # sync chat completions
+            _safe_wrap(
+                chat_module,
+                "Chat.complete",
+                complete(
+                    version,
+                    environment,
+                    application_name,
+                    tracer,
+                    pricing_info,
+                    capture_message_content,
+                    metrics,
+                    disable_metrics,
+                    event_provider,
+                ),
+            )
 
-        # sync chat streaming
-        wrap_function_wrapper(
-            "mistralai.chat",
-            "Chat.stream",
-            stream(
-                version,
-                environment,
-                application_name,
-                tracer,
-                pricing_info,
-                capture_message_content,
-                metrics,
-                disable_metrics,
-                event_provider,
-            ),
-        )
+            # sync chat streaming
+            _safe_wrap(
+                chat_module,
+                "Chat.stream",
+                stream(
+                    version,
+                    environment,
+                    application_name,
+                    tracer,
+                    pricing_info,
+                    capture_message_content,
+                    metrics,
+                    disable_metrics,
+                    event_provider,
+                ),
+            )
 
-        # sync embeddings
-        wrap_function_wrapper(
-            "mistralai.embeddings",
-            "Embeddings.create",
-            embed(
-                version,
-                environment,
-                application_name,
-                tracer,
-                pricing_info,
-                capture_message_content,
-                metrics,
-                disable_metrics,
-            ),
-        )
+            # async chat completions
+            _safe_wrap(
+                chat_module,
+                "Chat.complete_async",
+                async_complete(
+                    version,
+                    environment,
+                    application_name,
+                    tracer,
+                    pricing_info,
+                    capture_message_content,
+                    metrics,
+                    disable_metrics,
+                    event_provider,
+                ),
+            )
 
-        # async chat completions
-        wrap_function_wrapper(
-            "mistralai.chat",
-            "Chat.complete_async",
-            async_complete(
-                version,
-                environment,
-                application_name,
-                tracer,
-                pricing_info,
-                capture_message_content,
-                metrics,
-                disable_metrics,
-                event_provider,
-            ),
-        )
+     
```

**File**: `sdk/python/tests/test_guard_integration.py` (modified, +16/-0)
```diff
@@ -9,6 +9,7 @@
 from openlit.guard import _integration
 from openlit.guard._base import GuardDeniedError
 from openlit.guard._integration import (
+    GUARDED_METHODS,
     _extract_openai_input,
     _extract_anthropic_input,
     _extract_generic_input,
@@ -85,6 +86,21 @@ def test_generic_input_prompt_string(self):
         assert text == "Generate something"
 
 
+def test_guarded_methods_include_mistral_v1_and_v2_sdk_layouts():
+    """Mistral SDK 1.x and 2.x expose chat under different modules."""
+
+    def has_guarded_method(module_path, class_method):
+        return any(
+            method[0] == module_path and method[1] == class_method
+            for method in GUARDED_METHODS
+        )
+
+    assert has_guarded_method("mistralai.chat", "Chat.complete")
+    assert has_guarded_method("mistralai.chat", "Chat.complete_async")
+    assert has_guarded_method("mistralai.client.chat", "Chat.complete")
+    assert has_guarded_method("mistralai.client.chat", "Chat.complete_async")
+
+
 class TestPreflightIntegration:
     """``_apply_preflight`` runs guards on extracted input kwargs."""
 
```

**File**: `sdk/python/tests/test_mistral_instrumentation.py` (added, +129/-0)
```diff
@@ -0,0 +1,129 @@
+# pylint: disable=protected-access, missing-class-docstring, missing-function-docstring, too-few-public-methods
+"""Tests for Mistral instrumentation setup."""
+
+import sys
+import types
+
+import openlit.instrumentation.mistral as mistral_instrumentation
+from openlit._config import OpenlitConfig
+from openlit.instrumentation.mistral import MistralInstrumentor
+
+EXPECTED_TARGETS = {
+    ("mistralai.chat", "Chat.complete"),
+    ("mistralai.chat", "Chat.stream"),
+    ("mistralai.chat", "Chat.complete_async"),
+    ("mistralai.chat", "Chat.stream_async"),
+    ("mistralai.embeddings", "Embeddings.create"),
+    ("mistralai.embeddings", "Embeddings.create_async"),
+    ("mistralai.client.chat", "Chat.complete"),
+    ("mistralai.client.chat", "Chat.stream"),
+    ("mistralai.client.chat", "Chat.complete_async"),
+    ("mistralai.client.chat", "Chat.stream_async"),
+    ("mistralai.client.embeddings", "Embeddings.create"),
+    ("mistralai.client.embeddings", "Embeddings.create_async"),
+}
+
+
+def _instrument(**kwargs):
+    OpenlitConfig.reset_to_defaults()
+    MistralInstrumentor()._instrument(
+        environment="test",
+        application_name="test",
+        pricing_info={},
+        disable_metrics=True,
+        **kwargs,
+    )
+
+
+def test_mistral_instrumentor_registers_v1_and_v2_sdk_layouts(monkeypatch):
+    """Mistral SDK 1.x and 2.x expose chat and embeddings under different modules."""
+    wrapped_targets = []
+
+    monkeypatch.setattr(
+        mistral_instrumentation.importlib.metadata,
+        "version",
+        lambda package_name: "2.9.4",
+    )
+    monkeypatch.setattr(
+        mistral_instrumentation,
+        "wrap_function_wrapper",
+        lambda module, class_method, wrapper: wrapped_targets.append(
+            (module, class_method)
+        ),
+    )
+
+    _instrument()
+
+    assert set(wrapped_targets) == EXPECTED_TARGETS
+
+
+def test_mistral_instrumentor_skips_missing_layout_and_wraps_available(monkeypatch):
+    """A missing 1.x module must not abort 2.x wrapping (wrapt 2.x raises)."""
+    wrapped_targets = []
+    v1_modules = {"mistralai.chat", "mistralai.embeddings"}
+
+    def fake_wrap(module, class_method, wrapper):
+        if module in v1_modules:
+            raise ModuleNotFoundError(module)
+        wrapped_targets.append((module, class_method))
+
+    monkeypatch.setattr(
+        mistral_instrumentation.importlib.metadata,
+        "version",
+        lambda package_name: "2.9.4",
+    )
+    monkeypatch.setattr(
+        mistral_instrumentation, "wrap_function_wrapper", fake_wrap
+    )
+
+    _instrument()
+
+    assert set(wrapped_targets) == {
+        target for target in EXPECTED_TARGETS if target[0] not in v1_modules
+    }
+
+
+def test_mistral_instrumentor_binds_v2_chat_complete(monkeypatch):
+    """Wrapping mistralai.client.chat must intercept Chat.complete."""
+    package = types.ModuleType("mistralai")
+    package.__path__ = []
+    client = types.ModuleType("mistralai.client")
+    client.__path__ = []
+    chat = types.ModuleType("mistralai.client.chat")
+
+    class Chat:
+        def complete(self, **kwargs):
+            return kwargs.get("model", "ok")
+
+    chat.Chat = Chat
+    client.chat = chat
+    package.client = client
+
+    added = {
+        "mistralai": package,
+        "mistralai.client": client,
+        "mistralai.client.chat": chat,
+    }
+    original = {name: sys.modules.get(name) for name in added}
+    sys.modules.update(added)
+
+    monkeypatch.setattr(
+        mistral_instrumentation.importlib.metadata,
+        "version",
+        lambda package_name: "2.9.4",
+    )
+    monkeypatch.setattr(
+        mistral_instrumentation, "_CHAT_MODULES", ("mistralai.client.chat",)
+    )
+    monkeypatch.setattr(mistral_instrumentation, "_EMBEDDINGS_MODULES", ())
+
+    try:
+        _instrument()
+        assert Chat().complete(model="mistral-small-latest") == "mistral-small-latest"
+        assert hasattr(Chat.complete, "__wrapped__")
+    finally:
+        for name, previous in original.items():
+            if previous is None:
+                sys.modules.pop(name, None)
+            else:
+                sys.modules[name] = previous
```

---

### Incident Patch 10: `95c22aba` (2026-09-11)
**Commit Message**: fix(client): do not record the vault encryption migration when it did not encrypt (#1523)

**File**: `src/client/src/__tests__/clickhouse/migrations/encrypt-vault-values-migration.test.ts` (modified, +67/-0)
```diff
@@ -60,4 +60,71 @@ describe("EncryptVaultValuesMigration", () => {
 		expect(query).toContain("UPDATE value = 'enc:v1:plain\\\\value\\'secret'");
 		expect(query).toContain("WHERE id = 'secret\\\\1'");
 	});
+
+	it("leaves the migration pending when the vault table cannot be read", async () => {
+		(dataCollector as jest.Mock).mockReset();
+		(dataCollector as jest.Mock).mockResolvedValueOnce({
+			data: undefined,
+			err: "default: Authentication failed: password is incorrect",
+		});
+
+		const result = await EncryptVaultValuesMigration();
+
+		expect(prisma.clickhouseMigrations.create).not.toHaveBeenCalled();
+		expect(result).toEqual({
+			migrationExist: false,
+			queriesRun: false,
+			err: "default: Authentication failed: password is incorrect",
+		});
+	});
+
+	it("leaves the migration pending when a secret fails to encrypt", async () => {
+		(dataCollector as jest.Mock).mockReset();
+		(dataCollector as jest.Mock)
+			.mockResolvedValueOnce({
+				data: [
+					{ id: "secret-1", value: "plaintext-1" },
+					{ id: "secret-2", value: "plaintext-2" },
+				],
+				err: null,
+			})
+			.mockResolvedValueOnce({ err: null })
+			.mockResolvedValueOnce({ err: "TABLE_IS_READ_ONLY" });
+
+		const result = await EncryptVaultValuesMigration();
+
+		expect(prisma.clickhouseMigrations.create).not.toHaveBeenCalled();
+		expect(result).toEqual({
+			migrationExist: false,
+			queriesRun: false,
+			err: "Vault encryption migration: 1 of 2 secrets still hold plaintext, leaving the migration pending",
+		});
+	});
+
+	it("records the migration when the vault holds no rows to encrypt", async () => {
+		(dataCollector as jest.Mock).mockReset();
+		(dataCollector as jest.Mock).mockResolvedValueOnce({ data: [], err: null });
+
+		const result = await EncryptVaultValuesMigration();
+
+		expect(prisma.clickhouseMigrations.create).toHaveBeenCalledTimes(1);
+		expect(result).toEqual({ migrationExist: false, queriesRun: true });
+	});
+
+	it("leaves the migration pending when the vault read is not a row list", async () => {
+		(dataCollector as jest.Mock).mockReset();
+		(dataCollector as jest.Mock).mockResolvedValueOnce({
+			data: undefined,
+			err: null,
+		});
+
+		const result = await EncryptVaultValuesMigration();
+
+		expect(prisma.clickhouseMigrations.create).not.toHaveBeenCalled();
+		expect(result).toEqual({
+			migrationExist: false,
+			queriesRun: false,
+			err: "Vault encryption migration: unexpected vault read result",
+		});
+	});
 });
```

**File**: `src/client/src/clickhouse/migrations/encrypt-vault-values-migration.ts` (modified, +20/-5)
```diff
@@ -48,12 +48,18 @@ export default async function EncryptVaultValuesMigration(
 			dbConfig.id
 		);
 
-		if (readErr || !data || !Array.isArray(data)) {
+		if (readErr) {
 			consoleLog(
-				`Vault encryption migration: no data to migrate or error: ${readErr}`
+				`Vault encryption migration: could not read the vault table: ${readErr}`
 			);
-			await markMigrationComplete(dbConfig.id);
-			return { migrationExist: false, queriesRun: true };
+			return { migrationExist: false, queriesRun: false, err: readErr };
+		}
+
+		if (!data || !Array.isArray(data)) {
+			const unexpectedRead =
+				"Vault encryption migration: unexpected vault read result";
+			consoleLog(unexpectedRead);
+			return { migrationExist: false, queriesRun: false, err: unexpectedRead };
 		}
 
 		const plaintextSecrets = (data as any[]).filter(
@@ -66,6 +72,8 @@ export default async function EncryptVaultValuesMigration(
 			return { migrationExist: false, queriesRun: true };
 		}
 
+		let failedCount = 0;
+
 		for (const secret of plaintextSecrets) {
 			const encrypted = escapeClickHouseString(encryptValue(secret.value));
 			const secretId = escapeClickHouseString(secret.id);
@@ -82,12 +90,19 @@ export default async function EncryptVaultValuesMigration(
 			);
 
 			if (updateErr) {
+				failedCount += 1;
 				consoleLog(
 					`Vault encryption migration: failed to encrypt secret ${secret.id}: ${updateErr}`
 				);
 			}
 		}
 
+		if (failedCount > 0) {
+			const pendingErr = `Vault encryption migration: ${failedCount} of ${plaintextSecrets.length} secrets still hold plaintext, leaving the migration pending`;
+			consoleLog(pendingErr);
+			return { migrationExist: false, queriesRun: false, err: pendingErr };
+		}
+
 		consoleLog(
 			`Vault encryption migration: encrypted ${plaintextSecrets.length} secrets`
 		);
@@ -97,7 +112,7 @@ export default async function EncryptVaultValuesMigration(
 		return { migrationExist: false, queriesRun: true };
 	} catch (migrationError) {
 		consoleLog(`Vault encryption migration error: ${migrationError}`);
-		return { migrationExist: false, queriesRun: false };
+		return { migrationExist: false, queriesRun: false, err: migrationError };
 	}
 }
 
```

---

### Incident Patch 11: `1783f61d` (2026-09-11)
**Commit Message**: fix: fail fast when clickhouse migrations fail (#1522)

**File**: `src/client/src/__tests__/clickhouse/migrations/create-custom-dashboards-migration.test.ts` (added, +82/-0)
```diff
@@ -0,0 +1,82 @@
+describe("custom dashboard migration", () => {
+  it("does not seed dashboards when table creation fails", async () => {
+    jest.resetModules();
+    const mockHelper = jest.fn().mockResolvedValue({
+      migrationExist: false,
+      queriesRun: false,
+    });
+    const mockTableCollector = jest.fn().mockResolvedValue({
+      data: [
+        { name: "openlit_folder" },
+        { name: "openlit_board" },
+        { name: "openlit_widget" },
+        { name: "openlit_board_widget" },
+      ],
+    });
+    const mockSeed = jest.fn();
+    jest.doMock("@/clickhouse/migrations/migration-helper", () => ({
+      __esModule: true,
+      default: mockHelper,
+    }));
+    jest.doMock("@/clickhouse/seed/dashboards", () => ({
+      __esModule: true,
+      default: mockSeed,
+    }));
+    jest.doMock("@/lib/platform/common", () => ({
+      __esModule: true,
+      intelligenceDataCollector: mockTableCollector,
+    }));
+
+    const { default: migration } =
+      await import("@/clickhouse/migrations/create-custom-dashboards-migration");
+
+    await expect(migration("db-1")).resolves.toEqual({
+      migrationExist: false,
+      queriesRun: false,
+    });
+    expect(mockSeed).not.toHaveBeenCalled();
+  });
+
+  it("reports missing dashboard tables and does not seed", async () => {
+    jest.resetModules();
+    const mockHelper = jest.fn().mockResolvedValue({
+      migrationExist: false,
+      queriesRun: true,
+    });
+    const mockTableCollector = jest.fn().mockResolvedValue({
+      data: [{ name: "openlit_folder" }, { name: "openlit_board" }],
+    });
+    const mockSeed = jest.fn();
+    jest.doMock("@/clickhouse/migrations/migration-helper", () => ({
+      __esModule: true,
+      default: mockHelper,
+    }));
+    jest.doMock("@/clickhouse/seed/dashboards", () => ({
+      __esModule: true,
+      default: mockSeed,
+    }));
+    jest.doMock("@/lib/platform/common", () => ({
+      __esModule: true,
+      intelligenceDataCollector: mockTableCollector,
+    }));
+
+    const { default: migration } =
+      await import("@/clickhouse/migrations/create-custom-dashboards-migration");
+
+    await expect(migration("db-1")).resolves.toMatchObject({
+      migrationExist: false,
+      queriesRun: true,
+      err: expect.stringContaining(
+        "missing tables: openlit_widget, openlit_board_widget"
+      ),
+    });
+    expect(mockSeed).not.toHaveBeenCalled();
+    expect(mockTableCollector).toHaveBeenCalledWith(
+      expect.objectContaining({
+        query: expect.stringContaining("system.tables"),
+      }),
+      "query",
+      "db-1"
+    );
+  });
+});
```

**File**: `src/client/src/__tests__/clickhouse/migrations/migrations-index.test.ts` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+const mockMigration = jest.fn();
+
+const MIGRATION_MODULES = [
+  "@/clickhouse/migrations/create-prompt-migration",
+  "@/clickhouse/migrations/create-vault-migration",
+  "@/clickhouse/migrations/create-evaluation-migration",
+  "@/clickhouse/migrations/create-evaluation-type-defaults-migration",
+  "@/clickhouse/migrations/create-cron-log-migration",
+  "@/clickhouse/migrations/create-custom-dashboards-migration",
+  "@/clickhouse/migrations/create-openground-migration",
+  "@/clickhouse/migrations/create-rule-engine-migration",
+  "@/clickhouse/migrations/create-controller-migration",
+  "@/clickhouse/migrations/create-chat-migration",
+  "@/clickhouse/migrations/create-agents-summary-migration",
+  "@/clickhouse/migrations/create-agent-versions-migration",
+  "@/clickhouse/migrations/alter-controller-mode-migration",
+  "@/clickhouse/migrations/add-controller-resource-attrs-migration",
+  "@/clickhouse/migrations/add-controller-workload-key-migration",
+  "@/clickhouse/migrations/add-controller-sdk-actions-migration",
+  "@/clickhouse/migrations/add-controller-ttl-migration",
+  "@/clickhouse/migrations/add-controller-cluster-id-migration",
+  "@/clickhouse/migrations/update-controller-actions-ttl-migration",
+  "@/clickhouse/migrations/generalize-controller-desired-states-migration",
+  "@/clickhouse/migrations/add-controller-skipping-indexes-migration",
+  "@/clickhouse/migrations/create-providers-migration",
+  "@/clickhouse/migrations/add-provider-models-cache-prices-migration",
+  "@/clickhouse/migrations/create-provider-metadata-migration",
+  "@/clickhouse/migrations/drop-legacy-openground-tables-migration",
+  "@/clickhouse/migrations/seed-orcarouter-provider-migration",
+  "@/clickhouse/migrations/encrypt-vault-values-migration",
+  "@/clickhouse/migrations/add-chat-conversation-type-migration",
+  "@/clickhouse/migrations/add-chat-message-model-attribution-migration",
+  "@/clickhouse/migrations/create-trace-analysis-migration",
+  "@/clickhouse/migrations/create-otter-runs-migration",
+  "@/clickhouse/migrations/add-agents-summary-skip-indexes-migration",
+  "@/clickhouse/migrations/optimize-agent-tables-storage-migration",
+  "@/clickhouse/migrations/add-coding-agent-summary-fields-migration",
+  "@/clickhouse/migrations/create-coding-agents-audit-migration",
+  "@/clickhouse/migrations/add-coding-agent-loc-summary-fields-migration",
+  "@/clickhouse/migrations/create-telemetry-rollups-migration",
+  "@/clickhouse/migrations/alter-telemetry-rollups-dimensions-migration",
+  "@/clickhouse/migrations/drop-vcs-migration",
+];
+
+describe("ClickHouse migration orchestration", () => {
+  beforeEach(() => {
+    jest.resetModules();
+    mockMigration.mockReset();
+    for (const moduleName of MIGRATION_MODULES) {
+      jest.doMock(moduleName, () => ({
+        __esModule: true,
+        default: mockMigration,
+      }));
+    }
+  });
+
+  it("rejects when a migration reports partially failed queries", async () => {
+    mockMigration.mockResolvedValue({ migrationExist: true });
+    mockMigration.mockResolvedValueOnce({
+      migrationExist: false,
+      queriesRun: false,
+    });
+
+    const { default: migrations } = await import("@/clickhouse/migrations");
+
+    await expect(migrations("db-1")).rejects.toThrow(
+      'ClickHouse migration "create-prompt" failed',
+    );
+    // All independent creates may already be in flight, but dependent
+    // groups must not start after the failed group completes.
+    expect(mockMigration).toHaveBeenCalledTimes(12);
+  });
+
+  it("rejects when a migration returns no result", async () => {
+    let callCount = 0;
+    mockMigration.mockImplementation(async () => {
+      callCount += 1;
+      // Group 1 is 12 parallel creates; the first sequential migration is
+      // add-controller-cluster-id's predecessor, alter-controller-mode.
+      if (callCount === 13) return undefined;
+      return { migrationExist: true };
+    });
+
+    const { default: migrations } = await import("@/clickhouse/migrations");
+
+    await expect(migrations("db-1")).rejects.toThrow(
+      'ClickHouse migration "alter-controller-mode" failed: the migration did not report successful completion',
+    );
+    expect(mockMigration).toHaveBeenCalledTimes(13);
+  });
+
+  it("rejects when the OrcaRouter seed fails and does not continue", async () => {
+    let callCount = 0;
+    mockMigration.mockImplementation(async () => {
+      callCount += 1;
+      // 12 independent creates + 9 controller schema steps + create-providers
+      // + cache-prices + 2 parallel provider-group migrations + seed.
+      if (callCount === 26) return { err: "seed failed" };
+      return { migrationExist: true };
+    });
+
+    const { default: migrations } = await import("@/clickhouse/migrations");
+
+    await expect(migrations("db-1")).rejects.toThrow(
+      'ClickHouse migration "seed-orcarouter-provider" failed: seed failed',
+    );
+    expect(mockMigration)
```

**File**: `src/client/src/clickhouse/migrations/add-controller-cluster-id-migration.ts` (modified, +16/-7)
```diff
@@ -1,15 +1,24 @@
-import { dataCollector } from "@/lib/platform/common";
+import {
+	CONTROLLER_ACTIONS_TABLE,
+	CONTROLLER_INSTANCES_TABLE,
+	CONTROLLER_SERVICES_TABLE,
+} from "@/lib/platform/controller/table-details";
+import migrationHelper from "./migration-helper";
+
+const MIGRATION_ID = "add-controller-cluster-id";
 
 export default async function AddControllerClusterIdMigration(
 	databaseConfigId?: string
 ) {
 	const queries = [
-		`ALTER TABLE openlit_controller_services ADD COLUMN IF NOT EXISTS cluster_id String DEFAULT 'default'`,
-		`ALTER TABLE openlit_controller_instances ADD COLUMN IF NOT EXISTS cluster_id String DEFAULT 'default'`,
-		`ALTER TABLE openlit_controller_actions ADD COLUMN IF NOT EXISTS cluster_id String DEFAULT 'default'`,
+		`ALTER TABLE ${CONTROLLER_SERVICES_TABLE} ADD COLUMN IF NOT EXISTS cluster_id String DEFAULT 'default';`,
+		`ALTER TABLE ${CONTROLLER_INSTANCES_TABLE} ADD COLUMN IF NOT EXISTS cluster_id String DEFAULT 'default';`,
+		`ALTER TABLE ${CONTROLLER_ACTIONS_TABLE} ADD COLUMN IF NOT EXISTS cluster_id String DEFAULT 'default';`,
 	];
 
-	for (const query of queries) {
-		await dataCollector({ query }, "query", databaseConfigId);
-	}
+	return migrationHelper({
+		clickhouseMigrationId: MIGRATION_ID,
+		databaseConfigId,
+		queries,
+	});
 }
```

**File**: `src/client/src/clickhouse/migrations/create-custom-dashboards-migration.ts` (modified, +72/-2)
```diff
@@ -1,5 +1,6 @@
 import migrationHelper from "./migration-helper";
 import CreateCustomDashboardsSeed from "../seed/dashboards";
+import { intelligenceDataCollector } from "@/lib/platform/common";
 
 const MIGRATION_ID = "create-custom-dashboards-table";
 
@@ -8,6 +9,50 @@ const CUSTOM_DASHBOARDS_BOARDS_TABLE = "openlit_board";
 const CUSTOM_DASHBOARDS_FOLDERS_TABLE = "openlit_folder";
 const CUSTOM_DASHBOARDS_WIDGETS_TABLE = "openlit_widget";
 const CUSTOM_DASHBOARDS_BOARD_WIDGETS_TABLE = "openlit_board_widget";
+const EXPECTED_CUSTOM_DASHBOARD_TABLES = [
+  CUSTOM_DASHBOARDS_FOLDERS_TABLE,
+  CUSTOM_DASHBOARDS_BOARDS_TABLE,
+  CUSTOM_DASHBOARDS_WIDGETS_TABLE,
+  CUSTOM_DASHBOARDS_BOARD_WIDGETS_TABLE,
+];
+
+async function verifyCustomDashboardTables(databaseConfigId?: string) {
+  // `system.tables` has a stable `name` column. `SHOW TABLES` JSONEachRow
+  // shapes have varied across ClickHouse versions; a parse miss here would
+  // fail this group-1 migration and skip every later schema migration.
+  const quotedNames = EXPECTED_CUSTOM_DASHBOARD_TABLES.map(
+    (tableName) => `'${tableName}'`
+  ).join(", ");
+  const { data, err } = await intelligenceDataCollector(
+    {
+      query: `
+        SELECT name
+        FROM system.tables
+        WHERE database = currentDatabase()
+          AND name IN (${quotedNames})
+      `,
+    },
+    "query",
+    databaseConfigId
+  );
+  if (err) return { err };
+
+  const existingTables = new Set(
+    (Array.isArray(data) ? data : [])
+      .map((row) => {
+        if (typeof row === "string") return row;
+        if (!row || typeof row !== "object") return "";
+        const tableRow = row as { name?: unknown; table?: unknown };
+        return String(tableRow.name ?? tableRow.table ?? "");
+      })
+      .filter(Boolean)
+  );
+  const missingTables = EXPECTED_CUSTOM_DASHBOARD_TABLES.filter(
+    (tableName) => !existingTables.has(tableName)
+  );
+
+  return { missingTables };
+}
 
 export default async function CreateCustomDashboardsMigration(databaseConfigId?: string) {
   const queries = [
@@ -95,15 +140,40 @@ export default async function CreateCustomDashboardsMigration(databaseConfigId?:
       PRIMARY KEY id
     ) ENGINE = MergeTree()
     ORDER BY (id, board_id, widget_id, created_at);
-    `
+    `,
   ];
 
-  const { migrationExist, queriesRun } = await migrationHelper({
+  const { migrationExist, queriesRun, err: migrationErr } = await migrationHelper({
     clickhouseMigrationId: MIGRATION_ID,
     databaseConfigId,
     queries,
   });
 
+  const tableVerification = await verifyCustomDashboardTables(databaseConfigId);
+  if (tableVerification.err) {
+    const errorMessage = migrationErr
+      ? `ClickHouse migration failed: ${String(migrationErr)}; table verification also failed: ${String(tableVerification.err)}`
+      : `ClickHouse dashboard table verification failed: ${String(tableVerification.err)}`;
+    console.error(errorMessage);
+    return { migrationExist, queriesRun, err: errorMessage };
+  }
+
+  if (tableVerification.missingTables?.length) {
+    const errorMessage = `${migrationErr ? `ClickHouse migration failed: ${String(migrationErr)}; ` : ""}ClickHouse dashboard table verification failed; missing tables: ${tableVerification.missingTables.join(", ")}`;
+    console.error(errorMessage);
+    return { migrationExist, queriesRun, err: errorMessage };
+  }
+
+  // Do not seed dashboards when table creation failed. The migration helper
+  // deliberately leaves failed migrations unrecorded so a later boot can
+  // retry them, but the seed path needs the same failure boundary; otherwise
+  // startup can report success while dashboard inserts hit missing tables.
+  if (!migrationExist && !queriesRun) {
+    return migrationErr
+      ? { migrationExist, queriesRun, err: migrationErr }
+      : { migrationExist, queriesRun };
+  }
+
   // Always run the seed -- it is idempotent per-title via
   // `boardExistsByTitle` and exists precisely so that dashboards
   // added to `SEEDED_DASHBOARDS` after a stack's first boot still
```

**File**: `src/client/src/clickhouse/migrations/index.ts` (modified, +70/-39)
```diff
@@ -38,77 +38,108 @@ import SeedOrcaRouterProviderMigration from "./seed-orcarouter-provider-migratio
 import CreateTelemetryRollupsMigration from "./create-telemetry-rollups-migration";
 import AlterTelemetryRollupsDimensionsMigration from "./alter-telemetry-rollups-dimensions-migration";
 
+type MigrationResult = {
+	migrationExist?: boolean;
+	queriesRun?: boolean;
+	err?: unknown;
+	data?: unknown;
+};
+
+function migrationSucceeded(result: unknown): result is MigrationResult {
+	if (!result || typeof result !== "object") return false;
+
+	const migrationResult = result as MigrationResult;
+	if (migrationResult.err) return false;
+	if (migrationResult.migrationExist === true) return true;
+	if ("queriesRun" in migrationResult) {
+		return migrationResult.queriesRun === true;
+	}
+
+	// A few legacy migrations return `{ data: ... }` instead of the
+	// migrationHelper result shape. Keep accepting that successful contract,
+	// while rejecting missing or unrecognised results.
+	return "data" in migrationResult;
+}
+
+async function runMigration(name: string, migration: () => Promise<unknown>): Promise<MigrationResult> {
+	const result = await migration();
+	if (migrationSucceeded(result)) return result;
+
+	const details = result && typeof result === "object" && "err" in result ? String((result as MigrationResult).err) : "the migration did not report successful completion";
+	throw new Error(`ClickHouse migration "${name}" failed: ${details}`);
+}
+
 export default async function migrations(databaseConfigId?: string) {
 	// Group 1: Independent table creations (safe to parallel)
 	await Promise.all([
-		CreatePromptMigration(databaseConfigId),
-		CreateVaultMigration(databaseConfigId),
-		CreateEvaluationMigration(databaseConfigId),
-		CreateEvaluationTypeDefaultsMigration(databaseConfigId),
-		CreateCronLogMigration(databaseConfigId),
-		CreateCustomDashboardsMigration(databaseConfigId),
-		CreateOpengroundMigration(databaseConfigId),
-		CreateRuleEngineMigration(databaseConfigId),
-		CreateControllerMigration(databaseConfigId),
-		CreateChatMigration(databaseConfigId),
-		CreateAgentsSummaryMigration(databaseConfigId),
-		CreateAgentVersionsMigration(databaseConfigId),
+		runMigration("create-prompt", () => CreatePromptMigration(databaseConfigId)),
+		runMigration("create-vault", () => CreateVaultMigration(databaseConfigId)),
+		runMigration("create-evaluation", () => CreateEvaluationMigration(databaseConfigId)),
+		runMigration("create-evaluation-type-defaults", () => CreateEvaluationTypeDefaultsMigration(databaseConfigId)),
+		runMigration("create-cron-log", () => CreateCronLogMigration(databaseConfigId)),
+		runMigration("create-custom-dashboards", () => CreateCustomDashboardsMigration(databaseConfigId)),
+		runMigration("create-openground", () => CreateOpengroundMigration(databaseConfigId)),
+		runMigration("create-rule-engine", () => CreateRuleEngineMigration(databaseConfigId)),
+		runMigration("create-controller", () => CreateControllerMigration(databaseConfigId)),
+		runMigration("create-chat", () => CreateChatMigration(databaseConfigId)),
+		runMigration("create-agents-summary", () => CreateAgentsSummaryMigration(databaseConfigId)),
+		runMigration("create-agent-versions", () => CreateAgentVersionsMigration(databaseConfigId)),
 	]);
 
 	// Group 2: Controller schema modifications (must be sequential --
 	// each ALTER/CREATE depends on the previous step completing)
-	await AlterControllerModeMigration(databaseConfigId);
-	await AddControllerResourceAttrsMigration(databaseConfigId);
-	await AddControllerWorkloadKeyMigration(databaseConfigId);
-	await AddControllerSDKActionsMigration(databaseConfigId);
-	await AddControllerTTLMigration(databaseConfigId);
-	await AddControllerClusterIdMigration(databaseConfigId);
-	await UpdateControllerActionsTTLMigration(databaseConfigId);
-	await GeneralizeControllerDesiredStatesMigration(databaseConfigId);
-	await AddControllerSkippingIndexesMigration(databaseConfigId);
+	await runMigration("alter-controller-mode", () => AlterControllerModeMigration(databaseConfigId));
+	await runMigration("add-controller-resource-attrs", () => AddControllerResourceAttrsMigration(databaseConfigId));
+	await runMigration("add-controller-workload-key", () => AddControllerWorkloadKeyMigration(databaseConfigId));
+	await runMigration("add-controller-sdk-actions", () => AddControllerSDKActionsMigration(databaseConfigId));
+	await runMigration("add-controller-ttl", () => AddControllerTTLMigration(databaseConfigId));
+	await runMigration("add-controller-cluster-id", () => AddControllerClusterIdMigration(databaseConfigId));
+	await runMigration("update-controller-actions-ttl", () => UpdateControllerActionsTTLMigration(databaseConfigId));
+	await runMigration("generalize-controller-desired-states", () => GeneralizeControllerDesiredStatesMigration(databaseConfigId));
+	await runMigration("add-controller-skipping-indexes", () => AddControllerSkippingIndexesMigration(databaseConfigId));
 

```

**File**: `src/client/src/clickhouse/migrations/migration-helper.ts` (modified, +5/-1)
```diff
@@ -94,5 +94,9 @@ export default async function migrationHelper({
 		return { migrationExist: false, queriesRun: true };
 	}
 
-	return { migrationExist: false, queriesRun: false };
+	return {
+		migrationExist: false,
+		queriesRun: false,
+		err: queriesRun.find(({ err }) => err)?.err,
+	};
 }
```

---

### Incident Patch 12: `433485c5` (2026-09-11)
**Commit Message**: fix(mistral): end streaming span on early break/close (#1517)

**File**: `sdk/python/src/openlit/instrumentation/mistral/async_mistral.py` (modified, +54/-20)
```diff
@@ -10,6 +10,7 @@
     set_server_address_and_port,
     record_completion_metrics,
     record_embedding_metrics,
+    safe_detach,
 )
 from openlit.instrumentation.mistral.utils import (
     process_chunk,
@@ -149,13 +150,25 @@ def __init__(
             self._tbt = 0
             self._server_address = server_address
             self._server_port = server_port
+            self._streaming_response_processed = False
 
         async def __aenter__(self):
             await self.__wrapped__.__aenter__()
             return self
 
         async def __aexit__(self, exc_type, exc_value, traceback):
-            await self.__wrapped__.__aexit__(exc_type, exc_value, traceback)
+            try:
+                await self.__wrapped__.__aexit__(exc_type, exc_value, traceback)
+            finally:
+                if exc_type:
+                    self._streaming_response_processed = True
+                    handle_exception(self._span, exc_value)
+                    if self._span.is_recording():
+                        self._span.end()
+                else:
+                    # A break before exhaustion never hits StopAsyncIteration,
+                    # so the span would leak without normal-exit finalization.
+                    self._finalize_streaming_span()
 
         def __aiter__(self):
             return self
@@ -170,25 +183,46 @@ async def __anext__(self):
                 process_chunk(self, chunk)
                 return chunk
             except StopAsyncIteration:
-                try:
-                    with self._span:
-                        process_streaming_chat_response(
-                            self,
-                            pricing_info=pricing_info,
-                            environment=environment,
-                            application_name=application_name,
-                            metrics=metrics,
-                            capture_message_content=capture_message_content,
-                            disable_metrics=disable_metrics,
-                            version=version,
-                            event_provider=event_provider,
-                        )
-
-                except Exception as e:
-                    handle_exception(self._span, e)
-
+                self._finalize_streaming_span()
                 raise
 
+        def _finalize_streaming_span(self):
+            """Complete and end the span exactly once.
+
+            Called on stream exhaustion and again from close()/manager exit;
+            the flag keeps the double call a no-op so early exits that never
+            see StopAsyncIteration still export the span instead of leaking it.
+            """
+            if self._streaming_response_processed:
+                return
+            self._streaming_response_processed = True
+            try:
+                with self._span:
+                    process_streaming_chat_response(
+                        self,
+                        pricing_info=pricing_info,
+                        environment=environment,
+                        application_name=application_name,
+                        metrics=metrics,
+                        capture_message_content=capture_message_content,
+                        disable_metrics=disable_metrics,
+                        version=version,
+                        event_provider=event_provider,
+                    )
+
+            except Exception as e:
+                handle_exception(self._span, e)
+
+        async def close(self):
+            """Close the wrapped stream and finalize the span if not ended.
+
+            Mistral's EventStreamAsync exposes ``close()``, not ``aclose()``.
+            """
+            try:
+                await self.__wrapped__.close()
+            finally:
+                self._finalize_streaming_span()
+
     async def wrapper(wrapped, instance, args, kwargs):
         """
         Wraps the GenAI stream function call.
@@ -208,10 +242,10 @@ async def wrapper(wrapped, instance, args, kwargs):
             awaited_wrapped = await wrapped(*args, **kwargs)
         except Exception as e:
             handle_exception(span, e)
-            context_api.detach(token)
+            safe_detach(token)
             span.end()
             raise
-        context_api.detach(token)
+        safe_detach(token)
 
         return TracedAsyncStream(
             awaited_wrapped, span, span_name, kwargs, server_address, server_port
```

**File**: `sdk/python/src/openlit/instrumentation/mistral/mistral.py` (modified, +51/-20)
```diff
@@ -10,6 +10,7 @@
     set_server_address_and_port,
     record_completion_metrics,
     record_embedding_metrics,
+    safe_detach,
 )
 from openlit.instrumentation.mistral.utils import (
     process_chunk,
@@ -149,13 +150,25 @@ def __init__(
             self._tbt = 0
             self._server_address = server_address
             self._server_port = server_port
+            self._streaming_response_processed = False
 
         def __enter__(self):
             self.__wrapped__.__enter__()
             return self
 
         def __exit__(self, exc_type, exc_value, traceback):
-            self.__wrapped__.__exit__(exc_type, exc_value, traceback)
+            try:
+                self.__wrapped__.__exit__(exc_type, exc_value, traceback)
+            finally:
+                if exc_type:
+                    self._streaming_response_processed = True
+                    handle_exception(self._span, exc_value)
+                    if self._span.is_recording():
+                        self._span.end()
+                else:
+                    # A break before exhaustion never hits StopIteration, so
+                    # the span would leak without normal-exit finalization.
+                    self._finalize_streaming_span()
 
         def __iter__(self):
             return self
@@ -170,25 +183,43 @@ def __next__(self):
                 process_chunk(self, chunk)
                 return chunk
             except StopIteration:
-                try:
-                    with self._span:
-                        process_streaming_chat_response(
-                            self,
-                            pricing_info=pricing_info,
-                            environment=environment,
-                            application_name=application_name,
-                            metrics=metrics,
-                            capture_message_content=capture_message_content,
-                            disable_metrics=disable_metrics,
-                            version=version,
-                            event_provider=event_provider,
-                        )
-
-                except Exception as e:
-                    handle_exception(self._span, e)
-
+                self._finalize_streaming_span()
                 raise
 
+        def _finalize_streaming_span(self):
+            """Complete and end the span exactly once.
+
+            Called on stream exhaustion and again from close()/manager exit;
+            the flag keeps the double call a no-op so early exits that never
+            see StopIteration still export the span instead of leaking it.
+            """
+            if self._streaming_response_processed:
+                return
+            self._streaming_response_processed = True
+            try:
+                with self._span:
+                    process_streaming_chat_response(
+                        self,
+                        pricing_info=pricing_info,
+                        environment=environment,
+                        application_name=application_name,
+                        metrics=metrics,
+                        capture_message_content=capture_message_content,
+                        disable_metrics=disable_metrics,
+                        version=version,
+                        event_provider=event_provider,
+                    )
+
+            except Exception as e:
+                handle_exception(self._span, e)
+
+        def close(self):
+            """Close the wrapped stream and finalize the span if not ended."""
+            try:
+                self.__wrapped__.close()
+            finally:
+                self._finalize_streaming_span()
+
     def wrapper(wrapped, instance, args, kwargs):
         """
         Wraps the GenAI stream function call.
@@ -208,10 +239,10 @@ def wrapper(wrapped, instance, args, kwargs):
             awaited_wrapped = wrapped(*args, **kwargs)
         except Exception as e:
             handle_exception(span, e)
-            context_api.detach(token)
+            safe_detach(token)
             span.end()
             raise
-        context_api.detach(token)
+        safe_detach(token)
 
         return TracedSyncStream(
             awaited_wrapped, span, span_name, kwargs, server_address, server_port
```

**File**: `sdk/python/tests/test_mistral_stream_span_lifecycle.py` (added, +265/-0)
```diff
@@ -0,0 +1,265 @@
+# pylint: disable=protected-access, duplicate-code, missing-function-docstring
+"""Regression tests: the Mistral streaming wrappers must end their span on
+every exit path.
+
+`TracedSyncStream.__exit__`/`TracedAsyncStream.__aexit__` merely forwarded to
+the wrapped stream and there was no `close()`, so the span was ended only
+inside the `except StopIteration`/`StopAsyncIteration` handler. A caller that
+`break`s out of `with … as stream:` before the stream is exhausted, or calls
+`stream.close()` early, never hit that handler, so the span stayed recording
+forever and was never exported — the whole call (span, cost, tokens) was
+lost. This is the Mistral instance of the early-close streaming-span leak
+fixed for Anthropic in #1461 and Groq in #1516 (distinct from the async
+postflight bug #1495/#1496).
+
+These tests drive the real `stream`/`async_stream` wrapper factories with a
+synthetic Mistral-shaped event stream and assert the span ends exactly once,
+carrying token-usage attributes, on each exit path.
+"""
+
+import time
+
+import pytest
+from opentelemetry import trace as trace_api, context as context_api
+from opentelemetry.trace import StatusCode
+from opentelemetry.sdk.trace import TracerProvider
+from opentelemetry.sdk.trace.export import SimpleSpanProcessor
+from opentelemetry.sdk.trace.export.in_memory_span_exporter import (
+    InMemorySpanExporter,
+)
+
+from openlit._config import OpenlitConfig
+from openlit.instrumentation.mistral import mistral as sync_mod
+from openlit.instrumentation.mistral import async_mistral as async_mod
+from openlit.semcov import SemanticConvention
+
+REQUEST_KWARGS = {
+    "model": "mistral-small-latest",
+    "messages": [{"role": "user", "content": "Monitor LLM Applications"}],
+}
+
+# Two Mistral-shaped events: a content delta, then a final event with usage.
+CHUNKS = [
+    {"data": {"choices": [{"delta": {"content": "partial"}, "finish_reason": None}]}},
+    {
+        "data": {
+            "id": "cmpl-1",
+            "model": "mistral-small-latest",
+            "choices": [{"delta": {"content": " answer"}, "finish_reason": "stop"}],
+            "usage": {"prompt_tokens": 10, "completion_tokens": 5},
+        }
+    },
+]
+
+
+def _tracer_with_exporter():
+    OpenlitConfig.reset_to_defaults()
+    exporter = InMemorySpanExporter()
+    provider = TracerProvider()
+    provider.add_span_processor(SimpleSpanProcessor(exporter))
+    return provider.get_tracer(__name__), exporter
+
+
+def _factory(tracer, *, is_async):
+    mod = async_mod if is_async else sync_mod
+    make = mod.async_stream if is_async else mod.stream
+    return make(
+        version="test",
+        environment="test",
+        application_name="test",
+        tracer=tracer,
+        pricing_info={},
+        capture_message_content=True,
+        metrics=None,
+        disable_metrics=True,
+        event_provider=None,
+    )
+
+
+class FakeSyncStream:
+    """Sync context-manager stream shaped like mistral's event stream."""
+
+    def __init__(self):
+        self._it = iter(CHUNKS)
+        self.closed = False
+
+    def __enter__(self):
+        return self
+
+    def __exit__(self, *exc):
+        return False
+
+    def __iter__(self):
+        return self
+
+    def __next__(self):
+        return next(self._it)
+
+    def close(self):
+        self.closed = True
+
+
+class FakeAsyncStream:
+    """Async context-manager stream shaped like mistral's event stream."""
+
+    def __init__(self):
+        self._it = iter(CHUNKS)
+        self.closed = False
+
+    async def __aenter__(self):
+        return self
+
+    async def __aexit__(self, *exc):
+        return False
+
+    def __aiter__(self):
+        return self
+
+    async def __anext__(self):
+        try:
+            return next(self._it)
+        except StopIteration:
+            raise StopAsyncIteration from None
+
+    async def close(self):
+        self.closed = True
+
+
+async def _acreate(*_a, **_k):
+    """Async stand-in for mistral's chat.stream_async (awaitable)."""
+    return FakeAsyncStream()
+
+
+def _assert_one_span_with_tokens(exporter, *, input_tokens, output_tokens):
+    spans = exporter.get_finished_spans()
+    assert len(spans) == 1, "expected exactly one exported span"
+    attrs = spans[0].attributes
+    assert attrs[SemanticConvention.GEN_AI_USAGE_INPUT_TOKENS] == input_tokens
+    assert attrs[SemanticConvention.GEN_AI_USAGE_OUTPUT_TOKENS] == output_tokens
+
+
+def _assert_one_error_span(exporter):
+    spans = exporter.get_finished_spans()
+    assert len(spans) == 1, "expected exactly one exported span"
+    assert spans[0].status.status_code == StatusCode.ERROR
+    assert spans[0].attributes[SemanticConvention.ERROR_TYPE] == "RuntimeError"
+
+
+def test_sync_early_break_inside_with_ends_span():
+    tracer, exporter = _tracer_with_exporter()
+    wrapper = _factory(tracer, is_async=False)
+
+    stream = wrapper(lambda *a, **k: FakeSyncStream(), None, (), REQ
```

---

### Incident Patch 13: `864a553b` (2026-09-11)
**Commit Message**: fix(groq): end streaming span on early break/close (#1516)

Co-authored-by: Paco Cartones <[REDACTED_EMAIL]>

**File**: `sdk/python/src/openlit/instrumentation/groq/async_groq.py` (modified, +50/-19)
```diff
@@ -9,6 +9,7 @@
     handle_exception,
     set_server_address_and_port,
     record_completion_metrics,
+    safe_detach,
 )
 from openlit.instrumentation.groq.utils import (
     process_chunk,
@@ -72,13 +73,25 @@ def __init__(
             self._tbt = 0
             self._server_address = server_address
             self._server_port = server_port
+            self._streaming_response_processed = False
 
         async def __aenter__(self):
             await self.__wrapped__.__aenter__()
             return self
 
         async def __aexit__(self, exc_type, exc_value, traceback):
-            await self.__wrapped__.__aexit__(exc_type, exc_value, traceback)
+            try:
+                await self.__wrapped__.__aexit__(exc_type, exc_value, traceback)
+            finally:
+                if exc_type:
+                    self._streaming_response_processed = True
+                    handle_exception(self._span, exc_value)
+                    if self._span.is_recording():
+                        self._span.end()
+                else:
+                    # A break before exhaustion never hits StopAsyncIteration,
+                    # so the span would leak without normal-exit finalization.
+                    self._finalize_streaming_span()
 
         def __aiter__(self):
             return self
@@ -93,24 +106,42 @@ async def __anext__(self):
                 process_chunk(self, chunk)
                 return chunk
             except StopAsyncIteration:
-                try:
-                    with self._span:
-                        process_streaming_chat_response(
-                            self,
-                            pricing_info=pricing_info,
-                            environment=environment,
-                            application_name=application_name,
-                            metrics=metrics,
-                            capture_message_content=capture_message_content,
-                            disable_metrics=disable_metrics,
-                            version=version,
-                            event_provider=event_provider,
-                        )
+                self._finalize_streaming_span()
+                raise
 
-                except Exception as e:
-                    handle_exception(self._span, e)
+        def _finalize_streaming_span(self):
+            """Complete and end the span exactly once.
 
-                raise
+            Called on stream exhaustion and again from aclose()/manager exit;
+            the flag keeps the double call a no-op so early exits that never
+            see StopAsyncIteration still export the span instead of leaking it.
+            """
+            if self._streaming_response_processed:
+                return
+            self._streaming_response_processed = True
+            try:
+                with self._span:
+                    process_streaming_chat_response(
+                        self,
+                        pricing_info=pricing_info,
+                        environment=environment,
+                        application_name=application_name,
+                        metrics=metrics,
+                        capture_message_content=capture_message_content,
+                        disable_metrics=disable_metrics,
+                        version=version,
+                        event_provider=event_provider,
+                    )
+
+            except Exception as e:
+                handle_exception(self._span, e)
+
+        async def aclose(self):
+            """Close the wrapped stream and finalize the span if not ended."""
+            try:
+                await self.__wrapped__.aclose()
+            finally:
+                self._finalize_streaming_span()
 
     async def wrapper(wrapped, instance, args, kwargs):
         """
@@ -133,10 +164,10 @@ async def wrapper(wrapped, instance, args, kwargs):
                 awaited_wrapped = await wrapped(*args, **kwargs)
             except Exception as e:
                 handle_exception(span, e)
-                context_api.detach(token)
+                safe_detach(token)
                 span.end()
                 raise
-            context_api.detach(token)
+            safe_detach(token)
             return TracedAsyncStream(
                 awaited_wrapped, span, span_name, kwargs, server_address, server_port
             )
```

**File**: `sdk/python/src/openlit/instrumentation/groq/groq.py` (modified, +50/-19)
```diff
@@ -9,6 +9,7 @@
     handle_exception,
     set_server_address_and_port,
     record_completion_metrics,
+    safe_detach,
 )
 from openlit.instrumentation.groq.utils import (
     process_chunk,
@@ -72,13 +73,25 @@ def __init__(
             self._tbt = 0
             self._server_address = server_address
             self._server_port = server_port
+            self._streaming_response_processed = False
 
         def __enter__(self):
             self.__wrapped__.__enter__()
             return self
 
         def __exit__(self, exc_type, exc_value, traceback):
-            self.__wrapped__.__exit__(exc_type, exc_value, traceback)
+            try:
+                self.__wrapped__.__exit__(exc_type, exc_value, traceback)
+            finally:
+                if exc_type:
+                    self._streaming_response_processed = True
+                    handle_exception(self._span, exc_value)
+                    if self._span.is_recording():
+                        self._span.end()
+                else:
+                    # A break before exhaustion never hits StopIteration, so
+                    # the span would leak without normal-exit finalization.
+                    self._finalize_streaming_span()
 
         def __iter__(self):
             return self
@@ -93,24 +106,42 @@ def __next__(self):
                 process_chunk(self, chunk)
                 return chunk
             except StopIteration:
-                try:
-                    with self._span:
-                        process_streaming_chat_response(
-                            self,
-                            pricing_info=pricing_info,
-                            environment=environment,
-                            application_name=application_name,
-                            metrics=metrics,
-                            capture_message_content=capture_message_content,
-                            disable_metrics=disable_metrics,
-                            version=version,
-                            event_provider=event_provider,
-                        )
+                self._finalize_streaming_span()
+                raise
 
-                except Exception as e:
-                    handle_exception(self._span, e)
+        def _finalize_streaming_span(self):
+            """Complete and end the span exactly once.
 
-                raise
+            Called on stream exhaustion and again from close()/manager exit;
+            the flag keeps the double call a no-op so early exits that never
+            see StopIteration still export the span instead of leaking it.
+            """
+            if self._streaming_response_processed:
+                return
+            self._streaming_response_processed = True
+            try:
+                with self._span:
+                    process_streaming_chat_response(
+                        self,
+                        pricing_info=pricing_info,
+                        environment=environment,
+                        application_name=application_name,
+                        metrics=metrics,
+                        capture_message_content=capture_message_content,
+                        disable_metrics=disable_metrics,
+                        version=version,
+                        event_provider=event_provider,
+                    )
+
+            except Exception as e:
+                handle_exception(self._span, e)
+
+        def close(self):
+            """Close the wrapped stream and finalize the span if not ended."""
+            try:
+                self.__wrapped__.close()
+            finally:
+                self._finalize_streaming_span()
 
     def wrapper(wrapped, instance, args, kwargs):
         """
@@ -133,10 +164,10 @@ def wrapper(wrapped, instance, args, kwargs):
                 awaited_wrapped = wrapped(*args, **kwargs)
             except Exception as e:
                 handle_exception(span, e)
-                context_api.detach(token)
+                safe_detach(token)
                 span.end()
                 raise
-            context_api.detach(token)
+            safe_detach(token)
             return TracedSyncStream(
                 awaited_wrapped, span, span_name, kwargs, server_address, server_port
             )
```

**File**: `sdk/python/tests/test_groq_stream_span_lifecycle.py` (added, +264/-0)
```diff
@@ -0,0 +1,264 @@
+# pylint: disable=protected-access, duplicate-code, missing-function-docstring
+"""Regression tests: the Groq streaming wrappers must end their span on every
+exit path.
+
+`TracedSyncStream.__exit__`/`TracedAsyncStream.__aexit__` merely forwarded to
+the wrapped stream and there was no `close()`/`aclose()`, so the span was
+ended only inside the `except StopIteration`/`StopAsyncIteration` handler.
+A caller that `break`s out of `with … as stream:` before the stream is
+exhausted, or calls `stream.close()` early, never hit that handler, so the
+span stayed recording forever and was never exported — the whole call
+(span, cost, tokens) was lost. This is the Groq instance of the early-close
+streaming-span leak fixed for Anthropic in #1461 and filed for OpenAI in
+#1454/#1455.
+
+These tests drive the real `chat`/`async_chat` wrapper factories with a
+synthetic Groq-shaped stream and assert the span ends exactly once, carrying
+token-usage attributes, on each exit path.
+"""
+
+import time
+
+import pytest
+from opentelemetry import trace as trace_api, context as context_api
+from opentelemetry.trace import StatusCode
+from opentelemetry.sdk.trace import TracerProvider
+from opentelemetry.sdk.trace.export import SimpleSpanProcessor
+from opentelemetry.sdk.trace.export.in_memory_span_exporter import (
+    InMemorySpanExporter,
+)
+
+from openlit._config import OpenlitConfig
+from openlit.instrumentation.groq import groq as sync_mod
+from openlit.instrumentation.groq import async_groq as async_mod
+from openlit.semcov import SemanticConvention
+
+REQUEST_KWARGS = {
+    "model": "llama-3.1-8b-instant",
+    "stream": True,
+    "messages": [{"role": "user", "content": "Monitor LLM Applications"}],
+}
+
+# Two Groq-shaped chunks: a content delta, then a final chunk carrying usage.
+CHUNKS = [
+    {"choices": [{"delta": {"content": "partial"}, "finish_reason": None}]},
+    {
+        "choices": [{"delta": {"content": " answer"}, "finish_reason": "stop"}],
+        "x_groq": {
+            "id": "chatcmpl-1",
+            "model": "llama-3.1-8b-instant",
+            "system_fingerprint": "fp_test",
+            "usage": {"prompt_tokens": 10, "completion_tokens": 5},
+        },
+    },
+]
+
+
+def _tracer_with_exporter():
+    OpenlitConfig.reset_to_defaults()
+    exporter = InMemorySpanExporter()
+    provider = TracerProvider()
+    provider.add_span_processor(SimpleSpanProcessor(exporter))
+    return provider.get_tracer(__name__), exporter
+
+
+def _factory(tracer, *, is_async):
+    mod = async_mod if is_async else sync_mod
+    make = mod.async_chat if is_async else mod.chat
+    return make(
+        version="test",
+        environment="test",
+        application_name="test",
+        tracer=tracer,
+        pricing_info={},
+        capture_message_content=True,
+        metrics=None,
+        disable_metrics=True,
+    )
+
+
+class FakeSyncStream:
+    """Sync context-manager stream shaped like groq's Stream."""
+
+    def __init__(self):
+        self._it = iter(CHUNKS)
+        self.closed = False
+
+    def __enter__(self):
+        return self
+
+    def __exit__(self, *exc):
+        return False
+
+    def __iter__(self):
+        return self
+
+    def __next__(self):
+        return next(self._it)
+
+    def close(self):
+        self.closed = True
+
+
+class FakeAsyncStream:
+    """Async context-manager stream shaped like groq's AsyncStream."""
+
+    def __init__(self):
+        self._it = iter(CHUNKS)
+        self.closed = False
+
+    async def __aenter__(self):
+        return self
+
+    async def __aexit__(self, *exc):
+        return False
+
+    def __aiter__(self):
+        return self
+
+    async def __anext__(self):
+        try:
+            return next(self._it)
+        except StopIteration:
+            raise StopAsyncIteration from None
+
+    async def aclose(self):
+        self.closed = True
+
+
+async def _acreate(*_a, **_k):
+    """Async stand-in for groq's AsyncCompletions.create (awaitable)."""
+    return FakeAsyncStream()
+
+
+def _assert_one_span_with_tokens(exporter):
+    spans = exporter.get_finished_spans()
+    assert len(spans) == 1, "expected exactly one exported span"
+    attrs = spans[0].attributes
+    assert SemanticConvention.GEN_AI_USAGE_INPUT_TOKENS in attrs
+    assert SemanticConvention.GEN_AI_USAGE_OUTPUT_TOKENS in attrs
+
+
+def _assert_one_error_span(exporter):
+    spans = exporter.get_finished_spans()
+    assert len(spans) == 1, "expected exactly one exported span"
+    assert spans[0].status.status_code == StatusCode.ERROR
+    assert spans[0].attributes[SemanticConvention.ERROR_TYPE] == "RuntimeError"
+
+
+def test_sync_early_break_inside_with_ends_span():
+    tracer, exporter = _tracer_with_exporter()
+    wrapper = _factory(tracer, is_async=False)
+
+    stream = wrapper(lambda *a, **k: FakeSyncStream(), None, (), REQUEST_KWARGS)
+    with stream as s:
+        next(s)  # consume one chunk, then leave the block ea
```

---

### Incident Patch 14: `46ada915` (2026-09-11)
**Commit Message**: fix(anthropic): guard non-streaming token counts against None (#1497)

**File**: `sdk/python/src/openlit/instrumentation/anthropic/utils.py` (modified, +4/-4)
```diff
@@ -890,10 +890,10 @@ def process_chat_response(
 
     # Handle token usage including reasoning tokens and cached tokens
     usage = response_dict.get("usage", {})
-    scope._input_tokens = usage.get("input_tokens", 0)
-    scope._output_tokens = usage.get("output_tokens", 0)
-    scope._cache_creation_input_tokens = usage.get("cache_creation_input_tokens", 0)
-    scope._cache_read_input_tokens = usage.get("cache_read_input_tokens", 0)
+    scope._input_tokens = usage.get("input_tokens", 0) or 0
+    scope._output_tokens = usage.get("output_tokens", 0) or 0
+    scope._cache_creation_input_tokens = usage.get("cache_creation_input_tokens", 0) or 0
+    scope._cache_read_input_tokens = usage.get("cache_read_input_tokens", 0) or 0
 
     scope._response_model = response_dict.get("model", "")
     scope._finish_reason = response_dict.get("stop_reason", "")
```

---

### Incident Patch 15: `e9159da7` (2026-09-11)
**Commit Message**: fix(python-sdk): run postflight guards on Mistral async chat calls (#1496)

Co-authored-by: aniketwaghh <[REDACTED_EMAIL]>

**File**: `sdk/python/src/openlit/guard/_integration.py` (modified, +18/-2)
```diff
@@ -24,6 +24,8 @@
 
 from __future__ import annotations
 
+import importlib
+import inspect
 import logging
 from typing import Any, Callable, Dict, List, Optional, Tuple
 
@@ -353,6 +355,21 @@ def _apply_postflight(
     return response
 
 
+def _is_async_method(module_path: str, class_method: str) -> bool:
+    """Return True when the provider method has to be awaited.
+
+    The name is not a reliable signal: Mistral spells its async chat method
+    ``Chat.complete_async``, so a ``"Async" in class_method`` check installs the
+    sync wrapper on a coroutine function and the postflight guards never run.
+    Resolve the attribute instead, unwrapping the instrumentor wrapper that is
+    already installed on it by the time guards are set up.
+    """
+    class_name, method_name = class_method.split(".", 1)
+    module = importlib.import_module(module_path)
+    method = getattr(getattr(module, class_name), method_name)
+    return inspect.iscoroutinefunction(inspect.unwrap(method))
+
+
 def _make_sync_guard_wrapper(
     pipeline: Pipeline,
     extract_input: Extractor,
@@ -403,9 +420,8 @@ def setup_auto_guards(
 
     wrapped_count = 0
     for module_path, class_method, extract_in, extract_out in GUARDED_METHODS:
-        is_async = "Async" in class_method
         try:
-            if is_async:
+            if _is_async_method(module_path, class_method):
                 wrapper = _make_async_guard_wrapper(pipeline, extract_in, extract_out)
             else:
                 wrapper = _make_sync_guard_wrapper(pipeline, extract_in, extract_out)
```

**File**: `sdk/python/tests/test_guard_integration.py` (modified, +81/-0)
```diff
@@ -1,12 +1,18 @@
 """Tests for auto-guard integration (no real LLM calls)."""
 
+import asyncio
+import sys
+import types
+
 import pytest
 
+from openlit.guard import _integration
 from openlit.guard._base import GuardDeniedError
 from openlit.guard._integration import (
     _extract_openai_input,
     _extract_anthropic_input,
     _extract_generic_input,
+    _extract_generic_output,
     _apply_preflight,
     _apply_postflight,
 )
@@ -182,3 +188,78 @@ class Message:
 
         result = _apply_postflight(pipeline, FakeResponse(), _extract_openai_output)
         assert result is not None
+
+
+class TestAsyncMethodDetection:
+    """``setup_auto_guards`` picks the wrapper from the method, not its name."""
+
+    @staticmethod
+    def _fake_provider_module():
+        """Build a provider module that names its coroutine method ``*_async``."""
+
+        # pylint: disable=too-few-public-methods,missing-class-docstring
+        class Message:
+            def __init__(self):
+                self.content = "Reach me at victim@example.com"
+
+        class Choice:
+            def __init__(self):
+                self.message = Message()
+
+        class Response:
+            def __init__(self):
+                self.choices = [Choice()]
+
+        class Chat:
+            def complete(self, **kwargs):
+                """Mistral-style sync chat method."""
+                return Response()
+
+            async def complete_async(self, **kwargs):
+                """Mistral-style async chat method - no ``Async`` in the name."""
+                return Response()
+
+        module = types.ModuleType("fake_provider_sdk")
+        module.Chat = Chat
+        return module
+
+    def test_detects_coroutine_regardless_of_name(self, monkeypatch):
+        """The check resolves the attribute rather than matching on the name."""
+        module = self._fake_provider_module()
+        monkeypatch.setitem(sys.modules, "fake_provider_sdk", module)
+
+        assert _integration._is_async_method("fake_provider_sdk", "Chat.complete_async")
+        assert not _integration._is_async_method("fake_provider_sdk", "Chat.complete")
+
+    def test_underscore_async_method_runs_postflight(self, monkeypatch):
+        """A ``complete_async`` coroutine is guarded like its sync twin."""
+        module = self._fake_provider_module()
+        monkeypatch.setitem(sys.modules, "fake_provider_sdk", module)
+        monkeypatch.setattr(
+            _integration,
+            "GUARDED_METHODS",
+            [
+                (
+                    "fake_provider_sdk",
+                    "Chat.complete",
+                    _extract_generic_input,
+                    _extract_generic_output,
+                ),
+                (
+                    "fake_provider_sdk",
+                    "Chat.complete_async",
+                    _extract_generic_input,
+                    _extract_generic_output,
+                ),
+            ],
+        )
+
+        _integration.setup_auto_guards([PII(action="redact")])
+
+        chat = module.Chat()
+        kwargs = {"messages": [{"content": "hello"}]}
+        sync_response = chat.complete(**kwargs)
+        async_response = asyncio.run(chat.complete_async(**kwargs))
+
+        assert "[REDACTED:email]" in sync_response.choices[0].message.content
+        assert "[REDACTED:email]" in async_response.choices[0].message.content
```

#### Recent Merged Pull Requests:
- **PR #1688** (closed): feat: add a shared alert trigger catalog (@AmanAgarwal041)
- **PR #1685** (2026-10-01): Align README, docs, and package metadata to agent harness engineering (@AmanAgarwal041)
- **PR #1681** (closed): fix(mcp): name FastMCP spans under mcp fastmcp/* instead of the generic names (@daftpunkwav)
- **PR #1678** (2026-09-29): docs(sdk/typescript): fix broken docs.openlit.io links in README (@drgg)
- **PR #1677** (2026-10-01): feat(client): refresh auth screen, session-aware error pages, and founder call card (@AmanAgarwal041)
- **PR #1676** (closed): build(deps): update langchain-core requirement from >=1.5.0 to >=1.6.5 in /sdk/python/tests (@dependabot[bot])
- **PR #1674** (closed): build(deps): update langchain requirement from <2.0.0,>=1.3.14 to >=1.4.2,<2.0.0 in /sdk/python/tests (@dependabot[bot])
- **PR #1672** (2026-09-28): docs: remove dead Mintlify nav entries for missing pages (@aniketkrs)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
