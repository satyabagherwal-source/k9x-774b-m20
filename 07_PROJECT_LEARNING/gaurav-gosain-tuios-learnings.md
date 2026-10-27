> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/gaurav-gosain-tuios-learnings.md`  
> **Source**: github ([https://github.com/Gaurav-Gosain/tuios](https://github.com/Gaurav-Gosain/tuios))  
> **Source Version**: `c725ff16`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T10:54:11.023Z  
> **Learning ID**: `learn-github-gaurav-gosain-tuios`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): Gaurav-Gosain/tuios

> **Canonical Artifact**: `07_PROJECT_LEARNING/gaurav-gosain-tuios-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Gaurav-Gosain/tuios](https://github.com/Gaurav-Gosain/tuios))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T10:54:09.327Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Gaurav-Gosain/tuios`
- **Description**: A terminal window manager that knows what your agents are doing. Tiling panes, workspaces, sessions that survive restarts, and one Inbox for every coding agent. Official only at tuios.dev and this repo. tuios has no X/Twitter account.
- **Primary Language / Ecosystem**: Go
- **Discovered Manifests / Configurations**: go.mod, README.md, Dockerfile
- **Stars / Engagement**: 6122 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: go.mod, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cmd/tuios/agent_hook.go`
```
package main

import (
	"cmp"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/Gaurav-Gosain/tuios/internal/integration"
	"github.com/Gaurav-Gosain/tuios/internal/session"
	"github.com/spf13/cobra"
	"golang.org/x/term"
)

// agentHookDeadline bounds a whole hook run: reading the payload, finding the
// pane and reporting. Harnesses run some hooks synchronously, PreToolUse and
// PermissionRequest among them, so a hook that waits on a stuck or restarting
// daemon slows every tool call. Past the deadline the hook gives up and exits
// 0 having printed nothing, which a harness reads as "no opinion".
const agentHookDeadline = 500 * time.Millisecond

// agentHookMaxPayload caps what is read from stdin. A payload is a few
// kilobytes; the cap only guards against a harness piping something else.
const agentHookMaxPayload = 4 << 20

// agentHookHoldMax bounds the wait for an answer from the Inbox. The daemon
// ends every hold within 300 seconds; this only guards against a daemon that
// stops answering, and stays under the 310 second limit the Claude Code
// integration gives the hook, so the hook still exits on its own.
const agentHookHoldMax = 305 * time.Second

// timedCaller is a verbCaller whose call can wait longer than the default.
type timedCaller interface {
	CallWithTimeout(verb string, params any, timeout time.Duration) (json.RawMessage, error)
}

// verbCaller is the one method the hook needs from a verb client, so a test
// can stand in for the daemon.
type verbCaller interface {
	Call(verb string, params any) (json.RawMessage, error)
}

// agentHookOptions are the flags of tuios agent-hook.
type agentHookOptions struct {
	session string
	window  string
	explain bool
	timeout time.Duration
	// integration is the version marker a managed hook entry carries. It is
	// accepted so the command runs, and otherwise ignored.
	integration int
}

// agentHookIO is everything a hook run touches outside itself.
type agentHookIO struct {
	stdin    io.Reader
	stdinTTY bool
	stdout   io.Writer
	stderr   io.Writer
	getenv   func(string) string
	dial     func() (verbCaller, error)
	self     func() (sid int, ancestors []int)
	// harnessPID names the harness process among the ancestors self reports.
	harnessPID func(ancestors []int) int
	// holdMax bounds the wait for an answer from the Inbox. Zero means
	// agentHookHoldMax.
	holdMax time.Duration
	// stampDir is where agent-statusline keeps each pane's last values. A
	// turn end sends what it held back (flushStatusLine). Nil skips that.
	stampDir func() (string, error)
	now      func() time.Time
}

func newAgentHookCommand() *cobra.Command {
	var o agentHookOptions
	cmd := &cobra.Command{
		Use:   "agent-hook <harness> [event] [payload]",
		Short: "Report a harness hook event as the pane's agent state",
		Long: `Report a coding-agent harness's hook event to the tuios pane it runs in.

This is what the hooks tuios integration install writes run. The harness
hands its hook payload on stdin (or, for the Codex notify command, as the last
argument). The event comes from the payload, or from the event argument when
the payload does not name it. Supported harnesses: claude-code, codex,
copilot, cursor-agent, gemini-cli, opencode, amp, kilo, kimi, omp, pi and qwen,
which report the pane's state. antigravity, crush, devin, droid, grok,
hermes and qoder, which report only the conversation id (set-agent-session)
and leave the state to the pane's screen rules.

The pane is found from --window, then TUIOS_PANE_ID, then the process's
controlling terminal, then its parent processes, so a harness or sandbox
that scrubs the environment is still reported for. A payload that does not
parse, an event with no mapping, and an event from a harness other than the
one TUIOS_AGENT names are all reported as nothing, never as done. A
subagent's own tool calls never move the pane's state.

It asks the daemon which set-agent-state fields it supports and sends only
those. A conditional report (if_state) is not sent to a daemon older than the
condition, since that daemon would apply it unconditionally.

For claude-code and codex, a prompt, a tool call, its result and the end of a
turn also carry the event itself as activity (and gemini-cli's BeforeTool its
tool name), which the daemon keeps in the pane's activity ring for
'tuios agent-log' and the rail's "now" line. Only the first line of any text is
sent, with likely secrets masked. A Stop's done report says the first line of
what the agent said last.

Claude Code's SubagentStart and SubagentStop report no state. Each sends the
subagent with report-agent-activity, and the daemon keeps the pane's
subagents: the count of those started and not yet stopped in the subagents
metadata, and a list of each one's description, tool and end, which the rail
shows on a pane at rest. A subagent's own tool calls, the Agent tool's launch
and result, a TaskStop, and the background_tasks list of a Stop each send a
subagent_update for it. A SessionStart sends its idle report and then a
session_start, which clears them. A daemon without report-agent-activity
gets none of these, and one before subagent_update gets no updates.

A report that ends a turn (done or errored) also sends what the pane's status
line feed (tuios agent-statusline) held back, with set-agent-meta for the same
pane, so the turn's last context and cost reach the rail.

For claude-code and codex, a SessionStart prints four lines that these
harnesses add to the agent's context: the pane and the session the agent runs
in, the commands that reach the other agents and the person, the safety rule,
and "Run tuios --skill for everything else". Claude Code's SessionStart after a
compaction prints them too, and reports no state.

For the same two harnesses, SessionStart, UserPromptSubmit and PostToolUse
also add one line about the pane's unread mail, when there is mail the agent
was not told about: the count, the senders and the command that reads it. It
never holds a subject or a body. Each message is announced once. A
SessionStart announces all unread mail again, since the agent no longer holds
the earlier line. A hook that cannot write its output does not use up the
notice. PostToolUse prints the line as hookSpecificOutput JSON,
because these harnesses ignore its plain output. Outside tuios, and with
--window, the hook prints none of these lines.

It always exits 0, prints nothing a harness would read as an answer (Gemini
CLI gets an empty JSON object), and gives up after 500ms when the daemon is
slow or gone. Use --explain to see on stderr what it decided and why.

The one exception is a permission prompt the Inbox may answer. When
[agents.approvals] in the config names the harness (claude-code, opencode,
kilo or qwen), the hook for Claude Code's or Qwen Code's PermissionRequest, or
for opencode's permission.asked, waits after its report for the person to
answer the Inbox item, for up to hold_seconds (120 by default). A Claude Code plan
(ExitPlanMode) is held the same way unless hold_plans is false. It then prints
the harness's own decision. It prints nothing, and the harness asks in its pane as before,
when the wait ends without an answer, when approvals are off, when the daemon
is gone or restarts, and on any error. It never prints an approval it was not
given.`,
		Example: `  # What a Claude Code hook runs
  tuios agent-hook claude-code --integration 1

  # Try a payload by hand
  echo '{"hook_event_name":"Stop","session_id":"s1"}' | tuios agent-hook claude --explain`,
		Args: cobra.RangeArgs(1, 3),
		RunE: func(_ *cobra.Command, args []string) error {
			runAgentHook(o, args, agentHookIO{
				stdin:    os.Stdin,
				stdinTTY: term.IsTerminal(int(os.Stdin.Fd())),
				stdout:   os.Stdout,
				stderr:   os.Stderr,
				getenv:   os.Getenv,
				dial: func() (verbCaller, error) {
					// A failed dial returns a nil *VerbClient. Returning it as
					// it is would put a typed nil in the interface, which a
					// later io.Closer check takes for a live client.
					c, err := session.DialVerbClientAs(version)
					if err != nil {
						return nil, err
					}
					return c, nil
				},
				self:       integration.SelfProcess,
				harnessPID: integration.HarnessPID,
				stampDir:   statusLineStampDir,
				now:        time.Now,
			})
			return nil
		},
	}
	cmd.Flags().StringVarP(&o.session, "session", "s", "", "Session of the pane to report for (default: TUIOS_SESSION)")
	cmd.Flags().StringVarP(&o.window, "window", "w", "", "Pane to report for, by window id or name (default: TUIOS_PANE_ID, then the controlling terminal, then the parent processes)")
	cmd.Flags().BoolVar(&o.explain, "explain", false, "Print what was decided and why to stderr")
	cmd.Flags().DurationVar(&o.timeout, "timeout", agentHookDeadline, "Give up after this long")
	cmd.Flags().IntVar(&o.integration, "integration", 0, "Version marker of a managed hook entry. tuios ignores it")
	_ = cmd.Flags().MarkHidden("integration")
	return cmd
}

// agentHookOutcome is what --explain prints: the decision, the pane it went
// to and how that pane was found, and what the daemon said.
type agentHookOutcome struct {
	integration.Decision
	Session string `json:"session,omitempty"`
	Window  string `json:"window,omitempty"`
	PaneBy  string `json:"pane_by,omitempty"`
	// HarnessPID is the harness process the hook ran under, 0 when unknown.
	HarnessPID int `json:"harness_pid,omitempty"`
	// Unsupported lists the report's fields the daemon does not know, which
	// were left out of the call.
	Unsupported []string `json:"unsupported,omitempty"`
	Applied     *bool    `json:"applied,omitempty"`
	State       string   `json:"state,omitempty"`
	Reason      string   `json:"reason,omitempty"`
	// ActivityRecorded says whether the daemon kept the event's activity,
	// nil when none was sent.
	ActivityRecorded *bool `json:"activity_recorded,omitempty"`
	// TranscriptRefused is why the daemon did not join the pane to the
	// transcript the hook name
```

### Core Architecture Module: `cmd/tuios/hooks_commands.go`
```
package main

import (
	"encoding/json"
	"fmt"
	"strings"

	"charm.land/lipgloss/v2"
	"charm.land/lipgloss/v2/table"
	"github.com/Gaurav-Gosain/tuios/internal/plural"
)

// tuios list-hooks is the dock's debugging story, applied to the extension
// point that never had one.
//
// list-dock-components answers "why does my dock component print nothing"
// because it reports the exit code, the last run and the last error. A hook ran
// with its output discarded and its error dropped, so the same question about a
// hook had no answer at all. This prints the same three columns.

// hookRow is one row of the list-hooks result.
type hookRow struct {
	Event    string `json:"event"`
	Side     string `json:"side"`
	Command  string `json:"command"`
	Runs     int    `json:"runs"`
	LastExit int    `json:"last_exit"`
	LastRun  string `json:"last_run"`
	LastErr  string `json:"last_error"`
	LastMs   int64  `json:"last_ms"`
}

// runListHooks prints the hook table and what each command last did.
func runListHooks(sessionName, event string, jsonOutput bool) error {
	client, err := dialVerb()
	if err != nil {
		return err
	}
	defer func() { _ = client.Close() }()

	params := map[string]any{"session": sessionName}
	if event != "" {
		params["event"] = event
	}
	raw, err := client.Call("list-hooks", params)
	if err != nil {
		return reportVerbError(explainVerbError("list-hooks", err), jsonOutput)
	}
	if jsonOutput {
		return printVerbResult(raw, jsonOutput)
	}
	return printHookList(raw)
}

// printHookList renders the listing as a table.
func printHookList(raw json.RawMessage) error {
	var res struct {
		Hooks          []hookRow `json:"hooks"`
		Events         []string  `json:"events"`
		ClientAttached bool      `json:"client_attached"`
	}
	if err := json.Unmarshal(raw, &res); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}
	if len(res.Hooks) == 0 {
		fmt.Println("No hooks are registered. Add a [hooks] table to your config.")
		fmt.Printf("Events: %s\n", strings.Join(res.Events, ", "))
		return nil
	}

	rows := make([][]string, 0, len(res.Hooks))
	broken := 0
	for _, h := range res.Hooks {
		state := "waiting"
		switch {
		case h.LastErr != "":
			state, broken = "failed", broken+1
		case h.Runs > 0:
			state = "ran"
		}
		detail := h.LastRun
		if h.LastErr != "" {
			detail = fmt.Sprintf("exit %d: %s", h.LastExit, h.LastErr)
		}
		rows = append(rows, []string{
			h.Event, h.Side, trimCell(h.Command, 40), fmt.Sprint(h.Runs), state, trimCell(detail, 40),
		})
	}

	t := table.New().
		Border(lipgloss.RoundedBorder()).
		BorderStyle(lipgloss.NewStyle().Foreground(lipgloss.Color("8"))).
		Headers("EVENT", "SIDE", "COMMAND", "RUNS", "STATE", "LAST").
		Rows(rows...).
		StyleFunc(func(row, col int) lipgloss.Style {
			base := lipgloss.NewStyle().Padding(0, 1)
			if row == table.HeaderRow {
				return base.Bold(true).Foreground(lipgloss.Color("12"))
			}
			switch col {
			case 0:
				return base.Foreground(lipgloss.Color("3")).Bold(true)
			case 1, 2, 3:
				return base.Foreground(lipgloss.Color("8"))
			default:
				return base
			}
		})

	fmt.Println(t.Render())
	fmt.Printf("\n%s.\n", plural.Count(len(res.Hooks), "hook"))
	if broken > 0 {
		fmt.Printf("%d failed. The LAST column carries the exit code and the error.\n", broken)
	}
	if !res.ClientAttached {
		fmt.Println("No client is attached, so the client-side hooks are not listed. " +
			"Attach the session to see after-attach, after-detach, after-resize and after-layout-change.")
	}
	return nil
}

```

### Core Architecture Module: `cmd/tuios/queue_command.go`
```
package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"text/tabwriter"

	"github.com/spf13/cobra"
)

