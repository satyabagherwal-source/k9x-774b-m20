# Forensic Learning Record (Deep Inspection): OrchestratorInc/agent-orchestrator

> **Canonical Artifact**: `07_PROJECT_LEARNING/untrivial-ai-agent-orchestrator-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Untrivial-ai/agent-orchestrator](https://github.com/Untrivial-ai/agent-orchestrator))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:51:51.943Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `OrchestratorInc/agent-orchestrator`
- **Description**: Run and supervise teams of coding agents from planning to merge. Any harness (Claude code, codex, +25 more). Desktop, web, mobile, and cloud agents.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 12802 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/internal/adapters/agent/activitystate/activitystate.go`
```
// Package activitystate holds the standard mapping from an AO hook sub-command
// name onto an activity state. Most adapters install the same
// session-start/user-prompt-submit/stop/permission-request callbacks and derive
// activity identically from the event name alone; they share this deriver rather
// than each carrying a copy. Adapters that inspect the hook payload for finer
// grained state (claude-code, codex, droid) keep their own deriver.
package activitystate

import "github.com/aoagents/agent-orchestrator/backend/internal/domain"

// StandardDeriveActivityState maps a hook sub-command name onto an AO activity
// state. The bool is false when the event carries no activity signal. The
// payload is ignored: this is the name-only mapping shared by adapters whose
// hooks report activity purely through which callback fired.
//
//   - session-start / user-prompt-submit → active
//   - stop                               → idle
//   - permission-request                 → waiting_input
//
// permission-request maps to waiting_input, not blocked: none of the sharing
// adapters install the pre/post-tool-use trio, so a blocked state could never
// be cleared before the turn ends. waiting_input still suppresses automated
// nudges (NeedsInput) while leaving user-initiated sends deliverable.
func StandardDeriveActivityState(event string, _ []byte) (domain.ActivityState, bool) {
	switch event {
	case "session-start":
		return domain.ActivityActive, true
	case "user-prompt-submit":
		return domain.ActivityActive, true
	case "stop":
		return domain.ActivityIdle, true
	case "permission-request":
		return domain.ActivityWaitingInput, true
	default:
		return "", false
	}
}

```

### Core Architecture Module: `backend/internal/adapters/agent/agy/hooks.go`
```
package agy

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"strings"

	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/hookutil"
	"github.com/aoagents/agent-orchestrator/backend/internal/ports"
)

const (
	agyHooksDirName      = ".agents"
	agyHooksFileName     = "hooks.json"
	agyManagedHookName   = "agent-orchestrator"
	agyHookCommandPrefix = "ao hooks agy "
	agyHookTimeout       = 30
)

type agyHookEntry struct {
	Type    string `json:"type,omitempty"`
	Command string `json:"command"`
	Timeout int    `json:"timeout,omitempty"`
}

type agyMatcherGroup struct {
	Matcher *string        `json:"matcher,omitempty"`
	Hooks   []agyHookEntry `json:"hooks"`
}

type agyNamedHook struct {
	PreInvocation []agyHookEntry    `json:"PreInvocation"`
	PostToolUse   []agyMatcherGroup `json:"PostToolUse"`
	Stop          []agyHookEntry    `json:"Stop"`
}

// GetAgentHooks installs AO's named hook in the current AGY workspace hook
// file. All other top-level entries are preserved.
func (p *Plugin) GetAgentHooks(ctx context.Context, cfg ports.WorkspaceHookConfig) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if strings.TrimSpace(cfg.WorkspacePath) == "" {
		return errors.New("agy.GetAgentHooks: WorkspacePath is required")
	}

	hooksPath := agyHooksPath(cfg.WorkspacePath)
	topLevel, err := readAgyHooks(hooksPath)
	if err != nil {
		return fmt.Errorf("agy.GetAgentHooks: %w", err)
	}
	managedJSON, err := json.Marshal(managedAgyHook())
	if err != nil {
		return fmt.Errorf("agy.GetAgentHooks: encode managed hook: %w", err)
	}
	topLevel[agyManagedHookName] = managedJSON
	if err := writeAgyHooks(hooksPath, topLevel); err != nil {
		return fmt.Errorf("agy.GetAgentHooks: %w", err)
	}
	if err := hookutil.EnsureWorkspaceGitignore(filepath.Dir(hooksPath), agyHooksFileName); err != nil {
		return fmt.Errorf("agy.GetAgentHooks: gitignore: %w", err)
	}
	return nil
}

// UninstallHooks removes only AO's named AGY hook. A missing file is a no-op.
func (p *Plugin) UninstallHooks(ctx context.Context, workspacePath string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if strings.TrimSpace(workspacePath) == "" {
		return errors.New("agy.UninstallHooks: workspacePath is required")
	}

	hooksPath := agyHooksPath(workspacePath)
	if _, err := os.Stat(hooksPath); errors.Is(err, os.ErrNotExist) {
		return nil
	} else if err != nil {
		return fmt.Errorf("agy.UninstallHooks: stat %s: %w", hooksPath, err)
	}
	topLevel, err := readAgyHooks(hooksPath)
	if err != nil {
		return fmt.Errorf("agy.UninstallHooks: %w", err)
	}
	delete(topLevel, agyManagedHookName)
	if err := writeAgyHooks(hooksPath, topLevel); err != nil {
		return fmt.Errorf("agy.UninstallHooks: %w", err)
	}
	return nil
}

// AreHooksInstalled reports whether AO's exact managed AGY hook is installed.
func (p *Plugin) AreHooksInstalled(ctx context.Context, workspacePath string) (bool, error) {
	if err := ctx.Err(); err != nil {
		return false, err
	}
	if strings.TrimSpace(workspacePath) == "" {
		return false, errors.New("agy.AreHooksInstalled: workspacePath is required")
	}

	hooksPath := agyHooksPath(workspacePath)
	if _, err := os.Stat(hooksPath); errors.Is(err, os.ErrNotExist) {
		return false, nil
	} else if err != nil {
		return false, fmt.Errorf("agy.AreHooksInstalled: stat %s: %w", hooksPath, err)
	}
	topLevel, err := readAgyHooks(hooksPath)
	if err != nil {
		return false, fmt.Errorf("agy.AreHooksInstalled: %w", err)
	}
	raw, ok := topLevel[agyManagedHookName]
	if !ok {
		return false, nil
	}
	var installed agyNamedHook
	if err := json.Unmarshal(raw, &installed); err != nil {
		return false, fmt.Errorf("agy.AreHooksInstalled: unmarshal hook: %w", err)
	}
	return reflect.DeepEqual(installed, managedAgyHook()), nil
}

func agyHooksPath(workspacePath string) string {
	return filepath.Join(workspacePath, agyHooksDirName, agyHooksFileName)
}

func managedAgyHook() agyNamedHook {
	matcher := "*"
	entry := func(event string) agyHookEntry {
		return agyHookEntry{Type: "command", Command: agyHookCommandPrefix + event, Timeout: agyHookTimeout}
	}
	return agyNamedHook{
		PreInvocation: []agyHookEntry{entry("pre-invocation")},
		PostToolUse: []agyMatcherGroup{{
			Matcher: &matcher,
			Hooks:   []agyHookEntry{entry("post-tool-use")},
		}},
		Stop: []agyHookEntry{entry("stop")},
	}
}

// readAgyHooks preserves unowned top-level entries as raw JSON values. Missing
// and blank files are treated as empty configuration.
func readAgyHooks(hooksPath string) (map[string]json.RawMessage, error) {
	topLevel := map[string]json.RawMessage{}
	data, err := os.ReadFile(hooksPath) //nolint:gosec // caller-owned workspace path
	if errors.Is(err, os.ErrNotExist) {
		return topLevel, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", hooksPath, err)
	}
	if strings.TrimSpace(string(data)) == "" {
		return topLevel, nil
	}
	if err := json.Unmarshal(data, &topLevel); err != nil {
		return nil, fmt.Errorf("parse %s: %w", hooksPath, err)
	}
	if topLevel == nil {
		return nil, fmt.Errorf("parse %s: top-level value must be an object", hooksPath)
	}
	return topLevel, nil
}

func writeAgyHooks(hooksPath string, topLevel map[string]json.RawMessage) error {
	if err := os.MkdirAll(filepath.Dir(hooksPath), 0o750); err != nil {
		return fmt.Errorf("create hook dir: %w", err)
	}
	data, err := json.MarshalIndent(topLevel, "", "  ")
	if err != nil {
		return fmt.Errorf("encode %s: %w", hooksPath, err)
	}
	data = append(data, '\n')
	if err := hookutil.AtomicWriteFile(hooksPath, data, 0o600); err != nil {
		return fmt.Errorf("write %s: %w", hooksPath, err)
	}
	return nil
}

```

### Core Architecture Module: `backend/internal/adapters/agent/amp/hooks.go`
```
package amp

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/hookutil"
	"github.com/aoagents/agent-orchestrator/backend/internal/ports"
)

const (
	ampPluginDirName  = ".amp"
	ampPluginSubDir   = "plugins"
	ampPluginFileName = "ao-system-prompt.ts"
	ampPluginSentinel = "agent-orchestrator: managed amp system prompt plugin"
)

// GetAgentHooks installs AO's Amp integration plugin into the worktree-local
// .amp/plugins directory. It injects hidden standing instructions at turn start
// and forwards Amp's thread lifecycle to AO. AO owns only ao-system-prompt.ts;
// other user plugin files are preserved.
func (p *Plugin) GetAgentHooks(ctx context.Context, cfg ports.WorkspaceHookConfig) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if strings.TrimSpace(cfg.WorkspacePath) == "" {
		return errors.New("amp.GetAgentHooks: WorkspacePath is required")
	}

	pluginPath := ampPluginPath(cfg.WorkspacePath)
	if _, err := os.Stat(pluginPath); err == nil {
		managed, err := isAOManagedAmpPlugin(pluginPath)
		if err != nil {
			return fmt.Errorf("amp.GetAgentHooks: %w", err)
		}
		if !managed {
			return fmt.Errorf("amp.GetAgentHooks: refusing to overwrite non-AO file at %s", pluginPath)
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("amp.GetAgentHooks: stat plugin: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(pluginPath), 0o750); err != nil {
		return fmt.Errorf("amp.GetAgentHooks: create plugin dir: %w", err)
	}
	source := ampSystemPromptPluginSource(cfg.SystemPrompt, cfg.SystemPromptFile)
	if err := hookutil.AtomicWriteFile(pluginPath, []byte(source), 0o600); err != nil {
		return fmt.Errorf("amp.GetAgentHooks: write plugin: %w", err)
	}
	if err := hookutil.EnsureWorkspaceGitignore(filepath.Dir(pluginPath), ampPluginFileName); err != nil {
		return fmt.Errorf("amp.GetAgentHooks: gitignore: %w", err)
	}
	return nil
}

func ampPluginPath(workspacePath string) string {
	return filepath.Join(workspacePath, ampPluginDirName, ampPluginSubDir, ampPluginFileName)
}

func isAOManagedAmpPlugin(path string) (bool, error) {
	data, err := os.ReadFile(path) //nolint:gosec // path built from caller-owned workspace dir
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("read plugin: %w", err)
	}
	return strings.Contains(string(data), ampPluginSentinel), nil
}

func ampSystemPromptPluginSource(inline, file string) string {
	file = strings.TrimSpace(file)
	inline = strings.TrimRight(inline, "\n")

	var b strings.Builder
	b.WriteString("// ")
	b.WriteString(ampPluginSentinel)
	b.WriteString("\n")
	b.WriteString("import type { PluginAPI } from \"@ampcode/plugin\";\n")
	b.WriteString("import { readFile } from \"node:fs/promises\";\n\n")
	b.WriteString("const systemPromptFile = ")
	fmt.Fprintf(&b, "%q", file)
	b.WriteString(";\n")
	b.WriteString("const inlineSystemPrompt = ")
	if file == "" {
		fmt.Fprintf(&b, "%q", inline)
	} else {
		b.WriteString("\"\"")
	}
	b.WriteString(";\n\n")
	b.WriteString("const HOOK_TIMEOUT_MS = 5_000;\n")
	b.WriteString("const threadSubscriptions = new Map<string, { unsubscribe(): void }>();\n\n")
	b.WriteString("let activeThreadID = \"\";\n\n")
	b.WriteString("function reportHookFailure(amp: any, hookName: string, detail: string) {\n")
	b.WriteString("  try { amp.logger.log(`AO activity hook ${hookName} failed`, { detail }); } catch {}\n")
	b.WriteString("}\n\n")
	b.WriteString("function callHookSync(amp: any, hookName: string, payload: Record<string, unknown>) {\n")
	b.WriteString("  try {\n")
	b.WriteString("    const executable = Bun.which(\"ao\");\n")
	b.WriteString("    if (!executable) return;\n")
	b.WriteString("    const result = Bun.spawnSync([executable, \"hooks\", \"amp\", hookName], {\n")
	b.WriteString("      stdin: new TextEncoder().encode(JSON.stringify(payload) + \"\\n\"),\n")
	b.WriteString("      stdout: \"ignore\",\n")
	b.WriteString("      stderr: \"pipe\",\n")
	b.WriteString("      timeout: HOOK_TIMEOUT_MS,\n")
	b.WriteString("    });\n")
	b.WriteString("    if (!result.success) {\n")
	b.WriteString("      const detail = result.stderr ? new TextDecoder().decode(result.stderr).trim() : `exit ${result.exitCode}`;\n")
	b.WriteString("      reportHookFailure(amp, hookName, detail);\n")
	b.WriteString("    }\n")
	b.WriteString("  } catch (error) {\n")
	b.WriteString("    reportHookFailure(amp, hookName, error instanceof Error ? error.message : String(error));\n")
	b.WriteString("  }\n")
	b.WriteString("}\n\n")
	b.WriteString("function reportThreadState(amp: any, sessionID: string, state: string) {\n")
	b.WriteString("  if (amp.activeThread.current?.id !== sessionID || sessionID !== activeThreadID) return;\n")
	b.WriteString("  callHookSync(amp, \"thread-state\", { session_id: sessionID, state });\n")
	b.WriteString("}\n\n")
	b.WriteString("function observeThread(amp: any, thread: any) {\n")
	b.WriteString("  if (amp.activeThread.current?.id !== thread.id) return;\n")
	b.WriteString("  if (activeThreadID === thread.id) return;\n")
	b.WriteString("  if (activeThreadID) {\n")
	b.WriteString("    threadSubscriptions.get(activeThreadID)?.unsubscribe();\n")
	b.WriteString("    threadSubscriptions.delete(activeThreadID);\n")
	b.WriteString("  }\n")
	b.WriteString("  activeThreadID = thread.id;\n")
	b.WriteString("  const subscription = thread.state.subscribe((state: string) => reportThreadState(amp, thread.id, state));\n")
	b.WriteString("  threadSubscriptions.set(thread.id, subscription);\n")
	b.WriteString("  void thread.state.get().then((state: string) => reportThreadState(amp, thread.id, state)).catch((error: unknown) => {\n")
	b.WriteString("    reportHookFailure(amp, \"thread-state\", error instanceof Error ? error.message : String(error));\n")
	b.WriteString("  });\n")
	b.WriteString("}\n\n")
	b.WriteString("async function loadSystemPrompt(amp: any): Promise<string> {\n")
	b.WriteString("  if (systemPromptFile) {\n")
	b.WriteString("    try {\n")
	b.WriteString("      const content = await readFile(systemPromptFile, \"utf8\");\n")
	b.WriteString("      const trimmed = content.trim();\n")
	b.WriteString("      if (trimmed) return trimmed;\n")
	b.WriteString("      amp.logger.log(\"AO system prompt file is empty\", { systemPromptFile });\n")
	b.WriteString("    } catch (error) {\n")
	b.WriteString("      amp.logger.log(\"AO system prompt file is unavailable\", { systemPromptFile, error });\n")
	b.WriteString("    }\n")
	b.WriteString("  }\n")
	b.WriteString("  return inlineSystemPrompt.trim();\n")
	b.WriteString("}\n\n")
	b.WriteString("export default function (amp: PluginAPI) {\n")
	b.WriteString("  amp.on(\"session.start\", async (event, ctx) => {\n")
	b.WriteString("    observeThread(amp, ctx.thread);\n")
	b.WriteString("    if (event.thread.id === amp.activeThread.current?.id) callHookSync(amp, \"session-start\", { session_id: event.thread.id });\n")
	b.WriteString("  });\n")
	b.WriteString("  amp.on(\"agent.start\", async (event, ctx) => {\n")
	b.WriteString("    observeThread(amp, ctx.thread);\n")
	b.WriteString("    if (event.thread.id !== amp.activeThread.current?.id) return {};\n")
	b.WriteString("    callHookSync(amp, \"user-prompt-submit\", { session_id: event.thread.id, prompt: event.message });\n")
	b.WriteString("    const systemPrompt = await loadSystemPrompt(amp);\n")
	b.WriteString("    if (!systemPrompt) return {};\n")
	b.WriteString("    return { message: { content: systemPrompt, display: false } };\n")
	b.WriteString("  });\n")
	b.WriteString("  amp.on(\"agent.end\", async (event) => {\n")
	b.WriteString("    if (event.thread.id === amp.activeThread.current?.id && event.thread.id === activeThreadID) callHookSync(amp, \"stop\", { session_id: event.thread.id, status: event.status });\n")
	b.WriteString("  });\n")
	b.WriteString("}\n")
	return b.String()
}

```

### Core Architecture Module: `backend/internal/adapters/agent/auggie/hooks.go`
```
package auggie

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/hooksjson"
	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/hookutil"
	"github.com/aoagents/agent-orchestrator/backend/internal/ports"
)

const (
	auggieSettingsDirName  = ".augment"
	auggieSettingsFileName = "settings.local.json"
	auggieHooksDirName     = "ao-hooks"
	auggieHookSentinel     = "agent-orchestrator: managed auggie activity hook"
	auggieHookTimeoutMS    = 5000
)

type auggieHookSpec struct {
	nativeEvent string
	aoEvent     string
}

var auggieManagedHookSpecs = []auggieHookSpec{
	{nativeEvent: "SessionStart", aoEvent: "session-start"},
	{nativeEvent: "PreToolUse", aoEvent: "pre-tool-use"},
	{nativeEvent: "PostToolUse", aoEvent: "post-tool-use"},
	{nativeEvent: "Stop", aoEvent: "stop"},
	{nativeEvent: "SessionEnd", aoEvent: "session-end"},
}

func auggieSettingsPath(workspacePath string) string {
	return filepath.Join(workspacePath, auggieSettingsDirName, auggieSettingsFileName)
}

func auggieHookDir(workspacePath string) string {
	return filepath.Join(workspacePath, auggieSettingsDirName, auggieHooksDirName)
}

func auggieHookScriptName(event string) string {
	ext := ".sh"
	if runtime.GOOS == "windows" {
		ext = ".cmd"
	}
	return "ao-" + event + ext
}

func auggieHookScriptPath(workspacePath, event string) string {
	return filepath.Join(auggieHookDir(workspacePath), auggieHookScriptName(event))
}

func auggieHooksManager(workspacePath string) hooksjson.Manager {
	managed := make([]hooksjson.HookSpec, 0, len(auggieManagedHookSpecs))
	for _, spec := range auggieManagedHookSpecs {
		managed = append(managed, hooksjson.HookSpec{
			Event:   spec.nativeEvent,
			Command: auggieHookScriptPath(workspacePath, spec.aoEvent),
		})
	}
	return hooksjson.Manager{
		Label:         adapterID,
		CommandPrefix: auggieHookDir(workspacePath) + string(filepath.Separator),
		Timeout:       auggieHookTimeoutMS,
		Path:          auggieSettingsPath,
		Managed:       managed,
	}
}

// GetAgentHooks installs executable callbacks and reconciles them into
// .augment/settings.local.json. Auggie requires command hooks to reference a
// supported script file rather than an arbitrary shell command.
func (p *Plugin) GetAgentHooks(ctx context.Context, cfg ports.WorkspaceHookConfig) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	workspacePath := strings.TrimSpace(cfg.WorkspacePath)
	if workspacePath == "" {
		return errors.New("auggie.GetAgentHooks: WorkspacePath is required")
	}
	absoluteWorkspace, err := filepath.Abs(workspacePath)
	if err != nil {
		return fmt.Errorf("auggie.GetAgentHooks: resolve workspace path: %w", err)
	}
	executable, err := os.Executable()
	if err != nil {
		return fmt.Errorf("auggie.GetAgentHooks: resolve AO executable: %w", err)
	}
	if !filepath.IsAbs(executable) {
		executable, err = filepath.Abs(executable)
		if err != nil {
			return fmt.Errorf("auggie.GetAgentHooks: resolve AO executable path: %w", err)
		}
	}

	if err := installAuggieHookScripts(absoluteWorkspace, executable); err != nil {
		return fmt.Errorf("auggie.GetAgentHooks: %w", err)
	}
	if err := auggieHooksManager(absoluteWorkspace).Install(ctx, absoluteWorkspace); err != nil {
		return err
	}
	return nil
}

func installAuggieHookScripts(workspacePath, executable string) error {
	dir := auggieHookDir(workspacePath)
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return fmt.Errorf("create hook directory: %w", err)
	}
	names := make([]string, 0, len(auggieManagedHookSpecs))
	for _, spec := range auggieManagedHookSpecs {
		name := auggieHookScriptName(spec.aoEvent)
		path := filepath.Join(dir, name)
		if data, err := os.ReadFile(path); err == nil { //nolint:gosec // AO-owned workspace path
			if !strings.Contains(string(data), auggieHookSentinel) {
				return fmt.Errorf("refusing to overwrite non-AO file at %s", path)
			}
		} else if !errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("read hook script: %w", err)
		}
		if err := hookutil.AtomicWriteFile(path, []byte(auggieHookScriptSource(executable, spec.aoEvent)), 0o700); err != nil {
			return fmt.Errorf("write %s hook: %w", spec.aoEvent, err)
		}
		names = append(names, name)
	}
	if err := hookutil.EnsureWorkspaceGitignore(dir, names...); err != nil {
		return fmt.Errorf("gitignore hook scripts: %w", err)
	}
	return nil
}

func auggieHookScriptSource(executable, event string) string {
	if runtime.GOOS == "windows" {
		quoted := strings.ReplaceAll(executable, `"`, `""`)
		return "@echo off\r\nrem " + auggieHookSentinel + "\r\n\"" + quoted + "\" hooks auggie " + event + "\r\nexit /b 0\r\n"
	}
	quoted := "'" + strings.ReplaceAll(executable, "'", `'"'"'`) + "'"
	return "#!/bin/sh\n# " + auggieHookSentinel + "\n" + quoted + " hooks auggie " + event + " || true\nexit 0\n"
}

```

### Core Architecture Module: `backend/internal/adapters/agent/autohand/hooks.go`
```
package autohand

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/hookutil"
	"github.com/aoagents/agent-orchestrator/backend/internal/ports"
)

const (
	autohandConfigDirName  = ".autohand"
	autohandConfigFileName = "config.json"

	// autohandHookCommandPrefix identifies the hook commands AO owns, so
	// install skips duplicates and uninstall recognizes AO entries by prefix
	// without an embedded template to diff against.
	autohandHookCommandPrefix = "ao hooks autohand "
	autohandHookTimeout       = 30
)

// autohandManagedHookKeys are the entry keys AO owns. On marshal they are
// written from the typed fields below; any other key the user set is preserved
// from Extra. Keep in sync with the json tags on autohandHookEntry.
var autohandManagedHookKeys = []string{"event", "command", "description", "enabled", "timeout"}

// autohandHookEntry is the on-disk shape of one entry in the config's
// hooks.hooks array. AO owns the five typed fields; any other key the user set
// on an entry (matcher, filter, async, ...) is captured in Extra so a rewrite
// preserves fields AO does not own instead of silently dropping them.
type autohandHookEntry struct {
	Event       string `json:"event"`
	Command     string `json:"command"`
	Description string `json:"description,omitempty"`
	Enabled     bool   `json:"enabled"`
	Timeout     int    `json:"timeout,omitempty"`

	// Extra holds keys AO does not manage, captured on unmarshal and written
	// back on marshal so they round-trip. encoding/json does not support
	// `json:",inline"`, so the round-trip is implemented via the custom
	// UnmarshalJSON/MarshalJSON below.
	Extra map[string]json.RawMessage `json:"-"`
}

// UnmarshalJSON decodes the entry's typed fields and captures every key AO does
// not manage into Extra, so a later MarshalJSON can write them back verbatim.
func (e *autohandHookEntry) UnmarshalJSON(data []byte) error {
	raw := map[string]json.RawMessage{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}

	// Decode the managed fields via a type alias to avoid recursing into this
	// method, then drop the managed keys so Extra holds only unknown ones.
	type managedAlias autohandHookEntry
	var managed managedAlias
	if err := json.Unmarshal(data, &managed); err != nil {
		return err
	}
	*e = autohandHookEntry(managed)

	for _, key := range autohandManagedHookKeys {
		delete(raw, key)
	}
	if len(raw) > 0 {
		e.Extra = raw
	} else {
		e.Extra = nil
	}
	return nil
}

// MarshalJSON writes AO's managed fields merged with any preserved unknown keys
// from Extra. Managed fields win on key collision so AO's values stay
// authoritative.
func (e autohandHookEntry) MarshalJSON() ([]byte, error) {
	out := make(map[string]json.RawMessage, len(e.Extra)+len(autohandManagedHookKeys))
	for key, val := range e.Extra {
		out[key] = val
	}

	type managedAlias autohandHookEntry
	managedJSON, err := json.Marshal(managedAlias(e))
	if err != nil {
		return nil, err
	}
	var managed map[string]json.RawMessage
	if err := json.Unmarshal(managedJSON, &managed); err != nil {
		return nil, err
	}
	for key, val := range managed {
		out[key] = val
	}
	return json.Marshal(out)
}

// autohandHookSpec describes one hook AO installs. Event is Autohand's native
// lifecycle event name; Subcommand is the AO hook sub-command appended after the
// command prefix (and the value DeriveActivityState switches on).
type autohandHookSpec struct {
	Event      string
	Subcommand string
}

// autohandManagedHooks is the source of truth for the hooks AO installs. Each
// native Autohand event is routed to the AO sub-command DeriveActivityState
// understands. Autohand's pre-prompt event is the user-prompt-submit signal.
var autohandManagedHooks = []autohandHookSpec{
	{Event: "session-start", Subcommand: "session-start"},
	{Event: "pre-prompt", Subcommand: "user-prompt-submit"},
	{Event: "permission-request", Subcommand: "permission-request"},
	{Event: "stop", Subcommand: "stop"},
}

// GetAgentHooks installs AO's Autohand hooks into the Autohand config's
// hooks.hooks array. Existing user hooks are preserved and duplicate AO commands
// are not appended. The rest of the config (auth, provider, ...) is preserved
// byte-for-byte because only the hooks section is decoded and rewritten.
//
// Autohand loads hooks from a single config file (default ~/.autohand/config.json,
// overridable via AUTOHAND_CONFIG); it does not merge a workspace-local file at
// runtime, so AO installs into that config rather than a per-workspace file. The
// AUTOHAND_CONFIG env var, when set, takes precedence so AO and the agent agree
// on the target.
func (p *Plugin) GetAgentHooks(ctx context.Context, cfg ports.WorkspaceHookConfig) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	configPath := autohandConfigPath()
	topLevel, hooksSection, entries, err := readAutohandHooks(configPath)
	if err != nil {
		return fmt.Errorf("autohand.GetAgentHooks: %w", err)
	}

	for _, spec := range autohandManagedHooks {
		command := autohandHookCommandPrefix + spec.Subcommand
		if autohandHookCommandExists(entries, command) {
			continue
		}
		entries = append(entries, autohandHookEntry{
			Event:       spec.Event,
			Command:     command,
			Description: "AO activity hook",
			Enabled:     true,
			Timeout:     autohandHookTimeout,
		})
	}

	// Autohand only fires hooks when the hooks section is enabled.
	hooksSection["enabled"] = json.RawMessage(`true`)

	if err := writeAutohandHooks(configPath, topLevel, hooksSection, entries); err != nil {
		return fmt.Errorf("autohand.GetAgentHooks: %w", err)
	}
	return nil
}

// UninstallHooks removes AO's Autohand hooks from the config's hooks.hooks
// array, leaving user-defined hooks and the rest of the config untouched. A
// missing file is a no-op. The hooks.enabled flag is left in place because it
// enables every Autohand hook, not just AO's.
func (p *Plugin) UninstallHooks(ctx context.Context, _ string) error {
	if err := ctx.Err(); err != nil {
		return err
	}

	configPath := autohandConfigPath()
	if _, err := os.Stat(configPath); errors.Is(err, os.ErrNotExist) {
		return nil
	}
	topLevel, hooksSection, entries, err := readAutohandHooks(configPath)
	if err != nil {
		return fmt.Errorf("autohand.UninstallHooks: %w", err)
	}

	kept := make([]autohandHookEntry, 0, len(entries))
	for _, entry := range entries {
		if !isAutohandManagedHook(entry.Command) {
			kept = append(kept, entry)
		}
	}

	if err := writeAutohandHooks(configPath, topLevel, hooksSection, kept); err != nil {
		return fmt.Errorf("autohand.UninstallHooks: %w", err)
	}
	return nil
}

// AreHooksInstalled reports whether any AO Autohand hook is present in the
// config. A missing file means none are installed.
func (p *Plugin) AreHooksInstalled(ctx context.Context, _ string) (bool, error) {
	if err := ctx.Err(); err != nil {
		return false, err
	}

	configPath := autohandConfigPath()
	if _, err := os.Stat(configPath); errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	_, _, entries, err := readAutohandHooks(configPath)
	if err != nil {
		return false, fmt.Errorf("autohand.AreHooksInstalled: %w", err)
	}
	for _, entry := range entries {
		if isAutohandManagedHook(entry.Command) {
			return true, nil
		}
	}
	return false, nil
}

// autohandConfigPath returns the config file Autohand loads hooks from: the
// AUTOHAND_CONFIG override if set, else ~/.autohand/config.json.
func autohandConfigPath() string {
	if env := strings.TrimSpace(os.Getenv("AUTOHAND_CONFIG")); env != "" {
		return env
	}
	home, err := os.UserHomeDir()
	if err != nil {
		// Fall back to a relative path; callers surface the resulting error.
		return filepath.Join(autohandConfigDirName, autohandConfigFileName)
	}
	return filepath.Join(home, autohandConfigDirName, autohandConfigFileName)
}

// readAutohandHooks loads the config into a top-level raw map, the decoded
// "hooks" section (preserving keys AO doesn't manage such as "enabled"), and the
// decoded hooks array. A missing or empty file yields empty maps and a nil
// slice.
func readAutohandHooks(configPath string) (topLevel, hooksSection map[string]json.RawMessage, entries []autohandHookEntry, err error) {
	topLevel = map[string]json.RawMessage{}
	hooksSection = map[string]json.RawMessage{}

	data, err := os.ReadFile(configPath) //nolint:gosec // path is the user's own Autohand config
	if errors.Is(err, os.ErrNotExist) {
		return topLevel, hooksSection, nil, nil
	}
	if err != nil {
		return nil, nil, nil, fmt.Errorf("read %s: %w", configPath, err)
	}
	if strings.TrimSpace(string(data)) == "" {
		return topLevel, hooksSection, nil, nil
	}
	if err := json.Unmarshal(data, &topLevel); err != nil {
		return nil, nil, nil, fmt.Errorf("parse %s: %w", configPath, err)
	}
	if hooksRaw, ok := topLevel["hooks"]; ok {
		if err := json.Unmarshal(hooksRaw, &hooksSection); err != nil {
			return nil, nil, nil, fmt.Errorf("parse hooks in %s: %w", configPath, err)
		}
	}
	if arrRaw, ok := hooksSection["hooks"]; ok {
		if err := json.Unmarshal(arrRaw, &entries); err != nil {
			return nil, nil, nil, fmt.Errorf("parse hooks array in %s: %w", configPath, err)
		}
	}
	return topLevel, hooksSection, entries, nil
}

// writeAutohandHooks folds the entries back into the hooks section, the hooks
// section back into topLevel, and writes the file atomically. An empty entries
// slice drops the "hooks" array key.
func writeAutohandHooks(configPath string, topLevel, hooksSection map[string]json.RawMessage, entries []autohandHookEntry) error {
	if len(entries) == 0 {
		delete(hooksSection, "hooks")
	} else {
		arrJSON, err := json.Marshal(entries)
		if err != nil {
			return fmt.Errorf("encode hooks array: %w", err)
		}
		hooksSection["hooks"] = arrJSON
	}

	if len(hooksSection) == 0 {
		delete(topLevel, "hooks")
	} else {
		hooksJSON, err := json.Marshal(hooksSection)
		if err != nil {
			return fmt.Error
```

### Core Architecture Module: `backend/internal/adapters/agent/binaryutil/binaryutil.go`
```
// Package binaryutil centralizes the "find an agent's CLI binary" search that
// every adapter otherwise reimplements. Adapters differ only in the binary
// name(s) and the well-known install locations to probe, so they describe those
// with a BinarySpec and share the identical PATH-then-candidates iteration.
package binaryutil

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"

	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/hookutil"
	"github.com/aoagents/agent-orchestrator/backend/internal/ports"
)

// BinarySpec describes where one agent's CLI binary can live. ResolveBinary
// searches PATH (via the platform's name list) first, then the platform's
// candidate install paths in order, returning the first hit.
//
// Path components are given as string slices joined onto their base directory,
// so a spec stays OS-agnostic and never hard-codes a separator. env-derived
// bases (APPDATA, LOCALAPPDATA, home) that are unset simply skip their
// candidates.
type BinarySpec struct {
	// Label prefixes the ErrAgentBinaryNotFound error, e.g. "claude".
	Label string

	// Names are the binary names looked up on PATH on non-Windows, in order.
	Names []string
	// WinNames are the binary names looked up on PATH on Windows, in order.
	// Empty means the Windows branch does no PATH lookup.
	WinNames []string

	// UnixPaths are absolute candidate paths probed on non-Windows, in order.
	UnixPaths []string
	// UnixHomePaths are candidate paths under the user's home dir on
	// non-Windows; each entry is the components to join onto $HOME.
	UnixHomePaths [][]string

	// WinPaths are candidate paths probed on Windows, in the exact order given.
	// Each entry names the base directory (%APPDATA%, %LOCALAPPDATA%, or home) it
	// is joined onto. Order is significant: a native installer location listed
	// before an npm shim wins when both are present, so it is spelled out here
	// rather than assumed. Entries whose base env is unset are skipped.
	WinPaths []WinPath

	// NodeManaged adds Unix fallbacks for Node-version-manager global bins such
	// as nvm, Volta, and fnm. Keep this explicit so non-Node adapters don't pick
	// up unrelated same-named npm CLIs.
	NodeManaged bool

	// ValidateIdentity optionally confirms that a resolved executable belongs to
	// the adapter. It must be bounded and honor ctx; a false result rejects the
	// candidate and lets ResolveBinary continue through the ordered candidates.
	ValidateIdentity func(ctx context.Context, path string) bool
}

// WinBase names the base directory a Windows candidate path is joined onto.
type WinBase int

// The base directories a Windows candidate path can resolve against.
const (
	WinAppData      WinBase = iota // %APPDATA%
	WinLocalAppData                // %LOCALAPPDATA%
	WinHome                        // the user's home directory
)

// WinPath is one Windows candidate: Parts joined onto Base's directory.
type WinPath struct {
	Base  WinBase
	Parts []string
}

// ResolveBinary returns the path to spec's binary, searching PATH then the
// platform's candidate install locations. Without identity validation it keeps
// the immediate PATH fast path used by ordinary callers. When validation is
// configured, each PATH hit is checked before the slower fallback enumeration
// so a valid PATH binary still returns promptly and an invalid collision can
// recover from every supported install location.
func ResolveBinary(ctx context.Context, spec BinarySpec) (string, error) {
	if err := ctx.Err(); err != nil {
		return "", err
	}

	names := spec.Names
	if runtime.GOOS == "windows" {
		names = spec.WinNames
	}

	var pathHits map[string]struct{}
	if spec.ValidateIdentity != nil {
		pathHits = make(map[string]struct{})
	}
	for _, name := range names {
		if err := ctx.Err(); err != nil {
			return "", err
		}
		if path, err := exec.LookPath(name); err == nil && path != "" {
			if spec.ValidateIdentity == nil {
				return path, nil
			}
			pathHits[candidateKey(path)] = struct{}{}
			if spec.ValidateIdentity(ctx, path) {
				return path, nil
			}
			if err := ctx.Err(); err != nil {
				return "", err
			}
		}
	}

	candidates, err := resolveBinaryCandidates(ctx, spec)
	if err != nil {
		return "", err
	}

	for _, candidate := range candidates {
		if err := ctx.Err(); err != nil {
			return "", err
		}
		if _, alreadyChecked := pathHits[candidateKey(candidate)]; alreadyChecked {
			continue
		}
		if !hookutil.IsExecutableFile(candidate) {
			continue
		}
		if spec.ValidateIdentity == nil || spec.ValidateIdentity(ctx, candidate) {
			return candidate, nil
		}
		if err := ctx.Err(); err != nil {
			return "", err
		}
	}

	return "", fmt.Errorf("%s: %w", spec.Label, ports.ErrAgentBinaryNotFound)
}

// resolveBinaryCandidates returns every binary location in the resolver's
// existing order: PATH hits first, followed by all configured platform and
// package-manager candidates. Results are deduplicated but are not required to
// exist; callers decide whether and how to validate each path. ctx cancellation
// is honored while discovering candidates.
func resolveBinaryCandidates(ctx context.Context, spec BinarySpec) ([]string, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	var candidates []string
	for _, name := range namesForPlatform(spec) {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		if path, err := exec.LookPath(name); err == nil && path != "" {
			candidates = appendUniqueCandidate(candidates, path)
		}
	}

	fallbacks, err := binaryFallbackCandidates(ctx, spec)
	if err != nil {
		return nil, err
	}
	for _, candidate := range fallbacks {
		candidates = appendUniqueCandidate(candidates, candidate)
	}
	return candidates, nil
}

func binaryFallbackCandidates(ctx context.Context, spec BinarySpec) ([]string, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	var candidates []string
	if runtime.GOOS == "windows" {
		home, _ := os.UserHomeDir()
		appData := os.Getenv("APPDATA")
		localAppData := os.Getenv("LOCALAPPDATA")
		for _, wp := range spec.WinPaths {
			if err := ctx.Err(); err != nil {
				return nil, err
			}
			var base string
			switch wp.Base {
			case WinAppData:
				base = appData
			case WinLocalAppData:
				base = localAppData
			case WinHome:
				base = home
			}
			if base == "" {
				continue
			}
			candidates = append(candidates, filepath.Join(append([]string{base}, wp.Parts...)...))
		}
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		candidates = append(candidates, WindowsPackageManagerBinCandidates(executableNames(spec)...)...)
		return candidates, nil
	}

	candidates = append(candidates, spec.UnixPaths...)
	if home, err := os.UserHomeDir(); err == nil {
		candidates = append(candidates, joinAll(home, spec.UnixHomePaths)...)
		candidates = append(candidates, UnixPackageManagerBinCandidates(home, spec.Names...)...)
		if spec.NodeManaged {
			nodeManagerCandidates, err := UnixNodeManagerBinCandidates(ctx, home, spec.Names...)
			if err != nil {
				return nil, err
			}
			candidates = append(candidates, nodeManagerCandidates...)
		}
	}
	return candidates, nil
}

func namesForPlatform(spec BinarySpec) []string {
	if runtime.GOOS == "windows" {
		return spec.WinNames
	}
	return spec.Names
}

func appendUniqueCandidate(candidates []string, candidate string) []string {
	if candidate == "" {
		return candidates
	}
	key := candidateKey(candidate)
	for _, existing := range candidates {
		if candidateKey(existing) == key {
			return candidates
		}
	}
	return append(candidates, candidate)
}

func candidateKey(candidate string) string {
	key := filepath.Clean(candidate)
	if runtime.GOOS == "windows" {
		return strings.ToLower(key)
	}
	return key
}

// UnixPackageManagerBinCandidates returns cheap, deterministic user-level
// package-manager shim paths that are commonly absent from GUI-launched PATHs.
func UnixPackageManagerBinCandidates(home string, names ...string) []string {
	if home == "" {
		return nil
	}
	out := make([]string, 0, len(names)*7)
	for _, name := range names {
		out = append(out,
			filepath.Join(string(filepath.Separator), "home", "linuxbrew", ".linuxbrew", "bin", name),
			filepath.Join(string(filepath.Separator), "snap", "bin", name),
			filepath.Join(home, ".bun", "bin", name),
			filepath.Join(home, ".yarn", "bin", name),
			filepath.Join(home, ".config", "yarn", "global", "node_modules", ".bin", name),
			filepath.Join(home, ".local", "share", "mise", "shims", name),
			filepath.Join(home, ".asdf", "shims", name),
		)
	}
	return out
}

// WindowsPackageManagerBinCandidates returns cheap, deterministic user/system
// package-manager shim paths that are commonly absent from service PATHs.
func WindowsPackageManagerBinCandidates(names ...string) []string {
	home, _ := os.UserHomeDir()
	appData := os.Getenv("APPDATA")
	localAppData := os.Getenv("LOCALAPPDATA")
	programFiles := os.Getenv("ProgramFiles")
	programFilesX86 := os.Getenv("ProgramFiles(x86)")
	programData := os.Getenv("ProgramData")
	if programData == "" {
		programData = os.Getenv("PROGRAMDATA")
	}
	voltaHome := os.Getenv("VOLTA_HOME")
	nvmSymlink := os.Getenv("NVM_SYMLINK")
	out := make([]string, 0, len(names)*8)
	for _, name := range names {
		if home != "" {
			out = append(out,
				filepath.Join(home, "scoop", "shims", name+".exe"),
				filepath.Join(home, "scoop", "shims", name+".cmd"),
				filepath.Join(home, ".local", "bin", name+".exe"),
				filepath.Join(home, ".local", "bin", name+".cmd"),
			)
		}
		if appData != "" {
			out = append(out,
				filepath.Join(appData, "npm", name+".cmd"),
				filepath.Join(appData, "npm", name+".exe"),
				filepath.Join(appData, "npm", name),
			)
		}
		if programData != "" {
			out = append(out,
				filepath.Join(programData, "chocolatey", "bin", name+".exe"),
				filepath.Join(programData, "chocolatey", "bin", name+".bat"),
				filepath.Join(programData, "chocolatey", "bin", name+".cmd"),
			)
		}
		if localAppData != "" 
```

### Core Architecture Module: `backend/internal/adapters/agent/claudecode/hooks.go`
```
package claudecode

import (
	"context"
	"path/filepath"

	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/hooksjson"
	"github.com/aoagents/agent-orchestrator/backend/internal/ports"
)

const (
	claudeSettingsDirName   = ".claude"
	claudeSettingsFileName  = "settings.local.json"
	claudeHookCommandPrefix = "ao hooks claude-code "
	claudeHookTimeout       = 30
)

// claudeSessionStartMatcher is referenced by pointer so SessionStart serializes
// with Claude's documented source matcher. "startup" alone misses --resume
// relaunches (and /clear, compact, fork), so the native session id is not
// confirmed under the new RuntimeLaunchID until the next user prompt (#4122).
var claudeSessionStartMatcher = "startup|resume|clear|compact|fork"

// claudeManagedHooks is the source of truth for the hooks AO installs:
// SessionStart (startup/resume/clear/compact/fork), UserPromptSubmit, the tool-use
// trio (PreToolUse, PostToolUse, PostToolUseFailure), PermissionRequest,
// Stop, Notification, and SessionEnd. They report normalized session metadata
// and activity-state signals back into AO's store (see DeriveActivityState).
// Notification and SessionEnd carry no matcher: each installs once and fires
// for every sub-type, and the handler filters on the payload's
// notification_type / reason field. The tool-use hooks also carry no matcher
// (fire for every tool): their payloads carry tool_name/tool_use_id, which
// lifecycle uses to clear a stale sticky `blocked` only when the specific
// approved tool finishes — the daemon-side precedence rule is what makes these
// signals safe against parallel-subagent traffic (the naive mapping without it
// was reverted in PR #5's review). PermissionRequest fires when a permission
// dialog appears and carries the blocking tool_name; for worker sessions
// `ao hooks` writes nothing to stdout, so installing it never injects a
// permission decision. Headless reviewer sessions (AO_REVIEW_SESSION_ID set)
// are the one exception: nobody can answer the dialog there, so the hook
// replies with an allow/deny decision (see cli.reviewerPermissionDecision, #4810).
var claudeManagedHooks = []hooksjson.HookSpec{
	{Event: "SessionStart", Matcher: &claudeSessionStartMatcher, Command: claudeHookCommandPrefix + "session-start"},
	{Event: "UserPromptSubmit", Command: claudeHookCommandPrefix + "user-prompt-submit"},
	{Event: "PreToolUse", Command: claudeHookCommandPrefix + "pre-tool-use"},
	{Event: "PostToolUse", Command: claudeHookCommandPrefix + "post-tool-use"},
	{Event: "PostToolUseFailure", Command: claudeHookCommandPrefix + "post-tool-use-failure"},
	{Event: "PermissionRequest", Command: claudeHookCommandPrefix + "permission-request"},
	{Event: "Stop", Command: claudeHookCommandPrefix + "stop"},
	{Event: "Notification", Command: claudeHookCommandPrefix + "notification"},
	{Event: "SubagentStart", Command: claudeHookCommandPrefix + "subagent-start"},
	{Event: "SubagentStop", Command: claudeHookCommandPrefix + "subagent-stop"},
	{Event: "SessionEnd", Command: claudeHookCommandPrefix + "session-end"},
}

// claudeHooks manages AO's hooks in the workspace-local
// .claude/settings.local.json file.
var claudeHooks = hooksjson.Manager{
	Label:                 "claude-code",
	CommandPrefix:         claudeHookCommandPrefix,
	LegacyCommandPrefixes: []string{"ao hooks continue "},
	Timeout:               claudeHookTimeout,
	Path:                  claudeSettingsPath,
	Managed:               claudeManagedHooks,
}

func claudeSettingsPath(workspacePath string) string {
	return filepath.Join(workspacePath, claudeSettingsDirName, claudeSettingsFileName)
}

// GetAgentHooks installs AO's Claude Code hooks, preserving user-defined hooks and unrelated settings.
func (p *Plugin) GetAgentHooks(ctx context.Context, cfg ports.WorkspaceHookConfig) error {
	return claudeHooks.Install(ctx, cfg.WorkspacePath)
}

// UninstallHooks removes AO's Claude Code hooks, leaving user-defined hooks untouched.
func (p *Plugin) UninstallHooks(ctx context.Context, workspacePath string) error {
	return claudeHooks.Uninstall(ctx, workspacePath)
}

// AreHooksInstalled reports whether any AO Claude Code hook is present.
func (p *Plugin) AreHooksInstalled(ctx context.Context, workspacePath string) (bool, error) {
	return claudeHooks.AreInstalled(ctx, workspacePath)
}

```

### Core Architecture Module: `backend/internal/adapters/agent/cline/hooks.go`
```
package cline

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/hookutil"
	"github.com/aoagents/agent-orchestrator/backend/internal/ports"
)

// Cline's hook system is git-style: each lifecycle hook is an executable script
// placed in the workspace-local `.clinerules/hooks/` directory, named exactly
// after the hook event, reading a JSON payload on stdin and writing a JSON
// result on stdout (see docs.cline.bot hooks reference).
//
// The script naming is platform-dependent. On Unix, Cline discovers and runs an
// extensionless script named after the event (`TaskStart`) via its shebang. On
// Windows, Cline only discovers `<Event>.ps1` and runs it via
// `powershell -File` (its VS Code hook discovery intentionally ignores
// extensionless files on Windows, and the SDK maps `.ps1` to PowerShell), so AO
// writes `<Event>.ps1` there. Writing the Unix form on Windows leaves the hooks
// undiscovered: no activity callbacks fire and no native session id is ever
// captured (see issue #4976).
//
// AO installs one wrapper script per managed event. Each script forwards the
// hook payload to `ao hooks cline <subcommand>` and emits the no-op
// continuation result Cline expects. Scripts carry a marker line (a comment in
// both bash and PowerShell) so install is idempotent and uninstall recognizes
// AO-owned scripts without an embedded template to diff against; user-authored
// hooks (lacking the marker) are never touched.
const (
	clineHooksDirName = ".clinerules"
	clineHooksSubDir  = "hooks"

	// clineHookCommandPrefix identifies the hook commands AO owns. The CLI hook
	// dispatcher routes "ao hooks cline <subcommand>" to DeriveActivityState.
	clineHookCommandPrefix = "ao hooks cline "

	// clineHookMarker tags AO-generated hook scripts so install/uninstall can
	// distinguish them from user-authored Cline hooks in the same directory.
	// It is a comment line in both bash and PowerShell.
	clineHookMarker = "# ao-managed-cline-hook"
)

// clineHookSpec describes one hook AO installs: the native Cline hook event
// (used as the script's filename) and the AO sub-command its wrapper forwards
// to (used by DeriveActivityState).
type clineHookSpec struct {
	// Event is the native Cline hook name, which is also the script filename.
	Event string
	// Subcommand is the fixed AO hook sub-command name the wrapper invokes.
	Subcommand string
}

// clineManagedHooks is the source of truth for the hooks AO installs. The
// native Cline events are mapped onto AO's fixed sub-command names so activity
// derivation stays uniform across adapters:
//   - TaskStart        -> session-start       (a new task begins: active)
//   - UserPromptSubmit -> user-prompt-submit  (user message submitted: active)
//   - PreToolUse       -> permission-request  (about to act: approval point)
//   - TaskCancel       -> stop                (task cancelled/aborted: idle)
//   - TaskComplete     -> stop                (task completed normally: idle)
var clineManagedHooks = []clineHookSpec{
	{Event: "TaskStart", Subcommand: "session-start"},
	{Event: "UserPromptSubmit", Subcommand: "user-prompt-submit"},
	{Event: "PreToolUse", Subcommand: "permission-request"},
	{Event: "TaskCancel", Subcommand: "stop"},
	{Event: "TaskComplete", Subcommand: "stop"},
}

// GetAgentHooks installs AO's Cline hook scripts into the worktree-local
// `.clinerules/hooks/` directory. Existing user-authored hook scripts are
// preserved, and re-running install simply rewrites AO-owned scripts in place.
func (p *Plugin) GetAgentHooks(ctx context.Context, cfg ports.WorkspaceHookConfig) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if strings.TrimSpace(cfg.WorkspacePath) == "" {
		return errors.New("cline.GetAgentHooks: WorkspacePath is required")
	}

	hooksDir := clineHooksDir(cfg.WorkspacePath)
	if err := os.MkdirAll(hooksDir, 0o750); err != nil {
		return fmt.Errorf("cline.GetAgentHooks: create hook dir: %w", err)
	}

	// Only scripts AO actually wrote go into the workspace .gitignore: a
	// user-authored script at one of these paths must keep counting as dirt so
	// workspace teardown preserves it.
	written := make([]string, 0, len(clineManagedHooks))
	for _, spec := range clineManagedHooks {
		scriptPath := filepath.Join(hooksDir, clineHookScriptName(spec.Event))
		// Never clobber a user-authored hook with the same event name.
		if hookutil.FileExists(scriptPath) && !isManagedClineHook(scriptPath) {
			continue
		}
		script := renderClineHookScript(spec.Subcommand)
		if err := hookutil.AtomicWriteFile(scriptPath, []byte(script), 0o700); err != nil {
			return fmt.Errorf("cline.GetAgentHooks: write %s: %w", spec.Event, err)
		}
		written = append(written, clineHookScriptName(spec.Event))
	}
	// Drop pre-fix marker-owned scripts under the other platform's name (on
	// Windows, the extensionless bash form written before .ps1 discovery was
	// understood). Without this, upgrade-seeded worktrees keep the old files
	// as untracked entries once .gitignore is rewritten with only the new
	// names, leaving the worktree dirty and blocking normal teardown.
	// User-authored files at the legacy path (no marker) are never touched.
	for _, spec := range clineManagedHooks {
		legacy := clineLegacyScriptName(spec.Event)
		if legacy == clineHookScriptName(spec.Event) {
			continue
		}
		legacyPath := filepath.Join(hooksDir, legacy)
		if hookutil.FileExists(legacyPath) && isManagedClineHook(legacyPath) {
			if err := os.Remove(legacyPath); err != nil && !errors.Is(err, os.ErrNotExist) {
				return fmt.Errorf("cline.GetAgentHooks: remove legacy %s: %w", spec.Event, err)
			}
		}
	}
	if err := hookutil.EnsureWorkspaceGitignore(hooksDir, written...); err != nil {
		return fmt.Errorf("cline.GetAgentHooks: gitignore: %w", err)
	}
	return nil
}

// UninstallHooks removes AO's Cline hook scripts from the workspace-local
// `.clinerules/hooks/` directory, leaving user-authored hooks untouched. A
// missing directory is a no-op.
func (p *Plugin) UninstallHooks(ctx context.Context, workspacePath string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if strings.TrimSpace(workspacePath) == "" {
		return errors.New("cline.UninstallHooks: workspacePath is required")
	}

	hooksDir := clineHooksDir(workspacePath)
	if _, err := os.Stat(hooksDir); errors.Is(err, os.ErrNotExist) {
		return nil
	}

	for _, spec := range clineManagedHooks {
		for _, name := range clineAllScriptNames(spec.Event) {
			scriptPath := filepath.Join(hooksDir, name)
			if !hookutil.FileExists(scriptPath) || !isManagedClineHook(scriptPath) {
				continue
			}
			if err := os.Remove(scriptPath); err != nil && !errors.Is(err, os.ErrNotExist) {
				return fmt.Errorf("cline.UninstallHooks: remove %s: %w", spec.Event, err)
			}
		}
	}
	return nil
}

// AreHooksInstalled reports whether any AO Cline hook script is present in the
// workspace-local hooks directory. A missing directory means none.
func (p *Plugin) AreHooksInstalled(ctx context.Context, workspacePath string) (bool, error) {
	if err := ctx.Err(); err != nil {
		return false, err
	}
	if strings.TrimSpace(workspacePath) == "" {
		return false, errors.New("cline.AreHooksInstalled: workspacePath is required")
	}

	hooksDir := clineHooksDir(workspacePath)
	if _, err := os.Stat(hooksDir); errors.Is(err, os.ErrNotExist) {
		return false, nil
	}

	for _, spec := range clineManagedHooks {
		for _, name := range clineAllScriptNames(spec.Event) {
			scriptPath := filepath.Join(hooksDir, name)
			if hookutil.FileExists(scriptPath) && isManagedClineHook(scriptPath) {
				return true, nil
			}
		}
	}
	return false, nil
}

func clineHooksDir(workspacePath string) string {
	return filepath.Join(workspacePath, clineHooksDirName, clineHooksSubDir)
}

// clineHookScriptName returns the script filename Cline discovers for a hook
// event on the current platform: extensionless on Unix, `<Event>.ps1` on
// Windows (see the package comment for why).
func clineHookScriptName(event string) string {
	if runtime.GOOS == "windows" {
		return event + ".ps1"
	}
	return event
}

// clineLegacyScriptName returns the filename a pre-fix install wrote for the
// event on the other platform: the extensionless bash form on Windows, the
// `.ps1` form on Unix (for Windows-created workspaces moved across platforms).
func clineLegacyScriptName(event string) string {
	if runtime.GOOS == "windows" {
		return event
	}
	return event + ".ps1"
}

// clineAllScriptNames returns every filename AO may have written for the event
// (current platform first, legacy second) so install migration, uninstall, and
// installed-detection all recognize pre-fix workspaces.
func clineAllScriptNames(event string) []string {
	current := clineHookScriptName(event)
	legacy := clineLegacyScriptName(event)
	if legacy == current {
		return []string{current}
	}
	return []string{current, legacy}
}

// renderClineHookScript builds an executable wrapper that forwards the Cline
// hook payload (JSON on stdin) to the AO CLI hook dispatcher and prints the
// no-op continuation result Cline expects ({"cancel": false}). The marker line
// identifies it as AO-owned. The script dialect follows the platform: bash on
// Unix, PowerShell on Windows.
func renderClineHookScript(subcommand string) string {
	if runtime.GOOS == "windows" {
		return renderPowerShellClineHookScript(subcommand)
	}
	return renderBashClineHookScript(subcommand)
}

func renderBashClineHookScript(subcommand string) string {
	var b strings.Builder
	b.WriteString("#!/usr/bin/env bash\n")
	b.WriteString(clineHookMarker + "\n")
	// Forward stdin to the AO dispatcher; ignore its exit code so a missing/old
	// `ao` binary can never block Cline's own execution.
	b.WriteString(clineHookCommandPrefix + subcommand + " || true\n")
	// Cline requires a JSON result on stdout; never block the agent.
	b.WriteString(`echo '{"cancel": false}'` + "\n")
	return b.String()
```

### Core Architecture Module: `backend/internal/adapters/agent/codex/hooks.go`
```
package codex

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/hookutil"
	"github.com/aoagents/agent-orchestrator/backend/internal/ports"
	"github.com/aoagents/agent-orchestrator/backend/pkg/agentruntime"
)

// Codex (0.136+) never loads hook config from AO's per-session worktrees, so
// AO's hooks ride the launch command as `-c` session-flag config instead of
// workspace files:
//
//   - Project-local `.codex/` layers only load when the directory is trusted,
//     and for linked git worktrees Codex sources hook declarations from the
//     matching `.codex/` folder in the ROOT checkout, not the worktree. A
//     hooks.json written into an AO worktree is therefore dead config.
//   - Hooks passed as `-c 'hooks.<Event>=[...]'` land in Codex's session-flags
//     config layer, which is not trust-gated and aggregates with (never
//     replaces) the user's own hooks from `~/.codex`. They carry no persisted
//     trust hash, so the launch command also passes
//     `--dangerously-bypass-hook-trust` to let them run.
const (
	codexHooksDirName  = ".codex"
	codexHooksFileName = "hooks.json"

	// codexHookCommandPrefix identifies the hook commands AO owns, so the
	// legacy-file cleanup and uninstall recognize AO entries by prefix
	// without an embedded template to diff against.
	codexHookCommandPrefix = "ao hooks codex "
	// codexHookTimeout caps how long Codex waits on one AO hook callback. The
	// callback is a loopback POST that normally returns in milliseconds; a
	// tight cap keeps a hung daemon from stalling the agent's turn.
	codexHookTimeout = 5
)

// codexHookFile is the on-disk shape of .codex/hooks.json. It is used by tests
// to decode the written file.
type codexHookFile struct {
	Hooks map[string][]codexMatcherGroup `json:"hooks"`
}

type codexMatcherGroup struct {
	Matcher *string          `json:"matcher,omitempty"`
	Hooks   []codexHookEntry `json:"hooks"`
}

type codexHookEntry struct {
	Type    string `json:"type"`
	Command string `json:"command"`
	Timeout int    `json:"timeout,omitempty"`
}

// codexHookSpec describes one hook AO delivers via launch-command config.
type codexHookSpec struct {
	Event   string
	Command string
	Matcher string
}

// codexManagedHooks is the source of truth for the hooks AO delivers. Event
// names must not contain dots: they are spliced into a dotted `-c` key path,
// and Codex splits that path on every dot without honoring quoting.
var codexManagedHooks = []codexHookSpec{
	{Event: "SessionStart", Command: codexHookCommandPrefix + "session-start"},
	{Event: "UserPromptSubmit", Command: codexHookCommandPrefix + "user-prompt-submit"},
	{Event: "PermissionRequest", Command: codexHookCommandPrefix + "permission-request"},
	// Current Codex emits the canonical `spawn_agent` tool name. Keep the
	// historical collaboration alias while older installed Codex builds drain
	// their sessions, so both payloads reach the parser.
	{Event: "PostToolUse", Command: codexHookCommandPrefix + "post-tool-use", Matcher: "^(spawn_agent|collaborationspawn_agent)$"},
	{Event: "SubagentStart", Command: codexHookCommandPrefix + "subagent-start"},
	{Event: "SubagentStop", Command: codexHookCommandPrefix + "subagent-stop"},
	{Event: "Stop", Command: codexHookCommandPrefix + "stop"},
}

// appendSessionHookFlags adds AO's activity hooks to the argv as `-c`
// session-flag config, one flag per managed event. Codex executes command
// hooks through a login shell, which may replace PATH, so every hook invokes
// this exact AO executable instead of relying on a bare `ao` lookup.
func appendSessionHookFlags(cmd *[]string) error {
	executable, err := os.Executable()
	if err != nil {
		return fmt.Errorf("resolve AO hook executable: %w", err)
	}
	if !filepath.IsAbs(executable) {
		executable, err = filepath.Abs(executable)
		if err != nil {
			return fmt.Errorf("make AO hook executable absolute: %w", err)
		}
	}
	appendSessionHookFlagsForExecutable(cmd, executable)
	return nil
}

func appendSessionHookFlagsForExecutable(cmd *[]string, executable string) {
	prefix := shellQuoteHookExecutable(executable) + " hooks codex "
	for _, spec := range codexManagedHooks {
		action := strings.TrimPrefix(spec.Command, codexHookCommandPrefix)
		matcher := ""
		if spec.Matcher != "" {
			matcher = "matcher=" + codexTOMLBasicString(spec.Matcher) + ","
		}
		flag := fmt.Sprintf(`hooks.%s=[{%shooks=[{type="command",command=%s,timeout=%d}]}]`,
			spec.Event, matcher, codexTOMLBasicString(prefix+action), codexHookTimeout)
		*cmd = append(*cmd, "-c", flag)
	}
}

func shellQuoteHookExecutable(executable string) string {
	if runtime.GOOS == "windows" {
		// Codex invokes command hooks through PowerShell on Windows. A bare quoted
		// path (`"C:\...\ao.exe"`) parses as a string expression, not an invocation,
		// so SessionStart/UserPromptSubmit/Stop all fail before ao.exe runs
		// ("Unexpected token 'hooks'"). Prefixing the quoted path with the call
		// operator `& ` turns it into a command invocation that runs the binary.
		return `& "` + executable + `"`
	}
	return `'` + strings.ReplaceAll(executable, `'`, `'"'"'`) + `'`
}

// appendWorkspaceTrustFlag marks the session's worktree as a trusted Codex
// project for this invocation only, so spawns into never-before-trusted repos
// don't hang on the interactive "Do you trust this directory?" prompt.
//
// The override is shaped as a single `projects={...}` value (not a dotted
// `projects."<path>".trust_level` key) because Codex splits `-c` key paths on
// every dot without honoring quoted segments, which corrupts path keys. The
// inline table deep-merges with the user's persisted projects map. Both the
// literal and symlink-resolved paths are trusted because Codex looks trust up
// by the canonicalized cwd first and the literal path second (on macOS the two
// commonly differ, e.g. /tmp vs /private/tmp).
func appendWorkspaceTrustFlag(cmd *[]string, workspacePath string) {
	*cmd = append(*cmd, agentruntime.CodexWorkspaceTrustArgs(workspacePath)...)
}

func codexTOMLConfigString(s string) string {
	if !containsTOMLControl(s) && !strings.Contains(s, "'") {
		return codexTOMLLiteralString(s)
	}
	return codexTOMLBasicString(s)
}

func codexTOMLLiteralString(s string) string {
	return "'" + s + "'"
}

// codexTOMLBasicString renders s as a TOML basic string, escaping backslashes
// and quotes (Windows paths) plus control characters so the value survives
// Codex's TOML parse of the `-c` override.
func codexTOMLBasicString(s string) string {
	var b strings.Builder
	b.WriteByte('"')
	for _, r := range s {
		switch {
		case r == '\\':
			b.WriteString(`\\`)
		case r == '"':
			b.WriteString(`\"`)
		case r < 0x20 || r == 0x7f:
			fmt.Fprintf(&b, `\u%04X`, r)
		default:
			b.WriteRune(r)
		}
	}
	b.WriteByte('"')
	return b.String()
}

func containsTOMLControl(s string) bool {
	for _, r := range s {
		if r < 0x20 || r == 0x7f {
			return true
		}
	}
	return false
}

// GetAgentHooks installs no active workspace files — Codex never loads them
// from AO's worktrees (see the package comment above); activity hooks ride the
// launch command instead. It strips hook entries that older AO versions wrote
// into the worktree-local .codex/hooks.json so reused or restored worktrees
// don't keep dead AO config, preserving user-defined hooks.
func (p *Plugin) GetAgentHooks(ctx context.Context, cfg ports.WorkspaceHookConfig) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if strings.TrimSpace(cfg.WorkspacePath) == "" {
		return errors.New("codex.GetAgentHooks: WorkspacePath is required")
	}
	if err := removeLegacyWorkspaceHooks(cfg.WorkspacePath); err != nil {
		return fmt.Errorf("codex.GetAgentHooks: %w", err)
	}
	return nil
}

// UninstallHooks removes AO's legacy Codex hooks from the workspace-local
// .codex/hooks.json file, leaving user-defined hooks untouched. A missing file
// is a no-op.
func (p *Plugin) UninstallHooks(ctx context.Context, workspacePath string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if strings.TrimSpace(workspacePath) == "" {
		return errors.New("codex.UninstallHooks: workspacePath is required")
	}
	if err := removeLegacyWorkspaceHooks(workspacePath); err != nil {
		return fmt.Errorf("codex.UninstallHooks: %w", err)
	}
	return nil
}

// removeLegacyWorkspaceHooks strips AO-owned entries from a workspace-local
// hooks.json left behind by older AO versions. Files without one are untouched.
func removeLegacyWorkspaceHooks(workspacePath string) error {
	hooksPath := codexHooksPath(workspacePath)
	if _, err := os.Stat(hooksPath); errors.Is(err, os.ErrNotExist) {
		return nil
	}
	topLevel, rawHooks, err := readCodexHooks(hooksPath)
	if err != nil {
		return err
	}

	changed := false
	for event, raw := range rawHooks {
		var groups []codexMatcherGroup
		if err := json.Unmarshal(raw, &groups); err != nil {
			return fmt.Errorf("parse %s hooks: %w", event, err)
		}
		kept := removeCodexManagedHooks(groups)
		if countCodexHooks(kept) == countCodexHooks(groups) {
			continue
		}
		changed = true
		if len(kept) == 0 {
			delete(rawHooks, event)
			continue
		}
		data, err := json.Marshal(kept)
		if err != nil {
			return fmt.Errorf("encode %s hooks: %w", event, err)
		}
		rawHooks[event] = data
	}
	if !changed {
		return nil
	}
	return writeCodexHooks(hooksPath, topLevel, rawHooks)
}

// AreHooksInstalled reports whether any legacy AO Codex hook is still present
// in the workspace-local hooks file. A missing file means none are installed.
func (p *Plugin) AreHooksInstalled(ctx context.Context, workspacePath string) (bool, error) {
	if err := ctx.Err(); err != nil {
		return false, err
	}
	if strings.TrimSpace(workspacePath) == "" {
		return false, errors.New("codex.AreHooksInstalled: workspacePath is required")
	}

	hooksPath := codexHooksPath(workspacePath)
	if _, err := os.Stat(hooksPath); errors.Is(err, os.ErrNotExist)
```

### Core Architecture Module: `backend/internal/adapters/agent/copilot/hooks.go`
```
package copilot

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/hookutil"
	"github.com/aoagents/agent-orchestrator/backend/internal/ports"
)

const (
	// copilotHooksDir is the repository-scope hooks directory Copilot CLI reads
	// (.github/hooks/*.json). AO writes a single dedicated file there so it never
	// disturbs other hook files the user or repo may ship.
	copilotHooksDir      = ".github/hooks"
	copilotHooksFileName = "ao.json"

	copilotAgentsDir = ".github/agents"

	// copilotHooksVersion is the schema version of the hooks file (Copilot uses 1).
	copilotHooksVersion = 1

	// copilotHookCommandPrefix identifies the hook commands AO owns, so install
	// skips duplicates and uninstall recognizes AO entries by prefix without an
	// embedded template to diff against. The CLI dispatcher routes
	// `ao hooks copilot <event>` to DeriveActivityState.
	copilotHookCommandPrefix = "ao hooks copilot "
	copilotHookTimeoutSec    = 30
)

// copilotHookFile is the on-disk shape of .github/hooks/ao.json. AO owns this
// dedicated file outright, so it only models the keys it manages (version,
// disableAllHooks, hooks); user-defined hooks live in their own .github/hooks/*
// files and are never touched.
type copilotHookFile struct {
	Version         int                           `json:"version"`
	DisableAllHooks *bool                         `json:"disableAllHooks,omitempty"`
	Hooks           map[string][]copilotHookEntry `json:"hooks"`
}

// copilotHookEntry is one hook command. Copilot entries carry separate bash and
// powershell command strings (both required for cross-platform), a type, an
// optional working dir, and a timeout in seconds.
type copilotHookEntry struct {
	Type       string `json:"type"`
	Bash       string `json:"bash,omitempty"`
	Powershell string `json:"powershell,omitempty"`
	Cwd        string `json:"cwd,omitempty"`
	TimeoutSec int    `json:"timeoutSec,omitempty"`
}

// copilotHookSpec describes one hook AO installs, defined in code rather than
// read from an embedded settings file.
type copilotHookSpec struct {
	// Event is the native Copilot camelCase event name (sessionStart, ...).
	Event string
	// Command is the AO sub-command suffix (session-start, ...). It is appended
	// to copilotHookCommandPrefix to form both the bash and powershell command,
	// and is the value DeriveActivityState switches on.
	Command string
}

// copilotManagedHooks is the source of truth for the hooks AO installs. The AO
// sub-command names (session-start, user-prompt-submit, permission-request,
// stop) are exactly what DeriveActivityState in activity.go switches on.
//
// Native event names use Copilot's camelCase form, taken verbatim from
// https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-hooks
// (sessionStart, sessionEnd, userPromptSubmitted, preToolUse, postToolUse,
// errorOccurred, agentStop). Copilot does not document a "permissionRequest"
// event — the closest signal that AO's permission-request sub-command can
// piggyback on is preToolUse, which fires before any tool invocation, including
// the ones that would otherwise prompt the user for approval. This is a
// many-to-one collapse: every preToolUse currently produces ActivityWaitingInput
// via the permission-request sub-command. agentStop is the per-turn completion
// signal and maps to the "stop" sub-command (turn end → idle).
var copilotManagedHooks = []copilotHookSpec{
	{Event: "sessionStart", Command: "session-start"},
	{Event: "userPromptSubmitted", Command: "user-prompt-submit"},
	{Event: "preToolUse", Command: "permission-request"},
	{Event: "agentStop", Command: "stop"},
}

// InstallAgentProfile installs only AO's per-session Copilot custom-agent
// profile. Reviewers use this directly because their lifecycle is owned by the
// review launcher, not the worker activity hooks.
func (p *Plugin) InstallAgentProfile(ctx context.Context, cfg ports.WorkspaceHookConfig) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if strings.TrimSpace(cfg.WorkspacePath) == "" {
		return errors.New("copilot.InstallAgentProfile: WorkspacePath is required")
	}
	if err := installCopilotAgent(cfg.WorkspacePath, cfg.SessionID, cfg.SystemPrompt, cfg.SystemPromptFile); err != nil {
		return fmt.Errorf("copilot.InstallAgentProfile: %w", err)
	}
	return nil
}

// GetAgentHooks installs AO's Copilot workspace integration:
//   - .github/agents/ao-<session>.agent.md for an explicit per-session role.
//   - .github/hooks/ao.json for normalized activity-state signals.
//
// The launch command selects that profile with --agent=ao-<session>. Avoid
// writing a repository-root AGENTS.md here so AO does not compete with
// project-owned instructions.
func (p *Plugin) GetAgentHooks(ctx context.Context, cfg ports.WorkspaceHookConfig) error {
	if err := p.InstallAgentProfile(ctx, cfg); err != nil {
		return fmt.Errorf("copilot.GetAgentHooks: %w", err)
	}
	if err := installCopilotHooks(cfg.WorkspacePath); err != nil {
		return fmt.Errorf("copilot.GetAgentHooks: %w", err)
	}
	return nil
}

func installCopilotHooks(workspacePath string) error {
	hooksPath := copilotHooksPath(workspacePath)
	file, err := readCopilotHooks(hooksPath)
	if err != nil {
		return err
	}

	if file.Hooks == nil {
		file.Hooks = map[string][]copilotHookEntry{}
	}
	for _, spec := range copilotManagedHooks {
		command := copilotHookCommandPrefix + spec.Command
		if copilotHookCommandExists(file.Hooks[spec.Event], command) {
			continue
		}
		file.Hooks[spec.Event] = append(file.Hooks[spec.Event], copilotHookEntry{
			Type:       "command",
			Bash:       command,
			Powershell: command,
			TimeoutSec: copilotHookTimeoutSec,
		})
	}

	if err := writeCopilotHooks(hooksPath, file); err != nil {
		return err
	}
	if err := hookutil.EnsureWorkspaceGitignore(filepath.Dir(hooksPath), copilotHooksFileName); err != nil {
		return fmt.Errorf("gitignore: %w", err)
	}
	return nil
}

func installCopilotAgent(workspacePath, sessionID, inlinePrompt, promptFile string) error {
	systemPrompt, err := copilotSystemPromptText(inlinePrompt, promptFile)
	if err != nil {
		return err
	}
	agentName := copilotAgentName(sessionID, inlinePrompt, promptFile)
	if systemPrompt == "" || agentName == "" {
		return nil
	}
	agentPath := filepath.Join(workspacePath, copilotAgentsDir, agentName+".agent.md")
	existing, err := os.ReadFile(agentPath) //nolint:gosec // path built from caller-owned workspace dir
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("read %s: %w", agentPath, err)
	}
	if err == nil && !strings.Contains(string(existing), hookutil.CopilotAgentProfileSentinel) {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(agentPath), 0o750); err != nil {
		return fmt.Errorf("create %s: %w", filepath.Dir(agentPath), err)
	}
	body := copilotAgentProfile(agentName, sessionID, systemPrompt)
	if err := hookutil.AtomicWriteFile(agentPath, []byte(body), 0o600); err != nil {
		return fmt.Errorf("write %s: %w", agentPath, err)
	}
	if err := ignoreCopilotPath(workspacePath, "/"+filepath.ToSlash(filepath.Join(copilotAgentsDir, agentName+".agent.md"))); err != nil {
		return fmt.Errorf("git exclude: %w", err)
	}
	return nil
}

func copilotAgentProfile(agentName, sessionID, systemPrompt string) string {
	return "---\n" +
		"name: " + agentName + "\n" +
		"description: Agent Orchestrator role profile for AO session " + strings.TrimSpace(sessionID) + ". Use for all work in this session.\n" +
		"target: github-copilot\n" +
		"---\n\n" +
		hookutil.CopilotAgentProfileSentinel + "\n\n" +
		strings.TrimRight(systemPrompt, "\n") + "\n"
}

func ignoreCopilotPath(workspacePath, pattern string) error {
	gitDir, err := workspaceGitCommonDir(workspacePath)
	if err != nil {
		return err
	}
	if strings.TrimSpace(gitDir) == "" {
		return nil
	}
	excludePath := filepath.Join(gitDir, "info", "exclude")
	data, err := os.ReadFile(excludePath) //nolint:gosec // path derived from the workspace .git metadata
	if err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("read %s: %w", excludePath, err)
	}
	pattern = strings.TrimSpace(pattern)
	if pattern == "" || strings.Contains(string(data), pattern) {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(excludePath), 0o750); err != nil {
		return fmt.Errorf("create %s: %w", filepath.Dir(excludePath), err)
	}
	body := strings.TrimRight(string(data), "\n")
	if body != "" {
		body += "\n"
	}
	body += "# agent-orchestrator Copilot session files\n" + pattern + "\n"
	if err := hookutil.AtomicWriteFile(excludePath, []byte(body), 0o600); err != nil {
		return fmt.Errorf("write %s: %w", excludePath, err)
	}
	return nil
}

func workspaceGitCommonDir(workspacePath string) (string, error) {
	gitPath := filepath.Join(workspacePath, ".git")
	info, err := os.Stat(gitPath)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return "", nil
		}
		return "", fmt.Errorf("stat %s: %w", gitPath, err)
	}
	if info.IsDir() {
		return gitCommonDir(gitPath)
	}
	data, err := os.ReadFile(gitPath) //nolint:gosec // path built from caller-owned workspace dir
	if err != nil {
		return "", fmt.Errorf("read %s: %w", gitPath, err)
	}
	text := strings.TrimSpace(string(data))
	const prefix = "gitdir:"
	if !strings.HasPrefix(text, prefix) {
		return "", nil
	}
	dir := strings.TrimSpace(strings.TrimPrefix(text, prefix))
	if dir == "" {
		return "", nil
	}
	if filepath.IsAbs(dir) {
		return gitCommonDir(dir)
	}
	return gitCommonDir(filepath.Clean(filepath.Join(workspacePath, dir)))
}

func gitCommonDir(gitDir string) (string, error) {
	commonPath := filepath.Join(gitDir, "commondir")
	data, err := os.ReadFile(commonPath) //nolint:gosec // path derived from the workspace .git metadata
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return gitDir, nil
		}
		return "", fmt.Errorf("read %s: %w", commonPath, err)
	}
	dir := strings.TrimSpace(string(data))
	if dir ==
```

### Core Architecture Module: `backend/internal/adapters/agent/crush/hooks.go`
```
package crush

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/hookutil"
	"github.com/aoagents/agent-orchestrator/backend/internal/ports"
)

const (
	crushConfigDirName      = ".crush"
	crushConfigFileName     = ".crush.json"
	crushSystemPromptName   = "ao-system-prompt.md"
	crushSystemPromptPath   = crushConfigDirName + "/" + crushSystemPromptName
	crushSystemPromptMarker = "agent-orchestrator: managed crush system prompt"

	// crushModelSeparator splits AO's "<provider>/<model-id>" convention.
	// Crush's config schema (models.large / models.small) requires both a
	// provider id and a model id per selection; AO's AgentConfig.Model is a
	// single string, so Crush is the one adapter that needs a delimiter to
	// recover both parts (see mergeCrushModel).
	crushModelSeparator = "/"

	// crushModelType is the model type AO writes overrides into. Crush's
	// "large" model backs its main coder agent; AO has no equivalent of
	// Crush's separate "small"/task-agent model, so only large is managed.
	crushModelType = "large"
)

// GetAgentHooks installs AO's standing instructions as a Crush context file.
// Crush has no launch-time system-prompt flag, but it reads context_paths from
// project config. AO therefore owns one prompt file under .crush/ and merges
// only that path into the hidden project-local .crush.json.
func (p *Plugin) GetAgentHooks(ctx context.Context, cfg ports.WorkspaceHookConfig) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if strings.TrimSpace(cfg.WorkspacePath) == "" {
		return errors.New("crush.GetAgentHooks: WorkspacePath is required")
	}
	prompt, err := crushSystemPromptText(cfg.SystemPrompt, cfg.SystemPromptFile)
	if err != nil {
		return fmt.Errorf("crush.GetAgentHooks: %w", err)
	}
	if err := applyCrushModelOverride(cfg.WorkspacePath, cfg.Config.Model); err != nil {
		return fmt.Errorf("crush.GetAgentHooks: %w", err)
	}
	if strings.TrimSpace(prompt) == "" {
		return nil
	}

	promptPath := crushSystemPromptFile(cfg.WorkspacePath)
	if _, err := os.Stat(promptPath); err == nil {
		managed, err := isAOManagedCrushSystemPrompt(promptPath)
		if err != nil {
			return fmt.Errorf("crush.GetAgentHooks: %w", err)
		}
		if !managed {
			return fmt.Errorf("crush.GetAgentHooks: refusing to overwrite non-AO file at %s", promptPath)
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("crush.GetAgentHooks: stat system prompt: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(promptPath), 0o750); err != nil {
		return fmt.Errorf("crush.GetAgentHooks: create config dir: %w", err)
	}
	content := "<!-- " + crushSystemPromptMarker + " -->\n\n" + strings.TrimRight(prompt, "\n") + "\n"
	if err := hookutil.AtomicWriteFile(promptPath, []byte(content), 0o600); err != nil {
		return fmt.Errorf("crush.GetAgentHooks: write system prompt: %w", err)
	}
	if err := mergeCrushContextPath(crushConfigFile(cfg.WorkspacePath), crushSystemPromptPath); err != nil {
		return fmt.Errorf("crush.GetAgentHooks: merge config: %w", err)
	}
	if err := hookutil.EnsureWorkspaceGitignore(filepath.Dir(promptPath), crushSystemPromptName); err != nil {
		return fmt.Errorf("crush.GetAgentHooks: gitignore: %w", err)
	}
	return nil
}

// UninstallHooks removes AO's Crush context file and context_paths entry. User
// config is preserved; AO removes only its exact path and only deletes the
// prompt file when it carries the AO marker.
func (p *Plugin) UninstallHooks(ctx context.Context, workspacePath string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if strings.TrimSpace(workspacePath) == "" {
		return errors.New("crush.UninstallHooks: workspacePath is required")
	}
	promptPath := crushSystemPromptFile(workspacePath)
	managed, err := isAOManagedCrushSystemPrompt(promptPath)
	if err != nil {
		return fmt.Errorf("crush.UninstallHooks: %w", err)
	}
	if managed {
		if err := os.Remove(promptPath); err != nil && !errors.Is(err, os.ErrNotExist) {
			return fmt.Errorf("crush.UninstallHooks: remove system prompt: %w", err)
		}
	}
	if err := removeCrushContextPath(crushConfigFile(workspacePath), crushSystemPromptPath); err != nil {
		return fmt.Errorf("crush.UninstallHooks: merge config: %w", err)
	}
	return nil
}

// applyCrushModelOverride writes the role's configured model into
// .crush.json as the large-model selection, if one is set. It runs on every
// Spawn/Restore (prepareWorkspace calls GetAgentHooks before each launch), so
// a role's model config always reflects the project's current value and a
// later change takes effect on the session's next restore. An empty override
// leaves any model the user picked through Crush's own model picker alone.
func applyCrushModelOverride(workspacePath, modelOverride string) error {
	model := strings.TrimSpace(modelOverride)
	if model == "" {
		return nil
	}
	provider, modelID, ok := strings.Cut(model, crushModelSeparator)
	provider, modelID = strings.TrimSpace(provider), strings.TrimSpace(modelID)
	if ok && provider != "" && modelID != "" {
		return mergeCrushModel(crushConfigFile(workspacePath), provider, modelID)
	}
	if ok {
		slog.Default().Warn("crush: skipping model override because provider or model id is empty",
			"model", model)
		return nil
	}
	existingProvider, err := existingCrushModelProvider(crushConfigFile(workspacePath))
	if err != nil {
		return err
	}
	if existingProvider == "" {
		slog.Default().Warn("crush: skipping bare model override because .crush.json has no existing provider to reuse",
			"model", model)
		return nil
	}
	return mergeCrushModel(crushConfigFile(workspacePath), existingProvider, model)
}

// AreHooksInstalled reports whether AO's Crush system-prompt context file is
// present. Crush activity is terminal-derived, so this reports only the prompt
// injection hook surface AO manages for Crush.
func (p *Plugin) AreHooksInstalled(ctx context.Context, workspacePath string) (bool, error) {
	if err := ctx.Err(); err != nil {
		return false, err
	}
	if strings.TrimSpace(workspacePath) == "" {
		return false, errors.New("crush.AreHooksInstalled: workspacePath is required")
	}
	managed, err := isAOManagedCrushSystemPrompt(crushSystemPromptFile(workspacePath))
	if err != nil {
		return false, fmt.Errorf("crush.AreHooksInstalled: %w", err)
	}
	return managed, nil
}

func crushSystemPromptFile(workspacePath string) string {
	return filepath.Join(workspacePath, crushConfigDirName, crushSystemPromptName)
}

func crushConfigFile(workspacePath string) string {
	return filepath.Join(workspacePath, crushConfigFileName)
}

func crushSystemPromptText(inline, file string) (string, error) {
	if strings.TrimSpace(file) != "" {
		data, err := os.ReadFile(file) //nolint:gosec // path is AO-owned launch config
		if err != nil {
			return "", fmt.Errorf("read system prompt file: %w", err)
		}
		return strings.TrimRight(string(data), "\n"), nil
	}
	return strings.TrimRight(inline, "\n"), nil
}

func isAOManagedCrushSystemPrompt(path string) (bool, error) {
	data, err := os.ReadFile(path) //nolint:gosec // path built from caller-owned workspace dir
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("read %s: %w", path, err)
	}
	return strings.Contains(string(data), crushSystemPromptMarker), nil
}

func mergeCrushContextPath(configPath, contextPath string) error {
	cfg, err := readCrushConfig(configPath)
	if err != nil {
		return err
	}
	options := crushConfigObject(cfg, "options")
	paths := crushStringSlice(options["context_paths"])
	if !slices.Contains(paths, contextPath) {
		paths = append(paths, contextPath)
	}
	options["context_paths"] = paths
	cfg["options"] = options
	return writeCrushConfig(configPath, cfg)
}

// mergeCrushModel sets models.large.{model,provider} in the project's
// .crush.json, preserving any other keys already set on that selection (e.g.
// a user's max_tokens or temperature override) and any other top-level config
// (providers, options, other model type). AO owns only the model/provider
// identity fields it writes here.
func mergeCrushModel(configPath, provider, modelID string) error {
	cfg, err := readCrushConfig(configPath)
	if err != nil {
		return err
	}
	models := crushConfigObject(cfg, "models")
	selection := crushConfigObject(models, crushModelType)
	selection["model"] = modelID
	selection["provider"] = provider
	models[crushModelType] = selection
	cfg["models"] = models
	return writeCrushConfig(configPath, cfg)
}

func existingCrushModelProvider(configPath string) (string, error) {
	cfg, err := readCrushConfig(configPath)
	if err != nil {
		return "", err
	}
	models, ok := cfg["models"].(map[string]any)
	if !ok {
		return "", nil
	}
	selection, ok := models[crushModelType].(map[string]any)
	if !ok {
		return "", nil
	}
	provider, ok := selection["provider"].(string)
	if !ok {
		return "", nil
	}
	return strings.TrimSpace(provider), nil
}

func removeCrushContextPath(configPath, contextPath string) error {
	cfg, err := readCrushConfig(configPath)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	options, ok := cfg["options"].(map[string]any)
	if !ok {
		return nil
	}
	paths := crushStringSlice(options["context_paths"])
	next := paths[:0]
	for _, path := range paths {
		if path != contextPath {
			next = append(next, path)
		}
	}
	options["context_paths"] = next
	cfg["options"] = options
	return writeCrushConfig(configPath, cfg)
}

func readCrushConfig(path string) (map[string]any, error) {
	data, err := os.ReadFile(path) //nolint:gosec // path built from caller-owned workspace dir
	if errors.Is(err, os.ErrNotExist) {
		return map[string]any{}, nil
	}
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(string(data)) == "" {
		return map[string]any{}, nil
	}
	var cfg map[string]any
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("parse %s: %w", path, err)
	}
```

### Core Architecture Module: `backend/internal/adapters/agent/cursor/hooks.go`
```
package cursor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/hookutil"
	"github.com/aoagents/agent-orchestrator/backend/internal/ports"
)

const (
	cursorHooksDirName  = ".cursor"
	cursorHooksFileName = "hooks.json"
	cursorDataDirEnv    = "CURSOR_DATA_DIR"
	cursorProjectsDir   = "projects"
	cursorTrustStateDir = "cursor-trust"
	cursorTrustedFile   = ".workspace-trusted"

	// cursorHooksSchemaVersion is the version Cursor's hooks.json declares. AO
	// only sets it when creating a fresh file; an existing version is preserved.
	cursorHooksSchemaVersion = 1

	// cursorHookCommandPrefix identifies the hook commands AO owns, so
	// install skips duplicates and uninstall recognizes AO entries by
	// prefix without an embedded template to diff against.
	cursorHookCommandPrefix           = "ao hooks cursor "
	cursorLegacyPermissionHookCommand = cursorHookCommandPrefix + "permission-request"
)

// cursorHookFile is the on-disk shape of .cursor/hooks.json. It is used by tests
// to decode the written file. Cursor keys hooks by camelCase native event name.
type cursorHookFile struct {
	Version int                          `json:"version"`
	Hooks   map[string][]cursorHookEntry `json:"hooks"`
}

type cursorHookEntry struct {
	Command    string
	FailClosed bool
	raw        json.RawMessage
}

func (e *cursorHookEntry) UnmarshalJSON(data []byte) error {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		return err
	}
	e.raw = append(e.raw[:0], data...)
	e.Command = ""
	e.FailClosed = false
	_ = json.Unmarshal(fields["command"], &e.Command)
	_ = json.Unmarshal(fields["failClosed"], &e.FailClosed)
	return nil
}

func (e cursorHookEntry) MarshalJSON() ([]byte, error) {
	return e.raw, nil
}

func newCursorHookEntry(command string, failClosed bool) (cursorHookEntry, error) {
	commandJSON, err := json.Marshal(command)
	if err != nil {
		return cursorHookEntry{}, err
	}
	fields := map[string]json.RawMessage{"command": commandJSON}
	raw, err := json.Marshal(fields)
	if err != nil {
		return cursorHookEntry{}, err
	}
	entry := cursorHookEntry{Command: command, raw: raw}
	if err := entry.setFailClosed(failClosed); err != nil {
		return cursorHookEntry{}, err
	}
	return entry, nil
}

func (e *cursorHookEntry) setFailClosed(failClosed bool) error {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(e.raw, &fields); err != nil {
		return err
	}
	e.FailClosed = failClosed
	if failClosed {
		fields["failClosed"] = json.RawMessage("true")
	} else {
		delete(fields, "failClosed")
	}
	raw, err := json.Marshal(fields)
	if err != nil {
		return err
	}
	e.raw = raw
	return nil
}

// cursorHookSpec describes one hook AO installs, defined in code rather than
// read from an embedded hooks file. Event is Cursor's native camelCase event
// name; Command is the AO sub-command dispatched when the hook fires.
type cursorHookSpec struct {
	Event      string
	Command    string
	FailClosed bool
}

// cursorManagedHooks is the source of truth for the hooks AO installs. The
// native-event → AO-subcommand contract is FIXED: the orchestrator's CLI hook
// dispatch and activity.go agree on the sub-command names.
var cursorManagedHooks = []cursorHookSpec{
	{Event: "sessionStart", Command: cursorHookCommandPrefix + "session-start"},
	{Event: "beforeSubmitPrompt", Command: cursorHookCommandPrefix + "user-prompt-submit"},
	{Event: "stop", Command: cursorHookCommandPrefix + "stop"},
	{Event: "beforeShellExecution", Command: cursorHookCommandPrefix + "before-shell-execution", FailClosed: true},
	{Event: "beforeMCPExecution", Command: cursorHookCommandPrefix + "before-mcp-execution", FailClosed: true},
	{Event: "afterShellExecution", Command: cursorHookCommandPrefix + "after-shell-execution"},
	{Event: "afterMCPExecution", Command: cursorHookCommandPrefix + "after-mcp-execution"},
	{Event: "postToolUse", Command: cursorHookCommandPrefix + "post-tool-use"},
	{Event: "postToolUseFailure", Command: cursorHookCommandPrefix + "post-tool-use-failure"},
}

// GetAgentHooks installs AO's Cursor hooks into the worktree-local
// .cursor/hooks.json file. Existing hook entries are preserved and duplicate
// AO commands are not appended.
func (p *Plugin) GetAgentHooks(ctx context.Context, cfg ports.WorkspaceHookConfig) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if strings.TrimSpace(cfg.WorkspacePath) == "" {
		return errors.New("cursor.GetAgentHooks: WorkspacePath is required")
	}
	if err := ensureCursorWorkspaceTrusted(cfg); err != nil {
		slog.Default().Warn("cursor: failed to seed workspace trust; Cursor may show its trust prompt",
			"sessionID", cfg.SessionID, "workspacePath", cfg.WorkspacePath, "error", err)
	}

	hooksPath := cursorHooksPath(cfg.WorkspacePath)
	topLevel, rawHooks, err := readCursorHooks(hooksPath)
	if err != nil {
		return fmt.Errorf("cursor.GetAgentHooks: %w", err)
	}

	for event, specs := range groupCursorHooksByEvent() {
		var existing []cursorHookEntry
		if err := parseCursorHookEvent(rawHooks, event, &existing); err != nil {
			return fmt.Errorf("cursor.GetAgentHooks: %w", err)
		}
		existing = removeCursorLegacyPermissionHooks(event, existing)
		for _, spec := range specs {
			if index := cursorHookCommandIndex(existing, spec.Command); index >= 0 {
				if err := existing[index].setFailClosed(spec.FailClosed); err != nil {
					return fmt.Errorf("cursor.GetAgentHooks: update %s hook: %w", event, err)
				}
			} else {
				entry, err := newCursorHookEntry(spec.Command, spec.FailClosed)
				if err != nil {
					return fmt.Errorf("cursor.GetAgentHooks: create %s hook: %w", event, err)
				}
				existing = append(existing, entry)
			}
		}
		if err := marshalCursorHookEvent(rawHooks, event, existing); err != nil {
			return fmt.Errorf("cursor.GetAgentHooks: %w", err)
		}
	}

	if err := writeCursorHooks(hooksPath, topLevel, rawHooks); err != nil {
		return fmt.Errorf("cursor.GetAgentHooks: %w", err)
	}
	if err := hookutil.EnsureWorkspaceGitignore(filepath.Dir(hooksPath), cursorHooksFileName); err != nil {
		return fmt.Errorf("cursor.GetAgentHooks: gitignore: %w", err)
	}
	return nil
}

// InstallWorkspaceTrust seeds Cursor's workspace trust marker for callers that
// manage their own Cursor profile and do not install worker hooks.
func (p *Plugin) InstallWorkspaceTrust(ctx context.Context, cfg ports.WorkspaceHookConfig) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if strings.TrimSpace(cfg.WorkspacePath) == "" {
		return errors.New("cursor.InstallWorkspaceTrust: WorkspacePath is required")
	}
	if err := ensureCursorWorkspaceTrusted(cfg); err != nil {
		return fmt.Errorf("cursor.InstallWorkspaceTrust: %w", err)
	}
	return nil
}

// UninstallHooks removes AO's Cursor hooks from the workspace-local
// .cursor/hooks.json file, leaving user-defined hooks untouched. A missing file
// is a no-op.
func (p *Plugin) UninstallHooks(ctx context.Context, workspacePath string) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if strings.TrimSpace(workspacePath) == "" {
		return errors.New("cursor.UninstallHooks: workspacePath is required")
	}

	hooksPath := cursorHooksPath(workspacePath)
	if _, err := os.Stat(hooksPath); errors.Is(err, os.ErrNotExist) {
		return nil
	}
	topLevel, rawHooks, err := readCursorHooks(hooksPath)
	if err != nil {
		return fmt.Errorf("cursor.UninstallHooks: %w", err)
	}

	for _, event := range cursorManagedEvents() {
		var entries []cursorHookEntry
		if err := parseCursorHookEvent(rawHooks, event, &entries); err != nil {
			return fmt.Errorf("cursor.UninstallHooks: %w", err)
		}
		entries = removeCursorManagedHooks(entries)
		if err := marshalCursorHookEvent(rawHooks, event, entries); err != nil {
			return fmt.Errorf("cursor.UninstallHooks: %w", err)
		}
	}

	if err := writeCursorHooks(hooksPath, topLevel, rawHooks); err != nil {
		return fmt.Errorf("cursor.UninstallHooks: %w", err)
	}
	return nil
}

// CleanupWorkspace removes durable Cursor trust state that AO created after the
// corresponding session workspace was actually torn down. User-created trust
// decisions are preserved.
func (p *Plugin) CleanupWorkspace(ctx context.Context, cfg ports.WorkspaceHookConfig) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	if strings.TrimSpace(cfg.WorkspacePath) == "" {
		return errors.New("cursor.CleanupWorkspace: WorkspacePath is required")
	}
	if err := removeCursorWorkspaceTrust(cfg); err != nil {
		return fmt.Errorf("cursor.CleanupWorkspace: %w", err)
	}
	return nil
}

// AreHooksInstalled reports whether any AO Cursor hook is present in the
// workspace-local hooks file. A missing file means none are installed.
func (p *Plugin) AreHooksInstalled(ctx context.Context, workspacePath string) (bool, error) {
	if err := ctx.Err(); err != nil {
		return false, err
	}
	if strings.TrimSpace(workspacePath) == "" {
		return false, errors.New("cursor.AreHooksInstalled: workspacePath is required")
	}

	hooksPath := cursorHooksPath(workspacePath)
	if _, err := os.Stat(hooksPath); errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	_, rawHooks, err := readCursorHooks(hooksPath)
	if err != nil {
		return false, fmt.Errorf("cursor.AreHooksInstalled: %w", err)
	}

	for _, event := range cursorManagedEvents() {
		var entries []cursorHookEntry
		if err := parseCursorHookEvent(rawHooks, event, &entries); err != nil {
			return false, fmt.Errorf("cursor.AreHooksInstalled: %w", err)
		}
		for _, hook := range entries {
			if isCursorManagedHook(hook.Command) {
				return true, nil
			}
		}
	}
	return false, nil
}

func cursorHooksPath(workspacePath string) string {
	return filepath.Join(workspacePath, cursorHooksDirName, cursorHooksFileName)
}

type cursorWorkspaceTrust struct {
	TrustedAt     string `json:"trustedAt"`
	WorkspacePath string `json:"workspacePath"`
	TrustMethod   string `json:"trustMethod"`
	AOMa
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #6175** (2026-10-04): **fix(terminal): create shell PTYs at the new tab's measured grid**
  *Symptoms*: ## What  A new shell tab no longer shows a stray `%` above its first prompt. The tab's xterm mounts and measures itself before the shell exists, and the daemon creates the PTY at exactly that grid. The same xterm then attaches to the created PTY instead of being replaced.  **Stacked on #6174** (backend: optional `cols`/`rows` on create). Merge that first.  ## Why  The PTY used to start at a hardcoded 220×50 before any viewer attached. zsh padded its partial-line marker for 220 columns, so in a narrower panel the marker wrapped and the `%` was left on its own row. This follows Orca's approach: spawn a terminal only once its pane has measured its grid.  ## How  **Measure first, then create** (`eedab5e91`) - The pending tab mounts the real terminal, which fits and calls `AttachableTerminal.measureGrid()`. That returns xterm's own fit proposal, or `null` while the host can't be measured. - The open mutation waits for that grid, then `POST`s it as `cols`/`rows`. - When the shell is created, the terminal cache re-keys the pending entry to the created handle before any pane renders it. Portals use a stable `portalKey`, so the measured xterm carries on and attaches. - `lib/pending-shell-terminals.ts` coordinates the mutation, the pending terminal and the cache. If xterm can't start, the creation fails and the tab is dropped.  **Fixes found while testing the real desktop app** - **Parked terminals keep their grid** (`b1b3401a1`). With several tabs opened quickly, a tab hidden before i
  **Post-Mortem & Fix Analysis**:
  > ## 🏆 Review leaderboard  Sep 26, 2026–Oct 3, 2026 · UTC  | Rank | Reviewer | PRs reviewed | Review rounds | PR comments | | :---: | --- | ---: | ---: | ---: | | 🥇 | <img src="https://avatars.githubusercontent.com/u/44542765?u=4df62a1ca3b55473f46a507a586e3e4dddb019cc&v=4" width="24" height="24" alt="@illegalcall"> [@illegalcall](https://github.com/illegalcall) | 30 | 56 | 11 | | 🥈 | <img src="https://avatars.githubusercontent.com/u/64074505?u=cab8d4e9a8a4b5bf79fe10ff06ea4f69b5cb2264&v=4" width="24" height="24" alt="@ronishrohan"> [@ronishrohan](https://github.com/ronishrohan) | 28 | 37 | 7 | | 🥉 | <img src="https://avatars.githubusercontent.com/u/96230495?u=3ab7514bc4e9916975900c211456c546a0867d64&v=4" width="24" height="24" alt="@nikhilachale"> [@nikhilachale](https://github.com/nikhilachale) | 22 | 35 | 8 | | 4 | <img src="https://avatars.githubusercontent.com/u/85189266?u=2d441062124affd34b40b1adfc602c90672042ba&v=4" width="24" height="24" alt="@Prasad-D-Ware"> [@Prasad-D-Ware](h
  > Addressed review 5403341826 in 77b2b695e. Both P2 races are fixed, each with a test that fails without its fix:  - **Unmeasurable pending terminal:** measurement now retries each frame until the slot has geometry, then fits and reports. - **Duplicate pending row:** `onSuccess` drops the optimistic row when a refetch already listed the created shell.  Checks: `tsc` clean and the full frontend suite passes (376 files, 5,986 tests). In a production build of the combined branch, a close-and-reopen loop shows no chat flashes and new terminals reach the prompt at a median of about 134 ms.
  > Closing in favor of #6213. Instead of the renderer measuring a pending tab and then creating the PTY at that size (which needed client-side pending/handover state and kept producing rapid open/close edge cases), the daemon now creates the shell immediately and starts its process on the first sized attach. #6213 also includes the fast close (SIGHUP) and the rapid open/close fixes found while testing.

- **Issue #6167** (2026-10-03): **fix(desktop): restore terminal focus after switching session tabs**
  *Symptoms*: Code changes: +36 -3   Tests: +135 -0   Others: +0 -0  Closes #6140.  What Fix the desktop terminal losing keyboard focus after switching top-bar tabs within a session. Returning with Ctrl+Tab or a tab click restores the caret to the terminal prompt.  Renderer Retained terminals are blurred when parked. Focus restoration previously depended on a guarded autofocus attempt when `isVisible` changed. That attempt retried for only two frames and stopped when the terminal was parked again.  - Add `AttachableTerminal.requestActivationFocus`, a deferred focus request. `CachedTerminalPortal` calls it on each activation, and the callback checks the current visibility, focus intent, and focused control before restoring the caret. - Allow top-bar tab buttons and explicitly marked terminal actions to hand focus to the terminal. Dialogs, menus, text fields, and unrelated buttons still block automatic focus. - Raise `AUTOFOCUS_RETRY_FRAMES` from 2 to 6 so the visibility-driven attempt can retry after a transient focus holder clears. - Respect `focusRequested={false}` when the deferred callback runs. This preserves the opt-out for automatically opened login terminals and cancels a queued request if the caller revokes focus before it executes.  The two first-attach `prepareForActivation` call sites remain unchanged and use the mount-time autofocus effect.  Tests Coverage includes restoring activation focus, retaining focus in dialogs and unrelated controls, handing off from terminal-tab contr
  **Post-Mortem & Fix Analysis**:
  > ## 🏆 Review leaderboard  Sep 25, 2026–Oct 2, 2026 · UTC  | Rank | Reviewer | PRs reviewed | Review rounds | PR comments | | :---: | --- | ---: | ---: | ---: | | 🥇 | <img src="https://avatars.githubusercontent.com/u/44542765?u=4df62a1ca3b55473f46a507a586e3e4dddb019cc&v=4" width="24" height="24" alt="@illegalcall"> [@illegalcall](https://github.com/illegalcall) | 30 | 56 | 11 | | 🥈 | <img src="https://avatars.githubusercontent.com/u/64074505?u=cab8d4e9a8a4b5bf79fe10ff06ea4f69b5cb2264&v=4" width="24" height="24" alt="@ronishrohan"> [@ronishrohan](https://github.com/ronishrohan) | 28 | 37 | 7 | | 🥉 | <img src="https://avatars.githubusercontent.com/u/96230495?u=3ab7514bc4e9916975900c211456c546a0867d64&v=4" width="24" height="24" alt="@nikhilachale"> [@nikhilachale](https://github.com/nikhilachale) | 22 | 35 | 8 | | 4 | <img src="https://avatars.githubusercontent.com/u/85189266?u=2d441062124affd34b40b1adfc602c90672042ba&v=4" width="24" height="24" alt="@Prasad-D-Ware"> [@Prasad-D-Ware](h
  > Multi-lens review (autonomous, 10 lenses), verified against the source before posting.  ## High  ### `canAutoFocusTerminal` now treats *every* topbar `button` as a focus handoff — the terminal steals the caret from the ⋮ session-actions trigger and the session chrome, and the next keystrokes go into the PTY  **Where:** `frontend/src/renderer/components/XtermTerminal.tsx:315-316` (widened clause, was `button[role='tab'][aria-current]`), consulted by all three autofocus paths: the `focusRequested` effect (`focusIfAllowed`, `XtermTerminal.tsx:1653-1694`), the post-fullscreen `restoreTerminalFocus` (`XtermTerminal.tsx:571`), and the new `requestActivationFocus` (`XtermTerminal.tsx:1566-1577`, called from `TerminalPane.tsx:279` on every cache re-activation). Amplified by `AUTOFOCUS_RETRY_FRAMES` 2 → 6 (`XtermTerminal.tsx:143`).  **What breaks:** the invariant still stated right above the changed clause — "Every other focused control remains authoritative" (`XtermTerminal.tsx:306-309`) — was
  > @axisrow  can you review this again? 

- **Issue #6163** (2026-10-04): **fix(cloud): restore Chat orchestration and private-repo SCM**
  *Symptoms*: Code changes: +1979 -365   Tests: +1890 -65   Others: +31 -12  ## Summary  Restore reliable Cloud Chat orchestration, agent status, and GitHub SCM for private repositories.  ## What this fixes  - **Kanban status:** Settle a worker to idle when its turn fails or is interrupted, so an errored agent does not remain “Working.” - **Interface switching:** Carry the selected model and effort between Terminal UI and Chat UI in both directions; preserve cancellation while the shell becomes ready. - **Chat presentation:** Render Codex output as structured Markdown with tool activity and file changes/diffs instead of a single paragraph and generic working state. - **SCM and notifications:** Reliably process GitHub webhooks, associate opened PRs with their sessions, update the PR side card and bell notifications, and reconcile private-repository merge status. - **Private repository access:** Refresh GitHub installation/repository access for checkout and Git operations when an existing session reconnects. - **Orchestrator Chat:** Give Chat workers the Cloud AO role instructions and commands so the orchestrator actually uses `ao spawn` and reports to agents. Require an observed worker session ID before claiming a spawn succeeded; submit queued `ao report` text in Terminal UI. - **System prompts:** Bring in the system prompt work from #6122 and refine it for Cloud harnesses, including Codex, Claude Code, and Cursor.  ## Validation  - Cloud: `go build ./...`, `go vet ./..
  **Post-Mortem & Fix Analysis**:
  > ## 🏆 Review leaderboard  Sep 25, 2026–Oct 2, 2026 · UTC  | Rank | Reviewer | PRs reviewed | Review rounds | PR comments | | :---: | --- | ---: | ---: | ---: | | 🥇 | <img src="https://avatars.githubusercontent.com/u/44542765?u=4df62a1ca3b55473f46a507a586e3e4dddb019cc&v=4" width="24" height="24" alt="@illegalcall"> [@illegalcall](https://github.com/illegalcall) | 30 | 56 | 11 | | 🥈 | <img src="https://avatars.githubusercontent.com/u/64074505?u=cab8d4e9a8a4b5bf79fe10ff06ea4f69b5cb2264&v=4" width="24" height="24" alt="@ronishrohan"> [@ronishrohan](https://github.com/ronishrohan) | 27 | 37 | 8 | | 🥉 | <img src="https://avatars.githubusercontent.com/u/96230495?u=3ab7514bc4e9916975900c211456c546a0867d64&v=4" width="24" height="24" alt="@nikhilachale"> [@nikhilachale](https://github.com/nikhilachale) | 22 | 35 | 8 | | 4 | <img src="https://avatars.githubusercontent.com/u/85189266?u=2d441062124affd34b40b1adfc602c90672042ba&v=4" width="24" height="24" alt="@Prasad-D-Ware"> [@Prasad-D-Ware](h
  > ## Pre-merge review notes  No blockers on secrets or correctness: cloud builds, vet is clean, the worker/githubapp/workerexec test suites pass, and tenant isolation plus the production GitHub gate are intact. Flagging the behavioral and deploy items below.  **HIGH (by-design): PR state is now webhook-only.** This removes the prstatus poll scanner and the immediate post-merge refresh/mergeability retry, so merged-flip and terminate-on-merge fire only when the pull_request webhook reaches this environment. A lagged or misrouted webhook leaves a PR card stale with no self-healing. Please confirm webhook delivery is reliable on prod (or accept the stale-card risk) before merging.  **MEDIUM (deploy-time): migration 00060 builds a non-CONCURRENT index** on the append-heavy ao_github_webhook_deliveries, locking INSERTs during the build. Fine on staging (small table), but on a large prod table it stalls webhook ingestion during the deploy. Make it CONCURRENTLY (with `-- +goose NO TRANSACTION`)
  > Pre-merge review of head 0322a3af0 (gates: secrets, regression, fatal). Scope: workerexec, workertransport, postgres + migrations, httpapi, githubapp, config, and the chat/session frontend.  No blockers. Secrets and fatal gates are clean: config.go GitHub App gate is intact (production/development only, no staging), new os/exec sites are argv form, new SQL is parameterized and tenant scoped, migration 00059 has RLS, no nil derefs or double system prompt injection, interface switch preserves model/effort, i18n keys present in all 8 locales.  Worth addressing:  1. ListInstallations mutate on read (cloud/internal/githubapp/service.go:360). The GET installations path calls GitHub GetInstallation per active installation and writes ApplyGitHubInstallationEvent(deleted) on a 404. It fails open on transient errors, but it couples GitHub latency to a previously instant read and mutates on a GET. Consider moving the liveness reconcile off the read path.  2. Migration 00060 (cloud/internal/postgr

- **Issue #6140** (2026-10-03): **[Bug]: terminal doesn't get focus after switching tabs in session**
  *Symptoms*: ### What went wrong?  Terminal users expect that any focus on terminal makes input field editable. While in AO input field requires specific focus.  STR: - Change session interface to "Terminal" (not "Chat"). - In such session add one more tab. - Return to "terminal" tab and put focus (i.e. click with mouse) into input field. - Press Ctrl+Tab hotkey of just click on a different tab. - Return into "terminal" tab and try to type something.  Expected: Input field gets new characters.  Actual: Nothing happens.
  **Post-Mortem & Fix Analysis**:
  > Hi @AlexanderMakarov  could you describe this issue a bit more? For example: What version of AO are you using? Maybe, if possible, visual proof like a screenshot or something
  > @ApexYash11   ## Version  ```shell $ ao --version ao version dev ``` but in UI "Settings -> Updates" I see v0.13.0. I am on Linux Mint, 7.0.0-38-generic #38~24.04.4-Ubuntu  ## Details  I've provided full repro steps for the issue. Screenshot will contain only my terminal window. I've not noticed any style changes for state "input field has focus" and "... doesn't have focus".
  > @AlexanderMakarov can you test out the pr once? 

- **Issue #6139** (2026-10-03): **fix(terminal): isolate shell color protocol**
  *Symptoms*: Code changes: +6 -1   Tests: +37 -1   Others: +0 -0  ## Summary - prevent standalone shell terminals from inheriting the owning agent session provider - keep Cursor color-scheme protocol enabled for Cursor agent and reviewer terminals only - add regression coverage for a shell opened from a Cursor session  ## Tests - `npm test -- --run src/renderer/components/TerminalPane.test.tsx` (59 passed) - `npm run typecheck` (passed) - `npm run lint` (blocked by unrelated environment/baseline failures, including missing bundled tmux and installed Codex protocol drift)  ## Risk Low. The change only clears provider-specific terminal behavior for standalone shell targets.
  **Post-Mortem & Fix Analysis**:
  > ## 🏆 Review leaderboard  Sep 25, 2026–Oct 2, 2026 · UTC  | Rank | Reviewer | PRs reviewed | Review rounds | PR comments | | :---: | --- | ---: | ---: | ---: | | 🥇 | <img src="https://avatars.githubusercontent.com/u/44542765?u=4df62a1ca3b55473f46a507a586e3e4dddb019cc&v=4" width="24" height="24" alt="@illegalcall"> [@illegalcall](https://github.com/illegalcall) | 30 | 54 | 9 | | 🥈 | <img src="https://avatars.githubusercontent.com/u/64074505?u=cab8d4e9a8a4b5bf79fe10ff06ea4f69b5cb2264&v=4" width="24" height="24" alt="@ronishrohan"> [@ronishrohan](https://github.com/ronishrohan) | 23 | 32 | 7 | | 🥉 | <img src="https://avatars.githubusercontent.com/u/96230495?u=3ab7514bc4e9916975900c211456c546a0867d64&v=4" width="24" height="24" alt="@nikhilachale"> [@nikhilachale](https://github.com/nikhilachale) | 22 | 37 | 8 | | 4 | <img src="https://avatars.githubusercontent.com/u/85189266?u=2d441062124affd34b40b1adfc602c90672042ba&v=4" width="24" height="24" alt="@Prasad-D-Ware"> [@Prasad-D-Ware](ht

- **Issue #6130** (2026-10-04): **fix(frontend): restore file viewer navigation state**
  *Symptoms*: Code changes: +197 -57   Tests: +203 -43   Others: +0 -0  ## Summary - keep files reachable when switching between the terminal, agent, and file surfaces - open chat file references at their requested line and consume each line-navigation request exactly once, including across file-viewer remounts - preserve file scroll position across agent navigation, retry restoration after asynchronously loaded content becomes scrollable, and finish at the reachable offset when content dimensions change - display clicked files directly in the center pane without forcing the file-directory sidebar open - remove the redundant Return to panel browser menu action when the maximize/minimize control already provides that path  ## Regression provenance - #5119 introduced the terminal/file center-surface switching regression while adding the extra terminal surface. - #5243 introduced line-aware file links, but the center-pane path dropped the requested line before reaching the viewer. - #5575 introduced session-scoped file workspaces; its remount behavior reset file scroll state when navigating through an agent. - #5837 routed file clicks through the sidebar workspace, which forced the right-side file directory open. - #6062 added browser maximize/minimize controls, making the Return to panel dropdown action redundant.  ## Testing - `cd frontend && npm test -- ReadOnlyFileView.test.tsx SessionFileWorkspace.test.tsx FileContentPane.test.tsx SessionView.test.tsx ChatMarkdown.test.tsx workspace-file
  **Post-Mortem & Fix Analysis**:
  > ## 🏆 Review leaderboard  Sep 25, 2026–Oct 2, 2026 · UTC  | Rank | Reviewer | PRs reviewed | Review rounds | PR comments | | :---: | --- | ---: | ---: | ---: | | 🥇 | <img src="https://avatars.githubusercontent.com/u/44542765?u=4df62a1ca3b55473f46a507a586e3e4dddb019cc&v=4" width="24" height="24" alt="@illegalcall"> [@illegalcall](https://github.com/illegalcall) | 32 | 55 | 9 | | 🥈 | <img src="https://avatars.githubusercontent.com/u/64074505?u=cab8d4e9a8a4b5bf79fe10ff06ea4f69b5cb2264&v=4" width="24" height="24" alt="@ronishrohan"> [@ronishrohan](https://github.com/ronishrohan) | 24 | 33 | 7 | | 🥉 | <img src="https://avatars.githubusercontent.com/u/96230495?u=3ab7514bc4e9916975900c211456c546a0867d64&v=4" width="24" height="24" alt="@nikhilachale"> [@nikhilachale](https://github.com/nikhilachale) | 22 | 39 | 8 | | 4 | <img src="https://avatars.githubusercontent.com/u/85189266?u=2d441062124affd34b40b1adfc602c90672042ba&v=4" width="24" height="24" alt="@Prasad-D-Ware"> [@Prasad-D-Ware](ht
  > minor browser change as well <img width="570" height="596" alt="image" src="https://github.com/user-attachments/assets/86780227-5daa-41de-880b-72e9b5f278de" /> 

- **Issue #6129** (2026-10-05): **fix(chat): avoid long-history freezes on session switch**
  *Symptoms*: Code changes: +180 -19   Tests: +328 -1   Others: +6 -4  Switching to a large chat remounted every loaded turn, blocking the renderer on Markdown parsing and text layout. Window histories above 20 turn groups and skip streaming-animation segmentation for completed messages. Preserve scroll anchoring, minimap navigation, inline edits, and Jump to latest. Keep disclosure resizing separate from new-output scrolling, and preserve the visible prefix when a completed message resumes streaming.  Review follow-ups keep an unpinned reader in place when streamed text resizes the latest row despite the prompt spacer, and preserve expanded activity disclosures when virtualized rows unmount. The performance notes now document that browser Find, DOM text selection/copy, and sequential screen-reader navigation cover only the mounted range; minimap navigation still targets all loaded turns.  Five-run routed Chromium comparison with 200 synthetic messages: median main-thread stall **1,533 → 148 ms**, first rendered frames **1,624 → 270 ms**. Daemon responses were mocked; native Electron latency was not measured. Offscreen turns unmount, so browser Find and text selection cover the mounted range.  Validation on Node 24: the focused chat timeline suite passed (**25/25**). A full frontend run reported **5,747 passed, one failed, seven skipped**; the failure was a load-sensitive ProjectSettingsForm request-count assertion that passed when run alone. Frontend and E2E typechecks, shared-package che
  **Post-Mortem & Fix Analysis**:
  > ## 🏆 Review leaderboard  Sep 25, 2026–Oct 2, 2026 · UTC  | Rank | Reviewer | PRs reviewed | Review rounds | PR comments | | :---: | --- | ---: | ---: | ---: | | 🥇 | <img src="https://avatars.githubusercontent.com/u/44542765?u=4df62a1ca3b55473f46a507a586e3e4dddb019cc&v=4" width="24" height="24" alt="@illegalcall"> [@illegalcall](https://github.com/illegalcall) | 32 | 55 | 9 | | 🥈 | <img src="https://avatars.githubusercontent.com/u/64074505?u=cab8d4e9a8a4b5bf79fe10ff06ea4f69b5cb2264&v=4" width="24" height="24" alt="@ronishrohan"> [@ronishrohan](https://github.com/ronishrohan) | 24 | 33 | 7 | | 🥉 | <img src="https://avatars.githubusercontent.com/u/96230495?u=3ab7514bc4e9916975900c211456c546a0867d64&v=4" width="24" height="24" alt="@nikhilachale"> [@nikhilachale](https://github.com/nikhilachale) | 22 | 39 | 8 | | 4 | <img src="https://avatars.githubusercontent.com/u/85189266?u=2d441062124affd34b40b1adfc602c90672042ba&v=4" width="24" height="24" alt="@Prasad-D-Ware"> [@Prasad-D-Ware](ht
  > video attached on discord 

- **Issue #6122** (2026-10-05): **fix: inject cloud role instructions into Chat**
  *Symptoms*: Code changes: +187 -44   Tests: +470 -1   Others: +0 -0    Cloud Chat starts and resumes agents without the AO worker/orchestrator instructions that Cloud Terminal receives. Pass the existing role and project context into Chat and reuse Terminal's prompt composition. Role wording and local prompts stay unchanged.  - Send Codex developer instructions on thread start/resume and append Claude instructions through ACP session metadata. - Load Cursor instructions through a session-owned rule outside the checkout. Remove it after Chat exits and clear stale rules before Terminal starts. - Pass the existing PR/review helper environment to Chat. - Test both roles across all three providers on new and resumed sessions, including Terminal prompt parity, separate user tasks, and Cursor rule cleanup. - Preserve request cancellation while waiting for a Cue shell prompt so canceled requests return `context.Canceled` instead of a readiness timeout.  Validation:  - Full cloud race suite, build, vet, and standalone module build passed. - Backend build, vet, lint, formatting, and SQL/API drift checks passed. - Full shell-terminal race suite, 100 repeated cancellation tests, and local CLI E2E passed. - Luna Max verified the original injection gap. GPT-6.1 reviewed the Cursor correction and cancellation fix with no remaining findings. - Pinned Cursor's new/resume rule loader passed a targeted probe. A live model turn was not run. - Full local backend race run: 181 packages passed; eight unrelated
  **Post-Mortem & Fix Analysis**:
  > ## 🏆 Review leaderboard  Sep 24, 2026–Oct 1, 2026 · UTC  | Rank | Reviewer | PRs reviewed | Review rounds | PR comments | | :---: | --- | ---: | ---: | ---: | | 🥇 | <img src="https://avatars.githubusercontent.com/u/44542765?u=4df62a1ca3b55473f46a507a586e3e4dddb019cc&v=4" width="24" height="24" alt="@illegalcall"> [@illegalcall](https://github.com/illegalcall) | 33 | 56 | 9 | | 🥈 | <img src="https://avatars.githubusercontent.com/u/64074505?u=cab8d4e9a8a4b5bf79fe10ff06ea4f69b5cb2264&v=4" width="24" height="24" alt="@ronishrohan"> [@ronishrohan](https://github.com/ronishrohan) | 24 | 33 | 7 | | 🥉 | <img src="https://avatars.githubusercontent.com/u/96230495?u=3ab7514bc4e9916975900c211456c546a0867d64&v=4" width="24" height="24" alt="@nikhilachale"> [@nikhilachale](https://github.com/nikhilachale) | 22 | 39 | 8 | | 4 | <img src="https://avatars.githubusercontent.com/u/85189266?u=2d441062124affd34b40b1adfc602c90672042ba&v=4" width="24" height="24" alt="@Prasad-D-Ware"> [@Prasad-D-Ware](ht
  > Rishet11 raised exactly this on the Oct 2 call, in the local/cloud modularization discussion with Mohak: "we aren't injecting AO role prompts into chat UI. Another thing... role prompts differ for Worker on local versus local worker on cloud... But the role prompts on cloud are a bit short" (38:40). prateek: share whatever is common between local and cloud.  Synced from the Oct 2 call: https://discord.com/channels/1476302178913357958/1555642689368891463 Match: semantic, 0.85 <!-- notesbot-call-sync:2026-10-02:1555642689368891463:#7 --> 

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

### Incident Patch 1: `d8628852` (2026-10-06)
**Commit Message**: fix: archive reviewers and preserve Chat on cancellation (#6291)

* fix: keep stopped reviewer Chat selected

* fix: archive reviewer surfaces while preserving history

* fix: use archive wording for reviewer errors

* fix: show reviewer archive as a neutral tooltip icon

* fix: interrupt review turns without closing Chat

* fix: keep archived reviewers hidden on no-op triggers

---------

Co-authored-by: Prateek K <[REDACTED_EMAIL]>

**File**: `backend/internal/domain/review.go` (modified, +3/-0)
```diff
@@ -41,6 +41,9 @@ type Review struct {
 	ControllerError        string                `json:"controllerError"`
 	CreatedAt              time.Time             `json:"createdAt"`
 	UpdatedAt              time.Time             `json:"updatedAt"`
+
+	// IsArchived retires the reviewer surface without deleting its history.
+	IsArchived bool `json:"-"`
 }
 
 // ReviewerInterfaceMode selects the durable UI surface for a reviewer.
```

**File**: `backend/internal/httpd/apispec/openapi.yaml` (modified, +1/-1)
```diff
@@ -7480,7 +7480,7 @@ paths:
               schema:
                 $ref: '#/components/schemas/APIError'
           description: Not Implemented
-      summary: Kill a worker's reviewer terminal session
+      summary: Archive a worker's reviewer and hide its surface while retaining history
       tags:
       - reviews
   /api/v1/sessions/{sessionId}/reviews/rerequest:
```

**File**: `backend/internal/httpd/apispec/specgen/build.go` (modified, +1/-1)
```diff
@@ -1987,7 +1987,7 @@ func reviewOperations() []operation {
 		},
 		{
 			method: http.MethodPost, path: "/api/v1/sessions/{sessionId}/reviews/kill", id: "killReviewSession", tag: "reviews",
-			summary:    "Kill a worker's reviewer terminal session",
+			summary:    "Archive a worker's reviewer and hide its surface while retaining history",
 			pathParams: []any{controllers.SessionIDParam{}},
 			resps: []respUnit{
 				{http.StatusOK, controllers.KillReviewResponse{}},
```

**File**: `backend/internal/httpd/controllers/reviews.go` (modified, +3/-10)
```diff
@@ -286,7 +286,7 @@ func (c *ReviewsController) kill(w http.ResponseWriter, r *http.Request) {
 		return
 	}
 	workerID := sessionID(r)
-	if err := c.Svc.TerminateReviewer(r.Context(), workerID, "cancelled because reviewer session was killed"); err != nil {
+	if err := c.Svc.ArchiveReviewer(r.Context(), workerID); err != nil {
 		writeReviewError(w, r, err)
 		return
 	}
@@ -295,15 +295,8 @@ func (c *ReviewsController) kill(w http.ResponseWriter, r *http.Request) {
 		writeReviewError(w, r, err)
 		return
 	}
-	reviews := res.Reviews
-	if reviews == nil {
-		reviews = []reviewcore.PRReviewState{}
-	}
-	runs := res.Runs
-	if runs == nil {
-		runs = []domain.ReviewRun{}
-	}
-	envelope.WriteJSON(w, http.StatusOK, KillReviewResponse{ReviewerHandleID: res.ReviewerHandleID, ReviewerHarness: res.ReviewerHarness, Reviews: reviews, Runs: runs})
+	response := reviewsResponse(res, nil, nil)
+	envelope.WriteJSON(w, http.StatusOK, KillReviewResponse{ReviewerHandleID: response.ReviewerHandleID, ReviewerHarness: response.ReviewerHarness, Reviews: response.Reviews, Runs: response.Runs})
 }
 
 func (c *ReviewsController) restore(w http.ResponseWriter, r *http.Request) {
```

**File**: `backend/internal/httpd/controllers/reviews_test.go` (modified, +13/-2)
```diff
@@ -118,6 +118,11 @@ func (f *fakeReviewService) TerminateReviewer(context.Context, domain.SessionID,
 	return nil
 }
 
+func (f *fakeReviewService) ArchiveReviewer(ctx context.Context, id domain.SessionID) error {
+	f.list.ReviewerSurface = domain.ReviewerSurface{}
+	return f.TerminateReviewer(ctx, id, "")
+}
+
 func (f *fakeReviewService) TeardownReviewerTerminal(context.Context, domain.SessionID) error {
 	f.teardown = true
 	f.list.ReviewerHandleID = ""
@@ -370,10 +375,11 @@ func TestReviewsCancelIncludesReviewStates(t *testing.T) {
 	}
 }
 
-func TestReviewsKillClearsReviewerHandle(t *testing.T) {
+func TestReviewsKillArchivesReviewerSurface(t *testing.T) {
 	svc := &fakeReviewService{list: reviewcore.SessionReviews{
 		ReviewerHandleID: "review-mer-1",
 		ReviewerHarness:  domain.ReviewerCodex,
+		ReviewerSurface:  domain.ReviewerSurface{Mode: domain.ReviewerInterfaceChat, ReviewID: "review-1", Harness: domain.ReviewerCodex},
 		Reviews:          []reviewcore.PRReviewState{{PRURL: "https://github.com/o/r/pull/1", PRNumber: 1, TargetSHA: "sha1", Status: reviewcore.ReviewStateNeedsReview}},
 		Runs:             []domain.ReviewRun{{ID: "run-1", SessionID: "mer-1", Harness: domain.ReviewerCodex}},
 	}}
@@ -385,13 +391,18 @@ func TestReviewsKillClearsReviewerHandle(t *testing.T) {
 		t.Fatalf("status = %d body=%s", status, body)
 	}
 	if !svc.killed {
-		t.Fatal("TerminateReviewer was not called")
+		t.Fatal("ArchiveReviewer was not called")
 	}
 	for _, want := range []string{`"reviewerHandleId":""`, `"reviews"`, `"runs"`, `"run-1"`} {
 		if !strings.Contains(string(body), want) {
 			t.Fatalf("body missing %s: %s", want, body)
 		}
 	}
+
+	refreshed, status, _ := doRequest(t, srv, "GET", "/api/v1/sessions/mer-1/reviews", "")
+	if status != http.StatusOK || strings.Contains(string(refreshed), `"reviewerSurface"`) || !strings.Contains(string(refreshed), `"run-1"`) {
+		t.Fatalf("archived refresh: %d %s", status, refreshed)
+	}
 }
 
 func TestReviewsRestoreReturnsReviewerHandle(t *testing.T) {
```

**File**: `backend/internal/review/launcher.go` (modified, +4/-4)
```diff
@@ -55,7 +55,7 @@ type Launcher interface {
 	// Reusable reports whether the harness accepts another review task in its
 	// existing TUI. Reviewers with launch-fixed context return false.
 	Reusable(harness domain.ReviewerHarness) bool
-	// Cancel interrupts a running reviewer pane while keeping the terminal alive.
+	// Cancel interrupts reviewer work while keeping its Chat or terminal alive.
 	Cancel(ctx context.Context, handleID string, harness domain.ReviewerHarness) error
 	// Destroy tears down a reviewer pane entirely. This is used when the owning
 	// worker session itself is torn down, not for user-facing review cancellation.
@@ -808,9 +808,9 @@ func (l *agentLauncher) Cancel(ctx context.Context, handleID string, harness dom
 		return nil
 	}
 	if reviewID, ok := reviewerChatID(handleID); ok && l.chat != nil {
-		// A cancelled review must not leave its Chat controller accepting work or
-		// its in-flight turn looking active. The next trigger starts a fresh one.
-		return l.chat.StopReviewChat(ctx, reviewID)
+		// Stop review cancels the turn, just like Stop in the Chat composer.
+		// Keep the controller and conversation usable; Archive owns teardown.
+		return l.chat.InterruptReviewChat(ctx, reviewID)
 	}
 	reviewer, ok := l.reviewers.Reviewer(harness)
 	if !ok {
```

**File**: `backend/internal/review/launcher_test.go` (modified, +28/-11)
```diff
@@ -24,28 +24,45 @@ type fakeReviewer struct {
 
 type recordingReviewChatStop struct {
 	ReviewerChatController
-	stopped     string
-	interrupted bool
+	stopped      string
+	interrupted  string
+	interruptErr error
 }
 
 func (c *recordingReviewChatStop) StopReviewChat(_ context.Context, reviewID string) error {
 	c.stopped = reviewID
 	return nil
 }
 
-func (c *recordingReviewChatStop) InterruptReviewChat(context.Context, string) error {
-	c.interrupted = true
-	return nil
+func (c *recordingReviewChatStop) InterruptReviewChat(_ context.Context, reviewID string) error {
+	c.interrupted = reviewID
+	return c.interruptErr
 }
 
-func TestCancelReviewerChatStopsItsController(t *testing.T) {
-	chat := &recordingReviewChatStop{}
+func TestCancelReviewerChatInterruptsWithoutStoppingItsController(t *testing.T) {
+	for _, harness := range []domain.ReviewerHarness{domain.ReviewerCodex, domain.ReviewerClaudeCode} {
+		t.Run(string(harness), func(t *testing.T) {
+			chat := &recordingReviewChatStop{}
+			launcher := NewLauncher(fakeReviewerResolver{}, &fakeRuntime{}, t.TempDir(), WithReviewerChat(chat))
+			if err := launcher.Cancel(context.Background(), "review-chat:review-1", harness); err != nil {
+				t.Fatalf("Cancel: %v", err)
+			}
+			if chat.stopped != "" || chat.interrupted != "review-1" {
+				t.Fatalf("reviewer Chat cancel: stopped=%q interrupted=%q", chat.stopped, chat.interrupted)
+			}
+		})
+	}
+}
+
+func TestCancelReviewerChatPreservesInterruptFailure(t *testing.T) {
+	want := errors.New("provider interrupt failed")
+	chat := &recordingReviewChatStop{interruptErr: want}
 	launcher := NewLauncher(fakeReviewerResolver{}, &fakeRuntime{}, t.TempDir(), WithReviewerChat(chat))
-	if err := launcher.Cancel(context.Background(), "review-chat:review-1", domain.ReviewerCodex); err != nil {
-		t.Fatalf("Cancel: %v", err)
+	if err := launcher.Cancel(context.Background(), "review-chat:review-1", domain.ReviewerCodex); !errors.Is(err, want) {
+		t.Fatalf("Cancel = %v, want %v", err, want)
 	}
-	if chat.stopped != "review-1" || chat.interrupted {
-		t.Fatalf("reviewer Chat cancel: stopped=%q interrupted=%v", chat.stopped, chat.interrupted)
+	if chat.stopped != "" {
+		t.Fatal("failed cancellation must not tear down the controller")
 	}
 }
 
```

**File**: `backend/internal/review/review.go` (modified, +56/-12)
```diff
@@ -32,6 +32,7 @@ var (
 // in production; tests use a fake.
 type Store interface {
 	UpsertReview(ctx stdctx.Context, r domain.Review) error
+	ArchiveReviewsBySession(ctx stdctx.Context, workerID domain.SessionID, now time.Time) error
 	SetReviewInterfaceMode(ctx stdctx.Context, id string, mode domain.ReviewerInterfaceMode, updatedAt time.Time) (bool, error)
 	RestoreReviewLaunchState(ctx stdctx.Context, review domain.Review, now time.Time) (bool, error)
 	SettleReviewChatWork(ctx stdctx.Context, reviewID string, now time.Time) error
@@ -493,7 +494,7 @@ func (e *Engine) TriggerWithOptions(ctx stdctx.Context, workerID domain.SessionI
 			}
 			rollbackCtx, cancel := stdctx.WithTimeout(stdctx.WithoutCancel(ctx), 5*time.Second)
 			defer cancel()
-			if modeChanging || (hasConfigOverride && selectedMode == domain.ReviewerInterfaceChat) {
+			if previousReview.IsArchived || modeChanging || (hasConfigOverride && selectedMode == domain.ReviewerInterfaceChat) {
 				if ok, rollbackErr := e.store.RestoreReviewLaunchState(rollbackCtx, previousReview, rollbackNow); rollbackErr != nil {
 					cause = errors.Join(cause, fmt.Errorf("restore previous reviewer surface: %w", rollbackErr))
 				} else if !ok {
@@ -550,6 +551,15 @@ func (e *Engine) TriggerWithOptions(ctx stdctx.Context, workerID domain.SessionI
 		if err != nil {
 			return TriggerResult{}, rollbackReplacement(err)
 		}
+		if reviewRow.IsArchived {
+			// Chat must be active before its controller can claim ownership. Only
+			// reopen once launch work is due; rollback restores the archive on failure.
+			reviewRow.IsArchived = false
+			reviewRow.ReviewerActivityState = domain.ActivityActive
+			if err := e.store.UpsertReview(ctx, reviewRow); err != nil {
+				return TriggerResult{}, rollbackReplacement(err)
+			}
+		}
 		if err := e.setReviewerInterfaceMode(ctx, reviewRow.ID, selectedMode, now); err != nil {
 			return TriggerResult{}, rollbackReplacement(err)
 		}
@@ -579,7 +589,7 @@ func (e *Engine) TriggerWithOptions(ctx stdctx.Context, workerID domain.SessionI
 	}
 	for _, stale := range pendingSupersedes {
 		if _, err := e.store.SupersedeStaleRunningReviewRuns(ctx, workerID, stale.prURL, stale.targetSHA, "superseded by a review trigger for a newer commit"); err != nil {
-			if modeChanging {
+			if previousReview.IsArchived || modeChanging {
 				return TriggerResult{}, rollbackReplacement(err)
 			}
 			if handleID != "" {
@@ -590,7 +600,7 @@ func (e *Engine) TriggerWithOptions(ctx stdctx.Context, workerID domain.SessionI
 	}
 	if hasConfigOverride && persistedAgentSessionID == "" && reviewRow.ID != "" {
 		if _, err := e.store.UpdateReviewAgentSessionID(ctx, reviewRow.ID, ""); err != nil {
-			if modeChanging {
+			if previousReview.IsArchived || modeChanging {
 				return TriggerResult{}, rollbackReplacement(err)
 			}
 			if handleID != "" {
@@ -601,7 +611,7 @@ func (e *Engine) TriggerWithOptions(ctx stdctx.Context, workerID domain.SessionI
 	}
 	reviewRow, err = e.upsertReview(ctx, worker, harness, handleID, persistedAgentSessionID, reviewRow.ReviewerLaunchID, "", now)
 	if err != nil {
-		if modeChanging {
+		if previousReview.IsArchived || modeChanging {
 			return TriggerResult{}, rollbackReplacement(err)
 		}
 		if handleID != "" {
@@ -823,6 +833,14 @@ func (e *Engine) RecoverChatReviewers(ctx stdctx.Context) error {
 func (e *Engine) restoreRecoverableChatReviewer(ctx stdctx.Context, review domain.Review) (RestoreReviewerResult, error) {
 	unlock := e.lockWorker(review.SessionID)
 	defer unlock()
+	current, exists, err := e.store.GetReviewBySessionAndHarness(ctx, review.SessionID, review.Harness)
+	if err != nil {
+		return RestoreReviewerResult{}, err
+	}
+	if !exists || current.ID != review.ID || current.IsArchived {
+		return RestoreReviewerResult{}, nil
+	}
+	review = current
 	worker, ok, err := e.sessions.GetSession(ctx, review.SessionID)
 	if err != nil {
 		return RestoreReviewerResult{}, err
@@ -901,6 +919,9 @@ func (e *Engine) restoreReviewerLocked(
 	if err != nil {
 		return RestoreReviewerResult{}, err
 	}
+	if hasReview && reviewRow.IsArchived {
+		return RestoreReviewerResult{}, nil
+	}
 	runs, err := e.store.ListReviewRunsBySession(ctx, workerID)
 	if err != nil {
 		return RestoreReviewerResult{}, err
@@ -1317,7 +1338,7 @@ func (e *Engine) reconcileExitedReviewer(ctx stdctx.Context, review *domain.Revi
 }
 
 func reviewerSurface(review domain.Review) domain.ReviewerSurface {
-	if review.ID == "" {
+	if review.ID == "" || review.IsArchived {
 		return domain.ReviewerSurface{}
 	}
 	handleID := review.ReviewerHandleID
@@ -1331,7 +1352,7 @@ func reviewerSurface(review domain.Review) domain.ReviewerSurface {
 }
 
 func legacyReviewerHandle(review domain.Review) string {
-	if review.InterfaceMode == domain.ReviewerInterfaceChat {
+	if review.IsArchived || review.InterfaceMode == domain.ReviewerInterfaceChat {
 		return ""
 	}
 	return review.ReviewerHandleID
@@ -1460,6 +1481,16 @@ func (e *Engine) currentReviewForSession(ctx s
```

---

### Incident Patch 2: `d277703e` (2026-10-05)
**Commit Message**: fix(cloud): bump backend pin so the CP image builds with agentruntime.Effort (#6246)

#6163 added cloud/ code using agentruntime.Effort (RestoreConfig/LaunchConfig), a backend field added on 2026-09-24 (#5208), but did not bump cloud/go.mod's backend replace pin, which still pointed at an Aug-12 commit without the field. Local and CI builds pass via go.work (in-repo backend), but the control-plane Docker build compiles cloud/ against the pinned backend and fails with 'unknown field Effort'. Bump the pin to the backend at main HEAD (168f09b74), which go.work and CI already build against. Verified cloud/ compiles with GOWORK=off, the same resolution the Docker build uses.

Co-authored-by: t <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `cloud/go.mod` (modified, +4/-4)
```diff
@@ -29,12 +29,12 @@ require (
 	github.com/sethvargo/go-retry v0.4.0 // indirect
 	go.uber.org/multierr v1.11.0 // indirect
 	golang.org/x/oauth2 v0.36.0 // indirect
-	golang.org/x/sync v0.22.0 // indirect
-	golang.org/x/sys v0.47.0 // indirect
-	golang.org/x/text v0.40.0 // indirect
+	golang.org/x/sync v0.23.0 // indirect
+	golang.org/x/sys v0.48.0 // indirect
+	golang.org/x/text v0.42.0 // indirect
 	modernc.org/libc v1.74.3 // indirect
 	modernc.org/mathutil v1.7.1 // indirect
 	modernc.org/memory v1.11.0 // indirect
 )
 
-replace github.com/aoagents/agent-orchestrator/backend => github.com/Untrivial-ai/agent-orchestrator/backend v0.0.0-20260812094327-5da0ce157982
+replace github.com/aoagents/agent-orchestrator/backend => github.com/Untrivial-ai/agent-orchestrator/backend v0.0.0-20261004185234-168f09b748f0
```

**File**: `cloud/go.sum` (modified, +16/-15)
```diff
@@ -1,5 +1,5 @@
-github.com/Untrivial-ai/agent-orchestrator/backend v0.0.0-20260812094327-5da0ce157982 h1:xE0+lOKGt93pSAAGDpe7+oN5LGxK2EaBrE8bosQySz4=
-github.com/Untrivial-ai/agent-orchestrator/backend v0.0.0-20260812094327-5da0ce157982/go.mod h1:+JSl0Lxewd6N3O+iVuO4ikyarctRB98Bw41F7TVEGSI=
+github.com/Untrivial-ai/agent-orchestrator/backend v0.0.0-20261004185234-168f09b748f0 h1:BTqwk01xQfR/g853vmvueTZuZEpgkAEmzbnArN21xiI=
+github.com/Untrivial-ai/agent-orchestrator/backend v0.0.0-20261004185234-168f09b748f0/go.mod h1:ty5BwiBKX3n/SDVwRaefK9KJXywERz6CmyDQQFzUbMg=
 github.com/coder/acp-go-sdk v0.13.5 h1:LI9jq5xon7xslaYlnoktvTVyDlE37yIk2daT7N9ASYk=
 github.com/coder/acp-go-sdk v0.13.5/go.mod h1:yKzM/3R9uELp4+nBAwwtkS0aN1FOFjo11CNPy37yFko=
 github.com/coder/websocket v1.8.15 h1:6B2JPeOGlpff2Uz6vOEH1Vzpi0iUz20A+lPVhPHtNUA=
@@ -9,8 +9,8 @@ github.com/coreos/go-oidc/v3 v3.20.0/go.mod h1:DYCf24+ncYi+XkIH97GY1+dqoRlbaSI26
 github.com/creack/pty v1.1.24 h1:bJrF4RRfyJnbTJqzRLHzcGaZK1NeM5kTC9jGgovnR1s=
 github.com/creack/pty v1.1.24/go.mod h1:08sCNb52WyoAwi2QDyzUCTgcvVFhUzewun7wtTfvcwE=
 github.com/davecgh/go-spew v1.1.0/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
-github.com/davecgh/go-spew v1.1.1 h1:vj9j/u1bqnvCEfJOwUhtlOARqs3+rkHYY13jYWTU97c=
-github.com/davecgh/go-spew v1.1.1/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
+github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc h1:U9qPSI2PIWSS1VwoXQT9A3Wy9MM3WgvqSxFWenqJduM=
+github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc/go.mod h1:J7Y8YcW2NihsgmVo/mv3lAwl/skON4iLHjSsI+c5H38=
 github.com/dustin/go-humanize v1.0.1 h1:GzkhY7T5VNhEkwH0PVJgjz+fX1rhBrR7pRT3mDkpeCY=
 github.com/dustin/go-humanize v1.0.1/go.mod h1:Mu1zIs6XwVuF/gI1OepvI0qD18qycQx+mFykh5fBlto=
 github.com/go-chi/chi/v5 v5.3.1 h1:3j4HZLGZQ3JpMCrPJF/Jl3mYJfWLKBfNJ6quurUGCf8=
@@ -37,8 +37,9 @@ github.com/mfridman/interpolate v0.0.2 h1:pnuTK7MQIxxFz1Gr+rjSIx9u7qVjf5VOoM/u6B
 github.com/mfridman/interpolate v0.0.2/go.mod h1:p+7uk6oE07mpE/Ik1b8EckO0O4ZXiGAfshKBWLUM9Xg=
 github.com/ncruces/go-strftime v1.0.0 h1:HMFp8mLCTPp341M/ZnA4qaf7ZlsbTc+miZjCLOFAw7w=
 github.com/ncruces/go-strftime v1.0.0/go.mod h1:Fwc5htZGVVkseilnfgOVb9mKy6w1naJmn9CehxcKcls=
-github.com/pmezard/go-difflib v1.0.0 h1:4DBwDE0NGyQoBHbLQYPwSUPoCMWR5BEzIk/f1lZbAQM=
 github.com/pmezard/go-difflib v1.0.0/go.mod h1:iKH77koFhYxTK1pcRnkKkqfTogsbg7gZNVY4sRDYZ/4=
+github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 h1:Jamvg5psRIccs7FGNTlIRMkT8wgtp5eCXdBlqhYGL6U=
+github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2/go.mod h1:iKH77koFhYxTK1pcRnkKkqfTogsbg7gZNVY4sRDYZ/4=
 github.com/pressly/goose/v3 v3.27.3 h1:pIglVHjw99r4e/hDHHwbl9vfOsDMqUokfkXo6+n/RxA=
 github.com/pressly/goose/v3 v3.27.3/go.mod h1:Dag+xpV6o20HR2LFY1j0q6MDwc3f7vPUFDA77R+0yGY=
 github.com/remyoudompheng/bigfft v0.0.0-20230129092748-24d4a6f8daec h1:W09IVJc94icq4NjY3clb7Lk8O1qJ8BdBEF8z0ibU0rE=
@@ -54,18 +55,18 @@ go.uber.org/multierr v1.11.0 h1:blXXJkSxSSfBVBlC76pxqeO+LN3aDfLQo+309xJstO0=
 go.uber.org/multierr v1.11.0/go.mod h1:20+QtiLqy0Nd6FdQB9TLXag12DsQkrbs3htMFfDN80Y=
 golang.org/x/crypto v0.54.0 h1:YLIA59K4fiNzHzjnZt2tUJQjQtUWfWbeHBqKtk3eScw=
 golang.org/x/crypto v0.54.0/go.mod h1:KWL8ny2AZdGR2cWmzeHrp2azQPGogOv+HeQaVEXC2dk=
-golang.org/x/mod v0.37.0 h1:vF1DjpVEshcIqoEaauuHebaLk1O1forxjxBaVn884JQ=
-golang.org/x/mod v0.37.0/go.mod h1:m8S8VeM9r4dzDwjrKO0a1sZP3YjeMamRRlD+fmR2Q/0=
+golang.org/x/mod v0.41.0 h1:qJmnOUb4YB+FsEuM3HcWucdZASCPGhsX6uljO6pog0c=
+golang.org/x/mod v0.41.0/go.mod h1:Ek9pY8RKWXwsWvd3rQiHYtMqkjSUV+s1Rj7j4H5Ur6o=
 golang.org/x/oauth2 v0.36.0 h1:peZ/1z27fi9hUOFCAZaHyrpWG5lwe0RJEEEeH0ThlIs=
 golang.org/x/oauth2 v0.36.0/go.mod h1:YDBUJMTkDnJS+A4BP4eZBjCqtokkg1hODuPjwiGPO7Q=
-golang.org/x/sync v0.22.0 h1:SZjpbeLmrCk4xhRSZFNZW5gFUeCeFgjekvI/+gfScek=
-golang.org/x/sync v0.22.0/go.mod h1:9xrNwdLfx4jkKbNva9FpL6vEN7evnE43NNNJQ2LF3+0=
-golang.org/x/sys v0.47.0 h1:o7XGOvZQCADBQQ4Y7VNq2dRWQR7JmOUW8Kxx4ZsNgWs=
-golang.org/x/sys v0.47.0/go.mod h1:4GL1E5IUh+htKOUEOaiffhrAeqysfVGipDYzABqnCmw=
-golang.org/x/text v0.40.0 h1:Ub2Z6/xjgF1WrYQz2nuITOEegKFtiIy+rieRJ5lHZKs=
-golang.org/x/text v0.40.0/go.mod h1:hpnzDAfGV753zIKo+wk3u1bVKCGPbrnF7+7LBF/UHVY=
-golang.org/x/tools v0.47.0 h1:7Kn5x/d1svx/PzryTsqeoZN4TZwqeH5pGWjefhLi/1Q=
-golang.org/x/tools v0.47.0/go.mod h1:dFHnyTvFWY212G+h7ZY4Vsp/K3U4/7W9TyVaAul8uCA=
+golang.org/x/sync v0.23.0 h1:KameEIfc1IkluZyXWLn39Wd4tURc6GbCiISGiZm2bQk=
+golang.org/x/sync v0.23.0/go.mod h1:sUUOizhqBxiL6pEWpqNLUiaJn1ShEbZ6BBqskPbjZm0=
+golang.org/x/sys v0.48.0 h1:bbX/i/6MgT9BVLM9RT1thmxL04yeTAhbEz4SyadbXoo=
+golang.org/x/sys v0.48.0/go.mod h1:hNLxWAXmnKAxqDtdwIYC4bM9oQPEecfsnNMuSxOs3og=
+golang.org/x/text v0.42.0 h1:JbOZXgfeCPU9gacVtYliJqOhD+zhrEqK4LfdpmlUZqI=
+golang.org/x/text v0.42.0/go.mod h1:ojzP1Z+2QtioaF8DTtO8K5q7JWVVYwZKenzujK0Zd0E=
+golang.org/x/tools v0.49.0 h1:3NI7VXzL9+1WZD52Dx2ttoPwD5DWrFGpl9mFZDlmisI=
+golang.org/x/tools v0.49.0/go.mod h1:SJNXV9DBKT0UbdttsQjbfJlAE/q+y36++zo3uL3
```

---

### Incident Patch 3: `35347048` (2026-10-05)
**Commit Message**: fix(cloud): recover missing Claude ACP conversations in Chat (#6264)

* fix(cloud): recover missing Claude ACP conversations

* test: reliably trigger stalled terminal viewer timeout

* fix(cloud): quietly handle repeated sign-in callbacks

* fix: support cloud Claude models, plan mode and initial effort

---------

Co-authored-by: t <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `cloud/internal/domain/types.go` (modified, +11/-10)
```diff
@@ -119,16 +119,17 @@ func (s Session) Status(now time.Time, prs []contract.PRFacts) contract.SessionS
 }
 
 type CreateSession struct {
-	ProjectID      string
-	Kind           string
-	Harness        string
-	DisplayName    string
-	Prompt         string
-	Mode           string
-	Model          string
-	DeniedCommands []string
-	Interface      SessionInterface
-	Provider       string
+	ProjectID       string
+	Kind            string
+	Harness         string
+	DisplayName     string
+	Prompt          string
+	Mode            string
+	Model           string
+	ReasoningEffort string
+	DeniedCommands  []string
+	Interface       SessionInterface
+	Provider        string
 	// SandboxConnectionID names a bring-your-own provider credential. It is
 	// empty for sandboxes that run on the platform's own account.
 	SandboxConnectionID string
```

**File**: `cloud/internal/httpapi/resource_handlers.go` (modified, +5/-0)
```diff
@@ -85,6 +85,7 @@ type createSessionRequest struct {
 	// id, e.g. "anthropic/claude-opus-4-8" for opencode). Optional: empty uses
 	// the harness default.
 	Model                       string   `json:"model,omitempty"`
+	ReasoningEffort             string   `json:"reasoningEffort,omitempty"`
 	DeniedCommands              []string `json:"deniedCommands,omitempty"`
 	SandboxProviderConnectionID string   `json:"sandboxProviderConnectionId,omitempty"`
 	// Provider selects which configured sandbox provider runs this session. It
@@ -602,6 +603,7 @@ func (s *Server) createSession(w http.ResponseWriter, r *http.Request) {
 			Prompt:              request.Prompt,
 			Mode:                request.Mode,
 			Model:               request.Model,
+			ReasoningEffort:     request.ReasoningEffort,
 			DeniedCommands:      request.DeniedCommands,
 			Provider:            plan.Provider,
 			SandboxConnectionID: request.SandboxProviderConnectionID,
@@ -1087,6 +1089,9 @@ func validProjectUpdate(request updateProjectRequest) bool {
 }
 
 func validSessionInput(request createSessionRequest) bool {
+	if validateChatTurnSettings("", request.ReasoningEffort, "", "") != nil {
+		return false
+	}
 	if requireUUID(request.ProjectID, "projectId") != nil ||
 		(request.Kind != "worker" && request.Kind != "orchestrator") ||
 		(request.Mode != "read-only" && request.Mode != "standard" && request.Mode != "trusted") ||
```

**File**: `cloud/internal/httpapi/resource_handlers_autolink_test.go` (modified, +25/-0)
```diff
@@ -2,6 +2,7 @@ package httpapi
 
 import (
 	"context"
+	"io"
 	"net/http"
 	"net/http/httptest"
 	"strings"
@@ -15,6 +16,30 @@ import (
 const autolinkProjectID = "00000000-0000-0000-0000-0000000000d4"
 const autolinkOrgID = "00000000-0000-0000-0000-0000000000a1"
 
+func TestCreateSessionInitialEffort(t *testing.T) {
+	for _, effort := range []string{"medium", "unsupported"} {
+		t.Run(effort, func(t *testing.T) {
+			store := &stubAutolinkStore{}
+			srv := newChildServer(store, bothProviderProvisioning(sandbox.ProviderNodeOps), sandbox.ProviderNodeOps)
+			req := createSessionRequestHTTP(t, "worker", "")
+			body, err := io.ReadAll(req.Body)
+			if err != nil {
+				t.Fatal(err)
+			}
+			req.Body = io.NopCloser(strings.NewReader(strings.TrimSuffix(string(body), "}") + `,"reasoningEffort":"` + effort + `"}`))
+			recorder := httptest.NewRecorder()
+			srv.createSession(recorder, req)
+			if effort == "medium" {
+				if recorder.Code != http.StatusCreated || store.captured.ReasoningEffort != effort {
+					t.Fatalf("status=%d captured effort=%q body=%s", recorder.Code, store.captured.ReasoningEffort, recorder.Body)
+				}
+			} else if recorder.Code != http.StatusUnprocessableEntity || store.created {
+				t.Fatalf("unsupported effort accepted: status=%d", recorder.Code)
+			}
+		})
+	}
+}
+
 // stubAutolinkStore embeds Store (nil) so it satisfies the interface while
 // implementing only the methods createSession reaches on the auto-link path.
 type stubAutolinkStore struct {
```

**File**: `cloud/internal/postgres/migrations/00064_session_reasoning_effort.sql` (added, +5/-0)
```diff
@@ -0,0 +1,5 @@
+-- +goose Up
+ALTER TABLE ao_sessions ADD COLUMN reasoning_effort TEXT NOT NULL DEFAULT '';
+
+-- +goose Down
+ALTER TABLE ao_sessions DROP COLUMN reasoning_effort;
```

**File**: `cloud/internal/postgres/project_session_store.go` (modified, +4/-3)
```diff
@@ -687,10 +687,10 @@ func createSessionTx(
 		`WITH generated AS (SELECT gen_random_uuid() AS id)
 		INSERT INTO ao_sessions (
 			id, org_id, project_id, kind, harness, display_name, branch,
-			prompt, mode, model, denied_commands, interface, parent_session_id, created_by_user_id
+			prompt, mode, model, denied_commands, interface, parent_session_id, created_by_user_id, reasoning_effort
 		)
 		SELECT id, $1, $2, $3, $4, $5, 'ao/' || left(id::text, 8),
-			$6, $7, $8, $9, $10, NULLIF($11, '')::uuid, NULLIF($12, '')::uuid
+			$6, $7, $8, $9, $10, NULLIF($11, '')::uuid, NULLIF($12, '')::uuid, $13
 		FROM generated
 		RETURNING id, org_id, project_id, kind, harness, display_name, branch,
 			mode, model, denied_commands, interface, activity_state, is_terminated,
@@ -708,6 +708,7 @@ func createSessionTx(
 		input.Interface,
 		parentSessionID,
 		actorUserID,
+		input.ReasoningEffort,
 	), &session)
 	if err != nil {
 		return domain.Session{}, normalizeConstraintError(err)
@@ -761,7 +762,7 @@ func createSessionTx(
 	}
 	if input.Prompt != "" {
 		if _, err := appendUserMessageEvent(
-			ctx, tx, orgID, session.ID, input.Prompt,
+			ctx, tx, orgID, session.ID, input.Prompt, domain.ChatTurnSettings{Model: input.Model, ReasoningEffort: input.ReasoningEffort},
 		); err != nil {
 			return domain.Session{}, err
 		}
```

**File**: `cloud/internal/postgres/project_session_store_test.go` (modified, +20/-0)
```diff
@@ -48,6 +48,26 @@ func TestCreateSessionReturnsCompleteSession(t *testing.T) {
 	}
 }
 
+func TestCreateSessionPreservesInitialEffort(t *testing.T) {
+	store, _, fixture := openNotificationTestStore(t)
+	ctx := context.Background()
+	session, err := store.CreateSession(ctx, domain.Principal{UserID: fixture.userID, Provider: "local"}, fixture.orgID,
+		"create-effort-"+uuid.NewString(), 10, domain.CreateSession{
+			ProjectID: fixture.projectID, Kind: "worker", Harness: "claude-code", DisplayName: "Effort test",
+			Prompt: "hello", Provider: "docker", ReasoningEffort: "medium",
+		})
+	if err != nil {
+		t.Fatal(err)
+	}
+	launch, err := store.WorkerLaunchSpec(ctx, fixture.orgID, session.ID)
+	if err != nil {
+		t.Fatal(err)
+	}
+	if launch.ReasoningEffort != "medium" {
+		t.Fatalf("launch effort = %q, want medium", launch.ReasoningEffort)
+	}
+}
+
 func TestQueuedTurnDoesNotOverrideIdleWorkerActivity(t *testing.T) {
 	store, admin, fixture := openNotificationTestStore(t)
 	ctx := context.Background()
```

**File**: `cloud/internal/postgres/sandbox_store.go` (modified, +1/-1)
```diff
@@ -850,7 +850,7 @@ func (s *Store) WorkerLaunchSpec(
 				session.display_name, session.branch, session.prompt,
 				session.agent_session_id, session.mode,
 				COALESCE(NULLIF(selection.selected_model, ''), session.model),
-				COALESCE(selection.selected_effort, ''), COALESCE(selection.created_at, to_timestamp(0)), session.denied_commands, session.interface,
+				COALESCE(selection.selected_effort, session.reasoning_effort), COALESCE(selection.created_at, to_timestamp(0)), session.denied_commands, session.interface,
 				COALESCE(session.parent_session_id::text, ''),
 				project.repository_url, project.default_branch
 			FROM ao_sessions session
```

**File**: `cloud/internal/worker/protocol.go` (modified, +1/-0)
```diff
@@ -193,6 +193,7 @@ type ChatModel struct {
 }
 
 type ChatModelsResponse struct {
+	Modes           []string    `json:"modes,omitempty"`
 	Models          []ChatModel `json:"models"`
 	Model           string      `json:"model,omitempty"`
 	ReasoningEffort string      `json:"reasoningEffort,omitempty"`
```

---

### Incident Patch 4: `209b74df` (2026-10-05)
**Commit Message**: fix: restore blue brand accent for links and context meter (#6290)

#6276 greyed --color-brand-logo*, which drives markdown links, inline code,
the context meter, action pills and other accent UI. Restore the original
blue values in dark and light themes; the graphite surfaces stay.


Claude-Session: https://claude.ai/code/session_01FmicDZBs7usnMrVKvytgeK

Co-authored-by: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

**File**: `frontend/src/styles/tokens.css` (modified, +6/-6)
```diff
@@ -77,9 +77,9 @@
 	--color-text-primary: var(--foreground);
 	--color-text-muted: var(--muted-foreground);
 	--color-text-passive: var(--chart-3);
-	--color-brand-logo: #a6a6a6;
-	--color-brand-logo-bright: #d2d2d2;
-	--color-brand-logo-foreground: #252525;
+	--color-brand-logo: #79b0dc;
+	--color-brand-logo-bright: #a5cde7;
+	--color-brand-logo-foreground: #0a0b0d;
 	--color-text-markdown-code: var(--color-brand-logo);
 	--color-text-markdown-link: var(--color-brand-logo); /* underline distinguishes links */
 	--color-text-markdown-link-hover: var(--color-brand-logo-bright);
@@ -688,9 +688,9 @@
 	--color-text-primary: var(--foreground);
 	--color-text-muted: var(--muted-foreground);
 	--color-text-passive: var(--chart-3);
-	--color-brand-logo: #6f6f6f;
-	--color-brand-logo-bright: #8d8d8d;
-	--color-brand-logo-foreground: #fafafa;
+	--color-brand-logo: #304c83;
+	--color-brand-logo-bright: #466daa;
+	--color-brand-logo-foreground: #ffffff;
 	--color-text-markdown-code: var(--color-brand-logo);
 	--color-text-markdown-link: var(--color-brand-logo);
 	--color-text-markdown-link-hover: var(--color-brand-logo-bright);
```

---

### Incident Patch 5: `dded9f11` (2026-10-05)
**Commit Message**: fix(reviewers): disable declared MCP servers so Cursor reviewer panes never stall on approval (#5782)

* fix(reviewers): disable declared MCP servers so Cursor reviewer panes never stall on approval (#5707)

* fix(reviewers): reject ambiguous MCP server ids before disabling

An MCP server id starting with '-' would be parsed as a cursor-agent
option instead of the server id. '-h'/'--help' exit 0 having disabled
nothing, silently leaving the server enabled to stall the unattended
review on approval; end-of-options '--' is not honored by this CLI
(verified on cursor-agent 2026.09.10). Fail the review closed instead,
and cover option-shaped, blank, whitespace, Unicode, duplicate, and
large-list ids with regression tests.

**File**: `backend/internal/adapters/reviewer/cursor/config.go` (modified, +162/-0)
```diff
@@ -8,9 +8,12 @@ import (
 	"errors"
 	"fmt"
 	"os"
+	"os/exec"
 	"path/filepath"
+	"sort"
 	"strings"
 
+	workeragent "github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/cursor"
 	"github.com/aoagents/agent-orchestrator/backend/internal/adapters/agent/hookutil"
 	"github.com/aoagents/agent-orchestrator/backend/internal/ports"
 )
@@ -165,3 +168,162 @@ func reviewerAllowList(taskPromptRoot string) []string {
 	}
 	return allow
 }
+
+// applyReviewerMCPDisable records every MCP server Cursor would load for this
+// review as disabled inside the isolated reviewer profile. Cursor only asks
+// about MCP approval interactively, and a reviewer pane is unattended, so an
+// unanswered approval screen would stall the review forever. The servers are
+// also never spawned during review, which keeps checkout-controlled MCP
+// processes out of the reviewer.
+func applyReviewerMCPDisable(ctx context.Context, inv ports.ReviewInvocation) error {
+	if err := ctx.Err(); err != nil {
+		return err
+	}
+	ids, err := reviewerMCPConfigIDs(inv.WorkspacePath)
+	if err != nil {
+		return err
+	}
+	// Validate here, ahead of the disableMCPServers seam, so a hostile id
+	// fails the review closed even where process execution is substituted.
+	// execMCPServerDisable re-checks at the spawn boundary as defense in
+	// depth.
+	if err := validateMCPServerIDs(ids); err != nil {
+		return err
+	}
+	if len(ids) == 0 {
+		return nil
+	}
+	return disableMCPServers(ctx, inv, ids)
+}
+
+// disableMCPServers runs `cursor-agent mcp disable` for each declared server
+// id against the AO-owned reviewer profile. It is a variable so tests can
+// stub process execution.
+var disableMCPServers = execMCPServerDisable
+
+func execMCPServerDisable(ctx context.Context, inv ports.ReviewInvocation, ids []string) error {
+	if err := ctx.Err(); err != nil {
+		return err
+	}
+	// Reject before resolving the binary or spawning anything: an
+	// option-shaped id must never reach the CLI, where `-h`/`--help` would
+	// exit 0 having disabled nothing and silently leave the server enabled.
+	if err := validateMCPServerIDs(ids); err != nil {
+		return err
+	}
+	profileDir := reviewerProfileDir(inv)
+	if profileDir == "" {
+		return errors.New("cursor reviewer: AO data directory is required")
+	}
+	if strings.TrimSpace(inv.WorkspacePath) == "" {
+		return errors.New("cursor reviewer: workspace path is required to disable MCP servers")
+	}
+	binary, err := workeragent.ResolveCursorBinary(ctx)
+	if err != nil {
+		return fmt.Errorf("cursor reviewer: resolve cursor binary: %w", err)
+	}
+	for _, id := range ids {
+		cmd := mcpDisableCommand(ctx, binary, id, inv.WorkspacePath, profileDir)
+		if out, err := cmd.CombinedOutput(); err != nil {
+			detail := strings.Join(strings.Fields(string(out)), " ")
+			if detail != "" {
+				return fmt.Errorf("cursor reviewer: disable MCP server %q: %w: %s", id, err, detail)
+			}
+			return fmt.Errorf("cursor reviewer: disable MCP server %q: %w", id, err)
+		}
+	}
+	return nil
+}
+
+// validateMCPServerIDs rejects server ids that cannot be passed to
+// `cursor-agent mcp disable` unambiguously as a positional argument. Ids
+// beginning with `-` would be parsed as CLI options instead of the server id:
+// `-h`/`--help` exit 0 having disabled nothing (a silent bypass that leaves
+// the server enabled to stall the unattended review on approval), while other
+// option-shaped ids fail the disable outright. End-of-options `--` does not
+// help — verified against cursor-agent 2026.09.10, `mcp disable --
+// "--evil-flag"` still errors with `unknown option '--evil-flag'`. Rejecting
+// fails the review closed so the operator sees the misdeclared server instead
+// of a pane stuck forever on an approval screen. Empty ids cannot name a
+// server and are rejected for the same reason.
+func validateMCPServerIDs(ids []string) error {
+	for _, id := range ids {
+		switch {
+		case strings.TrimSpace(id) == "":
+			return fmt.Errorf("cursor reviewer: refuse to disable MCP server %q: empty identifiers cannot name a server; remove it from .cursor/mcp.json to review this workspace", id)
+		case strings.HasPrefix(id, "-"):
+			return fmt.Errorf("cursor reviewer: refuse to disable MCP server %q: identifiers starting with '-' would be parsed as cursor-agent options instead of the server id; rename or remove it from .cursor/mcp.json to review this workspace", id)
+		}
+	}
+	return nil
+}
+
+// mcpDisableCommand builds the Cursor CLI invocation that records one server
+// id as disabled in the reviewer profile for the review workspace. The
+// workspace working directory makes Cursor write the disable list under the
+// same project slug the reviewer pane will read. The id is passed bare (no
+// `--` separator): ids that would need one are rejected by
+// validateMCPServerIDs because this CLI does not honor end-of-options for
+// them, and everything reaching this point is a safe positional argument.
+func mcpDisableCommand(ct
```

**File**: `backend/internal/adapters/reviewer/cursor/cursor.go` (modified, +8/-2)
```diff
@@ -35,12 +35,18 @@ func (r *Reviewer) Harness() domain.ReviewerHarness {
 var _ ports.Reviewer = (*Reviewer)(nil)
 var _ ports.ReviewerCanceller = (*Reviewer)(nil)
 
-// PreLaunch installs the reviewer-only Cursor permissions into its isolated
-// AO-owned data directory without touching the checkout or user configuration.
+// PreLaunch installs the reviewer-only Cursor permissions and MCP policy into
+// its isolated AO-owned data directory without touching the checkout or user
+// configuration.
 func (r *Reviewer) PreLaunch(ctx context.Context, inv ports.ReviewInvocation) error {
 	if err := installReviewerConfig(ctx, inv); err != nil {
 		return err
 	}
+	// Disable every MCP server the review checkout or host config declares so
+	// the unattended pane cannot stall on Cursor's MCP approval screen.
+	if err := applyReviewerMCPDisable(ctx, inv); err != nil {
+		return err
+	}
 	return r.agent.InstallWorkspaceTrust(ctx, ports.WorkspaceHookConfig{
 		DataDir:       inv.DataDir,
 		Env:           reviewerEnv(inv),
```

**File**: `backend/internal/adapters/reviewer/cursor/cursor_test.go` (modified, +252/-0)
```diff
@@ -4,9 +4,11 @@ import (
 	"context"
 	"encoding/json"
 	"errors"
+	"fmt"
 	"os"
 	"path/filepath"
 	"reflect"
+	"sort"
 	"strings"
 	"testing"
 
@@ -187,6 +189,7 @@ func TestReviewCancelUsesTwoInterrupts(t *testing.T) {
 func TestPreLaunchWritesIsolatedReviewerConfig(t *testing.T) {
 	home := t.TempDir()
 	t.Setenv("HOME", home)
+	t.Setenv("USERPROFILE", home)
 	userConfigPath := filepath.Join(home, ".cursor", cursorConfigFileName)
 	if err := os.MkdirAll(filepath.Dir(userConfigPath), 0o700); err != nil {
 		t.Fatal(err)
@@ -273,6 +276,7 @@ func TestPreLaunchWritesIsolatedReviewerConfig(t *testing.T) {
 func TestPreLaunchSeedsAuthInfoIntoIsolatedReviewerConfig(t *testing.T) {
 	home := t.TempDir()
 	t.Setenv("HOME", home)
+	t.Setenv("USERPROFILE", home)
 	userConfigPath := filepath.Join(home, ".cursor", cursorConfigFileName)
 	if err := os.MkdirAll(filepath.Dir(userConfigPath), 0o700); err != nil {
 		t.Fatal(err)
@@ -311,6 +315,9 @@ func TestPreLaunchSeedsAuthInfoIntoIsolatedReviewerConfig(t *testing.T) {
 }
 
 func TestPreLaunchWithoutPromptRootOmitsExternalRead(t *testing.T) {
+	home := t.TempDir()
+	t.Setenv("HOME", home)
+	t.Setenv("USERPROFILE", home)
 	inv := ports.ReviewInvocation{ReviewerID: "review-w1", DataDir: t.TempDir(), WorkspacePath: t.TempDir()}
 	if err := New().PreLaunch(context.Background(), inv); err != nil {
 		t.Fatalf("PreLaunch: %v", err)
@@ -333,6 +340,251 @@ func TestPreLaunchHonorsContextCancellation(t *testing.T) {
 	}
 }
 
+func TestPreLaunchDisablesDeclaredMCPServers(t *testing.T) {
+	home := isolateUserHome(t)
+	writeMCPJson(t, filepath.Join(home, ".cursor", "mcp.json"), "user-server")
+	workspace := t.TempDir()
+	writeMCPJson(t, filepath.Join(workspace, ".cursor", "mcp.json"), "zeta-server", "alpha-server", "user-server")
+	calls := stubMCPServerDisable(t)
+
+	inv := ports.ReviewInvocation{
+		ReviewerID:    "review-w1",
+		DataDir:       t.TempDir(),
+		WorkspacePath: workspace,
+	}
+	if err := New().PreLaunch(context.Background(), inv); err != nil {
+		t.Fatalf("PreLaunch: %v", err)
+	}
+
+	if len(*calls) != 1 {
+		t.Fatalf("disable calls = %d, want 1 (%#v)", len(*calls), *calls)
+	}
+	got := (*calls)[0]
+	want := []string{"alpha-server", "user-server", "zeta-server"}
+	if !reflect.DeepEqual(got.ids, want) {
+		t.Fatalf("ids = %#v, want %#v", got.ids, want)
+	}
+	if got.inv.WorkspacePath != workspace || got.inv.DataDir != inv.DataDir || got.inv.ReviewerID != inv.ReviewerID {
+		t.Fatalf("invocation = %+v, want workspace/dataDir/reviewer of %+v", got.inv, inv)
+	}
+}
+
+func TestPreLaunchSkipsMCPServerDisableWithoutDeclarations(t *testing.T) {
+	isolateUserHome(t)
+	calls := stubMCPServerDisable(t)
+
+	inv := ports.ReviewInvocation{
+		ReviewerID:    "review-w1",
+		DataDir:       t.TempDir(),
+		WorkspacePath: t.TempDir(),
+	}
+	if err := New().PreLaunch(context.Background(), inv); err != nil {
+		t.Fatalf("PreLaunch: %v", err)
+	}
+	if len(*calls) != 0 {
+		t.Fatalf("disable calls = %d, want none (%#v)", len(*calls), *calls)
+	}
+}
+
+func TestPreLaunchRejectsMalformedMCPConfig(t *testing.T) {
+	isolateUserHome(t)
+	workspace := t.TempDir()
+	if err := os.MkdirAll(filepath.Join(workspace, ".cursor"), 0o700); err != nil {
+		t.Fatal(err)
+	}
+	if err := os.WriteFile(filepath.Join(workspace, ".cursor", "mcp.json"), []byte("{not json"), 0o600); err != nil {
+		t.Fatal(err)
+	}
+	calls := stubMCPServerDisable(t)
+
+	err := New().PreLaunch(context.Background(), ports.ReviewInvocation{
+		ReviewerID:    "review-w1",
+		DataDir:       t.TempDir(),
+		WorkspacePath: workspace,
+	})
+	if err == nil || !strings.Contains(err.Error(), "MCP config") {
+		t.Fatalf("PreLaunch err = %v, want MCP config parse failure", err)
+	}
+	if len(*calls) != 0 {
+		t.Fatalf("disable calls = %d, want none", len(*calls))
+	}
+}
+
+func TestPreLaunchRejectsOptionShapedMCPServerID(t *testing.T) {
+	home := isolateUserHome(t)
+	// `-x` in the host config covers the host read path; `--help` in the
+	// workspace config is the silent-bypass regression: `cursor-agent mcp
+	// disable --help` exits 0 having disabled nothing, so without rejection
+	// the server would stay enabled and stall the unattended review.
+	writeMCPJson(t, filepath.Join(home, ".cursor", "mcp.json"), "-x")
+	workspace := t.TempDir()
+	writeMCPJson(t, filepath.Join(workspace, ".cursor", "mcp.json"), "--help")
+	calls := stubMCPServerDisable(t)
+
+	err := New().PreLaunch(context.Background(), ports.ReviewInvocation{
+		ReviewerID:    "review-w1",
+		DataDir:       t.TempDir(),
+		WorkspacePath: workspace,
+	})
+	if err == nil || !strings.Contains(err.Error(), `"--help"`) {
+		t.Fatalf("PreLaunch err = %v, want refusal naming the option-shaped id", err)
+	}
+	if len(*calls) != 0 {
+		t.Fatalf("disable calls = %d, want none: the ambiguous id must never reach the CLI (%#v)", len(*calls), *calls)
+	}
+}
+
+func TestExecMCPServerDisableRejectsAmbiguousIDs(t *testing.T) {
+	for _, id := range []string{"--help", "-h", "-x", "-", "", "   "} {

```

---

### Incident Patch 6: `d0128364` (2026-10-05)
**Commit Message**: fix(chat): avoid long-history freezes on session switch (#6129)

* fix(chat): virtualize long transcripts on session switch

* test(chat): wait for accepted-turn notifications

* fix(chat): preserve scroll layout and resumed streaming text

* fix(chat): retain scroll and activity disclosure state

* test(chat): tolerate completed stream frame

**File**: `docs/performance/chat-responsiveness/README.md` (modified, +6/-4)
```diff
@@ -8,7 +8,7 @@ This change reduces AO's event-delivery and renderer overhead. It does not chang
 | --- | --- | --- |
 | CDC events arriving every 100 ms repeatedly reset the shared 150 ms debounce, delaying refresh until traffic stops. | Keep the first event's 150 ms deadline. Coalesce IDs, let active fetches finish, and queue a catch-up when an event predates their completion. | Targeted routing, full reconnect refresh, account/workspace boundaries, and durable snapshots. |
 | Already-received text drains at 58–720 graphemes/second; long bursts stay buffered. `useRef` initializers also segment complete strings on each render. | Segment once per changed text; append only new graphemes; flush received backlog on the first animation frame at/after 200 ms from scheduling. | Initial snapshots, completed messages, visible-prefix corrections, Unicode reconciliation, copy, reduced motion, and the Markdown parser. |
-| Scrolling scans and measures every loaded human-prompt anchor repeatedly. | Cache content-space positions; invalidate on content mutations, layout synchronization, dimensions, and resize observation. | Every loaded turn stays mounted. Find, selection, prompt spacing, pinning, and minimap navigation remain available. |
+| Scrolling scans and measures every loaded human-prompt anchor repeatedly. | Cache content-space positions; invalidate on content mutations, layout synchronization, dimensions, and resize observation. | In the measured implementation, every loaded turn stayed mounted. The current long-history timeline virtualizes offscreen turns; see [the current limits](#deliberate-limits). |
 | Large syntax blocks run tokenization on the renderer despite an async function signature. | Use a lazy module worker above 20,000 characters with the same grammar engine. | Small warm synchronous highlights, grammar aliases, token output, escaping, source text, and copying. |
 
 The worker has bounded pending work (32 jobs / 1,000,000 source characters) and a 10-second timeout. Worker failure, unsupported workers, or an oversized/saturated request leave readable plain code instead of performing expensive synchronous fallback. Colorization may therefore be omitted in these cases; source text is retained. Mermaid remains available and is untouched.
@@ -20,7 +20,7 @@ The opt-in Playwright fixture imports the actual AO renderer components and even
 - **Delivery:** 20 conversation CDC events, 100 ms apart, an active TanStack Query observer, and a simulated 30 ms query. Let the bridge's initial lifecycle refresh settle before the timed workload. Record actual fetch starts/completions and whether they occur before the stream ends.
 - **Streaming:** deliver a 997 UTF-16-character Unicode burst after the initial snapshot. Record time until rendered text exactly matches the received string, then check completion restores the copy button. This measures received-to-DOM-visible lag; it does not instrument display scanout.
 - **Highlighting:** warm the existing TypeScript grammar, highlight 10,000 lines (537,779 UTF-16 characters), and sample the main event loop every 4 ms. Record elapsed highlighting time separately from the worst callback gap. This isolates the tokenizer API and excludes React's rendering of the returned token tree. Worker startup/transfer is included.
-- **Scrolling:** mount 250 fixture turns, wait for fonts/layout, then perform 120 scroll steps. Count actual anchor `getBoundingClientRect()` calls and record frame gaps. Assert all 250 anchors remain mounted. This measures repeated layout reads, not total app memory.
+- **Scrolling:** the measured implementation mounted 250 fixture turns, waited for fonts/layout, then performed 120 scroll steps. It counted actual anchor `getBoundingClientRect()` calls, asserted all 250 anchors remained mounted, and recorded frame gaps. The current implementation virtualizes offscreen turns; this historical measurement captures the pre-virtualization scroll-cache change and does not characterize current mounted DOM range.
 
 Baseline is commit `a96322315`. The identical fixture files are copied into the baseline checkout. Final measurements run serially with one Playwright worker, three repetitions per workload, without overlapping test/build jobs. Raw records include browser, Node version, OS/architecture, CPU count, viewport, timestamp, and every sampled gap. Three runs support descriptive medians/ranges, not population percentiles or a universal speedup claim. The host is a shared developer machine.
 
@@ -38,7 +38,7 @@ Apple M5, 10 logical CPUs, 24 GiB RAM; macOS arm64; Node 24.20.0; Chromium 148.0
 | Anchor geometry reads | 60,001.0 (60,001.0–60,252.0) | 251.0 (251.0–251.0) |
 | Maximum scroll frame gap per run (ms) | 25.8 (17.7–33.2) | 17.6 (16.7–25.0) |
 
-Continuous traffic now causes ten fetches before the stream ends, rather than waiting for silence. Repeated anchor measurements fall by 99.6% while all 250 turns stay mounted.
+Continuous traffic now causes ten f
```

**File**: `frontend/src/renderer/components/chat/ActivityRun.tsx` (modified, +44/-7)
```diff
@@ -23,11 +23,29 @@ import {
 } from "./activity-command";
 import { fileChangeFiles, type ConversationActivity } from "../../types/conversation";
 
-export function ActivityRun({ activities }: { activities: ConversationActivity[] }) {
+export function ActivityRun({
+	activities,
+	disclosureKey,
+	disclosureOverrides,
+	onDisclosureChange,
+}: {
+	activities: ConversationActivity[];
+	disclosureKey?: string;
+	disclosureOverrides?: Readonly<Record<string, boolean>>;
+	onDisclosureChange?: (key: string, open: boolean) => void;
+}) {
 	// null until someone decides, so a run holding a command that is printing right
 	// now can open itself and close again once everything settles. A click pins the
 	// choice either way.
-	const [override, setOverride] = useState<boolean | null>(null);
+	const [localOverride, setLocalOverride] = useState<boolean | null>(null);
+	const override = disclosureKey && disclosureOverrides
+		? disclosureOverrides[disclosureKey] ?? null
+		: localOverride;
+	const updateOverride = (key: string, open: boolean) => {
+		if (disclosureKey && onDisclosureChange) onDisclosureChange(key, open);
+		else setLocalOverride(open);
+	};
+	const overrides = disclosureOverrides ?? {};
 	const reducedMotion = useReducedMotion();
 	const running = activities.some((a) => a.status === "running");
 	const nonzeroExits = activities.filter(isNonzeroCommandExit).length;
@@ -72,7 +90,7 @@ export function ActivityRun({ activities }: { activities: ConversationActivity[]
 		>
 			<button
 				type="button"
-				onClick={() => setOverride(!open)}
+				onClick={() => updateOverride(disclosureKey ?? "", !open)}
 				aria-expanded={open}
 				className={cn(ACTIVITY_SUMMARY_BUTTON_CLASS, "activity-run-toggle")}
 			>
@@ -139,7 +157,14 @@ export function ActivityRun({ activities }: { activities: ConversationActivity[]
 										);
 								  })
 								: subgroups.map((group) => (
-										<ActivitySubgroup key={group.key} activities={group.activities} nodesByActivityID={nodesByActivityID} />
+										<ActivitySubgroup
+											key={group.activities.map((activity) => activity.id).join(":")}
+											disclosureKey={disclosureKey ? `${disclosureKey}:sub:${group.activities.map((activity) => activity.id).join(":")}` : undefined}
+											disclosureOverrides={overrides}
+											onDisclosureChange={updateOverride}
+											activities={group.activities}
+											nodesByActivityID={nodesByActivityID}
+										/>
 								  ))}
 						</div>
 					</motion.div>
@@ -173,16 +198,28 @@ function activityGroupKey(activity: ConversationActivity): string {
 function ActivitySubgroup({
 	activities,
 	nodesByActivityID,
+	disclosureKey,
+	disclosureOverrides,
+	onDisclosureChange,
 }: {
 	activities: ConversationActivity[];
 	nodesByActivityID: ReadonlyMap<string, ActivityNode>;
+	disclosureKey?: string;
+	disclosureOverrides: Readonly<Record<string, boolean>>;
+	onDisclosureChange?: (key: string, open: boolean) => void;
 }) {
-	const [override, setOverride] = useState<boolean | null>(null);
+	const [localOverride, setLocalOverride] = useState<boolean | null>(null);
 	const reducedMotion = useReducedMotion();
 	const streamingOutput = activities.some((activity) =>
 		activity.status === "running" && Boolean(activity.detail?.output),
 	);
-	const open = override ?? streamingOutput;
+	const open = disclosureKey
+		? disclosureOverrides[disclosureKey] ?? streamingOutput
+		: localOverride ?? streamingOutput;
+	const updateOverride = (next: boolean) => {
+		if (disclosureKey && onDisclosureChange) onDisclosureChange(disclosureKey, next);
+		else setLocalOverride(next);
+	};
 	const hasNestedAgent = activities.some((activity) =>
 		nodesByActivityID.get(activity.id)?.children.length,
 	);
@@ -206,7 +243,7 @@ function ActivitySubgroup({
 		<div className="activity-subgroup">
 			<button
 				type="button"
-				onClick={() => setOverride(!open)}
+				onClick={() => updateOverride(!open)}
 				aria-expanded={open}
 				className={cn(ACTIVITY_SUMMARY_BUTTON_CLASS, "activity-subgroup-toggle")}
 			>
```

**File**: `frontend/src/renderer/components/chat/ChatTimelineItems.test.tsx` (modified, +30/-0)
```diff
@@ -89,6 +89,36 @@ describe("TurnOutcome", () => {
 });
 
 describe("AssistantMessage streaming", () => {
+	it("shows completed messages without a duplicate animation segmentation pass", () => {
+		const segment = vi.spyOn(Intl.Segmenter.prototype, "segment");
+		const text = "Completed 👨‍👩‍👧‍👦 é answer";
+		render(<AssistantMessage message={message({ text, streaming: false })} />);
+		expect(document.querySelector("p")?.textContent).toBe(text);
+		// Markdown may segment for emoji typography; settled text needs no
+		// additional pass for the streaming animation.
+		expect(segment.mock.calls.filter(([input]) => input === text).length).toBeLessThanOrEqual(1);
+	});
+
+	it("resumes a completed message without repeating its visible prefix", () => {
+		const prefix = "Hello 👨‍👩‍👧‍👦 é";
+		const text = prefix + " continued".repeat(20);
+		const view = render(<AssistantMessage message={message({ text: prefix, streaming: false })} />);
+		view.rerender(<AssistantMessage message={message({ text, streaming: true, revision: 2 })} />);
+
+		runFrame(0);
+		runFrame(100);
+		const visible = document.querySelector("p")?.textContent ?? "";
+		expect(visible.startsWith(prefix)).toBe(true);
+		expect(text.startsWith(visible)).toBe(true);
+
+		// The drain may already have completed by this point, in which case there
+		// is no animation frame left to run. Assert the deadline's visible result
+		// rather than requiring an implementation-specific extra frame.
+		if (frames.size > 0) runFrame(250);
+		expect(document.querySelector("p")?.textContent).toBe(text);
+		expect(frames.size).toBe(0);
+	});
+
 	it("shows the first durable snapshot and a replacement message immediately", () => {
 		const text = "A first snapshot 👨‍👩‍👧‍👦";
 		const view = render(<AssistantMessage message={message({ text })} />);
```

**File**: `frontend/src/renderer/components/chat/ChatTimelineItems.tsx` (modified, +5/-2)
```diff
@@ -147,7 +147,10 @@ function useSmoothStreamingText(message: ConversationMessage): string {
 	const [visibleText, setVisibleText] = useState(() => message.text);
 	const visibleRef = useRef(visibleText);
 	const targetRef = useRef(message.text);
-	const targetGraphemes = useMemo(() => streamGraphemes(message.text), [message.text]);
+	const targetGraphemes = useMemo(
+		() => message.streaming ? streamGraphemes(message.text) : [],
+		[message.text, message.streaming],
+	);
 	const visibleGraphemeCountRef = useRef(targetGraphemes.length);
 	const targetGraphemesRef = useRef(targetGraphemes);
 	const messageIdRef = useRef(message.id);
@@ -265,9 +268,9 @@ function useSmoothStreamingText(message: ConversationMessage): string {
 		// different target grapheme. Reconcile that trailing fragment before using
 		// the old grapheme count, otherwise the drain can skip the merged suffix.
 		const reconciled = reconciledStreamPrefix(visibleRef.current, targetGraphemesRef.current);
+		visibleGraphemeCountRef.current = reconciled.count;
 		if (reconciled.text !== visibleRef.current) {
 			visibleRef.current = reconciled.text;
-			visibleGraphemeCountRef.current = reconciled.count;
 			setVisibleText(reconciled.text);
 		}
 		if (visibleGraphemeCountRef.current < targetGraphemesRef.current.length) scheduleDrain();
```

**File**: `frontend/src/renderer/components/chat/ChatWorkspace.test.tsx` (modified, +297/-0)
```diff
@@ -32,6 +32,45 @@ import {
 import { TooltipProvider } from "../ui/tooltip";
 
 const renameSessionMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
+let restoreTimelineGeometry: (() => void) | undefined;
+
+/** Emulate browser geometry and scroll range without mocking the virtualizer. */
+function stubVirtualTimelineGeometry(rowHeight: (index: number) => number = () => 600) {
+	const bounds = HTMLElement.prototype.getBoundingClientRect;
+	const height = Object.getOwnPropertyDescriptor(Element.prototype, "clientHeight")!.get!;
+	const scrollHeight = Object.getOwnPropertyDescriptor(Element.prototype, "scrollHeight")!.get!;
+	const offsetHeight = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight")!.get!;
+	const spies = [
+		vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
+			if (this.hasAttribute("data-index")) {
+				const log = this.closest<HTMLElement>('[role="log"]');
+				const offset = this.style.transform
+					? Number(this.style.transform.match(/translateY\(([-\d.]+)px\)/)?.[1] ?? 0)
+					: Number(this.dataset.index) * 618;
+				return { ...bounds.call(this), top: 20 + offset - (log?.scrollTop ?? 0), height: rowHeight(Number(this.dataset.index)), width: 768 } as DOMRect;
+			}
+			if (this.classList.contains("relative") && this.style.height) {
+				const log = this.closest<HTMLElement>('[role="log"]');
+				return { ...bounds.call(this), top: 20 - (log?.scrollTop ?? 0), height: Number.parseFloat(this.style.height), width: 768 } as DOMRect;
+			}
+			return bounds.call(this);
+		}),
+		vi.spyOn(Element.prototype, "clientHeight", "get").mockImplementation(function (this: Element) {
+			return this.getAttribute("role") === "log" ? 800 : height.call(this);
+		}),
+		vi.spyOn(Element.prototype, "scrollHeight", "get").mockImplementation(function (this: Element) {
+			if (this.getAttribute("role") !== "log") return scrollHeight.call(this);
+			const virtual = this.querySelector<HTMLElement>('.relative[style*="height"]');
+			const legacyHeight = virtual ? 0 : this.querySelectorAll("[data-chat-scroll-anchor]").length * 618;
+			return 20 + legacyHeight + Array.from(this.querySelectorAll<HTMLElement>('[style*="height"]'))
+				.reduce((sum, node) => sum + (Number.parseFloat(node.style.height) || 0), 0);
+		}),
+		vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function (this: HTMLElement) {
+			return this.hasAttribute("data-index") ? rowHeight(Number(this.dataset.index)) : Number.parseFloat(this.style.height) || offsetHeight.call(this);
+		}),
+	];
+	restoreTimelineGeometry = () => spies.forEach((spy) => spy.mockRestore());
+}
 
 vi.mock("../../lib/rename-session", () => ({ renameSession: renameSessionMock }));
 
@@ -169,6 +208,8 @@ beforeEach(() => {
 });
 
 afterEach(async () => {
+	restoreTimelineGeometry?.();
+	restoreTimelineGeometry = undefined;
 	setApiBaseUrl(null);
 	await appI18n.changeLanguage("en");
 });
@@ -1477,6 +1518,235 @@ describe("ChatWorkspace timeline", () => {
 		expect(scrollbar).toHaveAttribute("tabindex", "0");
 	});
 
+	it("opens large histories at the latest turn without mounting offscreen messages", async () => {
+		stubVirtualTimelineGeometry();
+		const snapshot = chatFixtureLongHistory(250);
+		const messages = snapshot.items.filter((item): item is ConversationMessage => item.kind === "message" && item.role === "user");
+		messages[0]!.text = "First historical prompt";
+		messages.at(-1)!.text = "Latest historical prompt";
+		render(<ChatWorkspace snapshot={snapshot} />);
+		expect(screen.getByText("Latest historical prompt")).toBeInTheDocument();
+		expect(screen.queryByText("First historical prompt")).not.toBeInTheDocument();
+		expect(screen.getByRole("log").querySelectorAll("[data-chat-scroll-anchor]").length).toBeLessThan(20);
+		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
+	});
+
+	it("opens at the bottom after measuring very tall latest turns", async () => {
+		stubVirtualTimelineGeometry((index) => index >= 98 ? 24000 : 600);
+		const snapshot = chatFixtureLongHistory(100);
+		const latest = snapshot.items.find((item) => item.kind === "message" && item.role === "user" && item.turnId === "turn-h99") as ConversationMessage;
+		latest.text = "Latest tall historical prompt";
+		render(<ChatWorkspace snapshot={snapshot} />);
+		const log = screen.getByRole("log");
+		await waitFor(() => expect(log.scrollTop).toBeGreaterThanOrEqual(log.scrollHeight - log.clientHeight));
+		fireEvent.scroll(log);
+		expect(screen.getByText("Latest tall historical prompt")).toBeInTheDocument();
+		expect(screen.queryByRole("button", { name: "Jump to latest" })).not.toBeInTheDocument();
+		await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
+	});
+
+	it("scrolls virtual history, keeps all minimap targets, and returns to the latest turn", async () => {
+		stubVirtualTimelineGeometry();
+		useUiStore.setState
```

**File**: `frontend/src/renderer/components/chat/ChatWorkspace.tsx` (modified, +131/-10)
```diff
@@ -32,6 +32,12 @@ import {
 import { ArrowDown, Loader2, TriangleAlert, Undo2 } from "lucide-react";
 import { Reorder, useDragControls } from "motion/react";
 import { useTranslation } from "react-i18next";
+import {
+	defaultRangeExtractor,
+	measureElement,
+	observeElementRect,
+	useVirtualizer,
+} from "@tanstack/react-virtual";
 import { cn } from "../../lib/utils";
 import {
 	acknowledgeChatInlineEditMutation,
@@ -2019,6 +2025,11 @@ function ControllerBanner({
  * the turn that changed. Older pages are prepended explicitly instead of keeping
  * an unbounded history in every snapshot response.
  */
+const CHAT_VIRTUALIZE_THRESHOLD = 20;
+const CHAT_ESTIMATED_TURN_HEIGHT = 600;
+const CHAT_TURN_GAP = 18;
+const CHAT_INITIAL_VIEWPORT_HEIGHT = 800;
+
 function Timeline({
 	snapshot,
 	assetBaseUrl,
@@ -2070,6 +2081,10 @@ function Timeline({
 	const uiSessionId = draftScope.sessionId;
 	const scroller = useRef<HTMLDivElement>(null);
 	const scrollContent = useRef<HTMLDivElement>(null);
+	const virtualContent = useRef<HTMLDivElement>(null);
+	const [virtualScrollMargin, setVirtualScrollMargin] = useState(20);
+	const measuredVirtualGroups = useRef(new WeakSet<TimelineGroup>());
+	const pendingVirtualLayout = useRef(false);
 	const promptSpacer = useRef<HTMLDivElement>(null);
 	const scrollTrack = useRef<HTMLDivElement>(null);
 	const drag = useRef<{
@@ -2079,6 +2094,10 @@ function Timeline({
 	} | null>(null);
 	const pinnedRef = useRef(true);
 	const [pinned, setPinned] = useState(true);
+	const [activityDisclosureOverrides, setActivityDisclosureOverrides] = useState<Record<string, boolean>>({});
+	const onActivityDisclosureChange = useCallback((key: string, open: boolean) => {
+		setActivityDisclosureOverrides((current) => ({ ...current, [key]: open }));
+	}, []);
 	const [hoveredMarker, setHoveredMarker] = useState<number | null>(null);
 	const hoveredMarkerRef = useRef<number | null>(null);
 	hoveredMarkerRef.current = hoveredMarker;
@@ -2638,9 +2657,72 @@ function Timeline({
 	const groups = useStableList(grouped, groupKey, sameGroup);
 	const navigableGroups = useMemo(() => groups.filter(groupHasHumanPrompt), [groups]);
 	const previews = useMemo(() => navigableGroups.map(groupPreview), [navigableGroups]);
+	const virtualized = groups.length > CHAT_VIRTUALIZE_THRESHOLD;
+	const virtualItemKey = useCallback((index: number) => groups[index]!.key, [groups]);
+	const virtualizer = useVirtualizer({
+		// Scroll anchoring may notify during a layout effect; defer the React
+		// update rather than attempting a synchronous flush inside that effect.
+		useFlushSync: false,
+		// Measure short histories too, so crossing the windowing threshold can
+		// preserve the visible turn by key rather than restarting at the bottom.
+		enabled: groups.length > 0,
+		count: groups.length,
+		getScrollElement: () => scroller.current,
+		getItemKey: virtualItemKey,
+		estimateSize: () => CHAT_ESTIMATED_TURN_HEIGHT,
+		gap: CHAT_TURN_GAP,
+		overscan: 2,
+		scrollMargin: virtualScrollMargin,
+		initialRect: { width: 768, height: CHAT_INITIAL_VIEWPORT_HEIGHT },
+		initialOffset: () => virtualized
+			? Math.max(0, groups.length * (CHAT_ESTIMATED_TURN_HEIGHT + CHAT_TURN_GAP) - CHAT_INITIAL_VIEWPORT_HEIGHT)
+			: 0,
+		anchorTo: virtualized ? "end" : "start",
+		// The virtualizer's distance-from-end excludes the trailing prompt spacer.
+		// Disable end anchoring while unpinned so streamed output cannot mistake the
+		// reader's position for the physical end of the scroll container.
+		scrollEndThreshold: pinned ? 1 : -1,
+		followOnAppend: virtualized && pinned,
+		// Bootstrap unmeasurable panels until their real geometry is available.
+		observeElementRect: (instance, callback) => observeElementRect(instance, (rect) =>
+			callback(rect.height ? rect : { width: rect.width, height: CHAT_INITIAL_VIEWPORT_HEIGHT })),
+		measureElement: (element, entry, instance) => {
+			const group = groups[Number(element.getAttribute("data-index"))];
+			if (group && !measuredVirtualGroups.current.has(group)) {
+				measuredVirtualGroups.current.add(group);
+				pendingVirtualLayout.current = true;
+			}
+			return measureElement(element, entry, instance) || CHAT_ESTIMATED_TURN_HEIGHT;
+		},
+		scrollToFn: (offset, { adjustments = 0 }, instance) => {
+			if (instance.scrollElement) instance.scrollElement.scrollTop = offset + adjustments;
+		},
+		rangeExtractor: (range) => {
+			const indexes = defaultRangeExtractor(range);
+			// Keep an in-progress inline edit mounted while its row leaves view.
+			const editing = messageEdit ? groups.findIndex((group) => group.turnId === messageEdit.turnId) : -1;
+			if (editing >= 0 && !indexes.includes(editing)) indexes.push(editing);
+			if (pinned && !indexes.includes(groups.length - 1)) indexes.push(groups.length - 1);
+			return indexes.sort((a, b) => a - b);
+		},
+	});
+	virtualizer.shouldAdjustScrollPositionOnItemSizeChange = virtualized ? undefined : () => false;
+	const virtualRows = virtu
```

**File**: `frontend/src/renderer/hooks/useConversation.test.tsx` (modified, +1/-1)
```diff
@@ -207,7 +207,7 @@ describe("accepted conversation sends", () => {
 			await firstSend;
 		});
 
-		expect(result.current.pendingAcceptedTurnId).toBe("turn-2");
+		await waitFor(() => expect(result.current.pendingAcceptedTurnId).toBe("turn-2"));
 		rerender({ sessionId: "ao-1" });
 		expect(result.current.pendingAcceptedTurnId).toBe("turn-1");
 	});
```

---

### Incident Patch 7: `0197833b` (2026-10-05)
**Commit Message**: fix: unify the effort picker and select a default effort (#6272)

Share one effort picker across New Task, project settings and chat, show only concrete localized levels, and select a middle level when a model reports levels but no default.

Known follow-up: cloud chat can set an effort on an existing conversation before its history loads.

Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01NXY7qwuMsT4wya593iPs8b

**File**: `frontend/src/renderer/components/ProjectSettingsForm.test.tsx` (modified, +1/-1)
```diff
@@ -521,7 +521,7 @@ describe("ProjectSettingsForm", () => {
 		});
 		renderSettings("proj-1", undefined, "agents");
 		const picker = await screen.findByRole("button", { name: "Worker model" });
-		expect(picker).toHaveTextContent("Opus · Effort not reported");
+		expect(picker).toHaveTextContent("Opus · Medium");
 		expect(picker).not.toHaveTextContent("Claude");
 		await userEvent.click(picker);
 		expect(screen.getByRole("menuitem", { name: "Opus" })).toBeInTheDocument();
```

**File**: `frontend/src/renderer/components/TaskComposer.test.tsx` (modified, +47/-8)
```diff
@@ -585,7 +585,7 @@ describe("TaskComposer", () => {
 		fireEvent.click(screen.getByLabelText("Agent"));
 		const effort = await screen.findByRole("button", { name: "Effort" });
 		await userEvent.click(effort);
-		await userEvent.click(screen.getByRole("menuitem", { name: "High" }));
+		await userEvent.click(screen.getByRole("menuitemradio", { name: "High" }));
 		fireEvent.click(screen.getByText("Start task"));
 
 		await waitFor(() =>
@@ -596,6 +596,45 @@ describe("TaskComposer", () => {
 		);
 	});
 
+	it("selects and sends a middle effort when the model reports levels but no default", async () => {
+		h.get.mockImplementation(async (path: string) => {
+			if (path.includes("/models")) {
+				return {
+					data: {
+						agent: "codex",
+						selectionMode: "text",
+						models: [{ id: "gpt-5", label: "GPT-5", isDefault: true, efforts: ["low", "medium", "high", "xhigh"] }],
+						allowCustom: true,
+						refreshRecommended: false,
+					},
+				};
+			}
+			return { data: { status: "ok", project: { config: {} } } };
+		});
+		h.post.mockResolvedValueOnce({ data: { session: { id: "standalone-1" } } });
+
+		render(
+			<Wrap>
+				<TaskComposer projectId="__standalone__" onCreated={vi.fn()} />
+			</Wrap>,
+		);
+
+		fireEvent.click(screen.getByLabelText("Agent"));
+		const effort = await screen.findByRole("button", { name: "Effort" });
+		expect(effort).toHaveTextContent(/^Medium$/);
+		await userEvent.click(effort);
+		expect(screen.getByRole("menuitemradio", { name: "Medium" })).toHaveAttribute("aria-checked", "true");
+		await userEvent.keyboard("{Escape}");
+		fireEvent.click(screen.getByText("Start task"));
+
+		await waitFor(() =>
+			expect(h.post).toHaveBeenCalledWith(
+				"/api/v1/sessions",
+				expect.objectContaining({ body: expect.objectContaining({ effort: "medium" }) }),
+			),
+		);
+	});
+
 	it("does not run provider readiness before Start", async () => {
 		render(
 			<Wrap>
@@ -1266,7 +1305,7 @@ describe("TaskComposer", () => {
 			</Wrap>,
 		);
 		await userEvent.click(await screen.findByRole("button", { name: "Effort" }));
-		await userEvent.click(await screen.findByRole("menuitem", { name: "High" }));
+		await userEvent.click(await screen.findByRole("menuitemradio", { name: "High" }));
 		fireEvent.change(task(), { target: { value: "Do the thing" } });
 		await waitForTaskReady();
 		fireEvent.click(screen.getByText("Start task"));
@@ -1797,14 +1836,14 @@ describe("TaskComposer", () => {
 		expect(h.post.mock.calls[0][1].body).not.toHaveProperty("effort");
 
 		await userEvent.click(effortPicker);
-		await userEvent.click(await screen.findByRole("menuitem", { name: "Low" }));
+		await userEvent.click(await screen.findByRole("menuitemradio", { name: "Low" }));
 		fireEvent.click(screen.getByText("Start task"));
 		await waitFor(() => expect(h.post).toHaveBeenCalledTimes(2));
 		expect(h.post.mock.calls[1][1].body).toEqual(expect.objectContaining({ effort: "low" }));
 
 		await userEvent.click(effortPicker);
 		expect(screen.queryByRole("menuitem", { name: "Default" })).not.toBeInTheDocument();
-		await userEvent.click(await screen.findByRole("menuitem", { name: "High" }));
+		await userEvent.click(await screen.findByRole("menuitemradio", { name: "High" }));
 		fireEvent.click(screen.getByText("Start task"));
 		await waitFor(() => expect(h.post).toHaveBeenCalledTimes(3));
 		expect(h.post.mock.calls[2][1].body).not.toHaveProperty("effort");
@@ -1821,11 +1860,11 @@ describe("TaskComposer", () => {
 
 		render(<Wrap><TaskComposer projectId="proj-1" onCreated={vi.fn()} /></Wrap>);
 		const picker = await screen.findByRole("button", { name: "Effort" });
-		expect(picker).toHaveTextContent("Low");
+		await waitFor(() => expect(picker).toHaveTextContent("Low"));
 		await userEvent.click(picker);
-		await userEvent.click(screen.getByRole("menuitem", { name: "High" }));
+		await userEvent.click(screen.getByRole("menuitemradio", { name: "High" }));
 		await userEvent.click(picker);
-		await userEvent.click(screen.getByRole("menuitem", { name: "Low" }));
+		await userEvent.click(screen.getByRole("menuitemradio", { name: "Low" }));
 		fireEvent.click(startTask());
 		await waitFor(() => expect(h.post).toHaveBeenCalledOnce());
 		expect(h.post.mock.calls[0][1].body).not.toHaveProperty("effort");
@@ -1843,7 +1882,7 @@ describe("TaskComposer", () => {
 		render(<Wrap><TaskComposer projectId="proj-1" onCreated={vi.fn()} /></Wrap>);
 		const picker = await screen.findByRole("button", { name: "Effort" });
 		await userEvent.click(picker);
-		await userEvent.click(screen.getByRole("menuitem", { name: "High" }));
+		await userEvent.click(screen.getByRole("menuitemradio", { name: "High" }));
 		await userEvent.click(picker);
 		expect(screen.queryByRole("menuitem", { name: "Use agent effort" })).not.toBeInTheDocument();
 		await userEvent.keyboard("{Escape}");
```

**File**: `frontend/src/renderer/components/TaskComposer.tsx` (modified, +35/-29)
```diff
@@ -28,6 +28,7 @@ import { useCloudSandboxProviders } from "../hooks/useCloudSandboxProviders";
 import { useProviderConnections } from "../hooks/useProviderConnections";
 import { cloudAgentInfos, connectedCredentialType, credentialModelScope } from "../lib/cloud-agents";
 import { agentModelDisplayLabel, isConcreteModelID, modelChoiceLabel } from "../lib/agent-model-choices";
+import { fallbackEffort } from "../lib/effort";
 import {
 	buildRankedAgentOptions,
 	DEFAULT_AGENT_PRIORITY_RANK,
@@ -44,6 +45,7 @@ import {
 } from "../hooks/useAgentModelsQuery";
 import { STANDALONE_WORKSPACE_ID } from "../types/workspace";
 import { AgentModelCombobox } from "./settings/AgentModelCombobox";
+import { EffortPicker, type EffortAvailability } from "./settings/EffortPicker";
 import { useModelTuning } from "./settings/ModelTuningControls";
 import { SettingsOptionMenu } from "./settings/SettingsOptionMenu";
 import {
@@ -499,15 +501,25 @@ export function TaskComposer({
 	const effortOptions = effortModel?.efforts?.filter((option) => option && option.toLowerCase() !== "default") ?? [];
 	const inheritedEffort = selectedAgent === configuredProjectAgent ? defaultWorkerEffort : "";
 	const implicitEffort = inheritedEffort || effortModel?.defaultEffort || "";
-	const requestedEffort = effortTouched || rememberedEffortIsExplicit
-		? effort === implicitEffort ? undefined : effort
-		: undefined;
-
 	const selectedAgentLabel = agentCatalog?.agents.find((item) => item.id === selectedAgent)?.label || selectedAgent;
 	const requiresTuiFallback =
 		selectedAgent !== "" &&
 		settings?.defaultSessionMode === "chat" &&
 		!settings.chatHarnesses.includes(selectedAgent);
+	// With no provider default for the reported levels AO picks one, shows it as
+	// selected, and sends it, so the picker matches what the task runs with.
+	const aoDefaultEffort = requiresTuiFallback ? undefined : fallbackEffort(effortOptions, implicitEffort);
+	const effectiveEffort = effort && effort !== "default" ? effort : aoDefaultEffort ?? "";
+	const requestedEffort = effortTouched || rememberedEffortIsExplicit
+		? !effectiveEffort || effectiveEffort === implicitEffort ? undefined : effectiveEffort
+		: aoDefaultEffort;
+	const effortAvailability: EffortAvailability = requiresTuiFallback
+		? "launch-unavailable"
+		: !effortModel || effortModel.efforts === undefined
+			? "unknown"
+			: effortOptions.length > 0
+				? "supported"
+				: "unsupported";
 	const canSubmit =
 		hostConnected &&
 		Boolean(projectId) &&
@@ -705,7 +717,7 @@ export function TaskComposer({
 			effort={{
 				disabled: isSubmitting,
 				options: effortOptions,
-				value: effort,
+				value: effectiveEffort,
 				onChange: (value) => {
 					setEffort(value);
 					setEffortTouched(true);
@@ -729,43 +741,37 @@ export function TaskComposer({
 				onSubmit: (brief) => void submitTask(brief, selectedAgent === "unreal-agent" ? "chat" : requiresTuiFallback ? "tui" : undefined),
 			}}
 			renderAgentControl={(control) => <DesktopAgentControl {...control} hostId={hostId} manageView={isCloudProject ? "cloud" : "local"} />}
-			renderEffortControl={(control) => <TaskEffortPicker {...control} defaultEffort={effortModel?.defaultEffort} />}
+			renderEffortControl={(control) => <TaskEffortPicker {...control} defaultEffort={inheritedEffort || effortModel?.defaultEffort} availability={effortAvailability} />}
 			renderModelControl={(control) => <TaskModelPicker {...control} onRefresh={refreshSelectedModels}
 				showFollowAgentAction={Boolean(catalogDefaultOption || !isConcreteModelID(projectModelOrMode))} />}
-			showEffort={!requiresTuiFallback && effortOptions.length > 0}
+			showEffort={!requiresTuiFallback && (effortOptions.length > 0 || Boolean(effort && effort !== "default"))}
 		/>
 	);
 }
 
-function TaskEffortPicker({ disabled, label, onChange, options, value, defaultEffort }: TaskComposerEffortControl & { defaultEffort?: string }) {
-	const { t } = useTranslation();
-	const explicitEffort = value.toLowerCase() === "default" ? "" : value;
-	const reportedDefault = defaultEffort && options.includes(defaultEffort) ? defaultEffort : "";
-	const effectiveEffort = explicitEffort || reportedDefault;
-	const visibleLabel = effectiveEffort ? formatEffortLabel(effectiveEffort) : t("settings.models.effortNotReported");
-
+function TaskEffortPicker({
+	disabled,
+	label,
+	onChange,
+	options,
+	value,
+	defaultEffort,
+	availability,
+}: TaskComposerEffortControl & { defaultEffort?: string; availability: EffortAvailability }) {
 	return (
-		<SettingsOptionMenu
-			aria-label={label}
+		<EffortPicker
+			label={label}
 			disabled={disabled}
-			value={effectiveEffort}
-			options={options.map((option) => ({ value: option, label: formatEffortLabel(option) }))}
-			triggerClassName="composer-chip composer-toolbar-option w-full justify-between"
-			menuAlign="end"
-			renderTrigger={() => (
-				<span className="min-w-0 truncate text-control text-foreground" title={visibleLabel}>
-					{
```

**File**: `frontend/src/renderer/components/chat/ChatWorkspace.tsx` (modified, +3/-0)
```diff
@@ -1130,6 +1130,7 @@ function ChatWorkspaceContent({
 					configOptions={configOptions ?? []}
 					onChangeConfigOption={newWorkDisabled ? undefined : onChooseConfigOption}
 					configPending={configOptionPending}
+					autoSelectEffortOnOpen={snapshot.items.length === 0 && !turn}
 					error={configOptionError}
 					// Turn settings require a live controller even while messages can queue.
 					disabled={
@@ -1158,6 +1159,8 @@ function ChatWorkspaceContent({
 			approvalModes,
 			session?.cloud,
 			snapshot.controller.state,
+			snapshot.items.length,
+			turn,
 			stableModelReroute,
 			stableSettings,
 		],
```

**File**: `frontend/src/renderer/components/chat/TurnSettingsBar.test.tsx` (modified, +119/-8)
```diff
@@ -333,30 +333,32 @@ describe("ACP session config options", () => {
 		expect(onChange).toHaveBeenLastCalledWith("profile", { value: "default" });
 	});
 
-	it("hides the provider default effort choice while keeping concrete levels selectable", async () => {
+	it("shows a concrete effort level and preserves the native reset value", async () => {
 		const user = userEvent.setup();
 		const onChange = vi.fn();
 		const option: ChatConfigOption = {
 			id: "effort", name: "Effort", category: "thought_level", type: "select", currentValue: "default",
 			choices: [
-				{ value: "default", name: "Default" },
+				{ value: "default", name: "Default", description: "High" },
 				{ value: "low", name: "Low" },
 				{ value: "high", name: "High" },
 			],
 		};
 		const view = render(<TurnSettingsBar models={[]} settings={{}} onChangeConfigOption={onChange} configOptions={[option]} />);
 
 		const picker = screen.getByRole("button", { name: "Effort" });
-		expect(picker).toHaveTextContent("Effort");
+		expect(picker).toHaveTextContent("High");
 		await user.click(picker);
 		expect(screen.queryByRole("menuitemradio", { name: "Default" })).not.toBeInTheDocument();
-		await user.click(screen.getByRole("menuitemradio", { name: "High" }));
-		expect(onChange).toHaveBeenCalledWith("effort", { value: "high" });
+		await user.click(screen.getByRole("menuitemradio", { name: "Low" }));
+		expect(onChange).toHaveBeenCalledWith("effort", { value: "low" });
 		view.rerender(<TurnSettingsBar models={[]} settings={{}} onChangeConfigOption={onChange}
-			configOptions={[{ ...option, currentValue: "high" }]} />);
+			configOptions={[{ ...option, currentValue: "low" }]} />);
 		await user.click(screen.getByRole("button", { name: "Effort" }));
 		expect(screen.queryByRole("menuitemradio", { name: "Use agent effort" })).not.toBeInTheDocument();
 		expect(screen.queryByRole("menuitemradio", { name: "Default" })).not.toBeInTheDocument();
+		await user.click(screen.getByRole("menuitemradio", { name: "High" }));
+		expect(onChange).toHaveBeenLastCalledWith("effort", { value: "default" });
 	});
 
 	it("shows the concrete recommended model selected without a duplicate default option", async () => {
@@ -916,7 +918,7 @@ describe("remember project permissions", () => {
 });
 
 describe("native model selection", () => {
-	it("shows Claude's resolved model without default model or effort choices", async () => {
+	it("keeps Claude model choices while allowing effort reset", async () => {
 		const user = userEvent.setup();
 		const onChange = vi.fn();
 		render(<TurnSettingsBar harness="claude-code" onChange={onChange}
@@ -930,13 +932,26 @@ describe("native model selection", () => {
 		await user.click(picker);
 		await user.keyboard("{ArrowDown}{ArrowRight}");
 		expect(screen.getAllByRole("menuitemradio", { name: "Opus" })).toHaveLength(1);
-		expect(screen.queryByText(/default/i)).not.toBeInTheDocument();
+		expect(screen.queryByRole("menuitemradio", { name: "Default" })).not.toBeInTheDocument();
 		await user.keyboard("{ArrowLeft}{ArrowDown}{ArrowRight}");
 		expect(screen.queryByRole("menuitemradio", { name: "Default" })).not.toBeInTheDocument();
 		await user.click(screen.getByRole("menuitemradio", { name: "High" }));
 		expect(onChange).toHaveBeenCalledWith({ model: "default", reasoningEffort: "high" });
 	});
 
+	it("lets a saved effort be cleared when the model offers no effort levels", async () => {
+		const user = userEvent.setup();
+		const onChange = vi.fn();
+		render(<TurnSettingsBar harness="claude-code" onChange={onChange}
+			settings={{ model: "plain", reasoningEffort: "high" }}
+			models={[{ id: "plain", displayName: "Plain", default: true, efforts: [] }]} />);
+		await user.click(screen.getByRole("button", { name: "Model and reasoning effort for the next turn" }));
+		await user.keyboard("{ArrowDown}{ArrowDown}{ArrowRight}");
+		expect(screen.getByRole("menuitem", { name: "High (unavailable)" })).toHaveAttribute("aria-disabled", "true");
+		await user.click(screen.getByRole("menuitem", { name: "Clear effort" }));
+		expect(onChange).toHaveBeenCalledWith({ model: "plain", reasoningEffort: undefined });
+	});
+
 	it("keeps an explicit model visible when the catalog does not contain it", () => {
 		render(
 			<TurnSettingsBar
@@ -1516,3 +1531,99 @@ describe("OpenCode-style execution modes", () => {
 		expect(onChange).toHaveBeenCalledWith({ approvalMode: "default" });
 	});
 });
+
+describe("effort default when the provider reports none", () => {
+	const acpEffort = (overrides: Partial<ChatConfigOption> = {}): ChatConfigOption => ({
+		id: "effort",
+		name: "Effort",
+		category: "thought_level",
+		type: "select",
+		currentValue: "default",
+		choices: [
+			{ value: "default", name: "Default" },
+			{ value: "low", name: "Low" },
+			{ value: "medium", name: "Medium" },
+			{ value: "high", name: "High" },
+		],
+		...overrides,
+	});
+	const acpModel = (currentValue: string): ChatConfigOption => ({
+		id: "model",
+		nam
```

**File**: `frontend/src/renderer/components/chat/TurnSettingsBar.tsx` (modified, +128/-47)
```diff
@@ -19,6 +19,7 @@
 
 import { Fragment, useMemo, type FocusEvent, type ReactNode } from "react";
 import { Shuffle } from "lucide-react";
+import { useTranslation } from "react-i18next";
 import {
 	OptionMenu,
 	OptionMenuContent,
@@ -29,7 +30,9 @@ import {
 	OptionMenuSubTrigger,
 	OptionMenuTrigger,
 } from "../ui/option-menu";
+import { fallbackEffort, useApplyEffortDefault } from "../../lib/effort";
 import { cn } from "../../lib/utils";
+import { effortDisplayLabel, EffortMenuItems, EffortPicker, formatEffortLabel } from "../settings/EffortPicker";
 import { agentModelDisplayLabel, isDefaultPlaceholderLabel } from "../../lib/agent-model-choices";
 import { Switch } from "../ui/switch";
 import { ModelMenuChoices } from "./ModelMenuChoices";
@@ -95,6 +98,7 @@ export function TurnSettingsBar({
 	configPending,
 	error,
 	disabled,
+	autoSelectEffortOnOpen = false,
 	children,
 }: {
 	models: ChatModel[];
@@ -124,11 +128,19 @@ export function TurnSettingsBar({
 	) => Promise<unknown> | void;
 	/** Prevent overlapping writes because provider responses replace the catalog. */
 	configPending?: boolean;
+	/**
+	 * Pick an effort as soon as this opens when the model reports levels but no
+	 * default. Only for a conversation with no turns yet, so reopening an existing
+	 * one never changes the effort it was running with. Choosing another model
+	 * always selects one regardless.
+	 */
+	autoSelectEffortOnOpen?: boolean;
 	error?: string;
 	disabled?: boolean;
 	/** Inline controls on the right model row, before the mode/approval picker — queue vs steer. */
 	children?: ReactNode;
 }) {
+	const { t } = useTranslation();
 	const displayModels = useMemo(
 		() => models.map((model) => ({
 			...model,
@@ -162,20 +174,42 @@ export function TurnSettingsBar({
 	const availableEfforts = (selected ?? fallback)?.efforts ?? [];
 	const efforts = availableEfforts.filter((effort) => effort.toLowerCase() !== "default");
 	const selectedEffort =
-		settings.reasoningEffort ?? (selected ?? fallback)?.defaultEffort ?? undefined;
+		settings.reasoningEffort && settings.reasoningEffort !== "default"
+			? settings.reasoningEffort
+			: (selected ?? fallback)?.defaultEffort;
 	const effortLabel = selectedEffort === "default" ? undefined : selectedEffort;
 	const approvalCopy = harness === "codex" ? CODEX_APPROVAL_COPY : APPROVAL_COPY;
 	const approvalOrder = harness === "codex" ? CODEX_APPROVAL_ORDER : APPROVAL_ORDER;
 	const approvalLabel = approvalCopy[settings.approvalMode ?? "default"].label;
 	const modelGroupLabel = effortLabel
-		? `${modelLabel} ${capitalize(effortLabel)}`
+		? `${modelLabel} ${formatEffortLabel(effortLabel, t)}`
 		: modelLabel;
 	const grouped = partitionConfigOptions(displayConfigOptions);
 	const optionDisabled = Boolean(disabled || configPending || rememberPermissionsPending);
 	const applyOption = (optionId: string, value: ChatConfigOptionValue) => {
 		if (!onChangeConfigOption) return;
 		void Promise.resolve(onChangeConfigOption(optionId, value)).catch(() => {});
 	};
+	const nativeModelMenu = Boolean(onChange && displayModels.length > 0 && grouped.model.length === 0);
+	// A model with effort levels but no provider default would otherwise show no
+	// selected effort. AO picks a level and sets it, so what the picker shows is
+	// what the next turn uses.
+	const acpEffortOption = grouped.effort.at(0);
+	useApplyEffortDefault(
+		`${harness}:${grouped.model.map((option) => option.currentValue).join(":")}`,
+		acpEffortOption ? acpFallbackEffort(acpEffortOption) : undefined,
+		(value) => {
+			if (acpEffortOption) applyOption(acpEffortOption.id, { value });
+		},
+		{ disabled: optionDisabled || !onChangeConfigOption, applyOnMount: autoSelectEffortOnOpen },
+	);
+	const nativeEffortUnset = !settings.reasoningEffort || settings.reasoningEffort === "default";
+	useApplyEffortDefault(
+		`${harness}:${settings.model ?? fallback?.id}`,
+		nativeModelMenu && nativeEffortUnset ? fallbackEffort(efforts, (selected ?? fallback)?.defaultEffort) : undefined,
+		(value) => onChange?.({ ...settings, reasoningEffort: value }),
+		{ disabled: optionDisabled || !onChange, applyOnMount: autoSelectEffortOnOpen },
+	);
 	const modeOption = grouped.mode;
 	const inlineExecutionMode =
 		grouped.executionMode && isPlanBinary(grouped.executionMode) ? grouped.executionMode : undefined;
@@ -188,7 +222,6 @@ export function TurnSettingsBar({
 	const planReturn = modeOption?.choices.find(
 		(choice) => choice.permissionMode === (settings.approvalMode ?? "default"),
 	)?.value;
-	const nativeModelMenu = Boolean(onChange && displayModels.length > 0 && grouped.model.length === 0);
 	const clubbedLeft =
 		grouped.model.length > 0 ||
 		grouped.effort.length > 0 ||
@@ -223,8 +256,9 @@ export function TurnSettingsBar({
 							disabled={optionDisabled}
 							modelLabel={modelLabel}
 							groupLabel={modelGroupLabel}
-							effortLabel={effortLabel}
 							efforts={efforts}
+							defaultEffort={(selected ?? fallback
```

**File**: `frontend/src/renderer/components/settings/AgentModelCombobox.tsx` (modified, +14/-7)
```diff
@@ -4,7 +4,9 @@ import { useTranslation } from "react-i18next";
 import type { AgentModelCatalog } from "../../hooks/useAgentModelsQuery";
 import { useSuppressStrayFocusRing } from "../../hooks/useSuppressStrayFocusRing";
 import { isConcreteModelID, modelChoiceLabel } from "../../lib/agent-model-choices";
+import { fallbackEffort, useApplyEffortDefault } from "../../lib/effort";
 import { cn } from "../../lib/utils";
+import { formatEffortLabel } from "./EffortPicker";
 import { useModelTuning, type ModelTuningControlsProps } from "./ModelTuningControls";
 import { OptionMenuItem, OptionMenuSub, OptionMenuSubContent, OptionMenuSubTrigger } from "../ui/option-menu";
 import {
@@ -26,10 +28,6 @@ export type ModelEffortSelection = Pick<ModelTuningControlsProps,
 	"effort" | "onEffortChange" | "onEffortReset" | "onValidityChange" | "roleLabel"
 >;
 
-function effortLabel(value: string) {
-	return value === "xhigh" ? "Extra high" : value.charAt(0).toUpperCase() + value.slice(1);
-}
-
 type AgentModel = NonNullable<AgentModelCatalog["models"]>[number];
 
 type IndexedModel = {
@@ -130,8 +128,17 @@ export function AgentModelCombobox({
 	const showEffort = Boolean(tuning && (effortOptions.length || explicitEffort));
 	const providerEffort = effortModel?.defaultEffort;
 	const defaultEffort = providerEffort && effortOptions.includes(providerEffort) ? providerEffort : "";
-	const effectiveEffort = explicitEffort || defaultEffort;
-	const currentEffortLabel = effectiveEffort ? effortLabel(effectiveEffort) : t("settings.models.effortNotReported");
+	// No provider default for these levels: AO picks one and saves it when the
+	// model is chosen, so the control never reads as unset.
+	const aoDefaultEffort = fallbackEffort(effortOptions, providerEffort);
+	const effectiveEffort = explicitEffort || defaultEffort || aoDefaultEffort || "";
+	useApplyEffortDefault(
+		explicitModel,
+		tuning && !explicitEffort ? aoDefaultEffort : undefined,
+		tuning?.onEffortChange ?? ignoreEffortChange,
+		{ disabled: disabled || !tuning },
+	);
+	const currentEffortLabel = effectiveEffort ? formatEffortLabel(effectiveEffort, t) : t("settings.models.effortNotReported");
 	const entryMode = customModelEntry ?? (allowCustom ? "direct" : "none");
 	const allowDirectCustom = entryMode === "direct";
 	const [search, setSearch] = useState("");
@@ -489,7 +496,7 @@ export function AgentModelCombobox({
 											setAwaitingEffort(false);
 											setMenuOpen(false);
 										}} className="gap-3 text-xs">
-										{effortLabel(effort)}
+										{formatEffortLabel(effort, t)}
 										{effort === effectiveEffort && <Check className="ml-auto size-icon-sm shrink-0" aria-hidden="true" />}
 									</OptionMenuItem>
 								))}
```

**File**: `frontend/src/renderer/components/settings/EffortPicker.test.tsx` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+import { render, screen } from "@testing-library/react";
+import userEvent from "@testing-library/user-event";
+import { describe, expect, it, vi } from "vitest";
+import { appI18n } from "../../i18n";
+import { EffortPicker } from "./EffortPicker";
+
+describe("EffortPicker", () => {
+	it("shows concrete effort names without default labels", async () => {
+		const change = vi.fn();
+		render(<EffortPicker value="" choices={[{ value: "low" }, { value: "xhigh" }]} defaultEffort="xhigh" onChange={change} />);
+		const trigger = screen.getByRole("button", { name: "Effort" });
+		expect(trigger).toHaveTextContent(/^Extra high$/);
+		await userEvent.click(trigger);
+		expect(screen.queryByRole("menuitemradio", { name: "Default" })).not.toBeInTheDocument();
+		expect(screen.getByRole("menuitemradio", { name: "Extra high" })).toHaveAttribute("aria-checked", "true");
+		await userEvent.click(screen.getByRole("menuitemradio", { name: "Low" }));
+		expect(change).toHaveBeenCalledWith("low");
+	});
+
+	it("keeps a separate explicit level when the provider offers no reset", async () => {
+		const change = vi.fn();
+		render(<EffortPicker value="high" choices={[{ value: "high", label: "High" }]} defaultValue={null} onChange={change} />);
+		await userEvent.click(screen.getByRole("button", { name: "Effort" }));
+		expect(screen.queryByRole("menuitemradio", { name: "Default" })).not.toBeInTheDocument();
+		await userEvent.click(screen.getByRole("menuitemradio", { name: "High" }));
+		expect(change).toHaveBeenCalledWith("high");
+	});
+
+	it("uses the provider reset value when returning to its reported default", async () => {
+		const change = vi.fn();
+		render(<EffortPicker value="low" choices={[{ value: "default", label: "Provider default" }, { value: "low" }, { value: "high" }]} defaultValue="default" defaultEffort="high" onChange={change} />);
+		await userEvent.click(screen.getByRole("button", { name: "Effort" }));
+		await userEvent.click(screen.getByRole("menuitemradio", { name: "High" }));
+		expect(change).toHaveBeenCalledWith("default");
+	});
+
+	it.each(["unknown", "unsupported", "launch-unavailable"] as const)("keeps %s menus compact and allows clearing a saved value", async (availability) => {
+		const change = vi.fn();
+		render(<EffortPicker value="high" choices={[]} availability={availability} onChange={change} />);
+		await userEvent.click(screen.getByRole("button", { name: "Effort" }));
+		expect(screen.queryByRole("menuitemradio")).not.toBeInTheDocument();
+		expect(screen.queryByText(/options have not|does not support/)).not.toBeInTheDocument();
+		await userEvent.click(screen.getByRole("menuitem", { name: "Clear effort" }));
+		expect(change).toHaveBeenCalledWith("");
+	});
+
+	it("hides empty controls rather than claiming an effort level", () => {
+		render(<EffortPicker value="" choices={[]} availability="unknown" onChange={vi.fn()} />);
+		expect(screen.queryByRole("button", { name: "Effort" })).not.toBeInTheDocument();
+	});
+
+	it("shows only selectable levels when the current level is unknown", async () => {
+		render(<EffortPicker value="" choices={[{ value: "low" }, { value: "high" }]} onChange={vi.fn()} />);
+		await userEvent.click(screen.getByRole("button", { name: "Effort" }));
+		expect(screen.getAllByRole("menuitemradio").map((item) => item.textContent)).toEqual(["Low", "High"]);
+		expect(screen.queryByText(/Default|Use agent effort|Effort not reported/)).not.toBeInTheDocument();
+	});
+
+	it("keeps all reported choices and prevents changes while disabled", () => {
+		render(<EffortPicker value="high" choices={[{ value: "high" }, { value: "max" }]} disabled onChange={vi.fn()} />);
+		expect(screen.getByRole("button", { name: "Effort" })).toBeDisabled();
+	});
+
+	it("localizes known level names and leaves unknown provider levels as reported", async () => {
+		await appI18n.changeLanguage("fr");
+		try {
+			render(<EffortPicker value="xhigh" choices={[{ value: "xhigh" }, { value: "turbo" }]} onChange={vi.fn()} />);
+			const trigger = screen.getByRole("button", { name: "Effort" });
+			expect(trigger).toHaveTextContent("Très élevé");
+			await userEvent.click(trigger);
+			expect(screen.getByRole("menuitemradio", { name: "Turbo" })).toBeInTheDocument();
+		} finally {
+			await appI18n.changeLanguage("en");
+		}
+	});
+
+	it("ignores a prose default description instead of showing it as the label", () => {
+		render(<EffortPicker value="" choices={[{ value: "low" }, { value: "high" }]} defaultEffort="Let the provider decide" onChange={vi.fn()} />);
+		expect(screen.getByRole("button", { name: "Effort" })).toHaveTextContent(/^Effort$/);
+	});
+});
```

---

### Incident Patch 8: `48593abb` (2026-10-05)
**Commit Message**: perf(ci): run backend race tests across parallel jobs (#6089)

* chore(ci): shard backend race tests

* chore(ci): split remaining backend race packages

* chore(ci): shard chat race tests

**File**: `.github/workflows/go.yml` (modified, +90/-6)
```diff
@@ -20,8 +20,12 @@ concurrency:
   cancel-in-progress: ${{ github.event_name == 'pull_request' }}
 
 jobs:
-  build-test:
+  backend-core:
     runs-on: ubuntu-latest
+    strategy:
+      fail-fast: false
+      matrix:
+        shard: [0, 1]
     defaults:
       run:
         working-directory: backend
@@ -42,6 +46,7 @@ jobs:
           cache-dependency-path: backend/go.sum
 
       - name: Check formatting
+        if: matrix.shard == 0
         run: |
           unformatted=$(gofmt -l .)
           if [ -n "$unformatted" ]; then
@@ -51,23 +56,102 @@ jobs:
           fi
 
       - name: Build
+        if: matrix.shard == 0
         run: go build ./...
 
       - name: Vet
+        if: matrix.shard == 0
         run: go vet ./...
 
       - name: Test
-        # The complete SQLite migration suite exceeded 15m under the race
-        # detector on the shared runner. Keep a bounded per-package timeout
-        # with headroom for the full upgrade matrix; no tests are excluded.
-        #
         # -count=1 disables Go's test-result cache. The build cache restored
         # above also carries test results between runs, and without this a run
         # reported 158 of 170 packages as (cached) without executing them. The
         # cache is content-aware for Go inputs but not for the things these
         # tests actually touch — subprocesses, PATH contents, the network — so
         # a required check must still run every test. Compilation stays cached.
-        run: go test -race -count=1 -timeout=20m ./...
+        run: |
+          packages=$(go list ./... | grep -v -e '/internal/storage/sqlite$' -e '/internal/service/chat$' -e '/internal/session_manager$' -e '/internal/storage/sqlite/store$')
+          selected=$(printf '%s\n' "$packages" | awk -v shard=${{ matrix.shard }} '((NR - 1) % 2) == shard')
+          test -n "$selected"
+          printf '%s\n' "$selected" | xargs go test -race -count=1 -timeout=20m
+
+  chat-race:
+    runs-on: ubuntu-latest
+    strategy:
+      fail-fast: false
+      matrix:
+        shard: [0, 1]
+    defaults:
+      run:
+        working-directory: backend
+    steps:
+      - uses: actions/checkout@v4
+
+      - uses: actions/setup-go@v5
+        with:
+          go-version-file: backend/go.mod
+          cache-dependency-path: backend/go.sum
+
+      - name: Test chat
+        run: |
+          tests=$(go test -race -list . ./internal/service/chat | grep -E '^(Test|Example|Fuzz)')
+          selected=$(printf '%s\n' "$tests" | awk -v shard=${{ matrix.shard }} '((NR - 1) % 2) == shard' | paste -sd '|' -)
+          test -n "$selected"
+          go test -race -count=1 -timeout=20m -run "^($selected)$" ./internal/service/chat
+
+  session-store-race:
+    runs-on: ubuntu-latest
+    defaults:
+      run:
+        working-directory: backend
+    steps:
+      - uses: actions/checkout@v4
+
+      - uses: actions/setup-go@v5
+        with:
+          go-version-file: backend/go.mod
+          cache-dependency-path: backend/go.sum
+
+      - name: Test session manager and SQLite store
+        run: go test -race -count=1 -timeout=20m ./internal/session_manager ./internal/storage/sqlite/store
+
+  sqlite-race:
+    runs-on: ubuntu-latest
+    strategy:
+      fail-fast: false
+      matrix:
+        shard: [0, 1, 2, 3]
+    defaults:
+      run:
+        working-directory: backend
+    steps:
+      - uses: actions/checkout@v4
+
+      - uses: actions/setup-go@v5
+        with:
+          go-version-file: backend/go.mod
+          cache-dependency-path: backend/go.sum
+
+      - name: Test SQLite shard
+        run: |
+          tests=$(go test -race -list . ./internal/storage/sqlite | grep -E '^(Test|Example|Fuzz)')
+          selected=$(printf '%s\n' "$tests" | awk -v shard=${{ matrix.shard }} '((NR - 1) % 4) == shard' | paste -sd '|' -)
+          test -n "$selected"
+          go test -race -count=1 -timeout=20m -run "^($selected)$" ./internal/storage/sqlite
+
+  # Keep the existing required check as the gate for every backend race test.
+  build-test:
+    if: always()
+    needs: [backend-core, chat-race, session-store-race, sqlite-race]
+    runs-on: ubuntu-latest
+    steps:
+      - name: Check backend results
+        run: |
+          test '${{ needs.backend-core.result }}' = success
+          test '${{ needs.chat-race.result }}' = success
+          test '${{ needs.session-store-race.result }}' = success
+          test '${{ needs.sqlite-race.result }}' = success
 
   # The suite above only ever runs on Linux, so the packages whose behaviour is
   # genuinely platform-specific have never been exercised on Windows: worktree
```

---

### Incident Patch 9: `5d4627f6` (2026-10-05)
**Commit Message**: feat(board): memory and CPU diagnostics for AO and every session (#5837)

* feat(sessions): show live memory per session and a way to free it

Sample resident memory of each live session's process tree (tmux pane,
PTY host, or Chat provider host) with one ps snapshot per request.

- GET /api/v1/usage/sessions/memory returns RSS, process count and the
  process list per session; sessions without a live runtime are omitted
  rather than reported as zero.
- Board cards show a memory chip beside token usage (amber >= 1 GB,
  red >= 2 GB); the board topbar shows the total and opens a btop-style
  panel sorted largest first with the existing kill confirmation and
  cleanup action per row.
- ao session top lists sessions by memory with a total row.

* fix(sessions): expand a memory row to show its process breakdown

Row click was previously a dead affordance; the panel had the data
(per-process rss/pid/command) but never exposed it. Clicking a row
now opens the btop-style per-process table beneath it, sorted by
memory, with a mini bar per process.

* feat(sessions): app-wide memory pressure indicator and pause/resume on cards

Replace the per-project memory pill with a topbar percent of h

**File**: `backend/internal/adapters/chatdriver/persistenthost/host.go` (modified, +11/-0)
```diff
@@ -490,6 +490,17 @@ func bindConnToContext(ctx context.Context, conn net.Conn) func(error) error {
 	}
 }
 
+// HostPID returns the live provider host pid recorded for sessionID, for
+// memory accounting of runtime-less Chat sessions. A missing descriptor or an
+// exited host reports false; nothing is ever started or stopped here.
+func HostPID(dataDir, sessionID string) (int, bool) {
+	d, err := readDescriptor(dataDir, sessionID)
+	if err != nil || d.PID <= 0 || !processalive.Alive(d.PID) {
+		return 0, false
+	}
+	return d.PID, true
+}
+
 // Shutdown terminates current session ownership and waits for it to end.
 // Missing/dead hosts are harmless; unknown live owners fail closed.
 // The protocol acknowledgement only confirms that shutdown was requested.
```

**File**: `backend/internal/adapters/runtime/conpty/runtime.go` (modified, +19/-0)
```diff
@@ -482,6 +482,25 @@ func (r *Runtime) IsExactSupervisedProcessAlive(ctx context.Context, handle port
 	return r.IsSupervisedProcessAlive(ctx, handle, ref)
 }
 
+// ProcessRootPIDs returns the PTY host pid so memory accounting can walk the
+// agent process tree it supervises. An unregistered session yields no pids.
+func (r *Runtime) ProcessRootPIDs(ctx context.Context, handle ports.RuntimeHandle) ([]int, error) {
+	sess, err := r.resolveWithEvidence(ctx, handle.ID)
+	if err != nil {
+		return nil, fmt.Errorf("conpty: resolve runtime %q: %w", handle.ID, err)
+	}
+	if sess == nil || sess.pid <= 0 {
+		return nil, nil
+	}
+	return []int{sess.pid}, nil
+}
+
+// ServerPID has no equivalent here: ConPTY hosts one pty per session rather
+// than sharing a detached server the way tmux does.
+func (r *Runtime) ServerPID(ctx context.Context) (int, bool) {
+	return 0, false
+}
+
 // HasSupervisedProcessRecord reports whether this handle was created with an
 // AO-managed launch generation. An empty generation identifies pre-supervisor
 // sessions that still need the legacy child-liveness probe.
```

**File**: `backend/internal/adapters/runtime/runtimeselect/hybrid.go` (modified, +13/-0)
```diff
@@ -25,6 +25,7 @@ type routedBackend interface {
 	ports.StyledTerminalOutputReader
 	ports.SupervisedProcessInspector
 	ports.ExactSupervisedProcessInspector
+	ports.RuntimeProcessRootInspector
 	ports.SupervisedProcessRecordInspector
 }
 
@@ -40,6 +41,7 @@ var _ ports.RuntimeRestarter = (*hybridRuntime)(nil)
 var _ ports.StyledTerminalOutputReader = (*hybridRuntime)(nil)
 var _ ports.SupervisedProcessInspector = (*hybridRuntime)(nil)
 var _ ports.ExactSupervisedProcessInspector = (*hybridRuntime)(nil)
+var _ ports.RuntimeProcessRootInspector = (*hybridRuntime)(nil)
 var _ ports.SupervisedProcessRecordInspector = (*hybridRuntime)(nil)
 
 func newHybridRuntime(legacy, direct routedBackend, log *slog.Logger, platform string) *hybridRuntime {
@@ -131,6 +133,12 @@ func (r *hybridRuntime) GetOutput(ctx context.Context, handle ports.RuntimeHandl
 	return backend.GetOutput(ctx, raw, lines)
 }
 
+// ServerPID always asks the legacy (tmux) backend: it's the one shared
+// detached server, regardless of which backend owns any given session.
+func (r *hybridRuntime) ServerPID(ctx context.Context) (int, bool) {
+	return r.legacy.ServerPID(ctx)
+}
+
 func (r *hybridRuntime) GetStyledOutput(ctx context.Context, handle ports.RuntimeHandle, lines int) (string, error) {
 	backend, raw := r.route(handle)
 	return backend.GetStyledOutput(ctx, raw, lines)
@@ -180,6 +188,11 @@ func (r *hybridRuntime) Restart(ctx context.Context, handle ports.RuntimeHandle,
 	return r.Create(ctx, cfg)
 }
 
+func (r *hybridRuntime) ProcessRootPIDs(ctx context.Context, handle ports.RuntimeHandle) ([]int, error) {
+	backend, raw := r.route(handle)
+	return backend.ProcessRootPIDs(ctx, raw)
+}
+
 func (r *hybridRuntime) route(handle ports.RuntimeHandle) (routedBackend, ports.RuntimeHandle) {
 	if strings.HasPrefix(handle.ID, directHandlePrefix) {
 		handle.ID = strings.TrimPrefix(handle.ID, directHandlePrefix)
```

**File**: `backend/internal/adapters/runtime/runtimeselect/hybrid_test.go` (modified, +9/-0)
```diff
@@ -124,6 +124,15 @@ func (f *fakeBackend) HasSupervisedProcessRecord(_ context.Context, handle ports
 	return true, nil
 }
 
+func (f *fakeBackend) ProcessRootPIDs(_ context.Context, handle ports.RuntimeHandle) ([]int, error) {
+	f.record("roots", handle)
+	return []int{1234}, nil
+}
+
+func (f *fakeBackend) ServerPID(_ context.Context) (int, bool) {
+	return 0, false
+}
+
 type restartableFakeBackend struct{ fakeBackend }
 
 func (f *restartableFakeBackend) Restart(_ context.Context, handle ports.RuntimeHandle, _ ports.RuntimeConfig) (ports.RuntimeHandle, error) {
```

**File**: `backend/internal/adapters/runtime/runtimeselect/runtimeselect.go` (modified, +4/-0)
```diff
@@ -20,6 +20,7 @@ import (
 type Runtime interface {
 	ports.Runtime // Create, Destroy, IsAlive
 	ports.RuntimeChildInspector
+	ports.RuntimeProcessRootInspector
 	ports.FencedRuntimeProber
 	ports.ExactSupervisedProcessInspector
 	ports.SupervisedProcessRecordInspector
@@ -28,6 +29,9 @@ type Runtime interface {
 	SendInput(ctx context.Context, handle ports.RuntimeHandle, input string) error
 	SendMessage(ctx context.Context, handle ports.RuntimeHandle, message string) error
 	GetOutput(ctx context.Context, handle ports.RuntimeHandle, lines int) (string, error)
+	// ServerPID names AO's own detached session-host process, where the
+	// backend has one (tmux). Zero, false where it does not (ConPTY).
+	ServerPID(ctx context.Context) (int, bool)
 }
 
 // Compile-time assertions: both concrete adapters must implement the union
```

**File**: `backend/internal/adapters/runtime/tmux/tmux.go` (modified, +47/-0)
```diff
@@ -615,6 +615,53 @@ func (r *Runtime) IsAlive(ctx context.Context, handle ports.RuntimeHandle) (bool
 	return true, nil
 }
 
+// ProcessRootPIDs returns every pane leader pid of the session so memory
+// accounting can walk their descendants. A missing session yields no pids and
+// no error; a tmux probe failure is surfaced so callers do not read it as zero.
+func (r *Runtime) ProcessRootPIDs(ctx context.Context, handle ports.RuntimeHandle) ([]int, error) {
+	id, err := handleID(handle)
+	if err != nil {
+		return nil, err
+	}
+	out, err := r.runForSession(ctx, id, listPanePIDsArgs(id)...)
+	if err != nil {
+		if sessionMissingOutput(string(out)) || serverNotRunningOutput(string(out)) || serverSocketAbsentOutput(string(out)) {
+			return nil, nil
+		}
+		return nil, fmt.Errorf("tmux runtime: list pane pids %s: %w", id, err)
+	}
+	var ids []int
+	for _, line := range strings.Split(string(out), "\n") {
+		pid, convErr := strconv.Atoi(strings.TrimSpace(line))
+		if convErr != nil || pid <= 1 {
+			continue
+		}
+		ids = append(ids, pid)
+	}
+	return ids, nil
+}
+
+// ServerPID returns the pid of AO's own tmux server, which every session on
+// this socket shares. It is not reachable by walking up from a pane: the
+// server detaches on startup and is reparented to init, not to anything AO
+// already tracks. Zero, false when the server cannot be reached or the
+// output cannot be parsed, and always without a private socket: the default
+// server is the user's own tmux, and everything in it would read as AO.
+func (r *Runtime) ServerPID(ctx context.Context) (int, bool) {
+	if r.socketName == "" {
+		return 0, false
+	}
+	out, err := r.run(ctx, "display-message", "-p", "#{pid}")
+	if err != nil {
+		return 0, false
+	}
+	pid, convErr := strconv.Atoi(strings.TrimSpace(string(out)))
+	if convErr != nil || pid <= 1 {
+		return 0, false
+	}
+	return pid, true
+}
+
 // IsChildAlive also detects exited panes retained by tmux's remain-on-exit.
 func (r *Runtime) IsChildAlive(ctx context.Context, handle ports.RuntimeHandle) (bool, error) {
 	alive, err := r.IsAlive(ctx, handle)
```

**File**: `backend/internal/adapters/runtime/tmux/tmux_test.go` (modified, +46/-0)
```diff
@@ -2279,3 +2279,49 @@ func exitCodeErr(t *testing.T, code int) error {
 	}
 	return err
 }
+
+func TestRuntime_ServerPID(t *testing.T) {
+	t.Run("parses the server pid tmux reports", func(t *testing.T) {
+		r, fr := newTestRuntime(0)
+		r.socketName = "ao"
+		fr.outputs = [][]byte{[]byte("54321\n")}
+		pid, ok := r.ServerPID(context.Background())
+		if !ok || pid != 54321 {
+			t.Fatalf("ServerPID() = %d, %v, want 54321, true", pid, ok)
+		}
+	})
+
+	t.Run("false on a runner error", func(t *testing.T) {
+		r, fr := newTestRuntime(0)
+		fr.err = errors.New("no server running")
+		pid, ok := r.ServerPID(context.Background())
+		if ok || pid != 0 {
+			t.Fatalf("ServerPID() = %d, %v, want 0, false", pid, ok)
+		}
+	})
+
+	t.Run("false on unparseable output", func(t *testing.T) {
+		r, fr := newTestRuntime(0)
+		r.socketName = "ao"
+		fr.outputs = [][]byte{[]byte("not-a-pid\n")}
+		pid, ok := r.ServerPID(context.Background())
+		if ok || pid != 0 {
+			t.Fatalf("ServerPID() = %d, %v, want 0, false", pid, ok)
+		}
+	})
+
+	// Without a private socket tmux answers from the machine default server,
+	// which is the user's own tmux: claiming it bills their shells, editors
+	// and anything else they run there as AO memory.
+	t.Run("false without a private socket, never asking tmux", func(t *testing.T) {
+		r, fr := newTestRuntime(0)
+		fr.outputs = [][]byte{[]byte("54321\n")}
+		pid, ok := r.ServerPID(context.Background())
+		if ok || pid != 0 {
+			t.Fatalf("ServerPID() = %d, %v, want 0, false", pid, ok)
+		}
+		if n := countCalls(fr, "display-message"); n != 0 {
+			t.Fatalf("display-message calls = %d, want 0", n)
+		}
+	})
+}
```

**File**: `backend/internal/cli/session.go` (modified, +1/-0)
```diff
@@ -192,6 +192,7 @@ func newSessionCommand(ctx *commandContext) *cobra.Command {
 		Short: "Manage agent sessions",
 	}
 	cmd.AddCommand(newSessionListCommand(ctx))
+	cmd.AddCommand(newSessionTopCommand(ctx))
 	cmd.AddCommand(newSessionGetCommand(ctx))
 	cmd.AddCommand(newSessionKillCommand(ctx))
 	cmd.AddCommand(newSessionRestoreCommand(ctx))
```

---

### Incident Patch 10: `d02ca90d` (2026-10-05)
**Commit Message**: Fix reviewer Chat drafts and composer controls (#6118)

* fix: preserve reviewer chat drafts and allow terminal reviews

* fix: scope reviewer image drafts to the review

* fix: localize reviewer interface controls

* fix: stop active reviewer before changing interface

* fix: narrow reviewer harness in trigger request

* fix: settle reviewer chat turns across mode changes

* fix: project reviewer chat events under review ownership

* fix: preserve reviewer state across interface switches

* fix: fence reviewer surface replacements

* docs: add reviewer walkthrough recording

* docs: refresh reviewer walkthrough recording

* docs: use GitHub video attachment

* fix: close reviewer switch cleanup gaps

* test: cover remote reviewer draft scope

* fix: reset stale reviewer fence on chat claim

* fix: make reviewer replacements settle and dispatch once

* fix: cancel orphaned review runs on Chat downgrade

* fix: simplify reviewer controls and expose chat models

* fix: settle reviewer batches when Chat ends without a verdict

* fix: preserve reviewer tab focus across agent switches

* fix: confirm and start same-commit reviewer reruns

* fix: expose shared resume control in reviewer 

**File**: `backend/internal/daemon/lifecycle_wiring.go` (modified, +6/-5)
```diff
@@ -7,6 +7,7 @@ import (
 	"log/slog"
 	"path/filepath"
 	"slices"
+	"strings"
 	"sync"
 
 	"github.com/aoagents/agent-orchestrator/backend/internal/adapters"
@@ -587,22 +588,22 @@ func (c chatLauncher) RestoreReviewChat(ctx context.Context, cfg reviewcore.Revi
 
 func (c chatLauncher) startReviewChat(ctx context.Context, cfg reviewcore.ReviewerChatStart, sendPrompt bool) (string, error) {
 	owner := domain.ReviewConversationOwner(cfg.ReviewID)
-	started, err := c.svc.StartChat(ctx, chatsvc.StartConfig{Owner: owner, SessionID: cfg.WorkerID, ProjectID: cfg.ProjectID, Kind: domain.KindWorker, Harness: cfg.Harness, DataDir: cfg.DataDir, WorkspacePath: cfg.WorkspacePath, Env: cfg.Env, Permissions: ports.PermissionModeAuto, SystemPrompt: cfg.SystemPrompt, ProviderConversationID: cfg.ProviderConversationID})
+	started, err := c.svc.StartChat(ctx, chatsvc.StartConfig{Owner: owner, SessionID: cfg.WorkerID, ProjectID: cfg.ProjectID, Kind: domain.KindWorker, Harness: cfg.Harness, DataDir: cfg.DataDir, WorkspacePath: cfg.WorkspacePath, Env: cfg.Env, Model: cfg.Model, Effort: cfg.Effort, Permissions: ports.PermissionModeAuto, SystemPrompt: cfg.SystemPrompt, ProviderConversationID: cfg.ProviderConversationID})
 	if err != nil {
 		return "", err
 	}
-	if !sendPrompt {
+	if !sendPrompt || strings.TrimSpace(cfg.Prompt) == "" {
 		return started.ProviderConversationID, nil
 	}
-	if _, err := c.svc.SendForOwner(ctx, owner, ports.ChatUserMessage{Text: cfg.Prompt, Origin: domain.MessageOriginHuman}); err != nil {
+	if _, err := c.svc.SendForOwner(ctx, owner, ports.ChatUserMessage{Text: cfg.Prompt, Origin: domain.MessageOriginDaemon, ClientMessageID: reviewcore.BatchMessageID(cfg.BatchID)}); err != nil {
 		_ = c.svc.StopForOwner(context.Background(), owner)
 		return "", err
 	}
 	return started.ProviderConversationID, nil
 }
 
-func (c chatLauncher) SendReviewChat(ctx context.Context, reviewID, message string) error {
-	_, err := c.svc.SendForOwner(ctx, domain.ReviewConversationOwner(reviewID), ports.ChatUserMessage{Text: message, Origin: domain.MessageOriginDaemon})
+func (c chatLauncher) SendReviewChat(ctx context.Context, reviewID, message, batchID string) error {
+	_, err := c.svc.SendForOwner(ctx, domain.ReviewConversationOwner(reviewID), ports.ChatUserMessage{Text: message, Origin: domain.MessageOriginDaemon, ClientMessageID: reviewcore.BatchMessageID(batchID)})
 	return err
 }
 
```

**File**: `backend/internal/httpd/apispec/openapi.yaml` (modified, +111/-0)
```diff
@@ -3898,6 +3898,108 @@ paths:
       summary: Send a message to a Chat reviewer
       tags:
       - conversations
+  /api/v1/reviews/{reviewId}/conversation/models:
+    get:
+      operationId: listReviewerConversationModels
+      parameters:
+      - description: Reviewer conversation identifier.
+        in: path
+        name: reviewId
+        required: true
+        schema:
+          description: Reviewer conversation identifier.
+          type: string
+      responses:
+        "200":
+          content:
+            application/json:
+              schema:
+                $ref: '#/components/schemas/ConversationModelsResponse'
+          description: OK
+        "404":
+          content:
+            application/json:
+              schema:
+                $ref: '#/components/schemas/APIError'
+          description: Not Found
+        "409":
+          content:
+            application/json:
+              schema:
+                $ref: '#/components/schemas/APIError'
+          description: Conflict
+        "500":
+          content:
+            application/json:
+              schema:
+                $ref: '#/components/schemas/APIError'
+          description: Internal Server Error
+        "501":
+          content:
+            application/json:
+              schema:
+                $ref: '#/components/schemas/APIError'
+          description: Not Implemented
+      summary: List the models offered for a Chat reviewer
+      tags:
+      - conversations
+  /api/v1/reviews/{reviewId}/conversation/settings:
+    patch:
+      operationId: setReviewerConversationSettings
+      parameters:
+      - description: Reviewer conversation identifier.
+        in: path
+        name: reviewId
+        required: true
+        schema:
+          description: Reviewer conversation identifier.
+          type: string
+      requestBody:
+        content:
+          application/json:
+            schema:
+              $ref: '#/components/schemas/ConversationTurnSettingsPayload'
+        required: true
+      responses:
+        "200":
+          content:
+            application/json:
+              schema:
+                $ref: '#/components/schemas/ConversationTurnSettingsPayload'
+          description: OK
+        "400":
+          content:
+            application/json:
+              schema:
+                $ref: '#/components/schemas/APIError'
+          description: Bad Request
+        "404":
+          content:
+            application/json:
+              schema:
+                $ref: '#/components/schemas/APIError'
+          description: Not Found
+        "409":
+          content:
+            application/json:
+              schema:
+                $ref: '#/components/schemas/APIError'
+          description: Conflict
+        "500":
+          content:
+            application/json:
+              schema:
+                $ref: '#/components/schemas/APIError'
+          description: Internal Server Error
+        "501":
+          content:
+            application/json:
+              schema:
+                $ref: '#/components/schemas/APIError'
+          description: Not Implemented
+      summary: Select model and effort for the reviewer's next Chat turn
+      tags:
+      - conversations
   /api/v1/reviews/{reviewSessionID}/activity:
     post:
       operationId: setReviewActivity
@@ -14815,6 +14917,15 @@ components:
           - cline
           - autohand
           type: string
+        interfaceMode:
+          enum:
+          - chat
+          - tui
+          type: string
+        rerun:
+          description: Start a fresh manual pass for already-reviewed current heads;
+            reuse an active pass from the same reviewer.
+          type: boolean
       type: object
     TriggerReviewResponse:
       properties:
```

**File**: `backend/internal/httpd/apispec/specgen/build.go` (modified, +10/-0)
```diff
@@ -1059,6 +1059,16 @@ func shellTerminalOperations() []operation {
 				{http.StatusNotImplemented, envelope.APIError{}},
 			},
 		},
+		{
+			method: http.MethodGet, path: "/api/v1/reviews/{reviewId}/conversation/models", id: "listReviewerConversationModels", tag: "conversations",
+			summary: "List the models offered for a Chat reviewer", pathParams: []any{controllers.ReviewIDParam{}},
+			resps: []respUnit{{http.StatusOK, controllers.ConversationModelsResponse{}}, {http.StatusNotFound, envelope.APIError{}}, {http.StatusConflict, envelope.APIError{}}, {http.StatusInternalServerError, envelope.APIError{}}, {http.StatusNotImplemented, envelope.APIError{}}},
+		},
+		{
+			method: http.MethodPatch, path: "/api/v1/reviews/{reviewId}/conversation/settings", id: "setReviewerConversationSettings", tag: "conversations",
+			summary: "Select model and effort for the reviewer's next Chat turn", pathParams: []any{controllers.ReviewIDParam{}}, reqBody: controllers.ConversationTurnSettingsPayload{},
+			resps: []respUnit{{http.StatusOK, controllers.ConversationTurnSettingsPayload{}}, {http.StatusBadRequest, envelope.APIError{}}, {http.StatusNotFound, envelope.APIError{}}, {http.StatusConflict, envelope.APIError{}}, {http.StatusInternalServerError, envelope.APIError{}}, {http.StatusNotImplemented, envelope.APIError{}}},
+		},
 		{
 			method: http.MethodGet, path: "/api/v1/reviews/{reviewId}/conversation", id: "getReviewerConversation", tag: "conversations",
 			summary: "Read a reviewer's durable Chat conversation", pathParams: []any{controllers.ReviewIDParam{}, conversationSnapshotQuery{}},
```

**File**: `backend/internal/httpd/controllers/conversations.go` (modified, +43/-0)
```diff
@@ -61,6 +61,8 @@ type pagedConversationService interface {
 }
 
 type reviewerConversationService interface {
+	ModelsForOwner(context.Context, domain.ConversationOwner) ([]ports.ChatModel, domain.ConversationSettings, error)
+	SetTurnSettingsForOwner(context.Context, domain.ConversationOwner, domain.ConversationSettings) (domain.ConversationSettings, error)
 	SnapshotPageForReview(ctx context.Context, reviewID string, beforeSequence, limit int64) (chatsvc.Snapshot, error)
 	SendForOwner(ctx context.Context, owner domain.ConversationOwner, msg ports.ChatUserMessage) (domain.ConversationTurn, error)
 	ResolveForOwner(ctx context.Context, owner domain.ConversationOwner, requestID string, decision ports.ChatDecision) error
@@ -102,6 +104,8 @@ func (c *ConversationsController) Register(r chi.Router) {
 	r.Post("/sessions/{sessionId}/conversation/branches/{branchId}/activate", c.activateBranch)
 	r.Put("/sessions/{sessionId}/conversation/title", c.setTitle)
 	r.Post("/sessions/{sessionId}/conversation/mcp/reload", c.reloadMCPServers)
+	r.Get("/reviews/{reviewId}/conversation/models", c.reviewModels)
+	r.Patch("/reviews/{reviewId}/conversation/settings", c.reviewSetSettings)
 	r.Get("/reviews/{reviewId}/conversation", c.reviewSnapshot)
 	r.Post("/reviews/{reviewId}/conversation/messages", c.reviewSend)
 	r.Post("/reviews/{reviewId}/conversation/approvals/{requestId}/resolve", c.reviewResolve)
@@ -117,6 +121,45 @@ func (c *ConversationsController) reviewService(w http.ResponseWriter, r *http.R
 	return svc, ok
 }
 
+func (c *ConversationsController) reviewModels(w http.ResponseWriter, r *http.Request) {
+	svc, ok := c.reviewService(w, r)
+	if !ok {
+		return
+	}
+	models, selected, err := svc.ModelsForOwner(r.Context(), domain.ReviewConversationOwner(chi.URLParam(r, "reviewId")))
+	if err != nil && !errors.Is(err, chatsvc.ErrModelsUnsupported) {
+		writeConversationError(w, r, err)
+		return
+	}
+	envelope.WriteJSON(w, http.StatusOK, conversationModelsResponse(models, selected))
+}
+
+func (c *ConversationsController) reviewSetSettings(w http.ResponseWriter, r *http.Request) {
+	svc, ok := c.reviewService(w, r)
+	if !ok {
+		return
+	}
+	var req ConversationTurnSettingsPayload
+	if !decodeConversationBody(w, r, &req) {
+		return
+	}
+	approval := domain.PermissionMode(req.ApprovalMode)
+	if req.ApprovalMode != "" && !approval.Valid() {
+		envelope.WriteAPIError(w, r, http.StatusBadRequest, "validation", "CHAT_APPROVAL_MODE_INVALID", "unknown approval mode", nil)
+		return
+	}
+	settings, err := svc.SetTurnSettingsForOwner(r.Context(), domain.ReviewConversationOwner(chi.URLParam(r, "reviewId")), domain.ConversationSettings{Model: req.Model, ReasoningEffort: req.ReasoningEffort, ApprovalMode: approval})
+	if errors.Is(err, chatsvc.ErrReviewerPermissionsFixed) {
+		envelope.WriteAPIError(w, r, http.StatusBadRequest, "validation", "CHAT_REVIEW_PERMISSIONS_FIXED", err.Error(), nil)
+		return
+	}
+	if err != nil {
+		writeConversationError(w, r, err)
+		return
+	}
+	envelope.WriteJSON(w, http.StatusOK, turnSettingsPayload(settings))
+}
+
 func (c *ConversationsController) reviewSnapshot(w http.ResponseWriter, r *http.Request) {
 	svc, ok := c.reviewService(w, r)
 	if !ok {
```

**File**: `backend/internal/httpd/controllers/conversations_test.go` (modified, +9/-0)
```diff
@@ -116,6 +116,15 @@ func (f *fakeConversationService) InterruptForOwner(_ context.Context, owner dom
 	return f.reviewErr
 }
 
+func (f *fakeConversationService) ModelsForOwner(ctx context.Context, owner domain.ConversationOwner) ([]ports.ChatModel, domain.ConversationSettings, error) {
+	f.reviewOwner = owner
+	return f.Models(ctx, "")
+}
+func (f *fakeConversationService) SetTurnSettingsForOwner(_ context.Context, owner domain.ConversationOwner, settings domain.ConversationSettings) (domain.ConversationSettings, error) {
+	f.reviewOwner = owner
+	return settings, nil
+}
+
 func (f *fakeConversationService) Models(context.Context, domain.SessionID) ([]ports.ChatModel, domain.ConversationSettings, error) {
 	return nil, domain.ConversationSettings{}, nil
 }
```

**File**: `backend/internal/httpd/controllers/dto.go` (modified, +4/-2)
```diff
@@ -2944,8 +2944,10 @@ func capabilityNames(caps ports.ChatCapabilities) []string {
 // it for this pass only, without editing project config, so one session's choice
 // cannot change what another session in the project runs.
 type TriggerReviewRequest struct {
-	Harness     domain.ReviewerHarness `json:"harness,omitempty" enum:"claude-code,codex,copilot,cursor,kilocode,opencode,opencode-v2,kiro,pi,agy,devin,droid,kimi,kimchi,muse,amp,aider,grok,crush,auggie,cline,autohand"`
-	AgentConfig domain.AgentConfig     `json:"agentConfig,omitempty"`
+	Rerun         bool                         `json:"rerun,omitempty" description:"Start a fresh manual pass for already-reviewed current heads; reuse an active pass from the same reviewer."`
+	Harness       domain.ReviewerHarness       `json:"harness,omitempty" enum:"claude-code,codex,copilot,cursor,kilocode,opencode,opencode-v2,kiro,pi,agy,devin,droid,kimi,kimchi,muse,amp,aider,grok,crush,auggie,cline,autohand"`
+	AgentConfig   domain.AgentConfig           `json:"agentConfig,omitempty"`
+	InterfaceMode domain.ReviewerInterfaceMode `json:"interfaceMode,omitempty" enum:"chat,tui"`
 }
 
 // ResolveReviewCommentRequest is the body of POST /api/v1/sessions/{sessionId}/reviews/comments/resolve.
```

**File**: `backend/internal/httpd/controllers/reviewer_conversations_test.go` (modified, +10/-0)
```diff
@@ -42,6 +42,15 @@ func TestReviewerConversationRoutesDispatchToReviewOwner(t *testing.T) {
 		t.Fatalf("snapshot = status %d body %s, call = %q %d %d", status, body, service.reviewID, service.reviewBefore, service.reviewLimit)
 	}
 
+	status, body = reviewConversationRequest(t, server.Client(), http.MethodGet, base+"/models", "")
+	if status != http.StatusOK || service.reviewOwner != domain.ReviewConversationOwner("review-1") {
+		t.Fatalf("models status=%d body=%s owner=%+v", status, body, service.reviewOwner)
+	}
+	status, body = reviewConversationRequest(t, server.Client(), http.MethodPatch, base+"/settings", `{"model":"review-model","reasoningEffort":"high","approvalMode":"auto"}`)
+	if status != http.StatusOK || !bytes.Contains(body, []byte(`"model":"review-model"`)) || service.reviewOwner != domain.ReviewConversationOwner("review-1") {
+		t.Fatalf("settings status=%d body=%s owner=%+v", status, body, service.reviewOwner)
+	}
+
 	status, body = reviewConversationRequest(t, server.Client(), http.MethodPost, base+"/messages", `{"text":"check this","clientMessageId":"client-1"}`)
 	if status != http.StatusAccepted || service.reviewOwner != domain.ReviewConversationOwner("review-1") || service.sent.Text != "check this" {
 		t.Fatalf("send = status %d body %s, owner = %#v message = %#v", status, body, service.reviewOwner, service.sent)
@@ -75,6 +84,7 @@ func TestReviewerConversationRoutesValidateRequests(t *testing.T) {
 	}{
 		{http.MethodGet, "?beforeSequence=0", "", "CONVERSATION_CURSOR_INVALID"},
 		{http.MethodGet, "?limit=501", "", "CONVERSATION_LIMIT_INVALID"},
+		{http.MethodPatch, "/settings", `{"approvalMode":"invalid"}`, "CHAT_APPROVAL_MODE_INVALID"},
 		{http.MethodPost, "/messages", `{}`, "CHAT_MESSAGE_EMPTY"},
 		{http.MethodPost, "/approvals/request-1/resolve", `{}`, "CHAT_DECISION_REQUIRED"},
 		{http.MethodPost, "/inputs/request-1/resolve", `{"action":"unknown"}`, "CHAT_INPUT_ACTION_INVALID"},
```

**File**: `backend/internal/httpd/controllers/reviews.go` (modified, +9/-1)
```diff
@@ -190,7 +190,15 @@ func (c *ReviewsController) trigger(w http.ResponseWriter, r *http.Request) {
 		envelope.WriteAPIError(w, r, http.StatusBadRequest, "bad_request", "INVALID_JSON", "Invalid JSON body", nil)
 		return
 	}
-	res, err := c.Svc.Trigger(r.Context(), sessionID(r), in.Harness, in.AgentConfig)
+	var res reviewcore.TriggerResult
+	var err error
+	if in.Rerun {
+		res, err = c.Svc.TriggerWithOptions(r.Context(), sessionID(r), reviewcore.TriggerOptions{Harness: in.Harness, Config: in.AgentConfig, Source: domain.ReviewTriggerManual, InterfaceMode: in.InterfaceMode, Rerun: true})
+	} else if in.InterfaceMode != "" {
+		res, err = c.Svc.TriggerWithMode(r.Context(), sessionID(r), in.Harness, in.AgentConfig, in.InterfaceMode)
+	} else {
+		res, err = c.Svc.Trigger(r.Context(), sessionID(r), in.Harness, in.AgentConfig)
+	}
 	if err != nil {
 		writeReviewError(w, r, err)
 		return
```

---

### Incident Patch 11: `5e5b80d2` (2026-10-05)
**Commit Message**: fix(updates): restore release-note links after repository rename (#6275)

**File**: `frontend/src/renderer/components/DesktopReleaseNotes.test.ts` (modified, +16/-0)
```diff
@@ -41,3 +41,19 @@ it("removes contributor handles from generated nightly changes", () => {
 		"**Build details**",
 	].join("\n"));
 });
+
+it("cleans release notes published after the repository moved to OrchestratorInc", () => {
+	const notes = [
+		"**Changes in this nightly**",
+		"",
+		"- Fix update links by @person in [#6228](https://github.com/OrchestratorInc/agent-orchestrator/pull/6228)",
+		"",
+		"**Full Changelog**: https://github.com/OrchestratorInc/agent-orchestrator/compare/v0.13.3...v0.13.4",
+	].join("\n");
+
+	expect(prepareDesktopReleaseNotes(notes)).toBe([
+		"**Changes in this nightly**",
+		"",
+		"- Fix update links [#6228](https://github.com/OrchestratorInc/agent-orchestrator/pull/6228)",
+	].join("\n"));
+});
```

**File**: `frontend/src/renderer/components/DesktopReleaseNotes.tsx` (modified, +2/-1)
```diff
@@ -3,8 +3,9 @@ import Markdown, { type Components } from "react-markdown";
 import { prepareDesktopReleaseNotes } from "../lib/desktop-release-notes";
 import { ProductExternalLink } from "./ProductExternalLink";
 
+// Published release bodies retain the old owner after a repository rename.
 const AO_RELEASE_LINK_PATTERN =
-	/^https:\/\/github\.com\/Untrivial-ai\/agent-orchestrator\/(?:pull\/\d+|commit\/[0-9a-f]{7,40}|compare\/v\d+\.\d+\.\d+(?:-nightly\.\d{12})?\.\.\.v\d+\.\d+\.\d+(?:-nightly\.\d{12})?)$/i;
+	/^https:\/\/github\.com\/(?:OrchestratorInc|Untrivial-ai)\/agent-orchestrator\/(?:pull\/\d+|commit\/[0-9a-f]{7,40}|compare\/v\d+\.\d+\.\d+(?:-nightly\.\d{12})?\.\.\.v\d+\.\d+\.\d+(?:-nightly\.\d{12})?)$/i;
 
 const releaseNoteComponents: Components = {
 	h3: ({ children }) => (
```

**File**: `frontend/src/renderer/components/RestartToUpdateDialog.test.tsx` (modified, +1/-1)
```diff
@@ -151,7 +151,7 @@ it("renders unrelated release-note links as plain text", async () => {
 
 it("links the generated nightly comparison without allowing arbitrary compare URLs", async () => {
 	useUiStore.setState({ updateInstallPromptOpen: true });
-	const comparisonUrl = "https://github.com/Untrivial-ai/agent-orchestrator/compare/v0.13.1...v0.13.2-nightly.202609271025";
+	const comparisonUrl = "https://github.com/OrchestratorInc/agent-orchestrator/compare/v0.13.1...v0.13.2-nightly.202609271025";
 	renderDialog({
 		state: "downloaded",
 		version: "0.13.2-nightly.202609271025",
```

**File**: `frontend/src/renderer/components/settings/UpdatesSection.test.tsx` (modified, +23/-0)
```diff
@@ -88,3 +88,26 @@ it("renders the installed nightly build time as the device-local instant", async
 	);
 	expect(await screen.findByText(`Built ${builtAt}`)).toBeVisible();
 });
+
+it("links PRs and commits in downloaded notes from the renamed repository", async () => {
+	const repo = "https://github.com/OrchestratorInc/agent-orchestrator";
+	const commit = "7b7db96413e6a396a10afbcada0e2fd04a994ad8";
+	updGetStatus.mockResolvedValue({
+		state: "downloaded",
+		version: "0.13.4-nightly.202610051230",
+		releaseNotes: [
+			"**Changes in this nightly**",
+			"",
+			`- Refresh startup readiness by @illegalcall in [#6228](${repo}/pull/6228)`,
+			"",
+			"**Build details**",
+			"",
+			`- Commit: [7b7db96](${repo}/commit/${commit})`,
+		].join("\n"),
+	} satisfies UpdateStatus);
+	renderUpdates();
+
+	expect(await screen.findByRole("link", { name: "#6228" })).toHaveAttribute("href", `${repo}/pull/6228`);
+	expect(screen.getByRole("link", { name: "7b7db96" })).toHaveAttribute("href", `${repo}/commit/${commit}`);
+	expect(screen.queryByText(/@illegalcall/)).toBeNull();
+});
```

**File**: `frontend/src/renderer/lib/desktop-release-notes.ts` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 const RELEASE_ATTRIBUTION_PATTERN =
-	/\s+by\s+@[A-Za-z0-9-]+(?:\[bot\])?\s+in\s+(\[#\d+\]\(https:\/\/github\.com\/Untrivial-ai\/agent-orchestrator\/pull\/\d+\))\s*$/;
+	/\s+by\s+@[A-Za-z0-9-]+(?:\[bot\])?\s+in\s+(\[#\d+\]\(https:\/\/github\.com\/(?:OrchestratorInc|Untrivial-ai)\/agent-orchestrator\/pull\/\d+\))\s*$/;
 const FULL_CHANGELOG_PATTERN =
-	/^\*\*Full Changelog\*\*:\s+https:\/\/github\.com\/Untrivial-ai\/agent-orchestrator\/(?:compare|commits)\/\S+\s*$/i;
+	/^\*\*Full Changelog\*\*:\s+https:\/\/github\.com\/(?:OrchestratorInc|Untrivial-ai)\/agent-orchestrator\/(?:compare|commits)\/\S+\s*$/i;
 
 export function prepareDesktopReleaseNotes(notes: string): string {
 	const lines = notes.split(/\r?\n/).flatMap((line) => {
```

---

### Incident Patch 12: `e45ce29f` (2026-10-05)
**Commit Message**: fix(api): never serialize PR mergeability reasons as null (#6263)

A mergeable or unobserved PR has no blocking reasons, and the session PR
summary sent them as null. #6163 made the desktop read reasons with
.includes for every open PR, so opening the session inspector for any open
mergeable PR crashed with "Cannot read properties of null (reading
'includes')". The contract types reasons as a string array; send [].

Co-authored-by: Prateek K <[REDACTED_EMAIL]>
Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `backend/internal/httpd/controllers/dto.go` (modified, +3/-1)
```diff
@@ -1266,7 +1266,9 @@ func newSessionPRMergeabilitySummary(in sessionsvc.PRMergeabilitySummary) Sessio
 	for _, file := range in.ConflictFiles {
 		files = append(files, SessionPRConflictFile{Path: file.Path, URL: file.URL})
 	}
-	return SessionPRMergeabilitySummary{State: in.State, Reasons: in.Reasons, PRURL: in.PRURL, ConflictFiles: files}
+	// No reasons is an empty array, never null: clients read it as a list.
+	reasons := append([]string{}, in.Reasons...)
+	return SessionPRMergeabilitySummary{State: in.State, Reasons: reasons, PRURL: in.PRURL, ConflictFiles: files}
 }
 
 // ClaimPRRequest is the body of POST /sessions/{sessionId}/pr/claim.
```

**File**: `backend/internal/httpd/controllers/sessions_test.go` (modified, +19/-0)
```diff
@@ -3938,6 +3938,25 @@ func TestSessionPRSummaryOmitsUnavailableLifecycleTimes(t *testing.T) {
 	}
 }
 
+// A mergeable or not-yet-observed PR has no blocking reasons. The contract
+// types reasons as a string array and the desktop reads it with .includes, so
+// "no reasons" must serialize as [] and never as null, which crashed the
+// session inspector for every open mergeable PR.
+func TestSessionPRSummaryReasonsAreNeverNull(t *testing.T) {
+	for _, state := range []domain.Mergeability{domain.MergeMergeable, domain.MergeUnknown} {
+		payload, err := json.Marshal(controllers.NewSessionPRSummary(sessionsvc.PRSummary{
+			State:        domain.PRStateOpen,
+			Mergeability: sessionsvc.PRMergeabilitySummary{State: state},
+		}))
+		if err != nil {
+			t.Fatal(err)
+		}
+		if !strings.Contains(string(payload), `"reasons":[]`) {
+			t.Fatalf("%s mergeability must serialize reasons as [], got %s", state, payload)
+		}
+	}
+}
+
 func TestSessionsAPI_ClaimPRErrors(t *testing.T) {
 	cases := []struct {
 		name string
```

---

### Incident Patch 13: `7b7db964` (2026-10-05)
**Commit Message**: fix: keep agent sessions active while subagents run (#6201)

* fix: keep Claude sessions active while subagents run

* fix: handle Claude subagent activity edge cases

* fix: keep Codex sessions active while subagents run

* test: align workspace file request assertion

* fix: harden subagent activity recovery

**File**: `backend/internal/adapters/agent/claudecode/hooks.go` (modified, +1/-0)
```diff
@@ -48,6 +48,7 @@ var claudeManagedHooks = []hooksjson.HookSpec{
 	{Event: "PermissionRequest", Command: claudeHookCommandPrefix + "permission-request"},
 	{Event: "Stop", Command: claudeHookCommandPrefix + "stop"},
 	{Event: "Notification", Command: claudeHookCommandPrefix + "notification"},
+	{Event: "SubagentStart", Command: claudeHookCommandPrefix + "subagent-start"},
 	{Event: "SubagentStop", Command: claudeHookCommandPrefix + "subagent-stop"},
 	{Event: "SessionEnd", Command: claudeHookCommandPrefix + "session-end"},
 }
```

**File**: `backend/internal/adapters/agent/codex/activity.go` (modified, +3/-3)
```diff
@@ -14,9 +14,9 @@ func DeriveActivityState(event string, _ []byte) (domain.ActivityState, bool) {
 	case "user-prompt-submit":
 		return domain.ActivityActive, true
 	case "permission-request":
-		// waiting_input, not blocked: codex installs no pre/post-tool-use
-		// hooks, so a blocked state could never be cleared before the turn
-		// ends. waiting_input still suppresses automated nudges.
+		// waiting_input, not blocked: Codex's only PostToolUse hook tracks
+		// successful subagent spawns, not approval resolution. A blocked
+		// state could therefore remain stuck until the turn ends.
 		return domain.ActivityWaitingInput, true
 	case "stop":
 		return domain.ActivityIdle, true
```

**File**: `backend/internal/adapters/agent/codex/codex_test.go` (modified, +4/-1)
```diff
@@ -194,6 +194,9 @@ func sessionHookFlags(t *testing.T) []string {
 		"-c", `hooks.SessionStart=[{hooks=[{type="command",command=` + codexTOMLBasicString(prefix+"session-start") + `,timeout=5}]}]`,
 		"-c", `hooks.UserPromptSubmit=[{hooks=[{type="command",command=` + codexTOMLBasicString(prefix+"user-prompt-submit") + `,timeout=5}]}]`,
 		"-c", `hooks.PermissionRequest=[{hooks=[{type="command",command=` + codexTOMLBasicString(prefix+"permission-request") + `,timeout=5}]}]`,
+		"-c", `hooks.PostToolUse=[{matcher="^(spawn_agent|collaborationspawn_agent)$",hooks=[{type="command",command=` + codexTOMLBasicString(prefix+"post-tool-use") + `,timeout=5}]}]`,
+		"-c", `hooks.SubagentStart=[{hooks=[{type="command",command=` + codexTOMLBasicString(prefix+"subagent-start") + `,timeout=5}]}]`,
+		"-c", `hooks.SubagentStop=[{hooks=[{type="command",command=` + codexTOMLBasicString(prefix+"subagent-stop") + `,timeout=5}]}]`,
 		"-c", `hooks.Stop=[{hooks=[{type="command",command=` + codexTOMLBasicString(prefix+"stop") + `,timeout=5}]}]`,
 	}
 }
@@ -1100,7 +1103,7 @@ func TestDoctorLaunchProbesMirrorLaunchFlags(t *testing.T) {
 	}
 	joined := strings.Join(override, " ")
 	for _, want := range []string{
-		"hooks.SessionStart=", "hooks.UserPromptSubmit=", "hooks.PermissionRequest=", "hooks.Stop=",
+		"hooks.SessionStart=", "hooks.UserPromptSubmit=", "hooks.PermissionRequest=", "hooks.PostToolUse=", "hooks.SubagentStart=", "hooks.SubagentStop=", "hooks.Stop=",
 		"notice.hide_rate_limit_model_nudge=true",
 		`projects={`,
 	} {
```

**File**: `backend/internal/adapters/agent/codex/hooks.go` (modified, +13/-2)
```diff
@@ -63,6 +63,7 @@ type codexHookEntry struct {
 type codexHookSpec struct {
 	Event   string
 	Command string
+	Matcher string
 }
 
 // codexManagedHooks is the source of truth for the hooks AO delivers. Event
@@ -72,6 +73,12 @@ var codexManagedHooks = []codexHookSpec{
 	{Event: "SessionStart", Command: codexHookCommandPrefix + "session-start"},
 	{Event: "UserPromptSubmit", Command: codexHookCommandPrefix + "user-prompt-submit"},
 	{Event: "PermissionRequest", Command: codexHookCommandPrefix + "permission-request"},
+	// Current Codex emits the canonical `spawn_agent` tool name. Keep the
+	// historical collaboration alias while older installed Codex builds drain
+	// their sessions, so both payloads reach the parser.
+	{Event: "PostToolUse", Command: codexHookCommandPrefix + "post-tool-use", Matcher: "^(spawn_agent|collaborationspawn_agent)$"},
+	{Event: "SubagentStart", Command: codexHookCommandPrefix + "subagent-start"},
+	{Event: "SubagentStop", Command: codexHookCommandPrefix + "subagent-stop"},
 	{Event: "Stop", Command: codexHookCommandPrefix + "stop"},
 }
 
@@ -98,8 +105,12 @@ func appendSessionHookFlagsForExecutable(cmd *[]string, executable string) {
 	prefix := shellQuoteHookExecutable(executable) + " hooks codex "
 	for _, spec := range codexManagedHooks {
 		action := strings.TrimPrefix(spec.Command, codexHookCommandPrefix)
-		flag := fmt.Sprintf(`hooks.%s=[{hooks=[{type="command",command=%s,timeout=%d}]}]`,
-			spec.Event, codexTOMLBasicString(prefix+action), codexHookTimeout)
+		matcher := ""
+		if spec.Matcher != "" {
+			matcher = "matcher=" + codexTOMLBasicString(spec.Matcher) + ","
+		}
+		flag := fmt.Sprintf(`hooks.%s=[{%shooks=[{type="command",command=%s,timeout=%d}]}]`,
+			spec.Event, matcher, codexTOMLBasicString(prefix+action), codexHookTimeout)
 		*cmd = append(*cmd, "-c", flag)
 	}
 }
```

**File**: `backend/internal/cli/hooks.go` (modified, +106/-1)
```diff
@@ -53,6 +53,8 @@ type setActivityAPIRequest struct {
 	Event                        string                              `json:"event,omitempty"`
 	ToolName                     string                              `json:"toolName,omitempty"`
 	ToolUseID                    string                              `json:"toolUseId,omitempty"`
+	SubagentID                   string                              `json:"subagentId,omitempty"`
+	RunningSubagentIDs           *[]string                           `json:"runningSubagentIds,omitempty"`
 	AgentSessionID               string                              `json:"agentSessionId,omitempty"`
 	LatestUserPrompt             string                              `json:"latestUserPrompt,omitempty"`
 	LatestAssistantUpdate        string                              `json:"latestAssistantUpdate,omitempty"`
@@ -116,6 +118,94 @@ func activityMeta(payload []byte) (toolName, toolUseID string) {
 	return p.ToolName, p.ToolUseID
 }
 
+// claudeSubagentFacts keeps native child identity separate from the resumable
+// main session id. A non-nil empty slice proves no children remain; nil means
+// Claude could not supply a task-registry snapshot and must not clear children.
+func claudeSubagentFacts(event string, payload []byte) (string, *[]string) {
+	var p struct {
+		AgentID         string          `json:"agent_id"`
+		BackgroundTasks json.RawMessage `json:"background_tasks"`
+	}
+	if json.Unmarshal(normalizeHookPayload(payload), &p) != nil {
+		return "", nil
+	}
+	id := validSubagentID(p.AgentID)
+	if (event != "stop" && event != "subagent-stop") || len(p.BackgroundTasks) == 0 || p.BackgroundTasks[0] != '[' {
+		return id, nil
+	}
+	var tasks []struct {
+		ID   string `json:"id"`
+		Type string `json:"type"`
+	}
+	if json.Unmarshal(p.BackgroundTasks, &tasks) != nil || len(tasks) > 128 {
+		return id, nil
+	}
+	running := make([]string, 0, len(tasks))
+	for _, task := range tasks {
+		if task.Type != "subagent" {
+			continue
+		}
+		childID := validSubagentID(task.ID)
+		if childID == "" {
+			return id, nil
+		}
+		running = append(running, childID)
+	}
+	return id, &running
+}
+
+func validSubagentID(id string) string {
+	id = strings.TrimSpace(id)
+	if id == "" || len(id) > maxActivityMetaLen || domain.SanitizeControlChars(id) != id {
+		return ""
+	}
+	return id
+}
+
+func codexSubagentID(event string, payload []byte) string {
+	if event != "subagent-start" && event != "subagent-stop" && event != "user-prompt-submit" {
+		return ""
+	}
+	var p struct {
+		AgentID string `json:"agent_id"`
+	}
+	if json.Unmarshal(normalizeHookPayload(payload), &p) != nil {
+		return ""
+	}
+	return validSubagentID(p.AgentID)
+}
+
+// Codex emits PostToolUse for spawn_agent before the new child's
+// SubagentStart hook. The successful tool response carries a task path but
+// not the child's native agent_id, so its tool_use_id is a provisional key.
+func codexSpawnToolUseID(payload []byte) string {
+	var p struct {
+		ToolName     string `json:"tool_name"`
+		ToolUseID    string `json:"tool_use_id"`
+		AgentID      string `json:"agent_id"`
+		ToolResponse string `json:"tool_response"`
+	}
+	if json.Unmarshal(normalizeHookPayload(payload), &p) != nil ||
+		!isCodexSpawnToolName(p.ToolName) || p.AgentID != "" {
+		return ""
+	}
+	id := validSubagentID(p.ToolUseID)
+	if id == "" {
+		return ""
+	}
+	var response struct {
+		TaskName string `json:"task_name"`
+	}
+	if json.Unmarshal([]byte(p.ToolResponse), &response) != nil || response.TaskName == "" {
+		return ""
+	}
+	return id
+}
+
+func isCodexSpawnToolName(name string) bool {
+	return name == "spawn_agent" || name == "collaborationspawn_agent"
+}
+
 // normalizeHookPayload strips a leading UTF-8 BOM so payloads re-encoded by a
 // hook wrapper (notably Windows PowerShell, whose pipeline writes UTF-16 text
 // that surfaces to the child with a BOM prefix) still decode as JSON.
@@ -516,7 +606,20 @@ func (c *commandContext) runHook(ctx context.Context, agent, event string) error
 		agentSessionID = hookAgentSessionID(payload)
 	}
 	usage := hookUsageMetadata(agent, payload)
-	if !hasActivity && agentSessionID == "" && usage == nil {
+	var subagentID string
+	var runningSubagentIDs *[]string
+	if domain.AgentHarness(agent) == domain.HarnessClaudeCode {
+		subagentID, runningSubagentIDs = claudeSubagentFacts(event, payload)
+	} else if domain.AgentHarness(agent) == domain.HarnessCodex {
+		subagentID = codexSubagentID(event, payload)
+		if event == "post-tool-use" {
+			if spawnID := codexSpawnToolUseID(payload); spawnID != "" {
+				subagentID = spawnID
+				event = "subagent-spawn"
+			}
+		}
+	}
+	if !hasActivity && agentSessionID == "" && usage == nil && subagentID == "" {
 		// Unknown agent, or an event carrying neither activity nor resumable
 		// session metadata: report nothing.
 		return nil
@@ -549,6 +652,8 @@ func (c *commandContext) runHook(ctx context.Context, agent, event string) error
 		Event:                        event,
 		Tool
```

**File**: `backend/internal/cli/hooks_test.go` (modified, +147/-0)
```diff
@@ -525,6 +525,153 @@ func TestHooks_StopReportsIdle(t *testing.T) {
 	}
 }
 
+func TestHooks_ClaudeStopCarriesRunningSubagents(t *testing.T) {
+	t.Setenv("AO_SESSION_ID", "ao-7")
+	t.Setenv("AO_RUNTIME_LAUNCH_ID", "launch-3")
+	cfg := setConfigEnv(t)
+	srv, capture := activityServer(t, http.StatusOK, `{"ok":true}`)
+	writeRunFileFor(t, cfg, srv)
+	payload := `{"session_id":"native-main","background_tasks":[{"id":"child-1","type":"subagent","status":"running"},{"id":"shell-1","type":"bash","status":"running"}]}`
+	_, _, err := executeCLI(t, Deps{
+		In: strings.NewReader(payload), ProcessAlive: func(int) bool { return true },
+	}, "hooks", "claude-code", "stop")
+	if err != nil {
+		t.Fatal(err)
+	}
+	var req setActivityAPIRequest
+	if err := json.Unmarshal([]byte(capture.body), &req); err != nil {
+		t.Fatal(err)
+	}
+	if req.State != "idle" || req.RunningSubagentIDs == nil || len(*req.RunningSubagentIDs) != 1 || (*req.RunningSubagentIDs)[0] != "child-1" {
+		t.Fatalf("Stop request = %+v", req)
+	}
+	_, _, err = executeCLI(t, Deps{
+		In:           strings.NewReader(`{"session_id":"native-main","background_tasks":[]}`),
+		ProcessAlive: func(int) bool { return true },
+	}, "hooks", "claude-code", "stop")
+	if err != nil {
+		t.Fatal(err)
+	}
+	req = setActivityAPIRequest{}
+	if err := json.Unmarshal([]byte(capture.body), &req); err != nil {
+		t.Fatal(err)
+	}
+	if req.RunningSubagentIDs == nil || len(*req.RunningSubagentIDs) != 0 {
+		t.Fatalf("empty background snapshot lost: %+v", req)
+	}
+	_, _, err = executeCLI(t, Deps{
+		In:           strings.NewReader(`{"session_id":"native-main"}`),
+		ProcessAlive: func(int) bool { return true },
+	}, "hooks", "claude-code", "stop")
+	if err != nil {
+		t.Fatal(err)
+	}
+	req = setActivityAPIRequest{}
+	if err := json.Unmarshal([]byte(capture.body), &req); err != nil {
+		t.Fatal(err)
+	}
+	if req.RunningSubagentIDs != nil {
+		t.Fatalf("unavailable task registry became an empty snapshot: %+v", req)
+	}
+	_, _, err = executeCLI(t, Deps{
+		In:           strings.NewReader(`{"session_id":"native-main","agent_id":"child-1","background_tasks":[{"id":"child-2","type":"subagent"}]}`),
+		ProcessAlive: func(int) bool { return true },
+	}, "hooks", "claude-code", "subagent-stop")
+	if err != nil {
+		t.Fatal(err)
+	}
+	req = setActivityAPIRequest{}
+	if err := json.Unmarshal([]byte(capture.body), &req); err != nil {
+		t.Fatal(err)
+	}
+	if req.SubagentID != "child-1" || req.RunningSubagentIDs == nil || len(*req.RunningSubagentIDs) != 1 || (*req.RunningSubagentIDs)[0] != "child-2" {
+		t.Fatalf("SubagentStop parent snapshot = %+v", req)
+	}
+}
+
+func TestHooks_ClaudeSubagentIdentityDoesNotBecomeMainConversation(t *testing.T) {
+	t.Setenv("AO_SESSION_ID", "ao-7")
+	t.Setenv("AO_RUNTIME_LAUNCH_ID", "launch-3")
+	cfg := setConfigEnv(t)
+	srv, capture := activityServer(t, http.StatusOK, `{"ok":true}`)
+	writeRunFileFor(t, cfg, srv)
+	for _, event := range []string{"subagent-start", "pre-tool-use", "subagent-stop"} {
+		_, _, err := executeCLI(t, Deps{
+			In:           strings.NewReader(`{"session_id":"native-main","agent_id":"child-1","tool_name":"Bash","last_assistant_message":"child answer"}`),
+			ProcessAlive: func(int) bool { return true },
+		}, "hooks", "claude-code", event)
+		if err != nil {
+			t.Fatal(err)
+		}
+		var req setActivityAPIRequest
+		if err := json.Unmarshal([]byte(capture.body), &req); err != nil {
+			t.Fatal(err)
+		}
+		if req.SubagentID != "child-1" || req.AgentSessionID != "native-main" || req.LatestAssistantUpdate != "" {
+			t.Fatalf("%s request = %+v", event, req)
+		}
+	}
+}
+
+func TestHooks_CodexSubagentEventsCarryChildIdentity(t *testing.T) {
+	t.Setenv("AO_SESSION_ID", "ao-7")
+	t.Setenv("AO_RUNTIME_LAUNCH_ID", "launch-3")
+	cfg := setConfigEnv(t)
+	srv, capture := activityServer(t, http.StatusOK, `{"ok":true}`)
+	writeRunFileFor(t, cfg, srv)
+	for _, event := range []string{"subagent-start", "user-prompt-submit", "subagent-stop"} {
+		_, _, err := executeCLI(t, Deps{
+			In:           strings.NewReader(`{"session_id":"native-root","agent_id":"child-1","last_assistant_message":"child answer"}`),
+			ProcessAlive: func(int) bool { return true },
+		}, "hooks", "codex", event)
+		if err != nil {
+			t.Fatal(err)
+		}
+		var req setActivityAPIRequest
+		if err := json.Unmarshal([]byte(capture.body), &req); err != nil {
+			t.Fatal(err)
+		}
+		if req.Event != event || req.SubagentID != "child-1" || req.AgentSessionID != "native-root" || req.LaunchID != "launch-3" ||
+			req.LatestUserPrompt != "" || req.LatestAssistantUpdate != "" || req.ProviderTurnID != "" {
+			t.Fatalf("%s request = %+v", event, req)
+		}
+	}
+}
+
+func TestHooks_CodexSpawnToolResultCarriesProvisionalChild(t *testing.T) {
+	t.Setenv("AO_SESSION_ID", "ao-7")
+	t.Setenv("AO_RUNTIME_LAUNCH_ID", "launch-3")
+	cfg := setConfigEnv(t)
+	srv, capture := activityServer(t, http.StatusOK, `{"ok":true}`)
+	writeRunFileFor(t, cfg, srv)
+	payload := `{"session_id":"native-root","to
```

**File**: `backend/internal/domain/session.go` (modified, +6/-0)
```diff
@@ -117,6 +117,12 @@ type SessionMetadata struct {
 	// active native agent session when its provider exposes one. Retained
 	// provider-specific paths also live on AgentNativeSession records.
 	NativeTranscriptPath string `json:"nativeTranscriptPath,omitempty"`
+	// ClaudeActivityFacts records parent-turn and subagent hook facts for the
+	// current runtime launch. It is internal native evidence, not display status.
+	ClaudeActivityFacts string `json:"-"`
+	// CodexActivityFacts records parent-turn and native child hook facts for the
+	// current runtime launch. It is internal evidence, not display status.
+	CodexActivityFacts string `json:"-"`
 	// ProviderConversationID is the opaque handle a Chat driver needs to resume
 	// this session's provider conversation after a restart (a Codex thread id
 	// today). Normally empty for TUI sessions. It remains a distinct field from
```

**File**: `backend/internal/httpd/apispec/openapi.yaml` (modified, +11/-0)
```diff
@@ -14066,6 +14066,14 @@ components:
         providerTurnId:
           description: Native main-turn identity reported by the hook, when supported.
           type: string
+        runningSubagentIds:
+          description: Running Claude subagent ids observed in a parent Stop hook;
+            empty means none, absent means no snapshot.
+          items:
+            type: string
+          type:
+          - "null"
+          - array
         state:
           description: Agent activity state reported by an agent hook. Optional for
             metadata-only hooks.
@@ -14076,6 +14084,9 @@ components:
           - blocked
           - exited
           type: string
+        subagentId:
+          description: Native child agent id for this hook event.
+          type: string
         submissionId:
           description: AO prompt-hook context correlation UUID, when supported.
           maxLength: 36
```

---

### Incident Patch 14: `1a6bc471` (2026-10-05)
**Commit Message**: fix: check session health at startup and resume sessions on opening (#6254)

* fix: check session health without launching agents on startup

* fix: report native conversation recovery failures

* fix: resume stopped sessions when opened

* fix: keep stopped session status and resume banners quiet

* test: expect neutral dots for stopped sidebar sessions

* fix: preserve sessions when runtime probe is unavailable

**File**: `backend/internal/adapters/chatdriver/acp/driver.go` (modified, +15/-0)
```diff
@@ -37,6 +37,7 @@ type Launch struct {
 // construct its process. It intentionally contains no install mechanism: binary
 // ownership stays with the existing agent plugin.
 type LaunchConfig struct {
+	ReconnectOnly   bool
 	SessionID       domain.SessionID
 	DataDir         string
 	WorkspacePath   string
@@ -303,6 +304,12 @@ func (d *Driver) logStartStage(sessionID domain.SessionID, stage string, started
 	)
 }
 
+// Reconnect attaches to a surviving provider without launching a replacement.
+func (d *Driver) Reconnect(ctx context.Context, cfg ports.ChatResumeConfig) (ports.ChatConversation, error) {
+	cfg.ReconnectOnly = true
+	return d.Resume(ctx, cfg)
+}
+
 // Resume reconnects to the stored ACP session. When the agent advertises
 // session/load, AO uses it to recover both provider context and the normalized
 // transcript; resume-only agents recover context but explicitly report that no
@@ -334,6 +341,7 @@ func (d *Driver) Resume(ctx context.Context, cfg ports.ChatResumeConfig) (ports.
 		Env:   cfg.Env,
 		Model: cfg.Model, Permissions: cfg.Permissions, SystemPrompt: cfg.SystemPrompt,
 		ProviderScopeID: cfg.ProviderScopeID,
+		ReconnectOnly:   cfg.ReconnectOnly,
 	}
 	conv, init, live, err := d.connect(ctx, launchCfg, cfg.PrepareEnv)
 	if err != nil {
@@ -459,6 +467,9 @@ func (d *Driver) connect(
 	cfg LaunchConfig,
 	prepareEnv func(context.Context) (map[string]string, error),
 ) (*conversation, acpsdk.InitializeResponse, *persistenthost.ACPState, error) {
+	if cfg.ReconnectOnly && (cfg.DataDir == "" || cfg.SessionID == "") {
+		return nil, acpsdk.InitializeResponse{}, nil, ports.ErrChatHostNotRunning
+	}
 	processStarted := time.Now()
 	proc, err := d.openProcess(ctx, cfg, prepareEnv)
 	d.logStartStage(cfg.SessionID, "process_open", processStarted, err)
@@ -567,6 +578,7 @@ func (d *Driver) connectProcess(
 	hostConfig := persistenthost.Config{
 		SessionID: string(cfg.SessionID), DataDir: cfg.DataDir, Workdir: cfg.WorkspacePath,
 		Protocol: persistenthost.ProtocolACP, OwnershipFingerprint: identity,
+		ReconnectOnly: cfg.ReconnectOnly,
 		Prepare: func(prepareCtx context.Context) (persistenthost.PreparedProvider, error) {
 			if prepareEnv != nil {
 				env, err := prepareEnv(prepareCtx)
@@ -592,6 +604,9 @@ func (d *Driver) connectProcess(
 	}
 	transport, err := d.connectHost(ctx, hostConfig)
 	if err != nil {
+		if errors.Is(err, persistenthost.ErrNotRunning) {
+			return nil, ports.ErrChatHostNotRunning
+		}
 		if errors.Is(err, persistenthost.ErrOwnershipInconclusive) ||
 			errors.Is(err, persistenthost.ErrAttached) ||
 			errors.Is(err, persistenthost.ErrIncompatible) ||
```

**File**: `backend/internal/adapters/chatdriver/acp/driver_test.go` (modified, +18/-1)
```diff
@@ -198,7 +198,7 @@ func testACPProcessDetach(t *testing.T, harness domain.AgentHarness) {
 		return Launch{}, errors.New("new provider installation is unavailable")
 	}
 	secondDriver := New(cfg, log)
-	second, err := secondDriver.Resume(context.Background(), ports.ChatResumeConfig{
+	second, err := secondDriver.Reconnect(context.Background(), ports.ChatResumeConfig{
 		SessionID: "persistent-acp-e2e", DataDir: dataDir, WorkspacePath: workdir,
 		ProviderConversationID: "persistent-provider-session", ProviderScopeID: "scope",
 		PrepareEnv: prepareEnv, Model: "changed-model", Permissions: ports.PermissionModeAuto,
@@ -4066,3 +4066,20 @@ func TestACPCompactionRestoredOnLiveReconnect(t *testing.T) {
 		t.Errorf("compactingTurnID = %q, want durable-compaction-turn", compacting)
 	}
 }
+
+func TestReconnectMissingHostNeverLaunchesProvider(t *testing.T) {
+	driver := New(Config{Harness: domain.HarnessClaudeCode, Launch: func(context.Context, LaunchConfig) (Launch, error) {
+		t.Fatal("health check tried to launch ACP provider")
+		return Launch{}, nil
+	}}, nil)
+	_, err := driver.Reconnect(context.Background(), ports.ChatResumeConfig{
+		SessionID: "stopped", ProviderConversationID: "native", DataDir: t.TempDir(), WorkspacePath: t.TempDir(),
+		PrepareEnv: func(context.Context) (map[string]string, error) {
+			t.Fatal("health check rotated launch credentials")
+			return nil, nil
+		},
+	})
+	if !errors.Is(err, ports.ErrChatHostNotRunning) {
+		t.Fatalf("error=%v", err)
+	}
+}
```

**File**: `backend/internal/adapters/chatdriver/codexappserver/driver.go` (modified, +28/-10)
```diff
@@ -291,7 +291,7 @@ func (d *Driver) Start(ctx context.Context, cfg ports.ChatStartConfig) (ports.Ch
 	}
 
 	conv, reconnected, err := d.connectSession(
-		ctx, cfg.SessionID, cfg.DataDir, cfg.WorkspacePath, cfg.Env, cfg.PrepareEnv, cfg.ProviderScopeID,
+		ctx, cfg.SessionID, cfg.DataDir, cfg.WorkspacePath, cfg.Env, cfg.PrepareEnv, cfg.ProviderScopeID, false,
 	)
 	if err != nil {
 		return nil, err
@@ -349,6 +349,12 @@ func (d *Driver) Start(ctx context.Context, cfg ports.ChatStartConfig) (ports.Ch
 	return conv, nil
 }
 
+// Reconnect attaches to a surviving provider without launching a replacement.
+func (d *Driver) Reconnect(ctx context.Context, cfg ports.ChatResumeConfig) (ports.ChatConversation, error) {
+	cfg.ReconnectOnly = true
+	return d.Resume(ctx, cfg)
+}
+
 // Resume reattaches to a stored Codex thread after a daemon or app-server
 // restart. A thread that is still running is rejoined rather than restarted.
 func (d *Driver) Resume(ctx context.Context, cfg ports.ChatResumeConfig) (ports.ChatConversation, error) {
@@ -363,7 +369,7 @@ func (d *Driver) Resume(ctx context.Context, cfg ports.ChatResumeConfig) (ports.
 	}
 
 	conv, reconnected, err := d.connectSession(
-		ctx, cfg.SessionID, cfg.DataDir, cfg.WorkspacePath, cfg.Env, cfg.PrepareEnv, cfg.ProviderScopeID,
+		ctx, cfg.SessionID, cfg.DataDir, cfg.WorkspacePath, cfg.Env, cfg.PrepareEnv, cfg.ProviderScopeID, cfg.ReconnectOnly,
 	)
 	if err != nil {
 		return nil, err
@@ -446,10 +452,14 @@ func (d *Driver) connectSession(
 	env map[string]string,
 	prepareEnv func(context.Context) (map[string]string, error),
 	providerScopeID string,
+	reconnectOnly bool,
 ) (*conversation, bool, error) {
 	// Injected driver tests intentionally retain the direct pipe launcher. The
 	// shipped driver uses spawnAppServer and therefore the persistent host.
 	if !d.persistent {
+		if reconnectOnly {
+			return nil, false, ports.ErrChatHostNotRunning
+		}
 		if prepareEnv != nil {
 			var err error
 			env, err = prepareEnv(ctx)
@@ -460,16 +470,21 @@ func (d *Driver) connectSession(
 		conv, err := d.connect(ctx, workdir, env, providerScopeID)
 		return conv, false, err
 	}
-	bin, err := d.plugin.ResolveBinary(ctx)
-	if err != nil {
-		return nil, false, fmt.Errorf("%w: %w", ports.ErrChatDriverUnavailable, err)
+	var bin string
+	if !reconnectOnly {
+		var err error
+		bin, err = d.plugin.ResolveBinary(ctx)
+		if err != nil {
+			return nil, false, fmt.Errorf("%w: %w", ports.ErrChatDriverUnavailable, err)
+		}
 	}
 	hostConfig := persistenthost.Config{
-		SessionID: string(sessionID),
-		DataDir:   dataDir,
-		Workdir:   workdir,
-		Env:       envSlice(env),
-		Argv:      []string{bin, "app-server"},
+		SessionID:     string(sessionID),
+		ReconnectOnly: reconnectOnly,
+		DataDir:       dataDir,
+		Workdir:       workdir,
+		Env:           envSlice(env),
+		Argv:          []string{bin, "app-server"},
 	}
 	if prepareEnv != nil {
 		hostConfig.Prepare = func(prepareCtx context.Context) (persistenthost.PreparedProvider, error) {
@@ -484,6 +499,9 @@ func (d *Driver) connectSession(
 	}
 	transport, err := d.connectHost(ctx, hostConfig)
 	if err != nil {
+		if errors.Is(err, persistenthost.ErrNotRunning) {
+			return nil, false, ports.ErrChatHostNotRunning
+		}
 		if errors.Is(err, persistenthost.ErrOwnershipInconclusive) ||
 			errors.Is(err, persistenthost.ErrAttached) ||
 			errors.Is(err, persistenthost.ErrIncompatible) ||
```

**File**: `backend/internal/adapters/chatdriver/codexappserver/driver_test.go` (modified, +20/-3)
```diff
@@ -285,21 +285,24 @@ func TestStartCompletesHandshakeAndOpensThread(t *testing.T) {
 	}
 }
 
-func TestResumeReconnectsInitializedHostWithoutNativeResume(t *testing.T) {
+func TestReconnectAdoptsInitializedHostWithoutNativeResume(t *testing.T) {
 	d, srv := newTestDriver(t)
 	prepareCalls := 0
 	proc, err := d.spawn(context.Background(), "codex", "/tmp/ws", nil)
 	if err != nil {
 		t.Fatal(err)
 	}
 	d.persistent = true
-	d.connectHost = func(context.Context, persistenthost.Config) (*persistenthost.Transport, error) {
+	d.connectHost = func(_ context.Context, cfg persistenthost.Config) (*persistenthost.Transport, error) {
+		if !cfg.ReconnectOnly {
+			t.Fatal("startup reconnect allowed a provider launch")
+		}
 		return &persistenthost.Transport{
 			Stdin: proc.stdin, Stdout: proc.stdout, Reconnected: true, NextRequestID: 41,
 		}, nil
 	}
 
-	conv, err := d.Resume(context.Background(), ports.ChatResumeConfig{
+	conv, err := d.Reconnect(context.Background(), ports.ChatResumeConfig{
 		SessionID: "ao-reconnect", ProviderConversationID: "thread-survived",
 		DataDir: t.TempDir(), WorkspacePath: "/tmp/ws",
 		PrepareEnv: func(context.Context) (map[string]string, error) {
@@ -1578,3 +1581,17 @@ func TestEnvSliceWithNoOverlayStillInheritsTheEnvironment(t *testing.T) {
 		t.Error("an empty overlay produced an environment with no HOME")
 	}
 }
+
+func TestReconnectMissingHostNeverLaunchesProvider(t *testing.T) {
+	driver := New(fakePlugin{binErr: errors.New("provider installation is unavailable")}, nil)
+	_, err := driver.Reconnect(context.Background(), ports.ChatResumeConfig{
+		SessionID: "stopped", ProviderConversationID: "thread", DataDir: t.TempDir(), WorkspacePath: t.TempDir(),
+		PrepareEnv: func(context.Context) (map[string]string, error) {
+			t.Fatal("health check rotated launch credentials")
+			return nil, nil
+		},
+	})
+	if !errors.Is(err, ports.ErrChatHostNotRunning) {
+		t.Fatalf("error=%v", err)
+	}
+}
```

**File**: `backend/internal/adapters/chatdriver/persistenthost/host.go` (modified, +6/-0)
```diff
@@ -77,6 +77,8 @@ var (
 	// client could not prove that it is safe to replace. Callers must preserve the
 	// durable session rather than treating the failed attachment as provider death.
 	ErrOwnershipInconclusive = errors.New("chat host ownership is inconclusive")
+	// ErrNotRunning means a reconnect-only probe found no surviving host.
+	ErrNotRunning = errors.New("chat host is not running")
 )
 
 // Descriptor is the private connection record published by a running host.
@@ -93,6 +95,7 @@ type Descriptor struct {
 
 // Config identifies one provider process and its AO session ownership.
 type Config struct {
+	ReconnectOnly        bool
 	SessionID            string
 	DataDir              string
 	Workdir              string
@@ -332,6 +335,9 @@ func ConnectOrStart(ctx context.Context, cfg Config) (*Transport, error) {
 		// exists. Fail closed instead of launching a competing process.
 		return nil, fmt.Errorf("%w: %w", ErrOwnershipInconclusive, err)
 	}
+	if cfg.ReconnectOnly {
+		return nil, ErrNotRunning
+	}
 	if !filepath.IsAbs(cfg.Workdir) {
 		return nil, errors.New("chat host start requires an absolute workdir")
 	}
```

**File**: `backend/internal/adapters/chatdriver/persistenthost/host_test.go` (modified, +15/-0)
```diff
@@ -589,6 +589,7 @@ func TestConnectOrStartPreparesOnlyWhenLaunchingProvider(t *testing.T) {
 			_ = Shutdown(context.Background(), dataDir, cfg.SessionID)
 			<-done
 		})
+		cfg.ReconnectOnly = true
 		prepareCalls := 0
 		cfg.Prepare = func(context.Context) (PreparedProvider, error) {
 			prepareCalls++
@@ -987,3 +988,17 @@ func requestProviderPID(t *testing.T, transport *Transport, id int64, method str
 	}
 	return response.Result.PID
 }
+
+func TestReconnectOnlyNeverPreparesOrStartsMissingHost(t *testing.T) {
+	cfg := Config{SessionID: "missing", DataDir: t.TempDir(), Workdir: t.TempDir(), ReconnectOnly: true}
+	cfg.Prepare = func(context.Context) (PreparedProvider, error) {
+		t.Fatal("health check prepared a provider launch")
+		return PreparedProvider{}, nil
+	}
+	if _, err := ConnectOrStart(context.Background(), cfg); !errors.Is(err, ErrNotRunning) {
+		t.Fatalf("error = %v, want stopped host", err)
+	}
+	if _, err := readDescriptor(cfg.DataDir, cfg.SessionID); !errors.Is(err, os.ErrNotExist) {
+		t.Fatalf("health check wrote a descriptor: %v", err)
+	}
+}
```

**File**: `backend/internal/ports/chat.go` (modified, +10/-0)
```diff
@@ -44,6 +44,8 @@ var (
 	// must preserve the durable session and worktree rather than treating the
 	// failed attachment as proof that the provider died.
 	ErrChatRecoveryInconclusive = errors.New("chat conversation recovery is inconclusive")
+	// ErrChatHostNotRunning is a definitive observation that no provider host exists.
+	ErrChatHostNotRunning = errors.New("chat provider host is not running")
 	// ErrChatNoActiveTurn means an interrupt found nothing to cancel — either AO
 	// has no turn in flight, or the provider no longer considers the named turn
 	// active. A driver must translate its provider's refusal into this rather than
@@ -323,6 +325,8 @@ type ChatStartConfig struct {
 
 // ChatResumeConfig reattaches to a provider conversation after a restart.
 type ChatResumeConfig struct {
+	// ReconnectOnly forbids launching a replacement provider during a health check.
+	ReconnectOnly bool
 	// See ChatStartConfig.ProviderIDsScoped.
 	ProviderIDsScoped      bool
 	SessionID              domain.SessionID
@@ -1057,6 +1061,12 @@ type ChatDriver interface {
 	Resume(ctx context.Context, cfg ChatResumeConfig) (ChatConversation, error)
 }
 
+// ChatDriverReconnector attaches only to a surviving provider. Implementations
+// must never create a provider process or fall back to native history resume.
+type ChatDriverReconnector interface {
+	Reconnect(context.Context, ChatResumeConfig) (ChatConversation, error)
+}
+
 // ChatConversation is one live controller. Exactly one exists per Chat session,
 // and it is the only writer to its provider conversation.
 type ChatConversation interface {
```

**File**: `backend/internal/ports/chat_controller.go` (modified, +3/-1)
```diff
@@ -19,7 +19,9 @@ const (
 
 // ChatControllerStart is the resolved launch contract shared by the coordinator and Chat service.
 type ChatControllerStart struct {
-	SessionID domain.SessionID
+	// ReconnectOnly restricts startup recovery to an existing provider process.
+	ReconnectOnly bool
+	SessionID     domain.SessionID
 	// Owner distinguishes worker and review conversations that share a worker
 	// session. Empty preserves the existing worker-session owner.
 	Owner         domain.ConversationOwner
```

---

### Incident Patch 15: `fd2d4ac7` (2026-10-05)
**Commit Message**: fix(frontend): remove default effort choices (#6265)

**File**: `frontend/src/renderer/components/TaskComposer.test.tsx` (modified, +4/-5)
```diff
@@ -1832,7 +1832,7 @@ describe("TaskComposer", () => {
 		expect(JSON.parse(window.localStorage.getItem("ao.taskComposer.preferences.v1") ?? "{}")["proj-1"].agents.codex).not.toHaveProperty("effort");
 	});
 
-	it("can clear an effort choice when the agent reports no preferred level", async () => {
+	it("offers only concrete effort choices when the agent reports no preferred level", async () => {
 		h.get.mockImplementation(async (path: string) => path.includes("/models")
 			? { data: { agent: "codex", selectionMode: "catalog", models: [
 				{ id: "gpt-test", label: "GPT Test", isDefault: true, efforts: ["low", "high"] },
@@ -1845,12 +1845,11 @@ describe("TaskComposer", () => {
 		await userEvent.click(picker);
 		await userEvent.click(screen.getByRole("menuitem", { name: "High" }));
 		await userEvent.click(picker);
-		await userEvent.click(screen.getByRole("menuitem", { name: "Use agent effort" }));
-		expect(picker).toHaveTextContent("Effort not reported");
+		expect(screen.queryByRole("menuitem", { name: "Use agent effort" })).not.toBeInTheDocument();
+		await userEvent.keyboard("{Escape}");
 		fireEvent.click(startTask());
 		await waitFor(() => expect(h.post).toHaveBeenCalledOnce());
-		expect(h.post.mock.calls[0][1].body).not.toHaveProperty("effort");
-		expect(JSON.parse(window.localStorage.getItem("ao.taskComposer.preferences.v1") ?? "{}")["proj-1"].agents.codex).not.toHaveProperty("effort");
+		expect(h.post.mock.calls[0][1].body).toEqual(expect.objectContaining({ effort: "high" }));
 	});
 
 	it("shows a stored implicit model as the catalog choice without pinning it", async () => {
```

**File**: `frontend/src/renderer/components/TaskComposer.tsx` (modified, +0/-1)
```diff
@@ -750,7 +750,6 @@ function TaskEffortPicker({ disabled, label, onChange, options, value, defaultEf
 			disabled={disabled}
 			value={effectiveEffort}
 			options={options.map((option) => ({ value: option, label: formatEffortLabel(option) }))}
-			action={explicitEffort && !reportedDefault ? { label: t("settings.models.useAgentEffort"), onSelect: () => onChange("") } : undefined}
 			triggerClassName="composer-chip composer-toolbar-option w-full justify-between"
 			menuAlign="end"
 			renderTrigger={() => (
```

**File**: `frontend/src/renderer/components/chat/TurnSettingsBar.test.tsx` (modified, +4/-4)
```diff
@@ -333,7 +333,7 @@ describe("ACP session config options", () => {
 		expect(onChange).toHaveBeenLastCalledWith("profile", { value: "default" });
 	});
 
-	it("keeps an unreported effort selectable without claiming a concrete level", async () => {
+	it("hides the provider default effort choice while keeping concrete levels selectable", async () => {
 		const user = userEvent.setup();
 		const onChange = vi.fn();
 		const option: ChatConfigOption = {
@@ -347,16 +347,16 @@ describe("ACP session config options", () => {
 		const view = render(<TurnSettingsBar models={[]} settings={{}} onChangeConfigOption={onChange} configOptions={[option]} />);
 
 		const picker = screen.getByRole("button", { name: "Effort" });
-		expect(picker).toHaveTextContent("Use agent effort");
+		expect(picker).toHaveTextContent("Effort");
 		await user.click(picker);
 		expect(screen.queryByRole("menuitemradio", { name: "Default" })).not.toBeInTheDocument();
 		await user.click(screen.getByRole("menuitemradio", { name: "High" }));
 		expect(onChange).toHaveBeenCalledWith("effort", { value: "high" });
 		view.rerender(<TurnSettingsBar models={[]} settings={{}} onChangeConfigOption={onChange}
 			configOptions={[{ ...option, currentValue: "high" }]} />);
 		await user.click(screen.getByRole("button", { name: "Effort" }));
-		await user.click(screen.getByRole("menuitemradio", { name: "Use agent effort" }));
-		expect(onChange).toHaveBeenLastCalledWith("effort", { value: "default" });
+		expect(screen.queryByRole("menuitemradio", { name: "Use agent effort" })).not.toBeInTheDocument();
+		expect(screen.queryByRole("menuitemradio", { name: "Default" })).not.toBeInTheDocument();
 	});
 
 	it("shows the concrete recommended model selected without a duplicate default option", async () => {
```

**File**: `frontend/src/renderer/components/chat/TurnSettingsBar.tsx` (modified, +15/-4)
```diff
@@ -160,10 +160,10 @@ export function TurnSettingsBar({
 		: undefined;
 	const modelLabel = rerouted ?? chosenLabel;
 	const availableEfforts = (selected ?? fallback)?.efforts ?? [];
-	const efforts = harness === "claude-code" ? availableEfforts.filter((effort) => effort !== "default") : availableEfforts;
+	const efforts = availableEfforts.filter((effort) => effort.toLowerCase() !== "default");
 	const selectedEffort =
 		settings.reasoningEffort ?? (selected ?? fallback)?.defaultEffort ?? undefined;
-	const effortLabel = harness === "claude-code" && selectedEffort === "default" ? undefined : selectedEffort;
+	const effortLabel = selectedEffort === "default" ? undefined : selectedEffort;
 	const approvalCopy = harness === "codex" ? CODEX_APPROVAL_COPY : APPROVAL_COPY;
 	const approvalOrder = harness === "codex" ? CODEX_APPROVAL_ORDER : APPROVAL_ORDER;
 	const approvalLabel = approvalCopy[settings.approvalMode ?? "default"].label;
@@ -914,7 +914,11 @@ function partitionConfigOptions(options: ChatConfigOption[]): {
 	let executionMode: ChatConfigOption | undefined;
 	let mode: ChatConfigOption | undefined;
 	for (const rawOption of options) {
-		const option = rawOption.type === "select" ? resolveImplicitChoice(rawOption) : rawOption;
+		const option = rawOption.type === "select"
+			? isEffortOption(rawOption)
+				? withChoices(rawOption, rawOption.choices.filter((choice) => !isDefaultEffortChoice(choice)))
+				: resolveImplicitChoice(rawOption)
+			: rawOption;
 		if (option.type === "select" && option.choices.length === 0) continue;
 		if (isAgentOption(option)) continue;
 		if (isModelOption(option)) {
@@ -951,6 +955,13 @@ function partitionConfigOptions(options: ChatConfigOption[]): {
 	return { model: [...primaryModel, ...otherModel], effort, executionMode, toggles, mode, extra };
 }
 
+function isDefaultEffortChoice(choice: ChatConfigOption["choices"][number]): boolean {
+	const name = choice.name.trim().toLowerCase();
+	const value = choice.value.trim().toLowerCase();
+	return ["default", "provider default", "agent default", "model default", "use agent effort", "use provider effort", "use model effort"].includes(name)
+		|| ["default", "inherit", "provider-default", "agent-default", "model-default"].includes(value);
+}
+
 // ACP may expose a provider-owned choice whose description names a concrete
 // option. Keep its wire value so users can return to following the provider.
 function resolveImplicitChoice(option: ChatConfigOption): ChatConfigOption {
@@ -972,7 +983,7 @@ function resolveImplicitChoice(option: ChatConfigOption): ChatConfigOption {
 	const concrete = mapped.choices.find((choice) =>
 		choice.value !== implicit.value && choice.name.toLowerCase() === implicit.description?.trim().toLowerCase(),
 	);
-	const followLabel = isModelOption(mapped) ? "Use agent model" : isEffortOption(mapped) ? "Use agent effort" : "Use agent setting";
+	const followLabel = isModelOption(mapped) ? "Use agent model" : "Use agent setting";
 	if (concrete && mapped.currentValue !== concrete.value) {
 		const label = isDefaultPlaceholderLabel(concrete.name) ? concrete.value : concrete.name;
 		return {
```

**File**: `frontend/src/renderer/components/settings/AgentModelCombobox.tsx` (modified, +0/-5)
```diff
@@ -481,11 +481,6 @@ export function AgentModelCombobox({
 								setEffortMenuOpen(false);
 								effortTriggerRef.current?.focus();
 							}}>
-								{explicitEffort && !defaultEffort && (
-									<OptionMenuItem onSelect={() => tuning.onEffortChange("")} className="gap-3 text-xs">
-										{t("settings.models.useAgentEffort")}
-									</OptionMenuItem>
-								)}
 								{effortOptions.map((effort) => (
 									<OptionMenuItem key={effort} role="menuitemradio" aria-checked={effort === effectiveEffort}
 										active={effort === effectiveEffort} onSelect={() => {
```

**File**: `frontend/src/renderer/i18n/de.json` (modified, +0/-1)
```diff
@@ -2321,7 +2321,6 @@
 	"settings.models.selectModel": "Modell auswählen",
 	"settings.models.useAgentModel": "Agentenmodell verwenden",
 	"settings.models.useAgentMode": "Agentenmodus verwenden",
-	"settings.models.useAgentEffort": "Denkaufwand des Agenten verwenden",
 	"settings.models.effortNotReported": "Aufwand nicht gemeldet",
 	"settings.models.modeNotReported": "Modus nicht gemeldet",
 	"remote.hosts": "Remote-Hosts",
```

**File**: `frontend/src/renderer/i18n/en.json` (modified, +0/-1)
```diff
@@ -2301,7 +2301,6 @@
 	"settings.models.selectModel": "Select model",
 	"settings.models.useAgentModel": "Use agent model",
 	"settings.models.useAgentMode": "Use agent mode",
-	"settings.models.useAgentEffort": "Use agent effort",
 	"settings.models.effortNotReported": "Effort not reported",
 	"settings.models.modeNotReported": "Mode not reported",
 	"remote.hosts": "Remote hosts",
```

**File**: `frontend/src/renderer/i18n/es.json` (modified, +0/-1)
```diff
@@ -2351,7 +2351,6 @@
 	"settings.models.selectModel": "Seleccionar modelo",
 	"settings.models.useAgentModel": "Usar modelo del agente",
 	"settings.models.useAgentMode": "Usar modo del agente",
-	"settings.models.useAgentEffort": "Usar esfuerzo de razonamiento del agente",
 	"settings.models.effortNotReported": "Esfuerzo no informado",
 	"settings.models.modeNotReported": "Modo no informado",
 	"remote.hosts": "Equipos remotos",
```

#### Recent Merged Pull Requests:
- **PR #6293** (closed): Withdrawn (@adenarc)
- **PR #6291** (2026-10-06): fix: archive reviewers and preserve Chat on cancellation (@AgentWrapper)
- **PR #6290** (2026-10-05): fix: restore blue brand accent for links and context meter (@ronishrohan)
- **PR #6284** (2026-10-05): feat(shell): move brand into the titlebar row and reveal history arrows on hover (@ronishrohan)
- **PR #6279** (2026-10-05): feat(coder): AO Dev-kit workspace templates (medium + large) (@Pritom14)
- **PR #6276** (2026-10-05): feat: refresh app color scheme and pane spacing (@ronishrohan)
- **PR #6275** (2026-10-05): fix(updates): restore release-note links after repository rename (@somewherelostt)
- **PR #6272** (2026-10-05): fix: unify the effort picker and select a default effort (@ronishrohan)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
