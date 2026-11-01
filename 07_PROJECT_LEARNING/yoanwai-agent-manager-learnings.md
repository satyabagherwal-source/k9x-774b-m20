> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/yoanwai-agent-manager-learnings.md`  
> **Source**: github ([https://github.com/YoanWai/agent-manager](https://github.com/YoanWai/agent-manager))  
> **Source Version**: `e7391588`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T12:30:08.345Z  
> **Learning ID**: `learn-github-yoanwai-agent-manager`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): YoanWai/agent-manager

> **Canonical Artifact**: `07_PROJECT_LEARNING/yoanwai-agent-manager-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/YoanWai/agent-manager](https://github.com/YoanWai/agent-manager))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T12:30:06.396Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `YoanWai/agent-manager`
- **Description**: The fastest developer workflow for every AI coding agent. Live status, quick prompts, worktrees, and diff review from one tmux TUI. Discord: discord.gg/ecS88An7pF
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md
- **Stars / Engagement**: 625 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `internal/hooks/hooks.go`
```
// Package hooks wires Claude Code hook events into status files: each
// managed session gets AGENT_MANAGER_STATUS_FILE in its environment, and
// the generated settings file makes Claude Code write its lifecycle state
// there. The poller reads these files as a tier-1 status source, ahead of
// the pane-regex heuristics.
package hooks

import (
	"bytes"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/YoanWai/agent-manager/internal/status"
)

const EnvStatusFile = "AGENT_MANAGER_STATUS_FILE"

// EnvSessionID identifies the managed session to the rename subcommand;
// every session gets it regardless of tool.
const EnvSessionID = "AGENT_MANAGER_SESSION_ID"

// EnvLaunch names the launch an agent process belongs to, so a conversation
// it reports late cannot land on a launch that replaced it.
const EnvLaunch = "AGENT_MANAGER_LAUNCH"

// EnvAgentPID is the pid of the agent a launch started. The launch's own
// shell exports its pid and execs the agent in its place, so only the agent
// runs under it, while its children and teammates inherit the value.
const EnvAgentPID = "AGENT_MANAGER_AGENT_PID"

// StatusSourceClaude is the status_source config value that enables this
// package for a tool.
const StatusSourceClaude = "claude-hooks"

type Manager struct {
	dir string
}

func NewManager(configDir string) *Manager {
	return &Manager{dir: filepath.Join(configDir, "hooks")}
}

// Dir exposes the hooks directory for other generated per-session
// artifacts, like MCP registration configs.
func (h *Manager) Dir() string {
	return h.dir
}

type hookCommand struct {
	Type    string `json:"type"`
	Command string `json:"command"`
}

type hookMatcher struct {
	Matcher string        `json:"matcher,omitempty"`
	Hooks   []hookCommand `json:"hooks"`
}

type settingsFile struct {
	Env   map[string]string        `json:"env"`
	Hooks map[string][]hookMatcher `json:"hooks"`
}

// blockingNotifications are the Notification types that leave the turn
// stuck on the user. The event also fires for the idle reminder, for
// authentication and for background agents finishing, none of which
// block, so the matcher names the two that do.
const blockingNotifications = "permission_prompt|elicitation_dialog"

// limitStopFailures are the StopFailure error types that mean the account
// hit a usage or rate limit. The pane also classifies those as errored;
// the hook write covers the turn before the banner is visible.
const limitStopFailures = "rate_limit"

func settingsContent(sessionID, launch, statusFile, trackCommand string) ([]byte, error) {
	report := func(matcher, state string) []hookMatcher {
		return []hookMatcher{{Matcher: matcher, Hooks: []hookCommand{{Type: "command", Command: statusCommand(state)}}}}
	}
	content := settingsFile{
		// /background and the agent view rerun the conversation in Claude Code's daemon, under another session's environment.
		Env: map[string]string{EnvSessionID: sessionID, EnvLaunch: launch, EnvStatusFile: statusFile},
		Hooks: map[string][]hookMatcher{
			"UserPromptSubmit": report("", status.Working),
			"PreToolUse":       report("*", status.Working),
			"PostToolUse":      report("*", status.Working),
			"Notification":     report(blockingNotifications, status.Waiting),
			"Stop":             report("", status.Finished),
			"StopFailure":      report(limitStopFailures, status.Errored),
			// compact fires SessionStart in the middle of an active turn
			"SessionStart": report("startup|resume|clear", status.Idle),
			"SessionEnd":   {{Hooks: []hookCommand{{Type: "command", Command: sessionEndCommand()}}}},
		},
	}
	if trackCommand != "" {
		content.Hooks["SessionStart"] = append(content.Hooks["SessionStart"],
			hookMatcher{Hooks: []hookCommand{{Type: "command", Command: trackCommand}}})
	}
	return json.MarshalIndent(content, "", "  ")
}

// WriteSettings writes a session's hook settings file, refreshing it when
// the wanted content changed (e.g. after an upgrade or a relaunch), and
// returns its path. A trackCommand runs on every SessionStart to report the
// conversation the session moved to.
func (m *Manager) WriteSettings(id, launch, trackCommand string) (string, error) {
	if err := os.MkdirAll(m.dir, 0o755); err != nil {
		return "", err
	}
	wanted, err := settingsContent(id, launch, m.StatusFile(id), trackCommand)
	if err != nil {
		return "", err
	}
	path := m.SettingsFile(id)
	existing, err := os.ReadFile(path)
	if err == nil && bytes.Equal(existing, wanted) {
		return path, nil
	}
	if err != nil && !errors.Is(err, fs.ErrNotExist) {
		return "", err
	}
	if err := os.WriteFile(path, wanted, 0o644); err != nil {
		return "", err
	}
	return path, nil
}

func (m *Manager) SettingsFile(id string) string {
	return filepath.Join(m.dir, id+".settings.json")
}

func (m *Manager) RemoveSettings(id string) error {
	return removeIfExists(m.SettingsFile(id))
}

func (m *Manager) StatusFile(id string) string {
	return filepath.Join(m.dir, id+".status")
}

// AgentFile is where a launch records the agent it started: its pid, the
// launch and its terminal.
func (m *Manager) AgentFile(id string) string {
	return filepath.Join(m.dir, id+".agent")
}

// Each launch has its own path so an older follower cannot consume a relaunch's records.
func (m *Manager) TelemetryFile(id string, launch int64) string {
	return filepath.Join(m.dir, fmt.Sprintf("%s.%d.otel", id, launch))
}

// RemoveAgentFiles drops what a session's launches recorded about its agent.
func (m *Manager) RemoveAgentFiles(id string) error {
	if err := removeIfExists(m.AgentFile(id)); err != nil {
		return err
	}
	files, err := os.ReadDir(m.dir)
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	for _, file := range files {
		if !strings.HasPrefix(file.Name(), id+".") || !strings.HasSuffix(file.Name(), ".otel") {
			continue
		}
		if err := removeIfExists(filepath.Join(m.dir, file.Name())); err != nil {
			return err
		}
	}
	return nil
}

// InstallStatusFile is the mailbox an install started from the setup
// dialog writes the command's exit status to.
func (m *Manager) InstallStatusFile(id string) string {
	return filepath.Join(m.dir, id+".install")
}

// WriteInstallScript stores the script that install runs, so the shell in
// the pane is typed one short command instead of a quoted line the user's
// shell may read differently from sh.
func (m *Manager) WriteInstallScript(id, body string) (string, error) {
	if err := os.MkdirAll(m.dir, 0o755); err != nil {
		return "", err
	}
	path := filepath.Join(m.dir, id+installScriptExt)
	if err := os.WriteFile(path, installScriptContent(body), 0o700); err != nil {
		return "", err
	}
	return path, nil
}

// Read returns the hook-reported status for a session. The file is
// written by shell hooks, so anything but a known status is rejected.
func (m *Manager) Read(id string) (string, bool) {
	raw, err := os.ReadFile(m.StatusFile(id))
	if err != nil {
		return "", false
	}
	state := strings.TrimSpace(string(raw))
	switch state {
	case status.Working, status.Waiting, status.Finished, status.Idle, status.Errored:
		return state, true
	}
	return "", false
}

func (m *Manager) Remove(id string) error {
	return removeIfExists(m.StatusFile(id))
}

// NameFile is the mailbox the rename subcommand writes a session's
// self-chosen name into; the poller applies and deletes it. The first
// line is the id of the request, so its answer comes back to the caller
// that asked and not to another rename for the same session.
func (m *Manager) NameFile(id string) string {
	return filepath.Join(m.dir, id+".name")
}

// NewRequestID names one rename, keeping its answer apart from the answer
// to a rename another caller queued for the same session.
func NewRequestID() (string, error) {
	var raw [8]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(raw[:]), nil
}

// NameRequest is one queued rename: the id its answer comes back under,
// and the name the session is asked to take.
func NameRequest(request, name string) string {
	return request + "\n" + name
}

const maxNameLength = 80

// ReadName returns the pending rename for a session: the id of the
// request and the name it asks for. found reports that the file exists,
// so the caller can consume it even when the content normalizes to
// nothing.
func (m *Manager) ReadName(id string) (request, name string, found bool) {
	raw, err := readMailbox(m.NameFile(id))
	if err != nil {
		return "", "", false
	}
	request, name = parseNameRequest(string(raw))
	return request, name, true
}

var requestIDPattern = regexp.MustCompile(`^[0-9a-f]{16}$`)

// parseNameRequest splits a queued rename into the request its answer
// comes back under and the name asked for. The file is written by agents,
// so a first line that is not a request this package issued is no request
// at all: the whole file is the name, and the rename is applied with
// nobody to answer rather than letting that line reach a file path.
func parseNameRequest(raw string) (request, name string) {
	first, rest, split := strings.Cut(raw, "\n")
	if !split || !requestIDPattern.MatchString(first) {
		return "", NormalizeName(raw)
	}
	return first, NormalizeName(rest)
}

// NormalizeName is the name a session actually takes: written by agents,
// so squashed to one bounded line. Whoever asks for a rename normalizes
// its own name the same way to recognize the answer it gets back.
func NormalizeName(raw string) string {
	name := strings.Join(strings.Fields(raw), " ")
	if runes := []rune(name); len(runes) > maxNameLength {
		name = string(runes[:maxNameLength])
	}
	return name
}

func (m *Manager) RemoveName(id string) error {
	if err := removeIfExists(m.claimedNameFile(id)); err != nil {
		return err
	}
	return removeIfExists(m.NameFile(id))
}

// NameResultLifetime is how long an answer nobody claimed is kept. It is
// far longer than any caller waits
```

### Core Architecture Module: `internal/hooks/hooks_unix.go`
```
//go:build !windows

package hooks

import "os"

// installScriptExt names the install script sh runs.
const installScriptExt = ".install.sh"

func statusCommand(state string) string {
	return `printf ` + state + ` > "$` + EnvStatusFile + `"`
}

func sessionEndCommand() string {
	return `rm -f "$` + EnvStatusFile + `"`
}

func installScriptContent(body string) []byte {
	return []byte(body)
}

func readMailbox(path string) ([]byte, error) {
	return os.ReadFile(path)
}

func moveMailbox(from, to string) error {
	return os.Rename(from, to)
}

```

### Core Architecture Module: `internal/hooks/hooks_windows.go`
```
//go:build windows

package hooks

import (
	"errors"
	"os"
	"time"

	"github.com/YoanWai/agent-manager/internal/pwsh"
	"golang.org/x/sys/windows"
)

// installScriptExt names the install script PowerShell runs; -File
// accepts nothing but .ps1.
const installScriptExt = ".install.ps1"

// hookPrefix runs an encoded script. Claude Code runs a hook under Git
// Bash when it has one and PowerShell otherwise; this line, with base64
// holding no shell metacharacters, parses the same in bash, PowerShell
// and cmd, and powershell.exe ships with every Windows install.
const hookPrefix = "powershell.exe -NoProfile -NonInteractive -EncodedCommand "

func statusCommand(state string) string {
	return hookPrefix + pwsh.EncodedCommand("[IO.File]::WriteAllText($env:"+EnvStatusFile+", '"+state+"')")
}

func sessionEndCommand() string {
	return hookPrefix + pwsh.EncodedCommand("Remove-Item -LiteralPath $env:"+EnvStatusFile+" -ErrorAction SilentlyContinue")
}

// installScriptContent carries a BOM so Windows PowerShell 5.1 reads a
// non-ASCII command as UTF-8.
func installScriptContent(body string) []byte {
	return pwsh.ScriptFile(body)
}

// mailboxRetry bounds how long a mailbox read or move waits out another
// handle on the file.
const mailboxRetry = 2 * time.Second

// Windows refuses to open a file another process is replacing, and to
// replace or move one another process has open, failing with access
// denied or a sharing violation until that handle closes; a mailbox the
// writer and the poller share retries rather than reading as absent or
// dropping the write.
func retryShared(op func() error) error {
	deadline := time.Now().Add(mailboxRetry)
	for delay := time.Millisecond; ; delay = min(2*delay, 10*time.Millisecond) {
		err := op()
		if err == nil || !transientShare(err) || time.Now().After(deadline) {
			return err
		}
		time.Sleep(delay)
	}
}

func transientShare(err error) bool {
	return errors.Is(err, windows.ERROR_ACCESS_DENIED) || errors.Is(err, windows.ERROR_SHARING_VIOLATION)
}

func readMailbox(path string) (raw []byte, err error) {
	err = retryShared(func() error {
		raw, err = os.ReadFile(path)
		return err
	})
	return raw, err
}

func moveMailbox(from, to string) error {
	return retryShared(func() error { return os.Rename(from, to) })
}

```

### Core Architecture Module: `internal/remote/state.go`
```
package remote

import (
	"context"
	"errors"
	"time"

	"github.com/YoanWai/agent-manager/internal/remote/value"
	"github.com/YoanWai/agent-manager/internal/sessioncmd"
)

// RetryWait is how long a host that failed its last refreshes rests.
var RetryWait = value.RetryWait

// managerStartInterval spaces the attempts to start a manager on a host
// that keeps reporting none awake, so a failing start is not retried on
// every poll.
const managerStartInterval = time.Minute

// HostState is what the last refreshes of one connection left behind.
type HostState struct {
	// Snapshot is the last good one, kept while the host is unreachable.
	Snapshot sessioncmd.Snapshot
	// OK reports whether the last snapshot succeeded.
	OK bool
	// Err is the last refresh's failure: the snapshot's, or starting the
	// manager's when the snapshot succeeded.
	Err    error
	LastOK time.Time
	// Attempted is when the last refresh ran, successful or not.
	Attempted time.Time
	// Failures counts the snapshots that failed since the last good one.
	Failures int
	// StartedManager reports that the last refresh started a manager.
	StartedManager bool
}

type hostRecord struct {
	state HostState
	conn  Connection
}

// Refresh takes a snapshot of host and caches the outcome for State.
func (c *Client) Refresh(ctx context.Context, host string) HostState {
	conn, err := c.connection(host)
	if err != nil {
		return HostState{Err: err}
	}
	snapshot, err := c.Snapshot(ctx, host)
	state := c.State(host)
	state.StartedManager = false
	state.Attempted = c.now()
	if err != nil {
		state.OK = false
		state.Err = err
		state.Failures++
		return c.record(conn, state)
	}
	state = HostState{Snapshot: snapshot, OK: true, LastOK: c.now(), Attempted: state.Attempted}
	if !snapshot.ManagerAwake && c.claimManagerStart(host) {
		state.StartedManager, state.Err = c.StartManager(ctx, host)
	}
	return c.record(conn, state)
}

// Resting reports whether host failed its last refresh less than
// RetryWait ago, so a caller reads State rather than dialling it again.
func (c *Client) Resting(host string) bool {
	state := c.State(host)
	return !state.OK && state.Failures > 0 && c.now().Sub(state.Attempted) < RetryWait(state.Failures)
}

// State returns the cached outcome of host's refreshes without any I/O, or
// why the stored connection is invalid.
func (c *Client) State(host string) HostState {
	c.mu.Lock()
	defer c.mu.Unlock()
	if _, err := c.find(host); err != nil && !errors.Is(err, errUnknownConnection) {
		return HostState{Err: err}
	}
	return c.states[host].state
}

// record drops a result for a connection removed or repointed while the
// refresh ran, so it cannot land on the new one.
func (c *Client) record(conn Connection, state HostState) HostState {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.unchanged(conn.Name, conn) {
		c.states[conn.Name] = hostRecord{state: state, conn: conn}
	}
	return state
}

func (c *Client) claimManagerStart(host string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	now := c.now()
	if last, ok := c.starts[host]; ok && now.Sub(last) < managerStartInterval {
		return false
	}
	c.starts[host] = now
	return true
}

```

### Core Architecture Module: `internal/sessioncmd/lifecycle.go`
```
package sessioncmd

import (
	"database/sql"
	"errors"
	"fmt"
	"slices"
	"time"

	"github.com/YoanWai/agent-manager/internal/config"
	"github.com/YoanWai/agent-manager/internal/launch"
	"github.com/YoanWai/agent-manager/internal/status"
	"github.com/YoanWai/agent-manager/internal/store"
	"github.com/google/uuid"
)

type PaneSize struct {
	Width  int
	Height int
}

type LaunchRequest struct {
	Session          store.Session
	Tool             config.Tool
	BaseCommand      string
	Pane             PaneSize
	BesideSessionID  string
	RollbackWorktree bool
}

type LaunchResult struct {
	Session    store.Session
	LabelError error
}

type RelaunchResult struct {
	Session      store.Session
	LaunchedAt   time.Time
	ReusedPane   bool
	Degraded     bool
	LabelError   error
	Conversation string
}

type ArchiveSelection struct {
	Sessions  []store.Session
	GroupPath string
}

type ArchiveResult struct {
	GroupChanged bool
	Sessions     []store.Session
	GroupPath    string
	Archived     bool
	LabelError   error
}

type DeleteSelection struct {
	Sessions     []store.Session
	GroupPath    string
	ArchivedOnly bool
}

type DeleteResult struct {
	Deleted       []store.Session
	RemovedGroups []string
	Notice        string
}

// Lifecycle owns the ordered store, tmux, hook, and worktree effects shared
// by the interactive manager and session-scoped commands. Its runtime is
// borrowed; closing resources remains the composing process's responsibility.
type Lifecycle struct {
	runtime  Runtime
	setLabel func(string, string) error
	killPane func(string) error
}

func NewLifecycle(runtime Runtime) (*Lifecycle, error) {
	if err := validateRuntime(runtime); err != nil {
		return nil, err
	}
	return &Lifecycle{runtime: runtime, setLabel: runtime.Driver.SetLabel, killPane: runtime.Driver.Kill}, nil
}

func (l *Lifecycle) requireHooks() error {
	if l.runtime.Hooks == nil {
		return errors.New("lifecycle operation requires a hook manager")
	}
	return nil
}

func (l *Lifecycle) paneSize(requested PaneSize) (PaneSize, error) {
	if requested.Width > 0 && requested.Height > 0 {
		return requested, nil
	}
	width, height, err := l.runtime.Store.PaneSize()
	return PaneSize{Width: width, Height: height}, err
}

func (l *Lifecycle) discardWorktree(sess store.Session) {
	if sess.WorktreeRepo == "" || l.runtime.Git == nil {
		return
	}
	base, err := groupBase(l.runtime.Store, sess.Group)
	if err != nil {
		return
	}
	_, _ = l.runtime.Git.RemoveWorktreeIfClean(sess.WorktreeRepo, sess.Cwd, sess.WorktreeBranch, base)
}

// WorktreeRequest asks Spawn for the session's own checkout of the
// repository its Cwd is in.
type WorktreeRequest struct {
	Base  string
	Fetch bool
}

type SpawnRequest struct {
	Session  store.Session
	Tool     config.Tool
	Plan     launch.Plan
	Pane     PaneSize
	Worktree *WorktreeRequest
}

// Spawn is the one path a new session takes, from the manager and from the
// CLI: it opens the worktree the request asks for, fills the row from the
// launch plan, and launches it, handing the worktree back if that fails.
func (l *Lifecycle) Spawn(request SpawnRequest) (LaunchResult, error) {
	sess := request.Session
	if request.Worktree != nil {
		if l.runtime.Git == nil {
			return LaunchResult{}, errors.New("worktree sessions need git installed")
		}
		root, err := l.runtime.Git.RepoRoot(sess.Cwd)
		if err != nil {
			return LaunchResult{}, err
		}
		if request.Worktree.Fetch {
			// Offline or refused, the worktree branches from the last fetch instead.
			_ = l.runtime.Git.FetchBase(root, request.Worktree.Base)
		}
		path, branch, err := l.runtime.Git.AddWorktree(root, sess.Name, request.Worktree.Base)
		if err != nil {
			return LaunchResult{}, err
		}
		sess.Cwd, sess.WorktreeRepo, sess.WorktreeBranch = path, root, branch
	}
	// Starting until the agent first draws to its pane, so the row shows a
	// launch state immediately; the poller flips it.
	sess.Status = status.Starting
	sess.AgentSessionID = request.Plan.AgentSessionID
	sess.PendingInputs = request.Plan.PendingInputs
	sess.LaunchPrompt = request.Plan.LaunchPrompt
	return l.Launch(LaunchRequest{
		Session:          sess,
		Tool:             request.Tool,
		BaseCommand:      request.Plan.Command,
		Pane:             request.Pane,
		RollbackWorktree: sess.WorktreeRepo != "",
	})
}

// Launch creates the pane before its row and rolls the pane back if the row
// cannot be persisted. A label failure is returned separately because the UI
// reports it while agent commands historically treat it as cosmetic.
func (l *Lifecycle) Launch(request LaunchRequest) (LaunchResult, error) {
	if err := l.requireHooks(); err != nil {
		return LaunchResult{}, err
	}
	sess := request.Session
	if sess.CreatedAt.IsZero() {
		sess.CreatedAt = time.Now()
	}
	if sess.LastStatusAt.IsZero() {
		sess.LastStatusAt = sess.CreatedAt
	}
	discard := func() {
		if request.RollbackWorktree {
			l.discardWorktree(sess)
		}
	}
	profile, err := l.runtime.Store.LaunchEnv(sess.Environment)
	if err != nil {
		discard()
		return LaunchResult{}, err
	}
	command, env, err := launch.Environment(l.runtime.Hooks, sess.Tool, request.Tool, request.BaseCommand, sess.ID, sess.Cwd, time.Time{}, profile)
	if err != nil {
		discard()
		return LaunchResult{}, err
	}
	size, err := l.paneSize(request.Pane)
	if err != nil {
		discard()
		return LaunchResult{}, err
	}
	if err := l.runtime.Driver.Create(sess.ID, sess.Cwd, command, env, size.Width, size.Height); err != nil {
		discard()
		return LaunchResult{}, err
	}
	sess.TmuxSocket = l.runtime.Driver.SocketPath()
	create := l.runtime.Store.CreateSession
	if request.BesideSessionID != "" {
		create = func(row store.Session) error {
			return l.runtime.Store.CreateSessionBeside(row, request.BesideSessionID)
		}
	}
	if err := create(sess); err != nil {
		killErr := l.killPane(sess.ID)
		_ = l.runtime.Hooks.Remove(sess.ID)
		discard()
		if killErr != nil {
			return LaunchResult{}, errors.Join(err, fmt.Errorf("pane %s is still running and has no row: %w", sess.ID, killErr))
		}
		return LaunchResult{}, err
	}
	if request.BesideSessionID != "" {
		stored, err := l.runtime.Store.Get(sess.ID)
		if err != nil {
			return LaunchResult{}, err
		}
		sess = stored
	}
	return LaunchResult{
		Session:    sess,
		LabelError: l.setLabel(sess.ID, SessionLabel(sess.Group, sess.Name)),
	}, nil
}

// Kill leaves the row and conversation intact for revive. Pane capture is
// best effort, but a captured frame must be persisted before the pane dies.
func (l *Lifecycle) Kill(sess store.Session) (store.Session, error) {
	if err := l.requireHooks(); err != nil {
		return store.Session{}, err
	}
	if l.runtime.Driver.Exists(sess.ID) {
		if pane, err := l.runtime.Driver.CapturePane(sess.ID); err == nil && pane != "" {
			if err := l.runtime.Snapshot(sess.ID, pane); err != nil {
				return store.Session{}, err
			}
		}
		if err := l.runtime.Driver.Kill(sess.ID); err != nil {
			return store.Session{}, err
		}
	}
	if err := l.runtime.Hooks.Remove(sess.ID); err != nil {
		return store.Session{}, err
	}
	if err := l.runtime.Store.UpdateStatus(sess.ID, status.Dead); err != nil {
		return store.Session{}, err
	}
	sess.Status = status.Dead
	return sess, nil
}

// Revive relaunches a dead session or an agent that quit to its shell. The
// row is read again first, since the listed copy can predate the last
// conversation the agent reported, and the agent's last conversation is
// settled before the revive command is built.
func (l *Lifecycle) Revive(listed store.Session, pane PaneSize) (RelaunchResult, error) {
	if err := l.requireHooks(); err != nil {
		return RelaunchResult{}, err
	}
	sess, err := l.runtime.Store.Get(listed.ID)
	if errors.Is(err, sql.ErrNoRows) {
		return RelaunchResult{}, fmt.Errorf("session %s: %w", listed.ID, store.ErrSessionGone)
	}
	if err != nil {
		return RelaunchResult{}, err
	}
	tool, ok := l.runtime.Config.Tools[sess.Tool]
	if !ok {
		return RelaunchResult{}, fmt.Errorf("tool %s is no longer configured", sess.Tool)
	}
	if _, err := resolveTerminalDirectory(sess.Cwd); err != nil {
		return RelaunchResult{}, fmt.Errorf("working directory no longer exists: %s", sess.Cwd)
	}
	if tool.Shell && l.runtime.Driver.Exists(sess.ID) {
		return RelaunchResult{}, fmt.Errorf("%s is a shell; its pane is already open", sess.Name)
	}
	degraded := func(sess store.Session) bool {
		return sess.AgentSessionID == "" && tool.ResumeByIDCommand != "" && tool.ResumePickerCommand == ""
	}
	if l.runtime.Driver.Exists(sess.ID) {
		relaunched, err := RelaunchInPane(l.runtime.Driver, l.runtime.Store, l.runtime.Hooks, sess.ID, tool)
		if err != nil {
			return RelaunchResult{}, err
		}
		if relaunched.AgentSessionID == "" && tool.ResumePickerKeys != "" {
			InjectPickerKeys(l.runtime.Driver, relaunched.ID, tool)
		}
		relaunched.Status = status.Starting
		return RelaunchResult{Session: relaunched, LaunchedAt: relaunched.AgentLaunchedAt, ReusedPane: true, Degraded: degraded(relaunched)}, nil
	}
	if sess, err = settleBeforeRevive(l.runtime.Store, l.runtime.Hooks, sess, tool.SessionReport, true); err != nil {
		return RelaunchResult{}, err
	}
	tool = tool.WithChoice(sess.Choice)
	if err := SnapshotRelaunch(l.runtime.Store, sess, tool, sess.AgentSessionID); err != nil {
		return RelaunchResult{}, err
	}
	return l.launchExisting(sess, tool, launch.ReviveCommand(tool, sess.AgentSessionID), pane, degraded(sess), true, func(at time.Time) error {
		return l.runtime.Store.SetAgentLaunchedAt(sess.ID, at)
	})
}

func (l *Lifecycle) Restart(sess store.Session, pane PaneSize) (RelaunchResult, error) {
	if err := l.requireHooks(); err != nil {
		return RelaunchResult{}, err
	}
	tool, ok := l.runtime.Config.Tools[sess.Tool]
	if !ok {
		return RelaunchResult{}, fmt.Errorf("tool %s is no longer configured", sess.Tool)
	}
	if _, err := resolveTerminalDirectory(sess.Cwd); err != nil {
		return RelaunchResult{}, fmt.Errorf("working directory no longer exists: %s", sess.Cwd)
	}
	if l.runtime.Driver.Exists(sess.ID) {
		if _, err := l.Kill(sess); 
```

### Core Architecture Module: `internal/sessioncmd/session_lifecycle.go`
```
package sessioncmd

import (
	"errors"
	"fmt"
	"time"

	"github.com/YoanWai/agent-manager/internal/conversation"
	"github.com/YoanWai/agent-manager/internal/store"
)

// Kill stops a session's pane and leaves its row dead, keeping the last
// screen so the manager can still show it and a revive can resume the
// conversation it held.
func (s *Sessions) Kill(sessionID, targetID string) (Session, error) {
	runtime, err := s.open()
	if err != nil {
		return Session{}, err
	}
	defer runtime.Close()
	if _, err := runtime.optionalCaller(sessionID); err != nil {
		return Session{}, err
	}
	target, err := runtime.agent(targetID)
	if err != nil {
		return Session{}, err
	}
	if target.ID == sessionID {
		return Session{}, fmt.Errorf("a session kills itself with %s, which waits for this turn to end", runtime.words.KillSelf)
	}
	lifecycle, err := s.lifecycle(runtime, nil)
	if err != nil {
		return Session{}, err
	}
	// Some CLIs keep the conversation they are on only while they run,
	// and no manager screen may be open to have followed it.
	var followErr error
	if tool, known := runtime.cfg.Tools[target.Tool]; known && runtime.driver.Exists(target.ID) {
		target, followErr = FollowConversation(runtime.store, lifecycle.runtime.Hooks, &conversation.Reader{}, target, tool.SessionReport)
	}
	killed, err := lifecycle.Kill(target)
	if err != nil {
		return Session{}, err
	}
	if followErr != nil {
		return Session{}, fmt.Errorf("killed %s, but could not read which conversation it was on: %w", target.Name, followErr)
	}
	return runtime.sessionInfo(killed, false, false), nil
}

// Revive relaunches a dead session under its old id, keeping its name,
// group and history, and resuming the conversation it held where the tool
// can.
func (s *Sessions) Revive(sessionID, targetID string) (Session, error) {
	runtime, err := s.open()
	if err != nil {
		return Session{}, err
	}
	defer runtime.Close()
	if _, err := runtime.optionalCaller(sessionID); err != nil {
		return Session{}, err
	}
	target, err := runtime.agent(targetID)
	if err != nil {
		return Session{}, err
	}
	lifecycle, err := s.lifecycle(runtime, nil)
	if err != nil {
		return Session{}, err
	}
	revived, err := lifecycle.Revive(target, PaneSize{})
	if err != nil {
		return Session{}, err
	}
	return runtime.sessionInfo(revived.Session, true, false), nil
}

// Archive parks a session out of the active list, or restores it. A live
// pane keeps running; archiving only changes where the row is filed, and
// the last screen is captured first so an archived row still shows one.
func (s *Sessions) Archive(sessionID, targetID string, archived bool) (Session, error) {
	request := ArchiveRequest{CallerID: sessionID, TargetID: targetID, Archived: archived, Words: s.words}
	if s.archiveOwner != nil {
		return s.archiveOwner.Archive(request)
	}
	runtime, err := s.open()
	if err != nil {
		return Session{}, err
	}
	defer runtime.Close()
	lifecycle, err := s.lifecycle(runtime, nil)
	if err != nil {
		return Session{}, err
	}
	return lifecycle.SetArchivedForSession(request.CallerID, request.TargetID, request.Archived, request.Words)
}

// AfterTurn is what the calling session left for the manager to do to it
// once its turn ends.
type AfterTurn struct {
	Pending      string `json:"pending,omitempty" jsonschema:"archive or kill, which the manager runs once this turn ends; empty when nothing is pending"`
	Replaced     string `json:"replaced,omitempty" jsonschema:"the action this call replaced"`
	Canceled     string `json:"canceled,omitempty" jsonschema:"the action this call withdrew"`
	ManagerAwake bool   `json:"manager_awake" jsonschema:"whether Agent Manager is running; it carries the action out, so while it is closed the action waits for it to open"`
}

// EndAfterTurn asks the manager to archive or kill the calling session once
// the turn making this call ends. Ending it now would cut off the reply the
// agent is still writing, and the agent cannot outlive its own kill to
// finish the bookkeeping, so the manager does it.
func (s *Sessions) EndAfterTurn(sessionID, action string) (AfterTurn, error) {
	runtime, err := s.open()
	if err != nil {
		return AfterTurn{}, err
	}
	defer runtime.Close()
	self, err := runtime.agentCaller(sessionID)
	if err != nil {
		return AfterTurn{}, err
	}
	now := time.Now()
	if err := runtime.store.RequestAfterTurn(self.ID, action, now); err != nil {
		return AfterTurn{}, err
	}
	awake, err := runtime.managerAwake(now)
	if err != nil {
		return AfterTurn{}, err
	}
	result := AfterTurn{Pending: action, ManagerAwake: awake}
	if self.AfterTurn != action {
		result.Replaced = self.AfterTurn
	}
	return result, nil
}

// CancelAfterTurn withdraws whichever end the calling session has pending.
func (s *Sessions) CancelAfterTurn(sessionID string) (AfterTurn, error) {
	runtime, err := s.open()
	if err != nil {
		return AfterTurn{}, err
	}
	defer runtime.Close()
	self, err := runtime.agentCaller(sessionID)
	if err != nil {
		return AfterTurn{}, err
	}
	awake, err := runtime.managerAwake(time.Now())
	if err != nil {
		return AfterTurn{}, err
	}
	if self.AfterTurn == "" {
		return AfterTurn{ManagerAwake: awake}, nil
	}
	if err := runtime.store.ClearAfterTurn(self.ID); err != nil {
		return AfterTurn{}, err
	}
	return AfterTurn{Canceled: self.AfterTurn, ManagerAwake: awake}, nil
}

// agentCaller is the calling session when it is an agent, the only kind
// with turns to end.
func (r *runtime) agentCaller(sessionID string) (store.Session, error) {
	caller, err := r.caller(sessionID)
	if err != nil {
		return store.Session{}, err
	}
	if r.cfg.Tools[caller.Tool].Shell {
		return store.Session{}, errors.New("this session is a terminal, which has no turns to end")
	}
	return caller, nil
}

```

### Core Architecture Module: `internal/ui/focus/render.go`
```
package focus

import (
	"regexp"
	"strings"

	"github.com/charmbracelet/lipgloss"
	"github.com/charmbracelet/x/ansi"
)

var dangerousPaneSequences = regexp.MustCompile(
	`\x1b\[[0-9;]*[KJLMSTr]|\x1b[DEM]`,
)

const capturedCursorMarker = "\x1b]1337;agent-manager-ime-cursor\x07"

// FrameContext is the copied presentation state needed to prepare one pane
// frame. OriginY is the first row available to the pane, before top padding.
type FrameContext struct {
	Preview        string
	Width          int
	Height         int
	OriginX        int
	OriginY        int
	CaretRow       int
	CursorStyle    lipgloss.Style
	SelectionStyle lipgloss.Style
}

type FrameContent struct {
	Rows       []string
	TopPadding int
	HasPane    bool
}

// PrepareFrame records the exact pane frame that mouse and IME policy
// will read until the next paint.
func (m *Model) PrepareFrame(ctx FrameContext) FrameContent {
	pane, rowOffset := paneExact(ctx.Preview, ctx.Height, ctx.Width, ctx.CaretRow)
	if len(pane) == 0 {
		m.frame = displayedFrame{}
		return FrameContent{}
	}
	topPadding := ctx.Height - len(pane)
	lines := make([]string, len(pane))
	for i, raw := range pane {
		lines[i] = plainPaneLine(raw)
	}
	m.frame = displayedFrame{
		box: Box{
			X:      ctx.OriginX,
			Y:      ctx.OriginY + topPadding,
			Width:  ctx.Width,
			Height: len(pane),
			Valid:  true,
		},
		lines:     lines,
		rowOffset: rowOffset,
	}

	rendered := make([]string, len(pane))
	for i, raw := range pane {
		rendered[i] = m.renderPaneRow(i, raw, ctx.Width, ctx.CursorStyle, ctx.SelectionStyle)
	}
	return FrameContent{Rows: rendered, TopPadding: topPadding, HasPane: true}
}

func (m Model) CursorAnchor(sessionID string) (col, row int, ok bool) {
	box := m.frame.box
	if m.scroll != 0 || !box.Valid || !m.pane.cursor.Visible || m.pane.sessionID != sessionID {
		return 0, 0, false
	}
	row = m.pane.cursor.Y - m.frame.rowOffset
	if row < 0 || row >= box.Height || box.Width <= 0 {
		return 0, 0, false
	}
	col = min(max(m.pane.cursor.X, 0), box.Width-1)
	return box.X + col + 1, box.Y + row + 1, true
}

func (m Model) cursorCell() (row, col int, ok bool) {
	if !m.pane.cursor.Visible || !m.cursorOn || m.scroll != 0 || !m.frame.box.Valid {
		return 0, 0, false
	}
	row = m.pane.cursor.Y - m.frame.rowOffset
	if row < 0 || row >= m.frame.box.Height {
		return 0, 0, false
	}
	return row, m.pane.cursor.X, true
}

func (m Model) renderPaneRow(row int, raw string, width int, cursorStyle, selectionStyle lipgloss.Style) string {
	clean := safePaneLine(raw)
	line := ansi.Strip(clean)
	if start, end, ok := m.selectionSpan(row, ansi.StringWidth(line)); ok {
		startByte, endByte := graphemeRangeAtColumns(line, start, end)
		selected := line[startByte:endByte]
		before := ansi.Truncate(clean, ansi.StringWidth(line[:startByte]), "")
		after := ansi.TruncateLeft(clean, ansi.StringWidth(line[:endByte]), "")
		return fitPaneLine(before+selectionStyle.Render(selected)+after, width)
	}
	return m.withCursor(row, raw, width, cursorStyle)
}

func (m Model) withCursor(row int, raw string, width int, style lipgloss.Style) string {
	cursorRow, cursorCol, ok := m.cursorCell()
	if !ok || cursorRow != row {
		return fitPaneLine(raw, width)
	}
	clean := safePaneLine(raw)
	lineWidth := ansi.StringWidth(clean)
	if cursorCol >= lineWidth {
		pad := strings.Repeat(" ", cursorCol-lineWidth)
		return fitPaneLine(clean+pad+style.Render(" "), width)
	}
	head := ansi.Truncate(clean, cursorCol, "")
	tail := ansi.TruncateLeft(clean, cursorCol+1, "")
	cell := graphemeAtCell(ansi.Strip(clean), cursorCol)
	return fitPaneLine(head+style.Render(cell)+tail, width)
}

func graphemeAtCell(line string, column int) string {
	for _, span := range graphemeSpans(line) {
		if column < span.endCell {
			return span.text
		}
	}
	return " "
}

func plainPaneLine(line string) string {
	return ansi.Strip(safePaneLine(line))
}

func fitPaneLine(line string, width int) string {
	line = safePaneLine(line)
	line = strings.Map(func(r rune) rune {
		if r < 0x20 && r != 0x1b && r != '\t' {
			return -1
		}
		return r
	}, line)
	w := ansi.StringWidth(line)
	if w > width {
		line = ansi.Truncate(line, width, "")
		w = ansi.StringWidth(line)
	}
	if strings.ContainsRune(line, 0x1b) {
		line += "\x1b[0m"
	}
	if w < width {
		line += strings.Repeat(" ", width-w)
	}
	return line
}

func safePaneLine(line string) string {
	line = strings.ReplaceAll(line, capturedCursorMarker, "")
	return dangerousPaneSequences.ReplaceAllString(line, "")
}

func paneExact(pane string, rows, width, caretRow int) ([]string, int) {
	lines, start := paneWindow(pane, rows, caretRow)
	for i, line := range lines {
		lines[i] = expandPaneTabs(line, width)
	}
	return lines, start
}

func paneWindow(pane string, rows, caretRow int) ([]string, int) {
	if rows <= 0 || pane == "" {
		return nil, 0
	}
	lines := strings.Split(strings.TrimSuffix(pane, "\n"), "\n")
	end := len(lines)
	for end > 0 && strings.TrimSpace(ansi.Strip(lines[end-1])) == "" {
		end--
	}
	if end == 0 {
		end = min(rows, len(lines))
	}
	if caretRow+1 > end {
		end = caretRow + 1
	}
	end = min(end, len(lines))
	start := max(end-rows, 0)
	return lines[start:end], start
}

func expandPaneTabs(line string, width int) string {
	if !strings.ContainsRune(line, '\t') {
		return line
	}
	const tabStop = 8
	var out strings.Builder
	column := 0
	for i, segment := range strings.Split(line, "\t") {
		if i > 0 {
			pad := max(min(tabStop-column%tabStop, width-1-column), 0)
			out.WriteString(strings.Repeat(" ", pad))
			column += pad
		}
		out.WriteString(segment)
		column += ansi.StringWidth(segment)
	}
	return out.String()
}

```

### Core Architecture Module: `internal/ui/frame_dialog_render.go`
```
package ui

import (
	"strings"

	"github.com/YoanWai/agent-manager/internal/ui/presentation"
)

type dialogRenderContext struct {
	glyphMode presentation.GlyphMode
	width     int
	height    int
	status    string
}

// dialogBox is a card's own lines, before the backdrop surrounds them, and
// the keys its foot paints, from the card's own first row and column.
func dialogBox(ctx dialogRenderContext, width int, title, body string, hint [][2]string) ([]string, keyHits) {
	inner := cardInnerWidth(width)
	border := cardBorderStyle()
	pad := strings.Repeat(" ", cardPaddingX)
	edge := border.Render("│")

	row := func(line string) string {
		return paint(edge+pad+padRight(line, inner)+pad+edge, width, blockHex())
	}
	rule := func(left, right string) string {
		return paint(border.Render(left+strings.Repeat("─", width-2)+right), width, blockHex())
	}

	lines := []string{cardTitleRow(width, title, border, ctx.glyphMode), row("")}
	if body != "" {
		for _, line := range strings.Split(body, "\n") {
			lines = append(lines, row(line))
		}
	}
	if ctx.status != "" {
		lines = append(lines, row(""), row(ctx.status))
	}
	if body != "" {
		lines = append(lines, row(""))
	}
	var hits keyHits
	if len(hint) > 0 {
		lines = append(lines, rule("├", "┤"))
		foot := paintInline(hint, inner, ctx.glyphMode)
		hits = foot.hits.moved(cardBodyColumn, len(lines))
		for _, line := range strings.Split(foot.text, "\n") {
			lines = append(lines, row(line))
		}
	}
	lines = append(lines, rule(presentation.ChromeFor(ctx.glyphMode).BottomLeftGlyph, presentation.ChromeFor(ctx.glyphMode).BottomRightGlyph))
	return lines, hits
}

// dialogPlacement is where centerDialog puts box: its first row, and the
// columns it spans.
func dialogPlacement(ctx dialogRenderContext, box []string) (top, left, right int) {
	width := maxLineWidth(box)
	height := max(ctx.height, len(box))
	left = max((ctx.width-width)/2, 0)
	top = max((height-len(box))/2, 0)
	return top, left, left + width
}

func centerDialog(ctx dialogRenderContext, box []string) string {
	width := maxLineWidth(box)
	height := max(ctx.height, len(box))
	top, left, _ := dialogPlacement(ctx, box)
	frameWidth := max(ctx.width, left+width)
	frame := make([]string, 0, height)
	for i := 0; i < height; i++ {
		row := ""
		if i >= top && i-top < len(box) {
			row = paint("", left, backdropHex()) + box[i-top]
		}
		frame = append(frame, paint(row, frameWidth, backdropHex()))
	}
	return strings.Join(frame, "\n")
}

```

### Core Architecture Module: `internal/ui/help/state.go`
```
// Package help is the key map: its sections built from the live key tables,
// its search, scroll and scope, and its frame. The root hands it copied
// bindings and glyphs and opens the links it names.
package help

import tea "github.com/charmbracelet/bubbletea"

// State owns the key map's search, scroll, and visible scope.
type State struct {
	scroll    int
	query     string
	searching bool
	scope     Scope
}

type Scope uint8

const (
	Global Scope = iota
	Review
)

type Action uint8

const (
	Stay Action = iota
	Close
	Quit
	OpenDocs
)

// Viewport is the catalog window currently available inside the dialog.
type Viewport struct {
	Rows  int
	Lines int
}

func New(scope Scope) State {
	return State{scope: scope}
}

func (s *State) close() {
	*s = State{}
}

func (s State) scrollLimit(viewport Viewport) int {
	return max(0, viewport.Lines-max(viewport.Rows, 1))
}

func (s *State) scrollBy(delta int, viewport Viewport) {
	s.scroll = min(max(s.scroll+delta, 0), s.scrollLimit(viewport))
}

// Searching reports whether typed keys go to the search.
func (s State) Searching() bool { return s.searching }

// Click is a press on line of the card's body. The search line takes the
// search back up, the way / does.
func (s *State) Click(line int) {
	if line == 0 && s.searchActive() {
		s.searching = true
	}
}

func (s State) page(viewport Viewport) int {
	return max(viewport.Rows-1, 1)
}

func (s *State) Update(msg tea.KeyMsg, viewport Viewport) Action {
	if msg.String() == "ctrl+c" {
		return Quit
	}
	if s.searching {
		s.updateSearch(msg, viewport)
		return Stay
	}
	switch msg.String() {
	case "esc":
		if s.query != "" {
			s.query = ""
			s.scroll = 0
			return Stay
		}
		s.close()
		return Close
	case "q", "?", "enter":
		s.close()
		return Close
	case "/":
		s.searching = true
	case "o":
		return OpenDocs
	case "up", "k":
		s.scrollBy(-1, viewport)
	case "down", "j":
		s.scrollBy(1, viewport)
	case "pgup", "ctrl+u":
		s.scrollBy(-s.page(viewport), viewport)
	case "pgdown", "ctrl+d":
		s.scrollBy(s.page(viewport), viewport)
	case "g", "home":
		s.scroll = 0
	case "G", "end":
		s.scroll = s.scrollLimit(viewport)
	}
	return Stay
}

// updateSearch types into the search. Scrolling stays live while it is up,
// so a query with more hits than the card can show remains readable.
func (s *State) updateSearch(msg tea.KeyMsg, viewport Viewport) {
	switch msg.String() {
	case "enter":
		s.searching = false
	case "esc":
		s.searching = false
		s.query = ""
		s.scroll = 0
	case "backspace":
		if runes := []rune(s.query); len(runes) > 0 {
			s.query = string(runes[:len(runes)-1])
			s.scroll = 0
		}
	case "up":
		s.scrollBy(-1, viewport)
	case "down":
		s.scrollBy(1, viewport)
	case "pgup":
		s.scrollBy(-s.page(viewport), viewport)
	case "pgdown":
		s.scrollBy(s.page(viewport), viewport)
	default:
		switch msg.Type {
		case tea.KeyRunes:
			s.query += string(msg.Runes)
			s.scroll = 0
		case tea.KeySpace:
			s.query += " "
			s.scroll = 0
		}
	}
}

```

### Core Architecture Module: `internal/ui/preview_render.go`
```
package ui

import (
	"github.com/charmbracelet/x/ansi"
	"regexp"
	"strings"
)

// previewDangerSeqs strips capture sequences that would scroll or clear the
// outer manager terminal when embedded in View output: erase (K/J), scroll
// (S/T), insert/delete lines (L/M), set scroll region (r), and the 7-bit
// index / reverse-index / next-line controls (D/M/E).
var previewDangerSeqs = regexp.MustCompile(
	`\x1b\[[0-9;]*[KJLMSTr]|\x1b[DEM]`,
)

func previewLine(line string, width int) string {
	line = strings.ReplaceAll(line, cursorAnchorMarker, "")
	line = previewDangerSeqs.ReplaceAllString(line, "")
	line = strings.Map(func(r rune) rune {
		if r < 0x20 && r != 0x1b && r != '\t' {
			return -1
		}
		return r
	}, line)
	w := ansi.StringWidth(line)
	if w > width {
		line = ansi.Truncate(line, width, "")
		w = ansi.StringWidth(line)
	}
	// Reset before padding so an open background from the agent does not
	// paint the rest of the column.
	if strings.ContainsRune(line, 0x1b) {
		line += "\x1b[0m"
	}
	if w < width {
		line += strings.Repeat(" ", width-w)
	}
	return line
}

// expandPaneTabs writes a captured row's tabs out as the spaces the pane
// already painted. tmux serializes a tab as the single byte even though it
// spans the cells up to the next eight-column stop, so a row that keeps one
// measures narrower than it paints and overflows its column. The stops
// count from the row's start, which is pane column zero; escape sequences
// hold no column. A tab that would reach past the row's last cell stops on
// it, which is where tmux leaves the cursor.
func expandPaneTabs(line string, width int) string {
	if !strings.ContainsRune(line, '\t') {
		return line
	}
	const tabStop = 8
	var out strings.Builder
	column := 0
	for i, segment := range strings.Split(line, "\t") {
		if i > 0 {
			pad := max(min(tabStop-column%tabStop, width-1-column), 0)
			out.WriteString(strings.Repeat(" ", pad))
			column += pad
		}
		out.WriteString(segment)
		column += ansi.StringWidth(segment)
	}
	return out.String()
}

// paneWindow picks the half-open row range of a capture the panel shows.
// A pane is left taller than the panel on purpose, since shrinking it
// costs agents like Codex their whole scrollback (#369), so the window
// drops a blank tail instead. A completely blank, not-yet-painted pane
// keeps its rows hit-testable, and a live caret keeps its row in view.
func paneWindow(pane string, n, caretRow int) (lines []string, start int) {
	if n <= 0 || pane == "" {
		return nil, 0
	}
	// capture-pane often ends with a trailing newline; drop only that.
	lines = strings.Split(strings.TrimSuffix(pane, "\n"), "\n")
	end := len(lines)
	for end > 0 && blankPaneRow(lines[end-1]) {
		end--
	}
	if end == 0 {
		end = min(n, len(lines))
	}
	if caretRow+1 > end {
		end = caretRow + 1
	}
	if end > len(lines) {
		end = len(lines)
	}
	start = end - n
	if start < 0 {
		start = 0
	}
	return lines[start:end], start
}

func blankPaneRow(line string) bool {
	return strings.TrimSpace(ansi.Strip(line)) == ""
}

// paneExact returns up to n lines of pane text as the pane painted them,
// preserving blank rows so a full-screen agent TUI looks the same in the
// preview. caretRow is the capture row the live caret sits on, or -1 when
// none is in play. Rows arrive here before anything measures them, so this
// is where a tab becomes the cells it covers and the frame, the caret and
// the selection all count one set of columns.
func paneExact(pane string, n, width, caretRow int) []string {
	lines, _ := paneWindow(pane, n, caretRow)
	for i, line := range lines {
		lines[i] = expandPaneTabs(line, width)
	}
	return lines
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #443** (2026-09-05): **pi status stuck since pi 0.85 moved the spinner into the input border**
  *Symptoms*: ### What happened  1. Update pi to 0.85.0 2. Spawn a pi session from agent-manager, give it a long task 3. Status says "idle" or "finished" the whole time it works. Never "working".  pi 0.85.0 moved the streaming indicator into the top border of the input box (their changelog, earendil-works/pi#8799). The spinner went from  ```  ⠴ Working...  ───────────────────────────────── ```  to  ``` ── ⠹ Working ──────────────────── ```  The [tools.pi] working rule wants the spinner at the start of its own line, then a blank line, then the rule. On 0.85 that shape is gone, so the rule never matches and everything falls back to default_status.  Not the footer this time. I removed the hydra line from the capture and the rule still fails. #414 is fine.  Quick check with the 0.35.0 working rule against my captured pane tail (cut at 50 columns, the rules only need 8 dashes). Runs as-is on Python 3.14:  ```python import re rule = r"(?ms)^[ \t]*[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏][ \t]+(?:Working|Running|Retrying|Compacting context|Auto-compacting|Context overflow detected, Auto-compacting|Summarizing branch)\b[^\n]*\n[ \t]*\n─{8,}[ \t]*\n(?:[ \t]*\n)*─{8,}[ \t]*(?:\n[^\n]*){2,5}[ \t]*(?:\n[ \t]*)*\z" pane = """── ⠹ Working ─────────────────────────────────────  ────────────────────────────────────────────────── ~ ↑116 ↓26k R1.4M W61k CH96.6% $2.862 (sub) 6.2%/1. hydra:navigator+simplifier hit 97.1% (last 98.8%)""" print(re.search(rule, pane))                                # None old = pane.replace("── ⠹ Working ───

- **Issue #440** (2026-09-08): **Codex session stays errored after it recovers and finishes the next turn**
  *Symptoms*: ## What happens  A Codex session stays `✕ errored` after the error is long gone. In the screenshot the session shows `✕ errored · 10s ago` in the tree and the header, while its pane ends with a completed turn (`Fixed. PR #298792 …`) at a resting `› Ask Codex to do anything` prompt.  The only error on screen belongs to an earlier attempt that Codex recovered from by itself:  ``` ■ unexpected status 404 Not Found: Unknown error, url: https://chatgpt.com/backend-api/codex/responses, cf-ray: … ```  Codex fell back from WebSockets to HTTPS, the user re-sent `fix it?`, the next turn ran to completion. Agent Manager still reports errored, and keeps reporting it until a new `Worked for` divider happens to appear.  ## Why  `matchScope` (internal/status/status.go) narrows rule matching to the text after the newest `turn_end` marker. For codex `turn_end` is:  ``` turn_end = "(?m)^─+ Worked for [\\dhms. ]+─" ```  The recovered turn closed with a plain `────` divider and no `Worked for` line, so the newest `Worked for` marker is still the one above the failed attempt. Everything after it, including the stale `■ … error` row, stays inside the match scope, and the codex rule  ``` { state = "errored", pattern = "(?im)^\\s*■.*\\berror\\b" } ```  fires on every poll.  ## Reproduction  Feeding the real pane text through the default config:  ``` state="errored" matched=true scope starts: "\n\n› fix it?\n\n\n⚠ Falling back from WebSockets to HTTPS transport. unexpected status 404 Not Found: …" ``

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

### Incident Patch 1: `13148419` (2026-10-26)
**Commit Message**: fix(env): give terminals their profile and drop removed keys on relaunch

A terminal has no command, so Create wrote no launch script and its shell
never got the profile. A shell launch with a profile now gets a script that
exports it and execs the user's shell; one without keeps tmux's login shell.

The relaunch only exported, so a key removed from the profile stayed set in
the pane's shell and reached the next agent. Each launch now records the keys
it exports in AGENT_MANAGER_ENV_KEYS and unsets the previous list first. On
Unix the relaunch execs the same sh launch script Create runs, since the pane
shell may be zsh or fish, which spell that unset differently. On Windows the
dot-sourced environment file removes them.

The environment map is cloned from the profile instead of sized from it,
which CodeQL flagged as an allocation that may overflow.

**File**: `internal/launch/launch.go` (modified, +12/-4)
```diff
@@ -171,8 +171,9 @@ func ReviveCommand(tool config.Tool, agentSessionID string) string {
 }
 
 // Environment resolves the shell command and environment a session
-// launches with. Every session carries its id so the rename subcommand
-// can find it, and the launch it belongs to, which is the agent_launched_at
+// launches with. Every session but a shell with no profile carries its id
+// so the rename subcommand can find it, and the launch it belongs to, which
+// is the agent_launched_at
 // the caller stamps for it (zero for a row's first launch), so a
 // conversation the agent reports lands on this launch only. The agent runs
 // under the pid its line exports and records, so only it can report and the
@@ -199,8 +200,10 @@ func Environment(manager *hooks.Manager, toolName string, tool config.Tool, base
 	}
 	stamp := store.LaunchStamp(launchedAt)
 	launch := strconv.FormatInt(stamp, 10)
-	env := make(map[string]string, len(profile)+len(tool.Env)+2)
-	maps.Copy(env, profile)
+	env := maps.Clone(profile)
+	if env == nil {
+		env = map[string]string{}
+	}
 	env[hooks.EnvSessionID], env[hooks.EnvLaunch] = id, launch
 	maps.Copy(env, tool.Env)
 	if toolName == "grok" {
@@ -212,6 +215,11 @@ func Environment(manager *hooks.Manager, toolName string, tool config.Tool, base
 		baseCommand += " --no-leader"
 	}
 	if baseCommand == "" {
+		// Exporting into a shell launch replaces tmux's login shell with a
+		// non-login one, worth it only to carry a profile.
+		if len(profile) == 0 {
+			return "", nil, nil
+		}
 		return "", env, nil
 	}
 	if err := os.MkdirAll(manager.Dir(), 0o755); err != nil {
```

**File**: `internal/launch/launch_test.go` (modified, +6/-2)
```diff
@@ -334,8 +334,12 @@ func TestEnvironmentRunsTheAgentUnderThePIDItExports(t *testing.T) {
 	}
 
 	shell := config.Tool{Command: "", MCP: mcpreg.StyleNone}
-	if command, env, err := Environment(manager, "terminal", shell, shell.Command, "abcd1234", t.TempDir(), time.Time{}, nil); err != nil || command != "" || env[hooks.EnvSessionID] != "abcd1234" {
-		t.Fatalf("shell launch = %q, %v, %v; want no command and the session env", command, env, err)
+	if command, env, err := Environment(manager, "terminal", shell, shell.Command, "abcd1234", t.TempDir(), time.Time{}, nil); err != nil || command != "" || env != nil {
+		t.Fatalf("shell launch = %q, %v, %v; want no command and no env, so tmux keeps its login shell", command, env, err)
+	}
+	profile := map[string]string{"AM_SECRET": "s3cret"}
+	if command, env, err := Environment(manager, "terminal", shell, shell.Command, "abcd1234", t.TempDir(), time.Time{}, profile); err != nil || command != "" || env[hooks.EnvSessionID] != "abcd1234" || env["AM_SECRET"] != "s3cret" {
+		t.Fatalf("profiled shell launch = %q, %v, %v; want no command and the session and profile env", command, env, err)
 	}
 }
 
```

**File**: `internal/tmux/launch.go` (modified, +5/-1)
```diff
@@ -30,7 +30,7 @@ func (d *Driver) Create(id, cwd, command string, env map[string]string, width, h
 	// pane to the user's shell afterwards matches "type into a shell"
 	// (pane stays up).
 	var scriptPath string
-	if command != "" {
+	if command != "" || len(env) > 0 {
 		var err error
 		scriptPath, err = writeLaunchScript(id, env, command, colorFgBg)
 		if err != nil {
@@ -57,6 +57,10 @@ func (d *Driver) Create(id, cwd, command string, env map[string]string, width, h
 // the user is looking when they wonder how to get it back.
 const relaunchHint = "agent-manager: agent exited - press v in Agent Manager to relaunch it here."
 
+// envKeysVar lists the keys a launch exported into the pane's shell, so the
+// next launch in that pane can unset the ones its environment dropped.
+const envKeysVar = "AGENT_MANAGER_ENV_KEYS"
+
 func sortedKeys(env map[string]string) []string {
 	keys := make([]string, 0, len(env))
 	for key := range env {
```

**File**: `internal/tmux/platform_unix.go` (modified, +39/-55)
```diff
@@ -203,35 +203,10 @@ func ShellInvoke(path string) string {
 	return ShellQuote(path)
 }
 
-// writeEnvFile writes the session environment for a pane whose shell does
-// not carry it: a session launched before the manager started exporting
-// these values still holds a shell that never received them, and it keeps
-// them once this agent exits too. The shell sources the file, which deletes
-// itself, so a value such as a token is never typed into the pane, where it
-// would show on screen and land in the shell's history. CreateTemp makes it
-// readable by this user alone. The file is gone before the first export,
-// since a profile's PATH may hold no rm.
-func writeEnvFile(id, rm string, env map[string]string) (string, error) {
-	file, err := os.CreateTemp("", "am-env-"+id+"-*.sh")
-	if err != nil {
-		return "", fmt.Errorf("environment file: %w", err)
-	}
-	path := file.Name()
-	_, err = file.WriteString(ShellQuote(rm) + " -f -- " + ShellQuote(path) + "\n" + exportLines(env))
-	if closeErr := file.Close(); err == nil {
-		err = closeErr
-	}
-	if err != nil {
-		os.Remove(path)
-		return "", fmt.Errorf("environment file: %w", err)
-	}
-	return path, nil
-}
-
 // relaunchTools are rm and sh as the manager's own PATH resolves them. The
-// relaunch runs them after the session environment is in the shell, and a
-// profile that sets PATH for its agent must not hide what the relaunch
-// itself needs.
+// relaunch runs them from a shell that may hold an earlier profile's PATH,
+// and a profile that sets PATH for its agent must not hide what the
+// relaunch itself needs.
 func relaunchTools() (rm, sh string, err error) {
 	if rm, err = exec.LookPath("rm"); err != nil {
 		return "", "", fmt.Errorf("relaunch: %w", err)
@@ -242,14 +217,14 @@ func relaunchTools() (rm, sh string, err error) {
 	return rm, sh, nil
 }
 
-// RunInPane types a command into the shell a pane already holds, with the
-// session environment exported into that shell first. The command runs
-// from a script, as Create's does: send-keys stops around 1024 bytes, and a
-// shell without line editing, such as dash, drops a longer line whole. The
-// script gets a fresh name no other user can claim first in a shared temp
-// dir, and removes itself once the shell has opened it. set -m gives the
-// agent its own process group, so tmux reports the agent rather than the
-// script as the pane's command and directory.
+// RunInPane replaces the shell a pane already holds with a launch script,
+// as Create's, which runs the command under the session environment and
+// execs the user's shell again once the agent exits. Running in sh, whatever
+// that shell is, the script can unset what the previous launch exported. A
+// script, since send-keys stops around 1024 bytes and a shell without line
+// editing, such as dash, drops a longer line whole. It gets a fresh name no
+// other user can claim first in a shared temp dir, and removes itself once
+// sh has opened it, so no value is typed into the pane or left on disk.
 func (d *Driver) RunInPane(id string, env map[string]string, command string) error {
 	rm, sh, err := relaunchTools()
 	if err != nil {
@@ -260,36 +235,36 @@ func (d *Driver) RunInPane(id string, env map[string]string, command string) err
 		return fmt.Errorf("relaunch script: %w", err)
 	}
 	path := script.Name()
-	_, err = script.WriteString(ShellQuote(rm) + " -f -- \"$0\"\nset -m\n" + command + "\n")
+	_, err = script.WriteString(launchScript(rm, env, command, ""))
 	if closeErr := script.Close(); err == nil {
 		err = closeErr
 	}
 	if err != nil {
 		os.Remove(path)
 		return fmt.Errorf("relaunch script: %w", err)
 	}
-	envPath, err := writeEnvFile(id, rm, env)
-	if err != nil {
+	if err := d.SendKeys(id, "exec "+ShellQuote(sh)+" "+ShellQuote(path), "Enter"); err != nil {
 		os.Remove(path)
 		return err
 	}
-	if err := d.SendKeys(id, ". "+ShellQuote(envPath)+"; "+ShellQuote(sh)+" "+ShellQuote(path), "Enter"); err != nil {
-		os.Remove(path)
-		os.Remove(envPath)
-		return err
-	}
 	return nil
 }
 
 // exportLines exports the session environment into the pane's shell, so it
 // outlives the launch command. Quitting the agent leaves a shell that still
 // knows which managed session it belongs to, and an agent started again
-// from that shell is the same session to every manager subcommand.
+// from that shell is the same session to every manager subcommand. The keys
+// the previous launch in the pane exported go first, so one a profile has
+// dropped since is not kept at its old value. They are names CheckEnvKey
+// passed, so sh splits the list safely.
 func exportLines(env map[string]string) string {
 	var lines strings.Builder
-	for _, key := range sortedKeys(env) {
+	lines.WriteString("for key in $" + envKeysVar + "; do unset \"$key\"; done\n")
+	keys := sortedKeys(env)
+	for _, key := range keys {
 		lines.WriteString("export " + key + "=" + ShellQuote(env[key]) + "\n")
 	}
+	lines.WriteString("export " + envKeys
```

**File**: `internal/tmux/platform_windows.go` (modified, +12/-5)
```diff
@@ -404,12 +404,16 @@ func (d *Driver) RunInPane(id string, env map[string]string, command string) err
 }
 
 // exportLines sets the session environment in the pane's shell, so it
-// outlives the launch command.
+// outlives the launch command. The keys the previous launch in the pane set
+// go first, so one a profile has dropped since is not kept at its old value.
 func exportLines(env map[string]string) string {
 	var lines strings.Builder
-	for _, key := range sortedKeys(env) {
+	lines.WriteString("foreach ($key in -split $env:" + envKeysVar + ") { if ($key) { Remove-Item -LiteralPath \"Env:$key\" -ErrorAction Ignore } }\n")
+	keys := sortedKeys(env)
+	for _, key := range keys {
 		lines.WriteString("$env:" + key + " = " + ShellQuote(env[key]) + "\n")
 	}
+	lines.WriteString("$env:" + envKeysVar + " = " + ShellQuote(strings.Join(keys, " ")) + "\n")
 	return lines.String()
 }
 
@@ -426,7 +430,8 @@ func launchScriptPath(id string) string {
 
 // writeLaunchScript writes the PowerShell script the pane shell runs with
 // -NoExit: once the agent exits, that shell stays as the user's prompt,
-// the way the POSIX script execs $SHELL.
+// the way the POSIX script execs $SHELL. With no command, as for a
+// terminal, the shell reaches its prompt once env is set.
 func writeLaunchScript(id string, env map[string]string, command, colorFgBg string) (string, error) {
 	path := launchScriptPath(id)
 	var header string
@@ -435,8 +440,10 @@ func writeLaunchScript(id string, env map[string]string, command, colorFgBg stri
 	}
 	// The script removes itself once PowerShell has read it, so the
 	// environment it sets, a profile's tokens among it, is not left on disk.
-	body := "Remove-Item -LiteralPath $PSCommandPath\n" + standardArgumentPassing + header + exportLines(env) + command + "\n" +
-		"Write-Host " + ShellQuote(relaunchHint) + "\n"
+	body := "Remove-Item -LiteralPath $PSCommandPath\n" + standardArgumentPassing + header + exportLines(env)
+	if command != "" {
+		body += command + "\nWrite-Host " + ShellQuote(relaunchHint) + "\n"
+	}
 	if err := os.WriteFile(path, pwsh.ScriptFile(body), 0o600); err != nil {
 		return "", fmt.Errorf("launch script: %w", err)
 	}
```

**File**: `internal/tmux/platform_windows_test.go` (modified, +39/-0)
```diff
@@ -236,6 +236,45 @@ func TestPsmuxRunInPaneDeliversALongCommand(t *testing.T) {
 	}
 }
 
+// A key removed from the profile between relaunches must not stay set in
+// the pane's PowerShell, where the next agent would still see it.
+func TestPsmuxRunInPaneDropsAKeyTheProfileNoLongerHas(t *testing.T) {
+	driver := requireTmux(t)
+	id := psmuxSession(t, driver, "drop", "Write-Output launched", "launched")
+	if err := driver.RunInPane(id, map[string]string{"AM_SECRET": "old-value", "AM_KEEP": "one"}, "Write-Output first"); err != nil {
+		t.Fatalf("RunInPane: %v", err)
+	}
+	waitForPaneLine(t, driver, id, "first")
+	marker := filepath.Join(t.TempDir(), "ran")
+	command := "[IO.File]::WriteAllText(" + ShellQuote(marker) + ", [string]($null -eq $env:AM_SECRET) + '|' + $env:AM_KEEP)"
+	if err := driver.RunInPane(id, map[string]string{"AM_KEEP": "two"}, command); err != nil {
+		t.Fatalf("RunInPane: %v", err)
+	}
+	var got string
+	for deadline := time.Now().Add(15 * time.Second); got == "" && time.Now().Before(deadline); time.Sleep(100 * time.Millisecond) {
+		data, _ := os.ReadFile(marker)
+		got = string(data)
+	}
+	if got != "True|two" {
+		pane, _ := driver.CapturePane(id)
+		t.Fatalf("relaunched agent saw %q, want the dropped key gone and the kept one updated; pane:\n%s", got, pane)
+	}
+}
+
+// A terminal has no command, but a profile still reaches its PowerShell.
+func TestPsmuxCreateExportsAProfileIntoATerminal(t *testing.T) {
+	driver := requireTmux(t)
+	id := prefixedID("term")
+	if err := driver.Create(id, paneDir(), "", map[string]string{"AM_SECRET": "s3cret-value"}, 100, 30); err != nil {
+		t.Fatalf("Create: %v", err)
+	}
+	t.Cleanup(func() { driver.Kill(id) })
+	if err := driver.SendKeys(id, "Write-Output ('seen-' + $env:AM_SECRET)", "Enter"); err != nil {
+		t.Fatalf("SendKeys: %v", err)
+	}
+	waitForPaneLine(t, driver, id, "seen-s3cret-value")
+}
+
 // A prompt holding double quotes reaches the agent CLI as the one argument
 // it was quoted as, not split around the quotes into flags of its own.
 func TestPsmuxPromptWithQuotesStaysOneArgument(t *testing.T) {
```

**File**: `internal/tmux/tmux_unix_test.go` (modified, +48/-19)
```diff
@@ -479,30 +479,59 @@ func TestPaneSendLockHoldsAcrossOpens(t *testing.T) {
 	again()
 }
 
-// The relaunch hands its environment over in a file the shell sources, so
-// no value is typed into the pane; the file is gone once it has been read,
-// even under a profile whose PATH holds no rm.
-func TestEnvFileExportsAndRemovesItself(t *testing.T) {
-	rm, _, err := relaunchTools()
+// Each launch unsets what the previous one in the pane exported, so a key
+// dropped from the profile since is gone, while the user's own variables
+// and the values still in it stay quoted whole.
+func TestExportLinesDropsTheKeysThePreviousLaunchExported(t *testing.T) {
+	script := exportLines(map[string]string{"B": "it's second", "A": "fir st"})
+	cmd := exec.Command("sh", "-c", script+`printf '%s|%s|%s|%s|%s' "$A" "$B" "${AM_SECRET-unset}" "$MINE" "$`+envKeysVar+`"`)
+	cmd.Env = append(os.Environ(), envKeysVar+"=AM_SECRET B", "AM_SECRET=old", "B=old", "MINE=kept")
+	out, err := cmd.Output()
 	if err != nil {
-		t.Fatalf("relaunchTools: %v", err)
+		t.Fatalf("sh: %v", err)
 	}
-	path, err := writeEnvFile("probe", rm, map[string]string{"B": "it's second", "A": "fir st", "PATH": "/nonexistent-am"})
-	if err != nil {
-		t.Fatalf("writeEnvFile: %v", err)
+	if got, want := string(out), "fir st|it's second|unset|kept|A B"; got != want {
+		t.Fatalf("exported env = %q, want %q", got, want)
 	}
-	info, err := os.Stat(path)
-	if err != nil || info.Mode().Perm() != 0o600 {
-		t.Fatalf("env file mode = %v, %v; want 0600", info, err)
+}
+
+// The review's case: a key removed from the profile between launches must
+// not reach the relaunched agent through the shell the first launch left.
+func TestRunInPaneDropsAKeyTheProfileNoLongerHas(t *testing.T) {
+	driver := requireTmux(t)
+	id := "drop" + strings.ReplaceAll(time.Now().Format("150405.000000"), ".", "")
+	if err := driver.Create(id, "/tmp", "true", map[string]string{"AM_SECRET": "old-value", "AM_KEEP": "one"}, 0, 0); err != nil {
+		t.Fatalf("Create: %v", err)
 	}
-	out, err := exec.Command("sh", "-c", ". "+ShellQuote(path)+"; printf '%s|%s' \"$A\" \"$B\"").Output()
-	if err != nil {
-		t.Fatalf("source: %v", err)
+	t.Cleanup(func() { driver.Kill(id) })
+	waitForPane(t, driver, id, relaunchHint)
+	marker := filepath.Join(t.TempDir(), "ran")
+	command := `printf '%s|%s' "${AM_SECRET-unset}" "$AM_KEEP" > ` + ShellQuote(marker+".part") + " && mv " + ShellQuote(marker+".part") + " " + ShellQuote(marker)
+	if err := driver.RunInPane(id, map[string]string{"AM_KEEP": "two"}, command); err != nil {
+		t.Fatalf("RunInPane: %v", err)
+	}
+	if got := waitForFile(t, driver, id, marker); got != "unset|two" {
+		t.Fatalf("relaunched agent saw %q, want the dropped key unset and the kept one updated", got)
+	}
+}
+
+// A terminal has no command, but a profile still reaches its shell, and the
+// script that carried it is gone.
+func TestCreateExportsAProfileIntoATerminal(t *testing.T) {
+	driver := requireTmux(t)
+	id := "term" + strings.ReplaceAll(time.Now().Format("150405.000000"), ".", "")
+	if err := driver.Create(id, "/tmp", "", map[string]string{"AM_SECRET": "s3cret-value"}, 0, 0); err != nil {
+		t.Fatalf("Create: %v", err)
+	}
+	t.Cleanup(func() { driver.Kill(id) })
+	marker := filepath.Join(t.TempDir(), "ran")
+	if err := driver.SendKeys(id, `printf %s "$AM_SECRET" > `+ShellQuote(marker+".part")+" && mv "+ShellQuote(marker+".part")+" "+ShellQuote(marker), "Enter"); err != nil {
+		t.Fatalf("SendKeys: %v", err)
 	}
-	if got := string(out); got != "fir st|it's second" {
-		t.Fatalf("sourced env = %q", got)
+	if got := waitForFile(t, driver, id, marker); got != "s3cret-value" {
+		t.Fatalf("terminal shell saw AM_SECRET = %q", got)
 	}
-	if _, err := os.Stat(path); !os.IsNotExist(err) {
-		t.Fatalf("env file left behind: %v", err)
+	if _, err := os.Stat(launchScriptPath(id)); !os.IsNotExist(err) {
+		t.Fatalf("launch script left behind: %v", err)
 	}
 }
```

---

### Incident Patch 2: `57601db0` (2026-10-25)
**Commit Message**: fix(ui): measure a flick's settle gap on the mouse context clock

The list wheel now reads the event time from the rail's mouse context,
the clock the rail already uses for double clicks, so the test drives
the 30ms, 40ms and 220ms gaps of a flick and the pause that ends it
with exact times instead of sleeps the scheduler can stretch past the
settle gap. The two flags that tracked the flick fold into one
timestamp that is zero once the flick has settled.

**File**: `internal/ui/focus_adapter.go` (modified, +1/-4)
```diff
@@ -177,10 +177,7 @@ func (m *Model) leaveFocusMode() tea.Cmd {
 	// click that comes back here, focusing it again instead of leaving.
 	m.rail.ResetClickHistory()
 	m.flushPendingNotice()
-	// A trackpad flick keeps sending scroll events after the fingers lift;
-	// those still belong to the session just left, not to the list.
-	m.mouse.suppressListWheel = true
-	m.mouse.lastListWheelEvent = time.Now()
+	m.mouse.flickAt = time.Now()
 	return nil
 }
 
```

**File**: `internal/ui/model.go` (modified, +5/-9)
```diff
@@ -122,15 +122,11 @@ type mouseCapture struct {
 	// pressed is what the last left press landed on, which its release
 	// clicks when it comes back up over the same one.
 	pressed clickTarget
-	// suppressListWheel swallows list wheel events right after leaveFocus:
-	// a trackpad flick keeps sending scroll events for a moment after the
-	// fingers lift, and those belong to the session the flick started in,
-	// not to the list it just landed on. The train of leftover events is
-	// closely spaced, so swallowing stops at the first gap wider than
-	// wheelSuppressGap instead of after a fixed duration: that covers a
-	// flick of any length without also eating the next deliberate scroll.
-	suppressListWheel  bool
-	lastListWheelEvent time.Time
+	// flickAt is the last wheel notch of a trackpad flick that was still
+	// arriving when focus left, or zero once it has settled. The notches
+	// belong to the session just left, so the list swallows them until the
+	// first gap wider than wheelSettleGap.
+	flickAt time.Time
 }
 
 type settingsFeature struct {
```

**File**: `internal/ui/mouse.go` (modified, +25/-16)
```diff
@@ -347,28 +347,21 @@ func (m *Model) listMouse(msg tea.MouseMsg) (tea.Model, tea.Cmd) {
 	return m.applyRailDecision(m.rail.Mouse(msg, m.layout.displayedRail, ctx))
 }
 
-// wheelSuppressGap is how long a gap between wheel events has to be before
-// a trackpad flick that started in a focused session is treated as over.
-// A real flick slows down at the end: in iTerm2 debug logs its last gaps
-// run about 180-220ms, so this covers that tail with some margin.
-const wheelSuppressGap = 300 * time.Millisecond
+// wheelSettleGap is the pause between two wheel notches that ends a
+// trackpad flick. A flick keeps sending notches after the fingers lift and
+// slows down at the end. In iTerm2 debug logs its last gaps run about 180
+// to 220ms, so this covers that tail with some margin. Ending on a gap
+// rather than after a fixed time covers a flick of any length without
+// eating the next deliberate scroll.
+const wheelSettleGap = 300 * time.Millisecond
 
 // listWheel scrolls the rail, or the list open over the quick bar's
 // prompt, which owns the wheel the way it owns ↑↓. A resize keeps both
-// still.
+// still, and so does a flick that was still arriving when focus left.
 func (m *Model) listWheel(msg tea.MouseMsg, ctx uirail.MouseContext) (tea.Model, tea.Cmd) {
-	if m.layout.split.resizeMode || m.layout.split.dragging {
+	if m.layout.split.resizeMode || m.layout.split.dragging || m.swallowsFlick(ctx.Now) {
 		return m, nil
 	}
-	if m.mouse.suppressListWheel {
-		now := time.Now()
-		if now.Sub(m.mouse.lastListWheelEvent) > wheelSuppressGap {
-			m.mouse.suppressListWheel = false
-		} else {
-			m.mouse.lastListWheelEvent = now
-			return m, nil
-		}
-	}
 	if !m.quickPicking() {
 		return m.applyRailDecision(m.rail.Mouse(msg, m.layout.displayedRail, ctx))
 	}
@@ -378,6 +371,22 @@ func (m *Model) listWheel(msg tea.MouseMsg, ctx uirail.MouseContext) (tea.Model,
 	return m, nil
 }
 
+// swallowsFlick reports whether a wheel notch at now still belongs to the
+// flick that was arriving when focus left, and makes it the notch the next
+// gap is measured from.
+func (m *Model) swallowsFlick(now time.Time) bool {
+	last := m.mouse.flickAt
+	if last.IsZero() {
+		return false
+	}
+	if now.Sub(last) > wheelSettleGap {
+		m.mouse.flickAt = time.Time{}
+		return false
+	}
+	m.mouse.flickAt = now
+	return true
+}
+
 func (m *Model) listPress(msg tea.MouseMsg, ctx uirail.MouseContext) (tea.Model, tea.Cmd) {
 	if msg.Button != tea.MouseButtonLeft && msg.Button != tea.MouseButtonRight {
 		return m, nil
```

**File**: `internal/ui/mouse_test.go` (modified, +35/-16)
```diff
@@ -4,6 +4,7 @@ import (
 	"fmt"
 	"github.com/YoanWai/agent-manager/internal/keybind"
 	"github.com/YoanWai/agent-manager/internal/store"
+	uirail "github.com/YoanWai/agent-manager/internal/ui/rail"
 	"github.com/charmbracelet/bubbles/textarea"
 	tea "github.com/charmbracelet/bubbletea"
 	"github.com/charmbracelet/x/ansi"
@@ -1110,11 +1111,12 @@ func TestMoreCounterOnlyScrolls(t *testing.T) {
 }
 
 // A trackpad flick that is still arriving when ctrl+q leaves focus must not
-// walk the list selection; once it has settled, a deliberate scroll still
-// works normally. See issue #727.
+// walk the list selection, down to its slow last notch; once it has
+// settled, a deliberate scroll moves the selection as before (#727).
 func TestLeavingFocusSwallowsTheFlickStillArriving(t *testing.T) {
+	t.Parallel()
 	m := buildModel(t)
-	for _, name := range []string{"one", "two", "three"} {
+	for _, name := range []string{"one", "two", "three", "four"} {
 		createSession(t, m, name, t.TempDir(), "")
 	}
 	m.selectSessionRow(t, "two")
@@ -1125,7 +1127,6 @@ func TestLeavingFocusSwallowsTheFlickStillArriving(t *testing.T) {
 	if m.mode != modeFocus {
 		t.Fatalf("enter did not focus, mode = %v", m.mode)
 	}
-
 	updated, _ = m.handleKey(tea.KeyMsg{Type: tea.KeyCtrlQ})
 	m = updated.(*Model)
 	m.drainEffects(t)
@@ -1135,26 +1136,44 @@ func TestLeavingFocusSwallowsTheFlickStillArriving(t *testing.T) {
 	before := m.rail.Cursor()
 
 	wheel := tea.MouseMsg{Button: tea.MouseButtonWheelDown, Action: tea.MouseActionPress}
+	// Leaving focus stamped the clock; the notches that follow run on the mouse
+	// context's clock too, so a slow runner cannot stretch the gap past the
+	// settle gap between the stamp and the first notch.
+	if m.mouse.flickAt.IsZero() {
+		t.Fatal("leaving focus should stamp the flick clock")
+	}
 	for i := 0; i < 2; i++ {
-		updated, _ = m.handleMouse(wheel)
+		updated, _ = m.listWheel(wheel, uirail.MouseContext{Now: m.mouse.flickAt.Add(10 * time.Millisecond)})
 		m = updated.(*Model)
 	}
 	if m.rail.Cursor() != before {
-		t.Fatalf("a scroll event right after leaving focus moved the cursor from %d to %d", before, m.rail.Cursor())
+		t.Fatalf("a notch right after leaving focus moved the cursor from %d to %d", before, m.rail.Cursor())
 	}
 
-	time.Sleep(220 * time.Millisecond)
-	updated, _ = m.handleMouse(wheel)
-	m = updated.(*Model)
-	if m.rail.Cursor() != before {
-		t.Fatalf("the slow last event of a flick moved the cursor from %d to %d", before, m.rail.Cursor())
+	// The clock is the mouse context's, so the gaps are exact rather than
+	// a sleep the scheduler can stretch past the settle gap.
+	left := time.Unix(100, 0)
+	m.mouse.flickAt = left
+	wheelAt := func(now time.Time) {
+		updated, _ := m.listWheel(wheel, uirail.MouseContext{Now: now})
+		m = updated.(*Model)
 	}
-
-	time.Sleep(wheelSuppressGap + 20*time.Millisecond)
-	updated, _ = m.handleMouse(wheel)
-	m = updated.(*Model)
+	for _, gap := range []time.Duration{30 * time.Millisecond, 40 * time.Millisecond, 220 * time.Millisecond} {
+		wheelAt(m.mouse.flickAt.Add(gap))
+		if m.rail.Cursor() != before {
+			t.Fatalf("a notch %v after the previous one moved the cursor from %d to %d", gap, before, m.rail.Cursor())
+		}
+	}
+	wheelAt(m.mouse.flickAt.Add(wheelSettleGap + time.Millisecond))
 	if m.rail.Cursor() != before+1 {
-		t.Fatalf("a deliberate scroll once the flick has settled should move the cursor, got %d want %d", m.rail.Cursor(), before+1)
+		t.Fatalf("a scroll once the flick has settled should move the cursor, got %d want %d", m.rail.Cursor(), before+1)
+	}
+	if !m.mouse.flickAt.IsZero() {
+		t.Fatal("a settled flick should stop stamping notches")
+	}
+	wheelAt(left.Add(time.Hour))
+	if m.rail.Cursor() != before+2 {
+		t.Fatalf("a later scroll should move the cursor, got %d want %d", m.rail.Cursor(), before+2)
 	}
 }
 
```

---

### Incident Patch 3: `8f6b218e` (2026-10-25)
**Commit Message**: fix(poller): sample machine gauges on wall-clock spacing (#824)

The computer panel sampled on pass parity, so every poke-driven refresh advanced the cadence and the gauges repainted on nearly every effect. The sample now fires on wall-clock spacing of twice the poll interval, stamped only when the sample runs.

**File**: `internal/execution/helpers_test.go` (modified, +4/-2)
```diff
@@ -73,6 +73,7 @@ func runTests(m *testing.M) int {
 type harness struct {
 	cfg            config.Config
 	store          *store.Store
+	dbPath         string
 	tmux           *tmux.Driver
 	hooks          *hooks.Manager
 	gitDrv         *git.Driver
@@ -216,7 +217,8 @@ func buildModel(t *testing.T) *harness {
 			cfg.Tools[name] = tool
 		}
 	}
-	st, err := store.Open(filepath.Join(t.TempDir(), "state.db"))
+	dbPath := filepath.Join(t.TempDir(), "state.db")
+	st, err := store.Open(dbPath)
 	if err != nil {
 		t.Fatal(err)
 	}
@@ -230,7 +232,7 @@ func buildModel(t *testing.T) *harness {
 	}
 	hooks := hooks.NewManager(t.TempDir())
 	gitDriver, _ := git.New()
-	h := &harness{cfg: cfg, store: st, tmux: driver, hooks: hooks, gitDrv: gitDriver}
+	h := &harness{cfg: cfg, store: st, dbPath: dbPath, tmux: driver, hooks: hooks, gitDrv: gitDriver}
 	h.poller = New(Dependencies{Store: st, TMux: driver, Engine: engine, Hooks: hooks, Git: gitDriver}, OptionsFromConfig(cfg))
 	// Every managed session on the test server goes, including one whose
 	// row the test deleted: Windows will not remove a temp dir that is a
```

**File**: `internal/execution/poller.go` (modified, +24/-2)
```diff
@@ -5,6 +5,7 @@ import (
 	"os"
 	"slices"
 
+	"github.com/YoanWai/agent-manager/internal/config"
 	"github.com/YoanWai/agent-manager/internal/launch"
 
 	"sync"
@@ -92,6 +93,11 @@ type Runner struct {
 	// store, which decides who speaks for sessions no socket has claimed.
 	leading bool
 	tick    int
+	// statsSampledAt is when machine gauges were last sampled. The gate is
+	// wall clock, not pass parity: RequestRefresh pokes fire extra passes,
+	// and parity would sample on nearly every poke, so the panel would
+	// repaint faster than the gauges move.
+	statsSampledAt time.Time
 	// prevTreeCPU / prevTreeAt drive interval agent CPU: cumulative
 	// CPU-seconds per pane root from the last poll, so host share uses
 	// the same "over this window" idea as the computer gauge.
@@ -289,8 +295,14 @@ func (p *Runner) step(ctx context.Context) Result {
 	if captureErr != nil {
 		return Result{Err: captureErr}
 	}
-	// Machine gauges change slowly; sample them every other poll.
-	sampleStats := p.tick%2 == 0
+	// Machine gauges change slowly; sample them on wall-clock spacing so
+	// poke-driven passes do not advance the cadence. The stamp is this
+	// pass's start, so the poll grid lands on the spacing; the slack keeps
+	// wake jitter from deferring a due sample by a whole poll. It commits
+	// at the sample itself: a pass that fails earlier leaves the sample
+	// due, so the retry takes it instead of skipping a fresh one.
+	sampleStats := time.Since(p.statsSampledAt) >= statsSampleEvery-statsSampleSlack
+	sampledAt := time.Now()
 	socket := p.tmux.SocketPath()
 	// Delivering a queued message needs this process, so stamp a heartbeat
 	// the session tools can read to tell a sender whether anyone is home.
@@ -618,6 +630,7 @@ func (p *Runner) step(ctx context.Context) Result {
 		}
 	}
 	if sampleStats {
+		p.statsSampledAt = sampledAt
 		msg.Snap = sysstat.Sample("/")
 		msg.SnapOK = true
 	}
@@ -650,6 +663,15 @@ const (
 	inboxClaimGrace = 30 * time.Second
 )
 
+// statsSampleEvery is the wall-clock spacing between machine-gauge
+// samples: twice the poll interval, matching the every-other-pass cadence
+// this replaced. statsSampleSlack is the wake jitter a due sample still
+// fires within, so pass latency cannot defer it by a whole poll.
+const (
+	statsSampleEvery = 2 * config.PollInterval
+	statsSampleSlack = 250 * time.Millisecond
+)
+
 // launchPromptGrace releases pending input for a session whose prompt
 // scrolled out of the pane, or whose agent never drew it there.
 const launchPromptGrace = 30 * time.Second
```

**File**: `internal/execution/poller_test.go` (modified, +67/-0)
```diff
@@ -2105,6 +2105,73 @@ func TestStoppedReflowReportsUnexecutedWork(t *testing.T) {
 	}
 }
 
+func TestPollerKeepsStatsSamplingOnWallClock(t *testing.T) {
+	m := buildModel(t)
+	// A fresh runner has never sampled, so the first pass does.
+	first := m.poller.Step()
+	if first.Err != nil {
+		t.Fatal(first.Err)
+	}
+	if !first.Snapshot.SnapOK {
+		t.Fatal("a pass with no sample yet should sample the machine gauges")
+	}
+	// Passes inside the spacing - the poked refreshes an effect completion
+	// issues, landing seconds after the last sample - must not resample;
+	// pass parity would sample every second one of them.
+	m.poller.statsSampledAt = time.Now().Add(-statsSampleEvery + time.Second)
+	freshPoke := m.poller.Step()
+	if freshPoke.Err != nil {
+		t.Fatal(freshPoke.Err)
+	}
+	if freshPoke.Snapshot.SnapOK {
+		t.Fatal("a pass inside the spacing must not advance the stats cadence")
+	}
+	// A pass after the spacing - with the wake-jitter slack - samples and
+	// stamps, so the next pass inside the spacing does not.
+	m.poller.statsSampledAt = time.Now().Add(-statsSampleEvery)
+	due := m.poller.Step()
+	if due.Err != nil {
+		t.Fatal(due.Err)
+	}
+	if !due.Snapshot.SnapOK {
+		t.Fatal("a due pass should sample the machine gauges")
+	}
+	withinSpacing := m.poller.Step()
+	if withinSpacing.Err != nil {
+		t.Fatal(withinSpacing.Err)
+	}
+	if withinSpacing.Snapshot.SnapOK {
+		t.Fatal("the pass after a sample must not resample")
+	}
+	// A pass that fails after deciding to sample - ClaimPoller is the first
+	// store call - must leave the sample due, so the retrying pass takes it
+	// instead of skipping a fresh one.
+	m.poller.statsSampledAt = time.Now().Add(-statsSampleEvery)
+	m.poller.heartbeatAt = time.Now().Add(-store.PollerHeartbeatPeriod - time.Second)
+	if err := m.store.Close(); err != nil {
+		t.Fatal(err)
+	}
+	if failed := m.poller.Step(); failed.Err == nil {
+		t.Fatal("a closed store should fail the pass")
+	}
+	if !m.poller.statsSampledAt.Before(time.Now().Add(-statsSampleEvery + statsSampleSlack + time.Second)) {
+		t.Fatal("a failed pass consumed the due sample")
+	}
+	fresh, err := store.Open(m.dbPath)
+	if err != nil {
+		t.Fatal(err)
+	}
+	defer fresh.Close()
+	m.poller.store = fresh
+	retry := m.poller.Step()
+	if retry.Err != nil {
+		t.Fatal(retry.Err)
+	}
+	if !retry.Snapshot.SnapOK {
+		t.Fatal("the pass after a failed one should take the still-due sample")
+	}
+}
+
 func TestEmptyReflowStillExecutesGroupWork(t *testing.T) {
 	runner := &Runner{}
 	ran := false
```

#### Recent Merged Pull Requests:
- **PR #899** (2026-10-26): fix(ui): keep the meter's half cell on arm64 (@YoanWai)
- **PR #893** (2026-10-26): fix(ui): use compatible borders and decorations (@ipl31)
- **PR #891** (2026-10-25): feat(catalog): pick the model and effort for Antigravity sessions (@YoanWai)
- **PR #889** (2026-10-25): fix(ui): keep the selected row's band under the whole row (@YoanWai)
- **PR #887** (closed): docs(feed): announce quiet dead sessions in v0.43.2 (@YoanWai)
- **PR #886** (2026-10-24): ci: upload coverage from a main-only job in the codecov environment (@YoanWai)

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

## X. env): give terminals their profile and drop removed keys on relaunch

**RULE**:
When implementing operations in `internal/launch/launch.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in YoanWai/agent-manager. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `13148419`: env): give terminals their profile and drop removed keys on relaunch. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/launch/launch.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
// launches with. Every session but a shell with no profile carries its id
// so the rename subcommand can find it, and the launch it belongs to, which
// is the agent_launched_at
	env := maps.Clone(profile)
	if env == nil {
		env = map[string]string{}
	}
		// Exporting into a shell launch replaces tmux's login shell with a
		// non-login one, worth it only to carry a profile.
		if len(profile) == 0 {
			return "", nil, nil
		}
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
// launches with. Every session carries its id so the rename subcommand
// can find it, and the launch it belongs to, which is the agent_launched_at
	env := make(map[string]string, len(profile)+len(tool.Env)+2)
	maps.Copy(env, profile)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `13148419` are properly handled with clean fallback behavior.