// newQueueCommand builds `tuios queue`: leave a message for an agent, typed
// as a prompt when it comes to rest, and list or drop what waits.
func newQueueCommand() *cobra.Command {
	var sessionName, window string
	var jsonOutput bool
	cmd := &cobra.Command{
		Use:   "queue [flags] TEXT...",
		Short: "Queue a message for an agent, typed when it comes to rest",
		Long: `Queue a message for the agent in a pane. It is typed as a prompt once the
agent has been at rest for a second, one message per rest, and never over a
prompt the agent is waiting on. If the agent is at rest now it is typed right
away.

The daemon watches for the agent to take it. A message the agent shows no sign
of taking is marked stalled, is never typed again, and opens a question in the
Inbox: look at the pane. A stalled message holds the ones behind it until the
agent next works or you drop it with 'tuios queue rm', and the next is then
typed at the next rest.

For an agent that cannot show it is working (Aider, Crush, or a pane with no
harness), a rest after a typed message is also new output followed by 5
seconds of silence.

A pane holds at most [agents.queue] max messages (8 by default), of at most
16 KiB each. The queue is kept in the daemon's memory: it is dropped when the
daemon restarts, when the pane closes, and when the agent leaves the pane.

From inside a pane, the message is checked like send-text: the target must
hold no grant this pane does not, and is checked against this pane's grants
again when it is typed. The words are joined with spaces. To queue text that
reads ls or rm, put -- before it.`,
		Example: `  # Reply to the agent in the build pane once it finishes its turn
  tuios queue -w build 'make the backoff jitter configurable'

  # What waits, in this session or for one pane
  tuios queue ls
  tuios queue ls -w build

  # Drop one message, or everything queued for a pane
  tuios queue rm q3
  tuios queue rm --all -w build`,
		Args: cobra.MinimumNArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			return runQueuePrompt(sessionName, window, strings.Join(args, " "), jsonOutput)
		},
	}
	cmd.Flags().StringVarP(&sessionName, "session", "s", "", "Session of the pane (default: this pane's, else the most recently active)")
	cmd.Flags().StringVarP(&window, "window", "w", "", "The agent's pane, by name or id (default: the focused pane)")
	cmd.Flags().BoolVar(&jsonOutput, "json", false, "Output result as JSON")
	_ = cmd.RegisterFlagCompletionFunc("session", completeSessionNames)
	cmd.AddCommand(newQueueListCommand(), newQueueRemoveCommand())
	return cmd
}

// newQueueListCommand builds `tuios queue ls`.
func newQueueListCommand() *cobra.Command {
	var sessionName, window string
	var jsonOutput bool
	cmd := &cobra.Command{
		Use:   "ls",
		Short: "List the messages waiting for agents",
		Long: `List the messages waiting to be typed to agents: every pane of the session, or
one pane with -w. Each line has the entry's id, its state (waiting,
delivering, or stalled), who queued it (human, shell, a pane's id, or
link:HOST), its age, the pane, and the first line of the message.`,
		Args: cobra.NoArgs,
		RunE: func(_ *cobra.Command, _ []string) error {
			return runQueueList(os.Stdout, sessionName, window, jsonOutput)
		},
	}
	cmd.Flags().StringVarP(&sessionName, "session", "s", "", "Session to list (default: this pane's, else the most recently active)")
	cmd.Flags().StringVarP(&window, "window", "w", "", "Only this pane, by name or id")
	cmd.Flags().BoolVar(&jsonOutput, "json", false, "Output result as JSON")
	_ = cmd.RegisterFlagCompletionFunc("session", completeSessionNames)
	return cmd
}

// newQueueRemoveCommand builds `tuios queue rm`.
func newQueueRemoveCommand() *cobra.Command {
	var sessionName, window string
	var all, jsonOutput bool
	cmd := &cobra.Command{
		Use:   "rm [ID | --all]",
		Short: "Drop queued messages before they are typed",
		Long: `Drop a queued message by its id, or with --all every message queued for a pane
(-w, default the focused pane). A message being typed cannot be dropped.

From inside a pane only the messages that pane queued can be dropped. From a
shell outside every pane, every message but the ones you queued from the
Inbox, which only the attached client can drop.`,
		Args: cobra.MaximumNArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			switch {
			case all && len(args) > 0:
				return errors.New("pass an id or --all, not both")
			case !all && len(args) == 0:
				return errors.New("name the message to drop by its id (see tuios queue ls), or pass --all")
			}
			id := ""
			if len(args) > 0 {
				id = args[0]
			}
			return runQueueRemove(sessionName, window, id, all, jsonOutput)
		},
	}
	cmd.Flags().StringVarP(&sessionName, "session", "s", "", "Session of the pane (default: this pane's, else the most recently active)")
	cmd.Flags().StringVarP(&window, "window", "w", "", "The pane, by name or id")
	cmd.Flags().BoolVar(&all, "all", false, "Drop every message queued for the pane that you may drop")
	cmd.Flags().BoolVar(&jsonOutput, "json", false, "Output result as JSON")
	_ = cmd.RegisterFlagCompletionFunc("session", completeSessionNames)
	return cmd
}

func runQueuePrompt(sessionName, window, text string, jsonOutput bool) error {
	t, err := dialTarget(sessionName, window)
	if err != nil {
		return err
	}
	defer t.Close()
	params := t.params(map[string]any{"text": text})
	if t.window != "" {
		params["window"] = t.window
	}
	raw, err := t.client.Call("queue-prompt", params)
	if err != nil {
		return reportVerbError(t.explain("queue-prompt", err), jsonOutput)
	}
	if jsonOutput {
		return printVerbResultOn(t, raw, true)
	}
	var res struct {
		ID         string `json:"id"`
		Position   int    `json:"position"`
		Queued     int    `json:"queued"`
		Delivering bool   `json:"delivering"`
	}
	if err := json.Unmarshal(raw, &res); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}
	fmt.Println(describeQueued(res.ID, window, res.Position, res.Delivering) + t.on())
	return nil
}

// describeQueued is the line queue prints.
func describeQueued(id, window string, position int, delivering bool) string {
	target := "the focused pane"
	if window != "" {
		target = plainLine(window)
	}
	switch {
	case delivering:
		return fmt.Sprintf("Queued %s for %s. The agent is at rest, so it is typed now.", plainLine(id), target)
	case position <= 1:
		return fmt.Sprintf("Queued %s for %s. It is typed when the agent comes to rest.", plainLine(id), target)
	default:
		return fmt.Sprintf("Queued %s for %s, number %d in line. Each is typed at the agent's next rest.", plainLine(id), target, position)
	}
}

// queueRow is one entry of list-queued.
type queueRow struct {
	ID      string `json:"id"`
	Window  string `json:"window"`
	Name    string `json:"name"`
	At      int64  `json:"at"`
	By      string `json:"by"`
	From    string `json:"from"`
	Preview string `json:"preview"`
	State   string `json:"state"`
}

func runQueueList(w io.Writer, sessionName, window string, jsonOutput bool) error {
	t, err := dialTarget(sessionName, window)
	if err != nil {
		return err
	}
	defer t.Close()
	params := t.params(nil)
	if t.window != "" {
		params["window"] = t.window
	}
	raw, err := t.client.Call("list-queued", params)
	if err != nil {
		return reportVerbError(t.explain("list-queued", err), jsonOutput)
	}
	if jsonOutput {
		return printVerbResultOn(t, raw, true)
	}
	var res struct {
		Session string     `json:"session"`
		Entries []queueRow `json:"entries"`
	}
	if err := json.Unmarshal(raw, &res); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}
	return printQueueRows(w, res.Session+t.on(), res.Entries)
}

// printQueueRows writes list-queued's entries as a table. Every field but the
// id and state came from a caller, so each is kept to one plain line.
func printQueueRows(w io.Writer, where string, rows []queueRow) error {
	if len(rows) == 0 {
		_, err := fmt.Fprintf(w, "Nothing is queued in session %s.\n", plainLine(where))
		return err
	}
	tw := tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)
	fmt.Fprintln(tw, "ID\tSTATE\tBY\tAGE\tPANE\tMESSAGE")
	for _, r := range rows {
		by := r.By
		if len(by) > 12 && !strings.HasPrefix(by, "link:") {
			by = shortWindowID(by)
		}
		pane := r.Name
		if pane == "" {
			pane = shortWindowID(r.Window)
		}
		fmt.Fprintf(tw, "%s\t%s\t%s\t%s\t%s\t%s\n", plainLine(r.ID), plainLine(r.State), plainLine(by), agoOf(r.At), plainLine(pane), plainLine(r.Preview))
	}
	return tw.Flush()
}

func runQueueRemove(sessionName, window, id string, all, jsonOutput bool) error {
	t, err := dialTarget(sessionName, window)
	if err != nil {
		return err
	}
	defer t.Close()
	params := t.params(nil)
	if t.window != "" {
		params["window"] = t.window
	}
	if all {
		params["all"] = true
	} else {
		params["id"] = id
	}
	raw, err := t.client.Call("cancel-queued", params)
	if err != nil {
		return reportVerbError(t.explain("cancel-queued", err), jsonOutput)
	}
	if jsonOutput {
		return printVerbResultOn(t, raw, true)
	}
	var res struct {
		Cancelled []string `json:"cancelled"`
		Queued    int      `json:"queued"`
	}
	if err := json.Unmarshal(raw, &res); err != nil {
		return fmt.Errorf("failed to parse response: %w", err)
	}
	switch len(res.Cancelled) {
	case 0:
		fmt.Printf("Nothing was dropped%s. %d still queued.\n", t.on(), res.Queued)
	case 1:
		fmt.Printf("Dropped %s%s. %d still queued.\n", plainLine(res.Cancelled[0]), t.on(), res.Queued)
	default:
		fmt.Printf("Dropped %d messages%s. %d still queued.\n", len(res.Cancelled), t.on(), res.Queued)
	}
	return nil
}

```

### Core Architecture Module: `cmd/tuios/restart_worker.go`
```
package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/Gaurav-Gosain/tuios/internal/restartplan"
	"github.com/Gaurav-Gosain/tuios/internal/session"
)

// The stop and the start of a restart run in a process of their own.
//
// tuios restart-server is often run from a pane of the daemon it restarts:
// by a person, or by an agent. The stop closes that pane's terminal, and the
// kernel sends SIGHUP to everything on it, the command included. A command
// that did the steps itself died there, between the stop and the start, and
// left no daemon at all.
//
// So the command hands the steps to a worker: the same binary, in a session
// of its own (Setsid), with SIGHUP ignored and its output in the restart log
// rather than on the terminal. The command reads the log and shows the steps
// as they come. If the command dies, the worker goes on, and the log keeps
// what happened for `tuios restart-server --last`.
//
// The worker takes the restart lock, so a second restart that starts while
// one runs refuses rather than stopping the daemon the first one is starting.

// runDetachedRestart starts the worker for plan, shows each step through step,
// and returns the result the worker wrote.
func runDetachedRestart(plan *restartReport, step func(string)) *restartReport {
	fail := func(what, fix string) *restartReport {
		return &restartReport{Step: restartplan.StepDone, Binary: plan.Binary, Version: plan.Version, Error: what, Fix: fix}
	}
	// A restart that runs owns the log. Checked before the log is cut, so a
	// second restart cannot wipe the first one's steps.
	lock, err := session.LockRestart()
	if errors.Is(err, session.ErrRestartRunning) {
		return fail("Another restart of the daemon is running.", "wait for it to end. 'tuios restart-server --last' shows its steps.")
	}
	if lock != nil {
		_ = lock.Close()
	}

	logPath := session.RestartLogPath()
	_ = os.MkdirAll(filepath.Dir(logPath), 0o700)
	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		return fail("The restart log could not be written: "+err.Error()+".", "check that "+filepath.Dir(logPath)+" can be written.")
	}
	writeRestartJSON(logFile, plan)
	data, _ := json.Marshal(plan)
	cmd := exec.Command(workerExecutable(), "restart-server", "--worker", string(data))
	cmd.Stdin = nil
	cmd.Stdout, cmd.Stderr = logFile, logFile
	cmd.SysProcAttr = daemonSysProcAttr()
	err = cmd.Start()
	_ = logFile.Close()
	if err != nil {
		return fail("The restart could not start: "+err.Error()+".", "run 'tuios kill-server', then 'tuios start-server'.")
	}
	exited := make(chan struct{})
	go func() { _ = cmd.Wait(); close(exited) }()
	return followRestartLog(logPath, exited, step, fail)
}

// workerExecutable is the binary the worker runs: this one. The worker is
// this build's own code, so it is this file even after an update replaced
// the path it started from.
func workerExecutable() string {
	if runtime.GOOS == "linux" {
		return "/proc/self/exe"
	}
	exe, err := os.Executable()
	if err != nil {
		return os.Args[0]
	}
	return exe
}

// followRestartLog reads the worker's lines as they come, until the result.
func followRestartLog(path string, exited <-chan struct{}, step func(string), fail func(what, fix string) *restartReport) *restartReport {
	f, err := os.Open(path)
	if err != nil {
		return fail("The restart log could not be read: "+err.Error()+".", "run 'tuios restart-server --last' to see the steps.")
	}
	defer func() { _ = f.Close() }()
	r := bufio.NewReader(f)
	var partial string
	gone := false
	for {
		line, err := r.ReadString('\n')
		partial += line
		if err == nil {
			var rep restartReport
			if json.Unmarshal([]byte(partial), &rep) == nil {
				switch rep.Step {
				case restartplan.StepStopping, restartplan.StepStarting:
					step(rep.Step)
				case restartplan.StepDone:
					return &rep
				}
			}
			partial = ""
			continue
		}
		if gone {
			return fail("The restart stopped before it finished.", "run 'tuios restart-server --last' to see its steps, and 'tuios ls' to check the daemon.")
		}
		select {
		case <-exited:
			// One more pass reads what the worker wrote before it exited.
			gone = true
		case <-time.After(50 * time.Millisecond):
		}
	}
}

// runRestartWorker is the detached worker: it takes the lock and runs the
// steps of the plan, writing each one to its output, the restart log.
func runRestartWorker(planJSON string) error {
	signal.Ignore(syscall.SIGHUP)
	var plan restartReport
	if err := json.Unmarshal([]byte(planJSON), &plan); err != nil {
		return err
	}
	out := os.Stdout
	lock, err := session.LockRestart()
	if err != nil {
		writeRestartJSON(out, &restartReport{Step: restartplan.StepDone, Error: "Another restart of the daemon is running.",
			Fix: "wait for it to end. 'tuios restart-server --last' shows its steps."})
		return nil
	}
	defer func() { _ = lock.Close() }()
	done := runRestart(&plan, func(step string) {
		writeRestartJSON(out, &restartReport{Step: step})
	})
	writeRestartJSON(out, done)
	return nil
}

// showLastRestart writes the restart log as the command would have.
func showLastRestart(w io.Writer) error {
	path := session.RestartLogPath()
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		fmt.Fprintln(w, "No restart has run yet.")
		return nil
	}
	if err != nil {
		return err
	}
	if fi, err := os.Stat(path); err == nil {
		fmt.Fprintf(w, "Last restart: %s\n\n", fi.ModTime().Format("2006-01-02 15:04:05"))
	}
	var plan *restartReport
	for line := range strings.SplitSeq(string(data), "\n") {
		var rep restartReport
		if json.Unmarshal([]byte(line), &rep) != nil {
			if line = strings.TrimSpace(line); line != "" {
				fmt.Fprintln(w, line)
			}
			continue
		}
		switch rep.Step {
		case restartplan.StepPlan:
			plan = &rep
			fmt.Fprint(w, restartplan.Text(restartplan.Lines(&rep, "")))
		case restartplan.StepStopping:
			fmt.Fprintln(w, "Stopping the daemon...")
		case restartplan.StepStarting:
			v := ""
			if plan != nil {
				v = plan.Version + " "
			}
			fmt.Fprintf(w, "Starting the daemon %s...\n", strings.TrimSpace(v))
		case restartplan.StepDone:
			if rep.Error != "" {
				fmt.Fprintln(w, rep.Error)
				if rep.Fix != "" {
					fmt.Fprintln(w, "Fix: "+rep.Fix)
				}
				continue
			}
			writeRestartDone(w, &rep)
		}
	}
	return nil
}

```

### Core Architecture Module: `cmd/tuios/tml_render.go`
```
package main

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/charmbracelet/x/ansi"
	"github.com/spf13/cobra"
	"golang.org/x/term"
	"tuios.dev/tml"

	"github.com/Gaurav-Gosain/tuios/internal/theme"
	"github.com/Gaurav-Gosain/tuios/internal/tmldraw"
)

// tmlRenderOptions is the `tuios tml render` command line.
type tmlRenderOptions struct {
	width  int
	height int
	state  string
	tab    string
	styled bool
	ascii  bool
	popup  bool
}

// tmlRenderDefaultWidth is the width tml render draws at when standard
// output is not a terminal.
const tmlRenderDefaultWidth = 100

// tmlRenderTallest bounds the height tml render draws a document at when no
// height is given: the document then gets the rows it takes, up to this.
const tmlRenderTallest = 400

func newTMLRenderCommand() *cobra.Command {
	var o tmlRenderOptions
	cmd := &cobra.Command{
		Use:   "render FILE",
		Short: "Print a TML document drawn as text",
		Long: `Print a TML document drawn as text, as tuios draws it in a pane. It opens
nothing and needs no daemon.

FILE is a TML text or TML JSON file, or - for standard input. tuios checks the
document first. When the document has errors, the command prints each problem
with the fix and exits with status 1.

The width is the terminal's width, or 100 when standard output is not a
terminal. Without --height, the document gets the rows it takes. The text has
the margin a pane keeps around a surface.

Read the output before you show a document, and after each change. Look for
cut text, empty charts and boxes that do not line up.`,
		Example: `  # Check how a dashboard looks before you show it
  tuios tml render dash.tml

  # Draw it at the size of a small pane, on its second tab
  tuios tml render dash.tml --width 60 --height 20 --tab log

  # Draw it with other values in its state
  tuios tml render dash.tml --state '{"runs":12}'`,
		Args: cobra.ExactArgs(1),
		RunE: func(_ *cobra.Command, args []string) error {
			return runTMLRender(args[0], o, os.Stdin, os.Stdout, os.Stderr)
		},
	}
	cmd.Flags().IntVar(&o.width, "width", 0, "Width in cells (default: the terminal's width, else 100)")
	cmd.Flags().IntVar(&o.height, "height", 0, "Height in cells (default: the rows the document takes)")
	cmd.Flags().StringVar(&o.state, "state", "", "A JSON object to use as the document's state")
	cmd.Flags().StringVar(&o.tab, "tab", "", "Open the tab with this id")
	cmd.Flags().BoolVarP(&o.styled, "ansi", "e", false, "Keep the colours and styles as ANSI escape codes, as capture-pane --ansi does")
	cmd.Flags().BoolVar(&o.ascii, "ascii", false, "Draw with ASCII characters only")
	cmd.Flags().BoolVar(&o.popup, "popup", false, "Draw it as a popup: view.placement reads popup")
	return cmd
}

func runTMLRender(name string, o tmlRenderOptions, stdin io.Reader, stdout, stderr io.Writer) error {
	src, err := readTMLSource(name, stdin)
	if err != nil {
		return err
	}
	if err := checkTMLSource(name, src, stderr); err != nil {
		return &statusError{code: 1}
	}
	lim := tml.PersonLimits()
	doc, err := tml.Parse(src, &tml.ParseOptions{Limits: &lim})
	if err != nil {
		return fmt.Errorf("%s: %w", name, err)
	}
	draw := tmldraw.Options{
		Width:     o.width,
		Height:    o.height,
		Inset:     true,
		Placement: "pane",
		Tab:       o.tab,
		Styled:    o.styled,
		Palette:   tmldraw.Palette(theme.UI(), o.ascii),
	}
	if o.popup {
		draw.Placement = "popup"
	}
	if o.state != "" {
		var probe map[string]any
		if err := json.Unmarshal([]byte(o.state), &probe); err != nil || probe == nil {
			return fmt.Errorf("--state is not a JSON object: %s", strings.TrimSpace(o.state))
		}
		draw.State = json.RawMessage(o.state)
	}
	if draw.Width <= 0 {
		draw.Width = tmlRenderDefaultWidth
		if f, ok := stdout.(*os.File); ok && term.IsTerminal(int(f.Fd())) {
			if w, _, err := term.GetSize(int(f.Fd())); err == nil && w > 0 {
				draw.Width = w
			}
		}
	}
	natural := draw.Height <= 0
	if natural {
		draw.Height = tmlRenderTallest
	}
	out, err := tmldraw.Draw(doc, draw)
	if err != nil {
		return fmt.Errorf("%s: %w", name, err)
	}
	if natural {
		out = trimBlankTail(out)
	}
	fmt.Fprintln(stdout, out)
	return nil
}

// trimBlankTail drops the blank lines at the end of out but one, which is
// the margin under the document.
func trimBlankTail(out string) string {
	lines := strings.Split(out, "\n")
	end := len(lines)
	for end > 0 && strings.TrimSpace(ansi.Strip(lines[end-1])) == "" {
		end--
	}
	if end < len(lines) {
		end++
	}
	return strings.Join(lines[:end], "\n")
}

```

### Core Architecture Module: `e2e/tui/frameloop/main.go`
```
//go:build unix

// Command frameloop stands in for a graphics app that fills its pane, in the
// way that matters to the passthrough: it asks the kernel how big its terminal
// is in pixels, renders a bitmap of exactly that size, and streams it through
// shared memory at a steady rate, reusing one image id.
//
// Guessing the pixel size instead is what makes a harness test something other
// than the reported scenario. A real app renders to the size it was given, so
// the image's pixels-per-cell agrees with the host's by construction, and any
// disagreement seen downstream is tuios's own.
package main

import (
	"encoding/base64"
	"fmt"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"
	"unsafe"
)

type winsize struct {
	rows, cols, xpixel, ypixel uint16
}

func size() (cols, rows, xpx, ypx int, err error) {
	var ws winsize
	_, _, errno := syscall.Syscall(syscall.SYS_IOCTL, os.Stdout.Fd(),
		syscall.TIOCGWINSZ, uintptr(unsafe.Pointer(&ws)))
	if errno != 0 {
		return 0, 0, 0, 0, errno
	}
	return int(ws.cols), int(ws.rows), int(ws.xpixel), int(ws.ypixel), nil
}

func main() {
	// The geometry is reported through a file rather than the screen: the app
	// takes the alt screen immediately afterwards, so anything printed is gone
	// before a poll of the grid can see it.
	var geomFile string
	if len(os.Args) > 1 {
		geomFile = os.Args[1]
	}
	fps := 20
	if len(os.Args) > 2 {
		if n, err := strconv.Atoi(os.Args[2]); err == nil && n > 0 {
			fps = n
		}
	}
	// repaint is how long the app takes to re-render after being resized. A
	// browser is not instant: it keeps painting the frame it already has, at
	// the old pixel size, while it relays out. That interval is the one where
	// the terminal has been told one size and the bitmap is still the other.
	var repaint time.Duration
	if len(os.Args) > 3 {
		if ms, err := strconv.Atoi(os.Args[3]); err == nil && ms > 0 {
			repaint = time.Duration(ms) * time.Millisecond
		}
	}
	// transport is "shm" (t=s, the default), "b64" (t=d, the payload inline
	// in chunked escapes) or "mpv" (the way mpv's --vo=kitty sends a frame: a
	// cursor move, then f=24 with no image id, inline in chunked escapes). The bitmap and the geometry are identical either
	// way, so anything that differs downstream is the transport's own.
	transport := "shm"
	if len(os.Args) > 4 && os.Args[4] != "" {
		transport = os.Args[4]
	}
	// countFile, when given, holds how many frames the app has written so far,
	// so a test can see whether the terminal held the app back. Each count is
	// written after the frame's write returned.
	var countFile string
	if len(os.Args) > 5 {
		countFile = os.Args[5]
	}
	written := 0
	wrote := func() {
		written++
		if countFile != "" {
			// Write a temporary file and rename it over the count. A plain
			// WriteFile truncates first, so a reader could find the file
			// empty, and a reader that gave up then counted 0 frames.
			tmp := countFile + ".tmp"
			if os.WriteFile(tmp, []byte(strconv.Itoa(written)), 0o644) == nil {
				_ = os.Rename(tmp, countFile)
			}
		}
	}

	// One shared memory object per size, and the object is never resized once
	// advertised: a terminal maps what it is handed, and truncating it under
	// the map is a bus error in the reader rather than a torn frame. Its
	// contents are another matter, and are rewritten in place for every frame.
	//
	// A buffer that is filled once and then advertised over and over is not a
	// stream, it is one picture announced repeatedly, and a passthrough is
	// entitled to notice that the host is already showing it. Standing in for a
	// video player means painting something different each time, the way the
	// direct transport's stand-in already did.
	var made []string
	var shmFile *os.File
	defer func() {
		if shmFile != nil {
			_ = shmFile.Close()
		}
		for _, n := range made {
			_ = os.Remove("/dev/shm/" + n)
		}
	}()
	gen := 0
	var encoded string
	var pix []byte
	var pixW, pixH int
	allocate := func(w, h int) error {
		gen++
		pix = make([]byte, w*h*4)
		for i := range pix {
			pix[i] = byte((i + gen*37) * 7)
		}
		pixW, pixH = w, h
		if transport == "b64" || transport == "mpv" || transport == "text" {
			return nil
		}
		// The harness names the objects with a prefix of its own, so it can
		// remove them after a test even when this process dies by a signal and
		// the deferred removal never runs.
		prefix := os.Getenv("TUIOS_E2E_SHM_PREFIX")
		if prefix == "" {
			prefix = "tuios-frameloop-"
		}
		name := fmt.Sprintf("%s%d-%d", prefix, os.Getpid(), gen)
		path := "/dev/shm/" + name
		if err := os.WriteFile(path, pix, 0o600); err != nil {
			return err
		}
		if shmFile != nil {
			_ = shmFile.Close()
		}
		// Kept open and written through at offset zero from here on, so the
		// object is never truncated under a terminal that has it mapped.
		f, err := os.OpenFile(path, os.O_WRONLY, 0o600)
		if err != nil {
			return err
		}
		shmFile = f
		made = append(made, name)
		encoded = base64.StdEncoding.EncodeToString([]byte(name))
		return nil
	}

	// Report the geometry before taking the screen, so the harness can read it
	// off the grid and know what the guest was actually told.
	cols, rows, xpx, ypx, err := size()
	if err != nil {
		fmt.Printf("FRAMELOOP-ERR %v\n", err)
		return
	}
	// Appended, not overwritten: the harness wants every size this app was ever
	// given, because the question it asks of tuios is whether the host was ever
	// told a rectangle the guest was not.
	report := func(c, r, x, y int) {
		if geomFile == "" {
			return
		}
		f, err := os.OpenFile(geomFile, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
		if err != nil {
			return
		}
		defer func() { _ = f.Close() }()
		_, _ = fmt.Fprintf(f, "%d %d %d %d\n", c, r, x, y)
	}
	if xpx == 0 || ypx == 0 {
		fmt.Printf("FRAMELOOP-ERR no pixel size\n")
		return
	}
	report(cols, rows, xpx, ypx)

	resized := make(chan os.Signal, 1)
	signal.Notify(resized, syscall.SIGWINCH)

	if err := allocate(xpx, ypx); err != nil {
		fmt.Printf("FRAMELOOP-ERR %v\n", err)
		return
	}

	_, _ = os.Stdout.WriteString("\x1b[?1049h")
	defer func() { _, _ = os.Stdout.WriteString("\x1b[?1049l") }()

	seq := 0
	if transport == "text" {
		// A text flood of the same shape: a full screen of text a frame, as
		// fast as the terminal takes it, and no graphics at all.
		for {
			seq++
			_, _ = os.Stdout.Write(buildTextFrame(seq, cols, rows))
			wrote()
		}
	}
	tick := time.NewTicker(time.Second / time.Duration(fps))
	defer tick.Stop()
	// relayout fires when the app has finished re-rendering at a new size. It
	// is armed by a resize and never blocks the frame loop, so the old frame
	// keeps going out in the meantime, which is the whole point.
	relayout := time.NewTimer(time.Hour)
	defer relayout.Stop()
	if !relayout.Stop() {
		<-relayout.C
	}
	for {
		select {
		case <-resized:
			if repaint == 0 {
				relayout.Reset(0)
				continue
			}
			relayout.Reset(repaint)
		case <-relayout.C:
			if c, r, x, y, err := size(); err == nil && x > 0 && y > 0 {
				cols, rows, xpx, ypx = c, r, x, y
				if err := allocate(xpx, ypx); err != nil {
					return
				}
				report(cols, rows, xpx, ypx)
			}
		case <-tick.C:
			// Every frame differs, the way an animating guest's does, so no
			// frame is the picture already on screen.
			seq++
			for i := 0; i < len(pix); i += 4099 {
				pix[i] = byte(seq)
			}
			if transport == "b64" {
				_, _ = os.Stdout.Write(buildB64Frame(pix, pixW, pixH))
				wrote()
				continue
			}
			if transport == "mpv" {
				_, _ = os.Stdout.Write(buildMpvFrame(pix, pixW, pixH))
				wrote()
				continue
			}
			if shmFile != nil {
				if _, err := shmFile.WriteAt(pix, 0); err != nil {
					return
				}
			}
			fmt.Printf("\x1b[H\x1b_Ga=T,f=32,t=s,s=%d,v=%d,i=1,q=2,C=1;%s\x1b\\",
				xpx, ypx, encoded)
			wrote()
		}
	}
}

// buildB64Frame is the same frame the shared-memory path advertises, sent as a
// direct transmission instead: one a=T carrying the control keys and the first
// 4096 bytes of base64, then continuation chunks that carry only m=. This is
// the chunking real direct-transport clients use (kitten icat, chafa, wlterm).
func buildB64Frame(pix []byte, w, h int) []byte {
	enc := base64.StdEncoding.EncodeToString(pix)
	b := []byte("\x1b[H")
	first := true
	for len(enc) > 0 {
		chunk := enc
		if len(chunk) > 4096 {
			chunk = chunk[:4096]
		}
		enc = enc[len(chunk):]
		m := 0
		if len(enc) > 0 {
			m = 1
		}
		if first {
			b = append(b, fmt.Sprintf(
				"\x1b_Ga=T,f=32,t=d,s=%d,v=%d,i=1,q=2,C=1,m=%d;", w, h, m)...)
			first = false
		} else {
			b = append(b, fmt.Sprintf("\x1b_Gm=%d;", m)...)
		}
		b = append(b, chunk...)
		b = append(b, "\x1b\\"...)
	}
	return b
}

// buildTextFrame is one screen of coloured text that changes every frame.
func buildTextFrame(seq, cols, rows int) []byte {
	b := []byte("\x1b[H")
	for r := 0; r < rows-1; r++ {
		b = append(b, fmt.Sprintf("\x1b[3%dm", (seq+r)%8)...)
		for c := 0; c < cols-1; c++ {
			b = append(b, byte('a'+(seq+r+c)%26))
		}
		b = append(b, "\x1b[0m\r\n"...)
	}
	return b
}

// buildMpvFrame is the frame as mpv's --vo=kitty sends it: RGB with no alpha
// (f=24), no image id, the cursor left in place (C=1), in 4096-byte chunks
// behind a cursor move. With no id, every frame is a new image.
func buildMpvFrame(pix []byte, w, h int) []byte {
	rgb := make([]byte, 0, w*h*3)
	for i := 0; i+3 < len(pix); i += 4 {
		rgb = append(rgb, pix[i], pix[i+1], pix[i+2])
	}
	enc := base64.StdEncoding.EncodeToString(rgb)
	b := []byte("\x1b[1;1f") // mpv moves the cursor with CSI f
	first := true
	for len(enc) > 0 {
		chunk := enc[:min(len(enc), 4096)]
		enc = enc[len(chunk):]
		m := 0
		if len(enc) > 0 {
			m = 1
		}
		if first {
			b = append(b, fmt.Sprintf("\x1b_Ga=T,f=24,s=%d,v=%d,C=1,q=2,m=%d;", w, h, m)...)
			first = false
		} else {
			b = append(b, fmt.Sprintf("\x1b_Gm=%d;", m)...)
		}
		b = append(b, chunk...)
		b = append(b, "\x1b\\"...)
	}
	return b
}

```

### Core Architecture Module: `internal/agentproto/render.go`
```
package agentproto

import (
	"fmt"
	"maps"
	"slices"
	"strings"
	"unicode/utf8"

	"github.com/Gaurav-Gosain/tuios/internal/integration"
	"github.com/Gaurav-Gosain/tuios/internal/invisible"
)

// The transcript: what the pane shows of the conversation.
//
// Everything the agent sends is text the model or the agent chose, and the pane
// is a terminal, so every string is cleaned before it is written: no escape
// sequence and no control character other than a line break and a tab reaches
// the pane. Without that an agent could print an OSC sequence the daemon reads
// as the pane's agent state, a notification, a title or a clipboard write, all
// of it unseen, in its reply.
//
// Colour is never the only signal: a tool call's state is a word, a diff line
// keeps its + or -, and a plan step its [x], [>] or [ ].

// SGR sequences the transcript uses.
const (
	sgrReset  = "\x1b[0m"
	sgrBold   = "\x1b[1m"
	sgrDim    = "\x1b[2m"
	sgrRed    = "\x1b[31m"
	sgrGreen  = "\x1b[32m"
	sgrYellow = "\x1b[33m"
	sgrCyan   = "\x1b[36m"
)

// Bounds on what one event may put on screen.
const (
	maxDiffLines   = 200
	maxToolText    = 5
	maxLineDiffOps = 4_000_000
)

// clean removes every escape sequence and control character from s except the
// line break and the tab, and replaces invalid UTF-8. A carriage return is
// dropped, so a CRLF is a line break and a bare CR cannot move the cursor back
// over what was written. Invisible characters go too (invisible.Strip).
func clean(s string) string {
	if !strings.ContainsFunc(s, isUnsafe) && utf8.ValidString(s) {
		return s
	}
	s = invisible.Strip(s)
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range strings.ToValidUTF8(s, string(utf8.RuneError)) {
		// invisible.Strip has removed every invisible character it does
		// not keep on purpose (a zero-width joiner between two emoji).
		if isControl(r) {
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}

// isUnsafe is a rune clean drops: C0 controls but tab and line feed, DEL, the
// C1 controls, and the invisible characters (invisible.Rune) that make a line
// read as something other than what it holds.
func isUnsafe(r rune) bool {
	return isControl(r) || invisible.Rune(r)
}

// isControl is a C0 control but tab and line feed, DEL, or a C1 control.
func isControl(r rune) bool {
	switch {
	case r == '\n' || r == '\t':
		return false
	case r < 0x20 || r == 0x7f:
		return true
	case r >= 0x80 && r < 0xa0:
		return true
	}
	return false
}

// oneLine is clean, with line breaks and tabs turned into spaces and runs of
// space collapsed.
func oneLine(s string) string {
	return strings.Join(strings.Fields(clean(s)), " ")
}

// renderer turns events into transcript text. It holds what it has already
// shown, so a tool call is shown when it starts and when it ends, not on every
// update, and a plan only when it changes.
type renderer struct {
	// midLine is true when the last text written did not end a line.
	midLine bool
	// thought is true while reasoning is streaming, so the switch to the reply
	// starts a new line.
	thought bool
	tools   map[string]toolShown
	plan    string
}

// toolShown is what was last shown of a tool call.
type toolShown struct {
	status string
	diffs  string
}

func newRenderer() *renderer {
	return &renderer{tools: make(map[string]toolShown)}
}

// lineStart ends a line left open, so what follows starts on its own.
func (r *renderer) lineStart(b *strings.Builder) {
	if r.midLine {
		b.WriteString("\n")
		r.midLine = false
	}
}

// block writes whole lines.
func (r *renderer) block(b *strings.Builder, s string) {
	r.lineStart(b)
	r.thought = false
	b.WriteString(s)
	if !strings.HasSuffix(s, "\n") {
		b.WriteString("\n")
	}
}

// text renders one event. It returns the text to write, with \n line breaks.
func (r *renderer) event(ev Event) string {
	var b strings.Builder
	switch e := ev.(type) {
	case Text:
		s := clean(e.Text)
		if s == "" {
			break
		}
		if e.Thought != r.thought {
			r.lineStart(&b)
			r.thought = e.Thought
		}
		if e.Thought {
			// Dim each piece on its own, so a line break inside it does
			// not leave the style open across a redraw.
			for i, part := range strings.Split(s, "\n") {
				if i > 0 {
					b.WriteString("\n")
				}
				if part != "" {
					b.WriteString(sgrDim)
					b.WriteString(part)
					b.WriteString(sgrReset)
				}
			}
		} else {
			b.WriteString(s)
		}
		r.midLine = !strings.HasSuffix(s, "\n")
	case Tool:
		r.tool(&b, e)
	case Plan:
		r.planBlock(&b, e)
	case Notice:
		colour, label := sgrYellow, "note"
		if e.Error {
			colour, label = sgrRed, "error"
		}
		r.block(&b, colour+label+sgrReset+": "+oneLine(e.Text))
	}
	return b.String()
}

// statusWord is how a tool status reads in the transcript.
func statusWord(s string) (string, string) {
	switch s {
	case ToolRunning:
		return "running", sgrCyan
	case ToolDone:
		return "done", sgrGreen
	case ToolFailed:
		return "failed", sgrRed
	}
	return "pending", sgrYellow
}

// toolLabel is a tool call as one line: its kind and its title.
func toolLabel(t Tool) string {
	title := oneLine(t.Title)
	if title == "" {
		title = oneLine(t.ID)
	}
	if k := oneLine(t.Kind); k != "" {
		return k + ": " + title
	}
	return title
}

func (r *renderer) tool(b *strings.Builder, t Tool) {
	prev := r.tools[t.ID]
	diffs := diffKey(t.Diffs)
	if prev.status == t.Status && prev.diffs == diffs {
		return
	}
	// Pending and running read the same to a person watching: the call is
	// under way. Only the change to an end is worth a second line.
	started := prev.status != ""
	ending := t.Status == ToolDone || t.Status == ToolFailed
	if !started || (ending && prev.status != t.Status) {
		word, colour := statusWord(t.Status)
		if !started && !ending {
			word, colour = statusWord(ToolRunning)
		}
		r.block(b, colour+"["+word+"]"+sgrReset+" "+toolLabel(t))
		if ending && t.Text != "" {
			r.block(b, sgrDim+indentLines(clipLines(clean(t.Text), maxToolText))+sgrReset)
		}
	}
	if diffs != "" && diffs != prev.diffs {
		r.lineStart(b)
		b.WriteString(renderDiffs(t.Diffs))
	}
	r.tools[t.ID] = toolShown{status: t.Status, diffs: diffs}
}

func (r *renderer) planBlock(b *strings.Builder, p Plan) {
	var s strings.Builder
	s.WriteString(sgrBold + "plan" + sgrReset + "\n")
	for _, e := range p.Entries {
		mark := "[ ]"
		switch e.Status {
		case "completed":
			mark = "[x]"
		case "in_progress":
			mark = "[>]"
		}
		s.WriteString("  ")
		s.WriteString(mark)
		s.WriteString(" ")
		s.WriteString(oneLine(e.Content))
		s.WriteString("\n")
	}
	if s.String() == r.plan {
		return
	}
	r.plan = s.String()
	r.block(b, r.plan)
}

// prompt is the person's prompt as the transcript shows it.
func (r *renderer) prompt(text string) string {
	var b strings.Builder
	r.lineStart(&b)
	b.WriteString("\n")
	lines := strings.Split(clean(text), "\n")
	b.WriteString(sgrBold)
	b.WriteString("you")
	b.WriteString(sgrReset)
	b.WriteString("  ")
	b.WriteString(lines[0])
	b.WriteString("\n")
	for _, l := range lines[1:] {
		b.WriteString("     ")
		b.WriteString(l)
		b.WriteString("\n")
	}
	b.WriteString("\n")
	r.thought = false
	return b.String()
}

// permission is a permission request as the pane shows it: what is asked,
// its context and diffs, and the keys that answer it.
func (r *renderer) permission(p *Permission) string {
	var b strings.Builder
	r.lineStart(&b)
	r.thought = false
	b.WriteString("\n")
	b.WriteString(sgrBold)
	b.WriteString(sgrYellow)
	b.WriteString("permission")
	b.WriteString(sgrReset)
	b.WriteString(" ")
	b.WriteString(toolLabel(p.Tool))
	b.WriteString("\n")
	if d := oneLine(p.Detail); d != "" {
		b.WriteString("  ")
		b.WriteString(d)
		b.WriteString("\n")
	}
	if reason := oneLine(p.Reason); reason != "" {
		b.WriteString("  reason: ")
		b.WriteString(reason)
		b.WriteString("\n")
	}
	// Input the title does not show is shown under it, so the pane shows the
	// whole call even when the Inbox cannot.
	for _, k := range slices.Sorted(maps.Keys(p.Tool.Input)) {
		if v := p.Tool.Input[k]; v != "" && !strings.Contains(p.Tool.Title, v) {
			b.WriteString("  ")
			b.WriteString(oneLine(k))
			b.WriteString(": ")
			b.WriteString(oneLine(v))
			b.WriteString("\n")
		}
	}
	if p.Tool.Text != "" {
		b.WriteString(sgrDim)
		b.WriteString(indentLines(clipLines(clean(p.Tool.Text), maxToolText)))
		b.WriteString(sgrReset)
		b.WriteString("\n")
	}
	if len(p.Tool.Diffs) > 0 {
		b.WriteString(renderDiffs(p.Tool.Diffs))
		r.tools[p.Tool.ID] = toolShown{status: r.tools[p.Tool.ID].status, diffs: diffKey(p.Tool.Diffs)}
	}
	b.WriteString("  ")
	b.WriteString(optionKeys(p))
	b.WriteString("\n")
	return b.String()
}

// optionKeys is the line that says which key picks which answer.
func optionKeys(p *Permission) string {
	parts := make([]string, 0, len(p.Options)+1)
	for i, o := range p.Options {
		if i >= 9 {
			break
		}
		parts = append(parts, fmt.Sprintf("%s%d%s %s", sgrBold, i+1, sgrReset, oneLine(o.Label)))
	}
	parts = append(parts, sgrBold+"Ctrl+C"+sgrReset+" cancel the turn")
	return strings.Join(parts, "   ")
}

// answered is the line under a permission once it is answered.
func (r *renderer) answered(p *Permission, i int, how string) string {
	var b strings.Builder
	label := "cancelled"
	if i >= 0 && i < len(p.Options) {
		label = oneLine(p.Options[i].Label)
	}
	r.block(&b, sgrDim+"answered: "+sgrReset+label+sgrDim+" ("+oneLine(how)+")"+sgrReset)
	return b.String()
}

// turnEnd is the line a turn ends with.
func (r *renderer) turnEnd(res TurnResult) string {
	var b strings.Builder
	switch res.Stop {
	case StopFailed, StopRefused:
		msg := "turn " + res.Stop
		if d := oneLine(res.Detail); d != "" {
			msg += ": " + d
		}
		r.block(&b, sgrRed+msg+sgrReset)
	default:
		msg := "turn " + res.Stop
		if d := oneLine(res.Detail); d != "" {
			msg += ": " + d
		}
		r.block(&b, sgrDim+msg+sgrReset)
	}
	return b.String()
}

// line is a line of the client's own, dimmed.
func (r *renderer) line(s string) string {
	var b strings.Builder
	r.block(&b, sgrDim+s+sgrReset)
	return b.Str
```

### Core Architecture Module: `internal/app/dock_engine.go`
```
package app

import (
	"context"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"
	"unicode/utf8"

	"github.com/Gaurav-Gosain/tuios/internal/config"
	"github.com/Gaurav-Gosain/tuios/internal/invisible"
)

// The dock's refresh engine.
//
// The property this file exists to hold is one line long: a dock with no
// interval component arms no timer. Not a cheap timer, none. The scheduler
// below parks on a channel receive when nothing is due, so a default session
// pays nothing for the dock, and BenchmarkIdleTick stays where it is.
//
// A clock that shows seconds needs one frame per second and the meters need
// one per two seconds, not one per frame. Each of them is a component with a
// deadline, the engine wakes for the earliest one, and a value that has not
// moved draws nothing at all.
//
// Custom components are subprocesses, which is the whole of the extension
// contract: environment in, one line of text out. Everything about them that is
// careful is in this file, because a dock cell that hangs the render loop would
// be a catastrophe. They run off the Bubble Tea goroutine, under a timeout,
// reading a bounded amount of output, and a failure hides the cell rather than
// breaking the bar.

// dockComponentUpdate is one component's new state, travelling from an engine
// goroutine to the model.
type dockComponentUpdate struct {
	Name string

	// Builtin marks this as a due notice rather than a value. A built-in's
	// refresh reads model state (the window list, the CPU history), which only
	// the Bubble Tea goroutine may touch, so the engine says when and the model
	// does the work.
	Builtin bool

	Text string
	Exit int
	Err  string

	// from is the engine that sent the update, set by the listener. A reload
	// replaces the engine, and an update from the old one is not applied to
	// the new one.
	from *dockEngine
}

// dockComponentMsg carries an update into Update. One message per update keeps
// the render gate simple: the handler compares the new text against the old and
// skips the frame when nothing moved.
type dockComponentMsg dockComponentUpdate

// dockComponent is one cell's definition and its live state.
type dockComponent struct {
	Name     string // "cpu", or "custom/git" for a user's own
	Builtin  bool
	Command  string
	OnClick  string
	MaxWidth int
	Refresh  config.DockRefresh

	// MultiLine keeps every line of stdout, newline separated, rather than
	// the first. The rail's custom section draws one row per line; a dock
	// cell has one line to draw.
	MultiLine bool
	// Coalesce keeps one pending re-run for an event that lands while the
	// command is running, where a dock cell drops it. The rail's rows are
	// about the focused pane, and a focus change dropped mid-run would leave
	// the old pane's text on screen until the next event.
	Coalesce bool

	// Everything below is guarded by dockEngine.mu.
	text     string
	lastRun  time.Time
	lastExit int
	lastErr  string
	failures int
	nextDue  time.Time
	running  bool
	stopped  bool // gave up after DockCustomFailureLimit consecutive failures
	reported bool // the failure has already been put in front of the user once
	pending  bool // an event landed mid-run; run once more when this one ends

	// revive wakes a push reader that has given up. It is a channel rather than
	// a retry interval because a reader waiting on a timer is a timer, and the
	// whole point of this engine is that nothing holds one without being asked
	// to. A push component that cannot start is revived by refresh-dock and by
	// nothing else.
	revive chan struct{}
}

// dockEngine schedules the dock's components. One per client: components draw
// in the client, so they run in the client.
type dockEngine struct {
	mu    sync.Mutex
	comps map[string]*dockComponent
	order []string // definition order, so listings are stable

	updates chan dockComponentUpdate

	// wake re-plans the scheduler after the component set or a deadline
	// changes. It is a channel rather than a timer because parking on a receive
	// is what "no timer at idle" means.
	wake chan struct{}

	ctx    context.Context
	cancel context.CancelFunc

	// session and socket are handed to every command, the way hooks are given
	// their context. Guarded by mu because a client may attach elsewhere.
	session string
	socket  string

	// rail is the environment the rail section's command runs with: the
	// focused pane and the section's size, read fresh by the model for each
	// run and handed over here, under mu, because runs start on engine
	// goroutines that may not touch the model.
	rail          railContext
	secondaryRail railContext

	// wakes counts scheduler firings and pushed lines. The idle guard reads it;
	// nothing else should.
	wakes atomic.Int64

	// eventDue debounces event-driven refreshes: a burst of daemon events
	// re-runs a component once, not once per event.
	eventDue map[string]time.Time
}

// dockEngineUpdateBuffer is how many updates may queue before an engine
// goroutine blocks. A component that pushes faster than the model drains is
// slowed to the model's pace rather than being allowed to grow a backlog.
const dockEngineUpdateBuffer = 64

// dockEventDebounce is how long a component waits after an event before it
// re-runs, so a burst of daemon events costs one execution.
const dockEventDebounce = 200 * time.Millisecond

// railContext is what the rail section's command is told about where it
// draws and what has the focus.
//
// The pane's folder is carried as the model holds it, not as the command is
// told it. Turning it into a folder means a stat, and the model builds this
// on every message on the update goroutine, where a pane sitting in a hung
// network folder would freeze the client. So the run resolves it when it
// starts, on its own goroutine (railContext.folder).
type railContext struct {
	Width, Height int
	PaneID        string
	// PaneDir is the folder the pane last reported (OSC 7), unparsed, or
	// empty when it never reported one.
	PaneDir string
	// PanePgid is the pane's shell, for a local pane that reported no folder:
	// its working directory is the fallback, read at run start.
	PanePgid int
	// Remote says the session is on another machine, so PaneDir is a path
	// there and nothing on this machine can check it.
	Remote bool
}

// newDockEngine builds the engine for a set of components and starts the
// scheduler. The scheduler goroutine exists even with nothing to schedule: it
// parks on a receive, costing one goroutine and no timer, which is what keeps
// refresh-dock and event refreshes working on a dock that never polls.
func newDockEngine(comps []*dockComponent) *dockEngine {
	ctx, cancel := context.WithCancel(context.Background())
	e := &dockEngine{
		comps:    make(map[string]*dockComponent, len(comps)),
		updates:  make(chan dockComponentUpdate, dockEngineUpdateBuffer),
		wake:     make(chan struct{}, 1),
		ctx:      ctx,
		cancel:   cancel,
		eventDue: map[string]time.Time{},
	}
	for _, c := range comps {
		if _, dup := e.comps[c.Name]; dup {
			continue
		}
		if c.Refresh.Kind == config.DockRefreshPush {
			c.revive = make(chan struct{}, 1)
		}
		e.comps[c.Name] = c
		e.order = append(e.order, c.Name)
	}
	go e.schedule()
	return e
}

// Stop tears the engine down. Every command it started is killed with it: the
// components are UI, and UI that outlives the client that drew it is a leak.
func (e *dockEngine) Stop() {
	if e == nil {
		return
	}
	e.cancel()
}

// SetContext records the session name and socket path handed to every command.
func (e *dockEngine) SetContext(session, socket string) {
	if e == nil {
		return
	}
	e.mu.Lock()
	e.session, e.socket = session, socket
	e.mu.Unlock()
}

// SetRailContext records what the next rail run is told. Read under the lock
// in the hold that starts the run, so a run always sees the values the model
// had when it started, and the width it is skipped for is the width it would
// have been told.
func (e *dockEngine) SetRailContext(ctx railContext) {
	if e == nil {
		return
	}
	e.mu.Lock()
	e.rail = ctx
	e.mu.Unlock()
}

func (e *dockEngine) SetSecondaryRailContext(ctx railContext) {
	if e == nil {
		return
	}
	e.mu.Lock()
	e.secondaryRail = ctx
	e.mu.Unlock()
}

// Updates is the channel the model listens on.
func (e *dockEngine) Updates() <-chan dockComponentUpdate {
	if e == nil {
		return nil
	}
	return e.updates
}

// Wakes is how many times the engine has had something to say. The idle guard
// asserts this stays at zero for a dock made only of once, push and event
// components.
func (e *dockEngine) Wakes() int64 {
	if e == nil {
		return 0
	}
	return e.wakes.Load()
}

// Text is a component's current cell text.
func (e *dockEngine) Text(name string) string {
	if e == nil {
		return ""
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	if c, ok := e.comps[name]; ok {
		return c.text
	}
	return ""
}

// Component returns a copy of one component's definition and state.
func (e *dockEngine) Component(name string) (dockComponent, bool) {
	if e == nil {
		return dockComponent{}, false
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	c, ok := e.comps[name]
	if !ok {
		return dockComponent{}, false
	}
	return *c, true
}

// Snapshot copies every component in definition order, for list-dock-components.
func (e *dockEngine) Snapshot() []dockComponent {
	if e == nil {
		return nil
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	out := make([]dockComponent, 0, len(e.order))
	for _, name := range e.order {
		if c, ok := e.comps[name]; ok {
			out = append(out, *c)
		}
	}
	return out
}

// Names lists the components the engine holds, sorted.
func (e *dockEngine) Names() []string {
	if e == nil {
		return nil
	}
	e.mu.Lock()
	defer e.mu.Unlock()
	out := append([]string(nil), e.order...)
	sort.Strings(out)
	return out
}

// Start runs the initial fill and spawns the push readers. It is separate from
// construction so a test can build an engine and inspect its plan without any
/
```

### Core Architecture Module: `internal/app/drop_zone_render.go`
```
package app

import (
	"image"
	"image/color"

	"charm.land/lipgloss/v2"
	uv "github.com/charmbracelet/ultraviolet"

	"github.com/Gaurav-Gosain/tuios/internal/config"
	"github.com/Gaurav-Gosain/tuios/internal/overlay"
	"github.com/Gaurav-Gosain/tuios/internal/theme"
	"tuios.dev/vt"
)

// applyDropZone shows where the held pane would land if the button came up
// now: the whole target for a swap, the half an edge drop gives it. It is a
// pass over the canvas right after the held pane's own layer, so it reads over
// that pane and the target alike and under any chrome drawn above them.
//
// The preview is drawn as the pane it becomes: a frame in the panes' own
// border glyphs, in the accent. With appearance.drop_preview = "fill" the
// inside is washed as well: one tinted ground, and every cell's text carried
// most of the way to one muted ink, so what is under the zone reads as behind
// it rather than poking through it in its own colours. Glyphs that are drawn as
// solid shapes (powerline caps and arrows, block elements) are drawn in the
// tint itself, since a shape in any ink reads as a coloured blob on the wash. At 16 colours, where the tint is no colour at
// all, the frame is reverse video and the inside is left alone.
func (m *OS) applyDropZone(canvas *frameCanvas, id string) {
	held := m.LiveWindowDrag()
	if !m.dropZoneShown || m.dropZone == nil || held == nil || held.ID != id {
		return
	}
	land := m.dropZone.Land
	rect := image.Rect(land.X, land.Y, land.X+land.W, land.Y+land.H)
	area := canvas.Bounds()
	// In a view of a larger session the panes are drawn shifted and clipped,
	// and the highlight goes with them. See pane_view.go.
	if v := m.sessionView; v.on {
		rect = rect.Add(image.Pt(v.dx, v.dy))
		area = area.Intersect(v.clip)
	}
	clip := rect.Intersect(area)
	if clip.Empty() {
		return
	}
	if theme.Depth() == overlay.Depth16 {
		drawDropRingReverse(canvas, rect, clip)
		return
	}
	look := m.dropZoneLook()
	fill := m.Settings.DropPreview != config.DropPreviewOutline
	border := dropRingBorder(&m.Settings)
	ring := uv.Cell{Width: 1, Style: uv.Style{Fg: look.ring, Bg: look.ringBg}}
	if fill {
		ring.Style.Bg = look.tint
	}
	for y := clip.Min.Y; y < clip.Max.Y && y < len(canvas.Lines); y++ {
		row := canvas.Lines[y]
		for x := clip.Min.X; x < clip.Max.X && x < len(row); x++ {
			if g := dropRingGlyph(&border, rect, x, y); g != "" {
				ring.Content = g
				ring.Link = uv.Link{}
				// Set rather than a write in place: it blanks the other half
				// of a wide character the frame cuts through, which would
				// otherwise be left as half a glyph.
				row.Set(x, &ring)
				continue
			}
			if fill {
				m.washDropCell(&row[x], look)
			}
		}
	}
}

// drawDropRingReverse is the frame at 16 colours: the zone's edge cells in
// reverse video, their text kept. The inside is left alone, since the tint is
// not a colour at this depth and any slot would fight the pane's own text.
func drawDropRingReverse(canvas *frameCanvas, rect, clip image.Rectangle) {
	for y := clip.Min.Y; y < clip.Max.Y && y < len(canvas.Lines); y++ {
		row := canvas.Lines[y]
		for x := clip.Min.X; x < clip.Max.X && x < len(row); x++ {
			if x == rect.Min.X || x == rect.Max.X-1 || y == rect.Min.Y || y == rect.Max.Y-1 {
				st := &row[x].Style
				st.Fg, st.Bg = nil, nil
				st.Attrs |= uv.AttrReverse
			}
		}
	}
}

// dropRingBorder is the border the frame is drawn in: the one the panes use,
// so the preview looks like the frame the pane will get. A hidden border draws
// no frame at all, so the preview takes the rounded one (or ASCII in ASCII
// mode) instead of vanishing.
func dropRingBorder(s *config.Settings) lipgloss.Border {
	b := s.GetBorderForStyle()
	if b.Top == "" || b.Top == " " || b.Left == "" || b.Left == " " {
		if s.UseASCIIOnly {
			return lipgloss.ASCIIBorder()
		}
		return lipgloss.RoundedBorder()
	}
	return b
}

// dropRingGlyph is the border glyph the frame draws at (x, y), or "" for a
// cell inside it. A zone one cell wide is a vertical rule and one a single row
// high a horizontal rule: a corner there would close a box with no inside.
func dropRingGlyph(b *lipgloss.Border, rect image.Rectangle, x, y int) string {
	left, right := x == rect.Min.X, x == rect.Max.X-1
	top, bottom := y == rect.Min.Y, y == rect.Max.Y-1
	switch {
	case !left && !right && !top && !bottom:
		return ""
	case rect.Dx() == 1:
		return b.Left
	case rect.Dy() == 1:
		return b.Top
	case top && left:
		return b.TopLeft
	case top && right:
		return b.TopRight
	case bottom && left:
		return b.BottomLeft
	case bottom && right:
		return b.BottomRight
	case top:
		return b.Top
	case bottom:
		return b.Bottom
	}
	if left {
		return b.Left
	}
	return b.Right
}

// dropLook is the preview's colours for one palette and pane ground. They are
// kept on the OS and worked out again only when what they are made from
// changes, so a drag's frames measure nothing and box no colour.
type dropLook struct {
	key [6]uint32
	// tint is the ground of the filled zone. ink is the muted text colour
	// the wash carries every cell's text toward. ring is the frame's ink, ringBg
	// its ground when the zone is not filled: the pane's painted ground, or
	// nil for the terminal's own.
	tint, ink, ring, ringBg color.Color
	// fg and bg stand in for a cell that names no colour of its own.
	fg, bg color.Color
	wash   [dropWashSize]dropWashEntry
}

type dropWashEntry struct {
	key uint64
	out color.Color
}

const (
	dropWashBits = 6
	dropWashSize = 1 << dropWashBits
	// dropWashProbes is how many slots a lookup tries.
	dropWashProbes = 4
)

// dropWashMix is how far a cell's text is carried toward the muted ink. Far
// enough that a prompt's segments, an icon and an ls listing's colours all read
// as the one ink, with a trace of their hue left so the words stay apart.
const dropWashMix = 0.85

// dropZoneLook returns the preview's colours for this frame.
func (m *OS) dropZoneLook() *dropLook {
	pal := theme.UI()
	fg, bg := pal.Fg, pal.Surface
	if theme.CurrentThemeID() != "" {
		if f, b := theme.TerminalFg(), theme.TerminalBg(); !isNilColor(f) && !isNilColor(b) {
			fg, bg = f, b
		}
	}
	var ground color.Color
	if g := m.paneGround(); g.on() {
		ground, bg = g.bg, g.bg
		if !isNilColor(g.fg) {
			fg = g.fg
		}
	}
	key := [6]uint32{
		1<<31 | packColor8(pal.AccentTint), packColor8(pal.Accent),
		packColor8(fg), packColor8(bg), packColor8(ground), packColor8(pal.FgMute),
	}
	if l := &m.dropLook; l.key != key || isNilColor(l.tint) {
		*l = dropLook{key: key, tint: pal.AccentTint, fg: fg, bg: bg, ringBg: ground}
		// The text under the wash is held to the mark floor, not the text
		// floor: it is there to be recognised, not read.
		l.ink = theme.ReadableAt(pal.FgMute, pal.AccentTint, theme.MarkFloor)
		// The frame is a mark, held to the mark floor on the ground it is
		// drawn on: the tint when the zone is filled, the pane's ground when
		// it is not. One ink serves both, so it is measured on the harder.
		ink := theme.ReadableAt(pal.Accent, pal.AccentTint, theme.MarkFloor)
		l.ring = theme.ReadableAt(ink, bg, theme.MarkFloor)
	}
	return &m.dropLook
}

// washDropCell puts one cell inside the zone behind the preview: its ground
// becomes the tint, whatever ground it had, and its text is carried toward the
// muted ink and held to the mark floor on the tint. A solid-shape glyph takes
// the tint as its ink and vanishes into the wash. The attributes that would bring
// the text forward again or hide it are dropped with the colours.
func (m *OS) washDropCell(c *uv.Cell, look *dropLook) {
	st := &c.Style
	// A kitty placeholder's colour is the image's id, not a colour. See
	// dimCell.
	if vt.IsKittyPlaceholder(c.Content) {
		st.Bg = look.tint
		return
	}
	if solidGlyph(c.Content) {
		st.Fg, st.Bg = look.tint, look.tint
		st.UnderlineColor = nil
		st.Attrs &^= uv.AttrReverse | uv.AttrFaint | uv.AttrBlink | uv.AttrRapidBlink | uv.AttrConceal
		return
	}
	src := st.Fg
	if st.Attrs&uv.AttrReverse != 0 {
		src = st.Bg
		if isNilColor(src) {
			src = look.bg
		}
	} else if isNilColor(src) {
		src = look.fg
	}
	st.Fg = m.dropWash(src, look)
	st.Bg = look.tint
	st.UnderlineColor = nil
	st.Attrs &^= uv.AttrReverse | uv.AttrFaint | uv.AttrBlink | uv.AttrRapidBlink | uv.AttrConceal
}

// dropWash is a cell's text colour washed into the tint, behind a memo on the
// OS: a pane's text repeats a handful of colours, so a drag measures each once,
// and a hit hands back the colour already boxed. The memo probes a few slots
// from the hashed one, so two colours that hash alike do not evict each other
// on every other cell.
func (m *OS) dropWash(c color.Color, look *dropLook) color.Color {
	key := 1<<63 | uint64(packColor8(c))
	home := (key * 0x9e3779b97f4a7c15) >> (64 - dropWashBits)
	slot := home
	for p := range uint64(dropWashProbes) {
		e := &look.wash[(home+p)%dropWashSize]
		if e.key == key {
			return e.out
		}
		if e.key == 0 {
			slot = (home + p) % dropWashSize
			break
		}
	}
	out := theme.ReadableAt(overlay.MixColors(c, look.ink, dropWashMix), look.tint, theme.MarkFloor)
	look.wash[slot] = dropWashEntry{key: key, out: out}
	return out
}

// solidGlyph reports whether a cell's glyph is drawn as a filled shape rather
// than as a letter: the powerline separators and caps a prompt draws its
// segments with (U+E0B0 to U+E0D7), and the block elements (U+2580 to
// U+259F). Both are three bytes in UTF-8, and a check on the lead bytes keeps
// the common case, a one-byte letter, to one comparison.
func solidGlyph(s string) bool {
	if len(s) < 3 || s[0] < 0xe2 {
		return false
	}
	switch s[0] {
	case 0xe2: // U+2580..U+259F is E2 96 80..E2 96 9F
		return s[1] == 0x96 && s[2] >= 0x80 && s[2] <= 0x9f
	case 0xee: // U+E0B0..U+E0D7 is EE 82 B0..EE 83 97
		return (s[1] == 0x82 && s[2] >= 0xb0) || (s[1] == 0x83 && s[2] <= 0x97)
	}
	return false
}

```

### Core Architecture Module: `internal/app/frame_render.go`
```
package app

import (
	uv "github.com/charmbracelet/ultraviolet"
	"github.com/charmbracelet/x/ansi"

	"tuios.dev/vt"
)

// The composed frame's cells becoming the string bubbletea takes.
//
// ultraviolet's Lines.Render does this generically: per cell it compares the
// cell to the blank cell and its style to the pen through colour-by-RGBA
// equality, and per style change it computes the SGR diff afresh, which
// builds an ansi.Style slice and joins it into a string. Then lipgloss trims
// the result with uv.TrimSpace, which splits the frame into lines, trims each,
// and joins them again: two more copies of the frame. Under a flood the diff's
// allocations were near half of every object the client allocated per frame.
//
// frameRenderer.render writes the same bytes. Each step of Lines.Render is kept in the
// same order with the same conditions, so the test that compares the two over
// random cell buffers is the definition of done here; what changed is only
// how each step is answered. Equality is asked of the structs first and of
// the colours' RGBA only when the structs differ, which is the same answer
// because equal values have equal RGBA. The diff for a pair of styles is
// remembered, since a frame repeats the same few transitions thousands of
// times. And each line is trimmed as it is written, on the bytes it just
// produced, so the frame is built once.

// frameRenderer holds the buffer and memo the frame is rendered with, reused
// across frames.
type frameRenderer struct {
	out   []byte
	diffs map[[2]uv.Style]string
}

// maxDiffMemo bounds the memo. A frame uses a few dozen transitions; a memo
// past this size means the palette is churning and remembering it is not
// paying, so it starts over.
const maxDiffMemo = 4096

// diff is the SGR sequence that takes the pen from one style to the other,
// remembered by the pair.
func (r *frameRenderer) diff(from, to *uv.Style) string {
	key := [2]uv.Style{*from, *to}
	if s, ok := r.diffs[key]; ok {
		return s
	}
	if r.diffs == nil || len(r.diffs) >= maxDiffMemo {
		r.diffs = make(map[[2]uv.Style]string, 64)
	}
	s := uv.StyleDiff(from, to)
	r.diffs[key] = s
	return s
}

// render is uv.TrimSpace(uv.Lines(lines).Render()) byte for byte.
func (r *frameRenderer) render(lines []uv.Line) string {
	out := r.out[:0]
	for i, l := range lines {
		start := len(out)
		out = r.renderLine(out, l)
		out = trimLineRight(out, start)
		if i < len(lines)-1 {
			out = append(out, '\n')
		}
	}
	r.out = out
	return string(out)
}

// trimLineRight is uv.TrimSpace's treatment of one line, applied in place to
// the bytes from start: trailing blanks go, and a carriage return at the very
// end survives them.
func trimLineRight(out []byte, start int) []byte {
	end := len(out)
	hasCR := end > start && out[end-1] == '\r'
	if hasCR {
		end--
	}
	for end > start && out[end-1] == ' ' {
		end--
	}
	if hasCR {
		out[end] = '\r'
		end++
	}
	return out[:end]
}

// styleIsZero is Style.IsZero.
func styleIsZero(s *uv.Style) bool {
	return *s == uv.Style{}
}

// styleEqual is Style.Equal, answered by the structs when they match and by
// the colours' RGBA when they do not.
func styleEqual(a, b *uv.Style) bool {
	return *a == *b || a.Equal(b)
}

// isEmptyCell is Cell.Equal(&EmptyCell): a one-column space with no style and
// no link.
func isEmptyCell(c *uv.Cell) bool {
	return c.Width == 1 && c.Content == " " && styleIsZero(&c.Style) && c.Link == uv.Link{}
}

// renderLine is ultraviolet's renderLine, appending to out.
func (r *frameRenderer) renderLine(out []byte, l uv.Line) []byte {
	var pen uv.Style
	var link uv.Link
	pending := 0

	for i := range l {
		c := &l[i]
		if c.IsZero() {
			continue
		}
		if isEmptyCell(c) {
			if !styleIsZero(&pen) {
				out = append(out, ansi.ResetStyle...)
				pen = uv.Style{}
			}
			if link != (uv.Link{}) {
				out = append(out, resetHyperlink...)
				link = uv.Link{}
			}
			pending++
			continue
		}

		for ; pending > 0; pending-- {
			out = append(out, ' ')
		}

		if styleIsZero(&c.Style) && !styleIsZero(&pen) {
			out = append(out, ansi.ResetStyle...)
			pen = uv.Style{}
		}
		if !styleEqual(&c.Style, &pen) {
			out = append(out, r.diff(&pen, &c.Style)...)
			pen = c.Style
		}

		if c.Link != link && link.URL != "" {
			out = append(out, resetHyperlink...)
			link = uv.Link{}
		}
		if c.Link != link {
			// Made safe here because the cell may come from a backend other
			// than the vt emulator, and this goes to the host as is.
			out = append(out, vt.SetHostHyperlink(c.Link.URL, c.Link.Params)...)
			link = c.Link
		}

		out = append(out, c.Content...)
	}

	for ; pending > 0; pending-- {
		out = append(out, ' ')
	}
	if link.URL != "" {
		out = append(out, resetHyperlink...)
	}
	if !styleIsZero(&pen) {
		out = append(out, ansi.ResetStyle...)
	}
	return out
}

// resetHyperlink is ansi.ResetHyperlink(), which builds the same string on
// every call.
var resetHyperlink = ansi.ResetHyperlink()

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1201** (2026-10-27): **[BUG]: Agent work display error**
  *Symptoms*: ### Brief Description  Agent work display error  ### Platform  Darwin (arm64)  ### Installation Method  Homebrew (macOS/Linux)  ### Version or Commit  v0.11.1  ### Current Behavior  https://github.com/user-attachments/assets/4b126854-cf0f-4ef5-94eb-3135c2c92f67  ### Expected Behavior  Displayed normally  ### Steps To Reproduce  As shown in the video.  ### Error Logs  ```shell  ```  ### Screenshots  _No response_
  **Post-Mortem & Fix Analysis**:
  > Thanks so much for the video @LovesAsuna, it made this easy to spot! The Agent View was dropping wide characters like Chinese from the thread and the Live box, and leaving those dark blocks behind. Someone hit the same thing with Korean in #1184, and it's fixed on main now (#1197 and #1194). I checked it with Chinese, Korean, Japanese and emoji in both the thread and the Live box.  It'll be in the next release, and building from main works if you want it sooner. I'll close this one as a duplicate of #1184, but please reopen if anything still looks off after you update!

- **Issue #1184** (2026-10-26): **[BUG]: Korean characters disappear in Agent View thread and live preview (v0.11.0)**
  *Symptoms*: ### Brief Description  After updating to v0.11.0, Korean characters disappear from Agent View's conversation thread and Live preview, while ASCII text and Korean agent titles remain visible.  ### Platform  Darwin (arm64)  ### Installation Method  Homebrew (macOS/Linux)  ### Version or Commit  v0.11.0 — 3638a6f2093edfa7396b6233515786de4dbda683 (Homebrew, pure-Go backend)  ### Current Behavior  - Korean characters in the conversation body disappear, leaving blank areas. - ASCII text, numbers, and punctuation remain visible. - Korean text in the agent title remains visible. - The Live preview also shows missing characters and visual artifacts.  Environment: macOS on Apple Silicon (Mac mini M4), Ghostty 1.3.1, Codex.  ### Suspected cause (source inspection)  In [ckCanvas.draw()](https://github.com/Gaurav-Gosain/tuios/blob/v0.11.0/internal/app/cockpit_canvas.go#L150), cells are copied from a temporary buffer using SetCell(). After copying a width-2 character, the function also calls SetCell() for its zero-width continuation cell:  ```go if cp.Content == "" && cp.Width == 0 {     // The second cell of a wide character.     c.buf.SetCell(x+i, y, &cp)     continue } ```  In the pinned [Ultraviolet dependency's Line.Set()](https://github.com/charmbracelet/ultraviolet/blob/0277a179edd9/buffer.go#L40), writing into a continuation cell clears the entire existing wide character. Copying the continuation cell therefore appears to erase the character just copied.  This also explains why tit

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

### Incident Patch 1: `cd386cd7` (2026-10-16)
**Commit Message**: feat(session): carry each pane's state and the daemon's memory in the handoff

PR 3 of the daemon live upgrade plan: the handoff format. Before it the new image adopted each pane around a blank emulator, under a new pane-token key and a new event stream, so a self-exec kept the processes and lost everything a program or an agent could see.

Each pane record now carries its emulator, packed, with 1000 rows of history and the character cluster it left open, and a live section for what the snapshot does not hold: the title, where the shell is and its branch, the OSC 133 marks and the command history they delimit, the OSC 7501 records, and the stream position, ring and resize marks a resuming subscriber reads from. Rows counted from the top of the history move up by the rows left behind, and the ones above the carried history are dropped. The snapshot is applied before the emulator has callbacks, so none of it is raised again as an event.

The daemon record carries the pane-token key, so every TUIOS_PANE_TOKEN still verifies; the event stream's boot id, numbering and replay ring, so a stream-pane or subscribe resumes rather than reporting a new boot; and the agents' mailboxes. It is JS

**File**: `internal/session/handoff.go` (modified, +10/-2)
```diff
@@ -241,13 +241,21 @@ func (r *handoffRun) writeManifest(sessions []*Session, refs []handoffPaneRef) e
 		if !ok {
 			return fmt.Errorf("pane %s has no terminal device here", shortID(ref.window))
 		}
+		rec.State, rec.Live = ref.pty.handoffCapture()
 		if err := mw.gob(handoffRecPane, rec); err != nil {
 			return err
 		}
 		r.fds = append(r.fds, rec.FD)
 	}
 
-	dr := handoffDaemon{SocketPath: d.manager.SocketPath(), Listeners: map[string]int{}, LockFD: -1}
+	dr := handoffDaemon{
+		SocketPath:   d.manager.SocketPath(),
+		Listeners:    map[string]int{},
+		LockFD:       -1,
+		PaneTokenKey: d.manager.paneTokenKey,
+		Events:       d.events.handoffState(),
+		Mail:         d.agents.handoffState(),
+	}
 	for name, l := range d.namedListeners() {
 		var fd int
 		if !listenerFD(l, func(n int) { fd = n }) {
@@ -260,7 +268,7 @@ func (r *handoffRun) writeManifest(sessions []*Session, refs []handoffPaneRef) e
 		dr.LockFD = int(d.startLock.Fd()) //nolint:gosec // a descriptor number
 		r.fds = append(r.fds, dr.LockFD)
 	}
-	if err := mw.gob(handoffRecDaemon, dr); err != nil {
+	if err := mw.json(handoffRecDaemon, dr); err != nil {
 		return err
 	}
 	n, err := mw.finish()
```

**File**: `internal/session/handoff_adopt.go` (modified, +13/-0)
```diff
@@ -55,6 +55,13 @@ func (d *Daemon) adopt(fd int) error {
 
 	socketPath := m.Daemon.SocketPath
 	d.manager.SetSocketPath(socketPath)
+	// Before any pane is entered: a pane's token is checked against the key,
+	// and its events go on from the carried numbering.
+	if len(m.Daemon.PaneTokenKey) > 0 {
+		d.manager.paneTokenKey = m.Daemon.PaneTokenKey
+	}
+	d.events.restore(m.Daemon.Events)
+	d.agents.restore(m.Daemon.Mail)
 	listeners := map[string]net.Listener{}
 	// FileListener works on a copy of each descriptor. The inherited ones are
 	// closed only once the adoption has gone through.
@@ -218,10 +225,16 @@ func (s *Session) adoptPTY(rec handoffPane, w WindowState, onExit func(string))
 	}
 
 	ctx, cancel := context.WithCancel(context.Background())
+	// The snapshot goes in before the emulator has callbacks, so nothing it
+	// sets is raised as an event: none of it is new.
 	terminal := vt.NewWithScrollback(rec.Width, rec.Height, s.scrollbackLines())
+	if rec.State != nil {
+		ApplyTerminalState(terminal, rec.State)
+	}
 	sp := ptySpawn{windowID: w.ID, onExit: onExit, workspace: w.Workspace, keepOpen: rec.KeepOpen && !rec.Exited}
 	pty := s.installPTY(ctx, cancel, rec.ID, master, nil, rec.Width, rec.Height, sp, terminal)
 	pty.spawnW, pty.spawnH = rec.SpawnW, rec.SpawnH
+	pty.restoreLive(rec.State, rec.Live)
 	if rec.Exited {
 		pty.exitedMu.Lock()
 		pty.exited, pty.exitCode = true, rec.ExitCode
```

**File**: `internal/session/handoff_daemon_state.go` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+package session
+
+import "slices"
+
+// What the daemon holds only in memory, carried across a live handoff so the
+// processes that kept running see one daemon: the key every pane's
+// TUIOS_PANE_TOKEN is signed with, the event stream's boot id, numbering and
+// replay ring, and the agents' mailboxes.
+
+// handoffEvents is an eventHub's state.
+type handoffEvents struct {
+	BootID string `json:"boot_id"`
+	Seq    uint64 `json:"seq"`
+	// Ring is the replay ring, oldest first.
+	Ring              []streamEvent `json:"ring,omitempty"`
+	EvictedSeq        uint64        `json:"evicted_seq,omitempty"`
+	LastOutputSeq     uint64        `json:"last_output_seq,omitempty"`
+	LastActivitySeq   uint64        `json:"last_activity_seq,omitempty"`
+	LastTranscriptSeq uint64        `json:"last_transcript_seq,omitempty"`
+	LastProgressSeq   uint64        `json:"last_progress_seq,omitempty"`
+	LastFileSeq       uint64        `json:"last_file_seq,omitempty"`
+	LastLayoutSeq     uint64        `json:"last_layout_seq,omitempty"`
+}
+
+// handoffMailbox is one session's agent mailbox.
+type handoffMailbox struct {
+	Msgs    []*AgentMessage `json:"msgs,omitempty"`
+	Bytes   int             `json:"bytes,omitempty"`
+	Evicted uint64          `json:"evicted,omitempty"`
+}
+
+// handoffMail is the agentBus's state. The send buckets and the open asks
+// are not carried: an ask in flight ends with the old image's connections.
+type handoffMail struct {
+	NextID uint64                    `json:"next_id"`
+	Boxes  map[string]handoffMailbox `json:"boxes,omitempty"`
+}
+
+// handoffState is the hub's state.
+func (h *eventHub) handoffState() handoffEvents {
+	h.mu.Lock()
+	defer h.mu.Unlock()
+	ev := handoffEvents{
+		BootID: h.bootID, Seq: h.seq, EvictedSeq: h.evictedSeq,
+		LastOutputSeq: h.lastOutputSeq, LastActivitySeq: h.lastActivitySeq,
+		LastTranscriptSeq: h.lastTranscriptSeq, LastProgressSeq: h.lastProgressSeq,
+		LastFileSeq: h.lastFileSeq, LastLayoutSeq: h.lastLayoutSeq,
+	}
+	for i := range h.ringLen {
+		ev.Ring = append(ev.Ring, h.ring[(h.ringStart+i)%len(h.ring)])
+	}
+	return ev
+}
+
+// restore makes a hub with no subscribers continue the carried one: the same
+// boot id, and numbering and replay that go on from where it stopped.
+func (h *eventHub) restore(ev handoffEvents) {
+	h.mu.Lock()
+	defer h.mu.Unlock()
+	if ev.BootID != "" {
+		h.bootID = ev.BootID
+	}
+	h.seq, h.evictedSeq = ev.Seq, ev.EvictedSeq
+	h.lastOutputSeq, h.lastActivitySeq = ev.LastOutputSeq, ev.LastActivitySeq
+	h.lastTranscriptSeq, h.lastProgressSeq = ev.LastTranscriptSeq, ev.LastProgressSeq
+	h.lastFileSeq, h.lastLayoutSeq = ev.LastFileSeq, ev.LastLayoutSeq
+	ring := ev.Ring
+	if len(ring) > len(h.ring) {
+		// A smaller ring than the old image's: the oldest go, as they would
+		// have there.
+		h.evictedSeq = ring[len(ring)-len(h.ring)-1].Seq
+		ring = ring[len(ring)-len(h.ring):]
+	}
+	h.ringStart, h.ringLen = 0, copy(h.ring, ring)
+}
+
+// handoffState is the bus's mailboxes.
+func (b *agentBus) handoffState() handoffMail {
+	b.mu.Lock()
+	defer b.mu.Unlock()
+	m := handoffMail{NextID: b.nextID, Boxes: make(map[string]handoffMailbox, len(b.boxes))}
+	for name, mb := range b.boxes {
+		box := handoffMailbox{Bytes: mb.bytes, Evicted: mb.evicted}
+		for _, msg := range mb.msgs {
+			c := *msg
+			c.Attachments = slices.Clone(msg.Attachments)
+			box.Msgs = append(box.Msgs, &c)
+		}
+		m.Boxes[name] = box
+	}
+	return m
+}
+
+// restore puts carried mailboxes into an empty bus.
+func (b *agentBus) restore(m handoffMail) {
+	b.mu.Lock()
+	defer b.mu.Unlock()
+	b.nextID = m.NextID
+	for name, box := range m.Boxes {
+		b.boxes[name] = &agentMailbox{msgs: box.Msgs, bytes: box.Bytes, evicted: box.Evicted, buckets: map[string]*sendBucket{}}
+	}
+}
```

**File**: `internal/session/handoff_layout_test.go` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+package session
+
+import (
+	"crypto/sha256"
+	"encoding/hex"
+	"fmt"
+	"reflect"
+	"strings"
+	"testing"
+)
+
+// handoffLayout is the recorded shape of the handoff manifest's records at
+// HandoffVersion. See TestHandoffLayoutMovesWithTheVersion.
+const handoffLayout = "1:8a8d88479c3288f9"
+
+// TestHandoffLayoutMovesWithTheVersion fails when a record of the handoff
+// manifest changes shape without HandoffVersion moving.
+//
+// A daemon image reads the manifest its predecessor wrote, and until the
+// version range widens they must be the same version. A record that gains,
+// loses or retypes a field under the same version would be read by a build
+// that does not know it: gob drops what it does not know and zeroes what it
+// does not find, and the pane comes back missing that state with no error. The
+// layout covers the handoff's own types and names the types it carries from
+// elsewhere (SessionState, TerminalState, the events and the mail), whose
+// fields are only ever added to and which have compatibility rules of their
+// own.
+func TestHandoffLayoutMovesWithTheVersion(t *testing.T) {
+	var b strings.Builder
+	seen := map[reflect.Type]bool{}
+	for _, v := range []any{handoffHeader{}, handoffSession{}, handoffPane{}, handoffDaemon{}} {
+		describeHandoffType(&b, reflect.TypeOf(v), seen)
+	}
+	sum := sha256.Sum256([]byte(b.String()))
+	got := fmt.Sprintf("%d:%s", HandoffVersion, hex.EncodeToString(sum[:8]))
+	if got != handoffLayout {
+		t.Fatalf("the handoff records changed shape: layout %s, recorded %s.\n"+
+			"If the previous image cannot read the new records, or this image the old ones, move HandoffVersion. Then record the new layout in handoffLayout.\n\n%s",
+			got, handoffLayout, b.String())
+	}
+}
+
+// describeHandoffType writes the fields of a handoff type, and of the handoff
+// types it holds, one per line.
+func describeHandoffType(b *strings.Builder, t reflect.Type, seen map[reflect.Type]bool) {
+	for t.Kind() == reflect.Pointer || t.Kind() == reflect.Slice || t.Kind() == reflect.Map {
+		t = t.Elem()
+	}
+	if t.Kind() != reflect.Struct || seen[t] || !strings.HasPrefix(t.Name(), "handoff") {
+		return
+	}
+	seen[t] = true
+	fmt.Fprintf(b, "%s\n", t.Name())
+	for i := range t.NumField() {
+		f := t.Field(i)
+		fmt.Fprintf(b, "  %s %s %q\n", f.Name, f.Type, f.Tag)
+	}
+	for i := range t.NumField() {
+		describeHandoffType(b, t.Field(i).Type, seen)
+	}
+}
```

**File**: `internal/session/handoff_manifest.go` (modified, +15/-4)
```diff
@@ -76,14 +76,25 @@ type handoffPane struct {
 	ExitCode   int
 	ExitSignal int
 	KeepOpen   bool
+	// State is the pane's emulator, packed, with handoffHistoryRows of its
+	// history and the character cluster it left open.
+	State *TerminalState
+	// Live is what the snapshot does not hold.
+	Live handoffLive
 }
 
 // handoffDaemon is the daemon's own record.
 type handoffDaemon struct {
-	SocketPath string
+	SocketPath string `json:"socket_path"`
 	// Listeners is the descriptor of each listening socket, by name.
-	Listeners map[string]int
-	LockFD    int
+	Listeners map[string]int `json:"listeners"`
+	LockFD    int            `json:"lock_fd"`
+	// PaneTokenKey signs every pane's TUIOS_PANE_TOKEN. Without it a token
+	// stops verifying at the handoff, and a process outside its pane's tree
+	// can no longer prove which pane it is.
+	PaneTokenKey []byte        `json:"pane_token_key,omitempty"`
+	Events       handoffEvents `json:"events"`
+	Mail         handoffMail   `json:"mail"`
 }
 
 // handoffManifest is a manifest as read.
@@ -199,7 +210,7 @@ func readHandoffManifest(r io.Reader) (*handoffManifest, error) {
 				m.Panes = append(m.Panes, p)
 			}
 		case handoffRecDaemon:
-			err = gob.NewDecoder(bytes.NewReader(payload)).Decode(&m.Daemon)
+			err = json.Unmarshal(payload, &m.Daemon)
 		case handoffRecEnd:
 			return m, nil
 		default:
```

**File**: `internal/session/handoff_pane_state.go` (added, +225/-0)
```diff
@@ -0,0 +1,225 @@
+package session
+
+import (
+	"cmp"
+	"slices"
+	"time"
+
+	"tuios.dev/progstatus"
+	"tuios.dev/vt"
+)
+
+// What a pane holds that its emulator's snapshot does not, carried across a
+// live handoff (docs/design/live-handoff.md, section 2.3): its title, where its
+// shell is, its OSC 133 marks and the commands they delimit, its OSC 7501
+// records, and the stream position and ring a resuming subscriber reads from.
+
+// handoffHistoryRows is how much history each pane's emulator carries: the
+// depth a client gets on attach.
+const handoffHistoryRows = 1000
+
+// handoffLive is a pane's live section.
+type handoffLive struct {
+	Title string
+	Place handoffPlace
+	// Marks are the OSC 133 marks, on the rows of the carried emulator.
+	Marks []vt.SemanticMarker
+	Shell handoffShell
+	// ProgStatus is the OSC 7501 store, oldest update first.
+	ProgStatus []progstatus.Record
+
+	// The stream. Ring is the last bytes of it, ending at OutputSeq.
+	OutputSeq   int64
+	Ring        []byte
+	ResizeMarks []handoffResizeMark
+	VTResizes   int64
+	LastOutput  int64
+}
+
+// handoffPlace is a placeRecord.
+type handoffPlace struct {
+	Cwd, Branch   string
+	Announced     bool
+	ElsewhereHost string
+	ElsewhereDir  string
+}
+
+// handoffResizeMark is a resizeMark.
+type handoffResizeMark struct {
+	Seq           int64
+	Width, Height int
+}
+
+// handoffShell is a shellTrack, with its rows on the carried emulator.
+type handoffShell struct {
+	Seen          bool
+	Phase         uint8
+	Cmdline       string
+	Started       time.Time
+	StartedLine   int
+	Seq           uint64
+	LastCmdline   string
+	LastExit      *int
+	LastDuration  time.Duration
+	LastAt        time.Time
+	Commands      bool
+	PromptLine    int
+	Expecting     bool
+	ExpectingLine int
+	PromptOnly    bool
+	PromptTop     int
+	StartedPrompt int
+	StartedCwd    string
+	History       []handoffCommand
+}
+
+// handoffCommand is a shellCommandRecord.
+type handoffCommand struct {
+	Seq          uint64
+	Cmdline      string
+	Exit         *int
+	Started      time.Time
+	Duration     time.Duration
+	Cwd          string
+	PromptOrigin int
+}
+
+// handoffCapture snapshots a quiesced pane's emulator and its live section.
+//
+// The emulator carries handoffHistoryRows of its history, so a row the pane
+// counts from the top of its history moves up by the rows left behind. Marks
+// and the shell's rows are moved here, and the ones above the carried
+// history are dropped. A row stored plus the marker list's origin is stored
+// against an origin of zero, which is where the new emulator's list starts.
+func (p *PTY) handoffCapture() (*TerminalState, handoffLive) {
+	state := p.GetTerminalStatePacked(handoffHistoryRows, 0)
+	live := handoffLive{Title: p.Title(), Place: p.place.handoffState(), ProgStatus: p.progStatus.Records()}
+	slices.SortFunc(live.ProgStatus, func(a, b progstatus.Record) int { return cmp.Compare(a.Seq, b.Seq) })
+
+	dropped, origin := 0, 0
+	if state != nil {
+		dropped = state.ScrollbackLen - min(state.ScrollbackLen, handoffHistoryRows)
+	}
+	if p.marks != nil {
+		origin = p.marks.Trimmed()
+		for _, m := range p.marks.Markers() {
+			if m.AbsLine -= dropped; m.AbsLine >= 0 {
+				live.Marks = append(live.Marks, m)
+			}
+		}
+	}
+	live.Shell = p.shell.handoffState(
+		func(row int) int { return row - dropped },
+		func(row int) int { return row - origin - dropped },
+	)
+
+	p.outputMu.RLock()
+	live.OutputSeq = p.outputSeq
+	live.Ring = slices.Clone(p.outputBuffer[:p.outputPos])
+	for _, m := range p.resizeMarks {
+		live.ResizeMarks = append(live.ResizeMarks, handoffResizeMark{Seq: m.seq, Width: m.width, Height: m.height})
+	}
+	p.outputMu.RUnlock()
+	p.terminalMu.RLock()
+	live.VTResizes = p.vtResizes
+	p.terminalMu.RUnlock()
+	live.LastOutput = p.lastOutput.Load()
+	return state, live
+}
+
+// restoreLive puts a pane's live section back on a pane adopted around an
+// emulator the carried snapshot was applied to. The pane has not started.
+func (p *PTY) restoreLive(state *TerminalState, live handoffLive) {
+	if live.Title != "" {
+		title := live.Title
+		p.title.Store(&title)
+	}
+	p.place.restore(live.Place)
+	if p.marks != nil {
+		for _, m := range live.Marks {
+			p.marks.Add(m)
+		}
+	}
+	p.shell.restore(live.Shell)
+	for _, r := range live.ProgStatus {
+		p.progStatus.ApplyFrom(progstatus.Report{
+			State: r.State, ID: r.ID, Kind: r.Kind, Progress: r.Progress, App: r.App, Title: r.Title, Msg: r.Msg,
+		}, r.At, r.Group)
+	}
+
+	p.outputSeq = live.OutputSeq
+	// The ring grows with the output, so an adopted pane's starts empty.
+	p.outputBuffer = make([]byte, outputRingSize(len(live.Ring)))
+	p.outputPos = copy(p.outputBuffer, live.Ring)
+	p.resizeMarks = p.resizeMarks[:0]
+	for _, m := range live.ResizeMarks {
+		p.resizeMarks = append(p.resizeMarks, resizeMark{seq: m.Seq, width: m.Width, height: m.Height})
+	}
+	if state != nil {
+		p.vtSeq = state.Seq
+	}
+	p.vtResizes = live.VTResizes
+	p.lastOutput.S
```

**File**: `internal/session/session.go` (modified, +11/-5)
```diff
@@ -5096,6 +5096,16 @@ func (p *PTY) vtWriter() {
 // outputRingMax is the most the catch-up ring holds.
 const outputRingMax = 64 * 1024
 
+// outputRingSize is the size the catch-up ring grows to for n bytes: a power
+// of two from 1 KiB that holds them, up to outputRingMax.
+func outputRingSize(n int) int {
+	size := 1024
+	for size < n && size < outputRingMax {
+		size *= 2
+	}
+	return min(size, outputRingMax)
+}
+
 // appendToBuffer records a chunk in the catch-up buffer and returns the stream
 // position it ends at. Callers hold streamMu, so the ring may be reassigned
 // here while broadcast reads its length.
@@ -5114,11 +5124,7 @@ func (p *PTY) appendToBuffer(data []byte) int64 {
 	// Grow before anything shifts: a ring below its bound gets room for this
 	// chunk, so it never drops a byte the full ring would still hold.
 	if len(p.outputBuffer)-p.outputPos < len(data) && len(p.outputBuffer) < outputRingMax {
-		size := 1024
-		for size < p.outputPos+len(data) && size < outputRingMax {
-			size *= 2
-		}
-		grown := make([]byte, min(size, outputRingMax))
+		grown := make([]byte, outputRingSize(p.outputPos+len(data)))
 		copy(grown, p.outputBuffer[:p.outputPos])
 		p.outputBuffer = grown
 	}
```

---

### Incident Patch 2: `f71d93c9` (2026-10-26)
**Commit Message**: fix(session): make the tampered plugin token always differ

The test wrote 00 over the token's first byte, which is no tamper at all
when the token's first byte is already 00: once in 256 daemon starts the
daemon rightly took the unchanged token and the test failed, as it just
did on the ghostty job. Flip one hex digit instead.

**File**: `internal/session/pane_grants_test.go` (modified, +10/-1)
```diff
@@ -901,7 +901,16 @@ func TestThePluginTokenHoldsTheCaller(t *testing.T) {
 		t.Errorf("a caller with a plugin's token was confirmed as the person")
 	}
 
-	env["TUIOS_PLUGIN_TOKEN"] = "00" + env["TUIOS_PLUGIN_TOKEN"][2:]
+	// Flip one hex digit rather than writing a fixed prefix: a token whose
+	// first byte is already 00 would survive that untouched, and the daemon
+	// would rightly take it. (Once in 256 daemon starts, drawn on CI.)
+	tampered := []byte(env["TUIOS_PLUGIN_TOKEN"])
+	if tampered[0] == '0' {
+		tampered[0] = '1'
+	} else {
+		tampered[0] = '0'
+	}
+	env["TUIOS_PLUGIN_TOKEN"] = string(tampered)
 	bad, err := DialVerbClientAt(sp, "test")
 	if err != nil {
 		t.Fatal(err)
```

---

### Incident Patch 3: `9f245be6` (2026-10-27)
**Commit Message**: fix(herdr): let agent start wait for codex and pi

herdr agent start --kind codex or pi failed with timeout in under a
second, while tuios start-agent started both.

The wait ended on the first agent_not_found. Right after the start, the
pane does not count as an agent yet, so the wait gave up before the
agent was up. It now asks again until its deadline, as herdr does.

Codex sends an OSC 7501 idle before any hook runs. That report names no
harness, so the pane sat at idle with no harness, and the detector left
it so because the state was already set. The herdr front lists a pane
as an agent only with a harness, so codex never showed. The detector
now fills in the harness the process is when a pane's own sequence set
the state and named none. A report from a caller is left as it is.

Fixes #1200

**File**: `e2e/tui/NEGATIVE_CONTROLS.md` (modified, +3/-0)
```diff
@@ -701,6 +701,9 @@ a working negative control look like a broken one for half an hour.
 | `pane edges`, `pane focus --direction` and `pane zoom` unanswered | n/a, injected, cuts the wiring | drop `pane.edges`, `pane.focus_direction` and `pane.zoom` from `herdrMethods` | `TestHerdrFrontVimNavigation` ("pane edges exited 1") | **caught** |
 | A read-only pane swaps panes | n/a, injected | replace the `herdrAdmit(cs, "set-layout", ...)` check in `herdrPaneSwap` with a nil error | `TestHerdrFrontHoldsThePaneToItsGrants` ("swap from a read-only pane: exit 0", and "a refused call changed the layout"). The same cut in the focus and zoom methods is not caught, and that is correct: `focus-window` and `run-command` refuse the pane on the same grant | **caught** for swap |
 | `agent start` unanswered | n/a, injected, cuts the wiring | drop `agent.start` and `workspace.focus` from `herdrMethods` | `TestHerdrFrontStartsAnAgentAndShowsAWorkspace` ("agent start exited 1") | **caught** |
+| `agent start --kind codex` failed with `timeout` at once (#1200) | whole change | the binary from `origin/main` (`fd50e7b8`) | `TestHerdrFrontStartsCodexAndPi` ("agent start --kind codex exited 1", `timeout` after 1.3 s with `--timeout 8000`) | **caught** |
+| `agent start` ended its wait on the first `agent_not_found`, before the pane counted as an agent (#1200) | n/a, injected | the `agent_not_found` retry in `waitAgentStart` (`internal/herdrcli/run.go`) never matches | `TestHerdrFrontStartsCodexAndPi` ("agent start --kind codex exited 1", `timeout` after 1.4 s) | **caught** |
+| A pane at idle from a report that named no harness, such as Codex's OSC 7501 idle, never got the harness its process is, so the herdr front listed no agent in it (#1200) | n/a, injected | the harness fill in the `detected && !owned` case of `detectionPass` (`internal/session/agent_detect.go`) never runs | `TestHerdrFrontStartsCodexAndPi` ("agent start --kind codex exited 1", `timeout` at the 8 s deadline) | **caught** |
 | `workspace focus` unanswered | n/a, injected, cuts the wiring | drop `workspace.focus` from `herdrMethods` | `TestHerdrFrontStartsAnAgentAndShowsAWorkspace` ("workspace focus exited 1") | **caught** |
 | `pane zoom` zoomed the pane that had the focus before, not the one named (review finding 1) | n/a, injected, cuts the wiring | drop `m.FocusWindow(i)` for the named pane in `ZoomWindowByID` (`internal/app/os_minimize.go`) | `TestHerdrFrontVimNavigation` ("pane zoom --on exited 1": the client zoomed the focused pane and reported the named one unzoomed). Stress on `taskset -c 0-1`: the binary before the fix failed the new test 8 of 20, after it 0 of 20 | **caught** |
 | `agent start` quoted fish arguments the POSIX way (review finding 2) | n/a, injected | the `fish` case of `herdrShellQuote` returns the POSIX quoting | `TestHerdrFrontAgentStartQuotesForTheShell` ("the agent in the fish pane got the arguments" changed). In this corpus the touch commands did not run under the control, so the catch is the changed arguments | **caught** |
```

**File**: `e2e/tui/herdr_front_test.go` (modified, +61/-0)
```diff
@@ -521,6 +521,67 @@ step focus "$H" workspace focus "$WS"
 	alive(t, term, "after the bridge sequence")
 }
 
+// TestHerdrFrontStartsCodexAndPi starts a codex and a pi through "$HERDR_BIN_PATH"
+// agent start, as herdr-projects starts its reviewers (#1200). Both are
+// stand-ins that reach ready the way the real ones do. The codex sends an
+// OSC 7501 idle at once, as Codex does, a report that names no harness. The
+// pi is not a process tuios knows for a second, then reports idle through
+// herdr. Each start must answer the agent idle, and agent list must name both.
+//
+// Negative controls: with agent_not_found ending waitAgentStart at once, the
+// codex start fails with timeout in about a second. With the detector's
+// harness fill taken out of detectionPass, codex stays at idle with no
+// harness, agent list leaves it out, and its start fails with timeout at the
+// deadline.
+func TestHerdrFrontStartsCodexAndPi(t *testing.T) {
+	term, base := herdrFrontClient(t)
+	ids := crushPanes(t, base, "bridge", "codexpane", "pipane")
+	stubs := filepath.Join(base, "stubs")
+	if err := os.MkdirAll(stubs, 0o700); err != nil {
+		t.Fatal(err)
+	}
+	// The script stays in the foreground, so its process is named codex.
+	codex := "#!/bin/sh\nprintf '\\033]7501;state=idle:app=codex\\033\\\\'\necho STUB-CODEX-UP\nwhile :; do read -r _ || sleep 1; done\n"
+	// exec gives the process another name, so only the report says pi.
+	pi := "#!/bin/sh\nexec sh -c 'sleep 1; \"$HERDR_BIN_PATH\" pane report-agent \"$HERDR_PANE_ID\" --source stub --agent pi --state idle --seq 1; echo STUB-PI-UP; sleep 300'\n"
+	for name, body := range map[string]string{"codex": codex, "pi": pi} {
+		if err := os.WriteFile(filepath.Join(stubs, name), []byte(body), 0o700); err != nil {
+			t.Fatal(err)
+		}
+	}
+	for _, w := range []string{"codexpane", "pipane"} {
+		typeIn(t, base, w, "PATH="+stubs+":$PATH; export PATH; echo "+strings.ToUpper(w)+"-READY")
+		waitJoined(t, base, w, strings.ToUpper(w)+"-READY")
+	}
+
+	steps := runHerdrSteps(t, base, "bridge", "reviewers", `
+step codex "$H" agent start reviewer-codex --kind codex --pane `+ids["codexpane"]+` --timeout 8000
+step pi "$H" agent start reviewer-pi --kind pi --pane `+ids["pipane"]+` --timeout 8000
+step list "$H" agent list
+`)
+	for _, kind := range []string{"codex", "pi"} {
+		steps[kind].ok(t, "agent start --kind "+kind)
+		start := steps[kind].json(t, "agent start --kind "+kind)
+		if dig(start, "result", "agent", "agent") != kind || dig(start, "result", "agent", "agent_status") != "idle" {
+			t.Fatalf("agent start --kind %s did not answer an idle %s:\n%s", kind, kind, steps[kind].out)
+		}
+	}
+	steps["list"].ok(t, "agent list")
+	listed := map[string]string{}
+	agents, _ := dig(steps["list"].json(t, "agent list"), "result", "agents").([]any)
+	for _, a := range agents {
+		m, _ := a.(map[string]any)
+		name, _ := m["name"].(string)
+		agent, _ := m["agent"].(string)
+		listed[name] = agent
+	}
+	if listed["reviewer-codex"] != "codex" || listed["reviewer-pi"] != "pi" {
+		t.Fatalf("agent list does not name both reviewers: %v\n%s", listed, steps["list"].out)
+	}
+	saveFrame(t, term, "herdr-front-codex-pi")
+	alive(t, term, "after the reviewers started")
+}
+
 // shq quotes s for the POSIX sh the step scripts run in.
 func shq(s string) string { return "'" + strings.ReplaceAll(s, "'", `'\''`) + "'" }
 
```

**File**: `internal/herdrcli/run.go` (modified, +11/-2)
```diff
@@ -22,6 +22,9 @@ const (
 	// agentStartDefault is how long agent start waits for the agent, as in
 	// herdr, when --timeout is not given.
 	agentStartDefault = 30 * time.Second
+	// agentStartRetry is the pause before agent start asks again about a
+	// pane that does not hold an agent yet.
+	agentStartRetry = 250 * time.Millisecond
 )
 
 // Options are what Main needs from its process.
@@ -222,10 +225,16 @@ func waitAgentStart(path string, c *Call, started map[string]any) map[string]any
 		if err != nil {
 			return map[string]any(err)
 		}
-		// An error is the wait's timeout, or a pane that went away, which
-		// never comes ready either.
+		// The pane does not hold an agent yet: the agent has not started,
+		// or tuios has not identified it. Ask again until the deadline, as
+		// herdr waits through a startup. Any other error is the wait's
+		// timeout, or a pane that went away, which never comes ready either.
 		result, ok := resp["result"].(map[string]any)
 		if !ok {
+			if e, _ := resp["error"].(map[string]any); e["code"] == "agent_not_found" {
+				time.Sleep(min(agentStartRetry, max(time.Until(deadline), 0)))
+				continue
+			}
 			return timedOut
 		}
 		agent, _ := result["agent"].(map[string]any)
```

**File**: `internal/session/agent_detect.go` (modified, +13/-0)
```diff
@@ -806,6 +806,19 @@ func (s *Session) detectionPass(st *SessionState, readings map[string]detectRead
 				s.setAgentClaim(w.ID, agentClaim{
 					source: AgentSourceDetect, harness: det.harness, identity: det.tier, auto: true,
 				})
+			} else if w.AgentHarness == "" && det.harness != "" && claim.source != AgentSourceReport {
+				// A pane's own sequence set the state first and named no
+				// harness: Codex sends an OSC 7501 idle before it runs a
+				// hook. The state stays the sequence's, but the pane is the
+				// harness its process is. Without it the pane has no screen
+				// rules, and the herdr front lists no agent in it. A report
+				// is a caller's word, and one that named no harness is left
+				// as it is.
+				out.changed++
+				if !write {
+					continue
+				}
+				w.AgentHarness = det.harness
 			}
 		case detected && owned:
 			// Still here. A miss count from an editor it opened is forgotten.
```

#### Recent Merged Pull Requests:
- **PR #1213** (2026-10-27): test(e2e): draw frames in JetBrainsMono Nerd Font Mono when it is installed (@Gaurav-Gosain)
- **PR #1206** (2026-10-27): perf(tml): copy only the containers a short patch writes (@Gsirawan)
- **PR #1204** (2026-10-27): test: make the tampered plugin token always differ (@Gaurav-Gosain)
- **PR #1203** (2026-10-27): fix(herdr): let agent start wait for codex and pi (@Gaurav-Gosain)
- **PR #1202** (2026-10-27): feat(dock): option to show the input mode on the mode pill while tiling (@Gaurav-Gosain)
- **PR #1198** (2026-10-27): perf(vt): write the screen's rows into one builder (@Gsirawan)

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

## X. session): carry each pane's state and the daemon's memory in the handoff

**RULE**:
When implementing operations in `internal/session/handoff.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Gaurav-Gosain/tuios. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `cd386cd7`: session): carry each pane's state and the daemon's memory in the handoff. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `internal/session/handoff.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
		rec.State, rec.Live = ref.pty.handoffCapture()
	dr := handoffDaemon{
		SocketPath:   d.manager.SocketPath(),
		Listeners:    map[string]int{},
		LockFD:       -1,
		PaneTokenKey: d.manager.paneTokenKey,
		Events:       d.events.handoffState(),
		Mail:         d.agents.handoffState(),
	}
	if err := mw.json(handoffRecDaemon, dr); err != nil {
```

**NEGATIVE CONSTRAINT**:
```go
// Anti-pattern to NEVER write (induced failure mode):
	dr := handoffDaemon{SocketPath: d.manager.SocketPath(), Listeners: map[string]int{}, LockFD: -1}
	if err := mw.gob(handoffRecDaemon, dr); err != nil {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `cd386cd7` are properly handled with clean fallback behavior.
